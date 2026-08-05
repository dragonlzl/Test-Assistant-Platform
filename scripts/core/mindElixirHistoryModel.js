(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.mindElixirHistoryModel = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var cloneData = typeof opts.cloneData === 'function'
      ? opts.cloneData
      : function() { return null; };
    var getSignature = typeof opts.getSignature === 'function'
      ? opts.getSignature
      : function() { return ''; };

    function createEntry(data) {
      var cloned = cloneData(data);
      if (!cloned || !cloned.nodeData) return null;
      return {
        data: cloned,
        signature: getSignature(cloned),
      };
    }

    function appendSnapshot(entries, historyIndex, data, appendOptions) {
      var entry = createEntry(data);
      if (!entry) return null;
      var list = Array.isArray(entries) ? entries : [];
      var index = Number(historyIndex);
      if (!isFinite(index)) index = -1;
      var opts1 = appendOptions && typeof appendOptions === 'object' ? appendOptions : {};
      if (opts1.reset === true) {
        return {
          entries: [entry],
          historyIndex: 0,
          changed: true,
        };
      }
      var current = list[index] || null;
      if (current && current.signature === entry.signature) {
        return {
          entries: list,
          historyIndex: index,
          changed: false,
        };
      }
      var nextEntries = list.slice(0, index + 1);
      nextEntries.push(entry);
      return {
        entries: nextEntries,
        historyIndex: nextEntries.length - 1,
        changed: true,
      };
    }

    function restoreHistory(entries, restoredIndex) {
      var list = (Array.isArray(entries) ? entries : []).map(function(entry) {
        return createEntry(entry);
      }).filter(Boolean);
      if (!list.length) return null;
      var index = Number(restoredIndex);
      if (!isFinite(index)) index = list.length - 1;
      if (index < 0) index = 0;
      if (index >= list.length) index = list.length - 1;
      return {
        entries: list,
        historyIndex: index,
      };
    }

    function buildPersistedHistory(entries, historyIndex, historyCap) {
      var list = Array.isArray(entries) ? entries : [];
      var cap = Number(historyCap);
      if (!isFinite(cap) || cap <= 0) cap = 80;
      var start = list.length > cap ? list.length - cap : 0;
      var history = list.slice(start).map(function(entry) {
        return cloneData(entry && entry.data);
      }).filter(function(entry) {
        return Boolean(entry && entry.nodeData);
      });
      var nextIndex = Number(historyIndex) - start;
      if (!isFinite(nextIndex) || nextIndex < 0) nextIndex = 0;
      if (nextIndex >= history.length) nextIndex = history.length - 1;
      if (nextIndex < 0) nextIndex = 0;
      return {
        history: history,
        historyIndex: nextIndex,
      };
    }

    return {
      createEntry: createEntry,
      appendSnapshot: appendSnapshot,
      restoreHistory: restoreHistory,
      buildPersistedHistory: buildPersistedHistory,
    };
  }

  return {
    create: create,
  };
});
