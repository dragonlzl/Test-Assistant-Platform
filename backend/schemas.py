from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field, ConfigDict


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: "UserOut"


class LoginRequest(BaseModel):
    username: str
    password: str


class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8)


class UserBase(BaseModel):
    username: str
    role: str
    level: str
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


class UserOut(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    username: str
    password: Optional[str] = None
    role: str = "user"
    level: str = "member"
    is_active: bool = True


class UserUpdate(BaseModel):
    role: Optional[str] = None
    level: Optional[str] = None
    is_active: Optional[bool] = None


class AdminPasswordConfirm(BaseModel):
    admin_password: str


class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ProjectOut(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime
    versions: List["ProjectVersionOut"] = []


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    description: Optional[str] = None


class ProjectVersionOut(BaseModel):
    id: int
    project_id: int
    name: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ProjectVersionCreate(BaseModel):
    name: str


class UserProjectAssignment(BaseModel):
    user_id: int
    project_ids: List[int]


class UserProjectBrief(BaseModel):
    project_id: int
    project_name: str
    model_config = ConfigDict(from_attributes=True)


TokenResponse.update_forward_refs()
ProjectOut.update_forward_refs()


class CaseItemPayload(BaseModel):
    module: str
    title: str
    expected: str
    priority: Optional[str] = None
    precondition: Optional[str] = None
    steps: Optional[str] = None
    remark: Optional[str] = None


class CaseItemPatch(BaseModel):
    module: Optional[str] = None
    title: Optional[str] = None
    expected: Optional[str] = None
    priority: Optional[str] = None
    precondition: Optional[str] = None
    steps: Optional[str] = None
    remark: Optional[str] = None


class CaseFileImportRequest(BaseModel):
    project_id: int
    version_id: Optional[int] = None
    file_name: str
    source: Optional[str] = None
    reuse_enabled: Optional[bool] = None
    items: List[CaseItemPayload]


class CaseFileOut(BaseModel):
    id: int
    project_id: int
    version_id: Optional[int]
    file_name_clean: str
    reuse_enabled: bool = False
    item_count: Optional[int] = None
    importer_id: Optional[int]
    importer_name: Optional[str] = None
    imported_at: datetime
    updated_at: datetime
    last_updated_by: Optional[int] = None
    last_updated_by_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class CaseItemOut(BaseModel):
    id: int
    case_file_id: int
    module: str
    title: str
    expected: str
    priority: Optional[str] = None
    precondition: Optional[str] = None
    steps: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CaseFileAppendRequest(BaseModel):
    items: List[CaseItemPayload]
    overwrite_existing: bool = False


class CaseFileAppendOut(BaseModel):
    case_file_id: int
    project_id: int
    version_id: Optional[int] = None
    file_name_clean: str
    appended: int = 0
    overwritten: int = 0
    overwritten_changed: int = 0
    skipped_payload_duplicates: int = 0
    skipped_db_conflicts: int = 0
    skipped_existing_conflicts: int = 0
    total_payload: int = 0
    total_unique: int = 0
    updated_at: datetime


class ExecSetCreate(BaseModel):
    project_id: int
    version_id: Optional[int] = None
    name: str
    source: Optional[str] = None
    case_file_id: Optional[int] = None
    requirement: Optional[str] = None
    reuse_enabled: bool = False
    reuse_presets: Optional[List[Any]] = None


class ExecSetOut(BaseModel):
    id: int
    project_id: int
    version_id: Optional[int]
    source: Optional[str] = None
    case_file_id: Optional[int] = None
    name: str
    requirement: Optional[str] = None
    reuse_enabled: bool = False
    reuse_presets: Optional[Any] = None
    case_count: Optional[int] = None
    status: str
    created_at: datetime
    updated_at: datetime
    case_file_base_updated_at: Optional[datetime] = None
    case_file_last_synced_at: Optional[datetime] = None
    case_file_last_diff_at: Optional[datetime] = None
    case_file_last_diff_json: Optional[Any] = None
    case_file_last_diff_shown_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class ExecSetByCaseFileOut(BaseModel):
    case_file_id: int
    active_users: List[str] = []


class CaseLibraryCaseSnapshot(BaseModel):
    module: str
    title: str
    priority: Optional[str] = None
    precondition: str = ""
    steps: str = ""
    expected: str
    remark: Optional[str] = None


class ExecCaseLibraryDiffEntry(BaseModel):
    kind: str
    case_item_id: Optional[int] = None
    changed_fields: List[str] = []
    old: Optional[CaseLibraryCaseSnapshot] = None
    new: Optional[CaseLibraryCaseSnapshot] = None


class ExecCaseLibraryDiffSummary(BaseModel):
    appended: int = 0
    added: int = 0
    updated: int = 0
    deleted: int = 0


class ExecCaseLibraryDiffHistoryBatch(BaseModel):
    diff_at: datetime
    operator: Optional[str] = None
    summary: ExecCaseLibraryDiffSummary
    diff: List[ExecCaseLibraryDiffEntry] = []


class ExecCaseLibrarySyncOut(BaseModel):
    exec_set_id: int
    case_file_id: int
    case_file_updated_at: datetime
    base_updated_at: Optional[datetime] = None
    last_diff_at: Optional[datetime] = None
    last_shown_at: Optional[datetime] = None
    ever_changed: bool = False
    has_new_diff: bool = False
    should_auto_popup: bool = False
    summary: ExecCaseLibraryDiffSummary
    diff: List[ExecCaseLibraryDiffEntry] = []
    history: List[ExecCaseLibraryDiffHistoryBatch] = []


class CaseLibraryChangeFileOut(BaseModel):
    project_id: int
    file_name_clean: str
    case_file_id: Optional[int] = None
    version_id: Optional[int] = None
    is_deleted: bool = False
    last_changed_at: datetime
    last_operator: Optional[str] = None
    importer_name: Optional[str] = None
    imported_at: Optional[datetime] = None
    last_updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    total_events: int = 0


class CaseLibraryChangeEntryOut(BaseModel):
    id: int
    kind: str
    changed_at: datetime
    operator: Optional[str] = None
    changed_fields: List[str] = []
    old: Optional[CaseLibraryCaseSnapshot] = None
    new: Optional[CaseLibraryCaseSnapshot] = None
    meta: Optional[Any] = None


class CaseLibraryChangeHistoryOut(BaseModel):
    project_id: int
    file_name_clean: str
    case_file_id: Optional[int] = None
    version_id: Optional[int] = None
    is_deleted: bool = False
    history: List[CaseLibraryChangeEntryOut] = []


class ExecCaseCreateFromLibrary(BaseModel):
    case_item_ids: List[int]


class ExecCaseOut(BaseModel):
    id: int
    exec_set_id: int
    case_item_id: Optional[int]
    module: str
    title: str
    expected: str
    priority: Optional[str] = None
    precondition: Optional[str] = None
    steps: Optional[str] = None
    actual_result: Optional[str]
    defect_link: Optional[str]
    reuse_details: Optional[Any] = None
    defect_links: Optional[Any] = None
    remark: Optional[str]
    status: str
    order_no: int
    executor_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ExecCaseUpdate(BaseModel):
    module: Optional[str] = None
    title: Optional[str] = None
    expected: Optional[str] = None
    priority: Optional[str] = None
    precondition: Optional[str] = None
    steps: Optional[str] = None
    actual_result: Optional[str] = None
    defect_link: Optional[str] = None
    reuse_details: Optional[Any] = None
    defect_links: Optional[Any] = None
    remark: Optional[str] = None
    status: Optional[str] = None
    executor_id: Optional[int] = None


class ExecCaseCreate(BaseModel):
    case_item_id: Optional[int] = None
    module: Optional[str] = None
    title: Optional[str] = None
    expected: Optional[str] = None
    priority: Optional[str] = None
    precondition: Optional[str] = None
    steps: Optional[str] = None
    remark: Optional[str] = None
    status: Optional[str] = None
    reuse_details: Optional[Any] = None
    defect_links: Optional[Any] = None
    after_case_id: Optional[int] = None


class ExecSetUpdate(BaseModel):
    status: Optional[str] = None
    requirement: Optional[str] = None
    reuse_enabled: Optional[bool] = None
    reuse_presets: Optional[Any] = None


class ExecSetArchiveRequest(BaseModel):
    reason: Optional[str] = None


class ExecArchiveListItemOut(BaseModel):
    exec_set_id: int
    project_id: int
    project_name: str
    version_id: Optional[int] = None
    version_name: Optional[str] = None
    name: str
    case_count: int = 0
    reuse_enabled: bool = False
    imported_by: Optional[int] = None
    imported_by_name: Optional[str] = None
    imported_at: datetime
    archived_by: Optional[int] = None
    archived_by_name: Optional[str] = None
    archived_at: Optional[datetime] = None
    archived_reason: Optional[str] = None


class ExecArchiveDetailOut(ExecArchiveListItemOut):
    cases: List[ExecCaseOut] = []


class ExecImportCasePayload(BaseModel):
    module: str
    title: str
    expected: str
    priority: Optional[str] = None
    precondition: Optional[str] = None
    steps: Optional[str] = None
    remark: Optional[str] = None
    status: Optional[str] = None
    reuse_details: Optional[Any] = None
    defect_links: Optional[Any] = None


class ExecSetFromCaseFileRequest(BaseModel):
    case_file_id: int
    # 执行版本：用于执行页分组/归档等展示口径；不传则默认沿用用例库导入版本。
    exec_version_id: Optional[int] = None
    mode: str = "replace"
    preserve_results: bool = True
    prefer_result_source: str = "db"
    import_cases: Optional[List[ExecImportCasePayload]] = None
    requirement: Optional[str] = None
    reuse_enabled: Optional[bool] = None
    reuse_presets: Optional[Any] = None


class ExecOverviewOut(BaseModel):
    project_id: int
    version_id: Optional[int]
    user_id: Optional[int]
    username: Optional[str] = None
    total: int
    pending: int
    passed: int
    failed: int
    blocked: int
    not_applicable: int


class ExecOverviewExecSetOut(BaseModel):
    exec_set_id: int
    exec_set_name: str
    version_id: Optional[int]
    status: str
    requirement: Optional[str] = None
    total: int
    pending: int
    passed: int
    failed: int
    blocked: int
    not_applicable: int
    created_at: datetime
    updated_at: datetime


class ExecOverviewUserLayoutOut(BaseModel):
    project_id: int
    version_id: Optional[int]
    user_id: int
    username: str
    level: Optional[str] = None
    user_created_at: datetime
    total: int
    pending: int
    passed: int
    failed: int
    blocked: int
    not_applicable: int
    ui_placement: Optional[Any] = None
    exec_sets: List[ExecOverviewExecSetOut]


class ExecOverviewCaseOut(BaseModel):
    exec_case_id: int
    exec_set_id: int
    exec_set_name: str
    version_id: Optional[int]
    module: str
    title: str
    status: str
    updated_at: datetime


class SettingItem(BaseModel):
    key: str
    value_json: Optional[Any] = None


class SettingsUpdateRequest(BaseModel):
    scope: str = "user"
    items: List[SettingItem]


class SettingOut(BaseModel):
    id: int
    scope: str
    owner_id: Optional[int]
    key: str
    value_json: Optional[Any] = None
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ModelConfigBase(BaseModel):
    name: str
    config_json: Optional[Any] = None
    is_active: bool = True


class ModelConfigCreate(ModelConfigBase):
    scope: str = "user"


class ModelConfigUpdate(BaseModel):
    name: Optional[str] = None
    config_json: Optional[Any] = None
    is_active: Optional[bool] = None


class ModelConfigOut(ModelConfigBase):
    id: int
    owner_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class FeatureAssignmentBase(BaseModel):
    name: str
    config_json: Optional[Any] = None


class FeatureAssignmentCreate(FeatureAssignmentBase):
    scope: str = "user"


class FeatureAssignmentUpdate(BaseModel):
    name: Optional[str] = None
    config_json: Optional[Any] = None


class FeatureAssignmentOut(FeatureAssignmentBase):
    id: int
    owner_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class OperationLogOut(BaseModel):
    id: int
    user_id: Optional[int]
    username: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    result: str
    detail: Optional[Any] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class OperationLogEventIn(BaseModel):
    action: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    result: str = "success"
    detail: Optional[Any] = None
