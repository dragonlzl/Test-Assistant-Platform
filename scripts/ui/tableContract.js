(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.ui = window.app.ui || {};
    window.app.ui.tableContract = api;
  }
})(function() {
  function asText(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function normalizeAction(action, index) {
    var source = action && typeof action === 'object' ? action : {};
    var id = asText(source.id || ('action-' + (index + 1))).trim();
    var label = asText(source.label || source.title || id).trim();
    return {
      id: id,
      label: label,
      title: asText(source.title || label),
      tone: asText(source.tone || 'default'),
      disabled: typeof source.disabled === 'function'
        ? source.disabled
        : function() { return source.disabled === true; },
      visible: typeof source.visible === 'function'
        ? source.visible
        : function() { return source.visible !== false; },
      semanticAttributes: source.semanticAttributes || null,
      semanticClass: source.semanticClass || '',
    };
  }

  function normalizeEditorType(value) {
    var type = asText(value || 'input').trim().toLowerCase();
    var aliases = {
      text: 'input',
      'text-input': 'input',
      'text-area': 'textarea',
      'date-input': 'date',
      select: 'list',
      dropdown: 'list',
    };
    type = aliases[type] || type;
    if (['input', 'textarea', 'date', 'list'].indexOf(type) === -1) {
      throw new Error('Unsupported VTable editor type: ' + type);
    }
    return type;
  }

  function normalizeEditor(source) {
    var raw = source.editor;
    var editable = source.editable;
    var hasDescriptor = typeof raw === 'string' || (raw && typeof raw === 'object');
    if (editable !== true && typeof editable !== 'function' && !hasDescriptor) return null;
    var descriptor = typeof raw === 'string' ? { type: raw } : (raw || {});
    var type = normalizeEditorType(descriptor.type || descriptor.kind || (
      source.multiline === true ? 'textarea' : 'input'
    ));
    var options = descriptor.options && typeof descriptor.options === 'object'
      ? Object.assign({}, descriptor.options)
      : {};
    if (descriptor.readonly === true) options.readonly = true;
    if (type === 'list') {
      var values = Array.isArray(descriptor.values)
        ? descriptor.values
        : (Array.isArray(options.values) ? options.values : null);
      if (!values) throw new Error('VTable list editor values are required');
      options.values = values.map(asText);
    }
    return {
      type: type,
      name: asText(descriptor.name).trim(),
      options: options,
      attributes: descriptor.attributes || null,
      canEdit: typeof editable === 'function'
        ? editable
        : (typeof descriptor.canEdit === 'function' ? descriptor.canEdit : null),
    };
  }

  function editorName(adapterId, columnKey) {
    function token(value) {
      return asText(value).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    }
    return 'tap-editor-' + (token(adapterId) || 'table') + '-' + (token(columnKey) || 'column');
  }

  function normalizeColumn(column, index) {
    var source = column && typeof column === 'object' ? column : {};
    var key = asText(source.key || source.field || ('column-' + (index + 1))).trim();
    if (!key) throw new Error('VTable column key is required');
    var kind = asText(source.kind || source.cellType || 'text').trim().toLowerCase();
    var editor = normalizeEditor(source);
    var normalized = {
      key: key,
      title: asText(source.title || source.label || key),
      kind: kind || 'text',
      width: source.width === undefined ? 'auto' : source.width,
      minWidth: Number(source.minWidth || 80),
      maxWidth: source.maxWidth === undefined ? undefined : Number(source.maxWidth),
      align: asText(source.align || (
        kind === 'checkbox' || kind === 'radio' ? 'center' : 'left'
      )),
      headerAlign: asText(source.headerAlign || source.align || 'left'),
      visible: source.visible !== false,
      sortable: source.sortable === true,
      editable: Boolean(editor),
      editor: editor,
      value: typeof source.value === 'function' ? source.value : null,
      format: typeof source.format === 'function' ? source.format : null,
      tone: source.tone === undefined ? '' : source.tone,
      tooltip: source.tooltip === undefined ? false : source.tooltip,
      multiline: source.multiline === undefined ? false : source.multiline,
      disabled: typeof source.disabled === 'function'
        ? source.disabled
        : (typeof source.disable === 'function'
          ? source.disable
          : (source.disabled === true || source.disable === true)),
      semanticCellAttributes: source.semanticCellAttributes || null,
      semanticCellClass: source.semanticCellClass || '',
      semanticControlAttributes: source.semanticControlAttributes || null,
      semanticControlClass: source.semanticControlClass || '',
      actions: Array.isArray(source.actions)
        ? source.actions.map(normalizeAction)
        : [],
      source: source,
    };
    return normalized;
  }

  function normalizeAdapter(adapter) {
    var source = adapter && typeof adapter === 'object' ? adapter : {};
    var id = asText(source.id).trim();
    if (!id) throw new Error('VTable adapter id is required');
    if (!Array.isArray(source.columns)) throw new Error('VTable adapter columns are required');
    var strictRowKey = source.strictRowKey === true ||
      asText(source.rowKeyPolicy).trim().toLowerCase() === 'strict';
    var columns = source.columns.map(normalizeColumn).filter(function(column) {
      return column.visible;
    });
    columns.forEach(function(column) {
      if (column.editor && !column.editor.name) {
        column.editor.name = editorName(id, column.key);
      }
    });
    return {
      id: id,
      caption: asText(source.caption || source.label || id),
      columns: columns,
      records: Array.isArray(source.records) ? source.records : [],
      rowKey: typeof source.rowKey === 'function' ? source.rowKey : null,
      rowKeyPolicy: strictRowKey ? 'strict' : 'compatible',
      strictRowKey: strictRowKey,
      rowTone: source.rowTone === undefined ? '' : source.rowTone,
      semanticRowClass: source.semanticRowClass || '',
      emptyText: asText(source.emptyText || '暂无数据'),
      onCellClick: typeof source.onCellClick === 'function' ? source.onCellClick : null,
      onCellDoubleClick: typeof source.onCellDoubleClick === 'function' ? source.onCellDoubleClick : null,
      onCellChange: typeof source.onCellChange === 'function' ? source.onCellChange : null,
      onAction: typeof source.onAction === 'function' ? source.onAction : null,
      onSelectionChange: typeof source.onSelectionChange === 'function' ? source.onSelectionChange : null,
      source: source,
    };
  }

  function resolveValue(column, record, index) {
    if (column.kind === 'actions') {
      return column.actions.filter(function(action) {
        return action.visible(record, index);
      }).map(function(action) {
        return action.label;
      }).join(' / ');
    }
    var value = column.value ? column.value(record, index) : record && record[column.key];
    if (column.kind === 'checkbox' || column.kind === 'radio') return value === true;
    if (column.format) return column.format(value, record, index);
    return value === undefined || value === null ? '' : value;
  }

  function resolveCellOption(option, value, record, index) {
    if (typeof option === 'function') return option(value, record, index);
    return option;
  }

  function resolveCellMetadata(column, value, record, index) {
    var toneValue = resolveCellOption(column.tone, value, record, index);
    var tooltipValue = resolveCellOption(column.tooltip, value, record, index);
    var multilineValue = resolveCellOption(column.multiline, value, record, index);
    if (tooltipValue === true) tooltipValue = value;
    if (tooltipValue === false || tooltipValue === null || tooltipValue === undefined) {
      tooltipValue = '';
    }
    return {
      tone: asText(toneValue).trim(),
      tooltip: asText(tooltipValue),
      multiline: multilineValue === true,
    };
  }

  function resolveRowTone(adapter, record, index) {
    var tone = typeof adapter.rowTone === 'function'
      ? adapter.rowTone(record, index)
      : adapter.rowTone;
    return asText(tone).trim();
  }

  function isMissingRowKey(value) {
    return value === undefined || value === null || asText(value).trim() === '';
  }

  function resolveBaseRowKey(adapter, record, index) {
    var candidate;
    if (adapter.rowKey) {
      candidate = adapter.rowKey(record, index);
      if (isMissingRowKey(candidate) && adapter.strictRowKey) {
        throw new Error('VTable stable row key is missing for adapter "' + adapter.id + '" at record ' + index);
      }
    }
    if (isMissingRowKey(candidate)) {
      candidate = record && record.id !== undefined && record.id !== null ? record.id : undefined;
    }
    if (isMissingRowKey(candidate)) {
      if (adapter.strictRowKey) {
        throw new Error('VTable stable row key is missing for adapter "' + adapter.id + '" at record ' + index);
      }
      candidate = index;
    }
    return asText(candidate).trim();
  }

  function buildTableModel(input, recordsOverride) {
    var adapter = normalizeAdapter(input);
    var records = Array.isArray(recordsOverride) ? recordsOverride : adapter.records;
    var keyCounts = Object.create(null);
    var rowKeyIndex = Object.create(null);
    var mapped = records.map(function(record, index) {
      var baseKey = resolveBaseRowKey(adapter, record, index);
      keyCounts[baseKey] = (keyCounts[baseKey] || 0) + 1;
      if (adapter.strictRowKey && keyCounts[baseKey] > 1) {
        throw new Error('VTable stable row key is duplicate for adapter "' + adapter.id + '": ' + baseKey);
      }
      var rowKey = keyCounts[baseKey] === 1 ? baseKey : baseKey + '--' + keyCounts[baseKey];
      var row = {
        __rowKey: rowKey,
        __rowTone: resolveRowTone(adapter, record, index),
        __cellMeta: {},
        __source: record,
        __sourceIndex: index,
      };
      adapter.columns.forEach(function(column) {
        var value = resolveValue(column, record, index);
        row[column.key] = value;
        row.__cellMeta[column.key] = resolveCellMetadata(column, value, record, index);
      });
      rowKeyIndex[rowKey] = index;
      return row;
    });
    return {
      id: adapter.id,
      caption: adapter.caption,
      columns: adapter.columns,
      records: mapped,
      rowKeyIndex: rowKeyIndex,
      emptyText: adapter.emptyText,
      adapter: adapter,
    };
  }

  return {
    asText: asText,
    normalizeAdapter: normalizeAdapter,
    normalizeEditor: normalizeEditor,
    editorName: editorName,
    buildTableModel: buildTableModel,
    resolveValue: resolveValue,
    resolveCellMetadata: resolveCellMetadata,
  };
});
