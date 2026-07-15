# UI 自动化测试（Playwright）

## 依赖安装
- Node 14+、Python 3 可用。
- 首次执行前安装依赖与浏览器：
  - `npm install`
  - `npm run test:ui:install`（安装 Playwright 浏览器与依赖）

## 运行方式
- XMind 页签请求调度回归（不启动浏览器）：
  - `node tests/node/xmind_request_scheduler_core.test.js`
- XMind 去重批次纯函数回归（不启动浏览器）：
  - `node tests/node/xmind_dedupe_batch_core.test.js`
- XMind 尾部慢请求动态阈值回归（不启动浏览器）：
  - `node tests/node/xmind_generation_timing_core.test.js`
- XMind 画布装饰与追加高亮调度策略回归（不启动浏览器）：
  - `node tests/node/xmind_render_policy_core.test.js`
- XMind 需求覆盖用例详情悬浮层回归（不启动浏览器）：
  - `node tests/node/xmind_coverage_case_tooltip_core.test.js`
- XMind 跨页面任务恢复守卫回归（不启动浏览器）：
  - `node tests/node/xmind_task_resume_guard.test.js`
- 启动静态服务器并跑测试（配置已在 `tests/playwright.config.js` 内自动启动 `python3 -m http.server 8080`）：
  - `npm run test:ui`
- 若需可视化调试：
  - `npm run test:ui:headed`
- 可用环境变量 `PLAYWRIGHT_BASE_URL` 覆盖默认地址（默认 `http://localhost:8080`）。
- 后端 API 测试（需先启动 FastAPI 服务，默认 `http://127.0.0.1:8080`）：
  - `npx playwright test --config tests/api/playwright.api.config.js tests/api/auth_change_password.spec.js`
  - 可用环境变量：`API_BASE_URL`、`ADMIN_USER`、`ADMIN_PASS`。

## 覆盖范围
- 冒烟用例：页面可加载、主导航可见、切换“功能工作流”“用例执行”标签后对应区域可见（`tests/ui/smoke.spec.js`）。
- 工作流必跑：原始需求上传、导入导出默认状态、顶部步骤与用例执行拖拽占位、自动流程按钮状态等（`tests/ui/workflow.spec.js`）。
- 文件/布局：校验评审/清洗/对比调试文件导入导出、各标签布局与按钮状态、流程步骤联动（`tests/ui/files_layout.spec.js`）。
- 执行视图：临时执行用例导入导出、版本/需求盒子拖拽、专注区、进度总览与配置快照恢复（`tests/ui/tempexec_drag.spec.js`）。
- API：管理员改密往返校验（`tests/api/auth_change_password.spec.js`，默认使用 admin/chillytest_admin，改为临时密码后再改回）。

## 说明
- 所有测试用 ES2019 兼容语法，位于 `tests/ui/`。如需扩展用例，保持选择器与业务文案同步。  
- 测试中已阻断非本地请求，避免触发真实模型/外部接口（`page.route` 仅放行 localhost/127.0.0.1/file）。新增用例需保持此策略。  
- 每次重构后先审视现有用例覆盖是否足够，不足则补充；满足则直接运行。  
- 如本地已有服务器运行，配置会自动复用（`reuseExistingServer: true`）。  
