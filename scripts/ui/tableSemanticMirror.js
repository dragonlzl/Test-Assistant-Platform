(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.ui = window.app.ui || {};
    window.app.ui.tableSemanticMirror = api;
  }
})(function() {
  var DEFAULT_MAX_ROWS = 200;

  function positiveInteger(value, fallback) {
    var number = Number(value);
    if (!isFinite(number) || number <= 0) return fallback;
    return Math.max(1, Math.floor(number));
  }

  function resolveFocusIndex(model, options) {
    var opts = options || {};
    var records = model && Array.isArray(model.records) ? model.records : [];
    var rowKey = opts.focusRowKey;
    if (rowKey !== undefined && rowKey !== null && model && model.rowKeyIndex) {
      var normalizedKey = String(rowKey).trim();
      if (Object.prototype.hasOwnProperty.call(model.rowKeyIndex, normalizedKey)) {
        return model.rowKeyIndex[normalizedKey];
      }
    }
    var focusIndex = Number(opts.focusIndex);
    if (isFinite(focusIndex) && focusIndex >= 0 && focusIndex < records.length) {
      return Math.floor(focusIndex);
    }
    return 0;
  }

  function buildRecordWindow(model, options) {
    var records = model && Array.isArray(model.records) ? model.records : [];
    var opts = options || {};
    var maxRows = positiveInteger(opts.maxRows, DEFAULT_MAX_ROWS);
    var total = records.length;
    if (total <= maxRows) {
      return {
        records: records.slice(),
        startIndex: 0,
        endIndex: total,
        total: total,
        truncated: false,
      };
    }

    var focusIndex = resolveFocusIndex(model, opts);
    var startIndex = Math.max(0, focusIndex - Math.floor(maxRows / 2));
    startIndex = Math.min(startIndex, total - maxRows);
    var endIndex = startIndex + maxRows;
    return {
      records: records.slice(startIndex, endIndex),
      startIndex: startIndex,
      endIndex: endIndex,
      total: total,
      truncated: true,
    };
  }

  function appendTextCell(row, tagName, text) {
    var cell = document.createElement(tagName);
    cell.textContent = text === undefined || text === null ? '' : String(text);
    row.appendChild(cell);
    return cell;
  }

  function isColumnDisabled(column, record) {
    if (!column || !record) return false;
    if (typeof column.disabled === 'function') {
      return column.disabled(
        record.__source,
        record.__sourceIndex,
        record[column.key]
      ) === true;
    }
    return column.disabled === true;
  }

  function isColumnEditable(column, record) {
    if (!column || !column.editor || !record) return false;
    if (typeof column.editor.canEdit === 'function') {
      return column.editor.canEdit(
        record.__source,
        record.__sourceIndex,
        record[column.key]
      ) !== false;
    }
    return true;
  }

  function resolveSemanticOption(option, record, index) {
    if (typeof option === 'function') return option(record, index);
    return option;
  }

  function applySemanticAttributes(element, option, record, index) {
    var attributes = resolveSemanticOption(option, record, index);
    if (!attributes || typeof attributes !== 'object') return;
    Object.keys(attributes).forEach(function(name) {
      var value = attributes[name];
      if (value === undefined || value === null || value === false) return;
      element.setAttribute(name, value === true ? '' : String(value));
    });
  }

  function applySemanticClass(element, option, record, index) {
    var value = resolveSemanticOption(option, record, index);
    var className = value === undefined || value === null ? '' : String(value).trim();
    if (!className) return;
    element.className = [element.className || '', className].filter(Boolean).join(' ');
  }

  function renderCell(cell, column, record, model) {
    var source = record.__source;
    var sourceIndex = record.__sourceIndex;
    var meta = record.__cellMeta && record.__cellMeta[column.key]
      ? record.__cellMeta[column.key]
      : null;
    if (meta && meta.tone) cell.setAttribute('data-tone', meta.tone);
    if (meta && meta.tooltip) cell.setAttribute('title', meta.tooltip);
    if (meta && meta.multiline) cell.setAttribute('data-multiline', 'true');
    if (column.kind === 'checkbox') {
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = record[column.key] === true;
      checkbox.setAttribute('aria-label', column.title);
      applySemanticAttributes(checkbox, column.semanticControlAttributes, source, sourceIndex);
      applySemanticClass(checkbox, column.semanticControlClass, source, sourceIndex);
      checkbox.addEventListener('change', function() {
        if (model.adapter.onCellChange) {
          model.adapter.onCellChange({
            column: column,
            record: source,
            recordIndex: sourceIndex,
            value: checkbox.checked,
            source: 'semantic',
          });
        }
      });
      cell.appendChild(checkbox);
      return;
    }
    if (column.kind === 'radio') {
      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'tap-vtable-radio-' + model.id + '-' + column.key;
      radio.checked = record[column.key] === true;
      radio.disabled = isColumnDisabled(column, record);
      radio.setAttribute('aria-label', column.title);
      applySemanticAttributes(radio, column.semanticControlAttributes, source, sourceIndex);
      applySemanticClass(radio, column.semanticControlClass, source, sourceIndex);
      radio.addEventListener('change', function() {
        if (radio.disabled || radio.checked !== true || !model.adapter.onCellChange) return;
        model.adapter.onCellChange({
          column: column,
          record: source,
          recordIndex: sourceIndex,
          value: true,
          previousValue: record[column.key] === true,
          source: 'semantic',
        });
      });
      cell.appendChild(radio);
      return;
    }
    if (column.kind === 'actions') {
      column.actions.forEach(function(action) {
        if (!action.visible(source, sourceIndex)) return;
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = action.label;
        button.disabled = action.disabled(source, sourceIndex);
        button.setAttribute('data-table-action', action.id);
        applySemanticAttributes(button, action.semanticAttributes, source, sourceIndex);
        applySemanticClass(button, action.semanticClass, source, sourceIndex);
        button.addEventListener('click', function() {
          if (model.adapter.onAction) {
            model.adapter.onAction({
              action: action.id,
              column: column,
              record: source,
              recordIndex: sourceIndex,
              source: 'semantic',
              element: button,
            });
          }
        });
        cell.appendChild(button);
      });
      return;
    }
    if (column.editor) {
      var currentValue = record[column.key] === undefined || record[column.key] === null
        ? ''
        : String(record[column.key]);
      var valueText = document.createElement('span');
      valueText.className = 'tap-vtable-semantic-value';
      valueText.textContent = currentValue;
      cell.appendChild(valueText);
      var control;
      if (column.editor.type === 'textarea') {
        control = document.createElement('textarea');
      } else if (column.editor.type === 'list') {
        control = document.createElement('select');
        (column.editor.options.values || []).forEach(function(value) {
          var option = document.createElement('option');
          option.value = String(value);
          option.textContent = String(value);
          control.appendChild(option);
        });
      } else {
        control = document.createElement('input');
        control.type = column.editor.type === 'date' ? 'date' : 'text';
      }
      control.value = currentValue;
      control.disabled = !isColumnEditable(column, record);
      control.setAttribute('aria-label', column.title);
      applySemanticAttributes(control, column.semanticControlAttributes, source, sourceIndex);
      applySemanticClass(control, column.semanticControlClass, source, sourceIndex);
      control.addEventListener('change', function() {
        if (control.disabled) return;
        var previousValue = record[column.key];
        record[column.key] = control.value;
        valueText.textContent = control.value;
        if (model.adapter.onCellChange) {
          model.adapter.onCellChange({
            column: column,
            record: source,
            recordIndex: sourceIndex,
            value: control.value,
            previousValue: previousValue,
            source: 'semantic-editor',
            element: control,
          });
        }
      });
      cell.appendChild(control);
      return;
    }
    cell.textContent = record[column.key] === undefined || record[column.key] === null
      ? ''
      : String(record[column.key]);
  }

  function render(container, model, options) {
    var opts = options || {};
    var focusRowKey = opts.focusRowKey === undefined || opts.focusRowKey === null
      ? ''
      : String(opts.focusRowKey).trim();
    var recordWindow = buildRecordWindow(model, {
      maxRows: opts.maxRows,
      focusRowKey: opts.focusRowKey,
      focusIndex: opts.focusIndex,
    });
    container.replaceChildren();
    container.setAttribute('data-vtable-semantic-id', model.id);
    container.setAttribute('data-vtable-semantic-total', String(recordWindow.total));
    container.setAttribute('data-vtable-semantic-start', String(recordWindow.startIndex));
    container.setAttribute('data-vtable-semantic-end', String(recordWindow.endIndex));
    container.className = 'tap-vtable-semantic' + (opts.fallback ? ' is-fallback' : '');

    var table = document.createElement('table');
    table.className = 'tap-vtable-semantic-table';
    table.setAttribute('aria-rowcount', String(recordWindow.total + 1));
    var caption = document.createElement('caption');
    caption.textContent = model.caption;
    table.appendChild(caption);

    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');
    model.columns.forEach(function(column) {
      var header = appendTextCell(headerRow, 'th', column.title);
      header.scope = 'col';
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    if (!recordWindow.records.length) {
      var emptyRow = document.createElement('tr');
      var emptyCell = appendTextCell(emptyRow, 'td', model.emptyText);
      emptyCell.colSpan = Math.max(1, model.columns.length);
      tbody.appendChild(emptyRow);
    } else {
      recordWindow.records.forEach(function(record) {
        var row = document.createElement('tr');
        row.setAttribute('data-row-key', record.__rowKey);
        row.setAttribute('aria-selected', focusRowKey && record.__rowKey === focusRowKey ? 'true' : 'false');
        if (record.__rowTone) row.setAttribute('data-tone', record.__rowTone);
        applySemanticClass(
          row,
          model.adapter.semanticRowClass,
          record.__source,
          record.__sourceIndex
        );
        model.columns.forEach(function(column) {
          var cell = document.createElement('td');
          cell.setAttribute('data-field', column.key);
          applySemanticAttributes(cell, column.semanticCellAttributes, record.__source, record.__sourceIndex);
          applySemanticClass(cell, column.semanticCellClass, record.__source, record.__sourceIndex);
          renderCell(cell, column, record, model);
          row.appendChild(cell);
        });
        tbody.appendChild(row);
      });
    }
    table.appendChild(tbody);
    container.appendChild(table);
    return table;
  }

  return {
    DEFAULT_MAX_ROWS: DEFAULT_MAX_ROWS,
    buildRecordWindow: buildRecordWindow,
    render: render,
  };
});
