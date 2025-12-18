# 后端 API 文档（FastAPI + SQLite）

> 约定：所有接口返回 JSON，鉴权采用 `Authorization: Bearer <token>`，未登录返回 401。接口有变更或新增时，务必同步更新本文件，保持最新。

## 1. 鉴权 Auth
- `POST /api/auth/login`  
  - 入参：`{ "username": string, "password": string }`  
  - 出参：`{ "access_token": string, "expires_at": ISODate, "user": User }`  
  - 说明：登录成功后保存 `access_token`，后续接口带 Bearer。
- `POST /api/auth/logout`（需登录）  
  - 入参：无；出参：`{ "detail": "logged out" }`  
  - 说明：当前 token 作废。
- `POST /api/auth/password`（需登录）  
  - 入参：`{ "old_password": string, "new_password": string }`  
  - 出参：`{ "detail": "密码已更新，请重新登录" }`  
  - 说明：修改密码后会注销所有会话。

## 2. 用户 Users
- `GET /api/users/me`（需登录）  
  - 出参：`User` 当前用户信息。
- `GET /api/users`（仅管理员）  
  - 出参：`User[]` 按 id 升序。
- `POST /api/users`（仅管理员）  
  - 入参：`{ username, password?, role: "admin"|"user", level: "leader"|"member", is_active: bool }`  
  - 出参：`User`；校验重名返回 400。
- `PATCH /api/users/{user_id}`（仅管理员）  
  - 入参：`{ role?, level?, is_active? }`；不存在返回 404。
- `DELETE /api/users/{user_id}`（仅管理员）  
  - 出参：`{ detail: "用户已删除" }`；不存在返回 404。
- `POST /api/users/{user_id}/reset_password`（仅管理员）  
  - 出参：`{ detail: "密码已重置" }`；密码重置为默认值。
- `POST /api/users/assign-projects`（仅管理员）  
  - 入参：`{ user_id: number, project_ids: number[] }`  
  - 说明：校验项目存在，不存在返回 400；成功覆盖式重置分配。
- `GET /api/users/{user_id}/projects`（管理员或本人）  
  - 出参：`[{ project_id, project_name }]`；跨用户访问返回 403。

## 3. 项目 Projects
- `GET /api/projects`（需登录）  
  - 管理员返回全部；普通用户仅返回其分配项目。
- `POST /api/projects`（仅管理员）  
  - 入参：`{ name, description? }`；重名返回 400。
- `PATCH /api/projects/{project_id}`（管理员或该项目的组长）  
  - 入参：`{ description? }`；未分配或非组长返回 403，不存在返回 404。
- `DELETE /api/projects/{project_id}`（仅管理员）  
  - 出参：`{ detail: "项目已删除" }`；不存在返回 404。

### 3.1 项目版本 Project Versions
- `GET /api/projects/{project_id}/versions`（需可访问该项目）  
  - 未分配/非管理员访问时返回 403，不存在返回 404。
- `POST /api/projects/{project_id}/versions`（管理员或项目成员）  
  - 入参：`{ name }`；同项目内重名返回 400，未分配返回 403。
- `DELETE /api/projects/{project_id}/versions/{version_id}`（管理员或项目成员）  
  - 不存在返回 404，未分配返回 403。

## 4. 操作日志（Operation Logs）
- 日志写入：登录/登出/改密、用户 CRUD、项目/版本 CRUD、分配项目、用例库导入/编辑/删除、执行集归档等均写入 `operation_logs`，含 `user_id/action/target_type/target_id/detail`。
- `GET /api/ops`（仅管理员）
  - Query：`limit?`（默认 200，最大 500）、`offset?`（默认 0）、`user_id?`（按人员过滤）
  - 出参：`OperationLog[]`（按 `created_at` 倒序）
- `POST /api/ops/event`（需登录）
  - 入参：`{ action: string, target_type?: string, target_id?: number, result?: string, detail?: any }`
  - 说明：用于记录“仅发生在前端”的关键操作（如导出文件等），不会影响业务流程；仅管理员可在“操作记录”页面查看。

## 5. 响应与错误约定
- 成功：2xx + JSON 体；删除/重置返回 `detail` 提示。
- 常见错误：  
  - 400：参数错误（如重名、缺参数、项目不存在）。  
  - 401：未登录或 token 失效。  
  - 403：权限不足/未分配项目。  
  - 404：目标资源不存在。

## 6. 文档维护要求
- 任何接口新增、入参/出参/权限变更时，需同步更新本文件对应章节；新增接口可按以上格式添加。
- 如新增列表/查询接口，需注明分页、过滤参数；如启用幂等/乐观锁校验，请说明字段和错误码。

## 7. 用例执行归档（Execution Archive）
> 归档是“执行集 exec_set”维度的操作：归档后不再出现在“用例执行”页面的导入/执行视图中，但执行结果仍保留，可在“用例归档”页面查看；同一份用例可多次执行并多次归档（对应不同 exec_set 记录）。

### 7.0 执行集创建/同步
- `POST /api/exec/sets/from-case-file`（需登录）  
  - 入参：`{ case_file_id, exec_version_id?, mode?, preserve_results?, prefer_result_source?, import_cases?, requirement?, reuse_enabled?, reuse_presets? }`  
  - 说明：从用例库同步/创建执行集；`exec_version_id` 为“执行版本”，可传 `null` 表示未分配版本；不传则默认沿用用例库的导入版本。

### 7.1 列表与过滤
- `GET /api/exec/sets`（需登录）  
  - Query：`project_id?`、`status_filter?=active|archived|all`（默认 `active`）、`all_users?=1`（仅管理员）  
  - 说明：默认仅返回“当前用户”的执行集；普通用户仅可见自己创建的执行集；`status_filter=active` 用于执行页展示。

### 7.2 归档
- `POST /api/exec/sets/{exec_set_id}/archive`（需登录；仅 owner 或管理员）  
  - 入参：`{ "reason"?: string }`  
  - 规则：若该执行集仍存在未通过用例（未执行/失败/阻塞等），必须填写 `reason`；否则返回 400。  
  - 出参：归档列表行数据（含归档人/归档时间等）。

### 7.3 归档查询（供归档页使用）
- `GET /api/exec/archives`（需登录）  
  - Query：`project_id?`、`version_id?`、`q?`（用例名关键字）、`limit?`、`offset?`  
  - 权限：管理员可看全部项目；普通用户仅可看自己所属项目下的归档记录（跨成员可读）。  

- `GET /api/exec/archives/{exec_set_id}`（需登录）  
  - 出参：归档元信息 + `cases`（完整执行用例列表，含实际结果/备注/缺陷链接/复用子项等）。

### 7.4 删除归档（管理员）
- `DELETE /api/exec/archives/{exec_set_id}`（仅管理员）  
  - 说明：物理删除归档记录（级联删除该执行集及其执行用例/历史），不可撤回。
