import json
import re
import threading
import time
from http import client as http_client
from typing import Any, Dict, List, Optional, Tuple
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request


DEFAULT_TIMEOUT_SEC = 15
MAX_VALIDATE_DOCS = 200
DEFAULT_MAX_CANDIDATES = 12
MAX_MAX_CANDIDATES = 20
DEFAULT_CATALOG_MAX_DOCS = 300
MAX_CATALOG_MAX_DOCS = 1000
DEFAULT_DOCUMENT_MAX_DOCS = 8
MAX_DOCUMENT_MAX_DOCS = 8
DEFAULT_SECTION_LIMIT = 20
DEFAULT_SECTION_CHAR_LIMIT = 1500
MIN_SECTION_MERGE_CHARS = 12
JSON_CACHE_TTL_SEC = 300
DOC_CACHE_TTL_SEC = 1800
FETCH_RETRY_COUNT = 3
FETCH_RETRY_DELAY_SEC = 0.2

_JSON_CACHE = {}
_TEXT_CACHE = {}
_CACHE_LOCK = threading.RLock()

_CN_STOP_WORDS = {
    "当前", "本次", "此次", "相关", "需要", "用于", "功能", "模块", "场景", "规则", "内容",
    "需求", "说明", "测试", "生成", "用例", "补充", "上下文", "处理", "操作", "支持", "可以",
    "进行", "以及", "还有", "之间", "如何", "这个", "那个", "已经", "继续", "默认", "当前需求",
}
_EN_STOP_WORDS = {
    "the", "and", "for", "with", "this", "that", "from", "into", "need", "needs", "test",
    "tests", "case", "cases", "module", "modules", "rule", "rules", "flow", "page", "pages",
    "current", "visible", "generate", "generation", "context",
}
_MARKDOWN_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")


class KnowledgeBaseServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = str(message or "知识库服务异常")
        self.status_code = int(status_code or 400)


