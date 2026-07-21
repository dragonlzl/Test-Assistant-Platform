(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var model = root && root.app && root.app.caseLibrary ? root.app.caseLibrary.editListModel : null;
  var adapterFactory = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.editListTableAdapter
    : null;
  var tableHost = root && root.app && root.app.ui ? root.app.ui.VTableHost : null;
  if (typeof module !== 'undefined' && module.exports) {
    model = model || require('./caseLibraryEditListModel.js');
    adapterFactory = adapterFactory || require('./caseLibraryEditListTableAdapter.js');
  }
  var api = factory(model, adapterFactory, tableHost);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.editListController = api;
  }
})(function(model, adapterFactory, defaultTableHost) {
  function positiveInteger(value, fallback) {
    var number = Number(value);
    if (!isFinite(number) || number <= 0 || Math.floor(number) !== number) return fallback;
    return number;
  }

  function optionalId(value) {
    if (value === null || value === undefined || value === '') return null;
    return positiveInteger(value, null);
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var hostEl = opts.hostEl || null;
    var selectAllEl = opts.selectAllEl || null;
    var paginationElements = [opts.paginationTopEl, opts.paginationBottomEl].filter(Boolean);
    var actionButtonEls = Array.isArray(opts.actionButtonEls) ? opts.actionButtonEls.filter(Boolean) : [];
    var deleteButtonEl = opts.deleteButtonEl || null;
    var changeVersionSelectEl = opts.changeVersionSelectEl || null;
    var changeVersionButtonEl = opts.changeVersionButtonEl || null;
    var tableHost = opts.tableHost || defaultTableHost;
    if (!hostEl || !tableHost || typeof tableHost.mount !== 'function' || !model || !adapterFactory) {
      throw new Error('Case library edit list controller dependencies are required');
    }
    var onEdit = typeof opts.onEdit === 'function' ? opts.onEdit : function() {};
    var onStateChange = typeof opts.onStateChange === 'function' ? opts.onStateChange : function() {};
    var onSelectionChange = typeof opts.onSelectionChange === 'function'
      ? opts.onSelectionChange
      : function() {};
    var canDelete = typeof opts.canDelete === 'function' ? opts.canDelete : function() { return false; };
    var adapterOptions = opts.adapterOptions && typeof opts.adapterOptions === 'object'
      ? opts.adapterOptions
      : {};
    var projectId = null;
    var versionId = null;
    var ownerFilter = 'all';
    var ownerFilterTouched = false;
    var searchText = '';
    var currentUserId = null;
    var files = [];
    var context = {};
    var selectedIds = [];
    var pageIndex = 0;
    var pageSize = positiveInteger(opts.pageSize, 10);
    var loading = false;
    var processing = false;
    var phase = 'initial';
    var tableController = null;
    var mountedEmptyText = '';
    var destroyed = false;

    function findFile(id) {
      var fileId = positiveInteger(id, null);
      if (!fileId) return null;
      return files.find(function(file) { return file && Number(file.id) === fileId; }) || null;
    }

    function buildRows() {
      var rows = model.normalizeRecords(files, Object.assign({}, context, { projectId: projectId }));
      var selectedMap = Object.create(null);
      selectedIds.forEach(function(id) { selectedMap[String(id)] = true; });
      return rows.map(function(row) {
        return Object.assign({}, row, { selected: selectedMap[String(row.id)] === true });
      });
    }

    function buildPage() {
      var rows = buildRows();
      var visibleRows = model.filterRecords(rows, {
        versionId: versionId,
        ownerFilter: ownerFilter,
        currentUserId: currentUserId,
        searchText: searchText,
      });
      var page = model.paginate(visibleRows, pageIndex, pageSize);
      pageIndex = page.pageIndex;
      return { allRows: rows, visibleRows: visibleRows, page: page };
    }

    function emptyText(pageData) {
      if (!projectId || phase === 'initial') return '请选择项目后自动刷新。';
      if (loading) return '加载中...';
      if (!pageData.visibleRows.length) {
        if (model.normalizeText(searchText)) return '未找到匹配的用例文件';
        if (versionId) return '该版本暂无用例文件';
        return '暂无用例文件';
      }
      return '暂无用例文件';
    }

    function mount(records, nextEmptyText) {
      if (tableController && mountedEmptyText !== nextEmptyText) {
        tableController.destroy();
        tableController = null;
        mountedEmptyText = '';
      }
      if (!tableController) {
        var tableOptions = Object.assign({}, adapterOptions, {
          id: opts.id || 'case-library-edit-list',
          records: records,
          emptyText: nextEmptyText,
          onSelectionChange: function(record, checked) {
            setSelected(record && record.id, checked);
          },
          onEdit: function(record, payload) {
            var file = findFile(record && record.id);
            if (file) onEdit(file, record, payload);
          },
        });
        tableController = tableHost.mount(hostEl, adapterFactory.create(tableOptions), {
          semanticMaxRows: 200,
        });
        mountedEmptyText = nextEmptyText;
      } else {
        tableController.setRecords(records);
      }
    }

    function paginationHtml(page) {
      if (!projectId || loading || !page.total) return '';
      var displayStart = page.total ? page.start + 1 : 0;
      var displayEnd = page.total ? page.end : 0;
      var maxPage = Math.max(page.totalPages, 1);
      var currentPage = page.pageIndex + 1;
      return (
        '<div class="temp-pagination" data-case-lib-drawer-pagination="edit">' +
          '<div class="temp-pagination-info">显示 ' + displayStart + '-' + displayEnd + ' / ' + page.total + ' 条，每页 ' + page.pageSize + ' 条</div>' +
          '<div class="temp-pagination-controls">' +
            '<button type="button" class="secondary" data-edit-list-page-action="prev" data-case-lib-drawer-page="prev" data-case-lib-drawer-scope="edit" ' + (page.pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
            '<span>第 ' + currentPage + ' / ' + maxPage + ' 页</span>' +
            '<button type="button" class="secondary" data-edit-list-page-action="next" data-case-lib-drawer-page="next" data-case-lib-drawer-scope="edit" ' + (page.pageIndex >= page.totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
            '<label>跳至<input type="number" min="1" max="' + maxPage + '" value="' + currentPage + '" data-edit-list-page-input data-case-lib-drawer-page-input data-case-lib-drawer-scope="edit">页</label>' +
          '</div>' +
        '</div>'
      );
    }

    function syncPagination(page) {
      var html = paginationHtml(page);
      paginationElements.forEach(function(element) { element.innerHTML = html; });
    }

    function syncControls(pageData) {
      var data = pageData || buildPage();
      var pageSelection = model.getCurrentPageSelectionState(data.page.records, selectedIds);
      if (selectAllEl) {
        selectAllEl.checked = pageSelection.checked;
        selectAllEl.indeterminate = pageSelection.indeterminate;
        selectAllEl.disabled = loading || processing || pageSelection.disabled;
      }
      var hasSelection = selectedIds.length > 0;
      actionButtonEls.forEach(function(button) {
        button.disabled = loading || processing || !hasSelection;
      });
      if (deleteButtonEl) {
        deleteButtonEl.disabled = !canDelete() || loading || processing || !hasSelection;
      }
      if (changeVersionButtonEl) {
        var targetVersionId = optionalId(changeVersionSelectEl ? changeVersionSelectEl.value : '');
        var selectDisabled = Boolean(changeVersionSelectEl && changeVersionSelectEl.disabled);
        changeVersionButtonEl.disabled = loading || processing || !hasSelection || !targetVersionId || selectDisabled;
      }
      return data;
    }

    function stateSnapshot(pageData) {
      var data = pageData || buildPage();
      var summary = model.summarize(data.visibleRows);
      return {
        projectId: projectId,
        versionId: versionId,
        ownerFilter: ownerFilter,
        ownerFilterTouched: ownerFilterTouched,
        searchText: searchText,
        currentUserId: currentUserId,
        total: data.allRows.length,
        filteredTotal: data.visibleRows.length,
        fileCount: summary.fileCount,
        itemCount: summary.itemCount,
        pageIndex: data.page.pageIndex,
        pageSize: data.page.pageSize,
        totalPages: data.page.totalPages,
        selectedIds: selectedIds.slice(),
        selectedCount: selectedIds.length,
        loading: loading,
        processing: processing,
        phase: phase,
      };
    }

    function render(notify) {
      if (destroyed) return null;
      var data = buildPage();
      mount(data.page.records, emptyText(data));
      syncPagination(data.page);
      syncControls(data);
      var snapshot = stateSnapshot(data);
      if (notify !== false) onStateChange(snapshot);
      return snapshot;
    }

    function setProject(value) {
      projectId = optionalId(value);
      versionId = null;
      searchText = '';
      files = [];
      context = {};
      selectedIds = [];
      pageIndex = 0;
      loading = false;
      processing = false;
      phase = projectId ? 'data' : 'initial';
      return render(true);
    }

    function setLoading(nextContext) {
      var source = nextContext && typeof nextContext === 'object' ? nextContext : {};
      projectId = optionalId(source.projectId) || projectId;
      files = [];
      context = Object.assign({}, context, source);
      if (source.preserveSelection !== true) selectedIds = [];
      pageIndex = 0;
      loading = true;
      processing = false;
      phase = 'loading';
      return render(true);
    }

    function setData(records, nextContext) {
      var source = nextContext && typeof nextContext === 'object' ? nextContext : {};
      projectId = optionalId(source.projectId) || projectId;
      currentUserId = optionalId(source.currentUserId) || currentUserId;
      files = (Array.isArray(records) ? records : []).slice();
      context = Object.assign({}, context, source);
      var data = buildPage();
      selectedIds = model.pruneSelection(data.visibleRows, selectedIds);
      loading = false;
      phase = 'data';
      return render(true);
    }

    function setVersion(value) {
      versionId = optionalId(value);
      selectedIds = [];
      pageIndex = 0;
      return render(true);
    }

    function setOwnerFilter(value, touched) {
      ownerFilter = model.normalizeOwnerFilter(value);
      if (touched !== false) ownerFilterTouched = true;
      pageIndex = 0;
      var data = buildPage();
      selectedIds = model.pruneSelection(data.visibleRows, selectedIds);
      return render(true);
    }

    function setSearch(value) {
      searchText = model.normalizeText(value);
      pageIndex = 0;
      var data = buildPage();
      selectedIds = model.pruneSelection(data.visibleRows, selectedIds);
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

    function setSelected(id, checked) {
      var fileId = positiveInteger(id, null);
      if (!fileId || !findFile(fileId)) return stateSnapshot();
      var next = selectedIds.filter(function(value) { return value !== fileId; });
      if (checked === true) next.push(fileId);
      selectedIds = model.orderSelectionByRecords(buildRows(), next);
      var snapshot = render(true);
      onSelectionChange(snapshot);
      return snapshot;
    }

    function setSelection(ids) {
      selectedIds = model.orderSelectionByRecords(buildRows(), ids);
      return render(true);
    }

    function setSelectionAll(checked) {
      var data = buildPage();
      selectedIds = model.applyCurrentPageSelection(
        data.allRows,
        selectedIds,
        data.page.records,
        checked === true
      );
      var snapshot = render(true);
      onSelectionChange(snapshot);
      return snapshot;
    }

    function clearSelection() {
      selectedIds = [];
      return render(true);
    }

    function setProcessing(value) {
      processing = value === true;
      return render(true);
    }

    function getFilesFromRows(rows) {
      var filesById = Object.create(null);
      files.forEach(function(file) {
        if (file && file.id !== null && file.id !== undefined) filesById[String(file.id)] = file;
      });
      return (Array.isArray(rows) ? rows : []).map(function(row) {
        return filesById[String(row && row.id)] || null;
      }).filter(Boolean);
    }

    function getSelectedFiles() {
      var selectedMap = Object.create(null);
      selectedIds.forEach(function(id) { selectedMap[String(id)] = true; });
      return files.filter(function(file) {
        return file && selectedMap[String(file.id)] === true;
      });
    }

    function getVisibleFiles() {
      return getFilesFromRows(buildPage().visibleRows);
    }

    function handleSelectAllChange(event) {
      var target = event && event.target ? event.target : selectAllEl;
      setSelectionAll(Boolean(target && target.checked));
    }

    function handlePaginationClick(event) {
      var target = event && event.target ? event.target : null;
      var button = target && typeof target.closest === 'function'
        ? target.closest('[data-edit-list-page-action]')
        : null;
      if (!button || typeof button.getAttribute !== 'function') return;
      var action = button.getAttribute('data-edit-list-page-action') || '';
      var data = buildPage();
      if (action === 'prev') setPageIndex(data.page.pageIndex - 1);
      else if (action === 'next') setPageIndex(data.page.pageIndex + 1);
      else if (action === 'first') setPageIndex(0);
      else if (action === 'last') setPageIndex(data.page.totalPages - 1);
    }

    function handlePaginationChange(event) {
      var target = event && event.target ? event.target : null;
      if (!target || typeof target.getAttribute !== 'function' ||
        target.getAttribute('data-edit-list-page-input') === null) return;
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

    function reset() {
      projectId = null;
      versionId = null;
      ownerFilter = 'all';
      ownerFilterTouched = false;
      searchText = '';
      currentUserId = null;
      files = [];
      context = {};
      selectedIds = [];
      pageIndex = 0;
      loading = false;
      processing = false;
      phase = 'initial';
      return render(true);
    }

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
      files = [];
      selectedIds = [];
    }

    return {
      setProject: setProject,
      setLoading: setLoading,
      setData: setData,
      setVersion: setVersion,
      setOwnerFilter: setOwnerFilter,
      setSearch: setSearch,
      setPageIndex: setPageIndex,
      setPageSize: setPageSize,
      setSelected: setSelected,
      setSelection: setSelection,
      setSelectionAll: setSelectionAll,
      clearSelection: clearSelection,
      setProcessing: setProcessing,
      getSelectedFiles: getSelectedFiles,
      getVisibleFiles: getVisibleFiles,
      findFile: findFile,
      getFiles: function() { return files.slice(); },
      getPageRows: function() { return buildPage().page.records.slice(); },
      getPageData: function() { return buildPage().page; },
      getState: function() { return stateSnapshot(); },
      syncControls: function() { return syncControls(buildPage()); },
      render: function() { return render(true); },
      resize: function() {
        if (tableController && typeof tableController.resize === 'function') tableController.resize();
      },
      reset: reset,
      destroy: destroy,
    };
  }

  return { create: create };
});
