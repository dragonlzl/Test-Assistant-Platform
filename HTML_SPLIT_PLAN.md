# HTML 页面拆分计划（6 页面）

> 目标：将当前全部聚合在 `index.html` 的功能拆分为 6 个功能页面，降低耦合、提升可维护性，并保持现有脚本加载顺序与 ES2019 兼容性。

## 1. 范围与原则
- 拆分范围：仅拆分 HTML 页面结构与页面入口脚本加载，保持现有 JS 模块文件不做功能性重构（如无必要）。
- 兼容性：保持 ES2019；不使用可选链/空值合并等新语法。
- 顺序要求：所有页面依旧按 `vendor → config → core → handlers → base → modules → bootstrap` 加载。
- 风险控制：先做“结构迁移”，再做“按页精简脚本加载”。

## 2. 现有功能分布梳理（来源：`index.html` / `scripts/modules/`）
- AI 功能
  - 一键执行（auto）
  - 功能流程（clean: 导入/评审/清洗/对比/拆分/用例导入/覆盖对比/缺失）
  - 用例生成（casesgen + 进度面板）
  - 功能指派（assign）
  - 模型管理（models）
- 用例相关
  - 用例执行（tempexec）
  - 执行总览（exec-overview）
  - 用例库（case-library）
  - 用例归档（case-archive）
- 管理
  - 项目管理（project-admin）
  - 人员管理（user-admin）
  - 操作记录（ops-log）
- 设置
  - 飞书/执行列/其他配置

## 3. 目标页面划分（6 页面）
1) `ai-workflow.html`
   - 包含：一键执行（auto）、功能流程（clean）、用例生成（casesgen）
   - 说明：共享同一条需求/清洗/拆分数据链路，拆分可减少跨页状态同步成本。

2) `ai-tools.html`
   - 包含：功能指派（assign）、模型管理（models）
   - 说明：工具型/配置型功能，和核心流程耦合弱。

3) `case-exec.html`
   - 包含：用例执行（tempexec）、执行总览（exec-overview）
   - 说明：执行流程与总览数据结构强耦合。

4) `case-library.html`
   - 包含：用例库（case-library）、用例归档（case-archive）
   - 说明：均为用例资产管理场景。

5) `admin.html`
   - 包含：项目管理（project-admin）、人员管理（user-admin）、操作记录（ops-log）
   - 说明：权限型功能，独立维护。

6) `settings.html`
   - 包含：设置（settings）
   - 说明：配置入口，功能独立。

## 4. 共享布局与公共区
各页面保持一致的“应用外壳”，包括：
- 侧边栏（用户信息、导航、路径、回到顶部等）
- 右侧内容容器（`content-shell`）
- 通用面板（进度面板、个人备忘）
- 页面说明/帮助（如已有）

> 备注：页面拆分初期可先复制同一套布局结构，后续再考虑抽成模板/组件。

## 5. JS 加载与初始化策略
- 保持原顺序加载，避免逻辑变化。
- 每个页面仅加载必要的 `modules/*.js`，但第一阶段可暂时全部加载，保证稳定运行。
- `bootstrap.js` 不变，依旧调用 `window.app.init()`。
- 若后续精简模块加载，需要在 `app.js` 里增加“按页面启动”判断（如 `document.body.dataset.page`）。

## 6. 页面入口与导航调整
- 侧边栏的 Tab 按页面改为跳转链接（或增加“页面入口卡片”）。
- 各页面激活自己的“当前页”样式。
- 登录后默认进入 `ai-workflow.html`（或保持 `index.html` 作为入口页）。

## 7. 迁移步骤（建议顺序）
1) 准备：复制 `index.html` 形成 6 个页面骨架，保留公共布局。
2) 迁移：按“目标页面划分”移动对应 `data-tab-section` DOM 区块。
3) 校验：每个页面至少能打开并渲染对应模块。
4) 导航：更新侧边栏链接与 active 状态显示。
5) 精简：按页面减少模块脚本加载（可选，后置）。

## 7.1 拆分顺序与入口策略（建议）
- 入口策略：保留 `index.html` 作为入口/壳页，避免旧链接失效；可做简单导航或默认跳转到 `ai-workflow.html`。
- 拆分顺序：先核心再外围，降低风险。
  1) `ai-workflow.html`
  2) `case-exec.html`
  3) `case-library.html`
  4) `ai-tools.html`
  5) `settings.html`
  6) `admin.html`

## 7.2 初始化与兼容性建议
- 每个页面 `body` 添加 `data-page` 标记（如 `data-page=\"ai-workflow\"`），用于后续按页初始化。
- 初期不精简脚本加载，优先保证功能可用；稳定后再按页减小 `modules/*.js` 引入范围。

## 8. 质量与回归检查
- Chrome/Safari：拖拽、剪贴板、文件保存、抽屉与弹窗是否正常。
- 模块入口：各页面首次进入是否能正确初始化（无 JS 报错）。
- 用户态：权限控制（admin-only）是否仍生效。

## 9. 风险与回滚
- 风险：拆分导致选择器找不到 DOM；侧边栏切换逻辑依赖单页结构。
- 回滚：保留原 `index.html` 备份（如 `index.all.html`），快速恢复。

## 10. 进度追踪
- [x] 建立 6 个页面骨架文件
- [x] `ai-workflow.html` 迁移完成
- [x] `ai-tools.html` 迁移完成
- [x] `case-exec.html` 迁移完成
- [x] `case-library.html` 迁移完成
- [x] `admin.html` 迁移完成
- [x] `settings.html` 迁移完成
- [x] 导航调整完成
- [ ] 关键功能回归完成
