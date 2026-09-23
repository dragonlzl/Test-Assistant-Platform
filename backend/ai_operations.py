"""Persistent, cumulative MCP provenance; business text and execution results stay separate."""
from datetime import datetime, timezone

from sqlalchemy import and_, or_

from . import models


AI_OPERATIONS = ("created", "child_added", "modified", "executed")


def merge_ai_operations(*values):
    found = {value for items in values if isinstance(items, list) for value in items if isinstance(value, str)}
    return [value for value in AI_OPERATIONS if value in found]


def mark_ai_operation(db, row, operation):
    """Called only after a successful MCP mutation, inside its receipt transaction."""
    if operation not in AI_OPERATIONS:
        raise ValueError("Unknown AI operation")
    if isinstance(row, models.CaseItem):
        source = row
    else:
        source_id = row.case_item_id or row.case_item_source_id
        source = db.get(models.CaseItem, source_id) if source_id else None
        # SQLite can reuse a deleted ID. A historical reference must not mark a newer case.
        if source is not None and not row.case_item_id and source.created_at.replace(tzinfo=timezone.utc) > row.created_at.replace(tzinfo=timezone.utc):
            source = None
    rows = [row]
    if source is not None and operation != "created":
        rows = [source] + db.query(models.ExecCase).filter(or_(
            models.ExecCase.case_item_id == source.id,
            and_(models.ExecCase.case_item_source_id == source.id, models.ExecCase.created_at >= source.created_at),
        )).all()
    flags = merge_ai_operations([operation], *[item.ai_operations for item in rows])
    now = datetime.now(timezone.utc)
    for item in rows:
        if item.ai_operations != flags:
            item.ai_operations = list(flags)
            item.updated_at = now
    db.flush()
