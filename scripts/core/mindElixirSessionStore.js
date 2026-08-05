(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.mindElixirSessionStore = api;
  }
})(function() {
  function resolveDefaultStorage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (err) {
      return null;
    }
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var hasInjectedStorage = Object.prototype.hasOwnProperty.call(opts, 'storage');
    var storage = hasInjectedStorage ? opts.storage : resolveDefaultStorage();

    function read(storageKey) {
      if (!storageKey || !storage || typeof storage.getItem !== 'function') return null;
      try {
        var raw = storage.getItem(String(storageKey));
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (err) {
        return null;
      }
    }

    function write(storageKey, payload) {
      if (!storageKey || !storage || typeof storage.setItem !== 'function') return;
      try {
        storage.setItem(String(storageKey), JSON.stringify(payload || {}));
      } catch (err) {
        // Ignore unavailable storage and serialization failures.
      }
    }

    function clear(storageKey) {
      if (!storageKey || !storage || typeof storage.removeItem !== 'function') return;
      try {
        storage.removeItem(String(storageKey));
      } catch (err) {
        // Ignore unavailable storage.
      }
    }

    return {
      read: read,
      write: write,
      clear: clear,
    };
  }

  return { create: create };
});
