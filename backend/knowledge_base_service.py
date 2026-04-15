import json
import re
import threading
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request


DEFAULT_TIMEOUT_SEC = 15
MAX_VALIDATE_DOCS = 200
DEFAULT_MAX_CANDIDATES = 12
MAX_MAX_CANDIDATES = 20
JSON_CACHE_TTL_SEC = 300
DOC_CACHE_TTL_SEC = 1800

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


def _fetch_bytes(url: str, timeout_sec: int) -> bytes:
    request_obj = urllib_request.Request(
        url=url,
        headers={
            "Accept": "application/json,text/plain,text/markdown,*/*",
            "User-Agent": "tap-knowledge-base/1.0",
        },
        method="GET",
    )
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
        reason = exc.reason if exc and exc.reason is not None else "网络异常"
        raise KnowledgeBaseServiceError("读取知识库失败：" + str(reason), 502) from exc
    except Exception as exc:
        raise KnowledgeBaseServiceError("读取知识库失败：" + str(exc), 502) from exc


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
        if not isinstance(item, dict):
            continue
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


def _build_manifest_lookup(manifest: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    result = {}
    for item in manifest:
        if not isinstance(item, dict):
            continue
        relative_path = _normalize_relative_path(item.get("relative_path"))
        if relative_path:
            result[relative_path] = item
            if relative_path.lower().endswith(".md"):
                result[relative_path[:-3]] = item
    return result


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

    deduped = []
    seen = {}
    for term in matched_terms:
        text = _stringify(term)
        if not text:
            continue
        lowered = text.lower()
        if lowered in seen:
            continue
        seen[lowered] = True
        deduped.append(text)
    return score, deduped[:12]


def _make_excerpt(text: str, matched_terms: List[str], max_chars: int = 600) -> str:
    source = _stringify(text)
    if not source:
        return ""
    anchor_index = -1
    matched = []
    for item in matched_terms:
        token = _stringify(item)
        if not token:
            continue
        idx = source.find(token)
        if idx >= 0:
            anchor_index = idx
            matched = [token]
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
    lookup = _build_manifest_lookup(manifest)
    unique_doc_paths = []
    seen_doc_paths = {}
    invalid_paths = []
    for entry in entries:
        clean_path = _normalize_relative_path(entry.get("clean_path"))
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

    warnings = []
    manifest_doc_count = len(manifest)
    indexed_doc_count = len(unique_doc_paths)
    declared_doc_count = int(kb_manifest.get("doc_count") or 0)
    declared_entry_count = int(kb_manifest.get("entry_count") or 0)
    if declared_doc_count and declared_doc_count != manifest_doc_count:
        warnings.append("kb-manifest 声明的文档数与 manifest.json 不一致")
    if declared_doc_count and declared_doc_count != indexed_doc_count:
        warnings.append("kb-manifest 声明的文档数与索引唯一文档数不一致")
    if declared_entry_count and declared_entry_count != len(entries):
        warnings.append("kb-manifest 声明的索引条数与 search-index.json 不一致")

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

    return {
        "ok": len(missing_files) == 0 and len(invalid_paths) == 0,
        "base_url": base_url,
        "normalized_base_url": normalized_base_url,
        "manifest": {
            "generated_at": _stringify(kb_manifest.get("generated_at")),
            "docs_dir": _stringify(kb_manifest.get("docs_dir")),
            "index_path": _stringify(kb_manifest.get("index_path") or "_llm/search-index.json"),
            "doc_count": declared_doc_count if declared_doc_count > 0 else manifest_doc_count,
            "entry_count": declared_entry_count if declared_entry_count > 0 else len(entries),
            "manifest_doc_count": manifest_doc_count,
            "indexed_doc_count": indexed_doc_count,
        },
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
    query = _build_query_context(payload)
    manifest_lookup = _build_manifest_lookup(manifest)

    candidates = []
    for entry in entries:
        score, matched_terms = _score_entry(entry, query)
        if score <= 0:
            continue
        clean_path = _normalize_relative_path(entry.get("clean_path"))
        doc_id = _stringify(entry.get("doc_id"))
        relative_path = ""
        source_url = ""
        manifest_item = manifest_lookup.get(doc_id) or manifest_lookup.get(doc_id + ".md")
        if manifest_item:
            relative_path = _normalize_relative_path(manifest_item.get("relative_path"))
            source_url = _stringify(manifest_item.get("source_url"))
        snippet = _stringify(entry.get("text"))
        summary = _stringify(entry.get("summary"))
        candidates.append({
            "candidate_id": "kb-" + str(len(candidates) + 1),
            "doc_id": doc_id,
            "module": _stringify(entry.get("module")),
            "title": _stringify(entry.get("title")),
            "heading": _stringify(entry.get("heading")),
            "summary": _short_text(summary, 260),
            "snippet": _short_text(snippet, 420),
            "clean_path": clean_path,
            "relative_path": relative_path,
            "source_url": source_url,
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
        "manifest": {
            "generated_at": _stringify(kb_manifest.get("generated_at")),
            "docs_dir": _stringify(kb_manifest.get("docs_dir")),
            "index_path": _stringify(kb_manifest.get("index_path") or "_llm/search-index.json"),
            "doc_count": int(kb_manifest.get("doc_count") or len(manifest)),
            "entry_count": int(kb_manifest.get("entry_count") or len(entries)),
            "manifest_doc_count": len(manifest),
            "indexed_doc_count": len(seen_doc_excerpt) if seen_doc_excerpt else len({
                _normalize_relative_path(item.get("clean_path")) for item in candidates if _normalize_relative_path(item.get("clean_path"))
            }),
        },
        "candidates": candidates,
        "candidate_count": len(candidates),
        "warnings": [],
    }
