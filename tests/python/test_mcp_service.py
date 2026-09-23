"""HTTP contract tests. Launches a private server against an automatically deleted test DB."""
import concurrent.futures
import json
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]


def http(base, path, method='GET', body=None, token=None, headers=None):
    head = {'Content-Type': 'application/json'}
    if token:
        head['Authorization'] = 'Bearer ' + token
    head.update(headers or {})
    req = Request(base + path, data=json.dumps(body).encode() if body is not None else None, headers=head, method=method)
    try:
        response = urlopen(req, timeout=20)
    except HTTPError as exc:
        response = exc
    with response:
        raw = response.read()
        try:
            value = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            value = raw.decode(errors='replace')
        return response.status, value


class McpServiceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='tap-mcp-test-')
        cls.db_file = str(Path(cls.temp.name) / 'apitest.db')
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            cls.port = sock.getsockname()[1]
        cls.base = 'http://127.0.0.1:' + str(cls.port)
        cls.log = open(Path(cls.temp.name) / 'server.log', 'w+')
        script = '''import os
from backend.config import settings
settings.db_file = os.environ['TAP_MCP_TEST_DB']
settings.default_admin_username = 'mcp_test_admin'
settings.default_admin_password = 'mcp-test-password'
import uvicorn
uvicorn.run('backend.main:app', host='127.0.0.1', port=int(os.environ['TAP_MCP_TEST_PORT']), log_level='warning')
'''
        cls.process = subprocess.Popen([sys.executable, '-c', script], cwd=ROOT, stdout=cls.log, stderr=cls.log,
                                       env={**os.environ, 'TAP_MCP_TEST_DB': cls.db_file, 'TAP_MCP_TEST_PORT': str(cls.port)})
        for _ in range(100):
            try:
                if http(cls.base, '/api/health')[0] == 200:
                    break
            except OSError:
                time.sleep(.1)
        else:
            cls.log.seek(0)
            raise RuntimeError(cls.log.read())
        status, login = http(cls.base, '/api/auth/login', 'POST', {'username': 'mcp_test_admin', 'password': 'mcp-test-password'})
        assert status == 200, login
        cls.admin = login['access_token']
        cls.admin_user_id = login['user']['id']
        cls.kb_hits = []
        class KnowledgeHandler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass
            def do_GET(self):
                cls.kb_hits.append(self.path)
                prefix = 'alpha' if self.path.startswith('/alpha/') else 'beta'
                doc = prefix + '-rules'
                path = self.path.split('/', 2)[-1]
                if path == 'manifest.json':
                    data = [{'doc_id': doc, 'module_title': prefix, 'title': prefix + ' secret', 'relative_path': 'rules.md'}]
                elif path == 'kb-manifest.json':
                    data = {'docs_dir': '_llm/docs', 'index_path': '_llm/index.json', 'doc_count': 1, 'entry_count': 1}
                elif path == '_llm/index.json':
                    data = {'entries': [{'doc_id': doc, 'module': prefix, 'title': prefix + ' secret',
                                         'text': 'payment boundary ' + prefix, 'clean_path': '_llm/docs/rules.md'}]}
                elif path == '_llm/docs/rules.md':
                    data = '# ' + prefix + '\n\npayment boundary secret ' + prefix
                elif path == 'models':
                    data = {'data': [{'id': 'test-model'}]}
                else:
                    self.send_error(404)
                    return
                body = (json.dumps(data) if not isinstance(data, str) else data).encode()
                self.send_response(200)
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        cls.kb_server = ThreadingHTTPServer(('127.0.0.1', 0), KnowledgeHandler)
        cls.kb_thread = threading.Thread(target=cls.kb_server.serve_forever, daemon=True)
        cls.kb_thread.start()
        cls.kb_base = 'http://127.0.0.1:' + str(cls.kb_server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.kb_server.shutdown()
        cls.kb_server.server_close()
        cls.process.terminate()
        cls.process.wait(timeout=10)
        cls.log.close()
        cls.temp.cleanup()

    def api(self, path, method='GET', body=None, token=None, expected=200):
        status, value = http(self.base, '/api/' + path, method, body, token or self.admin)
        self.assertEqual(status, expected, value)
        return value

    def setUp(self):
        suffix = uuid4().hex[:10]
        self.project = self.api('projects', 'POST', {'name': 'A-' + suffix}, expected=201)['id']
        self.other_project = self.api('projects', 'POST', {'name': 'B-' + suffix}, expected=201)['id']
        self.username = 'user-' + suffix
        self.user = self.api('users', 'POST', {'username': self.username, 'password': 'mcp-user-password'}, expected=201)['id']
        self.api('users/assign-projects', 'POST', {'user_id': self.user, 'project_ids': [self.project]})
        self.web = self.api('auth/login', 'POST', {'username': self.username, 'password': 'mcp-user-password'})['access_token']
        issued = self.api('mcp-tokens', 'POST', {'name': 'test-cli'}, token=self.web, expected=201)
        self.token, self.token_id = issued['token'], issued['id']

    def rpc(self, method, params=None, token=None, headers=None):
        return http(self.base, '/mcp', 'POST', {'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params or {}},
                    token or self.token, {'Accept': 'application/json, text/event-stream', **(headers or {})})

    def tool(self, name, args=None, token=None, error=None):
        status, response = self.rpc('tools/call', {'name': name, 'arguments': args or {}}, token)
        self.assertEqual(status, 200, response)
        self.assertNotIn('error', response, response)
        result = response['result']
        if error:
            self.assertTrue(result['isError'], result)
            self.assertEqual(result['structuredContent']['error']['code'], error, result)
        else:
            self.assertFalse(result['isError'], result)
        return result['structuredContent']

    def write_args(self, **fields):
        return {'project_id': self.project, 'idempotency_key': str(uuid4()), **fields}

    def make_file(self):
        args = self.write_args(file_name='cases-' + uuid4().hex[:8], items=[{
            'module': 'login', 'title': 'entry', 'steps': 'open', 'expected': 'shown', 'precondition': 'ready'}])
        return self.tool('create_case_file', args), args

    def test_protocol_and_personal_credentials(self):
        status, response = self.rpc('initialize', {'protocolVersion': '2099-01-01', 'capabilities': {}, 'clientInfo': {'name': 'codex-test', 'version': '1'}})
        self.assertEqual(status, 200)
        self.assertEqual(response['result']['protocolVersion'], '2025-06-18')
        self.assertEqual(len(self.rpc('tools/list')[1]['result']['tools']), 30)
        self.assertEqual(self.rpc('ping', headers={'MCP-Protocol-Version': 'invalid'})[0], 400)
        self.assertEqual(self.rpc('ping', headers={'Origin': 'https://evil.test'})[0], 403)
        self.assertEqual(self.rpc('ping', token=self.web)[0], 401)
        self.assertEqual(http(self.base, '/mcp', token=self.token)[0], 405)
        status, _ = http(self.base, '/mcp', 'POST', {'jsonrpc': '2.0', 'method': 'notifications/initialized'}, self.token,
                         {'Accept': 'application/json, text/event-stream'})
        self.assertEqual(status, 202)
        for resource in self.rpc('resources/list')[1]['result']['resources']:
            self.assertIn('text', self.rpc('resources/read', {'uri': resource['uri']})[1]['result']['contents'][0])
        self.assertEqual(self.tool('get_current_user')['user']['id'], self.user)
        listed = self.api('mcp-tokens', token=self.web)
        self.assertNotIn('token', listed[0])
        self.assertNotIn('token_hash', listed[0])
        with sqlite3.connect(self.db_file) as db:
            digest = db.execute('select token_hash from mcp_tokens where id=?', (self.token_id,)).fetchone()[0]
            self.assertNotIn(self.token, digest)
        self.api('mcp-tokens/' + str(self.token_id), 'DELETE', token=self.web)
        self.assertEqual(self.rpc('ping')[0], 401)

    def test_full_workflow_idempotency_and_conflicts(self):
        version = self.tool('create_version', self.write_args(name='v1'))
        self.assertEqual(self.tool('list_versions', {'project_id': self.project})['items'][0]['id'], version['id'])
        file, args = self.make_file()
        replay = self.tool('create_case_file', args)
        self.assertEqual(file, replay)
        self.tool('create_case_file', {**args, 'file_name': 'different'}, error='CONFLICT')
        found = self.tool('get_case_items', {'project_id': self.project, 'case_file_id': file['id']})['items'][0]
        patch = self.write_args(case_item_id=found['id'], expected_updated_at=found['updated_at'], changes={'title': 'new title'})
        updated = self.tool('update_case_item', patch)
        self.assertEqual(updated, self.tool('update_case_item', patch))
        self.tool('update_case_item', {**patch, 'idempotency_key': str(uuid4()), 'changes': {'title': 'stale'}}, error='CONFLICT')
        current = self.tool('list_case_files', {'project_id': self.project})['items'][0]
        extra = self.write_args(case_file_id=file['id'], expected_updated_at=current['updated_at'], items=[{
            'module': 'login', 'title': 'second', 'expected': 'ok'}, {'module': 'login', 'title': 'second', 'expected': 'ok'}])
        self.assertEqual(self.tool('append_case_items', extra)['appended'], 1)
        self.assertEqual(self.tool('search_cases', {'project_id': self.project, 'query': 'second'})['total'], 1)
        page = self.tool('get_case_items', {'project_id': self.project, 'case_file_id': file['id'], 'limit': 1})
        self.assertEqual(page['next_offset'], 1)
        creation = self.write_args(case_file_id=file['id'], version_id=version['id'])
        execution = self.tool('create_execution_set', creation)
        self.assertTrue(execution['created'])
        exec_id = execution['execution_set']['id']
        ec = self.tool('get_execution_cases', {'project_id': self.project, 'exec_set_id': exec_id})['items'][0]
        self.tool('record_execution_result', self.write_args(case_id=ec['id'], expected_updated_at=ec['updated_at'],
                                                           status='失败', actual_result='not shown', defect_link='https://tracker.test/1'))
        second = self.tool('create_execution_set', {**creation, 'idempotency_key': str(uuid4())})
        self.assertFalse(second['created'])
        ec_after = self.tool('get_execution_cases', {'project_id': self.project, 'exec_set_id': exec_id})['items'][0]
        self.assertEqual(ec_after['status'], '失败')
        self.assertEqual(self.tool('get_execution_overview', {'project_id': self.project})['items'][0]['failed'], 1)
        self.assertGreater(self.tool('get_case_history', {'project_id': self.project, 'file_name': file['file_name_clean']})['total'], 0)
        self.api('exec/sets/' + str(exec_id) + '/archive', 'POST', {'reason': 'test archive'}, token=self.web)
        self.assertEqual(self.tool('list_archives', {'project_id': self.project})['items'][0]['exec_set_id'], exec_id)
        self.assertEqual(self.tool('get_archive', {'project_id': self.project, 'exec_set_id': exec_id, 'limit': 1})['total'], 2)

    def test_case_writing_context_is_delivered_without_resource_read(self):
        guide = (ROOT / 'AI_CASE_WRITING_STYLE_GUIDE.md').read_text(encoding='utf-8')
        for version in ('2025-06-18', '2025-03-26'):
            with self.subTest(version=version):
                status, response = self.rpc('initialize', {
                    'protocolVersion': version, 'capabilities': {},
                    'clientInfo': {'name': 'style-test', 'version': '1'}})
                self.assertEqual(status, 200, response)
                instructions = response['result']['instructions']
                self.assertIn(guide, instructions)
                self.assertIn('tap://standards/case-writing', instructions)
                self.assertIn('必须遵循与 XMind 相同的人工编写风格', instructions)
                self.assertIn('precondition', instructions)
                self.assertIn('steps 是可换行的字符串', instructions)
                self.assertIn('idempotency_key', instructions)
                self.assertIn('expected_updated_at', instructions)
                self.assertIn('单条用例的复杂度与拆分', instructions)
                self.assertIn('先拆分再对最终候选逐条查重', instructions)
        resource = self.rpc('resources/read', {'uri': 'tap://standards/case-writing'})[1]['result']
        self.assertEqual(resource['contents'][0]['text'], guide)

        catalog = {item['name']: item for item in self.rpc('tools/list')[1]['result']['tools']}
        for name, model in (('create_case_file', 'CaseData'), ('append_case_items', 'CaseData'),
                            ('update_case_item', 'CasePatch')):
            with self.subTest(tool=name):
                # Tools-only clients also receive actionable style guidance before writing.
                description = catalog[name]['description']
                self.assertIn('tap://standards/case-writing', description)
                for rule in ('4-12', '单行动作', '可观察结果', '关键数值', '语义去重',
                             '复杂度自检', '拆成多条用例', '可独立执行', '必要连续操作', '重新查重确认'):
                    self.assertIn(rule, description)
                properties = catalog[name]['inputSchema']['$defs'][model]['properties']
                for field in ('module', 'title', 'priority', 'precondition', 'steps', 'expected', 'remark'):
                    self.assertTrue(properties[field].get('description'), field)
                self.assertNotIn('preconditions', properties)
                self.assertIn('字符串', properties['steps']['description'])
                self.assertIn('拆成多条', properties['steps']['description'])
                self.assertIn('关键数值', properties['expected']['description'])
        self.assertNotIn('tap://standards/case-writing', catalog['record_execution_result']['description'])

    def test_case_writing_guidance_preserves_content_and_partial_updates(self):
        case = {
            'module': '奖励兑换', 'title': '兑换后重登奖励与剩余次数保持一致', 'priority': 'P0',
            'precondition': '活动已开启，兑换币 100，剩余次数 1',
            'steps': '1、使用 100 兑换币兑换奖励\n2、重登查看奖励和剩余次数',
            'expected': '奖励到账一次，兑换币为 0，剩余次数为 0，重登后保持一致', 'remark': ''}
        created = self.tool('create_case_file', self.write_args(file_name='人工风格', items=[case]))
        target = {'project_id': self.project, 'case_file_id': created['id']}
        saved = self.tool('get_case_items', target)['items'][0]
        for field, value in case.items():
            self.assertEqual(saved[field], value)
        appended = {**case, 'title': '取消兑换', 'steps': '点击兑换后取消确认',
                    'expected': '兑换币仍为 100，剩余次数为 1，奖励未发放'}
        result = self.tool('append_case_items', self.write_args(
            case_file_id=created['id'], expected_updated_at=created['updated_at'], items=[appended]))
        self.assertEqual(result['appended'], 1)
        items = self.tool('get_case_items', target)['items']
        self.assertEqual(len(items), 2)
        for field, value in appended.items():
            self.assertEqual(next(item for item in items if item['title'] == '取消兑换')[field], value)
        updated = self.tool('update_case_item', self.write_args(
            case_item_id=saved['id'], expected_updated_at=saved['updated_at'], changes={'title': '兑换重登'}))
        for field, value in {**case, 'title': '兑换重登'}.items():
            self.assertEqual(updated[field], value)

    def test_concurrent_retries_and_transaction_rollback(self):
        args = self.write_args(name='concurrent')
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: self.tool('create_version', args), range(4)))
        self.assertEqual(len({r['id'] for r in results}), 1)
        # Fail receipt insert after the reused route service has internally called commit.
        with sqlite3.connect(self.db_file) as db:
            db.execute("CREATE TRIGGER fail_mcp_receipt BEFORE INSERT ON mcp_write_receipts BEGIN SELECT RAISE(ABORT, 'test rollback'); END")
        try:
            self.tool('create_version', self.write_args(name='must-rollback'), error='CONFLICT')
        finally:
            with sqlite3.connect(self.db_file) as db:
                db.execute('DROP TRIGGER fail_mcp_receipt')
        self.assertNotIn('must-rollback', [r['name'] for r in self.tool('list_versions', {'project_id': self.project})['items']])

    def test_ai_operations_accumulate_and_survive_human_edits_and_restore(self):
        file, _ = self.make_file()
        target = {'project_id': self.project, 'case_file_id': file['id']}
        item = self.tool('get_case_items', target)['items'][0]
        self.assertEqual(item['ai_operations'], ['created'])
        execution = self.tool('create_execution_set', self.write_args(case_file_id=file['id']))['execution_set']
        exec_target = {'project_id': self.project, 'exec_set_id': execution['id']}
        row = self.tool('get_execution_cases', exec_target)['items'][0]
        self.assertEqual(row['ai_operations'], ['created'])
        edited = self.tool('update_case_item', self.write_args(case_item_id=item['id'],
            expected_updated_at=item['updated_at'], changes={'title': 'AI修改的标题'}))
        self.assertEqual(edited['ai_operations'], ['created', 'modified'])
        row = self.tool('get_execution_cases', exec_target)['items'][0]
        self.assertEqual(row['ai_operations'], ['created', 'modified'])
        args = self.write_args(case_id=row['id'], expected_updated_at=row['updated_at'], status='失败')
        result = self.tool('record_execution_result', args)
        self.assertEqual(result, self.tool('record_execution_result', args))
        flags = ['created', 'modified', 'executed']
        self.assertEqual(result['ai_operations'], flags)
        self.assertEqual(self.tool('get_case_items', target)['items'][0]['ai_operations'], flags)
        # Public edit payloads cannot erase server-owned provenance.
        human = self.api('case-files/items/' + str(item['id']), 'PATCH',
                         {'title': '人工修改的标题', 'ai_operations': []}, token=self.web)
        self.assertEqual(human['ai_operations'], flags)
        human_exec = self.api('exec/cases/' + str(row['id']), 'PATCH',
                              {'status': '通过', 'ai_operations': []}, token=self.web)
        self.assertEqual(human_exec['ai_operations'], flags)
        self.api('exec/sets/' + str(execution['id']) + '/archive', 'POST', {}, token=self.web)
        archived = self.tool('get_archive', exec_target)['items'][0]
        self.assertEqual(archived['ai_operations'], flags)
        restored = self.api('exec/archives/' + str(execution['id']) + '/restore', 'POST', {})
        restored_rows = self.api('exec/sets/' + str(restored['restored_exec_set_id']) + '/cases', token=self.web)
        self.assertEqual(restored_rows[0]['ai_operations'], flags)

    def test_ai_operations_only_mark_changed_or_inserted_cases(self):
        case = {'module': '人工', 'title': '未被AI操作', 'precondition': '就绪', 'steps': '查看', 'expected': '显示'}
        file = self.api('case-files/import', 'POST', {'project_id': self.project, 'file_name': '人工创建',
                        'source': 'mcp', 'items': [{**case, 'ai_operations': ['created']}]}, token=self.web, expected=201)
        target = {'project_id': self.project, 'case_file_id': file['id']}
        item = self.tool('get_case_items', target)['items'][0]
        self.assertEqual(item['ai_operations'], [])
        unchanged = self.tool('update_case_item', self.write_args(case_item_id=item['id'],
                             expected_updated_at=item['updated_at'], changes={'title': case['title']}))
        self.assertEqual(unchanged['ai_operations'], [])
        current = self.tool('list_case_files', {'project_id': self.project})['items'][0]
        append_args = self.write_args(case_file_id=file['id'], expected_updated_at=current['updated_at'],
                                     items=[case, {**case, 'title': 'AI追加'}, {**case, 'title': 'AI追加'}])
        review = self.tool('append_case_items', append_args, error='CASE_REVIEW_REQUIRED')
        self.tool('append_case_items', {**append_args, 'similarity_review': {
            'review_token': review['review_token'], 'decisions': [{'item_index': 0, 'action': 'add'}]}})
        items = self.tool('get_case_items', target)['items']
        self.assertEqual({row['title']: row['ai_operations'] for row in items}, {'未被AI操作': [], 'AI追加': ['created']})
        # A failing receipt must roll back both content and provenance on linked records.
        execution = self.tool('create_execution_set', self.write_args(case_file_id=file['id']))['execution_set']
        row = self.tool('get_execution_cases', {'project_id': self.project, 'exec_set_id': execution['id']})['items'][0]
        with sqlite3.connect(self.db_file) as db:
            db.execute("CREATE TRIGGER fail_ai_receipt BEFORE INSERT ON mcp_write_receipts BEGIN SELECT RAISE(ABORT, 'rollback'); END")
        try:
            self.tool('record_execution_result', self.write_args(case_id=row['id'], expected_updated_at=row['updated_at'],
                      status='失败'), error='CONFLICT')
        finally:
            with sqlite3.connect(self.db_file) as db:
                db.execute('DROP TRIGGER fail_ai_receipt')
        self.assertEqual(self.tool('get_case_items', target)['items'][0]['ai_operations'], [])
        after = self.api('exec/sets/' + str(execution['id']) + '/cases', token=self.web)[0]
        self.assertEqual(after['ai_operations'], [])
        self.assertEqual(after['status'], '未执行')

    def test_ai_operations_do_not_follow_reused_deleted_ids(self):
        file, _ = self.make_file()
        target = {'project_id': self.project, 'case_file_id': file['id']}
        old = self.tool('get_case_items', target)['items'][0]
        execution = self.tool('create_execution_set', self.write_args(case_file_id=file['id']))['execution_set']
        exec_target = {'project_id': self.project, 'exec_set_id': execution['id']}
        row = self.tool('get_execution_cases', exec_target)['items'][0]
        self.api('case-files/items/' + str(old['id']), 'DELETE', token=self.web)
        new = self.api('case-files/' + str(file['id']) + '/items', 'POST',
                       {'module': '人工', 'title': '重新新增', 'expected': '正常'}, token=self.web, expected=201)
        self.assertEqual(new['ai_operations'], [])
        # Force the SQLite ID-reuse boundary even if other tests have allocated higher IDs.
        with sqlite3.connect(self.db_file) as db:
            db.execute('update exec_cases set case_item_source_id=? where id=?', (new['id'], row['id']))
        updated = self.tool('record_execution_result', self.write_args(case_id=row['id'],
                            expected_updated_at=row['updated_at'], status='失败'))
        self.assertEqual(updated['ai_operations'], ['created', 'executed'])
        self.assertEqual(self.tool('get_case_items', target)['items'][0]['ai_operations'], [])

    def test_ai_execution_tracks_a_case_bound_after_manual_creation(self):
        file, _ = self.make_file()
        execution = self.tool('create_execution_set', self.write_args(case_file_id=file['id']))['execution_set']
        row = self.api('exec/sets/' + str(execution['id']) + '/cases', 'POST', {}, token=self.web, expected=201)
        self.assertIsNone(row['case_item_id'])
        row = self.api('exec/cases/' + str(row['id']), 'PATCH', {
            'module': '手动新增', 'title': '后续入库', 'priority': 'P1', 'precondition': '就绪', 'steps': '查看', 'expected': '显示'}, token=self.web)
        self.assertIsNotNone(row['case_item_id'])
        self.assertEqual(row['ai_operations'], [])
        unchanged = self.tool('record_execution_result', self.write_args(case_id=row['id'],
                              expected_updated_at=row['updated_at'], status='未执行'))
        self.assertEqual(unchanged['ai_operations'], [])
        result = self.tool('record_execution_result', self.write_args(case_id=row['id'],
                           expected_updated_at=unchanged['updated_at'], status='失败'))
        self.assertEqual(result['ai_operations'], ['executed'])
        items = self.api('case-files/' + str(file['id']) + '/items', token=self.web)
        self.assertEqual(next(item for item in items if item['id'] == row['case_item_id'])['ai_operations'], ['executed'])

    def test_permissions_live_changes_and_readonly(self):
        self.assertEqual([p['id'] for p in self.tool('list_projects')['items']], [self.project])
        self.tool('list_case_files', {'project_id': self.other_project}, error='PERMISSION_DENIED')
        self.tool('list_projects', {'include_all': True}, error='INVALID_ARGUMENT')
        read = self.api('mcp-tokens', 'POST', {'name': 'read', 'read_only': True}, token=self.web, expected=201)['token']
        self.assertNotIn('create_version', [t['name'] for t in self.rpc('tools/list', token=read)[1]['result']['tools']])
        self.tool('create_version', self.write_args(name='no'), token=read, error='PERMISSION_DENIED')
        file, args = self.make_file()
        self.tool('get_case_items', {'project_id': self.other_project, 'case_file_id': file['id']}, error='PERMISSION_DENIED')
        admin_token = self.api('mcp-tokens', 'POST', {'name': 'admin'}, expected=201)['token']
        self.tool('list_case_files', {'project_id': self.other_project}, token=admin_token)
        self.api('users/assign-projects', 'POST', {'user_id': self.user, 'project_ids': []})
        self.tool('create_case_file', args, error='PERMISSION_DENIED')
        self.tool('get_case_items', {'project_id': self.project, 'case_file_id': file['id']}, error='PERMISSION_DENIED')
        self.api('users/' + str(self.user), 'PATCH', {'is_active': False})
        self.assertEqual(self.rpc('ping')[0], 401)

    def test_personal_execution_and_result_only(self):
        file, _ = self.make_file()
        admin_exec = self.api('exec/sets/from-case-file', 'POST', {'case_file_id': file['id']})
        ec = self.tool('get_execution_cases', {'project_id': self.project, 'exec_set_id': admin_exec['id']})['items'][0]
        self.tool('record_execution_result', self.write_args(case_id=ec['id'], expected_updated_at=ec['updated_at'], status='通过'), error='PERMISSION_DENIED')
        own = self.tool('create_execution_set', self.write_args(case_file_id=file['id']))['execution_set']
        ec = self.tool('get_execution_cases', {'project_id': self.project, 'exec_set_id': own['id']})['items'][0]
        # Simulate a previously detached complete execution case: result writes must not auto-bind or recreate library cases.
        with sqlite3.connect(self.db_file) as db:
            db.execute('update exec_cases set case_item_id=NULL, case_item_source_id=NULL, title=? where id=?', ('detached', ec['id']))
        before = self.api('case-files/' + str(file['id']) + '/items', token=self.web)
        self.tool('record_execution_result', self.write_args(case_id=ec['id'], expected_updated_at=ec['updated_at'], status='通过'))
        after = self.api('case-files/' + str(file['id']) + '/items', token=self.web)
        self.assertEqual(before, after)
        self.tool('record_execution_result', self.write_args(case_id=ec['id'], expected_updated_at=ec['updated_at'], status='通过', title='forbidden'), error='INVALID_ARGUMENT')

    def test_knowledge_project_isolation_and_cache_revocation(self):
        a = self.api('knowledge-base/sources', 'POST', {'project_id': self.project, 'name': 'A', 'base_url': self.kb_base + '/alpha/'}, expected=201)
        b = self.api('knowledge-base/sources', 'POST', {'project_id': self.other_project, 'name': 'B', 'base_url': self.kb_base + '/beta/'}, expected=201)
        sources = self.tool('list_knowledge_bases', {'project_id': self.project})['items']
        self.assertEqual([r['id'] for r in sources], [a['id']])
        self.assertNotIn('base_url', sources[0])
        self.api('knowledge-base/sources', 'POST', {'project_id': self.project, 'name': 'no', 'base_url': self.kb_base}, token=self.web, expected=403)
        target = {'project_id': self.project, 'knowledge_base_id': a['id']}
        self.assertEqual(self.tool('list_knowledge_documents', target)['items'][0]['doc_id'], 'alpha-rules')
        result = self.tool('search_knowledge', {**target, 'query': 'payment'})
        self.assertIn('alpha', json.dumps(result))
        self.assertNotIn('beta', json.dumps(result))
        self.tool('get_knowledge_document', {**target, 'doc_id': 'alpha-rules'})
        self.tool('get_knowledge_document', {**target, 'doc_id': 'beta-rules'}, error='NOT_FOUND')
        self.tool('search_knowledge', {**target, 'knowledge_base_id': b['id'], 'query': 'payment'}, error='PERMISSION_DENIED')
        for endpoint in ('access', 'validate', 'catalog', 'documents', 'search'):
            self.api('knowledge-base/' + endpoint, 'POST', {'base_url': b['base_url'], 'doc_ids': ['beta-rules']}, token=self.web, expected=403)
        self.api('model-proxy/models', 'POST', {'base_url': b['base_url'] + 'manifest.json'}, token=self.web, expected=400)
        listing = self.api('model-proxy/models', 'POST', {'base_url': b['base_url'] + 'models'}, token=self.web)
        self.assertEqual(listing['data'][0]['id'], 'test-model')
        self.api('knowledge-base/catalog', 'POST', {'base_url': a['base_url']}, token=self.web)
        hits = len(self.kb_hits)
        self.api('users/assign-projects', 'POST', {'user_id': self.user, 'project_ids': []})
        self.tool('get_knowledge_document', {**target, 'doc_id': 'alpha-rules'}, error='PERMISSION_DENIED')
        self.api('knowledge-base/catalog', 'POST', {'base_url': a['base_url']}, token=self.web, expected=403)
        self.assertEqual(len(self.kb_hits), hits)

    def test_reuse_result_updates_one_detail_and_aggregates(self):
        file, _ = self.make_file()
        own = self.tool('create_execution_set', self.write_args(case_file_id=file['id']))['execution_set']
        ec = self.tool('get_execution_cases', {'project_id': self.project, 'exec_set_id': own['id']})['items'][0]
        details = [{'id': 'a', 'text': 'A', 'status': '不适用', 'statusOrigin': 'auto-applicability'},
                   {'id': 'b', 'text': 'B', 'status': '未执行'}]
        with sqlite3.connect(self.db_file) as db:
            db.execute('update exec_sets set reuse_enabled=1 where id=?', (own['id'],))
            db.execute('update exec_cases set reuse_details=? where id=?', (json.dumps(details), ec['id']))
        args = self.write_args(case_id=ec['id'], expected_updated_at=ec['updated_at'], status='通过')
        self.tool('record_execution_result', args, error='INVALID_ARGUMENT')
        result = self.tool('record_execution_result', {**args, 'reuse_detail_id': 'a', 'reuse_note': 'verified'})
        self.assertEqual(result['status'], '未执行')
        self.assertEqual(result['reuse_details'][0]['status'], '通过')
        self.assertNotIn('statusOrigin', result['reuse_details'][0])
        self.assertEqual(result['reuse_details'][1], details[1])
        self.assertEqual(result['ai_operations'], ['created', 'executed'])
        result = self.tool('record_execution_result', self.write_args(case_id=ec['id'], expected_updated_at=result['updated_at'],
                                                                    status='通过', reuse_detail_id='b'))
        self.assertEqual(result['status'], '通过')

    def test_missing_cases_and_password_revocation(self):
        mod = self.api('missing-modules', 'POST', {'project_id': self.project, 'name': 'boundary'}, token=self.web, expected=201)
        self.api('missing-modules/' + str(mod['id']) + '/items', 'POST', {'title': 'edge', 'expected': 'ok'}, token=self.web, expected=201)
        self.assertEqual(self.tool('list_missing_cases', {'project_id': self.project})['items'][0]['module_name'], 'boundary')
        self.api('auth/password', 'POST', {'old_password': 'mcp-user-password', 'new_password': 'new-password'}, token=self.web)
        self.assertEqual(self.rpc('ping')[0], 401)

    def test_role_expiry_source_disable_and_explicit_sharing(self):
        source = self.api('knowledge-base/sources', 'POST', {'project_id': self.other_project, 'name': 'B',
                          'base_url': self.kb_base + '/beta/'}, expected=201)
        self.api('users/assign-projects', 'POST', {'user_id': self.user, 'project_ids': [self.project, self.other_project]})
        target = {'project_id': self.other_project, 'knowledge_base_id': source['id'], 'query': 'payment'}
        self.tool('search_knowledge', target)
        self.api('knowledge-base/sources/' + str(source['id']), 'DELETE')
        self.tool('search_knowledge', target, error='PERMISSION_DENIED')
        self.api('knowledge-base/sources', 'POST', {'project_id': self.project, 'name': 'Shared B',
                 'base_url': source['base_url']}, expected=201)
        self.api('knowledge-base/catalog', 'POST', {'base_url': source['base_url']}, token=self.web)
        # Promotion/demotion must be honored by an existing credential.
        self.api('users/assign-projects', 'POST', {'user_id': self.user, 'project_ids': [self.project]})
        self.api('users/' + str(self.user), 'PATCH', {'role': 'admin'})
        self.tool('list_case_files', {'project_id': self.other_project})
        self.api('users/' + str(self.user), 'PATCH', {'role': 'user'})
        self.tool('list_case_files', {'project_id': self.other_project}, error='PERMISSION_DENIED')
        with sqlite3.connect(self.db_file) as db:
            db.execute("update mcp_tokens set expires_at='2000-01-01' where id=?", (self.token_id,))
        self.assertEqual(self.rpc('ping')[0], 401)

    def test_knowledge_resource_paths_cannot_escape_registered_root(self):
        from backend.knowledge_base_service import _build_resource_url, KnowledgeBaseServiceError
        for path in ('../beta/manifest.json', '%2e%2e/beta/manifest.json', 'https://another.test/data',
                     '//another.test/data', '..\\beta\\data', '/absolute/data'):
            with self.subTest(path=path), self.assertRaises(KnowledgeBaseServiceError):
                _build_resource_url('http://kb.test/alpha/', path)
        self.assertEqual(_build_resource_url('http://kb.test/alpha/', '_llm/docs/rules.md'),
                         'http://kb.test/alpha/_llm/docs/rules.md')

    def test_static_secrets_and_audit(self):
        for path in ('/backend/config.py', '/backend/config_local.py', '/data/app.db', '/.git/config', '/feishu_config.json', '/config/auth.json',
                     '/data/backups/app.db/short.db', '/data/backups/app.db/long.db', '/data/backups/app.db/.backup.lock'):
            self.assertEqual(http(self.base, path)[0], 404, path)
        for path in ('/', '/settings.html', '/services/apiClient.js', '/scripts/modules/mcpSettings.js', '/MCP_GUIDE.md',
                     '/styles/workspace-shell.css', '/styles/workspace-lists.css', '/caseTemplate/manifest.json'):
            self.assertEqual(http(self.base, path)[0], 200, path)
        self.tool('get_current_user')
        with sqlite3.connect(self.db_file) as db:
            logs = db.execute("select detail from operation_logs where action='mcp_tool_call' and user_id=?", (self.user,)).fetchall()
        self.assertTrue(logs)
        self.assertNotIn(self.token, json.dumps(logs))
        self.assertEqual(json.loads(logs[-1][0])['credential_id'], self.token_id)


