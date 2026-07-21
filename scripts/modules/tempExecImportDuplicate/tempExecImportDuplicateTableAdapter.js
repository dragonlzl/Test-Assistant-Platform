(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var model = root && root.app && root.app.tempExecImportDuplicate
    ? root.app.tempExecImportDuplicate.model
    : null;
  if (typeof module !== 'undefined' && module.exports) {
    model = model || require('./tempExecImportDuplicateModel.js');
  }
  var api = factory(model);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecImportDuplicate = root.app.tempExecImportDuplicate || {};
    root.app.tempExecImportDuplicate.tableAdapter = api;
  }
})(function(model) {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    return {
      id: 'temp-exec-import-duplicate',
      caption: '导入用例重复校验',
      rowKeyPolicy: 'strict',
      strictRowKey: true,
      rowKey: function(record) { return record ? record.rowKey : ''; },
      columns: [
        { key: 'line', title: '行号', width: 72, minWidth: 64, align: 'center' },
        { key: 'module', title: '模块', width: 150, minWidth: 120, tooltip: true },
        { key: 'title', title: '用例标题', width: 240, minWidth: 180, tooltip: true },
        { key: 'priority', title: '优先级', width: 90, minWidth: 80, align: 'center' },
        { key: 'precondition', title: '前提条件', width: 220, minWidth: 160, tooltip: true, multiline: true },
        { key: 'steps', title: '操作步骤', width: 260, minWidth: 180, tooltip: true, multiline: true },
        { key: 'expected', title: '预期结果', width: 240, minWidth: 180, tooltip: true, multiline: true },
        { key: 'actual', title: '实际结果', width: 200, minWidth: 150, tooltip: true, multiline: true },
        { key: 'remark', title: '备注', width: 180, minWidth: 140, tooltip: true, multiline: true },
        { key: 'defects', title: '缺陷链接', width: 220, minWidth: 160, tooltip: true, multiline: true },
        {
          key: 'actionText',
          title: '处理',
          width: 90,
          minWidth: 80,
          align: 'center',
          tone: function(value, record) { return record && record.keep ? 'success' : 'danger'; },
        },
      ],
      records: Array.isArray(opts.records) ? opts.records : [],
      emptyText: '暂无重复条目',
    };
  }

  return { create: create };
});
