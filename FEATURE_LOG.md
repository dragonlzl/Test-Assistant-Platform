# 新增功能需求记录  

> 用于登记已完成的新增功能及后续变更。同一需求有细节调整时，请同步更新对应条目。

## 使用说明  
- 完成新功能后立即添加记录，包含：功能描述、操作方式、使用效果、新增内容/接口、测试与验证摘要。  
- 若同一需求后续有内容或细节修改，在原条目下追加“更新记录”或修改相关字段。  
- 记录顺序：最新需求放最上方，便于查阅。  

## 记录模板（复制后填写）  
```
- 功能名称：  
- 功能描述：  
- 操作方式：  
- 使用效果：  
- 新增内容/接口/组件：  
- 复用说明：是否复用现有接口/组件？如未复用，说明原因  
- 测试与验证：执行的 UI 自动化用例/结果，必要的人工验证  
- 更新记录：如有后续变更，在此追加时间点与修改要点  
```

- 功能名称：用例库“编辑用例”改名 + 选择执行支持批量转到执行  
- 功能描述：用例库顶部导航“编辑用例&转到执行”入口改为“编辑用例”（更聚焦编辑/导出/删除）；“选择用例执行”抽屉新增复选框、全选与“批量转到执行”，可一次勾选多份用例文件转入执行页。为降低本地静态资源偶发空响应导致的关键能力缺失（如 drawer/switchTab/xmindCore）概率，增加轻量兜底：缺关键对象时自动刷新恢复，同时在用例库模块内对抽屉与导出依赖做补拉/降级处理。  
- 操作方式：  
  - 进入“用例相关 → 用例库”→点“编辑用例”打开编辑抽屉（项目/版本筛选、导出、删除等保持不变）。  
  - 进入“用例相关 → 用例库”→点“选择用例执行”→选择项目（自动加载列表）→勾选多份→点“批量转到执行”。  
- 使用效果：可批量将用例库多份用例文件转入执行页，减少逐条点击；并在静态资源加载抖动时可自动自愈，避免抽屉/导出/导航关键能力缺失导致流程中断。  
- 新增内容/接口/组件：  
  - 前端：`index.html`（编辑入口文案、选择执行批量控件、启动自检自动刷新兜底）、`scripts/modules/caseLibrary.js`（选择执行批量勾选与批量转到执行、抽屉兜底 open/close、导出依赖补拉、编辑卡 hidden 属性兜底）、`style.css`（复用既有样式，无新增）。  
  - 测试：`tests/ui/case_library.spec.js`（新增“选择用例执行：支持勾选并批量转到执行”用例，更新相关描述文案）。  
- 复用说明：复用既有用例库列表/过滤、`transferItemsToTempExec`（DB 执行集 upsert）与抽屉 DOM 结构；批量转到执行为最小增量扩展，不改变单条“转到执行”逻辑。  
- 测试与验证：`node --check scripts/modules/caseLibrary.js`（通过）；`npx playwright test --config tests/playwright.config.js tests/ui/case_library.spec.js`（通过）。  


- 功能名称：用例执行数据入库（执行视图 DB 持久化 + 导入确认入库 + 同步用例库）
- 功能描述：用例执行页的执行数据不再依赖浏览器缓存，改为落库到 SQLite；导入/分配改为“先选文件→再选项目/版本→确认入库”；执行中编辑除“实际结果/缺陷链接”外的字段会实时同步到用例库（case_items），并记录执行历史。
- 操作方式：
  - 用例执行页导入：打开“用例导入&分配”抽屉 → 拖拽/选择 XMind/JSON → 在下方选择“项目/版本”（仅自身所属项目）→ 点击“确认入库”。
  - 执行数据自动保存：在“执行视图”中修改用例内容/结果后自动写入数据库；删除需求区用例会将对应执行集归档，后续同名导入/从用例库转入会恢复历史执行记录。
  - 用例库转到执行：用例库选择用例文件“转到执行”会走 DB 执行集 upsert；同名覆盖时可按规则保留历史执行结果（标题+预期相同则保留执行结果/备注/缺陷等）。
- 使用效果：执行数据可跨浏览器/缓存持久化；导入过程更可控（避免误入库）；执行编辑与用例库保持一致，历史执行记录可恢复与合并追加。
- 新增内容/接口/组件：
  - 前端：`scripts/core/tempexecCore.js`（DB 读写执行集/执行用例、导入入库/合并追加、删除归档恢复）、`scripts/modules/tempexec.js`（导入确认入库 UI/交互）、`scripts/modules/caseLibrary.js`（转到执行走 DB）、`services/apiClient.js`（补 exec 相关 API）、`index.html`（导入区新增项目/版本/确认控件）、`style.css`（项目/版本选择框美化与最小宽度）。
  - 后端：`backend/routers/exec_routes.py`（`POST /api/exec/sets/from-case-file`、`PATCH /api/exec/cases/{id}` 同步 case_items 与 history、`POST /api/exec/sets/{id}/cases` 支持 case_item_id）、`backend/schemas.py`（ExecCaseCreate 增加 case_item_id）、`backend/models.py`/`backend/migrations.py`（字段/约束增量）。
  - 数据：执行页 UI 状态以 settings 键 `tempexec_ui_v1` 持久化（当前激活、布局、折叠、分页等）。
- 复用说明：复用既有执行视图渲染/解析逻辑与统一鉴权/项目可见性；仅在必要处新增“DB 模式”分支与接口扩展，静态模式保持原行为。
- 测试与验证：
  - 语法检查：`node --check scripts/core/tempexecCore.js scripts/modules/tempexec.js scripts/modules/caseLibrary.js services/apiClient.js`（通过）；`python3 -m compileall backend`（通过）。
  - UI：`npm run test:ui -- tests/ui/case_library.spec.js tests/ui/tempexec_import_confirm.spec.js tests/ui/drawer_nav_visibility.spec.js tests/ui/admin_visibility.spec.js`（通过）。
  - API：`APP_DB_FILE=apitest.db ./.venv/bin/python -m uvicorn backend.main:app --port 9000` 后执行 `API_BASE_URL=http://127.0.0.1:9000 npx playwright test --config tests/api/playwright.api.config.js --workers=1 tests/api/case_library.spec.js tests/api/exec_persistence.spec.js`（通过）。
- 更新记录：2025-12-14 补充执行页“导入需确认入库”UI 用例（`tests/ui/tempexec_import_confirm.spec.js`）与执行入库 API 用例（`tests/api/exec_persistence.spec.js`）；修复抽屉遮罩 UI 用例登录注入（`tests/ui/drawer_nav_visibility.spec.js`）；修复后端文件名清洗未覆盖“勾选用例 ”带空格前缀导致执行页确认入库出现“成功 0，失败 1”，并在前端导入匹配中兼容历史 `file_name_clean`；新增 UI 用例覆盖该场景，API 用例补充带空格前缀清洗断言（`tests/ui/tempexec_import_confirm.spec.js`、`tests/api/case_library.spec.js`）；扩展“勾选用例”前缀清洗支持全角空格/多种短横线，避免特定文件名仍触发“成功 0，失败 1”，并补充对应 UI/API 用例覆盖（`tests/ui/tempexec_import_confirm.spec.js`、`tests/api/case_library.spec.js`）；修复用例库/执行页导入遇到“文件内重复条目（模块+标题+预期相同）”时整份导入失败：后端导入前自动去重并记录跳过数量，API 用例补充覆盖（`backend/routers/cases.py`、`tests/api/case_library.spec.js`）；用例库“编辑用例&转到执行”列表新增展示“用例条目数”（接口聚合返回，不新增 DB 字段）（`backend/routers/cases.py`、`backend/schemas.py`、`scripts/modules/caseLibrary.js`、`index.html`）；用例库“编辑用例&转到执行”支持全选/全取消并批量删除所选用例文件（需二次确认），后端新增 `DELETE /api/case-files/{id}` 并补齐 UI/API 用例覆盖（`backend/routers/cases.py`、`services/apiClient.js`、`scripts/modules/caseLibrary.js`、`index.html`、`tests/ui/case_library.spec.js`、`tests/api/case_library.spec.js`）（仅管理员可删除，确认弹窗文案改为“用例名，x条”列表格式）；用例库“编辑用例&转到执行/选择用例执行”抽屉选择项目后自动刷新列表，无需点击确认（`scripts/modules/caseLibrary.js`、`index.html`、`tests/ui/case_library.spec.js`）；修复项目管理增删版本/新增项目后，用例库与用例执行导入区“项目/版本”下拉不刷新：项目管理变更后广播 `app-projects-updated`，导入模块清理缓存并在页签激活时重拉；新增 UI 用例覆盖（`scripts/modules/admin.js`、`scripts/modules/caseLibrary.js`、`scripts/modules/tempexec.js`、`tests/ui/project_changes_refresh_import_selects.spec.js`）。

- 功能名称：设置/模型/功能指派持久化 API 与操作日志查询  
- 功能描述：新增设置、模型配置、功能指派的持久化接口，支持用户级/全局双作用域；操作日志提供管理员可查列表，前端“操作记录”页可刷新查看登录/增删改等记录。  
- 操作方式：  
  - 设置：`GET /api/settings?scope=all|user|global&owner_id=`，`PUT /api/settings`（items 列表）。  
  - 模型：`GET /api/models?scope=all|user|global&owner_id=`，`POST /api/models` 创建（scope 支持 user/global），`PATCH /api/models/{id}` 更新。  
  - 功能指派：`GET /api/features?...`，`POST /api/features`，`PATCH /api/features/{id}`；全局写入仅管理员。  
  - 操作日志：管理员访问 `GET /api/ops?limit=&offset=&user_id=` 或前端“管理-操作记录”页的刷新按钮查看最新日志。  
- 使用效果：设置/模型/指派数据落库并按权限隔离，非管理员仅能写入/修改自己的数据，全局配置需管理员；操作日志可按需审计最近动作，前端提供表格视图与分页条数选择。  
- 新增内容/接口/组件：后端新增路由 `backend/routers/configs.py`、`backend/routers/ops.py`、`ModelConfig` 唯一性约束；`services/apiClient.js` 补充对应 API 封装；前端新增操作记录表格与刷新逻辑（`index.html`、`scripts/modules/opsLog.js`、`style.css`）；前端设置/模型/指派加载顺序调整并接入后端持久化（`scripts/modules/settings.js`、`scripts/modules/models.js`、`index.html`）；新增 API 用例 `tests/api/settings_models.spec.js`。  
- 复用说明：复用统一鉴权与操作日志写入逻辑，权限依赖现有角色/级别校验；前端复用 admin 样式与全局状态。  
- 测试与验证：`python -m compileall backend`（通过）；`node --check scripts/modules/settings.js scripts/modules/models.js scripts/modules/opsLog.js`（通过）；`API_BASE_URL=http://127.0.0.1:9000 ADMIN_USER=admin ADMIN_PASS=chillytest_admin npx playwright test --config tests/api/playwright.api.config.js --workers=1 tests/api/admin_entities.spec.js tests/api/auth_change_password.spec.js tests/api/non_admin_projects.spec.js tests/api/settings_models.spec.js`（通过）；已执行 `python3 notify_feishu.py`。  
- 更新记录：设置模块改为按 `state.settings` 全量键值落库/同步（含“其他设置”页新增字段自动生效），补充 API/UI 用例覆盖自定义设置键。  

- 功能名称：项目管理非管理员可见性修复与接口放行  
- 功能描述：非管理员访问“管理-项目管理”不再空白，按所属项目展示列表；保留管理员全量可见，成员仅能查看/维护自己项目版本。  
- 操作方式：以普通成员或组长登录后展开“管理”菜单，点击“项目管理”即可看到所属项目；管理员入口与操作保持不变。  
- 使用效果：成员/组长能直接查看所属项目与版本，避免权限屏蔽导致页面空白；接口返回自身项目分配供前端过滤。  
- 新增内容/接口/组件：调整 authGuard 角色可见性以放开项目管理入口；`/api/users/{user_id}/projects` 支持用户自查所属项目；新增 API 用例 `tests/api/non_admin_projects.spec.js`，更新 `tests/ui/project_admin_drawer.spec.js` 覆盖可见性。  
- 复用说明：复用既有导航切换与项目列表过滤逻辑，仅补充权限判断与接口校验。  
- 测试与验证：`npx playwright test --config tests/api/playwright.api.config.js tests/api/admin_entities.spec.js tests/api/non_admin_projects.spec.js`（通过，API_BASE_URL=http://127.0.0.1:9000）；`npm run test:ui -- tests/ui/project_admin_drawer.spec.js`（通过，使用本地 8090 静态服）。  
- 更新记录：已执行 `python3 notify_feishu.py` 发送完成通知；2025-12-12 补充后端项目描述编辑权限（仅所属项目的组长/Admin），新增权限校验 API 用例。  

- 功能名称：项目管理新增项目追加到底部  
- 功能描述：在项目管理页面创建新项目后，列表保持原有顺序，新项目追加在底部而非置顶，便于按创建时间正序查看。  
- 操作方式：进入“管理-项目管理”，点击“新建项目”保存后，列表末尾出现新项目条目。  
- 使用效果：新增项目不会打乱现有排序，便于按创建顺序查阅。  
- 新增内容/接口/组件：前端项目列表按 id 正序渲染；UI 用例补充校验新增项目出现在末尾。  
- 复用说明：复用既有列表渲染与刷新逻辑，仅调整排序与测试断言。  
- 测试与验证：`npm run test:ui -- tests/ui/project_admin_drawer.spec.js`（通过）。  
- 更新记录：已执行 `python3 notify_feishu.py` 发送通知。  

- 功能名称：项目管理权限细化（管理员/组员/组长）与导航可见性  
- 功能描述：非管理员按级别差异化可见与可操作范围：组员/组长可见“管理-项目管理”，仅显示自身所属项目；组员仅能新增/删除版本，组长额外可编辑项目，删除/新建项目仅管理员可用；无可见子入口时一级菜单自动隐藏。  
- 操作方式：登录后，组员/组长展开左侧“管理”，点击“项目管理”进入；仅能看到自己项目的版本操作按钮，管理员保持原有全量可见可改。  
- 使用效果：降低非管理员越权风险，导航不再出现空的“管理”入口，成员只看到并操作自己的项目范围。  
- 新增内容/接口/组件：authGuard 根据角色+级别重新计算可见 tabs；admin.js 按 currentUserProjects 过滤项目列表并限制动作权限；新增 currentUser/currentUserProjects 缓存。  
- 复用说明：复用既有 API 客户端与 tab 切换逻辑，未新增接口。  
- 测试与验证：`node --check scripts/modules/admin.js scripts/modules/authGuard.js`（通过）；尝试 `npx playwright test tests/ui/project_admin_drawer.spec.js`，因 Chrome headless 在当前沙箱下触发 macOS mach_port 权限拒绝未能跑通（chromium/crashpad 被拒绝写入），需在允许的环境复跑。  
- 更新记录：2025-12-12 支持中文级别（组长/组员）也能正确识别权限并显示项目管理入口；当前端未拿到分配项目列表时，按接口返回的项目补全当前用户可见集，避免组长页面为空；所属项目 ID 兼容 `project_id/projectId/id/字符串`，防止过滤后空表。  

- 功能名称：项目管理列表排版与按钮居中优化  
- 功能描述：版本区域完整展示多行版本不滚动，“暂无版本”垂直居中；操作按钮固定高度/内边距，文本不换行且居中；项目名列宽缩半并给版本列让宽，版本列去掉底部线；项目名/描述/时间在版本换行时仍保持单行显示。  
- 操作方式：进入项目管理列表查看版本较多的项目，观察按钮位置与各字段展示。  
- 使用效果：多行版本时操作列不再被拉高，按钮与文字对齐美观；项目字段宽度稳定，不受版本换行干扰。  
- 新增内容/接口/组件：调整项目管理表格布局（table-layout: fixed、列宽/最小宽度）、按钮样式、版本区样式。  
- 复用说明：仅样式与现有渲染逻辑调整，无新增组件。  
- 测试与验证：同上，UI 自动化因浏览器权限限制未跑通；需在具备 Chromium 运行权限的环境复验项目管理相关用例。  
- 更新记录：无  

