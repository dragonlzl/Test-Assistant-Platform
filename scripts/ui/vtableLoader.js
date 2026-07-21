(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.ui = window.app.ui || {};
    window.app.ui.vtableLoader = api;
  }
})(function() {
  var runtimePromise = null;
  var defaultSource = './scripts/vendor/vtable.es2019.min.js';

  function getRuntime() {
    if (typeof window === 'undefined') return null;
    if (!window.VTable || typeof window.VTable.ListTable !== 'function') return null;
    return window.VTable;
  }

  function ensure(options) {
    var runtime = getRuntime();
    if (runtime) return Promise.resolve(runtime);
    if (runtimePromise) return runtimePromise;
    if (typeof document === 'undefined') {
      return Promise.reject(new Error('VTable requires a browser document'));
    }

    var opts = options || {};
    var source = String(opts.source || defaultSource);
    runtimePromise = new Promise(function(resolve, reject) {
      var existing = document.querySelector('script[data-tap-vtable-runtime="1"]');
      var script = existing || document.createElement('script');

      function cleanup() {
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
      }
      function handleLoad() {
        cleanup();
        var loadedRuntime = getRuntime();
        if (!loadedRuntime) {
          runtimePromise = null;
          reject(new Error('VTable runtime loaded without ListTable'));
          return;
        }
        resolve(loadedRuntime);
      }
      function handleError() {
        cleanup();
        runtimePromise = null;
        if (script.parentNode) script.parentNode.removeChild(script);
        reject(new Error('VTable runtime failed to load'));
      }

      script.addEventListener('load', handleLoad);
      script.addEventListener('error', handleError);
      if (!existing) {
        script.async = true;
        script.src = source;
        script.setAttribute('data-tap-vtable-runtime', '1');
        document.head.appendChild(script);
      }
    });
    return runtimePromise;
  }

  function resetForRetry() {
    if (getRuntime()) return false;
    runtimePromise = null;
    return true;
  }

  return {
    ensure: ensure,
    getRuntime: getRuntime,
    resetForRetry: resetForRetry,
    source: defaultSource,
  };
});