class AiOperationsMigrationTest(unittest.TestCase):
    def test_legacy_rows_default_empty_and_upgrade_is_idempotent(self):
        from sqlalchemy import create_engine, text
        from backend.migrations import apply_migrations
        engine = create_engine('sqlite:///:memory:')
        try:
            with engine.begin() as conn:
                conn.execute(text('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)'))
                for version in range(1, 30):
                    conn.execute(text("INSERT INTO schema_migrations VALUES (:v, '2026-01-01')"), {'v': version})
                for table in ('case_items', 'exec_cases'):
                    conn.execute(text('CREATE TABLE ' + table + ' (id INTEGER PRIMARY KEY, title TEXT)'))
                    conn.execute(text("INSERT INTO " + table + " VALUES (1, '旧用例')"))
            apply_migrations(engine)
            with engine.begin() as conn:
                for table in ('case_items', 'exec_cases'):
                    row = conn.execute(text('SELECT title, ai_operations FROM ' + table)).one()
                    self.assertEqual(tuple(row), ('旧用例', '[]'))
                conn.execute(text('UPDATE case_items SET ai_operations = :flags'), {'flags': '["created"]'})
            apply_migrations(engine)
            with engine.connect() as conn:
                self.assertEqual(conn.execute(text('SELECT ai_operations FROM case_items')).scalar(), '["created"]')
        finally:
            engine.dispose()


if __name__ == '__main__':
    unittest.main()
