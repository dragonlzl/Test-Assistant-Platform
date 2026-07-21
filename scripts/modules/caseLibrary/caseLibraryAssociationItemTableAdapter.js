(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var associationModel = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.associationModel
    : null;
  if (typeof module !== 'undefined' && module.exports) {
    associationModel = associationModel || require('./caseLibraryAssociationModel.js');
  }
  var api = factory(associationModel);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.associationItemTableAdapter = api;
  }
})(function(associationModel) {
  function text(value, fallback) {
    var normalized = associationModel.normalizeText(value);
    return normalized || (fallback === undefined ? '--' : fallback);
  }

  function textColumn(key, title, width, multiline) {
    return {
      key: key,
      title: title,
      width: width,
      minWidth: 90,
      editable: false,
      tooltip: true,
      multiline: multiline === true,
    };
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var onToggle = typeof opts.onToggle === 'function' ? opts.onToggle : function() {};
    var columns = [
      {
        key: 'selected',
        title: '选择',
        width: 80,
        minWidth: 72,
        kind: 'checkbox',
        editable: false,
        value: function(record) { return Boolean(record && record.selected === true); },
      },
      {
        key: 'index',
        title: '编号',
        width: 90,
        minWidth: 72,
        align: 'center',
        editable: false,
      },
      textColumn('module', '模块', 160, false),
      textColumn('title', '用例标题', 220, false),
      textColumn('priority', '优先级', 100, false),
      textColumn('precondition', '前提条件', 240, true),
      textColumn('steps', '操作步骤', 280, true),
      textColumn('expected', '预期结果', 240, true),
    ];
    return {
      id: text(opts.id, '') || 'case-library-association-items',
      caption: text(opts.caption, '') || '选择关联条目',
      rowKeyPolicy: 'strict',
      strictRowKey: true,
      rowKey: function(record) { return record ? record.rowKey : ''; },
      columns: columns,
      records: Array.isArray(opts.records) ? opts.records : [],
      emptyText: text(opts.emptyText, '') || '该副用例暂无条目',
      onCellChange: function(payload) {
        if (!payload || !payload.record || !payload.column || payload.column.key !== 'selected') return;
        onToggle(payload.record, payload.value === true, payload);
      },
    };
  }

  return { create: create };
});
