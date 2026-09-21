import json
import threading
import unittest
import uuid
from urllib.parse import urlsplit
from unittest.mock import patch
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from backend.model_gateway import ModelRequestCancelled, post_model_json, resolve_model_endpoint
from backend.packycode import ResponsesStream, is_packycode, prepare_request


@contextmanager
def model_server(body, chunked=False, captured=None):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *args):
            pass

        def do_POST(self):
            request_body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
            if captured is not None:
                captured.append({"headers": dict(self.headers), "body": json.loads(request_body), "path": self.path})
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream" if chunked else "application/json")
            if chunked:
                self.send_header("Transfer-Encoding", "chunked")
            self.send_header("Connection", "close" if self.close_connection else "keep-alive")
            self.end_headers()
            raw = body.encode("utf-8")
            if chunked:
                # 刻意跨 UTF-8 字符拆块，验证 HTTP 分块读取不会损坏 SSE。
                for offset in range(0, len(raw), 7):
                    part = raw[offset:offset + 7]
                    self.wfile.write(("%x\r\n" % len(part)).encode() + part + b"\r\n")
                self.wfile.write(b"0\r\n\r\n")
            else:
                # 兼容以连接关闭表示正文结束、未提供长度的代理。
                self.wfile.write(raw)
            self.wfile.flush()

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        yield "http://127.0.0.1:%s/v1/responses" % server.server_port
    finally:
        server.shutdown()
        server.server_close()
        worker.join()


