from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    PrimaryKeyConstraint,
    String,
    Text,
    UniqueConstraint,
    func,
    Index,
)
from sqlalchemy.orm import relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(16), nullable=False, default="user")
    level = Column(String(16), nullable=False, default="member")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False
    )

    projects = relationship("UserProject", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    refresh_token = Column(String(255), unique=True, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    user = relationship("User", back_populates="sessions")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False
    )

    versions = relationship(
        "ProjectVersion", back_populates="project", cascade="all, delete-orphan"
    )
    members = relationship("UserProject", back_populates="project", cascade="all, delete-orphan")


class ProjectVersion(Base):
    __tablename__ = "project_versions"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_project_version_name"),)

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(128), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False
    )

    project = relationship("Project", back_populates="versions")


class UserProject(Base):
    __tablename__ = "user_projects"
    __table_args__ = (PrimaryKeyConstraint("user_id", "project_id", name="pk_user_project"),)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    role_scope = Column(String(32), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    user = relationship("User", back_populates="projects")
    project = relationship("Project", back_populates="members")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    action = Column(String(64), nullable=False)
    target_type = Column(String(64), nullable=True)
    target_id = Column(Integer, nullable=True)
    result = Column(String(16), nullable=False, default="success")
    detail = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    user = relationship("User")


class CaseFile(Base):
    __tablename__ = "case_files"
    __table_args__ = (
        UniqueConstraint("project_id", "version_id", "file_name_clean", name="uq_case_file_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    version_id = Column(Integer, ForeignKey("project_versions.id", ondelete="SET NULL"))
    file_name_clean = Column(String(255), nullable=False)
    importer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    imported_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False
    )
    source = Column(String(32), nullable=True)

    items = relationship("CaseItem", back_populates="case_file", cascade="all, delete-orphan")


class CaseItem(Base):
    __tablename__ = "case_items"
    __table_args__ = (
        UniqueConstraint("case_file_id", "module", "title", "expected", name="uq_case_item_key"),
        Index("ix_case_items_case_file_id", "case_file_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    case_file_id = Column(Integer, ForeignKey("case_files.id", ondelete="CASCADE"), nullable=False)
    module = Column(String(255), nullable=False)
    title = Column(String(255), nullable=False)
    priority = Column(String(32), nullable=True)
    precondition = Column(Text, nullable=True)
    steps = Column(Text, nullable=True)
    expected = Column(Text, nullable=False)
    remark = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False
    )

    case_file = relationship("CaseFile", back_populates="items")


class ExecSet(Base):
    __tablename__ = "exec_sets"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    version_id = Column(Integer, ForeignKey("project_versions.id", ondelete="SET NULL"))
    source = Column(String(64), nullable=True)
    name = Column(String(255), nullable=False)
    status = Column(String(32), nullable=False, default="active")
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False
    )

    cases = relationship("ExecCase", back_populates="exec_set", cascade="all, delete-orphan")


class ExecCase(Base):
    __tablename__ = "exec_cases"
    __table_args__ = (Index("ix_exec_cases_exec_set_id", "exec_set_id"),)

    id = Column(Integer, primary_key=True, index=True)
    exec_set_id = Column(Integer, ForeignKey("exec_sets.id", ondelete="CASCADE"), nullable=False)
    case_item_id = Column(Integer, ForeignKey("case_items.id", ondelete="SET NULL"))
    module = Column(String(255), nullable=False)
    title = Column(String(255), nullable=False)
    expected = Column(Text, nullable=False)
    actual_result = Column(Text, nullable=True)
    defect_link = Column(Text, nullable=True)
    remark = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="pending")
    order_no = Column(Integer, default=0, nullable=False)
    executor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False
    )

    exec_set = relationship("ExecSet", back_populates="cases")


class ExecCaseHistory(Base):
    __tablename__ = "exec_case_history"
    __table_args__ = (Index("ix_exec_case_history_exec_case_id", "exec_case_id"),)

    id = Column(Integer, primary_key=True, index=True)
    exec_case_id = Column(
        Integer, ForeignKey("exec_cases.id", ondelete="CASCADE"), nullable=False
    )
    field_changed = Column(String(64), nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    changed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    changed_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)


class ExecOverviewStats(Base):
    __tablename__ = "exec_overview_stats"
    __table_args__ = (
        Index("ix_exec_overview_proj_ver_user", "project_id", "version_id", "user_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    version_id = Column(Integer, ForeignKey("project_versions.id", ondelete="SET NULL"))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    total = Column(Integer, default=0, nullable=False)
    pending = Column(Integer, default=0, nullable=False)
    passed = Column(Integer, default=0, nullable=False)
    failed = Column(Integer, default=0, nullable=False)
    blocked = Column(Integer, default=0, nullable=False)
    not_applicable = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)


class Setting(Base):
    __tablename__ = "settings"
    __table_args__ = (UniqueConstraint("scope", "owner_id", "key", name="uq_settings_scope_key"),)

    id = Column(Integer, primary_key=True, index=True)
    scope = Column(String(16), nullable=False, default="user")
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    key = Column(String(128), nullable=False)
    value_json = Column(JSON, nullable=True)
    updated_at = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False
    )


class ModelConfig(Base):
    __tablename__ = "model_configs"
    __table_args__ = (UniqueConstraint("owner_id", "name", name="uq_model_config_name"),)

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    name = Column(String(128), nullable=False)
    config_json = Column(JSON, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False
    )


class FeatureAssignment(Base):
    __tablename__ = "feature_assignments"
    __table_args__ = (UniqueConstraint("owner_id", "name", name="uq_feature_assignment_name"),)

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    name = Column(String(128), nullable=False)
    config_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False
    )
    user = relationship("User")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    path_or_blob = Column(Text, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
