(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var model = root && root.app && root.app.caseLibrary ? root.app.caseLibrary.editorModel : null;
  if (typeof module !== 'undefined' && module.exports) {
    model = model || require('./caseLibraryEditorModel.js');
  }
  var api = factory(model);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.editorTableAdapter = api;
  }
})(function(model) {
  var editableFields = {
    module: true,
    title: true,
    priority: true,
    precondition: true,
    steps: true,
    expected: true,
  };

  function editorColumn(key, title, width, multiline) {
    return {
      key: key,
      title: title,
      width: width,
      minWidth: Math.min(width, multiline ? 160 : 88),
      multiline: multiline === true,
      tooltip: true,
      editable: true,
      editor: {
        type: multiline === true ? 'textarea' : 'input',
        attributes: function(record) {
          return {
            'data-case-lib-edit-field': key,
            'data-index': record ? record.sourceIndex : '',
            'data-case-lib-multiline': multiline === true ? 'true' : 'false',
          };
        },
      },
      semanticControlAttributes: function(record) {
        return {
          'data-case-lib-edit-field': key,
          'data-index': record ? record.sourceIndex : '',
          'data-case-lib-multiline': multiline === true ? 'true' : 'false',
        };
      },
      semanticControlClass: 'temp-inline-edit',
    };
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var onSelectionChange = typeof opts.onSelectionChange === 'function'
      ? opts.onSelectionChange
      : function() {};
    var onFieldChange = typeof opts.onFieldChange === 'function'
      ? opts.onFieldChange
      : function() {};
    var onAction = typeof opts.onAction === 'function' ? opts.onAction : function() {};
    return {
      id: model.text(opts.id).trim() || 'case-library-editor',
      caption: model.text(opts.caption).trim() || '用例编辑详情',
      rowKeyPolicy: 'strict',
      strictRowKey: true,
      rowKey: function(record) { return record ? record.rowKey : ''; },
      rowTone: function(record) {
        if (record && record.isLocated) return 'changed';
        if (record && record.isNewAdded) return 'added';
        return '';
      },
      semanticRowClass: function(record) {
        var classes = ['case-row'];
        if (record && record.isNewAdded) classes.push('new-added');
        if (record && record.isLocated) classes.push('xmind-locate-highlight');
        return classes.join(' ');
      },
      columns: [
        {
          key: 'selected',
          title: '选择',
          width: 64,
          minWidth: 60,
          kind: 'checkbox',
          semanticControlAttributes: function(record) {
            return {
              'data-case-lib-select': '',
              'data-index': record ? record.sourceIndex : '',
            };
          },
        },
        { key: 'number', title: '编号', width: 64, minWidth: 60, align: 'center' },
        editorColumn('module', '模块', 140, false),
        editorColumn('title', '用例标题', 220, false),
        editorColumn('priority', '优先级', 96, false),
        editorColumn('precondition', '前提条件', 220, true),
        editorColumn('steps', '操作步骤', 260, true),
        editorColumn('expected', '预期结果', 280, true),
        {
          key: 'actions',
          title: '增删',
          width: 128,
          minWidth: 112,
          kind: 'actions',
          actions: [
            {
              id: 'insert',
              label: '下方插入',
              title: '在下方插入用例',
              semanticAttributes: function(record) {
                return {
                  'data-case-lib-insert': '',
                  'data-index': record ? record.sourceIndex : '',
                };
              },
            },
            {
              id: 'remove',
              label: '删除',
              title: '删除当前用例',
              tone: 'danger',
              semanticAttributes: function(record) {
                return {
                  'data-case-lib-remove': '',
                  'data-index': record ? record.sourceIndex : '',
                };
              },
            },
          ],
        },
      ],
      records: Array.isArray(opts.records) ? opts.records : [],
      emptyText: model.text(opts.emptyText).trim() || '未解析到有效用例',
      onCellChange: function(payload) {
        if (!payload || !payload.record || !payload.column) return;
        var key = payload.column.key;
        if (key === 'selected') {
          onSelectionChange(payload.record, payload.value === true, payload);
          return;
        }
        if (editableFields[key]) onFieldChange(payload.record, key, payload.value, payload);
      },
      onAction: function(payload) {
        if (!payload || !payload.record) return;
        if (payload.action !== 'insert' && payload.action !== 'remove') return;
        onAction(payload.action, payload.record, payload);
      },
    };
  }

  return { create: create, editableFields: Object.assign({}, editableFields) };
});
