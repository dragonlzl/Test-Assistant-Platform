(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecFocusInteractionOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function(root) {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var api = opts.api && typeof opts.api === 'object' ? opts.api : {};
    var document = opts.document || (root && root.document ? root.document : null);
    var windowObject = opts.window || root || null;
    var focusBlock = opts.focusBlock || null;
    var focusZone = opts.focusZone || (focusBlock && focusBlock.querySelector
      ? focusBlock.querySelector('[data-temp-focus-zone]')
      : null);
    var viewFocusBlock = opts.viewFocusBlock || null;
    var viewFocusZone = opts.viewFocusZone || (viewFocusBlock && viewFocusBlock.querySelector
      ? viewFocusBlock.querySelector('[data-temp-focus-zone]')
      : null);
    var nav = opts.tempExecNav || null;
    var unbinds = [];
    var timers = [];
    var observers = [];
    var activeDragCleanups = [];
    var destroyed = false;

    var switchTab = typeof opts.switchTab === 'function' ? opts.switchTab : noop;
    var scrollToViewTop = typeof opts.scrollToViewTop === 'function' ? opts.scrollToViewTop : noop;
    var confirmRemoveFocus = typeof opts.confirmRemoveFocus === 'function' ? opts.confirmRemoveFocus : noop;
    var markFocusBadgeRead = typeof opts.markFocusBadgeRead === 'function' ? opts.markFocusBadgeRead : noop;
    var setDragContext = typeof opts.setDragContext === 'function' ? opts.setDragContext : noop;
    var openAssignDrawer = typeof opts.openAssignDrawer === 'function' ? opts.openAssignDrawer : noop;
    var debounce = typeof opts.debounce === 'function'
      ? opts.debounce
      : function(fn, wait) {
        var timer = 0;
        var wrapped = function() {
          var args = arguments;
          var thisArg = this;
          if (timer) clearTimeout(timer);
          timer = setTimeout(function() { fn.apply(thisArg, args); }, Number(wait) || 150);
          timers.push(timer);
        };
        return wrapped;
      };

    function closest(target, selector) {
      if (!target || typeof target.closest !== 'function') return null;
      return target.closest(selector);
    }

    function addListener(target, type, listener, listenerOptions) {
      if (!target || typeof target.addEventListener !== 'function') return;
      target.addEventListener(type, listener, listenerOptions);
      unbinds.push(function() {
        if (target && typeof target.removeEventListener === 'function') {
          target.removeEventListener(type, listener, listenerOptions);
        }
      });
    }

    function clearTimer(timer) {
      if (!timer) return;
      if (windowObject && typeof windowObject.clearTimeout === 'function') windowObject.clearTimeout(timer);
      else clearTimeout(timer);
    }

    function getDragFileId(event, includeNavFallback) {
      var fileId = '';
      if (event && event.dataTransfer && typeof event.dataTransfer.getData === 'function') {
        try { fileId = event.dataTransfer.getData('text/plain') || ''; } catch (_) {}
      }
      if (!fileId && typeof opts.getDragFileId === 'function') {
        fileId = opts.getDragFileId() || '';
      }
      if (!fileId && windowObject && windowObject.app && windowObject.app.tempDragContext) {
        var context = windowObject.app.tempDragContext;
        if (context.type === 'file') fileId = context.fileId || '';
      }
      if (!fileId && includeNavFallback === true && nav && typeof nav.querySelector === 'function') {
        var navFile = nav.querySelector('[data-temp-file]');
        fileId = navFile && navFile.dataset ? navFile.dataset.tempFile || '' : '';
      }
      return fileId;
    }

    function bindFocusBlockEvents(block, options) {
      if (!block || typeof api.getTempExecFile !== 'function' || typeof api.setTempExecActive !== 'function') return;
      var blockOptions = options && typeof options === 'object' ? options : {};
      var shouldSwitchTab = blockOptions.switchTab !== false;
      var shouldScrollTop = blockOptions.scrollTop === true;
      var onEmptyClick = typeof blockOptions.onEmptyClick === 'function' ? blockOptions.onEmptyClick : null;
      addListener(block, 'click', function(event) {
        var removeButton = closest(event && event.target, '[data-temp-focus-remove]');
        if (removeButton) {
          if (event.preventDefault) event.preventDefault();
          if (event.stopPropagation) event.stopPropagation();
          confirmRemoveFocus(removeButton.dataset ? removeButton.dataset.tempFocusRemove : '');
          return;
        }
        var button = closest(event && event.target, 'button[data-temp-file]');
        if (!button) return;
        var fileId = button.dataset ? button.dataset.tempFile : '';
        if (!fileId || !api.getTempExecFile(fileId)) return;
        markFocusBadgeRead(fileId);
        if (fileId !== state.tempExecActiveId) api.setTempExecActive(fileId);
        if (shouldSwitchTab) switchTab('tempexec');
        if (shouldScrollTop) scrollToViewTop({ waitForDrawerUnlock: true });
      });
      if (onEmptyClick) {
        addListener(block, 'click', function(event) {
          var removeButton = closest(event && event.target, '[data-temp-focus-remove]');
          if (removeButton) return;
          var button = closest(event && event.target, 'button[data-temp-file]');
          if (button) return;
          onEmptyClick(event);
        });
      }
      addListener(block, 'dragstart', function(event) {
        var button = closest(event && event.target, 'button[data-temp-file]');
        if (!button || !event.dataTransfer) return;
        if (button.dataset && String(button.dataset.tempArchived || '') === '1') {
          if (event.preventDefault) event.preventDefault();
          return;
        }
        var fileId = button.dataset.tempFile || '';
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', fileId);
        if (fileId) setDragContext({ type: 'file', fileId: fileId });
      });
      addListener(block, 'dragend', function() { setDragContext(null); });
    }

    function cleanupFocusZoneIndicator(zone) {
      if (!zone) return;
      var indicator = zone._focusIndicator || null;
      if (indicator && indicator.parentNode) {
        try { indicator.parentNode.removeChild(indicator); } catch (_) {}
      }
      zone._focusIndicator = null;
    }

    function ensureFocusZoneIndicator(zone) {
      if (!zone || !document || typeof document.createElement !== 'function') return null;
      if (zone._focusIndicator) return zone._focusIndicator;
      var element = document.createElement('span');
      element.className = 'temp-focus-indicator';
      if (typeof element.setAttribute === 'function') element.setAttribute('aria-hidden', 'true');
      zone._focusIndicator = element;
      return element;
    }

    function getFocusButtons(zone, draggingId) {
      if (!zone || typeof zone.querySelectorAll !== 'function') return [];
      var nodes = Array.prototype.slice.call(zone.querySelectorAll('button[data-temp-file]'));
      if (!draggingId) return nodes;
      return nodes.filter(function(button) {
        return !button || !button.dataset || String(button.dataset.tempFile || '') !== String(draggingId);
      });
    }

    function updateFocusZoneIndicator(zone, draggingId, clientX) {
      var buttons = getFocusButtons(zone, draggingId);
      var indicator = ensureFocusZoneIndicator(zone);
      if (!indicator) return;
      var index = buttons.length;
      var reference = null;
      var x = typeof clientX === 'number' && Number.isFinite(clientX) ? clientX : 0;
      if (buttons.length) {
        for (var i = 0; i < buttons.length; i += 1) {
          var rect = buttons[i].getBoundingClientRect ? buttons[i].getBoundingClientRect() : null;
          if (!rect) continue;
          if (x <= rect.left + rect.width / 2) {
            index = i;
            reference = buttons[i];
            break;
          }
        }
      } else {
        index = 0;
      }
      if (indicator.dataset) indicator.dataset.dropIndex = String(index);
      if (reference) {
        if (reference !== indicator) {
          try { zone.insertBefore(indicator, reference); } catch (_) {}
        }
        return;
      }
      if (indicator.parentNode !== zone) {
        try { zone.appendChild(indicator); } catch (_) {}
      } else if (zone.lastChild !== indicator) {
        try { zone.appendChild(indicator); } catch (_) {}
      }
    }

    function resolveFocusDropIndex(zone, draggingId, clientX) {
      if (!zone) return 0;
      var indicator = zone._focusIndicator || null;
      if (indicator && indicator.parentNode === zone && indicator.dataset && indicator.dataset.dropIndex !== undefined) {
        var parsed = parseInt(indicator.dataset.dropIndex, 10);
        if (Number.isFinite(parsed) && parsed >= 0) return parsed;
      }
      var buttons = getFocusButtons(zone, draggingId);
      if (!buttons.length) return 0;
      var x = typeof clientX === 'number' && Number.isFinite(clientX) ? clientX : 0;
      for (var i = 0; i < buttons.length; i += 1) {
        var rect = buttons[i].getBoundingClientRect ? buttons[i].getBoundingClientRect() : null;
        if (!rect) continue;
        if (x <= rect.left + rect.width / 2) return i;
      }
      return buttons.length;
    }

    function bindFocusZoneDragDrop(zone) {
      if (!zone || typeof api.addTempExecFocus !== 'function') return;
      addListener(zone, 'dragover', function(event) {
        var dragId = getDragFileId(event, false);
        if (!dragId) return;
        if (event.preventDefault) event.preventDefault();
        if (zone.classList) zone.classList.add('dragover');
        updateFocusZoneIndicator(zone, dragId, event.clientX);
      });
      addListener(zone, 'dragleave', function(event) {
        if (!event || event.currentTarget !== zone || event.target !== zone) return;
        if (zone.classList) zone.classList.remove('dragover');
        cleanupFocusZoneIndicator(zone);
      });
      addListener(zone, 'drop', function(event) {
        if (event.preventDefault) event.preventDefault();
        if (zone.classList) zone.classList.remove('dragover');
        var fileId = getDragFileId(event, true);
        cleanupFocusZoneIndicator(zone);
        setDragContext(null);
        if (!fileId) return;
        var insertIndex = resolveFocusDropIndex(zone, fileId, event.clientX);
        if (typeof api.insertTempExecFocus === 'function') api.insertTempExecFocus(fileId, insertIndex);
        else api.addTempExecFocus(fileId);
      });
    }

    function ensureFocusScrollbar(zone) {
      if (!zone || !zone.querySelector || !document || typeof document.createElement !== 'function') return null;
      var bar = zone.querySelector('.temp-focus-scrollbar');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'temp-focus-scrollbar';
        var thumb = document.createElement('div');
        thumb.className = 'temp-focus-scrollbar-thumb';
        if (typeof bar.appendChild === 'function') bar.appendChild(thumb);
        if (typeof zone.appendChild === 'function') zone.appendChild(bar);
      }
      return bar;
    }

    function syncFocusScrollbar(zone) {
      if (!zone) return;
      var bar = ensureFocusScrollbar(zone);
      if (!bar) return;
      bindFocusScrollbarDrag(zone);
      bar.style.transform = 'translateX(' + (zone.scrollLeft || 0) + 'px)';
      var thumb = bar.querySelector ? bar.querySelector('.temp-focus-scrollbar-thumb') : null;
      if (!thumb) return;
      var total = zone.scrollWidth || 0;
      var visible = zone.clientWidth || 0;
      if (!visible || total <= visible + 1) {
        bar.style.display = 'none';
        return;
      }
      bar.style.display = '';
      var track = bar.clientWidth || 0;
      if (!track && bar.getBoundingClientRect) {
        var rect = bar.getBoundingClientRect();
        track = rect ? rect.width : 0;
      }
      if (!track) return;
      var thumbWidth = Math.floor(track * visible / total);
      if (thumbWidth < 24) thumbWidth = 24;
      if (thumbWidth > track) thumbWidth = track;
      var maxScroll = total - visible;
      var maxThumb = track - thumbWidth;
      var left = maxScroll > 0 ? (zone.scrollLeft / maxScroll) * maxThumb : 0;
      thumb.style.width = thumbWidth + 'px';
      thumb.style.transform = 'translateX(' + left + 'px)';
    }

    function bindFocusScrollbarDrag(zone) {
      if (!zone) return;
      var bar = ensureFocusScrollbar(zone);
      if (!bar || bar._tempExecFocusOwnerBound) return;
      bar._tempExecFocusOwnerBound = true;
      var thumb = bar.querySelector ? bar.querySelector('.temp-focus-scrollbar-thumb') : null;
      if (!thumb) return;
      var dragging = false;
      var startX = 0;
      var startScroll = 0;
      var onMove = function(event) {
        if (!dragging || !event) return;
        var rect = bar.getBoundingClientRect ? bar.getBoundingClientRect() : null;
        var track = rect ? rect.width : 0;
        var total = zone.scrollWidth || 0;
        var visible = zone.clientWidth || 0;
        var maxScroll = total - visible;
        if (!track || maxScroll <= 0) return;
        var thumbWidth = thumb.offsetWidth || 0;
        var maxThumb = track - thumbWidth;
        if (maxThumb <= 0) return;
        var delta = event.clientX - startX;
        var scrollDelta = delta * (maxScroll / maxThumb);
        var next = startScroll + scrollDelta;
        if (next < 0) next = 0;
        if (next > maxScroll) next = maxScroll;
        zone.scrollLeft = next;
      };
      var removeDragListeners = function() {
        if (!document || typeof document.removeEventListener !== 'function') return;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        var index = activeDragCleanups.indexOf(removeDragListeners);
        if (index >= 0) activeDragCleanups.splice(index, 1);
      };
      var onUp = function() {
        if (!dragging) return;
        dragging = false;
        removeDragListeners();
      };
      addListener(thumb, 'mousedown', function(event) {
        if (!event || event.button !== 0 || !document) return;
        dragging = true;
        startX = event.clientX;
        startScroll = zone.scrollLeft;
        if (typeof document.addEventListener === 'function') {
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
          activeDragCleanups.push(removeDragListeners);
        }
        if (event.preventDefault) event.preventDefault();
      });
      addListener(bar, 'click', function(event) {
        if (!event || event.target === thumb) return;
        var rect = bar.getBoundingClientRect ? bar.getBoundingClientRect() : null;
        var track = rect ? rect.width : 0;
        if (!track) return;
        var offset = event.clientX - rect.left;
        var ratio = offset / track;
        if (ratio < 0) ratio = 0;
        if (ratio > 1) ratio = 1;
        var maxScroll = (zone.scrollWidth || 0) - (zone.clientWidth || 0);
        if (maxScroll <= 0) return;
        zone.scrollLeft = Math.round(maxScroll * ratio);
      });
    }

    function bindFocusZoneScroll(zone) {
      if (!zone) return;
      ensureFocusScrollbar(zone);
      syncFocusScrollbar(zone);
      bindFocusScrollbarDrag(zone);
      var timer = 0;
      addListener(zone, 'scroll', function() {
        if (zone.classList) zone.classList.add('scrolling');
        if (timer) clearTimer(timer);
        timer = setTimeout(function() {
          if (zone.classList) zone.classList.remove('scrolling');
        }, 800);
        timers.push(timer);
        syncFocusScrollbar(zone);
      });
      addListener(zone, 'mouseenter', function() { syncFocusScrollbar(zone); });
      addListener(zone, 'wheel', function(event) {
        if (!event || zone.scrollWidth <= zone.clientWidth) return;
        var deltaX = Number(event.deltaX) || 0;
        var deltaY = Number(event.deltaY) || 0;
        if (!deltaX && !deltaY) return;
        if (Math.abs(deltaY) >= Math.abs(deltaX)) {
          zone.scrollLeft += deltaY;
          if (event.preventDefault) event.preventDefault();
        }
      }, { passive: false });
      var syncDebounced = debounce(function() { syncFocusScrollbar(zone); }, 120);
      addListener(windowObject, 'resize', syncDebounced);
      if (typeof MutationObserver !== 'undefined' && !zone._focusScrollbarObserver) {
        var observer = new MutationObserver(function() { syncFocusScrollbar(zone); });
        observer.observe(zone, { childList: true, subtree: true });
        zone._focusScrollbarObserver = observer;
        observers.push({ zone: zone, observer: observer });
      }
    }

    function cleanupAllFocusIndicators() {
      [focusZone, viewFocusZone].forEach(function(zone) {
        if (!zone) return;
        if (zone.classList) zone.classList.remove('dragover');
        cleanupFocusZoneIndicator(zone);
      });
    }

    bindFocusBlockEvents(focusBlock, { switchTab: true, scrollTop: true });
    bindFocusBlockEvents(viewFocusBlock, {
      switchTab: false,
      scrollTop: true,
      onEmptyClick: openAssignDrawer,
    });
    bindFocusZoneDragDrop(focusZone);
    bindFocusZoneDragDrop(viewFocusZone);
    bindFocusZoneScroll(focusZone);
    bindFocusZoneScroll(viewFocusZone);
    addListener(document, 'dragend', cleanupAllFocusIndicators);

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      unbinds.splice(0).forEach(function(unbind) {
        try { unbind(); } catch (_) {}
      });
      activeDragCleanups.splice(0).forEach(function(cleanup) {
        try { cleanup(); } catch (_) {}
      });
      timers.splice(0).forEach(clearTimer);
      observers.splice(0).forEach(function(item) {
        if (item && item.observer && typeof item.observer.disconnect === 'function') item.observer.disconnect();
        if (item && item.zone) delete item.zone._focusScrollbarObserver;
      });
      [focusZone, viewFocusZone].forEach(function(zone) {
        if (!zone) return;
        delete zone._focusScrollbarObserver;
        var bar = zone.querySelector ? zone.querySelector('.temp-focus-scrollbar') : null;
        if (bar) delete bar._tempExecFocusOwnerBound;
      });
      cleanupAllFocusIndicators();
    }

    return {
      cleanupAllFocusIndicators: cleanupAllFocusIndicators,
      resolveFocusDropIndex: resolveFocusDropIndex,
      updateFocusZoneIndicator: updateFocusZoneIndicator,
      syncFocusScrollbar: syncFocusScrollbar,
      destroy: destroy,
    };
  }

  return { create: create };
});
