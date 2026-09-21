"""Packycode Responses wire contract; no CLI context or automatic retries."""
from __future__ import annotations

import codecs
import json
import uuid
from typing import Any, Mapping


def is_packycode(config: Any) -> bool:
    return isinstance(config, Mapping) and str(config.get("provider") or "").strip().lower() == "packycode"


def prepare_request(payload: Any) -> dict:
    source = payload if isinstance(payload, Mapping) else {}
    if not source.get("model") or not isinstance(source.get("input"), list):
        raise ValueError("Packycode 请求必须包含 model 和 input")
    reasoning = source.get("reasoning")
    effort = reasoning.get("effort") if isinstance(reasoning, Mapping) else None
    return {
        "model": source["model"],
        "instructions": str(source.get("instructions") or "").strip() or "请完成用户请求。",
        "input": source["input"],
        "reasoning": {"effort": effort or "high"},
        "prompt_cache_key": str(uuid.uuid4()),
        "stream": True,
        "store": False,
        "max_output_tokens": 16384,
    }


def output_text(items: Any) -> str:
    messages = [item for item in (items or []) if isinstance(item, Mapping)
                and item.get("type") == "message" and item.get("role") == "assistant"
                and item.get("status", "completed") == "completed"]
    final = [item for item in messages if item.get("phase") == "final_answer"]
    parts = []
    seen = set()
    for item in final or messages:
        identity = item.get("id")
        if identity and identity in seen:
            continue
        if identity:
            seen.add(identity)
        text = "".join(block.get("text", "") for block in item.get("content", [])
                       if isinstance(block, Mapping) and block.get("type") == "output_text"
                       and isinstance(block.get("text"), str))
        if text.strip():
            parts.append(text)
    return "\n".join(parts).strip()


class ResponsesStream:
    """Parse complete SSE frames, retaining only completed assistant messages."""

    def __init__(self) -> None:
        self.decoder = codecs.getincrementaldecoder("utf-8")()
        self.buffer = ""
        self.event_name = ""
        self.data_lines: list[str] = []
        self.items: dict[int, dict] = {}
        self.completed = None
        self.error = ""

    @property
    def terminal(self) -> bool:
        return self.completed is not None or bool(self.error)

    def feed(self, chunk: bytes) -> None:
        self.buffer += self.decoder.decode(chunk)
        while "\n" in self.buffer:
            line, self.buffer = self.buffer.split("\n", 1)
            line = line.rstrip("\r")
            if not line:
                self._event()
            elif line.startswith("event:"):
                self.event_name = line[6:].strip()
            elif line.startswith("data:"):
                self.data_lines.append(line[5:].lstrip(" "))
            elif not line.startswith((":", "id:", "retry:")):
                self.error = "Packycode 返回了无效的 SSE 数据"

    def _event(self) -> None:
        raw = "\n".join(self.data_lines).strip()
        event_name = self.event_name
        self.event_name, self.data_lines = "", []
        if not raw or raw == "[DONE]":
            return
        try:
            payload = json.loads(raw)
        except ValueError:
            self.error = "Packycode SSE 事件不是合法 JSON"
            return
        if not isinstance(payload, dict):
            self.error = "Packycode SSE 事件格式错误"
            return
        kind = payload.get("type") or event_name
        response = payload.get("response") or {}
        error = payload.get("error") or response.get("error")
        if kind in ("error", "response.failed", "response.incomplete") or error:
            detail = error.get("message") if isinstance(error, dict) else error
            reason = (response.get("incomplete_details") or {}).get("reason")
            self.error = "Packycode 生成失败（%s）：%s" % (kind, detail or reason or payload.get("message") or "未成功完成")
        elif kind == "response.output_item.done":
            item, index = payload.get("item"), payload.get("output_index")
            if isinstance(item, dict) and isinstance(index, int) and index >= 0:
                if item.get("type") == "message" and item.get("status") == "completed":
                    self.items[index] = item
        elif kind == "response.completed":
            if response.get("status") != "completed":
                self.error = "Packycode 完成事件未确认成功状态"
            else:
                self.completed = response

    def result(self) -> dict:
        if self.error:
            raise ValueError(self.error)
        if self.completed is None:
            raise ValueError("Packycode 流提前中断，未收到 response.completed；未自动重试")
        text = output_text(self.completed.get("output"))
        if not text:
            text = output_text([self.items[index] for index in sorted(self.items)])
        if not text:
            raise ValueError("Packycode 已完成但未返回有效文本")
        return {"status": "completed", "output_text": text, "usage": self.completed.get("usage")}
