(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var historyModel = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.historyModel
    : null;
  var adapterFactory = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.historyDetailTableAdapter
    : null;
  var tableHost = root && root.app && root.app.ui ? root.app.ui.VTableHost : null;
  if (typeof module !== 'undefined' && module.exports) {
    historyModel = historyModel || require('./caseLibraryHistoryModel.js');
    adapterFactory = adapterFactory || require('./caseLibraryHistoryDetailTableAdapter.js');
  }
  var api = factory(historyModel, adapterFactory, tableHost);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.historyDetailController = api;
  }
})(function(historyModel, adapterFactory, defaultTableHost) {
  function positiveInteger(value, fallback) {
    var number = Number(value);
    if (!isFinite(number) || number <= 0) return fallback;
    return Math.max(1, Math.floor(number));
  }

  function paginationHtml(page) {
    if (!page) return '';
    var range = page.total
      ? '显示 ' + (page.start + 1) + '-' + page.end + ' / 共 ' + page.total + ' 条'
      : '暂无记录';
    return (
      '<div class="temp-pagination" data-case-lib-history-pagination>' +
        '<div class="temp-pagination-info">' + range + '，每页 ' + page.pageSize + ' 条</div>' +
        '<div class="temp-pagination-controls">' +
          '<button type="button" class="secondary" data-history-page-action="prev" ' +
            'data-case-lib-history-page="prev" ' +
            (page.pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
          '<button type="button" class="secondary" data-history-page-action="next" ' +
            'data-case-lib-history-page="next" ' +
            (page.pageIndex >= page.totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
          '<label>跳转</label>' +
          '<input type="number" min="1" max="' + page.totalPages + '" value="' +
            (page.pageIndex + 1) + '" data-history-page-input="1" ' +
            'data-case-lib-history-page-input>' +
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
      throw new Error('Case library history detail controller dependencies are required');
    }

    var filterElements = Array.isArray(opts.filterElements)
      ? opts.filterElements.filter(function(element) { return Boolean(element); })
      : [];
    var paginationElements = [opts.paginationTopEl, opts.paginationBottomEl].filter(function(element) {
      return Boolean(element);
    });
    var onStateChange = typeof opts.onStateChange === 'function'
      ? opts.onStateChange
      : function() {};
    var rows = [];
    var fileNameClean = '';
    var filter = '';
    var pageIndex = 0;
    var pageSize = positiveInteger(opts.pageSize, 20);
    var loading = false;
    var tableController = null;
    var mountedEmptyText = '';
    var destroyed = false;
    var filterListeners = [];

    function buildPage() {
      var visible = historyModel.filterDetailRecords(rows, filter);
      var requestedPageIndex = pageIndex;
      var page = historyModel.paginate(visible, pageIndex, pageSize);
      if (loading) {
        if (!isFinite(Number(requestedPageIndex))) requestedPageIndex = 0;
        pageIndex = Math.max(0, Math.floor(Number(requestedPageIndex)));
        page.pageIndex = pageIndex;
      } else {
        pageIndex = page.pageIndex;
      }
      page.filteredRecords = visible;
      return page;
    }

    function stateSnapshot(page) {
      var current = page || buildPage();
      return {
        fileNameClean: fileNameClean,
        filter: filter,
        pageIndex: current.pageIndex,
        pageSize: current.pageSize,
        total: rows.length,
        filteredTotal: current.total,
        totalPages: current.totalPages,
        loading: loading,
      };
    }

    function syncFilters() {
      var summary = historyModel.summarizeDetailRecords(rows);
      filterElements.forEach(function(element) {
        if (!element || typeof element.getAttribute !== 'function') return;
        var kind = historyModel.normalizeKind(element.getAttribute('data-case-lib-history-filter'));
        var meta = historyModel.getKindMeta(kind);
        element.textContent = meta.label + ' ' + (summary[kind] || 0);
        if (element.classList && typeof element.classList.toggle === 'function') {
          element.classList.toggle('active', filter === kind);
        }
      });
      return summary;
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
          id: opts.id || 'case-library-history-detail',
          records: records,
          emptyText: emptyText,
        });
        tableController = tableHost.mount(hostEl, adapterFactory.create(adapterOptions), {
          semanticMaxRows: 200,
          frozenColCount: 1,
        });
        mountedEmptyText = emptyText;
      } else {
        tableController.setRecords(records);
      }
    }

    function render(notify) {
      if (destroyed) return null;
      var page = buildPage();
      mount(page.records, loading ? '加载中...' : '暂无历史记录');
      syncFilters();
      syncPagination(page);
      var snapshot = stateSnapshot(page);
      if (notify !== false) onStateChange(snapshot);
      return snapshot;
    }

    function applyContext(context) {
      var source = context && typeof context === 'object' ? context : {};
      if (Object.prototype.hasOwnProperty.call(source, 'fileNameClean')) {
        fileNameClean = historyModel.normalizeText(source.fileNameClean);
      }
      if (Object.prototype.hasOwnProperty.call(source, 'filter')) {
        filter = historyModel.normalizeKind(source.filter);
      }
      if (Object.prototype.hasOwnProperty.call(source, 'pageIndex')) {
        pageIndex = Number(source.pageIndex);
        if (!isFinite(pageIndex)) pageIndex = 0;
      }
    }

    function setLoading(context) {
      var hasPageIndex = Boolean(
        context && typeof context === 'object' &&
        Object.prototype.hasOwnProperty.call(context, 'pageIndex')
      );
      applyContext(context);
      loading = true;
      rows = [];
      if (!hasPageIndex) pageIndex = 0;
      return render(true);
    }

    function setData(records, context) {
      applyContext(context);
      rows = historyModel.normalizeDetailRecords(records, { fileNameClean: fileNameClean });
      loading = false;
      if (!context || !Object.prototype.hasOwnProperty.call(context, 'pageIndex')) pageIndex = 0;
      return render(true);
    }

    function setFilter(value) {
      var normalized = historyModel.normalizeKind(value);
      filter = filter === normalized ? '' : normalized;
      pageIndex = 0;
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

    filterElements.forEach(function(element) {
      if (typeof element.addEventListener !== 'function') return;
      var listener = function(event) {
        var current = event && event.currentTarget ? event.currentTarget : element;
        var value = current && typeof current.getAttribute === 'function'
          ? current.getAttribute('data-case-lib-history-filter')
          : '';
        setFilter(value);
      };
      element.addEventListener('click', listener);
      filterListeners.push({ element: element, listener: listener });
    });
    paginationElements.forEach(function(element) {
      if (typeof element.addEventListener !== 'function') return;
      element.addEventListener('click', handlePaginationClick);
      element.addEventListener('change', handlePaginationChange);
    });
    render(false);

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      filterListeners.forEach(function(binding) {
        if (typeof binding.element.removeEventListener === 'function') {
          binding.element.removeEventListener('click', binding.listener);
        }
      });
      filterListeners = [];
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
      setFilter: setFilter,
      setPageIndex: setPageIndex,
      setPageSize: setPageSize,
      getState: function() { return stateSnapshot(); },
      getRows: function() { return rows.slice(); },
      getSummary: function() { return historyModel.summarizeDetailRecords(rows); },
      getPageRecords: function() { return buildPage().records.slice(); },
      resize: function() {
        if (tableController && typeof tableController.resize === 'function') tableController.resize();
      },
      destroy: destroy,
    };
  }

  return { create: create };
});
