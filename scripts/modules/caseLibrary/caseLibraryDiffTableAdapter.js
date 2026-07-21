(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var diffModel = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.diffModel
    : null;
  if (typeof module !== 'undefined' && module.exports) {
    diffModel = diffModel || require('./caseLibraryDiffModel.js');
  }
  var api = factory(diffModel);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.diffTableAdapter = api;
  }
})(function(diffModel) {
  var TYPE_LABELS = {
    added: '新增',
    removed: '将删除',
    changed: '有差异',
    same: '一致',
  };

  function normalize(value) {
    if (diffModel && typeof diffModel.normalizeDiffText === 'function') {
      return diffModel.normalizeDiffText(value);
    }
    if (value === null || value === undefined) return '';
    return String(value).replace(/\r\n/g, '\n').trim();
  }

  function fieldValue(item, field) {
    if (!item) return '';
    if (field === 'module') return normalize(item.module || item.module_name || '');
    if (field === 'precondition') {
      return normalize(item.precondition || item.preconditions || '');
    }
    return normalize(item[field] || '');
  }

  function pairValue(record, field, labels) {
    var left = fieldValue(record && record.left, field);
    var right = fieldValue(record && record.right, field);
    if (!left && !right) return '';
    if (left && right && left === right) return left;
    if (left && right) {
      return labels.left + '：' + left + '\n' + labels.right + '：' + right;
    }
    if (left) return labels.left + '：' + left;
    return labels.right + '：' + right;
  }

  function typeLabel(record) {
    var type = record && record.type ? String(record.type) : 'same';
    return TYPE_LABELS[type] || type;
  }

  function cellTone(field) {
    return function(value, record) {
      if (field === 'type') return record && record.type ? record.type : '';
      if (!record || record.type !== 'changed' || !record.diff) return '';
      return record.diff[field] === true ? 'changed' : '';
    };
  }

  function dataColumn(field, title, width, labels) {
    return {
      key: field,
      title: title,
      width: width,
      minWidth: 90,
      editable: false,
      value: function(record) { return pairValue(record, field, labels); },
      tone: cellTone(field),
      tooltip: true,
      multiline: true,
    };
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var mode = opts.mode === 'append_overwrite' ? 'append_overwrite' : 'import';
    var labels = {
      left: normalize(opts.leftLabel) || (mode === 'append_overwrite' ? '待入库' : '导入'),
      right: normalize(opts.rightLabel) || '库中',
    };
    var columns = [
      {
        key: 'sequence',
        title: '序号',
        width: 64,
        minWidth: 64,
        align: 'center',
        editable: false,
        value: function(record, index) { return index + 1; },
      },
      {
        key: 'type',
        title: '状态',
        width: 90,
        minWidth: 90,
        editable: false,
        value: function(record) { return typeLabel(record); },
        tone: cellTone('type'),
        tooltip: true,
      },
      dataColumn('module', '模块', 140, labels),
      dataColumn('title', '用例标题', 220, labels),
      dataColumn('priority', '优先级', 110, labels),
      dataColumn('precondition', '前置条件', 240, labels),
      dataColumn('steps', '操作步骤', 300, labels),
      dataColumn('expected', '预期结果', 240, labels),
    ];
    if (mode === 'append_overwrite') {
      columns.push(dataColumn('remark', '备注', 180, labels));
    }

    return {
      id: normalize(opts.id) || 'case-library-' + mode + '-diff',
      caption: normalize(opts.caption) ||
        (mode === 'append_overwrite' ? '追加入库差异对比' : '同名用例差异对比'),
      rowKeyPolicy: 'strict',
      strictRowKey: true,
      rowKey: function(record) { return record ? record.key : ''; },
      rowTone: function(record) { return record && record.type ? record.type : ''; },
      columns: columns,
      records: Array.isArray(opts.records) ? opts.records : [],
      emptyText: normalize(opts.emptyText) || '暂无差异数据',
    };
  }

  return {
    create: create,
    pairValue: pairValue,
    fieldValue: fieldValue,
    typeLabel: typeLabel,
  };
});
