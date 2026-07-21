(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var model = root && root.app && root.app.caseLibrary ? root.app.caseLibrary.editorModel : null;
  var adapterFactory = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.editorTableAdapter
    : null;
  var tableHost = root && root.app && root.app.ui ? root.app.ui.VTableHost : null;
  if (typeof module !== 'undefined' && module.exports) {
    model = model || require('./caseLibraryEditorModel.js');
    adapterFactory = adapterFactory || require('./caseLibraryEditorTableAdapter.js');
  }
  var api = factory(model, adapterFactory, tableHost);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.editorController = api;
  }
})(function(model, adapterFactory, defaultTableHost) {
  function positiveInteger(value, fallback) {
    var number = Number(value);
    if (!isFinite(number) || number <= 0) return fallback;
    return Math.max(1, Math.floor(number));
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var hostEl = opts.hostEl || null;
    var selectAllEl = opts.selectAllEl || null;
    var paginationElements = [opts.paginationTopEl, opts.paginationBottomEl].filter(Boolean);
    var tableHost = opts.tableHost || defaultTableHost;
    if (!hostEl || !tableHost || typeof tableHost.mount !== 'function' || !model || !adapterFactory) {
      throw new Error('Case library editor controller dependencies are required');
    }
    var onFieldChange = typeof opts.onFieldChange === 'function'
      ? opts.onFieldChange
      : function() {};
    var onAction = typeof opts.onAction === 'function' ? opts.onAction : function() {};
    var onSelectionChange = typeof opts.onSelectionChange === 'function'
      ? opts.onSelectionChange
      : function() {};
    var onPageChange = typeof opts.onPageChange === 'function'
      ? opts.onPageChange
      : function() {};
    var tableController = null;
    var mountedEmptyText = '';
    var items = [];
    var caseFileId = null;
    var selectedIndexes = [];
    var searchText = '';
    var pageIndex = 0;
    var pageSize = positiveInteger(opts.pageSize, 20);
    var locatedIndex = null;
    var normalizeDisplay = null;
    var isNewAdded = null;
    var destroyed = false;

    function buildRows() {
      return model.normalizeRecords(items, {
        caseFileId: caseFileId,
        selectedIndexes: selectedIndexes,
        locatedIndex: locatedIndex,
        normalizeDisplay: normalizeDisplay,
        isNewAdded: isNewAdded,
      });
    }

    function buildPage() {
      var rows = caseFileId ? buildRows() : [];
      var filteredRows = model.filterRecords(rows, searchText);
      var page = model.paginate(filteredRows, pageIndex, pageSize);
      pageIndex = page.pageIndex;
      return { rows: rows, filteredRows: filteredRows, page: page };
    }

    function emptyText(data) {
      if (!caseFileId) return '请先选择需要编辑的用例';
      if (!data.filteredRows.length && model.normalizeSearch(searchText)) return '未找到匹配的用例';
      return items.length ? '当前页暂无用例' : '未解析到有效用例';
    }

    function paginationHtml(page) {
      if (!caseFileId) return '';
      var displayStart = page.total ? page.start + 1 : 0;
      var displayEnd = page.total ? page.end : 0;
      var currentPage = page.pageIndex + 1;
      var maxPage = Math.max(page.totalPages, 1);
      var info = page.total
        ? '显示 ' + displayStart + '-' + displayEnd + ' / ' + page.total + ' 条'
        : '暂无用例';
      return (
        '<div class="temp-pagination" data-case-lib-pagination>' +
          '<div class="temp-pagination-info">' + info + '，每页 ' + page.pageSize + ' 条</div>' +
          '<div class="temp-pagination-controls">' +
            '<button type="button" class="secondary" data-case-library-editor-page-action="prev" data-case-lib-page="prev" ' + (page.pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
            '<span>第 ' + currentPage + ' / ' + maxPage + ' 页</span>' +
            '<button type="button" class="secondary" data-case-library-editor-page-action="next" data-case-lib-page="next" ' + (page.pageIndex >= page.totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
            '<label>跳至<input type="number" min="1" max="' + maxPage + '" value="' + currentPage + '" data-case-library-editor-page-input data-case-lib-page-input>页</label>' +
          '</div>' +
        '</div>'
      );
    }

    function syncControls(data) {
      var selection = model.pageSelectionState(data.page.records, selectedIndexes);
      if (selectAllEl) {
        selectAllEl.checked = selection.checked;
        selectAllEl.indeterminate = selection.indeterminate;
        selectAllEl.disabled = selection.disabled;
      }
      var html = paginationHtml(data.page);
      paginationElements.forEach(function(element) { element.innerHTML = html; });
    }

    function mount(records, nextEmptyText) {
      if (tableController && mountedEmptyText !== nextEmptyText) {
        tableController.destroy();
        tableController = null;
        mountedEmptyText = '';
      }
      if (!tableController) {
        tableController = tableHost.mount(hostEl, adapterFactory.create({
          id: opts.id || 'case-library-editor',
          records: records,
          emptyText: nextEmptyText,
          onSelectionChange: function(record, checked) {
            selectedIndexes = model.applyPageSelection(
              selectedIndexes,
              [record],
              checked === true
            );
            var snapshot = render();
            onSelectionChange(snapshot.selectedIndexes.slice(), snapshot);
          },
          onFieldChange: function(record, field, value, payload) {
            onFieldChange(record.sourceIndex, field, value, record, payload);
          },
          onAction: function(action, record, payload) {
            onAction(action, record.sourceIndex, record, payload);
          },
        }), {
          semanticMaxRows: 200,
          editCellTrigger: ['doubleclick', 'keydown'],
        });
        mountedEmptyText = nextEmptyText;
      } else {
        tableController.setRecords(records);
      }
    }

    function stateSnapshot(data) {
      var current = data || buildPage();
      return {
        caseFileId: caseFileId,
        total: current.rows.length,
        filteredTotal: current.filteredRows.length,
        pageIndex: current.page.pageIndex,
        pageSize: current.page.pageSize,
        totalPages: current.page.totalPages,
        searchText: searchText,
        selectedIndexes: selectedIndexes.slice(),
        locatedIndex: locatedIndex,
      };
    }

    function render() {
      if (destroyed) return stateSnapshot();
      var data = buildPage();
      mount(data.page.records, emptyText(data));
      syncControls(data);
      return stateSnapshot(data);
    }

    function setData(records, context) {
      var source = context && typeof context === 'object' ? context : {};
      items = Array.isArray(records) ? records.slice() : [];
      caseFileId = source.caseFileId === null || source.caseFileId === undefined
        ? null
        : source.caseFileId;
      if (Object.prototype.hasOwnProperty.call(source, 'searchText')) searchText = model.text(source.searchText);
      if (Object.prototype.hasOwnProperty.call(source, 'pageIndex')) pageIndex = Number(source.pageIndex) || 0;
      if (Object.prototype.hasOwnProperty.call(source, 'pageSize')) pageSize = positiveInteger(source.pageSize, pageSize);
      if (Object.prototype.hasOwnProperty.call(source, 'selectedIndexes')) {
        selectedIndexes = model.normalizeIndexes(source.selectedIndexes);
      }
      if (Object.prototype.hasOwnProperty.call(source, 'locatedIndex')) {
        var nextLocated = source.locatedIndex === null || source.locatedIndex === undefined
          ? NaN
          : Number(source.locatedIndex);
        locatedIndex = isFinite(nextLocated) && nextLocated >= 0 ? Math.floor(nextLocated) : null;
      }
      if (typeof source.normalizeDisplay === 'function') normalizeDisplay = source.normalizeDisplay;
      if (typeof source.isNewAdded === 'function') isNewAdded = source.isNewAdded;
      selectedIndexes = model.pruneSelection(buildRows(), selectedIndexes);
      return render();
    }

    function setSearch(value) {
      searchText = model.text(value);
      pageIndex = 0;
      return render();
    }

    function setPageIndex(value, notify) {
      pageIndex = Number(value);
      if (!isFinite(pageIndex)) pageIndex = 0;
      var snapshot = render();
      if (notify !== false) onPageChange(snapshot.pageIndex, snapshot);
      return snapshot;
    }

    function setPageSize(value) {
      pageSize = positiveInteger(value, pageSize);
      pageIndex = 0;
      return render();
    }

    function setSelection(indexes) {
      selectedIndexes = model.pruneSelection(buildRows(), indexes);
      return render();
    }

    function setLocatedIndex(value) {
      var number = value === null || value === undefined ? NaN : Number(value);
      locatedIndex = isFinite(number) && number >= 0 ? Math.floor(number) : null;
      return render();
    }

    function setPageSelection(checked) {
      var data = buildPage();
      selectedIndexes = model.applyPageSelection(selectedIndexes, data.page.records, checked === true);
      var snapshot = render();
      onSelectionChange(snapshot.selectedIndexes.slice(), snapshot);
      return snapshot;
    }

    function focusSourceIndex(sourceIndex, columnKey, edit) {
      var targetIndex = Number(sourceIndex);
      if (!isFinite(targetIndex) || targetIndex < 0) return false;
      var data = buildPage();
      var filteredIndex = data.filteredRows.findIndex(function(record) {
        return record && record.sourceIndex === targetIndex;
      });
      if (filteredIndex < 0) return false;
      pageIndex = Math.floor(filteredIndex / pageSize);
      data = buildPage();
      render();
      var record = data.filteredRows[filteredIndex];
      if (!record || !tableController || typeof tableController.focus !== 'function') return false;
      return tableController.focus({
        rowKey: record.rowKey,
        columnKey: columnKey || 'module',
        edit: edit === true,
      });
    }

    function handleSelectAllChange(event) {
      var target = event && event.target ? event.target : selectAllEl;
      setPageSelection(Boolean(target && target.checked));
    }

    function handlePaginationClick(event) {
      var target = event && event.target ? event.target : null;
      var button = target && typeof target.closest === 'function'
        ? target.closest('[data-case-library-editor-page-action]')
        : null;
      if (!button || typeof button.getAttribute !== 'function') return;
      var action = button.getAttribute('data-case-library-editor-page-action');
      var data = buildPage();
      if (action === 'prev') setPageIndex(data.page.pageIndex - 1);
      else if (action === 'next') setPageIndex(data.page.pageIndex + 1);
    }

    function handlePaginationChange(event) {
      var target = event && event.target ? event.target : null;
      if (!target || typeof target.getAttribute !== 'function' ||
        target.getAttribute('data-case-library-editor-page-input') === null) return;
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
    render();

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
      items = [];
      selectedIndexes = [];
    }

    return {
      setData: setData,
      setSearch: setSearch,
      setPageIndex: setPageIndex,
      setPageSize: setPageSize,
      setSelection: setSelection,
      setLocatedIndex: setLocatedIndex,
      setPageSelection: setPageSelection,
      focusSourceIndex: focusSourceIndex,
      getPageRows: function() { return buildPage().page.records.slice(); },
      getState: function() { return stateSnapshot(); },
      render: render,
      resize: function() {
        if (tableController && typeof tableController.resize === 'function') tableController.resize();
      },
      destroy: destroy,
    };
  }

  return { create: create };
});
