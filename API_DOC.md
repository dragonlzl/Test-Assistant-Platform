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
  - MCP 补充：修改密码、管理员重置密码或停用账号，也会撤销该用户的所有个人 MCP 凭据。

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
  - 兼容旧客户端：`limit?`（默认 50，最大 500）、`offset?`（默认 0）、`user_id?`、`start_ms?`、`end_ms?`。
  - 出参：`OperationLog[]`（包含详情，按 `created_at` 倒序）。网页与 MCP 已改用下面的有界查询，不应循环此接口拉取全量历史。
- `POST /api/ops/query`（仅管理员）
  - 入参：`{ start_ms?, end_ms?, user_id?, actions?: string[], target_groups?: string[], target_type?, target_id?, result?: "success"|"failed", exclude_auto?: bool, limit?: number, cursor?: string }`。
  - 默认最近 7 天、20 条，最多 100 条；单次时间范围最多 366 天。时间为 Unix 毫秒，边界包含。只传结束时间时从该时间向前 7 天；只传开始时间时截止当前时间。
  - `actions` 最多 100 个；`target_groups` 支持 platform、case、case_item、case_template、project、version、user。默认排除 auto/sync 事件。
  - 返回 `{ items, next_cursor, has_more, range: { start_ms, end_ms }, action_options }`。按时间及 ID 倒序，列表只投影短摘要字段，文本字段最多 160 字符，不返回完整详情、旧值/新值或步骤正文。
  - 首次查询固定时间范围和最大日志 ID。后续原样携带筛选条件及 `next_cursor`，新写日志不会挤入当前翻页；更改筛选时清空游标。游标无效或筛选不一致返回 400，不计算全量总数。
- `POST /api/ops/detail`（仅管理员）
  - 入参：`{ log_id, offset?: number, limit?: number }`。按字符分段读取原始 JSON 文本，默认 6000、最多 12000 字符，offset 默认 0。
  - 返回 `{ id, action, created_at, detail_text, offset, total_chars, next_offset }`；`next_offset=null` 表示结束。分段可能不是完整 JSON；记录不存在返回 404。
- `POST /api/ops/summary`（仅管理员）
  - 支持 query 的筛选字段（不含 limit/cursor），另需 `user_ids`（1–100 个正整数），`view` 为 activity（默认）、contribution 或 execContribution。
  - 默认最近 7 天，最多 366 天；SQL 汇总活跃度、用例贡献、执行贡献，只返回 `{ items: [{ user_id, username, key, count }], range }`，不下载原始日志。保留用例完整性和执行去重计数规则。
- 网页列表默认最近 7 个自然日，支持首页/上一页/下一页；详情点击后分段加载，Excel 仅导出当前页摘要。逐条展示真实事件，不再生成每日首次/最后执行的合并记录。统计图按需加载汇总，“最近365天”替代无界全历史。
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
- `PATCH /api/exec/sets/{exec_set_id}/reuse-applicability`（需登录；仅 owner 或管理员）
  - 入参：`{ reuse_presets: any[], cases: [{ case_id, reuse_details: any[], status }] }`
  - 说明：在单个事务中保存复用预设的适用性配置和发生变化的复用子项结果；服务端会先校验全部 `case_id` 均属于目标执行集，任一用例无效时整批不写入。
  - 限制：执行集必须已开启用例复用；单次最多更新 2000 条用例；`status` 仅支持未执行、通过、失败、阻塞、不适用。
  - 出参：`{ exec_set_id, updated_cases, updated_case_ids, reuse_presets }`。

### 7.1 列表与过滤
#### 复用预设与服务端快速执行

