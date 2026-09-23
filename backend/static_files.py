"""Serve only published web assets, never the repository/database/config secrets."""
from pathlib import PurePosixPath

from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles


class PlatformStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        target = PurePosixPath(path)
        parts = target.parts
        if any(part.startswith(".") for part in parts) or "\\" in path:
            raise HTTPException(404)
        top = parts[0] if parts else ""
        suffix = target.suffix.lower()
        allowed = (
            (len(parts) <= 1 and (path in (".", "", "MCP_GUIDE.md") or suffix in (".html", ".css", ".js", ".ico")))
            or (top in ("scripts", "services", "config") and suffix in (".js", ".css"))
            or (top == "styles" and suffix == ".css")
            or (top == "caseTemplate" and (path == "caseTemplate/manifest.json" or suffix == ".xmind"))
            or (top in ("assets", "fonts", "images") and suffix in (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".woff", ".woff2", ".ttf", ".css"))
        )
        if not allowed:
            raise HTTPException(404)
        return await super().get_response(path, scope)
