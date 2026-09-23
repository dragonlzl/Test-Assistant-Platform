"""Similarity review contract, using an isolated HTTP service and temporary SQLite DB."""
import concurrent.futures
import copy
import sqlite3
import unittest
from uuid import uuid4

import test_mcp_service as harness
from backend.case_similarity import features, similarity


class SimilarityRulesTest(unittest.TestCase):
    def test_paraphrase_and_shared_short_titles(self):
        case = {'module': '商城', 'title': '奖励兑换', 'precondition': '活动开启',
                'steps': '点击兑换按钮后确认兑换', 'expected': '奖励到账，剩余次数减少1次'}
        similar = {**case, 'title': '奖励兑换成功', 'steps': '点击兑换按钮并确认兑换'}
        self.assertIsNotNone(similarity(features(case), features(similar)))
        unrelated = {'module': '其他', 'title': '奖励兑换', 'steps': '关闭网络后重启客户端', 'expected': '提示网络连接异常'}
        self.assertIsNone(similarity(features(case), features(unrelated)))
        reordered = {**case, 'title': '次数扣减与发奖'}
        self.assertIsNotNone(similarity(features(case), features(reordered)))
        exact = {**case, 'steps': ' 点击兑换按钮后确认兑换。\n'}
        self.assertEqual(similarity(features(case), features(exact))[0], 1)


