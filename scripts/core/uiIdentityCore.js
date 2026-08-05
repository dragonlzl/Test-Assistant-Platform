(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!root) return;
  root.app = root.app || {};
  root.app.uiIdentityCore = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function() {
  function createUiKey() {
    return 'ui-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
  }

  function ensureNonEnumerableKey(obj, keyName, value) {
    if (!obj || typeof obj !== 'object') return '';
    var has = false;
    try { has = Object.prototype.hasOwnProperty.call(obj, keyName); } catch (err) { has = false; }
    if (has) {
      try { return String(obj[keyName] || ''); } catch (err2) { return ''; }
    }
    var keyValue = value || createUiKey();
    try {
      Object.defineProperty(obj, keyName, {
        value: keyValue,
        enumerable: false,
        configurable: true,
        writable: true,
      });
    } catch (err3) {
      try { obj[keyName] = keyValue; } catch (err4) {}
    }
    return String(keyValue || '');
  }

  return {
    createUiKey: createUiKey,
    ensureNonEnumerableKey: ensureNonEnumerableKey,
  };
});
