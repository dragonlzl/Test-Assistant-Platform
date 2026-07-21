(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var associationModel = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.associationModel
    : null;
  var adapterFactory = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.associationCandidateTableAdapter
    : null;
  var tableHost = root && root.app && root.app.ui ? root.app.ui.VTableHost : null;
  if (typeof module !== 'undefined' && module.exports) {
    associationModel = associationModel || require('./caseLibraryAssociationModel.js');
    adapterFactory = adapterFactory || require('./caseLibraryAssociationCandidateTableAdapter.js');
  }
  var api = factory(associationModel, adapterFactory, tableHost);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.associationCandidateController = api;
  }
})(function(associationModel, adapterFactory, defaultTableHost) {
  function positiveId(value) {
    var number = Number(value);
    if (!isFinite(number) || number <= 0 || Math.floor(number) !== number) return null;
    return number;
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var hostEl = opts.hostEl || null;
    var searchInputEl = opts.searchInputEl || null;
    var tableHost = opts.tableHost || defaultTableHost;
    if (!hostEl || !tableHost || typeof tableHost.mount !== 'function' ||
      !associationModel || !adapterFactory) {
      throw new Error('Case library association candidate controller dependencies are required');
    }

    var onSelect = typeof opts.onSelect === 'function' ? opts.onSelect : function() {};
    var onStateChange = typeof opts.onStateChange === 'function'
      ? opts.onStateChange
      : function() {};
    var mainCaseFileId = null;
    var selectedCandidateId = null;
    var rows = [];
    var searchText = '';
    var loading = false;
    var phase = 'initial';
    var tableController = null;
    var mountedEmptyText = '';
    var destroyed = false;

    function visibleRows() {
      return associationModel.filterCandidateRecords(rows, searchText);
    }

    function stateSnapshot() {
      return {
        mainCaseFileId: mainCaseFileId,
        selectedCandidateId: selectedCandidateId,
        searchText: searchText,
        total: rows.length,
        filteredTotal: visibleRows().length,
        loading: loading,
        phase: phase,
      };
    }

    function mount(records, emptyText) {
      if (tableController && mountedEmptyText !== emptyText) {
        tableController.destroy();
        tableController = null;
        mountedEmptyText = '';
      }
      if (!tableController) {
        var adapterOptions = Object.assign({}, opts.adapterOptions || {}, {
          id: opts.id || 'case-library-association-candidates',
          records: records,
          emptyText: emptyText,
          getVersionName: opts.getVersionName,
          onSelect: selectRecord,
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
      var records = visibleRows();
      var emptyText = '暂无可选副用例';
      if (phase === 'initial') emptyText = '请先选择版本并查询';
      else if (loading) emptyText = '加载中...';
      mount(records, emptyText);
      var snapshot = stateSnapshot();
      if (notify !== false) onStateChange(snapshot);
      return snapshot;
    }

    function selectRecord(record, payload) {
      if (!record || record.forbidden === true) return false;
      var candidateId = positiveId(record.id);
      if (!candidateId) return false;
      selectedCandidateId = candidateId;
      rows = rows.map(function(row) {
        return Object.assign({}, row, { selected: row.id === candidateId });
      });
      render(true);
      onSelect(record, payload);
      return true;
    }

    function setLoading(context) {
      var source = context && typeof context === 'object' ? context : {};
      mainCaseFileId = positiveId(source.mainCaseFileId);
      selectedCandidateId = positiveId(source.selectedCandidateId);
      rows = [];
      loading = true;
      phase = 'loading';
      return render(true);
    }

    function setData(records, context) {
      var source = context && typeof context === 'object' ? context : {};
      mainCaseFileId = positiveId(source.mainCaseFileId);
      selectedCandidateId = positiveId(source.selectedCandidateId);
      rows = associationModel.normalizeCandidateRecords(records, {
        mainCaseFileId: mainCaseFileId,
        selectedCandidateId: selectedCandidateId,
      });
      loading = false;
      phase = 'data';
      return render(true);
    }

    function setSearch(value) {
      searchText = value === null || value === undefined ? '' : String(value);
      if (searchInputEl && searchInputEl.value !== searchText) searchInputEl.value = searchText;
      return render(true);
    }

    function setSelectedCandidateId(value) {
      var candidateId = positiveId(value);
      var record = rows.filter(function(row) { return row.id === candidateId; })[0] || null;
      if (!record) {
        selectedCandidateId = null;
        rows = rows.map(function(row) { return Object.assign({}, row, { selected: false }); });
        return render(true);
      }
      selectRecord(record, null);
      return stateSnapshot();
    }

    function reset(context) {
      var source = context && typeof context === 'object' ? context : {};
      mainCaseFileId = positiveId(source.mainCaseFileId);
      selectedCandidateId = null;
      rows = [];
      searchText = '';
      loading = false;
      phase = 'initial';
      if (searchInputEl) searchInputEl.value = '';
      return render(true);
    }

    function handleSearchInput(event) {
      var target = event && event.target ? event.target : searchInputEl;
      setSearch(target ? target.value : '');
    }

    if (searchInputEl && typeof searchInputEl.addEventListener === 'function') {
      searchInputEl.addEventListener('input', handleSearchInput);
    }
    render(false);

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (searchInputEl && typeof searchInputEl.removeEventListener === 'function') {
        searchInputEl.removeEventListener('input', handleSearchInput);
      }
      if (tableController) tableController.destroy();
      tableController = null;
      rows = [];
    }

    return {
      setLoading: setLoading,
      setData: setData,
      setSearch: setSearch,
      setSelectedCandidateId: setSelectedCandidateId,
      reset: reset,
      getState: stateSnapshot,
      getRows: function() { return rows.slice(); },
      getVisibleRows: function() { return visibleRows().slice(); },
      resize: function() {
        if (tableController && typeof tableController.resize === 'function') tableController.resize();
      },
      destroy: destroy,
    };
  }

  return { create: create };
});