class _NoRedirectHandler(urllib_request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _build_opener():
    return urllib_request.build_opener(_NoRedirectHandler())


def _normalize_timeout_sec(value: Optional[int]) -> int:
    try:
        timeout = int(value or DEFAULT_TIMEOUT_SEC)
    except Exception:
        timeout = DEFAULT_TIMEOUT_SEC
    if timeout < 3:
        timeout = 3
    if timeout > 60:
        timeout = 60
    return timeout


def normalize_base_url(raw_url: Optional[str]) -> str:
    url = str(raw_url or "").strip()
    if not url:
        raise KnowledgeBaseServiceError("知识库地址不能为空", 400)
    parsed = urllib_parse.urlparse(url)
    scheme = str(parsed.scheme or "").lower()
    if scheme not in ("http", "https"):
        raise KnowledgeBaseServiceError("知识库地址仅支持 http/https", 400)
    if not parsed.netloc:
        raise KnowledgeBaseServiceError("知识库地址格式不正确", 400)
    path = parsed.path or "/"
    if not path.endswith("/"):
        path += "/"
    return urllib_parse.urlunparse((scheme, parsed.netloc, path, "", "", ""))


def _build_resource_url(base_url: str, relative_path: str) -> str:
    joined = urllib_parse.urljoin(base_url, str(relative_path or "").lstrip("/"))
    parsed = urllib_parse.urlparse(joined)
    normalized_path = urllib_parse.quote(
        urllib_parse.unquote(parsed.path or ""),
        safe="/-._~",
    )
    return urllib_parse.urlunparse((
        parsed.scheme,
        parsed.netloc,
        normalized_path,
        "",
        parsed.query or "",
        "",
    ))


def _cache_get(cache_map: Dict[str, Any], cache_key: str, ttl_sec: int):
    now = time.time()
    with _CACHE_LOCK:
        payload = cache_map.get(cache_key)
        if not payload:
            return None
        fetched_at = float(payload.get("fetched_at") or 0)
        if fetched_at <= 0 or now - fetched_at > ttl_sec:
            cache_map.pop(cache_key, None)
            return None
        return payload.get("value")


def _cache_set(cache_map: Dict[str, Any], cache_key: str, value: Any):
    with _CACHE_LOCK:
        cache_map[cache_key] = {
            "fetched_at": time.time(),
            "value": value,
        }


def _is_retryable_fetch_reason(reason: Any) -> bool:
    if reason is None:
        return False
    if isinstance(reason, (
        TimeoutError,
        ConnectionError,
        ConnectionResetError,
        ConnectionAbortedError,
        BrokenPipeError,
        http_client.RemoteDisconnected,
        http_client.IncompleteRead,
    )):
        return True
    text = str(reason).strip().lower()
    if not text:
        return False
    markers = [
        "remote end closed connection without response",
        "closed connection",
        "connection reset",
        "connection aborted",
        "broken pipe",
        "timed out",
    ]
    return any(marker in text for marker in markers)


def _is_retryable_fetch_exception(exc: Exception) -> bool:
    if isinstance(exc, (
        TimeoutError,
        ConnectionError,
        ConnectionResetError,
        ConnectionAbortedError,
        BrokenPipeError,
        http_client.RemoteDisconnected,
        http_client.IncompleteRead,
    )):
        return True
    if isinstance(exc, urllib_error.URLError):
        return _is_retryable_fetch_reason(exc.reason)
    return _is_retryable_fetch_reason(exc)


def _fetch_bytes(url: str, timeout_sec: int) -> bytes:
    request_obj = urllib_request.Request(
        url=url,
        headers={
            "Accept": "application/json,text/plain,text/markdown,*/*",
            "User-Agent": "tap-knowledge-base/1.0",
        },
        method="GET",
    )
    last_exc = None
    for attempt in range(FETCH_RETRY_COUNT):
        opener = _build_opener()
        try:
            with opener.open(request_obj, timeout=timeout_sec) as response:
                return response.read()
        except urllib_error.HTTPError as exc:
            status_code = int(exc.code or 502)
            if status_code == 404:
                raise KnowledgeBaseServiceError("知识库文件不存在：" + url, 502) from exc
            raise KnowledgeBaseServiceError(
                "读取知识库文件失败（HTTP " + str(status_code) + "）：" + url,
                502,
            ) from exc
        except urllib_error.URLError as exc:
            last_exc = exc
            if attempt + 1 < FETCH_RETRY_COUNT and _is_retryable_fetch_exception(exc):
                time.sleep(FETCH_RETRY_DELAY_SEC * (attempt + 1))
                continue
            reason = exc.reason if exc and exc.reason is not None else "网络异常"
            raise KnowledgeBaseServiceError("读取知识库失败：" + str(reason), 502) from exc
        except Exception as exc:
            last_exc = exc
            if attempt + 1 < FETCH_RETRY_COUNT and _is_retryable_fetch_exception(exc):
                time.sleep(FETCH_RETRY_DELAY_SEC * (attempt + 1))
                continue
            raise KnowledgeBaseServiceError("读取知识库失败：" + str(exc), 502) from exc
    raise KnowledgeBaseServiceError("读取知识库失败：" + str(last_exc or "网络异常"), 502)


def _fetch_json(url: str, timeout_sec: int, force_refresh: bool = False):
    cache_key = "json:" + url
    if not force_refresh:
        cached = _cache_get(_JSON_CACHE, cache_key, JSON_CACHE_TTL_SEC)
        if cached is not None:
            return cached
    raw = _fetch_bytes(url, timeout_sec)
    try:
        value = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise KnowledgeBaseServiceError("知识库 JSON 解析失败：" + url, 502) from exc
    _cache_set(_JSON_CACHE, cache_key, value)
    return value


def _fetch_text(url: str, timeout_sec: int, force_refresh: bool = False):
    cache_key = "text:" + url
    if not force_refresh:
        cached = _cache_get(_TEXT_CACHE, cache_key, DOC_CACHE_TTL_SEC)
        if cached is not None:
            return cached
    raw = _fetch_bytes(url, timeout_sec)
    try:
        value = raw.decode("utf-8")
    except Exception:
        value = raw.decode("utf-8", errors="replace")
    _cache_set(_TEXT_CACHE, cache_key, value)
    return value


def _normalize_index_entries(raw_index: Any) -> List[Dict[str, Any]]:
    if isinstance(raw_index, dict):
        entries = raw_index.get("entries")
    else:
        entries = raw_index
    if not isinstance(entries, list):
        raise KnowledgeBaseServiceError("知识库索引格式不正确，entries 不是数组", 502)
    normalized = []
    for item in entries:
        if isinstance(item, dict):
            normalized.append(item)
    return normalized


def _load_resources(base_url: str, timeout_sec: int, force_refresh: bool = False):
    normalized_base_url = normalize_base_url(base_url)
    manifest = _fetch_json(
        _build_resource_url(normalized_base_url, "manifest.json"),
        timeout_sec,
        force_refresh=force_refresh,
    )
    kb_manifest = _fetch_json(
        _build_resource_url(normalized_base_url, "kb-manifest.json"),
        timeout_sec,
        force_refresh=force_refresh,
    )
    index_path = str(kb_manifest.get("index_path") or "_llm/search-index.json").strip()
    if not index_path:
        raise KnowledgeBaseServiceError("知识库 kb-manifest.json 缺少 index_path", 502)
    raw_index = _fetch_json(
        _build_resource_url(normalized_base_url, index_path),
        timeout_sec,
        force_refresh=force_refresh,
    )
    entries = _normalize_index_entries(raw_index)
    if not isinstance(manifest, list):
        raise KnowledgeBaseServiceError("知识库 manifest.json 格式不正确", 502)
    return normalized_base_url, manifest, kb_manifest, entries


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _short_text(value: str, max_chars: int) -> str:
    text = _stringify(value)
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rstrip() + "…"


def _normalize_relative_path(path: str) -> str:
    text = _stringify(path).replace("\\", "/")
    while text.startswith("./"):
        text = text[2:]
    return text.lstrip("/")


def _is_safe_relative_path(path: str) -> bool:
    text = _normalize_relative_path(path)
    if not text:
        return False
    if text.startswith("/") or text.startswith("../") or "/../" in text:
        return False
    return True


def _dedupe_text_list(values: List[Any], limit: Optional[int] = None) -> List[str]:
    result = []
    seen = {}
    for raw in values:
        item = _stringify(raw)
        if not item:
            continue
        lowered = item.lower()
        if lowered in seen:
            continue
        seen[lowered] = True
        result.append(item)
        if limit and len(result) >= limit:
            break
    return result


def _derive_doc_id_from_path(path: str) -> str:
    text = _normalize_relative_path(path)
    if not text:
        return ""
    if text.lower().endswith(".md"):
        text = text[:-3]
    return text.replace("/", "__")


def _join_clean_path(docs_dir: str, relative_path: str) -> str:
    root = _normalize_relative_path(docs_dir)
    relative = _normalize_relative_path(relative_path)
    if not root:
        return relative
    if relative.startswith(root + "/") or relative == root:
        return relative
    if not relative:
        return root
    return _normalize_relative_path(root + "/" + relative)


def _get_docs_dir(kb_manifest: Dict[str, Any]) -> str:
    docs_dir = _normalize_relative_path(kb_manifest.get("docs_dir"))
    return docs_dir or "_llm/docs"


def _build_manifest_metadata(manifest: List[Dict[str, Any]], docs_dir: str) -> Dict[str, Any]:
    items = []
    by_doc_id = {}
    by_relative = {}
    by_clean = {}
    for index, item in enumerate(manifest):
        if not isinstance(item, dict):
            continue
        relative_path = _normalize_relative_path(item.get("relative_path"))
        clean_path = _join_clean_path(docs_dir, relative_path)
        doc_id = _stringify(item.get("doc_id")) or _derive_doc_id_from_path(relative_path or clean_path)
        meta = {
            "doc_id": doc_id,
            "module": _stringify(item.get("module_title") or item.get("module") or item.get("module_slug")),
            "title": _stringify(item.get("title") or item.get("seed_title")),
            "relative_path": relative_path,
            "clean_path": clean_path,
            "source_url": _stringify(item.get("source_url")),
            "order": index,
        }
        items.append(meta)
        if doc_id and doc_id not in by_doc_id:
            by_doc_id[doc_id] = meta
        if relative_path:
            by_relative[relative_path] = meta
            if relative_path.lower().endswith(".md"):
                by_relative[relative_path[:-3]] = meta
        if clean_path:
            by_clean[clean_path] = meta
            if clean_path.lower().endswith(".md"):
                by_clean[clean_path[:-3]] = meta
    return {
        "items": items,
        "by_doc_id": by_doc_id,
        "by_relative": by_relative,
        "by_clean": by_clean,
    }


def _resolve_document_meta(
    manifest_meta: Dict[str, Any],
    docs_dir: str,
    doc_id: str,
    clean_path: str,
    relative_path: str,
) -> Dict[str, Any]:
    stable_doc_id = _stringify(doc_id)
    stable_clean_path = _normalize_relative_path(clean_path)
    stable_relative_path = _normalize_relative_path(relative_path)
    if stable_doc_id and stable_doc_id in manifest_meta.get("by_doc_id", {}):
        return manifest_meta["by_doc_id"][stable_doc_id]
    if stable_clean_path and stable_clean_path in manifest_meta.get("by_clean", {}):
        return manifest_meta["by_clean"][stable_clean_path]
    if stable_relative_path and stable_relative_path in manifest_meta.get("by_relative", {}):
        return manifest_meta["by_relative"][stable_relative_path]
    if stable_clean_path:
        guessed_relative = stable_clean_path
        docs_root = _normalize_relative_path(docs_dir)
        if docs_root and guessed_relative.startswith(docs_root + "/"):
            guessed_relative = guessed_relative[len(docs_root) + 1:]
        if guessed_relative in manifest_meta.get("by_relative", {}):
            return manifest_meta["by_relative"][guessed_relative]
        if guessed_relative.lower().endswith(".md") and guessed_relative[:-3] in manifest_meta.get("by_relative", {}):
            return manifest_meta["by_relative"][guessed_relative[:-3]]
    return {
        "doc_id": stable_doc_id or _derive_doc_id_from_path(stable_relative_path or stable_clean_path),
        "module": "",
        "title": "",
        "relative_path": stable_relative_path,
        "clean_path": stable_clean_path or _join_clean_path(docs_dir, stable_relative_path),
        "source_url": "",
        "order": len(manifest_meta.get("items", [])) + 9999,
    }


def _build_manifest_lookup(manifest: List[Dict[str, Any]], docs_dir: str) -> Dict[str, Dict[str, Any]]:
    metadata = _build_manifest_metadata(manifest, docs_dir)
    result = {}
    for item in metadata.get("items", []):
        relative_path = _normalize_relative_path(item.get("relative_path"))
        clean_path = _normalize_relative_path(item.get("clean_path"))
        doc_id = _stringify(item.get("doc_id"))
        if relative_path:
            result[relative_path] = item
            if relative_path.lower().endswith(".md"):
                result[relative_path[:-3]] = item
        if clean_path:
            result[clean_path] = item
            if clean_path.lower().endswith(".md"):
                result[clean_path[:-3]] = item
        if doc_id:
            result[doc_id] = item
    return result


def _build_manifest_warnings(kb_manifest: Dict[str, Any], manifest: List[Dict[str, Any]], indexed_doc_count: int, entry_count: int) -> List[str]:
    warnings = []
    manifest_doc_count = len(manifest)
    declared_doc_count = int(kb_manifest.get("doc_count") or 0)
    declared_entry_count = int(kb_manifest.get("entry_count") or 0)
    if declared_doc_count and declared_doc_count != manifest_doc_count:
        warnings.append("kb-manifest 声明的文档数与 manifest.json 不一致")
    if declared_doc_count and declared_doc_count != indexed_doc_count:
        warnings.append("kb-manifest 声明的文档数与索引唯一文档数不一致")
    if declared_entry_count and declared_entry_count != entry_count:
        warnings.append("kb-manifest 声明的索引条数与 search-index.json 不一致")
    return warnings


def _build_manifest_summary(
    kb_manifest: Dict[str, Any],
    manifest: List[Dict[str, Any]],
    indexed_doc_count: int,
    entry_count: int,
) -> Dict[str, Any]:
    return {
        "generated_at": _stringify(kb_manifest.get("generated_at")),
        "docs_dir": _stringify(kb_manifest.get("docs_dir")),
        "index_path": _stringify(kb_manifest.get("index_path") or "_llm/search-index.json"),
        "doc_count": int(kb_manifest.get("doc_count") or len(manifest)),
        "entry_count": int(kb_manifest.get("entry_count") or entry_count),
        "manifest_doc_count": len(manifest),
        "indexed_doc_count": indexed_doc_count,
    }


def _build_catalog_items(
    manifest: List[Dict[str, Any]],
    kb_manifest: Dict[str, Any],
    entries: List[Dict[str, Any]],
    max_docs: Optional[int] = None,
) -> List[Dict[str, Any]]:
    docs_dir = _get_docs_dir(kb_manifest)
    manifest_meta = _build_manifest_metadata(manifest, docs_dir)
    grouped = {}
    grouped_by_clean = {}

    for entry in entries:
        doc_id = _stringify(entry.get("doc_id"))
        clean_path = _normalize_relative_path(entry.get("clean_path"))
        meta = _resolve_document_meta(manifest_meta, docs_dir, doc_id, clean_path, "")
        stable_doc_id = doc_id or _stringify(meta.get("doc_id")) or _derive_doc_id_from_path(clean_path)
        if not stable_doc_id:
            continue
        clean_group_key = clean_path or _normalize_relative_path(meta.get("clean_path"))
        group = grouped.get(stable_doc_id)
        if not group and clean_group_key and clean_group_key in grouped_by_clean:
            group = grouped_by_clean[clean_group_key]
            grouped[stable_doc_id] = group
        if not group:
            group = {
                "doc_id": stable_doc_id,
                "module": _stringify(meta.get("module")) or _stringify(entry.get("module")),
                "title": _stringify(meta.get("title")) or _stringify(entry.get("title")) or _stringify(entry.get("heading")),
                "aliases": [],
                "keywords": [],
                "summary": "",
                "relative_path": _normalize_relative_path(meta.get("relative_path")),
                "clean_path": clean_path or _normalize_relative_path(meta.get("clean_path")),
                "source_url": _stringify(meta.get("source_url")),
                "heading_samples": [],
                "order": int(meta.get("order") or 0),
            }
            grouped[stable_doc_id] = group
            if clean_group_key:
                grouped_by_clean[clean_group_key] = group
        group["module"] = group["module"] or _stringify(entry.get("module"))
        group["title"] = group["title"] or _stringify(entry.get("title")) or _stringify(entry.get("heading"))
        if not group["summary"]:
            group["summary"] = _stringify(entry.get("summary"))
        elif len(_stringify(entry.get("summary"))) > len(group["summary"]):
            group["summary"] = _stringify(entry.get("summary"))
        group["relative_path"] = group["relative_path"] or _normalize_relative_path(meta.get("relative_path"))
        group["clean_path"] = group["clean_path"] or clean_path or _normalize_relative_path(meta.get("clean_path"))
        group["source_url"] = group["source_url"] or _stringify(meta.get("source_url"))
        group["aliases"] = _dedupe_text_list(group["aliases"] + list(entry.get("aliases") or []), 16)
        group["keywords"] = _dedupe_text_list(group["keywords"] + list(entry.get("keywords") or []), 20)
        heading = _stringify(entry.get("heading"))
        if heading:
            group["heading_samples"] = _dedupe_text_list(group["heading_samples"] + [heading], 6)

    for meta in manifest_meta.get("items", []):
        stable_doc_id = _stringify(meta.get("doc_id"))
        clean_group_key = _normalize_relative_path(meta.get("clean_path"))
        if clean_group_key and clean_group_key in grouped_by_clean:
            group = grouped_by_clean[clean_group_key]
            if not group.get("relative_path"):
                group["relative_path"] = _normalize_relative_path(meta.get("relative_path"))
            if not group.get("source_url"):
                group["source_url"] = _stringify(meta.get("source_url"))
            if not group.get("module"):
                group["module"] = _stringify(meta.get("module"))
            if not group.get("title"):
                group["title"] = _stringify(meta.get("title"))
            continue
        if not stable_doc_id or stable_doc_id in grouped:
            continue
        grouped[stable_doc_id] = {
            "doc_id": stable_doc_id,
            "module": _stringify(meta.get("module")),
            "title": _stringify(meta.get("title")),
            "aliases": [],
            "keywords": [],
            "summary": "",
            "relative_path": _normalize_relative_path(meta.get("relative_path")),
            "clean_path": _normalize_relative_path(meta.get("clean_path")),
            "source_url": _stringify(meta.get("source_url")),
            "heading_samples": [],
            "order": int(meta.get("order") or 0),
        }
        if clean_group_key:
            grouped_by_clean[clean_group_key] = grouped[stable_doc_id]

    items = []
    seen_group_keys = {}
    for key in grouped:
      group = grouped[key]
      dedupe_key = _normalize_relative_path(group.get("clean_path")) or _stringify(group.get("doc_id")) or _stringify(key)
      if dedupe_key in seen_group_keys:
          continue
      seen_group_keys[dedupe_key] = True
      items.append(group)
    items.sort(key=lambda item: (
        int(item.get("order") or 0),
        _stringify(item.get("module")),
        _stringify(item.get("title")),
        _stringify(item.get("relative_path")),
        _stringify(item.get("doc_id")),
    ))
    for item in items:
        item["summary"] = _short_text(item.get("summary"), 360)
    if max_docs is not None and max_docs > 0:
        items = items[:max_docs]
    return items


def _extract_phrases(text: str, limit: int = 24) -> List[str]:
    source = _stringify(text)
    if not source:
        return []
    parts = re.split(r"[\s,;:：、，。；（）()【】\[\]\n\r\t]+", source)
    result = []
    seen = {}
    for raw in parts:
        item = _stringify(raw)
        if not item:
            continue
        if len(item) > 32:
            item = item[:32]
        key = item.lower()
        if key in seen:
            continue
        seen[key] = True
        result.append(item)
        if len(result) >= limit:
            break
    return result


def _extract_tokens(text: str, limit: int = 60) -> List[str]:
    source = _stringify(text)
    if not source:
        return []
    result = []
    seen = {}

    def add_token(raw_token: str):
        token = _stringify(raw_token)
        if not token:
            return
        lowered = token.lower()
        if lowered in seen:
            return
        if lowered in _EN_STOP_WORDS or token in _CN_STOP_WORDS:
            return
        if len(token) == 1 and not re.match(r"[A-Za-z0-9]", token):
            return
        seen[lowered] = True
        result.append(token)

    for token in re.findall(r"[A-Za-z0-9][A-Za-z0-9_\-]{1,31}", source):
        add_token(token)
        if len(result) >= limit:
            return result
    for token in re.findall(r"[\u4e00-\u9fff]{2,24}", source):
        add_token(token)
        if len(result) >= limit:
            return result
        if len(token) > 4:
            add_token(token[:4])
        if len(result) >= limit:
            return result
    return result[:limit]


def _build_query_context(payload: Dict[str, Any]) -> Dict[str, Any]:
    target_module = _stringify(payload.get("target_module"))
    requirement_label = _stringify(payload.get("requirement_label"))
    requirement_text = _stringify(payload.get("requirement_text"))
    requirement_supplement = _stringify(payload.get("requirement_supplement"))
    visible_modules = payload.get("visible_modules")
    visible_cases = payload.get("visible_cases")

    exact_terms = []
    soft_terms = []
    summary_parts = []

    def add_exact(value: str):
        text = _stringify(value)
        if text and text not in exact_terms:
            exact_terms.append(text)

    def add_soft_terms_from_text(value: str):
        for token in _extract_tokens(value):
            if token not in soft_terms:
                soft_terms.append(token)

    add_exact(target_module)
    add_exact(requirement_label)
    if target_module:
        summary_parts.append(target_module)
    if requirement_label and requirement_label != target_module:
        summary_parts.append(requirement_label)
    add_soft_terms_from_text(requirement_text)
    add_soft_terms_from_text(requirement_supplement)

    if isinstance(visible_modules, list):
        for item in visible_modules[:12]:
            if not isinstance(item, dict):
                continue
            add_exact(item.get("module"))
            add_soft_terms_from_text(" ".join([
                _stringify(item.get("module")),
                " ".join(item.get("key_scenarios") or []),
                " ".join(item.get("test_points") or []),
                " ".join(item.get("case_titles") or []),
            ]))

    if isinstance(visible_cases, list):
        for item in visible_cases[:20]:
            if isinstance(item, dict):
                add_soft_terms_from_text(_stringify(item.get("title")))
            else:
                add_soft_terms_from_text(_stringify(item))

    if requirement_text:
        summary_parts.extend(_extract_phrases(requirement_text, 4))
    if requirement_supplement:
        summary_parts.extend(_extract_phrases(requirement_supplement, 2))

    return {
        "target_module": target_module,
        "requirement_label": requirement_label,
        "requirement_text": requirement_text,
        "requirement_supplement": requirement_supplement,
        "exact_terms": exact_terms[:16],
        "soft_terms": soft_terms[:60],
        "summary": " / ".join(summary_parts[:8]),
    }


def _score_entry(entry: Dict[str, Any], query: Dict[str, Any]) -> Tuple[float, List[str]]:
    title = _stringify(entry.get("title"))
    module = _stringify(entry.get("module"))
    heading = _stringify(entry.get("heading"))
    summary = _stringify(entry.get("summary"))
    snippet = _stringify(entry.get("text"))
    aliases = " ".join([_stringify(item) for item in (entry.get("aliases") or []) if _stringify(item)])
    keywords = " ".join([_stringify(item) for item in (entry.get("keywords") or []) if _stringify(item)])
    title_haystack = " ".join([module, title, heading, aliases]).lower()
    body_haystack = " ".join([summary, snippet, keywords]).lower()

    score = 0.0
    matched_terms = []

    def add_match(term: str, weight: float):
        nonlocal score
        lowered = _stringify(term).lower()
        if not lowered:
            return
        if lowered in title_haystack:
            score += weight
            matched_terms.append(term)
            return
        if lowered in body_haystack:
            score += weight * 0.65
            matched_terms.append(term)

    target_module = _stringify(query.get("target_module"))
    requirement_label = _stringify(query.get("requirement_label"))
    if target_module:
        add_match(target_module, 20.0)
    if requirement_label and requirement_label != target_module:
        add_match(requirement_label, 16.0)

    for term in query.get("exact_terms") or []:
        add_match(term, 12.0)
    for term in query.get("soft_terms") or []:
        add_match(term, 4.0 if len(_stringify(term)) >= 4 else 2.0)

    if module and target_module and module == target_module:
        score += 12.0
    if title and target_module and title == target_module:
        score += 10.0
    if requirement_label and title and requirement_label == title:
        score += 8.0
    if requirement_label and heading and requirement_label == heading:
        score += 6.0

    return score, _dedupe_text_list(matched_terms, 12)


def _make_excerpt(text: str, matched_terms: List[str], max_chars: int = 600) -> str:
    source = _stringify(text)
    if not source:
        return ""
    anchor_index = -1
    for item in matched_terms:
        token = _stringify(item)
        if not token:
            continue
        idx = source.find(token)
        if idx >= 0:
            anchor_index = idx
            break
    if anchor_index < 0:
        return _short_text(source, max_chars)
    start = max(0, anchor_index - 140)
    end = min(len(source), start + max_chars)
    excerpt = source[start:end]
    if start > 0:
        excerpt = "…" + excerpt
    if end < len(source):
        excerpt = excerpt + "…"
    return excerpt


def _collapse_blank_lines(text: str) -> str:
    normalized = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def _parse_markdown_sections(text: str, fallback_heading: str) -> List[Dict[str, Any]]:
    lines = _collapse_blank_lines(text).split("\n")
    sections = []
    preface = []
    current = None
    for raw_line in lines:
        match = _MARKDOWN_HEADING_RE.match(raw_line.strip())
        if match:
            if current:
                sections.append(current)
            current = {
                "heading": _stringify(match.group(2)) or fallback_heading,
                "level": len(match.group(1) or "#"),
                "lines": [],
            }
            continue
        if current is None:
            preface.append(raw_line)
        else:
            current["lines"].append(raw_line)
    if current:
        sections.append(current)
    preface_text = _collapse_blank_lines("\n".join(preface))
    if preface_text:
        sections.insert(0, {
            "heading": fallback_heading,
            "level": 1,
            "lines": [preface_text],
        })
    if not sections:
        return [{
            "heading": fallback_heading,
            "level": 1,
            "lines": [_collapse_blank_lines(text)],
        }]
    result = []
    for item in sections:
        content = _collapse_blank_lines("\n".join(item.get("lines") or []))
        heading = _stringify(item.get("heading")) or fallback_heading
        if content:
            result.append({
                "heading": heading,
                "level": int(item.get("level") or 1),
                "content": content,
            })
    if result:
        return result
    return [{
        "heading": fallback_heading,
        "level": 1,
        "content": _collapse_blank_lines(text),
    }]


def _merge_short_sections(sections: List[Dict[str, Any]], min_chars: int) -> List[Dict[str, Any]]:
    merged = []
    pending = None
    for item in sections:
        section = {
            "heading": _stringify(item.get("heading")),
            "level": int(item.get("level") or 1),
            "content": _collapse_blank_lines(item.get("content")),
        }
        if not section["content"]:
            continue
        if pending:
            pending["content"] = _collapse_blank_lines(
                pending["content"] + "\n\n" + section["heading"] + "\n" + section["content"]
            )
            section = pending
            pending = None
        if len(section["content"]) < min_chars:
            if merged:
                merged[-1]["content"] = _collapse_blank_lines(
                    merged[-1]["content"] + "\n\n" + section["heading"] + "\n" + section["content"]
                )
            else:
                pending = section
            continue
        merged.append(section)
    if pending:
        if merged:
            merged[-1]["content"] = _collapse_blank_lines(
                merged[-1]["content"] + "\n\n" + pending["heading"] + "\n" + pending["content"]
            )
        else:
            merged.append(pending)
    return merged


def _split_long_content(content: str, max_chars: int) -> List[str]:
    text = _collapse_blank_lines(content)
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]
    paragraphs = [item.strip() for item in re.split(r"\n{2,}", text) if item and item.strip()]
    if not paragraphs:
        paragraphs = [text]
    chunks = []
    current = ""
    for para in paragraphs:
        if not current:
            if len(para) <= max_chars:
                current = para
                continue
        if current and len(current) + 2 + len(para) <= max_chars:
            current = current + "\n\n" + para
            continue
        if current:
            chunks.append(current)
            current = ""
        if len(para) <= max_chars:
            current = para
            continue
        start = 0
        while start < len(para):
            end = min(len(para), start + max_chars)
            chunks.append(para[start:end].strip())
            start = end
    if current:
        chunks.append(current)
    return [item for item in chunks if item]


