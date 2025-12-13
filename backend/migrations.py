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

