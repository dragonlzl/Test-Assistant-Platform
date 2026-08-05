(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.drawerRequestController = api;
  }
})(function() {
  var SELECT_REQUEST_KEY = 'tap-case-library-select-exec-request';
  var MISSING_REQUEST_KEY = 'tap-case-library-missing-drawer-request';
  var TEMP_EXEC_ASSIGN_KEY = 'tap-temp-exec-assign-request';

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var windowRef = opts.window || (typeof window !== 'undefined' ? window : null);
    var documentRef = opts.document || (typeof document !== 'undefined' ? document : null);
    var storage = opts.storage || null;
    var getSelectDrawer = typeof opts.getSelectDrawer === 'function'
      ? opts.getSelectDrawer
      : function() { return null; };
    var getMissingDrawer = typeof opts.getMissingDrawer === 'function'
      ? opts.getMissingDrawer
      : function() { return null; };
    var now = typeof opts.now === 'function' ? opts.now : Date.now;
    var setTimer = typeof opts.setTimeout === 'function' ? opts.setTimeout : setTimeout;
    var clearTimer = typeof opts.clearTimeout === 'function' ? opts.clearTimeout : clearTimeout;
    var missingOpenTimer = 0;
    var skipCloseTimer = 0;

    function getApp() {
      return windowRef && windowRef.app ? windowRef.app : null;
    }

    function safely(action, fallback) {
      try {
        return action();
      } catch (error) {
        return fallback;
      }
    }

    function createRequestFlag(propertyName, storageKey) {
      function mark() {
        var app = getApp();
        safely(function() { if (app) app[propertyName] = true; });
        safely(function() { if (storage) storage.setItem(storageKey, '1'); });
      }

      function peek() {
        var app = getApp();
        return Boolean(
          safely(function() { return app && app[propertyName]; }, false) ||
          safely(function() { return storage && storage.getItem(storageKey) === '1'; }, false)
        );
      }

      function consume() {
        var app = getApp();
        var consumed = Boolean(safely(function() {
          if (app && app[propertyName]) {
            app[propertyName] = false;
            return true;
          }
          return false;
        }, false));
        if (safely(function() { return storage && storage.getItem(storageKey) === '1'; }, false)) {
          consumed = true;
        }
        if (consumed) safely(function() { if (storage) storage.removeItem(storageKey); });
        return consumed;
      }

      return { mark: mark, peek: peek, consume: consume };
    }

    var selectRequest = createRequestFlag('__caseLibrarySelectExecRequest', SELECT_REQUEST_KEY);
    var missingRequest = createRequestFlag('__caseLibraryMissingDrawerRequest', MISSING_REQUEST_KEY);

    function isCaseLibraryActive() {
      if (typeof opts.isCaseLibraryActive === 'function') return Boolean(opts.isCaseLibraryActive());
      var app = getApp();
      var state = app && app.state ? app.state : {};
      if (state.activeTab === 'case-library') return true;
      var visible = documentRef && documentRef.querySelector
        ? documentRef.querySelector('section[data-tab-section="case-library"]:not(.hidden)')
        : null;
      return Boolean(visible);
    }

    function requestTempExecAssign(options2) {
      var requestOptions = options2 && typeof options2 === 'object' ? options2 : {};
      var name = requestOptions.caseName || requestOptions.name || '用例';
      var version = requestOptions.versionName || requestOptions.version || '未分配版本';
      var payload = { name: String(name), versionName: String(version), at: now() };
      var app = getApp();
      safely(function() { if (app) app.__tempExecAssignRequest = payload; });
      safely(function() {
        if (storage) storage.setItem(TEMP_EXEC_ASSIGN_KEY, JSON.stringify(payload));
      });
      safely(function() {
        if (windowRef && windowRef.dispatchEvent && typeof windowRef.CustomEvent === 'function') {
          windowRef.dispatchEvent(new windowRef.CustomEvent('temp-exec-assign-request', { detail: payload }));
        }
      });
      return payload;
    }

    function openSelectDirect() {
      var drawer = getSelectDrawer();
      return drawer && typeof drawer.open === 'function' ? drawer.open() : false;
    }

    function hasOtherOpenDrawers(drawerElement) {
      if (!drawerElement || !documentRef || !documentRef.querySelectorAll) return false;
      var openDrawers = documentRef.querySelectorAll('.drawer.open, .drawer.closing');
      for (var i = 0; openDrawers && i < openDrawers.length; i += 1) {
        if (openDrawers[i] && openDrawers[i] !== drawerElement) return true;
      }
      return false;
    }

    function markDrawerSkipClose(drawerId, ttlMs) {
      var app = getApp();
      var id = String(drawerId || '');
      var ttl = Number(ttlMs);
      if (!id) return;
      safely(function() {
        if (app) {
          app.__drawerSkipCloseId = id;
          app.__drawerCloseGuard = { id: id, until: now() + (isFinite(ttl) ? ttl : 0) };
        }
      });
      if (!isFinite(ttl) || ttl <= 0) return;
      if (skipCloseTimer) clearTimer(skipCloseTimer);
      skipCloseTimer = setTimer(function() {
        skipCloseTimer = 0;
        safely(function() {
          if (!app) return;
          if (app.__drawerSkipCloseId === id) app.__drawerSkipCloseId = '';
          if (app.__drawerCloseGuard && String(app.__drawerCloseGuard.id || '') === id) {
            app.__drawerCloseGuard = null;
          }
        });
      }, ttl);
    }

    function getMissingElement(drawer) {
      if (drawer && drawer.element) return drawer.element;
      return documentRef && documentRef.getElementById
        ? documentRef.getElementById('caseLibraryMissingDrawer')
        : null;
    }

    function openMissingDirect(options2) {
      var directOptions = options2 || {};
      var skipClose = Boolean(directOptions.skipClose);
      var waitClose = directOptions.waitClose === undefined ? !skipClose : Boolean(directOptions.waitClose);
      var delayMs = Number(directOptions.delayMs);
      var maxWaitMs = Number(directOptions.maxWaitMs);
      var pollInterval = Number(directOptions.pollIntervalMs);
      if (!isFinite(delayMs) || delayMs < 0) delayMs = 360;
      if (!isFinite(maxWaitMs) || maxWaitMs < 0) maxWaitMs = 900;
      if (!isFinite(pollInterval) || pollInterval <= 0) pollInterval = 60;
      var drawer = getMissingDrawer();
      var drawerElement = getMissingElement(drawer);
      if (drawerElement && drawerElement.classList && drawerElement.classList.contains('open')) return true;
      if (missingOpenTimer) {
        clearTimer(missingOpenTimer);
        missingOpenTimer = 0;
      }
      var app = getApp();
      var drawerApi = app && app.drawer ? app.drawer : null;
      var shouldDelay = false;
      if (!skipClose && drawerApi && typeof drawerApi.closeAllDrawers === 'function') {
        shouldDelay = hasOtherOpenDrawers(drawerElement);
        drawerApi.closeAllDrawers();
      }
      if (shouldDelay && waitClose) {
        var startAt = now();
        var attemptOpen = function() {
          if (missingOpenTimer) clearTimer(missingOpenTimer);
          missingOpenTimer = 0;
          if (hasOtherOpenDrawers(drawerElement) && now() - startAt < maxWaitMs) {
            missingOpenTimer = setTimer(attemptOpen, pollInterval);
            return;
          }
          openMissingDirect({ skipClose: true, waitClose: false });
        };
        missingOpenTimer = setTimer(attemptOpen, delayMs);
        return true;
      }
      markDrawerSkipClose('caseLibraryMissingDrawer', 800);
      if (drawer && typeof drawer.open === 'function') {
        drawer.open();
        return true;
      }
      var fallbackButton = documentRef && documentRef.getElementById
        ? documentRef.getElementById('openCaseLibraryMissingDrawerBtn')
        : null;
      if (fallbackButton && typeof fallbackButton.click === 'function') {
        fallbackButton.click();
        return true;
      }
      return false;
    }

    function openRequested(options2, request, openDirect) {
      var openOptions = options2 || {};
      if (!openOptions.allowInactive && !openOptions.force && !openOptions.skipTabCheck && !isCaseLibraryActive()) {
        request.mark();
        return false;
      }
      request.consume();
      return openDirect();
    }

    function openSelect(options2) {
      return openRequested(options2, selectRequest, openSelectDirect);
    }

    function openMissing(options2) {
      return openRequested(options2, missingRequest, openMissingDirect);
    }

    function scheduleMissingOpen(options2) {
      var scheduleOptions = options2 || {};
      var attempts = Number(scheduleOptions.attempts);
      var interval = Number(scheduleOptions.intervalMs);
      var delay = Number(scheduleOptions.delayMs);
      if (!isFinite(attempts) || attempts <= 0) attempts = 3;
      if (!isFinite(interval) || interval <= 0) interval = 160;
      if (!isFinite(delay) || delay < 0) delay = 0;
      function isOpen() {
        var element = getMissingElement(getMissingDrawer());
        return Boolean(missingOpenTimer || (element && element.classList && element.classList.contains('open')));
      }
      function tryOpen() {
        if (isOpen()) return;
        openMissingDirect({ waitClose: true });
        setTimer(function() {
          if (isOpen()) return;
          attempts -= 1;
          if (attempts > 0) setTimer(tryOpen, interval);
        }, interval);
      }
      setTimer(tryOpen, delay);
    }

    return {
      requestSelect: selectRequest.mark,
      consumeSelect: selectRequest.consume,
      requestMissing: missingRequest.mark,
      peekMissing: missingRequest.peek,
      consumeMissing: missingRequest.consume,
      requestTempExecAssign: requestTempExecAssign,
      openSelectDirect: openSelectDirect,
      openSelect: openSelect,
      openMissingDirect: openMissingDirect,
      openMissing: openMissing,
      scheduleMissingOpen: scheduleMissingOpen,
    };
  }

  return { create: create };
});
