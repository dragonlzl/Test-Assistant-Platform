import copy
import json
import threading
import unittest
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit
from unittest.mock import patch

from backend import knowledge_base_service as service
from backend import schemas


@contextmanager
def knowledge_server(resources):
    hits = []

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            resource_path = unquote(urlsplit(self.path).path)
            hits.append(resource_path)
            value = resources.get(resource_path)
            if value is None:
                self.send_error(404)
                return
            if isinstance(value, tuple):
                self.send_response(value[0])
                self.send_header("Location", value[1])
                self.end_headers()
                return
            body = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
            encoded = body.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        yield "http://127.0.0.1:%s/kb/" % server.server_port, hits
    finally:
        server.shutdown()
        server.server_close()
        worker.join()


def knowledge_resources(version="version-one", topics=True):
    document = {
        "doc_id": "roles/knight",
        "module": "角色",
        "title": "骑士",
        "relative_path": "roles/knight.md",
        "clean_path": "_llm/docs/roles/knight.md",
        "source_url": "https://wiki.example/knight",
        "source_revision_id": 1234,
        "source_revision_timestamp": "2026-10-26T12:00:00Z",
        "aliases": ["骑士", "骑士三技能"],
        "topics": [{
            "topic_id": "roles/knight::chaos",
            "title": "骑士",
            "heading_path": ["骑士", "技能", "混沌打击"],
            "aliases": ["骑士三技能", "混沌打击"],
            "summary": "攻击附加元素效果。",
            "content": "### 混沌打击\n\n完整主题正文。\n\n#### 边界\n\n最后一个必要条件。",
            "kind": "skill",
            "related_topic_ids": ["rules::damage"],
            "warnings": ["旧版本机制仅供参考。"],
        }],
    }
    manifest = {
        "version": 1,
        "generated_at": version,
        "docs_dir": "_llm/docs",
        "index_path": "_llm/search-index.json",
        "doc_count": 1,
        "entry_count": 1,
    }
    if topics:
        manifest.update(topics_path="_llm/topics.json", topics_version=version)
    return {
        "/kb/kb-manifest.json": manifest,
        "/kb/manifest.json": [{
            "title": document["title"],
            "module_title": document["module"],
            "relative_path": document["relative_path"],
            "source_url": document["source_url"],
            "source_revision_id": 1234,
            "source_revision_timestamp": document["source_revision_timestamp"],
        }],
        "/kb/_llm/search-index.json": {"entries": [{
            "doc_id": document["doc_id"],
            "module": document["module"],
            "title": document["title"],
            "clean_path": document["clean_path"],
            "heading": "角色总览",
            "summary": "属性摘要。",
            "text": "旧正文。",
            "chunk_index": 0,
        }]},
        "/kb/_llm/topics.json": {
            "version": 1,
            "knowledge_version": version,
            "documents": [document],
        },
        "/kb/_llm/docs/roles/knight.md": "# 骑士\n\n旧正文。",
    }