- 功能名称：项目管理空版本提示居中
- 功能描述：项目管理表格中，当项目还没有版本时，“暂无版本”提示垂直居中显示，行内容对齐不再显得偏高。
- 操作方式：进入“管理-项目管理”，在无版本的项目行查看“版本”列提示。
- 使用效果：空版本提示与表格其它字段保持同一垂直中心，对齐一致，行高度更整齐。
- 新增内容/接口/组件：样式调整（style.css `.admin-table td` 垂直居中、`.version-empty` 尺寸与内边距优化）；UI 用例增加空态位置校验（tests/ui/project_admin_drawer.spec.js）。
- 复用说明：复用既有表格结构与提示文案，仅优化样式与现有测试。
- 测试与验证：`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:ui -- tests/ui/project_admin_drawer.spec.js`（通过）。
- 更新记录：无

- 功能名称：项目管理操作区不换行、版本列去线
- 功能描述：项目管理表格中“操作”列按钮保持一行排列不再换行；“版本”列底部边线去除，视觉更干净。
- 操作方式：进入“管理-项目管理”，查看项目列表的操作按钮与版本区域。
- 使用效果：操作按钮集中一行更易点击，版本列空态或多标签下不再出现多余分割线。
- 新增内容/接口/组件：项目表格定向样式（style.css `#projectAdmin .admin-table .actions`、`#projectAdmin .admin-table td.project-versions`），UI 用例增加布局校验（tests/ui/project_admin_drawer.spec.js）。
- 复用说明：复用既有表格与按钮结构，仅调整样式与测试校验。
- 测试与验证：`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:ui -- tests/ui/project_admin_drawer.spec.js`（通过）。
- 更新记录：保持版本完整展示不滚动；操作区高度固定并居中，避免随版本行高拉伸；操作按钮文本保持单行居中不换行；项目名/描述/创建时间保持单行不换行、固定列宽，版本换行不再挤压这些字段；项目名宽度缩小一半并让出空间给版本列。

- 功能名称：无可见二级入口时隐藏一级菜单
- 功能描述：当某一级导航下所有二级入口因权限不可见时，自动隐藏对应的一级按钮，避免出现无法点击的空菜单。
- 操作方式：权限不足用户登录后，侧边导航仅显示有权限的一级按钮；管理员保持不变。
- 使用效果：非管理员看不到空的“管理”等一级入口，导航更简洁。
- 新增内容/接口/组件：权限可见性计算与一级菜单隐藏逻辑（scripts/modules/authGuard.js），导航用例覆盖无权限场景（tests/ui/sidebar_menu.spec.js）。
- 复用说明：复用现有角色标记与 tab 切换逻辑，仅增加可见性判定。
- 测试与验证：`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:ui -- tests/ui/sidebar_menu.spec.js`（通过）。
- 更新记录：无

- 功能名称：人员管理项目分配改为勾选
- 功能描述：人员管理抽屉的“所属项目”改为平铺勾选项，无项目时显示“暂无项目”，多个项目自动换行，勾选即为分配。
- 操作方式：进入“管理-人员管理”打开新增/编辑抽屉，按需勾选项目；无可用项目时看到“暂无项目”提示。
- 使用效果：项目分配入口直观可视，支持多行展示，空态清晰。
- 新增内容/接口/组件：项目勾选容器与样式（index.html#userProjectsSelect，style.css `.user-projects-select/.project-checkbox/.project-checkbox-empty`），表单收集逻辑更新（scripts/modules/admin.js），UI 用例覆盖勾选状态与空态（tests/ui/user_admin_drawer.spec.js）。
- 复用说明：复用原有项目数据与分配接口，仅调整前端展示与选择方式。
- 测试与验证：`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:ui -- tests/ui/user_admin_drawer.spec.js`（通过）。
- 更新记录：无

- 功能名称：抽屉开启时禁用侧边导航点击  
- 功能描述：抽屉打开后左侧导航（含二级菜单与用户菜单）保持可见但不再响应点击或切换，避免遮罩下误触。  
- 操作方式：任意页面打开抽屉后，侧边一级/二级菜单、用户菜单与侧边工具按钮点击无效，需先收起抽屉再切换页签；抽屉关闭后恢复原有操作。  
- 使用效果：遮罩出现时不会误切换页签或展开菜单，现有二级菜单设计与样式保持不变。  
- 新增内容/接口/组件：抽屉状态检测与侧边事件阻断（scripts/core/appRuntime.js），用户菜单在抽屉开启时自动关闭/忽略点击（scripts/modules/authGuard.js）；新增 UI 场景 `tests/ui/sidebar_menu.spec.js` 覆盖抽屉下导航禁用。  
- 复用说明：复用既有抽屉组件与页签切换逻辑，仅新增 isDrawerOpen 判定与事件阻断，不改动 DOM/样式结构。  
- 测试与验证：`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:ui -- tests/ui/sidebar_menu.spec.js`（通过，需确保 8090 端口空闲）。  
- 更新记录：2025-12-11 调整抽屉 z-index 与 content-shell 层级，确保遮罩覆盖导航；侧边栏键盘事件也被阻断。  

- 功能名称：人员管理抽屉表单优化  
- 功能描述：人员抽屉的“所属项目”改为紧凑下拉多选，整体更轻量；抽屉按钮排版收紧，取消按钮不再占满整行。  
- 操作方式：在“管理-人员管理”点击“新增/编辑”打开抽屉，项目选择为小型多选列表，可滚动选择；保存/取消按钮紧凑排列。  
- 使用效果：表单占用空间更少，视觉更整洁，避免巨型列表和宽幅取消按钮。  
- 新增内容/接口/组件：项目多选样式 `user-projects-select`、抽屉按钮布局类 `user-form-actions`（style.css/index.html）。  
- 复用说明：复用现有抽屉与表单逻辑，仅调整样式与标记。  
- 测试与验证：`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:ui -- tests/ui/user_admin_drawer.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：项目管理抽屉化与表格视图  
- 功能描述：“项目管理”改为表格列表展示，包含项目名/描述/版本/创建时间；新增与编辑项目在右侧抽屉完成，保持与人员管理一致的交互。  
- 操作方式：进入“管理-项目管理”查看表格，点击“新建项目”或行内“编辑”在抽屉填写名称/描述保存；版本仍可在表格行内新增/删除。  
- 使用效果：项目列表信息更集中易读，抽屉交互统一且不占主界面空间。  
- 新增内容/接口/组件：项目表格 DOM `#projectTableBody`、项目抽屉 `#projectDrawer` 与标题 `#projectDrawerTitle`，版本展示按钮布局（index.html/style.css），项目交互逻辑抽屉化（scripts/modules/admin.js）。  
- 复用说明：复用已有抽屉组件与状态提示，沿用项目/版本接口。  
- 测试与验证：`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:ui -- tests/ui/project_admin_drawer.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：人员管理列表视图与抽屉编辑  
- 功能描述：人员管理改为表格列表展示，适配多人场景；新增/编辑人员在右侧抽屉完成，字段集中且可滚动。  
- 操作方式：在“管理-人员管理”进入后查看表格，点击“新增人员”或行内“编辑/分配项目”打开抽屉，填写账号、角色、级别、状态、项目并保存。  
- 使用效果：大量用户时仍可快速浏览与筛查，编辑时不挤占主界面；抽屉关闭后列表自动刷新。  
- 新增内容/接口/组件：表格 DOM（`index.html#userTableBody`）、抽屉容器 `#userDrawer`；样式 `.admin-table*`（style.css）；前端逻辑更新（scripts/modules/admin.js）支持表格渲染、抽屉开关、状态提示。  
- 复用说明：复用现有抽屉组件与状态提示方法，沿用既有用户/项目接口。  
- 测试与验证：新增 UI 用例 `tests/ui/user_admin_drawer.spec.js` 覆盖表格渲染与抽屉开关；未执行（本地缺少 Playwright 浏览器二进制），需先运行 `npx playwright install` 后执行 `npx playwright test tests/ui/user_admin_drawer.spec.js`。  
- 更新记录：2025-12-11 列表级别改为中文展示（组长/组员），与抽屉选择一致。  

- 功能名称：侧边导航分级与悬浮子菜单  
- 功能描述：左侧页签按“AI 功能/用例相关/管理/设置”分级，二级入口通过悬浮菜单展示，避免按钮拥挤且保持布局稳定。  
- 操作方式：点击一级按钮在右侧弹出悬浮菜单，选择对应二级按钮切换页面，点击空白处即可收起。  
- 使用效果：导航更清晰，二级入口不再挤占侧边栏空间，切换时保留原有高亮与布局。  
- 新增内容/接口/组件：侧边导航分组 DOM（index.html）、样式 `.tab-group/.tab-submenu` 与层级样式（style.css）、分组展开/收起逻辑与激活高亮（scripts/core/appRuntime.js）。  
- 复用说明：复用原有 tab 切换与高亮机制，仅新增分组容器与悬浮层展示。  
- 测试与验证：手工在主界面验证四个一级菜单的展开/收起、二级按钮点击切换、点击空白收起；建议在 Chrome/Safari 走一遍核心流程。新增 UI 自动化用例 `tests/ui/sidebar_menu.spec.js` 覆盖展开/关闭与切换（2025-XX-XX 最新运行通过）。  
- 更新记录：无  

- 功能名称：人员/项目管理前端与接口接入  
- 功能描述：管理员可在“管理”分组下完成项目与版本增删改、人员增删改、项目分配及密码重置。  
- 操作方式：项目管理卡片支持刷新/新建/编辑/删项目及新增/删除版本；人员管理卡片支持新增/编辑用户、分配项目、重置密码和删除；点击对应一级菜单后显示二级按钮，再进入卡片操作。  
- 使用效果：基础权限与项目成员关系可在前端直接配置，后端自动写入/校验，后续用例库/执行等功能可依赖项目与人员数据。  
- 新增内容/接口/组件：前端新增 `scripts/modules/admin.js`、项目/人员表单与列表（index.html）、样式块（style.css）；API 客户端扩展用户/项目 CRUD 与分配方法；后端新增用户项目列表接口 `/api/users/{id}/projects`；新增接口用例 `tests/api/admin_entities.spec.js`。  
- 复用说明：复用现有卡片样式与状态提示；接口复用既有鉴权与操作日志逻辑。  
- 测试与验证：`npm run test:ui -- tests/ui/sidebar_menu.spec.js`（通过，需 http.server 提权）；`npx playwright test --config tests/api/playwright.api.config.js tests/api/admin_entities.spec.js`（需本地运行 FastAPI 服务）。  
- 更新记录：无  

- 功能名称：当前迭代计划（DB 接入与权限改造）
- 功能描述：用 FastAPI + SQLite3 替换浏览器缓存持久化，新增登录/权限、人员管理、项目管理、用例库、执行数据入库、操作记录、设置/模型/功能指派持久化等；详情见 `db_integration_plan.md`。
- 操作方式：实施前先阅读 `db_integration_plan.md` 与本条，确认已有进展与待办；实施后按 `FEATURE_DEV_GUIDE.md` 要求记录更新。
- 使用效果：为多次迭代提供统一上下文，明确当前目标与落地路径。
- 新增内容/接口/组件：规划文档 `db_integration_plan.md`，预计新增 FastAPI 服务、SQLite 表与前端页签/接口适配（实施中）。
- 复用说明：规划阶段；实施时优先复用现有前端组件与逻辑，后端按规划复用通用接口模式。
- 测试与验证：规划阶段，实施时需补充 UI 与 API 自动化测试。
- 更新记录：已初始化 FastAPI+SQLite 后端骨架（静态托管、默认管理员、鉴权/用户/项目/版本与分配、操作日志写入），新增用例库导入/编辑与执行集创建/用例写库等 API；前端增加独立登录页、鉴权接入、侧边栏显示当前用户、管理员页签（项目管理/人员管理/操作记录）占位与用例库入口；补充执行总览规划（exec_overview_stats 表及接口）；支持登录页修改密码（前端表单+后端接口），新增 API 自动化用例 `tests/api/auth_change_password.spec.js`，待前端人员管理、执行页持久化与总览落地。  

- 功能名称：工作流导入同步执行文件名去重  
- 功能描述：用例生成页“用例视图中勾选用例，新增到”将工作流导入的用例同步到执行页时，执行名称/导出 XMind 根节点沿用所选用例文件名，先移除旧的 `_年月日时分秒` 标识再追加最新时间戳，避免标识叠加。  
- 操作方式：在功能工作流导入用例后于用例生成页勾选用例、选择对应导入文件并确认新增，跳转到用例执行时根节点即为源文件名+当前时间戳，导出 XMind 根节点保持一致。  
- 使用效果：执行页根节点名称与来源用例保持一致，导出 XMind 不再显示需求标识或叠加时间戳。  
- 新增内容/接口/组件：追加到工作流的同步执行逻辑新增文件名前缀去标识与重新命名；XMind 导出根节点优先使用执行文件名；新增 UI 用例 `tests/ui/casegen_workflow_exec_name.spec.js` 校验命名。  
- 复用说明：复用文件名清理与时间戳生成规则（getSafeFileBaseName、formatCompactTimestamp），未引入新接口。  
- 测试与验证：`npm run test:ui -- tests/ui/casegen_workflow_exec_name.spec.js`（通过，需本地 python3 http.server 提权）。  
- 更新记录：补充“勾选用例转执行”生成的执行文件去除“勾选用例-”前缀并沿用需求标识；导出用例 XMind 根节点同步执行文件名。  

- 功能名称：一键执行等待跳转定位
- 功能描述：开启“需要人工确认需求澄清后再继续自动流程”时，澄清等待或覆盖率不足的导航点击将直接跳转到一键执行页对应澄清/对比区，而非功能工作流卡片。
- 操作方式：勾选自动流程澄清选项后运行一键执行，出现澄清等待或覆盖率不足提示时，点击顶部流程导航对应步骤即自动切换到“一键执行”页并定位到澄清或对比卡片。
- 使用效果：等待人工澄清或覆盖率不足时无需手动切页查找，导航按钮直接带用户到一键执行处理区域。
- 新增内容/接口/组件：flowCore 导航跳转增加等待状态下的自动页锚点处理；UI 用例扩展 `tests/ui/auto_waiting_status.spec.js` 覆盖等待跳转。
- 复用说明：复用既有导航与等待状态标记，只调整滚动目标与显隐控制。
- 测试与验证：`npm run test:ui -- tests/ui/auto_waiting_status.spec.js --project=chromium --headed`（通过，需 http.server 提权）。
- 更新记录：无  

- 功能名称：拆分结果自动同步拆分视图
- 功能描述：测试模块拆分模型生成结果后自动触发拆分视图刷新，无需导出/导入即可直接展开查看模块表格。
- 操作方式：在“测试模块拆分”调用模型生成结果或程序写入拆分结果后，点击“展开拆分视图”即可查看，按钮会自动启用。
- 使用效果：拆分完成后无需手动修改文本或重新导入，拆分视图抽屉立即可展开，模块列表与用例生成保持同步。
- 新增内容/接口/组件：拆分结果写入统一通过 `applySplitResultText` 触发 `input` 事件与视图同步；新增 UI 用例 `tests/ui/split_view_autosync.spec.js` 验证按钮自动可用。
- 复用说明：复用既有拆分结果解析、输入监听与视图渲染逻辑，仅补充程序写入时的事件派发与同步接口。
- 测试与验证：`npm run test:ui -- tests/ui/split_view_autosync.spec.js`（首次因端口占用失败，清理 http.server 后重跑通过）。
- 更新记录：无  

