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

        insp = inspect(conn)
        tables = set(insp.get_table_names())

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
            _mark_applied(conn, 1)

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
            _mark_applied(conn, 2)

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
            _mark_applied(conn, 3)

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
            _mark_applied(conn, 4)
