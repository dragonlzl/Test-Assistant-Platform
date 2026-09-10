from __future__ import annotations

import http.client
import json
import logging
import threading
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Dict, Optional
from urllib.parse import urlsplit, urlunsplit

from sqlalchemy.orm import Session

from . import models
from .config import settings
from .db import SessionLocal
from .model_gateway import ModelRequestCancelled, post_model_json, request_model_name, resolve_model_endpoint


TERMINAL_MODEL_TASK_STATUSES = {"succeeded", "failed", "cancelled"}
ACTIVE_MODEL_TASK_STATUSES = {"queued", "running", "cancel_requested"}
logger = logging.getLogger("tap.model_task")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def build_model_task_id() -> str:
    return "model-task-" + uuid.uuid4().hex


def can_access_model_config(config: models.ModelConfig, user: models.User) -> bool:
    return bool(config and user and (config.owner_id is None or config.owner_id == user.id))


def _json_length(value: object) -> int:
    try:
        return len(json.dumps(value if value is not None else {}, ensure_ascii=False))
    except (TypeError, ValueError):
        return 0


def _request_keys(value: object) -> list[str]:
    if not isinstance(value, dict):
        return []
    return sorted(str(key) for key in value.keys())


def _safe_endpoint(value: object) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    try:
        parsed = urlsplit(raw)
        if parsed.scheme and parsed.netloc:
            return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))[:512]
    except ValueError:
        pass
    return raw.split("?", 1)[0].split("#", 1)[0][:512]


def _tail_preview(value: object, limit: int = 160) -> str:
    text = str(value or "").replace("\r", " ").replace("\n", " ").strip()
    if not text:
        return ""
    return ("…" + text[-limit:]) if len(text) > limit else text


def _response_content_tail_preview(body: str, limit: int = 160) -> str:
    text = str(body or "")
    if not text:
        return ""
    try:
        payload = json.loads(text)
    except (TypeError, ValueError, json.JSONDecodeError):
        return ""
    parts: list[str] = []
    if isinstance(payload, dict) and isinstance(payload.get("output"), list):
        for item in payload["output"]:
            if not isinstance(item, dict) or item.get("type") != "message":
                continue
            content = item.get("content")
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict):
                        value = block.get("text") or block.get("output_text")
                        if isinstance(value, str) and value:
                            parts.append(value)
            elif isinstance(content, str) and content:
                parts.append(content)
    if not parts and isinstance(payload, dict):
        choices = payload.get("choices")
        if isinstance(choices, list) and choices and isinstance(choices[0], dict):
            message = choices[0].get("message")
            if isinstance(message, dict) and isinstance(message.get("content"), str):
                parts.append(message["content"])
    return _tail_preview("\n".join(parts), limit)


