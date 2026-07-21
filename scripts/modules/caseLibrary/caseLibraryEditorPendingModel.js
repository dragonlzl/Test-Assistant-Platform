(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.editorPendingModel = api;
  }
})(function() {
  function text(value) {
    return value === null || value === undefined ? '' : String(value);
  }

  function normalize(value, normalizeText) {
    return typeof normalizeText === 'function' ? normalizeText(value) : text(value).trim();
  }

  function buildItemPayload(item, normalizeText) {
    var source = item && typeof item === 'object' ? item : {};
    var priority = normalize(source.priority, normalizeText);
    var precondition = normalize(source.precondition, normalizeText);
    var steps = normalize(source.steps, normalizeText);
    var remark = normalize(source.remark, normalizeText);
    return {
      module: normalize(source.module, normalizeText),
      title: normalize(source.title, normalizeText),
      expected: normalize(source.expected, normalizeText),
      priority: priority || null,
      precondition: precondition || null,
      steps: steps || null,
      remark: remark || null,
    };
  }

  function buildBatchItemPayload(item, sequence, options) {
    var source = item && typeof item === 'object' ? item : {};
    var opts = options && typeof options === 'object' ? options : {};
    var normalizeText = opts.normalizeText;
    var expectedRaw = text(source.expected);
    var expectedNormalized = normalize(expectedRaw, normalizeText);
    var expected = expectedNormalized || expectedRaw;
    if (!expected && typeof opts.buildInvisibleMarker === 'function') {
      expected = opts.buildInvisibleMarker(text(source.__localId) + '|' + Number(sequence || 0));
    }
    var priority = normalize(source.priority, normalizeText);
    return {
      module: normalize(source.module, normalizeText),
      title: normalize(source.title, normalizeText),
      expected: expected,
      priority: priority || null,
      precondition: normalize(source.precondition, normalizeText) || '',
      steps: normalize(source.steps, normalizeText) || '',
      remark: normalize(source.remark, normalizeText) || null,
    };
  }

  function validatePayload(payload) {
    if (!payload) return '内容不能为空';
    if (!payload.module) return '模块不能为空';
    if (!payload.title) return '用例标题不能为空';
    if (!payload.expected) return '预期结果不能为空';
    return '';
  }

  function parseBatchAddCount(raw) {
    var value = text(raw).trim();
    if (!value) return { ok: false, reason: '请输入批量新增数量（1-10）' };
    if (!/^\d+$/.test(value)) return { ok: false, reason: '数量仅支持正整数（1-10）' };
    var count = Number(value);
    if (!isFinite(count)) return { ok: false, reason: '数量格式不正确' };
    count = Math.floor(count);
    if (count < 1) return { ok: false, reason: '数量最小为 1' };
    if (count > 10) return { ok: false, reason: '数量最大为 10' };
    return { ok: true, value: count };
  }

  function collectSelectedIndexes(selection, itemCount) {
    var values = selection && typeof selection.forEach === 'function' ? Array.from(selection) : [];
    var length = Math.max(0, Number(itemCount) || 0);
    var seen = {};
    var indexes = [];
    values.forEach(function(value) {
      var index = Number(value);
      if (!isFinite(index) || index < 0 || index >= length) return;
      index = Math.floor(index);
      var key = String(index);
      if (seen[key]) return;
      seen[key] = true;
      indexes.push(index);
    });
    return indexes;
  }

  function collectDeleteEntries(removed) {
    var seen = {};
    var entries = [];
    (Array.isArray(removed) ? removed : []).forEach(function(entry) {
      var item = entry && entry.item ? entry.item : null;
      if (!item || !item.id) return;
      var key = String(item.id);
      if (seen[key]) return;
      seen[key] = true;
      entries.push({ id: item.id, index: entry.index, item: item });
    });
    return entries;
  }

  function collectInsertEntries(items, itemKeys) {
    var list = Array.isArray(items) ? items : [];
    var entries = [];
    (Array.isArray(itemKeys) ? itemKeys : []).forEach(function(key) {
      var index = list.findIndex(function(item) {
        return item && item.__localId === key;
      });
      if (index < 0 || !list[index]) return;
      entries.push({ index: index, item: list[index], key: key });
    });
    return entries;
  }

  function sortedRestoreEntries(removed) {
    return (Array.isArray(removed) ? removed : [])
      .filter(function(entry) { return Boolean(entry && entry.item); })
      .slice()
      .sort(function(a, b) { return Number(a.index) - Number(b.index); });
  }

  function insertedIndexesDescending(items, itemKeys) {
    var list = Array.isArray(items) ? items : [];
    var indexes = [];
    (Array.isArray(itemKeys) ? itemKeys : []).forEach(function(key) {
      var index = list.findIndex(function(item) {
        return item && item.__localId === key;
      });
      if (index !== -1) indexes.push(index);
    });
    return indexes.sort(function(a, b) { return b - a; });
  }

  function settle(promise) {
    return Promise.resolve(promise).then(
      function(value) { return { status: 'fulfilled', value: value }; },
      function(error) { return { status: 'rejected', reason: error }; }
    );
  }

  return {
    buildItemPayload: buildItemPayload,
    buildBatchItemPayload: buildBatchItemPayload,
    validatePayload: validatePayload,
    parseBatchAddCount: parseBatchAddCount,
    collectSelectedIndexes: collectSelectedIndexes,
    collectDeleteEntries: collectDeleteEntries,
    collectInsertEntries: collectInsertEntries,
    sortedRestoreEntries: sortedRestoreEntries,
    insertedIndexesDescending: insertedIndexesDescending,
    settle: settle,
  };
});
