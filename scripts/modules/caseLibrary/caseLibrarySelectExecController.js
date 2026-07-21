(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var model = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.selectExecModel
    : null;
  var adapterFactory = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.selectExecTableAdapter
    : null;
  var tableHost = root && root.app && root.app.ui ? root.app.ui.VTableHost : null;
  if (typeof module !== 'undefined' && module.exports) {
    model = model || require('./caseLibrarySelectExecModel.js');
    adapterFactory = adapterFactory || require('./caseLibrarySelectExecTableAdapter.js');
  }
  var api = factory(model, adapterFactory, tableHost);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.selectExecController = api;
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
    var searchInputEl = opts.searchInputEl || null;
    var batchButtonEl = opts.batchButtonEl || null;
    var paginationElements = [opts.paginationTopEl, opts.paginationBottomEl].filter(Boolean);
    var tableHost = opts.tableHost || defaultTableHost;
    if (!hostEl || !tableHost || typeof tableHost.mount !== 'function' || !model || !adapterFactory) {
      throw new Error('Case library select exec controller dependencies are required');
    }
    var onAssociation = typeof opts.onAssociation === 'function' ? opts.onAssociation : function() {};
    var onExec = typeof opts.onExec === 'function' ? opts.onExec : function() {};
    var onAssociationToggle = typeof opts.onAssociationToggle === 'function'
      ? opts.onAssociationToggle
      : function() {};
    var onStateChange = typeof opts.onStateChange === 'function'
      ? opts.onStateChange
      : function() {};
    var adapterOptions = opts.adapterOptions && typeof opts.adapterOptions === 'object'
      ? opts.adapterOptions
      : {};
    var projectId = null;
    var versionId = null;
    var searchText = '';
    var searchPrevVersionId = null;
    var validVersionIds = [];
    var files = [];
    var execByFileId = {};
    var projectNameById = {};
    var versionNameByProject = {};
    var associationSwitchByFileId = {};
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
      var rows = model.normalizeRecords(files, {
        projectId: projectId,
        projectNameById: projectNameById,
        versionNameByProject: versionNameByProject,
        execByFileId: execByFileId,
        associationSwitchByFileId: associationSwitchByFileId,
      });
      var selectedMap = Object.create(null);
      selectedIds.forEach(function(id) { selectedMap[String(id)] = true; });
      return rows.map(function(row) {
        return Object.assign({}, row, { selected: selectedMap[String(row.id)] === true });
      });
    }

    function buildPage() {
      var rows = buildRows();
      var filtered = model.filterRecords(rows, { searchText: searchText, versionId: versionId });
      var page = model.paginate(filtered, pageIndex, pageSize);
      pageIndex = page.pageIndex;
      return { allRows: rows, filteredRows: filtered, page: page };
    }

    function emptyText(pageData) {
      if (!projectId || phase === 'initial') return '请选择项目后自动刷新。';
      if (loading) return '加载中...';
      if (!pageData.filteredRows.length) {
        return model.normalizeText(searchText) ? '未找到匹配的用例文件' : '暂无用例文件';
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
          id: opts.id || 'case-library-select-exec',
          records: records,
          emptyText: nextEmptyText,
          onSelectionChange: function(record, checked) {
            setSelected(record && record.id, checked);
          },
          onAssociationChange: function(record, checked) {
            setAssociationEnabled(record && record.id, checked);
          },
          onAssociation: function(record, payload) {
            var file = findFile(record && record.id);
            if (file) onAssociation(file, record, payload);
          },
          onExec: function(record, payload) {
            var file = findFile(record && record.id);
            if (file) onExec(file, record, payload);
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
        '<div class="temp-pagination" data-case-lib-drawer-pagination="select">' +
          '<div class="temp-pagination-info">显示 ' + displayStart + '-' + displayEnd + ' / ' + page.total + ' 条，每页 ' + page.pageSize + ' 条</div>' +
          '<div class="temp-pagination-controls">' +
            '<button type="button" class="secondary" data-select-page-action="prev" data-case-lib-drawer-page="prev" data-case-lib-drawer-scope="select" ' + (page.pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
            '<span>第 ' + currentPage + ' / ' + maxPage + ' 页</span>' +
            '<button type="button" class="secondary" data-select-page-action="next" data-case-lib-drawer-page="next" data-case-lib-drawer-scope="select" ' + (page.pageIndex >= page.totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
            '<label>跳至<input type="number" min="1" max="' + maxPage + '" value="' + currentPage + '" data-select-page-input data-case-lib-drawer-page-input data-case-lib-drawer-scope="select">页</label>' +
          '</div>' +
        '</div>'
      );
    }

    function syncPagination(page) {
      var html = paginationHtml(page);
      paginationElements.forEach(function(element) { element.innerHTML = html; });
    }

    function syncControls(pageData) {
      var pageSelection = model.getCurrentPageSelectionState(pageData.page.records, selectedIds);
      if (selectAllEl) {
        selectAllEl.checked = pageSelection.checked;
        selectAllEl.indeterminate = pageSelection.indeterminate;
        selectAllEl.disabled = loading || processing || pageSelection.disabled;
      }
      if (batchButtonEl) {
        batchButtonEl.disabled = loading || processing || selectedIds.length === 0;
      }
    }

    function stateSnapshot(pageData) {
      var data = pageData || buildPage();
      return {
        projectId: projectId,
        versionId: versionId,
        searchText: searchText,
        searchPrevVersionId: searchPrevVersionId,
        total: data.allRows.length,
        filteredTotal: data.filteredRows.length,
        pageIndex: data.page.pageIndex,
        pageSize: data.page.pageSize,
        totalPages: data.page.totalPages,
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
      searchPrevVersionId = null;
      validVersionIds = [];
      files = [];
      execByFileId = {};
      associationSwitchByFileId = {};
      selectedIds = [];
      pageIndex = 0;
      loading = false;
      processing = false;
      phase = projectId ? 'data' : 'initial';
      if (searchInputEl) searchInputEl.value = '';
      return render(true);
    }

    function setLoading(context) {
      var source = context && typeof context === 'object' ? context : {};
      projectId = optionalId(source.projectId) || projectId;
      files = [];
      execByFileId = {};
      if (source.resetAssociationSwitches === true) associationSwitchByFileId = {};
      selectedIds = [];
      pageIndex = 0;
      loading = true;
      processing = false;
      phase = 'loading';
      return render(true);
    }

    function setData(records, context) {
      var source = context && typeof context === 'object' ? context : {};
      projectId = optionalId(source.projectId) || projectId;
      files = (Array.isArray(records) ? records : []).slice();
      if (source.execByFileId && typeof source.execByFileId === 'object') {
        execByFileId = source.execByFileId;
      } else if (Array.isArray(source.execSets)) {
        execByFileId = model.normalizeExecByFileId(source.execSets);
      }
      projectNameById = source.projectNameById && typeof source.projectNameById === 'object'
        ? source.projectNameById
        : projectNameById;
      versionNameByProject = source.versionNameByProject && typeof source.versionNameByProject === 'object'
        ? source.versionNameByProject
        : versionNameByProject;
      if (Array.isArray(source.validVersionIds)) {
        validVersionIds = model.normalizeSelectionIds(source.validVersionIds);
      }
      associationSwitchByFileId = model.syncAssociationSwitchMap(files, associationSwitchByFileId);
      selectedIds = model.orderSelectionByRecords(files, selectedIds);
      loading = false;
      phase = 'data';
      return render(true);
    }

    function setVersion(value) {
      versionId = optionalId(value);
      searchPrevVersionId = null;
      pageIndex = 0;
      return render(true);
    }

    function setSearch(value) {
      searchText = model.normalizeText(value);
      if (searchText) {
        if (searchPrevVersionId === null) searchPrevVersionId = versionId;
        versionId = null;
      } else {
        if (searchPrevVersionId !== null && validVersionIds.indexOf(searchPrevVersionId) !== -1) {
          versionId = searchPrevVersionId;
        }
        searchPrevVersionId = null;
      }
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

    function setSelected(id, checked) {
      var fileId = positiveInteger(id, null);
      if (!fileId || !findFile(fileId)) return stateSnapshot();
      var next = selectedIds.slice();
      if (checked === true && next.indexOf(fileId) === -1) next.push(fileId);
      else if (checked !== true) next = next.filter(function(value) { return value !== fileId; });
      selectedIds = model.orderSelectionByRecords(files, next);
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
      return render(true);
    }

    function clearSelection() {
      selectedIds = [];
      return render(true);
    }

    function setAssociationEnabled(id, enabled) {
      var fileId = positiveInteger(id, null);
      var file = findFile(fileId);
      if (!file || !(Number(file.association_count) > 0)) return stateSnapshot();
      associationSwitchByFileId[String(fileId)] = enabled === true;
      var snapshot = render(true);
      onAssociationToggle(file, enabled === true, snapshot);
      return snapshot;
    }

    function getAssociationDecision(id) {
      var fileId = positiveInteger(id, null);
      var file = findFile(fileId);
      if (!file) return { associationEnabled: false, requiresConfirmation: false };
      return model.resolveAssociationDecision(file, associationSwitchByFileId[String(fileId)] === true);
    }

    function updateAssociationCount(id, count) {
      var fileId = positiveInteger(id, null);
      if (!fileId) return stateSnapshot();
      files = files.map(function(file) {
        if (!file || Number(file.id) !== fileId) return file;
        return Object.assign({}, file, { association_count: Math.max(0, Math.floor(Number(count) || 0)) });
      });
      associationSwitchByFileId = model.syncAssociationSwitchMap(files, associationSwitchByFileId);
      return render(true);
    }

    function setProcessing(value) {
      processing = value === true;
      return render(true);
    }

    function getSelectedFiles() {
      var selectedMap = Object.create(null);
      selectedIds.forEach(function(id) { selectedMap[String(id)] = true; });
      return files.filter(function(file) {
        return file && selectedMap[String(file.id)] === true;
      });
    }

    function handleSearchInput(event) {
      var target = event && event.target ? event.target : searchInputEl;
      setSearch(target ? target.value : '');
    }

    function handleSelectAllChange(event) {
      var target = event && event.target ? event.target : selectAllEl;
      setSelectionAll(Boolean(target && target.checked));
    }

    function handlePaginationClick(event) {
      var target = event && event.target ? event.target : null;
      var button = target && typeof target.closest === 'function'
        ? target.closest('[data-select-page-action]')
        : null;
      if (!button || typeof button.getAttribute !== 'function') return;
      var action = button.getAttribute('data-select-page-action') || '';
      var data = buildPage();
      if (action === 'prev') setPageIndex(data.page.pageIndex - 1);
      else if (action === 'next') setPageIndex(data.page.pageIndex + 1);
      else if (action === 'first') setPageIndex(0);
      else if (action === 'last') setPageIndex(data.page.totalPages - 1);
    }

    function handlePaginationChange(event) {
      var target = event && event.target ? event.target : null;
      if (!target || typeof target.getAttribute !== 'function' ||
        target.getAttribute('data-select-page-input') === null) return;
      setPageIndex(Number(target.value) - 1);
    }

    if (searchInputEl && typeof searchInputEl.addEventListener === 'function') {
      searchInputEl.addEventListener('input', handleSearchInput);
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
      searchText = '';
      searchPrevVersionId = null;
      validVersionIds = [];
      files = [];
      execByFileId = {};
      associationSwitchByFileId = {};
      selectedIds = [];
      pageIndex = 0;
      loading = false;
      processing = false;
      phase = 'initial';
      if (searchInputEl) searchInputEl.value = '';
      return render(true);
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (searchInputEl && typeof searchInputEl.removeEventListener === 'function') {
        searchInputEl.removeEventListener('input', handleSearchInput);
      }
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
      setSearch: setSearch,
      setPageIndex: setPageIndex,
      setPageSize: setPageSize,
      setSelected: setSelected,
      setSelectionAll: setSelectionAll,
      clearSelection: clearSelection,
      setAssociationEnabled: setAssociationEnabled,
      getAssociationDecision: getAssociationDecision,
      updateAssociationCount: updateAssociationCount,
      setProcessing: setProcessing,
      getSelectedFiles: getSelectedFiles,
      findFile: findFile,
      getState: function() { return stateSnapshot(); },
      getRows: function() { return buildPage().page.records.slice(); },
      getAllRows: function() { return buildRows(); },
      resize: function() {
        if (tableController && typeof tableController.resize === 'function') tableController.resize();
      },
      reset: reset,
      destroy: destroy,
    };
  }

  return { create: create };
});
