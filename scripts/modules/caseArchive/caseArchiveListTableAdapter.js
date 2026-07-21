(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var model = root && root.app && root.app.caseArchive ? root.app.caseArchive.listModel : null;
  if (typeof module !== 'undefined' && module.exports) {
    model = model || require('./caseArchiveListModel.js');
  }
  var api = factory(model);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseArchive = root.app.caseArchive || {};
    root.app.caseArchive.listTableAdapter = api;
  }
})(function(model) {
  function text(value, fallback) {
    var normalized = model.normalizeText(value);
    return normalized || (fallback === undefined ? '--' : fallback);
  }

  function actionAttributes(action) {
    return function(record) {
      return {
        'data-case-archive-action': action,
        'data-case-archive-id': record && record.execSetId !== undefined ? String(record.execSetId) : '',
      };
    };
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var formatTime = typeof opts.formatTime === 'function'
      ? opts.formatTime
      : function(value) { return text(value); };
    var onAction = typeof opts.onAction === 'function' ? opts.onAction : function() {};
    return {
      id: text(opts.id, '') || 'case-archive-list',
      caption: text(opts.caption, '') || '归档用例列表',
      rowKeyPolicy: 'strict',
      strictRowKey: true,
      rowKey: function(record) { return record ? record.rowKey : ''; },
      columns: [
        { key: 'displayIndex', title: '编号', width: 72, minWidth: 64, align: 'center' },
        { key: 'projectName', title: '所属项目', width: 150, minWidth: 120, tooltip: true },
        { key: 'versionName', title: '版本', width: 110, minWidth: 90, tooltip: true },
        { key: 'name', title: '用例名', width: 240, minWidth: 180, tooltip: true },
        { key: 'caseCount', title: '用例条目数', width: 110, minWidth: 96, align: 'center' },
        { key: 'rearchiveCount', title: '重归档次数', width: 110, minWidth: 96, align: 'center' },
        {
          key: 'stateLabel',
          title: '状态',
          width: 90,
          minWidth: 80,
          tone: function(value, record) { return record && record.archiveState === 'rerun' ? 'warning' : 'muted'; },
        },
        { key: 'reuseText', title: '复用类型', width: 100, minWidth: 88 },
        { key: 'importedByName', title: '导入人员', width: 120, minWidth: 100, tooltip: true },
        {
          key: 'importedAt',
          title: '导入时间',
          width: 172,
          minWidth: 150,
          format: function(value) { return text(formatTime(value)); },
          tooltip: true,
        },
        { key: 'archivedByName', title: '归档人', width: 120, minWidth: 100, tooltip: true },
        {
          key: 'archivedAt',
          title: '归档时间',
          width: 172,
          minWidth: 150,
          format: function(value) { return text(formatTime(value)); },
          tooltip: true,
        },
        {
          key: 'actions',
          title: '操作',
          width: 120,
          minWidth: 104,
          kind: 'actions',
          actions: [
            { id: 'view', label: '查看', title: '查看归档详情', semanticAttributes: actionAttributes('view') },
            { id: 'restore', label: '恢复', title: '恢复到执行页', semanticAttributes: actionAttributes('restore') },
            {
              id: 'delete',
              label: '删除',
              title: '删除归档记录',
              tone: 'danger',
              visible: function(record) { return Boolean(record && record.canDelete); },
              semanticAttributes: actionAttributes('delete'),
            },
          ],
        },
      ],
      records: Array.isArray(opts.records) ? opts.records : [],
      emptyText: text(opts.emptyText, '') || '暂无归档记录',
      onAction: function(payload) {
        if (!payload || !payload.record) return;
        onAction(payload.action, payload.record, payload);
      },
    };
  }

  return { create: create };
});
