(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.mindElixirEditActionPolicy = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var getNodeParent = typeof opts.getNodeParent === 'function'
      ? opts.getNodeParent
      : function() { return null; };

    function resolve(input) {
      var state = input && typeof input === 'object' ? input : {};
      var selectedNodes = Array.isArray(state.selectedNodes) ? state.selectedNodes : [];
      var editing = state.editing === true;
      var pendingSave = state.pendingSave === true;
      var historyIndex = Number(state.historyIndex);
      var historyLength = Number(state.historyLength);
      if (!isFinite(historyIndex)) historyIndex = -1;
      if (!isFinite(historyLength) || historyLength < 0) historyLength = 0;
      var hasRemovableNode = selectedNodes.some(function(node) {
        return Boolean(getNodeParent(node));
      });
      var actionAllowed = editing && !pendingSave;

      return {
        canAdd: actionAllowed && selectedNodes.length === 1,
        canDelete: actionAllowed && hasRemovableNode,
        canUndo: actionAllowed && historyIndex > 0,
        canRedo: actionAllowed && historyLength > 0 && historyIndex >= 0 && historyIndex < historyLength - 1,
      };
    }

    return {
      resolve: resolve,
    };
  }

  return {
    create: create,
  };
});
