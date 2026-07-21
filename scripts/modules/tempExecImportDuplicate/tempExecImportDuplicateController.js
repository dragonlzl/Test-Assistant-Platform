(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var model = root && root.app && root.app.tempExecImportDuplicate
    ? root.app.tempExecImportDuplicate.model
    : null;
  var adapterFactory = root && root.app && root.app.tempExecImportDuplicate
    ? root.app.tempExecImportDuplicate.tableAdapter
    : null;
  var tableHost = root && root.app && root.app.ui ? root.app.ui.VTableHost : null;
  if (typeof module !== 'undefined' && module.exports) {
    model = model || require('./tempExecImportDuplicateModel.js');
    adapterFactory = adapterFactory || require('./tempExecImportDuplicateTableAdapter.js');
  }
  var api = factory(model, adapterFactory, tableHost);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecImportDuplicate = root.app.tempExecImportDuplicate || {};
    root.app.tempExecImportDuplicate.controller = api;
  }
})(function(model, adapterFactory, defaultTableHost) {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var hostEl = opts.hostEl || null;
    var tableHost = opts.tableHost || defaultTableHost;
    if (!hostEl || !model || !adapterFactory || !tableHost || typeof tableHost.mount !== 'function') {
      throw new Error('Temp exec import duplicate controller dependencies are required');
    }

    var records = [];
    var tableController = null;
    var destroyed = false;

    function render() {
      if (destroyed) return 0;
      if (!tableController) {
        tableController = tableHost.mount(
          hostEl,
          adapterFactory.create({ records: records }),
          { semanticMaxRows: 200 }
        );
      } else {
        tableController.setRecords(records);
      }
      return records.length;
    }

    function setData(entries) {
      records = model.normalizeRecords(entries);
      return render();
    }

    return {
      setData: setData,
      reset: function() { return setData([]); },
      render: render,
      getRecords: function() { return records.slice(); },
      getTableController: function() { return tableController; },
      destroy: function() {
        if (destroyed) return;
        destroyed = true;
        if (tableController) tableController.destroy();
        tableController = null;
      },
    };
  }

  return { create: create };
});
