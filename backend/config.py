import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

def _load_local_overrides():
    """
    允许本地通过 backend/config_local.py 覆盖敏感配置（该文件已在 .gitignore 中忽略）。
    约定：
      - 可提供字典 OVERRIDES = {"default_admin_password": "...", ...}
      - 或直接提供同名变量 default_admin_password = "..."
    """
    try:
        from . import config_local  # type: ignore
    except Exception:
        return {}

    overrides = {}
    candidate = getattr(config_local, "OVERRIDES", None)
    if isinstance(candidate, dict):
        overrides.update(candidate)

    for key in (
        "db_file",
        "default_admin_username",
        "default_admin_password",
        "default_user_password",
    ):
        if hasattr(config_local, key):
            overrides[key] = getattr(config_local, key)
    return overrides


class Settings:
    app_name = "Test Assistant Platform API"
    db_file = os.getenv("APP_DB_FILE", "app.db")
    default_admin_username = os.getenv("ADMIN_USER", "admin")
    # 兼容现有文档/测试：未设置时使用默认值；生产环境建议通过环境变量或 config_local 覆盖。
    default_admin_password = os.getenv("ADMIN_PASS", "chillytest_admin")
    default_user_password = os.getenv("DEFAULT_USER_PASS", "12345678")

    @property
    def sqlite_url(self) -> str:
        return f"sqlite:///{DATA_DIR / self.db_file}"


settings = Settings()

# 应用本地覆盖（若存在）
_overrides = _load_local_overrides()
for _key, _value in _overrides.items():
    if hasattr(settings, _key):
        setattr(settings, _key, _value)