def _usage_summary(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        return {}
    keys = (
        "input_tokens",
        "prompt_tokens",
        "output_tokens",
        "completion_tokens",
        "total_tokens",
    )
    return {key: value[key] for key in keys if key in value}


def _log_task_response(
    task: models.ModelTask,
    response,
    completed_at: Optional[datetime] = None,
) -> None:
    incomplete = response.incomplete_details if isinstance(response.incomplete_details, dict) else {}
    started_at = _as_utc(task.started_at)
    finished_at = _as_utc(completed_at or task.completed_at)
    duration_ms = 0
    if started_at and finished_at:
        duration_ms = max(0, int((finished_at - started_at).total_seconds() * 1000))
    payload = {
        "event": "model_task_response",
        "task_id": str(task.id),
        "scene": str(task.scene or ""),
        "model_config_id": task.model_config_id,
        "configured_model": str(task.configured_model or ""),
        "request_model": str(task.request_model or ""),
        "request_endpoint": str(task.request_endpoint or ""),
        "timeout_sec": int(task.timeout_sec or 0),
        "duration_ms": duration_ms,
        "upstream_status": response.status_code,
        "response_status": response.response_status or "",
        "finish_reason": response.finish_reason or "",
        "incomplete_reason": incomplete.get("reason", ""),
        "response_chars": len(response.body or ""),
        "response_content_type": response.content_type or "",
        "usage": _usage_summary(response.usage),
        "response_tail_preview": _tail_preview(response.body),
        "response_content_tail_preview": _response_content_tail_preview(response.body),
    }
    incomplete_reason = str(incomplete.get("reason", "")).lower()
    finish_reason = str(response.finish_reason or "").lower()
    is_limited = (
        (str(response.response_status or "").lower() == "incomplete")
        or finish_reason in {"length", "max_tokens"}
        or "token" in incomplete_reason
    )
    message = "model task response diagnostics=%s"
    if is_limited:
        logger.warning(message, json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    else:
        logger.info(message, json.dumps(payload, ensure_ascii=False, separators=(",", ":")))


def request_task_cancel(db: Session, task: models.ModelTask) -> models.ModelTask:
    if task.status in TERMINAL_MODEL_TASK_STATUSES:
        return task
    now = utcnow()
    task.cancel_requested_at = task.cancel_requested_at or now
    if task.status == "queued":
        task.status = "cancelled"
        task.completed_at = now
        task.request_json = {}
    else:
        task.status = "cancel_requested"
    task.updated_at = now
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


class ModelTaskExecutor:
    def __init__(self, max_workers: int) -> None:
        self._pool = ThreadPoolExecutor(
            max_workers=max(1, int(max_workers or 1)),
            thread_name_prefix="model-task",
        )
        self._lock = threading.Lock()
        self._futures: Dict[str, Future] = {}
        self._cancel_events: Dict[str, threading.Event] = {}
        self._connections: Dict[str, http.client.HTTPConnection] = {}

    def submit(self, task_id: str) -> None:
        target_id = str(task_id or "")
        if not target_id:
            return
        with self._lock:
            current = self._futures.get(target_id)
            if current and not current.done():
                return
            cancel_event = threading.Event()
            self._cancel_events[target_id] = cancel_event
            future = self._pool.submit(self._run_task, target_id, cancel_event)
            self._futures[target_id] = future
            future.add_done_callback(lambda _: self._forget(target_id))

    def cancel(self, task_id: str) -> None:
        target_id = str(task_id or "")
        if not target_id:
            return
        with self._lock:
            cancel_event = self._cancel_events.get(target_id)
            future = self._futures.get(target_id)
            connection = self._connections.get(target_id)
        if cancel_event:
            cancel_event.set()
        if future:
            future.cancel()
        if connection:
            try:
                connection.close()
            except Exception:
                pass

    def recover_incomplete(self) -> int:
        db = SessionLocal()
        task_ids = []
        try:
            tasks = (
                db.query(models.ModelTask)
                .filter(models.ModelTask.status.in_(ACTIVE_MODEL_TASK_STATUSES))
                .all()
            )
            now = utcnow()
            for task in tasks:
                if task.status == "cancel_requested":
                    task.status = "cancelled"
                    task.completed_at = now
                    task.request_json = {}
                    task.updated_at = now
                    continue
                task.status = "queued"
                task.worker_id = None
                task.updated_at = now
                task_ids.append(task.id)
            db.commit()
        finally:
            db.close()
        for task_id in task_ids:
            self.submit(task_id)
        return len(task_ids)

    def shutdown(self) -> None:
        with self._lock:
            task_ids = list(self._cancel_events.keys())
        for task_id in task_ids:
            self.cancel(task_id)
        self._pool.shutdown(wait=False, cancel_futures=True)

    def _forget(self, task_id: str) -> None:
        with self._lock:
            self._futures.pop(task_id, None)
            self._cancel_events.pop(task_id, None)
            self._connections.pop(task_id, None)

    def _set_connection(
        self, task_id: str, connection: Optional[http.client.HTTPConnection]
    ) -> None:
        with self._lock:
            if connection is None:
                self._connections.pop(task_id, None)
            else:
                self._connections[task_id] = connection

    def _claim_task(self, db: Session, task_id: str) -> Optional[models.ModelTask]:
        task = db.query(models.ModelTask).filter(models.ModelTask.id == task_id).first()
        if not task or task.status != "queued":
            return None
        now = utcnow()
        task.status = "running"
        task.started_at = task.started_at or now
        task.updated_at = now
        task.attempt_count = int(task.attempt_count or 0) + 1
        task.worker_id = threading.current_thread().name
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    def _run_task(self, task_id: str, cancel_event: threading.Event) -> None:
        db = SessionLocal()
        try:
            task = self._claim_task(db, task_id)
            if not task:
                return
            model_config = (
                db.query(models.ModelConfig)
                .filter(models.ModelConfig.id == task.model_config_id)
                .first()
            )
            if not model_config:
                raise ValueError("任务关联的模型配置不存在")
            request_model = request_model_name(task.request_json)
            if not request_model:
                raise ValueError("模型任务缺少具体请求模型，不能使用站点默认模型")
            endpoint, api_key = resolve_model_endpoint(model_config.config_json, request_model)
            configured_model = request_model_name(model_config.config_json)
            safe_endpoint = _safe_endpoint(endpoint)
            task.configured_model = configured_model or None
            task.request_model = request_model or None
            task.request_endpoint = safe_endpoint or None
            db.add(task)
            db.commit()
            logger.info(
                "model task started task_id=%s scene=%s model_config_id=%s configured_model=%s request_model=%s request_endpoint=%s request_chars=%s request_keys=%s has_output_token_fields=%s",
                task.id,
                task.scene,
                task.model_config_id,
                configured_model or "",
                request_model or "",
                safe_endpoint,
                _json_length(task.request_json),
                ",".join(_request_keys(task.request_json)),
                isinstance(task.request_json, dict)
                and ("max_tokens" in task.request_json or "max_output_tokens" in task.request_json),
            )
            response = post_model_json(
                endpoint,
                api_key,
                task.request_json or {},
                int(task.timeout_sec or 60),
                cancel_event,
                on_connection=lambda connection: self._set_connection(task_id, connection),
            )
            db.expire_all()
            current = db.query(models.ModelTask).filter(models.ModelTask.id == task_id).first()
            if not current:
                return
            now = utcnow()
            if cancel_event.is_set() or current.status == "cancel_requested":
                current.status = "cancelled"
                current.error = "用户已中断生成"
                logger.info(
                    "model task cancelled task_id=%s scene=%s after_upstream_response=true",
                    current.id,
                    current.scene,
                )
            else:
                current.status = "succeeded"
                current.upstream_status = response.status_code
                current.response_content_type = response.content_type
                current.response_body = response.body
                current.response_status = response.response_status
                current.finish_reason = response.finish_reason
                current.incomplete_details = response.incomplete_details
                current.usage_json = response.usage
                current.error = None
                _log_task_response(current, response, now)
            current.request_json = {}
            current.completed_at = now
            current.updated_at = now
            current.worker_id = None
            db.add(current)
            db.commit()
        except ModelRequestCancelled:
            self._finish_cancelled(db, task_id)
        except Exception as exc:
            self._finish_failed(db, task_id, exc)
        finally:
            db.close()

    def _finish_cancelled(self, db: Session, task_id: str) -> None:
        db.rollback()
        task = db.query(models.ModelTask).filter(models.ModelTask.id == task_id).first()
        if not task or task.status in TERMINAL_MODEL_TASK_STATUSES:
            return
        now = utcnow()
        task.status = "cancelled"
        task.error = "用户已中断生成"
        task.request_json = {}
        task.completed_at = now
        task.updated_at = now
        task.worker_id = None
        db.add(task)
        db.commit()
        logger.info("model task cancelled task_id=%s scene=%s", task.id, task.scene)

    def _finish_failed(self, db: Session, task_id: str, exc: Exception) -> None:
        db.rollback()
        task = db.query(models.ModelTask).filter(models.ModelTask.id == task_id).first()
        if not task or task.status in TERMINAL_MODEL_TASK_STATUSES:
            return
        if task.status == "cancel_requested":
            self._finish_cancelled(db, task_id)
            return
        now = utcnow()
        task.status = "failed"
        task.error = str(exc)[:2000] or "模型任务执行失败"
        task.request_json = {}
        task.completed_at = now
        task.updated_at = now
        task.worker_id = None
        db.add(task)
        db.commit()
        logger.error(
            "model task failed task_id=%s scene=%s error=%s",
            task.id,
            task.scene,
            str(exc)[:500],
        )


model_task_executor = ModelTaskExecutor(settings.model_task_workers)