class KnowledgeTopicsServiceTests(unittest.TestCase):
    def setUp(self):
        service._JSON_CACHE.clear()
        service._TEXT_CACHE.clear()

    def test_catalog_only_returns_topic_metadata_and_revision(self):
        resources = knowledge_resources()
        with knowledge_server(resources) as (base_url, hits):
            result = service.catalog_knowledge_base({"base_url": base_url})
        normalized = schemas.KnowledgeBaseCatalogResponse.model_validate(result).model_dump()
        self.assertEqual(normalized["manifest"]["knowledge_version"], "version-one")
        self.assertEqual(normalized["manifest"]["topics_path"], "_llm/topics.json")
        topic = normalized["documents"][0]["topics"][0]
        self.assertEqual(topic["topic_id"], "roles/knight::chaos")
        self.assertEqual(topic["source_revision_id"], "1234")
        self.assertEqual(topic["source_url"], "https://wiki.example/knight")
        self.assertIn("骑士三技能", normalized["documents"][0]["aliases"])
        self.assertNotIn("content", result["documents"][0]["topics"][0])
        self.assertNotIn("完整主题正文", json.dumps(result, ensure_ascii=False))
        self.assertNotIn("/kb/_llm/docs/roles/knight.md", hits)

    def test_topic_read_preserves_complete_content_warnings_and_source(self):
        resources = knowledge_resources()
        topic = resources["/kb/_llm/topics.json"]["documents"][0]["topics"][0]
        topic["content"] = "### 混沌打击\n\n" + "完整条件" * 2000 + "最后边界。"
        with knowledge_server(resources) as (base_url, hits):
            result = service.get_knowledge_base_documents({
                "base_url": base_url,
                "topic_ids": ["roles/knight::chaos", "roles/knight::chaos"],
                "knowledge_version": "version-one",
            })
        document = schemas.KnowledgeBaseDocumentsResponse.model_validate(result).documents[0]
        self.assertEqual(result["doc_count"], 1)
        self.assertEqual(document.doc_id, "roles/knight")
        self.assertEqual(document.topic_id, "roles/knight::chaos")
        self.assertEqual(document.source_revision_id, "1234")
        self.assertEqual(document.sections[0].section_id, document.topic_id)
        self.assertEqual(document.sections[0].heading, "骑士 / 技能 / 混沌打击")
        self.assertIn(topic["content"], document.sections[0].content)
        self.assertIn(topic["warnings"][0], document.sections[0].content)
        self.assertEqual(document.related_topic_ids, ["rules::damage"])
        self.assertEqual(document.sections[0].char_count, len(document.sections[0].content))
        self.assertNotIn("/kb/_llm/docs/roles/knight.md", hits)

    def test_unknown_topic_rejects_entire_request(self):
        with knowledge_server(knowledge_resources()) as (base_url, hits):
            with self.assertRaises(service.KnowledgeBaseServiceError) as raised:
                service.get_knowledge_base_documents({
                    "base_url": base_url,
                    "topic_ids": ["roles/knight::chaos", "unknown"],
                })
        self.assertEqual(raised.exception.status_code, 404)

    def test_topic_limit_precedes_resource_fetch(self):
        with patch.object(service, "_fetch_bytes") as fetch:
            with self.assertRaises(service.KnowledgeBaseServiceError) as raised:
                service.get_knowledge_base_documents({"topic_ids": [str(index) for index in range(33)]})
        self.assertEqual(raised.exception.status_code, 400)
        fetch.assert_not_called()

    def test_version_endpoint_refreshes_only_manifest(self):
        resources = knowledge_resources()
        with knowledge_server(resources) as (base_url, hits):
            first = service.get_knowledge_base_version({"base_url": base_url})
            resources["/kb/kb-manifest.json"] = knowledge_resources("version-two")["/kb/kb-manifest.json"]
            second = service.get_knowledge_base_version({"base_url": base_url})
        self.assertEqual(first, {"knowledge_version": "version-one", "topics_available": True})
        self.assertEqual(second, {"knowledge_version": "version-two", "topics_available": True})
        self.assertEqual(hits, ["/kb/kb-manifest.json", "/kb/kb-manifest.json"])

    def test_expected_version_detects_updates_despite_cached_manifest(self):
        resources = knowledge_resources()
        with knowledge_server(resources) as (base_url, hits):
            service.catalog_knowledge_base({"base_url": base_url})
            resources["/kb/kb-manifest.json"] = knowledge_resources("version-two")["/kb/kb-manifest.json"]
            with self.assertRaises(service.KnowledgeBaseServiceError) as raised:
                service.get_knowledge_base_documents({
                    "base_url": base_url,
                    "topic_ids": ["roles/knight::chaos"],
                    "knowledge_version": "version-one",
                })
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(hits.count("/kb/_llm/topics.json"), 1)

    def test_bundle_mismatch_is_not_silently_served_or_cached(self):
        resources = knowledge_resources()
        resources["/kb/_llm/topics.json"]["knowledge_version"] = "wrong"
        with knowledge_server(resources) as (base_url, hits):
            with self.assertRaises(service.KnowledgeBaseServiceError) as raised:
                service.catalog_knowledge_base({"base_url": base_url})
            self.assertEqual(raised.exception.status_code, 409)
            resources["/kb/_llm/topics.json"]["knowledge_version"] = "version-one"
            result = service.catalog_knowledge_base({"base_url": base_url})
        self.assertEqual(len(result["documents"][0]["topics"]), 1)
        self.assertEqual(hits.count("/kb/_llm/topics.json"), 2)

    def test_new_version_never_reuses_old_topic_or_document_cache(self):
        resources = knowledge_resources()
        with knowledge_server(resources) as (base_url, hits):
            first = service.get_knowledge_base_documents({"base_url": base_url, "doc_ids": ["roles/knight"]})
            service.catalog_knowledge_base({"base_url": base_url})
            updated = knowledge_resources("version-two")
            updated["/kb/_llm/docs/roles/knight.md"] = "# 骑士\n\n新版正文与边界。"
            updated["/kb/_llm/topics.json"]["documents"][0]["topics"][0]["content"] = "新版主题。"
            resources.update(updated)
            service.get_knowledge_base_version({"base_url": base_url})
            catalog = service.catalog_knowledge_base({"base_url": base_url})
            document = service.get_knowledge_base_documents({"base_url": base_url, "doc_ids": ["roles/knight"]})
            topic = service.get_knowledge_base_documents({"base_url": base_url, "topic_ids": ["roles/knight::chaos"]})
        self.assertIn("旧正文", first["documents"][0]["sections"][0]["content"])
        self.assertEqual(catalog["manifest"]["knowledge_version"], "version-two")
        self.assertIn("新版正文与边界", document["documents"][0]["sections"][0]["content"])
        self.assertIn("新版主题", topic["documents"][0]["sections"][0]["content"])
        self.assertEqual(hits.count("/kb/_llm/topics.json"), 2)
        self.assertEqual(hits.count("/kb/_llm/docs/roles/knight.md"), 2)

    def test_legacy_library_retains_every_section(self):
        resources = knowledge_resources(topics=False)
        resources["/kb/_llm/docs/roles/knight.md"] = "# 骑士\n\n" + "\n\n".join(
            "## 条件 %s\n\n完整条件正文必须保留到文档末尾。" % index for index in range(27)
        )
        with knowledge_server(resources) as (base_url, hits):
            catalog = service.catalog_knowledge_base({"base_url": base_url})
            result = service.get_knowledge_base_documents({"base_url": base_url, "doc_ids": ["roles/knight"]})
            version = service.get_knowledge_base_version({"base_url": base_url})
        self.assertNotIn("/kb/_llm/topics.json", hits)
        self.assertEqual(catalog["documents"][0].get("topics", []), [])
        self.assertFalse(version["topics_available"])
        self.assertGreater(result["documents"][0]["section_count"], 20)
        self.assertIn("条件 26", result["documents"][0]["sections"][-1]["heading"])

    def test_topic_path_cannot_escape_and_redirect_is_not_followed(self):
        for path in ("../other/topics.json", "%2e%2e/other/topics.json", "//other.example/topics.json"):
            resources = knowledge_resources()
            resources["/kb/kb-manifest.json"]["topics_path"] = path
            with self.subTest(path=path), knowledge_server(resources) as (base_url, hits):
                with self.assertRaises(service.KnowledgeBaseServiceError) as raised:
                    service.catalog_knowledge_base({"base_url": base_url})
                self.assertEqual(raised.exception.status_code, 502)
                self.assertEqual(len(hits), 3)
        resources = knowledge_resources()
        resources["/kb/_llm/topics.json"] = (302, "/private/topics.json")
        with knowledge_server(resources) as (base_url, hits):
            with self.assertRaises(service.KnowledgeBaseServiceError) as raised:
                service.catalog_knowledge_base({"base_url": base_url})
        self.assertEqual(raised.exception.status_code, 502)
        self.assertNotIn("/private/topics.json", hits)

    def test_duplicate_topic_ids_are_rejected(self):
        resources = knowledge_resources()
        document = resources["/kb/_llm/topics.json"]["documents"][0]
        document["topics"].append(copy.deepcopy(document["topics"][0]))
        with knowledge_server(resources) as (base_url, hits):
            with self.assertRaises(service.KnowledgeBaseServiceError) as raised:
                service.catalog_knowledge_base({"base_url": base_url})
        self.assertEqual(raised.exception.status_code, 502)

    def test_web_routes_authorize_before_any_resource_fetch(self):
        from fastapi import HTTPException
        from backend.routers import knowledge_base as router_module

        endpoints = {
            "version": (router_module.version_shared_knowledge_base, schemas.KnowledgeBaseVersionRequest),
            "catalog": (router_module.catalog_shared_knowledge_base, schemas.KnowledgeBaseCatalogRequest),
            "documents": (router_module.list_shared_knowledge_base_documents, schemas.KnowledgeBaseDocumentsRequest),
            "search": (router_module.search_shared_knowledge_base, schemas.KnowledgeBaseSearchRequest),
            "validate": (router_module.validate_shared_knowledge_base, schemas.KnowledgeBaseValidateRequest),
        }
        with patch.object(router_module, "authorized_payload", side_effect=HTTPException(403, "没有权限")) as authorize:
            with patch.object(service, "_fetch_bytes") as fetch:
                for endpoint, (handler, request_type) in endpoints.items():
                    route = next(item for item in router_module.router.routes if item.path.endswith("/" + endpoint))
                    dependencies = [item.call for item in route.dependant.dependencies]
                    self.assertIn(router_module.get_current_user, dependencies)
                    self.assertIn(router_module.get_db, dependencies)
                    with self.assertRaises(HTTPException) as raised:
                        handler(request_type(base_url="http://kb.test/"), user=object(), db=object())
                    self.assertEqual(raised.exception.status_code, 403)
                fetch.assert_not_called()
        self.assertEqual(authorize.call_count, 5)


if __name__ == "__main__":
    unittest.main()