def _build_document_sections(doc_id: str, title: str, doc_text: str) -> List[Dict[str, Any]]:
    parsed_sections = _parse_markdown_sections(doc_text, title or "正文")
    merged_sections = _merge_short_sections(parsed_sections, MIN_SECTION_MERGE_CHARS)
    result = []
    order = 0
    for item in merged_sections:
        chunks = _split_long_content(item.get("content"), DEFAULT_SECTION_CHAR_LIMIT)
        for chunk_index, chunk in enumerate(chunks):
            order += 1
            if order > DEFAULT_SECTION_LIMIT:
                return result
            heading = _stringify(item.get("heading")) or title or "正文"
            if chunk_index > 0:
                heading = heading + "（续" + str(chunk_index + 1) + "）"
            result.append({
                "section_id": _stringify(doc_id) + "::section-" + str(order),
                "heading": heading,
                "content": chunk,
                "order": order,
                "char_count": len(chunk),
            })
    if result:
        return result
    fallback = _short_text(_collapse_blank_lines(doc_text), DEFAULT_SECTION_CHAR_LIMIT)
    if not fallback:
        fallback = "（正文为空）"
    return [{
        "section_id": _stringify(doc_id) + "::section-1",
        "heading": title or "正文",
        "content": fallback,
        "order": 1,
        "char_count": len(fallback),
    }]


