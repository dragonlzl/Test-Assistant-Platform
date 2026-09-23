"""Bounded audit query regression using the MCP suite's isolated HTTP/test DB harness."""
import json
import sqlite3
import unittest
from datetime import datetime, timedelta, timezone

import test_mcp_service as harness


class OperationQueryTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        harness.McpServiceTest.setUpClass()

    @classmethod
    def tearDownClass(cls):
        harness.McpServiceTest.tearDownClass()

    def setUp(self):
        self.client = harness.McpServiceTest()
        self.client.setUp()
        self.api = self.client.api
        self.now = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=1)

    def seed(self, action, detail, created_at=None, target_id=None, result='success', count=1):
        with sqlite3.connect(self.client.db_file) as db:
            ids = []
            for _ in range(count):
                cur = db.execute('INSERT INTO operation_logs(user_id,action,target_type,target_id,result,detail,created_at) VALUES(?,?,?,?,?,?,?)',
                                 (self.client.user, action, 'case_file', target_id, result, json.dumps(detail), str(created_at or self.now)))
                ids.append(cur.lastrowid)
        return ids

    def query(self, **kw):
        return self.api('ops/query', 'POST', {'user_id': self.client.user, **kw})

    def test_bounded_summary_cursor_snapshot_and_details(self):
        ids = self.seed('large_test', {'title': 'x'*50000, 'model_config': {'api_key': 'do-not-return'},
                                    'old': 'a'*30000, 'new': 'b'*30000}, count=45)
        first = self.query(actions=['large_test'])
        self.assertEqual(len(first['items']), 20)
        self.assertTrue(first['has_more'])
        self.assertEqual(first['items'][0]['id'], ids[-1])
        encoded = json.dumps(first)
        self.assertNotIn('do-not-return', encoded)
        self.assertLess(len(encoded), 21000)
        self.assertEqual(len(first['items'][0]['detail']['title']), 160)
        late = self.seed('large_test', {}, created_at=self.now)[0]
        second = self.query(actions=['large_test'], cursor=first['next_cursor'])
        third = self.query(actions=['large_test'], cursor=second['next_cursor'])
        collected = [r['id'] for page in (first, second, third) for r in page['items']]
        self.assertEqual(collected, list(reversed(ids)))
        self.assertNotIn(late, collected)
        self.assertIsNone(third['next_cursor'])
        detail = self.api('ops/detail', 'POST', {'log_id': ids[0]})
        self.assertEqual(len(detail['detail_text']), 6000)
        self.assertEqual(detail['next_offset'], 6000)
        following = self.api('ops/detail', 'POST', {'log_id': ids[0], 'offset': 6000, 'limit': 500})
        self.assertEqual(len(following['detail_text']), 500)
        self.api('ops/query', 'POST', {'user_id': self.client.user, 'actions': ['different'], 'cursor': first['next_cursor']}, expected=400)

    def test_filters_default_range_and_input_limits(self):
        old = self.seed('login', {}, created_at=self.now-timedelta(days=10))[0]
        failed = self.seed('login', {}, result='failed', target_id=99)[0]
        self.seed('auto_login', {})
        self.seed('sync_login', {})
        self.seed('login', {'auto': True})
        current = self.query(result='failed', target_id=99, target_type='case_file', actions=['login'])
        self.assertEqual([r['id'] for r in current['items']], [failed])
        recent = self.query()
        self.assertNotIn(old, [r['id'] for r in recent['items']])
        self.assertFalse(any(r['action'].startswith(('auto_', 'sync_')) for r in recent['items']))
        earlier = self.query(start_ms=int((self.now-timedelta(days=11)).replace(tzinfo=timezone.utc).timestamp()*1000),
                             end_ms=int((self.now-timedelta(days=9)).replace(tzinfo=timezone.utc).timestamp()*1000))
        self.assertEqual([r['id'] for r in earlier['items']], [old])
        for payload, code in [({'limit': 1000}, 422), ({'cursor': 'bad'}, 400), ({'start_ms': 0}, 400),
                               ({'start_ms': 2, 'end_ms': 1}, 400), ({'end_ms': 99999999999999999999}, 400)]:
            self.api('ops/query', 'POST', payload, expected=code)
        self.api('ops/detail', 'POST', {'log_id': failed, 'offset': 10**30}, expected=422)

    def test_contribution_and_execution_summary_matches_rules(self):
        self.seed('import_case_file', {'item_imported': 3})
        self.seed('append_case_items', {'item_appended_complete': 2, 'item_appended': 4})
        self.seed('create_case_item', {'complete': True})
        self.seed('create_case_item', {'complete': False})
        self.seed('update_case_item', {'prev_complete': False, 'next_complete': True})
        self.seed('update_case_item', {'prev_complete': True, 'next_complete': True})
        self.seed('delete_case_item', {'prev_delete_complete': True})
        self.seed('delete_case_file', {'item_deleted_complete': 4})
        self.seed('update_missing_case_item', {})
        self.seed('update_exec_case', {'exec_set_id': 9, 'module': 'm', 'title': 'c', 'changed_fields': ['status'], 'status': '通过'}, count=4)
        self.seed('update_exec_case', {'result_only': True, 'changed_fields': ['status'], 'status': '通过'}, target_id=22, count=2)
        self.seed('archive_exec_set', {'actual_result_count': 10})
        result = self.api('ops/summary', 'POST', {'user_ids': [self.client.user], 'view': 'contribution'})
        self.assertEqual({r['key']: r['count'] for r in result['items']}, {'import': 3, 'add': 4, 'delete': 5, 'edit': 1})
        execution = self.api('ops/summary', 'POST', {'user_ids': [self.client.user], 'view': 'execContribution'})
        self.assertEqual({r['key']: r['count'] for r in execution['items']}, {'exec': 2, 'archive': 10})
        self.assertLess(len(json.dumps(execution)), 1000)
        activity = self.api('ops/summary', 'POST', {'user_ids': [self.client.user], 'view': 'activity'})
        self.assertNotIn('执行记录变更', [r['key'] for r in activity['items']])

    def test_admin_only_web_and_mcp_and_role_revocation(self):
        record = self.seed('login', {})[0]
        for endpoint, payload in [('query', {}), ('summary', {'user_ids':[self.client.user]}), ('detail', {'log_id': record})]:
            self.api('ops/'+endpoint, 'POST', payload, token=self.client.web, expected=403)
        self.client.tool('list_operation_logs', {}, error='PERMISSION_DENIED')
        self.client.tool('get_operation_log_detail', {'log_id':record}, error='PERMISSION_DENIED')
        self.api('users/'+str(self.client.user), 'PATCH', {'role':'admin'})
        result = self.client.tool('list_operation_logs', {'limit': 1})
        self.assertEqual(len(result['items']), 1)
        self.assertNotIn('action_options', result)
        self.client.tool('get_operation_log_summary', {'user_ids':[self.client.user]})
        self.client.tool('get_operation_log_detail', {'log_id':record,'limit':100})
        self.api('users/'+str(self.client.user), 'PATCH', {'role':'user'})
        self.client.tool('list_operation_logs', {'limit':1,'cursor':result['next_cursor']}, error='PERMISSION_DENIED')

    def test_query_indexes_and_legacy_endpoint_compatibility(self):
        self.seed('login', {'name':'legacy'})
        with sqlite3.connect(self.client.db_file) as db:
            indexes = {r[1] for r in db.execute('pragma index_list(operation_logs)')}
            self.assertTrue({'ix_ops_time_id','ix_ops_user_time_id','ix_ops_action_time_id','ix_ops_target_time_id'} <= indexes)
            plan = str(db.execute('EXPLAIN QUERY PLAN SELECT id FROM operation_logs WHERE user_id=? AND created_at>=? ORDER BY created_at DESC,id DESC LIMIT 21',
                                 (self.client.user,str(self.now-timedelta(days=1)))).fetchall())
            self.assertIn('ix_ops_user_time_id',plan)
            self.assertNotIn('TEMP B-TREE',plan)
        legacy = self.api('ops?limit=2&user_id='+str(self.client.user))
        self.assertIsInstance(legacy,list)
        self.assertLessEqual(len(legacy),2)

    def test_migration_adds_indexes_to_existing_table_without_changing_records(self):
        from sqlalchemy import create_engine, text
        from backend.migrations import apply_migrations
        engine = create_engine('sqlite:///:memory:')
        try:
            with engine.begin() as db:
                db.execute(text('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)'))
                db.execute(text("INSERT INTO schema_migrations VALUES (:v, 'fixture')"), [{'v': v} for v in range(1, 29)])
                db.execute(text('CREATE TABLE operation_logs (id INTEGER PRIMARY KEY, created_at DATETIME, user_id INTEGER, action TEXT, target_type TEXT, target_id INTEGER, detail TEXT)'))
                db.execute(text("INSERT INTO operation_logs VALUES (1, '2026-09-01', 1, 'login', 'auth', 1, 'original')"))
            apply_migrations(engine)
            apply_migrations(engine)
            with engine.connect() as db:
                indexes = {r[1] for r in db.execute(text('pragma index_list(operation_logs)'))}
                self.assertTrue({'ix_ops_time_id', 'ix_ops_user_time_id', 'ix_ops_action_time_id', 'ix_ops_target_time_id'} <= indexes)
                self.assertEqual(db.execute(text('SELECT detail FROM operation_logs')).scalar_one(), 'original')
                self.assertEqual(db.execute(text('SELECT COUNT(*) FROM schema_migrations WHERE version=29')).scalar_one(), 1)
        finally:
            engine.dispose()


if __name__ == '__main__':
    unittest.main()
