"""Local proxy and recovery tests; all database sessions are mocked."""
import json
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from backend import models, schemas
from backend.model_task_service import ModelTaskExecutor
from backend.packycode import prepare_request
from backend.routers.configs import proxy_model_request
from test_model_gateway import complete, make_message, model_server, sse


class PackycodeServiceTests(unittest.TestCase):
    def test_proxy_only_prepares_packycode_when_type_is_selected(self):
        with patch("backend.routers.configs.prepare_request", wraps=prepare_request) as prepare, \
                patch("backend.routers.configs.urllib_request.build_opener") as opener:
            response = opener.return_value.open.return_value.__enter__.return_value
            response.read1.return_value = sse(complete([make_message("OK", "final_answer", "m")])).encode()
            proxy_model_request(schemas.ModelProxyRequest(provider="packycode", base_url="https://cf.api.fan/v1",
                payload={"model": "gpt-6-astra", "input": []}), None)
            prepare.assert_called_once()
            request = opener.return_value.open.call_args.args[0]
            self.assertEqual(request.full_url, "https://cf.api.fan/v1/responses")
            self.assertEqual(request.get_header("User-agent"), "CodexTool/1.0")
            prepare.reset_mock()
            response.read.return_value = b'{"output_text":"OK"}'
            response.status = 200
            response.headers = {"Content-Type": "application/json"}
            proxy_model_request(schemas.ModelProxyRequest(provider="custom", base_url="https://cf.api.fan/v1/responses",
                payload={"model": "gpt-6-astra", "input": []}), None)
            prepare.assert_not_called()
            request = opener.return_value.open.call_args.args[0]
            self.assertEqual(request.get_header("User-agent"), "tap-model-proxy/1.0")

    def test_proxy_uses_same_contract_and_completion_parser(self):
        captured = []
        body = sse({"type": "response.output_item.done", "output_index": 0, "item": make_message("代理结果", "final_answer", "m")}, complete())
        with model_server(body, True, captured) as url:
            response = proxy_model_request(schemas.ModelProxyRequest(
                provider="packycode", base_url=url, api_key="test-key",
                payload={"model": "gpt-6-astra", "input": []}, timeout_sec=5,
            ), None)
        self.assertEqual(json.loads(response.body)["output_text"], "代理结果")
        self.assertEqual(captured[0]["headers"]["User-Agent"], "CodexTool/1.0")
        self.assertEqual(captured[0]["body"]["max_output_tokens"], 16384)

    def test_proxy_incomplete_stream_is_error_and_single_request(self):
        captured = []
        with model_server(sse({"type": "response.incomplete", "response": {"incomplete_details": {"reason": "max_output_tokens"}}}), True, captured) as url:
            with self.assertRaises(HTTPException) as caught:
                proxy_model_request(schemas.ModelProxyRequest(
                    provider="packycode", base_url=url,
                    payload={"model": "gpt-6-astra", "input": []}, timeout_sec=5,
                ), None)
        self.assertEqual(caught.exception.status_code, 502)
        self.assertIn("max_output_tokens", caught.exception.detail)
        self.assertEqual(len(captured), 1)

    def test_recovery_does_not_resend_started_packycode_but_recovers_queued_and_other_providers(self):
        tasks = [SimpleNamespace(
            id=name, model_config_id=ident, status=status, started_at=started,
            attempt_count=attempts, request_json={"model": "gpt-6-astra"}, worker_id="old",
        ) for name, ident, status, started, attempts in [
            ("packy-started", 1, "running", True, 1),
            ("packy-queued", 1, "queued", None, 0),
            ("other-started", 2, "running", True, 1),
            ("packy-cancelled", 1, "cancel_requested", True, 1),
        ]]
        db = MagicMock()
        config_queries = iter([
            {"provider": "packycode", "baseUrl": "https://cf.api.fan/v1"},
            {"provider": "packycode"}, {"provider": "custom", "baseUrl": "https://cf.api.fan/v1"},
        ])
        def query(kind):
            q = MagicMock()
            if kind is models.ModelTask:
                q.filter.return_value.all.return_value = tasks
            else:
                q.filter.return_value.first.return_value = SimpleNamespace(config_json=next(config_queries))
            return q
        db.query.side_effect = query
        executor = ModelTaskExecutor(1)
        try:
            with patch("backend.model_task_service.SessionLocal", return_value=db), patch.object(executor, "submit") as submit:
                self.assertEqual(executor.recover_incomplete(), 2)
                self.assertEqual([call.args[0] for call in submit.call_args_list], ["packy-queued", "other-started"])
            self.assertEqual(tasks[0].status, "failed")
            self.assertIn("未自动重试", tasks[0].error)
            self.assertEqual(tasks[0].request_json, {})
            self.assertEqual(tasks[3].status, "cancelled")
        finally:
            executor.shutdown()


if __name__ == "__main__":
    unittest.main()
