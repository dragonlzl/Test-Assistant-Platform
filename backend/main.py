from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .api import api_router
from .config import BASE_DIR, settings
from .db import Base, SessionLocal, engine
from .initial_data import init_db


app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _run_startup_tasks() -> None:
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
