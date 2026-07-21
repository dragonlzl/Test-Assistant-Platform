(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var historyModel = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.historyModel
    : null;
  if (typeof module !== 'undefined' && module.exports) {
    historyModel = historyModel || require('./caseLibraryHistoryModel.js');
  }
  var api = factory(historyModel);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.historyDetailTableAdapter = api;
  }
})(function(historyModel) {
  var DATA_COLUMNS = [
    ['module', '模块', 180],
    ['title', '用例标题', 220],
    ['precondition', '前提条件', 240],
    ['steps', '操作步骤', 280],
    ['expected', '预期结果', 240],
  ];

  function text(value, fallback) {
    var normalized = historyModel.normalizeText(value);
    return normalized || (fallback === undefined ? '--' : fallback);
  }

  function dataColumn(definition) {
    var key = definition[0];
    return {
      key: key,
      title: definition[1],
      width: definition[2],
      minWidth: 100,
      editable: false,
      value: function(record) {
        return record && record.cells ? record.cells[key] : '';
      },
      tone: function(value, record) {
        return record && record.changedFieldMap && record.changedFieldMap[key] === true
          ? 'changed'
          : '';
      },
      tooltip: true,
      multiline: function(value) { return String(value || '').indexOf('\n') !== -1; },
    };
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var formatTime = typeof opts.formatTime === 'function'
      ? opts.formatTime
      : function(value) { return text(value); };
    var columns = [
      {
        key: 'kind',
        title: '类型',
        width: 90,
        minWidth: 90,
        editable: false,
        value: function(record) { return text(record && record.kindLabel); },
        tone: function(value, record) { return record && record.kindTone ? record.kindTone : 'muted'; },
        tooltip: true,
      },
      {
        key: 'changedAt',
        title: '修改时间',
        width: 160,
        editable: false,
        value: function(record) { return text(formatTime(record && record.changedAt)); },
        tooltip: true,
      },
      {
        key: 'operator',
        title: '操作人员',
        width: 120,
        editable: false,
        value: function(record) { return text(record && record.operator); },
        tooltip: true,
      },
      {
        key: 'fileName',
        title: '用例名',
        width: 220,
        editable: false,
        value: function(record) { return text(record && record.fileNameClean); },
        tooltip: true,
      },
    ].concat(DATA_COLUMNS.map(dataColumn));
    return {
      id: text(opts.id, '') || 'case-library-history-detail',
      caption: text(opts.caption, '') || '用例改动历史详情',
      rowKeyPolicy: 'strict',
      strictRowKey: true,
      rowKey: function(record) { return record ? record.rowKey : ''; },
      columns: columns,
      records: Array.isArray(opts.records) ? opts.records : [],
      emptyText: text(opts.emptyText, '') || '暂无历史记录',
    };
  }

  return { create: create };
});
