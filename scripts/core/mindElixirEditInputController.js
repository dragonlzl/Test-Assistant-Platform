(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.mindElixirEditInputController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var viewerEl = opts.viewerEl || null;
    var browser = opts.window || (typeof window !== 'undefined' ? window : null);
    var documentRef = opts.document || (typeof document !== 'undefined' ? document : null);
    var inputSelectionOwner = opts.inputSelectionOwner
      || (typeof window !== 'undefined' && window.app ? window.app.mindElixirInputSelectionController : null);
    if (!inputSelectionOwner || typeof inputSelectionOwner.create !== 'function') {
      throw new Error('MindElixir input selection controller is required');
    }

    var bound = false;
    var destroyed = false;
    var scheduledTimers = [];
    var pointerState = { active: false, nodeId: '', startX: 0, startY: 0 };
    var canvasClearSuppressedUntil = 0;
    var selectionMode = 'end';
    var selectionPoint = null;
    var selectionResetTimer = 0;
    var pendingKeyboardPayload = null;

    function call(name) {
      if (typeof opts[name] !== 'function') return undefined;
      return opts[name].apply(null, Array.prototype.slice.call(arguments, 1));
    }

    function removeTimer(timerId) {
      scheduledTimers = scheduledTimers.filter(function(id) { return id !== timerId; });
    }

    function schedule(callback, delayMs) {
      var completedSynchronously = false;
      var timerId = null;
      var runner = function() {
        completedSynchronously = true;
        removeTimer(timerId);
        if (!destroyed) callback();
      };
      if (typeof opts.setTimeout === 'function') timerId = opts.setTimeout(runner, delayMs || 0);
      else if (browser && typeof browser.setTimeout === 'function') timerId = browser.setTimeout(runner, delayMs || 0);
      else timerId = setTimeout(runner, delayMs || 0);
      if (!completedSynchronously) scheduledTimers.push(timerId);
      return timerId;
    }

    function cancelTimer(timerId) {
      if (timerId === null || timerId === undefined || timerId === 0) return;
      if (typeof opts.clearTimeout === 'function') opts.clearTimeout(timerId);
      else if (browser && typeof browser.clearTimeout === 'function') browser.clearTimeout(timerId);
      else clearTimeout(timerId);
      removeTimer(timerId);
    }

    function cancelAllTimers() {
      var timers = scheduledTimers.slice();
      scheduledTimers = [];
      timers.forEach(function(timerId) {
        if (typeof opts.clearTimeout === 'function') opts.clearTimeout(timerId);
        else if (browser && typeof browser.clearTimeout === 'function') browser.clearTimeout(timerId);
        else clearTimeout(timerId);
      });
    }

    function isEditing() { return call('isEditing') === true; }

    function isPendingSave() { return call('isPendingSave') === true; }

    var inputSelectionController = inputSelectionOwner.create({
      viewerEl: viewerEl,
      window: browser,
      document: documentRef,
      setTimeout: schedule,
      clearTimeout: cancelTimer,
      isEditing: isEditing,
      isPendingSave: isPendingSave,
      hideContextMenu: function(options1) { call('hideContextMenu', options1); },
      resetDragPreview: function() { call('resetDragPreview'); },
    });

    function findViewerNodeById(nodeId) {
      var normalized = nodeId === null || nodeId === undefined ? '' : String(nodeId);
      if (!normalized || !viewerEl || typeof viewerEl.querySelectorAll !== 'function') return null;
      var nodes = viewerEl.querySelectorAll('me-tpc');
      for (var i = 0; i < nodes.length; i += 1) {
        var node = nodes[i];
        if (!node || !node.nodeObj || node.nodeObj.id === null || node.nodeObj.id === undefined) continue;
        if (String(node.nodeObj.id) === normalized) return node;
      }
      return null;
    }

    function findViewerNodeAtPoint(clientX, clientY) {
      if (!viewerEl || typeof viewerEl.querySelectorAll !== 'function') return null;
      var x = Number(clientX);
      var y = Number(clientY);
      if (!isFinite(x) || !isFinite(y)) return null;
      var nodes = viewerEl.querySelectorAll('me-tpc');
      var matched = null;
      var matchedArea = 0;
      Array.prototype.forEach.call(nodes || [], function(node) {
        if (!node || !node.nodeObj || typeof node.getBoundingClientRect !== 'function') return;
        var rect = node.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;
        var area = rect.width * rect.height;
        if (!matched || area < matchedArea) {
          matched = node;
          matchedArea = area;
        }
      });
      return matched;
    }

    function resolveEventNode(event) {
      var target = event && event.target ? event.target : null;
      if (!target || inputSelectionController.isTypingTarget(target)) return null;
      if (call('isEventInsideControls', target) === true) return null;
      if (call('isNodeExpanderTarget', target) === true) return null;
      if (target.closest && target.closest('.xmind-node-context-menu')) return null;
      if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number'
        && documentRef && typeof documentRef.elementsFromPoint === 'function') {
        var pointedElements = documentRef.elementsFromPoint(event.clientX, event.clientY) || [];
        for (var i = 0; i < pointedElements.length; i += 1) {
          var pointedEl = pointedElements[i];
          if (!pointedEl || !pointedEl.closest || call('isEventInsideControls', pointedEl) === true) continue;
          var pointedNode = pointedEl.closest('me-tpc');
          if (!pointedNode || !pointedNode.nodeObj) continue;
          if (pointedNode.getAttribute && pointedNode.getAttribute('data-xmind-select-group')) return pointedNode;
        }
        var fallbackNode = findViewerNodeAtPoint(event.clientX, event.clientY);
        if (fallbackNode) return fallbackNode;
      }
      var nodeEl = target.closest ? target.closest('me-tpc') : null;
      return nodeEl && nodeEl.nodeObj ? nodeEl : null;
    }

    function selectNodeForEditing(nodeEl) {
      if (!isEditing() || isPendingSave() || !nodeEl || !nodeEl.nodeObj) return false;
      var nodeId = nodeEl.nodeObj.id === null || nodeEl.nodeObj.id === undefined
        ? ''
        : String(nodeEl.nodeObj.id);
      call('applySelectionNodes', [nodeEl]);
      call('focusViewer');
      call('updateEditButtons');
      schedule(function() {
        if (!isEditing() || isPendingSave()) return;
        var liveNode = nodeId ? findViewerNodeById(nodeId) : nodeEl;
        if (!liveNode || !liveNode.nodeObj) return;
        call('applySelectionNodes', [liveNode]);
        call('updateEditButtons');
      }, 0);
      return true;
    }

    function shouldUsePlainPointer(event) {
      if (!isEditing() || isPendingSave() || !event) return false;
      if (event.button !== undefined && event.button !== 0) return false;
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
        || call('isCtrlModifierActive', event) === true) return false;
      if (call('isEventInsideControls', event.target) === true) return false;
      if (call('isNodeExpanderTarget', event.target) === true) return false;
      return true;
    }

    function resetPointerState() {
      pointerState.active = false;
      pointerState.nodeId = '';
      pointerState.startX = 0;
      pointerState.startY = 0;
    }

    function beginPointerSelection(event) {
      resetPointerState();
      if (!shouldUsePlainPointer(event)) return;
      var nodeEl = resolveEventNode(event);
      pointerState.active = true;
      pointerState.nodeId = nodeEl && nodeEl.nodeObj
        && nodeEl.nodeObj.id !== null && nodeEl.nodeObj.id !== undefined
        ? String(nodeEl.nodeObj.id)
        : '';
      pointerState.startX = typeof event.clientX === 'number' ? event.clientX : 0;
      pointerState.startY = typeof event.clientY === 'number' ? event.clientY : 0;
    }

    function finishPointerSelection(event) {
      if (!pointerState.active) return;
      var nodeId = pointerState.nodeId;
      var startX = pointerState.startX;
      var startY = pointerState.startY;
      resetPointerState();
      if (!shouldUsePlainPointer(event)) return;
      var endX = typeof event.clientX === 'number' ? event.clientX : startX;
      var endY = typeof event.clientY === 'number' ? event.clientY : startY;
      if (Math.abs(endX - startX) > 6 || Math.abs(endY - startY) > 6) {
        canvasClearSuppressedUntil = Date.now() + 360;
        return;
      }
      schedule(function() {
        if (!isEditing() || isPendingSave()) return;
        var liveNode = nodeId ? findViewerNodeById(nodeId) : resolveEventNode(event);
        if (!liveNode || !liveNode.nodeObj) return;
        scheduleSelectionMode('point', { x: endX, y: endY });
        selectNodeForEditing(liveNode);
      }, 0);
    }

    function normalizeSelectionMode(mode) {
      if (mode === 'select-all') return 'select-all';
      if (mode === 'point') return 'point';
      return 'end';
    }

    function scheduleSelectionMode(mode, point) {
      selectionMode = normalizeSelectionMode(mode);
      selectionPoint = selectionMode === 'point' ? normalizePoint(point) : null;
      if (selectionResetTimer) cancelTimer(selectionResetTimer);
      selectionResetTimer = schedule(function() {
        selectionResetTimer = 0;
        selectionMode = 'end';
        selectionPoint = null;
      }, 360);
    }

    function normalizePoint(point) {
      if (!point) return null;
      var x = Number(point.x);
      var y = Number(point.y);
      return isFinite(x) && isFinite(y) ? { x: x, y: y } : null;
    }

    function consumeSelectionRequest() {
      var request = { mode: normalizeSelectionMode(selectionMode), point: selectionPoint };
      selectionMode = 'end';
      selectionPoint = null;
      if (selectionResetTimer) cancelTimer(selectionResetTimer);
      selectionResetTimer = 0;
      return request;
    }

    function triggerNodeEdit(nodeEl, mode, point) {
      if (!nodeEl || !nodeEl.nodeObj) return false;
      var nodeId = nodeEl.nodeObj.id === null || nodeEl.nodeObj.id === undefined
        ? ''
        : String(nodeEl.nodeObj.id);
      schedule(function() {
        var instance = call('getInstance');
        if (!instance || typeof instance.beginEdit !== 'function') return;
        var liveNode = nodeId ? findViewerNodeById(nodeId) : nodeEl;
        if (!liveNode) return;
        call('selectNodeForContextMenu', liveNode);
        scheduleSelectionMode(mode, point);
        try {
          instance.beginEdit(liveNode);
        } catch (err) {
          // ignore
        }
      }, 0);
      return true;
    }

    function resolveKeyboardPayload(event) {
      if (!event || event.ctrlKey || event.metaKey || event.altKey) return null;
      var key = event.key === undefined || event.key === null ? '' : String(event.key);
      if (!key) return null;
      if (key === 'Backspace') return { mode: 'clear', text: '' };
      if (key === 'Process' || key === 'Unidentified') return { mode: 'compose', text: '' };
      if (key.length === 1) return { mode: 'insert', text: key };
      return null;
    }

    function beginKeyboardEdit(event) {
      if (!isEditing() || isPendingSave() || !event || inputSelectionController.isTypingTarget(event.target)) return false;
      var payload = resolveKeyboardPayload(event);
      if (!payload) return false;
      var selected = call('collectSelectedNodes');
      selected = Array.isArray(selected) ? selected.filter(function(nodeEl) {
        return Boolean(nodeEl && nodeEl.nodeObj);
      }) : [];
      if (selected.length !== 1) return false;
      if (event.preventDefault) event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();
      pendingKeyboardPayload = payload;
      triggerNodeEdit(selected[0], 'select-all');
      return true;
    }

    function handleEditingDblClick(event) {
      if (!isEditing()) return false;
      var target = event && event.target ? event.target : null;
      if (target && inputSelectionController.isTypingTarget(target)) {
        call('hideContextMenu', { preserveNativeSelection: true });
        return true;
      }
      var nodeEl = resolveEventNode(event);
      if (!nodeEl) return true;
      if (event && event.preventDefault) event.preventDefault();
      if (event && event.stopImmediatePropagation) event.stopImmediatePropagation();
      else if (event && event.stopPropagation) event.stopPropagation();
      triggerNodeEdit(nodeEl, 'point', {
        x: event && typeof event.clientX === 'number' ? event.clientX : 0,
        y: event && typeof event.clientY === 'number' ? event.clientY : 0,
      });
      return true;
    }

    function applyPendingKeyboardEdit() {
      if (!pendingKeyboardPayload) return true;
      var payload = pendingKeyboardPayload;
      if (payload.mode === 'compose') {
        pendingKeyboardPayload = null;
        return true;
      }
      if (!inputSelectionController.selectText()) return false;
      if (!inputSelectionController.replaceText(payload.mode === 'clear' ? '' : payload.text)) return false;
      inputSelectionController.scheduleCaretToEnd();
      pendingKeyboardPayload = null;
      return true;
    }

    function schedulePendingKeyboardEdit() {
      if (!pendingKeyboardPayload) return;
      var retries = 0;
      var run = function(delayMs) {
        schedule(function() {
          if (!pendingKeyboardPayload || applyPendingKeyboardEdit()) return;
          retries += 1;
          if (retries >= 4) {
            pendingKeyboardPayload = null;
            return;
          }
          run(24);
        }, delayMs);
      };
      run(0);
    }

    function handleOperation(payload) {
      if (!isEditing()) return false;
      var operation = payload && payload.name ? String(payload.name) : '';
      if (operation !== 'beginEdit') return false;
      inputSelectionController.syncInputBox();
      var request = consumeSelectionRequest();
      if (pendingKeyboardPayload) {
        schedulePendingKeyboardEdit();
        return true;
      }
      if (request.mode === 'point') inputSelectionController.scheduleCaretAtPoint(request.point);
      else if (request.mode === 'end') inputSelectionController.scheduleCaretToEnd();
      else inputSelectionController.scheduleTextSelection();
      return true;
    }

    function onInputMutation(event) {
      if (!isEditing()) return;
      var target = event && event.target ? event.target : null;
      if (target && target.id === 'input-box') call('onInputMutation');
    }

    var viewerBindings = [
      ['pointerdown', beginPointerSelection, true], ['mousedown', beginPointerSelection, true],
      ['pointerup', finishPointerSelection, true], ['mouseup', finishPointerSelection, true],
      ['blur', onInputMutation, true], ['input', onInputMutation, true],
    ];

    function updateBindings(target, bindings, methodName) {
      if (!target || typeof target[methodName] !== 'function') return;
      bindings.forEach(function(binding) { target[methodName](binding[0], binding[1], binding[2]); });
    }

    function bind() {
      if (bound || destroyed || !viewerEl || typeof viewerEl.addEventListener !== 'function') return false;
      bound = true;
      inputSelectionController.bind();
      updateBindings(viewerEl, viewerBindings, 'addEventListener');
      return true;
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (bound) updateBindings(viewerEl, viewerBindings, 'removeEventListener');
      bound = false;
      inputSelectionController.destroy();
      resetPointerState();
      canvasClearSuppressedUntil = 0;
      if (selectionResetTimer) cancelTimer(selectionResetTimer);
      selectionResetTimer = 0;
      selectionMode = 'end';
      selectionPoint = null;
      pendingKeyboardPayload = null;
      cancelAllTimers();
    }

    return {
      bind: bind,
      destroy: destroy,
      isTypingTarget: inputSelectionController.isTypingTarget,
      findNodeById: findViewerNodeById,
      resolveEventNode: resolveEventNode,
      selectNodeForEditing: selectNodeForEditing,
      scheduleSelectionMode: scheduleSelectionMode,
      isCanvasClearSuppressed: function() {
        return Date.now() <= Number(canvasClearSuppressedUntil || 0);
      },
      beginKeyboardEdit: beginKeyboardEdit,
      handleEditingDblClick: handleEditingDblClick,
      handleOperation: handleOperation,
      syncInputBox: inputSelectionController.syncInputBox,
    };
  }

  return { create: create };
});
