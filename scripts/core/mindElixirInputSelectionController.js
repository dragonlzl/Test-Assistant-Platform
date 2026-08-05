(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.mindElixirInputSelectionController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var viewerEl = opts.viewerEl || null;
    var browser = opts.window || (typeof window !== 'undefined' ? window : null);
    var documentRef = opts.document || (typeof document !== 'undefined' ? document : null);
    var bound = false;
    var destroyed = false;
    var isolatedInputElements = [];
    var pointerState = { active: false, startX: 0, startY: 0, moved: false, multiClick: false };
    var scheduleToken = 0;
    var lastInputEl = null;
    var guardTimer = 0;
    var guardUntil = 0;
    var guardToken = 0;
    var guardPoint = null;

    function call(name) {
      if (typeof opts[name] !== 'function') return undefined;
      return opts[name].apply(null, Array.prototype.slice.call(arguments, 1));
    }

    function schedule(callback, delayMs) {
      var runner = function() {
        if (!destroyed) callback();
      };
      if (typeof opts.setTimeout === 'function') return opts.setTimeout(runner, delayMs || 0);
      if (browser && typeof browser.setTimeout === 'function') return browser.setTimeout(runner, delayMs || 0);
      return setTimeout(runner, delayMs || 0);
    }

    function cancelTimer(timerId) {
      if (timerId === null || timerId === undefined || timerId === 0) return;
      if (typeof opts.clearTimeout === 'function') opts.clearTimeout(timerId);
      else if (browser && typeof browser.clearTimeout === 'function') browser.clearTimeout(timerId);
      else clearTimeout(timerId);
    }

    function isEditing() { return call('isEditing') === true; }

    function isPendingSave() { return call('isPendingSave') === true; }

    function resolveElementTarget(target) {
      if (!target) return null;
      if (target.nodeType === 1) return target;
      if (target.parentElement) return target.parentElement;
      if (target.parentNode && target.parentNode.nodeType === 1) return target.parentNode;
      return null;
    }

    function isEditableContentElement(element) {
      if (!element) return false;
      if (element.isContentEditable) return true;
      var editableEl = element.closest ? element.closest('[contenteditable]') : null;
      if (!editableEl || !editableEl.getAttribute) return false;
      return String(editableEl.getAttribute('contenteditable') || '').toLowerCase() !== 'false';
    }

    function isTypingTarget(target) {
      var element = resolveElementTarget(target);
      if (!element) return false;
      if (element.id === 'input-box') return true;
      if (element.closest && element.closest('#input-box')) return true;
      var tagName = element.tagName ? String(element.tagName).toLowerCase() : '';
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
      return isEditableContentElement(element);
    }

    function getInputBox() {
      if (!documentRef || typeof documentRef.getElementById !== 'function') return null;
      return documentRef.getElementById('input-box');
    }

    function resolveInputBox(target) {
      if (!isEditing() || !target) return null;
      var element = resolveElementTarget(target);
      if (!element) return null;
      if (element.id === 'input-box') return element;
      return element.closest ? element.closest('#input-box') : null;
    }

    function stopInputMouseBubble(event) {
      if (!event || !resolveInputBox(event.target)) return;
      if (event.stopPropagation) event.stopPropagation();
    }

    var isolatedEvents = [
      'pointerdown', 'mousedown', 'pointermove', 'mousemove', 'pointerup', 'mouseup',
      'click', 'dblclick', 'selectstart',
    ];

    function ensureInputMouseIsolation(target) {
      var inputEl = resolveInputBox(target);
      if (!inputEl || inputEl.__tapXmindInputMouseIsolated === true) return;
      inputEl.__tapXmindInputMouseIsolated = true;
      isolatedEvents.forEach(function(eventName) {
        inputEl.addEventListener(eventName, stopInputMouseBubble, false);
      });
      isolatedInputElements.push(inputEl);
    }

    function releaseInputMouseIsolation() {
      isolatedInputElements.forEach(function(inputEl) {
        if (!inputEl || typeof inputEl.removeEventListener !== 'function') return;
        isolatedEvents.forEach(function(eventName) {
          inputEl.removeEventListener(eventName, stopInputMouseBubble, false);
        });
        try {
          delete inputEl.__tapXmindInputMouseIsolated;
        } catch (err) {
          inputEl.__tapXmindInputMouseIsolated = false;
        }
      });
      isolatedInputElements = [];
    }

    function getSelection() {
      if (!browser || typeof browser.getSelection !== 'function') return null;
      try {
        return browser.getSelection();
      } catch (err) {
        return null;
      }
    }

    function readSelectionState(inputEl) {
      if (!inputEl) return null;
      var selection = getSelection();
      if (!selection || selection.rangeCount <= 0) return null;
      var range = null;
      try {
        range = selection.getRangeAt(0);
      } catch (err) {
        range = null;
      }
      if (!range) return null;
      var startContainer = range.startContainer || null;
      var endContainer = range.endContainer || null;
      return {
        inside: (startContainer === inputEl || Boolean(inputEl.contains && inputEl.contains(startContainer)))
          && (endContainer === inputEl || Boolean(inputEl.contains && inputEl.contains(endContainer))),
        collapsed: Boolean(selection.isCollapsed),
        selectedText: String(selection.toString() || ''),
        text: String(inputEl.textContent || ''),
      };
    }

    function isFullySelected(inputEl) {
      var state = readSelectionState(inputEl);
      return Boolean(state && state.inside && !state.collapsed && state.text && state.selectedText === state.text);
    }

    function focusInput(inputEl) {
      if (!inputEl || typeof inputEl.focus !== 'function') return;
      if (documentRef && documentRef.activeElement === inputEl) return;
      try {
        inputEl.focus();
      } catch (err) {
        // ignore
      }
    }

    function normalizePoint(point) {
      if (!point) return null;
      var x = Number(point.x);
      var y = Number(point.y);
      return isFinite(x) && isFinite(y) ? { x: x, y: y } : null;
    }

    function selectText() {
      var inputEl = getInputBox();
      if (!inputEl) return false;
      focusInput(inputEl);
      if (typeof inputEl.select === 'function') {
        try {
          inputEl.select();
          return true;
        } catch (err0) {
          // ignore
        }
      }
      if (!documentRef || typeof documentRef.createRange !== 'function') return false;
      var selection = getSelection();
      if (!selection) return false;
      try {
        var range = documentRef.createRange();
        range.selectNodeContents(inputEl);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      } catch (err1) {
        return false;
      }
    }

    function placeCaretToEnd() {
      var inputEl = getInputBox();
      if (!inputEl) return false;
      focusInput(inputEl);
      if (typeof inputEl.setSelectionRange === 'function') {
        try {
          var length = String(inputEl.value || '').length;
          inputEl.setSelectionRange(length, length);
          return true;
        } catch (err0) {
          // ignore
        }
      }
      if (!documentRef || typeof documentRef.createRange !== 'function') return false;
      var selection = getSelection();
      if (!selection) return false;
      try {
        var range = documentRef.createRange();
        range.selectNodeContents(inputEl);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      } catch (err1) {
        return false;
      }
    }

    function placeCaretAtPoint(point) {
      var inputEl = getInputBox();
      if (!inputEl) return false;
      var normalized = normalizePoint(point);
      if (!normalized) return placeCaretToEnd();
      focusInput(inputEl);
      var range = null;
      if (documentRef && typeof documentRef.caretRangeFromPoint === 'function') {
        try {
          range = documentRef.caretRangeFromPoint(normalized.x, normalized.y);
        } catch (err0) {
          range = null;
        }
      }
      if (!range && documentRef && typeof documentRef.caretPositionFromPoint === 'function'
        && typeof documentRef.createRange === 'function') {
        try {
          var position = documentRef.caretPositionFromPoint(normalized.x, normalized.y);
          if (position && position.offsetNode) {
            range = documentRef.createRange();
            range.setStart(position.offsetNode, position.offset);
            range.collapse(true);
          }
        } catch (err1) {
          range = null;
        }
      }
      if (!range) {
        var noRangeState = readSelectionState(inputEl);
        return noRangeState && noRangeState.inside && noRangeState.collapsed ? true : placeCaretToEnd();
      }
      var startContainer = range.startContainer || null;
      if (startContainer !== inputEl && !(inputEl.contains && inputEl.contains(startContainer))) {
        var outsideState = readSelectionState(inputEl);
        return outsideState && outsideState.inside && outsideState.collapsed ? true : placeCaretToEnd();
      }
      var selection = getSelection();
      if (!selection) return false;
      try {
        if (typeof range.collapse === 'function') range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      } catch (err2) {
        return false;
      }
    }

    function nextToken() {
      scheduleToken += 1;
      return scheduleToken;
    }

    function isCurrentToken(token) { return token === scheduleToken; }

    function clearGuard() {
      if (guardTimer) cancelTimer(guardTimer);
      guardTimer = 0;
      guardUntil = 0;
      guardToken = 0;
      guardPoint = null;
    }

    function cancelSelectionSchedule() {
      scheduleToken += 1;
      clearGuard();
    }

    function runGuard() {
      guardTimer = 0;
      if (!isEditing() || isPendingSave() || !guardUntil || Date.now() > guardUntil || !isCurrentToken(guardToken)) {
        clearGuard();
        return;
      }
      if (!pointerState.active) {
        var inputEl = getInputBox();
        if (inputEl && isFullySelected(inputEl)) {
          if (guardPoint) placeCaretAtPoint(guardPoint);
          else placeCaretToEnd();
        }
      }
      if (guardUntil && Date.now() <= guardUntil && isCurrentToken(guardToken)) {
        guardTimer = schedule(runGuard, 32);
      } else {
        clearGuard();
      }
    }

    function startGuard(point, token) {
      if (!token) return;
      guardPoint = normalizePoint(point);
      guardToken = token;
      guardUntil = Date.now() + 180;
      if (guardTimer) cancelTimer(guardTimer);
      guardTimer = schedule(runGuard, 0);
    }

    function scheduleRepeated(delays, token, callback) {
      delays.forEach(function(delayMs) {
        schedule(function() {
          if (isCurrentToken(token)) callback();
        }, delayMs);
      });
    }

    function scheduleTextSelection() {
      var token = nextToken();
      clearGuard();
      selectText();
      scheduleRepeated([0, 24], token, selectText);
    }

    function scheduleCaretAtPoint(point) {
      var normalized = normalizePoint(point);
      if (!normalized) {
        scheduleCaretToEnd();
        return;
      }
      var token = nextToken();
      startGuard(normalized, token);
      placeCaretAtPoint(normalized);
      scheduleRepeated([0, 24, 72, 144], token, function() { placeCaretAtPoint(normalized); });
    }

    function scheduleCaretToEnd() {
      var token = nextToken();
      startGuard(null, token);
      placeCaretToEnd();
      scheduleRepeated([0, 24, 72, 144], token, placeCaretToEnd);
    }

    function scheduleCollapseFullSelection(inputEl) {
      var token = nextToken();
      scheduleRepeated([32, 96, 160], token, function() {
        if (!isEditing() || isPendingSave() || inputEl !== getInputBox() || pointerState.active) return;
        if (isFullySelected(inputEl)) placeCaretToEnd();
      });
    }

    function syncInputBox() {
      if (!isEditing()) return;
      var inputEl = getInputBox();
      if (!inputEl) {
        lastInputEl = null;
        return;
      }
      ensureInputMouseIsolation(inputEl);
      if (lastInputEl === inputEl) return;
      lastInputEl = inputEl;
      scheduleCollapseFullSelection(inputEl);
    }

    function resetPointerState() {
      pointerState.active = false;
      pointerState.startX = 0;
      pointerState.startY = 0;
      pointerState.moved = false;
      pointerState.multiClick = false;
    }

    function trackInputMouseEvent(event) {
      var type = event && event.type ? String(event.type) : '';
      var x = event && typeof event.clientX === 'number' ? event.clientX : 0;
      var y = event && typeof event.clientY === 'number' ? event.clientY : 0;
      var multiClick = Number(event && event.detail || 0) > 1 || type === 'dblclick';
      if (type === 'pointerdown' || type === 'mousedown') {
        cancelSelectionSchedule();
        pointerState = { active: true, startX: x, startY: y, moved: false, multiClick: multiClick };
        return;
      }
      if (!pointerState.active) return;
      if (multiClick) pointerState.multiClick = true;
      if (Math.abs(x - pointerState.startX) > 5 || Math.abs(y - pointerState.startY) > 5) pointerState.moved = true;
      if (type === 'pointerup' || type === 'mouseup' || type === 'click') {
        var shouldPlaceCaret = !pointerState.moved && !pointerState.multiClick;
        resetPointerState();
        if (shouldPlaceCaret) scheduleCaretAtPoint({ x: x, y: y });
      }
    }

    function protectInputMouseEvent(event) {
      if (!event || !resolveInputBox(event.target)) return;
      ensureInputMouseIsolation(event.target);
      trackInputMouseEvent(event);
      call('hideContextMenu', { preserveNativeSelection: true });
      call('resetDragPreview');
    }

    function insertLineBreak(inputEl) {
      if (!inputEl || !documentRef) return false;
      if (typeof documentRef.execCommand === 'function') {
        try {
          if (documentRef.execCommand('insertLineBreak')) return true;
        } catch (err0) {
          // ignore
        }
        try {
          if (documentRef.execCommand('insertText', false, '\n')) return true;
        } catch (err1) {
          // ignore
        }
      }
      var selection = getSelection();
      if (!selection || selection.rangeCount <= 0 || typeof documentRef.createTextNode !== 'function') return false;
      try {
        var range = selection.getRangeAt(0);
        range.deleteContents();
        var breakEl = typeof documentRef.createElement === 'function' ? documentRef.createElement('br') : null;
        var inserted = breakEl || documentRef.createTextNode('\n');
        range.insertNode(inserted);
        range.setStartAfter(inserted);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      } catch (err2) {
        return false;
      }
    }

    function onInputEnterKeydown(event) {
      if (!isEditing() || !event || event.key !== 'Enter') return;
      var target = event.target || null;
      if (!target || target.id !== 'input-box') return;
      if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.preventDefault) event.preventDefault();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      else if (event.stopPropagation) event.stopPropagation();
      insertLineBreak(target);
    }

    function replaceText(text) {
      var inputEl = getInputBox();
      if (!inputEl || !documentRef) return false;
      var nextText = text === undefined || text === null ? '' : String(text);
      focusInput(inputEl);
      var replaced = false;
      if (typeof documentRef.execCommand === 'function') {
        try {
          replaced = documentRef.execCommand('insertText', false, nextText);
        } catch (err0) {
          replaced = false;
        }
      }
      if (!replaced) {
        try {
          if (inputEl.value !== undefined) inputEl.value = nextText;
          if (inputEl.textContent !== undefined) inputEl.textContent = nextText;
          replaced = true;
        } catch (err1) {
          replaced = false;
        }
      }
      if (replaced && typeof inputEl.dispatchEvent === 'function') {
        var EventCtor = browser && typeof browser.Event === 'function'
          ? browser.Event
          : (typeof Event !== 'undefined' ? Event : null);
        var inputEvent = null;
        try {
          if (EventCtor) inputEvent = new EventCtor('input', { bubbles: true, cancelable: false });
        } catch (err2) {
          inputEvent = null;
        }
        if (!inputEvent && typeof documentRef.createEvent === 'function') {
          inputEvent = documentRef.createEvent('Event');
          inputEvent.initEvent('input', true, false);
        }
        if (inputEvent) {
          try {
            inputEl.dispatchEvent(inputEvent);
          } catch (err3) {
            // ignore
          }
        }
      }
      return replaced;
    }

    function onSelectionChange() {
      if (!isEditing() || !guardUntil || guardTimer) return;
      if (Date.now() > guardUntil) {
        clearGuard();
        return;
      }
      guardTimer = schedule(runGuard, 0);
    }

    var viewerBindings = [
      ['pointerdown', protectInputMouseEvent, true], ['mousedown', protectInputMouseEvent, true],
      ['pointerup', protectInputMouseEvent, true], ['mouseup', protectInputMouseEvent, true],
      ['click', protectInputMouseEvent, true], ['dblclick', protectInputMouseEvent, true],
      ['keydown', onInputEnterKeydown, true],
    ];

    function updateBindings(target, bindings, methodName) {
      if (!target || typeof target[methodName] !== 'function') return;
      bindings.forEach(function(binding) { target[methodName](binding[0], binding[1], binding[2]); });
    }

    function bind() {
      if (bound || destroyed || !viewerEl || typeof viewerEl.addEventListener !== 'function') return false;
      bound = true;
      updateBindings(viewerEl, viewerBindings, 'addEventListener');
      if (documentRef && typeof documentRef.addEventListener === 'function') {
        documentRef.addEventListener('selectionchange', onSelectionChange);
      }
      return true;
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (bound) {
        updateBindings(viewerEl, viewerBindings, 'removeEventListener');
        if (documentRef && typeof documentRef.removeEventListener === 'function') {
          documentRef.removeEventListener('selectionchange', onSelectionChange);
        }
      }
      bound = false;
      cancelSelectionSchedule();
      resetPointerState();
      lastInputEl = null;
      releaseInputMouseIsolation();
    }

    return {
      bind: bind,
      destroy: destroy,
      isTypingTarget: isTypingTarget,
      syncInputBox: syncInputBox,
      selectText: selectText,
      replaceText: replaceText,
      scheduleTextSelection: scheduleTextSelection,
      scheduleCaretAtPoint: scheduleCaretAtPoint,
      scheduleCaretToEnd: scheduleCaretToEnd,
    };
  }

  return { create: create };
});
