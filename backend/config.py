import json
import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
AUTH_CONFIG_PATH = BASE_DIR / "config" / "auth.json"
DEFAULT_TOKEN_TTL_MINUTES = 7 * 24 * 60

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


def _load_json_config(path: Path):
    try:
        if not path.exists():
            return {}
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _parse_positive_number(value):
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    if not num or num <= 0:
        return None
    return num


def _resolve_token_ttl_minutes():
    config = _load_json_config(AUTH_CONFIG_PATH)
    minutes = _parse_positive_number(config.get("token_ttl_minutes"))
    if minutes:
        return int(minutes)
    days = _parse_positive_number(config.get("token_ttl_days"))
    if days:
        ttl = int(days * 24 * 60)
        if ttl > 0:
            return ttl
    return DEFAULT_TOKEN_TTL_MINUTES


class Settings:
    app_name = "Test Assistant Platform API"
    db_file = os.getenv("APP_DB_FILE", "app.db")
    default_admin_username = os.getenv("ADMIN_USER", "admin")
    # 兼容现有文档/测试：未设置时使用默认值；生产环境建议通过环境变量或 config_local 覆盖。
    default_admin_password = os.getenv("ADMIN_PASS", "chillytest_admin")
    default_user_password = os.getenv("DEFAULT_USER_PASS", "12345678")
    token_ttl_minutes = None

    @property
    def sqlite_url(self) -> str:
        return f"sqlite:///{DATA_DIR / self.db_file}"


settings = Settings()

# 应用本地覆盖（若存在）
_overrides = _load_local_overrides()
for _key, _value in _overrides.items():
    if hasattr(settings, _key):
        setattr(settings, _key, _value)

settings.token_ttl_minutes = _resolve_token_ttl_minutes()
