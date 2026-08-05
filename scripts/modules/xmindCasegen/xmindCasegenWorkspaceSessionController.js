(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenWorkspaceSessionController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state || {};
    var documentObj = opts.documentObj || (typeof document !== 'undefined' ? document : null);
    var drawerEl = opts.drawerEl || null;
    var workspaceListEl = opts.workspaceListEl || null;
    var workspaceAddBtn = opts.workspaceAddBtn || null;
    var prepApi = opts.prepApi || null;
    var workspaceLimit = Math.max(1, Number(opts.workspaceLimit || 3));
    var stepRequirement = Number(opts.stepRequirement || 1);
    var model = opts.model || {};
    var workspace = opts.workspace || {};
    var view = opts.view || {};
    var tasks = opts.tasks || {};
    var ui = opts.ui || {};
    var workflow = opts.workflow || {};
    var environment = opts.environment || {};
    var now = typeof opts.now === 'function' ? opts.now : function() { return Date.now(); };

    function port(owner, name, fallback) {
      return owner && typeof owner[name] === 'function' ? owner[name] : (fallback || noop);
    }

    var cloneJson = port(model, 'cloneJson', function(value, fallback) { return value || fallback; });
    var cloneSelectionMap = port(model, 'cloneSelectionMap', function(value) { return cloneJson(value, {}); });
    var restoreSelectionMap = port(model, 'restoreSelectionMap', function(value) { return cloneJson(value, {}); });
    var normalizeWorkspaceSharedState = port(model, 'normalizeWorkspaceSharedState', function(value) { return value || {}; });
    var cloneCaseGenSettingsValue = port(model, 'cloneCaseGenSettingsValue', function(value) { return cloneJson(value, {}); });
    var createDefaultCaseGenSettings = port(model, 'createDefaultCaseGenSettings', function() { return {}; });
    var normalizePersistedRequirementLabel = port(model, 'normalizePersistedRequirementLabel', function(value) {
      return value === null || value === undefined ? '' : String(value || '').trim();
    });
    var normalizeRequirementLabelFromFileName = port(model, 'normalizeRequirementLabelFromFileName', function() { return ''; });
    var cloneRequirementMediaValue = port(model, 'cloneRequirementMediaValue', function(value) { return cloneJson(value, {}); });
    var createInitialXmindState = port(model, 'createInitialXmindState', function() { return {}; });
    var createWorkspaceSnapshot = port(model, 'createWorkspaceSnapshot', function() { return {}; });
    var createDefaultViewState = port(model, 'createDefaultViewState', function() { return {}; });
    var normalizeStoredViewState = port(model, 'normalizeStoredViewState', function(value) { return value || {}; });
    var normalizeWorkspaceSnapshot = port(model, 'normalizeWorkspaceSnapshot', function(value) { return value || {}; });
    var workspaceSnapshotHasContent = port(model, 'workspaceSnapshotHasContent', function() { return false; });
    var workspaceSnapshotHasPrepDraft = port(model, 'workspaceSnapshotHasPrepDraft', function() { return false; });
    var workspaceSnapshotHasGeneratedContent = port(model, 'workspaceSnapshotHasGeneratedContent', function() { return false; });
    var summarizeVisibleModuleContext = port(model, 'summarizeVisibleModuleContext', function() {
      return { moduleCount: 0, caseCount: 0 };
    });
    var buildVisibleModuleContext = port(model, 'buildVisibleModuleContext', function() { return {}; });
    var buildWorkspaceVisibleModuleContextFromSnapshot = port(
      model,
      'buildWorkspaceVisibleModuleContextFromSnapshot',
      function() { return {}; }
    );
    var escapeHtml = port(model, 'escapeHtml', function(value) { return String(value || ''); });

    var ensureState = port(opts, 'ensureState', port(workspace, 'ensureState', function() { return {}; }));
    var extractActiveXmindStateSnapshot = port(workspace, 'extractActiveXmindStateSnapshot', function() { return {}; });
    var applyActiveXmindStateSnapshot = port(workspace, 'applyActiveXmindStateSnapshot');
    var createWorkspaceRecord = port(workspace, 'createWorkspaceRecord', function(id, recordOptions) {
      return { id: id, snapshot: recordOptions && recordOptions.snapshot ? recordOptions.snapshot : {} };
    });
    var getWorkspaceHostState = port(workspace, 'getWorkspaceHostState', function() { return {}; });
    var ensureWorkspaceHostState = port(workspace, 'ensureWorkspaceHostState', getWorkspaceHostState);
    var getActiveWorkspaceId = port(workspace, 'getActiveWorkspaceId', function() { return ''; });
    var getWorkspaceUiSelectedId = port(workspace, 'getWorkspaceUiSelectedId', getActiveWorkspaceId);
    var setMirrorWorkspaceSelection = port(workspace, 'setMirrorWorkspaceSelection', function(value) { return value; });
    var getWorkspaceRecord = port(workspace, 'getWorkspaceRecord', function() { return null; });
    var clearManagedTasksForWorkspace = port(workspace, 'clearManagedTasksForWorkspace', function() { return 0; });
    var rotateWorkspaceGeneration = port(workspace, 'rotateWorkspaceGeneration', function() { return ''; });
    var saveActiveWorkspaceSnapshot = port(workspace, 'saveActiveWorkspaceSnapshot', function() { return false; });
    var hydrateWorkspaceSnapshot = port(workspace, 'hydrateWorkspaceSnapshot', function() { return false; });
    var buildWorkspaceDisplayName = port(workspace, 'buildWorkspaceDisplayName', function(record) {
      return record && record.name ? String(record.name || '') : '';
    });
    var buildWorkspaceId = port(workspace, 'buildWorkspaceId', function(seq) { return 'workspace-' + String(seq || 1); });
    var buildDefaultWorkspaceRecordName = port(workspace, 'buildDefaultWorkspaceRecordName', function(seq) {
      return '生成' + String(seq || 1);
    });
    var isDefaultWorkspaceRecordName = port(workspace, 'isDefaultWorkspaceRecordName', function() { return false; });
    var resetActiveWorkspaceRecordNameToDefault = port(workspace, 'resetActiveWorkspaceRecordNameToDefault');
    var resetActiveWorkspaceRecordSnapshotToInitial = port(workspace, 'resetActiveWorkspaceRecordSnapshotToInitial');
    var persistXmindState = port(workspace, 'persistXmindState');

    var getViewState = port(view, 'getViewState', function() { return {}; });
    var captureCurrentViewState = port(view, 'captureCurrentViewState', getViewState);
    var captureVisibleMindViewStateFromDom = port(view, 'captureVisibleMindViewStateFromDom', function() { return null; });
    var getWorkspaceStoredViewState = port(view, 'getWorkspaceStoredViewState', function() { return {}; });
    var shouldRestoreWorkspaceViewport = port(view, 'shouldRestoreWorkspaceViewport', function() { return false; });
    var normalizeWorkspaceRenderViewState = port(view, 'normalizeWorkspaceRenderViewState', function() { return null; });
    var invalidateWorkspaceViewRestore = port(view, 'invalidateWorkspaceViewRestore');
    var cancelQueuedMindRender = port(view, 'cancelQueuedMindRender');

    var listManagedXmindTasks = port(tasks, 'listManagedXmindTasks', function() { return []; });
    var getTaskWorkspaceId = port(tasks, 'getTaskWorkspaceId', function(task) {
      return task && task.workspaceId ? String(task.workspaceId || '') : '';
    });
    var filterTasksByWorkspace = port(tasks, 'filterTasksByWorkspace', function(list, workspaceId) {
      return (Array.isArray(list) ? list : []).filter(function(task) {
        return getTaskWorkspaceId(task) === String(workspaceId || '');
      });
    });
    var isManagedTaskTerminal = port(tasks, 'isManagedTaskTerminal', function() { return false; });
    var consumeManagedXmindTask = port(tasks, 'consumeManagedXmindTask');
    var syncManagedRunningUiState = port(tasks, 'syncManagedRunningUiState');

    var syncCasesGenPageRender = port(ui, 'syncCasesGenPageRender');
    var syncCasegenProgressSidebar = port(ui, 'syncCasegenProgressSidebar');
    var syncOpenButtonState = port(ui, 'syncOpenButtonState');
    var syncKnowledgeBaseToolbarState = port(ui, 'syncKnowledgeBaseToolbarState');
    var renderOpenedSummaryDialog = port(ui, 'renderOpenedSummaryDialog');
    var renderCaseGenProgressBoard = port(ui, 'renderCaseGenProgressBoard');
    var openSummaryDialog = port(ui, 'openSummaryDialog');
    var closeSummaryDialog = port(ui, 'closeSummaryDialog');
    var notifyInlineStatus = port(ui, 'notifyInlineStatus');
    var notifyFloatingStatus = port(ui, 'notifyFloatingStatus');
    var notifySuccessToast = port(ui, 'notifySuccessToast');
    var setDebugState = port(ui, 'setDebugState');
    var render = port(ui, 'render');
    var openDrawer = port(ui, 'openDrawer');
    var openStoreConfirmDialog = port(ui, 'openStoreConfirmDialog', function() { return Promise.resolve(false); });

    var getPrepState = port(workflow, 'getPrepState', function() { return {}; });
    var createDefaultPrepState = port(workflow, 'createDefaultPrepState', function() { return {}; });
    var getManualRequirementLabelText = port(workflow, 'getManualRequirementLabelText', function() { return ''; });
    var getDocumentRequirementLabelText = port(workflow, 'getDocumentRequirementLabelText', function() { return ''; });
    var getSelectedRequirementSource = port(workflow, 'getSelectedRequirementSource', function() {
      return { mode: 'document' };
    });
    var getCasesCoreApi = port(workflow, 'getCasesCoreApi', function() { return null; });
    var hasImportedBaselineCases = port(workflow, 'hasImportedBaselineCases', function() { return false; });
    var hasAnyRunningGenerationOperation = port(workflow, 'hasAnyRunningGenerationOperation', function() { return false; });
    var clearStoreValidationState = port(workflow, 'clearStoreValidationState');
    var cleanupTopupHighlightPresentation = port(workflow, 'cleanupTopupHighlightPresentation');
    var clearDrawerRestoreRetry = port(workflow, 'clearDrawerRestoreRetry');
    var clearDeleteHistoryStacks = port(workflow, 'clearDeleteHistoryStacks');
    var destroyMind = port(workflow, 'destroyMind');
    var shouldXmindOwnLiveWorkspaceState = port(workflow, 'shouldXmindOwnLiveWorkspaceState', function() { return true; });
    var shouldSyncLegacyBeforeOpen = port(workflow, 'shouldSyncLegacyBeforeOpen', function() { return false; });
    var syncLegacyWorkflowContext = port(workflow, 'syncLegacyWorkflowContext');
    var persistWorkflowState = port(workflow, 'persistWorkflowState');
    var persistWorkflowStateNow = port(workflow, 'persistWorkflowStateNow', persistWorkflowState);
    var cloneModulesWithoutCases = port(workflow, 'cloneModulesWithoutCases', function(value) {
      return cloneJson(value, []);
    });
    var buildCompactRootPipelineRestoreSnapshot = port(
      workflow,
      'buildCompactRootPipelineRestoreSnapshot',
      function(value) { return cloneJson(value, null); }
    );
    var cloneRootPipelineSnapshot = port(workflow, 'cloneRootPipelineSnapshot', function(value) {
      return cloneJson(value, null);
    });
    var getRootPipelineState = port(workflow, 'getRootPipelineState', function() { return null; });
    var setRootPipelineState = port(workflow, 'setRootPipelineState');
    var mergeRestoreResultMap = port(workflow, 'mergeRestoreResultMap', function(_, current) { return current || {}; });
    var buildOperationSnapshotRestoreVersion = port(
      workflow,
      'buildOperationSnapshotRestoreVersion',
      function(list, nextSnapshotId) { return { list: list || [], nextSnapshotId: nextSnapshotId || 1 }; }
    );
    var shouldPreferRestoreOperationSnapshots = port(
      workflow,
      'shouldPreferRestoreOperationSnapshots',
      function() { return false; }
    );
    var syncCaseGenOperationPointersLocal = port(workflow, 'syncCaseGenOperationPointersLocal');
    var deriveNextOperationSnapshotId = port(workflow, 'deriveNextOperationSnapshotId', function(_, value) {
      return Number(value || 1);
    });
    var mergeRootPipelineSnapshot = port(workflow, 'mergeRootPipelineSnapshot', function(current) { return current; });
    var mergeStoredViewState = port(workflow, 'mergeStoredViewState', function(current) { return current; });
    var scheduleRecoveredStatePersist = port(workflow, 'scheduleRecoveredStatePersist');
    var flushDeferredCasesGenPageRender = port(workflow, 'flushDeferredCasesGenPageRender');
    var scheduleManagedTaskReconcile = port(workflow, 'scheduleManagedTaskReconcile');

    var getWorkspaceShadowDepth = port(environment, 'getWorkspaceShadowDepth', function() { return 0; });
    var setWorkspaceShadowDepth = port(environment, 'setWorkspaceShadowDepth');
    var getWorkspaceUiMutedDepth = port(environment, 'getWorkspaceUiMutedDepth', function() { return 0; });
    var setWorkspaceUiMutedDepth = port(environment, 'setWorkspaceUiMutedDepth');
    var getShadowWorkspaceSharedState = port(environment, 'getShadowWorkspaceSharedState', function() { return null; });
    var setShadowWorkspaceSharedState = port(environment, 'setShadowWorkspaceSharedState');
    var isDrawerOpen = port(environment, 'isDrawerOpen', function() { return false; });
    var isDrawerFullscreen = port(environment, 'isDrawerFullscreen', function() { return false; });
    var isDrawerRestoreInFlight = port(environment, 'isDrawerRestoreInFlight', function() { return false; });
    var setPendingDrawerOpenWorkspaceId = port(environment, 'setPendingDrawerOpenWorkspaceId');
    var getManualImageInputEl = port(environment, 'getManualImageInputEl', function() { return null; });

    function getWorkspaceLimitText() {
      return '最多仅支持 ' + String(workspaceLimit) + ' 个生成页签';
    }

    function buildCurrentSharedWorkspaceSnapshot() {
      var rawTextEl = documentObj && documentObj.getElementById ? documentObj.getElementById('rawText') : null;
      var caseTextEl = documentObj && documentObj.getElementById ? documentObj.getElementById('caseText') : null;
      var shadowSource = getShadowWorkspaceSharedState();
      var shadowBase = getWorkspaceShadowDepth() > 0 && shadowSource
        ? normalizeWorkspaceSharedState(shadowSource)
        : null;
      var activeRecord = getWorkspaceRecord(getActiveWorkspaceId());
      var recordShared = activeRecord && activeRecord.snapshot && activeRecord.snapshot.shared
        ? normalizeWorkspaceSharedState(activeRecord.snapshot.shared)
        : null;
      var requirementLabel = normalizePersistedRequirementLabel(state.requirementLabel);
      var requirementLabelSource = state.requirementLabelSource ? String(state.requirementLabelSource || '') : '';
      var lastRawImportName = state.lastRawImportName ? String(state.lastRawImportName || '') : '';
      if (!requirementLabel && recordShared) {
        requirementLabel = normalizePersistedRequirementLabel(recordShared.requirementLabel);
        if (!requirementLabelSource && requirementLabel) {
          requirementLabelSource = recordShared.requirementLabelSource
            ? String(recordShared.requirementLabelSource || '')
            : '';
        }
      }
      if (!lastRawImportName && recordShared && recordShared.lastRawImportName) {
        lastRawImportName = String(recordShared.lastRawImportName || '');
      }
      return normalizeWorkspaceSharedState({
        requirementLabel: requirementLabel,
        requirementLabelSource: requirementLabelSource,
        lastRawImportName: lastRawImportName,
        rawText: shadowBase ? shadowBase.rawText : (rawTextEl && rawTextEl.value ? rawTextEl.value : ''),
        caseText: shadowBase ? shadowBase.caseText : (caseTextEl && caseTextEl.value ? caseTextEl.value : ''),
        importedCases: state.importedCases,
        caseGenModules: state.caseGenModules,
        caseGenSource: state.caseGenSource,
        caseGenResults: state.caseGenResults,
        caseSelections: cloneSelectionMap(state.caseSelections),
        caseGenSuggestions: state.caseGenSuggestions,
        caseGenModuleStatus: state.caseGenModuleStatus,
        caseGenProgress: state.caseGenProgress,
        caseGenTiming: state.caseGenTiming,
        caseGenProgressNotice: state.caseGenProgressNotice,
        caseGenSettings: state.caseGenSettings,
        requirementMedia: state.requirementMedia,
      });
    }

    function applySharedWorkspaceSnapshot(snapshot, options) {
      var applyOptions = options || {};
      var next = normalizeWorkspaceSharedState(snapshot);
      var currentCaseGenSettings = state.caseGenSettings && typeof state.caseGenSettings === 'object'
        ? cloneCaseGenSettingsValue(state.caseGenSettings)
        : createDefaultCaseGenSettings();
      var currentCaseGenActiveTab = state.caseGenSettings && typeof state.caseGenSettings === 'object'
        ? String(state.caseGenSettings.activeTab || '')
        : '';
      var currentCaseGenStoreMode = state.caseGenSettings && typeof state.caseGenSettings === 'object'
        ? String(state.caseGenSettings.storeMode || '')
        : '';
      var previousRequirementLabel = normalizePersistedRequirementLabel(state.requirementLabel);
      var previousRequirementLabelSource = state.requirementLabelSource ? String(state.requirementLabelSource || '') : '';
      var previousImportName = state.lastRawImportName ? String(state.lastRawImportName || '') : '';
      if (
        !next.requirementLabel
        && previousRequirementLabel
        && previousRequirementLabelSource
        && previousRequirementLabelSource !== 'default'
        && next.lastRawImportName
        && previousImportName
        && String(next.lastRawImportName || '') === previousImportName
      ) {
        next.requirementLabel = previousRequirementLabel;
        if (!next.requirementLabelSource) next.requirementLabelSource = previousRequirementLabelSource;
      }
      var rawTextEl = documentObj && documentObj.getElementById ? documentObj.getElementById('rawText') : null;
      var fileNameEl = documentObj && documentObj.getElementById ? documentObj.getElementById('fileName') : null;
      var caseTextEl = documentObj && documentObj.getElementById ? documentObj.getElementById('caseText') : null;
      state.requirementLabel = next.requirementLabel;
      state.requirementLabelSource = next.requirementLabelSource;
      state.lastRawImportName = next.lastRawImportName;
      state.importedCases = cloneJson(next.importedCases, []);
      state.caseGenModules = cloneJson(next.caseGenModules, []);
      state.caseGenSource = next.caseGenSource;
      state.caseGenResults = cloneJson(next.caseGenResults, {});
      state.caseSelections = restoreSelectionMap(next.caseSelections);
      state.caseGenSuggestions = cloneJson(next.caseGenSuggestions, {});
      state.caseGenModuleStatus = cloneJson(next.caseGenModuleStatus, {});
      state.caseGenProgress = cloneJson(next.caseGenProgress, {});
      state.caseGenTiming = cloneJson(next.caseGenTiming, {});
      state.caseGenProgressNotice = cloneJson(next.caseGenProgressNotice, {});
      state.caseGenSettings = cloneCaseGenSettingsValue(next.caseGenSettings);
      state.caseGenSettings.activeTab = currentCaseGenActiveTab === 'legacy-modules'
        ? 'legacy-modules'
        : (currentCaseGenActiveTab === 'xmind-modules' || currentCaseGenActiveTab === 'modules'
          ? 'xmind-modules'
          : 'settings');
      state.caseGenSettings.storeMode = currentCaseGenStoreMode === 'append'
        ? 'append'
        : (currentCaseGenSettings.storeMode === 'append' ? 'append' : 'new');
      state.requirementMedia = cloneRequirementMediaValue(next.requirementMedia);
      state.caseGenRunning = new Set();
      if (applyOptions.silentDom === true) {
        setShadowWorkspaceSharedState(cloneJson(next, {}));
        return;
      }
      setShadowWorkspaceSharedState(null);
      if (rawTextEl) rawTextEl.value = next.rawText || '';
      if (caseTextEl) caseTextEl.value = next.caseText || '';
      if (fileNameEl) fileNameEl.textContent = next.lastRawImportName ? String(next.lastRawImportName || '') : '未选择文件';
      var manualImageInputEl = getManualImageInputEl();
      if (manualImageInputEl) manualImageInputEl.value = '';
      var casesCoreApi = getCasesCoreApi();
      if (casesCoreApi && typeof casesCoreApi.renderImportedCaseList === 'function') casesCoreApi.renderImportedCaseList();
      if (casesCoreApi && typeof casesCoreApi.syncCaseTextWithImports === 'function') casesCoreApi.syncCaseTextWithImports();
      if (casesCoreApi && typeof casesCoreApi.resetImportedCaseView === 'function') casesCoreApi.resetImportedCaseView();
      syncCasesGenPageRender();
    }

    function getWorkspaceSnapshotRequirementIdentity(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var xmindPart = source.xmind && typeof source.xmind === 'object' ? source.xmind : {};
      var sharedPart = source.shared && typeof source.shared === 'object' ? source.shared : {};
      var prep = xmindPart.prep && typeof xmindPart.prep === 'object' ? xmindPart.prep : {};
      if (prep.requirementMode === 'manual') {
        return prep.manualRequirementLabel ? String(prep.manualRequirementLabel || '').trim() : '';
      }
      var label = sharedPart.requirementLabel ? String(sharedPart.requirementLabel || '').trim() : '';
      if (label) return label;
      return sharedPart.lastRawImportName ? normalizeRequirementLabelFromFileName(sharedPart.lastRawImportName || '') : '';
    }

    function getCurrentWorkspaceRequirementIdentity() {
      var prep = getPrepState();
      return prep.requirementMode === 'manual'
        ? getManualRequirementLabelText()
        : getDocumentRequirementLabelText();
    }

    function currentActiveWorkspaceHasContent() {
      return workspaceSnapshotHasContent({
        xmind: extractActiveXmindStateSnapshot(),
        shared: buildCurrentSharedWorkspaceSnapshot(),
      });
    }

    function deriveLiveWorkspaceRecordName(fallback) {
      var prep = getPrepState();
      if (prep.requirementMode === 'manual') {
        var manualLabel = normalizePersistedRequirementLabel(getManualRequirementLabelText());
        if (manualLabel) return manualLabel;
      } else {
        var explicitDocumentLabel = normalizePersistedRequirementLabel(state.requirementLabel);
        if (explicitDocumentLabel) return explicitDocumentLabel;
      }
      var fallbackText = fallback === null || fallback === undefined ? '' : String(fallback || '').trim();
      if (!isDefaultWorkspaceRecordName(fallbackText)) return fallbackText;
      if (prep.requirementMode !== 'manual') {
        var importLabel = normalizeRequirementLabelFromFileName(state.lastRawImportName || '');
        if (importLabel) return importLabel;
      }
      return fallbackText;
    }

    function resetRequirementPrepInputs() {
      var rawTextEl = documentObj && documentObj.getElementById ? documentObj.getElementById('rawText') : null;
      var fileNameEl = documentObj && documentObj.getElementById ? documentObj.getElementById('fileName') : null;
      var fileInputEl = documentObj && documentObj.getElementById ? documentObj.getElementById('fileInput') : null;
      if (rawTextEl) rawTextEl.value = '';
      if (fileNameEl) fileNameEl.textContent = '未选择文件';
      if (fileInputEl) fileInputEl.value = '';
      state.lastRawImportName = '';
      state.requirementLabel = '';
      state.requirementLabelSource = '';
      state.requirementMedia = {
        docxImages: [],
        pastedImages: [],
        lastDocxImageCount: 0,
        updatedAt: now(),
      };
      var manualImageInputEl = getManualImageInputEl();
      if (manualImageInputEl) manualImageInputEl.value = '';
    }

    function resetImportedCasePrepInputs() {
      var caseTextEl = documentObj && documentObj.getElementById ? documentObj.getElementById('caseText') : null;
      var caseFileInputEl = documentObj && documentObj.getElementById ? documentObj.getElementById('caseFileInput') : null;
      var casesCoreApi = getCasesCoreApi();
      if (caseTextEl) caseTextEl.value = '';
      if (caseFileInputEl) caseFileInputEl.value = '';
      state.importedCases = [];
      if (casesCoreApi && typeof casesCoreApi.renderImportedCaseList === 'function') casesCoreApi.renderImportedCaseList();
      if (casesCoreApi && typeof casesCoreApi.syncCaseTextWithImports === 'function') casesCoreApi.syncCaseTextWithImports();
      if (casesCoreApi && typeof casesCoreApi.resetImportedCaseView === 'function') casesCoreApi.resetImportedCaseView();
    }

    function resetSharedCaseGenOutputs() {
      state.caseGenModules = [];
      state.caseGenSource = '';
      state.caseGenResults = {};
      state.caseSelections = {};
      state.caseGenSettings = createDefaultCaseGenSettings();
      state.caseGenSuggestions = {};
      state.caseGenModuleStatus = {};
      state.caseGenProgress = {};
      state.caseGenTiming = {};
      state.caseGenProgressNotice = {};
      state.caseGenRunning = new Set();
    }

    function resetWorkflowStateForXmind(drawerOpen, fullscreen) {
      if (prepApi && typeof prepApi.interruptActiveExecutions === 'function') {
        try {
          prepApi.interruptActiveExecutions('重置当前 XMind 生成前置准备');
        } catch (err) {}
      }
      resetRequirementPrepInputs();
      resetImportedCasePrepInputs();
      resetSharedCaseGenOutputs();
      applyActiveXmindStateSnapshot(createInitialXmindState({
        drawerOpen: drawerOpen === true,
        fullscreen: fullscreen === true,
      }));
      resetActiveWorkspaceRecordNameToDefault();
      resetActiveWorkspaceRecordSnapshotToInitial(drawerOpen, fullscreen);
      saveActiveWorkspaceSnapshot({ skipSummaryDraftSync: true });
      return false;
    }

    function resetXmindCasegenState(options) {
      var resetOptions = options || {};
      if (hasAnyRunningGenerationOperation()) {
        if (resetOptions.silentBlocked !== true) {
          notifyFloatingStatus('当前仍有生成任务进行中，请等待完成后再重置', 'warn', 5000);
        }
        return false;
      }
      var resetWorkspaceId = getActiveWorkspaceId();
      if (resetWorkspaceId) {
        clearManagedTasksForWorkspace(resetWorkspaceId, { action: 'workspace-reset' });
        rotateWorkspaceGeneration(resetWorkspaceId);
      }
      var drawerOpen = isDrawerOpen();
      var fullscreen = isDrawerFullscreen() || getViewState().fullscreen === true;
      clearStoreValidationState(true);
      cleanupTopupHighlightPresentation();
      clearDrawerRestoreRetry('reset-xmind-state');
      clearDeleteHistoryStacks();
      var reusedSharedWorkflowReset = resetWorkflowStateForXmind(drawerOpen, fullscreen);
      var manualImageInputEl = getManualImageInputEl();
      if (manualImageInputEl) manualImageInputEl.value = '';
      if (drawerOpen) destroyMind();
      if (!reusedSharedWorkflowReset) syncCasesGenPageRender();
      updateSummary();
      if (resetOptions.reopenPrepDialog === true) openSummaryDialog(stepRequirement);
      else renderOpenedSummaryDialog();
      if (drawerOpen) render({ reason: resetOptions.reason || 'reset-all', persist: false });
      persistXmindState(true);
      if (resetOptions.toastText) {
        notifySuccessToast(String(resetOptions.toastText), resetOptions.toastDurationMs || 3000);
      }
      return true;
    }

    function updateSummary() {
      ensureActiveWorkspaceHydrated();
      ensureState().hasImportedBaseline = hasImportedBaselineCases();
      ensureState().hasModuleSkeleton = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      renderWorkspaceTabs();
      syncOpenButtonState();
      syncKnowledgeBaseToolbarState();
      renderOpenedSummaryDialog();
    }

    function hasActiveWorkspace() {
      return Boolean(getActiveWorkspaceId());
    }

    function ensureActiveWorkspaceHydrated() {
      if (getWorkspaceShadowDepth() > 0) return false;
      if (!shouldXmindOwnLiveWorkspaceState()) return false;
      var host = ensureWorkspaceHostState();
      var activeId = String(host.activeWorkspaceId || '');
      var record = activeId && host.workspaces[activeId] ? host.workspaces[activeId] : null;
      if (!record) return false;
      var currentSnapshot = {
        xmind: extractActiveXmindStateSnapshot(),
        shared: buildCurrentSharedWorkspaceSnapshot(),
      };
      var snapshotRequirementIdentity = getWorkspaceSnapshotRequirementIdentity(record.snapshot);
      var currentRequirementIdentity = getCurrentWorkspaceRequirementIdentity();
      var snapshotViewState = record.snapshot
        && record.snapshot.xmind
        && record.snapshot.xmind.viewState
        && typeof record.snapshot.xmind.viewState === 'object'
          ? record.snapshot.xmind.viewState
          : null;
      var currentViewState = getViewState();
      var shouldRestoreDrawerState = Boolean(
        snapshotViewState
        && (
          (snapshotViewState.drawerOpen === true && currentViewState.drawerOpen !== true)
          || (snapshotViewState.fullscreen === true && currentViewState.fullscreen !== true)
        )
      );
      var shouldRestoreViewportState = Boolean(
        snapshotViewState
        && snapshotViewState.transform
        && !currentViewState.transform
      );
      var shouldPreserveSnapshotDrawerIntent = Boolean(
        snapshotViewState
        && snapshotViewState.drawerOpen === true
        && isDrawerOpen() !== true
        && String(state.activeTab || '') === 'casesgen'
      );
      var shouldRestoreGeneratedState = Boolean(
        workspaceSnapshotHasGeneratedContent(record.snapshot)
        && !workspaceSnapshotHasGeneratedContent(currentSnapshot)
      );
      if (
        workspaceSnapshotHasGeneratedContent(currentSnapshot)
        && !workspaceSnapshotHasGeneratedContent(record.snapshot)
      ) {
        record.snapshot = currentSnapshot;
        record.updatedAt = now();
        return false;
      }
      if (
        (workspaceSnapshotHasContent(record.snapshot) && !currentActiveWorkspaceHasContent())
        || shouldRestoreGeneratedState
        || (snapshotRequirementIdentity && !currentRequirementIdentity)
        || shouldRestoreDrawerState
        || shouldRestoreViewportState
      ) {
        hydrateWorkspaceSnapshot(activeId, {
          keepDrawerOpen: shouldPreserveSnapshotDrawerIntent ? false : isDrawerOpen(),
        });
        return true;
      }
      return false;
    }

    function getWorkspaceOrder() {
      return ensureWorkspaceHostState().workspaceOrder.slice();
    }

    function isWorkspaceDirty(workspaceId) {
      var record = getWorkspaceRecord(workspaceId);
      return Boolean(record && record.snapshot && workspaceSnapshotHasGeneratedContent(record.snapshot));
    }

    function workspaceNeedsCloseConfirm(workspaceId) {
      var stableId = String(workspaceId || '');
      var captureWorkspaceSnapshot = port(workspace, 'captureWorkspaceSnapshot', function() { return null; });
      var snapshot = captureWorkspaceSnapshot(stableId);
      if (workspaceSnapshotHasContent(snapshot) || workspaceSnapshotHasPrepDraft(snapshot)) {
        setDebugState({
          closeWorkspaceCheck: {
            workspaceId: stableId,
            source: 'snapshot',
            result: true,
          },
        });
        return true;
      }
      if (stableId && stableId === getActiveWorkspaceId()) {
        var liveSnapshot = {
          xmind: extractActiveXmindStateSnapshot(),
          shared: buildCurrentSharedWorkspaceSnapshot(),
        };
        var fromActive = workspaceSnapshotHasGeneratedContent(liveSnapshot)
          || workspaceSnapshotHasContent(liveSnapshot)
          || workspaceSnapshotHasPrepDraft(liveSnapshot);
        setDebugState({
          closeWorkspaceCheck: {
            workspaceId: stableId,
            source: 'active',
            result: fromActive === true,
            prepCompleted: getPrepState().completed === true,
            prepBaseLocked: getPrepState().baseLocked === true,
          },
        });
        return fromActive;
      }
      setDebugState({
        closeWorkspaceCheck: {
          workspaceId: stableId,
          source: 'none',
          result: false,
        },
      });
      return false;
    }

    function getWorkspaceTaskList(workspaceId) {
      var stableId = String(workspaceId || '');
      return listManagedXmindTasks().filter(function(task) {
        return stableId && getTaskWorkspaceId(task) === stableId;
      });
    }

    function hasWorkspaceRunningTasks(workspaceId) {
      return getWorkspaceTaskList(workspaceId).some(function(task) {
        return task && task.status === 'running';
      });
    }

    function getRunningDedupeTaskCount(workspaceId) {
      var targetId = String(workspaceId || getActiveWorkspaceId() || '');
      return filterTasksByWorkspace(listManagedXmindTasks(), targetId).filter(function(task) {
        return task && task.status === 'running' && task.scope === 'dedupe';
      }).length;
    }

    function getRunningCoverageTaskCount(workspaceId) {
      var targetId = String(workspaceId || getActiveWorkspaceId() || '');
      return filterTasksByWorkspace(listManagedXmindTasks(), targetId).filter(function(task) {
        return task && task.status === 'running' && task.scope === 'coverage';
      }).length;
    }

    function hasWorkspaceFailedState(snapshot) {
      var xmind = snapshot && snapshot.xmind && typeof snapshot.xmind === 'object'
        ? snapshot.xmind
        : {};
      return String(xmind.summaryResultKind || '') === 'error';
    }

    function buildWorkspaceTabSummary(record, options) {
      var summaryOptions = options || {};
      var snapshot = record && record.snapshot ? record.snapshot : null;
      var xmind = snapshot && snapshot.xmind && typeof snapshot.xmind === 'object'
        ? snapshot.xmind
        : {};
      var visibleSummary = summaryOptions.live === true && getWorkspaceShadowDepth() <= 0
        ? summarizeVisibleModuleContext(buildVisibleModuleContext())
        : summarizeVisibleModuleContext(buildWorkspaceVisibleModuleContextFromSnapshot(snapshot));
      var prep = xmind.prep && typeof xmind.prep === 'object' ? xmind.prep : null;
      var statusText = '待准备';
      var statusCls = 'is-idle';
      if (summaryOptions.running === true) {
        statusText = getRunningCoverageTaskCount(record && record.id ? record.id : '') > 0
          ? '覆盖中'
          : (getRunningDedupeTaskCount(record && record.id ? record.id : '') > 0 ? '去重中' : '生成中');
        statusCls = 'is-running';
      } else if (hasWorkspaceFailedState(snapshot)) {
        statusText = '失败';
        statusCls = 'is-error';
      } else if (summaryOptions.dirty === true) {
        statusText = '未入库';
        statusCls = 'is-dirty';
      } else if (prep && prep.completed === true) {
        statusText = '已准备';
        statusCls = 'is-ready';
      } else if (workspaceSnapshotHasContent(snapshot)) {
        statusText = '草稿中';
        statusCls = 'is-draft';
      }
      return {
        moduleCount: Number(visibleSummary.moduleCount || 0),
        caseCount: Number(visibleSummary.caseCount || 0),
        statusText: statusText,
        statusCls: statusCls,
      };
    }

    function listWorkspaceProgressItems() {
      var host = ensureWorkspaceHostState();
      var activeId = String(getWorkspaceUiSelectedId() || '');
      var liveWorkspaceId = String(host.activeWorkspaceId || '');
      var canUseLiveSummary = shouldXmindOwnLiveWorkspaceState();
      return host.workspaceOrder.slice(0, workspaceLimit).map(function(id) {
        var record = host.workspaces[id];
        if (!record) return null;
        var running = hasWorkspaceRunningTasks(id);
        var dirty = !running && isWorkspaceDirty(id);
        var summary = buildWorkspaceTabSummary(record, {
          running: running,
          dirty: dirty,
          live: canUseLiveSummary && String(id || '') === liveWorkspaceId,
        });
        return {
          id: id,
          active: id === activeId,
          title: buildWorkspaceDisplayName(record),
          statusText: summary.statusText,
          statusCls: summary.statusCls,
          moduleCount: summary.moduleCount,
          caseCount: summary.caseCount,
          running: running,
          dirty: dirty,
        };
      }).filter(function(item) { return Boolean(item); });
    }

    function getWorkspaceModuleMirrorPayload(workspaceId) {
      var host = ensureWorkspaceHostState();
      var order = Array.isArray(host.workspaceOrder) ? host.workspaceOrder.slice(0, workspaceLimit) : [];
      var requestedWorkspaceId = String(workspaceId || '');
      var activeId = String(requestedWorkspaceId || getWorkspaceUiSelectedId() || '');
      if (!activeId && order.length) activeId = String(order[0] || '');
      var record = activeId ? getWorkspaceRecord(activeId) : null;
      if (!record && order.length) {
        activeId = String(order[0] || '');
        record = activeId ? getWorkspaceRecord(activeId) : null;
      }
      if (!requestedWorkspaceId && !isDrawerOpen() && activeId && host.workspaces && host.workspaces[activeId]) {
        host.mirrorWorkspaceId = activeId;
      }
      var running = record ? hasWorkspaceRunningTasks(activeId) : false;
      var summary = record ? buildWorkspaceTabSummary(record, {
        running: running,
        dirty: !running && isWorkspaceDirty(activeId),
        live: shouldXmindOwnLiveWorkspaceState()
          && String(activeId || '') === String(ensureWorkspaceHostState().activeWorkspaceId || ''),
      }) : {
        moduleCount: 0,
        caseCount: 0,
        statusText: '待准备',
        statusCls: 'is-idle',
      };
      var snapshot = record && record.snapshot ? record.snapshot : null;
      var shared = snapshot && snapshot.shared && typeof snapshot.shared === 'object'
        ? snapshot.shared
        : {};
      return {
        hasWorkspaces: order.length > 0,
        workspaceId: activeId,
        title: record ? buildWorkspaceDisplayName(record) : '',
        statusText: summary.statusText,
        statusCls: summary.statusCls,
        moduleCount: summary.moduleCount,
        caseCount: summary.caseCount,
        modules: cloneJson(shared.caseGenModules, []),
        results: cloneJson(shared.caseGenResults, {}),
        moduleStatus: cloneJson(shared.caseGenModuleStatus, {}),
        progress: cloneJson(shared.caseGenProgress, {}),
        timing: cloneJson(shared.caseGenTiming, {}),
      };
    }

    function renderWorkspaceTabs() {
      if (!workspaceListEl || !workspaceAddBtn) return false;
      var items = listWorkspaceProgressItems();
      workspaceListEl.innerHTML = items.map(function(item) {
        var closeDisabled = item.running === true;
        var tabCls = 'memo-tab xmind-casegen-tab' + (item.active ? ' active' : '');
        return ''
          + '<div class="' + tabCls + '" data-xmind-workspace-tab="' + escapeHtml(item.id) + '" title="' + escapeHtml(item.title) + '">'
          +   '<span class="memo-tab-label xmind-casegen-tab-label">'
          +     '<span class="xmind-casegen-tab-title-row">'
          +       '<span class="xmind-casegen-tab-title">' + escapeHtml(item.title) + '</span>'
          +     '</span>'
          +     '<span class="xmind-casegen-tab-meta">'
          +       '<span class="xmind-casegen-tab-state-pill ' + escapeHtml(item.statusCls) + '" aria-hidden="true">' + escapeHtml(item.statusText) + '</span>'
          +       '<span class="xmind-casegen-tab-dot" aria-hidden="true"></span>'
          +       '<span class="xmind-casegen-tab-metric">' + String(item.moduleCount) + ' 模块</span>'
          +       '<span class="xmind-casegen-tab-dot" aria-hidden="true"></span>'
          +       '<span class="xmind-casegen-tab-metric">' + String(item.caseCount) + ' 用例</span>'
          +     '</span>'
          +   '</span>'
          +   '<button class="memo-tab-close xmind-casegen-tab-close" type="button" data-xmind-workspace-close="' + escapeHtml(item.id) + '"'
          +     (closeDisabled ? ' disabled' : '')
          +     ' title="' + escapeHtml(closeDisabled ? '当前页签仍有生成任务进行中，暂不可关闭' : '关闭页签') + '">×</button>'
          + '</div>';
      }).join('');
      var isFull = items.length >= workspaceLimit;
      workspaceAddBtn.classList.toggle('is-disabled', isFull);
      workspaceAddBtn.disabled = isFull;
      workspaceAddBtn.textContent = '新建生成';
      workspaceAddBtn.title = isFull ? getWorkspaceLimitText() : '新建一个独立的 XMind 用例生成页签';
      syncCasegenProgressSidebar();
      syncCasesGenPageRender();
      return true;
    }

    function captureActiveManagedTaskRestoreContext(options) {
      var restoreOptions = options || {};
      var targetWorkspaceId = String(restoreOptions.workspaceId || getActiveWorkspaceId() || '');
      var compact = restoreOptions.compact === true;
      var hasOverrideViewState = Boolean(
        restoreOptions.viewState
        && typeof restoreOptions.viewState === 'object'
      );
      var rawTextEl = documentObj && documentObj.getElementById ? documentObj.getElementById('rawText') : null;
      var caseTextEl = documentObj && documentObj.getElementById ? documentObj.getElementById('caseText') : null;
      var shadowSource = getShadowWorkspaceSharedState();
      var shadowBase = getWorkspaceShadowDepth() > 0 && shadowSource
        ? normalizeWorkspaceSharedState(shadowSource)
        : null;
      var prep = cloneJson(getPrepState(), createDefaultPrepState());
      var overrideViewState = hasOverrideViewState
        ? normalizeStoredViewState(restoreOptions.viewState, {
          drawerOpen: restoreOptions.viewState.drawerOpen === true,
          fullscreen: restoreOptions.viewState.fullscreen === true,
        })
        : null;
      var viewState = overrideViewState
        ? cloneJson(overrideViewState, createDefaultViewState())
        : cloneJson(captureCurrentViewState(), createDefaultViewState());
      var requirementSource = getSelectedRequirementSource();
      var requirementLabel = requirementSource.mode === 'manual'
        ? getManualRequirementLabelText()
        : getDocumentRequirementLabelText();
      var requirementLabelSource = state.requirementLabelSource ? String(state.requirementLabelSource || '') : '';
      if (requirementSource.mode === 'manual') {
        requirementLabelSource = 'manual';
      } else if (!requirementLabelSource && requirementSource.mode === 'document' && requirementLabel) {
        requirementLabelSource = state.lastRawImportName ? 'import' : 'document';
      }
      var result = {
        workspaceId: targetWorkspaceId,
        requirementLabel: requirementLabel,
        requirementLabelSource: requirementLabelSource,
        lastRawImportName: state.lastRawImportName ? String(state.lastRawImportName || '') : '',
        rawText: shadowBase
          ? String(shadowBase.rawText || '')
          : (rawTextEl && rawTextEl.value ? String(rawTextEl.value || '') : ''),
        prep: prep,
        viewState: hasOverrideViewState
          ? cloneJson(overrideViewState, createDefaultViewState())
          : normalizeStoredViewState(viewState, {
            drawerOpen: viewState.drawerOpen === true || isDrawerOpen(),
            fullscreen: viewState.fullscreen === true || isDrawerFullscreen(),
          }),
      };
      if (compact) {
        result.caseGenModules = cloneModulesWithoutCases(state.caseGenModules);
        result.rootPipeline = buildCompactRootPipelineRestoreSnapshot(getRootPipelineState());
      } else {
        result.caseText = shadowBase
          ? String(shadowBase.caseText || '')
          : (caseTextEl && caseTextEl.value ? String(caseTextEl.value || '') : '');
        result.importedCases = cloneJson(state.importedCases, []);
        result.caseGenModules = cloneJson(state.caseGenModules, []);
        result.caseGenResults = cloneJson(state.caseGenResults, {});
        result.operationSnapshots = cloneJson(ensureState().operationSnapshots, []);
        result.nextSnapshotId = Number(ensureState().nextSnapshotId || 1);
        result.history = cloneJson(ensureState().history, []);
        result.rootPipeline = cloneRootPipelineSnapshot(getRootPipelineState());
      }
      return result;
    }

    function ensureWorkspaceRecordForManagedTask(workspaceId, restoreContext) {
      var stableId = String(workspaceId || '');
      if (!stableId) return null;
      var host = ensureWorkspaceHostState();
      if (!host.workspaces[stableId]) {
        var context = restoreContext && typeof restoreContext === 'object' ? restoreContext : {};
        var seq = Number(host.nextWorkspaceSeq || 1);
        host.nextWorkspaceSeq = seq + 1;
        host.workspaces[stableId] = createWorkspaceRecord(stableId, {
          seq: seq,
          name: buildDefaultWorkspaceRecordName(seq),
          generationId: context.workspaceGenerationId,
          createdAt: context.workspaceCreatedAt,
          snapshot: createWorkspaceSnapshot(),
        });
        if (host.workspaceOrder.indexOf(stableId) === -1) host.workspaceOrder.push(stableId);
      }
      return host.workspaces[stableId];
    }

    function applyManagedTaskLiveRestoreContext(restoreContext, options) {
      var restoreOptions = options || {};
      if (!restoreContext) return false;
      var changed = false;
      var rawTextEl = documentObj && documentObj.getElementById ? documentObj.getElementById('rawText') : null;
      var fileNameEl = documentObj && documentObj.getElementById ? documentObj.getElementById('fileName') : null;
      var caseTextEl = documentObj && documentObj.getElementById ? documentObj.getElementById('caseText') : null;
      var casesCoreApi = getCasesCoreApi();
      var currentLabel = state.requirementLabel ? String(state.requirementLabel).trim() : '';
      var currentLabelSource = state.requirementLabelSource ? String(state.requirementLabelSource).trim() : '';
      var restoreLabel = restoreContext.requirementLabel ? String(restoreContext.requirementLabel || '').trim() : '';
      var restoreLabelSource = restoreContext.requirementLabelSource
        ? String(restoreContext.requirementLabelSource || '').trim()
        : '';
      if (!restoreLabel) restoreLabel = normalizeRequirementLabelFromFileName(restoreContext.lastRawImportName || '');
      if (
        restoreLabelSource !== 'manual'
        && (!currentLabel || currentLabel === '当前需求' || currentLabelSource === 'default')
        && restoreLabel
      ) {
        state.requirementLabel = restoreLabel;
        state.requirementLabelSource = restoreLabelSource
          ? restoreLabelSource
          : (restoreContext.lastRawImportName ? 'import' : (currentLabelSource || 'task-restore'));
        changed = true;
      }
      if (!state.lastRawImportName && restoreContext.lastRawImportName) {
        state.lastRawImportName = String(restoreContext.lastRawImportName || '');
        changed = true;
      }
      if (fileNameEl && state.lastRawImportName && String(fileNameEl.textContent || '').trim() !== state.lastRawImportName) {
        fileNameEl.textContent = state.lastRawImportName;
        changed = true;
      }
      if (rawTextEl && !String(rawTextEl.value || '').trim() && restoreContext.rawText) {
        rawTextEl.value = String(restoreContext.rawText || '');
        changed = true;
      }
      if (
        (!Array.isArray(state.importedCases) || !state.importedCases.length)
        && Array.isArray(restoreContext.importedCases)
        && restoreContext.importedCases.length
      ) {
        state.importedCases = cloneJson(restoreContext.importedCases, []);
        changed = true;
      }
      var currentModules = Array.isArray(state.caseGenModules) ? state.caseGenModules : [];
      if (
        Array.isArray(restoreContext.caseGenModules)
        && restoreContext.caseGenModules.length
        && restoreContext.caseGenModules.length > currentModules.length
      ) {
        state.caseGenModules = cloneJson(restoreContext.caseGenModules, []);
        changed = true;
      }
      var currentResults = state.caseGenResults && typeof state.caseGenResults === 'object'
        ? state.caseGenResults
        : {};
      var mergedResults = mergeRestoreResultMap(restoreContext.caseGenResults, currentResults);
      if (JSON.stringify(mergedResults) !== JSON.stringify(currentResults)) {
        state.caseGenResults = cloneJson(mergedResults, {});
        changed = true;
      }
      var xmindState = ensureState();
      var currentOperationVersion = buildOperationSnapshotRestoreVersion(
        xmindState.operationSnapshots,
        xmindState.nextSnapshotId
      );
      var restoreOperationVersion = buildOperationSnapshotRestoreVersion(
        restoreContext.operationSnapshots,
        restoreContext.nextSnapshotId
      );
      if (shouldPreferRestoreOperationSnapshots(currentOperationVersion, restoreOperationVersion)) {
        xmindState.operationSnapshots = cloneJson(restoreOperationVersion.list, []);
        xmindState.nextSnapshotId = restoreOperationVersion.nextSnapshotId;
        syncCaseGenOperationPointersLocal();
        changed = true;
      } else {
        var currentNextSnapshotId = deriveNextOperationSnapshotId(
          xmindState.operationSnapshots,
          xmindState.nextSnapshotId
        );
        if (currentNextSnapshotId !== Number(xmindState.nextSnapshotId || 1)) {
          xmindState.nextSnapshotId = currentNextSnapshotId;
          changed = true;
        }
      }
      var currentHistory = Array.isArray(xmindState.history) ? xmindState.history : [];
      if (
        Array.isArray(restoreContext.history)
        && restoreContext.history.length
        && restoreContext.history.length > currentHistory.length
      ) {
        xmindState.history = cloneJson(restoreContext.history, []);
        changed = true;
      }
      if (caseTextEl && !String(caseTextEl.value || '').trim() && restoreContext.caseText) {
        caseTextEl.value = String(restoreContext.caseText || '');
        changed = true;
      }
      var prep = getPrepState();
      var prepSnapshot = restoreContext.prep && typeof restoreContext.prep === 'object'
        ? restoreContext.prep
        : null;
      var currentPipeline = getRootPipelineState();
      var mergedPipeline = mergeRootPipelineSnapshot(currentPipeline, restoreContext.rootPipeline);
      if (restoreOptions.markRestoredAfterRefresh === true && mergedPipeline && mergedPipeline.id) {
        mergedPipeline.restoredAfterRefresh = true;
      }
      if (JSON.stringify(mergedPipeline || null) !== JSON.stringify(currentPipeline || null)) {
        setRootPipelineState(mergedPipeline);
        changed = true;
      }
      if (prepSnapshot) {
        ['requirementMode', 'requirementSupplement', 'manualRequirementLabel', 'caseImportMode'].forEach(function(key) {
          if (!prep[key] && prepSnapshot[key]) {
            prep[key] = String(prepSnapshot[key] || '');
            changed = true;
          }
        });
        if (
          (!Array.isArray(prep.manualRequirementBlocks) || !prep.manualRequirementBlocks.length)
          && Array.isArray(prepSnapshot.manualRequirementBlocks)
          && prepSnapshot.manualRequirementBlocks.length
        ) {
          prep.manualRequirementBlocks = cloneJson(prepSnapshot.manualRequirementBlocks, []);
          changed = true;
        }
        ['baseLocked', 'completed'].forEach(function(key) {
          if (prep[key] !== true && prepSnapshot[key] === true) {
            prep[key] = true;
            changed = true;
          }
        });
        var currentStep = Number(prep.step || stepRequirement);
        var snapshotStep = Number(prepSnapshot.step || stepRequirement);
        if (snapshotStep > currentStep) {
          prep.step = snapshotStep;
          changed = true;
        }
      }
      var viewState = normalizeStoredViewState(getViewState());
      var restoreView = restoreContext.viewState && typeof restoreContext.viewState === 'object'
        ? normalizeStoredViewState(restoreContext.viewState)
        : null;
      if (restoreView) {
        var mergedViewState = mergeStoredViewState(viewState, restoreView);
        if (JSON.stringify(mergedViewState) !== JSON.stringify(viewState)) {
          ensureState().viewState = cloneJson(mergedViewState, createDefaultViewState());
          changed = true;
        }
      }
      if (changed) ensureState().hasModuleSkeleton = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      if (changed && casesCoreApi && typeof casesCoreApi.renderImportedCaseList === 'function') {
        casesCoreApi.renderImportedCaseList();
      }
      if (changed && casesCoreApi && typeof casesCoreApi.syncCaseTextWithImports === 'function') {
        casesCoreApi.syncCaseTextWithImports();
      }
      if (changed) scheduleRecoveredStatePersist();
      return changed;
    }

    function handleManagedTaskWorkspaceRecordsRestored(workspaceIds, context) {
      if (!Array.isArray(workspaceIds) || !workspaceIds.length) return;
      renderWorkspaceTabs();
      if (!context || context.liveOwned !== true) {
        updateSummary();
        renderCaseGenProgressBoard();
        scheduleRecoveredStatePersist();
      }
    }

    function runInWorkspaceContextNow(workspaceId, handler) {
      var targetId = String(workspaceId || '');
      var currentWorkspaceId = String(getActiveWorkspaceId() || '');
      var shouldUseShadow = Boolean(
        targetId
        && (!currentWorkspaceId || targetId !== currentWorkspaceId || !shouldXmindOwnLiveWorkspaceState())
      );
      if (!targetId || !shouldUseShadow) {
        return Promise.resolve().then(function() { return handler(false); });
      }
      var host = ensureWorkspaceHostState();
      var sharedWorkspaces = host.workspaces;
      var orderSnapshot = host.workspaceOrder.slice();
      var nextWorkspaceSeq = Number(host.nextWorkspaceSeq || 1);
      var openButtonDotVisible = host.openButtonDotVisible === true;
      var previousId = String(host.activeWorkspaceId || '');
      var previousMirrorId = String(host.mirrorWorkspaceId || previousId || '');
      var previousLiveSharedSnapshot = null;
      var liveOwnedByXmind = shouldXmindOwnLiveWorkspaceState();
      if (!liveOwnedByXmind) previousLiveSharedSnapshot = buildCurrentSharedWorkspaceSnapshot();
      if (liveOwnedByXmind && previousId && host.workspaces[previousId]) {
        var previousSnapshot = createWorkspaceSnapshotFromCurrent();
        saveActiveWorkspaceSnapshot({
          skipSummaryDraftSync: true,
          skipViewStateCapture: true,
          overrideViewState: previousSnapshot && previousSnapshot.xmind
            ? previousSnapshot.xmind.viewState
            : null,
        });
      }
      var targetRecord = getWorkspaceRecord(targetId);
      if (!targetRecord) return Promise.resolve(false);
      setWorkspaceShadowDepth(getWorkspaceShadowDepth() + 1);
      setWorkspaceUiMutedDepth(getWorkspaceUiMutedDepth() + 1);
      try {
        host.activeWorkspaceId = targetId;
        host.mirrorWorkspaceId = previousMirrorId;
        applySharedWorkspaceSnapshot(targetRecord.snapshot && targetRecord.snapshot.shared
          ? targetRecord.snapshot.shared
          : null, { silentDom: true });
        applyActiveXmindStateSnapshot(targetRecord.snapshot && targetRecord.snapshot.xmind
          ? targetRecord.snapshot.xmind
          : null);
        var activeHost = getWorkspaceHostState();
        activeHost.activeWorkspaceId = targetId;
        activeHost.mirrorWorkspaceId = previousMirrorId;
        activeHost.workspaceOrder = orderSnapshot.slice();
        activeHost.workspaces = sharedWorkspaces;
        activeHost.nextWorkspaceSeq = nextWorkspaceSeq;
        activeHost.openButtonDotVisible = openButtonDotVisible;
      } catch (switchErr) {
        setWorkspaceUiMutedDepth(getWorkspaceUiMutedDepth() - 1);
        setWorkspaceShadowDepth(getWorkspaceShadowDepth() - 1);
        throw switchErr;
      }
      return Promise.resolve().then(function() {
        return handler(true);
      }).finally(function() {
        saveActiveWorkspaceSnapshot();
        var restoreHost = ensureWorkspaceHostState();
        var restoreWorkspaces = restoreHost.workspaces;
        var restoreSeq = Number(restoreHost.nextWorkspaceSeq || 1);
        if (!Number.isFinite(restoreSeq) || restoreSeq < nextWorkspaceSeq) restoreSeq = nextWorkspaceSeq;
        if (previousId && restoreWorkspaces[previousId]) {
          var previousRecord = restoreWorkspaces[previousId];
          var previousRecordSnapshot = normalizeWorkspaceSnapshot(previousRecord && previousRecord.snapshot
            ? previousRecord.snapshot
            : null);
          applySharedWorkspaceSnapshot(
            liveOwnedByXmind ? previousRecordSnapshot.shared : previousLiveSharedSnapshot,
            { silentDom: true }
          );
          applyActiveXmindStateSnapshot(previousRecordSnapshot.xmind);
          var restoredHost = getWorkspaceHostState();
          restoredHost.activeWorkspaceId = previousId;
          restoredHost.mirrorWorkspaceId = previousMirrorId;
          restoredHost.workspaceOrder = orderSnapshot.slice();
          restoredHost.workspaces = restoreWorkspaces;
          restoredHost.nextWorkspaceSeq = restoreSeq;
          restoredHost.openButtonDotVisible = state.xmindCaseGen
            && state.xmindCaseGen.openButtonDotVisible === true;
        } else {
          var emptyRestoreHost = getWorkspaceHostState();
          emptyRestoreHost.activeWorkspaceId = '';
          emptyRestoreHost.mirrorWorkspaceId = previousMirrorId;
          emptyRestoreHost.workspaceOrder = orderSnapshot.slice();
          emptyRestoreHost.workspaces = restoreWorkspaces;
          emptyRestoreHost.nextWorkspaceSeq = restoreSeq;
          emptyRestoreHost.openButtonDotVisible = state.xmindCaseGen
            && state.xmindCaseGen.openButtonDotVisible === true;
          setShadowWorkspaceSharedState(null);
        }
        setWorkspaceUiMutedDepth(getWorkspaceUiMutedDepth() - 1);
        setWorkspaceShadowDepth(getWorkspaceShadowDepth() - 1);
        setShadowWorkspaceSharedState(null);
        renderWorkspaceTabs();
        updateSummary();
        persistWorkflowStateNow();
        if (getWorkspaceShadowDepth() <= 0) {
          if (!isDrawerOpen()) flushDeferredCasesGenPageRender();
          scheduleManagedTaskReconcile('workspace-context-finished');
        }
      });
    }

    function createWorkspaceSnapshotFromCurrent(options) {
      var snapshotOptions = options || {};
      if (snapshotOptions.skipSummaryDraftSync !== true) {
        port(workflow, 'syncSummaryDraftIntoState')();
      }
      if (getWorkspaceShadowDepth() <= 0 && snapshotOptions.skipViewStateCapture !== true) {
        captureCurrentViewState();
      }
      var overrideViewState = snapshotOptions.overrideViewState
        && typeof snapshotOptions.overrideViewState === 'object'
          ? normalizeStoredViewState(snapshotOptions.overrideViewState, {
            drawerOpen: snapshotOptions.overrideViewState.drawerOpen === true,
            fullscreen: snapshotOptions.overrideViewState.fullscreen === true,
          })
          : null;
      var xmindSnapshot = extractActiveXmindStateSnapshot();
      if (overrideViewState) {
        xmindSnapshot.viewState = cloneJson(overrideViewState, createDefaultViewState());
      }
      return {
        xmind: xmindSnapshot,
        shared: buildCurrentSharedWorkspaceSnapshot(),
      };
    }

    function clearCurrentWorkspaceUiBeforeSwitch() {
      invalidateWorkspaceViewRestore();
      clearStoreValidationState(true);
      clearDrawerRestoreRetry('workspace-switch-clear-ui');
      cancelQueuedMindRender();
      cleanupTopupHighlightPresentation();
      destroyMind();
    }

    function switchWorkspace(workspaceId, options) {
      var switchOptions = options || {};
      var host = ensureWorkspaceHostState();
      var targetId = String(workspaceId || '');
      if (!targetId || !host.workspaces[targetId]) return false;
      if (isDrawerRestoreInFlight()) setPendingDrawerOpenWorkspaceId(targetId);
      var targetStoredViewState = getWorkspaceStoredViewState(targetId);
      var previousWorkspaceViewState = null;
      var currentVisibleViewState = null;
      var shouldRestoreTargetViewport = shouldRestoreWorkspaceViewport(targetId, targetStoredViewState);
      var targetRenderViewState = shouldRestoreTargetViewport
        ? normalizeWorkspaceRenderViewState(targetStoredViewState, { skipAnchorAlign: true })
        : null;
      var shouldCenterTargetAfterRender = switchOptions.centerRootAfterRender === true
        || !shouldRestoreTargetViewport;
      var currentId = String(host.activeWorkspaceId || '');
      if (currentId && currentId !== targetId) {
        currentVisibleViewState = captureVisibleMindViewStateFromDom();
      }
      if (
        switchOptions.skipCurrentSnapshotSave !== true
        && currentId
        && host.workspaces[currentId]
        && shouldXmindOwnLiveWorkspaceState()
      ) {
        var preservedSharedSnapshot = (
          isDrawerOpen() !== true
          && getWorkspaceShadowDepth() <= 0
          && host.workspaces[currentId].snapshot
          && host.workspaces[currentId].snapshot.shared
        )
          ? normalizeWorkspaceSharedState(host.workspaces[currentId].snapshot.shared)
          : null;
        var preservedXmindSnapshot = (
          isDrawerOpen() !== true
          && getWorkspaceShadowDepth() <= 0
          && host.workspaces[currentId].snapshot
          && host.workspaces[currentId].snapshot.xmind
        )
          ? cloneJson(host.workspaces[currentId].snapshot.xmind, createInitialXmindState())
          : null;
        host.workspaces[currentId].snapshot = createWorkspaceSnapshotFromCurrent();
        if (preservedXmindSnapshot && host.workspaces[currentId].snapshot) {
          host.workspaces[currentId].snapshot.xmind = preservedXmindSnapshot;
        }
        if (preservedSharedSnapshot && host.workspaces[currentId].snapshot) {
          host.workspaces[currentId].snapshot.shared = preservedSharedSnapshot;
        }
        if (
          currentVisibleViewState
          && host.workspaces[currentId].snapshot
          && host.workspaces[currentId].snapshot.xmind
        ) {
          host.workspaces[currentId].snapshot.xmind.viewState = cloneJson(
            currentVisibleViewState,
            createDefaultViewState()
          );
        }
        previousWorkspaceViewState = cloneJson(
          host.workspaces[currentId].snapshot
            && host.workspaces[currentId].snapshot.xmind
            && host.workspaces[currentId].snapshot.xmind.viewState
              ? host.workspaces[currentId].snapshot.xmind.viewState
              : null,
          createDefaultViewState()
        );
        host.workspaces[currentId].updatedAt = now();
      }
      host.activeWorkspaceId = targetId;
      host.mirrorWorkspaceId = targetId;
      clearCurrentWorkspaceUiBeforeSwitch();
      hydrateWorkspaceSnapshot(targetId, { keepDrawerOpen: isDrawerOpen() });
      syncManagedRunningUiState({
        tasks: listManagedXmindTasks(),
        render: false,
        reason: 'workspace-switch-sync',
        persist: true,
      });
      filterTasksByWorkspace(listManagedXmindTasks(), targetId).filter(function(task) {
        return isManagedTaskTerminal(task);
      }).forEach(function(task) {
        consumeManagedXmindTask(task);
      });
      renderWorkspaceTabs();
      updateSummary();
      if (isDrawerOpen()) {
        render({
          reason: switchOptions.reason || 'workspace-switch',
          persist: false,
          centerRootAfterRender: shouldCenterTargetAfterRender,
          skipRestorableViewState: shouldCenterTargetAfterRender,
          restoreViewStateAfterRender: shouldCenterTargetAfterRender !== true && shouldRestoreTargetViewport,
          restoreViewState: targetRenderViewState,
        });
      } else {
        persistXmindState(true);
      }
      var record = getWorkspaceRecord(targetId);
      if (record && record.pendingOpenPrep === true) {
        record.pendingOpenPrep = false;
        openSummaryDialog(getPrepState().step || stepRequirement);
      } else {
        renderOpenedSummaryDialog();
      }
      if (
        previousWorkspaceViewState
        && currentId
        && currentId !== targetId
        && host.workspaces[currentId]
        && host.workspaces[currentId].snapshot
        && host.workspaces[currentId].snapshot.xmind
      ) {
        host.workspaces[currentId].snapshot.xmind.viewState = cloneJson(
          previousWorkspaceViewState,
          createDefaultViewState()
        );
      }
      syncCasesGenPageRender();
      return true;
    }

    function activateWorkspace(workspaceId, options) {
      var targetId = String(workspaceId || '');
      if (!targetId) return false;
      if (targetId === getActiveWorkspaceId()) {
        setMirrorWorkspaceSelection(targetId);
        syncCasesGenPageRender({ force: !isDrawerOpen() });
        return true;
      }
      return switchWorkspace(targetId, {
        reason: options && options.reason ? String(options.reason || '') : 'workspace-external-switch',
        centerRootAfterRender: options && options.centerRootAfterRender === true,
        skipCurrentSnapshotSave: options && options.skipCurrentSnapshotSave === true,
      });
    }

    function selectWorkspaceForMirror(workspaceId) {
      var host = ensureWorkspaceHostState();
      var targetId = String(workspaceId || '');
      if (!targetId || !host.workspaces[targetId]) return false;
      if (!state.caseGenSettings || typeof state.caseGenSettings !== 'object') {
        state.caseGenSettings = createDefaultCaseGenSettings();
      }
      state.caseGenSettings.activeTab = 'xmind-modules';
      host.mirrorWorkspaceId = targetId;
      syncCasesGenPageRender({ force: true });
      ensureWorkspaceHostState().mirrorWorkspaceId = targetId;
      syncCasegenProgressSidebar();
      renderOpenedSummaryDialog();
      persistWorkflowState();
      return true;
    }

    function hydrateActiveWorkspaceSnapshot(options) {
      var targetId = getActiveWorkspaceId();
      if (!targetId) return false;
      return hydrateWorkspaceSnapshot(targetId, {
        keepDrawerOpen: options && Object.prototype.hasOwnProperty.call(options, 'keepDrawerOpen')
          ? options.keepDrawerOpen === true
          : isDrawerOpen(),
      });
    }

    function syncActiveWorkspaceSnapshot(options) {
      var syncOptions = options || {};
      var saved = saveActiveWorkspaceSnapshot({
        forceShared: syncOptions.forceShared !== false,
        skipSummaryDraftSync: syncOptions.skipSummaryDraftSync === true,
        skipViewStateCapture: syncOptions.skipViewStateCapture === true,
        overrideViewState: syncOptions.overrideViewState && typeof syncOptions.overrideViewState === 'object'
          ? syncOptions.overrideViewState
          : null,
      });
      if (syncOptions.render !== false) renderWorkspaceTabs();
      return saved;
    }

    function createWorkspaceAndOpenPrep() {
      var host = ensureWorkspaceHostState();
      if (host.workspaceOrder.length >= workspaceLimit) {
        notifyFloatingStatus(getWorkspaceLimitText(), 'warn', 3000);
        return false;
      }
      var adoptCurrentSnapshot = host.workspaceOrder.length === 0 && currentActiveWorkspaceHasContent();
      var initialSnapshot = adoptCurrentSnapshot
        ? createWorkspaceSnapshotFromCurrent()
        : createWorkspaceSnapshot({
          drawerOpen: true,
          fullscreen: isDrawerFullscreen(),
        });
      if (host.activeWorkspaceId && host.workspaces[host.activeWorkspaceId]) {
        host.workspaces[host.activeWorkspaceId].snapshot = createWorkspaceSnapshotFromCurrent();
        host.workspaces[host.activeWorkspaceId].updatedAt = now();
      }
      var seq = Number(host.nextWorkspaceSeq || 1);
      var workspaceId = buildWorkspaceId(seq);
      host.nextWorkspaceSeq = seq + 1;
      host.workspaces[workspaceId] = createWorkspaceRecord(workspaceId, {
        seq: seq,
        name: buildDefaultWorkspaceRecordName(seq),
        pendingOpenPrep: true,
        snapshot: initialSnapshot,
      });
      host.workspaceOrder.push(workspaceId);
      host.activeWorkspaceId = workspaceId;
      host.mirrorWorkspaceId = workspaceId;
      clearCurrentWorkspaceUiBeforeSwitch();
      hydrateWorkspaceSnapshot(workspaceId, { keepDrawerOpen: true });
      notifyInlineStatus('', '');
      renderWorkspaceTabs();
      updateSummary();
      if (isDrawerOpen()) render({ reason: 'workspace-create', persist: false, centerRootAfterRender: true });
      else persistXmindState(true);
      var record = getWorkspaceRecord(workspaceId);
      if (record) record.pendingOpenPrep = false;
      openSummaryDialog(stepRequirement);
      return true;
    }

    function openWorkspaceFromProgressPanel(workspaceId) {
      var targetId = String(workspaceId || '');
      port(ui, 'clearOpenButtonCompletionNotice')({ persist: true });
      if (!isDrawerOpen() && shouldSyncLegacyBeforeOpen()) {
        syncLegacyWorkflowContext({ persist: false, force: true });
      }
      if (targetId) setMirrorWorkspaceSelection(targetId);
      if (targetId && targetId !== getActiveWorkspaceId() && isDrawerOpen()) {
        switchWorkspace(targetId, {
          reason: 'workspace-progress-panel-switch',
          centerRootAfterRender: false,
        });
      }
      if (!isDrawerOpen()) {
        openDrawer({
          restoreOpening: true,
          workspaceId: targetId,
          userInitiated: true,
          forceSnapshotHydrate: true,
        });
      }
      return true;
    }

    function getWorkspaceDeleteConfirmMessage(record) {
      var label = buildWorkspaceDisplayName(record);
      return '确认直接关闭页签【' + String(label || '当前生成') + '】？该页签的前置准备或生成内容尚未保存入库，关闭后不会保留。';
    }

    function deleteWorkspace(workspaceId, options) {
      var deleteOptions = options || {};
      var targetId = String(workspaceId || '');
      if (hasWorkspaceRunningTasks(targetId)) {
        setDebugState({ closeWorkspaceAction: { workspaceId: targetId, phase: 'blocked-running' } });
        notifyFloatingStatus('当前页签仍有生成任务进行中，暂不可关闭', 'warn', 3000);
        return false;
      }
      var proceed = function() {
        var currentHost = ensureWorkspaceHostState();
        var currentRecord = currentHost.workspaces[targetId];
        var currentIndex = currentHost.workspaceOrder.indexOf(targetId);
        if (!currentRecord || currentIndex === -1) {
          setDebugState({
            closeWorkspaceAction: {
              workspaceId: targetId,
              phase: 'missing-target',
              currentIndex: currentIndex,
              hasRecord: Boolean(currentRecord),
            },
          });
          return false;
        }
        if (hasWorkspaceRunningTasks(targetId)) {
          setDebugState({
            closeWorkspaceAction: {
              workspaceId: targetId,
              phase: 'blocked-running-late',
              currentIndex: currentIndex,
            },
          });
          return false;
        }
        var wasActive = targetId === String(currentHost.activeWorkspaceId || '');
        setDebugState({
          closeWorkspaceAction: {
            workspaceId: targetId,
            phase: 'proceed',
            currentIndex: currentIndex,
            wasActive: wasActive === true,
            orderBefore: currentHost.workspaceOrder.slice(),
          },
        });
        clearManagedTasksForWorkspace(targetId, {
          includeRunning: true,
          action: 'workspace-delete',
        });
        delete currentHost.workspaces[targetId];
        currentHost.workspaceOrder.splice(currentIndex, 1);
        if (!currentHost.workspaceOrder.length) {
          currentHost.activeWorkspaceId = '';
          currentHost.mirrorWorkspaceId = '';
          clearCurrentWorkspaceUiBeforeSwitch();
          closeSummaryDialog({ skipPersist: true });
          resetWorkflowStateForXmind(isDrawerOpen(), isDrawerFullscreen());
          renderWorkspaceTabs();
          updateSummary();
          if (isDrawerOpen()) render({ reason: 'workspace-delete-empty', persist: false });
          persistXmindState(true);
          return true;
        }
        if (wasActive) {
          var nextId = currentHost.workspaceOrder[Math.max(0, currentIndex - 1)] || currentHost.workspaceOrder[0];
          return switchWorkspace(nextId, {
            reason: 'workspace-delete-switch',
            centerRootAfterRender: false,
            skipCurrentSnapshotSave: true,
          });
        }
        renderWorkspaceTabs();
        persistXmindState(true);
        return true;
      };
      var needsConfirm = deleteOptions.skipConfirm === true ? false : workspaceNeedsCloseConfirm(targetId);
      setDebugState({
        closeWorkspaceAction: {
          workspaceId: targetId,
          phase: 'before-confirm',
          needsConfirm: needsConfirm === true,
        },
      });
      if (!needsConfirm) return proceed();
      openStoreConfirmDialog({
        title: '关闭生成页签',
        message: getWorkspaceDeleteConfirmMessage(getWorkspaceRecord(targetId)),
        confirmText: '直接关闭',
        cancelText: '取消',
      }).then(function(confirmed) {
        if (confirmed) proceed();
      });
      return true;
    }

    return {
      activateWorkspace: activateWorkspace,
      applyManagedTaskLiveRestoreContext: applyManagedTaskLiveRestoreContext,
      applySharedWorkspaceSnapshot: applySharedWorkspaceSnapshot,
      buildCurrentSharedWorkspaceSnapshot: buildCurrentSharedWorkspaceSnapshot,
      buildWorkspaceTabSummary: buildWorkspaceTabSummary,
      createWorkspaceAndOpenPrep: createWorkspaceAndOpenPrep,
      createWorkspaceSnapshotFromCurrent: createWorkspaceSnapshotFromCurrent,
      captureActiveManagedTaskRestoreContext: captureActiveManagedTaskRestoreContext,
      currentActiveWorkspaceHasContent: currentActiveWorkspaceHasContent,
      deleteWorkspace: deleteWorkspace,
      deriveLiveWorkspaceRecordName: deriveLiveWorkspaceRecordName,
      ensureActiveWorkspaceHydrated: ensureActiveWorkspaceHydrated,
      ensureWorkspaceRecordForManagedTask: ensureWorkspaceRecordForManagedTask,
      getCurrentWorkspaceRequirementIdentity: getCurrentWorkspaceRequirementIdentity,
      getWorkspaceDeleteConfirmMessage: getWorkspaceDeleteConfirmMessage,
      getWorkspaceModuleMirrorPayload: getWorkspaceModuleMirrorPayload,
      getWorkspaceOrder: getWorkspaceOrder,
      getWorkspaceSnapshotRequirementIdentity: getWorkspaceSnapshotRequirementIdentity,
      hasActiveWorkspace: hasActiveWorkspace,
      hasWorkspaceRunningTasks: hasWorkspaceRunningTasks,
      handleManagedTaskWorkspaceRecordsRestored: handleManagedTaskWorkspaceRecordsRestored,
      hydrateActiveWorkspaceSnapshot: hydrateActiveWorkspaceSnapshot,
      isWorkspaceDirty: isWorkspaceDirty,
      listWorkspaceProgressItems: listWorkspaceProgressItems,
      openWorkspaceFromProgressPanel: openWorkspaceFromProgressPanel,
      renderWorkspaceTabs: renderWorkspaceTabs,
      resetWorkflowStateForXmind: resetWorkflowStateForXmind,
      resetXmindCasegenState: resetXmindCasegenState,
      runInWorkspaceContextNow: runInWorkspaceContextNow,
      selectWorkspaceForMirror: selectWorkspaceForMirror,
      switchWorkspace: switchWorkspace,
      syncActiveWorkspaceSnapshot: syncActiveWorkspaceSnapshot,
      updateSummary: updateSummary,
      workspaceNeedsCloseConfirm: workspaceNeedsCloseConfirm,
    };
  }

  return { create: create };
});