- `GET /api/exec/sets/{exec_set_id}/reuse`：项目内可读。返回 `{ exec_set_id, project_id, status, reuse_enabled, can_write, revision, case_count, presets, preset_count, presets_truncated, profile, limits }`，不返回所有用例正文。profile 包含 key、label、options（value/label），不支持方式匹配时为 null；最多返回 100 个预设，每个名称最多 1000 字符。
- `POST /api/exec/sets/{exec_set_id}/reuse/presets`：`{ expected_revision, items: [{ text, applicability?: { profile, value } }], quick_execute?: false }`。向每条执行用例追加预设子项；服务器生成 preset/detail ID，同名冲突 409，已有子项保留。quick_execute=true 同时对本次新增子项应用适用性规则。
- `PATCH /api/exec/sets/{exec_set_id}/reuse/presets`：`{ expected_revision, items: [{ preset_id, applicability: { profile, value } | null }], quick_execute?: false }`。配置或清除已有子项的获取/解锁方式，可同时应用规则；不接受任意状态或客户端生成的子项列表。
- `POST /api/exec/sets/{exec_set_id}/reuse/quick-execute`：`{ expected_revision, preset_ids?: string[] }`。省略/空数组表示全部预设，否则只处理指定预设。匹配规则沿用网页：自动标记不适用或恢复未执行，保留人工结果/备注及已移除子项，不标记通过。当前支持“元气骑士”角色皮肤与武器进化皮肤规则，以读取返回的选项为准。
- 写入仅允许所属用户或管理员，执行集须 active 且 reuse_enabled=true；归档、非复用、无效选项返回 400，越权返回 403。最多 2000 条用例、100 个总预设；新增/配置每批最多 50 项，新增子项总数最多 20000。
- 所有写入携带刚读取的 revision（64 位哈希），覆盖执行集及全部执行用例版本；数据变化返回 409。写入加锁后校验，整批事务提交。HTTP 不使用幂等键，响应丢失应先重读；MCP 对应工具使用幂等键，可安全重放。
- 返回读取结构及 `{ affected_preset_ids, summary: { added_presets, added_details, updated_cases, auto_set, auto_cleared, conflicts } }`，附新 revision，不回传全部子项。写入执行历史与操作审计，不触发共享用例正文更新。

#### 执行集列表
- `GET /api/exec/sets`（需登录）  
  - Query：`project_id?`、`status_filter?=active|archived|all`（默认 `active`）、`all_users?=1`（仅管理员）  
  - 说明：默认仅返回“当前用户”的执行集；普通用户仅可见自己创建的执行集；`status_filter=active` 用于执行页展示。
  - 返回字段补充：`restored_from_id`（若为归档恢复后的执行集，则指向归档 exec_set_id）。

### 7.2 归档
- `POST /api/exec/sets/{exec_set_id}/archive`（需登录；仅 owner 或管理员）  
  - 入参：`{ "reason"?: string }`  
  - 规则：若该执行集仍存在未通过用例（未执行/失败/阻塞等），必须填写 `reason`；否则返回 400。  
  - 出参：归档列表行数据（含归档人/归档时间等）。

### 7.3 归档查询（供归档页使用）
- `GET /api/exec/archives`（需登录）  
  - Query：`project_id?`、`version_id?`、`q?`（用例名关键字）、`limit?`、`offset?`  
  - 权限：管理员可看全部项目；普通用户仅可看自己所属项目下的归档记录（跨成员可读）。  
  - 返回字段补充：`rearchive_count`（重归档次数）、`archive_state`（`archived`/`rerun`）。

- `GET /api/exec/archives/{exec_set_id}`（需登录）  
  - 出参：归档元信息 + `cases`（完整执行用例列表，含实际结果/备注/缺陷链接/复用子项等），并包含 `rearchive_count`、`archive_state`。

### 7.4 删除归档（管理员）
- `DELETE /api/exec/archives/{exec_set_id}`（仅管理员）  
  - 说明：物理删除归档记录（级联删除该执行集及其执行用例/历史），不可撤回。

### 7.5 归档恢复（管理员/组长）
- `POST /api/exec/archives/{exec_set_id}/restore`（管理员/组长）  
  - 出参：`{ archive_exec_set_id, restored_exec_set_id, project_id, version_id?, version_name?, version_box_existed }`  
  - 说明：恢复归档用例为“执行中”状态，版本盒子存在则直接归入，不存在则新建；重执状态下不可再次恢复。

## 8. 个人 MCP 凭据与远程 MCP

凭据管理接口仅接受网页登录凭据，MCP Token 不能调用凭据管理或其他普通 API。

