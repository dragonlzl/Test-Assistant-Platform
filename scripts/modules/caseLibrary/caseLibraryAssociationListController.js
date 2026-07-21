(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var associationModel = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.associationModel
    : null;
  var adapterFactory = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.associationListTableAdapter
    : null;
  var tableHost = root && root.app && root.app.ui ? root.app.ui.VTableHost : null;
  if (typeof module !== 'undefined' && module.exports) {
    associationModel = associationModel || require('./caseLibraryAssociationModel.js');
    adapterFactory = adapterFactory || require('./caseLibraryAssociationListTableAdapter.js');
  }
  var api = factory(associationModel, adapterFactory, tableHost);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.associationListController = api;
  }
})(function(associationModel, adapterFactory, defaultTableHost) {
  function contextId(context, key) {
    var source = context && typeof context === 'object' ? context : {};
    var number = Number(source[key]);
    return isFinite(number) && number > 0 ? Math.floor(number) : null;
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var hostEl = opts.hostEl || null;
    var tableHost = opts.tableHost || defaultTableHost;
    if (!hostEl || !tableHost || typeof tableHost.mount !== 'function' ||
      !associationModel || !adapterFactory) {
      throw new Error('Case library association list controller dependencies are required');
    }

    var onEdit = typeof opts.onEdit === 'function' ? opts.onEdit : function() {};
    var onDelete = typeof opts.onDelete === 'function' ? opts.onDelete : function() {};
    var onStateChange = typeof opts.onStateChange === 'function'
      ? opts.onStateChange
      : function() {};
    var mainCaseFileId = null;
    var rows = [];
    var loading = false;
    var phase = 'initial';
    var tableController = null;
    var mountedEmptyText = '';
    var destroyed = false;

    function stateSnapshot() {
      return {
        mainCaseFileId: mainCaseFileId,
        total: rows.length,
        loading: loading,
        phase: phase,
      };
    }

    function mount(emptyText) {
      if (tableController && mountedEmptyText !== emptyText) {
        tableController.destroy();
        tableController = null;
        mountedEmptyText = '';
      }
      if (!tableController) {
        var adapterOptions = Object.assign({}, opts.adapterOptions || {}, {
          id: opts.id || 'case-library-association-list',
          records: rows,
          emptyText: emptyText,
          onEdit: function(record, payload) { onEdit(record, payload); },
          onDelete: function(record, payload) { onDelete(record, payload); },
        });
        tableController = tableHost.mount(hostEl, adapterFactory.create(adapterOptions), {
          semanticMaxRows: 200,
        });
        mountedEmptyText = emptyText;
      } else {
        tableController.setRecords(rows);
      }
    }

    function render(notify) {
      if (destroyed) return null;
      var emptyText = '暂无关联副用例';
      if (phase === 'initial') emptyText = '请选择主用例后查看关联';
      else if (loading) emptyText = '加载中...';
      mount(emptyText);
      var snapshot = stateSnapshot();
      if (notify !== false) onStateChange(snapshot);
      return snapshot;
    }

    function setLoading(context) {
      mainCaseFileId = contextId(context, 'mainCaseFileId');
      rows = [];
      loading = true;
      phase = 'loading';
      return render(true);
    }

    function setData(records, context) {
      mainCaseFileId = contextId(context, 'mainCaseFileId');
      rows = associationModel.normalizeAssociationRecords(records);
      loading = false;
      phase = 'data';
      return render(true);
    }

    function reset(context) {
      mainCaseFileId = contextId(context, 'mainCaseFileId');
      rows = [];
      loading = false;
      phase = 'initial';
      return render(true);
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (tableController) tableController.destroy();
      tableController = null;
      rows = [];
    }

    render(false);
    return {
      setLoading: setLoading,
      setData: setData,
      reset: reset,
      getState: stateSnapshot,
      getRows: function() { return rows.slice(); },
      resize: function() {
        if (tableController && typeof tableController.resize === 'function') tableController.resize();
      },
      destroy: destroy,
    };
  }

  return { create: create };
});
