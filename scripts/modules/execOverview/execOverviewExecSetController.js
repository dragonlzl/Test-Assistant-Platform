(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var model = root && root.app && root.app.execOverview
    ? root.app.execOverview.execSetModel
    : null;
  var adapterFactory = root && root.app && root.app.execOverview
    ? root.app.execOverview.execSetTableAdapter
    : null;
  var tableHost = root && root.app && root.app.ui ? root.app.ui.VTableHost : null;
  if (typeof module !== 'undefined' && module.exports) {
    model = model || require('./execOverviewExecSetModel.js');
    adapterFactory = adapterFactory || require('./execOverviewExecSetTableAdapter.js');
  }
  var api = factory(model, adapterFactory, tableHost);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.execOverview = root.app.execOverview || {};
    root.app.execOverview.execSetController = api;
  }
})(function(model, adapterFactory, defaultTableHost) {
  function positiveInteger(value, fallback) {
    var number = Number(value);
    if (!isFinite(number) || number <= 0) return fallback;
    return Math.floor(number);
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var hostEl = opts.hostEl || null;
    var searchInputEl = opts.searchInputEl || null;
    var searchClearBtnEl = opts.searchClearBtnEl || null;
    var paginationElements = [opts.paginationTopEl, opts.paginationBottomEl].filter(Boolean);
    var eventRoot = opts.eventRoot || hostEl || null;
    var tableHost = opts.tableHost || defaultTableHost;
    if (!hostEl || !tableHost || typeof tableHost.mount !== 'function' || !model || !adapterFactory) {
      throw new Error('Execution overview exec set controller dependencies are required');
    }

    var formatTime = typeof opts.formatTime === 'function'
      ? opts.formatTime
      : function(value) { return model.normalizeText(value); };
    var pageSize = model.normalizePageSize(opts.pageSize, 20);
    var records = [];
    var searchText = '';
    var pageIndex = 0;
    var phase = 'initial';
    var errorText = '';
    var tableController = null;
    var mountedEmptyText = '';
    var destroyed = false;

    function emptyText(view) {
      if (phase === 'loading') return '加载中...';
      if (phase === 'error') return errorText || '执行列表加载失败';
      if (!view.filteredRecords.length && model.normalizeSearchText(searchText) && records.length) {
        return '未找到匹配用例';
      }
      return '暂无用例';
    }

    function mount(view, nextEmptyText) {
      if (tableController && mountedEmptyText !== nextEmptyText) {
        tableController.destroy();
        tableController = null;
        mountedEmptyText = '';
      }
      if (!tableController) {
        tableController = tableHost.mount(
          hostEl,
          adapterFactory.create({
            id: opts.id || 'exec-overview-exec-set',
            caption: opts.caption || '执行列表',
            records: view.page.records,
            emptyText: nextEmptyText,
            formatTime: formatTime,
          }),
          { semanticMaxRows: 200 }
        );
        mountedEmptyText = nextEmptyText;
      } else {
        tableController.setRecords(view.page.records);
      }
    }

    function paginationHtml(view) {
      if (phase !== 'data' || !records.length || !view.filteredRecords.length) return '';
      var page = view.page;
      var currentPage = page.pageIndex + 1;
      var maxPage = Math.max(page.totalPages, 1);
      var rangeInfo = '显示 ' + (page.start + 1) + '-' + page.end + ' / 共 ' + page.total + ' 条';
      if (page.total !== view.allRecords.length) rangeInfo += '（筛选后）';
      return (
        '<div class="temp-pagination" data-exec-overview-pagination>' +
          '<div class="temp-pagination-info">' + rangeInfo + '，每页 ' + page.pageSize + ' 条</div>' +
          '<div class="temp-pagination-controls">' +
            '<button type="button" class="secondary" data-exec-overview-page="first" ' + (page.pageIndex <= 0 ? 'disabled' : '') + '>首页</button>' +
            '<button type="button" class="secondary" data-exec-overview-page="prev" ' + (page.pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
            '<button type="button" class="secondary" data-exec-overview-page="next" ' + (page.pageIndex >= page.totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
            '<button type="button" class="secondary" data-exec-overview-page="last" ' + (page.pageIndex >= page.totalPages - 1 ? 'disabled' : '') + '>末页</button>' +
            '<label>跳转</label>' +
            '<input type="number" min="1" max="' + maxPage + '" value="' + Math.min(currentPage, maxPage) + '" data-exec-overview-page-input>' +
          '</div>' +
        '</div>'
      );
    }

    function syncPagination(view) {
      var html = paginationHtml(view);
      paginationElements.forEach(function(element) { element.innerHTML = html; });
    }

    function syncSearchControls() {
      if (searchClearBtnEl) searchClearBtnEl.disabled = !model.normalizeText(searchText);
      if (searchInputEl && searchInputEl.value !== searchText) searchInputEl.value = searchText;
    }

    function render() {
      if (destroyed) return null;
      var view = model.buildView(records, searchText, pageIndex, pageSize);
      pageIndex = view.page.pageIndex;
      mount(view, emptyText(view));
      syncPagination(view);
      syncSearchControls();
      return {
        phase: phase,
        searchText: searchText,
        pageIndex: pageIndex,
        pageSize: view.page.pageSize,
        total: view.allRecords.length,
        filteredTotal: view.filteredRecords.length,
        totalPages: view.page.totalPages,
      };
    }

    function setSearch(value) {
      searchText = value === null || value === undefined ? '' : String(value);
      pageIndex = 0;
      return render();
    }

    function clearSearch() {
      return setSearch('');
    }

    function movePage(action) {
      var view = model.buildView(records, searchText, pageIndex, pageSize);
      var maxPage = Math.max(view.page.totalPages - 1, 0);
      if (action === 'first') pageIndex = 0;
      else if (action === 'prev') pageIndex -= 1;
      else if (action === 'next') pageIndex += 1;
      else if (action === 'last') pageIndex = maxPage;
      pageIndex = Math.max(0, Math.min(maxPage, pageIndex));
      return render();
    }

    function setPageFromInput(value) {
      var page = Math.floor(Number(value)) - 1;
      if (!isFinite(page) || page < 0) page = 0;
      pageIndex = page;
      return render();
    }

    function setLoading() {
      records = [];
      searchText = '';
      pageIndex = 0;
      phase = 'loading';
      errorText = '';
      return render();
    }

    function setData(nextRecords) {
      records = model.normalizeRecords(nextRecords);
      pageIndex = 0;
      phase = 'data';
      errorText = '';
      return render();
    }

    function setError(message) {
      records = [];
      pageIndex = 0;
      phase = 'error';
      errorText = model.normalizeText(message) || '执行列表加载失败';
      return render();
    }

    function reset() {
      records = [];
      searchText = '';
      pageIndex = 0;
      phase = 'initial';
      errorText = '';
      if (!tableController) {
        paginationElements.forEach(function(element) { element.innerHTML = ''; });
        syncSearchControls();
        return {
          phase: phase,
          searchText: searchText,
          pageIndex: pageIndex,
          pageSize: pageSize,
          total: 0,
          filteredTotal: 0,
          totalPages: 1,
        };
      }
      return render();
    }

    function setPageSize(value) {
      pageSize = model.normalizePageSize(value, pageSize);
      pageIndex = 0;
      if (!tableController && phase === 'initial') {
        return {
          phase: phase,
          searchText: searchText,
          pageIndex: pageIndex,
          pageSize: pageSize,
          total: 0,
          filteredTotal: 0,
          totalPages: 1,
        };
      }
      return render();
    }

    function handleSearchInput() {
      setSearch(searchInputEl ? searchInputEl.value : '');
    }

    function handleSearchClear() {
      clearSearch();
    }

    function handleClick(event) {
      var target = event && event.target && event.target.closest
        ? event.target.closest('[data-exec-overview-page]')
        : null;
      if (!target || !eventRoot || !eventRoot.contains(target)) return;
      movePage(target.getAttribute('data-exec-overview-page') || '');
    }

    function handleChange(event) {
      var target = event && event.target ? event.target : null;
      if (!target || !target.hasAttribute || !target.hasAttribute('data-exec-overview-page-input')) return;
      setPageFromInput(target.value);
    }

    if (searchInputEl) searchInputEl.addEventListener('input', handleSearchInput);
    if (searchClearBtnEl) searchClearBtnEl.addEventListener('click', handleSearchClear);
    if (eventRoot) {
      eventRoot.addEventListener('click', handleClick);
      eventRoot.addEventListener('change', handleChange);
    }

    syncSearchControls();

    return {
      setLoading: setLoading,
      setData: setData,
      setError: setError,
      reset: reset,
      setSearch: setSearch,
      clearSearch: clearSearch,
      movePage: movePage,
      setPageFromInput: setPageFromInput,
      setPageSize: setPageSize,
      render: render,
      getTableController: function() { return tableController; },
      destroy: function() {
        if (destroyed) return;
        destroyed = true;
        if (searchInputEl) searchInputEl.removeEventListener('input', handleSearchInput);
        if (searchClearBtnEl) searchClearBtnEl.removeEventListener('click', handleSearchClear);
        if (eventRoot) {
          eventRoot.removeEventListener('click', handleClick);
          eventRoot.removeEventListener('change', handleChange);
        }
        paginationElements.forEach(function(element) { element.innerHTML = ''; });
        if (tableController) tableController.destroy();
        tableController = null;
      },
    };
  }

  return { create: create };
});
