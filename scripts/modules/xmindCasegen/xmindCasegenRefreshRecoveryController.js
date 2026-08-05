(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenRefreshRecoveryController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var retryLimit = Math.max(1, Number(opts.retryLimit || 18));
    var getViewState = typeof opts.getViewState === 'function'
      ? opts.getViewState : function() { return {}; };
    var getActiveWorkspaceId = typeof opts.getActiveWorkspaceId === 'function'
      ? opts.getActiveWorkspaceId : function() { return ''; };
    var getWorkspaceRecord = typeof opts.getWorkspaceRecord === 'function'
      ? opts.getWorkspaceRecord : function() { return null; };
    var listManagedTasks = typeof opts.listManagedTasks === 'function'
      ? opts.listManagedTasks : function() { return []; };
    var isTaskTerminal = typeof opts.isTaskTerminal === 'function'
      ? opts.isTaskTerminal : function() { return false; };
    var filterTasksByWorkspace = typeof opts.filterTasksByWorkspace === 'function'
      ? opts.filterTasksByWorkspace
      : function(tasks, workspaceId) {
        return (Array.isArray(tasks) ? tasks : []).filter(function(task) {
          return String(task && task.workspaceId || '') === String(workspaceId || '');
        });
      };
    var isDrawerOpen = typeof opts.isDrawerOpen === 'function'
      ? opts.isDrawerOpen : function() { return false; };
    var openDrawer = typeof opts.openDrawer === 'function' ? opts.openDrawer : function() {};
    var applyPendingSuspendViewStateCache = typeof opts.applyPendingSuspendViewStateCache === 'function'
      ? opts.applyPendingSuspendViewStateCache : function() {};
    var reconcileManagedTasks = typeof opts.reconcileManagedTasks === 'function'
      ? opts.reconcileManagedTasks : function() {};
    var ensureWorkspaceHostState = typeof opts.ensureWorkspaceHostState === 'function'
      ? opts.ensureWorkspaceHostState : function() { return {}; };
    var ensureActiveWorkspaceHydrated = typeof opts.ensureActiveWorkspaceHydrated === 'function'
      ? opts.ensureActiveWorkspaceHydrated : function() {};
    var setDebugState = typeof opts.setDebugState === 'function' ? opts.setDebugState : function() {};
    var setTimer = typeof opts.setTimer === 'function'
      ? opts.setTimer : function(handler, delay) { return setTimeout(handler, delay); };
    var clearTimer = typeof opts.clearTimer === 'function'
      ? opts.clearTimer : function(timerId) { clearTimeout(timerId); };
    var now = typeof opts.now === 'function' ? opts.now : function() { return Date.now(); };

    var retryTimer = 0;
    var retryCount = 0;
    var stableCount = 0;
    var manualCloseSuppressUntil = 0;

    function clearRetry(reason) {
      var hadRetry = retryTimer || retryCount > 0 || stableCount > 0;
      if (retryTimer) {
        clearTimer(retryTimer);
        retryTimer = 0;
      }
      if (hadRetry) {
        setDebugState({ drawerRestoreClearedBy: String(reason || '') });
      }
      retryCount = 0;
      stableCount = 0;
    }

    function markManualCloseSuppressed(durationMs) {
      var ttl = Math.max(0, Number(durationMs || 0));
      manualCloseSuppressUntil = ttl > 0 ? now() + ttl : 0;
    }

    function isManualCloseSuppressed() {
      if (!manualCloseSuppressUntil) return false;
      if (now() >= manualCloseSuppressUntil) {
        manualCloseSuppressUntil = 0;
        return false;
      }
      return true;
    }

    function getWorkspaceSnapshotViewState(workspaceId) {
      var record = getWorkspaceRecord(workspaceId);
      if (!record || !record.snapshot || !record.snapshot.xmind) return null;
      var viewState = record.snapshot.xmind.viewState;
      return viewState && typeof viewState === 'object' ? viewState : null;
    }

    function hasWorkspaceSnapshotRestoreIntent(workspaceId) {
      var viewState = getWorkspaceSnapshotViewState(workspaceId);
      return Boolean(viewState && viewState.drawerOpen === true);
    }

    function getManagedTaskRestoreWorkspaceId() {
      var matchedId = '';
      listManagedTasks().some(function(task) {
        if (!task || isTaskTerminal(task)) return false;
        var restoreContext = task.restoreContext && typeof task.restoreContext === 'object'
          ? task.restoreContext
          : null;
        if (!restoreContext || !restoreContext.viewState || restoreContext.viewState.drawerOpen !== true) {
          return false;
        }
        matchedId = String(restoreContext.workspaceId || task.workspaceId || '');
        return true;
      });
      return matchedId;
    }

    function hasRestoreIntent() {
      var viewState = getViewState();
      if (viewState && viewState.drawerOpen === true) return true;
      var activeWorkspaceId = String(getActiveWorkspaceId() || '');
      if (activeWorkspaceId && hasWorkspaceSnapshotRestoreIntent(activeWorkspaceId)) return true;
      return Boolean(getManagedTaskRestoreWorkspaceId());
    }

    function getRestoreWorkspaceId() {
      var activeWorkspaceId = String(getActiveWorkspaceId() || '');
      if (activeWorkspaceId && hasWorkspaceSnapshotRestoreIntent(activeWorkspaceId)) {
        return activeWorkspaceId;
      }
      return getManagedTaskRestoreWorkspaceId();
    }

    function hasManagedTaskRestoreContextForWorkspace(workspaceId) {
      var targetId = String(workspaceId || getActiveWorkspaceId() || '');
      if (!targetId) return false;
      return filterTasksByWorkspace(listManagedTasks(), targetId).some(function(task) {
        return Boolean(task && task.restoreContext && typeof task.restoreContext === 'object');
      });
    }

    function shouldRestoreAfterRefresh() {
      if (isManualCloseSuppressed()) return false;
      if (!hasRestoreIntent()) return false;
      return String(state.activeTab || '') === 'casesgen';
    }

    function scheduleRetry(delayMs) {
      if (retryTimer) {
        clearTimer(retryTimer);
        retryTimer = 0;
      }
      retryTimer = setTimer(function() {
        retryTimer = 0;
        try {
          if (!shouldRestoreAfterRefresh()) {
            clearRetry('restore-should-skip');
            return;
          }
          retryCount += 1;
          if (!isDrawerOpen()) {
            stableCount = 0;
            setDebugState({ phase: 'drawer-restore-attempt', attempt: retryCount });
            openDrawer({ restoreOpening: true });
          }
          if (isDrawerOpen()) {
            stableCount += 1;
            setDebugState({
              phase: 'drawer-restore-open',
              attempt: retryCount,
              stableCount: stableCount,
            });
          } else {
            stableCount = 0;
          }
          if (stableCount >= 2) {
            clearRetry('restore-stable-enough');
            return;
          }
          if (retryCount >= retryLimit) {
            setDebugState({ phase: 'drawer-restore-timeout', attempt: retryCount });
            clearRetry('restore-timeout');
            return;
          }
          scheduleRetry(isDrawerOpen() ? 220 : (getViewState().fullscreen === true ? 320 : 140));
        } catch (err) {
          setDebugState({
            phase: 'drawer-restore-error',
            attempt: retryCount,
            error: err && err.message ? String(err.message) : '未知错误',
          });
          clearRetry('restore-error');
        }
      }, Math.max(0, Number(delayMs) || 0));
    }

    function restoreAfterWorkflowReady() {
      clearRetry('restore-start');
      setDebugState({ phase: 'drawer-restore-start' });
      applyPendingSuspendViewStateCache();
      reconcileManagedTasks({
        resume: true,
        render: isDrawerOpen(),
        persist: false,
        reason: 'workflow-ready',
      });
      var restoreWorkspaceId = getRestoreWorkspaceId();
      var workspaceHostState = ensureWorkspaceHostState();
      if (restoreWorkspaceId) workspaceHostState.mirrorWorkspaceId = restoreWorkspaceId;
      if (restoreWorkspaceId && restoreWorkspaceId !== String(getActiveWorkspaceId() || '')) {
        workspaceHostState.activeWorkspaceId = restoreWorkspaceId;
      }
      setDebugState({
        phase: 'drawer-restore-after-reconcile',
        restoreIntent: hasRestoreIntent(),
        activeWorkspaceId: String(getActiveWorkspaceId() || ''),
      });
      ensureActiveWorkspaceHydrated();
      if (!hasRestoreIntent()) {
        setDebugState({
          phase: 'drawer-restore-no-intent',
          activeWorkspaceId: String(getActiveWorkspaceId() || ''),
        });
        return;
      }
      if (!isDrawerOpen()) {
        setDebugState({
          phase: 'drawer-restore-scheduled-open',
          activeWorkspaceId: String(getActiveWorkspaceId() || ''),
        });
        scheduleRetry(120);
        return;
      }
      setDebugState({
        phase: 'drawer-restore-opened',
        activeWorkspaceId: String(getActiveWorkspaceId() || ''),
      });
    }

    return {
      clearRetry: clearRetry,
      getRestoreWorkspaceId: getRestoreWorkspaceId,
      hasManagedTaskRestoreContextForWorkspace: hasManagedTaskRestoreContextForWorkspace,
      hasRestoreIntent: hasRestoreIntent,
      hasRetryTimer: function() { return Boolean(retryTimer); },
      isManualCloseSuppressed: isManualCloseSuppressed,
      markManualCloseSuppressed: markManualCloseSuppressed,
      restoreAfterWorkflowReady: restoreAfterWorkflowReady,
      scheduleRetry: scheduleRetry,
      shouldRestoreAfterRefresh: shouldRestoreAfterRefresh,
    };
  }

  return { create: create };
});
