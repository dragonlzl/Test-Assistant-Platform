# 文件概览

## 页面入口

- `index.html`：轻量跳转壳，默认进入 XMind 用例生成。
- `login.html`：登录入口。
- `ai-workflow.html`：XMind 用例生成唯一独立页面。
- `ai-tools.html`：功能指派和模型管理。
- `case-exec.html`：用例执行和执行总览。
- `case-library.html`：用例库和用例归档。
- `admin.html`：项目、人员和操作记录管理。
- `settings.html`：保留配置。

## 生成能力

- `scripts/core/retainedGenerationRuntime.js`：装配 XMind、用例库/执行页内生成和易漏用例提醒任务管理器。
- `scripts/core/casesGenCore.js`：XMind 兼容核心，保留设置、快照、模块提交和通用新建/追加入库能力。
- `scripts/core/xmind*.js`：XMind 调度、恢复、生成负载、去重、覆盖、导出和渲染规则。
- `scripts/modules/xmindCasegen.js`：XMind 页面交互、工作区状态和生成编排。
- `scripts/modules/casePageAiGenPrep.js`：用例库和执行页内生成准备逻辑。
- `scripts/modules/casegenProgress.js`：XMind 全局进度面板。
- `scripts/modules/models.js`、`scripts/modules/assign.js`：模型管理和四类保留能力指派。

## 其他必需文件

- `config/constants.js`、`config/domConfig.js`：默认配置、路由和 DOM 配置。
- `scripts/base/`：全局状态、工具和通用抽屉。
- `scripts/core/casesCore.js`、`scripts/core/tempexecCore.js`：用例解析和执行核心。
- `scripts/modules/app.js`、`scripts/core/appRuntime.js`：初始化、持久化和页面装配。
- `services/`：模型、存储和后端 API 请求。
- `backend/`：FastAPI、SQLite 数据和接口。
- `tests/`：Node、UI 和 API 测试。

## 已下线文件

一键执行、功能流程、评审、清洗、对比、拆分、旧普通模块生成、调试、通知、页面说明和功能引导的专用 core、handler、module 与测试文件不再被入口引用，并已删除。
