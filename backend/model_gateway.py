from __future__ import annotations

import http.client
import json
import threading
from dataclasses import dataclass
from typing import Any, Callable, Mapping, Optional
from urllib import parse as urllib_parse

from .packycode import ResponsesStream, is_packycode, prepare_request


class ModelRequestCancelled(Exception):
    pass


@dataclass(frozen=True)
class ModelGatewayResponse:
    status_code: int
    content_type: str
    body: str
    response_status: Optional[str] = None
    finish_reason: Optional[str] = None
    incomplete_details: Optional[Any] = None
    usage: Optional[Any] = None


def request_model_name(value: Any) -> str:
    if not isinstance(value, Mapping):
        return ""
    for key in ("model", "modelIdentifier", "model_id"):
        candidate = value.get(key)
        if candidate is not None and str(candidate).strip():
            return str(candidate).strip()[:128]
    return ""


def strip_output_token_limits(payload: Any) -> Any:
    if not isinstance(payload, Mapping):
        return payload
    sanitized = dict(payload)
    sanitized.pop("max_output_tokens", None)
    sanitized.pop("max_tokens", None)
    return sanitized


def _response_metadata_from_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, Mapping):
        return {}
    candidate = payload
    nested = payload.get("response")
    if isinstance(nested, Mapping):
        candidate = nested
    choices = candidate.get("choices")
    choice = choices[0] if isinstance(choices, list) and choices and isinstance(choices[0], Mapping) else {}
    incomplete = candidate.get("incomplete_details")
    if not isinstance(incomplete, Mapping):
        incomplete = payload.get("incomplete_details")
    usage = candidate.get("usage")
    if usage is None:
        usage = payload.get("usage")
    result: dict[str, Any] = {}
    response_status = candidate.get("status") or payload.get("status")
    finish_reason = choice.get("finish_reason") or candidate.get("finish_reason") or payload.get("finish_reason")
    if response_status is not None:
        result["response_status"] = str(response_status)
    if finish_reason is not None:
        result["finish_reason"] = str(finish_reason)
    if isinstance(incomplete, Mapping):
        result["incomplete_details"] = dict(incomplete)
    if isinstance(usage, Mapping):
        result["usage"] = dict(usage)
    return result


def extract_response_metadata(body: str, content_type: str = "") -> dict[str, Any]:
    text = str(body or "").strip()
    if not text:
        return {}
    try:
        return _response_metadata_from_payload(json.loads(text))
    except (TypeError, ValueError, json.JSONDecodeError):
        pass
    if "event:" not in text and "data:" not in text:
        return {}
    result: dict[str, Any] = {}
    for line in text.replace("\r\n", "\n").split("\n"):
        if not line.startswith("data:"):
            continue
        raw = line[5:].lstrip()
        if not raw or raw == "[DONE]":
            continue
        try:
            payload = json.loads(raw)
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        metadata = _response_metadata_from_payload(payload)
        if metadata:
            result.update(metadata)
    return result


def normalize_timeout_sec(value: Any) -> int:
    try:
        timeout = int(value or 60)
    except (TypeError, ValueError):
        timeout = 60
    return max(5, min(1800, timeout))


def _model_prefers_responses_endpoint(config: Mapping[str, Any], requested_model: Any = None) -> bool:
    model_name = str(
        requested_model
        or config.get("model")
        or config.get("modelIdentifier")
        or config.get("model_id")
        or ""
    ).strip().lower()
    return (model_name.startswith("gpt-5") and "chat" not in model_name) or is_packycode(config)


def _normalize_model_endpoint(raw_url: str, config: Mapping[str, Any], requested_model: Any = None) -> str:
    parsed = urllib_parse.urlparse(raw_url)
    path = parsed.path or ""
    lower_path = path.lower().rstrip("/")
    if is_packycode(config):
        for suffix in ("/chat/completions", "/completions", "/responses", "/chat", "/models"):
            if lower_path.endswith(suffix):
                path = path.rstrip("/")[:-len(suffix)]
                break
        path = path.rstrip("/")
        path += "/responses" if path.lower().endswith("/v1") else "/v1/responses"
        return urllib_parse.urlunparse(parsed._replace(path=path, fragment=""))
    has_explicit_endpoint = lower_path.endswith(
        ("/chat/completions", "/completions", "/responses", "/chat", "/models")
    )
    if not has_explicit_endpoint:
        path = path.rstrip("/")
        if _model_prefers_responses_endpoint(config, requested_model):
            path += "/responses" if path.lower().endswith("/v1") else "/v1/responses"
        else:
            path += "/chat/completions"
        parsed = parsed._replace(path=path)
    return urllib_parse.urlunparse(parsed)


