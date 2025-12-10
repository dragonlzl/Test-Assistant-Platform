from datetime import datetime
from typing import List, Optional

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


class CaseFileImportRequest(BaseModel):
    project_id: int
    version_id: Optional[int] = None
    file_name: str
    source: Optional[str] = None
    items: List[CaseItemPayload]


class CaseFileOut(BaseModel):
    id: int
    project_id: int
    version_id: Optional[int]
    file_name_clean: str
    importer_id: Optional[int]
    imported_at: datetime
    updated_at: datetime
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


class ExecSetCreate(BaseModel):
    project_id: int
    version_id: Optional[int] = None
    name: str
    source: Optional[str] = None


class ExecSetOut(BaseModel):
    id: int
    project_id: int
    version_id: Optional[int]
    name: str
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ExecCaseCreateFromLibrary(BaseModel):
    case_item_ids: List[int]


class ExecCaseOut(BaseModel):
    id: int
    exec_set_id: int
    case_item_id: Optional[int]
    module: str
    title: str
    expected: str
    actual_result: Optional[str]
    defect_link: Optional[str]
    remark: Optional[str]
    status: str
    order_no: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ExecCaseUpdate(BaseModel):
    module: Optional[str] = None
    title: Optional[str] = None
    expected: Optional[str] = None
    actual_result: Optional[str] = None
    defect_link: Optional[str] = None
    remark: Optional[str] = None
    status: Optional[str] = None
