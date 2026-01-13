from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def _ensure_migrations_table(conn) -> None:
    conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
              version INTEGER PRIMARY KEY,
              applied_at TEXT NOT NULL
            )
            """
        )
    )


def _is_applied(conn, version: int) -> bool:
    row = conn.execute(
        text("SELECT 1 FROM schema_migrations WHERE version = :v LIMIT 1"),
        {"v": int(version)},
    ).fetchone()
    return bool(row)


def _mark_applied(conn, version: int) -> None:
    conn.execute(
        text(
            "INSERT INTO schema_migrations(version, applied_at) VALUES (:v, datetime('now'))"
        ),
        {"v": int(version)},
    )


def apply_migrations(engine: Engine) -> None:
    """
    轻量迁移（无 Alembic）：用于兼容历史 SQLite 文件结构。

    注意：SQLAlchemy 的 create_all 不会给既有表补列，所以需要在启动时做一次增量补齐，
    避免出现“no such column”导致的 500。
    """
    with engine.begin() as conn:
        _ensure_migrations_table(conn)

        insp = None
        tables = set()

        def refresh_schema() -> None:
            nonlocal insp, tables
            insp = inspect(conn)
            tables = set(insp.get_table_names())

        def mark_applied(version: int) -> None:
            _mark_applied(conn, version)
            refresh_schema()

        refresh_schema()

        # v1: 兼容旧库 exec_cases 缺少 executor_id 的情况（会导致执行/总览相关接口 500）。
        if not _is_applied(conn, 1):
            if "exec_cases" in tables:
                cols = set([c["name"] for c in insp.get_columns("exec_cases")])
                if "executor_id" not in cols:
                    conn.execute(text("ALTER TABLE exec_cases ADD COLUMN executor_id INTEGER"))
                    conn.execute(
                        text(
                            "CREATE INDEX IF NOT EXISTS ix_exec_cases_executor_id ON exec_cases(executor_id)"
                        )
                    )
            mark_applied(1)

        # v2: 执行集补充 case_file 关联与复用/需求元信息。
        if not _is_applied(conn, 2):
            if "exec_sets" in tables:
                cols = set([c["name"] for c in insp.get_columns("exec_sets")])
                if "case_file_id" not in cols:
                    conn.execute(text("ALTER TABLE exec_sets ADD COLUMN case_file_id INTEGER"))
                    conn.execute(
                        text(
                            "CREATE INDEX IF NOT EXISTS ix_exec_sets_case_file_id ON exec_sets(case_file_id)"
                        )
                    )
                if "requirement" not in cols:
                    conn.execute(text("ALTER TABLE exec_sets ADD COLUMN requirement VARCHAR(255)"))
                if "reuse_enabled" not in cols:
                    conn.execute(
                        text(
                            "ALTER TABLE exec_sets ADD COLUMN reuse_enabled BOOLEAN NOT NULL DEFAULT 0"
                        )
                    )
                if "reuse_presets" not in cols:
                    conn.execute(text("ALTER TABLE exec_sets ADD COLUMN reuse_presets TEXT"))
            mark_applied(2)

        # v3: 执行用例补充字段（优先级/前置/步骤）与复用/缺陷结构化存储。
        if not _is_applied(conn, 3):
            if "exec_cases" in tables:
                cols = set([c["name"] for c in insp.get_columns("exec_cases")])
                if "priority" not in cols:
                    conn.execute(text("ALTER TABLE exec_cases ADD COLUMN priority VARCHAR(32)"))
                if "precondition" not in cols:
                    conn.execute(text("ALTER TABLE exec_cases ADD COLUMN precondition TEXT"))
                if "steps" not in cols:
                    conn.execute(text("ALTER TABLE exec_cases ADD COLUMN steps TEXT"))
                if "reuse_details" not in cols:
                    conn.execute(text("ALTER TABLE exec_cases ADD COLUMN reuse_details TEXT"))
                if "defect_links" not in cols:
                    conn.execute(text("ALTER TABLE exec_cases ADD COLUMN defect_links TEXT"))
            mark_applied(3)

        # v4: 用例文件同名约束升级为“项目级”（同一项目下跨版本不允许同名）。
        # SQLite 无法直接 ALTER UNIQUE CONSTRAINT，这里用唯一索引实现；若历史数据已存在重复，则跳过创建以避免启动失败。
        if not _is_applied(conn, 4):
            if "case_files" in tables:
                dup = conn.execute(
                    text(
                        """
                        SELECT project_id, file_name_clean, COUNT(*) AS cnt
                        FROM case_files
                        GROUP BY project_id, file_name_clean
                        HAVING cnt > 1
                        LIMIT 1
                        """
                    )
                ).fetchone()
                if not dup:
                    conn.execute(
                        text(
                            "CREATE UNIQUE INDEX IF NOT EXISTS uq_case_file_name_project ON case_files(project_id, file_name_clean)"
                        )
                    )
            mark_applied(4)

        # v5: 用例条目唯一键升级为 “case_file_id + module + title + expected”。
        # 兼容历史库：早期可能只按 (case_file_id,module,title) 判重，导致“同标题不同预期”无法导入。
        if not _is_applied(conn, 5):
            if "case_items" in tables:
                idx_rows = conn.execute(text("PRAGMA index_list('case_items')")).fetchall()
                unique_indexes = []
                for row in idx_rows or []:
                    # row: (seq, name, unique, origin, partial)
                    name = row[1] if len(row) > 1 else None
                    is_unique = bool(row[2]) if len(row) > 2 else False
                    origin = row[3] if len(row) > 3 else ""
                    if not name or not is_unique:
                        continue
                    unique_indexes.append({"name": name, "origin": origin})

                def _index_cols(index_name: str) -> list[str]:
                    info = conn.execute(
                        text("PRAGMA index_info('" + str(index_name).replace("'", "''") + "')")
                    ).fetchall()
                    cols = []
                    for r in info or []:
                        # r: (seqno, cid, name)
                        if len(r) >= 3 and r[2]:
                            cols.append(str(r[2]))
                    return cols

                desired = ["case_file_id", "module", "title", "expected"]
                desired_set = set(desired)
                has_desired = False
                for idx in unique_indexes:
                    cols = _index_cols(idx["name"])
                    if set(cols) == desired_set:
                        has_desired = True
                        break

                if not has_desired:
                    # SQLite 无法删除 autoindex（来自表内 UNIQUE 约束），需要重建表。
                    cols = set([c["name"] for c in insp.get_columns("case_items")])
                    if "expected" not in cols:
                        # 兜底：极老库缺 expected 列，先补齐（NOT NULL 需带默认）。
                        conn.execute(
                            text("ALTER TABLE case_items ADD COLUMN expected TEXT NOT NULL DEFAULT ''")
                        )
                        cols.add("expected")

                    conn.execute(text("PRAGMA foreign_keys=OFF"))
                    conn.execute(text("ALTER TABLE case_items RENAME TO case_items_old"))
                    conn.execute(
                        text(
                            """
                            CREATE TABLE case_items (
                              id INTEGER NOT NULL PRIMARY KEY,
                              case_file_id INTEGER NOT NULL,
                              module VARCHAR(255) NOT NULL,
                              title VARCHAR(255) NOT NULL,
                              priority VARCHAR(32),
                              precondition TEXT,
                              steps TEXT,
                              expected TEXT NOT NULL,
                              remark TEXT,
                              created_by INTEGER,
                              updated_by INTEGER,
                              created_at DATETIME NOT NULL,
                              updated_at DATETIME NOT NULL,
                              CONSTRAINT uq_case_item_key UNIQUE (case_file_id, module, title, expected),
                              FOREIGN KEY(case_file_id) REFERENCES case_files (id) ON DELETE CASCADE,
                              FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL,
                              FOREIGN KEY(updated_by) REFERENCES users (id) ON DELETE SET NULL
                            )
                            """
                        )
                    )
                    # 复制旧数据：缺失字段以 NULL/当前时间兜底。
                    select_parts = []
                    target_cols = [
                        "id",
                        "case_file_id",
                        "module",
                        "title",
                        "priority",
                        "precondition",
                        "steps",
                        "expected",
                        "remark",
                        "created_by",
                        "updated_by",
                        "created_at",
                        "updated_at",
                    ]
                    for c in target_cols:
                        if c in cols:
                            select_parts.append(c)
                        elif c == "expected":
                            select_parts.append("'' AS expected")
                        elif c in ("created_at", "updated_at"):
                            select_parts.append("datetime('now') AS " + c)
                        else:
                            select_parts.append("NULL AS " + c)
                    conn.execute(
                        text(
                            "INSERT INTO case_items (" + ", ".join(target_cols) + ")\n"
                            "SELECT " + ", ".join(select_parts) + " FROM case_items_old"
                        )
                    )
                    conn.execute(text("DROP TABLE case_items_old"))
                    conn.execute(
                        text(
                            "CREATE INDEX IF NOT EXISTS ix_case_items_case_file_id ON case_items(case_file_id)"
                        )
                    )
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_case_items_id ON case_items(id)"))
                    conn.execute(text("PRAGMA foreign_keys=ON"))
            mark_applied(5)

        # v6: 用例文件新增复用类型标记（case_files.reuse_enabled），用于执行页复用开关与用例库展示/同步。
        if not _is_applied(conn, 6):
            if "case_files" in tables:
                cols = set([c["name"] for c in insp.get_columns("case_files")])
                if "reuse_enabled" not in cols:
                    conn.execute(
                        text(
                            "ALTER TABLE case_files ADD COLUMN reuse_enabled BOOLEAN NOT NULL DEFAULT 0"
                        )
                    )
                    conn.execute(
                        text(
                            "CREATE INDEX IF NOT EXISTS ix_case_files_reuse_enabled ON case_files(reuse_enabled)"
                        )
                    )
            mark_applied(6)

        # v7: 用例条目唯一键升级为 “case_file_id + module + title + precondition + steps + expected”。
        # 同时将 precondition/steps 升级为 NOT NULL（默认空串），避免 UNIQUE 遇到 NULL 失效。
        if not _is_applied(conn, 7):
            if "case_items" in tables:
                idx_rows = conn.execute(text("PRAGMA index_list('case_items')")).fetchall()
                unique_indexes = []
                for row in idx_rows or []:
                    # row: (seq, name, unique, origin, partial)
                    name = row[1] if len(row) > 1 else None
                    is_unique = bool(row[2]) if len(row) > 2 else False
                    origin = row[3] if len(row) > 3 else ""
                    if not name or not is_unique:
                        continue
                    unique_indexes.append({"name": name, "origin": origin})

                def _index_cols(index_name: str) -> list[str]:
                    info = conn.execute(
                        text("PRAGMA index_info('" + str(index_name).replace("'", "''") + "')")
                    ).fetchall()
                    cols = []
                    for r in info or []:
                        # r: (seqno, cid, name)
                        if len(r) >= 3 and r[2]:
                            cols.append(str(r[2]))
                    return cols

                desired = ["case_file_id", "module", "title", "precondition", "steps", "expected"]
                desired_set = set(desired)
                has_desired = False
                for idx in unique_indexes:
                    cols = _index_cols(idx["name"])
                    if set(cols) == desired_set:
                        has_desired = True
                        break

                cols_meta = {c["name"]: c for c in insp.get_columns("case_items")}
                pre_nullable = bool(cols_meta.get("precondition", {}).get("nullable", True))
                steps_nullable = bool(cols_meta.get("steps", {}).get("nullable", True))
                need_rebuild = (not has_desired) or pre_nullable or steps_nullable

                if need_rebuild:
                    cols = set([c["name"] for c in insp.get_columns("case_items")])
                    if "precondition" not in cols:
                        conn.execute(
                            text(
                                "ALTER TABLE case_items ADD COLUMN precondition TEXT NOT NULL DEFAULT ''"
                            )
                        )
                        cols.add("precondition")
                    if "steps" not in cols:
                        conn.execute(
                            text("ALTER TABLE case_items ADD COLUMN steps TEXT NOT NULL DEFAULT ''")
                        )
                        cols.add("steps")
                    if "expected" not in cols:
                        conn.execute(
                            text("ALTER TABLE case_items ADD COLUMN expected TEXT NOT NULL DEFAULT ''")
                        )
                        cols.add("expected")

                    conn.execute(text("PRAGMA foreign_keys=OFF"))
                    conn.execute(text("ALTER TABLE case_items RENAME TO case_items_old"))
                    conn.execute(
                        text(
                            """
                            CREATE TABLE case_items (
                              id INTEGER NOT NULL PRIMARY KEY,
                              case_file_id INTEGER NOT NULL,
                              module VARCHAR(255) NOT NULL,
                              title VARCHAR(255) NOT NULL,
                              priority VARCHAR(32),
                              precondition TEXT NOT NULL DEFAULT '',
                              steps TEXT NOT NULL DEFAULT '',
                              expected TEXT NOT NULL DEFAULT '',
                              remark TEXT,
                              created_by INTEGER,
                              updated_by INTEGER,
                              created_at DATETIME NOT NULL,
                              updated_at DATETIME NOT NULL,
                              CONSTRAINT uq_case_item_key UNIQUE (case_file_id, module, title, precondition, steps, expected),
                              FOREIGN KEY(case_file_id) REFERENCES case_files (id) ON DELETE CASCADE,
                              FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL,
                              FOREIGN KEY(updated_by) REFERENCES users (id) ON DELETE SET NULL
                            )
                            """
                        )
                    )

                    target_cols = [
                        "id",
                        "case_file_id",
                        "module",
                        "title",
                        "priority",
                        "precondition",
                        "steps",
                        "expected",
                        "remark",
                        "created_by",
                        "updated_by",
                        "created_at",
                        "updated_at",
                    ]
                    select_parts = []
                    for c in target_cols:
                        if c not in cols:
                            if c in ("precondition", "steps", "expected"):
                                select_parts.append("'' AS " + c)
                            elif c in ("created_at", "updated_at"):
                                select_parts.append("datetime('now') AS " + c)
                            else:
                                select_parts.append("NULL AS " + c)
                            continue

                        if c in ("precondition", "steps", "expected"):
                            select_parts.append("COALESCE(" + c + ", '') AS " + c)
                        else:
                            select_parts.append(c)

                    conn.execute(
                        text(
                            "INSERT INTO case_items (" + ", ".join(target_cols) + ")\n"
                            "SELECT " + ", ".join(select_parts) + " FROM case_items_old"
                        )
                    )
                    conn.execute(text("DROP TABLE case_items_old"))
                    conn.execute(
                        text(
                            "CREATE INDEX IF NOT EXISTS ix_case_items_case_file_id ON case_items(case_file_id)"
                        )
                    )
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_case_items_id ON case_items(id)"))
                    conn.execute(text("PRAGMA foreign_keys=ON"))
            mark_applied(7)

        # v8: 早期版本将“执行页删除/关闭”实现为 exec_set.status=archived（软删除）。
        # 当前口径为“删除就是删除”，因此将历史 archived 执行集物理删除（级联删除 exec_cases/历史）。
        if not _is_applied(conn, 8):
            if "exec_sets" in tables:
                cols = set([c["name"] for c in insp.get_columns("exec_sets")])
                if "status" in cols:
                    conn.execute(text("DELETE FROM exec_sets WHERE status = 'archived'"))
            mark_applied(8)

        # v9: 执行集记录用例库变更基线与最近一次 diff（用于执行页刷新同步与变更提示）。
        if not _is_applied(conn, 9):
            if "exec_sets" in tables:
                cols = set([c["name"] for c in insp.get_columns("exec_sets")])
                if "case_file_base_updated_at" not in cols:
                    conn.execute(
                        text("ALTER TABLE exec_sets ADD COLUMN case_file_base_updated_at DATETIME")
                    )
                if "case_file_last_diff_at" not in cols:
                    conn.execute(
                        text("ALTER TABLE exec_sets ADD COLUMN case_file_last_diff_at DATETIME")
                    )
                if "case_file_last_diff_json" not in cols:
                    conn.execute(text("ALTER TABLE exec_sets ADD COLUMN case_file_last_diff_json TEXT"))
                if "case_file_last_diff_shown_at" not in cols:
                    conn.execute(
                        text("ALTER TABLE exec_sets ADD COLUMN case_file_last_diff_shown_at DATETIME")
                    )
            mark_applied(9)

        # v10: 记录执行集最近一次同步到用例库的版本（避免仅执行页编辑触发误 diff）。
        if not _is_applied(conn, 10):
            if "exec_sets" in tables:
                cols = set([c["name"] for c in insp.get_columns("exec_sets")])
                if "case_file_last_synced_at" not in cols:
                    conn.execute(
                        text("ALTER TABLE exec_sets ADD COLUMN case_file_last_synced_at DATETIME")
                    )
            mark_applied(10)

        # v11: exec_cases 记录 case_item_source_id，避免 case_item 删除导致 FK 置空后无法判断 deleted diff。
        if not _is_applied(conn, 11):
            if "exec_cases" in tables:
                cols = set([c["name"] for c in insp.get_columns("exec_cases")])
                if "case_item_source_id" not in cols:
                    conn.execute(text("ALTER TABLE exec_cases ADD COLUMN case_item_source_id INTEGER"))
                # 回填历史数据：默认与 case_item_id 一致。
                conn.execute(
                    text(
                        "UPDATE exec_cases SET case_item_source_id = case_item_id "
                        "WHERE case_item_source_id IS NULL AND case_item_id IS NOT NULL"
                    )
                )
            mark_applied(11)

        # v12: exec_sets 增加 diff 历史（记录执行期间用例库累计变更，最新在前）。
        if not _is_applied(conn, 12):
            if "exec_sets" in tables:
                cols = set([c["name"] for c in insp.get_columns("exec_sets")])
                if "case_file_diff_history_json" not in cols:
                    conn.execute(text("ALTER TABLE exec_sets ADD COLUMN case_file_diff_history_json TEXT"))
            mark_applied(12)

        # v13: case_files 增加 updated_by（用于执行页 diff 展示“操作人”）。
        if not _is_applied(conn, 13):
            if "case_files" in tables:
                cols = set([c["name"] for c in insp.get_columns("case_files")])
                if "updated_by" not in cols:
                    conn.execute(text("ALTER TABLE case_files ADD COLUMN updated_by INTEGER"))
                # 回填历史数据（兜底为 importer_id）
                conn.execute(
                    text(
                        "UPDATE case_files SET updated_by = importer_id "
                        "WHERE updated_by IS NULL AND importer_id IS NOT NULL"
                    )
                )
            mark_applied(13)

        # v14: 用例库改动历史（导入/覆盖导入/增删改/整份删除）永久留存。
        if not _is_applied(conn, 14):
            if "case_library_change_events" not in tables:
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS case_library_change_events (
                          id INTEGER PRIMARY KEY,
                          project_id INTEGER NOT NULL,
                          version_id INTEGER,
                          file_name_clean VARCHAR(255) NOT NULL,
                          case_file_id INTEGER,
                          case_item_id INTEGER,
                          kind VARCHAR(32) NOT NULL,
                          operator_id INTEGER,
                          operator_name VARCHAR(64),
                          old_json TEXT,
                          new_json TEXT,
                          meta_json TEXT,
                          created_at DATETIME NOT NULL
                        )
                        """
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_case_lib_change_proj_file_time "
                        "ON case_library_change_events(project_id, file_name_clean, created_at)"
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_case_lib_change_project_time "
                        "ON case_library_change_events(project_id, created_at)"
                    )
                )
            mark_applied(14)

        # v15: exec_sets 增加归档信息（归档人/归档时间/归档原因）。
        if not _is_applied(conn, 15):
            if "exec_sets" in tables:
                cols = set([c["name"] for c in insp.get_columns("exec_sets")])
                if "archived_by" not in cols:
                    conn.execute(text("ALTER TABLE exec_sets ADD COLUMN archived_by INTEGER"))
                if "archived_at" not in cols:
                    conn.execute(text("ALTER TABLE exec_sets ADD COLUMN archived_at DATETIME"))
                if "archived_reason" not in cols:
                    conn.execute(text("ALTER TABLE exec_sets ADD COLUMN archived_reason TEXT"))
                # 回填：历史 archived 执行集若无 archived_at，则默认使用 updated_at 兜底。
                if "status" in cols and "updated_at" in cols:
                    conn.execute(
                        text(
                            "UPDATE exec_sets SET archived_at = COALESCE(updated_at, datetime('now')) "
                            "WHERE status = 'archived' AND archived_at IS NULL"
                        )
                    )
            mark_applied(15)

        # v16: 用例文件同名约束调整为“项目+版本级”（允许跨版本同名）。
        # 仍使用唯一索引实现；若历史数据异常导致重复，则跳过创建以避免启动失败。
        if not _is_applied(conn, 16):
            if "case_files" in tables:
                # 删除旧索引（项目级同名）
                idx_rows = conn.execute(text("PRAGMA index_list('case_files')")).fetchall()
                for row in idx_rows or []:
                    name = row[1] if len(row) > 1 else None
                    if not name:
                        continue
                    if name == "uq_case_file_name_project":
                        conn.execute(text("DROP INDEX IF EXISTS uq_case_file_name_project"))

                dup = conn.execute(
                    text(
                        """
                        SELECT project_id, version_id, file_name_clean, COUNT(*) AS cnt
                        FROM case_files
                        GROUP BY project_id, version_id, file_name_clean
                        HAVING cnt > 1
                        LIMIT 1
                        """
                    )
                ).fetchone()
                if not dup:
                    conn.execute(
                        text(
                            "CREATE UNIQUE INDEX IF NOT EXISTS uq_case_file_name_project_version "
                            "ON case_files(project_id, version_id, file_name_clean)"
                    )
                )
            mark_applied(16)

        # v17: 用例文件同名约束恢复为“项目级”（同一项目下跨版本不允许同名）。
        # 仍使用唯一索引实现；若历史数据异常导致重复，则跳过创建以避免启动失败。
        if not _is_applied(conn, 17):
            if "case_files" in tables:
                # 删除旧索引（项目+版本级同名）
                idx_rows = conn.execute(text("PRAGMA index_list('case_files')")).fetchall()
                for row in idx_rows or []:
                    name = row[1] if len(row) > 1 else None
                    if not name:
                        continue
                    if name == "uq_case_file_name_project_version":
                        conn.execute(
                            text("DROP INDEX IF EXISTS uq_case_file_name_project_version")
                        )

                dup = conn.execute(
                    text(
                        """
                        SELECT project_id, file_name_clean, COUNT(*) AS cnt
                        FROM case_files
                        GROUP BY project_id, file_name_clean
                        HAVING cnt > 1
                        LIMIT 1
                        """
                    )
                ).fetchone()
                if not dup:
                    conn.execute(
                        text(
                            "CREATE UNIQUE INDEX IF NOT EXISTS uq_case_file_name_project "
                            "ON case_files(project_id, file_name_clean)"
                        )
                    )
            mark_applied(17)

        # v18: case_items 增加 order_no，用于保持用例库插入顺序。
        if not _is_applied(conn, 18):
            if "case_items" in tables:
                cols = set([c["name"] for c in insp.get_columns("case_items")])
                if "order_no" not in cols:
                    conn.execute(
                        text("ALTER TABLE case_items ADD COLUMN order_no INTEGER NOT NULL DEFAULT 0")
                    )
                    conn.execute(
                        text(
                            "CREATE INDEX IF NOT EXISTS ix_case_items_case_file_order "
                            "ON case_items(case_file_id, order_no)"
                        )
                    )
                count_row = conn.execute(
                    text("SELECT COUNT(1) FROM case_items WHERE order_no > 0")
                ).fetchone()
                has_order = bool(count_row and count_row[0])
                if not has_order:
                    rows = conn.execute(
                        text(
                            "SELECT id, case_file_id FROM case_items "
                            "ORDER BY case_file_id ASC, id ASC"
                        )
                    ).fetchall()
                    current_file = None
                    order_idx = 0
                    for row in rows or []:
                        case_file_id = row[1] if len(row) > 1 else None
                        if case_file_id != current_file:
                            current_file = case_file_id
                            order_idx = 0
                        order_idx += 1
                        conn.execute(
                            text("UPDATE case_items SET order_no = :order_no WHERE id = :id"),
                            {"order_no": order_idx, "id": row[0]},
                        )
            mark_applied(18)

        # v19: exec_sets 增加归档恢复关联与重归档次数统计。
        if not _is_applied(conn, 19):
            if "exec_sets" in tables:
                cols = set([c["name"] for c in insp.get_columns("exec_sets")])
                if "restored_from_id" not in cols:
                    conn.execute(text("ALTER TABLE exec_sets ADD COLUMN restored_from_id INTEGER"))
                    conn.execute(
                        text(
                            "CREATE INDEX IF NOT EXISTS ix_exec_sets_restored_from_id "
                            "ON exec_sets(restored_from_id)"
                        )
                    )
                if "rearchive_count" not in cols:
                    conn.execute(
                        text(
                            "ALTER TABLE exec_sets ADD COLUMN rearchive_count INTEGER NOT NULL DEFAULT 0"
                        )
                    )
                    conn.execute(
                        text(
                            "UPDATE exec_sets SET rearchive_count = 0 WHERE rearchive_count IS NULL"
                        )
                    )
            mark_applied(19)

        # v20: 易漏用例模块与条目表。
        if not _is_applied(conn, 20):
            if "missing_modules" not in tables:
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS missing_modules (
                          id INTEGER PRIMARY KEY,
                          project_id INTEGER NOT NULL,
                          name VARCHAR(255) NOT NULL,
                          created_by INTEGER,
                          updated_by INTEGER,
                          created_at DATETIME NOT NULL DEFAULT (datetime('now')),
                          updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
                          FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE,
                          FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL,
                          FOREIGN KEY(updated_by) REFERENCES users (id) ON DELETE SET NULL
                        )
                        """
                    )
                )
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS uq_missing_module_name_project "
                        "ON missing_modules(project_id, name)"
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_missing_modules_project "
                        "ON missing_modules(project_id)"
                    )
                )
            if "missing_case_items" not in tables:
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS missing_case_items (
                          id INTEGER PRIMARY KEY,
                          module_id INTEGER NOT NULL,
                          precondition TEXT NOT NULL DEFAULT '',
                          steps TEXT NOT NULL DEFAULT '',
                          expected TEXT NOT NULL DEFAULT '',
                          remark TEXT,
                          order_no INTEGER NOT NULL DEFAULT 0,
                          created_by INTEGER,
                          updated_by INTEGER,
                          created_at DATETIME NOT NULL DEFAULT (datetime('now')),
                          updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
                          FOREIGN KEY(module_id) REFERENCES missing_modules (id) ON DELETE CASCADE,
                          FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL,
                          FOREIGN KEY(updated_by) REFERENCES users (id) ON DELETE SET NULL
                        )
                        """
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_missing_case_items_module_id "
                        "ON missing_case_items(module_id)"
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_missing_case_items_module_order "
                        "ON missing_case_items(module_id, order_no)"
                    )
                )
            mark_applied(20)

        # v21: 易漏用例条目补充标题与优先级字段。
        if not _is_applied(conn, 21):
            if "missing_case_items" in tables:
                cols = set([c["name"] for c in insp.get_columns("missing_case_items")])
                if "title" not in cols:
                    conn.execute(
                        text(
                            "ALTER TABLE missing_case_items "
                            "ADD COLUMN title VARCHAR(255) NOT NULL DEFAULT ''"
                        )
                    )
                if "priority" not in cols:
                    conn.execute(text("ALTER TABLE missing_case_items ADD COLUMN priority VARCHAR(32)"))
                    conn.execute(
                        text(
                            "UPDATE missing_case_items SET priority = NULL "
                            "WHERE priority IS NULL"
                        )
                    )
            mark_applied(21)

        # v22: 易漏用例类型与条目类型字段。
        if not _is_applied(conn, 22):
            if "missing_case_types" not in tables:
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS missing_case_types (
                          id INTEGER PRIMARY KEY,
                          project_id INTEGER NOT NULL,
                          name VARCHAR(255) NOT NULL,
                          created_by INTEGER,
                          updated_by INTEGER,
                          created_at DATETIME NOT NULL DEFAULT (datetime('now')),
                          updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
                          FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE,
                          FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL,
                          FOREIGN KEY(updated_by) REFERENCES users (id) ON DELETE SET NULL
                        )
                        """
                    )
                )
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS uq_missing_case_type_name_project "
                        "ON missing_case_types(project_id, name)"
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_missing_case_types_project "
                        "ON missing_case_types(project_id)"
                    )
                )
            if "missing_case_items" in tables:
                cols = set([c["name"] for c in insp.get_columns("missing_case_items")])
                if "type_id" not in cols:
                    conn.execute(
                        text("ALTER TABLE missing_case_items ADD COLUMN type_id INTEGER")
                    )
                    conn.execute(
                        text(
                            "CREATE INDEX IF NOT EXISTS ix_missing_case_items_type_id "
                            "ON missing_case_items(type_id)"
                        )
                    )
            mark_applied(22)

        # v23: 修复历史库缺少易漏用例类型字段（type_id/标题/优先级）。
        if not _is_applied(conn, 23):
            insp_v23 = inspect(conn)
            tables_v23 = set(insp_v23.get_table_names())

            if "missing_case_types" not in tables_v23:
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS missing_case_types (
                          id INTEGER PRIMARY KEY,
                          project_id INTEGER NOT NULL,
                          name VARCHAR(255) NOT NULL,
                          created_by INTEGER,
                          updated_by INTEGER,
                          created_at DATETIME NOT NULL DEFAULT (datetime('now')),
                          updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
                          FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE,
                          FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL,
                          FOREIGN KEY(updated_by) REFERENCES users (id) ON DELETE SET NULL
                        )
                        """
                    )
                )
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS uq_missing_case_type_name_project "
                        "ON missing_case_types(project_id, name)"
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_missing_case_types_project "
                        "ON missing_case_types(project_id)"
                    )
                )

            if "missing_case_items" not in tables_v23:
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS missing_case_items (
                          id INTEGER PRIMARY KEY,
                          module_id INTEGER NOT NULL,
                          title VARCHAR(255) NOT NULL DEFAULT '',
                          priority VARCHAR(32),
                          precondition TEXT NOT NULL DEFAULT '',
                          steps TEXT NOT NULL DEFAULT '',
                          expected TEXT NOT NULL DEFAULT '',
                          remark TEXT,
                          order_no INTEGER NOT NULL DEFAULT 0,
                          type_id INTEGER,
                          created_by INTEGER,
                          updated_by INTEGER,
                          created_at DATETIME NOT NULL DEFAULT (datetime('now')),
                          updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
                          FOREIGN KEY(module_id) REFERENCES missing_modules (id) ON DELETE CASCADE,
                          FOREIGN KEY(type_id) REFERENCES missing_case_types (id) ON DELETE SET NULL,
                          FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL,
                          FOREIGN KEY(updated_by) REFERENCES users (id) ON DELETE SET NULL
                        )
                        """
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_missing_case_items_module_id "
                        "ON missing_case_items(module_id)"
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_missing_case_items_module_order "
                        "ON missing_case_items(module_id, order_no)"
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_missing_case_items_type_id "
                        "ON missing_case_items(type_id)"
                    )
                )
            else:
                cols = set([c["name"] for c in insp_v23.get_columns("missing_case_items")])
                if "title" not in cols:
                    conn.execute(
                        text(
                            "ALTER TABLE missing_case_items "
                            "ADD COLUMN title VARCHAR(255) NOT NULL DEFAULT ''"
                        )
                    )
                if "priority" not in cols:
                    conn.execute(text("ALTER TABLE missing_case_items ADD COLUMN priority VARCHAR(32)"))
                    conn.execute(
                        text(
                            "UPDATE missing_case_items SET priority = NULL "
                            "WHERE priority IS NULL"
                        )
                    )
                if "type_id" not in cols:
                    conn.execute(text("ALTER TABLE missing_case_items ADD COLUMN type_id INTEGER"))
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_missing_case_items_type_id "
                        "ON missing_case_items(type_id)"
                    )
                )
            mark_applied(23)
