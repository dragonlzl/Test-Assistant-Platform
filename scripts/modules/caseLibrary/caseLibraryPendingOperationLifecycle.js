(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.pendingOperationLifecycle = api;
  }
})(function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    if (typeof opts.getState !== 'function') {
      throw new Error('Pending operation lifecycle state is required');
    }
    var documentRef = opts.document || (typeof document !== 'undefined' ? document : null);
    var clearTimeoutFn = opts.clearTimeout || clearTimeout;
    var setIntervalFn = opts.setInterval || setInterval;
    var clearIntervalFn = opts.clearInterval || clearInterval;
    var onUndo = typeof opts.onUndo === 'function' ? opts.onUndo : noop;
    var onCommit = typeof opts.onCommit === 'function' ? opts.onCommit : noop;
    var onClear = typeof opts.onClear === 'function' ? opts.onClear : noop;
    var countdownSeconds = Number(opts.countdownSeconds);
    if (!isFinite(countdownSeconds) || countdownSeconds <= 0) countdownSeconds = 8;

    function getState() {
      return opts.getState();
    }

    function cleanup() {
      var state = getState();
      if (!state) return;
      if (state.pendingTimer) {
        clearTimeoutFn(state.pendingTimer);
        state.pendingTimer = null;
      }
      if (state.pendingInterval) {
        clearIntervalFn(state.pendingInterval);
        state.pendingInterval = null;
      }
      if (state.pendingToast && state.pendingToast.parentNode) {
        state.pendingToast.parentNode.removeChild(state.pendingToast);
      }
      state.pendingToast = null;
      state.pendingRemaining = 0;
    }

    function clear() {
      var state = getState();
      cleanup();
      if (state) state.pendingOp = null;
      onClear();
    }

    function start(message) {
      var state = getState();
      if (!state || !documentRef || !documentRef.createElement || !documentRef.body) return null;
      cleanup();
      state.pendingRemaining = countdownSeconds;
      var toast = documentRef.createElement('div');
      toast.className = 'temp-undo-toast';
      var textEl = documentRef.createElement('span');
      var button = documentRef.createElement('button');
      button.className = 'pill secondary';
      button.textContent = '撤回';
      function renderCountdown() {
        textEl.textContent = (message || '已暂存变更') + '（' + state.pendingRemaining + 's）';
      }
      button.addEventListener('click', onUndo);
      toast.appendChild(textEl);
      toast.appendChild(button);
      documentRef.body.appendChild(toast);
      state.pendingToast = toast;
      renderCountdown();
      state.pendingInterval = setIntervalFn(function() {
        state.pendingRemaining -= 1;
        if (state.pendingRemaining <= 0) {
          clearIntervalFn(state.pendingInterval);
          state.pendingInterval = null;
          onCommit();
          return;
        }
        renderCountdown();
      }, 1000);
      return toast;
    }

    return {
      cleanup: cleanup,
      clear: clear,
      start: start,
    };
  }

  return { create: create };
});
