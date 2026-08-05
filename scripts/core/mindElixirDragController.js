(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.mindElixirDragController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var viewerEl = opts.viewerEl || null;
    var browser = opts.window || (typeof window !== 'undefined' ? window : null);
    var documentRef = opts.document || (typeof document !== 'undefined' ? document : null);
    var bound = false;
    var customDragGhostEl = null;
    var pointerDragThreshold = 3;
    var pointerDragState = {
      active: false, moving: false, pointerId: null, startX: 0, startY: 0, previewText: '', nodeId: '',
    };
    var rightDragState = { active: false, pointerId: null, captureTarget: null, suppressContextUntil: 0 };

    function call(name) {
      if (typeof opts[name] !== 'function') return undefined;
      return opts[name].apply(null, Array.prototype.slice.call(arguments, 1));
    }

    function schedule(callback) {
      if (typeof opts.setTimeout === 'function') return opts.setTimeout(callback, 0);
      return setTimeout(callback, 0);
    }

    function isEditing() { return call('isEditing') === true; }

    function isPendingSave() { return call('isPendingSave') === true; }

    function clearPointerDragState() {
      Object.assign(pointerDragState, {
        active: false, moving: false, pointerId: null, startX: 0, startY: 0, previewText: '', nodeId: '',
      });
    }

    function extractNodeTopic(nodeEl) {
      if (!nodeEl || !nodeEl.nodeObj) return '';
      if (nodeEl.nodeObj.topic === undefined || nodeEl.nodeObj.topic === null) return '';
      return String(nodeEl.nodeObj.topic || '').trim();
    }

    function resolvePointerPreviewText(fallbackNodeEl) {
      var selected = call('collectSelectedNodes');
      selected = Array.isArray(selected) ? selected : [];
      if (selected.length > 1) return String(selected.length) + ' 个节点';
      if (selected.length === 1) {
        var selectedTopic = extractNodeTopic(selected[0]);
        if (selectedTopic) return selectedTopic;
      }
      return extractNodeTopic(fallbackNodeEl) || '拖拽节点';
    }

    function getDraggedPreviewText(instance) {
      var dragged = instance && Array.isArray(instance.dragged) ? instance.dragged : [];
      if (!dragged.length) return '拖拽节点';
      if (dragged.length > 1) return String(dragged.length) + ' 个节点';
      return extractNodeTopic(dragged[0]) || '拖拽节点';
    }

    function onViewerPointerDownForPreview(event) {
      call('clearClickEditTimer');
      var invalidTarget = call('isNodeExpanderTarget', event && event.target) === true
        || call('isTypingTarget', event && event.target) === true;
      if (!event || invalidTarget || !isEditing() || event.button !== 0 || event.ctrlKey
        || call('isEventInsideControls', event.target) === true) {
        clearPointerDragState();
        return;
      }
      var nodeEl = event.target && event.target.closest ? event.target.closest('me-tpc') : null;
      if (!nodeEl || !nodeEl.nodeObj) {
        clearPointerDragState();
        return;
      }
      pointerDragState.active = true;
      pointerDragState.moving = false;
      pointerDragState.pointerId = typeof event.pointerId === 'number' ? event.pointerId : null;
      pointerDragState.startX = typeof event.clientX === 'number' ? event.clientX : 0;
      pointerDragState.startY = typeof event.clientY === 'number' ? event.clientY : 0;
      pointerDragState.previewText = resolvePointerPreviewText(nodeEl);
      pointerDragState.nodeId = nodeEl.nodeObj.id === undefined || nodeEl.nodeObj.id === null
        ? ''
        : String(nodeEl.nodeObj.id);
    }

    function canUsePointerPreview(event) {
      if (!pointerDragState.active || !event) return false;
      if (pointerDragState.pointerId !== null && typeof event.pointerId === 'number'
        && event.pointerId !== pointerDragState.pointerId) {
        return false;
      }
      if (typeof event.buttons === 'number' && (event.buttons & 1) !== 1) return false;
      return typeof event.clientX === 'number' && typeof event.clientY === 'number';
    }

    function ensureCustomGhost() {
      if (customDragGhostEl && customDragGhostEl.parentNode) return customDragGhostEl;
      if (!documentRef || !documentRef.createElement || !documentRef.body || !documentRef.body.appendChild) return null;
      var element = documentRef.createElement('div');
      element.className = 'xmind-custom-drag-ghost';
      element.style.display = 'none';
      if (element.setAttribute) element.setAttribute('aria-hidden', 'true');
      documentRef.body.appendChild(element);
      customDragGhostEl = element;
      return element;
    }

    function updateCustomGhostPosition(clientX, clientY) {
      var element = ensureCustomGhost();
      var x = Number(clientX);
      var y = Number(clientY);
      if (!element || !isFinite(x) || !isFinite(y)) return;
      element.style.transform = 'translate(' + (x + 12) + 'px, ' + (y + 12) + 'px)';
    }

    function showCustomGhost(clientX, clientY, text) {
      var element = ensureCustomGhost();
      if (!element) return;
      var preview = text === undefined || text === null ? '' : String(text).trim();
      element.textContent = preview || '拖拽节点';
      if (element.classList) element.classList.add('is-visible');
      element.style.display = 'block';
      element.style.visibility = 'visible';
      element.style.opacity = '0.98';
      updateCustomGhostPosition(clientX, clientY);
    }

    function hideCustomGhost() {
      if (!customDragGhostEl) return;
      if (customDragGhostEl.classList) customDragGhostEl.classList.remove('is-visible');
      customDragGhostEl.style.opacity = '0';
      customDragGhostEl.style.visibility = 'hidden';
      customDragGhostEl.style.display = 'none';
    }

    function releaseCustomGhost() {
      var element = customDragGhostEl;
      if (!element) return;
      hideCustomGhost();
      if (element.parentNode && typeof element.parentNode.removeChild === 'function') {
        try {
          element.parentNode.removeChild(element);
        } catch (err) {
          // ignore
        }
      }
      customDragGhostEl = null;
    }

    function getNativeGhost(includeHidden) {
      var instance = call('getInstance');
      var list = instance && Array.isArray(instance.__tapDetachedNodes) ? instance.__tapDetachedNodes : [];
      var ghost = list.length ? list[0] : null;
      if (!ghost && documentRef && documentRef.querySelector) {
        ghost = documentRef.querySelector('.xmind-floating-ghost, .mind-elixir-ghost');
      }
      if (!ghost || !ghost.style) return null;
      if (includeHidden) return ghost;
      var visible = ghost.style.display !== 'none';
      if (!visible && browser && typeof browser.getComputedStyle === 'function') {
        try {
          var style = browser.getComputedStyle(ghost);
          visible = Boolean(style && style.display !== 'none');
        } catch (err) {
          visible = false;
        }
      }
      return visible ? ghost : null;
    }

    function setNativeGhostContent(ghost, instance) {
      var preview = getDraggedPreviewText(instance);
      if (!ghost) return preview;
      if (String(ghost.textContent || '').trim()) {
        if (ghost.removeAttribute) ghost.removeAttribute('data-drag-placeholder');
        return preview;
      }
      var textEl = ghost.querySelector ? ghost.querySelector('.text') : null;
      if (textEl) textEl.textContent = preview;
      else ghost.textContent = preview;
      if (ghost.setAttribute) ghost.setAttribute('data-drag-placeholder', '1');
      return preview;
    }

    function markNativeGhostIdle() {
      var ghost = getNativeGhost(true);
      if (!ghost) return;
      if (ghost.classList) ghost.classList.remove('xmind-floating-ghost-active');
      if (ghost.removeAttribute) ghost.removeAttribute('data-drag-placeholder');
    }

    function resetPreview() {
      markNativeGhostIdle();
      hideCustomGhost();
      clearPointerDragState();
    }

    function syncPointerPreview(event) {
      if (!canUsePointerPreview(event)) return false;
      var deltaX = Math.abs(event.clientX - pointerDragState.startX);
      var deltaY = Math.abs(event.clientY - pointerDragState.startY);
      if (!pointerDragState.moving) {
        if (deltaX < pointerDragThreshold && deltaY < pointerDragThreshold) return false;
        pointerDragState.moving = true;
      }
      showCustomGhost(event.clientX, event.clientY, pointerDragState.previewText);
      return true;
    }

    function syncDragGhostFollowPointer(event) {
      if (!event) return;
      var instance = call('getInstance');
      var nativeDragging = Boolean(instance && instance.dragged && instance.dragged.length);
      var pointerDragging = syncPointerPreview(event);
      if (!nativeDragging && !pointerDragging) {
        if (!canUsePointerPreview(event)) resetPreview();
        return;
      }
      if (!nativeDragging || typeof event.clientX !== 'number' || typeof event.clientY !== 'number') return;
      showCustomGhost(event.clientX, event.clientY, getDraggedPreviewText(instance));
      var ghost = getNativeGhost(false);
      if (!ghost) return;
      if (ghost.classList) ghost.classList.add('xmind-floating-ghost-active');
      ghost.style.display = 'block';
      ghost.style.visibility = 'visible';
      ghost.style.opacity = '0.96';
      setNativeGhostContent(ghost, instance);
      var rect = ghost.getBoundingClientRect ? ghost.getBoundingClientRect() : null;
      var offsetX = rect && rect.width > 0 ? rect.width / 2 : 0;
      var offsetY = rect && rect.height > 0 ? rect.height / 2 : 0;
      ghost.style.transform = 'translate(' + (event.clientX - offsetX) + 'px, ' + (event.clientY - offsetY) + 'px)';
    }

    function releaseRightDragCapture() {
      var target = rightDragState.captureTarget;
      var pointerId = rightDragState.pointerId;
      if (!target || pointerId === null || typeof target.releasePointerCapture !== 'function') return;
      try {
        if (typeof target.hasPointerCapture !== 'function' || target.hasPointerCapture(pointerId)) {
          target.releasePointerCapture(pointerId);
        }
      } catch (err) {
        // ignore
      }
    }

    function resetRightDrag() {
      releaseRightDragCapture();
      rightDragState.active = false;
      rightDragState.pointerId = null;
      rightDragState.captureTarget = null;
      if (viewerEl && viewerEl.classList) viewerEl.classList.remove('is-right-dragging');
    }

    function activateRightDrag(event, capturePointer) {
      rightDragState.suppressContextUntil = Date.now() + 1800;
      if (rightDragState.active) {
        if (event && event.preventDefault) event.preventDefault();
        return true;
      }
      var pointerId = event && typeof event.pointerId === 'number' ? event.pointerId : null;
      rightDragState.active = true;
      rightDragState.pointerId = pointerId;
      rightDragState.captureTarget = null;
      if (capturePointer && pointerId !== null) {
        var target = event.target && typeof event.target.setPointerCapture === 'function'
          ? event.target
          : (viewerEl && typeof viewerEl.setPointerCapture === 'function' ? viewerEl : null);
        if (target) {
          try {
            target.setPointerCapture(pointerId);
            rightDragState.captureTarget = target;
          } catch (err) {
            // ignore
          }
        }
      }
      if (viewerEl && viewerEl.classList) viewerEl.classList.add('is-right-dragging');
      if (event && event.preventDefault) event.preventDefault();
      return true;
    }

    function beginPointerRightDrag(event) {
      if (!event || event.button !== 2) return false;
      if (event.pointerType && event.pointerType !== 'mouse') return false;
      if (call('isEventInsideControls', event.target) === true) return false;
      if (call('selectModifiedNodeFromEvent', event) === true) {
        if (event.preventDefault) event.preventDefault();
        return true;
      }
      return activateRightDrag(event, true);
    }

    function beginLegacyRightDrag(event) {
      if (!event || event.button !== 2) return false;
      return activateRightDrag(event, false);
    }

    function shouldSuppressContextMenu() {
      return rightDragState.active || Date.now() <= Number(rightDragState.suppressContextUntil || 0);
    }

    function moveRightDrag(event) {
      if (!rightDragState.active || !event) return;
      if (rightDragState.pointerId !== null && typeof event.pointerId === 'number'
        && event.pointerId !== rightDragState.pointerId) {
        return;
      }
      if (typeof event.buttons === 'number' && (event.buttons & 2) !== 2) {
        resetRightDrag();
        return;
      }
      rightDragState.suppressContextUntil = Date.now() + 1800;
      if (event.preventDefault) event.preventDefault();
    }

    function endRightDrag(event) {
      if (!rightDragState.active) return;
      if (rightDragState.pointerId !== null && event && typeof event.pointerId === 'number'
        && event.pointerId !== rightDragState.pointerId) {
        return;
      }
      if (event && typeof event.buttons === 'number' && (event.buttons & 2) === 2) return;
      rightDragState.suppressContextUntil = Date.now() + 1800;
      if (event && event.preventDefault) event.preventDefault();
      resetRightDrag();
    }

    function preventWhenRightDragging(event) {
      if (rightDragState.active && event && event.preventDefault) event.preventDefault();
    }

    function applyDirectionToTree(node, direction) {
      if (!node) return;
      node.direction = direction;
      var children = Array.isArray(node.children) ? node.children : [];
      for (var i = 0; i < children.length; i += 1) applyDirectionToTree(children[i], direction);
    }

    function findDataNode(rootNode, nodeId, parentNode) {
      return call('findNodeWithParentById', rootNode, nodeId, parentNode) || null;
    }

    function resolveNodeDirection(nodeId, instance) {
      var leftDirection = instance && typeof instance.LEFT === 'number' ? instance.LEFT : 0;
      var rightDirection = instance && typeof instance.RIGHT === 'number' ? instance.RIGHT : 1;
      var nodeEl = call('findNodeElement', instance, nodeId);
      var mainEl = nodeEl && nodeEl.closest ? nodeEl.closest('me-main') : null;
      if (mainEl && mainEl.classList) {
        if (mainEl.classList.contains('lhs')) return leftDirection;
        if (mainEl.classList.contains('rhs')) return rightDirection;
      }
      var data = call('getCurrentMindData');
      var found = data && data.nodeData ? findDataNode(data.nodeData, nodeId, null) : null;
      if (found && found.node && found.node.direction !== undefined && found.node.direction !== null) {
        return Number(found.node.direction);
      }
      return rightDirection;
    }

    function moveRootNodeAcrossSide(nodeId, pointerClientX) {
      if (!isEditing() || isPendingSave() || !nodeId || !isFinite(pointerClientX)) return false;
      var instance = call('getInstance');
      if (!instance || typeof instance.refresh !== 'function' || !instance.nodeData) return false;
      var rootTopicEl = instance.container && instance.container.querySelector
        ? instance.container.querySelector('me-root > me-tpc')
        : null;
      if (!rootTopicEl || !rootTopicEl.getBoundingClientRect) return false;
      var rootRect = rootTopicEl.getBoundingClientRect();
      var rootCenterX = rootRect.left + (rootRect.width / 2);
      var leftDirection = typeof instance.LEFT === 'number' ? instance.LEFT : 0;
      var rightDirection = typeof instance.RIGHT === 'number' ? instance.RIGHT : 1;
      var sideDirection = typeof instance.SIDE === 'number' ? instance.SIDE : 2;
      var nextDirection = pointerClientX < rootCenterX ? leftDirection : rightDirection;
      if (Number(resolveNodeDirection(nodeId, instance)) === Number(nextDirection)) return false;
      var nextData = call('getCurrentMindData');
      var target = nextData && nextData.nodeData ? findDataNode(nextData.nodeData, nodeId, null) : null;
      if (!target || !target.node || !target.parent || target.parent !== nextData.nodeData) return false;
      if (typeof instance.initSide === 'function' && Number(instance.direction) !== Number(sideDirection)) {
        try {
          instance.initSide();
        } catch (err) {
          // ignore
        }
      }
      applyDirectionToTree(target.node, nextDirection);
      if (call('refreshMindData', nextData) === false) return false;
      call('onRootSideMoved');
      return true;
    }

    function onWindowPointerUpForRootSideSwitch(event) {
      if (!isEditing() || isPendingSave() || !pointerDragState.active || !pointerDragState.moving) return;
      if (pointerDragState.pointerId !== null && event && typeof event.pointerId === 'number'
        && event.pointerId !== pointerDragState.pointerId) {
        return;
      }
      var nodeId = pointerDragState.nodeId ? String(pointerDragState.nodeId) : '';
      var pointerClientX = Number(event && event.clientX);
      if (!nodeId || !isFinite(pointerClientX)) return;
      schedule(function() { moveRootNodeAcrossSide(nodeId, pointerClientX); });
    }

    var viewerBindings = [
      ['pointerdown', beginPointerRightDrag, true],
      ['pointerdown', onViewerPointerDownForPreview, true],
    ];
    var windowBindings = [
      ['pointermove', moveRightDrag, true], ['mousemove', moveRightDrag, true],
      ['pointerup', endRightDrag, true], ['mouseup', endRightDrag, true],
      ['pointercancel', endRightDrag, true], ['dragstart', preventWhenRightDragging, true],
      ['selectstart', preventWhenRightDragging, true], ['blur', resetRightDrag, false],
      ['pointermove', syncDragGhostFollowPointer, false], ['mousemove', syncDragGhostFollowPointer, false],
      ['pointerup', onWindowPointerUpForRootSideSwitch, true], ['pointerup', resetPreview, true],
      ['mouseup', resetPreview, true], ['pointercancel', resetPreview, true],
    ];

    function updateBindings(target, bindings, methodName) {
      if (!target || typeof target[methodName] !== 'function') return;
      bindings.forEach(function(binding) {
        target[methodName](binding[0], binding[1], binding[2]);
      });
    }

    function bind() {
      if (bound || !viewerEl || typeof viewerEl.addEventListener !== 'function') return false;
      bound = true;
      updateBindings(viewerEl, viewerBindings, 'addEventListener');
      updateBindings(browser, windowBindings, 'addEventListener');
      return true;
    }

    function destroy() {
      if (bound) {
        updateBindings(viewerEl, viewerBindings, 'removeEventListener');
        updateBindings(browser, windowBindings, 'removeEventListener');
      }
      bound = false;
      resetRightDrag();
      resetPreview();
      releaseCustomGhost();
    }

    return { bind: bind, destroy: destroy, beginLegacyRightDrag: beginLegacyRightDrag,
      shouldSuppressContextMenu: shouldSuppressContextMenu, resetPreview: resetPreview };
  }

  return { create: create };
});
