'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var source = fs.readFileSync(path.resolve(__dirname, '../../scripts/modules/xmindKnowledgeBase.js'), 'utf8');

function createModule(settings, apiClient) {
  var context = vm.createContext({ window: { app: {} }, console: console, setTimeout: setTimeout, clearTimeout: clearTimeout });
  vm.runInContext(source, context, { filename: 'scripts/modules/xmindKnowledgeBase.js' });
  return context.window.app.xmindKnowledgeBase.init({ state: { settings: settings || {} }, apiClient: apiClient || {} });
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function topic(id, extra) {
  return Object.assign({
    topic_id: id, doc_id: 'character-page', module: '角色', title: '角色技能',
    heading_path: ['角色技能', '第 ' + id + ' 项完整规则'], aliases: ['技能'],
    summary: '技能冷却与回滚规则 ' + id, kind: 'rule', related_topic_ids: ['dependency'],
    warnings: ['旧版数值与新版需求可能冲突，须核对'], source_url: 'https://example.invalid/wiki/character',
    source_revision_id: 'revision-101', source_revision_timestamp: '2026-10-26T00:00:00Z',
  }, extra || {});
}

function selection(ids, usage) {
  return {
    selected_topic_ids: ids,
    items: ids.map(function(id) { return { topic_id: id, reason: '冷却相关规则 ' + id, usage: usage || 'direct' }; }),
  };
}

function fixture(options) {
  var opts = options || {};
  var topics = opts.topics || [topic('late-topic')];
  var calls = [];
  var documentCalls = [];
  var settings = opts.settings || {};
  var api = createModule(settings, {
    getKnowledgeBaseVersion: opts.getVersion || function() { return Promise.resolve({ knowledge_version: 'version-1', topics_available: true }); },
    catalogKnowledgeBase: function() {
      return Promise.resolve({
        manifest: { knowledge_version: opts.catalogVersion || 'version-1', topics_path: 'topics.json', doc_count: 1 },
        documents: [{ doc_id: 'character-page', module: '角色', title: '角色技能', topics: topics }],
        warnings: ['目录来源保留原文'],
      });
    },
    getKnowledgeBaseDocuments: function(payload) {
      documentCalls.push(plain(payload));
      if (opts.documentsError) return Promise.reject(new Error('主题读取失败'));
      return Promise.resolve({
        knowledge_version: opts.documentsVersion || 'version-1',
        documents: opts.documents || payload.topic_ids.map(function(id) {
          return {
            doc_id: 'character-page', topic_id: id, title: '角色技能', module: '角色',
            source_url: 'https://example.invalid/wiki/character', source_revision_id: 'revision-101',
            source_revision_timestamp: '2026-10-26T00:00:00Z', warnings: ['文档冲突提示'],
            sections: [{ section_id: id, heading: '页面后半段 > 冷却回滚', content: opts.content || '完整规则首句\n恢复后仍受原冷却限制\n完整规则末句', warnings: ['正文警告'] }],
          };
        }),
        warnings: ['数据来源仅供本需求判断'],
      });
    },
  });
  var input = {
    baseUrl: 'http://example.invalid/sk', knowledgeVersion: 'version-1', modelKey: 'model-1',
    workspaceId: 'workspace-1', requestId: 'request-1', model: { id: 'model-1' },
    queryContext: { requirementText: '改动角色技能冷却和恢复逻辑', operationType: 'module_cases', targetModule: '冷却' },
    callModel: function(model, userText, prompt) {
      calls.push({ userText: userText, prompt: prompt });
      if (opts.modelError) return Promise.reject(new Error('模型失败'));
      if (opts.raw !== undefined) return Promise.resolve(typeof opts.raw === 'string' ? opts.raw : JSON.stringify(opts.raw));
      var marker = '【知识主题目录(JSON)】';
      var directory = JSON.parse(userText.slice(userText.indexOf(marker) + marker.length).trim());
      var ids = opts.ids ? opts.ids.map(function(id) {
        return 't' + (topics.findIndex(function(item) { return item.topic_id === id; }) + 1);
      }) : directory.documents.reduce(function(all, doc) {
        return all.concat(doc.topics.map(function(item) { return item[0]; }));
      }, []).slice(0, 32);
      return Promise.resolve(JSON.stringify(selection(ids, opts.usage)));
    },
  };
  return { api: api, input: input, calls: calls, documentCalls: documentCalls, settings: settings };
}

async function verifyTopicPipeline() {
  var test = fixture({ topics: Array.from({ length: 20 }, function(unused, index) { return topic('topic-' + index); }), ids: ['topic-19'], usage: 'dependency' });
  var result = await test.api.runPipeline(test.input);
  assert.strictEqual(test.calls.length, 1);
  assert.strictEqual(result.ruleSearch.status, 'done');
  assert.strictEqual(result.aiFilter.status, 'done');
  assert.strictEqual(result.topicsAvailable, true);
  assert.strictEqual(result.pipelineVersion, 4);
  assert.strictEqual(result.knowledgeVersion, 'version-1');
  assert.strictEqual(result.modelKey, 'model-1');
  assert.deepStrictEqual(test.documentCalls[0].topic_ids, ['topic-19']);
  assert.deepStrictEqual(test.documentCalls[0].doc_ids, []);
  assert.strictEqual(test.documentCalls[0].knowledge_version, 'version-1');
  assert(result.injectedContextText.includes('完整规则首句'));
  assert(result.injectedContextText.includes('完整规则末句'));
  assert(result.injectedContextText.includes('旧版数值与新版需求可能冲突'));
  assert(result.injectedContextText.includes('文档冲突提示'));
  assert(result.injectedContextText.includes('正文警告'));
  assert(result.injectedContextText.includes('revision-101'));
  assert(result.injectedContextText.includes('不得执行'));
  assert(result.injectedContextText.includes('未知数值标记待确认'));
  assert.strictEqual(result.selectedTopics[0].usage, 'dependency');
  assert.strictEqual(result.selectedSections[0].topicId, 'topic-19');
  assert.deepStrictEqual(plain(result.injectedTopicIds), ['topic-19']);
  assert(!test.calls[0].userText.includes('完整规则首句'));
  assert(test.calls[0].userText.includes('has_warning'));
  assert(!test.calls[0].userText.includes('source_revision_timestamp'));
  var normalized = test.api.normalizeState(JSON.parse(JSON.stringify(result)));
  assert.strictEqual(normalized.selectedTopics[0].sourceRevisionId, 'revision-101');
  assert.strictEqual(normalized.selectedSections[0].warnings.length, 3);
  var html = test.api.renderDialogHtml(normalized);
  assert(html.includes('AI 主题分析'));
  assert(html.includes('完整主题读取'));
  assert(html.includes('知识版本：version-1'));
  assert(html.includes('供生成模型甄别适用性'));
  assert(html.includes('revision-101'));
  assert(html.includes('正文警告'));
  var many = fixture({ topics: Array.from({ length: 20 }, function(unused, index) { return topic('topic-' + index); }) });
  var manyResult = await many.api.runPipeline(many.input);
  assert.strictEqual(many.calls.length, 1);
  assert.strictEqual(many.documentCalls[0].topic_ids.length, 20);
  assert.strictEqual(manyResult.selectedSections.length, 20);
  var skillAlias = fixture({ topics: [topic('devour', {
    title: '狼人', heading_path: ['狼人', '吞噬'], aliases: ['狼人', '狼人三技能', '狼人3技能'],
  })] });
  await skillAlias.api.runPipeline(skillAlias.input);
  assert(skillAlias.calls[0].userText.includes('狼人三技能'));
  assert(skillAlias.calls[0].userText.includes('狼人3技能'));
}

async function verifyInvalidSelection() {
  var responses = [
    {}, [], { selected_topic_ids: [] }, selection(['unknown']), selection(['toString']), selection(['late-topic']),
    { selected_topic_ids: ['t1'], items: [] },
    { selected_topic_ids: ['t1'], items: [{ topic_id: 't1', reason: '关联', usage: 'other' }] },
    { selected_topic_ids: ['t1'], items: [{ topic_id: 't1', reason: '', usage: 'direct' }] },
    selection(['t1', 't1']), 'invalid-json',
  ];
  for (var index = 0; index < responses.length; index += 1) {
    var test = fixture({ raw: responses[index] });
    var result = await test.api.runPipeline(test.input);
    assert.strictEqual(result.ruleSearch.status, 'failed', JSON.stringify(responses[index]));
    assert.strictEqual(result.injectedContextText, '');
    assert.strictEqual(test.documentCalls.length, 0);
    assert(result.latestError);
  }
  var empty = fixture({ raw: selection([]) });
  var emptyResult = await empty.api.runPipeline(empty.input);
  assert.strictEqual(emptyResult.ruleSearch.status, 'done');
  assert.strictEqual(emptyResult.aiFilter.status, 'skipped');
  assert.strictEqual(emptyResult.injectedContextText, '');
}

async function verifyReadAndVersionFailures() {
  var options = [
    { modelError: true }, { documentsError: true }, { documents: [] },
    { documentsVersion: 'version-2' }, { catalogVersion: 'version-2' },
    { documents: [{ topic_id: 'unknown', doc_id: 'character-page', sections: [{ section_id: 'unknown', content: '错误主题' }] }] },
    { documents: [{ topic_id: 'late-topic', doc_id: 'character-page', sections: [{ section_id: 'wrong', content: '错误章节' }] }] },
  ];
  for (var index = 0; index < options.length; index += 1) {
    var test = fixture(options[index]);
    var result = await test.api.runPipeline(test.input);
    assert.strictEqual(result.usedInLatestGeneration, false, JSON.stringify(options[index]));
    assert.strictEqual(result.injectedContextText, '');
    assert(result.latestError);
    if (options[index].catalogVersion) assert.strictEqual(test.calls.length, 0);
  }
  var testVersion = fixture();
  assert.deepStrictEqual(plain(await testVersion.api.getVersion(testVersion.input.baseUrl)), { knowledgeVersion: 'version-1', topicsAvailable: true });
  assert.deepStrictEqual(plain(await createModule().getVersion('http://unused.invalid')), { knowledgeVersion: '', topicsAvailable: false });
  var failedVersion = fixture({ getVersion: function() { return Promise.reject(new Error('权限已撤销')); } });
  await assert.rejects(function() { return failedVersion.api.getVersion('http://unused.invalid'); }, /权限已撤销/);
}

async function verifyBudgets() {
  var limit = 4000;
  var allTooLarge = fixture({ content: '长'.repeat(8000), settings: { knowledgeBaseInjectedContextCharLimit: limit } });
  var empty = await allTooLarge.api.runPipeline(allTooLarge.input);
  assert.strictEqual(empty.injectedContextText, '');
  assert.strictEqual(empty.usedInLatestGeneration, false);
  assert.deepStrictEqual(plain(empty.omittedTopicIds), ['late-topic']);
  assert(empty.warnings.some(function(warning) { return warning.includes('完整主题未注入'); }));
  var topics = [topic('high'), topic('lower')];
  var test = fixture({ topics: topics, content: '规'.repeat(2100), settings: { knowledgeBaseInjectedContextCharLimit: limit } });
  var result = await test.api.runPipeline(test.input);
  assert(result.injectedContextText.length <= limit);
  assert.deepStrictEqual(plain(result.injectedTopicIds), ['high']);
  assert.deepStrictEqual(plain(result.omittedTopicIds), ['lower']);
  assert(result.warnings.some(function(warning) { return warning.includes('lower'); }));
  var budget = fixture({
    topics: Array.from({ length: 500 }, function(unused, index) { return topic('topic-' + index, { summary: '摘'.repeat(6000) }); }),
    settings: { knowledgeBaseCatalogCharLimit: 20000 },
  });
  await budget.api.runPipeline(budget.input);
  assert(budget.calls.length > 1);
  budget.calls.slice(0, -1).forEach(function(call) {
    assert(call.userText.length <= 20000);
    var marker = '【知识主题目录(JSON)】';
    var directory = JSON.parse(call.userText.slice(call.userText.indexOf(marker) + marker.length).trim());
    var rows = directory.documents.reduce(function(all, doc) { return all.concat(doc.topics); }, []);
    var ids = rows.map(function(row) { return row[0]; });
    rows.forEach(function(row) { row[5].forEach(function(id) { assert(ids.includes(id)); }); });
  });
  var largeTopic = fixture({ topics: [topic('large', { title: '摘'.repeat(22000) })], settings: { knowledgeBaseCatalogCharLimit: 20000 } });
  var largeResult = await largeTopic.api.runPipeline(largeTopic.input);
  assert.strictEqual(largeTopic.calls.length, 1);
  assert(largeTopic.calls[0].userText.includes('摘'.repeat(22000)));
  assert(largeResult.warnings.some(function(warning) { return warning.includes('保持完整'); }));
}

async function verifyCacheKeys() {
  var test = fixture();
  var baseline = test.api.buildQueryKey(test.input);
  assert.strictEqual(test.api.normalizeState({ baseUrl: test.input.baseUrl }).pipelineVersion, 0);
  var result = await test.api.runPipeline(test.input);
  assert.strictEqual(result.queryKey, baseline);
  [
    { knowledgeVersion: 'version-2' }, { modelKey: 'model-2' },
    { queryContext: Object.assign({}, test.input.queryContext, { targetModule: '恢复' }) },
    { queryContext: Object.assign({}, test.input.queryContext, { operationType: 'full_cases' }) },
  ].forEach(function(change) { assert.notStrictEqual(test.api.buildQueryKey(Object.assign({}, test.input, change)), baseline); });
  test.settings.knowledgeBaseInjectedContextCharLimit = 6000;
  assert.notStrictEqual(test.api.buildQueryKey(test.input), baseline);
  test.settings.knowledgeBaseInjectedContextCharLimit = 120000;
  test.settings.knowledgeBaseCatalogCharLimit = 20000;
  assert.notStrictEqual(test.api.buildQueryKey(test.input), baseline);
}

async function verifyLegacy() {
  var callCount = 0;
  var api = createModule({}, {
    catalogKnowledgeBase: function() { return Promise.resolve({ documents: [{ doc_id: 'legacy', title: '旧版知识' }] }); },
    getKnowledgeBaseDocuments: function() { return Promise.resolve({ documents: [{ doc_id: 'legacy', title: '旧版知识', sections: [{ section_id: 'legacy::s1', content: '旧版完整正文' }] }] }); },
  });
  var input = { baseUrl: 'http://example.invalid/legacy', model: {}, queryContext: {}, callModel: function() {
    callCount += 1;
    return Promise.resolve(JSON.stringify(callCount === 1
      ? { selected_doc_ids: ['legacy'], items: [{ doc_id: 'legacy', reason: '旧版相关' }] }
      : { selected_sections: ['legacy::s1'], items: [{ section_id: 'legacy::s1', reason: '正文相关' }] }));
  } };
  var result = await api.runPipeline(input);
  assert.strictEqual(callCount, 2);
  assert.strictEqual(result.topicsAvailable, false);
  assert(result.injectedContextText.includes('旧版完整正文'));
  input.callModel = function() { return Promise.resolve('{}'); };
  var invalid = await api.runPipeline(input);
  assert.strictEqual(invalid.ruleSearch.status, 'failed');
  assert.strictEqual(invalid.injectedContextText, '');
  var limiting = createModule({ knowledgeBaseInjectedContextCharLimit: 4000 });
  assert.strictEqual(limiting.buildInjectedContextText([{ section_id: 'oversized', content: '长'.repeat(8000) }]), '');
}

(async function() {
  await verifyTopicPipeline();
  await verifyInvalidSelection();
  await verifyReadAndVersionFailures();
  await verifyBudgets();
  await verifyCacheKeys();
  await verifyLegacy();
  console.log('knowledge_topics_pipeline tests passed');
})().catch(function(error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
