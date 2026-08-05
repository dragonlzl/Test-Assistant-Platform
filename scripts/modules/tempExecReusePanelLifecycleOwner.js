(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.tempExecReusePanelLifecycleOwner = api;
  }
})(function() {
  function isRowOutOfView(rowElement, viewportHeight) {
    if (!rowElement || typeof rowElement.getBoundingClientRect !== 'function') return false;
    var rect = rowElement.getBoundingClientRect();
    return rect.bottom <= 0 || rect.top >= viewportHeight;
  }

  function isRowInView(rowElement, viewportHeight) {
    if (!rowElement || typeof rowElement.getBoundingClientRect !== 'function') return false;
    var rect = rowElement.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < viewportHeight;
  }

  function isRowNearView(rowElement, viewportHeight, margin) {
    if (!rowElement || typeof rowElement.getBoundingClientRect !== 'function') return false;
    var rect = rowElement.getBoundingClientRect();
    var distance = Number(margin) || 0;
    return rect.bottom > -distance && rect.top < viewportHeight + distance;
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var browser = opts.window || (typeof window !== 'undefined' ? window : {});
    var document = opts.document || (browser && browser.document ? browser.document : null);
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var api = opts.api && typeof opts.api === 'object' ? opts.api : {};
    var view = opts.view || null;
    var viewSection = opts.viewSection || null;
    var preopenMargin = Number(opts.preopenMargin) || 1500;
    var bound = false;
    var lastScrollTop = 0;
    var scrollDirection = 'down';
    var idleToken = 0;
    var placeholderObserver = null;
    var suppressLayoutScrollUntil = 0;

    function getViewportHeight() {
      if (browser && typeof browser.innerHeight === 'number') return browser.innerHeight;
      if (document && document.documentElement && typeof document.documentElement.clientHeight === 'number') {
        return document.documentElement.clientHeight;
      }
      return 0;
    }

    function getScrollTop() {
      if (!browser) return 0;
      if (typeof browser.scrollY === 'number') return browser.scrollY;
      if (document && document.documentElement && typeof document.documentElement.scrollTop === 'number') {
        return document.documentElement.scrollTop;
      }
      return 0;
    }

    function getScrollMax() {
      if (!document) return 0;
      var documentElement = document.documentElement;
      var body = document.body;
      var scrollHeight = 0;
      var candidates = [
        documentElement && documentElement.scrollHeight ? documentElement.scrollHeight : 0,
        documentElement && documentElement.offsetHeight ? documentElement.offsetHeight : 0,
        documentElement && documentElement.clientHeight ? documentElement.clientHeight : 0,
        body && body.scrollHeight ? body.scrollHeight : 0,
        body && body.offsetHeight ? body.offsetHeight : 0,
      ];
      candidates.forEach(function(value) {
        if (Number.isFinite(value) && value > scrollHeight) scrollHeight = value;
      });
      var max = scrollHeight - getViewportHeight();
      if (!Number.isFinite(max) || max < 0) max = 0;
      return max;
    }

    function isScrollAtBoundary(direction) {
      var top = getScrollTop();
      var max = getScrollMax();
      var epsilon = 1;
      if (direction === 'down') return top >= max - epsilon;
      if (direction === 'up') return top <= epsilon;
      return false;
    }

    function scheduleIdleCheck() {
      if (!browser) return;
      var schedule = typeof browser.requestAnimationFrame === 'function'
        ? function(callback) { browser.requestAnimationFrame(callback); }
        : function(callback) { setTimeout(callback, 16); };
      idleToken += 1;
      var token = idleToken;
      var last = getScrollTop();
      var stableFrames = 0;
      var check = function() {
        if (token !== idleToken) return;
        var current = getScrollTop();
        if (current !== last) {
          last = current;
          stableFrames = 0;
        } else {
          stableFrames += 1;
          if (stableFrames >= 2) {
            scrollDirection = 'idle';
            autoCollapse();
            return;
          }
        }
        schedule(check);
      };
      schedule(check);
    }

    function ensurePlaceholders(fileId) {
      if (!state.tempExecReusePlaceholders || typeof state.tempExecReusePlaceholders !== 'object') {
        state.tempExecReusePlaceholders = {};
      }
      if (!fileId) return {};
      if (!state.tempExecReusePlaceholders[fileId] || typeof state.tempExecReusePlaceholders[fileId] !== 'object') {
        state.tempExecReusePlaceholders[fileId] = {};
      }
      return state.tempExecReusePlaceholders[fileId];
    }

    function ensurePanelHeights(fileId) {
      if (!state.tempExecReusePanelHeights || typeof state.tempExecReusePanelHeights !== 'object') {
        state.tempExecReusePanelHeights = {};
      }
      if (!fileId) return {};
      if (!state.tempExecReusePanelHeights[fileId] || typeof state.tempExecReusePanelHeights[fileId] !== 'object') {
        state.tempExecReusePanelHeights[fileId] = {};
      }
      return state.tempExecReusePanelHeights[fileId];
    }

    function clearPlaceholders(fileId, indexes) {
      if (!state.tempExecReusePlaceholders || typeof state.tempExecReusePlaceholders !== 'object') return;
      if (!fileId) return;
      var map = state.tempExecReusePlaceholders[fileId];
      if (!map || typeof map !== 'object') return;
      var list = Array.isArray(indexes) ? indexes : [indexes];
      list.forEach(function(index) {
        var key = String(index);
        if (map[key] !== undefined) delete map[key];
      });
    }

    function recordPanelHeight(fileId, indexes) {
      if (!view) return;
      var map = ensurePanelHeights(fileId);
      var list = Array.isArray(indexes) ? indexes : [indexes];
      list.forEach(function(index) {
        var selector = '[data-temp-reuse-panel-container="' + String(fileId) + '"][data-index="' + String(index) + '"]';
        var panel = view.querySelector ? view.querySelector(selector) : null;
        if (!panel) return;
        var rect = panel.getBoundingClientRect ? panel.getBoundingClientRect() : null;
        var height = rect && rect.height ? Math.round(rect.height) : 0;
        if (!height && panel.offsetHeight) height = Math.round(panel.offsetHeight);
        if (!height && panel.scrollHeight) height = Math.round(panel.scrollHeight);
        if (height > 0) map[String(index)] = height;
      });
    }

    function schedulePanelHeightRecord(fileId, indexes) {
      recordPanelHeight(fileId, indexes);
      if (browser && typeof browser.requestAnimationFrame === 'function') {
        browser.requestAnimationFrame(function() { recordPanelHeight(fileId, indexes); });
      }
    }

    function ensurePlaceholderObserver() {
      if (placeholderObserver) return placeholderObserver;
      var Observer = browser && typeof browser.IntersectionObserver === 'function'
        ? browser.IntersectionObserver
        : null;
      if (!Observer) return null;
      placeholderObserver = new Observer(function(entries) {
        entries.forEach(function(entry) {
          if (!entry || !entry.isIntersecting) return;
          if (scrollDirection === 'down') return;
          var target = entry.target;
          if (!target || !target.getAttribute) return;
          var fileId = target.getAttribute('data-temp-reuse-row') || '';
          var rawIndex = target.getAttribute('data-index');
          var index = rawIndex !== null ? Number(rawIndex) : NaN;
          if (!fileId || !Number.isFinite(index)) return;
          var placeholders = ensurePlaceholders(fileId);
          if (!placeholders || placeholders[String(index)] === undefined) return;
          clearPlaceholders(fileId, index);
          if (typeof api.toggleTempExecReusePanel === 'function') {
            api.toggleTempExecReusePanel(fileId, [index]);
            schedulePanelHeightRecord(fileId, [index]);
          }
          if (placeholderObserver) {
            try { placeholderObserver.unobserve(target); } catch (error) {}
          }
        });
      }, { root: null, rootMargin: preopenMargin + 'px 0px', threshold: 0.01 });
      return placeholderObserver;
    }

    function observePlaceholders() {
      if (!view || !view.querySelectorAll) return;
      var observer = ensurePlaceholderObserver();
      if (!observer) return;
      var nodes = view.querySelectorAll('.reuse-row.placeholder');
      nodes.forEach(function(node) {
        if (!node || node._reuseObserved) return;
        node._reuseObserved = true;
        observer.observe(node);
      });
    }

    function resolveOpenRow(fileId, index) {
      if (!view || !view.querySelector) return null;
      var selector = '[data-temp-reuse-panel-container="' + String(fileId) + '"][data-index="' + String(index) + '"]';
      var panel = view.querySelector(selector);
      if (!panel) return null;
      if (panel.closest) {
        var row = panel.closest('tr.reuse-row');
        if (row) return row;
      }
      return panel;
    }

    function resolveRowContainer(fileId, index) {
      if (!view || !view.querySelector) return null;
      var selector = '[data-temp-reuse-row="' + String(fileId) + '"][data-index="' + String(index) + '"]';
      return view.querySelector(selector);
    }

    function syncOpenFromDom(fileId, openSet) {
      if (!view || !view.querySelectorAll || !openSet) return;
      var selector = '.reuse-row.visible[data-temp-reuse-row="' + String(fileId) + '"]';
      var nodes = view.querySelectorAll(selector);
      nodes.forEach(function(node) {
        if (!node || !node.getAttribute) return;
        var rawIndex = node.getAttribute('data-index');
        var index = rawIndex !== null ? Number(rawIndex) : NaN;
        if (Number.isFinite(index)) openSet.add(index);
      });
    }

    function closePanels(fileId, indexes, openSet) {
      if (!fileId || !indexes || !indexes.length) return;
      var setReference = openSet || (typeof api.ensureTempExecReuseOpen === 'function'
        ? api.ensureTempExecReuseOpen(fileId)
        : null);
      if (setReference && setReference.delete) {
        indexes.forEach(function(index) { setReference.delete(index); });
      }
      if (typeof api.renderTempExecView === 'function') {
        api.renderTempExecView();
      } else if (typeof api.toggleTempExecReusePanel === 'function') {
        api.toggleTempExecReusePanel(fileId, indexes);
      }
    }

    function autoCollapse() {
      if (!view || typeof api.ensureTempExecReuseOpen !== 'function' || typeof api.toggleTempExecReusePanel !== 'function') return;
      if (view.classList && view.classList.contains('hidden')) return;
      if (viewSection && viewSection.classList && viewSection.classList.contains('hidden')) return;
      var fileId = state.tempExecActiveId ? String(state.tempExecActiveId || '') : '';
      if (!fileId) return;
      var openSet = api.ensureTempExecReuseOpen(fileId);
      if (!openSet) return;
      syncOpenFromDom(fileId, openSet);
      var viewportHeight = getViewportHeight();
      if (!viewportHeight) return;
      var placeholders = ensurePlaceholders(fileId);
      var reuseHeights = ensurePanelHeights(fileId);
      var toClose = [];
      if (openSet.size) {
        var indexes = Array.from(openSet);
        for (var i = 0; i < indexes.length; i += 1) {
          var index = indexes[i];
          var rowElement = resolveOpenRow(fileId, index);
          if (!rowElement || !isRowOutOfView(rowElement, viewportHeight)) continue;
          var rect = rowElement.getBoundingClientRect ? rowElement.getBoundingClientRect() : null;
          if (rect) {
            var panelElement = rowElement.querySelector ? rowElement.querySelector('.reuse-panel') : null;
            var panelRect = panelElement && panelElement.getBoundingClientRect ? panelElement.getBoundingClientRect() : null;
            var panelHeight = panelRect && panelRect.height ? Math.round(panelRect.height) : 0;
            if (!panelHeight && panelElement && panelElement.offsetHeight) panelHeight = Math.round(panelElement.offsetHeight);
            if (!panelHeight && panelElement && panelElement.scrollHeight) panelHeight = Math.round(panelElement.scrollHeight);
            if (!panelHeight && rowElement.offsetHeight) panelHeight = Math.round(rowElement.offsetHeight);
            if (!panelHeight && rowElement.scrollHeight) panelHeight = Math.round(rowElement.scrollHeight);
            if (!panelHeight && rect.height) panelHeight = Math.round(rect.height);
            if (!panelHeight && reuseHeights[String(index)]) panelHeight = Number(reuseHeights[String(index)]) || 0;
            if (panelHeight > 0) placeholders[String(index)] = panelHeight;
          }
          toClose.push(index);
        }
      }
      var toOpen = [];
      var allowPreopen = scrollDirection === 'up';
      Object.keys(placeholders).forEach(function(key) {
        var index = Number(key);
        if (!Number.isFinite(index) || openSet.has(index)) return;
        var rowElement = resolveRowContainer(fileId, index);
        if (!rowElement) return;
        if (allowPreopen) {
          if (isRowNearView(rowElement, viewportHeight, preopenMargin)) toOpen.push(index);
        } else if (scrollDirection === 'idle' && isRowInView(rowElement, viewportHeight)) {
          toOpen.push(index);
        }
      });
      if (!toOpen.length && allowPreopen) {
        Object.keys(placeholders).forEach(function(key) {
          var index = Number(key);
          if (!Number.isFinite(index) || openSet.has(index)) return;
          var rowElement = resolveRowContainer(fileId, index);
          if (rowElement && isRowInView(rowElement, viewportHeight)) toOpen.push(index);
        });
      }
      if (toClose.length) {
        state.tempExecPreserveScrollOnce = true;
        closePanels(fileId, toClose, openSet);
        if (browser && typeof browser.requestAnimationFrame === 'function') {
          browser.requestAnimationFrame(observePlaceholders);
        } else {
          observePlaceholders();
        }
      }
      if (toOpen.length) {
        clearPlaceholders(fileId, toOpen);
        state.tempExecPreserveScrollOnce = true;
        api.toggleTempExecReusePanel(fileId, toOpen);
        schedulePanelHeightRecord(fileId, toOpen);
      }
    }

    function markManualToggle() {
      idleToken += 1;
      suppressLayoutScrollUntil = Date.now() + 250;
    }

    function bind() {
      if (bound || !view || !browser || typeof browser.addEventListener !== 'function') return false;
      bound = true;
      lastScrollTop = getScrollTop();
      var scrollScheduled = false;
      var scheduleScrollUpdate = function() {
        if (scrollScheduled) return;
        scrollScheduled = true;
        var run = function() {
          scrollScheduled = false;
          var currentScrollTop = getScrollTop();
          if (Date.now() < suppressLayoutScrollUntil) {
            lastScrollTop = currentScrollTop;
            return;
          }
          if (currentScrollTop > lastScrollTop) scrollDirection = 'down';
          else if (currentScrollTop < lastScrollTop) scrollDirection = 'up';
          lastScrollTop = currentScrollTop;
          autoCollapse();
          scheduleIdleCheck();
        };
        if (typeof browser.requestAnimationFrame === 'function') browser.requestAnimationFrame(run);
        else setTimeout(run, 0);
      };
      browser.addEventListener('scroll', scheduleScrollUpdate);
      browser.addEventListener('wheel', function(event) {
        suppressLayoutScrollUntil = 0;
        if (event && typeof event.deltaY === 'number') {
          if (event.deltaY > 0) {
            if (isScrollAtBoundary('down')) return;
            scrollDirection = 'down';
          } else if (event.deltaY < 0) {
            if (isScrollAtBoundary('up')) return;
            scrollDirection = 'up';
          }
        }
        scheduleScrollUpdate();
        scheduleIdleCheck();
      });
      return true;
    }

    return {
      bind: bind,
      autoCollapse: autoCollapse,
      observePlaceholders: observePlaceholders,
      clearPlaceholders: clearPlaceholders,
      recordPanelHeight: recordPanelHeight,
      schedulePanelHeightRecord: schedulePanelHeightRecord,
      markManualToggle: markManualToggle,
      ensurePlaceholders: ensurePlaceholders,
      ensurePanelHeights: ensurePanelHeights,
    };
  }

  return {
    create: create,
    isRowOutOfView: isRowOutOfView,
    isRowInView: isRowInView,
    isRowNearView: isRowNearView,
  };
});
