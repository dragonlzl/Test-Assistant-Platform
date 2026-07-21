(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var contract = root && root.app && root.app.ui ? root.app.ui.tableContract : null;
  var theme = root && root.app && root.app.ui ? root.app.ui.vtableTheme : null;
  var loader = root && root.app && root.app.ui ? root.app.ui.vtableLoader : null;
  var editors = root && root.app && root.app.ui ? root.app.ui.vtableEditorRegistry : null;
  var semantic = root && root.app && root.app.ui ? root.app.ui.tableSemanticMirror : null;
  if (typeof module !== 'undefined' && module.exports) {
    contract = contract || require('./tableContract.js');
    theme = theme || require('./vtableTheme.js');
    editors = editors || require('./vtableEditorRegistry.js');
  }
  var api = factory(root, contract, theme, loader, editors, semantic);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.ui = root.app.ui || {};
    root.app.ui.VTableHost = api;
  }
})(function(root, contract, themeApi, loaderApi, editorRegistryApi, semanticApi) {
  var instances = {};

  function tonePalette(tone, mode) {
    var normalized = String(tone || '').trim().toLowerCase();
    var dark = mode === 'dark';
    if (normalized === 'added' || normalized === 'success' || normalized === 'positive' || normalized === 'ok') {
      return dark
        ? { background: '#18352b', text: '#75e0a7' }
        : { background: '#ecfdf3', text: '#027a48' };
    }
    if (normalized === 'removed' || normalized === 'danger' || normalized === 'error' || normalized === 'err') {
      return dark
        ? { background: '#3b2427', text: '#fda29b' }
        : { background: '#fef3f2', text: '#b42318' };
    }
    if (normalized === 'changed' || normalized === 'warning' || normalized === 'warn') {
      return dark
        ? { background: '#3a3020', text: '#fec84b' }
        : { background: '#fffaeb', text: '#b54708' };
    }
    if (normalized === 'muted' || normalized === 'neutral') {
      return dark
        ? { background: '#202b3b', text: '#9aa7b8' }
        : { background: '#f6f8fb', text: '#667085' };
    }
    return null;
  }

  function normalizedRecordFromArgs(model, args) {
    var record = null;
    if (args && args.table && typeof args.table.getRecordByCell === 'function') {
      record = args.table.getRecordByCell(args.col, args.row);
    }
    if (record && typeof record.then === 'function') record = null;
    if (!record && args && isFinite(Number(args.row))) {
      var recordIndex = Number(args.row) - 1;
      if (recordIndex >= 0) record = model.records[recordIndex] || null;
    }
    return record && record.__rowKey !== undefined ? record : null;
  }

  function cellMetadata(record, columnKey) {
    if (!record || !record.__cellMeta) return null;
    return record.__cellMeta[columnKey] || null;
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

  function buildCellStyle(model, column, colors, mode, args) {
    var record = normalizedRecordFromArgs(model, args);
    var metadata = cellMetadata(record, column.key);
    var tone = metadata && metadata.tone ? metadata.tone : (record ? record.__rowTone : '');
    var toneColors = tonePalette(tone, mode);
    var multiline = Boolean(metadata && metadata.multiline);
    return {
      textAlign: column.align,
      fontFamily: themeApi.tokens.fontFamily,
      fontSize: themeApi.tokens.fontSize,
      fontWeight: toneColors ? 600 : 400,
      color: toneColors
        ? toneColors.text
        : (column.kind === 'actions' ? themeApi.tokens.accent : colors.text),
      bgColor: toneColors ? toneColors.background : colors.background,
      borderColor: colors.border,
      borderLineWidth: [0, 1, 1, 0],
      padding: [0, 12, 0, 12],
      textOverflow: 'ellipsis',
      cursor: column.kind === 'actions' ? 'pointer' : 'default',
      autoWrapText: multiline,
      lineClamp: multiline ? 2 : 1,
    };
  }

  function themeMode() {
    if (!root || !root.document || !root.document.documentElement) return 'light';
    return root.document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function buildColumns(model) {
    var mode = themeMode();
    var colors = themeApi.palette(mode);
    return model.columns.map(function(column) {
      var definition = {
        field: column.key,
        key: column.key,
        title: column.title,
        width: column.width,
        minWidth: column.minWidth,
        maxWidth: column.maxWidth,
        sort: column.sortable,
        headerStyle: {
          textAlign: column.headerAlign,
          fontFamily: themeApi.tokens.fontFamily,
          fontSize: themeApi.tokens.fontSize,
          fontWeight: 400,
          color: colors.headerText,
          bgColor: colors.headerBackground,
          borderColor: colors.border,
          borderLineWidth: [0, 1, 1, 0],
          padding: [0, 12, 0, 12],
        },
        style: function(args) {
          return buildCellStyle(model, column, colors, mode, args);
        },
      };
      if (column.kind === 'checkbox') {
        definition.cellType = 'checkbox';
        definition.checked = function(args) {
          return args && args.dataValue === true;
        };
      } else if (column.kind === 'radio') {
        definition.cellType = 'radio';
        definition.radioCheckType = 'column';
        definition.checked = function(args) {
          var record = normalizedRecordFromArgs(model, args);
          return Boolean(record && record[column.key] === true);
        };
        definition.disable = function(args) {
          return isColumnDisabled(column, normalizedRecordFromArgs(model, args));
        };
      } else {
        definition.cellType = 'text';
      }
      if (column.editor) {
        if (column.editor.canEdit) {
          definition.editor = function(args) {
            var record = normalizedRecordFromArgs(model, args);
            if (!record) return null;
            return column.editor.canEdit(
              record.__source,
              record.__sourceIndex,
              record[column.key]
            ) === false ? null : column.editor.name;
          };
        } else {
          definition.editor = column.editor.name;
        }
      }
      return definition;
    });
  }

  function buildOptions(model, options) {
    var opts = options || {};
    var hasEditors = model.columns.some(function(column) { return Boolean(column.editor); });
    return {
      records: model.records,
      columns: buildColumns(model),
      widthMode: 'standard',
      heightMode: 'standard',
      autoFillHeight: false,
      containerFit: { width: true, height: true },
      defaultRowHeight: Number(opts.rowHeight || themeApi.tokens.rowHeight),
      defaultHeaderRowHeight: Number(opts.headerHeight || themeApi.tokens.headerHeight),
      frozenRowCount: 1,
      frozenColCount: Number(opts.frozenColCount || 0),
      columnResizeMode: 'header',
      overscrollBehavior: 'none',
      hover: { highlightMode: 'row' },
      keyboardOptions: {
        copySelected: true,
        editCellOnEnter: hasEditors,
        moveFocusCellOnEnter: !hasEditors,
        moveFocusCellOnTab: true,
        pasteValueToCell: hasEditors && opts.pasteValueToCell !== false,
        selectAllOnCtrlA: true,
        showCopyCellBorder: true,
      },
      editCellTrigger: hasEditors
        ? (opts.editCellTrigger || ['doubleclick', 'keydown'])
        : 'api',
      select: {
        disableSelect: opts.disableSelect === true,
        disableDragSelect: opts.disableSelect === true,
        blankAreaClickDeselect: true,
        outsideClickDeselect: true,
      },
      theme: themeApi.buildTheme(themeMode()),
      emptyTip: {
        text: model.emptyText,
        textStyle: {
          fill: themeApi.palette(themeMode()).muted,
          fontFamily: themeApi.tokens.fontFamily,
          fontSize: themeApi.tokens.mutedFontSize,
        },
      },
    };
  }

  function findColumn(model, event) {
    if (!event) return null;
    var field = event.field;
    if ((field === undefined || field === null) && event.col !== undefined) {
      var colIndex = Number(event.col);
      if (isFinite(colIndex) && colIndex >= 0) return model.columns[colIndex] || null;
    }
    for (var i = 0; i < model.columns.length; i += 1) {
      if (String(model.columns[i].key) === String(field)) return model.columns[i];
    }
    return null;
  }

  function findRecord(table, event) {
    var record = event && event.originData ? event.originData : null;
    if (!record && table && event && typeof table.getRecordByCell === 'function') {
      record = table.getRecordByCell(event.col, event.row);
    }
    if (record && typeof record.then === 'function') record = null;
    return record && record.__source ? record : null;
  }

  function selectionAddress(model, col, row) {
    var columnIndex = Math.max(0, Math.min(model.columns.length - 1, Number(col) || 0));
    var recordIndex = Math.max(0, Math.min(model.records.length - 1, Number(row) - 1));
    var column = model.columns[columnIndex] || null;
    var record = model.records[recordIndex] || null;
    if (!column || !record) return null;
    return {
      rowKey: record.__rowKey,
      recordIndex: recordIndex,
      columnKey: column.key,
      columnIndex: columnIndex,
    };
  }

  function buildSelectionPayload(model, event) {
    var sourceRanges = event && Array.isArray(event.ranges) ? event.ranges : [];
    var selectedKeys = {};
    var rowKeys = [];
    var records = [];
    var ranges = [];
    sourceRanges.forEach(function(range) {
      var start = range && range.start ? range.start : {};
      var end = range && range.end ? range.end : start;
      var rawStartRow = Number(start.row);
      var rawEndRow = Number(end.row);
      if (!isFinite(rawStartRow)) rawStartRow = 1;
      if (!isFinite(rawEndRow)) rawEndRow = rawStartRow;
      if (Math.max(rawStartRow, rawEndRow) < 1) return;
      var startRow = Math.max(1, Math.min(rawStartRow, rawEndRow));
      var endRow = Math.min(model.records.length, Math.max(rawStartRow, rawEndRow));
      var startCol = Math.max(0, Math.min(Number(start.col) || 0, Number(end.col) || 0));
      var endCol = Math.min(model.columns.length - 1, Math.max(Number(start.col) || 0, Number(end.col) || 0));
      if (endRow < startRow || endCol < startCol) return;
      var normalizedStart = selectionAddress(model, startCol, startRow);
      var normalizedEnd = selectionAddress(model, endCol, endRow);
      if (!normalizedStart || !normalizedEnd) return;
      ranges.push({ start: normalizedStart, end: normalizedEnd });
      for (var row = startRow; row <= endRow; row += 1) {
        var record = model.records[row - 1];
        if (!record || selectedKeys[record.__rowKey]) continue;
        selectedKeys[record.__rowKey] = true;
        rowKeys.push(record.__rowKey);
        records.push(record.__source);
      }
    });
    var active = event && Number(event.row) >= 1
      ? selectionAddress(model, event.col, event.row)
      : null;
    return {
      ranges: ranges,
      rowKeys: rowKeys,
      records: records,
      active: active,
      source: 'canvas',
      event: event || null,
    };
  }

  function resolveFocusTarget(model, target) {
    if (!model || target === undefined || target === null) return null;
    var input = target && typeof target === 'object' ? target : { rowKey: target };
    var rowKeyValue = input.rowKey;
    if (rowKeyValue === undefined || rowKeyValue === null) return null;
    var rowKey = String(rowKeyValue).trim();
    if (!rowKey || !model.rowKeyIndex ||
      !Object.prototype.hasOwnProperty.call(model.rowKeyIndex, rowKey)) {
      return null;
    }

    var recordIndex = model.rowKeyIndex[rowKey];
    var columnKey = input.columnKey;
    var columnIndex = -1;
    if (columnKey !== undefined && columnKey !== null && String(columnKey).trim()) {
      columnKey = String(columnKey).trim();
      for (var index = 0; index < model.columns.length; index += 1) {
        if (String(model.columns[index].key) === columnKey) {
          columnIndex = index;
          break;
        }
      }
      if (columnIndex < 0) return null;
    } else {
      columnKey = null;
    }

    return {
      rowKey: rowKey,
      recordIndex: recordIndex,
      row: recordIndex + 1,
      columnKey: columnKey,
      columnIndex: columnIndex,
      col: columnIndex,
      edit: input.edit === true,
    };
  }

  function scrollToFocus(table, target) {
    if (!table) return false;
    if (!target) {
      if (typeof table.clearSelected !== 'function') return false;
      table.clearSelected();
      return true;
    }
    var handled = false;
    if (target.columnIndex >= 0 && typeof table.scrollToCell === 'function') {
      table.scrollToCell({ row: target.row, col: target.col });
      handled = true;
    } else if (typeof table.scrollToRow === 'function') {
      table.scrollToRow(target.row);
      handled = true;
    } else if (typeof table.scrollToCell === 'function') {
      table.scrollToCell({ row: target.row });
      handled = true;
    }
    if (target.columnIndex >= 0 && typeof table.selectCell === 'function') {
      table.selectCell(target.col, target.row);
      handled = true;
    }
    if (target.edit === true && target.columnIndex >= 0 && typeof table.startEditCell === 'function') {
      table.startEditCell(target.col, target.row);
      handled = true;
    }
    return handled;
  }

  function createActionMenu(model, column, record, event, closeExisting) {
    closeExisting();
    if (!root || !root.document) return function() {};
    var source = record.__source;
    var sourceIndex = record.__sourceIndex;
    var actions = column.actions.filter(function(action) {
      return action.visible(source, sourceIndex);
    });
    if (!actions.length) return function() {};

    var menu = root.document.createElement('div');
    menu.className = 'tap-table-action-menu';
    menu.setAttribute('role', 'menu');
    actions.forEach(function(action) {
      var button = root.document.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      button.disabled = action.disabled(source, sourceIndex);
      button.setAttribute('data-tone', action.tone);
      button.setAttribute('role', 'menuitem');
      button.addEventListener('click', function() {
        close();
        if (model.adapter.onAction) {
          model.adapter.onAction({
            action: action.id,
            column: column,
            record: source,
            recordIndex: sourceIndex,
            source: 'canvas',
            event: event || null,
            element: button,
          });
        }
      });
      menu.appendChild(button);
    });

    var nativeEvent = event && event.event ? event.event : null;
    var x = nativeEvent && isFinite(Number(nativeEvent.clientX)) ? Number(nativeEvent.clientX) : 24;
    var y = nativeEvent && isFinite(Number(nativeEvent.clientY)) ? Number(nativeEvent.clientY) : 24;
    menu.style.left = Math.max(8, Math.min(x, root.innerWidth - 180)) + 'px';
    menu.style.top = Math.max(8, Math.min(y + 6, root.innerHeight - 160)) + 'px';
    root.document.body.appendChild(menu);

    function close() {
      root.document.removeEventListener('pointerdown', outside, true);
      root.document.removeEventListener('keydown', onKeydown);
      if (menu.parentNode) menu.parentNode.removeChild(menu);
    }
    function outside(pointerEvent) {
      if (menu.contains(pointerEvent.target)) return;
      close();
    }
    function onKeydown(keyEvent) {
      if (keyEvent.key === 'Escape') close();
    }
    setTimeout(function() {
      root.document.addEventListener('pointerdown', outside, true);
      root.document.addEventListener('keydown', onKeydown);
    }, 0);
    return close;
  }

  function mount(container, adapterInput, options) {
    if (!container || typeof container.appendChild !== 'function') {
      throw new Error('VTableHost container is required');
    }
    if (!loaderApi || !editorRegistryApi || !semanticApi) {
      throw new Error('VTableHost dependencies are not loaded');
    }

    var opts = options || {};
    var adapter = contract.normalizeAdapter(adapterInput);
    var model = contract.buildTableModel(adapter);
    var table = null;
    var destroyed = false;
    var focusedTarget = null;
    var resizeObserver = null;
    var themeObserver = null;
    var closeActionMenu = function() {};
    var rootEl = root.document.createElement('div');
    var canvasEl = root.document.createElement('div');
    var semanticEl = root.document.createElement('div');
    var statusEl = root.document.createElement('div');

    rootEl.className = 'tap-vtable-shell is-loading';
    rootEl.setAttribute('data-vtable-id', model.id);
    canvasEl.className = 'tap-vtable-canvas';
    canvasEl.setAttribute('aria-hidden', 'true');
    canvasEl.tabIndex = 0;
    semanticEl.className = 'tap-vtable-semantic';
    statusEl.className = 'tap-vtable-status';
    statusEl.setAttribute('role', 'status');
    statusEl.textContent = '表格加载中';
    rootEl.appendChild(canvasEl);
    rootEl.appendChild(semanticEl);
    rootEl.appendChild(statusEl);
    container.replaceChildren(rootEl);

    function renderSemantic(fallback) {
      semanticApi.render(semanticEl, model, {
        fallback: fallback === true,
        maxRows: opts.semanticMaxRows,
        focusRowKey: focusedTarget ? focusedTarget.rowKey : undefined,
      });
    }

    renderSemantic(false);

    function renderFallback(error) {
      if (destroyed) return;
      rootEl.classList.remove('is-loading');
      rootEl.classList.add('is-fallback');
      statusEl.textContent = '表格组件加载失败，已切换兼容视图';
      renderSemantic(true);
      if (root.console && typeof root.console.error === 'function') root.console.error(error);
    }

    function bindEvents(runtime) {
      var events = runtime.TABLE_EVENT_TYPE || {};
      table.on(events.CLICK_CELL || 'click_cell', function(event) {
        var column = findColumn(model, event);
        var record = findRecord(table, event);
        if (!column || !record) return;
        if (column.kind === 'actions') {
          closeActionMenu = createActionMenu(model, column, record, event, closeActionMenu);
          return;
        }
        if (model.adapter.onCellClick) {
          model.adapter.onCellClick({
            column: column,
            record: record.__source,
            recordIndex: record.__sourceIndex,
            value: record[column.key],
            source: 'canvas',
            event: event,
          });
        }
      });
      table.on(events.DBLCLICK_CELL || 'dblclick_cell', function(event) {
        var column = findColumn(model, event);
        var record = findRecord(table, event);
        if (!column || !record || !model.adapter.onCellDoubleClick) return;
        model.adapter.onCellDoubleClick({
          column: column,
          record: record.__source,
          recordIndex: record.__sourceIndex,
          value: record[column.key],
          source: 'canvas',
          event: event,
        });
      });
      table.on(events.CHECKBOX_STATE_CHANGE || 'checkbox_state_change', function(event) {
        var column = findColumn(model, event);
        var record = findRecord(table, event);
        if (!column || !record || !model.adapter.onCellChange) return;
        model.adapter.onCellChange({
          column: column,
          record: record.__source,
          recordIndex: record.__sourceIndex,
          value: event.checked === true,
          source: 'canvas',
          event: event,
        });
      });
      table.on(events.RADIO_STATE_CHANGE || 'radio_state_change', function(event) {
        var column = findColumn(model, event);
        var record = findRecord(table, event);
        if (!column || !record || column.kind !== 'radio' || isColumnDisabled(column, record)) return;
        var previousValue = record[column.key] === true;
        model.records.forEach(function(row) {
          row[column.key] = row === record;
        });
        renderSemantic(rootEl.classList.contains('is-fallback'));
        if (!model.adapter.onCellChange) return;
        model.adapter.onCellChange({
          column: column,
          record: record.__source,
          recordIndex: record.__sourceIndex,
          value: true,
          previousValue: previousValue,
          source: 'canvas',
          event: event,
        });
      });
      table.on(events.CHANGE_CELL_VALUE || 'change_cell_value', function(event) {
        var column = findColumn(model, event);
        var record = findRecord(table, event);
        if (!column || !record) return;
        renderSemantic(rootEl.classList.contains('is-fallback'));
        if (!model.adapter.onCellChange) return;
        model.adapter.onCellChange({
          column: column,
          record: record.__source,
          recordIndex: record.__sourceIndex,
          value: event.changedValue,
          previousValue: event.rawValue,
          currentValue: event.currentValue,
          source: 'canvas-editor',
          event: event,
        });
      });
      table.on(events.SELECTED_CHANGED || 'selected_changed', function(event) {
        if (!model.adapter.onSelectionChange) return;
        model.adapter.onSelectionChange(buildSelectionPayload(model, event));
      });
      table.on(events.SELECTED_CLEAR || 'selected_clear', function(event) {
        if (!model.adapter.onSelectionChange) return;
        model.adapter.onSelectionChange(buildSelectionPayload(model, {
          ranges: [],
          event: event,
        }));
      });
      table.on(events.MOUSEENTER_CELL || 'mouseenter_cell', function(event) {
        var column = findColumn(model, event);
        var record = findRecord(table, event);
        if (!column || !record || typeof table.showTooltip !== 'function') return;
        var metadata = cellMetadata(record, column.key);
        if (!metadata || !metadata.tooltip) return;
        table.showTooltip(event.col, event.row, {
          content: metadata.tooltip,
          disappearDelay: 120,
          style: {
            fontFamily: themeApi.tokens.fontFamily,
            fontSize: themeApi.tokens.mutedFontSize,
            maxWidth: 420,
            maxHeight: 280,
          },
        });
      });
    }

    function observeSizeAndTheme() {
      if (typeof root.ResizeObserver === 'function') {
        resizeObserver = new root.ResizeObserver(function() {
          if (table && typeof table.resize === 'function') table.resize();
        });
        resizeObserver.observe(rootEl);
      }
      if (typeof root.MutationObserver === 'function') {
        themeObserver = new root.MutationObserver(function(mutations) {
          var changed = mutations.some(function(mutation) {
            return mutation.attributeName === 'data-theme';
          });
          if (!changed || !table || typeof table.updateOption !== 'function') return;
          table.updateOption(buildOptions(model, opts));
        });
        themeObserver.observe(root.document.documentElement, { attributes: true });
      }
    }

    function createTable(runtime) {
      if (destroyed) return null;
      return editorRegistryApi.ensure(runtime, model, opts.editors).then(function() {
        if (destroyed) return null;
        table = new runtime.ListTable(canvasEl, buildOptions(model, opts));
        bindEvents(runtime);
        rootEl.classList.remove('is-loading');
        rootEl.classList.add('is-ready');
        statusEl.textContent = '';
        observeSizeAndTheme();
        if (focusedTarget) scrollToFocus(table, focusedTarget);
        if (typeof root.CustomEvent === 'function') {
          rootEl.dispatchEvent(new root.CustomEvent('tap:vtable-mounted', {
            bubbles: true,
            detail: { id: model.id },
          }));
        }
        return table;
      });
    }

    var ready = loaderApi.ensure(opts.loader).then(createTable).catch(function(error) {
      renderFallback(error);
      return null;
    });

    function setRecords(records) {
      var hadFocusedTarget = Boolean(focusedTarget);
      model = contract.buildTableModel(adapter, records);
      if (focusedTarget) {
        focusedTarget = resolveFocusTarget(model, {
          rowKey: focusedTarget.rowKey,
          columnKey: focusedTarget.columnKey,
          edit: focusedTarget.edit === true,
        });
      }
      renderSemantic(rootEl.classList.contains('is-fallback'));
      if (table && typeof table.setRecords === 'function') table.setRecords(model.records);
      if (table && focusedTarget) scrollToFocus(table, focusedTarget);
      else if (table && hadFocusedTarget) scrollToFocus(table, null);
      return model.records.length;
    }

    function resize() {
      if (table && typeof table.resize === 'function') table.resize();
    }

    function focus(target) {
      canvasEl.focus();
      if (target && typeof target === 'object' && target.clear === true) {
        focusedTarget = null;
        renderSemantic(rootEl.classList.contains('is-fallback'));
        if (table) scrollToFocus(table, null);
        return true;
      }
      if (target === undefined || target === null) return true;
      var resolved = resolveFocusTarget(model, target);
      if (!resolved) return false;
      focusedTarget = resolved;
      renderSemantic(rootEl.classList.contains('is-fallback'));
      if (table) scrollToFocus(table, focusedTarget);
      return true;
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      closeActionMenu();
      if (resizeObserver) resizeObserver.disconnect();
      if (themeObserver) themeObserver.disconnect();
      if (table && typeof table.release === 'function') table.release();
      table = null;
      if (rootEl.parentNode) rootEl.parentNode.removeChild(rootEl);
      delete instances[model.id];
    }

    var controller = {
      id: model.id,
      ready: ready,
      setRecords: setRecords,
      resize: resize,
      focus: focus,
      destroy: destroy,
      getInstance: function() { return table; },
      getModel: function() { return model; },
      element: rootEl,
    };
    if (instances[model.id]) instances[model.id].destroy();
    instances[model.id] = controller;
    return controller;
  }

  function get(id) {
    return instances[String(id || '')] || null;
  }

  function destroyAll() {
    Object.keys(instances).forEach(function(id) {
      if (instances[id]) instances[id].destroy();
    });
  }

  return {
    mount: mount,
    get: get,
    destroyAll: destroyAll,
    buildColumns: buildColumns,
    buildOptions: buildOptions,
    buildSelectionPayload: buildSelectionPayload,
    resolveFocusTarget: resolveFocusTarget,
    scrollToFocus: scrollToFocus,
    instances: instances,
  };
});
