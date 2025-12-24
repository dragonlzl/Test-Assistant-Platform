# Test Assistant Platform

## 简介
静态前端工具，覆盖需求清洗、拆分、覆盖对比、用例生成与执行全流程。内置“AI一键需求&用例评审”串联评审→清洗→拆分→覆盖对比；执行侧支持版本分组、专注区、拖拽、配置快照导入导出、用例执行总览等，全部逻辑在浏览器本地运行。

## 目录结构
- `index.html`：单页入口，按依赖顺序 defer 加载脚本；侧边页签支持刷新后保持上次停留的功能页。
- `style.css`：全局样式。
- `config/constants.js`：默认配置/键名/列显示等常量。
- `scripts/`
  - `vendor/`：第三方依赖（`jszip.min.js`）。
  - `base/`：基础层（`state.js`、`utils.js`）。
  - `core/`：纯核心逻辑（拆分/清洗/对比/生成/执行等 *Core.js）。
  - `handlers/`：事件与布局交互（*Handlers.js）。
  - `modules/`：模块入口与编排（`app.js`、`auto.js`、`tempexec.js` 等）。
  - `legacy/`：历史保留脚本（`wrap.js`、`inject.js`）。
- `services/`：模型请求与存储封装。
- `tests/`：Playwright UI 用例与配置。
- 资源/素材：`帮助例子.png`、`debug_*.txt`、`casegen_*.txt` 等。

## 开发与验证
- 本地预览：`python3 -m http.server 8090` 后访问 `http://127.0.0.1:8090/index.html`。
- 语法检查：`node --check scripts/base/state.js scripts/base/utils.js scripts/modules/app.js scripts/modules/bootstrap.js`。
- UI 自动化：`npm run test:ui`（如遇拖拽类偶发失败，可使用 `npm run test:ui -- --workers=1` 单线程重跑）。核心覆盖：模型/指派提示、工作流导入、执行抽屉与总览、页签持久化等。
- 权限申请：如需请求提权/联网等人工确认，发起请求前先运行 `python3 notify_feishu.py` 向群里提醒（需联网）。
- 后端 API（FastAPI + SQLite）：`pip install -r requirements.txt` 后运行 `uvicorn backend.main:app --reload --host 0.0.0.0 --port 8080`，访问 `http://127.0.0.1:8080/index.html`；页面加载后需使用后台账号登录（默认管理员 `admin` / `chillytest_admin`）。常用环境变量：`APP_DB_FILE`（默认 `app.db`）、`ADMIN_USER`、`ADMIN_PASS`。如需本地私密覆盖，可复制 `backend/config_local.example.py` 为 `backend/config_local.py`（已加入 `.gitignore`）。  

## 约定
- JS 兼容 ES2019，禁用可选链/空值合并等新语法；函数/DOM ID 使用 lowerCamelCase。
- HTML/CSS 2 空格缩进，语句以分号结尾。
- 新增外部依赖需本地 vendoring，避免直接依赖 CDN/npm 运行时下载。

## 工具脚本
- 飞书通知：`notify_feishu.py` 发送群机器人消息。webhook 获取顺序为命令行参数 → 环境变量 `FEISHU_WEBHOOK` → 仓库根目录的 `feishu_config.json`。`feishu_config.json` 已加入 `.gitignore`，需自行创建并填入真实 webhook，例如：

```json
{
  "webhook": "https://open.feishu.cn/open-apis/bot/v2/hook/REPLACE_WITH_YOUR_WEBHOOK"
}
```
