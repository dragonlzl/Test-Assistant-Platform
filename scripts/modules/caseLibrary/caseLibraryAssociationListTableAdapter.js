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
    root.app.caseLibrary.associationListTableAdapter = api;
  }
})(function(associationModel) {
  function text(value, fallback) {
    var normalized = associationModel.normalizeText(value);
    return normalized || (fallback === undefined ? '--' : fallback);
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var onEdit = typeof opts.onEdit === 'function' ? opts.onEdit : function() {};
    var onDelete = typeof opts.onDelete === 'function' ? opts.onDelete : function() {};
    return {
      id: text(opts.id, '') || 'case-library-association-list',
      caption: text(opts.caption, '') || '用例关联',
      rowKeyPolicy: 'strict',
      strictRowKey: true,
      rowKey: function(record) { return record ? record.rowKey : ''; },
      columns: [
        {
          key: 'subCaseName',
          title: '关联用例名',
          width: 260,
          minWidth: 160,
          editable: false,
          tooltip: true,
        },
        {
          key: 'selectedCount',
          title: '关联用例数',
          width: 120,
          minWidth: 100,
          align: 'center',
          editable: false,
        },
        {
          key: 'actions',
          title: '操作',
          width: 150,
          minWidth: 140,
          kind: 'actions',
          editable: false,
          actions: [
            { id: 'edit', label: '编辑', title: '编辑关联' },
            { id: 'delete', label: '删除', title: '删除关联', tone: 'danger' },
          ],
        },
      ],
      records: Array.isArray(opts.records) ? opts.records : [],
      emptyText: text(opts.emptyText, '') || '暂无关联副用例',
      onAction: function(payload) {
        if (!payload || !payload.record) return;
        if (payload.action === 'edit') onEdit(payload.record, payload);
        else if (payload.action === 'delete') onDelete(payload.record, payload);
      },
    };
  }

  return { create: create };
});
