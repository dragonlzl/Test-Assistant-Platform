"""Reuse MCP/HTTP contract tests; isolated temporary DB and JS/server rule parity."""
import concurrent.futures
import copy
import json
import sqlite3
import subprocess
import unittest
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import test_mcp_service as harness


class ExecutionReuseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        harness.McpServiceTest.setUpClass()
        cls.project = harness.McpServiceTest().api('projects', 'POST', {'name': '元气骑士'}, expected=201)['id']

    @classmethod
    def tearDownClass(cls):
        harness.McpServiceTest.tearDownClass()

    def setUp(self):
        self.c = harness.McpServiceTest()
        self.c.setUp()
        self.c.project = self.project
        self.c.api('users/assign-projects', 'POST', {'user_id': self.c.user, 'project_ids': [self.project]})
        self.api, self.tool = self.c.api, self.c.tool

    def fixture(self, weapon=False, supported=True):
        modules = ['皮肤碎片', '皮肤操作', '联机同步'] if weapon else ['付费皮肤', '小鱼干皮肤', '通用']
        if not supported:
            modules = ['通用', '通用', '通用']
        file = self.api('case-files/import', 'POST', {
            'project_id': self.project, 'file_name': 'reuse-' + uuid4().hex, 'reuse_enabled': True,
            'items': [{'module': module, 'title': '获取途径' if weapon else '检查' + str(i),
                       'precondition': '已有皮肤', 'steps': '通过扭蛋查看' if weapon else '解锁皮肤',
                       'expected': '显示对应内容', 'priority': 'P1'} for i, module in enumerate(modules)]}, token=self.c.web, expected=201)
        parent = self.tool('create_execution_set', self.c.write_args(case_file_id=file['id']))['execution_set']
        self.exec_id = parent['id']
        self.file_id = file['id']
        return self.context()

    def context(self):
        return self.tool('get_execution_reuse_context', {'project_id': self.project, 'exec_set_id': self.exec_id})

    def cases(self):
        return self.tool('get_execution_cases', {'project_id': self.project, 'exec_set_id': self.exec_id})['items']

    def write(self, context=None, **fields):
        return self.c.write_args(exec_set_id=self.exec_id, expected_revision=(context or self.context())['revision'], **fields)

    def item(self, name, value='paid', profile='character-skin-unlock-v1'):
        return {'text': name, 'applicability': {'profile': profile, 'value': value}}

    def test_add_batch_configure_quick_execute_and_manual_result(self):
        context = self.fixture()
        original = self.api('case-files/' + str(self.file_id) + '/items', token=self.c.web)
        self.assertEqual(context['profile']['key'], 'character-skin-unlock-v1')
        self.assertEqual(context['case_count'], 3)
        request = self.write(context, items=[self.item('新皮肤A'), self.item('新皮肤B', 'fish')], quick_execute=True)
        added = self.tool('add_execution_reuse_presets', request)
        self.assertEqual(added, self.tool('add_execution_reuse_presets', request))
        self.assertEqual(added['summary'], {'added_presets': 2, 'added_details': 6, 'updated_cases': 3,
                                          'auto_set': 2, 'auto_cleared': 0, 'conflicts': 0})
        self.assertNotEqual(added['revision'], context['revision'])
        self.assertNotIn('cases', added)
        rows = self.cases()
        self.assertEqual([[d['status'] for d in row['reuse_details']] for row in rows],
                         [['未执行', '不适用'], ['不适用', '未执行'], ['未执行', '未执行']])
        self.assertEqual(len({d['id'] for row in rows for d in row['reuse_details']}), 6)
        self.assertEqual(rows[0]['ai_operations'], ['child_added', 'executed'])
        self.assertEqual(rows[2]['ai_operations'], ['child_added'])
        self.assertTrue(all(row['status'] == '未执行' for row in rows))

        # Real result can be recorded using the generated child ID, with the existing tool.
        manual = self.tool('record_execution_result', self.c.write_args(case_id=rows[0]['id'],
            expected_updated_at=rows[0]['updated_at'], reuse_detail_id=rows[0]['reuse_details'][0]['id'],
            status='通过', reuse_note='人工已验证'))
        self.assertEqual(manual['status'], '通过')
        self.tool('quick_execute_reuse', self.write(added), error='CONFLICT')
        current = self.context()
        changed = self.tool('update_execution_reuse_presets', self.write(current,
            items=[{'preset_id': added['affected_preset_ids'][0], 'applicability': self.item('A', 'fish')['applicability']}], quick_execute=True))
        self.assertEqual(changed['summary']['conflicts'], 1)
        self.assertEqual(changed['summary']['auto_cleared'], 1)
        after = self.cases()
        self.assertEqual(after[0]['reuse_details'][0]['status'], '通过')
        self.assertEqual(after[0]['reuse_details'][0]['note'], '人工已验证')
        self.assertEqual(after[1]['reuse_details'][0]['status'], '未执行')
        self.assertNotIn('statusOrigin', after[1]['reuse_details'][0])
        self.assertEqual(after[0]['reuse_details'][1], rows[0]['reuse_details'][1])
        # No structural library edits, history or auto-binding through generic PATCH.
        new_library = self.api('case-files/' + str(self.file_id) + '/items', token=self.c.web)
        for before, item in zip(original, new_library):
            self.assertEqual(item['ai_operations'], next(row['ai_operations'] for row in after if row['case_item_id'] == item['id']))
            for key in ('module', 'title', 'precondition', 'steps', 'expected', 'remark'):
                self.assertEqual(item[key], before[key])
        with sqlite3.connect(self.c.db_file) as db:
            self.assertGreater(db.execute('SELECT COUNT(*) FROM exec_case_history WHERE exec_case_id=?', (rows[0]['id'],)).fetchone()[0], 0)

    def test_child_added_is_distinct_and_survives_human_edits_and_later_ai_changes(self):
        self.fixture()
        request = self.write(items=[{'text': '新子项'}])
        result = self.tool('add_execution_reuse_presets', request)
        self.assertEqual(result, self.tool('add_execution_reuse_presets', request))
        rows = self.cases()
        self.assertTrue(all(row['ai_operations'] == ['child_added'] for row in rows))
        library = self.api('case-files/' + str(self.file_id) + '/items', token=self.c.web)
        self.assertTrue(all(row['ai_operations'] == ['child_added'] for row in library))
        first = rows[0]
        human = self.api('exec/cases/' + str(first['id']), 'PATCH', {'remark': '人工备注'}, token=self.c.web)
        self.assertEqual(human['ai_operations'], ['child_added'])
        item = self.api('case-files/items/' + str(first['case_item_id']), 'PATCH',
                        {'title': '人工调整标题'}, token=self.c.web)
        self.assertEqual(item['ai_operations'], ['child_added'])
        updated = self.tool('update_case_item', self.c.write_args(case_item_id=item['id'],
                            expected_updated_at=item['updated_at'], changes={'title': 'AI调整标题'}))
        self.assertEqual(updated['ai_operations'], ['child_added', 'modified'])
        # A second addition neither clears earlier flags nor duplicates the child-added flag.
        self.tool('add_execution_reuse_presets', self.write(items=[{'text': '另一子项'}]))
        after = self.cases()
        self.assertEqual(after[0]['ai_operations'], ['child_added', 'modified'])
        self.assertTrue(all(row['ai_operations'] == ['child_added'] for row in after[1:]))
        self.assertTrue(all(len(row['reuse_details']) == 2 for row in after))

    def test_quick_scope_clear_and_removed_preserves_other_details(self):
        self.fixture()
        added = self.tool('add_execution_reuse_presets', self.write(items=[self.item('A'), self.item('B', 'fish')]))
        a, b = added['affected_preset_ids']
        quick = self.tool('quick_execute_reuse', self.write(added, preset_ids=[a]))
        self.assertEqual(quick['summary']['auto_set'], 1)
        before = self.cases()
        self.assertEqual(before[0]['reuse_details'][1]['status'], '未执行')
        cleared = self.tool('update_execution_reuse_presets', self.write(quick,
            items=[{'preset_id': a, 'applicability': None}], quick_execute=True))
        self.assertEqual(cleared['summary']['auto_cleared'], 1)
        # A removed child must never be recreated, restored or modified by quick execution.
        rows = self.cases()
        details = copy.deepcopy(rows[0]['reuse_details'])
        details[1].update(removed=True, status='通过', note='保留')
        self.api('exec/cases/' + str(rows[0]['id']), 'PATCH', {'reuse_details': details}, token=self.c.web)
        result = self.tool('quick_execute_reuse', self.write(preset_ids=[b]))
        self.assertEqual(result['summary']['auto_set'], 0)
        self.assertEqual(self.cases()[0]['reuse_details'][1], details[1])
        self.assertEqual(result['revision'], self.context()['revision'])

    def test_http_contract_weapon_rules_and_validation(self):
        context = self.fixture(weapon=True)
        path = 'exec/sets/' + str(self.exec_id) + '/reuse'
        self.assertEqual(self.api(path, token=self.c.web)['revision'], context['revision'])
        self.assertEqual(context['profile']['key'], 'weapon-evolution-skin-acquisition-v1')
        request = {'expected_revision': context['revision'], 'items': [self.item('武器皮肤', 'mail', context['profile']['key'])]}
        created = self.api(path + '/presets', 'POST', request, token=self.c.web)
        self.api(path + '/presets', 'POST', request, token=self.c.web, expected=409)
        quick = self.api(path + '/quick-execute', 'POST', {'expected_revision': created['revision']}, token=self.c.web)
        self.assertEqual(quick['summary']['auto_set'], 1)
        rows = self.cases()
        self.assertEqual(rows[0]['status'], '不适用')
        self.assertEqual(rows[0]['ai_operations'], [])
        current = self.api(path + '/presets', 'PATCH', {'expected_revision': quick['revision'],
            'items': [{'preset_id': created['affected_preset_ids'][0], 'applicability': None}], 'quick_execute': True}, token=self.c.web)
        self.assertEqual(current['summary']['auto_cleared'], 1)
        invalid = self.write(items=[self.item('Wrong', 'paid')])
        self.tool('add_execution_reuse_presets', invalid, error='INVALID_ARGUMENT')
        self.assertEqual(self.context()['revision'], current['revision'])
        self.tool('add_execution_reuse_presets', self.write(items=[{'text': '   '}]), error='INVALID_ARGUMENT')
        self.tool('add_execution_reuse_presets', self.write(items=[{'text': 'x'}] * 51), error='INVALID_ARGUMENT')
        self.tool('update_execution_reuse_presets', self.write(items=[{'preset_id': 'missing', 'applicability': None}]), error='NOT_FOUND')
        self.tool('quick_execute_reuse', self.write(preset_ids=['foreign']), error='INVALID_ARGUMENT')

    def test_permissions_readonly_archived_and_revoked_replay(self):
        self.fixture()
        args = self.write(items=[{'text': 'A'}])
        readonly = self.api('mcp-tokens', 'POST', {'name': 'readonly', 'read_only': True}, token=self.c.web, expected=201)['token']
        catalog = [tool['name'] for tool in self.c.rpc('tools/list', token=readonly)[1]['result']['tools']]
        self.assertIn('get_execution_reuse_context', catalog)
        for name in ('add_execution_reuse_presets', 'update_execution_reuse_presets', 'quick_execute_reuse'):
            self.assertNotIn(name, catalog)
        self.tool('add_execution_reuse_presets', args, token=readonly, error='PERMISSION_DENIED')
        self.tool('get_execution_reuse_context', {'project_id': self.c.other_project, 'exec_set_id': self.exec_id}, error='PERMISSION_DENIED')
        admin_set = self.api('exec/sets/from-case-file', 'POST', {'case_file_id': self.file_id})
        self.tool('add_execution_reuse_presets', {**args, 'exec_set_id': admin_set['id']}, error='PERMISSION_DENIED')
        self.api('exec/sets/' + str(admin_set['id']) + '/reuse/presets', 'POST',
                 {'expected_revision': args['expected_revision'], 'items': [{'text': 'x'}]}, token=self.c.web, expected=403)
        self.tool('add_execution_reuse_presets', args)
        self.api('users/assign-projects', 'POST', {'user_id': self.c.user, 'project_ids': []})
        self.tool('add_execution_reuse_presets', args, error='PERMISSION_DENIED')
        self.api('users/assign-projects', 'POST', {'user_id': self.c.user, 'project_ids': [self.project]})
        current = self.context()
        self.api('exec/sets/' + str(self.exec_id) + '/archive', 'POST', {'reason': '测试'}, token=self.c.web)
        self.tool('add_execution_reuse_presets', self.write(current, items=[{'text': 'B'}]), error='INVALID_ARGUMENT')
        self.assertFalse(self.context()['can_write'])

    def test_concurrent_retries_conflicts_and_receipt_rollback(self):
        self.fixture()
        args = self.write(items=[self.item('Concurrent')], quick_execute=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: self.tool('add_execution_reuse_presets', args), range(4)))
        self.assertTrue(all(result == results[0] for result in results))
        self.assertTrue(all(len(row['reuse_details']) == 1 for row in self.cases()))
        self.tool('add_execution_reuse_presets', {**args, 'idempotency_key': str(uuid4())}, error='CONFLICT')
        self.tool('add_execution_reuse_presets', self.write(items=[{'text': 'Concurrent'}]), error='CONFLICT')
        before_context, before_rows = self.context(), self.cases()
        with sqlite3.connect(self.c.db_file) as db:
            db.execute("CREATE TRIGGER fail_reuse_receipt BEFORE INSERT ON mcp_write_receipts BEGIN SELECT RAISE(ABORT, 'rollback'); END")
        try:
            self.tool('add_execution_reuse_presets', self.write(items=[self.item('Rollback')], quick_execute=True), error='CONFLICT')
        finally:
            with sqlite3.connect(self.c.db_file) as db:
                db.execute('DROP TRIGGER fail_reuse_receipt')
        self.assertEqual(self.context(), before_context)
        self.assertEqual(self.cases(), before_rows)

    def test_unsupported_quick_rolls_back_and_nonreuse_rejected(self):
        self.fixture(supported=False)
        self.assertIsNone(self.context()['profile'])
        self.tool('add_execution_reuse_presets', self.write(items=[self.item('bad')]), error='INVALID_ARGUMENT')
        self.tool('add_execution_reuse_presets', self.write(items=[{'text': 'bad'}], quick_execute=True), error='INVALID_ARGUMENT')
        self.assertEqual(self.context()['presets'], [])
        self.tool('add_execution_reuse_presets', self.write(items=[{'text': '普通子项'}]))
        self.api('exec/sets/' + str(self.exec_id), 'PATCH', {'reuse_enabled': False}, token=self.c.web)
        self.tool('add_execution_reuse_presets', self.write(items=[{'text': 'bad'}]), error='INVALID_ARGUMENT')

    def test_invalid_batch_limits_and_http_database_failure_are_atomic(self):
        context = self.fixture()
        self.tool('add_execution_reuse_presets', self.write(context, items=[self.item('valid'), self.item('invalid', 'unknown')]),
                  error='INVALID_ARGUMENT')
        self.tool('add_execution_reuse_presets', self.write(context, items=[{'text': 'same'}, {'text': 'same'}]), error='CONFLICT')
        self.assertEqual(self.context(), context)
        rows = self.cases()
        # A failure on a later case must roll back earlier child/history writes and the preset.
        with sqlite3.connect(self.c.db_file) as db:
            db.execute('CREATE TRIGGER fail_reuse_case BEFORE UPDATE ON exec_cases WHEN NEW.id=' + str(rows[1]['id'])
                       + " BEGIN SELECT RAISE(ABORT, 'fixture failure'); END")
        try:
            self.api('exec/sets/' + str(self.exec_id) + '/reuse/presets', 'POST', {
                'expected_revision': context['revision'], 'items': [self.item('Fail')]}, token=self.c.web, expected=409)
        finally:
            with sqlite3.connect(self.c.db_file) as db:
                db.execute('DROP TRIGGER fail_reuse_case')
        self.assertEqual(self.context(), context)
        self.assertEqual(self.cases(), rows)
        # Limit checks reject the whole batch before materializing any new children.
        with sqlite3.connect(self.c.db_file) as db:
            db.execute('UPDATE exec_sets SET reuse_presets=? WHERE id=?',
                       (json.dumps([{'id': 'p'+str(i), 'text': str(i)} for i in range(99)]), self.exec_id))
        at_limit = self.context()
        self.tool('add_execution_reuse_presets', self.write(at_limit, items=[{'text': 'A'}, {'text': 'B'}]), error='INVALID_ARGUMENT')
        self.assertEqual(self.context(), at_limit)
        self.assertEqual(self.cases(), rows)

    def test_rules_match_browser_core(self):
        from backend.reuse_applicability import PROFILES, detect_profile, apply_rules
        root = Path(__file__).resolve().parents[2]
        profiles = list(PROFILES)
        for profile_key in profiles:
            options = PROFILES[profile_key]['options']
            presets = [{'id': 'p' + str(i), 'text': str(i), 'applicability': {'profile': profile_key, 'value': option['value']}}
                       for i, option in enumerate(options)]
            presets.append({'id': 'unset'})
            cases = [{'module': '付费皮肤', 'title': '解锁', 'steps': '查看'},
                     {'module': '小鱼干皮肤', 'title': '解锁', 'steps': '查看'},
                     {'module': '皮肤碎片', 'title': '获取途径', 'steps': '扭蛋、小鱼干商店'},
                     {'module': '通用', 'title': '外观', 'steps': '查看'}]
            for row in cases:
                row['reuseDetails'] = [dict(id=str(i), presetId=p['id'], status=status, **extra)
                    for i, p in enumerate(presets) for status, extra in [
                        ('未执行', {}), ('pending', {}), ('变更重跑', {}), ('通过', {'note': 'manual'}), ('失败', {}),
                        ('不适用', {}), ('不适用', {'statusOrigin': 'auto-applicability', 'statusOriginProfile': profile_key}),
                        ('不适用', {'statusOrigin': 'auto-applicability'}), ('未执行', {'removed': True})]]
            script = """const fs=require('fs'),vm=require('vm'); const ctx={window:{app:{}}}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('scripts/core/reuseApplicabilityCore.js','utf8'),ctx);
const a=JSON.parse(fs.readFileSync(0,'utf8')),c=ctx.window.app.reuseApplicabilityCore;
console.log(JSON.stringify({profile:c.detectProfile({projectName:'元气骑士',cases:a.cases,presets:a.presets}),plan:c.planApplication(a)}));"""
            expected = json.loads(subprocess.check_output(['node', '-e', script], cwd=root,
                input=json.dumps({'profileKey': profile_key, 'presets': presets, 'cases': cases}).encode()))
            self.assertEqual(detect_profile('元气骑士', [r['module'] for r in cases], presets), expected['profile'])
            counts = {'auto_set': 0, 'auto_cleared': 0, 'conflicts': 0}
            for row, js_row in zip(cases, expected['plan']['cases']):
                details, stats = apply_rules(row['reuseDetails'], {p['id']: p for p in presets}, profile_key, SimpleNamespace(**row))
                self.assertEqual(details, js_row['reuseDetails'])
                for k, v in stats.items():
                    counts[k] += v
            for key, js_key in [('auto_set', 'autoSet'), ('auto_cleared', 'autoCleared'), ('conflicts', 'conflicts')]:
                self.assertEqual(counts[key], expected['plan']['summary'][js_key])


if __name__ == '__main__':
    unittest.main()
