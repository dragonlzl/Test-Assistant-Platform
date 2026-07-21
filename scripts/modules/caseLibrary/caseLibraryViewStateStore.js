(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.viewStateStore = api;
  }
})(function() {
  var KEYS = {
    editor: 'tap-case-library-editor',
    editorBatchAddCount: 'tap-case-library-editor-batch-add-count',
    importDrawer: 'tap-case-library-import-drawer',
    lastView: 'tap-case-library-last-view',
    missingView: 'tap-case-library-missing-view',
    missingDrawer: 'tap-case-library-missing-drawer',
    selectDrawer: 'tap-case-library-select-drawer',
    editDrawer: 'tap-case-library-edit-drawer',
    loginSeq: 'tap-login-seq',
  };

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var storage = opts.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

    function readKey(key) {
      if (!storage || typeof storage.getItem !== 'function') return null;
      try {
        var raw = storage.getItem(key);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (err) {
        return null;
      }
    }

    function writeKey(key, payload) {
      if (!storage) return;
      try {
        if (!payload) {
          if (typeof storage.removeItem === 'function') storage.removeItem(key);
          return;
        }
        if (typeof storage.setItem === 'function') storage.setItem(key, JSON.stringify(payload));
      } catch (err) {
        // Storage failures must not block the active workflow.
      }
    }

    function bind(key) {
      return {
        read: function() { return readKey(key); },
        write: function(payload) { writeKey(key, payload); },
        clear: function() { writeKey(key, null); },
      };
    }

    function getCurrentLoginSeq() {
      if (!storage || typeof storage.getItem !== 'function') return '';
      try {
        return String(storage.getItem(KEYS.loginSeq) || '');
      } catch (err) {
        return '';
      }
    }

    return {
      editor: bind(KEYS.editor),
      editorBatchAddCount: bind(KEYS.editorBatchAddCount),
      importDrawer: bind(KEYS.importDrawer),
      lastView: bind(KEYS.lastView),
      missingView: bind(KEYS.missingView),
      missingDrawer: bind(KEYS.missingDrawer),
      selectDrawer: bind(KEYS.selectDrawer),
      editDrawer: bind(KEYS.editDrawer),
      getCurrentLoginSeq: getCurrentLoginSeq,
    };
  }

  return { KEYS: KEYS, create: create };
});
