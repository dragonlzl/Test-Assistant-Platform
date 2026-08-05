(function() {
  function normalizeKeyword(value) {
    var text = value === undefined || value === null ? '' : String(value);
    return text.trim().toLowerCase();
  }

  function isNodeSearchable(node) {
    var meta = node && node.xmindMeta && typeof node.xmindMeta === 'object'
      ? node.xmindMeta
      : null;
    var type = meta && meta.type ? String(meta.type || '') : '';
    return !(
      type === 'priority'
      || type === 'preconditions'
      || type === 'steps'
      || type === 'expected'
    );
  }

  function collectNodeIds(node, keyword, output) {
    if (!node || !keyword) return;
    var list = Array.isArray(output) ? output : [];
    var topicText = node.topic === undefined || node.topic === null
      ? ''
      : String(node.topic);
    if (isNodeSearchable(node) && topicText.toLowerCase().indexOf(keyword) !== -1 && node.id) {
      list.push(String(node.id));
    }
    var children = Array.isArray(node.children) ? node.children : [];
    for (var i = 0; i < children.length; i += 1) {
      collectNodeIds(children[i], keyword, list);
    }
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var controlsEl = opts.controlsEl || null;
    var viewerEl = opts.viewerEl || null;
    var canvasEl = opts.canvasEl || null;
    var searchInputEl = opts.searchInputEl || (
      controlsEl && typeof controlsEl.querySelector === 'function'
        ? controlsEl.querySelector('[data-mind-search-input]')
        : null
    );
    var searchCountEl = opts.searchCountEl || (
      controlsEl && typeof controlsEl.querySelector === 'function'
        ? controlsEl.querySelector('[data-mind-search-count]')
        : null
    );
    var getInstance = typeof opts.getInstance === 'function'
      ? opts.getInstance
      : function() { return null; };
    var findNodeElement = typeof opts.findNodeElement === 'function'
      ? opts.findNodeElement
      : function(instance, nodeId) {
          if (!instance || !nodeId || typeof instance.findEle !== 'function') return null;
          try {
            return instance.findEle(String(nodeId));
          } catch (err) {
            return null;
          }
        };
    var resolveAnchorElement = typeof opts.resolveAnchorElement === 'function'
      ? opts.resolveAnchorElement
      : function(nodeEl) { return nodeEl || null; };
    var parseTransformState = typeof opts.parseTransformState === 'function'
      ? opts.parseTransformState
      : null;
    var writeTransformState = typeof opts.writeTransformState === 'function'
      ? opts.writeTransformState
      : null;
    var state = {
      keyword: '',
      ids: [],
      index: -1,
    };
    var focusRestoreTimer = 0;
    var centerTimerIds = [];
    var destroyed = false;

    function setCount() {
      if (!searchCountEl) return;
      var total = Array.isArray(state.ids) ? state.ids.length : 0;
      var current = total > 0 && state.index >= 0 ? state.index + 1 : 0;
      searchCountEl.textContent = String(current) + '/' + String(total);
      if (!searchCountEl.classList) return;
      if (total > 0) searchCountEl.classList.remove('is-empty');
      else searchCountEl.classList.add('is-empty');
    }

    function clearFocusRestoreTimer() {
      if (!focusRestoreTimer) return;
      clearTimeout(focusRestoreTimer);
      focusRestoreTimer = 0;
    }

    function clearCenterTimers() {
      centerTimerIds.forEach(function(timerId) {
        clearTimeout(timerId);
      });
      centerTimerIds = [];
    }

    function readInputSelection() {
      if (!searchInputEl) return null;
      var start = typeof searchInputEl.selectionStart === 'number'
        ? Number(searchInputEl.selectionStart)
        : NaN;
      var end = typeof searchInputEl.selectionEnd === 'number'
        ? Number(searchInputEl.selectionEnd)
        : NaN;
      return {
        start: isFinite(start) ? start : NaN,
        end: isFinite(end) ? end : NaN,
      };
    }

    function applyInputFocus(selection) {
      if (!searchInputEl || typeof searchInputEl.focus !== 'function') return;
      var ownerDoc = searchInputEl.ownerDocument
        || (typeof document !== 'undefined' ? document : null);
      if (
        !ownerDoc
        || !ownerDoc.body
        || !ownerDoc.body.contains
        || !ownerDoc.body.contains(searchInputEl)
      ) {
        return;
      }
      try {
        searchInputEl.focus({ preventScroll: true });
      } catch (err) {
        try {
          searchInputEl.focus();
        } catch (err2) {
          return;
        }
      }
      if (typeof searchInputEl.setSelectionRange !== 'function') return;
      var range = selection && typeof selection === 'object' ? selection : null;
      var length = String(searchInputEl.value || '').length;
      var start = range && isFinite(Number(range.start)) ? Number(range.start) : length;
      var end = range && isFinite(Number(range.end)) ? Number(range.end) : start;
      if (start < 0) start = 0;
      if (end < 0) end = 0;
      if (start > length) start = length;
      if (end > length) end = length;
      try {
        searchInputEl.setSelectionRange(start, end);
      } catch (err3) {
        // ignore
      }
    }

    function scheduleInputFocus(selection) {
      if (!searchInputEl || typeof searchInputEl.focus !== 'function') return;
      clearFocusRestoreTimer();
      var range = selection && typeof selection === 'object' ? selection : null;
      applyInputFocus(range);
      focusRestoreTimer = setTimeout(function() {
        focusRestoreTimer = 0;
        if (!destroyed) applyInputFocus(range);
      }, 0);
    }

    function clearClasses() {
      if (!viewerEl || typeof viewerEl.querySelectorAll !== 'function') return;
      var marked = viewerEl.querySelectorAll('me-tpc.xmind-search-hit, me-tpc.xmind-search-active');
      if (!marked || !marked.length) return;
      Array.prototype.forEach.call(marked, function(node) {
        if (!node || !node.classList) return;
        node.classList.remove('xmind-search-hit');
        node.classList.remove('xmind-search-active');
      });
    }

    function applyClasses() {
      clearClasses();
      var ids = Array.isArray(state.ids) ? state.ids : [];
      var instance = getInstance();
      for (var i = 0; i < ids.length; i += 1) {
        var target = findNodeElement(instance, ids[i]);
        if (target && target.classList) target.classList.add('xmind-search-hit');
      }
      if (ids.length && state.index >= 0 && state.index < ids.length) {
        var active = findNodeElement(instance, ids[state.index]);
        if (active && active.classList) active.classList.add('xmind-search-active');
      }
      setCount();
    }

    function filterRenderedNodeIds(instance, ids) {
      var result = [];
      var seen = Object.create(null);
      (Array.isArray(ids) ? ids : []).forEach(function(id) {
        var stableId = String(id || '');
        if (!stableId || seen[stableId]) return;
        var nodeEl = findNodeElement(instance, stableId);
        if (!nodeEl || typeof nodeEl.getBoundingClientRect !== 'function') return;
        var rect = nodeEl.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        seen[stableId] = true;
        result.push(stableId);
      });
      return result;
    }

    function centerResultNode(nodeId) {
      var instance = getInstance();
      if (
        !instance
        || !nodeId
        || !instance.map
        || !parseTransformState
        || !writeTransformState
      ) {
        return false;
      }
      var nodeEl = findNodeElement(instance, nodeId);
      var anchorEl = resolveAnchorElement(nodeEl);
      var viewportEl = canvasEl && typeof canvasEl.getBoundingClientRect === 'function'
        ? canvasEl
        : (
          instance.container && typeof instance.container.getBoundingClientRect === 'function'
            ? instance.container
            : null
        );
      if (!anchorEl || typeof anchorEl.getBoundingClientRect !== 'function' || !viewportEl) return false;
      var nodeRect = anchorEl.getBoundingClientRect();
      var viewportRect = viewportEl.getBoundingClientRect();
      var currentCenterX = Number(nodeRect.left + nodeRect.width / 2);
      var currentCenterY = Number(nodeRect.top + nodeRect.height / 2);
      var desiredCenterX = Number(viewportRect.left + viewportRect.width / 2);
      var desiredCenterY = Number(viewportRect.top + viewportRect.height / 2);
      if (
        !isFinite(currentCenterX)
        || !isFinite(currentCenterY)
        || !isFinite(desiredCenterX)
        || !isFinite(desiredCenterY)
      ) {
        return false;
      }
      var deltaX = desiredCenterX - currentCenterX;
      var deltaY = desiredCenterY - currentCenterY;
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return true;
      var transformState = parseTransformState(
        instance.map && instance.map.style ? instance.map.style.transform : ''
      );
      transformState.x += deltaX;
      transformState.y += deltaY;
      if (writeTransformState(instance, transformState)) {
        instance.__tapViewportInteracted = true;
        return true;
      }
      return false;
    }

    function scheduleResultCenter(nodeId) {
      var stableId = String(nodeId || '');
      if (!stableId) return;
      var run = function() {
        if (!destroyed) centerResultNode(stableId);
      };
      run();
      if (
        typeof window !== 'undefined'
        && window
        && typeof window.requestAnimationFrame === 'function'
      ) {
        window.requestAnimationFrame(run);
      }
      [16, 64, 140].forEach(function(delayMs) {
        centerTimerIds.push(setTimeout(run, delayMs));
      });
    }

    function focusIndex(index, optionsValue) {
      var focusOptions = optionsValue || {};
      var ids = Array.isArray(state.ids) ? state.ids : [];
      if (!ids.length) {
        state.index = -1;
        applyClasses();
        if (focusOptions.preserveInputFocus) scheduleInputFocus(focusOptions.selection);
        return;
      }
      var nextIndex = Number(index);
      if (!isFinite(nextIndex)) nextIndex = 0;
      if (nextIndex < 0) nextIndex = ((nextIndex % ids.length) + ids.length) % ids.length;
      else nextIndex %= ids.length;
      state.index = nextIndex;
      applyClasses();
      scheduleResultCenter(ids[nextIndex]);
      if (focusOptions.preserveInputFocus) scheduleInputFocus(focusOptions.selection);
    }

    function run(optionsValue) {
      if (destroyed) return;
      var runOptions = optionsValue || {};
      var keepIndex = runOptions.keepIndex === true;
      var selection = runOptions.preserveInputFocus ? readInputSelection() : null;
      var keyword = normalizeKeyword(searchInputEl ? searchInputEl.value : '');
      state.keyword = keyword;
      if (!keyword) {
        state.ids = [];
        state.index = -1;
        applyClasses();
        if (runOptions.preserveInputFocus) scheduleInputFocus(selection);
        return;
      }
      var matchedIds = [];
      var instance = getInstance();
      collectNodeIds(instance ? instance.nodeData : null, keyword, matchedIds);
      var renderedIds = filterRenderedNodeIds(instance, matchedIds);
      state.ids = renderedIds;
      if (!renderedIds.length) {
        state.index = -1;
        applyClasses();
        if (runOptions.preserveInputFocus) scheduleInputFocus(selection);
        return;
      }
      if (keepIndex && state.index >= 0 && state.index < renderedIds.length) {
        focusIndex(state.index, {
          preserveInputFocus: runOptions.preserveInputFocus,
          selection: selection,
        });
        return;
      }
      focusIndex(0, {
        preserveInputFocus: runOptions.preserveInputFocus,
        selection: selection,
      });
    }

    function move(step, optionsValue) {
      if (destroyed || !Array.isArray(state.ids) || !state.ids.length) return;
      var delta = Number(step);
      if (!isFinite(delta) || delta === 0) return;
      var base = state.index >= 0 ? state.index : 0;
      focusIndex(base + delta, optionsValue);
    }

    function clear(optionsValue) {
      if (destroyed) return;
      var clearOptions = optionsValue || {};
      if (searchInputEl) searchInputEl.value = '';
      state.keyword = '';
      state.ids = [];
      state.index = -1;
      applyClasses();
      if (clearOptions.focusInput) scheduleInputFocus({ start: 0, end: 0 });
    }

    function handleInput() {
      run({ keepIndex: false, preserveInputFocus: true });
    }

    function handleKeydown(event) {
      if (!event) return;
      if (event.stopPropagation) event.stopPropagation();
      if (event.key !== 'Enter') return;
      if (event.preventDefault) event.preventDefault();
      var moveOptions = {
        preserveInputFocus: true,
        selection: readInputSelection(),
      };
      if (event.shiftKey) move(-1, moveOptions);
      else move(1, moveOptions);
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      clearFocusRestoreTimer();
      clearCenterTimers();
      clearClasses();
      if (searchInputEl && typeof searchInputEl.removeEventListener === 'function') {
        searchInputEl.removeEventListener('input', handleInput);
        searchInputEl.removeEventListener('keydown', handleKeydown);
      }
      state.keyword = '';
      state.ids = [];
      state.index = -1;
    }

    if (searchInputEl && typeof searchInputEl.addEventListener === 'function') {
      searchInputEl.addEventListener('input', handleInput);
      searchInputEl.addEventListener('keydown', handleKeydown);
    }
    setCount();

    return {
      run: run,
      move: move,
      clear: clear,
      destroy: destroy,
      getState: function() {
        return {
          keyword: state.keyword,
          ids: state.ids.slice(),
          index: state.index,
        };
      },
    };
  }

  window.app = window.app || {};
  window.app.mindElixirSearchController = {
    normalizeKeyword: normalizeKeyword,
    collectNodeIds: collectNodeIds,
    create: create,
  };
})();
