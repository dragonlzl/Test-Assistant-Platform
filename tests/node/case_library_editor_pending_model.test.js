const assert = require('assert');
const model = require('../../scripts/modules/caseLibrary/caseLibraryEditorPendingModel.js');

function normalize(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function testPayloadContracts() {
  assert.deepStrictEqual(model.buildItemPayload({
    module: ' 登录 ',
    title: ' 正常登录 ',
    expected: ' 成功 ',
    priority: '',
    precondition: ' ',
    steps: ' 输入账号 ',
    remark: '',
  }, normalize), {
    module: '登录',
    title: '正常登录',
    expected: '成功',
    priority: null,
    precondition: null,
    steps: '输入账号',
    remark: null,
  });
  assert.strictEqual(model.validatePayload(null), '内容不能为空');
  assert.strictEqual(model.validatePayload({ module: '', title: 'A', expected: 'B' }), '模块不能为空');
  assert.strictEqual(model.validatePayload({ module: 'M', title: '', expected: 'B' }), '用例标题不能为空');
  assert.strictEqual(model.validatePayload({ module: 'M', title: 'A', expected: '' }), '预期结果不能为空');
  assert.strictEqual(model.validatePayload({ module: 'M', title: 'A', expected: 'B' }), '');

  var batchPayload = model.buildBatchItemPayload({
    __localId: 'local-1',
    module: ' ',
    title: ' ',
    expected: '',
  }, 2, {
    normalizeText: normalize,
    buildInvisibleMarker: function(seed) { return 'marker:' + seed; },
  });
  assert.strictEqual(batchPayload.expected, 'marker:local-1|2');
}

function testBatchCountAndIndexContracts() {
  assert.deepStrictEqual(model.parseBatchAddCount('3'), { ok: true, value: 3 });
  assert.strictEqual(model.parseBatchAddCount('').reason, '请输入批量新增数量（1-10）');
  assert.strictEqual(model.parseBatchAddCount('1.5').reason, '数量仅支持正整数（1-10）');
  assert.strictEqual(model.parseBatchAddCount('11').reason, '数量最大为 10');
  assert.deepStrictEqual(model.collectSelectedIndexes(new Set([2, '1', 2, -1, 9]), 4), [2, 1]);

  var first = { id: 1 };
  var second = { id: 2 };
  assert.deepStrictEqual(model.collectDeleteEntries([
    { index: 2, item: second },
    { index: 0, item: first },
    { index: 1, item: first },
    { index: 3, item: { title: 'local' } },
  ]), [
    { id: 2, index: 2, item: second },
    { id: 1, index: 0, item: first },
  ]);

  var items = [{ __localId: 'a' }, { id: 9 }, { __localId: 'b' }];
  assert.deepStrictEqual(model.collectInsertEntries(items, ['b', 'missing', 'a']).map(function(entry) {
    return [entry.index, entry.key];
  }), [[2, 'b'], [0, 'a']]);
  assert.deepStrictEqual(model.insertedIndexesDescending(items, ['a', 'b']), [2, 0]);
}

async function testSettleContract() {
  assert.deepStrictEqual(await model.settle(Promise.resolve(3)), { status: 'fulfilled', value: 3 });
  var rejected = await model.settle(Promise.reject(new Error('failed')));
  assert.strictEqual(rejected.status, 'rejected');
  assert.strictEqual(rejected.reason.message, 'failed');
}

async function run() {
  testPayloadContracts();
  testBatchCountAndIndexContracts();
  await testSettleContract();
  console.log('case library editor pending model tests passed');
}

run().catch(function(error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
