(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var diffModel = root && root.app && root.app.caseLibrary ? root.app.caseLibrary.diffModel : null;
  var adapterFactory = root && root.app && root.app.caseLibrary ? root.app.caseLibrary.diffTableAdapter : null;
  var tableHost = root && root.app && root.app.ui ? root.app.ui.VTableHost : null;
  if (typeof module !== 'undefined' && module.exports) {
    diffModel = diffModel || require('./caseLibraryDiffModel.js');
    adapterFactory = adapterFactory || require('./caseLibraryDiffTableAdapter.js');
  }
  var api = factory(root, diffModel, adapterFactory, tableHost);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.diffController = api;
  }
})(function(root, diffModel, adapterFactory, tableHost) {
  function summarize(rows) {
    var counts = { added: 0, removed: 0, changed: 0, same: 0, different: 0, total: 0 };
    (Array.isArray(rows) ? rows : []).forEach(function(row) {
      var type = row && row.type ? String(row.type) : 'same';
      if (Object.prototype.hasOwnProperty.call(counts, type)) counts[type] += 1;
      counts.total += 1;
      if (type !== 'same') counts.different += 1;
    });
    return counts;
  }

  function create(options) {
    var opts = options || {};
    var hostEl = opts.hostEl || null;
    var locateBarEl = opts.locateBarEl || null;
    var hostApi = opts.tableHost || tableHost;
    if (!hostEl || !hostApi || typeof hostApi.mount !== 'function') {
      throw new Error('Case library diff controller dependencies are required');
    }
    var tableController = null;
    var mode = 'import';
    var mountedMode = '';
    var mountedEmptyText = '';
    var rows = [];
    var locateIndex = -1;

    function differenceRows() {
      return rows.filter(function(row) { return row && row.type !== 'same'; });
    }

    function appendButton(container, action, label, symbol, disabled) {
      var button = root.document.createElement('button');
      button.type = 'button';
      button.className = 'secondary case-library-diff-locate-btn';
      button.textContent = symbol;
      button.title = label;
      button.setAttribute('aria-label', label);
      button.setAttribute('data-diff-locate-scope', 'case-library-import-diff');
      button.setAttribute('data-diff-locate-action', action);
      button.disabled = disabled === true;
      container.appendChild(button);
    }

    function renderLocateBar() {
      if (!locateBarEl) return;
      var counts = summarize(rows);
      var differences = differenceRows();
      locateBarEl.replaceChildren();
      var info = root.document.createElement('div');
      info.className = 'diff-locate-info';
      info.textContent = differences.length
        ? '差异定位：新增 ' + counts.added + ' / 删除 ' + counts.removed +
          ' / 差异 ' + counts.changed + '，共 ' + counts.different + ' 处'
        : '差异定位：暂无差异';
      locateBarEl.appendChild(info);
      if (!differences.length) return;
      var controls = root.document.createElement('div');
      controls.className = 'diff-locate-controls';
      var hasCurrent = locateIndex >= 0;
      appendButton(controls, 'first', '定位首处差异', '|<', hasCurrent && locateIndex <= 0);
      appendButton(controls, 'prev', '定位上一处差异', '<', !hasCurrent || locateIndex <= 0);
      appendButton(controls, 'next', '定位下一处差异', '>', hasCurrent && locateIndex >= differences.length - 1);
      appendButton(controls, 'last', '定位末处差异', '>|', hasCurrent && locateIndex >= differences.length - 1);
      var position = root.document.createElement('span');
      position.className = 'diff-locate-pos';
      position.setAttribute('data-diff-locate-pos', '');
      position.textContent = hasCurrent
        ? '位置 ' + (locateIndex + 1) + '/' + differences.length
        : '位置 --/' + differences.length;
      controls.appendChild(position);
      locateBarEl.appendChild(controls);
    }

    function focusAt(index) {
      var differences = differenceRows();
      if (!differences.length || !tableController || typeof tableController.focus !== 'function') return false;
      var next = Number(index);
      if (!isFinite(next)) next = 0;
      next = Math.max(0, Math.min(differences.length - 1, Math.floor(next)));
      var row = differences[next];
      var focused = tableController.focus({ rowKey: row.key, columnKey: 'type' });
      if (focused === false) return false;
      locateIndex = next;
      hostEl.setAttribute('data-active-row-key', row.key);
      renderLocateBar();
      return true;
    }

    function handleLocateClick(event) {
      var button = event && event.target && event.target.closest
        ? event.target.closest('[data-diff-locate-action]')
        : null;
      if (!button || button.getAttribute('data-diff-locate-scope') !== 'case-library-import-diff') return;
      var differences = differenceRows();
      if (!differences.length) return;
      var action = button.getAttribute('data-diff-locate-action');
      if (action === 'first') focusAt(0);
      else if (action === 'last') focusAt(differences.length - 1);
      else if (action === 'next') focusAt(locateIndex >= 0 ? locateIndex + 1 : 0);
      else if (action === 'prev') focusAt(locateIndex >= 0 ? locateIndex - 1 : differences.length - 1);
    }

    function mount(nextMode, emptyText) {
      var normalizedMode = nextMode === 'append_overwrite' ? 'append_overwrite' : 'import';
      var normalizedEmptyText = emptyText || '暂无差异数据';
      if (tableController && (
        mountedMode !== normalizedMode || mountedEmptyText !== normalizedEmptyText
      )) {
        tableController.destroy();
        tableController = null;
        mountedMode = '';
        mountedEmptyText = '';
      }
      mode = normalizedMode;
      if (!tableController) {
        tableController = hostApi.mount(hostEl, adapterFactory.create({
          id: 'case-library-import-diff-vtable',
          mode: mode,
          records: rows,
          emptyText: normalizedEmptyText,
        }), {
          semanticMaxRows: 200,
          frozenColCount: 2,
        });
        mountedMode = normalizedMode;
        mountedEmptyText = normalizedEmptyText;
      } else {
        tableController.setRecords(rows);
      }
      return tableController;
    }

    function setData(input) {
      var data = input || {};
      var nextMode = data.mode === 'append_overwrite' ? 'append_overwrite' : 'import';
      rows = nextMode === 'append_overwrite'
        ? diffModel.buildAppendOverwriteDiffRows(data.importItems, data.dbItems)
        : diffModel.buildImportDiffRows(data.importItems, data.dbItems);
      locateIndex = -1;
      hostEl.removeAttribute('data-active-row-key');
      mount(nextMode, '暂无差异数据');
      if (tableController && typeof tableController.focus === 'function') {
        tableController.focus({ clear: true });
      }
      renderLocateBar();
      return rows.slice();
    }

    function setLoading(nextMode) {
      var normalizedMode = nextMode === 'append_overwrite' ? 'append_overwrite' : 'import';
      rows = [];
      locateIndex = -1;
      hostEl.removeAttribute('data-active-row-key');
      mount(normalizedMode, '加载中...');
      if (tableController && typeof tableController.focus === 'function') {
        tableController.focus({ clear: true });
      }
      renderLocateBar();
    }

    function destroy() {
      if (locateBarEl) locateBarEl.removeEventListener('click', handleLocateClick);
      if (tableController) tableController.destroy();
      tableController = null;
      mountedMode = '';
      mountedEmptyText = '';
      rows = [];
    }

    if (locateBarEl) locateBarEl.addEventListener('click', handleLocateClick);
    renderLocateBar();
    return {
      setData: setData,
      setLoading: setLoading,
      focusAt: focusAt,
      getRows: function() { return rows.slice(); },
      getCounts: function() { return summarize(rows); },
      getLocateIndex: function() { return locateIndex; },
      getTableController: function() { return tableController; },
      destroy: destroy,
    };
  }

  return {
    create: create,
    summarize: summarize,
  };
});