- 功能名称：XMind 导出文件名去重与依赖修复  
- 功能描述：导出执行/用例 XMind 时会先清除已有的 `_result_年月日时分秒` 或 `_年月日时分秒` 标识，避免时间戳叠加；同时修复执行页导出按钮因依赖未初始化导致无响应的问题。  
- 操作方式：在执行页点击“导出执行XMind”或“导出用例Xmind（无结果）”，或在用例生成/模块导出 XMind 时，导出文件名自动去除旧标识后再追加最新时间戳。  
- 使用效果：多次导入/导出、在结果与无结果之间切换时，文件名仅保留一次时间戳/结果标识，导出按钮恢复可用。  
- 新增内容/接口/组件：文件名清理方法 `stripTimestampSuffix` 复用于 xmindCore 与 tempexecCore，暴露安全文件名前缀获取；新增 UI 用例 `tests/ui/xmind_filename_sanitize.spec.js`，扩展执行导入用例 `tests/ui/tempexec_import_xmind.spec.js`。  
- 复用说明：复用既有 XMind 构建/导出与执行导入逻辑，仅补充文件名清理与依赖顺序修复。  
- 测试与验证：`npm run test:ui -- tests/ui/xmind_filename_sanitize.spec.js tests/ui/tempexec_import_xmind.spec.js`（通过，需 http.server 提权）。  
- 更新记录：修复 app.js 初始化顺序，避免 `getSafeFileBaseName`/`buildTempExecCasesFromXmindPaths` 未定义导致导出/导入失效。  

- 功能名称：智能填充后关闭缺失抽屉恢复滚动  
- 功能描述：智能填充缺失模块建议后自动关闭缺失模块抽屉与智能缺失抽屉，避免遮罩残留导致后续页面无法滚动。  
- 操作方式：在清洗页导入拆分与覆盖对比结果，点击“缺失模块视图”后使用“智能填充”同步建议，抽屉会在填充完毕后自动收起。  
- 使用效果：智能填充完成后跳转到用例生成页时不再被遮罩阻挡，可正常滚动和编辑。  
- 新增内容/接口/组件：`closeMissingDrawersAfterFill` 关闭双抽屉逻辑，智能填充流程调用；UI 用例 `tests/ui/cases_missing_view.spec.js` 新增滚动可用性校验并统一等待初始化。  
- 复用说明：复用既有抽屉封装与智能填充流程，仅补充收起逻辑与用例覆盖。  
- 测试与验证：`npx playwright test --config tests/playwright.config.js tests/ui/cases_missing_view.spec.js --reporter list`（首次等待初始化超时，单例重跑通过）。  
- 更新记录：补充切换 Tab 前统一收起抽屉，修复生成用例等跳转后的滚动锁定。  

- 功能名称：执行页导入结果型 XMind 并识别复用  
- 功能描述：用例执行页支持导入带执行结果的 XMind，自动根据根节点到叶子路径长度判定是否包含结果，并区分复用/非复用类型，复用子项与状态会同步到执行列表。  
- 操作方式：在“用例导入&分配”直接导入执行 XMind，普通 6 层路径视为无结果，存在更深层节点则判为结果型；含子项路径自动开启复用模式。  
- 使用效果：导入带结果的 XMind 时，执行状态/备注/复用子项自动落表；无结果的 XMind 仍按原有用例导入。  
- 新增内容/接口/组件：XMind 叶子路径收集与结果解析、执行导入复用检测；UI 用例 `tests/ui/tempexec_import_xmind.spec.js` 覆盖无结果/带结果/复用导入。  
- 复用说明：复用既有 XMind 解析与执行文件结构，仅新增路径分析与复用标记处理。  
- 测试与验证：`npx playwright test --config tests/playwright.config.js tests/ui/tempexec_import_xmind.spec.js --reporter list`。  
- 更新记录：无  

- 功能名称：一键执行导航失败态标红完善  
- 功能描述：AI 一键需求&用例评审顶部导航在评审/清洗/对比/拆分/覆盖对比结果校验失败时会描边变红并显示红色叉号，生成或导入的不合法数据会自动暴露。  
- 操作方式：运行自动流程或手工导入结果，当评审/清洗/对比/拆分/覆盖对比结果非预期 JSON/缺少内容时，导航按钮自动切换为失败态；修复数据并更新后自动恢复正常。  
- 使用效果：导航清晰提示数据异常步骤，失败态红色描边+叉号一目了然，便于优先修复；成功修复后状态即时回绿。  
- 新增内容/接口/组件：导航校验新增评审/清洗/对比/拆分/覆盖对比自动校验、`updateFlowStatus` 外部调用出口、UI 用例 `tests/ui/auto_waiting_status.spec.js` 扩展失败态断言。  
- 复用说明：复用既有导航状态渲染与验证流程，仅补充校验范围与状态暴露。  
- 测试与验证：`npx playwright test --config tests/playwright.config.js tests/ui/auto_waiting_status.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：一键执行等待/失败导航提示  
- 功能描述：自动流程因需求澄清或覆盖率不足暂停时，顶部步骤导航会标记对应步骤为橙色“等待确认”；生成/导入数据不合法时则标红“失败”，提示人工修复后重试。  
- 操作方式：勾选“需要人工确认需求澄清”并运行一键执行后，澄清未确认时“评审”步骤显示橙色等待；对比完整性覆盖率 <100% 时，“对比完整性”步骤显示橙色等待，重新清洗或忽略后恢复正常；模型输出/导入无效导致校验失败时，相应步骤描边变红并显示红色叉号。  
- 使用效果：等待人工确认时导航描边与状态图标变橙色，数据异常时变红叉，直观暴露阻塞步骤与处理优先级。  
- 新增内容/接口/组件：新增等待/失败状态样式与状态图标、状态字典字段 `state.waitingSteps`/`state.failedSteps`、状态同步与重置逻辑；新增 UI 用例 `tests/ui/auto_waiting_status.spec.js`。  
- 复用说明：复用既有步骤导航渲染与自动流程状态同步逻辑，仅扩展状态计算与样式。  
- 测试与验证：`npx playwright test --config tests/playwright.config.js tests/ui/auto_waiting_status.spec.js tests/ui/auto_drawer.spec.js`（需本地 http.server，已提权通过）；`npm test` 全量执行时沿用同一服务器，有历史失败项：调试文件缺失与文件导出下载事件未触发。  
- 更新记录：无  

- 功能名称：用例生成跨模块勾选导出 XMind（恢复）  
- 功能描述：用例生成页恢复全局“导出全部勾选用例XMind”按钮，可在用例视图勾选多模块用例后一次性导出合并 XMind；导入模块用例后按钮自动启用。  
- 操作方式：导入或生成用例后在模块“用例视图”勾选，用例视图底部可导出/导入/清除当前模块，用例视图关闭后点击顶部“导出全部勾选用例XMind”导出。  
- 使用效果：跨模块勾选导出重新可用，导入后全局导出按钮即时可用，操作集中在用例视图抽屉。  
- 新增内容/接口/组件：全局按钮 DOM/别名绑定、casesGenCore 聚合导出/按钮刷新、用例视图底部操作区保留导出/导入/清除；UI 用例覆盖全局导出。  
- 复用说明：复用既有 XMind 构建与勾选收集逻辑，补充状态刷新与导入后启用。  
- 测试与验证：`npm run test:ui -- tests/ui/casegen_export_xmind.spec.js`（需本地 8090 http.server，已通过）。  
- 更新记录：无  

- 功能名称：用例生成导出使用需求标识命名  
- 功能描述：用例生成页一键导出生成用例时，直接生成需求标识前缀的 XMind 文件，便于归档与区分需求。  
- 操作方式：在“用例生成”点击“导出全部用例”，文件名形如 `需求1_20251209095437.xmind`，前缀取当前需求标识，空标识时提示填写。  
- 使用效果：导出的 XMind 与需求标识一一对应，免去手动改名，便于整理与对比。  
- 新增内容/接口/组件：导出逻辑改为聚合所有生成用例并调用 XMind 导出，文件名基于需求标识与紧凑时间戳；新增 UI 自动化校验导出命名 `tests/ui/casegen_export_xmind.spec.js`。  
- 复用说明：复用现有 XMind 构建与需求标识获取逻辑，仅调整导出聚合与命名。  
- 测试与验证：`npm run test:ui -- tests/ui/casegen_export_xmind.spec.js`（需本地 8090 http.server，已提权运行通过）。  
- 更新记录：无  

- 功能名称：执行页 XMind 导出沿用原文件名  
- 功能描述：用例执行页导出的 XMind 文件名以原始导入文件名为前缀，区分是否包含执行结果追加 result 与时间戳。  
- 操作方式：在“用例执行”点击“导出执行 XMind”或“导出用例 XMind”，示例：导出结果 `需求1_result_20251209093848.xmind`，导出无结果 `需求1_20251209093848.xmind`，前缀取原文件名去扩展名并替换非法字符。  
- 使用效果：下载文件名与来源一致并标识是否含执行结果，便于归档和对比。  
- 新增内容/接口/组件：xmindCore 新增 `getSafeFileBaseName` 工具，临时执行 XMind 导出使用原文件名前缀和紧凑时间戳命名，UI 用例补充文件名断言。  
- 复用说明：复用原有时间戳/下载与导出管线，仅调整文件名生成逻辑。  
- 测试与验证：`npm run test:ui -- tests/ui/tempexec_drag.spec.js`（需本地 8090 http.server，已提权运行通过）。  
- 更新记录：无  

- 功能名称：对比完整性导航步骤补充  
- 功能描述：AI 一键需求&用例评审顶部步骤导航新增“对比完整性”按钮，明确清洗后需先做覆盖率对比再继续拆分/用例导入。  
- 操作方式：在页面顶部步骤条，清洗与拆分之间新增“对比完整性”卡片，点击可定位到对应功能卡片，状态图标与执行进度同步。  
- 使用效果：流程顺序更清晰，覆盖率对比作为独立步骤可一键跳转查看/补录结果，完成后状态自动标记。  
- 新增内容/接口/组件：顶部 flowNav 新增 compare 步骤与编号调整，flowCore 状态映射增加 compareResult，同步更新 UI 用例断言。  
- 复用说明：复用既有步骤导航结构与状态同步逻辑，仅新增步骤节点与状态字段。  
- 测试与验证：`npm run test:ui -- tests/ui/workflow.spec.js`（需本地 8090 http.server，已提权运行通过）。  
- 更新记录：无  

- 功能名称：缺失模块视图操作迁移到抽屉底部  
- 功能描述：缺失模块视图的入口文案改为“前往勾选缺失模块生成缺失用例”，生成缺失用例按钮移入抽屉，与复制缺失、智能生成填充统一放在抽屉底部操作区。  
- 操作方式：点击入口按钮打开抽屉，在抽屉底部依次可复制缺失 JSON、智能生成填充（高亮主按钮）、生成缺失用例。自动流程的缺失抽屉同步改为底部操作区。  
- 使用效果：缺失处理操作集中且不遮挡列表，智能填充按钮更醒目，美观易点。  
- 新增内容/接口/组件：缺失视图抽屉底部操作栏（复制/智能填充/生成用例），入口文案更新；自动缺失抽屉同步布局。  
- 复用说明：复用既有缺失抽屉与生成用例逻辑，仅调整按钮位置与样式。  
- 测试与验证：`npm run test:ui -- tests/ui/cases_missing_view.spec.js`（需本地 8090 http.server，已提权运行通过）。  
- 更新记录：无  

- 功能名称：一键执行视图抽屉化  
- 功能描述：一键执行页的澄清视图、覆盖缺失视图、用例缺失视图统一改为右侧抽屉，澄清确认、缺失处理与补充说明集中在抽屉内。  
- 操作方式：在“需求澄清（人工确认）”点击“前往视图确认澄清”手动打开抽屉补充澄清；在“清洗后需求覆盖率”点击“覆盖缺失视图”查看缺失点、填写说明并继续流程；在“用例缺失测试点”点击入口打开抽屉查看缺失模块、复制/智能填充或跳转生成用例。勾选“需要人工确认”仅暂停流程，不会自动弹出抽屉。  
- 使用效果：视图不再占用卡片主体，操作聚焦在抽屉内，遮罩下导航保持可见；人工澄清需显式打开抽屉确认，避免强制弹窗。  
- 新增内容/接口/组件：新增一键执行澄清/覆盖/缺失抽屉 DOM 与开关、状态镜像辅助方法（按钮文案、状态同步），自动化用例 `tests/ui/auto_drawer.spec.js`。  
- 复用说明：复用通用抽屉组件与现有渲染/状态管理逻辑，仅调整承载位置与开关行为。  
- 测试与验证：`npm run test:ui -- tests/ui/auto_drawer.spec.js`。  
- 更新记录：澄清人工确认选项不再自动展开抽屉，需要手动点击入口。  

- 功能名称：执行页滚动后打开导入抽屉导航不偏移  
- 功能描述：在用例执行页选中用例并上滚列表后，打开“用例导入&分配”抽屉时，左侧页签和执行导航保持在原位置，不会被移动到滚动处。  
- 操作方式：进入“用例执行”页滚动至较靠上位置，点击“用例导入&分配”入口打开抽屉，导航区域应保持贴顶；关闭抽屉后滚动高度保持不变。  
- 使用效果：抽屉开合不再改变导航定位，滚动后的视图稳定，避免需要重新定位导航区域。  
- 新增内容/接口/组件：抽屉滚动锁定改为事件阻断（wheel/touch/键盘），移除 html/body overflow 隐藏以保持导航粘顶，新增 UI 用例覆盖长滚动后打开执行抽屉 `tests/ui/drawer_nav_visibility.spec.js`。  
- 复用说明：复用通用抽屉组件与现有导航布局，仅优化滚动锁定方式。  
- 测试与验证：`npm run test:ui -- tests/ui/drawer_nav_visibility.spec.js`、`npm run test:ui -- tests/ui/tempexec_sticky.spec.js`（通过，需本地 http.server 权限）。  
- 更新记录：无  

- 功能名称：抽屉打开后导航位置保持不变  
- 功能描述：主页面已滚动时打开功能工作流或用例执行的抽屉，左侧页签与顶部导航不再被滚动移出视口，始终停留在原位置。  
- 操作方式：在页面滚动一段距离后打开任意工作流/执行相关抽屉，导航区域仍可见，关闭抽屉后滚动位置保持不变。  
- 使用效果：抽屉开合不会把导航滚走，遮罩覆盖背景但不影响导航辨识，关闭后回到原滚动高度。  
- 新增内容/接口/组件：抽屉基础组件滚动锁定改为事件级阻止（wheel/touch/键盘），移除 html/body overflow 锁定，滚动场景 UI 用例扩展 `tests/ui/drawer_nav_visibility.spec.js`。  
- 复用说明：复用通用抽屉组件与现有导航结构，仅补充滚动锁定与样式控制。  
- 测试与验证：`npm run test:ui -- tests/ui/drawer_nav_visibility.spec.js`、`npm run test:ui -- tests/ui/tempexec_sticky.spec.js`（通过，需本地 http.server 权限，缺少浏览器时先执行 `npx playwright install`）。  
- 更新记录：无  

- 功能名称：用例生成追加到已有用例并同步执行  
- 功能描述：在用例生成页新增“新增到已有用例”按钮，勾选生成的用例后可将其按模块追加到功能工作流已导入的用例中，自动跳过重复标题并同步到用例执行；如未在工作流导入，会引导选择执行页已有用例追加。  
- 操作方式：生成用例并在用例视图勾选需要追加的用例，点击“新增到已有用例”，确认后自动将缺失模块/用例补充到已导入用例并刷新导入数据；若工作流空但执行页有历史用例，可在弹出的选择框选择目标执行用例追加；两处均有用例且需求一致时，同步到执行用例并保留执行记录/复用类型。重复标题自动跳过，内容全重复时提示“用例已经包含将要导入的用例，无需重复新增”。  
- 使用效果：可一次性把多个模块的新用例补齐到既有用例并立即进入执行页，无需手动再导入；执行页历史用例可直接增量补充且保留已有执行结果，重复标题自动跳过。  
- 新增内容/接口/组件：用例生成页追加按钮、工作流/执行页双通道追加与需求匹配逻辑、执行用例合并与执行数据保留、UI 用例 `tests/ui/casegen_append_existing.spec.js`。  
- 复用说明：复用用例生成的选择状态与执行页存储结构，复用已导入用例解析与状态管理，仅新增追加、去重、执行同步与执行数据合并流程。  
- 测试与验证：`npm run test:ui -- tests/ui/casegen_append_existing.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：AI 评审步骤执行态描边与未开始图标优化  
- 功能描述：AI 一键需求&用例评审的步骤按钮在执行中改为白底蓝色描边，运行中的状态图标描边加强；未开始状态改用三角形播放样式替代圆点。  
- 操作方式：在自动流程或手工执行评审/清洗/对比/拆分时，顶部步骤条当前执行步骤显示蓝色描边与跑动图标，未执行步骤右侧展示灰色三角标。  
- 使用效果：执行态不再被深色底遮挡，旋转图标更醒目；未执行态图标形状简洁清晰。  
- 新增内容/接口/组件：运行/未开始状态的图标与描边样式调整，在状态同步时追加内联样式；新增 UI 断言覆盖执行态描边 `tests/ui/workflow.spec.js`。  
- 复用说明：复用既有 flowNav 状态判定与渲染，仅增强样式与图标映射。  
- 测试与验证：`npm run test:ui -- tests/ui/workflow.spec.js`（通过，需本地 8090 http.server）。  
- 更新记录：无  

