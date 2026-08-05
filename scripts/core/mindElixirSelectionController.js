(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.mindElixirSelectionController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var viewerEl = opts.viewerEl || null;
    var browser = opts.window || (typeof window !== 'undefined' ? window : null);
    var documentRef = opts.document || (typeof document !== 'undefined' ? document : null);
    var enabled = opts.enabled === true;
    var selectionModelOwner = opts.selectionModelOwner || null;
    if (!selectionModelOwner || typeof selectionModelOwner.create !== 'function') {
      throw new Error('MindElixir selection model is unavailable');
    }

    var bound = false;
    var boxPending = false;
    var boxSelecting = false;
    var boxMoved = false;
    var boxStartX = 0;
    var boxStartY = 0;
    var boxRectEl = null;
    var commitTimer = 0;
    var boxSuppressClickUntil = 0;
    var modifierSuppressClickUntil = 0;
    var customSelectionNodes = [];
    var modifierPointerGuard = { until: 0, nodeKey: '' };

    function call(name) {
      if (typeof opts[name] !== 'function') return undefined;
      return opts[name].apply(null, Array.prototype.slice.call(arguments, 1));
    }

    function isEditing() {
      return call('isEditing') === true;
    }

    function isPendingSave() {
      return call('isPendingSave') === true;
    }

    function isSelectableNode(node) {
      return Boolean(node && node.tagName && String(node.tagName).toLowerCase() === 'me-tpc');
    }

    function findNodeById(nodeId) {
      return call('findNodeById', String(nodeId || '')) || null;
    }

    function findNodeBySelectionGroup(groupKey) {
      var key = groupKey === null || groupKey === undefined ? '' : String(groupKey);
      if (!key || !viewerEl || !viewerEl.querySelectorAll) return null;
      var nodes = viewerEl.querySelectorAll('me-tpc[data-xmind-select-group]');
      var fallback = null;
      for (var i = 0; i < nodes.length; i += 1) {
        var node = nodes[i];
        if (!node || !node.getAttribute) continue;
        if (String(node.getAttribute('data-xmind-select-group') || '') !== key) continue;
        if (!fallback) fallback = node;
        if (node.getAttribute('data-xmind-select-preferred') === '1') return node;
      }
      return fallback;
    }

    function shouldPreserveActualNode(normalizeOptions) {
      return isEditing() || Boolean(normalizeOptions && normalizeOptions.preserveActualNodes === true);
    }

    function resolveNode(node, normalizeOptions) {
      if (!isSelectableNode(node)) return null;
      if (shouldPreserveActualNode(normalizeOptions)) return node;
      var groupKey = node.getAttribute ? String(node.getAttribute('data-xmind-select-group') || '') : '';
      return groupKey ? findNodeBySelectionGroup(groupKey) || node : node;
    }

    function getIdentityKey(node, normalizeOptions) {
      if (!isSelectableNode(node)) return '';
      var key = !shouldPreserveActualNode(normalizeOptions) && node.getAttribute
        ? String(node.getAttribute('data-xmind-select-group') || '')
        : '';
      if (!key && node.getAttribute) key = String(node.getAttribute('data-nodeid') || '');
      if (!key) {
        var nodeId = node.nodeObj && node.nodeObj.id ? String(node.nodeObj.id) : '';
        var path = call('collectNodeLocatePath', node);
        var locatePath = Array.isArray(path) ? path.join('>') : '';
        if (nodeId || locatePath) key = nodeId + '::' + locatePath;
      }
      return key;
    }

    var selectionModel = selectionModelOwner.create({
      isSelectableNode: isSelectableNode,
      resolveNode: resolveNode,
      getIdentityKey: getIdentityKey,
      getParent: function(node) {
        if (node && node.nodeObj) return node.nodeObj.parent || null;
        return node && node.parent ? node.parent : null;
      },
      getNodeId: function(node) {
        var value = node && node.nodeObj ? node.nodeObj.id : node && node.id;
        return value !== undefined && value !== null ? String(value) : '';
      },
      getNodeDepth: function(node) {
        var path = call('collectNodeLocatePath', node);
        return Array.isArray(path) ? path.length : 0;
      },
    });

    function buildDefaultGroupDescriptor(nodeMeta) {
      return selectionModel.buildDefaultGroupDescriptor(nodeMeta, { enabled: enabled });
    }

    function applyDefaultGroup(nodeEl, nodeMeta) {
      if (!enabled || !nodeEl || !nodeEl.getAttribute || !nodeEl.setAttribute) return;
      if (String(nodeEl.getAttribute('data-xmind-select-group') || '').trim()) return;
      var descriptor = buildDefaultGroupDescriptor(nodeMeta);
      if (!descriptor || !descriptor.key) return;
      nodeEl.setAttribute('data-xmind-select-group', String(descriptor.key));
      nodeEl.setAttribute('data-xmind-select-preferred', descriptor.preferred ? '1' : '0');
    }

    function clearCommitTimer() {
      if (!commitTimer) return;
      if (typeof opts.clearTimeout === 'function') opts.clearTimeout(commitTimer);
      else clearTimeout(commitTimer);
      commitTimer = 0;
    }

    function schedule(callback) {
      return typeof opts.setTimeout === 'function' ? opts.setTimeout(callback, 0) : setTimeout(callback, 0);
    }

    function clearSelectionClasses() {
      if (!viewerEl || !viewerEl.querySelectorAll) return;
      var selected = viewerEl.querySelectorAll('me-tpc.xmind-box-selected');
      Array.prototype.forEach.call(selected || [], function(node) {
        if (node && node.classList) node.classList.remove('xmind-box-selected');
      });
    }

    function getBoxSelectedNodes() {
      if (!viewerEl || !viewerEl.querySelectorAll) return [];
      var selected = viewerEl.querySelectorAll('me-tpc.xmind-box-selected');
      var out = [];
      Array.prototype.forEach.call(selected || [], function(node) {
        if (isSelectableNode(node)) out.push(node);
      });
      return out;
    }

    function setCustomSelectionNodes(nodes) {
      customSelectionNodes = (Array.isArray(nodes) ? nodes : []).filter(isSelectableNode);
    }

    function normalizeNodes(nodes, normalizeOptions) {
      return selectionModel.normalizeNodes(nodes, normalizeOptions);
    }

    function syncNativeSelection(nodes) {
      var instance = call('getInstance');
      if (!instance) return;
      var selected = (Array.isArray(nodes) ? nodes : []).filter(isSelectableNode);
      try {
        if (typeof instance.clearSelection === 'function') instance.clearSelection();
      } catch (err) {
        // ignore
      }
      if (!selected.length) return;
      if (typeof instance.selectNodes === 'function') {
        try {
          instance.selectNodes(selected);
          return;
        } catch (err2) {
          // ignore
        }
      }
      if (selected.length === 1 && typeof instance.selectNode === 'function') {
        try {
          instance.selectNode(selected[0]);
        } catch (err3) {
          // ignore
        }
      }
    }

    function resolveLiveNode(node, normalizeOptions) {
      if (!node) return null;
      var hasViewerContains = viewerEl && typeof viewerEl.contains === 'function';
      if (node.isConnected && (!hasViewerContains || viewerEl.contains(node))) return node;
      var groupKey = node.getAttribute ? String(node.getAttribute('data-xmind-select-group') || '') : '';
      if (!shouldPreserveActualNode(normalizeOptions) && groupKey) {
        return findNodeBySelectionGroup(groupKey) || node;
      }
      return node.nodeObj && node.nodeObj.id ? findNodeById(node.nodeObj.id) || node : node;
    }

    function apply(nodes, normalizeOptions) {
      var selected = normalizeNodes((Array.isArray(nodes) ? nodes : []).filter(isSelectableNode), normalizeOptions);
      setCustomSelectionNodes(selected);
      clearSelectionClasses();
      syncNativeSelection(selected);
      var displayNodes = [];
      selected.forEach(function(node) {
        var liveNode = resolveLiveNode(node, normalizeOptions);
        if (liveNode && displayNodes.indexOf(liveNode) === -1) displayNodes.push(liveNode);
      });
      (displayNodes.length ? displayNodes : selected).forEach(function(node) {
        if (node && node.classList) node.classList.add('xmind-box-selected');
      });
      return selected;
    }

    function collect(normalizeOptions) {
      var instance = call('getInstance');
      var out = [];
      var seen = Object.create(null);
      function pushNode(node) {
        var resolved = resolveNode(node, normalizeOptions) || node;
        if (!isSelectableNode(resolved)) return;
        var key = getIdentityKey(resolved, normalizeOptions);
        if (!key || seen[key]) return;
        seen[key] = true;
        out.push(resolved);
      }
      var customOnly = enabled && !isEditing() && customSelectionNodes.length > 0;
      var current = instance && Array.isArray(instance.currentNodes) ? instance.currentNodes : [];
      if (!customOnly) current.forEach(pushNode);
      customSelectionNodes.forEach(function(node) { pushNode(resolveLiveNode(node, normalizeOptions)); });
      if (viewerEl && viewerEl.querySelectorAll) {
        Array.prototype.forEach.call(viewerEl.querySelectorAll('.selected') || [], function(node) {
          pushNode(node && node.closest ? node.closest('me-tpc') : null);
        });
        Array.prototype.forEach.call(
          viewerEl.querySelectorAll('me-tpc.xmind-box-selected') || [],
          pushNode
        );
      }
      return out;
    }

    function toggle(nodeEl) {
      if (!enabled || !nodeEl) return [];
      var next = selectionModel.toggleNode(collect(), nodeEl);
      if (!next) return [];
      if (isEditing()) {
        setCustomSelectionNodes([]);
        clearSelectionClasses();
        syncNativeSelection(next);
      } else {
        apply(next);
      }
      return next;
    }

    function clear(syncMindSelection) {
      clearCommitTimer();
      setCustomSelectionNodes([]);
      clearSelectionClasses();
      if (syncMindSelection === true) syncNativeSelection([]);
    }

    function resetModifierPointerGuard() {
      modifierPointerGuard.until = 0;
      modifierPointerGuard.nodeKey = '';
    }

    function markModifierPointerGuard(node) {
      var resolved = resolveNode(node) || node;
      var key = getIdentityKey(resolved);
      if (!key) return resetModifierPointerGuard();
      modifierPointerGuard.until = Date.now() + 320;
      modifierPointerGuard.nodeKey = key;
    }

    function shouldSkipModifierMouseEvent(event, node) {
      if (!event || event.type !== 'mousedown' || !modifierPointerGuard.nodeKey) return false;
      if (Date.now() > Number(modifierPointerGuard.until || 0)) {
        resetModifierPointerGuard();
        return false;
      }
      var key = getIdentityKey(resolveNode(node) || node);
      if (!key || key !== modifierPointerGuard.nodeKey) return false;
      resetModifierPointerGuard();
      return true;
    }

    function preventEvent(event, immediate) {
      if (!event) return;
      if (event.preventDefault) event.preventDefault();
      if (immediate && event.stopImmediatePropagation) event.stopImmediatePropagation();
      else if (event.stopPropagation) event.stopPropagation();
    }

    function prepareSelection() {
      call('hideContextMenu');
      call('clearClickEditTimer');
      call('focusViewer');
    }

    function isCtrlActive(event) {
      return call('isCtrlModifierActive', event) === true || Boolean(event && event.metaKey);
    }

    function selectModifiedNodeFromEvent(event) {
      if (!enabled || !event || !isCtrlActive(event)) return false;
      if (call('isEventInsideControls', event.target) === true) return false;
      var node = call('resolveEventNode', event);
      if (!node) return false;
      prepareSelection();
      toggle(node);
      modifierSuppressClickUntil = Date.now() + 220;
      call('updateEditButtons');
      return true;
    }

    function beginModifierNodeSelection(event) {
      if (!enabled || isPendingSave() || !event || event.button !== 0 || !isCtrlActive(event)) return false;
      var node = call('resolveEventNode', event);
      if (!node || call('isEventInsideControls', event.target) === true) return false;
      if (call('isNodeExpanderTarget', event.target) === true) return false;
      if (shouldSkipModifierMouseEvent(event, node)) {
        preventEvent(event, true);
        return true;
      }
      if (!selectModifiedNodeFromEvent(event)) return false;
      if (event.type === 'pointerdown') markModifierPointerGuard(node);
      else resetModifierPointerGuard();
      preventEvent(event, true);
      return true;
    }

    function ensureBoxRect() {
      if (boxRectEl && boxRectEl.isConnected && boxRectEl.parentNode === viewerEl) return boxRectEl;
      if (boxRectEl && boxRectEl.parentNode && boxRectEl.parentNode.removeChild) {
        try { boxRectEl.parentNode.removeChild(boxRectEl); } catch (err) {}
      }
      boxRectEl = null;
      if (!viewerEl || !viewerEl.appendChild || !documentRef || !documentRef.createElement) return null;
      boxRectEl = documentRef.createElement('div');
      boxRectEl.className = 'xmind-box-select-rect';
      boxRectEl.style.display = 'none';
      viewerEl.appendChild(boxRectEl);
      return boxRectEl;
    }

    function hideBoxRect(resetSize) {
      if (viewerEl && viewerEl.classList) viewerEl.classList.remove('is-box-selecting');
      if (!boxRectEl || !boxRectEl.style) return;
      boxRectEl.style.display = 'none';
      if (resetSize === true) {
        boxRectEl.style.width = '0px';
        boxRectEl.style.height = '0px';
      }
    }

    function resolveBoxSelectableNode(node) {
      var current = node || null;
      while (current) {
        if (isSelectableNode(current)) {
          var key = current.getAttribute ? String(current.getAttribute('data-xmind-select-group') || '') : '';
          if (key) {
            return {
              node: current,
              key: key,
              preferred: current.getAttribute('data-xmind-select-preferred') === '1',
            };
          }
        }
        if (!current.parentElement || current.parentElement === viewerEl) break;
        current = current.parentElement.closest ? current.parentElement.closest('me-tpc') : null;
      }
      return null;
    }

    function updateBoxSelection(currentX, currentY) {
      if (!viewerEl) return;
      var left = Math.min(boxStartX, currentX);
      var right = Math.max(boxStartX, currentX);
      var top = Math.min(boxStartY, currentY);
      var bottom = Math.max(boxStartY, currentY);
      if (boxRectEl && viewerEl.getBoundingClientRect) {
        var viewerRect = viewerEl.getBoundingClientRect();
        var drawLeft = Math.max(0, left - viewerRect.left);
        var drawTop = Math.max(0, top - viewerRect.top);
        var drawRight = Math.min(viewerRect.width, right - viewerRect.left);
        var drawBottom = Math.min(viewerRect.height, bottom - viewerRect.top);
        boxRectEl.style.display = 'block';
        boxRectEl.style.left = drawLeft + 'px';
        boxRectEl.style.top = drawTop + 'px';
        boxRectEl.style.width = Math.max(0, drawRight - drawLeft) + 'px';
        boxRectEl.style.height = Math.max(0, drawBottom - drawTop) + 'px';
      }
      if (!viewerEl.querySelectorAll) return;
      var hitMap = Object.create(null);
      var hitNodes = [];
      Array.prototype.forEach.call(viewerEl.querySelectorAll('me-tpc') || [], function(node) {
        if (!node || !node.getBoundingClientRect) return;
        var rect = node.getBoundingClientRect();
        if (rect.right < left || rect.left > right || rect.bottom < top || rect.top > bottom) return;
        var resolved = resolveBoxSelectableNode(node);
        if (!resolved || !resolved.key) return;
        if (!hitMap[resolved.key]) {
          hitMap[resolved.key] = resolved;
          hitNodes.push(resolved.node);
        } else if (resolved.preferred && !hitMap[resolved.key].preferred) {
          var index = hitNodes.indexOf(hitMap[resolved.key].node);
          hitMap[resolved.key] = resolved;
          if (index >= 0) hitNodes[index] = resolved.node;
        }
      });
      clearSelectionClasses();
      hitNodes.forEach(function(node) {
        if (node && node.classList) node.classList.add('xmind-box-selected');
      });
    }

    function startBoxSelection(event) {
      if (!enabled || isEditing() || isPendingSave() || !event || event.button !== 0) return;
      if (event.pointerType && event.pointerType !== 'mouse') return;
      if (boxPending || boxSelecting || isCtrlActive(event)) return;
      if (call('isEventInsideControls', event.target) === true) return;
      if (call('isNodeExpanderTarget', event.target) === true) return;
      prepareSelection();
      boxPending = true;
      boxSelecting = false;
      boxMoved = false;
      boxStartX = event.clientX;
      boxStartY = event.clientY;
      preventEvent(event, true);
    }

    function moveBoxSelection(event) {
      if (!enabled || !event) return;
      if (isEditing() || isPendingSave()) return stopBoxSelection(event);
      if (!boxPending && !boxSelecting) return;
      var deltaX = Math.abs(event.clientX - boxStartX);
      var deltaY = Math.abs(event.clientY - boxStartY);
      if (!boxSelecting) {
        if (deltaX < 4 && deltaY < 4) return;
        boxSelecting = true;
        boxMoved = true;
        ensureBoxRect();
        clearSelectionClasses();
        if (viewerEl && viewerEl.classList) viewerEl.classList.add('is-box-selecting');
      }
      updateBoxSelection(event.clientX, event.clientY);
      preventEvent(event, true);
    }

    function scheduleCommit(nodes) {
      var selected = normalizeNodes(Array.isArray(nodes) ? nodes : []);
      clearCommitTimer();
      if (!selected.length) return;
      commitTimer = schedule(function() {
        commitTimer = 0;
        if (!enabled || isEditing() || isPendingSave()) return;
        apply(selected);
        call('updateEditButtons');
      });
    }

    function stopBoxSelection(event) {
      if (!enabled || (!boxPending && !boxSelecting)) return;
      if (isEditing() || isPendingSave()) {
        boxPending = false;
        boxSelecting = false;
        boxMoved = false;
        hideBoxRect(true);
        return;
      }
      var endX = event && typeof event.clientX === 'number' ? event.clientX : boxStartX;
      var endY = event && typeof event.clientY === 'number' ? event.clientY : boxStartY;
      if (!boxSelecting && (Math.abs(endX - boxStartX) >= 4 || Math.abs(endY - boxStartY) >= 4)) {
        boxSelecting = true;
        boxMoved = true;
        ensureBoxRect();
        clearSelectionClasses();
        if (viewerEl && viewerEl.classList) viewerEl.classList.add('is-box-selecting');
        updateBoxSelection(endX, endY);
      }
      boxPending = false;
      if (!boxSelecting) return;
      boxSelecting = false;
      hideBoxRect(false);
      if (!boxMoved) return clearSelectionClasses();
      var selected = normalizeNodes(getBoxSelectedNodes());
      apply(selected);
      scheduleCommit(selected);
      boxSuppressClickUntil = Date.now() + 360;
      call('updateEditButtons');
      preventEvent(event, true);
    }

    function consumeClickSuppression(event) {
      if (!enabled) return false;
      if (modifierSuppressClickUntil && Date.now() <= modifierSuppressClickUntil) {
        preventEvent(event, true);
        call('updateEditButtons');
        return true;
      }
      if (boxSuppressClickUntil && Date.now() <= boxSuppressClickUntil) {
        boxSuppressClickUntil = 0;
        preventEvent(event, true);
        call('updateEditButtons');
        return true;
      }
      return false;
    }

    function consumeContextMenuSuppression(event) {
      if (!enabled || !modifierSuppressClickUntil || Date.now() > modifierSuppressClickUntil) return false;
      modifierSuppressClickUntil = 0;
      call('hideContextMenu');
      preventEvent(event, false);
      return true;
    }

    function handleReadOnlyClick(event, nodeEl) {
      if (!enabled || isEditing() || !event) return false;
      if (isCtrlActive(event) && !event.shiftKey && !event.altKey && nodeEl) {
        preventEvent(event, false);
        prepareSelection();
        toggle(nodeEl);
        call('updateEditButtons');
        return true;
      }
      if (!isCtrlActive(event) && !event.shiftKey && !event.altKey) {
        if (nodeEl) {
          apply([nodeEl]);
          call('focusViewer');
        } else if (call('isEventInsideCanvas', event.target) === true) {
          clear(true);
          call('focusViewer');
        }
      }
      return false;
    }

    function resetInteractionState(syncMindSelection) {
      boxPending = false;
      boxSelecting = false;
      boxMoved = false;
      boxSuppressClickUntil = 0;
      modifierSuppressClickUntil = 0;
      call('clearClickEditTimer');
      clear(syncMindSelection === true);
      hideBoxRect(true);
    }

    function bind() {
      if (bound || !enabled || !viewerEl || typeof viewerEl.addEventListener !== 'function') return false;
      bound = true;
      viewerEl.addEventListener('pointerdown', beginModifierNodeSelection, true);
      viewerEl.addEventListener('mousedown', beginModifierNodeSelection, true);
      viewerEl.addEventListener('pointerdown', startBoxSelection, true);
      viewerEl.addEventListener('mousedown', startBoxSelection, true);
      viewerEl.addEventListener('pointermove', moveBoxSelection, true);
      viewerEl.addEventListener('mousemove', moveBoxSelection, true);
      viewerEl.addEventListener('pointerup', stopBoxSelection, true);
      viewerEl.addEventListener('mouseup', stopBoxSelection, true);
      if (browser && typeof browser.addEventListener === 'function') {
        browser.addEventListener('pointermove', moveBoxSelection);
        browser.addEventListener('pointerup', stopBoxSelection);
        browser.addEventListener('pointercancel', stopBoxSelection);
        browser.addEventListener('mousemove', moveBoxSelection);
        browser.addEventListener('mouseup', stopBoxSelection);
      }
      return true;
    }

    function destroy() {
      if (bound && viewerEl && typeof viewerEl.removeEventListener === 'function') {
        viewerEl.removeEventListener('pointerdown', beginModifierNodeSelection, true);
        viewerEl.removeEventListener('mousedown', beginModifierNodeSelection, true);
        viewerEl.removeEventListener('pointerdown', startBoxSelection, true);
        viewerEl.removeEventListener('mousedown', startBoxSelection, true);
        viewerEl.removeEventListener('pointermove', moveBoxSelection, true);
        viewerEl.removeEventListener('mousemove', moveBoxSelection, true);
        viewerEl.removeEventListener('pointerup', stopBoxSelection, true);
        viewerEl.removeEventListener('mouseup', stopBoxSelection, true);
      }
      if (bound && browser && typeof browser.removeEventListener === 'function') {
        browser.removeEventListener('pointermove', moveBoxSelection);
        browser.removeEventListener('pointerup', stopBoxSelection);
        browser.removeEventListener('pointercancel', stopBoxSelection);
        browser.removeEventListener('mousemove', moveBoxSelection);
        browser.removeEventListener('mouseup', stopBoxSelection);
      }
      bound = false;
      resetInteractionState(false);
      resetModifierPointerGuard();
      clearCommitTimer();
      if (boxRectEl && boxRectEl.parentNode) boxRectEl.parentNode.removeChild(boxRectEl);
      boxRectEl = null;
    }

    return {
      isEnabled: function() { return enabled; },
      bind: bind,
      destroy: destroy,
      buildDefaultGroupDescriptor: buildDefaultGroupDescriptor,
      applyDefaultGroup: applyDefaultGroup,
      resolveNode: resolveNode,
      normalizeNodes: normalizeNodes,
      collect: collect,
      collectRemovableNodes: function() { return selectionModel.collectRemovableNodes(collect()); },
      apply: apply,
      toggle: toggle,
      clear: clear,
      clearVisualSelection: clearSelectionClasses,
      resetInteractionState: resetInteractionState,
      resetModifierPointerGuard: resetModifierPointerGuard,
      selectModifiedNodeFromEvent: selectModifiedNodeFromEvent,
      consumeClickSuppression: consumeClickSuppression,
      consumeContextMenuSuppression: consumeContextMenuSuppression,
      handleReadOnlyClick: handleReadOnlyClick,
    };
  }

  return { create: create };
});