def validate_knowledge_base(
    base_url: str,
    timeout_sec: Optional[int] = None,
    force_refresh: bool = False,
    deep_check: bool = True,
) -> Dict[str, Any]:
    timeout = _normalize_timeout_sec(timeout_sec)
    normalized_base_url, manifest, kb_manifest, entries = _load_resources(
        base_url,
        timeout,
        force_refresh=force_refresh,
    )
    docs_dir = _get_docs_dir(kb_manifest)
    lookup = _build_manifest_lookup(manifest, docs_dir)
    catalog_items = _build_catalog_items(manifest, kb_manifest, entries)
    unique_doc_paths = []
    seen_doc_paths = {}
    invalid_paths = []

    for item in catalog_items:
        clean_path = _normalize_relative_path(item.get("clean_path"))
        if not clean_path:
            invalid_paths.append({
                "path": "",
                "detail": "索引条目缺少 clean_path",
            })
            continue
        if not _is_safe_relative_path(clean_path):
            invalid_paths.append({
                "path": clean_path,
                "detail": "索引条目包含非法路径",
            })
            continue
        if clean_path in seen_doc_paths:
            continue
        seen_doc_paths[clean_path] = True
        unique_doc_paths.append(clean_path)

    missing_files = []
    checked_docs = 0
    if deep_check:
        for clean_path in unique_doc_paths[:MAX_VALIDATE_DOCS]:
            checked_docs += 1
            try:
                _fetch_text(
                    _build_resource_url(normalized_base_url, clean_path),
                    timeout,
                    force_refresh=force_refresh,
                )
            except KnowledgeBaseServiceError as exc:
                missing_files.append({
                    "path": clean_path,
                    "detail": exc.message,
                })

    for item in manifest:
        relative_path = _normalize_relative_path(item.get("relative_path"))
        if not relative_path:
            invalid_paths.append({
                "path": "",
                "detail": "manifest.json 存在缺失 relative_path 的条目",
            })
            continue
        if not _is_safe_relative_path(relative_path):
            invalid_paths.append({
                "path": relative_path,
                "detail": "manifest.json 存在非法路径",
            })

    warnings = _build_manifest_warnings(kb_manifest, manifest, len(catalog_items), len(entries))

    return {
        "ok": len(missing_files) == 0 and len(invalid_paths) == 0,
        "base_url": base_url,
        "normalized_base_url": normalized_base_url,
        "manifest": _build_manifest_summary(kb_manifest, manifest, len(catalog_items), len(entries)),
        "checked_doc_count": checked_docs,
        "missing_files": missing_files,
        "invalid_paths": invalid_paths,
        "warnings": warnings,
        "manifest_examples": [
            {
                "title": _stringify(item.get("title")),
                "relative_path": _normalize_relative_path(item.get("relative_path")),
            }
            for item in manifest[:5]
        ],
        "lookup_size": len(lookup),
    }


