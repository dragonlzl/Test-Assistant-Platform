(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var historyModel = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.historyModel
    : null;
  var adapterFactory = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.historyQueryTableAdapter
    : null;
  var tableHost = root && root.app && root.app.ui ? root.app.ui.VTableHost : null;
  if (typeof module !== 'undefined' && module.exports) {
    historyModel = historyModel || require('./caseLibraryHistoryModel.js');
    adapterFactory = adapterFactory || require('./caseLibraryHistoryQueryTableAdapter.js');
  }
  var api = factory(historyModel, adapterFactory, tableHost);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.historyQueryController = api;
  }
})(function(historyModel, adapterFactory, defaultTableHost) {
  function positiveInteger(value, fallback) {
    var number = Number(value);
    if (!isFinite(number) || number <= 0) return fallback;
    return Math.max(1, Math.floor(number));
  }

  function paginationHtml(page) {
    if (!page || !page.total) return '';
    var range = '显示 ' + (page.start + 1) + '-' + page.end + ' / 共 ' + page.total + ' 条';
    return (
      '<div class="temp-pagination" data-case-lib-drawer-pagination="history-query">' +
        '<div class="temp-pagination-info">' + range + '，每页 ' + page.pageSize + ' 条</div>' +
        '<div class="temp-pagination-controls">' +
          '<button type="button" class="secondary" data-history-page-action="prev" ' +
            'data-case-lib-drawer-page="prev" data-case-lib-drawer-scope="history-query" ' +
            (page.pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
          '<button type="button" class="secondary" data-history-page-action="next" ' +
            'data-case-lib-drawer-page="next" data-case-lib-drawer-scope="history-query" ' +
            (page.pageIndex >= page.totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
          '<label>跳转</label>' +
          '<input type="number" min="1" max="' + page.totalPages + '" value="' +
            (page.pageIndex + 1) + '" data-history-page-input="1" ' +
            'data-case-lib-drawer-page-input data-case-lib-drawer-scope="history-query">' +
        '</div>' +
      '</div>'
    );
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var hostEl = opts.hostEl || null;
    var tableHost = opts.tableHost || defaultTableHost;
    if (!hostEl || !tableHost || typeof tableHost.mount !== 'function' ||
      !historyModel || !adapterFactory) {
      throw new Error('Case library history query controller dependencies are required');
    }

    var searchInputEl = opts.searchInputEl || null;
    var paginationElements = [opts.paginationTopEl, opts.paginationBottomEl].filter(function(element) {
      return Boolean(element);
    });
    var onOpen = typeof opts.onOpen === 'function' ? opts.onOpen : function() {};
    var onStateChange = typeof opts.onStateChange === 'function'
      ? opts.onStateChange
      : function() {};
    var rows = [];
    var searchText = '';
    var pageIndex = 0;
    var pageSize = positiveInteger(opts.pageSize, 20);
    var loading = false;
    var phase = 'initial';
    var tableController = null;
    var mountedEmptyText = '';
    var destroyed = false;

    function buildPage() {
      var visible = historyModel.filterQueryRecords(rows, searchText);
      var page = historyModel.paginate(visible, pageIndex, pageSize);
      pageIndex = page.pageIndex;
      page.filteredRecords = visible;
      return page;
    }

    function stateSnapshot(page) {
      var current = page || buildPage();
      return {
        searchText: searchText,
        pageIndex: current.pageIndex,
        pageSize: current.pageSize,
        total: rows.length,
        filteredTotal: current.total,
        totalPages: current.totalPages,
        loading: loading,
        phase: phase,
      };
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
          id: opts.id || 'case-library-history-query',
          records: records,
          emptyText: emptyText,
          onOpen: function(record, payload) { onOpen(record, payload); },
        });
        tableController = tableHost.mount(hostEl, adapterFactory.create(adapterOptions), {
          semanticMaxRows: 200,
        });
        mountedEmptyText = emptyText;
      } else {
        tableController.setRecords(records);
      }
    }

    function render(notify) {
      if (destroyed) return null;
      var page = buildPage();
      var emptyText = '暂无有改动记录的用例文件';
      if (phase === 'initial') emptyText = '请选择项目与版本后点击查询';
      else if (loading) emptyText = '加载中...';
      mount(page.records, emptyText);
      syncPagination(page);
      var snapshot = stateSnapshot(page);
      if (notify !== false) onStateChange(snapshot);
      return snapshot;
    }

    function setLoading() {
      loading = true;
      phase = 'loading';
      rows = [];
      pageIndex = 0;
      return render(true);
    }

    function setData(records) {
      rows = historyModel.normalizeQueryRecords(records);
      loading = false;
      phase = 'data';
      pageIndex = 0;
      return render(true);
    }

    function reset(options) {
      var source = options && typeof options === 'object' ? options : {};
      rows = [];
      loading = false;
      phase = 'initial';
      pageIndex = 0;
      searchText = Object.prototype.hasOwnProperty.call(source, 'searchText')
        ? String(source.searchText === null || source.searchText === undefined ? '' : source.searchText)
        : '';
      if (searchInputEl) searchInputEl.value = searchText;
      return render(true);
    }

    function setSearch(value) {
      searchText = value === null || value === undefined ? '' : String(value);
      pageIndex = 0;
      if (searchInputEl && searchInputEl.value !== searchText) searchInputEl.value = searchText;
      return render(true);
    }

    function setPageIndex(value) {
      pageIndex = Number(value);
      if (!isFinite(pageIndex)) pageIndex = 0;
      return render(true);
    }

    function setPageSize(value) {
      pageSize = positiveInteger(value, pageSize);
      pageIndex = 0;
      return render(true);
    }

    function handleSearchInput(event) {
      var target = event && event.target ? event.target : searchInputEl;
      setSearch(target ? target.value : '');
    }

    function handlePaginationClick(event) {
      var target = event && event.target ? event.target : null;
      var button = target && typeof target.closest === 'function'
        ? target.closest('[data-history-page-action]')
        : null;
      if (!button || typeof button.getAttribute !== 'function') return;
      var action = button.getAttribute('data-history-page-action') || '';
      var page = buildPage();
      if (action === 'first') setPageIndex(0);
      else if (action === 'prev') setPageIndex(page.pageIndex - 1);
      else if (action === 'next') setPageIndex(page.pageIndex + 1);
      else if (action === 'last') setPageIndex(page.totalPages - 1);
    }

    function handlePaginationChange(event) {
      var target = event && event.target ? event.target : null;
      if (!target || typeof target.getAttribute !== 'function' ||
        target.getAttribute('data-history-page-input') === null) return;
      setPageIndex(Number(target.value) - 1);
    }

    if (searchInputEl && typeof searchInputEl.addEventListener === 'function') {
      searchInputEl.addEventListener('input', handleSearchInput);
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
      if (searchInputEl && typeof searchInputEl.removeEventListener === 'function') {
        searchInputEl.removeEventListener('input', handleSearchInput);
      }
      paginationElements.forEach(function(element) {
        if (typeof element.removeEventListener !== 'function') return;
        element.removeEventListener('click', handlePaginationClick);
        element.removeEventListener('change', handlePaginationChange);
      });
      if (tableController) tableController.destroy();
      tableController = null;
      rows = [];
    }

    return {
      setLoading: setLoading,
      setData: setData,
      reset: reset,
      setSearch: setSearch,
      setPageIndex: setPageIndex,
      setPageSize: setPageSize,
      getState: function() { return stateSnapshot(); },
      getRows: function() { return rows.slice(); },
      getPageRecords: function() { return buildPage().records.slice(); },
      resize: function() {
        if (tableController && typeof tableController.resize === 'function') tableController.resize();
      },
      destroy: destroy,
    };
  }

  return { create: create };
});
