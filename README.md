# Test Assistant Platform

## 简介

面向测试团队的用例生成、管理与执行平台。AI 能力保留 XMind 用例生成、用例库内生成、执行页内生成、用例筛选和易漏用例提醒；旧版一键执行、功能流程和普通模块生成已下线。

## 页面与能力

- `index.html`：轻量入口，保留查询参数并跳转到 XMind 用例生成页。
- `ai-workflow.html`：XMind 用例生成唯一独立页面，支持多工作区、需求/已有用例导入、生成与恢复、去重、覆盖分析、导出、新建入库和追加入库。
- `ai-tools.html`：模型管理与四类保留能力的模型指派。
- `case-library.html`：用例库、归档，以及库内生成并追加。
- `case-exec.html`：用例执行、执行总览，以及执行页内生成并追加。
- `admin.html`：项目、人员和操作记录管理。
- `settings.html`：执行列、生成阈值、知识库和其他保留配置。

## 目录结构

- `config/`：默认配置、路由和 DOM 配置。
- `scripts/base/`：状态、工具和通用抽屉能力。
- `scripts/core/retainedGenerationRuntime.js`：装配三类保留生成任务管理器和 XMind 上下文。
- `scripts/core/casesGenCore.js`：XMind 暂时复用的设置、快照、模块提交和通用入库兼容核心，不提供独立页面入口。
- `scripts/core/xmind*.js`：XMind 生成、恢复、调度、去重、覆盖和渲染规则。
- `scripts/modules/`：页面模块与编排。
- `services/`：模型、存储和后端 API 请求封装。
- `backend/`：FastAPI 与 SQLite 后端。
- `tests/`：Node、Playwright UI 和 API 回归。

## 开发与验证

- 静态预览：`python3 -m http.server 8080`，访问 `http://127.0.0.1:8080/index.html`。
- 一键启动：macOS/Linux 使用 `./start.sh`，Windows 使用 `start.bat`。
- 语法检查：`node --check scripts/base/state.js scripts/base/utils.js scripts/core/retainedGenerationRuntime.js scripts/modules/app.js scripts/modules/xmindCasegen.js scripts/modules/bootstrap.js`。
- Node 回归：执行 `tests/node/` 中与 XMind、用例筛选和执行复用有关的测试。
- UI 回归：`npm run test:ui`；定向运行可在命令后追加测试文件。
- API 回归：使用测试数据库启动后端，再运行 `npm run test:api`。任何测试或造数都不得使用正式数据库。

测试后端示例：

```bash
APP_DB_FILE=apitest.db uvicorn backend.main:app --host 127.0.0.1 --port 8080
```

## 兼容策略

- 历史 `auto`、`clean` 和 `xmind-casegen` 页签地址统一回退到 `casesgen`。
- 旧设置和旧模型指派键可被读取，但不再展示，也不会在保存保留配置时重新写回。
- 旧工作流快照中的废弃字段会被忽略；现有 XMind 工作区和任务恢复数据继续保留。
- 后端用例新增、追加入库、执行集追加和配置存储接口保持兼容。

## 约定

- JavaScript 兼容 ES2019，不使用可选链、空值合并或逻辑赋值。
- HTML/CSS 使用 2 空格缩进，JavaScript 语句以分号结尾。
- 外部运行时依赖必须本地 vendoring，不依赖 CDN。

## Codex MCP 服务

团队成员可用本机 Codex App/CLI 连接现有服务器的 `/mcp`，以个人平台身份查询和维护用例、管理执行记录、读取进度与历史、检索项目知识库。提供 30 个工具和用例规范资源，无需平台配置成员的模型 API Key。支持为活动复用执行集新增预设子项、设置获取/解锁方式和快速执行适用性规则。管理员可分页查询操作记录摘要、按需读取详情及获取计数汇总，默认最近 7 天，避免全量日志下载。

在“设置 → AI 与知识库 → Codex MCP 接入”生成个人凭据。知识库由管理员绑定项目，网页和 MCP 共用实时权限检查；历史知识库地址需先完成项目登记。接入、HTTPS 部署和迁移细节见 [MCP_GUIDE.md](MCP_GUIDE.md)。

专项测试（自动使用临时测试数据库）：

```sh
.venv/bin/python -m unittest discover -s tests/python -p test_mcp_service.py -v
```