def catalog_knowledge_base(payload: Dict[str, Any]) -> Dict[str, Any]:
    base_url = payload.get("base_url")
    timeout = _normalize_timeout_sec(payload.get("timeout_sec"))
    force_refresh = payload.get("force_refresh") is True
    raw_max_docs = payload.get("max_docs")
    try:
        max_docs = int(raw_max_docs) if raw_max_docs is not None else DEFAULT_CATALOG_MAX_DOCS
    except Exception:
        max_docs = DEFAULT_CATALOG_MAX_DOCS
    if max_docs < 1:
        max_docs = DEFAULT_CATALOG_MAX_DOCS
    if max_docs > MAX_CATALOG_MAX_DOCS:
        max_docs = MAX_CATALOG_MAX_DOCS

    normalized_base_url, manifest, kb_manifest, entries = _load_resources(
        base_url,
        timeout,
        force_refresh=force_refresh,
    )
    catalog_items = _build_catalog_items(manifest, kb_manifest, entries, max_docs=max_docs)
    return {
        "base_url": _stringify(base_url),
        "normalized_base_url": normalized_base_url,
        "manifest": _build_manifest_summary(kb_manifest, manifest, len(_build_catalog_items(manifest, kb_manifest, entries)), len(entries)),
        "documents": catalog_items,
        "doc_count": len(catalog_items),
        "warnings": _build_manifest_warnings(kb_manifest, manifest, len(_build_catalog_items(manifest, kb_manifest, entries)), len(entries)),
    }


