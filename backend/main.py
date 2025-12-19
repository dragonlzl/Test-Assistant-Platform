from pathlib import Path
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .api import api_router
from .audit import reset_operation_context, set_operation_context
from .config import BASE_DIR, settings
from .db import Base, SessionLocal, engine
from .initial_data import init_db
from .migrations import apply_migrations

logger = logging.getLogger("tap")

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def bind_operation_context(request, call_next):
    page = request.headers.get("x-tap-page")
    batch_flag = request.headers.get("x-tap-batch")
    batch = None
    if batch_flag is not None:
        raw = str(batch_flag or "").strip().lower()
        batch = raw in ("1", "true", "yes", "y", "on")
    tokens = set_operation_context(page=page, batch=batch)
    try:
        return await call_next(request)
    finally:
        reset_operation_context(tokens)


@app.middleware("http")
async def disable_static_cache(request, call_next):
    # 避免浏览器缓存旧的静态资源导致“逻辑已更新但页面仍表现为旧版本”。
    # API 请求不受影响。
    response = await call_next(request)
    path = request.url.path or ""
    if path.startswith("/api/"):
        return response
    if path == "/" or path.endswith((".html", ".js", ".css")):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"
    return response


def _run_startup_tasks() -> None:
    logger.info("SQLite DB: %s (APP_DB_FILE=%s)", settings.sqlite_url, settings.db_file)
    # 先做增量迁移，再 create_all，避免历史库缺列导致启动后接口 500。
    apply_migrations(engine)
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        init_db(db)
    finally:
        db.close()


@app.on_event("startup")
def on_startup() -> None:
    _run_startup_tasks()


app.include_router(api_router)

STATIC_DIR = Path(BASE_DIR)
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8080,
        reload=True,
    )
