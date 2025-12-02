# Repository Guidelines

## 项目结构与目录说明
- 仓库主体：`index.html`（入口）、`style.css`（样式）；页面脚本集中在 `scripts/` 下：`base/`（`state.js`、`utils.js`）、`core/`（各 *Core.js）、`handlers/`（各 *Handlers.js 与布局交互）、`modules/`（app/页面逻辑）、`vendor/jszip.min.js`、`legacy/`（wrap/inject 备份）。入口按顺序 defer 加载 vendor→config→core→handlers→base→modules→bootstrap，保持与旧版一致。
- 配置/服务：`config/constants.js` 提供默认配置，`services/` 内含存储与模型调用封装。
- 备份片段：`models_block_restore.txt`、`models_module.tmp` 记录拆分前的模型/配置块，便于对照或紧急恢复（不建议直接改写）。
- 资源类文件：`debug_*.txt`、`casegen_*.txt`、`.xmind/.docx` 等是案例或需求素材，不建议直接改写；若需新增资源，请与 `index.html` 同级或放入 `assets/` 并合理命名。

## 构建、开发与测试命令
- `python3 -m http.server 8080`：启动轻量 HTTP 服务并访问 `http://localhost:8080/index.html`，保证文件 API 可用。
- `node --check scripts/base/state.js scripts/base/utils.js scripts/modules/app.js scripts/modules/bootstrap.js`：快速语法检查，避免旧浏览器报错。
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
