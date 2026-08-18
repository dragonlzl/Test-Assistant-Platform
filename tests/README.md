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
