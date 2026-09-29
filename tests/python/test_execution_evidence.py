"""Failure snapshots through real MCP/HTTP, using only a temporary SQLite database."""
import base64
import concurrent.futures
import io
import sqlite3
import unittest

from PIL import Image
import test_mcp_service as harness


class ExecutionEvidenceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        harness.McpServiceTest.setUpClass()

    @classmethod
    def tearDownClass(cls):
        harness.McpServiceTest.tearDownClass()

    def setUp(self):
        self.c = harness.McpServiceTest()
        self.c.setUp()
        self.api, self.tool = self.c.api, self.c.tool
        file, _ = self.c.make_file()
        self.parent = self.tool('create_execution_set', self.c.write_args(case_file_id=file['id']))['execution_set']
        self.target = {'project_id': self.c.project, 'exec_set_id': self.parent['id']}
        self.row = self.cases()[0]

    def cases(self):
        return self.tool('get_execution_cases', self.target)['items']

    def write(self, row=None, **extra):
        row = row or self.row
        return self.c.write_args(case_id=row['id'], expected_updated_at=row['updated_at'], status='失败', **extra)

    def proof(self, row, index=0, expected=200, token=None):
        return self.api('exec/cases/' + str(row['id']) + '/failure-evidence/' + str(row['failure_evidence'][index]['id']),
                        token=token or self.c.web, expected=expected)

    def screenshot(self):
        image = Image.new('RGB', (160, 100), 'red')
        image.paste('blue', (20, 30, 60, 50))
        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        return {'data_url': 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode(),
                'crop': {'x': 20, 'y': 30, 'width': 40, 'height': 20}}

    def test_screenshot_cropped_history_survives_manual_pass_reload_and_archive_restore(self):
        request = self.write(failure_evidence={'reason': '点击登录后仍停留在登录页，未进入首页。', 'screenshot': self.screenshot()})
        row = self.tool('record_execution_result', request)
        self.assertEqual(row, self.tool('record_execution_result', request))
        self.assertEqual(len(row['failure_evidence']), 1)
        self.assertNotIn('screenshot', row['failure_evidence'][0])
        self.assertNotIn('reason', row['failure_evidence'][0])
        proof = self.proof(row)
        self.assertEqual(proof['case_title'], self.row['title'])
        self.assertEqual(proof['executor_name'], self.c.username)
        image = Image.open(io.BytesIO(base64.b64decode(proof['screenshot'].split(',')[1])))
        self.assertEqual(image.size, (40, 20))
        self.assertEqual(image.getpixel((0, 0)), (0, 0, 255))
        human = self.api('exec/cases/' + str(row['id']), 'PATCH',
                         {'status': '通过', 'actual_result': '人工已通过', 'failure_evidence': []}, token=self.c.web)
        self.assertEqual(human['failure_evidence'], row['failure_evidence'])
        self.assertEqual(self.proof(self.cases()[0]), proof)
        again = self.tool('record_execution_result', self.write(human, actual_result='首页显示空白。'))
        self.assertEqual(len(again['failure_evidence']), 2)
        self.assertEqual(self.proof(again)['reason'], '首页显示空白。')
        self.assertEqual(self.proof(again, 1), proof)
        self.api('exec/sets/' + str(self.parent['id']) + '/archive', 'POST', {'reason': '测试'}, token=self.c.web)
        self.assertEqual(self.proof(again, 1), proof)
        restored = self.api('exec/archives/' + str(self.parent['id']) + '/restore', 'POST', {})
        restored_id = restored['restored_exec_set_id']
        copied = self.api('exec/sets/' + str(restored_id) + '/cases', token=self.c.web)[0]
        self.assertEqual(len(copied['failure_evidence']), 2)
        self.assertEqual(self.proof(copied, 1)['screenshot'], proof['screenshot'])

    def test_each_child_has_own_snapshot_and_manual_failure_never_creates_evidence(self):
        self.api('exec/sets/' + str(self.parent['id']), 'PATCH', {'reuse_enabled': True}, token=self.c.web)
        details = [{'id': 'a', 'text': '皮肤A', 'status': '未执行'}, {'id': 'b', 'text': '皮肤B', 'status': '未执行'}]
        row = self.api('exec/cases/' + str(self.row['id']), 'PATCH', {'reuse_details': details}, token=self.c.web)
        self.tool('record_execution_result', self.write(row, actual_result='未显示'), error='INVALID_ARGUMENT')
        row = self.tool('record_execution_result', self.write(row, reuse_detail_id='a', failure_evidence={'reason': '皮肤A未解锁。'}))
        row = self.tool('record_execution_result', self.write(row, reuse_detail_id='b', failure_evidence={'reason': '皮肤B扣费后未到账。'}))
        self.assertEqual({p['reuse_detail_id'] for p in row['failure_evidence']}, {'a', 'b'})
        self.assertEqual(self.proof(row)['reuse_detail_name'], '皮肤B')
        self.assertEqual(self.proof(row, 1)['reason'], '皮肤A未解锁。')
        details[0]['status'] = '通过'
        details[1]['status'] = '失败'
        human = self.api('exec/cases/' + str(row['id']), 'PATCH', {'reuse_details': details}, token=self.c.web)
        self.assertEqual(human['failure_evidence'], row['failure_evidence'])
        plain = self.api('exec/sets/' + str(self.parent['id']) + '/cases', 'POST', {}, token=self.c.web, expected=201)
        plain = self.api('exec/cases/' + str(plain['id']), 'PATCH', {'status': '失败', 'actual_result': '人工失败'}, token=self.c.web)
        self.assertEqual(plain['failure_evidence'], [])

    def test_invalid_proof_and_permissions_do_not_write(self):
        for fields in ({}, {'actual_result': '失败'}, {'failure_evidence': {'reason': '  '}},
                       {'failure_evidence': {'reason': '失败'}},
                       {'failure_evidence': {'reason': '未显示', 'screenshot': {'data_url': 'https://example.com/image.png'}}},
                       {'failure_evidence': {'reason': '未显示', 'screenshot': {'data_url': 'data:image/png;base64,AAAA'}}},
                       {'failure_evidence': {'reason': '未显示', 'screenshot': {**self.screenshot(), 'crop': {'x': 159, 'y': 0, 'width': 40, 'height': 20}}}}):
            self.tool('record_execution_result', self.write(**fields), error='INVALID_ARGUMENT')
            self.assertEqual(self.cases()[0]['failure_evidence'], [])
            self.assertEqual(self.cases()[0]['updated_at'], self.row['updated_at'])
        success = {**self.write(failure_evidence={'reason': '未显示'}), 'status': '通过'}
        self.tool('record_execution_result', success, error='INVALID_ARGUMENT')
        row = self.tool('record_execution_result', self.write(actual_result='弹窗未显示。'))
        self.assertIsNone(self.proof(row)['screenshot'])
        other = self.api('exec/sets/' + str(self.parent['id']) + '/cases', 'POST', {}, token=self.c.web, expected=201)
        self.api('exec/cases/' + str(other['id']) + '/failure-evidence/' + str(row['failure_evidence'][0]['id']), token=self.c.web, expected=404)
        readonly = self.api('mcp-tokens', 'POST', {'name': 'evidence-readonly', 'read_only': True}, token=self.c.web, expected=201)['token']
        self.tool('record_execution_result', self.write(row, actual_result='没有响应。'), token=readonly, error='PERMISSION_DENIED')
        self.assertEqual(next(item for item in self.cases() if item['id'] == row['id'])['failure_evidence'], row['failure_evidence'])
        self.api('exec/cases/' + str(row['id'] + 1000) + '/failure-evidence/' + str(row['failure_evidence'][0]['id']), token=self.c.web, expected=404)
        self.api('users/assign-projects', 'POST', {'user_id': self.c.user, 'project_ids': []})
        self.proof(row, expected=403)
        self.tool('record_execution_result', self.write(row, actual_result='未显示'), error='PERMISSION_DENIED')

    def test_concurrent_retries_create_one_snapshot_and_receipt_failure_rolls_back(self):
        args = self.write(actual_result='按钮点击后没有响应。')
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            rows = list(pool.map(lambda _: self.tool('record_execution_result', args), range(3)))
        self.assertTrue(all(row == rows[0] for row in rows))
        row = self.cases()[0]
        self.assertEqual(len(row['failure_evidence']), 1)
        # A real second failed run (new key/revision) gets its own snapshot even if the status/reason is unchanged.
        row = self.tool('record_execution_result', self.write(row, actual_result='按钮点击后没有响应。'))
        self.assertEqual(len(row['failure_evidence']), 2)
        self.assertEqual(self.cases()[0]['failure_evidence'], row['failure_evidence'])
        row = self.cases()[0]
        with sqlite3.connect(self.c.db_file) as db:
            db.execute("CREATE TRIGGER fail_evidence_receipt BEFORE INSERT ON mcp_write_receipts BEGIN SELECT RAISE(ABORT, 'test receipt failure'); END")
        try:
            self.tool('record_execution_result', self.write(row, actual_result='新的失败原因。'), error='CONFLICT')
        finally:
            with sqlite3.connect(self.c.db_file) as db:
                db.execute('DROP TRIGGER fail_evidence_receipt')
        self.assertEqual(self.cases()[0]['failure_evidence'], row['failure_evidence'])
        self.assertEqual(self.cases()[0]['updated_at'], row['updated_at'])
