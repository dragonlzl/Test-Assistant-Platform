"""Exercise the static ASGI request path without importing the app or opening a DB."""
import ntpath
from pathlib import Path
import posixpath
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from urllib.parse import unquote

from starlette.applications import Starlette
from starlette.routing import Mount
from starlette.staticfiles import StaticFiles

from backend.static_files import PlatformStaticFiles


class PlatformStaticFilesTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="tap-static-test-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name) / "public"
        self.root.mkdir()
        self.published = (
            "index.html", "style.css", "MCP_GUIDE.md", "services/apiClient.js",
            "scripts/modules/authGuard.js", "scripts/modules/bootstrap.js",
            "scripts/vendor/mind-elixir.css", "styles/workspace-shell.css",
            "styles/workspace-lists.css", "config/constants.js", "assets/favicon.svg",
            "caseTemplate/manifest.json", "caseTemplate/example.xmind",
        )
        self.private = (
            "data/app.db", "data/backups/app.db/short.db", "data/backups/app.db/long.db",
            "backend/config.py", "config/auth.json", "feishu_config.json", ".git/config",
            "scripts/.private.js", "assets/.private/file.css", "scripts/private.json",
            "data/private.js", "backend/private.css",
        )
        for name in self.published + self.private:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(name, encoding="utf-8")
        (self.root.parent / "outside.js").write_text("private", encoding="utf-8")
        self.static = PlatformStaticFiles(directory=self.root, html=True)
        self.app = Starlette(routes=[Mount("/", app=self.static)])

    async def request(self, path, method="GET"):
        scope = {
            "type": "http", "method": method, "path": unquote(path),
            "root_path": "", "scheme": "http", "query_string": b"", "headers": [],
        }
        messages = []

        async def receive():
            return {"type": "http.request", "body": b""}

        async def send(message):
            messages.append(message)

        await self.app(scope, receive, send)
        status = next(message["status"] for message in messages if message["type"] == "http.response.start")
        body = b"".join(message.get("body", b"") for message in messages if message["type"] == "http.response.body")
        return status, body

    async def test_published_assets_load_through_native_asgi_path(self):
        for name in self.published:
            with self.subTest(name=name):
                self.assertEqual(await self.request("/" + name), (200, name.encode()))
        self.assertEqual(await self.request("/"), (200, b"index.html"))
        self.assertEqual(await self.request("/scripts/modules/bootstrap.js", "HEAD"), (200, b""))

    async def test_windows_and_posix_framework_paths_load_assets(self):
        # 模拟框架在两种系统上的输出，确保 Linux CI 也覆盖 Windows 回归。
        for path_module in (ntpath, posixpath):
            for name in ("styles/workspace-shell.css", "scripts/modules/authGuard.js"):
                native_path = path_module.normpath(name)
                with self.subTest(separator=path_module.sep, name=name), \
                        patch.object(StaticFiles, "get_path", return_value=native_path), \
                        patch("backend.static_files.os", SimpleNamespace(sep=path_module.sep)):
                    self.assertEqual(await self.request("/" + name), (200, name.encode()))

    async def test_existing_private_files_stay_unavailable(self):
        for name in self.private:
            with self.subTest(name=name):
                self.assertEqual((await self.request("/" + name))[0], 404)

    async def test_traversal_cannot_expose_private_or_outside_files(self):
        for path in (
            "/../outside.js", "/%2e%2e/outside.js", "/scripts/../../outside.js",
            "/scripts/../data/private.js", "/scripts/%2e%2e/backend/private.css",
            "/scripts/%2e%2e%5cdata/private.js", "/scripts/%2e%2e%5c%2e%2e%5coutside.js",
        ):
            with self.subTest(path=path):
                self.assertEqual((await self.request(path))[0], 404)

    async def test_backslashes_in_request_urls_stay_rejected(self):
        for path in ("/scripts%5cmodules%5cauthGuard.js", "/styles%5cworkspace-shell.css"):
            with self.subTest(path=path):
                self.assertEqual((await self.request(path))[0], 404)


if __name__ == "__main__":
    unittest.main()