def resolve_model_endpoint(config_json: Any, requested_model: Any = None) -> tuple[str, str]:
    config = config_json if isinstance(config_json, Mapping) else {}
    raw_url = str(config.get("baseUrl") or config.get("base_url") or "").strip()
    api_key = str(config.get("apiKey") or config.get("api_key") or "").strip()
    parsed = urllib_parse.urlparse(raw_url)
    if parsed.scheme.lower() not in ("http", "https") or not parsed.netloc:
        raise ValueError("模型地址格式不正确，仅支持 http/https")
    raw_url = _normalize_model_endpoint(raw_url, config, requested_model)
    parsed = urllib_parse.urlparse(raw_url)

    provider = str(config.get("provider") or "").lower()
    model_name = str(
        requested_model
        or config.get("model")
        or config.get("modelIdentifier")
        or config.get("model_id")
        or ""
    ).lower()
    is_claude = provider in ("claude", "anthropic") or "claude" in model_name
    if is_claude and not is_packycode(config) and parsed.path.rstrip("/").endswith("/responses"):
        parsed = parsed._replace(path=parsed.path[: -len("responses")] + "chat/completions")
        raw_url = urllib_parse.urlunparse(parsed)
    return raw_url, api_key


def post_model_json(
    url: str,
    api_key: str,
    payload: Any,
    timeout_sec: int,
    cancel_event: threading.Event,
    on_connection: Optional[Callable[[Optional[http.client.HTTPConnection]], None]] = None,
    provider: str = "",
) -> ModelGatewayResponse:
    parsed = urllib_parse.urlparse(str(url or "").strip())
    scheme = parsed.scheme.lower()
    if scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("模型地址格式不正确，仅支持 http/https")
    if cancel_event.is_set():
        raise ModelRequestCancelled("模型任务已取消")

    connection_cls = http.client.HTTPSConnection if scheme == "https" else http.client.HTTPConnection
    connection = connection_cls(parsed.hostname, parsed.port, timeout=normalize_timeout_sec(timeout_sec))
    path = parsed.path or "/"
    if parsed.params:
        path += ";" + parsed.params
    if parsed.query:
        path += "?" + parsed.query
    packy = is_packycode({"provider": provider})
    sanitized_payload = prepare_request(payload) if packy else strip_output_token_limits(payload if payload is not None else {})
    body = json.dumps(sanitized_payload, ensure_ascii=False).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json,text/plain,*/*",
        "User-Agent": "tap-model-task/1.0",
        # 与主干 urllib 代理一致：每次任务独占连接，以关闭连接结束无长度响应。
        "Connection": "close",
    }
    if api_key:
        headers["Authorization"] = "Bearer " + api_key
    if packy:
        headers.update({"User-Agent": "CodexTool/1.0", "Accept": "text/event-stream"})

    if on_connection:
        on_connection(connection)
    try:
        connection.request("POST", path, body=body, headers=headers)
        if cancel_event.is_set():
            raise ModelRequestCancelled("模型任务已取消")
        response = connection.getresponse()
        chunks = []
        total = 0
        max_response_bytes = 20 * 1024 * 1024
        stream = ResponsesStream() if packy and 200 <= response.status < 300 else None
        while True:
            if cancel_event.is_set():
                raise ModelRequestCancelled("模型任务已取消")
            chunk = response.read1(64 * 1024) if stream else response.read(64 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > max_response_bytes:
                raise ValueError("模型响应超过 20 MiB 上限")
            chunks.append(chunk)
            if stream:
                stream.feed(chunk)
                if stream.terminal:
                    break
        content_type = response.getheader("Content-Type", "application/json")
        body_text = b"".join(chunks).decode("utf-8", errors="replace")
        if cancel_event.is_set():
            raise ModelRequestCancelled("模型任务已取消")
        if stream:
            body_text = json.dumps(stream.result(), ensure_ascii=False)
            content_type = "application/json"
        metadata = extract_response_metadata(body_text, str(content_type or "application/json"))
        return ModelGatewayResponse(
            status_code=int(response.status or 0),
            content_type=str(content_type or "application/json"),
            body=body_text,
            response_status=metadata.get("response_status"),
            finish_reason=metadata.get("finish_reason"),
            incomplete_details=metadata.get("incomplete_details"),
            usage=metadata.get("usage"),
        )
    except (OSError, http.client.HTTPException) as exc:
        if cancel_event.is_set():
            raise ModelRequestCancelled("模型任务已取消") from exc
        raise
    finally:
        if on_connection:
            on_connection(None)
        try:
            connection.close()
        except Exception:
            pass