- 功能名称：覆盖对比导出/缺失视图/拆分按钮交互修复  
- 功能描述：修复用例覆盖对比导出会跳转页面、缺失模块视图全选无效、缺失视图生成用例按钮空态可点、拆分执行中按钮可重复点的问题。  
- 操作方式：导出对比结果时保持在当前页；展开“缺失模块视图”可使用表头全选/取消；未有拆分结果时“生成用例”按钮保持禁用；点击“开始拆分”后按钮在执行中禁用，结束后恢复。  
- 使用效果：导出仅触发下载、不再打开新页；缺失列表可一键全选/全取消；无拆分数据时避免误跳转生成用例；拆分执行中无法重复触发。  
- 新增内容/接口/组件：绑定缺失视图选框事件、导出示例下载按需触发；DOM 映射补充 `splitBtnEl`；新增 UI 用例 `tests/ui/cases_export_and_split.spec.js`，扩展缺失视图用例校验全选/禁用状态。  
- 复用说明：复用既有覆盖对比、缺失视图与拆分流程，仅补充事件绑定与状态控制。  
- 测试与验证：`npm run test:ui -- tests/ui/cases_missing_view.spec.js tests/ui/cases_export_and_split.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：拆分结果生成用例跳转恢复  
- 功能描述：修复功能工作流“测试模块拆分”卡片中，已有拆分结果时点击“生成用例”不跳转的情况，保证可直接进入用例生成页。  
- 操作方式：在“测试模块拆分”生成或导入拆分 JSON 后点击“生成用例”，页面自动切换到“用例生成”页签并渲染拆分模块。  
- 使用效果：拆分结果与用例生成联动恢复正常，无需二次刷新即可跳转。  
- 新增内容/接口/组件：同步 casesGenApi 的生成用例跳转函数绑定，新增 UI 自动化用例 `tests/ui/split_go_usecase_nav.spec.js` 覆盖跳转路径。  
- 复用说明：复用既有跳转与模块解析逻辑，仅补充 API 绑定时机，未新增接口。  
- 测试与验证：`npx playwright test tests/ui/workflow.spec.js tests/ui/split_go_usecase_nav.spec.js --config tests/playwright.config.js`（通过，需本地 http.server 权限）。  
- 更新记录：无  

- 功能名称：缺失模块智能填充按钮即时可用  
- 功能描述：修复先导入拆分数据再导入覆盖对比数据时，“智能生成填充”按钮仍灰置的问题，无需再切换页面即可使用。  
- 操作方式：在“功能工作流”导入拆分调试 TXT（或直接填充拆分结果），再点击“导入对比结果”选择用例覆盖对比文件，导入完成后按钮自动可点击。  
- 使用效果：满足有缺失模块且存在拆分数据时，智能填充按钮即时启用，减少额外跳转。  
- 新增内容/接口/组件：缺失视图按钮刷新时自动回填拆分模块引用；新增 UI 用例覆盖导入拆分+覆盖后按钮可用场景 `tests/ui/cases_missing_view.spec.js`。  
- 复用说明：复用原有拆分解析与缺失视图刷新逻辑，仅补充 CaseGen 模块自动同步。  
- 测试与验证：`npx playwright test tests/ui/cases_missing_view.spec.js tests/ui/split_go_usecase_nav.spec.js --config tests/playwright.config.js`（通过，需本地 http.server 权限）。  
- 更新记录：无  

- 功能名称：用例生成结果展示格式美化  
- 功能描述：生成或导入的用例结果在展示框中不再出现 `<br/>` 乱码，自动格式化为可读 JSON，避免内容拥挤。  
- 操作方式：正常生成或通过“导入json”导入用例结果后，展示框内自动展示排版后的 JSON，包含换行缩进。  
- 使用效果：用例结果可直接阅读/复制，无需手工替换 `<br/>` 或重新排版。  
- 新增内容/接口/组件：用例结果解析时替换 `<br/>`、`&nbsp;` 并统一格式化；新增 UI 用例 `tests/ui/casegen_display_format.spec.js` 验证展示格式。  
- 复用说明：复用原有用例生成解析逻辑，仅在渲染与导入时增加格式化与清洗。  
- 测试与验证：`npx playwright test tests/ui/casegen_display_format.spec.js --config tests/playwright.config.js`（通过，需本地 http.server 权限）。  
- 更新记录：无  

- 功能名称：拆分调试文件需求标识去重  
- 功能描述：导入已包含 requirement 的拆分调试 TXT 后再次保存不会重复包裹需求字段，避免 requirement/data 嵌套。  
- 操作方式：导入带 requirement 的拆分调试文件后直接点击“保存调试TXT”，输出与原需求标识一致、不重复写入。  
- 使用效果：调试文件往返导入/保存保持结构稳定，避免重复字段导致解析异常。  
- 新增内容/接口/组件：调试保存时检测已包裹的 requirement/data 结构并跳过二次封装；新增 UI 用例 `tests/ui/debug_split_wrap.spec.js` 验证无重复包裹。  
- 复用说明：复用原有调试保存逻辑，仅增加包裹检测。  
- 测试与验证：`npx playwright test tests/ui/debug_split_wrap.spec.js --config tests/playwright.config.js`（通过，需本地 http.server 权限）。  
- 更新记录：无  

- 功能名称：缺失模块视图刷新修复  
- 功能描述：修复测试用例覆盖对比结果导入或生成后，缺失模块视图因函数被占位覆盖而不再刷新，无法展示 missing 列表的问题。  
- 操作方式：正常执行“测试用例覆盖对比”或点击“导入对比结果”选择覆盖对比文件，导入后点击“缺失模块视图”即可展开缺失点列表。  
- 使用效果：无论是新生成的覆盖对比结果还是带需求标识/type 字段的导入文件，缺失模块视图都能即时解析并展示行列表，可继续复制或智能填充。  
- 新增内容/接口/组件：修正 compareCore 缺失视图刷新逻辑；新增 UI 自动化用例 `tests/ui/cases_missing_view.spec.js`（新增需求标识覆盖场景）与示例数据 `tests/fixtures/cases_compare_missing_view_wrapped.txt`。  
- 复用说明：复用原有覆盖对比解析与渲染流程，仅去除占位函数覆盖。  
- 测试与验证：`npm run test:ui -- tests/ui/cases_missing_view.spec.js`（通过，需本地 8090 端口 http.server 权限）。  
- 更新记录：无  

- 功能名称：覆盖对比缺失视图解析修复  
- 功能描述：导入用例覆盖对比结果时，兼容 data 内再包一层 data 的格式，缺失模块视图可正常解析并展示用户提供的对比结果。  
- 操作方式：点击“导入对比结果”选择覆盖对比文件，导入后点击“缺失模块视图”可展开并看到缺失行列表。  
- 使用效果：即便覆盖对比结果被额外 data 包裹，也能成功解析 missing 列表并展开视图。  
- 新增内容/接口/组件：覆盖对比解析兜底逻辑、缺失视图 UI 自动化用例 `tests/ui/cases_missing_view.spec.js`、用例覆盖对比示例数据 `tests/fixtures/cases_compare_missing_view.txt`。  
- 复用说明：复用原有覆盖对比解析与视图渲染流程，仅补充 data 包裹兜底。  
- 测试与验证：新增 UI 用例 `npm run test:ui -- tests/ui/cases_missing_view.spec.js`（本地 Playwright 浏览器因系统权限限制无法启动，未能实跑，需在可运行浏览器的环境补测）。  
- 更新记录：无  

- 功能名称：AI 一键步骤状态图标完善  
- 功能描述：在“AI一键需求&用例评审”步骤卡片，为待执行、执行中状态补充明显的图标展示，运行中采用旋转渐变描边与“↻”标识，未开始显示灰色圆点，与完成态的“✓”一致呈现。  
- 操作方式：正常执行评审/清洗/对比/拆分等动作时，顶部步骤按钮会分别显示灰点（未开始）、旋转箭头（执行中）、绿色对勾（完成），无需额外交互。  
- 使用效果：流程进度一眼可辨，待执行/执行中/完成三态视觉统一，符合现有渐变卡片风格。  
- 新增内容/接口/组件：步骤状态图标映射与渐变底色、运行态文本色优化；UI 用例 `tests/ui/workflow.spec.js` 增加状态图标断言。  
- 复用说明：复用既有步骤状态同步逻辑，仅在 flowCore 的状态渲染与样式上补充图标。  
- 测试与验证：`npm run test:ui -- tests/ui/workflow.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：模型返回代码块兼容  
- 功能描述：在模型客户端层统一剥离 ```/'''json 等代码块包裹，避免拆分、清洗、用例生成等依赖模型返回 JSON 的功能因外层标记导致解析失败。  
- 操作方式：正常触发模型调用即可，即使模型返回内容被 ```json 或 '''json 包裹，系统也会自动去掉外层标记再回填到界面。  
- 使用效果：拆分测试模块等功能在收到带代码块标记的模型结果时仍能正常解析、展示与后续处理。  
- 新增内容/接口/组件：模型客户端 stripCodeFence 兼容逻辑；新增 UI 自动化用例 `tests/ui/model_response_strip.spec.js` 覆盖代码块剥离。  
- 复用说明：复用现有 stripCodeFence 方法，在模型客户端统一处理，减少各功能重复兼容。  
- 测试与验证：`npm run test:ui -- tests/ui/model_response_strip.spec.js`（本地提权启动 `python3 -m http.server 8090` 后通过）。  
- 更新记录：无  

- 功能名称：AI一键/功能工作流步骤状态指示  
- 功能描述：在“AI一键需求&用例评审”步骤卡片上，为每个步骤按钮增加未开始/执行中/执行完成的状态图标，手动执行与自动流程都会实时同步。  
- 操作方式：触发评审、清洗、对比、拆分、覆盖率等模型调用或自动流程时，顶部步骤按钮右侧圆点会显示灰色（未开始）、旋转描边（执行中）、绿色对勾（完成）。  
- 使用效果：无需滚动即可快速获知各步骤的模型调用进度，便于判断当前执行到哪里、是否已产出结果。  
- 新增内容/接口/组件：步骤状态图标样式与动画、flowNav 状态同步逻辑（基于现有 inProgressStep 状态）。  
- 复用说明：复用既有步骤状态判定与 inProgressStep 标记，仅新增图标渲染。  
- 测试与验证：`npm run test:ui -- --workers=1`（通过，需本地 8090 端口 http.server 权限）。  
- 更新记录：无  

- 功能名称：用例生成页前往拆分按钮可用性修复  
- 功能描述：修复“前往测试模块拆分”按钮点击无效的问题，确保无论是否已有拆分结果都能跳转到功能工作流的拆分卡片。  
- 操作方式：在“用例生成”页点击“前往测试模块拆分”按钮，页面会切换到“功能工作流”并滚动定位到“测试模块拆分”卡片。  
- 使用效果：按钮始终可见且可点击，跳转后自动激活功能工作流页签并定位拆分卡片，便于继续维护拆分结果。  
- 新增内容/接口/组件：修正 DOM 配置别名与跳转事件绑定；补充 UI 用例覆盖“已有拆分结果”场景到 `tests/ui/sticky_layout.spec.js`。  
- 复用说明：复用现有 tab 切换与滚动逻辑，仅修正 DOM 映射与事件绑定。  
- 测试与验证：`npm run test:ui -- --workers=1 --grep "拆分按钮"`（通过，需本地 8090 端口 http.server 权限）。  
- 更新记录：无  

- 功能名称：粘顶遮挡与用例生成跳转修复  
- 功能描述：AI一键需求&用例评审步骤卡片粘顶时，上方不再露出后方内容；用例生成页的“前往测试模块拆分”按钮可正常跳转。  
- 操作方式：在“功能工作流”页面向上滚动，步骤卡片应始终遮挡上方，不出现透视；在“用例生成”点击“前往测试模块拆分”自动跳回“功能工作流”并定位拆分卡片。  
- 使用效果：粘顶区域遮挡完整，滚动不露出后方页面；跳转入口生效，便于空态快速返回拆分。  
- 新增内容/接口/组件：粘顶偏移变量 `--flow-offset` 与顶层遮挡背景、`casegenHandlers` 跳转兜底；新增 UI 覆盖用例（粘顶无漏底、拆分跳转）至 `tests/ui/sticky_layout.spec.js`。  
- 复用说明：复用既有粘顶布局与滚动跳转逻辑，仅补充遮挡背景与跳转兜底。  
- 测试与验证：新增 UI 用例（粘顶无漏底、用例生成跳转），待安装浏览器后执行 `npm run test:ui -- tests/ui/sticky_layout.spec.js`。  
- 更新记录：无  

- 功能名称：指派提示与执行抽屉体验优化  
- 功能描述：未配置模型时标记“未配置模型”，已有模型但未保存指派时标记“未保存指派模型”，已指派完毕则不再误报；“用例导入&分配”抽屉内切换用例不再把执行视图向上滚；侧边页签按钮视觉强化，突出可点击性。  
- 操作方式：未配模型时“模型管理”“功能指派”页签显示“未配置模型”；配置模型但未保存指派时仅“功能指派”显示“未保存指派模型”；完成功能指派后刷新或切换页签提示徽标应消失；在“用例执行”→“用例导入&分配”抽屉中选择用例文件，执行列表保持当前滚动位置；左侧导航页签按钮更显眼。  
- 使用效果：指派状态提示更准确，执行视图滚动稳定；导航入口更醒目，方便点击。  
- 新增内容/接口/组件：指派缺失判断逻辑优化、抽屉滚动策略调整、页签样式增强。  
- 复用说明：复用现有指派状态存储/抽屉组件与导航结构，仅调整提示判断、滚动开关与样式。  
- 测试与验证：`npm run test:ui -- tests/ui/models_settings.spec.js tests/ui/workflow.spec.js tests/ui/tempexec_entry.spec.js`（通过，需本地 HTTP 服务 8090）。  
- 更新记录：调整指派提示文案：“未配置模型”/“未保存指派模型” 分场景展示；缺失时点击页签自动高亮顶部“保存指派”提示条。  

- 功能名称：页签持久化  
- 功能描述：侧边页签在切换后会记住当前选中项，刷新页面仍停留在上次打开的功能页。  
- 操作方式：点击任意页签切换功能，刷新页面，仍保留在刷新前的页签；首次进入默认停留在“AI一键需求&用例评审”。  
- 使用效果：避免刷新或重新进入时反复寻找入口，提升多页签频繁切换的效率。  
- 新增内容/接口/组件：本地存储键 `usecase-active-tab`，初始化时自动读取。  
- 复用说明：复用既有页签切换逻辑，仅增加持久化读写。  
- 测试与验证：`npm run test:ui -- tests/ui/tab_persistence.spec.js`（通过，本地 HTTP 服务 8090）。  
- 更新记录：无  

- 功能名称：卡片折叠状态持久化  
- 功能描述：功能工作流/自动流程/用例执行等页面的卡片折叠状态会保存到本地，刷新或重新进入页面后保持上次的展开/收起偏好。  
- 操作方式：点击卡片标题折叠或展开；刷新页面或切换回对应 Tab，状态保持不变，跳转到某卡片时自动展开。  
- 使用效果：自定义的折叠视图不会因刷新丢失，导航跳转时避免卡片仍处于折叠导致内容遗漏。  
- 新增内容/接口/组件：折叠状态存储键 `usecase-card-collapse-v1`、全局存储对象 `cardCollapseStore`、UI 自动化用例 `tests/ui/layout_persistence.spec.js`。  
- 复用说明：复用现有卡片结构与折叠交互，仅增加状态持久化与跳转同步。  
- 测试与验证：`npm run test:ui -- tests/ui/layout_persistence.spec.js tests/ui/help_structure_drawer.spec.js tests/ui/tempexec_drag.spec.js`（通过，需本地 HTTP 服务权限）。  
- 更新记录：无  

- 功能名称：XMind 用例结构抽屉化  
- 功能描述：使用帮助页的“XMind 用例结构”从折叠卡改为右侧抽屉，支持遮罩点击收起，内容保持不变。  
- 操作方式：点击侧边“使用帮助”中的“XMind 用例结构”按钮，抽屉从右侧展开查看；点击遮罩或“收起”关闭。  
- 使用效果：结构说明不再占据主视图，阅读/关闭更便捷。  
- 新增内容/接口/组件：复用通用抽屉组件新增 `xmindStructureDrawer` 实例。  
- 复用说明：共用 `scripts/base/drawer.js`，仅调整承载容器与开关按钮。  
- 测试与验证：`npm run test:ui -- tests/ui/help_structure_drawer.spec.js`（通过，需本地 HTTP 服务权限）。  
- 更新记录：无  
- 功能名称：执行配置导出包含模型配置  
- 功能描述：导出“执行页面配置”时同步包含模型管理页的模型配置（含 API Key 等字段），导入时自动写回并持久化，兼容旧版快照。  
- 操作方式：在“用例导入&分配”抽屉点击“导出执行页面配置”下载快照，或在同位置点击“导入执行页面配置”还原，模型配置一并恢复。  
- 使用效果：备份/迁移执行配置时无需额外保存模型管理数据，导入后可直接继续使用。  
- 新增内容/接口/组件：执行配置快照新增 `models`/`assignments` 字段，导入时写入模型与指派存储。  
- 复用说明：复用现有快照结构，新增字段为可选，旧快照可直接导入。  
- 测试与验证：`npm run test:ui -- tests/ui/tempexec_entry.spec.js tests/ui/tempexec_view_empty.spec.js tests/ui/tempexec_drag.spec.js tests/ui/tempexec_progress.spec.js`（通过，需本地 HTTP 服务权限）。  
- 更新记录：无  
- 功能名称：用例执行总览抽屉化  
- 功能描述：用例执行总览改为右侧抽屉，保持原有统计与跳转功能，从导航卡或导入区按钮打开，与“用例导入&分配”一致。  
- 操作方式：在“功能导航”点击“执行总览”卡片，或在导入抽屉点击“用例执行情况总览”按钮，右侧抽屉展开；点击遮罩、抽屉顶部“收起”或“返回执行视图”可关闭。  
- 使用效果：总览界面以抽屉形式展示，不遮挡主视图，切换/回退更顺畅。  
- 新增内容/接口/组件：新增总览抽屉结构与开合逻辑。  
- 复用说明：复用原有总览渲染与状态管理，仅调整承载容器与开合交互。  
- 测试与验证：`npm run test:ui -- tests/ui/tempexec_entry.spec.js tests/ui/tempexec_view_empty.spec.js tests/ui/tempexec_drag.spec.js tests/ui/tempexec_progress.spec.js`（通过，需本地 HTTP 服务权限）。  
- 更新记录：无  
- 功能名称：用例执行导航与空态样式修订  
- 功能描述：修复“用例导入&分配”抽屉需求区子用例的删除按钮被圆角遮挡问题，执行视图空态提示改为引导前往“用例导入&分配”，功能导航卡片左侧替换为线性图标。  
- 操作方式：在“用例执行”页点击“用例导入&分配”查看需求列表，删除按钮完整可点；切换到“执行视图”卡片时空态提示直接提示去导入；功能导航卡片左侧展示对应功能图标。  
- 使用效果：删除操作不再被遮挡，空态文案更明确导向，导航卡视觉风格与页面一致且一眼区分功能。  
- 新增内容/接口/组件：导航卡片内联 SVG 图标、执行视图空态文案更新、新增 UI 自动化用例 `tests/ui/tempexec_view_empty.spec.js`。  
- 复用说明：复用现有抽屉/执行视图渲染与入口交互，仅做样式与文案微调。  
- 测试与验证：`npm run test:ui -- tests/ui/tempexec_entry.spec.js tests/ui/tempexec_view_empty.spec.js`（通过，需本地 HTTP 服务权限）。  
- 更新记录：调整需求区子用例删除按钮溢出裁剪问题，空态文案指向“用例导入&分配”抽屉。  
- 功能名称：用例执行入口导航与抽屉优化  
- 功能描述：执行视图入口区改名“功能导航”，入口按钮调整为小卡片式；抽屉宽度放大至约 2/3 页宽，遮罩区域可点击关闭，开合动效更平滑。  
- 操作方式：在“用例执行”页点击“功能导航”下的“用例导入&分配”卡片打开抽屉；点击遮罩或右上角“收起”可关闭抽屉。  
- 使用效果：入口更聚合、卡片化，抽屉空间更大，遮罩点击即可收起，过渡动画平滑不生硬。  
- 新增内容/接口/组件：入口小卡片样式 `nav-entry-card`、抽屉遮罩交互与动效调整、新增 UI 自动化用例 `tests/ui/tempexec_entry.spec.js`。  
- 复用说明：复用既有抽屉组件与入口按钮 ID，不改动导入/分配逻辑，仅增强外观与交互。  
- 测试与验证：`npm run test:ui -- tests/ui/tempexec_entry.spec.js`（通过，需本地 HTTP 服务启动权限）。  
- 更新记录：功能导航改为横向多子卡片（固定宽度约 5 个/行），进入“用例执行”时顶部一键执行步骤替换为导航栏。  
- 功能名称：用例导入&分配抽屉化  
- 功能描述：执行视图的“用例导入&分配”区域改为半屏右侧抽屉，支持随时收起/展开，保持核心功能不变。  
- 操作方式：在执行视图顶部点击“用例导入&分配”卡片按钮打开抽屉，右上角“收起”或再次点击入口可关闭；抽屉内继续完成导入、配置备份、需求/版本拖拽等操作。  
- 使用效果：抽屉默认收起，展开后悬浮在页面右侧，背景半透明遮罩不阻塞左侧操作，减少页面占用、便于复用。  
- 新增内容/接口/组件：新增可复用抽屉组件 `scripts/base/drawer.js` 与样式、执行视图入口卡片、抽屉模板结构。  
- 复用说明：复用原有执行视图状态、导入/导出与拖拽逻辑，仅调整布局并封装抽屉组件以便后续复用。  
- 测试与验证：`npm run test:ui -- tests/ui/tempexec_drag.spec.js`（通过，覆盖导入、导出、拖拽、折叠与抽屉流程）。  
- 更新记录：无  
- 功能名称：执行视图需求/版本区收起展开  
- 功能描述：执行视图中的需求区与版本分组区新增收起/展开按钮，减少视图占用，便于聚焦。  
- 操作方式：在执行视图的“需求用例组”标题行点击“收起需求区”隐藏未分配需求列表，再次点击展开；在“版本分组”标题行点击“收起版本区”隐藏版本卡片，再次点击展开。  
- 使用效果：可按需折叠列表，保持执行页面简洁，随时恢复查看并继续拖拽操作。  
- 新增内容/接口/组件：新增需求区/版本区切换按钮与折叠提示文案，复用执行视图渲染逻辑。  
- 复用说明：复用现有执行视图渲染与状态管理，仅追加折叠状态与按钮显示。  
- 测试与验证：`npm run test:ui -- tests/ui/tempexec_drag.spec.js`（通过，新增用例覆盖折叠功能）。  
- 更新记录：调整按钮为双层箭头图标（上/下重叠），折叠时自动隐藏新建版本按钮，展开按钮靠右展示。  
- 功能名称：功能指派 Temperature 配置  
- 功能描述：功能指派页面为清洗、评审、对比、拆分、覆盖对比、用例生成、相似对比等功能新增 temperature 设置，默认 0.2，可独立保存并参与模型调用。  
- 操作方式：在“功能指派”各卡片的 Temperature 输入框中填写 0~1 之间的数值（默认 0.2），保存指派后即生效。  
- 使用效果：可按功能调节模型温度，降低/提升生成随机性；旧指派数据自动兼容并回填默认值。  
- 新增内容/接口/组件：新增 temperature 输入控件、指派存储字段、模型调用温度参数。  
- 复用说明：复用原有指派保存/加载与模型调用流程，仅增加温度参数注入和存储。  
- 测试与验证：`npm run test:ui -- tests/ui/models_settings.spec.js`（通过）。  
- 更新记录：修复后端指派拉取时覆盖本地 Temperature 的问题，刷新后保持已保存值；跨设备持久化 UI 用例已补充 Temperature 覆盖（`tests/ui/models_persist_db.spec.js`）。  
- 功能名称：执行视图状态汇总筛选与抽屉联动优化  
- 功能描述：执行视图顶部状态汇总（已执行/未执行/通过/失败/阻塞/不适用）支持点击筛选列表，再次点击可取消；选中态绿色描边。点击导航区用例文件会自动收起“用例导入&分配”抽屉并滚动到执行视图，避免抽屉遮挡交互。  
- 操作方式：在执行视图点击任一状态汇总圆角块即可按状态过滤当前文件用例；再点一次恢复。需要重新查看导入区或“执行总览”时可重新打开抽屉后点击对应按钮。执行列表上方的进度工具条固定在功能导航下方，实时展示当前文件与汇总状态，并提供搜索框。  
- 使用效果：快速按执行结果查看用例，抽屉不再遮挡执行视图；当前文件筛选状态按文件维度记忆。进度工具条不随滚动消失，便于随时查看与搜索。  
- 新增内容/接口/组件：新增状态筛选存储字段与过滤逻辑、执行视图主行标记 `case-row`。  
- 复用说明：复用现有执行视图渲染与分页逻辑，仅追加筛选状态与导航点击联动。  
- 测试与验证：`npm run test:ui -- tests/ui/help_structure_drawer.spec.js tests/ui/tempexec_drag.spec.js`（通过）。  
- 更新记录：无  
- 功能名称：模型配置与指派缺失提示 / DeepSeek Reasoner Token 推荐  
- 功能描述：侧边“模型管理”“功能指派”页签在缺少模型或指派时显示红色提示；模型管理页推荐配置行动态提示 deepseek-reasoner 的 Max Tokens 推荐值，点击可跳转对应模型编辑。  
- 操作方式：未配置模型时在对应页签显示“未配置模型”，有未保存指派的功能时在“功能指派”显示“未保存指派模型”，指派后消失；当存在 deepseek-reasoner 且 Max Tokens < 16384 时，推荐配置行显示红色提示，点击跳转到该模型。  
- 使用效果：显式引导用户补全模型配置与指派，提升首次使用可达性；Token 提示避免输出截断。  
- 新增内容/接口/组件：页签提示徽标、动态 Token 提示点击跳转逻辑。  
- 复用说明：复用现有模型渲染/指派状态与表单跳转逻辑，仅新增提示判断。  
- 测试与验证：`npm run test:ui -- tests/ui/models_settings.spec.js`（通过），`npm run test:ui -- tests/ui/tempexec_drag.spec.js`（通过）。  
- 更新记录：无  
- 功能名称：执行视图用例 XMind 导出分离  
- 功能描述：用例执行视图新增“导出用例XMind（无结果）”，与现有“导出执行XMind”区分，前者不包含执行结果/备注/缺陷，后者保持原逻辑。  
- 操作方式：在执行视图选择用例后点击“导出用例XMind（无结果）”即可导出纯用例结构；包含结果的导出仍使用“导出执行XMind”。  
- 使用效果：便于下游仅需用例结构时快速导出简版 XMind，避免混入执行结果。  
- 新增内容/接口/组件：新增导出按钮与纯用例 XMind 构建逻辑。  
- 复用说明：复用现有执行用例与 XMind 构建能力，导出前剔除执行字段。  
- 测试与验证：`npm run test:ui -- tests/ui/tempexec_drag.spec.js`（通过）。  
- 更新记录：无  
- 功能名称：执行总览当前执行区  
- 功能描述：用例执行总览新增“当前执行区”，独立展示当前激活用例的进度卡片，便于快速查看当前执行状态。  
- 操作方式：在“用例执行总览”卡片顶部查看当前执行区；切换当前用例后自动更新。  
- 使用效果：一眼确认当前执行用例及进度，版本区/需求区保持原布局。  
- 新增内容/接口/组件：总览渲染增加当前执行区分段。  
- 复用说明：复用现有执行进度汇总方法，新增分区组合。  
- 测试与验证：`npm run test:ui -- tests/ui/tempexec_drag.spec.js`（通过）。  
- 更新记录：无  
- 功能名称：顶栏粘顶区域修复  
- 功能描述：侧边页签导航、AI一键需求&用例评审步骤、用例执行页的功能导航与当前文件工具条恢复粘顶，滚动页面不再被带走；侧边页签上移，保证视口内始终可见。  
- 操作方式：正常滚动页面，侧边页签与评审步骤条、执行导航与工具条保持在顶部；侧边“使用帮助”按钮仍可直接打开说明。  
- 使用效果：关键导航区随滚动固定在视口顶部，避免频繁回滚查找；执行导航与工具条在切换文件后保持可见。  
- 新增内容/接口/组件：新增 UI 用例 `tests/ui/sticky_layout.spec.js`；调整 `style.css` 粘顶变量与侧边 tabs 样式；侧边 tabs 位置提前。  
- 复用说明：复用既有粘顶样式变量与执行导航布局，仅调整位置与层级。  
- 测试与验证：`npm run test:ui -- tests/ui/sticky_layout.spec.js tests/ui/tempexec_sticky.spec.js`（通过）。  
- 更新记录：修复滚动粘顶失效问题。  
- 功能名称：功能工作流导航多步骤独立运行态  
- 功能描述：顶部步骤导航支持多个步骤同时处于“执行中”，后续步骤开始时不会把先前运行步骤重置为未开始，运行态以描边高亮独立显示。  
- 操作方式：在功能工作流中并行或重复触发各步骤模型调用，导航按各自运行状态独立显示。  
- 使用效果：并行执行时各步骤运行状态互不干扰，用户能同时看到多个步骤的进行中状态。  
- 新增内容/接口/组件：状态存储新增 `state.inProgressSteps`，导航渲染按多步运行态计算。  
- 复用说明：复用原状态映射，扩展运行态字典。  
- 测试与验证：`npm run test:ui -- tests/ui/workflow.spec.js`（通过）。  
- 功能名称：用例生成直达执行按钮优化  
- 功能描述：“勾选用例到执行页”移动到“前往测试模块拆分”右侧，未拆分、未生成或未勾选时给出对应提示，取消合并确认时自动滚动到页顶。  
- 操作方式：在用例生成页点击右上角按钮，按提示完成拆分/生成/勾选后再转到执行页。  
- 使用效果：入口更易发现，提示更具体，交互引导清晰。  
- 新增内容/接口/组件：按钮位置调整，提示文案细化。  
- 复用说明：复用既有转执行逻辑，仅调整提示与入口。  
- 测试与验证：`npm run test:ui -- tests/ui/casegen_append_existing.spec.js`（通过）。  
- 功能名称：用例追加目标多文件支持与直接转执行  
- 功能描述：用例生成页追加下拉可按导入文件逐份选择（显示文件名而非“功能工作流导入用例”），并新增“勾选用例到执行页”按钮：无导入/历史执行时直接将勾选用例整体转到执行页；存在导入或执行历史时二次确认，支持跳过合并直接使用勾选用例。  
- 操作方式：在用例生成右上角选择框中选择具体导入用例，或勾选用例后点击“勾选用例到执行页”，有导入/历史执行时按提示确认。  
- 使用效果：多份工作流导入用例可独立追加，避免只能选第一份；可一次性将勾选用例转入执行页，跳过合并流程。  
- 新增内容/接口/组件：追加目标选项构造支持多份导入；新增全局按钮 `#transferSelectedToExec` 及 `transferSelectedCasesToExec` 逻辑（创建执行文件/跳转执行页）；追加逻辑保存选中的工作流文件。  
- 复用说明：复用原用例去重与执行同步逻辑，补充目标筛选与直接创建执行文件分支。  
- 测试与验证：`npm run test:ui -- tests/ui/casegen_append_existing.spec.js`（通过）。  
- 功能名称：用例生成视图抽屉与新增入口优化  
- 功能描述：用例生成卡片的“用例视图”移动到右侧并改为抽屉展示，勾选后可直接通过右上方下拉+“确认新增”按钮追加到导入用例/执行历史。  
- 操作方式：在“用例生成”选择模块生成后，点击右侧“用例视图”打开抽屉勾选用例，再在顶部“用例视图中勾选用例，新增 到”处选择目标用例并点击“确认新增”。  
- 使用效果：视图入口更显眼且不占页面高度，抽屉模式便于集中操作；勾选状态与新增按钮联动，减少误操作。  
- 新增内容/接口/组件：新增 caseGenViewDrawer DOM 与事件委托，保留原表格渲染与追加逻辑；用例视图按钮样式调整。  
- 复用说明：复用原有用例表格渲染/选择/追加逻辑，新增抽屉容器与按钮布局。  
- 测试与验证：`npm run test:ui -- tests/ui/casegen_append_existing.spec.js`（通过）。  
- 功能名称：抽屉遮罩下保持导航可见  
- 功能描述：在功能工作流与一键执行页面打开视图抽屉时，左侧页签/顶部导航不会被移除或遮挡，始终在遮罩下可见，遮罩仍覆盖 100% 背景。  
- 操作方式：在功能工作流或一键执行页点击各视图入口打开抽屉，页签与导航保持可见。  
- 使用效果：抽屉打开时导航区域不再消失，用户能持续看到当前页签与步骤提示，遮罩阻止背景交互。  
- 新增内容/接口/组件：新增 UI 用例 `tests/ui/drawer_nav_visibility.spec.js`（覆盖功能工作流与用例执行抽屉）。  
- 复用说明：复用既有抽屉组件与布局，调整遮罩可见性校验。  
- 测试与验证：`npm run test:ui -- tests/ui/drawer_nav_visibility.spec.js`（通过）。  
- 更新记录：无  
- 功能名称：功能工作流视图抽屉化  
- 功能描述：评审澄清视图、清洗结果视图、拆分视图、测试用例视图、缺失模块视图统一改为抽屉展示，视图入口移至右侧按钮，相关操作（澄清确认、缺失复制/智能填充、高亮、原文定位等）在抽屉内完成。  
- 操作方式：在对应卡片点击“展开/打开”按钮唤起抽屉，内部可继续操作高亮、复制、确认澄清、复制缺失等；通过抽屉右上角收起。  
- 使用效果：视图更聚焦且不占主工作区，重要操作与视图并列集中，减少滚动与遮挡。  
- 新增内容/接口/组件：review/clean/split/case/missing 视图抽屉 DOM 与 drawer 管理逻辑，按钮文案调整。  
- 复用说明：保留原渲染与交互逻辑，仅更换承载容器与开关方式。  
- 测试与验证：`npm run test:ui -- tests/ui/workflow.spec.js`（通过）。  
- 更新记录：无  
- 功能名称：模型/指派/设置跨设备持久化修复  
- 功能描述：模型保存后写入后端 ID 并同步功能指派，设置面板的列显示/分页配置落库，多端登录自动加载已保存的模型指派与执行视图配置。  
- 操作方式：正常在模型管理/功能指派/设置页保存，换设备登录后模型列表、指派选择、执行视图列与分页会从后端恢复；分页保存按钮已可用。  
- 使用效果：模型与功能指派稳定跨设备复用，执行视图列与分页不再依赖浏览器缓存。  
- 新增内容/接口/组件：更新模型/指派持久化逻辑（`scripts/modules/models.js`）、补充分页保存事件绑定（`scripts/modules/settings.js`）、扩展后端设置用例（`tests/api/settings_models.spec.js`）、新增跨设备持久化 UI 用例（`tests/ui/models_persist_db.spec.js`）。  
- 复用说明：复用现有 API 客户端与后端接口，补充 ID 正常化、指派映射与事件绑定，无新增外部依赖。  
- 测试与验证：`npx playwright test --config tests/api/playwright.api.config.js tests/api/settings_models.spec.js`（通过，本地 FastAPI 服务）；`PLAYWRIGHT_BASE_URL=http://127.0.0.1:8090 npx playwright test tests/ui/models_persist_db.spec.js`（通过，本地静态服+Mock API）。  
- 更新记录：补充功能指派 Temperature 字段跨设备持久化与刷新不回退修复；修复模型保存重复创建远端记录的问题；修复执行页导入配置/执行视图分页调整未落库导致跨设备不同步；修复不同账号间本地缓存与远端合并导致的配置串用，现按账号隔离。  

- 功能名称：其他设置跨设备同步修复（用户设置合并鲁棒性）  
- 功能描述：修复“其他设置/设置页”保存后跨设备不生效/互相覆盖的问题：远端 user scoped 设置合并时不再依赖 currentUser.id 的严格类型/时序，支持 id 为字符串或未就绪的情况；登录态改为 DB-first（有 token 时忽略本地 settings 缓存，避免多端同号本地旧值抢占）；已登录会话在重新获得焦点/从后台返回时会自动拉取远端最新设置；每个保存按钮仅提交对应设置项，避免不同设备的旧值覆盖最新配置；未点击保存的草稿在 UI 保留但不生效，刷新页面会回退到最后保存数据。  
- 操作方式：两台电脑同号登录后，在“设置/其他设置”中修改分页/列显示并点击对应保存按钮；另一端重新登录或刷新/回到页面后，会以最后一次点击保存的数据为准；未点击保存的修改不会入库，刷新后回到原配置。  
- 使用效果：设置项稳定落库并跨设备一致，最后保存优先；草稿不影响生效配置且不会被远端刷新立即清空。  
- 新增内容/接口/组件：调整 `scripts/modules/settings.js` 的 settings 加载策略（DB-first）与草稿脏态保护；设置保存改为按 key 粒度提交；`scripts/core/tempexecCore.js` 按 key 粒度持久化分页/列；更新跨设备持久化 UI 用例 `tests/ui/models_persist_db.spec.js` 增加“登录态忽略本地缓存”“未保存草稿刷新回退”“回到页面刷新远端设置”“单项保存不覆盖其他项”等场景。  
- 复用说明：复用现有 `/api/settings`、`/api/features` 接口与前端持久化入口，仅增强合并与渲染时序。  
- 测试与验证：`node --check scripts/modules/settings.js scripts/modules/models.js`（通过）；`npx playwright test tests/ui/models_persist_db.spec.js -c tests/playwright.config.js`（通过）。  
- 更新记录：修复设置页保存后跨设备不同步问题；增强用户设置/指派合并容错；补充已登录会话回到页面自动刷新远端设置；修复跨设备交替保存导致的旧值覆盖。  

- 功能名称：登录态刷新保持当前页签（会话级）  
- 功能描述：在已登录状态下刷新 `index.html` 会恢复到刷新前最后一次打开的页签；登出/重新登录后不再沿用旧页签，回到系统默认页签。该页签状态仅在当前浏览器会话内生效，不入库。  
- 操作方式：登录后切换到任意页签（如“用例执行”）→刷新页面，仍停留在该页签；点击“登出”后重新登录，页面回到默认页签。  
- 使用效果：刷新不打断当前工作上下文；重新登录保持一致的默认入口，避免跨账号/跨会话的页签残留。  
- 新增内容/接口/组件：`scripts/core/appRuntime.js` 切换页签时写入/初始化时读取 `sessionStorage(usecase-active-tab)`；`scripts/modules/authGuard.js` 登录态初始化优先读取 sessionStorage 以恢复页签；`scripts/modules/login.js` 登录与登录页初始化时清理该 key；新增 UI 用例 `tests/ui/tab_persistence.spec.js`、`tests/ui/login_tab_reset.spec.js` 覆盖刷新保持/重登回默认。  
- 复用说明：复用现有页签切换与鉴权流程，仅调整持久化介质为 sessionStorage 并补充初始化读取。  
- 测试与验证：`node --check scripts/core/appRuntime.js scripts/modules/authGuard.js scripts/modules/login.js`（通过）；`npx playwright test tests/ui/tab_persistence.spec.js tests/ui/login_tab_reset.spec.js -c tests/playwright.config.js`（通过）。  
- 更新记录：无  

- 功能名称：刷新恢复页签时自动加载“管理类”页面数据（项目/人员/操作记录）  
- 功能描述：修复“登录态刷新后虽然停留在项目管理/人员管理/操作记录页签，但列表数据为空，需要再点一次页签才加载”的问题：页签恢复/切换时统一派发 `app-tab-activated` 事件，管理类模块在激活时自动拉取数据；同时登出后跳转登录页不再携带退出时 URL，保证重登必回主页(auto)。  
- 操作方式：登录后进入“项目管理/人员管理/操作记录”任一页签→刷新页面，仍停留在该页签且列表会自动加载；点击“登出”→重新登录，默认回到主页(auto)。  
- 使用效果：刷新不需要二次点击即可恢复页面数据；登出重登不再残留上次页签/页面 URL。  
- 新增内容/接口/组件：`scripts/core/appRuntime.js` 与 `scripts/modules/authGuard.js` 在页签切换时派发 `CustomEvent(app-tab-activated)`；`scripts/modules/admin.js`、`scripts/modules/opsLog.js` 监听该事件并在激活时加载数据（并补充 `app-auth-ready` 兜底触发）；`scripts/modules/authGuard.js` 默认页签策略统一为 `auto` 且登出跳转不携带 redirect；新增 UI 用例 `tests/ui/project_admin_refresh_restore.spec.js`，并增强 `tests/ui/project_admin_drawer.spec.js`、`tests/ui/login_tab_reset.spec.js` 的等待条件以降低时序抖动。  
- 复用说明：复用既有 `switchTab`/鉴权流程，不新增业务 API，仅补充统一事件钩子让已有页面逻辑在“恢复页签”场景下也能触发加载。  
- 测试与验证：`node --check scripts/core/appRuntime.js scripts/modules/authGuard.js scripts/modules/admin.js scripts/modules/opsLog.js scripts/base/state.js`（通过）；`npx playwright test --config tests/playwright.config.js tests/ui/project_admin_refresh_restore.spec.js tests/ui/login_tab_reset.spec.js tests/ui/project_admin_drawer.spec.js --workers=1`（通过）。  
- 更新记录：改为“登录会话隔离”策略：引入 `localStorage(tap-login-seq)` 与 `sessionStorage(tap-active-tab-login-seq)`，仅在同一次登录会话内恢复页签；显式登出同时写入 local/session `tap-force-default-tab` 强制下一次进入回主页；并修复刷新后在鉴权未就绪前进入“项目管理/人员管理/操作记录”导致首次空列表的问题（鉴权就绪后自动补加载）；后端静态资源增加 `Cache-Control: no-store`，避免浏览器/代理缓存旧 JS 导致“已更新但仍像旧版本”；修复 `tap-force-default-tab` 在 sessionStorage 已命中时未同步清理 localStorage，导致“重新登录后第一次切页刷新仍回主页，需要第二次才正常”的问题；更新 UI 用例 `tests/ui/login_tab_reset.spec.js` 覆盖该回归。  

- 功能名称：执行总览页接入后端聚合接口（项目卡片/版本筛选/人员汇总/用例明细）  
- 功能描述：补齐“执行总览”页签的 DB 接入能力：登录后展示所属项目卡片；选择项目后可按版本筛选，按人员展示执行统计，并支持展开查看用例明细列表（最多 200 条）。  
- 操作方式：登录 → 进入“执行总览” → 选择项目 →（可选）选择版本 → 查看人员统计 → 点击“查看用例”展开明细。  
- 使用效果：无需依赖浏览器缓存即可查看项目/版本维度的执行进度，且能快速定位到具体用例明细。  
- 新增内容/接口/组件：新增前端模块 `scripts/modules/execOverview.js` 与执行总览 DOM/样式（`index.html`、`style.css`）；扩展 `services/apiClient.js`（`listProjectVersions/getExecutionOverview/listExecutionOverviewCases`）；后端扩展 `/api/exec/overview` 返回 `username`，并新增 `/api/exec/overview/cases` 明细接口（`backend/routers/exec_routes.py`、`backend/schemas.py`）。  
- 复用说明：复用既有鉴权/项目权限校验、`app-tab-activated/app-auth-ready` 事件钩子与 API client 封装方式；后端复用现有 exec_set/exec_case 数据结构，仅补齐总览读取接口。  
- 测试与验证：`node --check services/apiClient.js scripts/modules/execOverview.js`（通过）；`npm run test:ui -- tests/ui/exec_overview.spec.js`（通过）；`npx playwright test --config tests/api/playwright.api.config.js tests/api/exec_overview.spec.js`（通过，本地 FastAPI 服务）。  
- 更新记录：补充 SQLite 轻量迁移：启动时自动为历史库给 `exec_cases` 增加缺失的 `executor_id` 列，避免出现 `no such column: exec_cases.executor_id` 导致的 500（`backend/migrations.py`、`backend/main.py`）。  

- 功能名称：项目管理同名项目错误提示显示在抽屉内  
- 功能描述：修复“新建项目时项目名已存在，但错误提示显示在列表页顶部，用户在抽屉内难以发现”的问题：同名/校验类错误统一展示在项目抽屉内。  
- 操作方式：进入“项目管理”→“新建项目”→输入已存在的项目名→点击保存；错误提示出现在抽屉内。  
- 使用效果：用户无需视线跳转即可在当前抽屉内看到失败原因，减少误以为无响应。  
- 新增内容/接口/组件：项目抽屉新增状态位 `#projectFormStatus`（`index.html`），并调整 `scripts/modules/admin.js` 的项目保存提示位置；新增 UI 用例 `tests/ui/project_admin_duplicate_error_in_drawer.spec.js`。  
- 复用说明：复用现有状态提示 `setStatus` 与抽屉交互逻辑，仅调整提示展示容器。  
- 测试与验证：`node --check scripts/modules/admin.js`（通过）；`npm run test:ui -- tests/ui/project_admin_duplicate_error_in_drawer.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：模型管理新增模型同名校验与删除二次确认  
- 功能描述：新增模型保存时做名称同名校验（避免重复模型名导致指派混乱/远端保存失败）；删除模型需二次确认后才会执行删除。  
- 操作方式：在“模型管理”新增模型时输入与已有模型相同的模型名称并保存，会在表单内提示“模型名称已存在”；删除模型时会弹出两次确认。  
- 使用效果：避免重复模型名引发误选/覆盖；删除操作更安全，降低误删概率。  
- 新增内容/接口/组件：`scripts/modules/models.js` 增加 `normalizeModelName/hasDuplicateModelName` 校验逻辑；新增 UI 用例 `tests/ui/models_name_duplicate_and_delete_confirm.spec.js`。  
- 复用说明：复用现有模型表单与状态提示 `setStatus`、列表删除入口，仅增加校验与确认。  
- 测试与验证：`node --check scripts/modules/models.js`（通过）；`npm run test:ui -- tests/ui/models_name_duplicate_and_delete_confirm.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：项目管理/人员管理页面使用独立顶部导航栏  
- 功能描述：进入“项目管理/人员管理”时不再展示默认的“AI 一键步骤”导航栏，改为各自页面的顶部导航栏；并将“新建/新增、刷新”等操作按钮移入顶部导航栏，样式与执行页导航卡片一致。  
- 操作方式：进入“管理 → 项目管理/人员管理”，顶部显示本页导航卡片按钮；点击“新建项目/新增人员”在抽屉内新增，点击“刷新”重新拉取列表。  
- 使用效果：管理页顶部区域更聚焦于当前页面操作，减少与 AI 工作流导航的混淆；按钮位置统一且更易发现。  
- 新增内容/接口/组件：新增 `#projectAdminHead/#userAdminHead` 顶部导航 DOM（`index.html`），并调整页签切换时隐藏默认 `#flowNav`（`scripts/core/appRuntime.js`）；为稳定自动化用例补充管理模块就绪标记 `window.app.adminBound`（`scripts/modules/admin.js`）；更新 UI 用例（`tests/ui/project_admin_drawer.spec.js`、`tests/ui/user_admin_drawer.spec.js`）。  
- 复用说明：复用现有 `projectRefreshBtn/projectCreateBtn/userRefreshBtn/userCreateBtn` 事件绑定与权限控制逻辑，仅调整 DOM 位置与展示方式。  
- 测试与验证：`npm run test:ui -- tests/ui/project_admin_drawer.spec.js`（通过）；`npm run test:ui -- tests/ui/user_admin_drawer.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：抽屉收起时遮罩同步优化  
- 功能描述：修复“收起抽屉瞬间侧边栏先解除遮罩/可交互，主区域稍后才结束过渡”导致的突兀体验：关闭抽屉时增加 closing 过渡状态，直到遮罩/面板过渡结束后再统一解除 `drawer-open` 与交互阻断。  
- 操作方式：打开任意抽屉（执行抽屉/管理抽屉/视图抽屉等）→点击遮罩或“收起”关闭；侧边栏与主区域会在同一时刻结束遮罩与交互阻断。  
- 使用效果：关闭动画期间整体遮罩保持一致，不出现“侧边栏先亮起来”的视觉跳变。  
- 新增内容/接口/组件：抽屉组件新增 `.closing` 状态与关闭过渡结束后再解锁逻辑（`scripts/base/drawer.js`、`style.css`）；补齐 DOM 映射 `exportCaseGen`（`config/domConfig.js`）；更新并加固 UI 用例等待与菜单展开逻辑（`tests/ui/user_admin_drawer.spec.js`、`tests/ui/workflow.spec.js`）。  
- 复用说明：复用现有抽屉 DOM/CSS 结构与 `drawer-open` 机制，仅增加 closing 状态以同步关闭时序。  
- 测试与验证：`npm run test:ui -- tests/ui/project_admin_drawer.spec.js tests/ui/user_admin_drawer.spec.js tests/ui/workflow.spec.js`（3 workers 并发通过）。  
- 更新记录：无  

- 功能名称：执行总览页面独立顶部导航（项目按钮上移）  
- 功能描述：进入“执行总览”时不再展示默认的“AI 一键步骤”导航栏，改为执行总览自己的顶部导航栏；顶部导航按“当前用户可访问/所属项目”动态渲染项目按钮（例如战魂铭人、元气骑士），点击即可进入对应项目总览；并保留“刷新”入口以重新拉取项目/总览数据。  
- 操作方式：进入“用例相关 → 执行总览”→顶部展示所属项目按钮列表→点击项目按钮进入详情→可切换项目/返回列表/按版本筛选/查看用例明细；点击“刷新”会更新项目列表并刷新当前详情数据。  
- 使用效果：执行总览的入口更聚焦且更快，减少在页面内寻找项目卡片的成本，符合执行页导航卡片的一致交互。  
- 新增内容/接口/组件：新增执行总览顶部导航 DOM（`index.html`），项目按钮容器 `#execOverviewNavProjects`；执行总览改为在顶部渲染项目按钮并绑定切换逻辑（`scripts/modules/execOverview.js`）；页签切换时隐藏默认 `#flowNav`（`scripts/core/appRuntime.js`）；补充样式 `display: contents` 以便项目按钮与导航卡片同排展示（`style.css`）；更新 UI 用例覆盖“两项目按钮/切换项目/版本筛选/用例明细”（`tests/ui/exec_overview.spec.js`）。  
- 复用说明：复用现有 `listProjects/listProjectVersions/getExecutionOverview` 接口与导航卡片样式 `nav-entry-card`，仅调整渲染位置与交互入口。  
- 测试与验证：`npm run test:ui -- tests/ui/exec_overview.spec.js tests/ui/project_admin_drawer.spec.js tests/ui/user_admin_drawer.spec.js`（3 workers 并发通过）。  
- 更新记录：美化执行总览版本选择框样式（`style.css`）。  

- 功能名称：用例库导入/编辑/转执行全链路（DB 接入）  
- 功能描述：用例库页新增独立顶部导航卡片（导入用例/编辑用例&转到执行/选择用例执行）取代默认“AI 一键步骤”；用例库接入后端 DB：导入需选项目+版本（同名校验按“项目级”，同一项目跨版本不允许同名；文件名清洗去导出标识与后缀并记录导入人）；编辑抽屉按项目拉取文件列表（展示导入人/导入时间/最近更新人/更新时间）；进入编辑后在页内“用例编辑视图卡片”复用执行视图样式与交互（无缺陷链接），支持搜索/分页/内容编辑与增删撤回（超时入库）；支持一键“转到执行”，同名覆盖提示并按“模块+标题+预期”保留执行结果字段。  
- 操作方式：进入“用例相关 → 用例库”→顶部点“导入用例”选择文件→选择项目→选择版本→确认入库；点“编辑用例&转到执行”选择项目→确认→列表点“编辑”进入页内编辑卡片→直接点表格内容修改/点＋/−增删（可 8s 撤回）→点“转到执行”；点“选择用例执行”选择项目与版本→确认→列表点“转到执行”。  
- 使用效果：用例库入口聚合到顶部导航，导入/维护更聚焦；用例条目可持续入库维护，并可快速转入执行页且尽量保留已有执行结果。  
- 新增内容/接口/组件：用例库导航/抽屉/编辑卡片与样式（`index.html`、`style.css`）；用例库交互模块（`scripts/modules/caseLibrary.js`）；暴露执行页能力供用例库复用（`scripts/modules/app.js`）；切页时隐藏默认 `#flowNav`（`scripts/core/appRuntime.js`）；后端文件名清洗（`backend/utils.py`）；用例文件列表补充导入人与最近更新人字段（`backend/schemas.py`、`backend/routers/cases.py`）；新增用例条目增删接口并支持可选字段置空入库（`backend/routers/cases.py`、`services/apiClient.js`）；执行集追加接口批次内去重保护（`backend/routers/exec_routes.py`）；健康检查返回 DB 文件名（`backend/api.py`）；新增自动化（`tests/ui/case_library.spec.js`、`tests/api/case_library.spec.js`、`tests/fixtures/case_library_import.json`）。  
- 复用说明：复用现有抽屉组件 `window.app.drawer`、执行视图样式/分页设置（`state.tempExecPageSize`）、以及执行页文件结构创建能力（`window.app.tempExecApi.createTempExecFile`），仅在用例库侧封装“同名覆盖/保留结果/增删撤回入库”的流程。  
- 测试与验证：`node --check scripts/base/state.js scripts/base/utils.js scripts/modules/app.js scripts/modules/bootstrap.js scripts/modules/caseLibrary.js services/apiClient.js`（通过）；`npm run test:ui -- tests/ui/case_library.spec.js`（通过）；API：`APP_DB_FILE=apitest.db python3.9 -m uvicorn backend.main:app --host 127.0.0.1 --port 18081` 启动测试服务后执行 `API_BASE_URL=http://127.0.0.1:18081 npx playwright test --config tests/api/playwright.api.config.js tests/api/case_library.spec.js`（通过，健康检查断言使用测试库）。  
- 更新记录：美化用例库项目/版本选择框样式，并为项目选择框设置最小宽度确保 6 个中文项目名完整展示（`style.css`）。  

- 功能名称：用例库选择项目自动刷新（免确认）  
- 功能描述：用例库的“编辑用例&转到执行”抽屉与“选择用例执行”抽屉，在选择项目后自动加载用例文件列表并同步版本下拉；选择版本后立即过滤列表；原“确认”按钮保留为可选“刷新”。  
- 操作方式：进入“用例相关 → 用例库”→打开对应抽屉→选择项目后列表自动刷新；（可选）选择版本过滤；如需手动重拉，点“刷新”。  
- 使用效果：减少一次无意义点击，项目/版本选择的反馈更及时。  
- 新增内容/接口/组件：选择执行抽屉加载状态渲染修复与自动加载逻辑（`scripts/modules/caseLibrary.js`）；按钮文案调整（`index.html`）。  
- 复用说明：复用现有 `listCaseFiles/listProjectVersions` 接口与抽屉组件，未新增新接口。  
- 测试与验证：`node --check scripts/modules/caseLibrary.js`（通过）；`npm run test:ui -- tests/ui/case_library.spec.js`（通过）；回归 `npm run test:ui -- tests/ui/project_changes_refresh_import_selects.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：编辑抽屉版本筛选（默认全部）  
- 功能描述：在“编辑用例&转到执行”抽屉增加版本选择框，默认“全部版本”；选择版本可快速筛选该版本下的用例文件，便于定位。  
- 操作方式：进入“用例相关 → 用例库”→点“编辑用例&转到执行”→选择项目后，版本下拉自动启用→选择版本即可过滤列表（默认全部）。  
- 使用效果：项目下用例文件较多时，可通过版本快速缩小范围。  
- 新增内容/接口/组件：编辑抽屉新增版本下拉与前端过滤逻辑（`index.html`、`scripts/modules/caseLibrary.js`）；UI 用例新增版本筛选覆盖（`tests/ui/case_library.spec.js`）。  
- 复用说明：复用现有版本缓存与 `loadVersions/listCaseFiles` 拉取逻辑，仅在前端做过滤。  
- 测试与验证：`node --check scripts/modules/caseLibrary.js`（通过）；`npm run test:ui -- tests/ui/case_library.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：用例库编辑视图移除实际结果字段  
- 功能描述：用例库的“用例编辑视图”不展示“实际结果/执行结果”列与控件，避免用例库携带执行态信息。  
- 操作方式：进入“用例相关 → 用例库”→编辑任一用例文件→表格仅保留模块/标题/前提/步骤/预期/备注等字段。  
- 使用效果：用例库视图更贴近“标准用例库”的定位，不与执行页面字段混淆。  
- 新增内容/接口/组件：移除编辑视图表头与行内“实际结果”列（`scripts/modules/caseLibrary.js`）；UI 用例增加断言确保不出现该列（`tests/ui/case_library.spec.js`）。  
- 复用说明：复用既有编辑表格结构，仅删除与执行态相关的展示列。  
- 测试与验证：`node --check scripts/modules/caseLibrary.js`（通过）；`npm run test:ui -- tests/ui/case_library.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：用例导入同名限制升级为项目级（跨版本拦截）  
- 功能描述：用例导入时同名校验从“项目+版本”调整为“项目级”：同一项目下，不同版本若存在同名用例文件也会提示“同名用例已存在”并拒绝导入。  
- 操作方式：导入用例时选择项目/版本→若该项目任意版本已存在同名用例文件，则导入直接失败并提示“同名用例已存在”。  
- 使用效果：避免同一项目内不同版本出现同名用例文件导致检索/复用歧义。  
- 新增内容/接口/组件：后端导入接口按项目级校验（`backend/routers/cases.py`）；新库/迁移补充项目级唯一索引（`backend/models.py`、`backend/migrations.py`）；同步 UI 测试桩逻辑（`tests/ui/case_library.spec.js`、`tests/ui/tempexec_import_confirm.spec.js`）与 API 用例（`tests/api/case_library.spec.js`）。  
- 复用说明：复用现有导入流程与错误提示，调整同名判定维度；DB 侧用唯一索引增强约束。  
- 测试与验证：UI：`npm run test:ui -- tests/ui/case_library.spec.js tests/ui/tempexec_import_confirm.spec.js`（通过）；API：`APP_DB_FILE=apitest.db python3.9 -m uvicorn backend.main:app --host 127.0.0.1 --port 18082` 后执行 `API_BASE_URL=http://127.0.0.1:18082 npx playwright test --config tests/api/playwright.api.config.js tests/api/case_library.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：用例库编辑抽屉批量导出 XMind/Excel（不含执行结果、原名导出）  
- 功能描述：“编辑用例&转到执行”抽屉内增加“导出XMind”“导出Excel”按钮，所有角色均可勾选用例文件并批量导出；导出内容与用例库字段一致且不包含执行结果；单份导出文件名使用用例原名（不追加时间戳/额外后缀），多份导出打包为 zip。  
- 操作方式：进入“用例相关 → 用例库”→点“编辑用例&转到执行”→选择项目后在列表勾选 1 份或多份→点击“导出XMind”或“导出Excel”；单份下载“用例名.xmind / 用例名.xlsx”，多份下载“用例批量导出_xmind.zip / 用例批量导出_excel.zip”。  
- 使用效果：非管理员也可按需勾选导出；批量导出避免重复下载与命名混乱；导出文件不混入执行态字段。  
- 新增内容/接口/组件：导出按钮移动到编辑抽屉并常驻（`index.html`）；编辑抽屉列表对所有角色展示勾选框（删除仍仅管理员可见/可用）；批量导出逻辑（XMind 复用 `xmindCoreApi.buildXmindPackageFromCases`，Excel 生成 xlsx，批量打包 zip）（`scripts/modules/caseLibrary.js`）；UI 用例新增“非管理员批量导出”覆盖（`tests/ui/case_library.spec.js`）。  
- 复用说明：复用现有 `listCaseItems`、XMind 生成逻辑与本地 `JSZip`，未新增外部依赖。  
- 测试与验证：`node --check scripts/modules/caseLibrary.js`（通过）；`npm run test:ui -- tests/ui/case_library.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：用例库编辑视图刷新恢复（保持选中用例）  
- 功能描述：在已登录状态下，进入“用例库 → 编辑用例&转到执行”并打开某个用例文件的编辑视图后，刷新页面会自动恢复到上次选中的用例文件并保持编辑视图展示。  
- 操作方式：在用例库编辑列表点击“编辑”进入用例编辑视图→直接刷新浏览器→仍展示上次用例编辑视图。  
- 使用效果：避免刷新导致上下文丢失，提升连续编辑体验。  
- 新增内容/接口/组件：用例库记录并恢复 `case_file_id`（localStorage：`tap-case-library-editor`）（`scripts/modules/caseLibrary.js`）；UI 用例新增刷新恢复覆盖并加固 `waitForFunction` 时序（`tests/ui/case_library.spec.js`）。  
- 复用说明：复用现有 `listCaseFiles/listCaseItems/loadVersions` 接口与页签激活事件，仅增加轻量持久化与恢复流程。  
- 测试与验证：`node --check scripts/modules/caseLibrary.js`（通过）；`npm run test:ui -- tests/ui/case_library.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：用例库编辑抽屉刷新恢复（保持项目/版本/勾选/打开态）  
- 功能描述：在已登录状态下，打开“编辑用例&转到执行”抽屉并选择项目/版本、勾选用例文件后，刷新页面仍会自动打开抽屉并恢复上次的项目/版本选择与勾选状态。  
- 操作方式：进入“用例相关 → 用例库”→点“编辑用例&转到执行”→选择项目/版本并勾选若干用例→直接刷新浏览器→抽屉自动打开且选择/勾选保持不变。  
- 使用效果：避免刷新导致抽屉筛选上下文与勾选丢失，提升连续导出/编辑/转执行的效率。  
- 新增内容/接口/组件：编辑抽屉状态持久化（localStorage：`tap-case-library-edit-drawer`，含 `project_id/version_id/selected_ids/drawer_open`）（`scripts/modules/caseLibrary.js`）；持久化写入保护（避免初始化阶段覆盖成空）；`switchTab` 重复切到当前页签不再强制关闭抽屉，减少误关（`scripts/core/appRuntime.js`）；UI 用例新增“刷新恢复”覆盖（`tests/ui/case_library.spec.js`）。  
- 复用说明：复用既有抽屉组件与项目/版本加载逻辑，仅增加轻量持久化与恢复流程。  
- 测试与验证：`node --check scripts/modules/caseLibrary.js scripts/core/appRuntime.js`（通过）；`npm run test:ui -- tests/ui/case_library.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：用例库列表项目/版本展示修复（避免项目#null）  
- 功能描述：用例库“编辑用例&转到执行/选择用例执行”列表的“所属项目/版本”列，改为优先使用用例文件行数据的 `project_id/version_id` 渲染，避免在刷新恢复或状态波动时出现“项目#null”“版本#10”这类异常展示。  
- 操作方式：进入用例库相关抽屉，勾选/切换/刷新后列表的所属项目与版本展示保持正常。  
- 使用效果：列表信息更稳定，避免误判用例归属。  
- 新增内容/接口/组件：列表渲染逻辑调整（`scripts/modules/caseLibrary.js`）。  
- 复用说明：复用既有项目/版本缓存与 `getVersionName`，仅调整取值优先级。  
- 测试与验证：`node --check scripts/modules/caseLibrary.js`（通过）；`npm run test:ui -- tests/ui/case_library.spec.js -g 编辑抽屉`（通过）。  
- 更新记录：无  

- 功能名称：用例导入同名差异对比抽屉（Git 风格 Diff）  
- 功能描述：用例库导入时，若后端返回“同名用例已存在”，会自动关闭导入抽屉并打开新的“差异对比”抽屉：左侧展示本次导入解析结果，右侧展示库中同名用例；新增/删除/差异行分别以绿色/红色标记，字段差异单元格高亮；不展示/不对比“实际结果”“备注”。  
- 操作方式：进入“用例相关 → 用例库”→点“导入用例”选择文件并选项目/版本→点击“确认入库”→若同名被拒绝则自动进入差异对比抽屉查看导入与库中内容差异。  
- 使用效果：同名冲突时无需反复删除/重试导入，可直接快速定位差异（包括条目数不一致、字段变化、新增/删除）。  
- 新增内容/接口/组件：Diff 抽屉 DOM（`index.html`）；Diff 样式（`style.css`）；差异计算与渲染（`scripts/modules/caseLibrary.js`）。  
- 复用说明：复用现有文件名清洗与 `listCaseFiles/listCaseItems` 获取数据能力，在前端做轻量 Diff 渲染；不引入新依赖。  
- 测试与验证：`node --check scripts/modules/caseLibrary.js tests/ui/case_library.spec.js`（通过）；`npm run test:ui -- tests/ui/case_library.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：同名差异对比支持“确认覆盖导入”  
- 功能描述：在“同名用例差异对比”抽屉中增加“确认覆盖导入”按钮，点击后二次确认；确认后将覆盖用例库中同名用例文件（删除原条目并写入导入内容）。  
- 操作方式：触发同名差异对比抽屉后→点击“确认覆盖导入”→确认弹窗→覆盖成功后自动关闭差异对比抽屉并提示成功。  
- 使用效果：同名冲突可直接在差异对比界面一键覆盖入库，无需手动删除旧用例再导入。  
- 新增内容/接口/组件：差异抽屉按钮（`index.html`）；前端覆盖导入调用（`scripts/modules/caseLibrary.js`、`services/apiClient.js`）；后端导入接口新增 `overwrite=1` 支持覆盖（`backend/routers/cases.py`）。  
- 复用说明：复用原 `/api/case-files/import` 导入接口，仅增加 query 参数控制覆盖；覆盖后复用 `listCaseFiles/listCaseItems` 刷新视图。  
- 测试与验证：UI：`npm run test:ui -- tests/ui/case_library.spec.js`（通过）；API：启动后端（`APP_DB_FILE=apitest.db .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 18080`）后执行 `API_BASE_URL=http://127.0.0.1:18080 npx playwright test --config tests/api/playwright.api.config.js tests/api/case_library.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：用例库导入容错增强（允许“同标题不同预期”）  
- 功能描述：用例库导入入库逻辑增强：同一份导入文件内重复条目会自动去重；同时兼容历史数据库唯一键不包含 `expected` 的情况（迁移修复），保证“同一分支/同标题但预期结果不同”可作为不同用例正常入库；导入失败时返回更明确的数据库约束错误信息，避免统一误报为“存在重复条目”。  
- 操作方式：导入用例并确认入库；若用例标题相同但预期结果不同，将作为两条不同用例写入；历史库升级后无需手动清库。  
- 使用效果：解决“库为空仍导入失败：存在重复条目”的阻断问题，导入流程更稳健且错误提示更可定位。  
- 新增内容/接口/组件：导入接口插入逻辑增强（`backend/routers/cases.py`）；历史库迁移 v5（`backend/migrations.py`）；API 用例补充“同标题不同预期”导入断言（`tests/api/case_library.spec.js`）。  
- 复用说明：复用既有导入接口与唯一键规则，仅补充 SQLite 容错插入与轻量迁移逻辑。  
- 测试与验证：API：启动后端（`APP_DB_FILE=apitest.db .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 18080`）后执行 `API_BASE_URL=http://127.0.0.1:18080 npx playwright test --config tests/api/playwright.api.config.js tests/api/case_library.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：用例库导入同名判定增强（包含名 + 模块/标题交集）  
- 功能描述：用例库导入同名校验规则更准确：第一层按“清洗名去首尾空格后完全相同”判定同名；若导入名包含库中名（如“用例1（1）”“xx用例1yy”），则第二层按模块交集 ≥2 判同名；若双方都只有 1 个模块且模块相同，则第三层按用例标题交集 ≥2 判同名；判定范围为项目级（同项目跨版本也会拦截）。  
- 操作方式：在“用例库 → 导入用例”选择项目/版本并确认入库；若命中上述同名规则则提示同名并进入差异对比/覆盖导入流程。  
- 使用效果：避免通过“文件名变体”绕过同名限制，同时保持“同项目跨版本”的重复限制一致性。  
- 新增内容/接口/组件：后端同名匹配 `_find_duplicate_case_file` 与导入接口结构化返回（`backend/routers/cases.py`）；API error body 透出（`services/apiClient.js`）；前端导入冲突时按 `existing_case_file_id` 拉取库中条目打开 Diff，覆盖导入时用匹配 cleanName 构造 `file_name`（`scripts/modules/caseLibrary.js`）；API 用例新增“包含名 + 模块/标题交集”断言（`tests/api/case_library.spec.js`）。  
- 复用说明：复用既有项目级同名限制与 Diff 抽屉，仅扩展判定规则与错误返回信息。  
- 测试与验证：API：启动后端（`APP_DB_FILE=apitest.db .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 18080`）后执行 `API_BASE_URL=http://127.0.0.1:18080 npx playwright test --config tests/api/playwright.api.config.js tests/api/case_library.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：用例库导入抽屉默认回填最近项目/版本  
- 功能描述：在已登录状态下，用例库“导入用例”抽屉会记住最近一次选择的项目与版本；导入完成后再次打开导入抽屉，会自动回填并默认选中上次的项目/版本，减少重复选择。  
- 操作方式：进入“用例相关 → 用例库”→打开“导入用例”并选择项目/版本导入完成→关闭抽屉→再次打开“导入用例”→项目/版本自动回填。  
- 使用效果：连续导入多份用例时更省操作，避免反复选择项目/版本。  
- 新增内容/接口/组件：导入抽屉状态持久化（localStorage：`tap-case-library-import-drawer`，含 `project_id/version_id`）（`scripts/modules/caseLibrary.js`）；UI 用例新增“关闭后再次打开默认回填”覆盖（`tests/ui/case_library.spec.js`）。  
- 复用说明：复用既有项目/版本加载与鉴权就绪判断，仅新增轻量持久化与恢复逻辑。  
- 测试与验证：`node --check scripts/modules/caseLibrary.js`（通过）；`npm run test:ui -- tests/ui/case_library.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：用例库删除用例文件后同步清空编辑视图  
- 功能描述：管理员在“编辑用例&转到执行”抽屉中删除用例文件后，若该用例文件当前正在右侧“用例编辑视图”中打开，则会自动清空并隐藏编辑视图，同时清理刷新恢复缓存，避免出现“已删除仍可编辑”的误导。  
- 操作方式：打开某个用例文件的编辑视图→回到“编辑用例&转到执行”抽屉勾选并删除该用例文件→删除完成后编辑视图自动消失。  
- 使用效果：删除操作与编辑视图状态一致，避免继续编辑已删除数据。  
- 新增内容/接口/组件：删除完成后校验并清空编辑视图（`scripts/modules/caseLibrary.js`）；UI 用例补充“打开编辑视图后删除应清空”断言（`tests/ui/case_library.spec.js`）。  
- 复用说明：复用现有删除流程与编辑视图渲染，仅在删除收尾阶段增加同步清理。  
- 测试与验证：`node --check scripts/modules/caseLibrary.js`（通过）；`npm run test:ui -- tests/ui/case_library.spec.js`（通过）。  
- 更新记录：无  

- 功能名称：用例库导入成功后自动清空文件选择（防重复导入）  
- 功能描述：用例库“导入用例”确认入库全部成功后，会自动清空已选择的导入文件（不清空项目/版本默认项），并禁用“确认入库”按钮，避免用户误点导致同一批文件被重复导入。  
- 操作方式：导入用例并点击“确认入库”成功后，文件提示恢复为“未选择文件”，再次点击“确认入库”需重新选择文件。  
- 使用效果：防止重复导入/重复冲突提示，导入流程更符合预期。  
- 新增内容/接口/组件：导入完成收尾清理文件选择与 input 值（`scripts/modules/caseLibrary.js`）；UI 用例新增“导入完成后确认按钮禁用/文件提示重置”断言（`tests/ui/case_library.spec.js`）。  
- 复用说明：复用既有导入流程与状态提示，仅在成功分支补充轻量清理。  
- 测试与验证：`node --check scripts/modules/caseLibrary.js`（通过）；`npm run test:ui -- tests/ui/case_library.spec.js -g 导入`（通过）。  
- 更新记录：无  

- 功能名称：用例库支持 Excel（xlsx）导入（格式与导出一致）  
- 功能描述：用例库“导入用例”支持导入 `.xlsx` 文件；当 Excel 首行表头与导出一致（“模块/用例标题/优先级/前提条件/操作步骤/预期结果”）时可直接解析入库；解析完成后仍复用同一入库接口，因此同名判定/差异对比/覆盖导入规则与 XMind/JSON 导入一致。  
- 操作方式：进入“用例相关 → 用例库”→打开“导入用例”→选择 `.xlsx` 文件（格式同导出 Excel）→选择项目/版本→确认入库。  
- 使用效果：支持 Excel 作为用例编写与交换格式，导入链路统一且同名规则一致。  
- 新增内容/接口/组件：导入文件选择允许 `.xlsx`（`index.html`）；前端新增 Excel 解析（支持 inlineStr/sharedStrings）并映射为用例条目（`scripts/modules/caseLibrary.js`）；UI 用例新增 Excel 导入覆盖（`tests/ui/case_library.spec.js`、fixture：`tests/fixtures/case_library_import.xlsx.base64`）。  
- 复用说明：复用既有 JSZip 依赖与导入入库接口 `/api/case-files/import`，仅新增轻量解析逻辑与字段映射。  
- 测试与验证：`node --check scripts/modules/caseLibrary.js`（通过）；`npm run test:ui -- tests/ui/case_library.spec.js -g 导入\\ Excel`（通过）。  
- 更新记录：无  

- 功能名称：用例库导入页提供 Excel/XMind 模板下载  
- 功能描述：用例库“导入用例”抽屉新增两个模板按钮：点击“Excel导入模板”会下载仅包含表头字段的空 `.xlsx`；点击“XMind导入模板”会下载一份可直接参考的 `.xmind` 模板（含示例条目）。  
- 操作方式：进入“用例相关 → 用例库”→打开“导入用例”抽屉→点击“Excel导入模板”或“XMind导入模板”下载。  
- 使用效果：导入格式更明确，减少手工准备模板的成本。  
- 新增内容/接口/组件：导入抽屉模板按钮（`index.html`）；模板文件生成与下载逻辑（`scripts/modules/caseLibrary.js`）；UI 用例新增模板下载覆盖（`tests/ui/case_library.spec.js`）。  
- 复用说明：Excel 模板复用现有 `buildCaseLibraryExcelBlob`；XMind 模板复用现有 `buildXmindPackageFromCases`；不引入新依赖。  
- 测试与验证：`node --check scripts/modules/caseLibrary.js`（通过）；`npm run test:ui -- tests/ui/case_library.spec.js -g 导入模板下载`（通过）。  
- 更新记录：无  

- 功能名称：用例库编辑视图搜索框样式优化  
- 功能描述：用例库“用例编辑视图”的搜索框增加搜索图标、加宽输入框并优化焦点/占位符样式，便于展示更完整的默认提示文案。  
- 操作方式：在用例库打开某份用例进入编辑视图，可在顶部搜索框输入关键字筛选模块/标题/步骤/预期等字段。  
- 使用效果：搜索输入更醒目、提示更清晰，长文案不易被截断。  
- 新增内容/接口/组件：搜索框结构与占位符优化（`index.html`）；搜索框样式（`style.css`）。  
- 复用说明：复用既有搜索过滤逻辑，仅优化 UI 展示。  
- 测试与验证：手工在 Chrome/Safari 验证搜索框样式与筛选交互；`node --check scripts/modules/caseLibrary.js`（通过）。  
- 更新记录：无  

- 功能名称：用例库编辑视图“清空搜索”按钮修复（禁用态更明确）  
- 功能描述：用例库编辑视图的“清空”按钮用于清除当前搜索过滤；当搜索为空时按钮会自动置灰禁用，避免“点击无反应”的困惑；清空时会强制触发一次输入更新并短暂提示“已清空搜索”。  
- 操作方式：在编辑视图搜索框输入关键字后，点击“清空”即可恢复显示全部用例条目；未输入搜索时按钮为禁用态。  
- 使用效果：按钮行为更符合直觉，清空操作更明确且对输入法场景更稳。  
- 新增内容/接口/组件：清空按钮状态同步与清空逻辑增强（`scripts/modules/caseLibrary.js`）；UI 用例新增“搜索过滤后清空恢复全量/按钮禁用态”断言（`tests/ui/case_library.spec.js`）。  
- 复用说明：复用既有筛选渲染 `renderEditorTable`，仅补充控件状态同步。  
- 测试与验证：`node --check scripts/modules/caseLibrary.js tests/ui/case_library.spec.js`（通过）；`npm run test:ui -- tests/ui/case_library.spec.js -g 导入\\ \\-\\>`（通过）。  
- 更新记录：按钮文案从“清空”调整为“清空搜索”（`index.html`）。  

## 已记录需求  
- 功能名称：需求澄清确认提示  
- 功能描述：在“需求澄清点视图”点击“确认澄清”后即时显示提示，明确澄清写入结果。  
- 操作方式：在功能工作流的需求澄清点视图填写/编辑澄清结果后点击“确认澄清”，按钮下方会显示写入结果提示。  
- 使用效果：用户能立即获知澄清写入成功或数据缺失等情况，避免无反馈导致误以为未生效。  
- 新增内容/接口/组件：新增澄清视图状态位 `#clarifyStatus`，复用现有确认逻辑输出提示。  
- 复用说明：复用原有确认澄清流程与状态提示方法，仅补充视图内状态承载。  
- 测试与验证：`npm run test:ui -- tests/ui/workflow.spec.js`（通过，新增用例覆盖澄清提示）。  
- 更新记录：无  
