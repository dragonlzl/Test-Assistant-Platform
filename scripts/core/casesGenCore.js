 (function() {
  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var dom = ctx.dom || {};
    var utils = ctx.utils || {};
    var handlers = ctx.handlers || {};
    var config = ctx.config || {};

    var sanitizeCasesForExport = ctx.sanitizeCasesForExport || function(list) { return list || []; };
    var wrapDataWithRequirement = ctx.wrapDataWithRequirement || function(data) { return data; };
    var getSafeRequirementSlug = ctx.getSafeRequirementSlug || function() { return 'requirement'; };
    var normalizeRequirementName = ctx.normalizeRequirementName || function(text) { return text || ''; };
    var formatCompactTimestamp = ctx.formatCompactTimestamp || function() { return Date.now().toString(); };
    var getSafeFileBaseName = ctx.getSafeFileBaseName || function(name, fallback) {
      var raw = '';
      if (typeof name === 'string') {
        raw = name;
      } else if (name && typeof name.toString === 'function') {
        raw = name.toString();
      }
      var trimmed = raw.trim();
      var withoutExt = trimmed.replace(/\.[^.]+$/, '');
      var pattern = /(_result)?_\d{8}(?:_?\d{6})?$/i;
      var stripped = withoutExt || trimmed;
      while (pattern.test(stripped)) {
        stripped = stripped.replace(pattern, '');
      }
      var candidate = stripped || withoutExt || trimmed || (fallback || '');
      if (!candidate) candidate = 'usecase';
      return candidate.replace(/[\\/:*?"<>|]/g, '_') || 'usecase';
    };
    var defaultPrompts = config.defaultPrompts || {};

    var casesGenerationContainer = dom.casesGenerationContainer;
    var caseGenStatus = dom.caseGenStatus;
    var caseGenTimingEl = dom.caseGenTimingEl;
    var tempExecStatus = dom.tempExecStatus;
    var apiClient = (window.app && window.app.apiClient) ? window.app.apiClient : null;
    var exportCaseGenBtn = dom.exportCaseGenBtn || dom.exportCaseGen;
    if (!exportCaseGenBtn && typeof document !== 'undefined') {
      exportCaseGenBtn = document.getElementById('exportCaseGen');
    }
    var appendToExistingCasesBtn = dom.appendToExistingCasesBtn || dom.appendToExistingCases;
    var appendTargetSelect = dom.appendTargetSelect;
    var transferSelectedToExecBtn = dom.transferSelectedToExecBtn || dom.transferSelectedToExec;
    var caseGenStoreActionSelect = document.getElementById('caseGenStoreActionSelect');
    var caseGenStoreNewBtn = document.getElementById('caseGenStoreNewBtn');
    var caseGenStoreAppendBtn = document.getElementById('caseGenStoreAppendBtn');
    var caseGenStoreModeNewBtn = document.getElementById('caseGenStoreModeNewBtn');
    var caseGenStoreModeAppendBtn = document.getElementById('caseGenStoreModeAppendBtn');
    var caseGenStoreModeNewPanel = document.getElementById('caseGenStoreModeNewPanel');
    var caseGenStoreModeAppendPanel = document.getElementById('caseGenStoreModeAppendPanel');
    var caseGenDbStoreDrawerTitle = document.getElementById('caseGenDbStoreDrawerTitle');
    var caseGenDbStoreEntryNameRow = document.getElementById('caseGenDbStoreEntryNameRow');
    var caseGenDbStoreEntryNameInput = document.getElementById('caseGenDbStoreEntryNameInput');
    var caseGenDbStoreProjectSelect = document.getElementById('caseGenDbStoreProjectSelect');
    var caseGenDbStoreVersionSelect = document.getElementById('caseGenDbStoreVersionSelect');
    var caseGenDbStoreCaseFileRow = document.getElementById('caseGenDbStoreCaseFileRow');
    var caseGenDbStoreCaseFileSelect = document.getElementById('caseGenDbStoreCaseFileSelect');
    var caseGenDbStoreConfirmBtn = document.getElementById('caseGenDbStoreConfirmBtn');
    var caseGenDbStoreStatus = document.getElementById('caseGenDbStoreStatus');
    var caseGenRequirementDrawerHint = document.getElementById('caseGenRequirementDrawerHint');
    var caseGenRequirementDrawerInput = document.getElementById('caseGenRequirementDrawerInput');
    var caseGenRequirementDrawerConfirmBtn = document.getElementById('caseGenRequirementDrawerConfirmBtn');
    var caseGenRequirementDrawerCancelBtn = document.getElementById('caseGenRequirementDrawerCancelBtn');
    var caseGenRequirementDrawerStatus = document.getElementById('caseGenRequirementDrawerStatus');
    var caseGenModuleGenerateDrawerTitle = document.getElementById('caseGenModuleGenerateDrawerTitle');
    var caseGenModuleGenerateDrawerHint = document.getElementById('caseGenModuleGenerateDrawerHint');
    var caseGenModuleGenerateDrawerModuleTitle = document.getElementById('caseGenModuleGenerateDrawerModuleTitle');
    var caseGenModuleGenerateDrawerScenarios = document.getElementById('caseGenModuleGenerateDrawerScenarios');
    var caseGenModuleGenerateDrawerPoints = document.getElementById('caseGenModuleGenerateDrawerPoints');
    var caseGenModuleGenerateDrawerCoupled = document.getElementById('caseGenModuleGenerateDrawerCoupled');
    var caseGenModuleGenerateGlobalTabBtn = document.getElementById('caseGenModuleGenerateGlobalTabBtn');
    var caseGenModuleGenerateLocalTabBtn = document.getElementById('caseGenModuleGenerateLocalTabBtn');
    var caseGenModuleGenerateTopupTabBtn = document.getElementById('caseGenModuleGenerateTopupTabBtn');
    var caseGenModuleGenerateGlobalPanel = document.getElementById('caseGenModuleGenerateGlobalPanel');
    var caseGenModuleGenerateLocalPanel = document.getElementById('caseGenModuleGenerateLocalPanel');
    var caseGenModuleGenerateTopupPanel = document.getElementById('caseGenModuleGenerateTopupPanel');
    var caseGenModuleGenerateDrawerGlobalSummary = document.getElementById('caseGenModuleGenerateDrawerGlobalSummary');
    var caseGenModuleGenerateGlobalConfirmBtn = document.getElementById('caseGenModuleGenerateGlobalConfirmBtn');
    var caseGenModuleLocalRequirementEl = document.getElementById('caseGenModuleLocalRequirement');
    var caseGenModuleLocalNeedFunctionConditionEl = document.getElementById('caseGenModuleLocalNeedFunctionCondition');
    var caseGenModuleLocalNeedNumericValidationEl = document.getElementById('caseGenModuleLocalNeedNumericValidation');
    var caseGenModuleLocalNeedBoundaryEl = document.getElementById('caseGenModuleLocalNeedBoundary');
    var caseGenModuleLocalNeedMobileEl = document.getElementById('caseGenModuleLocalNeedMobile');
    var caseGenModuleLocalNeedSpecialEl = document.getElementById('caseGenModuleLocalNeedSpecial');
    var caseGenModuleLocalSpecialOptionsEl = document.getElementById('caseGenModuleLocalSpecialOptions');
    var caseGenModuleLocalSpecialRepeatOperationEl = document.getElementById('caseGenModuleLocalSpecialRepeatOperation');
    var caseGenModuleLocalSpecialMultiTouchEl = document.getElementById('caseGenModuleLocalSpecialMultiTouch');
    var caseGenModuleLocalSpecialRepeatExecutionEl = document.getElementById('caseGenModuleLocalSpecialRepeatExecution');
    var caseGenModuleLocalSpecialWeakNetworkEl = document.getElementById('caseGenModuleLocalSpecialWeakNetwork');
    var caseGenModuleLocalSpecialInterruptResumeEl = document.getElementById('caseGenModuleLocalSpecialInterruptResume');
    var caseGenModuleGenerateLocalConfirmBtn = document.getElementById('caseGenModuleGenerateLocalConfirmBtn');
    var caseGenModuleTopupSuggestionEl = document.getElementById('caseGenModuleTopupSuggestion');
    var caseGenModuleTopupHint = document.getElementById('caseGenModuleTopupHint');
    var caseGenModuleGenerateTopupConfirmBtn = document.getElementById('caseGenModuleGenerateTopupConfirmBtn');
    var caseGenModuleGenerateDrawerStatus = document.getElementById('caseGenModuleGenerateDrawerStatus');
    var caseGenActionDrawerTitle = document.getElementById('caseGenActionDrawerTitle');
    var caseGenActionDrawerHint = document.getElementById('caseGenActionDrawerHint');
    var caseGenActionDrawerRequirementSummary = document.getElementById('caseGenActionDrawerRequirementSummary');
    var caseGenActionDrawerConfirmBtn = document.getElementById('caseGenActionDrawerConfirmBtn');
    var caseGenActionDrawerStatus = document.getElementById('caseGenActionDrawerStatus');
    var exportCaseGenXmindBtn = dom.exportCaseGenXmindBtn || dom.exportCaseGenXmind;
    var caseGenAllGenerateBtn = document.getElementById('caseGenAllGenerateBtn');
    var caseGenAllTopupBtn = document.getElementById('caseGenAllTopupBtn');
    var caseGenSuggestionGenerateBtn = document.getElementById('caseGenSuggestionGenerateBtn');
    var caseGenSettingsTabBtn = document.getElementById('caseGenSettingsTabBtn');
    var caseGenLegacyModulesTabBtn = document.getElementById('caseGenLegacyModulesTabBtn');
    var caseGenModulesTabBtn = document.getElementById('caseGenModulesTabBtn');
    var casegenSettingsPanel = document.getElementById('casegenSettingsPanel');
    var casegenLegacyModulesPanel = document.getElementById('casegenLegacyModulesPanel');
    var casegenModulesPanel = document.getElementById('casegenModulesPanel');
    var caseGenXmindModulesContainer = document.getElementById('caseGenXmindModulesContainer');
    var caseGenWorkspaceMirrorSection = document.getElementById('caseGenWorkspaceMirrorSection');
    var caseGenWorkspaceMirrorList = document.getElementById('caseGenWorkspaceMirrorTabs');
    var caseGenCustomRequirementEl = document.getElementById('caseGenCustomRequirement');
    var caseGenNeedFunctionConditionEl = document.getElementById('caseGenNeedFunctionCondition');
    var caseGenNeedNumericValidationEl = document.getElementById('caseGenNeedNumericValidation');
    var caseGenNeedBoundaryEl = document.getElementById('caseGenNeedBoundary');
    var caseGenNeedMobileEl = document.getElementById('caseGenNeedMobile');
    var caseGenNeedSpecialEl = document.getElementById('caseGenNeedSpecial');
    var caseGenSpecialOptionsEl = document.getElementById('caseGenSpecialOptions');
    var caseGenSpecialRepeatOperationEl = document.getElementById('caseGenSpecialRepeatOperation');
    var caseGenSpecialMultiTouchEl = document.getElementById('caseGenSpecialMultiTouch');
    var caseGenSpecialRepeatExecutionEl = document.getElementById('caseGenSpecialRepeatExecution');
    var caseGenSpecialWeakNetworkEl = document.getElementById('caseGenSpecialWeakNetwork');
    var caseGenSpecialInterruptResumeEl = document.getElementById('caseGenSpecialInterruptResume');
    var caseGenViewDrawerBody = dom.caseGenViewDrawerBody;
    var caseGenViewDrawerTitle = dom.caseGenViewDrawerTitle;
    var caseGenAllSelectBtn = dom.caseGenAllSelectBtn || document.getElementById('caseGenAllSelectBtn');

    var runtime = {
      caseGenDbStoreDrawer: null,
      caseGenRequirementDrawer: null,
      caseGenRequirementDrawerExternal: null,
      caseGenModuleGenerateDrawer: null,
      caseGenActionDrawer: null,
      caseGenViewDrawer: null,
      activeCaseViewModuleId: '',
      pendingCaseGenDbStoreAction: '',
      pendingCaseGenActionContext: null,
      pendingCaseGenModuleGenerateState: null,
      caseGenActionDrawerDraftSettings: null,
      ALL_CASE_VIEW_ID: '__casegen_all__',
    };

    var ensureCaseGenRequirementDrawer, syncCaseGenActionDrawerSummary, findCaseGenModule, formatCaseGenModuleField;
    var describeCaseGenPromptSettings, normalizeCaseGenActionContext, getCaseGenActionMeta, runCaseGenBatchAction;
    var executeCaseGenActionContext, normalizeCaseGenModuleDrawerTab, createCaseGenModuleGenerateState, setCaseGenModuleSuggestionDraft;
    var syncCaseGenModuleLocalSpecialOptionsState, syncCaseGenModuleLocalInputs, setCaseGenModuleLocalSettingValue, getCaseGenModuleGenerateHasResult;
    var setCaseGenModuleGenerateDrawerTab, syncCaseGenModuleGenerateDrawer, ensureCaseGenModuleGenerateDrawer, ensureCaseGenActionDrawer;
    var openCaseGenActionDrawerByContext, openCaseGenBatchActionDrawer, openCaseGenSettingsDrawer, openCaseGenModuleGenerateDrawer;
    var promptRequirementLabelByDrawer, createDefaultCaseGenSettings, normalizeCaseGenPromptSettings, ensureCaseGenSettings;
    var createCaseGenPromptSettingsSnapshot, createEmptyCaseGenPromptSettings, syncCaseGenPromptInputs, applyCaseGenPromptSettings;
    var setCaseGenSettingValue, syncCaseGenSpecialOptionsState, setCaseGenViewTab, setCaseGenStoreMode;
    var getCaseGenPromptComponents, appendCaseWritingGuidePrompt, buildCaseGenPrompt, resolveModuleTitle;
    var normalizeModuleKey, normalizeCaseTitle, normalizeCaseListWithModules, chunkArray;
    var resolveCaseGenBatchConcurrency, resolveCaseSimilarityConcurrency, resolveCaseGenTimeoutSec, callCaseGenModelWithGuard;
    var parseGeneratedCases, hasGeneratedCases, hasRunningCaseModules, buildCaseGenModuleMeta;
    var listGeneratedCaseGenModuleTitles, refreshCaseGenBatchButtons, confirmCaseGenBatchOverwrite, runCaseGenBatch;
    var generateAllCaseGenModules, topUpAllCaseGenModules, generateSuggestedCaseGenModules, commitModuleCases;
    var buildModuleCases, buildModuleTopup, filterCasesAgainstImported, normalizeStaleCaseProgress;
    var generateCasesForModule, topUpCasesForModule, ensureDbStoreState, clearExplicitDbStorePayload;
    var normalizeExplicitDbStoreItems, applyExplicitDbStorePayload, normalizeCaseGenDbStoreEntryName, getCaseGenDbStoreDefaultEntryName;
    var renderCaseGenDbStoreEntryName, buildCaseGenDbStoreFileName, hasExplicitDbStoreItems, collectPendingDbStoreItems;
    var listPendingDbStoreMissingModules, isDbStoreReady, ensureCaseGenDbStoreDrawer, clearCaseGenDbStoreNewActionError;
    var markCaseGenDbStoreNewActionError, setCaseGenDbStoreNewAction, setPendingCaseGenDbStoreAction, consumePendingCaseGenDbStoreAction;
    var buildCaseItemPayloadFromGenerated, collectDbStoreSelectedItems, syncCaseGenDbStoreControls, renderCaseGenDbStoreProjects;
    var renderCaseGenDbStoreVersions, renderCaseGenDbStoreCaseFiles, loadCaseGenDbStoreProjects, loadCaseGenDbStoreVersions;
    var loadCaseGenDbStoreCaseFiles, maybeConfirmIncompleteModulesBeforeStore, triggerTempExecCaseLibrarySync, openTempExecViewByNav;
    var goToExecSet, applyCaseGenDbStorePreferredSelections, openCaseGenDbStoreDrawer, bindCaseGenDbStoreEvents;
    var openCaseGenDbStoreNewDrawer, openCaseGenDbStoreAppendDrawer, maybeResetXmindCasegenAfterStoreSuccess, confirmCaseGenDbNewImport;
    var confirmCaseGenDbAppend, cloneJsonValue, cloneSelectionSet, createEmptyLegacyCaseGenState;
    var cloneCaseGenRunningState, restoreCaseGenRunningSet, ensureLegacyCaseGenState, cloneCaseSelectionMap;
    var buildCurrentCaseGenSharedSnapshot, caseGenSnapshotHasOutputContent, shouldRestoreLegacyCaseGenForRender, buildCurrentLegacyWorkflowInputSnapshot;
    var syncLegacyCaseGenState, restoreLegacyCaseGenState, getLegacyCaseGenRenderState, buildOperationSnapshotPayload;
    var getLatestCaseGenOperationSnapshot, syncCaseGenOperationPointers, createCaseGenOperationSnapshot, discardCaseGenOperationSnapshot;
    var applyOperationSnapshot, rollbackCaseGenOperationSnapshot, snapshotModuleCases, findModuleSnapshot;
    var restoreSelectionSet, rollbackModuleCases, snapshotAllCaseGenState, rollbackAllCaseGenState;
    var ensureCaseGenDrawer, resetCaseViewButton, closeCaseViewIfActive, getCaseViewContainer;
    var renderCaseGenWorkspaceMirrorTabs, computeAppendTargetOptions, hasValidAppendTargetSelection, renderAppendTargetOptions;
    var collectAdditionsForBuckets, promptTempExecTarget, normalizeExecCaseList, hasExecutionData;
    var convertCaseForExec, renderCaseTable, updateSupplementButtons, ensureCaseSelectionSet;
    var refreshCaseSelectionUI, hasSelectedGeneratedCases, refreshAppendExistingButton, ensureCaseGenSelectionHintState;
    var setCaseGenSelectionHint, applyCaseGenSelectionHint, clearAllCaseGenSelectionHints, setCaseGenSelectionHintsForAllModules;
    var getCaseGenAllSelectionStats, toggleCaseGenAllSelectButton, updateCaseGenAllSelectionButton, findFirstGeneratedModuleId;
    var collectGeneratedModules, openCaseViewForModule, openCaseGenAllView, openCaseViewForSelectionHint;
    var listCaseGenModulesMissingSelectionOrGeneration, resolveCaseGenActiveDrawer, collectSelectedCaseEntries, getCaseListForModule;
    var renderLegacyCaseGeneration, renderXmindModuleMirror, renderCaseGeneration, exportCaseGenerationResults;
    var exportModuleCases, importModuleCases, appendSelectedCasesToImported, transferSelectedCasesToExec;
    var transferModuleToTempExec, clearModuleCases, toggleCaseView, openXmindMirrorCaseView;
    var handleCaseSelectionChange, handleCaseSelectAll, handleCaseSelectAllModules, exportSelectedCases;
    var exportSelectedCasesToXmind, exportSelectedModulesToXmind, exportSelectedCasesData, exportAllModulesData;
    var exportSingleModuleData;

    var setStatus = ctx.setStatus || function() {};
    var downloadText = handlers.downloadText || function() {};
    var downloadBlob = handlers.downloadBlob || function() {};
    var stripCodeFence = handlers.stripCodeFence || function(text) { return text || ''; };
    var unwrapRequirementPayload = handlers.unwrapRequirementPayload || function(text) { return { payload: text, requirement: '', type: '' }; };
    var extractRequirementLabelFromText = handlers.extractRequirementLabelFromText || function() { return ''; };
    var promptRequirementLabel = handlers.promptRequirementLabel || function() { return ''; };
    var setRequirementLabel = handlers.setRequirementLabel || function() {};
    var ensureRequirementLabel = handlers.ensureRequirementLabel || function() { return ''; };
    var getRequirementLabel = handlers.getRequirementLabel || function() { return ''; };
    var getCleanedTextForModel = handlers.getCleanedTextForModel || function() { return ''; };
    var getModuleSuggestion = handlers.getModuleSuggestion || function(moduleId) {
      return (state.caseGenSuggestions && state.caseGenSuggestions[moduleId]) ? state.caseGenSuggestions[moduleId].trim() : '';
    };
    var getAssignedModel = handlers.getAssignedModel || function() { throw new Error('缺少模型'); };
    var getReasoningForType = handlers.getReasoningForType || function() { return ''; };
    var getTemperatureForType = handlers.getTemperatureForType || function() { return 0.2; };
    var callModelWithConfig = handlers.callModelWithConfig || function() { return Promise.resolve(''); };
    var updateModelTiming = handlers.updateModelTiming || function() {};
    var runConcurrent = handlers.runConcurrent || function(items, concurrency, worker) {
      return Promise.all(items.map(function(item, idx) { return worker(item, idx); }));
    };
    var hasImportedCases = handlers.hasImportedCases || function() { return false; };
    var getImportedCaseObjects = handlers.getImportedCaseObjects || function() { return []; };
    var addImportedCase = handlers.addImportedCase || null;
    var renderImportedCaseList = handlers.renderImportedCaseList || function() {};
    var refreshImportedCaseView = handlers.refreshImportedCaseView || function() {};
    var syncCaseTextWithImports = handlers.syncCaseTextWithImports || function() {};
    var updateFlowStatus = handlers.updateFlowStatus || function() {};
    var getTempExecFiles = handlers.getTempExecFiles || function() { return state.tempExecFiles || []; };
    var normalizeTempExecCases = handlers.normalizeTempExecCases || null;
    var deriveCaseListFromText = handlers.deriveCaseListFromText || function() { return []; };
    var buildXmindPackageFromCases = handlers.buildXmindPackageFromCases || null;
    var createTempExecFile = handlers.createTempExecFile || function() { return null; };
    var ensureTempExecReplacement = handlers.ensureTempExecReplacement || function() { return true; };
    var syncTempExecFocus = handlers.syncTempExecFocus || function() {};
    var persistTempExecState = handlers.persistTempExecState || function() {};
    var setTempExecActive = handlers.setTempExecActive || function() {};
    var renderTempExecView = handlers.renderTempExecView || function() {};
    var switchTab = handlers.switchTab || function() {};
    var scrollElementIntoView = handlers.scrollElementIntoView || function() {};
    var renderCaseGenProgressBoard = handlers.renderCaseGenProgressBoard || function() {};
    var renderCaseModuleProgress = handlers.renderCaseModuleProgress || function() { return ''; };
    var updateCaseProgressView = handlers.updateCaseProgressView || function() {};
    var clearCaseProgress = handlers.clearCaseProgress || function() {};
    var initCaseProgress = handlers.initCaseProgress || function() {};
    var setCaseProgressGroupState = handlers.setCaseProgressGroupState || function() {};
    var setCaseProgressStep = handlers.setCaseProgressStep || function() {};
    var markAllCaseProgressGroups = handlers.markAllCaseProgressGroups || function() {};
    var persistWorkflowState = handlers.persistWorkflowState || function() {};
    var setCaseModuleRunning = handlers.setCaseModuleRunning || function() {};
    var isCaseModuleRunning = handlers.isCaseModuleRunning || function() { return false; };
    function ensureCaseModuleStatusState() {
      if (!state.caseGenModuleStatus || typeof state.caseGenModuleStatus !== 'object') {
        state.caseGenModuleStatus = {};
      }
      return state.caseGenModuleStatus;
    }
    var syncCaseModuleStatus = handlers.syncCaseModuleStatus || function(moduleId) {
      if (!casesGenerationContainer || !moduleId) return;
      var el = casesGenerationContainer.querySelector('[data-case-status="' + moduleId + '"]');
      var statusInfo = ensureCaseModuleStatusState()[moduleId];
      if (!el) return;
      var text = statusInfo ? statusInfo.text : '';
      var type = statusInfo ? statusInfo.type : '';
      setStatus(el, text, type);
    };
    var setCaseModuleStatus = handlers.setCaseModuleStatus || function(moduleId, text, type) {
      if (!moduleId) return;
      ensureCaseModuleStatusState()[moduleId] = { text: text, type: type || '' };
      syncCaseModuleStatus(moduleId);
      renderCaseGenProgressBoard();
    };
    var clearCaseModuleStatus = handlers.clearCaseModuleStatus || function(moduleId) {
      if (!moduleId) return;
      var statusMap = ensureCaseModuleStatusState();
      delete statusMap[moduleId];
      syncCaseModuleStatus(moduleId);
      renderCaseGenProgressBoard();
    };
    var refreshExportCaseGenButton = handlers.refreshExportCaseGenButton || function() {
      if (!exportCaseGenBtn) return;
      var hasResult = false;
      if (state.caseGenResults && typeof state.caseGenResults === 'object') {
        for (var key in state.caseGenResults) {
          if (!Object.prototype.hasOwnProperty.call(state.caseGenResults, key)) continue;
          var val = (state.caseGenResults[key] || '').trim();
          if (val && !/^\[\s*\]$/.test(val)) {
            hasResult = true;
            break;
          }
        }
      }
      if (!hasResult && Array.isArray(state.caseGenModules)) {
        hasResult = state.caseGenModules.some(function(mod) {
          var content = (state.caseGenResults[mod.id] || '').trim();
          return Boolean(content && !/^\[\s*\]$/.test(content));
        });
      }
      exportCaseGenBtn.disabled = !hasResult;
    };
    var refreshExportCaseGenXmindButton = function() {
      if (!exportCaseGenXmindBtn) return;
      exportCaseGenXmindBtn.disabled = !hasSelectedGeneratedCases();
    };
    var setCaseViewHint = handlers.setCaseViewHint || function() {};
    var parseCaseList = handlers.parseCaseList || function() { return []; };
    var extractJsonObjects = handlers.extractJsonObjects || function() { return []; };












    function ensureXmindCaseGenState() {
      if (!state.xmindCaseGen || typeof state.xmindCaseGen !== 'object') {
        state.xmindCaseGen = {
          activeWorkspaceId: '',
          workspaceOrder: [],
          workspaces: {},
          nextWorkspaceSeq: 1,
          mode: 'modules',
          treeSourceSignature: '',
          hasModuleSkeleton: false,
          hasImportedBaseline: false,
          openButtonDotVisible: false,
          viewState: {
            drawerOpen: false,
            fullscreen: false,
            transform: '',
            scaleVal: 1,
            scrollLeft: 0,
            scrollTop: 0,
            collapsedNodeKeys: [],
            treeSourceSignature: '',
            updatedAt: 0,
          },
          history: [],
          operationSnapshots: [],
          lastOperationSnapshotId: '',
          rootSnapshotId: '',
          rootSnapshots: [],
          deletedBaselineModuleKeys: [],
          deletedBaselineCaseKeys: [],
          deleteUndoStack: [],
          deleteRedoStack: [],
          root: {
            lastAction: '',
            running: false,
            snapshotId: '',
            status: '',
            error: '',
            updatedAt: 0,
          },
          summaryCollapsed: false,
          prep: {
            step: 1,
            requirementMode: '',
            requirementSupplement: '',
            manualRequirementBlocks: [],
            caseImportMode: '',
            completed: false,
          },
          nextSnapshotId: 1,
          snapshots: [],
          modules: {},
        };
      }
      if (!Array.isArray(state.xmindCaseGen.snapshots)) {
        state.xmindCaseGen.snapshots = [];
      }
      if (!Array.isArray(state.xmindCaseGen.history)) {
        state.xmindCaseGen.history = [];
      }
      if (!Array.isArray(state.xmindCaseGen.operationSnapshots)) {
        state.xmindCaseGen.operationSnapshots = [];
      }
      if (!Array.isArray(state.xmindCaseGen.rootSnapshots)) {
        state.xmindCaseGen.rootSnapshots = [];
      }
      if (!Array.isArray(state.xmindCaseGen.workspaceOrder)) {
        state.xmindCaseGen.workspaceOrder = [];
      }
      if (!state.xmindCaseGen.workspaces || typeof state.xmindCaseGen.workspaces !== 'object') {
        state.xmindCaseGen.workspaces = {};
      }
      state.xmindCaseGen.activeWorkspaceId = String(state.xmindCaseGen.activeWorkspaceId || '');
      if (!Number.isFinite(Number(state.xmindCaseGen.nextWorkspaceSeq))) {
        state.xmindCaseGen.nextWorkspaceSeq = 1;
      }
      if (!state.xmindCaseGen.viewState || typeof state.xmindCaseGen.viewState !== 'object') {
        state.xmindCaseGen.viewState = {
          drawerOpen: false,
          fullscreen: false,
          transform: '',
          scaleVal: 1,
          scrollLeft: 0,
          scrollTop: 0,
          collapsedNodeKeys: [],
          treeSourceSignature: '',
          updatedAt: 0,
        };
      }
      if (!Array.isArray(state.xmindCaseGen.viewState.collapsedNodeKeys)) {
        state.xmindCaseGen.viewState.collapsedNodeKeys = [];
      }
      if (!Array.isArray(state.xmindCaseGen.deletedBaselineModuleKeys)) {
        state.xmindCaseGen.deletedBaselineModuleKeys = [];
      }
      if (!Array.isArray(state.xmindCaseGen.deletedBaselineCaseKeys)) {
        state.xmindCaseGen.deletedBaselineCaseKeys = [];
      }
      if (!Array.isArray(state.xmindCaseGen.deleteUndoStack)) {
        state.xmindCaseGen.deleteUndoStack = [];
      }
      if (!Array.isArray(state.xmindCaseGen.deleteRedoStack)) {
        state.xmindCaseGen.deleteRedoStack = [];
      }
      if (!state.xmindCaseGen.modules || typeof state.xmindCaseGen.modules !== 'object') {
        state.xmindCaseGen.modules = {};
      }
      if (!state.xmindCaseGen.root || typeof state.xmindCaseGen.root !== 'object') {
        state.xmindCaseGen.root = {
          lastAction: '',
          running: false,
          snapshotId: '',
          status: '',
          error: '',
          updatedAt: 0,
        };
      }
      if (!state.xmindCaseGen.prep || typeof state.xmindCaseGen.prep !== 'object') {
        state.xmindCaseGen.prep = {
          step: 1,
          requirementMode: '',
          requirementSupplement: '',
          manualRequirementBlocks: [],
          caseImportMode: '',
          completed: false,
        };
      }
      if (!Number.isFinite(Number(state.xmindCaseGen.nextSnapshotId))) {
        state.xmindCaseGen.nextSnapshotId = 1;
      }
      state.xmindCaseGen.mode = state.xmindCaseGen.mode === 'full' ? 'full' : 'modules';
      state.xmindCaseGen.treeSourceSignature = String(state.xmindCaseGen.treeSourceSignature || '');
      state.xmindCaseGen.hasModuleSkeleton = state.xmindCaseGen.hasModuleSkeleton === true;
      state.xmindCaseGen.hasImportedBaseline = state.xmindCaseGen.hasImportedBaseline === true;
      state.xmindCaseGen.openButtonDotVisible = state.xmindCaseGen.openButtonDotVisible === true;
      state.xmindCaseGen.workspaceOrder = state.xmindCaseGen.workspaceOrder.map(function(item) {
        return String(item || '').trim();
      }).filter(Boolean);
      state.xmindCaseGen.lastOperationSnapshotId = String(state.xmindCaseGen.lastOperationSnapshotId || '');
      state.xmindCaseGen.rootSnapshotId = String(state.xmindCaseGen.rootSnapshotId || '');
      state.xmindCaseGen.deletedBaselineModuleKeys = state.xmindCaseGen.deletedBaselineModuleKeys.map(function(item) {
        return String(item || '').trim().toLowerCase();
      }).filter(Boolean);
      state.xmindCaseGen.deletedBaselineCaseKeys = state.xmindCaseGen.deletedBaselineCaseKeys.map(function(item) {
        return String(item || '').trim();
      }).filter(Boolean);
      state.xmindCaseGen.summaryCollapsed = state.xmindCaseGen.summaryCollapsed === true;
      state.xmindCaseGen.prep.step = Math.max(1, Math.min(3, Number(state.xmindCaseGen.prep.step) || 1));
      state.xmindCaseGen.prep.requirementMode = state.xmindCaseGen.prep.requirementMode === 'manual'
        ? 'manual'
        : (state.xmindCaseGen.prep.requirementMode === 'document' ? 'document' : '');
      state.xmindCaseGen.prep.requirementSupplement = String(state.xmindCaseGen.prep.requirementSupplement || '');
      if (!Array.isArray(state.xmindCaseGen.prep.manualRequirementBlocks)) {
        state.xmindCaseGen.prep.manualRequirementBlocks = [];
      }
      state.xmindCaseGen.prep.caseImportMode = state.xmindCaseGen.prep.caseImportMode === 'import'
        ? 'import'
        : (state.xmindCaseGen.prep.caseImportMode === 'skip' ? 'skip' : '');
      state.xmindCaseGen.prep.completed = state.xmindCaseGen.prep.completed === true;
      return state.xmindCaseGen;
    }

    function hasXmindWorkspaceDrawerRestoreIntent(workspaceId) {
      var stableId = workspaceId ? String(workspaceId || '') : '';
      if (!stableId) return false;
      var xmindState = ensureXmindCaseGenState();
      var record = xmindState.workspaces && xmindState.workspaces[stableId]
        ? xmindState.workspaces[stableId]
        : null;
      var viewState = record
        && record.snapshot
        && record.snapshot.xmind
        && record.snapshot.xmind.viewState
        && typeof record.snapshot.xmind.viewState === 'object'
          ? record.snapshot.xmind.viewState
          : null;
      return Boolean(viewState && viewState.drawerOpen === true);
    }

    function hasPendingXmindDrawerRestoreIntent() {
      var xmindState = ensureXmindCaseGenState();
      var viewState = xmindState.viewState && typeof xmindState.viewState === 'object'
        ? xmindState.viewState
        : null;
      if (viewState && viewState.drawerOpen === true) return true;
      return hasXmindWorkspaceDrawerRestoreIntent(xmindState.activeWorkspaceId);
    }

    function shouldDeferXmindCasegenMirrorRender() {
      var xmindApi = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      return Boolean(
        xmindApi
        && typeof xmindApi.shouldDeferCasesGenPageRender === 'function'
        && xmindApi.shouldDeferCasesGenPageRender() === true
      );
    }

    function queueDeferredXmindCasegenMirrorRender() {
      var xmindApi = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      if (!xmindApi || typeof xmindApi.queueCasesGenPageRender !== 'function') return false;
      return xmindApi.queueCasesGenPageRender() === true;
    }

    function ensureXmindCaseGenModuleState(moduleId) {
      var rootState = ensureXmindCaseGenState();
      var key = String(moduleId || '');
      if (!key) return null;
      if (!rootState.modules[key] || typeof rootState.modules[key] !== 'object') {
        rootState.modules[key] = {
          lastAction: '',
          running: false,
          snapshotId: '',
          status: '',
          error: '',
          hideResults: false,
          updatedAt: 0,
        };
      }
      return rootState.modules[key];
    }































    function ensureCaseModuleTimingState() {
      if (!state.caseGenTiming || typeof state.caseGenTiming !== 'object') {
        state.caseGenTiming = {};
      }
      return state.caseGenTiming;
    }
    function getCaseTimingValueEl(moduleId) {
      if (!casesGenerationContainer || !moduleId) return null;
      return casesGenerationContainer.querySelector('[data-case-timing-value="' + moduleId + '"]');
    }
    function syncCaseModuleTiming(moduleId) {
      var map = ensureCaseModuleTimingState();
      var el = getCaseTimingValueEl(moduleId);
      if (!el) return;
      var val = map[moduleId];
      if (!Number.isFinite(val)) {
        el.textContent = '--';
        return;
      }
      el.textContent = (val / 1000).toFixed(2);
    }
    function setCaseModuleTiming(moduleId, durationMs) {
      var map = ensureCaseModuleTimingState();
      if (!Number.isFinite(durationMs)) {
        map[moduleId] = null;
      } else {
        map[moduleId] = durationMs;
      }
      syncCaseModuleTiming(moduleId);
    }









    var escapeHtml = utils.escapeHtml || function(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    var escapeHtmlPreserve = utils.escapeHtmlPreserve || function(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };
    var stringifyCaseField = utils.stringifyCaseField || function(text) {
      if (text === undefined || text === null) return '';
      return text.toString().trim();
    };






































































    function openConfirmDrawer(options) {
      var liveUtils = window.app && window.app.utils ? window.app.utils : null;
      if (liveUtils && typeof liveUtils.openConfirmDrawer === 'function') {
        return liveUtils.openConfirmDrawer(options || {});
      }
      var msg = options && options.message ? String(options.message) : '';
      var ok = true;
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        ok = window.confirm(msg);
      }
      return Promise.resolve({ ok: ok });
    }














    var caseGenDbStoreBound = false;
























































    var factory = window.app && window.app.casesGenGenerationOwner;
    if (!factory || typeof factory.create !== 'function') {
      throw new Error('casesGenGenerationOwner 未加载');
    }
    var owner = factory.create({
      runtime: runtime,
      state: state,
      config: config,
      sanitizeCasesForExport: sanitizeCasesForExport,
      normalizeRequirementName: normalizeRequirementName,
      defaultPrompts: defaultPrompts,
      casesGenerationContainer: casesGenerationContainer,
      caseGenStatus: caseGenStatus,
      caseGenTimingEl: caseGenTimingEl,
      caseGenStoreModeNewBtn: caseGenStoreModeNewBtn,
      caseGenStoreModeAppendBtn: caseGenStoreModeAppendBtn,
      caseGenStoreModeNewPanel: caseGenStoreModeNewPanel,
      caseGenStoreModeAppendPanel: caseGenStoreModeAppendPanel,
      caseGenRequirementDrawerHint: caseGenRequirementDrawerHint,
      caseGenRequirementDrawerInput: caseGenRequirementDrawerInput,
      caseGenRequirementDrawerConfirmBtn: caseGenRequirementDrawerConfirmBtn,
      caseGenRequirementDrawerCancelBtn: caseGenRequirementDrawerCancelBtn,
      caseGenRequirementDrawerStatus: caseGenRequirementDrawerStatus,
      caseGenModuleGenerateDrawerTitle: caseGenModuleGenerateDrawerTitle,
      caseGenModuleGenerateDrawerHint: caseGenModuleGenerateDrawerHint,
      caseGenModuleGenerateDrawerModuleTitle: caseGenModuleGenerateDrawerModuleTitle,
      caseGenModuleGenerateDrawerScenarios: caseGenModuleGenerateDrawerScenarios,
      caseGenModuleGenerateDrawerPoints: caseGenModuleGenerateDrawerPoints,
      caseGenModuleGenerateDrawerCoupled: caseGenModuleGenerateDrawerCoupled,
      caseGenModuleGenerateGlobalTabBtn: caseGenModuleGenerateGlobalTabBtn,
      caseGenModuleGenerateLocalTabBtn: caseGenModuleGenerateLocalTabBtn,
      caseGenModuleGenerateTopupTabBtn: caseGenModuleGenerateTopupTabBtn,
      caseGenModuleGenerateGlobalPanel: caseGenModuleGenerateGlobalPanel,
      caseGenModuleGenerateLocalPanel: caseGenModuleGenerateLocalPanel,
      caseGenModuleGenerateTopupPanel: caseGenModuleGenerateTopupPanel,
      caseGenModuleGenerateDrawerGlobalSummary: caseGenModuleGenerateDrawerGlobalSummary,
      caseGenModuleGenerateGlobalConfirmBtn: caseGenModuleGenerateGlobalConfirmBtn,
      caseGenModuleLocalRequirementEl: caseGenModuleLocalRequirementEl,
      caseGenModuleLocalNeedFunctionConditionEl: caseGenModuleLocalNeedFunctionConditionEl,
      caseGenModuleLocalNeedNumericValidationEl: caseGenModuleLocalNeedNumericValidationEl,
      caseGenModuleLocalNeedBoundaryEl: caseGenModuleLocalNeedBoundaryEl,
      caseGenModuleLocalNeedMobileEl: caseGenModuleLocalNeedMobileEl,
      caseGenModuleLocalNeedSpecialEl: caseGenModuleLocalNeedSpecialEl,
      caseGenModuleLocalSpecialOptionsEl: caseGenModuleLocalSpecialOptionsEl,
      caseGenModuleLocalSpecialRepeatOperationEl: caseGenModuleLocalSpecialRepeatOperationEl,
      caseGenModuleLocalSpecialMultiTouchEl: caseGenModuleLocalSpecialMultiTouchEl,
      caseGenModuleLocalSpecialRepeatExecutionEl: caseGenModuleLocalSpecialRepeatExecutionEl,
      caseGenModuleLocalSpecialWeakNetworkEl: caseGenModuleLocalSpecialWeakNetworkEl,
      caseGenModuleLocalSpecialInterruptResumeEl: caseGenModuleLocalSpecialInterruptResumeEl,
      caseGenModuleGenerateLocalConfirmBtn: caseGenModuleGenerateLocalConfirmBtn,
      caseGenModuleTopupSuggestionEl: caseGenModuleTopupSuggestionEl,
      caseGenModuleTopupHint: caseGenModuleTopupHint,
      caseGenModuleGenerateTopupConfirmBtn: caseGenModuleGenerateTopupConfirmBtn,
      caseGenModuleGenerateDrawerStatus: caseGenModuleGenerateDrawerStatus,
      caseGenActionDrawerTitle: caseGenActionDrawerTitle,
      caseGenActionDrawerHint: caseGenActionDrawerHint,
      caseGenActionDrawerRequirementSummary: caseGenActionDrawerRequirementSummary,
      caseGenActionDrawerConfirmBtn: caseGenActionDrawerConfirmBtn,
      caseGenActionDrawerStatus: caseGenActionDrawerStatus,
      caseGenAllGenerateBtn: caseGenAllGenerateBtn,
      caseGenAllTopupBtn: caseGenAllTopupBtn,
      caseGenSuggestionGenerateBtn: caseGenSuggestionGenerateBtn,
      caseGenSettingsTabBtn: caseGenSettingsTabBtn,
      caseGenLegacyModulesTabBtn: caseGenLegacyModulesTabBtn,
      caseGenModulesTabBtn: caseGenModulesTabBtn,
      casegenSettingsPanel: casegenSettingsPanel,
      casegenLegacyModulesPanel: casegenLegacyModulesPanel,
      casegenModulesPanel: casegenModulesPanel,
      caseGenCustomRequirementEl: caseGenCustomRequirementEl,
      caseGenNeedFunctionConditionEl: caseGenNeedFunctionConditionEl,
      caseGenNeedNumericValidationEl: caseGenNeedNumericValidationEl,
      caseGenNeedBoundaryEl: caseGenNeedBoundaryEl,
      caseGenNeedMobileEl: caseGenNeedMobileEl,
      caseGenNeedSpecialEl: caseGenNeedSpecialEl,
      caseGenSpecialOptionsEl: caseGenSpecialOptionsEl,
      caseGenSpecialRepeatOperationEl: caseGenSpecialRepeatOperationEl,
      caseGenSpecialMultiTouchEl: caseGenSpecialMultiTouchEl,
      caseGenSpecialRepeatExecutionEl: caseGenSpecialRepeatExecutionEl,
      caseGenSpecialWeakNetworkEl: caseGenSpecialWeakNetworkEl,
      caseGenSpecialInterruptResumeEl: caseGenSpecialInterruptResumeEl,
      setStatus: setStatus,
      unwrapRequirementPayload: unwrapRequirementPayload,
      promptRequirementLabel: promptRequirementLabel,
      setRequirementLabel: setRequirementLabel,
      ensureRequirementLabel: ensureRequirementLabel,
      getRequirementLabel: getRequirementLabel,
      getCleanedTextForModel: getCleanedTextForModel,
      getModuleSuggestion: getModuleSuggestion,
      getAssignedModel: getAssignedModel,
      getReasoningForType: getReasoningForType,
      getTemperatureForType: getTemperatureForType,
      callModelWithConfig: callModelWithConfig,
      updateModelTiming: updateModelTiming,
      runConcurrent: runConcurrent,
      hasImportedCases: hasImportedCases,
      getImportedCaseObjects: getImportedCaseObjects,
      renderCaseGenProgressBoard: renderCaseGenProgressBoard,
      clearCaseProgress: clearCaseProgress,
      initCaseProgress: initCaseProgress,
      setCaseProgressGroupState: setCaseProgressGroupState,
      setCaseProgressStep: setCaseProgressStep,
      markAllCaseProgressGroups: markAllCaseProgressGroups,
      persistWorkflowState: persistWorkflowState,
      setCaseModuleRunning: setCaseModuleRunning,
      isCaseModuleRunning: isCaseModuleRunning,
      setCaseModuleStatus: setCaseModuleStatus,
      extractJsonObjects: extractJsonObjects,
      stringifyCaseField: stringifyCaseField,
      ensureCaseModuleStatusState: function() { return ensureCaseModuleStatusState.apply(null, arguments); },
      hasPendingXmindDrawerRestoreIntent: function() { return hasPendingXmindDrawerRestoreIntent.apply(null, arguments); },
      setCaseModuleTiming: function() { return setCaseModuleTiming.apply(null, arguments); },
      closeCaseViewIfActive: function() { return closeCaseViewIfActive.apply(null, arguments); },
      updateSupplementButtons: function() { return updateSupplementButtons.apply(null, arguments); },
      refreshCaseSelectionUI: function() { return refreshCaseSelectionUI.apply(null, arguments); },
      openConfirmDrawer: function() { return openConfirmDrawer.apply(null, arguments); },
      resolveCaseGenActiveDrawer: function() { return resolveCaseGenActiveDrawer.apply(null, arguments); },
      getCaseListForModule: function() { return getCaseListForModule.apply(null, arguments); },
      syncLegacyCaseGenState: function() { return syncLegacyCaseGenState.apply(null, arguments); },
      restoreLegacyCaseGenState: function() { return restoreLegacyCaseGenState.apply(null, arguments); },
      renderCaseGeneration: function() { return renderCaseGeneration.apply(null, arguments); },
    });
    ensureCaseGenRequirementDrawer = owner.ensureCaseGenRequirementDrawer;
    syncCaseGenActionDrawerSummary = owner.syncCaseGenActionDrawerSummary;
    findCaseGenModule = owner.findCaseGenModule;
    formatCaseGenModuleField = owner.formatCaseGenModuleField;
    describeCaseGenPromptSettings = owner.describeCaseGenPromptSettings;
    normalizeCaseGenActionContext = owner.normalizeCaseGenActionContext;
    getCaseGenActionMeta = owner.getCaseGenActionMeta;
    runCaseGenBatchAction = owner.runCaseGenBatchAction;
    executeCaseGenActionContext = owner.executeCaseGenActionContext;
    normalizeCaseGenModuleDrawerTab = owner.normalizeCaseGenModuleDrawerTab;
    createCaseGenModuleGenerateState = owner.createCaseGenModuleGenerateState;
    setCaseGenModuleSuggestionDraft = owner.setCaseGenModuleSuggestionDraft;
    syncCaseGenModuleLocalSpecialOptionsState = owner.syncCaseGenModuleLocalSpecialOptionsState;
    syncCaseGenModuleLocalInputs = owner.syncCaseGenModuleLocalInputs;
    setCaseGenModuleLocalSettingValue = owner.setCaseGenModuleLocalSettingValue;
    getCaseGenModuleGenerateHasResult = owner.getCaseGenModuleGenerateHasResult;
    setCaseGenModuleGenerateDrawerTab = owner.setCaseGenModuleGenerateDrawerTab;
    syncCaseGenModuleGenerateDrawer = owner.syncCaseGenModuleGenerateDrawer;
    ensureCaseGenModuleGenerateDrawer = owner.ensureCaseGenModuleGenerateDrawer;
    ensureCaseGenActionDrawer = owner.ensureCaseGenActionDrawer;
    openCaseGenActionDrawerByContext = owner.openCaseGenActionDrawerByContext;
    openCaseGenBatchActionDrawer = owner.openCaseGenBatchActionDrawer;
    openCaseGenSettingsDrawer = owner.openCaseGenSettingsDrawer;
    openCaseGenModuleGenerateDrawer = owner.openCaseGenModuleGenerateDrawer;
    promptRequirementLabelByDrawer = owner.promptRequirementLabelByDrawer;
    createDefaultCaseGenSettings = owner.createDefaultCaseGenSettings;
    normalizeCaseGenPromptSettings = owner.normalizeCaseGenPromptSettings;
    ensureCaseGenSettings = owner.ensureCaseGenSettings;
    createCaseGenPromptSettingsSnapshot = owner.createCaseGenPromptSettingsSnapshot;
    createEmptyCaseGenPromptSettings = owner.createEmptyCaseGenPromptSettings;
    syncCaseGenPromptInputs = owner.syncCaseGenPromptInputs;
    applyCaseGenPromptSettings = owner.applyCaseGenPromptSettings;
    setCaseGenSettingValue = owner.setCaseGenSettingValue;
    syncCaseGenSpecialOptionsState = owner.syncCaseGenSpecialOptionsState;
    setCaseGenViewTab = owner.setCaseGenViewTab;
    setCaseGenStoreMode = owner.setCaseGenStoreMode;
    getCaseGenPromptComponents = owner.getCaseGenPromptComponents;
    appendCaseWritingGuidePrompt = owner.appendCaseWritingGuidePrompt;
    buildCaseGenPrompt = owner.buildCaseGenPrompt;
    resolveModuleTitle = owner.resolveModuleTitle;
    normalizeModuleKey = owner.normalizeModuleKey;
    normalizeCaseTitle = owner.normalizeCaseTitle;
    normalizeCaseListWithModules = owner.normalizeCaseListWithModules;
    chunkArray = owner.chunkArray;
    resolveCaseGenBatchConcurrency = owner.resolveCaseGenBatchConcurrency;
    resolveCaseSimilarityConcurrency = owner.resolveCaseSimilarityConcurrency;
    resolveCaseGenTimeoutSec = owner.resolveCaseGenTimeoutSec;
    callCaseGenModelWithGuard = owner.callCaseGenModelWithGuard;
    parseGeneratedCases = owner.parseGeneratedCases;
    hasGeneratedCases = owner.hasGeneratedCases;
    hasRunningCaseModules = owner.hasRunningCaseModules;
    buildCaseGenModuleMeta = owner.buildCaseGenModuleMeta;
    listGeneratedCaseGenModuleTitles = owner.listGeneratedCaseGenModuleTitles;
    refreshCaseGenBatchButtons = owner.refreshCaseGenBatchButtons;
    confirmCaseGenBatchOverwrite = owner.confirmCaseGenBatchOverwrite;
    runCaseGenBatch = owner.runCaseGenBatch;
    generateAllCaseGenModules = owner.generateAllCaseGenModules;
    topUpAllCaseGenModules = owner.topUpAllCaseGenModules;
    generateSuggestedCaseGenModules = owner.generateSuggestedCaseGenModules;
    commitModuleCases = owner.commitModuleCases;
    buildModuleCases = owner.buildModuleCases;
    buildModuleTopup = owner.buildModuleTopup;
    filterCasesAgainstImported = owner.filterCasesAgainstImported;
    normalizeStaleCaseProgress = owner.normalizeStaleCaseProgress;
    generateCasesForModule = owner.generateCasesForModule;
    topUpCasesForModule = owner.topUpCasesForModule;

    var factory = window.app && window.app.casesGenDbStoreOwner;
    if (!factory || typeof factory.create !== 'function') {
      throw new Error('casesGenDbStoreOwner 未加载');
    }
    var owner = factory.create({
      runtime: runtime,
      state: state,
      utils: utils,
      caseGenStatus: caseGenStatus,
      apiClient: apiClient,
      caseGenStoreActionSelect: caseGenStoreActionSelect,
      caseGenDbStoreDrawerTitle: caseGenDbStoreDrawerTitle,
      caseGenDbStoreEntryNameRow: caseGenDbStoreEntryNameRow,
      caseGenDbStoreEntryNameInput: caseGenDbStoreEntryNameInput,
      caseGenDbStoreProjectSelect: caseGenDbStoreProjectSelect,
      caseGenDbStoreVersionSelect: caseGenDbStoreVersionSelect,
      caseGenDbStoreCaseFileRow: caseGenDbStoreCaseFileRow,
      caseGenDbStoreCaseFileSelect: caseGenDbStoreCaseFileSelect,
      caseGenDbStoreConfirmBtn: caseGenDbStoreConfirmBtn,
      caseGenDbStoreStatus: caseGenDbStoreStatus,
      setStatus: setStatus,
      ensureRequirementLabel: ensureRequirementLabel,
      getRequirementLabel: getRequirementLabel,
      setTempExecActive: setTempExecActive,
      switchTab: switchTab,
      escapeHtml: escapeHtml,
      caseGenDbStoreBound: caseGenDbStoreBound,
      setCaseGenStoreMode: function() { return setCaseGenStoreMode.apply(null, arguments); },
      hasSelectedGeneratedCases: function() { return hasSelectedGeneratedCases.apply(null, arguments); },
      hasGeneratedCases: function() { return hasGeneratedCases.apply(null, arguments); },
      openCaseViewForSelectionHint: function() { return openCaseViewForSelectionHint.apply(null, arguments); },
      listCaseGenModulesMissingSelectionOrGeneration: function() { return listCaseGenModulesMissingSelectionOrGeneration.apply(null, arguments); },
      openConfirmDrawer: function() { return openConfirmDrawer.apply(null, arguments); },
      collectSelectedCaseEntries: function() { return collectSelectedCaseEntries.apply(null, arguments); },
    });
    ensureDbStoreState = owner.ensureDbStoreState;
    clearExplicitDbStorePayload = owner.clearExplicitDbStorePayload;
    normalizeExplicitDbStoreItems = owner.normalizeExplicitDbStoreItems;
    applyExplicitDbStorePayload = owner.applyExplicitDbStorePayload;
    normalizeCaseGenDbStoreEntryName = owner.normalizeCaseGenDbStoreEntryName;
    getCaseGenDbStoreDefaultEntryName = owner.getCaseGenDbStoreDefaultEntryName;
    renderCaseGenDbStoreEntryName = owner.renderCaseGenDbStoreEntryName;
    buildCaseGenDbStoreFileName = owner.buildCaseGenDbStoreFileName;
    hasExplicitDbStoreItems = owner.hasExplicitDbStoreItems;
    collectPendingDbStoreItems = owner.collectPendingDbStoreItems;
    listPendingDbStoreMissingModules = owner.listPendingDbStoreMissingModules;
    isDbStoreReady = owner.isDbStoreReady;
    ensureCaseGenDbStoreDrawer = owner.ensureCaseGenDbStoreDrawer;
    clearCaseGenDbStoreNewActionError = owner.clearCaseGenDbStoreNewActionError;
    markCaseGenDbStoreNewActionError = owner.markCaseGenDbStoreNewActionError;
    setCaseGenDbStoreNewAction = owner.setCaseGenDbStoreNewAction;
    setPendingCaseGenDbStoreAction = owner.setPendingCaseGenDbStoreAction;
    consumePendingCaseGenDbStoreAction = owner.consumePendingCaseGenDbStoreAction;
    buildCaseItemPayloadFromGenerated = owner.buildCaseItemPayloadFromGenerated;
    collectDbStoreSelectedItems = owner.collectDbStoreSelectedItems;
    syncCaseGenDbStoreControls = owner.syncCaseGenDbStoreControls;
    renderCaseGenDbStoreProjects = owner.renderCaseGenDbStoreProjects;
    renderCaseGenDbStoreVersions = owner.renderCaseGenDbStoreVersions;
    renderCaseGenDbStoreCaseFiles = owner.renderCaseGenDbStoreCaseFiles;
    loadCaseGenDbStoreProjects = owner.loadCaseGenDbStoreProjects;
    loadCaseGenDbStoreVersions = owner.loadCaseGenDbStoreVersions;
    loadCaseGenDbStoreCaseFiles = owner.loadCaseGenDbStoreCaseFiles;
    maybeConfirmIncompleteModulesBeforeStore = owner.maybeConfirmIncompleteModulesBeforeStore;
    triggerTempExecCaseLibrarySync = owner.triggerTempExecCaseLibrarySync;
    openTempExecViewByNav = owner.openTempExecViewByNav;
    goToExecSet = owner.goToExecSet;
    applyCaseGenDbStorePreferredSelections = owner.applyCaseGenDbStorePreferredSelections;
    openCaseGenDbStoreDrawer = owner.openCaseGenDbStoreDrawer;
    bindCaseGenDbStoreEvents = owner.bindCaseGenDbStoreEvents;
    openCaseGenDbStoreNewDrawer = owner.openCaseGenDbStoreNewDrawer;
    openCaseGenDbStoreAppendDrawer = owner.openCaseGenDbStoreAppendDrawer;
    maybeResetXmindCasegenAfterStoreSuccess = owner.maybeResetXmindCasegenAfterStoreSuccess;
    confirmCaseGenDbNewImport = owner.confirmCaseGenDbNewImport;
    confirmCaseGenDbAppend = owner.confirmCaseGenDbAppend;

    var factory = window.app && window.app.casesGenSnapshotOwner;
    if (!factory || typeof factory.create !== 'function') {
      throw new Error('casesGenSnapshotOwner 未加载');
    }
    var owner = factory.create({
      runtime: runtime,
      state: state,
      renderImportedCaseList: renderImportedCaseList,
      syncCaseTextWithImports: syncCaseTextWithImports,
      persistWorkflowState: persistWorkflowState,
      ensureCaseModuleStatusState: function() { return ensureCaseModuleStatusState.apply(null, arguments); },
      ensureXmindCaseGenState: function() { return ensureXmindCaseGenState.apply(null, arguments); },
      shouldDeferXmindCasegenMirrorRender: function() { return shouldDeferXmindCasegenMirrorRender.apply(null, arguments); },
      queueDeferredXmindCasegenMirrorRender: function() { return queueDeferredXmindCasegenMirrorRender.apply(null, arguments); },
      ensureXmindCaseGenModuleState: function() { return ensureXmindCaseGenModuleState.apply(null, arguments); },
      ensureCaseModuleTimingState: function() { return ensureCaseModuleTimingState.apply(null, arguments); },
      closeCaseViewIfActive: function() { return closeCaseViewIfActive.apply(null, arguments); },
      ensureCaseGenSettings: function() { return ensureCaseGenSettings.apply(null, arguments); },
      updateSupplementButtons: function() { return updateSupplementButtons.apply(null, arguments); },
      refreshCaseSelectionUI: function() { return refreshCaseSelectionUI.apply(null, arguments); },
      getCaseListForModule: function() { return getCaseListForModule.apply(null, arguments); },
      renderCaseGeneration: function() { return renderCaseGeneration.apply(null, arguments); },
    });
    cloneJsonValue = owner.cloneJsonValue;
    cloneSelectionSet = owner.cloneSelectionSet;
    createEmptyLegacyCaseGenState = owner.createEmptyLegacyCaseGenState;
    cloneCaseGenRunningState = owner.cloneCaseGenRunningState;
    restoreCaseGenRunningSet = owner.restoreCaseGenRunningSet;
    ensureLegacyCaseGenState = owner.ensureLegacyCaseGenState;
    cloneCaseSelectionMap = owner.cloneCaseSelectionMap;
    buildCurrentCaseGenSharedSnapshot = owner.buildCurrentCaseGenSharedSnapshot;
    caseGenSnapshotHasOutputContent = owner.caseGenSnapshotHasOutputContent;
    shouldRestoreLegacyCaseGenForRender = owner.shouldRestoreLegacyCaseGenForRender;
    buildCurrentLegacyWorkflowInputSnapshot = owner.buildCurrentLegacyWorkflowInputSnapshot;
    syncLegacyCaseGenState = owner.syncLegacyCaseGenState;
    restoreLegacyCaseGenState = owner.restoreLegacyCaseGenState;
    getLegacyCaseGenRenderState = owner.getLegacyCaseGenRenderState;
    buildOperationSnapshotPayload = owner.buildOperationSnapshotPayload;
    getLatestCaseGenOperationSnapshot = owner.getLatestCaseGenOperationSnapshot;
    syncCaseGenOperationPointers = owner.syncCaseGenOperationPointers;
    createCaseGenOperationSnapshot = owner.createCaseGenOperationSnapshot;
    discardCaseGenOperationSnapshot = owner.discardCaseGenOperationSnapshot;
    applyOperationSnapshot = owner.applyOperationSnapshot;
    rollbackCaseGenOperationSnapshot = owner.rollbackCaseGenOperationSnapshot;
    snapshotModuleCases = owner.snapshotModuleCases;
    findModuleSnapshot = owner.findModuleSnapshot;
    restoreSelectionSet = owner.restoreSelectionSet;
    rollbackModuleCases = owner.rollbackModuleCases;
    snapshotAllCaseGenState = owner.snapshotAllCaseGenState;
    rollbackAllCaseGenState = owner.rollbackAllCaseGenState;

    var factory = window.app && window.app.casesGenResultOwner;
    if (!factory || typeof factory.create !== 'function') {
      throw new Error('casesGenResultOwner 未加载');
    }
    var owner = factory.create({
      runtime: runtime,
      state: state,
      sanitizeCasesForExport: sanitizeCasesForExport,
      wrapDataWithRequirement: wrapDataWithRequirement,
      getSafeRequirementSlug: getSafeRequirementSlug,
      normalizeRequirementName: normalizeRequirementName,
      formatCompactTimestamp: formatCompactTimestamp,
      getSafeFileBaseName: getSafeFileBaseName,
      casesGenerationContainer: casesGenerationContainer,
      caseGenStatus: caseGenStatus,
      tempExecStatus: tempExecStatus,
      exportCaseGenBtn: exportCaseGenBtn,
      appendTargetSelect: appendTargetSelect,
      caseGenStoreNewBtn: caseGenStoreNewBtn,
      caseGenStoreAppendBtn: caseGenStoreAppendBtn,
      caseGenXmindModulesContainer: caseGenXmindModulesContainer,
      caseGenWorkspaceMirrorSection: caseGenWorkspaceMirrorSection,
      caseGenWorkspaceMirrorList: caseGenWorkspaceMirrorList,
      caseGenViewDrawerBody: caseGenViewDrawerBody,
      caseGenViewDrawerTitle: caseGenViewDrawerTitle,
      caseGenAllSelectBtn: caseGenAllSelectBtn,
      setStatus: setStatus,
      downloadText: downloadText,
      downloadBlob: downloadBlob,
      stripCodeFence: stripCodeFence,
      extractRequirementLabelFromText: extractRequirementLabelFromText,
      setRequirementLabel: setRequirementLabel,
      ensureRequirementLabel: ensureRequirementLabel,
      getRequirementLabel: getRequirementLabel,
      hasImportedCases: hasImportedCases,
      renderImportedCaseList: renderImportedCaseList,
      refreshImportedCaseView: refreshImportedCaseView,
      syncCaseTextWithImports: syncCaseTextWithImports,
      getTempExecFiles: getTempExecFiles,
      normalizeTempExecCases: normalizeTempExecCases,
      deriveCaseListFromText: deriveCaseListFromText,
      buildXmindPackageFromCases: buildXmindPackageFromCases,
      createTempExecFile: createTempExecFile,
      ensureTempExecReplacement: ensureTempExecReplacement,
      syncTempExecFocus: syncTempExecFocus,
      persistTempExecState: persistTempExecState,
      setTempExecActive: setTempExecActive,
      renderTempExecView: renderTempExecView,
      switchTab: switchTab,
      scrollElementIntoView: scrollElementIntoView,
      renderCaseGenProgressBoard: renderCaseGenProgressBoard,
      renderCaseModuleProgress: renderCaseModuleProgress,
      updateCaseProgressView: updateCaseProgressView,
      clearCaseProgress: clearCaseProgress,
      persistWorkflowState: persistWorkflowState,
      isCaseModuleRunning: isCaseModuleRunning,
      syncCaseModuleStatus: syncCaseModuleStatus,
      setCaseModuleStatus: setCaseModuleStatus,
      clearCaseModuleStatus: clearCaseModuleStatus,
      refreshExportCaseGenButton: refreshExportCaseGenButton,
      refreshExportCaseGenXmindButton: refreshExportCaseGenXmindButton,
      parseCaseList: parseCaseList,
      escapeHtml: escapeHtml,
      escapeHtmlPreserve: escapeHtmlPreserve,
      stringifyCaseField: stringifyCaseField,
      hasPendingXmindDrawerRestoreIntent: function() { return hasPendingXmindDrawerRestoreIntent.apply(null, arguments); },
      shouldDeferXmindCasegenMirrorRender: function() { return shouldDeferXmindCasegenMirrorRender.apply(null, arguments); },
      queueDeferredXmindCasegenMirrorRender: function() { return queueDeferredXmindCasegenMirrorRender.apply(null, arguments); },
      isDbStoreReady: function() { return isDbStoreReady.apply(null, arguments); },
      promptRequirementLabelByDrawer: function() { return promptRequirementLabelByDrawer.apply(null, arguments); },
      ensureCaseModuleTimingState: function() { return ensureCaseModuleTimingState.apply(null, arguments); },
      syncCaseModuleTiming: function() { return syncCaseModuleTiming.apply(null, arguments); },
      setPendingCaseGenDbStoreAction: function() { return setPendingCaseGenDbStoreAction.apply(null, arguments); },
      consumePendingCaseGenDbStoreAction: function() { return consumePendingCaseGenDbStoreAction.apply(null, arguments); },
      ensureCaseGenSettings: function() { return ensureCaseGenSettings.apply(null, arguments); },
      setCaseGenStoreMode: function() { return setCaseGenStoreMode.apply(null, arguments); },
      resolveModuleTitle: function() { return resolveModuleTitle.apply(null, arguments); },
      normalizeModuleKey: function() { return normalizeModuleKey.apply(null, arguments); },
      normalizeCaseTitle: function() { return normalizeCaseTitle.apply(null, arguments); },
      normalizeCaseListWithModules: function() { return normalizeCaseListWithModules.apply(null, arguments); },
      parseGeneratedCases: function() { return parseGeneratedCases.apply(null, arguments); },
      hasGeneratedCases: function() { return hasGeneratedCases.apply(null, arguments); },
      hasRunningCaseModules: function() { return hasRunningCaseModules.apply(null, arguments); },
      refreshCaseGenBatchButtons: function() { return refreshCaseGenBatchButtons.apply(null, arguments); },
      openConfirmDrawer: function() { return openConfirmDrawer.apply(null, arguments); },
      openCaseGenDbStoreNewDrawer: function() { return openCaseGenDbStoreNewDrawer.apply(null, arguments); },
      openCaseGenDbStoreAppendDrawer: function() { return openCaseGenDbStoreAppendDrawer.apply(null, arguments); },
      shouldRestoreLegacyCaseGenForRender: function() { return shouldRestoreLegacyCaseGenForRender.apply(null, arguments); },
      syncLegacyCaseGenState: function() { return syncLegacyCaseGenState.apply(null, arguments); },
      restoreLegacyCaseGenState: function() { return restoreLegacyCaseGenState.apply(null, arguments); },
      normalizeStaleCaseProgress: function() { return normalizeStaleCaseProgress.apply(null, arguments); },
    });
    ensureCaseGenDrawer = owner.ensureCaseGenDrawer;
    resetCaseViewButton = owner.resetCaseViewButton;
    closeCaseViewIfActive = owner.closeCaseViewIfActive;
    getCaseViewContainer = owner.getCaseViewContainer;
    renderCaseGenWorkspaceMirrorTabs = owner.renderCaseGenWorkspaceMirrorTabs;
    computeAppendTargetOptions = owner.computeAppendTargetOptions;
    hasValidAppendTargetSelection = owner.hasValidAppendTargetSelection;
    renderAppendTargetOptions = owner.renderAppendTargetOptions;
    collectAdditionsForBuckets = owner.collectAdditionsForBuckets;
    promptTempExecTarget = owner.promptTempExecTarget;
    normalizeExecCaseList = owner.normalizeExecCaseList;
    hasExecutionData = owner.hasExecutionData;
    convertCaseForExec = owner.convertCaseForExec;
    renderCaseTable = owner.renderCaseTable;
    updateSupplementButtons = owner.updateSupplementButtons;
    ensureCaseSelectionSet = owner.ensureCaseSelectionSet;
    refreshCaseSelectionUI = owner.refreshCaseSelectionUI;
    hasSelectedGeneratedCases = owner.hasSelectedGeneratedCases;
    refreshAppendExistingButton = owner.refreshAppendExistingButton;
    ensureCaseGenSelectionHintState = owner.ensureCaseGenSelectionHintState;
    setCaseGenSelectionHint = owner.setCaseGenSelectionHint;
    applyCaseGenSelectionHint = owner.applyCaseGenSelectionHint;
    clearAllCaseGenSelectionHints = owner.clearAllCaseGenSelectionHints;
    setCaseGenSelectionHintsForAllModules = owner.setCaseGenSelectionHintsForAllModules;
    getCaseGenAllSelectionStats = owner.getCaseGenAllSelectionStats;
    toggleCaseGenAllSelectButton = owner.toggleCaseGenAllSelectButton;
    updateCaseGenAllSelectionButton = owner.updateCaseGenAllSelectionButton;
    findFirstGeneratedModuleId = owner.findFirstGeneratedModuleId;
    collectGeneratedModules = owner.collectGeneratedModules;
    openCaseViewForModule = owner.openCaseViewForModule;
    openCaseGenAllView = owner.openCaseGenAllView;
    openCaseViewForSelectionHint = owner.openCaseViewForSelectionHint;
    listCaseGenModulesMissingSelectionOrGeneration = owner.listCaseGenModulesMissingSelectionOrGeneration;
    resolveCaseGenActiveDrawer = owner.resolveCaseGenActiveDrawer;
    collectSelectedCaseEntries = owner.collectSelectedCaseEntries;
    getCaseListForModule = owner.getCaseListForModule;
    renderLegacyCaseGeneration = owner.renderLegacyCaseGeneration;
    renderXmindModuleMirror = owner.renderXmindModuleMirror;
    renderCaseGeneration = owner.renderCaseGeneration;
    exportCaseGenerationResults = owner.exportCaseGenerationResults;
    exportModuleCases = owner.exportModuleCases;
    importModuleCases = owner.importModuleCases;
    appendSelectedCasesToImported = owner.appendSelectedCasesToImported;
    transferSelectedCasesToExec = owner.transferSelectedCasesToExec;
    transferModuleToTempExec = owner.transferModuleToTempExec;
    clearModuleCases = owner.clearModuleCases;
    toggleCaseView = owner.toggleCaseView;
    openXmindMirrorCaseView = owner.openXmindMirrorCaseView;
    handleCaseSelectionChange = owner.handleCaseSelectionChange;
    handleCaseSelectAll = owner.handleCaseSelectAll;
    handleCaseSelectAllModules = owner.handleCaseSelectAllModules;
    exportSelectedCases = owner.exportSelectedCases;
    exportSelectedCasesToXmind = owner.exportSelectedCasesToXmind;
    exportSelectedModulesToXmind = owner.exportSelectedModulesToXmind;
    exportSelectedCasesData = owner.exportSelectedCasesData;
    exportAllModulesData = owner.exportAllModulesData;
    exportSingleModuleData = owner.exportSingleModuleData;

    return {
      renderCaseGeneration: renderCaseGeneration,
      generateCasesForModule: generateCasesForModule,
      generateAllCaseGenModules: generateAllCaseGenModules,
      generateSuggestedCaseGenModules: generateSuggestedCaseGenModules,
      topUpCasesForModule: topUpCasesForModule,
      topUpAllCaseGenModules: topUpAllCaseGenModules,
      exportCaseGenerationResults: exportCaseGenerationResults,
      exportModuleCases: exportModuleCases,
      importModuleCases: importModuleCases,
      transferModuleToTempExec: transferModuleToTempExec,
      clearModuleCases: clearModuleCases,
      toggleCaseView: toggleCaseView,
      openXmindMirrorCaseView: openXmindMirrorCaseView,
      openCaseGenAllView: openCaseGenAllView,
      handleCaseSelectionChange: handleCaseSelectionChange,
      handleCaseSelectAll: handleCaseSelectAll,
      handleCaseSelectAllModules: handleCaseSelectAllModules,
      exportSelectedCases: exportSelectedCases,
      exportSelectedCasesToXmind: exportSelectedCasesToXmind,
      exportSelectedModulesToXmind: exportSelectedModulesToXmind,
      renderCaseTable: renderCaseTable,
      parseGeneratedCases: parseGeneratedCases,
      refreshCaseSelectionUI: refreshCaseSelectionUI,
      updateSupplementButtons: updateSupplementButtons,
      refreshAppendExistingButton: refreshAppendExistingButton,
      refreshCaseGenBatchButtons: refreshCaseGenBatchButtons,
      ensureCaseGenSettings: ensureCaseGenSettings,
      setCaseGenSettingValue: setCaseGenSettingValue,
      syncCaseGenSpecialOptionsState: syncCaseGenSpecialOptionsState,
      setCaseGenViewTab: setCaseGenViewTab,
      setCaseGenStoreMode: setCaseGenStoreMode,
      openCaseGenBatchActionDrawer: openCaseGenBatchActionDrawer,
      openCaseGenModuleGenerateDrawer: openCaseGenModuleGenerateDrawer,
      openCaseGenSettingsDrawer: openCaseGenSettingsDrawer,
      getCaseGenPromptComponents: getCaseGenPromptComponents,
      buildCaseGenPrompt: buildCaseGenPrompt,
      buildModuleCases: buildModuleCases,
      buildModuleTopup: buildModuleTopup,
      commitModuleCases: commitModuleCases,
      snapshotModuleCases: snapshotModuleCases,
      rollbackModuleCases: rollbackModuleCases,
      snapshotAllCaseGenState: snapshotAllCaseGenState,
      rollbackAllCaseGenState: rollbackAllCaseGenState,
      getLatestCaseGenOperationSnapshot: getLatestCaseGenOperationSnapshot,
      discardCaseGenOperationSnapshot: discardCaseGenOperationSnapshot,
      rollbackCaseGenOperationSnapshot: rollbackCaseGenOperationSnapshot,
      syncLegacyCaseGenState: syncLegacyCaseGenState,
      restoreLegacyCaseGenState: restoreLegacyCaseGenState,
      setCaseGenDbStoreNewAction: setCaseGenDbStoreNewAction,
      clearCaseGenDbStoreNewActionError: clearCaseGenDbStoreNewActionError,
      openCaseGenDbStoreNewDrawer: function() { bindCaseGenDbStoreEvents(); return openCaseGenDbStoreNewDrawer(); },
      openCaseGenDbStoreAppendDrawer: function() { bindCaseGenDbStoreEvents(); return openCaseGenDbStoreAppendDrawer(); },
      openCaseGenDbStoreNewDrawerWithItems: function(items, options) {
        bindCaseGenDbStoreEvents();
        var nextOptions = options && typeof options === 'object' ? Object.assign({}, options) : {};
        nextOptions.items = Array.isArray(items) ? items : [];
        return openCaseGenDbStoreNewDrawer(nextOptions);
      },
      openCaseGenDbStoreAppendDrawerWithItems: function(items, options) {
        bindCaseGenDbStoreEvents();
        var nextOptions = options && typeof options === 'object' ? Object.assign({}, options) : {};
        nextOptions.items = Array.isArray(items) ? items : [];
        return openCaseGenDbStoreAppendDrawer(nextOptions);
      },
      renderAppendTargetOptions: renderAppendTargetOptions,
      getCaseListForModule: getCaseListForModule,
      exportSelectedCasesData: exportSelectedCasesData,
      exportAllModulesData: exportAllModulesData,
      exportSingleModuleData: exportSingleModuleData,
      filterCasesAgainstImported: filterCasesAgainstImported,
      appendSelectedCasesToImported: appendSelectedCasesToImported,
      transferSelectedCasesToExec: transferSelectedCasesToExec,
      refreshExportCaseGenXmindButton: refreshExportCaseGenXmindButton,
    };
  }

  window.app = window.app || {};
  window.app.casesGenCore = { init: init };
})();