class CaseSimilarityTest(unittest.TestCase):
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
        self.case = {'module': '商城', 'title': '奖励兑换', 'priority': 'P0', 'precondition': '活动开启',
                     'steps': '点击兑换按钮后确认兑换', 'expected': '奖励到账，剩余次数减少1次', 'remark': '人工备注'}
        self.file = self.create_manual_file(self.c.project, [self.case])
        self.candidate = {**self.case, 'title': '奖励兑换成功', 'steps': '点击兑换按钮并确认兑换'}
        self.fresh = {'module': '登录', 'title': '密码错误', 'steps': '输入错误密码后登录', 'expected': '提示密码错误'}

    def create_manual_file(self, project, items):
        return self.api('case-files/import', 'POST', {'project_id': project, 'file_name': uuid4().hex, 'items': items}, expected=201)

    def rows(self, file=None):
        return self.api('case-files/' + str((file or self.file)['id']) + '/items')

    def request(self, items=None, **extra):
        file = next(row for row in self.tool('list_case_files', {'project_id': self.c.project})['items'] if row['id'] == self.file['id'])
        return self.c.write_args(case_file_id=file['id'], expected_updated_at=file['updated_at'],
                                 items=items or [self.candidate], **extra)

    def confirm(self, request, report, action='add', decisions=None):
        if decisions is None:
            decisions = [{'item_index': entry['item_index'], 'action': action,
                          **({'case_item_id': entry['matches'][0]['case_item_id']} if action == 'update' else {})}
                         for entry in report['items']]
        return {**request, 'similarity_review': {'review_token': report['review_token'], 'decisions': decisions}}

    def test_review_has_differences_no_writes_and_no_success_receipt(self):
        args = self.request([self.fresh, self.candidate])
        before = self.rows()
        report = self.tool('append_case_items', args, error='CASE_REVIEW_REQUIRED')
        self.assertEqual(report['scope'], 'case_file')
        self.assertEqual(len(report['items']), 1)
        item = report['items'][0]
        self.assertEqual(item['item_index'], 1)
        self.assertEqual(item['choices'], ['update', 'add', 'skip'])
        self.assertEqual(item['matches'][0]['case_item_id'], before[0]['id'])
        self.assertEqual(item['matches'][0]['differences']['title']['before']['text'], '奖励兑换')
        self.assertEqual(item['matches'][0]['differences']['title']['after']['text'], '奖励兑换成功')
        self.assertEqual(self.rows(), before)
        with sqlite3.connect(self.c.db_file) as db:
            self.assertEqual(db.execute('SELECT count(*) FROM mcp_write_receipts WHERE request_key=?', (args['idempotency_key'],)).fetchone()[0], 0)
        self.assertEqual(self.tool('append_case_items', args, error='CASE_REVIEW_REQUIRED')['review_token'], report['review_token'])

    def test_confirm_continue_add_and_exact_duplicate_remains_skipped(self):
        args = self.request()
        report = self.tool('append_case_items', args, error='CASE_REVIEW_REQUIRED')
        confirmed = self.confirm(args, report)
        result = self.tool('append_case_items', confirmed)
        self.assertEqual(result['appended'], 1)
        self.assertEqual(self.tool('append_case_items', confirmed), result)
        rows = self.rows()
        self.assertEqual(rows[0]['ai_operations'], [])
        self.assertEqual(rows[1]['ai_operations'], ['created'])
        exact = self.request([self.case])
        review = self.tool('append_case_items', exact, error='CASE_REVIEW_REQUIRED')
        result = self.tool('append_case_items', self.confirm(exact, review))
        self.assertEqual(result['appended'], 0)
        self.assertEqual(len(self.rows()), 2)

    def test_confirm_update_preserves_omitted_fields_and_marks_modified(self):
        candidate = {key: value for key, value in self.candidate.items() if key not in ('priority', 'remark', 'precondition')}
        args = self.request([candidate])
        report = self.tool('append_case_items', args, error='CASE_REVIEW_REQUIRED')
        self.assertNotIn('priority', report['items'][0]['matches'][0]['differences'])
        result = self.tool('append_case_items', self.confirm(args, report, 'update'))
        rows = self.rows()
        self.assertEqual(len(rows), 1)
        self.assertEqual(result['review_summary']['updated_case_item_ids'], [rows[0]['id']])
        self.assertEqual(rows[0]['title'], candidate['title'])
        for key in ('priority', 'remark', 'precondition'):
            self.assertEqual(rows[0][key], self.case[key])
        self.assertEqual(rows[0]['ai_operations'], ['modified'])

    def test_skip_and_mixed_choices_are_explicit(self):
        args = self.request([self.candidate, self.fresh])
        report = self.tool('append_case_items', args, error='CASE_REVIEW_REQUIRED')
        result = self.tool('append_case_items', self.confirm(args, report, 'skip'))
        self.assertEqual(result['appended'], 1)
        self.assertEqual(result['review_summary']['skipped_item_indexes'], [0])
        self.assertEqual(self.rows()[0]['title'], self.case['title'])
        args = self.request([self.candidate])
        report = self.tool('append_case_items', args, error='CASE_REVIEW_REQUIRED')
        before = self.rows()
        result = self.tool('append_case_items', self.confirm(args, report, 'skip'))
        self.assertEqual(result['appended'], 0)
        self.assertEqual(self.rows(), before)

    def test_create_checks_project_but_append_is_file_scoped(self):
        args = self.c.write_args(file_name='new-file', items=[self.candidate])
        report = self.tool('create_case_file', args, error='CASE_REVIEW_REQUIRED')
        self.assertEqual(report['scope'], 'project')
        self.assertEqual(report['items'][0]['matches'][0]['case_file_id'], self.file['id'])
        created = self.tool('create_case_file', self.confirm(args, report))
        self.assertNotEqual(created['id'], self.file['id'])
        self.assertEqual(self.rows(created)[0]['ai_operations'], ['created'])
        other = self.create_manual_file(self.c.project, [self.fresh])
        request = self.c.write_args(case_file_id=other['id'], expected_updated_at=other['updated_at'], items=[self.case])
        self.assertEqual(self.tool('append_case_items', request)['appended'], 1)

    def test_create_only_updates_or_skips_does_not_create_empty_file(self):
        for action in ('update', 'skip'):
            args = self.c.write_args(file_name='no-empty-' + action, items=[self.candidate])
            report = self.tool('create_case_file', args, error='CASE_REVIEW_REQUIRED')
            result = self.tool('create_case_file', self.confirm(args, report, action))
            self.assertFalse(result['created'])
            self.assertIsNone(result['case_file_id'])
        self.assertEqual(len(self.tool('list_case_files', {'project_id': self.c.project})['items']), 1)

    def test_changed_candidate_or_snapshot_requires_new_confirmation(self):
        args = self.request()
        report = self.tool('append_case_items', args, error='CASE_REVIEW_REQUIRED')
        confirmed = self.confirm(args, report)
        changed = copy.deepcopy(confirmed)
        changed['items'][0]['remark'] = 'changed'
        stale = self.tool('append_case_items', changed, error='CASE_REVIEW_REQUIRED')
        self.assertTrue(stale['stale_review'])
        self.assertNotEqual(stale['review_token'], report['review_token'])
        self.assertEqual(self.rows()[0]['remark'], '人工备注')
        # A content change is caught even when its timestamp is artificially unchanged.
        with sqlite3.connect(self.c.db_file) as db:
            db.execute('UPDATE case_items SET remark=? WHERE id=?', ('并发修改', self.rows()[0]['id']))
        self.assertTrue(self.tool('append_case_items', confirmed, error='CASE_REVIEW_REQUIRED')['stale_review'])

    def test_all_choices_and_selected_targets_are_validated(self):
        args = self.request([self.candidate, {**self.case, 'title': '奖励兑换再次确认'}])
        report = self.tool('append_case_items', args, error='CASE_REVIEW_REQUIRED')
        self.assertEqual(len(report['items']), 2)
        valid = self.confirm(args, report)
        incomplete = copy.deepcopy(valid)
        incomplete['similarity_review']['decisions'].pop()
        self.tool('append_case_items', incomplete, error='INVALID_ARGUMENT')
        duplicate = self.confirm(args, report, 'update')
        self.tool('append_case_items', duplicate, error='INVALID_ARGUMENT')
        foreign = self.create_manual_file(self.c.other_project, [self.case])
        wrong = self.confirm(args, report, decisions=[{'item_index': 0, 'action': 'update', 'case_item_id': self.rows(foreign)[0]['id']},
                                                    {'item_index': 1, 'action': 'skip'}])
        self.tool('append_case_items', wrong, error='INVALID_ARGUMENT')
        self.assertEqual(len(self.rows()), 1)

    def test_unauthorized_readonly_and_revoked_access_never_return_matches(self):
        args = self.request()
        read = self.api('mcp-tokens', 'POST', {'name': 'read', 'read_only': True}, token=self.c.web, expected=201)['token']
        self.tool('append_case_items', args, token=read, error='PERMISSION_DENIED')
        self.tool('append_case_items', {**args, 'project_id': self.c.other_project}, error='PERMISSION_DENIED')
        report = self.tool('append_case_items', args, error='CASE_REVIEW_REQUIRED')
        confirmed = self.confirm(args, report)
        self.api('users/assign-projects', 'POST', {'user_id': self.c.user, 'project_ids': []})
        self.tool('append_case_items', confirmed, error='PERMISSION_DENIED')
        self.assertEqual(len(self.rows()), 1)

    def test_other_projects_are_excluded_and_tokens_cannot_be_transferred(self):
        self.create_manual_file(self.c.other_project, [self.fresh])
        added = self.tool('create_case_file', self.c.write_args(file_name='scope-check', items=[self.fresh]))
        self.assertEqual(self.rows(added)[0]['title'], self.fresh['title'])
        args = self.request()
        report = self.tool('append_case_items', args, error='CASE_REVIEW_REQUIRED')
        other_token = self.api('mcp-tokens', 'POST', {'name': 'other-device'}, token=self.c.web, expected=201)['token']
        changed = self.tool('append_case_items', self.confirm(args, report), token=other_token, error='CASE_REVIEW_REQUIRED')
        self.assertTrue(changed['stale_review'])
        self.assertNotEqual(changed['review_token'], report['review_token'])
        self.assertEqual(len(self.rows()), 1)

    def test_stale_target_revision_and_changed_fields_do_not_bypass_review(self):
        args = self.request()
        report = self.tool('append_case_items', args, error='CASE_REVIEW_REQUIRED')
        target = self.rows()[0]
        self.api('case-files/items/' + str(target['id']), 'PATCH', {'remark': '人工更新'})
        self.tool('append_case_items', self.confirm(args, report), error='CONFLICT')
        renewed = {**args, 'expected_updated_at': self.request()['expected_updated_at']}
        report = self.tool('append_case_items', renewed, error='CASE_REVIEW_REQUIRED')
        altered = self.confirm(renewed, report)
        altered['items'] = [{key: value for key, value in self.candidate.items() if key != 'priority'}]
        self.assertTrue(self.tool('append_case_items', altered, error='CASE_REVIEW_REQUIRED')['stale_review'])
        self.assertEqual(self.rows()[0]['remark'], '人工更新')

    def test_long_differences_are_explicitly_truncated_and_guidance_is_discoverable(self):
        long_case = {**self.case, 'remark': '人工说明' * 300}
        target = self.rows()[0]
        self.api('case-files/items/' + str(target['id']), 'PATCH', {'remark': long_case['remark']})
        report = self.tool('append_case_items', self.request(), error='CASE_REVIEW_REQUIRED')
        before = report['items'][0]['matches'][0]['differences']['remark']['before']
        self.assertTrue(before['truncated'])
        self.assertEqual(len(before['text']), 240)
        catalog = {tool['name']: tool for tool in self.c.rpc('tools/list')[1]['result']['tools']}
        for name in ('create_case_file', 'append_case_items'):
            self.assertIn('CASE_REVIEW_REQUIRED', catalog[name]['description'])
            self.assertIn('询问', catalog[name]['description'])
            self.assertIn('similarity_review', catalog[name]['inputSchema']['properties'])

    def test_database_failure_after_confirmed_update_rolls_back_entire_batch(self):
        args = self.request([self.candidate, self.fresh])
        report = self.tool('append_case_items', args, error='CASE_REVIEW_REQUIRED')
        before = self.rows()
        with sqlite3.connect(self.c.db_file) as db:
            db.execute("CREATE TRIGGER fail_review_insert BEFORE INSERT ON case_items BEGIN SELECT RAISE(ABORT, 'rollback'); END")
        try:
            self.tool('append_case_items', self.confirm(args, report, 'update'), error='CONFLICT')
        finally:
            with sqlite3.connect(self.c.db_file) as db:
                db.execute('DROP TRIGGER fail_review_insert')
        self.assertEqual(self.rows(), before)

    def test_concurrent_confirmation_and_mixed_write_rollback(self):
        args = self.request([self.candidate, self.fresh])
        report = self.tool('append_case_items', args, error='CASE_REVIEW_REQUIRED')
        confirmed = self.confirm(args, report, 'update')
        before = self.rows()
        with sqlite3.connect(self.c.db_file) as db:
            db.execute("CREATE TRIGGER fail_review_receipt BEFORE INSERT ON mcp_write_receipts BEGIN SELECT RAISE(ABORT, 'rollback'); END")
        try:
            self.tool('append_case_items', confirmed, error='CONFLICT')
        finally:
            with sqlite3.connect(self.c.db_file) as db:
                db.execute('DROP TRIGGER fail_review_receipt')
        self.assertEqual(self.rows(), before)
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            results = list(pool.map(lambda _: self.tool('append_case_items', confirmed), range(3)))
        self.assertTrue(all(result == results[0] for result in results))
        self.assertEqual(len(self.rows()), 2)
        self.assertEqual([row['ai_operations'] for row in self.rows()], [['modified'], ['created']])

    def test_match_response_is_bounded_and_large_batches_fail_without_writing(self):
        for i in range(4):
            self.create_manual_file(self.c.project, [{**self.case, 'remark': str(i)}])
        args = self.c.write_args(file_name='bounded', items=[self.candidate])
        report = self.tool('create_case_file', args, error='CASE_REVIEW_REQUIRED')
        self.assertEqual(report['items'][0]['match_count'], 5)
        self.assertTrue(report['items'][0]['matches_truncated'])
        self.assertEqual(len(report['items'][0]['matches']), 3)
        self.tool('append_case_items', self.request([self.candidate] * 31), error='INVALID_ARGUMENT')
        self.assertEqual(len(self.rows()), 1)


if __name__ == '__main__':
    unittest.main()
