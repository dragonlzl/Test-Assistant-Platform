(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var model = root && root.app && root.app.caseLibrary ? root.app.caseLibrary.editListModel : null;
  if (typeof module !== 'undefined' && module.exports) {
    model = model || require('./caseLibraryEditListModel.js');
  }
  var api = factory(model);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.editListTableAdapter = api;
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
    var onSelectionChange = typeof opts.onSelectionChange === 'function'
      ? opts.onSelectionChange
      : function() {};
    var onEdit = typeof opts.onEdit === 'function' ? opts.onEdit : function() {};
    return {
      id: text(opts.id, '') || 'case-library-edit-list',
      caption: text(opts.caption, '') || '查看与编辑用例文件',
      rowKeyPolicy: 'strict',
      strictRowKey: true,
      rowKey: function(record) { return record ? record.rowKey : ''; },
      columns: [
        {
          key: 'selected',
          title: '选择',
          width: 64,
          minWidth: 60,
          kind: 'checkbox',
          semanticControlAttributes: function(record) {
            return { 'data-case-lib-edit-select': record && record.id ? record.id : '' };
          },
        },
        { key: 'projectName', title: '所属项目', width: 140, minWidth: 120, tooltip: true },
        { key: 'versionName', title: '版本', width: 100, minWidth: 88, tooltip: true },
        {
          key: 'fileName',
          title: '用例名',
          width: 220,
          minWidth: 160,
          value: function(record) {
            return text(record && record.fileName) + (record && record.reuseEnabled ? ' [复]' : '');
          },
          semanticCellClass: function(record) {
            return record && record.reuseEnabled ? 'case-library-reuse-badge' : '';
          },
          tooltip: true,
        },
        {
          key: 'execStatus',
          title: '执行页状态',
          width: 170,
          minWidth: 140,
          value: function(record) {
            var users = record && Array.isArray(record.activeUsers) ? record.activeUsers : [];
            if (!users.length) return '未';
            return users.map(function(name) { return text(name, '') + '：执'; }).join('；');
          },
          tone: function(value, record) {
            return record && record.activeUsers && record.activeUsers.length ? 'success' : 'muted';
          },
          semanticCellClass: function(record) {
            return record && record.activeUsers && record.activeUsers.length
              ? 'tag case-lib-exec-tag'
              : 'tag muted case-lib-exec-tag-pending';
          },
          tooltip: true,
        },
        { key: 'itemCountText', title: '用例条目数', width: 100, minWidth: 88 },
        { key: 'reuseText', title: '复用类型', width: 96, minWidth: 88 },
        { key: 'importerName', title: '导入人员', width: 110, minWidth: 96, tooltip: true },
        {
          key: 'importedAt',
          title: '导入时间',
          width: 160,
          minWidth: 140,
          format: function(value) { return formatTime(value); },
          tooltip: true,
        },
        { key: 'updaterName', title: '最近更新人员', width: 120, minWidth: 108, tooltip: true },
        {
          key: 'updatedAt',
          title: '更新时间',
          width: 160,
          minWidth: 140,
          format: function(value) { return formatTime(value); },
          tooltip: true,
        },
        {
          key: 'associationText',
          title: '关联用例',
          width: 110,
          minWidth: 96,
          value: function(record) {
            var count = Number(record && record.associationCount);
            return count > 0 ? ('关联(' + Math.floor(count) + ')') : '无关联';
          },
        },
        {
          key: 'actions',
          title: '操作',
          width: 100,
          minWidth: 88,
          kind: 'actions',
          actions: [
            {
              id: 'edit',
              label: '编辑',
              title: '查看并编辑用例',
              semanticAttributes: function(record) {
                return { 'data-case-lib-edit': record && record.id ? record.id : '' };
              },
              semanticClass: function(record) {
                return 'primary' + (record && record.showAiDot ? ' case-library-ai-gen-dot' : '');
              },
            },
          ],
        },
      ],
      records: Array.isArray(opts.records) ? opts.records : [],
      emptyText: text(opts.emptyText, '') || '请选择项目后自动刷新。',
      onCellChange: function(payload) {
        if (!payload || !payload.record || !payload.column || payload.column.key !== 'selected') return;
        onSelectionChange(payload.record, payload.value === true, payload);
      },
      onAction: function(payload) {
        if (!payload || payload.action !== 'edit' || !payload.record) return;
        onEdit(payload.record, payload);
      },
    };
  }

  return { create: create };
});
