(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenEventBindingController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var elements = opts.elements && typeof opts.elements === 'object' ? opts.elements : {};
    var documentObj = opts.documentObj || null;
    var MutationObserverCtor = opts.MutationObserver || null;
    var setTimer = typeof opts.setTimeout === 'function' ? opts.setTimeout : setTimeout;
    var debounce = typeof opts.debounce === 'function' ? opts.debounce : function(fn) { return fn; };
    var bound = false;
    var listObserver = null;

    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var bindCoverageDialog = port('bindCoverageDialog');
    var bindPrepDialog = port('bindPrepDialog');
    var openDrawer = port('openDrawer');
    var createWorkspaceAndOpenPrep = port('createWorkspaceAndOpenPrep');
    var deleteWorkspace = port('deleteWorkspace');
    var getActiveWorkspaceId = port('getActiveWorkspaceId', function() { return ''; });
    var switchWorkspace = port('switchWorkspace');
    var closeSummaryDialog = port('closeSummaryDialog');
    var openPrepDialog = port('openPrepDialog');
    var openHistoryDialog = port('openHistoryDialog');
    var openKnowledgeBaseDialog = port('openKnowledgeBaseDialog');
    var startManualAiDedupe = port('startManualAiDedupe');
    var handleStoreToLibrary = port('handleStoreToLibrary');
    var interruptRunningXmindTasks = port('interruptRunningXmindTasks');
    var undoLatestDeleteSelection = port('undoLatestDeleteSelection', function() { return false; });
    var redoLatestDeleteSelection = port('redoLatestDeleteSelection', function() { return false; });
    var exportCurrentXmind = port('exportCurrentXmind');
    var exportCurrentMarkdown = port('exportCurrentMarkdown');
    var isDrawerOpen = port('isDrawerOpen', function() { return false; });
    var getSummaryDialogState = port('getSummaryDialogState', function() {
      return { open: false, mode: 'prep' };
    });
    var syncDeleteHistoryButtons = port('syncDeleteHistoryButtons');
    var syncKnowledgeBaseToolbarState = port('syncKnowledgeBaseToolbarState');
    var updateSummary = port('updateSummary');
    var renderOpenedSummaryDialog = port('renderOpenedSummaryDialog');
    var scheduleRender = port('scheduleRender');

    function listen(target, eventName, handler, capture) {
      if (!target || typeof target.addEventListener !== 'function') return;
      target.addEventListener(eventName, handler, capture === true);
    }

    function isTypingLikeTarget(target) {
      if (!target) return false;
      if (target.isContentEditable) return true;
      var tag = target.tagName ? String(target.tagName).toLowerCase() : '';
      return tag === 'input' || tag === 'textarea' || tag === 'select';
    }

    function toggleSummaryDialog(mode, openDialog) {
      var dialogState = getSummaryDialogState() || {};
      if (dialogState.open === true && dialogState.mode === mode) {
        closeSummaryDialog();
        return;
      }
      openDialog();
    }

    function handleWorkspaceListClick(event) {
      var target = event && event.target ? event.target : null;
      var closeTarget = target && typeof target.closest === 'function'
        ? target.closest('[data-xmind-workspace-close]')
        : null;
      if (closeTarget) {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        var closeId = String(closeTarget.getAttribute('data-xmind-workspace-close') || '');
        if (closeId) deleteWorkspace(closeId);
        return;
      }
      var tabTarget = target && typeof target.closest === 'function'
        ? target.closest('[data-xmind-workspace-tab]')
        : null;
      if (!tabTarget) return;
      var tabId = String(tabTarget.getAttribute('data-xmind-workspace-tab') || '');
      if (!tabId || tabId === getActiveWorkspaceId()) return;
      switchWorkspace(tabId, {
        reason: 'workspace-manual-switch',
        centerRootAfterRender: false,
      });
    }

    function handleDocumentKeydown(event) {
      if (!event) return;
      var dialogState = getSummaryDialogState() || {};
      if (event.key === 'Escape') {
        if (!isDrawerOpen() || dialogState.open !== true) return;
        closeSummaryDialog();
        return;
      }
      if (!isDrawerOpen() || dialogState.open === true || isTypingLikeTarget(event.target)) return;
      var lower = String(event.key || '').toLowerCase();
      var modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;
      if (!event.shiftKey && lower === 'z') {
        if (undoLatestDeleteSelection()) {
          if (event.preventDefault) event.preventDefault();
          if (event.stopPropagation) event.stopPropagation();
        }
        return;
      }
      if ((event.shiftKey && lower === 'z') || (!event.shiftKey && lower === 'y')) {
        if (redoLatestDeleteSelection()) {
          if (event.preventDefault) event.preventDefault();
          if (event.stopPropagation) event.stopPropagation();
        }
      }
    }

    function bindButtons() {
      bindCoverageDialog();
      bindPrepDialog();
      listen(elements.openBtn, 'click', openDrawer);
      listen(elements.workspaceAddBtn, 'click', function() {
        if (elements.workspaceAddBtn.disabled) return;
        createWorkspaceAndOpenPrep();
      });
      listen(elements.workspaceListEl, 'click', handleWorkspaceListClick);
      listen(elements.summaryBtn, 'click', function() {
        toggleSummaryDialog('prep', openPrepDialog);
      });
      listen(elements.historyBtn, 'click', function() {
        toggleSummaryDialog('history', openHistoryDialog);
      });
      listen(elements.knowledgeRuleBtn, 'click', function() {
        toggleSummaryDialog('knowledge-base', openKnowledgeBaseDialog);
      });
      listen(elements.knowledgeAiBtn, 'click', function() {
        toggleSummaryDialog('knowledge-base', openKnowledgeBaseDialog);
      });
      listen(elements.dedupeBtn, 'click', startManualAiDedupe);
      listen(elements.storeBtn, 'click', handleStoreToLibrary);
      listen(elements.interruptBtn, 'click', interruptRunningXmindTasks);
      listen(elements.deleteUndoBtn, 'click', undoLatestDeleteSelection);
      listen(elements.deleteRedoBtn, 'click', redoLatestDeleteSelection);
      listen(elements.summaryCloseBtn, 'click', closeSummaryDialog);
      listen(elements.exportBtn, 'click', exportCurrentXmind);
      listen(elements.exportMarkdownBtn, 'click', exportCurrentMarkdown);
      listen(documentObj, 'keydown', handleDocumentKeydown, true);
      syncDeleteHistoryButtons();
      syncKnowledgeBaseToolbarState();
    }

    function bindRenderListeners() {
      if (!documentObj || typeof documentObj.getElementById !== 'function') return;
      var debouncedRender = debounce(function() {
        scheduleRender('dom-input');
      }, 120);
      ['rawText', 'caseText'].forEach(function(id) {
        var input = documentObj.getElementById(id);
        if (!input) return;
        ['input', 'change'].forEach(function(eventName) {
          listen(input, eventName, function() {
            updateSummary();
            debouncedRender();
          });
        });
      });
      ['fileInput', 'caseFileInput'].forEach(function(id) {
        var input = documentObj.getElementById(id);
        listen(input, 'change', function() {
          setTimer(function() {
            updateSummary();
            renderOpenedSummaryDialog();
            scheduleRender('file-change');
          }, 220);
        });
      });
      var caseFileList = documentObj.getElementById('caseFileList');
      if (caseFileList && MutationObserverCtor) {
        listObserver = new MutationObserverCtor(function() {
          updateSummary();
          renderOpenedSummaryDialog();
          scheduleRender('case-list-mutation');
        });
        listObserver.observe(caseFileList, { childList: true, subtree: true });
      }
    }

    function bind() {
      if (bound) return false;
      bound = true;
      bindButtons();
      bindRenderListeners();
      return true;
    }

    return {
      bind: bind,
      isTypingLikeTarget: isTypingLikeTarget,
    };
  }

  return { create: create };
});
