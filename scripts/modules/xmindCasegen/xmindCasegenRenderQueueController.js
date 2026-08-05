(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenRenderQueueController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var mindContainer = opts.mindContainer || null;
    var getWorkspaceShadowDepth = port('getWorkspaceShadowDepth', function() { return 0; });
    var getMindInstance = port('getMindInstance', function() { return null; });
    var getViewState = port('getViewState', function() { return {}; });
    var isDrawerOpen = port('isDrawerOpen', function() { return false; });
    var renderMind = port('render');
    var flushLightweightMindStatus = port('flushLightweightMindStatus');
    var captureCurrentViewState = port('captureCurrentViewState', function() { return getViewState(); });
    var cancelPendingViewStateCapture = port('cancelPendingViewStateCapture', function() { return false; });
    var normalizeWorkspaceRenderViewState = port('normalizeWorkspaceRenderViewState', function(value) {
      return value && value.transform ? value : null;
    });
    var captureRenderedMindAnchorStateByNodeId = port(
      'captureRenderedMindAnchorStateByNodeId',
      function() { return null; }
    );
    var scheduleTimeout = port('setTimeout', function(handler, delay) { return setTimeout(handler, delay); });
    var cancelTimeout = port('clearTimeout', function(timerId) { clearTimeout(timerId); });
    var documentObj = opts.documentObj || (typeof document !== 'undefined' ? document : null);
    var EventCtor = opts.Event || (typeof Event !== 'undefined' ? Event : null);
    var renderQueueDebounceMs = Number(opts.renderQueueDebounceMs || 120);
    var renderQueueMaxWaitMs = Number(opts.renderQueueMaxWaitMs || 500);
    var queuedMindRender = null;
    var queuedMindRenderTimer = 0;
    var queuedMindRenderDeadlineTimer = 0;
    var pendingOpenRenderHold = false;
    var pendingOpenRenderHoldTimer = 0;

    function clearPendingOpenRenderHold() {
      pendingOpenRenderHold = false;
      if (pendingOpenRenderHoldTimer) {
        cancelTimeout(pendingOpenRenderHoldTimer);
        pendingOpenRenderHoldTimer = 0;
      }
    }

    function beginPendingOpenRenderHold() {
      pendingOpenRenderHold = true;
      if (pendingOpenRenderHoldTimer) {
        cancelTimeout(pendingOpenRenderHoldTimer);
        pendingOpenRenderHoldTimer = 0;
      }
      cancelQueuedMindRender();
    }

    function releasePendingOpenRenderHold(delayMs) {
      var waitMs = Number(delayMs || 0);
      if (!Number.isFinite(waitMs) || waitMs < 0) waitMs = 0;
      if (pendingOpenRenderHoldTimer) cancelTimeout(pendingOpenRenderHoldTimer);
      pendingOpenRenderHoldTimer = scheduleTimeout(function() {
        pendingOpenRenderHoldTimer = 0;
        pendingOpenRenderHold = false;
      }, waitMs);
    }

    function isPendingOpenRenderHeld() {
      return pendingOpenRenderHold === true;
    }

    function captureRenderCarryoverViewState() {
      var currentViewState = null;
      if (getWorkspaceShadowDepth() > 0) currentViewState = getViewState();
      else if (isDrawerOpen() && getMindInstance()) currentViewState = captureCurrentViewState();
      else currentViewState = getViewState();
      return normalizeWorkspaceRenderViewState(currentViewState);
    }

    function renderWithViewportCarryover(renderOptions) {
      var source = renderOptions && typeof renderOptions === 'object' ? renderOptions : {};
      var nextOptions = {};
      Object.keys(source).forEach(function(key) { nextOptions[key] = source[key]; });
      var restoreViewState = normalizeWorkspaceRenderViewState(nextOptions.restoreViewState)
        || captureRenderCarryoverViewState();
      if (restoreViewState) {
        var anchorNodeId = String(nextOptions.anchorNodeId || '');
        var explicitAnchorState = anchorNodeId
          ? captureRenderedMindAnchorStateByNodeId(anchorNodeId)
          : null;
        if (explicitAnchorState) {
          restoreViewState.anchorState = explicitAnchorState;
          restoreViewState.skipAnchorAlign = false;
        }
        nextOptions.restoreViewState = restoreViewState;
        if (nextOptions.restoreViewStateAfterRender !== false) {
          nextOptions.restoreViewStateAfterRender = true;
        }
      }
      return renderMind(nextOptions);
    }

    function normalizeQueuedMindRenderMode(mode) {
      var name = String(mode || '').toLowerCase();
      if (name === 'terminal') return 'terminal';
      if (name === 'structure') return 'structure';
      return 'status';
    }

    function getQueuedMindRenderPriority(mode) {
      if (mode === 'terminal') return 2;
      if (mode === 'structure') return 1;
      return 0;
    }

    function cloneRenderOptionsForQueue(renderOptions) {
      var source = renderOptions && typeof renderOptions === 'object' ? renderOptions : {};
      var copy = {};
      Object.keys(source).forEach(function(key) { copy[key] = source[key]; });
      return copy;
    }

    function mergeQueuedMindRenderOptions(prevOptions, nextOptions) {
      var prev = prevOptions && typeof prevOptions === 'object' ? prevOptions : {};
      var next = nextOptions && typeof nextOptions === 'object' ? nextOptions : {};
      var merged = cloneRenderOptionsForQueue(prev);
      Object.keys(next).forEach(function(key) {
        if (key === 'persist') {
          if (next.persist === false || prev.persist === false) merged.persist = false;
          else if (next.persist === true) merged.persist = true;
          return;
        }
        if (key === 'anchorNodeId') {
          if (next.anchorNodeId || !merged.anchorNodeId) merged.anchorNodeId = next.anchorNodeId;
          return;
        }
        if (key === 'centerRootAfterRender' || key === 'restoreViewStateAfterRender'
          || key === 'skipRestorableViewState') {
          merged[key] = next[key] === true || merged[key] === true;
          return;
        }
        merged[key] = next[key];
      });
      if (prev.reason && next.reason && prev.reason !== next.reason) {
        merged.reason = String(next.reason || '') + '+batched';
      }
      return merged;
    }

    function captureMindSearchStateForRender() {
      if (!mindContainer || !mindContainer.querySelector) return null;
      var input = mindContainer.querySelector('[data-mind-search-input]');
      if (!input) return null;
      var value = String(input.value || '');
      var active = false;
      try {
        active = Boolean(documentObj && documentObj.activeElement === input);
      } catch (err) { active = false; }
      if (!value && !active) return null;
      var start = typeof input.selectionStart === 'number' ? Number(input.selectionStart) : NaN;
      var end = typeof input.selectionEnd === 'number' ? Number(input.selectionEnd) : NaN;
      return {
        value: value,
        active: active,
        start: Number.isFinite(start) ? start : NaN,
        end: Number.isFinite(end) ? end : NaN,
      };
    }

    function dispatchMindSearchInputEvent(input) {
      if (!input) return;
      try {
        if (!EventCtor) throw new Error('Event unavailable');
        input.dispatchEvent(new EventCtor('input', { bubbles: true }));
      } catch (err) {
        try {
          if (!documentObj || !documentObj.createEvent) return;
          var legacyEvent = documentObj.createEvent('Event');
          legacyEvent.initEvent('input', true, false);
          input.dispatchEvent(legacyEvent);
        } catch (err2) {}
      }
    }

    function applyMindSearchStateToInput(searchState, applyOptions) {
      if (!searchState || !mindContainer || !mindContainer.querySelector) return false;
      var input = mindContainer.querySelector('[data-mind-search-input]');
      if (!input) return false;
      var applyOpts = applyOptions && typeof applyOptions === 'object' ? applyOptions : {};
      var value = String(searchState.value || '');
      if (applyOpts.setValue !== false) input.value = value;
      else if (String(input.value || '') !== value) return false;
      dispatchMindSearchInputEvent(input);
      if (searchState.active === true && typeof input.focus === 'function') {
        try { input.focus({ preventScroll: true }); }
        catch (focusErr) {
          try { input.focus(); } catch (focusErr2) {}
        }
      }
      if (typeof input.setSelectionRange === 'function') {
        var length = String(input.value || '').length;
        var start = Number.isFinite(Number(searchState.start)) ? Number(searchState.start) : length;
        var end = Number.isFinite(Number(searchState.end)) ? Number(searchState.end) : start;
        if (start < 0) start = 0;
        if (end < 0) end = 0;
        if (start > length) start = length;
        if (end > length) end = length;
        try { input.setSelectionRange(start, end); } catch (rangeErr) {}
      }
      return true;
    }

    function restoreMindSearchStateAfterRender(searchState) {
      if (!applyMindSearchStateToInput(searchState, { setValue: true })) return;
      [32, 120, 260].forEach(function(delayMs) {
        scheduleTimeout(function() {
          applyMindSearchStateToInput(searchState, { setValue: false });
        }, delayMs);
      });
    }

    function clearQueuedMindRenderTimers() {
      if (queuedMindRenderTimer) {
        cancelTimeout(queuedMindRenderTimer);
        queuedMindRenderTimer = 0;
      }
      if (queuedMindRenderDeadlineTimer) {
        cancelTimeout(queuedMindRenderDeadlineTimer);
        queuedMindRenderDeadlineTimer = 0;
      }
    }

    function cancelQueuedMindRender() {
      queuedMindRender = null;
      clearQueuedMindRenderTimers();
    }

    function armQueuedMindRenderTimers(delayMs) {
      var waitMs = Number(delayMs || 0);
      if (!Number.isFinite(waitMs) || waitMs < 0) waitMs = renderQueueDebounceMs;
      if (queuedMindRenderTimer) cancelTimeout(queuedMindRenderTimer);
      queuedMindRenderTimer = scheduleTimeout(flushQueuedMindRender, waitMs);
      if (!queuedMindRenderDeadlineTimer) {
        queuedMindRenderDeadlineTimer = scheduleTimeout(flushQueuedMindRender, renderQueueMaxWaitMs);
      }
    }

    function flushQueuedMindRender() {
      var queued = queuedMindRender;
      queuedMindRender = null;
      clearQueuedMindRenderTimers();
      if (!queued) return;
      if (getWorkspaceShadowDepth() > 0) {
        queuedMindRender = queued;
        armQueuedMindRenderTimers(renderQueueDebounceMs);
        return;
      }
      var mode = normalizeQueuedMindRenderMode(queued.mode);
      if (mode === 'status') {
        flushLightweightMindStatus();
        return;
      }
      cancelPendingViewStateCapture();
      if (isDrawerOpen() && getMindInstance()) captureCurrentViewState();
      var renderOptions = queued.options || {};
      if (mode === 'terminal') renderWithViewportCarryover(renderOptions);
      else renderMind(renderOptions);
    }

    function scheduleQueuedMindRender(mode, renderOptions) {
      var nextMode = normalizeQueuedMindRenderMode(mode);
      var nextOptions = cloneRenderOptionsForQueue(renderOptions);
      var currentMode = queuedMindRender ? normalizeQueuedMindRenderMode(queuedMindRender.mode) : '';
      var selectedMode = getQueuedMindRenderPriority(nextMode) >= getQueuedMindRenderPriority(currentMode)
        ? nextMode : currentMode;
      queuedMindRender = {
        mode: selectedMode,
        options: mergeQueuedMindRenderOptions(queuedMindRender ? queuedMindRender.options : null, nextOptions),
      };
      armQueuedMindRenderTimers(renderQueueDebounceMs);
    }

    function queueTerminalMindRender(renderOptions) {
      if (!isDrawerOpen()) return;
      scheduleQueuedMindRender('terminal', renderOptions || {});
    }

    function queueStructureMindRender(renderOptions) {
      scheduleQueuedMindRender('structure', renderOptions || {});
    }

    function queueStatusMindRender(renderOptions) {
      scheduleQueuedMindRender('status', renderOptions || {});
    }

    return {
      beginPendingOpenRenderHold: beginPendingOpenRenderHold,
      cancelQueuedMindRender: cancelQueuedMindRender,
      captureMindSearchStateForRender: captureMindSearchStateForRender,
      clearPendingOpenRenderHold: clearPendingOpenRenderHold,
      flushQueuedMindRender: flushQueuedMindRender,
      isPendingOpenRenderHeld: isPendingOpenRenderHeld,
      mergeQueuedMindRenderOptions: mergeQueuedMindRenderOptions,
      normalizeQueuedMindRenderMode: normalizeQueuedMindRenderMode,
      queueStatusMindRender: queueStatusMindRender,
      queueStructureMindRender: queueStructureMindRender,
      queueTerminalMindRender: queueTerminalMindRender,
      releasePendingOpenRenderHold: releasePendingOpenRenderHold,
      restoreMindSearchStateAfterRender: restoreMindSearchStateAfterRender,
    };
  }

  return { create: create };
});
