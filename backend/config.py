import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)


class Settings:
    app_name = "Test Assistant Platform API"
    db_file = os.getenv("APP_DB_FILE", "app.db")
    sqlite_url = f"sqlite:///{DATA_DIR / db_file}"
    default_admin_username = "admin"
    default_admin_password = "chillytest_admin"
    default_user_password = "12345678"


settings = Settings()
