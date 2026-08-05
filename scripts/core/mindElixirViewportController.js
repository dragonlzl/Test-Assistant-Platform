(function() {
  var defaultMinScale = 0.1;
  var defaultMaxScale = 2.5;
  var activeControllerByViewer = typeof WeakMap === 'function' ? new WeakMap() : null;

  function clampScale(value, minValue, maxValue) {
    var num = Number(value);
    if (!isFinite(num)) return 1;
    var lower = Number(minValue);
    var upper = Number(maxValue);
    if (!isFinite(lower) || lower <= 0) lower = defaultMinScale;
    if (!isFinite(upper) || upper <= 0) upper = defaultMaxScale;
    if (upper < lower) {
      var swap = upper;
      upper = lower;
      lower = swap;
    }
    if (num < lower) return lower;
    if (num > upper) return upper;
    return num;
  }

  function resolveScale(instance) {
    if (!instance) return 1;
    var num = Number(instance.scaleVal);
    if (!isFinite(num) || num <= 0) return 1;
    return num;
  }

  function updateViewerDragState(viewerEl, instance, dragging) {
    if (!viewerEl || !viewerEl.classList) return;
    var canDrag = resolveScale(instance) > 1.01;
    if (canDrag) viewerEl.classList.add('is-draggable');
    else viewerEl.classList.remove('is-draggable');
    if (canDrag && dragging) viewerEl.classList.add('is-dragging');
    else viewerEl.classList.remove('is-dragging');
  }

  function parseTransformState(transformText) {
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

  function writeTransformState(instance, transformState) {
    if (!instance || !instance.map || !instance.map.style || !transformState) return false;
    var scaleVal = Number(transformState.scale);
    if (!isFinite(scaleVal) || scaleVal <= 0) scaleVal = resolveScale(instance);
    if (!isFinite(scaleVal) || scaleVal <= 0) scaleVal = 1;
    var x = Number(transformState.x);
    var y = Number(transformState.y);
    if (!isFinite(x)) x = 0;
    if (!isFinite(y)) y = 0;
    instance.map.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0px) scale(' + scaleVal + ')';
    return true;
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var viewerEl = opts.viewerEl || null;
    var canvasEl = opts.canvasEl || null;
    var rootWindow = typeof window !== 'undefined' ? window : null;
    var getInstance = typeof opts.getInstance === 'function'
      ? opts.getInstance
      : function() { return null; };
    var previousController = activeControllerByViewer && viewerEl
      ? activeControllerByViewer.get(viewerEl)
      : null;
    if (previousController && typeof previousController.destroy === 'function') {
      previousController.destroy();
    }
    var minScale = Number(opts.minScale);
    var maxScale = Number(opts.maxScale);
    var defaultScaleStep = Number(opts.defaultScaleStep);
    if (!isFinite(minScale) || minScale <= 0) minScale = defaultMinScale;
    if (!isFinite(maxScale) || maxScale <= 0) maxScale = defaultMaxScale;
    if (maxScale < minScale) maxScale = minScale;
    if (!isFinite(defaultScaleStep) || defaultScaleStep <= 0) defaultScaleStep = 0.1;

    var isEventInsideControls = typeof opts.isEventInsideControls === 'function'
      ? opts.isEventInsideControls
      : function() { return false; };
    var isEventInsideCanvas = typeof opts.isEventInsideCanvas === 'function'
      ? opts.isEventInsideCanvas
      : function(target) {
          return Boolean(canvasEl && canvasEl.contains && canvasEl.contains(target));
        };
    var isNodeExpanderTarget = typeof opts.isNodeExpanderTarget === 'function'
      ? opts.isNodeExpanderTarget
      : function() { return false; };
    var onBeforeCtrlDrag = typeof opts.onBeforeCtrlDrag === 'function'
      ? opts.onBeforeCtrlDrag
      : function() {};
    var onCtrlRelease = typeof opts.onCtrlRelease === 'function'
      ? opts.onCtrlRelease
      : function() {};
    var onGlobalPointerDown = typeof opts.onGlobalPointerDown === 'function'
      ? opts.onGlobalPointerDown
      : function() {};
    var centerNode = typeof opts.centerNode === 'function'
      ? opts.centerNode
      : function() {};
    var enableCustomBoxSelection = opts.enableCustomBoxSelection === true;
    var zoomMinScale = minScale;
    var ctrlWheelMinScale = minScale;
    var ctrlModifierPressed = false;
    var destroyed = false;
    var ctrlLeftCanvasDrag = {
      active: false,
      pointerId: null,
      lastX: 0,
      lastY: 0,
    };
    var pendingViewportPan = {
      frameId: 0,
      deltaX: 0,
      deltaY: 0,
      reason: '',
      dragging: false,
    };
    var fitTimerIds = [];

    function notifyViewportStateChange(reason) {
      if (typeof opts.onViewStateChange !== 'function') return;
      try {
        opts.onViewStateChange({ reason: reason ? String(reason || '') : '' });
      } catch (err) {
        // ignore
      }
    }

    function markViewportInteraction() {
      var instance = getInstance();
      if (instance && typeof instance === 'object') instance.__tapViewportInteracted = true;
    }

    function getCanvasCenterPoint() {
      var rect = canvasEl && typeof canvasEl.getBoundingClientRect === 'function'
        ? canvasEl.getBoundingClientRect()
        : { left: 0, top: 0, width: 0, height: 0 };
      return {
        x: Number(rect.left || 0) + (Number(rect.width || 0) / 2),
        y: Number(rect.top || 0) + (Number(rect.height || 0) / 2),
      };
    }

    function syncInstanceScaleBounds(instance, minValue) {
      var target = instance || getInstance();
      if (!target || typeof target !== 'object') return;
      var lower = Number(minValue);
      if (!isFinite(lower) || lower <= 0) lower = zoomMinScale;
      if (!isFinite(lower) || lower <= 0) lower = minScale;
      if (lower < 0.05) lower = 0.05;
      var upper = Number(maxScale);
      if (!isFinite(upper) || upper <= 0) upper = defaultMaxScale;
      if (upper < lower) upper = lower;
      try {
        target.scaleMin = lower;
      } catch (err) {
        // ignore
      }
      try {
        target.scaleMax = upper;
      } catch (err2) {
        // ignore
      }
    }

    function syncZoomMinScaleWithCurrent(instance) {
      var target = instance || getInstance();
      var current = resolveScale(target);
      if (!isFinite(current) || current <= 0) return;
      var normalized = Number(current);
      if (normalized > maxScale) normalized = maxScale;
      if (normalized < minScale) normalized = minScale;
      if (normalized < zoomMinScale) {
        zoomMinScale = normalized;
        syncInstanceScaleBounds(target, zoomMinScale);
      }
    }

    function syncCtrlWheelMinScaleWithCurrent(instance, forceReset) {
      var current = resolveScale(instance || getInstance());
      if (!isFinite(current) || current <= 0) return;
      var normalized = Number(current);
      if (normalized > maxScale) normalized = maxScale;
      if (normalized < minScale) normalized = minScale;
      if (forceReset === true || normalized > ctrlWheelMinScale) {
        ctrlWheelMinScale = normalized;
        return;
      }
      if (normalized < ctrlWheelMinScale) ctrlWheelMinScale = normalized;
    }

    function requestViewportFrame(callback) {
      if (rootWindow && typeof rootWindow.requestAnimationFrame === 'function') {
        return rootWindow.requestAnimationFrame(callback);
      }
      return setTimeout(callback, 16);
    }

    function cancelViewportFrame(frameId) {
      if (!frameId) return;
      if (rootWindow && typeof rootWindow.cancelAnimationFrame === 'function') {
        rootWindow.cancelAnimationFrame(frameId);
        return;
      }
      clearTimeout(frameId);
    }

    function flushPendingViewportPan() {
      var deltaX = pendingViewportPan.deltaX;
      var deltaY = pendingViewportPan.deltaY;
      var reason = pendingViewportPan.reason || 'pan';
      var dragging = pendingViewportPan.dragging === true;
      pendingViewportPan.frameId = 0;
      pendingViewportPan.deltaX = 0;
      pendingViewportPan.deltaY = 0;
      pendingViewportPan.reason = '';
      pendingViewportPan.dragging = false;
      if (destroyed || (deltaX === 0 && deltaY === 0)) return;
      var instance = getInstance();
      if (!instance || typeof instance.move !== 'function') return;
      try {
        instance.move(deltaX, deltaY);
      } catch (err) {
        return;
      }
      updateViewerDragState(viewerEl, instance, dragging);
      notifyViewportStateChange(reason);
    }

    function queueViewportPan(deltaX, deltaY, reason, dragging) {
      if (destroyed) return false;
      var x = Number(deltaX);
      var y = Number(deltaY);
      if (!isFinite(x)) x = 0;
      if (!isFinite(y)) y = 0;
      if (x === 0 && y === 0) return false;
      pendingViewportPan.deltaX += x;
      pendingViewportPan.deltaY += y;
      pendingViewportPan.reason = reason ? String(reason || '') : 'pan';
      pendingViewportPan.dragging = pendingViewportPan.dragging === true || dragging === true;
      if (!pendingViewportPan.frameId) {
        pendingViewportPan.frameId = requestViewportFrame(flushPendingViewportPan);
      }
      return true;
    }

    function zoomBy(step) {
      if (destroyed) return false;
      var instance = getInstance();
      if (!instance || typeof instance.scale !== 'function') return false;
      var delta = Number(step);
      if (!isFinite(delta) || delta === 0) return false;
      markViewportInteraction();
      syncInstanceScaleBounds(instance, zoomMinScale);
      var current = resolveScale(instance);
      var next = clampScale(current + delta, zoomMinScale, maxScale);
      instance.scale(next, getCanvasCenterPoint());
      updateViewerDragState(viewerEl, instance, false);
      notifyViewportStateChange(delta > 0 ? 'zoom-in' : 'zoom-out');
      return true;
    }

    function zoomByWheelEvent(event) {
      if (destroyed || !event) return false;
      var instance = getInstance();
      if (!instance || typeof instance.scale !== 'function') return false;
      var deltaY = Number(event.deltaY);
      if (!isFinite(deltaY) || deltaY === 0) return false;
      markViewportInteraction();
      syncInstanceScaleBounds(instance, zoomMinScale);
      var sensitivity = Number(instance.scaleSensitivity);
      if (!isFinite(sensitivity) || sensitivity <= 0) sensitivity = defaultScaleStep;
      var step = deltaY < 0 ? sensitivity : -sensitivity;
      var current = resolveScale(instance);
      var lowerBound = ctrlWheelMinScale;
      if (!isFinite(lowerBound) || lowerBound <= 0) lowerBound = zoomMinScale;
      if (!isFinite(lowerBound) || lowerBound <= 0) lowerBound = minScale;
      if (current < lowerBound) lowerBound = current;
      var next = clampScale(current + step, lowerBound, maxScale);
      var fallbackCenter = getCanvasCenterPoint();
      var center = {
        x: isFinite(Number(event.clientX)) ? Number(event.clientX) : fallbackCenter.x,
        y: isFinite(Number(event.clientY)) ? Number(event.clientY) : fallbackCenter.y,
      };
      instance.scale(next, center);
      updateViewerDragState(viewerEl, instance, false);
      notifyViewportStateChange('zoom-wheel');
      return true;
    }

    function panByWheelEvent(event) {
      if (destroyed || !event) return false;
      var instance = getInstance();
      if (!instance || typeof instance.move !== 'function') return false;
      var deltaX = Number(event.deltaX);
      var deltaY = Number(event.deltaY);
      if (!isFinite(deltaX)) deltaX = 0;
      if (!isFinite(deltaY)) deltaY = 0;
      if (deltaX === 0 && deltaY === 0) return false;
      markViewportInteraction();
      if (event.shiftKey && deltaX === 0 && deltaY !== 0) {
        deltaX = deltaY;
        deltaY = 0;
      }
      return queueViewportPan(-deltaX, -deltaY, 'pan-wheel', false);
    }

    function clearFitTimers() {
      fitTimerIds.forEach(function(timerId) { clearTimeout(timerId); });
      fitTimerIds = [];
    }

    function zoomFit() {
      if (destroyed) return false;
      var instance = getInstance();
      markViewportInteraction();
      var fitCenterNodeId = '';
      if (instance && instance.nodeData && instance.nodeData.id !== undefined && instance.nodeData.id !== null) {
        fitCenterNodeId = String(instance.nodeData.id);
      }
      if (instance && typeof instance.scaleFit === 'function') {
        instance.scaleFit();
        syncZoomMinScaleWithCurrent(instance);
        syncCtrlWheelMinScaleWithCurrent(instance, true);
        if (fitCenterNodeId) {
          centerNode(instance, fitCenterNodeId);
          [0, 16, 48].forEach(function(delayMs) {
            fitTimerIds.push(setTimeout(function() {
              if (destroyed || !viewerEl || !viewerEl.isConnected) return;
              centerNode(instance, fitCenterNodeId);
            }, delayMs));
          });
        }
      }
      updateViewerDragState(viewerEl, instance, false);
      notifyViewportStateChange('zoom-fit');
      return true;
    }

    function findScrollableWheelAncestor() {
      if (!viewerEl || !viewerEl.parentElement || !rootWindow || typeof rootWindow.getComputedStyle !== 'function') {
        return null;
      }
      var body = typeof document !== 'undefined' && document ? document.body : null;
      var current = viewerEl.parentElement;
      while (current && current !== body) {
        var style = rootWindow.getComputedStyle(current);
        var overflowY = style && style.overflowY ? String(style.overflowY) : '';
        var canScrollY = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
        if (canScrollY && current.scrollHeight > current.clientHeight + 1) return current;
        current = current.parentElement;
      }
      return null;
    }

    function shouldAllowAncestorWheelScroll(event) {
      if (!event || event.ctrlKey || event.metaKey) return false;
      var deltaY = Number(event.deltaY);
      if (!isFinite(deltaY) || deltaY === 0) return false;
      var scrollAncestor = findScrollableWheelAncestor();
      if (!scrollAncestor) return false;
      var maxScrollTop = Number(scrollAncestor.scrollHeight - scrollAncestor.clientHeight);
      var currentScrollTop = Number(scrollAncestor.scrollTop || 0);
      if (!isFinite(maxScrollTop) || maxScrollTop <= 1) return false;
      if (!isFinite(currentScrollTop)) currentScrollTop = 0;
      if (deltaY > 0) return currentScrollTop < maxScrollTop - 1;
      return currentScrollTop > 1;
    }

    function applyAncestorWheelScroll(event) {
      if (!shouldAllowAncestorWheelScroll(event)) return false;
      var scrollAncestor = findScrollableWheelAncestor();
      if (!scrollAncestor) return false;
      var deltaY = Number(event.deltaY);
      if (!isFinite(deltaY) || deltaY === 0) return false;
      var nextScrollTop = Number(scrollAncestor.scrollTop || 0) + deltaY;
      var maxScrollTop = Number(scrollAncestor.scrollHeight - scrollAncestor.clientHeight);
      if (!isFinite(nextScrollTop)) nextScrollTop = Number(scrollAncestor.scrollTop || 0);
      if (!isFinite(maxScrollTop) || maxScrollTop < 0) maxScrollTop = 0;
      if (nextScrollTop < 0) nextScrollTop = 0;
      if (nextScrollTop > maxScrollTop) nextScrollTop = maxScrollTop;
      scrollAncestor.scrollTop = nextScrollTop;
      return true;
    }

    function blockCanvasNativeGesture(event) {
      if (!event || destroyed) return;
      if (isEventInsideControls(event.target)) return;
      var insideCanvas = isEventInsideCanvas(event.target);
      var insideViewer = Boolean(viewerEl && viewerEl.contains && viewerEl.contains(event.target));
      if (!insideCanvas && !insideViewer) return;
      if (event.cancelable === false) return;
      if (event.type === 'wheel') {
        if (!insideCanvas && applyAncestorWheelScroll(event)) {
          if (event.preventDefault) event.preventDefault();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          else if (event.stopPropagation) event.stopPropagation();
          return;
        }
        var usedWheelAction = event.ctrlKey || event.metaKey
          ? zoomByWheelEvent(event)
          : panByWheelEvent(event);
        if (usedWheelAction) {
          if (event.preventDefault) event.preventDefault();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          else if (event.stopPropagation) event.stopPropagation();
          return;
        }
      }
      if (event.preventDefault) event.preventDefault();
    }

    function isCtrlModifierActive(event) {
      if (event && event.ctrlKey) return true;
      return ctrlModifierPressed;
    }

    function stopCtrlLeftCanvasDragEvent(event) {
      if (!event) return;
      if (event.cancelable !== false && event.preventDefault) event.preventDefault();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      else if (event.stopPropagation) event.stopPropagation();
    }

    function isCtrlLeftCanvasDragEvent(event) {
      if (!event || event.button !== 0) return false;
      if (event.pointerType && event.pointerType !== 'mouse') return false;
      if (!isCtrlModifierActive(event)) return false;
      if (isEventInsideControls(event.target)) return false;
      if (isNodeExpanderTarget(event.target)) return false;
      if (enableCustomBoxSelection && event.target && event.target.closest && event.target.closest('me-tpc')) {
        return false;
      }
      return isEventInsideCanvas(event.target);
    }

    function resetCtrlLeftCanvasDrag() {
      ctrlModifierPressed = false;
      if (ctrlLeftCanvasDrag.active) {
        ctrlLeftCanvasDrag.active = false;
        ctrlLeftCanvasDrag.pointerId = null;
        ctrlLeftCanvasDrag.lastX = 0;
        ctrlLeftCanvasDrag.lastY = 0;
      }
      if (viewerEl && viewerEl.classList) viewerEl.classList.remove('is-ctrl-left-dragging');
      updateViewerDragState(viewerEl, getInstance(), false);
    }

    function beginCtrlLeftCanvasDrag(event) {
      if (destroyed || !isCtrlLeftCanvasDragEvent(event)) return;
      stopCtrlLeftCanvasDragEvent(event);
      ctrlModifierPressed = true;
      if (ctrlLeftCanvasDrag.active) return;
      var instance = getInstance();
      if (!instance || typeof instance.move !== 'function') return;
      ctrlLeftCanvasDrag.active = true;
      ctrlLeftCanvasDrag.pointerId = typeof event.pointerId === 'number' ? event.pointerId : null;
      ctrlLeftCanvasDrag.lastX = typeof event.clientX === 'number' ? event.clientX : 0;
      ctrlLeftCanvasDrag.lastY = typeof event.clientY === 'number' ? event.clientY : 0;
      if (viewerEl && viewerEl.classList) viewerEl.classList.add('is-ctrl-left-dragging');
      onBeforeCtrlDrag(event);
      updateViewerDragState(viewerEl, instance, true);
    }

    function moveCtrlLeftCanvasDrag(event) {
      if (destroyed || !ctrlLeftCanvasDrag.active || !event) return;
      if (
        ctrlLeftCanvasDrag.pointerId !== null
        && typeof event.pointerId === 'number'
        && event.pointerId !== ctrlLeftCanvasDrag.pointerId
      ) {
        return;
      }
      if (typeof event.buttons === 'number' && (event.buttons & 1) !== 1) {
        resetCtrlLeftCanvasDrag();
        return;
      }
      if (!isCtrlModifierActive(event)) {
        resetCtrlLeftCanvasDrag();
        return;
      }
      if (typeof event.clientX !== 'number' || typeof event.clientY !== 'number') return;
      var instance = getInstance();
      if (!instance || typeof instance.move !== 'function') {
        resetCtrlLeftCanvasDrag();
        return;
      }
      var deltaX = event.clientX - ctrlLeftCanvasDrag.lastX;
      var deltaY = event.clientY - ctrlLeftCanvasDrag.lastY;
      ctrlLeftCanvasDrag.lastX = event.clientX;
      ctrlLeftCanvasDrag.lastY = event.clientY;
      if (deltaX !== 0 || deltaY !== 0) {
        markViewportInteraction();
        queueViewportPan(deltaX, deltaY, 'pan-drag', true);
      }
      stopCtrlLeftCanvasDragEvent(event);
    }

    function endCtrlLeftCanvasDrag(event) {
      if (!ctrlLeftCanvasDrag.active) return;
      if (
        ctrlLeftCanvasDrag.pointerId !== null
        && event
        && typeof event.pointerId === 'number'
        && event.pointerId !== ctrlLeftCanvasDrag.pointerId
      ) {
        return;
      }
      if (event && typeof event.buttons === 'number' && (event.buttons & 1) === 1 && isCtrlModifierActive(event)) {
        return;
      }
      resetCtrlLeftCanvasDrag();
    }

    function onWindowKeydown(event) {
      if (event && (event.ctrlKey || String(event.key || '') === 'Control')) ctrlModifierPressed = true;
    }

    function onWindowKeyup(event) {
      var key = event && event.key ? String(event.key) : '';
      if (key === 'Control') {
        ctrlModifierPressed = false;
        onCtrlRelease(event);
      }
      if (ctrlLeftCanvasDrag.active && key === 'Control') resetCtrlLeftCanvasDrag();
    }

    function onWindowPointerDown(event) {
      onGlobalPointerDown(event);
      beginCtrlLeftCanvasDrag(event);
    }

    function installListeners() {
      if (viewerEl && typeof viewerEl.addEventListener === 'function') {
        viewerEl.addEventListener('wheel', blockCanvasNativeGesture, { capture: true, passive: false });
        viewerEl.addEventListener('touchstart', blockCanvasNativeGesture, { capture: true, passive: false });
        viewerEl.addEventListener('touchmove', blockCanvasNativeGesture, { capture: true, passive: false });
        viewerEl.addEventListener('gesturestart', blockCanvasNativeGesture, true);
        viewerEl.addEventListener('gesturechange', blockCanvasNativeGesture, true);
        viewerEl.addEventListener('gestureend', blockCanvasNativeGesture, true);
        viewerEl.addEventListener('pointerdown', beginCtrlLeftCanvasDrag, true);
      }
      if (rootWindow && typeof rootWindow.addEventListener === 'function') {
        rootWindow.addEventListener('pointerdown', onWindowPointerDown, true);
        rootWindow.addEventListener('mousedown', beginCtrlLeftCanvasDrag, true);
        rootWindow.addEventListener('pointermove', moveCtrlLeftCanvasDrag, true);
        rootWindow.addEventListener('mousemove', moveCtrlLeftCanvasDrag, true);
        rootWindow.addEventListener('pointerup', endCtrlLeftCanvasDrag, true);
        rootWindow.addEventListener('mouseup', endCtrlLeftCanvasDrag, true);
        rootWindow.addEventListener('pointercancel', endCtrlLeftCanvasDrag, true);
        rootWindow.addEventListener('keydown', onWindowKeydown, true);
        rootWindow.addEventListener('keyup', onWindowKeyup, true);
        rootWindow.addEventListener('blur', resetCtrlLeftCanvasDrag);
      }
    }

    function removeListeners() {
      if (viewerEl && typeof viewerEl.removeEventListener === 'function') {
        viewerEl.removeEventListener('wheel', blockCanvasNativeGesture, true);
        viewerEl.removeEventListener('touchstart', blockCanvasNativeGesture, true);
        viewerEl.removeEventListener('touchmove', blockCanvasNativeGesture, true);
        viewerEl.removeEventListener('gesturestart', blockCanvasNativeGesture, true);
        viewerEl.removeEventListener('gesturechange', blockCanvasNativeGesture, true);
        viewerEl.removeEventListener('gestureend', blockCanvasNativeGesture, true);
        viewerEl.removeEventListener('pointerdown', beginCtrlLeftCanvasDrag, true);
      }
      if (rootWindow && typeof rootWindow.removeEventListener === 'function') {
        rootWindow.removeEventListener('pointerdown', onWindowPointerDown, true);
        rootWindow.removeEventListener('mousedown', beginCtrlLeftCanvasDrag, true);
        rootWindow.removeEventListener('pointermove', moveCtrlLeftCanvasDrag, true);
        rootWindow.removeEventListener('mousemove', moveCtrlLeftCanvasDrag, true);
        rootWindow.removeEventListener('pointerup', endCtrlLeftCanvasDrag, true);
        rootWindow.removeEventListener('mouseup', endCtrlLeftCanvasDrag, true);
        rootWindow.removeEventListener('pointercancel', endCtrlLeftCanvasDrag, true);
        rootWindow.removeEventListener('keydown', onWindowKeydown, true);
        rootWindow.removeEventListener('keyup', onWindowKeyup, true);
        rootWindow.removeEventListener('blur', resetCtrlLeftCanvasDrag);
      }
    }

    var instance = getInstance();
    var syncZoomHook = function() { syncZoomMinScaleWithCurrent(getInstance()); };
    var syncCtrlWheelHook = function(forceReset) {
      syncCtrlWheelMinScaleWithCurrent(getInstance(), forceReset === true);
    };
    if (instance && typeof instance === 'object') {
      instance.__tapViewportInteracted = false;
      instance.__tapSyncZoomMinScale = syncZoomHook;
      instance.__tapSyncCtrlWheelMinScale = syncCtrlWheelHook;
    }
    syncInstanceScaleBounds(instance, zoomMinScale);
    updateViewerDragState(viewerEl, instance, false);
    installListeners();

    function handleLayoutChange(reason) {
      if (destroyed) return;
      updateViewerDragState(viewerEl, getInstance(), false);
      notifyViewportStateChange(reason || 'layout');
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      removeListeners();
      resetCtrlLeftCanvasDrag();
      clearFitTimers();
      if (pendingViewportPan.frameId) cancelViewportFrame(pendingViewportPan.frameId);
      pendingViewportPan.frameId = 0;
      pendingViewportPan.deltaX = 0;
      pendingViewportPan.deltaY = 0;
      if (
        activeControllerByViewer
        && viewerEl
        && activeControllerByViewer.get(viewerEl) === controllerApi
      ) {
        activeControllerByViewer.delete(viewerEl);
      }
      var target = getInstance();
      if (target && typeof target === 'object') {
        if (target.__tapSyncZoomMinScale === syncZoomHook) delete target.__tapSyncZoomMinScale;
        if (target.__tapSyncCtrlWheelMinScale === syncCtrlWheelHook) delete target.__tapSyncCtrlWheelMinScale;
        delete target.__tapViewportInteracted;
      }
    }

    var controllerApi = {
      zoomBy: zoomBy,
      zoomFit: zoomFit,
      queuePan: queueViewportPan,
      syncScaleBounds: syncInstanceScaleBounds,
      syncZoomMinScaleWithCurrent: syncZoomMinScaleWithCurrent,
      syncCtrlWheelMinScaleWithCurrent: syncCtrlWheelMinScaleWithCurrent,
      syncDragState: function(dragging) {
        updateViewerDragState(viewerEl, getInstance(), dragging === true);
      },
      handleLayoutChange: handleLayoutChange,
      isCtrlModifierActive: isCtrlModifierActive,
      markInteracted: markViewportInteraction,
      destroy: destroy,
      getState: function() {
        return {
          zoomMinScale: zoomMinScale,
          ctrlWheelMinScale: ctrlWheelMinScale,
          ctrlModifierPressed: ctrlModifierPressed,
          dragging: ctrlLeftCanvasDrag.active,
        };
      },
    };
    if (activeControllerByViewer && viewerEl) {
      activeControllerByViewer.set(viewerEl, controllerApi);
    }
    return controllerApi;
  }

  window.app = window.app || {};
  window.app.mindElixirViewportController = {
    clampScale: clampScale,
    resolveScale: resolveScale,
    updateViewerDragState: updateViewerDragState,
    parseTransformState: parseTransformState,
    writeTransformState: writeTransformState,
    create: create,
  };
})();
