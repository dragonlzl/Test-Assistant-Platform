(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.aiGenController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var utils = opts.utils && typeof opts.utils === 'object' ? opts.utils : {};
    var apiClient = opts.apiClient || null;
    var aiGenModelOwner = opts.modelOwner;
    var aiGenStoreOwner = opts.storeOwner;
    var aiGenViewOwner = opts.viewOwner;
    var aiGenFileParserOwner = opts.fileParserOwner;
    var aiGenTaskRunnerOwner = opts.taskRunnerOwner;
    if (!aiGenModelOwner || typeof aiGenModelOwner.create !== 'function') {
      throw new Error('case library AI generation model owner is required');
    }
    if (!aiGenStoreOwner || typeof aiGenStoreOwner.create !== 'function') {
      throw new Error('case library AI generation store owner is required');
    }
    if (!aiGenViewOwner || typeof aiGenViewOwner.create !== 'function') {
      throw new Error('case library AI generation view owner is required');
    }
    if (!aiGenFileParserOwner || typeof aiGenFileParserOwner.create !== 'function') {
      throw new Error('case library AI generation file parser owner is required');
    }
    if (!aiGenTaskRunnerOwner || typeof aiGenTaskRunnerOwner.create !== 'function') {
      throw new Error('case library AI generation task runner owner is required');
    }

    var normalizeEditorText = typeof opts.normalizeText === 'function' ? opts.normalizeText : function(value) {
      return value === null || value === undefined ? '' : String(value).trim();
    };
    var normalizePriorityInput = typeof opts.normalizePriority === 'function'
      ? opts.normalizePriority
      : function(value) { return normalizeEditorText(value); };
    var buildCaseItemKey = typeof opts.buildCaseKey === 'function'
      ? opts.buildCaseKey
      : function() { return ''; };
    var hashReminderText = typeof opts.hashText === 'function'
      ? opts.hashText
      : function(value) { return String(value || ''); };
    var getCurrentUserId = typeof opts.getCurrentUserId === 'function'
      ? opts.getCurrentUserId
      : function() { return ''; };
    var getCore = typeof opts.getCore === 'function' ? opts.getCore : function() { return {}; };
    var getGlobalAssignments = typeof opts.getGlobalAssignments === 'function'
      ? opts.getGlobalAssignments
      : function() { return {}; };
    var appendCaseWritingGuidePrompt = typeof opts.appendPrompt === 'function'
      ? opts.appendPrompt
      : function(value) { return value || ''; };
    var getDefaultPrompt = typeof opts.getDefaultPrompt === 'function'
      ? opts.getDefaultPrompt
      : function() { return ''; };
    var getJSZip = typeof opts.getJSZip === 'function'
      ? opts.getJSZip
      : function() { return typeof window !== 'undefined' ? window.JSZip || null : null; };
    var getMindElixirApi = typeof opts.getMindApi === 'function'
      ? opts.getMindApi
      : function() { return null; };
    var showCenterToast = typeof opts.showToast === 'function' ? opts.showToast : function() {};
    var isEditorCardVisible = typeof opts.isEditorVisible === 'function'
      ? opts.isEditorVisible
      : function() { return false; };
    var isEditDrawerOpen = typeof opts.isEditDrawerOpen === 'function'
      ? opts.isEditDrawerOpen
      : function() { return false; };
    var renderEditDrawerList = typeof opts.renderEditDrawerList === 'function'
      ? opts.renderEditDrawerList
      : function() {};
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function'
      ? opts.openConfirmDrawer
      : function() { return Promise.resolve({ ok: false }); };
    var ensureNonEnumerableKey = typeof opts.ensureNonEnumerableKey === 'function'
      ? opts.ensureNonEnumerableKey
      : function(target, key, value) { if (target) target[key] = value; };
    var markCaseLibraryNewAdded = typeof opts.markNewAdded === 'function'
      ? opts.markNewAdded
      : function() {};
    var reorderItemsByExistingModuleAppend = typeof opts.reorderItems === 'function'
      ? opts.reorderItems
      : function(items) { return Array.isArray(items) ? items : []; };
    var renderEditorTable = typeof opts.renderEditor === 'function' ? opts.renderEditor : function() {};
    var captureCaseLibraryAnchorRect = typeof opts.captureAnchorRect === 'function'
      ? opts.captureAnchorRect
      : function() { return null; };
    var startPendingToast = typeof opts.startPendingToast === 'function'
      ? opts.startPendingToast
      : function() {};
  var aiGenModel = aiGenModelOwner.create({
    normalizeText: normalizeEditorText,
    normalizePriority: normalizePriorityInput,
    buildCaseKey: buildCaseItemKey,
    hashText: hashReminderText,
    stripCodeFence: utils && typeof utils.stripCodeFence === 'function' ? utils.stripCodeFence : null,
    extractJsonPayload: utils && typeof utils.extractJsonPayload === 'function' ? utils.extractJsonPayload : null,
  });
  var aiGenStore = aiGenStoreOwner.create({
    state: state,
    getCurrentUserId: getCurrentUserId,
  });
  var aiGenView = aiGenViewOwner.create({
    dom: dom,
    ensureDrawer: opts.ensureDrawer,
    setStatus: opts.setStatus,
    escapeHtml: opts.escapeHtml,
    escapeHtmlPreserve: opts.escapeHtmlPreserve,
    countModuleCases: aiGenModel.countModuleCases,
    countSelectableCases: aiGenModel.countSelectableCases,
    normalizeCount: aiGenModel.normalizeCount,
  });
  var aiGenFileParser = aiGenFileParserOwner.create({
    getJSZip: getJSZip,
  });
  var aiGenTaskRunner = aiGenTaskRunnerOwner.create({
    model: aiGenModel,
    getManager: getCaseLibraryAiGenManager,
    getCore: getCore,
    getPrepApi: getCasePageAiGenPrepApi,
    getAssignments: getGlobalAssignments,
    appendPrompt: appendCaseWritingGuidePrompt,
    getDefaultPrompt: getDefaultPrompt,
    resolveCoverageThreshold: resolveCaseLibraryGenCoverageThreshold,
  });

  function ensureCaseLibraryAiGenState() {
    return aiGenModel.ensureState(state);
  }

  function resolveCaseLibraryAiGenGenerationMode(prepContext) {
    return aiGenModel.resolveGenerationMode(prepContext);
  }

  function resetCaseLibraryAiGenAppendRecord(fileId, token) {
    return aiGenStore.resetAppendRecord(fileId, token);
  }

  function clearCaseLibraryAiGenAppendRecord(fileId) {
    aiGenStore.clearAppendRecord(fileId);
  }

  function getCaseLibraryAiGenAppendMap(fileId, token) {
    return aiGenStore.getAppendMap(fileId, token);
  }

  function markCaseLibraryAiGenAppendKeys(fileId, token, keys) {
    aiGenStore.markAppendKeys(fileId, token, keys);
  }

  function getCaseLibraryAiGenBadgeRecord(fileId, create) {
    return aiGenStore.getBadgeRecord(fileId, create);
  }

  function getCaseLibraryAiGenBadgeRecordWithFallback(fileId, create) {
    return aiGenStore.getBadgeRecordWithFallback(fileId, create);
  }

  function updateCaseLibraryAiGenBadgeRecord(fileId, updates) {
    return aiGenStore.updateBadgeRecord(fileId, updates);
  }

  function clearCaseLibraryAiGenBadgeRecordForFile(fileId) {
    aiGenStore.clearBadgeRecord(fileId);
  }

  function syncCaseLibraryAiGenBadgeForFile(fileId) {
    var ai = ensureCaseLibraryAiGenState();
    if (!fileId) return;
    var record = getCaseLibraryAiGenBadgeRecordWithFallback(fileId, false);
    if (!record) return;
    if (record.ai_read_token) ai.readResultToken = record.ai_read_token;
    if (!ai.resultToken && record.result_token) ai.resultToken = record.result_token;
    ai.hasUnreadResult = Boolean(ai.resultToken && ai.readResultToken !== ai.resultToken);
  }

  function syncCaseLibraryAiGenNavBadge() {
    aiGenView.syncNavBadge(aiGenStore.hasNavBadge());
  }

  function markCaseLibraryAiGenNavBadgeRead() {
    aiGenStore.markNavBadgesRead();
    syncCaseLibraryAiGenNavBadge();
  }

  function markCaseLibraryAiGenEditBadgeRead(fileId) {
    aiGenStore.markEditBadgeRead(fileId);
  }

  function shouldShowCaseLibraryAiGenEditBadge(fileId) {
    return aiGenStore.shouldShowEditBadge(fileId);
  }
  function getCaseLibraryAiGenManager() {
    return window.app && window.app.caseLibraryAiGen ? window.app.caseLibraryAiGen : null;
  }

  function getCasePageAiGenPrepApi() {
    if (window.app && window.app.casePageAiGenPrepApi && typeof window.app.casePageAiGenPrepApi.open === 'function') {
      return window.app.casePageAiGenPrepApi;
    }
    if (window.app && window.app.casePageAiGenPrep && typeof window.app.casePageAiGenPrep.init === 'function') {
      var coreApi = getCore();
      var globalState = window.app && window.app.state ? window.app.state : {};
      var prepApi = window.app.casePageAiGenPrep.init({
        state: globalState,
        config: window.app && window.app.config ? window.app.config : {},
        core: coreApi,
        utils: utils,
        apiClient: apiClient,
        callModelWithConfig: coreApi && typeof coreApi.callModelWithConfig === 'function' ? coreApi.callModelWithConfig : null,
        xmindKnowledgeBaseApi: window.app && window.app.xmindKnowledgeBaseApi ? window.app.xmindKnowledgeBaseApi : null,
      });
      window.app.casePageAiGenPrepApi = prepApi;
      return prepApi;
    }
    return null;
  }

  function resolveCaseLibraryGenCoverageThreshold() {
    var globalState = window.app && window.app.state ? window.app.state : {};
    var settings = globalState && globalState.settings && typeof globalState.settings === 'object'
      ? globalState.settings
      : {};
    return aiGenModel.resolveCoverageThreshold(settings.caseLibraryGenCoverageThreshold);
  }

  function applyCaseLibraryAiGenAppendMap(modules, appendedMap) {
    return aiGenModel.applyAppendMap(modules, appendedMap);
  }

  function applyCaseLibraryAiGenResultStats(ai, parsed) {
    var stats = aiGenModel.buildResultStats(parsed);
    ai.resultGeneratedCount = stats.generatedCount;
    ai.resultDedupeCount = stats.dedupeCount;
  }

  function formatCaseLibraryAiGenCompleteStatus(ai) {
    return aiGenModel.formatCompleteStatus(ai);
  }

  function renderCaseLibraryAiGenResult() {
    var ai = ensureCaseLibraryAiGenState();
    var selection = ai.selection instanceof Set ? ai.selection : new Set();
    (Array.isArray(ai.modules) ? ai.modules : []).forEach(function(moduleEntry) {
      (moduleEntry && Array.isArray(moduleEntry.cases) ? moduleEntry.cases : []).forEach(function(item) {
        if (item && item.__aiAppended === true && selection.has(item.__aiKey)) {
          selection.delete(item.__aiKey);
        }
      });
    });
    ai.selection = selection;
    aiGenView.renderResult(ai);
  }

  function syncCaseLibraryAiGenSelectionHint(totalCount) {
    aiGenView.syncSelection(ensureCaseLibraryAiGenState(), totalCount);
  }

  function syncCaseLibraryAiGenRunBtn() {
    var ai = ensureCaseLibraryAiGenState();
    var requirementText = aiGenView.getRequirementText(ai.requirementText);
    var hasRequirement = Boolean(normalizeEditorText(requirementText || ''));
    var reason = resolveCaseLibraryAiGenDisabledReason();
    aiGenView.syncRunButton({
      loading: ai.loading === true,
      hasRequirement: hasRequirement,
      disabledReason: reason,
    });
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
    if (isEditDrawerOpen()) {
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

  function syncCaseLibraryAiGenButton() {
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
    var canOpen = Boolean(state.editor && state.editor.caseFile && Array.isArray(state.editor.items) && state.editor.items.length);
    var mindApi = getMindElixirApi();
    var hasMindApi = Boolean(mindApi && typeof mindApi.buildMindDataFromCases === 'function');
    aiGenView.syncFeatureButton({
      loading: loading,
      disabledReason: reason,
      showBadge: ai.hasUnreadResult === true,
      canOpenXmind: canOpen && hasMindApi,
    });
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
    ai.generationMode = '';
    ai.resultGeneratedCount = 0;
    ai.resultDedupeCount = 0;
    if (!keepRequirement) {
      ai.requirementText = '';
      ai.requirementFileName = '';
    }
    if (!keepRequirement) {
      aiGenView.setRequirementText('');
      aiGenView.setRequirementFileName('');
      aiGenView.setImportStatus('', '');
    }
    aiGenView.setGenerationStatus('', '');
    renderCaseLibraryAiGenResult();
    syncCaseLibraryAiGenRunBtn();
    syncCaseLibraryAiGenButton();
  }

  function discardCaseLibraryAiGenResult(options) {
    options = options || {};
    var ai = ensureCaseLibraryAiGenState();
    var fileId = ai.caseFileId || (state.editor && state.editor.caseFile ? state.editor.caseFile.id : null);
    var task = getCurrentCaseLibraryAiGenTask();
    var manager = getCaseLibraryAiGenManager();
    if (task && task.id) aiGenTaskRunner.clear(task.id);
    if (manager && typeof manager.clearTask === 'function') manager.clearTask('case-library');
    clearCaseLibraryAiGenBadgeRecordForFile(fileId);
    clearCaseLibraryAiGenAppendRecord(fileId);
    resetCaseLibraryAiGenState({ keepRequirement: options.keepRequirement === true });
    ai.caseFileId = fileId;
    ai.hasUnreadResult = false;
    syncCaseLibraryAiGenButton();
    syncCaseLibraryAiGenRunBtn();
    syncCaseLibraryAiGenNavBadge();
    if (isEditDrawerOpen()) {
      renderEditDrawerList();
    }
    if (options.silent !== true) {
      aiGenView.setGenerationStatus('已清空本次 AI 生成结果', 'ok');
      showCenterToast('已清空本次 AI 生成结果，可重新发起生成。', 'ok', 3000);
      closeCaseLibraryAiGenDrawer();
    }
  }

  function finishCaseLibraryAiGenParsedResult(ai, parsed, task, resultToken) {
    if (parsed && parsed.error) {
      ai.error = parsed.error;
      aiGenView.setGenerationStatus('生成失败：' + parsed.error, 'err');
      ai.modules = [];
      ai.selection = new Set();
      ai.resultGeneratedCount = 0;
      ai.resultDedupeCount = 0;
    } else {
      ai.modules = parsed && Array.isArray(parsed.modules) ? parsed.modules : [];
      ai.selection = new Set();
      applyCaseLibraryAiGenResultStats(ai, parsed);
      aiGenView.setGenerationStatus(formatCaseLibraryAiGenCompleteStatus(ai), 'ok');
      if (resultToken) {
        applyCaseLibraryAiGenAppendMap(ai.modules, getCaseLibraryAiGenAppendMap(task.caseFileId, resultToken));
      }
      markCaseLibraryAiGenResultReady(resolveCaseLibraryAiGenResultToken(task), task.caseFileId);
    }
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
    ai.generationMode = resolveCaseLibraryAiGenGenerationMode(task.prepContext);
    if (!ai.generationMode && task.xmindPipeline && task.xmindPipeline.enabled === true) {
      ai.generationMode = 'enhanced';
    }
    if (task.requirementText && (!ai.requirementText || ai.taskSignature === signature)) {
      ai.requirementText = String(task.requirementText || '');
      aiGenView.setRequirementText(ai.requirementText);
    }
    if (task.requirementFileName && (!ai.requirementFileName || ai.taskSignature === signature)) {
      ai.requirementFileName = String(task.requirementFileName || '');
      aiGenView.setRequirementFileName(ai.requirementFileName);
    }
    if (ai.loading) {
      aiGenView.setGenerationStatus('正在生成用例...', '');
      ai.modules = [];
      ai.selection = new Set();
      renderCaseLibraryAiGenResult();
      syncCaseLibraryAiGenRunBtn();
      syncCaseLibraryAiGenButton();
      return true;
    }
    if (ai.generated && task.resultRaw) {
      var resultToken = resolveCaseLibraryAiGenResultToken(task);
      if (resultToken) resetCaseLibraryAiGenAppendRecord(task.caseFileId, resultToken);
      var resolution = aiGenTaskRunner.resolveManagedResult(task, {
        sourceCases: state.editor.items || [],
      });
      if (resolution && resolution.kind === 'ready') {
        finishCaseLibraryAiGenParsedResult(ai, resolution.parsed, task, resultToken);
        return true;
      }
      if (resolution && resolution.kind === 'pending') {
        if (resolution.started === true) {
          if (resolution.semanticDedupe === true) {
            aiGenView.setGenerationStatus('正在进行 AI 语义去重...', '');
          }
          resolution.promise.then(function(parsed) {
            var currentTask = getCurrentCaseLibraryAiGenTask();
            if (!currentTask || currentTask.id !== task.id) return;
            finishCaseLibraryAiGenParsedResult(ai, parsed, task, resultToken);
          });
        }
        return true;
      }
      return true;
    }
    if (ai.error) {
      aiGenView.setGenerationStatus(ai.error, 'err');
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
    var mindApi = getMindElixirApi();
    var hasMindApi = Boolean(mindApi && typeof mindApi.buildMindDataFromCases === 'function');
    aiGenView.setXmindAvailable(Boolean(Array.isArray(state.editor.items) && state.editor.items.length && hasMindApi));
  }

  function getCurrentCaseLibraryAiGenTask() {
    var manager = getCaseLibraryAiGenManager();
    if (!manager || typeof manager.getTask !== 'function') return null;
    var task = manager.getTask('case-library');
    if (!task || task.scene !== 'case-library') return null;
    var currentFileId = state.editor && state.editor.caseFile ? String(state.editor.caseFile.id || '') : '';
    var taskFileId = task.caseFileId ? String(task.caseFileId || '') : '';
    if (!currentFileId || !taskFileId || currentFileId !== taskFileId) return null;
    return task;
  }

  function shouldOpenCaseLibraryAiGenDrawerDirect() {
    var ai = ensureCaseLibraryAiGenState();
    if (ai.loading === true) return true;
    var task = getCurrentCaseLibraryAiGenTask();
    if (task) {
      var status = String(task.status || '');
      if (status === 'running' || status === 'done' || status === 'error') return true;
    }
    if (ai.generated === true) {
      if (Array.isArray(ai.modules) && ai.modules.length) return true;
      if (ai.error) return true;
      if (ai.resultToken || ai.taskSignature) return true;
    }
    return false;
  }

  function handleCaseLibraryAiGenDrawerOpen() {
    syncCaseLibraryAiGenTaskState();
    renderCaseLibraryAiGenResult();
    syncCaseLibraryAiGenRunBtn();
    clearCaseLibraryAiGenResultBadge();
  }

  function openCaseLibraryAiGenDrawer() {
    aiGenView.openDrawer(handleCaseLibraryAiGenDrawerOpen);
  }

  function closeCaseLibraryAiGenDrawer() {
    aiGenView.closeDrawer(handleCaseLibraryAiGenDrawerOpen);
  }

  function openCaseLibraryAiGenPrepAndRun(options) {
    options = options || {};
    var reason = resolveCaseLibraryAiGenDisabledReason();
    if (reason === 'no-case') {
      showCenterToast('请先选择查看&编辑用例。', 'warn', 3000);
      return;
    }
    if (options.forcePrep !== true) {
      syncCaseLibraryAiGenTaskState();
      if (shouldOpenCaseLibraryAiGenDrawerDirect()) {
        openCaseLibraryAiGenDrawer();
        return;
      }
    }
    if (reason === 'no-model') {
      showCenterToast('请到AI功能-功能指派 页面下，配置该功能模型。', 'warn', 5000);
      return;
    }
    var prepApi = getCasePageAiGenPrepApi();
    if (!prepApi || typeof prepApi.open !== 'function') {
      showCenterToast('生成准备模块不可用，请刷新页面后重试。', 'err', 5000);
      return;
    }
    var coreApi = getCore();
    var model = null;
    try {
      model = coreApi && typeof coreApi.getAssignedModel === 'function'
        ? coreApi.getAssignedModel('caselibrarygen')
        : null;
    } catch (err) {
      model = null;
    }
    if (!model) {
      showCenterToast('请到AI功能-功能指派 页面下，配置该功能模型。', 'warn', 5000);
      return;
    }
    if (!state.editor || !state.editor.caseFile) {
      showCenterToast('请先选择查看&编辑用例。', 'warn', 3000);
      return;
    }
    if (options.closeDrawerBeforePrep === true) {
      closeCaseLibraryAiGenDrawer();
    }
    if (options.discardExisting === true) {
      discardCaseLibraryAiGenResult({ keepRequirement: true, silent: true });
    }
    var ai = ensureCaseLibraryAiGenState();
    var currentRequirement = aiGenView.getRequirementText(ai.requirementText);
    var assignments = getGlobalAssignments();
    var reasoning = assignments && assignments.caseLibraryGenReasoning
      ? assignments.caseLibraryGenReasoning
      : '';
    var temperature = assignments && assignments.caseLibraryGenTemperature !== undefined
      ? assignments.caseLibraryGenTemperature
      : 0.2;
    clearCaseLibraryAiGenResultBadge();
    syncCaseLibraryAiGenContext();
    prepApi.open({
      scene: 'case-library',
      caseFileId: state.editor.caseFile.id || '',
      displayName: state.editor.caseFile.file_name_clean || state.editor.caseFile.name || '当前用例文件',
      projectId: state.editor.caseFile.project_id || '',
      versionId: state.editor.caseFile.version_id || '',
      cases: state.editor.items || [],
      requirementText: currentRequirement || ai.requirementText || '',
      requirementSupplement: '',
      model: model,
      reasoning: reasoning,
      temperature: temperature,
    }).then(function(result) {
      if (!result || result.ok !== true || !result.value) return;
      openCaseLibraryAiGenDrawer();
      runCaseLibraryAiGen(result.value);
      clearCaseLibraryAiGenResultBadge();
    }).catch(function(err) {
      showCenterToast('打开生成准备失败：' + (err && err.message ? err.message : '未知错误'), 'err', 5000);
    });
  }

  function handleCaseLibraryAiGenRegenerate() {
    openConfirmDrawer({
      title: '确认重新生成',
      message: '重新生成会丢弃当前这批 AI 生成结果，且无法恢复。确认继续吗？',
      hint: '原有用例和已经追加保存的用例不会被删除。',
      hintType: 'warn',
      confirmText: '确认重新生成',
      cancelText: '取消',
      danger: true,
      previousDrawer: aiGenView.getDrawerReference(),
    }).then(function(res) {
      if (!res || res.ok !== true) return;
      openCaseLibraryAiGenPrepAndRun({ forcePrep: true, discardExisting: true, closeDrawerBeforePrep: true });
    });
  }

  function hasNativeLabelTrigger(zone, input) {
    return aiGenView.hasNativeLabelTrigger(zone, input);
  }

  function handleCaseLibraryAiGenFile(file) {
    if (!file || !aiGenView.hasRequirementInput()) return;
    var ai = ensureCaseLibraryAiGenState();
    var name = file.name || '';
    aiGenView.setRequirementFileName(name);
    ai.requirementFileName = name || '';
    aiGenView.setImportStatus('正在读取文件...', '');
    aiGenFileParser.read(file)
      .then(function(text) {
        var content = String(text || '');
        ai.requirementText = content;
        aiGenView.setRequirementText(content);
        aiGenView.setImportStatus('文件读取完成', 'ok');
      })
      .catch(function(err) {
        aiGenView.setImportStatus('读取失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      })
      .finally(function() {
        syncCaseLibraryAiGenRunBtn();
      });
  }

  function clearCaseLibraryAiGenRequirement() {
    var ai = ensureCaseLibraryAiGenState();
    ai.requirementText = '';
    ai.requirementFileName = '';
    aiGenView.setRequirementText('');
    aiGenView.setRequirementFileName('');
    aiGenView.setImportStatus('', '');
    syncCaseLibraryAiGenRunBtn();
  }

  function runCaseLibraryAiGen(prepContext) {
    var ai = ensureCaseLibraryAiGenState();
    if (ai.loading) return;
    var currentFileId = state.editor && state.editor.caseFile ? state.editor.caseFile.id : null;
    var conflict = aiGenTaskRunner.getRunningConflict(currentFileId);
    if (conflict && conflict.type === 'other-file') {
      showCenterToast(
        conflict.fileName
          ? ('用例「' + conflict.fileName + '」正在生成，请等待完成后再生成。')
          : '已有用例正在生成，请等待完成后再生成。',
        'warn',
        4000
      );
      return;
    }
    if (conflict && conflict.type === 'same-file') {
      syncCaseLibraryAiGenTaskState();
      showCenterToast('当前用例正在生成，请稍候。', 'warn', 3000);
      return;
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
    var requirementText = prepContext && prepContext.requirementText !== undefined
      ? prepContext.requirementText
      : aiGenView.getRequirementText(ai.requirementText);
    requirementText = normalizeEditorText(requirementText || '');
    if (!requirementText) {
      aiGenView.setGenerationStatus('请先填写需求内容', 'warn');
      return;
    }
    ai.requirementText = requirementText;
    if (prepContext && prepContext.requirementFileName !== undefined) {
      ai.requirementFileName = String(prepContext.requirementFileName || '');
    }
    aiGenView.setRequirementText(requirementText);
    aiGenView.setRequirementFileName(ai.requirementFileName);
    var prepared;
    try {
      prepared = aiGenTaskRunner.prepare({
        caseFile: state.editor.caseFile,
        items: state.editor.items || [],
        requirementText: requirementText,
        requirementFileName: ai.requirementFileName || '',
        prepContext: prepContext || null,
      });
    } catch (err) {
      if (err && err.code === 'no-model') {
        showCenterToast('请到AI功能-功能指派 页面下，配置该功能模型。', 'warn', 5000);
      } else if (err && err.code === 'no-case') {
        showCenterToast('请先选择查看&编辑用例。', 'warn', 3000);
      } else {
        aiGenView.setGenerationStatus(err && err.message ? err.message : '模型客户端不可用，请刷新页面后重试', 'err');
      }
      return;
    }
    ai.runToken = prepared.runToken;
    ai.loading = true;
    ai.generated = false;
    ai.error = '';
    ai.modules = [];
    ai.selection = new Set();
    ai.taskSignature = prepared.signature;
    ai.caseFileId = state.editor.caseFile ? state.editor.caseFile.id : null;
    ai.generationMode = prepared.generationMode;
    ai.resultGeneratedCount = 0;
    ai.resultDedupeCount = 0;
    aiGenView.setGenerationStatus('正在生成用例...', '');
    renderCaseLibraryAiGenResult();
    syncCaseLibraryAiGenRunBtn();
    syncCaseLibraryAiGenButton();

    var execution = aiGenTaskRunner.start(prepared, {
      getSourceCases: function() { return state.editor.items || []; },
      onDedupeStart: function() {
        aiGenView.setGenerationStatus('正在进行 AI 语义去重...', '');
      },
    });
    if (execution.mode === 'managed') {
      applyCaseLibraryAiGenTaskState(execution.task);
      return;
    }

    var genOk = false;
    var resultToken = execution.resultToken || ai.runToken;
    execution.promise
      .then(function(parsed) {
        if (resultToken) resetCaseLibraryAiGenAppendRecord(ai.caseFileId, resultToken);
        if (parsed && parsed.error) {
          ai.error = parsed.error;
          aiGenView.setGenerationStatus('生成失败：' + parsed.error, 'err');
          ai.modules = [];
          ai.resultGeneratedCount = 0;
          ai.resultDedupeCount = 0;
        } else {
          ai.modules = parsed && Array.isArray(parsed.modules) ? parsed.modules : [];
          applyCaseLibraryAiGenResultStats(ai, parsed);
          if (resultToken) {
            applyCaseLibraryAiGenAppendMap(ai.modules, getCaseLibraryAiGenAppendMap(ai.caseFileId, resultToken));
          }
          aiGenView.setGenerationStatus(formatCaseLibraryAiGenCompleteStatus(ai), 'ok');
          genOk = true;
        }
      })
      .catch(function(err) {
        ai.error = err && err.message ? err.message : '生成失败';
        aiGenView.setGenerationStatus('生成失败：' + ai.error, 'err');
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
    ai.selection = aiGenModel.buildSelection(ai.modules);
    renderCaseLibraryAiGenResult();
    syncCaseLibraryAiGenSelectionHint(ai.selection.size);
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
      aiGenView.setEditStatus('请先选择用例', 'warn');
      return;
    }
    if (ed.pendingOp) {
      aiGenView.setEditStatus('当前有待确认的增删操作，请先撤回或等待入库', 'warn');
      return;
    }
    var selection = ai.selection instanceof Set ? ai.selection : new Set();
    if (!selection.size) return;
    var selectedCases = aiGenModel.collectSelectedCases(ai.modules, selection);
    if (!selectedCases.length) return;
    openConfirmDrawer({
      title: '确认追加用例',
      message: '确定追加已勾选的 ' + selectedCases.length + ' 条用例吗？',
      confirmText: '确认追加',
      cancelText: '取消',
      previousDrawer: aiGenView.getDrawerReference(),
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
      if (appendToken) {
        updateCaseLibraryAiGenBadgeRecord(fileId, { ai_read_token: appendToken });
        ai.readResultToken = appendToken;
        ai.resultToken = appendToken;
        ai.hasUnreadResult = false;
      }
      ed.items = reorderItemsByExistingModuleAppend(ed.items);
      ed.selection = new Set();
      ed.remarkOpen = new Set();
      ed.pendingOp = { type: 'insert_batch', itemKeys: keys, startIndex: ed.items.length - keys.length };
      ai.selection = new Set();
      renderEditorTable();
      renderCaseLibraryAiGenResult();
      syncCaseLibraryAiGenSelectionHint(0);
      syncCaseLibraryAiGenButton();
      syncCaseLibraryAiGenNavBadge();
      var anchorRect = captureCaseLibraryAnchorRect(anchorEl);
      startPendingToast('已追加用例 ' + keys.length + ' 条，超时将自动入库', { anchorRect: anchorRect });
      showCenterToast('追加 ' + keys.length + '条 用例成功！', 'ok', 3000);
    });
  }


    function setRequirementText(value) {
      var ai = ensureCaseLibraryAiGenState();
      ai.requirementText = value === null || value === undefined ? '' : String(value);
      syncCaseLibraryAiGenRunBtn();
    }

    function setSelection(key, checked) {
      if (!key) return;
      var ai = ensureCaseLibraryAiGenState();
      if (checked) ai.selection.add(key);
      else ai.selection.delete(key);
      renderCaseLibraryAiGenResult();
      syncCaseLibraryAiGenSelectionHint();
    }

    return {
      getState: ensureCaseLibraryAiGenState,
      applyTaskState: applyCaseLibraryAiGenTaskState,
      syncContext: syncCaseLibraryAiGenContext,
      syncTaskState: syncCaseLibraryAiGenTaskState,
      syncButton: syncCaseLibraryAiGenButton,
      syncRunButton: syncCaseLibraryAiGenRunBtn,
      syncNavBadge: syncCaseLibraryAiGenNavBadge,
      markNavBadgeRead: markCaseLibraryAiGenNavBadgeRead,
      markEditBadgeRead: markCaseLibraryAiGenEditBadgeRead,
      shouldShowEditBadge: shouldShowCaseLibraryAiGenEditBadge,
      openPrepAndRun: openCaseLibraryAiGenPrepAndRun,
      handleFile: handleCaseLibraryAiGenFile,
      clearRequirement: clearCaseLibraryAiGenRequirement,
      run: runCaseLibraryAiGen,
      selectAll: selectAllCaseLibraryAiGenCases,
      clearSelection: clearCaseLibraryAiGenSelection,
      discardResult: discardCaseLibraryAiGenResult,
      regenerate: handleCaseLibraryAiGenRegenerate,
      appendSelection: appendCaseLibraryAiGenSelection,
      hasNativeLabelTrigger: hasNativeLabelTrigger,
      setRequirementText: setRequirementText,
      setSelection: setSelection,
    };
  }

  return { create: create };
});
