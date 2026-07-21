(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var namespace = root && root.app ? root.app.tempExecCaseLibraryDiff : null;
  var model = namespace ? namespace.model : null;
  var adapterFactory = namespace ? namespace.tableAdapter : null;
  var tableHost = root && root.app && root.app.ui ? root.app.ui.VTableHost : null;
  if (typeof module !== 'undefined' && module.exports) {
    model = model || require('./tempExecCaseLibraryDiffModel.js');
    adapterFactory = adapterFactory || require('./tempExecCaseLibraryDiffTableAdapter.js');
  }
  var api = factory(model, adapterFactory, tableHost);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecCaseLibraryDiff = root.app.tempExecCaseLibraryDiff || {};
    root.app.tempExecCaseLibraryDiff.controller = api;
  }
})(function(model, adapterFactory, defaultTableHost) {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var hostEl = opts.hostEl || null;
    var tableHost = opts.tableHost || defaultTableHost;
    var onRowActivate = typeof opts.onRowActivate === 'function'
      ? opts.onRowActivate
      : function() {};
    if (!hostEl || !model || !adapterFactory || !tableHost || typeof tableHost.mount !== 'function') {
      throw new Error('Temp exec case library diff controller dependencies are required');
    }

    var view = {
      allRecords: [],
      records: [],
      summary: model.emptySummary(),
      filter: '',
    };
    var tableController = null;
    var mountedEmptyText = '';
    var destroyed = false;

    function activate(record, payload) {
      if (!record || record.canLocate !== true) return false;
      onRowActivate(record, payload || null);
      return true;
    }

    function mount(emptyText) {
      var nextEmptyText = model.text(emptyText) || '暂无变更';
      if (tableController && mountedEmptyText !== nextEmptyText) {
        tableController.destroy();
        tableController = null;
        mountedEmptyText = '';
      }
      if (!tableController) {
        tableController = tableHost.mount(hostEl, adapterFactory.create({
          records: view.records,
          emptyText: nextEmptyText,
          onRowActivate: activate,
        }), {
          semanticMaxRows: 300,
          frozenColCount: 3,
        });
        mountedEmptyText = nextEmptyText;
      } else {
        tableController.setRecords(view.records);
      }
      return tableController;
    }

    function snapshot() {
      return {
        allRecords: view.allRecords.slice(),
        records: view.records.slice(),
        summary: Object.assign({}, view.summary),
        filter: view.filter,
      };
    }

    function setData(meta, context) {
      if (destroyed) return snapshot();
      view = model.buildView(meta, context || {});
      mount(context && context.emptyText ? context.emptyText : '暂无变更');
      return snapshot();
    }

    function setLoading() {
      if (destroyed) return snapshot();
      view = {
        allRecords: [],
        records: [],
        summary: model.emptySummary(),
        filter: '',
      };
      mount('正在同步用例变更...');
      return snapshot();
    }

    function recordFromTarget(target) {
      var element = target && typeof target.closest === 'function'
        ? target.closest('[data-case-lib-diff-row-key]')
        : null;
      if (!element || typeof element.getAttribute !== 'function') return null;
      var rowKey = element.getAttribute('data-case-lib-diff-row-key') || '';
      for (var index = 0; index < view.records.length; index += 1) {
        if (view.records[index] && view.records[index].rowKey === rowKey) return view.records[index];
      }
      return null;
    }

    function handleClick(event) {
      var record = recordFromTarget(event && event.target);
      if (record) activate(record, { source: 'semantic', event: event || null });
    }

    function handleKeydown(event) {
      var key = event && event.key ? String(event.key) : '';
      if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') return;
      var record = recordFromTarget(event && event.target);
      if (!record) return;
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      activate(record, { source: 'semantic-keyboard', event: event || null });
    }

    if (typeof hostEl.addEventListener === 'function') {
      hostEl.addEventListener('click', handleClick);
      hostEl.addEventListener('keydown', handleKeydown);
    }

    return {
      setData: setData,
      setLoading: setLoading,
      getState: snapshot,
      getRecords: function() { return view.records.slice(); },
      getTableController: function() { return tableController; },
      resize: function() {
        if (tableController && typeof tableController.resize === 'function') tableController.resize();
      },
      destroy: function() {
        if (destroyed) return;
        destroyed = true;
        if (typeof hostEl.removeEventListener === 'function') {
          hostEl.removeEventListener('click', handleClick);
          hostEl.removeEventListener('keydown', handleKeydown);
        }
        if (tableController) tableController.destroy();
        tableController = null;
        mountedEmptyText = '';
        view = {
          allRecords: [],
          records: [],
          summary: model.emptySummary(),
          filter: '',
        };
      },
    };
  }

  return { create: create };
});
