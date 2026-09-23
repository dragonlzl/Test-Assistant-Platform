# Repository Guidelines

## 项目结构与目录说明
- 仓库主体：`index.html`（入口）、`style.css`（样式）；页面脚本集中在 `scripts/` 下：`base/`（`state.js`、`utils.js`）、`core/`（各 *Core.js）、`handlers/`（各 *Handlers.js 与布局交互）、`modules/`（app/页面逻辑）、`vendor/jszip.min.js`、`legacy/`（wrap/inject 备份）。入口按顺序 defer 加载 vendor→config→core→handlers→base→modules→bootstrap，保持与旧版一致。
- 配置/服务：`config/constants.js` 提供默认配置，`services/` 内含存储与模型调用封装。
- 备份片段：`models_block_restore.txt`、`models_module.tmp` 记录拆分前的模型/配置块，便于对照或紧急恢复（不建议直接改写）。
- 资源类文件：`debug_*.txt`、`casegen_*.txt`、`.xmind/.docx` 等是案例或需求素材，不建议直接改写；若需新增资源，请与 `index.html` 同级或放入 `assets/` 并合理命名。

## 构建、开发与测试命令
- `python3 -m http.server 8080`：启动轻量 HTTP 服务并访问 `http://localhost:8080/index.html`，保证文件 API 可用。
- 一键启动（后端 + 静态页）：macOS/Linux 运行 `./start.sh`，Windows 运行 `start.bat`。可用环境变量：`APP_DB_FILE`、`API_HOST`、`API_PORT`、`ADMIN_USER`、`ADMIN_PASS`、`DEFAULT_USER_PASS`、`RELOAD`。
- `node --check scripts/base/state.js scripts/base/utils.js scripts/modules/app.js scripts/modules/bootstrap.js`：快速语法检查，避免旧浏览器报错。
- `node tests/node/reuse_applicability_core.test.js`：验证复用预设获取/解锁方式识别、自动不适用、人工结果保护与恢复规则。
- `python3 -m unittest discover -s tests/python -p test_model_gateway.py`：验证模型网关的非流式连接关闭、SSE 分块读取、仅 packycode 类型启用最小请求、其他类型协议不变（仅使用本地模拟服务，不连接模型供应商或数据库）。
- `python3 -m unittest discover -s tests/python -p 'test_*code*.py'`：验证 Packycode 代理完成判定与重启后禁止重复请求（本地模拟服务、数据库会话 mock）。
- `npm run test:ui -- tests/ui/packycode.spec.js`：验证 Packycode 配置、文本/双图协议和单次/分批生成不自动重试。
- `npm run test:ui -- tests/ui/tempexec_reuse_applicability.spec.js`：验证执行页预设方式选择、批量应用与手工结果接管。
- `API_BASE_URL=http://127.0.0.1:8080 npm run test:api -- tests/api/exec_reuse_applicability.spec.js`：验证适用性批量保存与失败原子性（后端必须使用测试库启动）。
- 数据库（本地）：后端默认使用 `data/app.db`（正式）。任何测试/造数必须使用测试库（如 `data/apitest.db`），启动示例：`APP_DB_FILE=apitest.db uvicorn backend.main:app --reload --host 0.0.0.0 --port 8080`。
- 若需要 GUI 预览，也可使用 `npx serve` 等静态服务器；新增工具务必在此文件补充说明。

## 代码风格与命名约定
- JavaScript 必须兼容 ES2019：禁用可选链、空值合并、逻辑赋值等新语法，统一使用显式判空。
- HTML/CSS 采用 2 空格缩进，JS 语句以分号结尾；DOM ID、函数名使用 lowerCamelCase。
- 复杂函数可在前一行加一句简短中文注释，说明用途；外部库需本地 vendoring，不默认引入 npm。

## 测试指引
- 当前无自动化测试；每次修改需手工走完核心流程，并在 Chrome/Safari 中验证拖拽、剪贴板、文件保存。
- 提交脚本前执行语法检查，必要时记录关键交互的控制台输出或截图。
- 若增补自动化测试（如 Playwright），统一放入 `tests/` 目录并在此文档新增命令说明。

## 提交与合并规范
- Commit message 采用祈使句，总结核心改动，如 “Fix legacy browser syntax errors”、“Add case-generation hints”；若关联任务单，请在尾部追加 `(#123)`。
- Pull Request 需包含：改动摘要、验证步骤（命令输出或界面截图）、潜在风险与跨浏览器注意事项；若引入新资源/配置，写明部署影响。
- 在评审描述中强调是否需要重新下载静态资源或清理浏览器缓存，方便使用者快速复现。

## MCP 与知识库权限验证
- `npm run test:ui -- tests/ui/models_settings.spec.js --grep '功能指派页只展示保留能力并使用最新基础文案'`：验证默认 XMind/用例库提示词包含人类风格、复杂度自检、按独立目标拆分及必要连续操作保留规则。
- `.venv/bin/python -m unittest discover -s tests/python -p test_case_similarity.py -v`：临时测试库验证 MCP 新增相似检查、对比后修改/新增/跳过、令牌与版本校验、权限隔离、并发幂等和混合写入回滚；不调用真实模型。
- `.venv/bin/python -m unittest discover -s tests/python -p test_execution_reuse.py -v`：临时测试库验证 MCP/HTTP 复用子项新增及“AI新增子项”独立标识、解锁方式配置、快速执行、人工结果保护、权限/只读、幂等并发/冲突及整体回滚，并与浏览器规则进行一致性比较（需 Node）。
- `npm run test:ui -- tests/ui/case_library_edit_focus.spec.js tests/ui/tempexec_edit_defer_save.spec.js tests/ui/tempexec_reuse_align.spec.js tests/ui/tempexec_view_empty.spec.js`：验证 AI 操作列空值/多标识、人工编辑后保留、列顺序、复用对齐和执行空态，使用本地 API mock。
- `.venv/bin/python -m unittest discover -s tests/python -p test_operation_query.py -v`：临时测试库验证操作记录筛选、游标快照、大详情分段、SQL 贡献汇总、HTTP/MCP 管理员权限和索引。
- `npm run test:ui -- tests/ui/ops_log.spec.js tests/ui/ops_log_drawer_restore.spec.js tests/ui/ops_log_exec_case_run.spec.js tests/ui/ops_activity.spec.js tests/ui/ops_contribution.spec.js tests/ui/ops_exec_contribution.spec.js --workers=1`：操作记录分页、详情、恢复与统计图回归；需先安装后端依赖到 `.venv`，UI 夹具调用内存 SQLite 查询适配器，不连接正式库。
- `.venv/bin/python -m unittest discover -s tests/python -p test_mcp_service.py -v`：自动创建临时测试库并启动独立后端，覆盖 MCP 握手、人工编写风格上下文、用例字段协议兼容、工具链路、凭据撤销、权限实时变化、知识库跨项目隔离、幂等重试、并发冲突及事务回滚。测试结束自动清理，不使用正式数据库。
- `API_BASE_URL=http://127.0.0.1:8080 npm run test:api -- tests/api/knowledge_base.spec.js`：知识库 API 回归，先以测试库启动；测试会先为来源登记项目授权。
- MCP 地址为 `/mcp`，部署与 Codex App/CLI 接入见 `MCP_GUIDE.md`。个人凭据与项目知识库登记在“设置 → AI 与知识库”管理。
- 公开静态文件采用白名单。新增网页资源目录时需同步检查允许范围，禁止公开数据库、后端配置、隐藏文件或凭据。
