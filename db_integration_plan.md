# 数据库接入与权限改造实现规划

## 目标与范围
- 将现有“纯静态 + 浏览器缓存”模式改为“静态托管 + FastAPI + SQLite3”，保证数据不因 IP/缓存丢失。
- 覆盖登录/权限、人员管理、项目管理、用例库、执行数据入库、操作记录、个人设置与模型配置等需求。
- 支持至少 20 人并发操作，确保易维护、易扩展，遵循 FEATURE_DEV_GUIDE 约束。

## 架构与运行
- 后端：FastAPI + SQLite3（WAL 模式，读写分离事务）；使用 uvicorn 运行。
- 静态托管：FastAPI StaticFiles 指向现有前端目录，访问路径保持 `http://host:port/index.html`。
- 鉴权：登录颁发会话（Cookie/token），中间件校验；支持登出与密码修改。
- 日志：操作日志表记录登录/退出/增删改及结果。

## 数据表设计（15 张）
- users：id, username(唯一), password_hash, role(admin/user), level(组长/组员), is_active, created_at, updated_at；默认插入 admin/chillytest_admin。
- user_sessions：id, user_id, token/refresh_token, expires_at, revoked, created_at。
- projects：id, name(唯一), description, created_by, created_at, updated_at。
- project_versions：id, project_id, name(项目内唯一), created_at, updated_at, created_by。
- user_projects：user_id, project_id（成员归属，限制非管理员可见与操作范围）。
- operation_logs：id, user_id, action, target_type, target_id, result, detail(json/text), created_at。
- case_files（用例库文件元）：id, project_id, version_id, file_name_clean, importer_id, imported_at, updated_at, source。
- case_items（用例库条目）：id, case_file_id, module, title, priority, precondition, steps, expected, remark, created_by, updated_by, created_at, updated_at；唯一键(module,title,expected,case_file_id)。
- exec_sets（执行集合/历史）：id, project_id, version_id, source(case_file_id/上传), name, status(active/archived), created_by, created_at, updated_at。
- exec_cases：id, exec_set_id, case_item_id(可空), module, title, expected, actual_result, defect_link, remark, status, order_no, executor_id(执行责任人，可空), created_by, updated_by, created_at, updated_at。
- exec_case_history：id, exec_case_id, field_changed, old_value, new_value, changed_by, changed_at。
- exec_overview_stats：id, project_id, version_id, user_id, total, pending, passed, failed, blocked, not_applicable, updated_at（执行总览用，按项目/版本/人员聚合）。
- settings：id, scope(user/global), owner_id, key, value_json, updated_at（“其他设置”持久化）。
- model_configs：id, owner_id(user/global), name, config_json, is_active, created_at, updated_at（模型管理）。
- feature_assignments：id, owner_id(user/global), name, prompt/config_json, created_at, updated_at（功能指派）。
- attachments（可选，存放原始上传或引用路径）：id, path_or_blob, owner_id, created_at。

索引建议：username、(project_id,name)、case_file_id、exec_set_id、user_id、created_at；需要乐观锁字段 updated_at/version 做并发保护。

## 关键接口（REST，鉴权）
- Auth：POST /api/auth/login；POST /api/auth/logout；POST /api/auth/password（改密）。
- Users：GET/POST/PATCH/DELETE /api/users；POST /api/users/{id}/reset_password；GET /api/users/me。
- Projects：GET/POST/PATCH/DELETE /api/projects；GET/POST /api/projects/{id}/versions。
- User-Project：GET/POST /api/user-projects（成员分配）。
- Case Library：POST /api/case-files/import；GET /api/case-files；GET /api/case-files/{id}/items；PATCH /api/case-items/{id}；POST /api/case-items/{id}/to-exec。
- Execution：POST /api/exec-sets；GET /api/exec-sets；GET /api/exec-sets/{id}/cases；PATCH /api/exec-cases/{id}（实时写库）；history 自动记录。
- Execution Overview：GET /api/exec/overview?project_id=...&version_id=...（执行总览统计，按项目/版本/人员分组）。
- Settings/Models/Features：GET/PUT /api/settings；GET/POST /api/models；GET/POST /api/features。
- Operation Logs：GET /api/ops（仅 admin）。

## 前端改造要点
- 登录页：账号/密码校验，改密需旧密+两次新密；错误提示；风格与现有一致。
- 导航与权限：左侧显示当前用户/所属项目（含登出）；新增“用例库”“执行总览”“项目管理”“人员管理”“操作记录”页签（后三者仅管理员）。
- 人员管理：列表（编号、姓名、权限、级别、所属项目、密码占位、创建/修改时间、操作）；保存/重置/删除二次确认；抽屉新增，默认密码 12345678，姓名不可改。
- 项目管理：列表（编号、项目名、描述、版本、时间、操作）；抽屉新增项目，版本管理抽屉；管理员可见全部并可改，普通用户仅看所属项目且只能改自己项目版本。
- 用例库：导入需选项目/版本（限所属项目）；同名校验；清洗文件名去除导出标识与后缀；记录导入人；列表/搜索/分页；编辑抽屉复用执行页视图（无缺陷字段）；转执行时同名覆盖提示并保留结果逻辑。
- 执行页：导入改为落库并选项目/版本，同名拒绝；实时保存 exec_cases（除实际结果/缺陷外同步到库）；删除/合并按规则比对模块/标题/预期；转入时保留结果规则。
- 操作记录：仅管理员；列表展示时间/人员/操作项/结果。
- 其他设置、模型管理、功能指派：改为走 API 持久化。
- 执行总览：新增页签与视图，按所属项目生成项目卡片，点击后展示版本区/需求区按人员分组的执行进度与列表（数据来源 exec_overview_stats + exec_cases）。

## 并发与性能
- SQLite 开 WAL，短事务；批量导入/执行更新使用事务；必要字段加索引。
- 乐观锁：提交携带 updated_at/version，发现冲突给出提示。
- 接口限流/校验：导入去重、版本重名校验、用例名重名提示。
- 执行总览聚合：exec_overview_stats 可在写路径同步更新或定期增量计算，避免全量扫描 exec_cases；字段需索引 project_id/version_id/user_id。

## 开发里程碑
1. 搭建 FastAPI 基础、SQLite 迁移脚本、StaticFiles；默认 admin 初始化。
2. 完成登录/改密/鉴权中间件 + session/token 管理。
3. 用户、项目、版本、用户-项目分配 API；前端登录与导航权限。
4. 人员管理与项目管理前后端闭环（抽屉、列表、保存/重置/删除）。
5. 用例库导入/编辑/转执行全链路；文件名清洗与同名校验。
6. 执行页持久化改造（导入、实时写库、删除合并规则、保留结果逻辑）。
7. 设置/模型/功能指派持久化；操作记录页。
8. 测试与验收：接口测试、关键手工流程、20 并发小压测；修正与文档。

## 测试计划
- 接口测试（pytest+httpx）：Auth、用户/项目/版本 CRUD、导入与去重、编辑与乐观锁、转执行覆盖规则、执行实时写入与历史、设置/模型/功能指派、操作日志。
- 前端手测：登录/改密/登出、权限显示、人员/项目/版本操作、用例库导入与编辑、执行页实时保存与合并提示、操作记录分页。
- 并发验证：20 并发导入/更新，观察写锁/性能。

## 数据与迁移
- 初始数据：插入 admin（chillytest_admin）、可选示例项目/版本。
- 备份与清理：提供 SQLite 备份脚本；删除项目需级联版本与关联执行集/用例关系。
