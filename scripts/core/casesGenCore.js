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
    var caseGenDbStoreProjectSelect = document.getElementById('caseGenDbStoreProjectSelect');
    var caseGenDbStoreVersionSelect = document.getElementById('caseGenDbStoreVersionSelect');
    var caseGenDbStoreCaseFileRow = document.getElementById('caseGenDbStoreCaseFileRow');
    var caseGenDbStoreCaseFileSelect = document.getElementById('caseGenDbStoreCaseFileSelect');
    var caseGenDbStoreConfirmBtn = document.getElementById('caseGenDbStoreConfirmBtn');
    var caseGenDbStoreStatus = document.getElementById('caseGenDbStoreStatus');
    var caseGenDbStoreDrawer = null;
    var caseGenRequirementDrawerHint = document.getElementById('caseGenRequirementDrawerHint');
    var caseGenRequirementDrawerInput = document.getElementById('caseGenRequirementDrawerInput');
    var caseGenRequirementDrawerConfirmBtn = document.getElementById('caseGenRequirementDrawerConfirmBtn');
    var caseGenRequirementDrawerCancelBtn = document.getElementById('caseGenRequirementDrawerCancelBtn');
    var caseGenRequirementDrawerStatus = document.getElementById('caseGenRequirementDrawerStatus');
    var caseGenRequirementDrawer = null;
    var caseGenRequirementDrawerExternal = null;
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
    var caseGenModuleGenerateDrawer = null;
    var caseGenActionDrawerTitle = document.getElementById('caseGenActionDrawerTitle');
    var caseGenActionDrawerHint = document.getElementById('caseGenActionDrawerHint');
    var caseGenActionDrawerRequirementSummary = document.getElementById('caseGenActionDrawerRequirementSummary');
    var caseGenActionDrawerConfirmBtn = document.getElementById('caseGenActionDrawerConfirmBtn');
    var caseGenActionDrawerStatus = document.getElementById('caseGenActionDrawerStatus');
    var caseGenActionDrawer = null;
    var exportCaseGenXmindBtn = dom.exportCaseGenXmindBtn || dom.exportCaseGenXmind;
    var caseGenAllGenerateBtn = document.getElementById('caseGenAllGenerateBtn');
    var caseGenAllTopupBtn = document.getElementById('caseGenAllTopupBtn');
    var caseGenSuggestionGenerateBtn = document.getElementById('caseGenSuggestionGenerateBtn');
    var caseGenSettingsTabBtn = document.getElementById('caseGenSettingsTabBtn');
    var caseGenModulesTabBtn = document.getElementById('caseGenModulesTabBtn');
    var casegenSettingsPanel = document.getElementById('casegenSettingsPanel');
    var casegenModulesPanel = document.getElementById('casegenModulesPanel');
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
    var caseGenViewDrawer = null;
    var activeCaseViewModuleId = '';
    var ALL_CASE_VIEW_ID = '__casegen_all__';
    var pendingCaseGenDbStoreAction = '';
    var pendingCaseGenActionContext = null;
    var pendingCaseGenModuleGenerateState = null;
    var caseGenActionDrawerDraftSettings = null;

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

    function ensureDbStoreState() {
      if (!state.caseGenDbStore || typeof state.caseGenDbStore !== 'object') {
        state.caseGenDbStore = {
          mode: '',
          newAction: '',
          loading: false,
          confirming: false,
          projects: [],
          versionsByProject: {},
          caseFilesByProject: {},
          projectId: '',
          versionId: '',
          caseFileId: '',
        };
      }
      return state.caseGenDbStore;
    }

    function ensureXmindCaseGenState() {
      if (!state.xmindCaseGen || typeof state.xmindCaseGen !== 'object') {
        state.xmindCaseGen = {
          mode: 'modules',
          treeSourceSignature: '',
          hasModuleSkeleton: false,
          hasImportedBaseline: false,
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

    function isDbStoreReady() {
      return Boolean(
        apiClient &&
        typeof apiClient.listProjects === 'function' &&
        typeof apiClient.listProjectVersions === 'function' &&
        typeof apiClient.listCaseFiles === 'function' &&
        typeof apiClient.importCaseFile === 'function'
      );
    }

    function ensureCaseGenDbStoreDrawer() {
      if (caseGenDbStoreDrawer) return caseGenDbStoreDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      caseGenDbStoreDrawer = window.app.drawer.createDrawer({
        drawerId: 'caseGenDbStoreDrawer',
        closeButtons: ['closeCaseGenDbStoreDrawerBtn'],
        onClose: function() {
          var st = ensureDbStoreState();
          st.loading = false;
          st.confirming = false;
          st.mode = '';
          st.projectId = '';
          st.versionId = '';
          st.caseFileId = '';
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '', '');
          syncCaseGenDbStoreControls();
        },
      });
      return caseGenDbStoreDrawer;
    }

    function ensureCaseGenRequirementDrawer() {
      if (caseGenRequirementDrawer) return caseGenRequirementDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      caseGenRequirementDrawer = window.app.drawer.createDrawer({
        drawerId: 'caseGenRequirementDrawer',
        closeButtons: ['closeCaseGenRequirementDrawerBtn'],
        onClose: function() {
          if (caseGenRequirementDrawerInput && caseGenRequirementDrawerInput.classList) {
            caseGenRequirementDrawerInput.classList.remove('input-invalid');
          }
          if (caseGenRequirementDrawerStatus) setStatus(caseGenRequirementDrawerStatus, '', '');
          if (caseGenRequirementDrawerExternal && typeof caseGenRequirementDrawerExternal.resolve === 'function') {
            var ext = caseGenRequirementDrawerExternal;
            caseGenRequirementDrawerExternal = null;
            try { ext.resolve(''); } catch (err) {}
          }
        },
      });

      function resolveExternal(text, shouldClose) {
        if (caseGenRequirementDrawerExternal && typeof caseGenRequirementDrawerExternal.resolve === 'function') {
          var ext = caseGenRequirementDrawerExternal;
          caseGenRequirementDrawerExternal = null;
          try { ext.resolve(text || ''); } catch (err) {}
        }
        if (shouldClose && caseGenRequirementDrawer && typeof caseGenRequirementDrawer.close === 'function') {
          caseGenRequirementDrawer.close();
        }
      }

      if (caseGenRequirementDrawerConfirmBtn) {
        caseGenRequirementDrawerConfirmBtn.addEventListener('click', function() {
          if (!caseGenRequirementDrawerInput) {
            resolveExternal('', true);
            return;
          }
          var raw = String(caseGenRequirementDrawerInput.value || '').trim();
          var normalized = normalizeRequirementName(raw);
          if (!normalized) {
            if (caseGenRequirementDrawerStatus) setStatus(caseGenRequirementDrawerStatus, '请填写需求标识（不可为空）', 'warn');
            if (caseGenRequirementDrawerInput.classList) caseGenRequirementDrawerInput.classList.add('input-invalid');
            try { caseGenRequirementDrawerInput.focus(); } catch (_) {}
            return;
          }
          if (normalized.length > 20) {
            if (caseGenRequirementDrawerStatus) setStatus(caseGenRequirementDrawerStatus, '需求标识最长 20 个汉字（或 20 个字符）', 'warn');
            if (caseGenRequirementDrawerInput.classList) caseGenRequirementDrawerInput.classList.add('input-invalid');
            try { caseGenRequirementDrawerInput.focus(); } catch (_) {}
            return;
          }
          if (caseGenRequirementDrawerInput.classList) caseGenRequirementDrawerInput.classList.remove('input-invalid');
          setRequirementLabel(normalized, 'manual');
          resolveExternal(normalized, true);
        });
      }
      if (caseGenRequirementDrawerCancelBtn) {
        caseGenRequirementDrawerCancelBtn.addEventListener('click', function() {
          resolveExternal('', true);
        });
      }
      return caseGenRequirementDrawer;
    }

    function syncCaseGenActionDrawerSummary() {
      if (!caseGenActionDrawerRequirementSummary) return;
      var settings = normalizeCaseGenPromptSettings(caseGenActionDrawerDraftSettings || ensureCaseGenSettings());
      caseGenActionDrawerRequirementSummary.textContent = describeCaseGenPromptSettings(settings, '未填写，将按默认要求生成。');
    }

    function findCaseGenModule(moduleId) {
      if (!moduleId || !Array.isArray(state.caseGenModules)) return null;
      for (var i = 0; i < state.caseGenModules.length; i += 1) {
        var mod = state.caseGenModules[i];
        if (mod && String(mod.id || '') === String(moduleId)) return mod;
      }
      return null;
    }

    function formatCaseGenModuleField(value) {
      if (Array.isArray(value)) {
        var list = value.map(function(item) { return stringifyCaseField(item || ''); }).filter(Boolean);
        return list.length ? list.join('、') : '未填写';
      }
      var text = stringifyCaseField(value || '');
      return text || '未填写';
    }

    function describeCaseGenPromptSettings(settingsSource, emptyText) {
      var settings = normalizeCaseGenPromptSettings(settingsSource || {});
      var labels = [];
      var customRequirement = stringifyCaseField(settings.customRequirement || '');
      var specialNames = [];
      if (customRequirement) labels.push('额外要求：' + customRequirement);
      if (settings.needFunctionCondition) labels.push('考虑功能使用条件');
      if (settings.needNumericValidation) labels.push('数值验证');
      if (settings.needBoundary) labels.push('考虑边界');
      if (settings.needMobile) labels.push('考虑移动设备操作');
      if (settings.needSpecial) {
        if (settings.specialRepeatOperation) specialNames.push('重复操作');
        if (settings.specialMultiTouch) specialNames.push('多点触控');
        if (settings.specialRepeatExecution) specialNames.push('重复执行');
        if (settings.specialWeakNetwork) specialNames.push('弱网');
        if (settings.specialInterruptResume) specialNames.push('中断恢复');
        labels.push(specialNames.length ? ('特殊场景：' + specialNames.join(' / ')) : '考虑特殊场景');
      }
      return labels.length ? labels.join('；') : (emptyText || '未填写，将按默认要求生成。');
    }

    function normalizeCaseGenActionContext(context) {
      var source = context && typeof context === 'object' ? context : {};
      if (source.type === 'settings') {
        return {
          type: 'settings',
          action: 'settings',
        };
      }
      if (source.type === 'module-local') {
        return {
          type: 'module-local',
          action: 'generate',
          moduleId: String(source.moduleId || ''),
        };
      }
      return {
        type: 'batch',
        action: source.action === 'topup' ? 'topup' : (source.action === 'suggested' ? 'suggested' : 'generate'),
      };
    }

    function getCaseGenActionMeta(context) {
      var ctxMeta = normalizeCaseGenActionContext(context);
      if (ctxMeta.type === 'settings') {
        return {
          action: 'settings',
          title: '生成要求确认',
          hint: '在这里维护当前 XMind 用例生成与全模块生成共用的额外要求；保存后不会立即触发生成。',
          confirmText: '保存要求',
        };
      }
      if (ctxMeta.type === 'module-local') {
        var moduleInfo = findCaseGenModule(ctxMeta.moduleId);
        var moduleTitle = resolveModuleTitle(moduleInfo && (moduleInfo.title || moduleInfo.module));
        return {
          action: 'generate',
          title: '模块独立生成确认',
          hint: '当前只对【' + moduleTitle + '】生效；以下额外要求仅用于这一次生成，不会写入全局设置，也不会被其他模块复用。',
          confirmText: '确认并生成',
        };
      }
      if (ctxMeta.action === 'topup') {
        return {
          action: 'topup',
          title: '全模块补全生成确认',
          hint: '请填写本轮额外要求，并确认是否需要考虑边界、移动端和特殊场景；确认后再执行全模块补全生成。',
          confirmText: '确认并补全',
        };
      }
      if (ctxMeta.action === 'suggested') {
        return {
          action: 'suggested',
          title: '仅补全用例确认',
          hint: '请填写本轮额外要求，并确认是否需要考虑边界、移动端和特殊场景；确认后只执行填写了生成建议的模块。',
          confirmText: '确认并执行',
        };
      }
      return {
        action: 'generate',
        title: '全模块直接生成确认',
        hint: '请填写本轮额外要求，并确认是否需要考虑边界、移动端和特殊场景；确认后再执行全模块直接生成。',
        confirmText: '确认并生成',
      };
    }

    function runCaseGenBatchAction(action) {
      if (action === 'topup') return topUpAllCaseGenModules();
      if (action === 'suggested') return generateSuggestedCaseGenModules();
      return generateAllCaseGenModules();
    }

    function executeCaseGenActionContext(context, promptSettingsSnapshot) {
      var ctxMeta = normalizeCaseGenActionContext(context);
      if (ctxMeta.type === 'settings') {
        applyCaseGenPromptSettings(normalizeCaseGenPromptSettings(promptSettingsSnapshot || createEmptyCaseGenPromptSettings()));
        return true;
      }
      if (ctxMeta.type === 'module-local') {
        if (!ctxMeta.moduleId) return false;
        return generateCasesForModule(ctxMeta.moduleId, {
          promptSettingsSnapshot: normalizeCaseGenPromptSettings(promptSettingsSnapshot || createEmptyCaseGenPromptSettings()),
        });
      }
      setCaseGenViewTab('modules');
      return runCaseGenBatchAction(ctxMeta.action);
    }

    function normalizeCaseGenModuleDrawerTab(tab) {
      if (tab === 'local' || tab === 'topup') return tab;
      return 'global';
    }

    function createCaseGenModuleGenerateState(moduleId) {
      return {
        moduleId: String(moduleId || ''),
        activeTab: 'global',
        localSettings: createEmptyCaseGenPromptSettings(),
        topupSuggestion: getModuleSuggestion(moduleId),
      };
    }

    function setCaseGenModuleSuggestionDraft(moduleId, value, persist) {
      if (!moduleId) return;
      if (!state.caseGenSuggestions || typeof state.caseGenSuggestions !== 'object') {
        state.caseGenSuggestions = {};
      }
      state.caseGenSuggestions[moduleId] = String(value || '');
      var suggestionArea = casesGenerationContainer && casesGenerationContainer.querySelector('textarea[data-suggestion="' + moduleId + '"]');
      if (suggestionArea) suggestionArea.value = state.caseGenSuggestions[moduleId];
      if (persist === true) {
        persistWorkflowState();
      }
      renderCaseGenProgressBoard();
      refreshCaseGenBatchButtons();
    }

    function syncCaseGenModuleLocalSpecialOptionsState(settingsSource) {
      var settings = normalizeCaseGenPromptSettings(settingsSource || {});
      var enabled = settings.needSpecial === true;
      var inputs = [
        caseGenModuleLocalSpecialRepeatOperationEl,
        caseGenModuleLocalSpecialMultiTouchEl,
        caseGenModuleLocalSpecialRepeatExecutionEl,
        caseGenModuleLocalSpecialWeakNetworkEl,
        caseGenModuleLocalSpecialInterruptResumeEl,
      ];
      if (caseGenModuleLocalSpecialOptionsEl && caseGenModuleLocalSpecialOptionsEl.classList) {
        caseGenModuleLocalSpecialOptionsEl.classList.toggle('is-disabled', !enabled);
      }
      inputs.forEach(function(input) {
        if (!input) return;
        input.disabled = !enabled;
      });
    }

    function syncCaseGenModuleLocalInputs(settingsSource) {
      var settings = normalizeCaseGenPromptSettings(settingsSource || {});
      if (caseGenModuleLocalRequirementEl) caseGenModuleLocalRequirementEl.value = settings.customRequirement || '';
      if (caseGenModuleLocalNeedFunctionConditionEl) caseGenModuleLocalNeedFunctionConditionEl.checked = settings.needFunctionCondition === true;
      if (caseGenModuleLocalNeedNumericValidationEl) caseGenModuleLocalNeedNumericValidationEl.checked = settings.needNumericValidation === true;
      if (caseGenModuleLocalNeedBoundaryEl) caseGenModuleLocalNeedBoundaryEl.checked = settings.needBoundary === true;
      if (caseGenModuleLocalNeedMobileEl) caseGenModuleLocalNeedMobileEl.checked = settings.needMobile === true;
      if (caseGenModuleLocalNeedSpecialEl) caseGenModuleLocalNeedSpecialEl.checked = settings.needSpecial === true;
      if (caseGenModuleLocalSpecialRepeatOperationEl) caseGenModuleLocalSpecialRepeatOperationEl.checked = settings.specialRepeatOperation === true;
      if (caseGenModuleLocalSpecialMultiTouchEl) caseGenModuleLocalSpecialMultiTouchEl.checked = settings.specialMultiTouch === true;
      if (caseGenModuleLocalSpecialRepeatExecutionEl) caseGenModuleLocalSpecialRepeatExecutionEl.checked = settings.specialRepeatExecution === true;
      if (caseGenModuleLocalSpecialWeakNetworkEl) caseGenModuleLocalSpecialWeakNetworkEl.checked = settings.specialWeakNetwork === true;
      if (caseGenModuleLocalSpecialInterruptResumeEl) caseGenModuleLocalSpecialInterruptResumeEl.checked = settings.specialInterruptResume === true;
      syncCaseGenModuleLocalSpecialOptionsState(settings);
    }

    function setCaseGenModuleLocalSettingValue(key, value) {
      if (!pendingCaseGenModuleGenerateState) return null;
      var settings = pendingCaseGenModuleGenerateState.localSettings || createEmptyCaseGenPromptSettings();
      if (key === 'customRequirement') {
        settings.customRequirement = String(value || '');
      } else {
        settings[key] = value === true;
        if (key === 'needSpecial' && value !== true) {
          settings.specialRepeatOperation = false;
          settings.specialMultiTouch = false;
          settings.specialRepeatExecution = false;
          settings.specialWeakNetwork = false;
          settings.specialInterruptResume = false;
        }
      }
      pendingCaseGenModuleGenerateState.localSettings = normalizeCaseGenPromptSettings(settings);
      syncCaseGenModuleLocalInputs(pendingCaseGenModuleGenerateState.localSettings);
      return pendingCaseGenModuleGenerateState.localSettings;
    }

    function getCaseGenModuleGenerateHasResult(moduleId) {
      return getCaseListForModule(moduleId).length > 0;
    }

    function setCaseGenModuleGenerateDrawerTab(tab) {
      var normalizedTab = normalizeCaseGenModuleDrawerTab(tab);
      var moduleState = pendingCaseGenModuleGenerateState;
      var moduleId = moduleState && moduleState.moduleId ? moduleState.moduleId : '';
      var hasResult = moduleId ? getCaseGenModuleGenerateHasResult(moduleId) : false;
      if (moduleState) {
        moduleState.activeTab = normalizedTab;
      }
      if (caseGenModuleGenerateGlobalTabBtn && caseGenModuleGenerateGlobalTabBtn.classList) {
        caseGenModuleGenerateGlobalTabBtn.classList.toggle('is-active', normalizedTab === 'global');
        caseGenModuleGenerateGlobalTabBtn.setAttribute('aria-selected', normalizedTab === 'global' ? 'true' : 'false');
      }
      if (caseGenModuleGenerateLocalTabBtn && caseGenModuleGenerateLocalTabBtn.classList) {
        caseGenModuleGenerateLocalTabBtn.classList.toggle('is-active', normalizedTab === 'local');
        caseGenModuleGenerateLocalTabBtn.setAttribute('aria-selected', normalizedTab === 'local' ? 'true' : 'false');
      }
      if (caseGenModuleGenerateTopupTabBtn && caseGenModuleGenerateTopupTabBtn.classList) {
        caseGenModuleGenerateTopupTabBtn.classList.toggle('is-active', normalizedTab === 'topup');
        caseGenModuleGenerateTopupTabBtn.setAttribute('aria-selected', normalizedTab === 'topup' ? 'true' : 'false');
      }
      if (caseGenModuleGenerateGlobalPanel && caseGenModuleGenerateGlobalPanel.classList) {
        caseGenModuleGenerateGlobalPanel.classList.toggle('is-active', normalizedTab === 'global');
      }
      if (caseGenModuleGenerateLocalPanel && caseGenModuleGenerateLocalPanel.classList) {
        caseGenModuleGenerateLocalPanel.classList.toggle('is-active', normalizedTab === 'local');
      }
      if (caseGenModuleGenerateTopupPanel && caseGenModuleGenerateTopupPanel.classList) {
        caseGenModuleGenerateTopupPanel.classList.toggle('is-active', normalizedTab === 'topup');
      }
      if (normalizedTab === 'global') {
        if (caseGenModuleGenerateDrawerHint) {
          caseGenModuleGenerateDrawerHint.textContent = '当前模块将直接沿用已确认的全局生成配置；模块自身的测试场景、测试要点、耦合模块与生成建议仍会照常参与本次生成。';
        }
      } else if (normalizedTab === 'local') {
        if (caseGenModuleGenerateDrawerHint) {
          caseGenModuleGenerateDrawerHint.textContent = '当前模块可单独配置本次生成要求；该配置优先于全局，但只在这一次生效，不会写回全局设置。';
        }
        syncCaseGenModuleLocalInputs(moduleState && moduleState.localSettings ? moduleState.localSettings : createEmptyCaseGenPromptSettings());
      } else {
        if (caseGenModuleGenerateDrawerHint) {
          caseGenModuleGenerateDrawerHint.textContent = '补全生成只使用当前模块的生成建议与已有用例，不继承全局或独立配置勾选。';
        }
        if (caseGenModuleTopupSuggestionEl) {
          caseGenModuleTopupSuggestionEl.value = moduleState ? String(moduleState.topupSuggestion || '') : '';
        }
        if (caseGenModuleTopupHint) {
          caseGenModuleTopupHint.textContent = hasResult
            ? '补全生成会在当前模块已有用例基础上，结合这里的生成建议补充新增用例。'
            : '当前模块暂无已生成用例，无法执行补全生成；请先通过“全局配置优先”或“独立配置优先”生成用例。';
        }
        if (caseGenModuleGenerateTopupConfirmBtn) {
          caseGenModuleGenerateTopupConfirmBtn.disabled = !hasResult;
        }
      }
      if (normalizedTab !== 'topup' && caseGenModuleGenerateTopupConfirmBtn) {
        caseGenModuleGenerateTopupConfirmBtn.disabled = !hasResult;
      }
      if (caseGenModuleGenerateDrawerStatus) setStatus(caseGenModuleGenerateDrawerStatus, '', '');
    }

    function syncCaseGenModuleGenerateDrawer(moduleId) {
      var mod = findCaseGenModule(moduleId);
      if (!mod) return false;
      if (!pendingCaseGenModuleGenerateState || pendingCaseGenModuleGenerateState.moduleId !== String(moduleId || '')) {
        pendingCaseGenModuleGenerateState = createCaseGenModuleGenerateState(moduleId);
      }
      if (caseGenModuleGenerateDrawerTitle) caseGenModuleGenerateDrawerTitle.textContent = '模块生成方式确认';
      if (caseGenModuleGenerateDrawerModuleTitle) {
        caseGenModuleGenerateDrawerModuleTitle.textContent = resolveModuleTitle(mod.title || mod.module || '');
      }
      if (caseGenModuleGenerateDrawerScenarios) {
        caseGenModuleGenerateDrawerScenarios.textContent = formatCaseGenModuleField(mod.scenarios);
      }
      if (caseGenModuleGenerateDrawerPoints) {
        caseGenModuleGenerateDrawerPoints.textContent = formatCaseGenModuleField(mod.points);
      }
      if (caseGenModuleGenerateDrawerCoupled) {
        caseGenModuleGenerateDrawerCoupled.textContent = formatCaseGenModuleField(mod.coupled);
      }
      if (caseGenModuleGenerateDrawerGlobalSummary) {
        caseGenModuleGenerateDrawerGlobalSummary.textContent = describeCaseGenPromptSettings(
          createCaseGenPromptSettingsSnapshot(),
          '当前全局生成配置将按共享设置执行，可切换到全局页签查看或调整。'
        );
      }
      syncCaseGenModuleLocalInputs(pendingCaseGenModuleGenerateState.localSettings);
      if (caseGenModuleTopupSuggestionEl) {
        caseGenModuleTopupSuggestionEl.value = String(pendingCaseGenModuleGenerateState.topupSuggestion || '');
      }
      setCaseGenModuleGenerateDrawerTab(pendingCaseGenModuleGenerateState.activeTab || 'global');
      return true;
    }

    function ensureCaseGenModuleGenerateDrawer() {
      if (caseGenModuleGenerateDrawer) return caseGenModuleGenerateDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      caseGenModuleGenerateDrawer = window.app.drawer.createDrawer({
        drawerId: 'caseGenModuleGenerateDrawer',
        closeButtons: ['closeCaseGenModuleGenerateDrawerBtn'],
        onOpen: function() {
          if (pendingCaseGenModuleGenerateState && pendingCaseGenModuleGenerateState.moduleId) {
            syncCaseGenModuleGenerateDrawer(pendingCaseGenModuleGenerateState.moduleId);
          }
        },
        onClose: function() {
          pendingCaseGenModuleGenerateState = null;
          if (caseGenModuleGenerateDrawerStatus) setStatus(caseGenModuleGenerateDrawerStatus, '', '');
        },
      });
      if (caseGenModuleGenerateGlobalTabBtn) {
        caseGenModuleGenerateGlobalTabBtn.addEventListener('click', function() {
          setCaseGenModuleGenerateDrawerTab('global');
        });
      }
      if (caseGenModuleGenerateLocalTabBtn) {
        caseGenModuleGenerateLocalTabBtn.addEventListener('click', function() {
          setCaseGenModuleGenerateDrawerTab('local');
        });
      }
      if (caseGenModuleGenerateTopupTabBtn) {
        caseGenModuleGenerateTopupTabBtn.addEventListener('click', function() {
          setCaseGenModuleGenerateDrawerTab('topup');
        });
      }
      if (caseGenModuleLocalRequirementEl) {
        caseGenModuleLocalRequirementEl.addEventListener('input', function() {
          setCaseGenModuleLocalSettingValue('customRequirement', caseGenModuleLocalRequirementEl.value || '');
        });
      }
      if (caseGenModuleLocalNeedFunctionConditionEl) {
        caseGenModuleLocalNeedFunctionConditionEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('needFunctionCondition', caseGenModuleLocalNeedFunctionConditionEl.checked === true);
        });
      }
      if (caseGenModuleLocalNeedNumericValidationEl) {
        caseGenModuleLocalNeedNumericValidationEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('needNumericValidation', caseGenModuleLocalNeedNumericValidationEl.checked === true);
        });
      }
      if (caseGenModuleLocalNeedBoundaryEl) {
        caseGenModuleLocalNeedBoundaryEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('needBoundary', caseGenModuleLocalNeedBoundaryEl.checked === true);
        });
      }
      if (caseGenModuleLocalNeedMobileEl) {
        caseGenModuleLocalNeedMobileEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('needMobile', caseGenModuleLocalNeedMobileEl.checked === true);
        });
      }
      if (caseGenModuleLocalNeedSpecialEl) {
        caseGenModuleLocalNeedSpecialEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('needSpecial', caseGenModuleLocalNeedSpecialEl.checked === true);
        });
      }
      if (caseGenModuleLocalSpecialRepeatOperationEl) {
        caseGenModuleLocalSpecialRepeatOperationEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('specialRepeatOperation', caseGenModuleLocalSpecialRepeatOperationEl.checked === true);
        });
      }
      if (caseGenModuleLocalSpecialMultiTouchEl) {
        caseGenModuleLocalSpecialMultiTouchEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('specialMultiTouch', caseGenModuleLocalSpecialMultiTouchEl.checked === true);
        });
      }
      if (caseGenModuleLocalSpecialRepeatExecutionEl) {
        caseGenModuleLocalSpecialRepeatExecutionEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('specialRepeatExecution', caseGenModuleLocalSpecialRepeatExecutionEl.checked === true);
        });
      }
      if (caseGenModuleLocalSpecialWeakNetworkEl) {
        caseGenModuleLocalSpecialWeakNetworkEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('specialWeakNetwork', caseGenModuleLocalSpecialWeakNetworkEl.checked === true);
        });
      }
      if (caseGenModuleLocalSpecialInterruptResumeEl) {
        caseGenModuleLocalSpecialInterruptResumeEl.addEventListener('change', function() {
          setCaseGenModuleLocalSettingValue('specialInterruptResume', caseGenModuleLocalSpecialInterruptResumeEl.checked === true);
        });
      }
      if (caseGenModuleTopupSuggestionEl) {
        caseGenModuleTopupSuggestionEl.addEventListener('input', function() {
          if (!pendingCaseGenModuleGenerateState) return;
          pendingCaseGenModuleGenerateState.topupSuggestion = String(caseGenModuleTopupSuggestionEl.value || '');
        });
      }
      if (caseGenModuleGenerateGlobalConfirmBtn) {
        caseGenModuleGenerateGlobalConfirmBtn.addEventListener('click', function() {
          var moduleState = pendingCaseGenModuleGenerateState;
          var moduleId = moduleState && moduleState.moduleId ? moduleState.moduleId : '';
          pendingCaseGenModuleGenerateState = null;
          if (caseGenModuleGenerateDrawer && typeof caseGenModuleGenerateDrawer.close === 'function') {
            caseGenModuleGenerateDrawer.close();
          }
          if (!moduleId) return;
          setTimeout(function() {
            generateCasesForModule(moduleId, {
              promptSettingsSnapshot: createCaseGenPromptSettingsSnapshot(),
            });
          }, 0);
        });
      }
      if (caseGenModuleGenerateLocalConfirmBtn) {
        caseGenModuleGenerateLocalConfirmBtn.addEventListener('click', function() {
          var moduleState = pendingCaseGenModuleGenerateState;
          var moduleId = moduleState && moduleState.moduleId ? moduleState.moduleId : '';
          var localSettings = moduleState && moduleState.localSettings
            ? normalizeCaseGenPromptSettings(moduleState.localSettings)
            : createEmptyCaseGenPromptSettings();
          pendingCaseGenModuleGenerateState = null;
          if (caseGenModuleGenerateDrawer && typeof caseGenModuleGenerateDrawer.close === 'function') {
            caseGenModuleGenerateDrawer.close();
          }
          if (!moduleId) return;
          setTimeout(function() {
            generateCasesForModule(moduleId, {
              promptSettingsSnapshot: localSettings,
            });
          }, 0);
        });
      }
      if (caseGenModuleGenerateTopupConfirmBtn) {
        caseGenModuleGenerateTopupConfirmBtn.addEventListener('click', function() {
          var moduleState = pendingCaseGenModuleGenerateState;
          var moduleId = moduleState && moduleState.moduleId ? moduleState.moduleId : '';
          var topupSuggestion = moduleState ? String(moduleState.topupSuggestion || '') : '';
          pendingCaseGenModuleGenerateState = null;
          if (caseGenModuleGenerateDrawer && typeof caseGenModuleGenerateDrawer.close === 'function') {
            caseGenModuleGenerateDrawer.close();
          }
          if (!moduleId) return;
          setCaseGenModuleSuggestionDraft(moduleId, topupSuggestion, true);
          setTimeout(function() {
            topUpCasesForModule(moduleId, {
              promptSettingsSnapshot: createEmptyCaseGenPromptSettings(),
            });
          }, 0);
        });
      }
      return caseGenModuleGenerateDrawer;
    }

    function ensureCaseGenActionDrawer() {
      if (caseGenActionDrawer) return caseGenActionDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      caseGenActionDrawer = window.app.drawer.createDrawer({
        drawerId: 'caseGenActionDrawer',
        closeButtons: ['closeCaseGenActionDrawerBtn', 'caseGenActionDrawerCancelBtn'],
        onOpen: function() {
          if (!caseGenActionDrawerDraftSettings) {
            caseGenActionDrawerDraftSettings = createEmptyCaseGenPromptSettings();
          }
          syncCaseGenPromptInputs(caseGenActionDrawerDraftSettings);
          syncCaseGenActionDrawerSummary();
          if (caseGenActionDrawerStatus) setStatus(caseGenActionDrawerStatus, '', '');
        },
        onClose: function() {
          pendingCaseGenActionContext = null;
          caseGenActionDrawerDraftSettings = null;
          syncCaseGenPromptInputs(ensureCaseGenSettings());
          if (caseGenActionDrawerStatus) setStatus(caseGenActionDrawerStatus, '', '');
        },
      });
      if (caseGenActionDrawerConfirmBtn) {
        caseGenActionDrawerConfirmBtn.addEventListener('click', function() {
          var context = normalizeCaseGenActionContext(pendingCaseGenActionContext);
          var promptSettingsSnapshot = null;
          pendingCaseGenActionContext = null;
          if (caseGenActionDrawerDraftSettings) {
            if (caseGenCustomRequirementEl) {
              caseGenActionDrawerDraftSettings.customRequirement = String(caseGenCustomRequirementEl.value || '');
            }
            promptSettingsSnapshot = normalizeCaseGenPromptSettings(caseGenActionDrawerDraftSettings);
            if (context.type === 'batch') {
              applyCaseGenPromptSettings(promptSettingsSnapshot);
            }
            caseGenActionDrawerDraftSettings = null;
          }
          if (caseGenActionDrawer && typeof caseGenActionDrawer.close === 'function') {
            caseGenActionDrawer.close();
          }
          setTimeout(function() {
            executeCaseGenActionContext(context, promptSettingsSnapshot);
          }, 0);
        });
      }
      return caseGenActionDrawer;
    }

    function openCaseGenActionDrawerByContext(context) {
      var normalizedContext = normalizeCaseGenActionContext(context);
      var meta = getCaseGenActionMeta(normalizedContext);
      var drawer = ensureCaseGenActionDrawer();
      if (!drawer || typeof drawer.open !== 'function') {
        return executeCaseGenActionContext(normalizedContext, createEmptyCaseGenPromptSettings());
      }
      pendingCaseGenActionContext = normalizedContext;
      caseGenActionDrawerDraftSettings = createEmptyCaseGenPromptSettings();
      if (caseGenActionDrawerTitle) caseGenActionDrawerTitle.textContent = meta.title;
      if (caseGenActionDrawerHint) caseGenActionDrawerHint.textContent = meta.hint;
      if (caseGenActionDrawerConfirmBtn) caseGenActionDrawerConfirmBtn.textContent = meta.confirmText;
      syncCaseGenPromptInputs(caseGenActionDrawerDraftSettings);
      syncCaseGenActionDrawerSummary();
      if (caseGenActionDrawerStatus) setStatus(caseGenActionDrawerStatus, '', '');
      drawer.open();
      return true;
    }

    function openCaseGenBatchActionDrawer(action) {
      return openCaseGenActionDrawerByContext({
        type: 'batch',
        action: action,
      });
    }

    function openCaseGenSettingsDrawer() {
      return openCaseGenActionDrawerByContext({
        type: 'settings',
      });
    }

    function openCaseGenModuleGenerateDrawer(moduleId) {
      var mod = findCaseGenModule(moduleId);
      if (!mod) {
        setStatus(caseGenStatus, '未找到对应模块，无法继续生成', 'warn');
        return false;
      }
      var drawer = ensureCaseGenModuleGenerateDrawer();
      if (!drawer || typeof drawer.open !== 'function') {
        return generateCasesForModule(moduleId, {
          promptSettingsSnapshot: createCaseGenPromptSettingsSnapshot(),
        });
      }
      pendingCaseGenModuleGenerateState = createCaseGenModuleGenerateState(moduleId);
      syncCaseGenModuleGenerateDrawer(moduleId);
      drawer.open();
      return true;
    }

    function promptRequirementLabelByDrawer(promptText) {
      var drawer = ensureCaseGenRequirementDrawer();
      if (!drawer || typeof drawer.open !== 'function') {
        return Promise.resolve(promptRequirementLabel(promptText));
      }
      if (window.app && window.app.drawer && typeof window.app.drawer.closeAllDrawers === 'function') {
        window.app.drawer.closeAllDrawers();
      }
      if (caseGenRequirementDrawerHint) {
        var suffix = '请填写本次需求名称，作为需求标识（不可为空）';
        var text = String(promptText || '').trim();
        caseGenRequirementDrawerHint.textContent = text ? (text + '；' + suffix) : suffix;
      }
      if (caseGenRequirementDrawerStatus) setStatus(caseGenRequirementDrawerStatus, '', '');
      if (caseGenRequirementDrawerInput) {
        if (caseGenRequirementDrawerInput.classList) caseGenRequirementDrawerInput.classList.remove('input-invalid');
        caseGenRequirementDrawerInput.value = getRequirementLabel(false) || '';
      }
      drawer.open();
      try {
        if (caseGenRequirementDrawerInput) caseGenRequirementDrawerInput.focus();
      } catch (_) {}
      return new Promise(function(resolve) {
        caseGenRequirementDrawerExternal = { resolve: resolve };
      });
    }

    function clearCaseGenDbStoreNewActionError() {
      if (caseGenStoreActionSelect && caseGenStoreActionSelect.classList) {
        caseGenStoreActionSelect.classList.remove('input-invalid');
      }
    }

    function markCaseGenDbStoreNewActionError() {
      if (caseGenStoreActionSelect && caseGenStoreActionSelect.classList) {
        caseGenStoreActionSelect.classList.add('input-invalid');
      }
    }

    function setCaseGenDbStoreNewAction(action) {
      var st = ensureDbStoreState();
      st.newAction = String(action || '');
      clearCaseGenDbStoreNewActionError();
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

    function cloneJsonValue(value, fallback) {
      if (value === undefined) return fallback;
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (err) {
        return fallback;
      }
    }

    function cloneSelectionSet(selection) {
      if (!selection || typeof selection.forEach !== 'function') return [];
      var result = [];
      selection.forEach(function(idx) {
        var num = Number(idx);
        if (Number.isFinite(num)) result.push(num);
      });
      return result;
    }

    function setPendingCaseGenDbStoreAction(action) {
      pendingCaseGenDbStoreAction = action ? String(action) : '';
    }

    function consumePendingCaseGenDbStoreAction() {
      var next = pendingCaseGenDbStoreAction;
      pendingCaseGenDbStoreAction = '';
      return next;
    }

    function ensureCaseGenDrawer() {
      if (caseGenViewDrawer) return caseGenViewDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      caseGenViewDrawer = window.app.drawer.createDrawer({
        drawerId: 'caseGenViewDrawer',
        closeButtons: ['closeCaseGenViewDrawerBtn'],
        onClose: function() {
          if (activeCaseViewModuleId) resetCaseViewButton(activeCaseViewModuleId);
          activeCaseViewModuleId = '';
          if (caseGenViewDrawerBody) caseGenViewDrawerBody.innerHTML = '';
          if (caseGenViewDrawerTitle) caseGenViewDrawerTitle.textContent = '用例视图';
          toggleCaseGenAllSelectButton(false);
          var pending = consumePendingCaseGenDbStoreAction();
          if (!pending) return;
          if (!hasSelectedGeneratedCases()) return;
          setTimeout(function() {
            if (pending === 'append') {
              openCaseGenDbStoreAppendDrawer();
            } else if (pending === 'new') {
              openCaseGenDbStoreNewDrawer();
            }
          }, 0);
        },
      });
      return caseGenViewDrawer;
    }

    function resetCaseViewButton(moduleId) {
      if (!casesGenerationContainer) return;
      var btn = casesGenerationContainer.querySelector('[data-view="' + moduleId + '"]');
      if (btn) btn.textContent = '用例视图';
    }

    function closeCaseViewIfActive(moduleId) {
      if (!activeCaseViewModuleId) return;
      if (moduleId && activeCaseViewModuleId !== moduleId) return;
      var drawer = ensureCaseGenDrawer();
      if (drawer) drawer.close();
    }

    function getCaseViewContainer(moduleId) {
      var selector = '[data-view-container="' + moduleId + '"]';
      var container = caseGenViewDrawerBody && caseGenViewDrawerBody.querySelector(selector);
      if (!container && casesGenerationContainer) container = casesGenerationContainer.querySelector(selector);
      if (!container && typeof document !== 'undefined') container = document.querySelector(selector);
      return container;
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

    function createDefaultCaseGenSettings() {
      return {
        activeTab: 'settings',
        storeMode: 'new',
        customRequirement: '',
        needFunctionCondition: true,
        needNumericValidation: true,
        needBoundary: false,
        needMobile: false,
        needSpecial: false,
        specialRepeatOperation: false,
        specialMultiTouch: false,
        specialRepeatExecution: false,
        specialWeakNetwork: false,
        specialInterruptResume: false,
      };
    }

    function normalizeCaseGenPromptSettings(raw) {
      var defaults = createDefaultCaseGenSettings();
      var source = raw && typeof raw === 'object' ? raw : {};
      return {
        customRequirement: source.customRequirement === undefined || source.customRequirement === null
          ? String(defaults.customRequirement || '')
          : String(source.customRequirement || ''),
        needFunctionCondition: source.needFunctionCondition === undefined
          ? defaults.needFunctionCondition === true
          : source.needFunctionCondition === true,
        needNumericValidation: source.needNumericValidation === undefined
          ? defaults.needNumericValidation === true
          : source.needNumericValidation === true,
        needBoundary: source.needBoundary === undefined
          ? defaults.needBoundary === true
          : source.needBoundary === true,
        needMobile: source.needMobile === undefined
          ? defaults.needMobile === true
          : source.needMobile === true,
        needSpecial: source.needSpecial === undefined
          ? defaults.needSpecial === true
          : source.needSpecial === true,
        specialRepeatOperation: source.specialRepeatOperation === undefined
          ? defaults.specialRepeatOperation === true
          : source.specialRepeatOperation === true,
        specialMultiTouch: source.specialMultiTouch === undefined
          ? defaults.specialMultiTouch === true
          : source.specialMultiTouch === true,
        specialRepeatExecution: source.specialRepeatExecution === undefined
          ? defaults.specialRepeatExecution === true
          : source.specialRepeatExecution === true,
        specialWeakNetwork: source.specialWeakNetwork === undefined
          ? defaults.specialWeakNetwork === true
          : source.specialWeakNetwork === true,
        specialInterruptResume: source.specialInterruptResume === undefined
          ? defaults.specialInterruptResume === true
          : source.specialInterruptResume === true,
      };
    }

    function ensureCaseGenSettings() {
      var defaults = createDefaultCaseGenSettings();
      if (!state.caseGenSettings || typeof state.caseGenSettings !== 'object') {
        state.caseGenSettings = defaults;
        return state.caseGenSettings;
      }
      Object.keys(defaults).forEach(function(key) {
        if (state.caseGenSettings[key] === undefined || state.caseGenSettings[key] === null) {
          state.caseGenSettings[key] = defaults[key];
        }
      });
      state.caseGenSettings.activeTab = state.caseGenSettings.activeTab === 'modules' ? 'modules' : 'settings';
      state.caseGenSettings.storeMode = state.caseGenSettings.storeMode === 'append' ? 'append' : 'new';
      state.caseGenSettings.customRequirement = String(state.caseGenSettings.customRequirement || '');
      state.caseGenSettings.needFunctionCondition = state.caseGenSettings.needFunctionCondition === true;
      state.caseGenSettings.needNumericValidation = state.caseGenSettings.needNumericValidation === true;
      state.caseGenSettings.needBoundary = state.caseGenSettings.needBoundary === true;
      state.caseGenSettings.needMobile = state.caseGenSettings.needMobile === true;
      state.caseGenSettings.needSpecial = state.caseGenSettings.needSpecial === true;
      state.caseGenSettings.specialRepeatOperation = state.caseGenSettings.specialRepeatOperation === true;
      state.caseGenSettings.specialMultiTouch = state.caseGenSettings.specialMultiTouch === true;
      state.caseGenSettings.specialRepeatExecution = state.caseGenSettings.specialRepeatExecution === true;
      state.caseGenSettings.specialWeakNetwork = state.caseGenSettings.specialWeakNetwork === true;
      state.caseGenSettings.specialInterruptResume = state.caseGenSettings.specialInterruptResume === true;
      return state.caseGenSettings;
    }

    function createCaseGenPromptSettingsSnapshot() {
      return normalizeCaseGenPromptSettings(ensureCaseGenSettings());
    }

    function createEmptyCaseGenPromptSettings() {
      return normalizeCaseGenPromptSettings({});
    }

    function syncCaseGenPromptInputs(settingsSource) {
      var settings = normalizeCaseGenPromptSettings(settingsSource || ensureCaseGenSettings());
      if (caseGenCustomRequirementEl) caseGenCustomRequirementEl.value = settings.customRequirement || '';
      if (caseGenNeedFunctionConditionEl) caseGenNeedFunctionConditionEl.checked = settings.needFunctionCondition === true;
      if (caseGenNeedNumericValidationEl) caseGenNeedNumericValidationEl.checked = settings.needNumericValidation === true;
      if (caseGenNeedBoundaryEl) caseGenNeedBoundaryEl.checked = settings.needBoundary === true;
      if (caseGenNeedMobileEl) caseGenNeedMobileEl.checked = settings.needMobile === true;
      if (caseGenNeedSpecialEl) caseGenNeedSpecialEl.checked = settings.needSpecial === true;
      if (caseGenSpecialRepeatOperationEl) caseGenSpecialRepeatOperationEl.checked = settings.specialRepeatOperation === true;
      if (caseGenSpecialMultiTouchEl) caseGenSpecialMultiTouchEl.checked = settings.specialMultiTouch === true;
      if (caseGenSpecialRepeatExecutionEl) caseGenSpecialRepeatExecutionEl.checked = settings.specialRepeatExecution === true;
      if (caseGenSpecialWeakNetworkEl) caseGenSpecialWeakNetworkEl.checked = settings.specialWeakNetwork === true;
      if (caseGenSpecialInterruptResumeEl) caseGenSpecialInterruptResumeEl.checked = settings.specialInterruptResume === true;
      syncCaseGenSpecialOptionsState(settings);
    }

    function applyCaseGenPromptSettings(settingsSource) {
      var settings = ensureCaseGenSettings();
      var normalized = normalizeCaseGenPromptSettings(settingsSource);
      settings.customRequirement = normalized.customRequirement;
      settings.needFunctionCondition = normalized.needFunctionCondition;
      settings.needNumericValidation = normalized.needNumericValidation;
      settings.needBoundary = normalized.needBoundary;
      settings.needMobile = normalized.needMobile;
      settings.needSpecial = normalized.needSpecial;
      settings.specialRepeatOperation = normalized.specialRepeatOperation;
      settings.specialMultiTouch = normalized.specialMultiTouch;
      settings.specialRepeatExecution = normalized.specialRepeatExecution;
      settings.specialWeakNetwork = normalized.specialWeakNetwork;
      settings.specialInterruptResume = normalized.specialInterruptResume;
      syncCaseGenPromptInputs(settings);
      persistWorkflowState();
      return settings;
    }

    function setCaseGenSettingValue(key, value) {
      var settings = ensureCaseGenSettings();
      if (key === 'customRequirement') {
        if (caseGenActionDrawerDraftSettings) {
          caseGenActionDrawerDraftSettings.customRequirement = String(value || '');
          syncCaseGenActionDrawerSummary();
          return caseGenActionDrawerDraftSettings;
        }
        settings.customRequirement = String(value || '');
        syncCaseGenActionDrawerSummary();
        persistWorkflowState();
        return settings;
      }
      if (
        key === 'needFunctionCondition' ||
        key === 'needNumericValidation' ||
        key === 'needBoundary' ||
        key === 'needMobile' ||
        key === 'needSpecial' ||
        key === 'specialRepeatOperation' ||
        key === 'specialMultiTouch' ||
        key === 'specialRepeatExecution' ||
        key === 'specialWeakNetwork' ||
        key === 'specialInterruptResume'
      ) {
        if (caseGenActionDrawerDraftSettings) {
          caseGenActionDrawerDraftSettings[key] = value === true;
          if (key === 'needSpecial' && value !== true) {
            caseGenActionDrawerDraftSettings.specialRepeatOperation = false;
            caseGenActionDrawerDraftSettings.specialMultiTouch = false;
            caseGenActionDrawerDraftSettings.specialRepeatExecution = false;
            caseGenActionDrawerDraftSettings.specialWeakNetwork = false;
            caseGenActionDrawerDraftSettings.specialInterruptResume = false;
            syncCaseGenPromptInputs(caseGenActionDrawerDraftSettings);
            return caseGenActionDrawerDraftSettings;
          }
          syncCaseGenSpecialOptionsState(caseGenActionDrawerDraftSettings);
          return caseGenActionDrawerDraftSettings;
        }
        settings[key] = value === true;
        if (key === 'needSpecial' && value !== true) {
          settings.specialRepeatOperation = false;
          settings.specialMultiTouch = false;
          settings.specialRepeatExecution = false;
          settings.specialWeakNetwork = false;
          settings.specialInterruptResume = false;
          syncCaseGenPromptInputs(settings);
          persistWorkflowState();
          return settings;
        }
        syncCaseGenSpecialOptionsState(settings);
        persistWorkflowState();
        return settings;
      }
      settings[key] = value;
      persistWorkflowState();
      return settings;
    }

    function syncCaseGenSpecialOptionsState(settingsSource) {
      var settings = normalizeCaseGenPromptSettings(settingsSource || caseGenActionDrawerDraftSettings || ensureCaseGenSettings());
      var enabled = settings.needSpecial === true;
      var inputs = [
        caseGenSpecialRepeatOperationEl,
        caseGenSpecialMultiTouchEl,
        caseGenSpecialRepeatExecutionEl,
        caseGenSpecialWeakNetworkEl,
        caseGenSpecialInterruptResumeEl,
      ];
      if (caseGenSpecialOptionsEl && caseGenSpecialOptionsEl.classList) {
        caseGenSpecialOptionsEl.classList.toggle('is-disabled', !enabled);
      }
      inputs.forEach(function(input) {
        if (!input) return;
        input.disabled = !enabled;
      });
    }

    function setCaseGenViewTab(tab, options) {
      var settings = ensureCaseGenSettings();
      var next = tab === 'modules' ? 'modules' : 'settings';
      var changed = settings.activeTab !== next;
      settings.activeTab = next;
      if (caseGenSettingsTabBtn && caseGenSettingsTabBtn.classList) {
        caseGenSettingsTabBtn.classList.toggle('is-active', next === 'settings');
        caseGenSettingsTabBtn.setAttribute('aria-selected', next === 'settings' ? 'true' : 'false');
      }
      if (caseGenModulesTabBtn && caseGenModulesTabBtn.classList) {
        caseGenModulesTabBtn.classList.toggle('is-active', next === 'modules');
        caseGenModulesTabBtn.setAttribute('aria-selected', next === 'modules' ? 'true' : 'false');
      }
      if (casegenSettingsPanel && casegenSettingsPanel.classList) {
        casegenSettingsPanel.classList.toggle('is-active', next === 'settings');
      }
      if (casegenModulesPanel && casegenModulesPanel.classList) {
        casegenModulesPanel.classList.toggle('is-active', next === 'modules');
      }
      if (changed && (!options || options.persist !== false)) {
        persistWorkflowState();
      }
    }

    function setCaseGenStoreMode(mode, options) {
      var settings = ensureCaseGenSettings();
      var next = mode === 'append' ? 'append' : 'new';
      var changed = settings.storeMode !== next;
      settings.storeMode = next;
      if (caseGenStoreModeNewBtn && caseGenStoreModeNewBtn.classList) {
        caseGenStoreModeNewBtn.classList.toggle('is-active', next === 'new');
        caseGenStoreModeNewBtn.setAttribute('aria-selected', next === 'new' ? 'true' : 'false');
      }
      if (caseGenStoreModeAppendBtn && caseGenStoreModeAppendBtn.classList) {
        caseGenStoreModeAppendBtn.classList.toggle('is-active', next === 'append');
        caseGenStoreModeAppendBtn.setAttribute('aria-selected', next === 'append' ? 'true' : 'false');
      }
      if (caseGenStoreModeNewPanel && caseGenStoreModeNewPanel.classList) {
        caseGenStoreModeNewPanel.classList.toggle('is-active', next === 'new');
      }
      if (caseGenStoreModeAppendPanel && caseGenStoreModeAppendPanel.classList) {
        caseGenStoreModeAppendPanel.classList.toggle('is-active', next === 'append');
      }
      if (changed && (!options || options.persist !== false)) {
        persistWorkflowState();
      }
    }

    function getCaseGenPromptComponents(settingsOverride) {
      var settings = normalizeCaseGenPromptSettings(settingsOverride || ensureCaseGenSettings());
      var parts = [];
      var customRequirement = stringifyCaseField(settings.customRequirement || '');
      if (customRequirement) {
        parts.push('用户附加要求：' + customRequirement);
      }
      if (settings.needFunctionCondition) {
        parts.push('生成时需要考虑功能使用条件，覆盖功能或系统的解锁条件、可用条件、身份或等级门槛、资源消耗、前置任务和使用时间限制等。');
      }
      if (settings.needNumericValidation) {
        parts.push('生成时需要考虑数值验证，覆盖数值显示、取值范围、阈值变化、计算结果、累计或扣减和结算正确性等。');
      }
      if (settings.needBoundary) {
        parts.push('生成时需要考虑边界场景，覆盖数值上下限、临界条件、空值、满值、阈值切换和异常边界。');
      }
      if (settings.needMobile) {
        parts.push('生成时需要考虑移动设备操作，覆盖点击、长按、滑动、拖拽、横竖屏切换和系统手势干扰等手机交互场景。');
      }
      if (settings.needSpecial) {
        parts.push('生成时需要考虑特殊场景，补充异常路径、非理想环境和非常规用户操作下的用例。');
        if (settings.specialRepeatOperation) {
          parts.push('特殊场景需包含重复操作，例如连续点击、重复领取、重复提交、重复进入或重复处理。');
        }
        if (settings.specialMultiTouch) {
          parts.push('特殊场景需包含多点触控，例如双指缩放、双指拖拽、误触连击和多点同时操作。');
        }
        if (settings.specialRepeatExecution) {
          parts.push('特殊场景需包含重复执行，例如反复进入退出、重复触发流程、重复执行同一任务后的稳定性。');
        }
        if (settings.specialWeakNetwork) {
          parts.push('特殊场景需包含弱网环境，例如高延迟、丢包、断续连接、请求超时和重试恢复。');
        }
        if (settings.specialInterruptResume) {
          parts.push('特殊场景需包含中断恢复，例如来电、切后台、锁屏、应用重启后的恢复与状态一致性。');
        }
      }
      return parts;
    }

    function buildCaseGenPrompt(basePrompt, settingsOverride) {
      var prompt = stringifyCaseField(basePrompt || '');
      var parts = getCaseGenPromptComponents(settingsOverride);
      return [prompt].concat(parts).filter(Boolean).join('\n\n');
    }

    function resolveModuleTitle(name) {
      var text = stringifyCaseField(name || '');
      return text || '未命名模块';
    }

    function normalizeModuleKey(name) {
      var text = stringifyCaseField(name || '');
      return text ? text.toLowerCase() : '未命名模块';
    }

    function normalizeCaseTitle(title) {
      var text = stringifyCaseField(title || '');
      return text ? text.toLowerCase() : '';
    }

    function normalizeCaseListWithModules(list) {
      var normalized = [];
      var buckets = {};
      if (!Array.isArray(list)) return { normalized: normalized, buckets: buckets };
      list.forEach(function(item) {
        if (!item || typeof item !== 'object') return;
        var moduleTitle = resolveModuleTitle(item.module || item.module_name || item['模块']);
        var moduleKey = normalizeModuleKey(moduleTitle);
        var cloned = Object.assign({}, item);
        cloned.module = moduleTitle;
        normalized.push(cloned);
        if (!buckets[moduleKey]) buckets[moduleKey] = { title: moduleTitle, list: [] };
        buckets[moduleKey].list.push(cloned);
      });
      return { normalized: normalized, buckets: buckets };
    }

    function computeAppendTargetOptions() {
      var options = [{ value: '', label: '未选择' }];
      var requirementLabel = getRequirementLabel(true) || '';
      var targetName = stringifyCaseField(requirementLabel).toLowerCase();
      var workflowEntries = Array.isArray(state.importedCases) ? state.importedCases : [];
      var workflowOptions = [];
      workflowEntries.forEach(function(entry, idx) {
        var list = Array.isArray(entry && entry.list) ? entry.list : [];
        if (!list.length && deriveCaseListFromText && entry && entry.text) {
          list = deriveCaseListFromText(entry.text);
        }
        if (!list || !list.length) return;
        workflowOptions.push({
          value: 'workflow:' + (entry.id || entry.name || ('wf-' + idx)),
          label: stringifyCaseField(entry.name) || '功能流程导入用例',
        });
      });
      var hasWorkflowCases = workflowOptions.length > 0;
      var execCandidates = (getTempExecFiles() || []).filter(function(file) {
        return file && Array.isArray(file.cases) && file.cases.length;
      });
      if (!hasWorkflowCases) {
        var importedExec = execCandidates.filter(function(file) { return file && file.fromImport === true; });
        execCandidates = importedExec.length ? importedExec : execCandidates;
        if (!execCandidates.length) return options;
      }
      if (hasWorkflowCases) {
        workflowOptions.forEach(function(opt) { options.push(opt); });
        if (options.length > 1) return options;
      }
      if (!execCandidates.length) return options;
      var exact = [];
      var similar = [];
      execCandidates.forEach(function(file) {
        var name = stringifyCaseField(file && file.name);
        var normName = name.toLowerCase();
        if (targetName && normName === targetName) {
          exact.push(file);
        } else if (targetName && (normName.indexOf(targetName) !== -1 || targetName.indexOf(normName) !== -1)) {
          similar.push(file);
        }
      });
      var chosen = exact.length ? exact : (similar.length ? similar : execCandidates);
      chosen.forEach(function(file) {
        options.push({
          value: 'exec:' + file.id,
          label: stringifyCaseField(file.name) || '执行用例',
        });
      });
      return options;
    }

    function hasValidAppendTargetSelection() {
      if (!appendTargetSelect) return false;
      var val = appendTargetSelect.value || '';
      var opts = appendTargetSelect.options || [];
      if (!opts.length) return false;
      if (!val) return false;
      return true;
    }

    function renderAppendTargetOptions() {
      if (!appendTargetSelect) return;
      var opts = computeAppendTargetOptions();
      appendTargetSelect.innerHTML = opts.map(function(opt) {
        return '<option value="' + escapeHtml(opt.value) + '">' + escapeHtml(opt.label) + '</option>';
      }).join('');
      var desired = state.caseGenAppendTarget || '';
      var hasDesired = opts.some(function(opt) { return opt.value === desired; });
      appendTargetSelect.value = hasDesired ? desired : '';
      state.caseGenAppendTarget = appendTargetSelect.value || '';
      refreshAppendExistingButton();
    }

    function collectAdditionsForBuckets(buckets, selectedEntries) {
      var additions = [];
      var duplicateCount = 0;
      var moduleCount = 0;
      selectedEntries.forEach(function(entry) {
        var bucketKey = entry.moduleKey;
        var bucket = buckets[bucketKey];
        if (!bucket) {
          bucket = { title: entry.moduleTitle, list: [] };
          buckets[bucketKey] = bucket;
        }
        moduleCount += 1;
        var existingTitleSet = new Set();
        bucket.list.forEach(function(item) {
          var key = normalizeCaseTitle(item.title || item.case_title || item['用例标题']);
          if (key) existingTitleSet.add(key);
        });
        entry.cases.forEach(function(item) {
          var titleKey = normalizeCaseTitle(item.title || item.case_title || item['用例标题']);
          if (titleKey && existingTitleSet.has(titleKey)) {
            duplicateCount += 1;
            return;
          }
          var mergedItem = Object.assign({}, item);
          mergedItem.module = resolveModuleTitle(bucket.title || entry.moduleTitle);
          additions.push(mergedItem);
          bucket.list.push(mergedItem);
          if (titleKey) existingTitleSet.add(titleKey);
        });
      });
      return { additions: additions, duplicateCount: duplicateCount, moduleCount: moduleCount };
    }

    function promptTempExecTarget(candidates) {
      if (!candidates || !candidates.length) return null;
      var lines = candidates.map(function(file, idx) {
        var req = normalizeRequirementName(file && file.requirement) || '未标识需求';
        var count = file && file.cases && file.cases.length ? file.cases.length : 0;
        return (idx + 1) + '：' + (file && file.name ? file.name : '用例') + '（需求：' + req + '，' + count + ' 条）';
      });
      var input = window.prompt('请选择要追加的用例执行文件编号：\n' + lines.join('\n'), '1');
      if (input === null) return null;
      var index = Number(input);
      if (!Number.isFinite(index) || index < 1 || index > candidates.length) return null;
      return candidates[index - 1];
    }

    function normalizeExecCaseList(list, fileId) {
      if (typeof normalizeTempExecCases === 'function') {
        return normalizeTempExecCases(list, fileId);
      }
      return list;
    }

    function hasExecutionData(file) {
      if (!file || !Array.isArray(file.cases)) return false;
      return file.cases.some(function(item) {
        if (!item) return false;
        var actual = item.actual || '';
        var remark = item.remark || '';
        var hasDefect = item.defectLinks && item.defectLinks.length;
        var hasReuse = item.reuseDetails && item.reuseDetails.length;
        return (actual && actual !== '未执行') || remark || hasDefect || hasReuse;
      });
    }

    function convertCaseForExec(item, fileId, idx, existing) {
      var merged = Object.assign({}, item || {});
      merged.module = resolveModuleTitle(merged.module || (existing && existing.module));
      if (existing && existing.id) {
        merged.id = existing.id;
      } else {
        merged.id = merged.id || (fileId ? (fileId + '-' + idx) : ('case-' + idx));
      }
      if (existing) {
        merged.actual = existing.actual || '未执行';
        merged.remark = existing.remark || '';
        merged.reuseDetails = Array.isArray(existing.reuseDetails) ? existing.reuseDetails.slice() : [];
        merged.defectLinks = Array.isArray(existing.defectLinks) ? existing.defectLinks.slice() : [];
      } else {
        merged.actual = merged.actual || '未执行';
        merged.remark = merged.remark || '';
        merged.reuseDetails = Array.isArray(merged.reuseDetails) ? merged.reuseDetails : [];
        merged.defectLinks = Array.isArray(merged.defectLinks) ? merged.defectLinks : [];
      }
      return merged;
    }

    function chunkArray(list, size) {
      if (!Array.isArray(list) || !list.length) return [];
      var chunkSize = Math.max(1, size || 5);
      var result = [];
      for (var i = 0; i < list.length; i += chunkSize) {
        result.push(list.slice(i, i + chunkSize));
      }
      return result;
    }

    function resolveCaseGenBatchConcurrency(count) {
      if (!Number.isFinite(count) || count <= 0) return 1;
      return Math.max(1, Math.min(5, Math.round(count)));
    }

    function resolveCaseSimilarityConcurrency(count) {
      if (!Number.isFinite(count) || count <= 0) return 1;
      return Math.max(1, Math.min(5, Math.round(count)));
    }

    function resolveCaseGenTimeoutSec() {
      var raw = state && state.settings ? Number(state.settings.timeoutSec) : NaN;
      var fallback = 300;
      if (!Number.isFinite(raw) || raw <= 0) return fallback;
      var normalized = Math.round(raw);
      if (!Number.isFinite(normalized) || normalized <= 0) return fallback;
      return Math.max(30, Math.min(1800, normalized));
    }

    function callCaseGenModelWithGuard(executor) {
      var task = typeof executor === 'function' ? executor : null;
      if (!task) return Promise.reject(new Error('模型调用任务不可用'));
      var timeoutSec = resolveCaseGenTimeoutSec();
      var timeoutMs = timeoutSec * 1000 + 1500;
      var timer = null;
      return new Promise(function(resolve, reject) {
        var settled = false;
        function finishError(err) {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          reject(err);
        }
        function finishOk(data) {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          resolve(data);
        }
        timer = setTimeout(function() {
          finishError(new Error('模型调用超时（超过 ' + timeoutSec + ' 秒），请重试或检查服务状态'));
        }, timeoutMs);
        Promise.resolve().then(function() {
          return task();
        }).then(function(result) {
          finishOk(result);
        }).catch(function(err) {
          finishError(err);
        });
      });
    }

    function parseGeneratedCases(content) {
      var unwrap = unwrapRequirementPayload(content);
      var normalized = typeof unwrap.payload === 'string'
        ? unwrap.payload
        : unwrap.payload
        ? JSON.stringify(unwrap.payload, null, 2)
        : '';
      normalized = (normalized || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/&nbsp;/gi, ' ');
      var parsed = [];
      var hadRecovery = false;
      try {
        parsed = JSON.parse(normalized || '[]');
        if (!Array.isArray(parsed)) parsed = [];
        if (parsed.length) normalized = JSON.stringify(parsed, null, 2);
      } catch (err) {
        parsed = extractJsonObjects(normalized);
        if (parsed.length) {
          normalized = JSON.stringify(parsed, null, 2);
          hadRecovery = true;
        }
      }
      return { parsed: parsed, normalized: normalized, hadRecovery: hadRecovery };
    }

    function renderCaseTable(mod, list, options) {
      options = options || {};
      var selectable = Boolean(options.selectable);
      var moduleId = options.moduleId || '';
      var includeRemark = Boolean(options.showRemark);
      var selection = moduleId ? ensureCaseSelectionSet(moduleId) : new Set();
      var toolbar = selectable
        ? '<div class="caseview-toolbar">' +
            '<button class="secondary" data-export-selected="' + moduleId + '" ' + (selection.size ? '' : 'disabled') + '>导出所选用例</button>' +
            '<button class="secondary" data-xmind-selected="' + moduleId + '" ' + (selection.size ? '' : 'disabled') + '>转 XMind</button>' +
          '</div>'
        : '';
      var headerCheckbox = selectable ? '<th class="check"><input type="checkbox" data-case-select-all="' + moduleId + '"></th>' : '';
      var indexHeader = '<th class="index">编号</th>';
      var remarkHeader = includeRemark ? '<th class="remark">备注</th>' : '';
      var rows = list.map(function(item, idx) {
        var moduleTitle = mod && mod.title ? mod.title : '';
        var moduleName = item.module || moduleTitle || item.module_name || item['模块'] || '模块' + (idx + 1);
        var title = stringifyCaseField(item.title || item.case_title || moduleName);
        var priority = stringifyCaseField(item.priority || item.level);
        var preconditions = stringifyCaseField(item.preconditions || item.precondition);
        var steps = stringifyCaseField(item.steps || item.actions);
        var expected = stringifyCaseField(item.expected || item.result);
        var checkboxCell = selectable
          ? '<td class="check"><input type="checkbox" data-case-select="' + moduleId + '" data-index="' + idx + '" ' + (selection.has(idx) ? 'checked' : '') + '></td>'
          : '';
        var indexCell = '<td class="index">' + (idx + 1) + '</td>';
        var remarkCell = includeRemark ? '<td class="remark">' + escapeHtml(item.remark || '') + '</td>' : '';
        return '' +
          '<tr>' +
            checkboxCell +
            indexCell +
            '<td class="module">' + escapeHtml(moduleName || '-') + '</td>' +
            '<td class="title">' + escapeHtml(title || '-') + '</td>' +
            '<td>' + escapeHtml(priority || '-') + '</td>' +
            '<td>' + escapeHtml((preconditions || '-').replace(/\n/g, '<br>')) + '</td>' +
            '<td>' + escapeHtml((steps || '-').replace(/\n/g, '<br>')) + '</td>' +
            '<td>' + escapeHtml((expected || '-').replace(/\n/g, '<br>')) + '</td>' +
            remarkCell +
          '</tr>';
      }).join('');
      var baseCols = 7 + (selectable ? 1 : 0) + (includeRemark ? 1 : 0);
      var emptyRow = '<tr><td colspan="' + baseCols + '">未解析到有效用例</td></tr>';
      return '' +
        '<table class="table-view">' +
          '<thead>' +
            '<tr>' +
              headerCheckbox +
              indexHeader +
              '<th class="module">模块</th>' +
              '<th class="title">用例标题</th>' +
              '<th>优先级</th>' +
              '<th>前提条件</th>' +
              '<th>操作步骤</th>' +
              '<th>预期结果</th>' +
              remarkHeader +
            '</tr>' +
          '</thead>' +
          '<tbody>' + (rows || emptyRow) + '</tbody>' +
        '</table>' +
        toolbar;
    }

    function updateSupplementButtons(moduleId, hasResult) {
      if (!casesGenerationContainer) return;
      var transferBtn = casesGenerationContainer.querySelector('[data-tempexec="' + moduleId + '"]');
      var busy = isCaseModuleRunning(moduleId);
      var selection = state.caseSelections[moduleId];
      var hasSelection = selection && selection.size > 0;
      var transferDisabled = !hasResult || busy || !hasSelection;
      if (transferBtn) transferBtn.disabled = transferDisabled;
    }

    function ensureCaseSelectionSet(moduleId) {
      if (!state.caseSelections[moduleId]) {
        state.caseSelections[moduleId] = new Set();
      }
      return state.caseSelections[moduleId];
    }

    function refreshCaseSelectionUI(moduleId) {
      var container = getCaseViewContainer(moduleId);
      if (!container) return;
      var selection = ensureCaseSelectionSet(moduleId);
      var rowCheckboxes = container.querySelectorAll('input[data-case-select="' + moduleId + '"]');
      rowCheckboxes.forEach(function(cb) {
        cb.checked = selection.has(Number(cb.dataset.index));
      });
      var master = container.querySelector('input[data-case-select-all="' + moduleId + '"]');
      if (master) {
        var total = rowCheckboxes.length;
        master.checked = total > 0 && selection.size === total;
        master.indeterminate = selection.size > 0 && selection.size < total;
      }
      var exportBtn = container.querySelector('button[data-export-selected="' + moduleId + '"]');
      if (exportBtn) exportBtn.disabled = selection.size === 0;
      var xmindBtn = container.querySelector('button[data-xmind-selected="' + moduleId + '"]');
      if (xmindBtn) xmindBtn.disabled = selection.size === 0;
      applyCaseGenSelectionHint(moduleId);
      refreshAppendExistingButton();
      refreshExportCaseGenXmindButton();
    }

    function hasSelectedGeneratedCases() {
      if (!state.caseGenModules || !state.caseGenModules.length) return false;
      for (var i = 0; i < state.caseGenModules.length; i += 1) {
        var mod = state.caseGenModules[i];
        var selection = state.caseSelections[mod.id];
        if (!selection || !selection.size) continue;
        var list = getCaseListForModule(mod.id);
        var raw = state.caseGenResults && state.caseGenResults[mod.id];
        var trimmed = raw && raw.trim ? raw.trim() : '';
        if (list.length) {
          var matched = false;
          selection.forEach(function(idx) {
            if (!matched && list[idx]) matched = true;
          });
          if (matched) return true;
        } else if (trimmed) {
          return true;
        }
      }
      return false;
    }

    function hasGeneratedCases() {
      if (!state.caseGenModules || !state.caseGenModules.length) return false;
      for (var i = 0; i < state.caseGenModules.length; i += 1) {
        var mod = state.caseGenModules[i];
        var list = getCaseListForModule(mod.id);
        if (list && list.length) return true;
      }
      return false;
    }

    function hasRunningCaseModules() {
      if (!state.caseGenModules || !state.caseGenModules.length) return false;
      for (var i = 0; i < state.caseGenModules.length; i += 1) {
        var mod = state.caseGenModules[i];
        if (mod && mod.id && isCaseModuleRunning(mod.id)) return true;
      }
      return false;
    }

    function buildCaseGenModuleMeta() {
      var meta = [];
      if (!Array.isArray(state.caseGenModules)) return meta;
      state.caseGenModules.forEach(function(mod) {
        if (!mod || !mod.id) return;
        var title = resolveModuleTitle(mod.title || mod.module || '');
        var list = getCaseListForModule(mod.id);
        var running = isCaseModuleRunning(mod.id);
        var suggestion = getModuleSuggestion(mod.id);
        if (!running && state.caseGenRunning instanceof Set) {
          if (state.caseGenRunning.has(mod.id)) {
            running = true;
          } else if (state.caseGenRunning.has(String(mod.id))) {
            running = true;
          } else {
            var numericId = Number(mod.id);
            if (Number.isFinite(numericId) && state.caseGenRunning.has(numericId)) {
              running = true;
            }
          }
        }
        if (!running) {
          var statusInfo = ensureCaseModuleStatusState()[mod.id];
          var statusText = statusInfo && statusInfo.text ? String(statusInfo.text) : '';
          if (statusText.indexOf('生成中') !== -1 || statusText.indexOf('补全中') !== -1) {
            running = true;
          }
        }
        meta.push({
          id: mod.id,
          title: title,
          hasResult: Boolean(list && list.length),
          hasSuggestion: Boolean(suggestion),
          running: running,
        });
      });
      return meta;
    }

    function listGeneratedCaseGenModuleTitles(meta) {
      return (meta || []).filter(function(entry) {
        return entry && entry.hasResult;
      }).map(function(entry) {
        return entry.title;
      });
    }

    function refreshCaseGenBatchButtons() {
      if (!caseGenAllGenerateBtn) caseGenAllGenerateBtn = document.getElementById('caseGenAllGenerateBtn');
      if (!caseGenAllTopupBtn) caseGenAllTopupBtn = document.getElementById('caseGenAllTopupBtn');
      if (!caseGenSuggestionGenerateBtn) caseGenSuggestionGenerateBtn = document.getElementById('caseGenSuggestionGenerateBtn');
      if (!caseGenAllGenerateBtn && !caseGenAllTopupBtn && !caseGenSuggestionGenerateBtn) return;
      var meta = buildCaseGenModuleMeta();
      var hasGenerateTarget = false;
      var hasTopupTarget = false;
      var hasSuggestionTarget = false;
      var allRunning = meta.length > 0;
      meta.forEach(function(entry) {
        if (!entry) return;
        if (!entry.running) {
          hasGenerateTarget = true;
          if (entry.hasResult) hasTopupTarget = true;
          if (entry.hasSuggestion) hasSuggestionTarget = true;
          allRunning = false;
        }
      });
      if (caseGenAllGenerateBtn) caseGenAllGenerateBtn.disabled = !meta.length || !hasGenerateTarget || allRunning;
      if (caseGenAllTopupBtn) caseGenAllTopupBtn.disabled = !meta.length || !hasTopupTarget || allRunning;
      if (caseGenSuggestionGenerateBtn) caseGenSuggestionGenerateBtn.disabled = !meta.length || !hasSuggestionTarget || allRunning;
    }

    function refreshAppendExistingButton() {
      var hasGenerated = hasGeneratedCases();
      if (caseGenStoreNewBtn) caseGenStoreNewBtn.disabled = !hasGenerated || !isDbStoreReady();
      if (caseGenStoreAppendBtn) caseGenStoreAppendBtn.disabled = !hasGenerated || !isDbStoreReady();
      refreshExportCaseGenXmindButton();
    }

    function confirmCaseGenBatchOverwrite(actionLabel, moduleNames) {
      if (!moduleNames.length) return Promise.resolve(true);
      var nameText = moduleNames.join('、');
      var label = actionLabel || '生成';
      var message = '检测到以下模块已有生成数据：' + nameText + '。继续将覆盖已有生成数据并执行全模块' + label + '，是否继续？';
      return openConfirmDrawer({
        title: '确认全模块' + label,
        message: message,
        confirmText: '继续' + label,
        cancelText: '取消',
        previousDrawer: resolveCaseGenActiveDrawer(),
      }).then(function(res) {
        return Boolean(res && res.ok === true);
      });
    }

    function runCaseGenBatch(action) {
      var meta = buildCaseGenModuleMeta();
      var actionLabel = action === 'topup' ? '补全生成' : '直接生成';
      if (!meta.length) {
        setStatus(caseGenStatus, '请先在“测试模块拆分”中生成模块', 'warn');
        return Promise.resolve(false);
      }
      var allRunning = meta.length > 0 && meta.every(function(entry) { return entry && entry.running; });
      if (allRunning) {
        setStatus(caseGenStatus, '全部模块正在生成中，无法执行全模块' + actionLabel, 'warn');
        return Promise.resolve(false);
      }
      if (action === 'topup') {
        var hasTopupTarget = meta.some(function(entry) {
          return entry && entry.hasResult && !entry.running;
        });
        if (!hasTopupTarget) {
          setStatus(caseGenStatus, '暂无可补全的模块，无法执行全模块' + actionLabel, 'warn');
          return Promise.resolve(false);
        }
      } else {
        var hasGenerateTarget = meta.some(function(entry) {
          return entry && !entry.running;
        });
        if (!hasGenerateTarget) {
          setStatus(caseGenStatus, '暂无可生成的模块，无法执行全模块' + actionLabel, 'warn');
          return Promise.resolve(false);
        }
      }
      var generatedModules = listGeneratedCaseGenModuleTitles(meta);
      return confirmCaseGenBatchOverwrite(actionLabel, generatedModules).then(function(ok) {
        if (!ok) {
          setStatus(caseGenStatus, '已取消全模块' + actionLabel, 'warn');
          return false;
        }
        var candidates = [];
        if (action === 'topup') {
          candidates = meta.filter(function(entry) {
            return entry && entry.hasResult && !entry.running;
          });
        } else if (generatedModules.length) {
          candidates = meta.filter(function(entry) { return entry && !entry.running; });
        } else {
          candidates = meta.filter(function(entry) {
            return entry && !entry.hasResult && !entry.running;
          });
        }
        if (!candidates.length) {
          var emptyMsg = action === 'topup' ? '暂无可补全的模块' : '暂无可生成的模块';
          setStatus(caseGenStatus, emptyMsg, 'warn');
          return false;
        }
        var skipped = meta.filter(function(entry) { return entry && entry.running; }).length;
        var concurrency = resolveCaseGenBatchConcurrency(candidates.length);
        var caseGenPromptValue = state.assignments && state.assignments.caseGenPrompt ? state.assignments.caseGenPrompt.trim() : '';
        var promptBase = caseGenPromptValue || defaultPrompts.casegen || '';
        var promptSettingsSnapshot = createCaseGenPromptSettingsSnapshot();
        var hint = '已触发全模块' + actionLabel + '（' + candidates.length + '个模块，并发 ' + concurrency + '）';
        if (skipped) hint += '，已跳过' + skipped + '个生成中的模块';
        setStatus(caseGenStatus, hint, 'ok');
        return runConcurrent(candidates, concurrency, function(entry) {
          if (!entry || !entry.id) return Promise.resolve(false);
          var runTask = action === 'topup' ? topUpCasesForModule : generateCasesForModule;
          return Promise.resolve().then(function() {
            return runTask(entry.id, {
              promptBase: promptBase,
              promptSettingsSnapshot: promptSettingsSnapshot,
            });
          }).catch(function(err) {
            var title = entry && entry.title ? String(entry.title) : '当前模块';
            var msg = err && err.message ? err.message : '未知异常';
            console.error('全模块' + actionLabel + '执行异常', err);
            setCaseModuleStatus(entry.id, '【' + title + '】' + actionLabel + '失败：' + msg, 'err');
            setCaseModuleRunning(entry.id, false);
            return false;
          });
        });
      });
    }

    function generateAllCaseGenModules() {
      return runCaseGenBatch('generate');
    }

    function topUpAllCaseGenModules() {
      return runCaseGenBatch('topup');
    }

    function generateSuggestedCaseGenModules() {
      var meta = buildCaseGenModuleMeta();
      if (!meta.length) {
        setStatus(caseGenStatus, '请先在“测试模块拆分”中生成模块', 'warn');
        return Promise.resolve(false);
      }
      var candidates = meta.filter(function(entry) {
        return entry && entry.hasSuggestion && !entry.running;
      });
      if (!candidates.length) {
        setStatus(caseGenStatus, '暂无包含生成建议的模块可执行仅补全用例', 'warn');
        return Promise.resolve(false);
      }
      var skipped = meta.filter(function(entry) {
        return entry && entry.hasSuggestion && entry.running;
      }).length;
      var concurrency = resolveCaseGenBatchConcurrency(candidates.length);
      var caseGenPromptValue = state.assignments && state.assignments.caseGenPrompt ? state.assignments.caseGenPrompt.trim() : '';
      var promptBase = caseGenPromptValue || defaultPrompts.casegen || '';
      var promptSettingsSnapshot = createCaseGenPromptSettingsSnapshot();
      var hint = '已触发仅补全用例（' + candidates.length + '个模块，并发 ' + concurrency + '）';
      if (skipped) hint += '，已跳过' + skipped + '个生成中的模块';
      setStatus(caseGenStatus, hint, 'ok');
      return runConcurrent(candidates, concurrency, function(entry) {
        if (!entry || !entry.id) return Promise.resolve(false);
        return Promise.resolve().then(function() {
          return generateCasesForModule(entry.id, {
            promptBase: promptBase,
            promptSettingsSnapshot: promptSettingsSnapshot,
          });
        }).catch(function(err) {
          var title = entry && entry.title ? String(entry.title) : '当前模块';
          var msg = err && err.message ? err.message : '未知异常';
          console.error('仅补全用例执行异常', err);
          setCaseModuleStatus(entry.id, '【' + title + '】仅补全用例失败：' + msg, 'err');
          setCaseModuleRunning(entry.id, false);
          return false;
        });
      });
    }

    function buildCaseItemPayloadFromGenerated(item, fallbackModule) {
      if (!item) return null;
      var module = String(item.module || fallbackModule || '').trim();
      var title = String(item.title || '').trim();
      var expected = String(item.expected || '').trim();
      if (!module || !title || !expected) return null;
      var priority = item.priority ? String(item.priority).trim() : '';
      var pre = item.precondition !== undefined ? item.precondition : item.preconditions;
      var preText = pre === null || pre === undefined ? '' : String(pre);
      var stepsRaw = item.steps;
      var stepsText = '';
      if (Array.isArray(stepsRaw)) {
        stepsText = stepsRaw.map(function(s) { return String(s || '').trim(); }).filter(Boolean).join('\n');
      } else if (stepsRaw !== null && stepsRaw !== undefined) {
        stepsText = String(stepsRaw);
      }
      var remark = item.remark ? String(item.remark).trim() : '';
      return {
        module: module,
        title: title,
        expected: expected,
        priority: priority || null,
        precondition: preText.trim() ? preText.trim() : null,
        steps: stepsText.trim() ? stepsText.trim() : null,
        remark: remark || null,
      };
    }

    function collectDbStoreSelectedItems() {
      var selectedEntries = collectSelectedCaseEntries();
      var items = [];
      selectedEntries.forEach(function(entry) {
        var moduleTitle = entry && entry.moduleTitle ? String(entry.moduleTitle) : '';
        var cases = entry && Array.isArray(entry.cases) ? entry.cases : [];
        cases.forEach(function(it) {
          var payload = buildCaseItemPayloadFromGenerated(it, moduleTitle);
          if (payload) items.push(payload);
        });
      });
      return items;
    }

    function ensureCaseGenSelectionHintState() {
      if (!state.caseGenSelectionHints || typeof state.caseGenSelectionHints !== 'object') {
        state.caseGenSelectionHints = {};
      }
      return state.caseGenSelectionHints;
    }

    function setCaseGenSelectionHint(moduleId, enabled) {
      if (!moduleId) return;
      var map = ensureCaseGenSelectionHintState();
      if (enabled) map[moduleId] = true;
      else delete map[moduleId];
      applyCaseGenSelectionHint(moduleId);
    }

    function applyCaseGenSelectionHint(moduleId) {
      var container = getCaseViewContainer(moduleId);
      if (!container || !container.classList) return;
      var map = ensureCaseGenSelectionHintState();
      var selection = state.caseSelections[moduleId];
      var hasSelection = selection && selection.size > 0;
      var shouldShow = Boolean(map[moduleId] && !hasSelection);
      container.classList.toggle('caseview-selection-hint', shouldShow);
    }

    function clearAllCaseGenSelectionHints() {
      var map = ensureCaseGenSelectionHintState();
      var cleared = false;
      for (var key in map) {
        if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
        delete map[key];
        cleared = true;
      }
      if (cleared && Array.isArray(state.caseGenModules)) {
        state.caseGenModules.forEach(function(mod) {
          if (mod && mod.id) applyCaseGenSelectionHint(mod.id);
        });
      }
    }

    function setCaseGenSelectionHintsForAllModules() {
      var map = ensureCaseGenSelectionHintState();
      for (var key in map) {
        if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
        delete map[key];
      }
      if (!Array.isArray(state.caseGenModules)) return;
      state.caseGenModules.forEach(function(mod) {
        if (!mod || !mod.id) return;
        var list = getCaseListForModule(mod.id);
        if (list && list.length) map[mod.id] = true;
      });
      state.caseGenModules.forEach(function(mod) {
        if (mod && mod.id) applyCaseGenSelectionHint(mod.id);
      });
    }

    function getCaseGenAllSelectionStats() {
      var items = collectGeneratedModules();
      var total = 0;
      var selected = 0;
      items.forEach(function(entry) {
        var list = entry.list || [];
        var selection = state.caseSelections[entry.mod.id];
        total += list.length;
        if (selection && selection.size) {
          selection.forEach(function(idx) {
            if (list[idx]) selected += 1;
          });
        }
      });
      return { total: total, selected: selected, moduleCount: items.length };
    }

    function toggleCaseGenAllSelectButton(show) {
      if (!caseGenAllSelectBtn || !caseGenAllSelectBtn.classList) return;
      caseGenAllSelectBtn.classList.toggle('hidden', !show);
    }

    function updateCaseGenAllSelectionButton() {
      var buttons = [];
      if (caseGenAllSelectBtn) buttons.push(caseGenAllSelectBtn);
      if (caseGenViewDrawerBody) {
        var innerBtn = caseGenViewDrawerBody.querySelector('[data-case-select-all-modules]');
        if (innerBtn) buttons.push(innerBtn);
      }
      if (!buttons.length) return;
      var stats = getCaseGenAllSelectionStats();
      var hintMap = ensureCaseGenSelectionHintState();
      var hasHint = false;
      for (var key in hintMap) {
        if (Object.prototype.hasOwnProperty.call(hintMap, key)) {
          hasHint = true;
          break;
        }
      }
      var disabled = stats.total === 0;
      var text = stats.total > 0 && stats.selected >= stats.total
        ? '取消全选所有模块用例'
        : '全选所有模块用例';
      buttons.forEach(function(btn) {
        btn.disabled = disabled;
        btn.textContent = text;
        if (btn.classList) btn.classList.toggle('casegen-select-all-hint', hasHint);
      });
    }

    function findFirstGeneratedModuleId() {
      if (!state.caseGenModules || !state.caseGenModules.length) return '';
      for (var i = 0; i < state.caseGenModules.length; i += 1) {
        var mod = state.caseGenModules[i];
        var list = getCaseListForModule(mod.id);
        if (list && list.length) return mod.id;
      }
      return '';
    }

    function collectGeneratedModules() {
      var modules = [];
      if (!Array.isArray(state.caseGenModules)) return modules;
      state.caseGenModules.forEach(function(mod) {
        if (!mod || !mod.id) return;
        var list = getCaseListForModule(mod.id);
        if (list && list.length) modules.push({ mod: mod, list: list });
      });
      return modules;
    }

    function openCaseViewForModule(moduleId) {
      if (!moduleId) return false;
      var drawer = ensureCaseGenDrawer();
      if (!drawer || !drawer.element) return false;
      var drawerEl = drawer.element;
      var isOpenCurrent = drawerEl.classList.contains('open') && activeCaseViewModuleId === moduleId;
      if (isOpenCurrent) return true;
      toggleCaseView(moduleId);
      return true;
    }

    function openCaseGenAllView(options) {
      options = options || {};
      var withHint = Boolean(options.selectionHint);
      var forceOpen = Boolean(options.force);
      if (hasRunningCaseModules() && hasGeneratedCases()) {
        setStatus(caseGenStatus, '当前仍有用例生成中，请等待生成完毕后再查看全模块用例视图', 'warn');
        return { opened: false, blocked: true };
      }
      var drawer = ensureCaseGenDrawer();
      if (!drawer || !drawer.element || !caseGenViewDrawerBody) return { opened: false, blocked: false };
      var drawerEl = drawer.element;
      var isOpenAll = drawerEl.classList.contains('open') && activeCaseViewModuleId === ALL_CASE_VIEW_ID;
      if (isOpenAll && !forceOpen) {
        drawer.close();
        return { opened: false, blocked: false };
      }
      if (activeCaseViewModuleId && activeCaseViewModuleId !== ALL_CASE_VIEW_ID) {
        resetCaseViewButton(activeCaseViewModuleId);
      }
      activeCaseViewModuleId = ALL_CASE_VIEW_ID;
      var items = collectGeneratedModules();
      if (!items.length) {
        caseGenViewDrawerBody.innerHTML = '' +
          '<div class="caseview drawer-view visible caseview-all-section">' +
            '<p class="hint" style="margin:0;">当前没有生成用例，请先进行用例生成</p>' +
          '</div>';
        toggleCaseGenAllSelectButton(false);
      } else {
        caseGenViewDrawerBody.innerHTML = items.map(function(entry, idx) {
          var mod = entry.mod;
          var list = entry.list;
          var moduleTitle = resolveModuleTitle(mod && (mod.title || mod.module)) || ('模块' + (idx + 1));
          return '' +
            '<div class="caseview drawer-view visible caseview-all-section" data-view-container="' + mod.id + '">' +
              '<div class="caseview-module-title">' + escapeHtml(moduleTitle) + '</div>' +
              renderCaseTable(mod, list, { selectable: true, moduleId: mod.id, showRemark: true }) +
            '</div>';
        }).join('');
        items.forEach(function(entry) {
          refreshCaseSelectionUI(entry.mod.id);
        });
        if (withHint) {
          setCaseGenSelectionHintsForAllModules();
        } else {
          items.forEach(function(entry) { applyCaseGenSelectionHint(entry.mod.id); });
        }
        toggleCaseGenAllSelectButton(true);
        updateCaseGenAllSelectionButton();
      }
      if (caseGenViewDrawerTitle) {
        caseGenViewDrawerTitle.textContent = '全模块用例视图';
      }
      drawer.open();
      return { opened: true, blocked: false };
    }

    function openCaseViewForSelectionHint(action) {
      if (action === 'new' || action === 'append') {
        setCaseGenStoreMode(action, { persist: false });
      }
      if (caseGenDbStoreDrawer && caseGenDbStoreDrawer.element && caseGenDbStoreDrawer.element.classList.contains('open')) {
        caseGenDbStoreDrawer.close();
      }
      var result = openCaseGenAllView({ selectionHint: true, force: true });
      if (action && result && result.opened) {
        setPendingCaseGenDbStoreAction(action);
      }
      return result;
    }

    function listCaseGenModulesMissingSelectionOrGeneration() {
      var out = [];
      if (!Array.isArray(state.caseGenModules)) return out;
      state.caseGenModules.forEach(function(mod) {
        if (!mod || !mod.id) return;
        var title = resolveModuleTitle(mod.title || mod.module || '');
        var list = getCaseListForModule(mod.id);
        var hasGenerated = Boolean(list && list.length);
        var selection = state.caseSelections[mod.id];
        var hasSelected = false;
        if (hasGenerated && selection && selection.size) {
          selection.forEach(function(idx) {
            if (!hasSelected && list && list[idx]) hasSelected = true;
          });
        }
        if (!hasGenerated || !hasSelected) out.push(title);
      });
      return out;
    }

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
    function resolveCaseGenActiveDrawer() {
      var candidates = [caseGenActionDrawer, caseGenModuleGenerateDrawer, caseGenDbStoreDrawer, caseGenViewDrawer];
      for (var i = 0; i < candidates.length; i += 1) {
        var drawer = candidates[i];
        var el = drawer && drawer.element ? drawer.element : null;
        if (el && el.classList && el.classList.contains('open')) return drawer;
      }
      return null;
    }

    function syncCaseGenDbStoreControls() {
      var st = ensureDbStoreState();
      var mode = st.mode || '';
      if (caseGenDbStoreCaseFileRow && caseGenDbStoreCaseFileRow.classList) {
        caseGenDbStoreCaseFileRow.classList.toggle('hidden', mode !== 'append');
      }
      var pid = st.projectId || '';
      var vid = st.versionId || '';
      var fid = st.caseFileId || '';
      var busy = Boolean(st.loading || st.confirming);
      if (caseGenDbStoreVersionSelect) {
        caseGenDbStoreVersionSelect.disabled = Boolean(busy || !pid);
      }
      if (caseGenDbStoreCaseFileSelect) {
        caseGenDbStoreCaseFileSelect.disabled = Boolean(busy || mode !== 'append' || !pid || !vid);
      }
      if (caseGenDbStoreConfirmBtn) {
        var needCaseFile = mode === 'append';
        var can = Boolean(!busy && pid && vid && (!needCaseFile || fid));
        caseGenDbStoreConfirmBtn.disabled = !can;
      }
    }

    function renderCaseGenDbStoreProjects() {
      var st = ensureDbStoreState();
      if (!caseGenDbStoreProjectSelect) return;
      var list = Array.isArray(st.projects) ? st.projects : [];
      caseGenDbStoreProjectSelect.innerHTML = ['<option value=\"\">请选择项目</option>']
        .concat(
          list.map(function(p) {
            var id = p && (p.id || p.id === 0) ? String(p.id) : '';
            var name = p && p.name ? String(p.name) : ('项目#' + id);
            return '<option value=\"' + escapeHtml(id) + '\">' + escapeHtml(name) + '</option>';
          })
        )
        .join('');
      caseGenDbStoreProjectSelect.value = st.projectId || '';
    }

    function renderCaseGenDbStoreVersions() {
      var st = ensureDbStoreState();
      if (!caseGenDbStoreVersionSelect) return;
      var pid = st.projectId || '';
      var list = pid && st.versionsByProject && st.versionsByProject[pid] ? st.versionsByProject[pid] : [];
      list = Array.isArray(list) ? list : [];
      var appUtils = window.app && window.app.utils ? window.app.utils : null;
      caseGenDbStoreVersionSelect.innerHTML = ['<option value=\"\">请选择版本</option>']
        .concat(
          list.map(function(v) {
            var id = v && (v.id || v.id === 0) ? String(v.id) : '';
            var name = v && v.name ? String(v.name) : ('版本#' + id);
            return '<option value=\"' + escapeHtml(id) + '\">' + escapeHtml(name) + '</option>';
          })
        )
        .join('');
      if (appUtils && typeof appUtils.buildAddVersionOption === 'function') {
        caseGenDbStoreVersionSelect.innerHTML += appUtils.buildAddVersionOption('＋ 新增版本');
      } else {
        caseGenDbStoreVersionSelect.innerHTML += '<option value="__add_version__">＋ 新增版本</option>';
      }
      caseGenDbStoreVersionSelect.value = st.versionId || '';
      caseGenDbStoreVersionSelect.disabled = Boolean(st.loading || !pid);
    }

    function renderCaseGenDbStoreCaseFiles() {
      var st = ensureDbStoreState();
      if (!caseGenDbStoreCaseFileSelect) return;
      var pid = st.projectId || '';
      var vid = st.versionId || '';
      var list = pid && st.caseFilesByProject && st.caseFilesByProject[pid] ? st.caseFilesByProject[pid] : [];
      list = Array.isArray(list) ? list : [];
      var filtered = vid
        ? list.filter(function(cf) { return cf && String(cf.version_id || '') === String(vid); })
        : [];
      filtered.sort(function(a, b) {
        var na = a && a.file_name_clean ? String(a.file_name_clean) : '';
        var nb = b && b.file_name_clean ? String(b.file_name_clean) : '';
        return na.localeCompare(nb, 'zh-Hans-CN');
      });
      caseGenDbStoreCaseFileSelect.innerHTML = ['<option value=\"\">请选择用例</option>']
        .concat(
          filtered.map(function(cf) {
            var id = cf && (cf.id || cf.id === 0) ? String(cf.id) : '';
            var name = cf && cf.file_name_clean ? String(cf.file_name_clean) : ('用例#' + id);
            return '<option value=\"' + escapeHtml(id) + '\">' + escapeHtml(name) + '</option>';
          })
        )
        .join('');
      caseGenDbStoreCaseFileSelect.value = st.caseFileId || '';
      caseGenDbStoreCaseFileSelect.disabled = Boolean(st.loading || !pid || !vid);
    }

    function loadCaseGenDbStoreProjects() {
      if (!isDbStoreReady()) return Promise.reject(new Error('后端未就绪'));
      var st = ensureDbStoreState();
      if (st.loading) return Promise.resolve([]);
      st.loading = true;
      syncCaseGenDbStoreControls();
      if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '加载项目中...', '');
      return apiClient
        .listProjects()
        .then(function(list) {
          var projects = Array.isArray(list) ? list : [];
          var utils = window.app && window.app.utils ? window.app.utils : {};
          var globalState = window.app && window.app.state ? window.app.state : {};
          if (utils && typeof utils.sortProjectsByUserSettings === 'function') {
            projects = utils.sortProjectsByUserSettings(projects, globalState);
          } else {
            projects.sort(function(a, b) {
              var na = a && a.name ? String(a.name) : '';
              var nb = b && b.name ? String(b.name) : '';
              return na.localeCompare(nb, 'zh-Hans-CN');
            });
          }
          st.projects = projects;
          renderCaseGenDbStoreProjects();
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '', '');
          return projects;
        })
        .catch(function(err) {
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '加载项目失败：' + (err && err.message ? err.message : '未知错误'), 'err');
          return [];
        })
        .finally(function() {
          st.loading = false;
          syncCaseGenDbStoreControls();
        });
    }

    function loadCaseGenDbStoreVersions(projectId) {
      if (!isDbStoreReady()) return Promise.reject(new Error('后端未就绪'));
      var st = ensureDbStoreState();
      var pid = String(projectId || '');
      if (!pid) return Promise.resolve([]);
      if (st.versionsByProject && Array.isArray(st.versionsByProject[pid])) {
        return Promise.resolve(st.versionsByProject[pid]);
      }
      st.loading = true;
      syncCaseGenDbStoreControls();
      if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '加载版本中...', '');
      return apiClient
        .listProjectVersions(pid)
        .then(function(list) {
          var versions = Array.isArray(list) ? list : [];
          versions.sort(function(a, b) {
            var na = a && a.name ? String(a.name) : '';
            var nb = b && b.name ? String(b.name) : '';
            return na.localeCompare(nb, 'zh-Hans-CN');
          });
          st.versionsByProject[pid] = versions;
          renderCaseGenDbStoreVersions();
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '', '');
          return versions;
        })
        .catch(function(err) {
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '加载版本失败：' + (err && err.message ? err.message : '未知错误'), 'err');
          return [];
        })
        .finally(function() {
          st.loading = false;
          syncCaseGenDbStoreControls();
        });
    }

    function loadCaseGenDbStoreCaseFiles(projectId) {
      if (!isDbStoreReady()) return Promise.reject(new Error('后端未就绪'));
      var st = ensureDbStoreState();
      var pid = String(projectId || '');
      if (!pid) return Promise.resolve([]);
      if (st.caseFilesByProject && Array.isArray(st.caseFilesByProject[pid])) {
        return Promise.resolve(st.caseFilesByProject[pid]);
      }
      st.loading = true;
      syncCaseGenDbStoreControls();
      if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '加载用例列表中...', '');
      return apiClient
        .listCaseFiles(pid)
        .then(function(list) {
          var files = Array.isArray(list) ? list : [];
          st.caseFilesByProject[pid] = files;
          renderCaseGenDbStoreCaseFiles();
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '', '');
          return files;
        })
        .catch(function(err) {
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '加载用例列表失败：' + (err && err.message ? err.message : '未知错误'), 'err');
          return [];
        })
        .finally(function() {
          st.loading = false;
          syncCaseGenDbStoreControls();
        });
    }

    function maybeConfirmIncompleteModulesBeforeStore(actionLabel, drawerRef) {
      var missing = listCaseGenModulesMissingSelectionOrGeneration();
      if (!missing.length) return Promise.resolve(true);
      var label = actionLabel ? String(actionLabel) : '写入用例库';
      var msg = missing.join(' ') + ' 没有选择用例，确定继续' + label + '吗？';
      return openConfirmDrawer({
        title: '确认' + label,
        message: msg,
        confirmText: '继续' + label,
        cancelText: '返回检查',
        previousDrawer: drawerRef || null,
      }).then(function(res) {
        return Boolean(res && res.ok === true);
      });
    }

    function triggerTempExecCaseLibrarySync(reason) {
      try {
        if (window && window.app) {
          var prev = Number(window.app.__tempexecCaseLibrarySyncSeq || 0);
          if (!Number.isFinite(prev) || prev < 0) prev = 0;
          window.app.__tempexecCaseLibrarySyncSeq = prev + 1;
          window.app.__tempexecCaseLibrarySyncReason = reason || 'casegen-store';
        }
      } catch (err) {
        // ignore
      }
      try {
        if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
          window.app.tempExecApi.loadTempExecState();
        }
      } catch (err2) {
        // ignore
      }
    }

    function openTempExecViewByNav() {
      try {
        var btn = document.getElementById('openTempExecViewNavBtn');
        if (btn && typeof btn.click === 'function') btn.click();
      } catch (err) {
        // ignore
      }
    }

    function goToExecSet(execSetId) {
      if (!execSetId) return Promise.resolve();
      try {
        switchTab('tempexec');
      } catch (err) {
        // ignore
      }
      openTempExecViewByNav();
      if (!window.app || !window.app.tempExecApi) return Promise.resolve();
      var tempApi = window.app.tempExecApi;
      if (typeof tempApi.loadTempExecState !== 'function' || typeof tempApi.setTempExecActive !== 'function') return Promise.resolve();
      return Promise.resolve()
        .then(function() { return tempApi.loadTempExecState(); })
        .then(function() { tempApi.setTempExecActive(String(execSetId)); });
    }

    function openCaseGenDbStoreDrawer(mode) {
      if (!isDbStoreReady()) {
        setStatus(caseGenStatus, '后端未就绪，请先启动后端服务后再入库', 'warn');
        return;
      }
      var drawer = ensureCaseGenDbStoreDrawer();
      if (!drawer) {
        setStatus(caseGenStatus, '抽屉组件未就绪，无法入库', 'err');
        return;
      }
      var st = ensureDbStoreState();
      st.mode = mode || '';
      st.loading = false;
      st.confirming = false;
      st.projectId = '';
      st.versionId = '';
      st.caseFileId = '';
      if (caseGenDbStoreDrawerTitle) {
        caseGenDbStoreDrawerTitle.textContent = (mode === 'append') ? '旧用例追加入库' : '新用例入库';
      }
      if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '', '');
      if (caseGenDbStoreVersionSelect) {
        caseGenDbStoreVersionSelect.value = '';
        caseGenDbStoreVersionSelect.disabled = true;
      }
      if (caseGenDbStoreCaseFileSelect) {
        caseGenDbStoreCaseFileSelect.value = '';
        caseGenDbStoreCaseFileSelect.disabled = true;
      }
      renderCaseGenDbStoreProjects();
      renderCaseGenDbStoreVersions();
      renderCaseGenDbStoreCaseFiles();
      syncCaseGenDbStoreControls();
      drawer.open();
      loadCaseGenDbStoreProjects();
    }

    var caseGenDbStoreBound = false;
    function bindCaseGenDbStoreEvents() {
      if (caseGenDbStoreBound) return;
      caseGenDbStoreBound = true;
      if (caseGenDbStoreProjectSelect) {
        caseGenDbStoreProjectSelect.addEventListener('change', function() {
          var st = ensureDbStoreState();
          st.projectId = caseGenDbStoreProjectSelect.value || '';
          st.versionId = '';
          st.caseFileId = '';
          renderCaseGenDbStoreVersions();
          renderCaseGenDbStoreCaseFiles();
          syncCaseGenDbStoreControls();
          if (st.projectId) loadCaseGenDbStoreVersions(st.projectId);
        });
      }
      if (caseGenDbStoreVersionSelect) {
        caseGenDbStoreVersionSelect.addEventListener('change', function() {
          var st = ensureDbStoreState();
          var raw = caseGenDbStoreVersionSelect.value || '';
          var appUtils = window.app && window.app.utils ? window.app.utils : null;
          if (appUtils && typeof appUtils.isAddVersionOption === 'function' && appUtils.isAddVersionOption(raw)) {
            var pid = st.projectId;
            if (!pid) {
              if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '请先选择项目', 'warn');
              caseGenDbStoreVersionSelect.value = st.versionId || '';
              return;
            }
            if (!appUtils || typeof appUtils.openAddProjectVersionDrawer !== 'function') {
              if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '新增版本组件未就绪，请刷新后重试', 'err');
              caseGenDbStoreVersionSelect.value = st.versionId || '';
              return;
            }
            var prevValue = st.versionId || '';
            caseGenDbStoreVersionSelect.value = prevValue;
            st.loading = true;
            syncCaseGenDbStoreControls();
            var projectLabel = '';
            try {
              var list = Array.isArray(st.projects) ? st.projects : [];
              var found = list.find(function(p) { return p && String(p.id) === String(pid); }) || null;
              projectLabel = found && found.name ? String(found.name) : '';
            } catch (_) {
              projectLabel = '';
            }
            appUtils
              .openAddProjectVersionDrawer({
                projectId: pid,
                projectName: projectLabel || ('项目#' + pid),
                previousDrawer: ensureCaseGenDbStoreDrawer(),
              })
              .then(function(res) {
                if (!res || res.ok !== true || !res.version) return;
                st.versionsByProject = st.versionsByProject && typeof st.versionsByProject === 'object' ? st.versionsByProject : {};
                var list = st.versionsByProject[pid];
                if (!Array.isArray(list)) list = [];
                var exists = list.some(function(v) { return v && String(v.id) === String(res.version.id); });
                if (!exists) list.push(res.version);
                list.sort(function(a, b) {
                  var na = a && a.name ? String(a.name) : '';
                  var nb = b && b.name ? String(b.name) : '';
                  return na.localeCompare(nb, 'zh-Hans-CN');
                });
                st.versionsByProject[pid] = list;
                st.versionId = String(res.version.id);
                st.caseFileId = '';
                renderCaseGenDbStoreVersions();
                renderCaseGenDbStoreCaseFiles();
              })
              .finally(function() {
                st.loading = false;
                syncCaseGenDbStoreControls();
              });
            return;
          }
          st.versionId = raw;
          st.caseFileId = '';
          renderCaseGenDbStoreCaseFiles();
          syncCaseGenDbStoreControls();
          if (st.mode === 'append' && st.projectId) {
            loadCaseGenDbStoreCaseFiles(st.projectId).then(function() {
              renderCaseGenDbStoreCaseFiles();
              syncCaseGenDbStoreControls();
            });
          }
        });
      }
      if (caseGenDbStoreCaseFileSelect) {
        caseGenDbStoreCaseFileSelect.addEventListener('change', function() {
          var st = ensureDbStoreState();
          st.caseFileId = caseGenDbStoreCaseFileSelect.value || '';
          syncCaseGenDbStoreControls();
        });
      }
      if (caseGenDbStoreConfirmBtn) {
        caseGenDbStoreConfirmBtn.addEventListener('click', function() {
          var st = ensureDbStoreState();
          if (st.mode === 'append') confirmCaseGenDbAppend();
          else confirmCaseGenDbNewImport();
        });
      }
    }

    function openCaseGenDbStoreNewDrawer() {
      setCaseGenStoreMode('new', { persist: false });
      var st = ensureDbStoreState();
      var action = st.newAction || (caseGenStoreActionSelect ? caseGenStoreActionSelect.value : '');
      action = String(action || '');
      if (!action) {
        markCaseGenDbStoreNewActionError();
        setStatus(caseGenStatus, '请先选择“直接入库”或“入库并转到执行”', 'warn');
        return;
      }
      clearCaseGenDbStoreNewActionError();
      if (!hasSelectedGeneratedCases()) {
        if (!hasGeneratedCases()) {
          setStatus(caseGenStatus, '请先生成用例后再入库', 'warn');
          return;
        }
        var viewState = openCaseViewForSelectionHint('new');
        if (viewState && viewState.blocked) return;
        var opened = viewState && viewState.opened;
        setStatus(caseGenStatus, opened ? '请先在全模块用例视图勾选需要入库的用例（已标记勾选区域）' : '请先在全模块用例视图勾选需要入库的用例', 'warn');
        return;
      }
      openCaseGenDbStoreDrawer('new');
    }

    function openCaseGenDbStoreAppendDrawer() {
      setCaseGenStoreMode('append', { persist: false });
      if (!hasSelectedGeneratedCases()) {
        if (!hasGeneratedCases()) {
          setStatus(caseGenStatus, '请先生成用例后再追加入库', 'warn');
          return;
        }
        var viewState = openCaseViewForSelectionHint('append');
        if (viewState && viewState.blocked) return;
        var opened = viewState && viewState.opened;
        setStatus(caseGenStatus, opened ? '请先在全模块用例视图勾选需要追加的用例（已标记勾选区域）' : '请先在全模块用例视图勾选需要追加的用例', 'warn');
        return;
      }
      openCaseGenDbStoreDrawer('append');
    }

    function confirmCaseGenDbNewImport() {
      var st = ensureDbStoreState();
      if (st.loading || st.confirming) return;
      var items = collectDbStoreSelectedItems();
      if (!items.length) {
        var viewState = openCaseViewForSelectionHint();
        if (viewState && viewState.blocked) return;
        var opened = viewState && viewState.opened;
        setStatus(caseGenStatus, opened ? '请先在全模块用例视图勾选需要入库的用例（已标记勾选区域）' : '请先勾选用例后再入库', 'warn');
        return;
      }
      if (!st.projectId || !st.versionId) {
        if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '请先选择项目与版本', 'warn');
        return;
      }
      var drawerRef = ensureCaseGenDbStoreDrawer();
      st.confirming = true;
      syncCaseGenDbStoreControls();
      maybeConfirmIncompleteModulesBeforeStore('入库', drawerRef).then(function(okMissing) {
        st.confirming = false;
        syncCaseGenDbStoreControls();
        if (!okMissing) {
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '已取消入库', 'warn');
          return;
        }
        var requirementLabel = ensureRequirementLabel('请输入需求标识后再入库');
        if (!requirementLabel) {
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '已取消入库（需求标识为空）', 'warn');
          return;
        }
        var fileName = String(requirementLabel) + '.xmind';
        var action = st.newAction || (caseGenStoreActionSelect ? caseGenStoreActionSelect.value : '');
        action = String(action || '');
        var projectIdNum = Number(st.projectId);
        var versionIdNum = Number(st.versionId);
        st.loading = true;
        syncCaseGenDbStoreControls();
        if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '入库中...', '');
        apiClient
          .importCaseFile({
            project_id: projectIdNum,
            version_id: versionIdNum,
            file_name: fileName,
            source: 'casegen',
            items: items,
          })
          .then(function(caseFile) {
            if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '入库成功：' + requirementLabel, 'ok');
            setStatus(caseGenStatus, '入库成功：' + requirementLabel, 'ok');
            try {
              if (window.app && window.app.utils && typeof window.app.utils.showCenterToast === 'function') {
                window.app.utils.showCenterToast('用例入库成功', 'ok', 3000);
              }
            } catch (_) {}
            var drawer = ensureCaseGenDbStoreDrawer();
            if (drawer) drawer.close();
            triggerTempExecCaseLibrarySync('casegen-new');
            if (action === 'store_to_exec' && caseFile && caseFile.id && typeof apiClient.upsertExecSetFromCaseFile === 'function') {
              var execVersionDrawerApi = window.app && window.app.execVersionDrawer ? window.app.execVersionDrawer : null;
              if (!execVersionDrawerApi || typeof execVersionDrawerApi.open !== 'function') return null;
              var projectName = '';
              try {
                var pList = Array.isArray(state.projects) ? state.projects : [];
                var found = pList.find(function(p) { return p && Number(p.id) === Number(projectIdNum); }) || null;
                projectName = found && found.name ? String(found.name) : '';
              } catch (_) {
                projectName = '';
              }
              return execVersionDrawerApi.open({
                title: '选择执行版本',
                projectId: projectIdNum,
                projectName: projectName || ('项目#' + projectIdNum),
                importVersionId: versionIdNum,
              }).then(function(res0) {
                if (!res0 || res0.ok !== true) return null;
                var execVid = Object.prototype.hasOwnProperty.call(res0, 'versionId') ? res0.versionId : (res0.exec_version_id || null);
                return apiClient
                  .upsertExecSetFromCaseFile({
                    case_file_id: caseFile.id,
                    mode: 'replace',
                    preserve_results: true,
                    prefer_result_source: 'db',
                    requirement: requirementLabel,
                    exec_version_id: execVid,
                  })
                  .then(function(execSet) {
                    if (execSet && execSet.id) return goToExecSet(execSet.id);
                    return null;
                  });
              });
            }
            return null;
          })
          .catch(function(err) {
            var msg = err && err.message ? err.message : '入库失败';
            if (msg.indexOf('同名') !== -1 && window.app && window.app.caseLibraryApi && typeof window.app.caseLibraryApi.openImportDiffForExternal === 'function') {
              var drawer2 = ensureCaseGenDbStoreDrawer();
              if (drawer2) drawer2.close();
              setStatus(caseGenStatus, '检测到同名用例，已打开差异对比抽屉', 'warn');
              return window.app.caseLibraryApi
                .openImportDiffForExternal({
                  projectId: projectIdNum,
                  versionId: versionIdNum,
                  fileName: fileName,
                  source: 'casegen',
                  items: items,
                  error: err,
                })
                .then(function(res) {
                  if (!res || res.ok !== true) {
                    setStatus(caseGenStatus, '已取消覆盖导入', 'warn');
                    return null;
                  }
                  var caseFile2 = res.caseFile || null;
                  try {
                    if (window.app && window.app.utils && typeof window.app.utils.showCenterToast === 'function') {
                      window.app.utils.showCenterToast('用例入库成功', 'ok', 3000);
                    }
                  } catch (_) {}
                  triggerTempExecCaseLibrarySync('casegen-new-overwrite');
                  if (action === 'store_to_exec' && caseFile2 && caseFile2.id && typeof apiClient.upsertExecSetFromCaseFile === 'function') {
                    var execVersionDrawerApi2 = window.app && window.app.execVersionDrawer ? window.app.execVersionDrawer : null;
                    if (!execVersionDrawerApi2 || typeof execVersionDrawerApi2.open !== 'function') return null;
                    var projectName2 = '';
                    try {
                      var pList2 = Array.isArray(state.projects) ? state.projects : [];
                      var found2 = pList2.find(function(p) { return p && Number(p.id) === Number(projectIdNum); }) || null;
                      projectName2 = found2 && found2.name ? String(found2.name) : '';
                    } catch (_) {
                      projectName2 = '';
                    }
                    return execVersionDrawerApi2.open({
                      title: '选择执行版本',
                      projectId: projectIdNum,
                      projectName: projectName2 || ('项目#' + projectIdNum),
                      importVersionId: versionIdNum,
                    }).then(function(res1) {
                      if (!res1 || res1.ok !== true) return null;
                      var execVid2 = Object.prototype.hasOwnProperty.call(res1, 'versionId') ? res1.versionId : (res1.exec_version_id || null);
                      return apiClient
                        .upsertExecSetFromCaseFile({
                          case_file_id: caseFile2.id,
                          mode: 'replace',
                          preserve_results: true,
                          prefer_result_source: 'db',
                          requirement: requirementLabel,
                          exec_version_id: execVid2,
                        })
                        .then(function(execSet2) {
                          if (execSet2 && execSet2.id) return goToExecSet(execSet2.id);
                          return null;
                        });
                    });
                  }
                  return null;
                });
            }
            if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '入库失败：' + msg, 'err');
            setStatus(caseGenStatus, '入库失败：' + msg, 'err');
            return null;
          })
          .finally(function() {
            st.loading = false;
            syncCaseGenDbStoreControls();
          });
      });
    }

    function confirmCaseGenDbAppend() {
      var st = ensureDbStoreState();
      if (st.loading || st.confirming) return;
      var items = collectDbStoreSelectedItems();
      if (!items.length) {
        var viewState = openCaseViewForSelectionHint();
        if (viewState && viewState.blocked) return;
        var opened = viewState && viewState.opened;
        setStatus(caseGenStatus, opened ? '请先在全模块用例视图勾选需要追加的用例（已标记勾选区域）' : '请先勾选用例后再追加入库', 'warn');
        return;
      }
      if (!st.projectId || !st.versionId || !st.caseFileId) {
        if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '请先选择项目、版本与目标用例', 'warn');
        return;
      }
      var selectedName = '';
      try {
        if (caseGenDbStoreCaseFileSelect) {
          var opt = caseGenDbStoreCaseFileSelect.options[caseGenDbStoreCaseFileSelect.selectedIndex];
          selectedName = opt ? String(opt.textContent || '').trim() : '';
        }
      } catch (err) {
        selectedName = '';
      }
      if (!apiClient || typeof apiClient.appendCaseItems !== 'function') {
        if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '后端追加接口未就绪', 'err');
        return;
      }
      var caseFileIdNum = Number(st.caseFileId);
      var projectIdNum = Number(st.projectId);
      var versionIdNum = Number(st.versionId);

      function applyAppendResult(res, overwrite) {
        var appended = res && (res.appended || res.appended_count) ? Number(res.appended || res.appended_count) : 0;
        var overwritten = res && (res.overwritten || res.overwritten_count) ? Number(res.overwritten || res.overwritten_count) : 0;
        var skipped = res && (res.skipped_db_conflicts || res.skipped) ? Number(res.skipped_db_conflicts || res.skipped) : 0;
        var skippedExisting = res && (res.skipped_existing_conflicts || res.skipped_existing_title_conflicts) ? Number(res.skipped_existing_conflicts || res.skipped_existing_title_conflicts) : 0;
        var msg = '追加入库成功：新增 ' + appended + ' 条';
        if (overwrite && overwritten) msg += '，覆盖 ' + overwritten + ' 条';
        if (!overwrite && skippedExisting) msg += '，重复已跳过 ' + skippedExisting + ' 条';
        if (!overwrite && !skippedExisting && skipped) msg += '，重复已跳过 ' + skipped + ' 条';
        if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, msg, 'ok');
        setStatus(caseGenStatus, msg, 'ok');
        try {
          if (window.app && window.app.utils && typeof window.app.utils.showCenterToast === 'function') {
            window.app.utils.showCenterToast('追加入库成功', 'ok', 3000);
          }
        } catch (_) {}
        triggerTempExecCaseLibrarySync(overwrite ? 'casegen-append-overwrite' : 'casegen-append');
      }

      function proceedAppend() {
        // 若目标用例中已存在同模块同标题用例：打开 diff 抽屉，确认是否覆盖后再追加入库。
        if (typeof apiClient.listCaseItems === 'function' &&
            window.app &&
            window.app.caseLibraryApi &&
            typeof window.app.caseLibraryApi.openAppendDiffForExternal === 'function') {
          st.loading = true;
          syncCaseGenDbStoreControls();
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '检查重复用例中...', '');
          apiClient
            .listCaseItems(caseFileIdNum)
            .then(function(dbItems) {
              var list = Array.isArray(dbItems) ? dbItems : [];
              var keyMap = {};
              items.forEach(function(it) {
                var mod = (it && it.module ? String(it.module) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                var title = (it && it.title ? String(it.title) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                var pre = (it && it.precondition ? String(it.precondition) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                var steps = (it && it.steps ? String(it.steps) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                var expected = (it && it.expected ? String(it.expected) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                if (mod && title && expected) keyMap[mod + '::' + title + '::' + pre + '::' + steps + '::' + expected] = true;
              });
              var hasConflict = list.some(function(it) {
                var mod = (it && it.module ? String(it.module) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                var title = (it && it.title ? String(it.title) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                var pre = (it && it.precondition ? String(it.precondition) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                var steps = (it && it.steps ? String(it.steps) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                var expected = (it && it.expected ? String(it.expected) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                return Boolean(mod && title && expected && keyMap[mod + '::' + title + '::' + pre + '::' + steps + '::' + expected]);
              });

              if (!hasConflict) {
                st.loading = true;
                syncCaseGenDbStoreControls();
                if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '追加入库中...', '');
                return apiClient.appendCaseItems(caseFileIdNum, { items: items }).then(function(res) {
                  applyAppendResult(res || null, false);
                  var drawer0 = ensureCaseGenDbStoreDrawer();
                  if (drawer0) drawer0.close();
                  return null;
                }).finally(function() {
                  st.loading = false;
                  syncCaseGenDbStoreControls();
                });
              }

              var drawer = ensureCaseGenDbStoreDrawer();
              if (drawer) drawer.close();
              st.loading = false;
              syncCaseGenDbStoreControls();
              if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '', '');
              setStatus(caseGenStatus, '检测到重复用例，已打开差异对比，请确认是否覆盖', 'warn');
              return window.app.caseLibraryApi
                .openAppendDiffForExternal({
                  projectId: projectIdNum,
                  versionId: versionIdNum,
                  caseFileId: caseFileIdNum,
                  fileNameClean: selectedName || ('用例#' + caseFileIdNum),
                  items: items,
                  dbItems: list,
                })
                .then(function(res) {
                  if (res && res.ok === true) {
                    applyAppendResult(res.result || null, true);
                    return null;
                  }
                  setStatus(caseGenStatus, '已取消追加入库', 'warn');
                  return null;
                });
            })
            .then(function() {
              // no-op
              return null;
            })
            .catch(function(err) {
              st.loading = false;
              syncCaseGenDbStoreControls();
              var msg = err && err.message ? err.message : '追加入库失败';
              if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '追加入库失败：' + msg, 'err');
              setStatus(caseGenStatus, '追加入库失败：' + msg, 'err');
            });
          return;
        }

        st.loading = true;
        syncCaseGenDbStoreControls();
        if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '追加入库中...', '');
        apiClient
          .appendCaseItems(caseFileIdNum, { items: items })
          .then(function(res) {
            applyAppendResult(res || null, false);
            var drawer = ensureCaseGenDbStoreDrawer();
            if (drawer) drawer.close();
            return null;
          })
          .catch(function(err) {
            var msg = err && err.message ? err.message : '追加入库失败';
            if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '追加入库失败：' + msg, 'err');
            setStatus(caseGenStatus, '追加入库失败：' + msg, 'err');
            return null;
          })
          .finally(function() {
            st.loading = false;
            syncCaseGenDbStoreControls();
          });
      }

      var drawerRef = ensureCaseGenDbStoreDrawer();
      st.confirming = true;
      syncCaseGenDbStoreControls();
      maybeConfirmIncompleteModulesBeforeStore('追加入库', drawerRef).then(function(okMissing) {
        st.confirming = false;
        syncCaseGenDbStoreControls();
        if (!okMissing) {
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '已取消追加入库', 'warn');
          return null;
        }
        proceedAppend();
        return null;
      }).catch(function(err) {
        st.confirming = false;
        st.loading = false;
        syncCaseGenDbStoreControls();
        var msg = err && err.message ? err.message : '追加入库失败';
        if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '追加入库失败：' + msg, 'err');
        setStatus(caseGenStatus, '追加入库失败：' + msg, 'err');
      });
    }
    function collectSelectedCaseEntries() {
      var results = [];
      if (!state.caseGenModules || !state.caseGenModules.length) return results;
      state.caseGenModules.forEach(function(mod) {
        var selection = state.caseSelections[mod.id];
        if (!selection || !selection.size) return;
        var list = getCaseListForModule(mod.id);
        if (!list.length) return;
        var moduleTitle = resolveModuleTitle(mod && (mod.title || mod.module));
        var selectedList = [];
        selection.forEach(function(idx) {
          if (list[idx]) {
            var cloned = Object.assign({}, list[idx]);
            if (!cloned.module) cloned.module = moduleTitle;
            selectedList.push(cloned);
          }
        });
        if (selectedList.length) {
          results.push({
            moduleId: mod.id,
            moduleKey: normalizeModuleKey(moduleTitle),
            moduleTitle: moduleTitle,
            cases: sanitizeCasesForExport(selectedList),
          });
        }
      });
      return results;
    }

    function getCaseListForModule(moduleId) {
      var raw = state.caseGenResults[moduleId] || '';
      if (!raw.trim()) return [];
      var list = parseCaseList(raw);
      if (list.length) return list;
      try {
        var parsed = JSON.parse(stripCodeFence(raw) || '[]');
        var parsedCasesField = parsed && parsed.cases;
        var parsedDataField = parsed && parsed.data;
        list = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsedCasesField)
          ? parsedCasesField
          : Array.isArray(parsedDataField)
          ? parsedDataField
          : [];
      } catch (err) {
        list = [];
      }
      return list.filter(function(item) { return item && typeof item === 'object'; });
    }

    function cloneCaseSelectionMap() {
      var result = {};
      var source = state.caseSelections && typeof state.caseSelections === 'object'
        ? state.caseSelections
        : {};
      Object.keys(source).forEach(function(key) {
        result[key] = cloneSelectionSet(source[key]);
      });
      return result;
    }

    function buildOperationSnapshotPayload(scope, moduleId) {
      return {
        id: 'op-snap-' + String(ensureXmindCaseGenState().nextSnapshotId),
        scope: scope === 'module' ? 'module' : 'root',
        moduleId: moduleId ? String(moduleId || '') : '',
        caseGenModules: cloneJsonValue(state.caseGenModules, []),
        caseGenResults: cloneJsonValue(state.caseGenResults, {}),
        caseSelections: cloneCaseSelectionMap(),
        caseGenSuggestions: cloneJsonValue(state.caseGenSuggestions, {}),
        caseGenModuleStatus: cloneJsonValue(ensureCaseModuleStatusState(), {}),
        caseGenProgress: cloneJsonValue(state.caseGenProgress, {}),
        caseGenTiming: cloneJsonValue(ensureCaseModuleTimingState(), {}),
        caseGenSource: String(state.caseGenSource || ''),
        createdAt: Date.now(),
      };
    }

    function getLatestCaseGenOperationSnapshot() {
      var xmindState = ensureXmindCaseGenState();
      var list = Array.isArray(xmindState.operationSnapshots) ? xmindState.operationSnapshots : [];
      return list.length ? list[list.length - 1] : null;
    }

    function syncCaseGenOperationPointers() {
      var xmindState = ensureXmindCaseGenState();
      var latest = getLatestCaseGenOperationSnapshot();
      xmindState.lastOperationSnapshotId = latest && latest.id ? String(latest.id || '') : '';
      xmindState.rootSnapshotId = latest && latest.scope === 'root'
        ? String(latest.id || '')
        : '';
      xmindState.root.snapshotId = String(xmindState.rootSnapshotId || '');
      Object.keys(xmindState.modules || {}).forEach(function(key) {
        var moduleState = ensureXmindCaseGenModuleState(key);
        if (latest && latest.scope === 'module' && String(latest.moduleId || '') === String(key || '')) {
          moduleState.snapshotId = String(latest.id || '');
        } else {
          moduleState.snapshotId = '';
        }
      });
    }

    function createCaseGenOperationSnapshot(scope, moduleId) {
      var xmindState = ensureXmindCaseGenState();
      var snapshot = buildOperationSnapshotPayload(scope, moduleId);
      xmindState.nextSnapshotId += 1;
      xmindState.operationSnapshots.push(snapshot);
      syncCaseGenOperationPointers();
      xmindState.root.updatedAt = Date.now();
      if (moduleId) {
        var moduleState = ensureXmindCaseGenModuleState(moduleId);
        if (moduleState) moduleState.updatedAt = Date.now();
      }
      return String(snapshot.id || '');
    }

    function discardCaseGenOperationSnapshot(snapshotId) {
      var targetId = String(snapshotId || '');
      if (!targetId) return false;
      var xmindState = ensureXmindCaseGenState();
      var list = Array.isArray(xmindState.operationSnapshots) ? xmindState.operationSnapshots : [];
      var nextList = list.filter(function(item) {
        return item && String(item.id || '') !== targetId;
      });
      if (nextList.length === list.length) return false;
      xmindState.operationSnapshots = nextList;
      syncCaseGenOperationPointers();
      return true;
    }

    function applyOperationSnapshot(snapshot, rollbackAction) {
      if (!snapshot || typeof snapshot !== 'object') return false;
      state.caseGenModules = cloneJsonValue(snapshot.caseGenModules, []);
      state.caseGenResults = cloneJsonValue(snapshot.caseGenResults, {});
      state.caseSelections = {};
      Object.keys(snapshot.caseSelections || {}).forEach(function(key) {
        state.caseSelections[key] = restoreSelectionSet(snapshot.caseSelections[key]);
      });
      state.caseGenSuggestions = cloneJsonValue(snapshot.caseGenSuggestions, {});
      state.caseGenModuleStatus = cloneJsonValue(snapshot.caseGenModuleStatus, {});
      state.caseGenProgress = cloneJsonValue(snapshot.caseGenProgress, {});
      state.caseGenTiming = cloneJsonValue(snapshot.caseGenTiming, {});
      state.caseGenSource = String(snapshot.caseGenSource || '');
      var xmindState = ensureXmindCaseGenState();
      xmindState.hasModuleSkeleton = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      xmindState.root.lastAction = rollbackAction || 'rollback';
      xmindState.root.running = false;
      xmindState.root.status = '';
      xmindState.root.error = '';
      xmindState.root.updatedAt = Date.now();
      Object.keys(xmindState.modules || {}).forEach(function(key) {
        var moduleState = ensureXmindCaseGenModuleState(key);
        moduleState.running = false;
        moduleState.status = '';
        moduleState.error = '';
        moduleState.hideResults = false;
        moduleState.lastAction = rollbackAction || 'rollback';
        moduleState.updatedAt = Date.now();
      });
      syncCaseGenOperationPointers();
      closeCaseViewIfActive(ALL_CASE_VIEW_ID);
      (Array.isArray(state.caseGenModules) ? state.caseGenModules : []).forEach(function(mod) {
        if (!mod || !mod.id) return;
        refreshCaseSelectionUI(mod.id);
        updateSupplementButtons(mod.id, getCaseListForModule(mod.id).length > 0);
      });
      renderCaseGeneration();
      persistWorkflowState();
      return true;
    }

    function rollbackCaseGenOperationSnapshot(snapshotId) {
      var targetId = String(snapshotId || '');
      var xmindState = ensureXmindCaseGenState();
      var list = Array.isArray(xmindState.operationSnapshots) ? xmindState.operationSnapshots : [];
      var snapshot = null;
      var index = -1;
      if (targetId) {
        for (var i = list.length - 1; i >= 0; i -= 1) {
          if (!list[i] || String(list[i].id || '') !== targetId) continue;
          snapshot = list[i];
          index = i;
          break;
        }
      } else if (list.length) {
        index = list.length - 1;
        snapshot = list[index];
      }
      if (!snapshot || index < 0) return false;
      xmindState.operationSnapshots.splice(index, 1);
      return applyOperationSnapshot(snapshot, 'rollback');
    }

    function snapshotModuleCases(moduleId) {
      if (!moduleId) return '';
      return createCaseGenOperationSnapshot('module', moduleId);
    }

    function findModuleSnapshot(moduleId, snapshotId) {
      var xmindState = ensureXmindCaseGenState();
      var targetId = snapshotId ? String(snapshotId) : '';
      for (var i = xmindState.snapshots.length - 1; i >= 0; i -= 1) {
        var item = xmindState.snapshots[i];
        if (!item || String(item.moduleId || '') !== String(moduleId || '')) continue;
        if (targetId && String(item.id || '') !== targetId) continue;
        return item;
      }
      return null;
    }

    function restoreSelectionSet(list) {
      var set = new Set();
      if (!Array.isArray(list)) return set;
      list.forEach(function(idx) {
        var num = Number(idx);
        if (Number.isFinite(num)) set.add(num);
      });
      return set;
    }

    function rollbackModuleCases(moduleId) {
      if (!moduleId) return false;
      var latest = getLatestCaseGenOperationSnapshot();
      if (!latest || latest.scope !== 'module' || String(latest.moduleId || '') !== String(moduleId || '')) {
        return false;
      }
      return rollbackCaseGenOperationSnapshot(String(latest.id || '')) === true;
    }

    function snapshotAllCaseGenState() {
      return createCaseGenOperationSnapshot('root', '');
    }

    function rollbackAllCaseGenState() {
      var latest = getLatestCaseGenOperationSnapshot();
      if (!latest) return false;
      return rollbackCaseGenOperationSnapshot(String(latest.id || '')) === true;
    }

    function commitModuleCases(moduleId, payload) {
      if (!moduleId || !payload || payload.shouldCommit === false) return null;
      var rawResult = payload.rawResult;
      if (rawResult === undefined || rawResult === null) {
        rawResult = JSON.stringify(Array.isArray(payload.list) ? payload.list : [], null, 2);
      } else {
        rawResult = String(rawResult);
      }
      state.caseGenResults[moduleId] = rawResult;
      if (payload.selectionMode === 'keep-valid') {
        var currentSelection = state.caseSelections[moduleId];
        if (!currentSelection || typeof currentSelection.forEach !== 'function') {
          state.caseSelections[moduleId] = new Set();
        } else {
          var currentList = getCaseListForModule(moduleId);
          var validSelection = new Set();
          currentSelection.forEach(function(idx) {
            var num = Number(idx);
            if (Number.isFinite(num) && currentList[num]) validSelection.add(num);
          });
          state.caseSelections[moduleId] = validSelection;
        }
      } else {
        state.caseSelections[moduleId] = new Set();
      }
      if (payload.timingMs === null || payload.timingMs === undefined) {
        setCaseModuleTiming(moduleId);
      } else {
        setCaseModuleTiming(moduleId, Number(payload.timingMs));
      }
      if (payload.statusText !== undefined) {
        setCaseModuleStatus(moduleId, String(payload.statusText || ''), payload.statusType || '');
      }
      if (payload.finalizeStep) {
        setCaseProgressStep(moduleId, 'finalize', payload.finalizeStep);
      }
      closeCaseViewIfActive(moduleId);
      refreshCaseSelectionUI(moduleId);
      updateSupplementButtons(moduleId, payload.hasResult === true || getCaseListForModule(moduleId).length > 0);
      renderCaseGeneration();
      return {
        hasResult: getCaseListForModule(moduleId).length > 0,
        rawResult: rawResult,
      };
    }

    async function buildModuleCases(moduleId, options) {
      options = options || {};
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return null;
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再生成用例');
      if (!requirementLabel) {
        return {
          cancelled: true,
          statusText: '已取消生成：需求标识为空',
          statusType: 'warn',
        };
      }
      var cleanedContext = getCleanedTextForModel();
      var suggestion = getModuleSuggestion(moduleId);
      var model = getAssignedModel('casegen');
      var promptBase = options.promptBase;
      if (promptBase === undefined || promptBase === null || promptBase === '') {
        promptBase = state.assignments && state.assignments.caseGenPrompt ? state.assignments.caseGenPrompt.trim() : '';
        promptBase = promptBase || defaultPrompts.casegen || '';
      }
      var promptSettingsSnapshot = options.promptSettingsSnapshot;
      if (promptSettingsSnapshot === undefined || promptSettingsSnapshot === null) {
        promptSettingsSnapshot = createCaseGenPromptSettingsSnapshot();
      } else {
        promptSettingsSnapshot = normalizeCaseGenPromptSettings(promptSettingsSnapshot);
      }
      var prompt = buildCaseGenPrompt(promptBase, promptSettingsSnapshot);
      var ref = {
        module: mod.title,
        key_scenarios: mod.scenarios,
        test_points: mod.points,
        coupled_modules: mod.coupled,
      };
      var suggestionText = suggestion ? '\n\n用户附加要求：' + suggestion : '';
      var baseContext = cleanedContext
        ? '清洗后需求上下文：\n' + cleanedContext + '\n\n目标测试模块（JSON）：' + JSON.stringify(ref)
        : '测试模块信息（JSON）：' + JSON.stringify(ref);
      var userContent = baseContext + suggestionText + '\n请输出符合提示词要求的 JSON 数组。';
      var reasoning = getReasoningForType('casegen');
      var temperature = getTemperatureForType('casegen');
      var overallStart = Date.now();
      var startTime = Date.now();
      var content = await callCaseGenModelWithGuard(function() {
        return callModelWithConfig(model, userContent, prompt, reasoning, temperature);
      });
      var durationMs = Date.now() - startTime;
      var parsedInfo = parseGeneratedCases(content);
      var parsed = parsedInfo.parsed;
      var normalized = parsedInfo.normalized;
      var hadRecovery = parsedInfo.hadRecovery;
      if (!parsed.length) {
        if (state.caseGenProgress[moduleId]) {
          markAllCaseProgressGroups(moduleId, 'error');
          setCaseProgressStep(moduleId, 'dedupe', 'error');
          setCaseProgressStep(moduleId, 'finalize', 'error');
        }
        return {
          action: 'generate',
          shouldCommit: true,
          rawResult: '[]',
          list: [],
          hasResult: false,
          timingMs: durationMs,
          statusText: '生成结果为空，请重新生成',
          statusType: 'warn',
          finalizeStep: 'error',
        };
      }
      var dedupInfo = { list: parsed, removed: 0, hadError: false, skipped: true };
      if (hasImportedCases()) {
        dedupInfo = await filterCasesAgainstImported(mod, parsed, '用例生成');
      } else {
        initCaseProgress(moduleId, chunkArray(parsed, 5));
        markAllCaseProgressGroups(moduleId, 'done');
        setCaseProgressStep(moduleId, 'dedupe', 'done');
      }
      if (!dedupInfo.skipped) {
        setCaseProgressStep(moduleId, 'finalize', 'running');
      }
      var filteredList = dedupInfo.list || [];
      var removedByFilter = dedupInfo.removed || 0;
      var filterHadError = dedupInfo.hadError || false;
      if (!filteredList.length) {
        if (!dedupInfo.skipped) setCaseProgressStep(moduleId, 'finalize', 'error');
        return {
          action: 'generate',
          shouldCommit: true,
          rawResult: '[]',
          list: [],
          hasResult: false,
          timingMs: durationMs,
          statusText: '生成的用例与导入用例重复，未保留新的用例',
          statusType: 'warn',
          finalizeStep: 'error',
        };
      }
      var finalJson = dedupInfo.skipped ? normalized : JSON.stringify(filteredList, null, 2);
      var durationSec = Math.max(1, Math.round((Date.now() - overallStart) / 1000));
      var parts = ['【' + mod.title + '】用例已生成 ' + filteredList.length + ' 条', '耗时 ' + durationSec + ' 秒'];
      if (removedByFilter) parts.push('剔除 ' + removedByFilter + ' 条重复用例');
      var message = hadRecovery
        ? parts.join('，') + '（检测到部分数据不完整，已保留完整条目）'
        : parts.join('，');
      return {
        action: 'generate',
        shouldCommit: true,
        rawResult: finalJson,
        list: filteredList,
        hasResult: true,
        timingMs: durationMs,
        statusText: message,
        statusType: hadRecovery || filterHadError ? 'warn' : 'ok',
        finalizeStep: 'done',
      };
    }

    async function buildModuleTopup(moduleId, options) {
      options = options || {};
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return null;
      var existingList = getCaseListForModule(moduleId);
      if (!existingList.length) {
        return {
          cancelled: true,
          statusText: '【' + resolveModuleTitle(mod.title || mod.module || '') + '】暂无原始用例，无法补全',
          statusType: 'warn',
        };
      }
      var cleanedContext = getCleanedTextForModel();
      var suggestion = getModuleSuggestion(moduleId);
      var model = getAssignedModel('casegen');
      var promptBase = options.promptBase;
      if (promptBase === undefined || promptBase === null || promptBase === '') {
        promptBase = state.assignments && state.assignments.caseGenPrompt ? state.assignments.caseGenPrompt.trim() : '';
        promptBase = promptBase || defaultPrompts.casegen || '';
      }
      var promptSettingsSnapshot = options.promptSettingsSnapshot;
      if (promptSettingsSnapshot === undefined || promptSettingsSnapshot === null) {
        promptSettingsSnapshot = createEmptyCaseGenPromptSettings();
      } else {
        promptSettingsSnapshot = normalizeCaseGenPromptSettings(promptSettingsSnapshot);
      }
      var prompt = buildCaseGenPrompt(promptBase, promptSettingsSnapshot);
      var ref = {
        module: mod.title,
        key_scenarios: mod.scenarios,
        test_points: mod.points,
        coupled_modules: mod.coupled,
      };
      var baseContext = cleanedContext
        ? '清洗后需求上下文：\n' + cleanedContext + '\n\n目标测试模块（JSON）：' + JSON.stringify(ref)
        : '测试模块信息（JSON）：' + JSON.stringify(ref);
      var existingJson = JSON.stringify(sanitizeCasesForExport(existingList));
      var suggestionText = suggestion ? '\n\n额外要求：' + suggestion : '';
      var userContent = baseContext + '\n\n已有用例(JSON)：' + existingJson + '\n请在不重复的前提下补充新的测试用例，仅返回新增用例的 JSON 数组。' + suggestionText;
      var reasoning = getReasoningForType('casegen');
      var temperature = getTemperatureForType('casegen');
      var overallStart = Date.now();
      var startTime = Date.now();
      var content = await callCaseGenModelWithGuard(function() {
        return callModelWithConfig(model, userContent, prompt, reasoning, temperature);
      });
      var durationMs = Date.now() - startTime;
      var parsedInfo = parseGeneratedCases(content);
      var parsed = parsedInfo.parsed;
      var hadRecovery = parsedInfo.hadRecovery;
      if (!parsed.length) {
        if (state.caseGenProgress[moduleId]) {
          markAllCaseProgressGroups(moduleId, 'error');
          setCaseProgressStep(moduleId, 'dedupe', 'error');
          setCaseProgressStep(moduleId, 'finalize', 'error');
        }
        return {
          action: 'topup',
          shouldCommit: false,
          hasResult: existingList.length > 0,
          timingMs: durationMs,
          statusText: '未补充到新的用例，请调整提示后重试',
          statusType: 'warn',
          finalizeStep: 'error',
        };
      }
      var dedupInfo = { list: parsed, removed: 0, hadError: false, skipped: true };
      if (hasImportedCases()) {
        dedupInfo = await filterCasesAgainstImported(mod, parsed, '补全');
      } else {
        initCaseProgress(moduleId, chunkArray(parsed, 5));
        markAllCaseProgressGroups(moduleId, 'done');
        setCaseProgressStep(moduleId, 'dedupe', 'done');
      }
      if (!dedupInfo.skipped) setCaseProgressStep(moduleId, 'finalize', 'running');
      var filteredList = dedupInfo.list || [];
      if (!filteredList.length) {
        setCaseProgressStep(moduleId, 'finalize', 'error');
        return {
          action: 'topup',
          shouldCommit: false,
          hasResult: existingList.length > 0,
          timingMs: durationMs,
          statusText: '补全的用例与导入用例重复，已全部过滤',
          statusType: 'warn',
          finalizeStep: 'error',
        };
      }
      var appended = filteredList.map(function(item) { return Object.assign({}, item, { remark: '后补' }); });
      var updatedList = existingList.concat(appended);
      var durationSec = Math.max(1, Math.round((Date.now() - overallStart) / 1000));
      var parts = ['【' + mod.title + '】已补全 ' + appended.length + ' 条用例', '耗时 ' + durationSec + ' 秒'];
      if (dedupInfo.removed) {
        parts.push('剔除 ' + dedupInfo.removed + ' 条重复用例');
      }
      return {
        action: 'topup',
        shouldCommit: true,
        rawResult: JSON.stringify(updatedList, null, 2),
        list: updatedList,
        addedList: appended,
        hasResult: true,
        timingMs: durationMs,
        selectionMode: 'keep-valid',
        statusText: hadRecovery ? parts.join('，') + '（检测到结构异常，已保留有效条目）' : parts.join('，'),
        statusType: hadRecovery || dedupInfo.hadError ? 'warn' : 'ok',
        finalizeStep: 'done',
      };
    }

    function filterCasesAgainstImported(module, cases, actionLabel) {
      var moduleTitle = module && module.title ? module.title : '当前模块';
      var moduleId = module && module.id ? module.id : '';
      if (!hasImportedCases() || !cases.length) {
        if (moduleId) clearCaseProgress(moduleId);
        return Promise.resolve({ list: cases, removed: 0, hadError: false, skipped: true });
      }
      var importedList = getImportedCaseObjects();
      if (!importedList.length) {
        if (moduleId) clearCaseProgress(moduleId);
        return Promise.resolve({ list: cases, removed: 0, hadError: false, skipped: true });
      }
      var model;
      try {
        model = getAssignedModel('casefilter');
      } catch (err) {
        setCaseModuleStatus(moduleId, '【' + moduleTitle + '】' + actionLabel + '完成，但未配置“用例相似对比”模型，暂未过滤重复项', 'warn');
        if (moduleId) clearCaseProgress(moduleId);
        return Promise.resolve({ list: cases, removed: 0, hadError: false, skipped: true });
      }
      var prompt = state.assignments && state.assignments.caseFilterPrompt
        ? state.assignments.caseFilterPrompt.trim()
        : (defaultPrompts.casefilter || '');
      var reasoning = getReasoningForType('casefilter');
      var temperature = getTemperatureForType('casefilter');
      var baseCases = sanitizeCasesForExport(importedList);
      var baseJson = JSON.stringify(baseCases, null, 2);
      var groups = chunkArray(cases, 5);
      var concurrency = resolveCaseSimilarityConcurrency(groups.length);
      var hadError = false;
      if (moduleId) {
        initCaseProgress(moduleId, groups);
        setCaseProgressStep(moduleId, 'dedupe', 'running');
        setCaseModuleStatus(moduleId, '【' + moduleTitle + '】' + actionLabel + '完成，正在剔除重复用例（' + groups.length + ' 组）...', '');
      }
      return runConcurrent(groups, concurrency, function(group, idx) {
        if (!group || !group.length) return Promise.resolve([]);
        if (moduleId) setCaseProgressGroupState(moduleId, idx, 'running');
        var candidateJson = JSON.stringify(sanitizeCasesForExport(group), null, 2);
        var userContent = '模块：' + moduleTitle + '\n\n导入用例(JSON)：' + baseJson + '\n\n生成用例候选(JSON)：' + candidateJson + '\n\n请删除与导入用例重复或高度相似的候选，仅返回保留的候选 JSON 数组，不需要解释或额外文本。';
        return callCaseGenModelWithGuard(function() {
          return callModelWithConfig(model, userContent, prompt, reasoning, temperature);
        }).then(function(content) {
          var parsed = parseGeneratedCases(content).parsed;
          if (moduleId) setCaseProgressGroupState(moduleId, idx, 'done');
          return parsed.length ? parsed : [];
        }).catch(function(err) {
          console.warn('用例相似对比失败', err);
          hadError = true;
          if (moduleId) setCaseProgressGroupState(moduleId, idx, 'error');
          return group;
        });
      }).then(function(filteredGroups) {
        var flattened = filteredGroups.reduce(function(sum, group) { return sum.concat(group); }, []);
        var removed = Math.max(0, cases.length - flattened.length);
        if (moduleId) {
          setCaseProgressStep(moduleId, 'dedupe', hadError ? 'error' : 'done');
          var hint = hadError
            ? '【' + moduleTitle + '】重复用例剔除部分失败，请检查结果'
            : '【' + moduleTitle + '】重复用例剔除完成';
          setCaseModuleStatus(moduleId, hint, hadError ? 'warn' : 'ok');
        }
        return { list: flattened, removed: removed, hadError: hadError, skipped: false };
      });
    }

    function normalizeStaleCaseProgress(moduleId, moduleTitle) {
      if (!moduleId || isCaseModuleRunning(moduleId)) return;
      var progress = state.caseGenProgress[moduleId];
      if (!progress || typeof progress !== 'object') return;
      var hasStaleRunning = false;
      if (Array.isArray(progress.groups)) {
        progress.groups.forEach(function(group) {
          if (!group || group.state !== 'running') return;
          group.state = 'error';
          hasStaleRunning = true;
        });
      }
      if (progress.dedupe && progress.dedupe.state === 'running') {
        progress.dedupe.state = 'error';
        hasStaleRunning = true;
      }
      if (progress.finalize && progress.finalize.state === 'running') {
        progress.finalize.state = 'error';
        hasStaleRunning = true;
      }
      if (!hasStaleRunning) return;
      var moduleName = resolveModuleTitle(moduleTitle || '');
      var statusInfo = ensureCaseModuleStatusState()[moduleId];
      var statusType = statusInfo && statusInfo.type ? String(statusInfo.type) : '';
      var statusText = statusInfo && statusInfo.text ? String(statusInfo.text) : '';
      if (statusType === 'err' || statusType === 'warn') return;
      if (statusText.indexOf('已中断') !== -1 || statusText.indexOf('失败') !== -1) return;
      setCaseModuleStatus(moduleId, '【' + (moduleName || '当前模块') + '】生成任务已中断，请重新执行', 'warn');
    }

    function renderCaseGeneration() {
      if (!casesGenerationContainer) return;
      if (!state.caseGenModules.length) {
        casesGenerationContainer.innerHTML = '<p class="hint">请先在“测试模块拆分”中生成模块（JSON），然后点击“生成用例”进入本页。</p>';
        refreshExportCaseGenButton();
        refreshExportCaseGenXmindButton();
        refreshAppendExistingButton();
        refreshCaseGenBatchButtons();
        return;
      }
      casesGenerationContainer.innerHTML = state.caseGenModules.map(function(mod, idx) {
        normalizeStaleCaseProgress(mod.id, mod.title || mod.module || '');
        var rawResult = (state.caseGenResults[mod.id] || '').trim();
        var hasResult = Boolean(rawResult && !/^\[\s*\]$/.test(rawResult));
        var moduleBusy = isCaseModuleRunning(mod.id);
        var generateLabel = moduleBusy ? '生成中...' : '生成用例';
        var resultInfo = parseGeneratedCases(state.caseGenResults[mod.id] || '');
        var resultText = resultInfo.normalized || '';
        var timing = ensureCaseModuleTimingState()[mod.id];
        var timingText = Number.isFinite(timing) ? (timing / 1000).toFixed(2) : '--';
        return '' +
        '<div class="usecase-card" data-module-id="' + mod.id + '">' +
          '<h3>' + (idx + 1) + '. ' + mod.title + '</h3>' +
          '<div class="actions module-actions">' +
            '<button class="secondary" data-generate="' + mod.id + '" ' + (moduleBusy ? 'disabled' : '') + '>' + generateLabel + '</button>' +
            '<button class="secondary" data-export="' + mod.id + '" ' + (hasResult ? '' : 'disabled') + '>导出json</button>' +
            '<button class="secondary" data-import="' + mod.id + '">导入json</button>' +
            '<button class="secondary" data-clear="' + mod.id + '" ' + (hasResult ? '' : 'disabled') + '>清除用例</button>' +
            '<button class="pill primary case-view-btn" data-view="' + mod.id + '" ' + (hasResult ? '' : 'disabled') + ' style="margin-left:auto;">用例视图</button>' +
          '</div>' +
          '<p class="hint timing" data-case-timing="' + mod.id + '">模型用时：<strong data-case-timing-value="' + mod.id + '">' + timingText + '</strong> 秒</p>' +
          '<p class="status" data-case-status="' + mod.id + '"></p>' +
          '<div class="case-progress" data-progress="' + mod.id + '">' + renderCaseModuleProgress(mod.id) + '</div>' +
          '<textarea data-result="' + mod.id + '" placeholder="JSON 测试用例输出..." readonly>' + resultText + '</textarea>' +
          '<input type="file" data-import-input="' + mod.id + '" accept=".txt,.json" hidden>' +
          '<div class="suggestion-panel">' +
            '<label>生成建议</label>' +
            '<textarea data-suggestion="' + mod.id + '" placeholder="可输入补充说明/限制条件...">' + escapeHtml(state.caseGenSuggestions[mod.id] || '') + '</textarea>' +
            '<p class="hint suggestion-panel-hint">如需补全生成，请点击上方【生成用例】后，在抽屉的【补全生成】页签中执行。</p>' +
          '</div>' +
        '</div>';
      }).join('');
      state.caseGenModules.forEach(function(mod) {
        syncCaseModuleStatus(mod.id);
        syncCaseModuleTiming(mod.id);
        updateCaseProgressView(mod.id);
        var rawResult = (state.caseGenResults[mod.id] || '').trim();
        var hasResult = Boolean(rawResult && !/^\[\s*\]$/.test(rawResult));
        updateSupplementButtons(mod.id, hasResult);
        var viewBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-view="' + mod.id + '"]');
        if (viewBtn && activeCaseViewModuleId === mod.id && caseGenViewDrawer && caseGenViewDrawer.element && caseGenViewDrawer.element.classList.contains('open')) {
          viewBtn.textContent = '收起用例视图';
        }
      });
      refreshExportCaseGenButton();
      refreshExportCaseGenXmindButton();
      renderCaseGenProgressBoard();
      refreshAppendExistingButton();
      refreshCaseGenBatchButtons();
      renderAppendTargetOptions();
      persistWorkflowState();
    }

    async function generateCasesForModule(moduleId, options) {
      options = options || {};
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return;
      setCaseModuleTiming(moduleId);
      setCaseModuleRunning(moduleId, true);
      refreshCaseGenBatchButtons();
      var textarea = casesGenerationContainer && casesGenerationContainer.querySelector('textarea[data-result="' + moduleId + '"]');
      if (textarea) textarea.value = '';
      var generateBtn = casesGenerationContainer && casesGenerationContainer.querySelector('button[data-generate="' + moduleId + '"]');
      if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.textContent = '生成中...';
      }
      setCaseModuleStatus(moduleId, '正在生成【' + mod.title + '】的测试用例...', '');
      clearCaseProgress(moduleId);
      updateSupplementButtons(moduleId, false);
      var hasResult = false;
      try {
        var buildResult = await buildModuleCases(moduleId, options);
        if (!buildResult) {
          hasResult = false;
        } else if (buildResult.cancelled) {
          setCaseModuleStatus(moduleId, buildResult.statusText || '已取消生成', buildResult.statusType || 'warn');
          updateModelTiming(caseGenTimingEl);
          hasResult = getCaseListForModule(moduleId).length > 0;
        } else {
          updateModelTiming(caseGenTimingEl, buildResult.timingMs);
          commitModuleCases(moduleId, buildResult);
          hasResult = buildResult.hasResult === true;
        }
      } catch (err) {
        console.error(err);
        setCaseModuleStatus(moduleId, '生成失败：' + err.message, 'err');
        if (state.caseGenProgress[moduleId]) {
          setCaseProgressStep(moduleId, 'finalize', 'error');
        }
        updateModelTiming(caseGenTimingEl);
        setCaseModuleTiming(moduleId);
      } finally {
        if (generateBtn) {
          generateBtn.disabled = false;
          generateBtn.textContent = '生成用例';
        }
        setCaseModuleRunning(moduleId, false);
        updateSupplementButtons(moduleId, hasResult);
        renderCaseGeneration();
      }
    }

    async function topUpCasesForModule(moduleId, options) {
      options = options || {};
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return;
      setCaseModuleTiming(moduleId);
      setCaseModuleRunning(moduleId, true);
      refreshCaseGenBatchButtons();
      updateSupplementButtons(moduleId, false);
      var generateBtn = casesGenerationContainer && casesGenerationContainer.querySelector('button[data-generate="' + moduleId + '"]');
      if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.textContent = '补全中...';
      }
      setCaseModuleStatus(moduleId, '正在补全【' + mod.title + '】的测试用例...', '');
      clearCaseProgress(moduleId);
      try {
        var buildResult = await buildModuleTopup(moduleId, options);
        if (!buildResult) {
          updateModelTiming(caseGenTimingEl);
        } else if (buildResult.cancelled) {
          setCaseModuleStatus(moduleId, buildResult.statusText || '已取消补全', buildResult.statusType || 'warn');
          updateModelTiming(caseGenTimingEl);
        } else {
          updateModelTiming(caseGenTimingEl, buildResult.timingMs);
          if (buildResult.shouldCommit === false) {
            setCaseModuleStatus(moduleId, buildResult.statusText || '未补充到新的用例，请调整提示后重试', buildResult.statusType || 'warn');
            if (buildResult.finalizeStep) setCaseProgressStep(moduleId, 'finalize', buildResult.finalizeStep);
          } else {
            commitModuleCases(moduleId, buildResult);
          }
        }
      } catch (err) {
        console.error(err);
        setCaseModuleStatus(moduleId, '补全失败：' + err.message, 'err');
        if (state.caseGenProgress[moduleId]) {
          setCaseProgressStep(moduleId, 'finalize', 'error');
        }
        updateModelTiming(caseGenTimingEl);
        setCaseModuleTiming(moduleId);
      } finally {
        if (generateBtn) {
          generateBtn.disabled = false;
          generateBtn.textContent = '生成用例';
        }
        setCaseModuleRunning(moduleId, false);
        updateSupplementButtons(moduleId, getCaseListForModule(moduleId).length > 0);
        renderCaseGeneration();
      }
    }

    function exportCaseGenerationResults() {
      if (!casesGenerationContainer) return;
      if (!state.caseGenModules || !state.caseGenModules.length) {
        setStatus(caseGenStatus, '请先生成测试用例', 'warn');
        return;
      }
      try {
        var requirementLabel = ensureRequirementLabel('请输入需求标识后再导出用例');
        if (!requirementLabel) {
          setStatus(caseGenStatus, '已取消导出（需求标识为空）', 'warn');
          return;
        }
        if (!buildXmindPackageFromCases) throw new Error('缺少 XMind 导出依赖');
        var allCases = [];
        state.caseGenModules.forEach(function(mod) {
          var list = getCaseListForModule(mod.id);
          if (!Array.isArray(list) || !list.length) return;
          var moduleTitle = resolveModuleTitle(mod && (mod.title || mod.module));
          list.forEach(function(item) {
            var clone = Object.assign({}, item);
            if (!clone.module) clone.module = moduleTitle;
            allCases.push(clone);
          });
        });
        if (!allCases.length) {
          setStatus(caseGenStatus, '未找到可导出的用例，请先生成用例', 'warn');
          return;
        }
        var sanitized = sanitizeCasesForExport(allCases);
        buildXmindPackageFromCases(sanitized, requirementLabel, requirementLabel).then(function(exported) {
          downloadBlob(exported.fileName, exported.blob);
          setStatus(caseGenStatus, '已导出 ' + exported.count + ' 条用例为 XMind', 'ok');
        }).catch(function(err) {
          setStatus(caseGenStatus, err && err.message ? err.message : '导出失败', 'err');
        });
      } catch (err) {
        setStatus(caseGenStatus, err.message || '导出失败', 'err');
      }
    }

    function exportModuleCases(moduleId) {
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return;
      var list = getCaseListForModule(moduleId);
      if (!list.length) {
        setStatus(caseGenStatus, '【' + mod.title + '】还没有用例，无法导出', 'warn');
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再导出用例');
      if (!requirementLabel) {
        setStatus(caseGenStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      try {
        var rawResult = state.caseGenResults[moduleId] || JSON.stringify(list, null, 2);
        var exported = exportSingleModuleData(mod, rawResult, requirementLabel);
        var content = '#CASE_MODULE:' + mod.title + '\n' + JSON.stringify(exported.payload, null, 2);
        downloadText(exported.fileName, content);
        setStatus(caseGenStatus, '已导出【' + mod.title + '】用例（' + exported.count + ' 条）', 'ok');
      } catch (err) {
        setStatus(caseGenStatus, err.message || '导出失败', 'err');
      }
    }

    async function importModuleCases(moduleId, file) {
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod || !file) return;
      var moduleTitle = mod.title || '当前模块';
      try {
        var text = await file.text();
        var parts = text.split('\n');
        var firstLine = parts[0];
        var rest = parts.slice(1);
        if (!(firstLine && firstLine.indexOf('#CASE_MODULE:') === 0)) {
          setCaseModuleStatus(moduleId, '导入文件缺少 CASE MODULE 标识', 'err');
          return;
        }
        var tag = firstLine.replace('#CASE_MODULE:', '').trim();
        if (tag && tag !== mod.title) {
          setCaseModuleStatus(moduleId, '导入文件属于【' + tag + '】，与【' + moduleTitle + '】不匹配', 'err');
          return;
        }
        var payload = rest.join('\n').trim();
        var parsedLabel = extractRequirementLabelFromText(payload);
        if (!parsedLabel) {
          var reqMatch = payload.match(/"requir[e]?ment"\s*:\s*"([^"]+)"/i);
          if (reqMatch && reqMatch[1]) parsedLabel = normalizeRequirementName(reqMatch[1]);
        }
        if (parsedLabel) {
          setRequirementLabel(parsedLabel, 'import');
        } else {
          var ensured = await promptRequirementLabelByDrawer('请输入本次需求标识后再导入用例');
          if (!ensured) {
            setCaseModuleStatus(moduleId, '已取消导入（需求标识为空）', 'warn');
            return;
          }
        }
        if (!payload) {
          setCaseModuleStatus(moduleId, '导入文件内容为空', 'warn');
          return;
        }
        var normalized = stripCodeFence(payload);
        var parsedInfo = parseGeneratedCases(normalized);
        normalized = parsedInfo.normalized || normalized;
        state.caseGenResults[moduleId] = normalized;
        state.caseSelections[moduleId] = new Set();
        var textarea = casesGenerationContainer && casesGenerationContainer.querySelector('textarea[data-result="' + moduleId + '"]');
        if (textarea) textarea.value = normalized;
        if (exportCaseGenBtn) exportCaseGenBtn.disabled = false;
        var viewBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-view="' + moduleId + '"]');
        if (viewBtn) {
          viewBtn.disabled = false;
          viewBtn.textContent = '用例视图';
        }
        var exportBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-export="' + moduleId + '"]');
        if (exportBtn) exportBtn.disabled = false;
        var clearBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-clear="' + moduleId + '"]');
        if (clearBtn) clearBtn.disabled = false;
        closeCaseViewIfActive(moduleId);
        updateSupplementButtons(moduleId, true);
        setCaseModuleStatus(moduleId, '已导入【' + moduleTitle + '】的用例', 'ok');
        refreshAppendExistingButton();
        persistWorkflowState();
      } catch (err) {
        console.error(err);
        setCaseModuleStatus(moduleId, '导入失败：' + err.message, 'err');
      }
    }

    async function appendSelectedCasesToImported() {
      var selectedEntries = collectSelectedCaseEntries();
      if (!selectedEntries.length) {
        setStatus(caseGenStatus, '请先在用例视图勾选需要追加的用例', 'warn');
        refreshAppendExistingButton();
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再追加到已有用例');
      if (!requirementLabel) {
        setStatus(caseGenStatus, '已取消追加（需求标识为空）', 'warn');
        return;
      }
      var workflowEntries = Array.isArray(state.importedCases) ? state.importedCases : [];
      var workflowTargets = [];
      workflowEntries.forEach(function(entry, idx) {
        var list = Array.isArray(entry && entry.list) ? entry.list : [];
        if (!list.length && deriveCaseListFromText && entry && entry.text) {
          list = deriveCaseListFromText(entry.text);
        }
        if (!list || !list.length) return;
        workflowTargets.push({
          entry: entry,
          list: list,
          value: 'workflow:' + (entry.id || entry.name || ('wf-' + idx)),
        });
      });
      var hasWorkflowCases = workflowTargets.length > 0;
      var execCandidates = (getTempExecFiles() || []).filter(function(file) {
        return file && Array.isArray(file.cases) && file.cases.length;
      });
      if (!hasWorkflowCases && !execCandidates.length) {
        setStatus(caseGenStatus, '请先在“功能流程”或“用例执行”导入用例后再追加', 'warn');
        return;
      }
      var targetValue = appendTargetSelect ? appendTargetSelect.value : '';
      var targetOptions = computeAppendTargetOptions();
      var targetItem = targetOptions.find(function(opt) { return opt.value === targetValue; });
      if (!targetItem || !targetValue) {
        setStatus(caseGenStatus, '请选择目标用例后再确认新增', 'warn');
        return;
      }

      async function appendToTempExecOnly(targetFile) {
        var execInfo = normalizeCaseListWithModules(targetFile && targetFile.cases ? targetFile.cases : []);
        var additionInfo = collectAdditionsForBuckets(execInfo.buckets, selectedEntries);
        if (!additionInfo.additions.length) {
          var emptyMsgExec = additionInfo.duplicateCount
            ? '用例已经包含将要导入的用例，无需重复新增'
            : '未找到可追加的用例，请重新选择';
          setStatus(caseGenStatus, emptyMsgExec, 'warn');
          return;
        }
        var confirmPartsExec = ['将向【' + (targetFile.name || '用例') + '】追加 ' + additionInfo.additions.length + ' 条用例'];
        if (additionInfo.moduleCount) confirmPartsExec.push('涉及 ' + additionInfo.moduleCount + ' 个模块');
        if (additionInfo.duplicateCount) confirmPartsExec.push('其余 ' + additionInfo.duplicateCount + ' 条因标题重复将跳过');
        var confirmMsgExec = confirmPartsExec.join('，') + '，是否继续？';
        var prevDrawer = resolveCaseGenActiveDrawer();
        var resExec = await openConfirmDrawer({
          title: '确认追加',
          message: confirmMsgExec,
          confirmText: '确认追加',
          cancelText: '取消',
          previousDrawer: prevDrawer || null,
        });
        if (!resExec || resExec.ok !== true) {
          setStatus(caseGenStatus, '已取消追加到用例执行', 'warn');
          return;
        }
        var mergedCasesRaw = execInfo.normalized.slice();
        var startIdx = mergedCasesRaw.length;
        additionInfo.additions.forEach(function(item, idx) {
          mergedCasesRaw.push(convertCaseForExec(item, targetFile.id, startIdx + idx));
        });
        var normalizedCases = normalizeExecCaseList(mergedCasesRaw, targetFile.id);
        targetFile.cases = normalizedCases;
        targetFile.requirement = targetFile.requirement || requirementLabel;
        persistTempExecState();
        setTempExecActive(targetFile.id);
        syncTempExecFocus();
        renderTempExecView();
        if (tempExecStatus) {
          setStatus(tempExecStatus, '【' + (targetFile.name || '用例') + '】已追加 ' + additionInfo.additions.length + ' 条用例', 'ok');
        }
        var statusExec = ['成功新增到【' + (targetFile.name || '用例') + '】'];
        if (additionInfo.duplicateCount) statusExec.push('含 ' + additionInfo.duplicateCount + ' 条重复已跳过');
        setStatus(caseGenStatus, statusExec.join('，'), additionInfo.duplicateCount ? 'warn' : 'ok');
        switchTab('tempexec');
        var tempSection = document.querySelector('[data-section-id="tempexec-view"]');
        if (tempSection) scrollElementIntoView(tempSection, 'smooth', 140);
      }

      var normRequirement = normalizeRequirementName(requirementLabel);
      if (!hasWorkflowCases) {
        if (targetValue.indexOf('exec:') !== 0) {
          setStatus(caseGenStatus, '请选择执行页用例后再追加', 'warn');
          return;
        }
        var targetExecOnly = execCandidates.find(function(file) { return ('exec:' + file.id) === targetValue; });
        if (!targetExecOnly) {
          setStatus(caseGenStatus, '未找到选择的执行用例，请重新选择', 'warn');
          renderAppendTargetOptions();
          return;
        }
        await appendToTempExecOnly(targetExecOnly);
        if (appendTargetSelect) appendTargetSelect.value = '';
        state.caseGenAppendTarget = '';
        renderAppendTargetOptions();
        return;
      }
      if (targetValue.indexOf('workflow:') !== 0) {
        setStatus(caseGenStatus, '当前仅支持追加到功能流程已导入的用例', 'warn');
        return;
      }
      var targetWorkflow = workflowTargets.find(function(item) { return item.value === targetValue; });
      if (!targetWorkflow) {
        setStatus(caseGenStatus, '未找到匹配的功能流程用例，请重新选择', 'warn');
        renderAppendTargetOptions();
        return;
      }

      var workflowInfo = normalizeCaseListWithModules(targetWorkflow.list);
      var additionInfoWorkflow = collectAdditionsForBuckets(workflowInfo.buckets, selectedEntries);
      if (!additionInfoWorkflow.additions.length) {
        var emptyMsg = additionInfoWorkflow.duplicateCount
          ? '用例已经包含将要导入的用例，无需重复新增'
          : '未找到可追加的用例，请重新选择';
        setStatus(caseGenStatus, emptyMsg, 'warn');
        return;
      }

      var targetWorkflowName = stringifyCaseField(targetWorkflow.entry && targetWorkflow.entry.name) || '功能流程导入用例';
      var confirmParts = ['将向【' + targetWorkflowName + '】追加 ' + additionInfoWorkflow.additions.length + ' 条新用例'];
      if (additionInfoWorkflow.moduleCount) confirmParts.push('涉及 ' + additionInfoWorkflow.moduleCount + ' 个模块');
      if (additionInfoWorkflow.duplicateCount) confirmParts.push('其余 ' + additionInfoWorkflow.duplicateCount + ' 条因标题重复将跳过');
      var confirmMsg = confirmParts.join('，') + '，是否继续？';
      var prevDrawer2 = resolveCaseGenActiveDrawer();
      var resWorkflow = await openConfirmDrawer({
        title: '确认追加',
        message: confirmMsg,
        confirmText: '确认追加',
        cancelText: '取消',
        previousDrawer: prevDrawer2 || null,
      });
      if (!resWorkflow || resWorkflow.ok !== true) {
        setStatus(caseGenStatus, '已取消追加到已有用例', 'warn');
        return;
      }

      var mergedList = workflowInfo.normalized.concat(additionInfoWorkflow.additions);
      try {
        var mergedText = '';
        try {
          mergedText = JSON.stringify(wrapDataWithRequirement(mergedList), null, 2);
        } catch (errWrap) {
          mergedText = JSON.stringify(mergedList, null, 2);
        }
        targetWorkflow.entry.list = mergedList;
        targetWorkflow.entry.text = mergedText;
        renderImportedCaseList();
        syncCaseTextWithImports();
        refreshImportedCaseView();

        var execTarget = null;
        var sameRequirementExec = execCandidates.filter(function(file) {
          return normalizeRequirementName(file && file.requirement) === normRequirement;
        });
        if (sameRequirementExec && sameRequirementExec.length) {
          execTarget = sameRequirementExec[0];
        }

        if (execTarget) {
          var existingCases = Array.isArray(execTarget.cases) ? execTarget.cases.slice() : [];
          var existingMap = new Map();
          existingCases.forEach(function(item) {
            if (!item) return;
            var mKey = normalizeModuleKey(item.module || item.module_name || item['模块']);
            var tKey = normalizeCaseTitle(item.title || item.case_title || item['用例标题']);
            var key = mKey + '::' + tKey;
            if (!existingMap.has(key)) existingMap.set(key, item);
          });
          var usedKeys = new Set();
          var mergedExec = mergedList.map(function(item, idx) {
            var mKey = normalizeModuleKey(item.module || item.module_name || item['模块']);
            var tKey = normalizeCaseTitle(item.title || item.case_title || item['用例标题']);
            var key = mKey + '::' + tKey;
            var existing = existingMap.get(key);
            usedKeys.add(key);
            return convertCaseForExec(item, execTarget.id, idx, existing);
          });
          existingCases.forEach(function(item) {
            if (!item) return;
            var mKey = normalizeModuleKey(item.module || item.module_name || item['模块']);
            var tKey = normalizeCaseTitle(item.title || item.case_title || item['用例标题']);
            var key = mKey + '::' + tKey;
            if (usedKeys.has(key)) return;
            mergedExec.push(convertCaseForExec(item, execTarget.id, mergedExec.length, item));
          });
          execTarget.cases = normalizeExecCaseList(mergedExec, execTarget.id);
          execTarget.requirement = execTarget.requirement || requirementLabel;
          execTarget.reuseEnabled = Boolean(execTarget.reuseEnabled);
          persistTempExecState();
          setTempExecActive(execTarget.id);
          syncTempExecFocus();
          renderTempExecView();
          if (tempExecStatus) {
            var execMsg = hasExecutionData(execTarget)
              ? '【' + (execTarget.name || '用例') + '】已同步新用例并保留执行记录'
              : '【' + (execTarget.name || '用例') + '】已同步新用例';
            setStatus(tempExecStatus, execMsg, 'ok');
          }
          var statusParts = ['成功新增到【' + targetWorkflowName + '】并同步到执行'];
          if (additionInfoWorkflow.duplicateCount) statusParts.push('含 ' + additionInfoWorkflow.duplicateCount + ' 条重复已跳过');
          setStatus(caseGenStatus, statusParts.join('，'), additionInfoWorkflow.duplicateCount ? 'warn' : 'ok');
        } else {
          var fallbackName = targetWorkflowName || '导入用例';
          var baseName = getSafeFileBaseName(
            targetWorkflow.entry && (targetWorkflow.entry.name || targetWorkflow.entry.fileName || fallbackName),
            fallbackName
          );
          var compactTs = formatCompactTimestamp ? formatCompactTimestamp() : '';
          var entryName = baseName + (compactTs ? ('_' + compactTs) : '');
          var entry = createTempExecFile(entryName, mergedList, 'current', null, null, requirementLabel);
          if (!entry) {
            setStatus(caseGenStatus, '未构建出可同步的用例，请检查数据格式', 'err');
            return;
          }
          entry.fromCaseGen = true;
          if (!ensureTempExecReplacement(entry)) {
            setStatus(caseGenStatus, '已取消转到用例执行', 'warn');
            return;
          }
          state.tempExecFiles.push(entry);
          syncTempExecFocus();
          state.tempExecPages[entry.id] = 0;
          persistTempExecState();
          setTempExecActive(entry.id);
          if (tempExecStatus) {
            setStatus(tempExecStatus, '【' + entry.name + '】已同步 ' + entry.cases.length + ' 条用例', 'ok');
          }
          var statusNew = ['成功新增到【' + targetWorkflowName + '】并同步到执行'];
          if (additionInfoWorkflow.duplicateCount) statusNew.push('含 ' + additionInfoWorkflow.duplicateCount + ' 条重复已跳过');
          setStatus(caseGenStatus, statusNew.join('，'), additionInfoWorkflow.duplicateCount ? 'warn' : 'ok');
        }

        switchTab('tempexec');
        var tempViewSection = document.querySelector('[data-section-id="tempexec-view"]');
        if (tempViewSection) scrollElementIntoView(tempViewSection, 'smooth', 140);
        if (appendTargetSelect) appendTargetSelect.value = '';
        state.caseGenAppendTarget = '';
        renderAppendTargetOptions();
        persistWorkflowState();
      } catch (err) {
        console.error(err);
        setStatus(caseGenStatus, '追加失败：' + err.message, 'err');
      }
    }

    async function transferSelectedCasesToExec() {
      if (!state.caseGenModules || !state.caseGenModules.length) {
        setStatus(caseGenStatus, '请先前往“测试模块拆分”完成拆分后再转到执行页', 'warn');
        return;
      }
      var hasGenerated = state.caseGenModules.some(function(mod) {
        var list = getCaseListForModule(mod.id);
        return list && list.length;
      });
      if (!hasGenerated) {
        setStatus(caseGenStatus, '当前尚未生成用例，请先生成用例后再转到执行页', 'warn');
        return;
      }
      var selectedEntries = collectSelectedCaseEntries();
      if (!selectedEntries.length) {
        var autoOpened = false;
        state.caseGenModules.some(function(mod) {
          var list = getCaseListForModule(mod.id);
          if (!list || !list.length) return false;
          toggleCaseView(mod.id);
          autoOpened = true;
          return true;
        });
        setStatus(
          caseGenStatus,
          autoOpened ? '请先勾选用例后再转到执行页（已自动打开首个模块）' : '请到各个模块的用例视图中勾选用例（点击右侧“用例视图”按钮）',
          'warn'
        );
        refreshAppendExistingButton();
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再转到用例执行');
      if (!requirementLabel) {
        setStatus(caseGenStatus, '已取消转到执行页（需求标识为空）', 'warn');
        return;
      }
      var hasWorkflow = hasImportedCases && hasImportedCases();
      var execFiles = getTempExecFiles() || [];
      var hasExec = execFiles && execFiles.length > 0;
      if (hasWorkflow || hasExec) {
        var confirmed = window.confirm('可进行用例合并，确认不进行合并直接使用所选用例？');
        if (!confirmed) {
          setStatus(caseGenStatus, '已取消直接转到执行页，请在上方选择目标用例后再试', 'warn');
          try {
            if (typeof window !== 'undefined' && window.scrollTo) {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          } catch (errScroll) {
            // ignore
          }
          return;
        }
      }
      var combinedCases = [];
      selectedEntries.forEach(function(entry) {
        if (entry && Array.isArray(entry.cases)) combinedCases = combinedCases.concat(entry.cases);
      });
      var sanitized = sanitizeCasesForExport(combinedCases);
      if (!sanitized.length) {
        setStatus(caseGenStatus, '未找到可转移的用例，请重新选择', 'warn');
        return;
      }
      var entryName = getSafeFileBaseName(requirementLabel || '勾选用例', '勾选用例');
      var entry = createTempExecFile(entryName, sanitized, 'current', null, null, requirementLabel);
      if (!entry) {
        setStatus(caseGenStatus, '未生成可执行的用例，请检查数据格式', 'err');
        return;
      }
      entry.fromCaseGen = true;
      if (!ensureTempExecReplacement(entry)) {
        setStatus(caseGenStatus, '已取消转到用例执行', 'warn');
        return;
      }
      state.tempExecFiles.push(entry);
      syncTempExecFocus();
      state.tempExecPages[entry.id] = 0;
      persistTempExecState();
      setTempExecActive(entry.id);
      if (tempExecStatus) {
        setStatus(tempExecStatus, '【' + (entry.name || '用例') + '】已导入 ' + entry.cases.length + ' 条用例', 'ok');
      }
      setStatus(caseGenStatus, '已将 ' + entry.cases.length + ' 条勾选用例转到执行页', 'ok');
      switchTab('tempexec');
      var tempViewSection = document.querySelector('[data-section-id="tempexec-view"]');
      if (tempViewSection) scrollElementIntoView(tempViewSection, 'smooth', 140);
      refreshAppendExistingButton();
    }

    async function transferModuleToTempExec(moduleId) {
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return;
      if (isCaseModuleRunning(moduleId)) {
        setStatus(caseGenStatus, '【' + mod.title + '】正在生成，请稍后再试', 'warn');
        return;
      }
      var list = getCaseListForModule(moduleId);
      var selection = state.caseSelections[moduleId];
      if (!list.length) {
        setStatus(caseGenStatus, '【' + mod.title + '】暂无可转移的用例', 'warn');
        updateSupplementButtons(moduleId, false);
        return;
      }
      if (!selection || !selection.size) {
        setStatus(caseGenStatus, '请先在用例视图中勾选需要转移的用例', 'warn');
        updateSupplementButtons(moduleId, true);
        return;
      }
      var selectedList = list.filter(function(_, idx) { return selection.has(idx); });
      if (!selectedList.length) {
        setStatus(caseGenStatus, '当前未勾选可转移的用例', 'warn');
        updateSupplementButtons(moduleId, true);
        return;
      }
      var transferBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-tempexec="' + moduleId + '"]');
      var originalLabel = transferBtn ? transferBtn.textContent : '';
      if (transferBtn) {
        transferBtn.disabled = true;
        transferBtn.textContent = '准备中...';
      }
      try {
        if (!buildXmindPackageFromCases) throw new Error('缺少 XMind 导出依赖');
        var exported = await buildXmindPackageFromCases(selectedList, mod.title, getRequirementLabel(true));
        downloadBlob(exported.fileName, exported.blob);
        var entryName = mod.title || '测试用例';
        var entry = createTempExecFile(entryName, selectedList, 'current', null, null, getRequirementLabel(true));
        if (!entry) {
          setStatus(caseGenStatus, '转移失败：未构建出有效的执行用例', 'err');
          return;
        }
        if (!ensureTempExecReplacement(entry)) {
          setStatus(caseGenStatus, '已取消转到用例执行', 'warn');
          return;
        }
        state.tempExecFiles.push(entry);
        syncTempExecFocus();
        state.tempExecPages[entry.id] = 0;
        persistTempExecState();
        setTempExecActive(entry.id);
        if (tempExecStatus) {
          setStatus(tempExecStatus, '【' + entry.name + '】已导入 ' + entry.cases.length + ' 条用例', 'ok');
        }
        setStatus(caseGenStatus, '已导出 ' + exported.count + ' 条用例为 XMind，并同步到用例执行', 'ok');
        switchTab('tempexec');
        var tempViewSection = document.querySelector('[data-section-id="tempexec-view"]');
        if (tempViewSection) scrollElementIntoView(tempViewSection, 'smooth', 140);
      } catch (err) {
        console.error(err);
        setStatus(caseGenStatus, '转到用例执行失败：' + err.message, 'err');
      } finally {
        if (transferBtn) {
          transferBtn.textContent = originalLabel || '转到用例执行';
        }
        updateSupplementButtons(moduleId, getCaseListForModule(moduleId).length > 0);
      }
    }

    function clearModuleCases(moduleId) {
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return;
      if (!state.caseGenResults[moduleId]) {
        setCaseModuleStatus(moduleId, '【' + mod.title + '】暂无可清除的用例', 'warn');
        return;
      }
      var moduleTitle = resolveModuleTitle(mod.title || mod.module || '');
      openConfirmDrawer({
        title: '确认清除用例',
        message: '确定要清除【' + moduleTitle + '】的用例吗？',
        confirmText: '清除',
        cancelText: '取消',
        previousDrawer: resolveCaseGenActiveDrawer(),
      }).then(function(res) {
        if (!res || res.ok !== true) return;
        delete state.caseGenResults[moduleId];
        delete state.caseSelections[moduleId];
        var textarea = casesGenerationContainer && casesGenerationContainer.querySelector('textarea[data-result="' + moduleId + '"]');
        if (textarea) textarea.value = '';
        var viewBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-view="' + moduleId + '"]');
        if (viewBtn) {
          viewBtn.disabled = true;
          viewBtn.textContent = '用例视图';
        }
        var exportBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-export="' + moduleId + '"]');
        if (exportBtn) exportBtn.disabled = true;
        var clearBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-clear="' + moduleId + '"]');
        if (clearBtn) clearBtn.disabled = true;
        closeCaseViewIfActive(moduleId);
        updateSupplementButtons(moduleId, false);
        clearCaseModuleStatus(moduleId);
        clearCaseProgress(moduleId);
        setCaseModuleStatus(moduleId, '已清除【' + moduleTitle + '】的用例', 'ok');
        refreshExportCaseGenButton();
        refreshAppendExistingButton();
        refreshExportCaseGenXmindButton();
        refreshCaseGenBatchButtons();
        persistWorkflowState();
      });
    }

    function toggleCaseView(moduleId) {
      if (!casesGenerationContainer) return;
      var viewBtn = casesGenerationContainer.querySelector('[data-view="' + moduleId + '"]');
      var drawer = ensureCaseGenDrawer();
      if (!viewBtn || !drawer || !caseGenViewDrawerBody) return;
      var drawerEl = drawer.element;
      var isOpenCurrent = drawerEl && drawerEl.classList.contains('open') && activeCaseViewModuleId === moduleId;
      if (isOpenCurrent) {
        drawer.close();
        return;
      }
      var content = state.caseGenResults[moduleId];
      if (!content) {
        setStatus(caseGenStatus, '该模块尚未生成用例', 'warn');
        return;
      }
      var list = parseCaseList(content);
      if (!list.length) {
        setStatus(caseGenStatus, '解析到的用例列表为空，请确认模型输出 JSON', 'warn');
        return;
      }
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      var moduleTitle = resolveModuleTitle(mod && (mod.title || mod.module));
      caseGenViewDrawerBody.innerHTML = '' +
        '<div class="caseview drawer-view visible" data-view-container="' + moduleId + '">' +
          renderCaseTable(mod, list, { selectable: true, moduleId: moduleId, showRemark: true }) +
        '</div>';
      if (caseGenViewDrawerTitle) {
        caseGenViewDrawerTitle.textContent = '用例视图 - ' + moduleTitle;
      }
      if (activeCaseViewModuleId && activeCaseViewModuleId !== moduleId) {
        resetCaseViewButton(activeCaseViewModuleId);
      }
      activeCaseViewModuleId = moduleId;
      viewBtn.textContent = '收起用例视图';
      toggleCaseGenAllSelectButton(false);
      drawer.open();
      refreshCaseSelectionUI(moduleId);
    }

    function handleCaseSelectionChange(moduleId, index, checked) {
      var selection = ensureCaseSelectionSet(moduleId);
      if (checked) selection.add(index);
      else selection.delete(index);
      if (selection.size > 0) clearAllCaseGenSelectionHints();
      refreshCaseSelectionUI(moduleId);
      updateSupplementButtons(moduleId, getCaseListForModule(moduleId).length > 0);
      updateCaseGenAllSelectionButton();
      persistWorkflowState();
    }

    function handleCaseSelectAll(moduleId, checked) {
      var container = getCaseViewContainer(moduleId);
      if (!container) return;
      var selection = ensureCaseSelectionSet(moduleId);
      selection.clear();
      if (checked) {
        var rowCheckboxes = container.querySelectorAll('input[data-case-select="' + moduleId + '"]');
        rowCheckboxes.forEach(function(cb) { selection.add(Number(cb.dataset.index)); });
      }
      if (selection.size > 0) clearAllCaseGenSelectionHints();
      refreshCaseSelectionUI(moduleId);
      updateSupplementButtons(moduleId, getCaseListForModule(moduleId).length > 0);
      updateCaseGenAllSelectionButton();
      persistWorkflowState();
    }

    function handleCaseSelectAllModules() {
      var items = collectGeneratedModules();
      if (!items.length) return;
      var stats = getCaseGenAllSelectionStats();
      var shouldSelect = stats.selected < stats.total;
      items.forEach(function(entry) {
        var moduleId = entry.mod.id;
        var list = entry.list || [];
        var selection = ensureCaseSelectionSet(moduleId);
        selection.clear();
        if (shouldSelect) {
          for (var i = 0; i < list.length; i += 1) selection.add(i);
        }
      });
      if (shouldSelect) clearAllCaseGenSelectionHints();
      items.forEach(function(entry) {
        refreshCaseSelectionUI(entry.mod.id);
        updateSupplementButtons(entry.mod.id, (entry.list || []).length > 0);
      });
      refreshExportCaseGenXmindButton();
      updateCaseGenAllSelectionButton();
      persistWorkflowState();
    }

    function exportSelectedCases(moduleId) {
      var selection = state.caseSelections[moduleId];
      if (!selection || !selection.size) {
        setStatus(caseGenStatus, '请选择需要导出的用例', 'warn');
        return;
      }
      var list = getCaseListForModule(moduleId);
      if (!list.length) {
        setStatus(caseGenStatus, '当前模块没有可导出的用例', 'warn');
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再导出用例');
      if (!requirementLabel) {
        setStatus(caseGenStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      var name = mod && mod.title ? mod.title : '模块';
      try {
        var exported = exportSelectedCasesData(selection, list, name, requirementLabel);
        downloadText(exported.fileName, JSON.stringify(exported.payload, null, 2));
        setStatus(caseGenStatus, '已导出【' + name + '】选中的 ' + exported.count + ' 条用例', 'ok');
      } catch (err) {
        setStatus(caseGenStatus, err.message || '导出失败', 'err');
      }
    }

    async function exportSelectedCasesToXmind(moduleId) {
      var selection = state.caseSelections[moduleId];
      if (!selection || !selection.size) {
        setStatus(caseGenStatus, '请选择需要转换的用例', 'warn');
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再导出 XMind 用例');
      if (!requirementLabel) {
        setStatus(caseGenStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      var list = getCaseListForModule(moduleId);
      if (!list.length) {
        setStatus(caseGenStatus, '当前用例无法解析，请重新生成后再导出', 'warn');
        return;
      }
      var selectedCases = list.filter(function(_, idx) { return selection.has(idx); });
      if (!selectedCases.length) {
        setStatus(caseGenStatus, '请选择至少一条用例后再导出', 'warn');
        return;
      }
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      try {
        if (!buildXmindPackageFromCases) throw new Error('缺少 XMind 导出依赖');
        var exported = await buildXmindPackageFromCases(selectedCases, mod && mod.title ? mod.title : '模块', requirementLabel);
        downloadBlob(exported.fileName, exported.blob);
        setStatus(caseGenStatus, '已导出 ' + exported.count + ' 条用例为 XMind', 'ok');
      } catch (err) {
        console.error(err);
        setStatus(caseGenStatus, 'XMind 导出失败：' + err.message, 'err');
      }
    }

    async function exportSelectedModulesToXmind() {
      var selectedEntries = collectSelectedCaseEntries();
      if (!selectedEntries.length) {
        setStatus(caseGenStatus, '请先在用例视图勾选需要导出的用例', 'warn');
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再导出所选 XMind 用例');
      if (!requirementLabel) {
        setStatus(caseGenStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      var aggregated = [];
      selectedEntries.forEach(function(entry) {
        var moduleTitle = resolveModuleTitle(entry && entry.moduleTitle);
        (entry.cases || []).forEach(function(item) {
          var clone = Object.assign({}, item);
          if (!clone.module) clone.module = moduleTitle;
          aggregated.push(clone);
        });
      });
      if (!aggregated.length) {
        setStatus(caseGenStatus, '未找到可导出的用例，请检查勾选内容', 'warn');
        return;
      }
      try {
        if (!buildXmindPackageFromCases) throw new Error('缺少 XMind 导出依赖');
        var exported = await buildXmindPackageFromCases(aggregated, requirementLabel, requirementLabel);
        downloadBlob(exported.fileName, exported.blob);
        setStatus(caseGenStatus, '已导出选中用例为 XMind（' + exported.count + ' 条）', 'ok');
      } catch (err) {
        console.error(err);
        setStatus(caseGenStatus, 'XMind 导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      }
    }

    function exportSelectedCasesData(selection, list, moduleTitle, requirementLabel) {
      if (!selection || !selection.size) throw new Error('未选中用例');
      if (!Array.isArray(list) || !list.length) throw new Error('当前模块没有可导出的用例');
      var selectedList = list.filter(function(_, idx) { return selection.has(idx); });
      if (!selectedList.length) throw new Error('请选择至少一条用例');
      var sanitized = sanitizeCasesForExport(selectedList);
      var name = moduleTitle || '模块';
      var payload = wrapDataWithRequirement({ module: name, cases: sanitized });
      var fileName = 'selected_' + getSafeRequirementSlug() + '_' + name + '_' + formatCompactTimestamp() + '.json';
      return { payload: payload, fileName: fileName, count: selectedList.length };
    }

    function exportAllModulesData(modules, caseGenResults, requirementLabel) {
      if (!Array.isArray(modules) || !modules.length) throw new Error('尚未生成任何用例，无法导出');
      var payload = modules.map(function(mod) {
        var raw = caseGenResults[mod.id] || '';
        var cases = [];
        try {
          cases = JSON.parse(raw || '[]');
        } catch (err) {
          cases = [];
        }
        return {
          module: normalizeRequirementName(mod.title || mod.module || ''),
          cases: sanitizeCasesForExport(cases),
        };
      });
      var fileName = 'usecases_' + getSafeRequirementSlug() + '_' + formatCompactTimestamp() + '.json';
      var count = payload.reduce(function(sum, mod) { return sum + (mod.cases ? mod.cases.length : 0); }, 0);
      return { payload: payload, fileName: fileName, count: count };
    }

    function exportSingleModuleData(mod, rawResult, requirementLabel) {
      if (!mod) throw new Error('未找到模块');
      var raw = rawResult || '';
      var parsed = [];
      try {
        parsed = JSON.parse(raw || '[]');
      } catch (err) {
        parsed = [];
      }
      if (!parsed.length) throw new Error('该模块尚未生成用例');
      var sanitized = sanitizeCasesForExport(parsed);
      var fileName = 'usecases_' + normalizeRequirementName(mod.title || mod.module || 'module') + '_' + formatCompactTimestamp();
      return { payload: sanitized, fileName: fileName, count: sanitized.length };
    }

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
      setCaseGenDbStoreNewAction: setCaseGenDbStoreNewAction,
      clearCaseGenDbStoreNewActionError: clearCaseGenDbStoreNewActionError,
      openCaseGenDbStoreNewDrawer: function() { bindCaseGenDbStoreEvents(); return openCaseGenDbStoreNewDrawer(); },
      openCaseGenDbStoreAppendDrawer: function() { bindCaseGenDbStoreEvents(); return openCaseGenDbStoreAppendDrawer(); },
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
