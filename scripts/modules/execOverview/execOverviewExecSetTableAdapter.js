(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var model = root && root.app && root.app.execOverview
    ? root.app.execOverview.execSetModel
    : null;
  if (typeof module !== 'undefined' && module.exports) {
    model = model || require('./execOverviewExecSetModel.js');
  }
  var api = factory(model);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.execOverview = root.app.execOverview || {};
    root.app.execOverview.execSetTableAdapter = api;
  }
})(function(model) {
  function text(value, fallback) {
    var normalized = model.normalizeText(value);
    return normalized || (fallback === undefined ? '--' : fallback);
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var formatTime = typeof opts.formatTime === 'function'
      ? opts.formatTime
      : function(value) { return text(value); };
    return {
      id: text(opts.id, '') || 'exec-overview-exec-set',
      caption: text(opts.caption, '') || '执行列表',
      rowKeyPolicy: 'strict',
      strictRowKey: true,
      rowKey: function(record) { return record ? record.rowKey : ''; },
      columns: [
        {
          key: 'module',
          title: '模块',
          width: 180,
          minWidth: 120,
          editable: false,
          value: function(record) { return text(record && record.module, ''); },
          tooltip: true,
        },
        {
          key: 'title',
          title: '用例标题',
          width: 360,
          minWidth: 220,
          editable: false,
          value: function(record) { return text(record && record.title, ''); },
          tooltip: true,
        },
        {
          key: 'actualResult',
          title: '实际结果',
          width: 180,
          minWidth: 120,
          editable: false,
          value: function(record) { return text(record && record.actualResult, ''); },
          tooltip: true,
        },
        {
          key: 'updatedAt',
          title: '更新时间',
          width: 190,
          minWidth: 160,
          editable: false,
          value: function(record) { return text(formatTime(record && record.updatedAt)); },
          tooltip: true,
        },
      ],
      records: Array.isArray(opts.records) ? opts.records : [],
      emptyText: text(opts.emptyText, '') || '暂无用例',
    };
  }

  return { create: create };
});
