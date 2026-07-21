(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var associationModel = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.associationModel
    : null;
  var adapterFactory = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.associationItemTableAdapter
    : null;
  var tableHost = root && root.app && root.app.ui ? root.app.ui.VTableHost : null;
  if (typeof module !== 'undefined' && module.exports) {
    associationModel = associationModel || require('./caseLibraryAssociationModel.js');
    adapterFactory = adapterFactory || require('./caseLibraryAssociationItemTableAdapter.js');
  }
  var api = factory(associationModel, adapterFactory, tableHost);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.associationItemController = api;
  }
})(function(associationModel, adapterFactory, defaultTableHost) {
  function positiveInteger(value, fallback) {
    var number = Number(value);
    if (!isFinite(number) || number <= 0 || Math.floor(number) !== number) return fallback;
    return number;
  }

  function paginationHtml(page) {
    if (!page || !page.total) return '';
    return (
      '<div class="temp-pagination" data-association-pagination>' +
        '<div class="temp-pagination-info">显示 ' + (page.start + 1) + '-' + page.end +
          ' / 共 ' + page.total + ' 条，每页 ' + page.pageSize + ' 条</div>' +
        '<div class="temp-pagination-controls">' +
          '<button type="button" class="secondary" data-association-page-action="prev" ' +
            (page.pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
          '<button type="button" class="secondary" data-association-page-action="next" ' +
            (page.pageIndex >= page.totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
          '<label>跳转</label>' +
          '<input type="number" min="1" max="' + page.totalPages + '" value="' +
            (page.pageIndex + 1) + '" data-association-page-input>' +
        '</div>' +
      '</div>'
    );
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var hostEl = opts.hostEl || null;
    var selectAllEl = opts.selectAllEl || null;
    var paginationElements = [opts.paginationTopEl, opts.paginationBottomEl].filter(function(element) {
      return Boolean(element);
    });
    var tableHost = opts.tableHost || defaultTableHost;
    if (!hostEl || !tableHost || typeof tableHost.mount !== 'function' ||
      !associationModel || !adapterFactory) {
      throw new Error('Case library association item controller dependencies are required');
    }

    var onSelectionChange = typeof opts.onSelectionChange === 'function'
      ? opts.onSelectionChange
      : function() {};
    var onStateChange = typeof opts.onStateChange === 'function'
      ? opts.onStateChange
      : function() {};
    var subCaseFileId = null;
    var rows = [];
    var selectedItemIds = [];
    var pageIndex = 0;
    var pageSize = positiveInteger(opts.pageSize, 20);
    var loading = false;
    var phase = 'initial';
    var tableController = null;
    var mountedEmptyText = '';
    var destroyed = false;

    function buildPage() {
      var page = associationModel.paginate(rows, pageIndex, pageSize);
      pageIndex = page.pageIndex;
      return page;
    }

    function stateSnapshot(page) {
      var current = page || buildPage();
      return {
        subCaseFileId: subCaseFileId,
        pageIndex: current.pageIndex,
        pageSize: current.pageSize,
        total: rows.length,
        totalPages: current.totalPages,
        selectedTotal: selectedItemIds.length,
        loading: loading,
        phase: phase,
      };
    }

    function updateRowsSelection() {
      var selectedMap = Object.create(null);
      selectedItemIds.forEach(function(id) { selectedMap[String(id)] = true; });
      rows = rows.map(function(row) {
        return Object.assign({}, row, { selected: selectedMap[String(row.id)] === true });
      });
    }

    function syncSelectAll(page) {
      if (!selectAllEl) return;
      var state = associationModel.getCurrentPageSelectionState(page.records, selectedItemIds);
      selectAllEl.checked = state.checked;
      selectAllEl.indeterminate = state.indeterminate;
      selectAllEl.disabled = state.disabled || loading;
    }

    function syncPagination(page) {
      var html = loading ? '' : paginationHtml(page);
      paginationElements.forEach(function(element) { element.innerHTML = html; });
    }

    function mount(records, emptyText) {
      if (tableController && mountedEmptyText !== emptyText) {
        tableController.destroy();
        tableController = null;
        mountedEmptyText = '';
      }
      if (!tableController) {
        var adapterOptions = Object.assign({}, opts.adapterOptions || {}, {
          id: opts.id || 'case-library-association-items',
          records: records,
          emptyText: emptyText,
          onToggle: toggleRecord,
        });
        tableController = tableHost.mount(hostEl, adapterFactory.create(adapterOptions), {
          semanticMaxRows: 200,
          frozenColCount: 2,
        });
        mountedEmptyText = emptyText;
      } else {
        tableController.setRecords(records);
      }
    }

    function render(notify) {
      if (destroyed) return null;
      var page = buildPage();
      var emptyText = '该副用例暂无条目';
      if (phase === 'initial') emptyText = '请先在上一步选择副用例';
      else if (loading) emptyText = '加载用例中...';
      mount(page.records, emptyText);
      syncSelectAll(page);
      syncPagination(page);
      var snapshot = stateSnapshot(page);
      if (notify !== false) onStateChange(snapshot);
      return snapshot;
    }

    function emitSelection(payload) {
      onSelectionChange(selectedItemIds.slice(), payload || null);
    }

    function toggleRecord(record, checked, payload) {
      if (!record || !record.id) return false;
      var selectedMap = Object.create(null);
      selectedItemIds.forEach(function(id) { selectedMap[String(id)] = true; });
      if (checked === true) selectedMap[String(record.id)] = true;
      else delete selectedMap[String(record.id)];
      selectedItemIds = associationModel.orderSelectionByItems(rows, Object.keys(selectedMap));
      updateRowsSelection();
      render(true);
      emitSelection(payload);
      return true;
    }

    function setLoading(context) {
      var source = context && typeof context === 'object' ? context : {};
      subCaseFileId = positiveInteger(source.subCaseFileId, null);
      selectedItemIds = associationModel.normalizeSelectionIds(source.selectedItemIds);
      pageIndex = positiveInteger(Number(source.pageIndex) + 1, 1) - 1;
      rows = [];
      loading = true;
      phase = 'loading';
      return render(true);
    }

    function setData(records, context) {
      var source = context && typeof context === 'object' ? context : {};
      subCaseFileId = positiveInteger(source.subCaseFileId, null);
      var requestedSelection = associationModel.normalizeSelectionIds(source.selectedItemIds);
      rows = associationModel.normalizeItemRecords(records, {
        subCaseFileId: subCaseFileId,
        selectedItemIds: requestedSelection,
      });
      selectedItemIds = associationModel.orderSelectionByItems(rows, requestedSelection);
      pageIndex = Object.prototype.hasOwnProperty.call(source, 'pageIndex')
        ? Math.max(0, Math.floor(Number(source.pageIndex) || 0))
        : 0;
      loading = false;
      phase = 'data';
      updateRowsSelection();
      return render(true);
    }

    function setPageIndex(value) {
      pageIndex = Math.max(0, Math.floor(Number(value) || 0));
      return render(true);
    }

    function setPageSize(value) {
      pageSize = positiveInteger(value, pageSize);
      pageIndex = 0;
      return render(true);
    }

    function setSelectedItemIds(values, notify) {
      selectedItemIds = associationModel.orderSelectionByItems(rows, values);
      updateRowsSelection();
      var snapshot = render(true);
      if (notify !== false) emitSelection(null);
      return snapshot;
    }

    function setSelectionAll(checked) {
      var page = buildPage();
      selectedItemIds = associationModel.applyCurrentPageSelection(
        rows,
        selectedItemIds,
        page.records,
        checked === true
      );
      updateRowsSelection();
      var snapshot = render(true);
      emitSelection(null);
      return snapshot;
    }

    function reset(context) {
      var source = context && typeof context === 'object' ? context : {};
      subCaseFileId = positiveInteger(source.subCaseFileId, null);
      rows = [];
      selectedItemIds = [];
      pageIndex = 0;
      loading = false;
      phase = 'initial';
      return render(true);
    }

    function handleSelectAllChange(event) {
      var target = event && event.target ? event.target : selectAllEl;
      setSelectionAll(Boolean(target && target.checked));
    }

    function handlePaginationClick(event) {
      var target = event && event.target ? event.target : null;
      var button = target && typeof target.closest === 'function'
        ? target.closest('[data-association-page-action]')
        : null;
      if (!button || typeof button.getAttribute !== 'function') return;
      var action = button.getAttribute('data-association-page-action') || '';
      var page = buildPage();
      if (action === 'first') setPageIndex(0);
      else if (action === 'prev') setPageIndex(page.pageIndex - 1);
      else if (action === 'next') setPageIndex(page.pageIndex + 1);
      else if (action === 'last') setPageIndex(page.totalPages - 1);
    }

    function handlePaginationChange(event) {
      var target = event && event.target ? event.target : null;
      if (!target || typeof target.getAttribute !== 'function' ||
        target.getAttribute('data-association-page-input') === null) return;
      setPageIndex(Number(target.value) - 1);
    }

    if (selectAllEl && typeof selectAllEl.addEventListener === 'function') {
      selectAllEl.addEventListener('change', handleSelectAllChange);
    }
    paginationElements.forEach(function(element) {
      if (typeof element.addEventListener !== 'function') return;
      element.addEventListener('click', handlePaginationClick);
      element.addEventListener('change', handlePaginationChange);
    });
    render(false);

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (selectAllEl && typeof selectAllEl.removeEventListener === 'function') {
        selectAllEl.removeEventListener('change', handleSelectAllChange);
      }
      paginationElements.forEach(function(element) {
        if (typeof element.removeEventListener !== 'function') return;
        element.removeEventListener('click', handlePaginationClick);
        element.removeEventListener('change', handlePaginationChange);
      });
      if (tableController) tableController.destroy();
      tableController = null;
      rows = [];
      selectedItemIds = [];
    }

    return {
      setLoading: setLoading,
      setData: setData,
      setPageIndex: setPageIndex,
      setPageSize: setPageSize,
      setSelectionAll: setSelectionAll,
      setSelectedItemIds: setSelectedItemIds,
      reset: reset,
      getState: stateSnapshot,
      getRows: function() { return rows.slice(); },
      getPageRecords: function() { return buildPage().records.slice(); },
      getSelectedItemIds: function() { return selectedItemIds.slice(); },
      resize: function() {
        if (tableController && typeof tableController.resize === 'function') tableController.resize();
      },
      destroy: destroy,
    };
  }

  return { create: create };
});
