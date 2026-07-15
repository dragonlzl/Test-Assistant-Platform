# 文件概览

记录当前目录下关键文件的用途，便于后续清理或核查。

## 被入口引用的必需文件
- `index.html`：主页面入口。
- `login.html`：登录入口页面。
- `ai-workflow.html`：AI 工作流页（导入/评审/清洗/对比/拆分/用例生成/自动流程）。
- `ai-tools.html`：AI 工具页（功能指派/模型管理）。
- `case-exec.html`：用例执行页（执行视图/执行总览）。
- `case-library.html`：用例资产页（用例库/用例归档）。
- `admin.html`：管理页（项目/人员/操作记录）。
- `settings.html`：设置页（飞书/执行列/其他配置）。
- `style.css`：页面样式。
- `config/constants.js`：全局默认配置（提示词、键名、默认列/设置等），需在其他脚本前加载。
- `scripts/vendor/jszip.min.js`：XMind/压缩依赖。
- `scripts/base/state.js`：状态占位与初始化。
- `scripts/base/utils.js`：通用工具（下载、状态提示等）。
- `scripts/core/*.js`：拆分/清洗/对比/生成/执行等核心能力（`splitCore`、`cleanCore`、`compareCore`、`reviewCore`、`casesCore`、`autoCore`、`xmindCore`、`xmindRequestSchedulerCore`、`xmindGenerationPayloadCore`、`xmindGenerationTimingCore`、`xmindDedupeBatchCore`、`tempexecCore`、`casesGenCore`、`debugCore`、`requirementCore`）；其中 `xmindRequestSchedulerCore` 维护按 XMind 页签隔离的真实模型请求队列与并发槽，其余规则优先保持纯函数，由 `app.js` 或对应功能模块通过依赖注入使用。
- `scripts/handlers/*.js`：事件与布局交互（功能指派、拆分、清洗、用例生成、布局等）。
- `scripts/modules/*.js`：模块入口与编排（`app.js` 主逻辑、`assign.js` 功能指派、`review.js` 评审、`clean.js` 清洗、`compare.js` 覆盖对比、`split.js` 拆分、`casesgen.js` 用例生成、`tempexec.js` 执行视图、`auto.js` 一键执行、`upload.js` 上传、`settings.js` 设置、`models.js` 模型管理、`casegenProgress.js` 进度面板、`bootstrap.js` 启动）。
- `services/storage.js`、`services/modelClient.js`、`services/apiClient.js`：存储/模型/后端 API 请求封装。
- `FEATURE_DEV_GUIDE.md`：新增功能开发必读规范，包含复用要求、测试/通知流程、记录与回报清单。
- `FEATURE_LOG.md`：新增功能需求登记文档，记录功能描述/操作方式/效果/新增内容及后续变更。
- `backend/`：FastAPI + SQLite 后端（`main.py` 挂载静态文件与 API、`models.py` 数据表、`routers/` 路由、`config.py` 配置、`db.py` 引擎/Session、`initial_data.py` 默认管理员初始化）。
- `requirements.txt`：后端依赖（FastAPI/SQLAlchemy/uvicorn/passlib 等）。

## 未被入口引用（可选/备份/素材）
- `default_prompts_2025-11-25-07-16-38.json`：默认提示词导出示例，可做参考或备份。
- `AGENTS.md`：仓库使用/约定说明。
- `REFACTOR_STEPS.md`：重构备忘。
- `APP_REFACTOR_PLAN.md`：app.js 精简计划。
- `package.json`：占位配置（无脚本）。
- `scripts/legacy/wrap.js`、`scripts/legacy/inject.js`：历史/备用脚本，当前页面未加载。
- `帮助例子.png`：示例图片资源。
