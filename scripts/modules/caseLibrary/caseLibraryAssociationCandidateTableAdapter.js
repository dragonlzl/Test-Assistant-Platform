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
    root.app.caseLibrary.associationCandidateTableAdapter = api;
  }
})(function(associationModel) {
  function text(value, fallback) {
    var normalized = associationModel.normalizeText(value);
    return normalized || (fallback === undefined ? '--' : fallback);
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var getVersionName = typeof opts.getVersionName === 'function'
      ? opts.getVersionName
      : function(projectId, versionId) { return text(versionId); };
    var onSelect = typeof opts.onSelect === 'function' ? opts.onSelect : function() {};
    var columns = [
      {
        key: 'selected',
        title: '选择',
        width: 80,
        minWidth: 72,
        kind: 'radio',
        editable: false,
        value: function(record) { return Boolean(record && record.selected === true); },
        disabled: function(record) { return Boolean(record && record.forbidden === true); },
      },
      {
        key: 'fileName',
        title: '用例名',
        width: 260,
        minWidth: 160,
        editable: false,
        value: function(record) { return text(record && record.fileNameClean); },
        tooltip: function(value, record) {
          return record && record.forbiddenReason ? record.forbiddenReason : value;
        },
      },
      {
        key: 'versionName',
        title: '版本',
        width: 160,
        minWidth: 110,
        editable: false,
        value: function(record) {
          return text(getVersionName(record && record.projectId, record && record.versionId));
        },
        tooltip: true,
      },
      {
        key: 'itemCount',
        title: '条目数',
        width: 120,
        minWidth: 90,
        align: 'center',
        editable: false,
      },
    ];
    return {
      id: text(opts.id, '') || 'case-library-association-candidates',
      caption: text(opts.caption, '') || '选择关联副用例',
      rowKeyPolicy: 'strict',
      strictRowKey: true,
      rowKey: function(record) { return record ? record.rowKey : ''; },
      columns: columns,
      records: Array.isArray(opts.records) ? opts.records : [],
      emptyText: text(opts.emptyText, '') || '暂无可选副用例',
      onCellChange: function(payload) {
        if (!payload || !payload.record || payload.value !== true) return;
        if (!payload.column || payload.column.key !== 'selected') return;
        if (payload.record.forbidden === true) return;
        onSelect(payload.record, payload);
      },
    };
  }

  return { create: create };
});
