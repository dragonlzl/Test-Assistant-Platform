(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var model = root && root.app && root.app.tempExecCaseLibraryDiff
    ? root.app.tempExecCaseLibraryDiff.model
    : null;
  if (typeof module !== 'undefined' && module.exports) {
    model = model || require('./tempExecCaseLibraryDiffModel.js');
  }
  var api = factory(model);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecCaseLibraryDiff = root.app.tempExecCaseLibraryDiff || {};
    root.app.tempExecCaseLibraryDiff.tableAdapter = api;
  }
})(function(model) {
  var DATA_COLUMNS = [
    ['module', '模块', 180],
    ['title', '用例标题', 220],
    ['precondition', '前提条件', 240],
    ['steps', '操作步骤', 280],
    ['expected', '预期结果', 240],
  ];

  function locateAttributes(record) {
    if (!record || record.canLocate !== true) return null;
    return {
      'data-case-lib-diff-activate': '',
      'data-case-lib-diff-row-key': record.rowKey,
      'data-case-lib-diff-case-id': record.caseItemId,
      'data-case-lib-diff-kind': record.kind,
      'aria-label': '定位执行用例：' + model.text(record.cells && record.cells.title),
      role: 'button',
      tabindex: '0',
    };
  }

  function dataColumn(definition) {
    var key = definition[0];
    return {
      key: key,
      title: definition[1],
      width: definition[2],
      minWidth: 120,
      value: function(record) { return record && record.cells ? record.cells[key] : ''; },
      tone: function(value, record) {
        return record && record.changedFieldMap && record.changedFieldMap[key] === true
          ? 'changed'
          : '';
      },
      tooltip: true,
      multiline: function(value) { return String(value || '').indexOf('\n') !== -1; },
      semanticCellAttributes: key === 'title' ? locateAttributes : null,
      semanticCellClass: function(record) {
        return record && record.changedFieldMap && record.changedFieldMap[key] === true
          ? 'case-lib-diff-changed'
          : '';
      },
    };
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var onRowActivate = typeof opts.onRowActivate === 'function'
      ? opts.onRowActivate
      : function() {};
    return {
      id: 'temp-exec-case-library-diff',
      caption: '执行用例变更差异',
      rowKeyPolicy: 'strict',
      strictRowKey: true,
      rowKey: function(record) { return record ? record.rowKey : ''; },
      semanticRowClass: function(record) {
        return record && record.canLocate ? 'case-lib-diff-row case-lib-diff-clickable' : 'case-lib-diff-row';
      },
      columns: [
        {
          key: 'kindLabel',
          title: '类型',
          width: 90,
          minWidth: 80,
          align: 'center',
          tone: function(value, record) { return record && record.kindTone ? record.kindTone : 'muted'; },
          semanticCellClass: function(record) {
            return 'case-lib-diff-kind ' + (record && record.kind ? record.kind : '');
          },
        },
        { key: 'timeText', title: '修改时间', width: 160, minWidth: 150, tooltip: true },
        { key: 'operator', title: '操作人员', width: 120, minWidth: 100, tooltip: true },
      ].concat(DATA_COLUMNS.map(dataColumn)),
      records: Array.isArray(opts.records) ? opts.records : [],
      emptyText: model.text(opts.emptyText) || '暂无变更',
      onCellClick: function(payload) {
        var record = payload && payload.record ? payload.record : null;
        if (record && record.canLocate === true) onRowActivate(record, payload);
      },
    };
  }

  return { create: create, locateAttributes: locateAttributes };
});