class ModelGatewayTests(unittest.TestCase):
    def test_packycode_requires_explicit_type_regardless_of_host_or_model(self):
        for host in ("cf.api.fan", "slb-v1.api.fan", "codex-api.packycode.com", "packyapi.com", "www.packyapi.com"):
            config = {"provider": "custom", "baseUrl": "https://" + host + "/v1/responses", "model": "claude-sonnet-4-6"}
            for model in ("gpt-6-astra", "gpt-5.6-sol", "codex-auto-review", "claude-sonnet-4-6", "deepseek-flash"):
                config["model"] = model
                self.assertFalse(is_packycode(config))
        self.assertTrue(is_packycode({"provider": "packycode", "baseUrl": "https://custom.example/v1", "model": "deployment-alias"}))
        for provider in ("", "custom", "deepseek", "claude", "kimi"):
            self.assertFalse(is_packycode({"provider": provider, "baseUrl": "https://cf.api.fan/v1", "model": "gpt-6-astra"}))

    def test_packycode_task_adds_wire_contract_only_for_selected_type(self):
        from http.client import HTTPConnection
        completed = sse(complete([make_message("OK", "final_answer", "m")]))
        for host, model, packy in (("cf.api.fan", "gpt-6-astra", True), ("cf.api.fan", "gpt-6-astra", False),
                                   ("other.example", "deployment-alias", True), ("cf.api.fan", "claude-sonnet-4-6", False)):
            captured = []
            with self.subTest(host=host, model=model), model_server(completed, True, captured) as local:
                port = urlsplit(local).port
                with patch("backend.model_gateway.http.client.HTTPConnection", side_effect=lambda *args, **kwargs: HTTPConnection("127.0.0.1", port, timeout=5)):
                    payload = {"model": model, "input": [], "instructions": "规则", "stream": False, "metadata": {"keep": True}}
                    result = post_model_json("http://" + host + "/v1/responses", "test-key", payload, 5, threading.Event(), provider="packycode" if packy else "custom")
            body, headers = captured[0]["body"], captured[0]["headers"]
            if packy:
                self.assertEqual(headers["User-Agent"], "CodexTool/1.0")
                self.assertEqual(headers["Accept"], "text/event-stream")
                self.assertEqual(body["max_output_tokens"], 16384)
                self.assertTrue(body["stream"])
                self.assertIn("prompt_cache_key", body)
                self.assertEqual(json.loads(result.body)["output_text"], "OK")
            else:
                self.assertEqual(headers["User-Agent"], "tap-model-task/1.0")
                self.assertEqual(body, payload)
                self.assertEqual(result.body, completed)

    def test_other_model_endpoint_defaults_are_unchanged(self):
        for model, suffix in (("gpt-6-astra", "/chat/completions"), ("deepseek-flash", "/chat/completions"),
                              ("claude-sonnet-4-6", "/chat/completions"), ("gpt-5.6-sol", "/v1/responses")):
            endpoint, _ = resolve_model_endpoint({"provider": "custom", "baseUrl": "https://other.example"}, model)
            self.assertEqual(endpoint, "https://other.example" + suffix)

    def test_packycode_request_contract_and_completed_output_fallback(self):
        payload = prepare_request({
            "model": "gpt-6-astra", "input": [{"role": "user", "content": [{"type": "input_text", "text": "OK"}]}]
        })
        self.assertEqual(payload["stream"], True)
        self.assertEqual(payload["store"], False)
        self.assertEqual(payload["max_output_tokens"], 16384)
        self.assertRegex(payload["prompt_cache_key"], r"^[0-9a-f-]{36}$")
        stream = ResponsesStream()
        item = {"type": "message", "status": "completed", "role": "assistant", "phase": "final_answer",
                "content": [{"type": "output_text", "text": "OK"}]}
        events = [
            {"type": "response.output_item.done", "output_index": 0, "item": item},
            {"type": "response.completed", "response": {"status": "completed", "output": [], "usage": {"total_tokens": 1}}},
        ]
        for event in events:
            stream.feed(("event: %s\ndata: %s\n\n" % (event["type"], json.dumps(event, ensure_ascii=False))).encode())
        self.assertEqual(stream.result()["output_text"], "OK")

    def test_packycode_gateway_wire_headers_uuid_and_multimodal_input(self):
        captured = []
        message = make_message("最终结果", "final_answer", "m1")
        body = sse({"type": "response.output_item.done", "output_index": 0, "item": message}, complete())
        input_items = [{"role": "user", "content": [
            {"type": "input_text", "text": "文本"},
            {"type": "input_image", "image_url": "data:image/png;base64,dGVzdA=="},
        ]}]
        payload = {"model": "gpt-6-astra", "input": input_items, "instructions": "评审规则", "reasoning": {"effort": "low"},
                   "tools": [{"type": "shell"}], "metadata": {"session": "unused"}, "prompt_cache_key": "old", "max_tokens": 1}
        with model_server(body, chunked=True, captured=captured) as url:
            for _ in range(2):
                response = post_model_json(url, "test-key", payload, 5, threading.Event(), provider="packycode")
                self.assertEqual(json.loads(response.body)["output_text"], "最终结果")
                self.assertEqual(response.usage, {"total_tokens": 23})
        self.assertNotEqual(captured[0]["body"]["prompt_cache_key"], captured[1]["body"]["prompt_cache_key"])
        for call in captured:
            self.assertEqual(call["headers"]["User-Agent"], "CodexTool/1.0")
            self.assertEqual(call["headers"]["Accept"], "text/event-stream")
            self.assertEqual(call["headers"]["Authorization"], "Bearer test-key")
            request = call["body"]
            self.assertEqual(set(request), {"model", "input", "instructions", "reasoning", "stream", "store", "max_output_tokens", "prompt_cache_key"})
            self.assertEqual(request["input"], input_items)
            self.assertEqual(request["instructions"], "评审规则")
            self.assertEqual(request["reasoning"], {"effort": "low"})
            self.assertEqual(uuid.UUID(request["prompt_cache_key"]).version, 4)

    def test_packycode_endpoint_is_explicitly_selected_and_preserves_query(self):
        for ending in ("", "/v1", "/v1/", "/v1/chat/completions", "/v1/responses"):
            endpoint, key = resolve_model_endpoint({"provider": "packycode", "baseUrl": "https://cf.api.fan" + ending + "?x=1", "apiKey": "key"}, "gpt-6-astra")
            self.assertEqual(endpoint, "https://cf.api.fan/v1/responses?x=1")
            self.assertEqual(key, "key")
        endpoint, _ = resolve_model_endpoint({"provider": "custom", "baseUrl": "https://cf.api.fan/v1/responses"}, "claude-test")
        self.assertTrue(endpoint.endswith("/chat/completions"))

    def test_packycode_order_dedup_phase_and_completed_output_precedence(self):
        done = lambda index, item: {"type": "response.output_item.done", "output_index": index, "item": item}
        first, second = make_message("第一", "final_answer", "first"), make_message("第二", "final_answer", "second")
        events = [done(3, second), done(1, make_message("过程说明", "commentary", "commentary")), done(2, first), done(3, second), done(4, second)]
        stream = ResponsesStream()
        raw = sse(*events, complete()).encode()
        for byte in raw:
            stream.feed(bytes([byte]))
        self.assertEqual(stream.result()["output_text"], "第一\n第二")
        stream = ResponsesStream()
        stream.feed(sse(*events, complete([make_message("权威结果", "final_answer", "final")])).encode())
        self.assertEqual(stream.result()["output_text"], "权威结果")

    def test_packycode_requires_terminal_success_and_never_uses_deltas(self):
        partial = {"type": "response.output_item.done", "output_index": 0, "item": make_message("部分文本", "final_answer", "m")}
        bad_events = [
            [],
            [{"type": "response.failed", "response": {"error": {"message": "失败"}}}],
            [{"type": "response.incomplete", "response": {"incomplete_details": {"reason": "max_output_tokens"}}}],
            [{"type": "response.incomplete", "response": {"incomplete_details": {"reason": "content_filter"}}}],
            [{"type": "error", "message": "错误"}],
            [{"type": "response.completed", "response": {"status": "in_progress"}}],
        ]
        for events in bad_events:
            with self.subTest(events=events):
                stream = ResponsesStream()
                stream.feed(sse(partial, *events).encode())
                with self.assertRaises(ValueError):
                    stream.result()
        stream = ResponsesStream()
        stream.feed(sse({"type": "response.output_text.delta", "delta": "部分"}, complete()).encode())
        with self.assertRaisesRegex(ValueError, "有效文本"):
            stream.result()
        stream = ResponsesStream()
        stream.feed(sse(partial).encode() + b'data: {"type":"response.completed","response":{"status":"completed"}}')
        with self.assertRaisesRegex(ValueError, "提前中断"):
            stream.result()

    def test_packycode_gateway_does_not_retry_interrupted_stream(self):
        captured = []
        with model_server(sse({"type": "response.output_text.delta", "delta": "partial"}), True, captured) as url:
            with self.assertRaisesRegex(ValueError, "未自动重试"):
                post_model_json(url, "", {"model": "gpt-6-astra", "input": []}, 5, threading.Event(), provider="packycode")
        self.assertEqual(len(captured), 1)

    def test_packycode_pre_cancel_sends_nothing(self):
        event = threading.Event()
        event.set()
        with patch("backend.model_gateway.http.client.HTTPConnection") as connection:
            with self.assertRaises(ModelRequestCancelled):
                post_model_json("http://localhost/v1/responses", "", {}, 5, event, provider="packycode")
            connection.assert_not_called()

    def test_packycode_timeout_and_inflight_cancel_close_without_retry(self):
        for cancel in (False, True):
            with self.subTest(cancel=cancel), patch("backend.model_gateway.http.client.HTTPConnection") as factory:
                event = threading.Event()
                connection = factory.return_value
                response = connection.getresponse.return_value
                response.status = 200
                def read_chunk(size):
                    if cancel:
                        event.set()
                    raise TimeoutError("timed out")
                response.read1.side_effect = read_chunk
                with self.assertRaises(ModelRequestCancelled if cancel else TimeoutError):
                    post_model_json("http://localhost/v1/responses", "", {"model": "gpt-6-astra", "input": []}, 5, event, provider="packycode")
                self.assertEqual(connection.request.call_count, 1)
                connection.close.assert_called_once()
    def test_nonstream_response_without_length_finishes_like_master_proxy(self):
        body = json.dumps({"status": "completed", "output_text": "OK"})
        with model_server(body) as url:
            response = post_model_json(
                url, "test-key", {"model": "mock-model", "stream": False}, 5, threading.Event()
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.body, body)
        self.assertEqual(response.response_status, "completed")

    def test_chunked_stream_preserves_failed_event_and_unicode(self):
        event = {"type": "response.failed", "response": {
            "status": "failed", "error": {"code": "server_error", "message": "生成失败"}
        }}
        body = "event: response.failed\ndata: " + json.dumps(event, ensure_ascii=False) + "\n\n"
        with model_server(body, chunked=True) as url:
            response = post_model_json(
                url, "test-key", {"model": "mock-model", "stream": True}, 5, threading.Event()
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.body, body)
        self.assertEqual(response.response_status, "failed")


def make_message(text, phase, ident):
    return {"id": ident, "type": "message", "role": "assistant", "status": "completed", "phase": phase,
            "content": [{"type": "output_text", "text": text}]}


def complete(output=None):
    return {"type": "response.completed", "response": {"status": "completed", "output": output or [], "usage": {"total_tokens": 23}}}


def sse(*events):
    return "".join("event: %s\r\ndata: %s\r\n\r\n" % (event["type"], json.dumps(event, ensure_ascii=False)) for event in events)


if __name__ == "__main__":
    unittest.main()
