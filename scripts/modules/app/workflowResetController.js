(function(factory) {
  var defaultRoot = typeof window !== 'undefined' ? window : null;
  var cloneJson = typeof module !== 'undefined' && module.exports
    ? require('../../core/jsonCloneCore.js').cloneJson
    : defaultRoot.app.jsonCloneCore.cloneJson;
  var api = factory(defaultRoot, cloneJson);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.workflowResetController = api;
  }
})(function(defaultRoot, cloneJson) {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var window = opts.root || defaultRoot || { app: {} };
    var document = opts.document || window.document || { getElementById: function() { return null; } };
    var state = opts.state || {};
    var dom = opts.dom || {};
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var autoWorkflowManager = opts.autoWorkflowManager || null;
    var syncAutoWorkflowTaskState = typeof opts.syncAutoWorkflowTaskState === 'function'
      ? opts.syncAutoWorkflowTaskState : function() {};
    var abortAllModelRequests = typeof opts.abortAllModelRequests === 'function'
      ? opts.abortAllModelRequests : function() {};
    var renderImportedCaseList = typeof opts.renderImportedCaseList === 'function' ? opts.renderImportedCaseList : function() {};
    var resetImportedCaseView = typeof opts.resetImportedCaseView === 'function' ? opts.resetImportedCaseView : function() {};
    var syncCaseTextWithImports = typeof opts.syncCaseTextWithImports === 'function' ? opts.syncCaseTextWithImports : function() {};
    var renderCaseGeneration = typeof opts.renderCaseGeneration === 'function' ? opts.renderCaseGeneration : function() {};
    var renderCaseGenProgressBoard = typeof opts.renderCaseGenProgressBoard === 'function' ? opts.renderCaseGenProgressBoard : function() {};
    var renderCleanView = typeof opts.renderCleanView === 'function' ? opts.renderCleanView : function() {};
    var renderCleanRawView = typeof opts.renderCleanRawView === 'function' ? opts.renderCleanRawView : function() {};
    var syncReviewViewFromResult = typeof opts.syncReviewViewFromResult === 'function' ? opts.syncReviewViewFromResult : function() {};
    var syncSplitView = typeof opts.syncSplitView === 'function' ? opts.syncSplitView : function() {};
    var updateMissingView = typeof opts.updateMissingView === 'function' ? opts.updateMissingView : function() {};
    var syncAutoCompareStatus = typeof opts.syncAutoCompareStatus === 'function' ? opts.syncAutoCompareStatus : function() {};
    var updateAutoClarifyVisibility = typeof opts.updateAutoClarifyVisibility === 'function' ? opts.updateAutoClarifyVisibility : function() {};
    var updateAutoMissingCard = typeof opts.updateAutoMissingCard === 'function' ? opts.updateAutoMissingCard : function() {};
    var renderAutoRawInfo = typeof opts.renderAutoRawInfo === 'function' ? opts.renderAutoRawInfo : function() {};
    var setCaseViewHint = typeof opts.setCaseViewHint === 'function' ? opts.setCaseViewHint : function() {};
    var triggerUpdateFlowStatus = typeof opts.triggerUpdateFlowStatus === 'function' ? opts.triggerUpdateFlowStatus : function() {};
    var requestPersistWorkflowStateNow = typeof opts.requestPersistWorkflowStateNow === 'function'
      ? opts.requestPersistWorkflowStateNow : function() {};

    function createEmptyRequirementMediaState() {
      return {
        docxImages: [],
        pastedImages: [],
        lastDocxImageCount: 0,
        updatedAt: Date.now(),
      };
    }
    
    function createEmptyLegacyCaseGenState() {
      return {
        requirementLabel: '',
        requirementLabelSource: '',
        lastRawImportName: '',
        rawText: '',
        caseText: '',
        importedCases: [],
        requirementMedia: createEmptyRequirementMediaState(),
        modules: [],
        source: '',
        results: {},
        selections: {},
        suggestions: {},
        moduleStatus: {},
        progress: {},
        timing: {},
        progressNotice: {},
        running: [],
      };
    }
    
    function hasLegacyCaseGenData() {
      var legacy = state.caseGenLegacy && typeof state.caseGenLegacy === 'object'
        ? state.caseGenLegacy
        : null;
      if (!legacy) return false;
      if (Array.isArray(legacy.modules) && legacy.modules.length > 0) return true;
      if (legacy.results && typeof legacy.results === 'object') {
        var hasResults = Object.keys(legacy.results).some(function(key) {
          var val = legacy.results[key];
          return Boolean(String(val || '').trim() && !/^\[\s*\]$/.test(String(val || '').trim()));
        });
        if (hasResults) return true;
      }
      if (legacy.suggestions && typeof legacy.suggestions === 'object') {
        var hasSuggestions = Object.keys(legacy.suggestions).some(function(key) {
          return Boolean(String(legacy.suggestions[key] || '').trim());
        });
        if (hasSuggestions) return true;
      }
      return false;
    }
    
    function hasXmindWorkspaceData() {
      var host = state.xmindCaseGen && typeof state.xmindCaseGen === 'object'
        ? state.xmindCaseGen
        : null;
      if (!host) return false;
      if (Array.isArray(host.workspaceOrder) && host.workspaceOrder.length > 0) return true;
      if (host.workspaces && typeof host.workspaces === 'object' && Object.keys(host.workspaces).length > 0) return true;
      if (host.activeWorkspaceId && String(host.activeWorkspaceId || '').trim()) return true;
      return false;
    }
    
    function shouldPreserveXmindSharedCaseStateOnWorkflowReset() {
      if (!hasXmindWorkspaceData()) return false;
      var settings = state.caseGenSettings && typeof state.caseGenSettings === 'object'
        ? state.caseGenSettings
        : {};
      var activeTab = settings.activeTab === 'modules' ? 'xmind-modules' : String(settings.activeTab || '');
      var xmindApi = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      var drawerOpen = Boolean(xmindApi && typeof xmindApi.isOpen === 'function' && xmindApi.isOpen());
      return drawerOpen || activeTab === 'xmind-modules';
    }
    
    function cloneCaseSelectionStateForReset(source) {
      var map = source && typeof source === 'object' ? source : {};
      var next = {};
      Object.keys(map).forEach(function(key) {
        var value = map[key];
        if (value instanceof Set) {
          next[key] = Array.from(value);
          return;
        }
        if (Array.isArray(value)) {
          next[key] = value.slice();
          return;
        }
        next[key] = cloneJson(value, []);
      });
      return next;
    }
    
    function restoreCaseSelectionStateAfterReset(source) {
      var map = source && typeof source === 'object' ? source : {};
      var next = {};
      Object.keys(map).forEach(function(key) {
        var value = map[key];
        next[key] = new Set(Array.isArray(value) ? value : []);
      });
      return next;
    }
    
    function captureXmindSharedCaseStateForWorkflowReset() {
      if (!shouldPreserveXmindSharedCaseStateOnWorkflowReset()) return null;
      return {
        caseGenModules: cloneJson(state.caseGenModules, []),
        caseGenSource: String(state.caseGenSource || ''),
        caseGenResults: cloneJson(state.caseGenResults, {}),
        caseSelections: cloneCaseSelectionStateForReset(state.caseSelections),
        caseGenSuggestions: cloneJson(state.caseGenSuggestions, {}),
        caseGenModuleStatus: cloneJson(state.caseGenModuleStatus, {}),
        caseGenProgress: cloneJson(state.caseGenProgress, {}),
        caseGenTiming: cloneJson(state.caseGenTiming, {}),
        caseGenProgressNotice: cloneJson(state.caseGenProgressNotice, {}),
        caseGenRunning: state.caseGenRunning instanceof Set ? Array.from(state.caseGenRunning) : [],
      };
    }
    
    function restoreXmindSharedCaseStateAfterWorkflowReset(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') return;
      state.caseGenModules = cloneJson(snapshot.caseGenModules, []);
      state.caseGenSource = String(snapshot.caseGenSource || '');
      state.caseGenResults = cloneJson(snapshot.caseGenResults, {});
      state.caseSelections = restoreCaseSelectionStateAfterReset(snapshot.caseSelections);
      state.caseGenSuggestions = cloneJson(snapshot.caseGenSuggestions, {});
      state.caseGenModuleStatus = cloneJson(snapshot.caseGenModuleStatus, {});
      state.caseGenProgress = cloneJson(snapshot.caseGenProgress, {});
      state.caseGenTiming = cloneJson(snapshot.caseGenTiming, {});
      state.caseGenProgressNotice = cloneJson(snapshot.caseGenProgressNotice, {});
      state.caseGenRunning = new Set(Array.isArray(snapshot.caseGenRunning) ? snapshot.caseGenRunning : []);
    }
    
    function hasWorkflowData() {
      var rawTextVal = dom.rawText && dom.rawText.value ? dom.rawText.value.trim() : '';
      var reviewTextVal = dom.reviewResultEl && dom.reviewResultEl.value ? dom.reviewResultEl.value.trim() : '';
      var cleanedTextVal = dom.cleanedTextEl && dom.cleanedTextEl.value ? dom.cleanedTextEl.value.trim() : '';
      var compareTextVal = dom.compareResultEl && dom.compareResultEl.value ? dom.compareResultEl.value.trim() : '';
      var splitTextVal = dom.splitResultEl && dom.splitResultEl.value ? dom.splitResultEl.value.trim() : '';
      var casesCompareVal = dom.casesCompareResultEl && dom.casesCompareResultEl.value ? dom.casesCompareResultEl.value.trim() : '';
      var caseTextVal = dom.caseTextEl && dom.caseTextEl.value ? dom.caseTextEl.value.trim() : '';
      var hasImported = Array.isArray(state.importedCases) && state.importedCases.length > 0;
      var hasAutoClarify = Boolean(state.autoRequireClarifications);
      var hasLegacyCaseGen = hasLegacyCaseGenData();
      var hasClarify = state.reviewClarifications && state.reviewClarifications.size > 0;
      var hasAutoSuggestion = state.autoCompareSuggestion && state.autoCompareSuggestion.trim();
      var hasLabel = false;
      if (state.requirementLabel && state.requirementLabel.trim()) {
        var labelText = state.requirementLabel.trim();
        var labelSource = state.requirementLabelSource ? String(state.requirementLabelSource).trim() : '';
        if (labelSource && labelSource !== 'default') {
          hasLabel = true;
        } else if (labelText !== '当前需求') {
          hasLabel = true;
        }
      }
      return Boolean(
        rawTextVal || reviewTextVal || cleanedTextVal || compareTextVal || splitTextVal || casesCompareVal ||
        caseTextVal || hasImported || hasLegacyCaseGen ||
        hasClarify || hasAutoSuggestion || hasLabel || hasAutoClarify
      );
    }
    
    function clearWorkflowStatuses() {
      var statusIds = [
        'parseStatus',
        'reviewStatus',
        'clarifyStatus',
        'cleanStatus',
        'compareStatus',
        'splitStatus',
        'caseStatus',
        'casesCoverageStatus',
        'caseGenStatus',
        'autoWorkflowStatus',
        'autoCompareStatus',
        'autoRecleanStatus',
        'autoMissingStatus',
        'missingViewStatus',
        'autoClarifyStatus',
      ];
      statusIds.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) setStatus(el, '', '');
      });
    }
    
    function interruptActiveExecutions(reasonText) {
      var reason = reasonText ? String(reasonText) : '已中断当前执行任务';
      var interrupted = false;
      if (autoWorkflowManager && typeof autoWorkflowManager.cancelTask === 'function') {
        try {
          interrupted = Boolean(autoWorkflowManager.cancelTask({ reason: reason }));
          if (interrupted && typeof syncAutoWorkflowTaskState === 'function') {
            syncAutoWorkflowTaskState(autoWorkflowManager.getTask ? autoWorkflowManager.getTask() : null);
          }
        } catch (err) {
          interrupted = false;
        }
      } else if (autoWorkflowManager && typeof autoWorkflowManager.getTask === 'function' && typeof autoWorkflowManager.clearTask === 'function') {
        var task = autoWorkflowManager.getTask();
        if (task && task.status === 'running') {
          autoWorkflowManager.clearTask();
          interrupted = true;
          if (typeof syncAutoWorkflowTaskState === 'function') syncAutoWorkflowTaskState(null);
        }
      }
      try {
        abortAllModelRequests('workflow-interrupted');
      } catch (err) {
        // ignore
      }
      return interrupted;
    }
    
    function resetWorkflowData() {
      var preservedXmindSharedCaseState = captureXmindSharedCaseStateForWorkflowReset();
      if (dom.rawText) dom.rawText.value = '';
      if (dom.reviewResultEl) dom.reviewResultEl.value = '';
      if (dom.cleanedTextEl) dom.cleanedTextEl.value = '';
      if (dom.compareResultEl) dom.compareResultEl.value = '';
      if (dom.splitResultEl) dom.splitResultEl.value = '';
      if (dom.casesCompareResultEl) dom.casesCompareResultEl.value = '';
      if (dom.caseTextEl) dom.caseTextEl.value = '';
      if (dom.fileName) dom.fileName.textContent = '未选择文件';
      state.lastRawImportName = '';
      state.requirementLabel = '';
      state.requirementLabelSource = '';
      state.requirementMedia = createEmptyRequirementMediaState();
      state.autoRunning = false;
      state.inProgressStep = '';
      state.inProgressSteps = {};
      state.failedSteps = {};
      state.waitingSteps = {};
      state.compareCaseAssistantStatus = 'idle';
      state.validationFailedSteps = {};
      state.failedReasons = {};
      state.waitingReasons = {};
      state.validationFailedReasons = {};
      state.reviewRows = [];
      state.reviewClarifications = new Map();
      state.reviewSelections = new Set();
      state.reviewExpanded = new Set();
      state.cleanEntries = [];
      state.cleanViewSelection = -1;
      state.cleanHighlightAll = false;
      state.cleanActiveHighlights = {};
      state.missingSelections = new Set();
      state.missingRowCache = [];
      state.missingLastList = [];
      state.autoCompareMissingList = [];
      state.autoCompareSelections = new Set();
      state.autoCompareSelectionTouched = false;
      state.autoCompareSuggestion = '';
      state.autoRequireClarifications = false;
      state.autoClarifyResolver = null;
      state.caseGenLegacy = createEmptyLegacyCaseGenState();
      state.caseGenModules = [];
      state.caseGenSource = '';
      state.caseGenResults = {};
      state.caseSelections = {};
      state.caseGenSuggestions = {};
      state.caseGenModuleStatus = {};
      state.caseGenProgress = {};
      state.caseGenTiming = {};
      state.caseGenProgressNotice = {};
      state.caseGenRunning = new Set();
      state.importedCases = [];
      restoreXmindSharedCaseStateAfterWorkflowReset(preservedXmindSharedCaseState);
      var autoCompareSuggestionInput = document.getElementById('autoCompareSuggestion');
      if (autoCompareSuggestionInput) autoCompareSuggestionInput.value = '';
      if (dom.autoClarifyToggle) dom.autoClarifyToggle.checked = false;
      clearWorkflowStatuses();
      if (typeof renderImportedCaseList === 'function') renderImportedCaseList();
      if (typeof resetImportedCaseView === 'function') resetImportedCaseView();
      if (typeof syncCaseTextWithImports === 'function') syncCaseTextWithImports();
      if (typeof renderCaseGeneration === 'function') renderCaseGeneration();
      if (typeof renderCaseGenProgressBoard === 'function') renderCaseGenProgressBoard();
      if (typeof renderCleanView === 'function') renderCleanView();
      if (typeof renderCleanRawView === 'function') renderCleanRawView(null);
      if (typeof syncReviewViewFromResult === 'function') syncReviewViewFromResult();
      if (typeof syncSplitView === 'function') syncSplitView();
      if (typeof updateMissingView === 'function') updateMissingView();
      if (typeof syncAutoCompareStatus === 'function') syncAutoCompareStatus();
      if (typeof updateAutoClarifyVisibility === 'function') updateAutoClarifyVisibility(false);
      if (typeof updateAutoMissingCard === 'function') updateAutoMissingCard();
      if (typeof renderAutoRawInfo === 'function') renderAutoRawInfo();
      if (typeof setCaseViewHint === 'function') {
        setCaseViewHint('请先上传或输入 XMind 测试用例');
      }
      triggerUpdateFlowStatus();
      requestPersistWorkflowStateNow();
    }
    function guardRequirementImport() {
      try {
        var scopedUntil = window.app && window.app.__xmindCasegenScopedRequirementImportUntil
          ? Number(window.app.__xmindCasegenScopedRequirementImportUntil || 0)
          : 0;
        if (scopedUntil > Date.now()) {
          if (window.app) window.app.__xmindCasegenScopedRequirementImportUntil = 0;
          return Promise.resolve(true);
        }
      } catch (err) {
        // ignore
      }
      var hasRunningTask = false;
      if (autoWorkflowManager && typeof autoWorkflowManager.getTask === 'function') {
        var task = autoWorkflowManager.getTask();
        hasRunningTask = Boolean(task && task.status === 'running');
      } else {
        hasRunningTask = Boolean(state.autoRunning);
      }
      if (!hasWorkflowData() && !hasRunningTask) return Promise.resolve(true);
      var confirmDrawer = window.app && window.app.confirmDrawer ? window.app.confirmDrawer : null;
      var message = '新导入需求后会清空当前功能流程与一键执行结果，并中断当前自动执行任务；已有 XMind 用例生成页签和结果会保留。是否确认导入新需求？';
      if (!confirmDrawer || typeof confirmDrawer.open !== 'function') {
        var ok = window.confirm(message);
        if (ok) {
          interruptActiveExecutions('导入新需求，已中断当前一键执行');
          resetWorkflowData();
        }
        return Promise.resolve(ok);
      }
      return confirmDrawer.open({
        title: '确认导入新需求',
        message: message,
        confirmText: '确认导入',
        cancelText: '取消',
        danger: true,
      }).then(function(result) {
        if (result && result.ok) {
          interruptActiveExecutions('导入新需求，已中断当前一键执行');
          resetWorkflowData();
          return true;
        }
        return false;
      });
    }

    return {
      cloneJson: cloneJson,
      createEmptyRequirementMediaState: createEmptyRequirementMediaState,
      createEmptyLegacyCaseGenState: createEmptyLegacyCaseGenState,
      hasLegacyCaseGenData: hasLegacyCaseGenData,
      hasXmindWorkspaceData: hasXmindWorkspaceData,
      shouldPreserveXmindSharedCaseStateOnWorkflowReset: shouldPreserveXmindSharedCaseStateOnWorkflowReset,
      cloneCaseSelectionStateForReset: cloneCaseSelectionStateForReset,
      restoreCaseSelectionStateAfterReset: restoreCaseSelectionStateAfterReset,
      captureXmindSharedCaseStateForWorkflowReset: captureXmindSharedCaseStateForWorkflowReset,
      restoreXmindSharedCaseStateAfterWorkflowReset: restoreXmindSharedCaseStateAfterWorkflowReset,
      hasWorkflowData: hasWorkflowData,
      clearWorkflowStatuses: clearWorkflowStatuses,
      interruptActiveExecutions: interruptActiveExecutions,
      resetWorkflowData: resetWorkflowData,
      guardRequirementImport: guardRequirementImport,
    };
  }

  return {
    create: create,
  };
});
