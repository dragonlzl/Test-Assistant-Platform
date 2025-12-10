from fastapi import APIRouter

from .routers import auth, users, projects, cases, exec_routes


api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(projects.router)
api_router.include_router(cases.router)
api_router.include_router(exec_routes.router)


@api_router.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
