(function() {
  var apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
  if (!apiClient) return;

  var utils = window.app && window.app.utils ? window.app.utils : {};

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
    if (window.app && window.app.drawer && typeof window.app.drawer.closeAllDrawers === 'function') {
      window.app.drawer.closeAllDrawers();
    }
    if (selectDrawerInstance && typeof selectDrawerInstance.open === 'function') {
      selectDrawerInstance.open();
      return true;
    }
    var fallbackBtn = document.getElementById('openCaseLibrarySelectExecDrawerBtn');
    if (fallbackBtn && typeof fallbackBtn.click === 'function') {
      fallbackBtn.click();
      return true;
    }
    return false;
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
    aiGenSelectAllToggle: document.getElementById('caseLibraryAiGenSelectAllToggle'),
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
    importDiffBody: document.getElementById('caseLibraryImportDiffBody'),
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
    selectVersionSelect: document.getElementById('caseLibrarySelectVersionSelect'),
    selectSearchInput: document.getElementById('caseLibrarySelectSearchInput'),
    selectConfirmBtn: document.getElementById('caseLibrarySelectConfirmBtn'),
    selectSelectAll: document.getElementById('caseLibrarySelectSelectAll'),
    selectBatchExecBtn: document.getElementById('caseLibrarySelectBatchExecBtn'),
    selectStatus: document.getElementById('caseLibrarySelectDrawerStatus'),
    selectListBody: document.getElementById('caseLibrarySelectListBody'),
    selectPaginationTop: document.getElementById('caseLibrarySelectDrawerPaginationTop'),
    selectPaginationBottom: document.getElementById('caseLibrarySelectDrawerPaginationBottom'),

    associationCaseName: document.getElementById('caseLibraryAssociationCaseName'),
    associationStatus: document.getElementById('caseLibraryAssociationStatus'),
    associationAddBtn: document.getElementById('caseLibraryAssociationAddBtn'),
    associationListBody: document.getElementById('caseLibraryAssociationListBody'),

    associationPickStatus: document.getElementById('caseLibraryAssociationPickStatus'),
    associationPickVersionSelect: document.getElementById('caseLibraryAssociationPickVersionSelect'),
    associationPickSearchInput: document.getElementById('caseLibraryAssociationPickSearchInput'),
    associationPickRefreshBtn: document.getElementById('caseLibraryAssociationPickRefreshBtn'),
    associationPickQueryBtn: document.getElementById('caseLibraryAssociationPickQueryBtn'),
    associationPickNextBtn: document.getElementById('caseLibraryAssociationPickNextBtn'),
    associationPickCaseBody: document.getElementById('caseLibraryAssociationPickCaseBody'),
    associationPickSubCaseName: document.getElementById('caseLibraryAssociationPickSubCaseName'),
    associationPickSelectAll: document.getElementById('caseLibraryAssociationPickSelectAll'),
    associationPickItemBody: document.getElementById('caseLibraryAssociationPickItemBody'),
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
    historyDrawerListBody: document.getElementById('caseLibraryHistoryDrawerListBody'),
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
    historyBody: document.getElementById('caseLibraryHistoryBody'),
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
      pendingResolve: null,
      pendingReject: null,
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
	      rows: [],
	      loading: false,
        confirming: false,
        locateIndex: -1,
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

    selectDrawer: {
      projectId: null,
      versionId: null,
      searchText: '',
      searchPrevVersionId: null,
      files: [],
      execByFileId: {},
      loading: false,
      processing: false,
      selection: new Set(),
      pageIndex: 0,
      associationSwitchByFileId: {},
      associationExecIntent: null,
    },

    associationDrawer: {
      caseFile: null,
      rows: [],
      loading: false,
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
      queried: false,
      candidateRows: [],
      filteredRows: [],
      loadingCases: false,
      loadingItems: false,
      processing: false,
      searchText: '',
      selection: new Set(),
      items: [],
      pageIndex: 0,
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
      files: [],
      loading: false,
      searchText: '',
      pageIndex: 0,
    },

    historyDetail: {
      projectId: null,
      fileNameClean: '',
      isDeleted: false,
      versionId: null,
      history: [],
      filter: '',
      loading: false,
      pageIndex: 0,
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

	  var importDrawerInstance = null;
  var importDiffDrawerInstance = null;
  var importDiffDrawerOpenTimer = 0;
  var importInvalidDrawerInstance = null;
  var writerPublishDrawerInstance = null;
  var writerPublishFileNameCheckTimer = 0;
  var writerPublishFileNameCheckSeq = 0;
  var aiGenDrawerInstance = null;
  var xmindStructureDrawerInstance = null;
  var caseLibraryXmindMindInstance = null;
  var caseLibraryXmindThemeObserver = null;
  var caseLibraryXmindGestureGuard = {
    active: false,
    token: '',
    popHandler: null,
    restoring: false,
  };
  var editDrawerInstance = null;
  var missingDrawerInstance = null;
  var missingAddDrawerInstance = null;
  var missingEditDrawerInstance = null;
  var missingTypeAddDrawerInstance = null;
  var missingTypeManageDrawerInstance = null;
  var shareDrawerInstance = null;
	  var selectDrawerInstance = null;
  var associationDrawerInstance = null;
  var associationPickDrawerInstance = null;
  var associationItemDrawerInstance = null;
  var associationDeleteConfirmDrawerInstance = null;
    var importSelectDrawerInstance = null;
    var historyDrawerInstance = null;

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

  function normalizeDiffText(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\r\n/g, '\n').trim();
  }

  function buildCaseItemKey(item) {
    if (!item) return '';
    var module = normalizeDiffText(item.module || item.module_name || '').toLowerCase();
    var title = normalizeDiffText(item.title || '').toLowerCase();
    var precondition = normalizeDiffText(item.precondition || item.preconditions || '').toLowerCase();
    var steps = normalizeDiffText(item.steps || '').toLowerCase();
    var expected = normalizeDiffText(item.expected || '').toLowerCase();
    return [module, title, precondition, steps, expected].join('::');
  }

  function dedupeCaseItemsByKey(list) {
    var items = Array.isArray(list) ? list : [];
    var seen = {};
    var out = [];
    items.forEach(function(it) {
      var k = buildCaseItemKey(it);
      if (!k) return;
      if (seen[k]) return;
      seen[k] = true;
      out.push(it);
    });
    return out;
  }

  function compareCaseItemFields(left, right) {
    var diff = {
      priority: false,
      precondition: false,
      steps: false,
    };
    if (!left || !right) return diff;
    diff.priority = normalizeDiffText(left.priority || '') !== normalizeDiffText(right.priority || '');
    diff.precondition = normalizeDiffText(left.precondition || left.preconditions || '') !== normalizeDiffText(right.precondition || right.preconditions || '');
    diff.steps = normalizeDiffText(left.steps || '') !== normalizeDiffText(right.steps || '');
    return diff;
  }

  function compareCaseItemFieldsForAppendOverwrite(left, right) {
    var diff = {
      priority: false,
      precondition: false,
      steps: false,
      expected: false,
      remark: false,
    };
    if (!left || !right) return diff;
    diff.priority = normalizeDiffText(left.priority || '') !== normalizeDiffText(right.priority || '');
    diff.precondition = normalizeDiffText(left.precondition || left.preconditions || '') !== normalizeDiffText(right.precondition || right.preconditions || '');
    diff.steps = normalizeDiffText(left.steps || '') !== normalizeDiffText(right.steps || '');
    diff.expected = normalizeDiffText(left.expected || '') !== normalizeDiffText(right.expected || '');
    diff.remark = normalizeDiffText(left.remark || '') !== normalizeDiffText(right.remark || '');
    return diff;
  }

  function buildImportDiffRows(importItems, dbItems) {
    var leftList = dedupeCaseItemsByKey(importItems);
    var rightList = dedupeCaseItemsByKey(dbItems);
    var leftMap = {};
    var rightMap = {};
    leftList.forEach(function(it) {
      var k = buildCaseItemKey(it);
      if (!k) return;
      leftMap[k] = it;
    });
    rightList.forEach(function(it) {
      var k = buildCaseItemKey(it);
      if (!k) return;
      rightMap[k] = it;
    });
    var keys = {};
    Object.keys(leftMap).forEach(function(k) { keys[k] = true; });
    Object.keys(rightMap).forEach(function(k) { keys[k] = true; });
    var keyList = Object.keys(keys);
    keyList.sort(function(a, b) {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
    return keyList.map(function(k) {
      var left = leftMap[k] || null;
      var right = rightMap[k] || null;
      var rowType = '';
      var fieldDiff = compareCaseItemFields(left, right);
      var changed = Boolean(fieldDiff.priority || fieldDiff.precondition || fieldDiff.steps);
      if (left && !right) rowType = 'added';
      else if (!left && right) rowType = 'removed';
      else if (left && right && changed) rowType = 'changed';
      else rowType = 'same';
      return {
        key: k,
        left: left,
        right: right,
        type: rowType,
        diff: fieldDiff,
      };
    });
  }

  function buildAppendOverwriteDiffRows(appendItems, dbItems) {
    var leftList = Array.isArray(appendItems) ? appendItems : [];
    var rightList = Array.isArray(dbItems) ? dbItems : [];
    var leftMap = {};
    var rightMap = {};
    leftList.forEach(function(it) {
      var k = buildCaseItemKey(it);
      if (!k) return;
      if (leftMap[k]) return;
      leftMap[k] = it;
    });
    rightList.forEach(function(it) {
      var k = buildCaseItemKey(it);
      if (!k) return;
      if (rightMap[k]) return;
      rightMap[k] = it;
    });
    var keys = {};
    Object.keys(leftMap).forEach(function(k) { keys[k] = true; });
    Object.keys(rightMap).forEach(function(k) { keys[k] = true; });
    var keyList = Object.keys(keys);
    keyList.sort(function(a, b) {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
    return keyList.map(function(k) {
      var left = leftMap[k] || null;
      var right = rightMap[k] || null;
      var rowType = '';
      var fieldDiff = compareCaseItemFieldsForAppendOverwrite(left, right);
      var changed = Boolean(fieldDiff.priority || fieldDiff.precondition || fieldDiff.steps || fieldDiff.expected || fieldDiff.remark);
      if (left && !right) rowType = 'added';
      else if (left && right && changed) rowType = 'changed';
      else rowType = 'same';
      return {
        key: k,
        left: left,
        right: right,
        type: rowType,
        diff: fieldDiff,
      };
    });
  }

  function countUniqueCaseItemsByKey(list) {
    var items = Array.isArray(list) ? list : [];
    var seen = {};
    items.forEach(function(it) {
      var k = buildCaseItemKey(it);
      if (!k) return;
      if (seen[k]) return;
      seen[k] = true;
    });
    return Object.keys(seen).length;
  }

  function renderImportDiffTable(bodyEl, rows, side) {
    if (!bodyEl) return;
    if (!rows || !rows.length) {
      bodyEl.innerHTML = '<tr><td colspan="7"><p class="hint">暂无数据</p></td></tr>';
      return;
    }
    bodyEl.innerHTML = rows.map(function(row, idx) {
      var item = side === 'left' ? row.left : row.right;
      var other = side === 'left' ? row.right : row.left;
      var isPlaceholder = !item;
      var rowCls = '';
      if (row.type === 'added' && side === 'left') rowCls = 'diff-row-added';
      if (row.type === 'removed' && side === 'right') rowCls = 'diff-row-removed';
      if (row.type === 'changed') rowCls = 'diff-row-changed';

      var module = item ? (item.module || '') : '';
      var title = item ? (item.title || '') : '';
      var expected = item ? (item.expected || '') : '';
      var priority = item ? (item.priority || '') : '';
      var precondition = item ? (item.precondition || item.preconditions || '') : '';
      var steps = item ? (item.steps || '') : '';

      var priorityCls = '';
      var preconditionCls = '';
      var stepsCls = '';
      if (!isPlaceholder && other && row.type === 'changed') {
        if (row.diff && row.diff.priority) priorityCls = 'diff-cell-changed';
        if (row.diff && row.diff.precondition) preconditionCls = 'diff-cell-changed';
        if (row.diff && row.diff.steps) stepsCls = 'diff-cell-changed';
      }

      var hint = isPlaceholder ? '<p class="hint">（无对应项）</p>' : '';
      return (
        '<tr class="' + escapeHtml(rowCls) + '">' +
          '<td>' + escapeHtml(String(idx + 1)) + '</td>' +
          '<td>' + escapeHtml(module) + '</td>' +
          '<td>' + escapeHtml(title) + hint + '</td>' +
          '<td class="' + escapeHtml(priorityCls) + '">' + escapeHtml(priority) + '</td>' +
          '<td class="' + escapeHtml(preconditionCls) + '">' + escapeHtml(precondition) + '</td>' +
          '<td class="' + escapeHtml(stepsCls) + '">' + escapeHtml(steps) + '</td>' +
          '<td>' + escapeHtml(expected) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function renderImportDiffMergedTable(bodyEl, rows) {
    if (!bodyEl) return;
    if (!rows || !rows.length) {
      bodyEl.innerHTML = '<tr><td colspan="7"><p class="hint">暂无数据</p></td></tr>';
      return;
    }

    function buildValueBlock(leftText, rightText, placeholderText) {
      var left = normalizeDiffText(leftText);
      var right = normalizeDiffText(rightText);
      if (!left && !right) {
        return '<div class="diff-one"><p class="hint">' + escapeHtml(placeholderText || '--') + '</p></div>';
      }
      if (left && right) {
        if (left === right) {
          return '<div class="diff-one">' + escapeHtml(left) + '</div>';
        }
        return (
          '<div class="diff-pair">' +
            '<div class="diff-pair-line diff-pair-left"><span class="diff-pair-tag">导入</span><div class="diff-pair-text">' + escapeHtml(left) + '</div></div>' +
            '<div class="diff-pair-line diff-pair-right"><span class="diff-pair-tag">库</span><div class="diff-pair-text">' + escapeHtml(right) + '</div></div>' +
          '</div>'
        );
      }
      if (left) {
        return (
          '<div class="diff-one diff-one-with-tag">' +
            '<span class="diff-pair-tag">导入</span>' +
            '<div class="diff-pair-text">' + escapeHtml(left) + '</div>' +
          '</div>'
        );
      }
      return (
        '<div class="diff-one diff-one-with-tag">' +
          '<span class="diff-pair-tag">库</span>' +
          '<div class="diff-pair-text">' + escapeHtml(right) + '</div>' +
        '</div>'
      );
    }

    bodyEl.innerHTML = rows.map(function(row, idx) {
      var left = row ? row.left : null;
      var right = row ? row.right : null;
      var rowCls = '';
      if (row && row.type === 'added') rowCls = 'diff-row-added';
      if (row && row.type === 'removed') rowCls = 'diff-row-removed';
      if (row && row.type === 'changed') rowCls = 'diff-row-changed';

      var priorityCls = '';
      var preconditionCls = '';
      var stepsCls = '';
      if (row && row.type === 'changed') {
        if (row.diff && row.diff.priority) priorityCls = 'diff-cell-changed';
        if (row.diff && row.diff.precondition) preconditionCls = 'diff-cell-changed';
        if (row.diff && row.diff.steps) stepsCls = 'diff-cell-changed';
      }

      var badge = '';
      if (row && row.type === 'added') badge = '<span class="diff-badge diff-badge-added">新增</span>';
      else if (row && row.type === 'removed') badge = '<span class="diff-badge diff-badge-removed">将删除</span>';
      else if (row && row.type === 'changed') badge = '<span class="diff-badge diff-badge-changed">有差异</span>';

      return (
        '<tr class="' + escapeHtml(rowCls) + '">' +
          '<td>' + escapeHtml(String(idx + 1)) + '</td>' +
          '<td>' + buildValueBlock(left && left.module, right && right.module, '（缺失）') + '</td>' +
          '<td>' +
            '<div class="diff-cell-stack">' +
              buildValueBlock(left && left.title, right && right.title, '（缺失）') +
              (badge ? ('<div class="diff-badge-row">' + badge + '</div>') : '') +
            '</div>' +
          '</td>' +
          '<td class="' + escapeHtml(priorityCls) + '">' + buildValueBlock(left && left.priority, right && right.priority, '--') + '</td>' +
          '<td class="' + escapeHtml(preconditionCls) + '">' + buildValueBlock(left && (left.precondition || left.preconditions), right && (right.precondition || right.preconditions), '--') + '</td>' +
          '<td class="' + escapeHtml(stepsCls) + '">' + buildValueBlock(left && left.steps, right && right.steps, '--') + '</td>' +
          '<td>' + buildValueBlock(left && left.expected, right && right.expected, '（缺失）') + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  var importDiffLocateHighlightTimer = null;
  function clearImportDiffLocateHighlight() {
    if (importDiffLocateHighlightTimer) clearTimeout(importDiffLocateHighlightTimer);
    importDiffLocateHighlightTimer = null;
    if (!dom.importDiffBody || !dom.importDiffBody.querySelectorAll) return;
    var active = dom.importDiffBody.querySelectorAll('tr.diff-locate-active');
    active.forEach(function(tr) {
      if (!tr || !tr.classList) return;
      tr.classList.remove('diff-locate-active');
    });
  }

  function getImportDiffRowEls() {
    if (!dom.importDiffBody || !dom.importDiffBody.querySelectorAll) return [];
    return Array.prototype.slice.call(
      dom.importDiffBody.querySelectorAll('tr.diff-row-added, tr.diff-row-removed, tr.diff-row-changed')
    );
  }

  function isAnyImportDiffRowInView(rows, containerEl) {
    var list = Array.isArray(rows) ? rows : [];
    if (!list.length || !containerEl || !containerEl.getBoundingClientRect) return false;
    var crect = containerEl.getBoundingClientRect();
    var top = crect.top + 60;
    var bottom = crect.bottom - 40;
    for (var i = 0; i < list.length; i += 1) {
      var row = list[i];
      if (!row || !row.getBoundingClientRect) continue;
      var r = row.getBoundingClientRect();
      if (r.bottom > top && r.top < bottom) return true;
    }
    return false;
  }

  function buildImportDiffLocateBarHtml() {
    if (!dom.importDiffLocateBar) return '';
    var rows = Array.isArray(state.importDiff.rows) ? state.importDiff.rows : [];
    var added = rows.filter(function(r) { return r && r.type === 'added'; }).length;
    var removed = rows.filter(function(r) { return r && r.type === 'removed'; }).length;
    var changed = rows.filter(function(r) { return r && r.type === 'changed'; }).length;
    var total = added + removed + changed;
    if (!total) {
      return (
        '<div class="diff-locate-info">差异定位</div>' +
        '<div class="diff-locate-empty">暂无差异</div>'
      );
    }
    var current = Number.isInteger(state.importDiff.locateIndex) ? state.importDiff.locateIndex : -1;
    var posText = current >= 0 ? ('位置 ' + String(current + 1) + '/' + String(total)) : ('位置 --/' + String(total));
    var hasCurrent = current >= 0;
    var disablePrev = !hasCurrent || current <= 0;
    var disableNext = hasCurrent && current >= total - 1;
    var disableFirst = hasCurrent && current <= 0;
    var disableLast = hasCurrent && current >= total - 1;
    return (
      '<div class="diff-locate-info">差异定位：新增 ' + String(added) +
        ' / 删除 ' + String(removed) +
        ' / 差异 ' + String(changed) +
        '，共 ' + String(total) + ' 处</div>' +
      '<div class="diff-locate-controls">' +
        '<button type="button" class="secondary" data-diff-locate-scope="case-library-import-diff" data-diff-locate-action="first" ' + (disableFirst ? 'disabled' : '') + '>首处</button>' +
        '<button type="button" class="secondary" data-diff-locate-scope="case-library-import-diff" data-diff-locate-action="prev" ' + (disablePrev ? 'disabled' : '') + '>上一处</button>' +
        '<button type="button" class="secondary" data-diff-locate-scope="case-library-import-diff" data-diff-locate-action="next" ' + (disableNext ? 'disabled' : '') + '>下一处</button>' +
        '<button type="button" class="secondary" data-diff-locate-scope="case-library-import-diff" data-diff-locate-action="last" ' + (disableLast ? 'disabled' : '') + '>末处</button>' +
        '<span class="diff-locate-pos" data-diff-locate-pos>' + escapeHtml(posText) + '</span>' +
        '<span class="diff-locate-hint hidden" data-diff-locate-hint></span>' +
      '</div>'
    );
  }

  function renderImportDiffLocateBar() {
    if (!dom.importDiffLocateBar) return;
    dom.importDiffLocateBar.innerHTML = buildImportDiffLocateBarHtml();
    updateImportDiffLocateHint();
  }

  function updateImportDiffLocateHint() {
    if (!dom.importDiffLocateBar || !dom.importDiffLocateBar.querySelector) return;
    var hintEl = dom.importDiffLocateBar.querySelector('[data-diff-locate-hint]');
    if (!hintEl) return;
    var rows = Array.isArray(state.importDiff.rows) ? state.importDiff.rows : [];
    var added = rows.filter(function(r) { return r && r.type === 'added'; }).length;
    var removed = rows.filter(function(r) { return r && r.type === 'removed'; }).length;
    var changed = rows.filter(function(r) { return r && r.type === 'changed'; }).length;
    var total = added + removed + changed;
    if (!total) {
      hintEl.textContent = '';
      if (hintEl.classList) hintEl.classList.add('hidden');
      return;
    }
    var drawerEl = document.getElementById('caseLibraryImportDiffDrawer');
    var bodyEl = drawerEl ? drawerEl.querySelector('.drawer-body') : null;
    var inView = isAnyImportDiffRowInView(getImportDiffRowEls(), bodyEl);
    var hint = inView ? '' : '当前视口无差异，可点击“下一处”定位';
    hintEl.textContent = hint;
    if (!hintEl.classList) return;
    hintEl.classList.toggle('hidden', !hint);
  }

  function jumpToImportDiffAt(index) {
    var rows = getImportDiffRowEls();
    if (!rows.length) return;
    var idx = Number(index);
    if (!Number.isFinite(idx)) idx = 0;
    if (idx < 0) idx = 0;
    if (idx >= rows.length) idx = rows.length - 1;
    state.importDiff.locateIndex = idx;
    clearImportDiffLocateHighlight();
    var row = rows[idx];
    if (row && row.scrollIntoView) {
      try { row.scrollIntoView({ block: 'center' }); } catch (e) { row.scrollIntoView(); }
    }
    if (row && row.classList) row.classList.add('diff-locate-active');
    importDiffLocateHighlightTimer = setTimeout(function() {
      if (row && row.classList) row.classList.remove('diff-locate-active');
    }, 2000);
    renderImportDiffLocateBar();
  }

  var importDiffLocateBound = false;
  function bindImportDiffLocateEvents() {
    if (importDiffLocateBound) return;
    importDiffLocateBound = true;
    var drawerEl = document.getElementById('caseLibraryImportDiffDrawer');
    if (drawerEl && typeof drawerEl.addEventListener === 'function') {
      drawerEl.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-diff-locate-action]') : null;
        if (!btn || !btn.getAttribute) return;
        if (btn.getAttribute('data-diff-locate-scope') !== 'case-library-import-diff') return;
        var action = btn.getAttribute('data-diff-locate-action') || '';
        if (!action) return;
        var rows = getImportDiffRowEls();
        if (!rows.length) return;
        if (action === 'first') jumpToImportDiffAt(0);
        else if (action === 'last') jumpToImportDiffAt(rows.length - 1);
        else if (action === 'next') jumpToImportDiffAt((state.importDiff.locateIndex >= 0 ? state.importDiff.locateIndex + 1 : 0));
        else if (action === 'prev') jumpToImportDiffAt((state.importDiff.locateIndex >= 0 ? state.importDiff.locateIndex - 1 : rows.length - 1));
      });
      var bodyEl = drawerEl.querySelector('.drawer-body');
      if (bodyEl && typeof bodyEl.addEventListener === 'function') {
        var debounce = (utils && typeof utils.debounce === 'function') ? utils.debounce : null;
        var onScroll = function() { updateImportDiffLocateHint(); };
        bodyEl.addEventListener('scroll', debounce ? debounce(onScroll, 120) : onScroll);
      }
    }
  }

  var importInvalidLocateHighlightTimer = null;
  function clearImportInvalidLocateHighlight() {
    if (importInvalidLocateHighlightTimer) clearTimeout(importInvalidLocateHighlightTimer);
    importInvalidLocateHighlightTimer = null;
    if (!dom.importInvalidBody || !dom.importInvalidBody.querySelectorAll) return;
    var active = dom.importInvalidBody.querySelectorAll('tr.import-invalid-locate-active');
    active.forEach(function(tr) {
      if (!tr || !tr.classList) return;
      tr.classList.remove('import-invalid-locate-active');
    });
  }

  function getImportInvalidRowEls() {
    if (!dom.importInvalidBody || !dom.importInvalidBody.querySelectorAll) return [];
    var rows = Array.prototype.slice.call(dom.importInvalidBody.querySelectorAll('tr'));
    return rows.filter(function(row) {
      return row && row.querySelector && row.querySelector('td.invalid-cell');
    });
  }

  function isAnyImportInvalidRowInView(rows, containerEl) {
    var list = Array.isArray(rows) ? rows : [];
    if (!list.length || !containerEl || !containerEl.getBoundingClientRect) return false;
    var crect = containerEl.getBoundingClientRect();
    var top = crect.top + 60;
    var bottom = crect.bottom - 40;
    for (var i = 0; i < list.length; i += 1) {
      var row = list[i];
      if (!row || !row.getBoundingClientRect) continue;
      var r = row.getBoundingClientRect();
      if (r.bottom > top && r.top < bottom) return true;
    }
    return false;
  }

  function buildImportInvalidLocateBarHtml() {
    if (!dom.importInvalidLocateBar) return '';
    var rows = getImportInvalidRowEls();
    var total = rows.length;
    if (!total) {
      return (
        '<div class="diff-locate-info">缺失字段定位</div>' +
        '<div class="diff-locate-empty">暂无缺失字段</div>'
      );
    }
    var current = Number.isInteger(state.importInvalid.locateIndex) ? state.importInvalid.locateIndex : -1;
    if (current >= total) current = total - 1;
    if (current < -1) current = -1;
    state.importInvalid.locateIndex = current;
    var posText = current >= 0 ? ('位置 ' + String(current + 1) + '/' + String(total)) : ('位置 --/' + String(total));
    var hasCurrent = current >= 0;
    var disablePrev = !hasCurrent || current <= 0;
    var disableNext = hasCurrent && current >= total - 1;
    var disableFirst = hasCurrent && current <= 0;
    var disableLast = hasCurrent && current >= total - 1;
    return (
      '<div class="diff-locate-info">缺失字段定位：共 ' + String(total) + ' 行</div>' +
      '<div class="diff-locate-controls">' +
        '<button type="button" class="secondary" data-import-invalid-locate-scope="case-library-import-invalid" data-import-invalid-locate-action="first" ' + (disableFirst ? 'disabled' : '') + '>首处</button>' +
        '<button type="button" class="secondary" data-import-invalid-locate-scope="case-library-import-invalid" data-import-invalid-locate-action="prev" ' + (disablePrev ? 'disabled' : '') + '>上一处</button>' +
        '<button type="button" class="secondary" data-import-invalid-locate-scope="case-library-import-invalid" data-import-invalid-locate-action="next" ' + (disableNext ? 'disabled' : '') + '>下一处</button>' +
        '<button type="button" class="secondary" data-import-invalid-locate-scope="case-library-import-invalid" data-import-invalid-locate-action="last" ' + (disableLast ? 'disabled' : '') + '>末处</button>' +
        '<span class="diff-locate-pos" data-import-invalid-locate-pos>' + escapeHtml(posText) + '</span>' +
        '<span class="diff-locate-hint hidden" data-import-invalid-locate-hint></span>' +
      '</div>'
    );
  }

  function renderImportInvalidLocateBar() {
    if (!dom.importInvalidLocateBar) return;
    dom.importInvalidLocateBar.innerHTML = buildImportInvalidLocateBarHtml();
    updateImportInvalidLocateHint();
  }

  function updateImportInvalidLocateHint() {
    if (!dom.importInvalidLocateBar || !dom.importInvalidLocateBar.querySelector) return;
    var hintEl = dom.importInvalidLocateBar.querySelector('[data-import-invalid-locate-hint]');
    if (!hintEl) return;
    var rows = getImportInvalidRowEls();
    var total = rows.length;
    if (!total) {
      hintEl.textContent = '';
      if (hintEl.classList) hintEl.classList.add('hidden');
      return;
    }
    var drawerEl = document.getElementById('caseLibraryImportInvalidDrawer');
    var bodyEl = drawerEl ? drawerEl.querySelector('.drawer-body') : null;
    var inView = isAnyImportInvalidRowInView(rows, bodyEl);
    var hint = inView ? '' : '当前视口无缺失字段，可点击“下一处”定位';
    hintEl.textContent = hint;
    if (!hintEl.classList) return;
    hintEl.classList.toggle('hidden', !hint);
  }

  function jumpToImportInvalidAt(index) {
    var rows = getImportInvalidRowEls();
    if (!rows.length) return;
    var idx = Number(index);
    if (!Number.isFinite(idx)) idx = 0;
    if (idx < 0) idx = 0;
    if (idx >= rows.length) idx = rows.length - 1;
    state.importInvalid.locateIndex = idx;
    clearImportInvalidLocateHighlight();
    var row = rows[idx];
    if (row && row.scrollIntoView) {
      try { row.scrollIntoView({ block: 'center' }); } catch (e) { row.scrollIntoView(); }
    }
    if (row && row.classList) row.classList.add('import-invalid-locate-active');
    var focusCell = row && row.querySelector ? row.querySelector('td.invalid-cell .temp-inline-edit') : null;
    if (focusCell && focusCell.focus) {
      try { focusCell.focus(); } catch (e) { /* ignore */ }
    }
    importInvalidLocateHighlightTimer = setTimeout(function() {
      if (row && row.classList) row.classList.remove('import-invalid-locate-active');
    }, 2000);
    renderImportInvalidLocateBar();
  }

  var importInvalidLocateBound = false;
  function bindImportInvalidLocateEvents() {
    if (importInvalidLocateBound) return;
    importInvalidLocateBound = true;
    var drawerEl = document.getElementById('caseLibraryImportInvalidDrawer');
    if (drawerEl && typeof drawerEl.addEventListener === 'function') {
      drawerEl.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-import-invalid-locate-action]') : null;
        if (!btn || !btn.getAttribute) return;
        if (btn.getAttribute('data-import-invalid-locate-scope') !== 'case-library-import-invalid') return;
        var action = btn.getAttribute('data-import-invalid-locate-action') || '';
        if (!action) return;
        var rows = getImportInvalidRowEls();
        if (!rows.length) return;
        if (action === 'first') jumpToImportInvalidAt(0);
        else if (action === 'last') jumpToImportInvalidAt(rows.length - 1);
        else if (action === 'next') jumpToImportInvalidAt((state.importInvalid.locateIndex >= 0 ? state.importInvalid.locateIndex + 1 : 0));
        else if (action === 'prev') jumpToImportInvalidAt((state.importInvalid.locateIndex >= 0 ? state.importInvalid.locateIndex - 1 : rows.length - 1));
      });
      var bodyEl = drawerEl.querySelector('.drawer-body');
      if (bodyEl && typeof bodyEl.addEventListener === 'function') {
        var debounce = (utils && typeof utils.debounce === 'function') ? utils.debounce : null;
        var onScroll = function() { updateImportInvalidLocateHint(); };
        bodyEl.addEventListener('scroll', debounce ? debounce(onScroll, 120) : onScroll);
      }
    }
  }

  function syncImportDiffControls() {
    if (!dom.importDiffOverwriteBtn) return;
    var mode = state.importDiff && state.importDiff.mode ? String(state.importDiff.mode) : 'import';
    var can = false;
    if (mode === 'append_overwrite') {
      can = Boolean(
        !state.importDiff.loading &&
        !state.importDiff.confirming &&
        state.importDiff.caseFileId &&
        Array.isArray(state.importDiff.importItems) &&
        state.importDiff.importItems.length
      );
    } else {
      can = Boolean(
        !state.importDiff.loading &&
        !state.importDiff.confirming &&
        state.importDiff.projectId &&
        state.importDiff.importVersionId &&
        state.importDiff.fileName &&
        Array.isArray(state.importDiff.importItems) &&
        state.importDiff.importItems.length
      );
    }
    dom.importDiffOverwriteBtn.disabled = !can;
  }

  function openImportDiffDrawer(payload) {
    payload = payload || {};
    state.importDiff.locateIndex = -1;
    state.importDiff.mode = payload.mode || 'import';
    state.importDiff.caseFileId = payload.caseFileId || null;
    state.importDiff.fileName = payload.fileName || '';
    state.importDiff.cleanName = payload.cleanName || '';
    state.importDiff.importedCleanName = payload.importedCleanName || '';
    state.importDiff.source = payload.source || '';
    state.importDiff.projectId = payload.projectId || null;
    state.importDiff.importVersionId = payload.importVersionId || null;
    state.importDiff.dbVersionId = payload.dbVersionId || null;
    state.importDiff.importItems = Array.isArray(payload.importItems) ? payload.importItems : [];
    state.importDiff.dbItems = Array.isArray(payload.dbItems) ? payload.dbItems : [];
    state.importDiff.rows = (state.importDiff.mode === 'append_overwrite')
      ? buildAppendOverwriteDiffRows(state.importDiff.importItems, state.importDiff.dbItems)
      : buildImportDiffRows(state.importDiff.importItems, state.importDiff.dbItems);
    state.importDiff.loading = false;
    state.importDiff.confirming = false;

    var projectName = state.projectNameById[state.importDiff.projectId] || ('项目#' + state.importDiff.projectId);
    var importVerName = getVersionName(state.importDiff.projectId, state.importDiff.importVersionId);
    var dbVerName = getVersionName(state.importDiff.projectId, state.importDiff.dbVersionId);
    var leftCount = (state.importDiff.mode === 'append_overwrite')
      ? countUniqueCaseItemsByKey(state.importDiff.importItems)
      : dedupeCaseItemsByKey(state.importDiff.importItems).length;
    var rightCount = (state.importDiff.mode === 'append_overwrite')
      ? countUniqueCaseItemsByKey(state.importDiff.dbItems)
      : dedupeCaseItemsByKey(state.importDiff.dbItems).length;
    var changedCount = state.importDiff.rows.filter(function(r) { return r && r.type === 'changed'; }).length;
    var addedCount = state.importDiff.rows.filter(function(r) { return r && r.type === 'added'; }).length;
    var removedCount = state.importDiff.rows.filter(function(r) { return r && r.type === 'removed'; }).length;

    if (dom.importDiffTitle) {
      dom.importDiffTitle.textContent = (state.importDiff.mode === 'append_overwrite' ? '追加入库差异对比：' : '同名用例差异对比：') +
        (state.importDiff.cleanName || state.importDiff.fileName || '用例');
    }
    if (dom.importDiffMeta) {
      if (state.importDiff.mode === 'append_overwrite') {
        dom.importDiffMeta.textContent = projectName + ' / 版本：' + importVerName +
          ' / 待追加入库：' + leftCount + ' 条（新增 ' + addedCount + ' / 重复 ' + rightCount + ' / 差异 ' + changedCount + '）';
        if (changedCount) dom.importDiffMeta.classList.add('warn');
        else dom.importDiffMeta.classList.remove('warn');
      } else {
        dom.importDiffMeta.textContent = projectName + ' / 导入版本：' + importVerName + '（' + leftCount + ' 条） / 库中版本：' + dbVerName + '（' + rightCount + ' 条）' +
          ' / 新增 ' + addedCount + ' / 删除 ' + removedCount + ' / 差异 ' + changedCount;
        if (leftCount !== rightCount) dom.importDiffMeta.classList.add('warn');
        else dom.importDiffMeta.classList.remove('warn');
      }
    }
    if (dom.importDiffStatus) {
      var summary = '';
      if (state.importDiff.mode === 'append_overwrite') {
        summary = '检测到重复用例：新增 ' + addedCount + ' 条，差异 ' + changedCount + ' 条';
        setStatus(dom.importDiffStatus, summary, changedCount ? 'warn' : 'ok');
      } else {
        summary = '对比完成：新增 ' + addedCount + ' 条，差异 ' + changedCount + ' 条，库中多出 ' + removedCount + ' 条';
        setStatus(dom.importDiffStatus, summary, (addedCount || changedCount || removedCount) ? 'warn' : 'ok');
      }
    }
    if (dom.importDiffOverwriteBtn) {
      dom.importDiffOverwriteBtn.textContent = (state.importDiff.mode === 'append_overwrite') ? '确认覆盖并追加入库' : '确认覆盖导入';
    }
    renderImportDiffMergedTable(dom.importDiffBody, state.importDiff.rows);
    bindImportDiffLocateEvents();
    renderImportDiffLocateBar();
    syncImportDiffControls();

    if (importDrawerInstance && typeof importDrawerInstance.close === 'function') {
      importDrawerInstance.close();
    }
    if (importDiffDrawerOpenTimer) {
      clearTimeout(importDiffDrawerOpenTimer);
      importDiffDrawerOpenTimer = 0;
    }
    if (importDiffDrawerInstance && typeof importDiffDrawerInstance.open === 'function') {
      var el = importDiffDrawerInstance.element;
      var alreadyOpen = Boolean(el && el.classList && el.classList.contains('open'));
      if (alreadyOpen) {
        importDiffDrawerInstance.open();
      } else {
        importDiffDrawerOpenTimer = setTimeout(function() {
          importDiffDrawerInstance.open();
        }, 60);
      }
    }
  }

	  function openImportDiffDrawerLoading(payload) {
    payload = payload || {};
    state.importDiff.locateIndex = -1;
    state.importDiff.mode = payload.mode || 'import';
    state.importDiff.caseFileId = payload.caseFileId || null;
    var projectId = payload.projectId || null;
    var importVersionId = payload.importVersionId || null;
    var cleanName = payload.cleanName || payload.fileName || '';
    state.importDiff.fileName = payload.fileName || '';
    state.importDiff.cleanName = payload.cleanName || payload.fileName || '';
    state.importDiff.importedCleanName = payload.importedCleanName || '';
    state.importDiff.source = payload.source || '';
    state.importDiff.projectId = projectId;
    state.importDiff.importVersionId = importVersionId;
    state.importDiff.dbVersionId = null;
    state.importDiff.importItems = [];
    state.importDiff.dbItems = [];
    state.importDiff.rows = [];
    state.importDiff.loading = false;
    state.importDiff.confirming = false;
    var projectName = state.projectNameById[projectId] || ('项目#' + projectId);
    var importVerName = getVersionName(projectId, importVersionId);

    if (dom.importDiffTitle) {
      dom.importDiffTitle.textContent = (state.importDiff.mode === 'append_overwrite' ? '追加入库差异对比：' : '同名用例差异对比：') + (cleanName || '用例');
    }
    if (dom.importDiffMeta) {
      dom.importDiffMeta.textContent = (state.importDiff.mode === 'append_overwrite')
        ? (projectName + ' / 版本：' + importVerName + ' / 库中：--')
        : (projectName + ' / 导入版本：' + importVerName + ' / 库中版本：--');
      dom.importDiffMeta.classList.remove('warn');
    }
    if (dom.importDiffStatus) setStatus(dom.importDiffStatus, '加载差异对比中...', '');
    if (dom.importDiffBody) dom.importDiffBody.innerHTML = '<tr><td colspan="7"><p class="hint">加载中...</p></td></tr>';
    renderImportDiffLocateBar();
    syncImportDiffControls();

    if (importDrawerInstance && typeof importDrawerInstance.close === 'function') {
      importDrawerInstance.close();
    }
	    if (importDiffDrawerOpenTimer) {
	      clearTimeout(importDiffDrawerOpenTimer);
	      importDiffDrawerOpenTimer = 0;
	    }
	    if (importDiffDrawerInstance && typeof importDiffDrawerInstance.open === 'function') {
	      var el = importDiffDrawerInstance.element;
	      var alreadyOpen = Boolean(el && el.classList && el.classList.contains('open'));
	      if (alreadyOpen) {
	        importDiffDrawerInstance.open();
	      } else {
	        importDiffDrawerOpenTimer = setTimeout(function() {
	          importDiffDrawerInstance.open();
	        }, 60);
	      }
	    }
		  }

  // 供外部模块（如“用例生成”）复用同名差异对比抽屉：打开后等待用户“确认覆盖导入”或关闭抽屉。
  function openImportDiffForExternal(options) {
    options = options || {};
    if (!apiClient || typeof apiClient.importCaseFile !== 'function' || typeof apiClient.listCaseItems !== 'function') {
      return Promise.resolve({ ok: false, reason: 'api_not_ready' });
    }
    var projectId = options.projectId || options.project_id || null;
    var versionId = options.versionId || options.version_id || null;
    var fileName = options.fileName || options.file_name || '';
    var items = Array.isArray(options.items) ? options.items : [];
    var err = options.error || null;
    var errPayload = err && err.payload ? err.payload : (options.payload || null);
    var existingCaseFileId = errPayload && errPayload.existing_case_file_id ? errPayload.existing_case_file_id : null;
    if (!projectId || !versionId || !fileName || !items.length || !existingCaseFileId) {
      return Promise.resolve({ ok: false, reason: 'invalid_params' });
    }
    var importedCleanName = cleanCaseFileName(fileName);
    var matchedCleanName = errPayload && errPayload.existing_file_name_clean ? String(errPayload.existing_file_name_clean) : '';
    var cleanName = matchedCleanName || importedCleanName;
    var dbVersionId = errPayload && (errPayload.existing_version_id || errPayload.existing_version_id === 0)
      ? errPayload.existing_version_id
      : null;
    var source = options.source || options.importSource || extFromFileName(fileName) || 'external';

    openImportDiffDrawerLoading({
      fileName: fileName,
      cleanName: cleanName,
      importedCleanName: importedCleanName,
      projectId: projectId,
      importVersionId: versionId,
      source: source,
    });

    return new Promise(function(resolve) {
      state.importDiff.external = { resolve: resolve };
      Promise.all([apiClient.listCaseItems(existingCaseFileId), loadVersions(projectId)])
        .then(function(res) {
          var dbItems = Array.isArray(res && res[0]) ? res[0] : [];
          openImportDiffDrawer({
            fileName: fileName,
            cleanName: cleanName,
            importedCleanName: importedCleanName,
            projectId: projectId,
            importVersionId: versionId,
            dbVersionId: dbVersionId,
            importItems: items,
            dbItems: dbItems,
            source: source,
          });
        })
        .catch(function(loadErr) {
          setStatus(dom.importDiffStatus, '加载差异对比失败：' + (loadErr && loadErr.message ? loadErr.message : '未知错误'), 'err');
          var external = state.importDiff.external || null;
          if (external && typeof external.resolve === 'function') {
            state.importDiff.external = null;
            try {
              external.resolve({ ok: false, reason: 'load_failed', error: loadErr || null });
            } catch (e) {
              // ignore
            }
          }
        });
    });
  }

  // 供外部模块复用“追加入库覆盖差异对比”：用于确认是否覆盖同模块同标题的重复用例。
  function openAppendDiffForExternal(options) {
    options = options || {};
    if (!apiClient || typeof apiClient.appendCaseItems !== 'function') {
      return Promise.resolve({ ok: false, reason: 'api_not_ready' });
    }
    var projectId = options.projectId || options.project_id || null;
    var versionId = options.versionId || options.version_id || null;
    var caseFileId = options.caseFileId || options.case_file_id || null;
    var fileNameClean = options.fileNameClean || options.file_name_clean || options.cleanName || '';
    var items = Array.isArray(options.items) ? options.items : [];
    var dbItems = Array.isArray(options.dbItems) ? options.dbItems : [];
    if (!projectId || !versionId || !caseFileId || !items.length) {
      return Promise.resolve({ ok: false, reason: 'invalid_params' });
    }
    var leftKeys = {};
    items.forEach(function(it) {
      var k = buildCaseItemKey(it);
      if (k) leftKeys[k] = true;
    });
    var relatedDbItems = dbItems.filter(function(it) {
      var k = buildCaseItemKey(it);
      return Boolean(k && leftKeys[k]);
    });
    var hasConflict = relatedDbItems.length > 0;
    if (!hasConflict) {
      return Promise.resolve({ ok: false, reason: 'no_conflict' });
    }

    openImportDiffDrawerLoading({
      mode: 'append_overwrite',
      caseFileId: caseFileId,
      fileName: fileNameClean || ('用例#' + caseFileId),
      cleanName: fileNameClean || ('用例#' + caseFileId),
      projectId: projectId,
      importVersionId: versionId,
      source: 'casegen',
    });

    return new Promise(function(resolve) {
      state.importDiff.external = { resolve: resolve };
      loadVersions(projectId)
        .then(function() {
          openImportDiffDrawer({
            mode: 'append_overwrite',
            caseFileId: caseFileId,
            fileName: fileNameClean || ('用例#' + caseFileId),
            cleanName: fileNameClean || ('用例#' + caseFileId),
            projectId: projectId,
            importVersionId: versionId,
            dbVersionId: null,
            importItems: items,
            dbItems: relatedDbItems,
            source: 'casegen',
          });
        })
        .catch(function(loadErr) {
          setStatus(dom.importDiffStatus, '加载差异对比失败：' + (loadErr && loadErr.message ? loadErr.message : '未知错误'), 'err');
          var external = state.importDiff.external || null;
          if (external && typeof external.resolve === 'function') {
            state.importDiff.external = null;
            try {
              external.resolve({ ok: false, reason: 'load_failed', error: loadErr || null });
            } catch (e) {
              // ignore
            }
          }
        });
    });
  }

	  function syncImportInvalidControls() {
	    if (!dom.importInvalidConfirmBtn) return;
	    var items = Array.isArray(state.importInvalid.items) ? state.importInvalid.items : [];
	    dom.importInvalidConfirmBtn.disabled = Boolean(state.importInvalid.loading || !items.length);
	  }

	  function renderImportInvalidTable() {
	    if (!dom.importInvalidBody) return;
	    clearImportInvalidLocateHighlight();
	    var structural = Array.isArray(state.importInvalid.structuralErrors) ? state.importInvalid.structuralErrors : [];
	    var invalid = Array.isArray(state.importInvalid.invalid) ? state.importInvalid.invalid : [];
	    if (!structural.length && !invalid.length) {
	      dom.importInvalidBody.innerHTML = '<tr><td colspan="7"><p class="hint">暂无数据</p></td></tr>';
	      renderImportInvalidLocateBar();
	      return;
	    }

	    function renderStructuralRows(list) {
	      if (!list || !list.length) return '';
	      return list.map(function(entry) {
	        var lineNo = entry && typeof entry.line === 'number' ? entry.line : null;
	        var depth = entry && typeof entry.depth === 'number' ? entry.depth : null;
	        var detail = '字段层级不足：当前为 ' + (depth === null ? '?' : String(depth)) + ' 层（需至少 6 层：模块/用例标题/优先级/前提条件/操作步骤/预期结果），请在 XMind 中补齐后重新导入';
	        return (
	          '<tr class="import-structure-row">' +
	            '<td>' + escapeHtml(lineNo === null ? '-' : String(lineNo)) + '</td>' +
	            '<td colspan="6">' + escapeHtml(detail) + '</td>' +
	          '</tr>'
	        );
	      }).join('');
	    }

	    function renderItemRow(idx, lineNo, item, err) {
	      function cell(field, multiline) {
	        var raw = item && item[field] !== undefined && item[field] !== null ? String(item[field]) : '';
	        var html = raw ? escapeHtml(raw) : '';
	        var cls = err && err[field] ? 'invalid-cell' : '';
	        return (
	          '<td class="' + cls + '">' +
	            '<div class="temp-inline-edit" contenteditable="true" data-case-lib-import-invalid-field="' + field + '" data-index="' + idx + '" data-case-lib-multiline="' + (multiline ? 'true' : 'false') + '" data-placeholder="点击此处编辑">' +
	              html +
	            '</div>' +
	          '</td>'
	        );
	      }
	      return (
	        '<tr>' +
	          '<td>' + escapeHtml(String(lineNo)) + '</td>' +
	          cell('module', false) +
	          cell('title', false) +
	          cell('priority', false) +
	          cell('precondition', true) +
	          cell('steps', true) +
	          cell('expected', true) +
	        '</tr>'
	      );
	    }

	    function isItemComplete(item) {
	      if (!item) return false;
	      var module = String(item.module || '').trim();
	      var title = String(item.title || '').trim();
	      var priority = normalizePriorityInput(item.priority);
	      var precondition = String(item.precondition || '').trim();
	      var steps = String(item.steps || '').trim();
	      var expected = String(item.expected || '').trim();
	      return Boolean(module && title && priority && precondition && steps && expected);
	    }

	    function shouldShowStructuralHint(entry, itemsByLine) {
	      if (!entry || !itemsByLine) return true;
	      var line = entry && typeof entry.line === 'number' ? entry.line : null;
	      if (!line) return true;
	      var list = itemsByLine[line] || [];
	      if (!list.length) return true;
	      for (var i = 0; i < list.length; i += 1) {
	        if (isItemComplete(list[i].item)) return false;
	      }
	      return true;
	    }

	    function buildErrByIndex(invalidList) {
	      var errByIndex = {};
	      (invalidList || []).forEach(function(entry) {
	        var idx = entry && typeof entry.index === 'number' ? entry.index : -1;
	        if (idx < 0) return;
	        errByIndex[idx] = entry && entry.err ? entry.err : {};
	      });
	      return errByIndex;
	    }

	    function buildItemsByLine(items) {
	      var itemsByLine = {};
	      (items || []).forEach(function(it, idx) {
	        var lineNo = it && it._sourceLine ? Number(it._sourceLine) : null;
	        if (!lineNo || !isFinite(lineNo)) lineNo = idx + 1;
	        if (!itemsByLine[lineNo]) itemsByLine[lineNo] = [];
	        itemsByLine[lineNo].push({ idx: idx, item: it });
	      });
	      return itemsByLine;
	    }

	    function buildSortedLines(structuralByLine, itemsByLine) {
	      var allLineMap = {};
	      Object.keys(structuralByLine || {}).forEach(function(k) { allLineMap[Number(k)] = true; });
	      Object.keys(itemsByLine || {}).forEach(function(k) { allLineMap[Number(k)] = true; });
	      var lines = Object.keys(allLineMap)
	        .map(function(k) { return Number(k); })
	        .filter(function(n) { return isFinite(n) && n > 0; });
	      lines.sort(function(a, b) { return a - b; });
	      return lines;
	    }

	    if (structural.length) {
	      var errByIndex = buildErrByIndex(invalid);
	      var structuralByLine = {};
	      structural.forEach(function(entry) {
	        var line = entry && typeof entry.line === 'number' ? entry.line : null;
	        if (!line) return;
	        structuralByLine[line] = entry;
	      });
	      var items = Array.isArray(state.importInvalid.items) ? state.importInvalid.items : [];
	      var itemsByLine = buildItemsByLine(items);
	      var lines = buildSortedLines(structuralByLine, itemsByLine);
	      var rows = lines.map(function(line) {
	        var html = '';
	        var itemList = itemsByLine[line] || [];
	        itemList.forEach(function(rec) {
	          html += renderItemRow(rec.idx, line, rec.item, errByIndex[rec.idx] || {});
	        });
	        var structuralEntry = structuralByLine[line];
	        if (structuralEntry && shouldShowStructuralHint(structuralEntry, itemsByLine)) {
	          html += renderStructuralRows([structuralEntry]);
	        }
	        return html;
	      }).join('');
	      dom.importInvalidBody.innerHTML = rows || '<tr><td colspan="7"><p class="hint">暂无数据</p></td></tr>';
	      renderImportInvalidLocateBar();
	      return;
	    }

	    // 内容校验：为保持完整性，展示同文件内所有可解析用例，并对缺失字段高亮。
	    var errByIndex = buildErrByIndex(invalid);
	    var items = Array.isArray(state.importInvalid.items) ? state.importInvalid.items : [];
	    if (!items.length) {
	      dom.importInvalidBody.innerHTML = '<tr><td colspan="7"><p class="hint">暂无数据</p></td></tr>';
	      renderImportInvalidLocateBar();
	      return;
	    }
	    var itemsByLine = buildItemsByLine(items);
	    var lines = buildSortedLines({}, itemsByLine);
	    var rows = lines.map(function(line) {
	      var html = '';
	      var itemList = itemsByLine[line] || [];
	      itemList.forEach(function(rec) {
	        html += renderItemRow(rec.idx, line, rec.item, errByIndex[rec.idx] || {});
	      });
	      return html;
	    }).join('');
	    dom.importInvalidBody.innerHTML = rows || '<tr><td colspan="7"><p class="hint">暂无数据</p></td></tr>';
	    renderImportInvalidLocateBar();
	  }

	  function openImportInvalidDrawer(payload) {
	    payload = payload || {};
	    state.importInvalid.file = payload.file || null;
	    state.importInvalid.fileName = payload.fileName || '';
	    state.importInvalid.cleanName = payload.cleanName || cleanCaseFileName(payload.fileName || '');
	    state.importInvalid.source = payload.source || '';
	    state.importInvalid.projectId = payload.projectId || null;
	    state.importInvalid.versionId = payload.versionId || null;
	    state.importInvalid.structuralErrors = Array.isArray(payload.structuralErrors) ? payload.structuralErrors : [];
	    state.importInvalid.items = Array.isArray(payload.items) ? payload.items : [];
	    state.importInvalid.invalid = validateImportItems(state.importInvalid.items);
	    state.importInvalid.locateIndex = -1;
	    state.importInvalid.loading = false;

	    if (dom.importInvalidTitle) {
	      dom.importInvalidTitle.textContent = '导入用例格式校验：' + (state.importInvalid.cleanName || state.importInvalid.fileName || '用例');
	    }
	    if (dom.importInvalidStatus) {
	      var structuralCount = state.importInvalid.structuralErrors ? state.importInvalid.structuralErrors.length : 0;
	      var itemCount = state.importInvalid.items ? state.importInvalid.items.length : 0;
	      var invalidCount = state.importInvalid.invalid ? state.importInvalid.invalid.length : 0;
	      if (structuralCount) {
	        if (itemCount) {
	          var restCount = itemCount - structuralCount;
	          if (restCount < 0) restCount = 0;
	          var invalidNonStructural = invalidCount;
	          if (invalidCount) {
	            var structuralLineMap = {};
	            state.importInvalid.structuralErrors.forEach(function(entry) {
	              if (entry && typeof entry.line === 'number') structuralLineMap[entry.line] = true;
	            });
	            invalidNonStructural = state.importInvalid.invalid.filter(function(entry) {
	              var line = entry && typeof entry.line === 'number' ? entry.line : null;
	              return !line || !structuralLineMap[line];
	            }).length;
	          }
	          var msg = '检测到字段层级不足 ' + structuralCount + ' 条，可在列表内补齐字段后入库，未补齐将自动跳过';
	          if (restCount) msg += '；其余 ' + restCount + ' 条可继续入库';
	          if (invalidNonStructural) msg += '（请先补齐必填字段）';
	          setStatus(dom.importInvalidStatus, msg, 'warn');
	        } else {
	          setStatus(dom.importInvalidStatus, '全部条目字段层级不足（共 ' + structuralCount + ' 条），无法入库，请在 XMind 中补齐后重新导入', 'warn');
	        }
	      } else {
	        setStatus(dom.importInvalidStatus, '请补齐必填字段后再确认入库', 'warn');
	      }
	    }
	    bindImportInvalidLocateEvents();
	    renderImportInvalidTable();
	    syncImportInvalidControls();

	    if (importDrawerInstance && typeof importDrawerInstance.close === 'function') {
	      importDrawerInstance.close();
	    }
	    if (importInvalidDrawerInstance && typeof importInvalidDrawerInstance.open === 'function') {
	      setTimeout(function() {
	        importInvalidDrawerInstance.open();
	      }, 60);
	    }
	  }

	  function confirmImportFromInvalidDrawer() {
	    if (state.importInvalid.loading) return;
	    if (!apiClient || typeof apiClient.importCaseFile !== 'function') {
	      setStatus(dom.importInvalidStatus, '后端导入接口未就绪', 'err');
	      return;
	    }
	    var projectId = state.importInvalid.projectId;
	    var versionId = state.importInvalid.versionId;
	    var fileName = state.importInvalid.fileName || '用例';
	    var items = Array.isArray(state.importInvalid.items) ? state.importInvalid.items : [];
	    var structural = Array.isArray(state.importInvalid.structuralErrors) ? state.importInvalid.structuralErrors : [];
	    if (!projectId || !versionId || !items.length) {
	      if (structural.length) {
	        setStatus(dom.importInvalidStatus, '无可入库用例：字段层级不足 ' + structural.length + ' 条，请在 XMind 中补齐后重新导入', 'warn');
	      } else {
	        setStatus(dom.importInvalidStatus, '导入数据未就绪，请关闭后重新导入', 'warn');
	      }
	      return;
	    }

	    var itemsToImport = items;
	    var structuralLineMap = {};
	    if (structural.length) {
	      structural.forEach(function(entry) {
	        if (entry && typeof entry.line === 'number') structuralLineMap[entry.line] = true;
	      });
	    }

	    var invalid = validateImportItems(items);
	    state.importInvalid.invalid = invalid;
	    var invalidNonStructural = invalid;
	    if (invalid.length && structural.length) {
	      invalidNonStructural = invalid.filter(function(entry) {
	        var line = entry && typeof entry.line === 'number' ? entry.line : null;
	        return !line || !structuralLineMap[line];
	      });
	    }
	    if (invalidNonStructural.length) {
	      renderImportInvalidTable();
	      setStatus(dom.importInvalidStatus, '仍有 ' + invalidNonStructural.length + ' 条用例必填字段为空，请修改后再确认', 'warn');
	      return;
	    }

	    var pendingStructuralLines = {};
	    if (invalid.length && structural.length) {
	      invalid.forEach(function(entry) {
	        var line = entry && typeof entry.line === 'number' ? entry.line : null;
	        if (line && structuralLineMap[line]) pendingStructuralLines[line] = true;
	      });
	    }
	    var pendingStructuralCount = Object.keys(pendingStructuralLines).length;
	    if (pendingStructuralCount) {
	      itemsToImport = items.filter(function(item, idx) {
	        var lineNo = item && item._sourceLine ? Number(item._sourceLine) : (idx + 1);
	        if (!isFinite(lineNo) || lineNo <= 0) lineNo = idx + 1;
	        return !pendingStructuralLines[lineNo];
	      });
	    }
	    if (!itemsToImport.length) {
	      if (pendingStructuralCount || structural.length) {
	        setStatus(dom.importInvalidStatus, '无可入库用例：字段层级不足 ' + (pendingStructuralCount || structural.length) + ' 条，请补齐后再入库', 'warn');
	      } else {
	        setStatus(dom.importInvalidStatus, '导入数据未就绪，请关闭后重新导入', 'warn');
	      }
	      return;
	    }

      var dup = buildDuplicateGroupsForImport(itemsToImport);
      if (dup.duplicateCount > 0) {
        confirmImportDuplicatesByDrawer({
          fileName: fileName,
          total: itemsToImport.length,
          uniqueCount: dup.uniqueItems.length,
          duplicateCount: dup.duplicateCount,
          rows: dup.rows,
        }).then(function(ok) {
          if (!ok) {
            setStatus(dom.importInvalidStatus, '已取消入库（包含重复条目）', 'warn');
            return;
          }
          itemsToImport = dup.uniqueItems;
          state.importInvalid.items = itemsToImport;

          state.importInvalid.loading = true;
          syncImportInvalidControls();
          setStatus(dom.importInvalidStatus, '校验通过，入库中...', '');

          apiClient.importCaseFile({
            project_id: projectId,
            version_id: versionId,
            file_name: fileName,
            source: state.importInvalid.source || extFromFileName(fileName),
            items: sanitizeImportItemsForApi(itemsToImport),
          }).then(function() {
            var msg = '入库成功：' + cleanCaseFileName(fileName);
            if (pendingStructuralCount) msg += '（已跳过字段层级不足 ' + pendingStructuralCount + ' 条）';
            setStatus(dom.importInvalidStatus, msg, 'ok');
            setStatus(dom.importStatus, msg, 'ok');
            setStatus(dom.status, msg, 'ok');
            refreshCaseFileListsByProject(projectId);

            if (importInvalidDrawerInstance && typeof importInvalidDrawerInstance.close === 'function') {
              importInvalidDrawerInstance.close();
            }

            // 成功后从导入列表中移除该文件，避免重复导入；若已无文件则清空 input。
            var file = state.importInvalid.file;
            if (file && state.importDrawer && Array.isArray(state.importDrawer.files)) {
              state.importDrawer.files = state.importDrawer.files.filter(function(f) { return f !== file; });
            }
            renderImportFileHint();
            if (dom.importInput && (!state.importDrawer.files || !state.importDrawer.files.length)) {
              try {
                dom.importInput.value = '';
              } catch (e) {
                // ignore
              }
            }
            syncImportConfirmEnabled();
          }).catch(function(err) {
            var msg = err && err.message ? err.message : '导入失败';
            setStatus(dom.importInvalidStatus, '入库失败：' + msg, 'err');
            setStatus(dom.importStatus, '入库失败：' + msg, 'err');
            if (msg.indexOf('同名') !== -1) {
              // 同名冲突：复用现有差异对比抽屉（保持导入数据为已修正内容）。
              if (importInvalidDrawerInstance && typeof importInvalidDrawerInstance.close === 'function') {
                importInvalidDrawerInstance.close();
              }
              var importedCleanName = cleanCaseFileName(fileName);
              var errPayload = err && err.payload ? err.payload : null;
              var matchedCaseFileId = errPayload && errPayload.existing_case_file_id ? errPayload.existing_case_file_id : null;
              var matchedCleanName = errPayload && errPayload.existing_file_name_clean ? String(errPayload.existing_file_name_clean) : importedCleanName;
              var matchedVersionId = errPayload && (errPayload.existing_version_id || errPayload.existing_version_id === 0) ? errPayload.existing_version_id : null;
              var cleanName = matchedCleanName || importedCleanName;
              var source = state.importInvalid.source || extFromFileName(fileName);
              openImportDiffDrawerLoading({
                fileName: fileName,
                cleanName: cleanName,
                importedCleanName: importedCleanName,
                projectId: projectId,
                importVersionId: versionId,
                source: source,
              });
              (matchedCaseFileId
                ? Promise.all([apiClient.listCaseItems(matchedCaseFileId), loadVersions(projectId)]).then(function(res) {
                  var dbItems = Array.isArray(res && res[0]) ? res[0] : [];
                  openImportDiffDrawer({
                    fileName: fileName,
                    cleanName: cleanName,
                    importedCleanName: importedCleanName,
                    projectId: projectId,
                    importVersionId: versionId,
                    dbVersionId: matchedVersionId,
                    importItems: itemsToImport,
                    dbItems: dbItems || [],
                    source: source,
                  });
                })
                : Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId)])
                    .then(function(res) {
                      var files = Array.isArray(res && res[0]) ? res[0] : [];
                      var list = Array.isArray(files) ? files : [];
                      var existing = list.find(function(cf) {
                        return cf && String(cf.file_name_clean || '') === String(cleanName || '');
                      });
                      if (!existing) throw new Error('未找到库中同名用例：' + cleanName);
                      return apiClient.listCaseItems(existing.id).then(function(dbItems) {
                        openImportDiffDrawer({
                          fileName: fileName,
                          cleanName: cleanName,
                          importedCleanName: importedCleanName,
                          projectId: projectId,
                          importVersionId: versionId,
                          dbVersionId: existing.version_id || null,
                          importItems: itemsToImport,
                          dbItems: dbItems || [],
                          source: source,
                        });
                      });
                    })
              )
                .catch(function(e) {
                  setStatus(dom.importDiffStatus, (e && e.message ? e.message : '打开差异对比失败'), 'err');
                  setStatus(dom.importInvalidStatus, '入库失败：' + msg, 'err');
                });
            }
          }).finally(function() {
            state.importInvalid.loading = false;
            syncImportInvalidControls();
          });
        });
        return;
      }

	    state.importInvalid.loading = true;
	    syncImportInvalidControls();
	    setStatus(dom.importInvalidStatus, '校验通过，入库中...', '');

	    apiClient.importCaseFile({
	      project_id: projectId,
	      version_id: versionId,
	      file_name: fileName,
	      source: state.importInvalid.source || extFromFileName(fileName),
	      items: sanitizeImportItemsForApi(itemsToImport),
	    }).then(function() {
	      var msg = '入库成功：' + cleanCaseFileName(fileName);
	      if (pendingStructuralCount) msg += '（已跳过字段层级不足 ' + pendingStructuralCount + ' 条）';
	      setStatus(dom.importInvalidStatus, msg, 'ok');
	      setStatus(dom.importStatus, msg, 'ok');
	      setStatus(dom.status, msg, 'ok');
	      refreshCaseFileListsByProject(projectId);

	      if (importInvalidDrawerInstance && typeof importInvalidDrawerInstance.close === 'function') {
	        importInvalidDrawerInstance.close();
	      }

	      // 成功后从导入列表中移除该文件，避免重复导入；若已无文件则清空 input。
	      var file = state.importInvalid.file;
	      if (file && state.importDrawer && Array.isArray(state.importDrawer.files)) {
	        state.importDrawer.files = state.importDrawer.files.filter(function(f) { return f !== file; });
	      }
	      renderImportFileHint();
	      if (dom.importInput && (!state.importDrawer.files || !state.importDrawer.files.length)) {
	        try {
	          dom.importInput.value = '';
	        } catch (e) {
	          // ignore
	        }
	      }
	      syncImportConfirmEnabled();
	    }).catch(function(err) {
	      var msg = err && err.message ? err.message : '导入失败';
	      setStatus(dom.importInvalidStatus, '入库失败：' + msg, 'err');
	      setStatus(dom.importStatus, '入库失败：' + msg, 'err');
        var errPayload = err && err.payload ? err.payload : null;
	      if (msg.indexOf('同名') !== -1 || (errPayload && errPayload.existing_case_file_id)) {
	        // 同名冲突：复用现有差异对比抽屉（保持导入数据为已修正内容）。
	        if (importInvalidDrawerInstance && typeof importInvalidDrawerInstance.close === 'function') {
	          importInvalidDrawerInstance.close();
	        }
	        var importedCleanName = cleanCaseFileName(fileName);
	        var matchedCaseFileId = errPayload && errPayload.existing_case_file_id ? errPayload.existing_case_file_id : null;
	        var matchedCleanName = errPayload && errPayload.existing_file_name_clean ? String(errPayload.existing_file_name_clean) : importedCleanName;
	        var matchedVersionId = errPayload && (errPayload.existing_version_id || errPayload.existing_version_id === 0) ? errPayload.existing_version_id : null;
	        var cleanName = matchedCleanName || importedCleanName;
	        var source = state.importInvalid.source || extFromFileName(fileName);
	        openImportDiffDrawerLoading({
	          fileName: fileName,
	          cleanName: cleanName,
	          importedCleanName: importedCleanName,
	          projectId: projectId,
	          importVersionId: versionId,
	          source: source,
	        });
	        (matchedCaseFileId
	          ? Promise.all([apiClient.listCaseItems(matchedCaseFileId), loadVersions(projectId)]).then(function(res) {
	            var dbItems = Array.isArray(res && res[0]) ? res[0] : [];
	            openImportDiffDrawer({
	              fileName: fileName,
	              cleanName: cleanName,
	              importedCleanName: importedCleanName,
	              projectId: projectId,
	              importVersionId: versionId,
	              dbVersionId: matchedVersionId,
	              importItems: items,
	              dbItems: dbItems || [],
	              source: source,
	            });
	          })
	          : Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId)])
	              .then(function(res) {
	                var files = Array.isArray(res && res[0]) ? res[0] : [];
	                var list = Array.isArray(files) ? files : [];
	                var existing = list.find(function(cf) {
	                  return cf && String(cf.file_name_clean || '') === String(cleanName || '');
	                });
	                if (!existing) throw new Error('未找到库中同名用例：' + cleanName);
	                return apiClient.listCaseItems(existing.id).then(function(dbItems) {
	                  openImportDiffDrawer({
	                    fileName: fileName,
	                    cleanName: cleanName,
	                    importedCleanName: importedCleanName,
	                    projectId: projectId,
	                    importVersionId: versionId,
	                    dbVersionId: existing.version_id || null,
	                    importItems: items,
	                    dbItems: dbItems || [],
	                    source: source,
	                  });
	                });
	              })
	        ).catch(function(e) {
	          setStatus(dom.importDiffStatus, (e && e.message ? e.message : '打开差异对比失败'), 'err');
	          setStatus(dom.importStatus, (e && e.message ? e.message : '打开差异对比失败'), 'err');
	        });
	      }
	    }).finally(function() {
	      state.importInvalid.loading = false;
	      syncImportInvalidControls();
	    });
	  }

  function refreshCaseFileListsByProject(projectId) {
    if (!projectId) return Promise.resolve();
    if (!apiClient || typeof apiClient.listCaseFiles !== 'function') return Promise.resolve();
    return apiClient.listCaseFiles(projectId).then(function(files) {
      var list = Array.isArray(files) ? files : [];
      if (state.editDrawer.projectId && String(state.editDrawer.projectId) === String(projectId)) {
        state.editDrawer.files = list;
        renderEditDrawerList();
        syncEditDrawerControls();
      }
      if (state.selectDrawer.projectId && String(state.selectDrawer.projectId) === String(projectId)) {
        state.selectDrawer.files = list;
        renderSelectDrawerList();
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

  function confirmOverwriteImportFromDiff() {
    if (state.importDiff.loading || state.importDiff.confirming) return;
    var mode = state.importDiff && state.importDiff.mode ? String(state.importDiff.mode) : 'import';
    if (!apiClient || (mode === 'append_overwrite' ? typeof apiClient.appendCaseItems !== 'function' : typeof apiClient.importCaseFile !== 'function')) {
      setStatus(dom.importDiffStatus, mode === 'append_overwrite' ? '后端追加接口未就绪' : '后端导入接口未就绪', 'err');
      return;
    }

    if (mode === 'append_overwrite') {
      var caseFileId = state.importDiff.caseFileId;
      var items2 = Array.isArray(state.importDiff.importItems) ? state.importDiff.importItems : [];
      if (!caseFileId || !items2.length) {
        setStatus(dom.importDiffStatus, '差异数据未就绪，请稍后重试', 'warn');
        return;
      }
      state.importDiff.confirming = false;
      state.importDiff.loading = true;
      syncImportDiffControls();
      setStatus(dom.importDiffStatus, '覆盖并追加入库中...', '');

      apiClient
        .appendCaseItems(caseFileId, { items: items2, overwrite_existing: true })
        .then(function(res) {
          var appended = res && (res.appended || res.appended_count) ? Number(res.appended || res.appended_count) : 0;
          var overwritten = res && (res.overwritten || res.overwritten_count) ? Number(res.overwritten || res.overwritten_count) : 0;
          var msg = '追加入库成功：新增 ' + appended + ' 条，覆盖 ' + overwritten + ' 条';
          setStatus(dom.importDiffStatus, msg, 'ok');
          var external = state.importDiff.external || null;
          if (external && typeof external.resolve === 'function') {
            state.importDiff.external = null;
            try {
              external.resolve({ ok: true, overwrite: true, result: res || null });
            } catch (e) {
              // ignore
            }
          }
          var q = state.importDiff && state.importDiff.queue ? state.importDiff.queue : null;
          var keepOpen = Boolean(q && q.active && Number(q.total) > 0 && Number(q.index) < Number(q.total) - 1);
          if (!keepOpen && importDiffDrawerInstance && typeof importDiffDrawerInstance.close === 'function') {
            importDiffDrawerInstance.close();
          }
        })
        .catch(function(err) {
          var msg = err && err.message ? err.message : '追加入库失败';
          setStatus(dom.importDiffStatus, '追加入库失败：' + msg, 'err');
          var external = state.importDiff.external || null;
          if (external && typeof external.resolve === 'function') {
            state.importDiff.external = null;
            try {
              external.resolve({ ok: false, reason: 'append_overwrite_failed', error: err || null });
            } catch (e) {
              // ignore
            }
          }
        })
        .finally(function() {
          state.importDiff.loading = false;
          syncImportDiffControls();
        });
      return;
    }
    var projectId = state.importDiff.projectId;
    var versionId = state.importDiff.importVersionId;
    var originalFileName = state.importDiff.fileName || '';
    var cleanName = state.importDiff.cleanName || originalFileName || '用例';
    var ext = (String(originalFileName || '').split('.').pop() || '').toLowerCase();
    if (!ext || ext === String(originalFileName || '').toLowerCase()) ext = 'xmind';
    var overwriteFileName = String(state.importDiff.cleanName || cleanCaseFileName(originalFileName) || 'case') + '.' + ext;
    var source = state.importDiff.source || extFromFileName(originalFileName);
    var items = Array.isArray(state.importDiff.importItems) ? state.importDiff.importItems : [];
    if (!projectId || !versionId || !overwriteFileName || !items.length) {
      setStatus(dom.importDiffStatus, '差异数据未就绪，请稍后重试', 'warn');
      return;
    }
    var confirmMsg = '是否确认覆盖导入用例：' + cleanName + '？';
    state.importDiff.confirming = true;
    syncImportDiffControls();
    openConfirmDrawer({
      title: '确认覆盖导入',
      message: confirmMsg,
      confirmText: '确认覆盖导入',
      cancelText: '取消',
      previousDrawer: importDiffDrawerInstance,
    }).then(function(res) {
      state.importDiff.confirming = false;
      syncImportDiffControls();
      if (!res || res.ok !== true) return;

      state.importDiff.loading = true;
      syncImportDiffControls();
      setStatus(dom.importDiffStatus, '覆盖导入中...', '');
      setStatus(dom.importStatus, '覆盖导入中...', '');

      apiClient
        .importCaseFile(
          {
            project_id: projectId,
            version_id: versionId,
            file_name: overwriteFileName,
            source: source,
            items: items,
          },
          { overwrite: true }
        )
        .then(function(caseFile) {
          var msg = '覆盖导入成功：' + cleanName;
          setStatus(dom.importDiffStatus, msg, 'ok');
          setStatus(dom.importStatus, msg, 'ok');
          setStatus(dom.status, msg, 'ok');
          refreshCaseFileListsByProject(projectId);
          var external = state.importDiff.external || null;
          if (external && typeof external.resolve === 'function') {
            state.importDiff.external = null;
            try {
              external.resolve({ ok: true, overwrite: true, caseFile: caseFile || null });
            } catch (e) {
              // ignore
            }
          }
          var q = state.importDiff && state.importDiff.queue ? state.importDiff.queue : null;
          var keepOpen = Boolean(q && q.active && Number(q.total) > 0 && Number(q.index) < Number(q.total) - 1);
          if (!keepOpen && importDiffDrawerInstance && typeof importDiffDrawerInstance.close === 'function') {
            importDiffDrawerInstance.close();
          }
        })
        .catch(function(err) {
          var msg = err && err.message ? err.message : '覆盖导入失败';
          setStatus(dom.importDiffStatus, '覆盖导入失败：' + msg, 'err');
          setStatus(dom.importStatus, '覆盖导入失败：' + msg, 'err');
          var external = state.importDiff.external || null;
          if (external && typeof external.resolve === 'function') {
            state.importDiff.external = null;
            try {
              external.resolve({ ok: false, reason: 'overwrite_failed', error: err || null });
            } catch (e) {
              // ignore
            }
          }
        })
        .finally(function() {
          state.importDiff.loading = false;
          syncImportDiffControls();
        });
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

  function normalizeCaseLibHistoryKind(raw) {
    var kind = String(raw || '').trim().toLowerCase();
    if (kind === 'append') return kind;
    if (kind === 'added' || kind === 'updated' || kind === 'deleted') return kind;
    if (kind === 'import' || kind === 'reimport' || kind === 'file_deleted') return kind;
    if (kind === 'version_changed') return kind;
    return kind;
  }

  function getCaseLibHistoryKindLabel(kind) {
    var k = normalizeCaseLibHistoryKind(kind);
    if (k === 'append') return '追加';
    if (k === 'added') return '新增';
    if (k === 'updated') return '改动';
    if (k === 'deleted') return '删除';
    if (k === 'import') return '导入';
    if (k === 'reimport') return '重导';
    if (k === 'file_deleted') return '整份删除';
    if (k === 'version_changed') return '版本变更';
    return k || '--';
  }

  function setCaseLibraryHistoryFilter(next) {
    var current = state.historyDetail && state.historyDetail.filter ? String(state.historyDetail.filter) : '';
    var normalized = normalizeCaseLibHistoryKind(next);
    state.historyDetail.filter = current === normalized ? '' : normalized;
    state.historyDetail.pageIndex = 0;
    renderCaseLibraryHistory();
    persistHistoryDetailSelection();
  }

  function setHistoryDetailVisible(visible) {
    if (!dom.historyDetailCard || !dom.historyDetailCard.classList) return;
    // 兜底：部分环境下静态 CSS 资源可能加载抖动，增加 hidden 属性确保“隐藏”语义可靠。
    try { dom.historyDetailCard.hidden = !visible; } catch (_) {}
    if (visible) dom.historyDetailCard.classList.remove('hidden');
    else dom.historyDetailCard.classList.add('hidden');
    // 保证视图互斥：展示历史详情时应隐藏编辑卡片（但不清理编辑持久化，方便回退）。
    if (visible) showEditorCard(false);
    if (visible) showMissingCard(false);
  }

  function renderCaseLibraryHistory() {
    if (!dom.historyBody) return;
    var selectedProjectId = state.historyDetail && state.historyDetail.projectId ? String(state.historyDetail.projectId) : '';
    var selectedFileName = state.historyDetail && state.historyDetail.fileNameClean ? String(state.historyDetail.fileNameClean) : '';

    function setHistoryPagination(html) {
      if (dom.historyPaginationTop) dom.historyPaginationTop.innerHTML = html || '';
      if (dom.historyPaginationBottom) dom.historyPaginationBottom.innerHTML = html || '';
    }

    function buildHistoryPagination(total, pageIndex, totalPages, start, end) {
      total = Number(total) || 0;
      pageIndex = Number(pageIndex) || 0;
      totalPages = Number(totalPages) || 1;
      start = Number(start) || 0;
      end = Number(end) || 0;
      var currentPage = totalPages ? pageIndex + 1 : 1;
      var maxPage = totalPages || 1;
      var rangeInfo = total ? ('显示 ' + (start + 1) + '-' + end + ' / 共 ' + total + ' 条') : '暂无记录';
      return (
        '<div class=\"temp-pagination\" data-case-lib-history-pagination>' +
          '<div class=\"temp-pagination-info\">' + escapeHtml(rangeInfo) + '，每页 ' + getPageSize() + ' 条</div>' +
          '<div class=\"temp-pagination-controls\">' +
            '<button type=\"button\" class=\"secondary\" data-case-lib-history-page=\"prev\" ' + (pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
            '<button type=\"button\" class=\"secondary\" data-case-lib-history-page=\"next\" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
            '<label>跳转</label>' +
            '<input type=\"number\" min=\"1\" max=\"' + maxPage + '\" value=\"' + Math.min(currentPage, maxPage) + '\" data-case-lib-history-page-input>' +
          '</div>' +
        '</div>'
      );
    }

    if (dom.historyCaseName) {
      if (selectedProjectId && selectedFileName) {
        var projectName = state.projectNameById[selectedProjectId] || ('项目#' + selectedProjectId);
        var versionName = getVersionName(
          selectedProjectId,
          state.historyDetail && state.historyDetail.versionId ? String(state.historyDetail.versionId) : ''
        );
        var base = projectName + ' / ' + versionName + ' / ' + (selectedFileName || '--');
        dom.historyCaseName.textContent = base + (state.historyDetail && state.historyDetail.isDeleted ? '（已删除）' : '');
      } else {
        dom.historyCaseName.textContent = '';
      }
    }

    var filter = state.historyDetail && state.historyDetail.filter ? String(state.historyDetail.filter) : '';
    var list = state.historyDetail && Array.isArray(state.historyDetail.history) ? state.historyDetail.history : [];
    var totalSummary = { append: 0, added: 0, updated: 0, deleted: 0, import: 0, reimport: 0, file_deleted: 0 };
    list.forEach(function(row) {
      var k = normalizeCaseLibHistoryKind(row && row.kind);
      if (k && totalSummary[k] !== undefined) totalSummary[k] += 1;
    });

    function syncPill(pillEl, key, label) {
      if (!pillEl) return;
      pillEl.textContent = label + ' ' + (totalSummary[key] || 0);
      pillEl.classList.toggle('active', filter === key);
    }
    syncPill(dom.historyAppendPill, 'append', '追加');
    syncPill(dom.historyAddedPill, 'added', '新增');
    syncPill(dom.historyUpdatedPill, 'updated', '改动');
    syncPill(dom.historyDeletedPill, 'deleted', '删除');
    syncPill(dom.historyImportPill, 'import', '导入');
    syncPill(dom.historyReimportPill, 'reimport', '重导');
    syncPill(dom.historyFileDeletedPill, 'file_deleted', '整份删除');

    var visible = filter
      ? list.filter(function(row) { return normalizeCaseLibHistoryKind(row && row.kind) === filter; })
      : list.slice();

    if (!selectedProjectId || !selectedFileName) {
      dom.historyBody.innerHTML = '<tr><td colspan="9"><p class="hint">请先在“用例改动历史”中选择用例查看详情。</p></td></tr>';
      setHistoryPagination('');
      return;
    }

    if (!visible.length) {
      dom.historyBody.innerHTML = '<tr><td colspan="9"><p class="hint">暂无记录</p></td></tr>';
      setHistoryPagination(buildHistoryPagination(0, 0, 1, 0, 0));
      return;
    }

    var pageSize = getPageSize();
    var total = visible.length;
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    if (state.historyDetail.pageIndex >= totalPages) state.historyDetail.pageIndex = Math.max(totalPages - 1, 0);
    if (state.historyDetail.pageIndex < 0) state.historyDetail.pageIndex = 0;
    var start = state.historyDetail.pageIndex * pageSize;
    var end = Math.min(total, start + pageSize);
    var paged = visible.slice(start, end);
    setHistoryPagination(buildHistoryPagination(total, state.historyDetail.pageIndex, totalPages, start, end));

    function buildCell(oldSnap, newSnap, key, changed) {
      var oldVal = oldSnap && oldSnap[key] !== undefined && oldSnap[key] !== null ? String(oldSnap[key]) : '';
      var newVal = newSnap && newSnap[key] !== undefined && newSnap[key] !== null ? String(newSnap[key]) : '';
      if (!changed) {
        var text = newVal || oldVal || '';
        return '<div class="case-lib-diff-cell"><div class="case-lib-diff-only">' + escapeHtmlPreserve(text) + '</div></div>';
      }
      return (
        '<div class="case-lib-diff-cell">' +
          '<div class="case-lib-diff-old">旧：' + escapeHtmlPreserve(oldVal) + '</div>' +
          '<div class="case-lib-diff-new">新：' + escapeHtmlPreserve(newVal) + '</div>' +
        '</div>'
      );
    }

    dom.historyBody.innerHTML = paged.map(function(row) {
      var kind = normalizeCaseLibHistoryKind(row && row.kind);
      var operator = row && row.operator ? String(row.operator) : '';
      var timeText = formatTime(row && row.changed_at ? row.changed_at : '');
      var typeTag = '<span class="tag case-lib-diff-kind ' + escapeHtml(kind) + '">' + escapeHtml(getCaseLibHistoryKindLabel(kind)) + '</span>';

      if (kind === 'append' || kind === 'import' || kind === 'reimport' || kind === 'file_deleted') {
        var titleText = getCaseLibHistoryKindLabel(kind);
        return (
          '<tr>' +
            '<td>' + typeTag + '</td>' +
            '<td class="case-lib-diff-time">' + escapeHtml(timeText) + '</td>' +
            '<td class="case-lib-diff-operator">' + escapeHtml(operator) + '</td>' +
            '<td><div class="case-lib-diff-cell"><div class="case-lib-diff-only">' + escapeHtml(selectedFileName) + '</div></div></td>' +
            '<td><div class="case-lib-diff-cell"><div class="case-lib-diff-only">-</div></div></td>' +
            '<td><div class="case-lib-diff-cell"><div class="case-lib-diff-only">' + escapeHtml(titleText) + '</div></div></td>' +
            '<td><div class="case-lib-diff-cell"><div class="case-lib-diff-only">-</div></div></td>' +
            '<td><div class="case-lib-diff-cell"><div class="case-lib-diff-only">-</div></div></td>' +
            '<td><div class="case-lib-diff-cell"><div class="case-lib-diff-only">-</div></div></td>' +
          '</tr>'
        );
      }

      var oldSnap = row && row.old && typeof row.old === 'object' ? row.old : null;
      var newSnap = row && row.new && typeof row.new === 'object' ? row.new : null;
      var changedFields = Array.isArray(row && row.changed_fields) ? row.changed_fields : [];
      var changedMap = {};
      changedFields.forEach(function(f) { changedMap[String(f)] = true; });

      return (
        '<tr>' +
          '<td>' + typeTag + '</td>' +
          '<td class="case-lib-diff-time">' + escapeHtml(timeText) + '</td>' +
          '<td class="case-lib-diff-operator">' + escapeHtml(operator) + '</td>' +
          '<td><div class="case-lib-diff-cell"><div class="case-lib-diff-only">' + escapeHtml(selectedFileName) + '</div></div></td>' +
          '<td>' + buildCell(oldSnap, newSnap, 'module', Boolean(changedMap.module)) + '</td>' +
          '<td>' + buildCell(oldSnap, newSnap, 'title', Boolean(changedMap.title)) + '</td>' +
          '<td>' + buildCell(oldSnap, newSnap, 'precondition', Boolean(changedMap.precondition)) + '</td>' +
          '<td>' + buildCell(oldSnap, newSnap, 'steps', Boolean(changedMap.steps)) + '</td>' +
          '<td>' + buildCell(oldSnap, newSnap, 'expected', Boolean(changedMap.expected)) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function handleHistoryDetailPaginationAction(action) {
    var filter = state.historyDetail && state.historyDetail.filter ? String(state.historyDetail.filter) : '';
    var list = state.historyDetail && Array.isArray(state.historyDetail.history) ? state.historyDetail.history : [];
    var visible = filter
      ? list.filter(function(row) { return normalizeCaseLibHistoryKind(row && row.kind) === filter; })
      : list.slice();
    var total = visible.length;
    var pageSize = getPageSize();
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    if (!action) return;
    if (action === 'prev') state.historyDetail.pageIndex -= 1;
    else if (action === 'next') state.historyDetail.pageIndex += 1;
    else if (action === 'first') state.historyDetail.pageIndex = 0;
    else if (action === 'last') state.historyDetail.pageIndex = totalPages - 1;
    if (state.historyDetail.pageIndex < 0) state.historyDetail.pageIndex = 0;
    if (state.historyDetail.pageIndex >= totalPages) state.historyDetail.pageIndex = Math.max(totalPages - 1, 0);
    renderCaseLibraryHistory();
    persistHistoryDetailSelection();
  }

  function handleHistoryDetailPaginationJump(value) {
    var filter = state.historyDetail && state.historyDetail.filter ? String(state.historyDetail.filter) : '';
    var list = state.historyDetail && Array.isArray(state.historyDetail.history) ? state.historyDetail.history : [];
    var visible = filter
      ? list.filter(function(row) { return normalizeCaseLibHistoryKind(row && row.kind) === filter; })
      : list.slice();
    var total = visible.length;
    var pageSize = getPageSize();
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    var n = Number(value);
    if (!isFinite(n)) return;
    var idx = Math.max(0, Math.min(totalPages - 1, Math.floor(n - 1)));
    state.historyDetail.pageIndex = idx;
    renderCaseLibraryHistory();
    persistHistoryDetailSelection();
  }

  function handleEditDrawerPaginationAction(action) {
    var list = getEditDrawerVisibleFiles();
    var total = list.length;
    var pageSize = getPageSize();
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    if (!action) return;
    if (action === 'prev') state.editDrawer.pageIndex -= 1;
    else if (action === 'next') state.editDrawer.pageIndex += 1;
    else if (action === 'first') state.editDrawer.pageIndex = 0;
    else if (action === 'last') state.editDrawer.pageIndex = totalPages - 1;
    if (state.editDrawer.pageIndex < 0) state.editDrawer.pageIndex = 0;
    if (state.editDrawer.pageIndex >= totalPages) state.editDrawer.pageIndex = Math.max(totalPages - 1, 0);
    renderEditDrawerList();
    syncEditDrawerControls();
  }

  function handleEditDrawerPaginationJump(value) {
    var list = getEditDrawerVisibleFiles();
    var total = list.length;
    var pageSize = getPageSize();
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    var n = Number(value);
    if (!isFinite(n)) return;
    var idx = Math.max(0, Math.min(totalPages - 1, Math.floor(n - 1)));
    state.editDrawer.pageIndex = idx;
    renderEditDrawerList();
    syncEditDrawerControls();
  }

  function handleSelectDrawerPaginationAction(action) {
    var list = getSelectDrawerVisibleFiles();
    var total = list.length;
    var pageSize = getPageSize();
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    if (!action) return;
    if (action === 'prev') state.selectDrawer.pageIndex -= 1;
    else if (action === 'next') state.selectDrawer.pageIndex += 1;
    else if (action === 'first') state.selectDrawer.pageIndex = 0;
    else if (action === 'last') state.selectDrawer.pageIndex = totalPages - 1;
    if (state.selectDrawer.pageIndex < 0) state.selectDrawer.pageIndex = 0;
    if (state.selectDrawer.pageIndex >= totalPages) state.selectDrawer.pageIndex = Math.max(totalPages - 1, 0);
    renderSelectDrawerList();
    syncSelectDrawerControls();
  }

  function handleSelectDrawerPaginationJump(value) {
    var list = getSelectDrawerVisibleFiles();
    var total = list.length;
    var pageSize = getPageSize();
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    var n = Number(value);
    if (!isFinite(n)) return;
    var idx = Math.max(0, Math.min(totalPages - 1, Math.floor(n - 1)));
    state.selectDrawer.pageIndex = idx;
    renderSelectDrawerList();
    syncSelectDrawerControls();
  }

  function handleAssociationPickPaginationAction(action) {
    var list = Array.isArray(state.associationPickDrawer.items) ? state.associationPickDrawer.items : [];
    var total = list.length;
    var pageSize = getPageSize();
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    if (!action) return;
    if (action === 'prev') state.associationPickDrawer.pageIndex -= 1;
    else if (action === 'next') state.associationPickDrawer.pageIndex += 1;
    else if (action === 'first') state.associationPickDrawer.pageIndex = 0;
    else if (action === 'last') state.associationPickDrawer.pageIndex = totalPages - 1;
    if (state.associationPickDrawer.pageIndex < 0) state.associationPickDrawer.pageIndex = 0;
    if (state.associationPickDrawer.pageIndex >= totalPages) {
      state.associationPickDrawer.pageIndex = Math.max(totalPages - 1, 0);
    }
    renderAssociationPickItemList();
  }

  function handleAssociationPickPaginationJump(value) {
    var list = Array.isArray(state.associationPickDrawer.items) ? state.associationPickDrawer.items : [];
    var total = list.length;
    var pageSize = getPageSize();
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    var n = Number(value);
    if (!isFinite(n)) return;
    var idx = Math.max(0, Math.min(totalPages - 1, Math.floor(n - 1)));
    state.associationPickDrawer.pageIndex = idx;
    renderAssociationPickItemList();
  }

  function handleImportSelectDrawerPaginationAction(action) {
    var list = getImportSelectDrawerVisibleFiles();
    var total = list.length;
    var pageSize = getPageSize();
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    if (!action) return;
    if (action === 'prev') state.importSelectDrawer.pageIndex -= 1;
    else if (action === 'next') state.importSelectDrawer.pageIndex += 1;
    else if (action === 'first') state.importSelectDrawer.pageIndex = 0;
    else if (action === 'last') state.importSelectDrawer.pageIndex = totalPages - 1;
    if (state.importSelectDrawer.pageIndex < 0) state.importSelectDrawer.pageIndex = 0;
    if (state.importSelectDrawer.pageIndex >= totalPages) {
      state.importSelectDrawer.pageIndex = Math.max(totalPages - 1, 0);
    }
    renderImportSelectDrawerList();
    syncImportSelectDrawerControls();
  }

  function handleImportSelectDrawerPaginationJump(value) {
    var list = getImportSelectDrawerVisibleFiles();
    var total = list.length;
    var pageSize = getPageSize();
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    var n = Number(value);
    if (!isFinite(n)) return;
    var idx = Math.max(0, Math.min(totalPages - 1, Math.floor(n - 1)));
    state.importSelectDrawer.pageIndex = idx;
    renderImportSelectDrawerList();
    syncImportSelectDrawerControls();
  }

  function handleHistoryQueryPaginationAction(action) {
    var list = getHistoryQueryVisibleFiles();
    var total = list.length;
    var pageSize = getPageSize();
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    if (!action) return;
    if (action === 'prev') state.historyQueryDrawer.pageIndex -= 1;
    else if (action === 'next') state.historyQueryDrawer.pageIndex += 1;
    else if (action === 'first') state.historyQueryDrawer.pageIndex = 0;
    else if (action === 'last') state.historyQueryDrawer.pageIndex = totalPages - 1;
    if (state.historyQueryDrawer.pageIndex < 0) state.historyQueryDrawer.pageIndex = 0;
    if (state.historyQueryDrawer.pageIndex >= totalPages) {
      state.historyQueryDrawer.pageIndex = Math.max(totalPages - 1, 0);
    }
    renderHistoryQueryDrawerList();
  }

  function handleHistoryQueryPaginationJump(value) {
    var list = getHistoryQueryVisibleFiles();
    var total = list.length;
    var pageSize = getPageSize();
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    var n = Number(value);
    if (!isFinite(n)) return;
    var idx = Math.max(0, Math.min(totalPages - 1, Math.floor(n - 1)));
    state.historyQueryDrawer.pageIndex = idx;
    renderHistoryQueryDrawerList();
  }

  function resetHistoryQueryDrawer() {
    state.historyQueryDrawer.projectId = null;
    state.historyQueryDrawer.versionId = null;
    state.historyQueryDrawer.searchText = '';
    state.historyQueryDrawer.files = [];
    state.historyQueryDrawer.loading = false;
    state.historyQueryDrawer.pageIndex = 0;
    setStatus(dom.historyDrawerStatus, '', '');
    syncProjectOptions(dom.historyDrawerProjectSelect, '请选择项目');
    if (dom.historyDrawerProjectSelect) dom.historyDrawerProjectSelect.value = '';
    if (dom.historyDrawerVersionSelect) {
      dom.historyDrawerVersionSelect.disabled = true;
      dom.historyDrawerVersionSelect.innerHTML = '<option value=\"\">请选择版本</option><option value=\"0\">全部版本</option>';
      dom.historyDrawerVersionSelect.value = '';
    }
    if (dom.historyDrawerSearchInput) dom.historyDrawerSearchInput.value = '';
    if (dom.historyDrawerListBody) {
      dom.historyDrawerListBody.innerHTML = '<tr><td colspan=\"8\"><p class=\"hint\">请选择项目与版本后点击“查询”。</p></td></tr>';
    }
    setDrawerPagination(dom.historyDrawerPaginationTop, dom.historyDrawerPaginationBottom, '');
  }

  function getHistoryQueryVisibleFiles() {
    var list = state.historyQueryDrawer && Array.isArray(state.historyQueryDrawer.files) ? state.historyQueryDrawer.files : [];
    var q = state.historyQueryDrawer && state.historyQueryDrawer.searchText ? String(state.historyQueryDrawer.searchText).trim().toLowerCase() : '';
    if (!q) return list.slice();
    return list.filter(function(f) {
      var name = f && f.file_name_clean ? String(f.file_name_clean) : '';
      return name.toLowerCase().indexOf(q) !== -1;
    });
  }

  function getHistoryQueryPagedFiles() {
    var visible = getHistoryQueryVisibleFiles();
    var page = resolveDrawerPage(visible.length, state.historyQueryDrawer.pageIndex);
    state.historyQueryDrawer.pageIndex = page.pageIndex;
    return {
      page: page,
      list: visible.slice(page.start, page.end),
      total: visible.length,
    };
  }

  function renderHistoryQueryDrawerList() {
    if (!dom.historyDrawerListBody) return;
    var result = getHistoryQueryPagedFiles();
    var visible = result.list;
    var total = result.total;
    var page = result.page;
    if (!total) {
      dom.historyDrawerListBody.innerHTML = '<tr><td colspan=\"8\"><p class=\"hint\">暂无有改动记录的用例文件</p></td></tr>';
      setDrawerPagination(dom.historyDrawerPaginationTop, dom.historyDrawerPaginationBottom, '');
      return;
    }
    dom.historyDrawerListBody.innerHTML = visible.map(function(f) {
      var pid = f && (f.project_id || f.project_id === 0) ? String(f.project_id) : '';
      var vid = f && (f.version_id || f.version_id === 0) ? String(f.version_id) : '';
      var name = f && f.file_name_clean ? String(f.file_name_clean) : '--';
      var nameText = name + (f && f.is_deleted ? '（已删除）' : '');
      var changedAt = formatTime(f && f.last_changed_at ? f.last_changed_at : '');
      var versionName = vid ? getVersionName(pid, vid) : '--';
      var importer = f && f.importer_name ? String(f.importer_name) : '--';
      var importedAt = formatTime(f && f.imported_at ? f.imported_at : '');
      var updatedBy = f && f.last_updated_by_name ? String(f.last_updated_by_name) : (f && f.last_operator ? String(f.last_operator) : '--');
      var updatedAt = formatTime(f && f.updated_at ? f.updated_at : '');
      return (
        '<tr>' +
          '<td class=\"case-lib-diff-time\">' + escapeHtml(changedAt) + '</td>' +
          '<td>' + escapeHtml(nameText) + '</td>' +
          '<td>' + escapeHtml(versionName) + '</td>' +
          '<td class=\"case-lib-diff-operator\">' + escapeHtml(importer) + '</td>' +
          '<td class=\"case-lib-diff-time\">' + escapeHtml(importedAt) + '</td>' +
          '<td class=\"case-lib-diff-operator\">' + escapeHtml(updatedBy) + '</td>' +
          '<td class=\"case-lib-diff-time\">' + escapeHtml(updatedAt) + '</td>' +
          '<td>' +
            '<button type=\"button\" class=\"secondary\" data-case-lib-history-open=\"1\" data-case-lib-history-project=\"' + escapeHtml(pid) + '\" data-case-lib-history-file=\"' + escapeHtml(name) + '\" data-case-lib-history-version=\"' + escapeHtml(vid) + '\">历史详情</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');
    setDrawerPagination(
      dom.historyDrawerPaginationTop,
      dom.historyDrawerPaginationBottom,
      buildDrawerPagination(total, page.pageIndex, page.totalPages, page.start, page.end, 'history-query')
    );
  }

  function handleHistoryQueryProjectChange() {
    state.historyQueryDrawer.projectId = normalizeId(dom.historyDrawerProjectSelect ? dom.historyDrawerProjectSelect.value : '');
    state.historyQueryDrawer.versionId = null;
    state.historyQueryDrawer.files = [];
    state.historyQueryDrawer.pageIndex = 0;
    setStatus(dom.historyDrawerStatus, '', '');
    persistHistoryQueryState();
    if (dom.historyDrawerVersionSelect) {
      dom.historyDrawerVersionSelect.disabled = true;
      dom.historyDrawerVersionSelect.innerHTML = '<option value=\"\">加载版本中...</option>';
    }
    renderHistoryQueryDrawerList();
    var pid = state.historyQueryDrawer.projectId;
    if (!pid) {
      if (dom.historyDrawerVersionSelect) {
        dom.historyDrawerVersionSelect.disabled = true;
        dom.historyDrawerVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
        dom.historyDrawerVersionSelect.value = '';
      }
      return;
    }
    loadVersions(pid).then(function() {
      if (dom.historyDrawerVersionSelect) {
        dom.historyDrawerVersionSelect.disabled = false;
        syncVersionOptionsWithAll(dom.historyDrawerVersionSelect, pid);
        dom.historyDrawerVersionSelect.value = '0';
        state.historyQueryDrawer.versionId = 0;
        persistHistoryQueryState();
      }
    });
  }

  function handleHistoryQueryVersionChange() {
    state.historyQueryDrawer.versionId = normalizeId(dom.historyDrawerVersionSelect ? dom.historyDrawerVersionSelect.value : '');
    state.historyQueryDrawer.pageIndex = 0;
    persistHistoryQueryState();
  }

  function handleHistoryQuerySearchInput() {
    state.historyQueryDrawer.searchText = String(dom.historyDrawerSearchInput ? dom.historyDrawerSearchInput.value : '');
    state.historyQueryDrawer.pageIndex = 0;
    renderHistoryQueryDrawerList();
    persistHistoryQueryState();
  }

  function clearHistoryQuerySearch() {
    state.historyQueryDrawer.searchText = '';
    state.historyQueryDrawer.pageIndex = 0;
    if (dom.historyDrawerSearchInput) dom.historyDrawerSearchInput.value = '';
    renderHistoryQueryDrawerList();
    persistHistoryQueryState();
  }

  function loadHistoryQueryDrawerFiles() {
    if (!apiClient || typeof apiClient.listCaseLibraryChangeFiles !== 'function') {
      setStatus(dom.historyDrawerStatus, '缺少历史接口（apiClient.listCaseLibraryChangeFiles）', 'warn');
      state.historyQueryDrawer.files = [];
      renderHistoryQueryDrawerList();
      return Promise.resolve([]);
    }
    var pid = state.historyQueryDrawer.projectId;
    var vid = state.historyQueryDrawer.versionId;
    if (!pid || vid === null || vid === undefined) {
      setStatus(dom.historyDrawerStatus, '请先选择项目与版本', 'warn');
      return Promise.resolve([]);
    }
    state.historyQueryDrawer.loading = true;
    state.historyQueryDrawer.pageIndex = 0;
    setStatus(dom.historyDrawerStatus, '加载中...', '');
    return apiClient
      .listCaseLibraryChangeFiles({ project_id: pid, version_id: vid, limit: 500 })
      .then(function(list) {
        state.historyQueryDrawer.files = Array.isArray(list) ? list : [];
        setStatus(dom.historyDrawerStatus, '已加载 ' + state.historyQueryDrawer.files.length + ' 条（仅展示有改动记录的用例）', state.historyQueryDrawer.files.length ? 'ok' : '');
        renderHistoryQueryDrawerList();
        persistHistoryQueryState();
        return state.historyQueryDrawer.files;
      })
      .catch(function(err) {
        var msg = err && err.message ? err.message : '加载失败';
        setStatus(dom.historyDrawerStatus, '查询失败：' + msg, 'err');
        state.historyQueryDrawer.files = [];
        renderHistoryQueryDrawerList();
        return [];
      })
      .finally(function() {
        state.historyQueryDrawer.loading = false;
      });
  }

  function openCaseLibraryHistoryDetail(projectId, fileNameClean, versionId) {
    var pid = projectId === null || projectId === undefined ? '' : String(projectId);
    var name = String(fileNameClean || '').trim();
    if (!pid || !name) return;
    state.historyDetail.projectId = pid;
    state.historyDetail.fileNameClean = name;
    state.historyDetail.filter = '';
    state.historyDetail.history = [];
    state.historyDetail.isDeleted = false;
    state.historyDetail.versionId = versionId || null;
    state.historyDetail.pageIndex = 0;
    setHistoryDetailVisible(true);
    if (dom.editCard && dom.editCard.classList) dom.editCard.classList.add('hidden');
    if (historyDrawerInstance && typeof historyDrawerInstance.close === 'function') historyDrawerInstance.close();
    setStatus(dom.historyStatus, '加载历史记录中...', '');
    renderCaseLibraryHistory();
    persistHistoryDetailSelection();
    persistCaseLibraryLastView('history');
    loadCaseLibraryHistoryEntries(pid, name).then(function() {
      try {
        if (dom.historyDetailCard && typeof dom.historyDetailCard.scrollIntoView === 'function') {
          dom.historyDetailCard.scrollIntoView();
        }
      } catch (e) {
        // ignore
      }
    });
  }

  function loadCaseLibraryHistoryEntries(projectId, fileNameClean) {
    if (!apiClient || typeof apiClient.getCaseLibraryChangeHistory !== 'function') {
      setStatus(dom.historyStatus, '缺少历史接口（apiClient.getCaseLibraryChangeHistory）', 'warn');
      state.historyDetail.history = [];
      renderCaseLibraryHistory();
      return Promise.resolve(null);
    }
    var pid = projectId === null || projectId === undefined ? '' : String(projectId);
    var name = String(fileNameClean || '').trim();
    if (!pid || !name) {
      state.historyDetail.history = [];
      setStatus(dom.historyStatus, '请选择一个用例查看历史记录', '');
      renderCaseLibraryHistory();
      return Promise.resolve(null);
    }
    state.historyDetail.loading = true;
    setStatus(dom.historyStatus, '加载历史记录中...', '');
    var vid = state.historyDetail && state.historyDetail.versionId !== null && state.historyDetail.versionId !== undefined
      ? state.historyDetail.versionId
      : null;
    return apiClient
      .getCaseLibraryChangeHistory(pid, name, { limit: 800, version_id: vid })
      .then(function(res) {
        var history = res && Array.isArray(res.history) ? res.history : [];
        state.historyDetail.isDeleted = Boolean(res && res.is_deleted);
        state.historyDetail.versionId = res && (res.version_id || res.version_id === 0) ? res.version_id : state.historyDetail.versionId;
        state.historyDetail.history = history;
        var statusText = '';
        if (state.historyDetail.isDeleted) {
          statusText = '该用例已被整份删除（未重新导入），历史记录仍保留。';
        } else {
          statusText = history.length ? ('已加载 ' + history.length + ' 条历史记录') : '暂无历史记录';
        }
        setStatus(dom.historyStatus, statusText, history.length ? 'ok' : '');
        renderCaseLibraryHistory();
        persistHistoryDetailSelection();
        return res;
      })
      .catch(function(err) {
        var msg = err && err.message ? err.message : '加载失败';
        setStatus(dom.historyStatus, '加载历史记录失败：' + msg, 'err');
        state.historyDetail.history = [];
        renderCaseLibraryHistory();
        return null;
      })
      .finally(function() {
        state.historyDetail.loading = false;
      });
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


  function markCaseLibraryXmindSkipScrollRestoreOnce() {
    try {
      if (window.app) window.app.__drawerSkipRestoreOnce = true;
    } catch (err) {
      // ignore
    }
  }

  function bindCaseLibraryXmindCloseScrollGuard(drawerEl) {
    if (!drawerEl || typeof drawerEl.addEventListener !== 'function') return;
    if (drawerEl.__tapCaseLibraryXmindCloseScrollGuardBound) return;
    drawerEl.__tapCaseLibraryXmindCloseScrollGuardBound = true;
    drawerEl.addEventListener('click', function(e) {
      var target = e && e.target && e.target.closest
        ? e.target.closest('[data-drawer-close="xmindStructureDrawer"]')
        : null;
      if (!target) return;
      markCaseLibraryXmindSkipScrollRestoreOnce();
    }, true);
  }

  function enableCaseLibraryXmindGestureGuard() {
    if (caseLibraryXmindGestureGuard.active) return;
    if (typeof window === 'undefined' || !window || !window.history) return;
    if (typeof window.addEventListener !== 'function' || typeof window.removeEventListener !== 'function') return;

    var token = 'tap-xmind-guard-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    caseLibraryXmindGestureGuard.token = token;
    caseLibraryXmindGestureGuard.active = true;
    caseLibraryXmindGestureGuard.restoring = false;

    try {
      window.history.pushState({ __tapXmindGestureGuard: token }, document.title, window.location.href);
    } catch (err) {
      // ignore
    }

    var popHandler = function() {
      if (!caseLibraryXmindGestureGuard.active) return;
      if (caseLibraryXmindGestureGuard.restoring) return;
      if (window.history && typeof window.history.go === 'function') {
        try {
          window.history.go(1);
        } catch (err0) {
          // ignore
        }
      }
    };
    caseLibraryXmindGestureGuard.popHandler = popHandler;
    window.addEventListener('popstate', popHandler, true);
  }

  function disableCaseLibraryXmindGestureGuard() {
    if (!caseLibraryXmindGestureGuard.active) return;
    var popHandler = caseLibraryXmindGestureGuard.popHandler;
    caseLibraryXmindGestureGuard.active = false;
    caseLibraryXmindGestureGuard.popHandler = null;
    if (typeof window !== 'undefined' && window && typeof window.removeEventListener === 'function' && popHandler) {
      window.removeEventListener('popstate', popHandler, true);
    }
    if (typeof window === 'undefined' || !window || !window.history) {
      caseLibraryXmindGestureGuard.token = '';
      return;
    }
    var state = null;
    try {
      state = window.history.state;
    } catch (err1) {
      state = null;
    }
    if (
      state &&
      typeof state === 'object' &&
      state.__tapXmindGestureGuard &&
      String(state.__tapXmindGestureGuard) === String(caseLibraryXmindGestureGuard.token || '')
    ) {
      var nextState = {};
      try {
        nextState = JSON.parse(JSON.stringify(state));
      } catch (err2) {
        nextState = {};
      }
      if (!nextState || typeof nextState !== 'object') nextState = {};
      if (Object.prototype.hasOwnProperty.call(nextState, '__tapXmindGestureGuard')) {
        delete nextState.__tapXmindGestureGuard;
      }
      try {
        window.history.replaceState(nextState, document.title, window.location.href);
      } catch (err3) {
        // ignore
      }
      caseLibraryXmindGestureGuard.restoring = false;
    }
    caseLibraryXmindGestureGuard.token = '';
  }

  function setCaseLibraryXmindDrawerBodyViewerMode(enabled) {
    var body = document.getElementById('xmindStructureDrawerBody');
    if (!body || !body.classList) return;
    if (enabled) body.classList.add('is-mind-viewer');
    else body.classList.remove('is-mind-viewer');
  }

  function ensureCaseLibraryXmindDrawer() {
    if (xmindStructureDrawerInstance) return xmindStructureDrawerInstance;
    xmindStructureDrawerInstance = ensureDrawer('xmindStructureDrawer', [], function() {
      enableCaseLibraryXmindGestureGuard();
    }, function() {
      disableCaseLibraryXmindGestureGuard();
      if (caseLibraryXmindThemeObserver && typeof caseLibraryXmindThemeObserver.disconnect === 'function') {
        caseLibraryXmindThemeObserver.disconnect();
      }
      caseLibraryXmindThemeObserver = null;
      var mindApi = getMindElixirApi();
      if (mindApi && typeof mindApi.destroyMindMap === 'function') {
        mindApi.destroyMindMap(caseLibraryXmindMindInstance);
      }
      caseLibraryXmindMindInstance = null;
      var body = document.getElementById('xmindStructureDrawerBody');
      if (body) {
        setCaseLibraryXmindDrawerBodyViewerMode(false);
        body.innerHTML = '';
      }
    });
    if (xmindStructureDrawerInstance && xmindStructureDrawerInstance.element) {
      bindCaseLibraryXmindCloseScrollGuard(xmindStructureDrawerInstance.element);
    }
    if (xmindStructureDrawerInstance && typeof xmindStructureDrawerInstance.close === 'function' && !xmindStructureDrawerInstance.__tapCloseWithSkipRestore) {
      var rawClose = xmindStructureDrawerInstance.close;
      xmindStructureDrawerInstance.close = function() {
        markCaseLibraryXmindSkipScrollRestoreOnce();
        return rawClose.apply(xmindStructureDrawerInstance, arguments);
      };
      xmindStructureDrawerInstance.__tapCloseWithSkipRestore = true;
    }
    return xmindStructureDrawerInstance;
  }

  function bindCaseLibraryXmindThemeSync(mindApi) {
    if (!mindApi || typeof mindApi.refreshMindTheme !== 'function') return;
    if (!document || !document.documentElement || typeof MutationObserver === 'undefined') return;
    if (caseLibraryXmindThemeObserver && typeof caseLibraryXmindThemeObserver.disconnect === 'function') {
      caseLibraryXmindThemeObserver.disconnect();
    }
    caseLibraryXmindThemeObserver = new MutationObserver(function() {
      if (!caseLibraryXmindMindInstance) return;
      mindApi.refreshMindTheme(caseLibraryXmindMindInstance);
    });
    caseLibraryXmindThemeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  function exportCurrentCaseLibraryXmind() {
    var currentFile = state.editor && state.editor.caseFile ? state.editor.caseFile : null;
    var list = Array.isArray(state.editor && state.editor.items) ? state.editor.items : [];
    if (!currentFile || !list.length) {
      setStatus(dom.editStatus, '当前用例无可导出内容', 'warn');
      return Promise.resolve(false);
    }
    var builder = getXmindBuilder();
    if (!builder) {
      setStatus(dom.editStatus, '缺少 XMind 导出依赖', 'err');
      return Promise.resolve(false);
    }
    var downloadBlob = getDownloadBlob();
    var currentMindData = readCaseLibraryWriterMindDataFromInstance();
    var rootName = currentMindData && currentMindData.nodeData
      ? deriveCaseLibraryWriterExportBaseName(currentMindData)
      : '';
    var baseName = cleanCaseFileName(rootName || currentFile.file_name_clean || currentFile.file_name || '用例');
    setStatus(dom.editStatus, '正在导出 XMind...', '');
    return Promise.resolve()
      .then(function() {
        return builder(list, baseName, '');
      })
      .then(function(pkg) {
        if (!pkg || !pkg.blob) throw new Error('无导出内容');
        var fileName = sanitizeDownloadName(baseName, '.xmind');
        downloadBlob(fileName, pkg.blob);
        setStatus(dom.editStatus, '已导出 XMind：' + fileName, 'ok');
        safeLogOperation('export_case_files_xmind', 'case_file', currentFile.id || null, {
          format: 'xmind',
          count: 1,
          success: 1,
          fail: 0,
          case_file_ids: currentFile.id !== null && currentFile.id !== undefined ? [currentFile.id] : [],
          file_name: currentFile.file_name_clean || currentFile.file_name || '',
          file_names: [currentFile.file_name_clean || currentFile.file_name || ''].filter(Boolean),
          source: 'xmind_structure_viewer',
        });
        return true;
      })
      .catch(function(err) {
        setStatus(dom.editStatus, '导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
        return false;
      });
  }



  function normalizeXmindCaseLibraryText(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function normalizeXmindCaseLibraryCase(item) {
    var row = item && typeof item === 'object' ? item : {};
    var module = normalizeXmindCaseLibraryText(row.module || row.module_name || row['模块']);
    var title = normalizeXmindCaseLibraryText(row.title || row.case_title || row['用例标题']);
    var priority = normalizeXmindCaseLibraryText(row.priority || row.level || row['优先级']) || 'P1';
    var pre = normalizeXmindCaseLibraryText(row.preconditions || row.precondition || row['前提条件']);
    var steps = normalizeXmindCaseLibraryText(row.steps || row.actions || row['操作步骤']);
    var expected = normalizeXmindCaseLibraryText(row.expected || row.result || row['预期结果']);
    return {
      module: module,
      title: title,
      priority: priority,
      precondition: pre,
      preconditions: pre,
      steps: steps,
      expected: expected,
    };
  }

  function buildXmindCaseLibraryStrictKey(item) {
    var row = normalizeXmindCaseLibraryCase(item || {});
    return [row.module, row.title, row.priority, row.precondition, row.steps, row.expected]
      .map(function(seg) { return normalizeXmindCaseLibraryText(seg).toLowerCase(); })
      .join('::');
  }

  function buildXmindCaseLibraryLooseKey(item) {
    var row = normalizeXmindCaseLibraryCase(item || {});
    return [row.module, row.title, row.expected]
      .map(function(seg) { return normalizeXmindCaseLibraryText(seg).toLowerCase(); })
      .join('::');
  }

  function isXmindCaseLibraryStructSame(oldRow, newRow) {
    var a = normalizeXmindCaseLibraryCase(oldRow || {});
    var b = normalizeXmindCaseLibraryCase(newRow || {});
    return a.module === b.module
      && a.title === b.title
      && a.priority === b.priority
      && a.precondition === b.precondition
      && a.steps === b.steps
      && a.expected === b.expected;
  }

  function buildCaseLibraryXmindPatchDiff(existingItems, nextCases) {
    var oldList = Array.isArray(existingItems) ? existingItems : [];
    var nextList = Array.isArray(nextCases) ? nextCases : [];
    var oldSlots = oldList.map(function(item, idx) {
      return {
        idx: idx,
        item: item,
        normalized: normalizeXmindCaseLibraryCase(item),
        matched: false,
      };
    });
    var nextSlots = nextList.map(function(item2, idx2) {
      return {
        idx: idx2,
        normalized: normalizeXmindCaseLibraryCase(item2),
        matchedOld: null,
      };
    });

    function matchBy(buildOldKey, buildNewKey) {
      nextSlots.forEach(function(nextSlot) {
        if (nextSlot.matchedOld) return;
        var targetKey = buildNewKey(nextSlot.normalized);
        for (var i = 0; i < oldSlots.length; i += 1) {
          var oldSlot = oldSlots[i];
          if (oldSlot.matched) continue;
          if (buildOldKey(oldSlot.normalized) !== targetKey) continue;
          oldSlot.matched = true;
          nextSlot.matchedOld = oldSlot;
          break;
        }
      });
    }

    matchBy(buildXmindCaseLibraryStrictKey, buildXmindCaseLibraryStrictKey);
    matchBy(buildXmindCaseLibraryLooseKey, buildXmindCaseLibraryLooseKey);

    var updates = [];
    var creates = [];
    var deletes = [];

    nextSlots.forEach(function(nextSlot2) {
      var norm = nextSlot2.normalized;
      if (nextSlot2.matchedOld) {
        var oldItem = nextSlot2.matchedOld.item || {};
        if (!isXmindCaseLibraryStructSame(oldItem, norm)) {
          updates.push({
            id: oldItem.id,
            payload: {
              module: norm.module,
              title: norm.title,
              priority: norm.priority,
              precondition: norm.precondition,
              steps: norm.steps,
              expected: norm.expected,
            },
          });
        }
      } else {
        creates.push({
          payload: {
            module: norm.module,
            title: norm.title,
            priority: norm.priority,
            precondition: norm.precondition,
            steps: norm.steps,
            expected: norm.expected,
            remark: '',
          },
        });
      }
    });

    oldSlots.forEach(function(oldSlot2) {
      if (oldSlot2.matched) return;
      var oldItem2 = oldSlot2.item || {};
      if (!oldItem2.id) return;
      deletes.push({ id: oldItem2.id });
    });

    return {
      updates: updates,
      creates: creates,
      deletes: deletes,
    };
  }

  function saveCaseLibraryXmindCases(nextCases, summary) {
    var file = state.editor && state.editor.caseFile ? state.editor.caseFile : null;
    if (!file || !file.id) {
      return Promise.reject(new Error('请先选择用例文件'));
    }
    var existing = Array.isArray(state.editor && state.editor.items) ? state.editor.items.slice() : [];
    var nextList = (Array.isArray(nextCases) ? nextCases : []).map(function(entry) {
      return normalizeXmindCaseLibraryCase(entry);
    }).filter(function(entry2) {
      return Boolean(entry2.module && entry2.title && entry2.expected);
    });
    var diff = buildCaseLibraryXmindPatchDiff(existing, nextList);
    var changeCount = diff.updates.length + diff.creates.length + diff.deletes.length;

    if (!changeCount) {
      setStatus(dom.editStatus, 'XMind 编辑无改动，已保持当前状态', 'ok');
      return Promise.resolve({ changed: 0, updates: 0, creates: 0, deletes: 0 });
    }

    setStatus(dom.editStatus, '正在保存 XMind 编辑...', '');

    var chain = Promise.resolve();
    diff.updates.forEach(function(entry3) {
      chain = chain.then(function() {
        return apiClient.updateCaseItem(entry3.id, entry3.payload || {});
      });
    });
    diff.creates.forEach(function(entry4) {
      chain = chain.then(function() {
        return apiClient.createCaseItem(file.id, entry4.payload || {});
      });
    });
    diff.deletes.forEach(function(entry5) {
      chain = chain.then(function() {
        return apiClient.deleteCaseItem(entry5.id);
      });
    });

    return chain
      .then(function() {
        return apiClient.listCaseItems(file.id);
      })
      .then(function(items) {
        state.editor.items = reorderItemsByExistingModuleAppend(Array.isArray(items) ? items : []);
        state.editor.pageIndex = 0;
        state.editor.selection = new Set();
        renderEditorCard();
        syncEditorSearchControls();
        syncEditorBatchDeleteControls();
        syncEditorBatchAddControls();
        syncCaseLibraryAiGenContext();

        setStatus(dom.editStatus, 'XMind 编辑保存成功', 'ok');
        safeLogOperation('save_case_file_xmind_structure', 'case_file', file.id || null, {
          case_file_id: file.id || null,
          summary: summary || {},
          updates: diff.updates.length,
          creates: diff.creates.length,
          deletes: diff.deletes.length,
        });
        return {
          changed: changeCount,
          updates: diff.updates.length,
          creates: diff.creates.length,
          deletes: diff.deletes.length,
        };
      })
      .catch(function(err) {
        var msg = err && err.message ? String(err.message) : '保存失败';
        setStatus(dom.editStatus, 'XMind 编辑保存失败：' + msg, 'err');
        throw err;
      });
  }


  function normalizeCaseLibraryLocatePath(pathArr) {
    if (!Array.isArray(pathArr)) return [];
    return pathArr.map(function(seg) {
      if (seg === null || seg === undefined) return '';
      return String(seg).trim();
    });
  }

  function buildCaseLibraryLocatePaths(list, mindApi) {
    var items = Array.isArray(list) ? list : [];
    if (mindApi && typeof mindApi.buildPathsFromCases === 'function') {
      try {
        var built = mindApi.buildPathsFromCases(items, {
          fallbackModule: '用例模块',
        });
        if (Array.isArray(built) && built.length) {
          return built.map(function(pathArr) {
            return normalizeCaseLibraryLocatePath(pathArr);
          });
        }
      } catch (err) {
        // ignore
      }
    }
    return items.map(function(item) {
      var row = normalizeXmindCaseLibraryCase(item || {});
      return normalizeCaseLibraryLocatePath([
        row.module,
        row.title,
        row.priority,
        row.precondition,
        row.steps,
        row.expected,
      ]);
    });
  }

  function isCaseLibraryLocatePathMatch(targetPath, fullPath) {
    var target = Array.isArray(targetPath) ? targetPath : [];
    var full = Array.isArray(fullPath) ? fullPath : [];
    if (!target.length || full.length < target.length) return false;
    for (var i = 0; i < target.length; i += 1) {
      if (target[i] !== full[i]) return false;
    }
    return true;
  }

  function findCaseLibraryIndexByXmindPath(pathArr, list, mindApi) {
    var targetPath = normalizeCaseLibraryLocatePath(pathArr);
    if (!targetPath.length) return -1;
    var locatePaths = buildCaseLibraryLocatePaths(list, mindApi);
    for (var i = 0; i < locatePaths.length; i += 1) {
      if (isCaseLibraryLocatePathMatch(targetPath, locatePaths[i])) {
        return i;
      }
    }
    return -1;
  }

  function locateCaseLibraryCaseFromXmind(pathArr, mindApi) {
    var list = Array.isArray(state.editor && state.editor.items) ? state.editor.items : [];
    var idx = findCaseLibraryIndexByXmindPath(pathArr, list, mindApi);
    if (idx < 0) {
      setStatus(dom.editStatus, '未找到对应的用例条目', 'warn');
      return;
    }
    var pageSize = getPageSize();
    if (!isFinite(pageSize) || pageSize <= 0) pageSize = 20;
    state.editor.pageIndex = Math.floor(idx / pageSize);
    renderEditorTable();
    setTimeout(function() {
      scrollEditorToIndex(idx);
      flashCaseLibraryXmindLocateHighlight(idx, 3200);
    }, 0);
    setStatus(dom.editStatus, '已定位到第 ' + String(idx + 1) + ' 条用例', 'ok');
  }

  function openCaseLibraryXmindStructure() {
    var mindApi = getMindElixirApi();
    if (!mindApi || typeof mindApi.buildMindDataFromCases !== 'function' || typeof mindApi.renderMindMap !== 'function') {
      setStatus(dom.editStatus, 'XMind 结构渲染依赖未就绪', 'err');
      return;
    }
    var currentFile = state.editor && state.editor.caseFile ? state.editor.caseFile : null;
    var list = Array.isArray(state.editor && state.editor.items) ? state.editor.items : [];
    if (!currentFile || !list.length) {
      setStatus(dom.editStatus, '请先选择查看&编辑用例', 'warn');
      return;
    }

    var drawer = ensureCaseLibraryXmindDrawer();
    if (!drawer || typeof drawer.open !== 'function') {
      setStatus(dom.editStatus, 'XMind 结构抽屉未就绪', 'err');
      return;
    }
    var title = document.getElementById('xmindStructureDrawerTitle');
    if (title) {
      title.textContent = 'XMind 用例结构 - ' + (currentFile.file_name_clean || currentFile.file_name || '当前用例');
    }
    var body = document.getElementById('xmindStructureDrawerBody');
    if (!body) {
      setStatus(dom.editStatus, 'XMind 结构容器未找到', 'err');
      return;
    }

    drawer.open();
    setCaseLibraryXmindDrawerBodyViewerMode(true);
    body.innerHTML = '<div class="xmind-structure-viewer" id="caseLibraryXmindStructureViewer"></div>';
    var container = document.getElementById('caseLibraryXmindStructureViewer');
    if (!container) {
      if (typeof drawer.close === 'function') drawer.close();
      setStatus(dom.editStatus, 'XMind 结构容器初始化失败', 'err');
      return;
    }
    var mindData = mindApi.buildMindDataFromCases(list, {
      rootTitle: cleanCaseFileName(currentFile.file_name_clean || currentFile.file_name || '用例'),
      fallbackModule: '用例模块',
    });
    try {
      caseLibraryXmindMindInstance = mindApi.renderMindMap(container, mindData, {
        instance: caseLibraryXmindMindInstance,
        direction: 'right',
        onExportXmind: exportCurrentCaseLibraryXmind,
        editableSessionKey: 'tap-case-library-xmind-edit-' + String(currentFile.id || ''),
        onSaveCases: saveCaseLibraryXmindCases,
        onNodeDblClickLocate: function(payload) {
          if (!payload || !Array.isArray(payload.path)) return;
          locateCaseLibraryCaseFromXmind(payload.path, mindApi);
        },
        openConfirmDrawer: openConfirmDrawer,
        showToast: utils && typeof utils.showCenterToast === 'function' ? utils.showCenterToast : null,
      });
      bindCaseLibraryXmindThemeSync(mindApi);
    } catch (err) {
      console.error(err);
      if (typeof drawer.close === 'function') drawer.close();
      setStatus(dom.editStatus, 'XMind 结构渲染失败', 'err');
      return;
    }
    safeLogOperation('view_case_file_xmind_structure', 'case_file', currentFile.id || null, {
      case_file_id: currentFile.id || null,
      file_name: currentFile.file_name_clean || currentFile.file_name || '',
    });
  }


	  function getCaseLibraryWriterDefaultPath() {
    return [
      '子模块：修改此处以确定子模块',
      '用例名：修改此处以确定用例名',
      '优先级：修改此处以确定优先级（如P1）',
      '前置条件：修改此处以确定前置条件',
      '执行步骤：修改此处以确定执行步骤',
      '预期结果：修改此处以确定预期结果',
    ];
  }

  function getCaseLibraryWriterRootTitle() {
    return '用例：修改此处以确定用例的文件名';
  }

  function getCaseLibraryWriterSessionKey() {
    var uid = getCurrentUserId();
    return 'tap-case-library-writer-xmind-edit-' + String(uid || 'guest');
  }

  function isLegacyWriterSchemaData(data) {
    if (!data || !data.nodeData) return false;

    var firstChild = data.nodeData && Array.isArray(data.nodeData.children) && data.nodeData.children.length
      ? data.nodeData.children[0]
      : null;
    var firstTopic = firstChild && firstChild.topic !== undefined && firstChild.topic !== null
      ? String(firstChild.topic).trim()
      : '';
    if (firstTopic.indexOf('父模块') === 0) return true;
    if (firstTopic.indexOf('用例名：修改此处以确定用例名') === 0) return true;
    return false;
  }

  function migrateCaseLibraryWriterSessionRootTitle() {
    if (typeof localStorage === 'undefined') return;
    var key = getCaseLibraryWriterSessionKey();
    if (!key) return;
    var raw = '';
    try {
      raw = localStorage.getItem(String(key)) || '';
    } catch (err1) {
      raw = '';
    }
    if (!raw) return;

    var payload = null;
    try {
      payload = JSON.parse(raw);
    } catch (err2) {
      payload = null;
    }
    if (!payload || typeof payload !== 'object') return;

    var hasLegacySchema = Boolean(
      isLegacyWriterSchemaData(payload.baseData) ||
      isLegacyWriterSchemaData(payload.currentData) ||
      (Array.isArray(payload.history) && payload.history.some(function(entry) {
        return isLegacyWriterSchemaData(entry);
      }))
    );
    if (hasLegacySchema) {
      try {
        localStorage.removeItem(String(key));
      } catch (err3) {
        // ignore
      }
      return;
    }

    var nextTitle = getCaseLibraryWriterRootTitle();
    if (!nextTitle) return;
    var changed = false;

    function updateMindDataRoot(data) {
      if (!data || !data.nodeData) return;
      var topic = String(data.nodeData.topic || '').trim();
      if (topic !== '编写用例' && topic !== '用例名：修改此处以确定用例名' && topic !== '用例') return;
      data.nodeData.topic = nextTitle;
      changed = true;
    }

    updateMindDataRoot(payload.baseData);
    updateMindDataRoot(payload.currentData);
    if (Array.isArray(payload.history)) {
      payload.history.forEach(function(entry) {
        updateMindDataRoot(entry);
      });
    }

    if (!changed) return;
    try {
      localStorage.setItem(String(key), JSON.stringify(payload));
    } catch (err4) {
      // ignore
    }
  }

  function readCaseLibraryWriterMindDataFromInstance() {
    var inst = caseLibraryXmindMindInstance;
    if (!inst) return null;
    try {
      if (typeof inst.getData === 'function') {
        var data = inst.getData();
        if (data && data.nodeData) {
          return JSON.parse(JSON.stringify(data));
        }
      }
    } catch (err0) {
      // ignore
    }
    try {
      if (typeof inst.getDataString === 'function') {
        var raw = inst.getDataString();
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && parsed.nodeData) return parsed;
        }
      }
    } catch (err1) {
      // ignore
    }
    try {
      if (inst.nodeData) {
        return JSON.parse(JSON.stringify({ nodeData: inst.nodeData }, function(key, value) {
          if (key === 'parent') return undefined;
          return value;
        }));
      }
    } catch (err2) {
      // ignore
    }
    return null;
  }

  function collectCaseLibraryWriterLeafPaths(node, depth, pathTopics, output) {
    if (!node) return;
    var topics = Array.isArray(pathTopics) ? pathTopics.slice() : [];
    if (depth > 0) {
      topics.push(normalizeXmindCaseLibraryText(node.topic));
    }
    var children = Array.isArray(node.children) ? node.children : [];
    if (!children.length) {
      if (depth > 0) {
        output.push(topics);
      }
      return;
    }
    for (var i = 0; i < children.length; i += 1) {
      collectCaseLibraryWriterLeafPaths(children[i], depth + 1, topics, output);
    }
  }

  function buildCaseLibraryWriterExportCases(mindData) {
    var root = mindData && mindData.nodeData ? mindData.nodeData : null;
    if (!root) return [];
    var leafPaths = [];
    collectCaseLibraryWriterLeafPaths(root, 0, [], leafPaths);
    if (!leafPaths.length) return [];

    return leafPaths.map(function(path) {
      var moduleValue = normalizeCaseLibraryWriterTopic(path[0]);
      var titleValue = normalizeCaseLibraryWriterTopic(path[1]);
      var priorityValue = normalizePriorityInput(normalizeCaseLibraryWriterTopic(path[2])) || 'P1';
      var preValue = normalizeCaseLibraryWriterTopic(path[3]);
      var stepsValue = normalizeCaseLibraryWriterTopic(path[4]);
      var expectedValue = normalizeCaseLibraryWriterTopic(path[5]);
      return {
        module: moduleValue || '-',
        title: titleValue || '-',
        priority: priorityValue || 'P1',
        precondition: preValue || '-',
        preconditions: preValue || '-',
        steps: stepsValue || '-',
        expected: expectedValue || '-',
        remark: '',
      };
    }).filter(Boolean);
  }

  function deriveCaseLibraryWriterExportBaseName(mindData) {
    var rootTopic = '';
    if (mindData && mindData.nodeData && mindData.nodeData.topic !== undefined && mindData.nodeData.topic !== null) {
      rootTopic = String(mindData.nodeData.topic || '').trim();
    }
    if (rootTopic.indexOf('用例：') === 0) {
      rootTopic = String(rootTopic.slice(3) || '').trim();
    }
    if (!rootTopic) {
      rootTopic = '编写用例';
    }
    return cleanCaseFileName(rootTopic || '编写用例');
  }

  function exportCaseLibraryWriterCurrentXmind() {
    var builder = getXmindBuilder();
    if (!builder) {
      setStatus(dom.status, '缺少 XMind 导出依赖', 'err');
      return Promise.resolve(false);
    }
    var downloadBlob = getDownloadBlob();
    if (!downloadBlob) {
      setStatus(dom.status, '缺少下载能力，无法导出', 'err');
      return Promise.resolve(false);
    }

    var mindData = readCaseLibraryWriterMindDataFromInstance();
    if (!mindData || !mindData.nodeData) {
      setStatus(dom.status, '当前导图无可导出内容', 'warn');
      return Promise.resolve(false);
    }

    var cases = buildCaseLibraryWriterExportCases(mindData);
    if (!cases.length) {
      setStatus(dom.status, '当前导图无可导出内容', 'warn');
      return Promise.resolve(false);
    }

    var baseName = deriveCaseLibraryWriterExportBaseName(mindData) || '编写用例';
    setStatus(dom.status, '正在导出 XMind...', '');

    return Promise.resolve()
      .then(function() {
        return builder(cases, baseName, '');
      })
      .then(function(pkg) {
        if (!pkg || !pkg.blob) throw new Error('无导出内容');
        var fileName = sanitizeDownloadName(baseName, '.xmind');
        downloadBlob(fileName, pkg.blob);
        setStatus(dom.status, '已导出 XMind：' + fileName, 'ok');
        safeLogOperation('export_case_files_xmind', 'case_file', null, {
          format: 'xmind',
          count: 1,
          success: 1,
          fail: 0,
          source: 'case_library_writer_xmind',
        });
        return true;
      })
      .catch(function(err) {
        setStatus(dom.status, '导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
        return false;
      });
  }

  function buildCaseLibraryWriterMindData(mindApi) {
    var api = mindApi || getMindElixirApi();
    if (!api || typeof api.buildMindDataFromPaths !== 'function') return null;
    return api.buildMindDataFromPaths([getCaseLibraryWriterDefaultPath()], {
      rootTitle: getCaseLibraryWriterRootTitle(),
    });
  }

  function normalizeCaseLibraryWriterTopic(value) {
    var text = normalizeXmindCaseLibraryText(value);
    if (!text || text === '-') return '';
    return text;
  }


  function parseCaseLibraryWriterTopics(topics) {
    var segs = Array.isArray(topics) ? topics : [];
    var moduleValue = normalizeCaseLibraryWriterTopic(segs[0]);
    var caseName = normalizeCaseLibraryWriterTopic(segs[1]);
    var priorityValue = normalizeCaseLibraryWriterTopic(segs[2]);
    priorityValue = normalizePriorityInput(priorityValue);
    var preValue = normalizeCaseLibraryWriterTopic(segs[3]);
    var stepsValue = normalizeCaseLibraryWriterTopic(segs[4]);
    var expectedValue = normalizeCaseLibraryWriterTopic(segs[5]);

    var emptyIndexes = [];
    if (!moduleValue) emptyIndexes.push(0);
    if (!caseName) emptyIndexes.push(1);
    if (!priorityValue) emptyIndexes.push(2);
    if (!preValue) emptyIndexes.push(3);
    if (!stepsValue) emptyIndexes.push(4);
    if (!expectedValue) emptyIndexes.push(5);
    if (emptyIndexes.length) {
      return {
        caseItem: null,
        emptyIndexes: emptyIndexes,
      };
    }

    return {
      caseItem: {
        module: moduleValue,
        title: caseName,
        priority: priorityValue,
        precondition: preValue,
        preconditions: preValue,
        steps: stepsValue,
        expected: expectedValue,
        remark: '',
      },
      emptyIndexes: [],
    };
  }

  function mapWriterCasesToImportItems(cases) {
    var list = Array.isArray(cases) ? cases : [];
    return buildImportItems(list.map(function(item) {
      var row = normalizeXmindCaseLibraryCase(item || {});
      var moduleValue = normalizeCaseLibraryWriterTopic(row.module);
      var titleValue = normalizeCaseLibraryWriterTopic(row.title);
      var priorityValue = normalizeCaseLibraryWriterTopic(row.priority);
      priorityValue = normalizePriorityInput(priorityValue);
      var preValue = normalizeCaseLibraryWriterTopic(row.precondition || row.preconditions);
      var stepsValue = normalizeCaseLibraryWriterTopic(row.steps);
      var expectedValue = normalizeCaseLibraryWriterTopic(row.expected);
      return {
        module: moduleValue,
        title: titleValue,
        priority: priorityValue,
        precondition: preValue,
        preconditions: preValue,
        steps: stepsValue,
        expected: expectedValue,
        remark: '',
      };
    }));
  }

  function deriveWriterImportFileName(items) {
    var list = Array.isArray(items) ? items : [];
    var raw = '';
    if (list.length) {
      raw = normalizeXmindCaseLibraryText(list[0].title || list[0].module || '');
    }
    var clean = cleanCaseFileName(raw || '编写用例');
    if (!clean) clean = '编写用例';
    return clean + '.xmind';
  }

  function clearCaseLibraryWriterPendingResolver() {
    state.writer.pendingResolve = null;
    state.writer.pendingReject = null;
  }

  function resolveCaseLibraryWriterPendingSave(payload) {
    var resolve = state.writer.pendingResolve;
    clearCaseLibraryWriterPendingResolver();
    if (typeof resolve === 'function') {
      try {
        resolve(payload || null);
      } catch (err) {
        // ignore
      }
    }
  }

  function rejectCaseLibraryWriterPendingSave(reason, silentOnly) {
    var reject = state.writer.pendingReject;
    clearCaseLibraryWriterPendingResolver();
    if (typeof reject === 'function') {
      if (silentOnly) {
        try {
          reject({
            silent: true,
            message: reason || '已取消入库',
          });
        } catch (err) {
          // ignore
        }
        return;
      }
      try {
        reject(new Error(reason || '入库失败'));
      } catch (err2) {
        // ignore
      }
    }
  }

  function syncCaseLibraryWriterPublishConfirmEnabled() {
    if (!dom.writerPublishConfirmBtn) return;
    var writer = state.writer || {};
    var can = Boolean(
      !writer.publishing &&
      writer.projectId &&
      writer.versionId &&
      writer.fileNameInput &&
      writer.fileNameClean &&
      !writer.fileNameChecking &&
      Array.isArray(writer.draftItems) &&
      writer.draftItems.length
    );
    dom.writerPublishConfirmBtn.disabled = !can;
  }

  function normalizeCaseLibraryWriterPublishFileName(raw) {
    var text = raw === null || raw === undefined ? '' : String(raw);
    text = text.trim();
    if (!text) {
      return {
        input: '',
        clean: '',
        fileName: '',
      };
    }
    var clean = cleanCaseFileName(text || '编写用例');
    clean = clean ? String(clean).trim() : '';
    return {
      input: text,
      clean: clean,
      fileName: clean ? (clean + '.xmind') : '',
    };
  }

  function syncCaseLibraryWriterPublishFileNameStatus() {
    if (!dom.writerPublishFileNameStatus) return;
    var writer = state.writer || {};
    if (!writer.fileNameInput || !writer.fileNameClean) {
      setStatus(dom.writerPublishFileNameStatus, '请输入用例文件名（必填）', 'warn');
      return;
    }
    if (!writer.projectId) {
      setStatus(dom.writerPublishFileNameStatus, '请选择项目后自动校验重名', '');
      return;
    }
    if (writer.fileNameChecking) {
      setStatus(dom.writerPublishFileNameStatus, '正在校验重名...', '');
      return;
    }
    if (writer.fileNameDuplicate) {
      setStatus(dom.writerPublishFileNameStatus, '检测到同名用例：' + writer.fileNameClean + '，可继续确认并在下一步决定是否覆盖', 'warn');
      return;
    }
    setStatus(dom.writerPublishFileNameStatus, '文件名可用：' + writer.fileNameClean, 'ok');
  }

  function setCaseLibraryWriterPublishFileName(raw, options) {
    var opts = options || {};
    var writer = state.writer || {};
    var normalized = normalizeCaseLibraryWriterPublishFileName(raw);
    writer.fileNameInput = normalized.input;
    writer.fileNameClean = normalized.clean;
    writer.draftFileName = normalized.fileName;
    writer.fileNameDuplicate = false;
    writer.fileNameChecking = false;
    writer.duplicateCaseFileId = null;
    state.writer = writer;
    if (dom.writerPublishFileNameInput && dom.writerPublishFileNameInput.value !== normalized.input) {
      dom.writerPublishFileNameInput.value = normalized.input;
    }
    syncCaseLibraryWriterPublishFileNameStatus();
    syncCaseLibraryWriterPublishConfirmEnabled();
    if (opts.skipCheck) return;
    scheduleCaseLibraryWriterPublishFileNameDuplicateCheck(false);
  }

  function runCaseLibraryWriterPublishFileNameDuplicateCheck() {
    writerPublishFileNameCheckTimer = 0;
    var writer = state.writer || {};
    writer.fileNameChecking = false;
    writer.fileNameDuplicate = false;
    writer.duplicateCaseFileId = null;
    if (!writer.fileNameInput || !writer.fileNameClean || !writer.projectId) {
      syncCaseLibraryWriterPublishFileNameStatus();
      syncCaseLibraryWriterPublishConfirmEnabled();
      return;
    }
    if (!apiClient || typeof apiClient.listCaseFiles !== 'function') {
      syncCaseLibraryWriterPublishFileNameStatus();
      syncCaseLibraryWriterPublishConfirmEnabled();
      return;
    }

    var requestSeq = writerPublishFileNameCheckSeq + 1;
    writerPublishFileNameCheckSeq = requestSeq;
    writer.fileNameChecking = true;
    syncCaseLibraryWriterPublishFileNameStatus();
    syncCaseLibraryWriterPublishConfirmEnabled();

    var projectId = writer.projectId;
    var targetCleanName = String(writer.fileNameClean || '');
    apiClient.listCaseFiles(projectId)
      .then(function(files) {
        if (requestSeq !== writerPublishFileNameCheckSeq) return;
        var list = Array.isArray(files) ? files : [];
        var hit = null;
        for (var i = 0; i < list.length; i += 1) {
          var file = list[i];
          if (!file) continue;
          var dbName = cleanCaseFileName(file.file_name_clean || file.file_name || '');
          if (String(dbName || '') !== String(targetCleanName || '')) continue;
          hit = file;
          break;
        }
        writer.fileNameChecking = false;
        writer.fileNameDuplicate = Boolean(hit);
        writer.duplicateCaseFileId = hit && hit.id ? hit.id : null;
        syncCaseLibraryWriterPublishFileNameStatus();
        syncCaseLibraryWriterPublishConfirmEnabled();
      })
      .catch(function() {
        if (requestSeq !== writerPublishFileNameCheckSeq) return;
        writer.fileNameChecking = false;
        writer.fileNameDuplicate = false;
        writer.duplicateCaseFileId = null;
        setStatus(dom.writerPublishFileNameStatus, '重名校验失败，确认入库时会再次校验', 'warn');
        syncCaseLibraryWriterPublishConfirmEnabled();
      });
  }

  function scheduleCaseLibraryWriterPublishFileNameDuplicateCheck(immediate) {
    if (writerPublishFileNameCheckTimer) {
      clearTimeout(writerPublishFileNameCheckTimer);
      writerPublishFileNameCheckTimer = 0;
    }
    var delay = immediate ? 0 : 220;
    writerPublishFileNameCheckTimer = setTimeout(function() {
      runCaseLibraryWriterPublishFileNameDuplicateCheck();
    }, delay);
  }

  function deriveCaseLibraryWriterPublishDefaultFileName(items, saveMeta) {
    var fromMindRoot = '';
    var meta = saveMeta && typeof saveMeta === 'object' ? saveMeta : null;
    if (meta && meta.mindData && meta.mindData.nodeData) {
      fromMindRoot = deriveCaseLibraryWriterExportBaseName(meta.mindData);
    }
    if (!fromMindRoot) {
      var currentMindData = readCaseLibraryWriterMindDataFromInstance();
      if (currentMindData && currentMindData.nodeData) {
        fromMindRoot = deriveCaseLibraryWriterExportBaseName(currentMindData);
      }
    }
    if (!fromMindRoot) {
      var fallbackFileName = deriveWriterImportFileName(Array.isArray(items) ? items : []);
      fromMindRoot = cleanCaseFileName(fallbackFileName || '编写用例');
    }
    return fromMindRoot || '编写用例';
  }

  function buildWriterPublishHintText() {
    var writer = state.writer || {};
    var count = Array.isArray(writer.draftItems) ? writer.draftItems.length : 0;
    var cleanName = writer.fileNameClean || cleanCaseFileName(writer.draftFileName || '编写用例');
    return '待入库用例 ' + count + ' 条；文件名：' + (cleanName || '编写用例') + '。请选择项目和版本后确认入库。';
  }

  function fillCaseLibraryWriterVersionOptions(projectId, preferredVersionId) {
    if (!dom.writerPublishVersionSelect) return;
    syncVersionOptions(dom.writerPublishVersionSelect, projectId, '请选择版本', true);
    dom.writerPublishVersionSelect.disabled = false;
    var desired = normalizeId(preferredVersionId || '');
    if (desired) {
      var versions = projectId && state.versionsByProject[projectId] ? state.versionsByProject[projectId] : [];
      var exists = (versions || []).some(function(v) {
        return v && String(v.id) === String(desired);
      });
      if (exists) {
        dom.writerPublishVersionSelect.value = String(desired);
        state.writer.versionId = desired;
      }
    }
    syncCaseLibraryWriterPublishConfirmEnabled();
  }

  function ensureCaseLibraryWriterPublishDrawer() {
    if (writerPublishDrawerInstance) return writerPublishDrawerInstance;
    writerPublishDrawerInstance = ensureDrawer(
      'caseLibraryWriterPublishDrawer',
      [],
      function() {
        syncCaseLibraryWriterPublishFileNameStatus();
        syncCaseLibraryWriterPublishConfirmEnabled();
      },
      function() {
        if (writerPublishFileNameCheckTimer) {
          clearTimeout(writerPublishFileNameCheckTimer);
          writerPublishFileNameCheckTimer = 0;
        }
        writerPublishFileNameCheckSeq += 1;
        if (state.writer.publishing) state.writer.publishing = false;
        if (state.writer) state.writer.fileNameChecking = false;
        syncCaseLibraryWriterPublishFileNameStatus();
        syncCaseLibraryWriterPublishConfirmEnabled();
        if (state.writer.pendingReject) {
          rejectCaseLibraryWriterPendingSave('已取消入库', true);
        }
      }
    );
    return writerPublishDrawerInstance;
  }


  function openCaseLibraryWriterPublishDrawer(items, summary, options) {
    var opts = options || {};
    var drawer = ensureCaseLibraryWriterPublishDrawer();
    if (!drawer || typeof drawer.open !== 'function') {
      return Promise.reject(new Error('确认入库抽屉未就绪'));
    }
    var writer = state.writer || {};
    writer.loading = false;
    writer.publishing = false;
    writer.summary = summary || null;
    writer.draftItems = Array.isArray(items) ? items.slice() : [];
    writer.fileNameDuplicate = false;
    writer.fileNameChecking = false;
    writer.duplicateCaseFileId = null;
    var defaultFileName = deriveCaseLibraryWriterPublishDefaultFileName(writer.draftItems, opts.saveMeta || null);
    var normalizedDefaultFileName = normalizeCaseLibraryWriterPublishFileName(defaultFileName);
    writer.fileNameInput = normalizedDefaultFileName.input;
    writer.fileNameClean = normalizedDefaultFileName.clean;
    writer.draftFileName = normalizedDefaultFileName.fileName;

    var preferredProjectId = null;
    var preferredVersionId = null;
    if (state.importDrawer && state.importDrawer.projectId) {
      preferredProjectId = state.importDrawer.projectId;
      preferredVersionId = state.importDrawer.versionId || null;
    } else if (state.editDrawer && state.editDrawer.projectId) {
      preferredProjectId = state.editDrawer.projectId;
      preferredVersionId = state.editDrawer.versionId || null;
    }

    writer.projectId = preferredProjectId;
    writer.versionId = null;
    state.writer = writer;

    if (dom.writerPublishHint) {
      dom.writerPublishHint.textContent = buildWriterPublishHintText();
    }
    if (dom.writerPublishFileNameInput) {
      dom.writerPublishFileNameInput.value = writer.fileNameInput || '';
    }
    setStatus(dom.writerPublishFileNameStatus, '', '');
    setStatus(dom.writerPublishStatus, '', '');

    if (dom.writerPublishProjectSelect) {
      dom.writerPublishProjectSelect.innerHTML = '<option value="">加载项目中...</option>';
      dom.writerPublishProjectSelect.value = '';
    }
    if (dom.writerPublishVersionSelect) {
      dom.writerPublishVersionSelect.disabled = true;
      dom.writerPublishVersionSelect.innerHTML = '<option value="">请选择版本</option>';
      dom.writerPublishVersionSelect.value = '';
    }
    if (writerPublishFileNameCheckTimer) {
      clearTimeout(writerPublishFileNameCheckTimer);
      writerPublishFileNameCheckTimer = 0;
    }
    writerPublishFileNameCheckSeq += 1;
    syncCaseLibraryWriterPublishFileNameStatus();
    syncCaseLibraryWriterPublishConfirmEnabled();
    drawer.open();

    setStatus(dom.writerPublishStatus, '加载项目中...', '');
    return ensureProjectsReady()
      .then(function(projects) {
        var list = Array.isArray(projects) ? projects : [];
        var hasPreferredProject = list.some(function(p) {
          return p && String(p.id) === String(preferredProjectId || '');
        });
        if (!hasPreferredProject) {
          preferredProjectId = null;
          preferredVersionId = null;
        }
        if (!preferredProjectId && list.length === 1 && list[0] && list[0].id !== undefined && list[0].id !== null) {
          preferredProjectId = normalizeId(list[0].id);
        }

        writer.projectId = preferredProjectId;
        writer.versionId = null;
        state.writer = writer;

        if (dom.writerPublishProjectSelect) {
          syncProjectOptions(dom.writerPublishProjectSelect, '请选择项目');
          dom.writerPublishProjectSelect.value = preferredProjectId ? String(preferredProjectId) : '';
        }
        if (dom.writerPublishVersionSelect) {
          dom.writerPublishVersionSelect.disabled = true;
          dom.writerPublishVersionSelect.innerHTML = '<option value="">请选择版本</option>';
          dom.writerPublishVersionSelect.value = '';
        }
        syncCaseLibraryWriterPublishConfirmEnabled();

        if (!list.length) {
          setStatus(dom.writerPublishStatus, '暂无可用项目，请先创建项目', 'warn');
          return false;
        }

        if (!preferredProjectId) {
          setStatus(dom.writerPublishStatus, '请选择项目和版本后确认入库', '');
          syncCaseLibraryWriterPublishFileNameStatus();
          return true;
        }

        setStatus(dom.writerPublishStatus, '加载版本中...', '');
        return loadVersions(preferredProjectId)
          .then(function() {
            fillCaseLibraryWriterVersionOptions(preferredProjectId, preferredVersionId);
            setStatus(dom.writerPublishStatus, '', '');
            scheduleCaseLibraryWriterPublishFileNameDuplicateCheck(true);
            return true;
          })
          .catch(function(err) {
            setStatus(dom.writerPublishStatus, err && err.message ? err.message : '加载版本失败', 'err');
            return false;
          });
      })
      .catch(function(err) {
        setStatus(dom.writerPublishStatus, err && err.message ? err.message : '加载项目失败', 'err');
        return false;
      });
  }

  function handleCaseLibraryWriterPublishProjectChange() {
    var writer = state.writer || {};
    writer.projectId = normalizeId(dom.writerPublishProjectSelect ? dom.writerPublishProjectSelect.value : '');
    writer.versionId = null;
    if (!dom.writerPublishVersionSelect) {
      syncCaseLibraryWriterPublishConfirmEnabled();
      return;
    }
    dom.writerPublishVersionSelect.disabled = true;
    dom.writerPublishVersionSelect.innerHTML = '<option value="">请选择版本</option>';
    dom.writerPublishVersionSelect.value = '';
    writer.fileNameChecking = false;
    writer.fileNameDuplicate = false;
    writer.duplicateCaseFileId = null;
    if (writerPublishFileNameCheckTimer) {
      clearTimeout(writerPublishFileNameCheckTimer);
      writerPublishFileNameCheckTimer = 0;
    }
    writerPublishFileNameCheckSeq += 1;
    syncCaseLibraryWriterPublishFileNameStatus();
    syncCaseLibraryWriterPublishConfirmEnabled();
    if (!writer.projectId) {
      setStatus(dom.writerPublishStatus, '请先选择项目', 'warn');
      return;
    }
    setStatus(dom.writerPublishStatus, '加载版本中...', '');
    loadVersions(writer.projectId)
      .then(function() {
        fillCaseLibraryWriterVersionOptions(writer.projectId, null);
        setStatus(dom.writerPublishStatus, '', '');
        scheduleCaseLibraryWriterPublishFileNameDuplicateCheck(true);
      })
      .catch(function(err) {
        setStatus(dom.writerPublishStatus, err && err.message ? err.message : '加载版本失败', 'err');
      });
  }

  function handleCaseLibraryWriterPublishVersionChange() {
    var writer = state.writer || {};
    var raw = dom.writerPublishVersionSelect ? dom.writerPublishVersionSelect.value : '';
    if (utils && typeof utils.isAddVersionOption === 'function' && utils.isAddVersionOption(raw)) {
      var projectId = writer.projectId;
      if (!projectId) {
        setStatus(dom.writerPublishStatus, '请先选择项目', 'warn');
        if (dom.writerPublishVersionSelect) dom.writerPublishVersionSelect.value = writer.versionId || '';
        return;
      }
      if (!utils || typeof utils.openAddProjectVersionDrawer !== 'function') {
        setStatus(dom.writerPublishStatus, '新增版本组件未就绪，请刷新后重试', 'err');
        if (dom.writerPublishVersionSelect) dom.writerPublishVersionSelect.value = writer.versionId || '';
        return;
      }
      var prevValue = writer.versionId || '';
      if (dom.writerPublishVersionSelect) dom.writerPublishVersionSelect.value = prevValue ? String(prevValue) : '';
      if (dom.writerPublishVersionSelect) dom.writerPublishVersionSelect.disabled = true;
      syncCaseLibraryWriterPublishConfirmEnabled();
      var projectName = state.projectNameById && state.projectNameById[projectId]
        ? state.projectNameById[projectId]
        : ('项目#' + projectId);
      utils
        .openAddProjectVersionDrawer({
          projectId: projectId,
          projectName: projectName,
          previousDrawer: writerPublishDrawerInstance || null,
        })
        .then(function(res) {
          if (!res || res.ok !== true || !res.version) return;
          var list = state.versionsByProject[projectId];
          if (!Array.isArray(list)) list = [];
          var exists = list.some(function(v) {
            return v && String(v.id) === String(res.version.id);
          });
          if (!exists) list.unshift(res.version);
          state.versionsByProject[projectId] = list;
          if (!state.versionNameByProject[projectId]) state.versionNameByProject[projectId] = {};
          state.versionNameByProject[projectId][res.version.id] = res.version.name || ('版本#' + res.version.id);
          fillCaseLibraryWriterVersionOptions(projectId, res.version.id);
          writer.versionId = normalizeId(res.version.id);
          if (dom.writerPublishVersionSelect) dom.writerPublishVersionSelect.value = String(res.version.id);
        })
        .finally(function() {
          if (dom.writerPublishVersionSelect) dom.writerPublishVersionSelect.disabled = false;
          syncCaseLibraryWriterPublishConfirmEnabled();
        });
      return;
    }
    writer.versionId = normalizeId(raw);
    syncCaseLibraryWriterPublishConfirmEnabled();
  }

  function handleCaseLibraryWriterPublishFileNameInput() {
    var raw = dom.writerPublishFileNameInput ? dom.writerPublishFileNameInput.value : '';
    setCaseLibraryWriterPublishFileName(raw, { skipCheck: false });
    if (dom.writerPublishHint) {
      dom.writerPublishHint.textContent = buildWriterPublishHintText();
    }
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
        if (dom.editDrawerProjectSelect) dom.editDrawerProjectSelect.value = String(pid);
        if (caseFile && caseFile.version_id && dom.editDrawerVersionSelect) {
          state.editDrawer.versionId = normalizeId(caseFile.version_id);
        }
        state.editDrawer.projectId = pid;
        editDrawerInstance.open();
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

  function buildCaseLibraryWriterImportPayload() {
    var writer = state.writer || {};
    var projectId = writer.projectId;
    var versionId = writer.versionId;
    var items = Array.isArray(writer.draftItems) ? writer.draftItems : [];
    if (!projectId || !versionId || !items.length) return null;
    var normalizedFileName = normalizeCaseLibraryWriterPublishFileName(writer.fileNameInput || writer.draftFileName || '');
    writer.fileNameInput = normalizedFileName.input;
    writer.fileNameClean = normalizedFileName.clean;
    writer.draftFileName = normalizedFileName.fileName;
    if (!writer.draftFileName) return null;
    var payloadItems = sanitizeImportItemsForApi(items);
    if (!payloadItems.length) return null;
    return {
      project_id: projectId,
      version_id: versionId,
      file_name: writer.draftFileName,
      source: 'xmind_writer',
      items: payloadItems,
    };
  }

  function confirmCaseLibraryWriterPublish() {
    var writer = state.writer || {};
    if (writer.publishing) return;
    var normalizedName = normalizeCaseLibraryWriterPublishFileName(dom.writerPublishFileNameInput ? dom.writerPublishFileNameInput.value : writer.fileNameInput);
    writer.fileNameInput = normalizedName.input;
    writer.fileNameClean = normalizedName.clean;
    writer.draftFileName = normalizedName.fileName;
    if (!writer.fileNameInput || !writer.fileNameClean || !writer.draftFileName) {
      setStatus(dom.writerPublishFileNameStatus, '请输入有效的用例文件名（必填）', 'warn');
      syncCaseLibraryWriterPublishConfirmEnabled();
      return;
    }
    if (writer.fileNameChecking) {
      setStatus(dom.writerPublishFileNameStatus, '正在校验重名，请稍后再试', 'warn');
      syncCaseLibraryWriterPublishConfirmEnabled();
      return;
    }
    var payload = buildCaseLibraryWriterImportPayload();
    if (!payload) {
      setStatus(dom.writerPublishStatus, '待入库数据未就绪，请检查项目、版本和用例内容', 'warn');
      return;
    }
    writer.publishing = true;
    syncCaseLibraryWriterPublishConfirmEnabled();
    setStatus(dom.writerPublishStatus, '入库中...', '');

    function handleImportSuccess(caseFile, overwriteTag) {
      var cleanName = cleanCaseFileName(caseFile && caseFile.file_name_clean ? caseFile.file_name_clean : payload.file_name);
      var msg = overwriteTag ? ('覆盖入库成功：' + cleanName) : ('入库成功：' + cleanName);
      setStatus(dom.writerPublishStatus, msg, 'ok');
      setStatus(dom.status, msg, 'ok');
      setStatus(dom.editStatus, msg, 'ok');
      resolveCaseLibraryWriterPendingSave({
        caseFile: caseFile || null,
        overwrite: overwriteTag === true,
      });
      if (writerPublishDrawerInstance && typeof writerPublishDrawerInstance.close === 'function') {
        writerPublishDrawerInstance.close();
      }
      refreshCaseFileListsByProject(payload.project_id).then(function() {
        openEditorForImportedWriterCase(caseFile || null, payload.project_id, cleanName);
      });
    }

    apiClient.importCaseFile(payload)
      .then(function(caseFile) {
        handleImportSuccess(caseFile || null, false);
      })
      .catch(function(err) {
        var msg = err && err.message ? String(err.message) : '入库失败';
        var errPayload = err && err.payload ? err.payload : null;
        var sameName = msg.indexOf('同名') !== -1 || Boolean(errPayload && errPayload.existing_case_file_id);
        if (!sameName) {
          setStatus(dom.writerPublishStatus, '入库失败：' + msg, 'err');
          return;
        }
        setStatus(dom.writerPublishStatus, '检测到同名用例，打开差异对比中...', 'warn');
        openImportDiffForExternal({
          projectId: payload.project_id,
          versionId: payload.version_id,
          fileName: payload.file_name,
          items: payload.items,
          error: err,
          source: payload.source,
        }).then(function(res) {
          if (res && res.ok === true) {
            handleImportSuccess(res.caseFile || null, true);
            return;
          }
          setStatus(dom.writerPublishStatus, '已取消同名覆盖，可继续编辑或重新入库', 'warn');
        }).catch(function(diffErr) {
          setStatus(dom.writerPublishStatus, diffErr && diffErr.message ? diffErr.message : '同名差异处理失败', 'err');
        });
      })
      .finally(function() {
        writer.publishing = false;
        syncCaseLibraryWriterPublishConfirmEnabled();
      });
  }

  function requestCaseLibraryWriterPublishFromXmind(nextCases, summary, saveMeta) {
    var writerItems = mapWriterCasesToImportItems(nextCases || []);
    var invalid = validateImportItems(writerItems);
    if (invalid.length) {
      return Promise.reject(new Error('编写用例存在空字段，请补齐后再保存'));
    }

    if (state.writer.pendingReject) {
      rejectCaseLibraryWriterPendingSave('已取消上一次入库', true);
    }

    return new Promise(function(resolve, reject) {
      state.writer.pendingResolve = resolve;
      state.writer.pendingReject = reject;
      openCaseLibraryWriterPublishDrawer(writerItems, summary || null, { saveMeta: saveMeta || null }).catch(function(err) {
        rejectCaseLibraryWriterPendingSave(err && err.message ? String(err.message) : '确认入库抽屉未就绪', false);
      });
    });
  }

  function openCaseLibraryWriterStructure() {
    var mindApi = getMindElixirApi();
    if (!mindApi || typeof mindApi.buildMindDataFromPaths !== 'function' || typeof mindApi.renderMindMap !== 'function') {
      setStatus(dom.status, 'XMind 结构渲染依赖未就绪', 'err');
      return;
    }

    var drawer = ensureCaseLibraryXmindDrawer();
    if (!drawer || typeof drawer.open !== 'function') {
      setStatus(dom.status, 'XMind 结构抽屉未就绪', 'err');
      return;
    }

    var title = document.getElementById('xmindStructureDrawerTitle');
    if (title) title.textContent = 'XMind 编写用例';

    var body = document.getElementById('xmindStructureDrawerBody');
    if (!body) {
      setStatus(dom.status, 'XMind 结构容器未找到', 'err');
      return;
    }

    drawer.open();
    setCaseLibraryXmindDrawerBodyViewerMode(true);
    body.innerHTML = '<div class="xmind-structure-viewer" id="caseLibraryWriterXmindStructureViewer"></div>';
    var container = document.getElementById('caseLibraryWriterXmindStructureViewer');
    if (!container) {
      if (typeof drawer.close === 'function') drawer.close();
      setStatus(dom.status, 'XMind 结构容器初始化失败', 'err');
      return;
    }

    migrateCaseLibraryWriterSessionRootTitle();
    var mindData = buildCaseLibraryWriterMindData(mindApi);
    if (!mindData || !mindData.nodeData) {
      setStatus(dom.status, '默认编写结构初始化失败', 'err');
      return;
    }

    try {
      caseLibraryXmindMindInstance = mindApi.renderMindMap(container, mindData, {
        instance: caseLibraryXmindMindInstance,
        direction: 'right',
        onExportXmind: exportCaseLibraryWriterCurrentXmind,
        editableSessionKey: getCaseLibraryWriterSessionKey(),
        initialEditing: true,
        cancelConfirmSuffix: '确认要取消保存吗？取消后会丢弃全部更改并恢复默认结构。',
        fieldCount: 6,
        topicCaseParser: parseCaseLibraryWriterTopics,
        onSaveCases: requestCaseLibraryWriterPublishFromXmind,
        openConfirmDrawer: openConfirmDrawer,
        showToast: utils && typeof utils.showCenterToast === 'function' ? utils.showCenterToast : null,
      });
      bindCaseLibraryXmindThemeSync(mindApi);
    } catch (err) {
      console.error(err);
      if (typeof drawer.close === 'function') drawer.close();
      setStatus(dom.status, '编写结构渲染失败', 'err');
      return;
    }

    setStatus(dom.status, '已打开编写用例视图，可直接编辑并确认入库', 'ok');
    safeLogOperation('open_case_library_writer_xmind', 'case_file', null, {
      source: 'case_library_writer',
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

  function getCurrentLoginSeq() {
    // 兼容“用户信息尚未加载但已进入页面”的场景：用 loginSeq 作为一次登录会话的稳定标识。
    if (typeof localStorage === 'undefined') return '';
    try {
      return String(localStorage.getItem('tap-login-seq') || '');
    } catch (err) {
      return '';
    }
  }

  function normalizeEditDrawerOwnerFilter(value) {
    var raw = value === null || value === undefined ? '' : String(value);
    raw = raw.trim().toLowerCase();
    if (raw === 'all') return 'all';
    if (raw === 'me') return 'me';
    if (raw === 'shared') return 'shared';
    return 'all';
  }

  function isSharedCaseFile(file) {
    if (!file) return false;
    var source = file.source !== null && file.source !== undefined ? String(file.source) : '';
    source = source.trim().toLowerCase();
    if (!source) return false;
    if (source.indexOf('share:') === 0) return true;
    return source === 'share';
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

	  var editorPersistKey = 'tap-case-library-editor';
	  var editorBatchAddCountPersistKey = 'tap-case-library-editor-batch-add-count';

	  function readEditorPersistedState() {
	    if (typeof localStorage === 'undefined') return null;
	    try {
      var raw = localStorage.getItem(editorPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeEditorPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(editorPersistKey);
        return;
      }
      localStorage.setItem(editorPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

	  function clearEditorPersistedState() {
	    writeEditorPersistedState(null);
	  }

	  function readEditorBatchAddCountPersistedState() {
	    if (typeof localStorage === 'undefined') return null;
	    try {
	      var raw = localStorage.getItem(editorBatchAddCountPersistKey);
	      if (!raw) return null;
	      var parsed = JSON.parse(raw);
	      if (!parsed || typeof parsed !== 'object') return null;
	      return parsed;
	    } catch (err) {
	      return null;
	    }
	  }

	  function writeEditorBatchAddCountPersistedState(payload) {
	    if (typeof localStorage === 'undefined') return;
	    try {
	      if (!payload) {
	        localStorage.removeItem(editorBatchAddCountPersistKey);
	        return;
	      }
	      localStorage.setItem(editorBatchAddCountPersistKey, JSON.stringify(payload));
	    } catch (err) {
	      // ignore
	    }
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

  var importDrawerPersistKey = 'tap-case-library-import-drawer';

  function readImportDrawerPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(importDrawerPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeImportDrawerPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(importDrawerPersistKey);
        return;
      }
      localStorage.setItem(importDrawerPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
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

  var historyQueryPersistKey = 'tap-case-library-history-query';

  function readHistoryQueryPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(historyQueryPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeHistoryQueryPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(historyQueryPersistKey);
        return;
      }
      localStorage.setItem(historyQueryPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

  function persistHistoryQueryState() {
    var userId = getCurrentUserId();
    var loginSeq = getCurrentLoginSeq();
    if (!userId && !loginSeq) return;
    var persisted = readHistoryQueryPersistedState();
    if (persisted) {
      var sameUser = userId && String(persisted.user_id || '') === String(userId);
      var sameLogin = loginSeq && String(persisted.login_seq || '') === String(loginSeq);
      if (!sameUser && !sameLogin) persisted = null;
    }
    var projectId = state.historyQueryDrawer ? state.historyQueryDrawer.projectId : null;
    var versionId = state.historyQueryDrawer ? state.historyQueryDrawer.versionId : null;
    var searchText = state.historyQueryDrawer ? String(state.historyQueryDrawer.searchText || '') : '';
    // 保护：避免“初始化空值”覆盖掉已有选择导致无法恢复。
    if (!projectId && persisted) {
      projectId = normalizeId(persisted.project_id);
      versionId = normalizeId(persisted.version_id);
      searchText = persisted.search_text ? String(persisted.search_text) : searchText;
    }
    if (!projectId) return;
    writeHistoryQueryPersistedState({
      user_id: userId || '',
      login_seq: loginSeq || '',
      project_id: projectId || '',
      version_id: (versionId || versionId === 0) ? versionId : '',
      search_text: searchText || '',
      saved_at: Date.now(),
    });
  }

  function restoreHistoryQueryDrawerFromPersistedState() {
    if (!isAuthReady()) return Promise.resolve(false);
    var persisted = readHistoryQueryPersistedState();
    if (!persisted) return Promise.resolve(false);
    var userId = getCurrentUserId();
    var loginSeq = getCurrentLoginSeq();
    var okByUser = userId && String(persisted.user_id || '') === String(userId);
    var okByLogin = loginSeq && String(persisted.login_seq || '') === String(loginSeq);
    if (!okByUser && !okByLogin) return Promise.resolve(false);
    var projectId = normalizeId(persisted.project_id);
    var versionId = normalizeId(persisted.version_id);
    // normalizeId 会把 "0" 解析成 0（期望），把 "" 解析成 null。
    if (!projectId) return Promise.resolve(false);
    var hasProject = (state.projects || []).some(function(p) { return p && String(p.id) === String(projectId); });
    if (!hasProject) return Promise.resolve(false);

    state.historyQueryDrawer.projectId = projectId;
    state.historyQueryDrawer.versionId = (versionId || versionId === 0) ? versionId : null;
    state.historyQueryDrawer.searchText = persisted.search_text ? String(persisted.search_text) : '';
    state.historyQueryDrawer.pageIndex = 0;
    if (dom.historyDrawerProjectSelect) dom.historyDrawerProjectSelect.value = String(projectId);
    if (dom.historyDrawerSearchInput) dom.historyDrawerSearchInput.value = state.historyQueryDrawer.searchText || '';
    renderHistoryQueryDrawerList();

    if (!dom.historyDrawerVersionSelect) return Promise.resolve(true);
    dom.historyDrawerVersionSelect.disabled = true;
    dom.historyDrawerVersionSelect.innerHTML = '<option value=\"\">加载版本中...</option>';
    dom.historyDrawerVersionSelect.value = '';
    return loadVersions(projectId)
      .then(function() {
        if (!dom.historyDrawerVersionSelect) return true;
        dom.historyDrawerVersionSelect.disabled = false;
        syncVersionOptionsWithAll(dom.historyDrawerVersionSelect, projectId);
        var v = state.historyQueryDrawer.versionId;
        if (v || v === 0) dom.historyDrawerVersionSelect.value = String(v);
        else dom.historyDrawerVersionSelect.value = '';
        // 若此前已查询过，自动恢复列表（不加载“全量”，只加载已选择的项目/版本）。
        if (v || v === 0) {
          return loadHistoryQueryDrawerFiles().then(function() { return true; });
        }
        return true;
      })
      .catch(function() {
        return false;
      });
  }

  var historyDetailPersistKey = 'tap-case-library-history-detail';
  var caseLibraryLastViewPersistKey = 'tap-case-library-last-view';
  var missingViewPersistKey = 'tap-case-library-missing-view';
  var missingDrawerPersistKey = 'tap-case-library-missing-drawer';

  function readHistoryDetailPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(historyDetailPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeHistoryDetailPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(historyDetailPersistKey);
        return;
      }
      localStorage.setItem(historyDetailPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

  function clearHistoryDetailPersistedState() {
    writeHistoryDetailPersistedState(null);
  }

  function readCaseLibraryLastViewPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(caseLibraryLastViewPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeCaseLibraryLastViewPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(caseLibraryLastViewPersistKey);
        return;
      }
      localStorage.setItem(caseLibraryLastViewPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

  function readMissingViewPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(missingViewPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeMissingViewPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(missingViewPersistKey);
        return;
      }
      localStorage.setItem(missingViewPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

  function clearMissingViewPersistedState() {
    writeMissingViewPersistedState(null);
  }

  function readMissingDrawerPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(missingDrawerPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeMissingDrawerPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(missingDrawerPersistKey);
        return;
      }
      localStorage.setItem(missingDrawerPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

  function clearMissingDrawerPersistedState() {
    writeMissingDrawerPersistedState(null);
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

  function persistHistoryDetailSelection() {
    var userId = getCurrentUserId();
    var loginSeq = getCurrentLoginSeq();
    if (!userId && !loginSeq) return;
    var pid = state.historyDetail && state.historyDetail.projectId ? String(state.historyDetail.projectId) : '';
    var name = state.historyDetail && state.historyDetail.fileNameClean ? String(state.historyDetail.fileNameClean) : '';
    if (!pid || !name) return;
    writeHistoryDetailPersistedState({
      user_id: userId || '',
      login_seq: loginSeq || '',
      project_id: pid,
      file_name_clean: name,
      version_id: (state.historyDetail.versionId || state.historyDetail.versionId === 0) ? state.historyDetail.versionId : '',
      filter: state.historyDetail && state.historyDetail.filter ? String(state.historyDetail.filter) : '',
      page_index: state.historyDetail && isFinite(Number(state.historyDetail.pageIndex)) ? Number(state.historyDetail.pageIndex) : 0,
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

  var selectDrawerPersistKey = 'tap-case-library-select-drawer';

  function readSelectDrawerPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(selectDrawerPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeSelectDrawerPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(selectDrawerPersistKey);
        return;
      }
      localStorage.setItem(selectDrawerPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

  function persistSelectDrawerState(opts) {
    opts = opts || {};
    var userId = getCurrentUserId();
    if (!userId) return;
    var projectId = opts.projectId !== undefined ? normalizeId(opts.projectId) : normalizeId(state.selectDrawer && state.selectDrawer.projectId);
    var versionId = opts.versionId !== undefined ? normalizeId(opts.versionId) : normalizeId(state.selectDrawer && state.selectDrawer.versionId);
    writeSelectDrawerPersistedState({
      user_id: userId,
      project_id: projectId || '',
      version_id: versionId || '',
      saved_at: Date.now(),
    });
  }

  function restoreSelectDrawerFromPersistedState() {
    if (!isAuthReady()) return Promise.resolve(false);
    var persisted = readSelectDrawerPersistedState();
    if (!persisted) return Promise.resolve(false);
    var userId = getCurrentUserId();
    if (!userId || String(persisted.user_id || '') !== String(userId)) return Promise.resolve(false);

    var projectId = normalizeId(persisted.project_id);
    var versionId = normalizeId(persisted.version_id);
    if (!projectId) return Promise.resolve(false);

    var hasProject = (state.projects || []).some(function(p) { return p && String(p.id) === String(projectId); });
    if (!hasProject) return Promise.resolve(false);

    state.selectDrawer.projectId = projectId;
    state.selectDrawer.versionId = null;
    state.selectDrawer.searchText = '';
    state.selectDrawer.files = [];
    state.selectDrawer.execByFileId = {};
    state.selectDrawer.processing = false;
    state.selectDrawer.selection = new Set();
    state.selectDrawer.pageIndex = 0;

    if (dom.selectProjectSelect) dom.selectProjectSelect.value = String(projectId);
    if (dom.selectVersionSelect) {
      dom.selectVersionSelect.disabled = true;
      dom.selectVersionSelect.innerHTML = '<option value=\"\">全部版本</option>';
      dom.selectVersionSelect.value = '';
    }
    if (dom.selectSearchInput) dom.selectSearchInput.value = '';

    state.selectDrawer.loading = true;
    state.selectDrawer.loadSeq = Number(state.selectDrawer.loadSeq || 0) + 1;
    var seq = state.selectDrawer.loadSeq;
    setStatus(dom.selectStatus, '加载用例库...', '');
    renderSelectDrawerList();

    return Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId), apiClient.listExecSetsByCaseFile(projectId)])
      .then(function(res) {
        if (seq !== state.selectDrawer.loadSeq) return false;
        var files = Array.isArray(res && res[0]) ? res[0] : [];
        var execSets = Array.isArray(res && res[2]) ? res[2] : [];
        state.selectDrawer.files = files;
        state.selectDrawer.execByFileId = buildExecMapByFileId(execSets);
        syncAssociationSwitchMapWithFiles(files);
        if (dom.selectVersionSelect) {
          syncVersionOptions(dom.selectVersionSelect, projectId, '全部版本');
          dom.selectVersionSelect.disabled = false;
          if (versionId) {
            var ok = (state.versionsByProject[projectId] || []).some(function(v) { return v && String(v.id) === String(versionId); });
            if (ok) {
              dom.selectVersionSelect.value = String(versionId);
              state.selectDrawer.versionId = versionId;
            } else {
              dom.selectVersionSelect.value = '';
              state.selectDrawer.versionId = null;
            }
          } else {
            dom.selectVersionSelect.value = '';
            state.selectDrawer.versionId = null;
          }
        }
        setStatus(dom.selectStatus, '已加载 ' + files.length + ' 份用例文件', files.length ? 'ok' : 'warn');
        persistSelectDrawerState({ projectId: projectId, versionId: state.selectDrawer.versionId || '' });
        renderSelectDrawerList();
        return true;
      })
      .catch(function() {
        return false;
      })
      .finally(function() {
        if (seq !== state.selectDrawer.loadSeq) return;
        state.selectDrawer.loading = false;
        renderSelectDrawerList();
      });
  }

  var editDrawerPersistKey = 'tap-case-library-edit-drawer';

  function readEditDrawerPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(editDrawerPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeEditDrawerPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(editDrawerPersistKey);
        return;
      }
      localStorage.setItem(editDrawerPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
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
    if (dom.editDrawerProjectSelect) dom.editDrawerProjectSelect.value = String(projectId);
    if (dom.editDrawerVersionSelect) {
      dom.editDrawerVersionSelect.disabled = true;
      dom.editDrawerVersionSelect.innerHTML = '<option value=\"\">全部版本</option>';
      dom.editDrawerVersionSelect.value = '';
    }
    syncEditDrawerOwnerFilterOptions();
    renderEditDrawerList();
    syncEditDrawerControls();

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
        state.editDrawer.files = files;
        state.editDrawer.execByFileId = buildExecMapByFileId(execSets);
        // 仅保留当前可见列表里的勾选，避免版本切换后隐藏项仍被导出。
        var visibleIds = {};
        getEditDrawerVisibleFiles().forEach(function(f) {
          if (!f || f.id === null || f.id === undefined) return;
          visibleIds[String(f.id)] = true;
        });
        var nextSel = new Set();
        (state.editDrawer.selection || new Set()).forEach(function(id) {
          if (visibleIds[String(id)]) nextSel.add(String(id));
        });
        state.editDrawer.selection = nextSel;
        renderEditDrawerList();
        syncEditDrawerControls();
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

  function mapExecCaseToImportPayload(row) {
    if (!row) return null;
    return {
      module: row.module || '',
      title: row.title || '',
      expected: row.expected || '',
      priority: row.priority || null,
      precondition: row.precondition || null,
      steps: row.steps || null,
      remark: row.remark || null,
      status: row.status || null,
      reuse_details: row.reuse_details || null,
      defect_links: row.defect_links || null,
    };
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

  function ensureShareDrawer() {
    if (shareDrawerInstance) return shareDrawerInstance;
    shareDrawerInstance = ensureDrawer(
      'caseLibraryShareDrawer',
      [],
      function() {
        resetShareDrawerControls();
        renderShareDrawerMeta();
        ensureShareProjectsReady()
          .then(function() {
            if (dom.shareDrawerProjectSelect) dom.shareDrawerProjectSelect.value = '';
          })
          .finally(function() {
            syncShareDrawerControls();
          });
      },
      function() {
        var prevDrawer = state.shareDrawer.previousDrawer;
        var shouldReopen = Boolean(
          state.shareDrawer.reopenPrevious &&
          prevDrawer &&
          prevDrawer.element &&
          prevDrawer.element.classList &&
          !prevDrawer.element.classList.contains('open')
        );
        clearShareDrawerState();
        if (shouldReopen && typeof prevDrawer.open === 'function') {
          prevDrawer.open();
        }
      }
    );
    return shareDrawerInstance;
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

  function syncShareProjectOptions(selectEl, placeholder) {
    if (!selectEl) return;
    var list = Array.isArray(state.shareDrawer.projects) ? state.shareDrawer.projects : [];
    if (utils && typeof utils.sortProjectsByUserSettings === 'function') {
      list = utils.sortProjectsByUserSettings(list);
    }
    var options = ['<option value=\"\">' + escapeHtml(placeholder || '请选择项目') + '</option>'];
    state.shareDrawer.projectNameById = {};
    list.forEach(function(p) {
      if (!p) return;
      state.shareDrawer.projectNameById[p.id] = p.name || ('项目#' + p.id);
      options.push('<option value=\"' + escapeHtml(p.id) + '\">' + escapeHtml(state.shareDrawer.projectNameById[p.id]) + '</option>');
    });
    selectEl.innerHTML = options.join('');
  }

  function syncShareVersionOptions(selectEl, projectId, placeholder) {
    if (!selectEl) return;
    var list = projectId && state.shareDrawer.versionsByProject[projectId] ? state.shareDrawer.versionsByProject[projectId] : [];
    var options = ['<option value=\"\">' + escapeHtml(placeholder || '请选择版本') + '</option>'];
    if (!state.shareDrawer.versionNameByProject[projectId]) state.shareDrawer.versionNameByProject[projectId] = {};
    (list || []).forEach(function(v) {
      if (!v) return;
      state.shareDrawer.versionNameByProject[projectId][v.id] = v.name || ('版本#' + v.id);
      options.push('<option value=\"' + escapeHtml(v.id) + '\">' + escapeHtml(state.shareDrawer.versionNameByProject[projectId][v.id]) + '</option>');
    });
    selectEl.innerHTML = options.join('');
  }

  function getShareVersionName(projectId, versionId) {
    if (!versionId) return '--';
    var map = projectId && state.shareDrawer.versionNameByProject[projectId] ? state.shareDrawer.versionNameByProject[projectId] : null;
    if (map && map[versionId]) return map[versionId];
    return '版本#' + versionId;
  }

  function loadShareProjects() {
    if (!apiClient || typeof apiClient.listProjects !== 'function') return Promise.resolve([]);
    return apiClient.listProjects({ scope: 'share' }).then(function(list) {
      var shareSelected = dom.shareDrawerProjectSelect ? String(dom.shareDrawerProjectSelect.value || '') : '';
      var projects = Array.isArray(list) ? list : [];
      if (utils && typeof utils.sortProjectsByUserSettings === 'function') {
        projects = utils.sortProjectsByUserSettings(projects);
      }
      state.shareDrawer.projects = projects;
      syncShareProjectOptions(dom.shareDrawerProjectSelect, '请选择项目');
      if (dom.shareDrawerProjectSelect && shareSelected) dom.shareDrawerProjectSelect.value = shareSelected;
      return projects;
    });
  }

  function loadShareVersions(projectId) {
    if (!projectId) return Promise.resolve([]);
    if (state.shareDrawer.versionsByProject[projectId]) return Promise.resolve(state.shareDrawer.versionsByProject[projectId]);
    return apiClient.listProjectVersions(projectId, { scope: 'share' }).then(function(list) {
      state.shareDrawer.versionsByProject[projectId] = Array.isArray(list) ? list : [];
      state.shareDrawer.versionNameByProject[projectId] = {};
      (state.shareDrawer.versionsByProject[projectId] || []).forEach(function(v) {
        if (!v) return;
        state.shareDrawer.versionNameByProject[projectId][v.id] = v.name || ('版本#' + v.id);
      });
      return state.shareDrawer.versionsByProject[projectId];
    });
  }

  function ensureShareProjectsReady() {
    if (state.shareDrawer.projects && state.shareDrawer.projects.length) {
      syncShareProjectOptions(dom.shareDrawerProjectSelect, '请选择项目');
      return Promise.resolve(state.shareDrawer.projects);
    }
    setStatus(dom.shareDrawerStatus, '加载项目中...', '');
    return loadShareProjects()
      .then(function(list) {
        setStatus(dom.shareDrawerStatus, '', '');
        return list;
      })
      .catch(function(err) {
        setStatus(dom.shareDrawerStatus, err && err.message ? err.message : '加载项目失败', 'err');
        return [];
      });
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
    state.shareDrawer.projects = [];
    state.shareDrawer.projectNameById = {};
    state.shareDrawer.versionsByProject = {};
    state.shareDrawer.versionNameByProject = {};
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

  function toLineText(val) {
    if (val === null || val === undefined) return '';
    if (Array.isArray(val)) return val.filter(Boolean).map(function(s) { return String(s); }).join('\n');
    return String(val);
  }

  function colLettersToIndex(letters) {
    var text = String(letters || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (!text) return -1;
    var sum = 0;
    for (var i = 0; i < text.length; i += 1) {
      var code = text.charCodeAt(i);
      if (code < 65 || code > 90) continue;
      sum = sum * 26 + (code - 64);
    }
    return sum - 1;
  }

  function parseXlsxSharedStrings(xmlText) {
    if (!xmlText) return [];
    var out = [];
    try {
      var parser = new DOMParser();
      var doc = parser.parseFromString(String(xmlText), 'application/xml');
      if (!doc || doc.getElementsByTagName('parsererror').length) return [];
      var sis = doc.getElementsByTagName('si');
      for (var i = 0; i < sis.length; i += 1) {
        var si = sis[i];
        if (!si) continue;
        // 兼容：Excel 可能用 <t> 或富文本 <r><t>。
        var ts = si.getElementsByTagName('t');
        if (!ts || !ts.length) {
          out.push('');
          continue;
        }
        var parts = [];
        for (var j = 0; j < ts.length; j += 1) {
          var t = ts[j];
          if (!t) continue;
          parts.push(t.textContent || '');
        }
        out.push(parts.join(''));
      }
    } catch (err) {
      return [];
    }
    return out;
  }

  function parseXlsxSheetToRows(xmlText, sharedStrings) {
    var rows = [];
    if (!xmlText) return rows;
    try {
      var parser = new DOMParser();
      var doc = parser.parseFromString(String(xmlText), 'application/xml');
      if (!doc || doc.getElementsByTagName('parsererror').length) return rows;
      var rowNodes = doc.getElementsByTagName('row');
      for (var i = 0; i < rowNodes.length; i += 1) {
        var row = rowNodes[i];
        if (!row) continue;
        var cells = row.getElementsByTagName('c');
        var map = {};
        var maxCol = -1;
        for (var j = 0; j < cells.length; j += 1) {
          var cell = cells[j];
          if (!cell) continue;
          var ref = cell.getAttribute('r') || '';
          var m = String(ref).match(/^([A-Za-z]+)/);
          if (!m) continue;
          var colIdx = colLettersToIndex(m[1]);
          if (colIdx < 0) continue;
          if (colIdx > maxCol) maxCol = colIdx;
          var t = (cell.getAttribute('t') || '').toLowerCase();
          var value = '';
          if (t === 'inlinestr') {
            var ts = cell.getElementsByTagName('t');
            var parts = [];
            for (var k = 0; k < ts.length; k += 1) {
              parts.push(ts[k] && ts[k].textContent ? ts[k].textContent : '');
            }
            value = parts.join('');
          } else if (t === 's') {
            var vNode = cell.getElementsByTagName('v')[0];
            var idx = vNode && vNode.textContent ? Number(String(vNode.textContent).trim()) : NaN;
            if (!isNaN(idx) && sharedStrings && sharedStrings.length && sharedStrings[idx] !== undefined) {
              value = sharedStrings[idx];
            } else {
              value = '';
            }
          } else {
            // number / general / 其它：优先 <v>，兜底 <t>
            var v = cell.getElementsByTagName('v')[0];
            if (v && v.textContent !== undefined && v.textContent !== null) value = v.textContent;
            else {
              var t2 = cell.getElementsByTagName('t')[0];
              value = t2 && t2.textContent ? t2.textContent : '';
            }
          }
          map[String(colIdx)] = value;
        }
        if (maxCol < 0) continue;
        var rowArr = [];
        for (var c = 0; c <= maxCol; c += 1) {
          rowArr[c] = map[String(c)] !== undefined ? map[String(c)] : '';
        }
        rows.push(rowArr);
      }
    } catch (err) {
      return rows;
    }
    return rows;
  }

  function parseXlsxFileToCaseRows(file) {
    var JSZipCtor = typeof JSZip !== 'undefined' ? JSZip : (window.JSZip ? window.JSZip : null);
    if (!JSZipCtor) return Promise.reject(new Error('缺少 JSZip 依赖，无法解析 Excel'));
    if (!file || typeof file.arrayBuffer !== 'function') return Promise.reject(new Error('Excel 文件不可用'));
    var zip = new JSZipCtor();
    return file.arrayBuffer().then(function(buf) {
      return zip.loadAsync(buf);
    }).then(function(z) {
      var shared = null;
      var sharedEntry = z.file('xl/sharedStrings.xml');
      var sharedPromise = sharedEntry ? sharedEntry.async('string').then(function(txt) {
        shared = parseXlsxSharedStrings(txt);
      }).catch(function() { shared = []; }) : Promise.resolve();

      return sharedPromise.then(function() {
        var sheetEntry = z.file('xl/worksheets/sheet1.xml');
        if (!sheetEntry) {
          var candidates = [];
          try {
            z.forEach(function(relPath) {
              if (!relPath) return;
              if (String(relPath).indexOf('xl/worksheets/') !== 0) return;
              if (String(relPath).slice(-4).toLowerCase() !== '.xml') return;
              candidates.push(String(relPath));
            });
          } catch (err) {
            candidates = [];
          }
          if (candidates.length) sheetEntry = z.file(candidates[0]);
        }
        if (!sheetEntry) throw new Error('Excel 解析失败：缺少工作表');
        return sheetEntry.async('string').then(function(sheetXml) {
          return parseXlsxSheetToRows(sheetXml, shared || []);
        });
      });
    });
  }

  function buildImportItemsFromXlsxRows(rows) {
    var list = Array.isArray(rows) ? rows : [];
    if (!list.length) return [];
    var headerRow = list[0] || [];
    var headerIndex = {};
    var headerMap = {
      '模块': 'module',
      '用例标题': 'title',
      '优先级': 'priority',
      '前提条件': 'preconditions',
      '操作步骤': 'steps',
      '预期结果': 'expected',
    };
    for (var i = 0; i < headerRow.length; i += 1) {
      var text = headerRow[i] !== undefined && headerRow[i] !== null ? String(headerRow[i]).trim() : '';
      if (!text) continue;
      if (headerMap[text]) headerIndex[headerMap[text]] = i;
    }
    var required = ['module', 'title', 'expected'];
    var hasHeader = Boolean(
      headerIndex.module !== undefined &&
      headerIndex.title !== undefined &&
      headerIndex.expected !== undefined
    );

    function pick(row, key, fallbackIndex) {
      if (!row) return '';
      var idx = hasHeader && headerIndex[key] !== undefined ? headerIndex[key] : fallbackIndex;
      var val = row[idx];
      return val === undefined || val === null ? '' : String(val);
    }

    var out = [];
    for (var r = 1; r < list.length; r += 1) {
      var row = list[r] || [];
      var module = pick(row, 'module', 0);
      var title = pick(row, 'title', 1);
      var priority = pick(row, 'priority', 2);
      var preconditions = pick(row, 'preconditions', 3);
      var steps = pick(row, 'steps', 4);
      var expected = pick(row, 'expected', 5);
      // 跳过空行
      var any = String(module || '') + String(title || '') + String(priority || '') + String(preconditions || '') + String(steps || '') + String(expected || '');
      if (!any.trim()) continue;
      out.push({
        module: module,
        title: title,
        priority: priority,
        preconditions: preconditions,
        steps: steps,
        expected: expected,
        _sourceLine: r + 1,
      });
    }
    return buildImportItems(out);
  }

  function deriveCaseListFromText(text) {
    var coreApi = getCore();
    if (coreApi && typeof coreApi.deriveCaseListFromText === 'function') {
      return coreApi.deriveCaseListFromText(text || '');
    }
    try {
      var parsed = JSON.parse((text || '').trim() || '[]');
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.cases)) return parsed.cases;
    } catch (err) {
      // ignore
    }
    return [];
  }

		  function buildImportItems(list) {
	    if (!Array.isArray(list)) return [];

	    function normalizeDashAsEmpty(text) {
	      var t = text === null || text === undefined ? '' : String(text);
	      t = t.trim();
	      return t === '-' ? '' : t;
	    }

	    return list
	      .map(function(item, idx) {
	        if (!item || typeof item !== 'object') return null;
	        var forceKeep = item._forceKeep === true;
	        var module = normalizeDashAsEmpty(item.module || item.module_name || item['模块'] || '');
	        var title = normalizeDashAsEmpty(item.title || item.case_title || item['用例标题'] || '');
	        var expected = normalizeDashAsEmpty(item.expected || item.result || item['预期结果'] || '');
	        var priority = normalizeDashAsEmpty(item.priority || item.level || item['优先级'] || '');
	        var precondition = normalizeDashAsEmpty(item.preconditions || item.precondition || item['前提条件'] || '');
	        var steps = normalizeDashAsEmpty(toLineText(item.steps || item.actions || item['操作步骤'] || ''));
	        var remark = normalizeDashAsEmpty(item.remark || '');
	        var any = String(module || '') + String(title || '') + String(priority || '') + String(precondition || '') + String(steps || '') + String(expected || '') + String(remark || '');
	        if (!any.trim() && !forceKeep) return null;
          var sourceLine = item._sourceLine;
          if (!isFinite(Number(sourceLine)) || Number(sourceLine) <= 0) sourceLine = idx + 1;
	        return {
	          module: module,
	          title: title,
	          expected: expected,
	          priority: priority || '',
	          precondition: precondition || '',
	          steps: steps || '',
	          remark: remark || null,
	          _sourceLine: sourceLine,
	        };
	      })
		      .filter(Boolean);
		  }

	  function normalizePriorityInput(value) {
	    var text = value === null || value === undefined ? '' : String(value);
	    text = text.trim();
	    if (!text) return '';
	    var head = text.charAt(0);
	    if (head === 'p' || head === 'P') return 'P' + text.slice(1);
	    return text;
	  }

	  function sanitizeImportItemsForApi(items) {
	    var list = Array.isArray(items) ? items : [];
	    return list
	      .map(function(it) {
	        if (!it) return null;
	        return {
	          module: String(it.module || '').trim(),
	          title: String(it.title || '').trim(),
	          expected: String(it.expected || '').trim(),
	          priority: it.priority === null || it.priority === undefined ? null : String(it.priority || '').trim(),
	          precondition: it.precondition === null || it.precondition === undefined ? null : String(it.precondition || '').trim(),
	          steps: it.steps === null || it.steps === undefined ? null : String(it.steps || '').trim(),
	          remark: it.remark === null || it.remark === undefined ? null : String(it.remark || '').trim(),
	        };
	      })
	      .filter(Boolean);
	  }

	  function validateImportItems(items) {
	    var list = Array.isArray(items) ? items : [];
	    var invalid = [];
	    list.forEach(function(it, idx) {
	      if (!it) return;
	      it.module = String(it.module === null || it.module === undefined ? '' : it.module).trim();
	      it.title = String(it.title === null || it.title === undefined ? '' : it.title).trim();
	      it.expected = String(it.expected === null || it.expected === undefined ? '' : it.expected).trim();
	      it.priority = normalizePriorityInput(it.priority);
	      it.precondition = String(it.precondition === null || it.precondition === undefined ? '' : it.precondition).trim();
	      it.steps = String(it.steps === null || it.steps === undefined ? '' : it.steps).trim();

	      var err = {
	        module: !it.module,
	        title: !it.title,
	        priority: !it.priority,
	        precondition: !it.precondition,
	        steps: !it.steps,
	        expected: !it.expected,
	      };
	      if (err.module || err.title || err.priority || err.precondition || err.steps || err.expected) {
	        var lineNo = it && it._sourceLine ? Number(it._sourceLine) : (idx + 1);
	        if (!isFinite(lineNo) || lineNo <= 0) lineNo = idx + 1;
	        invalid.push({ index: idx, line: lineNo, err: err });
	      }
	    });
	    return invalid;
	  }

	  function normalizeXmindPathSegments(pathArr, rootTitle) {
	    if (!Array.isArray(pathArr)) return [];
	    // 保留空字符串：XMind 中“节点存在但标题为空”应作为字段内容为空处理，不应被当作层级缺失。
	    var clean = pathArr
	      .filter(function(s) { return s !== null && s !== undefined; })
	      .map(function(s) { return String(s).trim(); });
	    if (!clean.length) return [];
	    var rt = rootTitle === null || rootTitle === undefined ? '' : String(rootTitle).trim();
	    if (rt && clean[0] === rt) clean = clean.slice(1);
	    return clean;
	  }

	  function buildImportItemsFromXmindPaths(paths, rootTitle) {
	    var list = Array.isArray(paths) ? paths : [];
	    var structuralErrors = [];
	    var raw = [];

	    function mapSegmentsToItem(segs, lineNo, forceKeep) {
	      var tail = segs.slice(-6);
	      var item = {
	        module: tail[0] || '',
	        title: tail[1] || '',
	        priority: tail[2] || '',
	        precondition: tail[3] || '',
	        steps: tail[4] || '',
	        expected: tail[5] || '',
	        _sourceLine: lineNo,
	      };
	      if (forceKeep) item._forceKeep = true;
	      return item;
	    }

	    list.forEach(function(pathArr, idx) {
	      var segs = normalizeXmindPathSegments(pathArr, rootTitle);
	      var lineNo = idx + 1;
      if (segs.length < 6) {
        raw.push(mapSegmentsToItem(segs, lineNo, true));
        structuralErrors.push({ line: lineNo, depth: segs.length, segments: segs.slice() });
        return;
      }
	      raw.push(mapSegmentsToItem(segs, lineNo, false));
	    });

	    return { items: buildImportItems(raw), structuralErrors: structuralErrors };
	  }

  function parseImportFile(file) {
    if (!file) return Promise.resolve({ items: [] });
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    var coreApi = getCore();
    if (ext === 'xmind' && coreApi && typeof coreApi.parseXmindFile === 'function') {
      return coreApi.parseXmindFile(file).then(function(res) {
        var paths = res && Array.isArray(res.paths) ? res.paths : [];
        var rootTitle = res && res.rootTitle ? String(res.rootTitle) : '';
        var mapped = buildImportItemsFromXmindPaths(paths, rootTitle);
        return { items: mapped.items, structuralErrors: mapped.structuralErrors };
      });
    }
    if (ext === 'xlsx') {
      return parseXlsxFileToCaseRows(file).then(function(rows) {
        return { items: buildImportItemsFromXlsxRows(rows || []) };
      });
    }
    return file.text().then(function(text) {
      var trimmed = (text || '').trim();
      var list = [];
      if (ext === 'json') {
        try {
          var parsed = JSON.parse(trimmed || '[]');
          if (Array.isArray(parsed)) list = parsed;
          else if (parsed && Array.isArray(parsed.cases)) list = parsed.cases;
          else list = deriveCaseListFromText(trimmed);
        } catch (err) {
          list = deriveCaseListFromText(trimmed);
        }
      } else {
        list = deriveCaseListFromText(trimmed);
      }
      return { items: buildImportItems(list) };
    });
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

  function syncMissingImportConfirmEnabled() {
    if (!dom.missingImportConfirmBtn) return;
    var s = state.missingImport;
    var hasFiles = s.files && s.files.length;
    var hasItems = s.items && s.items.length;
    var invalid = s.invalid && s.invalid.length;
    var hasStructural = s.structuralErrors && s.structuralErrors.length;
    dom.missingImportConfirmBtn.disabled = !hasFiles || (!hasItems && !hasStructural) || !s.projectId || s.loading || s.pending || invalid;
  }

  function renderMissingImportFileHint() {
    if (!dom.missingImportFileHint) return;
    var files = state.missingImport.files || [];
    if (!files.length) {
      dom.missingImportFileHint.textContent = '未选择文件';
      return;
    }
    var names = files.map(function(f) { return f && f.name ? f.name : '文件'; });
    var head = names.slice(0, 2).join('、');
    dom.missingImportFileHint.textContent = names.length > 2 ? ('已选择 ' + names.length + ' 个：' + head + '...') : ('已选择：' + head);
  }

  function resetMissingImportState() {
    state.missingImport.projectId = null;
    state.missingImport.files = [];
    state.missingImport.items = [];
    state.missingImport.structuralErrors = [];
    state.missingImport.loading = false;
    state.missingImport.pending = false;
    state.missingImport.invalid = [];
    setStatus(dom.missingImportStatus, '', '');
    renderMissingImportFileHint();
    syncProjectOptions(dom.missingImportProjectSelect, '请选择项目');
    if (dom.missingImportProjectSelect) dom.missingImportProjectSelect.value = '';
    syncMissingImportConfirmEnabled();
  }

  function normalizeMissingImportText(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function normalizeMissingImportItem(item) {
    if (!item) return null;
    var module = normalizeMissingImportText(item.module || '');
    var title = normalizeMissingImportText(item.title || '');
    var expected = normalizeMissingImportText(item.expected || '');
    var priority = normalizePriorityInput(item.priority || '');
    var precondition = normalizeMissingImportText(item.precondition || item.preconditions || '');
    var steps = normalizeMissingImportText(item.steps || '');
    var remark = item.remark === null || item.remark === undefined ? null : normalizeMissingImportText(item.remark || '');
    return {
      module: module,
      title: title,
      expected: expected,
      priority: priority,
      precondition: precondition,
      steps: steps,
      remark: remark,
    };
  }

  function validateMissingImportHeaderRow(row) {
    var header = Array.isArray(row) ? row : [];
    var required = ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果'];
    var found = {};
    header.forEach(function(cell) {
      var text = normalizeMissingImportText(cell);
      if (!text) return;
      found[text] = true;
    });
    var missing = required.filter(function(key) { return !found[key]; });
    return { ok: missing.length === 0, missing: missing };
  }

  function parseMissingImportFile(file) {
    if (!file) return Promise.resolve({ items: [], structuralErrors: [], error: '文件不可用' });
    var name = file.name ? String(file.name) : '';
    var ext = (name.split('.').pop() || '').toLowerCase();
    if (ext !== 'xmind' && ext !== 'xlsx') {
      return Promise.resolve({ items: [], structuralErrors: [], error: '仅支持导入 .xmind 或 .xlsx 文件' });
    }
    var coreApi = getCore();
    if (ext === 'xmind') {
      if (!coreApi || typeof coreApi.parseXmindFile !== 'function') {
        return Promise.resolve({ items: [], structuralErrors: [], error: '缺少 XMind 解析能力' });
      }
      return coreApi.parseXmindFile(file).then(function(res) {
        var paths = res && Array.isArray(res.paths) ? res.paths : [];
        var rootTitle = res && res.rootTitle ? String(res.rootTitle) : '';
        var mapped = buildImportItemsFromXmindPaths(paths, rootTitle);
        return { items: mapped.items, structuralErrors: mapped.structuralErrors };
      });
    }
    return parseXlsxFileToCaseRows(file).then(function(rows) {
      if (!rows || !rows.length) {
        return { items: [], structuralErrors: [], error: 'Excel 解析失败：未找到数据' };
      }
      var headerCheck = validateMissingImportHeaderRow(rows[0]);
      if (!headerCheck.ok) {
        return { items: [], structuralErrors: [], error: 'Excel 表头与漏测用例导出格式不一致' };
      }
      return { items: buildImportItemsFromXlsxRows(rows || []) };
    });
  }

  function validateMissingImportItems(items) {
    var list = Array.isArray(items) ? items : [];
    var invalid = [];
    list.forEach(function(it, idx) {
      if (!it) return;
      var module = normalizeMissingImportText(it.module || '');
      var title = normalizeMissingImportText(it.title || '');
      var expected = normalizeMissingImportText(it.expected || '');
      if (!module || !title || !expected) {
        invalid.push({
          index: idx,
          module: !module,
          title: !title,
          expected: !expected,
        });
      }
    });
    return invalid;
  }

  function handleMissingImportFiles(files) {
    var list = Array.from(files || []).filter(Boolean);
    if (!list.length) {
      state.missingImport.files = [];
      state.missingImport.items = [];
      state.missingImport.structuralErrors = [];
      state.missingImport.invalid = [];
      renderMissingImportFileHint();
      syncMissingImportConfirmEnabled();
      setStatus(dom.missingImportStatus, '', '');
      return;
    }
    state.missingImport.files = list;
    state.missingImport.items = [];
    state.missingImport.structuralErrors = [];
    state.missingImport.invalid = [];
    state.missingImport.loading = true;
    renderMissingImportFileHint();
    syncMissingImportConfirmEnabled();
    setStatus(dom.missingImportStatus, '解析导入文件中...', '');

    var tasks = list.map(function(f) {
      return parseMissingImportFile(f).then(
        function(res) {
          return { file: f, result: res || {} };
        },
        function(err) {
          return { file: f, result: { items: [], structuralErrors: [], error: err && err.message ? err.message : '解析失败' } };
        }
      );
    });

    Promise.all(tasks).then(function(results) {
      var items = [];
      var structuralErrors = [];
      var errorMsg = '';
      results.forEach(function(entry) {
        var result = entry && entry.result ? entry.result : {};
        if (result.error) {
          if (!errorMsg) {
            var fname = entry && entry.file && entry.file.name ? String(entry.file.name) : '';
            errorMsg = fname ? ('导入失败：' + fname + ' - ' + result.error) : ('导入失败：' + result.error);
          }
          return;
        }
        if (Array.isArray(result.structuralErrors) && result.structuralErrors.length) {
          structuralErrors = structuralErrors.concat(result.structuralErrors);
        }
        if (Array.isArray(result.items) && result.items.length) {
          items = items.concat(result.items);
        }
      });

      if (errorMsg) {
        state.missingImport.items = [];
        state.missingImport.structuralErrors = [];
        state.missingImport.invalid = [];
        setStatus(dom.missingImportStatus, errorMsg, 'err');
        return;
      }

      state.missingImport.structuralErrors = structuralErrors;

      var structuralLineMap = {};
      if (structuralErrors.length) {
        structuralErrors.forEach(function(entry) {
          var line = entry && typeof entry.line === 'number' ? entry.line : null;
          if (line && isFinite(line)) structuralLineMap[line] = true;
        });
      }
      var filteredItems = structuralErrors.length
        ? items.filter(function(it) {
          var line = it && it._sourceLine ? Number(it._sourceLine) : null;
          if (!line || !isFinite(line)) return true;
          return !structuralLineMap[line];
        })
        : items;

      var normalized = dedupeCaseItemsByKey(filteredItems.map(normalizeMissingImportItem).filter(Boolean));
      if (!normalized.length) {
        if (structuralErrors.length) {
          setStatus(dom.missingImportStatus, '导入失败：字段层级不足 ' + structuralErrors.length + ' 条，未识别到可导入条目', 'err');
        } else {
          setStatus(dom.missingImportStatus, '导入失败：未识别到漏测用例条目', 'warn');
        }
        state.missingImport.items = [];
        state.missingImport.invalid = [];
        return;
      }
      var invalid = validateMissingImportItems(normalized);
      state.missingImport.items = normalized;
      state.missingImport.invalid = invalid;
      if (invalid.length) {
        var invalidMsg = '导入校验失败：请补齐模块/用例标题/预期结果（缺失 ' + invalid.length + ' 条）';
        if (structuralErrors.length) invalidMsg += '，字段层级不足 ' + structuralErrors.length + ' 条';
        setStatus(dom.missingImportStatus, invalidMsg, 'warn');
        return;
      }
      if (structuralErrors.length) {
        setStatus(dom.missingImportStatus, '已识别 ' + normalized.length + ' 条漏测用例，字段层级不足 ' + structuralErrors.length + ' 条', 'warn');
        return;
      }
      setStatus(dom.missingImportStatus, '已识别 ' + normalized.length + ' 条漏测用例', 'ok');
    }).catch(function(err) {
      state.missingImport.items = [];
      state.missingImport.structuralErrors = [];
      state.missingImport.invalid = [];
      setStatus(dom.missingImportStatus, err && err.message ? err.message : '导入解析失败', 'err');
    }).finally(function() {
      state.missingImport.loading = false;
      syncMissingImportConfirmEnabled();
    });
  }

  function handleMissingImportProjectChange() {
    var projectId = normalizeId(dom.missingImportProjectSelect ? dom.missingImportProjectSelect.value : '');
    state.missingImport.projectId = projectId;
    syncMissingImportConfirmEnabled();
    if (dom.missingDrawerProjectSelect) {
      var current = String(dom.missingDrawerProjectSelect.value || '');
      if (projectId && current !== String(projectId)) {
        dom.missingDrawerProjectSelect.value = String(projectId || '');
        handleMissingProjectChange();
      }
    }
  }

  function normalizeMissingModuleKey(name) {
    return normalizeDiffText(name || '').toLowerCase();
  }

  function buildMissingImportGroups(items) {
    var list = Array.isArray(items) ? items : [];
    var map = {};
    list.forEach(function(it) {
      if (!it) return;
      var moduleName = normalizeMissingImportText(it.module || '');
      if (!moduleName) return;
      var key = normalizeMissingModuleKey(moduleName);
      if (!map[key]) map[key] = { key: key, moduleName: moduleName, items: [] };
      map[key].items.push(it);
    });
    return Object.keys(map).map(function(k) { return map[k]; });
  }

  function buildExistingMissingItemKeySet(items) {
    var seen = {};
    (items || []).forEach(function(it) {
      var key = buildCaseItemKey(it);
      if (!key) return;
      seen[key] = true;
    });
    return seen;
  }

  function formatMissingImportStructuralDetail(entry) {
    var fields = ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果'];
    var depth = entry && typeof entry.depth === 'number' ? entry.depth : null;
    var segs = entry && Array.isArray(entry.segments) ? entry.segments : [];
    var parts = [];
    for (var i = 0; i < segs.length && i < fields.length; i += 1) {
      var raw = segs[i];
      var text = raw === null || raw === undefined || String(raw).trim() === '' ? '（空）' : String(raw).trim();
      parts.push(fields[i] + '=' + text);
    }
    var missing = fields.slice(segs.length).join('、');
    var info = parts.length ? ('已识别：' + parts.join(' / ')) : '未识别到有效层级';
    var depthText = depth === null ? '' : ('当前 ' + depth + ' 层');
    var missingText = missing ? ('缺少：' + missing) : '';
    var prefix = '字段层级不足';
    return [prefix, depthText, info, missingText].filter(Boolean).join('；') || prefix;
  }

  function renderMissingImportStructureTable(errors) {
    if (!dom.missingImportStructureBody || !dom.missingImportStructureWrap) return;
    var list = Array.isArray(errors) ? errors.slice() : [];
    if (!list.length) {
      dom.missingImportStructureWrap.classList.add('hidden');
      dom.missingImportStructureBody.innerHTML = '<tr><td colspan="3"><p class="hint">暂无数据</p></td></tr>';
      return;
    }
    list.sort(function(a, b) {
      var la = a && typeof a.line === 'number' ? a.line : 0;
      var lb = b && typeof b.line === 'number' ? b.line : 0;
      return la - lb;
    });
    dom.missingImportStructureWrap.classList.remove('hidden');
    dom.missingImportStructureBody.innerHTML = list.map(function(entry) {
      var lineNo = entry && typeof entry.line === 'number' ? entry.line : null;
      var depth = entry && typeof entry.depth === 'number' ? entry.depth : null;
      var detail = formatMissingImportStructuralDetail(entry);
      return (
        '<tr>' +
          '<td>' + escapeHtml(lineNo === null ? '-' : String(lineNo)) + '</td>' +
          '<td>' + escapeHtml(depth === null ? '-' : String(depth)) + '</td>' +
          '<td>' + escapeHtml(detail) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function countMissingImportPendingItems(entries) {
    var total = 0;
    (entries || []).forEach(function(entry) {
      if (!entry || !entry.items) return;
      total += entry.items.length || 0;
    });
    return total;
  }

  function syncMissingImportDiffConfirmEnabled() {
    if (!dom.missingImportDiffConfirmBtn) return;
    var entries = state.missingImportDiff && state.missingImportDiff.pendingItemsByModule
      ? state.missingImportDiff.pendingItemsByModule
      : [];
    dom.missingImportDiffConfirmBtn.disabled = countMissingImportPendingItems(entries) <= 0;
  }

  function renderMissingImportDiffTable(rows) {
    if (!dom.missingImportDiffBody) return;
    var list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      dom.missingImportDiffBody.innerHTML = '<tr><td colspan=\"6\"><p class=\"hint\">暂无数据</p></td></tr>';
      return;
    }
    dom.missingImportDiffBody.innerHTML = list.map(function(row) {
      var item = row && row.left ? row.left : (row && row.right ? row.right : null);
      var status = '已存在';
      var badge = 'diff-badge';
      if (row && row.type === 'added') {
        status = '新增';
        badge = 'diff-badge diff-badge-added';
      } else if (row && row.type === 'changed') {
        status = '已存在（优先级差异）';
        badge = 'diff-badge diff-badge-changed';
      }
      return (
        '<tr>' +
          '<td><span class=\"' + escapeHtml(badge) + '\">' + escapeHtml(status) + '</span></td>' +
          '<td>' + escapeHtml(item && (item.module || item.module_name) ? (item.module || item.module_name) : '') + '</td>' +
          '<td>' + escapeHtml(item && item.title ? item.title : '') + '</td>' +
          '<td>' + escapeHtml(item && item.precondition ? item.precondition : '') + '</td>' +
          '<td>' + escapeHtml(item && item.steps ? item.steps : '') + '</td>' +
          '<td>' + escapeHtml(item && item.expected ? item.expected : '') + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  var missingImportDiffDrawerInstance = null;

  function ensureMissingImportDiffDrawer() {
    if (missingImportDiffDrawerInstance) return missingImportDiffDrawerInstance;
    missingImportDiffDrawerInstance = ensureDrawer(
      'caseLibraryMissingImportDiffDrawer',
      [],
      null,
      function() {
        state.missingImport.pending = false;
        state.missingImportDiff.projectId = null;
        state.missingImportDiff.rows = [];
        state.missingImportDiff.newItems = [];
        state.missingImportDiff.duplicateCount = 0;
        state.missingImportDiff.pendingItemsByModule = [];
        state.missingImportDiff.structuralErrors = [];
        setStatus(dom.missingImportDiffStatus, '', '');
        if (dom.missingImportDiffMeta) dom.missingImportDiffMeta.textContent = '';
        renderMissingImportStructureTable([]);
        renderMissingImportDiffTable([]);
        syncMissingImportDiffConfirmEnabled();
        syncMissingImportConfirmEnabled();
      }
    );
    return missingImportDiffDrawerInstance;
  }

  function openMissingImportDiffDrawer(payload) {
    var drawer = ensureMissingImportDiffDrawer();
    if (!drawer) return;
    state.missingImportDiff.projectId = payload.projectId || null;
    state.missingImportDiff.rows = payload.rows || [];
    state.missingImportDiff.newItems = payload.newItems || [];
    state.missingImportDiff.duplicateCount = payload.duplicateCount || 0;
    state.missingImportDiff.pendingItemsByModule = payload.pendingItemsByModule || [];
    state.missingImportDiff.structuralErrors = Array.isArray(payload.structuralErrors) ? payload.structuralErrors : [];
    if (dom.missingImportDiffStatus) {
      var structuralCount = state.missingImportDiff.structuralErrors.length;
      var statusText = '新增条目 ' + (payload.newCount || 0) + ' 条，重复跳过 ' + (payload.duplicateCount || 0) + ' 条。';
      if (structuralCount) statusText += ' 字段层级不足 ' + structuralCount + ' 条。';
      var statusType = payload.newCount ? 'ok' : 'warn';
      if (structuralCount) statusType = 'warn';
      setStatus(dom.missingImportDiffStatus, statusText, statusType);
    }
    if (dom.missingImportDiffMeta) {
      var metaText = '同名模块 ' + (payload.overlapModules || 0) + ' 个，导入条目 ' + (payload.importCount || 0) + ' 条。';
      if (state.missingImportDiff.structuralErrors.length) {
        metaText += ' 字段层级不足 ' + state.missingImportDiff.structuralErrors.length + ' 条。';
      }
      dom.missingImportDiffMeta.textContent = metaText;
    }
    renderMissingImportStructureTable(state.missingImportDiff.structuralErrors);
    renderMissingImportDiffTable(state.missingImportDiff.rows);
    syncMissingImportDiffConfirmEnabled();
    if (typeof drawer.open === 'function') drawer.open();
  }

  function createMissingModuleItems(moduleId, items) {
    var list = Array.isArray(items) ? items.slice() : [];
    if (!list.length) return Promise.resolve([]);
    if (!apiClient || typeof apiClient.createMissingModuleItem !== 'function') {
      return Promise.reject(new Error('易漏条目接口未就绪'));
    }
    return list.reduce(function(chain, item) {
      return chain.then(function() {
        var payload = {
          title: item.title || '',
          priority: item.priority || null,
          precondition: item.precondition || '',
          steps: item.steps || '',
          expected: item.expected || '',
          remark: item.remark || null,
        };
        return apiClient.createMissingModuleItem(moduleId, payload);
      });
    }, Promise.resolve([]));
  }

  function executeMissingImportMerge(payload) {
    if (!payload || !payload.pendingItemsByModule) return Promise.resolve(false);
    var projectId = payload.projectId;
    var entries = payload.pendingItemsByModule;
    var totalNewModules = 0;
    var totalNewItems = 0;
    var skippedItems = payload.duplicateCount || 0;
    if (dom.missingImportStatus) setStatus(dom.missingImportStatus, '合并处理中...', '');

    function settle(p) {
      return Promise.resolve(p).then(
        function(v) { return { status: 'fulfilled', value: v }; },
        function(err) { return { status: 'rejected', reason: err }; }
      );
    }

    var chain = Promise.resolve();
    entries.forEach(function(entry) {
      var items = Array.isArray(entry.items) ? entry.items : [];
      if (!items.length) return;
      chain = chain.then(function() {
        if (entry.isNewModule) {
          if (!apiClient || typeof apiClient.createMissingModule !== 'function') {
            throw new Error('易漏模块接口未就绪');
          }
          return apiClient.createMissingModule({ project_id: projectId, name: entry.moduleName }).then(function(module) {
            var mid = module && module.id ? module.id : null;
            if (!mid) throw new Error('新模块创建失败');
            entry.moduleId = mid;
            totalNewModules += 1;
            return createMissingModuleItems(mid, items).then(function() {
              totalNewItems += items.length;
              return module;
            });
          });
        }
        var moduleId = entry.moduleId;
        if (!moduleId) return null;
        return createMissingModuleItems(moduleId, items).then(function() {
          totalNewItems += items.length;
          return null;
        });
      });
    });

    return settle(chain).then(function(result) {
      if (!result || result.status !== 'fulfilled') {
        var err = result && result.reason ? result.reason : null;
        throw err || new Error('合并失败');
      }
      if (dom.missingImportStatus) {
        var msg = '合并完成：新增模块 ' + totalNewModules + ' 个，新增条目 ' + totalNewItems + ' 条';
        if (skippedItems) msg += '，重复跳过 ' + skippedItems + ' 条';
        setStatus(dom.missingImportStatus, msg, totalNewItems ? 'ok' : 'warn');
      }
      state.missingImport.files = [];
      state.missingImport.items = [];
      state.missingImport.invalid = [];
      renderMissingImportFileHint();
      syncMissingImportConfirmEnabled();
      if (state.missingDrawer.projectId && String(state.missingDrawer.projectId || '') === String(projectId || '')) {
        loadMissingDrawerModules(projectId);
      }
      return true;
    }).catch(function(err) {
      setStatus(dom.missingImportStatus, err && err.message ? err.message : '合并失败', 'err');
      return false;
    }).finally(function() {
      state.missingImport.pending = false;
      syncMissingImportConfirmEnabled();
    });
  }

  function confirmMissingImportToDb() {
    if (state.missingImport.loading || state.missingImport.pending) return;
    if (!apiClient || typeof apiClient.listMissingModules !== 'function') {
      setStatus(dom.missingImportStatus, '易漏模块接口未就绪', 'err');
      return;
    }
    var projectId = state.missingImport.projectId || normalizeId(dom.missingImportProjectSelect ? dom.missingImportProjectSelect.value : '');
    state.missingImport.projectId = projectId;
    if (!projectId) {
      setStatus(dom.missingImportStatus, '请先选择项目', 'warn');
      return;
    }
    var items = Array.isArray(state.missingImport.items) ? state.missingImport.items : [];
    var structuralErrors = Array.isArray(state.missingImport.structuralErrors) ? state.missingImport.structuralErrors : [];
    if (!items.length) {
      if (structuralErrors.length) {
        state.missingImport.pending = true;
        syncMissingImportConfirmEnabled();
        openMissingImportDiffDrawer({
          projectId: projectId,
          rows: [],
          newItems: [],
          duplicateCount: 0,
          pendingItemsByModule: [],
          newCount: 0,
          importCount: 0,
          overlapModules: 0,
          structuralErrors: structuralErrors,
        });
        return;
      }
      setStatus(dom.missingImportStatus, '请先选择漏测用例文件', 'warn');
      return;
    }
    if (state.missingImport.invalid && state.missingImport.invalid.length) {
      setStatus(dom.missingImportStatus, '导入校验失败：请补齐必填字段', 'warn');
      return;
    }

    state.missingImport.pending = true;
    syncMissingImportConfirmEnabled();
    setStatus(dom.missingImportStatus, '校验同名模块中...', '');

    var groups = buildMissingImportGroups(items);
    apiClient
      .listMissingModules(projectId)
      .then(function(list) {
        var modules = Array.isArray(list) ? list : [];
        var moduleIndex = {};
        modules.forEach(function(m) {
          if (!m || !m.name) return;
          var key = normalizeMissingModuleKey(m.name);
          if (!moduleIndex[key]) moduleIndex[key] = m;
        });

        var overlapGroups = [];
        var newGroups = [];
        groups.forEach(function(g) {
          var existing = moduleIndex[g.key] || null;
          if (existing) overlapGroups.push({ group: g, module: existing });
          else newGroups.push(g);
        });

        if (!overlapGroups.length) {
          var pendingNew = newGroups.map(function(g) {
            return { moduleId: null, moduleName: g.moduleName, items: g.items, isNewModule: true };
          });
          if (structuralErrors.length) {
            openMissingImportDiffDrawer({
              projectId: projectId,
              rows: [],
              newItems: [],
              duplicateCount: 0,
              pendingItemsByModule: pendingNew,
              newCount: countMissingImportPendingItems(pendingNew),
              importCount: countMissingImportPendingItems(pendingNew),
              overlapModules: 0,
              structuralErrors: structuralErrors,
            });
            return null;
          }
          return executeMissingImportMerge({
            projectId: projectId,
            pendingItemsByModule: pendingNew,
            duplicateCount: 0,
          });
        }

        var loadTasks = overlapGroups.map(function(entry) {
          return apiClient.listMissingModuleItems(entry.module.id).then(function(itemsRes) {
            return { entry: entry, items: Array.isArray(itemsRes) ? itemsRes : [] };
          });
        });

        return Promise.all(loadTasks).then(function(existingLists) {
          var pending = [];
          var overlapImportItems = [];
          var overlapExistingItems = [];
          var duplicateCount = 0;
          var newCount = 0;
          var importCount = 0;

          existingLists.forEach(function(row) {
            var group = row.entry.group;
            var module = row.entry.module;
            var existingItems = Array.isArray(row.items) ? row.items : [];
            var existingKeySet = buildExistingMissingItemKeySet(existingItems);
            var addItems = [];
            (group.items || []).forEach(function(it) {
              var key = buildCaseItemKey(it);
              if (key && existingKeySet[key]) {
                duplicateCount += 1;
                return;
              }
              addItems.push(it);
            });
            importCount += (group.items || []).length;
            newCount += addItems.length;
            pending.push({
              moduleId: module.id,
              moduleName: module.name || group.moduleName,
              items: addItems,
              isNewModule: false,
            });
            overlapImportItems = overlapImportItems.concat(group.items || []);
            overlapExistingItems = overlapExistingItems.concat(existingItems || []);
          });

          newGroups.forEach(function(g) {
            importCount += (g.items || []).length;
            newCount += (g.items || []).length;
            pending.push({
              moduleId: null,
              moduleName: g.moduleName,
              items: g.items,
              isNewModule: true,
            });
          });

          var rows = buildImportDiffRows(overlapImportItems, overlapExistingItems);
          openMissingImportDiffDrawer({
            projectId: projectId,
            rows: rows,
            newItems: overlapImportItems,
            duplicateCount: duplicateCount,
            pendingItemsByModule: pending,
            newCount: newCount,
            importCount: importCount,
            overlapModules: overlapGroups.length,
            structuralErrors: structuralErrors,
          });
          return null;
        });
      })
      .catch(function(err) {
        state.missingImport.pending = false;
        syncMissingImportConfirmEnabled();
        setStatus(dom.missingImportStatus, err && err.message ? err.message : '导入失败', 'err');
      });
  }

  var importDuplicateDrawerInstance = null;
  var importDuplicateResolve = null;
  var importDuplicateResolved = false;
  var importDuplicateConfirmBound = false;

  function renderImportDuplicateDrawer(payload) {
    var titleEl = dom.importDuplicateTitle;
    var statusEl = dom.importDuplicateStatus;
    var bodyEl = dom.importDuplicateBody;
    var confirmBtn = dom.importDuplicateConfirmBtn;

    var fileName = payload && payload.fileName ? String(payload.fileName) : '用例';
    var total = payload && Number.isFinite(Number(payload.total)) ? Number(payload.total) : 0;
    var uniqueCount = payload && Number.isFinite(Number(payload.uniqueCount)) ? Number(payload.uniqueCount) : 0;
    var duplicateCount = payload && Number.isFinite(Number(payload.duplicateCount)) ? Number(payload.duplicateCount) : 0;
    var rows = payload && Array.isArray(payload.rows) ? payload.rows : [];

    if (titleEl) titleEl.textContent = '导入用例重复校验：' + cleanCaseFileName(fileName);
    if (statusEl) {
      setStatus(statusEl, '检测到重复条目 ' + duplicateCount + ' 条（模块/用例描述/前提条件/操作步骤/预期结果均相同），将自动去重：原 ' + total + ' 条 → 去重后 ' + uniqueCount + ' 条。', 'warn');
    }
    if (confirmBtn) confirmBtn.disabled = !duplicateCount;

    if (!bodyEl) return;
    if (!rows.length) {
      bodyEl.innerHTML = '<tr><td colspan="9"><p class="hint">暂无重复条目</p></td></tr>';
      return;
    }
    bodyEl.innerHTML = rows.map(function(entry) {
      var item = entry && entry.item ? entry.item : null;
      var line = entry && Number.isFinite(Number(entry.line)) ? Number(entry.line) : 0;
      var keep = entry && entry.keep ? true : false;
      var action = keep ? '保留' : '移除';

      function toHtml(val) {
        var text = val === null || val === undefined ? '' : String(val);
        return escapeHtml(text).replace(/\n/g, '<br>');
      }

      return (
        '<tr>' +
          '<td>' + (line ? String(line) : '-') + '</td>' +
          '<td>' + toHtml(item && item.module ? item.module : '') + '</td>' +
          '<td>' + toHtml(item && item.title ? item.title : '') + '</td>' +
          '<td>' + toHtml(item && item.priority ? item.priority : '') + '</td>' +
          '<td>' + toHtml(item && item.precondition ? item.precondition : '') + '</td>' +
          '<td>' + toHtml(item && item.steps ? item.steps : '') + '</td>' +
          '<td>' + toHtml(item && item.expected ? item.expected : '') + '</td>' +
          '<td>' + toHtml(item && item.remark ? item.remark : '') + '</td>' +
          '<td>' + escapeHtml(action) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function ensureImportDuplicateDrawer() {
    if (importDuplicateDrawerInstance) return importDuplicateDrawerInstance;
    importDuplicateDrawerInstance = ensureDrawer('caseLibraryImportDuplicateDrawer', [], null, function() {
      if (importDuplicateResolved) return;
      if (typeof importDuplicateResolve === 'function') {
        importDuplicateResolved = true;
        try { importDuplicateResolve(false); } catch (e) {}
        importDuplicateResolve = null;
      }
    });
    if (!importDuplicateConfirmBound) {
      importDuplicateConfirmBound = true;
      if (dom.importDuplicateConfirmBtn) {
        dom.importDuplicateConfirmBtn.addEventListener('click', function() {
          if (importDuplicateResolved) return;
          if (typeof importDuplicateResolve !== 'function') return;
          importDuplicateResolved = true;
          var resolve = importDuplicateResolve;
          importDuplicateResolve = null;
          try { resolve(true); } catch (e) {}
          if (importDuplicateDrawerInstance && typeof importDuplicateDrawerInstance.close === 'function') {
            importDuplicateDrawerInstance.close();
          }
        });
      }
    }
    return importDuplicateDrawerInstance;
  }

  function confirmImportDuplicatesByDrawer(payload) {
    var drawer = ensureImportDuplicateDrawer();
    if (!drawer) return Promise.resolve(false);
    importDuplicateResolved = false;
    renderImportDuplicateDrawer(payload);
    if (typeof drawer.open === 'function') drawer.open();
    return new Promise(function(resolve) {
      importDuplicateResolve = resolve;
    });
  }

  function buildDuplicateGroupsForImport(items) {
    var list = Array.isArray(items) ? items : [];
    var seen = {};
    var groups = {};
    var unique = [];

    list.forEach(function(it, idx) {
      if (!it) return;
      var key = buildCaseItemKey(it);
      if (!key) return;
      if (!groups[key]) groups[key] = [];
      var line = it && Number.isFinite(Number(it._sourceLine)) ? Number(it._sourceLine) : (idx + 1);
      groups[key].push({ line: line, item: it });

      if (seen[key]) return;
      seen[key] = true;
      unique.push(it);
    });

    var rows = [];
    Object.keys(groups).forEach(function(k) {
      var arr = groups[k];
      if (!arr || arr.length <= 1) return;
      arr.forEach(function(entry, idx) {
        rows.push({
          line: entry && entry.line ? entry.line : 0,
          item: entry && entry.item ? entry.item : null,
          keep: idx === 0,
        });
      });
    });
    rows.sort(function(a, b) {
      var la = a && a.line ? Number(a.line) : 0;
      var lb = b && b.line ? Number(b.line) : 0;
      return la - lb;
    });
    var duplicateCount = list.length - unique.length;
    return { uniqueItems: unique, duplicateCount: duplicateCount, rows: rows };
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
    var s = state.importDrawer;
    if (!s.files.length) {
      setStatus(dom.importStatus, '请先选择用例文件', 'warn');
      return;
    }
    if (!s.projectId) {
      setStatus(dom.importStatus, '请先选择项目', 'warn');
      return;
    }
    if (!s.versionId) {
      setStatus(dom.importStatus, '请先选择版本', 'warn');
      return;
    }

    function buildNameList(names, maxCount) {
      var list = Array.isArray(names) ? names.filter(Boolean) : [];
      var max = Number.isFinite(Number(maxCount)) ? Number(maxCount) : 8;
      if (!list.length) return '';
      var head = list.slice(0, max).join('、');
      return list.length > max ? (head + '...（共 ' + list.length + ' 份）') : head;
    }

    function pushSkip(skipped, name, reason) {
      skipped.push({ name: name || '用例', reason: reason || '已跳过' });
    }

    function pushFail(failed, name, reason) {
      failed.push({ name: name || '用例', reason: reason || '失败' });
    }

    function getSameNameMatchedCleanName(fileName, errPayload) {
      var importedCleanName = cleanCaseFileName(fileName || '');
      var matchedCleanName = errPayload && errPayload.existing_file_name_clean ? String(errPayload.existing_file_name_clean) : '';
      return matchedCleanName || importedCleanName || (fileName ? String(fileName) : '用例');
    }

    function enqueueSameNameDiffTask(queue, file, items, err) {
      var fileName = file && file.name ? file.name : '';
      var errPayload = err && err.payload ? err.payload : null;
      var cleanName = getSameNameMatchedCleanName(fileName, errPayload);
      queue.push({
        projectId: s.projectId,
        versionId: s.versionId,
        fileName: fileName,
        importItems: items,
        source: (file && file.type) ? file.type : (extFromFileName(fileName) || ''),
        error: err,
        cleanName: cleanName,
      });
      return cleanName;
    }

    function openImportDiffForQueueTask(task) {
      if (!task) return Promise.resolve({ ok: false, reason: 'invalid_task' });
      var projectId = task.projectId;
      var versionId = task.versionId;
      var fileName = task.fileName || '';
      var items = Array.isArray(task.importItems) ? task.importItems : [];
      var err = task.error || null;
      var errPayload = err && err.payload ? err.payload : null;
      var importedCleanName = cleanCaseFileName(fileName);
      var cleanName = task.cleanName || importedCleanName || '用例';
      var source = task.source || extFromFileName(fileName) || 'external';
      var existingCaseFileId = errPayload && errPayload.existing_case_file_id ? errPayload.existing_case_file_id : null;
      var dbVersionId = errPayload && (errPayload.existing_version_id || errPayload.existing_version_id === 0)
        ? errPayload.existing_version_id
        : null;

      // 优先走“带 existing_case_file_id”的通道（由后端返回），否则回退到拉列表按 cleanName 匹配。
      if (existingCaseFileId) {
        return openImportDiffForExternal({
          projectId: projectId,
          versionId: versionId,
          fileName: fileName,
          items: items,
          error: err,
          source: source,
        });
      }

      if (!projectId || !versionId || !fileName || !items.length) {
        return Promise.resolve({ ok: false, reason: 'invalid_params' });
      }

      openImportDiffDrawerLoading({
        fileName: fileName,
        cleanName: cleanName,
        importedCleanName: importedCleanName,
        projectId: projectId,
        importVersionId: versionId,
        source: source,
      });

      return new Promise(function(resolve) {
        state.importDiff.external = { resolve: resolve };
        Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId)])
          .then(function(res) {
            var files = Array.isArray(res && res[0]) ? res[0] : [];
            var list = Array.isArray(files) ? files : [];
            var existing = list.find(function(cf) {
              return cf && String(cf.file_name_clean || '') === String(cleanName || '');
            });
            if (!existing) throw new Error('未找到库中同名用例：' + cleanName);
            return apiClient.listCaseItems(existing.id).then(function(dbItems) {
              openImportDiffDrawer({
                fileName: fileName,
                cleanName: cleanName,
                importedCleanName: importedCleanName,
                projectId: projectId,
                importVersionId: versionId,
                dbVersionId: dbVersionId || existing.version_id || null,
                importItems: items,
                dbItems: dbItems || [],
                source: source,
              });
            });
          })
          .catch(function(loadErr) {
            setStatus(dom.importDiffStatus, '加载差异对比失败：' + (loadErr && loadErr.message ? loadErr.message : '未知错误'), 'err');
            var external = state.importDiff.external || null;
            if (external && typeof external.resolve === 'function') {
              state.importDiff.external = null;
              try {
                external.resolve({ ok: false, reason: 'load_failed', error: loadErr || null });
              } catch (e) {
                // ignore
              }
            }
          });
      });
    }

    function buildFinalImportMessage(imported, overwritten, skipped, failed) {
      var importedNames = imported.slice();
      var overwrittenNames = overwritten.slice();
      var skippedItems = Array.isArray(skipped) ? skipped : [];
      var failedItems = Array.isArray(failed) ? failed : [];
      var skippedNames = skippedItems.map(function(it) { return it && it.name ? it.name : '用例'; });
      var totalOk = importedNames.length + overwrittenNames.length;
      var totalSkip = skippedNames.length;
      var totalFail = failedItems.length;

      var lines = [];
      lines.push('导入完成：成功 ' + totalOk + ' 份，跳过 ' + totalSkip + ' 份，失败 ' + totalFail + ' 份');
      if (importedNames.length) lines.push('入库成功：' + buildNameList(importedNames, 10));
      if (overwrittenNames.length) lines.push('覆盖导入成功：' + buildNameList(overwrittenNames, 10));
      if (skippedItems.length) {
        skippedItems.slice(0, 6).forEach(function(it) {
          if (!it) return;
          lines.push('跳过 - ' + (it.name || '用例') + '：' + (it.reason || '已跳过'));
        });
        if (skippedItems.length > 6) lines.push('跳过 - 还有 ' + (skippedItems.length - 6) + ' 份未展开');
      }
      if (failedItems.length) {
        failedItems.slice(0, 6).forEach(function(it) {
          if (!it) return;
          lines.push('失败 - ' + (it.name || '用例') + '：' + (it.reason || '失败'));
        });
        if (failedItems.length > 6) lines.push('失败 - 还有 ' + (failedItems.length - 6) + ' 份未展开');
      }
      return lines.join('\n');
    }

    s.loading = true;
    syncImportConfirmEnabled();
    setStatus(dom.importStatus, '解析并导入中...', '');

    var importedNames = [];
    var overwrittenNames = [];
    var skippedItems = [];
    var failedItems = [];
    var diffQueue = [];
    var invalidOpened = false;
    var chain = Promise.resolve();

    s.files.forEach(function(file) {
      chain = chain.then(function() {
        if (invalidOpened) return;
        return parseImportFile(file)
          .then(function(parsed) {
            if (invalidOpened) return;
            var structural = parsed && Array.isArray(parsed.structuralErrors) ? parsed.structuralErrors : [];
            var items = parsed && parsed.items ? parsed.items : [];
            var cleanName = cleanCaseFileName(file && file.name ? file.name : '');
            if (!items.length) {
              var emptyMsg = '未解析到有效用例';
              pushSkip(skippedItems, cleanName || (file && file.name ? file.name : '文件'), emptyMsg);
              setStatus(dom.importStatus, '【' + (file && file.name ? file.name : '文件') + '】' + emptyMsg + '，已跳过', 'warn');
              return;
            }
            var invalid = validateImportItems(items);
            if (structural.length || invalid.length) {
              invalidOpened = true;
              openImportInvalidDrawer({
                file: file,
                fileName: file.name,
                cleanName: cleanCaseFileName(file.name),
                projectId: s.projectId,
                versionId: s.versionId,
                source: file.type || extFromFileName(file.name),
                items: items,
                structuralErrors: structural,
              });
              if (structural.length) {
                var hint = '导入发现字段层级不足 ' + structural.length + ' 条（将跳过）；可继续入库其余 ' + items.length + ' 条，或回到 XMind 补齐后重导入';
                setStatus(dom.importStatus, hint, 'warn');
                setStatus(dom.status, hint, 'warn');
              } else {
                setStatus(dom.importStatus, '导入校验失败：请在“格式校验”抽屉补齐必填字段后再确认入库', 'warn');
                setStatus(dom.status, '导入校验失败：请补齐必填字段后再确认入库', 'warn');
              }
              return;
            }

            function doImport(validItems) {
              return apiClient.importCaseFile({
                project_id: s.projectId,
                version_id: s.versionId,
                file_name: file.name,
                source: file.type || extFromFileName(file.name),
                items: sanitizeImportItemsForApi(validItems),
              }).then(function() {
                importedNames.push(cleanName || (file && file.name ? file.name : '用例'));
              }).catch(function(err) {
                var msg = err && err.message ? err.message : '导入失败';
                if (msg.indexOf('同名') !== -1) {
                  var matchedName = enqueueSameNameDiffTask(diffQueue, file, validItems, err);
                  setStatus(dom.importStatus, msg + '：' + matchedName + '（已加入差异对比队列）', 'warn');
                  return;
                }
                pushFail(failedItems, cleanName || (file && file.name ? file.name : '用例'), msg);
                setStatus(dom.importStatus, msg, 'err');
              });
            }

            var dup = buildDuplicateGroupsForImport(items);
            if (dup.duplicateCount > 0) {
              return confirmImportDuplicatesByDrawer({
                fileName: file.name,
                total: items.length,
                uniqueCount: dup.uniqueItems.length,
                duplicateCount: dup.duplicateCount,
                rows: dup.rows,
              }).then(function(ok) {
                if (!ok) {
                  pushSkip(skippedItems, cleanName || (file && file.name ? file.name : '用例'), '已取消导入（包含重复条目）');
                  setStatus(dom.importStatus, '已取消导入（包含重复条目）：' + (file && file.name ? file.name : '文件'), 'warn');
                  return;
                }
                return doImport(dup.uniqueItems);
              });
            }
            return doImport(items);
          })
          .catch(function(err) {
            if (invalidOpened) return;
            var msg = err && err.message ? err.message : '解析失败';
            var cleanName = cleanCaseFileName(file && file.name ? file.name : '');
            pushFail(failedItems, cleanName || (file && file.name ? file.name : '用例'), msg);
            setStatus(dom.importStatus, msg, 'err');
          });
      });
    });

    chain
      .then(function() {
        if (invalidOpened) return;
        if (!diffQueue.length) return;
        setStatus(dom.importStatus, '检测到同名用例冲突 ' + diffQueue.length + ' 份，请依次确认覆盖导入或关闭跳过', 'warn');
        state.importDiff.queue = { active: true, total: diffQueue.length, index: -1 };
        var diffChain = Promise.resolve();
        diffQueue.forEach(function(task, idx) {
          diffChain = diffChain.then(function() {
            if (!task) return;
            if (invalidOpened) return;
            if (state.importDiff.queue && state.importDiff.queue.active) state.importDiff.queue.index = idx;
            var tip = '同名用例已存在，处理差异对比（' + (idx + 1) + '/' + diffQueue.length + '）：' + (task.cleanName || '用例');
            setStatus(dom.importStatus, tip, 'warn');
            return openImportDiffForQueueTask(task).then(function(res) {
              if (res && res.ok) {
                overwrittenNames.push(task.cleanName || cleanCaseFileName(task.fileName));
                return;
              }
              if (res && res.reason === 'closed') {
                pushSkip(skippedItems, task.cleanName || cleanCaseFileName(task.fileName), '同名冲突已跳过');
                return;
              }
              var reason = res && res.reason ? String(res.reason) : '同名冲突处理失败';
              pushFail(failedItems, task.cleanName || cleanCaseFileName(task.fileName), reason);
            });
          });
        });
        return diffChain.finally(function() {
          if (state.importDiff.queue && state.importDiff.queue.active) {
            state.importDiff.queue.active = false;
            state.importDiff.queue.index = -1;
          }
        });
      })
      .then(function() {
        if (invalidOpened) return;
        var msg = buildFinalImportMessage(importedNames, overwrittenNames, skippedItems, failedItems);
        var hasIssues = Boolean(skippedItems.length || failedItems.length);
        setStatus(dom.importStatus, msg, hasIssues ? 'warn' : 'ok');
        setStatus(dom.status, msg, hasIssues ? 'warn' : 'ok');
        if (utils && typeof utils.showCenterToast === 'function') {
          utils.showCenterToast(msg, hasIssues ? 'warn' : 'ok', 10000);
        }
      })
      .finally(function() {
        s.loading = false;
        if (state.importDiff.queue && state.importDiff.queue.active) {
          state.importDiff.queue.active = false;
          state.importDiff.queue.index = -1;
        }
        // 防止重复导入：当本次导入无跳过/失败时，自动清空文件选择（保留项目/版本默认值）。
        if (
          !invalidOpened &&
          (importedNames.length || overwrittenNames.length) &&
          skippedItems.length === 0 &&
          failedItems.length === 0
        ) {
          s.files = [];
          renderImportFileHint();
          if (dom.importInput) {
            try {
              dom.importInput.value = '';
            } catch (e) {
              // ignore
            }
          }
        }
        syncImportConfirmEnabled();
      });
  }

  function resetEditDrawer() {
    state.editDrawer.projectId = null;
    state.editDrawer.versionId = null;
    state.editDrawer.files = [];
    state.editDrawer.execByFileId = {};
    state.editDrawer.loading = false;
    state.editDrawer.selection = new Set();
    state.editDrawer.pageIndex = 0;
    state.editDrawer.ownerFilterTouched = false;
    state.editDrawer.changeVersionId = null;
    if (!state.editDrawer.ownerFilter) state.editDrawer.ownerFilter = 'all';
    if (state.editDrawer.ownerFilter === 'me' && !state.editDrawer.ownerFilterTouched) {
      state.editDrawer.ownerFilter = 'all';
    }
    state.editDrawer.fileSearchText = '';
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
    if (dom.editDrawerListBody) {
      dom.editDrawerListBody.innerHTML = '<tr><td colspan=\"12\"><p class=\"hint\">请选择项目后自动刷新。</p></td></tr>';
    }
    setDrawerPagination(dom.editDrawerPaginationTop, dom.editDrawerPaginationBottom, '');
    syncEditDrawerControls();
  }

  function handleEditDrawerVersionChange() {
    state.editDrawer.versionId = normalizeId(dom.editDrawerVersionSelect ? dom.editDrawerVersionSelect.value : '');
    state.editDrawer.selection = new Set();
    state.editDrawer.pageIndex = 0;
    renderEditDrawerList();
    updateEditDrawerLoadedStatus();
    syncEditDrawerControls();
    persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
  }

  function handleEditDrawerChangeVersionSelectChange() {
    state.editDrawer.changeVersionId = normalizeId(dom.editDrawerChangeVersionSelect ? dom.editDrawerChangeVersionSelect.value : '');
    syncEditDrawerControls();
  }

  function handleEditDrawerOwnerFilterChange() {
    state.editDrawer.ownerFilter = normalizeEditDrawerOwnerFilter(dom.editDrawerOwnerFilterSelect ? dom.editDrawerOwnerFilterSelect.value : '');
    state.editDrawer.ownerFilterTouched = true;
    state.editDrawer.pageIndex = 0;
    // 切换过滤后，仅保留当前可见列表里的勾选，避免隐藏项仍被导出/删除。
    var visibleIds = {};
    getEditDrawerVisibleFiles().forEach(function(f) {
      if (!f || f.id === null || f.id === undefined) return;
      visibleIds[String(f.id)] = true;
    });
    var nextSel = new Set();
    (state.editDrawer.selection || new Set()).forEach(function(id) {
      if (visibleIds[String(id)]) nextSel.add(String(id));
    });
    state.editDrawer.selection = nextSel;
    renderEditDrawerList();
    updateEditDrawerLoadedStatus();
    syncEditDrawerControls();
    persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
  }

  function handleEditDrawerFileSearchInput() {
    if (!dom.editDrawerFileSearchInput) return;
    state.editDrawer.fileSearchText = String(dom.editDrawerFileSearchInput.value || '');
    state.editDrawer.pageIndex = 0;
    // 搜索同样视为筛选：仅保留可见项的勾选。
    var visibleIds = {};
    getEditDrawerVisibleFiles().forEach(function(f) {
      if (!f || f.id === null || f.id === undefined) return;
      visibleIds[String(f.id)] = true;
    });
    var nextSel = new Set();
    (state.editDrawer.selection || new Set()).forEach(function(id) {
      if (visibleIds[String(id)]) nextSel.add(String(id));
    });
    state.editDrawer.selection = nextSel;
    renderEditDrawerList();
    updateEditDrawerLoadedStatus();
    syncEditDrawerControls();
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
    var selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
    state.editDrawer.selection = selection;
    if (!selection.size) return [];
    var list = Array.isArray(state.editDrawer.files) ? state.editDrawer.files : [];
    return list.filter(function(f) { return f && f.id !== null && f.id !== undefined && selection.has(String(f.id)); });
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
    openShareDrawer(files, { previousDrawer: editDrawerInstance || null });
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
    state.editDrawer.projectId = projectId;
    state.editDrawer.versionId = null;
    state.editDrawer.files = [];
    state.editDrawer.execByFileId = {};
    state.editDrawer.selection = new Set();
    state.editDrawer.pageIndex = 0;
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
      if (dom.editDrawerListBody) {
        dom.editDrawerListBody.innerHTML = '<tr><td colspan=\"12\"><p class=\"hint\">请选择项目后自动刷新。</p></td></tr>';
      }
      setDrawerPagination(dom.editDrawerPaginationTop, dom.editDrawerPaginationBottom, '');
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
    var list = Array.isArray(state.editDrawer.files) ? state.editDrawer.files : [];
    var visible = list;
    if (state.editDrawer.versionId) {
      visible = visible.filter(function(f) { return String(f && f.version_id || '') === String(state.editDrawer.versionId || ''); });
    }
    var ownerFilter = normalizeEditDrawerOwnerFilter(state.editDrawer && state.editDrawer.ownerFilter ? state.editDrawer.ownerFilter : 'all');
    if (ownerFilter === 'shared') {
      visible = visible.filter(function(f) { return isSharedCaseFile(f); });
    } else if (ownerFilter === 'me') {
      var userId = getCurrentUserId();
      if (userId) {
        visible = visible.filter(function(f) {
          if (!f) return false;
          var importerId = f.importer_id !== null && f.importer_id !== undefined ? String(f.importer_id) : '';
          var updaterId = f.last_updated_by !== null && f.last_updated_by !== undefined ? String(f.last_updated_by) : '';
          return String(importerId) === String(userId) || String(updaterId) === String(userId);
        });
      }
    }
    var term = normalizeName(state.editDrawer && state.editDrawer.fileSearchText ? state.editDrawer.fileSearchText : '');
    if (!term) return visible;
    return visible.filter(function(f) {
      if (!f) return false;
      var name = normalizeName(f.file_name_clean || '');
      return name.indexOf(term) !== -1;
    });
  }

  function getEditDrawerPagedFiles() {
    var visible = getEditDrawerVisibleFiles();
    var page = resolveDrawerPage(visible.length, state.editDrawer.pageIndex);
    state.editDrawer.pageIndex = page.pageIndex;
    return {
      page: page,
      list: visible.slice(page.start, page.end),
      total: visible.length,
    };
  }

  function syncEditDrawerControls() {
    var pageData = getEditDrawerPagedFiles();
    var list = pageData.list;
    var selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
    state.editDrawer.selection = selection;
    var canDelete = isAdminUser();

    if (dom.editDrawerDeleteBtn) {
      dom.editDrawerDeleteBtn.disabled = !canDelete || Boolean(state.editDrawer.loading) || selection.size === 0;
    }
    if (dom.editDrawerExportXmindBtn) {
      dom.editDrawerExportXmindBtn.disabled = Boolean(state.editDrawer.loading) || selection.size === 0;
    }
    if (dom.editDrawerExportExcelBtn) {
      dom.editDrawerExportExcelBtn.disabled = Boolean(state.editDrawer.loading) || selection.size === 0;
    }
    if (dom.editDrawerShareBtn) {
      dom.editDrawerShareBtn.disabled = Boolean(state.editDrawer.loading) || selection.size === 0;
    }
    if (dom.editDrawerChangeVersionBtn) {
      var changeVersionId = normalizeId(dom.editDrawerChangeVersionSelect ? dom.editDrawerChangeVersionSelect.value : '');
      var canChangeVersion = Boolean(changeVersionId) && selection.size > 0 && !state.editDrawer.loading;
      if (dom.editDrawerChangeVersionSelect && dom.editDrawerChangeVersionSelect.disabled) {
        canChangeVersion = false;
      }
      dom.editDrawerChangeVersionBtn.disabled = !canChangeVersion;
    }
    if (dom.editDrawerSelectAll) {
      if (!list.length) {
        dom.editDrawerSelectAll.checked = false;
        dom.editDrawerSelectAll.indeterminate = false;
      } else {
        var total = list.length;
        var selected = list.reduce(function(count, f) {
          if (!f || f.id === null || f.id === undefined) return count;
          return selection.has(String(f.id)) ? count + 1 : count;
        }, 0);
        dom.editDrawerSelectAll.checked = selected === total;
        dom.editDrawerSelectAll.indeterminate = selected > 0 && selected < total;
      }
      dom.editDrawerSelectAll.disabled = Boolean(state.editDrawer.loading) || !list.length;
    }
  }

  function setEditDrawerSelectionAll(checked) {
    var pageData = getEditDrawerPagedFiles();
    var list = pageData.list;
    state.editDrawer.selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
    if (checked) {
      list.forEach(function(f) {
        if (!f || f.id === null || f.id === undefined) return;
        state.editDrawer.selection.add(String(f.id));
      });
    } else {
      list.forEach(function(f) {
        if (!f || f.id === null || f.id === undefined) return;
        state.editDrawer.selection.delete(String(f.id));
      });
    }
    renderEditDrawerList();
    syncEditDrawerControls();
    persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
  }

  function renderEditDrawerList() {
    if (!dom.editDrawerListBody) return;
    var result = getEditDrawerPagedFiles();
    var list = result.list;
    var total = result.total;
    var page = result.page;
    if (!total) {
      var hint = '暂无用例文件';
      var term = String(state.editDrawer && state.editDrawer.fileSearchText ? state.editDrawer.fileSearchText : '').trim();
      if (term) hint = '未找到匹配的用例文件';
      else if (state.editDrawer.versionId) hint = '该版本暂无用例文件';
      dom.editDrawerListBody.innerHTML = '<tr><td colspan=\"12\"><p class=\"hint\">' + escapeHtml(hint) + '</p></td></tr>';
      setDrawerPagination(dom.editDrawerPaginationTop, dom.editDrawerPaginationBottom, '');
      syncEditDrawerControls();
      return;
    }
    var canDelete = isAdminUser();
    dom.editDrawerListBody.innerHTML = list.map(function(f) {
      // 兼容：列表项应自带 project_id/version_id；若 state 发生波动（例如刷新恢复过程中），优先使用行数据保证展示正确。
      var rowProjectId = f && (f.project_id || f.project_id === 0) ? f.project_id : state.editDrawer.projectId;
      var projectName = state.projectNameById[rowProjectId] || ('项目#' + rowProjectId);
      var versionName = getVersionName(rowProjectId, f && f.version_id ? f.version_id : null);
      var importerName = f && f.importer_name ? f.importer_name : '--';
      var importedAt = formatTime(f && f.imported_at);
      var updaterName = f && f.last_updated_by_name ? f.last_updated_by_name : (importerName || '--');
      var updatedAt = formatTime(f && f.updated_at);
      var itemCount = (f && (f.item_count || f.item_count === 0)) ? String(f.item_count) : '--';
      var reuseEnabled = Boolean(f && f.reuse_enabled);
      var reuseText = reuseEnabled ? '是' : '否';
      var fileId = f && f.id !== null && f.id !== undefined ? String(f.id) : '';
      var checked = Boolean(fileId && state.editDrawer.selection && state.editDrawer.selection.has(fileId));
      var selectCell = '<td><input type=\"checkbox\" data-case-lib-edit-select=\"' + escapeHtml(fileId) + '\"' + (checked ? ' checked' : '') + ' /></td>';
      var fileName = f && f.file_name_clean ? f.file_name_clean : ('文件#' + (f && f.id ? f.id : ''));
      var reuseBadge = reuseEnabled ? ' <span class=\"badge case-library-reuse-badge\">复</span>' : '';
      var execInfo = state.editDrawer.execByFileId && fileId ? state.editDrawer.execByFileId[fileId] : null;
      var activeUsers = execInfo && Array.isArray(execInfo.active_users) ? execInfo.active_users : [];
      var execStatusCell = renderExecPageStatusCell(activeUsers);
      var showAiDot = fileId ? shouldShowCaseLibraryAiGenEditBadge(fileId) : false;
      var editBtnClass = 'primary' + (showAiDot ? ' case-library-ai-gen-dot' : '');
      return (
        '<tr>' +
          selectCell +
          '<td>' + escapeHtml(projectName) + '</td>' +
          '<td>' + escapeHtml(versionName) + '</td>' +
          '<td>' + escapeHtml(fileName) + reuseBadge + '</td>' +
          '<td>' + execStatusCell + '</td>' +
          '<td>' + escapeHtml(itemCount) + '</td>' +
          '<td>' + escapeHtml(reuseText) + '</td>' +
          '<td>' + escapeHtml(importerName) + '</td>' +
          '<td>' + escapeHtml(importedAt) + '</td>' +
          '<td>' + escapeHtml(updaterName) + '</td>' +
          '<td>' + escapeHtml(updatedAt) + '</td>' +
          '<td>' +
            '<div class=\"case-library-row-actions\">' +
              '<button class=\"' + escapeHtml(editBtnClass) + '\" type=\"button\" data-case-lib-edit=\"' + escapeHtml(f && f.id ? f.id : '') + '\">编辑</button>' +
            '</div>' +
          '</td>' +
        '</tr>'
      );
    }).join('');
    setDrawerPagination(
      dom.editDrawerPaginationTop,
      dom.editDrawerPaginationBottom,
      buildDrawerPagination(total, page.pageIndex, page.totalPages, page.start, page.end, 'edit')
    );
    syncEditDrawerControls();
  }

  function renderExecPageStatusCell(activeUsers) {
    var list = Array.isArray(activeUsers) ? activeUsers : [];
    if (!list.length) {
      return '<div><span class="tag muted case-lib-exec-tag-pending" title="未转执行">未</span></div>';
    }
    return list
      .map(function(name) {
        return (
          '<div>' +
            escapeHtml(name || '') +
            '：<span class="tag case-lib-exec-tag" title="执行中">执</span>' +
          '</div>'
        );
      })
      .join('');
  }

  function resetShareDrawerControls() {
    state.shareDrawer.projectId = null;
    state.shareDrawer.versionId = null;
    state.shareDrawer.loading = false;
    state.shareDrawer.versionLoadFailed = false;
    if (dom.shareDrawerProjectSelect) {
      dom.shareDrawerProjectSelect.innerHTML = '<option value=\"\">请选择项目</option>';
      dom.shareDrawerProjectSelect.value = '';
    }
    if (dom.shareDrawerVersionSelect) {
      dom.shareDrawerVersionSelect.disabled = true;
      dom.shareDrawerVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
      dom.shareDrawerVersionSelect.value = '';
    }
    if (dom.shareDrawerStatus) setStatus(dom.shareDrawerStatus, '', '');
    syncShareDrawerControls();
  }

  function clearShareDrawerState() {
    resetShareDrawerControls();
    state.shareDrawer.caseFile = null;
    state.shareDrawer.caseFiles = [];
    state.shareDrawer.previousDrawer = null;
    state.shareDrawer.reopenPrevious = false;
  }

  function getShareDrawerCaseFiles() {
    if (Array.isArray(state.shareDrawer.caseFiles) && state.shareDrawer.caseFiles.length) {
      return state.shareDrawer.caseFiles;
    }
    if (state.shareDrawer.caseFile) return [state.shareDrawer.caseFile];
    return [];
  }

  function renderShareDrawerMeta() {
    var files = getShareDrawerCaseFiles();
    var count = files.length;
    var fileName = '--';
    if (count === 1) {
      fileName = files[0].file_name_clean || ('用例#' + files[0].id);
    } else if (count > 1) {
      fileName = '已选 ' + count + ' 份用例';
    }
    if (dom.shareDrawerCaseName) dom.shareDrawerCaseName.textContent = fileName;

    var projectName = '--';
    if (count) {
      var projectId = files[0].project_id;
      var sameProject = files.every(function(item) {
        return item && String(item.project_id) === String(projectId);
      });
      if (!sameProject) projectName = '多个项目';
      else projectName = state.projectNameById[projectId] || ('项目#' + projectId);
    }
    if (dom.shareDrawerSourceProject) dom.shareDrawerSourceProject.textContent = projectName;

    var versionName = '--';
    if (count) {
      var versionId = files[0].version_id;
      var sameVersion = files.every(function(item) {
        return item && String(item.version_id) === String(versionId);
      });
      if (!sameVersion) versionName = '多个版本';
      else versionName = getVersionName(files[0].project_id, versionId);
    }
    if (dom.shareDrawerSourceVersion) dom.shareDrawerSourceVersion.textContent = versionName;
  }

  function shareRequiresVersion(projectId) {
    var list = projectId && state.shareDrawer.versionsByProject[projectId] ? state.shareDrawer.versionsByProject[projectId] : [];
    return Array.isArray(list) && list.length > 0;
  }

  function syncShareDrawerControls() {
    if (!dom.shareDrawerConfirmBtn) return;
    var files = getShareDrawerCaseFiles();
    var hasFiles = files.length > 0;
    var pid = state.shareDrawer.projectId;
    var vid = state.shareDrawer.versionId;
    var needVersion = pid && shareRequiresVersion(pid);
    var disabled = Boolean(state.shareDrawer.loading) || Boolean(state.shareDrawer.versionLoadFailed) || !hasFiles || !pid || (needVersion && !vid);
    dom.shareDrawerConfirmBtn.disabled = disabled;
  }

  function handleShareProjectChange() {
    state.shareDrawer.projectId = normalizeId(dom.shareDrawerProjectSelect ? dom.shareDrawerProjectSelect.value : '');
    state.shareDrawer.versionId = null;
    state.shareDrawer.versionLoadFailed = false;
    setStatus(dom.shareDrawerStatus, '', '');
    if (dom.shareDrawerVersionSelect) {
      dom.shareDrawerVersionSelect.disabled = true;
      dom.shareDrawerVersionSelect.innerHTML = '<option value=\"\">加载版本中...</option>';
    }
    syncShareDrawerControls();
    var pid = state.shareDrawer.projectId;
    if (!pid) {
      if (dom.shareDrawerVersionSelect) {
        dom.shareDrawerVersionSelect.disabled = true;
        dom.shareDrawerVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
        dom.shareDrawerVersionSelect.value = '';
      }
      syncShareDrawerControls();
      return;
    }
    loadShareVersions(pid)
      .then(function(list) {
        var versions = Array.isArray(list) ? list : [];
        if (dom.shareDrawerVersionSelect) {
          if (versions.length) {
            dom.shareDrawerVersionSelect.disabled = false;
            syncShareVersionOptions(dom.shareDrawerVersionSelect, pid, '请选择版本');
            dom.shareDrawerVersionSelect.value = '';
          } else {
            dom.shareDrawerVersionSelect.disabled = true;
            dom.shareDrawerVersionSelect.innerHTML = '<option value=\"\">无需选择版本</option>';
            dom.shareDrawerVersionSelect.value = '';
          }
        }
        syncShareDrawerControls();
      })
      .catch(function(err) {
        state.shareDrawer.versionLoadFailed = true;
        if (dom.shareDrawerVersionSelect) {
          dom.shareDrawerVersionSelect.disabled = true;
          dom.shareDrawerVersionSelect.innerHTML = '<option value=\"\">加载版本失败</option>';
        }
        setStatus(dom.shareDrawerStatus, err && err.message ? err.message : '加载版本失败', 'err');
        syncShareDrawerControls();
      });
  }

  function handleShareVersionChange() {
    state.shareDrawer.versionId = normalizeId(dom.shareDrawerVersionSelect ? dom.shareDrawerVersionSelect.value : '');
    syncShareDrawerControls();
  }

  function normalizeShareCaseFiles(caseFiles) {
    if (Array.isArray(caseFiles)) {
      return caseFiles.filter(function(item) { return item && item.id; });
    }
    if (caseFiles && caseFiles.id) return [caseFiles];
    return [];
  }

  function openShareDrawer(caseFiles, options) {
    var list = normalizeShareCaseFiles(caseFiles);
    if (!list.length) return;
    var drawer = ensureShareDrawer();
    if (!drawer) {
      setStatus(dom.editDrawerStatus, '共享抽屉不可用', 'warn');
      return;
    }
    state.shareDrawer.caseFiles = list;
    state.shareDrawer.caseFile = list[0] || null;
    state.shareDrawer.projectId = null;
    state.shareDrawer.versionId = null;
    state.shareDrawer.loading = false;
    state.shareDrawer.previousDrawer = options && (options.previousDrawer || options.prevDrawer || options.drawer)
      ? (options.previousDrawer || options.prevDrawer || options.drawer)
      : null;
    state.shareDrawer.reopenPrevious = false;
    if (
      state.shareDrawer.previousDrawer &&
      state.shareDrawer.previousDrawer.element &&
      state.shareDrawer.previousDrawer.element.classList &&
      state.shareDrawer.previousDrawer.element.classList.contains('open')
    ) {
      state.shareDrawer.reopenPrevious = true;
      if (typeof state.shareDrawer.previousDrawer.close === 'function') {
        state.shareDrawer.previousDrawer.close();
      }
    }
    if (typeof drawer.open === 'function') drawer.open();
  }

  function getShareCaseFileName(file) {
    if (!file) return '';
    return file.file_name_clean || ('用例#' + file.id);
  }

  function formatShareCaseFileNames(list, limit) {
    var names = Array.isArray(list) ? list.map(getShareCaseFileName).filter(Boolean) : [];
    if (!names.length) return '';
    var cap = Number(limit);
    if (!isFinite(cap) || cap <= 0) cap = 3;
    if (names.length <= cap) return names.join('、');
    return names.slice(0, cap).join('、') + '等' + names.length + '份';
  }

  function isShareCaseFileDuplicateError(err) {
    var payload = err && err.payload ? err.payload : null;
    var detail = payload && payload.detail ? String(payload.detail || '') : '';
    return Boolean(err && (err.status === 409 || detail === 'case_file_duplicate'));
  }

  function submitShareCaseFiles(anchorRect) {
    var files = getShareDrawerCaseFiles();
    if (!files.length) {
      setStatus(dom.shareDrawerStatus, '未选择用例', 'warn');
      return;
    }
    var pid = state.shareDrawer.projectId;
    var vid = state.shareDrawer.versionId;
    var projectName = state.shareDrawer.projectNameById[pid] || ('项目#' + pid);
    if (!apiClient || typeof apiClient.shareCaseFile !== 'function') {
      setStatus(dom.shareDrawerStatus, '共享接口未就绪', 'warn');
      return;
    }
    state.shareDrawer.loading = true;
    syncShareDrawerControls();
    setStatus(dom.shareDrawerStatus, '共享中...', '');

    var successFiles = [];
    var duplicateFiles = [];
    var failedFiles = [];

    var chain = Promise.resolve();
    files.forEach(function(file) {
      chain = chain.then(function() {
        return apiClient
          .shareCaseFile({
            case_file_id: file.id,
            target_project_id: pid,
            target_version_id: vid,
          })
          .then(function() {
            successFiles.push(file);
          })
          .catch(function(err) {
            if (isShareCaseFileDuplicateError(err)) {
              duplicateFiles.push(file);
              return;
            }
            failedFiles.push(file);
          });
      });
    });

    chain
      .then(function() {
        var parts = [];
        if (successFiles.length) {
          parts.push('共享成功：' + formatShareCaseFileNames(successFiles));
        }
        if (duplicateFiles.length) {
          parts.push('已存在未共享：' + formatShareCaseFileNames(duplicateFiles));
        }
        if (failedFiles.length) {
          parts.push('共享失败：' + formatShareCaseFileNames(failedFiles));
        }
        var message = parts.join('；') || ('已共享至项目「' + projectName + '」');
        var level = 'ok';
        if (failedFiles.length) level = 'err';
        else if (duplicateFiles.length) level = 'warn';
        setStatus(dom.shareDrawerStatus, message, level);
        if (duplicateFiles.length) {
          var rect = anchorRect || captureCaseLibraryAnchorRect(dom.shareDrawerConfirmBtn);
          if (rect) {
            showCaseLibraryBlockHint(rect, '该项目已有此用例，如有相关改动，请通知该项目人员。', 5000);
          }
        }
      })
      .finally(function() {
        state.shareDrawer.loading = false;
        syncShareDrawerControls();
      });
  }

  function confirmShareCaseFile() {
    if (state.shareDrawer.loading) return;
    var files = getShareDrawerCaseFiles();
    if (!files.length) {
      setStatus(dom.shareDrawerStatus, '未选择用例', 'warn');
      return;
    }
    var pid = normalizeId(dom.shareDrawerProjectSelect ? dom.shareDrawerProjectSelect.value : '');
    state.shareDrawer.projectId = pid;
    if (!pid) {
      setStatus(dom.shareDrawerStatus, '请先选择项目', 'warn');
      syncShareDrawerControls();
      return;
    }
    var vid = normalizeId(dom.shareDrawerVersionSelect ? dom.shareDrawerVersionSelect.value : '');
    state.shareDrawer.versionId = vid;
    if (shareRequiresVersion(pid) && !vid) {
      setStatus(dom.shareDrawerStatus, '请先选择版本', 'warn');
      syncShareDrawerControls();
      return;
    }
    var projectName = state.shareDrawer.projectNameById[pid] || ('项目#' + pid);
    var versionName = vid ? getShareVersionName(pid, vid) : '';
    var msgPrefix = '';
    if (files.length === 1) {
      msgPrefix = '用例【' + getShareCaseFileName(files[0]) + '】';
    } else {
      msgPrefix = '已选 ' + files.length + ' 份用例';
    }
    var msg = '确认将' + msgPrefix + '分享给项目「' + projectName + '」' + (vid ? ('（版本：' + versionName + '）') : '') + '吗？';
    var anchorRect = captureCaseLibraryAnchorRect(dom.shareDrawerConfirmBtn);
    openConfirmDrawer({
      title: '共享用例',
      message: msg,
      confirmText: '确认共享',
      cancelText: '取消',
      previousDrawer: shareDrawerInstance || null,
    }).then(function(res) {
      if (!res || res.ok !== true) {
        setStatus(dom.shareDrawerStatus, '已取消共享', 'warn');
        return;
      }
      submitShareCaseFiles(anchorRect);
    });
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
      state.editDrawer.loading = true;
      syncEditDrawerControls();
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
          state.editDrawer.selection = new Set();
          var msg = '更换版本完成：成功 ' + updatedIds.length + ' 份';
          if (skippedIds.length) msg += '，跳过 ' + skippedIds.length + ' 份';
          if (missingIds.length) msg += '，缺失 ' + missingIds.length + ' 份';
          setStatus(dom.editDrawerStatus, msg, missingIds.length ? 'warn' : 'ok');
          renderEditDrawerList();
        })
        .catch(function(err) {
          setStatus(dom.editDrawerStatus, err && err.message ? err.message : '更换版本失败', 'err');
        })
        .finally(function() {
          state.editDrawer.loading = false;
          syncEditDrawerControls();
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
      state.editDrawer.loading = true;
      syncEditDrawerControls();
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
        state.editDrawer.loading = false;
        state.editDrawer.selection = new Set();
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
        renderEditDrawerList();
        syncEditDrawerControls();
      });
    });
  }

  function loadEditDrawerFiles() {
    var projectId = normalizeId(dom.editDrawerProjectSelect ? dom.editDrawerProjectSelect.value : '');
    state.editDrawer.projectId = projectId;
    state.editDrawer.versionId = normalizeId(dom.editDrawerVersionSelect ? dom.editDrawerVersionSelect.value : '');
    state.editDrawer.files = [];
    state.editDrawer.execByFileId = {};
    state.editDrawer.selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
    renderEditDrawerList();
    if (!projectId) {
      setStatus(dom.editDrawerStatus, '请先选择项目', 'warn');
      return;
    }
    setStatus(dom.editDrawerStatus, '加载用例库...', '');
    state.editDrawer.loading = true;
    Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId), apiClient.listExecSetsByCaseFile(projectId)])
      .then(function(res) {
        var files = Array.isArray(res && res[0]) ? res[0] : [];
        state.editDrawer.files = files;
        var execSets = Array.isArray(res && res[2]) ? res[2] : [];
        state.editDrawer.execByFileId = buildExecMapByFileId(execSets);
        if (dom.editDrawerVersionSelect) {
          syncVersionOptions(dom.editDrawerVersionSelect, projectId, '全部版本');
          dom.editDrawerVersionSelect.disabled = false;
          if (state.editDrawer.versionId) {
            dom.editDrawerVersionSelect.value = String(state.editDrawer.versionId);
          } else {
            dom.editDrawerVersionSelect.value = '';
          }
        }
        syncEditDrawerChangeVersionOptions(projectId);
        updateEditDrawerLoadedStatus(getEditDrawerVisibleFiles(), true);
        // 若列表更新，清理掉不存在/不可见的勾选项，避免按钮状态与实际不一致。
        var visibleIds = {};
        getEditDrawerVisibleFiles().forEach(function(f) {
          if (!f || f.id === null || f.id === undefined) return;
          visibleIds[String(f.id)] = true;
        });
        var nextSel = new Set();
        (state.editDrawer.selection || new Set()).forEach(function(id) {
          if (visibleIds[String(id)]) nextSel.add(String(id));
        });
        state.editDrawer.selection = nextSel;
        renderEditDrawerList();
      })
      .catch(function(err) {
        setStatus(dom.editDrawerStatus, err && err.message ? err.message : '加载失败', 'err');
      })
      .finally(function() {
        state.editDrawer.loading = false;
        syncEditDrawerControls();
        persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
      });
  }

  function findCaseFileInEditDrawer(id) {
    var fileId = Number(id);
    if (isNaN(fileId)) return null;
    return (state.editDrawer.files || []).find(function(f) { return f && f.id === fileId; }) || null;
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

  function ensureMissingReminderState() {
    if (!state.missingReminder || typeof state.missingReminder !== 'object') {
      state.missingReminder = {
        projectId: null,
        signature: '',
        items: [],
        matchedModules: [],
        matchedTypes: [],
        hasMatch: false,
        pending: false,
        pendingPayload: null,
        loading: false,
        loaded: false,
        limit: 10,
        seq: 0,
        aiContextSignature: '',
        aiContextProjectId: '',
        aiContextReady: false,
        aiSignature: '',
        aiProjectId: '',
        aiItems: [],
        aiIds: [],
        aiLoading: false,
        aiGenerated: false,
        aiError: '',
        aiSeq: 0,
        libraryEmpty: false,
        libraryChecked: false,
        libraryLoading: false,
        libraryProjectId: '',
        librarySeq: 0,
        refreshTimer: null,
        observer: null,
        observerTarget: null,
        scrollHandler: null,
        scrollTimer: null,
      };
    }
    return state.missingReminder;
  }

  function resolveMissingReminderPlacement() {
    var globalState = window.app && window.app.state ? window.app.state : null;
    var settings = globalState && globalState.settings && typeof globalState.settings === 'object'
      ? globalState.settings
      : {};
    var raw = settings.missingCaseReminderPlacement;
    var key = raw === null || raw === undefined ? '' : String(raw).toLowerCase();
    return key === 'bottom' ? 'bottom' : 'top';
  }

  function resolveMissingReminderMatchConfig(value) {
    var globalState = window.app && window.app.state ? window.app.state : null;
    var settings = globalState && globalState.settings && typeof globalState.settings === 'object'
      ? globalState.settings
      : {};
    var raw = value;
    if (raw === undefined) raw = settings.missingCaseReminderMatchConfig;
    if (utils && typeof utils.normalizeMissingReminderMatchConfig === 'function') {
      return utils.normalizeMissingReminderMatchConfig(raw, { type: true, module: true });
    }
    var base = { type: true, module: true };
    var cfg = raw && typeof raw === 'object' ? raw : {};
    var typeFlag = cfg.type === true ? true : cfg.type === false ? false : base.type !== false;
    var moduleFlag = cfg.module === true ? true : cfg.module === false ? false : base.module !== false;
    if (!typeFlag && !moduleFlag) {
      typeFlag = base.type !== false;
      moduleFlag = base.module !== false;
      if (!typeFlag && !moduleFlag) typeFlag = true;
    }
    return { type: typeFlag, module: moduleFlag };
  }

  function resolveMissingReminderAiEnabled() {
    var globalState = window.app && window.app.state ? window.app.state : null;
    var settings = globalState && globalState.settings && typeof globalState.settings === 'object'
      ? globalState.settings
      : {};
    var raw = settings.missingCaseReminderAiEnabled;
    return String(raw || '').toLowerCase() === 'on' ? 'on' : 'off';
  }

  function buildMissingReminderFieldText(item, keys) {
    if (!item || typeof item !== 'object') return '';
    var parts = [];
    (keys || []).forEach(function(key) {
      if (!key) return;
      var val = (utils && typeof utils.stringifyCaseField === 'function')
        ? utils.stringifyCaseField(item[key])
        : String(item[key] || '');
      if (val) parts.push(val);
    });
    return parts.join(' ').toLowerCase();
  }

  function buildMissingReminderFieldTextMap(items) {
    var list = Array.isArray(items) ? items : [];
    var titles = [];
    var preconditions = [];
    var steps = [];
    var expected = [];
    list.forEach(function(item) {
      var title = buildMissingReminderFieldText(item, ['title']);
      if (title) titles.push(title);
      var pre = buildMissingReminderFieldText(item, ['precondition', 'preconditions']);
      if (pre) preconditions.push(pre);
      var step = buildMissingReminderFieldText(item, ['steps']);
      if (step) steps.push(step);
      var exp = buildMissingReminderFieldText(item, ['expected']);
      if (exp) expected.push(exp);
    });
    return {
      title: titles.join(' '),
      precondition: preconditions.join(' '),
      steps: steps.join(' '),
      expected: expected.join(' '),
    };
  }

  var missingReminderCaseFields = [
    'module', 'title', 'priority', 'precondition', 'preconditions', 'steps', 'expected'
  ];

  function buildMissingReminderCaseEntry(item) {
    if (!item || typeof item !== 'object') return null;
    var stringify = utils && typeof utils.stringifyCaseField === 'function'
      ? utils.stringifyCaseField
      : function(val) { return String(val || '').trim(); };
    var moduleVal = stringify(item.module || item.module_name || '');
    var preconditionVal = stringify(item.precondition || item.preconditions || '');
    return {
      module: moduleVal,
      title: stringify(item.title || ''),
      priority: stringify(item.priority || ''),
      precondition: preconditionVal,
      steps: stringify(item.steps || ''),
      expected: stringify(item.expected || ''),
    };
  }

  function buildMissingReminderCaseText(item) {
    if (!item || typeof item !== 'object') return '';
    if (utils && typeof utils.buildCaseSearchText === 'function') {
      return utils.buildCaseSearchText([item], missingReminderCaseFields);
    }
    var parts = [];
    missingReminderCaseFields.forEach(function(key) {
      if (!key) return;
      var val = (utils && typeof utils.stringifyCaseField === 'function')
        ? utils.stringifyCaseField(item[key])
        : String(item[key] || '');
      if (val) parts.push(val);
    });
    return parts.join(' ').toLowerCase();
  }

  function buildMissingReminderCaseContext(items) {
    var list = Array.isArray(items) ? items : [];
    var caseEntries = [];
    var caseTexts = [];
    list.forEach(function(item) {
      var entry = buildMissingReminderCaseEntry(item);
      if (!entry) return;
      caseEntries.push(entry);
      var text = buildMissingReminderCaseText(item);
      if (text) caseTexts.push(text);
    });
    return {
      entries: caseEntries,
      texts: caseTexts,
      searchText: caseTexts.join(' '),
      signatureText: caseTexts.join('\n\n'),
    };
  }

  function hasMissingReminderKeywordHit(text, keywords) {
    if (!text || !keywords || !keywords.length) return false;
    for (var i = 0; i < keywords.length; i += 1) {
      if (text.indexOf(keywords[i]) !== -1) return true;
    }
    return false;
  }

  function buildMissingReminderScore(item, fieldTextMap) {
    if (!item || typeof item !== 'object') return 0;
    var map = fieldTextMap && typeof fieldTextMap === 'object' ? fieldTextMap : {};
    var score = 0;
    var keywordFn = utils && typeof utils.buildMissingReminderKeywords === 'function'
      ? utils.buildMissingReminderKeywords
      : function(text) { return String(text || '').toLowerCase().split(/\s+/).filter(Boolean); };
    if (hasMissingReminderKeywordHit(map.title, keywordFn(item.title))) score += 1;
    if (hasMissingReminderKeywordHit(map.precondition, keywordFn(item.precondition))) score += 1;
    if (hasMissingReminderKeywordHit(map.steps, keywordFn(item.steps))) score += 1;
    if (hasMissingReminderKeywordHit(map.expected, keywordFn(item.expected))) score += 1;
    return score;
  }

  function resolveMissingReminderScoreLevel(score, fallback) {
    if (fallback) return String(fallback);
    var num = Number(score);
    if (!isFinite(num)) return '低';
    if (num >= 3) return '高';
    if (num >= 2) return '中';
    return '低';
  }

  function resolveMissingReminderLibraryEmpty(modules) {
    var list = Array.isArray(modules) ? modules : [];
    if (!list.length) return true;
    var hasCount = false;
    for (var i = 0; i < list.length; i += 1) {
      var item = list[i];
      if (!item) continue;
      if (item.item_count !== undefined && item.item_count !== null) {
        hasCount = true;
        var count = Number(item.item_count);
        if (isFinite(count) && count > 0) return false;
      }
    }
    if (!hasCount) return false;
    return true;
  }

  function getMissingReminderAiManager() {
    return window.app && window.app.missingReminderAi ? window.app.missingReminderAi : null;
  }

  function buildMissingReminderAiItemsFromTask(task) {
    var ids = task && Array.isArray(task.resultIds) ? task.resultIds : [];
    var itemMap = task && task.itemMap && typeof task.itemMap === 'object' ? task.itemMap : {};
    var selected = [];
    var seen = {};
    ids.forEach(function(id) {
      var key = String(id || '').trim();
      if (!key || seen[key]) return;
      seen[key] = true;
      var item = itemMap[key];
      if (item) selected.push(Object.assign({}, item));
    });
    return selected;
  }

  function applyMissingReminderAiTaskState(reminder, task) {
    if (!reminder || !task || task.scene !== 'case-library') return false;
    var signature = task.contextSignature ? String(task.contextSignature) : '';
    if (!signature) return false;
    syncMissingReminderAiContext(reminder);
    if (!reminder.aiContextSignature || reminder.aiContextSignature !== signature) return false;
    reminder.aiSignature = signature;
    reminder.aiProjectId = task.projectId || '';
    reminder.aiLoading = task.status === 'running';
    reminder.aiGenerated = task.status === 'done' || task.status === 'error';
    reminder.aiError = task.status === 'error' ? (task.error || '') : '';
    reminder.aiIds = Array.isArray(task.resultIds) ? task.resultIds.slice() : [];
    reminder.aiItems = buildMissingReminderAiItemsFromTask(task);
    if (Array.isArray(task.matchedModules)) reminder.matchedModules = task.matchedModules.slice();
    if (Array.isArray(task.matchedTypes)) reminder.matchedTypes = task.matchedTypes.slice();
    if (task.libraryEmpty !== undefined) {
      reminder.libraryEmpty = task.libraryEmpty === true;
      reminder.libraryChecked = true;
      reminder.libraryLoading = false;
      reminder.libraryProjectId = task.projectId || '';
    }
    return true;
  }

  function syncMissingReminderAiTaskState(reminder) {
    var manager = getMissingReminderAiManager();
    if (!manager || typeof manager.getTask !== 'function') return false;
    var task = manager.getTask('case-library');
    return applyMissingReminderAiTaskState(reminder, task);
  }

  function resetMissingReminderLibraryStatus(reminder) {
    var target = reminder || ensureMissingReminderState();
    target.libraryEmpty = false;
    target.libraryChecked = false;
    target.libraryLoading = false;
    target.libraryProjectId = '';
    target.librarySeq = (target.librarySeq || 0) + 1;
  }

  function showMissingReminderLibraryEmptyToast() {
    if (utils && typeof utils.showCenterToast === 'function') {
      utils.showCenterToast('易漏库没有任何用例，请点击上方“跳转到易漏用例库”进行添加。', 'warn', 3000);
    }
  }

  function checkMissingReminderLibraryStatus(reminder, projectId) {
    var target = reminder || ensureMissingReminderState();
    var pid = projectId ? String(projectId) : '';
    if (!pid) {
      resetMissingReminderLibraryStatus(target);
      return;
    }
    if (target.libraryChecked && target.libraryProjectId === pid) return;
    if (target.libraryLoading && target.libraryProjectId === pid) return;
    if (!apiClient || typeof apiClient.listMissingModules !== 'function') return;
    var seq = (target.librarySeq || 0) + 1;
    target.librarySeq = seq;
    target.libraryLoading = true;
    target.libraryProjectId = pid;
    apiClient.listMissingModules(pid)
      .then(function(modules) {
        if (target.librarySeq !== seq) return;
        target.libraryEmpty = resolveMissingReminderLibraryEmpty(modules);
        target.libraryChecked = true;
        target.libraryLoading = false;
        renderMissingReminder();
      })
      .catch(function() {
        if (target.librarySeq !== seq) return;
        target.libraryEmpty = false;
        target.libraryChecked = false;
        target.libraryLoading = false;
        renderMissingReminder();
      });
  }

  function hashReminderText(text) {
    var str = String(text || '');
    var hash = 0;
    for (var i = 0; i < str.length; i += 1) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash + ':' + str.length;
  }

  function buildMissingReminderSummary(reminder) {
    var modules = Array.isArray(reminder.matchedModules) ? reminder.matchedModules : [];
    var types = Array.isArray(reminder.matchedTypes) ? reminder.matchedTypes : [];
    var parts = [];
    if (modules.length) {
      var shownModules = modules.slice(0, 4);
      var text = shownModules.join('、');
      if (modules.length > shownModules.length) text += ' 等' + modules.length + '个';
      parts.push('模块：' + text);
    }
    if (types.length) {
      var shownTypes = types.slice(0, 4);
      var text2 = shownTypes.join('、');
      if (types.length > shownTypes.length) text2 += ' 等' + types.length + '个';
      parts.push('类型：' + text2);
    }
    return parts.join('；');
  }

  function resolveMissingReminderLimit(reminder) {
    var limit = reminder && reminder.limit !== undefined ? Number(reminder.limit) : 10;
    if (!isFinite(limit) || limit <= 0) return 10;
    return limit;
  }

  function buildMissingReminderTable(reminder) {
    var aiEnabled = resolveMissingReminderAiEnabled() === 'on';
    var contextSignature = reminder && reminder.aiContextSignature ? String(reminder.aiContextSignature) : '';
    var aiSignature = reminder && reminder.aiSignature ? String(reminder.aiSignature) : '';
    var aiActive = aiEnabled && contextSignature && aiSignature === contextSignature;
    var aiLoading = aiEnabled && aiActive && reminder && reminder.aiLoading === true;
    var aiGenerated = aiEnabled && aiActive && reminder && reminder.aiGenerated === true;
    var list = aiEnabled ? (aiGenerated ? (reminder.aiItems || []) : []) : (reminder && Array.isArray(reminder.items) ? reminder.items : []);
    var limit = resolveMissingReminderLimit(reminder);
    var display = list.slice(0, limit);
    var showScore = true;
    var cols = 8;
    var rows = display.map(function(item) {
      var moduleName = item && item.module_name ? String(item.module_name) : '--';
      var typeName = formatMissingItemTypeLabel(item);
      var title = item && item.title ? String(item.title) : '';
      var priority = item && item.priority ? String(item.priority) : '';
      var precondition = item && item.precondition ? String(item.precondition) : '';
      var steps = item && item.steps ? String(item.steps) : '';
      var expected = item && item.expected ? String(item.expected) : '';
      var score = item && item.match_score !== undefined ? Number(item.match_score) : 0;
      if (!isFinite(score) || score < 0) score = 0;
      var scoreText = String(score);
      if (aiEnabled) {
        scoreText = resolveMissingReminderScoreLevel(score, item && item.match_level ? item.match_level : '');
      }
      return (
        '<tr>' +
          (showScore ? ('<td class="score">' + escapeHtml(scoreText) + '</td>') : '') +
          '<td class="type">' + escapeHtml(typeName) + '</td>' +
          '<td class="module">' + escapeHtml(moduleName) + '</td>' +
          '<td class="title">' + escapeHtml(title) + '</td>' +
          '<td class="priority">' + escapeHtml(priority) + '</td>' +
          '<td>' + escapeHtml(precondition).replace(/\\n/g, '<br>') + '</td>' +
          '<td>' + escapeHtml(steps).replace(/\\n/g, '<br>') + '</td>' +
          '<td>' + escapeHtml(expected).replace(/\\n/g, '<br>') + '</td>' +
        '</tr>'
      );
    }).join('');
    if (!rows) {
      var hint = '暂无匹配易漏用例';
      if (aiEnabled) {
        if (reminder && reminder.libraryEmpty === true) {
          hint = '易漏库没有任何用例，请点击上方“跳转到易漏用例库”进行添加。';
        } else if (aiLoading) {
          hint = '正在生成 AI 推荐';
        } else if (reminder && reminder.aiError) {
          hint = reminder.aiError;
        } else if (!aiGenerated) {
          hint = '点击 AI 推荐生成易漏用例建议';
        }
      } else if (reminder && reminder.loading) {
        hint = '正在加载易漏用例...';
      } else if (reminder && reminder.pending) {
        hint = '滑动到此处加载易漏用例';
      }
      var hintClass = aiLoading ? 'hint missing-reminder-ai-loading' : 'hint';
      rows = '<tr><td colspan="' + cols + '"><p class="' + hintClass + '">' + escapeHtml(hint)
        + (aiLoading ? '<span class="missing-reminder-loading-dots"></span>' : '')
        + '</p></td></tr>';
    }
    var colGroup =
      '<colgroup>' +
        (showScore ? '<col class="col-score">' : '') +
        '<col class="col-type">' +
        '<col class="col-module">' +
        '<col class="col-title">' +
        '<col class="col-priority">' +
        '<col class="col-precondition">' +
        '<col class="col-steps">' +
        '<col class="col-expected">' +
      '</colgroup>';
    var aiButtonDisabled = aiEnabled && (!reminder || reminder.aiContextReady !== true || reminder.aiLoading === true) ? ' disabled' : '';
    var aiButtonHtml = aiEnabled
      ? '<button type="button" class="missing-reminder-ai-btn" data-missing-reminder-ai="1"' + aiButtonDisabled + '>AI推荐</button>'
      : '';
    var headerHtml =
      '<div class="missing-reminder-header">' +
        '<div class="missing-reminder-title-group">' +
          '<span class="missing-reminder-title">易漏用例参考</span>' +
          aiButtonHtml +
          '<button type="button" class="missing-reminder-link" data-missing-reminder-link="missing-library">跳转到易漏用例库</button>' +
        '</div>' +
        '<span class="missing-reminder-meta">' + escapeHtml(buildMissingReminderSummary(reminder || {})) + '</span>' +
      '</div>';
    return (
      headerHtml +
      '<div class="missing-reminder-table-head">' +
        '<div class="temp-case-view">' +
          '<table class="missing-reminder-table">' +
            colGroup +
            '<thead>' +
              '<tr>' +
                (showScore ? '<th class="score">匹配得分</th>' : '') +
                '<th class="type">类型</th>' +
                '<th class="module">模块</th>' +
                '<th class="title">用例标题</th>' +
                '<th class="priority">优先级</th>' +
                '<th>前提条件</th>' +
                '<th>操作步骤</th>' +
                '<th>预期结果</th>' +
              '</tr>' +
            '</thead>' +
          '</table>' +
        '</div>' +
      '</div>' +
      '<div class="missing-reminder-scroll">' +
        '<div class="temp-case-view">' +
          '<table class="missing-reminder-table">' +
            colGroup +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>'
    );
  }

  function cleanupMissingReminderObserver(reminder) {
    if (reminder.observer) {
      reminder.observer.disconnect();
      reminder.observer = null;
    }
    reminder.observerTarget = null;
    if (reminder.scrollHandler) {
      window.removeEventListener('scroll', reminder.scrollHandler);
      window.removeEventListener('resize', reminder.scrollHandler);
      reminder.scrollHandler = null;
    }
    if (reminder.scrollTimer) {
      clearTimeout(reminder.scrollTimer);
      reminder.scrollTimer = null;
    }
  }

  function isMissingReminderInView(target) {
    if (!target || !target.getBoundingClientRect) return false;
    var rect = target.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!vh) return false;
    return rect.bottom > 0 && rect.top < vh;
  }

  function resolveMissingReminderTarget() {
    var placement = resolveMissingReminderPlacement();
    return placement === 'bottom' ? dom.missingReminderBottom : dom.missingReminderTop;
  }

  function scheduleMissingReminderLazyLoad() {
    var reminder = ensureMissingReminderState();
    if (!reminder.hasMatch || reminder.loading || reminder.loaded || !reminder.pendingPayload) return;
    var target = resolveMissingReminderTarget();
    if (!target) return;
    if (isMissingReminderInView(target)) {
      loadMissingReminderItems();
      return;
    }
    if (reminder.observerTarget !== target) cleanupMissingReminderObserver(reminder);
    if (reminder.observer) return;
    if (typeof IntersectionObserver === 'function') {
      reminder.observerTarget = target;
      reminder.observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry && (entry.isIntersecting || entry.intersectionRatio > 0)) {
            loadMissingReminderItems();
          }
        });
      }, { root: null, rootMargin: '120px 0px', threshold: 0.01 });
      reminder.observer.observe(target);
      return;
    }
    reminder.observerTarget = target;
    if (!reminder.scrollHandler) {
      reminder.scrollHandler = function() {
        if (reminder.scrollTimer) clearTimeout(reminder.scrollTimer);
        reminder.scrollTimer = setTimeout(function() {
          reminder.scrollTimer = null;
          if (!reminder.loaded && !reminder.loading && reminder.pendingPayload) {
            if (isMissingReminderInView(reminder.observerTarget)) loadMissingReminderItems();
          }
        }, 120);
      };
      window.addEventListener('scroll', reminder.scrollHandler, { passive: true });
      window.addEventListener('resize', reminder.scrollHandler);
    }
  }

  function handleMissingReminderJump(e) {
    var target = e && e.target && e.target.closest ? e.target.closest('[data-missing-reminder-link]') : null;
    if (!target) return;
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    openMissingDrawer({ allowInactive: true, force: true });
  }

  function hasMissingReminderAiGenerated(reminder) {
    if (!reminder || reminder.aiGenerated !== true) return false;
    var contextSignature = reminder.aiContextSignature ? String(reminder.aiContextSignature) : '';
    var aiSignature = reminder.aiSignature ? String(reminder.aiSignature) : '';
    if (!contextSignature || !aiSignature) return false;
    return contextSignature === aiSignature;
  }

  function triggerMissingReminderAiRecommend() {
    var reminder = ensureMissingReminderState();
    if (resolveMissingReminderAiEnabled() !== 'on') return;
    if (reminder.aiLoading) return;
    var ready = syncMissingReminderAiContext(reminder);
    if (ready) {
      checkMissingReminderLibraryStatus(reminder, reminder.aiContextProjectId);
      if (reminder.libraryChecked === true && reminder.libraryEmpty === true) {
        showMissingReminderLibraryEmptyToast();
        return;
      }
    }
    if (hasMissingReminderAiGenerated(reminder)) {
      openConfirmDrawer({
        title: '重新生成 AI 推荐',
        message: '已有 AI 推荐结果，是否重新生成？',
        confirmText: '重新生成',
        cancelText: '取消',
      }).then(function(res) {
        if (!res || res.ok !== true) return;
        runMissingReminderAiRecommend({ trigger: 'confirm' });
      });
      return;
    }
    runMissingReminderAiRecommend({ trigger: 'button' });
  }

  function handleMissingReminderAction(e) {
    var target = e && e.target && e.target.closest
      ? e.target.closest('[data-missing-reminder-ai],[data-missing-reminder-link]')
      : null;
    if (!target) return;
    if (target.getAttribute('data-missing-reminder-ai')) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      if (target.disabled) return;
      triggerMissingReminderAiRecommend();
      return;
    }
    if (target.getAttribute('data-missing-reminder-link')) {
      handleMissingReminderJump(e);
    }
  }

  function renderMissingReminder() {
    var reminder = ensureMissingReminderState();
    var aiEnabled = resolveMissingReminderAiEnabled() === 'on';
    if (aiEnabled) {
      syncMissingReminderAiTaskState(reminder);
    }
    var placement = resolveMissingReminderPlacement();
    var top = dom.missingReminderTop;
    var bottom = dom.missingReminderBottom;
    var target = placement === 'bottom' ? bottom : top;
    var other = placement === 'bottom' ? top : bottom;
    if (other) {
      other.innerHTML = '';
      other.classList.add('hidden');
    }
    if (!target) return;
    if (aiEnabled) {
      var showAi = reminder.aiContextReady === true
        || (reminder.aiLoading === true && reminder.aiSignature)
        || (reminder.aiGenerated === true && reminder.aiSignature);
      if (!showAi) {
        target.innerHTML = '';
        target.classList.add('hidden');
        return;
      }
    } else if (!reminder.hasMatch && !reminder.loading && !reminder.pending) {
      target.innerHTML = '';
      target.classList.add('hidden');
      return;
    }
    target.innerHTML = buildMissingReminderTable(reminder);
    target.classList.remove('hidden');
    if (utils && typeof utils.bindMissingReminderScrollHint === 'function') {
      utils.bindMissingReminderScrollHint(target);
    }
    if (!aiEnabled) scheduleMissingReminderLazyLoad();
  }

  function clearMissingReminder() {
    var reminder = ensureMissingReminderState();
    reminder.items = [];
    reminder.matchedModules = [];
    reminder.matchedTypes = [];
    reminder.hasMatch = false;
    reminder.pending = false;
    reminder.pendingPayload = null;
    reminder.loading = false;
    reminder.loaded = false;
    reminder.signature = '';
    reminder.projectId = null;
    cleanupMissingReminderObserver(reminder);
    renderMissingReminder();
  }

  function clearMissingReminderAi(reminder, options) {
    var target = reminder || ensureMissingReminderState();
    target.aiItems = [];
    target.aiIds = [];
    target.aiLoading = false;
    target.aiGenerated = false;
    target.aiError = '';
    target.aiSignature = '';
    target.aiProjectId = '';
    target.aiSeq = (target.aiSeq || 0) + 1;
    resetMissingReminderLibraryStatus(target);
    var manager = getMissingReminderAiManager();
    if (manager && typeof manager.clearTask === 'function') {
      manager.clearTask('case-library');
    }
    if (!options || options.keepContext !== true) {
      target.aiContextSignature = '';
      target.aiContextProjectId = '';
      target.aiContextReady = false;
    }
  }

  function requestMissingReminderRefresh() {
    var reminder = ensureMissingReminderState();
    if (reminder.refreshTimer) clearTimeout(reminder.refreshTimer);
    reminder.refreshTimer = setTimeout(function() {
      reminder.refreshTimer = null;
      refreshMissingReminder();
    }, 160);
  }

  function syncMissingReminderAiContext(reminder) {
    var target = reminder || ensureMissingReminderState();
    if (!dom.editCard || dom.editCard.classList.contains('hidden')) {
      target.aiContextReady = false;
      target.aiContextSignature = '';
      target.aiContextProjectId = '';
      return false;
    }
    var file = state.editor.caseFile;
    var projectId = file && (file.project_id || file.project_id === 0) ? String(file.project_id) : '';
    var items = Array.isArray(state.editor.items) ? state.editor.items : [];
    if (!projectId || !items.length) {
      target.aiContextReady = false;
      target.aiContextSignature = '';
      target.aiContextProjectId = '';
      return false;
    }
    var context = buildMissingReminderCaseContext(items);
    if (!context.texts.length) {
      target.aiContextReady = false;
      target.aiContextSignature = '';
      target.aiContextProjectId = '';
      return false;
    }
    var signature = String(projectId) + ':' + hashReminderText(context.signatureText);
    target.aiContextSignature = signature;
    target.aiContextProjectId = projectId;
    target.aiContextReady = true;
    return true;
  }

  function refreshMissingReminder() {
    var reminder = ensureMissingReminderState();
    if (resolveMissingReminderAiEnabled() === 'on') {
      var ready = syncMissingReminderAiContext(reminder);
      if (ready) {
        checkMissingReminderLibraryStatus(reminder, reminder.aiContextProjectId);
      } else {
        resetMissingReminderLibraryStatus(reminder);
      }
      renderMissingReminder();
      return;
    }
    if (!dom.editCard || dom.editCard.classList.contains('hidden')) {
      clearMissingReminder();
      return;
    }
    var file = state.editor.caseFile;
    var projectId = file && (file.project_id || file.project_id === 0) ? String(file.project_id) : '';
    var items = Array.isArray(state.editor.items) ? state.editor.items : [];
    if (!projectId || !items.length) {
      clearMissingReminder();
      return;
    }
    var caseSearchFields = [
      'module', 'title', 'priority', 'precondition', 'preconditions', 'steps', 'expected', 'remark'
    ];
    var buildCaseText = function(item) {
      if (!item || typeof item !== 'object') return '';
      if (utils && typeof utils.buildCaseSearchText === 'function') {
        return utils.buildCaseSearchText([item], caseSearchFields);
      }
      var fallback = [];
      caseSearchFields.forEach(function(key) {
        if (!key) return;
        var val = (utils && typeof utils.stringifyCaseField === 'function')
          ? utils.stringifyCaseField(item[key])
          : String(item[key] || '');
        if (val) fallback.push(val);
      });
      return fallback.join(' ').toLowerCase();
    };
    var caseTexts = [];
    items.forEach(function(item) {
      var text = buildCaseText(item);
      if (text) caseTexts.push(text);
    });
    if (!caseTexts.length) {
      clearMissingReminder();
      return;
    }
    var matchConfig = resolveMissingReminderMatchConfig();
    var matchKey = (matchConfig.type ? 't' : '') + (matchConfig.module ? 'm' : '');
    var fieldTextMap = buildMissingReminderFieldTextMap(items);
    var signatureText = caseTexts.join('\n\n');
    var caseSearchText = caseTexts.join(' ');
    var signature = String(projectId) + ':' + hashReminderText(signatureText) + ':' + matchKey;
    if (reminder.signature === signature && reminder.projectId === projectId && (reminder.loaded || reminder.pending)) {
      renderMissingReminder();
      return;
    }
    reminder.signature = signature;
    reminder.projectId = projectId;
    reminder.items = [];
    reminder.matchedModules = [];
    reminder.matchedTypes = [];
    reminder.hasMatch = false;
    reminder.pending = false;
    reminder.pendingPayload = null;
    reminder.loading = false;
    reminder.loaded = false;
    cleanupMissingReminderObserver(reminder);
    if (!apiClient || typeof apiClient.listMissingModules !== 'function' || typeof apiClient.listMissingTypes !== 'function') {
      clearMissingReminder();
      return;
    }
    var seq = (reminder.seq || 0) + 1;
    reminder.seq = seq;
    Promise.all([apiClient.listMissingModules(projectId), apiClient.listMissingTypes(projectId)])
      .then(function(res) {
        if (reminder.seq !== seq) return null;
        var modules = Array.isArray(res && res[0]) ? res[0] : [];
        var types = Array.isArray(res && res[1]) ? res[1] : [];
        var requireModule = matchConfig.module === true;
        var requireType = matchConfig.type === true;
        var moduleMatches = [];
        var moduleIds = [];
        var allModuleIds = [];
        var matchedModuleMap = {};
        var moduleMap = {};
        modules.forEach(function(m) {
          if (!m || m.id === null || m.id === undefined) return;
          var name = m.name ? String(m.name).trim() : '';
          var idStr = String(m.id);
          moduleMap[idStr] = m;
          allModuleIds.push(idStr);
          if (name && caseSearchText.indexOf(name.toLowerCase()) !== -1) {
            moduleMatches.push(name);
            moduleIds.push(idStr);
            matchedModuleMap[idStr] = true;
          }
        });
        var typeMatches = [];
        var typeIds = [];
        var allTypeIds = [];
        var typeNameMap = {};
        var matchedTypeMap = {};
        types.forEach(function(t) {
          if (!t || t.id === null || t.id === undefined) return;
          var name = t.name ? String(t.name).trim() : '';
          var idStr = String(t.id);
          typeNameMap[idStr] = name || ('类型#' + idStr);
          allTypeIds.push(idStr);
          if (name && caseSearchText.indexOf(name.toLowerCase()) !== -1) {
            typeMatches.push(name);
            typeIds.push(idStr);
            matchedTypeMap[idStr] = true;
          }
        });
        if ((requireModule && !moduleIds.length) || (requireType && !typeIds.length) || (!allModuleIds.length)) {
          reminder.items = [];
          reminder.matchedModules = [];
          reminder.matchedTypes = [];
          reminder.hasMatch = false;
          reminder.pending = false;
          reminder.pendingPayload = null;
          reminder.loading = false;
          reminder.loaded = true;
          renderMissingReminder();
          return null;
        }
        if (!requireModule) moduleIds = allModuleIds.slice();
        if (!requireType) typeIds = allTypeIds.slice();
        reminder.matchedModules = moduleMatches;
        reminder.matchedTypes = typeMatches;
        reminder.hasMatch = true;
        reminder.pending = true;
        reminder.pendingPayload = {
          projectId: projectId,
          moduleIds: moduleIds,
          typeIds: typeIds,
          moduleMap: moduleMap,
          typeNameMap: typeNameMap,
          matchedModuleMap: matchedModuleMap,
          matchedTypeMap: matchedTypeMap,
          matchConfig: matchConfig,
          fieldTextMap: fieldTextMap,
        };
        reminder.loading = false;
        reminder.loaded = false;
        renderMissingReminder();
        return null;
      })
      .catch(function() {
        if (reminder.seq !== seq) return;
        reminder.items = [];
        reminder.matchedModules = [];
        reminder.matchedTypes = [];
        reminder.hasMatch = false;
        reminder.pending = false;
        reminder.pendingPayload = null;
        reminder.loading = false;
        reminder.loaded = false;
        cleanupMissingReminderObserver(reminder);
        renderMissingReminder();
      });
  }

  function loadMissingReminderItems() {
    var reminder = ensureMissingReminderState();
    if (!reminder.pendingPayload || reminder.loading || reminder.loaded) return;
    if (!apiClient || typeof apiClient.listMissingModules !== 'function' || typeof apiClient.listMissingModuleItems !== 'function') {
      clearMissingReminder();
      return;
    }
    var payload = reminder.pendingPayload || {};
    var moduleIds = Array.isArray(payload.moduleIds) ? payload.moduleIds.slice() : [];
    var typeIds = Array.isArray(payload.typeIds) ? payload.typeIds.slice() : [];
    var moduleMap = payload.moduleMap && typeof payload.moduleMap === 'object' ? payload.moduleMap : {};
    var typeNameMap = payload.typeNameMap && typeof payload.typeNameMap === 'object' ? payload.typeNameMap : {};
    var matchedModuleMap = payload.matchedModuleMap && typeof payload.matchedModuleMap === 'object' ? payload.matchedModuleMap : {};
    var matchedTypeMap = payload.matchedTypeMap && typeof payload.matchedTypeMap === 'object' ? payload.matchedTypeMap : {};
    var matchConfig = resolveMissingReminderMatchConfig(payload.matchConfig);
    var requireModule = matchConfig.module === true;
    var requireType = matchConfig.type === true;
    if (!moduleIds.length) {
      clearMissingReminder();
      return;
    }
    if (requireModule && !Object.keys(matchedModuleMap).length) {
      clearMissingReminder();
      return;
    }
    if (requireType && (!typeIds.length || !Object.keys(matchedTypeMap).length)) {
      clearMissingReminder();
      return;
    }
    reminder.pending = false;
    reminder.pendingPayload = null;
    reminder.loading = true;
    reminder.loaded = false;
    cleanupMissingReminderObserver(reminder);
    renderMissingReminder();
    var seq = (reminder.seq || 0) + 1;
    reminder.seq = seq;
    Promise.resolve([]).then(function() {
      if (reminder.seq !== seq) return null;
      var ids = moduleIds.slice();
      if (!ids.length) {
        reminder.items = [];
        reminder.loading = false;
        reminder.loaded = true;
        renderMissingReminder();
        return null;
      }
      var tasks = ids.map(function(id) {
        return apiClient
          .listMissingModuleItems(id)
          .then(function(list) {
            var rows = Array.isArray(list) ? list : [];
            return rows.map(function(it) {
              var clone = it && typeof it === 'object' ? Object.assign({}, it) : {};
              clone.module_id = id;
              clone.module_name = moduleMap[id] && moduleMap[id].name ? moduleMap[id].name : ('模块#' + id);
              var typeIds = normalizeMissingTypeIds(clone.type_ids);
              if (!typeIds.length && clone.type_id) {
                typeIds = normalizeMissingTypeIds([clone.type_id]);
              }
              var baseNames = resolveMissingItemTypeNames(
                typeIds,
                clone.type_names || (clone.type_name ? [clone.type_name] : [])
              );
              var resolvedNames = [];
              typeIds.forEach(function(typeId, idx) {
                var key = String(typeId);
                var name = typeNameMap[key] || baseNames[idx] || resolveMissingTypeLabel(typeId, null);
                resolvedNames.push(name);
              });
              clone.type_ids = typeIds;
              clone.type_names = resolvedNames;
              clone.type_name = resolvedNames.length ? resolvedNames.join('、') : '未分类';
              return clone;
            });
          })
          .catch(function() { return []; });
      });
      return Promise.all(tasks).then(function(all) {
        if (reminder.seq !== seq) return null;
        var combined = [];
        (all || []).forEach(function(rows) {
          (rows || []).forEach(function(row) {
            if (!row) return;
            var moduleHit = requireModule ? (row.module_id && matchedModuleMap[String(row.module_id)]) : true;
            var rowTypeIds = normalizeMissingTypeIds(row.type_ids);
            if (!rowTypeIds.length && row.type_id) {
              rowTypeIds = normalizeMissingTypeIds([row.type_id]);
            }
            var typeHit = true;
            if (requireType) {
              typeHit = false;
              for (var i = 0; i < rowTypeIds.length; i += 1) {
                if (matchedTypeMap[String(rowTypeIds[i])]) {
                  typeHit = true;
                  break;
                }
              }
            }
            if (moduleHit && typeHit) combined.push(row);
          });
        });
        if (!combined.length) {
          reminder.items = [];
          reminder.matchedModules = [];
          reminder.matchedTypes = [];
          reminder.hasMatch = false;
          reminder.loading = false;
          reminder.loaded = true;
          renderMissingReminder();
          return null;
        }
        var fieldTextMap = payload.fieldTextMap && typeof payload.fieldTextMap === 'object' ? payload.fieldTextMap : {};
        combined.forEach(function(item, idx) {
          item.match_score = buildMissingReminderScore(item, fieldTextMap);
          item.__score_index = idx;
        });
        combined.sort(function(a, b) {
          var sa = Number(a && a.match_score) || 0;
          var sb = Number(b && b.match_score) || 0;
          if (sa !== sb) return sb - sa;
          var ia = Number(a && a.__score_index) || 0;
          var ib = Number(b && b.__score_index) || 0;
          return ia - ib;
        });
        var limit = resolveMissingReminderLimit(reminder);
        reminder.items = combined.slice(0, limit);
        reminder.items.forEach(function(item) { try { delete item.__score_index; } catch (_) {} });
        reminder.loading = false;
        reminder.loaded = true;
        renderMissingReminder();
        return null;
      });
    }).catch(function() {
      if (reminder.seq !== seq) return;
      reminder.items = [];
      reminder.loading = false;
      reminder.loaded = false;
      renderMissingReminder();
    });
  }

  function buildMissingReminderAiCandidateSnapshot(items, fieldTextMap) {
    var map = {};
    var itemMap = {};
    var list = Array.isArray(items) ? items : [];
    list.forEach(function(item, idx) {
      if (!item) return;
      var score = buildMissingReminderScore(item, fieldTextMap);
      var level = resolveMissingReminderScoreLevel(score, '');
      var clone = item && typeof item === 'object' ? Object.assign({}, item) : {};
      clone.match_score = score;
      clone.match_level = level;
      var id = String(idx + 1);
      var moduleName = clone.module_name || clone.module || '';
      var typeName = formatMissingItemTypeLabel(clone);
      var stringify = utils && typeof utils.stringifyCaseField === 'function'
        ? utils.stringifyCaseField
        : function(val) { return String(val || '').trim(); };
      map[id] = {
        module: stringify(moduleName),
        type: stringify(typeName),
        title: stringify(item.title || ''),
        priority: stringify(item.priority || ''),
        precondition: stringify(item.precondition || ''),
        steps: stringify(item.steps || ''),
        expected: stringify(item.expected || ''),
        match_level: stringify(level),
      };
      itemMap[id] = clone;
    });
    return { map: map, itemMap: itemMap };
  }

  function parseMissingReminderAiIds(content) {
    var raw = content || '';
    var stripped = utils && typeof utils.stripCodeFence === 'function'
      ? utils.stripCodeFence(raw)
      : String(raw || '').trim();
    var payloadText = utils && typeof utils.extractJsonPayload === 'function'
      ? utils.extractJsonPayload(stripped)
      : '';
    var text = payloadText || stripped;
    var data = JSON.parse(text);
    var ids = data && Array.isArray(data.ids) ? data.ids : [];
    return ids.map(function(id) { return String(id).trim(); }).filter(Boolean);
  }

  function fetchMissingReminderAiCandidates(projectId, caseSearchText) {
    return Promise.all([apiClient.listMissingModules(projectId), apiClient.listMissingTypes(projectId)])
      .then(function(res) {
        var modules = Array.isArray(res && res[0]) ? res[0] : [];
        var types = Array.isArray(res && res[1]) ? res[1] : [];
        var moduleMatches = [];
        var moduleIds = [];
        var allModuleIds = [];
        var matchedModuleMap = {};
        var moduleMap = {};
        var libraryEmpty = resolveMissingReminderLibraryEmpty(modules);
        modules.forEach(function(m) {
          if (!m || m.id === null || m.id === undefined) return;
          var name = m.name ? String(m.name).trim() : '';
          var idStr = String(m.id);
          moduleMap[idStr] = m;
          allModuleIds.push(idStr);
          if (name && caseSearchText.indexOf(name.toLowerCase()) !== -1) {
            moduleMatches.push(name);
            moduleIds.push(idStr);
            matchedModuleMap[idStr] = true;
          }
        });
        var typeMatches = [];
        var typeNameMap = {};
        var matchedTypeMap = {};
        types.forEach(function(t) {
          if (!t || t.id === null || t.id === undefined) return;
          var name = t.name ? String(t.name).trim() : '';
          var idStr = String(t.id);
          typeNameMap[idStr] = name || ('类型#' + idStr);
          if (name && caseSearchText.indexOf(name.toLowerCase()) !== -1) {
            typeMatches.push(name);
            matchedTypeMap[idStr] = true;
          }
        });
        var hasModuleMatch = moduleIds.length > 0;
        var hasTypeMatch = Object.keys(matchedTypeMap).length > 0;
        if (!hasModuleMatch && !hasTypeMatch) {
          return {
            items: [],
            matchedModules: moduleMatches,
            matchedTypes: typeMatches,
            matchedModuleMap: matchedModuleMap,
            matchedTypeMap: matchedTypeMap,
            moduleMap: moduleMap,
            typeNameMap: typeNameMap,
            libraryEmpty: libraryEmpty,
          };
        }
        var loadModuleIds = hasTypeMatch ? allModuleIds.slice() : moduleIds.slice();
        if (!loadModuleIds.length) {
          return {
            items: [],
            matchedModules: moduleMatches,
            matchedTypes: typeMatches,
            matchedModuleMap: matchedModuleMap,
            matchedTypeMap: matchedTypeMap,
            moduleMap: moduleMap,
            typeNameMap: typeNameMap,
            libraryEmpty: libraryEmpty,
          };
        }
        var tasks = loadModuleIds.map(function(id) {
          return apiClient
            .listMissingModuleItems(id)
            .then(function(list) {
              var rows = Array.isArray(list) ? list : [];
              return rows.map(function(it) {
                var clone = it && typeof it === 'object' ? Object.assign({}, it) : {};
                clone.module_id = id;
                clone.module_name = moduleMap[id] && moduleMap[id].name ? moduleMap[id].name : ('模块#' + id);
                var typeIds = normalizeMissingTypeIds(clone.type_ids);
                if (!typeIds.length && clone.type_id) {
                  typeIds = normalizeMissingTypeIds([clone.type_id]);
                }
                var baseNames = resolveMissingItemTypeNames(
                  typeIds,
                  clone.type_names || (clone.type_name ? [clone.type_name] : [])
                );
                var resolvedNames = [];
                typeIds.forEach(function(typeId, idx) {
                  var key = String(typeId);
                  var name = typeNameMap[key] || baseNames[idx] || resolveMissingTypeLabel(typeId, null);
                  resolvedNames.push(name);
                });
                clone.type_ids = typeIds;
                clone.type_names = resolvedNames;
                clone.type_name = resolvedNames.length ? resolvedNames.join('、') : '未分类';
                return clone;
              });
            })
            .catch(function() { return []; });
        });
        return Promise.all(tasks).then(function(all) {
          var combined = [];
          (all || []).forEach(function(rows) {
            (rows || []).forEach(function(row) {
              if (!row) return;
              var moduleHit = row.module_id && matchedModuleMap[String(row.module_id)];
              var rowTypeIds = normalizeMissingTypeIds(row.type_ids);
              if (!rowTypeIds.length && row.type_id) {
                rowTypeIds = normalizeMissingTypeIds([row.type_id]);
              }
              var typeHit = false;
              for (var i = 0; i < rowTypeIds.length; i += 1) {
                if (matchedTypeMap[String(rowTypeIds[i])]) {
                  typeHit = true;
                  break;
                }
              }
              if (moduleHit || typeHit) combined.push(row);
            });
          });
          return {
            items: combined,
            matchedModules: moduleMatches,
            matchedTypes: typeMatches,
            matchedModuleMap: matchedModuleMap,
            matchedTypeMap: matchedTypeMap,
            moduleMap: moduleMap,
            typeNameMap: typeNameMap,
            libraryEmpty: libraryEmpty,
          };
        });
      });
  }

  function runMissingReminderAiRecommend(options) {
    var reminder = ensureMissingReminderState();
    if (reminder.aiLoading) return;
    var contextReady = syncMissingReminderAiContext(reminder);
    if (!contextReady) {
      reminder.aiError = '暂无可用于推荐的用例内容';
      reminder.aiGenerated = true;
      reminder.aiLoading = false;
      reminder.aiItems = [];
      reminder.aiIds = [];
      renderMissingReminder();
      return;
    }
    var projectId = reminder.aiContextProjectId;
    var signature = reminder.aiContextSignature;
    var items = Array.isArray(state.editor.items) ? state.editor.items : [];
    var context = buildMissingReminderCaseContext(items);
    var fieldTextMap = buildMissingReminderFieldTextMap(items);
    var caseSearchText = String(context.searchText || '').toLowerCase();
    var coreApi = getCore();
    if (!coreApi || typeof coreApi.callModelWithConfig !== 'function' || typeof coreApi.getAssignedModel !== 'function') {
      reminder.aiError = '模型客户端不可用，请刷新页面后重试';
      reminder.aiGenerated = true;
      reminder.aiLoading = false;
      reminder.aiItems = [];
      reminder.aiIds = [];
      renderMissingReminder();
      return;
    }
    var model;
    try {
      model = coreApi.getAssignedModel('missingreminder');
    } catch (err) {
      reminder.aiError = err && err.message ? err.message : '未找到易漏用例推荐模型';
      reminder.aiGenerated = true;
      reminder.aiLoading = false;
      reminder.aiItems = [];
      reminder.aiIds = [];
      renderMissingReminder();
      return;
    }
    reminder.aiLoading = true;
    reminder.aiGenerated = false;
    reminder.aiError = '';
    reminder.aiItems = [];
    reminder.aiIds = [];
    reminder.aiSignature = signature;
    reminder.aiProjectId = projectId;
    var seq = (reminder.aiSeq || 0) + 1;
    reminder.aiSeq = seq;
    renderMissingReminder();
    fetchMissingReminderAiCandidates(projectId, caseSearchText)
      .then(function(res) {
        if (reminder.aiSeq !== seq) return null;
        var candidates = res && Array.isArray(res.items) ? res.items : [];
        reminder.matchedModules = res && Array.isArray(res.matchedModules) ? res.matchedModules : [];
        reminder.matchedTypes = res && Array.isArray(res.matchedTypes) ? res.matchedTypes : [];
        if (res && res.libraryEmpty !== undefined) {
          reminder.libraryEmpty = res.libraryEmpty === true;
          reminder.libraryChecked = true;
          reminder.libraryLoading = false;
          reminder.libraryProjectId = projectId;
        }
        if (!candidates.length) {
          reminder.aiLoading = false;
          reminder.aiGenerated = true;
          reminder.aiItems = [];
          reminder.aiIds = [];
          if (reminder.libraryEmpty === true) {
            showMissingReminderLibraryEmptyToast();
          }
          renderMissingReminder();
          return null;
        }
        var snapshot = buildMissingReminderAiCandidateSnapshot(candidates, fieldTextMap);
        var prompt = (state.assignments && state.assignments.missingReminderPrompt)
          || (window.app && window.app.config && window.app.config.defaultPrompts
            ? window.app.config.defaultPrompts.missingreminder
            : '');
        var reasoning = state.assignments && state.assignments.missingReminderReasoning
          ? state.assignments.missingReminderReasoning
          : '';
        var temperature = state.assignments && state.assignments.missingReminderTemperature !== undefined
          ? state.assignments.missingReminderTemperature
          : 0.2;
        var userPayload = {
          current_cases: context.entries,
          candidate_map: snapshot.map,
        };
        var userText = JSON.stringify(userPayload, null, 2);
        var manager = getMissingReminderAiManager();
        if (manager && typeof manager.createTask === 'function' && typeof manager.startTask === 'function') {
          var task = manager.createTask('case-library', {
            contextSignature: signature,
            projectId: projectId,
            model: model,
            prompt: prompt,
            reasoning: reasoning,
            temperature: temperature,
            userText: userText,
            itemMap: snapshot.itemMap,
            matchedModules: reminder.matchedModules,
            matchedTypes: reminder.matchedTypes,
            libraryEmpty: reminder.libraryEmpty === true,
          });
          manager.startTask('case-library', task);
          return null;
        }
        return coreApi.callModelWithConfig(model, userText, prompt, reasoning, temperature)
          .then(function(content) {
            if (reminder.aiSeq !== seq) return null;
            var ids = parseMissingReminderAiIds(content);
            var seen = {};
            var selected = [];
            ids.forEach(function(id) {
              var key = String(id || '').trim();
              if (!key || seen[key]) return;
              seen[key] = true;
              var item = snapshot.itemMap[key];
              if (item) {
                var clone = Object.assign({}, item);
                selected.push(clone);
              }
            });
            reminder.aiItems = selected;
            reminder.aiIds = ids;
            reminder.aiLoading = false;
            reminder.aiGenerated = true;
            renderMissingReminder();
            return null;
          });
      })
      .catch(function(err) {
        if (reminder.aiSeq !== seq) return;
        reminder.aiLoading = false;
        reminder.aiGenerated = true;
        reminder.aiItems = [];
        reminder.aiIds = [];
        reminder.aiError = 'AI 推荐失败：' + (err && err.message ? err.message : err);
        renderMissingReminder();
      });
  }

  function ensureCaseLibraryAiGenState() {
    if (!state.aiGen || typeof state.aiGen !== 'object') {
      state.aiGen = {
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
        runToken: '',
        resultToken: '',
        readResultToken: '',
        hasUnreadResult: false,
      };
    }
    if (!state.aiGen.selection || !(state.aiGen.selection instanceof Set)) {
      state.aiGen.selection = new Set();
    }
    if (!Array.isArray(state.aiGen.modules)) state.aiGen.modules = [];
    return state.aiGen;
  }

  var caseLibraryAiGenBadgePersistKey = 'tap-case-library-ai-gen-badges';
  var caseLibraryAiGenAppendPersistKey = 'tap-case-library-ai-gen-appended';

  function readCaseLibraryAiGenBadgePersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(caseLibraryAiGenBadgePersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeCaseLibraryAiGenBadgePersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(caseLibraryAiGenBadgePersistKey);
        return;
      }
      localStorage.setItem(caseLibraryAiGenBadgePersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

  function ensureCaseLibraryAiGenBadgeState() {
    var userId = getCurrentUserId();
    var store = state.aiGenBadge;
    if (!userId) {
      if (store && store.files && typeof store.files === 'object') return store;
      var persisted = readCaseLibraryAiGenBadgePersistedState();
      if (persisted && persisted.files && typeof persisted.files === 'object') {
        state.aiGenBadge = persisted;
        return persisted;
      }
      if (!store || typeof store !== 'object') {
        store = { user_id: '', files: {}, updated_at: Date.now() };
      }
      state.aiGenBadge = store;
      if (!store.files || typeof store.files !== 'object') store.files = {};
      return store;
    }
    if (!store || String(store.user_id || '') !== String(userId || '')) {
      var persisted = readCaseLibraryAiGenBadgePersistedState();
      if (persisted && String(persisted.user_id || '') === String(userId || '')) {
        store = persisted;
      } else {
        store = { user_id: userId || '', files: {}, updated_at: Date.now() };
      }
      state.aiGenBadge = store;
    }
    if (!store.files || typeof store.files !== 'object') store.files = {};
    return store;
  }

  function readCaseLibraryAiGenAppendPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(caseLibraryAiGenAppendPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeCaseLibraryAiGenAppendPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(caseLibraryAiGenAppendPersistKey);
        return;
      }
      localStorage.setItem(caseLibraryAiGenAppendPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

  function ensureCaseLibraryAiGenAppendState() {
    var userId = getCurrentUserId();
    var store = state.aiGenAppend;
    if (!userId) {
      if (store && store.files && typeof store.files === 'object') return store;
      var persisted = readCaseLibraryAiGenAppendPersistedState();
      if (persisted && persisted.files && typeof persisted.files === 'object') {
        state.aiGenAppend = persisted;
        return persisted;
      }
      if (!store || typeof store !== 'object') {
        store = { user_id: '', files: {}, updated_at: Date.now() };
      }
      state.aiGenAppend = store;
      if (!store.files || typeof store.files !== 'object') store.files = {};
      return store;
    }
    if (!store || String(store.user_id || '') !== String(userId || '')) {
      var persistedUser = readCaseLibraryAiGenAppendPersistedState();
      if (persistedUser && String(persistedUser.user_id || '') === String(userId || '')) {
        store = persistedUser;
      } else {
        store = { user_id: userId || '', files: {}, updated_at: Date.now() };
      }
      state.aiGenAppend = store;
    }
    if (!store.files || typeof store.files !== 'object') store.files = {};
    return store;
  }

  function getCaseLibraryAiGenAppendRecord(fileId, create) {
    if (!fileId) return null;
    var store = ensureCaseLibraryAiGenAppendState();
    var key = String(fileId || '');
    var record = store.files ? store.files[key] : null;
    if (!record && create) {
      record = { token: '', appended: {}, updated_at: Date.now() };
      if (!store.files || typeof store.files !== 'object') store.files = {};
      store.files[key] = record;
      store.updated_at = Date.now();
      writeCaseLibraryAiGenAppendPersistedState(store);
    }
    if (record && (!record.appended || typeof record.appended !== 'object')) record.appended = {};
    return record;
  }

  function resetCaseLibraryAiGenAppendRecord(fileId, token) {
    if (!fileId || !token) return null;
    var store = ensureCaseLibraryAiGenAppendState();
    var key = String(fileId || '');
    var nextToken = String(token || '');
    var record = store.files ? store.files[key] : null;
    if (!record || String(record.token || '') !== nextToken) {
      record = { token: nextToken, appended: {}, updated_at: Date.now() };
      if (!store.files || typeof store.files !== 'object') store.files = {};
      store.files[key] = record;
      store.updated_at = Date.now();
      writeCaseLibraryAiGenAppendPersistedState(store);
      return record;
    }
    if (!record.appended || typeof record.appended !== 'object') record.appended = {};
    return record;
  }

  function getCaseLibraryAiGenAppendMap(fileId, token) {
    if (!fileId || !token) return {};
    var record = getCaseLibraryAiGenAppendRecord(fileId, false);
    if (!record || String(record.token || '') !== String(token || '')) return {};
    if (!record.appended || typeof record.appended !== 'object') record.appended = {};
    return record.appended;
  }

  function markCaseLibraryAiGenAppendKeys(fileId, token, keys) {
    if (!fileId || !token) return;
    var store = ensureCaseLibraryAiGenAppendState();
    var record = resetCaseLibraryAiGenAppendRecord(fileId, token);
    if (!record) return;
    var appended = record.appended || {};
    (Array.isArray(keys) ? keys : []).forEach(function(key) {
      if (!key) return;
      appended[key] = true;
    });
    record.appended = appended;
    record.updated_at = Date.now();
    store.updated_at = Date.now();
    writeCaseLibraryAiGenAppendPersistedState(store);
  }

  function getCaseLibraryAiGenBadgeRecord(fileId, create) {
    var store = ensureCaseLibraryAiGenBadgeState();
    var key = String(fileId || '');
    if (!store || !key) return null;
    var record = store.files && typeof store.files[key] === 'object' ? store.files[key] : null;
    if (!record && !create) return null;
    if (!record || typeof record !== 'object') record = {};
    if (typeof record.result_token !== 'string') record.result_token = record.result_token ? String(record.result_token) : '';
    if (typeof record.ai_read_token !== 'string') record.ai_read_token = record.ai_read_token ? String(record.ai_read_token) : '';
    if (typeof record.nav_read_token !== 'string') record.nav_read_token = record.nav_read_token ? String(record.nav_read_token) : '';
    if (typeof record.edit_read_token !== 'string') record.edit_read_token = record.edit_read_token ? String(record.edit_read_token) : '';
    if (create) store.files[key] = record;
    return record;
  }

  function getCaseLibraryAiGenBadgeRecordWithFallback(fileId, create) {
    var record = getCaseLibraryAiGenBadgeRecord(fileId, create);
    if (record || create) return record;
    var userId = getCurrentUserId();
    var persisted = readCaseLibraryAiGenBadgePersistedState();
    if (persisted && (String(persisted.user_id || '') === String(userId || '') || !userId)) {
      state.aiGenBadge = persisted;
      record = getCaseLibraryAiGenBadgeRecord(fileId, create);
    }
    return record;
  }

  function updateCaseLibraryAiGenBadgeRecord(fileId, updates) {
    var store = ensureCaseLibraryAiGenBadgeState();
    if (!store) return null;
    var record = getCaseLibraryAiGenBadgeRecord(fileId, true);
    if (!record) return null;
    if (updates && Object.prototype.hasOwnProperty.call(updates, 'result_token')) {
      record.result_token = updates.result_token ? String(updates.result_token) : '';
    }
    if (updates && Object.prototype.hasOwnProperty.call(updates, 'ai_read_token')) {
      record.ai_read_token = updates.ai_read_token ? String(updates.ai_read_token) : '';
    }
    if (updates && Object.prototype.hasOwnProperty.call(updates, 'nav_read_token')) {
      record.nav_read_token = updates.nav_read_token ? String(updates.nav_read_token) : '';
    }
    if (updates && Object.prototype.hasOwnProperty.call(updates, 'edit_read_token')) {
      record.edit_read_token = updates.edit_read_token ? String(updates.edit_read_token) : '';
    }
    record.updated_at = Date.now();
    store.updated_at = record.updated_at;
    writeCaseLibraryAiGenBadgePersistedState(store);
    return record;
  }

  function syncCaseLibraryAiGenBadgeForFile(fileId) {
    var ai = ensureCaseLibraryAiGenState();
    if (!fileId) return;
    var record = getCaseLibraryAiGenBadgeRecordWithFallback(fileId, false);
    if (!record) return;
    if (record.ai_read_token) ai.readResultToken = record.ai_read_token;
    if (!ai.resultToken && record.result_token) ai.resultToken = record.result_token;
    if (ai.resultToken) {
      ai.hasUnreadResult = ai.readResultToken !== ai.resultToken;
    } else {
      ai.hasUnreadResult = false;
    }
  }

  function hasCaseLibraryAiGenNavBadge() {
    var store = ensureCaseLibraryAiGenBadgeState();
    if (!store || !store.files) return false;
    var keys = Object.keys(store.files);
    for (var i = 0; i < keys.length; i += 1) {
      var record = store.files[keys[i]];
      if (!record || !record.result_token) continue;
      if (String(record.nav_read_token || '') !== String(record.result_token || '')) return true;
    }
    return false;
  }

  function syncCaseLibraryAiGenNavBadge() {
    if (!dom.editDrawerOpenBtn || !dom.editDrawerOpenBtn.classList) return;
    if (hasCaseLibraryAiGenNavBadge()) dom.editDrawerOpenBtn.classList.add('case-library-ai-gen-dot');
    else dom.editDrawerOpenBtn.classList.remove('case-library-ai-gen-dot');
  }

  function markCaseLibraryAiGenNavBadgeRead() {
    var store = ensureCaseLibraryAiGenBadgeState();
    if (!store || !store.files) return;
    var changed = false;
    Object.keys(store.files).forEach(function(key) {
      var record = store.files[key];
      if (!record || !record.result_token) return;
      var token = String(record.result_token || '');
      if (token && String(record.nav_read_token || '') !== token) {
        record.nav_read_token = token;
        record.updated_at = Date.now();
        changed = true;
      }
    });
    if (changed) {
      store.updated_at = Date.now();
      writeCaseLibraryAiGenBadgePersistedState(store);
    }
    syncCaseLibraryAiGenNavBadge();
  }

  function markCaseLibraryAiGenEditBadgeRead(fileId) {
    if (!fileId) return;
    var record = getCaseLibraryAiGenBadgeRecord(fileId, false);
    var token = record && record.result_token ? String(record.result_token) : '';
    if (!token) return;
    updateCaseLibraryAiGenBadgeRecord(fileId, { edit_read_token: token });
  }

  function shouldShowCaseLibraryAiGenEditBadge(fileId) {
    var record = getCaseLibraryAiGenBadgeRecord(fileId, false);
    if (!record || !record.result_token) return false;
    return String(record.edit_read_token || '') !== String(record.result_token || '');
  }

  function getCaseLibraryAiGenManager() {
    return window.app && window.app.caseLibraryAiGen ? window.app.caseLibraryAiGen : null;
  }

  function resolveCaseLibraryGenCoverageThreshold() {
    var globalState = window.app && window.app.state ? window.app.state : {};
    var settings = globalState && globalState.settings && typeof globalState.settings === 'object'
      ? globalState.settings
      : {};
    var raw = settings.caseLibraryGenCoverageThreshold;
    var num = Number(raw);
    if (!isFinite(num)) num = 90;
    if (num < 50) num = 50;
    if (num > 100) num = 100;
    return Math.round(num);
  }

  function buildCaseLibraryAiGenModuleList(items) {
    var list = Array.isArray(items) ? items : [];
    var output = [];
    var seen = {};
    list.forEach(function(item) {
      var name = normalizeEditorText(item && item.module ? item.module : '');
      if (!name) return;
      var key = name.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      output.push(name);
    });
    return output;
  }

  function buildCaseLibraryAiGenCasePayload(items) {
    var list = Array.isArray(items) ? items : [];
    return list.map(function(item) {
      var moduleName = normalizeEditorText(item && item.module ? item.module : '');
      var title = normalizeEditorText(item && item.title ? item.title : '');
      var priority = normalizePriorityInput(item && item.priority ? item.priority : '');
      var pre = normalizeEditorText(item && item.precondition ? item.precondition : '');
      var steps = normalizeEditorText(item && item.steps ? item.steps : '');
      var expected = normalizeEditorText(item && item.expected ? item.expected : '');
      var remark = normalizeEditorText(item && item.remark ? item.remark : '');
      return {
        module: moduleName,
        title: title,
        priority: priority || '',
        precondition: pre || '',
        steps: steps || '',
        expected: expected || '',
        remark: remark || '',
      };
    });
  }

  function buildCaseLibraryAiGenSignature(fileId, requirementText, moduleList) {
    var seed = String(fileId || '') + '|' + String(requirementText || '') + '|' + (moduleList || []).join('|');
    return hashReminderText(seed);
  }

  function normalizeAiGenText(value) {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
      return value.map(function(v) { return normalizeAiGenText(v); }).filter(Boolean).join('\n');
    }
    return normalizeEditorText(String(value || ''));
  }

  function normalizeAiGenCase(raw, moduleName) {
    var item = raw && typeof raw === 'object' ? raw : {};
    var moduleText = normalizeEditorText(item.module || '') || normalizeEditorText(moduleName || '');
    var title = normalizeEditorText(item.title || '');
    var priority = normalizePriorityInput(item.priority || '');
    var pre = normalizeAiGenText(item.precondition || item.preconditions || '');
    var steps = normalizeAiGenText(item.steps || '');
    var expected = normalizeEditorText(item.expected || '');
    var remark = normalizeEditorText(item.remark || '');
    if (!priority) priority = 'P1';
    if (!moduleText || !title || !expected) return null;
    return {
      module: moduleText,
      title: title,
      priority: priority,
      precondition: pre,
      steps: steps,
      expected: expected,
      remark: remark,
    };
  }

  function buildCaseLibraryAiGenExistingKeyMap(items) {
    var list = Array.isArray(items) ? items : [];
    var map = {};
    list.forEach(function(item) {
      var key = buildCaseItemKey(item);
      if (key) map[key] = true;
    });
    return map;
  }

  function parseCaseLibraryAiGenResult(raw, existingKeyMap) {
    var base = raw || '';
    var stripped = utils && typeof utils.stripCodeFence === 'function'
      ? utils.stripCodeFence(base)
      : String(base || '').trim();
    var payloadText = utils && typeof utils.extractJsonPayload === 'function'
      ? utils.extractJsonPayload(stripped)
      : '';
    var text = payloadText || stripped;
    var data = JSON.parse(text);
    if (!data || typeof data !== 'object') {
      return { error: '模型返回格式不正确' };
    }
    var missing = Array.isArray(data.missing_modules) ? data.missing_modules : null;
    var existing = Array.isArray(data.existing_modules) ? data.existing_modules : null;
    if (!missing || !existing) {
      return { error: '模型返回格式不正确：缺少 missing_modules/existing_modules' };
    }
    var modules = [];
    var seen = {};
    var existingMap = existingKeyMap || {};

    function pushModule(entry, type) {
      if (!entry || typeof entry !== 'object') return;
      var moduleName = normalizeEditorText(entry.module || entry.module_name || '');
      if (!moduleName) return;
      var coverage = Number(entry.coverage);
      if (!isFinite(coverage)) coverage = type === 'missing' ? 0 : 0;
      var cases = Array.isArray(entry.cases) ? entry.cases : [];
      var filtered = [];
      cases.forEach(function(rawCase) {
        var normalized = normalizeAiGenCase(rawCase, moduleName);
        if (!normalized) return;
        var key = buildCaseItemKey(normalized);
        if (key && (existingMap[key] || seen[key])) return;
        if (key) seen[key] = true;
        if (key) normalized.__aiCaseKey = key;
        normalized.__aiKey = 'ai-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
        filtered.push(normalized);
      });
      if (!filtered.length) return;
      modules.push({
        module: moduleName,
        coverage: coverage,
        missing: type === 'missing',
        cases: filtered,
      });
    }

    missing.forEach(function(entry) { pushModule(entry, 'missing'); });
    existing.forEach(function(entry) { pushModule(entry, 'existing'); });
    return { modules: modules };
  }

  function applyCaseLibraryAiGenAppendMap(modules, appendedMap) {
    var list = Array.isArray(modules) ? modules : [];
    var map = appendedMap && typeof appendedMap === 'object' ? appendedMap : {};
    list.forEach(function(mod) {
      var cases = Array.isArray(mod.cases) ? mod.cases : [];
      cases.forEach(function(item) {
        if (!item || typeof item !== 'object') return;
        var key = item.__aiCaseKey || buildCaseItemKey(item);
        if (key) item.__aiCaseKey = key;
        item.__aiAppended = Boolean(key && map[key]);
      });
    });
  }

  function renderCaseLibraryAiGenResult() {
    var ai = ensureCaseLibraryAiGenState();
    if (!dom.aiGenResult || !dom.aiGenResultBody) return;
    var modules = Array.isArray(ai.modules) ? ai.modules : [];
    var rows = [];
    var selection = ai.selection instanceof Set ? ai.selection : new Set();
    var totalCases = 0;
    var selectableCases = 0;
    modules.forEach(function(mod) {
      var list = Array.isArray(mod.cases) ? mod.cases : [];
      if (!list.length) return;
      totalCases += list.length;
      list.forEach(function(item, idx) {
        var appended = item && item.__aiAppended === true;
        if (!appended) selectableCases += 1;
        var checked = selection.has(item.__aiKey) && !appended ? 'checked' : '';
        if (appended && selection.has(item.__aiKey)) selection.delete(item.__aiKey);
        var appendedClass = appended ? ' ai-gen-appended-cell' : '';
        var appendedAttr = appended ? ' class="ai-gen-appended-cell"' : '';
        var appendedData = appended ? ' data-ai-appended="1"' : '';
        var disabledAttr = appended ? ' disabled' : '';
        var coverageText = mod.missing ? '缺失' : (isFinite(Number(mod.coverage)) ? String(Math.round(Number(mod.coverage))) + '%' : '--');
        var coverageCell = '';
        var moduleCell = '';
        if (idx === 0) {
          coverageCell = '<td class="coverage' + (mod.missing ? ' missing' : '') + '" rowspan="' + list.length + '">' + escapeHtml(coverageText) + '</td>';
          moduleCell = '<td class="module" rowspan="' + list.length + '">' + escapeHtml(mod.module) + '</td>';
        }
        rows.push(
          '<tr>' +
            '<td class="check' + appendedClass + '"><input type="checkbox" data-case-lib-ai-select="' + escapeHtml(item.__aiKey) + '"' + appendedData + disabledAttr + ' ' + checked + '></td>' +
            coverageCell +
            moduleCell +
            '<td' + appendedAttr + '>' + escapeHtml(item.title) + '</td>' +
            '<td' + appendedAttr + '>' + escapeHtml(item.priority || '') + '</td>' +
            '<td' + appendedAttr + '>' + escapeHtmlPreserve(item.precondition || '') + '</td>' +
            '<td' + appendedAttr + '>' + escapeHtmlPreserve(item.steps || '') + '</td>' +
            '<td' + appendedAttr + '>' + escapeHtmlPreserve(item.expected || '') + '</td>' +
          '</tr>'
        );
      });
    });
    if (!rows.length) {
      dom.aiGenResultBody.innerHTML = '<tr><td colspan="8"><p class="hint">暂无生成结果</p></td></tr>';
      if (dom.aiGenResult.classList) dom.aiGenResult.classList.add('hidden');
    } else {
      dom.aiGenResultBody.innerHTML = rows.join('');
      if (dom.aiGenResult.classList) dom.aiGenResult.classList.remove('hidden');
    }
    syncCaseLibraryAiGenSelectionHint(selectableCases);
  }

  function syncCaseLibraryAiGenSelectionHint(totalCount) {
    var ai = ensureCaseLibraryAiGenState();
    var selection = ai.selection instanceof Set ? ai.selection : new Set();
    var count = selection.size;
    var total = typeof totalCount === 'number' ? totalCount : getCaseLibraryAiGenTotalCount();
    if (dom.aiGenSelectionHint) {
      dom.aiGenSelectionHint.textContent = '已选 ' + count + (total ? (' / ' + total) : '') + ' 条';
    }
    if (dom.aiGenAppendBtn) dom.aiGenAppendBtn.disabled = !count;
    if (dom.aiGenSelectAllToggle) {
      dom.aiGenSelectAllToggle.checked = total > 0 && count === total;
    }
  }

  function syncCaseLibraryAiGenRunBtn() {
    if (!dom.aiGenRunBtn) return;
    var ai = ensureCaseLibraryAiGenState();
    var requirementText = dom.aiGenRequirementInput ? dom.aiGenRequirementInput.value : ai.requirementText;
    var hasRequirement = Boolean(normalizeEditorText(requirementText || ''));
    var reason = resolveCaseLibraryAiGenDisabledReason();
    dom.aiGenRunBtn.disabled = Boolean(ai.loading || !hasRequirement || reason);
  }

  function resolveCaseLibraryAiGenDisabledReason() {
    if (!state.editor || !state.editor.caseFile) return 'no-case';
    var coreApi = getCore();
    if (!coreApi || typeof coreApi.getAssignedModel !== 'function') return 'no-model';
    try {
      coreApi.getAssignedModel('caselibrarygen');
    } catch (err) {
      return 'no-model';
    }
    return '';
  }

  function resolveCaseLibraryAiGenResultToken(task) {
    if (task && task.id) return String(task.id);
    if (task && task.contextSignature) return String(task.contextSignature);
    var ai = ensureCaseLibraryAiGenState();
    if (ai && ai.runToken) return String(ai.runToken);
    if (ai && ai.taskSignature) return String(ai.taskSignature);
    return '';
  }

  function shouldAutoReadCaseLibraryAiGenBadge(fileId) {
    if (!fileId) return false;
    if (typeof isEditorCardVisible !== 'function' || !isEditorCardVisible()) return false;
    var currentId = state.editor && state.editor.caseFile ? state.editor.caseFile.id : null;
    if (!currentId) return false;
    return String(currentId) === String(fileId);
  }

  function markCaseLibraryAiGenResultReady(token, fileId) {
    var ai = ensureCaseLibraryAiGenState();
    var nextToken = token ? String(token) : '';
    if (!nextToken) return;
    var targetId = fileId || ai.caseFileId || (state.editor && state.editor.caseFile ? state.editor.caseFile.id : null);
    var updates = { result_token: nextToken };
    if (targetId && shouldAutoReadCaseLibraryAiGenBadge(targetId)) {
      updates.nav_read_token = nextToken;
      updates.edit_read_token = nextToken;
    }
    var record = targetId ? updateCaseLibraryAiGenBadgeRecord(targetId, updates) : null;
    var sameFile = targetId && ai.caseFileId && String(targetId) === String(ai.caseFileId);
    if (sameFile) {
      if (record && record.ai_read_token) ai.readResultToken = record.ai_read_token;
      ai.resultToken = nextToken;
      ai.hasUnreadResult = ai.readResultToken !== nextToken;
    }
    syncCaseLibraryAiGenButton();
    syncCaseLibraryAiGenNavBadge();
    if (editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) {
      renderEditDrawerList();
    }
  }

  function clearCaseLibraryAiGenResultBadge() {
    var ai = ensureCaseLibraryAiGenState();
    var targetId = ai.caseFileId || (state.editor && state.editor.caseFile ? state.editor.caseFile.id : null);
    var record = targetId ? getCaseLibraryAiGenBadgeRecordWithFallback(targetId, false) : null;
    var token = ai.resultToken || (record && record.result_token ? record.result_token : '');
    if (token) {
      ai.readResultToken = token;
      ai.resultToken = token;
    }
    if (targetId && token) {
      updateCaseLibraryAiGenBadgeRecord(targetId, { ai_read_token: token });
    }
    ai.hasUnreadResult = false;
    syncCaseLibraryAiGenButton();
  }

  function getCaseLibraryAiGenTotalCount() {
    var ai = ensureCaseLibraryAiGenState();
    var modules = Array.isArray(ai.modules) ? ai.modules : [];
    var total = 0;
    modules.forEach(function(mod) {
      var list = Array.isArray(mod.cases) ? mod.cases : [];
      list.forEach(function(item) {
        if (!item || item.__aiAppended === true) return;
        total += 1;
      });
    });
    return total;
  }

  function syncCaseLibraryAiGenButton() {
    if (!dom.aiGenBtn) return;
    var ai = ensureCaseLibraryAiGenState();
    var loading = ai.loading === true;
    var reason = resolveCaseLibraryAiGenDisabledReason();
    var targetId = ai.caseFileId || (state.editor && state.editor.caseFile ? state.editor.caseFile.id : null);
    var record = targetId ? getCaseLibraryAiGenBadgeRecordWithFallback(targetId, false) : null;
    var showBadge = false;
    if (!loading) {
      if (record && record.result_token) {
        showBadge = String(record.ai_read_token || '') !== String(record.result_token || '');
      } else if (ai.resultToken) {
        showBadge = ai.readResultToken !== ai.resultToken;
      } else {
        showBadge = ai.hasUnreadResult === true;
      }
    }
    ai.hasUnreadResult = showBadge;
    var label = loading ? '正在生成' : 'AI 用例生成';
    if (dom.aiGenBtn.textContent !== label) dom.aiGenBtn.textContent = label;
    dom.aiGenBtn.disabled = false;
    if (dom.aiGenBtn.removeAttribute) dom.aiGenBtn.removeAttribute('disabled');
    if (dom.aiGenBtn.classList) {
      var showBadgeFlag = ai.hasUnreadResult === true && !loading;
      if (reason) dom.aiGenBtn.classList.add('is-disabled');
      else dom.aiGenBtn.classList.remove('is-disabled');
      if (loading) dom.aiGenBtn.classList.add('loading');
      else dom.aiGenBtn.classList.remove('loading');
      if (showBadgeFlag) dom.aiGenBtn.classList.add('has-badge');
      else dom.aiGenBtn.classList.remove('has-badge');
    }
    dom.aiGenBtn.setAttribute('data-disabled-reason', reason || '');
    if (dom.xmindViewBtn) {
      var canOpen = Boolean(state.editor && state.editor.caseFile && Array.isArray(state.editor.items) && state.editor.items.length);
      var hasMindApi = Boolean(getMindElixirApi() && typeof getMindElixirApi().buildMindDataFromCases === 'function');
      dom.xmindViewBtn.disabled = !(canOpen && hasMindApi);
    }
  }

  function resetCaseLibraryAiGenState(options) {
    var ai = ensureCaseLibraryAiGenState();
    var keepRequirement = options && options.keepRequirement === true;
    ai.loading = false;
    ai.generated = false;
    ai.error = '';
    ai.modules = [];
    ai.selection = new Set();
    ai.taskSignature = '';
    ai.taskId = '';
    ai.runToken = '';
    ai.resultToken = '';
    ai.readResultToken = '';
    ai.hasUnreadResult = false;
    if (!keepRequirement) {
      ai.requirementText = '';
      ai.requirementFileName = '';
    }
    if (dom.aiGenRequirementInput && !keepRequirement) {
      dom.aiGenRequirementInput.value = '';
    }
    if (dom.aiGenFileName && !keepRequirement) {
      dom.aiGenFileName.textContent = '未选择文件';
    }
    if (dom.aiGenImportStatus && !keepRequirement) {
      setStatus(dom.aiGenImportStatus, '', '');
    }
    setStatus(dom.aiGenStatus, '', '');
    renderCaseLibraryAiGenResult();
    syncCaseLibraryAiGenRunBtn();
    syncCaseLibraryAiGenButton();
  }

  function applyCaseLibraryAiGenTaskState(task) {
    var ai = ensureCaseLibraryAiGenState();
    if (!task || task.scene !== 'case-library') return false;
    var fileId = state.editor && state.editor.caseFile ? String(state.editor.caseFile.id || '') : '';
    var taskFileId = task.caseFileId ? String(task.caseFileId) : '';
    if (!fileId || !taskFileId || taskFileId !== fileId) {
      if (task.status === 'done') {
        markCaseLibraryAiGenResultReady(resolveCaseLibraryAiGenResultToken(task), task.caseFileId);
      }
      syncCaseLibraryAiGenNavBadge();
      return false;
    }
    var signature = task.contextSignature ? String(task.contextSignature) : '';
    if (!signature) return false;
    ai.taskSignature = signature;
    ai.taskId = task.id || '';
    ai.caseFileId = task.caseFileId || ai.caseFileId;
    ai.loading = task.status === 'running';
    ai.generated = task.status === 'done';
    ai.error = task.status === 'error' ? (task.error || '') : '';
    if (task.requirementText && (!ai.requirementText || ai.taskSignature === signature)) {
      ai.requirementText = String(task.requirementText || '');
      if (dom.aiGenRequirementInput) dom.aiGenRequirementInput.value = ai.requirementText;
    }
    if (task.requirementFileName && (!ai.requirementFileName || ai.taskSignature === signature)) {
      ai.requirementFileName = String(task.requirementFileName || '');
      if (dom.aiGenFileName) dom.aiGenFileName.textContent = ai.requirementFileName || '未选择文件';
    }
    if (ai.loading) {
      setStatus(dom.aiGenStatus, '正在生成用例...', '');
      ai.modules = [];
      ai.selection = new Set();
      renderCaseLibraryAiGenResult();
      syncCaseLibraryAiGenRunBtn();
      syncCaseLibraryAiGenButton();
      return true;
    }
    if (ai.generated && task.resultRaw) {
      var existingMap = buildCaseLibraryAiGenExistingKeyMap(state.editor.items || []);
      var parsed = null;
      var resultToken = resolveCaseLibraryAiGenResultToken(task);
      if (resultToken) resetCaseLibraryAiGenAppendRecord(task.caseFileId, resultToken);
      try {
        parsed = parseCaseLibraryAiGenResult(task.resultRaw, existingMap);
      } catch (err) {
        parsed = { error: err && err.message ? err.message : '解析失败' };
      }
      if (parsed && parsed.error) {
        ai.error = parsed.error;
        setStatus(dom.aiGenStatus, '生成失败：' + parsed.error, 'err');
        ai.modules = [];
        ai.selection = new Set();
      } else {
        ai.modules = parsed && Array.isArray(parsed.modules) ? parsed.modules : [];
        ai.selection = new Set();
        setStatus(dom.aiGenStatus, ai.modules.length ? '生成完成' : '生成完成：未返回可追加用例', 'ok');
        if (resultToken) {
          applyCaseLibraryAiGenAppendMap(ai.modules, getCaseLibraryAiGenAppendMap(task.caseFileId, resultToken));
        }
        markCaseLibraryAiGenResultReady(resolveCaseLibraryAiGenResultToken(task), task.caseFileId);
      }
      renderCaseLibraryAiGenResult();
      syncCaseLibraryAiGenRunBtn();
      syncCaseLibraryAiGenButton();
      return true;
    }
    if (ai.error) {
      setStatus(dom.aiGenStatus, ai.error, 'err');
    }
    renderCaseLibraryAiGenResult();
    syncCaseLibraryAiGenRunBtn();
    syncCaseLibraryAiGenButton();
    return true;
  }

  function syncCaseLibraryAiGenTaskState() {
    var manager = getCaseLibraryAiGenManager();
    if (!manager || typeof manager.getTask !== 'function') return false;
    var currentId = state.editor && state.editor.caseFile ? state.editor.caseFile.id : null;
    if (currentId) syncCaseLibraryAiGenBadgeForFile(currentId);
    var task = manager.getTask('case-library');
    return applyCaseLibraryAiGenTaskState(task);
  }

  function syncCaseLibraryAiGenContext() {
    var ai = ensureCaseLibraryAiGenState();
    var fileId = state.editor && state.editor.caseFile ? state.editor.caseFile.id : null;
    if (!fileId) {
      resetCaseLibraryAiGenState();
      syncCaseLibraryAiGenButton();
      syncCaseLibraryAiGenRunBtn();
      syncCaseLibraryAiGenNavBadge();
      return;
    }
    if (ai.caseFileId && String(ai.caseFileId) !== String(fileId)) {
      resetCaseLibraryAiGenState();
    }
    ai.caseFileId = fileId;
    syncCaseLibraryAiGenBadgeForFile(fileId);
    syncCaseLibraryAiGenTaskState();
    syncCaseLibraryAiGenButton();
    syncCaseLibraryAiGenRunBtn();
    syncCaseLibraryAiGenNavBadge();
    if (dom.xmindViewBtn) {
      var hasMindApi = Boolean(getMindElixirApi() && typeof getMindElixirApi().buildMindDataFromCases === 'function');
      dom.xmindViewBtn.disabled = !(Array.isArray(state.editor.items) && state.editor.items.length && hasMindApi);
    }
  }

  function ensureCaseLibraryAiGenDrawer() {
    if (aiGenDrawerInstance) return aiGenDrawerInstance;
    aiGenDrawerInstance = ensureDrawer('caseLibraryAiGenDrawer', [], function() {
      syncCaseLibraryAiGenTaskState();
      renderCaseLibraryAiGenResult();
      syncCaseLibraryAiGenRunBtn();
      clearCaseLibraryAiGenResultBadge();
    });
    return aiGenDrawerInstance;
  }

  function openCaseLibraryAiGenDrawer() {
    var drawer = ensureCaseLibraryAiGenDrawer();
    if (drawer && typeof drawer.open === 'function') {
      drawer.open();
      return;
    }
    var el = dom.aiGenDrawer;
    if (!el || !el.classList) return;
    el.classList.add('open');
  }

  function hasNativeLabelTrigger(zone, input) {
    if (!zone || !input || !zone.tagName) return false;
    return zone.tagName.toLowerCase() === 'label' && zone.contains(input);
  }

  function createCaseLibraryAiGenDocxParser(JSZipCtor) {
    if (!JSZipCtor) return null;
    return async function parseDocx(file) {
      if (!file) throw new Error('未选择文件');
      var buffer = await file.arrayBuffer();
      var zip = await JSZipCtor.loadAsync(buffer);
      var docFile = zip.file('word/document.xml') || zip.file('word/document2.xml');
      if (!docFile) throw new Error('docx 内容缺失，未找到 word/document.xml');
      var xml = await docFile.async('string');
      var paragraphs = [];
      xml.replace(/<w:p[\s\S]*?<\/w:p>/g, function(para) {
        var pieces = [];
        para.replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, function(_, text) {
          pieces.push(text);
          return '';
        });
        var merged = pieces.join('');
        var decoded = decodeCaseLibraryAiGenXmlEntities(merged);
        var normalized = decoded.replace(/\s+/g, ' ').trim();
        if (normalized) paragraphs.push(normalized);
        return '';
      });
      if (!paragraphs.length) {
        var fallback = decodeCaseLibraryAiGenXmlEntities(xml.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
        if (fallback) paragraphs.push(fallback);
      }
      return paragraphs.join('\n\n');
    };
  }

  function decodeCaseLibraryAiGenXmlEntities(text) {
    if (!text) return '';
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  function handleCaseLibraryAiGenFile(file) {
    if (!file || !dom.aiGenRequirementInput) return;
    var ai = ensureCaseLibraryAiGenState();
    var name = file.name || '';
    if (dom.aiGenFileName) dom.aiGenFileName.textContent = name || '未选择文件';
    ai.requirementFileName = name || '';
    setStatus(dom.aiGenImportStatus, '正在读取文件...', '');
    var ext = name && name.split ? (name.split('.').pop() || '').toLowerCase() : '';
    var parseDocx = createCaseLibraryAiGenDocxParser(window.JSZip || null);
    var readPromise;
    if (ext === 'docx' && typeof parseDocx === 'function') {
      readPromise = parseDocx(file);
    } else {
      readPromise = file.text();
    }
    Promise.resolve(readPromise)
      .then(function(text) {
        var content = String(text || '');
        ai.requirementText = content;
        dom.aiGenRequirementInput.value = content;
        setStatus(dom.aiGenImportStatus, '文件读取完成', 'ok');
      })
      .catch(function(err) {
        setStatus(dom.aiGenImportStatus, '读取失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      })
      .finally(function() {
        syncCaseLibraryAiGenRunBtn();
      });
  }

  function clearCaseLibraryAiGenRequirement() {
    var ai = ensureCaseLibraryAiGenState();
    ai.requirementText = '';
    ai.requirementFileName = '';
    if (dom.aiGenRequirementInput) dom.aiGenRequirementInput.value = '';
    if (dom.aiGenFileName) dom.aiGenFileName.textContent = '未选择文件';
    if (dom.aiGenImportStatus) setStatus(dom.aiGenImportStatus, '', '');
    syncCaseLibraryAiGenRunBtn();
  }

  function runCaseLibraryAiGen() {
    var ai = ensureCaseLibraryAiGenState();
    if (ai.loading) return;
    var manager = getCaseLibraryAiGenManager();
    if (manager && typeof manager.getTask === 'function') {
      var activeTask = manager.getTask('case-library');
      if (activeTask && activeTask.status === 'running') {
        var activeFileId = activeTask.caseFileId ? String(activeTask.caseFileId) : '';
        var currentFileId = state.editor && state.editor.caseFile ? String(state.editor.caseFile.id || '') : '';
        var activeName = activeTask.caseFileName ? String(activeTask.caseFileName) : '';
        if (activeFileId && currentFileId && activeFileId !== currentFileId) {
          showCenterToast(activeName ? ('用例「' + activeName + '」正在生成，请等待完成后再生成。') : '已有用例正在生成，请等待完成后再生成。', 'warn', 4000);
          return;
        }
        if (activeFileId && currentFileId && activeFileId === currentFileId) {
          syncCaseLibraryAiGenTaskState();
          showCenterToast('当前用例正在生成，请稍候。', 'warn', 3000);
          return;
        }
      }
    }
    var reason = resolveCaseLibraryAiGenDisabledReason();
    if (reason === 'no-model') {
      showCenterToast('请到AI功能-功能指派 页面下，配置该功能模型。', 'warn', 5000);
      return;
    }
    if (reason === 'no-case') {
      showCenterToast('请先选择查看&编辑用例。', 'warn', 3000);
      return;
    }
    var requirementText = dom.aiGenRequirementInput ? dom.aiGenRequirementInput.value : ai.requirementText;
    requirementText = normalizeEditorText(requirementText || '');
    if (!requirementText) {
      setStatus(dom.aiGenStatus, '请先填写需求内容', 'warn');
      return;
    }
    var coreApi = getCore();
    if (!coreApi || typeof coreApi.callModelWithConfig !== 'function' || typeof coreApi.getAssignedModel !== 'function') {
      setStatus(dom.aiGenStatus, '模型客户端不可用，请刷新页面后重试', 'err');
      return;
    }
    var model;
    try {
      model = coreApi.getAssignedModel('caselibrarygen');
    } catch (err) {
      showCenterToast('请到AI功能-功能指派 页面下，配置该功能模型。', 'warn', 5000);
      return;
    }
    var moduleList = buildCaseLibraryAiGenModuleList(state.editor.items || []);
    var casePayload = buildCaseLibraryAiGenCasePayload(state.editor.items || []);
    var threshold = resolveCaseLibraryGenCoverageThreshold();
    var prompt = (state.assignments && state.assignments.caseLibraryGenPrompt)
      || (window.app && window.app.config && window.app.config.defaultPrompts
        ? window.app.config.defaultPrompts.caselibrarygen
        : '');
    var reasoning = state.assignments && state.assignments.caseLibraryGenReasoning
      ? state.assignments.caseLibraryGenReasoning
      : '';
    var temperature = state.assignments && state.assignments.caseLibraryGenTemperature !== undefined
      ? state.assignments.caseLibraryGenTemperature
      : 0.2;
    var userPayload = {
      requirement_text: requirementText,
      module_list: moduleList,
      existing_cases: casePayload,
      coverage_threshold: threshold,
    };
    var userText = JSON.stringify(userPayload, null, 2);
    var signature = buildCaseLibraryAiGenSignature(state.editor.caseFile.id, requirementText, moduleList);
    ai.runToken = 'local-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    ai.loading = true;
    ai.generated = false;
    ai.error = '';
    ai.modules = [];
    ai.selection = new Set();
    ai.taskSignature = signature;
    ai.caseFileId = state.editor.caseFile ? state.editor.caseFile.id : null;
    setStatus(dom.aiGenStatus, '正在生成用例...', '');
    renderCaseLibraryAiGenResult();
    syncCaseLibraryAiGenRunBtn();
    syncCaseLibraryAiGenButton();

    var manager = getCaseLibraryAiGenManager();
    if (manager && typeof manager.createTask === 'function' && typeof manager.startTask === 'function') {
      var task = manager.createTask('case-library', {
        contextSignature: signature,
        caseFileId: state.editor.caseFile ? state.editor.caseFile.id : null,
        caseFileName: state.editor.caseFile ? state.editor.caseFile.file_name_clean || '' : '',
        projectId: state.editor.caseFile ? state.editor.caseFile.project_id : null,
        versionId: state.editor.caseFile ? state.editor.caseFile.version_id : null,
        requirementText: requirementText,
        requirementFileName: ai.requirementFileName || '',
        moduleList: moduleList,
        coverageThreshold: threshold,
        model: model,
        prompt: prompt,
        reasoning: reasoning,
        temperature: temperature,
        userText: userText,
      });
      manager.startTask('case-library', task);
      applyCaseLibraryAiGenTaskState(task);
      return;
    }

    var genOk = false;
    var resultToken = ai.runToken;
    coreApi.callModelWithConfig(model, userText, prompt, reasoning, temperature)
      .then(function(content) {
        var existingMap = buildCaseLibraryAiGenExistingKeyMap(state.editor.items || []);
        if (resultToken) resetCaseLibraryAiGenAppendRecord(ai.caseFileId, resultToken);
        var parsed = parseCaseLibraryAiGenResult(content, existingMap);
        if (parsed && parsed.error) {
          ai.error = parsed.error;
          setStatus(dom.aiGenStatus, '生成失败：' + parsed.error, 'err');
          ai.modules = [];
        } else {
          ai.modules = parsed && Array.isArray(parsed.modules) ? parsed.modules : [];
          if (resultToken) applyCaseLibraryAiGenAppendMap(ai.modules, getCaseLibraryAiGenAppendMap(ai.caseFileId, resultToken));
          setStatus(dom.aiGenStatus, ai.modules.length ? '生成完成' : '生成完成：未返回可追加用例', 'ok');
          genOk = true;
        }
      })
      .catch(function(err) {
        ai.error = err && err.message ? err.message : '生成失败';
        setStatus(dom.aiGenStatus, '生成失败：' + ai.error, 'err');
      })
      .finally(function() {
        ai.loading = false;
        ai.generated = true;
        ai.selection = new Set();
        renderCaseLibraryAiGenResult();
        if (genOk) markCaseLibraryAiGenResultReady(resultToken, ai.caseFileId);
        syncCaseLibraryAiGenRunBtn();
        syncCaseLibraryAiGenButton();
      });
  }

  function selectAllCaseLibraryAiGenCases() {
    var ai = ensureCaseLibraryAiGenState();
    var modules = Array.isArray(ai.modules) ? ai.modules : [];
    var selection = new Set();
    var total = 0;
    modules.forEach(function(mod) {
      var list = Array.isArray(mod.cases) ? mod.cases : [];
      list.forEach(function(item) {
        if (!item || !item.__aiKey) return;
        if (item.__aiAppended === true) return;
        selection.add(item.__aiKey);
        total += 1;
      });
    });
    ai.selection = selection;
    renderCaseLibraryAiGenResult();
    syncCaseLibraryAiGenSelectionHint(total);
  }

  function clearCaseLibraryAiGenSelection() {
    var ai = ensureCaseLibraryAiGenState();
    ai.selection = new Set();
    renderCaseLibraryAiGenResult();
    syncCaseLibraryAiGenSelectionHint(0);
  }

  function appendCaseLibraryAiGenSelection(anchorEl) {
    var ai = ensureCaseLibraryAiGenState();
    var ed = state.editor;
    if (!ed || !ed.caseFile) {
      setStatus(dom.editStatus, '请先选择用例', 'warn');
      return;
    }
    if (ed.pendingOp) {
      setStatus(dom.editStatus, '当前有待确认的增删操作，请先撤回或等待入库', 'warn');
      return;
    }
    var selection = ai.selection instanceof Set ? ai.selection : new Set();
    if (!selection.size) return;
    var selectedCases = [];
    ai.modules.forEach(function(mod) {
      var list = Array.isArray(mod.cases) ? mod.cases : [];
      list.forEach(function(item) {
        if (item && item.__aiKey && selection.has(item.__aiKey) && item.__aiAppended !== true) {
          selectedCases.push(item);
        }
      });
    });
    if (!selectedCases.length) return;
    openConfirmDrawer({
      title: '确认追加用例',
      message: '确定追加已勾选的 ' + selectedCases.length + ' 条用例吗？',
      confirmText: '确认追加',
      cancelText: '取消',
      previousDrawer: aiGenDrawerInstance || null,
    }).then(function(res) {
      if (!res || res.ok !== true) return;
      var fileId = ed.caseFile ? ed.caseFile.id : null;
      var keys = [];
      var appendedKeys = [];
      var appendToken = ai.resultToken || ai.runToken || ai.taskSignature || '';
      selectedCases.forEach(function(item, idx) {
        var localId = 'local-ai-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6) + '-' + idx;
        var fresh = {
          __localId: localId,
          case_file_id: fileId,
          module: normalizeEditorText(item.module || ''),
          title: normalizeEditorText(item.title || ''),
          priority: normalizePriorityInput(item.priority || '') || 'P1',
          precondition: normalizeEditorText(item.precondition || ''),
          steps: normalizeEditorText(item.steps || ''),
          expected: normalizeEditorText(item.expected || '') || '待补充',
          remark: normalizeEditorText(item.remark || ''),
        };
        ensureNonEnumerableKey(fresh, '__uiKey', '');
        markCaseLibraryNewAdded(fileId, fresh);
        ed.items.push(fresh);
        keys.push(localId);
        var caseKey = item.__aiCaseKey || buildCaseItemKey(item);
        if (caseKey) {
          item.__aiCaseKey = caseKey;
          appendedKeys.push(caseKey);
        }
        item.__aiAppended = true;
      });
      if (appendToken && appendedKeys.length) {
        markCaseLibraryAiGenAppendKeys(fileId, appendToken, appendedKeys);
      }
      ed.items = reorderItemsByExistingModuleAppend(ed.items);
      ed.selection = new Set();
      ed.remarkOpen = new Set();
      ed.pendingOp = { type: 'insert_batch', itemKeys: keys, startIndex: ed.items.length - keys.length };
      ai.selection = new Set();
      renderEditorTable();
      renderCaseLibraryAiGenResult();
      syncCaseLibraryAiGenSelectionHint(0);
      var anchorRect = captureCaseLibraryAnchorRect(anchorEl);
      startPendingToast('已追加用例 ' + keys.length + ' 条，超时将自动入库', { anchorRect: anchorRect });
      showCenterToast('追加 ' + keys.length + '条 用例成功！', 'ok', 3000);
    });
  }

  function getMissingModuleNameById(moduleId) {
    var list = Array.isArray(state.missingView.modules) ? state.missingView.modules : [];
    for (var i = 0; i < list.length; i += 1) {
      var m = list[i];
      if (m && String(m.id) === String(moduleId)) return m.name || ('模块#' + m.id);
    }
    return '模块#' + moduleId;
  }

  function updateMissingViewMeta() {
    if (!dom.missingProject || !dom.missingModules) return;
    var projectId = state.missingView.projectId;
    var projectName = projectId ? (state.projectNameById[projectId] || ('项目#' + projectId)) : '--';
    dom.missingProject.textContent = projectName;
    var modules = Array.isArray(state.missingView.modules) ? state.missingView.modules : [];
    if (!modules.length) {
      dom.missingModules.textContent = '--';
      return;
    }
    var names = modules.map(function(m) { return m && m.name ? String(m.name) : ('模块#' + (m && m.id ? m.id : '')); });
    var display = names.slice(0, 6).join('、');
    if (names.length > 6) display += ' 等' + names.length + '个';
    dom.missingModules.textContent = display;
  }

  function buildMissingItemPayload(item) {
    var priority = normalizeEditorText(item && item.priority ? item.priority : '');
    priority = normalizePriorityInput(priority);
    var title = normalizeEditorText(item && item.title ? item.title : '');
    var typeIds = collectMissingItemTypeIds(item);
    return {
      title: title,
      priority: priority || null,
      precondition: normalizeEditorText(item && item.precondition ? item.precondition : ''),
      steps: normalizeEditorText(item && item.steps ? item.steps : ''),
      expected: normalizeEditorText(item && item.expected ? item.expected : ''),
      remark: normalizeEditorText(item && item.remark ? item.remark : '') || null,
      type_ids: typeIds,
    };
  }

  function validateMissingPayload(payload) {
    if (!payload) return '内容不能为空';
    if (!payload.title) return '用例标题不能为空';
    if (!payload.expected) return '预期结果不能为空';
    return '';
  }

  function ensureMissingAutoSaveState() {
    if (!state.missingView || typeof state.missingView !== 'object') return null;
    if (!state.missingView.autoSaveTimers || typeof state.missingView.autoSaveTimers !== 'object') {
      state.missingView.autoSaveTimers = {};
    }
    if (!state.missingView.autoSaveInFlight || typeof state.missingView.autoSaveInFlight !== 'object') {
      state.missingView.autoSaveInFlight = {};
    }
    return state.missingView;
  }

  function tryAutoSaveMissingItemAtIndex(index) {
    var mv = state.missingView;
    if (!mv || !mv.items) return;
    var idx = Number(index);
    if (!isFinite(idx) || idx < 0 || idx >= mv.items.length) return;
    var item = mv.items[idx];
    if (!item || !item.id) return;
    var payload = buildMissingItemPayload(item);
    var err = validateMissingPayload(payload);
    if (err) return;
    var idKey = String(item.id);
    var store = ensureMissingAutoSaveState();
    if (!store) return;
    if (store.autoSaveInFlight[idKey]) {
      store.autoSaveInFlight[idKey] = 'pending';
      return;
    }
    store.autoSaveInFlight[idKey] = true;
    apiClient.updateMissingModuleItem(item.id, payload).then(function(updated) {
      if (updated && typeof updated === 'object' && (updated.id || updated.id === 0)) {
        normalizeMissingItemTypeData(updated);
        mv.items[idx] = updated;
      }
    }).catch(function() {
      // auto-save failure is silent
    }).finally(function() {
      var stateVal = store.autoSaveInFlight[idKey];
      delete store.autoSaveInFlight[idKey];
      if (stateVal === 'pending') {
        store.autoSaveInFlight[idKey] = false;
        setTimeout(function() { tryAutoSaveMissingItemAtIndex(idx); }, 200);
      }
    });
  }

  function scheduleMissingAutoSave(index) {
    var mv = ensureMissingAutoSaveState();
    if (!mv) return;
    var key = String(index);
    if (mv.autoSaveTimers[key]) {
      clearTimeout(mv.autoSaveTimers[key]);
    }
    mv.autoSaveTimers[key] = setTimeout(function() {
      delete mv.autoSaveTimers[key];
      tryAutoSaveMissingItemAtIndex(index);
    }, 800);
  }

  function syncMissingRowInputToItem(index, item, options) {
    if (!dom.missingView || !dom.missingView.querySelector) return false;
    if (!item) return false;
    var idx = Number(index);
    if (!isFinite(idx)) return false;
    var opts = options || {};
    var skipEmptyRequired = opts.skipEmptyRequired === true;
    var fields = [
      { key: 'title', multiline: false, required: true },
      { key: 'priority', multiline: false },
      { key: 'precondition', multiline: true },
      { key: 'steps', multiline: true },
      { key: 'expected', multiline: true, required: true },
    ];
    var changed = false;
    fields.forEach(function(meta) {
      var cell = dom.missingView.querySelector('[data-case-lib-missing-field=\"' + meta.key + '\"][data-index=\"' + idx + '\"]');
      if (!cell) return;
      var raw = meta.multiline ? cell.innerText : cell.textContent;
      var next = normalizeEditorText(raw);
      if (meta.key === 'priority') {
        var normalized = normalizePriorityInput(next);
        if (normalized !== next) next = normalized;
      }
      if (skipEmptyRequired && meta.required && !next) return;
      if (item[meta.key] !== next) {
        item[meta.key] = next;
        changed = true;
      }
    });
    return changed;
  }

  function buildMissingPagination(total, pageIndex, totalPages, start, end) {
    total = Number(total) || 0;
    pageIndex = Number(pageIndex) || 0;
    totalPages = Number(totalPages) || 1;
    start = Number(start) || 0;
    end = Number(end) || 0;
    var currentPage = totalPages ? pageIndex + 1 : 1;
    var maxPage = totalPages || 1;
    var rangeInfo = total ? ('显示 ' + (start + 1) + '-' + end + ' / 共 ' + total + ' 条') : '暂无记录';
    return (
      '<div class=\"temp-pagination\" data-case-lib-missing-pagination=\"1\">' +
        '<div class=\"temp-pagination-info\">' + escapeHtml(rangeInfo) + '，每页 ' + getPageSize() + ' 条</div>' +
        '<div class=\"temp-pagination-controls\">' +
          '<button type=\"button\" class=\"secondary\" data-case-lib-missing-page=\"prev\" ' + (pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
          '<span>第 ' + currentPage + ' / ' + maxPage + ' 页</span>' +
          '<button type=\"button\" class=\"secondary\" data-case-lib-missing-page=\"next\" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
          '<label>跳至' +
            '<input type=\"number\" min=\"1\" max=\"' + maxPage + '\" value=\"' + Math.min(currentPage, maxPage) + '\" data-case-lib-missing-page-input>' +
            '页' +
          '</label>' +
        '</div>' +
      '</div>'
    );
  }

  function resolveMissingTypeLabel(typeId, fallback) {
    if (typeId === null || typeId === undefined || typeId === '') return '未分类';
    var name = getMissingTypeNameById(typeId);
    if (name) return name;
    if (fallback) return fallback;
    return '类型#' + typeId;
  }

  function buildMissingTypeSelectOptions(list, activeId) {
    var active = activeId ? String(activeId) : '';
    var options = [];
    var emptySelected = active ? '' : ' selected';
    if (!list.length) {
      options.push('<option value=\"\"' + emptySelected + '>暂无类型</option>');
    } else {
      options.push('<option value=\"\"' + emptySelected + '>未设置</option>');
    }
    var hasActive = false;
    list.forEach(function(t) {
      if (!t || t.id === null || t.id === undefined) return;
      var idStr = String(t.id);
      var selected = active && idStr === active ? ' selected' : '';
      if (selected) hasActive = true;
      options.push('<option value=\"' + escapeHtml(idStr) + '\"' + selected + '>' + escapeHtml(t.name || ('类型#' + t.id)) + '</option>');
    });
    if (active && !hasActive) {
      options.push('<option value=\"' + escapeHtml(active) + '\" selected>类型#' + escapeHtml(active) + '</option>');
    }
    options.push('<option value=\"__add_type__\">＋ 新增类型</option>');
    return options.join('');
  }

  function buildMissingTypeSelectContent(item, index) {
    var list = Array.isArray(state.missingType.types) ? state.missingType.types : [];
    var slots = ensureMissingItemTypeSlots(item);
    var rows = slots.map(function(activeId, slotIndex) {
      var options = buildMissingTypeSelectOptions(list, activeId);
      return (
        '<div class=\"case-library-missing-type-row\">' +
          '<select class=\"case-library-missing-type-select\" data-case-lib-missing-type data-index=\"' + index + '\" data-type-index=\"' + slotIndex + '\">' +
            options +
          '</select>' +
          '<button type=\"button\" class=\"case-library-missing-type-remove\" data-case-lib-missing-type-remove data-index=\"' + index + '\" data-type-index=\"' + slotIndex + '\">×</button>' +
        '</div>'
      );
    }).join('');
    var canAdd = slots.length < 3;
    var addBtn = canAdd
      ? '<button type=\"button\" class=\"case-library-missing-type-add\" data-case-lib-missing-type-add data-index=\"' + index + '\">＋ 新增</button>'
      : '';
    return (
      '<div class=\"case-library-missing-type-group\">' +
        rows +
        addBtn +
      '</div>'
    );
  }

  function buildMissingTypeSelectCell(item, index) {
    return (
      '<td class=\"type\" data-case-lib-missing-type-cell=\"' + index + '\">' +
        buildMissingTypeSelectContent(item, index) +
      '</td>'
    );
  }

  function renderMissingTypePills(items) {
    if (!dom.missingTypePills) return;
    var list = Array.isArray(items) ? items : [];
    if (!list.length) {
      dom.missingTypePills.innerHTML = '';
      return;
    }
    var counts = {};
    list.forEach(function(item) {
      if (!item) return;
      var typeIds = normalizeMissingTypeIds(item.type_ids);
      if (!typeIds.length && item.type_id) {
        typeIds = normalizeMissingTypeIds([item.type_id]);
      }
      var typeNames = resolveMissingItemTypeNames(
        typeIds,
        item.type_names || (item.type_name ? [item.type_name] : [])
      );
      if (!typeIds.length) {
        var keyNone = 'none';
        if (!counts[keyNone]) {
          counts[keyNone] = {
            key: keyNone,
            label: resolveMissingTypeLabel(null, null),
            count: 0,
          };
        }
        counts[keyNone].count += 1;
        return;
      }
      typeIds.forEach(function(typeId, idx) {
        var key = String(typeId);
        if (!counts[key]) {
          counts[key] = {
            key: key,
            label: resolveMissingTypeLabel(typeId, typeNames[idx]),
            count: 0,
          };
        }
        counts[key].count += 1;
      });
    });
    var typeList = Array.isArray(state.missingType.types) ? state.missingType.types : [];
    var pills = [];
    typeList.forEach(function(t) {
      if (!t || t.id === null || t.id === undefined) return;
      var key = String(t.id);
      if (!counts[key]) return;
      pills.push(counts[key]);
      delete counts[key];
    });
    Object.keys(counts).forEach(function(key) {
      pills.push(counts[key]);
    });
    if (!pills.length) {
      dom.missingTypePills.innerHTML = '';
      return;
    }
    var filters = state.missingView.typeFilters instanceof Set ? state.missingView.typeFilters : new Set();
    state.missingView.typeFilters = filters;
    dom.missingTypePills.innerHTML = pills.map(function(pill) {
      var active = filters.size && filters.has(String(pill.key)) ? ' active' : '';
      return (
        '<button type=\"button\" class=\"summary-pill case-library-missing-type-pill' + active + '\" ' +
          'data-case-lib-missing-type-pill=\"' + escapeHtml(String(pill.key)) + '\">' +
          escapeHtml(pill.label) + ' ' + pill.count +
        '</button>'
      );
    }).join('');
  }

  function getMissingViewFilteredIndexes(items) {
    var list = Array.isArray(items) ? items : [];
    var filters = state.missingView.typeFilters instanceof Set ? state.missingView.typeFilters : new Set();
    state.missingView.typeFilters = filters;
    if (!filters.size) {
      var all = [];
      for (var i = 0; i < list.length; i += 1) all.push(i);
      return all;
    }
    var result = [];
    list.forEach(function(item, idx) {
      if (!item) return;
      var typeIds = normalizeMissingTypeIds(item.type_ids);
      if (!typeIds.length && item.type_id) {
        typeIds = normalizeMissingTypeIds([item.type_id]);
      }
      if (!typeIds.length) {
        if (filters.has('none')) result.push(idx);
        return;
      }
      for (var i = 0; i < typeIds.length; i += 1) {
        if (filters.has(String(typeIds[i]))) {
          result.push(idx);
          return;
        }
      }
    });
    return result;
  }

  function renderMissingViewTable() {
    if (!dom.missingView) return;
    var mv = state.missingView;
    var modules = Array.isArray(mv.modules) ? mv.modules : [];
    if (!modules.length) {
      dom.missingView.innerHTML = '<p class=\"hint\">请先选择模块查看易漏用例</p>';
      if (dom.missingTypePills) dom.missingTypePills.innerHTML = '';
      syncMissingBatchDeleteControls();
      return;
    }
    var items = Array.isArray(mv.items) ? mv.items : [];
    renderMissingTypePills(items);
    var filteredIndexes = getMissingViewFilteredIndexes(items);
    var total = filteredIndexes.length;
    var pageSize = getPageSize();
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    if (mv.pageIndex >= totalPages) mv.pageIndex = Math.max(totalPages - 1, 0);
    if (mv.pageIndex < 0) mv.pageIndex = 0;
    var start = mv.pageIndex * pageSize;
    var end = Math.min(total, start + pageSize);
    var pagedIndexes = filteredIndexes.slice(start, end);
    var visibleIndexes = [];
    mv.selection = mv.selection instanceof Set ? mv.selection : new Set();
    var rows = pagedIndexes.map(function(idx) {
      var item = items[idx];
      visibleIndexes.push(idx);
      var moduleName = item && (item.module_name || getMissingModuleNameById(item.module_id));
      var titleText = stripInvisibleMarkers(item && item.title ? item.title : '');
      var priorityText = stripInvisibleMarkers(item && item.priority ? item.priority : '');
      priorityText = normalizePriorityInput(priorityText);
      var preText = stripInvisibleMarkers(item && item.precondition ? item.precondition : '');
      var stepsText = stripInvisibleMarkers(item && item.steps ? item.steps : '');
      var expectedText = stripInvisibleMarkers(item && item.expected ? item.expected : '');
      var titleHtml = titleText ? escapeHtml(titleText) : '';
      var priorityHtml = priorityText ? escapeHtml(priorityText) : '';
      var preHtml = preText ? escapeHtml(preText).replace(/\n/g, '<br>') : '';
      var stepsHtml = stepsText ? escapeHtml(stepsText).replace(/\n/g, '<br>') : '';
      var expectedHtml = expectedText ? escapeHtml(expectedText).replace(/\n/g, '<br>') : '';
      var rowClass = 'case-row' + (isMissingNewAdded(item && item.module_id ? item.module_id : null, item) ? ' new-added' : '');
      return (
        '<tr class=\"' + rowClass + '\">' +
          '<td class=\"check\"><input type=\"checkbox\" data-case-lib-missing-select data-index=\"' + idx + '\" ' + (mv.selection.has(idx) ? 'checked' : '') + '></td>' +
          '<td class=\"index\">' + (idx + 1) + '</td>' +
          buildMissingTypeSelectCell(item, idx) +
          '<td class=\"module\">' + escapeHtml(moduleName || '--') + '</td>' +
          '<td class=\"title\"><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-missing-field=\"title\" data-index=\"' + idx + '\" data-case-lib-missing-multiline=\"false\" data-placeholder=\"点击此处编辑\">' + titleHtml + '</div></td>' +
          '<td class=\"priority\"><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-missing-field=\"priority\" data-index=\"' + idx + '\" data-case-lib-missing-multiline=\"false\" data-placeholder=\"点击此处编辑\">' + priorityHtml + '</div></td>' +
          '<td><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-missing-field=\"precondition\" data-index=\"' + idx + '\" data-case-lib-missing-multiline=\"true\" data-placeholder=\"点击此处编辑\">' + preHtml + '</div></td>' +
          '<td><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-missing-field=\"steps\" data-index=\"' + idx + '\" data-case-lib-missing-multiline=\"true\" data-placeholder=\"点击此处编辑\">' + stepsHtml + '</div></td>' +
          '<td><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-missing-field=\"expected\" data-index=\"' + idx + '\" data-case-lib-missing-multiline=\"true\" data-placeholder=\"点击此处编辑\">' + expectedHtml + '</div></td>' +
          '<td class=\"ops\">' +
            '<div class=\"case-ops\">' +
              '<button type=\"button\" class=\"case-op remove\" title=\"删除当前条目\" data-case-lib-missing-remove data-index=\"' + idx + '\">−</button>' +
              '<button type=\"button\" class=\"case-op add\" title=\"在下方插入条目\" data-case-lib-missing-insert data-index=\"' + idx + '\">＋</button>' +
            '</div>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    var allVisibleSelected = visibleIndexes.length && visibleIndexes.every(function(idx) { return mv.selection.has(idx); });
    var headerCheckbox = (
      '<th class=\"check\"><input type=\"checkbox\" data-case-lib-missing-select-all data-visible=\"' + visibleIndexes.join(',') + '\" ' +
      (visibleIndexes.length ? (allVisibleSelected ? 'checked' : '') : 'disabled') + '></th>'
    );
    var emptyRow = '';
    if (!total) {
      if (items.length) {
        emptyRow = '<tr class=\"case-row case-library-missing-empty\"><td colspan=\"10\"><p class=\"hint\">暂无匹配类型</p></td></tr>';
      } else {
        emptyRow = '<tr class=\"case-row case-library-missing-empty\"><td colspan=\"10\"><button type=\"button\" class=\"secondary\" data-case-lib-missing-empty-add>＋ 新增条目</button></td></tr>';
      }
    }
    var paginationTop = buildMissingPagination(total, mv.pageIndex, totalPages, start, end);
    var paginationBottom = buildMissingPagination(total, mv.pageIndex, totalPages, start, end);
    dom.missingView.innerHTML = (
      paginationTop +
      '<table>' +
        '<thead>' +
          '<tr>' +
            headerCheckbox +
            '<th class=\"index\">编号</th>' +
            '<th class=\"type\">类型</th>' +
            '<th class=\"module\">模块</th>' +
            '<th class=\"title\">用例标题</th>' +
            '<th class=\"priority\">优先级</th>' +
            '<th>前提条件</th>' +
            '<th>操作步骤</th>' +
            '<th>预期结果</th>' +
            '<th class=\"ops\" title=\"增删\">增删</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + (rows || emptyRow) + '</tbody>' +
      '</table>' +
      paginationBottom
    );
    syncMissingBatchDeleteControls();
  }

  function toggleMissingViewTypeFilter(key) {
    if (!state.missingView) return;
    var filters = state.missingView.typeFilters instanceof Set ? state.missingView.typeFilters : new Set();
    state.missingView.typeFilters = filters;
    var id = String(key || '');
    if (!id) return;
    if (filters.has(id)) filters.delete(id);
    else filters.add(id);
    state.missingView.selection = new Set();
    state.missingView.pageIndex = 0;
    renderMissingViewTable();
  }

  function refreshMissingTypeCell(index) {
    if (!dom.missingView || !dom.missingView.querySelector) return;
    var cell = dom.missingView.querySelector('td[data-case-lib-missing-type-cell=\"' + index + '\"]');
    if (!cell) return;
    var item = state.missingView.items[index];
    if (!item) return;
    cell.innerHTML = buildMissingTypeSelectContent(item, index);
  }

  function refreshMissingTypeCells() {
    if (!dom.missingView || !dom.missingView.querySelectorAll) return;
    var cells = dom.missingView.querySelectorAll('td[data-case-lib-missing-type-cell]');
    for (var i = 0; i < cells.length; i += 1) {
      var cell = cells[i];
      var idx = Number(cell.getAttribute('data-case-lib-missing-type-cell'));
      if (!isFinite(idx)) continue;
      var item = state.missingView.items[idx];
      if (!item) continue;
      cell.innerHTML = buildMissingTypeSelectContent(item, idx);
    }
  }

  function hasDuplicateMissingType(slots, slotIndex, typeId) {
    if (!typeId || !Array.isArray(slots)) return false;
    var key = String(typeId);
    for (var i = 0; i < slots.length; i += 1) {
      if (i === slotIndex) continue;
      var existing = normalizeMissingTypeId(slots[i]);
      if (existing && String(existing) === key) return true;
    }
    return false;
  }

  function syncMissingItemTypeUpdate(index, prevSlots) {
    var mv = state.missingView;
    if (!mv || !Array.isArray(mv.items)) return;
    var idx = Number(index);
    if (!isFinite(idx) || idx < 0 || idx >= mv.items.length) return;
    var item = mv.items[idx];
    if (!item) return;
    var emptyCount = 0;
    if (Array.isArray(item.type_ids)) {
      for (var i = 0; i < item.type_ids.length; i += 1) {
        if (!normalizeMissingTypeId(item.type_ids[i])) emptyCount += 1;
      }
    }
    var hasFilter = mv.typeFilters && mv.typeFilters.size;
    if (hasFilter) renderMissingViewTable();
    else {
      refreshMissingTypeCell(idx);
      renderMissingTypePills(mv.items);
    }
    if (!item.id || !apiClient || typeof apiClient.updateMissingModuleItem !== 'function') return;
    var payload = { type_ids: collectMissingItemTypeIds(item) };
    apiClient.updateMissingModuleItem(item.id, payload).then(function(updated) {
      if (updated && typeof updated === 'object' && (updated.id || updated.id === 0)) {
        normalizeMissingItemTypeData(updated);
        if (emptyCount > 0) {
          var slots = ensureMissingItemTypeSlots(updated).slice();
          var selectedCount = collectMissingItemTypeIds(updated).length;
          var maxSlots = selectedCount ? 3 : Math.max(1, Math.min(3, emptyCount));
          while (emptyCount > 0 && slots.length < maxSlots) {
            slots.push('');
            emptyCount -= 1;
          }
          updated.type_ids = slots;
        }
        if (!updated.module_name) updated.module_name = item.module_name;
        mv.items[idx] = updated;
        if (hasFilter) renderMissingViewTable();
        else {
          refreshMissingTypeCell(idx);
          renderMissingTypePills(mv.items);
        }
      }
    }).catch(function(err) {
      if (Array.isArray(prevSlots)) item.type_ids = prevSlots.slice();
      if (hasFilter) renderMissingViewTable();
      else {
        refreshMissingTypeCell(idx);
        renderMissingTypePills(mv.items);
      }
      setStatus(dom.missingStatus, err && err.message ? err.message : '更新类型失败', 'err');
    });
  }

  function handleMissingItemTypeChange(index, slotIndex, nextValue) {
    var mv = state.missingView;
    if (!mv || !Array.isArray(mv.items)) return;
    var idx = Number(index);
    var slotIdx = Number(slotIndex);
    if (!isFinite(idx) || idx < 0 || idx >= mv.items.length) return;
    if (!isFinite(slotIdx) || slotIdx < 0) return;
    var item = mv.items[idx];
    if (!item) return;
    var slots = ensureMissingItemTypeSlots(item);
    var prevSlots = slots.slice();
    if (slotIdx >= slots.length) return;
    if (String(nextValue) === '__add_type__') {
      openMissingTypeAddDrawer('view');
      refreshMissingTypeCell(idx);
      return;
    }
    var nextTypeId = normalizeMissingTypeId(nextValue);
    if (nextTypeId && hasDuplicateMissingType(slots, slotIdx, nextTypeId)) {
      showCenterToast('已选相同类型', 'warn', 3000);
      refreshMissingTypeCell(idx);
      return;
    }
    slots[slotIdx] = nextTypeId ? String(nextTypeId) : '';
    item.type_ids = slots;
    syncMissingItemTypeUpdate(idx, prevSlots);
  }

  function addMissingTypeSlot(index) {
    var mv = state.missingView;
    if (!mv || !Array.isArray(mv.items)) return;
    var idx = Number(index);
    if (!isFinite(idx) || idx < 0 || idx >= mv.items.length) return;
    var item = mv.items[idx];
    if (!item) return;
    var slots = ensureMissingItemTypeSlots(item);
    if (slots.length >= 3) return;
    slots.push('');
    item.type_ids = slots;
    refreshMissingTypeCell(idx);
  }

  function removeMissingTypeSlot(index, slotIndex, anchorEl) {
    var mv = state.missingView;
    if (!mv || !Array.isArray(mv.items)) return;
    var idx = Number(index);
    var slotIdx = Number(slotIndex);
    if (!isFinite(idx) || idx < 0 || idx >= mv.items.length) return;
    if (!isFinite(slotIdx) || slotIdx < 0) return;
    var item = mv.items[idx];
    if (!item) return;
    var slots = ensureMissingItemTypeSlots(item);
    if (slotIdx >= slots.length) return;
    if (slots.length <= 1) {
      showCenterToast('至少要保留1个类型', 'warn', 3000);
      return;
    }
    var typeLabel = resolveMissingTypeLabel(slots[slotIdx], null);
    openConfirmDrawer({
      title: '确认删除类型',
      message: '确认删除类型【' + typeLabel + '】吗？',
      confirmText: '确认删除',
      cancelText: '取消',
      danger: true,
      anchorEl: anchorEl || null,
    }).then(function(res) {
      if (!res || res.ok !== true) return;
      var prevSlots = slots.slice();
      slots.splice(slotIdx, 1);
      if (!slots.length) slots = [''];
      item.type_ids = slots;
      syncMissingItemTypeUpdate(idx, prevSlots);
    });
  }

  function handleMissingPaginationAction(action) {
    var total = getMissingViewFilteredIndexes(state.missingView.items).length;
    var totalPages = total ? Math.ceil(total / getPageSize()) : 1;
    if (action === 'prev') state.missingView.pageIndex = Math.max(0, state.missingView.pageIndex - 1);
    if (action === 'next') state.missingView.pageIndex = Math.min(totalPages - 1, state.missingView.pageIndex + 1);
    renderMissingViewTable();
  }

  function handleMissingPaginationJump(page) {
    var total = getMissingViewFilteredIndexes(state.missingView.items).length;
    var totalPages = total ? Math.ceil(total / getPageSize()) : 1;
    var target = Math.max(1, Math.min(Number(page) || 1, totalPages));
    state.missingView.pageIndex = Math.max(0, target - 1);
    renderMissingViewTable();
  }

  function syncMissingBatchDeleteControls() {
    if (!dom.missingBatchDeleteBtn) return;
    var mv = state.missingView;
    var selected = mv && mv.selection && typeof mv.selection.size === 'number' ? mv.selection.size : 0;
    var disabled = !mv || !mv.modules || !mv.modules.length || !selected || Boolean(mv.pendingOp);
    var label = '批量删除';
    if (selected) label += '（' + selected + '）';
    dom.missingBatchDeleteBtn.textContent = label;
    dom.missingBatchDeleteBtn.disabled = disabled;
  }

  function cleanupMissingPendingToast() {
    var mv = state.missingView;
    if (mv.pendingTimer) {
      clearTimeout(mv.pendingTimer);
      mv.pendingTimer = null;
    }
    if (mv.pendingInterval) {
      clearInterval(mv.pendingInterval);
      mv.pendingInterval = null;
    }
    if (mv.pendingToast && mv.pendingToast.parentNode) {
      mv.pendingToast.parentNode.removeChild(mv.pendingToast);
    }
    mv.pendingToast = null;
    mv.pendingRemaining = 0;
  }

  function clearMissingPendingOp() {
    cleanupMissingPendingToast();
    state.missingView.pendingOp = null;
    syncMissingBatchDeleteControls();
  }

  function startMissingPendingToast(message, options) {
    options = options || {};
    var anchorRect = options.anchorRect || null;
    cleanupMissingPendingToast();
    var mv = state.missingView;
    mv.pendingRemaining = 8;
    var toast = document.createElement('div');
    toast.className = 'temp-undo-toast';
    var text = document.createElement('span');
    var btn = document.createElement('button');
    btn.className = 'pill secondary';
    btn.textContent = '撤回';
    function renderCountdown() {
      text.textContent = (message || '已暂存变更') + '（' + mv.pendingRemaining + 's）';
    }
    var handleUndoClick = function() {
      var op = mv.pendingOp;
      if (!op) return;
      if (op.type === 'remove' && op.item) {
        var insertAt = Math.min(Math.max(op.index, 0), mv.items.length);
        mv.items.splice(insertAt, 0, op.item);
      } else if (op.type === 'remove_batch' && Array.isArray(op.removed)) {
        var list = op.removed
          .filter(function(r) { return r && r.item; })
          .slice()
          .sort(function(a, b) { return Number(a.index) - Number(b.index); });
        list.forEach(function(r) {
          var idx = Math.max(0, Math.min(Number(r.index), mv.items.length));
          mv.items.splice(idx, 0, r.item);
        });
      } else if (op.type === 'insert' && op.itemKey) {
        var idx2 = mv.items.findIndex(function(it) { return it && it.__localId === op.itemKey; });
        if (idx2 !== -1) mv.items.splice(idx2, 1);
      }
      mv.selection = new Set();
      clearMissingPendingOp();
      setStatus(dom.missingStatus, '已撤回增删操作（未入库）', 'ok');
      renderMissingViewTable();
    };
    btn.addEventListener('click', handleUndoClick);
    toast.appendChild(text);
    toast.appendChild(btn);
    document.body.appendChild(toast);
    mv.pendingToast = toast;
    renderCountdown();
    mv.pendingInterval = setInterval(function() {
      mv.pendingRemaining -= 1;
      if (mv.pendingRemaining <= 0) {
        clearInterval(mv.pendingInterval);
        mv.pendingInterval = null;
        commitMissingPendingOp();
        return;
      }
      renderCountdown();
    }, 1000);
  }

  function saveMissingItemAtIndex(index, reason) {
    var mv = state.missingView;
    var idx = Number(index);
    if (!mv || !mv.items) return;
    if (!isFinite(idx) || idx < 0 || idx >= mv.items.length) return;
    var item = mv.items[idx];
    if (!item || !item.id) return;
    var payload = buildMissingItemPayload(item);
    var err = validateMissingPayload(payload);
    if (err) {
      setStatus(dom.missingStatus, err, 'warn');
      return;
    }
    setStatus(dom.missingStatus, (reason || '保存中') + '...', '');
    apiClient.updateMissingModuleItem(item.id, payload).then(function(updated) {
      if (updated && typeof updated === 'object' && (updated.id || updated.id === 0)) {
        normalizeMissingItemTypeData(updated);
        mv.items[idx] = updated;
      }
      setStatus(dom.missingStatus, '已保存', 'ok');
      renderMissingViewTable();
    }).catch(function(e) {
      setStatus(dom.missingStatus, e && e.message ? e.message : '保存失败', 'err');
    });
  }

  function commitMissingPendingOp() {
    var mv = state.missingView;
    var op = mv.pendingOp;
    if (!op) return;
    cleanupMissingPendingToast();
    setStatus(dom.missingStatus, '增删入库中...', '');
    if (op.type === 'remove' && op.item && op.item.id) {
      if (!apiClient || typeof apiClient.deleteMissingModuleItem !== 'function') {
        clearMissingPendingOp();
        return;
      }
      apiClient.deleteMissingModuleItem(op.item.id).then(function() {
        setStatus(dom.missingStatus, '删除已入库', 'ok');
      }).catch(function(e) {
        setStatus(dom.missingStatus, e && e.message ? e.message : '删除入库失败', 'err');
      }).finally(function() {
        clearMissingPendingOp();
      });
      return;
    }

    if (op.type === 'remove_batch' && Array.isArray(op.removed)) {
      if (!apiClient || typeof apiClient.deleteMissingModuleItem !== 'function') {
        clearMissingPendingOp();
        return;
      }
      var removed = op.removed.slice();
      var toDelete = [];
      var seen = {};
      removed.forEach(function(r) {
        var item = r && r.item ? r.item : null;
        if (!item || !item.id) return;
        var id = String(item.id);
        if (seen[id]) return;
        seen[id] = true;
        toDelete.push({ id: item.id, index: r.index, item: item });
      });

      if (!toDelete.length) {
        mv.pendingOp = null;
        setStatus(dom.missingStatus, '批量删除已撤回或无需入库', 'warn');
        renderMissingViewTable();
        return;
      }

      function settle(p) {
        return Promise.resolve(p).then(
          function(v) { return { status: 'fulfilled', value: v }; },
          function(err) { return { status: 'rejected', reason: err }; }
        );
      }

      var promises = toDelete.map(function(entry) {
        return settle(apiClient.deleteMissingModuleItem(entry.id, { batch: true }));
      });

      Promise.all(promises).then(function(results) {
        var failures = [];
        for (var i = 0; i < results.length; i += 1) {
          if (results[i] && results[i].status === 'rejected') failures.push(toDelete[i]);
        }
        if (!failures.length) {
          setStatus(dom.missingStatus, '批量删除已入库（' + toDelete.length + '条）', 'ok');
          return;
        }
        failures
          .slice()
          .sort(function(a, b) { return Number(a.index) - Number(b.index); })
          .forEach(function(entry) {
            var idx = Math.max(0, Math.min(Number(entry.index), mv.items.length));
            mv.items.splice(idx, 0, entry.item);
          });
        renderMissingViewTable();
        setStatus(
          dom.missingStatus,
          '批量删除部分失败：成功 ' + (toDelete.length - failures.length) + ' 条，失败 ' + failures.length + ' 条',
          'warn'
        );
      }).catch(function(e) {
        setStatus(dom.missingStatus, e && e.message ? e.message : '批量删除入库失败', 'err');
      }).finally(function() {
        clearMissingPendingOp();
      });
      return;
    }

    if (op.type === 'insert' && op.itemKey) {
      var createIndex = mv.items.findIndex(function(it) { return it && it.__localId === op.itemKey; });
      if (createIndex === -1) {
        clearMissingPendingOp();
        setStatus(dom.missingStatus, '新增条目已撤回或不存在', 'warn');
        return;
      }
      var newItem = mv.items[createIndex];
      syncMissingRowInputToItem(createIndex, newItem, { skipEmptyRequired: true });
      var uiKey = getMissingItemUiKey(newItem);
      var payload = buildMissingItemPayload(newItem);
      var err2 = validateMissingPayload(payload);
      if (err2) {
        clearMissingPendingOp();
        setStatus(dom.missingStatus, '新增条目未入库：' + err2, 'warn');
        return;
      }
      var moduleId = newItem && newItem.module_id ? newItem.module_id : null;
      if (!moduleId || !apiClient || typeof apiClient.createMissingModuleItem !== 'function') {
        clearMissingPendingOp();
        setStatus(dom.missingStatus, '新增条目未入库：模块缺失', 'warn');
        return;
      }
      apiClient.createMissingModuleItem(moduleId, payload).then(function(created) {
        if (created) {
          normalizeMissingItemTypeData(created);
          ensureNonEnumerableKey(created, '__uiKey', uiKey || '');
          mv.items[createIndex] = created;
          markMissingNewAdded(moduleId, created);
        }
        setStatus(dom.missingStatus, '新增已入库', 'ok');
        renderMissingViewTable();
      }).catch(function(e) {
        setStatus(dom.missingStatus, e && e.message ? e.message : '新增入库失败', 'err');
      }).finally(function() {
        clearMissingPendingOp();
      });
      return;
    }
    clearMissingPendingOp();
    setStatus(dom.missingStatus, '变更已应用', 'ok');
  }

  function insertMissingItem(index, anchorEl) {
    var mv = state.missingView;
    if (mv.pendingOp) {
      setStatus(dom.missingStatus, '当前有待确认的增删操作，请先撤回或等待入库', 'warn');
      var anchorRectWarn = captureCaseLibraryAnchorRect(anchorEl);
      if (anchorRectWarn) showCaseLibraryBlockHint(anchorRectWarn, '当前有待确认的增删操作，请先撤回或等待入库');
      return;
    }
    var anchorRect = captureCaseLibraryAnchorRect(anchorEl);
    var base = mv.items[index] || {};
    var moduleId = base.module_id || (mv.moduleIds && mv.moduleIds.length ? mv.moduleIds[0] : null);
    if (!moduleId) {
      setStatus(dom.missingStatus, '请先选择模块', 'warn');
      return;
    }
    var moduleName = base.module_name || getMissingModuleNameById(moduleId);
    var localId = 'missing-local-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
    var fresh = {
      __localId: localId,
      module_id: moduleId,
      module_name: moduleName,
      type_ids: [''],
      type_names: [],
      title: '',
      priority: '',
      precondition: '',
      steps: '',
      expected: '待补充',
      remark: '',
    };
    ensureNonEnumerableKey(fresh, '__uiKey', '');
    var insertAt = Math.min(Math.max(index + 1, 0), mv.items.length);
    mv.items.splice(insertAt, 0, fresh);
    markMissingNewAdded(moduleId, fresh);
    mv.selection = new Set();
    mv.pageIndex = Math.floor(insertAt / getPageSize());
    mv.pendingOp = { type: 'insert', itemKey: localId, index: insertAt };
    renderMissingViewTable();
    startMissingPendingToast('已新增条目，超时将自动入库', { anchorRect: anchorRect });
  }

  function addMissingEmptyItem(anchorEl) {
    if (state.missingView.items.length) return;
    insertMissingItem(-1, anchorEl);
  }

  function removeMissingItem(index, anchorEl) {
    var mv = state.missingView;
    if (mv.pendingOp) {
      setStatus(dom.missingStatus, '当前有待确认的增删操作，请先撤回或等待入库', 'warn');
      var anchorRectWarn = captureCaseLibraryAnchorRect(anchorEl);
      if (anchorRectWarn) showCaseLibraryBlockHint(anchorRectWarn, '当前有待确认的增删操作，请先撤回或等待入库');
      return;
    }
    var anchorRect = captureCaseLibraryAnchorRect(anchorEl);
    var idx = Math.max(0, Math.min(Number(index), mv.items.length - 1));
    var item = mv.items[idx];
    if (!item) return;
    openConfirmDrawer({
      title: '确认删除条目',
      message: '确定删除该易漏用例吗？可在 8 秒内撤回。',
      confirmText: '确认删除',
      cancelText: '取消',
      danger: true,
      previousDrawer: missingDrawerInstance || null,
    }).then(function(res) {
      if (!res || res.ok !== true) return;
      unmarkMissingNewAdded(item.module_id, item);
      mv.items.splice(idx, 1);
      mv.selection = new Set();
      mv.pendingOp = { type: 'remove', item: item, index: idx };
      renderMissingViewTable();
      startMissingPendingToast('已删除条目，超时将自动入库', { anchorRect: anchorRect });
    });
  }

  function removeSelectedMissingItems(anchorEl) {
    var mv = state.missingView;
    if (!mv) return;
    if (mv.pendingOp) {
      setStatus(dom.missingStatus, '当前有待确认的增删操作，请先撤回或等待入库', 'warn');
      var anchorRectWarn = captureCaseLibraryAnchorRect(anchorEl);
      if (anchorRectWarn) showCaseLibraryBlockHint(anchorRectWarn, '当前有待确认的增删操作，请先撤回或等待入库');
      return;
    }
    mv.selection = mv.selection instanceof Set ? mv.selection : new Set();
    var raw = Array.from(mv.selection);
    var indices = [];
    var seen = {};
    raw.forEach(function(v) {
      var idx = Number(v);
      if (!isFinite(idx)) return;
      if (idx < 0 || idx >= mv.items.length) return;
      var key = String(idx);
      if (seen[key]) return;
      seen[key] = true;
      indices.push(idx);
    });
    if (!indices.length) {
      setStatus(dom.missingStatus, '请先勾选需要删除的条目', 'warn');
      syncMissingBatchDeleteControls();
      return;
    }
    var confirmMsg = '确定删除已勾选的 ' + indices.length + ' 条易漏用例吗？可在 8 秒内撤回。';
    openConfirmDrawer({
      title: '确认批量删除',
      message: confirmMsg,
      confirmText: '确认删除',
      cancelText: '取消',
      danger: true,
      previousDrawer: missingDrawerInstance || null,
    }).then(function(res) {
      if (!res || res.ok !== true) return;
      var anchorRect = captureCaseLibraryAnchorRect(anchorEl);
      indices.sort(function(a, b) { return b - a; });
      var removed = [];
      indices.forEach(function(idx) {
        if (idx < 0 || idx >= mv.items.length) return;
        var item = mv.items[idx];
        if (!item) return;
        removed.push({ index: idx, item: item });
        unmarkMissingNewAdded(item.module_id, item);
        mv.items.splice(idx, 1);
      });
      if (!removed.length) {
        setStatus(dom.missingStatus, '未删除任何条目', 'warn');
        syncMissingBatchDeleteControls();
        return;
      }
      mv.selection = new Set();
      mv.pendingOp = { type: 'remove_batch', removed: removed };
      renderMissingViewTable();
      startMissingPendingToast('已删除条目 ' + removed.length + ' 条，超时将自动入库', { anchorRect: anchorRect });
    });
  }

  function getSelectedMissingModules() {
    var selection = state.missingDrawer.selection instanceof Set ? state.missingDrawer.selection : new Set();
    state.missingDrawer.selection = selection;
    if (!selection.size) return [];
    var list = Array.isArray(state.missingDrawer.modules) ? state.missingDrawer.modules : [];
    return list.filter(function(m) { return m && m.id !== null && m.id !== undefined && selection.has(String(m.id)); });
  }

  function openMissingViewForModules(modules) {
    var list = Array.isArray(modules) ? modules.filter(Boolean) : [];
    if (!list.length) {
      setStatus(dom.missingDrawerStatus, '请先选择模块', 'warn');
      return;
    }
    state.missingView.projectId = state.missingDrawer.projectId || (list[0] && list[0].project_id ? list[0].project_id : null);
    state.missingView.modules = list;
    state.missingView.moduleIds = list.map(function(m) { return m && m.id ? m.id : null; }).filter(function(v) { return v !== null; });
    state.missingView.items = [];
    state.missingView.selection = new Set();
    state.missingView.pageIndex = 0;
    state.missingView.typeFilters = new Set(getMissingTypeFilterIds());
    clearMissingPendingOp();
    persistMissingViewSelection();
    persistCaseLibraryLastView('missing');
    setStatus(dom.missingStatus, '加载易漏用例...', '');
    renderMissingViewTable();
    if (state.missingView.projectId) {
      loadMissingTypes(state.missingView.projectId);
    }
    loadMissingViewItems(list).then(function() {
      updateMissingViewMeta();
      showMissingCard(true);
      setHistoryDetailVisible(false);
      showEditorCard(false);
    });
    var keepOpenOnce = Boolean(state.missingDrawer && state.missingDrawer.keepOpenOnce);
    if (keepOpenOnce && state.missingDrawer) state.missingDrawer.keepOpenOnce = false;
    if (!keepOpenOnce && missingDrawerInstance && typeof missingDrawerInstance.close === 'function') {
      missingDrawerInstance.close();
    }
  }

  function loadMissingViewItems(modules) {
    if (!apiClient || typeof apiClient.listMissingModuleItems !== 'function') {
      setStatus(dom.missingStatus, '易漏条目接口未就绪', 'err');
      return Promise.resolve([]);
    }
    var list = Array.isArray(modules) ? modules.filter(Boolean) : [];
    if (!list.length) {
      state.missingView.items = [];
      renderMissingViewTable();
      setStatus(dom.missingStatus, '暂无可用模块', 'warn');
      return Promise.resolve([]);
    }
    var tasks = list.map(function(m) {
      return apiClient
        .listMissingModuleItems(m.id)
        .then(function(items) {
          var rows = Array.isArray(items) ? items : [];
          return rows.map(function(it) {
            var clone = it && typeof it === 'object' ? Object.assign({}, it) : {};
            clone.module_id = m.id;
            clone.module_name = m.name || ('模块#' + m.id);
            normalizeMissingItemTypeData(clone);
            return clone;
          });
        })
        .catch(function() { return []; });
    });
    return Promise.all(tasks).then(function(res) {
      var combined = [];
      res.forEach(function(rows) {
        (rows || []).forEach(function(row) { combined.push(row); });
      });
      state.missingView.items = combined;
      renderMissingViewTable();
      if (!combined.length) {
        setStatus(dom.missingStatus, '暂无易漏用例条目', 'warn');
      } else {
        setStatus(dom.missingStatus, '已加载 ' + combined.length + ' 条易漏用例', 'ok');
      }
      return combined;
    });
  }

  function buildMissingExcelBlob(items, sheetName) {
    var header = ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果'];
    var rows = [header].concat((items || []).map(function(it) {
      var item = it || {};
      return [
        item.module_name || getMissingModuleNameById(item.module_id),
        item.title || '',
        item.priority || '',
        item.precondition || '',
        item.steps || '',
        item.expected || '',
      ];
    }));
    return buildSimpleXlsxBlob({
      sheets: [
        { name: sheetName || '易漏用例', rows: rows },
      ],
    });
  }

  function exportMissingSelectionToXmind() {
    if (state.missingDrawer.loading) return;
    var modules = getSelectedMissingModules();
    if (!modules.length) {
      setStatus(dom.missingDrawerStatus, '请先勾选要导出的模块', 'warn');
      return;
    }
    var builder = getXmindBuilder();
    if (!builder) {
      setStatus(dom.missingDrawerStatus, '缺少 XMind 导出依赖', 'err');
      return;
    }
    if (!apiClient || typeof apiClient.listMissingModuleItems !== 'function') {
      setStatus(dom.missingDrawerStatus, '易漏条目接口未就绪', 'err');
      return;
    }
    var downloadBlob = getDownloadBlob();
    var zipCtor = (typeof JSZip !== 'undefined' ? JSZip : (window.JSZip ? window.JSZip : null));
    var isBatch = modules.length > 1;
    var zip = isBatch && zipCtor ? new zipCtor() : null;
    var success = 0;
    var fail = 0;
    if (dom.missingDrawerExportXmindBtn) dom.missingDrawerExportXmindBtn.disabled = true;
    setStatus(dom.missingDrawerStatus, (isBatch ? ('批量导出 XMind（' + modules.length + '个模块）...') : '正在导出 XMind...'), '');

    var chain = Promise.resolve();
    modules.forEach(function(m) {
      chain = chain.then(function() {
        var baseName = m && m.name ? String(m.name) : ('模块#' + (m && m.id ? m.id : ''));
        return apiClient
          .listMissingModuleItems(m.id)
          .then(function(items) {
            var rows = Array.isArray(items) ? items : [];
            var mapped = rows.map(function(it, idx) {
              var title = it && it.title ? String(it.title) : '';
              var priority = it && it.priority ? String(it.priority) : '';
              return {
                module: baseName,
                title: title || ('易漏用例' + (idx + 1)),
                priority: priority,
                precondition: it.precondition || '',
                steps: it.steps || '',
                expected: it.expected || '',
              };
            });
            return builder(mapped, baseName, '');
          })
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
            downloadBlob('易漏用例批量导出_xmind.zip', blob);
          });
        }
        return null;
      })
      .then(function() {
        setStatus(dom.missingDrawerStatus, '导出完成：成功 ' + success + ' 个模块，失败 ' + fail + ' 个模块', fail ? 'warn' : 'ok');
      })
      .catch(function(err) {
        setStatus(dom.missingDrawerStatus, '导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      })
      .finally(function() {
        if (dom.missingDrawerExportXmindBtn) dom.missingDrawerExportXmindBtn.disabled = false;
      });
  }

  function exportMissingSelectionToExcel() {
    if (state.missingDrawer.loading) return;
    var modules = getSelectedMissingModules();
    if (!modules.length) {
      setStatus(dom.missingDrawerStatus, '请先勾选要导出的模块', 'warn');
      return;
    }
    if (!apiClient || typeof apiClient.listMissingModuleItems !== 'function') {
      setStatus(dom.missingDrawerStatus, '易漏条目接口未就绪', 'err');
      return;
    }
    var downloadBlob = getDownloadBlob();
    var zipCtor = (typeof JSZip !== 'undefined' ? JSZip : (window.JSZip ? window.JSZip : null));
    var isBatch = modules.length > 1;
    var zip = isBatch && zipCtor ? new zipCtor() : null;
    var success = 0;
    var fail = 0;
    if (dom.missingDrawerExportExcelBtn) dom.missingDrawerExportExcelBtn.disabled = true;
    setStatus(dom.missingDrawerStatus, (isBatch ? ('批量导出 Excel（' + modules.length + '个模块）...') : '正在导出 Excel...'), '');

    var chain = Promise.resolve();
    modules.forEach(function(m) {
      chain = chain.then(function() {
        var baseName = m && m.name ? String(m.name) : ('模块#' + (m && m.id ? m.id : ''));
        return apiClient
          .listMissingModuleItems(m.id)
          .then(function(items) { return buildMissingExcelBlob(items || [], baseName); })
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
            downloadBlob('易漏用例批量导出_excel.zip', blob);
          });
        }
        return null;
      })
      .then(function() {
        setStatus(dom.missingDrawerStatus, '导出完成：成功 ' + success + ' 个模块，失败 ' + fail + ' 个模块', fail ? 'warn' : 'ok');
      })
      .catch(function(err) {
        setStatus(dom.missingDrawerStatus, '导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      })
      .finally(function() {
        if (dom.missingDrawerExportExcelBtn) dom.missingDrawerExportExcelBtn.disabled = false;
      });
  }

  var exportDepsLoading = {
    jszip: null,
    xmindCore: null,
  };

  function hasJsZip() {
    return Boolean(typeof JSZip !== 'undefined' || (typeof window !== 'undefined' && typeof window.JSZip !== 'undefined'));
  }

  function hasXmindBuilder() {
    var api = window.app && (window.app.xmindCoreApi || window.app.xmindCore) ? (window.app.xmindCoreApi || window.app.xmindCore) : null;
    return Boolean(api && typeof api.buildXmindPackageFromCases === 'function');
  }

  function loadScriptWithRetry(key, baseSrc, isReady, maxAttempts) {
    var attempts = Number(maxAttempts);
    if (!isFinite(attempts) || attempts <= 0) attempts = 2;
    if (typeof isReady === 'function' && isReady()) return Promise.resolve(true);
    if (exportDepsLoading[key]) return exportDepsLoading[key];

    function appendOnce() {
      return new Promise(function(resolve) {
        if (typeof document === 'undefined' || !document.createElement) return resolve(false);
        var script = document.createElement('script');
        var sep = String(baseSrc).indexOf('?') === -1 ? '?' : '&';
        script.src = String(baseSrc) + sep + 'ts=' + Date.now();
        script.async = true;
        script.setAttribute('data-case-lib-dyn', key);
        script.onload = function() { resolve(true); };
        script.onerror = function() { resolve(false); };
        (document.head || document.documentElement || document.body).appendChild(script);
      });
    }

    function attempt(n) {
      return appendOnce().then(function() {
        if (typeof isReady === 'function' && isReady()) return true;
        if (n >= attempts) return false;
        return new Promise(function(resolve) {
          setTimeout(resolve, 220 + n * 260);
        }).then(function() {
          return attempt(n + 1);
        });
      });
    }

    exportDepsLoading[key] = attempt(0).finally(function() {
      // 若仍未就绪，允许后续再次触发加载（例如用户再次点击导出）。
      if (typeof isReady === 'function' && !isReady()) exportDepsLoading[key] = null;
    });
    return exportDepsLoading[key];
  }

  function ensureExportDepsReady() {
    // xmindCore 依赖 JSZip；两者均为本地静态资源，极少数情况下会因空响应导致未加载，做一次兜底重拉。
    var chain = Promise.resolve(true);
    if (!hasJsZip()) {
      chain = chain.then(function() {
        return loadScriptWithRetry('jszip', './scripts/vendor/jszip.min.js', hasJsZip, 2);
      });
    }
    if (!hasXmindBuilder()) {
      chain = chain.then(function() {
        return loadScriptWithRetry('xmindCore', './scripts/core/xmindCore.js', hasXmindBuilder, 2);
      });
    }
    return chain;
  }

  function getXmindBuilder() {
    var api = window.app && window.app.xmindCoreApi ? window.app.xmindCoreApi : null;
    if (api && typeof api.buildXmindPackageFromCases === 'function') return api.buildXmindPackageFromCases;
    var coreApi = window.app && window.app.xmindCore ? window.app.xmindCore : null;
    if (coreApi && typeof coreApi.buildXmindPackageFromCases === 'function') return coreApi.buildXmindPackageFromCases;
    return null;
  }

  function buildCaseLibraryExcelBlob(items, sheetName) {
    var JSZipCtor = typeof JSZip !== 'undefined' ? JSZip : (window.JSZip ? window.JSZip : null);
    if (!JSZipCtor) return Promise.reject(new Error('缺少 JSZip 依赖，无法导出 Excel'));
    var header = ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果'];
    var rows = [header].concat((items || []).map(function(it) {
      var item = it || {};
      return [
        item.module || '',
        item.title || '',
        item.priority || '',
        item.precondition || '',
        item.steps || '',
        item.expected || '',
      ];
    }));

    return buildSimpleXlsxBlob({
      sheets: [
        { name: sheetName || '用例', rows: rows },
      ],
    });
  }

  function buildSimpleXlsxBlob(options) {
    var JSZipCtor = typeof JSZip !== 'undefined' ? JSZip : (window.JSZip ? window.JSZip : null);
    if (!JSZipCtor) return Promise.reject(new Error('缺少 JSZip 依赖，无法导出 Excel'));
    var sheets = options && Array.isArray(options.sheets) ? options.sheets.filter(Boolean) : [];
    if (!sheets.length) return Promise.reject(new Error('无导出内容'));

    var colCount = 0;
    sheets.forEach(function(sheet) {
      var rows = sheet && Array.isArray(sheet.rows) ? sheet.rows : [];
      rows.forEach(function(row) {
        if (Array.isArray(row) && row.length > colCount) colCount = row.length;
      });
    });
    if (!colCount) colCount = 1;
    var letters = [];
    for (var i = 0; i < colCount; i += 1) {
      letters.push(String.fromCharCode(65 + i));
    }

    function buildSheetXml(rows) {
      var list = Array.isArray(rows) ? rows : [];
      var sheetRowsXml = list.map(function(row, rIdx) {
        var r = rIdx + 1;
        var cells = letters.map(function(col, cIdx) {
          var ref = col + r;
          var value = row && row.length > cIdx ? row[cIdx] : '';
          var text = escapeXmlTextPreserve(value);
          return (
            '<c r=\"' + ref + '\" t=\"inlineStr\">' +
              '<is><t xml:space=\"preserve\">' + text + '</t></is>' +
            '</c>'
          );
        }).join('');
        return '<row r=\"' + r + '\">' + cells + '</row>';
      }).join('');

      return (
        '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>' +
        '<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" ' +
          'xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">' +
          '<sheetData>' + sheetRowsXml + '</sheetData>' +
        '</worksheet>'
      );
    }

    var sheetEntries = sheets.map(function(sheet, idx) {
      var name = sheet && sheet.name ? String(sheet.name) : ('Sheet' + (idx + 1));
      var rows = sheet && Array.isArray(sheet.rows) ? sheet.rows : [[]];
      return { name: name, rows: rows, idx: idx + 1 };
    });

    var workbookSheetsXml = sheetEntries.map(function(entry) {
      return '<sheet name=\"' + escapeXmlText(entry.name) + '\" sheetId=\"' + entry.idx + '\" r:id=\"rId' + entry.idx + '\"/>';
    }).join('');

    var workbookXml =
      '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>' +
      '<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" ' +
        'xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">' +
        '<sheets>' + workbookSheetsXml + '</sheets>' +
      '</workbook>';

    var contentTypesOverrides = sheetEntries.map(function(entry) {
      return '<Override PartName=\"/xl/worksheets/sheet' + entry.idx + '.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>';
    }).join('');

    var contentTypesXml =
      '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>' +
      '<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">' +
        '<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>' +
        '<Default Extension=\"xml\" ContentType=\"application/xml\"/>' +
        '<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>' +
        contentTypesOverrides +
      '</Types>';

    var relsXml =
      '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>' +
      '<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">' +
        '<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>' +
      '</Relationships>';

    var workbookRelsXml =
      '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>' +
      '<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">' +
        sheetEntries.map(function(entry) {
          return '<Relationship Id=\"rId' + entry.idx + '\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet' + entry.idx + '.xml\"/>';
        }).join('') +
      '</Relationships>';

    var zip = new JSZipCtor();
    zip.file('[Content_Types].xml', contentTypesXml);
    zip.folder('_rels').file('.rels', relsXml);
    var xl = zip.folder('xl');
    xl.file('workbook.xml', workbookXml);
    xl.folder('_rels').file('workbook.xml.rels', workbookRelsXml);
    var worksheets = xl.folder('worksheets');
    sheetEntries.forEach(function(entry) {
      worksheets.file('sheet' + entry.idx + '.xml', buildSheetXml(entry.rows));
    });
    return zip.generateAsync({ type: 'blob', compression: 'STORE' });
  }

  function buildCaseLibraryReuseExcelTemplateBlob(sheetName) {
    var header = ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果'];
    var templateRows = [header];
    var headerWithResult = header.concat(['实际结果', '备注', '缺陷链接']);
    var exampleRows = [
      headerWithResult,
      [
        '登录',
        '账号密码登录（复用）',
        'P1',
        '已注册账号',
        '1. 输入账号与密码\n2. 点击登录',
        '复用场景主行（下一行起为复用子项行）',
        '失败',
        '主行备注：实际结果需与子项汇总一致',
        'https://example.com/bug/123',
      ],
      [
        '',
        '',
        '',
        '',
        '',
        '子项1：登录成功并进入首页',
        '通过',
        '子项1备注：成功路径',
        '',
      ],
      [
        '',
        '',
        '',
        '',
        '',
        '子项2：账号或密码错误时提示弹窗',
        '失败',
        '子项2备注：错误提示文案正确',
        '',
      ],
      [
        '支付',
        '下单支付（复用）',
        'P0',
        '已登录且有余额',
        '1. 选择商品\n2. 点击支付\n3. 完成支付',
        '复用场景主行（下一行起为复用子项行）',
        '通过',
        '主行备注：全部子项通过则主行为“通过”',
        '',
      ],
      [
        '',
        '',
        '',
        '',
        '',
        '子项1：余额支付成功并扣减余额',
        '通过',
        '子项1备注：余额扣减正确',
        '',
      ],
      [
        '',
        '',
        '',
        '',
        '',
        '子项2：重复点击支付按钮不重复下单',
        '通过',
        '子项2备注：幂等校验通过',
        '',
      ],
    ];
    return buildSimpleXlsxBlob({
      sheets: [
        { name: sheetName || '用例导入模板（复用）', rows: templateRows },
        { name: '示例（执行页带结果，不参与导入）', rows: exampleRows },
      ],
    });
  }

  function downloadImportExcelTemplate() {
    var downloadBlob = getDownloadBlob();
    if (!downloadBlob) return;
    var templateType = dom.importExcelTemplateTypeSelect ? String(dom.importExcelTemplateTypeSelect.value || '') : 'normal';
    var isReuse = templateType === 'reuse';
    var baseName = isReuse ? '用例导入模板（复用）' : '用例导入模板';
    setStatus(dom.importStatus, '生成 ' + baseName + '中...', '');
    var promise = isReuse ? buildCaseLibraryReuseExcelTemplateBlob(baseName) : buildCaseLibraryExcelBlob([], baseName);
    promise
      .then(function(blob) {
        if (!blob) throw new Error('无导出内容');
        downloadBlob(sanitizeDownloadName(baseName, '.xlsx'), blob);
        setStatus(dom.importStatus, '已导出 ' + baseName, 'ok');
        safeLogOperation('export_case_template_excel', 'case_template', null, {
          format: 'xlsx',
          template_type: isReuse ? 'reuse' : 'normal',
          name: baseName,
        });
      })
      .catch(function(err) {
        setStatus(dom.importStatus, '导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      });
  }

  function downloadImportXmindTemplate() {
    var builder = getXmindBuilder();
    if (!builder) {
      setStatus(dom.importStatus, '缺少 XMind 导出依赖', 'err');
      return;
    }
    var downloadBlob = getDownloadBlob();
    if (!downloadBlob) return;
    setStatus(dom.importStatus, '生成 XMind 导入模板中...', '');
	    var sample = [
	      {
	        module: '模块',
	        title: '用例标题',
	        priority: 'P1',
	        precondition: '前提条件（必填）',
	        steps: '1. 操作步骤（必填）',
	        expected: '预期结果',
	        remark: '',
	      },
	    ];
    builder(sample, '用例导入模板', '')
      .then(function(pkg) {
        if (!pkg || !pkg.blob) throw new Error('无导出内容');
        downloadBlob(sanitizeDownloadName('用例导入模板', '.xmind'), pkg.blob);
        setStatus(dom.importStatus, '已导出 XMind 导入模板', 'ok');
        safeLogOperation('export_case_template_xmind', 'case_template', null, {
          format: 'xmind',
          name: '用例导入模板',
        });
      })
      .catch(function(err) {
        setStatus(dom.importStatus, '导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      });
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


	  function applyEditorFilter() {
	    var items = Array.isArray(state.editor.items) ? state.editor.items : [];
	    var term = normalizeName(state.editor.searchText);
	    if (!term) {
	      return items.map(function(item, idx) { return { item: item, idx: idx }; });
	    }
	    return items
	      .map(function(item, idx) { return { item: item, idx: idx }; })
	      .filter(function(entry) {
	        var it = entry.item || {};
	        var hay = [
	          stripInvisibleMarkers(it.module),
	          stripInvisibleMarkers(it.title),
	          stripInvisibleMarkers(it.priority),
	          stripInvisibleMarkers(it.precondition),
	          stripInvisibleMarkers(it.steps),
	          stripInvisibleMarkers(it.expected),
	          stripInvisibleMarkers(it.remark),
	        ].map(function(s) { return String(s || '').toLowerCase(); }).join(' ');
	        return hay.indexOf(term) !== -1;
	      });
	  }

	  function normalizeAssistantEditorCaseItem(item, visibleIndex, sourceIndex) {
	    var row = item && typeof item === 'object' ? item : {};
	    var order = Number(visibleIndex);
	    if (!Number.isFinite(order) || order < 0) order = 0;
	    var sourceOrder = Number(sourceIndex);
	    if (!Number.isFinite(sourceOrder) || sourceOrder < 0) sourceOrder = order;
	    var executionResultRaw = row.executionResult !== undefined && row.executionResult !== null
	      ? row.executionResult
	      : (row.actual !== undefined && row.actual !== null
	        ? row.actual
	        : (row.status !== undefined && row.status !== null
	          ? row.status
	          : row.result));
	    return {
	      index: order + 1,
	      sourceIndex: sourceOrder + 1,
	      id: row.id === undefined || row.id === null ? '' : String(row.id),
	      module: normalizeEditorText(row.module),
	      title: normalizeEditorText(row.title),
	      priority: normalizeEditorText(row.priority),
	      precondition: normalizeEditorText(row.precondition || row.preconditions),
	      steps: normalizeEditorText(row.steps),
	      expected: normalizeEditorText(row.expected),
	      remark: normalizeEditorText(row.remark),
	      actual: normalizeEditorText(row.actual),
	      status: normalizeEditorText(row.status),
	      result: normalizeEditorText(row.result),
	      executionResult: normalizeEditorText(executionResultRaw),
	      updatedAt: row.updated_at || row.updatedAt || '',
	    };
	  }

	  function buildAssistantEditorCaseFileSnapshot(caseFile) {
	    var file = caseFile && typeof caseFile === 'object' ? caseFile : {};
	    return {
	      id: file.id === undefined || file.id === null ? '' : String(file.id),
	      name: file.file_name_clean ? String(file.file_name_clean) : (file.file_name ? String(file.file_name) : ''),
	      projectId: file.project_id === undefined || file.project_id === null ? '' : String(file.project_id),
	      versionId: file.version_id === undefined || file.version_id === null ? '' : String(file.version_id),
	      updatedAt: file.updated_at || file.imported_at || '',
	    };
	  }

	  function getCurrentEditorCaseSnapshot(options) {
	    var opts = options && typeof options === 'object' ? options : {};
	    var limit = Number(opts.limit);
	    if (!Number.isFinite(limit) || limit <= 0) limit = 20;
	    if (limit > 1000) limit = 1000;
	    var file = state.editor && state.editor.caseFile ? state.editor.caseFile : null;
	    var allItems = Array.isArray(state.editor && state.editor.items) ? state.editor.items : [];
	    if (!file || !file.id) {
	      return {
	        ok: true,
	        hasContext: false,
	        reason: 'no-active-editor',
	        total: 0,
	        totalAll: allItems.length,
	        items: [],
	      };
	    }
	    var cardVisible = typeof isEditorCardVisible === 'function' ? isEditorCardVisible() : false;
	    var tabActive = typeof isCaseLibraryActive === 'function' ? isCaseLibraryActive() : false;
	    if (!cardVisible && !tabActive) {
	      return {
	        ok: true,
	        hasContext: false,
	        reason: 'no-active-editor',
	        total: 0,
	        totalAll: allItems.length,
	        items: [],
	      };
	    }
	    var filtered = applyEditorFilter();
	    var normalized = filtered.map(function(entry, idx) {
	      var row = entry && entry.item && typeof entry.item === 'object' ? entry.item : {};
	      var sourceIndex = entry && Number.isFinite(Number(entry.idx)) ? Number(entry.idx) : idx;
	      return normalizeAssistantEditorCaseItem(row, idx, sourceIndex);
	    });
	    var items = normalized.slice(0, limit);
	    var searchText = state.editor && state.editor.searchText ? String(state.editor.searchText).trim() : '';
	    return {
	      ok: true,
	      hasContext: true,
	      scope: 'editor',
	      projectId: file.project_id === undefined || file.project_id === null ? '' : String(file.project_id),
	      caseFile: buildAssistantEditorCaseFileSnapshot(file),
	      searchText: searchText,
	      total: normalized.length,
	      totalAll: allItems.length,
	      items: items,
	      truncated: normalized.length > items.length,
	    };
	  }

	  function buildAssistantHistoryCaseSnapshot(snapshot) {
	    var data = snapshot && typeof snapshot === 'object' ? snapshot : null;
	    if (!data) return null;
	    return {
	      module: data.module === undefined || data.module === null ? '' : String(data.module),
	      title: data.title === undefined || data.title === null ? '' : String(data.title),
	      priority: data.priority === undefined || data.priority === null ? '' : String(data.priority),
	      precondition: data.precondition === undefined || data.precondition === null ? '' : String(data.precondition),
	      steps: data.steps === undefined || data.steps === null ? '' : String(data.steps),
	      expected: data.expected === undefined || data.expected === null ? '' : String(data.expected),
	      remark: data.remark === undefined || data.remark === null ? '' : String(data.remark),
	    };
	  }

	  function buildAssistantHistoryEntrySnapshot(entry, index) {
	    var row = entry && typeof entry === 'object' ? entry : {};
	    var kind = normalizeCaseLibHistoryKind(row.kind);
	    var oldSnap = buildAssistantHistoryCaseSnapshot(row.old);
	    var newSnap = buildAssistantHistoryCaseSnapshot(row.new);
	    var changedFields = Array.isArray(row.changed_fields)
	      ? row.changed_fields.map(function(field) {
	          return field === undefined || field === null ? '' : String(field);
	        }).filter(function(field) { return field; })
	      : [];
	    var title = newSnap && newSnap.title ? String(newSnap.title) : (oldSnap && oldSnap.title ? String(oldSnap.title) : '');
	    var moduleName = newSnap && newSnap.module ? String(newSnap.module) : (oldSnap && oldSnap.module ? String(oldSnap.module) : '');
	    return {
	      index: Number(index) + 1,
	      id: row.id === undefined || row.id === null ? '' : String(row.id),
	      kind: kind,
	      kindLabel: getCaseLibHistoryKindLabel(kind),
	      changedAt: row.changed_at === undefined || row.changed_at === null ? '' : String(row.changed_at),
	      operator: row.operator === undefined || row.operator === null ? '' : String(row.operator),
	      changedFields: changedFields,
	      module: moduleName,
	      title: title,
	      old: oldSnap,
	      new: newSnap,
	    };
	  }

	  function getCurrentHistoryDetailSnapshot(options) {
	    var opts = options && typeof options === 'object' ? options : {};
	    var limit = Number(opts.limit);
	    if (!Number.isFinite(limit) || limit <= 0) limit = 40;
	    if (limit > 100) limit = 100;
	    var fileNameClean = state.historyDetail && state.historyDetail.fileNameClean
	      ? String(state.historyDetail.fileNameClean).trim()
	      : '';
	    var cardVisible = typeof isHistoryDetailVisible === 'function' ? isHistoryDetailVisible() : false;
	    if (!fileNameClean || !cardVisible) {
	      return {
	        ok: true,
	        hasContext: false,
	        reason: 'no-visible-history-detail',
	        total: 0,
	        filteredTotal: 0,
	        events: [],
	        pageEvents: [],
	      };
	    }
	    var history = Array.isArray(state.historyDetail && state.historyDetail.history) ? state.historyDetail.history : [];
	    var filter = normalizeCaseLibHistoryKind(state.historyDetail && state.historyDetail.filter ? state.historyDetail.filter : '');
	    var filtered = filter
	      ? history.filter(function(item) {
	          return normalizeCaseLibHistoryKind(item && item.kind) === filter;
	        })
	      : history.slice();
	    var summary = { append: 0, added: 0, updated: 0, deleted: 0, import: 0, reimport: 0, file_deleted: 0, version_changed: 0 };
	    history.forEach(function(item) {
	      var kind = normalizeCaseLibHistoryKind(item && item.kind);
	      if (summary[kind] === undefined) return;
	      summary[kind] += 1;
	    });
	    var filteredSummary = { append: 0, added: 0, updated: 0, deleted: 0, import: 0, reimport: 0, file_deleted: 0, version_changed: 0 };
	    filtered.forEach(function(item) {
	      var kind = normalizeCaseLibHistoryKind(item && item.kind);
	      if (filteredSummary[kind] === undefined) return;
	      filteredSummary[kind] += 1;
	    });
	    var pageSize = getPageSize();
	    var total = filtered.length;
	    var totalPages = total ? Math.ceil(total / pageSize) : 1;
	    var pageIndex = state.historyDetail && Number.isFinite(Number(state.historyDetail.pageIndex))
	      ? Number(state.historyDetail.pageIndex)
	      : 0;
	    if (pageIndex < 0) pageIndex = 0;
	    if (pageIndex >= totalPages) pageIndex = Math.max(totalPages - 1, 0);
	    var start = pageIndex * pageSize;
	    var end = Math.min(total, start + pageSize);
	    var pageEvents = filtered.slice(start, end).map(function(item, idx) {
	      return buildAssistantHistoryEntrySnapshot(item, start + idx);
	    });
	    var events = filtered.slice(0, limit).map(function(item, idx) {
	      return buildAssistantHistoryEntrySnapshot(item, idx);
	    });
	    var projectId = state.historyDetail && state.historyDetail.projectId !== undefined && state.historyDetail.projectId !== null
	      ? String(state.historyDetail.projectId)
	      : '';
	    var versionId = state.historyDetail && state.historyDetail.versionId !== undefined && state.historyDetail.versionId !== null
	      ? String(state.historyDetail.versionId)
	      : '';
	    var projectName = projectId && state.projectNameById && state.projectNameById[projectId]
	      ? String(state.projectNameById[projectId])
	      : (projectId ? ('项目#' + projectId) : '');
	    var versionName = projectId && versionId ? getVersionName(projectId, versionId) : '';
	    return {
	      ok: true,
	      hasContext: true,
	      scope: 'history-detail',
	      projectId: projectId,
	      projectName: projectName,
	      versionId: versionId,
	      versionName: versionName,
	      fileNameClean: fileNameClean,
	      isDeleted: state.historyDetail && state.historyDetail.isDeleted === true,
	      loading: state.historyDetail && state.historyDetail.loading === true,
	      filter: filter,
	      filterLabel: filter ? getCaseLibHistoryKindLabel(filter) : '',
	      total: history.length,
	      filteredTotal: total,
	      pageIndex: pageIndex,
	      currentPage: total ? (pageIndex + 1) : 1,
	      pageSize: pageSize,
	      totalPages: totalPages,
	      pageStart: total ? (start + 1) : 0,
	      pageEnd: end,
	      summary: summary,
	      filteredSummary: filteredSummary,
	      pageEvents: pageEvents,
	      events: events,
	      truncated: total > events.length,
	    };
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

  function buildEditorPagination(totalCases, pageIndex, totalPages, start, end) {
    var pageSize = getPageSize();
    var displayStart = totalCases ? start + 1 : 0;
    var displayEnd = totalCases ? Math.min(end, totalCases) : 0;
    var maxPage = Math.max(totalPages, 1);
    var currentPage = totalPages ? pageIndex + 1 : 1;
    var rangeInfo = totalCases
      ? '显示 ' + displayStart + '-' + displayEnd + ' / ' + totalCases + ' 条'
      : '暂无用例';
    return (
      '<div class=\"temp-pagination\" data-case-lib-pagination>' +
        '<div class=\"temp-pagination-info\">' + escapeHtml(rangeInfo) + '，每页 ' + pageSize + ' 条</div>' +
        '<div class=\"temp-pagination-controls\">' +
          '<button type=\"button\" class=\"secondary\" data-case-lib-page=\"prev\" ' + (pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
          '<span>第 ' + currentPage + ' / ' + maxPage + ' 页</span>' +
          '<button type=\"button\" class=\"secondary\" data-case-lib-page=\"next\" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
          '<label>跳至' +
            '<input type=\"number\" min=\"1\" max=\"' + maxPage + '\" value=\"' + Math.min(currentPage, maxPage) + '\" data-case-lib-page-input>' +
            '页' +
          '</label>' +
        '</div>' +
      '</div>'
    );
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
    if (caseLibraryXmindLocateTarget && caseLibraryXmindLocateTarget.classList) {
      caseLibraryXmindLocateTarget.classList.remove('xmind-locate-highlight');
    }
    caseLibraryXmindLocateTarget = null;
  }

  function flashCaseLibraryXmindLocateHighlight(index, durationMs) {
    if (!dom.editView || typeof dom.editView.querySelector !== 'function') return;
    var idx = Number(index);
    if (!isFinite(idx) || idx < 0) return;
    var duration = Number(durationMs);
    if (!isFinite(duration) || duration <= 0) duration = 3200;

    var selector = '[data-case-lib-edit-field="module"][data-index="' + idx + '"]';
    var cell = dom.editView.querySelector(selector);
    var anchor2 = cell || dom.editView.querySelector('[data-case-lib-edit-field="title"][data-index="' + idx + '"]');
    var row = anchor2 && anchor2.closest ? anchor2.closest('tr') : null;
    if (!row) return;

    if (caseLibraryXmindLocateTarget && caseLibraryXmindLocateTarget !== row) {
      clearCaseLibraryXmindLocateHighlight();
    } else if (caseLibraryXmindLocateTimer) {
      clearTimeout(caseLibraryXmindLocateTimer);
      caseLibraryXmindLocateTimer = 0;
    }

    caseLibraryXmindLocateTarget = row;
    if (row.classList) row.classList.add('xmind-locate-highlight');
    caseLibraryXmindLocateTimer = setTimeout(function() {
      if (caseLibraryXmindLocateTarget === row && row.classList) {
        row.classList.remove('xmind-locate-highlight');
      }
      if (caseLibraryXmindLocateTarget === row) caseLibraryXmindLocateTarget = null;
      caseLibraryXmindLocateTimer = 0;
    }, duration);
  }

  function scrollEditorToIndex(index) {
    if (!dom.editView || typeof dom.editView.querySelector !== 'function') return;
    var idx = Number(index);
    if (!isFinite(idx) || idx < 0) return;
    var selector = '[data-case-lib-edit-field=\"module\"][data-index=\"' + idx + '\"]';
    var cell = dom.editView.querySelector(selector);
    var anchor = cell || dom.editView.querySelector('input[data-case-lib-select][data-index=\"' + idx + '\"]');
    if (!anchor) return;
    var row = anchor && anchor.closest ? anchor.closest('tr') : null;
    var target = row || anchor;
    if (target && target.scrollIntoView) {
      try { target.scrollIntoView({ block: 'center' }); } catch (e) { target.scrollIntoView(); }
    }
    if (cell && cell.focus) {
      try { cell.focus(); } catch (_) {}
    }
  }

  function getActiveEditorInlineCell() {
    if (typeof document === 'undefined') return null;
    if (!dom.editView || !dom.editView.contains) return null;
    var active = document.activeElement;
    if (!active || !dom.editView.contains(active)) return null;
    if (!active.getAttribute) return null;
    var field = active.getAttribute('data-case-lib-edit-field');
    if (!field) return null;
    return active;
  }

  function isCaseLibraryEditorEditing() {
    if (typeof document === 'undefined') return false;
    if (!dom.editView || !dom.editView.contains) return false;
    var active = document.activeElement;
    if (!active || !dom.editView.contains(active)) return false;
    if (!active.getAttribute) return false;
    if (active.getAttribute('data-case-lib-edit-field')) return true;
    if (active.getAttribute('data-case-lib-remark')) return true;
    return false;
  }

  function normalizeInlineDisplayText(value, multiline) {
    var text = stripInvisibleMarkers(value);
    if (multiline) return text;
    return text.replace(/\r\n/g, '\n').replace(/\n/g, ' ');
  }

  function ensureEditorAutoSaveState() {
    if (!state.editor || typeof state.editor !== 'object') return null;
    if (!state.editor.autoSaveTimers || typeof state.editor.autoSaveTimers !== 'object') {
      state.editor.autoSaveTimers = {};
    }
    if (!state.editor.autoSaveInFlight || typeof state.editor.autoSaveInFlight !== 'object') {
      state.editor.autoSaveInFlight = {};
    }
    return state.editor;
  }

  function tryAutoSaveCaseItemAtIndex(index) {
    var ed = state.editor;
    if (!ed || !ed.caseFile || !ed.caseFile.id) return;
    var idx = Number(index);
    if (!isFinite(idx) || idx < 0 || idx >= ed.items.length) return;
    var item = ed.items[idx];
    if (!item || !item.id) return;
    var payload = buildCaseItemPayload(item);
    var err = validatePayload(payload);
    if (err) return;
    var idKey = String(item.id);
    var store = ensureEditorAutoSaveState();
    if (!store) return;
    if (store.autoSaveInFlight[idKey]) {
      store.autoSaveInFlight[idKey] = 'pending';
      return;
    }
    store.autoSaveInFlight[idKey] = true;
    apiClient.updateCaseItem(item.id, payload).then(function(updated) {
      if (updated && typeof updated === 'object' && (updated.id || updated.id === 0)) {
        ed.items[idx] = updated;
      }
    }).catch(function() {
      // auto-save failure is silent; manual save still works on blur.
    }).finally(function() {
      var stateVal = store.autoSaveInFlight[idKey];
      delete store.autoSaveInFlight[idKey];
      if (stateVal === 'pending') {
        store.autoSaveInFlight[idKey] = false;
        setTimeout(function() { tryAutoSaveCaseItemAtIndex(idx); }, 200);
      }
    });
  }

  function scheduleEditorAutoSave(index) {
    var ed = ensureEditorAutoSaveState();
    if (!ed) return;
    var key = String(index);
    if (ed.autoSaveTimers[key]) {
      clearTimeout(ed.autoSaveTimers[key]);
    }
    ed.autoSaveTimers[key] = setTimeout(function() {
      delete ed.autoSaveTimers[key];
      tryAutoSaveCaseItemAtIndex(index);
    }, 800);
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
      var cell = dom.editView.querySelector('[data-case-lib-edit-field="' + meta.key + '"][data-index="' + idx + '"]');
      if (!cell) return;
      var raw = meta.multiline ? cell.innerText : cell.textContent;
      var next = normalizeEditorText(raw);
      if (skipEmptyRequired && meta.required && !next) return;
      if (item[meta.key] !== next) {
        item[meta.key] = next;
        changed = true;
      }
    });
    return changed;
  }

  function flushEditorPendingRender() {
    if (!state.editor || !state.editor.pendingRender) return;
    if (isCaseLibraryEditorEditing()) return;
    state.editor.pendingRender = false;
    renderEditorTable();
  }

  function syncEditorRowInlineText(index, item, activeCell) {
    if (!dom.editView || !dom.editView.querySelector) return false;
    if (!item) return false;
    var idx = Number(index);
    if (!isFinite(idx)) return false;
    var fields = [
      { key: 'module', multiline: false },
      { key: 'title', multiline: false },
      { key: 'priority', multiline: false },
      { key: 'precondition', multiline: true },
      { key: 'steps', multiline: true },
      { key: 'expected', multiline: true },
    ];
    var changed = false;
    fields.forEach(function(meta) {
      var cell = dom.editView.querySelector('[data-case-lib-edit-field="' + meta.key + '"][data-index="' + idx + '"]');
      if (!cell || cell === activeCell) return;
      var nextText = normalizeInlineDisplayText(item[meta.key], meta.multiline);
      if (cell.textContent !== nextText) {
        cell.textContent = nextText;
        changed = true;
      }
    });
    return changed;
  }

  function renderEditorTable() {
    if (!dom.editView) return;
    if (!state.editor.caseFile) {
      dom.editView.innerHTML = '<p class=\"hint\">请先选择需要编辑的用例</p>';
      return;
    }
    var caseFileId = state.editor.caseFile && state.editor.caseFile.id ? state.editor.caseFile.id : null;
    var matches = applyEditorFilter();
    var pageSize = getPageSize();
    var totalCases = matches.length;
    var totalPages = totalCases ? Math.ceil(totalCases / pageSize) : 1;
    if (state.editor.pageIndex >= totalPages) state.editor.pageIndex = Math.max(totalPages - 1, 0);
    if (state.editor.pageIndex < 0) state.editor.pageIndex = 0;
    var start = state.editor.pageIndex * pageSize;
    var end = Math.min(totalCases, start + pageSize);
	    var paged = matches.filter(function(_, idx) { return idx >= start && idx < end; });
	    var visibleIndexes = [];
	    var selection = state.editor.selection;
		    var rows = paged.map(function(entry) {
		      var item = entry.item || {};
		      var idx = entry.idx;
		      visibleIndexes.push(idx);
	      var editPlaceholder = '点击此处编辑';
	      var moduleText = stripInvisibleMarkers(item.module);
	      var titleText = stripInvisibleMarkers(item.title);
	      var priorityText = stripInvisibleMarkers(item.priority);
	      var preText = stripInvisibleMarkers(item.precondition);
	      var stepsText = stripInvisibleMarkers(item.steps);
	      var expectedText = stripInvisibleMarkers(item.expected);
	      var moduleHtml = moduleText ? escapeHtml(moduleText) : '';
	      var titleHtml = titleText ? escapeHtml(titleText) : '';
	      var priorityHtml = priorityText ? escapeHtml(priorityText) : '';
		      var preHtml = preText ? escapeHtml(preText).replace(/\n/g, '<br>') : '';
		      var stepsHtml = stepsText ? escapeHtml(stepsText).replace(/\n/g, '<br>') : '';
		      var expectedHtml = expectedText ? escapeHtml(expectedText).replace(/\n/g, '<br>') : '';
		      var rowClass = 'case-row' + (isCaseLibraryNewAdded(caseFileId, item) ? ' new-added' : '');
	      return (
	        '<tr class=\"' + rowClass + '\">' +
	          '<td class=\"check\"><input type=\"checkbox\" data-case-lib-select data-index=\"' + idx + '\" ' + (selection.has(idx) ? 'checked' : '') + '></td>' +
          '<td class=\"index\">' + (idx + 1) + '</td>' +
          '<td class=\"module\"><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-edit-field=\"module\" data-index=\"' + idx + '\" data-case-lib-multiline=\"false\" data-placeholder=\"' + editPlaceholder + '\">' + moduleHtml + '</div></td>' +
          '<td class=\"title\"><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-edit-field=\"title\" data-index=\"' + idx + '\" data-case-lib-multiline=\"false\" data-placeholder=\"' + editPlaceholder + '\">' + titleHtml + '</div></td>' +
          '<td><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-edit-field=\"priority\" data-index=\"' + idx + '\" data-case-lib-multiline=\"false\" data-placeholder=\"' + editPlaceholder + '\">' + priorityHtml + '</div></td>' +
	          '<td><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-edit-field=\"precondition\" data-index=\"' + idx + '\" data-case-lib-multiline=\"true\" data-placeholder=\"' + editPlaceholder + '\">' + preHtml + '</div></td>' +
	          '<td><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-edit-field=\"steps\" data-index=\"' + idx + '\" data-case-lib-multiline=\"true\" data-placeholder=\"' + editPlaceholder + '\">' + stepsHtml + '</div></td>' +
	          '<td><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-edit-field=\"expected\" data-index=\"' + idx + '\" data-case-lib-multiline=\"true\" data-placeholder=\"' + editPlaceholder + '\">' + expectedHtml + '</div></td>' +
	          '<td class=\"case-op-col\">' +
	            '<div class=\"case-ops\">' +
	              '<button type=\"button\" class=\"case-op remove\" title=\"删除当前用例\" data-case-lib-remove data-index=\"' + idx + '\">−</button>' +
	              '<button type=\"button\" class=\"case-op add\" title=\"在下方插入用例\" data-case-lib-insert data-index=\"' + idx + '\">＋</button>' +
	            '</div>' +
	          '</td>' +
	        '</tr>'
	      );
	    }).join('');

    var allVisibleSelected = visibleIndexes.length && visibleIndexes.every(function(idx) { return selection.has(idx); });
    var headerCheckbox = (
      '<th class=\"check\"><input type=\"checkbox\" data-case-lib-select-all data-visible=\"' + visibleIndexes.join(',') + '\" ' +
      (visibleIndexes.length ? (allVisibleSelected ? 'checked' : '') : 'disabled') + '></th>'
	    );
	    var emptyRow = visibleIndexes.length
	      ? ''
	      : '<tr><td colspan=\"9\">' + (state.editor.items.length ? '当前页暂无用例' : '未解析到有效用例') + '</td></tr>';
    var paginationTop = buildEditorPagination(totalCases, state.editor.pageIndex, totalPages, start, end);
    var paginationBottom = buildEditorPagination(totalCases, state.editor.pageIndex, totalPages, start, end);
    dom.editView.innerHTML = (
      paginationTop +
      '<table>' +
        '<thead>' +
          '<tr>' +
            headerCheckbox +
            '<th class=\"index\">编号</th>' +
            '<th class=\"module\">模块</th>' +
            '<th class=\"title\">用例标题</th>' +
            '<th>优先级</th>' +
	            '<th>前提条件</th>' +
	            '<th>操作步骤</th>' +
	            '<th>预期结果</th>' +
	            '<th class=\"ops\" title=\"增删\">增删</th>' +
	          '</tr>' +
	        '</thead>' +
        '<tbody>' + (rows || emptyRow) + '</tbody>' +
      '</table>' +
      paginationBottom
    );
    syncEditorBatchDeleteControls();
    syncEditorBatchAddControls();
    requestMissingReminderRefresh();
  }

  function renderEditorCard() {
    var file = state.editor.caseFile;
    if (!file) {
      showEditorCard(false);
      clearMissingReminder();
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

  function restoreHistoryDetailFromPersistedState() {
    if (!isAuthReady()) return Promise.resolve(false);
    if (state.historyDetail && state.historyDetail.restoring === true) return Promise.resolve(false);
    var persisted = readHistoryDetailPersistedState();
    if (!persisted) return Promise.resolve(false);
    var userId = getCurrentUserId();
    var loginSeq = getCurrentLoginSeq();
    var okByUser = userId && String(persisted.user_id || '') === String(userId);
    var okByLogin = loginSeq && String(persisted.login_seq || '') === String(loginSeq);
    if (!okByUser && !okByLogin) return Promise.resolve(false);
    var projectId = normalizeId(persisted.project_id);
    var fileNameClean = persisted.file_name_clean ? String(persisted.file_name_clean) : '';
    if (!projectId || !fileNameClean.trim()) return Promise.resolve(false);
    // 仅在“已加载过项目列表”时才严格校验项目存在；避免因为项目列表未就绪/加载失败导致历史详情无法恢复。
    var projectsLoaded = Boolean(state.projects && state.projects.length);
    if (projectsLoaded) {
      var hasProject = (state.projects || []).some(function(p) { return p && String(p.id) === String(projectId); });
      if (!hasProject) return Promise.resolve(false);
    }

    state.historyDetail.restoring = true;
    state.historyDetail.projectId = String(projectId);
    state.historyDetail.fileNameClean = String(fileNameClean).trim();
    state.historyDetail.filter = persisted.filter ? String(persisted.filter) : '';
    state.historyDetail.pageIndex = isFinite(Number(persisted.page_index)) ? Number(persisted.page_index) : 0;
    state.historyDetail.versionId = (persisted.version_id || persisted.version_id === 0) ? persisted.version_id : null;
    setHistoryDetailVisible(true);
    // 保证视图互斥：恢复“历史详情”时应隐藏编辑卡片。
    if (dom.editCard && dom.editCard.classList) dom.editCard.classList.add('hidden');
    try { if (dom.editCard) dom.editCard.hidden = true; } catch (_) {}
    setStatus(dom.historyStatus, '加载历史记录中...', '');
    renderCaseLibraryHistory();
    return loadCaseLibraryHistoryEntries(projectId, fileNameClean)
      .then(function(res) {
        if (!res) return false;
        return true;
      })
      .catch(function() {
        clearHistoryDetailPersistedState();
        setHistoryDetailVisible(false);
        return false;
      })
      .finally(function() {
        state.historyDetail.restoring = false;
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

  function isHistoryDetailVisible() {
    return Boolean(
      dom.historyDetailCard &&
        dom.historyDetailCard.classList &&
        !dom.historyDetailCard.classList.contains('hidden')
    );
  }

  function isEditorCardVisible() {
    return Boolean(dom.editCard && dom.editCard.classList && !dom.editCard.classList.contains('hidden'));
  }

  function isMissingCardVisible() {
    return Boolean(dom.missingCard && dom.missingCard.classList && !dom.missingCard.classList.contains('hidden'));
  }

  function handlePageSizeChanged() {
    var hasHistory = state.historyDetail && (state.historyDetail.fileNameClean || (state.historyDetail.history && state.historyDetail.history.length));
    if (hasHistory) {
      renderCaseLibraryHistory();
    }
    var hasEditor = state.editor && state.editor.caseFile && state.editor.caseFile.id;
    if (hasEditor) {
      renderEditorTable();
    }
    if (state.editDrawer && state.editDrawer.projectId) {
      renderEditDrawerList();
    }
    if (state.selectDrawer && state.selectDrawer.projectId) {
      renderSelectDrawerList();
    }
    if (state.missingDrawer && state.missingDrawer.projectId) {
      renderMissingDrawerList();
    }
    if (state.historyQueryDrawer && state.historyQueryDrawer.projectId) {
      renderHistoryQueryDrawerList();
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

  function cleanupPendingToast() {
    var ed = state.editor;
    if (ed.pendingTimer) {
      clearTimeout(ed.pendingTimer);
      ed.pendingTimer = null;
    }
    if (ed.pendingInterval) {
      clearInterval(ed.pendingInterval);
      ed.pendingInterval = null;
    }
    if (ed.pendingToast && ed.pendingToast.parentNode) {
      ed.pendingToast.parentNode.removeChild(ed.pendingToast);
    }
    ed.pendingToast = null;
    ed.pendingRemaining = 0;
  }

	  function clearPendingOp() {
	    cleanupPendingToast();
	    state.editor.pendingOp = null;
	    syncEditorBatchDeleteControls();
	    syncEditorBatchAddControls();
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

  function startPendingToast(message, options) {
    options = options || {};
    var anchorRect = options.anchorRect || null;
    cleanupPendingToast();
    var ed = state.editor;
    ed.pendingRemaining = 8;
    var toast = document.createElement('div');
    toast.className = 'temp-undo-toast';
    var text = document.createElement('span');
    var btn = document.createElement('button');
    btn.className = 'pill secondary';
    btn.textContent = '撤回';
    function renderCountdown() {
      text.textContent = (message || '已暂存变更') + '（' + ed.pendingRemaining + 's）';
    }
    var handleUndoClick = function() {
      var op = ed.pendingOp;
      if (!op) return;
      if (op.type === 'remove' && op.item) {
        var insertAt = Math.min(Math.max(op.index, 0), ed.items.length);
        ed.items.splice(insertAt, 0, op.item);
      } else if (op.type === 'remove_batch' && Array.isArray(op.removed)) {
        var list = op.removed
          .filter(function(r) { return r && r.item; })
          .slice()
          .sort(function(a, b) { return Number(a.index) - Number(b.index); });
        list.forEach(function(r) {
          var idx = Math.max(0, Math.min(Number(r.index), ed.items.length));
          ed.items.splice(idx, 0, r.item);
        });
      } else if (op.type === 'insert_batch' && Array.isArray(op.itemKeys)) {
        var keys = op.itemKeys.slice();
        var removals = [];
        for (var i = 0; i < keys.length; i += 1) {
          var key = keys[i];
          var idx = ed.items.findIndex(function(it) { return it && it.__localId === key; });
          if (idx !== -1) removals.push(idx);
        }
        removals.sort(function(a, b) { return b - a; });
        removals.forEach(function(idx) {
          var removed = ed.items[idx];
          if (removed) unmarkCaseLibraryNewAdded(ed.caseFile ? ed.caseFile.id : null, removed);
          ed.items.splice(idx, 1);
        });
      } else if (op.type === 'insert' && op.itemKey) {
        var idx = ed.items.findIndex(function(it) { return it && it.__localId === op.itemKey; });
        if (idx !== -1) ed.items.splice(idx, 1);
      }
      ed.selection = new Set();
      ed.remarkOpen = new Set();
      clearPendingOp();
      setStatus(dom.editStatus, '已撤回增删操作（未入库）', 'ok');
      renderEditorTable();
    };
    btn.addEventListener('click', handleUndoClick);
    toast.appendChild(text);
    toast.appendChild(btn);
    document.body.appendChild(toast);
    ed.pendingToast = toast;
    renderCountdown();
    ed.pendingInterval = setInterval(function() {
      ed.pendingRemaining -= 1;
      if (ed.pendingRemaining <= 0) {
        clearInterval(ed.pendingInterval);
        ed.pendingInterval = null;
        commitPendingOp();
        return;
      }
      renderCountdown();
    }, 1000);
  }

	  function buildCaseItemPayload(item) {
	    var priority = normalizeEditorText(item && item.priority ? item.priority : '');
	    var pre = normalizeEditorText(item && item.precondition ? item.precondition : '');
	    var steps = normalizeEditorText(item && item.steps ? item.steps : '');
	    var remark = normalizeEditorText(item && item.remark ? item.remark : '');
	    return {
	      module: normalizeEditorText(item && item.module ? item.module : ''),
	      title: normalizeEditorText(item && item.title ? item.title : ''),
	      expected: normalizeEditorText(item && item.expected ? item.expected : ''),
	      priority: priority || null,
	      precondition: pre || null,
	      steps: steps || null,
	      remark: remark || null,
	    };
	  }

  function validatePayload(payload) {
    if (!payload) return '内容不能为空';
    if (!payload.module) return '模块不能为空';
    if (!payload.title) return '用例标题不能为空';
    if (!payload.expected) return '预期结果不能为空';
    return '';
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
      if (activeCell) {
        syncEditorRowInlineText(idx, ed.items[idx], activeCell);
        return;
      }
      renderEditorTable();
    }).catch(function(e) {
      setStatus(dom.editStatus, e && e.message ? e.message : '保存失败', 'err');
    });
  }

  function commitPendingOp() {
    var ed = state.editor;
    var op = ed.pendingOp;
    if (!op) return;
    var file = ed.caseFile;
    if (!file || !file.id) {
      clearPendingOp();
      return;
    }
    cleanupPendingToast();
    setStatus(dom.editStatus, '增删入库中...', '');
    if (op.type === 'remove' && op.item && op.item.id) {
      apiClient.deleteCaseItem(op.item.id).then(function() {
        setStatus(dom.editStatus, '删除已入库', 'ok');
      }).catch(function(e) {
        setStatus(dom.editStatus, e && e.message ? e.message : '删除入库失败', 'err');
      }).finally(function() {
        clearPendingOp();
      });
      return;
    }

    if (op.type === 'remove_batch' && Array.isArray(op.removed)) {
      var removed = op.removed.slice();
      var toDelete = [];
      var seen = {};
      removed.forEach(function(r) {
        var item = r && r.item ? r.item : null;
        if (!item || !item.id) return;
        var id = String(item.id);
        if (seen[id]) return;
        seen[id] = true;
        toDelete.push({ id: item.id, index: r.index, item: item });
      });

      if (!toDelete.length) {
        ed.pendingOp = null;
        setStatus(dom.editStatus, '批量删除已撤回或无需入库', 'warn');
        renderEditorTable();
        return;
      }

      function settle(p) {
        return Promise.resolve(p).then(
          function(v) { return { status: 'fulfilled', value: v }; },
          function(err) { return { status: 'rejected', reason: err }; }
        );
      }

      var promises = toDelete.map(function(entry) {
        return settle(apiClient.deleteCaseItem(entry.id, { batch: true }));
      });

	      Promise.all(promises).then(function(results) {
	        var failures = [];
	        for (var i = 0; i < results.length; i += 1) {
	          if (results[i] && results[i].status === 'rejected') failures.push(toDelete[i]);
	        }
        var currentCount = ed.items.length;
        var successCount = toDelete.length - failures.length;
        var beforeCount = currentCount + toDelete.length;
        var afterCount = Math.max(beforeCount - successCount, 0);
        safeLogOperation(
          'batch_delete_case_items',
          'case_item',
          null,
          {
            case_file_id: file.id,
            file_name: file.file_name_clean || '',
            count: toDelete.length,
            success: toDelete.length - failures.length,
            fail: failures.length,
            before_count: beforeCount,
            after_count: afterCount,
          },
          failures.length ? 'partial' : 'success'
        );

        if (!failures.length) {
          setStatus(dom.editStatus, '批量删除已入库（' + toDelete.length + '条）', 'ok');
          return;
        }

        failures
          .slice()
          .sort(function(a, b) { return Number(a.index) - Number(b.index); })
          .forEach(function(entry) {
            var idx = Math.max(0, Math.min(Number(entry.index), ed.items.length));
            ed.items.splice(idx, 0, entry.item);
          });
        renderEditorTable();
        setStatus(
          dom.editStatus,
          '批量删除部分失败：成功 ' + (toDelete.length - failures.length) + ' 条，失败 ' + failures.length + ' 条',
          'warn'
        );
	      }).catch(function(e) {
	        setStatus(dom.editStatus, e && e.message ? e.message : '批量删除入库失败', 'err');
	      }).finally(function() {
	        clearPendingOp();
	      });
	      return;
	    }

    if (op.type === 'insert_batch' && Array.isArray(op.itemKeys)) {
      var keys = op.itemKeys.slice();
      var entries = [];
      keys.forEach(function(key) {
        var idx = ed.items.findIndex(function(it) { return it && it.__localId === key; });
        if (idx === -1) return;
        var item = ed.items[idx];
        if (!item) return;
        syncEditorRowInputToItem(idx, item, { skipEmptyRequired: true });
        entries.push({ index: idx, item: item, key: key });
      });

      if (!entries.length) {
        ed.pendingOp = null;
        setStatus(dom.editStatus, '批量新增已撤回或不存在', 'warn');
        renderEditorTable();
        return;
      }

      function settle(p) {
        return Promise.resolve(p).then(
          function(v) { return { status: 'fulfilled', value: v }; },
          function(err) { return { status: 'rejected', reason: err }; }
        );
      }

      var promises = entries.map(function(entry, seq) {
        var item = entry.item || {};
        var uiKey = getCaseLibraryEditorUiKey(item);
        var module = normalizeEditorText(item.module);
        var title = normalizeEditorText(item.title);
        var priority = normalizeEditorText(item.priority);
        var pre = normalizeEditorText(item.precondition);
        var steps = normalizeEditorText(item.steps);

        var expectedRaw = item.expected !== null && item.expected !== undefined ? String(item.expected) : '';
        var expectedNorm = normalizeEditorText(expectedRaw);
        var expected = expectedNorm ? expectedNorm : expectedRaw;
        if (!expected) expected = buildInvisibleMarker(String(item.__localId || '') + '|' + seq);

        var payload = {
          module: module,
          title: title,
          expected: expected,
          priority: priority || null,
          precondition: pre || '',
          steps: steps || '',
          remark: normalizeEditorText(item.remark) || null,
        };

        return settle(apiClient.createCaseItem(file.id, payload, { batch: true }).then(function(created) {
          if (!created) return created;
          ensureNonEnumerableKey(created, '__uiKey', uiKey || '');
          ed.items[entry.index] = created;
          markCaseLibraryNewAdded(file.id, created);
          return created;
        }));
      });

	      Promise.all(promises).then(function(results) {
	        var failures = [];
	        for (var i = 0; i < results.length; i += 1) {
	          if (results[i] && results[i].status === 'rejected') failures.push(entries[i]);
	        }
        var currentCount2 = ed.items.length;
        var successCount2 = entries.length - failures.length;
        var beforeCount2 = Math.max(currentCount2 - entries.length, 0);
        var afterCount2 = beforeCount2 + successCount2;
        safeLogOperation(
          'batch_create_case_items',
          'case_item',
          null,
          {
            case_file_id: file.id,
            file_name: file.file_name_clean || '',
            count: entries.length,
            success: entries.length - failures.length,
            fail: failures.length,
            before_count: beforeCount2,
            after_count: afterCount2,
          },
          failures.length ? 'partial' : 'success'
        );
        if (!failures.length) {
          setStatus(dom.editStatus, '批量新增已入库（' + entries.length + '条）', 'ok');
          if (isCaseLibraryEditorEditing()) {
            state.editor.pendingRender = true;
          } else {
            renderEditorTable();
          }
          return;
        }
        setStatus(dom.editStatus, '批量新增部分失败：成功 ' + (entries.length - failures.length) + ' 条，失败 ' + failures.length + ' 条', 'warn');
        if (isCaseLibraryEditorEditing()) {
          state.editor.pendingRender = true;
        } else {
          renderEditorTable();
        }
	      }).catch(function(e) {
	        setStatus(dom.editStatus, e && e.message ? e.message : '批量新增入库失败', 'err');
	      }).finally(function() {
	        clearPendingOp();
	      });
	      return;
	    }

    if (op.type === 'insert' && op.itemKey) {
      var createIndex = ed.items.findIndex(function(it) { return it && it.__localId === op.itemKey; });
      if (createIndex === -1) {
        clearPendingOp();
        setStatus(dom.editStatus, '新增用例已撤回或不存在', 'warn');
        return;
      }
      var newItem = ed.items[createIndex];
      syncEditorRowInputToItem(createIndex, newItem, { skipEmptyRequired: true });
      var uiKey = getCaseLibraryEditorUiKey(newItem);
      var payload = buildCaseItemPayload(newItem);
      var err = validatePayload(payload);
      if (err) {
        clearPendingOp();
        setStatus(dom.editStatus, '新增用例未入库：' + err, 'warn');
        return;
      }
      apiClient.createCaseItem(file.id, payload).then(function(created) {
        if (created) {
          ensureNonEnumerableKey(created, '__uiKey', uiKey || '');
          ed.items[createIndex] = created;
          markCaseLibraryNewAdded(file.id, created);
        }
        setStatus(dom.editStatus, '新增已入库', 'ok');
        if (isCaseLibraryEditorEditing()) {
          state.editor.pendingRender = true;
        } else {
          renderEditorTable();
        }
	      }).catch(function(e) {
	        setStatus(dom.editStatus, e && e.message ? e.message : '新增入库失败', 'err');
	      }).finally(function() {
	        clearPendingOp();
	      });
	      return;
	    }
    clearPendingOp();
    setStatus(dom.editStatus, '变更已应用', 'ok');
  }

	  function insertCaseItem(index, anchorEl) {
	    var ed = state.editor;
	    if (ed.pendingOp) {
	      setStatus(dom.editStatus, '当前有待确认的增删操作，请先撤回或等待入库', 'warn');
      var anchorRectWarn = captureCaseLibraryAnchorRect(anchorEl);
      if (anchorRectWarn) showCaseLibraryBlockHint(anchorRectWarn, '当前有待确认的增删操作，请先撤回或等待入库');
      return;
    }
    var anchorRect = captureCaseLibraryAnchorRect(anchorEl);
    var base = ed.items[index] || {};
    var moduleName = String(base.module || '').trim() || '模块';
    var title = '新用例-' + Math.random().toString(16).slice(2, 6);
    var localId = 'local-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
    var fresh = {
      __localId: localId,
      case_file_id: ed.caseFile ? ed.caseFile.id : null,
      module: moduleName,
      title: title,
      priority: String(base.priority || '').trim() || 'P1',
      precondition: '',
      steps: '',
      expected: '待补充',
      remark: '',
    };
    ensureNonEnumerableKey(fresh, '__uiKey', '');
    var insertAt = Math.min(Math.max(index + 1, 0), ed.items.length);
    ed.items.splice(insertAt, 0, fresh);
    markCaseLibraryNewAdded(ed.caseFile ? ed.caseFile.id : null, fresh);
    ed.selection = new Set();
    ed.remarkOpen = new Set();
    ed.pageIndex = Math.floor(insertAt / getPageSize());
    ed.pendingOp = { type: 'insert', itemKey: localId, index: insertAt };
	    renderEditorTable();
	    startPendingToast('已新增用例，超时将自动入库', { anchorRect: anchorRect });
	  }

	  function parseBatchAddCountInput(raw) {
	    var text = raw === null || raw === undefined ? '' : String(raw);
	    text = text.trim();
	    if (!text) return { ok: false, reason: '请输入批量新增数量（1-10）' };
	    if (!/^\d+$/.test(text)) return { ok: false, reason: '数量仅支持正整数（1-10）' };
	    var n = Number(text);
	    if (!isFinite(n)) return { ok: false, reason: '数量格式不正确' };
	    n = Math.floor(n);
	    if (n < 1) return { ok: false, reason: '数量最小为 1' };
	    if (n > 10) return { ok: false, reason: '数量最大为 10' };
	    return { ok: true, value: n };
	  }

	  function setBatchAddCountInputInvalid(invalid) {
	    if (!dom.editBatchAddCountInput || !dom.editBatchAddCountInput.classList) return;
	    if (invalid) dom.editBatchAddCountInput.classList.add('input-invalid');
	    else dom.editBatchAddCountInput.classList.remove('input-invalid');
	  }

	  function batchInsertCaseItems(anchorEl) {
	    var ed = state.editor;
	    if (!ed) return;
	    if (ed.pendingOp) {
	      setStatus(dom.editStatus, '当前有待确认的增删操作，请先撤回或等待入库', 'warn');
	      var anchorRectWarn = captureCaseLibraryAnchorRect(anchorEl);
	      if (anchorRectWarn) showCaseLibraryBlockHint(anchorRectWarn, '当前有待确认的增删操作，请先撤回或等待入库');
	      return;
	    }
	    if (!ed.caseFile) {
	      setStatus(dom.editStatus, '请先选择用例', 'warn');
	      return;
	    }

	    var raw = dom.editBatchAddCountInput ? dom.editBatchAddCountInput.value : (ed.batchAddCount || 5);
	    var parsed = parseBatchAddCountInput(raw);
	    if (!parsed.ok) {
	      setBatchAddCountInputInvalid(true);
	      setStatus(dom.editStatus, parsed.reason || '批量新增数量不合法', 'warn');
	      return;
	    }
	    setBatchAddCountInputInvalid(false);

	    var count = parsed.value;
	    ed.batchAddCount = count;
	    persistEditorBatchAddCount(count);

	    var anchorRect = captureCaseLibraryAnchorRect(anchorEl);
	    var fileId = ed.caseFile ? ed.caseFile.id : null;
	    var startIndex = ed.items.length;
	    var keys = [];
	    for (var i = 0; i < count; i += 1) {
	      var localId = 'local-batch-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6) + '-' + i;
	      var marker = buildInvisibleMarker(localId);
	      var fresh = {
	        __localId: localId,
	        case_file_id: fileId,
	        module: '',
	        title: '',
	        priority: '',
	        precondition: '',
	        steps: '',
	        expected: marker,
	        remark: '',
	      };
	      ensureNonEnumerableKey(fresh, '__uiKey', '');
	      markCaseLibraryNewAdded(fileId, fresh);
	      ed.items.push(fresh);
	      keys.push(localId);
	    }

	    ed.selection = new Set();
	    ed.remarkOpen = new Set();
	    ed.pageIndex = Math.floor(startIndex / getPageSize());
	    ed.pendingOp = { type: 'insert_batch', itemKeys: keys, startIndex: startIndex };
	    renderEditorTable();
	    setTimeout(function() { scrollEditorToIndex(startIndex); }, 0);
	    startPendingToast('已新增用例 ' + keys.length + ' 条，超时将自动入库', { anchorRect: anchorRect });
	  }

	  function removeCaseItem(index, anchorEl) {
	    var ed = state.editor;
	    if (ed.pendingOp) {
	      setStatus(dom.editStatus, '当前有待确认的增删操作，请先撤回或等待入库', 'warn');
      var anchorRectWarn = captureCaseLibraryAnchorRect(anchorEl);
      if (anchorRectWarn) showCaseLibraryBlockHint(anchorRectWarn, '当前有待确认的增删操作，请先撤回或等待入库');
      return;
    }
    var anchorRect = captureCaseLibraryAnchorRect(anchorEl);
    var idx = Math.max(0, Math.min(Number(index), ed.items.length - 1));
    var item = ed.items[idx];
    if (!item) return;
    openConfirmDrawer({
      title: '确认删除用例',
      message: '确定删除该用例吗？可在 8 秒内撤回。',
      confirmText: '确认删除',
      cancelText: '取消',
      danger: true,
      previousDrawer: editDrawerInstance || null,
    }).then(function(res) {
      if (!res || res.ok !== true) return;
      unmarkCaseLibraryNewAdded(ed.caseFile ? ed.caseFile.id : null, item);
      ed.items.splice(idx, 1);
      ed.selection = new Set();
      ed.remarkOpen = new Set();
      ed.pendingOp = { type: 'remove', item: item, index: idx };
	    renderEditorTable();
	    startPendingToast('已删除用例，超时将自动入库', { anchorRect: anchorRect });
    });
  }

	  function removeSelectedCaseItems(anchorEl) {
	    var ed = state.editor;
	    if (!ed) return;
	    if (ed.pendingOp) {
	      setStatus(dom.editStatus, '当前有待确认的增删操作，请先撤回或等待入库', 'warn');
	      var anchorRectWarn = captureCaseLibraryAnchorRect(anchorEl);
	      if (anchorRectWarn) showCaseLibraryBlockHint(anchorRectWarn, '当前有待确认的增删操作，请先撤回或等待入库');
	      return;
	    }
	    if (!ed.caseFile) {
	      setStatus(dom.editStatus, '请先选择用例', 'warn');
	      return;
	    }
	    ed.selection = ed.selection instanceof Set ? ed.selection : new Set();
	    var raw = Array.from(ed.selection);
	    var indices = [];
	    var seen = {};
	    raw.forEach(function(v) {
	      var idx = Number(v);
	      if (!isFinite(idx)) return;
	      if (idx < 0 || idx >= ed.items.length) return;
	      var key = String(idx);
	      if (seen[key]) return;
	      seen[key] = true;
	      indices.push(idx);
	    });
	    if (!indices.length) {
	      setStatus(dom.editStatus, '请先勾选需要删除的用例', 'warn');
	      syncEditorBatchDeleteControls();
	      return;
	    }
    var confirmMsg = '确定删除已勾选的 ' + indices.length + ' 条用例吗？可在 8 秒内撤回。';
    openConfirmDrawer({
      title: '确认批量删除',
      message: confirmMsg,
      confirmText: '确认删除',
      cancelText: '取消',
      danger: true,
      previousDrawer: editDrawerInstance || null,
    }).then(function(res) {
      if (!res || res.ok !== true) return;

      var anchorRect = captureCaseLibraryAnchorRect(anchorEl);
      indices.sort(function(a, b) { return b - a; });
      var removed = [];
      var fileId = ed.caseFile ? ed.caseFile.id : null;
      indices.forEach(function(idx) {
        if (idx < 0 || idx >= ed.items.length) return;
        var item = ed.items[idx];
        if (!item) return;
        removed.push({ index: idx, item: item });
        unmarkCaseLibraryNewAdded(fileId, item);
        ed.items.splice(idx, 1);
      });
      if (!removed.length) {
        setStatus(dom.editStatus, '未删除任何用例', 'warn');
        syncEditorBatchDeleteControls();
        return;
      }
      ed.selection = new Set();
      ed.remarkOpen = new Set();
      ed.pendingOp = { type: 'remove_batch', removed: removed };
      renderEditorTable();
      startPendingToast('已删除用例 ' + removed.length + ' 条，超时将自动入库', { anchorRect: anchorRect });
    });
  }

	  function toggleRemark(index) {
	    var idx = Number(index);
	    if (!isFinite(idx)) return;
    if (state.editor.remarkOpen.has(idx)) state.editor.remarkOpen.delete(idx);
    else state.editor.remarkOpen.add(idx);
    renderEditorTable();
  }

  function handlePaginationAction(action) {
    var matches = applyEditorFilter();
    var total = matches.length;
    var totalPages = total ? Math.ceil(total / getPageSize()) : 1;
    if (action === 'prev') state.editor.pageIndex = Math.max(0, state.editor.pageIndex - 1);
    if (action === 'next') state.editor.pageIndex = Math.min(totalPages - 1, state.editor.pageIndex + 1);
    renderEditorTable();
  }

  function handlePaginationJump(page) {
    var matches = applyEditorFilter();
    var total = matches.length;
    var totalPages = total ? Math.ceil(total / getPageSize()) : 1;
    var target = Math.max(1, Math.min(Number(page) || 1, totalPages));
    state.editor.pageIndex = Math.max(0, target - 1);
    renderEditorTable();
  }

  function copyCaseExecFields(target, source) {
    if (!target || !source) return;
    if (source.actual) target.actual = source.actual;
    if (source.remark) target.remark = source.remark;
    if (Array.isArray(source.defectLinks)) {
      target.defectLinks = source.defectLinks.map(function(link) { return Object.assign({}, link); });
    }
    if (Array.isArray(source.reuseDetails)) {
      target.reuseDetails = source.reuseDetails.map(function(detail) { return Object.assign({}, detail); });
    }
  }

  function buildExecMatchKey(item) {
    var module = String(item && item.module ? item.module : '').trim();
    var title = String(item && item.title ? item.title : '').trim();
    var expected = String(item && item.expected ? item.expected : '').trim();
    return normalizeName(module) + '::' + normalizeName(title) + '::' + normalizeName(expected);
  }

  function resolveExecCaseName(caseFile, fileName) {
    var raw = '';
    if (caseFile && caseFile.file_name_clean) raw = caseFile.file_name_clean;
    if (!raw && fileName) raw = fileName;
    var name = String(raw || '').trim();
    if (name) return name;
    if (caseFile && caseFile.id) return '用例#' + caseFile.id;
    return '用例';
  }

  function resolveExecVersionLabel(projectId, execVersionId) {
    if (execVersionId === null || execVersionId === undefined || execVersionId === '') return '未分配版本';
    if (projectId) {
      var name = getVersionName(projectId, execVersionId);
      if (name && name !== '--') return name;
    }
    return '版本#' + execVersionId;
  }

  function transferItemsToTempExec(caseFile, fileName, items, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var statusEl = opts.statusEl || dom.status;
    var shouldSwitchTab = opts.switchTab !== false;
    var skipActiveConfirm = opts.skipActiveConfirm === true;
    var execVersionId = Object.prototype.hasOwnProperty.call(opts, 'execVersionId') ? opts.execVersionId : undefined;
    var previousDrawer = opts.previousDrawer || null;
    var openAssignDrawer = opts.openAssignDrawer === true;
    var associationEnabledProvided = Object.prototype.hasOwnProperty.call(opts, 'association_enabled');
    var projectId = caseFile && caseFile.project_id ? caseFile.project_id : null;
    var execCaseName = resolveExecCaseName(caseFile, fileName);
    var normalizedExecVersionId = execVersionId !== undefined
      ? (execVersionId === '' ? null : execVersionId)
      : (caseFile && caseFile.version_id !== null && caseFile.version_id !== undefined ? caseFile.version_id : null);
    var execVersionLabel = resolveExecVersionLabel(projectId, normalizedExecVersionId);

    var tempExecApi = getTempExecApi();
    if (!tempExecApi || !window.app || !window.app.state) {
      setStatus(statusEl, '执行页未就绪，请先打开一次“用例执行”页签', 'warn');
      return Promise.resolve({ ok: false, reason: 'not_ready' });
    }
    if (isExecDbEnabled() && caseFile && caseFile.id) {
      var name = execCaseName;
      setStatus(statusEl, '转到执行中...', '');
      var targetExecVersionId = normalizedExecVersionId;
      function matchExecVersionId(serverValue, targetValue) {
        if (targetValue === null || targetValue === undefined || targetValue === '') {
          return serverValue === null || serverValue === undefined || String(serverValue) === '';
        }
        return String(serverValue) === String(targetValue);
      }
      return apiClient
        .listExecSets(projectId || undefined)
        .then(function(list) {
          var sets = Array.isArray(list) ? list : [];
          var fileIdNum = Number(caseFile.id);
          var matched = sets.filter(function(s) {
            if (!s || Number(s.case_file_id) !== fileIdNum) return false;
            if (String(s.status || '') !== 'active') return false;
            return matchExecVersionId(s.version_id, targetExecVersionId);
          });
          matched.sort(function(a, b) { return Number(b.id) - Number(a.id); });
          var existingSet = matched.length ? matched[0] : null;
          var confirmPromise = Promise.resolve(true);
          if (!skipActiveConfirm && existingSet && String(existingSet.status || '') === 'active') {
            confirmPromise = openConfirmDrawer({
              title: '确认转到执行',
              message:
                '检测到执行页已存在【' +
                name +
                '】的执行记录，将同步最新用例并尽量保留结果（模块+标题+预期一致保留），是否继续？',
              confirmText: '继续转到执行',
              cancelText: '取消',
              previousDrawer: previousDrawer,
            }).then(function(res) {
              if (!res || res.ok !== true) {
                var cancelErr = new Error('cancelled');
                cancelErr._cancel = true;
                throw cancelErr;
              }
              return true;
            });
          }
          return confirmPromise.then(function() {
            if (!existingSet) return { importCases: [] };
            return apiClient
              .listExecCases(existingSet.id)
              .then(function(cases) {
                var rows = Array.isArray(cases) ? cases : [];
                return { importCases: rows.map(mapExecCaseToImportPayload).filter(Boolean) };
              })
              .catch(function() {
                return { importCases: [] };
              });
          });
        })
        .then(function(ctx) {
          var importCases = ctx && ctx.importCases ? ctx.importCases : [];
          var prefer = importCases.length ? 'import' : 'db';
          var payload = {
            case_file_id: caseFile.id,
            mode: 'replace',
            prefer_result_source: prefer,
            import_cases: importCases.length ? importCases : null,
          };
          if (execVersionId !== undefined) payload.exec_version_id = execVersionId;
          if (associationEnabledProvided) payload.association_enabled = opts.association_enabled === true;
          return apiClient.upsertExecSetFromCaseFile(payload);
        })
        .then(function(execSet) {
          if (!execSet || !execSet.id) throw new Error('执行集创建失败');
          var chain = Promise.resolve();
          if (tempExecApi && typeof tempExecApi.loadTempExecState === 'function') {
            chain = chain.then(function() { return tempExecApi.loadTempExecState(); });
          }
          return chain.then(function() {
            if (tempExecApi && typeof tempExecApi.setTempExecActive === 'function') {
              tempExecApi.setTempExecActive(String(execSet.id));
            }
            return execSet;
          });
        })
        .then(function() {
          setStatus(statusEl, '已转到执行：' + name, 'ok');
          if (openAssignDrawer) {
            requestTempExecAssignDrawer({ caseName: name, versionName: execVersionLabel });
          }
          if (shouldSwitchTab) {
            var coreApi = getCore();
            var switchTab = window.app && typeof window.app.switchTab === 'function'
              ? window.app.switchTab
              : (coreApi && typeof coreApi.switchTab === 'function' ? coreApi.switchTab : null);
            if (typeof switchTab === 'function') switchTab('tempexec');
            var section = document.querySelector('[data-section-id=\"tempexec-view\"]');
            if (section && coreApi && typeof coreApi.scrollElementIntoView === 'function') {
              coreApi.scrollElementIntoView(section, 'smooth', 140);
            }
          }
          return { ok: true };
        })
        .catch(function(err) {
          if (err && err._cancel) return { ok: false, reason: 'cancel' };
          setStatus(statusEl, '转到执行失败：' + (err && err.message ? err.message : '未知错误'), 'err');
          return { ok: false, err: err };
        });
    }
    var globalState = window.app.state;
    if (!Array.isArray(globalState.tempExecFiles)) globalState.tempExecFiles = [];
    if (!globalState.tempExecPages || typeof globalState.tempExecPages !== 'object') globalState.tempExecPages = {};

    var list = Array.isArray(items) ? items.slice() : [];
    list = list.filter(function(it) {
      return it && String(it.module || '').trim() && String(it.title || '').trim() && String(it.expected || '').trim();
    });
    if (!list.length) {
      setStatus(statusEl, '用例为空或缺少必填字段（模块/标题/预期结果）', 'warn');
      return Promise.resolve({ ok: false, reason: 'empty' });
    }

    var name = execCaseName;
    var normalizeTempName = utils && typeof utils.normalizeTempExecName === 'function'
      ? utils.normalizeTempExecName
      : function(v) { return String(v || '').trim().toLowerCase(); };
    var normalized = normalizeTempName(name);

    var existing = globalState.tempExecFiles.find(function(f) {
      return normalizeTempName(f && f.name) === normalized;
    }) || null;

    if (existing) {
      var ok = window.confirm('检测到名称为【' + name + '】的用例已存在，将用最新用例覆盖并尽量保留执行结果（标题+预期一致保留），是否继续？');
      if (!ok) return Promise.resolve({ ok: false, reason: 'cancel' });

      var rebuilt = tempExecApi.createTempExecFile(
        existing.name,
        list,
        existing.scope,
        existing.id,
        existing.createdAt,
        existing.requirement
      );
      if (!rebuilt) {
        setStatus(statusEl, '转到执行失败：未解析到有效用例', 'err');
        return Promise.resolve({ ok: false, reason: 'invalid' });
      }
      rebuilt.reuseEnabled = Boolean(existing.reuseEnabled);
      rebuilt.reusePresets = Array.isArray(existing.reusePresets) ? existing.reusePresets : [];
      rebuilt.versionId = existing.versionId || '';

      var oldMap = new Map();
      (existing.cases || []).forEach(function(c) {
        oldMap.set(buildExecMatchKey(c), c);
      });
      (rebuilt.cases || []).forEach(function(c) {
        var old = oldMap.get(buildExecMatchKey(c));
        if (!old) return;
        copyCaseExecFields(c, old);
      });

      var idx = globalState.tempExecFiles.findIndex(function(f) { return f && f.id === existing.id; });
      if (idx !== -1) {
        globalState.tempExecFiles[idx] = rebuilt;
      } else {
        globalState.tempExecFiles.push(rebuilt);
      }
      if (typeof tempExecApi.clearTempExecCaseStates === 'function') {
        tempExecApi.clearTempExecCaseStates(existing.id);
      }
      globalState.tempExecPages[rebuilt.id] = 0;
      if (typeof tempExecApi.persistTempExecState === 'function') tempExecApi.persistTempExecState();
      if (typeof tempExecApi.syncTempExecFocus === 'function') tempExecApi.syncTempExecFocus();
      if (typeof tempExecApi.setTempExecActive === 'function') tempExecApi.setTempExecActive(rebuilt.id);
      setStatus(statusEl, '已覆盖并转到执行：' + name, 'ok');
    } else {
      var entry = tempExecApi.createTempExecFile(name, list, 'current', null, null, globalState.requirementLabel);
      if (!entry) {
        setStatus(statusEl, '转到执行失败：未解析到有效用例', 'err');
        return Promise.resolve({ ok: false, reason: 'invalid' });
      }
      globalState.tempExecFiles.push(entry);
      globalState.tempExecPages[entry.id] = 0;
      if (typeof tempExecApi.persistTempExecState === 'function') tempExecApi.persistTempExecState();
      if (typeof tempExecApi.syncTempExecFocus === 'function') tempExecApi.syncTempExecFocus();
      if (typeof tempExecApi.setTempExecActive === 'function') tempExecApi.setTempExecActive(entry.id);
      setStatus(statusEl, '已转到执行：' + name, 'ok');
    }

    if (openAssignDrawer) {
      requestTempExecAssignDrawer({ caseName: name, versionName: execVersionLabel });
    }
    if (shouldSwitchTab) {
      var coreApi = getCore();
      var switchTab = window.app && typeof window.app.switchTab === 'function'
        ? window.app.switchTab
        : (coreApi && typeof coreApi.switchTab === 'function' ? coreApi.switchTab : null);
      if (typeof switchTab === 'function') switchTab('tempexec');
      var section = document.querySelector('[data-section-id=\"tempexec-view\"]');
      if (section && coreApi && typeof coreApi.scrollElementIntoView === 'function') {
        coreApi.scrollElementIntoView(section, 'smooth', 140);
      }
    }
    return Promise.resolve({ ok: true });
  }

  function getSelectDrawerVisibleFiles() {
    var list = Array.isArray(state.selectDrawer.files) ? state.selectDrawer.files : [];
    var term = String(state.selectDrawer.searchText || '').trim().toLowerCase();
    if (term) {
      list = list.filter(function(f) {
        var name = f && f.file_name_clean ? String(f.file_name_clean) : (f && f.file_name ? String(f.file_name) : '');
        return name.toLowerCase().indexOf(term) !== -1;
      });
      return list;
    }
    if (state.selectDrawer.versionId) {
      list = list.filter(function(f) { return String(f && f.version_id || '') === String(state.selectDrawer.versionId || ''); });
    }
    return list;
  }

  function getSelectDrawerPagedFiles() {
    var visible = getSelectDrawerVisibleFiles();
    var page = resolveDrawerPage(visible.length, state.selectDrawer.pageIndex);
    state.selectDrawer.pageIndex = page.pageIndex;
    return {
      page: page,
      list: visible.slice(page.start, page.end),
      total: visible.length,
    };
  }

  function syncSelectDrawerControls() {
    if (!dom.selectBatchExecBtn && !dom.selectSelectAll) return;
    state.selectDrawer.selection = state.selectDrawer.selection instanceof Set ? state.selectDrawer.selection : new Set();

    var visible = getSelectDrawerVisibleFiles();
    var page = resolveDrawerPage(visible.length, state.selectDrawer.pageIndex);
    state.selectDrawer.pageIndex = page.pageIndex;
    var paged = visible.slice(page.start, page.end);
    var visibleIds = {};
    visible.forEach(function(f) {
      if (!f || !f.id) return;
      visibleIds[String(f.id)] = true;
    });

    var nextSel = new Set();
    state.selectDrawer.selection.forEach(function(id) {
      if (visibleIds[String(id)]) nextSel.add(String(id));
    });
    state.selectDrawer.selection = nextSel;

    var total = visible.length;
    var selected = state.selectDrawer.selection.size;
    var loading = Boolean(state.selectDrawer.loading || state.selectDrawer.processing);

    if (dom.selectBatchExecBtn) {
      dom.selectBatchExecBtn.disabled = loading || selected === 0;
    }
    if (dom.selectSelectAll) {
      var pageTotal = paged.length;
      var pageSelected = paged.reduce(function(count, f) {
        if (!f || !f.id) return count;
        return state.selectDrawer.selection.has(String(f.id)) ? count + 1 : count;
      }, 0);
      dom.selectSelectAll.checked = Boolean(pageTotal && pageSelected === pageTotal);
      dom.selectSelectAll.indeterminate = Boolean(pageSelected && pageSelected < pageTotal);
    }
  }

  function setSelectDrawerSelectionAll(checked) {
    state.selectDrawer.selection = state.selectDrawer.selection instanceof Set ? state.selectDrawer.selection : new Set();
    var pageData = getSelectDrawerPagedFiles();
    var visible = pageData.list;
    if (checked) {
      visible.forEach(function(f) {
        if (!f || !f.id) return;
        state.selectDrawer.selection.add(String(f.id));
      });
    } else {
      visible.forEach(function(f) {
        if (!f || !f.id) return;
        state.selectDrawer.selection.delete(String(f.id));
      });
    }
    renderSelectDrawerList();
    syncSelectDrawerControls();
  }

  function normalizeAssociationSwitchState(value) {
    return value === true || value === 1 || value === '1' || value === 'true' || value === 'on';
  }

  function getAssociationSwitchState(fileId, defaultValue) {
    if (!fileId && fileId !== 0) return normalizeAssociationSwitchState(defaultValue);
    var key = String(fileId);
    var map = state.selectDrawer.associationSwitchByFileId && typeof state.selectDrawer.associationSwitchByFileId === 'object'
      ? state.selectDrawer.associationSwitchByFileId
      : {};
    state.selectDrawer.associationSwitchByFileId = map;
    if (!Object.prototype.hasOwnProperty.call(map, key)) {
      map[key] = normalizeAssociationSwitchState(defaultValue);
    }
    return normalizeAssociationSwitchState(map[key]);
  }

  function setAssociationSwitchState(fileId, value) {
    if (!fileId && fileId !== 0) return;
    var key = String(fileId);
    var map = state.selectDrawer.associationSwitchByFileId && typeof state.selectDrawer.associationSwitchByFileId === 'object'
      ? state.selectDrawer.associationSwitchByFileId
      : {};
    state.selectDrawer.associationSwitchByFileId = map;
    map[key] = normalizeAssociationSwitchState(value);
  }

  function syncAssociationSwitchMapWithFiles(files) {
    var list = Array.isArray(files) ? files : [];
    var map = state.selectDrawer.associationSwitchByFileId && typeof state.selectDrawer.associationSwitchByFileId === 'object'
      ? state.selectDrawer.associationSwitchByFileId
      : {};
    var keep = {};
    list.forEach(function(file) {
      if (!file || (file.id === null || file.id === undefined)) return;
      var key = String(file.id);
      var hasAssociation = Number(file && file.association_count ? file.association_count : 0) > 0;
      if (!Object.prototype.hasOwnProperty.call(map, key)) {
        map[key] = hasAssociation;
      } else if (!hasAssociation) {
        map[key] = false;
      }
      keep[key] = true;
    });
    Object.keys(map).forEach(function(key) {
      if (!keep[key]) delete map[key];
    });
    state.selectDrawer.associationSwitchByFileId = map;
  }

  function normalizeCaseItemSelectionIds(itemIds) {
    var list = Array.isArray(itemIds) ? itemIds : [];
    var seen = {};
    var ids = [];
    list.forEach(function(raw) {
      var id = normalizeId(raw);
      if (!id || id <= 0) return;
      var key = String(id);
      if (seen[key]) return;
      seen[key] = true;
      ids.push(id);
    });
    return ids;
  }

  function getAssociationPickVisibleItems() {
    var list = Array.isArray(state.associationPickDrawer.items) ? state.associationPickDrawer.items : [];
    var page = resolveDrawerPage(list.length, state.associationPickDrawer.pageIndex);
    state.associationPickDrawer.pageIndex = page.pageIndex;
    return {
      page: page,
      list: list.slice(page.start, page.end),
      total: list.length,
    };
  }

  function syncAssociationPickSelectAllState() {
    if (!dom.associationPickSelectAll) return;
    var result = getAssociationPickVisibleItems();
    var paged = result.list;
    var total = paged.length;
    var selection = state.associationPickDrawer.selection instanceof Set ? state.associationPickDrawer.selection : new Set();
    state.associationPickDrawer.selection = selection;
    var selected = 0;
    paged.forEach(function(item) {
      if (!item || !item.id) return;
      if (selection.has(String(item.id))) selected += 1;
    });
    dom.associationPickSelectAll.checked = total > 0 && selected === total;
    dom.associationPickSelectAll.indeterminate = selected > 0 && selected < total;
    dom.associationPickSelectAll.disabled = total === 0 || Boolean(state.associationPickDrawer.loadingItems || state.associationPickDrawer.processing);
  }

  function setAssociationPickSelectionAll(checked) {
    var result = getAssociationPickVisibleItems();
    var paged = result.list;
    var selection = state.associationPickDrawer.selection instanceof Set ? state.associationPickDrawer.selection : new Set();
    state.associationPickDrawer.selection = selection;
    paged.forEach(function(item) {
      if (!item || !item.id) return;
      var key = String(item.id);
      if (checked) selection.add(key);
      else selection.delete(key);
    });
    renderAssociationPickItemList();
  }

  function syncAssociationAddButtonState() {
    if (!dom.associationAddBtn) return;
    var disabled = Boolean(state.associationDrawer.loading || state.associationDrawer.processing || !state.associationDrawer.caseFile);
    dom.associationAddBtn.disabled = disabled;
  }

  function resetAssociationDrawer() {
    state.associationDrawer.caseFile = null;
    state.associationDrawer.rows = [];
    state.associationDrawer.loading = false;
    state.associationDrawer.processing = false;
    state.associationDrawer.previousDrawer = null;
    state.associationDrawer.pendingAction = '';
    state.associationDrawer.pendingAssociationId = null;
    if (dom.associationCaseName) dom.associationCaseName.textContent = '--';
    if (dom.associationStatus) setStatus(dom.associationStatus, '', '');
    renderAssociationDrawerList();
    syncAssociationAddButtonState();
  }

  function renderAssociationDrawerList() {
    if (!dom.associationListBody) return;
    var rows = Array.isArray(state.associationDrawer.rows) ? state.associationDrawer.rows : [];
    if (state.associationDrawer.loading) {
      dom.associationListBody.innerHTML = '<tr><td colspan="3"><p class="hint">加载中...</p></td></tr>';
      return;
    }
    if (!rows.length) {
      dom.associationListBody.innerHTML = '<tr><td colspan="3"><p class="hint">暂无关联副用例</p></td></tr>';
      return;
    }
    dom.associationListBody.innerHTML = rows.map(function(row) {
      if (!row) return '';
      var id = row.id ? String(row.id) : '';
      var name = row.sub_case_file_name || ('用例#' + (row.sub_case_file_id || '--'));
      var count = Number(row.selected_count || (Array.isArray(row.selected_case_item_ids) ? row.selected_case_item_ids.length : 0));
      return (
        '<tr>' +
          '<td>' + escapeHtml(name) + '</td>' +
          '<td>' + escapeHtml(count) + '</td>' +
          '<td>' +
            '<button class="secondary" type="button" data-case-lib-assoc-edit="' + escapeHtml(id) + '">编辑</button>' +
            ' ' +
            '<button class="secondary" type="button" data-case-lib-assoc-delete="' + escapeHtml(id) + '">删除</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function loadAssociationDrawerRows(caseFileId) {
    if (!apiClient || typeof apiClient.listCaseFileAssociations !== 'function') {
      return Promise.resolve([]);
    }
    return apiClient.listCaseFileAssociations(caseFileId).then(function(rows) {
      var list = Array.isArray(rows) ? rows : [];
      state.associationDrawer.rows = list.map(function(row) {
        var ids = normalizeCaseItemSelectionIds(row && row.selected_case_item_ids);
        return Object.assign({}, row, {
          selected_case_item_ids: ids,
          selected_count: ids.length,
        });
      });
      return state.associationDrawer.rows;
    });
  }

  function openAssociationDrawerFromSelect(caseFile) {
    if (!caseFile || !caseFile.id) return;
    var previous = selectDrawerInstance || null;
    state.associationDrawer.caseFile = caseFile;
    state.associationDrawer.previousDrawer = previous;
    state.associationDrawer.rows = [];
    state.associationDrawer.loading = true;
    renderAssociationDrawerList();
    syncAssociationAddButtonState();
    if (dom.associationCaseName) {
      dom.associationCaseName.textContent = caseFile.file_name_clean || ('用例#' + caseFile.id);
    }
    if (dom.associationStatus) setStatus(dom.associationStatus, '加载关联信息...', '');
    if (associationDrawerInstance && typeof associationDrawerInstance.open === 'function') {
      associationDrawerInstance.open();
    }
    loadAssociationDrawerRows(caseFile.id)
      .then(function(rows) {
        state.associationDrawer.loading = false;
        renderAssociationDrawerList();
        syncAssociationAddButtonState();
        var hasRows = Array.isArray(rows) && rows.length > 0;
        if (dom.associationStatus) {
          setStatus(dom.associationStatus, hasRows ? ('已加载 ' + rows.length + ' 条关联') : '当前暂无关联', hasRows ? 'ok' : 'warn');
        }
      })
      .catch(function(err) {
        state.associationDrawer.loading = false;
        state.associationDrawer.rows = [];
        renderAssociationDrawerList();
        syncAssociationAddButtonState();
        if (dom.associationStatus) setStatus(dom.associationStatus, err && err.message ? err.message : '加载关联失败', 'err');
      });
  }

  function closeAssociationDrawerAndResume() {
    if (associationDrawerInstance && typeof associationDrawerInstance.close === 'function') {
      associationDrawerInstance.close();
      return;
    }
    if (selectDrawerInstance && typeof selectDrawerInstance.open === 'function') {
      selectDrawerInstance.open();
    }
  }

  function resetAssociationPickDrawer() {
    state.associationPickDrawer.mode = 'create';
    state.associationPickDrawer.mainCaseFile = null;
    state.associationPickDrawer.associationId = null;
    state.associationPickDrawer.subCaseFile = null;
    state.associationPickDrawer.originalSubCaseFileId = null;
    state.associationPickDrawer.originalSelectedCaseItemIds = [];
    state.associationPickDrawer.versionId = null;
    state.associationPickDrawer.queried = false;
    state.associationPickDrawer.candidateRows = [];
    state.associationPickDrawer.filteredRows = [];
    state.associationPickDrawer.loadingCases = false;
    state.associationPickDrawer.loadingItems = false;
    state.associationPickDrawer.processing = false;
    state.associationPickDrawer.searchText = '';
    state.associationPickDrawer.selection = new Set();
    state.associationPickDrawer.items = [];
    state.associationPickDrawer.pageIndex = 0;
    state.associationPickDrawer.previousDrawer = null;
    if (dom.associationPickStatus) setStatus(dom.associationPickStatus, '', '');
    if (dom.associationPickVersionSelect) {
      dom.associationPickVersionSelect.disabled = true;
      dom.associationPickVersionSelect.innerHTML = '<option value="">请选择版本</option>';
      dom.associationPickVersionSelect.value = '';
    }
    if (dom.associationPickSearchInput) dom.associationPickSearchInput.value = '';
    if (dom.associationPickSubCaseName) dom.associationPickSubCaseName.textContent = '--';
    if (dom.associationPickCaseBody) {
      dom.associationPickCaseBody.innerHTML = '<tr><td colspan="4"><p class="hint">请先选择版本并查询</p></td></tr>';
    }
    renderAssociationPickItemList();
  }

  function filterAssociationCandidateRows() {
    var rows = Array.isArray(state.associationPickDrawer.candidateRows) ? state.associationPickDrawer.candidateRows : [];
    var term = String(state.associationPickDrawer.searchText || '').trim().toLowerCase();
    if (!term) {
      state.associationPickDrawer.filteredRows = rows.slice();
      return;
    }
    state.associationPickDrawer.filteredRows = rows.filter(function(row) {
      if (!row) return false;
      var name = row.file_name_clean ? String(row.file_name_clean).toLowerCase() : '';
      return name.indexOf(term) !== -1;
    });
  }

  function renderAssociationCandidateList() {
    if (!dom.associationPickCaseBody) return;
    if (state.associationPickDrawer.loadingCases) {
      dom.associationPickCaseBody.innerHTML = '<tr><td colspan="4"><p class="hint">加载中...</p></td></tr>';
      return;
    }
    var rows = Array.isArray(state.associationPickDrawer.filteredRows) ? state.associationPickDrawer.filteredRows : [];
    if (!rows.length) {
      var emptyHint = state.associationPickDrawer.queried ? '暂无可选副用例' : '请先选择版本并查询';
      dom.associationPickCaseBody.innerHTML = '<tr><td colspan="4"><p class="hint">' + escapeHtml(emptyHint) + '</p></td></tr>';
      return;
    }
    var currentSubId = state.associationPickDrawer.subCaseFile && state.associationPickDrawer.subCaseFile.id
      ? String(state.associationPickDrawer.subCaseFile.id)
      : '';
    dom.associationPickCaseBody.innerHTML = rows.map(function(row) {
      if (!row) return '';
      var id = row.id ? String(row.id) : '';
      var checked = currentSubId && currentSubId === id ? ' checked' : '';
      var disabled = row.association_forbidden ? ' disabled' : '';
      var reason = row.forbidden_reason ? String(row.forbidden_reason) : '';
      var tips = reason ? ('<span class="hint">' + escapeHtml(reason) + '</span>') : '';
      return (
        '<tr>' +
          '<td><input type="radio" name="caseLibraryAssociationSubCase" data-case-lib-assoc-subcase="' + escapeHtml(id) + '"' + checked + disabled + '></td>' +
          '<td>' + escapeHtml(row.file_name_clean || ('用例#' + id)) + (tips ? (' ' + tips) : '') + '</td>' +
          '<td>' + escapeHtml(getVersionName(row.project_id, row.version_id)) + '</td>' +
          '<td>' + escapeHtml(row.item_count || 0) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function renderAssociationPickItemList() {
    if (!dom.associationPickItemBody) return;
    var result = getAssociationPickVisibleItems();
    var list = result.list;
    var total = result.total;
    if (state.associationPickDrawer.loadingItems) {
      dom.associationPickItemBody.innerHTML = '<tr><td colspan="8"><p class="hint">加载用例中...</p></td></tr>';
      setDrawerPagination(dom.associationPickPaginationTop, dom.associationPickPaginationBottom, '');
      syncAssociationPickSelectAllState();
      return;
    }
    if (!state.associationPickDrawer.subCaseFile) {
      dom.associationPickItemBody.innerHTML = '<tr><td colspan="8"><p class="hint">请先在上一步选择副用例</p></td></tr>';
      setDrawerPagination(dom.associationPickPaginationTop, dom.associationPickPaginationBottom, '');
      syncAssociationPickSelectAllState();
      return;
    }
    if (!total) {
      dom.associationPickItemBody.innerHTML = '<tr><td colspan="8"><p class="hint">该副用例暂无条目</p></td></tr>';
      setDrawerPagination(dom.associationPickPaginationTop, dom.associationPickPaginationBottom, '');
      syncAssociationPickSelectAllState();
      return;
    }
    var selection = state.associationPickDrawer.selection instanceof Set ? state.associationPickDrawer.selection : new Set();
    state.associationPickDrawer.selection = selection;
    dom.associationPickItemBody.innerHTML = list.map(function(item, idx) {
      if (!item) return '';
      var id = item.id ? String(item.id) : '';
      var checked = id && selection.has(id) ? ' checked' : '';
      var index = result.page.start + idx + 1;
      return (
        '<tr>' +
          '<td><input type="checkbox" data-case-lib-assoc-item="' + escapeHtml(id) + '"' + checked + '></td>' +
          '<td>' + escapeHtml(index) + '</td>' +
          '<td>' + escapeHtml(item.module || '') + '</td>' +
          '<td>' + escapeHtml(item.title || '') + '</td>' +
          '<td>' + escapeHtml(item.priority || '') + '</td>' +
          '<td>' + escapeHtmlPreserve(item.precondition || '') + '</td>' +
          '<td>' + escapeHtmlPreserve(item.steps || '') + '</td>' +
          '<td>' + escapeHtmlPreserve(item.expected || '') + '</td>' +
        '</tr>'
      );
    }).join('');
    setDrawerPagination(
      dom.associationPickPaginationTop,
      dom.associationPickPaginationBottom,
      buildDrawerPagination(total, result.page.pageIndex, result.page.totalPages, result.page.start, result.page.end, 'association-pick-items')
    );
    syncAssociationPickSelectAllState();
  }

  function prepareAssociationPickVersionOptions(mainCase) {
    var pick = state.associationPickDrawer;
    var projectId = mainCase && mainCase.project_id ? Number(mainCase.project_id) : null;
    if (!dom.associationPickVersionSelect || !projectId) {
      pick.versionId = null;
      return Promise.resolve([]);
    }
    dom.associationPickVersionSelect.disabled = true;
    dom.associationPickVersionSelect.innerHTML = '<option value="">加载版本中...</option>';
    dom.associationPickVersionSelect.value = '';
    return loadVersions(projectId)
      .then(function(list) {
        syncVersionOptions(dom.associationPickVersionSelect, projectId, '请选择版本');
        dom.associationPickVersionSelect.disabled = false;
        var preferredVersionId = mainCase && mainCase.version_id ? Number(mainCase.version_id) : null;
        if (preferredVersionId) {
          dom.associationPickVersionSelect.value = String(preferredVersionId);
          pick.versionId = preferredVersionId;
        } else {
          dom.associationPickVersionSelect.value = '';
          pick.versionId = null;
        }
        return Array.isArray(list) ? list : [];
      })
      .catch(function(err) {
        dom.associationPickVersionSelect.disabled = true;
        dom.associationPickVersionSelect.innerHTML = '<option value="">加载版本失败</option>';
        dom.associationPickVersionSelect.value = '';
        pick.versionId = null;
        if (dom.associationPickStatus) setStatus(dom.associationPickStatus, err && err.message ? err.message : '加载版本失败', 'err');
        return [];
      });
  }

  function clearAssociationCandidateAndItems(keepQueried) {
    state.associationPickDrawer.subCaseFile = null;
    state.associationPickDrawer.candidateRows = [];
    state.associationPickDrawer.filteredRows = [];
    state.associationPickDrawer.items = [];
    state.associationPickDrawer.selection = new Set();
    state.associationPickDrawer.pageIndex = 0;
    if (!keepQueried) state.associationPickDrawer.queried = false;
    renderAssociationCandidateList();
    renderAssociationPickItemList();
  }

  function loadAssociationCandidateRows() {
    var pick = state.associationPickDrawer;
    var mainCase = pick.mainCaseFile;
    if (!mainCase || !mainCase.id || !apiClient || typeof apiClient.listCaseFileAssociationCandidates !== 'function') {
      return Promise.resolve([]);
    }
    var versionId = normalizeId(pick.versionId);
    if (!versionId || versionId <= 0) {
      clearAssociationCandidateAndItems(false);
      if (dom.associationPickStatus) setStatus(dom.associationPickStatus, '请先选择版本', 'warn');
      return Promise.resolve([]);
    }
    pick.queried = true;
    pick.loadingCases = true;
    clearAssociationCandidateAndItems(true);
    renderAssociationCandidateList();
    return apiClient
      .listCaseFileAssociationCandidates(mainCase.id, { include_forbidden: true, version_id: versionId })
      .then(function(rows) {
        pick.loadingCases = false;
        pick.candidateRows = Array.isArray(rows) ? rows : [];
        filterAssociationCandidateRows();
        if (pick.originalSubCaseFileId) {
          var hit = pick.candidateRows.find(function(row) {
            return row && String(row.id) === String(pick.originalSubCaseFileId);
          }) || null;
          pick.subCaseFile = hit;
        }
        renderAssociationCandidateList();
        if (dom.associationPickStatus) {
          setStatus(dom.associationPickStatus, pick.candidateRows.length ? '请选择副用例，点击“下一步选择条目”' : '当前版本暂无可选副用例', pick.candidateRows.length ? 'ok' : 'warn');
        }
        return pick.candidateRows;
      })
      .catch(function(err) {
        pick.loadingCases = false;
        pick.candidateRows = [];
        filterAssociationCandidateRows();
        renderAssociationCandidateList();
        if (dom.associationPickStatus) setStatus(dom.associationPickStatus, err && err.message ? err.message : '加载副用例失败', 'err');
        return [];
      });
  }

  function loadAssociationPickItemsForSubCase(subCase, selectedIds) {
    if (!subCase || !subCase.id || !apiClient || typeof apiClient.listCaseItems !== 'function') {
      state.associationPickDrawer.items = [];
      state.associationPickDrawer.selection = new Set();
      renderAssociationPickItemList();
      return Promise.resolve([]);
    }
    state.associationPickDrawer.loadingItems = true;
    state.associationPickDrawer.pageIndex = 0;
    state.associationPickDrawer.selection = new Set();
    if (dom.associationPickSubCaseName) {
      dom.associationPickSubCaseName.textContent = subCase.file_name_clean || ('用例#' + subCase.id);
    }
    renderAssociationPickItemList();
    return apiClient
      .listCaseItems(subCase.id)
      .then(function(items) {
        var list = Array.isArray(items) ? items : [];
        state.associationPickDrawer.items = list;
        var idSet = {};
        normalizeCaseItemSelectionIds(selectedIds).forEach(function(id) {
          idSet[String(id)] = true;
        });
        var selection = new Set();
        list.forEach(function(item) {
          if (!item || !item.id) return;
          if (idSet[String(item.id)]) selection.add(String(item.id));
        });
        state.associationPickDrawer.selection = selection;
        state.associationPickDrawer.loadingItems = false;
        renderAssociationPickItemList();
        if (dom.associationPickStatus) setStatus(dom.associationPickStatus, '已加载副用例条目', 'ok');
        return list;
      })
      .catch(function(err) {
        state.associationPickDrawer.loadingItems = false;
        state.associationPickDrawer.items = [];
        state.associationPickDrawer.selection = new Set();
        renderAssociationPickItemList();
        if (dom.associationPickStatus) setStatus(dom.associationPickStatus, err && err.message ? err.message : '加载副用例条目失败', 'err');
        return [];
      });
  }

  function openAssociationPickDrawer(mode, mainCaseFile, associationRow) {
    var m = mode === 'edit' ? 'edit' : 'create';
    state.associationPickDrawer.mode = m;
    state.associationPickDrawer.mainCaseFile = mainCaseFile || null;
    state.associationPickDrawer.associationId = associationRow && associationRow.id ? associationRow.id : null;
    state.associationPickDrawer.subCaseFile = null;
    state.associationPickDrawer.originalSubCaseFileId = associationRow && associationRow.sub_case_file_id ? associationRow.sub_case_file_id : null;
    state.associationPickDrawer.originalSelectedCaseItemIds = normalizeCaseItemSelectionIds(
      associationRow && associationRow.selected_case_item_ids ? associationRow.selected_case_item_ids : []
    );
    state.associationPickDrawer.searchText = '';
    state.associationPickDrawer.items = [];
    state.associationPickDrawer.selection = new Set();
    state.associationPickDrawer.pageIndex = 0;
    state.associationPickDrawer.versionId = null;
    state.associationPickDrawer.queried = false;
    state.associationPickDrawer.previousDrawer = associationDrawerInstance || null;
    if (associationItemDrawerInstance && typeof associationItemDrawerInstance.close === 'function') {
      associationItemDrawerInstance.close();
    }
    if (dom.associationPickSearchInput) dom.associationPickSearchInput.value = '';
    clearAssociationCandidateAndItems(false);
    if (m === 'edit') {
      var editSubCaseId = normalizeId(associationRow && associationRow.sub_case_file_id ? associationRow.sub_case_file_id : null);
      if (editSubCaseId && editSubCaseId > 0) {
        state.associationPickDrawer.subCaseFile = {
          id: editSubCaseId,
          file_name_clean: associationRow && associationRow.sub_case_file_name
            ? String(associationRow.sub_case_file_name)
            : ('用例#' + editSubCaseId),
        };
        if (dom.associationPickStatus) setStatus(dom.associationPickStatus, '加载副用例条目中...', '');
        if (associationItemDrawerInstance && typeof associationItemDrawerInstance.open === 'function') {
          associationItemDrawerInstance.open();
        }
        loadAssociationPickItemsForSubCase(state.associationPickDrawer.subCaseFile, state.associationPickDrawer.originalSelectedCaseItemIds);
        return;
      }
    }
    if (dom.associationPickStatus) setStatus(dom.associationPickStatus, '加载版本中...', '');
    if (associationPickDrawerInstance && typeof associationPickDrawerInstance.open === 'function') {
      associationPickDrawerInstance.open();
    }
    prepareAssociationPickVersionOptions(mainCaseFile).then(function() {
      renderAssociationCandidateList();
      if (dom.associationPickStatus) {
        setStatus(dom.associationPickStatus, '请选择版本并查询副用例', '');
      }
    });
  }

  function openAssociationItemDrawerFromPick() {
    var pick = state.associationPickDrawer;
    var mainCase = pick.mainCaseFile;
    var subCase = pick.subCaseFile;
    if (!mainCase || !mainCase.id) {
      if (dom.associationPickStatus) setStatus(dom.associationPickStatus, '主用例缺失', 'err');
      return;
    }
    if (!subCase || !subCase.id) {
      if (dom.associationPickStatus) setStatus(dom.associationPickStatus, '请先选择副用例', 'warn');
      return;
    }
    var selectedIds = [];
    if (
      pick.mode === 'edit' &&
      pick.originalSubCaseFileId &&
      String(subCase.id) === String(pick.originalSubCaseFileId)
    ) {
      selectedIds = Array.isArray(pick.originalSelectedCaseItemIds) ? pick.originalSelectedCaseItemIds.slice() : [];
    }
    if (dom.associationPickSubCaseName) {
      dom.associationPickSubCaseName.textContent = subCase.file_name_clean || ('用例#' + subCase.id);
    }
    if (associationItemDrawerInstance && typeof associationItemDrawerInstance.open === 'function') {
      associationItemDrawerInstance.open();
    }
    loadAssociationPickItemsForSubCase(subCase, selectedIds);
  }

  function refreshAssociationDrawerAfterChange(message, type) {
    var caseFile = state.associationDrawer.caseFile;
    if (!caseFile || !caseFile.id) return;
    state.associationDrawer.loading = true;
    renderAssociationDrawerList();
    loadAssociationDrawerRows(caseFile.id)
      .then(function(rows) {
        state.associationDrawer.loading = false;
        renderAssociationDrawerList();
        syncAssociationAddButtonState();
        if (dom.associationStatus) setStatus(dom.associationStatus, message || ('已加载 ' + rows.length + ' 条关联'), type || 'ok');
        if (state.selectDrawer.files && state.selectDrawer.files.length) {
          state.selectDrawer.files = state.selectDrawer.files.map(function(file) {
            if (!file || !caseFile || String(file.id) !== String(caseFile.id)) return file;
            return Object.assign({}, file, { association_count: rows.length });
          });
          syncAssociationSwitchMapWithFiles(state.selectDrawer.files);
          renderSelectDrawerList();
        }
      })
      .catch(function(err) {
        state.associationDrawer.loading = false;
        state.associationDrawer.rows = [];
        renderAssociationDrawerList();
        syncAssociationAddButtonState();
        if (dom.associationStatus) setStatus(dom.associationStatus, err && err.message ? err.message : '刷新关联失败', 'err');
      });
  }

  function submitAssociationItemSelection() {
    var pick = state.associationPickDrawer;
    var mainCase = pick.mainCaseFile;
    var subCase = pick.subCaseFile;
    if (!mainCase || !mainCase.id) {
      if (dom.associationPickStatus) setStatus(dom.associationPickStatus, '主用例缺失', 'err');
      return;
    }
    if (!subCase || !subCase.id) {
      if (dom.associationPickStatus) setStatus(dom.associationPickStatus, '请先选择副用例', 'warn');
      return;
    }
    pick.selection = pick.selection instanceof Set ? pick.selection : new Set();
    var selectedIds = Array.from(pick.selection).map(function(id) { return normalizeId(id); }).filter(function(id) { return id && id > 0; });
    if (!selectedIds.length) {
      showCenterToast('请先勾选用例', 'warn', 5000);
      return;
    }
    if (!apiClient) return;
    pick.processing = true;
    if (dom.associationPickConfirmBtn) dom.associationPickConfirmBtn.disabled = true;
    if (dom.associationPickStatus) setStatus(dom.associationPickStatus, '保存关联中...', '');
    var req = null;
    if (pick.mode === 'edit' && pick.associationId) {
      req = apiClient.updateCaseFileAssociation(mainCase.id, pick.associationId, {
        selected_case_item_ids: selectedIds,
      });
    } else {
      req = apiClient.createCaseFileAssociation(mainCase.id, {
        sub_case_file_id: subCase.id,
        selected_case_item_ids: selectedIds,
      });
    }
    Promise.resolve(req)
      .then(function() {
        pick.processing = false;
        if (dom.associationPickConfirmBtn) dom.associationPickConfirmBtn.disabled = false;
        showCenterToast('已成功追加到主用例。', 'ok', 5000);
        if (associationItemDrawerInstance && typeof associationItemDrawerInstance.close === 'function') {
          associationItemDrawerInstance.close();
        }
        if (associationPickDrawerInstance && typeof associationPickDrawerInstance.close === 'function') {
          associationPickDrawerInstance.close();
        }
        refreshAssociationDrawerAfterChange('已成功追加到主用例。', 'ok');
      })
      .catch(function(err) {
        pick.processing = false;
        if (dom.associationPickConfirmBtn) dom.associationPickConfirmBtn.disabled = false;
        if (dom.associationPickStatus) setStatus(dom.associationPickStatus, err && err.message ? err.message : '保存关联失败', 'err');
        showCenterToast(err && err.message ? err.message : '保存关联失败', 'err', 5000);
      });
  }

  function requestDeleteAssociationRow(row) {
    if (!row || !row.id) return;
    state.associationDrawer.pendingAssociationId = row.id;
    state.associationDrawer.pendingAction = 'delete';
    if (associationDeleteConfirmDrawerInstance && typeof associationDeleteConfirmDrawerInstance.open === 'function') {
      associationDeleteConfirmDrawerInstance.open();
      return;
    }
    openConfirmDrawer({
      title: '确认删除关联',
      message: '确认删除该副用例关联吗？',
      confirmText: '确认删除',
      cancelText: '取消',
      danger: true,
      previousDrawer: associationDrawerInstance || null,
    }).then(function(res) {
      if (!res || res.ok !== true) return;
      confirmDeleteAssociationRow();
    });
  }

  function confirmDeleteAssociationRow() {
    var assocId = state.associationDrawer.pendingAssociationId;
    var mainCase = state.associationDrawer.caseFile;
    state.associationDrawer.pendingAssociationId = null;
    state.associationDrawer.pendingAction = '';
    if (!assocId || !mainCase || !mainCase.id || !apiClient || typeof apiClient.deleteCaseFileAssociation !== 'function') return;
    state.associationDrawer.processing = true;
    syncAssociationAddButtonState();
    if (dom.associationStatus) setStatus(dom.associationStatus, '删除关联中...', '');
    apiClient
      .deleteCaseFileAssociation(mainCase.id, assocId)
      .then(function() {
        state.associationDrawer.processing = false;
        showCenterToast('已删除该用例的关联。', 'ok', 5000);
        refreshAssociationDrawerAfterChange('已删除该用例的关联。', 'ok');
      })
      .catch(function(err) {
        state.associationDrawer.processing = false;
        syncAssociationAddButtonState();
        if (dom.associationStatus) setStatus(dom.associationStatus, err && err.message ? err.message : '删除关联失败', 'err');
      });
  }

  function getAssociationDisplayText(file) {
    var count = Number(file && file.association_count ? file.association_count : 0);
    if (!count) return '无关联';
    var enabled = getAssociationSwitchState(file && file.id, true);
    return (
      '<label class="case-lib-association-switch">' +
        '<input type="checkbox" data-case-lib-association-switch="' + escapeHtml(file && file.id ? String(file.id) : '') + '"' + (enabled ? ' checked' : '') + '>' +
        '<span>关联(' + count + ')</span>' +
      '</label>'
    );
  }

  function buildSelectActionCell(file) {
    var id = file && file.id ? String(file.id) : '';
    var count = Number(file && file.association_count ? file.association_count : 0);
    var linked = count > 0;
    var assocClass = linked ? 'case-lib-association-btn linked' : 'case-lib-association-btn';
    return (
      '<div class="case-lib-select-ops">' +
        '<button class="secondary ' + assocClass + '" type="button" data-case-lib-association="' + escapeHtml(id) + '">用例关联</button>' +
        '<button class="primary" type="button" data-case-lib-exec="' + escapeHtml(id) + '">转到执行</button>' +
      '</div>'
    );
  }

  function maybeConfirmExecWithoutAssociation(file) {
    var count = Number(file && file.association_count ? file.association_count : 0);
    if (!count) return Promise.resolve({ ok: true, association_enabled: false });
    var enabled = getAssociationSwitchState(file && file.id, true);
    if (enabled) return Promise.resolve({ ok: true, association_enabled: true });
    return openConfirmDrawer({
      title: '确认不关联转执行',
      message: '当前已关闭关联用例，是否不关联直接转执行？',
      confirmText: '确认转执行',
      cancelText: '取消',
      previousDrawer: selectDrawerInstance || null,
    }).then(function(res) {
      if (!res || res.ok !== true) return { ok: false };
      return { ok: true, association_enabled: false };
    });
  }


  function resetSelectDrawer() {
    state.selectDrawer.projectId = null;
    state.selectDrawer.versionId = null;
    state.selectDrawer.searchText = '';
    state.selectDrawer.searchPrevVersionId = null;
    state.selectDrawer.files = [];
    state.selectDrawer.execByFileId = {};
    state.selectDrawer.loading = false;
    state.selectDrawer.processing = false;
    state.selectDrawer.loadSeq = 0;
    state.selectDrawer.selection = new Set();
    state.selectDrawer.pageIndex = 0;
    state.selectDrawer.associationSwitchByFileId = {};
    setStatus(dom.selectStatus, '', '');
    syncProjectOptions(dom.selectProjectSelect, '请选择项目');
    if (dom.selectProjectSelect) dom.selectProjectSelect.value = '';
    if (dom.selectVersionSelect) {
      dom.selectVersionSelect.disabled = true;
      dom.selectVersionSelect.innerHTML = '<option value=\"\">全部版本</option>';
      dom.selectVersionSelect.value = '';
    }
    if (dom.selectSearchInput) dom.selectSearchInput.value = '';
    if (dom.selectListBody) {
      dom.selectListBody.innerHTML = '<tr><td colspan=\"10\"><p class=\"hint\">请选择项目后自动刷新。</p></td></tr>';
    }
    setDrawerPagination(dom.selectPaginationTop, dom.selectPaginationBottom, '');
    if (dom.selectSelectAll) {
      dom.selectSelectAll.checked = false;
      dom.selectSelectAll.indeterminate = false;
    }
    if (dom.selectBatchExecBtn) dom.selectBatchExecBtn.disabled = true;
  }

  function handleSelectProjectChange() {
    var projectId = normalizeId(dom.selectProjectSelect ? dom.selectProjectSelect.value : '');
    state.selectDrawer.projectId = projectId;
    state.selectDrawer.versionId = null;
    state.selectDrawer.searchText = '';
    state.selectDrawer.searchPrevVersionId = null;
    persistSelectDrawerState({ projectId: projectId, versionId: '' });
    state.selectDrawer.files = [];
    state.selectDrawer.execByFileId = {};
    state.selectDrawer.processing = false;
    state.selectDrawer.selection = new Set();
    state.selectDrawer.pageIndex = 0;
    state.selectDrawer.associationSwitchByFileId = {};
    if (dom.selectSelectAll) {
      dom.selectSelectAll.checked = false;
      dom.selectSelectAll.indeterminate = false;
    }
    if (!dom.selectVersionSelect) return;
    dom.selectVersionSelect.disabled = true;
    dom.selectVersionSelect.innerHTML = '<option value=\"\">全部版本</option>';
    if (dom.selectSearchInput) dom.selectSearchInput.value = '';
    if (!projectId) return;
    state.selectDrawer.loading = true;
    state.selectDrawer.loadSeq = Number(state.selectDrawer.loadSeq || 0) + 1;
    var seq = state.selectDrawer.loadSeq;
    setStatus(dom.selectStatus, '加载用例库...', '');
    renderSelectDrawerList();
	    Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId), apiClient.listExecSetsByCaseFile(projectId)])
	      .then(function(res) {
	        if (seq !== state.selectDrawer.loadSeq) return;
        var files = Array.isArray(res && res[0]) ? res[0] : [];
        var execSets = Array.isArray(res && res[2]) ? res[2] : [];
        state.selectDrawer.files = files;
        state.selectDrawer.execByFileId = buildExecMapByFileId(execSets);
        syncAssociationSwitchMapWithFiles(files);
        syncVersionOptions(dom.selectVersionSelect, projectId, '全部版本');
        dom.selectVersionSelect.disabled = false;
        setStatus(dom.selectStatus, '已加载 ' + files.length + ' 份用例文件', files.length ? 'ok' : 'warn');
      })
      .catch(function(err) {
        if (seq !== state.selectDrawer.loadSeq) return;
        state.selectDrawer.files = [];
        state.selectDrawer.execByFileId = {};
        state.selectDrawer.associationSwitchByFileId = {};
        setStatus(dom.selectStatus, err && err.message ? err.message : '加载失败', 'err');
      })
      .finally(function() {
        if (seq !== state.selectDrawer.loadSeq) return;
        state.selectDrawer.loading = false;
        renderSelectDrawerList();
      });
  }

  function handleSelectVersionChange() {
    state.selectDrawer.versionId = normalizeId(dom.selectVersionSelect ? dom.selectVersionSelect.value : '');
    persistSelectDrawerState({ projectId: state.selectDrawer.projectId || '', versionId: state.selectDrawer.versionId || '' });
    state.selectDrawer.pageIndex = 0;
    renderSelectDrawerList();
  }

  function handleSelectSearchInput() {
    state.selectDrawer.searchText = dom.selectSearchInput ? dom.selectSearchInput.value : '';
    var term = String(state.selectDrawer.searchText || '').trim();
    if (term) {
      if (state.selectDrawer.searchPrevVersionId === null) {
        state.selectDrawer.searchPrevVersionId = state.selectDrawer.versionId;
      }
      if (state.selectDrawer.versionId !== null && state.selectDrawer.versionId !== undefined) {
        state.selectDrawer.versionId = null;
      }
      if (dom.selectVersionSelect) dom.selectVersionSelect.value = '';
    } else {
      if (state.selectDrawer.searchPrevVersionId !== null && state.selectDrawer.searchPrevVersionId !== undefined) {
        var pid = state.selectDrawer.projectId;
        var prev = state.selectDrawer.searchPrevVersionId;
        var ok = pid && (state.versionsByProject[pid] || []).some(function(v) {
          return v && String(v.id) === String(prev);
        });
        if (ok) {
          state.selectDrawer.versionId = prev;
          if (dom.selectVersionSelect) dom.selectVersionSelect.value = String(prev);
        } else {
          state.selectDrawer.versionId = null;
          if (dom.selectVersionSelect) dom.selectVersionSelect.value = '';
        }
      }
      state.selectDrawer.searchPrevVersionId = null;
    }
    state.selectDrawer.pageIndex = 0;
    renderSelectDrawerList();
    syncSelectDrawerControls();
  }

  function renderSelectDrawerList() {
    if (!dom.selectListBody) return;
    if (!state.selectDrawer.projectId) {
      dom.selectListBody.innerHTML = '<tr><td colspan=\"10\"><p class=\"hint\">请选择项目后自动刷新。</p></td></tr>';
      setDrawerPagination(dom.selectPaginationTop, dom.selectPaginationBottom, '');
      syncSelectDrawerControls();
      return;
    }
    if (state.selectDrawer.loading) {
      dom.selectListBody.innerHTML = '<tr><td colspan=\"10\"><p class=\"hint\">加载中...</p></td></tr>';
      setDrawerPagination(dom.selectPaginationTop, dom.selectPaginationBottom, '');
      syncSelectDrawerControls();
      return;
    }
    var result = getSelectDrawerPagedFiles();
    var list = result.list;
    var total = result.total;
    var page = result.page;
    if (!total) {
      var term = String(state.selectDrawer.searchText || '').trim();
      var hint = term ? '未找到匹配的用例文件' : '暂无用例文件';
      dom.selectListBody.innerHTML = '<tr><td colspan=\"10\"><p class=\"hint\">' + escapeHtml(hint) + '</p></td></tr>';
      setDrawerPagination(dom.selectPaginationTop, dom.selectPaginationBottom, '');
      syncSelectDrawerControls();
      return;
    }
    state.selectDrawer.selection = state.selectDrawer.selection instanceof Set ? state.selectDrawer.selection : new Set();
    var execByFileId = state.selectDrawer.execByFileId && typeof state.selectDrawer.execByFileId === 'object'
      ? state.selectDrawer.execByFileId
      : {};
	    dom.selectListBody.innerHTML = list.map(function(f) {
	      var rowProjectId = f && (f.project_id || f.project_id === 0) ? f.project_id : state.selectDrawer.projectId;
	      var projectName = state.projectNameById[rowProjectId] || ('项目#' + rowProjectId);
	      var versionName = getVersionName(rowProjectId, f && f.version_id ? f.version_id : null);
	      var importerName = f && f.importer_name ? f.importer_name : '--';
	      var importedAt = formatTime(f && f.imported_at);
	      var updatedAt = formatTime(f && f.updated_at);
	      var idStr = f && f.id ? String(f.id) : '';
	      var checked = idStr && state.selectDrawer.selection.has(idStr) ? ' checked' : '';
	      var fileName = f && f.file_name_clean ? f.file_name_clean : ('文件#' + (f && f.id ? f.id : ''));
	      var reuseBadge = (f && f.reuse_enabled) ? ' <span class=\"badge case-library-reuse-badge\">复</span>' : '';
	      var execInfo = idStr && execByFileId[idStr] ? execByFileId[idStr] : null;
	      var activeUsers = execInfo && Array.isArray(execInfo.active_users) ? execInfo.active_users : [];
	      var execStatusCell = renderExecPageStatusCell(activeUsers);
	      return (
	        '<tr>' +
	          '<td><input type=\"checkbox\" data-case-lib-select-select=\"' + escapeHtml(idStr) + '\"' + checked + '/></td>' +
	          '<td>' + escapeHtml(projectName) + '</td>' +
	          '<td>' + escapeHtml(versionName) + '</td>' +
	          '<td>' + escapeHtml(fileName) + reuseBadge + '</td>' +
	          '<td>' + execStatusCell + '</td>' +
	          '<td>' + escapeHtml(importerName) + '</td>' +
	          '<td>' + escapeHtml(importedAt) + '</td>' +
	          '<td>' + escapeHtml(updatedAt) + '</td>' +
          '<td>' + getAssociationDisplayText(f) + '</td>' +
          '<td>' + buildSelectActionCell(f) + '</td>' +
        '</tr>'
      );
    }).join('');
    setDrawerPagination(
      dom.selectPaginationTop,
      dom.selectPaginationBottom,
      buildDrawerPagination(total, page.pageIndex, page.totalPages, page.start, page.end, 'select')
    );
    syncSelectDrawerControls();
  }

  function isMissingModuleDuplicateError(err) {
    var payload = err && err.payload ? err.payload : null;
    var detail = payload && payload.detail ? String(payload.detail || '') : '';
    return Boolean(err && (err.status === 409 || detail === 'missing_module_duplicate'));
  }

  function isMissingTypeDuplicateError(err) {
    var payload = err && err.payload ? err.payload : null;
    var detail = payload && payload.detail ? payload.detail : null;
    if (detail && typeof detail === 'object' && detail.detail) {
      detail = detail.detail;
    }
    var detailText = detail ? String(detail || '') : '';
    return Boolean(err && (err.status === 409 || detailText === 'missing_type_duplicate'));
  }

  function readMissingTypeInUseError(err) {
    var payload = err && err.payload ? err.payload : null;
    var detail = payload && payload.detail ? payload.detail : null;
    var code = payload && payload.code ? String(payload.code) : '';
    if (!code && detail && detail.code) code = String(detail.code);
    if (code !== 'MISSING_TYPE_IN_USE') return null;
    var count = 0;
    if (payload && typeof payload.item_count === 'number') count = payload.item_count;
    if (!count && detail && typeof detail.item_count === 'number') count = detail.item_count;
    return { count: count };
  }

  function getMissingTypeFilterIds() {
    var selection = state.missingType.selection instanceof Set ? state.missingType.selection : new Set();
    state.missingType.selection = selection;
    return Array.from(selection);
  }

  function renderMissingDrawerTypeFilters() {
    if (!dom.missingDrawerTypeGrid) return;
    var list = Array.isArray(state.missingType.types) ? state.missingType.types : [];
    var selection = state.missingType.selection instanceof Set ? state.missingType.selection : new Set();
    state.missingType.selection = selection;
    if (state.missingType.loading) {
      dom.missingDrawerTypeGrid.innerHTML = '<p class="hint">加载中...</p>';
      return;
    }
    if (!list.length) {
      dom.missingDrawerTypeGrid.innerHTML = '<p class="hint">暂无类型</p>';
      return;
    }
    var allChecked = selection.size === 0;
    var html = [
      '<label class="ops-log-filter-chip">' +
        '<input type="checkbox" data-case-lib-missing-type="__all__"' + (allChecked ? ' checked' : '') + ' />' +
        '<span>全部</span>' +
      '</label>'
    ];
    list.forEach(function(t) {
      if (!t || t.id === null || t.id === undefined) return;
      var idStr = String(t.id);
      var checked = (!allChecked && selection.has(idStr)) ? ' checked' : '';
      html.push(
        '<label class="ops-log-filter-chip">' +
          '<input type="checkbox" data-case-lib-missing-type="' + escapeHtml(idStr) + '"' + checked + ' />' +
          '<span>' + escapeHtml(t.name || ('类型#' + t.id)) + '</span>' +
        '</label>'
      );
    });
    dom.missingDrawerTypeGrid.innerHTML = html.join('');
  }

  function syncMissingTypeUi() {
    syncMissingTypeOptions(dom.missingDrawerTypeSelect, state.missingType.types, '请选择类型', true);
    renderMissingDrawerTypeFilters();
    renderMissingTypeManageList();
    normalizeMissingViewTypeFilters();
    if (isMissingCardVisible()) {
      renderMissingViewTable();
    }
  }

  function getMissingDrawerVisibleModules() {
    var list = Array.isArray(state.missingDrawer.modules) ? state.missingDrawer.modules : [];
    if (state.missingDrawer.moduleId) {
      list = list.filter(function(m) { return String(m && m.id || '') === String(state.missingDrawer.moduleId || ''); });
    }
    return list;
  }

  function getMissingDrawerPagedModules() {
    var visible = getMissingDrawerVisibleModules();
    var page = resolveDrawerPage(visible.length, state.missingDrawer.pageIndex);
    state.missingDrawer.pageIndex = page.pageIndex;
    return {
      page: page,
      list: visible.slice(page.start, page.end),
      total: visible.length,
    };
  }

  function syncMissingDrawerControls() {
    if (!dom.missingDrawerBatchViewBtn && !dom.missingDrawerSelectAll) return;
    state.missingDrawer.selection = state.missingDrawer.selection instanceof Set ? state.missingDrawer.selection : new Set();

    var visible = getMissingDrawerVisibleModules();
    var page = resolveDrawerPage(visible.length, state.missingDrawer.pageIndex);
    state.missingDrawer.pageIndex = page.pageIndex;
    var paged = visible.slice(page.start, page.end);
    var visibleIds = {};
    visible.forEach(function(m) {
      if (!m || !m.id) return;
      visibleIds[String(m.id)] = true;
    });

    var nextSel = new Set();
    state.missingDrawer.selection.forEach(function(id) {
      if (visibleIds[String(id)]) nextSel.add(String(id));
    });
    state.missingDrawer.selection = nextSel;

    var selected = state.missingDrawer.selection.size;
    var busy = Boolean(state.missingDrawer.loading || state.missingDrawer.processing);
    if (dom.missingDrawerBatchViewBtn) dom.missingDrawerBatchViewBtn.disabled = busy || selected === 0;
    if (dom.missingDrawerDeleteBtn) dom.missingDrawerDeleteBtn.disabled = busy || selected === 0;
    if (dom.missingDrawerExportXmindBtn) dom.missingDrawerExportXmindBtn.disabled = busy || selected === 0;
    if (dom.missingDrawerExportExcelBtn) dom.missingDrawerExportExcelBtn.disabled = busy || selected === 0;
    if (dom.missingDrawerSelectAll) {
      var pageTotal = paged.length;
      var pageSelected = paged.reduce(function(count, m) {
        if (!m || !m.id) return count;
        return state.missingDrawer.selection.has(String(m.id)) ? count + 1 : count;
      }, 0);
      dom.missingDrawerSelectAll.checked = Boolean(pageTotal && pageSelected === pageTotal);
      dom.missingDrawerSelectAll.indeterminate = Boolean(pageSelected && pageSelected < pageTotal);
    }
  }

  function setMissingDrawerSelectionAll(checked) {
    state.missingDrawer.selection = state.missingDrawer.selection instanceof Set ? state.missingDrawer.selection : new Set();
    var pageData = getMissingDrawerPagedModules();
    var visible = pageData.list;
    if (checked) {
      visible.forEach(function(m) {
        if (!m || !m.id) return;
        state.missingDrawer.selection.add(String(m.id));
      });
    } else {
      visible.forEach(function(m) {
        if (!m || !m.id) return;
        state.missingDrawer.selection.delete(String(m.id));
      });
    }
    renderMissingDrawerList();
    syncMissingDrawerControls();
  }

  function resetMissingDrawer() {
    state.missingDrawer.projectId = null;
    state.missingDrawer.moduleId = null;
    state.missingDrawer.modules = [];
    state.missingDrawer.loading = false;
    state.missingDrawer.processing = false;
    state.missingDrawer.selection = new Set();
    state.missingDrawer.pageIndex = 0;
    state.missingDrawer.moduleCompletion = {};
    state.missingDrawer.moduleCompletionLoading = {};
    state.missingDrawer.moduleCompletionSeq = (state.missingDrawer.moduleCompletionSeq || 0) + 1;
    state.missingDrawer.projectId = null;
    state.missingImport.projectId = null;
    state.missingType.projectId = null;
    state.missingType.types = [];
    state.missingType.loading = false;
    state.missingType.selection = new Set();
    setStatus(dom.missingDrawerStatus, '', '');
    syncProjectOptions(dom.missingDrawerProjectSelect, '请选择项目');
    if (dom.missingDrawerProjectSelect) dom.missingDrawerProjectSelect.value = '';
    if (dom.missingDrawerModuleSelect) {
      dom.missingDrawerModuleSelect.disabled = true;
      dom.missingDrawerModuleSelect.innerHTML = '<option value=\"\">全部模块</option>';
      dom.missingDrawerModuleSelect.value = '';
    }
    if (dom.missingDrawerTypeSelect) {
      dom.missingDrawerTypeSelect.disabled = true;
      syncMissingTypeOptions(dom.missingDrawerTypeSelect, [], '请选择类型', true);
      dom.missingDrawerTypeSelect.value = '';
    }
    if (dom.missingDrawerTypeGrid) {
      dom.missingDrawerTypeGrid.innerHTML = '<p class="hint">请选择项目后自动刷新。</p>';
    }
    if (dom.missingDrawerListBody) {
      dom.missingDrawerListBody.innerHTML = '<tr><td colspan=\"4\"><p class=\"hint\">请选择项目后自动刷新。</p></td></tr>';
    }
    setDrawerPagination(dom.missingDrawerPaginationTop, dom.missingDrawerPaginationBottom, '');
    if (dom.missingDrawerSelectAll) {
      dom.missingDrawerSelectAll.checked = false;
      dom.missingDrawerSelectAll.indeterminate = false;
    }
    if (dom.missingDrawerBatchViewBtn) dom.missingDrawerBatchViewBtn.disabled = true;
    if (dom.missingDrawerDeleteBtn) dom.missingDrawerDeleteBtn.disabled = true;
    if (dom.missingDrawerExportXmindBtn) dom.missingDrawerExportXmindBtn.disabled = true;
    if (dom.missingDrawerExportExcelBtn) dom.missingDrawerExportExcelBtn.disabled = true;
    resetMissingImportState();
  }

  function prepareMissingDrawer() {
    syncProjectOptions(dom.missingDrawerProjectSelect, '请选择项目');
    syncProjectOptions(dom.missingImportProjectSelect, '请选择项目');
    var projectId = state.missingDrawer.projectId || state.missingImport.projectId || null;
    if (!projectId) {
      var persisted = readMissingDrawerPersistedState();
      if (persisted) {
        var userId = getCurrentUserId();
        var loginSeq = getCurrentLoginSeq();
        var okByUser = userId && String(persisted.user_id || '') === String(userId);
        var okByLogin = loginSeq && String(persisted.login_seq || '') === String(loginSeq);
        if (okByUser || okByLogin) {
          var persistedProjectId = normalizeId(persisted.project_id);
          if (persistedProjectId) {
            var projectsLoaded = Boolean(state.projects && state.projects.length);
            if (!projectsLoaded || (state.projects || []).some(function(p) { return p && String(p.id) === String(persistedProjectId); })) {
              projectId = persistedProjectId;
            } else {
              clearMissingDrawerPersistedState();
            }
          }
        }
      }
    }
    state.missingDrawer.projectId = projectId;
    state.missingImport.projectId = projectId;
    if (projectId && dom.missingDrawerProjectSelect) {
      dom.missingDrawerProjectSelect.value = String(projectId || '');
      loadMissingTypes(projectId);
      loadMissingDrawerModules(projectId);
    } else {
      resetMissingDrawer();
    }
    if (dom.missingImportProjectSelect) dom.missingImportProjectSelect.value = projectId ? String(projectId || '') : '';
    syncMissingImportConfirmEnabled();
  }

  function loadMissingTypes(projectId) {
    if (!apiClient || typeof apiClient.listMissingTypes !== 'function') {
      setStatus(dom.missingDrawerStatus, '易漏类型接口未就绪', 'err');
      return Promise.resolve([]);
    }
    state.missingType.loading = true;
    if (dom.missingDrawerTypeSelect) dom.missingDrawerTypeSelect.disabled = false;
    renderMissingDrawerTypeFilters();
    return apiClient
      .listMissingTypes(projectId)
      .then(function(list) {
        state.missingType.projectId = projectId;
        state.missingType.types = Array.isArray(list) ? list : [];
        normalizeMissingTypeSelection();
        syncMissingTypeUi();
        return state.missingType.types;
      })
      .catch(function(err) {
        state.missingType.projectId = projectId || null;
        state.missingType.types = [];
        normalizeMissingTypeSelection();
        syncMissingTypeUi();
        setStatus(dom.missingDrawerStatus, err && err.message ? err.message : '加载类型失败', 'err');
        return [];
      })
      .finally(function() {
        state.missingType.loading = false;
        renderMissingDrawerTypeFilters();
      });
  }

  function loadMissingDrawerModules(projectId) {
    if (!apiClient || typeof apiClient.listMissingModules !== 'function') {
      setStatus(dom.missingDrawerStatus, '易漏模块接口未就绪', 'err');
      return Promise.resolve([]);
    }
    state.missingDrawer.processing = false;
    state.missingDrawer.loading = true;
    state.missingDrawer.moduleCompletion = {};
    state.missingDrawer.moduleCompletionLoading = {};
    state.missingDrawer.moduleCompletionSeq = (state.missingDrawer.moduleCompletionSeq || 0) + 1;
    setStatus(dom.missingDrawerStatus, '加载易漏模块...', '');
    renderMissingDrawerList();
    return apiClient
      .listMissingModules(projectId, { type_ids: getMissingTypeFilterIds() })
      .then(function(list) {
        state.missingDrawer.modules = Array.isArray(list) ? list : [];
        syncMissingModuleOptions(dom.missingDrawerModuleSelect, state.missingDrawer.modules, '全部模块');
        if (dom.missingDrawerModuleSelect) {
          dom.missingDrawerModuleSelect.disabled = false;
          if (state.missingDrawer.moduleId) {
            var exists = state.missingDrawer.modules.some(function(m) { return m && String(m.id) === String(state.missingDrawer.moduleId); });
            if (exists) dom.missingDrawerModuleSelect.value = String(state.missingDrawer.moduleId || '');
            else {
              state.missingDrawer.moduleId = null;
              dom.missingDrawerModuleSelect.value = '';
            }
          } else {
            dom.missingDrawerModuleSelect.value = '';
          }
        }
        return state.missingDrawer.modules;
      })
      .catch(function(err) {
        state.missingDrawer.modules = [];
        if (dom.missingDrawerModuleSelect) {
          dom.missingDrawerModuleSelect.disabled = true;
          dom.missingDrawerModuleSelect.innerHTML = '<option value=\"\">全部模块</option>';
          dom.missingDrawerModuleSelect.value = '';
        }
        setStatus(dom.missingDrawerStatus, err && err.message ? err.message : '加载失败', 'err');
        return [];
      })
      .finally(function() {
        state.missingDrawer.loading = false;
        renderMissingDrawerList();
      });
  }

  function handleMissingProjectChange() {
    var projectId = normalizeId(dom.missingDrawerProjectSelect ? dom.missingDrawerProjectSelect.value : '');
    persistMissingDrawerProject(projectId);
    state.missingDrawer.projectId = projectId;
    state.missingImport.projectId = projectId;
    state.missingDrawer.moduleId = null;
    state.missingDrawer.modules = [];
    state.missingDrawer.selection = new Set();
    state.missingDrawer.pageIndex = 0;
    state.missingDrawer.processing = false;
    state.missingDrawer.moduleCompletion = {};
    state.missingDrawer.moduleCompletionLoading = {};
    state.missingDrawer.moduleCompletionSeq = (state.missingDrawer.moduleCompletionSeq || 0) + 1;
    state.missingType.projectId = projectId;
    state.missingType.types = [];
    state.missingType.loading = false;
    state.missingType.selection = new Set();
    if (dom.missingDrawerSelectAll) {
      dom.missingDrawerSelectAll.checked = false;
      dom.missingDrawerSelectAll.indeterminate = false;
    }
    if (!projectId) {
      if (dom.missingImportProjectSelect) dom.missingImportProjectSelect.value = '';
      syncMissingImportConfirmEnabled();
      if (dom.missingDrawerModuleSelect) {
        dom.missingDrawerModuleSelect.disabled = true;
        dom.missingDrawerModuleSelect.innerHTML = '<option value=\"\">全部模块</option>';
        dom.missingDrawerModuleSelect.value = '';
      }
      if (dom.missingDrawerTypeSelect) {
        dom.missingDrawerTypeSelect.disabled = true;
        syncMissingTypeOptions(dom.missingDrawerTypeSelect, [], '请选择类型', true);
        dom.missingDrawerTypeSelect.value = '';
      }
      if (dom.missingDrawerTypeGrid) {
        dom.missingDrawerTypeGrid.innerHTML = '<p class="hint">请选择项目后自动刷新。</p>';
      }
      renderMissingDrawerList();
      return;
    }
    if (dom.missingImportProjectSelect) dom.missingImportProjectSelect.value = String(projectId || '');
    syncMissingImportConfirmEnabled();
    if (dom.missingDrawerTypeSelect) {
      dom.missingDrawerTypeSelect.disabled = false;
      syncMissingTypeOptions(dom.missingDrawerTypeSelect, [], '请选择类型', true);
      dom.missingDrawerTypeSelect.value = '';
    }
    if (dom.missingDrawerTypeGrid) {
      dom.missingDrawerTypeGrid.innerHTML = '<p class="hint">加载中...</p>';
    }
    loadMissingTypes(projectId);
    loadMissingDrawerModules(projectId);
  }

  function handleMissingModuleChange() {
    state.missingDrawer.moduleId = normalizeId(dom.missingDrawerModuleSelect ? dom.missingDrawerModuleSelect.value : '');
    state.missingDrawer.pageIndex = 0;
    renderMissingDrawerList();
  }

  function handleMissingTypeSelectChange() {
    var value = dom.missingDrawerTypeSelect ? String(dom.missingDrawerTypeSelect.value || '') : '';
    if (!value) return;
    if (value === '__add_type__') {
      if (dom.missingDrawerTypeSelect) dom.missingDrawerTypeSelect.value = '';
      openMissingTypeAddDrawer();
      return;
    }
    state.missingType.selection = state.missingType.selection instanceof Set ? state.missingType.selection : new Set();
    if (state.missingType.selection.has(value)) state.missingType.selection.delete(value);
    else state.missingType.selection.add(value);
    normalizeMissingTypeSelection();
    if (dom.missingDrawerTypeSelect) dom.missingDrawerTypeSelect.value = '';
    renderMissingDrawerTypeFilters();
    state.missingDrawer.selection = new Set();
    state.missingDrawer.pageIndex = 0;
    if (state.missingDrawer.projectId) loadMissingDrawerModules(state.missingDrawer.projectId);
  }

  function handleMissingTypeFilterChange(target) {
    if (!target || !target.getAttribute) return;
    var key = target.getAttribute('data-case-lib-missing-type');
    if (!key) return;
    state.missingType.selection = state.missingType.selection instanceof Set ? state.missingType.selection : new Set();
    if (key === '__all__') {
      state.missingType.selection.clear();
    } else if (target.checked) {
      state.missingType.selection.add(String(key));
    } else {
      state.missingType.selection.delete(String(key));
    }
    normalizeMissingTypeSelection();
    renderMissingDrawerTypeFilters();
    state.missingDrawer.selection = new Set();
    state.missingDrawer.pageIndex = 0;
    if (state.missingDrawer.projectId) loadMissingDrawerModules(state.missingDrawer.projectId);
  }

  function applyMissingModuleNameUpdate(moduleId, nextName) {
    var idStr = String(moduleId || '');
    if (!idStr) return;
    var normalized = String(nextName || '').trim();
    var list = Array.isArray(state.missingDrawer.modules) ? state.missingDrawer.modules : [];
    list.forEach(function(m) {
      if (!m || String(m.id) !== idStr) return;
      m.name = normalized;
    });
    if (state.missingView && Array.isArray(state.missingView.modules)) {
      state.missingView.modules.forEach(function(m) {
        if (!m || String(m.id) !== idStr) return;
        m.name = normalized;
      });
    }
    if (state.missingView && Array.isArray(state.missingView.items)) {
      state.missingView.items.forEach(function(item) {
        if (!item || String(item.module_id) !== idStr) return;
        item.module_name = normalized;
      });
    }
    syncMissingModuleOptions(dom.missingDrawerModuleSelect, list, '全部模块');
    if (dom.missingDrawerModuleSelect && state.missingDrawer.moduleId) {
      dom.missingDrawerModuleSelect.value = String(state.missingDrawer.moduleId || '');
    }
    renderMissingDrawerList();
    updateMissingViewMeta();
    renderMissingViewTable();
  }

  function removeMissingModulesByIds(ids) {
    var idList = Array.isArray(ids) ? ids.map(function(v) { return String(v); }) : [];
    if (!idList.length) return;
    var idMap = {};
    idList.forEach(function(v) { if (v) idMap[v] = true; });
    var list = Array.isArray(state.missingDrawer.modules) ? state.missingDrawer.modules : [];
    state.missingDrawer.modules = list.filter(function(m) {
      if (!m || !m.id) return true;
      return !idMap[String(m.id)];
    });
    if (state.missingDrawer.moduleCompletion && typeof state.missingDrawer.moduleCompletion === 'object') {
      idList.forEach(function(id) { delete state.missingDrawer.moduleCompletion[id]; });
    }
    if (state.missingDrawer.moduleCompletionLoading && typeof state.missingDrawer.moduleCompletionLoading === 'object') {
      idList.forEach(function(id) { delete state.missingDrawer.moduleCompletionLoading[id]; });
    }
    state.missingDrawer.selection = state.missingDrawer.selection instanceof Set ? state.missingDrawer.selection : new Set();
    idList.forEach(function(id) { state.missingDrawer.selection.delete(String(id)); });
    if (state.missingDrawer.moduleId && idMap[String(state.missingDrawer.moduleId)]) {
      state.missingDrawer.moduleId = null;
      if (dom.missingDrawerModuleSelect) dom.missingDrawerModuleSelect.value = '';
    }
    syncMissingModuleOptions(dom.missingDrawerModuleSelect, state.missingDrawer.modules, '全部模块');
    if (dom.missingDrawerModuleSelect && state.missingDrawer.moduleId) {
      dom.missingDrawerModuleSelect.value = String(state.missingDrawer.moduleId || '');
    }
    renderMissingDrawerList();
    if (state.missingView && Array.isArray(state.missingView.modules) && state.missingView.modules.length) {
      var remainingModules = state.missingView.modules.filter(function(m) {
        if (!m || !m.id) return true;
        return !idMap[String(m.id)];
      });
      state.missingView.modules = remainingModules;
      state.missingView.moduleIds = remainingModules.map(function(m) { return m && m.id ? m.id : null; }).filter(function(v) { return v !== null; });
      if (Array.isArray(state.missingView.items)) {
        state.missingView.items = state.missingView.items.filter(function(item) {
          if (!item || item.module_id === null || item.module_id === undefined) return true;
          return !idMap[String(item.module_id)];
        });
      }
      state.missingView.selection = new Set();
      if (state.missingView.pageIndex) state.missingView.pageIndex = 0;
      updateMissingViewMeta();
      renderMissingViewTable();
    }
    if (state.missingView && Array.isArray(state.missingView.modules) && state.missingView.modules.length) {
      persistMissingViewSelection();
    } else {
      clearMissingViewPersistedState();
    }
  }

  function openMissingTypeAddDrawer(source) {
    var projectId = state.missingDrawer.projectId || (state.missingView ? state.missingView.projectId : null);
    if (!projectId) {
      setStatus(dom.missingDrawerStatus, '请先选择项目', 'warn');
      return;
    }
    state.missingTypeAdd.projectId = projectId;
    state.missingTypeAdd.source = source || 'drawer';
    if (dom.missingTypeAddProjectName) {
      dom.missingTypeAddProjectName.textContent = state.projectNameById[projectId] || ('项目#' + projectId);
    }
    if (dom.missingTypeNameInput) dom.missingTypeNameInput.value = '';
    setStatus(dom.missingTypeAddStatus, '', '');
    if (missingTypeAddDrawerInstance && typeof missingTypeAddDrawerInstance.open === 'function') {
      missingTypeAddDrawerInstance.open();
    }
  }

  function openMissingTypeManageDrawer() {
    var projectId = state.missingDrawer.projectId;
    if (!projectId) {
      setStatus(dom.missingDrawerStatus, '请先选择项目', 'warn');
      return;
    }
    if (!isAdminUser()) {
      setStatus(dom.missingTypeManageStatus, '仅管理员可删除类型', 'warn');
    } else {
      setStatus(dom.missingTypeManageStatus, '', '');
    }
    if (missingTypeManageDrawerInstance && typeof missingTypeManageDrawerInstance.open === 'function') {
      missingTypeManageDrawerInstance.open();
    }
    if (!state.missingType.loading) {
      loadMissingTypes(projectId);
    }
  }

  function confirmMissingTypeAdd() {
    if (state.missingTypeAdd.loading) return;
    var projectId = state.missingTypeAdd.projectId || state.missingDrawer.projectId;
    if (!projectId) {
      setStatus(dom.missingTypeAddStatus, '请先选择项目', 'warn');
      return;
    }
    var name = dom.missingTypeNameInput ? String(dom.missingTypeNameInput.value || '').trim() : '';
    if (!name) {
      setStatus(dom.missingTypeAddStatus, '请输入类型名', 'warn');
      return;
    }
    if (!apiClient || typeof apiClient.createMissingType !== 'function') {
      setStatus(dom.missingTypeAddStatus, '易漏类型接口未就绪', 'err');
      return;
    }
    state.missingTypeAdd.loading = true;
    setStatus(dom.missingTypeAddStatus, '添加中...', '');
    apiClient
      .createMissingType({ project_id: projectId, name: name })
      .then(function(created) {
        var row = created && typeof created === 'object' ? created : null;
        if (row && row.id) {
          state.missingType.types = Array.isArray(state.missingType.types) ? state.missingType.types : [];
          state.missingType.types.push(row);
          state.missingType.types.sort(function(a, b) { return Number(a.id) - Number(b.id); });
          normalizeMissingTypeSelection();
          syncMissingTypeUi();
          if (state.missingView && Array.isArray(state.missingView.items)) {
            refreshMissingTypeCells();
          }
        }
        if (missingTypeAddDrawerInstance && typeof missingTypeAddDrawerInstance.close === 'function') {
          missingTypeAddDrawerInstance.close();
        }
        if (state.missingTypeAdd.source !== 'view') {
          if (missingDrawerInstance && typeof missingDrawerInstance.open === 'function') {
            missingDrawerInstance.open();
          }
        }
        showCenterToast('添加成功', 'ok', 3000);
      })
      .catch(function(err) {
        if (isMissingTypeDuplicateError(err)) {
          showCenterToast('已有同名类型，添加失败', 'warn', 3000);
          return;
        }
        setStatus(dom.missingTypeAddStatus, err && err.message ? err.message : '添加失败', 'err');
      })
      .finally(function() {
        state.missingTypeAdd.loading = false;
      });
  }

  function renderMissingTypeManageList() {
    if (!dom.missingTypeManageBody) return;
    var list = Array.isArray(state.missingType.types) ? state.missingType.types : [];
    if (!list.length) {
      dom.missingTypeManageBody.innerHTML = '<p class="hint">暂无类型</p>';
      return;
    }
    var canDelete = isAdminUser();
    dom.missingTypeManageBody.innerHTML = list.map(function(t) {
      if (!t || t.id === null || t.id === undefined) return '';
      var idStr = String(t.id);
      var count = Number(t.item_count);
      if (!Number.isFinite(count) || count < 0) count = 0;
      var ops = canDelete
        ? '<button class="secondary danger" type="button" data-case-lib-missing-type-delete="' + escapeHtml(idStr) + '">删除</button>'
        : '';
      return (
        '<div class="case-library-missing-type-manage-item">' +
          '<div class="case-library-missing-type-name">' + escapeHtml(t.name || ('类型#' + t.id)) + '</div>' +
          '<div class="case-library-missing-type-count">关联 ' + count + ' 条</div>' +
          '<div class="case-library-missing-type-actions">' + ops + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function removeMissingTypeById(typeId, transferId, movedCount) {
    var idStr = String(typeId || '');
    if (!idStr) return;
    var list = Array.isArray(state.missingType.types) ? state.missingType.types : [];
    state.missingType.types = list.filter(function(t) { return t && String(t.id) !== idStr; });
    if (transferId) {
      var moved = Number(movedCount);
      if (!Number.isFinite(moved) || moved < 0) moved = 0;
      state.missingType.types.forEach(function(t) {
        if (!t || String(t.id) !== String(transferId)) return;
        var current = Number(t.item_count);
        if (!Number.isFinite(current) || current < 0) current = 0;
        t.item_count = current + moved;
      });
    }
    state.missingType.selection = state.missingType.selection instanceof Set ? state.missingType.selection : new Set();
    state.missingType.selection.delete(idStr);
    normalizeMissingTypeSelection();
    if (state.missingView && state.missingView.typeFilters instanceof Set) {
      state.missingView.typeFilters.delete(idStr);
    }
    if (transferId) {
      if (state.missingView && Array.isArray(state.missingView.items)) {
        state.missingView.items.forEach(function(item) {
          if (!item) return;
          var slots = ensureMissingItemTypeSlots(item).slice();
          var next = [];
          var removed = false;
          slots.forEach(function(val) {
            var tid = normalizeMissingTypeId(val);
            if (tid && String(tid) === idStr) {
              removed = true;
              return;
            }
            next.push(val);
          });
          if (!removed) return;
          var transferStr = String(transferId);
          var hasTransfer = next.some(function(val) { return String(val) === transferStr; });
          if (!hasTransfer) next.push(transferStr);
          if (!next.length) next = [''];
          item.type_ids = next;
          item.type_names = resolveMissingItemTypeNames(
            normalizeMissingTypeIds(next),
            item.type_names || (item.type_name ? [item.type_name] : [])
          );
          item.type_name = formatMissingItemTypeLabel(item);
        });
      }
      if (state.missingView && Array.isArray(state.missingView.items)) {
        renderMissingTypePills(state.missingView.items);
        refreshMissingTypeCells();
      }
    }
    syncMissingTypeUi();
    if (state.missingView && Array.isArray(state.missingView.items)) {
      renderMissingTypePills(state.missingView.items);
      refreshMissingTypeCells();
    }
    if (state.missingDrawer.projectId) {
      loadMissingDrawerModules(state.missingDrawer.projectId);
    }
  }

  function requestDeleteMissingType(missingType, anchorEl) {
    if (!missingType || missingType.id === null || missingType.id === undefined) return;
    if (!isAdminUser()) {
      setStatus(dom.missingTypeManageStatus, '仅管理员可删除类型', 'warn');
      return;
    }
    if (!apiClient || typeof apiClient.deleteMissingType !== 'function') {
      setStatus(dom.missingTypeManageStatus, '易漏类型接口未就绪', 'err');
      return;
    }
    openConfirmDrawer({
      title: '确认删除类型',
      message: '确认删除类型【' + (missingType.name || ('类型#' + missingType.id)) + '】吗？',
      confirmText: '确认删除',
      cancelText: '取消',
      danger: true,
      previousDrawer: missingTypeManageDrawerInstance || null,
    }).then(function(res) {
      if (!res || res.ok !== true) return;
      var anchorRect = captureCaseLibraryAnchorRect(anchorEl);
      if (anchorRect) showCaseLibraryBlockHint(anchorRect, '删除处理中...');
      apiClient
        .deleteMissingType(missingType.id)
        .then(function(res) {
          var moved = res && typeof res.moved_count === 'number' ? res.moved_count : 0;
          removeMissingTypeById(missingType.id, null, moved);
          showCenterToast('删除类型成功', 'ok', 3000);
        })
        .catch(function(err) {
          var inUse = readMissingTypeInUseError(err);
          if (!inUse) {
            setStatus(dom.missingTypeManageStatus, err && err.message ? err.message : '删除类型失败', 'err');
            return;
          }
          var types = Array.isArray(state.missingType.types) ? state.missingType.types : [];
          var options = types
            .filter(function(t) { return t && String(t.id) !== String(missingType.id); })
            .map(function(t) {
              return { value: String(t.id), label: t.name ? String(t.name) : ('类型#' + t.id) };
            })
            .filter(function(opt) { return opt && opt.value; });
          if (!options.length) {
            openConfirmDrawer({
              title: '暂无可转移类型',
              message: '该类型下已有易漏用例，无法删除。',
              hint: '暂无可转移类型。新增类型后重新操作即可。',
              hintType: 'err',
              confirmText: '知道了',
              cancelText: '关闭',
              previousDrawer: missingTypeManageDrawerInstance || null,
            });
            setStatus(dom.missingTypeManageStatus, '暂无可转移类型，请先新增类型', 'warn');
            return;
          }
          openConfirmDrawer({
            title: '转移用例并删除类型',
            message: '该类型下已有 ' + (inUse.count || 0) + ' 条易漏用例，请选择要转移到的类型后删除。',
            confirmText: '确认删除',
            cancelText: '取消',
            previousDrawer: missingTypeManageDrawerInstance || null,
            input: {
              type: 'select',
              label: '转移到类型',
              placeholder: '请选择类型',
              required: true,
              options: options,
            },
          }).then(function(res2) {
            if (!res2 || res2.ok !== true) return;
            var transferVal = res2.value ? String(res2.value).trim() : '';
            if (!transferVal) {
              setStatus(dom.missingTypeManageStatus, '未选择转移类型，已取消删除', '');
              return;
            }
            var target = types.find(function(t) { return t && String(t.id) === transferVal; });
            if (!target) {
              setStatus(dom.missingTypeManageStatus, '转移类型不存在，请刷新后重试', 'err');
              return;
            }
            apiClient
              .deleteMissingType(missingType.id, transferVal)
              .then(function(res3) {
                var moved3 = res3 && typeof res3.moved_count === 'number' ? res3.moved_count : 0;
                removeMissingTypeById(missingType.id, transferVal, moved3);
                showCenterToast('已转移用例并删除类型', 'ok', 3000);
              })
              .catch(function(err2) {
                setStatus(dom.missingTypeManageStatus, err2 && err2.message ? err2.message : '删除类型失败', 'err');
              });
          });
        });
    });
  }

  function openMissingAddDrawer() {
    var projectId = state.missingDrawer.projectId;
    if (!projectId) {
      setStatus(dom.missingDrawerStatus, '请先选择项目', 'warn');
      return;
    }
    state.missingAdd.projectId = projectId;
    if (dom.missingAddProjectName) {
      dom.missingAddProjectName.textContent = state.projectNameById[projectId] || ('项目#' + projectId);
    }
    if (dom.missingAddModuleNameInput) dom.missingAddModuleNameInput.value = '';
    setStatus(dom.missingAddStatus, '', '');
    if (missingAddDrawerInstance && typeof missingAddDrawerInstance.open === 'function') {
      missingAddDrawerInstance.open();
    }
  }

  function openMissingEditDrawer(module) {
    if (!module || !module.id) {
      setStatus(dom.missingDrawerStatus, '模块信息缺失', 'warn');
      return;
    }
    state.missingEdit.moduleId = module.id;
    state.missingEdit.projectId = module.project_id;
    state.missingEdit.name = module.name || '';
    if (dom.missingEditProjectName) {
      var pname = state.projectNameById[module.project_id] || ('项目#' + module.project_id);
      dom.missingEditProjectName.textContent = pname;
    }
    if (dom.missingEditModuleNameInput) dom.missingEditModuleNameInput.value = module.name || '';
    setStatus(dom.missingEditStatus, '', '');
    if (missingEditDrawerInstance && typeof missingEditDrawerInstance.open === 'function') {
      missingEditDrawerInstance.open();
    }
  }

  function confirmMissingAddModule() {
    if (state.missingAdd.loading) return;
    var projectId = state.missingAdd.projectId || state.missingDrawer.projectId;
    if (!projectId) {
      setStatus(dom.missingAddStatus, '请先选择项目', 'warn');
      return;
    }
    var name = dom.missingAddModuleNameInput ? String(dom.missingAddModuleNameInput.value || '').trim() : '';
    if (!name) {
      setStatus(dom.missingAddStatus, '请输入模块名', 'warn');
      return;
    }
    if (!apiClient || typeof apiClient.createMissingModule !== 'function') {
      setStatus(dom.missingAddStatus, '易漏模块接口未就绪', 'err');
      return;
    }
    state.missingAdd.loading = true;
    setStatus(dom.missingAddStatus, '添加中...', '');
    apiClient
      .createMissingModule({ project_id: projectId, name: name })
      .then(function(created) {
        var module = created && typeof created === 'object' ? created : null;
        if (module && module.id) {
          state.missingDrawer.modules = Array.isArray(state.missingDrawer.modules) ? state.missingDrawer.modules : [];
          state.missingDrawer.modules.push(module);
          syncMissingModuleOptions(dom.missingDrawerModuleSelect, state.missingDrawer.modules, '全部模块');
          renderMissingDrawerList();
        }
        if (missingAddDrawerInstance && typeof missingAddDrawerInstance.close === 'function') {
          missingAddDrawerInstance.close();
        }
        if (missingDrawerInstance && typeof missingDrawerInstance.open === 'function') {
          missingDrawerInstance.open();
        }
        showCenterToast('添加成功', 'ok', 3000);
      })
      .catch(function(err) {
        if (isMissingModuleDuplicateError(err)) {
          showCenterToast('已有同名模块，添加失败', 'warn', 3000);
          return;
        }
        setStatus(dom.missingAddStatus, err && err.message ? err.message : '添加失败', 'err');
      })
      .finally(function() {
        state.missingAdd.loading = false;
      });
  }

  function confirmMissingEditModule() {
    if (state.missingEdit.loading) return;
    var moduleId = state.missingEdit.moduleId;
    if (!moduleId) {
      setStatus(dom.missingEditStatus, '未选择模块', 'warn');
      return;
    }
    var name = dom.missingEditModuleNameInput ? String(dom.missingEditModuleNameInput.value || '').trim() : '';
    if (!name) {
      setStatus(dom.missingEditStatus, '请输入模块名', 'warn');
      return;
    }
    if (!apiClient || typeof apiClient.updateMissingModule !== 'function') {
      setStatus(dom.missingEditStatus, '易漏模块接口未就绪', 'err');
      return;
    }
    state.missingEdit.loading = true;
    setStatus(dom.missingEditStatus, '保存中...', '');
    apiClient
      .updateMissingModule(moduleId, { name: name })
      .then(function(updated) {
        var nextName = updated && updated.name ? String(updated.name) : name;
        applyMissingModuleNameUpdate(moduleId, nextName);
        if (missingEditDrawerInstance && typeof missingEditDrawerInstance.close === 'function') {
          missingEditDrawerInstance.close();
        }
        if (missingDrawerInstance && typeof missingDrawerInstance.open === 'function') {
          missingDrawerInstance.open();
        }
        showCenterToast('修改成功', 'ok', 3000);
      })
      .catch(function(err) {
        if (isMissingModuleDuplicateError(err)) {
          showCenterToast('已有同名模块，修改失败', 'warn', 3000);
          return;
        }
        setStatus(dom.missingEditStatus, err && err.message ? err.message : '保存失败', 'err');
      })
      .finally(function() {
        state.missingEdit.loading = false;
      });
  }

  function deleteSelectedMissingModules(anchorEl) {
    if (state.missingDrawer.processing) return;
    if (!canDeleteMissingModules()) {
      showCenterToast('权限不足，请联系管理员或者组长进行操作。', 'warn', 3000);
      return;
    }
    if (!apiClient || typeof apiClient.deleteMissingModule !== 'function') {
      setStatus(dom.missingDrawerStatus, '易漏模块接口未就绪', 'err');
      return;
    }
    var modules = getSelectedMissingModules();
    if (!modules.length) {
      setStatus(dom.missingDrawerStatus, '请先勾选需要删除的模块', 'warn');
      return;
    }
    var confirmMsg = '确定删除已勾选的 ' + modules.length + ' 个模块吗？该模块下的易漏条目也会一并删除。';
    openConfirmDrawer({
      title: '确认删除模块',
      message: confirmMsg,
      confirmText: '确认删除',
      cancelText: '取消',
      danger: true,
      previousDrawer: missingDrawerInstance || null,
    }).then(function(res) {
      if (!res || res.ok !== true) return;
      var anchorRect = captureCaseLibraryAnchorRect(anchorEl);
      if (anchorRect) showCaseLibraryBlockHint(anchorRect, '删除处理中...');
      state.missingDrawer.processing = true;
      syncMissingDrawerControls();
      setStatus(dom.missingDrawerStatus, '删除模块中...', '');

      function settle(p) {
        return Promise.resolve(p).then(
          function(v) { return { status: 'fulfilled', value: v }; },
          function(err) { return { status: 'rejected', reason: err }; }
        );
      }

      var entries = modules.map(function(m) {
        return { id: m && m.id ? m.id : null, name: m && m.name ? m.name : '' };
      }).filter(function(m) { return m.id !== null && m.id !== undefined; });
      var tasks = entries.map(function(entry) {
        return settle(apiClient.deleteMissingModule(entry.id));
      });
      Promise.all(tasks).then(function(results) {
        var successIds = [];
        var failures = [];
        for (var i = 0; i < results.length; i += 1) {
          if (results[i] && results[i].status === 'fulfilled') {
            successIds.push(entries[i].id);
          } else {
            failures.push(entries[i]);
          }
        }
        if (successIds.length) {
          removeMissingModulesByIds(successIds);
        }
        if (!failures.length) {
          setStatus(dom.missingDrawerStatus, '已删除 ' + successIds.length + ' 个模块', 'ok');
          return;
        }
        var msg = '删除部分失败：成功 ' + successIds.length + ' 个，失败 ' + failures.length + ' 个';
        setStatus(dom.missingDrawerStatus, msg, 'warn');
      }).catch(function(err) {
        setStatus(dom.missingDrawerStatus, err && err.message ? err.message : '删除失败', 'err');
      }).finally(function() {
        state.missingDrawer.processing = false;
        syncMissingDrawerControls();
      });
    });
  }

  function isMissingItemTypeComplete(item) {
    if (!item || typeof item !== 'object') return false;
    var slots = Array.isArray(item.type_ids) ? item.type_ids.slice() : [];
    if (!slots.length && item.type_id !== null && item.type_id !== undefined && item.type_id !== '') {
      slots = [item.type_id];
    }
    if (!slots.length) return false;
    for (var i = 0; i < slots.length; i += 1) {
      if (!normalizeMissingTypeId(slots[i])) return false;
    }
    return true;
  }

  function isMissingItemFieldsComplete(item) {
    if (!item || typeof item !== 'object') return false;
    var fields = ['title', 'priority', 'precondition', 'steps', 'expected'];
    for (var i = 0; i < fields.length; i += 1) {
      var key = fields[i];
      var value = normalizeEditorText(item[key] || '');
      if (!value) return false;
    }
    return true;
  }

  function isMissingModuleComplete(items) {
    if (!Array.isArray(items) || !items.length) return false;
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      if (!isMissingItemTypeComplete(item) || !isMissingItemFieldsComplete(item)) return false;
    }
    return true;
  }

  function syncMissingDrawerModuleCompletion(modules) {
    if (!apiClient || typeof apiClient.listMissingModuleItems !== 'function') return;
    var drawer = state.missingDrawer;
    if (!drawer || typeof drawer !== 'object') return;
    drawer.moduleCompletion = drawer.moduleCompletion && typeof drawer.moduleCompletion === 'object'
      ? drawer.moduleCompletion
      : {};
    drawer.moduleCompletionLoading = drawer.moduleCompletionLoading && typeof drawer.moduleCompletionLoading === 'object'
      ? drawer.moduleCompletionLoading
      : {};
    var completionMap = drawer.moduleCompletion;
    var loadingMap = drawer.moduleCompletionLoading;
    var seq = drawer.moduleCompletionSeq || 0;
    var toLoad = [];
    (modules || []).forEach(function(m) {
      var idStr = m && m.id ? String(m.id) : '';
      if (!idStr) return;
      var count = Number(m && m.item_count);
      var hasCount = Number.isFinite(count);
      if (hasCount && count <= 0) {
        completionMap[idStr] = false;
        return;
      }
      if (Object.prototype.hasOwnProperty.call(completionMap, idStr)) return;
      if (loadingMap[idStr]) return;
      toLoad.push(idStr);
    });
    if (!toLoad.length) return;
    toLoad.forEach(function(id) { loadingMap[id] = true; });
    Promise.all(toLoad.map(function(id) {
      return apiClient.listMissingModuleItems(id).then(function(items) {
        if (drawer.moduleCompletionSeq !== seq) return null;
        completionMap[id] = isMissingModuleComplete(items);
        return null;
      }).catch(function() {
        if (drawer.moduleCompletionSeq !== seq) return null;
        completionMap[id] = false;
        return null;
      }).finally(function() {
        if (drawer.moduleCompletionSeq !== seq) return;
        delete loadingMap[id];
      });
    })).then(function() {
      if (drawer.moduleCompletionSeq !== seq) return;
      renderMissingDrawerList();
    });
  }

  function renderMissingDrawerList() {
    if (!dom.missingDrawerListBody) return;
    if (!state.missingDrawer.projectId) {
      dom.missingDrawerListBody.innerHTML = '<tr><td colspan=\"4\"><p class=\"hint\">请选择项目后自动刷新。</p></td></tr>';
      setDrawerPagination(dom.missingDrawerPaginationTop, dom.missingDrawerPaginationBottom, '');
      syncMissingDrawerControls();
      return;
    }
    if (state.missingDrawer.loading) {
      dom.missingDrawerListBody.innerHTML = '<tr><td colspan=\"4\"><p class=\"hint\">加载中...</p></td></tr>';
      setDrawerPagination(dom.missingDrawerPaginationTop, dom.missingDrawerPaginationBottom, '');
      syncMissingDrawerControls();
      return;
    }
    var result = getMissingDrawerPagedModules();
    var list = result.list;
    var total = result.total;
    var page = result.page;
    if (!total) {
      dom.missingDrawerListBody.innerHTML = '<tr><td colspan=\"4\"><p class=\"hint\">暂无模块</p></td></tr>';
      setDrawerPagination(dom.missingDrawerPaginationTop, dom.missingDrawerPaginationBottom, '');
      syncMissingDrawerControls();
      setStatus(dom.missingDrawerStatus, '暂无易漏模块', 'warn');
      return;
    }
    state.missingDrawer.selection = state.missingDrawer.selection instanceof Set ? state.missingDrawer.selection : new Set();
    var completionMap = state.missingDrawer.moduleCompletion && typeof state.missingDrawer.moduleCompletion === 'object'
      ? state.missingDrawer.moduleCompletion
      : {};
    dom.missingDrawerListBody.innerHTML = list.map(function(m) {
      var idStr = m && m.id ? String(m.id) : '';
      var name = m && m.name ? String(m.name) : ('模块#' + (m && m.id ? m.id : ''));
      var isComplete = idStr && completionMap[idStr] === true;
      var moduleClass = 'module' + (isComplete ? ' case-library-missing-module-complete' : '');
      var checked = idStr && state.missingDrawer.selection.has(idStr) ? ' checked' : '';
      return (
        '<tr>' +
          '<td class=\"check\"><input type=\"checkbox\" data-case-lib-missing-select=\"' + escapeHtml(idStr) + '\"' + checked + '/></td>' +
          '<td>' + escapeHtml(idStr || '--') + '</td>' +
          '<td class=\"' + moduleClass + '\">' + escapeHtml(name) + '</td>' +
          '<td class=\"ops\"><div class=\"actions\">' +
            '<button class=\"primary\" type=\"button\" data-case-lib-missing-view=\"' + escapeHtml(idStr) + '\">查看</button>' +
            '<button class=\"secondary\" type=\"button\" data-case-lib-missing-edit=\"' + escapeHtml(idStr) + '\">编辑</button>' +
          '</div></td>' +
        '</tr>'
      );
    }).join('');
    setDrawerPagination(
      dom.missingDrawerPaginationTop,
      dom.missingDrawerPaginationBottom,
      buildDrawerPagination(total, page.pageIndex, page.totalPages, page.start, page.end, 'missing')
    );
    var totalItems = 0;
    getMissingDrawerVisibleModules().forEach(function(m) {
      var count = Number(m && m.item_count);
      if (!Number.isFinite(count) || count < 0) count = 0;
      totalItems += count;
    });
    setStatus(dom.missingDrawerStatus, '已加载 ' + total + ' 个模块，' + totalItems + ' 条易漏用例。', total ? 'ok' : 'warn');
    syncMissingDrawerControls();
    syncMissingDrawerModuleCompletion(list);
  }

  function handleMissingDrawerPaginationAction(action) {
    var total = getMissingDrawerVisibleModules().length;
    var totalPages = total ? Math.ceil(total / getPageSize()) : 1;
    if (action === 'prev') state.missingDrawer.pageIndex = Math.max(0, state.missingDrawer.pageIndex - 1);
    if (action === 'next') state.missingDrawer.pageIndex = Math.min(totalPages - 1, state.missingDrawer.pageIndex + 1);
    renderMissingDrawerList();
  }

  function handleMissingDrawerPaginationJump(page) {
    var total = getMissingDrawerVisibleModules().length;
    var totalPages = total ? Math.ceil(total / getPageSize()) : 1;
    var target = Math.max(1, Math.min(Number(page) || 1, totalPages));
    state.missingDrawer.pageIndex = Math.max(0, target - 1);
    renderMissingDrawerList();
  }

  function getImportSelectDrawerVisibleFiles() {
    var list = Array.isArray(state.importSelectDrawer.files) ? state.importSelectDrawer.files : [];
    if (state.importSelectDrawer.versionId) {
      list = list.filter(function(f) {
        return String(f && f.version_id || '') === String(state.importSelectDrawer.versionId || '');
      });
    }
    var term = String(state.importSelectDrawer.searchText || '').trim().toLowerCase();
    if (term) {
      list = list.filter(function(f) {
        var name = f && f.file_name_clean ? String(f.file_name_clean) : '';
        return name.toLowerCase().indexOf(term) !== -1;
      });
    }
    return list;
  }

  function getImportSelectDrawerPagedFiles() {
    var visible = getImportSelectDrawerVisibleFiles();
    var page = resolveDrawerPage(visible.length, state.importSelectDrawer.pageIndex);
    state.importSelectDrawer.pageIndex = page.pageIndex;
    return {
      page: page,
      list: visible.slice(page.start, page.end),
      total: visible.length,
    };
  }

  function syncImportSelectDrawerControls() {
    if (!dom.importSelectBatchBtn && !dom.importSelectSelectAll) return;
    state.importSelectDrawer.selection = state.importSelectDrawer.selection instanceof Set ? state.importSelectDrawer.selection : new Set();

    var visible = getImportSelectDrawerVisibleFiles();
    var page = resolveDrawerPage(visible.length, state.importSelectDrawer.pageIndex);
    state.importSelectDrawer.pageIndex = page.pageIndex;
    var paged = visible.slice(page.start, page.end);
    var visibleIds = {};
    visible.forEach(function(f) {
      if (!f || !f.id) return;
      visibleIds[String(f.id)] = true;
    });

    var nextSel = new Set();
    state.importSelectDrawer.selection.forEach(function(id) {
      if (visibleIds[String(id)]) nextSel.add(String(id));
    });
    state.importSelectDrawer.selection = nextSel;

    var selected = state.importSelectDrawer.selection.size;
    var loading = Boolean(state.importSelectDrawer.loading || state.importSelectDrawer.processing);

    if (dom.importSelectBatchBtn) {
      dom.importSelectBatchBtn.disabled = loading || selected === 0;
    }
    if (dom.importSelectSelectAll) {
      var pageTotal = paged.length;
      var pageSelected = paged.reduce(function(count, f) {
        if (!f || !f.id) return count;
        return state.importSelectDrawer.selection.has(String(f.id)) ? count + 1 : count;
      }, 0);
      dom.importSelectSelectAll.checked = Boolean(pageTotal && pageSelected === pageTotal);
      dom.importSelectSelectAll.indeterminate = Boolean(pageSelected && pageSelected < pageTotal);
    }
  }

  function setImportSelectDrawerSelectionAll(checked) {
    state.importSelectDrawer.selection = state.importSelectDrawer.selection instanceof Set ? state.importSelectDrawer.selection : new Set();
    var pageData = getImportSelectDrawerPagedFiles();
    var visible = pageData.list;
    if (checked) {
      visible.forEach(function(f) {
        if (!f || !f.id) return;
        state.importSelectDrawer.selection.add(String(f.id));
      });
    } else {
      visible.forEach(function(f) {
        if (!f || !f.id) return;
        state.importSelectDrawer.selection.delete(String(f.id));
      });
    }
    renderImportSelectDrawerList();
    syncImportSelectDrawerControls();
  }

  function resetImportSelectDrawer() {
    state.importSelectDrawer.projectId = null;
    state.importSelectDrawer.versionId = null;
    state.importSelectDrawer.searchText = '';
    state.importSelectDrawer.files = [];
    state.importSelectDrawer.loading = false;
    state.importSelectDrawer.processing = false;
    state.importSelectDrawer.selection = new Set();
    state.importSelectDrawer.skipCloseImport = false;
    state.importSelectDrawer.pageIndex = 0;
    state.importSelectDrawer.loadSeq = 0;
    setStatus(dom.importSelectStatus, '', '');
    syncProjectOptions(dom.importSelectProjectSelect, '请选择项目');
    if (dom.importSelectProjectSelect) dom.importSelectProjectSelect.value = '';
    if (dom.importSelectVersionSelect) {
      dom.importSelectVersionSelect.disabled = true;
      dom.importSelectVersionSelect.innerHTML = '<option value=\"\">请选择版本</option><option value=\"0\">全部版本</option>';
      dom.importSelectVersionSelect.value = '';
    }
    if (dom.importSelectSearchInput) dom.importSelectSearchInput.value = '';
    if (dom.importSelectListBody) {
      dom.importSelectListBody.innerHTML = '<tr><td colspan=\"7\"><p class=\"hint\">请选择项目后点击“查询”。</p></td></tr>';
    }
    setDrawerPagination(dom.importSelectPaginationTop, dom.importSelectPaginationBottom, '');
    if (dom.importSelectSelectAll) {
      dom.importSelectSelectAll.checked = false;
      dom.importSelectSelectAll.indeterminate = false;
    }
    if (dom.importSelectBatchBtn) dom.importSelectBatchBtn.disabled = true;
  }

  function handleImportSelectProjectChange() {
    var projectId = normalizeId(dom.importSelectProjectSelect ? dom.importSelectProjectSelect.value : '');
    state.importSelectDrawer.projectId = projectId;
    state.importSelectDrawer.versionId = null;
    state.importSelectDrawer.files = [];
    state.importSelectDrawer.processing = false;
    state.importSelectDrawer.selection = new Set();
    state.importSelectDrawer.pageIndex = 0;
    state.importSelectDrawer.searchText = '';
    if (dom.importSelectSearchInput) dom.importSelectSearchInput.value = '';
    if (dom.importSelectSelectAll) {
      dom.importSelectSelectAll.checked = false;
      dom.importSelectSelectAll.indeterminate = false;
    }
    if (dom.importSelectVersionSelect) {
      dom.importSelectVersionSelect.disabled = true;
      dom.importSelectVersionSelect.innerHTML = '<option value=\"\">请选择版本</option><option value=\"0\">全部版本</option>';
      dom.importSelectVersionSelect.value = '';
    }
    setStatus(dom.importSelectStatus, '', '');
    renderImportSelectDrawerList();
    if (!projectId) return;
    loadVersions(projectId)
      .then(function() {
        if (!dom.importSelectVersionSelect) return;
        syncVersionOptionsWithAll(dom.importSelectVersionSelect, projectId);
        dom.importSelectVersionSelect.disabled = false;
      })
      .catch(function(err) {
        setStatus(dom.importSelectStatus, err && err.message ? err.message : '加载版本失败', 'err');
      });
  }

  function handleImportSelectVersionChange() {
    state.importSelectDrawer.versionId = normalizeId(dom.importSelectVersionSelect ? dom.importSelectVersionSelect.value : '');
    state.importSelectDrawer.pageIndex = 0;
    renderImportSelectDrawerList();
    syncImportSelectDrawerControls();
  }

  function handleImportSelectSearchInput() {
    state.importSelectDrawer.searchText = dom.importSelectSearchInput ? dom.importSelectSearchInput.value : '';
    state.importSelectDrawer.pageIndex = 0;
    renderImportSelectDrawerList();
    syncImportSelectDrawerControls();
  }

  function renderImportSelectDrawerList() {
    if (!dom.importSelectListBody) return;
    if (!state.importSelectDrawer.projectId) {
      dom.importSelectListBody.innerHTML = '<tr><td colspan=\"7\"><p class=\"hint\">请选择项目后点击“查询”。</p></td></tr>';
      setDrawerPagination(dom.importSelectPaginationTop, dom.importSelectPaginationBottom, '');
      syncImportSelectDrawerControls();
      return;
    }
    if (state.importSelectDrawer.loading) {
      dom.importSelectListBody.innerHTML = '<tr><td colspan=\"7\"><p class=\"hint\">加载中...</p></td></tr>';
      setDrawerPagination(dom.importSelectPaginationTop, dom.importSelectPaginationBottom, '');
      syncImportSelectDrawerControls();
      return;
    }
    var result = getImportSelectDrawerPagedFiles();
    var list = result.list;
    var total = result.total;
    var page = result.page;
    if (!total) {
      var term = String(state.importSelectDrawer.searchText || '').trim();
      var hint = term ? '未找到匹配的用例文件' : '暂无用例文件';
      dom.importSelectListBody.innerHTML = '<tr><td colspan=\"7\"><p class=\"hint\">' + escapeHtml(hint) + '</p></td></tr>';
      setDrawerPagination(dom.importSelectPaginationTop, dom.importSelectPaginationBottom, '');
      syncImportSelectDrawerControls();
      return;
    }
    state.importSelectDrawer.selection = state.importSelectDrawer.selection instanceof Set ? state.importSelectDrawer.selection : new Set();
    var disabled = Boolean(state.importSelectDrawer.processing);
    dom.importSelectListBody.innerHTML = list.map(function(f) {
      var rowProjectId = f && (f.project_id || f.project_id === 0) ? f.project_id : state.importSelectDrawer.projectId;
      var projectName = state.projectNameById[rowProjectId] || ('项目#' + rowProjectId);
      var versionName = getVersionName(rowProjectId, f && f.version_id ? f.version_id : null);
      var idStr = f && f.id ? String(f.id) : '';
      var checked = idStr && state.importSelectDrawer.selection.has(idStr) ? ' checked' : '';
      var fileName = f && f.file_name_clean ? f.file_name_clean : ('文件#' + (f && f.id ? f.id : ''));
      var reuseText = (f && f.reuse_enabled) ? '复用' : '普通';
      var itemCount = (f && (f.item_count || f.item_count === 0)) ? String(f.item_count) : '--';
      return (
        '<tr>' +
          '<td><input type=\"checkbox\" data-case-lib-import-select=\"' + escapeHtml(idStr) + '\"' + checked + (disabled ? ' disabled' : '') + '/></td>' +
          '<td>' + escapeHtml(projectName) + '</td>' +
          '<td>' + escapeHtml(versionName) + '</td>' +
          '<td>' + escapeHtml(fileName) + '</td>' +
          '<td>' + escapeHtml(reuseText) + '</td>' +
          '<td>' + escapeHtml(itemCount) + '</td>' +
          '<td><button class=\"primary\" type=\"button\" data-case-lib-import-pick=\"' + escapeHtml(idStr) + '\"' + (disabled ? ' disabled' : '') + '>导入</button></td>' +
        '</tr>'
      );
    }).join('');
    setDrawerPagination(
      dom.importSelectPaginationTop,
      dom.importSelectPaginationBottom,
      buildDrawerPagination(total, page.pageIndex, page.totalPages, page.start, page.end, 'import-select')
    );
    syncImportSelectDrawerControls();
  }

  function loadImportSelectDrawerFiles() {
    var projectId = normalizeId(dom.importSelectProjectSelect ? dom.importSelectProjectSelect.value : '');
    var versionId = normalizeId(dom.importSelectVersionSelect ? dom.importSelectVersionSelect.value : '');
    state.importSelectDrawer.projectId = projectId;
    state.importSelectDrawer.versionId = versionId;
    state.importSelectDrawer.searchText = dom.importSelectSearchInput ? dom.importSelectSearchInput.value : '';
    state.importSelectDrawer.files = [];
    state.importSelectDrawer.processing = false;
    state.importSelectDrawer.selection = new Set();
    state.importSelectDrawer.pageIndex = 0;
    renderImportSelectDrawerList();
    if (!projectId) {
      setStatus(dom.importSelectStatus, '请先选择项目', 'warn');
      return;
    }
    setStatus(dom.importSelectStatus, '加载用例库...', '');
    state.importSelectDrawer.loading = true;
    state.importSelectDrawer.loadSeq = Number(state.importSelectDrawer.loadSeq || 0) + 1;
    var seq = state.importSelectDrawer.loadSeq;
    Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId)])
      .then(function(res) {
        if (seq !== state.importSelectDrawer.loadSeq) return;
        var files = Array.isArray(res && res[0]) ? res[0] : [];
        state.importSelectDrawer.files = files;
        if (dom.importSelectVersionSelect) {
          syncVersionOptionsWithAll(dom.importSelectVersionSelect, projectId);
          dom.importSelectVersionSelect.disabled = false;
          if (versionId === 0) {
            dom.importSelectVersionSelect.value = '0';
          } else if (versionId) {
            var ok = (state.versionsByProject[projectId] || []).some(function(v) { return v && String(v.id) === String(versionId); });
            if (ok) {
              dom.importSelectVersionSelect.value = String(versionId);
            } else {
              dom.importSelectVersionSelect.value = '';
              state.importSelectDrawer.versionId = null;
            }
          } else {
            dom.importSelectVersionSelect.value = '';
            state.importSelectDrawer.versionId = null;
          }
        }
        setStatus(dom.importSelectStatus, '已加载 ' + files.length + ' 份用例文件', files.length ? 'ok' : 'warn');
      })
      .catch(function(err) {
        if (seq !== state.importSelectDrawer.loadSeq) return;
        state.importSelectDrawer.files = [];
        setStatus(dom.importSelectStatus, err && err.message ? err.message : '加载失败', 'err');
      })
      .finally(function() {
        if (seq !== state.importSelectDrawer.loadSeq) return;
        state.importSelectDrawer.loading = false;
        renderImportSelectDrawerList();
      });
  }

  function findCaseFileInImportSelectDrawer(id) {
    var fileId = Number(id);
    if (!isFinite(fileId)) return null;
    return (state.importSelectDrawer.files || []).find(function(f) { return f && f.id === fileId; }) || null;
  }

  function normalizeCaseItemValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\r\n/g, '\n').trim();
  }

  function mapCaseItemToWorkflowCase(item) {
    if (!item) return null;
    return {
      module: normalizeCaseItemValue(item.module || ''),
      title: normalizeCaseItemValue(item.title || ''),
      priority: normalizeCaseItemValue(item.priority || ''),
      preconditions: normalizeCaseItemValue(item.precondition || item.preconditions || ''),
      steps: normalizeCaseItemValue(item.steps || ''),
      expected: normalizeCaseItemValue(item.expected || ''),
    };
  }

  function importCaseFilesToWorkflow(files) {
    var list = Array.isArray(files) ? files.filter(Boolean) : [];
    if (!list.length) {
      setStatus(dom.importSelectStatus, '请先选择用例', 'warn');
      return Promise.resolve(false);
    }
    if (!apiClient || typeof apiClient.listCaseItems !== 'function') {
      setStatus(dom.importSelectStatus, '缺少用例明细接口（apiClient.listCaseItems）', 'err');
      return Promise.resolve(false);
    }
    var casesApi = window.app && window.app.casesCoreApi ? window.app.casesCoreApi : null;
    if (!casesApi || typeof casesApi.addImportedCase !== 'function') {
      setStatus(dom.importSelectStatus, '缺少用例导入能力（casesCore）', 'err');
      return Promise.resolve(false);
    }
    state.importSelectDrawer.processing = true;
    renderImportSelectDrawerList();
    syncImportSelectDrawerControls();
    setStatus(dom.importSelectStatus, '正在导入 ' + list.length + ' 份用例...', '');
    var successCount = 0;
    var failCount = 0;
    var caseStatusEl = document.getElementById('caseStatus');
    return Promise.all(list.map(function(file) {
      if (!file || !file.id) {
        failCount += 1;
        return Promise.resolve();
      }
      return apiClient.listCaseItems(file.id)
        .then(function(items) {
          var mapped = (Array.isArray(items) ? items : []).map(mapCaseItemToWorkflowCase).filter(function(item) {
            return item && item.module && item.title;
          });
          if (!mapped.length) {
            failCount += 1;
            return;
          }
          var name = file.file_name_clean || ('用例#' + file.id);
          var text = JSON.stringify(mapped, null, 2);
          casesApi.addImportedCase(name, text, mapped);
          successCount += 1;
        })
        .catch(function() {
          failCount += 1;
        });
    })).then(function() {
      var msg = '已导入 ' + successCount + ' 份用例';
      var type = successCount ? 'ok' : 'warn';
      if (failCount) {
        msg += '，失败 ' + failCount + ' 份';
        type = 'warn';
      }
      setStatus(dom.importSelectStatus, msg, type);
      if (caseStatusEl) setStatus(caseStatusEl, msg, type);
      return successCount > 0;
    }).finally(function() {
      state.importSelectDrawer.processing = false;
      renderImportSelectDrawerList();
      syncImportSelectDrawerControls();
    });
  }

  function importSelectedCaseFilesFromImportDrawer(options) {
    options = options || {};
    state.importSelectDrawer.selection = state.importSelectDrawer.selection instanceof Set ? state.importSelectDrawer.selection : new Set();
    var ids = Array.from(state.importSelectDrawer.selection);
    if (!ids.length) {
      setStatus(dom.importSelectStatus, '请先勾选需要导入的用例', 'warn');
      return Promise.resolve(false);
    }
    var files = ids.map(findCaseFileInImportSelectDrawer).filter(Boolean);
    state.importSelectDrawer.selection = new Set();
    if (dom.importSelectSelectAll) {
      dom.importSelectSelectAll.checked = false;
      dom.importSelectSelectAll.indeterminate = false;
    }
    renderImportSelectDrawerList();
    syncImportSelectDrawerControls();
    return importCaseFilesToWorkflow(files).then(function(ok) {
      if (ok && options.closeAfter && importSelectDrawerInstance && typeof importSelectDrawerInstance.close === 'function') {
        state.importSelectDrawer.skipCloseImport = true;
        importSelectDrawerInstance.close();
      }
      return ok;
    });
  }

  function openImportSelectDrawer() {
    if (window.app && window.app.drawer && typeof window.app.drawer.closeAllDrawers === 'function') {
      window.app.drawer.closeAllDrawers();
    }
    if (importSelectDrawerInstance && typeof importSelectDrawerInstance.open === 'function') {
      importSelectDrawerInstance.open();
      return true;
    }
    return false;
  }

  function handleImportSelectDrawerClose() {
    if (state.importSelectDrawer.skipCloseImport) {
      state.importSelectDrawer.skipCloseImport = false;
      return;
    }
    if (!state.importSelectDrawer.selection || !state.importSelectDrawer.selection.size) return;
    importSelectedCaseFilesFromImportDrawer({ closeAfter: false });
  }

  function buildExecMapByFileId(rows) {
	    var list = Array.isArray(rows) ? rows : [];
	    var byFileId = {};
	    list.forEach(function(item) {
	      if (!item) return;
	      var fid = item.case_file_id || item.case_file_id === 0 ? String(item.case_file_id) : '';
	      if (!fid) return;
	      byFileId[fid] = item;
	    });
	    return byFileId;
	  }

  function loadSelectDrawerFiles() {
    var projectId = normalizeId(dom.selectProjectSelect ? dom.selectProjectSelect.value : '');
    var versionId = normalizeId(dom.selectVersionSelect ? dom.selectVersionSelect.value : '');
    state.selectDrawer.projectId = projectId;
    state.selectDrawer.versionId = versionId;
    state.selectDrawer.searchText = dom.selectSearchInput ? dom.selectSearchInput.value : '';
    persistSelectDrawerState({ projectId: projectId, versionId: versionId || '' });
    state.selectDrawer.files = [];
    state.selectDrawer.execByFileId = {};
    state.selectDrawer.processing = false;
    state.selectDrawer.selection = new Set();
    state.selectDrawer.associationSwitchByFileId = {};
    renderSelectDrawerList();
    if (!projectId) {
      setStatus(dom.selectStatus, '请先选择项目', 'warn');
      return;
    }
    setStatus(dom.selectStatus, '加载用例库...', '');
    state.selectDrawer.loading = true;
    state.selectDrawer.loadSeq = Number(state.selectDrawer.loadSeq || 0) + 1;
    var seq = state.selectDrawer.loadSeq;
	    Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId), apiClient.listExecSetsByCaseFile(projectId)])
	      .then(function(res) {
	        if (seq !== state.selectDrawer.loadSeq) return;
	        var files = Array.isArray(res && res[0]) ? res[0] : [];
	        var execSets = Array.isArray(res && res[2]) ? res[2] : [];
	        state.selectDrawer.files = files;
	        state.selectDrawer.execByFileId = buildExecMapByFileId(execSets);
	        syncAssociationSwitchMapWithFiles(files);
        setStatus(dom.selectStatus, '已加载 ' + files.length + ' 份用例文件', files.length ? 'ok' : 'warn');
      })
      .catch(function(err) {
        if (seq !== state.selectDrawer.loadSeq) return;
        state.selectDrawer.files = [];
        state.selectDrawer.execByFileId = {};
        state.selectDrawer.associationSwitchByFileId = {};
        setStatus(dom.selectStatus, err && err.message ? err.message : '加载失败', 'err');
      })
      .finally(function() {
        if (seq !== state.selectDrawer.loadSeq) return;
        state.selectDrawer.loading = false;
        renderSelectDrawerList();
      });
  }

  function findCaseFileInSelectDrawer(id) {
    var fileId = Number(id);
    if (isNaN(fileId)) return null;
    return (state.selectDrawer.files || []).find(function(f) { return f && f.id === fileId; }) || null;
  }

  function openExecVersionSelectDrawer(projectId, options) {
    var drawerApi = window.app && window.app.execVersionDrawer ? window.app.execVersionDrawer : null;
    if (!drawerApi || typeof drawerApi.open !== 'function') {
      return Promise.resolve({ ok: true, versionId: null });
    }
    var opts = options && typeof options === 'object' ? options : {};
    var pid = projectId || opts.projectId || opts.project_id || '';
    if (!pid) return Promise.resolve({ ok: false, reason: 'no_project' });
    var projectName = state.projectNameById && state.projectNameById[pid] ? state.projectNameById[pid] : ('项目#' + pid);
    return drawerApi.open(Object.assign({}, opts, { projectId: pid, projectName: projectName }));
  }

  function execCaseFileFromDrawer(caseFile) {
    if (!caseFile || !caseFile.id) return;
    var pid = caseFile.project_id || null;
    if (!pid) return;

    maybeConfirmExecWithoutAssociation(caseFile).then(function(assocDecision) {
      if (!assocDecision || assocDecision.ok !== true) {
        setStatus(dom.selectStatus, '已取消转到执行', 'warn');
        return;
      }
      var associationEnabled = assocDecision.association_enabled === true;

      var wasOpen = Boolean(
        selectDrawerInstance &&
        selectDrawerInstance.element &&
        selectDrawerInstance.element.classList &&
        selectDrawerInstance.element.classList.contains('open')
      );
      if (wasOpen && selectDrawerInstance && typeof selectDrawerInstance.close === 'function') {
        try { if (window.app) window.app.__drawerSkipRestoreOnce = true; } catch (_) {}
        selectDrawerInstance.close();
      }

      var importVid = caseFile.version_id || null;
      var importVerName = getVersionName(pid, importVid) || '';
      openExecVersionSelectDrawer(pid, {
        title: '选择执行版本',
        importVersionId: importVid,
        importVersionName: importVerName || '',
      }).then(function(res) {
        if (!res || res.ok !== true) {
          if (wasOpen && selectDrawerInstance && typeof selectDrawerInstance.open === 'function') selectDrawerInstance.open();
          setStatus(dom.selectStatus, '已取消转到执行', 'warn');
          return;
        }
        var execVid = Object.prototype.hasOwnProperty.call(res, 'versionId') ? res.versionId : (res.exec_version_id || null);
        if (wasOpen && selectDrawerInstance && typeof selectDrawerInstance.open === 'function') selectDrawerInstance.open();
        setStatus(dom.selectStatus, '加载用例条目...', '');
        apiClient.listCaseItems(caseFile.id).then(function(items) {
          var res2 = transferItemsToTempExec(
            caseFile,
            caseFile.file_name_clean || ('用例#' + caseFile.id),
            items || [],
            {
              statusEl: dom.selectStatus,
              execVersionId: execVid,
              previousDrawer: selectDrawerInstance || null,
              openAssignDrawer: true,
              association_enabled: associationEnabled,
            }
          );
          Promise.resolve(res2).then(function() {
            if (selectDrawerInstance && typeof selectDrawerInstance.close === 'function') selectDrawerInstance.close();
          });
        }).catch(function(err) {
          setStatus(dom.selectStatus, err && err.message ? err.message : '加载用例失败', 'err');
        });
      });
    });
  }

  function batchExecSelectedCaseFilesFromSelectDrawer() {
    state.selectDrawer.selection = state.selectDrawer.selection instanceof Set ? state.selectDrawer.selection : new Set();
    var projectId = state.selectDrawer.projectId || null;
    if (!projectId) {
      setStatus(dom.selectStatus, '请先选择项目', 'warn');
      return;
    }
    var visible = getSelectDrawerVisibleFiles();
    var selectedFiles = visible.filter(function(f) {
      return f && f.id && state.selectDrawer.selection.has(String(f.id));
    });
    if (!selectedFiles.length) {
      setStatus(dom.selectStatus, '请先勾选用例', 'warn');
      return;
    }

    var failures = [];
    var successes = 0;
    var total = selectedFiles.length;

    var wasOpen = Boolean(
      selectDrawerInstance &&
      selectDrawerInstance.element &&
      selectDrawerInstance.element.classList &&
      selectDrawerInstance.element.classList.contains('open')
    );
    if (wasOpen && selectDrawerInstance && typeof selectDrawerInstance.close === 'function') {
      try { if (window.app) window.app.__drawerSkipRestoreOnce = true; } catch (_) {}
      selectDrawerInstance.close();
    }

    openExecVersionSelectDrawer(projectId, { title: '选择执行版本', importVersionMultiple: true })
      .then(function(res0) {
        if (!res0 || res0.ok !== true) {
          if (wasOpen && selectDrawerInstance && typeof selectDrawerInstance.open === 'function') selectDrawerInstance.open();
          setStatus(dom.selectStatus, '已取消批量转到执行', 'warn');
          return null;
        }
        var execVid = Object.prototype.hasOwnProperty.call(res0, 'versionId') ? res0.versionId : (res0.exec_version_id || null);
        if (wasOpen && selectDrawerInstance && typeof selectDrawerInstance.open === 'function') selectDrawerInstance.open();

        var precheck = Promise.resolve({ ok: true, skipConfirm: false });
        if (isExecDbEnabled()) {
          precheck = apiClient
            .listExecSets(projectId || undefined)
            .then(function(list) {
              var sets = Array.isArray(list) ? list : [];
              var activeNames = [];
              var ids = {};
              selectedFiles.forEach(function(f) { ids[Number(f.id)] = f; });
              function matchVersion(serverValue, targetValue) {
                if (targetValue === null || targetValue === undefined || targetValue === '') {
                  return serverValue === null || serverValue === undefined || String(serverValue) === '';
                }
                return String(serverValue) === String(targetValue);
              }
              sets.forEach(function(s) {
                if (!s || String(s.status || '') !== 'active') return;
                if (!matchVersion(s.version_id, execVid)) return;
                var fid = Number(s.case_file_id);
                var file = ids[fid];
                if (!file) return;
                activeNames.push(file.file_name_clean || ('用例#' + file.id));
              });
              if (!activeNames.length) return { ok: true, skipConfirm: false };
              var msg =
                '检测到以下用例已存在执行记录，将同步最新用例并尽量保留结果（模块+标题+预期一致保留），是否继续？\n' +
                activeNames.join('\n');
              return openConfirmDrawer({
                title: '确认批量转到执行',
                message: msg,
                confirmText: '继续转到执行',
                cancelText: '取消',
                previousDrawer: selectDrawerInstance || null,
              }).then(function(res) {
                if (!res || res.ok !== true) return { ok: false, reason: 'cancel' };
                return { ok: true, skipConfirm: true };
              });
            })
            .catch(function() {
              return { ok: true, skipConfirm: false };
            });
        }

        setStatus(dom.selectStatus, '批量转到执行中...', '');
        state.selectDrawer.processing = true;
        syncSelectDrawerControls();

        return precheck
          .then(function(ctx) {
            if (!ctx || ctx.ok === false) {
              setStatus(dom.selectStatus, '已取消批量转到执行', 'warn');
              return null;
            }
            var skipConfirm = Boolean(ctx && ctx.skipConfirm);
            var chain = Promise.resolve();
            selectedFiles.forEach(function(file, index) {
              chain = chain.then(function() {
                var name = file.file_name_clean || ('用例#' + file.id);
                setStatus(dom.selectStatus, '加载用例条目（' + (index + 1) + '/' + total + '）：' + name, '');
                return maybeConfirmExecWithoutAssociation(file)
                  .then(function(assocDecision) {
                    if (!assocDecision || assocDecision.ok !== true) {
                      failures.push({ name: name, err: new Error('cancelled_by_association') });
                      return null;
                    }
                    return apiClient
                      .listCaseItems(file.id)
                      .then(function(items) {
                        return transferItemsToTempExec(file, name, items || [], {
                          statusEl: dom.selectStatus,
                          switchTab: false,
                          skipActiveConfirm: skipConfirm,
                          execVersionId: execVid,
                          previousDrawer: selectDrawerInstance || null,
                          association_enabled: assocDecision.association_enabled === true,
                        }).then(function(res) {
                          if (res && res.ok) successes += 1;
                        });
                      })
                      .catch(function(err) {
                        failures.push({ name: name, err: err });
                      });
                  });
              });
            });

            return chain.then(function() {
              if (successes) {
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

              if (failures.length) {
                setStatus(
                  dom.selectStatus,
                  '批量转到执行完成：成功 ' + successes + ' 份，失败 ' + failures.length + ' 份',
                  successes ? 'warn' : 'err'
                );
              } else {
                setStatus(dom.selectStatus, '批量转到执行完成：成功 ' + successes + ' 份', 'ok');
              }

              state.selectDrawer.selection = new Set();
              if (selectDrawerInstance && typeof selectDrawerInstance.close === 'function') selectDrawerInstance.close();
              return null;
            });
          })
          .finally(function() {
            state.selectDrawer.processing = false;
            renderSelectDrawerList();
          });
      });
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
    if (dom.writerPublishProjectSelect) {
      dom.writerPublishProjectSelect.addEventListener('change', handleCaseLibraryWriterPublishProjectChange);
    }
    if (dom.writerPublishFileNameInput) {
      dom.writerPublishFileNameInput.addEventListener('input', handleCaseLibraryWriterPublishFileNameInput);
      dom.writerPublishFileNameInput.addEventListener('change', handleCaseLibraryWriterPublishFileNameInput);
    }
    if (dom.writerPublishVersionSelect) {
      dom.writerPublishVersionSelect.addEventListener('change', handleCaseLibraryWriterPublishVersionChange);
    }
    if (dom.writerPublishConfirmBtn) {
      dom.writerPublishConfirmBtn.addEventListener('click', confirmCaseLibraryWriterPublish);
    }
    if (dom.importExcelTemplateBtn) {
      dom.importExcelTemplateBtn.addEventListener('click', downloadImportExcelTemplate);
    }
    if (dom.importXmindTemplateBtn) {
      dom.importXmindTemplateBtn.addEventListener('click', downloadImportXmindTemplate);
    }
    if (dom.importDiffOverwriteBtn) {
      dom.importDiffOverwriteBtn.addEventListener('click', confirmOverwriteImportFromDiff);
    }
    if (dom.importInvalidConfirmBtn) {
      dom.importInvalidConfirmBtn.addEventListener('click', confirmImportFromInvalidDrawer);
    }
    if (dom.importInvalidBody) {
      dom.importInvalidBody.addEventListener('focusout', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.getAttribute) return;
        var field = t.getAttribute('data-case-lib-import-invalid-field');
        if (!field) return;
        var idx = Number(t.getAttribute('data-index'));
        if (!isFinite(idx) || idx < 0) return;
        var multiline = String(t.getAttribute('data-case-lib-multiline') || '').toLowerCase() === 'true';
        var raw = multiline ? t.innerText : t.textContent;
        var value = String(raw || '').trim();
        var item = state.importInvalid.items[idx];
        if (!item) return;
        if (field === 'priority') value = normalizePriorityInput(value);
        item[field] = value;
      });
    }
    if (dom.missingImportInput) {
      dom.missingImportInput.addEventListener('change', function(e) {
        var files = e && e.target && e.target.files ? Array.from(e.target.files) : [];
        handleMissingImportFiles(files);
        try { e.target.value = ''; } catch (_) {}
      });
    }
    if (dom.missingImportDropZone) {
      dom.missingImportDropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dom.missingImportDropZone.classList.add('dragover');
      });
      dom.missingImportDropZone.addEventListener('dragleave', function() {
        dom.missingImportDropZone.classList.remove('dragover');
      });
      dom.missingImportDropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dom.missingImportDropZone.classList.remove('dragover');
        var files = e && e.dataTransfer ? e.dataTransfer.files : null;
        if (files && files.length) handleMissingImportFiles(files);
      });
    }
    if (dom.missingImportProjectSelect) {
      dom.missingImportProjectSelect.addEventListener('change', handleMissingImportProjectChange);
    }
    if (dom.missingImportConfirmBtn) {
      dom.missingImportConfirmBtn.addEventListener('click', confirmMissingImportToDb);
    }
    if (dom.missingImportDiffConfirmBtn) {
      dom.missingImportDiffConfirmBtn.addEventListener('click', function() {
        if (!state.missingImportDiff || !state.missingImportDiff.pendingItemsByModule) return;
        executeMissingImportMerge(state.missingImportDiff).then(function(ok) {
          if (!ok) return;
          if (missingImportDiffDrawerInstance && typeof missingImportDiffDrawerInstance.close === 'function') {
            missingImportDiffDrawerInstance.close();
          }
        });
      });
    }
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
        openImportSelectDrawer();
      });
    }
    if (dom.caseLibraryImportSelectBtn) {
      dom.caseLibraryImportSelectBtn.addEventListener('click', function() {
        openImportSelectDrawer();
      });
    }
    if (dom.writerDrawerOpenBtn) {
      dom.writerDrawerOpenBtn.addEventListener('click', function() {
        openCaseLibraryWriterStructure();
      });
    }
    if (dom.missingReminderTop) {
      dom.missingReminderTop.addEventListener('click', handleMissingReminderAction);
    }
    if (dom.missingReminderBottom) {
      dom.missingReminderBottom.addEventListener('click', handleMissingReminderAction);
    }
    if (dom.aiGenBtn) {
      dom.aiGenBtn.addEventListener('click', function() {
        var reason = resolveCaseLibraryAiGenDisabledReason();
        if (reason === 'no-model') {
          showCenterToast('请到AI功能-功能指派 页面下，配置该功能模型。', 'warn', 5000);
          return;
        }
        if (reason === 'no-case') {
          showCenterToast('请先选择查看&编辑用例。', 'warn', 3000);
          return;
        }
        clearCaseLibraryAiGenResultBadge();
        syncCaseLibraryAiGenContext();
        openCaseLibraryAiGenDrawer();
        clearCaseLibraryAiGenResultBadge();
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
        var ai = ensureCaseLibraryAiGenState();
        ai.requirementText = dom.aiGenRequirementInput.value || '';
        syncCaseLibraryAiGenRunBtn();
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
        var ai = ensureCaseLibraryAiGenState();
        ai.selection = ai.selection instanceof Set ? ai.selection : new Set();
        if (t.checked) ai.selection.add(key);
        else ai.selection.delete(key);
        syncCaseLibraryAiGenSelectionHint(getCaseLibraryAiGenTotalCount());
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
    if (dom.editDrawerSelectAll) {
      dom.editDrawerSelectAll.addEventListener('change', function() {
        setEditDrawerSelectionAll(Boolean(dom.editDrawerSelectAll && dom.editDrawerSelectAll.checked));
      });
    }
    if (dom.editDrawerListBody) {
      dom.editDrawerListBody.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.getAttribute) return;
        var id = t.getAttribute('data-case-lib-edit-select');
        if (!id) return;
        state.editDrawer.selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
        if (t.checked) state.editDrawer.selection.add(String(id));
        else state.editDrawer.selection.delete(String(id));
        syncEditDrawerControls();
        persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
      });
      dom.editDrawerListBody.addEventListener('click', function(e) {
        var target = e && e.target ? e.target : null;
        var btn = target && target.closest ? target.closest('[data-case-lib-edit]') : null;
        if (!btn) return;
        var id = btn.getAttribute('data-case-lib-edit');
        var file = findCaseFileInEditDrawer(id);
        if (file) {
          safeLogOperation('view_case_file', 'case_file', file.id, { file_name: file.file_name_clean || '' });
          markCaseLibraryAiGenEditBadgeRead(file.id);
          if (btn.classList) btn.classList.remove('case-library-ai-gen-dot');
          openEditorForCaseFile(file);
        }
      });
    }
    if (dom.shareDrawerProjectSelect) {
      dom.shareDrawerProjectSelect.addEventListener('change', handleShareProjectChange);
    }
    if (dom.shareDrawerVersionSelect) {
      dom.shareDrawerVersionSelect.addEventListener('change', handleShareVersionChange);
    }
    if (dom.shareDrawerConfirmBtn) {
      dom.shareDrawerConfirmBtn.addEventListener('click', confirmShareCaseFile);
    }

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
    if (dom.editView) {
	      dom.editView.addEventListener('click', function(e) {
	        var t = e && e.target ? e.target : null;
	        if (!t) return;
        var toggle = t.closest ? t.closest('[data-case-lib-remark-toggle]') : null;
        if (toggle) {
          toggleRemark(toggle.getAttribute('data-index'));
        return;
      }
      var insertBtn = t.closest ? t.closest('[data-case-lib-insert]') : null;
      if (insertBtn) {
          var ir = null;
          try { ir = insertBtn.getBoundingClientRect ? insertBtn.getBoundingClientRect() : null; } catch (_) { ir = null; }
          var anchorRect = ir ? { left: ir.left, top: ir.top, width: ir.width, height: ir.height, bottom: ir.bottom } : null;
          insertCaseItem(Number(insertBtn.getAttribute('data-index')), anchorRect);
          return;
      }
      var removeBtn = t.closest ? t.closest('[data-case-lib-remove]') : null;
      if (removeBtn) {
          var rr = null;
          try { rr = removeBtn.getBoundingClientRect ? removeBtn.getBoundingClientRect() : null; } catch (_) { rr = null; }
          var anchorRect2 = rr ? { left: rr.left, top: rr.top, width: rr.width, height: rr.height, bottom: rr.bottom } : null;
          removeCaseItem(Number(removeBtn.getAttribute('data-index')), anchorRect2);
          return;
      }
        var pageBtn = t.closest ? t.closest('[data-case-lib-page]') : null;
        if (pageBtn) {
          handlePaginationAction(pageBtn.getAttribute('data-case-lib-page'));
        }
      });
	      dom.editView.addEventListener('change', function(e) {
	        var t = e && e.target ? e.target : null;
	        if (!t) return;
        if (t.hasAttribute && t.hasAttribute('data-case-lib-page-input')) {
          handlePaginationJump(t.value);
          return;
        }
        if (t.hasAttribute && t.hasAttribute('data-case-lib-select-all')) {
          var visibleStr = t.getAttribute('data-visible') || '';
          var visible = visibleStr.split(',').map(function(v) { return Number(v); }).filter(function(v) { return isFinite(v); });
          visible.forEach(function(idx) {
            if (t.checked) state.editor.selection.add(idx);
            else state.editor.selection.delete(idx);
          });
          renderEditorTable();
          return;
        }
	        if (t.hasAttribute && t.hasAttribute('data-case-lib-select')) {
	          var idx = Number(t.getAttribute('data-index'));
	          if (!isFinite(idx)) return;
	          if (t.checked) state.editor.selection.add(idx);
	          else state.editor.selection.delete(idx);
	          syncEditorBatchDeleteControls();
	        }
	      });
        dom.editView.addEventListener('input', function(e) {
          var t = e && e.target ? e.target : null;
          if (!t || !t.getAttribute) return;
          var field = t.getAttribute('data-case-lib-edit-field');
          var idx = Number(t.getAttribute('data-index'));
          if (field) {
            if (!isFinite(idx)) return;
            var item = state.editor.items[idx];
            if (!item) return;
            var multiline = String(t.getAttribute('data-case-lib-multiline') || '').toLowerCase() === 'true';
            var raw = multiline ? t.innerText : t.textContent;
            var next = normalizeEditorText(raw);
            item[field] = next;
            scheduleEditorAutoSave(idx);
            requestMissingReminderRefresh();
            return;
          }
          if (t.hasAttribute('data-case-lib-remark')) {
            if (!isFinite(idx)) return;
            var remarkItem = state.editor.items[idx];
            if (!remarkItem) return;
            remarkItem.remark = t.value || '';
            scheduleEditorAutoSave(idx);
            requestMissingReminderRefresh();
          }
        });
	      dom.editView.addEventListener('focusout', function(e) {
	        var t = e && e.target ? e.target : null;
	        if (!t || !t.getAttribute) return;
	        var field = t.getAttribute('data-case-lib-edit-field');
	        if (!field) return;
	        var idx = Number(t.getAttribute('data-index'));
	        if (!isFinite(idx)) return;
	        var multiline = String(t.getAttribute('data-case-lib-multiline') || '').toLowerCase() === 'true';
	        var raw = multiline ? t.innerText : t.textContent;
	        var item = state.editor.items[idx];
	        if (!item) return;
	        var prevNorm = normalizeEditorText(item[field]);
	        var nextNorm = normalizeEditorText(raw);
        if (prevNorm === nextNorm) return;
        item[field] = nextNorm;
        saveCaseItemAtIndex(idx, '保存');
        requestMissingReminderRefresh();
          setTimeout(function() { flushEditorPendingRender(); }, 0);
	      });
      dom.editView.addEventListener('blur', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.getAttribute) return;
        if (!t.hasAttribute('data-case-lib-remark')) return;
        var idx = Number(t.getAttribute('data-index'));
        if (!isFinite(idx)) return;
        var item = state.editor.items[idx];
        if (!item) return;
        item.remark = t.value || '';
        saveCaseItemAtIndex(idx, '保存');
        requestMissingReminderRefresh();
        setTimeout(function() { flushEditorPendingRender(); }, 0);
      }, true);
    }

    if (dom.missingDrawerProjectSelect) {
      dom.missingDrawerProjectSelect.addEventListener('change', handleMissingProjectChange);
    }
    if (dom.missingDrawerModuleSelect) {
      dom.missingDrawerModuleSelect.addEventListener('change', handleMissingModuleChange);
    }
    if (dom.missingDrawerTypeSelect) {
      dom.missingDrawerTypeSelect.addEventListener('change', handleMissingTypeSelectChange);
    }
    if (dom.missingDrawerTypeAddBtn) {
      dom.missingDrawerTypeAddBtn.addEventListener('click', function() {
        openMissingTypeAddDrawer('drawer');
      });
    }
    if (dom.missingDrawerTypeManageBtn) {
      dom.missingDrawerTypeManageBtn.addEventListener('click', openMissingTypeManageDrawer);
    }
    if (dom.missingDrawerTypeGrid) {
      dom.missingDrawerTypeGrid.addEventListener('change', function(e) {
        handleMissingTypeFilterChange(e && e.target ? e.target : null);
      });
    }
    if (dom.missingDrawerQueryBtn) {
      dom.missingDrawerQueryBtn.addEventListener('click', function() {
        if (!state.missingDrawer.projectId) {
          setStatus(dom.missingDrawerStatus, '请先选择项目', 'warn');
          return;
        }
        loadMissingDrawerModules(state.missingDrawer.projectId);
      });
    }
    if (dom.missingDrawerAddModuleBtn) {
      dom.missingDrawerAddModuleBtn.addEventListener('click', openMissingAddDrawer);
    }
    if (dom.missingDrawerBatchViewBtn) {
      dom.missingDrawerBatchViewBtn.addEventListener('click', function() {
        openMissingViewForModules(getSelectedMissingModules());
      });
    }
    if (dom.missingDrawerDeleteBtn) {
      dom.missingDrawerDeleteBtn.addEventListener('click', function(e) {
        var t = e && e.currentTarget ? e.currentTarget : null;
        deleteSelectedMissingModules(t);
      });
    }
    if (dom.missingDrawerExportXmindBtn) {
      dom.missingDrawerExportXmindBtn.addEventListener('click', exportMissingSelectionToXmind);
    }
    if (dom.missingDrawerExportExcelBtn) {
      dom.missingDrawerExportExcelBtn.addEventListener('click', exportMissingSelectionToExcel);
    }
    if (dom.missingDrawerSelectAll) {
      dom.missingDrawerSelectAll.addEventListener('change', function() {
        setMissingDrawerSelectionAll(Boolean(dom.missingDrawerSelectAll && dom.missingDrawerSelectAll.checked));
      });
    }
    if (dom.missingDrawerListBody) {
      dom.missingDrawerListBody.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.getAttribute) return;
        var id = t.getAttribute('data-case-lib-missing-select');
        if (!id) return;
        state.missingDrawer.selection = state.missingDrawer.selection instanceof Set ? state.missingDrawer.selection : new Set();
        if (t.checked) state.missingDrawer.selection.add(String(id));
        else state.missingDrawer.selection.delete(String(id));
        syncMissingDrawerControls();
      });
      dom.missingDrawerListBody.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-case-lib-missing-view]') : null;
        if (btn) {
          var id = btn.getAttribute('data-case-lib-missing-view');
          if (!id) return;
          var module = (state.missingDrawer.modules || []).find(function(m) { return m && String(m.id) === String(id); }) || null;
          if (module) openMissingViewForModules([module]);
          return;
        }
        var editBtn = e && e.target && e.target.closest ? e.target.closest('[data-case-lib-missing-edit]') : null;
        if (!editBtn) return;
        var mid = editBtn.getAttribute('data-case-lib-missing-edit');
        if (!mid) return;
        var target = (state.missingDrawer.modules || []).find(function(m) { return m && String(m.id) === String(mid); }) || null;
        if (target) openMissingEditDrawer(target);
      });
    }
    if (dom.missingAddConfirmBtn) {
      dom.missingAddConfirmBtn.addEventListener('click', confirmMissingAddModule);
    }
    if (dom.missingTypeAddConfirmBtn) {
      dom.missingTypeAddConfirmBtn.addEventListener('click', confirmMissingTypeAdd);
    }
    if (dom.missingEditConfirmBtn) {
      dom.missingEditConfirmBtn.addEventListener('click', confirmMissingEditModule);
    }
    if (dom.missingBatchDeleteBtn) {
      dom.missingBatchDeleteBtn.addEventListener('click', function(e) {
        var t = e && e.currentTarget ? e.currentTarget : null;
        removeSelectedMissingItems(t);
      });
    }
    if (dom.missingView) {
      dom.missingView.addEventListener('click', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t) return;
        var typeRemoveBtn = t.closest ? t.closest('[data-case-lib-missing-type-remove]') : null;
        if (typeRemoveBtn) {
          removeMissingTypeSlot(
            typeRemoveBtn.getAttribute('data-index'),
            typeRemoveBtn.getAttribute('data-type-index'),
            typeRemoveBtn
          );
          return;
        }
        var typeAddBtn = t.closest ? t.closest('[data-case-lib-missing-type-add]') : null;
        if (typeAddBtn) {
          addMissingTypeSlot(typeAddBtn.getAttribute('data-index'));
          return;
        }
        var insertBtn = t.closest ? t.closest('[data-case-lib-missing-insert]') : null;
        if (insertBtn) {
          var ir = null;
          try { ir = insertBtn.getBoundingClientRect ? insertBtn.getBoundingClientRect() : null; } catch (_) { ir = null; }
          var anchorRect = ir ? { left: ir.left, top: ir.top, width: ir.width, height: ir.height, bottom: ir.bottom } : null;
          insertMissingItem(Number(insertBtn.getAttribute('data-index')), anchorRect);
          return;
        }
        var removeBtn = t.closest ? t.closest('[data-case-lib-missing-remove]') : null;
        if (removeBtn) {
          var rr = null;
          try { rr = removeBtn.getBoundingClientRect ? removeBtn.getBoundingClientRect() : null; } catch (_) { rr = null; }
          var anchorRect2 = rr ? { left: rr.left, top: rr.top, width: rr.width, height: rr.height, bottom: rr.bottom } : null;
          removeMissingItem(Number(removeBtn.getAttribute('data-index')), anchorRect2);
          return;
        }
        var emptyAdd = t.closest ? t.closest('[data-case-lib-missing-empty-add]') : null;
        if (emptyAdd) {
          var er = null;
          try { er = emptyAdd.getBoundingClientRect ? emptyAdd.getBoundingClientRect() : null; } catch (_) { er = null; }
          var anchorRect3 = er ? { left: er.left, top: er.top, width: er.width, height: er.height, bottom: er.bottom } : null;
          addMissingEmptyItem(anchorRect3);
          return;
        }
        var pageBtn = t.closest ? t.closest('[data-case-lib-missing-page]') : null;
        if (pageBtn) {
          handleMissingPaginationAction(pageBtn.getAttribute('data-case-lib-missing-page'));
        }
      });
      dom.missingView.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t) return;
        if (t.hasAttribute && t.hasAttribute('data-case-lib-missing-type')) {
          handleMissingItemTypeChange(
            t.getAttribute('data-index'),
            t.getAttribute('data-type-index'),
            t.value
          );
          return;
        }
        if (t.hasAttribute && t.hasAttribute('data-case-lib-missing-page-input')) {
          handleMissingPaginationJump(t.value);
          return;
        }
        if (t.hasAttribute && t.hasAttribute('data-case-lib-missing-select-all')) {
          var visibleStr = t.getAttribute('data-visible') || '';
          var visible = visibleStr.split(',').map(function(v) { return Number(v); }).filter(function(v) { return isFinite(v); });
          visible.forEach(function(idx) {
            if (t.checked) state.missingView.selection.add(idx);
            else state.missingView.selection.delete(idx);
          });
          renderMissingViewTable();
          return;
        }
        if (t.hasAttribute && t.hasAttribute('data-case-lib-missing-select')) {
          var idx = Number(t.getAttribute('data-index'));
          if (!isFinite(idx)) return;
          if (t.checked) state.missingView.selection.add(idx);
          else state.missingView.selection.delete(idx);
          syncMissingBatchDeleteControls();
        }
      });
      dom.missingView.addEventListener('input', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.getAttribute) return;
        var field = t.getAttribute('data-case-lib-missing-field');
        var idx = Number(t.getAttribute('data-index'));
        if (!field) return;
        if (!isFinite(idx)) return;
        var item = state.missingView.items[idx];
        if (!item) return;
        var multiline = String(t.getAttribute('data-case-lib-missing-multiline') || '').toLowerCase() === 'true';
        var raw = multiline ? t.innerText : t.textContent;
        var next = normalizeEditorText(raw);
        if (field === 'priority') {
          var normalized = normalizePriorityInput(next);
          if (normalized !== next) {
            next = normalized;
            if (!multiline && t.textContent !== normalized) {
              t.textContent = normalized;
              moveInlineEditorCaretToEnd(t);
            }
          }
        }
        item[field] = next;
        scheduleMissingAutoSave(idx);
      });
      dom.missingView.addEventListener('focusout', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.getAttribute) return;
        var field = t.getAttribute('data-case-lib-missing-field');
        if (!field) return;
        var idx = Number(t.getAttribute('data-index'));
        if (!isFinite(idx)) return;
        var multiline = String(t.getAttribute('data-case-lib-missing-multiline') || '').toLowerCase() === 'true';
        var raw = multiline ? t.innerText : t.textContent;
        var item = state.missingView.items[idx];
        if (!item) return;
        var prevNorm = normalizeEditorText(item[field]);
        var nextNorm = normalizeEditorText(raw);
        if (field === 'priority') {
          prevNorm = normalizePriorityInput(prevNorm);
          nextNorm = normalizePriorityInput(nextNorm);
          if (!multiline && t.textContent !== nextNorm) {
            t.textContent = nextNorm;
          }
        }
        if (prevNorm === nextNorm) return;
        item[field] = nextNorm;
        saveMissingItemAtIndex(idx, '保存');
      });
    }
    if (dom.missingTypePills) {
      dom.missingTypePills.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-case-lib-missing-type-pill]') : null;
        if (!btn) return;
        var key = btn.getAttribute('data-case-lib-missing-type-pill');
        toggleMissingViewTypeFilter(key);
      });
    }
    if (dom.missingTypeManageBody) {
      dom.missingTypeManageBody.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-case-lib-missing-type-delete]') : null;
        if (!btn) return;
        var id = btn.getAttribute('data-case-lib-missing-type-delete');
        if (!id) return;
        var target = (state.missingType.types || []).find(function(t) { return t && String(t.id) === String(id); }) || null;
        requestDeleteMissingType(target, btn);
      });
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('app-settings-loaded', function() {
        renderMissingReminder();
      });
      window.addEventListener('app-settings-updated', function(e) {
        var detail = e && e.detail ? e.detail : null;
        var keys = detail && Array.isArray(detail.keys) ? detail.keys : [];
        var touchedAi = keys.indexOf('missingCaseReminderAiEnabled') !== -1;
        if (touchedAi) {
          var reminder = ensureMissingReminderState();
          if (resolveMissingReminderAiEnabled() !== 'on') {
            clearMissingReminderAi(reminder);
          }
        }
        if (!keys.length
          || keys.indexOf('missingCaseReminderPlacement') !== -1
          || keys.indexOf('missingCaseReminderMatchConfig') !== -1
          || touchedAi) {
          requestMissingReminderRefresh();
          renderMissingReminder();
        }
      });
      window.addEventListener('missing-reminder-ai-task', function(e) {
        var detail = e && e.detail ? e.detail : null;
        if (!detail || detail.scene !== 'case-library') return;
        if (resolveMissingReminderAiEnabled() !== 'on') return;
        var reminder = ensureMissingReminderState();
        if (applyMissingReminderAiTaskState(reminder, detail.task)) {
          renderMissingReminder();
        }
      });
      window.addEventListener('case-library-ai-gen-task', function(e) {
        var detail = e && e.detail ? e.detail : null;
        if (!detail || detail.scene !== 'case-library') return;
        applyCaseLibraryAiGenTaskState(detail.task);
      });
    }

    if (dom.selectProjectSelect) {
      dom.selectProjectSelect.addEventListener('change', handleSelectProjectChange);
    }
    if (dom.selectVersionSelect) {
      dom.selectVersionSelect.addEventListener('change', handleSelectVersionChange);
    }
    if (dom.selectSearchInput) {
      dom.selectSearchInput.addEventListener('input', handleSelectSearchInput);
    }
    if (dom.selectConfirmBtn) {
      dom.selectConfirmBtn.addEventListener('click', loadSelectDrawerFiles);
    }
    if (dom.selectBatchExecBtn) {
      dom.selectBatchExecBtn.addEventListener('click', batchExecSelectedCaseFilesFromSelectDrawer);
    }
    if (dom.selectSelectAll) {
      dom.selectSelectAll.addEventListener('change', function() {
        setSelectDrawerSelectionAll(Boolean(dom.selectSelectAll && dom.selectSelectAll.checked));
      });
    }
    if (dom.selectListBody) {
      dom.selectListBody.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.getAttribute) return;
        var assocSwitchId = t.getAttribute('data-case-lib-association-switch');
        if (assocSwitchId) {
          setAssociationSwitchState(assocSwitchId, Boolean(t.checked));
          return;
        }
        var id = t.getAttribute('data-case-lib-select-select');
        if (!id) return;
        state.selectDrawer.selection = state.selectDrawer.selection instanceof Set ? state.selectDrawer.selection : new Set();
        if (t.checked) state.selectDrawer.selection.add(String(id));
        else state.selectDrawer.selection.delete(String(id));
        syncSelectDrawerControls();
      });
      dom.selectListBody.addEventListener('click', function(e) {
        var assocBtn = e && e.target && e.target.closest ? e.target.closest('[data-case-lib-association]') : null;
        if (assocBtn) {
          var assocId = assocBtn.getAttribute('data-case-lib-association');
          var assocFile = findCaseFileInSelectDrawer(assocId);
          if (assocFile) openAssociationDrawerFromSelect(assocFile);
          return;
        }
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-case-lib-exec]') : null;
        if (!btn) return;
        var id = btn.getAttribute('data-case-lib-exec');
        var file = findCaseFileInSelectDrawer(id);
        if (file) execCaseFileFromDrawer(file);
      });
    }
    if (dom.associationAddBtn) {
      dom.associationAddBtn.addEventListener('click', function() {
        var mainCase = state.associationDrawer.caseFile;
        if (!mainCase || !mainCase.id) {
          if (dom.associationStatus) setStatus(dom.associationStatus, '主用例缺失', 'warn');
          return;
        }
        openAssociationPickDrawer('create', mainCase, null);
      });
    }
    if (dom.associationListBody) {
      dom.associationListBody.addEventListener('click', function(e) {
        var editBtn = e && e.target && e.target.closest ? e.target.closest('[data-case-lib-assoc-edit]') : null;
        if (editBtn) {
          var editId = editBtn.getAttribute('data-case-lib-assoc-edit');
          var rows = Array.isArray(state.associationDrawer.rows) ? state.associationDrawer.rows : [];
          var hit = rows.find(function(row) { return row && String(row.id) === String(editId); }) || null;
          if (!hit) return;
          openAssociationPickDrawer('edit', state.associationDrawer.caseFile, hit);
          return;
        }
        var delBtn = e && e.target && e.target.closest ? e.target.closest('[data-case-lib-assoc-delete]') : null;
        if (!delBtn) return;
        var delId = delBtn.getAttribute('data-case-lib-assoc-delete');
        var rows2 = Array.isArray(state.associationDrawer.rows) ? state.associationDrawer.rows : [];
        var hit2 = rows2.find(function(row) { return row && String(row.id) === String(delId); }) || null;
        if (!hit2) return;
        requestDeleteAssociationRow(hit2);
      });
    }
    if (dom.associationPickSearchInput) {
      dom.associationPickSearchInput.addEventListener('input', function() {
        state.associationPickDrawer.searchText = dom.associationPickSearchInput ? dom.associationPickSearchInput.value : '';
        filterAssociationCandidateRows();
        renderAssociationCandidateList();
      });
    }
    if (dom.associationPickVersionSelect) {
      dom.associationPickVersionSelect.addEventListener('change', function() {
        state.associationPickDrawer.versionId = normalizeId(dom.associationPickVersionSelect ? dom.associationPickVersionSelect.value : '');
        state.associationPickDrawer.subCaseFile = null;
        state.associationPickDrawer.queried = false;
        clearAssociationCandidateAndItems(false);
        if (dom.associationPickStatus) {
          setStatus(dom.associationPickStatus, state.associationPickDrawer.versionId ? '点击“查询”加载副用例' : '请先选择版本', '');
        }
      });
    }
    if (dom.associationPickQueryBtn) {
      dom.associationPickQueryBtn.addEventListener('click', function() {
        loadAssociationCandidateRows();
      });
    }
    if (dom.associationPickRefreshBtn) {
      dom.associationPickRefreshBtn.addEventListener('click', function() {
        var mainCase = state.associationPickDrawer.mainCaseFile;
        prepareAssociationPickVersionOptions(mainCase).then(function() {
          if (dom.associationPickStatus) setStatus(dom.associationPickStatus, '版本列表已刷新，请选择版本并查询', 'ok');
          clearAssociationCandidateAndItems(false);
        });
      });
    }
    if (dom.associationPickCaseBody) {
      dom.associationPickCaseBody.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.getAttribute) return;
        var subId = t.getAttribute('data-case-lib-assoc-subcase');
        if (!subId) return;
        var rows = Array.isArray(state.associationPickDrawer.filteredRows) ? state.associationPickDrawer.filteredRows : [];
        var hit = rows.find(function(row) { return row && String(row.id) === String(subId); }) || null;
        state.associationPickDrawer.subCaseFile = hit;
        if (dom.associationPickStatus) {
          setStatus(dom.associationPickStatus, hit ? '已选择副用例，点击“下一步选择条目”' : '请先选择副用例', '');
        }
      });
    }
    if (dom.associationPickItemBody) {
      dom.associationPickItemBody.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.getAttribute) return;
        var itemId = t.getAttribute('data-case-lib-assoc-item');
        if (!itemId) return;
        state.associationPickDrawer.selection = state.associationPickDrawer.selection instanceof Set ? state.associationPickDrawer.selection : new Set();
        if (t.checked) state.associationPickDrawer.selection.add(String(itemId));
        else state.associationPickDrawer.selection.delete(String(itemId));
        syncAssociationPickSelectAllState();
      });
    }
    if (dom.associationPickSelectAll) {
      dom.associationPickSelectAll.addEventListener('change', function() {
        setAssociationPickSelectionAll(Boolean(dom.associationPickSelectAll && dom.associationPickSelectAll.checked));
      });
    }
    if (dom.associationPickNextBtn) {
      dom.associationPickNextBtn.addEventListener('click', openAssociationItemDrawerFromPick);
    }
    if (dom.associationPickConfirmBtn) {
      dom.associationPickConfirmBtn.addEventListener('click', submitAssociationItemSelection);
    }
    if (dom.associationDeleteConfirmBtn) {
      dom.associationDeleteConfirmBtn.addEventListener('click', function() {
        confirmDeleteAssociationRow();
        if (associationDeleteConfirmDrawerInstance && typeof associationDeleteConfirmDrawerInstance.close === 'function') {
          associationDeleteConfirmDrawerInstance.close();
        }
      });
    }

    if (dom.importSelectProjectSelect) {
      dom.importSelectProjectSelect.addEventListener('change', handleImportSelectProjectChange);
    }
    if (dom.importSelectVersionSelect) {
      dom.importSelectVersionSelect.addEventListener('change', handleImportSelectVersionChange);
    }
    if (dom.importSelectSearchInput) {
      dom.importSelectSearchInput.addEventListener('input', handleImportSelectSearchInput);
    }
    if (dom.importSelectQueryBtn) {
      dom.importSelectQueryBtn.addEventListener('click', loadImportSelectDrawerFiles);
    }
    if (dom.importSelectBatchBtn) {
      dom.importSelectBatchBtn.addEventListener('click', function() {
        importSelectedCaseFilesFromImportDrawer({ closeAfter: true });
      });
    }
    if (dom.importSelectSelectAll) {
      dom.importSelectSelectAll.addEventListener('change', function() {
        setImportSelectDrawerSelectionAll(Boolean(dom.importSelectSelectAll && dom.importSelectSelectAll.checked));
      });
    }
    if (dom.importSelectListBody) {
      dom.importSelectListBody.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.getAttribute) return;
        var id = t.getAttribute('data-case-lib-import-select');
        if (!id) return;
        state.importSelectDrawer.selection = state.importSelectDrawer.selection instanceof Set ? state.importSelectDrawer.selection : new Set();
        if (t.checked) state.importSelectDrawer.selection.add(String(id));
        else state.importSelectDrawer.selection.delete(String(id));
        syncImportSelectDrawerControls();
      });
      dom.importSelectListBody.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-case-lib-import-pick]') : null;
        if (!btn) return;
        var id = btn.getAttribute('data-case-lib-import-pick');
        if (!id) return;
        var file = findCaseFileInImportSelectDrawer(id);
        if (!file) return;
        importCaseFilesToWorkflow([file]).then(function(ok) {
          if (ok && importSelectDrawerInstance && typeof importSelectDrawerInstance.close === 'function') {
            state.importSelectDrawer.skipCloseImport = true;
            importSelectDrawerInstance.close();
          }
        });
      });
    }

    if (dom.historyDrawerProjectSelect) {
      dom.historyDrawerProjectSelect.addEventListener('change', handleHistoryQueryProjectChange);
    }
    if (dom.historyDrawerVersionSelect) {
      dom.historyDrawerVersionSelect.addEventListener('change', handleHistoryQueryVersionChange);
    }
    if (dom.historyDrawerSearchInput) {
      dom.historyDrawerSearchInput.addEventListener('input', handleHistoryQuerySearchInput);
    }
    if (dom.historyDrawerQueryBtn) {
      dom.historyDrawerQueryBtn.addEventListener('click', loadHistoryQueryDrawerFiles);
    }
    if (dom.historyDrawerClearBtn) {
      dom.historyDrawerClearBtn.addEventListener('click', clearHistoryQuerySearch);
    }
    if (dom.historyDrawerListBody) {
      dom.historyDrawerListBody.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-case-lib-history-open]') : null;
        if (!btn) return;
        var pid = btn.getAttribute('data-case-lib-history-project') || '';
        var name = btn.getAttribute('data-case-lib-history-file') || '';
        var vid = btn.getAttribute('data-case-lib-history-version') || '';
        openCaseLibraryHistoryDetail(pid, name, vid);
      });
    }
    if (dom.historyRefreshBtn) {
      dom.historyRefreshBtn.addEventListener('click', function() {
        var pid = state.historyDetail && state.historyDetail.projectId ? String(state.historyDetail.projectId) : '';
        var name = state.historyDetail && state.historyDetail.fileNameClean ? String(state.historyDetail.fileNameClean) : '';
        if (!pid || !name) {
          setStatus(dom.historyStatus, '请先选择一个用例查看历史详情', 'warn');
          return;
        }
        ensureProjectsReady().then(function() {
          return loadCaseLibraryHistoryEntries(pid, name);
        });
      });
    }
    if (dom.historyHideBtn) {
      dom.historyHideBtn.addEventListener('click', function() {
        setHistoryDetailVisible(false);
        // 用户主动收起详情，视为切回“非详情”态：不再在刷新后自动恢复该详情。
        clearHistoryDetailPersistedState();
        // 若此前在编辑视图选中过用例，则刷新后优先恢复编辑视图；否则不指定。
        var hasEditor = Boolean(state.editor && state.editor.caseFile && state.editor.caseFile.id);
        if (hasEditor) persistCaseLibraryLastView('editor');
      });
    }
    if (dom.historyDetailCard) {
      dom.historyDetailCard.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-case-lib-history-page]') : null;
        if (!btn) return;
        var action = btn.getAttribute('data-case-lib-history-page') || '';
        if (!action) return;
        handleHistoryDetailPaginationAction(action);
      });
      dom.historyDetailCard.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.hasAttribute) return;
        if (!t.hasAttribute('data-case-lib-history-page-input')) return;
        handleHistoryDetailPaginationJump(t.value);
      });
    }
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('click', function(e) {
        var target = e && e.target ? e.target : null;
        var btn = target && target.closest ? target.closest('[data-case-lib-drawer-page]') : null;
        if (!btn || !btn.getAttribute) return;
        var scope = btn.getAttribute('data-case-lib-drawer-scope') || '';
        var action = btn.getAttribute('data-case-lib-drawer-page') || '';
        if (!action) return;
        if (scope === 'edit') handleEditDrawerPaginationAction(action);
        else if (scope === 'select') handleSelectDrawerPaginationAction(action);
        else if (scope === 'association-pick-items') handleAssociationPickPaginationAction(action);
        else if (scope === 'import-select') handleImportSelectDrawerPaginationAction(action);
        else if (scope === 'history-query') handleHistoryQueryPaginationAction(action);
        else if (scope === 'missing') handleMissingDrawerPaginationAction(action);
      });
      document.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.hasAttribute) return;
        if (!t.hasAttribute('data-case-lib-drawer-page-input')) return;
        var scope = t.getAttribute('data-case-lib-drawer-scope') || '';
        if (scope === 'edit') handleEditDrawerPaginationJump(t.value);
        else if (scope === 'select') handleSelectDrawerPaginationJump(t.value);
        else if (scope === 'association-pick-items') handleAssociationPickPaginationJump(t.value);
        else if (scope === 'import-select') handleImportSelectDrawerPaginationJump(t.value);
        else if (scope === 'history-query') handleHistoryQueryPaginationJump(t.value);
        else if (scope === 'missing') handleMissingDrawerPaginationJump(t.value);
      });
    }
    [
      dom.historyAppendPill,
      dom.historyAddedPill,
      dom.historyUpdatedPill,
      dom.historyDeletedPill,
      dom.historyImportPill,
      dom.historyReimportPill,
      dom.historyFileDeletedPill,
    ].forEach(function(pill) {
      if (!pill || typeof pill.addEventListener !== 'function') return;
      pill.addEventListener('click', function() {
        var next = pill.getAttribute('data-case-lib-history-filter') || '';
        setCaseLibraryHistoryFilter(next);
      });
    });
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
    if (!hasSelectDrawer && !hasAssociationDrawer && !hasAssociationPickDrawer && !hasAssociationItemDrawer && !hasAssociationDeleteConfirmDrawer && !hasImportSelectDrawer) return false;

    if (hasSelectDrawer) {
      selectDrawerInstance = ensureDrawer('caseLibrarySelectExecDrawer', ['openCaseLibrarySelectExecDrawerBtn'], function() {
        ensureProjectsReady().then(function() {
          resetSelectDrawer();
          return restoreSelectDrawerFromPersistedState();
        });
      });
    }

    if (hasAssociationDrawer) {
      associationDrawerInstance = ensureDrawer('caseLibraryAssociationDrawer', [], null, function() {
        resetAssociationDrawer();
      });
    }

    if (hasAssociationPickDrawer) {
      associationPickDrawerInstance = ensureDrawer('caseLibraryAssociationPickDrawer', [], null, function() {
        resetAssociationPickDrawer();
      });
    }

    if (hasAssociationItemDrawer) {
      associationItemDrawerInstance = ensureDrawer('caseLibraryAssociationItemDrawer', [], null, function() {
        state.associationPickDrawer.loadingItems = false;
        state.associationPickDrawer.processing = false;
        if (dom.associationPickConfirmBtn) dom.associationPickConfirmBtn.disabled = false;
      });
    }

    if (hasAssociationDeleteConfirmDrawer) {
      associationDeleteConfirmDrawerInstance = ensureDrawer('caseLibraryAssociationDeleteConfirmDrawer', [], null, function() {
        state.associationDrawer.pendingAssociationId = null;
        state.associationDrawer.pendingAction = '';
      });
    }

    if (hasImportSelectDrawer) {
      importSelectDrawerInstance = ensureDrawer('caseLibraryImportSelectDrawer', [], function() {
        ensureProjectsReady().then(function() {
          resetImportSelectDrawer();
        });
      }, handleImportSelectDrawerClose);
    }
    if (hasImportDiffDrawer) {
      importDiffDrawerInstance = ensureDrawer(
        'caseLibraryImportDiffDrawer',
        [],
        function() {
          // noop
        },
        function() {
          if (importDiffDrawerOpenTimer) {
            clearTimeout(importDiffDrawerOpenTimer);
            importDiffDrawerOpenTimer = 0;
          }
          var external = state.importDiff && state.importDiff.external ? state.importDiff.external : null;
          if (external && typeof external.resolve === 'function') {
            state.importDiff.external = null;
            try {
              external.resolve({ ok: false, reason: 'closed' });
            } catch (e) {
              // ignore
            }
          }
          state.importDiff.mode = 'import';
          state.importDiff.caseFileId = null;
          state.importDiff.confirming = false;
          if (dom.importDiffOverwriteBtn) dom.importDiffOverwriteBtn.textContent = '确认覆盖导入';
        }
      );
    }

    bindEvents();
    window.app = window.app || {};
    window.app.caseLibraryApi = window.app.caseLibraryApi || {};
    window.app.caseLibraryApi.openSelectExecDrawer = openSelectExecDrawer;
    window.app.caseLibraryApi.requestSelectExecDrawer = markSelectExecDrawerRequest;
	    window.app.caseLibraryApi.openMissingDrawer = openMissingDrawer;
	    window.app.caseLibraryApi.openWriterDrawer = openCaseLibraryWriterStructure;
	    window.app.caseLibraryApi.requestMissingDrawer = markMissingDrawerRequest;
	    window.app.caseLibraryApi.getCurrentEditorCaseSnapshot = getCurrentEditorCaseSnapshot;
	    window.app.caseLibraryApi.getCurrentHistoryDetailSnapshot = getCurrentHistoryDetailSnapshot;
	    if (hasImportSelectDrawer) {
	      window.app.caseLibraryApi.openImportSelectDrawer = openImportSelectDrawer;
	    }
    if (hasImportDiffDrawer) {
      window.app.caseLibraryApi.openImportDiffForExternal = openImportDiffForExternal;
      window.app.caseLibraryApi.openAppendDiffForExternal = openAppendDiffForExternal;
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
	    importDiffDrawerInstance = ensureDrawer(
	      'caseLibraryImportDiffDrawer',
	      [],
	      function() {
	        // noop
	      },
	      function() {
	        if (importDiffDrawerOpenTimer) {
	          clearTimeout(importDiffDrawerOpenTimer);
	          importDiffDrawerOpenTimer = 0;
	        }
	        var external = state.importDiff && state.importDiff.external ? state.importDiff.external : null;
	        if (external && typeof external.resolve === 'function') {
	          state.importDiff.external = null;
	          try {
	            external.resolve({ ok: false, reason: 'closed' });
	          } catch (e) {
	            // ignore
	          }
          }
          state.importDiff.mode = 'import';
          state.importDiff.caseFileId = null;
          state.importDiff.confirming = false;
          if (dom.importDiffOverwriteBtn) dom.importDiffOverwriteBtn.textContent = '确认覆盖导入';
	      }
	    );
	    importInvalidDrawerInstance = ensureDrawer(
	      'caseLibraryImportInvalidDrawer',
	      [],
	      function() {
	        // noop
	      },
	      function() {
	        state.importInvalid.file = null;
	        state.importInvalid.fileName = '';
	        state.importInvalid.cleanName = '';
	        state.importInvalid.source = '';
	        state.importInvalid.projectId = null;
	        state.importInvalid.versionId = null;
	        state.importInvalid.structuralErrors = [];
	        state.importInvalid.items = [];
	        state.importInvalid.invalid = [];
	        state.importInvalid.loading = false;
	        state.importInvalid.locateIndex = -1;
	        syncImportInvalidControls();
	        if (dom.importInvalidStatus) setStatus(dom.importInvalidStatus, '', '');
	        if (dom.importInvalidBody) {
	          dom.importInvalidBody.innerHTML = '<tr><td colspan=\"7\"><p class=\"hint\">暂无数据</p></td></tr>';
	        }
	      }
	    );
    ensureCaseLibraryWriterPublishDrawer();
    editDrawerInstance = ensureDrawer(
      'caseLibraryEditDrawer',
      ['openCaseLibraryEditDrawerBtn'],
      function() {
        markCaseLibraryAiGenNavBadgeRead();
        var prevPersisted = readEditDrawerPersistedState();
        ensureProjectsReady().then(function() {
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
          prepareMissingDrawer();
        });
      }
    );
    missingAddDrawerInstance = ensureDrawer(
      'caseLibraryMissingAddDrawer',
      [],
      function() {
        setStatus(dom.missingAddStatus, '', '');
      },
      function() {
        state.missingAdd.loading = false;
      }
    );
    missingEditDrawerInstance = ensureDrawer(
      'caseLibraryMissingEditDrawer',
      [],
      function() {
        setStatus(dom.missingEditStatus, '', '');
      },
      function() {
        state.missingEdit.loading = false;
        state.missingEdit.moduleId = null;
        state.missingEdit.projectId = null;
        state.missingEdit.name = '';
      }
    );
    missingTypeAddDrawerInstance = ensureDrawer(
      'caseLibraryMissingTypeAddDrawer',
      [],
      function() {
        setStatus(dom.missingTypeAddStatus, '', '');
      },
      function() {
        state.missingTypeAdd.loading = false;
      }
    );
    missingTypeManageDrawerInstance = ensureDrawer(
      'caseLibraryMissingTypeManageDrawer',
      [],
      function() {
        renderMissingTypeManageList();
      },
      function() {
        state.missingTypeManage.loading = false;
      }
    );
    shareDrawerInstance = ensureShareDrawer();
    selectDrawerInstance = ensureDrawer('caseLibrarySelectExecDrawer', ['openCaseLibrarySelectExecDrawerBtn'], function() {
      ensureProjectsReady().then(function() {
        resetSelectDrawer();
        return restoreSelectDrawerFromPersistedState();
      });
    });
    associationDrawerInstance = ensureDrawer('caseLibraryAssociationDrawer', [], null, function() {
      resetAssociationDrawer();
    });
    associationPickDrawerInstance = ensureDrawer('caseLibraryAssociationPickDrawer', [], null, function() {
      resetAssociationPickDrawer();
    });
    associationItemDrawerInstance = ensureDrawer('caseLibraryAssociationItemDrawer', [], null, function() {
      state.associationPickDrawer.loadingItems = false;
      state.associationPickDrawer.processing = false;
      if (dom.associationPickConfirmBtn) dom.associationPickConfirmBtn.disabled = false;
    });
    associationDeleteConfirmDrawerInstance = ensureDrawer('caseLibraryAssociationDeleteConfirmDrawer', [], null, function() {
      state.associationDrawer.pendingAssociationId = null;
      state.associationDrawer.pendingAction = '';
    });
    importSelectDrawerInstance = ensureDrawer('caseLibraryImportSelectDrawer', [], function() {
      ensureProjectsReady().then(function() {
        resetImportSelectDrawer();
      });
    }, handleImportSelectDrawerClose);
    historyDrawerInstance = ensureDrawer('caseLibraryHistoryDrawer', ['openCaseLibraryHistoryDrawerBtn'], function() {
      ensureProjectsReady().then(function() {
        resetHistoryQueryDrawer();
        return restoreHistoryQueryDrawerFromPersistedState();
      });
    });

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
	    window.app.caseLibraryApi.getCurrentEditorCaseSnapshot = getCurrentEditorCaseSnapshot;
	    window.app.caseLibraryApi.getCurrentHistoryDetailSnapshot = getCurrentHistoryDetailSnapshot;
	    window.app.caseLibraryApi.openImportSelectDrawer = openImportSelectDrawer;
	    window.app.caseLibraryApi.openImportDiffForExternal = openImportDiffForExternal;
    window.app.caseLibraryApi.openAppendDiffForExternal = openAppendDiffForExternal;
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
