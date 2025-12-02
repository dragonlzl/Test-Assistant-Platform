# 重构进度板（已归档，当前以 APP_REFACTOR_PLAN.md 为准）

- [x] 0. 建立进度板（本次完成）：整理重构目标与步骤，作为后续迭代的上下文。
- [x] 1. 基础层梳理：在 `scripts/base/state.js` 补齐初始状态与读写接口；在 `scripts/base/utils.js` 收敛通用方法；新增 `services/modelClient.js`、`services/storage.js` 骨架并接入加载顺序。
- [x] 2. 模块拆分：按功能迁移 `app.js` 逻辑到 `scripts/modules/`（models、assign、review、clean、compare、split、cases、casesgen、tempexec、auto），每块暴露 `init(ctx)`。（完成：设置/飞书通知/执行列显示/分页设置抽离至 `settings.js`；模型指派至 `assign.js`；评审/澄清至 `review.js`；清洗至 `clean.js`；覆盖对比与缺失视图交互至 `compare.js`；拆分按钮/视图切换+结果监听至 `split.js`/`splitHandlers.js`；需求/用例上传至 `upload.js`；通用布局/导航至 `layoutHandlers.js`；用例生成跳转/导出至 `casegenHandlers.js`，核心与进度至 `casegenCore.js`/`casegenProgress.js`；自动流程与工作流编排至 `auto.js`；执行视图交互在 `tempexec.js`；主编排留在 `app.js`。)
- [x] 3. 启动与加载：使用 `bootstrap.js` 统一启动顺序，`index.html` 只负责按依赖顺序加载。（完成：`app.js` 暴露 `window.app.init` 且 `_inited` 防重复，`bootstrap.js` 负责 DOMContentLoaded 调用，`index.html` 仅加载脚本）
- [x] 4. 文档与回归：更新 `FILE_OVERVIEW.md`/README 依赖关系，补充回归清单，运行 `node --check` 验证语法。（完成：更新文件概览与启动说明，语法检查通过，提醒每次任务后执行 `python3 notify_feishu.py`）

> 规则：每完成一步，更新此表的状态；若拆分中间步骤需要拆解，再在对应行下追加小项；每次任务完成后执行 `python3 notify_feishu.py` 通知。

# 重构待办（参考方向）

- 拆分功能模块：将临时执行/一键执行/用例生成等块各自独立成 `tempexec.js`、`auto.js`、`casesgen.js`，`app.js` 只做编排。
- 样式分区：按功能拆分 `style.css`（如 `models.css`、`tempexec.css`、`workflow.css`），主样式保留基础布局和通用组件。
- 工具层收敛：把状态提示、下载、节流/防抖、JSON 处理等公共函数收拢到 `utils.js` 并去重，避免再次出现重复定义。
- 状态管理：在 `state.js` 提供唯一的全局状态读写/持久化接口，各功能模块通过接口访问，减少直接改全局对象。
- 初始化流程：在 `index.html` 明确加载顺序并统一由 `bootstrap.js` 启动，确保模块 init 顺序一致；为模块增加空 DOM 判断和失败提示。
- 最小化回归检查：保留 `node --check`，并考虑补充简单的 DOM mock 脚本/手动清单（拖拽导入、模型保存、执行视图导入/导出）便于每次重构后快速回归。
