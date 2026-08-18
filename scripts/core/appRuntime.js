(function() {
  // 启动时预标记“用例库同步触发序号”：
  // - 仅当刷新前处于 tempexec（sessionStorage 记录）时，认为本次加载需要触发一次“同步+自动弹 diff”检查
  // - 进入 tempexec 页签时也会由 tempexec 模块递增该序号
  try {
    window.app = window.app || {};
    var cfg = window.app.config || {};
    var key = cfg.activeTabKey || 'usecase-active-tab';
    var saved = '';
    if (key && typeof sessionStorage !== 'undefined') {
      try {
        saved = String(sessionStorage.getItem(key) || '');
      } catch (err) {
        saved = '';
      }
    }
    if (saved === 'tempexec') {
      var prev = Number(window.app.__tempexecCaseLibrarySyncSeq || 0);
      if (!Number.isFinite(prev) || prev < 0) prev = 0;
      window.app.__tempexecCaseLibrarySyncSeq = prev + 1;
      window.app.__tempexecCaseLibrarySyncReason = 'load';
    }
  } catch (err) {
    try {
      window.app = window.app || {};
      if (!Number.isFinite(Number(window.app.__tempexecCaseLibrarySyncSeq || 0))) {
        window.app.__tempexecCaseLibrarySyncSeq = 0;
      }
    } catch (err2) {
      // ignore
    }
  }

  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var dom = ctx.dom || {};
    var api = ctx.api || {};
    var activeTabKey = ctx.activeTabKey || 'usecase-active-tab';
    var appUtils = ctx.appUtils || {};
    var assignIfPresent = ctx.assignIfPresent || function(target) { return target; };
    var tempExecApi = ctx.tempExecApi || {};
    var setStatus = ctx.setStatus || function() {};
    var renderAssignmentsSelect = ctx.renderAssignmentsSelect || function() {};
    var saveAssignments = ctx.saveAssignments || function() {};
    var renderCaseGeneration = ctx.renderCaseGeneration || function() {};
    var renderSettingsUI = ctx.renderSettingsUI || function() {};
    var scrollToSection = ctx.scrollToSection || function() {};
    var scrollElementIntoView = ctx.scrollElementIntoView || function() {};
    var renderCaseGenProgressBoard = api.renderCaseGenProgressBoard || ctx.renderCaseGenProgressBoard || function() {};
    var persistSettings = ctx.persistSettings || function() {};
    var loadModels = ctx.loadModels || function() {};
    var loadAssignments = ctx.loadAssignments || function() {};
    var renderModels = ctx.renderModels || function() {};
    var resetModelForm = ctx.resetModelForm || function() {};
    var toggleImportedCaseView = ctx.toggleImportedCaseView || function() {};
    var escapeHtml = ctx.escapeHtml;
    var escapeHtmlPreserve = ctx.escapeHtmlPreserve;
    var formatCompactTimestamp = ctx.formatCompactTimestamp || function() { return ''; };
    var callModelWithConfig = ctx.callModelWithConfig || function() { return Promise.reject(); };
    var callModelWithContent = ctx.callModelWithContent || function() { return Promise.reject(); };
    var getAssignedModel = ctx.getAssignedModel || function() {};
    var getReasoningForType = ctx.getReasoningForType || function() { return ''; };
    var getTemperatureForType = ctx.getTemperatureForType || function() { return 0.2; };
    var retainedGeneration = ctx.retainedGeneration || null;
    var missingReminderAiManager = ctx.missingReminderAiManager || null;
    var caseLibraryAiGenManager = ctx.caseLibraryAiGenManager || null;
    var xmindCaseGenTaskManager = ctx.xmindCaseGenTaskManager || null;
    var updateModelTiming = ctx.updateModelTiming || function() {};
    var downloadBlob = ctx.downloadBlob || function() {};
    var parseXmindFile = ctx.parseXmindFile || function() { return Promise.resolve({ text: '', list: [] }); };
    var updateAssignmentStatuses = ctx.updateAssignmentStatuses || function() {};
    var updateReasoningVisibility = ctx.updateReasoningVisibility || function() {};
    var testModel = ctx.testModel || function() {};
    var hasCaseSource = api.hasCaseSource || function() { return false; };
    var getCombinedCaseList = api.getCombinedCaseList || function() { return []; };
    var getCombinedCaseText = api.getCombinedCaseText || function() { return ''; };
    var deriveCaseListFromText = api.deriveCaseListFromText || function() { return []; };
    var parseCaseList = api.parseCaseList || function() { return []; };
    var renderCaseTable = api.renderCaseTable || function() {};
    var xmindCasegenModule = null;
    var sidebarBlockersBound = false;
    var workflowStorageKey = ctx.workflowStorageKey
      || (window.app && window.app.config && window.app.config.workflowStorageKey)
      || 'usecase-workflow-state-v1';
    var storage = window.app && window.app.services && window.app.services.storage ? window.app.services.storage : null;
    var workflowSnapshotMaxChars = 1500000;
    var xmindTaskStorageKey = 'tap-xmind-casegen-tasks';
    var xmindTaskStoragePreclearChars = 450000;
    var workflowPersistBound = false;
    var workflowRestoring = false;
    var deferredXmindRestoreTimer = 0;
    var deferredXmindRestoreFallbackTimer = 0;
    var xmindWorkspaceHostKeys = {
      activeWorkspaceId: 1,
      mirrorWorkspaceId: 1,
      workspaceOrder: 1,
      workspaces: 1,
      nextWorkspaceSeq: 1,
      openButtonDotVisible: 1,
    };

    function getPersistUserId() {
      if (state.currentUser && (state.currentUser.id || state.currentUser.id === 0)) {
        return String(state.currentUser.id);
      }
      return '';
    }

    function cloneJson(value, fallback) {
      if (value === undefined || value === null) return fallback;
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (err) {
        return fallback;
      }
    }

    function clearPersistedXmindTasks(reason) {
      var manager = xmindCaseGenTaskManager;
      if (manager && typeof manager.clearAllTasks === 'function') {
        manager.clearAllTasks(reason || 'workflow-reset');
        return true;
      }
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem(xmindTaskStorageKey);
          return true;
        } catch (err) {
          // ignore
        }
      }
      return false;
    }

    function markXmindTaskStorageRecovery(reason) {
      if (typeof window === 'undefined') return;
      window.app = window.app || {};
      window.app.__xmindCasegenTaskStorageRecovered = {
        reason: String(reason || ''),
        at: Date.now(),
      };
    }

    function normalizeImportedCases(list) {
      if (!Array.isArray(list)) return [];
      return list.map(function(item, idx) {
        var entry = item && typeof item === 'object' ? item : {};
        var name = entry.name ? String(entry.name) : ('测试用例' + (idx + 1));
        var text = entry.text ? String(entry.text) : '';
        var id = entry.id ? String(entry.id) : ('case-' + Date.now().toString(16) + '-' + idx);
        var caseList = Array.isArray(entry.list) ? entry.list : [];
        return {
          id: id,
          name: name,
          text: text,
          list: caseList,
        };
      });
    }

    function serializeCaseSelections(selectionMap) {
      var result = {};
      if (!selectionMap || typeof selectionMap !== 'object') return result;
      Object.keys(selectionMap).forEach(function(key) {
        var sel = selectionMap[key];
        if (!sel || typeof sel.forEach !== 'function') return;
        result[key] = Array.from(sel);
      });
      return result;
    }

    function createEmptyLegacyCaseGenSnapshot() {
      return {
        requirementLabel: '',
        requirementLabelSource: '',
        lastRawImportName: '',
        rawText: '',
        caseText: '',
        importedCases: [],
        requirementMedia: {
          docxImages: [],
          pastedImages: [],
          lastDocxImageCount: 0,
          updatedAt: 0,
        },
        modules: [],
        source: '',
        results: {},
        selections: {},
        suggestions: {},
        moduleStatus: {},
        progress: {},
        timing: {},
        progressNotice: {},
      };
    }

    function createEmptyRequirementMediaSnapshot() {
      return {
        docxImages: [],
        pastedImages: [],
        lastDocxImageCount: 0,
        updatedAt: 0,
      };
    }

    function compactCaseGenResultForPersistence(value) {
      var text = value === null || value === undefined ? '' : String(value || '');
      if (!text) return '';
      try {
        return JSON.stringify(JSON.parse(text));
      } catch (err) {
        return text;
      }
    }

    function compactCaseGenResultsMapForPersistence(map) {
      var source = map && typeof map === 'object' ? map : {};
      var next = {};
      Object.keys(source).forEach(function(key) {
        next[key] = compactCaseGenResultForPersistence(source[key]);
      });
      return next;
    }

    function compactRootPipelineSnapshotForPersistence(pipeline) {
      var source = pipeline && typeof pipeline === 'object' ? pipeline : null;
      if (!source) return null;
      return {
        id: String(source.id || ''),
        actionId: String(source.actionId || ''),
        snapshotId: String(source.snapshotId || ''),
        historyActionLabel: String(source.historyActionLabel || ''),
        stage: String(source.stage || ''),
        discoveryStatus: String(source.discoveryStatus || ''),
        hadAiContentBeforeAction: source.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: source.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: source.hadAiCasesBeforeAction === true,
        cancelled: source.cancelled === true,
        cancelReason: String(source.cancelReason || ''),
        errorCount: Number(source.errorCount || 0) || 0,
        createdModules: Number(source.createdModules || 0) || 0,
        addedCases: Number(source.addedCases || 0) || 0,
        detailMap: cloneJson(source.detailMap, {}) || {},
        diagnostics: Array.isArray(source.diagnostics) ? source.diagnostics.slice() : [],
        pendingQueue: Array.isArray(source.pendingQueue) ? cloneJson(source.pendingQueue, []) : [],
        updatedAt: Number(source.updatedAt || 0) || 0,
      };
    }

    function compactRootStateForPersistence(root) {
      var source = root && typeof root === 'object' ? root : {};
      return {
        lastAction: String(source.lastAction || ''),
        running: source.running === true,
        taskId: String(source.taskId || ''),
        hideAiLayer: source.hideAiLayer === true,
        snapshotId: '',
        status: String(source.status || ''),
        error: String(source.error || ''),
        updatedAt: Number(source.updatedAt || 0) || 0,
        pipeline: compactRootPipelineSnapshotForPersistence(source.pipeline),
      };
    }

    function compactModuleUiStateForPersistence(moduleState) {
      var source = moduleState && typeof moduleState === 'object' ? moduleState : {};
      return {
        lastAction: String(source.lastAction || ''),
        running: source.running === true,
        taskId: String(source.taskId || ''),
        rootPendingActionId: String(source.rootPendingActionId || ''),
        snapshotId: '',
        status: String(source.status || ''),
        error: String(source.error || ''),
        hideResults: source.hideResults === true,
        updatedAt: Number(source.updatedAt || 0) || 0,
        topupHighlight: null,
        rollbackRestoreTopupHighlight: null,
      };
    }

    function compactModulesMapForPersistence(map) {
      var source = map && typeof map === 'object' ? map : {};
      var next = {};
      Object.keys(source).forEach(function(key) {
        next[key] = compactModuleUiStateForPersistence(source[key]);
      });
      return next;
    }

    function buildPersistedSharedXmindSnapshotFromSource(source) {
      var current = source && typeof source === 'object' ? source : {};
      return {
        requirementLabel: current.requirementLabel || '',
        requirementLabelSource: current.requirementLabelSource || '',
        lastRawImportName: current.lastRawImportName || '',
        rawText: current.rawText || '',
        caseText: current.caseText || '',
        importedCases: normalizeImportedCases(current.importedCases),
        caseGenModules: cloneJson(current.caseGenModules, []),
        caseGenSource: current.caseGenSource || '',
        caseGenResults: compactCaseGenResultsMapForPersistence(current.caseGenResults),
        caseSelections: cloneJson(current.caseSelections, {}),
        caseGenSuggestions: cloneJson(current.caseGenSuggestions, {}),
        caseGenModuleStatus: cloneJson(current.caseGenModuleStatus, {}),
        caseGenProgress: cloneJson(current.caseGenProgress, {}),
        caseGenTiming: cloneJson(current.caseGenTiming, {}),
        caseGenProgressNotice: cloneJson(current.caseGenProgressNotice, {}),
        caseGenSettings: cloneJson(current.caseGenSettings, {}),
        requirementMedia: cloneJson(current.requirementMedia, createEmptyRequirementMediaSnapshot()),
      };
    }

    function compactXmindSnapshotForPersistence(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var next = {};
      Object.keys(source).forEach(function(key) {
        if (xmindWorkspaceHostKeys[key]) return;
        if (
          key === 'operationSnapshots'
          || key === 'rootSnapshots'
          || key === 'snapshots'
          || key === 'deleteUndoStack'
          || key === 'deleteRedoStack'
        ) {
          next[key] = [];
          return;
        }
        if (key === 'root') {
          next.root = compactRootStateForPersistence(source.root);
          return;
        }
        if (key === 'modules') {
          next.modules = compactModulesMapForPersistence(source.modules);
          return;
        }
        next[key] = cloneJson(source[key], source[key]);
      });
      next.lastOperationSnapshotId = '';
      next.rootSnapshotId = '';
      if (!next.root || typeof next.root !== 'object') {
        next.root = compactRootStateForPersistence(null);
      } else {
        next.root.snapshotId = '';
      }
      if (next.modules && typeof next.modules === 'object') {
        Object.keys(next.modules).forEach(function(key) {
          if (!next.modules[key] || typeof next.modules[key] !== 'object') return;
          next.modules[key].snapshotId = '';
        });
      }
      return next;
    }

    function compactWorkspaceSnapshotForPersistence(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      return {
        xmind: compactXmindSnapshotForPersistence(source.xmind),
        shared: buildPersistedSharedXmindSnapshotFromSource(source.shared),
      };
    }

    function compactWorkspaceRecordForPersistence(id, record) {
      var source = record && typeof record === 'object' ? record : {};
      var stableId = String(id || source.id || '');
      return {
        id: stableId,
        seq: Number(source.seq || 0) || 0,
        name: String(source.name || ''),
        generationId: String(source.generationId || ''),
        pendingOpenPrep: source.pendingOpenPrep === true,
        updatedAt: Number(source.updatedAt || 0) || 0,
        createdAt: Number(source.createdAt || 0) || 0,
        snapshot: compactWorkspaceSnapshotForPersistence(source.snapshot),
      };
    }

    function buildWorkflowSharedXmindSnapshot() {
      return buildPersistedSharedXmindSnapshotFromSource({
        requirementLabel: state.requirementLabel || '',
        requirementLabelSource: state.requirementLabelSource || '',
        lastRawImportName: state.lastRawImportName || '',
        rawText: dom.rawText && dom.rawText.value ? dom.rawText.value : '',
        caseText: dom.caseTextEl && dom.caseTextEl.value ? dom.caseTextEl.value : '',
        importedCases: normalizeImportedCases(state.importedCases),
        caseGenModules: cloneJson(state.caseGenModules, []),
        caseGenSource: state.caseGenSource || '',
        caseGenResults: state.caseGenResults,
        caseSelections: serializeCaseSelections(state.caseSelections),
        caseGenSuggestions: cloneJson(state.caseGenSuggestions, {}),
        caseGenModuleStatus: cloneJson(state.caseGenModuleStatus, {}),
        caseGenProgress: cloneJson(state.caseGenProgress, {}),
        caseGenTiming: cloneJson(state.caseGenTiming, {}),
        caseGenProgressNotice: cloneJson(state.caseGenProgressNotice, {}),
        caseGenSettings: cloneJson(state.caseGenSettings, {}),
        requirementMedia: cloneJson(state.requirementMedia, createEmptyRequirementMediaSnapshot()),
      });
    }

    function buildWorkflowSharedXmindSnapshotFromData(data) {
      return buildPersistedSharedXmindSnapshotFromSource(data);
    }

    function extractTopLevelXmindSnapshot(source) {
      var current = source && typeof source === 'object' ? source : {};
      var next = {};
      Object.keys(current).forEach(function(key) {
        if (xmindWorkspaceHostKeys[key]) return;
        next[key] = cloneJson(current[key], current[key]);
      });
      return next;
    }

    function shouldCompactActiveXmindWorkspaceSnapshot(hostState, activeWorkspaceId, activeXmindSnapshot, activeSharedSnapshot) {
      var host = hostState && typeof hostState === 'object' ? hostState : null;
      if (!host || !host.workspaces || typeof host.workspaces !== 'object') return false;
      var stableId = activeWorkspaceId ? String(activeWorkspaceId || '') : '';
      if (!stableId) return false;
      var record = host.workspaces[stableId];
      if (!record || typeof record !== 'object') return false;
      var snapshot = record.snapshot && typeof record.snapshot === 'object' ? record.snapshot : null;
      if (!snapshot) return false;
      var recordXmind = snapshot.xmind && typeof snapshot.xmind === 'object' ? snapshot.xmind : null;
      var recordShared = snapshot.shared && typeof snapshot.shared === 'object' ? snapshot.shared : null;
      if (!recordXmind || !recordShared) return false;
      try {
        return JSON.stringify(recordXmind) === JSON.stringify(activeXmindSnapshot)
          && JSON.stringify(recordShared) === JSON.stringify(activeSharedSnapshot);
      } catch (err) {
        return false;
      }
    }

    function buildPersistedXmindCaseGenSnapshot() {
      var source = state.xmindCaseGen && typeof state.xmindCaseGen === 'object'
        ? state.xmindCaseGen
        : {};
      var host = {
        activeWorkspaceId: source && source.activeWorkspaceId ? String(source.activeWorkspaceId || '') : '',
        mirrorWorkspaceId: source && source.mirrorWorkspaceId ? String(source.mirrorWorkspaceId || '') : '',
        workspaceOrder: Array.isArray(source && source.workspaceOrder) ? cloneJson(source.workspaceOrder, []) : [],
        workspaces: {},
        nextWorkspaceSeq: Number(source && source.nextWorkspaceSeq || 1) || 1,
        openButtonDotVisible: source && source.openButtonDotVisible === true,
      };
      var activeWorkspaceId = host.activeWorkspaceId;
      var activeXmindSnapshot = compactXmindSnapshotForPersistence(source);
      var activeSharedSnapshot = buildWorkflowSharedXmindSnapshot();
      Object.keys(activeXmindSnapshot).forEach(function(key) {
        host[key] = activeXmindSnapshot[key];
      });
      if (source.workspaces && typeof source.workspaces === 'object') {
        Object.keys(source.workspaces).forEach(function(workspaceId) {
          host.workspaces[workspaceId] = compactWorkspaceRecordForPersistence(workspaceId, source.workspaces[workspaceId]);
        });
      }
      if (!activeWorkspaceId || !host.workspaces || typeof host.workspaces !== 'object') {
        return host;
      }
      if (!shouldCompactActiveXmindWorkspaceSnapshot(host, activeWorkspaceId, activeXmindSnapshot, activeSharedSnapshot)) {
        return host;
      }
      var record = host.workspaces[activeWorkspaceId];
      if (!record || typeof record !== 'object') return host;
      record.snapshot = {
        __topLevelActiveSnapshot: true,
      };
      host.workspaces[activeWorkspaceId] = record;
      return host;
    }

    function restoreActiveXmindWorkspaceSnapshotFromTopLevel(data) {
      var source = data && typeof data === 'object' ? data : null;
      if (!source || !source.xmindCaseGen || typeof source.xmindCaseGen !== 'object') return source;
      var host = source.xmindCaseGen;
      var activeWorkspaceId = host.activeWorkspaceId ? String(host.activeWorkspaceId || '') : '';
      if (!activeWorkspaceId) return source;
      if (!host.workspaces || typeof host.workspaces !== 'object') {
        host.workspaces = {};
      }
      var record = host.workspaces[activeWorkspaceId];
      if (!record || typeof record !== 'object') {
        record = {
          id: activeWorkspaceId,
          seq: 0,
          name: '',
          pendingOpenPrep: false,
          updatedAt: 0,
          createdAt: 0,
        };
      }
      var markerSnapshot = record.snapshot && typeof record.snapshot === 'object' ? record.snapshot : null;
      var needsInflate = !markerSnapshot
        || markerSnapshot.__topLevelActiveSnapshot === true
        || (!markerSnapshot.xmind && !markerSnapshot.shared);
      if (!needsInflate) return source;
      record.snapshot = {
        xmind: extractTopLevelXmindSnapshot(host),
        shared: buildWorkflowSharedXmindSnapshotFromData(source),
      };
      host.workspaces[activeWorkspaceId] = record;
      if (!Array.isArray(host.workspaceOrder)) {
        host.workspaceOrder = activeWorkspaceId ? [activeWorkspaceId] : [];
      } else if (host.workspaceOrder.indexOf(activeWorkspaceId) === -1) {
        host.workspaceOrder = host.workspaceOrder.concat([activeWorkspaceId]);
      }
      return source;
    }

    function buildWorkflowSnapshot() {
      var data = {
        requirementLabel: state.requirementLabel || '',
        requirementLabelSource: state.requirementLabelSource || '',
        lastRawImportName: state.lastRawImportName || '',
        rawText: dom.rawText && dom.rawText.value ? dom.rawText.value : '',
        caseText: dom.caseTextEl && dom.caseTextEl.value ? dom.caseTextEl.value : '',
        importedCases: normalizeImportedCases(state.importedCases),
        requirementMedia: cloneJson(state.requirementMedia, {
          docxImages: [],
          pastedImages: [],
          lastDocxImageCount: 0,
          updatedAt: 0,
        }),
        caseGenSource: state.caseGenSource || '',
        caseGenModules: cloneJson(state.caseGenModules, []),
        caseGenResults: compactCaseGenResultsMapForPersistence(state.caseGenResults),
        caseGenSettings: cloneJson(state.caseGenSettings, {}),
        caseGenSuggestions: cloneJson(state.caseGenSuggestions, {}),
        caseGenModuleStatus: cloneJson(state.caseGenModuleStatus, {}),
        caseGenProgress: cloneJson(state.caseGenProgress, {}),
        caseGenTiming: cloneJson(state.caseGenTiming, {}),
        caseGenProgressNotice: cloneJson(state.caseGenProgressNotice, {}),
        xmindCaseGen: buildPersistedXmindCaseGenSnapshot(),
        caseSelections: serializeCaseSelections(state.caseSelections),
      };
      return {
        version: 1,
        user_id: getPersistUserId(),
        updated_at: Date.now(),
        data: data,
      };
    }

    function hasRequirementLabel(data) {
      if (!data) return false;
      var label = data.requirementLabel ? String(data.requirementLabel).trim() : '';
      if (!label) return false;
      var source = data.requirementLabelSource ? String(data.requirementLabelSource).trim() : '';
      if (source && source !== 'default') return true;
      return label !== '当前需求';
    }

    function hasXmindCaseGenContent(xmindCaseGen) {
      var data = xmindCaseGen && typeof xmindCaseGen === 'object' ? xmindCaseGen : null;
      if (!data) return false;
      var workspaceOrder = Array.isArray(data.workspaceOrder) ? data.workspaceOrder : [];
      var workspaces = data.workspaces && typeof data.workspaces === 'object' ? data.workspaces : {};
      if (workspaceOrder.length > 0) return true;
      if (Object.keys(workspaces).length > 0) return true;
      if (String(data.activeWorkspaceId || '').trim()) return true;
      if (Array.isArray(data.history) && data.history.length > 0) return true;
      if (Array.isArray(data.snapshots) && data.snapshots.length > 0) return true;
      if (Array.isArray(data.rootSnapshots) && data.rootSnapshots.length > 0) return true;
      if (Array.isArray(data.operationSnapshots) && data.operationSnapshots.length > 0) return true;
      if (data.modules && typeof data.modules === 'object' && Object.keys(data.modules).length > 0) return true;
      if (data.root && typeof data.root === 'object') {
        if (data.root.running === true) return true;
        if (String(data.root.taskId || '').trim()) return true;
        if (String(data.root.status || '').trim()) return true;
        if (String(data.root.error || '').trim()) return true;
      }
      if (data.prep && typeof data.prep === 'object') {
        if (data.prep.completed === true) return true;
        if (String(data.prep.requirementMode || '').trim()) return true;
        if (String(data.prep.requirementSupplement || '').trim()) return true;
        if (String(data.prep.caseImportMode || '').trim()) return true;
        if (String(data.prep.manualRequirementLabel || '').trim()) return true;
        if (Array.isArray(data.prep.manualRequirementBlocks) && data.prep.manualRequirementBlocks.length > 0) return true;
      }
      return false;
    }

    function snapshotHasContent(snapshot) {
      var data = snapshot && snapshot.data ? snapshot.data : {};
      function hasText(value) {
        return Boolean(value && String(value).trim());
      }
      if (hasText(data.rawText)) return true;
      if (hasText(data.caseText)) return true;
      if (hasRequirementLabel(data)) return true;
      if (Array.isArray(data.importedCases) && data.importedCases.length) return true;
      if (Array.isArray(data.caseGenModules) && data.caseGenModules.length) return true;
      if (data.caseGenSettings && typeof data.caseGenSettings === 'object') {
        var defaultCaseGenSettings = {
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
        var caseGenSettingKeys = Object.keys(defaultCaseGenSettings);
        var hasCaseGenSettingDiff = caseGenSettingKeys.some(function(key) {
          var currentValue = data.caseGenSettings[key];
          var defaultValue = defaultCaseGenSettings[key];
          if (typeof defaultValue === 'string') {
            return String(currentValue || '') !== defaultValue;
          }
          return (currentValue === true) !== (defaultValue === true);
        });
        if (hasCaseGenSettingDiff) {
          return true;
        }
      }
      if (data.caseGenSuggestions && typeof data.caseGenSuggestions === 'object') {
        var hasSug = Object.keys(data.caseGenSuggestions).some(function(key) {
          return hasText(data.caseGenSuggestions[key]);
        });
        if (hasSug) return true;
      }
      if (data.caseGenResults && typeof data.caseGenResults === 'object') {
        var hasRes = Object.keys(data.caseGenResults).some(function(key) {
          var val = (data.caseGenResults[key] || '').trim();
          return Boolean(val && !/^\[\s*\]$/.test(val));
        });
        if (hasRes) return true;
      }
      if (hasXmindCaseGenContent(data.xmindCaseGen)) return true;
      return false;
    }

    function persistWorkflowStateNow() {
      if (workflowRestoring || !workflowStorageKey) return;
      if (!storage || typeof storage.setJson !== 'function') return;
      var snapshot = buildWorkflowSnapshot();
      if (!snapshotHasContent(snapshot)) {
        if (storage && typeof storage.remove === 'function') storage.remove(workflowStorageKey);
        return;
      }
      storage.setJson(workflowStorageKey, snapshot);
    }

    var persistWorkflowState = typeof appUtils.debounce === 'function'
      ? appUtils.debounce(persistWorkflowStateNow, 300)
      : persistWorkflowStateNow;
    if (!window.app) window.app = {};
    window.app.persistWorkflowState = persistWorkflowState;
    window.app.persistWorkflowStateNow = persistWorkflowStateNow;
    api.persistWorkflowState = persistWorkflowState;
    api.persistWorkflowStateNow = persistWorkflowStateNow;

    function restoreCaseSelections(data) {
      var result = {};
      if (!data || typeof data !== 'object') return result;
      Object.keys(data).forEach(function(key) {
        var items = Array.isArray(data[key]) ? data[key] : [];
        result[key] = new Set(items.map(function(v) { return Number(v); }).filter(function(v) { return Number.isFinite(v); }));
      });
      return result;
    }

    function applyWorkflowSnapshot(snapshot) {
      if (!snapshot || !snapshot.data || typeof snapshot.data !== 'object') return false;
      var data = restoreActiveXmindWorkspaceSnapshotFromTopLevel(cloneJson(snapshot.data, snapshot.data));
      state.requirementLabel = data.requirementLabel || '';
      state.requirementLabelSource = data.requirementLabelSource || '';
      state.lastRawImportName = data.lastRawImportName || '';
      if (dom.rawText) dom.rawText.value = data.rawText || '';
      if (dom.fileName) {
        dom.fileName.textContent = data.lastRawImportName ? String(data.lastRawImportName) : '未选择文件';
      }
      if (dom.caseTextEl) dom.caseTextEl.value = data.caseText || '';
      state.importedCases = normalizeImportedCases(data.importedCases);
      state.requirementMedia = (data.requirementMedia && typeof data.requirementMedia === 'object')
        ? cloneJson(data.requirementMedia, {
            docxImages: [],
            pastedImages: [],
            lastDocxImageCount: 0,
            updatedAt: 0,
          })
        : cloneJson(state.requirementMedia, {
            docxImages: [],
            pastedImages: [],
            lastDocxImageCount: 0,
            updatedAt: 0,
          });
      if (!state.requirementMedia || typeof state.requirementMedia !== 'object') {
        state.requirementMedia = {
          docxImages: [],
          pastedImages: [],
          lastDocxImageCount: 0,
          updatedAt: 0,
        };
      }
      if (!Array.isArray(state.requirementMedia.docxImages)) state.requirementMedia.docxImages = [];
      if (!Array.isArray(state.requirementMedia.pastedImages)) state.requirementMedia.pastedImages = [];
      if (!Number.isFinite(Number(state.requirementMedia.lastDocxImageCount))) state.requirementMedia.lastDocxImageCount = 0;
      if (!Number.isFinite(Number(state.requirementMedia.updatedAt))) state.requirementMedia.updatedAt = 0;
      state.caseGenSource = data.caseGenSource || '';
      state.caseGenModules = Array.isArray(data.caseGenModules) ? data.caseGenModules : [];
      state.caseGenResults = (data.caseGenResults && typeof data.caseGenResults === 'object') ? data.caseGenResults : {};
      state.caseGenSettings = (data.caseGenSettings && typeof data.caseGenSettings === 'object') ? data.caseGenSettings : {};
      state.caseGenSuggestions = (data.caseGenSuggestions && typeof data.caseGenSuggestions === 'object') ? data.caseGenSuggestions : {};
      state.caseGenModuleStatus = (data.caseGenModuleStatus && typeof data.caseGenModuleStatus === 'object') ? data.caseGenModuleStatus : {};
      state.caseGenProgress = (data.caseGenProgress && typeof data.caseGenProgress === 'object') ? data.caseGenProgress : {};
      state.caseGenTiming = (data.caseGenTiming && typeof data.caseGenTiming === 'object') ? data.caseGenTiming : {};
      state.caseGenProgressNotice = (data.caseGenProgressNotice && typeof data.caseGenProgressNotice === 'object') ? data.caseGenProgressNotice : {};
      state.caseGenLegacy = createEmptyLegacyCaseGenSnapshot();
      state.xmindCaseGen = (data.xmindCaseGen && typeof data.xmindCaseGen === 'object') ? data.xmindCaseGen : {
        activeWorkspaceId: '',
        mirrorWorkspaceId: '',
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
          taskId: '',
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
      if (!state.caseGenProgressNotice.lastStates || typeof state.caseGenProgressNotice.lastStates !== 'object') {
        state.caseGenProgressNotice.lastStates = {};
      }
      state.caseGenProgressNotice.dotVisible = state.caseGenProgressNotice.dotVisible === true;
      if (!state.caseGenLegacy || typeof state.caseGenLegacy !== 'object') {
        state.caseGenLegacy = createEmptyLegacyCaseGenSnapshot();
      }
      state.caseGenLegacy.requirementLabel = String(state.caseGenLegacy.requirementLabel || '');
      state.caseGenLegacy.requirementLabelSource = String(state.caseGenLegacy.requirementLabelSource || '');
      state.caseGenLegacy.lastRawImportName = String(state.caseGenLegacy.lastRawImportName || '');
      state.caseGenLegacy.rawText = String(state.caseGenLegacy.rawText || '');
      state.caseGenLegacy.caseText = String(state.caseGenLegacy.caseText || '');
      if (!state.caseGenLegacy.requirementLabel && state.requirementLabel) {
        state.caseGenLegacy.requirementLabel = String(state.requirementLabel || '');
      }
      if (!state.caseGenLegacy.requirementLabelSource && state.requirementLabelSource) {
        state.caseGenLegacy.requirementLabelSource = String(state.requirementLabelSource || '');
      }
      if (!state.caseGenLegacy.lastRawImportName && state.lastRawImportName) {
        state.caseGenLegacy.lastRawImportName = String(state.lastRawImportName || '');
      }
      if (!state.caseGenLegacy.rawText && data.rawText) {
        state.caseGenLegacy.rawText = String(data.rawText || '');
      }
      if (!state.caseGenLegacy.caseText && data.caseText) {
        state.caseGenLegacy.caseText = String(data.caseText || '');
      }
      state.caseGenLegacy.importedCases = normalizeImportedCases(state.caseGenLegacy.importedCases);
      if (!state.caseGenLegacy.importedCases.length && state.importedCases && state.importedCases.length) {
        state.caseGenLegacy.importedCases = normalizeImportedCases(state.importedCases);
      }
      if (!state.caseGenLegacy.requirementMedia || typeof state.caseGenLegacy.requirementMedia !== 'object') {
        state.caseGenLegacy.requirementMedia = {
          docxImages: [],
          pastedImages: [],
          lastDocxImageCount: 0,
          updatedAt: 0,
        };
      }
      if (!Array.isArray(state.caseGenLegacy.requirementMedia.docxImages)) state.caseGenLegacy.requirementMedia.docxImages = [];
      if (!Array.isArray(state.caseGenLegacy.requirementMedia.pastedImages)) state.caseGenLegacy.requirementMedia.pastedImages = [];
      if (!Number.isFinite(Number(state.caseGenLegacy.requirementMedia.lastDocxImageCount))) {
        state.caseGenLegacy.requirementMedia.lastDocxImageCount = 0;
      }
      if (!Number.isFinite(Number(state.caseGenLegacy.requirementMedia.updatedAt))) {
        state.caseGenLegacy.requirementMedia.updatedAt = 0;
      }
      if (
        state.requirementMedia
        && typeof state.requirementMedia === 'object'
        && !state.caseGenLegacy.requirementMedia.docxImages.length
        && !state.caseGenLegacy.requirementMedia.pastedImages.length
      ) {
        state.caseGenLegacy.requirementMedia = cloneJson(state.requirementMedia, {
          docxImages: [],
          pastedImages: [],
          lastDocxImageCount: 0,
          updatedAt: 0,
        });
      }
      if (!Array.isArray(state.caseGenLegacy.modules)) state.caseGenLegacy.modules = [];
      state.caseGenLegacy.source = String(state.caseGenLegacy.source || '');
      if (!state.caseGenLegacy.results || typeof state.caseGenLegacy.results !== 'object') state.caseGenLegacy.results = {};
      if (!state.caseGenLegacy.selections || typeof state.caseGenLegacy.selections !== 'object') state.caseGenLegacy.selections = {};
      if (!state.caseGenLegacy.suggestions || typeof state.caseGenLegacy.suggestions !== 'object') state.caseGenLegacy.suggestions = {};
      if (!state.caseGenLegacy.moduleStatus || typeof state.caseGenLegacy.moduleStatus !== 'object') state.caseGenLegacy.moduleStatus = {};
      if (!state.caseGenLegacy.progress || typeof state.caseGenLegacy.progress !== 'object') state.caseGenLegacy.progress = {};
      if (!state.caseGenLegacy.timing || typeof state.caseGenLegacy.timing !== 'object') state.caseGenLegacy.timing = {};
      if (!state.caseGenLegacy.progressNotice || typeof state.caseGenLegacy.progressNotice !== 'object') {
        state.caseGenLegacy.progressNotice = {};
      }
      if (!Array.isArray(state.xmindCaseGen.history)) state.xmindCaseGen.history = [];
      if (!Array.isArray(state.xmindCaseGen.operationSnapshots)) state.xmindCaseGen.operationSnapshots = [];
      if (!Array.isArray(state.xmindCaseGen.snapshots)) state.xmindCaseGen.snapshots = [];
      if (!Array.isArray(state.xmindCaseGen.rootSnapshots)) state.xmindCaseGen.rootSnapshots = [];
      if (!Array.isArray(state.xmindCaseGen.workspaceOrder)) state.xmindCaseGen.workspaceOrder = [];
      if (!state.xmindCaseGen.workspaces || typeof state.xmindCaseGen.workspaces !== 'object') state.xmindCaseGen.workspaces = {};
      state.xmindCaseGen.activeWorkspaceId = String(state.xmindCaseGen.activeWorkspaceId || '');
      state.xmindCaseGen.mirrorWorkspaceId = String(state.xmindCaseGen.mirrorWorkspaceId || '');
      if (!Number.isFinite(Number(state.xmindCaseGen.nextWorkspaceSeq))) state.xmindCaseGen.nextWorkspaceSeq = 1;
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
      if (!Array.isArray(state.xmindCaseGen.viewState.collapsedNodeKeys)) state.xmindCaseGen.viewState.collapsedNodeKeys = [];
      if (!Array.isArray(state.xmindCaseGen.deletedBaselineModuleKeys)) state.xmindCaseGen.deletedBaselineModuleKeys = [];
      if (!Array.isArray(state.xmindCaseGen.deletedBaselineCaseKeys)) state.xmindCaseGen.deletedBaselineCaseKeys = [];
      if (!Array.isArray(state.xmindCaseGen.deleteUndoStack)) state.xmindCaseGen.deleteUndoStack = [];
      if (!Array.isArray(state.xmindCaseGen.deleteRedoStack)) state.xmindCaseGen.deleteRedoStack = [];
      if (!state.xmindCaseGen.modules || typeof state.xmindCaseGen.modules !== 'object') state.xmindCaseGen.modules = {};
      if (!state.xmindCaseGen.root || typeof state.xmindCaseGen.root !== 'object') {
        state.xmindCaseGen.root = {
          lastAction: '',
          running: false,
          taskId: '',
          snapshotId: '',
          status: '',
          error: '',
          updatedAt: 0,
        };
      }
      if (!Number.isFinite(Number(state.xmindCaseGen.nextSnapshotId))) state.xmindCaseGen.nextSnapshotId = 1;
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
      state.xmindCaseGen.root.taskId = String(state.xmindCaseGen.root.taskId || '');
      state.xmindCaseGen.viewState.drawerOpen = state.xmindCaseGen.viewState.drawerOpen === true;
      state.xmindCaseGen.viewState.fullscreen = state.xmindCaseGen.viewState.fullscreen === true;
      state.xmindCaseGen.viewState.transform = String(state.xmindCaseGen.viewState.transform || '');
      state.xmindCaseGen.viewState.scaleVal = Number(state.xmindCaseGen.viewState.scaleVal || 1);
      if (!isFinite(state.xmindCaseGen.viewState.scaleVal) || state.xmindCaseGen.viewState.scaleVal <= 0) {
        state.xmindCaseGen.viewState.scaleVal = 1;
      }
      state.xmindCaseGen.viewState.scrollLeft = Number(state.xmindCaseGen.viewState.scrollLeft || 0);
      if (!isFinite(state.xmindCaseGen.viewState.scrollLeft) || state.xmindCaseGen.viewState.scrollLeft < 0) {
        state.xmindCaseGen.viewState.scrollLeft = 0;
      }
      state.xmindCaseGen.viewState.scrollTop = Number(state.xmindCaseGen.viewState.scrollTop || 0);
      if (!isFinite(state.xmindCaseGen.viewState.scrollTop) || state.xmindCaseGen.viewState.scrollTop < 0) {
        state.xmindCaseGen.viewState.scrollTop = 0;
      }
      state.xmindCaseGen.viewState.collapsedNodeKeys = state.xmindCaseGen.viewState.collapsedNodeKeys
        .map(function(item) {
          return String(item || '').trim();
        })
        .filter(Boolean);
      state.xmindCaseGen.viewState.treeSourceSignature = String(state.xmindCaseGen.viewState.treeSourceSignature || '');
      state.xmindCaseGen.viewState.updatedAt = Number(state.xmindCaseGen.viewState.updatedAt || 0);
      if (!isFinite(state.xmindCaseGen.viewState.updatedAt) || state.xmindCaseGen.viewState.updatedAt < 0) {
        state.xmindCaseGen.viewState.updatedAt = 0;
      }
      state.xmindCaseGen.deletedBaselineModuleKeys = state.xmindCaseGen.deletedBaselineModuleKeys.map(function(item) {
        return String(item || '').trim().toLowerCase();
      }).filter(Boolean);
      state.xmindCaseGen.deletedBaselineCaseKeys = state.xmindCaseGen.deletedBaselineCaseKeys.map(function(item) {
        return String(item || '').trim();
      }).filter(Boolean);
      state.xmindCaseGen.summaryCollapsed = state.xmindCaseGen.summaryCollapsed === true;
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
      state.xmindCaseGen.prep.step = Math.max(1, Math.min(3, Number(state.xmindCaseGen.prep.step) || 1));
      state.xmindCaseGen.prep.requirementMode = state.xmindCaseGen.prep.requirementMode === 'manual' ? 'manual' : (state.xmindCaseGen.prep.requirementMode === 'document' ? 'document' : '');
      state.xmindCaseGen.prep.requirementSupplement = String(state.xmindCaseGen.prep.requirementSupplement || '');
      if (!Array.isArray(state.xmindCaseGen.prep.manualRequirementBlocks)) state.xmindCaseGen.prep.manualRequirementBlocks = [];
      state.xmindCaseGen.prep.caseImportMode = state.xmindCaseGen.prep.caseImportMode === 'import'
        ? 'import'
        : (state.xmindCaseGen.prep.caseImportMode === 'skip' ? 'skip' : '');
      state.xmindCaseGen.prep.completed = state.xmindCaseGen.prep.completed === true;
      state.caseSelections = restoreCaseSelections(data.caseSelections);
      state.caseGenRunning = new Set();
      return true;
    }

    function restoreWorkflowState() {
      if (!storage || typeof storage.getJson !== 'function') return false;
      if (!workflowStorageKey) return false;
      var rawSnapshot = '';
      try {
        if (typeof localStorage !== 'undefined') {
          rawSnapshot = localStorage.getItem(workflowStorageKey) || '';
        }
      } catch (err) {
        rawSnapshot = '';
      }
      if (rawSnapshot && rawSnapshot.length > workflowSnapshotMaxChars) {
        if (storage && typeof storage.remove === 'function') storage.remove(workflowStorageKey);
        clearPersistedXmindTasks('workflow-oversize-reset');
        state.workflowRecoveryNotice = {
          reason: 'oversize',
          shown: false,
        };
        return false;
      }
      var snapshot = storage.getJson(workflowStorageKey, null);
      if (!snapshot || typeof snapshot !== 'object') {
        if (rawSnapshot) {
          if (storage && typeof storage.remove === 'function') storage.remove(workflowStorageKey);
          clearPersistedXmindTasks('workflow-invalid-reset');
          state.workflowRecoveryNotice = {
            reason: 'invalid',
            shown: false,
          };
        }
        return false;
      }
      if (snapshot.user_id && state.currentUser && (state.currentUser.id || state.currentUser.id === 0)) {
        if (String(snapshot.user_id) !== String(state.currentUser.id)) return false;
      }
      return applyWorkflowSnapshot(snapshot);
    }

    function preclearOversizeWorkflowSnapshotBeforeModuleInit() {
      if (!workflowStorageKey) return false;
      var rawSnapshot = '';
      try {
        if (typeof localStorage !== 'undefined') {
          rawSnapshot = localStorage.getItem(workflowStorageKey) || '';
        }
      } catch (err) {
        rawSnapshot = '';
      }
      if (!rawSnapshot || rawSnapshot.length <= workflowSnapshotMaxChars) return false;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(workflowStorageKey);
        }
      } catch (err) {
        // ignore
      }
      clearPersistedXmindTasks('workflow-oversize-preinit-reset');
      state.workflowRecoveryNotice = {
        reason: 'oversize',
        shown: false,
      };
      return true;
    }

    function preclearOversizeXmindTaskStorageBeforeModuleInit() {
      var rawTasks = '';
      try {
        if (typeof localStorage !== 'undefined') {
          rawTasks = localStorage.getItem(xmindTaskStorageKey) || '';
        }
      } catch (err) {
        rawTasks = '';
      }
      if (!rawTasks || rawTasks.length <= xmindTaskStoragePreclearChars) return false;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(xmindTaskStorageKey);
        }
      } catch (err) {
        return false;
      }
      markXmindTaskStorageRecovery('preinit-oversize');
      return true;
    }

    function flushWorkflowRecoveryNotice() {
      var notice = state && state.workflowRecoveryNotice && typeof state.workflowRecoveryNotice === 'object'
        ? state.workflowRecoveryNotice
        : null;
      if (!notice || notice.shown === true) return false;
      notice.shown = true;
      if (!appUtils || typeof appUtils.showCenterToast !== 'function') return true;
      var text = notice.reason === 'oversize'
        ? '检测到本地流程缓存过大，已自动清理异常缓存并恢复页面。'
        : '检测到本地流程缓存异常，已自动清理异常缓存并恢复页面。';
      appUtils.showCenterToast(text, 'warn', 5000);
      return true;
    }

    function bindWorkflowPersistenceListeners() {
      if (workflowPersistBound) return;
      var targets = [
        dom.rawText,
        dom.caseTextEl,
      ];
      targets.forEach(function(el) {
        if (!el || !el.addEventListener) return;
        el.addEventListener('input', function() { persistWorkflowState(); });
      });
      workflowPersistBound = true;
    }

    function focusAssignSaveIfNeeded() {
      var assignBtn = document.querySelector('[data-tab-btn="assign"]');
      var badge = assignBtn && assignBtn.querySelector('.tab-notice');
      var needScroll = Boolean(state && state.assignmentsMissing);
      if (!needScroll) {
        needScroll = badge && typeof badge.textContent === 'string' && badge.textContent.indexOf('未保存指派模型') !== -1;
      }
      if (!needScroll) return;
      var saveBar = document.getElementById('assignSaveBar');
      var saveBtn = document.getElementById('saveAssignments');
      if (saveBar) saveBar.classList.remove('hidden');
      var target = saveBar || saveBtn;
      if (!target) return;
      function scrollToSave() {
        if (target.scrollIntoView) {
          target.scrollIntoView({ behavior: 'auto', block: 'start' });
        } else if (typeof scrollElementIntoView === 'function') {
          scrollElementIntoView(target, 'auto', 140);
        }
      }
      setTimeout(scrollToSave, 0);
      setTimeout(scrollToSave, 200);
      setTimeout(scrollToSave, 400);
    }

    (function bindAssignTabClick() {
      var assignBtn = document.querySelector('[data-tab-btn="assign"]');
      if (!assignBtn) return;
      assignBtn.addEventListener('click', focusAssignSaveIfNeeded);
    })();

    function isDrawerOpen() {
      var body = document.body;
      var root = document.documentElement;
      var bodyHas = body && body.classList && body.classList.contains('drawer-open');
      var rootHas = root && root.classList && root.classList.contains('drawer-open');
      if (bodyHas || rootHas) return true;
      var openDrawer = document.querySelector ? document.querySelector('.drawer.open') : null;
      return Boolean(openDrawer);
    }

    function blockSidebarIfDrawerOpen(e) {
      if (!isDrawerOpen()) return false;
      var target = e && e.target && e.target.closest ? e.target.closest('.sidebar') : null;
      if (!target) return false;
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      return true;
    }

    function ensureSidebarBlockers() {
      var alreadyBound = sidebarBlockersBound || (window.app && window.app.sidebarBlockersBound);
      if (alreadyBound) return;
      document.addEventListener('pointerdown', blockSidebarIfDrawerOpen, true);
      document.addEventListener('click', blockSidebarIfDrawerOpen, true);
      document.addEventListener('keydown', blockSidebarIfDrawerOpen, true);
      sidebarBlockersBound = true;
      if (!window.app) window.app = {};
      window.app.sidebarBlockersBound = true;
    }
    if (!window.app) window.app = {};
    window.app.isDrawerOpen = isDrawerOpen;

    function getGroupNameForTab(tabName) {
      var menus = Array.prototype.slice.call(document.querySelectorAll('.tab-submenu'));
      for (var i = 0; i < menus.length; i++) {
        var menu = menus[i];
        if (!menu) continue;
        var match = menu.querySelector('[data-tab-btn="' + tabName + '"]');
        if (match && menu.dataset && menu.dataset.groupMenu) {
          return menu.dataset.groupMenu;
        }
      }
      return '';
    }

    function showTabGroup(name, opts) {
      opts = opts || {};
      var keepTabActive = Boolean(opts.keepTabActive);
      var expand = opts.expand !== false; // 默认展开
      if (!window.app) window.app = {};
      window.app.lastTabGroup = name || '';
      window.app.lastShowRan = true;
      var menus = Array.prototype.slice.call(document.querySelectorAll('.tab-submenu'));
      menus.forEach(function(menu) {
        var group = menu.closest('.tab-group');
        if (group && group.classList) group.classList.remove('open');
        menu.classList.add('hidden');
        menu.style.display = 'none';
        var btn = group && group.querySelector('.tab-group-btn');
        if (btn && btn.setAttribute) btn.setAttribute('aria-expanded', 'false');
        if (btn && btn.classList) btn.classList.remove('hovering');
      });
      if (!name) return;
      var target = document.querySelector('[data-group-menu="' + name + '"]');
      var targetGroup = target && target.closest ? target.closest('.tab-group') : null;
      var tBtn = targetGroup && targetGroup.querySelector ? targetGroup.querySelector('.tab-group-btn') : null;
      if (expand && target && targetGroup) {
        target.classList.remove('hidden');
        target.style.display = 'flex';
        targetGroup.classList.add('open');
        if (tBtn && tBtn.setAttribute) tBtn.setAttribute('aria-expanded', 'true');
      }
      if (expand && tBtn && tBtn.classList) tBtn.classList.add('hovering');
      if (keepTabActive) {
        var activeTabName = state && state.activeTab;
        if (activeTabName) {
          var tabBtns = Array.prototype.slice.call(document.querySelectorAll('[data-tab-btn]'));
          tabBtns.forEach(function(tb) {
            var isActive = tb.dataset && tb.dataset.tabBtn === activeTabName;
            tb.classList.toggle('active', isActive);
          });
        }
      }
    }
    if (window.app) window.app.showTabGroup = showTabGroup;

    function markActiveTabGroup(tabName) {
      var activeGroup = '';
      if (dom.tabSubmenus && typeof dom.tabSubmenus.forEach === 'function') {
        dom.tabSubmenus.forEach(function(menu) {
          var hasBtn = menu && menu.querySelector && menu.querySelector('[data-tab-btn=\"' + tabName + '\"]');
          if (hasBtn && menu.dataset && menu.dataset.groupMenu) {
            activeGroup = menu.dataset.groupMenu;
          }
        });
      }
      if (dom.tabGroupButtons && typeof dom.tabGroupButtons.forEach === 'function') {
        dom.tabGroupButtons.forEach(function(btn) {
          var match = btn.dataset && btn.dataset.group === activeGroup;
          btn.classList.toggle('active', Boolean(match));
        });
      }
    }

    (function bindTabGroups() {
      ensureSidebarBlockers();
      if (!window.app) window.app = {};
      window.app.isDrawerOpen = isDrawerOpen;
      var buttons = dom.tabGroupButtons;
      if (!buttons || typeof buttons.forEach !== 'function' || !buttons.length) {
        dom.tabGroups = document.querySelectorAll('.tab-group');
        dom.tabSubmenus = document.querySelectorAll('.tab-submenu');
        buttons = document.querySelectorAll('.tab-group-btn');
        dom.tabGroupButtons = buttons;
      }
      if (!buttons || typeof buttons.forEach !== 'function') return;
      window.app.tabGroupBound = true;
      if (dom.tabGroups && typeof dom.tabGroups.forEach === 'function') {
        dom.tabGroups.forEach(function(group) {
          var btn = group.querySelector('.tab-group-btn');
          var name = btn && btn.dataset ? btn.dataset.group : '';
          group.addEventListener('mouseenter', function() {
            if (isDrawerOpen()) return;
            showTabGroup(name);
          });
        });
      }
      buttons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          if (blockSidebarIfDrawerOpen(e)) return;
          if (!window.app) window.app = {};
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          var name = btn.dataset && btn.dataset.group;
          window.app.lastTabClick = name || '';
          window.app.lastShowCall = 'pending';
          if (!name) return;
          showTabGroup(name);
          window.app.lastShowCall = 'force-open-' + name;
        });
        btn.addEventListener('mouseenter', function() {
          if (isDrawerOpen()) return;
          var name = btn.dataset && btn.dataset.group;
          if (!name) return;
          showTabGroup(name);
        });
        btn.addEventListener('focus', function() {
          if (isDrawerOpen()) return;
          var name = btn.dataset && btn.dataset.group;
          if (!name) return;
          showTabGroup(name);
        });
      });
      document.addEventListener('click', function(e) {
        if (isDrawerOpen()) return;
        var insideGroup = e && e.target && e.target.closest && e.target.closest('.tab-group');
        if (!insideGroup) showTabGroup('');
      });
      var sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        sidebar.addEventListener('mouseleave', function() { showTabGroup(''); });
      }
      document.addEventListener('click', function(ev) {
        if (blockSidebarIfDrawerOpen(ev)) return;
        var btn = ev && ev.target && ev.target.closest ? ev.target.closest('.tab-group-btn') : null;
        if (!btn) return;
        var name = btn.dataset ? btn.dataset.group : '';
        if (!name) return;
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
        showTabGroup(name);
      });
    })();

    function getLoginSeq() {
      try {
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem('tap-login-seq') || '';
        }
      } catch (err) {
        // ignore
      }
      return '';
    }

    function persistActiveTabForSession(name) {
      if (!name) return;
      if (!activeTabKey || typeof sessionStorage === 'undefined') return;
      try {
        sessionStorage.setItem(activeTabKey, name);
        var seq = getLoginSeq();
        if (seq) sessionStorage.setItem('tap-active-tab-login-seq', seq);
      } catch (err) {
        // ignore
      }
    }

    function getActiveTabFromDom() {
      // 兜底：如果某些路径未走 switchTab，也尽量从 DOM 推断当前可见页签并持久化。
      var btn = document.querySelector('[data-tab-btn].active');
      var tab = btn && btn.dataset ? btn.dataset.tabBtn : '';
      return tab || (state && state.activeTab ? state.activeTab : '');
    }

    function getTabPageMap() {
      var cfg = window.app && window.app.config ? window.app.config : {};
      return cfg && cfg.tabPageMap ? cfg.tabPageMap : {};
    }

    function parseQuery(search) {
      var result = {};
      if (!search) return result;
      var raw = String(search || '').replace(/^\?/, '');
      if (!raw) return result;
      raw.split('&').forEach(function(pair) {
        if (!pair) return;
        var parts = pair.split('=');
        var key = decodeURIComponent(parts.shift() || '');
        if (!key) return;
        var value = parts.length ? decodeURIComponent(parts.join('=')) : '';
        result[key] = value;
      });
      return result;
    }

    function buildQuery(params) {
      var list = [];
      var keys = Object.keys(params || {});
      keys.forEach(function(key) {
        if (!key) return;
        var val = params[key];
        if (val === undefined || val === null || val === '') return;
        list.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(val)));
      });
      return list.length ? '?' + list.join('&') : '';
    }

    function getCurrentPageName() {
      if (typeof window === 'undefined' || !window.location) return '';
      var path = window.location.pathname || '';
      if (!path) return '';
      var parts = path.split('/').filter(Boolean);
      return parts.length ? parts[parts.length - 1] : '';
    }

    function getTabFromUrl() {
      if (typeof window === 'undefined' || !window.location) return '';
      var params = parseQuery(window.location.search || '');
      return params && params.tab ? String(params.tab || '') : '';
    }

    function buildTabUrl(path, tabName) {
      if (!path) return '';
      var hash = '';
      var hashIndex = path.indexOf('#');
      if (hashIndex >= 0) {
        hash = path.slice(hashIndex);
        path = path.slice(0, hashIndex);
      }
      var queryIndex = path.indexOf('?');
      var params = {};
      var base = path;
      if (queryIndex >= 0) {
        params = parseQuery(path.slice(queryIndex));
        base = path.slice(0, queryIndex);
      }
      if (tabName) {
        params.tab = tabName;
      } else if (params.tab) {
        delete params.tab;
      }
      return base + buildQuery(params) + hash;
    }

    function shouldForceRedirect() {
      var pageKey = '';
      if (document && document.body && document.body.dataset && document.body.dataset.page) {
        pageKey = String(document.body.dataset.page || '');
      }
      if (pageKey === 'index') return true;
      var current = getCurrentPageName();
      return !current || current === 'index.html' || current === 'index';
    }

    function syncHistoryForTab(name, options) {
      if (!name) return;
      if (typeof window === 'undefined' || !window.history || typeof window.history.pushState !== 'function') return;
      var current = (window.location ? (window.location.pathname || '') + (window.location.search || '') + (window.location.hash || '') : '');
      if (!current) return;
      var target = buildTabUrl(current, name);
      if (!target || target === current) return;
      try {
        if (options && options.replaceHistory) {
          window.history.replaceState({ tab: name }, '', target);
        } else {
          window.history.pushState({ tab: name }, '', target);
        }
      } catch (err) {
        // ignore
      }
    }

    function resolveTabPage(name) {
      if (!name) return '';
      var map = getTabPageMap();
      return map && map[name] ? String(map[name]) : '';
    }

    function hasLocalTabSection(name) {
      if (!name || typeof document === 'undefined') return false;
      return Boolean(document.querySelector('[data-tab-section=\"' + name + '\"]'));
    }

    function redirectToTabPage(name) {
      var target = resolveTabPage(name);
      if (!target) return false;
      var current = getCurrentPageName();
      if (current && current === target) return false;
      // Flush workflow snapshot before cross-page navigation to avoid debounce loss.
      persistWorkflowStateNow();
      persistActiveTabForSession(name);
      try {
        window.location.href = buildTabUrl(target, name) || target;
      } catch (err) {
        // ignore
      }
      return true;
    }

    function closeXmindContextBeforeLeave(nextTabName) {
      var nextName = nextTabName ? String(nextTabName || '') : '';
      if (!nextName || nextName === 'casesgen') return false;
      if (String(state.activeTab || '') !== 'casesgen') return false;
      var xmindApi = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      var xmindDrawerOpen = Boolean(xmindApi && typeof xmindApi.isOpen === 'function' && xmindApi.isOpen());
      if (!xmindDrawerOpen) return false;
      if (xmindDrawerOpen && xmindApi && typeof xmindApi.close === 'function') {
        xmindApi.close();
        return true;
      }
      return false;
    }

    function switchTab(name, options) {
      if (name === 'xmind-casegen' || name === 'auto' || name === 'clean') {
        name = 'casesgen';
      }
      closeXmindContextBeforeLeave(name);
      var mappedToOtherPage = false;
      if (name) {
        var mappedPage = resolveTabPage(name);
        var currentPage = getCurrentPageName();
        // 仅依赖 data-tab-section 会被“同名抽屉”误判；优先按页面映射判断是否应跨页跳转。
        mappedToOtherPage = Boolean(mappedPage && currentPage && mappedPage !== currentPage);
      }
      if (name && (shouldForceRedirect() || mappedToOtherPage || !hasLocalTabSection(name))) {
        var redirected = redirectToTabPage(name);
        if (redirected) return;
      }
      var now = Date.now();
      var skipHooks = false;
      if (state.activeTab === name) {
        var lastName = state._lastTabSwitchName || '';
        var lastAt = Number(state._lastTabSwitchAt || 0);
        if (lastName === name && now - lastAt < 200) {
          skipHooks = true;
        }
      }
      state._lastTabSwitchName = name;
      state._lastTabSwitchAt = now;
      // 重复切到当前页签时不必关闭抽屉：避免误关，并避免影响“刷新后恢复抽屉打开态”的体验。
      if (state.activeTab !== name && window.app && window.app.drawer && typeof window.app.drawer.closeAllDrawers === 'function') {
        window.app.drawer.closeAllDrawers();
      }
      state.activeTab = name;
      // Only persist within the current tab session:
      // - refresh should restore the current tab
      // - re-login should go back to default (login flow clears sessionStorage)
      persistActiveTabForSession(name);
      dom.tabButtons.forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset && btn.dataset.tabBtn === name);
      });
      dom.tabSections.forEach(function(sec) {
        const match = sec.dataset && sec.dataset.tabSection === name;
        sec.classList.toggle('hidden', !match);
      });
      if (dom.tempexecFlowNav) {
        dom.tempexecFlowNav.classList.toggle('hidden', name !== 'tempexec');
      }
      if (name === 'models') clearStatusById('modelFormStatus');
      if (name === 'assign') {
        if (!skipHooks) {
          renderAssignmentsSelect();
          [
            'xmindCaseGenAssignStatus',
            'caseFilterAssignStatus',
            'missingReminderAssignStatus',
            'caseLibraryGenAssignStatus',
          ]
            .forEach(clearStatusById);
          focusAssignSaveIfNeeded();
        }
      }
      if (name === 'settings') {
        if (!skipHooks) {
          renderSettingsUI();
        }
      }
      // 进入“用例执行”页签时：递增一次“用例库同步触发序号”，并尽量触发一次执行页数据刷新。
      // 这样即便业务模块尚未绑定 app-tab-activated 监听，也能在切页时完成一次同步检查（仅 DB 模式会产生实际同步）。
      if (name === 'tempexec') {
        if (!skipHooks) {
          try {
            window.app = window.app || {};
            var prev = Number(window.app.__tempexecCaseLibrarySyncSeq || 0);
            if (!Number.isFinite(prev) || prev < 0) prev = 0;
            window.app.__tempexecCaseLibrarySyncSeq = prev + 1;
            window.app.__tempexecCaseLibrarySyncReason = 'tab-enter';
          } catch (err) {
            // ignore
          }
          try {
            if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
              setTimeout(function() {
                try {
                  window.app.tempExecApi.loadTempExecState();
                } catch (err2) {
                  // ignore
                }
              }, 0);
            }
          } catch (err3) {
            // ignore
          }
        }
      }
      markActiveTabGroup(name);
      var grp = getGroupNameForTab(name);
      showTabGroup(grp, { keepTabActive: true, expand: false });
      // 给各业务模块一个统一的“页签激活”钩子：用于刷新后恢复页签时也能自动拉取数据。
      if (!skipHooks) {
        try {
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent('app-tab-activated', { detail: { tab: name } }));
          }
        } catch (err) {
          // ignore
        }
      }
      try {
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          var pageSize = state && Number.isFinite(Number(state.tempExecPageSize)) ? Number(state.tempExecPageSize) : null;
          if (pageSize !== null) {
            try {
              window.dispatchEvent(new CustomEvent('app-page-size-changed', { detail: { size: pageSize } }));
            } catch (err2) {
              if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
                var evt = document.createEvent('CustomEvent');
                evt.initCustomEvent('app-page-size-changed', false, false, { size: pageSize });
                window.dispatchEvent(evt);
              }
            }
          }
        }
      } catch (err3) {
        // ignore
      }
      if (!options || !options.skipHistory) {
        syncHistoryForTab(name, options);
      }
    }
    api.switchTab = switchTab;
    // 兜底：页面刷新/关闭前再写一次 activeTab，避免少数情况下首次切页后未落到 sessionStorage 的问题。
    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        function shouldSkipGlobalUnloadPersist() {
          try {
            var xmindApi = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
            if (!xmindApi || typeof xmindApi.isOpen !== 'function') return false;
            if (xmindApi.isOpen() !== true) return false;
            return getActiveTabFromDom() === 'casesgen';
          } catch (err) {
            return false;
          }
        }
        window.addEventListener('beforeunload', function() {
          if (!shouldSkipGlobalUnloadPersist()) {
            persistWorkflowStateNow();
          }
          var tab = getActiveTabFromDom();
          persistActiveTabForSession(tab);
          // 标记“刷新来源页签”，用于执行页做“仅在执行页刷新才触发自动同步/diff”的判定。
          // 注意：来源标记会同时在“离开页面”时写入，但执行页侧会结合 navigation.type=reload 做最终判断，避免误触发。
          try {
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem('tap-reload-source-tab', tab || '');
            }
          } catch (err) {
            // ignore
          }
        });
        window.addEventListener('visibilitychange', function() {
          if (document && document.visibilityState === 'hidden') {
            if (!shouldSkipGlobalUnloadPersist()) {
              persistWorkflowStateNow();
            }
            persistActiveTabForSession(getActiveTabFromDom());
          }
        });
        window.addEventListener('popstate', function() {
          var tab = getTabFromUrl();
          if (tab) switchTab(tab, { skipHistory: true });
        });
      }
    } catch (err) {
      // ignore
    }
    document.addEventListener('click', function(e) {
      if (blockSidebarIfDrawerOpen(e)) return;
      const tabBtn = e && e.target && e.target.closest ? e.target.closest('[data-tab-btn]') : null;
      if (tabBtn && tabBtn.dataset && tabBtn.dataset.tabBtn) {
        switchTab(tabBtn.dataset.tabBtn);
      }
    });
    function clearStatusById(id) {
      const el = document.getElementById(id);
      if (el) setStatus(el, '', '');
    }

    const core = {};
    assignIfPresent(core, {
      state: state,
      config: window.app.config,
      utils: appUtils,
      setStatus: setStatus,
      switchTab: switchTab,
      scrollToSection: scrollToSection,
      hasCaseSource: hasCaseSource,
      getCombinedCaseList: getCombinedCaseList,
      getCombinedCaseText: getCombinedCaseText,
      deriveCaseListFromText: deriveCaseListFromText,
      parseCaseList: parseCaseList,
      renderCaseTable: renderCaseTable,
      formatCompactTimestamp: formatCompactTimestamp,
      escapeHtml: escapeHtml,
      escapeHtmlPreserve: escapeHtmlPreserve,
      callModelWithConfig: callModelWithConfig,
      getAssignedModel: getAssignedModel,
      updateModelTiming: updateModelTiming,
      downloadBlob: downloadBlob,
      parseXmindFile: parseXmindFile,
      scrollElementIntoView: scrollElementIntoView,
      updateAssignmentStatuses: updateAssignmentStatuses,
      updateReasoningVisibility: updateReasoningVisibility,
      testModel: testModel,
      renderCaseGeneration: renderCaseGeneration,
      renderCaseGenProgressBoard: renderCaseGenProgressBoard,
      persistWorkflowState: persistWorkflowState,
      persistWorkflowStateNow: persistWorkflowStateNow,
    }, Object.keys({
      state: 1, config: 1, utils: 1, setStatus: 1, switchTab: 1, scrollToSection: 1, hasCaseSource: 1, getCombinedCaseList: 1,
      getCombinedCaseText: 1, deriveCaseListFromText: 1, parseCaseList: 1, renderCaseTable: 1, formatCompactTimestamp: 1, escapeHtml: 1,
      escapeHtmlPreserve: 1, callModelWithConfig: 1, getAssignedModel: 1, updateModelTiming: 1,
      downloadBlob: 1, parseXmindFile: 1, scrollElementIntoView: 1, updateAssignmentStatuses: 1, updateReasoningVisibility: 1, testModel: 1,
      renderCaseGeneration: 1, renderCaseGenProgressBoard: 1, persistWorkflowState: 1, persistWorkflowStateNow: 1,
    }));
    window.app.core = core;

    const casesGenApi = {};
    assignIfPresent(casesGenApi, {
      ensureCaseGenSettings: api.ensureCaseGenSettings || function() { return {}; },
      setCaseGenSettingValue: api.setCaseGenSettingValue || function() {},
      setCaseGenViewTab: api.setCaseGenViewTab || function() {},
      getCaseGenPromptComponents: api.getCaseGenPromptComponents || function() { return []; },
      commitModuleCases: api.commitModuleCases || function() { return null; },
      snapshotModuleCases: api.snapshotModuleCases || function() { return null; },
      rollbackModuleCases: api.rollbackModuleCases || function() { return false; },
      snapshotAllCaseGenState: api.snapshotAllCaseGenState || function() { return null; },
      rollbackAllCaseGenState: api.rollbackAllCaseGenState || function() { return false; },
      getLatestCaseGenOperationSnapshot: api.getLatestCaseGenOperationSnapshot || function() { return null; },
      discardCaseGenOperationSnapshot: api.discardCaseGenOperationSnapshot || function() { return false; },
      rollbackCaseGenOperationSnapshot: api.rollbackCaseGenOperationSnapshot || function() { return false; },
      syncLegacyCaseGenState: api.syncLegacyCaseGenState || function() { return null; },
      restoreLegacyCaseGenState: api.restoreLegacyCaseGenState || function() { return false; },
      openCaseGenDbStoreNewDrawerWithItems: api.openCaseGenDbStoreNewDrawerWithItems || function() {},
      openCaseGenDbStoreAppendDrawerWithItems: api.openCaseGenDbStoreAppendDrawerWithItems || function() {},
      renderCaseGeneration: renderCaseGeneration,
    }, Object.keys({
      ensureCaseGenSettings: 1, setCaseGenSettingValue: 1, setCaseGenViewTab: 1, getCaseGenPromptComponents: 1,
      commitModuleCases: 1, snapshotModuleCases: 1, rollbackModuleCases: 1,
      snapshotAllCaseGenState: 1, rollbackAllCaseGenState: 1,
      getLatestCaseGenOperationSnapshot: 1, discardCaseGenOperationSnapshot: 1, rollbackCaseGenOperationSnapshot: 1,
      syncLegacyCaseGenState: 1, restoreLegacyCaseGenState: 1,
      openCaseGenDbStoreNewDrawerWithItems: 1, openCaseGenDbStoreAppendDrawerWithItems: 1,
      renderCaseGeneration: 1,
    }));
    if (!casesGenApi.renderCaseGeneration && typeof api.renderCaseGeneration === 'function') {
      casesGenApi.renderCaseGeneration = api.renderCaseGeneration;
    }
    window.app.casesGenApi = casesGenApi;

    function clearPreloadNavFlags() {
      try {
        var root = document && document.documentElement ? document.documentElement : null;
        if (!root) return;
        if (root.dataset) {
          if (root.dataset.preloadNav !== undefined) delete root.dataset.preloadNav;
          if (root.dataset.initTab !== undefined) delete root.dataset.initTab;
        } else {
          root.removeAttribute('data-preload-nav');
          root.removeAttribute('data-init-tab');
        }
      } catch (err) {
        // ignore
      }
    }

    function markRuntimeStage(stage) {
      if (typeof window === 'undefined' || !window) return;
      window.app = window.app || {};
      window.app.__tapInitRuntimeStage = stage ? String(stage || '') : '';
      var nextHistory = Array.isArray(window.app.__tapInitRuntimeStageHistory)
        ? window.app.__tapInitRuntimeStageHistory.slice()
        : [];
      nextHistory.push(window.app.__tapInitRuntimeStage);
      if (nextHistory.length > 24) nextHistory = nextHistory.slice(nextHistory.length - 24);
      window.app.__tapInitRuntimeStageHistory = nextHistory;
      try {
        var root = document && document.documentElement ? document.documentElement : null;
        if (!root) return;
        var historyText = nextHistory.join('>');
        if (root.dataset) {
          root.dataset.tapRuntimeStage = window.app.__tapInitRuntimeStage;
          root.dataset.tapRuntimeStageHistory = historyText;
        } else {
          root.setAttribute('data-tap-runtime-stage', window.app.__tapInitRuntimeStage);
          root.setAttribute('data-tap-runtime-stage-history', historyText);
        }
      } catch (err) {
        // ignore
      }
    }

    function scheduleDeferredXmindRestore() {
      if (deferredXmindRestoreTimer) {
        clearTimeout(deferredXmindRestoreTimer);
        deferredXmindRestoreTimer = 0;
      }
      if (deferredXmindRestoreFallbackTimer) {
        clearTimeout(deferredXmindRestoreFallbackTimer);
        deferredXmindRestoreFallbackTimer = 0;
      }
      deferredXmindRestoreTimer = setTimeout(function() {
        deferredXmindRestoreTimer = 0;
        if (!xmindCasegenModule || typeof xmindCasegenModule.restoreAfterWorkflowReady !== 'function') return;
        markRuntimeStage('before-xmind-restore-after-ready');
        xmindCasegenModule.restoreAfterWorkflowReady();
        markRuntimeStage('after-xmind-restore-after-ready');
        deferredXmindRestoreFallbackTimer = setTimeout(function() {
          deferredXmindRestoreFallbackTimer = 0;
          if (!xmindCasegenModule || typeof xmindCasegenModule.isOpen !== 'function' || typeof xmindCasegenModule.open !== 'function') return;
          if (xmindCasegenModule.isOpen() === true) return;
          if (String(state.activeTab || '') !== 'casesgen') return;
          if (!state.xmindCaseGen || !state.xmindCaseGen.viewState || state.xmindCaseGen.viewState.drawerOpen !== true) return;
          try {
            xmindCasegenModule.open({ restoreOpening: true });
          } catch (err) {
            // ignore
          }
        }, 450);
      }, 0);
    }

    function initApp() {
      markRuntimeStage('initApp-enter');
      if (window.app && window.app._inited) return;
      if (!window.app) window.app = {};
      window.app._inited = true;
      window.app.__tapWorkflowReady = false;
      markRuntimeStage('inited-flag-set');
      workflowRestoring = true;
      restoreWorkflowState();
      markRuntimeStage('workflow-restored');
      ensureXmindCasegenModule();
      function resolveInitialTab() {
        var defaultTab = 'casesgen';
        try {
          var cfg = window.app && window.app.config ? window.app.config : {};
          var pageDefaults = cfg && cfg.pageDefaultTabMap ? cfg.pageDefaultTabMap : {};
          var pageKey = '';
          if (document && document.body && document.body.dataset && document.body.dataset.page) {
            pageKey = String(document.body.dataset.page || '');
          }
          if (!pageKey) pageKey = 'index';
          if (pageDefaults && pageDefaults[pageKey]) {
            defaultTab = String(pageDefaults[pageKey] || defaultTab);
          }
        } catch (err) {
          defaultTab = 'casesgen';
        }
        var urlTab = getTabFromUrl();
        if (urlTab) return urlTab;
        var saved = '';
        if (activeTabKey && typeof sessionStorage !== 'undefined') {
          try {
            saved = sessionStorage.getItem(activeTabKey) || '';
          } catch (err) {
            saved = '';
          }
        }
        // 仅在同一次登录会话内恢复页签（避免登出/重新登录回到旧页签）。
        try {
          if (saved && typeof sessionStorage !== 'undefined') {
            var tabSeq = sessionStorage.getItem('tap-active-tab-login-seq') || '';
            var loginSeq = '';
            if (typeof localStorage !== 'undefined') loginSeq = localStorage.getItem('tap-login-seq') || '';
            if (loginSeq && !tabSeq) {
              // 补写一次，避免首次切页后刷新不生效需要第二次。
              sessionStorage.setItem('tap-active-tab-login-seq', loginSeq);
              tabSeq = loginSeq;
            }
            if (loginSeq && tabSeq && tabSeq !== loginSeq) {
              saved = '';
            }
          }
        } catch (err) {
          // ignore
        }
        var tabs = [];
        if (dom.tabSections && dom.tabSections.length) {
          dom.tabSections.forEach(function(sec) {
            if (sec && sec.dataset && sec.dataset.tabSection) {
              tabs.push(sec.dataset.tabSection);
            }
          });
        } else if (dom.tabButtons && dom.tabButtons.length) {
          dom.tabButtons.forEach(function(btn) {
            if (btn && btn.dataset && btn.dataset.tabBtn) {
              tabs.push(btn.dataset.tabBtn);
            }
          });
        }
        var isValidSaved = saved && tabs.indexOf(saved) !== -1;
        if (isValidSaved) return saved;
        var hasDefault = tabs.indexOf(defaultTab) !== -1;
        if (hasDefault) return defaultTab;
        return tabs.length ? tabs[0] : defaultTab;
      }
      loadModels();
      loadAssignments();
      renderModels();
      renderAssignmentsSelect();
      renderSettingsUI();
      resetModelForm();
      var initialTab = resolveInitialTab();
      switchTab(initialTab, { replaceHistory: true });
      clearPreloadNavFlags();
      const layoutHandlersModule = window.app.layoutHandlers && typeof window.app.layoutHandlers.init === 'function'
        ? window.app.layoutHandlers.init({
          state: state,
          scrollToSection: scrollToSection,
          switchTab: switchTab,
          handlers: {
            toggleImportedCaseView: toggleImportedCaseView,
            scrollElementIntoView: scrollElementIntoView,
          },
          dom: dom,
      })
      : null;
    const casegenProgressModule = window.app.casegenProgress && typeof window.app.casegenProgress.init === 'function'
      ? window.app.casegenProgress.init({
        state: state,
        dom: dom,
        utils: appUtils,
        escapeHtml: escapeHtml,
        persistWorkflowState: persistWorkflowState,
        persistSettings: persistSettings,
      })
      : null;
    assignIfPresent(api, casegenProgressModule, [
      'renderCaseGenProgressBoard',
      'setCaseModuleRunning',
      'isCaseModuleRunning',
      'renderCaseModuleProgress',
      'updateCaseProgressView',
      'clearCaseProgress',
      'initCaseProgress',
      'setCaseProgressGroupState',
      'setCaseProgressStep',
      'markAllCaseProgressGroups',
    ]);
    if (api && typeof api.renderCaseGenProgressBoard === 'function') {
      core.renderCaseGenProgressBoard = api.renderCaseGenProgressBoard;
    }
    if (casesGenApi && api && typeof api.renderCaseGenProgressBoard === 'function') {
      casesGenApi.renderCaseGenProgressBoard = api.renderCaseGenProgressBoard;
    }
    if (api && typeof api.renderCaseGenProgressBoard === 'function') {
      api.renderCaseGenProgressBoard();
    }
      bindWorkflowPersistenceListeners();
      workflowRestoring = false;
      window.app.__tapWorkflowReady = true;
      markRuntimeStage('workflow-ready');
      flushWorkflowRecoveryNotice();
      scheduleDeferredXmindRestore();
      return { layoutHandlersModule: layoutHandlersModule };
    }
    window.app = window.app || {};
    window.app.__tapWorkflowReady = false;
    window.app.init = initApp;

    renderCaseGenProgressBoard();

    const xmindKnowledgeBaseApi = window.app.xmindKnowledgeBase && typeof window.app.xmindKnowledgeBase.init === 'function'
      ? window.app.xmindKnowledgeBase.init({
        state: state,
        apiClient: window.app.apiClient || null,
        escapeHtml: escapeHtml,
      })
      : null;
    if (xmindKnowledgeBaseApi) {
      window.app.xmindKnowledgeBaseApi = xmindKnowledgeBaseApi;
    }

    const moduleContext = retainedGeneration && typeof retainedGeneration.buildXmindModuleContext === 'function'
      ? retainedGeneration.buildXmindModuleContext({
      state: state,
      config: window.app.config,
      utils: appUtils,
      core: core,
      tempExecApi: tempExecApi,
      casesGenApi: casesGenApi,
      getAssignedModel: getAssignedModel,
      getReasoningForType: getReasoningForType,
      getTemperatureForType: getTemperatureForType,
      saveAssignments: saveAssignments,
      renderAssignmentsSelect: renderAssignmentsSelect,
      updateAssignmentStatuses: updateAssignmentStatuses,
      deriveCaseListFromText: deriveCaseListFromText,
      parseCaseList: parseCaseList,
      getCombinedCaseList: getCombinedCaseList,
      getCombinedCaseText: getCombinedCaseText,
      hasCaseSource: hasCaseSource,
      xmindCoreApi: window.app.xmindCoreApi || null,
      xmindMarkdownExportCoreApi: window.app.xmindMarkdownExportCoreApi || null,
      mindElixirCoreApi: window.app.mindElixirCoreApi || null,
      casesCoreApi: window.app.casesCoreApi || null,
      xmindKnowledgeBaseApi: xmindKnowledgeBaseApi,
      casePageAiGenPrepApi: null,
    })
      : null;
    if (!moduleContext) {
      throw new Error('保留生成运行时未就绪');
    }
    function ensureXmindCasegenModule() {
      if (xmindCasegenModule) return xmindCasegenModule;
      if (!window.app.xmindCasegen || typeof window.app.xmindCasegen.init !== 'function') {
        return null;
      }
      xmindCasegenModule = window.app.xmindCasegen.init(moduleContext) || null;
      return xmindCasegenModule;
    }

    preclearOversizeWorkflowSnapshotBeforeModuleInit();
    preclearOversizeXmindTaskStorageBeforeModuleInit();
    if (window.app.tempexec && typeof window.app.tempexec.init === 'function') {
      window.app.tempexec.init(moduleContext);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }

    return {
      switchTab: switchTab,
      core: core,
      casesGenApi: casesGenApi,
      initApp: initApp,
    };
  }

  window.app = window.app || {};
  window.app.appRuntime = { init: init };
})();