def get_knowledge_base_documents(payload: Dict[str, Any]) -> Dict[str, Any]:
    base_url = payload.get("base_url")
    timeout = _normalize_timeout_sec(payload.get("timeout_sec"))
    force_refresh = payload.get("force_refresh") is True
    requested_doc_ids = []
    seen = {}
    for raw_doc_id in payload.get("doc_ids") or []:
        doc_id = _stringify(raw_doc_id)
        if not doc_id or doc_id in seen:
            continue
        seen[doc_id] = True
        requested_doc_ids.append(doc_id)
    if not requested_doc_ids:
        raise KnowledgeBaseServiceError("doc_ids 不能为空", 400)
    if len(requested_doc_ids) > MAX_DOCUMENT_MAX_DOCS:
        raise KnowledgeBaseServiceError("单次最多拉取 8 篇知识库文档", 400)

    normalized_base_url, manifest, kb_manifest, entries = _load_resources(
        base_url,
        timeout,
        force_refresh=force_refresh,
    )
    all_catalog_items = _build_catalog_items(manifest, kb_manifest, entries)
    catalog_lookup = {}
    for item in all_catalog_items:
        doc_id = _stringify(item.get("doc_id"))
        if doc_id:
            catalog_lookup[doc_id] = item

    unknown_doc_ids = [doc_id for doc_id in requested_doc_ids if doc_id not in catalog_lookup]
    if unknown_doc_ids:
        raise KnowledgeBaseServiceError(
            "未找到指定知识库文档：" + "、".join(unknown_doc_ids[:5]),
            404,
        )

    documents = []
    for doc_id in requested_doc_ids:
        doc_meta = catalog_lookup[doc_id]
        clean_path = _normalize_relative_path(doc_meta.get("clean_path"))
        if not clean_path or not _is_safe_relative_path(clean_path):
            raise KnowledgeBaseServiceError("知识库文档路径不合法：" + doc_id, 502)
        doc_text = _fetch_text(
            _build_resource_url(normalized_base_url, clean_path),
            timeout,
            force_refresh=force_refresh,
        )
        sections = _build_document_sections(doc_id, _stringify(doc_meta.get("title")), doc_text)
        documents.append({
            "doc_id": doc_id,
            "module": _stringify(doc_meta.get("module")),
            "title": _stringify(doc_meta.get("title")),
            "relative_path": _normalize_relative_path(doc_meta.get("relative_path")),
            "clean_path": clean_path,
            "source_url": _stringify(doc_meta.get("source_url")),
            "section_count": len(sections),
            "sections": sections,
        })

    return {
        "base_url": _stringify(base_url),
        "normalized_base_url": normalized_base_url,
        "manifest": _build_manifest_summary(kb_manifest, manifest, len(all_catalog_items), len(entries)),
        "documents": documents,
        "doc_count": len(documents),
        "warnings": _build_manifest_warnings(kb_manifest, manifest, len(all_catalog_items), len(entries)),
    }


