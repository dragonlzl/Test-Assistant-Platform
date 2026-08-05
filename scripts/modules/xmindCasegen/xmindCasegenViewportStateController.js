(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenViewportStateController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var mindContainer = opts.mindContainer || null;
    var drawerEl = opts.drawerEl || null;
    var cloneJson = port('cloneJson', function(value, fallback) { return value || fallback; });
    var normalizeUniqueStringList = port('normalizeUniqueStringList', function(items) {
      return Array.isArray(items) ? items.slice() : [];
    });
    var normalizeModuleKey = port('normalizeModuleKey', function(value) { return String(value || ''); });
    var normalizeCaseTitle = port('normalizeCaseTitle', function(value) { return String(value || ''); });
    var normalizeStoredViewState = port('normalizeStoredViewState', function(value) { return value || {}; });
    var createDefaultViewState = port('createDefaultViewState', function() { return {}; });
    var ensureState = port('ensureState', function() { return {}; });
    var getHostState = port('getHostState', function() { return {}; });
    var getWorkspaceShadowDepth = port('getWorkspaceShadowDepth', function() { return 0; });
    var getWorkspaceUiMutedDepth = port('getWorkspaceUiMutedDepth', function() { return 0; });
    var getMindInstance = port('getMindInstance', function() { return null; });
    var getCurrentMindData = port('getCurrentMindData', function() { return null; });
    var isDrawerOpen = port('isDrawerOpen', function() { return false; });
    var getRequirementLabelText = port('getRequirementLabelText', function() { return ''; });
    var persistXmindState = port('persistXmindState');
    var scheduleTopupHighlightSync = port('scheduleTopupHighlightSync');
    var findRenderedMindNodeByStableId = port('findRenderedMindNodeByStableId', function() { return null; });
    var getRootNodeId = port('getRootNodeId', function() { return ''; });
    var getMindElixirCoreApi = port('getMindElixirCoreApi', function() { return null; });
    var scheduleTimeout = port('setTimeout', function(handler, delay) { return setTimeout(handler, delay); });
    var cancelTimeout = port('clearTimeout', function(timerId) { clearTimeout(timerId); });
    var now = port('now', function() { return Date.now(); });
    var windowObj = opts.windowObj || (typeof window !== 'undefined' ? window : null);
    var MutationObserverCtor = opts.MutationObserver
      || (typeof MutationObserver !== 'undefined' ? MutationObserver : null);

    var viewStateCaptureDebounceMs = Number(opts.viewStateCaptureDebounceMs || 300);
    var interactionCaptureDebounceMs = Number(opts.interactionCaptureDebounceMs || 520);
    var manualGestureMs = Number(opts.manualGestureMs || 260);
    var viewStatePersistTimer = 0;
    var viewStateMutationObserver = null;
    var viewStateScrollTarget = null;
    var viewStateScrollHandler = null;
    var viewStateInteractionTarget = null;
    var viewStateClickHandler = null;
    var viewStateWheelHandler = null;
    var viewStatePointerDownHandler = null;
    var viewStatePointerUpHandler = null;
    var viewStatePointerCancelHandler = null;
    var viewStateManualGestureActive = false;
    var viewStateManualGestureRecentUntil = 0;
    var viewStateManualGestureDetected = false;
    var viewStateLastObservedTransform = '';
    var rootCenterRequestToken = 0;

    function getViewState() {
      var xmindState = ensureState();
      if (!xmindState.viewState || typeof xmindState.viewState !== 'object') {
        xmindState.viewState = createDefaultViewState();
      }
      return xmindState.viewState;
    }

    function isMindCanvasInteractionTarget(target) {
      if (!target || !target.closest) return false;
      return Boolean(target.closest('[data-mind-canvas]') || target.closest('.map-canvas'));
    }

    function beginManualViewportGestureTracking(event) {
      var target = event && event.target ? event.target : null;
      var button = event && typeof event.button === 'number' ? event.button : 0;
      if (!isMindCanvasInteractionTarget(target)) return false;
      if (button !== 0 && button !== 1 && button !== 2) return false;
      viewStateManualGestureActive = true;
      viewStateManualGestureRecentUntil = now() + manualGestureMs;
      return true;
    }

    function finishManualViewportGestureTracking() {
      if (!viewStateManualGestureActive) return false;
      viewStateManualGestureActive = false;
      viewStateManualGestureRecentUntil = now() + manualGestureMs;
      return true;
    }

    function cancelManualViewportGestureTracking() {
      viewStateManualGestureActive = false;
      viewStateManualGestureRecentUntil = 0;
      return true;
    }

    function hasPendingManualViewportGesture() {
      return viewStateManualGestureActive === true || now() <= Number(viewStateManualGestureRecentUntil || 0);
    }

    function markManualViewportInteraction() {
      viewStateManualGestureDetected = true;
      viewStateManualGestureRecentUntil = now() + manualGestureMs;
      var mindInstance = getMindInstance();
      if (mindInstance && typeof mindInstance === 'object') mindInstance.__tapViewportInteracted = true;
    }

    function scheduleCanvasWheelPanFallback(event) {
      var target = event && event.target ? event.target : null;
      if (!isMindCanvasInteractionTarget(target)) return false;
      if (event && (event.ctrlKey || event.metaKey)) return false;
      var deltaX = Number(event && event.deltaX);
      var deltaY = Number(event && event.deltaY);
      if (!Number.isFinite(deltaX)) deltaX = 0;
      if (!Number.isFinite(deltaY)) deltaY = 0;
      if (deltaX === 0 && deltaY === 0) return false;
      var mapEl = mindContainer && mindContainer.querySelector
        ? mindContainer.querySelector('.map-canvas')
        : null;
      var beforeTransform = mapEl && mapEl.style ? String(mapEl.style.transform || '') : '';
      scheduleTimeout(function() {
        var mindInstance = getMindInstance();
        if (!isDrawerOpen() || !mindInstance || typeof mindInstance.move !== 'function') return;
        if (!mapEl || !mapEl.isConnected || !mapEl.style) return;
        if (String(mapEl.style.transform || '') !== beforeTransform) return;
        try {
          mindInstance.move(-deltaX, -deltaY);
          markManualViewportInteraction();
          scheduleLightweightViewportCapture();
        } catch (err) {}
      }, 36);
      return true;
    }

    function resolveCapturedManualViewportFlag(transformText, sourceViewState) {
      var transform = String(transformText || '');
      var existingViewState = sourceViewState && typeof sourceViewState === 'object'
        ? sourceViewState
        : getViewState();
      var normalized = normalizeStoredViewState(existingViewState);
      return Boolean(transform && (
        normalized.hasManualViewport === true || viewStateManualGestureDetected === true
      ));
    }

    function cleanupViewStateBindings() {
      cancelPendingViewStateCapture();
      if (viewStateMutationObserver) {
        viewStateMutationObserver.disconnect();
        viewStateMutationObserver = null;
      }
      if (viewStateScrollTarget && viewStateScrollHandler) {
        viewStateScrollTarget.removeEventListener('scroll', viewStateScrollHandler);
      }
      if (viewStateInteractionTarget && viewStateClickHandler) {
        viewStateInteractionTarget.removeEventListener('click', viewStateClickHandler, true);
      }
      if (viewStateInteractionTarget && viewStateWheelHandler) {
        viewStateInteractionTarget.removeEventListener('wheel', viewStateWheelHandler, true);
      }
      if (viewStateInteractionTarget && viewStatePointerDownHandler) {
        viewStateInteractionTarget.removeEventListener('pointerdown', viewStatePointerDownHandler, true);
        viewStateInteractionTarget.removeEventListener('mousedown', viewStatePointerDownHandler, true);
      }
      if (windowObj && typeof windowObj.removeEventListener === 'function') {
        if (viewStatePointerUpHandler) {
          windowObj.removeEventListener('pointerup', viewStatePointerUpHandler, true);
          windowObj.removeEventListener('mouseup', viewStatePointerUpHandler, true);
        }
        if (viewStatePointerCancelHandler) {
          windowObj.removeEventListener('pointercancel', viewStatePointerCancelHandler, true);
          windowObj.removeEventListener('blur', viewStatePointerCancelHandler, true);
        }
      }
      viewStateScrollTarget = null;
      viewStateScrollHandler = null;
      viewStateInteractionTarget = null;
      viewStateClickHandler = null;
      viewStateWheelHandler = null;
      viewStatePointerDownHandler = null;
      viewStatePointerUpHandler = null;
      viewStatePointerCancelHandler = null;
      viewStateManualGestureActive = false;
      viewStateManualGestureRecentUntil = 0;
      viewStateManualGestureDetected = false;
      viewStateLastObservedTransform = '';
    }

    function cancelPendingViewStateCapture() {
      if (!viewStatePersistTimer) return false;
      cancelTimeout(viewStatePersistTimer);
      viewStatePersistTimer = 0;
      return true;
    }

    function invalidateRootCenterRequest() {
      rootCenterRequestToken += 1;
      return rootCenterRequestToken;
    }

    function prepareMindDestroy() {
      invalidateRootCenterRequest();
      cleanupViewStateBindings();
    }

    function buildViewStateNodeKey(meta, topic, fallbackPath) {
      var pathText = Array.isArray(fallbackPath) ? fallbackPath.join('>') : '';
      if (!meta || typeof meta !== 'object') {
        return pathText ? ('path::' + pathText) : ('topic::' + String(topic || ''));
      }
      if (meta.type === 'root') return 'root';
      if (meta.type === 'module') {
        return 'module::' + String(meta.moduleKey || normalizeModuleKey(meta.moduleTitle || topic || ''));
      }
      if (
        meta.type === 'case' || meta.type === 'priority' || meta.type === 'preconditions'
        || meta.type === 'steps' || meta.type === 'expected'
      ) {
        return [
          String(meta.type || 'node'),
          String(meta.moduleKey || normalizeModuleKey(meta.moduleTitle || '')),
          String(meta.caseSource || ''),
          String(Number(meta.caseSourceIndex)),
          String(meta.caseSignature || normalizeCaseTitle(meta.caseTitle || topic || '')),
        ].join('::');
      }
      if (meta.type === 'topup-placeholder') {
        return 'placeholder::' + String(meta.nodeId || meta.moduleKey || topic || '');
      }
      if (meta.nodeId) return 'nodeid::' + String(meta.nodeId);
      return pathText ? ('path::' + pathText) : ('topic::' + String(topic || ''));
    }

    function collectCollapsedNodeKeysFromMindData(nodeData) {
      var keys = [];
      function walk(node, path) {
        if (!node || typeof node !== 'object') return;
        var nextPath = Array.isArray(path) ? path.slice() : [];
        nextPath.push(String(node.topic || ''));
        var children = Array.isArray(node.children) ? node.children : [];
        if (children.length) {
          if (node.expanded === false) {
            keys.push(buildViewStateNodeKey(node.xmindMeta || null, node.topic, nextPath));
          }
          children.forEach(function(child) { walk(child, nextPath); });
        }
      }
      walk(nodeData, []);
      return normalizeUniqueStringList(keys);
    }

    function buildCurrentMindDataSnapshot() {
      var mindInstance = getMindInstance();
      if (!mindInstance) return null;
      try {
        if (typeof mindInstance.getData === 'function') {
          var data = mindInstance.getData();
          if (data && data.nodeData) return cloneJson(data, null);
        }
      } catch (err) {}
      try {
        if (mindInstance.nodeData) return cloneJson({ nodeData: mindInstance.nodeData }, null);
      } catch (err2) {}
      return null;
    }

    function collectCollapsedNodeKeysFromMindDom() {
      var keys = [];
      if (!mindContainer || !mindContainer.querySelectorAll) return keys;
      var expanders = mindContainer.querySelectorAll('me-parent > me-epd');
      Array.prototype.forEach.call(expanders, function(expander) {
        if (!expander || !expander.classList || expander.classList.contains('minus')) return;
        var parent = expander.parentElement;
        var topicEl = parent && parent.querySelector ? parent.querySelector('me-tpc') : null;
        var nodeObj = topicEl && topicEl.nodeObj ? topicEl.nodeObj : null;
        if (!nodeObj) return;
        var meta = nodeObj.xmindMeta && typeof nodeObj.xmindMeta === 'object' ? nodeObj.xmindMeta : null;
        var path = [];
        var cursor = nodeObj;
        var guard = 0;
        while (cursor && guard < 64) {
          path.unshift(String(cursor.topic || ''));
          cursor = cursor.parent || null;
          guard += 1;
        }
        keys.push(buildViewStateNodeKey(meta, nodeObj.topic, path));
      });
      return normalizeUniqueStringList(keys);
    }

    function captureCurrentViewState(captureOptions) {
      var captureOpts = captureOptions || {};
      var hostState = getHostState();
      var viewState = getViewState();
      if (getWorkspaceShadowDepth() > 0 || getWorkspaceUiMutedDepth() > 0) {
        viewState.updatedAt = now();
        return cloneJson(viewState, createDefaultViewState());
      }
      var actualDrawerOpen = isDrawerOpen();
      var shouldPreserveRestoreIntent = actualDrawerOpen !== true
        && viewState.drawerOpen === true && String(hostState.activeTab || '') === 'casesgen';
      if (!shouldPreserveRestoreIntent) viewState.drawerOpen = actualDrawerOpen;
      var mindInstance = getMindInstance();
      if (!actualDrawerOpen || !mindInstance) {
        if (!shouldPreserveRestoreIntent) {
          viewState.fullscreen = drawerEl && drawerEl.classList
            ? drawerEl.classList.contains('xmind-drawer-fullscreen')
            : false;
        }
        viewState.updatedAt = now();
        return cloneJson(viewState, createDefaultViewState());
      }
      var captured = typeof mindInstance.__tapCaptureViewState === 'function'
        ? mindInstance.__tapCaptureViewState() : null;
      var drawerState = typeof mindInstance.__tapCaptureDrawerState === 'function'
        ? mindInstance.__tapCaptureDrawerState() : null;
      var lightweight = captureOpts.lightweight === true;
      var anchorState = lightweight
        ? (viewState.anchorState && viewState.anchorState.nodeId
          ? cloneJson(viewState.anchorState, viewState.anchorState) : null)
        : captureVisibleMindAnchorStateFromDom();
      var mindData = lightweight ? null : buildCurrentMindDataSnapshot();
      viewState.fullscreen = drawerEl && drawerEl.classList
        ? drawerEl.classList.contains('xmind-drawer-fullscreen')
        : Boolean(drawerState && drawerState.fullscreen === true);
      viewState.transform = captured && captured.transform ? String(captured.transform || '') : '';
      viewState.scaleVal = captured && isFinite(Number(captured.scaleVal)) && Number(captured.scaleVal) > 0
        ? Number(captured.scaleVal) : 1;
      viewState.scrollLeft = captured && isFinite(Number(captured.scrollLeft)) && Number(captured.scrollLeft) >= 0
        ? Number(captured.scrollLeft) : 0;
      viewState.scrollTop = captured && isFinite(Number(captured.scrollTop)) && Number(captured.scrollTop) >= 0
        ? Number(captured.scrollTop) : 0;
      viewState.hasManualViewport = resolveCapturedManualViewportFlag(viewState.transform, viewState);
      viewState.anchorState = anchorState && anchorState.nodeId ? {
        nodeId: String(anchorState.nodeId || ''),
        centerX: Number(anchorState.centerX || 0),
        centerY: Number(anchorState.centerY || 0),
      } : null;
      if (lightweight) {
        viewState.collapsedNodeKeys = normalizeUniqueStringList(viewState.collapsedNodeKeys);
      } else {
        var collapsedFromDom = collectCollapsedNodeKeysFromMindDom();
        viewState.collapsedNodeKeys = collapsedFromDom.length
          ? collapsedFromDom
          : (mindData && mindData.nodeData ? collectCollapsedNodeKeysFromMindData(mindData.nodeData) : []);
      }
      viewState.treeSourceSignature = String(ensureState().treeSourceSignature || '');
      viewState.updatedAt = now();
      return cloneJson(viewState, createDefaultViewState());
    }

    function isVisibleMindTreeAlignedWithCurrentState() {
      if (!mindContainer || !mindContainer.querySelector) return true;
      var expectedRootText = String(getRequirementLabelText() || '').trim();
      if (!expectedRootText) return true;
      var currentMindData = getCurrentMindData();
      var renderedDataRootText = currentMindData && currentMindData.nodeData
        ? String(currentMindData.nodeData.topic || '').trim() : '';
      if (renderedDataRootText && renderedDataRootText !== expectedRootText) return false;
      var rootTextEl = mindContainer.querySelector('me-tpc.xmind-casegen-node-root .text');
      var renderedDomRootText = rootTextEl
        ? String(rootTextEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
      return !(renderedDomRootText && renderedDomRootText !== expectedRootText);
    }

    function captureVisibleMindViewStateFromDom(captureOptions) {
      var captureOpts = captureOptions || {};
      var mindInstance = getMindInstance();
      if (!mindContainer || !mindInstance || !isDrawerOpen()) return null;
      if (captureOpts.skipTreeAlignmentCheck !== true && !isVisibleMindTreeAlignedWithCurrentState()) return null;
      var mapEl = mindContainer.querySelector ? mindContainer.querySelector('.map-canvas') : null;
      var canvasEl = mindContainer.querySelector ? mindContainer.querySelector('[data-mind-canvas]') : null;
      if (!mapEl || !mapEl.style || !canvasEl) return null;
      var transformText = String(mapEl.style.transform || '');
      if (!transformText) return null;
      var sourceBaseViewState = captureOpts.baseViewState && typeof captureOpts.baseViewState === 'object'
        ? captureOpts.baseViewState : getViewState();
      var baseViewState = normalizeStoredViewState(sourceBaseViewState, {
        drawerOpen: sourceBaseViewState && sourceBaseViewState.drawerOpen === true,
        fullscreen: sourceBaseViewState && sourceBaseViewState.fullscreen === true,
      });
      var anchorState = captureOpts.includeAnchor === false
        ? (captureOpts.preserveExistingAnchor !== false && baseViewState.anchorState && baseViewState.anchorState.nodeId
          ? cloneJson(baseViewState.anchorState, baseViewState.anchorState) : null)
        : captureVisibleMindAnchorStateFromDom();
      var next = cloneJson(baseViewState, createDefaultViewState()) || createDefaultViewState();
      next.drawerOpen = true;
      next.fullscreen = drawerEl && drawerEl.classList
        ? drawerEl.classList.contains('xmind-drawer-fullscreen') : false;
      next.transform = transformText;
      next.scaleVal = Number(mindInstance.scaleVal || 1);
      if (!Number.isFinite(next.scaleVal) || next.scaleVal <= 0) next.scaleVal = 1;
      next.scrollLeft = Number(canvasEl.scrollLeft || 0);
      next.scrollTop = Number(canvasEl.scrollTop || 0);
      next.hasManualViewport = resolveCapturedManualViewportFlag(transformText, next);
      next.anchorState = anchorState && anchorState.nodeId ? {
        nodeId: String(anchorState.nodeId || ''),
        centerX: Number(anchorState.centerX || 0),
        centerY: Number(anchorState.centerY || 0),
      } : null;
      next.collapsedNodeKeys = captureOpts.includeCollapsed === false
        ? normalizeUniqueStringList(baseViewState.collapsedNodeKeys)
        : collectCollapsedNodeKeysFromMindDom();
      next.treeSourceSignature = String(ensureState().treeSourceSignature || '');
      next.updatedAt = now();
      return next;
    }

    function scheduleCaptureCurrentViewState(useImmediate, captureOptions) {
      var captureOpts = captureOptions || {};
      if (viewStatePersistTimer) cancelTimeout(viewStatePersistTimer);
      if (useImmediate === true) {
        captureCurrentViewState(captureOpts);
        persistXmindState(true);
        return;
      }
      var delayMs = Number(captureOpts.delayMs || viewStateCaptureDebounceMs);
      if (!Number.isFinite(delayMs) || delayMs < 0) delayMs = viewStateCaptureDebounceMs;
      viewStatePersistTimer = scheduleTimeout(function() {
        viewStatePersistTimer = 0;
        captureCurrentViewState(captureOpts);
        persistXmindState(false);
      }, delayMs);
    }

    function scheduleLightweightViewportCapture() {
      scheduleCaptureCurrentViewState(false, {
        lightweight: true,
        delayMs: interactionCaptureDebounceMs,
      });
    }

    function applyCurrentMindViewState(viewState) {
      var nextView = viewState && typeof viewState === 'object' ? viewState : null;
      var mindInstance = getMindInstance();
      if (!nextView || !nextView.transform || !mindInstance || !mindContainer) return false;
      var mapEl = mindContainer.querySelector ? mindContainer.querySelector('.map-canvas') : null;
      var canvasEl = mindContainer.querySelector ? mindContainer.querySelector('[data-mind-canvas]') : null;
      if (!mapEl || !mapEl.style || !canvasEl) return false;
      mapEl.style.transform = String(nextView.transform || '');
      canvasEl.scrollLeft = Number(nextView.scrollLeft || 0);
      canvasEl.scrollTop = Number(nextView.scrollTop || 0);
      var scaleVal = Number(nextView.scaleVal || 0);
      if (Number.isFinite(scaleVal) && scaleVal > 0) mindInstance.scaleVal = scaleVal;
      if (typeof mindInstance.__tapSyncZoomMinScale === 'function') mindInstance.__tapSyncZoomMinScale();
      if (typeof mindInstance.__tapSyncCtrlWheelMinScale === 'function') {
        mindInstance.__tapSyncCtrlWheelMinScale(true);
      }
      return true;
    }

    function parseMindTransformState(transformText) {
      var text = transformText === undefined || transformText === null ? '' : String(transformText);
      var translateMatch = text.match(/translate3d\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px\s*,\s*[^)]*\)/i);
      if (!translateMatch) {
        translateMatch = text.match(/translate\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px\s*\)/i);
      }
      var scaleMatch = text.match(/scale\(\s*(-?\d+(?:\.\d+)?)\s*\)/i);
      return {
        x: translateMatch ? Number(translateMatch[1] || 0) : 0,
        y: translateMatch ? Number(translateMatch[2] || 0) : 0,
        scale: scaleMatch ? Number(scaleMatch[1] || 1) : 1,
      };
    }

    function writeMindTransformState(mapEl, transformState) {
      if (!mapEl || !mapEl.style || !transformState) return false;
      var x = Number(transformState.x);
      var y = Number(transformState.y);
      var scale = Number(transformState.scale);
      if (!Number.isFinite(x)) x = 0;
      if (!Number.isFinite(y)) y = 0;
      if (!Number.isFinite(scale) || scale <= 0) scale = 1;
      mapEl.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0px) scale(' + scale + ')';
      return true;
    }

    function resolveMindAnchorElement(nodeEl) {
      if (!nodeEl) return null;
      if (nodeEl.querySelector) {
        var textEl = nodeEl.querySelector('.text');
        if (textEl && textEl.getBoundingClientRect) return textEl;
      }
      return nodeEl && nodeEl.getBoundingClientRect ? nodeEl : null;
    }

    function getMindAnchorStableNodeId(nodeEl) {
      if (!nodeEl) return '';
      if (nodeEl.getAttribute) {
        var attrNodeId = String(nodeEl.getAttribute('data-xmind-node-id') || '');
        if (attrNodeId) return attrNodeId;
      }
      if (!nodeEl.nodeObj) return '';
      var meta = nodeEl.nodeObj.xmindMeta && typeof nodeEl.nodeObj.xmindMeta === 'object'
        ? nodeEl.nodeObj.xmindMeta : null;
      if (meta && meta.nodeId) return String(meta.nodeId || '');
      if (nodeEl.nodeObj.id === undefined || nodeEl.nodeObj.id === null) return '';
      return String(nodeEl.nodeObj.id || '');
    }

    function captureVisibleMindAnchorStateFromDom() {
      if (!mindContainer || !isDrawerOpen()) return null;
      var viewerEl = mindContainer.querySelector
        ? (mindContainer.querySelector('.xmind-structure-viewer') || mindContainer) : mindContainer;
      if (!viewerEl || !viewerEl.getBoundingClientRect || !viewerEl.querySelectorAll) return null;
      var viewerRect = viewerEl.getBoundingClientRect();
      var viewerCenterX = Number(viewerRect.left + (viewerRect.width / 2));
      var viewerCenterY = Number(viewerRect.top + (viewerRect.height / 2));
      if (!isFinite(viewerCenterX) || !isFinite(viewerCenterY)) return null;
      var nodeEls = viewerEl.querySelectorAll('me-tpc');
      if (!nodeEls || !nodeEls.length) return null;
      var best = null;
      Array.prototype.forEach.call(nodeEls, function(nodeEl) {
        var stableNodeId = getMindAnchorStableNodeId(nodeEl);
        if (!stableNodeId) return;
        var anchorEl = resolveMindAnchorElement(nodeEl);
        if (!anchorEl || !anchorEl.getBoundingClientRect) return;
        var rect = anchorEl.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        var centerX = Number(rect.left + (rect.width / 2));
        var centerY = Number(rect.top + (rect.height / 2));
        if (!isFinite(centerX) || !isFinite(centerY)) return;
        var dx = centerX - viewerCenterX;
        var dy = centerY - viewerCenterY;
        var distance = Math.sqrt((dx * dx) + (dy * dy));
        if (!best || distance < best.distance) {
          best = { nodeId: stableNodeId, centerX: centerX, centerY: centerY, distance: distance };
        }
      });
      if (!best || !best.nodeId) return null;
      return {
        nodeId: String(best.nodeId || ''),
        centerX: Number(best.centerX || 0),
        centerY: Number(best.centerY || 0),
      };
    }

    function captureRenderedMindAnchorStateByNodeId(nodeId) {
      var stableNodeId = String(nodeId || '');
      if (!stableNodeId || !mindContainer || !isDrawerOpen()) return null;
      var nodeEl = findRenderedMindNodeByStableId(stableNodeId, null);
      var anchorEl = resolveMindAnchorElement(nodeEl);
      if (!anchorEl || !anchorEl.getBoundingClientRect) return null;
      var rect = anchorEl.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return null;
      return {
        nodeId: stableNodeId,
        centerX: Number(rect.left + (rect.width / 2)),
        centerY: Number(rect.top + (rect.height / 2)),
      };
    }

    function applyCurrentMindAnchorState(anchorState) {
      var anchor = anchorState && typeof anchorState === 'object' ? anchorState : null;
      if (!anchor || !anchor.nodeId || !mindContainer) return false;
      var mapEl = mindContainer.querySelector ? mindContainer.querySelector('.map-canvas') : null;
      if (!mapEl || !mapEl.style) return false;
      var nodeEls = mindContainer.querySelectorAll ? mindContainer.querySelectorAll('me-tpc') : [];
      if (!nodeEls || !nodeEls.length) return false;
      var targetNode = null;
      Array.prototype.some.call(nodeEls, function(nodeEl) {
        if (!nodeEl || !nodeEl.nodeObj) return false;
        if (getMindAnchorStableNodeId(nodeEl) !== String(anchor.nodeId || '')) return false;
        targetNode = nodeEl;
        return true;
      });
      if (!targetNode) return false;
      var anchorEl = resolveMindAnchorElement(targetNode);
      if (!anchorEl || !anchorEl.getBoundingClientRect) return false;
      var rect = anchorEl.getBoundingClientRect();
      var currentCenterX = Number(rect.left + (rect.width / 2));
      var currentCenterY = Number(rect.top + (rect.height / 2));
      var desiredCenterX = Number(anchor.centerX);
      var desiredCenterY = Number(anchor.centerY);
      if (!Number.isFinite(currentCenterX) || !Number.isFinite(currentCenterY)
        || !Number.isFinite(desiredCenterX) || !Number.isFinite(desiredCenterY)) return false;
      var deltaX = desiredCenterX - currentCenterX;
      var deltaY = desiredCenterY - currentCenterY;
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return true;
      var transformState = parseMindTransformState(mapEl.style.transform || '');
      transformState.x += deltaX;
      transformState.y += deltaY;
      return writeMindTransformState(mapEl, transformState);
    }

    function bindLiveViewStateCapture() {
      cleanupViewStateBindings();
      var mindInstance = getMindInstance();
      if (!mindContainer || !mindInstance || !isDrawerOpen()) return;
      viewStateInteractionTarget = mindContainer;
      viewStateLastObservedTransform = '';
      viewStateClickHandler = function(event) {
        var target = event && event.target ? event.target : null;
        if (target && target.closest && target.closest('me-epd')) {
          scheduleTimeout(function() { scheduleCaptureCurrentViewState(false); }, 36);
          return;
        }
        scheduleCaptureCurrentViewState(false);
      };
      viewStateWheelHandler = function(event) {
        markManualViewportInteraction();
        scheduleCanvasWheelPanFallback(event);
        scheduleLightweightViewportCapture();
      };
      viewStatePointerDownHandler = function(event) { beginManualViewportGestureTracking(event); };
      viewStatePointerUpHandler = function() { finishManualViewportGestureTracking(); };
      viewStatePointerCancelHandler = function() { cancelManualViewportGestureTracking(); };
      mindContainer.addEventListener('click', viewStateClickHandler, true);
      mindContainer.addEventListener('wheel', viewStateWheelHandler, true);
      mindContainer.addEventListener('pointerdown', viewStatePointerDownHandler, true);
      mindContainer.addEventListener('mousedown', viewStatePointerDownHandler, true);
      if (windowObj && typeof windowObj.addEventListener === 'function') {
        windowObj.addEventListener('pointerup', viewStatePointerUpHandler, true);
        windowObj.addEventListener('mouseup', viewStatePointerUpHandler, true);
        windowObj.addEventListener('pointercancel', viewStatePointerCancelHandler, true);
        windowObj.addEventListener('blur', viewStatePointerCancelHandler, true);
      }
      var mapEl = mindContainer.querySelector ? mindContainer.querySelector('.map-canvas') : null;
      var canvasEl = mindContainer.querySelector ? mindContainer.querySelector('[data-mind-canvas]') : null;
      if (mapEl && mapEl.style) viewStateLastObservedTransform = String(mapEl.style.transform || '');
      if (canvasEl) {
        viewStateScrollTarget = canvasEl;
        viewStateScrollHandler = function() { scheduleLightweightViewportCapture(); };
        canvasEl.addEventListener('scroll', viewStateScrollHandler, { passive: true });
      }
      if (MutationObserverCtor && (mapEl || drawerEl)) {
        viewStateMutationObserver = new MutationObserverCtor(function(mutations) {
          var shouldPersist = false;
          var nextTransform = mapEl && mapEl.style ? String(mapEl.style.transform || '') : '';
          var transformChanged = Boolean(mapEl && nextTransform !== viewStateLastObservedTransform);
          (mutations || []).some(function(mutation) {
            var target = mutation && mutation.target ? mutation.target : null;
            if (!target) return false;
            if (target === drawerEl || target === mapEl) {
              shouldPersist = true;
              return true;
            }
            if (target.closest && target.closest('[data-mind-canvas]')) {
              shouldPersist = true;
              return true;
            }
            return false;
          });
          if (transformChanged) {
            if (hasPendingManualViewportGesture()) markManualViewportInteraction();
            viewStateLastObservedTransform = nextTransform;
          }
          if (shouldPersist) {
            if (transformChanged) scheduleLightweightViewportCapture();
            else scheduleCaptureCurrentViewState(false);
          }
        });
        try {
          if (mapEl) {
            viewStateMutationObserver.observe(mapEl, {
              attributes: true,
              attributeFilter: ['style'],
              childList: true,
              subtree: true,
            });
          }
          if (drawerEl) {
            viewStateMutationObserver.observe(drawerEl, {
              attributes: true,
              attributeFilter: ['class'],
            });
          }
        } catch (err) {
          if (viewStateMutationObserver) {
            viewStateMutationObserver.disconnect();
            viewStateMutationObserver = null;
          }
        }
      }
      captureCurrentViewState();
      scheduleCaptureCurrentViewState(false);
    }

    function persistViewportActionViewState() {
      scheduleTimeout(function() {
        if (!isDrawerOpen() || !getMindInstance()) return;
        captureCurrentViewState();
        persistXmindState(true);
      }, 0);
    }

    function centerRootNodeView(centerOptions) {
      var centerOpts = centerOptions || {};
      var retryLimit = Number(centerOpts.retryLimit);
      var retryDelayMs = Number(centerOpts.retryDelayMs);
      if (!Number.isFinite(retryLimit) || retryLimit < 1) retryLimit = 6;
      if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) retryDelayMs = 80;
      var shouldPersist = centerOpts.persist !== false;
      var targetMindInstance = getMindInstance();
      var requestToken = invalidateRootCenterRequest();

      function findRootNodeElementForCenter() {
        if (!mindContainer || !mindContainer.querySelectorAll) return null;
        var rootNodeId = getRootNodeId();
        var expectedText = String(getRequirementLabelText() || '').replace(/\s+/g, ' ').trim();
        var nodes = mindContainer.querySelectorAll('me-tpc');
        var textMatchedNode = null;
        for (var index = 0; index < nodes.length; index += 1) {
          var nodeEl = nodes[index];
          if (!nodeEl) continue;
          var nodeObj = nodeEl.nodeObj || null;
          if (nodeObj && nodeObj.id !== undefined && nodeObj.id !== null
            && String(nodeObj.id || '') === rootNodeId) return nodeEl;
          var meta = nodeObj && nodeObj.xmindMeta && typeof nodeObj.xmindMeta === 'object'
            ? nodeObj.xmindMeta : null;
          if (meta && meta.type === 'root') return nodeEl;
          if (!textMatchedNode && expectedText) {
            var anchorEl = resolveMindAnchorElement(nodeEl);
            var text = anchorEl ? String(anchorEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
            if (text === expectedText) textMatchedNode = nodeEl;
          }
        }
        return textMatchedNode;
      }

      function centerRootNodeElementFallback() {
        if (!mindContainer || !mindContainer.querySelector) return false;
        var viewerEl = mindContainer.querySelector('.xmind-structure-viewer') || mindContainer;
        var mapEl = mindContainer.querySelector('.map-canvas');
        var rootNodeEl = findRootNodeElementForCenter();
        var rootTextEl = resolveMindAnchorElement(rootNodeEl);
        if (!viewerEl || !viewerEl.getBoundingClientRect || !mapEl || !mapEl.style
          || !rootTextEl || !rootTextEl.getBoundingClientRect) return false;
        var viewerRect = viewerEl.getBoundingClientRect();
        var nodeRect = rootTextEl.getBoundingClientRect();
        var currentCenterX = Number(nodeRect.left + (nodeRect.width / 2));
        var currentCenterY = Number(nodeRect.top + (nodeRect.height / 2));
        var desiredCenterX = Number(viewerRect.left + (viewerRect.width / 2));
        var desiredCenterY = Number(viewerRect.top + (viewerRect.height / 2));
        if (!isFinite(currentCenterX) || !isFinite(currentCenterY)
          || !isFinite(desiredCenterX) || !isFinite(desiredCenterY)) return false;
        var deltaX = desiredCenterX - currentCenterX;
        var deltaY = desiredCenterY - currentCenterY;
        if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return true;
        var transformState = parseMindTransformState(mapEl.style.transform || '');
        transformState.x += deltaX;
        transformState.y += deltaY;
        return writeMindTransformState(mapEl, transformState);
      }

      function attempt() {
        if (requestToken !== rootCenterRequestToken) return;
        if (!targetMindInstance || targetMindInstance !== getMindInstance()) return;
        if (!isDrawerOpen() || targetMindInstance.__tapViewportInteracted === true) return;
        var mindElixirCoreApi = getMindElixirCoreApi();
        var coreCentered = false;
        if (mindElixirCoreApi && typeof mindElixirCoreApi.centerMindNode === 'function') {
          try {
            coreCentered = mindElixirCoreApi.centerMindNode(targetMindInstance, getRootNodeId()) === true;
          } catch (err) { coreCentered = false; }
        }
        var centered = centerRootNodeElementFallback() === true || coreCentered === true;
        if (centered) {
          scheduleTopupHighlightSync();
          if (shouldPersist) persistViewportActionViewState();
        }
      }

      var delayMs = 0;
      for (var index = 0; index < retryLimit; index += 1) {
        scheduleTimeout(attempt, delayMs);
        if (index === 0) delayMs += retryDelayMs;
        else delayMs += Math.max(retryDelayMs, Math.round(retryDelayMs * Math.pow(1.35, index)));
      }
    }

    return {
      applyCurrentMindAnchorState: applyCurrentMindAnchorState,
      applyCurrentMindViewState: applyCurrentMindViewState,
      buildCurrentMindDataSnapshot: buildCurrentMindDataSnapshot,
      buildViewStateNodeKey: buildViewStateNodeKey,
      captureCurrentViewState: captureCurrentViewState,
      captureRenderedMindAnchorStateByNodeId: captureRenderedMindAnchorStateByNodeId,
      captureVisibleMindAnchorStateFromDom: captureVisibleMindAnchorStateFromDom,
      captureVisibleMindViewStateFromDom: captureVisibleMindViewStateFromDom,
      centerRootNodeView: centerRootNodeView,
      cancelPendingViewStateCapture: cancelPendingViewStateCapture,
      cleanupViewStateBindings: cleanupViewStateBindings,
      collectCollapsedNodeKeysFromMindData: collectCollapsedNodeKeysFromMindData,
      getViewState: getViewState,
      invalidateRootCenterRequest: invalidateRootCenterRequest,
      markManualViewportInteraction: markManualViewportInteraction,
      persistViewportActionViewState: persistViewportActionViewState,
      prepareMindDestroy: prepareMindDestroy,
      scheduleCaptureCurrentViewState: scheduleCaptureCurrentViewState,
      scheduleLightweightViewportCapture: scheduleLightweightViewportCapture,
      bindLiveViewStateCapture: bindLiveViewStateCapture,
    };
  }

  return { create: create };
});