- `GET /api/mcp-tokens`：仅列出本人凭据元信息（ID、名称、前缀、只读标记、有效期、撤销状态），不返回明文或哈希。
- `POST /api/mcp-tokens`：`{ name, expires_in_days?: 1..365, read_only?: bool }`；默认 90 天，最多 20 个有效凭据。201 返回元信息及仅本次显示的 `token`。服务端只保存 SHA-256 哈希。
- `DELETE /api/mcp-tokens/{token_id}`：撤销本人凭据；不存在或属于其他用户时 404。
- `POST /mcp`：Streamable HTTP，Bearer 个人 MCP Token，JSON-RPC 2.0。支持 initialize、ping、tools/list、tools/call、resources/list、resources/read、resources/templates/list。支持 2025-06-18、2025-03-26 协议协商；GET/DELETE 返回 405，不建立有状态会话。
- MCP `create_case_file`（项目范围）/`append_case_items`（文件范围）写入前检查相似用例；命中时 `isError=true`、`error.code=CASE_REVIEW_REQUIRED`，返回 `review_token`、候选下标、已有用例摘要、匹配原因和字段差异，整批不写入、不登记成功幂等回执。AI 展示对比并取得用户选择后，原调用补充 `similarity_review: {review_token, decisions:[{item_index, action:"update"|"add"|"skip", case_item_id?}]}`；仅 update 指定返回的匹配 ID。令牌绑定凭据、原请求和数据快照，过期须重读重确认。确认后可混合修改/新增/跳过并原子提交，返回 `review_summary`；全部修改/跳过时不创建空文件。规则、限制及示例见 MCP_GUIDE.md“新增用例前的相似确认”。
- 请求 `Accept` 必须同时包含 application/json、text/event-stream；请求体最多 2 MiB。不支持 JSON-RPC 批处理。通知 202，无效认证 401，未允许的 Origin 403。
- 每次工具调用校验当前用户、项目及对象权限。业务权限不足返回 MCP `isError=true` / `PERMISSION_DENIED`，不改变身份、不自动重试提权。
- 写操作要求 `idempotency_key`。同一用户、相同键及参数返回原结果；键复用到不同参数返回 CONFLICT。回执与业务写入在同一事务中提交，重放前仍校验实时权限。
- 修改用例、追加用例和记录结果要求 `expected_updated_at`，不匹配返回 CONFLICT，防止覆盖并发变更。批量新建/追加最多 200 条，失败整批回滚。追加重复项按现有业务规则跳过并返回计数。
- 工具清单、参数、Codex App/CLI 配置与部署说明见 MCP_GUIDE.md。

## 9. 项目知识库授权

所有知识读取（包括网页旧接口）都必须使用已登记且当前用户有权限的来源，不再允许仅凭登录访问任意知识库 URL。

- `GET /api/knowledge-base/sources?project_id=`：列出已授权、启用的知识库。普通成员仅所属项目，管理员按现有全项目权限读取。
- `POST /api/knowledge-base/sources`（管理员）：`{ project_id, name, base_url }`，201 返回登记。相同项目和规范化地址再次登记会更新名称并启用；共享给另一个项目需显式再次登记。
- `DELETE /api/knowledge-base/sources/{source_id}`（管理员）：停用知识库，后续请求立即拒绝，包含缓存读取。
- `POST /api/knowledge-base/access`：只检查授权，不访问源站。入参 `{ project_id?, knowledge_base_id?, base_url? }`，成功返回 `{ id, project_id, allowed: true }`，用于网页复用已下载上下文前重新鉴权。
- 原 `POST /api/knowledge-base/validate|catalog|documents|search` 接受同一来源选择参数。传 ID 时由服务器解析地址；旧 base_url 仅在匹配到已授权登记时接受。同时传项目、ID、URL 时必须全部匹配。无授权统一返回 403，不泄漏未授权知识库的目录、摘要或正文。
- 文档读取参数 `doc_ids` 必须属于授权来源目录。目录清单中的资源路径不能跳出该来源目录。MCP 知识工具仅接受项目与知识库 ID，不接受 URL。
- 旧个人地址不自动迁移为共享知识库，管理员需按真实项目归属登记。源站若可被用户无鉴权直接访问，需在部署时限制为平台服务器可达；平台鉴权无法保护被绕过的公开源站。

模型列表代理 `POST /api/model-proxy/models` 仅接受不带查询参数的标准 `/models` 地址，不支持任意文件 GET，避免绕过知识库项目授权。
