(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var model = root && root.app && root.app.caseArchive ? root.app.caseArchive.listModel : null;
  var adapterFactory = root && root.app && root.app.caseArchive ? root.app.caseArchive.listTableAdapter : null;
  var tableHost = root && root.app && root.app.ui ? root.app.ui.VTableHost : null;
  if (typeof module !== 'undefined' && module.exports) {
    model = model || require('./caseArchiveListModel.js');
    adapterFactory = adapterFactory || require('./caseArchiveListTableAdapter.js');
  }
  var api = factory(model, adapterFactory, tableHost);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseArchive = root.app.caseArchive || {};
    root.app.caseArchive.listController = api;
  }
})(function(model, adapterFactory, defaultTableHost) {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var hostEl = opts.hostEl || null;
    var emptyEl = opts.emptyEl || null;
    var paginationElements = [opts.paginationTopEl, opts.paginationBottomEl].filter(Boolean);
    var eventRoot = opts.eventRoot || hostEl || null;
    var tableHost = opts.tableHost || defaultTableHost;
    if (!hostEl || !model || !adapterFactory || !tableHost || typeof tableHost.mount !== 'function') {
      throw new Error('Case archive list controller dependencies are required');
    }

    var formatTime = typeof opts.formatTime === 'function'
      ? opts.formatTime
      : function(value) { return model.normalizeText(value); };
    var onAction = typeof opts.onAction === 'function' ? opts.onAction : function() {};
    var pageSize = model.normalizePageSize(opts.pageSize, 20);
    var records = [];
    var pageIndex = 0;
    var tableController = null;
    var destroyed = false;

    function paginationHtml(page) {
      if (!page.total) return '';
      var rangeInfo = '显示 ' + (page.start + 1) + '-' + page.end + ' / 共 ' + page.total + ' 条';
      return (
        '<div class="temp-pagination" data-case-archive-list-pagination>' +
          '<div class="temp-pagination-info">' + rangeInfo + '，每页 ' + page.pageSize + ' 条</div>' +
          '<div class="temp-pagination-controls">' +
            '<button type="button" class="secondary" data-case-archive-list-page="first" ' + (page.pageIndex <= 0 ? 'disabled' : '') + '>首页</button>' +
            '<button type="button" class="secondary" data-case-archive-list-page="prev" ' + (page.pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
            '<button type="button" class="secondary" data-case-archive-list-page="next" ' + (page.pageIndex >= page.totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
            '<button type="button" class="secondary" data-case-archive-list-page="last" ' + (page.pageIndex >= page.totalPages - 1 ? 'disabled' : '') + '>末页</button>' +
            '<label>跳转</label>' +
            '<input type="number" min="1" max="' + page.totalPages + '" value="' + (page.pageIndex + 1) + '" data-case-archive-list-page-input>' +
          '</div>' +
        '</div>'
      );
    }

    function render() {
      if (destroyed) return null;
      var page = model.paginate(records, pageIndex, pageSize);
      pageIndex = page.pageIndex;
      if (!tableController) {
        tableController = tableHost.mount(
          hostEl,
          adapterFactory.create({
            id: opts.id || 'case-archive-list',
            caption: opts.caption || '归档用例列表',
            records: page.records,
            emptyText: opts.emptyText || '暂无归档记录',
            formatTime: formatTime,
            onAction: onAction,
          }),
          { semanticMaxRows: 200 }
        );
      } else {
        tableController.setRecords(page.records);
      }
      var pagination = paginationHtml(page);
      paginationElements.forEach(function(element) { element.innerHTML = pagination; });
      if (emptyEl) emptyEl.classList.toggle('hidden', page.total > 0);
      return page;
    }

    function setData(nextRecords, metadata) {
      var meta = metadata && typeof metadata === 'object' ? metadata : {};
      records = model.normalizeRecords(nextRecords, { isAdmin: meta.isAdmin === true });
      pageIndex = 0;
      return render();
    }

    function setPageSize(value) {
      var nextPageSize = model.normalizePageSize(value, pageSize);
      if (nextPageSize === pageSize) return model.paginate(records, pageIndex, pageSize);
      pageSize = nextPageSize;
      pageIndex = 0;
      if (!tableController && !records.length) return null;
      return render();
    }

    function movePage(action) {
      var page = model.paginate(records, pageIndex, pageSize);
      var last = Math.max(0, page.totalPages - 1);
      if (action === 'first') pageIndex = 0;
      else if (action === 'prev') pageIndex -= 1;
      else if (action === 'next') pageIndex += 1;
      else if (action === 'last') pageIndex = last;
      pageIndex = Math.max(0, Math.min(last, pageIndex));
      return render();
    }

    function setPageFromInput(value) {
      var nextPage = Math.floor(Number(value)) - 1;
      if (!isFinite(nextPage)) return render();
      pageIndex = nextPage;
      return render();
    }

    function handleClick(event) {
      var target = event && event.target && event.target.closest
        ? event.target.closest('[data-case-archive-list-page]')
        : null;
      if (!target || !eventRoot || !eventRoot.contains(target)) return;
      movePage(target.getAttribute('data-case-archive-list-page') || '');
    }

    function handleChange(event) {
      var target = event && event.target ? event.target : null;
      if (!target || !target.hasAttribute || !target.hasAttribute('data-case-archive-list-page-input')) return;
      setPageFromInput(target.value);
    }

    if (eventRoot) {
      eventRoot.addEventListener('click', handleClick);
      eventRoot.addEventListener('change', handleChange);
    }

    return {
      setData: setData,
      setPageSize: setPageSize,
      movePage: movePage,
      setPageFromInput: setPageFromInput,
      render: render,
      getTableController: function() { return tableController; },
      getState: function() {
        var page = model.paginate(records, pageIndex, pageSize);
        return { pageIndex: page.pageIndex, pageSize: page.pageSize, total: page.total, totalPages: page.totalPages };
      },
      destroy: function() {
        if (destroyed) return;
        destroyed = true;
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
