"""
本地覆盖配置示例（请复制为 backend/config_local.py 使用；该文件已在 .gitignore 中忽略）。

优先级：
1) backend/config_local.py（本地覆盖）
2) 环境变量（如 ADMIN_USER / ADMIN_PASS / APP_DB_FILE）
3) backend/config.py 内置默认值（仅用于本地开发/兼容）
"""

# 方式一：用 OVERRIDES 字典统一覆盖（推荐）
OVERRIDES = {
    # "db_file": "app.db",
    # "default_admin_username": "admin",
    # "default_admin_password": "please_change_me",
    # "default_user_password": "12345678",
}

# 方式二：也可直接定义同名变量（与 OVERRIDES 合并，后者优先）
# default_admin_password = "please_change_me"

