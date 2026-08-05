(function(root, factory) {
  var snapshotModelFactory = root && root.app ? root.app.workflowSnapshotModel : null;
  var restoreControllerFactory = root && root.app ? root.app.workflowSnapshotRestoreController : null;
  if (typeof module !== 'undefined' && module.exports) {
    snapshotModelFactory = snapshotModelFactory || require('./workflowSnapshotModel.js');
    restoreControllerFactory = restoreControllerFactory || require('./workflowSnapshotRestoreController.js');
  }
  var api = factory(root, snapshotModelFactory, restoreControllerFactory);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.workflowPersistenceOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function(root, workflowSnapshotModelFactory, workflowSnapshotRestoreControllerFactory) {
  'use strict';

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state || {};
    var dom = opts.dom || {};
    var browser = opts.window || root || {};
    var documentRef = opts.document || browser.document || null;
    var localStore = opts.localStorage || browser.localStorage || null;
    var storage = opts.storage || null;
    var cloneJson = typeof opts.cloneJson === 'function'
      ? opts.cloneJson
      : function(value, fallback) {
          try {
            return JSON.parse(JSON.stringify(value));
          } catch (err) {
            return fallback;
          }
        };
    var debounce = typeof opts.debounce === 'function' ? opts.debounce : null;
    var showCenterToast = typeof opts.showCenterToast === 'function' ? opts.showCenterToast : null;
    var getTaskManager = typeof opts.getTaskManager === 'function' ? opts.getTaskManager : function() { return null; };
    var workflowStorageKey = opts.workflowStorageKey || 'usecase-workflow-state-v1';
    var workflowSnapshotMaxChars = Number(opts.workflowSnapshotMaxChars) || 1500000;
    var xmindTaskStorageKey = opts.xmindTaskStorageKey || 'tap-xmind-casegen-tasks';
    var xmindTaskStoragePreclearChars = Number(opts.xmindTaskStoragePreclearChars) || 450000;
    var autoCompareSuggestionInput = opts.autoCompareSuggestionInput
      || (documentRef && documentRef.getElementById ? documentRef.getElementById('autoCompareSuggestion') : null);
    var persistBound = false;
    var restoring = false;

    if (!workflowSnapshotModelFactory || typeof workflowSnapshotModelFactory.create !== 'function') {
      throw new Error('workflowSnapshotModel 未初始化');
    }
    if (!workflowSnapshotRestoreControllerFactory || typeof workflowSnapshotRestoreControllerFactory.create !== 'function') {
      throw new Error('workflowSnapshotRestoreController 未初始化');
    }
    var snapshotModel = workflowSnapshotModelFactory.create({
      state: state,
      dom: dom,
      cloneJson: cloneJson,
      autoCompareSuggestionInput: autoCompareSuggestionInput,
    });
    var restoreController = workflowSnapshotRestoreControllerFactory.create({
      state: state,
      dom: dom,
      cloneJson: cloneJson,
      snapshotModel: snapshotModel,
      autoCompareSuggestionInput: autoCompareSuggestionInput,
    });

    function readLocalStorage(key) {
      if (!localStore || typeof localStore.getItem !== 'function') return '';
      try {
        return localStore.getItem(key) || '';
      } catch (err) {
        return '';
      }
    }

    function removeLocalStorage(key) {
      if (!localStore || typeof localStore.removeItem !== 'function') return false;
      try {
        localStore.removeItem(key);
        return true;
      } catch (err) {
        return false;
      }
    }

    function clearPersistedXmindTasks(reason) {
      var manager = getTaskManager();
      if (manager && typeof manager.clearAllTasks === 'function') {
        manager.clearAllTasks(reason || 'workflow-reset');
        return true;
      }
      return removeLocalStorage(xmindTaskStorageKey);
    }

    function markXmindTaskStorageRecovery(reason) {
      if (!browser) return;
      browser.app = browser.app || {};
      browser.app.__xmindCasegenTaskStorageRecovered = {
        reason: String(reason || ''),
        at: Date.now(),
      };
    }

    function persistNow() {
      if (restoring || !workflowStorageKey) return;
      if (!storage || typeof storage.setJson !== 'function') return;
      var snapshot = snapshotModel.buildSnapshot();
      if (!snapshotModel.snapshotHasContent(snapshot)) {
        state.workflowNavSnapshot = {};
        if (typeof storage.remove === 'function') storage.remove(workflowStorageKey);
        return;
      }
      state.workflowNavSnapshot = snapshotModel.buildWorkflowNavSnapshot(snapshot.data);
      storage.setJson(workflowStorageKey, snapshot);
    }

    var persist = debounce ? debounce(persistNow, 300) : persistNow;

    function restore() {
      if (!storage || typeof storage.getJson !== 'function' || !workflowStorageKey) return false;
      var rawSnapshot = readLocalStorage(workflowStorageKey);
      if (rawSnapshot && rawSnapshot.length > workflowSnapshotMaxChars) {
        if (typeof storage.remove === 'function') storage.remove(workflowStorageKey);
        clearPersistedXmindTasks('workflow-oversize-reset');
        state.workflowRecoveryNotice = { reason: 'oversize', shown: false };
        return false;
      }
      var snapshot = storage.getJson(workflowStorageKey, null);
      if (!snapshot || typeof snapshot !== 'object') {
        if (rawSnapshot) {
          if (typeof storage.remove === 'function') storage.remove(workflowStorageKey);
          clearPersistedXmindTasks('workflow-invalid-reset');
          state.workflowRecoveryNotice = { reason: 'invalid', shown: false };
        }
        return false;
      }
      if (snapshot.user_id && state.currentUser && (state.currentUser.id || state.currentUser.id === 0)) {
        if (String(snapshot.user_id) !== String(state.currentUser.id)) return false;
      }
      return restoreController.applySnapshot(snapshot);
    }

    function preclearOversizeWorkflowSnapshotBeforeModuleInit() {
      if (!workflowStorageKey) return false;
      var rawSnapshot = readLocalStorage(workflowStorageKey);
      if (!rawSnapshot || rawSnapshot.length <= workflowSnapshotMaxChars) return false;
      removeLocalStorage(workflowStorageKey);
      clearPersistedXmindTasks('workflow-oversize-preinit-reset');
      state.workflowRecoveryNotice = { reason: 'oversize', shown: false };
      return true;
    }

    function preclearOversizeXmindTaskStorageBeforeModuleInit() {
      var rawTasks = readLocalStorage(xmindTaskStorageKey);
      if (!rawTasks || rawTasks.length <= xmindTaskStoragePreclearChars) return false;
      if (!removeLocalStorage(xmindTaskStorageKey)) return false;
      markXmindTaskStorageRecovery('preinit-oversize');
      return true;
    }

    function flushRecoveryNotice() {
      var notice = state.workflowRecoveryNotice && typeof state.workflowRecoveryNotice === 'object'
        ? state.workflowRecoveryNotice
        : null;
      if (!notice || notice.shown === true) return false;
      notice.shown = true;
      if (!showCenterToast) return true;
      var text = notice.reason === 'oversize'
        ? '检测到本地流程缓存过大，已自动清理异常缓存并恢复页面。'
        : '检测到本地流程缓存异常，已自动清理异常缓存并恢复页面。';
      showCenterToast(text, 'warn', 5000);
      return true;
    }

    function bindListeners() {
      if (persistBound) return;
      [
        dom.rawText,
        dom.reviewResultEl,
        dom.cleanedTextEl,
        dom.compareResultEl,
        dom.splitResultEl,
        dom.casesCompareResultEl,
        dom.caseTextEl,
      ].forEach(function(element) {
        if (!element || !element.addEventListener) return;
        element.addEventListener('input', function() { persist(); });
      });
      if (autoCompareSuggestionInput && autoCompareSuggestionInput.addEventListener) {
        autoCompareSuggestionInput.addEventListener('input', function() { persist(); });
      }
      if (dom.autoClarifyToggle && dom.autoClarifyToggle.addEventListener) {
        dom.autoClarifyToggle.addEventListener('change', function() { persist(); });
      }
      persistBound = true;
    }

    function setRestoring(value) {
      restoring = value === true;
    }

    return {
      buildSnapshot: snapshotModel.buildSnapshot,
      snapshotHasContent: snapshotModel.snapshotHasContent,
      applySnapshot: restoreController.applySnapshot,
      restore: restore,
      persist: persist,
      persistNow: persistNow,
      bindListeners: bindListeners,
      setRestoring: setRestoring,
      preclearOversizeWorkflowSnapshotBeforeModuleInit: preclearOversizeWorkflowSnapshotBeforeModuleInit,
      preclearOversizeXmindTaskStorageBeforeModuleInit: preclearOversizeXmindTaskStorageBeforeModuleInit,
      flushRecoveryNotice: flushRecoveryNotice,
    };
  }

  return { create: create };
});