def search_knowledge_base(payload: Dict[str, Any]) -> Dict[str, Any]:
    base_url = payload.get("base_url")
    timeout = _normalize_timeout_sec(payload.get("timeout_sec"))
    force_refresh = payload.get("force_refresh") is True
    max_candidates = int(payload.get("max_candidates") or DEFAULT_MAX_CANDIDATES)
    if max_candidates < 1:
        max_candidates = DEFAULT_MAX_CANDIDATES
    if max_candidates > MAX_MAX_CANDIDATES:
        max_candidates = MAX_MAX_CANDIDATES

    normalized_base_url, manifest, kb_manifest, entries = _load_resources(
        base_url,
        timeout,
        force_refresh=force_refresh,
    )
    docs_dir = _get_docs_dir(kb_manifest)
    manifest_meta = _build_manifest_metadata(manifest, docs_dir)
    all_catalog_items = _build_catalog_items(manifest, kb_manifest, entries)
    query = _build_query_context(payload)

    candidates = []
    for entry in entries:
        score, matched_terms = _score_entry(entry, query)
        if score <= 0:
            continue
        clean_path = _normalize_relative_path(entry.get("clean_path"))
        doc_id = _stringify(entry.get("doc_id"))
        meta = _resolve_document_meta(manifest_meta, docs_dir, doc_id, clean_path, "")
        stable_doc_id = doc_id or _stringify(meta.get("doc_id")) or _derive_doc_id_from_path(clean_path)
        snippet = _stringify(entry.get("text"))
        summary = _stringify(entry.get("summary"))
        candidates.append({
            "candidate_id": "kb-" + str(len(candidates) + 1),
            "doc_id": stable_doc_id,
            "module": _stringify(meta.get("module")) or _stringify(entry.get("module")),
            "title": _stringify(meta.get("title")) or _stringify(entry.get("title")),
            "heading": _stringify(entry.get("heading")),
            "summary": _short_text(summary, 260),
            "snippet": _short_text(snippet, 420),
            "clean_path": clean_path or _normalize_relative_path(meta.get("clean_path")),
            "relative_path": _normalize_relative_path(meta.get("relative_path")),
            "source_url": _stringify(meta.get("source_url")),
            "chunk_index": int(entry.get("chunk_index") or 0),
            "score": round(score, 3),
            "matched_terms": matched_terms,
            "document_excerpt": "",
        })

    candidates.sort(
        key=lambda item: (
            -float(item.get("score") or 0),
            _stringify(item.get("title")),
            int(item.get("chunk_index") or 0),
        )
    )
    candidates = candidates[:max_candidates]

    seen_doc_excerpt = {}
    for item in candidates:
        clean_path = _normalize_relative_path(item.get("clean_path"))
        if not clean_path or not _is_safe_relative_path(clean_path):
            continue
        if clean_path in seen_doc_excerpt:
            item["document_excerpt"] = seen_doc_excerpt[clean_path]
            continue
        doc_text = _fetch_text(
            _build_resource_url(normalized_base_url, clean_path),
            timeout,
            force_refresh=force_refresh,
        )
        excerpt = _make_excerpt(doc_text, item.get("matched_terms") or [], 900)
        seen_doc_excerpt[clean_path] = excerpt
        item["document_excerpt"] = excerpt

    return {
        "base_url": _stringify(base_url),
        "normalized_base_url": normalized_base_url,
        "workspace_id": _stringify(payload.get("workspace_id")),
        "request_id": _stringify(payload.get("request_id")),
        "query_summary": _stringify(query.get("summary")),
        "manifest": _build_manifest_summary(kb_manifest, manifest, len(all_catalog_items), len(entries)),
        "candidates": candidates,
        "candidate_count": len(candidates),
        "warnings": _build_manifest_warnings(kb_manifest, manifest, len(all_catalog_items), len(entries)),
    }
