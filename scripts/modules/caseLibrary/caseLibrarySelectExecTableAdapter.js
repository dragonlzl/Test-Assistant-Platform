(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var model = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.selectExecModel
    : null;
  if (typeof module !== 'undefined' && module.exports) {
    model = model || require('./caseLibrarySelectExecModel.js');
  }
  var api = factory(model);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.selectExecTableAdapter = api;
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
    var onAssociationChange = typeof opts.onAssociationChange === 'function'
      ? opts.onAssociationChange
      : function() {};
    var onAssociation = typeof opts.onAssociation === 'function'
      ? opts.onAssociation
      : function() {};
    var onExec = typeof opts.onExec === 'function' ? opts.onExec : function() {};
    return {
      id: text(opts.id, '') || 'case-library-select-exec',
      caption: text(opts.caption, '') || '选择用例执行',
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
          editable: false,
        },
        {
          key: 'projectName',
          title: '所属项目',
          width: 140,
          minWidth: 120,
          tooltip: true,
          editable: false,
        },
        {
          key: 'versionName',
          title: '版本',
          width: 100,
          minWidth: 88,
          tooltip: true,
          editable: false,
        },
        {
          key: 'fileName',
          title: '用例名',
          width: 220,
          minWidth: 160,
          value: function(record) {
            return text(record && record.fileName) + (record && record.reuseEnabled ? ' [复]' : '');
          },
          tooltip: true,
          editable: false,
        },
        {
          key: 'execStatus',
          title: '执行页状态',
          width: 160,
          minWidth: 130,
          value: function(record) {
            var users = record && Array.isArray(record.activeUsers) ? record.activeUsers : [];
            if (!users.length) return '未';
            return users.map(function(name) { return text(name, '') + '：执'; }).join('；');
          },
          tooltip: true,
          editable: false,
        },
        {
          key: 'importerName',
          title: '导入人员',
          width: 110,
          minWidth: 96,
          tooltip: true,
          editable: false,
        },
        {
          key: 'importedAt',
          title: '导入时间',
          width: 160,
          minWidth: 140,
          format: function(value) { return formatTime(value); },
          tooltip: true,
          editable: false,
        },
        {
          key: 'updatedAt',
          title: '更新时间',
          width: 160,
          minWidth: 140,
          format: function(value) { return formatTime(value); },
          tooltip: true,
          editable: false,
        },
        {
          key: 'associationCountText',
          title: '关联用例',
          width: 110,
          minWidth: 96,
          value: function(record) {
            var count = Number(record && record.associationCount);
            return count > 0 ? ('关联(' + Math.floor(count) + ')') : '无关联';
          },
          editable: false,
        },
        {
          key: 'associationEnabled',
          title: '启用关联',
          width: 86,
          minWidth: 80,
          kind: 'checkbox',
          disabled: function(record) {
            return !(Number(record && record.associationCount) > 0);
          },
          editable: false,
        },
        {
          key: 'actions',
          title: '操作',
          width: 180,
          minWidth: 160,
          kind: 'actions',
          editable: false,
          actions: [
            { id: 'association', label: '用例关联', title: '管理用例关联' },
            { id: 'exec', label: '转到执行', title: '转到执行' },
          ],
        },
      ],
      records: Array.isArray(opts.records) ? opts.records : [],
      emptyText: text(opts.emptyText, '') || '请选择项目后自动刷新。',
      onCellChange: function(payload) {
        if (!payload || !payload.record || !payload.column) return;
        if (payload.column.key === 'selected') {
          onSelectionChange(payload.record, payload.value === true, payload);
        } else if (payload.column.key === 'associationEnabled') {
          if (!(Number(payload.record.associationCount) > 0)) return;
          onAssociationChange(payload.record, payload.value === true, payload);
        }
      },
      onAction: function(payload) {
        if (!payload || !payload.record) return;
        if (payload.action === 'association') onAssociation(payload.record, payload);
        else if (payload.action === 'exec') onExec(payload.record, payload);
      },
    };
  }

  return { create: create };
});
