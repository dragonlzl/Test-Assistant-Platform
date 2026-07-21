(function() {
  var apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
  if (!apiClient) return;

  var utils = window.app && window.app.utils ? window.app.utils : {};
  var diffModel = window.app.caseLibrary.diffModel;
  var xmindModelOwner = window.app.caseLibrary.xmindModel;
  var xmindWorkspaceControllerOwner = window.app.caseLibrary.xmindWorkspaceController;
  var aiGenModelOwner = window.app.caseLibrary.aiGenModel;
  var aiGenStoreOwner = window.app.caseLibrary.aiGenStore;
  var aiGenFileParserOwner = window.app.caseLibrary.aiGenFileParser;
  var aiGenTaskRunnerOwner = window.app.caseLibrary.aiGenTaskRunner;
  var aiGenViewOwner = window.app.caseLibrary.aiGenViewAdapter;
  var aiGenControllerOwner = window.app.caseLibrary.aiGenController;
  var viewStateStoreOwner = window.app.caseLibrary.viewStateStore;
  var missingReminderModelOwner = window.app.caseLibrary.missingReminderModel;
  var missingReminderViewOwner = window.app.caseLibrary.missingReminderViewAdapter;
  var missingReminderControllerOwner = window.app.caseLibrary.missingReminderController;
  var importFileParserOwner = window.app.caseLibrary.importFileParser;
  var missingImportModelOwner = window.app.caseLibrary.missingImportModel;
  var missingImportFileParserOwner = window.app.caseLibrary.missingImportFileParser;
  var missingImportViewOwner = window.app.caseLibrary.missingImportViewAdapter;
  var missingImportControllerOwner = window.app.caseLibrary.missingImportController;
  var missingDrawerModelOwner = window.app.caseLibrary.missingDrawerModel;
  var missingDrawerViewOwner = window.app.caseLibrary.missingDrawerViewAdapter;
  var missingDrawerControllerOwner = window.app.caseLibrary.missingDrawerController;
  var missingCatalogMaintenanceViewOwner = window.app.caseLibrary.missingCatalogMaintenanceViewAdapter;
  var missingCatalogMaintenanceControllerOwner = window.app.caseLibrary.missingCatalogMaintenanceController;
  var importReviewViewOwner = window.app.caseLibrary.importReviewViewAdapter;
  var importReviewControllerOwner = window.app.caseLibrary.importReviewController;
  var importWorkflowControllerOwner = window.app.caseLibrary.importWorkflowController;
  var importSelectModelOwner = window.app.caseLibrary.importSelectModel;
  var importSelectViewOwner = window.app.caseLibrary.importSelectViewAdapter;
  var importSelectControllerOwner = window.app.caseLibrary.importSelectController;
  var exportServiceOwner = window.app.caseLibrary.exportService;
  var exportControllerOwner = window.app.caseLibrary.exportController;
  var writerPublishViewOwner = window.app.caseLibrary.writerPublishViewAdapter;
  var writerPublishControllerOwner = window.app.caseLibrary.writerPublishController;
  var shareViewOwner = window.app.caseLibrary.shareViewAdapter;
  var shareControllerOwner = window.app.caseLibrary.shareController;
  var diffControllerOwner = window.app.caseLibrary.diffController;
  var historyQueryControllerOwner = window.app.caseLibrary.historyQueryController;
  var historyDetailControllerOwner = window.app.caseLibrary.historyDetailController;
  var historyDrawerControllerOwner = window.app.caseLibrary.historyDrawerController;
  var editListModelOwner = window.app.caseLibrary.editListModel;
  var editListControllerOwner = window.app.caseLibrary.editListController;
  var editorControllerOwner = window.app.caseLibrary.editorController;
  var missingViewModelOwner = window.app.caseLibrary.missingViewModel;
  var missingViewViewOwner = window.app.caseLibrary.missingViewAdapter;
  var missingViewControllerOwner = window.app.caseLibrary.missingViewController;
  var editorPendingControllerOwner = window.app.caseLibrary.editorPendingController;
  var missingViewPendingControllerOwner = window.app.caseLibrary.missingViewPendingController;
  var selectExecModelOwner = window.app.caseLibrary.selectExecModel;
  var selectExecWorkflowOwner = window.app.caseLibrary.selectExecWorkflow;
  var selectExecControllerOwner = window.app.caseLibrary.selectExecController;
  var selectExecViewOwner = window.app.caseLibrary.selectExecViewAdapter;
  var selectExecDrawerControllerOwner = window.app.caseLibrary.selectExecDrawerController;
  var execTransferServiceOwner = window.app.caseLibrary.execTransferService;
  var associationModelOwner = window.app.caseLibrary.associationModel;
  var associationListControllerOwner = window.app.caseLibrary.associationListController;
  var associationCandidateControllerOwner = window.app.caseLibrary.associationCandidateController;
  var associationItemControllerOwner = window.app.caseLibrary.associationItemController;
  var associationWorkflowViewOwner = window.app.caseLibrary.associationWorkflowViewAdapter;
  var associationWorkflowControllerOwner = window.app.caseLibrary.associationWorkflowController;
  var normalizeDiffText = diffModel.normalizeDiffText;
  var buildCaseItemKey = diffModel.buildCaseItemKey;
  var dedupeCaseItemsByKey = diffModel.dedupeCaseItemsByKey;
  var buildImportDiffRows = diffModel.buildImportDiffRows;
  var countUniqueCaseItemsByKey = diffModel.countUniqueCaseItemsByKey;

  function safeLogOperation(action, targetType, targetId, detail, result) {
    if (!apiClient || typeof apiClient.createOperationLogEvent !== 'function') return;
    try {
      apiClient.createOperationLogEvent({
        action: action,
        target_type: targetType,
        target_id: targetId,
        result: result || undefined,
        detail: detail || null,
      }).catch(function() {
        // ignore
      });
    } catch (err) {
      // ignore
    }
  }

  function getCore() {
    return window.app && window.app.core ? window.app.core : {};
  }

  function activateTempExecView() {
    var coreApi = getCore();
    var switchTab = window.app && typeof window.app.switchTab === 'function'
      ? window.app.switchTab
      : (coreApi && typeof coreApi.switchTab === 'function' ? coreApi.switchTab : null);
    if (typeof switchTab === 'function') switchTab('tempexec');
    var section = document.querySelector('[data-section-id="tempexec-view"]');
    if (section && coreApi && typeof coreApi.scrollElementIntoView === 'function') {
      coreApi.scrollElementIntoView(section, 'smooth', 140);
    }
  }

  function appendCaseWritingGuidePrompt(promptText) {
    var prompt = promptText === undefined || promptText === null ? '' : String(promptText).trim();
    var config = window.app && window.app.config ? window.app.config : {};
    var guide = config && config.caseWritingStyleGuidePrompt
      ? String(config.caseWritingStyleGuidePrompt || '').trim()
      : '';
    if (!guide) return prompt;
    if (prompt.indexOf('AI_CASE_WRITING_STYLE_GUIDE.md') !== -1) return prompt;
    return [prompt, guide].filter(Boolean).join('\n\n');
  }

  function getGlobalAssignments() {
    var globalState = window.app && window.app.state ? window.app.state : {};
    return globalState && globalState.assignments && typeof globalState.assignments === 'object'
      ? globalState.assignments
      : {};
  }

  function openConfirmDrawer(options) {
    if (utils && typeof utils.openConfirmDrawer === 'function') {
      return utils.openConfirmDrawer(options || {});
    }
    var drawerApi = window.app && window.app.confirmDrawer ? window.app.confirmDrawer : null;
    if (drawerApi && typeof drawerApi.open === 'function') {
      return drawerApi.open(options || {});
    }
    var msg = options && options.message ? String(options.message) : '';
    var ok = true;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      ok = window.confirm(msg);
    }
    return Promise.resolve({ ok: ok });
  }

  function isCaseLibraryActive() {
    var globalState = window.app && window.app.state ? window.app.state : {};
    var tabName = globalState && globalState.activeTab ? globalState.activeTab : '';
    if (tabName === 'case-library') return true;
    var visible = document.querySelector('section[data-tab-section="case-library"]:not(.hidden)');
    return Boolean(visible);
  }

  var selectExecRequestSessionKey = 'tap-case-library-select-exec-request';
  var missingDrawerRequestSessionKey = 'tap-case-library-missing-drawer-request';
  var tempExecAssignRequestSessionKey = 'tap-temp-exec-assign-request';
  var missingDrawerOpenTimer = 0;
  var missingDrawerSkipTimer = 0;

  function markSelectExecDrawerRequest() {
    try {
      if (window.app) window.app.__caseLibrarySelectExecRequest = true;
    } catch (err) {
      // ignore
    }
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(selectExecRequestSessionKey, '1');
      } catch (err) {
        // ignore
      }
    }
  }

  function markMissingDrawerRequest() {
    try {
      if (window.app) window.app.__caseLibraryMissingDrawerRequest = true;
    } catch (err) {
      // ignore
    }
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(missingDrawerRequestSessionKey, '1');
      } catch (err) {
        // ignore
      }
    }
  }

  function markTempExecAssignRequest(payload) {
    if (!payload || typeof payload !== 'object') return;
    try {
      if (window.app) window.app.__tempExecAssignRequest = payload;
    } catch (err) {
      // ignore
    }
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(tempExecAssignRequestSessionKey, JSON.stringify(payload));
      } catch (err) {
        // ignore
      }
    }
  }

  function requestTempExecAssignDrawer(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var caseName = opts.caseName || opts.name || '';
    var versionName = opts.versionName || opts.version || '';
    var name = caseName ? String(caseName) : '';
    var version = versionName ? String(versionName) : '';
    if (!name) name = '用例';
    if (!version) version = '未分配版本';
    var payload = { name: name, versionName: version, at: Date.now() };
    markTempExecAssignRequest(payload);
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('temp-exec-assign-request', { detail: payload }));
      }
    } catch (err) {
      // ignore
    }
    return payload;
  }

  function consumeSelectExecDrawerRequest() {
    var consumed = false;
    try {
      if (window.app && window.app.__caseLibrarySelectExecRequest) {
        window.app.__caseLibrarySelectExecRequest = false;
        consumed = true;
      }
    } catch (err) {
      // ignore
    }
    if (typeof sessionStorage !== 'undefined') {
      try {
        var stored = sessionStorage.getItem(selectExecRequestSessionKey) || '';
        if (!consumed && stored === '1') consumed = true;
        if (consumed) sessionStorage.removeItem(selectExecRequestSessionKey);
      } catch (err) {
        // ignore
      }
    }
    return consumed;
  }

  function consumeMissingDrawerRequest() {
    var consumed = false;
    try {
      if (window.app && window.app.__caseLibraryMissingDrawerRequest) {
        window.app.__caseLibraryMissingDrawerRequest = false;
        consumed = true;
      }
    } catch (err) {
      // ignore
    }
    if (typeof sessionStorage !== 'undefined') {
      try {
        var stored = sessionStorage.getItem(missingDrawerRequestSessionKey) || '';
        if (!consumed && stored === '1') consumed = true;
        if (consumed) sessionStorage.removeItem(missingDrawerRequestSessionKey);
      } catch (err) {
        // ignore
      }
    }
    return consumed;
  }

  function peekMissingDrawerRequest() {
    var found = false;
    try {
      if (window.app && window.app.__caseLibraryMissingDrawerRequest) {
        found = true;
      }
    } catch (err) {
      // ignore
    }
    if (!found && typeof sessionStorage !== 'undefined') {
      try {
        var stored = sessionStorage.getItem(missingDrawerRequestSessionKey) || '';
        if (stored === '1') found = true;
      } catch (err) {
        // ignore
      }
    }
    return found;
  }

  function openSelectExecDrawerDirect() {
    return selectExecDrawerControllerInstance ? selectExecDrawerControllerInstance.open() : false;
  }

  function hasOtherOpenDrawers(drawerEl) {
    if (!drawerEl || typeof document === 'undefined' || !document.querySelectorAll) return false;
    var openDrawers = document.querySelectorAll('.drawer.open, .drawer.closing');
    if (!openDrawers || !openDrawers.length) return false;
    for (var i = 0; i < openDrawers.length; i += 1) {
      var node = openDrawers[i];
      if (node && node !== drawerEl) return true;
    }
    return false;
  }

  function markDrawerSkipClose(drawerId, ttlMs) {
    if (!drawerId) return;
    try {
      if (window.app) {
        window.app.__drawerSkipCloseId = String(drawerId);
        window.app.__drawerCloseGuard = { id: String(drawerId), until: Date.now() + Number(ttlMs || 0) };
      }
    } catch (err) {
      // ignore
    }
    var ttl = Number(ttlMs);
    if (!isFinite(ttl) || ttl <= 0) return;
    if (missingDrawerSkipTimer) {
      clearTimeout(missingDrawerSkipTimer);
      missingDrawerSkipTimer = 0;
    }
    missingDrawerSkipTimer = setTimeout(function() {
      missingDrawerSkipTimer = 0;
      try {
        if (window.app) {
          if (window.app.__drawerSkipCloseId === String(drawerId)) {
            window.app.__drawerSkipCloseId = '';
          }
          if (window.app.__drawerCloseGuard && String(window.app.__drawerCloseGuard.id || '') === String(drawerId)) {
            window.app.__drawerCloseGuard = null;
          }
        }
      } catch (err2) {
        // ignore
      }
    }, ttl);
  }

  function openMissingDrawerDirect(options) {
    var opts = options || {};
    var skipClose = Boolean(opts.skipClose);
    var waitClose = opts.waitClose === undefined ? !skipClose : Boolean(opts.waitClose);
    var delayMs = Number(opts.delayMs);
    if (!isFinite(delayMs) || delayMs < 0) delayMs = 360;
    var maxWaitMs = Number(opts.maxWaitMs);
    if (!isFinite(maxWaitMs) || maxWaitMs < 0) maxWaitMs = 900;
    var pollInterval = Number(opts.pollIntervalMs);
    if (!isFinite(pollInterval) || pollInterval <= 0) pollInterval = 60;
    var drawerEl = missingDrawerInstance && missingDrawerInstance.element
      ? missingDrawerInstance.element
      : document.getElementById('caseLibraryMissingDrawer');
    if (drawerEl && drawerEl.classList && drawerEl.classList.contains('open')) {
      return true;
    }
    if (missingDrawerOpenTimer) {
      clearTimeout(missingDrawerOpenTimer);
      missingDrawerOpenTimer = 0;
    }
    var shouldDelay = false;
    if (!skipClose && window.app && window.app.drawer && typeof window.app.drawer.closeAllDrawers === 'function') {
      shouldDelay = hasOtherOpenDrawers(drawerEl);
      window.app.drawer.closeAllDrawers();
    }
    if (shouldDelay && waitClose) {
      // 避免与其他抽屉关闭动画叠加导致开合抖动，等待关闭完成再打开
      var startAt = Date.now();
      var attemptOpen = function() {
        if (missingDrawerOpenTimer) {
          clearTimeout(missingDrawerOpenTimer);
          missingDrawerOpenTimer = 0;
        }
        var hasOther = hasOtherOpenDrawers(drawerEl);
        if (hasOther && Date.now() - startAt < maxWaitMs) {
          missingDrawerOpenTimer = setTimeout(attemptOpen, pollInterval);
          return;
        }
        missingDrawerOpenTimer = 0;
        openMissingDrawerDirect({ skipClose: true, waitClose: false });
      };
      missingDrawerOpenTimer = setTimeout(attemptOpen, delayMs);
      return true;
    }
    markDrawerSkipClose('caseLibraryMissingDrawer', 800);
    if (missingDrawerInstance && typeof missingDrawerInstance.open === 'function') {
      missingDrawerInstance.open();
      return true;
    }
    var fallbackBtn = document.getElementById('openCaseLibraryMissingDrawerBtn');
    if (fallbackBtn && typeof fallbackBtn.click === 'function') {
      fallbackBtn.click();
      return true;
    }
    return false;
  }

  function openSelectExecDrawer(options) {
    var opts = options || {};
    var allowInactive = Boolean(opts.allowInactive || opts.force || opts.skipTabCheck);
    if (!allowInactive && !isCaseLibraryActive()) {
      markSelectExecDrawerRequest();
      return false;
    }
    consumeSelectExecDrawerRequest();
    return openSelectExecDrawerDirect();
  }

  function scheduleMissingDrawerOpen(options) {
    var opts = options || {};
    var attempts = Number(opts.attempts);
    if (!isFinite(attempts) || attempts <= 0) attempts = 3;
    var interval = Number(opts.intervalMs);
    if (!isFinite(interval) || interval <= 0) interval = 160;
    var delay = Number(opts.delayMs);
    if (!isFinite(delay) || delay < 0) delay = 0;
    function isOpen() {
      if (missingDrawerOpenTimer) return true;
      var el = missingDrawerInstance && missingDrawerInstance.element
        ? missingDrawerInstance.element
        : document.getElementById('caseLibraryMissingDrawer');
      return Boolean(el && el.classList && el.classList.contains('open'));
    }
    function tryOpen() {
      if (isOpen()) return;
      openMissingDrawerDirect({ waitClose: true });
      setTimeout(function() {
        if (isOpen()) return;
        attempts -= 1;
        if (attempts <= 0) return;
        setTimeout(tryOpen, interval);
      }, interval);
    }
    setTimeout(tryOpen, delay);
  }

  function openMissingDrawer(options) {
    var opts = options || {};
    var allowInactive = Boolean(opts.allowInactive || opts.force || opts.skipTabCheck);
    if (!allowInactive && !isCaseLibraryActive()) {
      markMissingDrawerRequest();
      return false;
    }
    consumeMissingDrawerRequest();
    return openMissingDrawerDirect();
  }

  var dom = {
    root: document.getElementById('caseLibrary'),
    status: document.getElementById('caseLibraryStatus'),
    jumpToExecBtn: document.getElementById('caseLibraryJumpExecBtn'),
    autoCaseLibrarySelectBtn: document.getElementById('autoCaseLibrarySelectBtn'),
    caseLibraryImportSelectBtn: document.getElementById('caseLibraryImportSelectBtn'),
    writerDrawerOpenBtn: document.getElementById('openCaseLibraryWriterDrawerBtn'),
    editDrawerOpenBtn: document.getElementById('openCaseLibraryEditDrawerBtn'),

    editCard: document.getElementById('caseLibraryEditCard'),
    editCardTitle: document.getElementById('caseLibraryEditCardTitle'),
    editProject: document.getElementById('caseLibraryEditProject'),
    editVersion: document.getElementById('caseLibraryEditVersion'),
    editFileName: document.getElementById('caseLibraryEditFileName'),
	    editSearchInput: document.getElementById('caseLibraryEditSearchInput'),
	    editClearSearchBtn: document.getElementById('caseLibraryEditClearSearchBtn'),
	    editBatchDeleteBtn: document.getElementById('caseLibraryEditBatchDeleteBtn'),
	    editBatchAddCountInput: document.getElementById('caseLibraryEditBatchAddCountInput'),
	    editBatchAddBtn: document.getElementById('caseLibraryEditBatchAddBtn'),
	    editToExecBtn: document.getElementById('caseLibraryEditToExecBtn'),
    editStatus: document.getElementById('caseLibraryEditStatus'),
    editView: document.getElementById('caseLibraryEditView'),
    editorPaginationTop: document.getElementById('caseLibraryEditorPaginationTop'),
    editorPaginationBottom: document.getElementById('caseLibraryEditorPaginationBottom'),
    editorSelectAll: document.getElementById('caseLibraryEditorSelectAll'),
    editorTableHost: document.getElementById('caseLibraryEditorTableHost'),
    aiGenBtn: document.getElementById('caseLibraryAiGenBtn'),
    xmindViewBtn: document.getElementById('caseLibraryXmindViewBtn'),
    aiGenDrawer: document.getElementById('caseLibraryAiGenDrawer'),
    aiGenDropZone: document.getElementById('caseLibraryAiGenDropZone'),
    aiGenFileInput: document.getElementById('caseLibraryAiGenFileInput'),
    aiGenFileName: document.getElementById('caseLibraryAiGenFileName'),
    aiGenImportStatus: document.getElementById('caseLibraryAiGenImportStatus'),
    aiGenRequirementInput: document.getElementById('caseLibraryAiGenRequirementInput'),
    aiGenClearRequirementBtn: document.getElementById('caseLibraryAiGenClearRequirement'),
    aiGenRunBtn: document.getElementById('caseLibraryAiGenRunBtn'),
    aiGenStatus: document.getElementById('caseLibraryAiGenStatus'),
    aiGenResult: document.getElementById('caseLibraryAiGenResult'),
    aiGenResultBody: document.getElementById('caseLibraryAiGenResultBody'),
    aiGenSelectAllBtn: document.getElementById('caseLibraryAiGenSelectAllBtn'),
    aiGenSelectNoneBtn: document.getElementById('caseLibraryAiGenSelectNoneBtn'),
    aiGenDiscardBtn: document.getElementById('caseLibraryAiGenDiscardBtn'),
    aiGenRegenerateBtn: document.getElementById('caseLibraryAiGenRegenerateBtn'),
    aiGenSelectAllToggle: document.getElementById('caseLibraryAiGenSelectAllToggle'),
    aiGenResultSummary: document.getElementById('caseLibraryAiGenResultSummary'),
    aiGenSelectionHint: document.getElementById('caseLibraryAiGenSelectionHint'),
    aiGenAppendBtn: document.getElementById('caseLibraryAiGenAppendBtn'),
    missingReminderTop: document.getElementById('caseLibraryMissingReminderTop'),
    missingReminderBottom: document.getElementById('caseLibraryMissingReminderBottom'),
    missingCard: document.getElementById('caseLibraryMissingCard'),
    missingCardTitle: document.getElementById('caseLibraryMissingCardTitle'),
    missingProject: document.getElementById('caseLibraryMissingProject'),
    missingModules: document.getElementById('caseLibraryMissingModules'),
    missingBatchDeleteBtn: document.getElementById('caseLibraryMissingBatchDeleteBtn'),
    missingStatus: document.getElementById('caseLibraryMissingStatus'),
    missingView: document.getElementById('caseLibraryMissingView'),
    missingTypePills: document.getElementById('caseLibraryMissingTypePills'),

    missingImportDropZone: document.getElementById('caseLibraryMissingImportDropZone'),
    missingImportInput: document.getElementById('caseLibraryMissingImportInput'),
    missingImportFileHint: document.getElementById('caseLibraryMissingImportFileHint'),
    missingImportProjectSelect: document.getElementById('caseLibraryMissingImportProjectSelect'),
    missingImportConfirmBtn: document.getElementById('caseLibraryMissingImportConfirmBtn'),
    missingImportStatus: document.getElementById('caseLibraryMissingImportStatus'),
    missingImportDiffTitle: document.getElementById('caseLibraryMissingImportDiffTitle'),
    missingImportDiffStatus: document.getElementById('caseLibraryMissingImportDiffStatus'),
    missingImportDiffMeta: document.getElementById('caseLibraryMissingImportDiffMeta'),
    missingImportStructureWrap: document.getElementById('caseLibraryMissingImportStructureWrap'),
    missingImportStructureBody: document.getElementById('caseLibraryMissingImportStructureBody'),
    missingImportDiffBody: document.getElementById('caseLibraryMissingImportDiffBody'),
    missingImportDiffConfirmBtn: document.getElementById('caseLibraryMissingImportDiffConfirmBtn'),

    importDropZone: document.getElementById('caseLibraryImportDropZone'),
    importInput: document.getElementById('caseLibraryImportInput'),
    importFileHint: document.getElementById('caseLibraryImportFileHint'),
    importProjectSelect: document.getElementById('caseLibraryImportProjectSelect'),
    importVersionSelect: document.getElementById('caseLibraryImportVersionSelect'),
    importExcelTemplateTypeSelect: document.getElementById('caseLibraryImportExcelTemplateType'),
    importExcelTemplateBtn: document.getElementById('caseLibraryImportExcelTemplateBtn'),
    importXmindTemplateBtn: document.getElementById('caseLibraryImportXmindTemplateBtn'),
    importConfirmBtn: document.getElementById('caseLibraryImportConfirmBtn'),
    importStatus: document.getElementById('caseLibraryImportStatus'),
    writerPublishDrawer: document.getElementById('caseLibraryWriterPublishDrawer'),
    writerPublishHint: document.getElementById('caseLibraryWriterPublishHint'),
    writerPublishFileNameInput: document.getElementById('caseLibraryWriterPublishFileNameInput'),
    writerPublishFileNameStatus: document.getElementById('caseLibraryWriterPublishFileNameStatus'),
    writerPublishProjectSelect: document.getElementById('caseLibraryWriterPublishProjectSelect'),
    writerPublishVersionSelect: document.getElementById('caseLibraryWriterPublishVersionSelect'),
    writerPublishConfirmBtn: document.getElementById('caseLibraryWriterPublishConfirmBtn'),
    writerPublishStatus: document.getElementById('caseLibraryWriterPublishStatus'),

	    importDiffTitle: document.getElementById('caseLibraryImportDiffTitle'),
    importDiffStatus: document.getElementById('caseLibraryImportDiffStatus'),
    importDiffMeta: document.getElementById('caseLibraryImportDiffMeta'),
    importDiffLocateBar: document.getElementById('caseLibraryImportDiffLocateBar'),
	    importDiffTableHost: document.getElementById('caseLibraryImportDiffTableHost'),
	    importDiffOverwriteBtn: document.getElementById('caseLibraryImportDiffOverwriteBtn'),
	    importInvalidTitle: document.getElementById('caseLibraryImportInvalidTitle'),
	    importInvalidStatus: document.getElementById('caseLibraryImportInvalidStatus'),
	    importInvalidLocateBar: document.getElementById('caseLibraryImportInvalidLocateBar'),
	    importInvalidBody: document.getElementById('caseLibraryImportInvalidBody'),
	    importInvalidConfirmBtn: document.getElementById('caseLibraryImportInvalidConfirmBtn'),
      importDuplicateTitle: document.getElementById('caseLibraryImportDuplicateTitle'),
      importDuplicateStatus: document.getElementById('caseLibraryImportDuplicateStatus'),
      importDuplicateBody: document.getElementById('caseLibraryImportDuplicateBody'),
      importDuplicateConfirmBtn: document.getElementById('caseLibraryImportDuplicateConfirmBtn'),

    editDrawerProjectSelect: document.getElementById('caseLibraryEditProjectSelect'),
    editDrawerVersionSelect: document.getElementById('caseLibraryEditVersionSelect'),
    editDrawerOwnerFilterSelect: document.getElementById('caseLibraryEditOwnerFilterSelect'),
    editDrawerFileSearchInput: document.getElementById('caseLibraryEditFileSearchInput'),
    editDrawerChangeVersionSelect: document.getElementById('caseLibraryEditChangeVersionSelect'),
    editDrawerChangeVersionBtn: document.getElementById('caseLibraryEditChangeVersionBtn'),
    editDrawerConfirmBtn: document.getElementById('caseLibraryEditConfirmBtn'),
    editDrawerShareBtn: document.getElementById('caseLibraryEditShareBtn'),
    editDrawerExportXmindBtn: document.getElementById('caseLibraryEditExportXmindBtn'),
    editDrawerExportExcelBtn: document.getElementById('caseLibraryEditExportExcelBtn'),
    editDrawerDeleteBtn: document.getElementById('caseLibraryEditDeleteBtn'),
    editDrawerSelectAll: document.getElementById('caseLibraryEditSelectAll'),
    editDrawerStatus: document.getElementById('caseLibraryEditDrawerStatus'),
    editDrawerListBody: document.getElementById('caseLibraryEditListBody'),
    editDrawerPaginationTop: document.getElementById('caseLibraryEditDrawerPaginationTop'),
    editDrawerPaginationBottom: document.getElementById('caseLibraryEditDrawerPaginationBottom'),
    missingDrawerProjectSelect: document.getElementById('caseLibraryMissingProjectSelect'),
    missingDrawerModuleSelect: document.getElementById('caseLibraryMissingModuleSelect'),
    missingDrawerTypeSelect: document.getElementById('caseLibraryMissingTypeSelect'),
    missingDrawerTypeAddBtn: document.getElementById('caseLibraryMissingTypeAddBtn'),
    missingDrawerTypeManageBtn: document.getElementById('caseLibraryMissingTypeManageBtn'),
    missingDrawerTypeGrid: document.getElementById('caseLibraryMissingTypeGrid'),
    missingDrawerQueryBtn: document.getElementById('caseLibraryMissingQueryBtn'),
    missingDrawerAddModuleBtn: document.getElementById('caseLibraryMissingAddModuleBtn'),
    missingDrawerBatchViewBtn: document.getElementById('caseLibraryMissingBatchViewBtn'),
    missingDrawerDeleteBtn: document.getElementById('caseLibraryMissingDeleteBtn'),
    missingDrawerExportXmindBtn: document.getElementById('caseLibraryMissingExportXmindBtn'),
    missingDrawerExportExcelBtn: document.getElementById('caseLibraryMissingExportExcelBtn'),
    missingDrawerSelectAll: document.getElementById('caseLibraryMissingSelectAll'),
    missingDrawerStatus: document.getElementById('caseLibraryMissingDrawerStatus'),
    missingDrawerListBody: document.getElementById('caseLibraryMissingListBody'),
    missingDrawerPaginationTop: document.getElementById('caseLibraryMissingDrawerPaginationTop'),
    missingDrawerPaginationBottom: document.getElementById('caseLibraryMissingDrawerPaginationBottom'),
    missingTypeAddProjectName: document.getElementById('caseLibraryMissingTypeAddProjectName'),
    missingTypeNameInput: document.getElementById('caseLibraryMissingTypeNameInput'),
    missingTypeAddConfirmBtn: document.getElementById('caseLibraryMissingTypeAddConfirmBtn'),
    missingTypeAddStatus: document.getElementById('caseLibraryMissingTypeAddStatus'),
    missingTypeManageBody: document.getElementById('caseLibraryMissingTypeManageBody'),
    missingTypeManageStatus: document.getElementById('caseLibraryMissingTypeManageStatus'),
    missingAddProjectName: document.getElementById('caseLibraryMissingAddProjectName'),
    missingAddModuleNameInput: document.getElementById('caseLibraryMissingModuleNameInput'),
    missingAddConfirmBtn: document.getElementById('caseLibraryMissingAddConfirmBtn'),
    missingAddStatus: document.getElementById('caseLibraryMissingAddStatus'),
    missingEditProjectName: document.getElementById('caseLibraryMissingEditProjectName'),
    missingEditModuleNameInput: document.getElementById('caseLibraryMissingEditModuleNameInput'),
    missingEditConfirmBtn: document.getElementById('caseLibraryMissingEditConfirmBtn'),
    missingEditStatus: document.getElementById('caseLibraryMissingEditStatus'),
    shareDrawerCaseName: document.getElementById('caseLibraryShareCaseName'),
    shareDrawerSourceProject: document.getElementById('caseLibraryShareSourceProject'),
    shareDrawerSourceVersion: document.getElementById('caseLibraryShareSourceVersion'),
    shareDrawerProjectSelect: document.getElementById('caseLibraryShareProjectSelect'),
    shareDrawerVersionSelect: document.getElementById('caseLibraryShareVersionSelect'),
    shareDrawerConfirmBtn: document.getElementById('caseLibraryShareConfirmBtn'),
    shareDrawerStatus: document.getElementById('caseLibraryShareStatus'),

    selectProjectSelect: document.getElementById('caseLibrarySelectProjectSelect'),
    selectOpenButton: document.getElementById('openCaseLibrarySelectExecDrawerBtn'),
    selectVersionSelect: document.getElementById('caseLibrarySelectVersionSelect'),
    selectSearchInput: document.getElementById('caseLibrarySelectSearchInput'),
    selectConfirmBtn: document.getElementById('caseLibrarySelectConfirmBtn'),
    selectSelectAll: document.getElementById('caseLibrarySelectSelectAll'),
    selectBatchExecBtn: document.getElementById('caseLibrarySelectBatchExecBtn'),
    selectStatus: document.getElementById('caseLibrarySelectDrawerStatus'),
    selectTableHost: document.getElementById('caseLibrarySelectExecTableHost'),
    selectPaginationTop: document.getElementById('caseLibrarySelectDrawerPaginationTop'),
    selectPaginationBottom: document.getElementById('caseLibrarySelectDrawerPaginationBottom'),

    associationCaseName: document.getElementById('caseLibraryAssociationCaseName'),
    associationStatus: document.getElementById('caseLibraryAssociationStatus'),
    associationAddBtn: document.getElementById('caseLibraryAssociationAddBtn'),
    associationListTableHost: document.getElementById('caseLibraryAssociationListTableHost'),

    associationPickStatus: document.getElementById('caseLibraryAssociationPickStatus'),
    associationPickVersionSelect: document.getElementById('caseLibraryAssociationPickVersionSelect'),
    associationPickSearchInput: document.getElementById('caseLibraryAssociationPickSearchInput'),
    associationPickRefreshBtn: document.getElementById('caseLibraryAssociationPickRefreshBtn'),
    associationPickQueryBtn: document.getElementById('caseLibraryAssociationPickQueryBtn'),
    associationPickNextBtn: document.getElementById('caseLibraryAssociationPickNextBtn'),
    associationCandidateTableHost: document.getElementById('caseLibraryAssociationCandidateTableHost'),
    associationPickSubCaseName: document.getElementById('caseLibraryAssociationPickSubCaseName'),
    associationPickSelectAll: document.getElementById('caseLibraryAssociationPickSelectAll'),
    associationItemTableHost: document.getElementById('caseLibraryAssociationItemTableHost'),
    associationPickPaginationTop: document.getElementById('caseLibraryAssociationPickPaginationTop'),
    associationPickPaginationBottom: document.getElementById('caseLibraryAssociationPickPaginationBottom'),
    associationPickConfirmBtn: document.getElementById('caseLibraryAssociationPickConfirmBtn'),
    associationDeleteConfirmBtn: document.getElementById('caseLibraryAssociationDeleteConfirmBtn'),

    importSelectProjectSelect: document.getElementById('caseLibraryImportSelectProjectSelect'),
    importSelectVersionSelect: document.getElementById('caseLibraryImportSelectVersionSelect'),
    importSelectSearchInput: document.getElementById('caseLibraryImportSelectSearchInput'),
    importSelectQueryBtn: document.getElementById('caseLibraryImportSelectQueryBtn'),
    importSelectBatchBtn: document.getElementById('caseLibraryImportSelectBatchBtn'),
    importSelectSelectAll: document.getElementById('caseLibraryImportSelectSelectAll'),
    importSelectStatus: document.getElementById('caseLibraryImportSelectStatus'),
    importSelectListBody: document.getElementById('caseLibraryImportSelectListBody'),
    importSelectPaginationTop: document.getElementById('caseLibraryImportSelectPaginationTop'),
    importSelectPaginationBottom: document.getElementById('caseLibraryImportSelectPaginationBottom'),

    historyDrawerProjectSelect: document.getElementById('caseLibraryHistoryProjectSelect'),
    historyDrawerVersionSelect: document.getElementById('caseLibraryHistoryVersionSelect'),
    historyDrawerSearchInput: document.getElementById('caseLibraryHistorySearchInput'),
    historyDrawerQueryBtn: document.getElementById('caseLibraryHistoryQueryBtn'),
    historyDrawerClearBtn: document.getElementById('caseLibraryHistoryClearBtn'),
    historyDrawerStatus: document.getElementById('caseLibraryHistoryDrawerStatus'),
    historyDrawerTableHost: document.getElementById('caseLibraryHistoryDrawerTableHost'),
    historyDrawerPaginationTop: document.getElementById('caseLibraryHistoryDrawerPaginationTop'),
    historyDrawerPaginationBottom: document.getElementById('caseLibraryHistoryDrawerPaginationBottom'),

    historyDetailCard: document.getElementById('caseLibraryHistoryDetailCard'),
    historyStatus: document.getElementById('caseLibraryHistoryStatus'),
    historyCaseName: document.getElementById('caseLibraryHistoryCaseName'),
    historyRefreshBtn: document.getElementById('caseLibraryHistoryRefreshBtn'),
    historyHideBtn: document.getElementById('caseLibraryHistoryHideBtn'),
    historyAppendPill: document.getElementById('caseLibraryHistoryAppendPill'),
    historyAddedPill: document.getElementById('caseLibraryHistoryAddedPill'),
    historyUpdatedPill: document.getElementById('caseLibraryHistoryUpdatedPill'),
    historyDeletedPill: document.getElementById('caseLibraryHistoryDeletedPill'),
    historyImportPill: document.getElementById('caseLibraryHistoryImportPill'),
    historyReimportPill: document.getElementById('caseLibraryHistoryReimportPill'),
    historyFileDeletedPill: document.getElementById('caseLibraryHistoryFileDeletedPill'),
    historyPaginationTop: document.getElementById('caseLibraryHistoryPaginationTop'),
    historyPaginationBottom: document.getElementById('caseLibraryHistoryPaginationBottom'),
    historyTableHost: document.getElementById('caseLibraryHistoryTableHost'),
  };

  var state = {
    projects: [],
    projectNameById: {},

    versionsByProject: {},
    versionNameByProject: {},

    importDrawer: {
      files: [],
      projectId: null,
      versionId: null,
      loading: false,
    },

    writer: {
      loading: false,
      projectId: null,
      versionId: null,
      draftItems: [],
      draftFileName: '',
      fileNameInput: '',
      fileNameClean: '',
      fileNameDuplicate: false,
      fileNameChecking: false,
      duplicateCaseFileId: null,
      summary: null,
      publishing: false,
      lastImportedCaseFileId: null,
    },

	    importDiff: {
        mode: 'import',
        caseFileId: null,
	      fileName: '',
	      cleanName: '',
	      importedCleanName: '',
	      source: '',
	      projectId: null,
	      importVersionId: null,
	      dbVersionId: null,
	      importItems: [],
	      dbItems: [],
	      loading: false,
        confirming: false,
	    },

	    importInvalid: {
	      file: null,
	      fileName: '',
	      cleanName: '',
	      source: '',
	      projectId: null,
	      versionId: null,
	      structuralErrors: [],
	      items: [],
	      invalid: [],
	      loading: false,
	      locateIndex: -1,
	    },

    editDrawer: {
      projectId: null,
      versionId: null,
      ownerFilter: 'all',
      ownerFilterTouched: false,
      changeVersionId: null,
      fileSearchText: '',
      files: [],
      execByFileId: {},
      loading: false,
      selection: new Set(),
      pageIndex: 0,
      restoring: false,
    },

    shareDrawer: {
      caseFile: null,
      caseFiles: [],
      projectId: null,
      versionId: null,
      loading: false,
      versionLoadFailed: false,
      projects: [],
      projectNameById: {},
      versionsByProject: {},
      versionNameByProject: {},
      previousDrawer: null,
      reopenPrevious: false,
    },

    associationDrawer: {
      caseFile: null,
      processing: false,
      previousDrawer: null,
      pendingAction: '',
      pendingAssociationId: null,
    },

    associationPickDrawer: {
      mode: 'create',
      mainCaseFile: null,
      associationId: null,
      subCaseFile: null,
      originalSubCaseFileId: null,
      originalSelectedCaseItemIds: [],
      versionId: null,
      processing: false,
      previousDrawer: null,
    },

    importSelectDrawer: {
      projectId: null,
      versionId: null,
      searchText: '',
      files: [],
      loading: false,
      processing: false,
      selection: new Set(),
      skipCloseImport: false,
      pageIndex: 0,
      loadSeq: 0,
    },

    historyQueryDrawer: {
      projectId: null,
      versionId: null,
    },

    historyDetail: {
      projectId: null,
      fileNameClean: '',
      isDeleted: false,
      versionId: null,
      restoring: false,
    },

    editor: {
      caseFile: null,
      items: [],
      searchText: '',
      pageIndex: 0,
      batchAddCount: 5,
      selection: new Set(),
      remarkOpen: new Set(),
      pendingOp: null,
      pendingTimer: null,
      pendingInterval: null,
      pendingToast: null,
      pendingRemaining: 0,
      restoring: false,
    },

    aiGen: {
      caseFileId: null,
      requirementText: '',
      requirementFileName: '',
      loading: false,
      generated: false,
      error: '',
      modules: [],
      selection: new Set(),
      taskSignature: '',
      taskId: '',
    },

    missingReminder: {
      projectId: null,
      signature: '',
      items: [],
      matchedModules: [],
      matchedTypes: [],
      loading: false,
      loaded: false,
      seq: 0,
      refreshTimer: null,
    },

    missingDrawer: {
      projectId: null,
      moduleId: null,
      modules: [],
      loading: false,
      processing: false,
      selection: new Set(),
      pageIndex: 0,
      moduleCompletion: {},
      moduleCompletionLoading: {},
      moduleCompletionSeq: 0,
    },

    missingType: {
      projectId: null,
      types: [],
      loading: false,
      selection: new Set(),
    },

    missingTypeAdd: {
      projectId: null,
      loading: false,
      source: '',
    },

    missingTypeManage: {
      loading: false,
    },

    missingAdd: {
      projectId: null,
      loading: false,
    },

    missingEdit: {
      moduleId: null,
      projectId: null,
      name: '',
      loading: false,
    },

    missingView: {
      projectId: null,
      modules: [],
      moduleIds: [],
      items: [],
      selection: new Set(),
      pageIndex: 0,
      restoring: false,
      pendingOp: null,
      pendingTimer: null,
      pendingInterval: null,
      pendingToast: null,
      pendingRemaining: 0,
      autoSaveTimers: {},
      autoSaveInFlight: {},
      typeFilters: new Set(),
    },
    missingImport: {
      projectId: null,
      files: [],
      items: [],
      structuralErrors: [],
      loading: false,
      pending: false,
      invalid: [],
    },
    missingImportDiff: {
      projectId: null,
      rows: [],
      newItems: [],
      duplicateCount: 0,
      pendingItemsByModule: [],
      structuralErrors: [],
    },
  };

  var viewStateStore = viewStateStoreOwner.create({
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
  });
  var readEditorPersistedState = viewStateStore.editor.read;
  var writeEditorPersistedState = viewStateStore.editor.write;
  var clearEditorPersistedState = viewStateStore.editor.clear;
  var readEditorBatchAddCountPersistedState = viewStateStore.editorBatchAddCount.read;
  var writeEditorBatchAddCountPersistedState = viewStateStore.editorBatchAddCount.write;
  var readImportDrawerPersistedState = viewStateStore.importDrawer.read;
  var writeImportDrawerPersistedState = viewStateStore.importDrawer.write;
  var readCaseLibraryLastViewPersistedState = viewStateStore.lastView.read;
  var writeCaseLibraryLastViewPersistedState = viewStateStore.lastView.write;
  var readMissingViewPersistedState = viewStateStore.missingView.read;
  var writeMissingViewPersistedState = viewStateStore.missingView.write;
  var clearMissingViewPersistedState = viewStateStore.missingView.clear;
  var readMissingDrawerPersistedState = viewStateStore.missingDrawer.read;
  var writeMissingDrawerPersistedState = viewStateStore.missingDrawer.write;
  var clearMissingDrawerPersistedState = viewStateStore.missingDrawer.clear;
  var readSelectDrawerPersistedState = viewStateStore.selectDrawer.read;
  var writeSelectDrawerPersistedState = viewStateStore.selectDrawer.write;
  var readEditDrawerPersistedState = viewStateStore.editDrawer.read;
  var writeEditDrawerPersistedState = viewStateStore.editDrawer.write;
  var getCurrentLoginSeq = viewStateStore.getCurrentLoginSeq;

  var missingViewModel = missingViewModelOwner.create({
    normalizeText: normalizeEditorText,
    normalizePriority: function(value) { return normalizePriorityInput(value); },
    normalizeTypeId: normalizeMissingTypeId,
    normalizeTypeIds: normalizeMissingTypeIds,
    collectTypeIds: collectMissingItemTypeIds,
    resolveTypeNames: resolveMissingItemTypeNames,
    resolveTypeLabel: function(typeId, fallback) {
      if (typeId === null || typeId === undefined || typeId === '') return '未分类';
      var name = getMissingTypeNameById(typeId);
      return name || fallback || ('类型#' + typeId);
    },
  });
  var missingViewView = missingViewViewOwner.create({
    dom: dom,
    model: missingViewModel,
    getView: function() { return state.missingView; },
    getTypes: function() { return state.missingType.types || []; },
    getProjectName: function(projectId) { return state.projectNameById[projectId] || ('项目#' + projectId); },
    escapeHtml: escapeHtml,
    stripInvisibleMarkers: stripInvisibleMarkers,
    normalizeText: normalizeEditorText,
    normalizePriority: function(value) { return normalizePriorityInput(value); },
    ensureTypeSlots: ensureMissingItemTypeSlots,
    isNewAdded: isMissingNewAdded,
    getPageSize: getPageSize,
  });
  var missingViewController = null;
  var missingViewPendingController = null;

  var editorPendingController = editorPendingControllerOwner.create({
    apiClient: apiClient,
    document: document,
    getEditor: function() { return state.editor; },
    setStatus: function(message, type) { setStatus(dom.editStatus, message, type); },
    renderEditor: renderEditorTable,
    syncBatchDeleteControls: syncEditorBatchDeleteControls,
    syncBatchAddControls: syncEditorBatchAddControls,
    markNewAdded: markCaseLibraryNewAdded,
    unmarkNewAdded: unmarkCaseLibraryNewAdded,
    ensureItemKey: ensureNonEnumerableKey,
    getItemUiKey: getCaseLibraryEditorUiKey,
    normalizeText: normalizeEditorText,
    buildInvisibleMarker: buildInvisibleMarker,
    syncRowInput: syncEditorRowInputToItem,
    logOperation: safeLogOperation,
    isEditing: isCaseLibraryEditorEditing,
    captureAnchorRect: captureCaseLibraryAnchorRect,
    showBlockHint: showCaseLibraryBlockHint,
    getPageSize: getPageSize,
    persistBatchAddCount: persistEditorBatchAddCount,
    scrollToIndex: scrollEditorToIndex,
    openConfirm: openConfirmDrawer,
    getPreviousDrawer: function() { return editDrawerInstance || null; },
    getBatchAddInput: function() { return dom.editBatchAddCountInput; },
  });
  var buildCaseItemPayload = editorPendingController.buildItemPayload;
  var validatePayload = editorPendingController.validatePayload;
  var parseBatchAddCountInput = editorPendingController.parseBatchAddCount;
  var setBatchAddCountInputInvalid = editorPendingController.setBatchAddInputInvalid;
  var clearPendingOp = editorPendingController.clear;
  var startPendingToast = editorPendingController.start;
  var insertCaseItem = editorPendingController.insertCaseItem;
  var batchInsertCaseItems = editorPendingController.batchInsertCaseItems;
  var removeCaseItem = editorPendingController.removeCaseItem;
  var removeSelectedCaseItems = editorPendingController.removeSelectedCaseItems;

  var importFileParser = importFileParserOwner.create({
    getCore: getCore,
    getXlsxCore: function() { return window.app.xlsxCoreApi; },
  });
  var buildImportItems = importFileParser.buildItems;
  var normalizePriorityInput = importFileParser.normalizePriority;
  var sanitizeImportItemsForApi = importFileParser.sanitizeItems;
  var validateImportItems = importFileParser.validateItems;
  var buildImportItemsFromXmindPaths = importFileParser.buildFromXmindPaths;
  var parseXlsxFileToCaseRows = importFileParser.parseXlsxRows;
  var buildImportItemsFromXlsxRows = importFileParser.buildFromXlsxRows;
  var parseImportFile = importFileParser.parseFile;
  var xmindModel = xmindModelOwner.create({
    normalizePriority: normalizePriorityInput,
    cleanFileName: cleanCaseFileName,
    buildImportItems: buildImportItems,
  });
  var xmindWorkspaceController = xmindWorkspaceControllerOwner.create({
    model: xmindModel,
    document: document,
    window: window,
    storage: typeof localStorage !== 'undefined' ? localStorage : null,
    apiClient: apiClient,
    getMindApi: function() {
      return window.app && window.app.mindElixirCoreApi ? window.app.mindElixirCoreApi : null;
    },
    ensureDrawer: ensureDrawer,
    getEditor: function() { return state.editor; },
    getXmindBuilder: function() {
      return typeof getXmindBuilder === 'function' ? getXmindBuilder() : null;
    },
    getDownloadBlob: getDownloadBlob,
    cleanFileName: cleanCaseFileName,
    sanitizeDownloadName: sanitizeDownloadName,
    setEditStatus: function(message, type) { setStatus(dom.editStatus, message, type); },
    setMainStatus: function(message, type) { setStatus(dom.status, message, type); },
    logOperation: safeLogOperation,
    openConfirmDrawer: openConfirmDrawer,
    showToast: utils && typeof utils.showCenterToast === 'function' ? utils.showCenterToast : null,
    getCurrentUserId: getCurrentUserId,
    onEditorItemsReloaded: function(items) {
      state.editor.items = reorderItemsByExistingModuleAppend(items);
      state.editor.pageIndex = 0;
      state.editor.selection = new Set();
      renderEditorCard();
      syncEditorSearchControls();
      syncEditorBatchDeleteControls();
      syncEditorBatchAddControls();
      syncCaseLibraryAiGenContext();
    },
    onLocateEditorIndex: function(index) {
      var pageSize = getPageSize();
      if (!isFinite(pageSize) || pageSize <= 0) pageSize = 20;
      state.editor.pageIndex = Math.floor(index / pageSize);
      renderEditorTable();
      setTimeout(function() {
        scrollEditorToIndex(index);
        flashCaseLibraryXmindLocateHighlight(index, 3200);
      }, 0);
    },
    requestWriterPublish: function(items, summary, saveMeta) {
      return writerPublishController.requestPublish(items, summary, saveMeta);
    },
  });
  var openCaseLibraryXmindStructure = xmindWorkspaceController.openViewer;
  var openCaseLibraryWriterStructure = xmindWorkspaceController.openWriter;
  var deriveCaseLibraryWriterPublishDefaultFileName = xmindWorkspaceController.deriveWriterPublishDefaultFileName;

  var missingImportModel = missingImportModelOwner.create({
    normalizePriorityInput: normalizePriorityInput,
    normalizeDiffText: normalizeDiffText,
    buildCaseItemKey: buildCaseItemKey,
    dedupeCaseItemsByKey: dedupeCaseItemsByKey,
  });
  var missingImportFileParser = missingImportFileParserOwner.create({
    getCore: getCore,
    buildFromXmindPaths: buildImportItemsFromXmindPaths,
    parseXlsxRows: parseXlsxFileToCaseRows,
    buildFromXlsxRows: buildImportItemsFromXlsxRows,
    validateHeaderRow: missingImportModel.validateHeaderRow,
  });
  var missingImportView = missingImportViewOwner.create({
    dom: dom,
    escapeHtml: escapeHtml,
    setStatus: setStatus,
    formatStructuralDetail: missingImportModel.formatStructuralDetail,
    countPendingItems: missingImportModel.countPendingItems,
  });
  var missingDrawerController = null;
  var missingCatalogMaintenanceController = null;
  var missingImportController = missingImportControllerOwner.create({
    state: state,
    dom: dom,
    apiClient: apiClient,
    model: missingImportModel,
    fileParser: missingImportFileParser,
    view: missingImportView,
    normalizeId: normalizeId,
    buildCaseItemKey: buildCaseItemKey,
    buildImportDiffRows: buildImportDiffRows,
    ensureDrawer: ensureDrawer,
    syncProjectOptions: syncProjectOptions,
    onProjectChange: function(projectId) {
      if (!dom.missingDrawerProjectSelect) return;
      var current = String(dom.missingDrawerProjectSelect.value || '');
      if (projectId && current !== String(projectId)) {
        dom.missingDrawerProjectSelect.value = String(projectId);
        missingDrawerController.handleProjectChange();
      }
    },
    reloadModules: function(projectId) {
      return missingDrawerController ? missingDrawerController.loadModules(projectId) : Promise.resolve([]);
    },
  });
  var missingDrawerModel = missingDrawerModelOwner.create({
    resolvePage: resolveDrawerPage,
    normalizeTypeId: normalizeMissingTypeId,
    normalizeText: normalizeEditorText,
  });
  var missingDrawerView = missingDrawerViewOwner.create({
    dom: dom,
    escapeHtml: escapeHtml,
    setStatus: setStatus,
    syncProjectOptions: syncProjectOptions,
    syncModuleOptions: syncMissingModuleOptions,
    syncTypeOptions: syncMissingTypeOptions,
    setPagination: setDrawerPagination,
    buildPagination: buildDrawerPagination,
  });
  missingDrawerController = missingDrawerControllerOwner.create({
    state: state,
    dom: dom,
    apiClient: apiClient,
    model: missingDrawerModel,
    view: missingDrawerView,
    missingImportController: missingImportController,
    normalizeId: normalizeId,
    normalizeTypeSelection: normalizeMissingTypeSelection,
    persistProject: persistMissingDrawerProject,
    readPersistedState: readMissingDrawerPersistedState,
    clearPersistedState: clearMissingDrawerPersistedState,
    getCurrentUserId: getCurrentUserId,
    getCurrentLoginSeq: getCurrentLoginSeq,
    getProjects: function() { return state.projects || []; },
    getPageSize: getPageSize,
    onTypesChanged: function() {
      if (missingCatalogMaintenanceController) missingCatalogMaintenanceController.refreshTypeUi();
    },
    onOpenTypeAdd: function(source) {
      if (missingCatalogMaintenanceController) missingCatalogMaintenanceController.openTypeAdd(source);
    },
    onOpenTypeManage: function() {
      if (missingCatalogMaintenanceController) missingCatalogMaintenanceController.openTypeManage();
    },
    onAddModule: function() {
      if (missingCatalogMaintenanceController) missingCatalogMaintenanceController.openModuleAdd();
    },
    onViewModules: function(modules) {
      return missingViewController ? missingViewController.openForModules(modules) : Promise.resolve([]);
    },
    onEditModule: function(module) {
      if (missingCatalogMaintenanceController) missingCatalogMaintenanceController.openModuleEdit(module);
    },
    onDeleteModules: function(anchorEl) {
      if (missingCatalogMaintenanceController) missingCatalogMaintenanceController.deleteSelectedModules(anchorEl);
    },
    onExportXmind: exportMissingSelectionToXmind,
    onExportExcel: exportMissingSelectionToExcel,
    onConfirmTypeAdd: function() {
      if (missingCatalogMaintenanceController) missingCatalogMaintenanceController.confirmTypeAdd();
    },
    onDeleteType: function(type, anchorEl) {
      if (missingCatalogMaintenanceController) missingCatalogMaintenanceController.requestDeleteType(type, anchorEl);
    },
  });
  var missingCatalogMaintenanceView = missingCatalogMaintenanceViewOwner.create({
    dom: dom,
    escapeHtml: escapeHtml,
    setStatus: setStatus,
  });
  missingCatalogMaintenanceController = missingCatalogMaintenanceControllerOwner.create({
    state: state,
    dom: dom,
    apiClient: apiClient,
    model: missingDrawerModel,
    view: missingCatalogMaintenanceView,
    drawerController: missingDrawerController,
    ensureDrawer: ensureDrawer,
    openConfirmDrawer: openConfirmDrawer,
    isAdminUser: isAdminUser,
    canDeleteModules: canDeleteMissingModules,
    getProjectName: function(projectId) { return state.projectNameById[projectId] || ('项目#' + projectId); },
    getMainDrawer: function() { return missingDrawerInstance; },
    showToast: showCenterToast,
    captureAnchor: captureCaseLibraryAnchorRect,
    showBlockHint: showCaseLibraryBlockHint,
    normalizeTypeSelection: normalizeMissingTypeSelection,
    normalizeTypeId: normalizeMissingTypeId,
    normalizeTypeIds: normalizeMissingTypeIds,
    ensureItemTypeSlots: ensureMissingItemTypeSlots,
    resolveItemTypeNames: resolveMissingItemTypeNames,
    formatItemTypeLabel: formatMissingItemTypeLabel,
    renderTypePills: missingViewView.renderTypePills,
    refreshTypeCells: missingViewView.refreshTypeCells,
    normalizeViewTypeFilters: normalizeMissingViewTypeFilters,
    isMissingCardVisible: isMissingCardVisible,
    renderMissingView: missingViewView.render,
    updateMissingViewMeta: missingViewView.updateMeta,
    persistMissingView: persistMissingViewSelection,
    clearMissingViewPersistence: clearMissingViewPersistedState,
  });

  missingViewController = missingViewControllerOwner.create({
    dom: dom,
    apiClient: apiClient,
    model: missingViewModel,
    view: missingViewView,
    getView: function() { return state.missingView; },
    getDrawerState: function() { return state.missingDrawer; },
    getDrawerController: function() { return missingDrawerController; },
    getMaintenanceController: function() { return missingCatalogMaintenanceController; },
    getDrawer: function() { return missingDrawerInstance; },
    getPageSize: getPageSize,
    normalizeItem: normalizeMissingItemTypeData,
    normalizeTypeId: normalizeMissingTypeId,
    ensureTypeSlots: ensureMissingItemTypeSlots,
    collectTypeIds: collectMissingItemTypeIds,
    normalizeText: normalizeEditorText,
    normalizePriority: function(value) { return normalizePriorityInput(value); },
    moveCaretToEnd: moveInlineEditorCaretToEnd,
    setStatus: function(message, type) { setStatus(dom.missingStatus, message, type); },
    setDrawerStatus: function(message, type) { setStatus(dom.missingDrawerStatus, message, type); },
    showToast: showCenterToast,
    openConfirm: openConfirmDrawer,
    captureAnchor: captureCaseLibraryAnchorRect,
    clearPending: function() {
      if (missingViewPendingController) missingViewPendingController.clear();
    },
    persistView: persistMissingViewSelection,
    persistLastView: persistCaseLibraryLastView,
    normalizeViewFilters: normalizeMissingViewTypeFilters,
    showMissingCard: showMissingCard,
    showEditorCard: showEditorCard,
    setHistoryVisible: function(visible) {
      if (historyDrawerController) historyDrawerController.setDetailVisible(visible);
    },
    insertItem: function(index, anchorRect) {
      if (missingViewPendingController) missingViewPendingController.insert(index, anchorRect);
    },
    removeItem: function(index, anchorRect) {
      if (missingViewPendingController) missingViewPendingController.remove(index, anchorRect);
    },
    addEmptyItem: function(anchorRect) {
      if (missingViewPendingController) missingViewPendingController.addEmpty(anchorRect);
    },
    removeSelected: function(anchorEl) {
      if (missingViewPendingController) missingViewPendingController.removeSelected(anchorEl);
    },
  });
  missingViewPendingController = missingViewPendingControllerOwner.create({
    apiClient: apiClient,
    document: document,
    getView: function() { return state.missingView; },
    setStatus: function(message, type) { setStatus(dom.missingStatus, message, type); },
    render: missingViewView.render,
    syncBatchDeleteControls: missingViewView.syncBatchDeleteControls,
    buildPayload: missingViewModel.buildItemPayload,
    validatePayload: missingViewModel.validatePayload,
    syncRowInput: missingViewView.syncRowInput,
    getItemUiKey: getMissingItemUiKey,
    normalizeCreated: normalizeMissingItemTypeData,
    ensureItemKey: ensureNonEnumerableKey,
    markNewAdded: markMissingNewAdded,
    unmarkNewAdded: unmarkMissingNewAdded,
    captureAnchorRect: captureCaseLibraryAnchorRect,
    showBlockHint: showCaseLibraryBlockHint,
    getPageSize: getPageSize,
    getModuleName: missingViewView.getModuleName,
    openConfirm: openConfirmDrawer,
    getPreviousDrawer: function() { return missingDrawerInstance || null; },
  });
  var getMissingModuleNameById = missingViewView.getModuleName;
  var updateMissingViewMeta = missingViewView.updateMeta;
  var buildMissingItemPayload = missingViewModel.buildItemPayload;
  var validateMissingPayload = missingViewModel.validatePayload;
  var syncMissingRowInputToItem = missingViewView.syncRowInput;
  var resolveMissingTypeLabel = missingViewView.resolveTypeLabel;
  var renderMissingTypePills = missingViewView.renderTypePills;
  var refreshMissingTypeCells = missingViewView.refreshTypeCells;
  var renderMissingViewTable = missingViewView.render;
  var syncMissingBatchDeleteControls = missingViewView.syncBatchDeleteControls;
  var openMissingViewForModules = missingViewController.openForModules;
  var loadMissingViewItems = missingViewController.loadItems;
  var clearMissingPendingOp = missingViewPendingController.clear;
  var startMissingPendingToast = missingViewPendingController.start;
  var insertMissingItem = missingViewPendingController.insert;
  var addMissingEmptyItem = missingViewPendingController.addEmpty;
  var removeMissingItem = missingViewPendingController.remove;
  var removeSelectedMissingItems = missingViewPendingController.removeSelected;

  var importDrawerInstance = null;
  var importReviewController = null;
  var importWorkflowController = null;
  var importSelectController = null;
  var writerPublishController = null;
  var shareController = null;
  var editListControllerInstance = null;
  var editorControllerInstance = null;
  var selectExecControllerInstance = null;
  var selectExecDrawerControllerInstance = null;
  var selectExecLoadSeq = 0;
  var associationListControllerInstance = null;
  var associationCandidateControllerInstance = null;
  var associationItemControllerInstance = null;
  var associationWorkflowController = null;
  var editDrawerInstance = null;
  var editDrawerOpenPromise = Promise.resolve(false);
  var missingDrawerInstance = null;
  var associationDrawerInstance = null;
  var associationPickDrawerInstance = null;
  var associationItemDrawerInstance = null;
  var associationDeleteConfirmDrawerInstance = null;
    var importSelectDrawerInstance = null;

  function isDrawerInstanceOpen(instance) {
    return Boolean(
      instance &&
      instance.element &&
      instance.element.classList &&
      instance.element.classList.contains('open')
    );
  }

  var importReviewView = importReviewViewOwner.create({
    dom: dom,
    escapeHtml: escapeHtml,
    setStatus: setStatus,
    normalizePriority: normalizePriorityInput,
    debounce: utils && typeof utils.debounce === 'function' ? utils.debounce : null,
  });
  importReviewController = importReviewControllerOwner.create({
    state: state,
    dom: dom,
    apiClient: apiClient,
    view: importReviewView,
    diffControllerOwner: diffControllerOwner,
    ensureDrawer: ensureDrawer,
    openConfirmDrawer: openConfirmDrawer,
    setStatus: setStatus,
    cleanFileName: cleanCaseFileName,
    extFromFileName: extFromFileName,
    validateItems: validateImportItems,
    sanitizeItems: sanitizeImportItemsForApi,
    buildItemKey: buildCaseItemKey,
    dedupeItems: dedupeCaseItemsByKey,
    countUniqueItems: countUniqueCaseItemsByKey,
    loadVersions: loadVersions,
    getProjectName: function(projectId) {
      return state.projectNameById[projectId] || ('项目#' + projectId);
    },
    getVersionName: getVersionName,
    getImportDrawer: function() { return importDrawerInstance; },
    refreshCaseFiles: refreshCaseFileListsByProject,
    renderImportFileHint: renderImportFileHint,
    syncImportConfirmEnabled: syncImportConfirmEnabled,
  });
  importWorkflowController = importWorkflowControllerOwner.create({
    state: state,
    dom: dom,
    apiClient: apiClient,
    reviewController: importReviewController,
    parseFile: parseImportFile,
    validateItems: validateImportItems,
    sanitizeItems: sanitizeImportItemsForApi,
    cleanFileName: cleanCaseFileName,
    extFromFileName: extFromFileName,
    setStatus: setStatus,
    showToast: showCenterToast,
    renderFileHint: renderImportFileHint,
    syncConfirmEnabled: syncImportConfirmEnabled,
  });
  var importSelectView = importSelectViewOwner.create({
    dom: dom,
    setStatus: setStatus,
    escapeHtml: escapeHtml,
    syncProjectOptions: syncProjectOptions,
    syncVersionOptionsWithAll: syncVersionOptionsWithAll,
    getProjectName: function(projectId) {
      return state.projectNameById[projectId] || ('项目#' + projectId);
    },
    getVersionName: getVersionName,
  });
  importSelectController = importSelectControllerOwner.create({
    state: state,
    apiClient: apiClient,
    model: importSelectModelOwner,
    view: importSelectView,
    normalizeId: normalizeId,
    getPageSize: getPageSize,
    ensureProjectsReady: ensureProjectsReady,
    loadVersions: loadVersions,
    getVersions: function(projectId) {
      return state.versionsByProject[projectId] || [];
    },
    getDrawer: function() { return importSelectDrawerInstance; },
    closeAllDrawers: function() {
      if (window.app && window.app.drawer && typeof window.app.drawer.closeAllDrawers === 'function') {
        window.app.drawer.closeAllDrawers();
      }
    },
    getCasesApi: function() {
      return window.app && window.app.casesCoreApi ? window.app.casesCoreApi : null;
    },
    syncWorkflowStatus: function(message, type, casesApi) {
      if (casesApi && typeof casesApi.syncImportedCaseStatus === 'function') {
        casesApi.syncImportedCaseStatus({ text: message, type: type });
        return;
      }
      setStatus(document.getElementById('caseStatus'), message, type);
    },
  });
  var exportService = exportServiceOwner.create({
    escapeXmlText: escapeXmlText,
    escapeXmlTextPreserve: escapeXmlTextPreserve,
  });
  var ensureExportDepsReady = exportService.ensureReady;
  var getXmindBuilder = exportService.getXmindBuilder;
  var buildCaseLibraryExcelBlob = exportService.buildCaseExcelBlob;
  var buildSimpleXlsxBlob = exportService.buildSimpleXlsxBlob;
  var buildCaseLibraryReuseExcelTemplateBlob = exportService.buildReuseTemplateBlob;
  var exportController = exportControllerOwner.create({
    state: state,
    dom: dom,
    apiClient: apiClient,
    getSelectedModules: function() { return missingDrawerController.getSelectedModules(); },
    getXmindBuilder: getXmindBuilder,
    getDownloadBlob: getDownloadBlob,
    getJsZip: function() {
      return typeof JSZip !== 'undefined' ? JSZip : (window.JSZip ? window.JSZip : null);
    },
    sanitizeDownloadName: sanitizeDownloadName,
    getMissingModuleName: getMissingModuleNameById,
    buildSimpleXlsxBlob: buildSimpleXlsxBlob,
    buildCaseExcelBlob: buildCaseLibraryExcelBlob,
    buildReuseTemplateBlob: buildCaseLibraryReuseExcelTemplateBlob,
    setStatus: setStatus,
    logOperation: safeLogOperation,
    logError: function(error) { console.error(error); },
  });
  var exportMissingSelectionToXmind = exportController.exportMissingToXmind;
  var exportMissingSelectionToExcel = exportController.exportMissingToExcel;
  var downloadImportExcelTemplate = exportController.downloadImportExcelTemplate;
  var downloadImportXmindTemplate = exportController.downloadImportXmindTemplate;
  var writerPublishView = writerPublishViewOwner.create({
    dom: dom,
    setStatus: setStatus,
    cleanFileName: cleanCaseFileName,
    syncProjectOptions: syncProjectOptions,
    syncVersionOptions: syncVersionOptions,
  });
  writerPublishController = writerPublishControllerOwner.create({
    state: state,
    apiClient: apiClient,
    view: writerPublishView,
    reviewController: importReviewController,
    ensureDrawer: ensureDrawer,
    ensureProjectsReady: ensureProjectsReady,
    loadVersions: loadVersions,
    normalizeId: normalizeId,
    cleanFileName: cleanCaseFileName,
    validateItems: validateImportItems,
    sanitizeItems: sanitizeImportItemsForApi,
    deriveDefaultFileName: deriveCaseLibraryWriterPublishDefaultFileName,
    getPreferredSelection: function() {
      if (state.importDrawer && state.importDrawer.projectId) {
        return {
          projectId: state.importDrawer.projectId,
          versionId: state.importDrawer.versionId || null,
        };
      }
      if (state.editDrawer && state.editDrawer.projectId) {
        return {
          projectId: state.editDrawer.projectId,
          versionId: state.editDrawer.versionId || null,
        };
      }
      return {};
    },
    refreshCaseFiles: refreshCaseFileListsByProject,
    openImportedCase: openEditorForImportedWriterCase,
    onSuccessStatus: function(message) {
      setStatus(dom.status, message, 'ok');
      setStatus(dom.editStatus, message, 'ok');
    },
    utils: utils,
  });
  var associationWorkflowView = associationWorkflowViewOwner.create({
    dom: dom,
    setStatus: setStatus,
    syncVersionOptions: syncVersionOptions,
  });
  associationWorkflowController = associationWorkflowControllerOwner.create({
    state: state,
    apiClient: apiClient,
    model: associationModelOwner,
    view: associationWorkflowView,
    getListController: ensureAssociationListController,
    getCandidateController: ensureAssociationCandidateController,
    getItemController: ensureAssociationItemController,
    getSelectController: ensureSelectExecController,
    getDrawers: function() {
      return {
        select: selectExecDrawerControllerInstance ? selectExecDrawerControllerInstance.getDrawer() : null,
        main: associationDrawerInstance,
        pick: associationPickDrawerInstance,
        item: associationItemDrawerInstance,
        deleteConfirm: associationDeleteConfirmDrawerInstance,
      };
    },
    loadVersions: loadVersions,
    normalizeId: normalizeId,
    openConfirmDrawer: openConfirmDrawer,
    showToast: showCenterToast,
    isDrawerOpen: isDrawerInstanceOpen,
    resolveAssociationDecision: selectExecModelOwner.resolveAssociationDecision,
  });
  var selectExecView = selectExecViewOwner.create({
    dom: dom,
    setStatus: setStatus,
    syncProjectOptions: syncProjectOptions,
    syncVersionOptions: syncVersionOptions,
  });
  var execTransferService = execTransferServiceOwner.create({
    apiClient: apiClient,
    utils: utils,
    getTempExecApi: getTempExecApi,
    getGlobalState: function() {
      return window.app && window.app.state ? window.app.state : null;
    },
    isExecDbEnabled: isExecDbEnabled,
    setStatus: setStatus,
    getDefaultStatusElement: function() { return dom.status; },
    openConfirmDrawer: openConfirmDrawer,
    confirmOverwrite: function(message) { return window.confirm(message); },
    getVersionName: getVersionName,
    requestAssignDrawer: requestTempExecAssignDrawer,
    activateExecView: activateTempExecView,
  });
  var transferItemsToTempExec = execTransferService.transfer;
  selectExecDrawerControllerInstance = selectExecDrawerControllerOwner.create({
    state: state,
    apiClient: apiClient,
    model: selectExecModelOwner,
    workflow: selectExecWorkflowOwner,
    view: selectExecView,
    getListController: ensureSelectExecController,
    normalizeId: normalizeId,
    ensureProjectsReady: ensureProjectsReady,
    loadVersions: loadVersions,
    persistState: persistSelectDrawerState,
    readPersistedState: readSelectDrawerPersistedState,
    isAuthReady: isAuthReady,
    getCurrentUserId: getCurrentUserId,
    nextLoadSeq: function() {
      selectExecLoadSeq += 1;
      return selectExecLoadSeq;
    },
    isLoadSeqCurrent: function(seq) { return seq === selectExecLoadSeq; },
    resolveAssociation: function(file) {
      return associationWorkflowController.resolveExecAssociation(file);
    },
    transferItems: function(file, fileName, items, options) {
      var transferOptions = Object.assign({}, options || {});
      if (transferOptions.statusTarget === 'select') transferOptions.statusEl = dom.selectStatus;
      delete transferOptions.statusTarget;
      return transferItemsToTempExec(file, fileName, items, transferOptions);
    },
    openConfirmDrawer: openConfirmDrawer,
    isExecDbEnabled: isExecDbEnabled,
    getVersionDrawer: function() {
      return window.app && window.app.execVersionDrawer ? window.app.execVersionDrawer : null;
    },
    ensureDrawer: ensureDrawer,
    closeAllDrawers: function() {
      if (window.app && window.app.drawer && typeof window.app.drawer.closeAllDrawers === 'function') {
        window.app.drawer.closeAllDrawers();
      }
    },
    markSkipRestore: function() {
      try { if (window.app) window.app.__drawerSkipRestoreOnce = true; } catch (_) {}
    },
    activateExecView: activateTempExecView,
    getVersionName: getVersionName,
  });
  var shareView = shareViewOwner.create({
    dom: dom,
    escapeHtml: escapeHtml,
    setStatus: setStatus,
  });
  shareController = shareControllerOwner.create({
    state: state,
    dom: dom,
    apiClient: apiClient,
    view: shareView,
    ensureDrawer: ensureDrawer,
    openConfirmDrawer: openConfirmDrawer,
    normalizeId: normalizeId,
    sortProjects: utils && typeof utils.sortProjectsByUserSettings === 'function'
      ? utils.sortProjectsByUserSettings
      : null,
    getProjectName: function(projectId) {
      return state.projectNameById[projectId] || ('项目#' + projectId);
    },
    getVersionName: getVersionName,
    captureAnchor: captureCaseLibraryAnchorRect,
    showBlockHint: showCaseLibraryBlockHint,
  });

  var historyDrawerController = historyDrawerControllerOwner.create({
    state: state,
    dom: dom,
    apiClient: apiClient,
    queryControllerOwner: historyQueryControllerOwner,
    detailControllerOwner: historyDetailControllerOwner,
    normalizeId: normalizeId,
    getPageSize: getPageSize,
    formatTime: formatTime,
    getVersionName: getVersionName,
    setStatus: setStatus,
    syncProjectOptions: syncProjectOptions,
    syncVersionOptionsWithAll: syncVersionOptionsWithAll,
    loadVersions: loadVersions,
    ensureProjectsReady: ensureProjectsReady,
    ensureDrawer: ensureDrawer,
    getCurrentUserId: getCurrentUserId,
    getCurrentLoginSeq: getCurrentLoginSeq,
    isAuthReady: isAuthReady,
    getProjects: function() { return state.projects || []; },
    getProjectName: function(projectId) {
      return state.projectNameById[projectId] || ('项目#' + projectId);
    },
    persistLastView: persistCaseLibraryLastView,
    hideEditorCard: function() { showEditorCard(false); },
    hideMissingCard: function() { showMissingCard(false); },
    hasEditorSelection: function() {
      return Boolean(state.editor && state.editor.caseFile && state.editor.caseFile.id);
    },
  });
  var setHistoryDetailVisible = historyDrawerController.setDetailVisible;
  var isHistoryDetailVisible = historyDrawerController.isDetailVisible;
  var persistHistoryDetailSelection = historyDrawerController.persistDetailSelection;
  var readHistoryDetailPersistedState = historyDrawerController.readDetailPersistedState;
  var restoreHistoryDetailFromPersistedState = historyDrawerController.restoreDetail;

  function ensureAssociationListController() {
    if (associationListControllerInstance) return associationListControllerInstance;
    if (!dom.associationListTableHost || !associationListControllerOwner) return null;
    associationListControllerInstance = associationListControllerOwner.create({
      hostEl: dom.associationListTableHost,
      onEdit: function(record) {
        associationWorkflowController.openPick('edit', state.associationDrawer.caseFile, record);
      },
      onDelete: function(record) {
        associationWorkflowController.requestDelete(record);
      },
      onStateChange: function() {
        associationWorkflowController.syncAddButton();
      },
    });
    return associationListControllerInstance;
  }

  function ensureEditListController() {
    if (editListControllerInstance) return editListControllerInstance;
    if (!dom.editDrawerListBody || !editListControllerOwner) return null;
    editListControllerInstance = editListControllerOwner.create({
      hostEl: dom.editDrawerListBody,
      selectAllEl: dom.editDrawerSelectAll,
      paginationTopEl: dom.editDrawerPaginationTop,
      paginationBottomEl: dom.editDrawerPaginationBottom,
      actionButtonEls: [
        dom.editDrawerShareBtn,
        dom.editDrawerExportXmindBtn,
        dom.editDrawerExportExcelBtn,
      ],
      deleteButtonEl: dom.editDrawerDeleteBtn,
      changeVersionSelectEl: dom.editDrawerChangeVersionSelect,
      changeVersionButtonEl: dom.editDrawerChangeVersionBtn,
      pageSize: getPageSize(),
      canDelete: isAdminUser,
      adapterOptions: { formatTime: formatTime },
      onEdit: function(file) {
        safeLogOperation('view_case_file', 'case_file', file.id, {
          file_name: file.file_name_clean || '',
        });
        markCaseLibraryAiGenEditBadgeRead(file.id);
        openEditorForCaseFile(file);
      },
      onStateChange: function(snapshot) {
        if (!snapshot) return;
        state.editDrawer.projectId = snapshot.projectId;
        state.editDrawer.versionId = snapshot.versionId;
        state.editDrawer.ownerFilter = snapshot.ownerFilter;
        state.editDrawer.ownerFilterTouched = snapshot.ownerFilterTouched;
        state.editDrawer.fileSearchText = snapshot.searchText;
        state.editDrawer.pageIndex = snapshot.pageIndex;
        state.editDrawer.loading = snapshot.loading || snapshot.processing;
        state.editDrawer.selection = new Set(snapshot.selectedIds || []);
      },
      onSelectionChange: function() {
        persistEditDrawerState({
          drawer_open: Boolean(
            editDrawerInstance &&
            editDrawerInstance.element &&
            editDrawerInstance.element.classList &&
            editDrawerInstance.element.classList.contains('open')
          ),
        });
      },
    });
    return editListControllerInstance;
  }

  function setEditListControllerData(files, execSets, options) {
    var list = Array.isArray(files) ? files : [];
    var opts = options && typeof options === 'object' ? options : {};
    var projectId = opts.projectId || state.editDrawer.projectId || null;
    var execByFileId = Array.isArray(execSets)
      ? editListModelOwner.normalizeExecByFileId(execSets)
      : (opts.execByFileId && typeof opts.execByFileId === 'object'
        ? opts.execByFileId
        : (state.editDrawer.execByFileId || {}));
    var aiBadgeByFileId = {};
    list.forEach(function(file) {
      if (!file || file.id === null || file.id === undefined) return;
      aiBadgeByFileId[String(file.id)] = shouldShowCaseLibraryAiGenEditBadge(file.id);
    });
    state.editDrawer.files = list;
    state.editDrawer.execByFileId = execByFileId;
    var controller = ensureEditListController();
    if (!controller) return null;
    controller.setData(list, {
      projectId: projectId,
      currentUserId: getCurrentUserId(),
      projectNameById: state.projectNameById,
      versionNameByProject: state.versionNameByProject,
      execByFileId: execByFileId,
      aiBadgeByFileId: aiBadgeByFileId,
    });
    if (Array.isArray(opts.selectedIds)) controller.setSelection(opts.selectedIds);
    return controller;
  }

  function resolveEditorActionAnchor(payload) {
    var nativeEvent = payload && payload.event && payload.event.event
      ? payload.event.event
      : null;
    if (nativeEvent && isFinite(Number(nativeEvent.clientX)) && isFinite(Number(nativeEvent.clientY))) {
      return {
        left: Number(nativeEvent.clientX),
        top: Number(nativeEvent.clientY),
        width: 1,
        height: 1,
        bottom: Number(nativeEvent.clientY) + 1,
      };
    }
    var element = payload && payload.element ? payload.element : null;
    return captureCaseLibraryAnchorRect(element);
  }

  function ensureEditorController() {
    if (editorControllerInstance) return editorControllerInstance;
    if (!dom.editorTableHost || !editorControllerOwner) return null;
    editorControllerInstance = editorControllerOwner.create({
      hostEl: dom.editorTableHost,
      selectAllEl: dom.editorSelectAll,
      paginationTopEl: dom.editorPaginationTop,
      paginationBottomEl: dom.editorPaginationBottom,
      pageSize: getPageSize(),
      onFieldChange: function(index, field, value) {
        var item = state.editor && Array.isArray(state.editor.items)
          ? state.editor.items[index]
          : null;
        if (!item || !field) return;
        var next = normalizeEditorText(value);
        if (normalizeEditorText(item[field]) === next) return;
        item[field] = next;
        missingReminderController.requestRefresh();
        saveCaseItemAtIndex(index, '保存');
      },
      onAction: function(action, index, record, payload) {
        var anchor = resolveEditorActionAnchor(payload);
        if (action === 'insert') insertCaseItem(index, anchor);
        else if (action === 'remove') removeCaseItem(index, anchor);
      },
      onSelectionChange: function(indexes) {
        state.editor.selection = new Set(indexes || []);
        syncEditorBatchDeleteControls();
      },
      onPageChange: function(index) {
        state.editor.pageIndex = index;
      },
    });
    return editorControllerInstance;
  }

  function setEditorControllerData() {
    var controller = ensureEditorController();
    if (!controller) return null;
    var editor = state.editor || {};
    var caseFile = editor.caseFile || null;
    var snapshot = controller.setData(editor.items || [], {
      caseFileId: caseFile && caseFile.id ? caseFile.id : null,
      searchText: editor.searchText || '',
      pageIndex: editor.pageIndex || 0,
      pageSize: getPageSize(),
      selectedIndexes: editor.selection instanceof Set ? Array.from(editor.selection) : [],
      normalizeDisplay: function(value) { return stripInvisibleMarkers(value); },
      isNewAdded: function(item) {
        return isCaseLibraryNewAdded(caseFile && caseFile.id ? caseFile.id : null, item);
      },
    });
    editor.pageIndex = snapshot.pageIndex;
    syncEditorBatchDeleteControls();
    syncEditorBatchAddControls();
    missingReminderController.requestRefresh();
    return controller;
  }

  function ensureAssociationCandidateController() {
    if (associationCandidateControllerInstance) return associationCandidateControllerInstance;
    if (!dom.associationCandidateTableHost || !associationCandidateControllerOwner) return null;
    associationCandidateControllerInstance = associationCandidateControllerOwner.create({
      hostEl: dom.associationCandidateTableHost,
      searchInputEl: dom.associationPickSearchInput,
      getVersionName: getVersionName,
      onSelect: function(record) {
        associationWorkflowController.handleCandidateSelect(record);
      },
    });
    return associationCandidateControllerInstance;
  }

  function ensureAssociationItemController() {
    if (associationItemControllerInstance) return associationItemControllerInstance;
    if (!dom.associationItemTableHost || !associationItemControllerOwner) return null;
    associationItemControllerInstance = associationItemControllerOwner.create({
      hostEl: dom.associationItemTableHost,
      selectAllEl: dom.associationPickSelectAll,
      paginationTopEl: dom.associationPickPaginationTop,
      paginationBottomEl: dom.associationPickPaginationBottom,
      pageSize: getPageSize(),
    });
    return associationItemControllerInstance;
  }

  function ensureSelectExecController() {
    if (selectExecControllerInstance) return selectExecControllerInstance;
    if (!dom.selectTableHost || !selectExecControllerOwner) return null;
    selectExecControllerInstance = selectExecControllerOwner.create({
      hostEl: dom.selectTableHost,
      selectAllEl: dom.selectSelectAll,
      searchInputEl: dom.selectSearchInput,
      batchButtonEl: dom.selectBatchExecBtn,
      paginationTopEl: dom.selectPaginationTop,
      paginationBottomEl: dom.selectPaginationBottom,
      pageSize: getPageSize(),
      adapterOptions: { formatTime: formatTime },
      onAssociation: function(file) {
        associationWorkflowController.openFromSelect(file);
      },
      onExec: function(file) {
        if (selectExecDrawerControllerInstance) selectExecDrawerControllerInstance.execFile(file);
      },
      onStateChange: function(snapshot) {
        if (selectExecDrawerControllerInstance) selectExecDrawerControllerInstance.syncListState(snapshot);
      },
    });
    return selectExecControllerInstance;
  }

  function setStatus(el, text, type) {
    var coreApi = getCore();
    var setter = coreApi.setStatus || utils.setStatus;
    if (typeof setter === 'function') {
      setter(el, text, type);
      return;
    }
    if (!el) return;
    el.textContent = text || '';
    el.className = ['status', type || ''].filter(Boolean).join(' ');
  }

  function showCenterToast(text, type, durationMs) {
    var appUtils = window.app && window.app.utils ? window.app.utils : utils;
    if (appUtils && typeof appUtils.showCenterToast === 'function') {
      appUtils.showCenterToast(text, type, durationMs);
      return;
    }
  }

  function escapeHtml(text) {
    if (utils && typeof utils.escapeHtml === 'function') return utils.escapeHtml(text);
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeHtmlPreserve(text) {
    if (utils && typeof utils.escapeHtmlPreserve === 'function') return utils.escapeHtmlPreserve(text);
    return escapeHtml(text).replace(/\n/g, '<br/>');
  }

  function refreshCaseFileListsByProject(projectId) {
    if (!projectId) return Promise.resolve();
    if (!apiClient || typeof apiClient.listCaseFiles !== 'function') return Promise.resolve();
    return apiClient.listCaseFiles(projectId).then(function(files) {
      var list = Array.isArray(files) ? files : [];
      if (state.editDrawer.projectId && String(state.editDrawer.projectId) === String(projectId)) {
        setEditListControllerData(list, null, {
          projectId: projectId,
          execByFileId: state.editDrawer.execByFileId,
        });
      }
      var selectController = ensureSelectExecController();
      var selectState = selectController ? selectController.getState() : null;
      if (selectState && selectState.projectId && String(selectState.projectId) === String(projectId)) {
        selectController.setData(list, {
          projectId: projectId,
          projectNameById: state.projectNameById,
          versionNameByProject: state.versionNameByProject,
          validVersionIds: (state.versionsByProject[projectId] || []).map(function(version) { return version && version.id; }),
        });
      }
      var editorFile = state.editor && state.editor.caseFile ? state.editor.caseFile : null;
      if (editorFile && String(editorFile.project_id || '') === String(projectId || '')) {
        var name = editorFile.file_name_clean || '';
        var next = list.find(function(cf) { return cf && String(cf.file_name_clean || '') === String(name || ''); });
        if (next && next.id && apiClient && typeof apiClient.listCaseItems === 'function') {
          state.editor.caseFile = next;
          return apiClient.listCaseItems(next.id).then(function(items) {
            state.editor.items = Array.isArray(items) ? items : [];
            renderEditorCard();
          });
        }
      }
    });
  }

  function formatTime(value) {
    if (!value) return '--';
    function normalizeTimeInput(input) {
      if (!input) return '';
      if (typeof input === 'number') return input;
      var raw = String(input || '').trim();
      if (!raw) return '';
      // 兼容 SQLite/Pydantic 输出：若时间不含时区信息，默认按 UTC 解释（避免展示少 8 小时）。
      if (raw.indexOf('T') === -1 && raw.indexOf(' ') !== -1) {
        raw = raw.replace(' ', 'T');
      }
      raw = raw.replace(/(\.\d{3})\d+/, '$1');
      raw = raw.replace(/([+-]\d{2}):(\d{2})$/, '$1$2');
      var hasTz = /Z$/i.test(raw) || /[+-]\d{2}\d{2}$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw);
      var isIsoWithTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw);
      if (isIsoWithTime && !hasTz) raw += 'Z';
      return raw;
    }
    try {
      var normalized = normalizeTimeInput(value);
      var d = typeof normalized === 'number' ? new Date(normalized) : new Date(normalized || value);
      if (!d || isNaN(d.getTime())) return String(value || '--');
      return d.toLocaleString();
    } catch (e) {
      return String(value || '--');
    }
  }

		  function normalizeName(value) {
	    return String(value || '').trim().toLowerCase();
	  }

	  var INVISIBLE_MARKER_RE = /[\u200b\u200c\u200d\u2060\ufeff]/g;
	  var INVISIBLE_MARKER_SET = ['\u200b', '\u200c', '\u200d', '\u2060', '\ufeff'];

	  function stripInvisibleMarkers(value) {
	    if (value === null || value === undefined) return '';
	    try {
	      return String(value).replace(INVISIBLE_MARKER_RE, '');
	    } catch (err) {
	      return '';
	    }
	  }

  function normalizeEditorText(value) {
    return stripInvisibleMarkers(value).trim();
  }

  function moveInlineEditorCaretToEnd(el) {
    if (!el || typeof window === 'undefined') return;
    if (document.activeElement !== el) return;
    if (!document.createRange || !window.getSelection) return;
    try {
      var range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      var selection = window.getSelection();
      if (!selection) return;
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (err) {
      // ignore
    }
  }

  function getMindElixirApi() {
    return window.app && window.app.mindElixirCoreApi ? window.app.mindElixirCoreApi : null;
  }

  function waitForCaseLibraryCondition(checker, timeoutMs, intervalMs) {
    var timeout = Number(timeoutMs);
    if (!isFinite(timeout) || timeout <= 0) timeout = 5000;
    var interval = Number(intervalMs);
    if (!isFinite(interval) || interval <= 0) interval = 80;
    return new Promise(function(resolve) {
      var done = false;
      var started = Date.now();
      var timer = setInterval(function() {
        if (done) return;
        var ok = false;
        try {
          ok = checker && checker() === true;
        } catch (err) {
          ok = false;
        }
        if (ok) {
          done = true;
          clearInterval(timer);
          resolve(true);
          return;
        }
        if (Date.now() - started >= timeout) {
          done = true;
          clearInterval(timer);
          resolve(false);
        }
      }, interval);
    });
  }

  function openEditorForImportedWriterCase(caseFile, projectId, cleanName) {
    var pid = normalizeId(projectId || (caseFile && caseFile.project_id ? caseFile.project_id : ''));
    if (!pid) return Promise.resolve(false);
    if (!editDrawerInstance || typeof editDrawerInstance.open !== 'function') return Promise.resolve(false);
    return ensureProjectsReady()
      .then(function() {
        editDrawerInstance.open();
        return editDrawerOpenPromise;
      })
      .then(function() {
        if (dom.editDrawerProjectSelect) dom.editDrawerProjectSelect.value = String(pid);
        if (caseFile && caseFile.version_id && dom.editDrawerVersionSelect) {
          state.editDrawer.versionId = normalizeId(caseFile.version_id);
        }
        state.editDrawer.projectId = pid;
        loadEditDrawerFiles();
        return waitForCaseLibraryCondition(function() {
          return Boolean(!state.editDrawer.loading);
        }, 5000, 90);
      })
      .then(function() {
        var target = null;
        if (caseFile && caseFile.id) target = findCaseFileInEditDrawer(caseFile.id);
        if (!target && cleanName) {
          var files = Array.isArray(state.editDrawer.files) ? state.editDrawer.files : [];
          target = files.find(function(f) {
            return f && String(f.file_name_clean || '') === String(cleanName || '');
          }) || null;
        }
        if (!target) return false;
        openEditorForCaseFile(target);
        return true;
      })
      .catch(function() {
        return false;
      });
  }

  function buildInvisibleMarker(seed) {
	    var raw = '';
	    try {
	      raw = String(seed || '') + '|' + Date.now().toString(16) + '|' + Math.random().toString(16).slice(2);
	    } catch (e) {
	      raw = Date.now().toString(16) + '|' + Math.random().toString(16).slice(2);
	    }
	    var out = '';
	    for (var i = 0; i < raw.length; i += 1) {
	      var code = raw.charCodeAt(i);
	      out += INVISIBLE_MARKER_SET[code % INVISIBLE_MARKER_SET.length];
	    }
	    return out || INVISIBLE_MARKER_SET[0];
	  }

  function clampPageSize(value) {
    var n = Number(value);
    if (!isFinite(n) || n <= 0) return 20;
    if (n < 5) return 5;
    if (n > 200) return 200;
    return Math.floor(n);
  }

  function getPageSize() {
    var globalState = window.app && window.app.state ? window.app.state : {};
    return clampPageSize(globalState.tempExecPageSize || 20);
  }

  function cleanCaseFileName(name) {
    var raw = name || '';
    var base = raw.split(/[\\/]/).pop() || raw;
    var xmindApi = window.app && window.app.xmindCoreApi ? window.app.xmindCoreApi : null;
    var cleaned = '';
    if (xmindApi && typeof xmindApi.getSafeFileBaseName === 'function') {
      cleaned = xmindApi.getSafeFileBaseName(base, 'case');
    } else {
      cleaned = base.replace(/\.[^.]+$/, '');
      var pattern = /(_result)?_\d{8}(?:_?\d{6})?$/i;
      while (pattern.test(cleaned)) cleaned = cleaned.replace(pattern, '');
    }
    cleaned = String(cleaned || '').replace(/^勾选用例[\s_\-\u2010-\u2015\u2212\uFE63\uFF0D]*/i, '');
    cleaned = cleaned.trim().replace(/^[_-]+|[_-]+$/g, '');
    return cleaned || 'case';
  }

  function extFromFileName(name) {
    var ext = (String(name || '').split('.').pop() || '').toLowerCase();
    return ext ? ('file:' + ext) : 'file';
  }

  function getDownloadBlob() {
    if (utils && typeof utils.downloadBlob === 'function') return utils.downloadBlob;
    var coreApi = getCore();
    if (coreApi && typeof coreApi.downloadBlob === 'function') return coreApi.downloadBlob;
    return function() {};
  }

  function sanitizeDownloadName(base, ext) {
    var name = String(base || '').trim() || '用例';
    name = name.replace(/\.[^.]+$/, '');
    name = name.replace(/[\\/:*?"<>|]/g, '_').trim();
    if (!name) name = '用例';
    return name + (ext || '');
  }

  function escapeXmlText(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function escapeXmlTextPreserve(text) {
    var escaped = escapeXmlText(text);
    escaped = escaped.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return escaped.replace(/\n/g, '&#10;');
  }

  function getCurrentUserId() {
    var globalState = window.app && window.app.state ? window.app.state : null;
    var user = globalState && globalState.currentUser ? globalState.currentUser : null;
    var userId = user && user.id !== undefined && user.id !== null ? user.id : null;
    if (!userId || String(userId) === '0') return null;
    return userId;
  }

  function getCurrentUsername() {
    var globalState = window.app && window.app.state ? window.app.state : null;
    var user = globalState && globalState.currentUser ? globalState.currentUser : null;
    var name = user && user.username ? String(user.username) : '';
    return name.trim();
  }

  function normalizeEditDrawerOwnerFilter(value) {
    return editListModelOwner.normalizeOwnerFilter(value);
  }

  function syncEditDrawerOwnerFilterOptions() {
    if (!dom.editDrawerOwnerFilterSelect) return;
    var username = getCurrentUsername();
    dom.editDrawerOwnerFilterSelect.innerHTML =
      '<option value="all">全部</option>' +
      '<option value="shared">其他项目导入</option>' +
      '<option value="me">' + escapeHtml(username || '我') + '</option>';
    var desired = normalizeEditDrawerOwnerFilter(state.editDrawer && state.editDrawer.ownerFilter ? state.editDrawer.ownerFilter : 'all');
    var touched = state.editDrawer && state.editDrawer.ownerFilterTouched ? true : false;
    // 未手动选择时，默认“全部”，避免继承旧默认“仅自己”造成误过滤。
    if (!touched && desired === 'me') desired = 'all';
    // 若未登录或拿不到用户信息，则默认“全部”，避免误过滤导致列表为空。
    if (!username && desired === 'me') desired = 'all';
    state.editDrawer.ownerFilter = desired;
    dom.editDrawerOwnerFilterSelect.value = desired;
  }

  function syncEditDrawerChangeVersionOptions(projectId) {
    if (!dom.editDrawerChangeVersionSelect) return;
    var pid = projectId || (state.editDrawer ? state.editDrawer.projectId : null);
    if (!pid) {
      dom.editDrawerChangeVersionSelect.disabled = true;
      dom.editDrawerChangeVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
      dom.editDrawerChangeVersionSelect.value = '';
      if (state.editDrawer) state.editDrawer.changeVersionId = null;
      return;
    }
    var list = pid && state.versionsByProject[pid] ? state.versionsByProject[pid] : [];
    syncVersionOptions(dom.editDrawerChangeVersionSelect, pid, '请选择版本');
    var desired = normalizeId(state.editDrawer && state.editDrawer.changeVersionId ? state.editDrawer.changeVersionId : '');
    var exists = desired && list.some(function(v) { return v && String(v.id) === String(desired); });
    if (!exists) desired = null;
    if (state.editDrawer) state.editDrawer.changeVersionId = desired;
    dom.editDrawerChangeVersionSelect.value = desired ? String(desired) : '';
    dom.editDrawerChangeVersionSelect.disabled = !list.length;
  }

	  function clampBatchAddCount(value) {
	    var n = Number(value);
	    if (!isFinite(n)) return 5;
	    n = Math.floor(n);
	    if (n < 1) n = 1;
	    if (n > 10) n = 10;
	    return n;
	  }

	  function persistEditorBatchAddCount(count) {
	    var userId = getCurrentUserId();
	    writeEditorBatchAddCountPersistedState({
	      user_id: userId || null,
	      count: clampBatchAddCount(count),
	      updated_at: Date.now(),
	    });
	  }

	  function restoreEditorBatchAddCountFromPersistedState() {
	    var persisted = readEditorBatchAddCountPersistedState();
	    if (!persisted || typeof persisted !== 'object') return;
	    var userId = getCurrentUserId();
	    var persistedUser = persisted.user_id !== null && persisted.user_id !== undefined ? String(persisted.user_id) : '';
	    if (userId && persistedUser && persistedUser !== String(userId)) return;
	    state.editor.batchAddCount = clampBatchAddCount(persisted.count);
	  }

  function persistImportDrawerState(nextProjectId, nextVersionId) {
    var userId = getCurrentUserId();
    if (!userId) return;
    // 若传入为空，默认不覆盖旧值，避免误把“初始化空值”写回导致无法恢复。
    var persisted = readImportDrawerPersistedState();
    if (persisted && String(persisted.user_id || '') !== String(userId)) {
      persisted = null;
    }
    var projectId = nextProjectId || (persisted ? normalizeId(persisted.project_id) : null);
    var versionId = nextVersionId || (persisted ? normalizeId(persisted.version_id) : null);
    if (!projectId) return;
    writeImportDrawerPersistedState({
      user_id: userId,
      project_id: projectId || '',
      version_id: versionId || '',
      saved_at: Date.now(),
    });
  }

  function restoreImportDrawerFromPersistedState() {
    if (!isAuthReady()) return Promise.resolve(false);
    var persisted = readImportDrawerPersistedState();
    if (!persisted) return Promise.resolve(false);
    var userId = getCurrentUserId();
    if (!userId || String(persisted.user_id || '') !== String(userId)) return Promise.resolve(false);

    var projectId = normalizeId(persisted.project_id);
    var versionId = normalizeId(persisted.version_id);
    if (!projectId) return Promise.resolve(false);

    var hasProject = (state.projects || []).some(function(p) { return p && String(p.id) === String(projectId); });
    if (!hasProject) return Promise.resolve(false);

    state.importDrawer.projectId = projectId;
    state.importDrawer.versionId = null;
    if (dom.importProjectSelect) dom.importProjectSelect.value = String(projectId);

    if (!dom.importVersionSelect) {
      syncImportConfirmEnabled();
      return Promise.resolve(true);
    }

    dom.importVersionSelect.disabled = true;
    dom.importVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
    dom.importVersionSelect.value = '';
    syncImportConfirmEnabled();

    return loadVersions(projectId)
      .then(function() {
        syncVersionOptions(dom.importVersionSelect, projectId, '请选择版本', true);
        dom.importVersionSelect.disabled = false;
        if (versionId) {
          // 仅当版本存在于下拉选项时才回填。
          var ok = (state.versionsByProject[projectId] || []).some(function(v) { return v && String(v.id) === String(versionId); });
          if (ok) {
            dom.importVersionSelect.value = String(versionId);
            state.importDrawer.versionId = versionId;
          }
        }
        syncImportConfirmEnabled();
        return true;
      })
      .catch(function() {
        // 恢复失败不影响抽屉使用
        return false;
      });
  }

  function persistEditorSelection(caseFile) {
    if (!caseFile || caseFile.id === null || caseFile.id === undefined) return;
    var userId = getCurrentUserId();
    if (!userId) return;
    var payload = {
      user_id: userId,
      project_id: caseFile.project_id,
      case_file_id: caseFile.id,
      saved_at: Date.now(),
    };
    writeEditorPersistedState(payload);
  }

  function persistCaseLibraryLastView(viewName) {
    var view = String(viewName || '').trim();
    if (view !== 'editor' && view !== 'history' && view !== 'missing') return;
    var userId = getCurrentUserId();
    var loginSeq = getCurrentLoginSeq();
    if (!userId && !loginSeq) return;
    writeCaseLibraryLastViewPersistedState({
      user_id: userId || '',
      login_seq: loginSeq || '',
      view: view,
      saved_at: Date.now(),
    });
  }

  function persistMissingViewSelection() {
    var userId = getCurrentUserId();
    var loginSeq = getCurrentLoginSeq();
    if (!userId && !loginSeq) return;
    var projectId = state.missingView && state.missingView.projectId ? normalizeId(state.missingView.projectId) : null;
    var modules = state.missingView && Array.isArray(state.missingView.modules) ? state.missingView.modules : [];
    var moduleIds = modules.map(function(m) {
      return m && m.id !== null && m.id !== undefined ? String(m.id) : '';
    }).filter(function(v) { return v; });
    if (!projectId || !moduleIds.length) {
      clearMissingViewPersistedState();
      return;
    }
    writeMissingViewPersistedState({
      user_id: userId || '',
      login_seq: loginSeq || '',
      project_id: projectId || '',
      module_ids: moduleIds,
      saved_at: Date.now(),
    });
  }

  function persistMissingDrawerProject(projectId) {
    var userId = getCurrentUserId();
    var loginSeq = getCurrentLoginSeq();
    if (!userId && !loginSeq) return;
    var pid = normalizeId(projectId);
    if (!pid) {
      clearMissingDrawerPersistedState();
      return;
    }
    writeMissingDrawerPersistedState({
      user_id: userId || '',
      login_seq: loginSeq || '',
      project_id: pid || '',
      saved_at: Date.now(),
    });
  }

  function persistSelectDrawerState(opts) {
    opts = opts || {};
    var userId = getCurrentUserId();
    if (!userId) return;
    var controller = ensureSelectExecController();
    var controllerState = controller ? controller.getState() : {};
    var projectId = opts.projectId !== undefined ? normalizeId(opts.projectId) : normalizeId(controllerState.projectId);
    var versionId = opts.versionId !== undefined ? normalizeId(opts.versionId) : normalizeId(controllerState.versionId);
    writeSelectDrawerPersistedState({
      user_id: userId,
      project_id: projectId || '',
      version_id: versionId || '',
      saved_at: Date.now(),
    });
  }

  function persistEditDrawerState(opts) {
    opts = opts || {};
    var userId = getCurrentUserId();
    if (!userId) return;
    var projectId = state.editDrawer && state.editDrawer.projectId ? state.editDrawer.projectId : null;
    var versionId = state.editDrawer && state.editDrawer.versionId ? state.editDrawer.versionId : null;
    var ownerFilter = normalizeEditDrawerOwnerFilter(state.editDrawer && state.editDrawer.ownerFilter ? state.editDrawer.ownerFilter : 'all');
    var ownerFilterTouched = state.editDrawer && state.editDrawer.ownerFilterTouched ? true : false;
    var selection = state.editDrawer && state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
    state.editDrawer.selection = selection;
    // 保护：避免“初始化/刷新期间 state 为空”时把已持久化的选择覆盖成空，导致无法恢复。
    if (!opts.force_clear && !projectId) {
      var existing = readEditDrawerPersistedState();
      if (existing && String(existing.user_id || '') === String(userId)) {
        var existingProjectId = normalizeId(existing.project_id);
        if (existingProjectId) projectId = existingProjectId;
        var existingVersionId = normalizeId(existing.version_id);
        if (!versionId && existingVersionId) versionId = existingVersionId;
        var existingOwnerFilter = normalizeEditDrawerOwnerFilter(existing.owner_filter || '');
        var existingOwnerFilterTouched = Boolean(existing.owner_filter_touched);
        if (!ownerFilterTouched && existingOwnerFilterTouched) {
          ownerFilter = existingOwnerFilter;
          ownerFilterTouched = true;
        }
        if (!selection.size && Array.isArray(existing.selected_ids) && existing.selected_ids.length) {
          selection = new Set(existing.selected_ids.map(function(v) { return String(v); }));
          state.editDrawer.selection = selection;
        }
      }
    }
    var payload = {
      user_id: userId,
      project_id: projectId || '',
      version_id: versionId || '',
      owner_filter: ownerFilter,
      owner_filter_touched: Boolean(ownerFilterTouched),
      selected_ids: Array.from(selection),
      drawer_open: Boolean(opts.drawer_open),
      saved_at: Date.now(),
    };
    writeEditDrawerPersistedState(payload);
  }

  function restoreEditDrawerFromPersistedState() {
    if (!isAuthReady()) return Promise.resolve(false);
    if (state.editDrawer && state.editDrawer.restoring === true) return Promise.resolve(false);
    var persisted = readEditDrawerPersistedState();
    if (!persisted) return Promise.resolve(false);
    var userId = getCurrentUserId();
    if (!userId || String(persisted.user_id || '') !== String(userId)) return Promise.resolve(false);
    var projectId = normalizeId(persisted.project_id);
    var versionId = normalizeId(persisted.version_id);
    var ownerFilter = normalizeEditDrawerOwnerFilter(persisted.owner_filter || '');
    var ownerFilterTouched = Boolean(persisted.owner_filter_touched);
    if (!ownerFilterTouched && ownerFilter === 'me') ownerFilter = 'all';
    var ids = Array.isArray(persisted.selected_ids) ? persisted.selected_ids.map(function(v) { return String(v); }) : [];
    if (!projectId) return Promise.resolve(false);

    state.editDrawer = state.editDrawer || {};
    state.editDrawer.restoring = true;
    state.editDrawer.projectId = projectId;
    state.editDrawer.versionId = versionId || null;
    state.editDrawer.ownerFilter = ownerFilter;
    state.editDrawer.ownerFilterTouched = ownerFilterTouched;
    state.editDrawer.selection = new Set(ids);
    state.editDrawer.pageIndex = 0;
    var controller = ensureEditListController();
    if (controller) {
      controller.setProject(projectId);
      controller.setOwnerFilter(ownerFilter, ownerFilterTouched);
      controller.setVersion(versionId || null);
      controller.setLoading({ projectId: projectId, preserveSelection: true });
    }
    if (dom.editDrawerProjectSelect) dom.editDrawerProjectSelect.value = String(projectId);
    if (dom.editDrawerVersionSelect) {
      dom.editDrawerVersionSelect.disabled = true;
      dom.editDrawerVersionSelect.innerHTML = '<option value=\"\">全部版本</option>';
      dom.editDrawerVersionSelect.value = '';
    }
    syncEditDrawerOwnerFilterOptions();

    return loadVersions(projectId)
      .then(function() {
        if (dom.editDrawerVersionSelect) {
          syncVersionOptions(dom.editDrawerVersionSelect, projectId, '全部版本');
          dom.editDrawerVersionSelect.disabled = false;
          if (versionId) dom.editDrawerVersionSelect.value = String(versionId);
          else dom.editDrawerVersionSelect.value = '';
        }
        syncEditDrawerChangeVersionOptions(projectId);
        var tasks = [apiClient.listCaseFiles(projectId)];
        if (apiClient && typeof apiClient.listExecSetsByCaseFile === 'function') {
          tasks.push(apiClient.listExecSetsByCaseFile(projectId));
        } else {
          tasks.push(Promise.resolve([]));
        }
        return Promise.all(tasks);
      })
      .then(function(res) {
        var files = Array.isArray(res && res[0]) ? res[0] : [];
        var execSets = Array.isArray(res && res[1]) ? res[1] : [];
        if (dom.editDrawerProjectSelect) dom.editDrawerProjectSelect.value = String(projectId);
        setEditListControllerData(files, execSets, {
          projectId: projectId,
          selectedIds: ids,
        });
        return true;
      })
      .catch(function(err) {
        console.error(err);
        return false;
      })
      .finally(function() {
        state.editDrawer.restoring = false;
      });
  }

  function isAuthReady() {
    if (window.app && window.app.authReady === true) return true;
    var globalState = window.app && window.app.state ? window.app.state : null;
    return Boolean(globalState && globalState.currentUser);
  }

  function isAdminUser() {
    if (!window.app || window.app.authReady !== true) return false;
    var globalState = window.app && window.app.state ? window.app.state : null;
    var user = globalState && globalState.currentUser ? globalState.currentUser : null;
    return Boolean(user && user.role === 'admin');
  }

  function getCurrentUser() {
    var globalState = window.app && window.app.state ? window.app.state : null;
    return globalState && globalState.currentUser ? globalState.currentUser : null;
  }

  function normalizeUserLevel(level) {
    if (!level && level !== 0) return '';
    var lower = String(level).toLowerCase();
    if (lower === '组长') return 'leader';
    if (lower === '组员') return 'member';
    return lower;
  }

  function isLeaderUser(user) {
    var level = user && user.level ? user.level : '';
    return normalizeUserLevel(level) === 'leader';
  }

  function canDeleteMissingModules() {
    var user = getCurrentUser();
    if (user && String(user.role || '') === 'admin') return true;
    return isLeaderUser(user);
  }

  function getTempExecApi() {
    return window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
  }

  function isExecDbEnabled() {
    if (!window.app || window.app.authReady !== true) return false;
    var globalState = window.app && window.app.state ? window.app.state : null;
    var user = globalState && globalState.currentUser ? globalState.currentUser : null;
    var userId = user && user.id !== undefined && user.id !== null ? user.id : null;
    if (!userId || String(userId) === '0') return false;
    return Boolean(
      apiClient &&
        typeof apiClient.listExecSets === 'function' &&
        typeof apiClient.listExecCases === 'function' &&
        typeof apiClient.upsertExecSetFromCaseFile === 'function' &&
        typeof apiClient.listCaseItems === 'function'
    );
  }

  function ensureDrawer(drawerId, openButtons, onOpen, onClose) {
    var openBtnIds = Array.isArray(openButtons) ? openButtons : [];
    var hasDrawerApi = Boolean(window.app && window.app.drawer && typeof window.app.drawer.createDrawer === 'function');
    if (hasDrawerApi) {
      return window.app.drawer.createDrawer({
        drawerId: drawerId,
        openButtons: openBtnIds,
        closeButtons: [],
        onOpen: typeof onOpen === 'function' ? onOpen : undefined,
        onClose: typeof onClose === 'function' ? onClose : undefined,
      });
    }

    // 兜底：极少数情况下静态资源加载抖动（例如 drawer.js 返回空响应）会导致抽屉 API 缺失；
    // 这里提供最小可用的 open/close，避免核心流程直接不可用。
    var drawer = drawerId ? document.getElementById(drawerId) : null;
    if (!drawer) return null;
    var panel = drawer.querySelector ? drawer.querySelector('.drawer-panel') : null;
    var mask = drawer.querySelector ? drawer.querySelector('.drawer-mask') : null;
    var bound = false;

    function open() {
      if (drawer.classList && drawer.classList.contains('closing')) drawer.classList.remove('closing');
      if (drawer.classList && !drawer.classList.contains('open')) drawer.classList.add('open');
      if (drawer.classList && drawer.classList.contains('hidden')) drawer.classList.remove('hidden');
      if (typeof onOpen === 'function') onOpen();
    }
    function close() {
      if (drawer.classList) drawer.classList.remove('open');
      if (typeof onClose === 'function') onClose();
    }
    function toggle() {
      if (drawer.classList && drawer.classList.contains('open')) close();
      else open();
    }
    function bindOnce() {
      if (bound) return;
      bound = true;
      openBtnIds.forEach(function(id) {
        var btn = document.getElementById(id);
        if (!btn || typeof btn.addEventListener !== 'function') return;
        btn.addEventListener('click', open);
      });
      if (mask && typeof mask.addEventListener === 'function') {
        mask.addEventListener('click', close);
      }
      if (panel && panel.querySelectorAll) {
        panel.querySelectorAll('[data-drawer-close]').forEach(function(node) {
          if (!node || typeof node.addEventListener !== 'function') return;
          node.addEventListener('click', close);
        });
      }
    }

    bindOnce();
    return { open: open, close: close, toggle: toggle, element: drawer };
  }

  function syncProjectOptions(selectEl, placeholder) {
    if (!selectEl) return;
    var list = Array.isArray(state.projects) ? state.projects : [];
    if (utils && typeof utils.sortProjectsByUserSettings === 'function') {
      list = utils.sortProjectsByUserSettings(list);
    }
    var options = ['<option value=\"\">' + escapeHtml(placeholder || '请选择项目') + '</option>'];
    state.projectNameById = {};
    list.forEach(function(p) {
      if (!p) return;
      state.projectNameById[p.id] = p.name || ('项目#' + p.id);
      options.push('<option value=\"' + escapeHtml(p.id) + '\">' + escapeHtml(state.projectNameById[p.id]) + '</option>');
    });
    selectEl.innerHTML = options.join('');
  }

  function syncVersionOptions(selectEl, projectId, placeholder, includeAdd) {
    if (!selectEl) return;
    var list = projectId && state.versionsByProject[projectId] ? state.versionsByProject[projectId] : [];
    var options = ['<option value=\"\">' + escapeHtml(placeholder || '请选择版本') + '</option>'];
    if (!state.versionNameByProject[projectId]) state.versionNameByProject[projectId] = {};
    (list || []).forEach(function(v) {
      if (!v) return;
      state.versionNameByProject[projectId][v.id] = v.name || ('版本#' + v.id);
      options.push('<option value=\"' + escapeHtml(v.id) + '\">' + escapeHtml(state.versionNameByProject[projectId][v.id]) + '</option>');
    });
    if (includeAdd) {
      if (utils && typeof utils.buildAddVersionOption === 'function') {
        options.push(utils.buildAddVersionOption('＋ 新增版本'));
      } else {
        options.push('<option value="__add_version__">＋ 新增版本</option>');
      }
    }
    selectEl.innerHTML = options.join('');
  }

  function syncVersionOptionsWithAll(selectEl, projectId) {
    if (!selectEl) return;
    var list = projectId && state.versionsByProject[projectId] ? state.versionsByProject[projectId] : [];
    var options = ['<option value=\"\">请选择版本</option>', '<option value=\"0\">全部版本</option>'];
    if (!state.versionNameByProject[projectId]) state.versionNameByProject[projectId] = {};
    (list || []).forEach(function(v) {
      if (!v) return;
      state.versionNameByProject[projectId][v.id] = v.name || ('版本#' + v.id);
      options.push('<option value=\"' + escapeHtml(v.id) + '\">' + escapeHtml(state.versionNameByProject[projectId][v.id]) + '</option>');
    });
    selectEl.innerHTML = options.join('');
  }

  function syncMissingModuleOptions(selectEl, modules, placeholder) {
    if (!selectEl) return;
    var list = Array.isArray(modules) ? modules : [];
    var options = ['<option value=\"\">' + escapeHtml(placeholder || '全部模块') + '</option>'];
    list.forEach(function(m) {
      if (!m) return;
      options.push('<option value=\"' + escapeHtml(m.id) + '\">' + escapeHtml(m.name || ('模块#' + m.id)) + '</option>');
    });
    selectEl.innerHTML = options.join('');
  }

  function syncMissingTypeOptions(selectEl, types, placeholder, includeAdd) {
    if (!selectEl) return;
    var list = Array.isArray(types) ? types : [];
    var options = ['<option value=\"\">' + escapeHtml(placeholder || '请选择类型') + '</option>'];
    list.forEach(function(t) {
      if (!t) return;
      options.push('<option value=\"' + escapeHtml(t.id) + '\">' + escapeHtml(t.name || ('类型#' + t.id)) + '</option>');
    });
    if (includeAdd !== false) {
      options.push('<option value=\"__add_type__\">＋ 新增类型</option>');
    }
    selectEl.innerHTML = options.join('');
  }

  function getMissingTypeNameById(typeId) {
    if (!typeId && typeId !== 0) return '';
    var list = Array.isArray(state.missingType.types) ? state.missingType.types : [];
    for (var i = 0; i < list.length; i += 1) {
      var t = list[i];
      if (t && String(t.id) === String(typeId)) return t.name || ('类型#' + t.id);
    }
    return '';
  }

  function normalizeMissingTypeSelection() {
    var list = Array.isArray(state.missingType.types) ? state.missingType.types : [];
    var selection = state.missingType.selection instanceof Set ? state.missingType.selection : new Set();
    var allow = {};
    list.forEach(function(t) {
      if (!t || t.id === null || t.id === undefined) return;
      allow[String(t.id)] = true;
    });
    var changed = false;
    selection.forEach(function(id) {
      if (!allow[String(id)]) {
        selection.delete(String(id));
        changed = true;
      }
    });
    state.missingType.selection = selection;
    return changed;
  }

  function normalizeMissingViewTypeFilters() {
    if (!state.missingView || !state.missingView.typeFilters) return;
    var filters = state.missingView.typeFilters instanceof Set ? state.missingView.typeFilters : new Set();
    if (!filters.size) {
      state.missingView.typeFilters = filters;
      return;
    }
    var allow = {};
    var list = Array.isArray(state.missingType.types) ? state.missingType.types : [];
    list.forEach(function(t) {
      if (!t || t.id === null || t.id === undefined) return;
      allow[String(t.id)] = true;
    });
    var changed = false;
    filters.forEach(function(id) {
      if (id === 'none') return;
      if (!allow[String(id)]) {
        filters.delete(id);
        changed = true;
      }
    });
    if (changed && !filters.size) {
      state.missingView.pageIndex = 0;
      state.missingView.selection = new Set();
    }
    state.missingView.typeFilters = filters;
  }

  function getVersionName(projectId, versionId) {
    if (!versionId) return '--';
    var map = projectId && state.versionNameByProject[projectId] ? state.versionNameByProject[projectId] : null;
    if (map && map[versionId]) return map[versionId];
    return '版本#' + versionId;
  }

  function loadProjects() {
    return apiClient.listProjects().then(function(list) {
      var importSelected = dom.importProjectSelect ? String(dom.importProjectSelect.value || '') : '';
      var editSelected = dom.editDrawerProjectSelect ? String(dom.editDrawerProjectSelect.value || '') : '';
      var selectSelected = dom.selectProjectSelect ? String(dom.selectProjectSelect.value || '') : '';
      var importSelectSelected = dom.importSelectProjectSelect ? String(dom.importSelectProjectSelect.value || '') : '';
      var historySelected = dom.historyDrawerProjectSelect ? String(dom.historyDrawerProjectSelect.value || '') : '';
      var missingSelected = dom.missingDrawerProjectSelect ? String(dom.missingDrawerProjectSelect.value || '') : '';
      var missingImportSelected = dom.missingImportProjectSelect ? String(dom.missingImportProjectSelect.value || '') : '';
      var projects = Array.isArray(list) ? list : [];
      if (utils && typeof utils.sortProjectsByUserSettings === 'function') {
        projects = utils.sortProjectsByUserSettings(projects);
      }
      state.projects = projects;
      syncProjectOptions(dom.importProjectSelect, '请选择项目');
      syncProjectOptions(dom.editDrawerProjectSelect, '请选择项目');
      syncProjectOptions(dom.selectProjectSelect, '请选择项目');
      syncProjectOptions(dom.importSelectProjectSelect, '请选择项目');
      syncProjectOptions(dom.historyDrawerProjectSelect, '请选择项目');
      syncProjectOptions(dom.missingDrawerProjectSelect, '请选择项目');
      syncProjectOptions(dom.missingImportProjectSelect, '请选择项目');
      // 仅刷新 option 列表，不强制清空用户已选项目；若新列表不含该值，浏览器会自动回到空值。
      if (dom.importProjectSelect && importSelected) dom.importProjectSelect.value = importSelected;
      if (dom.editDrawerProjectSelect && editSelected) dom.editDrawerProjectSelect.value = editSelected;
      if (dom.selectProjectSelect && selectSelected) dom.selectProjectSelect.value = selectSelected;
      if (dom.importSelectProjectSelect && importSelectSelected) dom.importSelectProjectSelect.value = importSelectSelected;
      if (dom.historyDrawerProjectSelect && historySelected) dom.historyDrawerProjectSelect.value = historySelected;
      if (dom.missingDrawerProjectSelect && missingSelected) dom.missingDrawerProjectSelect.value = missingSelected;
      if (dom.missingImportProjectSelect && missingImportSelected) dom.missingImportProjectSelect.value = missingImportSelected;
      return state.projects;
    });
  }

  function loadVersions(projectId) {
    if (!projectId) return Promise.resolve([]);
    if (state.versionsByProject[projectId]) return Promise.resolve(state.versionsByProject[projectId]);
    return apiClient.listProjectVersions(projectId).then(function(list) {
      state.versionsByProject[projectId] = Array.isArray(list) ? list : [];
      state.versionNameByProject[projectId] = {};
      (state.versionsByProject[projectId] || []).forEach(function(v) {
        if (!v) return;
        state.versionNameByProject[projectId][v.id] = v.name || ('版本#' + v.id);
      });
      return state.versionsByProject[projectId];
    });
  }

  function ensureProjectsReady() {
    if (state.projects && state.projects.length) return Promise.resolve(state.projects);
    setStatus(dom.status, '加载项目中...', '');
    return loadProjects()
      .then(function(list) {
        setStatus(dom.status, '', '');
        return list;
      })
      .catch(function(err) {
        setStatus(dom.status, err && err.message ? err.message : '加载项目失败', 'err');
        return [];
      });
  }

  function invalidateProjectsCache() {
    state.projects = [];
    state.projectNameById = {};
    state.versionsByProject = {};
    state.versionNameByProject = {};
    shareController.invalidateCatalog();
  }

  function bindProjectsUpdated() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('app-projects-updated', function() {
      invalidateProjectsCache();
      var globalState = window.app && window.app.state ? window.app.state : {};
      var tabName = globalState && globalState.activeTab ? globalState.activeTab : '';
      if (tabName === 'case-library' && isAuthReady()) {
        ensureProjectsReady()
          .then(function() {
            return restoreCaseLibraryLastSelection();
          })
          .then(function(view) {
            var persisted = readEditDrawerPersistedState();
            var userId = getCurrentUserId();
            var shouldOpen = Boolean(persisted && userId && String(persisted.user_id || '') === String(userId) && persisted.drawer_open === true);
            if (view === 'editor' && shouldOpen && editDrawerInstance && typeof editDrawerInstance.open === 'function') {
              editDrawerInstance.open();
            }
          });
      }
    });
  }

  function normalizeId(value) {
    if (value === null || value === undefined) return null;
    if (value === '') return null;
    var n = Number(value);
    return isNaN(n) ? null : n;
  }

  function normalizeMissingTypeId(value) {
    var n = normalizeId(value);
    if (!isFinite(n) || n <= 0) return null;
    return n;
  }

  function normalizeMissingTypeIds(values) {
    if (!Array.isArray(values)) {
      values = values === null || values === undefined ? [] : [values];
    }
    var result = [];
    var seen = {};
    values.forEach(function(raw) {
      var val = normalizeMissingTypeId(raw);
      if (!val) return;
      var key = String(val);
      if (seen[key]) return;
      seen[key] = true;
      result.push(val);
    });
    return result;
  }

  function ensureMissingItemTypeSlots(item) {
    if (!item || typeof item !== 'object') return [''];
    var raw = Array.isArray(item.type_ids) ? item.type_ids : [];
    if (!raw.length && item.type_id !== null && item.type_id !== undefined && item.type_id !== '') {
      raw = [item.type_id];
    }
    var slots = [];
    raw.forEach(function(val) {
      if (val === null || val === undefined) return;
      slots.push(String(val));
    });
    if (!slots.length) slots.push('');
    if (slots.length > 3) slots = slots.slice(0, 3);
    item.type_ids = slots;
    return slots;
  }

  function collectMissingItemTypeIds(item) {
    var slots = ensureMissingItemTypeSlots(item);
    var ids = normalizeMissingTypeIds(slots);
    if (ids.length > 3) ids = ids.slice(0, 3);
    return ids;
  }

  function resolveMissingItemTypeNames(typeIds, fallbackNames) {
    var list = Array.isArray(typeIds) ? typeIds : [];
    var fallback = Array.isArray(fallbackNames) ? fallbackNames : [];
    var names = [];
    for (var i = 0; i < list.length; i += 1) {
      var id = list[i];
      var name = getMissingTypeNameById(id);
      if (!name && fallback[i]) name = fallback[i];
      if (!name && id !== null && id !== undefined && id !== '') name = '类型#' + id;
      names.push(name || '');
    }
    return names;
  }

  function formatMissingItemTypeLabel(item) {
    if (!item || typeof item !== 'object') return '未分类';
    var typeIds = normalizeMissingTypeIds(item.type_ids);
    if (!typeIds.length && item.type_id) {
      typeIds = normalizeMissingTypeIds([item.type_id]);
    }
    if (!typeIds.length) return '未分类';
    var names = resolveMissingItemTypeNames(
      typeIds,
      item.type_names || (item.type_name ? [item.type_name] : [])
    );
    var filtered = names.filter(function(name) { return name; });
    if (!filtered.length) return '未分类';
    return filtered.join('、');
  }

  function normalizeMissingItemTypeData(item) {
    if (!item || typeof item !== 'object') return item;
    ensureMissingItemTypeSlots(item);
    if (!Array.isArray(item.type_names)) {
      item.type_names = item.type_name ? [item.type_name] : [];
    }
    return item;
  }

  function syncImportConfirmEnabled() {
    if (!dom.importConfirmBtn) return;
    var s = state.importDrawer;
    dom.importConfirmBtn.disabled = !(s.files && s.files.length && s.projectId && s.versionId) || s.loading;
  }

  function renderImportFileHint() {
    if (!dom.importFileHint) return;
    var files = state.importDrawer.files || [];
    if (!files.length) {
      dom.importFileHint.textContent = '未选择文件';
      return;
    }
    var names = files.map(function(f) { return f && f.name ? f.name : '文件'; });
    var head = names.slice(0, 2).join('、');
    dom.importFileHint.textContent = names.length > 2 ? ('已选择 ' + names.length + ' 个：' + head + '...') : ('已选择：' + head);
  }

  function resetImportDrawer() {
    state.importDrawer.files = [];
    state.importDrawer.projectId = null;
    state.importDrawer.versionId = null;
    state.importDrawer.loading = false;
    renderImportFileHint();
    setStatus(dom.importStatus, '', '');
    syncProjectOptions(dom.importProjectSelect, '请选择项目');
    if (dom.importProjectSelect) dom.importProjectSelect.value = '';
    if (dom.importVersionSelect) {
      dom.importVersionSelect.disabled = true;
      dom.importVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
      dom.importVersionSelect.value = '';
    }
    syncImportConfirmEnabled();
    return restoreImportDrawerFromPersistedState();
  }

  function handleImportFiles(files) {
    state.importDrawer.files = Array.from(files || []).filter(Boolean);
    renderImportFileHint();
    syncImportConfirmEnabled();
    setStatus(dom.importStatus, state.importDrawer.files.length ? '已选择文件，请继续选择项目与版本' : '未选择文件', state.importDrawer.files.length ? '' : 'warn');
  }

  function handleImportProjectChange() {
    var projectId = normalizeId(dom.importProjectSelect ? dom.importProjectSelect.value : '');
    state.importDrawer.projectId = projectId;
    state.importDrawer.versionId = null;
    if (projectId) persistImportDrawerState(projectId, null);
    syncImportConfirmEnabled();
    if (!dom.importVersionSelect) return;
    dom.importVersionSelect.disabled = true;
    dom.importVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
    if (!projectId) return;
    setStatus(dom.importStatus, '加载版本中...', '');
    loadVersions(projectId)
      .then(function() {
        syncVersionOptions(dom.importVersionSelect, projectId, '请选择版本', true);
        dom.importVersionSelect.disabled = false;
        setStatus(dom.importStatus, '', '');
      })
      .catch(function(err) {
        setStatus(dom.importStatus, err && err.message ? err.message : '加载版本失败', 'err');
      });
  }

  function handleImportVersionChange() {
    var raw = dom.importVersionSelect ? dom.importVersionSelect.value : '';
    if (utils && typeof utils.isAddVersionOption === 'function' && utils.isAddVersionOption(raw)) {
      var projectId = state.importDrawer.projectId;
      if (!projectId) {
        setStatus(dom.importStatus, '请先选择项目', 'warn');
        if (dom.importVersionSelect) dom.importVersionSelect.value = state.importDrawer.versionId || '';
        return;
      }
      if (!utils || typeof utils.openAddProjectVersionDrawer !== 'function') {
        setStatus(dom.importStatus, '新增版本组件未就绪，请刷新后重试', 'err');
        if (dom.importVersionSelect) dom.importVersionSelect.value = state.importDrawer.versionId || '';
        return;
      }
      var prevValue = state.importDrawer.versionId || '';
      if (dom.importVersionSelect) dom.importVersionSelect.value = prevValue ? String(prevValue) : '';
      if (dom.importVersionSelect) dom.importVersionSelect.disabled = true;
      if (dom.importConfirmBtn) dom.importConfirmBtn.disabled = true;
      var projectName = state.projectNameById && state.projectNameById[projectId]
        ? state.projectNameById[projectId]
        : ('项目#' + projectId);
      utils
        .openAddProjectVersionDrawer({
          projectId: projectId,
          projectName: projectName,
          previousDrawer: importDrawerInstance || null,
        })
        .then(function(res) {
          if (!res || res.ok !== true || !res.version) return;
          var list = state.versionsByProject[projectId];
          if (!Array.isArray(list)) list = [];
          var exists = list.some(function(v) { return v && String(v.id) === String(res.version.id); });
          if (!exists) list.unshift(res.version);
          state.versionsByProject[projectId] = list;
          if (!state.versionNameByProject[projectId]) state.versionNameByProject[projectId] = {};
          state.versionNameByProject[projectId][res.version.id] = res.version.name || ('版本#' + res.version.id);
          syncVersionOptions(dom.importVersionSelect, projectId, '请选择版本', true);
          if (dom.importVersionSelect) dom.importVersionSelect.value = String(res.version.id);
          state.importDrawer.versionId = normalizeId(res.version.id);
          if (state.importDrawer.projectId && state.importDrawer.versionId) {
            persistImportDrawerState(state.importDrawer.projectId, state.importDrawer.versionId);
          }
        })
        .finally(function() {
          if (dom.importVersionSelect) dom.importVersionSelect.disabled = false;
          syncImportConfirmEnabled();
        });
      return;
    }
    state.importDrawer.versionId = normalizeId(raw);
    if (state.importDrawer.projectId && state.importDrawer.versionId) {
      persistImportDrawerState(state.importDrawer.projectId, state.importDrawer.versionId);
    }
    syncImportConfirmEnabled();
  }

  function confirmImportToDb() {
    return importWorkflowController.confirm();
  }

  function resetEditDrawer() {
    var controller = ensureEditListController();
    if (controller) controller.reset();
    state.editDrawer.files = [];
    state.editDrawer.execByFileId = {};
    state.editDrawer.changeVersionId = null;
    setStatus(dom.editDrawerStatus, '', '');
    syncProjectOptions(dom.editDrawerProjectSelect, '请选择项目');
    if (dom.editDrawerProjectSelect) dom.editDrawerProjectSelect.value = '';
    if (dom.editDrawerVersionSelect) {
      dom.editDrawerVersionSelect.disabled = true;
      dom.editDrawerVersionSelect.innerHTML = '<option value=\"\">全部版本</option>';
      dom.editDrawerVersionSelect.value = '';
    }
    if (dom.editDrawerChangeVersionSelect) {
      dom.editDrawerChangeVersionSelect.disabled = true;
      dom.editDrawerChangeVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
      dom.editDrawerChangeVersionSelect.value = '';
    }
    syncEditDrawerOwnerFilterOptions();
    if (dom.editDrawerFileSearchInput) dom.editDrawerFileSearchInput.value = '';
    if (dom.editDrawerShareBtn) dom.editDrawerShareBtn.disabled = true;
    if (dom.editDrawerExportXmindBtn) dom.editDrawerExportXmindBtn.disabled = true;
    if (dom.editDrawerExportExcelBtn) dom.editDrawerExportExcelBtn.disabled = true;
    syncEditDrawerControls();
  }

  function handleEditDrawerVersionChange() {
    var controller = ensureEditListController();
    if (controller) controller.setVersion(normalizeId(dom.editDrawerVersionSelect ? dom.editDrawerVersionSelect.value : ''));
    updateEditDrawerLoadedStatus();
    persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
  }

  function handleEditDrawerChangeVersionSelectChange() {
    state.editDrawer.changeVersionId = normalizeId(dom.editDrawerChangeVersionSelect ? dom.editDrawerChangeVersionSelect.value : '');
    syncEditDrawerControls();
  }

  function handleEditDrawerOwnerFilterChange() {
    var controller = ensureEditListController();
    if (controller) {
      controller.setOwnerFilter(
        dom.editDrawerOwnerFilterSelect ? dom.editDrawerOwnerFilterSelect.value : '',
        true
      );
    }
    updateEditDrawerLoadedStatus();
    persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
  }

  function handleEditDrawerFileSearchInput() {
    if (!dom.editDrawerFileSearchInput) return;
    var controller = ensureEditListController();
    if (controller) controller.setSearch(dom.editDrawerFileSearchInput.value || '');
    updateEditDrawerLoadedStatus();
    persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
  }

  function updateEditDrawerLoadedStatus(list, force) {
    if (!dom.editDrawerStatus) return;
    if (!force && state.editDrawer.loading) return;
    var files = Array.isArray(list) ? list : getEditDrawerVisibleFiles();
    var totalItems = 0;
    files.forEach(function(f) {
      var count = Number(f && f.item_count);
      if (!Number.isFinite(count) || count < 0) count = 0;
      totalItems += count;
    });
    var fileCount = files.length;
    var msg = '已加载 ' + fileCount + ' 份用例文件，共' + totalItems + '条用例。';
    setStatus(dom.editDrawerStatus, msg, fileCount ? 'ok' : 'warn');
  }

  function getSelectedEditDrawerCaseFiles() {
    var controller = ensureEditListController();
    return controller ? controller.getSelectedFiles() : [];
  }

  function openShareDrawerFromSelection() {
    if (state.editDrawer.loading) return;
    var files = getSelectedEditDrawerCaseFiles();
    if (!files.length) {
      setStatus(dom.editDrawerStatus, '请先勾选要共享的用例文件', 'warn');
      return;
    }
    var first = files[0];
    safeLogOperation('open_share_case_file', 'case_file', first.id, {
      file_name: first.file_name_clean || '',
      selected_count: files.length,
    });
    if (!shareController.open(files, { previousDrawer: editDrawerInstance || null })) {
      setStatus(dom.editDrawerStatus, '共享抽屉不可用', 'warn');
    }
  }

  function exportEditDrawerSelectionToXmind() {
    if (state.editDrawer.loading) return;
    var files = getSelectedEditDrawerCaseFiles();
    if (!files.length) {
      setStatus(dom.editDrawerStatus, '请先勾选要导出的用例文件', 'warn');
      return;
    }
    var builder = getXmindBuilder();
    if (!builder) {
      setStatus(dom.editDrawerStatus, '缺少 XMind 导出依赖', 'err');
      return;
    }
    if (!apiClient || typeof apiClient.listCaseItems !== 'function') {
      setStatus(dom.editDrawerStatus, '后端用例条目接口未就绪', 'err');
      return;
    }
    var downloadBlob = getDownloadBlob();
    var zipCtor = (typeof JSZip !== 'undefined' ? JSZip : (window.JSZip ? window.JSZip : null));
    var isBatch = files.length > 1;
    var zip = isBatch && zipCtor ? new zipCtor() : null;
    var success = 0;
    var fail = 0;
    if (dom.editDrawerExportXmindBtn) dom.editDrawerExportXmindBtn.disabled = true;
    setStatus(dom.editDrawerStatus, (isBatch ? ('批量导出 XMind（' + files.length + '份）...') : '正在导出 XMind...'), '');

    var chain = Promise.resolve();
    files.forEach(function(f) {
      chain = chain.then(function() {
        var fallbackName = '';
        if (f) {
          fallbackName = f.file_name_clean || f.file_name || f.name || '';
        }
        var baseName = fallbackName ? String(fallbackName) : ('用例#' + (f && f.id ? f.id : ''));
        return apiClient
          .listCaseItems(f.id)
          .then(function(items) { return builder(items || [], baseName, ''); })
          .then(function(pkg) {
            if (!pkg || !pkg.blob) throw new Error('无导出内容');
            var fileName = sanitizeDownloadName(baseName, '.xmind');
            if (zip) {
              zip.file(fileName, pkg.blob);
            } else {
              downloadBlob(fileName, pkg.blob);
            }
            success += 1;
          })
          .catch(function(err) {
            fail += 1;
            console.error(err);
          });
      });
    });
    chain
      .then(function() {
        if (zip) {
          if (!success) throw new Error('全部导出失败');
          return zip.generateAsync({ type: 'blob' }).then(function(blob) {
            downloadBlob('用例批量导出_xmind.zip', blob);
          });
        }
        return null;
      })
      .then(function() {
        setStatus(dom.editDrawerStatus, '导出完成：成功 ' + success + ' 份，失败 ' + fail + ' 份', fail ? 'warn' : 'ok');
        if (success) {
          var fileNames = files
            .map(function(f) {
              if (!f) return '';
              return String(f.file_name_clean || f.file_name || f.name || '').trim();
            })
            .filter(Boolean);
          safeLogOperation('export_case_files_xmind', 'case_file', files.length === 1 ? files[0].id : null, {
            format: 'xmind',
            count: files.length,
            success: success,
            fail: fail,
            case_file_ids: files.map(function(f) { return f && f.id ? f.id : null; }).filter(function(v) { return v !== null; }),
            file_name: files.length === 1 && fileNames.length ? fileNames[0] : null,
            file_names: fileNames,
          });
        }
      })
      .catch(function(err) {
        setStatus(dom.editDrawerStatus, '导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      })
      .finally(function() {
        if (dom.editDrawerExportXmindBtn) dom.editDrawerExportXmindBtn.disabled = false;
      });
  }

  function exportEditDrawerSelectionToExcel() {
    if (state.editDrawer.loading) return;
    var files = getSelectedEditDrawerCaseFiles();
    if (!files.length) {
      setStatus(dom.editDrawerStatus, '请先勾选要导出的用例文件', 'warn');
      return;
    }
    if (!apiClient || typeof apiClient.listCaseItems !== 'function') {
      setStatus(dom.editDrawerStatus, '后端用例条目接口未就绪', 'err');
      return;
    }
    var downloadBlob = getDownloadBlob();
    var zipCtor = (typeof JSZip !== 'undefined' ? JSZip : (window.JSZip ? window.JSZip : null));
    var isBatch = files.length > 1;
    var zip = isBatch && zipCtor ? new zipCtor() : null;
    var success = 0;
    var fail = 0;
    if (dom.editDrawerExportExcelBtn) dom.editDrawerExportExcelBtn.disabled = true;
    setStatus(dom.editDrawerStatus, (isBatch ? ('批量导出 Excel（' + files.length + '份）...') : '正在导出 Excel...'), '');

    var chain = Promise.resolve();
    files.forEach(function(f) {
      chain = chain.then(function() {
        var fallbackName = '';
        if (f) {
          fallbackName = f.file_name_clean || f.file_name || f.name || '';
        }
        var baseName = fallbackName ? String(fallbackName) : ('用例#' + (f && f.id ? f.id : ''));
        return apiClient
          .listCaseItems(f.id)
          .then(function(items) { return buildCaseLibraryExcelBlob(items || [], baseName); })
          .then(function(blob) {
            var fileName = sanitizeDownloadName(baseName, '.xlsx');
            if (zip) {
              zip.file(fileName, blob);
            } else {
              downloadBlob(fileName, blob);
            }
            success += 1;
          })
          .catch(function(err) {
            fail += 1;
            console.error(err);
          });
      });
    });
    chain
      .then(function() {
        if (zip) {
          if (!success) throw new Error('全部导出失败');
          return zip.generateAsync({ type: 'blob' }).then(function(blob) {
            downloadBlob('用例批量导出_excel.zip', blob);
          });
        }
        return null;
      })
      .then(function() {
        setStatus(dom.editDrawerStatus, '导出完成：成功 ' + success + ' 份，失败 ' + fail + ' 份', fail ? 'warn' : 'ok');
        if (success) {
          var fileNames = files
            .map(function(f) {
              if (!f) return '';
              return String(f.file_name_clean || f.file_name || f.name || '').trim();
            })
            .filter(Boolean);
          safeLogOperation('export_case_files_excel', 'case_file', files.length === 1 ? files[0].id : null, {
            format: 'xlsx',
            count: files.length,
            success: success,
            fail: fail,
            case_file_ids: files.map(function(f) { return f && f.id ? f.id : null; }).filter(function(v) { return v !== null; }),
            file_name: files.length === 1 && fileNames.length ? fileNames[0] : null,
            file_names: fileNames,
          });
        }
      })
      .catch(function(err) {
        setStatus(dom.editDrawerStatus, '导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      })
      .finally(function() {
        if (dom.editDrawerExportExcelBtn) dom.editDrawerExportExcelBtn.disabled = false;
      });
  }

  function handleEditDrawerProjectChange() {
    var projectId = normalizeId(dom.editDrawerProjectSelect ? dom.editDrawerProjectSelect.value : '');
    var controller = ensureEditListController();
    if (controller) controller.setProject(projectId);
    state.editDrawer.files = [];
    state.editDrawer.execByFileId = {};
    state.editDrawer.changeVersionId = null;
    if (dom.editDrawerVersionSelect) {
      dom.editDrawerVersionSelect.disabled = true;
      dom.editDrawerVersionSelect.innerHTML = '<option value=\"\">全部版本</option>';
      dom.editDrawerVersionSelect.value = '';
    }
    if (dom.editDrawerChangeVersionSelect) {
      dom.editDrawerChangeVersionSelect.disabled = true;
      dom.editDrawerChangeVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
      dom.editDrawerChangeVersionSelect.value = '';
    }
    if (dom.editDrawerExportXmindBtn) dom.editDrawerExportXmindBtn.disabled = true;
    if (dom.editDrawerExportExcelBtn) dom.editDrawerExportExcelBtn.disabled = true;
    renderEditDrawerList();
    if (!projectId) {
      setStatus(dom.editDrawerStatus, '请先选择项目', 'warn');
      syncEditDrawerControls();
      persistEditDrawerState({
        drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')),
        force_clear: true,
      });
      return;
    }
    persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
    loadEditDrawerFiles();
  }

  function getEditDrawerVisibleFiles() {
    var controller = ensureEditListController();
    return controller ? controller.getVisibleFiles() : [];
  }

  function getEditDrawerPagedFiles() {
    var controller = ensureEditListController();
    if (!controller) return { page: resolveDrawerPage(0, 0), list: [], total: 0 };
    var page = controller.getPageData();
    return {
      page: page,
      list: controller.getPageRows(),
      total: page.total,
    };
  }

  function syncEditDrawerControls() {
    var controller = ensureEditListController();
    if (controller) controller.syncControls();
  }

  function renderEditDrawerList() {
    var controller = ensureEditListController();
    if (controller) controller.render();
  }

  function confirmEditDrawerChangeVersion() {
    if (state.editDrawer.loading) return;
    var projectId = normalizeId(dom.editDrawerProjectSelect ? dom.editDrawerProjectSelect.value : '');
    state.editDrawer.projectId = projectId;
    if (!projectId) {
      setStatus(dom.editDrawerStatus, '请先选择项目', 'warn');
      return;
    }
    var targetVersionId = normalizeId(dom.editDrawerChangeVersionSelect ? dom.editDrawerChangeVersionSelect.value : '');
    state.editDrawer.changeVersionId = targetVersionId;
    if (!targetVersionId) {
      setStatus(dom.editDrawerStatus, '请先选择更换版本', 'warn');
      syncEditDrawerControls();
      return;
    }
    var selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
    state.editDrawer.selection = selection;
    if (!selection.size) {
      setStatus(dom.editDrawerStatus, '请先勾选要更换版本的用例文件', 'warn');
      syncEditDrawerControls();
      return;
    }
    if (!apiClient || typeof apiClient.changeCaseFileVersion !== 'function') {
      setStatus(dom.editDrawerStatus, '后端更换版本接口未就绪', 'err');
      return;
    }

    var list = Array.isArray(state.editDrawer.files) ? state.editDrawer.files : [];
    var ids = Array.from(selection);
    var effectiveIds = [];
    ids.forEach(function(id) {
      var found = list.find(function(f) { return f && String(f.id) === String(id); });
      if (!found) return;
      if (String(found.version_id || '') === String(targetVersionId)) return;
      effectiveIds.push(String(id));
    });
    if (!effectiveIds.length) {
      setStatus(dom.editDrawerStatus, '所选用例已在目标版本', 'warn');
      return;
    }

    var versionName = getVersionName(projectId, targetVersionId);
    var confirmMsg = '是否确认把所选用例的版本更换版本为' + versionName + '？';
    openConfirmDrawer({
      title: '确认更换版本',
      message: confirmMsg,
      confirmText: '确认更换',
      cancelText: '取消',
      previousDrawer: editDrawerInstance || null,
    }).then(function(res) {
      if (!res || res.ok !== true) {
        setStatus(dom.editDrawerStatus, '已取消更换版本', 'warn');
        return;
      }
      var editController = ensureEditListController();
      if (editController) editController.setProcessing(true);
      setStatus(dom.editDrawerStatus, '更换版本中...', '');
      apiClient
        .changeCaseFileVersion({
          project_id: projectId,
          target_version_id: targetVersionId,
          case_file_ids: effectiveIds,
        })
        .then(function(resp) {
          var updatedIds = Array.isArray(resp && resp.updated_ids) ? resp.updated_ids : [];
          var skippedIds = Array.isArray(resp && resp.skipped_ids) ? resp.skipped_ids : [];
          var missingIds = Array.isArray(resp && resp.missing_ids) ? resp.missing_ids : [];
          var updatedSet = {};
          updatedIds.forEach(function(id) { updatedSet[String(id)] = true; });
          var nowText = new Date().toISOString();
          (state.editDrawer.files || []).forEach(function(f) {
            if (!f || f.id === null || f.id === undefined) return;
            if (!updatedSet[String(f.id)]) return;
            f.version_id = targetVersionId;
            f.updated_at = nowText;
          });
          setEditListControllerData(state.editDrawer.files || [], null, {
            projectId: projectId,
            execByFileId: state.editDrawer.execByFileId,
          });
          if (editController) editController.clearSelection();
          var msg = '更换版本完成：成功 ' + updatedIds.length + ' 份';
          if (skippedIds.length) msg += '，跳过 ' + skippedIds.length + ' 份';
          if (missingIds.length) msg += '，缺失 ' + missingIds.length + ' 份';
          setStatus(dom.editDrawerStatus, msg, missingIds.length ? 'warn' : 'ok');
        })
        .catch(function(err) {
          setStatus(dom.editDrawerStatus, err && err.message ? err.message : '更换版本失败', 'err');
        })
        .finally(function() {
          if (editController) editController.setProcessing(false);
          persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
        });
    });
  }

  function deleteSelectedCaseFiles() {
    if (state.editDrawer.loading) return;
    if (!isAdminUser()) {
      setStatus(dom.editDrawerStatus, '仅管理员可删除', 'warn');
      return;
    }
    var selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
    state.editDrawer.selection = selection;
    if (!selection.size) {
      setStatus(dom.editDrawerStatus, '请先勾选要删除的用例文件', 'warn');
      return;
    }
    if (!apiClient || typeof apiClient.deleteCaseFile !== 'function') {
      setStatus(dom.editDrawerStatus, '后端删除接口未就绪', 'err');
      return;
    }
    var ids = Array.from(selection);
    var list = Array.isArray(state.editDrawer.files) ? state.editDrawer.files : [];

    // 删除前强校验：只要存在于任意执行页（有人执行），必须先在执行页解散（删除执行集）再删库。
    var execByFileId = state.editDrawer.execByFileId && typeof state.editDrawer.execByFileId === 'object'
      ? state.editDrawer.execByFileId
      : {};
    var blocked = [];
    ids.forEach(function(id) {
      var key = String(id);
      var execInfo = execByFileId[key] ? execByFileId[key] : null;
      var activeUsers = execInfo && Array.isArray(execInfo.active_users) ? execInfo.active_users : [];
      if (activeUsers && activeUsers.length) {
        blocked.push({ id: key, activeUsers: activeUsers });
      }
    });
    if (blocked.length) {
      var lines = blocked.map(function(b) {
        var found = list.find(function(f) { return f && String(f.id) === String(b.id); });
        var name = found && found.file_name_clean ? String(found.file_name_clean) : ('文件#' + b.id);
        var usersText = (b.activeUsers || []).filter(Boolean).join('、') || '未知人员';
        return '- ' + name + '（' + usersText + '）';
      });
      var tip =
        '以下用例文件正在执行页中，解散前无法删除：\n' +
        lines.join('\n') +
        '\n\n请先通知正在执行人，在执行页面的分配页面中解散该份用例（移除/删除执行集），解散后再删除。';
      setStatus(dom.editDrawerStatus, '存在执行中用例，已阻止删除', 'warn');
      window.alert(tip);
      return;
    }

    var items = ids.map(function(id) {
      var found = list.find(function(f) { return f && String(f.id) === String(id); });
      var name = found && found.file_name_clean ? String(found.file_name_clean) : ('文件#' + id);
      var count = found && (found.item_count || found.item_count === 0) ? Number(found.item_count) : NaN;
      var countText = (isFinite(count) && count >= 0) ? (String(Math.floor(count)) + '条') : '?条';
      return { name: name, countText: countText };
    });
    var pairs = (items || []).map(function(it) {
      if (!it) return '';
      return String(it.name || '用例') + '，' + String(it.countText || '?条');
    }).filter(Boolean);
    var head = pairs.slice(0, 6).join('、');
    var suffix = pairs.length > 6 ? (' 等' + pairs.length + '份') : '';
    var confirmMsg = '是否确认删除用例：' + head + suffix + '？';
    openConfirmDrawer({
      title: '确认删除用例',
      message: confirmMsg,
      confirmText: '确认删除',
      cancelText: '取消',
      danger: true,
      previousDrawer: editDrawerInstance || null,
    }).then(function(res) {
      if (!res || res.ok !== true) return;
      var editController = ensureEditListController();
      if (editController) editController.setProcessing(true);
      setStatus(dom.editDrawerStatus, '删除中...', '');
      var success = 0;
      var fail = 0;
      var deletedIds = [];
      var chain = Promise.resolve();
      ids.forEach(function(id) {
        chain = chain.then(function() {
          return apiClient
            .deleteCaseFile(id)
            .then(function() {
              success += 1;
              deletedIds.push(String(id));
            })
            .catch(function(err) {
              fail += 1;
              var msg = err && err.message ? err.message : '删除失败';
              setStatus(dom.editDrawerStatus, '删除失败：' + msg, 'err');
            });
        });
      });
      chain.then(function() {
        var msg = '删除完成：成功 ' + success + ' 份，失败 ' + fail + ' 份';
        setStatus(dom.editDrawerStatus, msg, fail ? 'warn' : 'ok');
      }).finally(function() {
        if (deletedIds.length) {
          var deletedSet = new Set(deletedIds);
          state.editDrawer.files = (state.editDrawer.files || []).filter(function(f) {
            if (!f || f.id === null || f.id === undefined) return true;
            return !deletedSet.has(String(f.id));
          });
          // 若当前编辑视图正在编辑被删除的用例文件，需立即清空视图，避免误以为仍可编辑。
          var editorFile = state.editor && state.editor.caseFile ? state.editor.caseFile : null;
          if (editorFile && editorFile.id !== null && editorFile.id !== undefined) {
            if (deletedSet.has(String(editorFile.id))) {
              state.editor.caseFile = null;
              state.editor.items = [];
              state.editor.searchText = '';
              state.editor.pageIndex = 0;
              state.editor.selection = new Set();
              state.editor.remarkOpen = new Set();
              showEditorCard(false);
              syncCaseLibraryAiGenContext();
              clearEditorPersistedState();
              setStatus(dom.editStatus, '当前编辑用例已被删除', 'warn');
            }
          }
        }
        setEditListControllerData(state.editDrawer.files || [], null, {
          projectId: state.editDrawer.projectId,
          execByFileId: state.editDrawer.execByFileId,
        });
        if (editController) {
          editController.clearSelection();
          editController.setProcessing(false);
        }
      });
    });
  }

  function loadEditDrawerFiles() {
    var projectId = normalizeId(dom.editDrawerProjectSelect ? dom.editDrawerProjectSelect.value : '');
    var versionId = normalizeId(dom.editDrawerVersionSelect ? dom.editDrawerVersionSelect.value : '') ||
      normalizeId(state.editDrawer && state.editDrawer.versionId ? state.editDrawer.versionId : '');
    var controller = ensureEditListController();
    var controllerState = controller ? controller.getState() : null;
    if (controller && String(controllerState.projectId || '') !== String(projectId || '')) {
      controller.setProject(projectId);
      controllerState = controller.getState();
    }
    if (controller && String(controllerState.versionId || '') !== String(versionId || '')) {
      controller.setVersion(versionId);
    }
    state.editDrawer.files = [];
    state.editDrawer.execByFileId = {};
    if (!projectId) {
      setStatus(dom.editDrawerStatus, '请先选择项目', 'warn');
      return;
    }
    setStatus(dom.editDrawerStatus, '加载用例库...', '');
    if (controller) controller.setLoading({ projectId: projectId, preserveSelection: true });
    Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId), apiClient.listExecSetsByCaseFile(projectId)])
      .then(function(res) {
        var files = Array.isArray(res && res[0]) ? res[0] : [];
        var execSets = Array.isArray(res && res[2]) ? res[2] : [];
        if (dom.editDrawerVersionSelect) {
          syncVersionOptions(dom.editDrawerVersionSelect, projectId, '全部版本');
          dom.editDrawerVersionSelect.disabled = false;
          if (versionId) {
            dom.editDrawerVersionSelect.value = String(versionId);
          } else {
            dom.editDrawerVersionSelect.value = '';
          }
        }
        syncEditDrawerChangeVersionOptions(projectId);
        setEditListControllerData(files, execSets, { projectId: projectId });
        updateEditDrawerLoadedStatus(getEditDrawerVisibleFiles(), true);
      })
      .catch(function(err) {
        if (controller) {
          controller.setData([], {
            projectId: projectId,
            currentUserId: getCurrentUserId(),
            projectNameById: state.projectNameById,
            versionNameByProject: state.versionNameByProject,
          });
        }
        setStatus(dom.editDrawerStatus, err && err.message ? err.message : '加载失败', 'err');
      })
      .finally(function() {
        syncEditDrawerControls();
        persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
      });
  }

  function findCaseFileInEditDrawer(id) {
    var controller = ensureEditListController();
    return controller ? controller.findFile(id) : null;
  }

	  function openEditorForCaseFile(caseFile) {
	    if (!caseFile || !caseFile.id) return;
	    setStatus(dom.editDrawerStatus, '加载用例条目...', '');
	    apiClient.listCaseItems(caseFile.id).then(function(items) {
	      var baseItems = Array.isArray(items) ? items : [];
	      var execMeta = state.editDrawer.execByFileId && typeof state.editDrawer.execByFileId === 'object'
	        ? state.editDrawer.execByFileId[String(caseFile.id)]
	        : null;
	      var execSetId = execMeta && (execMeta.exec_set_id || execMeta.exec_set_id === 0)
	        ? Number(execMeta.exec_set_id)
	        : null;
	      if (!Number.isFinite(execSetId) || execSetId <= 0) execSetId = null;
	      var fallbackItems = reorderItemsByExistingModuleAppend(baseItems);
      var applyItems = function(nextItems) {
        // 保证视图互斥：切到编辑视图时，应隐藏“历史详情”卡片（但不清理其持久化，方便用户回退查看）。
        setHistoryDetailVisible(false);
        showMissingCard(false);
        state.editor.caseFile = caseFile;
	        state.editor.items = Array.isArray(nextItems) ? nextItems : [];
	        state.editor.searchText = '';
	        state.editor.pageIndex = 0;
	        state.editor.selection = new Set();
	        state.editor.remarkOpen = new Set();
	        setStatus(dom.editStatus, '已加载 ' + state.editor.items.length + ' 条用例，可直接编辑', 'ok');
      if (dom.editSearchInput) dom.editSearchInput.value = '';
      persistEditorSelection(caseFile);
      persistCaseLibraryLastView('editor');
      renderEditorCard();
      syncEditorSearchControls();
      if (editDrawerInstance && typeof editDrawerInstance.close === 'function') editDrawerInstance.close();
      };
      if (!execSetId || !apiClient || typeof apiClient.listExecCases !== 'function') {
        applyItems(fallbackItems);
        return;
      }
      apiClient.listExecCases(execSetId).then(function(execCases) {
        var ordered = reorderItemsByExecCaseOrder(baseItems, execCases);
        var nextItems = ordered.matched ? ordered.items : fallbackItems;
        applyItems(nextItems);
      }).catch(function() {
        applyItems(fallbackItems);
      });
    }).catch(function(err) {
      setStatus(dom.editDrawerStatus, err && err.message ? err.message : '加载用例失败', 'err');
    });
  }

  function showEditorCard(show) {
    if (!dom.editCard) return;
    // 兜底：部分环境下静态 CSS 资源可能加载抖动，增加 hidden 属性确保“隐藏”语义可靠。
    try { dom.editCard.hidden = !show; } catch (_) {}
    if (show) dom.editCard.classList.remove('hidden');
    else dom.editCard.classList.add('hidden');
  }

  function showMissingCard(show) {
    if (!dom.missingCard) return;
    try { dom.missingCard.hidden = !show; } catch (_) {}
    if (show) dom.missingCard.classList.remove('hidden');
    else dom.missingCard.classList.add('hidden');
  }

  var missingReminderModel = missingReminderModelOwner.create({
    stringifyCaseField: utils.stringifyCaseField,
    buildCaseSearchText: utils.buildCaseSearchText,
    buildKeywords: utils.buildMissingReminderKeywords,
    stripCodeFence: utils.stripCodeFence,
    extractJsonPayload: utils.extractJsonPayload,
  });
  var missingReminderView = missingReminderViewOwner.create({
    top: dom.missingReminderTop,
    bottom: dom.missingReminderBottom,
    escapeHtml: escapeHtml,
    formatTypeLabel: formatMissingItemTypeLabel,
    buildSummary: missingReminderModel.buildSummary,
    resolveLimit: missingReminderModel.resolveLimit,
    resolveScoreLevel: missingReminderModel.resolveScoreLevel,
    bindScrollHint: utils.bindMissingReminderScrollHint,
  });
  var missingReminderController = missingReminderControllerOwner.create({
    state: state,
    dom: dom,
    apiClient: apiClient,
    model: missingReminderModel,
    view: missingReminderView,
    normalizeTypeIds: normalizeMissingTypeIds,
    resolveTypeNames: resolveMissingItemTypeNames,
    resolveTypeLabel: resolveMissingTypeLabel,
    formatTypeLabel: formatMissingItemTypeLabel,
    openMissingDrawer: openMissingDrawer,
    openConfirmDrawer: openConfirmDrawer,
    showToast: showCenterToast,
    getCore: getCore,
    getAssignments: getGlobalAssignments,
    getDefaultPrompt: function() {
      return window.app && window.app.config && window.app.config.defaultPrompts
        ? window.app.config.defaultPrompts.missingreminder || ''
        : '';
    },
    getManager: function() {
      return window.app && window.app.missingReminderAi ? window.app.missingReminderAi : null;
    },
    getSettings: function() {
      var globalState = window.app && window.app.state ? window.app.state : {};
      return globalState && globalState.settings && typeof globalState.settings === 'object'
        ? globalState.settings
        : {};
    },
  });

  var aiGenController = aiGenControllerOwner.create({
    state: state,
    dom: dom,
    utils: utils,
    apiClient: apiClient,
    modelOwner: aiGenModelOwner,
    storeOwner: aiGenStoreOwner,
    fileParserOwner: aiGenFileParserOwner,
    taskRunnerOwner: aiGenTaskRunnerOwner,
    viewOwner: aiGenViewOwner,
    normalizeText: normalizeEditorText,
    normalizePriority: normalizePriorityInput,
    buildCaseKey: buildCaseItemKey,
    hashText: missingReminderModel.hashText,
    getCurrentUserId: getCurrentUserId,
    getCore: getCore,
    getGlobalAssignments: getGlobalAssignments,
    appendPrompt: appendCaseWritingGuidePrompt,
    getDefaultPrompt: function() {
      return window.app && window.app.config && window.app.config.defaultPrompts
        ? window.app.config.defaultPrompts.caselibrarygen || ''
        : '';
    },
    getJSZip: function() { return window.JSZip || null; },
    getMindApi: getMindElixirApi,
    setStatus: setStatus,
    showToast: showCenterToast,
    escapeHtml: escapeHtml,
    escapeHtmlPreserve: escapeHtmlPreserve,
    isEditorVisible: isEditorCardVisible,
    isEditDrawerOpen: function() { return isDrawerInstanceOpen(editDrawerInstance); },
    renderEditDrawerList: renderEditDrawerList,
    ensureDrawer: ensureDrawer,
    openConfirmDrawer: openConfirmDrawer,
    ensureNonEnumerableKey: ensureNonEnumerableKey,
    markNewAdded: markCaseLibraryNewAdded,
    reorderItems: reorderItemsByExistingModuleAppend,
    renderEditor: renderEditorTable,
    captureAnchorRect: captureCaseLibraryAnchorRect,
    startPendingToast: startPendingToast,
  });

  function ensureCaseLibraryAiGenState() {
    return aiGenController.getState();
  }

  function syncCaseLibraryAiGenContext() {
    return aiGenController.syncContext();
  }

  function syncCaseLibraryAiGenTaskState() {
    return aiGenController.syncTaskState();
  }

  function syncCaseLibraryAiGenButton() {
    return aiGenController.syncButton();
  }

  function syncCaseLibraryAiGenRunBtn() {
    return aiGenController.syncRunButton();
  }

  function syncCaseLibraryAiGenNavBadge() {
    return aiGenController.syncNavBadge();
  }

  function markCaseLibraryAiGenNavBadgeRead() {
    return aiGenController.markNavBadgeRead();
  }

  function markCaseLibraryAiGenEditBadgeRead(fileId) {
    return aiGenController.markEditBadgeRead(fileId);
  }

  function shouldShowCaseLibraryAiGenEditBadge(fileId) {
    return aiGenController.shouldShowEditBadge(fileId);
  }

  function openCaseLibraryAiGenPrepAndRun(options) {
    return aiGenController.openPrepAndRun(options);
  }

  function handleCaseLibraryAiGenFile(file) {
    return aiGenController.handleFile(file);
  }

  function clearCaseLibraryAiGenRequirement() {
    return aiGenController.clearRequirement();
  }

  function runCaseLibraryAiGen(prepContext) {
    return aiGenController.run(prepContext);
  }

  function selectAllCaseLibraryAiGenCases() {
    return aiGenController.selectAll();
  }

  function clearCaseLibraryAiGenSelection() {
    return aiGenController.clearSelection();
  }

  function discardCaseLibraryAiGenResult(options) {
    return aiGenController.discardResult(options);
  }

  function handleCaseLibraryAiGenRegenerate() {
    return aiGenController.regenerate();
  }

  function appendCaseLibraryAiGenSelection(anchorEl) {
    return aiGenController.appendSelection(anchorEl);
  }

  function hasNativeLabelTrigger(zone, input) {
    return aiGenController.hasNativeLabelTrigger(zone, input);
  }
  // “＋”新增用例高亮：仅保留在本次页面生命周期（刷新后清空），避免写入 localStorage/DB。
  var caseLibraryNewAddedCaseUiKeysByFileId = {};

  function ensureNonEnumerableKey(obj, keyName, value) {
    if (!obj || typeof obj !== 'object') return '';
    var has = false;
    try { has = Object.prototype.hasOwnProperty.call(obj, keyName); } catch (err) { has = false; }
    if (has) {
      try { return String(obj[keyName] || ''); } catch (e) { return ''; }
    }
    var v = value || ('ui-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6));
    try {
      Object.defineProperty(obj, keyName, { value: v, enumerable: false, configurable: true, writable: true });
    } catch (err2) {
      try { obj[keyName] = v; } catch (err3) {}
    }
    return String(v || '');
  }

  function getCaseLibraryEditorUiKey(item) {
    if (!item || typeof item !== 'object') return '';
    var key = '';
    try { key = String(item.__uiKey || ''); } catch (_) { key = ''; }
    if (key) return key;
    if (item.id !== null && item.id !== undefined) return 'id-' + String(item.id);
    return ensureNonEnumerableKey(item, '__uiKey', '');
  }

  function ensureCaseLibraryNewAddedStore(caseFileId) {
    var id = caseFileId !== null && caseFileId !== undefined ? String(caseFileId) : '';
    if (!id) id = 'unknown';
    if (!caseLibraryNewAddedCaseUiKeysByFileId[id] || typeof caseLibraryNewAddedCaseUiKeysByFileId[id] !== 'object') {
      caseLibraryNewAddedCaseUiKeysByFileId[id] = {};
    }
    return caseLibraryNewAddedCaseUiKeysByFileId[id];
  }

  function markCaseLibraryNewAdded(caseFileId, item) {
    var store = ensureCaseLibraryNewAddedStore(caseFileId);
    var key = getCaseLibraryEditorUiKey(item);
    if (!key) return;
    store[key] = true;
  }

  function unmarkCaseLibraryNewAdded(caseFileId, item) {
    var store = ensureCaseLibraryNewAddedStore(caseFileId);
    var key = getCaseLibraryEditorUiKey(item);
    if (!key) return;
    delete store[key];
  }

  function isCaseLibraryNewAdded(caseFileId, item) {
    var store = ensureCaseLibraryNewAddedStore(caseFileId);
    var key = getCaseLibraryEditorUiKey(item);
    return Boolean(key && store && store[key] === true);
  }

  var missingNewAddedCaseUiKeysByModuleId = {};

  function getMissingItemUiKey(item) {
    if (!item || typeof item !== 'object') return '';
    var key = '';
    try { key = String(item.__uiKey || ''); } catch (_) { key = ''; }
    if (key) return key;
    if (item.id !== null && item.id !== undefined) return 'id-' + String(item.id);
    return ensureNonEnumerableKey(item, '__uiKey', '');
  }

  function ensureMissingNewAddedStore(moduleId) {
    var id = moduleId !== null && moduleId !== undefined ? String(moduleId) : '';
    if (!id) id = 'unknown';
    if (!missingNewAddedCaseUiKeysByModuleId[id] || typeof missingNewAddedCaseUiKeysByModuleId[id] !== 'object') {
      missingNewAddedCaseUiKeysByModuleId[id] = {};
    }
    return missingNewAddedCaseUiKeysByModuleId[id];
  }

  function markMissingNewAdded(moduleId, item) {
    var store = ensureMissingNewAddedStore(moduleId);
    var key = getMissingItemUiKey(item);
    if (!key) return;
    store[key] = true;
  }

  function unmarkMissingNewAdded(moduleId, item) {
    var store = ensureMissingNewAddedStore(moduleId);
    var key = getMissingItemUiKey(item);
    if (!key) return;
    delete store[key];
  }

  function isMissingNewAdded(moduleId, item) {
    var store = ensureMissingNewAddedStore(moduleId);
    var key = getMissingItemUiKey(item);
    return Boolean(key && store && store[key] === true);
  }

	  function shouldModuleRepositionItem(item, seenModules) {
	    if (!item) return false;
	    var moduleName = normalizeEditorText(item.module);
	    if (!moduleName) return false;
	    if (!seenModules || seenModules[moduleName] !== true) return false;
	    var title = normalizeEditorText(item.title);
	    var priority = normalizeEditorText(item.priority);
	    var pre = normalizeEditorText(item.precondition);
	    var steps = normalizeEditorText(item.steps);
	    var expected = normalizeEditorText(item.expected);
	    if (!title || !priority || !pre || !steps || !expected) return false;
	    return true;
	  }

	  function reorderItemsByExistingModuleAppend(items) {
	    var list = Array.isArray(items) ? items.slice() : [];
	    if (!list.length) return list;
	    var result = [];
	    var seenModules = {};
	    var moduleLastPos = {};

	    function bumpPositionsFrom(index) {
	      Object.keys(moduleLastPos).forEach(function(k) {
	        if (moduleLastPos[k] >= index) moduleLastPos[k] += 1;
	      });
	    }

	    list.forEach(function(it) {
	      var moduleName = normalizeEditorText(it && it.module);
	      var canMove = shouldModuleRepositionItem(it, seenModules);

	      if (!moduleName || !canMove || moduleLastPos[moduleName] === undefined) {
	        result.push(it);
	        if (moduleName) {
	          seenModules[moduleName] = true;
	          moduleLastPos[moduleName] = result.length - 1;
	        }
	        return;
	      }

	      var insertAt = moduleLastPos[moduleName] + 1;
	      bumpPositionsFrom(insertAt);
	      result.splice(insertAt, 0, it);
	      moduleLastPos[moduleName] = insertAt;
	      seenModules[moduleName] = true;
	    });
	    return result;
	  }

    function reorderItemsByExecCaseOrder(items, execCases) {
      var list = Array.isArray(items) ? items.slice() : [];
      var cases = Array.isArray(execCases) ? execCases : [];
      if (!list.length || !cases.length) return { items: list, matched: false };
      var itemById = {};
      list.forEach(function(item) {
        if (!item || item.id === null || item.id === undefined) return;
        itemById[String(item.id)] = item;
      });
      var ordered = [];
      var used = {};
      cases.forEach(function(row) {
        if (!row || row.case_item_id === null || row.case_item_id === undefined) return;
        var key = String(row.case_item_id);
        var hit = itemById[key];
        if (!hit || used[key]) return;
        ordered.push(hit);
        used[key] = true;
      });
      if (!ordered.length) return { items: list, matched: false };
      list.forEach(function(item) {
        if (!item || item.id === null || item.id === undefined) {
          ordered.push(item);
          return;
        }
        var key = String(item.id);
        if (!used[key]) ordered.push(item);
      });
      return { items: ordered, matched: true };
    }

  function resolveDrawerPage(total, pageIndex) {
    var pageSize = getPageSize();
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    var idx = Number(pageIndex);
    if (!isFinite(idx)) idx = 0;
    if (idx < 0) idx = 0;
    if (idx >= totalPages) idx = Math.max(totalPages - 1, 0);
    var start = idx * pageSize;
    var end = Math.min(total, start + pageSize);
    return { pageSize: pageSize, totalPages: totalPages, pageIndex: idx, start: start, end: end };
  }

  function buildDrawerPagination(total, pageIndex, totalPages, start, end, scope) {
    var displayStart = total ? start + 1 : 0;
    var displayEnd = total ? Math.min(end, total) : 0;
    var maxPage = Math.max(totalPages, 1);
    var currentPage = totalPages ? pageIndex + 1 : 1;
    var rangeInfo = total
      ? '显示 ' + displayStart + '-' + displayEnd + ' / ' + total + ' 条'
      : '暂无记录';
    var scopeTag = scope ? String(scope) : '';
    return (
      '<div class=\"temp-pagination\" data-case-lib-drawer-pagination=\"' + escapeHtml(scopeTag) + '\">' +
        '<div class=\"temp-pagination-info\">' + escapeHtml(rangeInfo) + '，每页 ' + getPageSize() + ' 条</div>' +
        '<div class=\"temp-pagination-controls\">' +
          '<button type=\"button\" class=\"secondary\" data-case-lib-drawer-page=\"prev\" data-case-lib-drawer-scope=\"' + escapeHtml(scopeTag) + '\" ' + (pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
          '<span>第 ' + currentPage + ' / ' + maxPage + ' 页</span>' +
          '<button type=\"button\" class=\"secondary\" data-case-lib-drawer-page=\"next\" data-case-lib-drawer-scope=\"' + escapeHtml(scopeTag) + '\" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
          '<label>跳至' +
            '<input type=\"number\" min=\"1\" max=\"' + maxPage + '\" value=\"' + Math.min(currentPage, maxPage) + '\" data-case-lib-drawer-page-input data-case-lib-drawer-scope=\"' + escapeHtml(scopeTag) + '\">' +
            '页' +
          '</label>' +
        '</div>' +
      '</div>'
    );
  }

  function setDrawerPagination(topEl, bottomEl, html) {
    if (topEl) topEl.innerHTML = html || '';
    if (bottomEl) bottomEl.innerHTML = html || '';
  }

  var caseLibraryXmindLocateTimer = 0;
  var caseLibraryXmindLocateTarget = null;

  function clearCaseLibraryXmindLocateHighlight() {
    if (caseLibraryXmindLocateTimer) {
      clearTimeout(caseLibraryXmindLocateTimer);
      caseLibraryXmindLocateTimer = 0;
    }
    caseLibraryXmindLocateTarget = null;
    var controller = ensureEditorController();
    if (controller) controller.setLocatedIndex(null);
  }

  function flashCaseLibraryXmindLocateHighlight(index, durationMs) {
    var idx = Number(index);
    if (!isFinite(idx) || idx < 0) return;
    var duration = Number(durationMs);
    if (!isFinite(duration) || duration <= 0) duration = 3200;

    if (caseLibraryXmindLocateTarget !== null && caseLibraryXmindLocateTarget !== idx) {
      clearCaseLibraryXmindLocateHighlight();
    } else if (caseLibraryXmindLocateTimer) {
      clearTimeout(caseLibraryXmindLocateTimer);
      caseLibraryXmindLocateTimer = 0;
    }

    caseLibraryXmindLocateTarget = idx;
    var controller = ensureEditorController();
    if (controller) controller.setLocatedIndex(idx);
    caseLibraryXmindLocateTimer = setTimeout(function() {
      if (caseLibraryXmindLocateTarget === idx) {
        caseLibraryXmindLocateTarget = null;
        var current = ensureEditorController();
        if (current) current.setLocatedIndex(null);
      }
      caseLibraryXmindLocateTimer = 0;
    }, duration);
  }

  function scrollEditorToIndex(index) {
    var idx = Number(index);
    if (!isFinite(idx) || idx < 0) return;
    var controller = ensureEditorController();
    if (controller) controller.focusSourceIndex(idx, 'module', true);
  }

  function getActiveEditorInlineCell() {
    if (typeof document === 'undefined') return null;
    if (!dom.editView || !dom.editView.contains) return null;
    var active = document.activeElement;
    if (!active || !dom.editView.contains(active)) return null;
    if (!active.getAttribute) return null;
    if (active.getAttribute('data-case-lib-edit-field')) return active;
    if (active.classList && active.classList.contains('tap-vtable-editor')) return active;
    return null;
  }

  function isCaseLibraryEditorEditing() {
    if (typeof document === 'undefined') return false;
    if (!dom.editView || !dom.editView.contains) return false;
    var active = document.activeElement;
    if (!active || !dom.editView.contains(active)) return false;
    if (!active.getAttribute) return false;
    if (active.getAttribute('data-case-lib-edit-field')) return true;
    if (active.classList && active.classList.contains('tap-vtable-editor')) return true;
    return false;
  }

  function syncEditorRowInputToItem(index, item, options) {
    if (!dom.editView || !dom.editView.querySelector) return false;
    if (!item) return false;
    var idx = Number(index);
    if (!isFinite(idx)) return false;
    var opts = options || {};
    var skipEmptyRequired = opts.skipEmptyRequired === true;
    var fields = [
      { key: 'module', multiline: false, required: true },
      { key: 'title', multiline: false, required: true },
      { key: 'priority', multiline: false },
      { key: 'precondition', multiline: true },
      { key: 'steps', multiline: true },
      { key: 'expected', multiline: true, required: true },
    ];
    var changed = false;
    fields.forEach(function(meta) {
      var active = getActiveEditorInlineCell();
      var activeMatches = Boolean(
        active &&
        active.getAttribute('data-case-lib-edit-field') === meta.key &&
        Number(active.getAttribute('data-index')) === idx
      );
      var cell = activeMatches
        ? active
        : dom.editView.querySelector('[data-case-lib-edit-field="' + meta.key + '"][data-index="' + idx + '"]');
      if (!cell) return;
      var raw = Object.prototype.hasOwnProperty.call(cell, 'value') || cell.value !== undefined
        ? cell.value
        : (meta.multiline ? cell.innerText : cell.textContent);
      var next = normalizeEditorText(raw);
      if (skipEmptyRequired && meta.required && !next) return;
      if (item[meta.key] !== next) {
        item[meta.key] = next;
        changed = true;
      }
    });
    return changed;
  }

  function renderEditorTable() {
    setEditorControllerData();
  }

  function renderEditorCard() {
    var file = state.editor.caseFile;
    if (!file) {
      showEditorCard(false);
      missingReminderController.clear();
      syncCaseLibraryAiGenContext();
      return;
    }
    showEditorCard(true);
    var projectName = state.projectNameById[file.project_id] || ('项目#' + file.project_id);
    var versionName = getVersionName(file.project_id, file.version_id);
    if (dom.editProject) dom.editProject.textContent = projectName;
    if (dom.editVersion) dom.editVersion.textContent = versionName;
    if (dom.editFileName) dom.editFileName.textContent = file.file_name_clean || ('文件#' + file.id);
    if (dom.editCardTitle) dom.editCardTitle.textContent = '用例编辑视图：' + (file.file_name_clean || ('#' + file.id));
    renderEditorTable();
    syncEditorSearchControls();
    syncEditorBatchDeleteControls();
    syncEditorBatchAddControls();
    syncCaseLibraryAiGenContext();
    if (dom.xmindViewBtn) {
      var hasMindApi = Boolean(getMindElixirApi() && typeof getMindElixirApi().buildMindDataFromCases === 'function');
      dom.xmindViewBtn.disabled = !(Array.isArray(state.editor.items) && state.editor.items.length && hasMindApi);
    }
  }

  function syncEditorSearchControls() {
    if (!dom.editClearSearchBtn) return;
    var val = '';
    if (dom.editSearchInput) val = String(dom.editSearchInput.value || '');
    var term = String(state.editor && state.editor.searchText ? state.editor.searchText : '') || val;
    dom.editClearSearchBtn.disabled = !term.trim();
  }

  function syncEditorBatchDeleteControls() {
    if (!dom.editBatchDeleteBtn) return;
    var ed = state.editor;
    var selected = ed && ed.selection && typeof ed.selection.size === 'number' ? ed.selection.size : 0;
    var disabled = !ed || !ed.caseFile || !selected || Boolean(ed.pendingOp);
    var label = '批量删除';
    if (selected) label += '（' + selected + '）';
    dom.editBatchDeleteBtn.textContent = label;
    dom.editBatchDeleteBtn.disabled = disabled;
  }

  function syncEditorBatchAddControls() {
    var ed = state.editor;
    if (dom.editBatchAddCountInput) {
      if (ed && isFinite(Number(ed.batchAddCount))) {
        dom.editBatchAddCountInput.value = String(clampBatchAddCount(ed.batchAddCount));
      }
    }
    if (!dom.editBatchAddBtn) return;
    var disabled = !ed || !ed.caseFile || Boolean(ed.pendingOp);
    dom.editBatchAddBtn.disabled = disabled;
  }

  function restoreEditorFromPersistedState() {
    if (!isAuthReady()) return Promise.resolve(false);
    if (state.editor.restoring === true) return Promise.resolve(false);
    var persisted = readEditorPersistedState();
    if (!persisted) return Promise.resolve(false);
    var userId = getCurrentUserId();
    if (!userId || String(persisted.user_id || '') !== String(userId)) return Promise.resolve(false);
    var projectId = normalizeId(persisted.project_id);
    var caseFileId = Number(persisted.case_file_id);
    if (!projectId || isNaN(caseFileId) || caseFileId <= 0) return Promise.resolve(false);

    state.editor.restoring = true;
    setStatus(dom.editStatus, '', '');
    return ensureProjectsReady()
      .then(function() { return loadVersions(projectId); })
      .then(function() { return apiClient.listCaseFiles(projectId); })
      .then(function(files) {
        var list = Array.isArray(files) ? files : [];
        var found = list.find(function(f) { return f && Number(f.id) === caseFileId; }) || null;
        if (!found) {
          clearEditorPersistedState();
          state.editor.caseFile = null;
          state.editor.items = [];
          showEditorCard(false);
          syncCaseLibraryAiGenContext();
          return false;
        }
	        return apiClient.listCaseItems(caseFileId).then(function(items) {
	          state.editor.caseFile = found;
	          state.editor.items = reorderItemsByExistingModuleAppend(Array.isArray(items) ? items : []);
	          if (dom.editSearchInput) dom.editSearchInput.value = '';
	          state.editor.searchText = '';
	          state.editor.pageIndex = 0;
	          state.editor.selection = new Set();
          state.editor.remarkOpen = new Set();
          // 保证视图互斥：恢复“编辑”视图时应隐藏“历史详情”卡片。
          setHistoryDetailVisible(false);
          renderEditorCard();
          syncEditorSearchControls();
          return true;
        });
      })
      .catch(function(err) {
        console.error(err);
        // 可能是权限变化/项目不可见，避免卡死：清理后不再恢复。
        clearEditorPersistedState();
        return false;
      })
      .finally(function() {
        state.editor.restoring = false;
      });
  }

  function restoreMissingViewFromPersistedState() {
    if (!isAuthReady()) return Promise.resolve(false);
    if (state.missingView && state.missingView.restoring === true) return Promise.resolve(false);
    var persisted = readMissingViewPersistedState();
    if (!persisted) return Promise.resolve(false);
    var userId = getCurrentUserId();
    var loginSeq = getCurrentLoginSeq();
    var okByUser = userId && String(persisted.user_id || '') === String(userId);
    var okByLogin = loginSeq && String(persisted.login_seq || '') === String(loginSeq);
    if (!okByUser && !okByLogin) return Promise.resolve(false);
    var projectId = normalizeId(persisted.project_id);
    var moduleIds = Array.isArray(persisted.module_ids)
      ? persisted.module_ids.map(function(v) { return String(v); }).filter(function(v) { return v; })
      : [];
    if (!projectId || !moduleIds.length) {
      clearMissingViewPersistedState();
      return Promise.resolve(false);
    }
    state.missingView.restoring = true;
    return ensureProjectsReady()
      .then(function() {
        if (!apiClient || typeof apiClient.listMissingModules !== 'function') {
          throw new Error('易漏模块接口未就绪');
        }
        return apiClient.listMissingModules(projectId);
      })
      .then(function(list) {
        var all = Array.isArray(list) ? list : [];
        var orderMap = {};
        moduleIds.forEach(function(id, idx) { orderMap[String(id)] = idx; });
        var selected = all.filter(function(m) {
          if (!m || m.id === null || m.id === undefined) return false;
          return Object.prototype.hasOwnProperty.call(orderMap, String(m.id));
        });
        selected.sort(function(a, b) {
          return orderMap[String(a.id)] - orderMap[String(b.id)];
        });
        if (!selected.length) {
          clearMissingViewPersistedState();
          state.missingView.modules = [];
          state.missingView.moduleIds = [];
          state.missingView.items = [];
          updateMissingViewMeta();
          renderMissingViewTable();
          showMissingCard(false);
          return false;
        }
        state.missingDrawer.projectId = projectId;
        state.missingDrawer.modules = all;
        state.missingDrawer.moduleId = null;
        state.missingDrawer.pageIndex = 0;
        if (dom.missingDrawerProjectSelect) dom.missingDrawerProjectSelect.value = String(projectId);
        syncMissingModuleOptions(dom.missingDrawerModuleSelect, all, '全部模块');
        if (dom.missingDrawerModuleSelect) {
          dom.missingDrawerModuleSelect.disabled = false;
          dom.missingDrawerModuleSelect.value = '';
        }
        openMissingViewForModules(selected);
        return true;
      })
      .catch(function(err) {
        console.error(err);
        return false;
      })
      .finally(function() {
        state.missingView.restoring = false;
      });
  }

  function restoreCaseLibraryLastSelection() {
    if (!isAuthReady()) return Promise.resolve(null);
    var lastView = readCaseLibraryLastViewPersistedState();
    if (lastView) {
      var userId = getCurrentUserId();
      var loginSeq = getCurrentLoginSeq();
      var okByUser = userId && String(lastView.user_id || '') === String(userId);
      var okByLogin = loginSeq && String(lastView.login_seq || '') === String(loginSeq);
      if (okByUser || okByLogin) {
        var viewName = lastView.view ? String(lastView.view) : '';
        if (viewName === 'history') {
          return restoreHistoryDetailFromPersistedState().then(function(ok) {
            if (ok) return 'history';
            setHistoryDetailVisible(false);
            showEditorCard(true);
            return restoreEditorFromPersistedState().then(function(ok2) { return ok2 ? 'editor' : null; });
          });
        }
        if (viewName === 'editor') {
          setHistoryDetailVisible(false);
          showEditorCard(true);
          return restoreEditorFromPersistedState().then(function(ok) {
            if (ok) return 'editor';
            return restoreHistoryDetailFromPersistedState().then(function(ok2) { return ok2 ? 'history' : null; });
          });
        }
        if (viewName === 'missing') {
          setHistoryDetailVisible(false);
          showEditorCard(false);
          return restoreMissingViewFromPersistedState().then(function(ok) {
            if (ok) return 'missing';
            showMissingCard(false);
            return restoreEditorFromPersistedState().then(function(ok2) {
              if (ok2) return 'editor';
              return restoreHistoryDetailFromPersistedState().then(function(ok3) { return ok3 ? 'history' : null; });
            });
          });
        }
      }
    }

    var editorPersisted = readEditorPersistedState();
    var historyPersisted = readHistoryDetailPersistedState();
    var missingPersisted = readMissingViewPersistedState();
    var editorAt = editorPersisted && isFinite(Number(editorPersisted.saved_at)) ? Number(editorPersisted.saved_at) : 0;
    var historyAt = historyPersisted && isFinite(Number(historyPersisted.saved_at)) ? Number(historyPersisted.saved_at) : 0;
    var missingAt = missingPersisted && isFinite(Number(missingPersisted.saved_at)) ? Number(missingPersisted.saved_at) : 0;
    var preferHistory = historyAt > editorAt;
    var preferMissing = missingAt > historyAt && missingAt > editorAt;

    if (preferMissing) {
      return restoreMissingViewFromPersistedState().then(function(ok) {
        if (ok) return 'missing';
        showMissingCard(false);
        setHistoryDetailVisible(false);
        showEditorCard(true);
        return restoreEditorFromPersistedState().then(function(ok2) {
          if (ok2) return 'editor';
          return restoreHistoryDetailFromPersistedState().then(function(ok3) { return ok3 ? 'history' : null; });
        });
      });
    }
    if (preferHistory) {
      return restoreHistoryDetailFromPersistedState().then(function(ok) {
        if (ok) return 'history';
        setHistoryDetailVisible(false);
        showEditorCard(true);
        return restoreEditorFromPersistedState().then(function(ok2) {
          if (ok2) return 'editor';
          if (missingAt) {
            return restoreMissingViewFromPersistedState().then(function(ok3) { return ok3 ? 'missing' : null; });
          }
          return null;
        });
      });
    }
    setHistoryDetailVisible(false);
    showEditorCard(true);
    return restoreEditorFromPersistedState().then(function(ok) {
      if (ok) return 'editor';
      if (missingAt && missingAt >= historyAt) {
        return restoreMissingViewFromPersistedState().then(function(ok2) { return ok2 ? 'missing' : null; });
      }
      return restoreHistoryDetailFromPersistedState().then(function(ok2) { return ok2 ? 'history' : null; });
      });
  }

  function isEditorCardVisible() {
    return Boolean(dom.editCard && dom.editCard.classList && !dom.editCard.classList.contains('hidden'));
  }

  function isMissingCardVisible() {
    return Boolean(dom.missingCard && dom.missingCard.classList && !dom.missingCard.classList.contains('hidden'));
  }

  function handlePageSizeChanged() {
    var pageSize = getPageSize();
    historyDrawerController.setPageSize(pageSize);
    if (editListControllerInstance) editListControllerInstance.setPageSize(pageSize);
    if (associationItemControllerInstance) associationItemControllerInstance.setPageSize(pageSize);
    if (selectExecControllerInstance) selectExecControllerInstance.setPageSize(pageSize);
    var hasEditor = state.editor && state.editor.caseFile && state.editor.caseFile.id;
    if (hasEditor) {
      renderEditorTable();
    }
    if (state.missingDrawer && state.missingDrawer.projectId) {
      missingDrawerController.render();
    }
    if (state.missingView && state.missingView.modules && state.missingView.modules.length) {
      renderMissingViewTable();
    }
  }

  function bindUnloadPersistence() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('beforeunload', function() {
      try {
        // 刷新/关闭前再写一次“当前视图”，确保刷新后回到最后操作视图。
        if (isHistoryDetailVisible()) {
          persistHistoryDetailSelection();
          persistCaseLibraryLastView('history');
          return;
        }
        if (isMissingCardVisible()) {
          persistMissingViewSelection();
          persistCaseLibraryLastView('missing');
          return;
        }
        if (isEditorCardVisible()) {
          var file = state.editor && state.editor.caseFile ? state.editor.caseFile : null;
          if (file) persistEditorSelection(file);
          persistCaseLibraryLastView('editor');
        }
      } catch (err) {
        // ignore
      }
    });
  }

  var caseLibraryBlockHintEl = null;
  var caseLibraryBlockHintTimer = null;

  function cleanupCaseLibraryBlockHint() {
    if (caseLibraryBlockHintTimer) {
      clearTimeout(caseLibraryBlockHintTimer);
      caseLibraryBlockHintTimer = null;
    }
    if (caseLibraryBlockHintEl && caseLibraryBlockHintEl.parentNode) {
      caseLibraryBlockHintEl.parentNode.removeChild(caseLibraryBlockHintEl);
    }
    caseLibraryBlockHintEl = null;
  }

  function positionCaseLibraryBlockHint(hintEl, anchorRect) {
    if (!hintEl || !anchorRect) return;
    var rect = anchorRect;
    var hintRect = hintEl.getBoundingClientRect ? hintEl.getBoundingClientRect() : null;
    var hintW = hintRect && hintRect.width ? hintRect.width : 260;
    var hintH = hintRect && hintRect.height ? hintRect.height : 44;
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    var margin = 8;
    var width = Number(rect.width) || 0;
    var height = Number(rect.height) || 0;
    var leftBase = Number(rect.left) || 0;
    var topBase = Number(rect.top) || 0;
    var bottomBase = Number.isFinite(Number(rect.bottom)) ? Number(rect.bottom) : (topBase + height);
    var centerX = leftBase + width / 2;
    var left = centerX - hintW / 2;
    if (vw) left = Math.min(Math.max(margin, left), Math.max(margin, vw - hintW - margin));
    var aboveTop = topBase - 10 - hintH;
    var belowTop = bottomBase + 10;
    var top = aboveTop >= margin ? aboveTop : belowTop;
    if (vh) top = Math.min(Math.max(margin, top), Math.max(margin, vh - hintH - margin));
    hintEl.style.left = Math.round(left) + 'px';
    hintEl.style.top = Math.round(top) + 'px';
  }

  function showCaseLibraryBlockHint(anchorRect, message, durationMs) {
    if (!anchorRect) return;
    cleanupCaseLibraryBlockHint();
    var hint = document.createElement('div');
    hint.className = 'temp-click-hint';
    var text = document.createElement('span');
    text.textContent = message || '当前有待确认的增删操作，请先撤回或等待入库';
    hint.appendChild(text);
    document.body.appendChild(hint);
    caseLibraryBlockHintEl = hint;
    positionCaseLibraryBlockHint(hint, anchorRect);
    var duration = Number(durationMs);
    if (!isFinite(duration) || duration <= 0) duration = 3000;
    caseLibraryBlockHintTimer = setTimeout(function() {
      if (!caseLibraryBlockHintEl) return;
      try { caseLibraryBlockHintEl.classList.add('fade-out'); } catch (_) {}
      setTimeout(function() { cleanupCaseLibraryBlockHint(); }, 220);
    }, duration);
  }

  function captureCaseLibraryAnchorRect(anchorEl) {
    if (!anchorEl) return null;
    if (typeof anchorEl === 'object' && anchorEl.left !== undefined && anchorEl.top !== undefined) {
      var left0 = Number(anchorEl.left) || 0;
      var top0 = Number(anchorEl.top) || 0;
      var width0 = Number(anchorEl.width) || 0;
      var height0 = Number(anchorEl.height) || 0;
      var bottom0 = Number.isFinite(Number(anchorEl.bottom)) ? Number(anchorEl.bottom) : (top0 + height0);
      return { left: left0, top: top0, width: width0, height: height0, bottom: bottom0 };
    }
    if (typeof anchorEl.getBoundingClientRect !== 'function') return null;
    try {
      var rect = anchorEl.getBoundingClientRect();
      if (!rect) return null;
      var left = Number(rect.left) || 0;
      var top = Number(rect.top) || 0;
      var width = Number(rect.width) || 0;
      var height = Number(rect.height) || 0;
      return {
        left: left,
        top: top,
        width: width,
        height: height,
        bottom: Number.isFinite(Number(rect.bottom)) ? Number(rect.bottom) : (top + height),
      };
    } catch (err) {
      return null;
    }
  }

  function saveCaseItemAtIndex(index, reason) {
    var ed = state.editor;
    var file = ed.caseFile;
    if (!file || !file.id) return;
    var idx = Number(index);
    if (!isFinite(idx) || idx < 0 || idx >= ed.items.length) return;
    var item = ed.items[idx];
    if (!item) return;
    if (!item.id) return;
    var payload = buildCaseItemPayload(item);
    var err = validatePayload(payload);
    if (err) {
      setStatus(dom.editStatus, err, 'warn');
      return;
    }
    setStatus(dom.editStatus, (reason || '保存中') + '...', '');
    apiClient.updateCaseItem(item.id, payload).then(function(updated) {
      if (updated && typeof updated === 'object' && (updated.id || updated.id === 0)) {
        ed.items[idx] = updated;
      }
      setStatus(dom.editStatus, '已保存', 'ok');
      var activeCell = getActiveEditorInlineCell();
      if (activeCell) return;
      renderEditorTable();
    }).catch(function(e) {
      setStatus(dom.editStatus, e && e.message ? e.message : '保存失败', 'err');
    });
  }

  function openExecVersionSelectDrawer(projectId, options) {
    return selectExecDrawerControllerInstance.openVersionDrawer(projectId, options);
  }

  function bindEvents() {
    if (dom.importInput) {
      dom.importInput.addEventListener('change', function(e) {
        var files = e && e.target && e.target.files ? Array.from(e.target.files) : [];
        handleImportFiles(files);
        try { e.target.value = ''; } catch (_) {}
      });
    }
    if (dom.importDropZone) {
      dom.importDropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dom.importDropZone.classList.add('dragover');
      });
      dom.importDropZone.addEventListener('dragleave', function() {
        dom.importDropZone.classList.remove('dragover');
      });
      dom.importDropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dom.importDropZone.classList.remove('dragover');
        var files = e && e.dataTransfer ? e.dataTransfer.files : null;
        if (files && files.length) handleImportFiles(files);
      });
    }
    if (dom.importProjectSelect) {
      dom.importProjectSelect.addEventListener('change', handleImportProjectChange);
    }
    if (dom.importVersionSelect) {
      dom.importVersionSelect.addEventListener('change', handleImportVersionChange);
    }
    if (dom.importConfirmBtn) {
      dom.importConfirmBtn.addEventListener('click', confirmImportToDb);
    }
    if (dom.importExcelTemplateBtn) {
      dom.importExcelTemplateBtn.addEventListener('click', downloadImportExcelTemplate);
    }
    if (dom.importXmindTemplateBtn) {
      dom.importXmindTemplateBtn.addEventListener('click', downloadImportXmindTemplate);
    }
    importReviewController.bindEvents();
    writerPublishController.bindEvents();
    missingImportController.bindEvents();
    if (dom.jumpToExecBtn) {
      dom.jumpToExecBtn.addEventListener('click', function() {
        try { if (window.app) window.app.__drawerSkipRestoreOnce = true; } catch (_) {}
        if (window.app && window.app.drawer && typeof window.app.drawer.closeAllDrawers === 'function') {
          window.app.drawer.closeAllDrawers();
        }
        var coreApi = getCore();
        var switchTab = window.app && typeof window.app.switchTab === 'function'
          ? window.app.switchTab
          : (coreApi && typeof coreApi.switchTab === 'function' ? coreApi.switchTab : null);
        if (typeof switchTab === 'function') switchTab('tempexec');
      });
    }
    if (dom.autoCaseLibrarySelectBtn) {
      dom.autoCaseLibrarySelectBtn.addEventListener('click', function() {
        importSelectController.open();
      });
    }
    if (dom.caseLibraryImportSelectBtn) {
      dom.caseLibraryImportSelectBtn.addEventListener('click', function() {
        importSelectController.open();
      });
    }
    if (dom.writerDrawerOpenBtn) {
      dom.writerDrawerOpenBtn.addEventListener('click', function() {
        openCaseLibraryWriterStructure();
      });
    }
    missingReminderController.bindEvents();
    if (dom.aiGenBtn) {
      dom.aiGenBtn.addEventListener('click', function() {
        openCaseLibraryAiGenPrepAndRun();
      });
    }
    if (dom.xmindViewBtn) {
      dom.xmindViewBtn.addEventListener('click', function() {
        openCaseLibraryXmindStructure();
      });
    }
    if (dom.aiGenFileInput) {
      dom.aiGenFileInput.addEventListener('change', function(e) {
        var files = e && e.target && e.target.files ? e.target.files : null;
        var file = files && files[0] ? files[0] : null;
        if (file) handleCaseLibraryAiGenFile(file);
        try { e.target.value = ''; } catch (_) {}
      });
    }
    if (dom.aiGenDropZone) {
      dom.aiGenDropZone.addEventListener('click', function() {
        if (!dom.aiGenFileInput) return;
        if (hasNativeLabelTrigger(dom.aiGenDropZone, dom.aiGenFileInput)) return;
        dom.aiGenFileInput.click();
      });
      dom.aiGenDropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dom.aiGenDropZone.classList.add('dragover');
      });
      dom.aiGenDropZone.addEventListener('dragleave', function() {
        dom.aiGenDropZone.classList.remove('dragover');
      });
      dom.aiGenDropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dom.aiGenDropZone.classList.remove('dragover');
        var files = e && e.dataTransfer ? e.dataTransfer.files : null;
        var file = files && files[0] ? files[0] : null;
        if (file) handleCaseLibraryAiGenFile(file);
      });
    }
    if (dom.aiGenClearRequirementBtn) {
      dom.aiGenClearRequirementBtn.addEventListener('click', clearCaseLibraryAiGenRequirement);
    }
    if (dom.aiGenRequirementInput) {
      dom.aiGenRequirementInput.addEventListener('input', function() {
        aiGenController.setRequirementText(dom.aiGenRequirementInput.value || '');
      });
    }
    if (dom.aiGenRunBtn) {
      dom.aiGenRunBtn.addEventListener('click', runCaseLibraryAiGen);
    }
    if (dom.aiGenSelectAllBtn) {
      dom.aiGenSelectAllBtn.addEventListener('click', selectAllCaseLibraryAiGenCases);
    }
    if (dom.aiGenSelectNoneBtn) {
      dom.aiGenSelectNoneBtn.addEventListener('click', clearCaseLibraryAiGenSelection);
    }
    if (dom.aiGenDiscardBtn) {
      dom.aiGenDiscardBtn.addEventListener('click', function() {
        discardCaseLibraryAiGenResult({ keepRequirement: true });
      });
    }
    if (dom.aiGenRegenerateBtn) {
      dom.aiGenRegenerateBtn.addEventListener('click', handleCaseLibraryAiGenRegenerate);
    }
    if (dom.aiGenSelectAllToggle) {
      dom.aiGenSelectAllToggle.addEventListener('change', function() {
        if (dom.aiGenSelectAllToggle && dom.aiGenSelectAllToggle.checked) {
          selectAllCaseLibraryAiGenCases();
        } else {
          clearCaseLibraryAiGenSelection();
        }
      });
    }
    if (dom.aiGenResultBody) {
      dom.aiGenResultBody.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.getAttribute) return;
        var key = t.getAttribute('data-case-lib-ai-select');
        if (!key) return;
        if (t.getAttribute('data-ai-appended') === '1') {
          t.checked = false;
          return;
        }
        aiGenController.setSelection(key, t.checked);
      });
    }
    if (dom.aiGenAppendBtn) {
      dom.aiGenAppendBtn.addEventListener('click', function() {
        appendCaseLibraryAiGenSelection(dom.aiGenAppendBtn);
      });
    }

    if (dom.editDrawerConfirmBtn) {
      dom.editDrawerConfirmBtn.addEventListener('click', loadEditDrawerFiles);
    }
    if (dom.editDrawerProjectSelect) {
      dom.editDrawerProjectSelect.addEventListener('change', handleEditDrawerProjectChange);
    }
    if (dom.editDrawerVersionSelect) {
      dom.editDrawerVersionSelect.addEventListener('change', handleEditDrawerVersionChange);
    }
    if (dom.editDrawerChangeVersionSelect) {
      dom.editDrawerChangeVersionSelect.addEventListener('change', handleEditDrawerChangeVersionSelectChange);
    }
    if (dom.editDrawerOwnerFilterSelect) {
      dom.editDrawerOwnerFilterSelect.addEventListener('change', handleEditDrawerOwnerFilterChange);
    }
    if (dom.editDrawerFileSearchInput) {
      dom.editDrawerFileSearchInput.addEventListener('input', handleEditDrawerFileSearchInput);
    }
    if (dom.editDrawerChangeVersionBtn) {
      dom.editDrawerChangeVersionBtn.addEventListener('click', confirmEditDrawerChangeVersion);
    }
    if (dom.editDrawerShareBtn) {
      dom.editDrawerShareBtn.addEventListener('click', openShareDrawerFromSelection);
    }
    if (dom.editDrawerDeleteBtn) {
      dom.editDrawerDeleteBtn.addEventListener('click', deleteSelectedCaseFiles);
    }
    shareController.bindEvents();

    if (dom.editSearchInput) {
      dom.editSearchInput.addEventListener('input', function() {
        state.editor.searchText = dom.editSearchInput.value || '';
        state.editor.pageIndex = 0;
        renderEditorTable();
        syncEditorSearchControls();
      });
    }
    if (dom.editClearSearchBtn) {
      dom.editClearSearchBtn.addEventListener('click', function() {
        var prev = String(state.editor && state.editor.searchText ? state.editor.searchText : '');
        state.editor.searchText = '';
        state.editor.pageIndex = 0;
        if (dom.editSearchInput) {
          dom.editSearchInput.value = '';
          // 兼容输入法组合状态：强制结束当前输入并触发一次 input，使 UI 一定更新。
          try { dom.editSearchInput.blur(); } catch (_) {}
          try { dom.editSearchInput.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
        }
        renderEditorTable();
        syncEditorSearchControls();
        if (prev && prev.trim()) {
          setStatus(dom.editStatus, '已清空搜索', 'ok');
          setTimeout(function() {
            // 避免覆盖其它流程提示：仅在仍为本次清空提示时再清理。
            if (dom.editStatus && String(dom.editStatus.textContent || '') === '已清空搜索') {
              setStatus(dom.editStatus, '', '');
            }
          }, 1400);
        }
      });
    }
    if (dom.editDrawerExportXmindBtn) {
      dom.editDrawerExportXmindBtn.addEventListener('click', exportEditDrawerSelectionToXmind);
    }
	    if (dom.editDrawerExportExcelBtn) {
	      dom.editDrawerExportExcelBtn.addEventListener('click', exportEditDrawerSelectionToExcel);
	    }
	    if (dom.editBatchAddCountInput) {
	      dom.editBatchAddCountInput.addEventListener('input', function() {
	        setBatchAddCountInputInvalid(false);
	        var parsed = parseBatchAddCountInput(dom.editBatchAddCountInput.value);
	        if (!parsed.ok) return;
	        state.editor.batchAddCount = parsed.value;
	        persistEditorBatchAddCount(parsed.value);
	        syncEditorBatchAddControls();
	      });
	      dom.editBatchAddCountInput.addEventListener('blur', function() {
	        var parsed = parseBatchAddCountInput(dom.editBatchAddCountInput.value);
	        if (!parsed.ok) {
	          setBatchAddCountInputInvalid(true);
	          return;
	        }
	        setBatchAddCountInputInvalid(false);
	        state.editor.batchAddCount = parsed.value;
	        persistEditorBatchAddCount(parsed.value);
	        syncEditorBatchAddControls();
	      });
	    }
	    if (dom.editBatchAddBtn) {
	      dom.editBatchAddBtn.addEventListener('click', function(e) {
	        var t = e && e.currentTarget ? e.currentTarget : null;
	        batchInsertCaseItems(t);
	      });
	    }
		    if (dom.editToExecBtn) {
		      dom.editToExecBtn.addEventListener('click', function() {
		        var file = state.editor.caseFile;
		        if (!file) {
	          setStatus(dom.editStatus, '请先选择用例', 'warn');
	          return;
	        }
            var pid = file.project_id || null;
            if (!pid) {
              setStatus(dom.editStatus, '用例项目缺失，无法转到执行', 'err');
              return;
            }
            var importVid = file.version_id || null;
            var importVerName = getVersionName(pid, importVid) || '';
            openExecVersionSelectDrawer(pid, {
              title: '选择执行版本',
              importVersionId: importVid,
              importVersionName: importVerName || '',
            }).then(function(res) {
              if (!res || res.ok !== true) {
                setStatus(dom.editStatus, '已取消转到执行', 'warn');
                return;
              }
              var execVid = Object.prototype.hasOwnProperty.call(res, 'versionId') ? res.versionId : (res.exec_version_id || null);
              transferItemsToTempExec(
                file,
                file.file_name_clean || ('用例#' + file.id),
                state.editor.items || [],
                { execVersionId: execVid, previousDrawer: editDrawerInstance || null, openAssignDrawer: true }
              );
            });
		      });
		    }
	    if (dom.editBatchDeleteBtn) {
	      dom.editBatchDeleteBtn.addEventListener('click', function(e) {
	        var t = e && e.currentTarget ? e.currentTarget : null;
	        removeSelectedCaseItems(t);
	      });
	    }
    missingDrawerController.bindEvents();
    missingCatalogMaintenanceController.bindEvents();
    missingViewController.bindEvents();

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('case-library-ai-gen-task', function(e) {
        var detail = e && e.detail ? e.detail : null;
        if (!detail || detail.scene !== 'case-library') return;
        aiGenController.applyTaskState(detail.task);
      });
    }

    selectExecDrawerControllerInstance.bindEvents();
    associationWorkflowController.bindEvents();
    importSelectController.bindEvents();
    historyDrawerController.bindEvents();
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('click', function(e) {
        var target = e && e.target ? e.target : null;
        var btn = target && target.closest ? target.closest('[data-case-lib-drawer-page]') : null;
        if (!btn || !btn.getAttribute) return;
        var scope = btn.getAttribute('data-case-lib-drawer-scope') || '';
        var action = btn.getAttribute('data-case-lib-drawer-page') || '';
        if (!action) return;
        if (scope === 'import-select') importSelectController.handlePaginationAction(action);
        else if (scope === 'missing') missingDrawerController.handlePaginationAction(action);
      });
      document.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.hasAttribute) return;
        if (!t.hasAttribute('data-case-lib-drawer-page-input')) return;
        var scope = t.getAttribute('data-case-lib-drawer-scope') || '';
        if (scope === 'import-select') importSelectController.handlePaginationJump(t.value);
        else if (scope === 'missing') missingDrawerController.handlePaginationJump(t.value);
      });
    }
  }

  var pendingCaseLibraryTab = false;
  var autoRestoreAttempt = 0;
  var autoRestoreTimer = null;
  var restoreAfterActivatedPromise = null;

		  function restoreCaseLibraryAfterActivated() {
		    if (restoreAfterActivatedPromise) return restoreAfterActivatedPromise;
		    restoreAfterActivatedPromise = (function() {
          var pendingMissingDrawer = peekMissingDrawerRequest();
          if (pendingMissingDrawer && state.missingDrawer) {
            state.missingDrawer.keepOpenOnce = true;
          }
		      if (!isAuthReady()) {
		        pendingCaseLibraryTab = true;
		        setStatus(dom.status, '登录信息加载中...', '');
		        return Promise.resolve(null);
		      }
		      pendingCaseLibraryTab = false;
		      restoreEditorBatchAddCountFromPersistedState();
		      return ensureProjectsReady()
		        .then(function() { return restoreCaseLibraryLastSelection(); })
		        .then(function(view) {
          if (consumeSelectExecDrawerRequest()) {
            openSelectExecDrawerDirect();
            return view;
          }
          if (consumeMissingDrawerRequest()) {
            scheduleMissingDrawerOpen({ attempts: 4, intervalMs: 180 });
            if (state.missingDrawer) state.missingDrawer.keepOpenOnce = false;
            return view;
          }
		          var persisted = readEditDrawerPersistedState();
		          var userId = getCurrentUserId();
		          var shouldOpen = Boolean(persisted && userId && String(persisted.user_id || '') === String(userId) && persisted.drawer_open === true);
		          var hasEditor = Boolean(state.editor && state.editor.caseFile && state.editor.caseFile.id);
          var inHistoryView = view === 'history' || isHistoryDetailVisible();
          var inMissingView = view === 'missing' || isMissingCardVisible();
          // 仅当不在历史详情视图时，才根据持久化状态自动打开“查看&编辑”抽屉。
          // 例如：仅在抽屉内勾选/导出后刷新，也应保持抽屉开启与勾选状态。
          if (!inHistoryView && !inMissingView && shouldOpen && !hasEditor && editDrawerInstance && typeof editDrawerInstance.open === 'function') {
            editDrawerInstance.open();
          }
		          return view;
		        });
		    })();
		    return restoreAfterActivatedPromise.finally(function() {
		      syncCaseLibraryAiGenContext();
		      syncCaseLibraryAiGenTaskState();
		      restoreAfterActivatedPromise = null;
		    });
		  }

  function scheduleAutoRestoreProbe() {
    if (autoRestoreTimer) return;
    autoRestoreAttempt = 0;
    var maxAttempts = 150;
    var intervalMs = 200;

    function clearProbe() {
      if (autoRestoreTimer) clearTimeout(autoRestoreTimer);
      autoRestoreTimer = null;
    }

    function tick() {
      autoRestoreAttempt += 1;
      if (autoRestoreAttempt > maxAttempts) return clearProbe();

      var visible = document.querySelector('section[data-tab-section=\"case-library\"]:not(.hidden)');
      if (visible && isAuthReady()) {
        clearProbe();
        restoreCaseLibraryAfterActivated();
        return;
      }
      autoRestoreTimer = setTimeout(tick, intervalMs);
    }

    autoRestoreTimer = setTimeout(tick, 0);
  }

  function bindTabActivation() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('app-tab-activated', function(e) {
      var tabName = e && e.detail ? e.detail.tab : '';
      if (tabName !== 'case-library') return;
      restoreCaseLibraryAfterActivated();
    });
    window.addEventListener('app-page-size-changed', function() {
      handlePageSizeChanged();
    });
    window.addEventListener('app-auth-ready', function() {
      var globalState = window.app && window.app.state ? window.app.state : {};
      var tabName = globalState && globalState.activeTab ? globalState.activeTab : '';
      var visible = document.querySelector('section[data-tab-section=\"case-library\"]:not(.hidden)');
      if (tabName === 'case-library' || pendingCaseLibraryTab || visible) {
        restoreCaseLibraryAfterActivated();
      }
    });
  }

  function initDrawerOnly() {
    var hasSelectDrawer = Boolean(document.getElementById('caseLibrarySelectExecDrawer'));
    var hasAssociationDrawer = Boolean(document.getElementById('caseLibraryAssociationDrawer'));
    var hasAssociationPickDrawer = Boolean(document.getElementById('caseLibraryAssociationPickDrawer'));
    var hasAssociationItemDrawer = Boolean(document.getElementById('caseLibraryAssociationItemDrawer'));
    var hasAssociationDeleteConfirmDrawer = Boolean(document.getElementById('caseLibraryAssociationDeleteConfirmDrawer'));
    var hasImportSelectDrawer = Boolean(document.getElementById('caseLibraryImportSelectDrawer'));
    var hasImportDiffDrawer = Boolean(document.getElementById('caseLibraryImportDiffDrawer'));
    var hasImportInvalidDrawer = Boolean(document.getElementById('caseLibraryImportInvalidDrawer'));
    if (!hasSelectDrawer && !hasAssociationDrawer && !hasAssociationPickDrawer && !hasAssociationItemDrawer && !hasAssociationDeleteConfirmDrawer && !hasImportSelectDrawer && !hasImportDiffDrawer && !hasImportInvalidDrawer) return false;

    if (hasSelectDrawer) {
      selectExecDrawerControllerInstance.initDrawer();
    }

    if (hasAssociationDrawer) {
      associationDrawerInstance = ensureDrawer('caseLibraryAssociationDrawer', [], null, function() {
        associationWorkflowController.resetMain();
      });
    }

    if (hasAssociationPickDrawer) {
      associationPickDrawerInstance = ensureDrawer('caseLibraryAssociationPickDrawer', [], null, function() {
        associationWorkflowController.handlePickDrawerClose();
      });
    }

    if (hasAssociationItemDrawer) {
      associationItemDrawerInstance = ensureDrawer('caseLibraryAssociationItemDrawer', [], null, function() {
        associationWorkflowController.handleItemDrawerClose();
      });
    }

    if (hasAssociationDeleteConfirmDrawer) {
      associationDeleteConfirmDrawerInstance = ensureDrawer('caseLibraryAssociationDeleteConfirmDrawer', [], null, function() {
        associationWorkflowController.handleDeleteDrawerClose();
      });
    }

    if (hasImportSelectDrawer) {
      importSelectDrawerInstance = ensureDrawer('caseLibraryImportSelectDrawer', [], function() {
        importSelectController.prepare();
      }, importSelectController.handleClose);
    }
    importReviewController.initDrawers();

    bindEvents();
    window.app = window.app || {};
    window.app.caseLibraryApi = window.app.caseLibraryApi || {};
    window.app.caseLibraryApi.openSelectExecDrawer = openSelectExecDrawer;
    window.app.caseLibraryApi.requestSelectExecDrawer = markSelectExecDrawerRequest;
    window.app.caseLibraryApi.openMissingDrawer = openMissingDrawer;
    window.app.caseLibraryApi.openWriterDrawer = openCaseLibraryWriterStructure;
    window.app.caseLibraryApi.requestMissingDrawer = markMissingDrawerRequest;
    if (hasImportSelectDrawer) {
      window.app.caseLibraryApi.openImportSelectDrawer = importSelectController.open;
    }
    if (hasImportDiffDrawer) {
      window.app.caseLibraryApi.openImportDiffForExternal = importReviewController.openImportDiffForExternal;
      window.app.caseLibraryApi.openAppendDiffForExternal = importReviewController.openAppendDiffForExternal;
    }
    return true;
  }

  function init() {
    if (!dom.root) {
      if (initDrawerOnly()) return;
      return;
    }

  // 兜底：本地静态资源偶发空响应时，提前触发一次导出依赖补拉，避免导出按钮处报“缺少依赖”。
  ensureExportDepsReady();

	    importDrawerInstance = ensureDrawer('caseLibraryImportDrawer', ['openCaseLibraryImportDrawerBtn'], function() {
	      ensureProjectsReady().then(resetImportDrawer);
	    });
    importReviewController.initDrawers();
    writerPublishController.initDrawer();
    editDrawerInstance = ensureDrawer(
      'caseLibraryEditDrawer',
      ['openCaseLibraryEditDrawerBtn'],
      function() {
        markCaseLibraryAiGenNavBadgeRead();
        var prevPersisted = readEditDrawerPersistedState();
        editDrawerOpenPromise = ensureProjectsReady().then(function() {
	          // 进入“查看&编辑”抽屉也视为 editor 视图，刷新应能按最后操作恢复并自动打开抽屉。
	          persistCaseLibraryLastView('editor');
	          resetEditDrawer();
	          return restoreEditDrawerFromPersistedState()
	            .then(function(restored) {
	              if (restored) {
	                persistEditDrawerState({ drawer_open: true });
                return;
              }
              // 恢复失败时尽量不覆盖旧选择，仅更新 open 状态。
              var userId = getCurrentUserId();
              if (
                prevPersisted &&
                userId &&
                String(prevPersisted.user_id || '') === String(userId)
              ) {
                prevPersisted.drawer_open = true;
                writeEditDrawerPersistedState(prevPersisted);
              } else {
                persistEditDrawerState({ drawer_open: true });
              }
            });
        });
      },
      function() {
        persistEditDrawerState({ drawer_open: false });
      }
    );
    missingDrawerInstance = ensureDrawer(
      'caseLibraryMissingDrawer',
      ['openCaseLibraryMissingDrawerBtn'],
      function() {
        ensureProjectsReady().then(function() {
          missingDrawerController.prepare();
        });
      }
    );
    missingCatalogMaintenanceController.initDrawers();
    shareController.initDrawer();
    selectExecDrawerControllerInstance.initDrawer();
    associationDrawerInstance = ensureDrawer('caseLibraryAssociationDrawer', [], null, function() {
      associationWorkflowController.resetMain();
    });
    associationPickDrawerInstance = ensureDrawer('caseLibraryAssociationPickDrawer', [], null, function() {
      associationWorkflowController.handlePickDrawerClose();
    });
    associationItemDrawerInstance = ensureDrawer('caseLibraryAssociationItemDrawer', [], null, function() {
      associationWorkflowController.handleItemDrawerClose();
    });
    associationDeleteConfirmDrawerInstance = ensureDrawer('caseLibraryAssociationDeleteConfirmDrawer', [], null, function() {
      associationWorkflowController.handleDeleteDrawerClose();
    });
    importSelectDrawerInstance = ensureDrawer('caseLibraryImportSelectDrawer', [], function() {
      importSelectController.prepare();
    }, importSelectController.handleClose);
    historyDrawerController.initDrawer();

    bindEvents();
    bindTabActivation();
    bindProjectsUpdated();
    bindUnloadPersistence();
    syncCaseLibraryAiGenContext();
    syncCaseLibraryAiGenTaskState();

    // 兜底：某些时序下可能错过 app-tab-activated/app-auth-ready，短窗口轮询一次“是否需要恢复”。
    scheduleAutoRestoreProbe();
    window.app = window.app || {};
    window.app.caseLibraryApi = window.app.caseLibraryApi || {};
    window.app.caseLibraryApi.openSelectExecDrawer = openSelectExecDrawer;
    window.app.caseLibraryApi.requestSelectExecDrawer = markSelectExecDrawerRequest;
    window.app.caseLibraryApi.openMissingDrawer = openMissingDrawer;
    window.app.caseLibraryApi.openWriterDrawer = openCaseLibraryWriterStructure;
    window.app.caseLibraryApi.requestMissingDrawer = markMissingDrawerRequest;
    window.app.caseLibraryApi.openImportSelectDrawer = importSelectController.open;
    window.app.caseLibraryApi.openImportDiffForExternal = importReviewController.openImportDiffForExternal;
    window.app.caseLibraryApi.openAppendDiffForExternal = importReviewController.openAppendDiffForExternal;
    window.app.caseLibraryApi.downloadImportExcelTemplate = downloadImportExcelTemplate;
    window.app.caseLibraryApi.downloadImportXmindTemplate = downloadImportXmindTemplate;
    window.app.caseLibraryApi.buildSimpleXlsxBlob = buildSimpleXlsxBlob;
    window.app.caseLibraryBound = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
