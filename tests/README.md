# 自动化测试

## 准备

- Node 14+、Python 3。
- 首次运行：`npm install`，随后执行 `npm run test:ui:install` 安装浏览器。
- UI 配置会自动启动静态服务器；可用 `PLAYWRIGHT_BASE_URL` 覆盖默认地址。
- API 测试必须连接测试数据库，禁止使用正式数据库。

## Node 回归

重点执行以下纯核心测试：

```bash
node tests/node/xmind_request_scheduler_core.test.js
node tests/node/xmind_dedupe_batch_core.test.js
node tests/node/xmind_workspace_recovery_core.test.js
node tests/node/xmind_task_resume_guard.test.js
node tests/node/xmind_generation_timing_core.test.js
node tests/node/xmind_render_policy_core.test.js
node tests/node/xmind_coverage_case_tooltip_core.test.js
node tests/node/reuse_applicability_core.test.js
```

## UI 回归

```bash
npm run test:ui
npm run test:ui -- tests/ui/html_split_pages.spec.js
npm run test:ui -- tests/ui/xmind_casegen_flow.spec.js --workers=1
npm run test:ui -- tests/ui/case_library_ai_gen.spec.js --workers=1
npm run test:ui -- tests/ui/tempexec_ai_gen.spec.js --workers=1
```

覆盖重点：

- 默认入口、历史 `auto`/`clean` 地址回退和旧菜单缺失。
- XMind 多工作区、需求/已有用例导入、生成、中断与刷新恢复、去重、覆盖、导出、新建入库和追加入库。
- 用例库和执行页内生成与追加。
- 四类保留模型指派、模型缺失/请求失败和废弃配置忽略。

## API 回归

先使用测试库启动后端：

```bash
APP_DB_FILE=apitest.db uvicorn backend.main:app --host 127.0.0.1 --port 8080
```

再运行定向用例：

```bash
API_BASE_URL=http://127.0.0.1:8080 npm run test:api -- tests/api/settings_models.spec.js
API_BASE_URL=http://127.0.0.1:8080 npm run test:api -- tests/api/xmind_casegen_no_new_endpoint.spec.js
API_BASE_URL=http://127.0.0.1:8080 npm run test:api -- tests/api/case_library_xmind_writer_reuse_import.spec.js
API_BASE_URL=http://127.0.0.1:8080 npm run test:api -- tests/api/exec_ai_append.spec.js
API_BASE_URL=http://127.0.0.1:8080 npm run test:api -- tests/api/exec_reuse_applicability.spec.js
```

所有 UI 测试应阻断非本地请求，避免调用真实模型或外部服务。

## MCP 服务

MCP 风格上下文回归同时验证单条复杂度自检、过长复杂候选拆分、独立执行及拆分后重新查重确认规则。默认网页提示词检查：

```sh
npm run test:ui -- tests/ui/models_settings.spec.js --grep '功能指派页只展示保留能力并使用最新基础文案'
```

```sh
.venv/bin/python -m unittest discover -s tests/python -p test_case_similarity.py -v
```

新增相似确认回归使用临时数据库和独立 HTTP 服务，覆盖文本匹配、同名不同场景、确认前不写入、修改/新增/跳过、对比摘要、令牌与版本变化、权限、并发幂等及混合写入整体回滚，不调用模型。

```sh
.venv/bin/python -m unittest discover -s tests/python -p test_mcp_service.py -v
```

使用临时 SQLite 测试库、独立 HTTP 后端及本地知识库模拟服务，自动清理。覆盖协议、初始化与写工具的人工编写风格上下文、用例内容及局部更新兼容、个人凭据、业务链路、只读约束、跨项目权限、权限撤销、结果更新不回写用例内容、并发幂等和回执失败时的整体回滚，不请求真实模型。AI 操作标识覆盖“AI新增子项”与“AI修改”的区分、累积、人工编辑保留、归档恢复、重复项跳过、事务回滚、删除后 ID 复用及旧库迁移。

```sh
npm run test:ui -- tests/ui/case_library_edit_focus.spec.js tests/ui/tempexec_edit_defer_save.spec.js tests/ui/tempexec_reuse_align.spec.js tests/ui/tempexec_view_empty.spec.js
```

界面回归使用本地 API mock，覆盖“AI操作”列顺序、空值、多标识、人工编辑保留、窄屏深色展示及复用子项对齐。

## 复用子项 MCP / HTTP

```sh
.venv/bin/python -m unittest discover -s tests/python -p test_execution_reuse.py -v
node tests/node/reuse_applicability_core.test.js
```

自动创建临时测试库和独立服务，验证批量新增、配置/清除获取解锁方式、按范围快速执行、人工结果与移除子项保护、权限撤销和只读、并发幂等、版本冲突、事务回滚及 HTTP 契约。服务端规则与浏览器规则使用相同输入逐项比较，测试需要 Node，不连接正式数据库。

## 操作记录查询

```sh
.venv/bin/python -m unittest discover -s tests/python -p test_operation_query.py -v
npm run test:ui -- tests/ui/ops_log.spec.js tests/ui/ops_log_drawer_restore.spec.js tests/ui/ops_log_exec_case_run.spec.js tests/ui/ops_activity.spec.js tests/ui/ops_contribution.spec.js tests/ui/ops_exec_contribution.spec.js --workers=1
```

后端回归自动创建临时数据库和独立服务，覆盖大详情不进入列表、日期/人员/行为/结果筛选、翻页快照、分段详情、权限实时变化、贡献计数与索引。UI 测试需 `.venv` 已安装后端依赖，夹具用独立内存 SQLite 执行实际查询逻辑，验证不自动下载下一页、仅点击后读取详情、筛选重置游标及图表汇总，不访问正式数据库。
