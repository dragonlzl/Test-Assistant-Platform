"""Real query adapter for existing mocked UI datasets; database is always in memory."""
import json
import sys
from datetime import datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.config import settings
settings.db_file = ':memory:'
from backend import models
from backend.db import Base
from backend.operation_query import LogPage, LogSummary, LogDetail, list_logs, summarize_logs, get_log_detail
from fastapi.encoders import jsonable_encoder
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

data = json.load(sys.stdin)
engine = create_engine('sqlite:///:memory:')
Base.metadata.create_all(engine)
with Session(engine) as db:
    users = {}
    for row in data['logs']:
        uid = row.get('user_id')
        if uid and uid not in users:
            users[uid] = models.User(id=uid, username=row.get('username') or str(uid), password_hash='fixture', role='admin', level='leader', is_active=True)
            db.add(users[uid])
    db.flush()
    for row in data['logs']:
        fields = {k:v for k,v in row.items() if k in ('id','user_id','action','target_type','target_id','result','detail')}
        fields['created_at'] = datetime.fromisoformat(row['created_at'].replace('Z','+00:00')).replace(tzinfo=None)
        db.add(models.OperationLog(**fields))
    db.commit()
    admin = type('Admin', (), {'role':'admin'})()
    endpoint = data['endpoint']
    if endpoint.endswith('/summary'):
        result = summarize_logs(db, admin, LogSummary(**data['payload']))
    elif endpoint.endswith('/detail'):
        result = get_log_detail(db, admin, LogDetail(**data['payload']))
    else:
        result = list_logs(db, admin, LogPage(**data['payload']))
    print(json.dumps(jsonable_encoder(result),ensure_ascii=False))
