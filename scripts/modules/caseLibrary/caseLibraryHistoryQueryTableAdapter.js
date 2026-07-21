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
    root.app.caseLibrary.historyQueryTableAdapter = api;
  }
})(function(historyModel) {
  function text(value, fallback) {
    var normalized = historyModel.normalizeText(value);
    return normalized || (fallback === undefined ? '--' : fallback);
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var formatTime = typeof opts.formatTime === 'function'
      ? opts.formatTime
      : function(value) { return text(value); };
    var getVersionName = typeof opts.getVersionName === 'function'
      ? opts.getVersionName
      : function(projectId, versionId) { return text(versionId); };
    var onOpen = typeof opts.onOpen === 'function' ? opts.onOpen : function() {};
    return {
      id: text(opts.id, '') || 'case-library-history-query',
      caption: text(opts.caption, '') || '用例改动历史',
      rowKeyPolicy: 'strict',
      strictRowKey: true,
      rowKey: function(record) { return record ? record.rowKey : ''; },
      rowTone: function(record) { return record && record.isDeleted ? 'removed' : ''; },
      columns: [
        {
          key: 'lastChangedAt',
          title: '修改时间',
          width: 160,
          editable: false,
          value: function(record) { return text(formatTime(record && record.lastChangedAt)); },
          tooltip: true,
        },
        {
          key: 'fileName',
          title: '用例名',
          width: 220,
          editable: false,
          value: function(record) {
            var name = text(record && record.fileNameClean);
            return record && record.isDeleted ? name + '（已删除）' : name;
          },
          tone: function(value, record) { return record && record.isDeleted ? 'removed' : ''; },
          tooltip: true,
        },
        {
          key: 'versionName',
          title: '版本',
          width: 120,
          editable: false,
          value: function(record) {
            return text(getVersionName(record && record.projectId, record && record.versionId));
          },
          tooltip: true,
        },
        {
          key: 'importerName',
          title: '导入人员',
          width: 120,
          editable: false,
          value: function(record) { return text(record && record.importerName); },
          tooltip: true,
        },
        {
          key: 'importedAt',
          title: '导入时间',
          width: 160,
          editable: false,
          value: function(record) { return text(formatTime(record && record.importedAt)); },
          tooltip: true,
        },
        {
          key: 'updatedBy',
          title: '更新人员',
          width: 120,
          editable: false,
          value: function(record) { return text(record && record.updatedBy); },
          tooltip: true,
        },
        {
          key: 'updatedAt',
          title: '更新时间',
          width: 160,
          editable: false,
          value: function(record) { return text(formatTime(record && record.updatedAt)); },
          tooltip: true,
        },
        {
          key: 'actions',
          title: '操作',
          width: 120,
          kind: 'actions',
          editable: false,
          actions: [{ id: 'open-history', label: '历史详情', title: '查看历史详情' }],
        },
      ],
      records: Array.isArray(opts.records) ? opts.records : [],
      emptyText: text(opts.emptyText, '') || '暂无有改动记录的用例文件',
      onAction: function(payload) {
        if (!payload || payload.action !== 'open-history') return;
        onOpen(payload.record, payload);
      },
    };
  }

  return { create: create };
});
