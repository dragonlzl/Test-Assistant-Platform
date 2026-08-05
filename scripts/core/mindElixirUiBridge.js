(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.mindElixirUiBridge = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var hasWindow = Object.prototype.hasOwnProperty.call(opts, 'window');
    var windowRef = hasWindow
      ? opts.window
      : (typeof window !== 'undefined' ? window : null);

    function resolveUtilsApi() {
      return windowRef && windowRef.app && windowRef.app.utils
        ? windowRef.app.utils
        : null;
    }

    function openConfirmDrawer(options) {
      var optsValue = options || {};
      var utilsApi = resolveUtilsApi();
      if (utilsApi && typeof utilsApi.openConfirmDrawer === 'function') {
        return utilsApi.openConfirmDrawer(optsValue);
      }
      var msg = optsValue && optsValue.message ? String(optsValue.message) : '';
      var ok = true;
      if (windowRef && typeof windowRef.confirm === 'function') {
        ok = windowRef.confirm(msg);
      }
      return Promise.resolve({ ok: ok });
    }

    function showToast(message, type, durationMs) {
      var text = message ? String(message) : '';
      if (!text) return;
      var utilsApi = resolveUtilsApi();
      if (utilsApi && typeof utilsApi.showCenterToast === 'function') {
        utilsApi.showCenterToast(text, type || '', durationMs || 3000);
      }
    }

    return {
      openConfirmDrawer: openConfirmDrawer,
      showToast: showToast,
    };
  }

  return { create: create };
});
