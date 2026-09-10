import json
import threading
import unittest
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from backend.model_gateway import post_model_json


@contextmanager
def model_server(body, chunked=False):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *args):
            pass

        def do_POST(self):
            self.rfile.read(int(self.headers.get("Content-Length", "0")))
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


if __name__ == "__main__":
    unittest.main()
