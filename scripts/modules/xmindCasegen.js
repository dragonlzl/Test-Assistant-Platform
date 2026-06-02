(function() {
  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var config = ctx.config || (window.app && window.app.config) || {};
    var utils = ctx.utils || {};
    var core = ctx.core || {};
    var casesGenApi = ctx.casesGenApi || {};
    var prepApi = ctx.prepApi || {};
    var xmindGenApi = ctx.xmindGenApi || {};
    var xmindKnowledgeBaseApi = ctx.xmindKnowledgeBaseApi || {};

    var debounce = utils.debounce || function(fn) { return fn; };
    var showCenterToast = typeof utils.showCenterToast === 'function'
      ? utils.showCenterToast
      : function() {};
    var escapeHtml = core.escapeHtml || function(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    var setStatus = core.setStatus || function() {};
    var persistWorkflowState = core.persistWorkflowState || function() {};
    var persistWorkflowStateNow = core.persistWorkflowStateNow || persistWorkflowState;
    var renderCaseGenProgressBoard = core.renderCaseGenProgressBoard || function() {};
    var switchTab = core.switchTab || function() {};
    var runConcurrentTasks = typeof utils.runConcurrent === 'function'
      ? utils.runConcurrent
      : function(items, concurrency, worker) {
        var list = Array.isArray(items) ? items.slice() : [];
        var limit = Math.max(1, Number(concurrency) || 1);
        var runner = typeof worker === 'function'
          ? worker
          : function(item) { return Promise.resolve(item); };
        var cursor = 0;
        var results = new Array(list.length);
        function consume() {
          if (cursor >= list.length) return Promise.resolve();
          var current = cursor;
          cursor += 1;
          return Promise.resolve(runner(list[current], current))
            .then(function(ret) {
              results[current] = ret;
            })
            .then(consume);
        }
        var workers = [];
        var count = Math.min(limit, list.length || 1);
        for (var i = 0; i < count; i += 1) {
          workers.push(consume());
        }
        return Promise.all(workers).then(function() { return results; });
      };
    var defaultPrompts = window.app && window.app.config && window.app.config.defaultPrompts
      ? window.app.config.defaultPrompts
      : {};

    var openBtn = document.getElementById('xmindCaseGenOpenBtn');
    var drawerEl = document.getElementById('xmindCaseGenDrawer');
    var drawerTitleEl = document.getElementById('xmindCaseGenDrawerTitle');
    var workspaceLayerEl = document.getElementById('xmindCaseGenWorkspaceLayer');
    var workspaceListEl = document.getElementById('xmindCaseGenWorkspaceList');
    var workspaceAddBtn = document.getElementById('xmindCaseGenWorkspaceAddBtn');
    var toolbarEl = document.getElementById('xmindCaseGenToolbar');
    var summaryBtn = document.getElementById('xmindCaseGenSummaryBtn');
    var historyBtn = document.getElementById('xmindCaseGenHistoryBtn');
    var knowledgeRuleBtn = document.getElementById('xmindCaseGenKnowledgeRuleBtn');
    var knowledgeAiBtn = document.getElementById('xmindCaseGenKnowledgeAiBtn');
    var dedupeBtn = document.getElementById('xmindCaseGenDedupeBtn');
    var coverageBtn = document.getElementById('xmindCaseGenCoverageBtn');
    var storeBtn = document.getElementById('xmindCaseGenStoreBtn');
    var interruptBtn = document.getElementById('xmindCaseGenInterruptBtn');
    var deleteUndoBtn = document.getElementById('xmindCaseGenDeleteUndoBtn');
    var deleteRedoBtn = document.getElementById('xmindCaseGenDeleteRedoBtn');
    var summaryOverlayEl = document.getElementById('xmindCaseGenSummaryOverlay');
    var summaryDialogEl = document.getElementById('xmindCaseGenSummaryDialog');
    var summaryDialogTitleEl = document.getElementById('xmindCaseGenSummaryDialogTitle');
    var summaryDialogDescEl = document.getElementById('xmindCaseGenSummaryDialogDesc');
    var summaryDialogBodyEl = document.getElementById('xmindCaseGenSummaryDialogBody');
    var summaryCloseBtn = document.getElementById('xmindCaseGenSummaryCloseBtn');
    var exportBtn = document.getElementById('xmindCaseGenExportBtn');
    var exportMarkdownBtn = document.getElementById('xmindCaseGenExportMarkdownBtn');
    var statusEl = document.getElementById('xmindCaseGenStatus');
    var mindContainer = document.getElementById('xmindCaseGenMindContainer');

    var renderTimer = 0;
    var queuedMindRender = null;
    var queuedMindRenderTimer = 0;
    var queuedMindRenderDeadlineTimer = 0;
    var listObserver = null;
    var drawerInstance = null;
    var summaryDialogOpen = false;
    var summaryDialogMode = 'prep';
    var currentMindData = null;
    var mindInstance = null;
    var coverageHighlightedCaseId = '';
    var coverageRequirementImageObjectUrls = [];
    var pendingCasesGenPageRender = false;
    var mindApiReadyPromise = null;
    var inlinePrimaryHost = null;
    var inlineOverviewHost = null;
    var inlineControlsHost = null;
    var inlineStatusHost = null;
    var inlineModelHost = null;
    var toolbarCollapseBtn = null;
    var inlineGroupHosts = {};
    var manualImageInputEl = null;
    var topupHighlightSyncTimer = 0;
    var topupHighlightRetryTimer = 0;
    var topupHighlightRetryCount = 0;
    var topupHighlightMutationObserver = null;
    var topupHighlightResizeObserver = null;
    var topupHighlightViewerEl = null;
    var topupHighlightMapEl = null;
    var topupHighlightCanvasEl = null;
    var topupHighlightScrollHandler = null;
    var topupHighlightResizeHandler = null;
    var viewStatePersistTimer = 0;
    var viewStateMutationObserver = null;
    var viewStateScrollTarget = null;
    var viewStateScrollHandler = null;
    var viewStateInteractionTarget = null;
    var viewStateClickHandler = null;
    var viewStateWheelHandler = null;
    var viewStatePointerDownHandler = null;
    var viewStatePointerUpHandler = null;
    var viewStatePointerCancelHandler = null;
    var viewStateManualGestureActive = false;
    var viewStateManualGestureRecentUntil = 0;
    var viewStateManualGestureDetected = false;
    var viewStateLastObservedTransform = '';
    var viewStateBeforeUnloadBound = false;
    var drawerCloseIntentBound = false;
    var workspaceViewRestoreToken = 0;
    var rootCenterRequestToken = 0;
    var drawerRestoreRetryTimer = 0;
    var drawerOpenRenderTimer = 0;
    var deferredDrawerCloseCleanupTimer = 0;
    var drawerManualCloseSuppressUntil = 0;
    var drawerRestoreRetryCount = 0;
    var drawerRestoreStableCount = 0;
    var recoveredStatePersistTimer = 0;
    var pendingOpenCenterRoot = false;
    var pendingOpenInstant = false;
    var pendingOpenSkipRestorableViewState = false;
    var pendingOpenForceSnapshotHydrate = false;
    var pendingDrawerOpenWorkspaceId = '';
    var drawerOpenedViaDomRestore = false;
    var knowledgeBasePipelinePromiseMap = {};
    var knowledgeBaseActionResultMap = {};
    var restoreDrawerOpenInFlight = false;
    var drawerLegacyRestoreSnapshot = null;
    var pageSuspending = false;
    var pageSuspendPersistAt = 0;
    var pendingManualDedupeConfirm = false;
    var storeValidationClearTimer = 0;
    var xmindTaskListenerBound = false;
    var xmindTaskProcessingMap = {};
    var rootPipelinePumpMap = {};
    var pendingManagedTaskReconcileTimer = 0;
    var dedupeTerminalVisualTimer = 0;
    var workspaceContextQueue = Promise.resolve();
    var workspaceShadowDepth = 0;
    var workspaceUiMutedDepth = 0;
    var shadowWorkspaceSharedState = null;
    var storeValidationState = {
      moduleKeys: {},
      caseKeys: {},
    };

    var STEP_REQUIREMENT = 1;
    var STEP_CASES = 2;
    var STEP_OPTIONS = 3;
    var HISTORY_LIMIT = 80;
    var DRAWER_RESTORE_RETRY_LIMIT = 18;
    var SUSPEND_VIEW_STATE_CACHE_KEY = 'tap-xmind-casegen-suspend-view-v1';
    var MIND_RENDER_QUEUE_DEBOUNCE_MS = 120;
    var MIND_RENDER_QUEUE_MAX_WAIT_MS = 500;
    var VIEW_STATE_CAPTURE_DEBOUNCE_MS = 300;
    var WORKSPACE_MAX = 2;
    var multimodalMaxImages = 20;
    var multimodalMaxEdge = 1600;
    var multimodalMaxBytes = 4 * 1024 * 1024;
    var WORKSPACE_HOST_KEYS = {
      activeWorkspaceId: 1,
      mirrorWorkspaceId: 1,
      workspaceOrder: 1,
      workspaces: 1,
      nextWorkspaceSeq: 1,
      openButtonDotVisible: 1,
    };
    var SHARED_WORKSPACE_CASEGEN_SETTING_KEYS = [
      'activeTab',
      'customRequirement',
      'dedupeSimplify',
      'needFunctionCondition',
      'needNumericValidation',
      'needBoundary',
      'needMobile',
      'needSpecial',
      'specialRepeatOperation',
      'specialMultiTouch',
      'specialRepeatExecution',
      'specialWeakNetwork',
      'specialInterruptResume',
    ];

    function getWorkspaceLimitText() {
      return '最多仅支持 ' + String(WORKSPACE_MAX) + ' 个生成页签';
    }

    var ROOT_ACTIONS = {
      FULL_CASES: 'root-full-cases',
      FULL_MODULES: 'root-full-modules',
      REGENERATE_MODULES: 'root-regenerate-modules',
      EXISTING_CASES: 'root-existing-cases',
      TOPUP_MODULES: 'root-topup-modules',
      TOPUP_MODULES_CASES: 'root-topup-modules-cases',
      APPEND_ALL: 'root-append-all',
      ROLLBACK: 'root-rollback',
    };
    var MODULE_ACTIONS = {
      FULL_CASES: 'module-full-cases',
      APPEND: 'module-append',
      ROLLBACK: 'module-rollback',
    };
    var COMMON_ACTIONS = {
      DELETE: 'xmind-delete-selection',
    };
    var DEDUPE_ACTION_ID = 'xmind-ai-dedupe';
    var COVERAGE_ACTION_ID = 'xmind-requirement-coverage';
    var DEDUPE_STRENGTH = 'conservative';
    var DEDUPE_MODE_ONLY = 'dedupe_only';
    var DEDUPE_MODE_SIMPLIFY = 'dedupe_simplify';
    var DEDUPE_MIN_VISIBLE_MS = 260;
    var DEDUPE_TERMINAL_GRACE_MS = 1200;
    var DEDUPE_TERMINAL_VISUAL_MS = 3200;

    function createDefaultPrepState() {
      return {
        step: STEP_REQUIREMENT,
        requirementMode: '',
        requirementSupplement: '',
        manualRequirementLabel: '',
        manualRequirementBlocks: [],
        caseImportMode: '',
        baseLocked: false,
        completed: false,
      };
    }

    function createDefaultRootState() {
      return {
        lastAction: '',
        running: false,
        taskId: '',
        hideAiLayer: false,
        snapshotId: '',
        status: '',
        error: '',
        updatedAt: 0,
        pipeline: null,
      };
    }

    function createDefaultDedupeState() {
      return {
        running: false,
        taskId: '',
        status: '',
        error: '',
        dedupeMode: DEDUPE_MODE_ONLY,
        lastResult: null,
        updatedAt: 0,
      };
    }

    function createDefaultCoverageState() {
      return {
        running: false,
        taskId: '',
        status: '',
        error: '',
        result: null,
        signature: '',
        selectedSegmentId: '',
        updatedAt: 0,
      };
    }

    function normalizeCoverageState(value) {
      var source = value && typeof value === 'object' ? value : {};
      var next = createDefaultCoverageState();
      next.running = source.running === true;
      next.taskId = source.taskId ? String(source.taskId || '') : '';
      next.status = source.status ? String(source.status || '') : '';
      next.error = source.error ? String(source.error || '') : '';
      next.result = source.result && typeof source.result === 'object'
        ? cloneJson(source.result, null)
        : null;
      next.signature = source.signature ? String(source.signature || '') : '';
      if (!next.signature && next.result && next.result.signature) {
        next.signature = String(next.result.signature || '');
      }
      next.selectedSegmentId = source.selectedSegmentId ? String(source.selectedSegmentId || '') : '';
      if (!next.selectedSegmentId && next.result && next.result.selectedSegmentId) {
        next.selectedSegmentId = String(next.result.selectedSegmentId || '');
      }
      next.updatedAt = Number(source.updatedAt || 0) || 0;
      return next;
    }

    function createDefaultViewState() {
      return {
        drawerOpen: false,
        fullscreen: false,
        transform: '',
        scaleVal: 1,
        scrollLeft: 0,
        scrollTop: 0,
        hasManualViewport: false,
        anchorState: null,
        toolbarCollapsed: false,
        collapsedNodeKeys: [],
        treeSourceSignature: '',
        updatedAt: 0,
      };
    }

    function normalizeStoredViewState(source, options) {
      var input = source && typeof source === 'object' ? source : {};
      var opts = options || {};
      var next = createDefaultViewState();
      next.drawerOpen = opts.drawerOpen === true || input.drawerOpen === true;
      next.fullscreen = opts.fullscreen === true || input.fullscreen === true;
      next.transform = String(input.transform || '');
      next.scaleVal = Number(input.scaleVal || 1);
      if (!isFinite(next.scaleVal) || next.scaleVal <= 0) next.scaleVal = 1;
      next.scrollLeft = Number(input.scrollLeft || 0);
      if (!isFinite(next.scrollLeft) || next.scrollLeft < 0) next.scrollLeft = 0;
      next.scrollTop = Number(input.scrollTop || 0);
      if (!isFinite(next.scrollTop) || next.scrollTop < 0) next.scrollTop = 0;
      next.hasManualViewport = input.hasManualViewport === true && Boolean(next.transform);
      next.anchorState = input.anchorState && input.anchorState.nodeId
        ? {
          nodeId: String(input.anchorState.nodeId || ''),
          centerX: Number(input.anchorState.centerX || 0),
          centerY: Number(input.anchorState.centerY || 0),
        }
        : null;
      next.toolbarCollapsed = input.toolbarCollapsed === true;
      next.collapsedNodeKeys = normalizeUniqueStringList(input.collapsedNodeKeys);
      next.treeSourceSignature = String(input.treeSourceSignature || '');
      next.updatedAt = Number(input.updatedAt || 0);
      if (!isFinite(next.updatedAt) || next.updatedAt < 0) next.updatedAt = 0;
      return next;
    }

    function shouldPreferIncomingViewState(baseViewState, incomingViewState) {
      var base = normalizeStoredViewState(baseViewState);
      var incoming = normalizeStoredViewState(incomingViewState);
      if (!incoming.transform && incoming.updatedAt <= 0) return false;
      if (!base.transform && incoming.transform) return true;
      if (base.hasManualViewport !== true && incoming.hasManualViewport === true) return true;
      if (incoming.updatedAt > base.updatedAt) return true;
      if (incoming.updatedAt === base.updatedAt && incoming.transform && incoming.transform !== base.transform) {
        return true;
      }
      return false;
    }

    function mergeStoredViewState(baseViewState, incomingViewState) {
      var base = normalizeStoredViewState(baseViewState);
      var incoming = normalizeStoredViewState(incomingViewState);
      var preferIncoming = shouldPreferIncomingViewState(base, incoming);
      var merged = preferIncoming
        ? cloneJson(incoming, createDefaultViewState())
        : cloneJson(base, createDefaultViewState());
      var baseUpdatedAt = Number(base.updatedAt || 0);
      var incomingUpdatedAt = Number(incoming.updatedAt || 0);
      if (incomingUpdatedAt > baseUpdatedAt) {
        merged.drawerOpen = incoming.drawerOpen === true;
        merged.fullscreen = incoming.fullscreen === true;
      } else if (baseUpdatedAt > incomingUpdatedAt) {
        merged.drawerOpen = base.drawerOpen === true;
        merged.fullscreen = base.fullscreen === true;
      } else {
        merged.drawerOpen = preferIncoming ? incoming.drawerOpen === true : base.drawerOpen === true;
        merged.fullscreen = preferIncoming ? incoming.fullscreen === true : base.fullscreen === true;
      }
      if (!merged.transform && incoming.transform) {
        merged = cloneJson(incoming, createDefaultViewState());
        if (incomingUpdatedAt > baseUpdatedAt) {
          merged.drawerOpen = incoming.drawerOpen === true;
          merged.fullscreen = incoming.fullscreen === true;
        } else if (baseUpdatedAt > incomingUpdatedAt) {
          merged.drawerOpen = base.drawerOpen === true;
          merged.fullscreen = base.fullscreen === true;
        } else {
          merged.drawerOpen = incoming.drawerOpen === true;
          merged.fullscreen = incoming.fullscreen === true;
        }
      }
      merged.updatedAt = Math.max(baseUpdatedAt, incomingUpdatedAt, Number(merged.updatedAt || 0) || 0);
      return normalizeStoredViewState(merged);
    }

    function shouldRestoreViewportForViewState(viewState) {
      var normalized = normalizeStoredViewState(viewState);
      return normalized.hasManualViewport === true && Boolean(normalized.transform);
    }

    function isMindCanvasInteractionTarget(target) {
      if (!target || !target.closest) return false;
      return Boolean(target.closest('[data-mind-canvas]') || target.closest('.map-canvas'));
    }

    function beginManualViewportGestureTracking(event) {
      var target = event && event.target ? event.target : null;
      var button = event && typeof event.button === 'number' ? event.button : 0;
      if (!isMindCanvasInteractionTarget(target)) return false;
      if (button !== 0 && button !== 1 && button !== 2) return false;
      viewStateManualGestureActive = true;
      viewStateManualGestureRecentUntil = Date.now() + 220;
      return true;
    }

    function finishManualViewportGestureTracking() {
      if (!viewStateManualGestureActive) return false;
      viewStateManualGestureActive = false;
      viewStateManualGestureRecentUntil = Date.now() + 220;
      return true;
    }

    function cancelManualViewportGestureTracking() {
      viewStateManualGestureActive = false;
      viewStateManualGestureRecentUntil = 0;
      return true;
    }

    function hasPendingManualViewportGesture() {
      return viewStateManualGestureActive === true || Date.now() <= Number(viewStateManualGestureRecentUntil || 0);
    }

    function resolveCapturedManualViewportFlag(transformText, sourceViewState) {
      var transform = String(transformText || '');
      var existingViewState = sourceViewState && typeof sourceViewState === 'object'
        ? sourceViewState
        : getViewState();
      var normalized = normalizeStoredViewState(existingViewState);
      var mindMarked = Boolean(mindInstance && mindInstance.__tapViewportInteracted === true);
      var detectedByGesture = viewStateManualGestureDetected === true;
      return Boolean(transform && (normalized.hasManualViewport === true || mindMarked || detectedByGesture));
    }

    function cloneJson(value, fallback) {
      if (value === undefined || value === null) return fallback;
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (err) {
        return fallback;
      }
    }

    function readSuspendViewStateCache() {
      if (typeof sessionStorage === 'undefined') return null;
      try {
        var raw = sessionStorage.getItem(SUSPEND_VIEW_STATE_CACHE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (err) {
        return null;
      }
    }

    function writeSuspendViewStateCache(payload) {
      if (typeof sessionStorage === 'undefined') return false;
      try {
        sessionStorage.setItem(SUSPEND_VIEW_STATE_CACHE_KEY, JSON.stringify(payload || {}));
        return true;
      } catch (err) {
        return false;
      }
    }

    function clearSuspendViewStateCache() {
      if (typeof sessionStorage === 'undefined') return false;
      try {
        sessionStorage.removeItem(SUSPEND_VIEW_STATE_CACHE_KEY);
        return true;
      } catch (err) {
        return false;
      }
    }

    function cloneSelectionMap(source) {
      var result = {};
      var map = source && typeof source === 'object' ? source : {};
      Object.keys(map).forEach(function(key) {
        var list = [];
        var current = map[key];
        if (current && typeof current.forEach === 'function') {
          current.forEach(function(value) {
            var num = Number(value);
            if (Number.isFinite(num)) list.push(num);
          });
        } else if (Array.isArray(current)) {
          current.forEach(function(value) {
            var num = Number(value);
            if (Number.isFinite(num)) list.push(num);
          });
        }
        result[key] = list;
      });
      return result;
    }

    function createEmptyRequirementMedia() {
      return {
        docxImages: [],
        pastedImages: [],
        lastDocxImageCount: 0,
        updatedAt: Date.now(),
      };
    }

    function createDefaultCaseGenSettings() {
      return {
        activeTab: 'settings',
        customRequirement: '',
        dedupeSimplify: false,
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

    function createEmptyWorkspaceSharedState() {
      return {
        requirementLabel: '',
        requirementLabelSource: '',
        lastRawImportName: '',
        rawText: '',
        caseText: '',
        importedCases: [],
        caseGenModules: [],
        caseGenSource: '',
        caseGenResults: {},
        caseSelections: {},
        caseGenSuggestions: {},
        caseGenModuleStatus: {},
        caseGenProgress: {},
        caseGenTiming: {},
        caseGenProgressNotice: {},
        caseGenSettings: createDefaultCaseGenSettings(),
        requirementMedia: createEmptyRequirementMedia(),
      };
    }

    function cloneCaseGenSettingsValue(value) {
      var next = createDefaultCaseGenSettings();
      var source = value && typeof value === 'object' ? value : {};
      SHARED_WORKSPACE_CASEGEN_SETTING_KEYS.forEach(function(key) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) return;
        next[key] = cloneJson(source[key], source[key]);
      });
      next.activeTab = next.activeTab === 'settings' ? 'settings' : 'settings';
      next.customRequirement = String(next.customRequirement || '');
      next.dedupeSimplify = next.dedupeSimplify === true;
      next.needFunctionCondition = next.needFunctionCondition !== false;
      next.needNumericValidation = next.needNumericValidation !== false;
      next.needBoundary = next.needBoundary === true;
      next.needMobile = next.needMobile === true;
      next.needSpecial = next.needSpecial === true;
      next.specialRepeatOperation = next.specialRepeatOperation === true;
      next.specialMultiTouch = next.specialMultiTouch === true;
      next.specialRepeatExecution = next.specialRepeatExecution === true;
      next.specialWeakNetwork = next.specialWeakNetwork === true;
      next.specialInterruptResume = next.specialInterruptResume === true;
      return next;
    }

    function cloneRequirementMediaValue(value) {
      var source = value && typeof value === 'object' ? value : {};
      var next = createEmptyRequirementMedia();
      function cloneMediaList(list) {
        var result = [];
        (Array.isArray(list) ? list : []).forEach(function(item) {
          if (!item || typeof item !== 'object') return;
          var cloned = {};
          Object.keys(item).forEach(function(key) {
            cloned[key] = item[key];
          });
          result.push(cloned);
        });
        return result;
      }
      next.docxImages = cloneMediaList(source.docxImages);
      next.pastedImages = cloneMediaList(source.pastedImages);
      next.lastDocxImageCount = Number(source.lastDocxImageCount || 0);
      if (!Number.isFinite(next.lastDocxImageCount) || next.lastDocxImageCount < 0) {
        next.lastDocxImageCount = 0;
      }
      next.updatedAt = Number(source.updatedAt || 0) || Date.now();
      return next;
    }

    function restoreSelectionMap(snapshotMap) {
      var result = {};
      var map = snapshotMap && typeof snapshotMap === 'object' ? snapshotMap : {};
      Object.keys(map).forEach(function(key) {
        var set = new Set();
        (Array.isArray(map[key]) ? map[key] : []).forEach(function(value) {
          var num = Number(value);
          if (Number.isFinite(num)) set.add(num);
        });
        result[key] = set;
      });
      return result;
    }

    function normalizeInlineStatusType(type) {
      var text = type === null || type === undefined ? '' : String(type || '').trim();
      if (text === 'ok' || text === 'warn' || text === 'err') return text;
      return '';
    }

    function applyInlineStatus(text, type, options) {
      var opts = options || {};
      var xmindState = ensureState();
      var nextText = text === null || text === undefined ? '' : String(text || '');
      xmindState.inlineStatusText = nextText;
      xmindState.inlineStatusType = nextText ? normalizeInlineStatusType(type) : '';
      if (opts.skipDom === true) return;
      setStatus(statusEl, nextText, xmindState.inlineStatusType);
    }

    function syncInlineStatusFromState() {
      var xmindState = ensureState();
      applyInlineStatus(
        xmindState && xmindState.inlineStatusText ? String(xmindState.inlineStatusText || '') : '',
        normalizeInlineStatusType(xmindState && xmindState.inlineStatusType ? xmindState.inlineStatusType : '')
      );
    }

    function notifyInlineStatus(text, type, options) {
      applyInlineStatus(text, type, options);
    }

    function setDebugState(patch) {
      if (typeof window === 'undefined') return;
      window.app = window.app || {};
      var prev = window.app.__xmindCasegenDebug && typeof window.app.__xmindCasegenDebug === 'object'
        ? window.app.__xmindCasegenDebug
        : {};
      var next = {};
      Object.keys(prev).forEach(function(key) {
        next[key] = prev[key];
      });
      if (patch && typeof patch === 'object') {
        Object.keys(patch).forEach(function(key) {
          next[key] = patch[key];
        });
      }
      next.updatedAt = Date.now();
      window.app.__xmindCasegenDebug = next;
      try {
        var root = document && document.documentElement ? document.documentElement : null;
        if (root) {
          var phase = next.phase ? String(next.phase || '') : '';
          if (root.dataset) {
            root.dataset.tapXmindDebugPhase = phase;
          } else {
            root.setAttribute('data-tap-xmind-debug-phase', phase);
          }
        }
      } catch (err) {
        // ignore
      }
    }

    function notifySuccessToast(text, durationMs) {
      if (workspaceUiMutedDepth > 0) {
        notifyInlineStatus('', '', { skipDom: true });
        return;
      }
      if (!text) {
        notifyInlineStatus('', '');
        return;
      }
      notifyInlineStatus('', '');
      showCenterToast(String(text), 'ok', durationMs || 3000);
    }

    function notifyStatus(text, type, options) {
      var opts = options || {};
      if (workspaceUiMutedDepth > 0) {
        if ((type || '') === 'ok' && opts.forceInline !== true) {
          notifyInlineStatus('', '', { skipDom: true });
        } else {
          notifyInlineStatus(text, type || '', { skipDom: true });
        }
        return;
      }
      if ((type || '') === 'ok' && opts.forceInline !== true) {
        notifySuccessToast(text, opts.durationMs || 3000);
        return;
      }
      notifyInlineStatus(text, type || '');
    }

    function notifyFloatingStatus(text, type, durationMs) {
      if (workspaceUiMutedDepth > 0) {
        if (text) notifyInlineStatus(text, type || '', { skipDom: true });
        return;
      }
      if (!text) return;
      if (typeof showCenterToast === 'function') {
        showCenterToast(String(text), type || 'warn', durationMs || 5000);
        return;
      }
      notifyInlineStatus(text, type || '');
    }

    function createFallbackKnowledgeBaseState() {
      return {
        baseUrl: '',
        enabled: false,
        workspaceId: '',
        queryKey: '',
        latestRequestId: '',
        lastOperation: '',
        validation: {
          status: 'disabled',
          normalizedBaseUrl: '',
          checkedAt: 0,
          docCount: 0,
          entryCount: 0,
          error: '',
        },
        ruleSearch: {
          status: 'disabled',
          requestId: '',
          startedAt: 0,
          finishedAt: 0,
          durationMs: 0,
          reason: '',
          error: '',
          candidateCount: 0,
          selectedCount: 0,
        },
        aiFilter: {
          status: 'disabled',
          requestId: '',
          startedAt: 0,
          finishedAt: 0,
          durationMs: 0,
          reason: '',
          error: '',
          candidateCount: 0,
          selectedCount: 0,
        },
        catalogItems: [],
        candidates: [],
        selectedDocuments: [],
        documentSections: [],
        selectedSections: [],
        selectedItems: [],
        usedInLatestGeneration: false,
        injectedContextText: '',
        latestError: '',
        warnings: [],
        updatedAt: 0,
      };
    }

    function createDefaultKnowledgeBaseState() {
      if (xmindKnowledgeBaseApi && typeof xmindKnowledgeBaseApi.createDefaultState === 'function') {
        return xmindKnowledgeBaseApi.createDefaultState();
      }
      return createFallbackKnowledgeBaseState();
    }

    function normalizeKnowledgeBaseBaseUrl(value) {
      if (xmindKnowledgeBaseApi && typeof xmindKnowledgeBaseApi.normalizeBaseUrl === 'function') {
        return xmindKnowledgeBaseApi.normalizeBaseUrl(value);
      }
      var text = value === null || value === undefined ? '' : String(value || '').trim();
      if (!text) return '';
      text = text.replace(/[?#].*$/, '');
      if (/^https?:\/\//i.test(text) && text.charAt(text.length - 1) !== '/') {
        text += '/';
      }
      return text;
    }

    function normalizeKnowledgeBaseState(value) {
      if (xmindKnowledgeBaseApi && typeof xmindKnowledgeBaseApi.normalizeState === 'function') {
        return xmindKnowledgeBaseApi.normalizeState(value);
      }
      var source = value && typeof value === 'object' ? value : {};
      var next = createFallbackKnowledgeBaseState();
      Object.keys(next).forEach(function(key) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) return;
        next[key] = cloneJson(source[key], next[key]);
      });
      next.baseUrl = normalizeKnowledgeBaseBaseUrl(source.baseUrl || source.base_url || next.baseUrl);
      next.enabled = source.enabled === true || Boolean(next.baseUrl);
      next.workspaceId = source.workspaceId ? String(source.workspaceId || '') : '';
      next.queryKey = source.queryKey ? String(source.queryKey || '') : '';
      next.latestRequestId = source.latestRequestId ? String(source.latestRequestId || '') : '';
      next.lastOperation = source.lastOperation ? String(source.lastOperation || '') : '';
      next.usedInLatestGeneration = source.usedInLatestGeneration === true;
      next.injectedContextText = source.injectedContextText ? String(source.injectedContextText || '') : '';
      next.latestError = source.latestError ? String(source.latestError || '') : '';
      next.updatedAt = Number(source.updatedAt || 0);
      if (!Number.isFinite(next.updatedAt) || next.updatedAt < 0) next.updatedAt = 0;
      return next;
    }

    function getKnowledgeBaseStageLabel(status) {
      if (xmindKnowledgeBaseApi && typeof xmindKnowledgeBaseApi.getStageLabel === 'function') {
        return xmindKnowledgeBaseApi.getStageLabel(status);
      }
      var stable = status === null || status === undefined ? '' : String(status || '').trim();
      if (stable === 'pending') return '进行中';
      if (stable === 'done') return '已完成';
      if (stable === 'skipped') return '已跳过';
      if (stable === 'failed') return '失败';
      return '未启用';
    }

    function ensureKnowledgeBaseStateOnSnapshot(xmindSnapshot) {
      if (!xmindSnapshot || typeof xmindSnapshot !== 'object') return createDefaultKnowledgeBaseState();
      xmindSnapshot.knowledgeBase = normalizeKnowledgeBaseState(xmindSnapshot.knowledgeBase);
      return xmindSnapshot.knowledgeBase;
    }

    function ensureKnowledgeBaseStateOnRecord(record) {
      if (!record || typeof record !== 'object') return createDefaultKnowledgeBaseState();
      if (!record.snapshot || typeof record.snapshot !== 'object') {
        record.snapshot = createWorkspaceSnapshot();
      }
      if (!record.snapshot.xmind || typeof record.snapshot.xmind !== 'object') {
        record.snapshot.xmind = createInitialXmindState();
      }
      return ensureKnowledgeBaseStateOnSnapshot(record.snapshot.xmind);
    }

    function getKnowledgeBaseRequestId(stateValue) {
      var kbState = normalizeKnowledgeBaseState(stateValue);
      if (kbState.latestRequestId) return String(kbState.latestRequestId || '');
      if (kbState.aiFilter && kbState.aiFilter.requestId) return String(kbState.aiFilter.requestId || '');
      if (kbState.ruleSearch && kbState.ruleSearch.requestId) return String(kbState.ruleSearch.requestId || '');
      return '';
    }

    function shouldAcceptKnowledgeBaseState(currentState, incomingState) {
      var currentId = getKnowledgeBaseRequestId(currentState);
      var incomingId = getKnowledgeBaseRequestId(incomingState);
      if (!incomingId) return true;
      if (!currentId) return true;
      if (currentId === incomingId) return true;
      if (
        incomingState
        && incomingState.ruleSearch
        && String(incomingState.ruleSearch.status || '') === 'pending'
      ) {
        return true;
      }
      return false;
    }

    function getCurrentKnowledgeBaseBaseUrl() {
      var raw = state && state.settings && typeof state.settings.knowledgeBaseBaseUrl === 'string'
        ? state.settings.knowledgeBaseBaseUrl
        : '';
      return normalizeKnowledgeBaseBaseUrl(raw);
    }

    function getActiveKnowledgeBaseState() {
      return ensureKnowledgeBaseStateOnSnapshot(ensureState());
    }

    function getWorkspaceKnowledgeBaseState(workspaceId) {
      var stableId = String(workspaceId || getActiveWorkspaceId() || '');
      if (!stableId) return normalizeKnowledgeBaseState(createDefaultKnowledgeBaseState());
      if (stableId === String(getActiveWorkspaceId() || '')) {
        return getActiveKnowledgeBaseState();
      }
      var record = getWorkspaceRecord(stableId);
      return ensureKnowledgeBaseStateOnRecord(record);
    }

    function syncKnowledgeBaseToolbarButton(button, title, stageStatus, reasonText) {
      if (!button) return;
      var stableStatus = stageStatus ? String(stageStatus || '') : 'disabled';
      var label = getKnowledgeBaseStageLabel(stableStatus);
      button.textContent = title + '：' + label;
      button.setAttribute('data-kb-stage-status', stableStatus);
      button.title = reasonText
        ? (title + '状态：' + label + '。' + reasonText)
        : (title + '状态：' + label);
    }

    function syncKnowledgeBaseToolbarState() {
      var kbState = getActiveKnowledgeBaseState();
      var ruleStage = kbState && kbState.ruleSearch && kbState.ruleSearch.status
        ? String(kbState.ruleSearch.status || '')
        : 'disabled';
      var aiStage = kbState && kbState.aiFilter && kbState.aiFilter.status
        ? String(kbState.aiFilter.status || '')
        : 'disabled';
      syncKnowledgeBaseToolbarButton(
        knowledgeRuleBtn,
        '知识检索',
        ruleStage,
        kbState && kbState.ruleSearch ? (kbState.ruleSearch.reason || kbState.ruleSearch.error || '') : ''
      );
      syncKnowledgeBaseToolbarButton(
        knowledgeAiBtn,
        'AI筛选',
        aiStage,
        kbState && kbState.aiFilter ? (kbState.aiFilter.reason || kbState.aiFilter.error || '') : ''
      );
    }

    function setWorkspaceKnowledgeBaseState(workspaceId, nextValue, options) {
      var stableId = String(workspaceId || getActiveWorkspaceId() || '');
      if (!stableId) return false;
      var opts = options || {};
      var normalized = normalizeKnowledgeBaseState(nextValue);
      var record = getWorkspaceRecord(stableId);
      if (!record) return false;
      var currentState = ensureKnowledgeBaseStateOnRecord(record);
      if (opts.force !== true && !shouldAcceptKnowledgeBaseState(currentState, normalized)) {
        return false;
      }
      record.snapshot.xmind.knowledgeBase = normalized;
      record.updatedAt = Date.now();
      if (stableId === String(getActiveWorkspaceId() || '')) {
        ensureState().knowledgeBase = normalizeKnowledgeBaseState(normalized);
        syncKnowledgeBaseToolbarState();
        if (summaryDialogOpen === true) {
          renderOpenedSummaryDialog();
        }
      }
      if (workspaceShadowDepth <= 0 && opts.skipPersist !== true) {
        persistWorkflowState();
      }
      return true;
    }

    function renderKnowledgeBaseDialog() {
      if (!summaryDialogBodyEl) return;
      if (xmindKnowledgeBaseApi && typeof xmindKnowledgeBaseApi.renderDialogHtml === 'function') {
        summaryDialogBodyEl.innerHTML = xmindKnowledgeBaseApi.renderDialogHtml(getActiveKnowledgeBaseState());
        return;
      }
      summaryDialogBodyEl.innerHTML = '<div class="xmind-casegen-kb-empty">当前知识库结果暂不可展示，请刷新页面后重试。</div>';
    }

    function openKnowledgeBaseDialog() {
      if (!hasActiveWorkspace()) {
        notifyFloatingStatus('请先新建生成页签', 'warn', 2500);
        return;
      }
      hideOpenMindContextMenu();
      summaryDialogMode = 'knowledge-base';
      summaryDialogOpen = true;
      applySummaryDialogState();
    }

    function buildKnowledgeBaseSkipState(workspaceId, contract, reason) {
      var baseUrl = getCurrentKnowledgeBaseBaseUrl();
      var stageStatus = baseUrl ? 'skipped' : 'disabled';
      return normalizeKnowledgeBaseState({
        baseUrl: baseUrl,
        enabled: Boolean(baseUrl),
        workspaceId: String(workspaceId || ''),
        queryKey: '',
        latestRequestId: '',
        lastOperation: contract && contract.mode ? String(contract.mode || '') : '',
        validation: {
          status: baseUrl ? 'disabled' : 'disabled',
          normalizedBaseUrl: baseUrl,
        },
        ruleSearch: {
          status: stageStatus,
          reason: reason || (baseUrl ? '本轮未执行知识库检索' : '未启用知识库'),
        },
        aiFilter: {
          status: stageStatus,
          reason: reason || (baseUrl ? '本轮未执行知识库检索' : '未启用知识库'),
        },
        catalogItems: [],
        candidates: [],
        selectedDocuments: [],
        documentSections: [],
        selectedSections: [],
        selectedItems: [],
        usedInLatestGeneration: false,
        injectedContextText: '',
        latestError: '',
        warnings: [],
        updatedAt: Date.now(),
      });
    }

    function syncCasesGenPageRender(options) {
      var opts = options || {};
      if (!casesGenApi || typeof casesGenApi.renderCaseGeneration !== 'function') return false;
      if (workspaceShadowDepth > 0) {
        pendingCasesGenPageRender = true;
        return false;
      }
      if (opts.force !== true && isDrawerOpen()) {
        pendingCasesGenPageRender = true;
        return false;
      }
      pendingCasesGenPageRender = false;
      try {
        casesGenApi.renderCaseGeneration();
        return true;
      } catch (err) {
        pendingCasesGenPageRender = true;
        if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
          console.error('XMind casegen mirror render failed', err);
        }
        return false;
      }
    }

    function shouldDeferCasesGenPageRender() {
      return workspaceShadowDepth > 0;
    }

    function queueCasesGenPageRender() {
      pendingCasesGenPageRender = true;
      return true;
    }

    function flushDeferredCasesGenPageRender() {
      if (pendingCasesGenPageRender !== true) return false;
      return syncCasesGenPageRender({ force: true });
    }

    function clearStoreValidationState(skipRender) {
      var hadMarks = Object.keys(storeValidationState.moduleKeys || {}).length > 0
        || Object.keys(storeValidationState.caseKeys || {}).length > 0;
      if (storeValidationClearTimer) {
        clearTimeout(storeValidationClearTimer);
        storeValidationClearTimer = 0;
      }
      storeValidationState = {
        moduleKeys: {},
        caseKeys: {},
      };
      if (hadMarks && skipRender !== true && isDrawerOpen()) {
        render({ reason: 'store-validation-clear', persist: false });
      }
    }

    function setStoreValidationState(moduleKeys, caseKeys) {
      clearStoreValidationState(true);
      storeValidationState = {
        moduleKeys: {},
        caseKeys: {},
      };
      (Array.isArray(moduleKeys) ? moduleKeys : []).forEach(function(key) {
        var stableKey = String(key || '').trim();
        if (stableKey) storeValidationState.moduleKeys[stableKey] = true;
      });
      (Array.isArray(caseKeys) ? caseKeys : []).forEach(function(key) {
        var stableKey = String(key || '').trim();
        if (stableKey) storeValidationState.caseKeys[stableKey] = true;
      });
      if (Object.keys(storeValidationState.moduleKeys).length || Object.keys(storeValidationState.caseKeys).length) {
        if (isDrawerOpen()) render({ reason: 'store-validation-mark', persist: false });
        storeValidationClearTimer = setTimeout(function() {
          storeValidationClearTimer = 0;
          clearStoreValidationState(false);
        }, 5000);
      }
    }

    function isInvalidStoreModuleMeta(meta) {
      if (!meta || meta.type !== 'module') return false;
      return Boolean(storeValidationState.moduleKeys[String(meta.moduleKey || '')]);
    }

    function isInvalidStoreCaseMeta(meta) {
      if (!meta || meta.type !== 'case') return false;
      return Boolean(storeValidationState.caseKeys[buildDeleteTargetKey(meta)]);
    }

    function getXmindCoreApi() {
      if (ctx.xmindCoreApi) return ctx.xmindCoreApi;
      return window.app && window.app.xmindCoreApi ? window.app.xmindCoreApi : null;
    }

    function getMindElixirCoreApi() {
      if (ctx.mindElixirCoreApi) return ctx.mindElixirCoreApi;
      return window.app && window.app.mindElixirCoreApi ? window.app.mindElixirCoreApi : null;
    }

    function getXmindMarkdownExportCoreApi() {
      if (ctx.xmindMarkdownExportCoreApi) return ctx.xmindMarkdownExportCoreApi;
      return window.app && window.app.xmindMarkdownExportCoreApi ? window.app.xmindMarkdownExportCoreApi : null;
    }

    function getXmindCaseDedupeCoreApi() {
      if (ctx.xmindCaseDedupeCore) return ctx.xmindCaseDedupeCore;
      if (ctx.xmindCaseDedupeCoreApi) return ctx.xmindCaseDedupeCoreApi;
      return window.app && window.app.xmindCaseDedupeCoreApi ? window.app.xmindCaseDedupeCoreApi : null;
    }

    function getXmindRequirementCoverageCoreApi() {
      if (ctx.xmindRequirementCoverageCore) return ctx.xmindRequirementCoverageCore;
      if (ctx.xmindRequirementCoverageCoreApi) return ctx.xmindRequirementCoverageCoreApi;
      if (window.app && window.app.xmindRequirementCoverageCoreApi) return window.app.xmindRequirementCoverageCoreApi;
      if (window.app && window.app.xmindRequirementCoverageCore && typeof window.app.xmindRequirementCoverageCore.init === 'function') {
        window.app.xmindRequirementCoverageCoreApi = window.app.xmindRequirementCoverageCore.init({});
        return window.app.xmindRequirementCoverageCoreApi;
      }
      return null;
    }

    function hasMindElixirCtorReady() {
      var globalObj = null;
      if (typeof MindElixir !== 'undefined') {
        globalObj = MindElixir;
      } else if (typeof window !== 'undefined' && window && window.MindElixir) {
        globalObj = window.MindElixir;
      }
      if (typeof globalObj === 'function') return true;
      return Boolean(globalObj && typeof globalObj.default === 'function');
    }

    function isMindElixirReady(api) {
      return Boolean(api && typeof api.renderMindMap === 'function' && hasMindElixirCtorReady());
    }

    function ensureMindElixirCoreApiReady() {
      var readyApi = getMindElixirCoreApi();
      if (isMindElixirReady(readyApi)) {
        return Promise.resolve(readyApi);
      }
      if (window.app && typeof window.app.ensureMindElixirCoreApi === 'function') {
        return window.app.ensureMindElixirCoreApi().then(function() {
          var nextApi = getMindElixirCoreApi();
          if (!isMindElixirReady(nextApi)) {
            throw new Error('MindElixir 依赖未就绪');
          }
          return nextApi;
        });
      }
      return Promise.resolve(readyApi);
    }

    function getCasesCoreApi() {
      if (ctx.casesCoreApi) return ctx.casesCoreApi;
      return window.app && window.app.casesCoreApi ? window.app.casesCoreApi : null;
    }

    function getXmindTaskManager() {
      if (xmindGenApi && xmindGenApi.taskManager) return xmindGenApi.taskManager;
      return window.app && window.app.xmindCaseGenTaskManager ? window.app.xmindCaseGenTaskManager : null;
    }

    function isDrawerOpen() {
      var el = drawerInstance && drawerInstance.element ? drawerInstance.element : drawerEl;
      return Boolean(el && el.classList && el.classList.contains('open'));
    }

    function getToolbarActionsBank() {
      if (!toolbarEl || !toolbarEl.querySelector) return null;
      return toolbarEl.querySelector('.xmind-casegen-actions');
    }

    function getInlineControlButtons() {
      return [
        summaryBtn,
        historyBtn,
        knowledgeRuleBtn,
        knowledgeAiBtn,
        dedupeBtn,
        coverageBtn,
        storeBtn,
        interruptBtn,
        deleteUndoBtn,
        deleteRedoBtn,
        exportBtn,
        exportMarkdownBtn,
      ].filter(Boolean);
    }

    function restoreInlineControlsToBank() {
      var bankEl = getToolbarActionsBank();
      if (bankEl && bankEl.appendChild) {
        getInlineControlButtons().forEach(function(btn) {
          if (!btn || btn.parentNode === bankEl) return;
          bankEl.appendChild(btn);
        });
      }
      if (toolbarEl && statusEl && statusEl.parentNode !== toolbarEl && toolbarEl.appendChild) {
        toolbarEl.appendChild(statusEl);
      }
      if (inlineStatusHost && inlineStatusHost.parentNode) {
        inlineStatusHost.parentNode.removeChild(inlineStatusHost);
      }
      if (inlineOverviewHost && inlineOverviewHost.parentNode) {
        inlineOverviewHost.parentNode.removeChild(inlineOverviewHost);
      }
      Object.keys(inlineGroupHosts).forEach(function(key) {
        var host = inlineGroupHosts[key];
        if (host && host.parentNode) {
          host.parentNode.removeChild(host);
        }
      });
      if (inlineModelHost && inlineModelHost.parentNode) {
        inlineModelHost.parentNode.removeChild(inlineModelHost);
      }
      if (toolbarCollapseBtn && toolbarCollapseBtn.parentNode) {
        toolbarCollapseBtn.parentNode.removeChild(toolbarCollapseBtn);
      }
      inlinePrimaryHost = null;
      inlineOverviewHost = null;
      inlineControlsHost = null;
      inlineStatusHost = null;
      inlineModelHost = null;
      toolbarCollapseBtn = null;
      inlineGroupHosts = {};
    }

    function getMindControlsRoot() {
      if (!mindContainer || !mindContainer.querySelector) return null;
      return mindContainer.querySelector('[data-mind-controls]');
    }

    function getInlinePrimaryHost() {
      var controlsRoot = getMindControlsRoot();
      if (!controlsRoot || !controlsRoot.querySelector) return null;
      var host = controlsRoot.querySelector('[data-mind-leading-host]');
      if (!host) {
        var searchGroup = controlsRoot.querySelector('.xmind-search-group');
        if (!searchGroup) return null;
        host = document.createElement('div');
        host.className = 'xmind-controls-leading-host';
        host.setAttribute('data-mind-leading-host', '1');
        if (searchGroup.parentNode && searchGroup.parentNode.insertBefore) {
          searchGroup.parentNode.insertBefore(host, searchGroup);
        }
      }
      inlinePrimaryHost = host;
      return host;
    }

    function getInlineControlsHost() {
      var controlsRoot = getMindControlsRoot();
      if (!controlsRoot || !controlsRoot.querySelector) return null;
      var host = controlsRoot.querySelector('[data-mind-utility-host]');
      if (!host) {
        var searchGroup = controlsRoot.querySelector('.xmind-search-group');
        if (!searchGroup || !searchGroup.parentNode || !searchGroup.parentNode.insertBefore) return null;
        host = document.createElement('div');
        host.className = 'xmind-controls-utility-host';
        host.setAttribute('data-mind-utility-host', '1');
        searchGroup.parentNode.insertBefore(host, searchGroup);
      }
      inlineControlsHost = host;
      return host;
    }

    function getInlineOverviewHost() {
      if (inlineOverviewHost && inlineOverviewHost.parentNode) {
        return inlineOverviewHost;
      }
      var primaryHost = getInlinePrimaryHost();
      if (!primaryHost) return null;
      var host = primaryHost.querySelector('[data-xmind-casegen-inline-overview]');
      if (!host) {
        host = document.createElement('div');
        host.className = 'xmind-casegen-inline-overview';
        host.setAttribute('data-xmind-casegen-inline-overview', '1');
      }
      if (host.parentNode !== primaryHost && primaryHost.appendChild) {
        primaryHost.appendChild(host);
      }
      inlineOverviewHost = host;
      return host;
    }

    function getInlineGroupHost(groupName) {
      var key = groupName ? String(groupName || '') : '';
      if (!key) return null;
      if (inlineGroupHosts[key] && inlineGroupHosts[key].parentNode) {
        return inlineGroupHosts[key];
      }
      var controlsHost = getInlineControlsHost();
      if (!controlsHost) return null;
      var selector = '[data-xmind-casegen-inline-group="' + key + '"]';
      var host = controlsHost.querySelector(selector);
      if (!host) {
        host = document.createElement('div');
        host.className = 'xmind-casegen-inline-group xmind-casegen-inline-group-' + key;
        host.setAttribute('data-xmind-casegen-inline-group', key);
        controlsHost.appendChild(host);
      }
      inlineGroupHosts[key] = host;
      return host;
    }

    function getInlineStatusHost() {
      var groupHost = getInlineGroupHost('task');
      if (!groupHost) return null;
      var host = groupHost.querySelector('[data-xmind-casegen-inline-status]');
      if (!host) {
        host = document.createElement('div');
        host.className = 'xmind-casegen-inline-status';
        host.setAttribute('data-xmind-casegen-inline-status', '1');
        groupHost.appendChild(host);
      }
      inlineStatusHost = host;
      return host;
    }

    function getInlineModelHost() {
      var controlsRoot = getMindControlsRoot();
      if (!controlsRoot || !controlsRoot.querySelector) return null;
      var zoomGroup = controlsRoot.querySelector('.xmind-zoom-group');
      if (!zoomGroup) return null;
      var exportActionBtn = controlsRoot.querySelector('[data-mind-action="export-xmind"]');
      if (exportActionBtn && exportActionBtn.classList) {
        exportActionBtn.classList.add('xmind-casegen-default-export-hidden');
        exportActionBtn.setAttribute('aria-hidden', 'true');
        exportActionBtn.tabIndex = -1;
      }
      var host = controlsRoot.querySelector('[data-xmind-casegen-model-host]');
      if (!host) {
        host = document.createElement('label');
        host.className = 'xmind-casegen-model-picker';
        host.setAttribute('data-xmind-casegen-model-host', '1');
      }
      if (host.parentNode !== zoomGroup && zoomGroup.appendChild) {
        zoomGroup.appendChild(host);
      }
      inlineModelHost = host;
      return host;
    }

    function getAvailableXmindModels() {
      return (Array.isArray(state && state.models) ? state.models : []).filter(function(item) {
        return Boolean(item && item.id);
      });
    }

    function syncInlineModelPicker() {
      var host = getInlineModelHost();
      if (!host) return false;
      var modelList = getAvailableXmindModels();
      var assignedId = state && state.assignments && state.assignments.xmindCaseGenId
        ? String(state.assignments.xmindCaseGenId || '')
        : '';
      var hasAssigned = false;
      var optionsHtml = modelList.map(function(item) {
        var id = String(item.id || '');
        var selected = id === assignedId;
        if (selected) hasAssigned = true;
        return '<option value="' + escapeHtml(id) + '"' + (selected ? ' selected' : '') + '>'
          + escapeHtml(item.name || id)
          + '</option>';
      }).join('');
      if (!hasAssigned) {
        optionsHtml = '<option value="" selected>请选择模型</option>' + optionsHtml;
      }
      host.innerHTML = '<span class="xmind-casegen-model-label">模型</span>'
        + '<select class="xmind-casegen-model-select" data-xmind-casegen-model-select aria-label="XMind 用例生成模型"'
        + (modelList.length ? '' : ' disabled')
        + '>'
        + optionsHtml
        + '</select>';
      var selectEl = host.querySelector('[data-xmind-casegen-model-select]');
      if (!selectEl) return false;
      selectEl.addEventListener('change', function() {
        var nextId = selectEl.value ? String(selectEl.value || '') : '';
        var prevId = state && state.assignments && state.assignments.xmindCaseGenId
          ? String(state.assignments.xmindCaseGenId || '')
          : '';
        if (nextId === prevId) return;
        state.assignments = state.assignments || {};
        state.assignments.xmindCaseGenId = nextId;
        if (xmindGenApi && typeof xmindGenApi.renderAssignmentsSelect === 'function') {
          xmindGenApi.renderAssignmentsSelect();
        }
        if (xmindGenApi && typeof xmindGenApi.saveAssignments === 'function') {
          xmindGenApi.saveAssignments();
        }
        if (xmindGenApi && typeof xmindGenApi.updateAssignmentStatuses === 'function') {
          xmindGenApi.updateAssignmentStatuses();
        }
        persistWorkflowStateNow();
        notifySuccessToast('已切换 XMind 模型', 2200);
      });
      return true;
    }

    function applyInlineButtonStyle(btn, extraClass) {
      if (!btn || !btn.classList) return;
      btn.classList.add('xmind-casegen-inline-btn');
      btn.classList.remove(
        'xmind-casegen-inline-btn-primary',
        'xmind-casegen-inline-btn-success',
        'xmind-casegen-inline-btn-danger'
      );
      if (extraClass) {
        btn.classList.add(extraClass);
      }
    }

    function isInlineToolbarCollapsed() {
      return getViewState().toolbarCollapsed === true;
    }

    function getInlineToolbarCollapseButton() {
      var controlsRoot = getMindControlsRoot();
      if (!controlsRoot || !controlsRoot.querySelector) return null;
      var btn = controlsRoot.querySelector('[data-xmind-casegen-toolbar-toggle]');
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'secondary xmind-toolbar-collapse-btn';
        btn.setAttribute('data-xmind-casegen-toolbar-toggle', '1');
        btn.addEventListener('click', function(event) {
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
          if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
          setInlineToolbarCollapsed(!isInlineToolbarCollapsed(), { persist: true });
        });
        controlsRoot.appendChild(btn);
      } else if (btn.parentNode !== controlsRoot && controlsRoot.appendChild) {
        controlsRoot.appendChild(btn);
      }
      toolbarCollapseBtn = btn;
      return btn;
    }

    function syncInlineToolbarCollapseState() {
      var controlsRoot = getMindControlsRoot();
      if (!controlsRoot) return false;
      var collapsed = isInlineToolbarCollapsed();
      var btn = getInlineToolbarCollapseButton();
      if (controlsRoot.classList) {
        if (collapsed) controlsRoot.classList.add('is-collapsed');
        else controlsRoot.classList.remove('is-collapsed');
      }
      controlsRoot.setAttribute('data-xmind-casegen-toolbar-collapsed', collapsed ? 'true' : 'false');
      controlsRoot.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      if (btn) {
        btn.textContent = collapsed ? '展开工具栏' : '收起工具栏';
        btn.title = collapsed ? '展开 XMind 生成工具栏' : '收起 XMind 生成工具栏';
        btn.setAttribute('aria-label', btn.title);
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      }
      return true;
    }

    function setInlineToolbarCollapsed(collapsed, options) {
      var viewState = getViewState();
      viewState.toolbarCollapsed = collapsed === true;
      viewState.updatedAt = Date.now();
      syncInlineToolbarCollapseState();
      if (!(options && options.persist === false)) {
        persistXmindState(true);
      }
    }

    function getInlineToolbarDedupeSummary() {
      var dedupeState = ensureDedupeUiState();
      var result = dedupeState && dedupeState.lastResult && typeof dedupeState.lastResult === 'object'
        ? dedupeState.lastResult
        : null;
      if (!result || result.status !== 'done') return null;
      var removedCount = Number(result.removedCount || 0) || 0;
      if (removedCount < 0) removedCount = 0;
      var actionText = getDedupeModeActionText(result.dedupeMode);
      return {
        removedCount: removedCount,
        title: removedCount > 0
          ? ('最近一次 AI 用例' + actionText + '移除 ' + String(removedCount) + ' 条用例')
          : ('最近一次 AI 用例' + actionText + '未移除用例'),
      };
    }

    function getInlineToolbarOverviewSummary() {
      var context = buildVisibleModuleContext();
      var moduleCount = Array.isArray(context && context.list) ? context.list.length : 0;
      var caseCount = 0;
      (context && Array.isArray(context.list) ? context.list : []).forEach(function(entry) {
        caseCount += getVisibleCasesForModuleEntry(entry).length;
      });
      var runningOperations = collectRunningGenerationOperations();
      var dedupeState = ensureDedupeUiState();
      var dedupeTerminalVisual = dedupeState.terminalVisualRunning === true
        && Number(dedupeState.terminalVisualUntil || 0) > Date.now();
      if (dedupeTerminalVisual) {
        var hasDedupeOperation = runningOperations.some(function(item) {
          return item && item.scope === 'dedupe';
        });
        if (!hasDedupeOperation) {
          runningOperations.push({
            scope: 'dedupe',
            actionId: DEDUPE_ACTION_ID,
            dedupeMode: normalizeDedupeMode(dedupeState.dedupeMode),
            label: 'AI用例去重',
          });
        }
      }
      var runningCount = runningOperations.length;
      var dedupeOperation = null;
      runningOperations.some(function(item) {
        if (item && item.scope === 'dedupe') {
          dedupeOperation = item;
          return true;
        }
        return false;
      });
      var dedupeRunning = runningOperations.some(function(item) {
        return item && item.scope === 'dedupe';
      });
      var coverageRunning = runningOperations.some(function(item) {
        return item && item.scope === 'coverage';
      });
      var dedupeMode = dedupeOperation ? normalizeDedupeMode(dedupeOperation.dedupeMode) : getDedupeModeFromSettings();
      return {
        runningCount: runningCount,
        runningState: runningCount > 0 ? 'running' : 'idle',
        runningLabel: runningCount > 0
          ? (coverageRunning ? '需求覆盖分析中' : (dedupeRunning ? getDedupeRunningLabel(dedupeMode) : '正在执行生成任务'))
          : '当前没有生成任务',
        runningHint: runningCount > 0
          ? (coverageRunning
            ? '正在分析当前页签可见用例对需求原文的覆盖'
            : (dedupeRunning
            ? getDedupeRunningHint(dedupeMode)
            : ('当前共有 ' + String(runningCount) + ' 个生成任务在执行')))
          : '当前可继续发起生成、补全或删除操作',
        moduleCount: moduleCount,
        caseCount: caseCount,
        dedupe: getInlineToolbarDedupeSummary(),
      };
    }

    function syncInlineToolbarOverview() {
      var host = getInlineOverviewHost();
      if (!host) return false;
      var summary = getInlineToolbarOverviewSummary();
      var taskClassName = 'xmind-casegen-inline-task-indicator is-' + summary.runningState;
      var taskBadgeHtml = summary.runningCount > 0
        ? ('<span class="xmind-casegen-inline-task-badge" data-xmind-casegen-task-count>' + escapeHtml(String(summary.runningCount)) + '</span>')
        : '';
      var dedupeCountHtml = summary.dedupe
        ? ('<span class="xmind-casegen-inline-count-pill is-dedupe" data-xmind-casegen-count-dedupe title="' + escapeHtml(summary.dedupe.title) + '">'
          + '<span>去重</span><strong>' + escapeHtml(String(summary.dedupe.removedCount)) + '</strong><span>条</span>'
          + '</span>')
        : '';
      host.innerHTML = ''
        + '<div class="' + taskClassName + '" data-xmind-casegen-task-state="' + escapeHtml(summary.runningState) + '" title="' + escapeHtml(summary.runningHint) + '">'
        + '<span class="xmind-casegen-inline-task-dot" aria-hidden="true"></span>'
        + '<span class="xmind-casegen-inline-task-label">' + escapeHtml(summary.runningLabel) + '</span>'
        + taskBadgeHtml
        + '</div>'
        + '<div class="xmind-casegen-inline-counts" data-xmind-casegen-counts title="当前画布展示的模块和用例总数会随生成、补全、删除实时刷新；去重为最近一次 AI 去重移除数量">'
        + '<span class="xmind-casegen-inline-count-pill" data-xmind-casegen-count-modules>'
        + '<strong>' + escapeHtml(String(summary.moduleCount)) + '</strong><span>模块</span>'
        + '</span>'
        + '<span class="xmind-casegen-inline-count-pill" data-xmind-casegen-count-cases>'
        + '<strong>' + escapeHtml(String(summary.caseCount)) + '</strong><span>用例</span>'
        + '</span>'
        + dedupeCountHtml
        + '</div>';
      return true;
    }

    function mountInlineControls() {
      var controlsRoot = getMindControlsRoot();
      var primaryHost = getInlinePrimaryHost();
      var historyGroup = getInlineGroupHost('history');
      var knowledgeGroup = getInlineGroupHost('knowledge');
      var persistenceGroup = getInlineGroupHost('result');
      var deleteGroup = getInlineGroupHost('delete-history');
      var taskGroup = getInlineGroupHost('task');
      var statusHost = getInlineStatusHost();
      if (!controlsRoot || !primaryHost || !historyGroup || !knowledgeGroup || !persistenceGroup || !deleteGroup || !taskGroup) {
        return false;
      }
      controlsRoot.classList.add('xmind-casegen-inline-controls-ready');
      if (summaryBtn && primaryHost.appendChild) {
        applyInlineButtonStyle(summaryBtn, 'xmind-casegen-inline-btn-primary');
        primaryHost.appendChild(summaryBtn);
      }
      var overviewHost = getInlineOverviewHost();
      if (!overviewHost) return false;
      syncInlineToolbarOverview();
      if (historyBtn && historyGroup.appendChild) {
        applyInlineButtonStyle(historyBtn);
        historyGroup.appendChild(historyBtn);
      }
      if (knowledgeRuleBtn && knowledgeGroup.appendChild) {
        applyInlineButtonStyle(knowledgeRuleBtn);
        knowledgeGroup.appendChild(knowledgeRuleBtn);
      }
      if (knowledgeAiBtn && knowledgeGroup.appendChild) {
        applyInlineButtonStyle(knowledgeAiBtn);
        knowledgeGroup.appendChild(knowledgeAiBtn);
      }
      if (dedupeBtn && persistenceGroup.appendChild) {
        applyInlineButtonStyle(dedupeBtn);
        persistenceGroup.appendChild(dedupeBtn);
      }
      if (coverageBtn && persistenceGroup.appendChild) {
        applyInlineButtonStyle(coverageBtn);
        persistenceGroup.appendChild(coverageBtn);
      }
      if (storeBtn && persistenceGroup.appendChild) {
        applyInlineButtonStyle(storeBtn, 'xmind-casegen-inline-btn-success');
        persistenceGroup.appendChild(storeBtn);
      }
      if (exportBtn && persistenceGroup.appendChild) {
        applyInlineButtonStyle(exportBtn);
        persistenceGroup.appendChild(exportBtn);
      }
      if (exportMarkdownBtn && persistenceGroup.appendChild) {
        applyInlineButtonStyle(exportMarkdownBtn);
        persistenceGroup.appendChild(exportMarkdownBtn);
      }
      if (deleteUndoBtn && deleteGroup.appendChild) {
        applyInlineButtonStyle(deleteUndoBtn);
        deleteGroup.appendChild(deleteUndoBtn);
      }
      if (deleteRedoBtn && deleteGroup.appendChild) {
        applyInlineButtonStyle(deleteRedoBtn);
        deleteGroup.appendChild(deleteRedoBtn);
      }
      if (statusHost && statusEl) {
        statusEl.classList.add('xmind-casegen-inline-status-text');
        statusHost.appendChild(statusEl);
      }
      if (interruptBtn && taskGroup.appendChild) {
        applyInlineButtonStyle(interruptBtn, 'xmind-casegen-inline-btn-danger');
        taskGroup.appendChild(interruptBtn);
      }
      syncDeleteHistoryButtons();
      syncInterruptButton();
      syncDedupeToolbarButton();
      syncCoverageToolbarButton();
      syncKnowledgeBaseToolbarState();
      syncInlineModelPicker();
      syncInlineToolbarCollapseState();
      return true;
    }

    function syncInterruptButton() {
      if (!interruptBtn) return;
      var runningCount = collectRunningGenerationOperations().length;
      interruptBtn.disabled = runningCount <= 0;
      interruptBtn.title = runningCount > 0
        ? ('中断当前 XMind 生成中的 ' + String(runningCount) + ' 个任务')
        : '当前没有进行中的 XMind 生成任务';
      syncPersistenceActionToolbarButtons();
      syncDedupeToolbarButton();
      syncCoverageToolbarButton();
      syncInlineToolbarOverview();
    }

    function syncPersistenceActionToolbarButtons() {
      var running = hasAnyRunningGenerationOperation();
      var message = '当前有 XMind 任务进行中，请等待完成后再操作';
      function syncButton(btn) {
        if (!btn) return;
        if (!btn.getAttribute('data-xmind-default-title')) {
          btn.setAttribute('data-xmind-default-title', String(btn.title || ''));
        }
        btn.disabled = running;
        btn.title = running
          ? message
          : String(btn.getAttribute('data-xmind-default-title') || '');
      }
      syncButton(storeBtn);
      syncButton(exportBtn);
      syncButton(exportMarkdownBtn);
    }

    function syncDedupeToolbarButton() {
      if (!dedupeBtn) return;
      var running = hasAnyRunningGenerationOperation();
      var hasCases = hasVisibleAiCasesForDedupe();
      var confirming = pendingManualDedupeConfirm === true;
      dedupeBtn.disabled = running || !hasCases || confirming;
      if (running) {
        dedupeBtn.title = '当前有 XMind 任务进行中，请等待完成后再去重';
      } else if (confirming) {
        dedupeBtn.title = 'AI 用例去重确认中，请先在弹窗中确认或取消';
      } else if (!hasCases) {
        dedupeBtn.title = '当前页签没有可去重的 AI 生成用例';
      } else {
        dedupeBtn.title = '对当前页签 AI 生成用例执行' + getDedupeModeActionText(getDedupeModeFromSettings());
      }
    }

    function getVisibleCaseCountForCoverage() {
      var context = buildVisibleModuleContext();
      var count = 0;
      (context && Array.isArray(context.list) ? context.list : []).forEach(function(entry) {
        count += getVisibleCasesForModuleEntry(entry).length;
      });
      return count;
    }

    function syncCoverageToolbarButton() {
      if (!coverageBtn) return;
      var runningOperations = collectRunningGenerationOperations();
      var running = runningOperations.length > 0;
      var coverageState = ensureCoverageUiState();
      var coverageRunning = coverageState.running === true || runningOperations.some(function(item) {
        return item && item.scope === 'coverage';
      });
      var hasWorkspace = hasActiveWorkspace();
      var requirementText = getSelectedRequirementSource().text || '';
      var hasRequirementText = Boolean(String(requirementText || '').trim());
      var hasCases = getVisibleCaseCountForCoverage() > 0;
      coverageBtn.disabled = running || !hasWorkspace || !hasRequirementText || !hasCases;
      coverageBtn.classList.toggle('is-running', coverageRunning);
      coverageBtn.setAttribute('aria-busy', coverageRunning ? 'true' : 'false');
      coverageBtn.setAttribute('aria-expanded', summaryDialogOpen === true && summaryDialogMode === 'coverage' ? 'true' : 'false');
      coverageBtn.innerHTML = coverageRunning
        ? '<span class="xmind-casegen-coverage-spinner" aria-hidden="true"></span><span>分析中</span>'
        : '需求覆盖';
      if (coverageRunning) {
        coverageBtn.title = '需求覆盖分析中，请等待完成';
      } else if (running) {
        coverageBtn.title = '当前有 XMind 任务进行中，请等待完成后再查看覆盖';
      } else if (!hasWorkspace) {
        coverageBtn.title = '请先新建生成页签';
      } else if (!hasRequirementText) {
        coverageBtn.title = '当前页签没有可分析的需求原文';
      } else if (!hasCases) {
        coverageBtn.title = '当前页签没有可分析的可见用例';
      } else {
        coverageBtn.title = '查看当前可见用例对需求原文的覆盖';
      }
    }

    function cleanupViewStateBindings() {
      if (viewStatePersistTimer) {
        clearTimeout(viewStatePersistTimer);
        viewStatePersistTimer = 0;
      }
      if (viewStateMutationObserver) {
        viewStateMutationObserver.disconnect();
        viewStateMutationObserver = null;
      }
      if (viewStateScrollTarget && viewStateScrollHandler) {
        viewStateScrollTarget.removeEventListener('scroll', viewStateScrollHandler);
      }
      if (viewStateInteractionTarget && viewStateClickHandler) {
        viewStateInteractionTarget.removeEventListener('click', viewStateClickHandler, true);
      }
      if (viewStateInteractionTarget && viewStateWheelHandler) {
        viewStateInteractionTarget.removeEventListener('wheel', viewStateWheelHandler, true);
      }
      if (viewStateInteractionTarget && viewStatePointerDownHandler) {
        viewStateInteractionTarget.removeEventListener('pointerdown', viewStatePointerDownHandler, true);
        viewStateInteractionTarget.removeEventListener('mousedown', viewStatePointerDownHandler, true);
      }
      if (typeof window !== 'undefined' && window && typeof window.removeEventListener === 'function') {
        if (viewStatePointerUpHandler) {
          window.removeEventListener('pointerup', viewStatePointerUpHandler, true);
          window.removeEventListener('mouseup', viewStatePointerUpHandler, true);
        }
        if (viewStatePointerCancelHandler) {
          window.removeEventListener('pointercancel', viewStatePointerCancelHandler, true);
          window.removeEventListener('blur', viewStatePointerCancelHandler, true);
        }
      }
      viewStateScrollTarget = null;
      viewStateScrollHandler = null;
      viewStateInteractionTarget = null;
      viewStateClickHandler = null;
      viewStateWheelHandler = null;
      viewStatePointerDownHandler = null;
      viewStatePointerUpHandler = null;
      viewStatePointerCancelHandler = null;
      viewStateManualGestureActive = false;
      viewStateManualGestureRecentUntil = 0;
      viewStateManualGestureDetected = false;
      viewStateLastObservedTransform = '';
    }

    function clearDrawerRestoreRetry(reason) {
      var hadRetry = drawerRestoreRetryTimer || drawerRestoreRetryCount > 0 || drawerRestoreStableCount > 0;
      if (drawerRestoreRetryTimer) {
        clearTimeout(drawerRestoreRetryTimer);
        drawerRestoreRetryTimer = 0;
      }
      if (hadRetry) {
        setDebugState({
          drawerRestoreClearedBy: String(reason || ''),
        });
      }
      drawerRestoreRetryCount = 0;
      drawerRestoreStableCount = 0;
    }

    function markDrawerManualCloseSuppressed(durationMs) {
      var ttl = Math.max(0, Number(durationMs || 0));
      if (ttl <= 0) {
        drawerManualCloseSuppressUntil = 0;
        return;
      }
      drawerManualCloseSuppressUntil = Date.now() + ttl;
    }

    function isDrawerManualCloseSuppressed() {
      if (!drawerManualCloseSuppressUntil) return false;
      if (Date.now() >= drawerManualCloseSuppressUntil) {
        drawerManualCloseSuppressUntil = 0;
        return false;
      }
      return true;
    }

    function scheduleRecoveredStatePersist() {
      if (recoveredStatePersistTimer) {
        clearTimeout(recoveredStatePersistTimer);
        recoveredStatePersistTimer = 0;
      }
      recoveredStatePersistTimer = setTimeout(function() {
        recoveredStatePersistTimer = 0;
        persistXmindState(true);
      }, 0);
    }

    function destroyMind() {
      rootCenterRequestToken += 1;
      cleanupViewStateBindings();
      cleanupTopupHighlightPresentation();
      restoreInlineControlsToBank();
      if (mindInstance && typeof mindInstance.destroy === 'function') {
        try {
          mindInstance.destroy();
        } catch (err) {}
      }
      mindInstance = null;
      currentMindData = null;
      if (mindContainer) mindContainer.innerHTML = '';
    }

    function setCasesGenModulesView() {
      if (casesGenApi && typeof casesGenApi.setCaseGenViewTab === 'function') {
        casesGenApi.setCaseGenViewTab('xmind-modules', { persist: false });
      } else {
        var modulesTabBtn = document.getElementById('caseGenModulesTabBtn');
        if (modulesTabBtn && typeof modulesTabBtn.click === 'function') modulesTabBtn.click();
      }
    }

    function markPageSuspending(flag) {
      pageSuspending = flag === true;
    }

    function isPageSuspending() {
      if (pageSuspending === true) return true;
      if (typeof document !== 'undefined' && document && document.visibilityState === 'hidden') {
        return true;
      }
      return false;
    }

    function syncLegacyWorkflowContext(options) {
      if (!casesGenApi || typeof casesGenApi.syncLegacyCaseGenState !== 'function') return false;
      casesGenApi.syncLegacyCaseGenState(options && typeof options === 'object'
        ? options
        : { persist: false, force: true });
      return true;
    }

    function restoreLegacyWorkflowContext(options) {
      if (!casesGenApi || typeof casesGenApi.restoreLegacyCaseGenState !== 'function') return false;
      var opts = options && typeof options === 'object' ? options : {};
      casesGenApi.restoreLegacyCaseGenState({
        allowWhileXmindMirror: opts.allowWhileXmindMirror === true,
        render: opts.render === true,
        persist: opts.persist === true,
        restoreInputs: opts.restoreInputs !== false,
        inputsOnly: opts.inputsOnly === true,
      });
      return true;
    }

    function captureDrawerLegacyRestoreSnapshot() {
      drawerLegacyRestoreSnapshot = state.caseGenLegacy && typeof state.caseGenLegacy === 'object'
        ? cloneJson(state.caseGenLegacy, {})
        : null;
      return drawerLegacyRestoreSnapshot;
    }

    function buildLegacyRestoreSignature(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var importedCases = Array.isArray(source.importedCases) ? source.importedCases : [];
      var modules = Array.isArray(source.modules)
        ? source.modules
        : (Array.isArray(source.caseGenModules) ? source.caseGenModules : []);
      var results = source.results && typeof source.results === 'object'
        ? source.results
        : (source.caseGenResults && typeof source.caseGenResults === 'object' ? source.caseGenResults : {});
      return JSON.stringify({
        requirementLabel: String(source.requirementLabel || ''),
        lastRawImportName: String(source.lastRawImportName || ''),
        rawText: String(source.rawText || ''),
        importedNames: importedCases.map(function(item) {
          return String(item && item.name ? item.name : '');
        }).filter(Boolean).sort(),
        moduleNames: modules.map(function(item) {
          return normalizeModuleTitle(item && (item.title || item.module || ''));
        }).filter(Boolean).sort(),
        resultKeys: Object.keys(results || {}).sort(),
      });
    }

    function shouldApplyDrawerLegacyRestoreSnapshot() {
      if (!drawerLegacyRestoreSnapshot || typeof drawerLegacyRestoreSnapshot !== 'object') return false;
      var currentLegacy = state.caseGenLegacy && typeof state.caseGenLegacy === 'object'
        ? state.caseGenLegacy
        : null;
      if (!currentLegacy) return true;
      var currentLegacySignature = buildLegacyRestoreSignature(currentLegacy);
      var currentSharedSignature = buildLegacyRestoreSignature(buildCurrentSharedWorkspaceSnapshot());
      var cachedSignature = buildLegacyRestoreSignature(drawerLegacyRestoreSnapshot);
      if (!currentLegacySignature) return true;
      return currentLegacySignature === currentSharedSignature
        && cachedSignature
        && cachedSignature !== currentSharedSignature;
    }

    function primeLegacyWorkflowContextForClose() {
      if (!shouldApplyDrawerLegacyRestoreSnapshot()) return false;
      state.caseGenLegacy = cloneJson(drawerLegacyRestoreSnapshot, {});
      return true;
    }

    function finalizeLegacyWorkflowRestore() {
      restoreLegacyWorkflowContext({
        allowWhileXmindMirror: true,
        render: false,
        persist: false,
        restoreInputs: true,
        inputsOnly: true,
      });
      drawerLegacyRestoreSnapshot = null;
    }

    function shouldSyncLegacyBeforeOpen() {
      if (String(state.activeTab || '') !== 'casesgen') return true;
      var settings = state.caseGenSettings && typeof state.caseGenSettings === 'object'
        ? state.caseGenSettings
        : null;
      var activeCaseGenView = settings && (settings.activeTab === 'xmind-modules' || settings.activeTab === 'modules')
        ? 'xmind-modules'
        : (settings && settings.activeTab === 'legacy-modules' ? 'legacy-modules' : 'settings');
      return activeCaseGenView !== 'xmind-modules';
    }

    function shouldXmindOwnLiveWorkspaceState() {
      if (isDrawerOpen()) return true;
      if (String(state.activeTab || '') !== 'casesgen') return false;
      var settings = state.caseGenSettings && typeof state.caseGenSettings === 'object'
        ? state.caseGenSettings
        : null;
      var activeCaseGenView = settings && (settings.activeTab === 'xmind-modules' || settings.activeTab === 'modules')
        ? 'xmind-modules'
        : (settings && settings.activeTab === 'legacy-modules' ? 'legacy-modules' : 'settings');
      return activeCaseGenView === 'xmind-modules';
    }

    function shouldUseShadowWorkspaceContext(targetWorkspaceId) {
      var targetId = String(targetWorkspaceId || '');
      if (!targetId) return false;
      var currentWorkspaceId = String(getActiveWorkspaceId() || '');
      if (!currentWorkspaceId) return true;
      if (targetId !== currentWorkspaceId) return true;
      return !shouldXmindOwnLiveWorkspaceState();
    }

    function ensureDrawer() {
      if (drawerInstance) return drawerInstance;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') {
        return null;
      }
      drawerInstance = window.app.drawer.createDrawer({
        drawerId: 'xmindCaseGenDrawer',
        openButtons: [],
        closeButtons: ['closeXmindCaseGenDrawerBtn'],
        onOpen: function() {
          var shouldCenterRootAfterOpen = pendingOpenCenterRoot === true;
          var shouldSkipRestorableAfterOpen = pendingOpenSkipRestorableViewState === true;
          var forceSnapshotHydrate = pendingOpenForceSnapshotHydrate === true;
          var openInstant = pendingOpenInstant === true;
          var restoreOpening = restoreDrawerOpenInFlight === true;
          var openWorkspaceId = pendingDrawerOpenWorkspaceId
            ? String(pendingDrawerOpenWorkspaceId || '')
            : String(getActiveWorkspaceId() || '');
          pendingOpenCenterRoot = false;
          pendingOpenSkipRestorableViewState = false;
          pendingOpenForceSnapshotHydrate = false;
          pendingOpenInstant = false;
          pendingDrawerOpenWorkspaceId = '';
          getViewState().drawerOpen = true;
          if (restoreOpening === true) {
            getViewState().fullscreen = false;
          }
          getViewState().updatedAt = Date.now();
          clearOpenButtonCompletionNotice({ persist: restoreOpening !== true });
          if (drawerEl && drawerEl.classList) {
            drawerEl.classList.toggle(
              'xmind-drawer-fullscreen',
              getViewState().fullscreen === true && restoreOpening !== true
            );
          }
          setDebugState({ phase: 'drawer-open' });
          if (!restoreOpening) {
            try {
              setDebugState({ phase: 'drawer-open-set-view-start' });
              setCasesGenModulesView();
              if (!state.caseGenSettings || typeof state.caseGenSettings !== 'object') {
                state.caseGenSettings = createDefaultCaseGenSettings();
              }
              state.caseGenSettings.activeTab = 'xmind-modules';
              setDebugState({ phase: 'drawer-open-set-view-done' });
            } catch (errView) {
              setDebugState({
                phase: 'drawer-open-set-view-error',
                error: errView && errView.message ? String(errView.message) : '未知错误'
              });
            }
          } else {
            if (!state.caseGenSettings || typeof state.caseGenSettings !== 'object') {
              state.caseGenSettings = createDefaultCaseGenSettings();
            }
            state.caseGenSettings.activeTab = 'xmind-modules';
          }
          try {
            if (openWorkspaceId) {
              setMirrorWorkspaceSelection(openWorkspaceId);
            }
            var targetWorkspaceId = openWorkspaceId || String(getActiveWorkspaceId() || '');
            var shouldSkipSnapshotHydrate = forceSnapshotHydrate !== true && restoreOpening === true
              && hasManagedTaskRestoreContextForWorkspace(targetWorkspaceId);
            if (!shouldSkipSnapshotHydrate) {
              if (openWorkspaceId && openWorkspaceId !== String(getActiveWorkspaceId() || '')) {
                hydrateWorkspaceSnapshot(openWorkspaceId, { keepDrawerOpen: true });
              } else {
                hydrateActiveWorkspaceSnapshot({ keepDrawerOpen: true });
              }
            }
          } catch (errHydrate) {
            setDebugState({
              phase: 'drawer-open-hydrate-error',
              error: errHydrate && errHydrate.message ? String(errHydrate.message) : '未知错误',
              workspaceId: openWorkspaceId,
            });
          }
          try {
            if (drawerTitleEl) drawerTitleEl.textContent = 'XMind 用例生成';
            setDebugState({ phase: 'drawer-open-title-done' });
          } catch (errTitle) {
            setDebugState({
              phase: 'drawer-open-title-error',
              error: errTitle && errTitle.message ? String(errTitle.message) : '未知错误'
            });
          }
          try {
            setDebugState({ phase: 'drawer-open-close-summary-start' });
            closeSummaryDialog({ skipPersist: true });
            setDebugState({ phase: 'drawer-open-close-summary-done' });
          } catch (errSummary) {
            setDebugState({
              phase: 'drawer-open-close-summary-error',
              error: errSummary && errSummary.message ? String(errSummary.message) : '未知错误'
            });
          }
          try {
            setDebugState({ phase: 'drawer-open-schedule-render' });
            if (drawerOpenRenderTimer) {
              clearTimeout(drawerOpenRenderTimer);
              drawerOpenRenderTimer = 0;
            }
            var renderOptions = {
              reason: restoreOpening === true ? 'drawer-open-restore-async' : 'drawer-open',
              persist: false,
              centerRootAfterRender: shouldCenterRootAfterOpen,
              skipRestorableViewState: shouldCenterRootAfterOpen || shouldSkipRestorableAfterOpen,
            };
            var renderDelayMs = restoreOpening === true
              ? (shouldSkipRestorableAfterOpen ? 120 : 0)
              : (openInstant ? 0 : 380);
            drawerOpenRenderTimer = setTimeout(function() {
              drawerOpenRenderTimer = 0;
              if (!isDrawerOpen()) {
                setDebugState({ phase: 'drawer-open-render-skipped-closed' });
                return;
              }
              setDebugState({
                phase: restoreOpening === true ? 'drawer-open-restore-render-callback' : 'drawer-open-render-callback',
                skipRestorableViewState: shouldSkipRestorableAfterOpen === true,
              });
              render({
                reason: renderOptions.reason,
                persist: renderOptions.persist,
                centerRootAfterRender: renderOptions.centerRootAfterRender,
                skipRestorableViewState: renderOptions.skipRestorableViewState,
              });
            }, renderDelayMs);
          } catch (errRender) {
            setDebugState({
              phase: 'drawer-open-schedule-render-error',
              error: errRender && errRender.message ? String(errRender.message) : '未知错误'
            });
          }
        },
        onClose: function() {
          persistDrawerClosedIntentState(false);
          finalizeDrawerClosedLifecycle();
        },
      });
      bindDrawerCloseIntentPersistence();
      return drawerInstance;
    }

    function ensureState() {
      if (!state.xmindCaseGen || typeof state.xmindCaseGen !== 'object') {
        state.xmindCaseGen = {
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
        knowledgeBase: createDefaultKnowledgeBaseState(),
        dedupe: createDefaultDedupeState(),
        coverage: createDefaultCoverageState(),
        viewState: createDefaultViewState(),
          history: [],
          operationSnapshots: [],
          lastOperationSnapshotId: '',
          rootSnapshotId: '',
          rootSnapshots: [],
          deletedBaselineModuleKeys: [],
          deletedBaselineCaseKeys: [],
          deleteUndoStack: [],
          deleteRedoStack: [],
          root: createDefaultRootState(),
          summaryCollapsed: false,
          prep: createDefaultPrepState(),
          nextSnapshotId: 1,
          snapshots: [],
          modules: {},
        };
      }
      if (!Array.isArray(state.xmindCaseGen.history)) state.xmindCaseGen.history = [];
      if (!Array.isArray(state.xmindCaseGen.operationSnapshots)) state.xmindCaseGen.operationSnapshots = [];
      if (!Array.isArray(state.xmindCaseGen.rootSnapshots)) state.xmindCaseGen.rootSnapshots = [];
      if (!Array.isArray(state.xmindCaseGen.workspaceOrder)) state.xmindCaseGen.workspaceOrder = [];
      if (!state.xmindCaseGen.workspaces || typeof state.xmindCaseGen.workspaces !== 'object') {
        state.xmindCaseGen.workspaces = {};
      }
      if (!state.xmindCaseGen.viewState || typeof state.xmindCaseGen.viewState !== 'object') {
        state.xmindCaseGen.viewState = createDefaultViewState();
      }
      state.xmindCaseGen.viewState = normalizeStoredViewState(state.xmindCaseGen.viewState, {
        drawerOpen: state.xmindCaseGen.viewState.drawerOpen === true,
        fullscreen: state.xmindCaseGen.viewState.fullscreen === true,
      });
      if (!Array.isArray(state.xmindCaseGen.deletedBaselineModuleKeys)) state.xmindCaseGen.deletedBaselineModuleKeys = [];
      if (!Array.isArray(state.xmindCaseGen.deletedBaselineCaseKeys)) state.xmindCaseGen.deletedBaselineCaseKeys = [];
      if (!Array.isArray(state.xmindCaseGen.deleteUndoStack)) state.xmindCaseGen.deleteUndoStack = [];
      if (!Array.isArray(state.xmindCaseGen.deleteRedoStack)) state.xmindCaseGen.deleteRedoStack = [];
      if (!Array.isArray(state.xmindCaseGen.snapshots)) state.xmindCaseGen.snapshots = [];
      if (!state.xmindCaseGen.modules || typeof state.xmindCaseGen.modules !== 'object') {
        state.xmindCaseGen.modules = {};
      }
      if (!state.xmindCaseGen.root || typeof state.xmindCaseGen.root !== 'object') {
        state.xmindCaseGen.root = createDefaultRootState();
      }
      if (!state.xmindCaseGen.prep || typeof state.xmindCaseGen.prep !== 'object') {
        state.xmindCaseGen.prep = createDefaultPrepState();
      }
      if (!state.xmindCaseGen.dedupe || typeof state.xmindCaseGen.dedupe !== 'object') {
        state.xmindCaseGen.dedupe = createDefaultDedupeState();
      }
      state.xmindCaseGen.dedupe.running = state.xmindCaseGen.dedupe.running === true;
      state.xmindCaseGen.dedupe.taskId = String(state.xmindCaseGen.dedupe.taskId || '');
      state.xmindCaseGen.dedupe.status = String(state.xmindCaseGen.dedupe.status || '');
      state.xmindCaseGen.dedupe.error = String(state.xmindCaseGen.dedupe.error || '');
      state.xmindCaseGen.dedupe.updatedAt = Number(state.xmindCaseGen.dedupe.updatedAt || 0) || 0;
      state.xmindCaseGen.coverage = normalizeCoverageState(state.xmindCaseGen.coverage);
      if (!Number.isFinite(Number(state.xmindCaseGen.nextSnapshotId))) {
        state.xmindCaseGen.nextSnapshotId = 1;
      }
      if (!Number.isFinite(Number(state.xmindCaseGen.nextWorkspaceSeq))) {
        state.xmindCaseGen.nextWorkspaceSeq = 1;
      }
      state.xmindCaseGen.activeWorkspaceId = String(state.xmindCaseGen.activeWorkspaceId || '');
      state.xmindCaseGen.mirrorWorkspaceId = String(state.xmindCaseGen.mirrorWorkspaceId || '');
      state.xmindCaseGen.mode = state.xmindCaseGen.mode === 'full' ? 'full' : 'modules';
      state.xmindCaseGen.treeSourceSignature = String(state.xmindCaseGen.treeSourceSignature || '');
      state.xmindCaseGen.hasModuleSkeleton = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      state.xmindCaseGen.hasImportedBaseline = hasImportedBaselineCases();
      state.xmindCaseGen.summaryResultKind = state.xmindCaseGen.summaryResultKind === 'error' ? 'error' : '';
      state.xmindCaseGen.inlineStatusText = String(state.xmindCaseGen.inlineStatusText || '');
      state.xmindCaseGen.inlineStatusType = normalizeInlineStatusType(state.xmindCaseGen.inlineStatusType || '');
      state.xmindCaseGen.openButtonDotVisible = state.xmindCaseGen.openButtonDotVisible === true;
      state.xmindCaseGen.knowledgeBase = normalizeKnowledgeBaseState(state.xmindCaseGen.knowledgeBase);
      state.xmindCaseGen.workspaceOrder = state.xmindCaseGen.workspaceOrder.map(function(item) {
        return String(item || '').trim();
      }).filter(Boolean);
      state.xmindCaseGen.lastOperationSnapshotId = String(state.xmindCaseGen.lastOperationSnapshotId || '');
      state.xmindCaseGen.rootSnapshotId = String(state.xmindCaseGen.rootSnapshotId || '');
      state.xmindCaseGen.root.taskId = String(state.xmindCaseGen.root.taskId || '');
      if (!state.xmindCaseGen.root.pipeline || typeof state.xmindCaseGen.root.pipeline !== 'object') {
        state.xmindCaseGen.root.pipeline = null;
      } else {
        state.xmindCaseGen.root.pipeline.id = String(state.xmindCaseGen.root.pipeline.id || '');
        state.xmindCaseGen.root.pipeline.actionId = String(state.xmindCaseGen.root.pipeline.actionId || '');
        state.xmindCaseGen.root.pipeline.snapshotId = String(state.xmindCaseGen.root.pipeline.snapshotId || '');
        state.xmindCaseGen.root.pipeline.historyActionLabel = String(state.xmindCaseGen.root.pipeline.historyActionLabel || '');
        state.xmindCaseGen.root.pipeline.stage = String(state.xmindCaseGen.root.pipeline.stage || '');
        state.xmindCaseGen.root.pipeline.discoveryStatus = String(state.xmindCaseGen.root.pipeline.discoveryStatus || '');
        state.xmindCaseGen.root.pipeline.cancelReason = String(state.xmindCaseGen.root.pipeline.cancelReason || '');
        state.xmindCaseGen.root.pipeline.hadAiContentBeforeAction = state.xmindCaseGen.root.pipeline.hadAiContentBeforeAction === true;
        state.xmindCaseGen.root.pipeline.hadAiLayerBeforeAction = state.xmindCaseGen.root.pipeline.hadAiLayerBeforeAction === true;
        state.xmindCaseGen.root.pipeline.hadAiCasesBeforeAction = state.xmindCaseGen.root.pipeline.hadAiCasesBeforeAction === true;
        state.xmindCaseGen.root.pipeline.cancelled = state.xmindCaseGen.root.pipeline.cancelled === true;
        state.xmindCaseGen.root.pipeline.errorCount = Number(state.xmindCaseGen.root.pipeline.errorCount || 0);
        if (!Number.isFinite(state.xmindCaseGen.root.pipeline.errorCount) || state.xmindCaseGen.root.pipeline.errorCount < 0) {
          state.xmindCaseGen.root.pipeline.errorCount = 0;
        }
        state.xmindCaseGen.root.pipeline.createdModules = Number(state.xmindCaseGen.root.pipeline.createdModules || 0);
        if (!Number.isFinite(state.xmindCaseGen.root.pipeline.createdModules) || state.xmindCaseGen.root.pipeline.createdModules < 0) {
          state.xmindCaseGen.root.pipeline.createdModules = 0;
        }
        state.xmindCaseGen.root.pipeline.addedCases = Number(state.xmindCaseGen.root.pipeline.addedCases || 0);
        if (!Number.isFinite(state.xmindCaseGen.root.pipeline.addedCases) || state.xmindCaseGen.root.pipeline.addedCases < 0) {
          state.xmindCaseGen.root.pipeline.addedCases = 0;
        }
        state.xmindCaseGen.root.pipeline.moduleTaskTotal = Number(state.xmindCaseGen.root.pipeline.moduleTaskTotal || 0);
        if (!Number.isFinite(state.xmindCaseGen.root.pipeline.moduleTaskTotal) || state.xmindCaseGen.root.pipeline.moduleTaskTotal < 0) {
          state.xmindCaseGen.root.pipeline.moduleTaskTotal = 0;
        }
        state.xmindCaseGen.root.pipeline.moduleTaskCompleted = Number(state.xmindCaseGen.root.pipeline.moduleTaskCompleted || 0);
        if (!Number.isFinite(state.xmindCaseGen.root.pipeline.moduleTaskCompleted) || state.xmindCaseGen.root.pipeline.moduleTaskCompleted < 0) {
          state.xmindCaseGen.root.pipeline.moduleTaskCompleted = 0;
        }
        state.xmindCaseGen.root.pipeline.updatedAt = Number(state.xmindCaseGen.root.pipeline.updatedAt || 0);
        if (!Number.isFinite(state.xmindCaseGen.root.pipeline.updatedAt) || state.xmindCaseGen.root.pipeline.updatedAt < 0) {
          state.xmindCaseGen.root.pipeline.updatedAt = 0;
        }
        if (!state.xmindCaseGen.root.pipeline.detailMap || typeof state.xmindCaseGen.root.pipeline.detailMap !== 'object') {
          state.xmindCaseGen.root.pipeline.detailMap = {};
        }
        if (!Array.isArray(state.xmindCaseGen.root.pipeline.diagnostics)) {
          state.xmindCaseGen.root.pipeline.diagnostics = [];
        }
        state.xmindCaseGen.root.pipeline.generatedDedupeModules = normalizeRootPipelineDedupeModules(state.xmindCaseGen.root.pipeline.generatedDedupeModules || []);
        if (!Array.isArray(state.xmindCaseGen.root.pipeline.moduleTaskCompletedKeys)) {
          state.xmindCaseGen.root.pipeline.moduleTaskCompletedKeys = [];
        } else {
          state.xmindCaseGen.root.pipeline.moduleTaskCompletedKeys = normalizeUniqueStringList(state.xmindCaseGen.root.pipeline.moduleTaskCompletedKeys);
        }
        if (state.xmindCaseGen.root.pipeline.moduleTaskCompletedKeys.length > state.xmindCaseGen.root.pipeline.moduleTaskCompleted) {
          state.xmindCaseGen.root.pipeline.moduleTaskCompleted = state.xmindCaseGen.root.pipeline.moduleTaskCompletedKeys.length;
        }
        if (!Array.isArray(state.xmindCaseGen.root.pipeline.pendingQueue)) {
          state.xmindCaseGen.root.pipeline.pendingQueue = [];
        } else {
          state.xmindCaseGen.root.pipeline.pendingQueue = state.xmindCaseGen.root.pipeline.pendingQueue
            .map(function(item) {
              if (!item || typeof item !== 'object') return null;
              return {
                moduleId: String(item.moduleId || ''),
                moduleKey: String(item.moduleKey || ''),
                moduleTitle: String(item.moduleTitle || ''),
                actionId: String(item.actionId || ''),
              rootPendingActionId: String(item.rootPendingActionId || ''),
              rootPipelineNewModule: item.rootPipelineNewModule === true,
              forceCreatedModuleBeforeAction: item.forceCreatedModuleBeforeAction === true,
              anchorNodeId: String(item.anchorNodeId || ''),
              fallbackCases: normalizeFallbackCaseList(item.fallbackCases, String(item.moduleTitle || '')),
            };
          })
            .filter(Boolean);
        }
      }
      state.xmindCaseGen.deletedBaselineModuleKeys = state.xmindCaseGen.deletedBaselineModuleKeys
        .map(function(item) { return normalizeModuleKey(item); })
        .filter(Boolean);
      state.xmindCaseGen.deletedBaselineCaseKeys = state.xmindCaseGen.deletedBaselineCaseKeys
        .map(function(item) { return String(item || '').trim(); })
        .filter(Boolean);
      state.xmindCaseGen.root.hideAiLayer = state.xmindCaseGen.root.hideAiLayer === true;
      state.xmindCaseGen.summaryCollapsed = state.xmindCaseGen.summaryCollapsed === true;
      state.xmindCaseGen.prep.step = Math.max(STEP_REQUIREMENT, Math.min(STEP_OPTIONS, Number(state.xmindCaseGen.prep.step) || STEP_REQUIREMENT));
      state.xmindCaseGen.prep.requirementMode = state.xmindCaseGen.prep.requirementMode === 'manual'
        ? 'manual'
        : (state.xmindCaseGen.prep.requirementMode === 'document' ? 'document' : '');
      state.xmindCaseGen.prep.requirementSupplement = String(state.xmindCaseGen.prep.requirementSupplement || '');
      state.xmindCaseGen.prep.manualRequirementLabel = String(state.xmindCaseGen.prep.manualRequirementLabel || '').trim();
      if (!Array.isArray(state.xmindCaseGen.prep.manualRequirementBlocks)) {
        state.xmindCaseGen.prep.manualRequirementBlocks = [];
      }
      state.xmindCaseGen.prep.caseImportMode = state.xmindCaseGen.prep.caseImportMode === 'import'
        ? 'import'
        : (state.xmindCaseGen.prep.caseImportMode === 'skip' ? 'skip' : '');
      state.xmindCaseGen.prep.baseLocked = state.xmindCaseGen.prep.baseLocked === true || state.xmindCaseGen.prep.completed === true;
      state.xmindCaseGen.prep.completed = state.xmindCaseGen.prep.completed === true;
      Object.keys(state.xmindCaseGen.modules || {}).forEach(function(key) {
        var moduleState = state.xmindCaseGen.modules[key];
        if (!moduleState || typeof moduleState !== 'object') return;
        moduleState.taskId = String(moduleState.taskId || '');
      });
      return state.xmindCaseGen;
    }

    function hasOpenButtonCompletionNotice() {
      return ensureState().openButtonDotVisible === true;
    }

    function syncCasegenProgressSidebar() {
      try {
        if (window.app && window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGenProgressBoard === 'function') {
          window.app.casesGenApi.renderCaseGenProgressBoard();
          return;
        }
        if (typeof renderCaseGenProgressBoard === 'function') renderCaseGenProgressBoard();
      } catch (err) {
        // ignore
      }
    }

    function syncOpenButtonState() {
      if (!openBtn || !openBtn.classList) return;
      var drawerOpen = isDrawerOpen();
      openBtn.classList.add('casegen-tab', 'casegen-tab-launcher');
      openBtn.classList.toggle('is-active', drawerOpen);
      openBtn.classList.toggle('has-notice-dot', hasOpenButtonCompletionNotice());
      if (openBtn.setAttribute) {
        openBtn.setAttribute('aria-expanded', drawerOpen ? 'true' : 'false');
        openBtn.setAttribute(
          'aria-label',
          hasOpenButtonCompletionNotice()
            ? 'XMind用例生成（有新的后台完成结果）'
            : 'XMind用例生成'
        );
      }
      syncCasegenProgressSidebar();
    }

    function clearOpenButtonCompletionNotice(options) {
      var opts = options || {};
      var xmindState = ensureState();
      var changed = xmindState.openButtonDotVisible === true;
      xmindState.openButtonDotVisible = false;
      syncOpenButtonState();
      if (changed && opts.persist !== false) {
        persistXmindState(true);
      }
      return changed;
    }

    function markOpenButtonCompletionNotice(options) {
      var opts = options || {};
      if (isDrawerOpen()) {
        syncOpenButtonState();
        return false;
      }
      var xmindState = ensureState();
      var changed = xmindState.openButtonDotVisible !== true;
      xmindState.openButtonDotVisible = true;
      syncOpenButtonState();
      if (changed && opts.persist !== false) {
        persistXmindState(true);
      }
      return changed;
    }

    function ensureRootUiState() {
      return ensureState().root;
    }

    function buildRootPipelineId() {
      return generateLocalId('xmind-root-pipeline');
    }

    function getRootPipelineState() {
      var rootState = ensureRootUiState();
      return rootState && rootState.pipeline && typeof rootState.pipeline === 'object'
        ? rootState.pipeline
        : null;
    }

    function setRootPipelineState(pipeline) {
      var rootState = ensureRootUiState();
      rootState.pipeline = pipeline && typeof pipeline === 'object'
        ? pipeline
        : null;
      rootState.updatedAt = Date.now();
      return rootState.pipeline;
    }

    function clearRootPipelineState() {
      return setRootPipelineState(null);
    }

    function createRootPipelineState(payload) {
      var input = payload && typeof payload === 'object' ? payload : {};
      return {
        id: input.id ? String(input.id || '') : buildRootPipelineId(),
        actionId: input.actionId ? String(input.actionId || '') : '',
        snapshotId: input.snapshotId ? String(input.snapshotId || '') : '',
        historyActionLabel: input.historyActionLabel ? String(input.historyActionLabel || '') : '',
        stage: input.stage ? String(input.stage || '') : '',
        discoveryStatus: input.discoveryStatus ? String(input.discoveryStatus || '') : '',
        hadAiContentBeforeAction: input.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: input.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: input.hadAiCasesBeforeAction === true,
        restoredAfterRefresh: input.restoredAfterRefresh === true,
        cancelled: input.cancelled === true,
        cancelReason: input.cancelReason ? String(input.cancelReason || '') : '',
        errorCount: Number(input.errorCount || 0),
        createdModules: Number(input.createdModules || 0),
        addedCases: Number(input.addedCases || 0),
        moduleTaskTotal: Number(input.moduleTaskTotal || 0),
        moduleTaskCompleted: Number(input.moduleTaskCompleted || 0),
        moduleTaskCompletedKeys: normalizeUniqueStringList(input.moduleTaskCompletedKeys || []),
        dedupeStatus: input.dedupeStatus ? String(input.dedupeStatus || '') : '',
        dedupeTaskId: input.dedupeTaskId ? String(input.dedupeTaskId || '') : '',
        dedupeMode: input.dedupeMode ? normalizeDedupeMode(input.dedupeMode) : '',
        dedupeBeforeCount: Number(input.dedupeBeforeCount || 0),
        dedupeAfterCount: Number(input.dedupeAfterCount || 0),
        dedupeRemovedCount: Number(input.dedupeRemovedCount || 0),
        dedupeError: input.dedupeError ? String(input.dedupeError || '') : '',
        dedupeRecords: normalizeHistoryDedupeRecords(input.dedupeRecords || input.removedCases || []),
        generatedDedupeModules: normalizeRootPipelineDedupeModules(input.generatedDedupeModules || []),
        detailMap: cloneJson(input.detailMap, {}) || {},
        diagnostics: Array.isArray(input.diagnostics) ? input.diagnostics.slice() : [],
        pendingQueue: Array.isArray(input.pendingQueue) ? cloneJson(input.pendingQueue, []) || [] : [],
        updatedAt: Date.now(),
      };
    }

    function cloneRootPipelineSnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') return null;
      var cloned = createRootPipelineState({
        id: snapshot.id,
        actionId: snapshot.actionId,
        snapshotId: snapshot.snapshotId,
        historyActionLabel: snapshot.historyActionLabel,
        stage: snapshot.stage,
        discoveryStatus: snapshot.discoveryStatus,
        hadAiContentBeforeAction: snapshot.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: snapshot.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: snapshot.hadAiCasesBeforeAction === true,
        restoredAfterRefresh: snapshot.restoredAfterRefresh === true,
        cancelled: snapshot.cancelled === true,
        cancelReason: snapshot.cancelReason,
        errorCount: snapshot.errorCount,
        createdModules: snapshot.createdModules,
        addedCases: snapshot.addedCases,
        moduleTaskTotal: snapshot.moduleTaskTotal,
        moduleTaskCompleted: snapshot.moduleTaskCompleted,
        moduleTaskCompletedKeys: snapshot.moduleTaskCompletedKeys,
        dedupeStatus: snapshot.dedupeStatus,
        dedupeTaskId: snapshot.dedupeTaskId,
        dedupeMode: snapshot.dedupeMode,
        dedupeBeforeCount: snapshot.dedupeBeforeCount,
        dedupeAfterCount: snapshot.dedupeAfterCount,
        dedupeRemovedCount: snapshot.dedupeRemovedCount,
        dedupeError: snapshot.dedupeError,
        dedupeRecords: snapshot.dedupeRecords,
        generatedDedupeModules: snapshot.generatedDedupeModules,
        detailMap: snapshot.detailMap,
        diagnostics: snapshot.diagnostics,
        pendingQueue: snapshot.pendingQueue,
      });
      cloned.updatedAt = Number(snapshot.updatedAt || 0);
      if (!Number.isFinite(cloned.updatedAt) || cloned.updatedAt < 0) {
        cloned.updatedAt = 0;
      }
      return cloned;
    }

    function buildCompactRootPipelineRestoreSnapshot(snapshot) {
      var cloned = cloneRootPipelineSnapshot(snapshot);
      if (!cloned) return null;
      return {
        id: String(cloned.id || ''),
        actionId: String(cloned.actionId || ''),
        snapshotId: String(cloned.snapshotId || ''),
        historyActionLabel: String(cloned.historyActionLabel || ''),
        stage: String(cloned.stage || ''),
        discoveryStatus: String(cloned.discoveryStatus || ''),
        hadAiContentBeforeAction: cloned.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: cloned.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: cloned.hadAiCasesBeforeAction === true,
        restoredAfterRefresh: cloned.restoredAfterRefresh === true,
        cancelled: cloned.cancelled === true,
        cancelReason: String(cloned.cancelReason || ''),
        errorCount: Number(cloned.errorCount || 0) || 0,
        createdModules: Number(cloned.createdModules || 0) || 0,
        addedCases: Number(cloned.addedCases || 0) || 0,
        moduleTaskTotal: Number(cloned.moduleTaskTotal || 0) || 0,
        moduleTaskCompleted: Number(cloned.moduleTaskCompleted || 0) || 0,
        moduleTaskCompletedKeys: normalizeUniqueStringList(cloned.moduleTaskCompletedKeys || []),
        dedupeStatus: String(cloned.dedupeStatus || ''),
        dedupeTaskId: String(cloned.dedupeTaskId || ''),
        dedupeMode: cloned.dedupeMode ? normalizeDedupeMode(cloned.dedupeMode) : '',
        dedupeBeforeCount: Number(cloned.dedupeBeforeCount || 0) || 0,
        dedupeAfterCount: Number(cloned.dedupeAfterCount || 0) || 0,
        dedupeRemovedCount: Number(cloned.dedupeRemovedCount || 0) || 0,
        dedupeError: String(cloned.dedupeError || ''),
        dedupeRecords: normalizeHistoryDedupeRecords(cloned.dedupeRecords || []),
        generatedDedupeModules: normalizeRootPipelineDedupeModules(cloned.generatedDedupeModules || []),
        detailMap: cloneJson(cloned.detailMap, {}) || {},
        diagnostics: Array.isArray(cloned.diagnostics) ? cloned.diagnostics.slice() : [],
        pendingQueue: Array.isArray(cloned.pendingQueue) ? cloneJson(cloned.pendingQueue, []) || [] : [],
        updatedAt: Number(cloned.updatedAt || 0) || 0,
      };
    }

    function getRootPipelineSnapshotWeight(pipeline) {
      var detailMap = pipeline && pipeline.detailMap && typeof pipeline.detailMap === 'object'
        ? pipeline.detailMap
        : {};
      var detailCount = Object.keys(detailMap).length;
      var diagnosticsCount = Array.isArray(pipeline && pipeline.diagnostics) ? pipeline.diagnostics.length : 0;
      var dedupeRecordCount = Array.isArray(pipeline && pipeline.dedupeRecords) ? pipeline.dedupeRecords.length : 0;
      var generatedDedupeCount = Array.isArray(pipeline && pipeline.generatedDedupeModules) ? pipeline.generatedDedupeModules.length : 0;
      var pendingCount = Array.isArray(pipeline && pipeline.pendingQueue) ? pipeline.pendingQueue.length : 0;
      return (
        Number(pipeline && pipeline.createdModules || 0) * 1000
        + Number(pipeline && pipeline.addedCases || 0) * 10
        + Number(pipeline && pipeline.moduleTaskTotal || 0) * 5
        + Number(pipeline && pipeline.moduleTaskCompleted || 0) * 20
        + detailCount * 100
        + diagnosticsCount * 10
        + dedupeRecordCount * 10
        + generatedDedupeCount * 100
        + pendingCount
      );
    }

    function mergeRootPipelineSnapshot(baseSnapshot, incomingSnapshot) {
      var base = cloneRootPipelineSnapshot(baseSnapshot);
      var incoming = cloneRootPipelineSnapshot(incomingSnapshot);
      if (!base) return incoming;
      if (!incoming) return base;
      var baseId = String(base.id || '');
      var incomingId = String(incoming.id || '');
      if (baseId && incomingId && baseId !== incomingId) {
        return getRootPipelineSnapshotWeight(incoming) >= getRootPipelineSnapshotWeight(base)
          ? incoming
          : base;
      }

      function pickString(existingValue, nextValue) {
        var nextText = nextValue === null || nextValue === undefined ? '' : String(nextValue || '').trim();
        if (nextText) return nextValue;
        return existingValue;
      }

      base.id = pickString(base.id, incoming.id);
      base.actionId = pickString(base.actionId, incoming.actionId);
      base.snapshotId = pickString(base.snapshotId, incoming.snapshotId);
      base.historyActionLabel = pickString(base.historyActionLabel, incoming.historyActionLabel);
      base.stage = pickString(base.stage, incoming.stage);
      base.discoveryStatus = pickString(base.discoveryStatus, incoming.discoveryStatus);
      base.cancelReason = pickString(base.cancelReason, incoming.cancelReason);
      base.dedupeStatus = pickString(base.dedupeStatus, incoming.dedupeStatus);
      base.dedupeTaskId = pickString(base.dedupeTaskId, incoming.dedupeTaskId);
      if (incoming.dedupeMode && (incoming.dedupeStatus || incoming.dedupeTaskId || !base.dedupeMode)) {
        base.dedupeMode = normalizeDedupeMode(incoming.dedupeMode);
      } else if (base.dedupeMode) {
        base.dedupeMode = normalizeDedupeMode(base.dedupeMode);
      } else {
        base.dedupeMode = '';
      }
      base.dedupeError = pickString(base.dedupeError, incoming.dedupeError);
      base.hadAiContentBeforeAction = base.hadAiContentBeforeAction === true || incoming.hadAiContentBeforeAction === true;
      base.hadAiLayerBeforeAction = base.hadAiLayerBeforeAction === true || incoming.hadAiLayerBeforeAction === true;
      base.hadAiCasesBeforeAction = base.hadAiCasesBeforeAction === true || incoming.hadAiCasesBeforeAction === true;
      base.restoredAfterRefresh = base.restoredAfterRefresh === true || incoming.restoredAfterRefresh === true;
      base.cancelled = base.cancelled === true || incoming.cancelled === true;
      base.errorCount = Math.max(Number(base.errorCount || 0), Number(incoming.errorCount || 0));
      base.createdModules = Math.max(Number(base.createdModules || 0), Number(incoming.createdModules || 0));
      base.addedCases = Math.max(Number(base.addedCases || 0), Number(incoming.addedCases || 0));
      base.moduleTaskTotal = Math.max(Number(base.moduleTaskTotal || 0), Number(incoming.moduleTaskTotal || 0));
      base.moduleTaskCompleted = Math.max(Number(base.moduleTaskCompleted || 0), Number(incoming.moduleTaskCompleted || 0));
      base.moduleTaskCompletedKeys = normalizeUniqueStringList((base.moduleTaskCompletedKeys || []).concat(incoming.moduleTaskCompletedKeys || []));
      if (base.moduleTaskCompletedKeys.length > base.moduleTaskCompleted) {
        base.moduleTaskCompleted = base.moduleTaskCompletedKeys.length;
      }
      base.dedupeBeforeCount = Math.max(Number(base.dedupeBeforeCount || 0), Number(incoming.dedupeBeforeCount || 0));
      base.dedupeAfterCount = Math.max(Number(base.dedupeAfterCount || 0), Number(incoming.dedupeAfterCount || 0));
      base.dedupeRemovedCount = Math.max(Number(base.dedupeRemovedCount || 0), Number(incoming.dedupeRemovedCount || 0));
      base.updatedAt = Math.max(Number(base.updatedAt || 0), Number(incoming.updatedAt || 0));

      var mergedDetailMap = {};
      [base.detailMap, incoming.detailMap].forEach(function(map) {
        var source = map && typeof map === 'object' ? map : {};
        Object.keys(source).forEach(function(key) {
          var item = source[key];
          if (!item) return;
          var caseCount = Number(item.caseCount || 0);
          if (!Number.isFinite(caseCount) || caseCount < 0) caseCount = 0;
          if (!mergedDetailMap[key] || caseCount >= Number(mergedDetailMap[key].caseCount || 0)) {
            mergedDetailMap[key] = {
              module: normalizeModuleTitle(item.module || ''),
              caseCount: caseCount,
            };
          }
        });
      });
      base.detailMap = mergedDetailMap;
      base.diagnostics = normalizeHistoryDiagnostics((base.diagnostics || []).concat(incoming.diagnostics || []));
      base.dedupeRecords = normalizeHistoryDedupeRecords((base.dedupeRecords || []).concat(incoming.dedupeRecords || []));
      base.generatedDedupeModules = normalizeRootPipelineDedupeModules((base.generatedDedupeModules || []).concat(incoming.generatedDedupeModules || []));
      if (Array.isArray(incoming.pendingQueue) && incoming.pendingQueue.length >= (Array.isArray(base.pendingQueue) ? base.pendingQueue.length : 0)) {
        base.pendingQueue = cloneJson(incoming.pendingQueue, []) || [];
      }
      return base;
    }

    function updateRootPipelineState(mutator) {
      var current = getRootPipelineState();
      if (!current || typeof mutator !== 'function') return null;
      mutator(current);
      current.updatedAt = Date.now();
      setRootPipelineState(current);
      return current;
    }

    function ensureRootPipelineStateFromTask(task) {
      var taskPipelineId = task && task.rootPipelineId ? String(task.rootPipelineId || '') : '';
      var current = getRootPipelineState();
      if (current && taskPipelineId && String(current.id || '') === taskPipelineId) {
        return current;
      }
      if (!taskPipelineId) return current;
      var reconstructed = createRootPipelineState({
        id: taskPipelineId,
        actionId: task && task.rootPipelineActionId ? String(task.rootPipelineActionId || '') : String(task && task.actionId ? task.actionId : ''),
        snapshotId: task && task.snapshotId ? String(task.snapshotId || '') : '',
        historyActionLabel: task && task.historyActionLabel ? String(task.historyActionLabel || '') : '',
        stage: task && task.pipelineStage ? String(task.pipelineStage || '') : 'modules',
        discoveryStatus: task && task.pipelineStage === 'discovery' ? 'running' : 'done',
        hadAiContentBeforeAction: task && task.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: task && task.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: task && task.hadAiCasesBeforeAction === true,
      });
      var restorePipeline = task
        && task.restoreContext
        && task.restoreContext.rootPipeline
        && typeof task.restoreContext.rootPipeline === 'object'
        ? task.restoreContext.rootPipeline
        : null;
      if (restorePipeline && String(restorePipeline.id || '') === taskPipelineId) {
        reconstructed = mergeRootPipelineSnapshot(restorePipeline, reconstructed);
      }
      setRootPipelineState(reconstructed);
      return reconstructed;
    }

    function isTaskInRootPipeline(task, pipelineId) {
      if (!task || !pipelineId) return false;
      return String(task.rootPipelineId || '') === String(pipelineId || '');
    }

    function normalizeRootPipelineTaskCount(value) {
      var total = Number(value || 0);
      if (!Number.isFinite(total) || total < 0) total = 0;
      return Math.floor(total);
    }

    function getRootPipelineModuleTaskCompletionKey(task) {
      if (!task || typeof task !== 'object') return '';
      var taskId = String(task.id || '').trim();
      if (taskId) return 'task:' + taskId;
      var moduleId = String(task.moduleId || '').trim();
      var moduleKey = String(task.moduleKey || '').trim();
      var moduleTitle = normalizeModuleTitle(task.moduleTitle || '');
      var actionId = String(task.actionId || '').trim();
      var rootActionId = String(task.rootPipelineActionId || '').trim();
      var keySeed = moduleId || moduleKey || moduleTitle;
      if (!keySeed) return '';
      return [
        'module',
        keySeed,
        actionId || 'unknown-action',
        rootActionId || 'unknown-root',
      ].join(':');
    }

    function markRootPipelineModuleTaskCompleted(task) {
      var pipelineId = task && task.rootPipelineId ? String(task.rootPipelineId || '') : '';
      if (!pipelineId) return null;
      var completionKey = getRootPipelineModuleTaskCompletionKey(task);
      return updateRootPipelineState(function(current) {
        if (String(current.id || '') !== pipelineId) return;
        if (!Array.isArray(current.moduleTaskCompletedKeys)) {
          current.moduleTaskCompletedKeys = [];
        }
        if (completionKey && current.moduleTaskCompletedKeys.indexOf(completionKey) !== -1) {
          return;
        }
        if (completionKey) {
          current.moduleTaskCompletedKeys.push(completionKey);
        }
        current.moduleTaskCompleted = normalizeRootPipelineTaskCount(current.moduleTaskCompleted) + 1;
      });
    }

    function isRootPipelineModulePhaseComplete(pipeline) {
      if (!pipeline) return true;
      if (pipeline.cancelled === true) return true;
      var total = normalizeRootPipelineTaskCount(pipeline.moduleTaskTotal);
      if (total <= 0) return true;
      var completed = normalizeRootPipelineTaskCount(pipeline.moduleTaskCompleted);
      if (Array.isArray(pipeline.moduleTaskCompletedKeys)) {
        completed = Math.max(completed, pipeline.moduleTaskCompletedKeys.length);
      }
      return completed >= total;
    }

    function collectRootPipelineRunningTasks(pipelineId, tasks) {
      var targetId = String(pipelineId || '');
      if (!targetId) return [];
      var list = Array.isArray(tasks) ? tasks : listManagedXmindTasks();
      return list.filter(function(task) {
        return task && task.status === 'running' && isTaskInRootPipeline(task, targetId);
      });
    }

    function collectRootPipelineTerminalTasks(pipelineId, tasks) {
      var targetId = String(pipelineId || '');
      if (!targetId) return [];
      var list = Array.isArray(tasks) ? tasks : listManagedXmindTasks();
      return list.filter(function(task) {
        return task && isManagedTaskTerminal(task) && isTaskInRootPipeline(task, targetId);
      });
    }

    function serializeRootPipelineDescriptor(descriptor) {
      var moduleEntry = descriptor && descriptor.moduleEntry ? descriptor.moduleEntry : null;
      var moduleTitle = normalizeModuleTitle(moduleEntry && moduleEntry.title ? moduleEntry.title : '');
      return {
        moduleId: String(moduleEntry && moduleEntry.aiModuleId ? moduleEntry.aiModuleId : ''),
        moduleKey: String(moduleEntry && moduleEntry.moduleKey ? moduleEntry.moduleKey : ''),
        moduleTitle: moduleTitle,
        actionId: String(descriptor && descriptor.actionId ? descriptor.actionId : ''),
        rootPendingActionId: String(descriptor && descriptor.rootPendingActionId ? descriptor.rootPendingActionId : ''),
        rootPipelineNewModule: descriptor && descriptor.rootPipelineNewModule === true,
        forceCreatedModuleBeforeAction: descriptor && descriptor.forceCreatedModuleBeforeAction === true,
        anchorNodeId: descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'anchorNodeId')
          ? String(descriptor.anchorNodeId || '')
          : '',
        fallbackCases: normalizeFallbackCaseList(descriptor && descriptor.fallbackCases, moduleTitle),
      };
    }

    function resolveRootPipelineDescriptor(serialized, visibleContext) {
      if (!serialized || typeof serialized !== 'object') return null;
      var context = ensureVisibleModuleContext(visibleContext);
      var contextMap = context.map || {};
      var targetModuleId = String(serialized.moduleId || '');
      var targetModuleKey = String(serialized.moduleKey || '');
      var targetTitle = normalizeModuleTitle(serialized.moduleTitle || '');
      var moduleEntry = null;
      if (targetModuleId) {
        context.list.some(function(entry) {
          if (entry && String(entry.aiModuleId || '') === targetModuleId) {
            moduleEntry = entry;
            return true;
          }
          return false;
        });
      }
      if (!moduleEntry && targetModuleKey && contextMap[targetModuleKey]) {
        moduleEntry = contextMap[targetModuleKey];
      }
      if (!moduleEntry && targetTitle) {
        context.list.some(function(entry) {
          if (normalizeModuleTitle(entry && entry.title ? entry.title : '') === targetTitle) {
            moduleEntry = entry;
            return true;
          }
          return false;
        });
      }
      if (!moduleEntry) return null;
      return {
        moduleEntry: moduleEntry,
        actionId: String(serialized.actionId || ''),
        rootPendingActionId: String(serialized.rootPendingActionId || ''),
        rootPipelineNewModule: serialized.rootPipelineNewModule === true,
        forceCreatedModuleBeforeAction: serialized.forceCreatedModuleBeforeAction === true,
        anchorNodeId: String(serialized.anchorNodeId || ''),
        fallbackCases: normalizeFallbackCaseList(serialized.fallbackCases, moduleEntry && moduleEntry.title ? moduleEntry.title : targetTitle),
      };
    }

    function replaceRootPipelinePendingQueue(pipelineId, descriptors) {
      var targetId = String(pipelineId || '');
      return updateRootPipelineState(function(current) {
        if (String(current.id || '') !== targetId) return;
        current.pendingQueue = (Array.isArray(descriptors) ? descriptors : [])
          .map(function(item) { return serializeRootPipelineDescriptor(item); })
          .filter(function(item) { return Boolean(item && item.actionId); });
      });
    }

    function shiftRootPipelinePendingDescriptor(pipelineId) {
      var targetId = String(pipelineId || '');
      var nextSerialized = null;
      updateRootPipelineState(function(current) {
        if (String(current.id || '') !== targetId) return;
        if (!Array.isArray(current.pendingQueue)) current.pendingQueue = [];
        nextSerialized = current.pendingQueue.shift() || null;
      });
      return nextSerialized;
    }

    function ensureRootPipelineDetailEntry(pipeline, moduleTitle) {
      if (!pipeline || typeof pipeline !== 'object') return null;
      if (!pipeline.detailMap || typeof pipeline.detailMap !== 'object') {
        pipeline.detailMap = {};
      }
      var title = normalizeModuleTitle(moduleTitle || '');
      var key = normalizeModuleKey(title || '') || ('module-' + String(Object.keys(pipeline.detailMap).length + 1));
      if (!pipeline.detailMap[key]) {
        pipeline.detailMap[key] = {
          module: title || '未命名模块',
          caseCount: 0,
        };
      }
      return pipeline.detailMap[key];
    }

    function appendRootPipelineModuleDetail(pipeline, moduleTitle, caseCount) {
      var entry = ensureRootPipelineDetailEntry(pipeline, moduleTitle);
      if (!entry) return;
      var nextCount = Number(caseCount);
      if (!Number.isFinite(nextCount) || nextCount < 0) nextCount = 0;
      entry.caseCount += nextCount;
    }

    function appendRootPipelineDiagnostics(pipeline, items) {
      if (!pipeline || typeof pipeline !== 'object') return;
      var next = Array.isArray(items) ? items : [items];
      pipeline.diagnostics = normalizeHistoryDiagnostics((pipeline.diagnostics || []).concat(next));
    }

    function normalizeRootPipelineDedupeModule(item) {
      if (!item || typeof item !== 'object') return null;
      var moduleTitle = normalizeModuleTitle(item.module || item.moduleTitle || item.title || '');
      var moduleId = item.moduleId || item.module_id ? String(item.moduleId || item.module_id || '') : '';
      var moduleKey = String(item.moduleKey || item.module_key || normalizeModuleKey(moduleTitle || moduleId || ''));
      var cases = normalizeFallbackCaseList(item.cases || [], moduleTitle);
      if (!moduleTitle || !cases.length) return null;
      return {
        moduleId: moduleId,
        moduleKey: moduleKey || normalizeModuleKey(moduleTitle),
        module: moduleTitle,
        key_scenarios: normalizeArrayField(item.key_scenarios || item.scenarios),
        test_points: normalizeArrayField(item.test_points || item.points),
        coupled_modules: normalizeArrayField(item.coupled_modules || item.coupled),
        cases: cases,
      };
    }

    function normalizeRootPipelineDedupeModules(list) {
      var result = [];
      var indexMap = {};
      (Array.isArray(list) ? list : []).forEach(function(item) {
        var normalized = normalizeRootPipelineDedupeModule(item);
        if (!normalized) return;
        var key = normalized.moduleId
          ? ('id:' + normalized.moduleId)
          : ('key:' + (normalized.moduleKey || normalizeModuleKey(normalized.module)));
        if (indexMap[key] === undefined) {
          indexMap[key] = result.length;
          result.push(normalized);
          return;
        }
        var existing = result[indexMap[key]];
        if (!existing || normalized.cases.length >= existing.cases.length) {
          result[indexMap[key]] = normalized;
        }
      });
      return result;
    }

    function hasRootPipelineDedupeCases(modules) {
      return (Array.isArray(modules) ? modules : []).some(function(item) {
        return Boolean(item && Array.isArray(item.cases) && item.cases.length > 0);
      });
    }

    function upsertRootPipelineDedupeModule(pipeline, item) {
      if (!pipeline || typeof pipeline !== 'object') return;
      var normalized = normalizeRootPipelineDedupeModule(item);
      if (!normalized) return;
      var list = normalizeRootPipelineDedupeModules(pipeline.generatedDedupeModules || []);
      var replaced = false;
      list.forEach(function(existing, index) {
        if (replaced) return;
        var sameId = normalized.moduleId && existing.moduleId && normalized.moduleId === existing.moduleId;
        var sameKey = normalized.moduleKey && existing.moduleKey && normalized.moduleKey === existing.moduleKey;
        if (!sameId && !sameKey) return;
        if ((normalized.cases || []).length > (existing.cases || []).length) {
          list[index] = normalized;
        }
        replaced = true;
      });
      if (!replaced) list.push(normalized);
      pipeline.generatedDedupeModules = list;
    }

    function ensureModuleUiState(moduleId) {
      var rootState = ensureState();
      var key = String(moduleId || '');
      if (!key) return null;
      if (!rootState.modules[key] || typeof rootState.modules[key] !== 'object') {
        rootState.modules[key] = {
          lastAction: '',
          running: false,
          taskId: '',
          rootPendingActionId: '',
          snapshotId: '',
          status: '',
          error: '',
          hideResults: false,
          updatedAt: 0,
          topupHighlight: null,
          rollbackRestoreTopupHighlight: null,
        };
      }
      return rootState.modules[key];
    }

    function buildDeletedBaselineModuleMapFromList(list) {
      var map = Object.create(null);
      (Array.isArray(list) ? list : []).forEach(function(item) {
        var key = buildBaselineModuleDeleteKey(item);
        if (key) map[key] = true;
      });
      return map;
    }

    function buildDeletedBaselineCaseMapFromList(list) {
      var map = Object.create(null);
      (Array.isArray(list) ? list : []).forEach(function(item) {
        var key = String(item || '').trim();
        if (key) map[key] = true;
      });
      return map;
    }

    function getDeletedBaselineModuleMap() {
      return buildDeletedBaselineModuleMapFromList(ensureState().deletedBaselineModuleKeys);
    }

    function getDeletedBaselineCaseMap() {
      return buildDeletedBaselineCaseMapFromList(ensureState().deletedBaselineCaseKeys);
    }

    function rememberDeletedBaselineModule(moduleTitle) {
      var key = buildBaselineModuleDeleteKey(moduleTitle);
      var xmindState = ensureState();
      if (!key) return false;
      if (xmindState.deletedBaselineModuleKeys.indexOf(key) !== -1) return false;
      xmindState.deletedBaselineModuleKeys.push(key);
      xmindState.deletedBaselineModuleKeys = normalizeUniqueStringList(xmindState.deletedBaselineModuleKeys);
      xmindState.deletedBaselineCaseKeys = normalizeUniqueStringList((xmindState.deletedBaselineCaseKeys || []).filter(function(item) {
        return String(item || '').indexOf(key + '::') !== 0;
      }));
      return true;
    }

    function rememberDeletedBaselineCase(moduleTitle, caseSignature) {
      var key = buildBaselineCaseDeleteKey(moduleTitle, caseSignature);
      var xmindState = ensureState();
      if (!key) return false;
      if (xmindState.deletedBaselineCaseKeys.indexOf(key) !== -1) return false;
      xmindState.deletedBaselineCaseKeys.push(key);
      xmindState.deletedBaselineCaseKeys = normalizeUniqueStringList(xmindState.deletedBaselineCaseKeys);
      return true;
    }

    function invalidateDeleteConflictingSnapshots() {
      var xmindState = ensureState();
      xmindState.snapshots = [];
      xmindState.rootSnapshots = [];
      xmindState.operationSnapshots = [];
      xmindState.lastOperationSnapshotId = '';
      xmindState.rootSnapshotId = '';
      if (xmindState.root) {
        xmindState.root.snapshotId = '';
        xmindState.root.running = false;
        xmindState.root.taskId = '';
        xmindState.root.hideAiLayer = false;
        xmindState.root.status = '';
        xmindState.root.error = '';
      }
      Object.keys(xmindState.modules || {}).forEach(function(key) {
        var moduleState = ensureModuleUiState(key);
        if (!moduleState) return;
        moduleState.snapshotId = '';
        moduleState.running = false;
        moduleState.taskId = '';
        moduleState.rootPendingActionId = '';
        moduleState.status = '';
        moduleState.error = '';
        moduleState.hideResults = false;
        clearModuleTopupHighlight(moduleState);
      });
      clearAllTopupHighlights();
    }

    function persistXmindState(useImmediate, options) {
      var opts = options || {};
      ensureState().hasImportedBaseline = hasImportedBaselineCases();
      saveActiveWorkspaceSnapshot({
        forceShared: opts.forceShared === true,
      });
      if (useImmediate === true) persistWorkflowStateNow();
      else persistWorkflowState();
      if (useImmediate === true) {
        syncRunningTaskRestoreContexts();
      }
    }

    function persistManagedTaskWorkspaceState(useImmediate) {
      persistXmindState(useImmediate, {
        forceShared: true,
      });
    }

    function createInitialXmindState(options) {
      var opts = options || {};
      var nextViewState = createDefaultViewState();
      nextViewState.drawerOpen = opts.drawerOpen === true;
      nextViewState.fullscreen = opts.fullscreen === true;
      nextViewState.updatedAt = Date.now();
      return {
        mode: 'modules',
        treeSourceSignature: '',
        hasModuleSkeleton: false,
        hasImportedBaseline: false,
        summaryResultKind: '',
        inlineStatusText: '',
        inlineStatusType: '',
        openButtonDotVisible: false,
        knowledgeBase: createDefaultKnowledgeBaseState(),
        dedupe: createDefaultDedupeState(),
        coverage: createDefaultCoverageState(),
        viewState: nextViewState,
        history: [],
        operationSnapshots: [],
        lastOperationSnapshotId: '',
        rootSnapshotId: '',
        rootSnapshots: [],
        deletedBaselineModuleKeys: [],
        deletedBaselineCaseKeys: [],
        deleteUndoStack: [],
        deleteRedoStack: [],
        root: createDefaultRootState(),
        summaryCollapsed: false,
        prep: createDefaultPrepState(),
        nextSnapshotId: 1,
        snapshots: [],
        modules: {},
      };
    }

    function normalizeWorkspaceSharedState(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      return {
        requirementLabel: normalizePersistedRequirementLabel(source.requirementLabel),
        requirementLabelSource: String(source.requirementLabelSource || ''),
        lastRawImportName: String(source.lastRawImportName || ''),
        rawText: String(source.rawText || ''),
        caseText: String(source.caseText || ''),
        importedCases: cloneJson(source.importedCases, []),
        caseGenModules: cloneJson(source.caseGenModules, []),
        caseGenSource: String(source.caseGenSource || ''),
        caseGenResults: cloneJson(source.caseGenResults, {}),
        caseSelections: cloneSelectionMap(source.caseSelections),
        caseGenSuggestions: cloneJson(source.caseGenSuggestions, {}),
        caseGenModuleStatus: cloneJson(source.caseGenModuleStatus, {}),
        caseGenProgress: cloneJson(source.caseGenProgress, {}),
        caseGenTiming: cloneJson(source.caseGenTiming, {}),
        caseGenProgressNotice: cloneJson(source.caseGenProgressNotice, {}),
        caseGenSettings: cloneCaseGenSettingsValue(source.caseGenSettings),
        requirementMedia: cloneRequirementMediaValue(source.requirementMedia),
      };
    }

    function extractActiveXmindStateSnapshot() {
      var source = state.xmindCaseGen && typeof state.xmindCaseGen === 'object' ? state.xmindCaseGen : {};
      var next = createInitialXmindState({
        drawerOpen: source.viewState && source.viewState.drawerOpen === true,
        fullscreen: source.viewState && source.viewState.fullscreen === true,
      });
      Object.keys(source).forEach(function(key) {
        if (WORKSPACE_HOST_KEYS[key]) return;
        next[key] = cloneJson(source[key], source[key]);
      });
      return next;
    }

    function applyActiveXmindStateSnapshot(snapshot) {
      var next = createInitialXmindState({
        drawerOpen: snapshot && snapshot.viewState && snapshot.viewState.drawerOpen === true,
        fullscreen: snapshot && snapshot.viewState && snapshot.viewState.fullscreen === true,
      });
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      Object.keys(source).forEach(function(key) {
        if (WORKSPACE_HOST_KEYS[key]) return;
        next[key] = cloneJson(source[key], source[key]);
      });
      var host = state.xmindCaseGen && typeof state.xmindCaseGen === 'object' ? state.xmindCaseGen : {};
      Object.keys(host).forEach(function(key) {
        if (!WORKSPACE_HOST_KEYS[key]) return;
        next[key] = cloneJson(host[key], host[key]);
      });
      state.xmindCaseGen = next;
    }

    function buildCurrentSharedWorkspaceSnapshot() {
      var rawTextEl = document.getElementById('rawText');
      var caseTextEl = document.getElementById('caseText');
      var shadowBase = workspaceShadowDepth > 0 && shadowWorkspaceSharedState
        ? normalizeWorkspaceSharedState(shadowWorkspaceSharedState)
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
      var opts = options || {};
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
        if (!next.requirementLabelSource) {
          next.requirementLabelSource = previousRequirementLabelSource;
        }
      }
      var rawTextEl = document.getElementById('rawText');
      var fileNameEl = document.getElementById('fileName');
      var caseTextEl = document.getElementById('caseText');
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
      if (opts.silentDom === true) {
        shadowWorkspaceSharedState = cloneJson(next, {});
        return;
      }
      shadowWorkspaceSharedState = null;
      if (rawTextEl) rawTextEl.value = next.rawText || '';
      if (caseTextEl) caseTextEl.value = next.caseText || '';
      if (fileNameEl) {
        fileNameEl.textContent = next.lastRawImportName ? String(next.lastRawImportName || '') : '未选择文件';
      }
      if (manualImageInputEl) manualImageInputEl.value = '';
      var casesCoreApi = getCasesCoreApi();
      if (casesCoreApi && typeof casesCoreApi.renderImportedCaseList === 'function') {
        casesCoreApi.renderImportedCaseList();
      }
      if (casesCoreApi && typeof casesCoreApi.syncCaseTextWithImports === 'function') {
        casesCoreApi.syncCaseTextWithImports();
      }
      if (casesCoreApi && typeof casesCoreApi.resetImportedCaseView === 'function') {
        casesCoreApi.resetImportedCaseView();
      }
      syncCasesGenPageRender();
    }

    function createWorkspaceSnapshot(options) {
      var opts = options || {};
      return {
        xmind: createInitialXmindState({
          drawerOpen: opts.drawerOpen === true,
          fullscreen: opts.fullscreen === true,
        }),
        shared: createEmptyWorkspaceSharedState(),
      };
    }

    function normalizeWorkspaceSnapshot(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var xmindSnapshot = source.xmind && typeof source.xmind === 'object'
        ? cloneJson(source.xmind, createInitialXmindState())
        : createInitialXmindState();
      xmindSnapshot.knowledgeBase = normalizeKnowledgeBaseState(xmindSnapshot.knowledgeBase);
      if (!xmindSnapshot.dedupe || typeof xmindSnapshot.dedupe !== 'object') {
        xmindSnapshot.dedupe = createDefaultDedupeState();
      }
      xmindSnapshot.coverage = normalizeCoverageState(xmindSnapshot.coverage);
      if (!xmindSnapshot.viewState || typeof xmindSnapshot.viewState !== 'object') {
        xmindSnapshot.viewState = createDefaultViewState();
      }
      xmindSnapshot.viewState = normalizeStoredViewState(xmindSnapshot.viewState, {
        drawerOpen: xmindSnapshot.viewState.drawerOpen === true,
        fullscreen: xmindSnapshot.viewState.fullscreen === true,
      });
      return {
        xmind: xmindSnapshot,
        shared: normalizeWorkspaceSharedState(source.shared),
      };
    }

    function createWorkspaceRecord(id, options) {
      var opts = options || {};
      var now = Date.now();
      return {
        id: String(id || ''),
        seq: Number(opts.seq || 0) || 0,
        name: String(opts.name || ''),
        pendingOpenPrep: opts.pendingOpenPrep === true,
        updatedAt: now,
        createdAt: now,
        snapshot: normalizeWorkspaceSnapshot(opts.snapshot),
      };
    }

    function normalizeWorkspaceRecord(id, record) {
      var source = record && typeof record === 'object' ? record : {};
      var normalized = createWorkspaceRecord(id, {
        seq: source.seq,
        name: source.name,
        pendingOpenPrep: source.pendingOpenPrep === true,
        snapshot: source.snapshot,
      });
      normalized.updatedAt = Number(source.updatedAt || normalized.updatedAt);
      if (!Number.isFinite(normalized.updatedAt) || normalized.updatedAt <= 0) normalized.updatedAt = Date.now();
      normalized.createdAt = Number(source.createdAt || normalized.updatedAt);
      if (!Number.isFinite(normalized.createdAt) || normalized.createdAt <= 0) normalized.createdAt = normalized.updatedAt;
      return normalized;
    }

    function getWorkspaceHostState() {
      var host = state.xmindCaseGen && typeof state.xmindCaseGen === 'object' ? state.xmindCaseGen : {};
      if (!Array.isArray(host.workspaceOrder)) host.workspaceOrder = [];
      if (!host.workspaces || typeof host.workspaces !== 'object') host.workspaces = {};
      host.activeWorkspaceId = String(host.activeWorkspaceId || '');
      host.mirrorWorkspaceId = String(host.mirrorWorkspaceId || '');
      host.openButtonDotVisible = host.openButtonDotVisible === true;
      host.nextWorkspaceSeq = Number(host.nextWorkspaceSeq || 1);
      if (!Number.isFinite(host.nextWorkspaceSeq) || host.nextWorkspaceSeq < 1) host.nextWorkspaceSeq = 1;
      state.xmindCaseGen = host;
      return host;
    }

    function workspaceSnapshotHasContent(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var xmindPart = source.xmind && typeof source.xmind === 'object' ? source.xmind : {};
      var sharedPart = source.shared && typeof source.shared === 'object' ? source.shared : {};
      if (Array.isArray(sharedPart.caseGenModules) && sharedPart.caseGenModules.length) return true;
      if (sharedPart.caseGenResults && Object.keys(sharedPart.caseGenResults).length) return true;
      if (Array.isArray(sharedPart.importedCases) && sharedPart.importedCases.length) return true;
      if (String(sharedPart.rawText || '').trim()) return true;
      if (String(sharedPart.caseText || '').trim()) return true;
      if (String(sharedPart.requirementLabel || '').trim()) return true;
      if (xmindPart.prep && xmindPart.prep.completed === true) return true;
      if (Array.isArray(xmindPart.history) && xmindPart.history.length) return true;
      return false;
    }

    function workspaceSnapshotHasGeneratedContent(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var xmindPart = source.xmind && typeof source.xmind === 'object' ? source.xmind : {};
      var sharedPart = source.shared && typeof source.shared === 'object' ? source.shared : {};
      if (Array.isArray(sharedPart.caseGenModules) && sharedPart.caseGenModules.length) return true;
      if (sharedPart.caseGenResults && Object.keys(sharedPart.caseGenResults).length) return true;
      if (Array.isArray(xmindPart.history) && xmindPart.history.length) return true;
      return false;
    }

    function caseGenSettingsDifferFromDefault(settings) {
      var next = cloneCaseGenSettingsValue(settings);
      var defaults = createDefaultCaseGenSettings();
      return SHARED_WORKSPACE_CASEGEN_SETTING_KEYS.some(function(key) {
        return JSON.stringify(next[key]) !== JSON.stringify(defaults[key]);
      });
    }

    function workspaceSnapshotHasPrepDraft(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var xmindPart = source.xmind && typeof source.xmind === 'object' ? source.xmind : {};
      var sharedPart = source.shared && typeof source.shared === 'object' ? source.shared : {};
      var prep = xmindPart.prep && typeof xmindPart.prep === 'object' ? xmindPart.prep : {};
      if (String(prep.requirementMode || '').trim()) return true;
      if (String(prep.requirementSupplement || '').trim()) return true;
      if (String(prep.manualRequirementLabel || '').trim()) return true;
      if (Array.isArray(prep.manualRequirementBlocks) && prep.manualRequirementBlocks.length) return true;
      if (String(prep.caseImportMode || '').trim()) return true;
      if (prep.completed === true || prep.baseLocked === true) return true;
      if (caseGenSettingsDifferFromDefault(sharedPart.caseGenSettings)) return true;
      return false;
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
      if (prep.requirementMode === 'manual') {
        return getManualRequirementLabelText();
      }
      return getDocumentRequirementLabelText();
    }

    function currentActiveWorkspaceHasContent() {
      return workspaceSnapshotHasContent({
        xmind: extractActiveXmindStateSnapshot(),
        shared: buildCurrentSharedWorkspaceSnapshot(),
      });
    }

    function isDefaultWorkspaceRecordName(value) {
      var text = value === null || value === undefined ? '' : String(value || '').trim();
      if (!text) return true;
      return /^生成\d+$/u.test(text);
    }

    function buildDefaultWorkspaceRecordName(seq) {
      var value = Number(seq || 0);
      if (!Number.isFinite(value) || value <= 0) value = 1;
      return '生成' + String(value);
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

    function resetActiveWorkspaceRecordNameToDefault() {
      var host = ensureWorkspaceHostState();
      var activeId = String(host.activeWorkspaceId || '');
      if (!activeId || !host.workspaces[activeId]) return false;
      host.workspaces[activeId].name = buildDefaultWorkspaceRecordName(host.workspaces[activeId].seq);
      host.workspaces[activeId].updatedAt = Date.now();
      return true;
    }

    function resetActiveWorkspaceRecordSnapshotToInitial(drawerOpen, fullscreen) {
      var host = ensureWorkspaceHostState();
      var activeId = String(host.activeWorkspaceId || '');
      if (!activeId || !host.workspaces[activeId]) return false;
      host.workspaces[activeId].snapshot = createWorkspaceSnapshot({
        drawerOpen: drawerOpen === true,
        fullscreen: fullscreen === true,
      });
      host.workspaces[activeId].updatedAt = Date.now();
      return true;
    }

    function captureWorkspaceSnapshot(workspaceId) {
      var host = ensureWorkspaceHostState();
      var stableId = String(workspaceId || '');
      if (!stableId || !host.workspaces[stableId]) return null;
      if (stableId === String(host.activeWorkspaceId || '')) {
        syncSummaryDraftIntoState();
        host.workspaces[stableId].snapshot = createWorkspaceSnapshotFromCurrent();
        host.workspaces[stableId].updatedAt = Date.now();
      }
      return host.workspaces[stableId].snapshot || null;
    }

    function ensureWorkspaceHostState() {
      var host = getWorkspaceHostState();
      var order = Array.isArray(host.workspaceOrder) ? host.workspaceOrder.slice() : [];
      var nextWorkspaces = {};
      order.forEach(function(id) {
        var stableId = String(id || '').trim();
        if (!stableId) return;
        nextWorkspaces[stableId] = normalizeWorkspaceRecord(stableId, host.workspaces[stableId]);
      });
      Object.keys(host.workspaces || {}).forEach(function(id) {
        var stableId = String(id || '').trim();
        if (!stableId || nextWorkspaces[stableId]) return;
        nextWorkspaces[stableId] = normalizeWorkspaceRecord(stableId, host.workspaces[stableId]);
        order.push(stableId);
      });
      host.workspaceOrder = order.filter(function(id, idx) {
        return id && order.indexOf(id) === idx;
      });
      host.workspaces = nextWorkspaces;
      if (!host.activeWorkspaceId && host.workspaceOrder.length) {
        host.activeWorkspaceId = String(host.workspaceOrder[0] || '');
      }
      if (host.activeWorkspaceId && host.workspaceOrder.indexOf(host.activeWorkspaceId) === -1) {
        host.activeWorkspaceId = host.workspaceOrder[0] ? String(host.workspaceOrder[0] || '') : '';
      }
      if (!host.mirrorWorkspaceId && host.activeWorkspaceId) {
        host.mirrorWorkspaceId = String(host.activeWorkspaceId || '');
      }
      if (host.mirrorWorkspaceId && host.workspaceOrder.indexOf(host.mirrorWorkspaceId) === -1) {
        host.mirrorWorkspaceId = host.activeWorkspaceId
          ? String(host.activeWorkspaceId || '')
          : (host.workspaceOrder[0] ? String(host.workspaceOrder[0] || '') : '');
      }
      return host;
    }

    function getActiveWorkspaceId() {
      var host = ensureWorkspaceHostState();
      return String(host.activeWorkspaceId || '');
    }

    function getMirrorWorkspaceId() {
      var host = ensureWorkspaceHostState();
      if (host.mirrorWorkspaceId && host.workspaces && host.workspaces[host.mirrorWorkspaceId]) {
        return String(host.mirrorWorkspaceId || '');
      }
      if (host.activeWorkspaceId && host.workspaces && host.workspaces[host.activeWorkspaceId]) {
        return String(host.activeWorkspaceId || '');
      }
      return host.workspaceOrder.length ? String(host.workspaceOrder[0] || '') : '';
    }

    function getWorkspaceUiSelectedId() {
      if (isDrawerOpen()) return getActiveWorkspaceId();
      return getMirrorWorkspaceId();
    }

    function setMirrorWorkspaceSelection(workspaceId) {
      var host = ensureWorkspaceHostState();
      var stableId = String(workspaceId || '');
      if (!stableId || !host.workspaces[stableId]) {
        stableId = host.activeWorkspaceId
          ? String(host.activeWorkspaceId || '')
          : (host.workspaceOrder[0] ? String(host.workspaceOrder[0] || '') : '');
      }
      host.mirrorWorkspaceId = stableId;
      return stableId;
    }

    function getWorkspaceRecord(workspaceId) {
      var host = ensureWorkspaceHostState();
      var stableId = workspaceId ? String(workspaceId || '') : getActiveWorkspaceId();
      if (!stableId) return null;
      return host.workspaces && host.workspaces[stableId] ? host.workspaces[stableId] : null;
    }

    function ensureWorkspaceRecordFromCurrentContent(options) {
      var opts = options || {};
      var host = ensureWorkspaceHostState();
      if (host.activeWorkspaceId && host.workspaces[host.activeWorkspaceId]) return String(host.activeWorkspaceId || '');
      if (host.workspaceOrder.length > 0) return getActiveWorkspaceId();
      var currentSnapshot = createWorkspaceSnapshotFromCurrent({
        skipSummaryDraftSync: opts.skipSummaryDraftSync === true,
        skipViewStateCapture: opts.skipViewStateCapture === true,
        overrideViewState: opts.overrideViewState && typeof opts.overrideViewState === 'object'
          ? opts.overrideViewState
          : null,
      });
      if (!workspaceSnapshotHasContent(currentSnapshot)) return '';
      var seq = Number(host.nextWorkspaceSeq || 1);
      if (!Number.isFinite(seq) || seq < 1) seq = 1;
      var workspaceId = buildWorkspaceId(seq);
      host.nextWorkspaceSeq = seq + 1;
      host.workspaces[workspaceId] = createWorkspaceRecord(workspaceId, {
        seq: seq,
        name: deriveLiveWorkspaceRecordName(buildDefaultWorkspaceRecordName(seq)),
        pendingOpenPrep: false,
        snapshot: currentSnapshot,
      });
      host.workspaceOrder.push(workspaceId);
      host.activeWorkspaceId = workspaceId;
      host.mirrorWorkspaceId = workspaceId;
      return workspaceId;
    }

    function saveActiveWorkspaceSnapshot(options) {
      var opts = options || {};
      var host = ensureWorkspaceHostState();
      var activeId = String(host.activeWorkspaceId || '');
      if (!activeId || !host.workspaces[activeId]) {
        activeId = ensureWorkspaceRecordFromCurrentContent({
          skipSummaryDraftSync: opts.skipSummaryDraftSync === true,
          skipViewStateCapture: opts.skipViewStateCapture === true,
          overrideViewState: opts.overrideViewState && typeof opts.overrideViewState === 'object'
            ? opts.overrideViewState
            : null,
        });
        host = ensureWorkspaceHostState();
      }
      if (!activeId || !host.workspaces[activeId]) return false;
      if (opts.skipSummaryDraftSync !== true) {
        syncSummaryDraftIntoState();
      }
      var computedSnapshot = createWorkspaceSnapshotFromCurrent({
        skipSummaryDraftSync: true,
        skipViewStateCapture: opts.skipViewStateCapture === true,
        overrideViewState: opts.overrideViewState && typeof opts.overrideViewState === 'object'
          ? opts.overrideViewState
          : null,
      });
      var existingXmindSnapshot = host.workspaces[activeId].snapshot && host.workspaces[activeId].snapshot.xmind
        ? cloneJson(host.workspaces[activeId].snapshot.xmind, createInitialXmindState())
        : null;
      var existingSharedSnapshot = host.workspaces[activeId].snapshot && host.workspaces[activeId].snapshot.shared
        ? normalizeWorkspaceSharedState(host.workspaces[activeId].snapshot.shared)
        : null;
      var shouldPreserveExistingGeneratedShared = Boolean(
        opts.forceShared !== true
        && existingSharedSnapshot
        && (isPageSuspending() || (typeof document !== 'undefined' && document && document.visibilityState === 'hidden'))
        && workspaceSnapshotHasGeneratedContent({ shared: existingSharedSnapshot })
        && !workspaceSnapshotHasGeneratedContent({ shared: computedSnapshot.shared })
      );
      if (shouldPreserveExistingGeneratedShared) {
        computedSnapshot.shared = existingSharedSnapshot;
      }
      if (
        !shouldPreserveExistingGeneratedShared
        &&
        opts.forceShared !== true
        && isDrawerOpen() !== true
        && workspaceShadowDepth <= 0
        && host.workspaces[activeId].snapshot
      ) {
        computedSnapshot.shared = normalizeWorkspaceSharedState(host.workspaces[activeId].snapshot.shared);
      }
      if (opts.preserveExistingXmind === true && existingXmindSnapshot) {
        if (
          opts.overrideViewState
          && typeof opts.overrideViewState === 'object'
        ) {
          existingXmindSnapshot.viewState = normalizeStoredViewState(opts.overrideViewState, {
            drawerOpen: opts.overrideViewState.drawerOpen === true,
            fullscreen: opts.overrideViewState.fullscreen === true,
          });
        }
        computedSnapshot.xmind = existingXmindSnapshot;
      }
      host.workspaces[activeId].snapshot = computedSnapshot;
      if (opts.preserveRecordName !== true) {
        host.workspaces[activeId].name = deriveLiveWorkspaceRecordName(host.workspaces[activeId].name);
      }
      host.workspaces[activeId].updatedAt = Date.now();
      return true;
    }

    function hydrateWorkspaceSnapshot(workspaceId, options) {
      var opts = options || {};
      var host = ensureWorkspaceHostState();
      var stableId = String(workspaceId || '');
      var record = stableId && host.workspaces[stableId] ? host.workspaces[stableId] : null;
      if (!record) return false;
      var sharedSnapshot = normalizeWorkspaceSharedState(record.snapshot && record.snapshot.shared ? record.snapshot.shared : null);
      if (!sharedSnapshot.requirementLabel && !isDefaultWorkspaceRecordName(record.name)) {
        sharedSnapshot.requirementLabel = String(record.name || '').trim();
        if (!sharedSnapshot.requirementLabelSource) {
          sharedSnapshot.requirementLabelSource = 'workspace';
        }
      }
      host.activeWorkspaceId = stableId;
      host.mirrorWorkspaceId = stableId;
      applySharedWorkspaceSnapshot(sharedSnapshot);
      applyActiveXmindStateSnapshot(record.snapshot && record.snapshot.xmind ? record.snapshot.xmind : null);
      getWorkspaceHostState().activeWorkspaceId = stableId;
      getWorkspaceHostState().mirrorWorkspaceId = stableId;
      getWorkspaceHostState().workspaceOrder = host.workspaceOrder.slice();
      getWorkspaceHostState().workspaces = host.workspaces;
      getWorkspaceHostState().nextWorkspaceSeq = host.nextWorkspaceSeq;
      getWorkspaceHostState().openButtonDotVisible = host.openButtonDotVisible === true;
      if (Object.prototype.hasOwnProperty.call(opts, 'keepDrawerOpen')) {
        var keepDrawerOpen = opts.keepDrawerOpen === true;
        getViewState().drawerOpen = keepDrawerOpen;
        getViewState().fullscreen = keepDrawerOpen && drawerEl && drawerEl.classList
          ? drawerEl.classList.contains('xmind-drawer-fullscreen')
          : false;
      }
      syncInlineStatusFromState();
      syncKnowledgeBaseToolbarState();
      return true;
    }

    function buildWorkspaceDisplayName(record) {
      var snapshot = record && record.snapshot ? record.snapshot : {};
      var shared = snapshot && snapshot.shared && typeof snapshot.shared === 'object' ? snapshot.shared : {};
      var xmind = snapshot && snapshot.xmind && typeof snapshot.xmind === 'object' ? snapshot.xmind : {};
      var prep = xmind && xmind.prep && typeof xmind.prep === 'object' ? xmind.prep : {};
      var recordName = record && record.name ? String(record.name || '').trim() : '';
      var label = '';
      label = shared.requirementLabel ? String(shared.requirementLabel || '').trim() : '';
      if (label === '当前需求') label = '';
      if (!label && prep.requirementMode === 'manual') {
        label = prep.manualRequirementLabel ? String(prep.manualRequirementLabel || '').trim() : '';
      }
      if (!label && !isDefaultWorkspaceRecordName(recordName)) {
        label = recordName;
      }
      if (!label && shared.lastRawImportName) {
        label = normalizeRequirementLabelFromFileName(shared.lastRawImportName || '');
      }
      if (!label) label = recordName;
      if (!label) label = buildDefaultWorkspaceRecordName(record && record.seq);
      return label;
    }

    function resetRequirementPrepInputs() {
      var rawTextEl = document.getElementById('rawText');
      var fileNameEl = document.getElementById('fileName');
      var fileInputEl = document.getElementById('fileInput');
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
        updatedAt: Date.now(),
      };
      if (manualImageInputEl) manualImageInputEl.value = '';
    }

    function resetImportedCasePrepInputs() {
      var caseTextEl = document.getElementById('caseText');
      var caseFileInputEl = document.getElementById('caseFileInput');
      var casesCoreApi = getCasesCoreApi();
      if (caseTextEl) caseTextEl.value = '';
      if (caseFileInputEl) caseFileInputEl.value = '';
      state.importedCases = [];
      if (casesCoreApi && typeof casesCoreApi.renderImportedCaseList === 'function') {
        casesCoreApi.renderImportedCaseList();
      }
      if (casesCoreApi && typeof casesCoreApi.syncCaseTextWithImports === 'function') {
        casesCoreApi.syncCaseTextWithImports();
      }
      if (casesCoreApi && typeof casesCoreApi.resetImportedCaseView === 'function') {
        casesCoreApi.resetImportedCaseView();
      }
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
        } catch (err) {
          // ignore
        }
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
      var opts = options || {};
      if (hasAnyRunningGenerationOperation()) {
        if (opts.silentBlocked !== true) {
          notifyFloatingStatus('当前仍有生成任务进行中，请等待完成后再重置', 'warn', 5000);
        }
        return false;
      }
      var drawerOpen = isDrawerOpen();
      var fullscreen = drawerEl && drawerEl.classList
        ? drawerEl.classList.contains('xmind-drawer-fullscreen')
        : (getViewState().fullscreen === true);
      if (renderTimer) {
        clearTimeout(renderTimer);
        renderTimer = 0;
      }
      clearStoreValidationState(true);
      cleanupTopupHighlightPresentation();
      clearDrawerRestoreRetry('reset-xmind-state');
      clearDeleteHistoryStacks();
      var reusedSharedWorkflowReset = resetWorkflowStateForXmind(drawerOpen, fullscreen);
      if (manualImageInputEl) manualImageInputEl.value = '';
      if (drawerOpen) {
        destroyMind();
      }
      if (!reusedSharedWorkflowReset) {
        syncCasesGenPageRender();
      }
      updateSummary();
      if (opts.reopenPrepDialog === true) {
        openSummaryDialog(STEP_REQUIREMENT);
      } else {
        renderOpenedSummaryDialog();
      }
      if (drawerOpen) {
        render({ reason: opts.reason || 'reset-all', persist: false });
      }
      persistXmindState(true);
      if (opts.toastText) {
        notifySuccessToast(String(opts.toastText), opts.toastDurationMs || 3000);
      }
      return true;
    }

    function resetAfterStoreSuccess(options) {
      var opts = options || {};
      var activeWorkspaceId = getActiveWorkspaceId();
      var targetWorkspaceId = String(opts.workspaceId || activeWorkspaceId || '');
      var shouldCloseWorkspace = opts.closeWorkspace === true;
      var didReset = false;
      var didClose = false;
      var shouldResetCurrentWorkspace = !shouldCloseWorkspace && (!targetWorkspaceId || targetWorkspaceId === activeWorkspaceId);
      if (shouldResetCurrentWorkspace) {
        didReset = resetXmindCasegenState({
          reason: 'store-success-reset',
          reopenPrepDialog: false,
          toastText: '',
          silentBlocked: true,
        }) === true;
      }
      if (shouldCloseWorkspace && targetWorkspaceId) {
        didClose = deleteWorkspace(targetWorkspaceId, {
          skipConfirm: true,
        }) === true;
      }
      if (opts.showToast === true) {
        notifySuccessToast(
          String(opts.toastText || (didClose ? '入库并关闭页签成功' : '用例入库成功')),
          opts.toastDurationMs || (didClose ? 5000 : 3000)
        );
      }
      return didReset || didClose;
    }

    function getViewState() {
      return ensureState().viewState;
    }

    function buildViewStateNodeKey(meta, topic, fallbackPath) {
      var pathText = Array.isArray(fallbackPath) ? fallbackPath.join('>') : '';
      if (!meta || typeof meta !== 'object') {
        return pathText ? ('path::' + pathText) : ('topic::' + String(topic || ''));
      }
      if (meta.type === 'root') return 'root';
      if (meta.type === 'module') {
        return 'module::' + String(meta.moduleKey || normalizeModuleKey(meta.moduleTitle || topic || ''));
      }
      if (meta.type === 'case' || meta.type === 'priority' || meta.type === 'preconditions' || meta.type === 'steps' || meta.type === 'expected') {
        return [
          String(meta.type || 'node'),
          String(meta.moduleKey || normalizeModuleKey(meta.moduleTitle || '')),
          String(meta.caseSource || ''),
          String(Number(meta.caseSourceIndex)),
          String(meta.caseSignature || normalizeCaseTitle(meta.caseTitle || topic || ''))
        ].join('::');
      }
      if (meta.type === 'topup-placeholder') {
        return 'placeholder::' + String(meta.nodeId || meta.moduleKey || topic || '');
      }
      if (meta.nodeId) return 'nodeid::' + String(meta.nodeId);
      return pathText ? ('path::' + pathText) : ('topic::' + String(topic || ''));
    }

    function collectCollapsedNodeKeysFromMindData(nodeData) {
      var keys = [];
      function walk(node, path) {
        if (!node || typeof node !== 'object') return;
        var nextPath = Array.isArray(path) ? path.slice() : [];
        nextPath.push(String(node.topic || ''));
        var children = Array.isArray(node.children) ? node.children : [];
        if (children.length) {
          var expanded = node.expanded !== false;
          if (!expanded) {
            keys.push(buildViewStateNodeKey(node.xmindMeta || null, node.topic, nextPath));
          }
          children.forEach(function(child) {
            walk(child, nextPath);
          });
        }
      }
      walk(nodeData, []);
      return normalizeUniqueStringList(keys);
    }

    function buildCurrentMindDataSnapshot() {
      if (!mindInstance) return null;
      try {
        if (typeof mindInstance.getData === 'function') {
          var data = mindInstance.getData();
          if (data && data.nodeData) return cloneJson(data, null);
        }
      } catch (err) {}
      try {
        if (mindInstance.nodeData) return cloneJson({ nodeData: mindInstance.nodeData }, null);
      } catch (err2) {}
      return null;
    }

    function collectCollapsedNodeKeysFromMindDom() {
      var keys = [];
      if (!mindContainer || !mindContainer.querySelectorAll) return keys;
      var expanders = mindContainer.querySelectorAll('me-parent > me-epd');
      Array.prototype.forEach.call(expanders, function(expander) {
        if (!expander || !expander.classList || expander.classList.contains('minus')) return;
        var parent = expander.parentElement;
        var topicEl = parent && parent.querySelector ? parent.querySelector('me-tpc') : null;
        var nodeObj = topicEl && topicEl.nodeObj ? topicEl.nodeObj : null;
        if (!nodeObj) return;
        var meta = nodeObj.xmindMeta && typeof nodeObj.xmindMeta === 'object'
          ? nodeObj.xmindMeta
          : null;
        var path = [];
        var cursor = nodeObj;
        var guard = 0;
        while (cursor && guard < 64) {
          path.unshift(String(cursor.topic || ''));
          cursor = cursor.parent || null;
          guard += 1;
        }
        keys.push(buildViewStateNodeKey(meta, nodeObj.topic, path));
      });
      return normalizeUniqueStringList(keys);
    }

    function captureCurrentViewState() {
      var viewState = getViewState();
      if (workspaceShadowDepth > 0 || workspaceUiMutedDepth > 0) {
        viewState.updatedAt = Date.now();
        return cloneJson(viewState, createDefaultViewState());
      }
      var actualDrawerOpen = isDrawerOpen();
      var shouldPreserveRestoreIntent = actualDrawerOpen !== true
        && viewState.drawerOpen === true
        && String(state.activeTab || '') === 'casesgen';
      if (!shouldPreserveRestoreIntent) {
        viewState.drawerOpen = actualDrawerOpen;
      }
      if (!actualDrawerOpen || !mindInstance) {
        if (!shouldPreserveRestoreIntent) {
          viewState.fullscreen = drawerEl && drawerEl.classList
            ? drawerEl.classList.contains('xmind-drawer-fullscreen')
            : false;
        }
        viewState.updatedAt = Date.now();
        return cloneJson(viewState, createDefaultViewState());
      }
      var captured = mindInstance && typeof mindInstance.__tapCaptureViewState === 'function'
        ? mindInstance.__tapCaptureViewState()
        : null;
      var drawerState = mindInstance && typeof mindInstance.__tapCaptureDrawerState === 'function'
        ? mindInstance.__tapCaptureDrawerState()
        : null;
      var anchorState = captureVisibleMindAnchorStateFromDom();
      var mindData = buildCurrentMindDataSnapshot();
      viewState.fullscreen = drawerEl && drawerEl.classList
        ? drawerEl.classList.contains('xmind-drawer-fullscreen')
        : Boolean(drawerState && drawerState.fullscreen === true);
      viewState.transform = captured && captured.transform ? String(captured.transform || '') : '';
      viewState.scaleVal = captured && isFinite(Number(captured.scaleVal)) && Number(captured.scaleVal) > 0
        ? Number(captured.scaleVal)
        : 1;
      viewState.scrollLeft = captured && isFinite(Number(captured.scrollLeft)) && Number(captured.scrollLeft) >= 0
        ? Number(captured.scrollLeft)
        : 0;
      viewState.scrollTop = captured && isFinite(Number(captured.scrollTop)) && Number(captured.scrollTop) >= 0
        ? Number(captured.scrollTop)
        : 0;
      viewState.hasManualViewport = resolveCapturedManualViewportFlag(viewState.transform, viewState);
      viewState.anchorState = anchorState && anchorState.nodeId ? {
        nodeId: String(anchorState.nodeId || ''),
        centerX: Number(anchorState.centerX || 0),
        centerY: Number(anchorState.centerY || 0),
      } : null;
      var collapsedFromDom = collectCollapsedNodeKeysFromMindDom();
      viewState.collapsedNodeKeys = collapsedFromDom.length
        ? collapsedFromDom
        : (mindData && mindData.nodeData ? collectCollapsedNodeKeysFromMindData(mindData.nodeData) : []);
      viewState.treeSourceSignature = String(ensureState().treeSourceSignature || '');
      viewState.updatedAt = Date.now();
      return cloneJson(viewState, createDefaultViewState());
    }

    function captureVisibleMindViewStateFromDom(options) {
      var opts = options || {};
      if (!mindContainer || !mindInstance || !isDrawerOpen()) return null;
      var mapEl = mindContainer.querySelector ? mindContainer.querySelector('.map-canvas') : null;
      var canvasEl = mindContainer.querySelector ? mindContainer.querySelector('[data-mind-canvas]') : null;
      if (!mapEl || !mapEl.style || !canvasEl) return null;
      var transformText = String(mapEl.style.transform || '');
      if (!transformText) return null;
      var baseViewState = normalizeStoredViewState(opts.baseViewState);
      var anchorState = opts.includeAnchor === false
        ? (opts.preserveExistingAnchor !== false && baseViewState.anchorState && baseViewState.anchorState.nodeId
          ? cloneJson(baseViewState.anchorState, baseViewState.anchorState)
          : null)
        : captureVisibleMindAnchorStateFromDom();
      var next = cloneJson(baseViewState, createDefaultViewState()) || createDefaultViewState();
      next.drawerOpen = true;
      next.fullscreen = drawerEl && drawerEl.classList ? drawerEl.classList.contains('xmind-drawer-fullscreen') : false;
      next.transform = transformText;
      next.scaleVal = Number(mindInstance.scaleVal || 1);
      if (!Number.isFinite(next.scaleVal) || next.scaleVal <= 0) next.scaleVal = 1;
      next.scrollLeft = Number(canvasEl.scrollLeft || 0);
      next.scrollTop = Number(canvasEl.scrollTop || 0);
      next.hasManualViewport = resolveCapturedManualViewportFlag(transformText, next);
      next.anchorState = anchorState && anchorState.nodeId ? {
        nodeId: String(anchorState.nodeId || ''),
        centerX: Number(anchorState.centerX || 0),
        centerY: Number(anchorState.centerY || 0),
      } : null;
      next.collapsedNodeKeys = opts.includeCollapsed === false
        ? normalizeUniqueStringList(baseViewState.collapsedNodeKeys)
        : collectCollapsedNodeKeysFromMindDom();
      next.treeSourceSignature = String(ensureState().treeSourceSignature || '');
      next.updatedAt = Date.now();
      return next;
    }

    function captureSuspendFriendlyViewState() {
      var baseViewState = cloneJson(getViewState(), createDefaultViewState()) || createDefaultViewState();
      var drawerFullscreen = drawerEl && drawerEl.classList
        ? drawerEl.classList.contains('xmind-drawer-fullscreen')
        : (baseViewState.fullscreen === true);
      if (drawerFullscreen === true) {
        var lightView = cloneJson(baseViewState, createDefaultViewState()) || createDefaultViewState();
        lightView.drawerOpen = isDrawerOpen();
        lightView.fullscreen = false;
        lightView.transform = '';
        lightView.scaleVal = 1;
        lightView.scrollLeft = 0;
        lightView.scrollTop = 0;
        lightView.hasManualViewport = false;
        lightView.anchorState = null;
        lightView.collapsedNodeKeys = normalizeUniqueStringList(baseViewState.collapsedNodeKeys);
        lightView.treeSourceSignature = String(ensureState().treeSourceSignature || baseViewState.treeSourceSignature || '');
        lightView.updatedAt = Date.now();
        return normalizeStoredViewState(lightView, {
          drawerOpen: lightView.drawerOpen === true,
          fullscreen: false,
        });
      }
      var mindData = currentMindData || buildCurrentMindDataSnapshot();
      var nextView = captureVisibleMindViewStateFromDom({
        baseViewState: baseViewState,
        includeAnchor: false,
        includeCollapsed: false,
        preserveExistingAnchor: true,
      }) || baseViewState;
      if (!Array.isArray(nextView.collapsedNodeKeys) || !nextView.collapsedNodeKeys.length) {
        nextView.collapsedNodeKeys = mindData && mindData.nodeData
          ? collectCollapsedNodeKeysFromMindData(mindData.nodeData)
          : normalizeUniqueStringList(baseViewState.collapsedNodeKeys);
      }
      nextView.drawerOpen = isDrawerOpen();
      nextView.fullscreen = drawerEl && drawerEl.classList
        ? drawerEl.classList.contains('xmind-drawer-fullscreen')
        : (baseViewState.fullscreen === true);
      nextView.treeSourceSignature = String(ensureState().treeSourceSignature || baseViewState.treeSourceSignature || '');
      nextView.updatedAt = Date.now();
      return normalizeStoredViewState(nextView, {
        drawerOpen: nextView.drawerOpen === true,
        fullscreen: nextView.fullscreen === true,
      });
    }

    function persistDrawerClosedIntentState(useImmediate) {
      var nextView = captureVisibleMindViewStateFromDom()
        || cloneJson(getViewState(), createDefaultViewState())
        || createDefaultViewState();
      var now = Date.now();
      nextView.drawerOpen = false;
      nextView.fullscreen = false;
      nextView.updatedAt = now;
      state.xmindCaseGen.viewState = cloneJson(nextView, createDefaultViewState());
      getWorkspaceOrder().forEach(function(workspaceId) {
        var record = getWorkspaceRecord(workspaceId);
        if (!record) return;
        if (!record.snapshot || typeof record.snapshot !== 'object') {
          record.snapshot = createWorkspaceSnapshot();
        }
        if (!record.snapshot.xmind || typeof record.snapshot.xmind !== 'object') {
          record.snapshot.xmind = createInitialXmindState();
        }
        var baseView = normalizeStoredViewState(record.snapshot.xmind.viewState, {
          drawerOpen: false,
          fullscreen: false,
        });
        baseView.drawerOpen = false;
        baseView.fullscreen = false;
        baseView.updatedAt = now;
        record.snapshot.xmind.viewState = cloneJson(baseView, createDefaultViewState());
        record.updatedAt = now;
      });
      saveActiveWorkspaceSnapshot({
        preserveExistingXmind: true,
        preserveRecordName: true,
        skipSummaryDraftSync: true,
        skipViewStateCapture: true,
        overrideViewState: nextView,
      });
      if (useImmediate === true) {
        persistWorkflowStateNow();
        var manager = getXmindTaskManager();
        if (manager && typeof manager.updateTasksContext === 'function') {
          manager.updateTasksContext(function(nextContext) {
            var nextTaskViewState = normalizeStoredViewState(nextContext && nextContext.viewState, {
              drawerOpen: false,
              fullscreen: false,
            });
            nextTaskViewState.drawerOpen = false;
            nextTaskViewState.fullscreen = false;
            nextTaskViewState.updatedAt = now;
            nextContext.viewState = cloneJson(nextTaskViewState, createDefaultViewState());
          }, {
            action: 'context',
          });
        }
        syncRunningTaskRestoreContexts(getActiveWorkspaceId(), {
          viewState: nextView,
          replaceViewState: true,
        });
      } else persistWorkflowState();
    }

    function applyPendingSuspendViewStateCache() {
      var cached = readSuspendViewStateCache();
      if (!cached || typeof cached !== 'object') return false;
      var cachedViewState = cached.viewState && typeof cached.viewState === 'object'
        ? normalizeStoredViewState(cached.viewState, {
          drawerOpen: cached.viewState.drawerOpen === true,
          fullscreen: cached.viewState.fullscreen === true,
        })
        : null;
      if (!cachedViewState) {
        clearSuspendViewStateCache();
        return false;
      }
      if (cached.activeTab && String(cached.activeTab || '') !== 'casesgen') {
        clearSuspendViewStateCache();
        return false;
      }
      var host = ensureWorkspaceHostState();
      var targetWorkspaceId = String(cached.workspaceId || '');
      if (targetWorkspaceId && host.workspaces && host.workspaces[targetWorkspaceId]) {
        host.activeWorkspaceId = targetWorkspaceId;
        host.mirrorWorkspaceId = targetWorkspaceId;
      } else {
        targetWorkspaceId = String(host.activeWorkspaceId || '');
        host.mirrorWorkspaceId = targetWorkspaceId;
      }
      state.xmindCaseGen.viewState = cloneJson(cachedViewState, createDefaultViewState());
      if (targetWorkspaceId && host.workspaces && host.workspaces[targetWorkspaceId]) {
        var record = host.workspaces[targetWorkspaceId];
        if (!record.snapshot || typeof record.snapshot !== 'object') {
          record.snapshot = createWorkspaceSnapshot();
        }
        if (!record.snapshot.xmind || typeof record.snapshot.xmind !== 'object') {
          record.snapshot.xmind = createInitialXmindState();
        }
        record.snapshot.xmind.viewState = cloneJson(cachedViewState, createDefaultViewState());
        record.updatedAt = Date.now();
      }
      clearSuspendViewStateCache();
      return true;
    }

    function persistSuspendIntentStateNow() {
      var now = Date.now();
      if (pageSuspendPersistAt > 0 && now - pageSuspendPersistAt < 180) {
        return false;
      }
      pageSuspendPersistAt = now;
      if (viewStatePersistTimer) {
        clearTimeout(viewStatePersistTimer);
        viewStatePersistTimer = 0;
      }
      if (summaryDialogOpen === true) {
        syncSummaryDraftIntoState({ preserveCompleted: true });
      }
      var nextView = captureSuspendFriendlyViewState();
      state.xmindCaseGen.viewState = cloneJson(nextView, createDefaultViewState());
      var activeWorkspaceId = String(getActiveWorkspaceId() || '');
      var record = getWorkspaceRecord(activeWorkspaceId);
      if (record) {
        if (!record.snapshot || typeof record.snapshot !== 'object') {
          record.snapshot = createWorkspaceSnapshot();
        }
        if (!record.snapshot.xmind || typeof record.snapshot.xmind !== 'object') {
          record.snapshot.xmind = createInitialXmindState();
        }
        record.snapshot.xmind.viewState = cloneJson(nextView, createDefaultViewState());
        record.updatedAt = now;
      }
      writeSuspendViewStateCache({
        activeTab: String(state.activeTab || ''),
        workspaceId: activeWorkspaceId,
        viewState: cloneJson(nextView, createDefaultViewState()),
        updatedAt: now,
      });
      syncRunningTaskRestoreContexts(getActiveWorkspaceId(), {
        viewState: nextView,
        replaceViewState: true,
      });
      return true;
    }

    function bindDrawerCloseIntentPersistence() {
      if (drawerCloseIntentBound) return;
      if (!drawerEl || !drawerEl.querySelector) return;
      drawerCloseIntentBound = true;
      var closeBtn = document.getElementById('closeXmindCaseGenDrawerBtn');
      var maskEl = drawerEl.querySelector('.drawer-mask');
      function markClosingState(event) {
        if (drawerOpenedViaDomRestore === true) {
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
          if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
          if (event && typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
          close();
          return;
        }
        persistDrawerClosedIntentState(true);
      }
      if (closeBtn && closeBtn.addEventListener) {
        closeBtn.addEventListener('click', markClosingState, true);
      }
      if (maskEl && maskEl.addEventListener) {
        maskEl.addEventListener('click', markClosingState, true);
      }
    }

    function scheduleCaptureCurrentViewState(useImmediate) {
      if (viewStatePersistTimer) clearTimeout(viewStatePersistTimer);
      if (useImmediate === true) {
        captureCurrentViewState();
        persistXmindState(true);
        return;
      }
      viewStatePersistTimer = setTimeout(function() {
        viewStatePersistTimer = 0;
        captureCurrentViewState();
        persistXmindState(false);
      }, VIEW_STATE_CAPTURE_DEBOUNCE_MS);
    }

    function applyCurrentMindViewState(viewState) {
      var nextView = viewState && typeof viewState === 'object' ? viewState : null;
      if (!nextView || !nextView.transform || !mindInstance || !mindContainer) return false;
      var mapEl = mindContainer.querySelector ? mindContainer.querySelector('.map-canvas') : null;
      var canvasEl = mindContainer.querySelector ? mindContainer.querySelector('[data-mind-canvas]') : null;
      if (!mapEl || !mapEl.style || !canvasEl) return false;
      mapEl.style.transform = String(nextView.transform || '');
      canvasEl.scrollLeft = Number(nextView.scrollLeft || 0);
      canvasEl.scrollTop = Number(nextView.scrollTop || 0);
      var scaleVal = Number(nextView.scaleVal || 0);
      if (Number.isFinite(scaleVal) && scaleVal > 0) {
        mindInstance.scaleVal = scaleVal;
      }
      if (typeof mindInstance.__tapSyncZoomMinScale === 'function') {
        mindInstance.__tapSyncZoomMinScale();
      }
      if (typeof mindInstance.__tapSyncCtrlWheelMinScale === 'function') {
        mindInstance.__tapSyncCtrlWheelMinScale(true);
      }
      return true;
    }

    function parseMindTransformState(transformText) {
      var text = transformText === undefined || transformText === null ? '' : String(transformText);
      var translateMatch = text.match(/translate3d\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px\s*,\s*[^)]*\)/i);
      if (!translateMatch) {
        translateMatch = text.match(/translate\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px\s*\)/i);
      }
      var scaleMatch = text.match(/scale\(\s*(-?\d+(?:\.\d+)?)\s*\)/i);
      return {
        x: translateMatch ? Number(translateMatch[1] || 0) : 0,
        y: translateMatch ? Number(translateMatch[2] || 0) : 0,
        scale: scaleMatch ? Number(scaleMatch[1] || 1) : 1,
      };
    }

    function writeMindTransformState(mapEl, transformState) {
      if (!mapEl || !mapEl.style || !transformState) return false;
      var x = Number(transformState.x);
      var y = Number(transformState.y);
      var scale = Number(transformState.scale);
      if (!Number.isFinite(x)) x = 0;
      if (!Number.isFinite(y)) y = 0;
      if (!Number.isFinite(scale) || scale <= 0) scale = 1;
      mapEl.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0px) scale(' + scale + ')';
      return true;
    }

    function resolveMindAnchorElement(nodeEl) {
      if (!nodeEl) return null;
      if (nodeEl.querySelector) {
        var textEl = nodeEl.querySelector('.text');
        if (textEl && textEl.getBoundingClientRect) return textEl;
      }
      return nodeEl && nodeEl.getBoundingClientRect ? nodeEl : null;
    }

    function getMindAnchorStableNodeId(nodeEl) {
      if (!nodeEl) return '';
      if (nodeEl.getAttribute) {
        var attrNodeId = String(nodeEl.getAttribute('data-xmind-node-id') || '');
        if (attrNodeId) return attrNodeId;
      }
      if (!nodeEl.nodeObj) return '';
      var meta = nodeEl.nodeObj.xmindMeta && typeof nodeEl.nodeObj.xmindMeta === 'object'
        ? nodeEl.nodeObj.xmindMeta
        : null;
      if (meta && meta.nodeId) return String(meta.nodeId || '');
      if (nodeEl.nodeObj.id === undefined || nodeEl.nodeObj.id === null) return '';
      return String(nodeEl.nodeObj.id || '');
    }

    function captureVisibleMindAnchorStateFromDom() {
      if (!mindContainer || !isDrawerOpen()) return null;
      var viewerEl = mindContainer.querySelector
        ? (mindContainer.querySelector('.xmind-structure-viewer') || mindContainer)
        : mindContainer;
      if (!viewerEl || !viewerEl.getBoundingClientRect || !viewerEl.querySelectorAll) return null;
      var viewerRect = viewerEl.getBoundingClientRect();
      var viewerCenterX = Number(viewerRect.left + (viewerRect.width / 2));
      var viewerCenterY = Number(viewerRect.top + (viewerRect.height / 2));
      if (!isFinite(viewerCenterX) || !isFinite(viewerCenterY)) return null;
      var nodeEls = viewerEl.querySelectorAll('me-tpc');
      if (!nodeEls || !nodeEls.length) return null;
      var best = null;
      Array.prototype.forEach.call(nodeEls, function(nodeEl) {
        var stableNodeId = getMindAnchorStableNodeId(nodeEl);
        if (!stableNodeId) return;
        var anchorEl = resolveMindAnchorElement(nodeEl);
        if (!anchorEl || !anchorEl.getBoundingClientRect) return;
        var rect = anchorEl.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        var centerX = Number(rect.left + (rect.width / 2));
        var centerY = Number(rect.top + (rect.height / 2));
        if (!isFinite(centerX) || !isFinite(centerY)) return;
        var dx = centerX - viewerCenterX;
        var dy = centerY - viewerCenterY;
        var distance = Math.sqrt((dx * dx) + (dy * dy));
        if (!best || distance < best.distance) {
          best = {
            nodeId: stableNodeId,
            centerX: centerX,
            centerY: centerY,
            distance: distance,
          };
        }
      });
      if (!best || !best.nodeId) return null;
      return {
        nodeId: String(best.nodeId || ''),
        centerX: Number(best.centerX || 0),
        centerY: Number(best.centerY || 0),
      };
    }

    function applyCurrentMindAnchorState(anchorState) {
      var anchor = anchorState && typeof anchorState === 'object' ? anchorState : null;
      if (!anchor || !anchor.nodeId || !mindContainer) return false;
      var mapEl = mindContainer.querySelector ? mindContainer.querySelector('.map-canvas') : null;
      if (!mapEl || !mapEl.style) return false;
      var nodeEls = mindContainer.querySelectorAll ? mindContainer.querySelectorAll('me-tpc') : [];
      if (!nodeEls || !nodeEls.length) return false;
      var targetNode = null;
      Array.prototype.some.call(nodeEls, function(nodeEl) {
        if (!nodeEl || !nodeEl.nodeObj) return false;
        if (getMindAnchorStableNodeId(nodeEl) !== String(anchor.nodeId || '')) return false;
        targetNode = nodeEl;
        return true;
      });
      if (!targetNode) return false;
      var anchorEl = resolveMindAnchorElement(targetNode);
      if (!anchorEl || !anchorEl.getBoundingClientRect) return false;
      var rect = anchorEl.getBoundingClientRect();
      var currentCenterX = Number(rect.left + (rect.width / 2));
      var currentCenterY = Number(rect.top + (rect.height / 2));
      var desiredCenterX = Number(anchor.centerX);
      var desiredCenterY = Number(anchor.centerY);
      if (
        !Number.isFinite(currentCenterX)
        || !Number.isFinite(currentCenterY)
        || !Number.isFinite(desiredCenterX)
        || !Number.isFinite(desiredCenterY)
      ) {
        return false;
      }
      var deltaX = desiredCenterX - currentCenterX;
      var deltaY = desiredCenterY - currentCenterY;
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return true;
      var transformState = parseMindTransformState(mapEl.style.transform || '');
      transformState.x += deltaX;
      transformState.y += deltaY;
      return writeMindTransformState(mapEl, transformState);
    }

    function scheduleWorkspaceViewRestore(viewState, workspaceId) {
      var stableWorkspaceId = String(workspaceId || '');
      var restoreView = viewState && typeof viewState === 'object' ? {
        transform: String(viewState.transform || ''),
        scaleVal: Number(viewState.scaleVal || 1),
        scrollLeft: Number(viewState.scrollLeft || 0),
        scrollTop: Number(viewState.scrollTop || 0),
        skipAnchorAlign: viewState.skipAnchorAlign === true,
        anchorState: viewState.anchorState && viewState.anchorState.nodeId ? {
          nodeId: String(viewState.anchorState.nodeId || ''),
          centerX: Number(viewState.anchorState.centerX || 0),
          centerY: Number(viewState.anchorState.centerY || 0),
        } : null,
      } : null;
      workspaceViewRestoreToken += 1;
      rootCenterRequestToken += 1;
      var token = workspaceViewRestoreToken;
      if (!stableWorkspaceId || !restoreView || !restoreView.transform) return;
      var runRestore = function() {
        if (token !== workspaceViewRestoreToken) return;
        if (!isDrawerOpen()) return;
        if (stableWorkspaceId !== String(getActiveWorkspaceId() || '')) return;
        applyCurrentMindViewState(restoreView);
        if (restoreView.skipAnchorAlign !== true && restoreView.anchorState) {
          applyCurrentMindAnchorState(restoreView.anchorState);
        }
      };
      if (typeof window !== 'undefined' && window && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(function() {
          runRestore();
          window.requestAnimationFrame(function() {
            runRestore();
          });
        });
      }
      [0, 16, 48, 96, 180, 320].forEach(function(delayMs) {
        setTimeout(function() {
          runRestore();
        }, delayMs);
      });
    }

    function normalizeWorkspaceRenderViewState(viewState, options) {
      var source = viewState && typeof viewState === 'object' ? viewState : null;
      var opts = options || {};
      if (!source) return null;
      var transform = String(source.transform || '');
      if (!transform) return null;
      return {
        transform: transform,
        scaleVal: Number(source.scaleVal || 1),
        scrollLeft: Number(source.scrollLeft || 0),
        scrollTop: Number(source.scrollTop || 0),
        skipAnchorAlign: source.skipAnchorAlign === true || opts.skipAnchorAlign === true,
        anchorState: source.anchorState && source.anchorState.nodeId ? {
          nodeId: String(source.anchorState.nodeId || ''),
          centerX: Number(source.anchorState.centerX || 0),
          centerY: Number(source.anchorState.centerY || 0),
        } : null,
      };
    }

    function getWorkspaceStoredViewState(workspaceId) {
      var stableId = String(workspaceId || getActiveWorkspaceId() || '');
      if (!stableId) return normalizeStoredViewState(getViewState());
      var record = getWorkspaceRecord(stableId);
      if (
        record
        && record.snapshot
        && record.snapshot.xmind
        && record.snapshot.xmind.viewState
        && typeof record.snapshot.xmind.viewState === 'object'
      ) {
        return normalizeStoredViewState(record.snapshot.xmind.viewState);
      }
      if (stableId === String(getActiveWorkspaceId() || '')) {
        return normalizeStoredViewState(getViewState());
      }
      return createDefaultViewState();
    }

    function clearWorkspaceFullscreenRestoreIntent(workspaceId) {
      var stableId = String(workspaceId || getActiveWorkspaceId() || '');
      var storedView = getWorkspaceStoredViewState(stableId);
      var hadFullscreen = storedView && storedView.drawerOpen === true && storedView.fullscreen === true;
      if (!hadFullscreen) return false;
      storedView.fullscreen = false;
      storedView.updatedAt = Date.now();
      if (stableId === String(getActiveWorkspaceId() || '')) {
        state.xmindCaseGen.viewState = cloneJson(storedView, createDefaultViewState());
      }
      var record = getWorkspaceRecord(stableId);
      if (record) {
        if (!record.snapshot || typeof record.snapshot !== 'object') {
          record.snapshot = createWorkspaceSnapshot();
        }
        if (!record.snapshot.xmind || typeof record.snapshot.xmind !== 'object') {
          record.snapshot.xmind = createInitialXmindState();
        }
        record.snapshot.xmind.viewState = cloneJson(storedView, createDefaultViewState());
        record.updatedAt = Date.now();
      }
      return true;
    }

    function shouldRestoreWorkspaceViewport(workspaceId, viewState) {
      var source = viewState && typeof viewState === 'object'
        ? viewState
        : getWorkspaceStoredViewState(workspaceId);
      return shouldRestoreViewportForViewState(source);
    }

    function captureRenderCarryoverViewState() {
      var currentViewState = null;
      if (workspaceShadowDepth > 0) {
        currentViewState = getViewState();
      } else if (isDrawerOpen() && mindInstance) {
        currentViewState = captureCurrentViewState();
      } else {
        currentViewState = getViewState();
      }
      return normalizeWorkspaceRenderViewState(currentViewState);
    }

    function renderWithViewportCarryover(options) {
      var opts = options && typeof options === 'object' ? options : {};
      var nextOptions = {};
      Object.keys(opts).forEach(function(key) {
        nextOptions[key] = opts[key];
      });
      var restoreViewState = normalizeWorkspaceRenderViewState(nextOptions.restoreViewState)
        || captureRenderCarryoverViewState();
      if (restoreViewState) {
        nextOptions.restoreViewState = restoreViewState;
        if (nextOptions.restoreViewStateAfterRender !== false) {
          nextOptions.restoreViewStateAfterRender = true;
        }
      }
      return render(nextOptions);
    }

    function normalizeQueuedMindRenderMode(mode) {
      var name = String(mode || '').toLowerCase();
      if (name === 'terminal') return 'terminal';
      if (name === 'structure') return 'structure';
      return 'status';
    }

    function getQueuedMindRenderPriority(mode) {
      if (mode === 'terminal') return 2;
      if (mode === 'structure') return 1;
      return 0;
    }

    function cloneRenderOptionsForQueue(options) {
      var source = options && typeof options === 'object' ? options : {};
      var copy = {};
      Object.keys(source).forEach(function(key) {
        copy[key] = source[key];
      });
      return copy;
    }

    function mergeQueuedMindRenderOptions(prevOptions, nextOptions) {
      var prev = prevOptions && typeof prevOptions === 'object' ? prevOptions : {};
      var next = nextOptions && typeof nextOptions === 'object' ? nextOptions : {};
      var merged = cloneRenderOptionsForQueue(prev);
      Object.keys(next).forEach(function(key) {
        if (key === 'persist') {
          if (next.persist === false || prev.persist === false) merged.persist = false;
          else if (next.persist === true) merged.persist = true;
          return;
        }
        if (key === 'anchorNodeId') {
          if (next.anchorNodeId || !merged.anchorNodeId) merged.anchorNodeId = next.anchorNodeId;
          return;
        }
        if (key === 'centerRootAfterRender' || key === 'restoreViewStateAfterRender' || key === 'skipRestorableViewState') {
          merged[key] = next[key] === true || merged[key] === true;
          return;
        }
        merged[key] = next[key];
      });
      if (prev.reason && next.reason && prev.reason !== next.reason) {
        merged.reason = String(next.reason || '') + '+batched';
      }
      return merged;
    }

    function buildRenderedMindNodeMap() {
      var map = {};
      if (!mindContainer || !mindContainer.querySelectorAll) return map;
      var nodes = mindContainer.querySelectorAll('[data-xmind-node-id]');
      for (var i = 0; i < nodes.length; i += 1) {
        var nodeEl = nodes[i];
        var stableId = nodeEl && nodeEl.getAttribute
          ? String(nodeEl.getAttribute('data-xmind-node-id') || '')
          : '';
        if (stableId && !map[stableId]) map[stableId] = nodeEl;
      }
      return map;
    }

    function findRenderedMindNodeByStableId(nodeId, nodeMap) {
      var stableId = String(nodeId || '');
      if (!stableId) return null;
      if (nodeMap && Object.prototype.hasOwnProperty.call(nodeMap, stableId)) {
        return nodeMap[stableId] || null;
      }
      if (!mindContainer || !mindContainer.querySelectorAll) return null;
      var nodes = mindContainer.querySelectorAll('[data-xmind-node-id]');
      for (var i = 0; i < nodes.length; i += 1) {
        var nodeEl = nodes[i];
        if (nodeEl && nodeEl.getAttribute && String(nodeEl.getAttribute('data-xmind-node-id') || '') === stableId) {
          return nodeEl;
        }
      }
      return null;
    }

    function syncRenderedMindNodeStatus(nodeId, status, statusLabel, statusText, nodeMap) {
      var nodeEl = findRenderedMindNodeByStableId(nodeId, nodeMap);
      if (!nodeEl || !nodeEl.classList) return false;
      var existing = nodeEl.querySelector ? nodeEl.querySelector('.xmind-node-status-badge') : null;
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      nodeEl.classList.remove('xmind-casegen-node-has-status');
      if (!status) return true;

      nodeEl.classList.add('xmind-casegen-node-has-status');
      var badge = document.createElement('span');
      badge.className = 'xmind-node-status-badge ' + (status === 'running' ? 'is-running' : 'is-error');
      if (status === 'running') {
        var spinner = document.createElement('span');
        spinner.className = 'xmind-node-status-spinner';
        badge.appendChild(spinner);
      }
      var textSpan = document.createElement('span');
      textSpan.textContent = statusLabel
        ? String(statusLabel || '')
        : (status === 'running' ? '生成中' : '失败');
      if (status !== 'running' && statusText) badge.title = String(statusText || '');
      badge.appendChild(textSpan);
      nodeEl.appendChild(badge);
      return true;
    }

    function syncRenderedMindStatusBadges() {
      if (!mindContainer || !mindInstance || !isDrawerOpen()) return;
      var nodeMap = buildRenderedMindNodeMap();
      var rootState = ensureRootUiState();
      syncRenderedMindNodeStatus(
        getRootNodeId(),
        rootState.running ? 'running' : (rootState.status === 'error' ? 'error' : ''),
        rootState.running && rootState.lastAction === DEDUPE_ACTION_ID ? '去重中' : '',
        rootState.error || '',
        nodeMap
      );

      var context = ensureVisibleModuleContext(buildVisibleModuleContext());
      context.list.forEach(function(entry) {
        if (!entry || !entry.aiModuleId) return;
        var moduleState = ensureModuleUiState(entry.aiModuleId);
        syncRenderedMindNodeStatus(
          getModuleNodeId(entry),
          moduleState && moduleState.running && moduleState.rootPendingActionId !== ROOT_ACTIONS.EXISTING_CASES
            ? 'running'
            : (moduleState && moduleState.status === 'error' ? 'error' : ''),
          '',
          moduleState && moduleState.error ? moduleState.error : '',
          nodeMap
        );
      });
    }

    function flushLightweightMindStatus() {
      try {
        syncInterruptButton();
        renderWorkspaceTabs();
        syncInlineToolbarOverview();
        syncRenderedMindStatusBadges();
      } catch (err) {
        // ignore status-only rendering failures
      }
    }

    function captureMindSearchStateForRender() {
      if (!mindContainer || !mindContainer.querySelector) return null;
      var input = mindContainer.querySelector('[data-mind-search-input]');
      if (!input) return null;
      var value = String(input.value || '');
      var active = false;
      try {
        active = Boolean(document && document.activeElement === input);
      } catch (err) {
        active = false;
      }
      if (!value && !active) return null;
      var start = typeof input.selectionStart === 'number' ? Number(input.selectionStart) : NaN;
      var end = typeof input.selectionEnd === 'number' ? Number(input.selectionEnd) : NaN;
      return {
        value: value,
        active: active,
        start: Number.isFinite(start) ? start : NaN,
        end: Number.isFinite(end) ? end : NaN,
      };
    }

    function dispatchMindSearchInputEvent(input) {
      if (!input) return;
      try {
        var eventObj = new Event('input', { bubbles: true });
        input.dispatchEvent(eventObj);
      } catch (err) {
        try {
          var legacyEvent = document.createEvent('Event');
          legacyEvent.initEvent('input', true, false);
          input.dispatchEvent(legacyEvent);
        } catch (err2) {
          // ignore
        }
      }
    }

    function applyMindSearchStateToInput(searchState, options) {
      if (!searchState || !mindContainer || !mindContainer.querySelector) return false;
      var input = mindContainer.querySelector('[data-mind-search-input]');
      if (!input) return false;
      var opts = options && typeof options === 'object' ? options : {};
      var value = String(searchState.value || '');
      if (opts.setValue !== false) {
        input.value = value;
      } else if (String(input.value || '') !== value) {
        return false;
      }
      dispatchMindSearchInputEvent(input);
      if (searchState.active === true && typeof input.focus === 'function') {
        try {
          input.focus({ preventScroll: true });
        } catch (focusErr) {
          try {
            input.focus();
          } catch (focusErr2) {
            // ignore
          }
        }
      }
      if (typeof input.setSelectionRange === 'function') {
        var length = String(input.value || '').length;
        var start = Number.isFinite(Number(searchState.start)) ? Number(searchState.start) : length;
        var end = Number.isFinite(Number(searchState.end)) ? Number(searchState.end) : start;
        if (start < 0) start = 0;
        if (end < 0) end = 0;
        if (start > length) start = length;
        if (end > length) end = length;
        try {
          input.setSelectionRange(start, end);
        } catch (rangeErr) {
          // ignore
        }
      }
      return true;
    }

    function restoreMindSearchStateAfterRender(searchState) {
      if (!applyMindSearchStateToInput(searchState, { setValue: true })) return;
      [32, 120, 260].forEach(function(delayMs) {
        setTimeout(function() {
          applyMindSearchStateToInput(searchState, { setValue: false });
        }, delayMs);
      });
    }

    function clearQueuedMindRenderTimers() {
      if (queuedMindRenderTimer) {
        clearTimeout(queuedMindRenderTimer);
        queuedMindRenderTimer = 0;
      }
      if (queuedMindRenderDeadlineTimer) {
        clearTimeout(queuedMindRenderDeadlineTimer);
        queuedMindRenderDeadlineTimer = 0;
      }
    }

    function armQueuedMindRenderTimers(delayMs) {
      var waitMs = Number(delayMs || 0);
      if (!Number.isFinite(waitMs) || waitMs < 0) waitMs = MIND_RENDER_QUEUE_DEBOUNCE_MS;
      if (queuedMindRenderTimer) clearTimeout(queuedMindRenderTimer);
      queuedMindRenderTimer = setTimeout(flushQueuedMindRender, waitMs);
      if (!queuedMindRenderDeadlineTimer) {
        queuedMindRenderDeadlineTimer = setTimeout(flushQueuedMindRender, MIND_RENDER_QUEUE_MAX_WAIT_MS);
      }
    }

    function flushQueuedMindRender() {
      var queued = queuedMindRender;
      queuedMindRender = null;
      clearQueuedMindRenderTimers();
      if (!queued) return;
      if (workspaceShadowDepth > 0) {
        queuedMindRender = queued;
        armQueuedMindRenderTimers(MIND_RENDER_QUEUE_DEBOUNCE_MS);
        return;
      }

      var mode = normalizeQueuedMindRenderMode(queued.mode);
      if (mode === 'status') {
        flushLightweightMindStatus();
        return;
      }

      if (viewStatePersistTimer) {
        clearTimeout(viewStatePersistTimer);
        viewStatePersistTimer = 0;
        if (isDrawerOpen() && mindInstance) {
          captureCurrentViewState();
        }
      }

      var options = queued.options || {};
      if (mode === 'terminal') renderWithViewportCarryover(options);
      else render(options);
    }

    function scheduleQueuedMindRender(mode, options) {
      var nextMode = normalizeQueuedMindRenderMode(mode);
      var nextOptions = cloneRenderOptionsForQueue(options);
      var currentMode = queuedMindRender ? normalizeQueuedMindRenderMode(queuedMindRender.mode) : '';
      var selectedMode = getQueuedMindRenderPriority(nextMode) >= getQueuedMindRenderPriority(currentMode)
        ? nextMode
        : currentMode;
      queuedMindRender = {
        mode: selectedMode,
        options: mergeQueuedMindRenderOptions(queuedMindRender ? queuedMindRender.options : null, nextOptions),
      };
      armQueuedMindRenderTimers(MIND_RENDER_QUEUE_DEBOUNCE_MS);
    }

    function queueTerminalMindRender(options) {
      if (!isDrawerOpen()) return;
      scheduleQueuedMindRender('terminal', options || {});
    }

    function queueStructureMindRender(options) {
      scheduleQueuedMindRender('structure', options || {});
    }

    function queueStatusMindRender(options) {
      scheduleQueuedMindRender('status', options || {});
    }

    function getRestorableViewState(treeSignature) {
      var viewState = normalizeStoredViewState(getViewState());
      if (viewState.drawerOpen !== true) return null;
      if (!viewState.transform || viewState.hasManualViewport !== true) return null;
      if (String(viewState.treeSourceSignature || '') !== String(treeSignature || '')) return null;
      return {
        transform: String(viewState.transform || ''),
        scaleVal: Number(viewState.scaleVal || 1),
        scrollLeft: Number(viewState.scrollLeft || 0),
        scrollTop: Number(viewState.scrollTop || 0),
        skipAnchorAlign: true,
        anchorState: viewState.anchorState && viewState.anchorState.nodeId ? {
          nodeId: String(viewState.anchorState.nodeId || ''),
          centerX: Number(viewState.anchorState.centerX || 0),
          centerY: Number(viewState.anchorState.centerY || 0),
        } : null,
      };
    }

    function getRestorableDrawerState(treeSignature) {
      var viewState = getViewState();
      if (viewState.drawerOpen !== true) return null;
      if (treeSignature && String(viewState.treeSourceSignature || '') !== String(treeSignature || '')) return null;
      return {
        fullscreen: viewState.fullscreen === true,
      };
    }

    function getCollapsedNodeKeyMap() {
      var viewState = getViewState();
      var map = Object.create(null);
      (Array.isArray(viewState.collapsedNodeKeys) ? viewState.collapsedNodeKeys : []).forEach(function(item) {
        var key = String(item || '').trim();
        if (!key) return;
        map[key] = true;
      });
      return map;
    }

    function bindLiveViewStateCapture() {
      cleanupViewStateBindings();
      if (!mindContainer || !mindInstance || !isDrawerOpen()) return;
      viewStateInteractionTarget = mindContainer;
      viewStateLastObservedTransform = '';
      viewStateClickHandler = function() {
        scheduleCaptureCurrentViewState(false);
      };
      viewStateWheelHandler = function() {
        scheduleCaptureCurrentViewState(false);
      };
      viewStatePointerDownHandler = function(event) {
        beginManualViewportGestureTracking(event);
      };
      viewStatePointerUpHandler = function() {
        finishManualViewportGestureTracking();
      };
      viewStatePointerCancelHandler = function() {
        cancelManualViewportGestureTracking();
      };
      mindContainer.addEventListener('click', viewStateClickHandler, true);
      mindContainer.addEventListener('wheel', viewStateWheelHandler, true);
      mindContainer.addEventListener('pointerdown', viewStatePointerDownHandler, true);
      mindContainer.addEventListener('mousedown', viewStatePointerDownHandler, true);
      if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') {
        window.addEventListener('pointerup', viewStatePointerUpHandler, true);
        window.addEventListener('mouseup', viewStatePointerUpHandler, true);
        window.addEventListener('pointercancel', viewStatePointerCancelHandler, true);
        window.addEventListener('blur', viewStatePointerCancelHandler, true);
      }
      var mapEl = mindContainer.querySelector ? mindContainer.querySelector('.map-canvas') : null;
      var canvasEl = mindContainer.querySelector ? mindContainer.querySelector('[data-mind-canvas]') : null;
      if (mapEl && mapEl.style) {
        viewStateLastObservedTransform = String(mapEl.style.transform || '');
      }
      if (canvasEl) {
        viewStateScrollTarget = canvasEl;
        viewStateScrollHandler = function() {
          scheduleCaptureCurrentViewState(false);
        };
        canvasEl.addEventListener('scroll', viewStateScrollHandler, { passive: true });
      }
      if (typeof MutationObserver !== 'undefined' && (mapEl || drawerEl)) {
        viewStateMutationObserver = new MutationObserver(function(mutations) {
          var shouldPersist = false;
          var nextTransform = mapEl && mapEl.style ? String(mapEl.style.transform || '') : '';
          (mutations || []).some(function(mutation) {
            var target = mutation && mutation.target ? mutation.target : null;
            if (!target) return false;
            if (target === drawerEl || target === mapEl) {
              shouldPersist = true;
              return true;
            }
            if (target.closest && target.closest('[data-mind-canvas]')) {
              shouldPersist = true;
              return true;
            }
            return false;
          });
          if (mapEl && nextTransform !== viewStateLastObservedTransform) {
            if (hasPendingManualViewportGesture()) {
              viewStateManualGestureDetected = true;
            }
            viewStateLastObservedTransform = nextTransform;
          }
          if (shouldPersist) scheduleCaptureCurrentViewState(false);
        });
        try {
          if (mapEl) {
            viewStateMutationObserver.observe(mapEl, {
              attributes: true,
              attributeFilter: ['style'],
              childList: true,
              subtree: true,
            });
          }
          if (drawerEl) {
            viewStateMutationObserver.observe(drawerEl, {
              attributes: true,
              attributeFilter: ['class'],
            });
          }
        } catch (err) {
          if (viewStateMutationObserver) {
            viewStateMutationObserver.disconnect();
            viewStateMutationObserver = null;
          }
        }
      }
      captureCurrentViewState();
      scheduleCaptureCurrentViewState(false);
    }

    function persistViewportActionViewState() {
      setTimeout(function() {
        if (!isDrawerOpen() || !mindInstance) return;
        captureCurrentViewState();
        persistXmindState(true);
      }, 0);
    }

    function centerRootNodeView(options) {
      var opts = options || {};
      var retryLimit = Number(opts.retryLimit);
      var retryDelayMs = Number(opts.retryDelayMs);
      if (!Number.isFinite(retryLimit) || retryLimit < 1) retryLimit = 6;
      if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) retryDelayMs = 80;
      var shouldPersist = opts.persist !== false;
      var targetMindInstance = mindInstance;
      var requestToken = rootCenterRequestToken + 1;
      rootCenterRequestToken = requestToken;

      function centerRootNodeElementFallback() {
        if (!mindContainer || !mindContainer.querySelector) return false;
        var viewerEl = mindContainer.querySelector('.xmind-structure-viewer') || mindContainer;
        var mapEl = mindContainer.querySelector('.map-canvas');
        var rootTextEl = mindContainer.querySelector('me-tpc.xmind-casegen-node-root .text');
        if (
          !viewerEl || !viewerEl.getBoundingClientRect
          || !mapEl || !mapEl.style
          || !rootTextEl || !rootTextEl.getBoundingClientRect
        ) {
          return false;
        }
        var viewerRect = viewerEl.getBoundingClientRect();
        var nodeRect = rootTextEl.getBoundingClientRect();
        var currentCenterX = Number(nodeRect.left + (nodeRect.width / 2));
        var currentCenterY = Number(nodeRect.top + (nodeRect.height / 2));
        var desiredCenterX = Number(viewerRect.left + (viewerRect.width / 2));
        var desiredCenterY = Number(viewerRect.top + (viewerRect.height / 2));
        if (!isFinite(currentCenterX) || !isFinite(currentCenterY) || !isFinite(desiredCenterX) || !isFinite(desiredCenterY)) {
          return false;
        }
        var deltaX = desiredCenterX - currentCenterX;
        var deltaY = desiredCenterY - currentCenterY;
        if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return true;
        var currentTransform = String(mapEl.style.transform || '');
        var translateMatch = currentTransform.match(/translate3d\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px\s*,\s*[^)]*\)/i);
        if (!translateMatch) {
          translateMatch = currentTransform.match(/translate\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px\s*\)/i);
        }
        var scaleMatch = currentTransform.match(/scale\(\s*(-?\d+(?:\.\d+)?)\s*\)/i);
        var nextX = translateMatch ? Number(translateMatch[1] || 0) : 0;
        var nextY = translateMatch ? Number(translateMatch[2] || 0) : 0;
        var nextScale = scaleMatch ? Number(scaleMatch[1] || 1) : 1;
        if (!isFinite(nextX)) nextX = 0;
        if (!isFinite(nextY)) nextY = 0;
        if (!isFinite(nextScale) || nextScale <= 0) nextScale = 1;
        mapEl.style.transform = 'translate3d(' + (nextX + deltaX) + 'px, ' + (nextY + deltaY) + 'px, 0px) scale(' + nextScale + ')';
        return true;
      }

      function attempt(runIndex) {
        if (requestToken !== rootCenterRequestToken) return;
        if (!targetMindInstance || targetMindInstance !== mindInstance) return;
        if (!isDrawerOpen()) return;
        if (runIndex > 0 && targetMindInstance.__tapViewportInteracted === true) return;
        var mindElixirCoreApi = getMindElixirCoreApi();
        var centered = false;
        if (targetMindInstance && mindElixirCoreApi && typeof mindElixirCoreApi.centerMindNode === 'function') {
          try {
            centered = mindElixirCoreApi.centerMindNode(targetMindInstance, getRootNodeId()) === true;
          } catch (err) {
            centered = false;
          }
        }
        if (!centered) centered = centerRootNodeElementFallback();
        if (centered) {
          if (shouldPersist) persistViewportActionViewState();
        }
      }

      var delayMs = 0;
      for (var i = 0; i < retryLimit; i += 1) {
        (function(runDelay, runIndex) {
          setTimeout(function() {
            attempt(runIndex);
          }, runDelay);
        }(delayMs, i));
        if (i === 0) {
          delayMs += retryDelayMs;
        } else {
          delayMs += Math.max(retryDelayMs, Math.round(retryDelayMs * Math.pow(1.35, i)));
        }
      }
    }

    function bindViewStatePersistenceLifecycle() {
      if (viewStateBeforeUnloadBound) return;
      viewStateBeforeUnloadBound = true;
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('beforeunload', function() {
          markPageSuspending(true);
          if (!isDrawerOpen()) return;
          persistSuspendIntentStateNow();
        }, true);
        window.addEventListener('pagehide', function() {
          markPageSuspending(true);
          if (!isDrawerOpen()) return;
          persistSuspendIntentStateNow();
        }, true);
      }
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', function() {
          if (!document) return;
          if (document.visibilityState === 'visible') {
            markPageSuspending(false);
            pageSuspendPersistAt = 0;
            return;
          }
          if (document.visibilityState !== 'hidden') return;
          markPageSuspending(true);
          if (!isDrawerOpen()) return;
          persistSuspendIntentStateNow();
        }, true);
      }
    }

    function buildDeleteHistorySnapshotPayload() {
      return {
        caseGenModules: cloneJson(state.caseGenModules, []),
        caseGenResults: cloneJson(state.caseGenResults, {}),
        caseSelections: cloneSelectionMap(state.caseSelections),
        caseGenSuggestions: cloneJson(state.caseGenSuggestions, {}),
        caseGenModuleStatus: cloneJson(state.caseGenModuleStatus, {}),
        caseGenProgress: cloneJson(state.caseGenProgress, {}),
        caseGenTiming: cloneJson(state.caseGenTiming, {}),
        caseGenSource: String(state.caseGenSource || ''),
        deletedBaselineModuleKeys: cloneJson(ensureState().deletedBaselineModuleKeys, []),
        deletedBaselineCaseKeys: cloneJson(ensureState().deletedBaselineCaseKeys, []),
      };
    }

    function hasDeleteUndoHistory() {
      return Array.isArray(ensureState().deleteUndoStack) && ensureState().deleteUndoStack.length > 0;
    }

    function hasDeleteRedoHistory() {
      return Array.isArray(ensureState().deleteRedoStack) && ensureState().deleteRedoStack.length > 0;
    }

    function syncDeleteHistoryButtons() {
      if (deleteUndoBtn) {
        deleteUndoBtn.disabled = !hasDeleteUndoHistory();
        deleteUndoBtn.title = hasDeleteUndoHistory()
          ? '撤回最近一次删除（Ctrl/Cmd+Z）'
          : '暂无可撤回的删除';
      }
      if (deleteRedoBtn) {
        deleteRedoBtn.disabled = !hasDeleteRedoHistory();
        deleteRedoBtn.title = hasDeleteRedoHistory()
          ? '恢复最近一次撤回的删除（Ctrl/Cmd+Shift+Z）'
          : '暂无可恢复的删除';
      }
      syncInterruptButton();
    }

    function clearDeleteHistoryStacks() {
      var xmindState = ensureState();
      var hadHistory = (xmindState.deleteUndoStack && xmindState.deleteUndoStack.length)
        || (xmindState.deleteRedoStack && xmindState.deleteRedoStack.length);
      xmindState.deleteUndoStack = [];
      xmindState.deleteRedoStack = [];
      syncDeleteHistoryButtons();
      return Boolean(hadHistory);
    }

    function pushDeleteHistoryEntry(plan, beforeSnapshot, afterSnapshot) {
      var xmindState = ensureState();
      var entry = {
        id: generateLocalId('xmind-delete'),
        summaryText: buildDeleteSummaryText(plan),
        moduleCount: Array.isArray(plan && plan.modules) ? plan.modules.length : 0,
        caseCount: Array.isArray(plan && plan.cases) ? plan.cases.length : 0,
        before: cloneJson(beforeSnapshot, null),
        after: cloneJson(afterSnapshot, null),
        createdAt: Date.now(),
      };
      xmindState.deleteUndoStack = Array.isArray(xmindState.deleteUndoStack) ? xmindState.deleteUndoStack : [];
      xmindState.deleteRedoStack = [];
      xmindState.deleteUndoStack.push(entry);
      if (xmindState.deleteUndoStack.length > HISTORY_LIMIT) {
        xmindState.deleteUndoStack = xmindState.deleteUndoStack.slice(xmindState.deleteUndoStack.length - HISTORY_LIMIT);
      }
      syncDeleteHistoryButtons();
      return entry;
    }

    function applyDeleteHistorySnapshot(snapshot, actionId) {
      if (!snapshot || typeof snapshot !== 'object') return false;
      state.caseGenModules = cloneJson(snapshot.caseGenModules, []);
      state.caseGenResults = cloneJson(snapshot.caseGenResults, {});
      state.caseSelections = restoreSelectionMap(snapshot.caseSelections);
      state.caseGenSuggestions = cloneJson(snapshot.caseGenSuggestions, {});
      state.caseGenModuleStatus = cloneJson(snapshot.caseGenModuleStatus, {});
      state.caseGenProgress = cloneJson(snapshot.caseGenProgress, {});
      state.caseGenTiming = cloneJson(snapshot.caseGenTiming, {});
      state.caseGenSource = String(snapshot.caseGenSource || '');
      ensureState().deletedBaselineModuleKeys = cloneJson(snapshot.deletedBaselineModuleKeys, []);
      ensureState().deletedBaselineCaseKeys = cloneJson(snapshot.deletedBaselineCaseKeys, []);
      ensureState().modules = {};
      invalidateDeleteConflictingSnapshots();
      ensureState().hasModuleSkeleton = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      ensureState().hasImportedBaseline = hasImportedBaselineCases();
      ensureRootUiState().lastAction = String(actionId || '');
      ensureRootUiState().updatedAt = Date.now();
      syncCasesGenPageRender();
      syncDeleteHistoryButtons();
      return true;
    }

    function undoLatestDeleteSelection() {
      var xmindState = ensureState();
      var list = Array.isArray(xmindState.deleteUndoStack) ? xmindState.deleteUndoStack : [];
      if (!list.length) return false;
      var entry = list.pop();
      if (!entry || !entry.before) {
        syncDeleteHistoryButtons();
        return false;
      }
      xmindState.deleteRedoStack = Array.isArray(xmindState.deleteRedoStack) ? xmindState.deleteRedoStack : [];
      xmindState.deleteRedoStack.push(entry);
      if (xmindState.deleteRedoStack.length > HISTORY_LIMIT) {
        xmindState.deleteRedoStack = xmindState.deleteRedoStack.slice(xmindState.deleteRedoStack.length - HISTORY_LIMIT);
      }
      if (!applyDeleteHistorySnapshot(entry.before, 'delete-undo')) return false;
      notifyStatus('已撤回删除：' + String(entry.summaryText || '当前选中内容'), 'ok');
      render({ reason: 'delete-undo' });
      persistXmindState(true);
      return true;
    }

    function redoLatestDeleteSelection() {
      var xmindState = ensureState();
      var list = Array.isArray(xmindState.deleteRedoStack) ? xmindState.deleteRedoStack : [];
      if (!list.length) return false;
      var entry = list.pop();
      if (!entry || !entry.after) {
        syncDeleteHistoryButtons();
        return false;
      }
      xmindState.deleteUndoStack = Array.isArray(xmindState.deleteUndoStack) ? xmindState.deleteUndoStack : [];
      xmindState.deleteUndoStack.push(entry);
      if (xmindState.deleteUndoStack.length > HISTORY_LIMIT) {
        xmindState.deleteUndoStack = xmindState.deleteUndoStack.slice(xmindState.deleteUndoStack.length - HISTORY_LIMIT);
      }
      if (!applyDeleteHistorySnapshot(entry.after, 'delete-redo')) return false;
      notifyStatus('已恢复删除：' + String(entry.summaryText || '当前选中内容'), 'ok');
      render({ reason: 'delete-redo' });
      persistXmindState(true);
      return true;
    }

    function getPrepState() {
      return ensureState().prep;
    }

    function setPrepField(key, value, immediate) {
      var prep = getPrepState();
      if (prep.baseLocked === true && isPrepBaseField(key)) return false;
      prep[key] = value;
      if (key !== 'completed' && key !== 'step' && key !== 'baseLocked') prep.completed = false;
      persistXmindState(immediate === true);
      syncPrepDialogState();
      if (isPrepBaseField(key) || key === 'completed' || key === 'step' || key === 'baseLocked') {
        renderWorkspaceTabs();
      }
      return true;
    }

    function isPrepBaseField(key) {
      return key === 'requirementMode'
        || key === 'requirementSupplement'
        || key === 'manualRequirementLabel'
        || key === 'manualRequirementBlocks'
        || key === 'caseImportMode';
    }

    function isPrepBaseLocked() {
      return getPrepState().baseLocked === true;
    }

    function getPrepMaxReachableStep() {
      if (isPrepBaseLocked()) return STEP_OPTIONS;
      if (!hasRequirementReady()) return STEP_REQUIREMENT;
      if (!hasCaseStepReady()) return STEP_CASES;
      return STEP_OPTIONS;
    }

    function clampPrepStep(step) {
      var next = Math.max(STEP_REQUIREMENT, Math.min(STEP_OPTIONS, Number(step) || STEP_REQUIREMENT));
      var maxStep = getPrepMaxReachableStep();
      if (next > maxStep) next = maxStep;
      return next;
    }

    function markPrepNeedsReconfirm(immediate) {
      var prep = getPrepState();
      if (prep.completed !== true) return false;
      prep.completed = false;
      persistXmindState(immediate === true);
      renderWorkspaceTabs();
      return true;
    }

    function normalizeText(value) {
      if (value === null || value === undefined) return '';
      return String(value).replace(/\r/g, '\n').replace(/\s+/g, ' ').trim();
    }

    function stringifyField(value) {
      if (Array.isArray(value)) {
        return value.map(function(item) { return normalizeText(item); }).filter(Boolean).join('；');
      }
      if (value && typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch (err) {
          return '';
        }
      }
      return normalizeText(value);
    }

    function normalizeModuleTitle(value) {
      return stringifyField(value || '').replace(/\s+/g, ' ').trim();
    }

    function normalizeModuleKey(value) {
      return normalizeModuleTitle(value).toLowerCase();
    }

    function normalizeCaseTitle(value) {
      return normalizeText(value).toLowerCase();
    }

    function normalizeUniqueStringList(list) {
      var seen = Object.create(null);
      return (Array.isArray(list) ? list : []).map(function(item) {
        return String(item || '').trim();
      }).filter(function(item) {
        if (!item || seen[item]) return false;
        seen[item] = true;
        return true;
      });
    }

    function buildBaselineModuleDeleteKey(moduleTitle) {
      return normalizeModuleKey(moduleTitle || '');
    }

    function buildBaselineCaseDeleteKey(moduleTitle, caseSignature) {
      var moduleKey = buildBaselineModuleDeleteKey(moduleTitle);
      var signature = String(caseSignature || '').trim();
      return moduleKey && signature ? (moduleKey + '::' + signature) : '';
    }

    function getDocumentRequirementLabelText() {
      var label = normalizePersistedRequirementLabel(state.requirementLabel);
      if (!label) {
        var activeRecord = getWorkspaceRecord(getActiveWorkspaceId());
        var recordShared = activeRecord && activeRecord.snapshot && activeRecord.snapshot.shared
          ? normalizeWorkspaceSharedState(activeRecord.snapshot.shared)
          : null;
        if (recordShared) {
          label = normalizePersistedRequirementLabel(recordShared.requirementLabel);
        }
      }
      if (!label) {
        label = normalizeRequirementLabelFromFileName(state.lastRawImportName || '');
      }
      return label;
    }

    function getManualRequirementLabelText() {
      return String(getPrepState().manualRequirementLabel || '').trim();
    }

    function normalizePersistedRequirementLabel(value) {
      var text = value === null || value === undefined ? '' : String(value || '').trim();
      if (!text || text === '当前需求') return '';
      return text;
    }

    function getRequirementLabelText() {
      var prep = getPrepState();
      var label = prep.requirementMode === 'manual'
        ? getManualRequirementLabelText()
        : getDocumentRequirementLabelText();
      return label || '当前需求';
    }

    function normalizeRequirementLabelFromFileName(fileName) {
      var text = String(fileName || '').trim();
      if (!text) return '';
      return text.replace(/\.[^.\s]{1,10}$/i, '').trim();
    }

    function stripCodeFence(text) {
      var raw = String(text || '').trim();
      var matched = raw.match(/^```[\w-]*\n([\s\S]*?)```$/);
      if (matched && matched[1]) return matched[1].trim();
      return raw;
    }

    function normalizeModelCapabilityList(model) {
      if (!model || typeof model !== 'object') return [];
      var raw = model.capabilities || model.modelCapabilities || model.tags || model.multiModalTags || model.multimodalTags;
      var list = [];
      if (Array.isArray(raw)) {
        list = raw.slice();
      } else if (typeof raw === 'string') {
        list = raw.split(/[,|/、\s]+/);
      } else if (raw && typeof raw === 'object') {
        Object.keys(raw).forEach(function(key) {
          if (raw[key]) list.push(key);
        });
      }
      var seen = {};
      return list.map(function(item) { return String(item || '').trim(); }).filter(function(item) {
        var key = item.toLowerCase();
        if (!key || seen[key]) return false;
        seen[key] = true;
        return true;
      });
    }

    function modelSupportsVision(model) {
      var caps = normalizeModelCapabilityList(model);
      for (var i = 0; i < caps.length; i += 1) {
        var token = String(caps[i] || '').trim().toLowerCase();
        if (!token) continue;
        if (
          token === 'vision' || token === '视觉' ||
          token.indexOf('vision') !== -1 ||
          token.indexOf('visual') !== -1 ||
          token.indexOf('multimodal') !== -1 ||
          token.indexOf('multi-modal') !== -1 ||
          token.indexOf('multi_modal') !== -1 ||
          token.indexOf('image') !== -1 ||
          token.indexOf('图像') !== -1 ||
          token.indexOf('图片') !== -1
        ) {
          return true;
        }
      }
      return false;
    }

    function collectDocumentRequirementImages() {
      var list = [];
      var media = state && state.requirementMedia && typeof state.requirementMedia === 'object'
        ? state.requirementMedia
        : null;
      if (!media) return list;
      function append(item, source) {
        if (!item || typeof item !== 'object') return;
        var blob = item.blob || item.file || null;
        if (!blob) return;
        list.push({
          blob: blob,
          source: source || '',
          index: Number(item.index) || (list.length + 1),
          textOffset: Number.isFinite(Number(item.textOffset)) ? Number(item.textOffset) : null,
          name: item.name || '',
          rid: item.rid || '',
          mediaPath: item.mediaPath || '',
        });
      }
      if (Array.isArray(media.docxImages)) media.docxImages.forEach(function(item) { append(item, 'docx'); });
      if (Array.isArray(media.pastedImages)) media.pastedImages.forEach(function(item) { append(item, 'paste'); });
      return list;
    }

    function getDocumentRequirementImageCount() {
      var media = state && state.requirementMedia && typeof state.requirementMedia === 'object'
        ? state.requirementMedia
        : null;
      if (!media) return 0;
      var docxCount = Math.max(
        Number(media.lastDocxImageCount || 0) || 0,
        Array.isArray(media.docxImages) ? media.docxImages.length : 0
      );
      var pastedCount = Array.isArray(media.pastedImages) ? media.pastedImages.length : 0;
      return Math.max(0, docxCount + pastedCount);
    }

    function readBlobAsDataUrl(blob) {
      return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function() { resolve(String(reader.result || '')); };
        reader.onerror = function() { reject(reader.error || new Error('读取图片失败')); };
        reader.readAsDataURL(blob);
      });
    }

    function estimateDataUrlBytes(dataUrl) {
      if (!dataUrl) return 0;
      var comma = dataUrl.indexOf(',');
      if (comma === -1) return 0;
      var b64 = dataUrl.slice(comma + 1);
      var padding = 0;
      var matched = b64.match(/=+$/);
      if (matched && matched[0]) padding = matched[0].length;
      return Math.max(0, Math.floor(b64.length * 3 / 4) - padding);
    }

    function loadImageByDataUrl(dataUrl) {
      return new Promise(function(resolve, reject) {
        var img = new Image();
        img.onload = function() { resolve(img); };
        img.onerror = function() { reject(new Error('图片解码失败')); };
        img.src = dataUrl;
      });
    }

    async function resizeDataUrl(dataUrl, maxEdge, mimeType, quality) {
      if (!dataUrl) return '';
      if (typeof document === 'undefined' || !document.createElement) return dataUrl;
      var image;
      try {
        image = await loadImageByDataUrl(dataUrl);
      } catch (err) {
        return dataUrl;
      }
      var srcW = image.naturalWidth || image.width || 0;
      var srcH = image.naturalHeight || image.height || 0;
      if (!srcW || !srcH) return dataUrl;
      var ratio = Math.min(1, maxEdge / Math.max(srcW, srcH));
      var targetW = Math.max(1, Math.round(srcW * ratio));
      var targetH = Math.max(1, Math.round(srcH * ratio));
      var canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      var ctx2d = canvas.getContext('2d');
      if (!ctx2d) return dataUrl;
      ctx2d.drawImage(image, 0, 0, targetW, targetH);
      try {
        return canvas.toDataURL(mimeType || 'image/jpeg', quality);
      } catch (err) {
        try {
          return canvas.toDataURL('image/jpeg', quality);
        } catch (err2) {
          return dataUrl;
        }
      }
    }

    async function preprocessImageToDataUrl(blobOrDataUrl) {
      if (!blobOrDataUrl) return { ok: false, reason: 'missing_blob' };
      var dataUrl = '';
      if (typeof blobOrDataUrl === 'string' && blobOrDataUrl.indexOf('data:') === 0) {
        dataUrl = blobOrDataUrl;
      } else {
        try {
          dataUrl = await readBlobAsDataUrl(blobOrDataUrl);
        } catch (err) {
          return { ok: false, reason: 'read_failed' };
        }
      }
      var best = await resizeDataUrl(dataUrl, multimodalMaxEdge, null, 0.92);
      if (!best) best = dataUrl;
      var bytes = estimateDataUrlBytes(best);
      if (bytes > multimodalMaxBytes) {
        var jpegHigh = await resizeDataUrl(best, multimodalMaxEdge, 'image/jpeg', 0.85);
        if (jpegHigh) {
          best = jpegHigh;
          bytes = estimateDataUrlBytes(best);
        }
      }
      if (bytes > multimodalMaxBytes) {
        var jpegLow = await resizeDataUrl(best, multimodalMaxEdge, 'image/jpeg', 0.72);
        if (jpegLow) {
          best = jpegLow;
          bytes = estimateDataUrlBytes(best);
        }
      }
      if (bytes > multimodalMaxBytes) {
        return { ok: false, reason: 'too_large' };
      }
      return { ok: true, dataUrl: best };
    }

    async function buildImageContentBlocks(images, fromDataUrl) {
      var result = [];
      var stats = { total: Array.isArray(images) ? images.length : 0, sent: 0, skipped: 0 };
      if (!Array.isArray(images) || !images.length) return { blocks: result, stats: stats };
      for (var i = 0; i < images.length; i += 1) {
        if (i >= multimodalMaxImages) {
          stats.skipped += (images.length - i);
          break;
        }
        var item = images[i];
        var pre = await preprocessImageToDataUrl(fromDataUrl === true ? item.dataUrl : (item && item.blob ? item.blob : null));
        if (!pre.ok || !pre.dataUrl) {
          stats.skipped += 1;
          continue;
        }
        result.push({
          type: 'image',
          dataUrl: pre.dataUrl,
        });
        stats.sent += 1;
      }
      return { blocks: result, stats: stats };
    }

    function getManualRequirementBlocks() {
      var blocks = getPrepState().manualRequirementBlocks;
      return Array.isArray(blocks) ? blocks : [];
    }

    function getManualRequirementText() {
      var text = '';
      getManualRequirementBlocks().forEach(function(block) {
        if (!block || block.type !== 'text' || !block.text) return;
        if (text) text += '\n';
        text += String(block.text);
      });
      return String(text || '').trim();
    }

    function getManualRequirementImages() {
      return getManualRequirementBlocks().filter(function(block) {
        return block && block.type === 'image' && String(block.dataUrl || '').indexOf('data:') === 0;
      });
    }

    function syncSummaryDraftIntoState(options) {
      var opts = options || {};
      if (summaryDialogOpen !== true || summaryDialogMode !== 'prep' || !summaryDialogBodyEl) return false;
      var changed = false;
      var prep = getPrepState();
      var settings = getCaseGenSettingsSnapshot() || {};
      var preserveCompleted = opts.preserveCompleted === true;

      function markPrepChanged() {
        changed = true;
        if (preserveCompleted !== true) prep.completed = false;
      }

      if (isPrepBaseLocked() !== true) {
        var requirementModeInputs = summaryDialogBodyEl.querySelectorAll('input[name="xmindRequirementMode"]');
        if (requirementModeInputs && requirementModeInputs.length) {
          var requirementModeEl = summaryDialogBodyEl.querySelector('input[name="xmindRequirementMode"]:checked');
          var requirementMode = requirementModeEl ? String(requirementModeEl.value || '') : '';
          if (requirementMode !== 'manual' && requirementMode !== 'document') requirementMode = '';
          if (prep.requirementMode !== requirementMode) {
            prep.requirementMode = requirementMode;
            markPrepChanged();
          }
        }

        var supplementEl = summaryDialogBodyEl.querySelector('#xmindCaseGenRequirementSupplement');
        if (supplementEl) {
          var nextSupplement = String(supplementEl.value || '');
          if (String(prep.requirementSupplement || '') !== nextSupplement) {
            prep.requirementSupplement = nextSupplement;
            markPrepChanged();
          }
        }

        var manualLabelEl = summaryDialogBodyEl.querySelector('#xmindCaseGenManualRequirementLabel');
        if (manualLabelEl) {
          var nextManualLabel = String(manualLabelEl.value || '');
          if (String(prep.manualRequirementLabel || '') !== nextManualLabel) {
            prep.manualRequirementLabel = nextManualLabel;
            markPrepChanged();
          }
        }

        var manualTextEl = summaryDialogBodyEl.querySelector('#xmindCaseGenManualRequirementText');
        if (manualTextEl) {
          var manualText = String(manualTextEl.value || '');
          var manualImages = getManualRequirementImages().map(function(item) {
            return cloneJson(item, null);
          }).filter(Boolean);
          var nextBlocks = [];
          if (manualText.trim()) nextBlocks.push({ type: 'text', text: manualText });
          manualImages.forEach(function(item) { nextBlocks.push(item); });
          if (JSON.stringify(prep.manualRequirementBlocks || []) !== JSON.stringify(nextBlocks)) {
            prep.manualRequirementBlocks = nextBlocks;
            markPrepChanged();
          }
        }

        var caseImportModeInputs = summaryDialogBodyEl.querySelectorAll('input[name="xmindCaseImportMode"]');
        if (caseImportModeInputs && caseImportModeInputs.length) {
          var caseImportModeEl = summaryDialogBodyEl.querySelector('input[name="xmindCaseImportMode"]:checked');
          var caseImportMode = caseImportModeEl ? String(caseImportModeEl.value || '') : '';
          if (caseImportMode !== 'import' && caseImportMode !== 'skip') caseImportMode = '';
          if (prep.caseImportMode !== caseImportMode) {
            prep.caseImportMode = caseImportMode;
            markPrepChanged();
          }
        }
      }

      var customRequirementEl = summaryDialogBodyEl.querySelector('#xmindCaseGenOptionCustomRequirement');
      if (customRequirementEl) {
        var nextCustomRequirement = String(customRequirementEl.value || '');
        if (String(settings.customRequirement || '') !== nextCustomRequirement) {
          applyCaseGenOptionToSharedSettings('customRequirement', nextCustomRequirement);
          if (casesGenApi && typeof casesGenApi.setCaseGenSettingValue === 'function') {
            casesGenApi.setCaseGenSettingValue('customRequirement', nextCustomRequirement);
          }
          markPrepChanged();
        }
      }

      var settingInputs = summaryDialogBodyEl.querySelectorAll('input[data-casegen-setting]');
      for (var i = 0; i < settingInputs.length; i += 1) {
        var inputEl = settingInputs[i];
        if (!inputEl || !inputEl.getAttribute) continue;
        var settingKey = String(inputEl.getAttribute('data-casegen-setting') || '');
        if (!settingKey) continue;
        var nextValue = inputEl.type === 'checkbox' ? inputEl.checked === true : String(inputEl.value || '');
        if (settings[settingKey] !== nextValue) {
          applyCaseGenOptionToSharedSettings(settingKey, nextValue);
          if (casesGenApi && typeof casesGenApi.setCaseGenSettingValue === 'function') {
            casesGenApi.setCaseGenSettingValue(settingKey, nextValue);
          }
          markPrepChanged();
        }
      }
      return changed;
    }

    function getSelectedRequirementSource() {
      var prep = getPrepState();
      var mode = prep.requirementMode === 'manual'
        ? 'manual'
        : (prep.requirementMode === 'document' ? 'document' : '');
      var rawTextEl = document.getElementById('rawText');
      var shadowBase = workspaceShadowDepth > 0 && shadowWorkspaceSharedState
        ? normalizeWorkspaceSharedState(shadowWorkspaceSharedState)
        : null;
      var documentText = shadowBase
        ? String(shadowBase.rawText || '').trim()
        : (rawTextEl && rawTextEl.value ? String(rawTextEl.value).trim() : '');
      var documentLabel = getDocumentRequirementLabelText();
      var manualLabel = getManualRequirementLabelText();
      var manualText = getManualRequirementText();
      var manualImages = getManualRequirementImages();
      if (mode === 'manual') {
        var manualHasBodyContent = Boolean(manualText) || manualImages.length > 0;
        return {
          mode: 'manual',
          label: manualLabel,
          text: manualText,
          supplement: '',
          importName: '',
          images: manualImages,
          imageCount: manualImages.length,
          hasLabel: Boolean(manualLabel),
          hasBodyContent: manualHasBodyContent,
          isReady: Boolean(manualLabel) && manualHasBodyContent,
        };
      }
      if (mode === 'document') {
        var documentImages = collectDocumentRequirementImages();
        return {
          mode: 'document',
          label: documentLabel,
          text: documentText,
          supplement: String(prep.requirementSupplement || '').trim(),
          importName: state.lastRawImportName ? String(state.lastRawImportName).trim() : '',
          images: documentImages,
          imageCount: documentImages.length,
          hasLabel: Boolean(documentLabel),
          hasBodyContent: Boolean(documentText),
          isReady: Boolean(documentText),
        };
      }
      return {
        mode: '',
        label: '',
        text: '',
        supplement: '',
        importName: '',
        images: [],
        imageCount: 0,
        hasLabel: false,
        hasBodyContent: false,
        isReady: false,
      };
    }

    function setManualRequirementText(value) {
      var text = String(value || '');
      var images = getManualRequirementImages().map(function(item) { return cloneJson(item, null); }).filter(Boolean);
      var next = [];
      if (text.trim()) {
        next.push({ type: 'text', text: text });
      }
      images.forEach(function(item) { next.push(item); });
      setPrepField('manualRequirementBlocks', next);
    }

    async function appendManualRequirementImages(files) {
      var fileList = Array.isArray(files) ? files : [];
      if (!fileList.length) return false;
      var blocks = getManualRequirementBlocks().slice();
      var added = 0;
      for (var i = 0; i < fileList.length; i += 1) {
        var file = fileList[i];
        if (!file || !(file.type || '').match(/^image\//i)) continue;
        var dataUrl = '';
        try {
          dataUrl = await readBlobAsDataUrl(file);
        } catch (err) {
          continue;
        }
        blocks.push({
          type: 'image',
          name: file.name || ('image-' + Date.now() + '-' + i),
          dataUrl: dataUrl,
        });
        added += 1;
      }
      if (!added) return false;
      setPrepField('manualRequirementBlocks', blocks);
      return true;
    }

    function removeManualRequirementImage(index) {
      var images = 0;
      var next = [];
      getManualRequirementBlocks().forEach(function(block) {
        if (block && block.type === 'image') {
          if (images === index) {
            images += 1;
            return;
          }
          images += 1;
        }
        next.push(block);
      });
      setPrepField('manualRequirementBlocks', next);
    }

    function hasManualRequirementContent() {
      return Boolean(getManualRequirementText()) || getManualRequirementImages().length > 0;
    }

    function hasDocumentRequirementContent() {
      var rawTextEl = document.getElementById('rawText');
      return Boolean(rawTextEl && String(rawTextEl.value || '').trim());
    }

    function hasImportedBaselineCases() {
      var rootState = state && state.xmindCaseGen && typeof state.xmindCaseGen === 'object'
        ? state.xmindCaseGen
        : null;
      var prep = rootState && rootState.prep && typeof rootState.prep === 'object'
        ? rootState.prep
        : null;
      if (!prep || prep.caseImportMode !== 'import') return false;
      if (xmindGenApi && typeof xmindGenApi.getCombinedCaseList === 'function') {
        var list = xmindGenApi.getCombinedCaseList() || [];
        return Array.isArray(list) && list.length > 0;
      }
      return false;
    }

    function getVisibleBaselineCaseList() {
      var deletedBaselineModules = getDeletedBaselineModuleMap();
      var deletedBaselineCases = getDeletedBaselineCaseMap();
      var rawBaselineList = hasImportedBaselineCases() && xmindGenApi && typeof xmindGenApi.getCombinedCaseList === 'function'
        ? xmindGenApi.getCombinedCaseList()
        : [];
      return rawBaselineList.filter(function(item) {
        if (!item || typeof item !== 'object') return false;
        var moduleTitle = normalizeModuleTitle(item.module || item.module_name || item['模块'] || '未命名模块');
        var moduleKey = normalizeModuleKey(moduleTitle);
        if (!moduleKey) return false;
        if (deletedBaselineModules[moduleKey]) return false;
        var caseDeleteKey = buildBaselineCaseDeleteKey(moduleTitle, buildCaseSignature(item, moduleTitle));
        if (caseDeleteKey && deletedBaselineCases[caseDeleteKey]) return false;
        return true;
      });
    }

    function hasVisibleImportedBaselineCases() {
      return getVisibleBaselineCaseList().length > 0;
    }

    function getRequirementContextText() {
      return getSelectedRequirementSource().text;
    }

    function hasRequirementReady() {
      return getSelectedRequirementSource().isReady === true;
    }

    function hasCaseStepReady() {
      var prep = getPrepState();
      if (prep.caseImportMode === 'skip') return true;
      if (prep.caseImportMode === 'import') return hasImportedBaselineCases();
      return false;
    }

    function isPrepCompleted() {
      var prep = getPrepState();
      return Boolean(prep.completed) && hasRequirementReady() && hasCaseStepReady();
    }

    function buildRequirementSummaryInfo() {
      var requirementSource = getSelectedRequirementSource();
      if (requirementSource.mode === 'manual') {
        var manualMeta = '';
        if (!requirementSource.hasLabel && !requirementSource.hasBodyContent) {
          manualMeta = '请先填写需求名称，并填写文本或上传图片。';
        } else if (!requirementSource.hasLabel) {
          manualMeta = '请先填写需求名称，用作根节点标题。';
        } else if (!requirementSource.hasBodyContent) {
          manualMeta = '请先填写文本或上传图片。';
        } else {
          manualMeta = '需求名：' + requirementSource.label + '，文本 ' + String(requirementSource.text.length) + ' 字'
            + (requirementSource.imageCount ? '，图片 ' + String(requirementSource.imageCount) + ' 张' : '');
        }
        return {
          done: requirementSource.isReady === true,
          title: requirementSource.label || '未填写需求名称',
          meta: manualMeta,
        };
      }
      var importName = requirementSource.importName || '当前文档';
      return {
        done: requirementSource.isReady === true,
        title: requirementSource.label || (requirementSource.isReady === true ? '已导入需求文档' : '未导入需求文档'),
        meta: requirementSource.isReady === true
          ? ('来源：' + importName + '，正文 ' + String(requirementSource.text.length) + ' 字' + (requirementSource.supplement ? '，补充已填写' : ''))
          : '请先导入需求文档。',
      };
    }

    function buildCasesSummaryInfo() {
      var prep = getPrepState();
      if (prep.caseImportMode !== 'skip' && prep.caseImportMode !== 'import') {
        return {
          done: false,
          title: '未选择是否导入已有用例',
          meta: '请选择是否导入已有用例，再进入下一步。',
        };
      }
      if (prep.caseImportMode === 'skip') {
        return {
          done: true,
          title: '本次不导入已有用例',
          meta: '主树将只展示 AI 生成层。',
        };
      }
      var list = xmindGenApi && typeof xmindGenApi.getCombinedCaseList === 'function'
        ? xmindGenApi.getCombinedCaseList()
        : [];
      var text = xmindGenApi && typeof xmindGenApi.getCombinedCaseText === 'function'
        ? xmindGenApi.getCombinedCaseText()
        : '';
      if (!Array.isArray(list) || !list.length) {
        return {
          done: false,
          title: '未导入已有用例',
          meta: text ? '已存在文本，但尚未解析到有效用例。' : '参考用例是可选项，可跳过。',
        };
      }
      return {
        done: true,
        title: '已导入已有用例',
        meta: '当前共 ' + String(list.length) + ' 条，将作为 XMind 可见基线。',
      };
    }

    function buildSummaryCardsHtml() {
      var requirement = buildRequirementSummaryInfo();
      var cases = buildCasesSummaryInfo();
      return ''
        + '<div class="xmind-casegen-summary-grid">'
        +   '<div class="xmind-casegen-summary-card">'
        +     '<div class="xmind-casegen-summary-head">'
        +       '<span class="xmind-casegen-summary-label">当前需求</span>'
        +       '<span class="xmind-casegen-prep-bool ' + (requirement.done ? 'is-yes' : 'is-no') + '">' + (requirement.done ? '✓' : '✕') + '</span>'
        +     '</div>'
        +     '<strong class="xmind-casegen-summary-title">' + escapeHtml(requirement.title) + '</strong>'
        +     '<p class="hint xmind-casegen-summary-meta">' + escapeHtml(requirement.meta) + '</p>'
        +   '</div>'
        +   '<div class="xmind-casegen-summary-card">'
        +     '<div class="xmind-casegen-summary-head">'
        +       '<span class="xmind-casegen-summary-label">参考用例</span>'
        +       '<span class="xmind-casegen-prep-bool ' + (cases.done ? 'is-yes' : 'is-no') + '">' + (cases.done ? '✓' : '✕') + '</span>'
        +     '</div>'
        +     '<strong class="xmind-casegen-summary-title">' + escapeHtml(cases.title) + '</strong>'
        +     '<p class="hint xmind-casegen-summary-meta">' + escapeHtml(cases.meta) + '</p>'
        +   '</div>'
        + '</div>';
    }

    function padDatePart(value) {
      var num = Number(value) || 0;
      return num < 10 ? ('0' + String(num)) : String(num);
    }

    function formatHistoryTimestamp(timestamp) {
      var time = Number(timestamp);
      if (!Number.isFinite(time) || time <= 0) return '-';
      var date = new Date(time);
      if (isNaN(date.getTime())) return '-';
      return date.getFullYear()
        + '-' + padDatePart(date.getMonth() + 1)
        + '-' + padDatePart(date.getDate())
        + ' ' + padDatePart(date.getHours())
        + ':' + padDatePart(date.getMinutes())
        + ':' + padDatePart(date.getSeconds());
    }

    function getRootHistoryActionLabel(actionId, hadAiContentBeforeAction) {
      if (actionId === ROOT_ACTIONS.FULL_CASES) return getRootFullCasesLabel(hadAiContentBeforeAction === true);
      if (actionId === ROOT_ACTIONS.FULL_MODULES) return '生成全量模块';
      if (actionId === ROOT_ACTIONS.REGENERATE_MODULES) return '重新生成模块';
      if (actionId === ROOT_ACTIONS.EXISTING_CASES) return '已有模块补全用例';
      if (actionId === ROOT_ACTIONS.TOPUP_MODULES) return '补全模块';
      if (actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES) return '补全模块+用例';
      if (actionId === ROOT_ACTIONS.APPEND_ALL) return '追加生成全部模块+用例';
      return String(actionId || '');
    }

    function getModuleHistoryActionLabel(actionId, moduleEntry, hadAiCasesBeforeAction) {
      if (actionId === MODULE_ACTIONS.FULL_CASES) {
        if (typeof hadAiCasesBeforeAction === 'boolean') {
          return hadAiCasesBeforeAction ? '重新生成全量用例' : '生成全量用例';
        }
        return getModuleFullCasesLabel(moduleEntry);
      }
      if (actionId === MODULE_ACTIONS.APPEND) return '追加生成';
      return String(actionId || '');
    }

    function getGenerationFailureLabel(scope, actionId, options) {
      var opts = options || {};
      if (scope === 'module') {
        if (actionId === MODULE_ACTIONS.APPEND) return '追加失败';
        if (actionId === MODULE_ACTIONS.FULL_CASES) {
          return opts.hadAiCasesBeforeAction === true ? '重新生成失败' : '生成失败';
        }
        return '生成失败';
      }
      if (
        actionId === ROOT_ACTIONS.TOPUP_MODULES
        || actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES
        || actionId === ROOT_ACTIONS.EXISTING_CASES
      ) {
        return '补全失败';
      }
      if (actionId === ROOT_ACTIONS.APPEND_ALL) return '追加失败';
      if (actionId === ROOT_ACTIONS.REGENERATE_MODULES) return '重新生成失败';
      if (actionId === ROOT_ACTIONS.FULL_CASES) {
        return opts.hadAiContentBeforeAction === true ? '重新生成失败' : '生成失败';
      }
      return '生成失败';
    }

    function buildHistoryLocationLabel(scope, moduleTitle) {
      if (scope === 'module') {
        return '模块节点 · ' + (normalizeModuleTitle(moduleTitle) || '当前模块');
      }
      return '根节点 · ' + getRequirementLabelText();
    }

    function normalizeHistoryDetails(details) {
      var map = {};
      (Array.isArray(details) ? details : []).forEach(function(item) {
        if (!item) return;
        var moduleTitle = normalizeModuleTitle(item.module || item.moduleTitle || '');
        var key = normalizeModuleKey(moduleTitle || '');
        var stableKey = key || ('module-' + String(Object.keys(map).length + 1));
        if (!map[stableKey]) {
          map[stableKey] = {
            module: moduleTitle || '未命名模块',
            caseCount: 0,
          };
        }
        var caseCount = Number(item.caseCount);
        if (!Number.isFinite(caseCount) || caseCount < 0) caseCount = 0;
        map[stableKey].caseCount += caseCount;
      });
      return Object.keys(map).map(function(key) {
        return map[key];
      });
    }

    function normalizeHistoryDiagnostics(items) {
      var result = [];
      var seen = {};
      (Array.isArray(items) ? items : []).forEach(function(item) {
        var text = String(item || '').trim();
        if (!text || seen[text]) return;
        seen[text] = true;
        result.push(text);
      });
      return result;
    }

    function normalizeHistoryDedupeRecords(items) {
      var result = [];
      var seen = {};
      (Array.isArray(items) ? items : []).forEach(function(item) {
        if (!item || typeof item !== 'object') return;
        var moduleTitle = normalizeModuleTitle(item.module || item.moduleTitle || '');
        var title = String(item.title || item.caseTitle || item.case_title || '').replace(/\s+/g, ' ').trim();
        var reason = normalizeHistoryDedupeReason(item.reason || item.removeReason || item.remove_reason || '');
        var mergedInto = String(item.mergedInto || item.merged_into || item.keepTitle || item.keep_title || '').replace(/\s+/g, ' ').trim();
        var duplicateOf = String(item.duplicateOf || item.duplicate_of || item.duplicateWith || item.duplicate_with || item.sameAs || item.same_as || '').replace(/\s+/g, ' ').trim();
        var duplicatePoint = normalizeHistoryDedupeOptionalReason(item.duplicatePoint || item.duplicate_point || item.overlapPoint || item.overlap_point || item.samePoint || item.same_point || item.overlap || '');
        var mergedFrom = normalizeHistoryDedupeStringList(item.mergedFrom || item.merged_from || item.sourceTitles || item.source_titles || item.beforeTitles || item.before_titles || []);
        if (!title && mergedFrom.length) title = mergedFrom[0];
        if (!moduleTitle || !title) return;
        var actionType = normalizeHistoryDedupeActionType(item.type || item.action || item.actionType || item.action_type || item.kind || '', {
          duplicateOf: duplicateOf,
          mergedInto: mergedInto,
          mergedFrom: mergedFrom,
        });
        var key = normalizeModuleKey(moduleTitle) + '::' + title.toLowerCase() + '::' + reason + '::'
          + actionType + '::' + duplicateOf + '::' + duplicatePoint + '::' + mergedInto + '::' + mergedFrom.join('|');
        if (seen[key]) return;
        seen[key] = true;
        result.push({
          module: moduleTitle,
          title: title,
          reason: reason,
          actionType: actionType,
          duplicateOf: duplicateOf,
          duplicatePoint: duplicatePoint,
          mergedInto: mergedInto,
          mergedFrom: mergedFrom,
        });
      });
      return result;
    }

    function normalizeHistoryDedupeStringList(value) {
      var source = Array.isArray(value)
        ? value
        : (value === null || value === undefined ? [] : [value]);
      var seen = {};
      return source.map(function(item) {
        if (item && typeof item === 'object') {
          return String(item.title || item.caseTitle || item.case_title || item.name || '').replace(/\s+/g, ' ').trim();
        }
        return String(item || '').replace(/\s+/g, ' ').trim();
      }).filter(function(item) {
        if (!item || seen[item]) return false;
        seen[item] = true;
        return true;
      });
    }

    function normalizeHistoryDedupeActionType(value, detail) {
      var raw = String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (raw === 'merge' || raw === 'merged' || raw === 'combine' || raw.indexOf('合并') !== -1) return 'merge';
      if (raw === 'duplicate' || raw === 'dup' || raw.indexOf('重复') !== -1) return 'duplicate';
      if (detail && Array.isArray(detail.mergedFrom) && detail.mergedFrom.length) return 'merge';
      if (detail && detail.duplicateOf) return 'duplicate';
      if (detail && detail.mergedInto) return 'merge';
      return 'removed';
    }

    function normalizeHistoryDedupeReason(value) {
      var text = String(value || '').replace(/\s+/g, ' ').trim();
      text = text.replace(/^原因[：:]\s*/, '').replace(/^因为\s*/, '').trim();
      if (!text) return '覆盖高度重叠';
      var cutAt = -1;
      ['，', '。', '；', ';', '.', '、'].forEach(function(mark) {
        var index = text.indexOf(mark);
        if (index > 0 && (cutAt === -1 || index < cutAt)) cutAt = index;
      });
      if (cutAt > 0) text = text.slice(0, cutAt).trim();
      if (text.length > 24) text = text.slice(0, 24).trim() + '…';
      return text || '覆盖高度重叠';
    }

    function normalizeHistoryDedupeOptionalReason(value) {
      var text = String(value || '').replace(/\s+/g, ' ').trim();
      if (!text) return '';
      return normalizeHistoryDedupeReason(text);
    }

    function normalizeHistoryPreviewText(value) {
      var text = String(value || '').replace(/\s+/g, ' ').trim();
      if (!text) return '';
      if (text.length <= 140) return text;
      return text.slice(0, 140).trim() + '…';
    }

    function recordGenerationHistory(payload) {
      var xmindState = ensureState();
      var history = Array.isArray(xmindState.history) ? xmindState.history : [];
      var details = normalizeHistoryDetails(payload && payload.details);
      var diagnostics = normalizeHistoryDiagnostics(payload && payload.diagnostics);
      var dedupeRecords = normalizeHistoryDedupeRecords(payload && payload.dedupeRecords);
      var scope = payload && payload.scope === 'module' ? 'module' : 'root';
      var moduleCount = Number(payload && payload.moduleCount);
      var resultKind = payload && (
        payload.resultKind === 'no-change'
        || payload.resultKind === 'cancelled'
        || payload.resultKind === 'error'
      ) ? String(payload.resultKind) : 'changed';
      if (!Number.isFinite(moduleCount) || moduleCount < 0) moduleCount = details.length;
      history.unshift({
        id: 'history-' + String(Date.now()) + '-' + String(Math.floor(Math.random() * 100000)),
        scope: scope,
        locationLabel: buildHistoryLocationLabel(scope, payload && payload.moduleTitle),
        actionId: String(payload && payload.actionId ? payload.actionId : ''),
        actionLabel: String(payload && payload.actionLabel ? payload.actionLabel : ''),
        summaryText: payload && payload.summaryText ? String(payload.summaryText) : '',
        moduleCount: moduleCount,
        details: details,
        resultKind: resultKind,
        reasonText: payload && payload.reasonText ? String(payload.reasonText) : '',
        diagnostics: diagnostics,
        dedupeRecords: dedupeRecords,
        previewText: normalizeHistoryPreviewText(payload && payload.previewText),
        createdAt: Date.now(),
      });
      if (history.length > HISTORY_LIMIT) history.length = HISTORY_LIMIT;
      xmindState.history = history;
      xmindState.summaryResultKind = resultKind === 'error' ? 'error' : '';
      persistXmindState(true);
    }

    function buildHistoryDiagnosticSectionsHtml(diagnostics) {
      var detailedDiagnostics = [];
      var chipDiagnostics = [];
      (Array.isArray(diagnostics) ? diagnostics : []).forEach(function(item) {
        var text = String(item || '').trim();
        if (!text) return;
        if (/^错误信息：/.test(text) || text.length > 120) {
          detailedDiagnostics.push(text);
          return;
        }
        chipDiagnostics.push(text);
      });
      var sections = [];
      if (detailedDiagnostics.length) {
        sections.push(
          '<div class="xmind-casegen-history-diagnostics xmind-casegen-history-diagnostics-blocks">'
            + detailedDiagnostics.map(function(text) {
              var clean = String(text || '').trim();
              var match = clean.match(/^([^：]{2,20}：)\s*(.+)$/);
              var label = match ? String(match[1] || '') : '';
              var value = match ? String(match[2] || '') : clean;
              return '<div class="xmind-casegen-history-diagnostic-block">'
                + (label
                  ? '<strong class="xmind-casegen-history-diagnostic-block-label">' + escapeHtml(label) + '</strong>'
                  : '')
                + '<span class="xmind-casegen-history-diagnostic-block-text">' + escapeHtml(value) + '</span>'
                + '</div>';
            }).join('')
          + '</div>'
        );
      }
      if (chipDiagnostics.length) {
        sections.push(
          '<div class="xmind-casegen-history-diagnostics">'
            + chipDiagnostics.map(function(text) {
              return '<span class="xmind-casegen-history-diagnostic-chip">' + escapeHtml(text) + '</span>';
            }).join('')
          + '</div>'
        );
      }
      return sections.join('');
    }

    function appendUniqueHistoryDedupeTitle(list, title) {
      var text = String(title || '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      if (list.indexOf(text) === -1) list.push(text);
    }

    function buildHistoryDedupeDisplayItems(items) {
      var result = [];
      var mergeMap = {};
      (Array.isArray(items) ? items : []).forEach(function(item) {
        if (!item) return;
        if (item.actionType === 'merge') {
          var mergedFromSeed = Array.isArray(item.mergedFrom) && item.mergedFrom.length
            ? item.mergedFrom.slice()
            : [item.title];
          appendUniqueHistoryDedupeTitle(mergedFromSeed, item.title);
          var mergeKey = [
            'merge',
            normalizeModuleKey(item.module || ''),
            String(item.mergedInto || '').toLowerCase(),
            mergedFromSeed.join('|').toLowerCase(),
          ].join('::');
          if (!mergeMap[mergeKey]) {
            mergeMap[mergeKey] = {
              module: item.module,
              title: '',
              reason: item.reason,
              actionType: 'merge',
              duplicateOf: '',
              duplicatePoint: '',
              mergedInto: item.mergedInto,
              mergedFrom: [],
            };
            result.push(mergeMap[mergeKey]);
          }
          mergedFromSeed.forEach(function(title) {
            appendUniqueHistoryDedupeTitle(mergeMap[mergeKey].mergedFrom, title);
          });
          if (!mergeMap[mergeKey].mergedInto && item.mergedInto) {
            mergeMap[mergeKey].mergedInto = item.mergedInto;
          }
          return;
        }
        result.push(item);
      });
      result.forEach(function(item) {
        if (item && item.actionType === 'merge') {
          var count = Array.isArray(item.mergedFrom) ? item.mergedFrom.length : 0;
          item.title = count > 1 ? ('合并前 ' + String(count) + ' 条用例') : (item.mergedFrom[0] || item.title || '合并用例');
        }
      });
      return result;
    }

    function buildHistoryDedupeTitleListHtml(titles) {
      var list = normalizeHistoryDedupeStringList(titles);
      if (!list.length) return '<span class="xmind-casegen-history-dedupe-muted">未提供</span>';
      return '<span class="xmind-casegen-history-dedupe-title-list">'
        + list.map(function(title) {
          return '<span class="xmind-casegen-history-dedupe-title-chip" title="' + escapeHtml(title) + '">' + escapeHtml(title) + '</span>';
        }).join('')
      + '</span>';
    }

    function buildHistoryDedupeDetailHtml(item) {
      var actionType = item && item.actionType ? String(item.actionType || '') : 'removed';
      var reason = item && item.reason ? String(item.reason || '') : '覆盖高度重叠';
      if (actionType === 'duplicate') {
        return '<span class="xmind-casegen-history-dedupe-badge is-duplicate">重复</span>'
          + '<span class="xmind-casegen-history-dedupe-detail-main">'
            + (item.duplicateOf
              ? ('与「' + escapeHtml(item.duplicateOf) + '」重复')
              : escapeHtml(reason))
          + '</span>'
          + (item.duplicatePoint
            ? '<span class="xmind-casegen-history-dedupe-detail-sub">重复点：' + escapeHtml(item.duplicatePoint) + '</span>'
            : '');
      }
      if (actionType === 'merge') {
        var mergeSourceTitles = Array.isArray(item.mergedFrom) && item.mergedFrom.length ? item.mergedFrom : [item.title];
        return '<span class="xmind-casegen-history-dedupe-badge is-merge">合并</span>'
          + '<span class="xmind-casegen-history-dedupe-merge-flow">'
            + '<span class="xmind-casegen-history-dedupe-merge-label">合并前</span>'
            + buildHistoryDedupeTitleListHtml(mergeSourceTitles)
            + '<span class="xmind-casegen-history-dedupe-merge-label">合并后</span>'
            + '<strong class="xmind-casegen-history-dedupe-merge-target" title="' + escapeHtml(item.mergedInto || '') + '">' + escapeHtml(item.mergedInto || '未提供') + '</strong>'
          + '</span>'
          + '<span class="xmind-casegen-history-dedupe-detail-sub">' + escapeHtml(reason) + '</span>';
      }
      return '<span class="xmind-casegen-history-dedupe-badge is-removed">删除</span>'
        + '<span class="xmind-casegen-history-dedupe-detail-main">' + escapeHtml(reason) + '</span>';
    }

    function buildHistoryDedupeRecordsHtml(records) {
      var list = normalizeHistoryDedupeRecords(records);
      if (!list.length) return '';
      var groups = [];
      var groupMap = {};
      list.forEach(function(item) {
        var moduleName = item.module || '未命名模块';
        var key = normalizeModuleKey(moduleName) || moduleName;
        if (!groupMap[key]) {
          groupMap[key] = {
            module: moduleName,
            items: [],
          };
          groups.push(groupMap[key]);
        }
        groupMap[key].items.push(item);
      });
      return '<div class="xmind-casegen-history-dedupe-records">'
        + '<div class="xmind-casegen-history-dedupe-head">'
          + '<strong class="xmind-casegen-history-dedupe-title">去重记录</strong>'
          + '<span class="xmind-casegen-history-dedupe-summary">已去重 ' + escapeHtml(String(list.length)) + ' 条用例</span>'
        + '</div>'
        + '<div class="xmind-casegen-history-dedupe-module-list">'
          + groups.map(function(group) {
            return '<section class="xmind-casegen-history-dedupe-module-block">'
              + '<div class="xmind-casegen-history-dedupe-module-head">'
                + '<span class="xmind-casegen-history-dedupe-module">' + escapeHtml(group.module || '未命名模块') + '</span>'
                + '<span class="xmind-casegen-history-dedupe-module-count">' + escapeHtml(String(group.items.length)) + ' 条</span>'
              + '</div>'
              + '<div class="xmind-casegen-history-dedupe-table" role="table" aria-label="' + escapeHtml(group.module || '未命名模块') + '去重明细">'
                + '<div class="xmind-casegen-history-dedupe-row xmind-casegen-history-dedupe-row-head" role="row">'
                  + '<span role="columnheader">处理的用例</span>'
                  + '<span role="columnheader">处理关系</span>'
                + '</div>'
                + buildHistoryDedupeDisplayItems(group.items).map(function(item) {
                  var detailText = item.actionType === 'duplicate'
                    ? ((item.duplicateOf ? ('与「' + item.duplicateOf + '」重复') : item.reason) + (item.duplicatePoint ? ('，重复点：' + item.duplicatePoint) : ''))
                    : (item.actionType === 'merge'
                      ? ('合并前：' + normalizeHistoryDedupeStringList(Array.isArray(item.mergedFrom) && item.mergedFrom.length ? item.mergedFrom : [item.title]).join('、') + '；合并后：' + (item.mergedInto || '未提供'))
                      : item.reason);
                  return '<div class="xmind-casegen-history-dedupe-row" role="row">'
                    + '<span class="xmind-casegen-history-dedupe-case" role="cell" title="' + escapeHtml(item.title || '未命名用例') + '">' + escapeHtml(item.title || '未命名用例') + '</span>'
                    + '<span class="xmind-casegen-history-dedupe-reason" role="cell" title="' + escapeHtml(detailText) + '">' + buildHistoryDedupeDetailHtml(item) + '</span>'
                  + '</div>';
                }).join('')
              + '</div>'
            + '</section>';
          }).join('')
        + '</div>'
      + '</div>';
    }

    function renderHistoryDialog() {
      if (!summaryDialogBodyEl) return;
      var history = ensureState().history || [];
      if (!Array.isArray(history) || !history.length) {
        summaryDialogBodyEl.innerHTML = '<div class="xmind-casegen-history-empty">暂无生成记录</div>';
        return;
      }
      summaryDialogBodyEl.innerHTML = '<div class="xmind-casegen-history-list">'
        + history.map(function(entry) {
          var details = Array.isArray(entry.details) ? entry.details : [];
          var diagnostics = normalizeHistoryDiagnostics(entry && entry.diagnostics);
          var dedupeRecords = normalizeHistoryDedupeRecords(entry && entry.dedupeRecords);
          var resultKind = entry && entry.resultKind ? String(entry.resultKind) : 'changed';
          var summaryText = entry && entry.summaryText ? String(entry.summaryText) : '';
          if (!summaryText) {
            summaryText = '生成模块 ' + String(Number(entry.moduleCount) || 0) + ' 个';
            if (resultKind === 'error') summaryText = '本次生成未成功';
            else if (resultKind === 'cancelled') summaryText = '本次生成已中断';
            else if (resultKind === 'no-change' && !details.length) summaryText = '本次没有新增结果';
          }
          var detailHtml = details.length
            ? '<div class="xmind-casegen-history-detail-list">'
                + details.map(function(detail) {
                  return '<div class="xmind-casegen-history-detail">'
                    + '<strong class="xmind-casegen-history-detail-module">' + escapeHtml(detail.module || '未命名模块') + '</strong>'
                    + '<span class="xmind-casegen-history-detail-count">' + String(Number(detail.caseCount) || 0) + ' 条用例</span>'
                    + '</div>';
                }).join('')
              + '</div>'
            : '<div class="xmind-casegen-history-empty-inline">本次未生成新的模块或用例</div>';
          var reasonHtml = entry && entry.reasonText
            ? '<div class="xmind-casegen-history-reason' + (resultKind === 'error' ? ' is-error' : (resultKind === 'cancelled' ? ' is-cancelled' : '')) + '">'
                + '<strong class="xmind-casegen-history-reason-label">' + (
                  resultKind === 'error'
                    ? '失败原因：'
                    : (resultKind === 'cancelled' ? '中断原因：' : '未新增原因：')
                ) + '</strong>'
                + '<span class="xmind-casegen-history-reason-text">' + escapeHtml(entry.reasonText) + '</span>'
              + '</div>'
            : '';
          var previewHtml = entry && entry.previewText
            ? '<div class="xmind-casegen-history-preview">'
                + '<strong class="xmind-casegen-history-preview-label">模型返回片段：</strong>'
                + '<span class="xmind-casegen-history-preview-text">' + escapeHtml(entry.previewText) + '</span>'
              + '</div>'
            : '';
          var diagnosticsHtml = buildHistoryDiagnosticSectionsHtml(diagnostics);
          var dedupeRecordsHtml = buildHistoryDedupeRecordsHtml(dedupeRecords);
          return '<article class="xmind-casegen-history-card">'
            + '<div class="xmind-casegen-history-head">'
            +   '<div class="xmind-casegen-history-copy">'
            +     '<strong class="xmind-casegen-history-location">' + escapeHtml(entry.locationLabel || '-') + '</strong>'
            +     '<span class="xmind-casegen-history-time">' + escapeHtml(formatHistoryTimestamp(entry.createdAt)) + '</span>'
            +   '</div>'
            +   '<span class="xmind-casegen-history-pill">' + escapeHtml(entry.actionLabel || '-') + '</span>'
            + '</div>'
            + '<div class="xmind-casegen-history-summary">' + escapeHtml(summaryText) + '</div>'
            + detailHtml
            + reasonHtml
            + previewHtml
            + dedupeRecordsHtml
            + diagnosticsHtml
            + '</article>';
        }).join('')
        + '</div>';
    }

    function renderOpenedSummaryDialog() {
      if (summaryDialogOpen !== true) return;
      if (!hasActiveWorkspace()) {
        closeSummaryDialog({ skipPersist: true });
        return;
      }
      if (summaryDialogMode === 'prep') {
        syncSummaryDraftIntoState();
      }
      if (summaryDialogMode === 'history') {
        renderHistoryDialog();
        return;
      }
      if (summaryDialogMode === 'knowledge-base') {
        renderKnowledgeBaseDialog();
        return;
      }
      if (summaryDialogMode === 'coverage') {
        renderCoverageDialog();
        return;
      }
      renderPrepDialog();
    }

    function syncPrepDialogState() {
      if (summaryDialogOpen !== true || summaryDialogMode !== 'prep' || !summaryDialogBodyEl) return;
      var prep = getPrepState();
      var currentStep = clampPrepStep(prep.step);
      var stepStates = {};
      stepStates[STEP_REQUIREMENT] = hasRequirementReady();
      stepStates[STEP_CASES] = hasCaseStepReady();
      stepStates[STEP_OPTIONS] = prep.completed === true;
      var stepEls = summaryDialogBodyEl.querySelectorAll('[data-prep-step]');
      Array.prototype.forEach.call(stepEls, function(stepEl) {
        var step = Number(stepEl.getAttribute('data-prep-step') || 0);
        if (!stepEl.classList) return;
        if (step === currentStep) {
          stepEl.classList.add('is-active');
          stepEl.classList.remove('is-done');
        } else if (stepStates[step] === true) {
          stepEl.classList.remove('is-active');
          stepEl.classList.add('is-done');
        } else {
          stepEl.classList.remove('is-active');
          stepEl.classList.remove('is-done');
        }
      });
      var statusBadge = summaryDialogBodyEl.querySelector('[data-prep-card-status="current"]');
      if (statusBadge) {
        var done = false;
        var text = '';
        if (currentStep === STEP_REQUIREMENT) {
          done = stepStates[STEP_REQUIREMENT] === true;
          text = done ? '已完成' : '待完成';
        } else if (currentStep === STEP_CASES) {
          done = stepStates[STEP_CASES] === true;
          text = done ? '已完成' : '待选择';
        } else {
          done = stepStates[STEP_OPTIONS] === true;
          text = done ? '已确认' : (isPrepBaseLocked() ? '待重新确认' : '待确认');
        }
        if (statusBadge.classList) {
          if (done) {
            statusBadge.classList.add('is-done');
            statusBadge.classList.remove('is-ready');
          } else {
            statusBadge.classList.add('is-ready');
            statusBadge.classList.remove('is-done');
          }
        }
        statusBadge.textContent = text;
      }
      var nextBtn = summaryDialogBodyEl.querySelector('[data-prep-nav="next"]');
      if (nextBtn) {
        var shouldDisable = false;
        if (currentStep === STEP_REQUIREMENT) shouldDisable = stepStates[STEP_REQUIREMENT] !== true;
        if (currentStep === STEP_CASES) shouldDisable = stepStates[STEP_CASES] !== true;
        nextBtn.disabled = shouldDisable;
      }
    }

    function getCaseGenSettingsSnapshot() {
      if (casesGenApi && typeof casesGenApi.ensureCaseGenSettings === 'function') {
        return casesGenApi.ensureCaseGenSettings();
      }
      return state.caseGenSettings || {};
    }

    function buildXmindGenerationOptionsSnapshot() {
      var settings = getCaseGenSettingsSnapshot() || {};
      return {
        customRequirement: String(settings.customRequirement || '').trim(),
        needFunctionCondition: settings.needFunctionCondition === true,
        needNumericValidation: settings.needNumericValidation === true,
        needBoundary: settings.needBoundary === true,
        needMobile: settings.needMobile === true,
        needSpecial: settings.needSpecial === true,
        specialRepeatOperation: settings.needSpecial === true && settings.specialRepeatOperation === true,
        specialMultiTouch: settings.needSpecial === true && settings.specialMultiTouch === true,
        specialRepeatExecution: settings.needSpecial === true && settings.specialRepeatExecution === true,
        specialWeakNetwork: settings.needSpecial === true && settings.specialWeakNetwork === true,
        specialInterruptResume: settings.needSpecial === true && settings.specialInterruptResume === true,
      };
    }

    function normalizeDedupeMode(value) {
      return String(value || '') === DEDUPE_MODE_SIMPLIFY ? DEDUPE_MODE_SIMPLIFY : DEDUPE_MODE_ONLY;
    }

    function isDedupeSimplifyMode(value) {
      return normalizeDedupeMode(value) === DEDUPE_MODE_SIMPLIFY;
    }

    function getDedupeModeFromSettings() {
      var settings = getCaseGenSettingsSnapshot() || {};
      return settings.dedupeSimplify === true ? DEDUPE_MODE_SIMPLIFY : DEDUPE_MODE_ONLY;
    }

    function getDedupeModeActionText(mode) {
      return isDedupeSimplifyMode(mode) ? '去重并精简' : '仅去重';
    }

    function getDedupeRunningLabel(mode) {
      return isDedupeSimplifyMode(mode) ? 'AI 去重精简中' : 'AI 用例去重中';
    }

    function getDedupeRunningHint(mode) {
      return isDedupeSimplifyMode(mode)
        ? '正在对当前页签 AI 生成用例执行去重并精简'
        : '正在对当前页签 AI 生成用例执行仅去重';
    }

    function getDedupeRemovedSummaryText(count, mode) {
      var total = Number(count || 0) || 0;
      return isDedupeSimplifyMode(mode)
        ? ('已去重精简 ' + String(total) + ' 条用例')
        : ('已去重 ' + String(total) + ' 条用例');
    }

    function getDedupeNoChangeSummaryText(mode) {
      return isDedupeSimplifyMode(mode)
        ? 'AI 用例去重精简完成，未发现可去重用例'
        : 'AI 用例去重完成，未发现可去重用例';
    }

    function getDedupeExecutionDiagnosticText(count, mode) {
      var total = Number(count || 0) || 0;
      if (total > 0) {
        return isDedupeSimplifyMode(mode)
          ? ('AI 用例去重精简完成，' + getDedupeRemovedSummaryText(total, mode))
          : ('AI 用例去重完成，' + getDedupeRemovedSummaryText(total, mode));
      }
      return getDedupeNoChangeSummaryText(mode);
    }

    function buildXmindGenerationOptionsSummary(settingsSnapshot) {
      var snapshot = settingsSnapshot && typeof settingsSnapshot === 'object'
        ? settingsSnapshot
        : buildXmindGenerationOptionsSnapshot();
      var lines = [];
      var specialNames = [];
      if (snapshot.customRequirement) {
        lines.push('额外要求：' + String(snapshot.customRequirement || ''));
      }
      if (snapshot.needFunctionCondition) {
        lines.push('已开启考虑功能使用条件：生成模块和用例时，需要覆盖解锁条件、可用条件、身份或等级门槛、资源消耗、前置任务和使用时间限制。');
      }
      if (snapshot.needNumericValidation) {
        lines.push('已开启数值验证：生成模块和用例时，需要覆盖数值显示、取值范围、阈值变化、计算结果、累计扣减和结算正确性。');
      }
      if (snapshot.needBoundary) {
        lines.push('已开启考虑边界：生成模块和用例时，需要覆盖上下限、临界值、空值、满值和异常边界。');
      }
      if (snapshot.needMobile) {
        lines.push('已开启考虑移动设备：生成模块和用例时，需要覆盖点击、长按、滑动、拖拽、横竖屏切换和系统手势干扰。');
      }
      if (snapshot.needSpecial) {
        if (snapshot.specialRepeatOperation) specialNames.push('重复操作');
        if (snapshot.specialMultiTouch) specialNames.push('多点触控');
        if (snapshot.specialRepeatExecution) specialNames.push('重复执行');
        if (snapshot.specialWeakNetwork) specialNames.push('弱网');
        if (snapshot.specialInterruptResume) specialNames.push('中断恢复');
        lines.push(
          specialNames.length
            ? ('已开启考虑特殊场景：本轮重点覆盖 ' + specialNames.join('、') + '。')
            : '已开启考虑特殊场景：本轮需要补充异常路径、非理想环境和非常规用户操作。'
        );
      }
      if (!lines.length) {
        lines.push('本轮未额外勾选生成选项，将按默认要求生成。');
      }
      return lines.join('\n');
    }

    function buildEnabledXmindOptionLabels(settingsSnapshot) {
      var snapshot = settingsSnapshot && typeof settingsSnapshot === 'object'
        ? settingsSnapshot
        : buildXmindGenerationOptionsSnapshot();
      var labels = [];
      if (snapshot.needFunctionCondition) labels.push('功能使用条件');
      if (snapshot.needNumericValidation) labels.push('数值验证');
      if (snapshot.needBoundary) labels.push('边界场景');
      if (snapshot.needMobile) labels.push('移动设备场景');
      if (snapshot.needSpecial) labels.push('特殊场景');
      return labels;
    }

    function isRootFullGenerationContract(contract) {
      var scope = contract && contract.scope ? String(contract.scope || '') : '';
      var mode = contract && contract.mode ? String(contract.mode || '') : '';
      return scope === 'root' && (
        mode === 'full_cases'
        || mode === 'full_modules'
        || mode === 'regenerate_modules'
      );
    }

    function buildXmindHardConstraintText(contract, settingsSnapshot) {
      var snapshot = settingsSnapshot && typeof settingsSnapshot === 'object'
        ? settingsSnapshot
        : buildXmindGenerationOptionsSnapshot();
      var enabledLabels = buildEnabledXmindOptionLabels(snapshot);
      var existingCasesCompletionPolicy = getExistingCasesCompletionPolicy(contract);
      var importedBaselineCompletionPolicy = getImportedBaselineCompletionPolicy(contract);
      var lines = [];
      if (!enabledLabels.length && !existingCasesCompletionPolicy && !importedBaselineCompletionPolicy) return '';
      if (existingCasesCompletionPolicy) {
        var scope = contract && contract.scope ? String(contract.scope || '') : '';
        if (scope === 'root') {
          lines.push('当前是导入已有用例后的补全第一阶段：先评估当前已有模块是否足够覆盖需求。');
          lines.push('如果已有模块不足以覆盖需求，只返回缺失的新模块，且这些模块的 cases 必须为空数组或省略。');
          lines.push('如果已有模块已经足够覆盖需求，必须返回 {"modules":[]}。');
          lines.push('第一阶段不要输出已有模块，也不要为任何模块生成用例；用例会在后续模块阶段统一生成或补全。');
        } else {
          lines.push('当前是导入已有用例后的补全第二阶段：按当前模块已有用例情况生成或补全。');
          lines.push('如果当前模块没有可见用例，请围绕需求为该模块生成完整用例。');
          lines.push('如果当前模块已有用例，请以已有用例为已覆盖基线，继续按需求正文、生成选项和风格指南充分补齐该模块应有的正常流、异常流、边界、状态变化、权限/配置、兼容性、弱网/中断恢复和跨模块联动等新增候选。');
          lines.push('只有确认该模块在需求范围内已经完整覆盖，且不存在可补充的独立测试价值时，才返回当前模块 cases: []。');
          lines.push('不得改写、合并、删除、复述或替换导入的已有用例。');
        }
        if (enabledLabels.length) {
          lines.push('已开启的生成选项必须作为本轮补全维度纳入判断：' + enabledLabels.join('、') + '。');
          lines.push('不要因为已有用例覆盖主流程就停止补全；需要结合已开启选项继续补足未覆盖或覆盖薄弱的测试场景。');
        }
        if (snapshot.customRequirement) {
          lines.push('用户附加要求也只作为缺口判断依据，不能绕过先补模块、再生成或补全用例的流程。');
        }
        return lines.join('\n');
      }
      if (importedBaselineCompletionPolicy) {
        lines.push('当前是导入已有用例后的追加生成：导入用例只作为覆盖参考和去重基线，不要因为导入用例数量多而线性扩写。');
        lines.push('如果当前模块没有可见用例，请围绕需求为该模块生成完整用例。');
        lines.push('如果当前模块已有用例，请以已有用例为已覆盖基线，继续按需求正文、生成选项和风格指南充分补齐该模块应有的正常流、异常流、边界、状态变化、权限/配置、兼容性、弱网/中断恢复和跨模块联动等新增候选。');
        lines.push('只有确认该模块在需求范围内已经完整覆盖，且不存在可补充的独立测试价值时，才返回当前模块 cases: []。');
        lines.push('不得改写、合并、删除、复述或替换导入的已有用例。');
        if (enabledLabels.length) {
          lines.push('已开启的生成选项必须作为本轮补全维度纳入判断：' + enabledLabels.join('、') + '。');
          lines.push('不要因为导入用例很多就机械扩写，也不要因为已有用例覆盖主流程就停止补全；需要结合已开启选项继续补足未覆盖或覆盖薄弱的测试场景。');
        }
        if (snapshot.customRequirement) {
          lines.push('用户附加要求也只作为缺口判断依据，不能绕过导入用例的覆盖和去重基线。');
        }
        return lines.join('\n');
      }
      lines.push('已开启的生成选项属于本轮输出的硬性覆盖要求，不是参考建议。');
      lines.push('本轮必须直接覆盖：' + enabledLabels.join('、') + '。');
      if (isRootFullGenerationContract(contract)) {
        if (contract && String(contract.mode || '') === 'full_cases') {
          lines.push('当前是根节点全量用例生成的模块拆分阶段：先返回不重复的模块清单，每个模块必须代表独立测试范围，模块名不得重复或近义重复。');
          lines.push('模块拆分阶段可以提供候选 cases 作为后续模块生成兜底，但后续仍会逐模块执行用例生成；不得把跨模块去重视为模块生成完成。');
        } else {
          lines.push('当前是根节点首轮全量/重生成动作，首次输出必须直接覆盖上述要求，不允许把相关覆盖留到后续补全或追加。');
        }
      }
      if (snapshot.needFunctionCondition) {
        lines.push('如果需求存在解锁条件、开放条件、使用条件、身份/权限/等级/资格门槛、资源消耗、前置任务、时间窗、次数或可用前提，必须在模块拆分、关键场景、测试要点或用例中直接体现。');
      }
      if (snapshot.needNumericValidation) {
        lines.push('如果需求存在金额、积分、次数、数量、时长、上限/下限、阈值、比例、概率、累计、扣减或结算规则，必须在模块、测试要点或用例中直接体现数值验证。');
      }
      if (snapshot.needBoundary) {
        lines.push('如果开启了边界场景，首次输出必须直接覆盖上下限、临界值、空值、满值和异常边界。');
      }
      if (snapshot.needMobile) {
        lines.push('如果开启了移动设备场景，首次输出必须直接覆盖移动端交互、系统手势、横竖屏或设备差异带来的影响。');
      }
      if (snapshot.needSpecial) {
        lines.push('如果开启了特殊场景，首次输出必须直接覆盖非理想环境、异常路径和已勾选的特殊操作场景。');
      }
      if (snapshot.customRequirement) {
        lines.push('用户附加要求也属于本轮必须直接落实的内容，不要延后到补全阶段。');
      }
      return lines.join('\n');
    }

    function applyCaseGenOptionToSharedSettings(key, value) {
      if (!state.caseGenSettings || typeof state.caseGenSettings !== 'object') {
        state.caseGenSettings = createDefaultCaseGenSettings();
      }
      var settings = state.caseGenSettings;
      if (key === 'customRequirement') {
        settings.customRequirement = String(value || '');
        return settings;
      }
      if (
        key === 'dedupeSimplify' ||
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
        settings[key] = value === true;
        if (key === 'needSpecial' && value !== true) {
          settings.specialRepeatOperation = false;
          settings.specialMultiTouch = false;
          settings.specialRepeatExecution = false;
          settings.specialWeakNetwork = false;
          settings.specialInterruptResume = false;
        }
        return settings;
      }
      settings[key] = value;
      return settings;
    }

    function setCaseGenOption(key, value) {
      applyCaseGenOptionToSharedSettings(key, value);
      if (casesGenApi && typeof casesGenApi.setCaseGenSettingValue === 'function') {
        casesGenApi.setCaseGenSettingValue(key, value);
      }
      markPrepNeedsReconfirm(false);
      persistXmindState(false);
    }

    function dispatchNativeChange(target) {
      if (!target || !target.dispatchEvent) return;
      var changeEvent = null;
      if (typeof Event === 'function') {
        changeEvent = new Event('change', { bubbles: true, cancelable: true });
      } else if (document && document.createEvent) {
        changeEvent = document.createEvent('Event');
        changeEvent.initEvent('change', true, true);
      }
      if (changeEvent) target.dispatchEvent(changeEvent);
    }

    function renderPrepStepTabs() {
      var prep = getPrepState();
      var requirementDone = hasRequirementReady();
      var casesDone = requirementDone && hasCaseStepReady();
      var kbState = getActiveKnowledgeBaseState();
      var steps = [
        { step: STEP_REQUIREMENT, label: '需求导入', shortLabel: 'step1', done: requirementDone },
        { step: STEP_CASES, label: '是否导入用例', shortLabel: 'step2', done: casesDone },
        { step: STEP_OPTIONS, label: '生成选项', shortLabel: 'step3', done: prep.completed === true && casesDone },
      ];
      return '<div class="xmind-casegen-prep-stepper-row">'
        + '<div class="xmind-casegen-prep-stepper">'
        + steps.map(function(item) {
          var classes = ['xmind-casegen-prep-step'];
          if (prep.step === item.step) classes.push('is-active');
          else if (item.done) classes.push('is-done');
          return '<span class="' + classes.join(' ') + '" data-prep-step="' + item.step + '" title="' + escapeHtml(item.label) + '"' + (prep.step === item.step ? ' aria-current="step"' : '') + '>'
            + '<span class="xmind-casegen-prep-step-badge">' + escapeHtml(item.shortLabel) + '</span>'
            + '</span>';
        }).join('')
        + '</div>'
        + (kbState.usedInLatestGeneration === true
          ? '<span class="xmind-casegen-kb-used-badge xmind-casegen-kb-used-badge-inline">已使用知识库</span>'
          : '')
        + '</div>';
    }

    function renderRequirementStepCard() {
      var prep = getPrepState();
      var locked = isPrepBaseLocked();
      var mode = prep.requirementMode || '';
      var readonlyAttr = locked ? ' readonly' : '';
      var disabledAttr = locked ? ' disabled' : '';
      var rawTextEl = document.getElementById('rawText');
      var docValue = rawTextEl && rawTextEl.value ? String(rawTextEl.value).trim() : '';
      var docImportName = state.lastRawImportName ? String(state.lastRawImportName).trim() : '';
      var docImageCount = getDocumentRequirementImageCount();
      var docStatusText = docValue
        ? ('已导入' + (docImportName ? '：' + docImportName + '，' : '，') + '正文 ' + String(docValue.length) + ' 字，图片 ' + String(docImageCount) + ' 张')
        : '导入后内容会同步到当前需求上下文';
      var manualLabel = getManualRequirementLabelText();
      var manualText = getManualRequirementText();
      var manualImages = getManualRequirementImages();
      var manualImagesHtml = manualImages.map(function(item, index) {
        var name = item && item.name ? String(item.name) : ('图片' + (index + 1));
        return '<div class="xmind-casegen-prep-image-item">'
          + '<img src="' + escapeHtml(item.dataUrl || '') + '" alt="' + escapeHtml(name) + '" />'
          + '<div class="xmind-casegen-prep-image-item-copy">'
          +   '<span>' + escapeHtml(name) + '</span>'
          +   '<button type="button" class="link-toggle" data-prep-action="remove-manual-image" data-image-index="' + index + '"' + disabledAttr + '>移除</button>'
          + '</div>'
          + '</div>';
      }).join('');
      return ''
        + '<div class="xmind-casegen-prep-card xmind-casegen-prep-card-main ' + (locked ? 'is-readonly' : '') + '">'
        +   '<div class="xmind-casegen-prep-card-head">'
        +     '<div class="xmind-casegen-prep-card-copy">'
        +       '<span class="xmind-casegen-prep-step-order">step1</span>'
        +       '<strong class="xmind-casegen-prep-card-title">需求导入</strong>'
        +     '</div>'
        +     '<span class="xmind-casegen-prep-status-badge is-' + (hasRequirementReady() ? 'done' : 'ready') + '" data-prep-card-status="current">' + (hasRequirementReady() ? '已完成' : '待完成') + '</span>'
        +   '</div>'
        +   (locked ? '<div class="xmind-casegen-prep-warning">当前步骤仅可查看，若要调整需求或参考用例，请开始新的生成准备。</div>' : '')
        +   '<div class="xmind-casegen-prep-choice-grid">'
        +     '<label class="xmind-casegen-prep-choice is-success ' + (mode === 'document' ? 'is-active ' : '') + (locked ? 'is-readonly' : '') + '">'
        +       '<input type="radio" name="xmindRequirementMode" value="document" ' + (mode === 'document' ? 'checked ' : '') + disabledAttr + ' />'
        +       '<span class="xmind-casegen-prep-choice-title">导入需求文档</span>'
        +       '<span class="xmind-casegen-prep-choice-desc">复用现有需求导入链路，可补充说明。</span>'
        +     '</label>'
        +     '<label class="xmind-casegen-prep-choice is-success ' + (mode === 'manual' ? 'is-active ' : '') + (locked ? 'is-readonly' : '') + '">'
        +       '<input type="radio" name="xmindRequirementMode" value="manual" ' + (mode === 'manual' ? 'checked ' : '') + disabledAttr + ' />'
        +       '<span class="xmind-casegen-prep-choice-title">填写需求描述</span>'
        +       '<span class="xmind-casegen-prep-choice-desc">支持文本和图片。</span>'
        +     '</label>'
        +   '</div>'
        +   (mode === 'document'
          ? ''
            + '<div class="xmind-casegen-prep-field">'
            +   '<label>需求文档</label>'
            +   '<div class="zone xmind-casegen-prep-dropzone' + (locked ? ' is-disabled' : '') + '"'
            +     ' id="xmindCaseGenPrepRequirementDropzone"'
            +     ' data-prep-action="import-requirement"'
            +     ' role="button"'
            +     ' tabindex="' + (locked ? '-1' : '0') + '"'
            +     ' aria-disabled="' + (locked ? 'true' : 'false') + '">'
            +     '<div class="zone-line">'
            +       '<strong>原始需求</strong>'
            +       '<span>拖拽或点击选择</span>'
            +     '</div>'
            +     '<div class="status' + (docValue ? ' ok' : '') + '">' + escapeHtml(docStatusText) + '</div>'
            +   '</div>'
            + '</div>'
            + '<div class="xmind-casegen-prep-field">'
            +   '<label for="xmindCaseGenRequirementSupplement">需求补充</label>'
            +   '<textarea id="xmindCaseGenRequirementSupplement" data-prep-input="requirementSupplement" placeholder="非必填，会与需求文档一起作为生成上下文。"' + readonlyAttr + disabledAttr + '>' + escapeHtml(prep.requirementSupplement || '') + '</textarea>'
            + '</div>'
          : '')
        +   (mode === 'manual'
          ? ''
            + '<div class="xmind-casegen-prep-field">'
            +   '<label for="xmindCaseGenManualRequirementLabel">需求名称</label>'
            +   '<input id="xmindCaseGenManualRequirementLabel" data-prep-input="manualRequirementLabel" type="text" maxlength="80" placeholder="必填，将作为根节点标题。"' + readonlyAttr + disabledAttr + ' value="' + escapeHtml(manualLabel) + '" />'
            + '</div>'
            + '<div class="xmind-casegen-prep-field">'
            +   '<label for="xmindCaseGenManualRequirementText">需求描述</label>'
            +   '<textarea id="xmindCaseGenManualRequirementText" data-manual-requirement-text="1" placeholder="请输入需求描述；也可直接粘贴图片到此区域。"' + readonlyAttr + disabledAttr + '>' + escapeHtml(manualText) + '</textarea>'
            + '</div>'
            + '<div class="xmind-casegen-prep-field">'
            +   '<label>需求图片</label>'
            +   '<div class="xmind-casegen-prep-upload-row">'
            +     '<button type="button" class="secondary" data-prep-action="upload-manual-images"' + disabledAttr + '>上传图片</button>'
            +     '<span class="hint">' + (manualImages.length ? ('已添加 ' + String(manualImages.length) + ' 张') : '支持上传或粘贴图片') + '</span>'
            +   '</div>'
            +   '<div class="xmind-casegen-prep-image-list">' + manualImagesHtml + '</div>'
            + '</div>'
          : '')
        + '</div>';
    }

    function renderCasesStepCard() {
      var prep = getPrepState();
      var locked = isPrepBaseLocked();
      var mode = prep.caseImportMode || '';
      var disabledAttr = locked ? ' disabled' : '';
      var casesInfo = buildCasesSummaryInfo();
      var importedCaseFileListHtml = hasImportedBaselineCases()
        ? ('<span class="file-chip">' + escapeHtml(casesInfo.title || '已导入已有用例') + '</span>')
        : '<span class="hint" data-xmind-casegen-case-placeholder="1">未导入文件</span>';
      var caseStatusText = hasImportedBaselineCases()
        ? casesInfo.meta
        : '导入结果同步到当前 XMind 主树基线';
      return ''
        + '<div class="xmind-casegen-prep-card xmind-casegen-prep-card-main ' + (locked ? 'is-readonly' : '') + '">'
        +   '<div class="xmind-casegen-prep-card-head">'
        +     '<div class="xmind-casegen-prep-card-copy">'
        +       '<span class="xmind-casegen-prep-step-order">step2</span>'
        +       '<strong class="xmind-casegen-prep-card-title">是否导入用例</strong>'
        +     '</div>'
        +     '<span class="xmind-casegen-prep-status-badge is-' + (hasCaseStepReady() ? 'done' : 'ready') + '" data-prep-card-status="current">' + (hasCaseStepReady() ? '已完成' : '待选择') + '</span>'
        +   '</div>'
        +   (locked ? '<div class="xmind-casegen-prep-warning">当前步骤仅可查看，导入方式和内容已在本次生成中锁定。</div>' : '')
        +   '<div class="xmind-casegen-prep-choice-grid">'
        +     '<label class="xmind-casegen-prep-choice is-success ' + (mode === 'skip' ? 'is-active ' : '') + (locked ? 'is-readonly' : '') + '">'
        +       '<input type="radio" name="xmindCaseImportMode" value="skip" ' + (mode === 'skip' ? 'checked ' : '') + disabledAttr + ' />'
        +       '<span class="xmind-casegen-prep-choice-title">不导入用例</span>'
        +       '<span class="xmind-casegen-prep-choice-desc">主树只展示 AI 生成内容。</span>'
        +     '</label>'
        +     '<label class="xmind-casegen-prep-choice is-success ' + (mode === 'import' ? 'is-active ' : '') + (locked ? 'is-readonly' : '') + '">'
        +       '<input type="radio" name="xmindCaseImportMode" value="import" ' + (mode === 'import' ? 'checked ' : '') + disabledAttr + ' />'
        +       '<span class="xmind-casegen-prep-choice-title">导入已有用例</span>'
        +       '<span class="xmind-casegen-prep-choice-desc">导入后作为主树基线。</span>'
        +     '</label>'
        +   '</div>'
        +   (mode === 'import'
          ? ''
            + '<div class="xmind-casegen-prep-field">'
            +   '<label>参考用例来源</label>'
            +   '<div class="zone xmind-casegen-prep-dropzone' + (locked ? ' is-disabled' : '') + '"'
            +     ' id="xmindCaseGenPrepCasesDropzone"'
            +     ' data-prep-action="import-cases"'
            +     ' role="button"'
            +     ' tabindex="' + (locked ? '-1' : '0') + '"'
            +     ' aria-disabled="' + (locked ? 'true' : 'false') + '">'
            +     '<div class="zone-line">'
            +       '<strong>测试用例</strong>'
            +       '<span>拖拽或点击选择</span>'
            +     '</div>'
            +     '<div class="status' + (hasImportedBaselineCases() ? ' ok' : '') + '">' + escapeHtml(caseStatusText) + '</div>'
            +   '</div>'
            +   '<div class="actions case-library-import-actions xmind-casegen-prep-upload-actions">'
            +     '<button type="button" class="secondary case-library-import-btn" data-prep-action="select-cases-library"' + disabledAttr + '>从用例库选择</button>'
            +   '</div>'
            +   '<div class="file-list xmind-casegen-prep-filelist">'
            +     importedCaseFileListHtml
            +   '</div>'
            + '</div>'
          : '<p class="hint">' + escapeHtml(casesInfo.meta) + '</p>')
        + '</div>';
    }

    function renderOptionToggleCard(config) {
      var meta = config || {};
      var checked = meta.checked === true;
      var disabled = meta.disabled === true;
      var classes = ['xmind-casegen-prep-toggle'];
      classes.push(checked ? 'is-on' : 'is-off');
      if (disabled) classes.push('is-disabled');
      return ''
        + '<label class="' + classes.join(' ') + '" data-casegen-setting-card="' + escapeHtml(String(meta.key || '')) + '">'
        +   '<input type="checkbox" data-casegen-setting="' + escapeHtml(String(meta.key || '')) + '" ' + (checked ? 'checked ' : '') + (disabled ? 'disabled' : '') + ' />'
        +   '<span class="xmind-casegen-prep-toggle-main">'
        +     '<span class="xmind-casegen-prep-toggle-copy">'
        +       '<span class="xmind-casegen-prep-toggle-title">' + escapeHtml(meta.title || '') + '</span>'
        +       '<span class="xmind-casegen-prep-toggle-desc">' + escapeHtml(meta.desc || '') + '</span>'
        +     '</span>'
        +     '<span class="xmind-casegen-prep-toggle-switch" aria-hidden="true">'
        +       '<span class="xmind-casegen-prep-toggle-state xmind-casegen-prep-toggle-state-on">开</span>'
        +       '<span class="xmind-casegen-prep-toggle-state xmind-casegen-prep-toggle-state-off">关</span>'
        +       '<span class="xmind-casegen-prep-toggle-knob"></span>'
        +     '</span>'
        +   '</span>'
        + '</label>';
    }

    function syncPrepOptionToggleDom() {
      if (!summaryDialogBodyEl) return;
      var settings = getCaseGenSettingsSnapshot();
      var specialEnabled = settings.needSpecial === true;
      var keys = [
        'dedupeSimplify',
        'needFunctionCondition',
        'needNumericValidation',
        'needBoundary',
        'needMobile',
        'needSpecial',
        'specialRepeatOperation',
        'specialMultiTouch',
        'specialRepeatExecution',
        'specialWeakNetwork',
        'specialInterruptResume',
      ];
      keys.forEach(function(key) {
        var inputEl = summaryDialogBodyEl.querySelector('input[data-casegen-setting="' + key + '"]');
        if (!inputEl) return;
        var isSpecialKey = key.indexOf('special') === 0;
        var disabled = isSpecialKey && !specialEnabled;
        var checked = settings[key] === true;
        inputEl.checked = checked;
        inputEl.disabled = disabled;
        var card = inputEl.closest ? inputEl.closest('[data-casegen-setting-card]') : null;
        if (card && card.classList) {
          card.classList.toggle('is-on', checked);
          card.classList.toggle('is-off', !checked);
          card.classList.toggle('is-disabled', disabled);
        }
      });
      var specialGroup = summaryDialogBodyEl.querySelector('[data-casegen-special-group]');
      if (specialGroup && specialGroup.classList) {
        specialGroup.classList.toggle('is-disabled', !specialEnabled);
      }
      var specialDesc = summaryDialogBodyEl.querySelector('[data-casegen-special-desc]');
      if (specialDesc) {
        specialDesc.textContent = specialEnabled
          ? '按需补足本轮要覆盖的特殊场景。'
          : '先开启“考虑特殊场景”，再选择具体细项。';
      }
    }

    function renderOptionsStepCard() {
      var prep = getPrepState();
      var settings = getCaseGenSettingsSnapshot();
      var locked = isPrepBaseLocked();
      var dedupeHtml = ''
        + renderOptionToggleCard({
          key: 'dedupeSimplify',
          title: '去重并精简',
          desc: '关闭时仅去除重复或高度重叠用例；开启后在保证覆盖质量前提下压缩冗余。',
          checked: settings.dedupeSimplify === true
        });
      var primaryHtml = ''
        + renderOptionToggleCard({
          key: 'needFunctionCondition',
          title: '考虑功能使用条件',
          desc: '补足解锁、可用、身份门槛、前置任务和时段限制。',
          checked: settings.needFunctionCondition === true
        })
        + renderOptionToggleCard({
          key: 'needNumericValidation',
          title: '数值验证',
          desc: '补足范围、阈值变化、累计扣减和结算正确性。',
          checked: settings.needNumericValidation === true
        })
        + renderOptionToggleCard({
          key: 'needBoundary',
          title: '考虑边界',
          desc: '补足上下限、临界值、空值和异常边界。',
          checked: settings.needBoundary === true
        })
        + renderOptionToggleCard({
          key: 'needMobile',
          title: '考虑移动设备',
          desc: '补足手势、横竖屏和系统打断等移动端场景。',
          checked: settings.needMobile === true
        })
        + renderOptionToggleCard({
          key: 'needSpecial',
          title: '考虑特殊场景',
          desc: '开启后可继续选择弱网、中断恢复等特殊场景。',
          checked: settings.needSpecial === true
        });
      var specialHtml = ''
        + renderOptionToggleCard({
          key: 'specialRepeatOperation',
          title: '重复操作',
          desc: '连续点击、重复提交或重复领取。',
          checked: settings.specialRepeatOperation === true,
          disabled: settings.needSpecial !== true
        })
        + renderOptionToggleCard({
          key: 'specialMultiTouch',
          title: '多点触控',
          desc: '双指、误触连击和多点同时操作。',
          checked: settings.specialMultiTouch === true,
          disabled: settings.needSpecial !== true
        })
        + renderOptionToggleCard({
          key: 'specialRepeatExecution',
          title: '重复执行',
          desc: '反复进入退出和连续重复执行流程。',
          checked: settings.specialRepeatExecution === true,
          disabled: settings.needSpecial !== true
        })
        + renderOptionToggleCard({
          key: 'specialWeakNetwork',
          title: '弱网',
          desc: '高延迟、超时、断续连接和重试恢复。',
          checked: settings.specialWeakNetwork === true,
          disabled: settings.needSpecial !== true
        })
        + renderOptionToggleCard({
          key: 'specialInterruptResume',
          title: '中断恢复',
          desc: '来电、切后台、锁屏或重启后的恢复。',
          checked: settings.specialInterruptResume === true,
          disabled: settings.needSpecial !== true
        });
      return ''
        + '<div class="xmind-casegen-prep-card xmind-casegen-prep-card-main">'
        +   '<div class="xmind-casegen-prep-card-head">'
        +     '<div class="xmind-casegen-prep-card-copy">'
        +       '<span class="xmind-casegen-prep-step-order">step3</span>'
        +       '<strong class="xmind-casegen-prep-card-title">生成选项</strong>'
        +     '</div>'
        +     '<span class="xmind-casegen-prep-status-badge is-' + (prep.completed ? 'done' : 'ready') + '" data-prep-card-status="current">' + (prep.completed ? '已确认' : (locked ? '待重新确认' : '待确认')) + '</span>'
        +   '</div>'
        +   '<div class="xmind-casegen-prep-warning">' + escapeHtml(locked
              ? 'step1 和 step2 已锁定，本次仅可调整生成选项并重新确认。'
              : '确认后，step1 和 step2 在本次生成中都不可更改。') + '</div>'
        +   '<div class="xmind-casegen-prep-field">'
        +     '<label for="xmindCaseGenOptionCustomRequirement">额外要求</label>'
        +     '<textarea id="xmindCaseGenOptionCustomRequirement" data-casegen-setting="customRequirement" placeholder="非必填，用于补充生成要求。">' + escapeHtml(settings.customRequirement || '') + '</textarea>'
        +   '</div>'
        +   '<div class="xmind-casegen-prep-option-stack">'
        +     '<div class="xmind-casegen-prep-option-group">'
        +       '<div class="xmind-casegen-prep-option-group-head">'
        +         '<strong class="xmind-casegen-prep-option-group-title">去重设置</strong>'
        +         '<span class="xmind-casegen-prep-option-group-desc">控制全量生成后的自动 AI 去重和工具栏手动 AI 去重。</span>'
        +       '</div>'
        +       '<div class="xmind-casegen-prep-toggle-grid">' + dedupeHtml + '</div>'
        +     '</div>'
        +     '<div class="xmind-casegen-prep-option-group">'
        +       '<div class="xmind-casegen-prep-option-group-head">'
        +         '<strong class="xmind-casegen-prep-option-group-title">基础生成开关</strong>'
        +         '<span class="xmind-casegen-prep-option-group-desc">先把覆盖策略选好，再回到画布触发生成。</span>'
        +       '</div>'
        +       '<div class="xmind-casegen-prep-toggle-grid">' + primaryHtml + '</div>'
        +     '</div>'
        +     '<div class="xmind-casegen-prep-option-group ' + (settings.needSpecial ? '' : 'is-disabled') + '" data-casegen-special-group>'
        +       '<div class="xmind-casegen-prep-option-group-head">'
        +         '<strong class="xmind-casegen-prep-option-group-title">特殊场景细项</strong>'
        +         '<span class="xmind-casegen-prep-option-group-desc" data-casegen-special-desc>' + (settings.needSpecial ? '按需补足本轮要覆盖的特殊场景。' : '先开启“考虑特殊场景”，再选择具体细项。') + '</span>'
        +       '</div>'
        +       '<div class="xmind-casegen-prep-toggle-grid xmind-casegen-prep-toggle-grid-compact">' + specialHtml + '</div>'
        +   '</div>'
        + '</div>';
    }

    function renderPrepFooter() {
      var prep = getPrepState();
      var step = clampPrepStep(prep.step);
      var nextDisabled = false;
      var resetDisabled = hasAnyRunningGenerationOperation();
      if (step === STEP_REQUIREMENT) nextDisabled = !hasRequirementReady();
      if (step === STEP_CASES) nextDisabled = !hasCaseStepReady();
      return '<div class="xmind-casegen-prep-footer">'
        + '<div class="xmind-casegen-prep-footer-side">'
        +   '<button type="button" class="secondary xmind-casegen-prep-reset-btn" id="xmindCaseGenPrepResetBtn" data-prep-action="reset-prep" '
        +     (resetDisabled ? 'disabled' : '') + '>重置</button>'
        + '</div>'
        + '<div class="xmind-casegen-prep-nav">'
        +   (step > STEP_REQUIREMENT
          ? '<button type="button" class="secondary" data-prep-nav="prev">上一步</button>'
          : '')
        +   '<div class="xmind-casegen-prep-nav-main">'
        +   (step < STEP_OPTIONS
          ? '<button type="button" data-prep-nav="next" ' + (nextDisabled ? 'disabled' : '') + '>下一步</button>'
          : '<button type="button" data-prep-nav="confirm">确认并保存</button>')
        +   '</div>'
        + '</div>'
        + '</div>';
    }

    function renderPrepDialog() {
      if (!summaryDialogBodyEl) return;
      var prep = getPrepState();
      var currentStep = clampPrepStep(prep.step);
      if (prep.step !== currentStep) prep.step = currentStep;
      var mainHtml = '';
      if (currentStep === STEP_REQUIREMENT) mainHtml = renderRequirementStepCard();
      else if (currentStep === STEP_CASES) mainHtml = renderCasesStepCard();
      else mainHtml = renderOptionsStepCard();
      summaryDialogBodyEl.innerHTML = ''
        + '<div class="xmind-casegen-prep-flow">'
        +   renderPrepStepTabs()
        +   mainHtml
        +   renderPrepFooter()
        + '</div>';
    }

    function getCoverageStatusMeta(status) {
      var stable = String(status || '');
      if (stable === 'covered') return { key: 'covered', label: '已覆盖', className: 'is-covered' };
      if (stable === 'partial') return { key: 'partial', label: '部分覆盖', className: 'is-partial' };
      if (stable === 'context') return { key: 'context', label: '非测试需求/上下文', className: 'is-context' };
      return { key: 'uncovered', label: '未覆盖', className: 'is-uncovered' };
    }

    function buildCoverageCaseMap(result) {
      var map = {};
      (result && Array.isArray(result.cases) ? result.cases : []).forEach(function(item) {
        if (!item || !item.id) return;
        map[String(item.id || '')] = item;
      });
      return map;
    }

    function getCoverageSegmentCaseIds(segment) {
      var direct = Array.isArray(segment && segment.directCaseIds) ? segment.directCaseIds : [];
      var related = Array.isArray(segment && segment.relatedCaseIds) ? segment.relatedCaseIds : [];
      var fallback = Array.isArray(segment && segment.caseIds) ? segment.caseIds : [];
      var seen = {};
      var result = [];
      direct.concat(related).forEach(function(id) {
        var stableId = String(id || '');
        if (!stableId || seen[stableId]) return;
        seen[stableId] = true;
        result.push(stableId);
      });
      if (!result.length) {
        fallback.forEach(function(id) {
          var stableId = String(id || '');
          if (!stableId || seen[stableId]) return;
          seen[stableId] = true;
          result.push(stableId);
        });
      }
      return result;
    }

    function getCoverageCaseRelation(segment, caseId) {
      var stableId = String(caseId || '');
      var related = Array.isArray(segment && segment.relatedCaseIds) ? segment.relatedCaseIds : [];
      for (var i = 0; i < related.length; i += 1) {
        if (String(related[i] || '') === stableId) return 'related';
      }
      return 'direct';
    }

    function getCoverageCasePriorityMeta(item) {
      var raw = item && typeof item === 'object'
        ? String(item.priority || item.level || item['优先级'] || '').trim()
        : '';
      var label = raw ? raw.toUpperCase() : '未定';
      var key = label === 'P0' || label === 'P1' || label === 'P2' ? label.toLowerCase() : 'unknown';
      return {
        label: label,
        className: 'is-' + key,
      };
    }

    function getCoverageCurrentRequestInfo() {
      try {
        return {
          request: buildCoverageSourceRequest(),
          error: '',
        };
      } catch (err) {
        return {
          request: null,
          error: err && err.message ? String(err.message || '') : '需求覆盖分析上下文不可用',
        };
      }
    }

    function isCoverageResultStale(coverageState, requestInfo) {
      var result = coverageState && coverageState.result ? coverageState.result : null;
      var request = requestInfo && requestInfo.request ? requestInfo.request : null;
      if (!result || !request) return false;
      var resultSignature = coverageState.signature || result.signature || '';
      return Boolean(resultSignature && request.signature && String(resultSignature) !== String(request.signature));
    }

    function getSelectedCoverageSegment(result, coverageState) {
      var segments = result && Array.isArray(result.segments) ? result.segments : [];
      if (!segments.length) return null;
      var selectedId = coverageState && coverageState.selectedSegmentId ? String(coverageState.selectedSegmentId || '') : '';
      var found = null;
      if (selectedId) {
        segments.some(function(item) {
          if (item && String(item.id || '') === selectedId) {
            found = item;
            return true;
          }
          return false;
        });
      }
      if (found) return found;
      return segments[0] || null;
    }

    function findCoverageSegmentsByCaseId(result, caseId) {
      var stableCaseId = String(caseId || '');
      var segments = result && Array.isArray(result.segments) ? result.segments : [];
      if (!stableCaseId || !segments.length) return [];
      return segments.filter(function(segment) {
        return getCoverageSegmentCaseIds(segment).indexOf(stableCaseId) !== -1;
      });
    }

    function getCoverageSelectedSegmentList(result, selected, highlightedCaseId) {
      var highlightedId = String(highlightedCaseId || '');
      var matches = highlightedId ? findCoverageSegmentsByCaseId(result, highlightedId) : [];
      if (matches.length) return matches;
      return selected ? [selected] : [];
    }

    function buildCoverageSummaryHtml(result, stale) {
      var summary = result && result.summary ? result.summary : {};
      var total = Number(summary.total || 0) || 0;
      var context = Number(summary.context || 0) || 0;
      var effectiveTotal = Math.max(0, total - context);
      var percent = Number(summary.coveragePercent);
      if (!Number.isFinite(percent)) percent = effectiveTotal > 0 ? 0 : 100;
      return ''
        + '<div class="xmind-casegen-coverage-summary" data-coverage-summary>'
        +   '<span class="xmind-casegen-coverage-score">' + escapeHtml(String(percent)) + '%</span>'
        +   '<span>需求覆盖</span>'
        +   '<span class="xmind-casegen-coverage-summary-dot" aria-hidden="true"></span>'
        +   buildCoverageStatusJumpButton('covered', '已覆盖', Number(summary.covered || 0) || 0, 'xmind-casegen-coverage-summary-jump')
        +   buildCoverageStatusJumpButton('partial', '部分', Number(summary.partial || 0) || 0, 'xmind-casegen-coverage-summary-jump')
        +   buildCoverageStatusJumpButton('uncovered', '未覆盖', Number(summary.uncovered || 0) || 0, 'xmind-casegen-coverage-summary-jump')
        +   buildCoverageStatusJumpButton('context', '上下文', context, 'xmind-casegen-coverage-summary-jump')
        +   (stale ? '<span class="xmind-casegen-coverage-stale-pill">已过期</span>' : '')
        + '</div>';
    }

    function buildCoverageStatusJumpButton(status, label, count, extraClass) {
      var stableStatus = String(status || '');
      var stableLabel = String(label || '');
      var stableCount = Number(count || 0) || 0;
      var disabled = stableCount <= 0;
      var title = disabled
        ? ('暂无' + stableLabel + '片段')
        : ('定位下一处' + stableLabel + '片段，共 ' + String(stableCount) + ' 处');
      return '<button type="button" class="' + escapeHtml(String(extraClass || '')) + ' is-' + escapeHtml(stableStatus) + '"'
        + ' data-coverage-jump="' + escapeHtml(stableStatus) + '"'
        + ' title="' + escapeHtml(title) + '"'
        + (disabled ? ' disabled' : '')
        + '>'
        + escapeHtml(stableLabel + ' ' + String(stableCount))
      + '</button>';
    }

    function getCoverageSummaryCount(result, key) {
      var summary = result && result.summary ? result.summary : {};
      return Number(summary && summary[key] || 0) || 0;
    }

    function buildCoverageSourceLegendHtml(result) {
      var items = [
        { key: 'covered', label: '已覆盖', countKey: 'covered', sample: '实线' },
        { key: 'partial', label: '部分覆盖', countKey: 'partial', sample: '虚线' },
        { key: 'uncovered', label: '未覆盖', countKey: 'uncovered', sample: '普通正文' },
        { key: 'context', label: '上下文', countKey: 'context', sample: '灰色正文' },
      ];
      return '<div class="xmind-casegen-coverage-source-legend" aria-label="需求原文覆盖状态图例">'
        + items.map(function(item) {
          var className = 'is-' + item.key;
          return '<button type="button" class="xmind-casegen-coverage-source-legend-item ' + className + '"'
            + ' data-coverage-jump="' + escapeHtml(item.key) + '"'
            + ' title="' + escapeHtml('定位下一处' + item.label + '片段，共 ' + String(getCoverageSummaryCount(result, item.countKey)) + ' 处') + '"'
            + (getCoverageSummaryCount(result, item.countKey) <= 0 ? ' disabled' : '')
            + '>'
            + '<span class="xmind-casegen-coverage-source-legend-sample ' + className + '">' + escapeHtml(item.sample) + '</span>'
            + '<span>' + escapeHtml(item.label) + ' ' + escapeHtml(String(getCoverageSummaryCount(result, item.countKey))) + '</span>'
          + '</button>';
        }).join('')
      + '</div>';
    }

    function buildCoverageNoticeHtml(coverageState, requestInfo, stale) {
      var notices = [];
      if (coverageState && coverageState.running === true) {
        notices.push({
          className: 'is-running',
          text: '正在分析当前可见用例对需求原文的覆盖，完成后会自动刷新结果。',
          spinner: true,
        });
      }
      if (stale) {
        notices.push({
          className: 'is-stale',
          text: '当前需求或可见用例已变化，下面展示的是上一次分析结果。',
        });
      }
      if (requestInfo && requestInfo.error) {
        notices.push({
          className: 'is-error',
          text: requestInfo.error,
        });
      }
      if (coverageState && coverageState.error) {
        notices.push({
          className: 'is-error',
          text: coverageState.error,
        });
      }
      return notices.map(function(item) {
        return '<div class="xmind-casegen-coverage-notice ' + escapeHtml(item.className) + '">'
          + (item.spinner ? '<span class="xmind-casegen-coverage-spinner" aria-hidden="true"></span>' : '')
          + '<span>' + escapeHtml(item.text) + '</span>'
        + '</div>';
      }).join('');
    }

    function readCoverageSourceScrollState() {
      var scroller = summaryDialogBodyEl && summaryDialogBodyEl.querySelector
        ? summaryDialogBodyEl.querySelector('[data-coverage-source-scroll]')
        : null;
      if (!scroller) return null;
      return {
        top: Number(scroller.scrollTop || 0) || 0,
        left: Number(scroller.scrollLeft || 0) || 0,
      };
    }

    function restoreCoverageSourceScrollState(scrollState) {
      if (!scrollState) return;
      function applyScroll() {
        var scroller = summaryDialogBodyEl && summaryDialogBodyEl.querySelector
          ? summaryDialogBodyEl.querySelector('[data-coverage-source-scroll]')
          : null;
        if (!scroller) return;
        scroller.scrollTop = Number(scrollState.top || 0) || 0;
        scroller.scrollLeft = Number(scrollState.left || 0) || 0;
      }
      applyScroll();
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(applyScroll);
      }
    }

    function findCoverageSourceSegmentElement(segmentId) {
      var targetId = String(segmentId || '');
      if (!targetId || !summaryDialogBodyEl || !summaryDialogBodyEl.querySelectorAll) return null;
      var list = summaryDialogBodyEl.querySelectorAll('[data-coverage-segment]');
      for (var i = 0; i < list.length; i += 1) {
        if (String(list[i].getAttribute('data-coverage-segment') || '') === targetId) return list[i];
      }
      return null;
    }

    function readCoverageSourceAnchorState(segmentId) {
      var scroller = summaryDialogBodyEl && summaryDialogBodyEl.querySelector
        ? summaryDialogBodyEl.querySelector('[data-coverage-source-scroll]')
        : null;
      var target = findCoverageSourceSegmentElement(segmentId);
      if (!scroller || !target || !scroller.getBoundingClientRect || !target.getBoundingClientRect) return null;
      var scrollerRect = scroller.getBoundingClientRect();
      var targetRect = target.getBoundingClientRect();
      return {
        segmentId: String(segmentId || ''),
        offsetTop: Number(targetRect.top - scrollerRect.top) || 0,
        left: Number(scroller.scrollLeft || 0) || 0,
      };
    }

    function restoreCoverageSourceAnchorState(anchorState) {
      if (!anchorState || !anchorState.segmentId) return;
      function applyScroll() {
        var scroller = summaryDialogBodyEl && summaryDialogBodyEl.querySelector
          ? summaryDialogBodyEl.querySelector('[data-coverage-source-scroll]')
          : null;
        var target = findCoverageSourceSegmentElement(anchorState.segmentId);
        if (!scroller || !target || !scroller.getBoundingClientRect || !target.getBoundingClientRect) return;
        var scrollerRect = scroller.getBoundingClientRect();
        var targetRect = target.getBoundingClientRect();
        var currentOffsetTop = Number(targetRect.top - scrollerRect.top) || 0;
        scroller.scrollTop = (Number(scroller.scrollTop || 0) || 0) + currentOffsetTop - (Number(anchorState.offsetTop || 0) || 0);
        scroller.scrollLeft = Number(anchorState.left || 0) || 0;
      }
      applyScroll();
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(applyScroll);
      }
    }

    function releaseCoverageRequirementImageObjectUrls() {
      if (!coverageRequirementImageObjectUrls.length) return;
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        coverageRequirementImageObjectUrls.forEach(function(url) {
          if (url) URL.revokeObjectURL(url);
        });
      }
      coverageRequirementImageObjectUrls = [];
    }

    function createCoverageRequirementImageUrl(item) {
      if (!item || typeof item !== 'object') return '';
      var dataUrl = String(item.dataUrl || '');
      if (dataUrl.indexOf('data:image/') === 0) return dataUrl;
      var blob = item.blob || item.file || null;
      if (!blob || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return '';
      try {
        var objectUrl = URL.createObjectURL(blob);
        coverageRequirementImageObjectUrls.push(objectUrl);
        return objectUrl;
      } catch (err) {
        return '';
      }
    }

    function collectCoverageRequirementMediaItems(result) {
      var source = getSelectedRequirementSource();
      var resultText = result && result.requirementText ? String(result.requirementText || '').trim() : '';
      var sourceText = source && source.text ? String(source.text || '').trim() : '';
      if (!resultText || resultText !== sourceText) return [];
      var images = source && Array.isArray(source.images) ? source.images : [];
      var items = [];
      images.forEach(function(item, index) {
        if (!item || typeof item !== 'object') return;
        var url = createCoverageRequirementImageUrl(item);
        if (!url) return;
        var hasOffset = Number.isFinite(Number(item.textOffset)) && Number(item.textOffset) >= 0;
        var sourceType = String(item.source || source.mode || '').toLowerCase();
        var label = sourceType === 'paste'
          ? '粘贴图片'
          : (sourceType === 'manual' ? '手填需求图片' : '需求图片');
        var order = Number(item.index || index + 1) || (index + 1);
        items.push({
          url: url,
          label: label + ' ' + String(order),
          alt: item.name ? String(item.name || '') : (label + ' ' + String(order)),
          offset: hasOffset ? Number(item.textOffset) : Number.POSITIVE_INFINITY,
          order: order,
        });
      });
      items.sort(function(a, b) {
        if (a.offset !== b.offset) return a.offset - b.offset;
        return a.order - b.order;
      });
      return items;
    }

    function buildCoverageSourceImageHtml(item) {
      if (!item || !item.url) return '';
      return '<figure class="xmind-casegen-coverage-image" data-coverage-media="image">'
        + '<img src="' + escapeHtml(item.url) + '" alt="' + escapeHtml(item.alt || item.label || '需求图片') + '" loading="lazy" />'
        + '<figcaption>' + escapeHtml(item.label || '需求图片') + '</figcaption>'
      + '</figure>';
    }

    function buildCoverageSourceSegmentHtml(segment, selected, highlightedCaseId, textOverride) {
      var meta = getCoverageStatusMeta(segment && segment.status);
      var caseIds = getCoverageSegmentCaseIds(segment);
      var directCount = Array.isArray(segment && segment.directCaseIds) ? segment.directCaseIds.length : caseIds.length;
      var relatedCount = Array.isArray(segment && segment.relatedCaseIds) ? segment.relatedCaseIds.length : 0;
      var classes = ['xmind-casegen-coverage-segment', meta.className];
      if (selected && String(selected.id || '') === String(segment.id || '')) classes.push('is-active');
      if (highlightedCaseId && caseIds.indexOf(highlightedCaseId) !== -1) classes.push('is-case-highlighted');
      var reason = segment && segment.reason ? String(segment.reason || '') : '';
      var titleText = meta.label + ' / 直接 ' + String(directCount) + ' 条，关联 ' + String(relatedCount) + ' 条' + (reason ? ' / ' + reason : '');
      var displayText = textOverride !== undefined && textOverride !== null
        ? String(textOverride || '')
        : String(segment && segment.text ? segment.text : '');
      return '<button type="button" class="' + classes.join(' ') + '"'
        + ' data-coverage-segment="' + escapeHtml(segment && segment.id ? segment.id : '') + '"'
        + ' data-coverage-status="' + escapeHtml(meta.key || '') + '"'
        + ' title="' + escapeHtml(titleText) + '">'
        + '<span class="xmind-casegen-coverage-doc-text">' + escapeHtml(displayText) + '</span>'
      + '</button>';
    }

    function buildCoverageDocumentHtml(result, segments, selected, highlightedCaseId, mediaItems) {
      var fullText = result && result.requirementText ? String(result.requirementText || '') : '';
      var media = Array.isArray(mediaItems) ? mediaItems : [];
      function buildRemainingMediaHtml() {
        return media.map(function(item) {
          return buildCoverageSourceImageHtml(item);
        }).join('');
      }
      if (!fullText) {
        return segments.map(function(segment) {
          return buildCoverageSourceSegmentHtml(segment, selected, highlightedCaseId, segment && segment.text ? segment.text : '');
        }).join('\n') + buildRemainingMediaHtml();
      }
      var cursor = 0;
      var pieces = [];
      var matchedAll = true;
      var mediaCursor = 0;

      function appendTextRangeWithMedia(start, end) {
        var pos = start;
        while (
          mediaCursor < media.length
          && media[mediaCursor]
          && media[mediaCursor].offset !== Number.POSITIVE_INFINITY
          && media[mediaCursor].offset <= end
        ) {
          var item = media[mediaCursor];
          var offset = Math.max(start, Math.min(end, Number(item.offset || 0) || 0));
          if (offset > pos) pieces.push(escapeHtml(fullText.slice(pos, offset)));
          pieces.push(buildCoverageSourceImageHtml(item));
          pos = offset;
          mediaCursor += 1;
        }
        if (end > pos) pieces.push(escapeHtml(fullText.slice(pos, end)));
      }

      function appendMediaUpTo(offset) {
        while (
          mediaCursor < media.length
          && media[mediaCursor]
          && media[mediaCursor].offset !== Number.POSITIVE_INFINITY
          && media[mediaCursor].offset <= offset
        ) {
          pieces.push(buildCoverageSourceImageHtml(media[mediaCursor]));
          mediaCursor += 1;
        }
      }

      function appendTrailingMedia() {
        while (mediaCursor < media.length) {
          pieces.push(buildCoverageSourceImageHtml(media[mediaCursor]));
          mediaCursor += 1;
        }
      }

      segments.forEach(function(segment) {
        if (!matchedAll) return;
        var segmentText = String(segment && segment.text ? segment.text : '');
        if (!segmentText) return;
        var index = fullText.indexOf(segmentText, cursor);
        if (index < 0) {
          matchedAll = false;
          return;
        }
        if (index > cursor) appendTextRangeWithMedia(cursor, index);
        appendMediaUpTo(index);
        pieces.push(buildCoverageSourceSegmentHtml(segment, selected, highlightedCaseId, segmentText));
        cursor = index + segmentText.length;
        appendMediaUpTo(cursor);
      });
      if (!matchedAll) {
        return segments.map(function(segment) {
          return buildCoverageSourceSegmentHtml(segment, selected, highlightedCaseId, segment && segment.text ? segment.text : '');
        }).join('\n') + buildRemainingMediaHtml();
      }
      if (cursor < fullText.length) appendTextRangeWithMedia(cursor, fullText.length);
      appendTrailingMedia();
      return pieces.join('');
    }

    function buildCoverageSourceHtml(result, coverageState) {
      var segments = result && Array.isArray(result.segments) ? result.segments : [];
      if (!segments.length) {
        return '<div class="xmind-casegen-coverage-empty">暂无需求覆盖分析结果。</div>';
      }
      var selected = getSelectedCoverageSegment(result, coverageState);
      var highlightedCaseId = coverageHighlightedCaseId ? String(coverageHighlightedCaseId || '') : '';
      var mediaItems = collectCoverageRequirementMediaItems(result);
      return '<article class="xmind-casegen-coverage-segment-list xmind-casegen-coverage-document" data-coverage-source-scroll>'
        + buildCoverageDocumentHtml(result, segments, selected, highlightedCaseId, mediaItems)
        + '</article>';
    }

    function buildCoverageSelectedSegmentsHtml(result, selected, highlightedCaseId) {
      var highlightedId = String(highlightedCaseId || '');
      var segments = getCoverageSelectedSegmentList(result, selected, highlightedId);
      if (!segments.length) {
        return '<div class="xmind-casegen-coverage-empty">请选择左侧需求片段查看对应用例。</div>';
      }
      var selectedId = selected && selected.id ? String(selected.id || '') : '';
      var title = highlightedId && segments.length > 1 ? '用例关联片段' : '当前片段';
      var countText = segments.length > 1 ? ('共 ' + String(segments.length) + ' 处') : '1 处';
      return '<div class="xmind-casegen-coverage-selected-card" data-coverage-selected-card>'
        + '<div class="xmind-casegen-coverage-selected-card-head">'
        +   '<strong>' + escapeHtml(title) + '</strong>'
        +   '<span>' + escapeHtml(countText) + '</span>'
        + '</div>'
        + '<div class="xmind-casegen-coverage-selected-list">'
        + segments.map(function(segment) {
          var meta = getCoverageStatusMeta(segment && segment.status);
          var active = selectedId && String(segment && segment.id ? segment.id : '') === selectedId;
          var relation = highlightedId ? getCoverageCaseRelation(segment, highlightedId) : '';
          var relationLabel = relation === 'related' ? '关联' : (relation === 'direct' ? '直接' : '');
          return '<button type="button" class="xmind-casegen-coverage-selected-item ' + (active ? 'is-active ' : '') + escapeHtml(meta.className || '') + '"'
            + ' data-coverage-selected-segment="' + escapeHtml(segment && segment.id ? segment.id : '') + '"'
            + ' title="' + escapeHtml('定位到需求原文片段') + '">'
            + '<span class="xmind-casegen-coverage-selected-head">'
            +   '<span class="xmind-casegen-coverage-segment-id">' + escapeHtml(segment && segment.id ? segment.id : '') + '</span>'
            +   '<span class="xmind-casegen-coverage-status ' + escapeHtml(meta.className) + '">' + escapeHtml(meta.label) + '</span>'
            +   (relationLabel ? '<span class="xmind-casegen-coverage-case-relation ' + (relation === 'related' ? 'is-related' : 'is-direct') + '">' + escapeHtml(relationLabel) + '</span>' : '')
            + '</span>'
            + '<span class="xmind-casegen-coverage-selected-text">' + escapeHtml(segment && segment.text ? segment.text : '') + '</span>'
          + '</button>';
        }).join('')
        + '</div>'
      + '</div>';
    }

    function buildCoverageCaseListHtml(result, coverageState) {
      var selected = getSelectedCoverageSegment(result, coverageState);
      var caseMap = buildCoverageCaseMap(result);
      if (!selected) {
        return '<div class="xmind-casegen-coverage-empty">请选择左侧需求片段查看对应用例。</div>';
      }
      var caseIds = getCoverageSegmentCaseIds(selected);
      var caseHtml = caseIds.map(function(id) {
        var item = caseMap[id];
        if (!item) return '';
        var active = coverageHighlightedCaseId && String(coverageHighlightedCaseId || '') === String(id || '');
        var relation = getCoverageCaseRelation(selected, id);
        var relationLabel = relation === 'related' ? '关联' : '直接';
        var priority = getCoverageCasePriorityMeta(item);
        return '<button type="button" class="xmind-casegen-coverage-case ' + (active ? 'is-active ' : '') + (relation === 'related' ? 'is-related' : 'is-direct') + '" data-coverage-case="' + escapeHtml(id) + '">'
          + '<span class="xmind-casegen-coverage-case-module">' + escapeHtml(item.module || '未命名模块') + '</span>'
          + '<span class="xmind-casegen-coverage-case-title-wrap">'
          +   '<span class="xmind-casegen-coverage-case-title">' + escapeHtml(item.title || '未命名用例') + '</span>'
          +   '<span class="xmind-casegen-coverage-case-priority ' + escapeHtml(priority.className) + '">' + escapeHtml(priority.label) + '</span>'
          +   '<span class="xmind-casegen-coverage-case-relation ' + (relation === 'related' ? 'is-related' : 'is-direct') + '">' + escapeHtml(relationLabel) + '</span>'
          + '</span>'
        + '</button>';
      }).join('');
      if (!caseHtml) {
        caseHtml = '<div class="xmind-casegen-coverage-empty">'
          + (selected.status === 'context'
            ? '该片段被识别为背景或上下文信息，不需要直接挂接用例。'
            : '该片段暂未找到直接或关联对应的用例。')
          + '</div>';
      }
      var unmappedCount = result && Array.isArray(result.unmappedCaseIds) ? result.unmappedCaseIds.length : 0;
      return ''
        + buildCoverageSelectedSegmentsHtml(result, selected, coverageHighlightedCaseId)
        + '<div class="xmind-casegen-coverage-case-list">' + caseHtml + '</div>'
        + (unmappedCount > 0
          ? '<div class="xmind-casegen-coverage-unmapped">另有 ' + escapeHtml(String(unmappedCount)) + ' 条用例未直接或关联映射到需求原文，默认不计入需求本身覆盖率。</div>'
          : '');
    }

    function scrollCoverageSourceSegmentIntoView(segmentId) {
      function applyScroll() {
        var target = findCoverageSourceSegmentElement(segmentId);
        if (!target || typeof target.scrollIntoView !== 'function') return;
        target.scrollIntoView({ block: 'center', inline: 'nearest' });
      }
      applyScroll();
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(applyScroll);
      }
    }

    function findNextCoverageSegmentByStatus(result, currentSegmentId, status) {
      var segments = result && Array.isArray(result.segments) ? result.segments : [];
      var stableStatus = String(status || '');
      if (!stableStatus || !segments.length) return null;
      var matches = segments.filter(function(segment) {
        return segment && String(segment.status || '') === stableStatus;
      });
      if (!matches.length) return null;
      var currentId = String(currentSegmentId || '');
      var currentMatchIndex = -1;
      for (var i = 0; i < matches.length; i += 1) {
        if (String(matches[i].id || '') === currentId) {
          currentMatchIndex = i;
          break;
        }
      }
      if (currentMatchIndex >= 0) return matches[(currentMatchIndex + 1) % matches.length];
      var currentIndex = -1;
      segments.some(function(segment, index) {
        if (segment && String(segment.id || '') === currentId) {
          currentIndex = index;
          return true;
        }
        return false;
      });
      if (currentIndex >= 0) {
        for (var j = 0; j < matches.length; j += 1) {
          if (Number(matches[j].index || 0) > currentIndex) return matches[j];
        }
      }
      return matches[0];
    }

    function jumpToCoverageStatus(status) {
      var stableStatus = String(status || '');
      if (!stableStatus) return false;
      var coverageState = ensureCoverageUiState();
      var result = coverageState.result && typeof coverageState.result === 'object' ? coverageState.result : null;
      var target = findNextCoverageSegmentByStatus(result, coverageState.selectedSegmentId, stableStatus);
      if (!target || !target.id) return false;
      coverageState.selectedSegmentId = String(target.id || '');
      coverageHighlightedCaseId = '';
      coverageState.updatedAt = Date.now();
      persistXmindState(false);
      renderCoverageDialog({ resetSourceScroll: true });
      scrollCoverageSourceSegmentIntoView(target.id);
      return true;
    }

    function renderCoverageDialog(options) {
      if (!summaryDialogBodyEl) return;
      var opts = options || {};
      var sourceAnchorState = opts.sourceAnchorState || null;
      var sourceScrollState = opts.resetSourceScroll === true || sourceAnchorState ? null : readCoverageSourceScrollState();
      releaseCoverageRequirementImageObjectUrls();
      var coverageState = ensureCoverageUiState();
      var requestInfo = getCoverageCurrentRequestInfo();
      var result = coverageState.result && typeof coverageState.result === 'object' ? coverageState.result : null;
      var stale = isCoverageResultStale(coverageState, requestInfo);
      var summaryHtml = result ? buildCoverageSummaryHtml(result, stale) : '';
      var noticeHtml = buildCoverageNoticeHtml(coverageState, requestInfo, stale);
      var actionDisabled = coverageState.running === true || Boolean(requestInfo.error);
      if (!result && coverageState.running !== true) {
        noticeHtml += '<div class="xmind-casegen-coverage-notice is-stale">尚未生成需求覆盖分析结果。</div>';
      }
      var reanalyzeLabel = coverageState.running === true
        ? '<span class="xmind-casegen-coverage-spinner" aria-hidden="true"></span><span>分析中</span>'
        : (result ? '重新分析' : '开始分析');
      summaryDialogBodyEl.innerHTML = ''
        + '<div class="xmind-casegen-coverage-panel">'
        +   '<div class="xmind-casegen-coverage-toolbar">'
        +     '<div class="xmind-casegen-coverage-toolbar-copy">'
        +       summaryHtml
        +       noticeHtml
        +     '</div>'
        +     '<button type="button" class="secondary xmind-casegen-coverage-reanalyze ' + (coverageState.running === true ? 'is-running' : '') + '" data-coverage-action="reanalyze" ' + (coverageState.running === true ? 'aria-busy="true" ' : '') + (actionDisabled ? 'disabled' : '') + '>'
        +       reanalyzeLabel
        +     '</button>'
        +   '</div>'
        +   '<div class="xmind-casegen-coverage-layout">'
        +     '<section class="xmind-casegen-coverage-source" aria-label="需求原文覆盖片段">'
        +       '<div class="xmind-casegen-coverage-column-head">'
        +         '<strong>需求原文</strong>'
        +         '<span>点击片段查看对应用例</span>'
        +       '</div>'
        +       (result ? buildCoverageSourceLegendHtml(result) : '')
        +       (result ? buildCoverageSourceHtml(result, coverageState) : '<div class="xmind-casegen-coverage-empty">分析完成后会在这里按原文顺序展示覆盖状态。</div>')
        +     '</section>'
        +     '<section class="xmind-casegen-coverage-cases" aria-label="对应用例">'
        +       '<div class="xmind-casegen-coverage-column-head">'
        +         '<strong>对应用例</strong>'
        +         '<span>仅展示模块和用例名</span>'
        +       '</div>'
        +       (result ? buildCoverageCaseListHtml(result, coverageState) : '<div class="xmind-casegen-coverage-empty">请选择或等待左侧片段分析结果。</div>')
        +     '</section>'
        +   '</div>'
        + '</div>';
      if (sourceAnchorState) restoreCoverageSourceAnchorState(sourceAnchorState);
      else restoreCoverageSourceScrollState(sourceScrollState);
    }

    function ensureManualImageInput() {
      if (manualImageInputEl) return manualImageInputEl;
      manualImageInputEl = document.createElement('input');
      manualImageInputEl.type = 'file';
      manualImageInputEl.accept = 'image/*';
      manualImageInputEl.multiple = true;
      manualImageInputEl.className = 'hidden';
      manualImageInputEl.addEventListener('change', function(event) {
        var files = event && event.target && event.target.files ? Array.prototype.slice.call(event.target.files) : [];
        appendManualRequirementImages(files).then(function(ok) {
          if (ok) {
            notifyStatus('已添加需求图片', 'ok');
            renderOpenedSummaryDialog();
          }
        });
        manualImageInputEl.value = '';
      });
      document.body.appendChild(manualImageInputEl);
      return manualImageInputEl;
    }

    function triggerRequirementImport() {
      if (isPrepBaseLocked()) return;
      setPrepField('requirementMode', 'document');
      try {
        if (window.app) window.app.__xmindCasegenScopedRequirementImportUntil = Date.now() + 10000;
      } catch (err) {}
      var input = document.getElementById('fileInput');
      if (input && typeof input.click === 'function') input.click();
    }

    function getPrepRequirementDropzone(target) {
      if (!target || !target.closest) return null;
      return target.closest('#xmindCaseGenPrepRequirementDropzone');
    }

    function getPrepCasesDropzone(target) {
      if (!target || !target.closest) return null;
      return target.closest('#xmindCaseGenPrepCasesDropzone');
    }

    function dispatchFilesToInput(input, fileList) {
      if (!input || !fileList) return false;
      var normalized = Array.isArray(fileList)
        ? fileList.filter(Boolean)
        : Array.prototype.slice.call(fileList || []).filter(Boolean);
      if (!normalized.length) return false;
      var files = null;
      if (typeof DataTransfer !== 'undefined') {
        try {
          var dt = new DataTransfer();
          if (dt.items && typeof dt.items.add === 'function') {
            normalized.forEach(function(file) {
              dt.items.add(file);
            });
            files = dt.files || null;
          }
        } catch (err) {}
      }
      if (!files || !files.length) return false;
      try {
        input.files = files;
      } catch (assignErr) {
        return false;
      }
      var changeEvent = null;
      if (typeof Event === 'function') {
        changeEvent = new Event('change', { bubbles: true });
      } else if (document && document.createEvent) {
        changeEvent = document.createEvent('Event');
        changeEvent.initEvent('change', true, false);
      }
      if (!changeEvent) return false;
      input.dispatchEvent(changeEvent);
      return true;
    }

    function importRequirementFileFromDrop(file) {
      if (isPrepBaseLocked()) return false;
      if (!file) return false;
      setPrepField('requirementMode', 'document');
      try {
        if (window.app) window.app.__xmindCasegenScopedRequirementImportUntil = Date.now() + 10000;
      } catch (err) {}
      var input = document.getElementById('fileInput');
      if (!input) return false;
      if (dispatchFilesToInput(input, [file])) return true;
      notifyStatus('当前环境暂不支持拖拽导入，请点击选择文件', 'warn');
      return false;
    }

    function importCasesFilesFromDrop(fileList) {
      if (isPrepBaseLocked()) return false;
      var files = Array.isArray(fileList)
        ? fileList.filter(Boolean)
        : Array.prototype.slice.call(fileList || []).filter(Boolean);
      if (!files.length) return false;
      setPrepField('caseImportMode', 'import');
      var input = document.getElementById('caseFileInput');
      if (!input) return false;
      if (dispatchFilesToInput(input, files)) return true;
      notifyStatus('当前环境暂不支持拖拽导入，请点击选择文件', 'warn');
      return false;
    }

    function triggerCasesImport() {
      if (isPrepBaseLocked()) return;
      setPrepField('caseImportMode', 'import');
      var input = document.getElementById('caseFileInput');
      if (input && typeof input.click === 'function') input.click();
    }

    function preserveXmindDrawerForNestedDrawer(ttlMs) {
      var ttl = Number(ttlMs);
      if (!Number.isFinite(ttl) || ttl <= 0) ttl = 1200;
      try {
        if (!window.app) return;
        window.app.__drawerSkipCloseId = 'xmindCaseGenDrawer';
        window.app.__drawerCloseGuard = {
          id: 'xmindCaseGenDrawer',
          until: Date.now() + ttl,
        };
      } catch (err) {}
    }

    function triggerCasesLibrarySelect() {
      if (isPrepBaseLocked()) return;
      setPrepField('caseImportMode', 'import');
      preserveXmindDrawerForNestedDrawer(1600);
      var caseLibraryApi = window.app && window.app.caseLibraryApi ? window.app.caseLibraryApi : null;
      if (caseLibraryApi && typeof caseLibraryApi.openImportSelectDrawer === 'function') {
        caseLibraryApi.openImportSelectDrawer();
        return;
      }
      var btn = document.getElementById('caseLibraryImportSelectBtn');
      if (btn && typeof btn.click === 'function') btn.click();
    }

    function hideOpenMindContextMenu() {
      var mindElixirCoreApi = getMindElixirCoreApi();
      if (mindElixirCoreApi && typeof mindElixirCoreApi.hideOpenContextMenu === 'function') {
        try {
          mindElixirCoreApi.hideOpenContextMenu();
        } catch (err) {
          // ignore
        }
      }
      if (typeof document === 'undefined' || !document.querySelectorAll) return;
      var menus = document.querySelectorAll('.xmind-node-context-menu');
      if (!menus || !menus.length) return;
      Array.prototype.forEach.call(menus, function(menu) {
        if (!menu || !menu.classList) return;
        menu.classList.remove('is-open');
        if (menu.setAttribute) menu.setAttribute('aria-hidden', 'true');
      });
    }

    function openSummaryDialog(step) {
      if (!hasActiveWorkspace()) {
        notifyFloatingStatus('请先新建生成页签', 'warn', 2500);
        return;
      }
      hideOpenMindContextMenu();
      var prep = getPrepState();
      if (isPrepBaseLocked()) {
        prep.step = STEP_OPTIONS;
      } else {
        prep.step = clampPrepStep(Number(step) >= STEP_REQUIREMENT && Number(step) <= STEP_OPTIONS
          ? Number(step)
          : prep.step);
      }
      summaryDialogMode = 'prep';
      summaryDialogOpen = true;
      applySummaryDialogState();
    }

    function openHistoryDialog() {
      if (!hasActiveWorkspace()) {
        notifyFloatingStatus('请先新建生成页签', 'warn', 2500);
        return;
      }
      hideOpenMindContextMenu();
      summaryDialogMode = 'history';
      summaryDialogOpen = true;
      applySummaryDialogState();
    }

    function openCoverageDialog(options) {
      var opts = options || {};
      if (!hasActiveWorkspace()) {
        notifyFloatingStatus('请先新建生成页签', 'warn', 2500);
        return;
      }
      var runningOperations = collectRunningGenerationOperations();
      var coverageState = ensureCoverageUiState();
      if (runningOperations.length > 0 && coverageState.running !== true) {
        notifyStatus('当前有 XMind 任务进行中，请等待完成后再查看覆盖', 'warn', { forceInline: true });
        return;
      }
      var request = null;
      try {
        request = buildCoverageSourceRequest();
      } catch (err) {
        notifyStatus(err && err.message ? err.message : '需求覆盖分析上下文不可用', 'warn', { forceInline: true });
        return;
      }
      hideOpenMindContextMenu();
      coverageHighlightedCaseId = '';
      summaryDialogMode = 'coverage';
      summaryDialogOpen = true;
      if (coverageState.result && !coverageState.selectedSegmentId) {
        coverageState.selectedSegmentId = String(coverageState.result.selectedSegmentId || '');
      }
      applySummaryDialogState();
      var hasResult = Boolean(coverageState.result);
      var resultSignature = coverageState.signature || (coverageState.result && coverageState.result.signature) || '';
      var stale = hasResult && resultSignature && String(resultSignature || '') !== String(request.signature || '');
      var shouldStart = opts.force === true || (!hasResult && coverageState.running !== true);
      if (stale && opts.force !== true) {
        persistXmindState(false);
        return;
      }
      if (shouldStart) {
        startRequirementCoverageTask({
          request: request,
          force: opts.force === true,
        });
      } else {
        persistXmindState(false);
      }
    }

    function closeSummaryDialog(options) {
      syncSummaryDraftIntoState();
      summaryDialogOpen = false;
      if (!(options && options.skipPersist === true)) persistXmindState(true);
      applySummaryDialogState();
      releaseCoverageRequirementImageObjectUrls();
      renderWorkspaceTabs();
    }

    function applySummaryDialogState() {
      var open = summaryDialogOpen === true;
      var mode = summaryDialogMode === 'history'
        ? 'history'
        : (summaryDialogMode === 'knowledge-base'
          ? 'knowledge-base'
          : (summaryDialogMode === 'coverage' ? 'coverage' : 'prep'));
      if (summaryOverlayEl) {
        summaryOverlayEl.hidden = !open;
        summaryOverlayEl.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (summaryOverlayEl.classList) {
          summaryOverlayEl.classList.toggle('hidden', !open);
          summaryOverlayEl.classList.toggle('is-open', open);
        }
      }
      if (summaryBtn) {
        summaryBtn.setAttribute('aria-expanded', open && mode === 'prep' ? 'true' : 'false');
        summaryBtn.textContent = '生成前置准备';
      }
      if (historyBtn) {
        historyBtn.setAttribute('aria-expanded', open && mode === 'history' ? 'true' : 'false');
        historyBtn.textContent = '生成记录';
      }
      if (knowledgeRuleBtn) {
        knowledgeRuleBtn.setAttribute('aria-expanded', open && mode === 'knowledge-base' ? 'true' : 'false');
      }
      if (knowledgeAiBtn) {
        knowledgeAiBtn.setAttribute('aria-expanded', open && mode === 'knowledge-base' ? 'true' : 'false');
      }
      if (coverageBtn) {
        coverageBtn.setAttribute('aria-expanded', open && mode === 'coverage' ? 'true' : 'false');
      }
      if (summaryDialogEl && summaryDialogEl.classList) {
        summaryDialogEl.classList.toggle('xmind-casegen-coverage-dialog', open && mode === 'coverage');
      }
      if (summaryDialogBodyEl && summaryDialogBodyEl.classList) {
        summaryDialogBodyEl.classList.toggle('xmind-casegen-coverage-dialog-body', open && mode === 'coverage');
      }
      if (summaryDialogTitleEl) {
        summaryDialogTitleEl.textContent = mode === 'history'
          ? '生成记录'
          : (mode === 'knowledge-base'
            ? '知识库检索结果'
            : (mode === 'coverage' ? '需求覆盖' : '生成前置准备'));
      }
      if (summaryDialogDescEl) {
        summaryDialogDescEl.textContent = mode === 'history'
          ? '记录当前 XMind 用例生成里每次节点操作的结果摘要。'
          : (mode === 'knowledge-base'
            ? '展示当前页签最近一次知识检索与 AI 筛选的状态和最终筛选内容。'
            : (mode === 'coverage'
              ? '查看当前可见用例对需求原文本身的覆盖关系。'
              : '按 3 步完成前置准备，确认后 step1 和 step2 会在本次生成中锁定。'));
      }
      if (!open) return;
      if (mode === 'history') {
        renderHistoryDialog();
        return;
      }
      if (mode === 'knowledge-base') {
        renderKnowledgeBaseDialog();
        return;
      }
      if (mode === 'coverage') {
        renderCoverageDialog();
        return;
      }
      renderPrepDialog();
    }

    function setPrepStep(step) {
      var next = clampPrepStep(step);
      setPrepField('step', next);
      renderOpenedSummaryDialog();
    }

    function handlePrepNav(actionId) {
      var prep = getPrepState();
      var currentStep = clampPrepStep(prep.step);
      if (actionId === 'prev') {
        setPrepStep(currentStep - 1);
        return true;
      }
      if (actionId === 'next') {
        if (currentStep === STEP_REQUIREMENT && !hasRequirementReady()) return false;
        if (currentStep === STEP_CASES && !hasCaseStepReady()) return false;
        setPrepStep(currentStep + 1);
        return true;
      }
      if (actionId === 'confirm') {
        syncSummaryDraftIntoState({ preserveCompleted: true });
        if (!hasRequirementReady() || !hasCaseStepReady()) return false;
        var shouldCenterRoot = prep.completed !== true && String(prep.caseImportMode || '') === 'import';
        prep.baseLocked = true;
        prep.completed = true;
        prep.step = STEP_OPTIONS;
        persistXmindState(true);
        notifySuccessToast('已保存生成前置准备', 3000);
        closeSummaryDialog({ skipPersist: true });
        render({
          reason: 'prep-confirmed',
          persist: false,
          centerRootAfterRender: true,
          skipRestorableViewState: true,
        });
        if (shouldCenterRoot) centerRootNodeView({ persist: true });
        return true;
      }
      return false;
    }

    function requestPrepReset() {
      if (hasAnyRunningGenerationOperation()) {
        notifyFloatingStatus('当前仍有生成任务进行中，请等待完成后再重置', 'warn', 5000);
        return Promise.resolve(false);
      }
      return openStoreConfirmDialog({
        title: '确认重置前置准备',
        message: '确认后会清空当前 XMind 画布中的导入和生成结果，并把生成前置准备恢复到初始状态。是否继续？',
        confirmText: '确认重置',
        cancelText: '取消',
      }).then(function(confirmed) {
        if (!confirmed) return false;
        return resetXmindCasegenState({
          reason: 'prep-manual-reset',
          reopenPrepDialog: true,
          toastText: '已重置当前 XMind 生成内容',
          toastDurationMs: 3000,
        });
      });
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
      if (workspaceShadowDepth > 0) return false;
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
        record.updatedAt = Date.now();
        return false;
      }
      if (
        (workspaceSnapshotHasContent(record.snapshot) && !currentActiveWorkspaceHasContent())
        || shouldRestoreGeneratedState
        || (snapshotRequirementIdentity && !currentRequirementIdentity)
        || shouldRestoreDrawerState
        || shouldRestoreViewportState
      ) {
        if (shouldPreserveSnapshotDrawerIntent) {
          hydrateWorkspaceSnapshot(activeId, { keepDrawerOpen: false });
        } else {
          hydrateWorkspaceSnapshot(activeId, { keepDrawerOpen: isDrawerOpen() });
        }
        return true;
      }
      return false;
    }

    function getWorkspaceOrder() {
      return ensureWorkspaceHostState().workspaceOrder.slice();
    }

    function isWorkspaceDirty(workspaceId) {
      var record = getWorkspaceRecord(workspaceId);
      if (!record || !record.snapshot) return false;
      return workspaceSnapshotHasGeneratedContent(record.snapshot);
    }

    function workspaceNeedsCloseConfirm(workspaceId) {
      var stableId = String(workspaceId || '');
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

    function safeParseWorkspaceCaseList(rawValue) {
      var raw = rawValue === null || rawValue === undefined ? '' : String(rawValue || '');
      if (!raw.trim()) return [];
      var parsed = parseCaseList(raw);
      if (parsed.length) return parsed;
      try {
        var data = JSON.parse(stripCodeFence(raw) || '[]');
        if (Array.isArray(data)) return data;
      } catch (err) {
        // fall through to text parser
      }
      if (xmindGenApi && typeof xmindGenApi.deriveCaseListFromText === 'function') {
        var derived = xmindGenApi.deriveCaseListFromText(raw);
        return Array.isArray(derived) ? derived : [];
      }
      return [];
    }

    function getSnapshotBaselineCaseList(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var shared = source.shared && typeof source.shared === 'object'
        ? source.shared
        : {};
      var xmind = source.xmind && typeof source.xmind === 'object'
        ? source.xmind
        : {};
      var prep = xmind.prep && typeof xmind.prep === 'object' ? xmind.prep : null;
      var importedCases = Array.isArray(shared.importedCases) ? shared.importedCases : [];
      var rawList = [];
      if (!prep || prep.caseImportMode !== 'import') return rawList;
      if (importedCases.length) {
        importedCases.forEach(function(item) {
          if (!item || typeof item !== 'object') return;
          if (Array.isArray(item.list) && item.list.length) {
            rawList = rawList.concat(item.list.filter(Boolean));
            return;
          }
          if (item.text && String(item.text || '').trim()) {
            rawList = rawList.concat(safeParseWorkspaceCaseList(item.text));
          }
        });
      } else if (shared.caseText && String(shared.caseText || '').trim()) {
        rawList = safeParseWorkspaceCaseList(shared.caseText);
      }
      var deletedBaselineModules = buildDeletedBaselineModuleMapFromList(xmind.deletedBaselineModuleKeys);
      var deletedBaselineCases = buildDeletedBaselineCaseMapFromList(xmind.deletedBaselineCaseKeys);
      return rawList.filter(function(item) {
        if (!item || typeof item !== 'object') return false;
        var moduleTitle = normalizeModuleTitle(item.module || item.module_name || item['模块'] || '未命名模块');
        var moduleKey = normalizeModuleKey(moduleTitle);
        if (!moduleKey) return false;
        if (deletedBaselineModules[moduleKey]) return false;
        var caseDeleteKey = buildBaselineCaseDeleteKey(moduleTitle, buildCaseSignature(item, moduleTitle));
        if (caseDeleteKey && deletedBaselineCases[caseDeleteKey]) return false;
        return true;
      });
    }

    function buildWorkspaceVisibleModuleContextFromSnapshot(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var shared = source.shared && typeof source.shared === 'object'
        ? source.shared
        : {};
      var xmind = source.xmind && typeof source.xmind === 'object'
        ? source.xmind
        : {};
      var modules = Array.isArray(shared.caseGenModules) ? shared.caseGenModules : [];
      var results = shared.caseGenResults && typeof shared.caseGenResults === 'object'
        ? shared.caseGenResults
        : {};
      var xmindRoot = xmind.root && typeof xmind.root === 'object' ? xmind.root : {};
      var moduleStates = xmind.modules && typeof xmind.modules === 'object' ? xmind.modules : {};
      var includeAiLayer = xmindRoot.hideAiLayer !== true;
      var baselineGrouped = groupCasesByModule(getSnapshotBaselineCaseList(snapshot));
      var order = baselineGrouped.order.slice();
      var map = {};

      order.forEach(function(key) {
        var info = baselineGrouped.map[key];
        map[key] = {
          moduleKey: key,
          title: info.title,
          baselineCases: info.cases.slice(),
          aiCases: [],
          aiModule: null,
          aiModuleId: '',
        };
      });

      if (includeAiLayer !== false) modules.forEach(function(mod, index) {
        if (!mod) return;
        var title = normalizeModuleTitle(mod.title || mod.module || ('模块' + (index + 1)));
        var key = normalizeModuleKey(title);
        var moduleId = String(mod.id || '');
        if (!key) return;
        if (!map[key]) {
          map[key] = {
            moduleKey: key,
            title: title,
            baselineCases: [],
            aiCases: [],
            aiModule: null,
            aiModuleId: '',
          };
          order.push(key);
        }
        map[key].aiModule = mod;
        map[key].aiModuleId = moduleId;
        map[key].title = title;
        var moduleState = moduleId && moduleStates[moduleId] && typeof moduleStates[moduleId] === 'object'
          ? moduleStates[moduleId]
          : null;
        map[key].aiCases = moduleState && moduleState.hideResults === true
          ? []
          : safeParseWorkspaceCaseList(moduleId ? results[moduleId] : '');
      });
      return {
        order: order,
        map: map,
        list: order.map(function(key) { return map[key]; }),
      };
    }

    function summarizeVisibleModuleContext(context) {
      var list = context && Array.isArray(context.list) ? context.list : [];
      var caseCount = 0;
      list.forEach(function(entry) {
        caseCount += getVisibleCasesForModuleEntry(entry).length;
      });
      return {
        moduleCount: list.length,
        caseCount: caseCount,
      };
    }

    function ensureDedupeUiState() {
      var xmindState = ensureState();
      if (!xmindState.dedupe || typeof xmindState.dedupe !== 'object') {
        xmindState.dedupe = createDefaultDedupeState();
      }
      return xmindState.dedupe;
    }

    function ensureCoverageUiState() {
      var xmindState = ensureState();
      xmindState.coverage = normalizeCoverageState(xmindState.coverage);
      return xmindState.coverage;
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

    function collectAiDedupeModulesFromContext(context) {
      var modules = [];
      (context && Array.isArray(context.list) ? context.list : []).forEach(function(entry) {
        if (!entry || !entry.aiModuleId) return;
        var cases = Array.isArray(entry.aiCases) ? entry.aiCases : [];
        var normalizedCases = cases.map(function(item) {
          return normalizeCaseItem(item, entry.title);
        }).filter(Boolean);
        if (!normalizedCases.length) return;
        modules.push({
          moduleId: String(entry.aiModuleId || ''),
          moduleKey: String(entry.moduleKey || normalizeModuleKey(entry.title || '')),
          module: normalizeModuleTitle(entry.title || ''),
          key_scenarios: entry.aiModule && Array.isArray(entry.aiModule.scenarios) ? entry.aiModule.scenarios.slice() : [],
          test_points: entry.aiModule && Array.isArray(entry.aiModule.points) ? entry.aiModule.points.slice() : [],
          coupled_modules: entry.aiModule && Array.isArray(entry.aiModule.coupled) ? entry.aiModule.coupled.slice() : [],
          cases: normalizedCases,
        });
      });
      return modules;
    }

    function collectCurrentAiDedupeModules(options) {
      return collectAiDedupeModulesFromContext(buildVisibleModuleContext(options));
    }

    function collectAiModulesWithoutCasesFromContext(context) {
      var result = [];
      (context && Array.isArray(context.list) ? context.list : []).forEach(function(entry) {
        if (!entry || !entry.aiModuleId) return;
        var cases = Array.isArray(entry.aiCases) ? entry.aiCases : [];
        if (cases.length > 0) return;
        result.push({
          moduleId: String(entry.aiModuleId || ''),
          moduleKey: String(entry.moduleKey || normalizeModuleKey(entry.title || '')),
          module: normalizeModuleTitle(entry.title || ''),
        });
      });
      return result;
    }

    function buildRootPipelineDedupeReadiness(context) {
      var visibleContext = ensureVisibleModuleContext(context);
      var pipeline = getRootPipelineState();
      var generatedDedupeModules = normalizeRootPipelineDedupeModules(
        pipeline && Array.isArray(pipeline.generatedDedupeModules)
          ? pipeline.generatedDedupeModules
          : []
      );
      if (hasRootPipelineDedupeCases(generatedDedupeModules)) {
        return {
          missingModules: [],
          dedupeModules: generatedDedupeModules,
          ready: true,
        };
      }
      var missingModules = collectAiModulesWithoutCasesFromContext(visibleContext);
      var dedupeModules = collectAiDedupeModulesFromContext(visibleContext);
      return {
        missingModules: missingModules,
        dedupeModules: dedupeModules,
        ready: missingModules.length === 0 && dedupeModules.length > 0,
      };
    }

    function hasVisibleAiCasesForDedupe() {
      return collectCurrentAiDedupeModules().length > 0;
    }

    function hasWorkspaceFailedState(snapshot) {
      var xmind = snapshot && snapshot.xmind && typeof snapshot.xmind === 'object'
        ? snapshot.xmind
        : {};
      return String(xmind.summaryResultKind || '') === 'error';
    }

    function listWorkspaceProgressItems() {
      var host = ensureWorkspaceHostState();
      var activeId = String(getWorkspaceUiSelectedId() || '');
      var liveWorkspaceId = String(host.activeWorkspaceId || '');
      var canUseLiveSummary = shouldXmindOwnLiveWorkspaceState();
      return host.workspaceOrder.slice(0, WORKSPACE_MAX).map(function(id) {
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
      }).filter(function(item) {
        return Boolean(item);
      });
    }

    function getWorkspaceModuleMirrorPayload(workspaceId) {
      var host = ensureWorkspaceHostState();
      var order = Array.isArray(host.workspaceOrder) ? host.workspaceOrder.slice(0, WORKSPACE_MAX) : [];
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
      var summary = record ? buildWorkspaceTabSummary(record, {
        running: hasWorkspaceRunningTasks(activeId),
        dirty: !hasWorkspaceRunningTasks(activeId) && isWorkspaceDirty(activeId),
        live: shouldXmindOwnLiveWorkspaceState() && String(activeId || '') === String(ensureWorkspaceHostState().activeWorkspaceId || ''),
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

    function buildWorkspaceTabSummary(record, options) {
      var opts = options || {};
      var snapshot = record && record.snapshot ? record.snapshot : null;
      var xmind = snapshot && snapshot.xmind && typeof snapshot.xmind === 'object'
        ? snapshot.xmind
        : {};
      var visibleSummary = opts.live === true && workspaceShadowDepth <= 0
        ? summarizeVisibleModuleContext(buildVisibleModuleContext())
        : summarizeVisibleModuleContext(buildWorkspaceVisibleModuleContextFromSnapshot(snapshot));
      var moduleCount = visibleSummary.moduleCount;
      var caseCount = visibleSummary.caseCount;
      var prep = xmind.prep && typeof xmind.prep === 'object' ? xmind.prep : null;
      var failed = hasWorkspaceFailedState(snapshot);
      var statusText = '待准备';
      var statusCls = 'is-idle';
      if (opts.running === true) {
        statusText = getRunningCoverageTaskCount(record && record.id ? record.id : '') > 0
          ? '覆盖中'
          : (getRunningDedupeTaskCount(record && record.id ? record.id : '') > 0 ? '去重中' : '生成中');
        statusCls = 'is-running';
      } else if (failed === true) {
        statusText = '失败';
        statusCls = 'is-error';
      } else if (opts.dirty === true) {
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
        moduleCount: moduleCount,
        caseCount: caseCount,
        statusText: statusText,
        statusCls: statusCls,
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
      var isFull = items.length >= WORKSPACE_MAX;
      workspaceAddBtn.classList.toggle('is-disabled', isFull);
      workspaceAddBtn.disabled = isFull;
      workspaceAddBtn.textContent = '新建生成';
      workspaceAddBtn.title = isFull ? getWorkspaceLimitText() : '新建一个独立的 XMind 用例生成页签';
      syncCasegenProgressSidebar();
      syncCasesGenPageRender();
      return true;
    }

    function parseCaseList(rawText) {
      if (xmindGenApi && typeof xmindGenApi.parseCaseList === 'function') {
        return xmindGenApi.parseCaseList(rawText || '');
      }
      return [];
    }

    function getAiCasesForModule(moduleId) {
      if (!moduleId) return [];
      var raw = state.caseGenResults && state.caseGenResults[moduleId]
        ? String(state.caseGenResults[moduleId] || '')
        : '';
      if (!raw.trim()) return [];
      var parsed = parseCaseList(raw);
      if (parsed.length) return parsed;
      try {
        var data = JSON.parse(stripCodeFence(raw) || '[]');
        return Array.isArray(data) ? data : [];
      } catch (err) {
        return [];
      }
    }

    function groupCasesByModule(list) {
      var order = [];
      var map = {};
      (Array.isArray(list) ? list : []).forEach(function(item) {
        if (!item || typeof item !== 'object') return;
        var title = normalizeModuleTitle(item.module || item.module_name || item['模块'] || '未命名模块');
        var key = normalizeModuleKey(title);
        if (!key) return;
        if (!map[key]) {
          map[key] = { key: key, title: title, cases: [] };
          order.push(key);
        }
        map[key].cases.push(item);
      });
      return {
        order: order,
        map: map,
      };
    }

    function buildVisibleModuleContext(options) {
      var opts = options || {};
      var rootState = ensureRootUiState();
      var includeAiLayer = opts.includeAiLayer === true
        ? true
        : (opts.includeAiLayer !== false && !(rootState && rootState.hideAiLayer === true));
      var baselineList = getVisibleBaselineCaseList();
      var baselineGrouped = groupCasesByModule(baselineList);
      var order = baselineGrouped.order.slice();
      var map = {};

      order.forEach(function(key) {
        var info = baselineGrouped.map[key];
        map[key] = {
          moduleKey: key,
          title: info.title,
          baselineCases: info.cases.slice(),
          aiCases: [],
          aiModule: null,
          aiModuleId: '',
        };
      });

      if (includeAiLayer !== false) (state.caseGenModules || []).forEach(function(mod, index) {
        if (!mod) return;
        var title = normalizeModuleTitle(mod.title || mod.module || ('模块' + (index + 1)));
        var key = normalizeModuleKey(title);
        if (!key) return;
        if (!map[key]) {
          map[key] = {
            moduleKey: key,
            title: title,
            baselineCases: [],
            aiCases: [],
            aiModule: null,
            aiModuleId: '',
          };
          order.push(key);
        }
        map[key].aiModule = mod;
        map[key].aiModuleId = String(mod.id || '');
        map[key].title = title;
        var moduleState = ensureModuleUiState(mod.id);
        map[key].aiCases = moduleState && moduleState.hideResults === true
          ? []
          : getAiCasesForModule(mod.id);
      });

      return {
        order: order,
        map: map,
        list: order.map(function(key) { return map[key]; }),
      };
    }

    function ensureVisibleModuleContext(value) {
      if (value && Array.isArray(value.list) && value.map && typeof value.map === 'object') {
        return value;
      }
      if (value && Array.isArray(value.list)) {
        var fallbackMap = {};
        var fallbackOrder = [];
        value.list.forEach(function(entry) {
          if (!entry || typeof entry !== 'object') return;
          var key = String(entry.moduleKey || normalizeModuleKey(entry.title || '') || '').trim();
          if (!key || fallbackMap[key]) return;
          fallbackMap[key] = entry;
          fallbackOrder.push(key);
        });
        return {
          order: fallbackOrder,
          map: fallbackMap,
          list: fallbackOrder.map(function(key) { return fallbackMap[key]; }),
        };
      }
      return buildVisibleModuleContext();
    }

    function getVisibleCasesForModuleEntry(entry) {
      var result = [];
      if (!entry) return result;
      (entry.baselineCases || []).forEach(function(item, index) {
        result.push({
          source: 'baseline',
          sourceIndex: index,
          caseSignature: buildCaseSignature(item, entry.title),
          item: item,
        });
      });
      (entry.aiCases || []).forEach(function(item, index) {
        result.push({
          source: 'ai',
          sourceIndex: index,
          caseSignature: buildCaseSignature(item, entry.title),
          item: item,
        });
      });
      return result;
    }

    function hasAiCasesForModule(moduleId) {
      return getAiCasesForModule(moduleId).length > 0;
    }

    function findAiModuleByTitle(title) {
      var key = normalizeModuleKey(title);
      if (!key) return null;
      var modules = Array.isArray(state.caseGenModules) ? state.caseGenModules : [];
      for (var i = 0; i < modules.length; i += 1) {
        var mod = modules[i];
        if (!mod) continue;
        if (normalizeModuleKey(mod.title || mod.module) === key) return mod;
      }
      return null;
    }

    function findAiModuleById(moduleId) {
      var targetId = String(moduleId || '');
      if (!targetId) return null;
      var modules = Array.isArray(state.caseGenModules) ? state.caseGenModules : [];
      for (var i = 0; i < modules.length; i += 1) {
        var mod = modules[i];
        if (!mod) continue;
        if (String(mod.id || '') === targetId) return mod;
      }
      return null;
    }

    function generateLocalId(prefix) {
      return String(prefix || 'xmind') + '-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 8);
    }

    function normalizeArrayField(value) {
      if (Array.isArray(value)) {
        return value.map(function(item) { return normalizeText(item); }).filter(Boolean);
      }
      var text = normalizeText(value);
      return text ? [text] : [];
    }

    function createAiModuleRecord(title, source, moduleId) {
      var item = source && typeof source === 'object' ? source : {};
      var record = {
        id: moduleId || generateLocalId('xmind-mod'),
        title: normalizeModuleTitle(title || item.module || item.title || '未命名模块'),
        scenarios: normalizeArrayField(item.key_scenarios || item.scenarios),
        points: normalizeArrayField(item.test_points || item.points),
        coupled: normalizeArrayField(item.coupled_modules || item.coupled),
        special: normalizeArrayField(item.special || item.special_points),
      };
      return record;
    }

    function ensureAiModuleRecord(title, source, moduleId) {
      var existing = findAiModuleByTitle(title);
      if (existing) {
        if (source && typeof source === 'object') {
          var scenarios = normalizeArrayField(source.key_scenarios || source.scenarios);
          var points = normalizeArrayField(source.test_points || source.points);
          var coupled = normalizeArrayField(source.coupled_modules || source.coupled);
          if (scenarios.length) existing.scenarios = scenarios;
          if (points.length) existing.points = points;
          if (coupled.length) existing.coupled = coupled;
        }
        return existing;
      }
      var created = createAiModuleRecord(title, source, moduleId);
      if (!Array.isArray(state.caseGenModules)) state.caseGenModules = [];
      state.caseGenModules.push(created);
      ensureState().hasModuleSkeleton = true;
      return created;
    }

    function normalizeCasePriority(priority) {
      var text = normalizeText(priority).toUpperCase();
      if (text === 'P0' || text === 'P1' || text === 'P2') return text;
      return 'P1';
    }

    function compactCaseTitle(title) {
      var text = normalizeText(title);
      if (!text) return '未命名用例';
      text = text.replace(/^[\d一二三四五六七八九十]+[、.．)\]\s-]+/, '').trim();
      if (text.length <= 28) return text;
      var parts = text.split(/[，。；：,:]/);
      var first = normalizeText(parts[0] || '');
      if (first && first.length <= 28) return first;
      return text.slice(0, 28).trim();
    }

    function normalizeCaseSteps(steps) {
      var list = [];
      if (Array.isArray(steps)) {
        list = steps.map(function(item) { return normalizeText(item); }).filter(Boolean);
      } else {
        var text = normalizeText(steps);
        if (text) {
          list = text.split(/\n+/).map(function(item) { return normalizeText(item); }).filter(Boolean);
          if (!list.length) list = [text];
        }
      }
      return list.map(function(item, index) {
        var clean = item.replace(/^\d+[、.．)\]\s-]+/, '').trim();
        return String(index + 1) + '、' + (clean || ('步骤' + String(index + 1)));
      });
    }

    function normalizeCaseItem(item, fallbackModule) {
      if (!item || typeof item !== 'object') return null;
      var moduleTitle = normalizeModuleTitle(item.module || fallbackModule || '未命名模块');
      var title = compactCaseTitle(item.title || item.case_title || item['用例标题'] || moduleTitle);
      var expected = stringifyField(item.expected || item.result || item['预期结果']);
      if (!title) return null;
      return {
        module: moduleTitle,
        title: title,
        priority: normalizeCasePriority(item.priority || item.level || item['优先级']),
        preconditions: stringifyField(item.preconditions || item.precondition || item['前提条件']),
        steps: normalizeCaseSteps(item.steps || item.actions || item['操作步骤']),
        expected: expected || '-',
      };
    }

    function normalizeFallbackCaseList(list, fallbackModule) {
      var result = [];
      var seen = {};
      (Array.isArray(list) ? list : []).forEach(function(item) {
        var normalized = normalizeCaseItem(item, fallbackModule);
        var titleKey = normalizeCaseTitle(normalized && normalized.title ? normalized.title : '');
        if (!normalized || !titleKey || seen[titleKey]) return;
        seen[titleKey] = true;
        result.push(normalized);
      });
      return result;
    }

    function buildCaseSignature(item, fallbackModule) {
      var normalized = normalizeCaseItem(item, fallbackModule);
      if (!normalized) return '';
      var steps = Array.isArray(normalized.steps) ? normalized.steps.slice() : [];
      return [
        normalizeCaseTitle(normalized.title),
        normalizeCasePriority(normalized.priority),
        normalizeText(normalized.preconditions),
        steps.map(function(step) { return normalizeText(step); }).join('||'),
        normalizeText(normalized.expected),
      ].join('##');
    }

    function extractJsonPayload(text) {
      var raw = stripCodeFence(text || '');
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (err) {}
      var start = raw.indexOf('{');
      var end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(raw.slice(start, end + 1));
        } catch (err2) {}
      }
      var arrStart = raw.indexOf('[');
      var arrEnd = raw.lastIndexOf(']');
      if (arrStart >= 0 && arrEnd > arrStart) {
        try {
          return JSON.parse(raw.slice(arrStart, arrEnd + 1));
        } catch (err3) {}
      }
      return null;
    }

    function summarizeModelOutputText(text, maxLength) {
      var limit = Number(maxLength);
      var clean = String(text || '').replace(/\s+/g, ' ').trim();
      if (!clean) return '';
      if (!Number.isFinite(limit) || limit <= 0) limit = 120;
      if (clean.length <= limit) return clean;
      return clean.slice(0, limit).trim() + '…';
    }

    function normalizeHistoryLongText(text, maxLength) {
      var limit = Number(maxLength);
      var clean = String(text || '').replace(/\s+/g, ' ').trim();
      if (!clean) return '';
      if (!Number.isFinite(limit) || limit <= 0) limit = 2000;
      if (clean.length <= limit) return clean;
      return clean.slice(0, limit).trim() + '…';
    }

    function createModelOutputDiagnostics() {
      return {
        rawHasText: false,
        rawPreview: '',
        parseStatus: '',
        parseMode: '',
        payloadKind: '',
        sourceKind: '',
        missingModulesArray: false,
        emptyModulesArray: false,
        moduleCandidateCount: 0,
        normalizedModuleCount: 0,
        skippedNonObjectModules: 0,
        caseCandidateCount: 0,
        normalizedCaseCount: 0,
        skippedInvalidCases: 0,
      };
    }

    function extractJsonPayloadDetailed(text) {
      var raw = stripCodeFence(text || '');
      var diagnostics = createModelOutputDiagnostics();
      diagnostics.rawHasText = Boolean(raw);
      diagnostics.rawPreview = summarizeModelOutputText(raw, 120);
      if (!raw) {
        diagnostics.parseStatus = 'empty';
        return {
          payload: null,
          diagnostics: diagnostics,
        };
      }
      try {
        diagnostics.parseStatus = 'json';
        diagnostics.parseMode = 'direct';
        return {
          payload: JSON.parse(raw),
          diagnostics: diagnostics,
        };
      } catch (err) {}
      var start = raw.indexOf('{');
      var end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          diagnostics.parseStatus = 'json';
          diagnostics.parseMode = 'object-slice';
          return {
            payload: JSON.parse(raw.slice(start, end + 1)),
            diagnostics: diagnostics,
          };
        } catch (err2) {}
      }
      var arrStart = raw.indexOf('[');
      var arrEnd = raw.lastIndexOf(']');
      if (arrStart >= 0 && arrEnd > arrStart) {
        try {
          diagnostics.parseStatus = 'json';
          diagnostics.parseMode = 'array-slice';
          return {
            payload: JSON.parse(raw.slice(arrStart, arrEnd + 1)),
            diagnostics: diagnostics,
          };
        } catch (err3) {}
      }
      diagnostics.parseStatus = /[\{\[]/.test(raw) ? 'invalid-json' : 'plain-text';
      return {
        payload: null,
        diagnostics: diagnostics,
      };
    }

    function normalizeModelModulesOutputDetailed(content) {
      var extracted = extractJsonPayloadDetailed(content);
      var payload = extracted.payload;
      var diagnostics = extracted.diagnostics || createModelOutputDiagnostics();
      var arr = [];
      if (Array.isArray(payload)) {
        arr = payload;
        diagnostics.payloadKind = 'array';
        diagnostics.sourceKind = 'root-array';
      } else if (payload && typeof payload === 'object') {
        diagnostics.payloadKind = 'object';
        if (Array.isArray(payload.modules)) {
          arr = payload.modules;
          diagnostics.sourceKind = 'modules';
        } else if (Array.isArray(payload.data)) {
          arr = payload.data;
          diagnostics.sourceKind = 'data';
        } else {
          diagnostics.missingModulesArray = true;
        }
      } else if (payload !== null && payload !== undefined) {
        diagnostics.payloadKind = typeof payload;
        diagnostics.missingModulesArray = true;
      }

      diagnostics.moduleCandidateCount = Array.isArray(arr) ? arr.length : 0;
      diagnostics.emptyModulesArray = diagnostics.moduleCandidateCount === 0 && Boolean(diagnostics.sourceKind);

      var list = (Array.isArray(arr) ? arr : []).map(function(item) {
        if (!item || typeof item !== 'object') {
          diagnostics.skippedNonObjectModules += 1;
          return null;
        }
        var moduleTitle = normalizeModuleTitle(item.module || item.title || item.name || '未命名模块');
        if (!moduleTitle) return null;
        diagnostics.normalizedModuleCount += 1;
        var moduleInfo = {
          module: moduleTitle,
          key_scenarios: normalizeArrayField(item.key_scenarios || item.scenarios),
          test_points: normalizeArrayField(item.test_points || item.points),
          coupled_modules: normalizeArrayField(item.coupled_modules || item.coupled),
          cases: [],
        };
        var cases = Array.isArray(item.cases) ? item.cases : [];
        diagnostics.caseCandidateCount += cases.length;
        cases.forEach(function(caseItem) {
          var normalized = normalizeCaseItem(caseItem, moduleTitle);
          if (!normalized) {
            diagnostics.skippedInvalidCases += 1;
            return;
          }
          diagnostics.normalizedCaseCount += 1;
          moduleInfo.cases.push(normalized);
        });
        return moduleInfo;
      }).filter(Boolean);

      return {
        list: list,
        diagnostics: diagnostics,
      };
    }

    function normalizeModelModulesOutput(content) {
      return normalizeModelModulesOutputDetailed(content).list;
    }

    function buildVisibleModuleSnapshot(context) {
      return (context && context.list ? context.list : []).map(function(entry) {
        return {
          module: entry.title,
          key_scenarios: entry.aiModule && Array.isArray(entry.aiModule.scenarios) ? entry.aiModule.scenarios.slice() : [],
          test_points: entry.aiModule && Array.isArray(entry.aiModule.points) ? entry.aiModule.points.slice() : [],
          coupled_modules: entry.aiModule && Array.isArray(entry.aiModule.coupled) ? entry.aiModule.coupled.slice() : [],
          cases: getVisibleCasesForModuleEntry(entry).map(function(row) {
            return normalizeCaseItem(row.item, entry.title);
          }).filter(Boolean),
        };
      });
    }

    function buildAiLayerSnapshot() {
      return (Array.isArray(state.caseGenModules) ? state.caseGenModules : []).map(function(mod) {
        return {
          module: normalizeModuleTitle(mod.title || mod.module || ''),
          key_scenarios: Array.isArray(mod.scenarios) ? mod.scenarios.slice() : [],
          test_points: Array.isArray(mod.points) ? mod.points.slice() : [],
          coupled_modules: Array.isArray(mod.coupled) ? mod.coupled.slice() : [],
          cases: getAiCasesForModule(mod.id).map(function(item) {
            return normalizeCaseItem(item, mod.title || mod.module || '');
          }).filter(Boolean),
        };
      });
    }

    function getImportedCaseEntries() {
      return Array.isArray(state.importedCases) ? state.importedCases.filter(Boolean) : [];
    }

    function resolveImportedBaselineOrigin() {
      if (!hasImportedBaselineCases()) {
        return {
          hasBaseline: false,
          sourceType: 'none',
          entries: [],
          targets: [],
        };
      }
      var entries = getImportedCaseEntries().filter(function(item) {
        return item && Array.isArray(item.list) && item.list.length > 0;
      });
      var allLibrary = entries.length > 0 && entries.every(function(item) {
        var meta = item && item.meta && typeof item.meta === 'object' ? item.meta : null;
        return Boolean(meta && meta.sourceType === 'case-library-select' && meta.caseFileId);
      });
      var seenTargets = {};
      var targets = [];
      if (allLibrary) {
        entries.forEach(function(item) {
          var meta = item && item.meta && typeof item.meta === 'object' ? item.meta : {};
          var targetKey = [
            String(meta.projectId || ''),
            String(meta.versionId || ''),
            String(meta.caseFileId || '')
          ].join('::');
          if (!meta.caseFileId || seenTargets[targetKey]) return;
          seenTargets[targetKey] = true;
          targets.push({
            projectId: meta.projectId ? Number(meta.projectId) : null,
            versionId: meta.versionId ? Number(meta.versionId) : null,
            caseFileId: meta.caseFileId ? Number(meta.caseFileId) : null,
            fileName: meta.fileName ? String(meta.fileName || '') : String(item.name || ''),
          });
        });
      }
      return {
        hasBaseline: true,
        sourceType: allLibrary ? 'case-library-select' : 'external-import',
        entries: entries,
        targets: targets,
      };
    }

    function createStoreScopeEntry(moduleKey, moduleId, moduleTitle, rows) {
      return {
        moduleKey: String(moduleKey || ''),
        moduleId: moduleId ? String(moduleId || '') : '',
        moduleTitle: normalizeModuleTitle(moduleTitle || '未命名模块'),
        rows: Array.isArray(rows) ? rows.slice() : [],
      };
    }

    function buildVisibleStoreScopeEntries() {
      return buildVisibleModuleContext().list.map(function(entry) {
        return createStoreScopeEntry(
          entry.moduleKey,
          entry.aiModuleId || '',
          entry.title,
          getVisibleCasesForModuleEntry(entry)
        );
      });
    }

    function buildAiStoreScopeEntries() {
      return (Array.isArray(state.caseGenModules) ? state.caseGenModules : []).map(function(mod, index) {
        var moduleTitle = normalizeModuleTitle(mod && (mod.title || mod.module) || ('模块' + String(index + 1)));
        var moduleId = mod && mod.id ? String(mod.id || '') : '';
        var rows = getAiCasesForModule(moduleId).map(function(item, caseIndex) {
          return {
            source: 'ai',
            sourceIndex: caseIndex,
            caseSignature: buildCaseSignature(item, moduleTitle),
            item: item,
          };
        });
        return createStoreScopeEntry(normalizeModuleKey(moduleTitle), moduleId, moduleTitle, rows);
      }).filter(function(entry) {
        return Boolean(entry && entry.moduleKey);
      });
    }

    function buildStoreCaseItemFromRow(row, moduleTitle) {
      var normalized = normalizeCaseItem(row && row.item ? row.item : row, moduleTitle);
      if (!normalized) return null;
      return {
        module: normalized.module,
        title: normalized.title,
        priority: normalized.priority,
        precondition: String(normalized.preconditions || '').trim(),
        steps: Array.isArray(normalized.steps) ? normalized.steps.join('\n').trim() : '',
        expected: String(normalized.expected || '').trim(),
        remark: null,
      };
    }

    function buildStoreCaseKey(entry, row) {
      var item = row && row.item ? row.item : row;
      return buildDeleteTargetKey({
        type: 'case',
        moduleKey: entry && entry.moduleKey ? entry.moduleKey : normalizeModuleKey(entry && entry.moduleTitle ? entry.moduleTitle : ''),
        moduleTitle: entry && entry.moduleTitle ? entry.moduleTitle : '',
        caseTitle: item && item.title ? String(item.title || '') : '',
        caseSource: row && row.source ? String(row.source || '') : 'ai',
        caseSourceIndex: row && Number.isFinite(Number(row.sourceIndex)) ? Number(row.sourceIndex) : 0,
        caseSignature: row && row.caseSignature ? String(row.caseSignature || '') : buildCaseSignature(item, entry && entry.moduleTitle ? entry.moduleTitle : ''),
      });
    }

    function validateStoreCaseItem(item) {
      if (!item || typeof item !== 'object') return false;
      var stepsText = String(item.steps || '').trim();
      if (!String(item.module || '').trim()) return false;
      if (!String(item.title || '').trim()) return false;
      if (!String(item.priority || '').trim()) return false;
      if (!String(item.precondition || '').trim()) return false;
      if (!stepsText) return false;
      if (!String(item.expected || '').trim()) return false;
      var steps = stepsText.split(/\n+/).map(function(text) { return String(text || '').trim(); }).filter(Boolean);
      if (!steps.length) return false;
      return steps.every(function(step, index) {
        return new RegExp('^' + String(index + 1) + '、').test(step);
      });
    }

    function validateStoreScopeEntries(entries) {
      var result = {
        items: [],
        missingModules: [],
        invalidCaseKeys: [],
      };
      (Array.isArray(entries) ? entries : []).forEach(function(entry) {
        var rows = Array.isArray(entry && entry.rows) ? entry.rows : [];
        if (!rows.length) {
          if (entry && entry.moduleKey) {
            result.missingModules.push({
              moduleKey: String(entry.moduleKey || ''),
              moduleTitle: entry.moduleTitle || '未命名模块',
            });
          }
          return;
        }
        rows.forEach(function(row) {
          var item = buildStoreCaseItemFromRow(row, entry.moduleTitle);
          if (!validateStoreCaseItem(item)) {
            result.invalidCaseKeys.push(buildStoreCaseKey(entry, row));
            return;
          }
          result.items.push(item);
        });
      });
      return result;
    }

    function resolveDefaultStoreNewAction() {
      var select = document.getElementById('caseGenStoreActionSelect');
      var value = select && select.value ? String(select.value || '') : '';
      return value || 'store';
    }

    function openStoreConfirmDialog(options) {
      var opts = options || {};
      var confirmDrawer = window.app && window.app.confirmDrawer ? window.app.confirmDrawer : null;
      if (confirmDrawer && typeof confirmDrawer.open === 'function') {
        return confirmDrawer.open({
          title: opts.title || '确认保存入库',
          message: opts.message || '',
          confirmText: opts.confirmText || '确认',
          cancelText: opts.cancelText || '取消',
        }).then(function(result) {
          return Boolean(result && result.ok === true);
        });
      }
      var ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(String(opts.message || '确认继续吗？'))
        : true;
      return Promise.resolve(ok === true);
    }

    function createOperationContract(actionId, moduleEntry) {
      if (actionId === ROOT_ACTIONS.FULL_CASES) {
        return {
          scope: 'root',
          mode: 'full_cases',
          targetModule: '',
          allowNewModules: true,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: false,
          dedupeAgainstVisibleModules: false,
          dedupeAgainstVisibleCases: false,
        };
      }
      if (actionId === ROOT_ACTIONS.FULL_MODULES) {
        return {
          scope: 'root',
          mode: 'full_modules',
          targetModule: '',
          allowNewModules: true,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: false,
          dedupeAgainstVisibleModules: true,
          dedupeAgainstVisibleCases: false,
        };
      }
      if (actionId === ROOT_ACTIONS.REGENERATE_MODULES) {
        return {
          scope: 'root',
          mode: 'regenerate_modules',
          targetModule: '',
          allowNewModules: true,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: false,
          dedupeAgainstVisibleModules: false,
          dedupeAgainstVisibleCases: false,
        };
      }
      if (actionId === ROOT_ACTIONS.EXISTING_CASES) {
        return createExistingCasesDiscoveryContract({
          scope: 'root',
          mode: 'existing_modules_cases',
          targetModule: '',
          allowNewModules: true,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: false,
          dedupeAgainstVisibleModules: true,
          dedupeAgainstVisibleCases: true,
        });
      }
      if (actionId === ROOT_ACTIONS.TOPUP_MODULES) {
        return {
          scope: 'root',
          mode: 'topup_modules',
          targetModule: '',
          allowNewModules: true,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: false,
          dedupeAgainstVisibleModules: true,
          dedupeAgainstVisibleCases: false,
        };
      }
      if (actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES) {
        return {
          scope: 'root',
          mode: 'topup_modules_cases',
          targetModule: '',
          allowNewModules: true,
          generateCasesForNewModules: true,
          generateCasesForExistingModules: false,
          dedupeAgainstVisibleModules: true,
          dedupeAgainstVisibleCases: false,
        };
      }
      if (actionId === ROOT_ACTIONS.APPEND_ALL) {
        return {
          scope: 'root',
          mode: 'append_all_modules_cases',
          targetModule: '',
          allowNewModules: true,
          generateCasesForNewModules: true,
          generateCasesForExistingModules: true,
          dedupeAgainstVisibleModules: false,
          dedupeAgainstVisibleCases: true,
          importedBaselineCompletion: true,
          generationPolicy: createImportedBaselineCompletionPolicy(),
        };
      }
      if (actionId === MODULE_ACTIONS.APPEND) {
        return {
          scope: 'module',
          mode: 'module_append_cases',
          targetModule: moduleEntry ? moduleEntry.title : '',
          allowNewModules: false,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: true,
          dedupeAgainstVisibleModules: false,
          dedupeAgainstVisibleCases: true,
        };
      }
      if (actionId === MODULE_ACTIONS.FULL_CASES) {
        return {
          scope: 'module',
          mode: 'module_full_cases',
          targetModule: moduleEntry ? moduleEntry.title : '',
          allowNewModules: false,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: true,
          dedupeAgainstVisibleModules: false,
          dedupeAgainstVisibleCases: false,
        };
      }
      return {
        scope: 'module',
        mode: 'module_full_cases',
        targetModule: moduleEntry ? moduleEntry.title : '',
        allowNewModules: false,
        generateCasesForNewModules: false,
        generateCasesForExistingModules: true,
        dedupeAgainstVisibleModules: false,
        dedupeAgainstVisibleCases: true,
      };
    }

    function createExistingCasesCompletionPolicy() {
      return {
        source: 'xmind_existing_cases_completion',
        generationStrategy: 'requirement_completion',
        completionStrength: 'full_reasonable_completion',
        onlyGenerateForClearCoverageGaps: false,
        returnEmptyWhenCovered: false,
        protectImportedCases: true,
        avoidImportedCaseLinearExpansion: true,
      };
    }

    function createImportedBaselineCompletionPolicy() {
      return {
        source: 'xmind_imported_baseline_completion',
        generationStrategy: 'requirement_completion',
        completionStrength: 'full_reasonable_completion',
        onlyGenerateForClearCoverageGaps: false,
        returnEmptyWhenCovered: false,
        protectImportedCases: true,
        avoidImportedCaseLinearExpansion: true,
      };
    }

    function createExistingCasesDiscoveryContract(contract) {
      var next = cloneJson(contract, {});
      next.existingCasesCompletion = true;
      next.discoveryThenModuleCases = true;
      next.generationPolicy = createExistingCasesCompletionPolicy();
      next.allowNewModules = true;
      next.generateCasesForNewModules = false;
      next.generateCasesForExistingModules = false;
      next.dedupeAgainstVisibleModules = true;
      next.dedupeAgainstVisibleCases = true;
      return next;
    }

    function applyExistingCasesCompletionPolicy(contract) {
      var next = cloneJson(contract, {});
      next.existingCasesCompletion = true;
      next.discoveryThenModuleCases = true;
      next.generationPolicy = createExistingCasesCompletionPolicy();
      next.onlyGenerateForClearCoverageGaps = false;
      next.returnEmptyWhenCovered = false;
      next.allowNewModules = false;
      next.generateCasesForNewModules = false;
      next.generateCasesForExistingModules = true;
      next.dedupeAgainstVisibleCases = true;
      return next;
    }

    function applyImportedBaselineCompletionPolicy(contract) {
      var next = cloneJson(contract, {});
      next.importedBaselineCompletion = true;
      next.discoveryThenModuleCases = true;
      next.generationPolicy = createImportedBaselineCompletionPolicy();
      next.onlyGenerateForClearCoverageGaps = false;
      next.returnEmptyWhenCovered = false;
      next.allowNewModules = false;
      next.generateCasesForNewModules = false;
      next.generateCasesForExistingModules = true;
      next.dedupeAgainstVisibleCases = true;
      return next;
    }

    function getExistingCasesCompletionPolicy(contract) {
      if (!contract || typeof contract !== 'object') return null;
      var mode = contract.mode ? String(contract.mode || '') : '';
      if (contract.existingCasesCompletion === true || mode === 'existing_modules_cases') {
        return contract.generationPolicy && typeof contract.generationPolicy === 'object'
          ? contract.generationPolicy
          : createExistingCasesCompletionPolicy();
      }
      return null;
    }

    function getImportedBaselineCompletionPolicy(contract) {
      if (!contract || typeof contract !== 'object') return null;
      var mode = contract.mode ? String(contract.mode || '') : '';
      if (contract.importedBaselineCompletion === true || mode === 'append_all_modules_cases') {
        return contract.generationPolicy && typeof contract.generationPolicy === 'object'
          ? contract.generationPolicy
          : createImportedBaselineCompletionPolicy();
      }
      return null;
    }

    function buildXmindPrompt(contract) {
      var settingsSnapshot = buildXmindGenerationOptionsSnapshot();
      var assignedPrompt = state.assignments && state.assignments.xmindCaseGenPrompt
        ? String(state.assignments.xmindCaseGenPrompt || '').trim()
        : '';
      var defaultPrompt = defaultPrompts && defaultPrompts.xmindcasegen
        ? String(defaultPrompts.xmindcasegen || '').trim()
        : '';
      var parts = [];
      if (defaultPrompt) parts.push(defaultPrompt);
      if (assignedPrompt && assignedPrompt !== defaultPrompt) {
        parts.push(assignedPrompt);
      }
      if (casesGenApi && typeof casesGenApi.getCaseGenPromptComponents === 'function') {
        var extraParts = casesGenApi.getCaseGenPromptComponents(getCaseGenSettingsSnapshot()) || [];
        extraParts.forEach(function(item) {
          if (item) parts.push(String(item));
        });
      }
      var hardConstraintText = buildXmindHardConstraintText(contract, settingsSnapshot);
      if (hardConstraintText) {
        parts.push('【XMind 生成硬约束】\n' + hardConstraintText);
      }
      parts.push('operation_contract(JSON)：' + JSON.stringify(contract));
      return parts.join('\n\n');
    }

    function callXmindModelWithGuard(executor) {
      var timeoutSec = state && state.settings && Number(state.settings.timeoutSec)
        ? Math.max(30, Math.min(1800, Math.round(Number(state.settings.timeoutSec))))
        : 300;
      var timeoutMs = timeoutSec * 1000 + 1500;
      return new Promise(function(resolve, reject) {
        var settled = false;
        var timer = setTimeout(function() {
          if (settled) return;
          settled = true;
          reject(new Error('模型调用超时（超过 ' + timeoutSec + ' 秒）'));
        }, timeoutMs);
        Promise.resolve().then(function() {
          return executor();
        }).then(function(result) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }).catch(function(err) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err);
        });
      });
    }

    async function buildRequirementPayload(contract, visibleContext, moduleEntry) {
      var requirementSource = getSelectedRequirementSource();
      var generationOptions = buildXmindGenerationOptionsSnapshot();
      var hardConstraintText = buildXmindHardConstraintText(contract, generationOptions);
      var aiLayerSnapshot = contract && (
        contract.mode === 'regenerate_modules'
        || (contract.scope === 'root' && contract.mode === 'full_cases')
      )
        ? []
        : buildAiLayerSnapshot();
      var sections = [];
      sections.push('【需求标识】\n' + getRequirementLabelText());
      sections.push('【operation_contract(JSON)】\n' + JSON.stringify(contract, null, 2));
      sections.push('【本轮生成选项(JSON)】\n' + JSON.stringify(generationOptions, null, 2));
      sections.push('【本轮生成选项说明】\n' + buildXmindGenerationOptionsSummary(generationOptions));
      if (hardConstraintText) {
        sections.push('【首轮生成硬约束】\n' + hardConstraintText);
      }
      sections.push('【当前可见模块与用例(JSON)】\n' + JSON.stringify(buildVisibleModuleSnapshot(visibleContext), null, 2));
      sections.push('【当前 AI 生成层(JSON)】\n' + JSON.stringify(aiLayerSnapshot, null, 2));
      if (moduleEntry) {
        sections.push('【当前操作模块】\n' + JSON.stringify({
          module: moduleEntry.title,
          visible_cases: getVisibleCasesForModuleEntry(moduleEntry).map(function(row) {
            return normalizeCaseItem(row.item, moduleEntry.title);
          }).filter(Boolean),
        }, null, 2));
      }
      if (requirementSource.mode === 'document') {
        sections.push('【需求正文】\n' + (requirementSource.text || '（无文本）'));
        if (requirementSource.supplement) sections.push('【需求补充】\n' + requirementSource.supplement);
        return {
          mode: 'document',
          text: sections.join('\n\n'),
          images: requirementSource.images,
        };
      }
      sections.push('【手填需求描述】\n' + (requirementSource.text || '（仅图片）'));
      return {
        mode: requirementSource.mode || 'manual',
        text: sections.join('\n\n'),
        images: requirementSource.images,
      };
    }

    function buildKnowledgeBaseVisibleModuleSummary(visibleContext) {
      return (visibleContext && Array.isArray(visibleContext.list) ? visibleContext.list : []).slice(0, 12).map(function(entry) {
        var visibleCases = getVisibleCasesForModuleEntry(entry).slice(0, 8).map(function(row) {
          var normalized = normalizeCaseItem(row && row.item, entry && entry.title ? entry.title : '');
          return normalized && normalized.title ? String(normalized.title || '') : '';
        }).filter(Boolean);
        return {
          module: entry && entry.title ? String(entry.title || '') : '',
          key_scenarios: entry && entry.aiModule && Array.isArray(entry.aiModule.scenarios)
            ? entry.aiModule.scenarios.slice(0, 8)
            : [],
          test_points: entry && entry.aiModule && Array.isArray(entry.aiModule.points)
            ? entry.aiModule.points.slice(0, 8)
            : [],
          case_titles: visibleCases,
        };
      }).filter(function(item) {
        return Boolean(item && item.module);
      });
    }

    function buildKnowledgeBaseVisibleCaseSummary(visibleContext, moduleEntry) {
      var entries = [];
      if (moduleEntry) {
        entries.push(moduleEntry);
      }
      (visibleContext && Array.isArray(visibleContext.list) ? visibleContext.list : []).forEach(function(entry) {
        if (!entry) return;
        if (moduleEntry && String(entry.moduleKey || '') === String(moduleEntry.moduleKey || '')) return;
        entries.push(entry);
      });
      var result = [];
      entries.slice(0, 8).forEach(function(entry) {
        getVisibleCasesForModuleEntry(entry).slice(0, moduleEntry ? 16 : 6).forEach(function(row) {
          if (!row || !row.item) return;
          var normalized = normalizeCaseItem(row.item, entry && entry.title ? entry.title : '');
          var title = normalized && normalized.title ? String(normalized.title || '') : '';
          if (!title) return;
          result.push({
            module: entry && entry.title ? String(entry.title || '') : '',
            title: title,
          });
        });
      });
      return result.slice(0, 24);
    }

    function buildKnowledgeBaseQueryContext(requirementSource) {
      var source = requirementSource && typeof requirementSource === 'object' ? requirementSource : {};
      return {
        requirementLabel: getRequirementLabelText(),
        requirementText: source.text ? String(source.text || '') : '',
        requirementSupplement: source.supplement ? String(source.supplement || '') : '',
        requirementMode: source.mode ? String(source.mode || '') : '',
        operationType: 'workspace_requirement',
        targetModule: '',
        visibleModules: [],
        visibleCases: [],
        operationContract: {},
      };
    }

    function buildKnowledgeBaseQueryKey(baseUrl, queryContext) {
      if (xmindKnowledgeBaseApi && typeof xmindKnowledgeBaseApi.buildQueryKey === 'function') {
        return xmindKnowledgeBaseApi.buildQueryKey({
          baseUrl: baseUrl,
          queryContext: queryContext,
        });
      }
      return JSON.stringify({
        version: 3,
        baseUrl: normalizeKnowledgeBaseBaseUrl(baseUrl),
        requirementLabel: queryContext && queryContext.requirementLabel ? String(queryContext.requirementLabel || '').trim() : '',
        requirementText: queryContext && queryContext.requirementText ? String(queryContext.requirementText || '').trim() : '',
        requirementSupplement: queryContext && queryContext.requirementSupplement ? String(queryContext.requirementSupplement || '').trim() : '',
        requirementMode: queryContext && queryContext.requirementMode ? String(queryContext.requirementMode || '').trim() : '',
      });
    }

    function canReuseKnowledgeBaseState(kbState, baseUrl, queryKey) {
      var normalized = normalizeKnowledgeBaseState(kbState);
      if (!normalized.enabled) return false;
      if (normalizeKnowledgeBaseBaseUrl(normalized.baseUrl) !== normalizeKnowledgeBaseBaseUrl(baseUrl)) return false;
      if (!queryKey || String(normalized.queryKey || '') !== String(queryKey || '')) return false;
      if (!normalized.ruleSearch || String(normalized.ruleSearch.status || '') !== 'done') return false;
      if (!normalized.aiFilter) return false;
      var aiStatus = String(normalized.aiFilter.status || '');
      if (aiStatus === 'pending' || aiStatus === 'failed' || aiStatus === 'disabled') return false;
      if (aiStatus === 'done') return true;
      if (aiStatus === 'skipped') {
        return Number(normalized.ruleSearch.candidateCount || 0) <= 0
          || (Array.isArray(normalized.candidates) && normalized.candidates.length === 0);
      }
      return false;
    }

    function buildReusedKnowledgeBaseState(kbState, contract, workspaceId) {
      var normalized = normalizeKnowledgeBaseState(kbState);
      return normalizeKnowledgeBaseState({
        baseUrl: normalized.baseUrl,
        enabled: normalized.enabled,
        workspaceId: String(workspaceId || normalized.workspaceId || ''),
        queryKey: normalized.queryKey,
        latestRequestId: normalized.latestRequestId,
        lastOperation: contract && contract.mode ? String(contract.mode || '') : normalized.lastOperation,
        validation: cloneJson(normalized.validation, {}),
        ruleSearch: cloneJson(normalized.ruleSearch, {}),
        aiFilter: cloneJson(normalized.aiFilter, {}),
        catalogItems: cloneJson(normalized.catalogItems, []),
        candidates: cloneJson(normalized.candidates, []),
        selectedDocuments: cloneJson(normalized.selectedDocuments, []),
        documentSections: cloneJson(normalized.documentSections, []),
        selectedSections: cloneJson(normalized.selectedSections, []),
        selectedItems: cloneJson(normalized.selectedItems, []),
        usedInLatestGeneration: Boolean(normalized.injectedContextText),
        injectedContextText: normalized.injectedContextText,
        latestError: normalized.latestError,
        warnings: cloneJson(normalized.warnings, []),
        updatedAt: Date.now(),
      });
    }

    function getKnowledgeBaseActionResult(workspaceId, actionKey, queryKey) {
      var stableWorkspaceId = String(workspaceId || '');
      var stableActionKey = String(actionKey || '');
      if (!stableWorkspaceId || !stableActionKey || !queryKey) return null;
      var cached = knowledgeBaseActionResultMap[stableWorkspaceId];
      if (!cached) return null;
      if (String(cached.actionKey || '') !== stableActionKey) return null;
      if (String(cached.queryKey || '') !== String(queryKey || '')) return null;
      return normalizeKnowledgeBaseState(cached.state);
    }

    function callKnowledgeBaseFilterModel(model, userText, prompt, reasoning, temperature) {
      if (!xmindGenApi || typeof xmindGenApi.callModelWithConfig !== 'function') {
        return Promise.reject(new Error('当前 XMind 生成模型不可用，无法执行知识库 AI 筛选'));
      }
      return callXmindModelWithGuard(function() {
        return xmindGenApi.callModelWithConfig(
          model,
          userText,
          prompt,
          reasoning || '',
          temperature
        );
      });
    }

    async function runKnowledgeBasePipelineForGeneration(contract, visibleContext, moduleEntry, model, reasoning, temperature, workspaceId, actionKey) {
      var stableWorkspaceId = String(workspaceId || getActiveWorkspaceId() || '');
      if (!stableWorkspaceId) return null;
      var stableActionKey = String(actionKey || '');
      var baseUrl = getCurrentKnowledgeBaseBaseUrl();
      var requirementSource = getSelectedRequirementSource();
      var queryContext = buildKnowledgeBaseQueryContext(requirementSource);
      var queryKey = buildKnowledgeBaseQueryKey(baseUrl, queryContext);
      if (!baseUrl) {
        setWorkspaceKnowledgeBaseState(
          stableWorkspaceId,
          buildKnowledgeBaseSkipState(stableWorkspaceId, contract, '未配置共享知识库地址，本轮已跳过'),
          { force: true }
        );
        return null;
      }
      var existingState = getWorkspaceKnowledgeBaseState(stableWorkspaceId);
      if (canReuseKnowledgeBaseState(existingState, baseUrl, queryKey)) {
        var reusedState = buildReusedKnowledgeBaseState(existingState, contract, stableWorkspaceId);
        setWorkspaceKnowledgeBaseState(stableWorkspaceId, reusedState, { force: true });
        return reusedState;
      }
      var actionScopedState = getKnowledgeBaseActionResult(stableWorkspaceId, stableActionKey, queryKey);
      if (actionScopedState) {
        var reusedActionState = buildReusedKnowledgeBaseState(actionScopedState, contract, stableWorkspaceId);
        setWorkspaceKnowledgeBaseState(stableWorkspaceId, reusedActionState, { force: true });
        return reusedActionState;
      }
      if (
        knowledgeBasePipelinePromiseMap[stableWorkspaceId]
        && String(knowledgeBasePipelinePromiseMap[stableWorkspaceId].actionKey || '') === stableActionKey
        && String(knowledgeBasePipelinePromiseMap[stableWorkspaceId].queryKey || '') === String(queryKey || '')
      ) {
        var inflightState = await knowledgeBasePipelinePromiseMap[stableWorkspaceId].promise;
        var reusedInflightState = buildReusedKnowledgeBaseState(inflightState, contract, stableWorkspaceId);
        setWorkspaceKnowledgeBaseState(stableWorkspaceId, reusedInflightState, { force: true });
        return reusedInflightState;
      }
      if (!xmindKnowledgeBaseApi || typeof xmindKnowledgeBaseApi.runPipeline !== 'function') {
        setWorkspaceKnowledgeBaseState(
          stableWorkspaceId,
          normalizeKnowledgeBaseState({
            baseUrl: baseUrl,
            enabled: true,
            workspaceId: stableWorkspaceId,
            queryKey: queryKey,
            lastOperation: contract && contract.mode ? String(contract.mode || '') : '',
            validation: {
              status: 'failed',
              normalizedBaseUrl: baseUrl,
              checkedAt: Date.now(),
              error: '知识库能力未初始化，请刷新页面后重试',
            },
            ruleSearch: {
              status: 'failed',
              reason: '知识库能力未初始化，请刷新页面后重试',
              error: '知识库能力未初始化，请刷新页面后重试',
            },
            aiFilter: {
              status: 'skipped',
              reason: '知识检索未执行，已跳过 AI 筛选',
            },
            usedInLatestGeneration: false,
            injectedContextText: '',
            latestError: '知识库能力未初始化，请刷新页面后重试',
            updatedAt: Date.now(),
          }),
          { force: true }
        );
        return null;
      }
      var requestId = generateLocalId('kb');
      var runPromise = xmindKnowledgeBaseApi.runPipeline({
        baseUrl: baseUrl,
        workspaceId: stableWorkspaceId,
        requestId: requestId,
        queryContext: queryContext,
        model: cloneJson(model, null),
        reasoning: reasoning,
        temperature: temperature,
        callModel: callKnowledgeBaseFilterModel,
        onStateChange: function(nextState) {
          setWorkspaceKnowledgeBaseState(stableWorkspaceId, nextState);
        },
      }).then(function(finalState) {
        var normalizedFinal = normalizeKnowledgeBaseState(finalState);
        if (stableActionKey) {
          knowledgeBaseActionResultMap[stableWorkspaceId] = {
            actionKey: stableActionKey,
            queryKey: queryKey,
            state: normalizedFinal,
          };
        }
        setWorkspaceKnowledgeBaseState(stableWorkspaceId, normalizedFinal);
        return normalizedFinal;
      }).finally(function() {
        var current = knowledgeBasePipelinePromiseMap[stableWorkspaceId];
        if (current && current.promise === runPromise) {
          delete knowledgeBasePipelinePromiseMap[stableWorkspaceId];
        }
      });
      knowledgeBasePipelinePromiseMap[stableWorkspaceId] = {
        actionKey: stableActionKey,
        queryKey: queryKey,
        promise: runPromise,
      };
      return runPromise;
    }

    function extractNamedSectionText(text, title) {
      var source = String(text || '');
      var marker = '【' + String(title || '').trim() + '】';
      if (!marker || marker === '【】') return '';
      var start = source.indexOf(marker);
      if (start === -1) return '';
      var rest = source.slice(start + marker.length);
      if (rest.charAt(0) === '\n') rest = rest.slice(1);
      var nextIndex = rest.indexOf('\n\n【');
      if (nextIndex === -1) nextIndex = rest.indexOf('\n【');
      if (nextIndex !== -1) rest = rest.slice(0, nextIndex);
      return String(rest || '').trim();
    }

    function parseJsonSectionText(text) {
      var extracted = extractJsonPayloadDetailed(text);
      return extracted && extracted.payload && typeof extracted.payload === 'object'
        ? extracted.payload
        : null;
    }

    function parseTaskGenerationOptions(task) {
      var requestText = task && task.requestText ? String(task.requestText || '') : '';
      var sectionText = extractNamedSectionText(requestText, '本轮生成选项(JSON)');
      var parsed = parseJsonSectionText(sectionText);
      if (!parsed || typeof parsed !== 'object') return buildXmindGenerationOptionsSnapshot();
      return {
        customRequirement: String(parsed.customRequirement || '').trim(),
        needFunctionCondition: parsed.needFunctionCondition === true,
        needNumericValidation: parsed.needNumericValidation === true,
        needBoundary: parsed.needBoundary === true,
        needMobile: parsed.needMobile === true,
        needSpecial: parsed.needSpecial === true,
        specialRepeatOperation: parsed.specialRepeatOperation === true,
        specialMultiTouch: parsed.specialMultiTouch === true,
        specialRepeatExecution: parsed.specialRepeatExecution === true,
        specialWeakNetwork: parsed.specialWeakNetwork === true,
        specialInterruptResume: parsed.specialInterruptResume === true,
      };
    }

    function buildTaskRequirementCoverageText(task) {
      var requestText = task && task.requestText ? String(task.requestText || '') : '';
      var parts = [];
      ['需求标识', '需求正文', '需求补充', '手填需求描述'].forEach(function(title) {
        var sectionText = extractNamedSectionText(requestText, title);
        if (sectionText) parts.push(sectionText);
      });
      return String(parts.join('\n') || '').replace(/\s+/g, ' ').trim();
    }

    function flattenModulesForCoverageText(modules) {
      var parts = [];
      (Array.isArray(modules) ? modules : []).forEach(function(item) {
        if (!item || typeof item !== 'object') return;
        if (item.module) parts.push(String(item.module || ''));
        normalizeArrayField(item.key_scenarios).forEach(function(text) { parts.push(String(text || '')); });
        normalizeArrayField(item.test_points).forEach(function(text) { parts.push(String(text || '')); });
        normalizeArrayField(item.coupled_modules).forEach(function(text) { parts.push(String(text || '')); });
        (Array.isArray(item.cases) ? item.cases : []).forEach(function(caseItem) {
          if (!caseItem || typeof caseItem !== 'object') return;
          if (caseItem.title) parts.push(String(caseItem.title || ''));
          if (caseItem.preconditions) parts.push(String(caseItem.preconditions || ''));
          (Array.isArray(caseItem.steps) ? caseItem.steps : []).forEach(function(step) {
            parts.push(String(step || ''));
          });
          if (caseItem.expected) parts.push(String(caseItem.expected || ''));
        });
      });
      return String(parts.join('\n') || '').replace(/\s+/g, ' ').trim();
    }

    function textMatchesAnyPattern(text, patterns) {
      var source = String(text || '').replace(/\s+/g, ' ').trim();
      if (!source) return false;
      var list = Array.isArray(patterns) ? patterns : [];
      for (var i = 0; i < list.length; i += 1) {
        if (list[i] && list[i].test(source)) return true;
      }
      return false;
    }

    function requirementSuggestsFunctionCondition(text) {
      return textMatchesAnyPattern(text, [
        /解锁/,
        /开放条件|开启条件|使用条件|可用条件/,
        /身份|权限|等级|资格|门槛/,
        /前置任务|前置条件/,
        /资源消耗|消耗.*(次数|积分|金币|钻石|体力|道具)/,
        /时间限制|使用时间|活动期间|开放时间|时段|冷却/,
        /(达到|满足).{0,8}(后|才|方可|即可)/,
        /仅限|才可|才能|方可/
      ]);
    }

    function outputHasFunctionConditionCoverage(text) {
      return textMatchesAnyPattern(text, [
        /解锁/,
        /开放条件|开启条件|使用条件|可用条件/,
        /身份|权限|等级|资格|门槛/,
        /前置任务/,
        /资源消耗|消耗.*(次数|积分|金币|钻石|体力|道具)/,
        /时间限制|使用时间|活动期间|开放时间|时段|冷却/,
        /(达到|满足).{0,8}(后|才|方可|即可)/,
        /仅限|才可|才能|方可/
      ]);
    }

    function requirementSuggestsNumericCoverage(text) {
      return textMatchesAnyPattern(text, [
        /数值|数值验证/,
        /金额|价格|费用|面额/,
        /积分|经验|金币|钻石|体力|奖励/,
        /次数|频次|上限|下限|阈值|临界值|范围/,
        /累计|扣减|增加|减少|消耗/,
        /比例|概率|百分比|占比/,
        /时长|秒|分钟|小时|天/,
        /\d+\s*(元|次|秒|分钟|小时|天|级|积分|经验|金币|钻石|体力|%|％)/
      ]);
    }

    function outputHasNumericCoverage(text) {
      return textMatchesAnyPattern(text, [
        /数值|阈值|范围|上限|下限/,
        /金额|价格|费用/,
        /积分|经验|金币|钻石|体力|奖励/,
        /次数|频次|累计|扣减|增加|减少|结算/,
        /比例|概率|百分比|占比/,
        /时长|秒|分钟|小时|天/,
        /\d+\s*(元|次|秒|分钟|小时|天|级|积分|经验|金币|钻石|体力|%|％)/
      ]);
    }

    function evaluateRootCoverageGaps(task, modules, contract) {
      var result = {
        shouldRetry: false,
        reasonLabels: [],
        diagnostics: [],
      };
      if (!isRootFullGenerationContract(contract)) return result;
      if (Number(task && task.coverageRetryCount || 0) >= 1) return result;
      var generationOptions = parseTaskGenerationOptions(task);
      var requirementText = buildTaskRequirementCoverageText(task);
      var outputText = flattenModulesForCoverageText(modules);

      if (
        generationOptions.needFunctionCondition === true
        && requirementSuggestsFunctionCondition(requirementText)
        && !outputHasFunctionConditionCoverage(outputText)
      ) {
        result.reasonLabels.push('功能使用条件');
        result.diagnostics.push('首轮结果未体现功能使用条件相关覆盖');
      }
      if (
        generationOptions.needNumericValidation === true
        && requirementSuggestsNumericCoverage(requirementText)
        && !outputHasNumericCoverage(outputText)
      ) {
        result.reasonLabels.push('数值验证');
        result.diagnostics.push('首轮结果未体现数值验证相关覆盖');
      }
      result.shouldRetry = result.reasonLabels.length > 0;
      return result;
    }

    function buildRootCoverageRetryInstruction(gapInfo) {
      var labels = Array.isArray(gapInfo && gapInfo.reasonLabels) ? gapInfo.reasonLabels : [];
      if (!labels.length) return '';
      var lines = [];
      lines.push('你上一轮输出没有充分覆盖这些已开启要求：' + labels.join('、') + '。');
      lines.push('请基于同一份需求重新输出完整 JSON 结果，不要只返回补丁。');
      lines.push('这次必须在模块拆分、关键场景、测试要点或用例中直接体现上述覆盖点。');
      lines.push('如果需求里存在解锁、门槛、可用条件、时间限制、资源消耗、次数、阈值、范围或累计扣减，请直接体现在结果中。');
      lines.push('若确实没有任何相关覆盖点，也要在模块/test_points 中明确说明你已检查且无新增必要。');
      return lines.join('\n');
    }

    function buildRootCoverageRetryTaskPayload(task, gapInfo) {
      var retryInstruction = buildRootCoverageRetryInstruction(gapInfo);
      var requestText = String(task && task.requestText ? task.requestText : '');
      var contentBlocks = cloneJson(task && task.contentBlocks, []);
      var taskWorkspaceId = getTaskWorkspaceId(task);
      if (retryInstruction) {
        requestText += '\n\n【首轮生成补强指令】\n' + retryInstruction;
        if (Array.isArray(contentBlocks) && contentBlocks.length && contentBlocks[0] && contentBlocks[0].type === 'text') {
          contentBlocks[0].text = requestText;
        }
      }
      return {
        workspaceId: taskWorkspaceId,
        scope: 'root',
        actionId: String(task && task.actionId ? task.actionId : ''),
        snapshotId: String(task && task.snapshotId ? task.snapshotId : ''),
        contract: cloneJson(task && task.contract, {}),
        historyActionLabel: String(task && task.historyActionLabel ? task.historyActionLabel : ''),
        hadAiContentBeforeAction: task && task.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: task && task.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: task && task.hadAiCasesBeforeAction === true,
        prompt: String(task && task.prompt ? task.prompt : ''),
        requestMode: task && task.requestMode === 'content' ? 'content' : 'text',
        requestText: requestText,
        contentBlocks: Array.isArray(contentBlocks) ? contentBlocks : [],
        degradedToTextOnly: task && task.degradedToTextOnly === true,
        model: cloneJson(task && task.model, null),
        reasoning: String(task && task.reasoning ? task.reasoning : ''),
        temperature: Number(task && task.temperature),
        restoreContext: cloneJson(task && task.restoreContext, {}),
        retryCount: 0,
        coverageRetryCount: Number(task && task.coverageRetryCount || 0) + 1,
        coverageRetryReasons: normalizeHistoryDiagnostics((task && Array.isArray(task.coverageRetryReasons) ? task.coverageRetryReasons : []).concat(gapInfo && gapInfo.reasonLabels ? gapInfo.reasonLabels : [])),
        parentTaskId: String(task && task.id ? task.id : ''),
        rootPipelineId: String(task && task.rootPipelineId ? task.rootPipelineId : ''),
        rootPipelineActionId: String(task && task.rootPipelineActionId ? task.rootPipelineActionId : ''),
        pipelineStage: String(task && task.pipelineStage ? task.pipelineStage : ''),
        historySuppressed: task && task.historySuppressed === true,
        notifySuppressed: task && task.notifySuppressed === true,
      };
    }

    function buildCoverageRetryHistoryDiagnostics(task) {
      var labels = task && Array.isArray(task.coverageRetryReasons) ? normalizeHistoryDiagnostics(task.coverageRetryReasons) : [];
      if (!labels.length) return [];
      return ['已自动补强覆盖：' + labels.join('、')];
    }

    function tryStartRootCoverageRetry(task, gapInfo, anchorNodeId) {
      if (!task || !gapInfo || gapInfo.shouldRetry !== true) return false;
      var retryTask = startManagedXmindTask(buildRootCoverageRetryTaskPayload(task, gapInfo));
      var rootState = ensureRootUiState();
      rootState.running = true;
      rootState.taskId = String(retryTask && retryTask.id ? retryTask.id : '');
      rootState.hideAiLayer = task.hadAiLayerBeforeAction === true;
      rootState.status = '';
      rootState.error = '';
      rootState.lastAction = String(task.actionId || rootState.lastAction || '');
      rootState.snapshotId = String(task.snapshotId || rootState.snapshotId || '');
      rootState.updatedAt = Date.now();
      notifyFloatingStatus('首轮结果未充分覆盖已开启要求，正在自动补强', 'warn', 3000);
      if (isDrawerOpen()) {
        render({ reason: 'root-coverage-retry', persist: false, anchorNodeId: anchorNodeId || getRootNodeId() });
      }
      persistXmindState(true);
      return true;
    }

    function estimateTaskContentBlocksSize(blocks) {
      try {
        return JSON.stringify(Array.isArray(blocks) ? blocks : []).length;
      } catch (err) {
        return 0;
      }
    }

    function clampPositiveInteger(value, fallback, min, max) {
      var num = Math.round(Number(value));
      var safeFallback = Math.round(Number(fallback));
      var lower = Math.round(Number(min || 0));
      var upper = Math.round(Number(max || 0));
      if (!Number.isFinite(safeFallback) || safeFallback <= 0) safeFallback = 1;
      if (!Number.isFinite(num) || num <= 0) num = safeFallback;
      if (Number.isFinite(lower) && lower > 0 && num < lower) num = lower;
      if (Number.isFinite(upper) && upper > 0 && num > upper) num = upper;
      return num;
    }

    function getXmindRequestPayloadLimit() {
      var defaultSettings = config && config.defaultSettings ? config.defaultSettings : {};
      var fallback = Number(config.defaultXmindRequestPayloadLimit)
        || Number(defaultSettings.xmindRequestPayloadLimit)
        || 4000000;
      var raw = state && state.settings ? state.settings.xmindRequestPayloadLimit : null;
      return clampPositiveInteger(
        raw,
        fallback,
        Number(config.minXmindRequestPayloadLimit) || 500000,
        Number(config.maxXmindRequestPayloadLimit) || 10000000
      );
    }

    function buildXmindPayloadLimitError(payloadSize, payloadLimit) {
      return new Error(
        'XMind 请求体超出当前上限（约 '
          + String(payloadSize)
          + ' 字符，当前上限 '
          + String(payloadLimit)
          + '）。请在设置中提高 XMind 请求体上限后重试。'
      );
    }

    async function buildXmindGenerationTaskInput(contract, visibleContext, moduleEntry, options) {
      var opts = options || {};
      var prompt = buildXmindPrompt(contract);
      var payload = await buildRequirementPayload(contract, visibleContext, moduleEntry);
      var model = xmindGenApi && typeof xmindGenApi.getAssignedModel === 'function'
        ? xmindGenApi.getAssignedModel('xmindcasegen')
        : null;
      var reasoning = xmindGenApi && typeof xmindGenApi.getReasoningForType === 'function'
        ? xmindGenApi.getReasoningForType('xmindcasegen')
        : '';
      var temperature = xmindGenApi && typeof xmindGenApi.getTemperatureForType === 'function'
        ? xmindGenApi.getTemperatureForType('xmindcasegen')
        : 0.2;
      var modelCanSeeImages = modelSupportsVision(model);
      var requestMode = 'text';
      var requestText = payload.text;
      var contentBlocks = [];
      var degradedToTextOnly = false;
      var taskWorkspaceId = String(opts.workspaceId || getActiveWorkspaceId() || '');
      var requestPayloadLimit = getXmindRequestPayloadLimit();

      if (payload.images && payload.images.length) {
        if (!modelCanSeeImages && !payload.text) {
          throw new Error('当前 XMind 用例生成模型不支持图片，且需求文本为空');
        }
        if (modelCanSeeImages && xmindGenApi && typeof xmindGenApi.callModelWithContent === 'function') {
          var imageBlocks = await buildImageContentBlocks(payload.images, payload.mode === 'manual');
          if (imageBlocks.stats.sent > 0) {
            contentBlocks = [{ type: 'text', text: payload.text }].concat(imageBlocks.blocks || []);
            var payloadSize = estimateTaskContentBlocksSize(contentBlocks);
            if (payloadSize > requestPayloadLimit) {
              throw buildXmindPayloadLimitError(payloadSize, requestPayloadLimit);
            }
            requestMode = 'content';
          }
        }
      }
      var kbState = await runKnowledgeBasePipelineForGeneration(
        contract,
        visibleContext,
        moduleEntry,
        model,
        reasoning,
        temperature,
        taskWorkspaceId,
        opts.knowledgeBaseActionKey
      );
      if (kbState && kbState.injectedContextText) {
        requestText = String(requestText || '').trim()
          ? (String(requestText || '') + '\n\n' + kbState.injectedContextText)
          : kbState.injectedContextText;
        if (requestMode === 'content') {
          if (Array.isArray(contentBlocks) && contentBlocks.length && contentBlocks[0] && contentBlocks[0].type === 'text') {
            contentBlocks[0].text = requestText;
          } else {
            contentBlocks.unshift({ type: 'text', text: requestText });
          }
        }
      }
      return {
        prompt: prompt,
        requestMode: requestMode,
        requestText: requestText,
        contentBlocks: requestMode === 'content' ? contentBlocks : [],
        degradedToTextOnly: degradedToTextOnly,
        model: cloneJson(model, null),
        reasoning: reasoning,
        temperature: temperature,
      };
    }

    function buildDedupeRequirementSource() {
      var source = getSelectedRequirementSource();
      var prep = getPrepState();
      return {
        label: getRequirementLabelText(),
        text: source && source.text ? String(source.text || '') : '',
        supplement: source && source.supplement
          ? String(source.supplement || '')
          : String(prep && prep.requirementSupplement ? prep.requirementSupplement : ''),
      };
    }

    function buildXmindDedupeTaskInput(modules, options) {
      var opts = options || {};
      var dedupeCoreApi = getXmindCaseDedupeCoreApi();
      if (!dedupeCoreApi || typeof dedupeCoreApi.buildDedupeRequest !== 'function') {
        throw new Error('AI 用例去重能力未就绪，请刷新后重试');
      }
      var model = xmindGenApi && typeof xmindGenApi.getAssignedModel === 'function'
        ? xmindGenApi.getAssignedModel('xmindcasegen')
        : null;
      if (!model || !model.baseUrl || !model.model) {
        throw new Error('未找到 XMind 用例生成模型');
      }
      var requirement = buildDedupeRequirementSource();
      var dedupeMode = normalizeDedupeMode(opts.dedupeMode || getDedupeModeFromSettings());
      var built = dedupeCoreApi.buildDedupeRequest({
        requirementLabel: requirement.label,
        requirementText: requirement.text,
        requirementSupplement: requirement.supplement,
        modules: modules,
        strength: DEDUPE_STRENGTH,
        dedupeMode: dedupeMode,
        source: opts.source || 'manual-toolbar',
      });
      var requestText = String(built && built.requestText ? built.requestText : '');
      var payloadLimit = getXmindRequestPayloadLimit();
      if (requestText.length > payloadLimit) {
        throw buildXmindPayloadLimitError(requestText.length, payloadLimit);
      }
      return {
        prompt: String(built && built.prompt ? built.prompt : ''),
        requestMode: 'text',
        requestText: requestText,
        contentBlocks: [],
        degradedToTextOnly: false,
        model: cloneJson(model, null),
        reasoning: xmindGenApi && typeof xmindGenApi.getReasoningForType === 'function'
          ? xmindGenApi.getReasoningForType('xmindcasegen')
          : '',
        temperature: xmindGenApi && typeof xmindGenApi.getTemperatureForType === 'function'
          ? xmindGenApi.getTemperatureForType('xmindcasegen')
          : 0.2,
        modules: cloneJson(built && built.modules, []),
        dedupeMode: normalizeDedupeMode(built && built.dedupeMode ? built.dedupeMode : dedupeMode),
        beforeCaseCount: Number(built && built.beforeCaseCount || 0),
      };
    }

    function buildCoverageSourceRequest() {
      var coverageCoreApi = getXmindRequirementCoverageCoreApi();
      if (!coverageCoreApi || typeof coverageCoreApi.buildCoverageRequest !== 'function') {
        throw new Error('需求覆盖分析能力未就绪，请刷新后重试');
      }
      var requirementSource = getSelectedRequirementSource();
      var requirementText = requirementSource && requirementSource.text ? String(requirementSource.text || '').trim() : '';
      if (!requirementText) {
        throw new Error('当前页签没有可分析的需求原文');
      }
      var modules = buildVisibleModuleSnapshot(buildVisibleModuleContext());
      var request = coverageCoreApi.buildCoverageRequest({
        requirementText: requirementText,
        modules: modules,
      });
      if (!request || !request.segmentCount) {
        throw new Error('当前需求原文无法拆分为可分析片段');
      }
      if (!request.caseCount) {
        throw new Error('当前页签没有可分析的可见用例');
      }
      return request;
    }

    function buildXmindCoverageTaskInput(request) {
      var sourceRequest = request || buildCoverageSourceRequest();
      var model = xmindGenApi && typeof xmindGenApi.getAssignedModel === 'function'
        ? xmindGenApi.getAssignedModel('xmindcasegen')
        : null;
      if (!model || !model.baseUrl || !model.model) {
        throw new Error('未找到 XMind 用例生成模型');
      }
      var requestText = String(sourceRequest && sourceRequest.requestText ? sourceRequest.requestText : '');
      var payloadLimit = getXmindRequestPayloadLimit();
      if (requestText.length > payloadLimit) {
        throw buildXmindPayloadLimitError(requestText.length, payloadLimit);
      }
      return {
        prompt: String(sourceRequest && sourceRequest.prompt ? sourceRequest.prompt : ''),
        requestMode: 'text',
        requestText: requestText,
        contentBlocks: [],
        degradedToTextOnly: false,
        model: cloneJson(model, null),
        reasoning: xmindGenApi && typeof xmindGenApi.getReasoningForType === 'function'
          ? xmindGenApi.getReasoningForType('xmindcasegen')
          : '',
        temperature: xmindGenApi && typeof xmindGenApi.getTemperatureForType === 'function'
          ? xmindGenApi.getTemperatureForType('xmindcasegen')
          : 0.2,
        coverageRequest: {
          requirementText: String(sourceRequest.requirementText || ''),
          segments: cloneJson(sourceRequest.segments, []),
          cases: cloneJson(sourceRequest.cases, []),
          signature: String(sourceRequest.signature || ''),
        },
        coverageSignature: String(sourceRequest.signature || ''),
        segmentCount: Number(sourceRequest.segmentCount || 0),
        caseCount: Number(sourceRequest.caseCount || 0),
      };
    }

    function createFilterDiagnostics() {
      return {
        inputModuleCount: 0,
        inputCaseCount: 0,
        outputModuleCount: 0,
        outputCaseCount: 0,
        skippedDuplicateOutputModules: 0,
        skippedTargetMismatchModules: 0,
        skippedNewModulesNotAllowed: 0,
        skippedDuplicateVisibleModules: 0,
        skippedCaseDuplicateWithinModule: 0,
        skippedCaseDuplicateVisible: 0,
        clearedCasesForNewModules: 0,
        clearedCasesForExistingModules: 0,
      };
    }

    function filterModulesByContract(modules, contract, visibleContext) {
      var visibleMap = visibleContext && visibleContext.map ? visibleContext.map : {};
      var targetKey = normalizeModuleKey(contract.targetModule || '');
      var finalModules = [];
      var seenModules = {};
      var diagnostics = createFilterDiagnostics();

      diagnostics.inputModuleCount = Array.isArray(modules) ? modules.length : 0;
      (Array.isArray(modules) ? modules : []).forEach(function(item) {
        diagnostics.inputCaseCount += Array.isArray(item && item.cases) ? item.cases.length : 0;
      });

      (Array.isArray(modules) ? modules : []).forEach(function(item) {
        var moduleTitle = normalizeModuleTitle(item.module || '');
        var moduleKey = normalizeModuleKey(moduleTitle);
        if (!moduleKey) return;
        if (seenModules[moduleKey]) {
          diagnostics.skippedDuplicateOutputModules += 1;
          return;
        }
        seenModules[moduleKey] = true;
        var existsVisible = Boolean(visibleMap[moduleKey]);
        if (contract.scope === 'module' && targetKey && moduleKey !== targetKey) {
          diagnostics.skippedTargetMismatchModules += 1;
          return;
        }
        if (contract.allowNewModules !== true && !existsVisible) {
          diagnostics.skippedNewModulesNotAllowed += 1;
          return;
        }
        if (contract.dedupeAgainstVisibleModules === true && existsVisible) {
          diagnostics.skippedDuplicateVisibleModules += 1;
          return;
        }

        var nextItem = {
          module: moduleTitle,
          key_scenarios: normalizeArrayField(item.key_scenarios),
          test_points: normalizeArrayField(item.test_points),
          coupled_modules: normalizeArrayField(item.coupled_modules),
          cases: [],
        };

        var caseSeen = {};
        var visibleCaseSeen = {};
        if (contract.dedupeAgainstVisibleCases === true && visibleMap[moduleKey]) {
          getVisibleCasesForModuleEntry(visibleMap[moduleKey]).forEach(function(row) {
            var key = normalizeCaseTitle(row.item && row.item.title);
            if (key) visibleCaseSeen[key] = true;
          });
        }

        (item.cases || []).forEach(function(caseItem) {
          var normalizedCase = normalizeCaseItem(caseItem, moduleTitle);
          if (!normalizedCase) return;
          var titleKey = normalizeCaseTitle(normalizedCase.title);
          if (!titleKey) return;
          if (caseSeen[titleKey]) {
            diagnostics.skippedCaseDuplicateWithinModule += 1;
            return;
          }
          if (contract.dedupeAgainstVisibleCases === true && visibleCaseSeen[titleKey]) {
            diagnostics.skippedCaseDuplicateVisible += 1;
            return;
          }
          caseSeen[titleKey] = true;
          nextItem.cases.push(normalizedCase);
        });

        if (existsVisible !== true && contract.generateCasesForNewModules !== true) {
          diagnostics.clearedCasesForNewModules += nextItem.cases.length;
          nextItem.cases = [];
        }
        if (existsVisible === true && contract.generateCasesForExistingModules !== true) {
          diagnostics.clearedCasesForExistingModules += nextItem.cases.length;
          nextItem.cases = [];
        }
        finalModules.push(nextItem);
        diagnostics.outputModuleCount += 1;
        diagnostics.outputCaseCount += nextItem.cases.length;
      });

      return {
        list: finalModules,
        diagnostics: diagnostics,
      };
    }

    function mergeCasesWithoutDuplicates(existingList, addedList, visibleList) {
      var result = Array.isArray(existingList) ? existingList.slice() : [];
      var visible = Array.isArray(visibleList) ? visibleList : [];
      var existingSeen = {};
      result.forEach(function(item) {
        var key = normalizeCaseTitle(item && item.title);
        if (key) existingSeen[key] = true;
      });
      visible.forEach(function(item) {
        var key = normalizeCaseTitle(item && item.title);
        if (key) existingSeen[key] = true;
      });
      var appended = [];
      var appendedSeen = {};
      var duplicateAgainstExisting = 0;
      var duplicateWithinAdded = 0;
      (Array.isArray(addedList) ? addedList : []).forEach(function(item) {
        var key = normalizeCaseTitle(item && item.title);
        if (!key) return;
        if (existingSeen[key]) {
          duplicateAgainstExisting += 1;
          return;
        }
        if (appendedSeen[key]) {
          duplicateWithinAdded += 1;
          return;
        }
        appendedSeen[key] = true;
        appended.push(item);
        result.push(item);
      });
      return {
        merged: result,
        appended: appended,
        diagnostics: {
          candidateCount: Array.isArray(addedList) ? addedList.length : 0,
          appendedCount: appended.length,
          duplicateAgainstExisting: duplicateAgainstExisting,
          duplicateWithinAdded: duplicateWithinAdded,
        },
      };
    }

    function getDiagnosticsMetric(diag, key) {
      var value = diag && Number(diag[key]);
      if (!Number.isFinite(value) || value < 0) return 0;
      return value;
    }

    function appendDiagnosticMetric(list, label, count, unit) {
      var value = Number(count);
      if (!Number.isFinite(value) || value <= 0) return;
      list.push(label + ' ' + String(value) + ' ' + String(unit || ''));
    }

    function isRootAppendLikeAction(actionId) {
      return actionId === ROOT_ACTIONS.TOPUP_MODULES
        || actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES
        || actionId === ROOT_ACTIONS.APPEND_ALL;
    }

    function getFriendlyRootEmptyModulesText(actionId) {
      if (actionId === ROOT_ACTIONS.TOPUP_MODULES) return '当前没有需要补充的新模块。';
      if (actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES) return '当前没有需要补充的新模块。';
      if (actionId === ROOT_ACTIONS.EXISTING_CASES) return '当前已有模块下没有需要补充的新用例。';
      if (actionId === ROOT_ACTIONS.APPEND_ALL) return '当前没有需要补充的新模块或新用例。';
      if (actionId === ROOT_ACTIONS.FULL_MODULES || actionId === ROOT_ACTIONS.REGENERATE_MODULES) {
        return '这次没有生成出任何模块。';
      }
      if (actionId === ROOT_ACTIONS.FULL_CASES) return '这次没有生成出任何模块或用例。';
      return '这次没有生成出新的模块或用例。';
    }

    function getFriendlyModuleEmptyCasesText(actionId) {
      if (actionId === MODULE_ACTIONS.APPEND) return '当前模块没有需要补充的新用例。';
      if (actionId === MODULE_ACTIONS.FULL_CASES) return '这次没有为当前模块生成出用例。';
      return '这次没有为当前模块生成出新的用例。';
    }

    function buildGenerationErrorInfo(err) {
      var rawMessage = err && err.message ? String(err.message) : '未知错误';
      var detailText = normalizeHistoryLongText(rawMessage, 2000);
      var reasonText = '模型调用出错，请稍后重试。';
      if (/XMind 请求体超出当前上限/.test(rawMessage)) {
        reasonText = rawMessage;
      } else if (
        /context length|maximum context|context window|maximum context length|max context|too many tokens|token limit|prompt too long|input is too long|request too large|payload too large|context_length_exceeded|maximum token|超出.*上下文|上下文.*超限|输入.*过长/i.test(rawMessage)
      ) {
        reasonText = '模型上下文超限，请在设置中提高知识库注入上限、目录送模上限或 XMind 请求体上限后重试。';
      } else if (/超时/.test(rawMessage)) {
        reasonText = '模型响应超时，请稍后重试。';
      } else if (/503|service unavailable/i.test(rawMessage)) {
        reasonText = '模型服务暂时不可用，请稍后重试。';
      } else if (/network|fetch|failed to fetch|网络/i.test(rawMessage)) {
        reasonText = '模型连接失败，请检查网络后重试。';
      }
      return {
        resultKind: 'error',
        reasonText: reasonText,
        diagnostics: detailText ? ['错误信息：' + detailText] : [],
        previewText: '',
      };
    }

    function buildModelOutputNoChangeInfo(scope, actionId, modelDiagnostics) {
      var diagnostics = [];
      var previewText = modelDiagnostics && modelDiagnostics.rawPreview ? String(modelDiagnostics.rawPreview) : '';
      var reasonText = '';
      if (!modelDiagnostics) return null;

      if (modelDiagnostics.parseStatus === 'empty') {
        reasonText = '模型这次没有返回内容。';
        diagnostics.push('模型返回为空');
      } else if (modelDiagnostics.parseStatus === 'plain-text') {
        reasonText = '模型返回的是说明文字，不是系统可识别的结果。';
        diagnostics.push('返回格式：说明文字');
      } else if (modelDiagnostics.parseStatus === 'invalid-json') {
        reasonText = '模型返回结果格式不完整，系统暂时没法识别。';
        diagnostics.push('返回格式有问题');
      } else if (modelDiagnostics.missingModulesArray === true) {
        reasonText = '模型有返回内容，但没有给出可识别的模块列表。';
        diagnostics.push('没有返回模块列表');
      } else if (modelDiagnostics.emptyModulesArray === true) {
        reasonText = scope === 'module'
          ? getFriendlyModuleEmptyCasesText(actionId)
          : getFriendlyRootEmptyModulesText(actionId);
        diagnostics.push(scope === 'module' ? '模型返回空结果' : '模块列表为空');
      } else if (getDiagnosticsMetric(modelDiagnostics, 'moduleCandidateCount') > 0 && getDiagnosticsMetric(modelDiagnostics, 'normalizedModuleCount') <= 0) {
        reasonText = '模型有返回模块内容，但格式不完整，系统没法识别。';
        appendDiagnosticMetric(diagnostics, '未识别模块', getDiagnosticsMetric(modelDiagnostics, 'skippedNonObjectModules'), '个');
      } else if (getDiagnosticsMetric(modelDiagnostics, 'caseCandidateCount') > 0 && getDiagnosticsMetric(modelDiagnostics, 'normalizedCaseCount') <= 0) {
        reasonText = '模型有返回用例内容，但格式不完整，系统没法识别。';
        appendDiagnosticMetric(diagnostics, '未识别用例', getDiagnosticsMetric(modelDiagnostics, 'skippedInvalidCases'), '条');
      } else {
        return null;
      }

      return {
        resultKind: 'no-change',
        reasonText: reasonText,
        diagnostics: diagnostics,
        previewText: previewText,
      };
    }

    function buildRootNoChangeInfo(actionId, filterDiagnostics, applyDiagnostics, modelDiagnostics) {
      var rawModuleCount = getDiagnosticsMetric(filterDiagnostics, 'inputModuleCount');
      var rawCaseCount = getDiagnosticsMetric(filterDiagnostics, 'inputCaseCount');
      var outputModuleCount = getDiagnosticsMetric(filterDiagnostics, 'outputModuleCount');
      var outputCaseCount = getDiagnosticsMetric(filterDiagnostics, 'outputCaseCount');
      var duplicateVisibleModules = getDiagnosticsMetric(filterDiagnostics, 'skippedDuplicateVisibleModules');
      var duplicateVisibleCases = getDiagnosticsMetric(filterDiagnostics, 'skippedCaseDuplicateVisible')
        + getDiagnosticsMetric(applyDiagnostics, 'duplicateAgainstExistingCases');
      var duplicateOutputModules = getDiagnosticsMetric(filterDiagnostics, 'skippedDuplicateOutputModules');
      var duplicateOutputCases = getDiagnosticsMetric(filterDiagnostics, 'skippedCaseDuplicateWithinModule')
        + getDiagnosticsMetric(applyDiagnostics, 'duplicateWithinAddedCases');
      var targetMismatchModules = getDiagnosticsMetric(filterDiagnostics, 'skippedTargetMismatchModules');
      var blockedNewModules = getDiagnosticsMetric(filterDiagnostics, 'skippedNewModulesNotAllowed');
      var reasonText = '';
      var diagnostics = [];
      var previewText = '';

      appendDiagnosticMetric(diagnostics, '已有模块已覆盖', duplicateVisibleModules, '个');
      appendDiagnosticMetric(diagnostics, '已有用例已覆盖', duplicateVisibleCases, '条');
      appendDiagnosticMetric(diagnostics, '模型结果里有重复模块', duplicateOutputModules, '个');
      appendDiagnosticMetric(diagnostics, '模型结果里有重复用例', duplicateOutputCases, '条');
      appendDiagnosticMetric(diagnostics, '返回了当前目标外的模块', targetMismatchModules, '个');
      appendDiagnosticMetric(diagnostics, '本次动作不允许新增模块', blockedNewModules, '个');

      if (rawModuleCount <= 0 && rawCaseCount <= 0) {
        var modelOutputIssue = buildModelOutputNoChangeInfo('root', actionId, modelDiagnostics);
        if (modelOutputIssue) {
          return modelOutputIssue;
        }
        reasonText = '这次没有拿到可用的生成结果。';
        if (modelDiagnostics && modelDiagnostics.rawPreview) previewText = modelDiagnostics.rawPreview;
      } else if (duplicateVisibleModules > 0 && outputModuleCount <= 0) {
        reasonText = '当前模块已经覆盖，不需要再补充新模块。';
      } else if (duplicateVisibleCases > 0 && outputModuleCount > 0) {
        reasonText = '当前已有用例已经覆盖，本轮没有补出新的用例。';
      } else if (duplicateVisibleCases > 0 && outputCaseCount <= 0) {
        reasonText = '当前已有内容已经覆盖，本轮没有补出新的结果。';
      } else if (targetMismatchModules > 0 || blockedNewModules > 0) {
        reasonText = '模型返回的内容和当前操作不匹配，所以这次没有采用。';
      } else if (outputModuleCount > 0 && outputCaseCount <= 0) {
        if (actionId === ROOT_ACTIONS.EXISTING_CASES || actionId === ROOT_ACTIONS.APPEND_ALL) {
          reasonText = '模型识别到了模块，但判断当前没有需要补充的新用例。';
        } else if (isRootAppendLikeAction(actionId)) {
          reasonText = '当前没有需要补充的新模块。';
        } else {
          reasonText = '模型识别到了模块，但这次没有生成出新的用例。';
        }
      } else if (duplicateOutputModules > 0 || duplicateOutputCases > 0) {
        reasonText = '模型返回内容里有重复项，整理后没有留下新的结果。';
      } else {
        reasonText = '这次没有生成出新的模块或用例。';
      }

      return {
        resultKind: 'no-change',
        reasonText: reasonText,
        diagnostics: diagnostics,
        previewText: previewText,
      };
    }

    function buildModuleNoChangeInfo(actionId, filterDiagnostics, mergeDiagnostics, targetOutput, modelDiagnostics) {
      var rawModuleCount = getDiagnosticsMetric(filterDiagnostics, 'inputModuleCount');
      var rawCaseCount = getDiagnosticsMetric(filterDiagnostics, 'inputCaseCount');
      var outputModuleCount = getDiagnosticsMetric(filterDiagnostics, 'outputModuleCount');
      var outputCaseCount = getDiagnosticsMetric(filterDiagnostics, 'outputCaseCount');
      var duplicateVisibleCases = getDiagnosticsMetric(filterDiagnostics, 'skippedCaseDuplicateVisible')
        + getDiagnosticsMetric(mergeDiagnostics, 'duplicateAgainstExisting');
      var duplicateOutputCases = getDiagnosticsMetric(filterDiagnostics, 'skippedCaseDuplicateWithinModule')
        + getDiagnosticsMetric(mergeDiagnostics, 'duplicateWithinAdded');
      var targetMismatchModules = getDiagnosticsMetric(filterDiagnostics, 'skippedTargetMismatchModules');
      var blockedNewModules = getDiagnosticsMetric(filterDiagnostics, 'skippedNewModulesNotAllowed');
      var reasonText = '';
      var diagnostics = [];
      var targetCaseCount = Array.isArray(targetOutput && targetOutput.cases) ? targetOutput.cases.length : 0;
      var previewText = '';

      appendDiagnosticMetric(diagnostics, '已有用例已覆盖', duplicateVisibleCases, '条');
      appendDiagnosticMetric(diagnostics, '模型结果里有重复用例', duplicateOutputCases, '条');
      appendDiagnosticMetric(diagnostics, '返回了当前目标外的模块', targetMismatchModules, '个');
      appendDiagnosticMetric(diagnostics, '本次动作不允许新增模块', blockedNewModules, '个');

      if (rawModuleCount <= 0 && rawCaseCount <= 0) {
        var modelOutputIssue = buildModelOutputNoChangeInfo('module', actionId, modelDiagnostics);
        if (modelOutputIssue) {
          return modelOutputIssue;
        }
        reasonText = '这次没有拿到可用的生成结果。';
        if (modelDiagnostics && modelDiagnostics.rawPreview) previewText = modelDiagnostics.rawPreview;
      } else if (actionId === MODULE_ACTIONS.APPEND) {
        if (duplicateVisibleCases > 0) {
          reasonText = '当前模块已有用例已经覆盖，本轮没有补出新的用例。';
        } else if (targetMismatchModules > 0 || blockedNewModules > 0 || outputModuleCount <= 0) {
          reasonText = '模型返回的内容没有命中当前模块，所以这次没有采用。';
        } else if (duplicateOutputCases > 0 && targetCaseCount <= 0) {
          reasonText = '模型返回内容里有重复项，整理后没有留下新的用例。';
        } else if (targetCaseCount <= 0 || outputCaseCount <= 0) {
          reasonText = '当前模块没有需要补充的新用例。';
        } else {
          reasonText = '这次没有补出新的用例。';
        }
      } else if (targetMismatchModules > 0 || blockedNewModules > 0 || outputModuleCount <= 0) {
        reasonText = '模型返回的内容没有命中当前模块，所以这次没有采用。';
      } else if (duplicateOutputCases > 0 && targetCaseCount <= 0) {
        reasonText = '模型返回内容里有重复项，整理后没有留下新的用例。';
      } else if (targetCaseCount <= 0 || outputCaseCount <= 0) {
        reasonText = '这次没有为当前模块生成出用例。';
      } else {
        reasonText = '这次没有生成出新的用例。';
      }

      return {
        resultKind: 'no-change',
        reasonText: reasonText,
        diagnostics: diagnostics,
        previewText: previewText,
      };
    }

    function clearAllTopupHighlights() {
      var rootState = ensureState();
      Object.keys(rootState.modules || {}).forEach(function(key) {
        var moduleState = ensureModuleUiState(key);
        if (!moduleState) return;
        moduleState.topupHighlight = null;
      });
    }

    function cloneTopupHighlight(marker) {
      if (!marker || typeof marker !== 'object') return null;
      var highlightScope = marker.highlightScope === 'module' || marker.highlightScope === 'subtree'
        ? String(marker.highlightScope || '')
        : 'cases';
      var startIndex = Number(marker.startIndex);
      var count = Number(marker.count);
      if (highlightScope === 'cases') {
        if (!Number.isFinite(startIndex) || startIndex < 0) return null;
        if (!Number.isFinite(count) || count <= 0) return null;
      } else {
        if (!Number.isFinite(startIndex) || startIndex < 0) startIndex = 0;
        if (!Number.isFinite(count) || count < 0) count = 0;
      }
      return {
        token: marker.token ? String(marker.token) : '',
        label: marker.label ? String(marker.label) : '本轮追加用例',
        startIndex: startIndex,
        count: count,
        updatedAt: Number(marker.updatedAt || 0),
        highlightScope: highlightScope,
      };
    }

    function clearModuleTopupHighlight(moduleState) {
      if (!moduleState || typeof moduleState !== 'object') return;
      moduleState.topupHighlight = null;
    }

    function setModuleRootPendingAction(moduleState, actionId) {
      if (!moduleState || typeof moduleState !== 'object') return;
      moduleState.rootPendingActionId = actionId ? String(actionId || '') : '';
      moduleState.updatedAt = Date.now();
    }

    function clearModuleRootPendingAction(moduleState, actionId) {
      if (!moduleState || typeof moduleState !== 'object') return;
      if (actionId && String(moduleState.rootPendingActionId || '') !== String(actionId || '')) return;
      moduleState.rootPendingActionId = '';
      moduleState.updatedAt = Date.now();
    }

    function markRootPendingModules(moduleEntries, actionId) {
      var list = Array.isArray(moduleEntries) ? moduleEntries : [];
      list.forEach(function(entry) {
        if (!entry || !entry.aiModuleId) return;
        setModuleRootPendingAction(ensureModuleUiState(entry.aiModuleId), actionId);
      });
    }

    function clearRootPendingModules(actionId) {
      var modulesState = ensureState().modules || {};
      Object.keys(modulesState).forEach(function(key) {
        clearModuleRootPendingAction(modulesState[key], actionId);
      });
    }

    function buildTopupHighlightLabel(count, highlightScope) {
      if (highlightScope === 'module') return '本轮补全模块';
      if (highlightScope === 'subtree') {
        var subtreeTotal = Number(count);
        if (!Number.isFinite(subtreeTotal) || subtreeTotal <= 0) return '本轮补全模块+用例';
        return subtreeTotal > 1 ? ('本轮补全模块+用例 · ' + subtreeTotal + ' 条') : '本轮补全模块+用例';
      }
      var total = Number(count);
      if (!Number.isFinite(total) || total <= 0) return '本轮追加用例';
      return total > 1 ? ('本轮追加用例 · ' + total + ' 条') : '本轮追加用例';
    }

    function setModuleTopupHighlight(moduleState, moduleKey, startIndex, count, options) {
      options = options || {};
      var highlightScope = options.highlightScope === 'module' || options.highlightScope === 'subtree'
        ? String(options.highlightScope || '')
        : 'cases';
      var safeStartIndex = Number(startIndex);
      var safeCount = Number(count);
      if (highlightScope === 'cases') {
        if (!moduleState || !Number.isFinite(safeStartIndex) || !Number.isFinite(safeCount) || safeCount <= 0) {
          clearModuleTopupHighlight(moduleState);
          return null;
        }
      } else if (!moduleState) {
        clearModuleTopupHighlight(moduleState);
        return null;
      }
      var tokenPrefix = buildNodeId(['topup-highlight', moduleKey || 'module']) || 'topup-highlight';
      moduleState.topupHighlight = {
        token: generateLocalId(tokenPrefix),
        label: options.label ? String(options.label || '') : buildTopupHighlightLabel(safeCount, highlightScope),
        startIndex: Number.isFinite(safeStartIndex) && safeStartIndex >= 0 ? safeStartIndex : 0,
        count: Number.isFinite(safeCount) && safeCount >= 0 ? safeCount : 0,
        updatedAt: Date.now(),
        highlightScope: highlightScope,
      };
      setDebugState({
        topupPhase: 'set',
        topupModule: String(moduleKey || ''),
        topupStartIndex: moduleState.topupHighlight.startIndex,
        topupCount: moduleState.topupHighlight.count,
        topupScope: highlightScope,
        topupToken: String(moduleState.topupHighlight.token || '')
      });
      return moduleState.topupHighlight;
    }

    function getModuleTopupHighlight(moduleState) {
      return cloneTopupHighlight(moduleState && moduleState.topupHighlight);
    }

    function getCaseTopupHighlight(moduleState, caseIndex) {
      var marker = getModuleTopupHighlight(moduleState);
      var index = Number(caseIndex);
      if (!marker) return null;
      if (marker.highlightScope === 'subtree') return marker;
      if (marker.highlightScope !== 'cases') return null;
      if (!Number.isFinite(index) || index < 0) return null;
      if (index < marker.startIndex) return null;
      if (index >= marker.startIndex + marker.count) return null;
      return marker;
    }

    function getModuleNodeTopupHighlight(moduleState) {
      var marker = getModuleTopupHighlight(moduleState);
      if (!marker) return null;
      if (marker.highlightScope === 'module' || marker.highlightScope === 'subtree') return marker;
      return null;
    }

    function getTopupHighlightMapElement(viewerEl) {
      var rootEl = viewerEl || topupHighlightViewerEl || mindContainer;
      if (mindInstance && mindInstance.map) {
        if (!rootEl || rootEl === mindInstance.map || (rootEl.contains && rootEl.contains(mindInstance.map))) {
          return mindInstance.map;
        }
      }
      if (!rootEl) return null;
      if (rootEl.classList && rootEl.classList.contains('map-canvas')) return rootEl;
      return rootEl.querySelector ? rootEl.querySelector('.map-canvas') : null;
    }

    function clearTopupHighlightLayer(hostEl) {
      var layerHostEl = getTopupHighlightMapElement(hostEl) || hostEl;
      if (!layerHostEl || !layerHostEl.querySelectorAll) return;
      clearDashedConnectorPathMarks(layerHostEl);
      var frames = layerHostEl.querySelectorAll('[data-xmind-casegen-topup-frame]');
      if (frames && frames.length) {
        Array.prototype.forEach.call(frames, function(frameEl) {
          if (!frameEl || !frameEl.parentNode) return;
          frameEl.parentNode.removeChild(frameEl);
        });
      }
      var layer = layerHostEl.querySelector
        ? layerHostEl.querySelector('[data-xmind-casegen-topup-layer]')
        : null;
      if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    }

    function ensureTopupHighlightLayer(hostEl) {
      var layerHostEl = getTopupHighlightMapElement(hostEl) || hostEl;
      if (!layerHostEl || !layerHostEl.querySelector || !layerHostEl.appendChild) return null;
      var layer = layerHostEl.querySelector('[data-xmind-casegen-topup-layer]');
      if (layer) return layer;
      layer = document.createElement('div');
      layer.className = 'xmind-casegen-topup-highlight-layer';
      layer.setAttribute('data-xmind-casegen-topup-layer', '1');
      layerHostEl.appendChild(layer);
      return layer;
    }

    function clearDashedConnectorPathMarks(hostEl) {
      var layerHostEl = getTopupHighlightMapElement(hostEl) || hostEl;
      if (!layerHostEl || !layerHostEl.querySelectorAll) return;
      var paths = layerHostEl.querySelectorAll(
        'svg path.xmind-casegen-pending-link, svg path[data-xmind-casegen-link], svg path[data-xmind-casegen-overlay-source]'
      );
      if (!paths || !paths.length) return;
      Array.prototype.forEach.call(paths, function(pathEl) {
        if (!pathEl || !pathEl.removeAttribute) return;
        if (pathEl.classList) pathEl.classList.remove('xmind-casegen-pending-link');
        pathEl.removeAttribute('data-xmind-casegen-link');
        pathEl.removeAttribute('data-xmind-casegen-overlay-source');
        pathEl.removeAttribute('stroke-dasharray');
        pathEl.removeAttribute('stroke-linecap');
        pathEl.removeAttribute('stroke-opacity');
        pathEl.removeAttribute('opacity');
      });
    }

    function ensureTopupConnectorSvg(layerEl, mapRect, scale) {
      if (!layerEl || !layerEl.querySelector || !layerEl.appendChild || !mapRect) return null;
      var svgEl = layerEl.querySelector('[data-xmind-casegen-topup-connectors]');
      if (!svgEl) {
        svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.setAttribute('data-xmind-casegen-topup-connectors', '1');
        svgEl.setAttribute('preserveAspectRatio', 'none');
        svgEl.classList.add('xmind-casegen-topup-connectors');
        if (layerEl.firstChild) {
          layerEl.insertBefore(svgEl, layerEl.firstChild);
        } else {
          layerEl.appendChild(svgEl);
        }
      }
      var safeScale = Number(scale);
      if (!Number.isFinite(safeScale) || safeScale <= 0) safeScale = 1;
      var width = Math.max(1, mapRect.width / safeScale);
      var height = Math.max(1, mapRect.height / safeScale);
      svgEl.setAttribute('viewBox', '0 0 ' + String(width) + ' ' + String(height));
      svgEl.setAttribute('width', String(width));
      svgEl.setAttribute('height', String(height));
      while (svgEl.firstChild) {
        svgEl.removeChild(svgEl.firstChild);
      }
      return svgEl;
    }

    function findDirectChildByTag(parentEl, tagName) {
      if (!parentEl || !parentEl.children) return null;
      var targetTag = String(tagName || '').toLowerCase();
      for (var i = 0; i < parentEl.children.length; i += 1) {
        var childEl = parentEl.children[i];
        if (!childEl || !childEl.tagName) continue;
        if (String(childEl.tagName).toLowerCase() === targetTag) return childEl;
      }
      return null;
    }

    function getParentTopicElement(nodeEl) {
      var wrapperEl = nodeEl && nodeEl.closest ? nodeEl.closest('me-wrapper') : null;
      if (!wrapperEl || !wrapperEl.parentElement) return null;
      var parentContainer = wrapperEl.parentElement;
      var parentTag = parentContainer.tagName ? String(parentContainer.tagName).toLowerCase() : '';
      if (parentTag === 'me-children') {
        var parentHost = parentContainer.parentElement;
        if (!parentHost) return null;
        return findDirectChildByTag(parentHost, 'me-tpc');
      }
      if (parentTag === 'me-main') {
        var nodesHost = parentContainer.parentElement;
        if (!nodesHost) return null;
        var rootHost = findDirectChildByTag(nodesHost, 'me-root');
        if (!rootHost || !rootHost.querySelector) return null;
        return rootHost.querySelector('me-tpc');
      }
      return null;
    }

    function resolveNodeConnectorColor(nodeEl, fallbackColor) {
      var fallback = fallbackColor || '#2563eb';
      if (!nodeEl || typeof window === 'undefined' || !window.getComputedStyle) return fallback;
      var boxEl = nodeEl.querySelector ? nodeEl.querySelector('.box') : null;
      var sourceEl = boxEl || nodeEl;
      if (!sourceEl) return fallback;
      var computed = window.getComputedStyle(sourceEl);
      if (!computed) return fallback;
      var borderColor = String(computed.borderColor || '').trim();
      if (borderColor && borderColor !== 'transparent' && borderColor !== 'rgba(0, 0, 0, 0)') return borderColor;
      var color = String(computed.color || '').trim();
      if (color && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') return color;
      return fallback;
    }

    function parsePathEdgePoint(pathData, pointType) {
      var text = String(pathData || '').trim();
      if (!text) return null;
      var numberMatches = text.match(/-?\d+(?:\.\d+)?/g);
      if (!numberMatches || numberMatches.length < 4) return null;
      if (pointType === 'start') {
        return {
          x: Number(numberMatches[0]),
          y: Number(numberMatches[1]),
        };
      }
      return {
        x: Number(numberMatches[numberMatches.length - 2]),
        y: Number(numberMatches[numberMatches.length - 1]),
      };
    }

    function computeExpectedConnectorPoint(nodeEl, mapRect, scale, pointType) {
      if (!nodeEl || !mapRect || !nodeEl.getBoundingClientRect) return null;
      var safeScale = Number(scale);
      if (!Number.isFinite(safeScale) || safeScale <= 0) safeScale = 1;
      var rect = nodeEl.getBoundingClientRect();
      if (!rect) return null;
      var leftFlow = isNodeFlowLeft(nodeEl);
      var isStart = pointType === 'start';
      var x = 0;
      if (isStart) {
        x = leftFlow ? rect.left : rect.right;
      } else {
        x = leftFlow ? rect.right : rect.left;
      }
      return {
        x: (x - mapRect.left) / safeScale,
        y: ((rect.top + (rect.height / 2)) - mapRect.top) / safeScale,
      };
    }

    function resolveExistingConnectorPaths(nodeEl, mapEl) {
      var wrapperEl = nodeEl && nodeEl.closest ? nodeEl.closest('me-wrapper') : null;
      if (!wrapperEl || !wrapperEl.parentElement || !mapEl || !mapEl.querySelectorAll) return [];
      var parentContainer = wrapperEl.parentElement;
      var parentTag = parentContainer.tagName ? String(parentContainer.tagName).toLowerCase() : '';
      if (parentTag === 'me-main') {
        return Array.prototype.slice.call(mapEl.querySelectorAll('svg.lines path'));
      }
      if (parentTag === 'me-children') {
        var parentHost = parentContainer.parentElement;
        if (!parentHost || !parentHost.querySelectorAll) return [];
        return Array.prototype.slice.call(parentHost.querySelectorAll(':scope > svg.subLines path'));
      }
      return [];
    }

    function findExistingConnectorPathData(fromEl, toEl, mapEl, mapRect, scale) {
      var candidates = resolveExistingConnectorPaths(toEl, mapEl);
      if (!candidates.length) return null;
      var expectedStart = computeExpectedConnectorPoint(fromEl, mapRect, scale, 'start');
      var expectedEnd = computeExpectedConnectorPoint(toEl, mapRect, scale, 'end');
      if (!expectedStart || !expectedEnd) return null;
      var bestData = '';
      var bestPathEl = null;
      var bestScore = Number.POSITIVE_INFINITY;
      candidates.forEach(function(pathEl) {
        if (!pathEl || !pathEl.getAttribute) return;
        var d = String(pathEl.getAttribute('d') || '').trim();
        if (!d) return;
        var startPoint = parsePathEdgePoint(d, 'start');
        var endPoint = parsePathEdgePoint(d, 'end');
        if (!startPoint || !endPoint) return;
        var score = Math.abs(startPoint.x - expectedStart.x)
          + Math.abs(startPoint.y - expectedStart.y)
          + Math.abs(endPoint.x - expectedEnd.x)
          + Math.abs(endPoint.y - expectedEnd.y);
        if (score < bestScore) {
          bestScore = score;
          bestData = d;
          bestPathEl = pathEl;
        }
      });
      if (!bestData) return null;
      return {
        pathData: bestData,
        pathEl: bestPathEl
      };
    }

    function buildOverlayConnectorPath(fromEl, toEl, mapEl, mapRect, scale) {
      if (!fromEl || !toEl || !mapRect || !fromEl.getBoundingClientRect || !toEl.getBoundingClientRect) return '';
      var existingMatch = findExistingConnectorPathData(fromEl, toEl, mapEl, mapRect, scale);
      if (existingMatch && existingMatch.pathData) return existingMatch;
      var safeScale = Number(scale);
      if (!Number.isFinite(safeScale) || safeScale <= 0) safeScale = 1;
      var fromRect = fromEl.getBoundingClientRect();
      var toRect = toEl.getBoundingClientRect();
      if (!fromRect || !toRect) return '';
      var leftFlow = isNodeFlowLeft(toEl);
      var startX = ((leftFlow ? fromRect.left : fromRect.right) - mapRect.left) / safeScale;
      var startY = ((fromRect.top + (fromRect.height / 2)) - mapRect.top) / safeScale;
      var endX = ((leftFlow ? toRect.right : toRect.left) - mapRect.left) / safeScale;
      var endY = ((toRect.top + (toRect.height / 2)) - mapRect.top) / safeScale;
      var distanceX = Math.abs(endX - startX);
      var control = Math.max(24, distanceX * 0.45);
      var controlStartX = leftFlow ? (startX - control) : (startX + control);
      var controlEndX = leftFlow ? (endX + control) : (endX - control);
      return {
        pathData: 'M ' + startX + ' ' + startY + ' C ' + controlStartX + ' ' + startY + ', ' + controlEndX + ' ' + endY + ', ' + endX + ' ' + endY,
        pathEl: null
      };
    }

    function resolveOverlayMaskColor(primaryEl, fallbackEl) {
      function readSolidBackground(el) {
        if (!el || typeof window === 'undefined' || !window.getComputedStyle) return '';
        var computed = window.getComputedStyle(el);
        if (!computed) return '';
        var bg = String(computed.backgroundColor || '').trim();
        if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return '';
        return bg;
      }
      var bg = readSolidBackground(primaryEl) || readSolidBackground(fallbackEl);
      if (bg) return bg;
      var theme = typeof document !== 'undefined' && document && document.documentElement
        ? String(document.documentElement.getAttribute('data-theme') || '')
        : '';
      return theme === 'dark' ? '#0f172a' : '#f8fafc';
    }

    function appendOverlayConnector(svgEl, fromEl, toEl, mapEl, mapRect, scale, color, connectorType, maskColor) {
      if (!svgEl || !fromEl || !toEl) return false;
      var connectorPath = buildOverlayConnectorPath(fromEl, toEl, mapEl, mapRect, scale);
      if (!connectorPath || !connectorPath.pathData) return false;
      var pathData = connectorPath.pathData;
      if (connectorPath.pathEl && connectorPath.pathEl.setAttribute) {
        connectorPath.pathEl.setAttribute('data-xmind-casegen-overlay-source', String(connectorType || 'topup-overlay'));
        connectorPath.pathEl.setAttribute('stroke-opacity', '0');
        connectorPath.pathEl.setAttribute('opacity', '0');
      }
      var maskPathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      maskPathEl.setAttribute('d', pathData);
      maskPathEl.setAttribute('fill', 'none');
      maskPathEl.setAttribute('stroke', maskColor || '#f8fafc');
      maskPathEl.setAttribute('stroke-width', '7');
      maskPathEl.setAttribute('stroke-linecap', 'round');
      maskPathEl.setAttribute('stroke-linejoin', 'round');
      maskPathEl.setAttribute('data-xmind-casegen-link-mask', String(connectorType || 'topup-overlay'));
      svgEl.appendChild(maskPathEl);
      var pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', pathData);
      pathEl.setAttribute('fill', 'none');
      pathEl.setAttribute('stroke', color || '#2563eb');
      pathEl.setAttribute('stroke-width', '2.6');
      pathEl.setAttribute('stroke-dasharray', '6 5');
      pathEl.setAttribute('stroke-linecap', 'round');
      pathEl.setAttribute('stroke-linejoin', 'round');
      pathEl.setAttribute('data-xmind-casegen-link', String(connectorType || 'topup-overlay'));
      pathEl.classList.add('xmind-casegen-pending-link');
      svgEl.appendChild(pathEl);
      return true;
    }

    function renderOverlayConnectors(layerEl, mapEl, mapRect, scale) {
      if (!layerEl || !mapEl || !mapRect) return;
      var svgEl = ensureTopupConnectorSvg(layerEl, mapRect, scale);
      if (!svgEl) return;
      var viewerEl = getTopupHighlightViewerElement();
      var maskColor = resolveOverlayMaskColor(viewerEl, mapEl);
      var placeholderNodes = mapEl.querySelectorAll('me-tpc.xmind-casegen-node-topup-placeholder');
      Array.prototype.forEach.call(placeholderNodes || [], function(nodeEl) {
        var parentEl = getParentTopicElement(nodeEl);
        if (!parentEl) return;
        appendOverlayConnector(
          svgEl,
          parentEl,
          nodeEl,
          mapEl,
          mapRect,
          scale,
          resolveNodeConnectorColor(nodeEl, '#2563eb'),
          'topup-pending',
          maskColor
        );
      });
      var moduleNodes = mapEl.querySelectorAll('me-tpc.xmind-casegen-node-module[data-xmind-topup-highlight-token][data-xmind-topup-highlight-scope]');
      Array.prototype.forEach.call(moduleNodes || [], function(nodeEl) {
        var scope = nodeEl.getAttribute ? String(nodeEl.getAttribute('data-xmind-topup-highlight-scope') || '') : '';
        if (scope !== 'module' && scope !== 'subtree') return;
        var parentEl = getParentTopicElement(nodeEl);
        if (!parentEl) return;
        appendOverlayConnector(
          svgEl,
          parentEl,
          nodeEl,
          mapEl,
          mapRect,
          scale,
          resolveNodeConnectorColor(nodeEl, '#2563eb'),
          'topup-highlight',
          maskColor
        );
      });
    }

    function resolveTopupHighlightHost(wrapperEl) {
      if (!wrapperEl || !wrapperEl.parentElement) return null;
      var childrenEl = wrapperEl.parentElement;
      if (!childrenEl.tagName || String(childrenEl.tagName).toLowerCase() !== 'me-children') return null;
      return childrenEl.parentElement || null;
    }

    function getTopupHighlightViewerElement() {
      if (!mindContainer) return null;
      if (mindContainer.classList && mindContainer.classList.contains('xmind-structure-viewer')) return mindContainer;
      return mindContainer.querySelector ? mindContainer.querySelector('.xmind-structure-viewer') : null;
    }

    function cleanupTopupHighlightPresentation() {
      if (topupHighlightSyncTimer) {
        clearTimeout(topupHighlightSyncTimer);
        topupHighlightSyncTimer = 0;
      }
      if (topupHighlightRetryTimer) {
        clearTimeout(topupHighlightRetryTimer);
        topupHighlightRetryTimer = 0;
      }
      topupHighlightRetryCount = 0;
      if (topupHighlightMutationObserver) {
        topupHighlightMutationObserver.disconnect();
        topupHighlightMutationObserver = null;
      }
      if (topupHighlightResizeObserver) {
        topupHighlightResizeObserver.disconnect();
        topupHighlightResizeObserver = null;
      }
      if (topupHighlightMapEl || topupHighlightViewerEl) {
        clearTopupHighlightLayer(topupHighlightMapEl || topupHighlightViewerEl);
      }
      if (topupHighlightCanvasEl && topupHighlightScrollHandler) {
        topupHighlightCanvasEl.removeEventListener('scroll', topupHighlightScrollHandler);
      }
      if (window && topupHighlightResizeHandler) {
        window.removeEventListener('resize', topupHighlightResizeHandler);
      }
      topupHighlightViewerEl = null;
      topupHighlightMapEl = null;
      topupHighlightCanvasEl = null;
      topupHighlightScrollHandler = null;
      topupHighlightResizeHandler = null;
    }

    function scheduleTopupHighlightSync() {
      if (topupHighlightSyncTimer) clearTimeout(topupHighlightSyncTimer);
      topupHighlightSyncTimer = setTimeout(function() {
        topupHighlightSyncTimer = 0;
        syncTopupHighlightPresentation();
      }, 40);
    }

    function scheduleTopupHighlightRetry(delayMs) {
      if (topupHighlightRetryTimer) clearTimeout(topupHighlightRetryTimer);
      topupHighlightRetryTimer = setTimeout(function() {
        topupHighlightRetryTimer = 0;
        syncTopupHighlightPresentation();
      }, Number(delayMs) || 120);
    }

    function syncTopupHighlightPresentation() {
      var viewerEl = getTopupHighlightViewerElement();
      var mapEl = getTopupHighlightMapElement(viewerEl);
      if (!viewerEl || !mapEl) return;
      clearTopupHighlightLayer(mapEl);
      var highlightedNodes = mapEl.querySelectorAll('[data-xmind-topup-highlight-token]');
      var placeholderNodes = mapEl.querySelectorAll('me-tpc.xmind-casegen-node-topup-placeholder');
      var hasOverlayTargets = Boolean((highlightedNodes && highlightedNodes.length) || (placeholderNodes && placeholderNodes.length));
      if (!hasOverlayTargets) {
        topupHighlightRetryCount = 0;
        setDebugState({ topupPhase: 'empty', topupNodeCount: 0 });
        return;
      }
      var viewerRect = viewerEl.getBoundingClientRect ? viewerEl.getBoundingClientRect() : null;
      var mapRect = mapEl.getBoundingClientRect ? mapEl.getBoundingClientRect() : null;
      if (!viewerRect || !mapRect) return;
      var layerEl = ensureTopupHighlightLayer(mapEl);
      if (!layerEl) return;
      var scale = Number(mindInstance && mindInstance.scaleVal);
      if (!Number.isFinite(scale) || scale <= 0) scale = 1;
      var grouped = {};
      Array.prototype.forEach.call(highlightedNodes, function(nodeEl) {
        var token = nodeEl && nodeEl.getAttribute ? String(nodeEl.getAttribute('data-xmind-topup-highlight-token') || '') : '';
        if (!token) return;
        if (!grouped[token]) {
          grouped[token] = { label: '', nodes: [], hasVisibleNode: false };
        }
        if (!grouped[token].label && nodeEl.getAttribute) {
          grouped[token].label = String(nodeEl.getAttribute('data-xmind-topup-highlight-label') || '本轮追加用例');
        }
        if (nodeEl && nodeEl.getBoundingClientRect) {
          var nodeRect = nodeEl.getBoundingClientRect();
          if (
            nodeRect
            && nodeRect.right > viewerRect.left
            && nodeRect.left < viewerRect.right
            && nodeRect.bottom > viewerRect.top
            && nodeRect.top < viewerRect.bottom
          ) {
            grouped[token].hasVisibleNode = true;
          }
        }
        grouped[token].nodes.push(nodeEl);
      });
      var expectedFrameCount = 0;
      var renderedFrameCount = 0;
      Object.keys(grouped).forEach(function(token) {
        var group = grouped[token];
        if (!group || !group.nodes || !group.nodes.length) return;
        expectedFrameCount += 1;
        var minLeft = Infinity;
        var minTop = Infinity;
        var maxRight = -Infinity;
        var maxBottom = -Infinity;
        group.nodes.forEach(function(nodeEl) {
          if (!nodeEl || !nodeEl.getBoundingClientRect) return;
          var rect = nodeEl.getBoundingClientRect();
          minLeft = Math.min(minLeft, rect.left);
          minTop = Math.min(minTop, rect.top);
          maxRight = Math.max(maxRight, rect.right);
          maxBottom = Math.max(maxBottom, rect.bottom);
        });
        if (!Number.isFinite(minLeft) || !Number.isFinite(minTop) || !Number.isFinite(maxRight) || !Number.isFinite(maxBottom)) return;
        var frameEl = document.createElement('div');
        frameEl.className = 'xmind-casegen-topup-highlight-frame';
        frameEl.setAttribute('data-xmind-casegen-topup-frame', token);
        var left = (minLeft - mapRect.left - 18) / scale;
        var top = (minTop - mapRect.top - 18) / scale;
        var width = (maxRight - minLeft + 36) / scale;
        var height = (maxBottom - minTop + 36) / scale;
        frameEl.style.left = left + 'px';
        frameEl.style.top = top + 'px';
        frameEl.style.width = width + 'px';
        frameEl.style.height = height + 'px';
        var labelEl = document.createElement('span');
        labelEl.className = 'xmind-casegen-topup-highlight-label';
        labelEl.textContent = group.label || '本轮追加用例';
        frameEl.appendChild(labelEl);
        layerEl.appendChild(frameEl);
        renderedFrameCount += 1;
      });
      renderOverlayConnectors(layerEl, mapEl, mapRect, scale);
      if (expectedFrameCount > renderedFrameCount && topupHighlightRetryCount < 4) {
        topupHighlightRetryCount += 1;
        scheduleTopupHighlightRetry(120 + (topupHighlightRetryCount * 60));
      } else {
        topupHighlightRetryCount = 0;
      }
      setDebugState({
        topupPhase: 'rendered',
        topupNodeCount: highlightedNodes.length,
        topupFrameCount: layerEl.querySelectorAll ? layerEl.querySelectorAll('[data-xmind-casegen-topup-frame]').length : 0,
        topupExpectedFrameCount: expectedFrameCount,
        topupRetryCount: topupHighlightRetryCount
      });
    }

    function getLatestCaseGenOperationSnapshotLocal() {
      var xmindState = ensureState();
      var list = Array.isArray(xmindState.operationSnapshots) ? xmindState.operationSnapshots : [];
      return list.length ? list[list.length - 1] : null;
    }

    function syncCaseGenOperationPointersLocal() {
      var xmindState = ensureState();
      var latest = getLatestCaseGenOperationSnapshotLocal();
      xmindState.lastOperationSnapshotId = latest && latest.id ? String(latest.id || '') : '';
      xmindState.rootSnapshotId = latest && latest.scope === 'root'
        ? String(latest.id || '')
        : '';
      xmindState.root.snapshotId = String(xmindState.rootSnapshotId || '');
      Object.keys(xmindState.modules || {}).forEach(function(key) {
        var moduleState = ensureModuleUiState(key);
        if (latest && latest.scope === 'module' && String(latest.moduleId || '') === String(key || '')) {
          moduleState.snapshotId = String(latest.id || '');
        } else {
          moduleState.snapshotId = '';
        }
      });
    }

    function createCaseGenOperationSnapshotLocal(scope, moduleId) {
      var xmindState = ensureState();
      var snapshotId = 'op-snap-' + String(xmindState.nextSnapshotId || 1);
      xmindState.nextSnapshotId = Number(xmindState.nextSnapshotId || 1) + 1;
      xmindState.operationSnapshots.push({
        id: snapshotId,
        scope: scope === 'module' ? 'module' : 'root',
        moduleId: moduleId ? String(moduleId || '') : '',
        caseGenModules: cloneJson(state.caseGenModules, []),
        caseGenResults: cloneJson(state.caseGenResults, {}),
        caseSelections: cloneSelectionMap(state.caseSelections),
        caseGenSuggestions: cloneJson(state.caseGenSuggestions, {}),
        caseGenModuleStatus: cloneJson(state.caseGenModuleStatus, {}),
        caseGenProgress: cloneJson(state.caseGenProgress, {}),
        caseGenTiming: cloneJson(state.caseGenTiming, {}),
        caseGenSource: String(state.caseGenSource || ''),
        createdAt: Date.now(),
      });
      syncCaseGenOperationPointersLocal();
      xmindState.root.updatedAt = Date.now();
      return snapshotId;
    }

    function discardCaseGenOperationSnapshotLocal(snapshotId) {
      var targetId = String(snapshotId || '');
      if (!targetId) return false;
      var xmindState = ensureState();
      var list = Array.isArray(xmindState.operationSnapshots) ? xmindState.operationSnapshots : [];
      var nextList = list.filter(function(item) {
        return item && String(item.id || '') !== targetId;
      });
      if (nextList.length === list.length) return false;
      xmindState.operationSnapshots = nextList;
      syncCaseGenOperationPointersLocal();
      return true;
    }

    function applyCaseGenOperationSnapshotLocal(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') return false;
      var xmindState = ensureState();
      state.caseGenModules = cloneJson(snapshot.caseGenModules, []);
      state.caseGenResults = cloneJson(snapshot.caseGenResults, {});
      state.caseSelections = restoreSelectionMap(snapshot.caseSelections);
      state.caseGenSuggestions = cloneJson(snapshot.caseGenSuggestions, {});
      state.caseGenModuleStatus = cloneJson(snapshot.caseGenModuleStatus, {});
      state.caseGenProgress = cloneJson(snapshot.caseGenProgress, {});
      state.caseGenTiming = cloneJson(snapshot.caseGenTiming, {});
      state.caseGenSource = String(snapshot.caseGenSource || '');
      xmindState.hasModuleSkeleton = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      xmindState.root.lastAction = ROOT_ACTIONS.ROLLBACK;
      xmindState.root.running = false;
      xmindState.root.taskId = '';
      xmindState.root.status = '';
      xmindState.root.error = '';
      xmindState.root.updatedAt = Date.now();
      Object.keys(xmindState.modules || {}).forEach(function(key) {
        var moduleState = ensureModuleUiState(key);
        moduleState.running = false;
        moduleState.taskId = '';
        moduleState.rootPendingActionId = '';
        moduleState.status = '';
        moduleState.error = '';
        moduleState.hideResults = false;
        moduleState.lastAction = 'rollback';
        moduleState.updatedAt = Date.now();
      });
      syncCaseGenOperationPointersLocal();
      clearAllTopupHighlights();
      clearDeleteHistoryStacks();
      syncCasesGenPageRender();
      persistXmindState(true);
      return true;
    }

    function rollbackCaseGenOperationSnapshotLocal(snapshotId) {
      var xmindState = ensureState();
      var targetId = String(snapshotId || '');
      var snapshot = null;
      var index = -1;
      var list = Array.isArray(xmindState.operationSnapshots) ? xmindState.operationSnapshots : [];
      if (targetId) {
        for (var i = list.length - 1; i >= 0; i -= 1) {
          var item = list[i];
          if (!item || String(item.id || '') !== targetId) continue;
          snapshot = item;
          index = i;
          break;
        }
      } else if (list.length) {
        index = list.length - 1;
        snapshot = list[index];
      }
      if (!snapshot || index < 0) return false;
      xmindState.operationSnapshots.splice(index, 1);
      return applyCaseGenOperationSnapshotLocal(snapshot);
    }

    function snapshotAllCaseGenStateLocal() {
      return createCaseGenOperationSnapshotLocal('root', '');
    }

    function rollbackAllCaseGenStateLocal() {
      var latest = getLatestCaseGenOperationSnapshotLocal();
      if (!latest) return false;
      return rollbackCaseGenOperationSnapshotLocal(String(latest.id || '')) === true;
    }

    function bindTopupHighlightPresentation() {
      cleanupTopupHighlightPresentation();
      var viewerEl = getTopupHighlightViewerElement();
      if (!viewerEl) return;
      topupHighlightViewerEl = viewerEl;
      topupHighlightMapEl = getTopupHighlightMapElement(viewerEl);
      topupHighlightCanvasEl = viewerEl.querySelector ? viewerEl.querySelector('[data-mind-canvas]') : null;
      topupHighlightScrollHandler = scheduleTopupHighlightSync;
      topupHighlightResizeHandler = scheduleTopupHighlightSync;
      if (topupHighlightCanvasEl) {
        topupHighlightCanvasEl.addEventListener('scroll', topupHighlightScrollHandler, { passive: true });
      }
      if (window) window.addEventListener('resize', topupHighlightResizeHandler, { passive: true });
      if (typeof MutationObserver !== 'undefined') {
        topupHighlightMutationObserver = new MutationObserver(scheduleTopupHighlightSync);
        topupHighlightMutationObserver.observe(viewerEl, { childList: true, subtree: true, attributes: true });
      }
      if (typeof ResizeObserver !== 'undefined') {
        topupHighlightResizeObserver = new ResizeObserver(scheduleTopupHighlightSync);
        topupHighlightResizeObserver.observe(viewerEl);
      }
      syncTopupHighlightPresentation();
      scheduleTopupHighlightSync();
    }

    function clearStaleModuleUiState() {
      var rootState = ensureState();
      var valid = {};
      (state.caseGenModules || []).forEach(function(mod) {
        if (!mod || !mod.id) return;
        valid[String(mod.id)] = true;
      });
      Object.keys(rootState.modules).forEach(function(key) {
        if (!valid[key]) delete rootState.modules[key];
      });
      rootState.snapshots = rootState.snapshots.filter(function(item) {
        if (!item) return false;
        if (!item.moduleId) return false;
        return item.moduleExistsBefore !== true || valid[String(item.moduleId || '')] || item.moduleExistsBefore === false;
      });
    }

    function hasAnyAiCases() {
      var modules = Array.isArray(state.caseGenModules) ? state.caseGenModules : [];
      for (var i = 0; i < modules.length; i += 1) {
        if (!modules[i] || !modules[i].id) continue;
        if (getAiCasesForModule(modules[i].id).length > 0) return true;
      }
      return false;
    }

    function hasAnyAiModules() {
      return Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
    }

    function hasAnyVisibleContent() {
      var context = buildVisibleModuleContext();
      return context.list.some(function(entry) {
        return getVisibleCasesForModuleEntry(entry).length > 0;
      });
    }

    function hasOnlyAiModuleSkeleton() {
      return Array.isArray(state.caseGenModules)
        && state.caseGenModules.length > 0
        && !hasAnyAiCases();
    }

    function isRootActionId(actionId) {
      return actionId === ROOT_ACTIONS.FULL_CASES
        || actionId === ROOT_ACTIONS.FULL_MODULES
        || actionId === ROOT_ACTIONS.REGENERATE_MODULES
        || actionId === ROOT_ACTIONS.EXISTING_CASES
        || actionId === ROOT_ACTIONS.TOPUP_MODULES
        || actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES
        || actionId === ROOT_ACTIONS.APPEND_ALL
        || actionId === ROOT_ACTIONS.ROLLBACK;
    }

    function isModuleActionId(actionId) {
      return actionId === MODULE_ACTIONS.FULL_CASES
        || actionId === MODULE_ACTIONS.APPEND
        || actionId === MODULE_ACTIONS.ROLLBACK;
    }

    function isRollbackActionId(actionId) {
      return actionId === ROOT_ACTIONS.ROLLBACK || actionId === MODULE_ACTIONS.ROLLBACK;
    }

    function isRootModuleOnlyIncrementalAction(actionId) {
      return actionId === ROOT_ACTIONS.TOPUP_MODULES || actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES;
    }

    function hasAnyRunningGenerationOperation() {
      return collectRunningGenerationOperations().length > 0;
    }

    function collectRunningGenerationOperations() {
      var activeWorkspaceId = getActiveWorkspaceId();
      var runningTasks = filterTasksByWorkspace(listManagedXmindTasks(), activeWorkspaceId).filter(function(task) {
        return task && task.status === 'running';
      });
      if (runningTasks.length) {
        return runningTasks.map(function(task) {
          if (!task) return null;
          if (task.scope === 'root') {
            return {
              scope: 'root',
              actionId: String(task.actionId || task.rootPipelineActionId || ''),
              label: '根节点',
            };
          }
          if (task.scope === 'module') {
            return {
              scope: 'module',
              actionId: String(task.actionId || ''),
              moduleId: String(task.moduleId || ''),
              moduleKey: String(task.moduleKey || ''),
              label: task.moduleTitle
                ? String(task.moduleTitle || '')
                : '模块',
            };
          }
          if (task.scope === 'dedupe') {
            return {
              scope: 'dedupe',
              actionId: DEDUPE_ACTION_ID,
              dedupeMode: normalizeDedupeMode(task.dedupeMode),
              label: 'AI用例去重',
            };
          }
          if (task.scope === 'coverage') {
            return {
              scope: 'coverage',
              actionId: COVERAGE_ACTION_ID,
              label: '需求覆盖分析',
            };
          }
          return null;
        }).filter(Boolean);
      }
      var operations = [];
      var rootState = ensureRootUiState();
      if (rootState && rootState.running && rootState.lastAction && rootState.lastAction !== DEDUPE_ACTION_ID) {
        operations.push({
          scope: 'root',
          actionId: String(rootState.lastAction || ''),
          label: '根节点',
        });
      }
      var dedupeState = ensureDedupeUiState();
      if (dedupeState.running === true) {
        operations.push({
          scope: 'dedupe',
          actionId: DEDUPE_ACTION_ID,
          dedupeMode: normalizeDedupeMode(dedupeState.dedupeMode),
          label: 'AI用例去重',
        });
      } else if (
        dedupeState.terminalVisualRunning === true
        && Number(dedupeState.terminalVisualUntil || 0) > Date.now()
      ) {
        operations.push({
          scope: 'dedupe',
          actionId: DEDUPE_ACTION_ID,
          dedupeMode: normalizeDedupeMode(dedupeState.dedupeMode),
          label: 'AI用例去重',
        });
      }
      var coverageState = ensureCoverageUiState();
      if (coverageState.running === true) {
        operations.push({
          scope: 'coverage',
          actionId: COVERAGE_ACTION_ID,
          label: '需求覆盖分析',
        });
      }
      var modulesState = ensureState().modules || {};
      Object.keys(modulesState).forEach(function(key) {
        var moduleState = modulesState[key];
        if (!moduleState || moduleState.running !== true) return;
        var moduleRecord = findAiModuleById(key);
        operations.push({
          scope: 'module',
          actionId: String(moduleState.lastAction || ''),
          moduleId: String(key || ''),
          moduleKey: moduleRecord ? normalizeModuleKey(moduleRecord.title || moduleRecord.module || '') : '',
          label: moduleRecord && (moduleRecord.title || moduleRecord.module)
            ? String(moduleRecord.title || moduleRecord.module)
            : '模块',
        });
      });
      return operations;
    }

    function doesRootActionConflictWithModuleOperation(rootActionId) {
      if (isRollbackActionId(rootActionId)) return true;
      if (isRootModuleOnlyIncrementalAction(rootActionId)) return false;
      return true;
    }

    function doesModuleActionConflictWithRootOperation(rootActionId, moduleActionId) {
      if (isRollbackActionId(moduleActionId)) return true;
      if (isRootModuleOnlyIncrementalAction(rootActionId)) return false;
      return true;
    }

    function doesModuleActionConflictWithModuleOperation(actionId, moduleEntry, runningOperation) {
      if (!runningOperation) return false;
      if (isRollbackActionId(actionId)) return true;
      var targetModuleId = moduleEntry && moduleEntry.aiModuleId ? String(moduleEntry.aiModuleId || '') : '';
      var targetModuleKey = moduleEntry && moduleEntry.moduleKey ? String(moduleEntry.moduleKey || '') : '';
      if (targetModuleId && runningOperation.moduleId && targetModuleId === String(runningOperation.moduleId || '')) return true;
      if (targetModuleKey && runningOperation.moduleKey && targetModuleKey === String(runningOperation.moduleKey || '')) return true;
      return false;
    }

    function resolveBlockingOperation(actionId, moduleEntry) {
      var operations = collectRunningGenerationOperations();
      if (!operations.length) return null;
      for (var i = 0; i < operations.length; i += 1) {
        var operation = operations[i];
        if (!operation) continue;
        if (operation.scope === 'root') {
          if (isRootActionId(actionId)) return operation;
          if (isModuleActionId(actionId) && doesModuleActionConflictWithRootOperation(operation.actionId, actionId)) {
            return operation;
          }
          continue;
        }
        if (operation.scope === 'module') {
          if (isRootActionId(actionId) && doesRootActionConflictWithModuleOperation(actionId)) {
            return operation;
          }
          if (isModuleActionId(actionId) && doesModuleActionConflictWithModuleOperation(actionId, moduleEntry, operation)) {
            return operation;
          }
        }
        if (operation.scope === 'dedupe') {
          return operation;
        }
        if (operation.scope === 'coverage') {
          return operation;
        }
      }
      return null;
    }

    function isActionBlocked(actionId, moduleEntry) {
      return Boolean(resolveBlockingOperation(actionId, moduleEntry));
    }

    function getRootFullCasesLabel(hasAiContent) {
      return hasAiContent ? '重新生成全量用例' : '生成全量用例';
    }

    function getModuleFullCasesLabel(moduleEntry) {
      var moduleId = moduleEntry && moduleEntry.aiModuleId ? String(moduleEntry.aiModuleId || '') : '';
      return moduleId && hasAiCasesForModule(moduleId) ? '重新生成全量用例' : '生成全量用例';
    }

    function setModuleResultsVisibility(moduleId, visible) {
      var moduleState = ensureModuleUiState(moduleId);
      if (!moduleState) return;
      moduleState.hideResults = visible !== true;
      moduleState.updatedAt = Date.now();
    }

    function setAllModuleResultsVisibility(visible) {
      (Array.isArray(state.caseGenModules) ? state.caseGenModules : []).forEach(function(mod) {
        if (!mod || !mod.id) return;
        setModuleResultsVisibility(mod.id, visible === true);
      });
    }

    function buildBlockedActionMessage(actionId, blocker) {
      if (!blocker) return '当前动作不可执行';
      if (blocker.scope === 'root') {
        if (isRootModuleOnlyIncrementalAction(blocker.actionId) && isModuleActionId(actionId)) {
          return '当前模块可继续生成，用例无冲突时允许并行';
        }
        return '当前有根节点生成任务会影响该操作，请等待完成后再试';
      }
      if (blocker.scope === 'module') {
        if (isRootModuleOnlyIncrementalAction(actionId)) {
          return '';
        }
        return blocker.label
          ? ('当前有模块生成任务进行中：' + blocker.label)
          : '当前有模块生成任务进行中，请等待完成后再试';
      }
      if (blocker.scope === 'dedupe') {
        return getDedupeRunningLabel(blocker.dedupeMode) + '，请等待完成后再试';
      }
      if (blocker.scope === 'coverage') {
        return '需求覆盖分析中，请等待完成后再试';
      }
      return '当前动作不可执行';
    }

    function getLatestCaseGenOperationSnapshotEntry() {
      if (casesGenApi && typeof casesGenApi.getLatestCaseGenOperationSnapshot === 'function') {
        return casesGenApi.getLatestCaseGenOperationSnapshot();
      }
      return getLatestCaseGenOperationSnapshotLocal();
    }

    function rollbackCaseGenOperationSnapshotEntry(snapshotId) {
      if (casesGenApi && typeof casesGenApi.rollbackCaseGenOperationSnapshot === 'function') {
        return casesGenApi.rollbackCaseGenOperationSnapshot(snapshotId) === true;
      }
      return rollbackCaseGenOperationSnapshotLocal(snapshotId) === true;
    }

    function discardCaseGenOperationSnapshotEntry(snapshotId) {
      if (casesGenApi && typeof casesGenApi.discardCaseGenOperationSnapshot === 'function') {
        return casesGenApi.discardCaseGenOperationSnapshot(snapshotId) === true;
      }
      return discardCaseGenOperationSnapshotLocal(snapshotId) === true;
    }

    function isDeleteActionId(actionId) {
      return actionId === COMMON_ACTIONS.DELETE;
    }

    function isDeleteNodeType(type) {
      return type === 'module'
        || type === 'case'
        || type === 'priority'
        || type === 'preconditions'
        || type === 'steps'
        || type === 'expected';
    }

    function buildDeleteTargetKey(meta) {
      if (!meta || !meta.type) return '';
      if (meta.type === 'module') {
        return 'module::' + String(meta.moduleKey || normalizeModuleKey(meta.moduleTitle || ''));
      }
      if (!isDeleteNodeType(meta.type)) return '';
      return [
        'case',
        String(meta.moduleKey || normalizeModuleKey(meta.moduleTitle || '')),
        String(meta.caseSource || ''),
        String(Number(meta.caseSourceIndex)),
        String(meta.caseSignature || normalizeCaseTitle(meta.caseTitle || ''))
      ].join('::');
    }

    function buildDeleteSelectionPlan(nodeMeta) {
      var selection = nodeMeta && Array.isArray(nodeMeta.selection) && nodeMeta.selection.length
        ? nodeMeta.selection
        : (nodeMeta ? [nodeMeta] : []);
      var visibleContext = ensureVisibleModuleContext(buildVisibleModuleContext());
      var visibleMap = visibleContext.map || {};
      var moduleTargets = {};
      var caseTargets = {};

      selection.forEach(function(item) {
        var meta = item && item.meta ? item.meta : null;
        if (!meta || !isDeleteNodeType(meta.type)) return;
        var moduleKey = String(meta.moduleKey || normalizeModuleKey(meta.moduleTitle || ''));
        var moduleEntry = moduleKey ? visibleMap[moduleKey] : null;
        var moduleTitle = normalizeModuleTitle(
          meta.moduleTitle
          || (moduleEntry && moduleEntry.title)
          || ''
        );
        if (!moduleKey && !moduleTitle) return;
        if (meta.type === 'module') {
          if (!moduleTargets[moduleKey]) {
            moduleTargets[moduleKey] = {
              type: 'module',
              key: buildDeleteTargetKey(meta),
              moduleKey: moduleKey,
              moduleTitle: moduleTitle || '模块',
              moduleId: moduleEntry && moduleEntry.aiModuleId ? String(moduleEntry.aiModuleId || '') : '',
              deleteAiLayer: Boolean(moduleEntry && moduleEntry.aiModuleId),
              deleteBaselineLayer: Boolean(moduleEntry && Array.isArray(moduleEntry.baselineCases) && moduleEntry.baselineCases.length > 0),
            };
          } else {
            moduleTargets[moduleKey].deleteAiLayer = moduleTargets[moduleKey].deleteAiLayer || Boolean(moduleEntry && moduleEntry.aiModuleId);
            moduleTargets[moduleKey].deleteBaselineLayer = moduleTargets[moduleKey].deleteBaselineLayer || Boolean(moduleEntry && Array.isArray(moduleEntry.baselineCases) && moduleEntry.baselineCases.length > 0);
          }
          return;
        }
        if (!moduleEntry && !moduleTitle) return;
        caseTargets[buildDeleteTargetKey(meta)] = {
          type: 'case',
          moduleKey: moduleKey,
          moduleTitle: moduleTitle || '模块',
          moduleId: moduleEntry && moduleEntry.aiModuleId ? String(moduleEntry.aiModuleId || '') : '',
          caseTitle: String(meta.caseTitle || ''),
          caseSource: String(meta.caseSource || ''),
          caseSourceIndex: Number.isFinite(Number(meta.caseSourceIndex)) ? Number(meta.caseSourceIndex) : -1,
          caseSignature: String(meta.caseSignature || ''),
        };
      });

      Object.keys(caseTargets).forEach(function(key) {
        var target = caseTargets[key];
        if (target && target.moduleKey && moduleTargets[target.moduleKey]) {
          delete caseTargets[key];
        }
      });

      return {
        modules: Object.keys(moduleTargets).map(function(key) { return moduleTargets[key]; }),
        cases: Object.keys(caseTargets).map(function(key) { return caseTargets[key]; }),
      };
    }

    function hasDeleteTargets(nodeMeta) {
      var plan = buildDeleteSelectionPlan(nodeMeta);
      return Boolean((plan.modules && plan.modules.length) || (plan.cases && plan.cases.length));
    }

    function buildDeleteSummaryText(plan) {
      var modulesCount = plan && Array.isArray(plan.modules) ? plan.modules.length : 0;
      var casesCount = plan && Array.isArray(plan.cases) ? plan.cases.length : 0;
      var parts = [];
      if (modulesCount > 0) parts.push(String(modulesCount) + ' 个模块');
      if (casesCount > 0) parts.push(String(casesCount) + ' 条用例');
      return parts.join('、') || '当前选中内容';
    }

    function confirmDeleteSelection(plan) {
      hideOpenMindContextMenu();
      var confirmDrawer = window.app && window.app.confirmDrawer ? window.app.confirmDrawer : null;
      var summary = buildDeleteSummaryText(plan);
      var message = '确认删除选中的 ' + summary + '？删除后会以当前树为新的基线，之前的“放弃本次生成”回退记录将失效。';
      if (!confirmDrawer || typeof confirmDrawer.open !== 'function') {
        var ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(message)
          : true;
        return Promise.resolve(ok === true);
      }
      return confirmDrawer.open({
        title: '确认删除',
        message: message,
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
      }).then(function(result) {
        return Boolean(result && result.ok === true);
      });
    }

    function removeAiModuleRecord(moduleId) {
      var targetId = String(moduleId || '');
      if (!targetId) return false;
      var beforeCount = Array.isArray(state.caseGenModules) ? state.caseGenModules.length : 0;
      state.caseGenModules = (Array.isArray(state.caseGenModules) ? state.caseGenModules : []).filter(function(mod) {
        return !mod || String(mod.id || '') !== targetId;
      });
      delete state.caseGenResults[targetId];
      delete state.caseSelections[targetId];
      delete state.caseGenSuggestions[targetId];
      delete state.caseGenModuleStatus[targetId];
      delete state.caseGenProgress[targetId];
      delete state.caseGenTiming[targetId];
      if (ensureState().modules && ensureState().modules[targetId]) {
        delete ensureState().modules[targetId];
      }
      ensureState().hasModuleSkeleton = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      return beforeCount !== state.caseGenModules.length;
    }

    function removeAiCasesFromModule(moduleId, targets) {
      var targetId = String(moduleId || '');
      var list = getAiCasesForModule(targetId);
      var targetList = Array.isArray(targets) ? targets.slice() : [];
      var moduleRecord = findAiModuleById(targetId);
      var moduleTitle = moduleRecord ? normalizeModuleTitle(moduleRecord.title || moduleRecord.module || '') : '';
      var removedCount = 0;
      if (!targetId || !list.length || !targetList.length) return 0;
      var nextList = list.filter(function(item, index) {
        var shouldDelete = targetList.some(function(target) {
          if (!target || String(target.caseSource || '') !== 'ai') return false;
          var targetIndex = Number(target.caseSourceIndex);
          if (Number.isFinite(targetIndex) && targetIndex !== index) return false;
          if (target.caseSignature) {
            return String(target.caseSignature || '') === buildCaseSignature(item, moduleTitle);
          }
          if (target.caseTitle) {
            return normalizeCaseTitle(target.caseTitle) === normalizeCaseTitle(item && item.title);
          }
          return true;
        });
        if (shouldDelete) {
          removedCount += 1;
          return false;
        }
        return true;
      });
      if (!removedCount) return 0;
      commitCaseList(targetId, nextList, null, '', '');
      return removedCount;
    }

    async function handleDeleteSelection(nodeMeta) {
      hideOpenMindContextMenu();
      if (hasAnyRunningGenerationOperation()) {
        notifyStatus('当前有生成任务进行中，请等待完成后再删除', 'warn', { forceInline: true });
        return false;
      }
      var plan = buildDeleteSelectionPlan(nodeMeta);
      if (!plan.modules.length && !plan.cases.length) {
        notifyStatus('当前选中节点不支持删除', 'warn', { forceInline: true });
        return false;
      }
      var confirmed = await confirmDeleteSelection(plan);
      if (!confirmed) return false;
      var beforeSnapshot = buildDeleteHistorySnapshotPayload();

      var changed = false;
      var affectedModuleIds = {};

      plan.modules.forEach(function(target) {
        if (!target) return;
        if (target.deleteBaselineLayer === true) {
          changed = rememberDeletedBaselineModule(target.moduleTitle) || changed;
        }
        if (target.deleteAiLayer === true && target.moduleId) {
          affectedModuleIds[String(target.moduleId || '')] = true;
          changed = removeAiModuleRecord(target.moduleId) || changed;
        }
      });

      var aiCaseTargetsByModule = {};
      plan.cases.forEach(function(target) {
        if (!target) return;
        if (target.caseSource === 'baseline') {
          changed = rememberDeletedBaselineCase(target.moduleTitle, target.caseSignature) || changed;
          return;
        }
        if (target.caseSource === 'ai' && target.moduleId) {
          var key = String(target.moduleId || '');
          if (!aiCaseTargetsByModule[key]) aiCaseTargetsByModule[key] = [];
          aiCaseTargetsByModule[key].push(target);
        }
      });

      Object.keys(aiCaseTargetsByModule).forEach(function(moduleId) {
        var removedCount = removeAiCasesFromModule(moduleId, aiCaseTargetsByModule[moduleId]);
        if (removedCount > 0) {
          affectedModuleIds[moduleId] = true;
          changed = true;
        }
      });

      if (!changed) {
        notifyStatus('当前选中内容未发生变化', 'warn', { forceInline: true });
        return false;
      }

      Object.keys(affectedModuleIds).forEach(function(moduleId) {
        var moduleState = ensureState().modules ? ensureState().modules[moduleId] : null;
        if (moduleState) clearModuleTopupHighlight(moduleState);
      });
      invalidateDeleteConflictingSnapshots();
      pushDeleteHistoryEntry(plan, beforeSnapshot, buildDeleteHistorySnapshotPayload());
      syncCasesGenPageRender();
      notifyStatus('已删除 ' + buildDeleteSummaryText(plan), 'ok');
      render({ reason: 'delete-selection' });
      persistXmindState(true);
      return true;
    }

    function buildDeleteAction(nodeMeta) {
      var enabled = hasDeleteTargets(nodeMeta) && !hasAnyRunningGenerationOperation();
      return {
        id: COMMON_ACTIONS.DELETE,
        label: '删除',
        disabled: !enabled,
      };
    }

    function getRootActions() {
      var hasBaseline = hasVisibleImportedBaselineCases();
      var hasSkeleton = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      var hasAiCases = hasAnyAiCases();
      var fullCasesLabel = getRootFullCasesLabel(hasSkeleton || hasAiCases);
      var canRollback = Boolean(getLatestCaseGenOperationSnapshotEntry());
      if (!hasBaseline && !hasSkeleton && !hasAiCases) {
        return [
          { id: ROOT_ACTIONS.FULL_CASES, label: fullCasesLabel, disabled: isActionBlocked(ROOT_ACTIONS.FULL_CASES, null) },
          { id: ROOT_ACTIONS.FULL_MODULES, label: '生成全量模块', disabled: isActionBlocked(ROOT_ACTIONS.FULL_MODULES, null) },
        ];
      }
      if (!hasBaseline) {
        var actions = [
          { id: ROOT_ACTIONS.FULL_CASES, label: fullCasesLabel, disabled: isActionBlocked(ROOT_ACTIONS.FULL_CASES, null) },
        ];
        if (hasSkeleton) {
          actions.push({ id: ROOT_ACTIONS.REGENERATE_MODULES, label: '重新生成模块', disabled: isActionBlocked(ROOT_ACTIONS.REGENERATE_MODULES, null) });
        }
        actions = actions.concat([
          { id: ROOT_ACTIONS.EXISTING_CASES, label: '已有模块补全用例', disabled: isActionBlocked(ROOT_ACTIONS.EXISTING_CASES, null) },
          { id: ROOT_ACTIONS.TOPUP_MODULES, label: '补全模块', disabled: isActionBlocked(ROOT_ACTIONS.TOPUP_MODULES, null) },
          { id: ROOT_ACTIONS.TOPUP_MODULES_CASES, label: '补全模块+用例', disabled: isActionBlocked(ROOT_ACTIONS.TOPUP_MODULES_CASES, null) },
          { id: ROOT_ACTIONS.ROLLBACK, label: '放弃本次生成', disabled: !canRollback || hasAnyRunningGenerationOperation() },
        ]);
        return actions;
      }
      var baselineActions = [];
      if (hasSkeleton) {
        baselineActions.push({ id: ROOT_ACTIONS.REGENERATE_MODULES, label: '重新生成模块', disabled: isActionBlocked(ROOT_ACTIONS.REGENERATE_MODULES, null) });
      }
      baselineActions = baselineActions.concat([
        { id: ROOT_ACTIONS.TOPUP_MODULES, label: '补全模块', disabled: isActionBlocked(ROOT_ACTIONS.TOPUP_MODULES, null) },
        { id: ROOT_ACTIONS.TOPUP_MODULES_CASES, label: '补全模块+用例', disabled: isActionBlocked(ROOT_ACTIONS.TOPUP_MODULES_CASES, null) },
        { id: ROOT_ACTIONS.APPEND_ALL, label: '追加生成全部模块+用例', disabled: isActionBlocked(ROOT_ACTIONS.APPEND_ALL, null) },
        { id: ROOT_ACTIONS.ROLLBACK, label: '放弃本次生成', disabled: !canRollback || hasAnyRunningGenerationOperation() },
      ]);
      return baselineActions;
    }

    function getModuleActions(moduleEntry) {
      var moduleId = moduleEntry && moduleEntry.aiModuleId ? moduleEntry.aiModuleId : '';
      var latestOperation = getLatestCaseGenOperationSnapshotEntry();
      var canRollback = Boolean(
        latestOperation
        && latestOperation.scope === 'module'
        && String(latestOperation.moduleId || '') === String(moduleId || '')
      );
      var hasVisibleCases = getVisibleCasesForModuleEntry(moduleEntry).length > 0;
      return [
        { id: MODULE_ACTIONS.FULL_CASES, label: getModuleFullCasesLabel(moduleEntry), disabled: isActionBlocked(MODULE_ACTIONS.FULL_CASES, moduleEntry) },
        { id: MODULE_ACTIONS.APPEND, label: '追加生成', disabled: !hasVisibleCases || isActionBlocked(MODULE_ACTIONS.APPEND, moduleEntry) },
        { id: MODULE_ACTIONS.ROLLBACK, label: '放弃本次生成', disabled: !canRollback || hasAnyRunningGenerationOperation() },
      ];
    }

    function buildTreeSignature() {
      try {
        return JSON.stringify({
          requirementLabel: getRequirementLabelText(),
          prep: getPrepState(),
          baseline: hasImportedBaselineCases() && xmindGenApi && typeof xmindGenApi.getCombinedCaseText === 'function'
            ? xmindGenApi.getCombinedCaseText()
            : '',
          modules: buildVisibleModuleSnapshot(buildVisibleModuleContext()),
        });
      } catch (err) {
        return String(Date.now());
      }
    }

    function buildNodeId(parts) {
      return parts.map(function(part) {
        return String(part === undefined || part === null ? '' : part)
          .replace(/[^a-zA-Z0-9_-]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }).filter(Boolean).join('_') || ('node_' + Date.now());
    }

    function hashNodeIdText(value) {
      var text = String(value === undefined || value === null ? '' : value);
      var hash = 2166136261;
      for (var i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(36);
    }

    function buildStableNodeId(parts) {
      var list = Array.isArray(parts) ? parts : [];
      var raw = list.map(function(part) {
        return String(part === undefined || part === null ? '' : part);
      }).join('|');
      var base = buildNodeId(list);
      return base + '_' + hashNodeIdText(raw);
    }

    function getRootNodeId() {
      return buildNodeId(['root', getRequirementLabelText()]);
    }

    function getModuleNodeId(moduleEntry) {
      return buildNodeId(['module', moduleEntry && moduleEntry.moduleKey ? moduleEntry.moduleKey : 'module']);
    }

    function createNode(topic, meta, children, options) {
      var opts = options || {};
      var stableNodeId = meta && meta.nodeId ? String(meta.nodeId) : '';
      var node = {
        id: stableNodeId || buildNodeId([meta && meta.type ? meta.type : 'node', topic]),
        topic: topic || '-',
        expanded: opts.expanded === false ? false : true,
        xmindMeta: meta || {},
      };
      if (Array.isArray(children) && children.length) node.children = children;
      if (meta && meta.branchColor) node.branchColor = String(meta.branchColor);
      return node;
    }

    function withTopupHighlightMeta(meta, topupHighlight) {
      var nextMeta = cloneJson(meta, {}) || {};
      if (!topupHighlight) return nextMeta;
      nextMeta.topupHighlightToken = String(topupHighlight.token || '');
      nextMeta.topupHighlightLabel = String(topupHighlight.label || '本轮追加用例');
      nextMeta.topupHighlightScope = String(topupHighlight.highlightScope || 'cases');
      return nextMeta;
    }

    function resolveNodeExpandedState(meta, collapsedNodeMap, topic, fallbackPath) {
      if (!collapsedNodeMap) return true;
      var key = buildViewStateNodeKey(meta || null, topic, fallbackPath);
      if (!key) return true;
      return collapsedNodeMap[key] !== true;
    }

    function buildModulePendingNode(moduleEntry, options) {
      options = options || {};
      return createNode(String(options.label || '追加生成中'), {
        type: 'topup-placeholder',
        moduleKey: moduleEntry.moduleKey,
        moduleId: moduleEntry.aiModuleId || '',
        nodeId: buildNodeId([
          'topup-placeholder',
          moduleEntry.moduleKey,
          String(options.pendingKey || options.actionId || 'module')
        ]),
        branchColor: '#2563eb',
      }, null, {
        expanded: true,
      });
    }

    function buildRootPendingNode(actionId) {
      var label = actionId === ROOT_ACTIONS.TOPUP_MODULES ? '补全模块中' : '补全模块+用例中';
      return createNode(label, {
        type: 'topup-placeholder',
        moduleKey: 'root',
        moduleId: '',
        nodeId: buildNodeId(['root-topup-placeholder', actionId || 'root']),
        branchColor: '#2563eb',
      }, null, {
        expanded: true,
      });
    }

    function buildCaseTree(moduleEntry, row, caseIndex, topupHighlight, collapsedNodeMap) {
      var xmindCoreApi = getXmindCoreApi();
      var moduleTitle = moduleEntry ? moduleEntry.title : '模块';
      var item = row && row.item ? row.item : row;
      var caseTitle = item && item.title ? String(item.title) : ('用例' + String(caseIndex + 1));
      var caseSource = row && row.source ? String(row.source || '') : 'ai';
      var caseSourceIndex = row && Number.isFinite(Number(row.sourceIndex)) ? Number(row.sourceIndex) : caseIndex;
      var caseSignature = row && row.caseSignature ? String(row.caseSignature || '') : buildCaseSignature(item, moduleTitle);
      var caseNodeParts = [
        moduleEntry && moduleEntry.aiModuleId ? moduleEntry.aiModuleId : '',
        moduleEntry && moduleEntry.moduleKey ? moduleEntry.moduleKey : '',
        caseSource,
        caseSourceIndex,
        caseSignature || caseTitle,
      ];
      var fields = xmindCoreApi && typeof xmindCoreApi.buildCaseFieldsForXmind === 'function'
        ? xmindCoreApi.buildCaseFieldsForXmind(item || {}, moduleTitle)
        : [
            moduleTitle,
            item && item.title ? String(item.title) : '用例',
            item && item.priority ? String(item.priority) : 'P1',
            item && item.preconditions ? String(item.preconditions) : '-',
            item && item.steps ? String(item.steps) : '-',
            item && item.expected ? String(item.expected) : '-',
          ];
      var expectedMeta = withTopupHighlightMeta({
        type: 'expected',
        moduleKey: moduleEntry.moduleKey,
        caseIndex: caseIndex,
        moduleTitle: moduleTitle,
        caseTitle: caseTitle,
        caseSource: caseSource,
        caseSourceIndex: caseSourceIndex,
        caseSignature: caseSignature,
        nodeId: buildStableNodeId(['expected'].concat(caseNodeParts)),
        segment: 'expected'
      }, topupHighlight);
      var stepsMeta = withTopupHighlightMeta({
        type: 'steps',
        moduleKey: moduleEntry.moduleKey,
        caseIndex: caseIndex,
        moduleTitle: moduleTitle,
        caseTitle: caseTitle,
        caseSource: caseSource,
        caseSourceIndex: caseSourceIndex,
        caseSignature: caseSignature,
        nodeId: buildStableNodeId(['steps'].concat(caseNodeParts)),
        segment: 'steps'
      }, topupHighlight);
      var preMeta = withTopupHighlightMeta({
        type: 'preconditions',
        moduleKey: moduleEntry.moduleKey,
        caseIndex: caseIndex,
        moduleTitle: moduleTitle,
        caseTitle: caseTitle,
        caseSource: caseSource,
        caseSourceIndex: caseSourceIndex,
        caseSignature: caseSignature,
        nodeId: buildStableNodeId(['preconditions'].concat(caseNodeParts)),
        segment: 'preconditions'
      }, topupHighlight);
      var priorityMeta = withTopupHighlightMeta({
        type: 'priority',
        moduleKey: moduleEntry.moduleKey,
        caseIndex: caseIndex,
        moduleTitle: moduleTitle,
        caseTitle: caseTitle,
        caseSource: caseSource,
        caseSourceIndex: caseSourceIndex,
        caseSignature: caseSignature,
        nodeId: buildStableNodeId(['priority'].concat(caseNodeParts)),
        segment: 'priority'
      }, topupHighlight);
      var caseMeta = withTopupHighlightMeta({
        type: 'case',
        moduleKey: moduleEntry.moduleKey,
        caseIndex: caseIndex,
        moduleTitle: moduleTitle,
        caseTitle: caseTitle,
        caseSource: caseSource,
        caseSourceIndex: caseSourceIndex,
        caseSignature: caseSignature,
        nodeId: buildStableNodeId(['case'].concat(caseNodeParts)),
      }, topupHighlight);
      var expectedNode = createNode(fields[5] || '-', expectedMeta, null, {
        expanded: resolveNodeExpandedState(expectedMeta, collapsedNodeMap, fields[5] || '-', [
          moduleTitle,
          caseTitle,
          fields[2] || 'P1',
          fields[3] || '-',
          fields[4] || '-',
          fields[5] || '-'
        ]),
      });
      var stepsNode = createNode(fields[4] || '-', stepsMeta, [expectedNode], {
        expanded: resolveNodeExpandedState(stepsMeta, collapsedNodeMap, fields[4] || '-', [
          moduleTitle,
          caseTitle,
          fields[2] || 'P1',
          fields[3] || '-',
          fields[4] || '-'
        ]),
      });
      var preNode = createNode(fields[3] || '-', preMeta, [stepsNode], {
        expanded: resolveNodeExpandedState(preMeta, collapsedNodeMap, fields[3] || '-', [
          moduleTitle,
          caseTitle,
          fields[2] || 'P1',
          fields[3] || '-'
        ]),
      });
      var priorityNode = createNode(fields[2] || 'P1', priorityMeta, [preNode], {
        expanded: resolveNodeExpandedState(priorityMeta, collapsedNodeMap, fields[2] || 'P1', [
          moduleTitle,
          caseTitle,
          fields[2] || 'P1'
        ]),
      });
      return createNode(fields[1] || ('用例' + String(caseIndex + 1)), caseMeta, [priorityNode], {
        expanded: resolveNodeExpandedState(caseMeta, collapsedNodeMap, fields[1] || ('用例' + String(caseIndex + 1)), [
          moduleTitle,
          caseTitle
        ]),
      });
    }

    function buildMindData() {
      clearStaleModuleUiState();
      var xmindState = ensureState();
      var rootState = ensureRootUiState();
      var treeSignature = buildTreeSignature();
      var collapsedNodeMap = getCollapsedNodeKeyMap();
      var visibleContext = buildVisibleModuleContext();
      var children = [];

      visibleContext.list.forEach(function(entry, moduleIndex) {
        var moduleChildren = [];
        var moduleState = entry.aiModuleId ? ensureModuleUiState(entry.aiModuleId) : null;
        var visibleCases = getVisibleCasesForModuleEntry(entry);
          if (visibleCases.length) {
            visibleCases.forEach(function(row, caseIndex) {
              moduleChildren.push(buildCaseTree(
                entry,
                row,
                caseIndex,
                getCaseTopupHighlight(moduleState, caseIndex),
                collapsedNodeMap
              ));
            });
        }
        if (moduleState && moduleState.rootPendingActionId === ROOT_ACTIONS.EXISTING_CASES) {
          moduleChildren.push(buildModulePendingNode(entry, {
            label: '补全用例中',
            actionId: ROOT_ACTIONS.EXISTING_CASES,
          }));
        } else if (moduleState && moduleState.running && moduleState.lastAction === MODULE_ACTIONS.APPEND) {
          moduleChildren.push(buildModulePendingNode(entry, {
            label: '追加生成中',
            actionId: MODULE_ACTIONS.APPEND,
          }));
        }
        children.push(createNode(entry.title, withTopupHighlightMeta({
          type: 'module',
          moduleKey: entry.moduleKey,
          moduleId: entry.aiModuleId || '',
          moduleTitle: entry.title,
          moduleIndex: moduleIndex,
          nodeId: getModuleNodeId(entry),
          hasPendingBranch: Boolean(
            moduleState && (
              (moduleState.running && moduleState.lastAction === MODULE_ACTIONS.APPEND)
              || moduleState.rootPendingActionId === ROOT_ACTIONS.EXISTING_CASES
            )
          ),
          status: moduleState && moduleState.running && moduleState.rootPendingActionId !== ROOT_ACTIONS.EXISTING_CASES
            ? 'running'
            : (moduleState && moduleState.status === 'error' ? 'error' : ''),
          statusText: moduleState && moduleState.error ? moduleState.error : '',
        }, getModuleNodeTopupHighlight(moduleState)), moduleChildren, {
          expanded: resolveNodeExpandedState({
            type: 'module',
            moduleKey: entry.moduleKey,
            moduleTitle: entry.title,
            moduleId: entry.aiModuleId || '',
          }, collapsedNodeMap, entry.title, [entry.title]),
        }));
      });
      if (
        rootState.running
        && (rootState.lastAction === ROOT_ACTIONS.TOPUP_MODULES || rootState.lastAction === ROOT_ACTIONS.TOPUP_MODULES_CASES)
      ) {
        children.push(buildRootPendingNode(rootState.lastAction));
      }

      xmindState.treeSourceSignature = treeSignature;
      return {
        nodeData: createNode(getRequirementLabelText(), {
          type: 'root',
          nodeId: getRootNodeId(),
          status: rootState.running ? 'running' : (rootState.status === 'error' ? 'error' : ''),
          statusLabel: rootState.running && rootState.lastAction === DEDUPE_ACTION_ID ? '去重中' : '',
          statusText: rootState.error || '',
        }, children, {
          expanded: resolveNodeExpandedState({ type: 'root', nodeId: getRootNodeId() }, collapsedNodeMap, getRequirementLabelText(), [getRequirementLabelText()]),
        }),
      };
    }

    function getNodeActions(nodeMeta) {
      var meta = nodeMeta && nodeMeta.meta ? nodeMeta.meta : null;
      if (!meta) return [];
      var deleteAction = buildDeleteAction(nodeMeta);
      if (nodeMeta && Number(nodeMeta.selectionCount) > 1) {
        return hasDeleteTargets(nodeMeta) ? [deleteAction] : [];
      }
      if (meta.type === 'root') return getRootActions();
      if (meta.type === 'module') {
        var context = ensureVisibleModuleContext(buildVisibleModuleContext());
        var contextMap = context.map || {};
        return getModuleActions(contextMap[meta.moduleKey]).concat([deleteAction]);
      }
      if (isDeleteNodeType(meta.type)) {
        return [deleteAction];
      }
      return [];
    }

    function getNodeQuickAction(nodeMeta) {
      var meta = nodeMeta && nodeMeta.meta ? nodeMeta.meta : null;
      if (!meta || meta.type !== 'module') return null;
      var actions = getNodeActions(nodeMeta);
      if (!actions.length) return null;
      var context = ensureVisibleModuleContext(buildVisibleModuleContext());
      var contextMap = context.map || {};
      var entry = contextMap[meta.moduleKey] || null;
      var preferredActionId = entry && Array.isArray(entry.aiCases) && entry.aiCases.length > 0
        ? MODULE_ACTIONS.APPEND
        : MODULE_ACTIONS.FULL_CASES;
      var first = actions.filter(function(item) {
        return item && item.id === preferredActionId;
      })[0] || actions.filter(function(item) {
        return item && item.disabled !== true;
      })[0] || actions[0] || null;
      if (!first) return null;
      return {
        id: first.id,
        label: '+AI',
        disabled: first.disabled === true,
      };
    }

    function findConnectorSvgPaths(parentEl) {
      if (!parentEl || !parentEl.children) return [];
      var paths = [];
      for (var i = 0; i < parentEl.children.length; i += 1) {
        var childEl = parentEl.children[i];
        if (!childEl || !childEl.tagName) continue;
        var tagName = String(childEl.tagName).toLowerCase();
        if (tagName !== 'svg') continue;
        if (!(childEl.classList && (childEl.classList.contains('subLines') || childEl.classList.contains('lines')))) {
          continue;
        }
        var pathList = childEl.querySelectorAll ? childEl.querySelectorAll('path') : [];
        for (var j = 0; j < pathList.length; j += 1) {
          if (pathList[j]) paths.push(pathList[j]);
        }
      }
      return paths;
    }

    function findSiblingWrapperIndex(currentEl, parentEl) {
      if (!currentEl || !parentEl || !parentEl.children) return -1;
      var wrapperIndex = -1;
      var currentIndex = 0;
      for (var i = 0; i < parentEl.children.length; i += 1) {
        var childEl = parentEl.children[i];
        if (!childEl || !childEl.tagName) continue;
        if (String(childEl.tagName).toLowerCase() !== 'me-wrapper') continue;
        if (childEl === currentEl) {
          wrapperIndex = currentIndex;
          break;
        }
        currentIndex += 1;
      }
      return wrapperIndex;
    }

    function isNodeFlowLeft(nodeEl) {
      if (!nodeEl || !nodeEl.closest) return false;
      var branchMainEl = nodeEl.closest('me-main');
      return Boolean(branchMainEl && branchMainEl.classList && branchMainEl.classList.contains('lhs'));
    }

    function scoreConnectorPathForNode(pathEl, nodeEl) {
      if (!pathEl || !nodeEl || !pathEl.getBoundingClientRect || !nodeEl.getBoundingClientRect) return Number.POSITIVE_INFINITY;
      var pathRect = pathEl.getBoundingClientRect();
      var nodeRect = nodeEl.getBoundingClientRect();
      if (!pathRect || !nodeRect) return Number.POSITIVE_INFINITY;
      var isLeftFlow = isNodeFlowLeft(nodeEl);
      var pathTargetX = isLeftFlow ? pathRect.left : pathRect.right;
      var nodeTargetX = isLeftFlow ? nodeRect.right : nodeRect.left;
      var pathCenterY = pathRect.top + (pathRect.height / 2);
      var nodeCenterY = nodeRect.top + (nodeRect.height / 2);
      return Math.abs(pathCenterY - nodeCenterY) + (Math.abs(pathTargetX - nodeTargetX) * 0.35);
    }

    function pickConnectorPathForNode(currentEl, parentEl) {
      var pathList = findConnectorSvgPaths(parentEl);
      if (!pathList.length) return null;
      var topicEl = currentEl && currentEl.querySelector ? currentEl.querySelector('me-tpc') : null;
      if (topicEl && pathList.length > 1) {
        var bestPath = null;
        var bestScore = Number.POSITIVE_INFINITY;
        for (var i = 0; i < pathList.length; i += 1) {
          var score = scoreConnectorPathForNode(pathList[i], topicEl);
          if (score < bestScore) {
            bestScore = score;
            bestPath = pathList[i];
          }
        }
        if (bestPath) return bestPath;
      }
      var wrapperIndex = findSiblingWrapperIndex(currentEl, parentEl);
      if (wrapperIndex >= 0) {
        if (pathList[wrapperIndex]) return pathList[wrapperIndex];
        var reverseIndex = pathList.length - 1 - wrapperIndex;
        if (reverseIndex >= 0 && pathList[reverseIndex]) return pathList[reverseIndex];
      }
      return pathList[pathList.length - 1] || null;
    }

    function markDashedConnectorLink(nodeEl, linkType) {
      function decoratePendingPath(pathEl) {
        if (!pathEl || !pathEl.setAttribute) return false;
        pathEl.classList.add('xmind-casegen-pending-link');
        pathEl.setAttribute('data-xmind-casegen-link', String(linkType || 'topup-pending'));
        pathEl.setAttribute('stroke-dasharray', '6 5');
        pathEl.setAttribute('stroke-linecap', 'round');
        return true;
      }
      var currentEl = nodeEl && nodeEl.closest ? nodeEl.closest('me-wrapper') : null;
      while (currentEl && currentEl !== mindContainer) {
        var parentEl = currentEl.parentElement;
        if (!parentEl || !parentEl.children) break;
        var candidatePath = pickConnectorPathForNode(currentEl, parentEl);
        if (decoratePendingPath(candidatePath)) return true;
        currentEl = parentEl;
      }
      var fallbackHost = getTopupHighlightMapElement(getTopupHighlightViewerElement()) || mindContainer;
      if (fallbackHost && fallbackHost.querySelectorAll) {
        var fallbackPathList = fallbackHost.querySelectorAll('svg.subLines path, svg.lines path');
        if (fallbackPathList && fallbackPathList.length) {
          return decoratePendingPath(fallbackPathList[fallbackPathList.length - 1]);
        }
      }
      return false;
    }

    function scheduleDashedConnectorLink(nodeEl, linkType, retriesLeft) {
      var attempts = Number(retriesLeft);
      if (!Number.isFinite(attempts) || attempts < 0) attempts = 2;
      if (!nodeEl || !nodeEl.parentNode) return;
      if (markDashedConnectorLink(nodeEl, linkType)) return;
      if (attempts <= 0) return;
      setTimeout(function() {
        if (!nodeEl || !nodeEl.parentNode) return;
        scheduleDashedConnectorLink(nodeEl, linkType, attempts - 1);
      }, 60);
    }

    function decorateNodeElement(nodeEl, nodeMeta) {
      if (!nodeEl || !nodeEl.classList) return;
      var statusBadge = nodeEl.querySelector ? nodeEl.querySelector('.xmind-node-status-badge') : null;
      var topupSpinner = nodeEl.querySelector ? nodeEl.querySelector('.xmind-node-topup-spinner') : null;
      if (statusBadge && statusBadge.parentNode) statusBadge.parentNode.removeChild(statusBadge);
      if (topupSpinner && topupSpinner.parentNode) topupSpinner.parentNode.removeChild(topupSpinner);
      nodeEl.classList.remove(
        'xmind-casegen-node-root',
        'xmind-casegen-node-module',
        'xmind-casegen-node-invalid',
        'xmind-casegen-node-invalid-flash',
        'xmind-casegen-node-topup-placeholder',
        'xmind-casegen-node-topup-highlight-case',
        'xmind-casegen-node-status',
        'xmind-casegen-node-has-status',
        'xmind-casegen-node-has-pending-branch',
        'xmind-casegen-node-flow-left',
        'xmind-casegen-node-flow-right'
      );
      if (nodeEl.removeAttribute) {
        nodeEl.removeAttribute('data-xmind-node-id');
        nodeEl.removeAttribute('data-xmind-topup-highlight-token');
        nodeEl.removeAttribute('data-xmind-topup-highlight-label');
        nodeEl.removeAttribute('data-xmind-topup-highlight-scope');
        nodeEl.removeAttribute('data-xmind-select-group');
        nodeEl.removeAttribute('data-xmind-select-preferred');
      }
      var meta = nodeMeta && nodeMeta.meta ? nodeMeta.meta : null;
      if (!meta) return;
      var selectGroupKey = '';
      if (meta.type === 'module') {
        selectGroupKey = 'module::' + String(meta.moduleKey || normalizeModuleKey(meta.moduleTitle || ''));
      } else if (isDeleteNodeType(meta.type)) {
        selectGroupKey = buildDeleteTargetKey(meta);
      }
      if (selectGroupKey && nodeEl.setAttribute) {
        nodeEl.setAttribute('data-xmind-select-group', String(selectGroupKey));
        nodeEl.setAttribute('data-xmind-select-preferred', meta.type === 'module' || meta.type === 'case' ? '1' : '0');
      }
      if (meta.nodeId && nodeEl.setAttribute) {
        nodeEl.setAttribute('data-xmind-node-id', String(meta.nodeId || ''));
      }
      if (meta.type === 'root' || meta.type === 'module') {
        nodeEl.classList.add(meta.type === 'root' ? 'xmind-casegen-node-root' : 'xmind-casegen-node-module');
        if (meta.type === 'module') {
          var branchMainEl = nodeEl.closest ? nodeEl.closest('me-main') : null;
          if (branchMainEl && branchMainEl.classList && branchMainEl.classList.contains('lhs')) {
            nodeEl.classList.add('xmind-casegen-node-flow-left');
          } else {
            nodeEl.classList.add('xmind-casegen-node-flow-right');
          }
          if (meta.hasPendingBranch) {
            nodeEl.classList.add('xmind-casegen-node-has-pending-branch');
          }
        }
        if (meta.status) {
          nodeEl.classList.add('xmind-casegen-node-has-status');
          var badge = document.createElement('span');
          badge.className = 'xmind-node-status-badge ' + (meta.status === 'running' ? 'is-running' : 'is-error');
          if (meta.status === 'running') {
            var spinner = document.createElement('span');
            spinner.className = 'xmind-node-status-spinner';
            badge.appendChild(spinner);
          }
          var textSpan = document.createElement('span');
          textSpan.textContent = meta.statusLabel
            ? String(meta.statusLabel || '')
            : (meta.status === 'running' ? '生成中' : '失败');
          if (meta.status !== 'running' && meta.statusText) badge.title = String(meta.statusText);
          badge.appendChild(textSpan);
          nodeEl.appendChild(badge);
        }
        if (meta.topupHighlightToken) {
          nodeEl.classList.add('xmind-casegen-node-topup-highlight-case');
          nodeEl.setAttribute('data-xmind-topup-highlight-token', String(meta.topupHighlightToken));
          nodeEl.setAttribute('data-xmind-topup-highlight-label', String(meta.topupHighlightLabel || '本轮追加用例'));
          if (meta.type === 'module' && meta.topupHighlightScope) {
            nodeEl.setAttribute('data-xmind-topup-highlight-scope', String(meta.topupHighlightScope || ''));
          }
        }
        if (isInvalidStoreModuleMeta(meta)) {
          nodeEl.classList.add('xmind-casegen-node-invalid', 'xmind-casegen-node-invalid-flash');
        }
        return;
      }
      if (meta.type === 'topup-placeholder') {
        nodeEl.classList.add('xmind-casegen-node-topup-placeholder');
        var spinnerEl = document.createElement('span');
        spinnerEl.className = 'xmind-node-topup-spinner';
        spinnerEl.setAttribute('aria-hidden', 'true');
        nodeEl.appendChild(spinnerEl);
        return;
      }
      if (meta.topupHighlightToken) {
        nodeEl.classList.add('xmind-casegen-node-topup-highlight-case');
        nodeEl.setAttribute('data-xmind-topup-highlight-token', String(meta.topupHighlightToken));
        nodeEl.setAttribute('data-xmind-topup-highlight-label', String(meta.topupHighlightLabel || '本轮追加用例'));
      }
      if (isInvalidStoreCaseMeta(meta)) {
        nodeEl.classList.add('xmind-casegen-node-invalid', 'xmind-casegen-node-invalid-flash');
      }
    }

    function renderEmptyWorkspaceState() {
      cleanupTopupHighlightPresentation();
      restoreInlineControlsToBank();
      if (toolbarEl) {
        toolbarEl.hidden = true;
        toolbarEl.setAttribute('aria-hidden', 'true');
      }
      if (mindContainer) {
        mindContainer.innerHTML = ''
          + '<div class="xmind-casegen-empty">'
          +   '<div class="xmind-casegen-empty-card">'
          +     '<h4 class="xmind-casegen-empty-title">暂无生成页签</h4>'
          +     '<p class="xmind-casegen-empty-desc">先点击上方“新建生成”，再在该页签中完成前置准备并开始生成。</p>'
          +   '</div>'
          + '</div>';
      }
    }

    function render(options) {
      options = options || {};
      if (workspaceShadowDepth > 0) {
        if (options.persist !== false) persistXmindState(false);
        return;
      }
      setDebugState({ phase: 'render-enter', reason: String(options.reason || '') });
      try {
        updateSummary();
      } catch (summaryErr) {
        setDebugState({
          phase: 'render-summary-error',
          error: summaryErr && summaryErr.message ? String(summaryErr.message) : '未知错误'
        });
        if (options.persist !== false) persistXmindState(false);
        return;
      }
      var pendingDrawerRestore = !isDrawerOpen() && shouldRestoreDrawerAfterRefresh();
      if (!mindContainer || !isDrawerOpen()) {
        setDebugState({
          phase: pendingDrawerRestore ? 'render-pending-restore' : 'render-skipped',
          reason: String(options.reason || ''),
          hasContainer: Boolean(mindContainer),
          drawerOpen: isDrawerOpen()
        });
        if (pendingDrawerRestore && !drawerRestoreRetryTimer) {
          scheduleDrawerRestoreRetry(getViewState().fullscreen === true ? 320 : 120);
        }
        if (options.persist !== false) persistXmindState(false);
        return;
      }
      if (!hasActiveWorkspace()) {
        setDebugState({ phase: 'render-empty-workspace' });
        workspaceViewRestoreToken += 1;
        destroyMind();
        renderEmptyWorkspaceState();
        if (options.persist !== false) persistXmindState(false);
        return;
      }
      var searchState = captureMindSearchStateForRender();
      var skipRestorableViewState = options.skipRestorableViewState === true && options.centerRootAfterRender === true;
      var restorableViewState = skipRestorableViewState
        ? null
        : (normalizeWorkspaceRenderViewState(options.restoreViewState)
          || getRestorableViewState(ensureState().treeSourceSignature));
      var restorableDrawerState = getRestorableDrawerState(ensureState().treeSourceSignature);
      var deferInitialRestoreState = restoreDrawerOpenInFlight === true;
      var freshRender = !mindInstance;
      var useStableFreshRootCenter = options.centerRootAfterRender === true && freshRender && !restorableViewState;
      workspaceViewRestoreToken += 1;
      setDebugState({ phase: 'render-start', reason: String(options.reason || '') });
      try {
        currentMindData = buildMindData();
      } catch (buildErr) {
        setDebugState({ phase: 'build-error', error: buildErr && buildErr.message ? String(buildErr.message) : '未知错误' });
        cleanupTopupHighlightPresentation();
        mindContainer.innerHTML = '<p class="hint" style="padding:16px;">XMind 数据构建失败：' + escapeHtml(buildErr && buildErr.message ? buildErr.message : '未知错误') + '</p>';
        if (options.persist !== false) persistXmindState(false);
        return;
      }
      var mindElixirCoreApi = getMindElixirCoreApi();
      if (!isMindElixirReady(mindElixirCoreApi)) {
        setDebugState({ phase: 'waiting-mind-runtime' });
        cleanupTopupHighlightPresentation();
        mindContainer.innerHTML = '<p class="hint" style="padding:16px;">正在加载 MindElixir 依赖...</p>';
        if (!mindApiReadyPromise) {
          mindApiReadyPromise = ensureMindElixirCoreApiReady()
            .then(function(readyApi) {
              mindApiReadyPromise = null;
              if (!isMindElixirReady(readyApi)) {
                throw new Error('MindElixir 依赖未就绪');
              }
              setDebugState({ phase: 'mind-runtime-ready' });
              render({ reason: 'mind-ready', persist: false });
            })
            .catch(function(err) {
              mindApiReadyPromise = null;
              setDebugState({ phase: 'mind-runtime-error', error: err && err.message ? String(err.message) : '未知错误' });
              cleanupTopupHighlightPresentation();
              if (mindContainer) {
                mindContainer.innerHTML = '<p class="hint" style="padding:16px;">MindElixir 依赖加载失败：' + escapeHtml(err && err.message ? err.message : '未知错误') + '</p>';
              }
            });
        }
        return;
      }
      try {
        var initialCenterNodeId = options.centerRootAfterRender === true && skipRestorableViewState
          ? getRootNodeId()
          : '';
        restoreInlineControlsToBank();
        mindInstance = mindElixirCoreApi.renderMindMap(mindContainer, currentMindData, {
          instance: mindInstance,
          allowEdit: false,
          enableCustomBoxSelection: true,
          preserveViewState: Boolean(mindInstance),
          initialViewState: (mindInstance || deferInitialRestoreState) ? null : restorableViewState,
          initialDrawerState: (mindInstance || deferInitialRestoreState) ? null : restorableDrawerState,
          preserveAnchorNodeId: options.anchorNodeId || '',
          initialCenterNodeId: initialCenterNodeId,
          eagerInitialCenter: Boolean(initialCenterNodeId && freshRender),
          disableDeferredInitialCenterRetry: Boolean(initialCenterNodeId),
          onExportXmind: exportCurrentXmind,
          getNodeActions: getNodeActions,
          onNodeAction: handleNodeAction,
          onDeleteSelection: handleDeleteSelection,
          getNodeQuickAction: getNodeQuickAction,
          decorateNodeElement: decorateNodeElement,
          onViewStateChange: function(detail) {
            var reason = detail && detail.reason ? String(detail.reason || '') : '';
            if (
              reason === 'zoom-in'
              || reason === 'zoom-out'
              || reason === 'zoom-fit'
              || reason === 'drawer-fullscreen'
            ) {
              persistViewportActionViewState();
              return;
            }
            scheduleCaptureCurrentViewState(false);
          },
        });
        mountInlineControls();
        if (restoreDrawerOpenInFlight === true) {
          restoreDrawerOpenInFlight = false;
        }
        syncDeleteHistoryButtons();
        bindTopupHighlightPresentation();
        bindLiveViewStateCapture();
        setDebugState({ phase: 'render-success' });
        setTimeout(function() {
          syncTopupHighlightPresentation();
        }, 90);
        if (options.centerRootAfterRender === true) {
          if (useStableFreshRootCenter) {
            centerRootNodeView({
              persist: true,
              retryLimit: 7,
              retryDelayMs: 70,
            });
          } else {
            centerRootNodeView({ persist: true });
          }
        }
        if (options.centerRootAfterRender !== true && restorableViewState && options.restoreViewStateAfterRender !== false) {
          // 刷新恢复与跨 workspace 视口接力都要等首帧布局稳定后再回放，避免同步改画布把页面卡死。
          scheduleWorkspaceViewRestore(restorableViewState, getActiveWorkspaceId());
        }
        restoreMindSearchStateAfterRender(searchState);
      } catch (err) {
        setDebugState({ phase: 'render-error', error: err && err.message ? String(err.message) : '未知错误' });
        cleanupTopupHighlightPresentation();
        mindContainer.innerHTML = '<p class="hint" style="padding:16px;">XMind 画布初始化失败：' + escapeHtml(err && err.message ? err.message : '未知错误') + '</p>';
      }
      if (options.persist !== false) persistXmindState(false);
    }

    function scheduleRender(reason) {
      if (renderTimer) clearTimeout(renderTimer);
      renderTimer = setTimeout(function() {
        renderTimer = 0;
        render({ reason: reason || 'scheduled' });
      }, 60);
    }

    function resolveModuleEntryByMeta(meta) {
      var context = ensureVisibleModuleContext(buildVisibleModuleContext());
      var contextMap = context.map || {};
      return contextMap[meta && meta.moduleKey ? meta.moduleKey : ''] || null;
    }

    function ensurePrepReadyOrOpen() {
      if (isPrepCompleted()) return true;
      notifyStatus('请先完成生成前置准备', 'warn', { forceInline: true });
      openSummaryDialog(getPrepState().step || STEP_REQUIREMENT);
      return false;
    }

    function ensureActionAllowed(actionId, moduleEntry) {
      var actions = moduleEntry ? getModuleActions(moduleEntry) : getRootActions();
      for (var i = 0; i < actions.length; i += 1) {
        if (!actions[i] || actions[i].id !== actionId) continue;
        if (actions[i].disabled === true) {
          var blocker = resolveBlockingOperation(actionId, moduleEntry);
          notifyStatus(buildBlockedActionMessage(actionId, blocker), 'warn', { forceInline: true });
          return false;
        }
        return true;
      }
      notifyStatus('当前节点不支持该动作', 'warn', { forceInline: true });
      return false;
    }

    function clearCaseGenLayerForReplaceAll() {
      state.caseGenModules = [];
      state.caseGenResults = {};
      state.caseSelections = {};
      state.caseGenSuggestions = {};
      state.caseGenModuleStatus = {};
      state.caseGenProgress = {};
      state.caseGenTiming = {};
      ensureState().modules = {};
      ensureState().hasModuleSkeleton = false;
    }

    function commitCaseList(moduleId, list, timingMs, message, selectionMode) {
      if (casesGenApi && typeof casesGenApi.commitModuleCases === 'function') {
        casesGenApi.commitModuleCases(moduleId, {
          rawResult: JSON.stringify(Array.isArray(list) ? list : [], null, 2),
          list: Array.isArray(list) ? list : [],
          hasResult: Array.isArray(list) && list.length > 0,
          timingMs: timingMs,
          statusText: message || '',
          statusType: message ? 'ok' : '',
          selectionMode: selectionMode || '',
        });
      } else {
        state.caseGenResults[moduleId] = JSON.stringify(Array.isArray(list) ? list : [], null, 2);
      }
    }

    function applyRootOutput(actionId, modules, visibleContext, durationMs) {
      visibleContext = ensureVisibleModuleContext(visibleContext);
      var visibleMap = visibleContext.map || {};
      var createdModules = 0;
      var affectedModules = 0;
      var addedCases = 0;
      var detailMap = {};
      var applyDiagnostics = {
        duplicateAgainstExistingCases: 0,
        duplicateWithinAddedCases: 0,
      };
      clearAllTopupHighlights();

      function collectDetail(moduleTitle, caseCount) {
        var title = normalizeModuleTitle(moduleTitle || '');
        var key = normalizeModuleKey(title || '') || ('module-' + String(Object.keys(detailMap).length + 1));
        if (!detailMap[key]) {
          detailMap[key] = {
            module: title || '未命名模块',
            caseCount: 0,
          };
        }
        var nextCount = Number(caseCount);
        if (!Number.isFinite(nextCount) || nextCount < 0) nextCount = 0;
        detailMap[key].caseCount += nextCount;
      }

      if (
        actionId === ROOT_ACTIONS.FULL_CASES
        || actionId === ROOT_ACTIONS.FULL_MODULES
        || actionId === ROOT_ACTIONS.REGENERATE_MODULES
      ) {
        clearCaseGenLayerForReplaceAll();
        (modules || []).forEach(function(item) {
          var record = ensureAiModuleRecord(item.module, item);
          createdModules += 1;
          collectDetail(item.module, 0);
          if (actionId === ROOT_ACTIONS.FULL_CASES) {
            commitCaseList(record.id, item.cases || [], durationMs, '', '');
            if ((item.cases || []).length) {
              affectedModules += 1;
              addedCases += (item.cases || []).length;
              collectDetail(item.module, (item.cases || []).length);
            }
          }
        });
        return {
          changed: createdModules > 0 || addedCases > 0,
          createdModules: createdModules,
          affectedModules: affectedModules,
          addedCases: addedCases,
          details: normalizeHistoryDetails(Object.keys(detailMap).map(function(key) { return detailMap[key]; })),
          diagnostics: applyDiagnostics,
        };
      }

      (modules || []).forEach(function(item) {
        var entryBefore = visibleMap[normalizeModuleKey(item.module)] || null;
        var existedBefore = Boolean(entryBefore && entryBefore.aiModule);
        var record = ensureAiModuleRecord(item.module, item);
        var moduleState = ensureModuleUiState(record.id);
        var existingAiCases = getAiCasesForModule(record.id);
        var visibleCases = entryBefore
          ? getVisibleCasesForModuleEntry(entryBefore).map(function(row) { return normalizeCaseItem(row.item, item.module); }).filter(Boolean)
          : existingAiCases.slice();
        if (!existedBefore) {
          createdModules += 1;
          collectDetail(item.module, 0);
          if (actionId === ROOT_ACTIONS.TOPUP_MODULES) {
            setModuleTopupHighlight(moduleState, item.module, 0, 0, { highlightScope: 'module' });
          }
        }
        if (item.cases && item.cases.length) {
          var merged = mergeCasesWithoutDuplicates(existingAiCases, item.cases, visibleCases);
          applyDiagnostics.duplicateAgainstExistingCases += getDiagnosticsMetric(merged.diagnostics, 'duplicateAgainstExisting');
          applyDiagnostics.duplicateWithinAddedCases += getDiagnosticsMetric(merged.diagnostics, 'duplicateWithinAdded');
          if (merged.appended.length > 0) {
            commitCaseList(record.id, merged.merged, durationMs, '', 'keep-valid');
            affectedModules += 1;
            addedCases += merged.appended.length;
            collectDetail(item.module, merged.appended.length);
            var baselineCount = entryBefore && Array.isArray(entryBefore.baselineCases) ? entryBefore.baselineCases.length : 0;
            if (actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES && !existedBefore) {
              setModuleTopupHighlight(moduleState, item.module, 0, merged.appended.length, { highlightScope: 'subtree' });
            } else {
              setModuleTopupHighlight(moduleState, item.module, baselineCount + existingAiCases.length, merged.appended.length);
            }
          }
        } else if (actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES && !existedBefore) {
          setModuleTopupHighlight(moduleState, item.module, 0, 0, { highlightScope: 'module' });
        }
      });
      return {
        changed: createdModules > 0 || affectedModules > 0,
        createdModules: createdModules,
        affectedModules: affectedModules,
        addedCases: addedCases,
        details: normalizeHistoryDetails(Object.keys(detailMap).map(function(key) { return detailMap[key]; })),
        diagnostics: applyDiagnostics,
      };
    }

    function isManagedTaskTerminal(task) {
      var status = task && task.status ? String(task.status || '') : '';
      return status === 'done' || status === 'error' || status === 'cancelled';
    }

    function isWorkflowReadyForManagedTasks() {
      return Boolean(window.app && window.app.__tapWorkflowReady === true);
    }

    function listManagedXmindTasks() {
      if (!isWorkflowReadyForManagedTasks()) return [];
      var manager = getXmindTaskManager();
      if (!manager || typeof manager.getTasks !== 'function') return [];
      var list = manager.getTasks();
      return Array.isArray(list) ? list : [];
    }

    function getTaskWorkspaceId(task) {
      if (!task || typeof task !== 'object') return '';
      if (task.workspaceId) return String(task.workspaceId || '');
      var restoreContext = task.restoreContext && typeof task.restoreContext === 'object'
        ? task.restoreContext
        : null;
      return restoreContext && restoreContext.workspaceId ? String(restoreContext.workspaceId || '') : '';
    }

    function filterTasksByWorkspace(tasks, workspaceId) {
      var targetId = String(workspaceId || '');
      return (Array.isArray(tasks) ? tasks : []).filter(function(task) {
        if (!targetId) return false;
        return getTaskWorkspaceId(task) === targetId;
      });
    }

    function clearManagedRunningUiState() {
      var rootState = ensureRootUiState();
      rootState.running = false;
      rootState.taskId = '';
      rootState.hideAiLayer = false;
      var dedupeState = ensureDedupeUiState();
      dedupeState.running = false;
      dedupeState.taskId = '';
      dedupeState.status = '';
      var coverageState = ensureCoverageUiState();
      coverageState.running = false;
      coverageState.taskId = '';
      if (coverageState.status === 'running') coverageState.status = '';
      clearRootPendingModules();
      setAllModuleResultsVisibility(true);
      Object.keys(ensureState().modules || {}).forEach(function(key) {
        var moduleState = ensureModuleUiState(key);
        if (!moduleState) return;
        moduleState.running = false;
        moduleState.taskId = '';
        moduleState.rootPendingActionId = '';
        moduleState.hideResults = false;
      });
      syncInterruptButton();
    }

    function applyRootPipelineRunningUiState(runningTasks) {
      var pipeline = getRootPipelineState();
      if ((!pipeline || !pipeline.id) && Array.isArray(runningTasks)) {
        var relatedTask = runningTasks.filter(function(task) {
          return Boolean(task && task.rootPipelineId);
        })[0] || null;
        if (relatedTask) pipeline = ensureRootPipelineStateFromTask(relatedTask);
      }
      if (!pipeline || !pipeline.id) return;
      var relatedTasks = collectRootPipelineRunningTasks(pipeline.id, runningTasks);
      if (!relatedTasks.length) return;
      var dedupeTask = relatedTasks.filter(function(task) {
        return task && task.scope === 'dedupe';
      })[0] || null;
      var rootState = ensureRootUiState();
      rootState.running = true;
      rootState.taskId = dedupeTask
        ? String(dedupeTask.id || '')
        : (relatedTasks[0] && relatedTasks[0].scope === 'root'
        ? String(relatedTasks[0].id || '')
        : String(pipeline.id || ''));
      rootState.lastAction = dedupeTask || pipeline.stage === 'deduping'
        ? DEDUPE_ACTION_ID
        : String(pipeline.actionId || rootState.lastAction || '');
      rootState.snapshotId = String(pipeline.snapshotId || rootState.snapshotId || '');
      rootState.hideAiLayer = !dedupeTask && pipeline.stage === 'discovering' && pipeline.hadAiLayerBeforeAction === true;
      rootState.updatedAt = Date.now();
      if (pipeline.stage === 'discovering' && pipeline.hadAiCasesBeforeAction === true) {
        setAllModuleResultsVisibility(false);
      }
      relatedTasks.forEach(function(task) {
        if (!task || task.scope !== 'module' || !task.moduleId) return;
        if (String(task.rootPipelineActionId || '') === ROOT_ACTIONS.EXISTING_CASES) {
          setModuleRootPendingAction(ensureModuleUiState(task.moduleId), ROOT_ACTIONS.EXISTING_CASES);
        }
      });
    }

    function scheduleManagedTaskReconcile(reason) {
      var nextReason = String(reason || 'task-reconcile-deferred');
      if (pendingManagedTaskReconcileTimer) {
        clearTimeout(pendingManagedTaskReconcileTimer);
        pendingManagedTaskReconcileTimer = 0;
      }
      pendingManagedTaskReconcileTimer = setTimeout(function() {
        pendingManagedTaskReconcileTimer = 0;
        if (workspaceShadowDepth > 0) {
          scheduleManagedTaskReconcile(nextReason);
          return;
        }
        reconcileManagedXmindTasks({
          resume: false,
          render: isDrawerOpen(),
          reason: nextReason,
          persist: true,
        });
      }, 40);
    }

    function isRunningTaskStructuralRenderRequired(task) {
      if (!task || !task.scope) return false;
      var actionId = String(task.actionId || '');
      if (task.scope === 'root') {
        return Boolean(
          task.hadAiCasesBeforeAction === true
          || task.hadAiLayerBeforeAction === true
          || actionId === ROOT_ACTIONS.EXISTING_CASES
          || actionId === ROOT_ACTIONS.TOPUP_MODULES
          || actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES
        );
      }
      if (task.scope === 'module') {
        return Boolean(
          actionId === MODULE_ACTIONS.APPEND
          || task.hadAiCasesBeforeAction === true
          || task.createdModuleBeforeAction === true
          || task.rootPendingActionId
        );
      }
      return false;
    }

    function shouldRenderRunningTasksStructurally(tasks) {
      var list = Array.isArray(tasks) ? tasks : [];
      return list.some(function(task) {
        return isRunningTaskStructuralRenderRequired(task);
      });
    }

    function syncManagedRunningUiState(options) {
      var opts = options || {};
      if (workspaceShadowDepth > 0) {
        scheduleManagedTaskReconcile(opts.reason || 'task-sync-shadow');
        return [];
      }
      var tasks = Array.isArray(opts.tasks) ? opts.tasks : listManagedXmindTasks();
      var scopedTasks = filterTasksByWorkspace(tasks, getActiveWorkspaceId());
      var runningTasks = scopedTasks.filter(function(task) {
        return task && task.status === 'running';
      });
      clearManagedRunningUiState();
      runningTasks.forEach(function(task) {
        if (!task || !task.id) return;
        if (task.scope === 'root') {
          var rootState = ensureRootUiState();
          rootState.running = true;
          rootState.taskId = String(task.id || '');
          rootState.lastAction = String(task.actionId || rootState.lastAction || '');
          rootState.snapshotId = String(task.snapshotId || rootState.snapshotId || '');
          rootState.hideAiLayer = task.hadAiLayerBeforeAction === true;
          rootState.updatedAt = Date.now();
          if (task.hadAiCasesBeforeAction === true) {
            setAllModuleResultsVisibility(false);
          }
          if (String(task.actionId || '') === ROOT_ACTIONS.EXISTING_CASES) {
            markRootPendingModules(buildVisibleModuleContext().list, ROOT_ACTIONS.EXISTING_CASES);
          }
          return;
        }
        if (task.scope === 'dedupe') {
          var dedupeState = ensureDedupeUiState();
          dedupeState.running = true;
          dedupeState.taskId = String(task.id || '');
          dedupeState.status = 'running';
          dedupeState.error = '';
          dedupeState.updatedAt = Date.now();
          var dedupeRootState = ensureRootUiState();
          dedupeRootState.running = true;
          dedupeRootState.taskId = String(task.id || '');
          dedupeRootState.lastAction = DEDUPE_ACTION_ID;
          dedupeRootState.updatedAt = Date.now();
          return;
        }
        if (task.scope === 'coverage') {
          var coverageState = ensureCoverageUiState();
          coverageState.running = true;
          coverageState.taskId = String(task.id || '');
          coverageState.status = 'running';
          coverageState.error = '';
          coverageState.updatedAt = Date.now();
          return;
        }
        if (task.scope === 'module' && task.moduleId) {
          var moduleState = ensureModuleUiState(task.moduleId);
          if (!moduleState) return;
          moduleState.running = true;
          moduleState.taskId = String(task.id || '');
          moduleState.lastAction = String(task.actionId || moduleState.lastAction || '');
          moduleState.snapshotId = String(task.snapshotId || moduleState.snapshotId || '');
          moduleState.hideResults = task.hadAiCasesBeforeAction === true;
          moduleState.updatedAt = Date.now();
        }
      });
      applyRootPipelineRunningUiState(runningTasks);
      syncInterruptButton();
      renderWorkspaceTabs();
      if (opts.persist === true) persistXmindState(true);
      else if (opts.persist === false) {
        // noop
      } else persistXmindState(false);
      if (opts.render === true && isDrawerOpen()) {
        var renderOptions = {
          reason: opts.reason || 'task-sync',
          persist: false,
          anchorNodeId: opts.anchorNodeId || '',
        };
        if (shouldRenderRunningTasksStructurally(runningTasks)) {
          queueStructureMindRender(renderOptions);
        } else {
          queueStatusMindRender(renderOptions);
        }
      }
      return runningTasks;
    }

    function getTaskErrorMessage(task, err) {
      var message = '';
      if (task && task.error) message = String(task.error || '');
      if (!message && err && err.message) message = String(err.message || '');
      if (!message) message = '未知错误';
      return message.replace(/^XMind\s*用例生成失败[:：]\s*/i, '').trim() || '未知错误';
    }

    function buildGenerationCancelledInfo(task) {
      var reasonText = task && task.cancelMeta && task.cancelMeta.reason
        ? String(task.cancelMeta.reason || '')
        : '已手动中断当前 XMind 生成任务';
      return {
        resultKind: 'cancelled',
        reasonText: reasonText,
        diagnostics: [],
        previewText: '',
      };
    }

    function shouldSuppressTaskCancelToast(task) {
      return Boolean(task && task.cancelMeta && String(task.cancelMeta.source || '') === 'toolbar');
    }

    function resolveTaskModuleEntry(task, visibleContext) {
      var context = ensureVisibleModuleContext(visibleContext);
      var contextMap = context.map || {};
      if (task && task.moduleKey && contextMap[task.moduleKey]) return contextMap[task.moduleKey];
      if (task && task.moduleId) {
        var found = null;
        context.list.some(function(entry) {
          if (!entry) return false;
          if (String(entry.aiModuleId || '') !== String(task.moduleId || '')) return false;
          found = entry;
          return true;
        });
        if (found) return found;
      }
      var moduleTitle = normalizeModuleTitle(task && task.moduleTitle ? task.moduleTitle : '');
      if (!moduleTitle) return null;
      var moduleId = task && task.moduleId ? String(task.moduleId || '') : '';
      var moduleRecord = moduleId ? findAiModuleById(moduleId) : null;
      return {
        moduleKey: normalizeModuleKey(moduleTitle),
        title: moduleTitle,
        baselineCases: [],
        aiCases: moduleId ? getAiCasesForModule(moduleId) : [],
        aiModule: moduleRecord,
        aiModuleId: moduleId,
      };
    }

    function buildRootTaskPayload(actionId, taskInput, options) {
      var opts = options || {};
      var taskWorkspaceId = String(opts.workspaceId || getActiveWorkspaceId() || '');
      var restoreContext = buildManagedTaskRestoreContext({
        workspaceId: taskWorkspaceId,
        compact: true,
      });
      return {
        workspaceId: taskWorkspaceId,
        scope: 'root',
        actionId: actionId,
        snapshotId: String(opts.snapshotId || ''),
        contract: cloneJson(opts.contract, {}),
        historyActionLabel: String(opts.historyActionLabel || ''),
        hadAiContentBeforeAction: opts.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: opts.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: opts.hadAiCasesBeforeAction === true,
        prompt: String(taskInput && taskInput.prompt ? taskInput.prompt : ''),
        requestMode: String(taskInput && taskInput.requestMode ? taskInput.requestMode : 'text'),
        requestText: String(taskInput && taskInput.requestText ? taskInput.requestText : ''),
        contentBlocks: cloneJson(taskInput && taskInput.contentBlocks, []),
        degradedToTextOnly: taskInput && taskInput.degradedToTextOnly === true,
        model: cloneJson(taskInput && taskInput.model, null),
        reasoning: String(taskInput && taskInput.reasoning ? taskInput.reasoning : ''),
        temperature: Number(taskInput && taskInput.temperature),
        restoreContext: restoreContext,
        rootPipelineId: String(opts.rootPipelineId || ''),
        rootPipelineActionId: String(opts.rootPipelineActionId || ''),
        pipelineStage: String(opts.pipelineStage || ''),
        historySuppressed: opts.historySuppressed === true,
        notifySuppressed: opts.notifySuppressed === true,
        skipCoverageRetry: opts.skipCoverageRetry === true,
      };
    }

    function buildModuleTaskPayload(moduleEntry, actionId, taskInput, options) {
      var opts = options || {};
      var taskWorkspaceId = String(opts.workspaceId || getActiveWorkspaceId() || '');
      var restoreContext = buildManagedTaskRestoreContext({
        workspaceId: taskWorkspaceId,
        compact: true,
      });
      return {
        workspaceId: taskWorkspaceId,
        scope: 'module',
        actionId: actionId,
        moduleId: String(opts.moduleId || (moduleEntry && moduleEntry.aiModuleId) || ''),
        moduleKey: String(opts.moduleKey || (moduleEntry && moduleEntry.moduleKey) || ''),
        moduleTitle: normalizeModuleTitle(opts.moduleTitle || (moduleEntry && moduleEntry.title) || ''),
        snapshotId: String(opts.snapshotId || ''),
        contract: cloneJson(opts.contract, {}),
        historyActionLabel: String(opts.historyActionLabel || ''),
        createdModuleBeforeAction: opts.createdModuleBeforeAction === true,
        hadAiCasesBeforeAction: opts.hadAiCasesBeforeAction === true,
        prompt: String(taskInput && taskInput.prompt ? taskInput.prompt : ''),
        requestMode: String(taskInput && taskInput.requestMode ? taskInput.requestMode : 'text'),
        requestText: String(taskInput && taskInput.requestText ? taskInput.requestText : ''),
        contentBlocks: cloneJson(taskInput && taskInput.contentBlocks, []),
        degradedToTextOnly: taskInput && taskInput.degradedToTextOnly === true,
        model: cloneJson(taskInput && taskInput.model, null),
        reasoning: String(taskInput && taskInput.reasoning ? taskInput.reasoning : ''),
        temperature: Number(taskInput && taskInput.temperature),
        fallbackCases: normalizeFallbackCaseList(opts.fallbackCases, opts.moduleTitle || (moduleEntry && moduleEntry.title) || ''),
        restoreContext: restoreContext,
        rootPipelineId: String(opts.rootPipelineId || ''),
        rootPipelineActionId: String(opts.rootPipelineActionId || ''),
        rootPipelineNewModule: opts.rootPipelineNewModule === true,
        historySuppressed: opts.historySuppressed === true,
        notifySuppressed: opts.notifySuppressed === true,
      };
    }

    function buildDedupeTaskPayload(taskInput, options) {
      var opts = options || {};
      var taskWorkspaceId = String(opts.workspaceId || getActiveWorkspaceId() || '');
      var dedupeMode = normalizeDedupeMode(taskInput && taskInput.dedupeMode ? taskInput.dedupeMode : opts.dedupeMode);
      return {
        workspaceId: taskWorkspaceId,
        scope: 'dedupe',
        actionId: DEDUPE_ACTION_ID,
        dedupeSource: String(opts.dedupeSource || 'manual-toolbar'),
        dedupeStrength: DEDUPE_STRENGTH,
        dedupeMode: dedupeMode,
        dedupeModules: cloneJson(taskInput && taskInput.modules, []),
        dedupeBeforeCount: Number(taskInput && taskInput.beforeCaseCount || 0),
        dedupeVisibleStartedAt: Number(opts.dedupeVisibleStartedAt || 0) || 0,
        minVisibleUntil: Number(opts.minVisibleUntil || 0) || 0,
        contract: {
          scope: 'xmind_ai_cases',
          mode: 'ai_dedupe_simplify',
          dedupeMode: dedupeMode,
          dedupe_mode: dedupeMode,
          simplify: isDedupeSimplifyMode(dedupeMode),
          strength: DEDUPE_STRENGTH,
          editableScope: 'ai_generated_cases_only',
          dedupeScope: 'all_input_modules_global',
          dedupeOrder: ['within_module', 'cross_module'],
          dedupe_order: ['within_module', 'cross_module'],
          crossModuleDedupe: true,
          moduleReturnPolicy: {
            returnAllInputModules: true,
            preserveModuleIdAndKey: true,
            unchangedModulesMustBeReturned: true,
            partialModulesResponseAllowed: false,
          },
          reviewMethod: 'exhaustive_global_pairwise_scan',
          duplicateDetectionPolicy: {
            compareFields: ['module', 'title', 'preconditions', 'steps', 'expected', 'test_purpose', 'test_point', 'validation_goal'],
            requireFullModuleScan: true,
            requireGlobalCaseScan: true,
            stopAfterFirstDuplicate: false,
            treatSynonymsAsDuplicateCandidates: true,
            preferSameModuleDedupe: false,
            crossModuleDedupe: true,
            duplicateWhenSameTestPurposeAndPoint: true,
          },
        },
        prompt: String(taskInput && taskInput.prompt ? taskInput.prompt : ''),
        requestMode: 'text',
        requestText: String(taskInput && taskInput.requestText ? taskInput.requestText : ''),
        contentBlocks: [],
        degradedToTextOnly: false,
        model: cloneJson(taskInput && taskInput.model, null),
        reasoning: String(taskInput && taskInput.reasoning ? taskInput.reasoning : ''),
        temperature: Number(taskInput && taskInput.temperature),
        restoreContext: buildManagedTaskRestoreContext({
          workspaceId: taskWorkspaceId,
          compact: true,
        }),
        rootPipelineId: String(opts.rootPipelineId || ''),
        rootPipelineActionId: String(opts.rootPipelineActionId || ''),
        historySuppressed: opts.historySuppressed === true,
        notifySuppressed: opts.notifySuppressed === true,
      };
    }

    function buildCoverageTaskPayload(taskInput, options) {
      var opts = options || {};
      var taskWorkspaceId = String(opts.workspaceId || getActiveWorkspaceId() || '');
      return {
        workspaceId: taskWorkspaceId,
        scope: 'coverage',
        actionId: COVERAGE_ACTION_ID,
        coverageSource: String(opts.coverageSource || 'manual-toolbar'),
        coverageSignature: String(taskInput && taskInput.coverageSignature || ''),
        coverageRequest: cloneJson(taskInput && taskInput.coverageRequest, {}),
        segmentCount: Number(taskInput && taskInput.segmentCount || 0),
        caseCount: Number(taskInput && taskInput.caseCount || 0),
        contract: {
          scope: 'xmind_requirement_coverage',
          mode: 'requirement_coverage',
          caseScope: 'current_visible_cases',
          directRequirementCoverageOnly: true,
          preserveRequirementText: true,
        },
        prompt: String(taskInput && taskInput.prompt ? taskInput.prompt : ''),
        requestMode: 'text',
        requestText: String(taskInput && taskInput.requestText ? taskInput.requestText : ''),
        contentBlocks: [],
        degradedToTextOnly: false,
        model: cloneJson(taskInput && taskInput.model, null),
        reasoning: String(taskInput && taskInput.reasoning ? taskInput.reasoning : ''),
        temperature: Number(taskInput && taskInput.temperature),
        restoreContext: buildManagedTaskRestoreContext({
          workspaceId: taskWorkspaceId,
          compact: true,
        }),
        historySuppressed: true,
        notifySuppressed: false,
      };
    }

    function buildManagedTaskRestoreContext(options) {
      var opts = options || {};
      var targetWorkspaceId = String(opts.workspaceId || getActiveWorkspaceId() || '');
      var activeWorkspaceId = String(getActiveWorkspaceId() || '');
      var compact = opts.compact === true;
      var hasOverrideViewState = Boolean(
        opts.viewState
        && typeof opts.viewState === 'object'
      );
      if (targetWorkspaceId && targetWorkspaceId !== activeWorkspaceId) {
        var targetRecord = getWorkspaceRecord(targetWorkspaceId);
        if (targetRecord && targetRecord.snapshot) {
          return buildRestoreContextFromWorkspaceSnapshot(targetRecord.snapshot, targetWorkspaceId, {
            compact: compact,
          });
        }
      }
      var rawTextEl = document.getElementById('rawText');
      var caseTextEl = document.getElementById('caseText');
      var shadowBase = workspaceShadowDepth > 0 && shadowWorkspaceSharedState
        ? normalizeWorkspaceSharedState(shadowWorkspaceSharedState)
        : null;
      var prep = cloneJson(getPrepState(), createDefaultPrepState());
      var overrideViewState = hasOverrideViewState
        ? normalizeStoredViewState(opts.viewState, {
          drawerOpen: opts.viewState.drawerOpen === true,
          fullscreen: opts.viewState.fullscreen === true,
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
            fullscreen: viewState.fullscreen === true || Boolean(drawerEl && drawerEl.classList && drawerEl.classList.contains('xmind-drawer-fullscreen')),
          }),
      };
      if (compact === true) {
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

    function isMeaningfulRestoreResult(raw) {
      var text = raw === null || raw === undefined ? '' : String(raw || '').trim();
      return Boolean(text && !/^\[\s*\]$/.test(text));
    }

    function mergeRestoreResultMap(existingResults, nextResults) {
      var mergedResults = {};
      var currentResults = existingResults && typeof existingResults === 'object' ? existingResults : {};
      var incomingResults = nextResults && typeof nextResults === 'object' ? nextResults : {};
      Object.keys(currentResults).forEach(function(key) {
        mergedResults[key] = currentResults[key];
      });
      Object.keys(incomingResults).forEach(function(key) {
        if (isMeaningfulRestoreResult(incomingResults[key]) || !isMeaningfulRestoreResult(mergedResults[key])) {
          mergedResults[key] = incomingResults[key];
        }
      });
      return mergedResults;
    }

    function normalizeRestoreOperationSnapshots(list) {
      return (Array.isArray(list) ? list : []).map(function(item) {
        if (!item || typeof item !== 'object') return null;
        return {
          id: String(item.id || ''),
          scope: item.scope === 'module' ? 'module' : 'root',
          moduleId: item.moduleId ? String(item.moduleId || '') : '',
          caseGenModules: cloneJson(item.caseGenModules, []),
          caseGenResults: cloneJson(item.caseGenResults, {}),
          caseSelections: cloneJson(item.caseSelections, {}),
          caseGenSuggestions: cloneJson(item.caseGenSuggestions, {}),
          caseGenModuleStatus: cloneJson(item.caseGenModuleStatus, {}),
          caseGenProgress: cloneJson(item.caseGenProgress, {}),
          caseGenTiming: cloneJson(item.caseGenTiming, {}),
          caseGenSource: String(item.caseGenSource || ''),
          createdAt: Number(item.createdAt || 0),
        };
      }).filter(function(item) {
        return Boolean(item && item.id);
      });
    }

    function deriveNextOperationSnapshotId(list, fallback) {
      var nextId = Number(fallback || 0);
      if (!Number.isFinite(nextId) || nextId < 0) nextId = 0;
      (Array.isArray(list) ? list : []).forEach(function(item) {
        if (!item || !item.id) return;
        var match = String(item.id || '').match(/op-snap-(\d+)$/);
        if (!match) return;
        var value = Number(match[1]);
        if (!Number.isFinite(value) || value < 0) return;
        if ((value + 1) > nextId) nextId = value + 1;
      });
      return nextId > 0 ? nextId : 1;
    }

    function buildOperationSnapshotRestoreVersion(list, nextSnapshotId) {
      var normalizedList = normalizeRestoreOperationSnapshots(list);
      var latestCreatedAt = 0;
      normalizedList.forEach(function(item) {
        var createdAt = Number(item && item.createdAt || 0);
        if (!Number.isFinite(createdAt) || createdAt < 0) return;
        if (createdAt > latestCreatedAt) latestCreatedAt = createdAt;
      });
      return {
        list: normalizedList,
        length: normalizedList.length,
        latestCreatedAt: latestCreatedAt,
        nextSnapshotId: deriveNextOperationSnapshotId(normalizedList, nextSnapshotId),
      };
    }

    function shouldPreferRestoreOperationSnapshots(baseVersion, incomingVersion) {
      var base = baseVersion || buildOperationSnapshotRestoreVersion([], 1);
      var incoming = incomingVersion || buildOperationSnapshotRestoreVersion([], 1);
      if (!incoming.length) return false;
      if (!base.length) return true;
      if (incoming.nextSnapshotId > base.nextSnapshotId) return true;
      if (incoming.length > base.length) return true;
      if (incoming.latestCreatedAt > base.latestCreatedAt) return true;
      return false;
    }

    function mergeTaskRestoreContext(baseContext, incomingContext) {
      var base = baseContext && typeof baseContext === 'object' ? cloneJson(baseContext, {}) : {};
      var incoming = incomingContext && typeof incomingContext === 'object' ? cloneJson(incomingContext, {}) : {};

      function pickString(existingValue, nextValue) {
        var nextText = nextValue === null || nextValue === undefined ? '' : String(nextValue || '').trim();
        if (nextText) return nextValue;
        return existingValue;
      }

      base.workspaceId = pickString(base.workspaceId, incoming.workspaceId);
      base.requirementLabel = normalizePersistedRequirementLabel(pickString(base.requirementLabel, incoming.requirementLabel));
      base.requirementLabelSource = pickString(base.requirementLabelSource, incoming.requirementLabelSource);
      base.lastRawImportName = pickString(base.lastRawImportName, incoming.lastRawImportName);
      base.rawText = pickString(base.rawText, incoming.rawText);
      base.caseText = pickString(base.caseText, incoming.caseText);

      if (Array.isArray(incoming.importedCases) && incoming.importedCases.length) {
        base.importedCases = cloneJson(incoming.importedCases, []);
      }

      var baseModules = Array.isArray(base.caseGenModules) ? base.caseGenModules : [];
      var incomingModules = Array.isArray(incoming.caseGenModules) ? incoming.caseGenModules : [];
      if (incomingModules.length >= baseModules.length) {
        base.caseGenModules = cloneJson(incomingModules, []);
      }

      base.caseGenResults = mergeRestoreResultMap(base.caseGenResults, incoming.caseGenResults);
      var baseOperationVersion = buildOperationSnapshotRestoreVersion(base.operationSnapshots, base.nextSnapshotId);
      var incomingOperationVersion = buildOperationSnapshotRestoreVersion(incoming.operationSnapshots, incoming.nextSnapshotId);
      if (shouldPreferRestoreOperationSnapshots(baseOperationVersion, incomingOperationVersion)) {
        base.operationSnapshots = cloneJson(incomingOperationVersion.list, []);
        base.nextSnapshotId = incomingOperationVersion.nextSnapshotId;
      } else {
        base.operationSnapshots = cloneJson(baseOperationVersion.list, []);
        base.nextSnapshotId = Math.max(
          baseOperationVersion.nextSnapshotId,
          incomingOperationVersion.nextSnapshotId
        );
      }

      var baseHistory = Array.isArray(base.history) ? base.history : [];
      var incomingHistory = Array.isArray(incoming.history) ? incoming.history : [];
      if (incomingHistory.length >= baseHistory.length) {
        base.history = cloneJson(incomingHistory, []);
      }
      base.rootPipeline = mergeRootPipelineSnapshot(base.rootPipeline, incoming.rootPipeline);

      var basePrep = base.prep && typeof base.prep === 'object' ? base.prep : createDefaultPrepState();
      var incomingPrep = incoming.prep && typeof incoming.prep === 'object' ? incoming.prep : {};
      basePrep.step = Math.max(Number(basePrep.step || STEP_REQUIREMENT), Number(incomingPrep.step || STEP_REQUIREMENT));
      if (incomingPrep.requirementMode) basePrep.requirementMode = String(incomingPrep.requirementMode || '');
      if (incomingPrep.requirementSupplement) basePrep.requirementSupplement = String(incomingPrep.requirementSupplement || '');
      if (incomingPrep.manualRequirementLabel) basePrep.manualRequirementLabel = String(incomingPrep.manualRequirementLabel || '');
      if (Array.isArray(incomingPrep.manualRequirementBlocks) && incomingPrep.manualRequirementBlocks.length) {
        basePrep.manualRequirementBlocks = cloneJson(incomingPrep.manualRequirementBlocks, []);
      }
      if (incomingPrep.caseImportMode) basePrep.caseImportMode = String(incomingPrep.caseImportMode || '');
      basePrep.baseLocked = basePrep.baseLocked === true || incomingPrep.baseLocked === true;
      basePrep.completed = basePrep.completed === true || incomingPrep.completed === true;
      base.prep = basePrep;

      base.viewState = mergeStoredViewState(base.viewState, incoming.viewState);

      return base;
    }

    function syncRunningTaskRestoreContexts(workspaceId, options) {
      var manager = getXmindTaskManager();
      if (!manager || typeof manager.updateTasksContext !== 'function') return 0;
      var opts = options || {};
      var targetWorkspaceId = String(workspaceId || getActiveWorkspaceId() || '');
      if (!targetWorkspaceId) return 0;
      var taskIds = filterTasksByWorkspace(listManagedXmindTasks(), targetWorkspaceId).filter(function(task) {
        return task && task.status === 'running' && task.id;
      }).map(function(task) {
        return String(task.id || '');
      }).filter(Boolean);
      if (!taskIds.length) return 0;
      var restoreContext = buildManagedTaskRestoreContext({
        workspaceId: targetWorkspaceId,
        viewState: opts.viewState && typeof opts.viewState === 'object' ? opts.viewState : null,
        compact: false,
      });
      return Number(manager.updateTasksContext(function(nextContext) {
        var merged = mergeTaskRestoreContext(nextContext, restoreContext);
        if (opts.replaceViewState === true && restoreContext.viewState) {
          merged.viewState = cloneJson(restoreContext.viewState, createDefaultViewState());
        }
        Object.keys(nextContext || {}).forEach(function(key) {
          delete nextContext[key];
        });
        Object.keys(merged).forEach(function(key) {
          nextContext[key] = cloneJson(merged[key], merged[key]);
        });
      }, {
        taskIds: taskIds,
        onlyRunning: true,
        action: 'context',
      }) || 0);
    }

    function syncManagedTaskRestoreContexts(taskIds, options) {
      var manager = getXmindTaskManager();
      if (!manager || typeof manager.updateTasksContext !== 'function') return 0;
      var ids = Array.isArray(taskIds) ? taskIds.map(function(item) {
        return String(item || '');
      }).filter(Boolean) : [];
      if (!ids.length) return 0;
      var opts = options || {};
      var restoreContext = buildManagedTaskRestoreContext({
        workspaceId: opts.workspaceId ? opts.workspaceId : '',
        compact: opts.compact === true,
      });
      return Number(manager.updateTasksContext(function(nextContext) {
        var merged = mergeTaskRestoreContext(nextContext, restoreContext);
        Object.keys(nextContext || {}).forEach(function(key) {
          delete nextContext[key];
        });
        Object.keys(merged).forEach(function(key) {
          nextContext[key] = cloneJson(merged[key], merged[key]);
        });
      }, {
        taskIds: ids,
        onlyRunning: opts.onlyRunning === true,
        action: opts.action || 'context',
      }) || 0);
    }

    function syncTerminalTaskRestoreContext(task) {
      var taskId = task && task.id ? String(task.id || '') : '';
      if (!taskId) return 0;
      return syncManagedTaskRestoreContexts([taskId], {
        onlyRunning: false,
        action: 'context',
        workspaceId: getTaskWorkspaceId(task),
        compact: false,
      });
    }

    function pickLatestManagedTaskRestoreContext(tasks) {
      var latest = null;
      (Array.isArray(tasks) ? tasks : []).forEach(function(task) {
        var restoreContext = task && task.restoreContext && typeof task.restoreContext === 'object'
          ? task.restoreContext
          : null;
        if (!restoreContext) return;
        if (!latest) {
          latest = task;
          return;
        }
        var prevTime = Number(latest.updatedAt || latest.endedAt || latest.createdAt || 0);
        var nextTime = Number(task.updatedAt || task.endedAt || task.createdAt || 0);
        if (nextTime >= prevTime) latest = task;
      });
      return latest;
    }

    function buildMergedManagedTaskRestoreContext(tasks) {
      var merged = null;
      (Array.isArray(tasks) ? tasks : []).forEach(function(task) {
        var restoreContext = task && task.restoreContext && typeof task.restoreContext === 'object'
          ? task.restoreContext
          : null;
        if (!restoreContext) return;
        merged = mergeTaskRestoreContext(merged, restoreContext);
      });
      return merged;
    }

    function markRestoreContextRootPipelineRestoredAfterRefresh(restoreContext) {
      if (!restoreContext || !restoreContext.rootPipeline) return restoreContext;
      var pipeline = cloneRootPipelineSnapshot(restoreContext.rootPipeline);
      if (pipeline && pipeline.id) {
        pipeline.restoredAfterRefresh = true;
        restoreContext.rootPipeline = pipeline;
      }
      return restoreContext;
    }

    function markRunningTaskRestoreContextsRestoredAfterRefresh() {
      var manager = getXmindTaskManager();
      if (!manager || typeof manager.updateTasksContext !== 'function') return 0;
      return Number(manager.updateTasksContext(function(nextContext) {
        markRestoreContextRootPipelineRestoredAfterRefresh(nextContext);
      }, {
        onlyRunning: true,
        action: 'context',
      }) || 0);
    }

    function buildRestoreContextFromWorkspaceSnapshot(snapshot, workspaceId, options) {
      var opts = options || {};
      var compact = opts.compact === true;
      var normalized = normalizeWorkspaceSnapshot(snapshot);
      var xmindSnapshot = normalized.xmind || createInitialXmindState();
      var sharedSnapshot = normalized.shared || createEmptyWorkspaceSharedState();
      var result = {
        workspaceId: String(workspaceId || ''),
        requirementLabel: sharedSnapshot.requirementLabel || '',
        requirementLabelSource: sharedSnapshot.requirementLabelSource || '',
        lastRawImportName: sharedSnapshot.lastRawImportName || '',
        rawText: sharedSnapshot.rawText || '',
        caseGenModules: compact
          ? cloneModulesWithoutCases(sharedSnapshot.caseGenModules)
          : cloneJson(sharedSnapshot.caseGenModules, []),
        rootPipeline: compact
          ? buildCompactRootPipelineRestoreSnapshot(xmindSnapshot.root && xmindSnapshot.root.pipeline ? xmindSnapshot.root.pipeline : null)
          : cloneRootPipelineSnapshot(xmindSnapshot.root && xmindSnapshot.root.pipeline ? xmindSnapshot.root.pipeline : null),
        prep: cloneJson(xmindSnapshot.prep, createDefaultPrepState()),
        viewState: cloneJson(normalizeStoredViewState(xmindSnapshot.viewState), createDefaultViewState()),
      };
      if (compact !== true) {
        result.caseText = sharedSnapshot.caseText || '';
        result.importedCases = cloneJson(sharedSnapshot.importedCases, []);
        result.caseGenResults = cloneJson(sharedSnapshot.caseGenResults, {});
        result.operationSnapshots = cloneJson(xmindSnapshot.operationSnapshots, []);
        result.nextSnapshotId = Number(xmindSnapshot.nextSnapshotId || 1);
        result.history = cloneJson(xmindSnapshot.history, []);
      }
      return result;
    }

    function ensureWorkspaceRecordForTask(workspaceId) {
      var stableId = String(workspaceId || '');
      if (!stableId) return null;
      var host = ensureWorkspaceHostState();
      if (!host.workspaces[stableId]) {
        var seq = Number(host.nextWorkspaceSeq || 1);
        host.nextWorkspaceSeq = seq + 1;
        host.workspaces[stableId] = createWorkspaceRecord(stableId, {
          seq: seq,
          name: buildDefaultWorkspaceRecordName(seq),
          snapshot: createWorkspaceSnapshot(),
        });
        if (host.workspaceOrder.indexOf(stableId) === -1) {
          host.workspaceOrder.push(stableId);
        }
      }
      return host.workspaces[stableId];
    }

    function applyRestoreContextToWorkspaceRecord(workspaceId, restoreContext) {
      var stableId = String(workspaceId || '');
      if (!stableId || !restoreContext) return false;
      var record = ensureWorkspaceRecordForTask(stableId);
      if (!record) return false;
      var baseContext = buildRestoreContextFromWorkspaceSnapshot(record.snapshot, stableId);
      var merged = mergeTaskRestoreContext(baseContext, restoreContext);
      record.snapshot = {
        xmind: (function() {
          var xmindSnapshot = normalizeWorkspaceSnapshot(record.snapshot).xmind;
          xmindSnapshot.history = cloneJson(merged.history, []);
          xmindSnapshot.operationSnapshots = cloneJson(merged.operationSnapshots, []);
          xmindSnapshot.nextSnapshotId = Number(merged.nextSnapshotId || xmindSnapshot.nextSnapshotId || 1);
          xmindSnapshot.prep = cloneJson(merged.prep, createDefaultPrepState());
          xmindSnapshot.viewState = mergeStoredViewState(
            xmindSnapshot.viewState,
            merged.viewState
          );
          xmindSnapshot.root = xmindSnapshot.root && typeof xmindSnapshot.root === 'object'
            ? xmindSnapshot.root
            : createDefaultRootState();
          xmindSnapshot.root.pipeline = cloneRootPipelineSnapshot(merged.rootPipeline);
          return xmindSnapshot;
        })(),
        shared: normalizeWorkspaceSharedState({
          requirementLabel: merged.requirementLabel,
          requirementLabelSource: merged.requirementLabelSource,
          lastRawImportName: merged.lastRawImportName,
          rawText: merged.rawText,
          caseText: merged.caseText,
          importedCases: merged.importedCases,
          caseGenModules: merged.caseGenModules,
          caseGenResults: merged.caseGenResults,
          caseSelections: {},
          caseGenSuggestions: record.snapshot && record.snapshot.shared ? record.snapshot.shared.caseGenSuggestions : {},
          caseGenModuleStatus: record.snapshot && record.snapshot.shared ? record.snapshot.shared.caseGenModuleStatus : {},
          caseGenProgress: record.snapshot && record.snapshot.shared ? record.snapshot.shared.caseGenProgress : {},
          caseGenTiming: record.snapshot && record.snapshot.shared ? record.snapshot.shared.caseGenTiming : {},
          caseGenProgressNotice: record.snapshot && record.snapshot.shared ? record.snapshot.shared.caseGenProgressNotice : {},
          caseGenSettings: record.snapshot && record.snapshot.shared ? record.snapshot.shared.caseGenSettings : createDefaultCaseGenSettings(),
          requirementMedia: record.snapshot && record.snapshot.shared ? record.snapshot.shared.requirementMedia : createEmptyRequirementMedia(),
        }),
      };
      record.updatedAt = Date.now();
      return true;
    }

    function restoreWorkflowContextFromManagedTasks(tasks, options) {
      var opts = options || {};
      var currentWorkspaceId = getActiveWorkspaceId();
      var shouldApplyLiveRestore = shouldXmindOwnLiveWorkspaceState();
      var scopedTasks = filterTasksByWorkspace(tasks, currentWorkspaceId);
      var otherWorkspaceTasks = (Array.isArray(tasks) ? tasks : []).filter(function(task) {
        var workspaceId = getTaskWorkspaceId(task);
        return Boolean(workspaceId && workspaceId !== currentWorkspaceId);
      });
      var grouped = {};
      otherWorkspaceTasks.forEach(function(task) {
        var workspaceId = getTaskWorkspaceId(task);
        if (!workspaceId) return;
        if (!grouped[workspaceId]) grouped[workspaceId] = [];
        grouped[workspaceId].push(task);
      });
      Object.keys(grouped).forEach(function(workspaceId) {
        var merged = buildMergedManagedTaskRestoreContext(grouped[workspaceId]);
        if (opts.markRestoredAfterRefresh === true) {
          markRestoreContextRootPipelineRestoredAfterRefresh(merged);
        }
        if (merged) applyRestoreContextToWorkspaceRecord(workspaceId, merged);
      });
      var restoreContext = buildMergedManagedTaskRestoreContext(scopedTasks);
      var latestTask = pickLatestManagedTaskRestoreContext(scopedTasks);
      if (opts.markRestoredAfterRefresh === true) {
        markRestoreContextRootPipelineRestoredAfterRefresh(restoreContext);
      }
      if (!restoreContext) return false;
      var currentRecordChanged = applyRestoreContextToWorkspaceRecord(currentWorkspaceId, restoreContext);
      if (!shouldApplyLiveRestore) {
        if (currentRecordChanged) {
          renderWorkspaceTabs();
          updateSummary();
          renderCaseGenProgressBoard();
          scheduleRecoveredStatePersist();
        }
        return currentRecordChanged;
      }
      var changed = false;
      var rawTextEl = document.getElementById('rawText');
      var fileNameEl = document.getElementById('fileName');
      var caseTextEl = document.getElementById('caseText');
      var casesCoreApi = getCasesCoreApi();
      var currentLabel = state.requirementLabel ? String(state.requirementLabel).trim() : '';
      var currentLabelSource = state.requirementLabelSource ? String(state.requirementLabelSource).trim() : '';
      var restoreLabel = restoreContext.requirementLabel ? String(restoreContext.requirementLabel || '').trim() : '';
      var restoreLabelSource = restoreContext.requirementLabelSource ? String(restoreContext.requirementLabelSource || '').trim() : '';
      if (!restoreLabel) {
        restoreLabel = normalizeRequirementLabelFromFileName(restoreContext.lastRawImportName || '');
      }
      if (restoreLabelSource !== 'manual' && (!currentLabel || currentLabel === '当前需求' || currentLabelSource === 'default') && restoreLabel) {
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
      if ((!Array.isArray(state.importedCases) || !state.importedCases.length) && Array.isArray(restoreContext.importedCases) && restoreContext.importedCases.length) {
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
      var currentHistory = Array.isArray(ensureState().history) ? ensureState().history : [];
      if (
        Array.isArray(restoreContext.history)
        && restoreContext.history.length
        && restoreContext.history.length > currentHistory.length
      ) {
        ensureState().history = cloneJson(restoreContext.history, []);
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
      if (opts.markRestoredAfterRefresh === true && mergedPipeline && mergedPipeline.id) {
        mergedPipeline.restoredAfterRefresh = true;
      }
      if (JSON.stringify(mergedPipeline || null) !== JSON.stringify(currentPipeline || null)) {
        setRootPipelineState(mergedPipeline);
        changed = true;
      }
      if (prepSnapshot) {
        if (!prep.requirementMode && prepSnapshot.requirementMode) {
          prep.requirementMode = String(prepSnapshot.requirementMode || '');
          changed = true;
        }
        if (!prep.requirementSupplement && prepSnapshot.requirementSupplement) {
          prep.requirementSupplement = String(prepSnapshot.requirementSupplement || '');
          changed = true;
        }
        if (!prep.manualRequirementLabel && prepSnapshot.manualRequirementLabel) {
          prep.manualRequirementLabel = String(prepSnapshot.manualRequirementLabel || '');
          changed = true;
        }
        if ((!Array.isArray(prep.manualRequirementBlocks) || !prep.manualRequirementBlocks.length) && Array.isArray(prepSnapshot.manualRequirementBlocks) && prepSnapshot.manualRequirementBlocks.length) {
          prep.manualRequirementBlocks = cloneJson(prepSnapshot.manualRequirementBlocks, []);
          changed = true;
        }
        if (!prep.caseImportMode && prepSnapshot.caseImportMode) {
          prep.caseImportMode = String(prepSnapshot.caseImportMode || '');
          changed = true;
        }
        if (prep.baseLocked !== true && prepSnapshot.baseLocked === true) {
          prep.baseLocked = true;
          changed = true;
        }
        if (prep.completed !== true && prepSnapshot.completed === true) {
          prep.completed = true;
          changed = true;
        }
        var currentStep = Number(prep.step || STEP_REQUIREMENT);
        var snapshotStep = Number(prepSnapshot.step || STEP_REQUIREMENT);
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
      if (changed) {
        ensureState().hasModuleSkeleton = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      }
      if (changed && casesCoreApi && typeof casesCoreApi.renderImportedCaseList === 'function') {
        casesCoreApi.renderImportedCaseList();
      }
      if (changed && casesCoreApi && typeof casesCoreApi.syncCaseTextWithImports === 'function') {
        casesCoreApi.syncCaseTextWithImports();
      }
      if (changed || currentRecordChanged) {
        scheduleRecoveredStatePersist();
      }
      return changed || currentRecordChanged;
    }

    function startManagedXmindTask(taskPayload) {
      var manager = getXmindTaskManager();
      if (!manager || typeof manager.createTask !== 'function' || typeof manager.startTask !== 'function') {
        throw new Error('XMind 后台任务能力未就绪，请刷新后重试');
      }
      var task = manager.createTask(taskPayload);
      manager.startTask(task, { force: true });
      return task;
    }

    function getManagedTaskAnchorNodeId(task, moduleEntry) {
      if (task && task.rootPipelineId) {
        return getRootNodeId();
      }
      if (task && task.scope === 'module') {
        if (moduleEntry) return getModuleNodeId(moduleEntry);
        return buildNodeId(['module', task && task.moduleKey ? task.moduleKey : 'module']);
      }
      return getRootNodeId();
    }

    function cloneModulesWithoutCases(modules) {
      return (Array.isArray(modules) ? modules : []).map(function(item) {
        return {
          module: normalizeModuleTitle(item && item.module ? item.module : ''),
          key_scenarios: normalizeArrayField(item && item.key_scenarios),
          test_points: normalizeArrayField(item && item.test_points),
          coupled_modules: normalizeArrayField(item && item.coupled_modules),
          cases: [],
        };
      }).filter(function(item) {
        return Boolean(item && item.module);
      });
    }

    function setDedupeRunningState(task, source) {
      var dedupeState = ensureDedupeUiState();
      dedupeState.running = true;
      dedupeState.taskId = String(task && task.id ? task.id : '');
      dedupeState.status = 'running';
      dedupeState.error = '';
      dedupeState.dedupeMode = normalizeDedupeMode(task && task.dedupeMode);
      dedupeState.updatedAt = Date.now();
      var rootState = ensureRootUiState();
      rootState.running = true;
      rootState.taskId = dedupeState.taskId;
      rootState.lastAction = DEDUPE_ACTION_ID;
      rootState.status = '';
      rootState.error = source === 'auto-full' ? '去重中' : '';
      rootState.updatedAt = dedupeState.updatedAt;
      syncInterruptButton();
    }

    function clearDedupeRunningState(errorText) {
      var dedupeState = ensureDedupeUiState();
      dedupeState.running = false;
      dedupeState.taskId = '';
      dedupeState.status = errorText ? 'error' : '';
      dedupeState.error = errorText ? String(errorText || '') : '';
      dedupeState.dedupeMode = DEDUPE_MODE_ONLY;
      dedupeState.updatedAt = Date.now();
      var rootState = ensureRootUiState();
      if (rootState.lastAction === DEDUPE_ACTION_ID) {
        rootState.running = false;
        rootState.taskId = '';
        if (
          !errorText
          && dedupeState.terminalVisualRunning === true
          && Number(dedupeState.terminalVisualUntil || 0) > Date.now()
        ) {
          rootState.status = '';
          rootState.error = '去重中';
        } else {
          rootState.status = errorText ? 'error' : '';
          rootState.error = errorText ? String(errorText || '') : '';
        }
        rootState.updatedAt = Date.now();
      }
      syncInterruptButton();
    }

    function scheduleDedupeTerminalVisualState(task) {
      var dedupeState = ensureDedupeUiState();
      var until = Date.now() + DEDUPE_TERMINAL_VISUAL_MS;
      dedupeState.terminalVisualRunning = true;
      dedupeState.terminalVisualUntil = until;
      dedupeState.dedupeMode = normalizeDedupeMode(task && task.dedupeMode);
      dedupeState.updatedAt = Date.now();
      if (dedupeTerminalVisualTimer) {
        clearTimeout(dedupeTerminalVisualTimer);
        dedupeTerminalVisualTimer = 0;
      }
      dedupeTerminalVisualTimer = setTimeout(function() {
        dedupeTerminalVisualTimer = 0;
        var stateNow = ensureDedupeUiState();
        if (Number(stateNow.terminalVisualUntil || 0) > Date.now()) {
          scheduleDedupeTerminalVisualState({ dedupeMode: stateNow.dedupeMode });
          return;
        }
        stateNow.terminalVisualRunning = false;
        stateNow.terminalVisualUntil = 0;
        stateNow.updatedAt = Date.now();
        syncInterruptButton();
        if (isDrawerOpen()) {
          queueStatusMindRender({
            reason: 'dedupe-terminal-visual-ended',
            persist: false,
            anchorNodeId: getRootNodeId(),
          });
        }
        persistXmindState(false);
      }, DEDUPE_TERMINAL_VISUAL_MS + 20);
      syncInlineToolbarOverview();
    }

    function waitForDedupeMinVisibleDuration(task) {
      var startedAt = Number(task && task.dedupeVisibleStartedAt || 0);
      var delayMs = DEDUPE_TERMINAL_GRACE_MS;
      if (Number.isFinite(startedAt) && startedAt > 0) {
        var elapsed = Date.now() - startedAt;
        delayMs = Math.max(DEDUPE_TERMINAL_GRACE_MS, DEDUPE_MIN_VISIBLE_MS - elapsed);
      }
      if (!Number.isFinite(delayMs) || delayMs <= 0) return Promise.resolve();
      return new Promise(function(resolve) {
        setTimeout(resolve, delayMs);
      });
    }

    function showTerminalDedupeRunningState(task) {
      if (!task || task.scope !== 'dedupe') return;
      setDedupeRunningState(task, task.dedupeSource || '');
      if (task.rootPipelineId) {
        updateRootPipelineState(function(current) {
          current.stage = 'deduping';
          current.dedupeStatus = 'running';
          current.dedupeTaskId = String(task.id || '');
          current.dedupeMode = normalizeDedupeMode(task.dedupeMode);
          current.dedupeBeforeCount = Number(task.dedupeBeforeCount || current.dedupeBeforeCount || 0) || 0;
        });
      }
      if (isDrawerOpen()) {
        queueStatusMindRender({
          reason: 'dedupe-terminal-visible-grace',
          persist: false,
          anchorNodeId: getRootNodeId(),
        });
      }
    }

    function setCoverageRunningState(task) {
      var coverageState = ensureCoverageUiState();
      coverageState.running = true;
      coverageState.taskId = String(task && task.id ? task.id : '');
      coverageState.status = 'running';
      coverageState.error = '';
      coverageState.updatedAt = Date.now();
      syncInterruptButton();
    }

    function clearCoverageRunningState(status, errorText) {
      var coverageState = ensureCoverageUiState();
      coverageState.running = false;
      coverageState.taskId = '';
      coverageState.status = status ? String(status || '') : '';
      coverageState.error = errorText ? String(errorText || '') : '';
      coverageState.updatedAt = Date.now();
      syncInterruptButton();
    }

    function startRequirementCoverageTask(options) {
      var opts = options || {};
      if (hasAnyRunningGenerationOperation()) {
        notifyStatus('当前有 XMind 任务进行中，请等待完成后再分析覆盖', 'warn', { forceInline: true });
        return null;
      }
      var request = opts.request || buildCoverageSourceRequest();
      var taskInput = buildXmindCoverageTaskInput(request);
      var task = startManagedXmindTask(buildCoverageTaskPayload(taskInput, {
        workspaceId: getActiveWorkspaceId(),
        coverageSource: 'manual-toolbar',
      }));
      var coverageState = ensureCoverageUiState();
      coverageState.selectedSegmentId = '';
      coverageState.error = '';
      setCoverageRunningState(task);
      if (summaryDialogOpen === true && summaryDialogMode === 'coverage') {
        renderCoverageDialog();
      }
      notifyStatus('需求覆盖分析中', 'warn', { forceInline: true });
      persistManagedTaskWorkspaceState(true);
      return task;
    }

    function startAiDedupeTask(options) {
      var opts = options || {};
      var source = opts.source || 'manual-toolbar';
      var modules = Array.isArray(opts.modules) ? opts.modules : collectCurrentAiDedupeModules();
      if (!modules.length) {
        if (source !== 'auto-full') notifyStatus('当前页签没有可去重的 AI 生成用例', 'warn', { forceInline: true });
        return null;
      }
      var taskWorkspaceId = String(opts.workspaceId || getActiveWorkspaceId() || '');
      var dedupeMode = normalizeDedupeMode(opts.dedupeMode || getDedupeModeFromSettings());
      var taskInput = buildXmindDedupeTaskInput(modules, { source: source, dedupeMode: dedupeMode });
      var dedupeVisibleStartedAt = Date.now();
      var task = startManagedXmindTask(buildDedupeTaskPayload(taskInput, {
        workspaceId: taskWorkspaceId,
        dedupeSource: source,
        dedupeMode: dedupeMode,
        dedupeVisibleStartedAt: dedupeVisibleStartedAt,
        minVisibleUntil: dedupeVisibleStartedAt + DEDUPE_TERMINAL_VISUAL_MS,
        rootPipelineId: opts.rootPipelineId || '',
        rootPipelineActionId: opts.rootPipelineActionId || '',
        historySuppressed: source === 'auto-full',
        notifySuppressed: source === 'auto-full',
      }));
      setDedupeRunningState(task, source);
      if (opts.rootPipelineId) {
        updateRootPipelineState(function(current) {
          current.stage = 'deduping';
          current.dedupeStatus = 'running';
          current.dedupeTaskId = String(task && task.id ? task.id : '');
          current.dedupeMode = dedupeMode;
          current.dedupeBeforeCount = Number(taskInput.beforeCaseCount || 0);
        });
      }
      if (isDrawerOpen()) {
        queueStatusMindRender({
          reason: source === 'auto-full' ? 'root-pipeline-dedupe-running' : 'manual-dedupe-running',
          persist: false,
          anchorNodeId: getRootNodeId(),
        });
      }
      persistManagedTaskWorkspaceState(true);
      return task;
    }

    async function startManualAiDedupe() {
      if (hasAnyRunningGenerationOperation()) {
        notifyStatus('当前有 XMind 任务进行中，请等待完成后再去重', 'warn', { forceInline: true });
        return false;
      }
      var modules = collectCurrentAiDedupeModules();
      if (!modules.length) {
        notifyStatus('当前页签没有可去重的 AI 生成用例', 'warn', { forceInline: true });
        return false;
      }
      var caseCount = 0;
      modules.forEach(function(item) {
        caseCount += Array.isArray(item && item.cases) ? item.cases.length : 0;
      });
      var dedupeMode = getDedupeModeFromSettings();
      var modeText = getDedupeModeActionText(dedupeMode);
      var modeMessage = isDedupeSimplifyMode(dedupeMode)
        ? '该操作会优先保留覆盖全面、高质量的用例，并在不降低缺陷发现能力的前提下减少冗余。'
        : '该操作只删除或合并明显重复、高度重叠的用例，不主动压缩有独立覆盖价值的场景。';
      pendingManualDedupeConfirm = true;
      syncDedupeToolbarButton();
      try {
        var confirmed = await openStoreConfirmDialog({
          title: '确认 AI 用例去重',
          message: '即将对当前页签 ' + String(modules.length) + ' 个模块、' + String(caseCount) + ' 条 AI 生成用例执行' + modeText + '。' + modeMessage + '仅处理当前页签的 AI 生成层结果。是否继续？',
          confirmText: '确认去重',
          cancelText: '取消',
        });
        if (!confirmed) return false;
        return Boolean(startAiDedupeTask({
          source: 'manual-toolbar',
          modules: cloneJson(modules, []),
          dedupeMode: dedupeMode,
        }));
      } catch (err) {
        notifyStatus('AI 用例去重启动失败：' + (err && err.message ? err.message : '未知错误'), 'err', { forceInline: true });
        return false;
      } finally {
        pendingManualDedupeConfirm = false;
        syncDedupeToolbarButton();
      }
    }

    function mergeRootPipelineDetails(pipeline, details) {
      (Array.isArray(details) ? details : []).forEach(function(item) {
        if (!item) return;
        appendRootPipelineModuleDetail(pipeline, item.module || item.moduleTitle || '', Number(item.caseCount || 0));
      });
    }

    function getRootPipelineDetailList(pipeline) {
      var detailMap = pipeline && pipeline.detailMap && typeof pipeline.detailMap === 'object'
        ? pipeline.detailMap
        : {};
      return normalizeHistoryDetails(Object.keys(detailMap).map(function(key) {
        return detailMap[key];
      }));
    }

    function buildRootPipelineSuccessMessage(pipeline) {
      var actionId = pipeline && pipeline.actionId ? String(pipeline.actionId || '') : '';
      var createdModules = Number(pipeline && pipeline.createdModules || 0);
      var addedCases = Number(pipeline && pipeline.addedCases || 0);
      if (!Number.isFinite(createdModules) || createdModules < 0) createdModules = 0;
      if (!Number.isFinite(addedCases) || addedCases < 0) addedCases = 0;
      if (actionId === ROOT_ACTIONS.FULL_CASES) {
        if (createdModules <= 0) {
          createdModules = getRootPipelineDetailList(pipeline).length;
        }
        var baseText = (pipeline && pipeline.hadAiContentBeforeAction === true ? '已重新生成 ' : '已生成 ')
          + String(createdModules) + ' 个模块，' + String(addedCases) + ' 条用例';
        var dedupeMode = normalizeDedupeMode(pipeline && pipeline.dedupeMode ? pipeline.dedupeMode : '');
        if (pipeline && pipeline.dedupeStatus === 'done') {
          var removedCount = Number(pipeline.dedupeRemovedCount || 0) || 0;
          if (removedCount > 0) {
            baseText += '，' + getDedupeRemovedSummaryText(removedCount, dedupeMode).replace(/用例$/, '').trim();
          } else {
            baseText += '，' + getDedupeNoChangeSummaryText(dedupeMode);
          }
        } else if (pipeline && pipeline.dedupeStatus === 'blocked') {
          baseText += '，仍有模块未生成用例，已暂停 AI 用例去重';
        } else if (pipeline && pipeline.dedupeStatus === 'error') {
          baseText += '，AI 用例去重失败，已保留原结果';
        } else if (pipeline && pipeline.dedupeStatus === 'cancelled') {
          baseText += '，AI 用例去重已中断，已保留当前结果';
        }
        return baseText;
      }
      if (actionId === ROOT_ACTIONS.EXISTING_CASES) {
        if (createdModules > 0) {
          return '已补充 ' + String(createdModules) + ' 个模块，' + String(addedCases) + ' 条用例';
        }
        return '已补充 ' + String(addedCases) + ' 条用例';
      }
      if (actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES || actionId === ROOT_ACTIONS.APPEND_ALL) {
        return '已补充 ' + String(createdModules) + ' 个模块，' + String(addedCases) + ' 条用例';
      }
      if (actionId === ROOT_ACTIONS.FULL_MODULES) {
        return '已生成 ' + String(createdModules) + ' 个模块';
      }
      if (actionId === ROOT_ACTIONS.REGENERATE_MODULES) {
        return '已重新生成 ' + String(createdModules) + ' 个模块';
      }
      return '已完成当前生成';
    }

    function buildRootPipelineModuleHighlightLabel(rootActionId, count) {
      var total = Number(count);
      if (!Number.isFinite(total) || total < 0) total = 0;
      if (rootActionId === ROOT_ACTIONS.EXISTING_CASES) {
        return total > 1 ? ('本轮补全用例 · ' + String(total) + ' 条') : '本轮补全用例';
      }
      return buildTopupHighlightLabel(total, 'cases');
    }

    function finalizeRootPipelineIfReady(pipelineId, options) {
      var targetId = String(pipelineId || '');
      var pipeline = getRootPipelineState();
      if (!pipeline || String(pipeline.id || '') !== targetId) return false;
      if (Array.isArray(pipeline.pendingQueue) && pipeline.pendingQueue.length > 0) return false;
      var relatedTasks = listManagedXmindTasks().filter(function(task) {
        return isTaskInRootPipeline(task, targetId);
      });
      if (relatedTasks.length > 0) return false;
      if (!isRootPipelineModulePhaseComplete(pipeline)) return false;

      var opts = options || {};
      var actionId = String(pipeline.actionId || '');
      var rootState = ensureRootUiState();
      var detailList = getRootPipelineDetailList(pipeline);
      var diagnostics = normalizeHistoryDiagnostics(pipeline.diagnostics || []);
      var changed = Number(pipeline.createdModules || 0) > 0 || Number(pipeline.addedCases || 0) > 0;
      var actionLabel = pipeline.historyActionLabel || getRootHistoryActionLabel(actionId, pipeline.hadAiContentBeforeAction === true);
      var renderReason = 'root-pipeline-finalized';
      var summaryText = '';
      var reasonText = '';
      var previewText = '';
      var resultKind = 'changed';
      var notifyText = '';
      var notifyType = 'ok';

      if (
        changed
        && actionId === ROOT_ACTIONS.FULL_CASES
        && pipeline.cancelled !== true
        && !pipeline.dedupeStatus
      ) {
        if (pipeline.restoredAfterRefresh === true) {
          updateRootPipelineState(function(current) {
            current.dedupeStatus = 'skipped';
          });
          pipeline = getRootPipelineState() || pipeline;
        } else {
        rootState.hideAiLayer = false;
        rootState.updatedAt = Date.now();
        var dedupeContext = buildVisibleModuleContext({ includeAiLayer: true });
        var readiness = buildRootPipelineDedupeReadiness(dedupeContext);
        var missingDedupeModules = readiness.missingModules || [];
        var dedupeModules = readiness.dedupeModules || [];
        var missingNames = missingDedupeModules.map(function(item) {
          return item && item.module ? String(item.module || '') : '';
        }).filter(Boolean).slice(0, 5).join('、');
        if (missingDedupeModules.length > 0) {
          var missingText = '还有 ' + String(missingDedupeModules.length) + ' 个模块未生成用例，已暂停去重'
            + (missingNames ? '：' + missingNames : '');
          updateRootPipelineState(function(current) {
            current.dedupeStatus = 'blocked';
            current.dedupeError = missingText;
            appendRootPipelineDiagnostics(current, missingText);
          });
          pipeline = getRootPipelineState() || pipeline;
          diagnostics = normalizeHistoryDiagnostics((diagnostics || []).concat(missingText));
          notifyStatus(missingText, 'warn', { forceInline: true });
        } else if (dedupeModules.length) {
          try {
            var autoDedupeMode = getDedupeModeFromSettings();
            startAiDedupeTask({
              source: 'auto-full',
              modules: dedupeModules,
              workspaceId: getActiveWorkspaceId(),
              rootPipelineId: targetId,
              rootPipelineActionId: actionId,
              dedupeMode: autoDedupeMode,
            });
            notifyStatus('全量用例已生成，正在进行 AI ' + getDedupeModeActionText(autoDedupeMode), 'warn', { forceInline: true });
            return false;
          } catch (dedupeStartErr) {
            updateRootPipelineState(function(current) {
              current.dedupeStatus = 'error';
              current.dedupeError = dedupeStartErr && dedupeStartErr.message ? String(dedupeStartErr.message) : 'AI 用例去重启动失败';
              appendRootPipelineDiagnostics(current, 'AI 用例去重启动失败：' + current.dedupeError);
            });
            pipeline = getRootPipelineState() || pipeline;
            diagnostics = normalizeHistoryDiagnostics((diagnostics || []).concat('AI 用例去重启动失败，已保留原结果'));
          }
        } else {
          updateRootPipelineState(function(current) {
            current.dedupeStatus = 'skipped';
            appendRootPipelineDiagnostics(current, '当前没有可去重的 AI 生成用例，已跳过去重');
          });
          pipeline = getRootPipelineState() || pipeline;
          diagnostics = normalizeHistoryDiagnostics((diagnostics || []).concat('当前没有可去重的 AI 生成用例，已跳过去重'));
        }
        }
      }

      rootState.running = false;
      rootState.taskId = '';
      rootState.lastAction = actionId || rootState.lastAction || '';
      rootState.hideAiLayer = false;
      rootState.updatedAt = Date.now();
      clearRootPendingModules();
      if (pipeline.hadAiCasesBeforeAction === true) {
        setAllModuleResultsVisibility(true);
      }
      if (pipeline.cancelled !== true) {
        markOpenButtonCompletionNotice({ persist: false });
      }

      if (!changed) {
        if (pipeline.cancelled === true) {
          resultKind = 'cancelled';
          reasonText = pipeline.cancelReason || '已手动中断当前 XMind 生成任务';
          summaryText = '已中断';
          notifyType = 'warn';
          renderReason = 'root-pipeline-cancelled';
        } else if (Number(pipeline.errorCount || 0) > 0 || pipeline.discoveryStatus === 'error') {
          resultKind = 'error';
          reasonText = '模型调用出错，请稍后重试。';
          summaryText = getGenerationFailureLabel('root', actionId, {
            hadAiContentBeforeAction: pipeline.hadAiContentBeforeAction === true,
            hadAiCasesBeforeAction: pipeline.hadAiCasesBeforeAction === true,
          });
          notifyText = summaryText;
          notifyType = 'err';
          rootState.status = 'error';
          rootState.error = reasonText;
          renderReason = 'root-pipeline-error';
        } else {
          resultKind = 'no-change';
          reasonText = getFriendlyRootEmptyModulesText(actionId);
          notifyText = '本轮未生成新的模块或用例';
          notifyType = 'warn';
          renderReason = 'root-pipeline-no-change';
          rootState.status = '';
          rootState.error = '';
        }
        recordGenerationHistory({
          scope: 'root',
          actionId: actionId,
          actionLabel: actionLabel,
          summaryText: summaryText,
          moduleCount: 0,
          details: [],
          resultKind: resultKind,
          reasonText: reasonText,
          diagnostics: diagnostics,
          previewText: previewText,
        });
        discardCaseGenOperationSnapshotEntry(String(pipeline.snapshotId || ''));
        rootState.snapshotId = '';
      } else {
        ensureState().mode = (
          actionId === ROOT_ACTIONS.FULL_MODULES
          || actionId === ROOT_ACTIONS.REGENERATE_MODULES
        ) ? 'modules' : 'full';
        rootState.status = '';
        rootState.error = '';
        rootState.snapshotId = String(ensureState().rootSnapshotId || pipeline.snapshotId || '');
        if (pipeline.cancelled === true) {
          diagnostics = normalizeHistoryDiagnostics(diagnostics.concat('已中断未完成任务，已保留已完成结果'));
          summaryText = '已中断，已保留已完成结果';
          notifyText = buildRootPipelineSuccessMessage(pipeline) + '，其余任务已中断';
          notifyType = 'warn';
        } else if (Number(pipeline.errorCount || 0) > 0) {
          diagnostics = normalizeHistoryDiagnostics(diagnostics.concat('有 ' + String(Number(pipeline.errorCount || 0)) + ' 个模块未成功完成'));
          summaryText = '部分模块未成功完成';
          notifyText = buildRootPipelineSuccessMessage(pipeline) + '，另有 ' + String(Number(pipeline.errorCount || 0)) + ' 个模块失败';
          notifyType = 'warn';
        } else if (pipeline.dedupeStatus === 'error') {
          diagnostics = normalizeHistoryDiagnostics(diagnostics.concat('AI 用例去重失败，已保留原结果'));
          summaryText = 'AI 用例去重失败，已保留原结果';
          notifyText = buildRootPipelineSuccessMessage(pipeline);
          notifyType = 'warn';
        } else if (pipeline.dedupeStatus === 'cancelled') {
          diagnostics = normalizeHistoryDiagnostics(diagnostics.concat('AI 用例去重已中断，已保留当前结果'));
          summaryText = 'AI 用例去重已中断，已保留当前结果';
          notifyText = buildRootPipelineSuccessMessage(pipeline);
          notifyType = 'warn';
        } else if (pipeline.dedupeStatus === 'blocked') {
          summaryText = '仍有模块未生成用例，已暂停 AI 用例去重';
          notifyText = pipeline.dedupeError || summaryText;
          notifyType = 'warn';
          rootState.status = 'error';
          rootState.error = notifyText;
        } else if (pipeline.dedupeStatus === 'done') {
          summaryText = buildRootPipelineSuccessMessage(pipeline);
          notifyText = summaryText;
          notifyType = 'ok';
        } else {
          notifyText = buildRootPipelineSuccessMessage(pipeline);
          notifyType = 'ok';
        }
        recordGenerationHistory({
          scope: 'root',
          actionId: actionId,
          actionLabel: actionLabel,
          summaryText: summaryText,
          moduleCount: detailList.length,
          details: detailList,
          diagnostics: diagnostics,
          dedupeRecords: pipeline.dedupeRecords || [],
        });
        clearDeleteHistoryStacks();
        syncCasesGenPageRender();
      }

      clearRootPipelineState();
      if (notifyText) {
        notifyStatus(notifyText, notifyType, { forceInline: true });
      }
      if (isDrawerOpen()) {
        queueTerminalMindRender({
          reason: renderReason,
          persist: false,
          anchorNodeId: Object.prototype.hasOwnProperty.call(opts, 'anchorNodeId') ? String(opts.anchorNodeId || '') : '',
        });
      }
      persistManagedTaskWorkspaceState(true);
      return changed;
    }

    async function handleRootPipelineDiscoveryTaskSuccess(task) {
      var pipeline = ensureRootPipelineStateFromTask(task);
      if (!pipeline || String(pipeline.id || '') !== String(task && task.rootPipelineId ? task.rootPipelineId : '')) {
        return false;
      }
      var actionId = String(pipeline.actionId || task && task.actionId || '');
      var rootState = ensureRootUiState();
      var anchorNodeId = getManagedTaskAnchorNodeId(task, null);
      var contract = task && task.contract ? task.contract : createOperationContract(actionId, null);
      var visibleContext = rootState.hideAiLayer === true
        ? buildVisibleModuleContext({ includeAiLayer: false })
        : buildVisibleModuleContext();
      visibleContext = ensureVisibleModuleContext(visibleContext);
      var visibleMap = visibleContext.map || {};
      var normalizedOutput = normalizeModelModulesOutputDetailed(task && task.resultRaw ? task.resultRaw : '');
      var filtered = filterModulesByContract(normalizedOutput.list, contract, visibleContext);
      var modules = filtered.list;
      var fullCaseOutputModules = [];
      if (String(actionId || '') === ROOT_ACTIONS.FULL_CASES) {
        var fullCaseDedupeContract = cloneJson(contract, {}) || {};
        fullCaseDedupeContract.generateCasesForNewModules = true;
        fullCaseDedupeContract.generateCasesForExistingModules = true;
        fullCaseOutputModules = filterModulesByContract(
          normalizedOutput.list,
          fullCaseDedupeContract,
          visibleContext
        ).list;
      }
      var coverageGapInfo = evaluateRootCoverageGaps(task, modules, contract);
      if (task && task.skipCoverageRetry !== true && coverageGapInfo.shouldRetry === true) {
        try {
          if (tryStartRootCoverageRetry(task, coverageGapInfo, anchorNodeId)) {
            updateRootPipelineState(function(current) {
              current.stage = 'discovering';
              current.discoveryStatus = 'running';
            });
            return false;
          }
        } catch (retryErr) {
          coverageGapInfo.retryStartError = retryErr && retryErr.message ? String(retryErr.message) : '自动补强未能启动';
        }
      }

      var existingDescriptors = (actionId === ROOT_ACTIONS.EXISTING_CASES || actionId === ROOT_ACTIONS.APPEND_ALL)
        ? buildRootPipelineTaskDescriptors(actionId, visibleContext)
        : [];
      var newModules = [];
      var skeletonModules = [];
      var skeletonActionId = '';

      if (actionId === ROOT_ACTIONS.FULL_CASES) {
        newModules = modules.slice();
        skeletonModules = cloneModulesWithoutCases(newModules);
        skeletonActionId = ROOT_ACTIONS.FULL_MODULES;
      } else if (actionId === ROOT_ACTIONS.EXISTING_CASES || actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES || actionId === ROOT_ACTIONS.APPEND_ALL) {
        newModules = modules.filter(function(item) {
          return !visibleMap[normalizeModuleKey(item && item.module ? item.module : '')];
        });
        skeletonModules = cloneModulesWithoutCases(newModules);
        skeletonActionId = ROOT_ACTIONS.TOPUP_MODULES;
      }

      var skeletonApplied = {
        changed: false,
        createdModules: 0,
        addedCases: 0,
        details: [],
        diagnostics: {},
      };
      if (skeletonModules.length && skeletonActionId) {
        skeletonApplied = applyRootOutput(skeletonActionId, skeletonModules, visibleContext, Number(task && task.durationMs || 0));
      }
      if (actionId === ROOT_ACTIONS.FULL_CASES && skeletonApplied.changed) {
        rootState.hideAiLayer = false;
        rootState.updatedAt = Date.now();
      }

      var fullCasesModuleSnapshot = [];
      if (actionId === ROOT_ACTIONS.FULL_CASES) {
        var fullCasesContextAfterSkeleton = ensureVisibleModuleContext(buildVisibleModuleContext());
        var fullCasesMapAfterSkeleton = fullCasesContextAfterSkeleton.map || {};
        fullCasesModuleSnapshot = fullCaseOutputModules.map(function(item) {
          var moduleKey = normalizeModuleKey(item && item.module ? item.module : '');
          var resolvedEntry = moduleKey ? fullCasesMapAfterSkeleton[moduleKey] : null;
          return {
            moduleId: resolvedEntry && resolvedEntry.aiModuleId ? String(resolvedEntry.aiModuleId || '') : '',
            moduleKey: moduleKey,
            module: item && item.module ? item.module : '',
            key_scenarios: item && Array.isArray(item.key_scenarios) ? item.key_scenarios.slice() : [],
            test_points: item && Array.isArray(item.test_points) ? item.test_points.slice() : [],
            coupled_modules: item && Array.isArray(item.coupled_modules) ? item.coupled_modules.slice() : [],
            cases: normalizeFallbackCaseList(item && item.cases, item && item.module ? item.module : ''),
          };
        });
        updateRootPipelineState(function(current) {
          current.generatedDedupeModules = normalizeRootPipelineDedupeModules(fullCasesModuleSnapshot);
        });
      }

      if (actionId === ROOT_ACTIONS.FULL_CASES && Number(task && task.coverageRetryCount || 0) > 0) {
        updateRootPipelineState(function(current) {
          var retryReasonLabels = normalizeHistoryDiagnostics(task && task.coverageRetryReasons ? task.coverageRetryReasons : []);
          appendRootPipelineDiagnostics(current, retryReasonLabels.length
            ? ('自动补强覆盖：' + retryReasonLabels.join('、'))
            : '自动补强覆盖完成');
        });
      }

      updateRootPipelineState(function(current) {
        current.stage = 'modules';
        current.discoveryStatus = 'done';
        if (actionId === ROOT_ACTIONS.FULL_CASES) {
          current.createdModules += Number(skeletonApplied.createdModules || 0);
          mergeRootPipelineDetails(current, skeletonApplied.details);
        } else {
          current.createdModules += Number(skeletonApplied.createdModules || 0);
          mergeRootPipelineDetails(current, skeletonApplied.details);
        }
        if (coverageGapInfo && coverageGapInfo.retryStartError) {
          appendRootPipelineDiagnostics(current, '自动补强未启动：' + summarizeModelOutputText(coverageGapInfo.retryStartError, 80));
        }
      });

      var postContext = ensureVisibleModuleContext(buildVisibleModuleContext());
      var postContextMap = postContext.map || {};
      var descriptors = existingDescriptors.slice();
      newModules.forEach(function(item) {
        var moduleKey = normalizeModuleKey(item && item.module ? item.module : '');
        var resolvedEntry = moduleKey ? postContextMap[moduleKey] : null;
        if (!resolvedEntry) return;
        descriptors.push({
          moduleEntry: resolvedEntry,
          actionId: MODULE_ACTIONS.FULL_CASES,
          rootPipelineNewModule: actionId !== ROOT_ACTIONS.FULL_CASES,
          anchorNodeId: anchorNodeId,
          fallbackCases: normalizeFallbackCaseList(item && item.cases, item && item.module ? item.module : ''),
        });
      });
      if (actionId === ROOT_ACTIONS.FULL_CASES) {
        descriptors = newModules.map(function(item) {
          var moduleKey = normalizeModuleKey(item && item.module ? item.module : '');
          var resolvedEntry = moduleKey ? postContextMap[moduleKey] : null;
          if (!resolvedEntry) return null;
          return {
            moduleEntry: resolvedEntry,
            actionId: MODULE_ACTIONS.FULL_CASES,
            rootPipelineNewModule: false,
            anchorNodeId: anchorNodeId,
            fallbackCases: [],
          };
        }).filter(Boolean);
      }

      if (!descriptors.length && !skeletonApplied.changed) {
        var discoveryNoChangeInfo = buildRootNoChangeInfo(actionId, filtered.diagnostics, skeletonApplied.diagnostics, normalizedOutput.diagnostics);
        updateRootPipelineState(function(current) {
          appendRootPipelineDiagnostics(current, [discoveryNoChangeInfo.reasonText].concat(discoveryNoChangeInfo.diagnostics || []));
        });
      }

      if (isDrawerOpen()) {
        queueTerminalMindRender({ reason: 'root-pipeline-discovery-committed', persist: false, anchorNodeId: anchorNodeId });
      }
      syncTerminalTaskRestoreContext(task);
      persistManagedTaskWorkspaceState(true);

      var startedCount = await startRootPipelineModuleTasks(pipeline, descriptors, {
        workspaceId: getTaskWorkspaceId(task),
      });
      if (startedCount <= 0) {
        finalizeRootPipelineIfReady(String(pipeline.id || ''), { anchorNodeId: anchorNodeId });
      }
      return startedCount > 0 || skeletonApplied.changed;
    }

    function handleRootPipelineDiscoveryTaskError(task, err, options) {
      var pipeline = ensureRootPipelineStateFromTask(task);
      if (!pipeline || String(pipeline.id || '') !== String(task && task.rootPipelineId ? task.rootPipelineId : '')) {
        return false;
      }
      var opts = options || {};
      var anchorNodeId = getManagedTaskAnchorNodeId(task, null);
      var errorInfo = opts.resultKind === 'cancelled'
        ? buildGenerationCancelledInfo(task)
        : buildGenerationErrorInfo(new Error(getTaskErrorMessage(task, err)));
      updateRootPipelineState(function(current) {
        current.stage = 'modules';
        current.discoveryStatus = opts.resultKind === 'cancelled' ? 'cancelled' : 'error';
        if (opts.resultKind === 'cancelled') {
          current.cancelled = true;
          current.cancelReason = errorInfo.reasonText;
        } else {
          current.errorCount += 1;
        }
        appendRootPipelineDiagnostics(current, (opts.resultKind === 'cancelled'
          ? ['发现阶段已中断：' + errorInfo.reasonText]
          : ['发现阶段失败：' + errorInfo.reasonText]
        ).concat(errorInfo.diagnostics || []));
      });
      if (isDrawerOpen()) {
        queueTerminalMindRender({ reason: opts.renderReason || 'root-pipeline-discovery-error', persist: false, anchorNodeId: anchorNodeId });
      }
      syncTerminalTaskRestoreContext(task);
      persistManagedTaskWorkspaceState(true);
      return false;
    }

    function handleRootPipelineModuleTaskSuccess(task) {
      var pipeline = ensureRootPipelineStateFromTask(task);
      if (!pipeline || String(pipeline.id || '') !== String(task && task.rootPipelineId ? task.rootPipelineId : '')) {
        return false;
      }
      var actionId = String(task && task.actionId ? task.actionId : '');
      var visibleContext = buildVisibleModuleContext();
      var resolvedEntry = resolveTaskModuleEntry(task, visibleContext);
      var anchorNodeId = getManagedTaskAnchorNodeId(task, resolvedEntry);
      var historyModuleTitle = normalizeModuleTitle(
        resolvedEntry && resolvedEntry.title
          ? resolvedEntry.title
          : (task && task.moduleTitle ? task.moduleTitle : '')
      );
      var moduleId = resolvedEntry && resolvedEntry.aiModuleId ? resolvedEntry.aiModuleId : (task && task.moduleId ? task.moduleId : '');
      var moduleState = moduleId ? ensureModuleUiState(moduleId) : null;
      var contract = task && task.contract ? task.contract : createOperationContract(actionId, resolvedEntry);
      var normalizedOutput = normalizeModelModulesOutputDetailed(task && task.resultRaw ? task.resultRaw : '');
      var filtered = filterModulesByContract(normalizedOutput.list, contract, visibleContext);
      var modules = filtered.list;
      var targetKey = normalizeModuleKey(resolvedEntry && resolvedEntry.title ? resolvedEntry.title : historyModuleTitle);
      var targetOutput = null;
      modules.some(function(item) {
        if (normalizeModuleKey(item.module) === targetKey) {
          targetOutput = item;
          return true;
        }
        return false;
      });
      if (!targetOutput) {
        targetOutput = {
          module: historyModuleTitle,
          key_scenarios: [],
          test_points: [],
          coupled_modules: [],
          cases: [],
        };
      }

      var currentAiCases = getAiCasesForModule(moduleId);
      var visibleCases = resolvedEntry ? getVisibleCasesForModuleEntry(resolvedEntry).map(function(row) {
        return normalizeCaseItem(row.item, resolvedEntry.title);
      }).filter(Boolean) : [];
      var nextList = [];
      var appended = [];
      var mergeDiagnostics = {
        duplicateAgainstExisting: 0,
        duplicateWithinAdded: 0,
      };
      var changed = false;
      var addedCount = 0;

      if (actionId === MODULE_ACTIONS.APPEND) {
        var merged = mergeCasesWithoutDuplicates(currentAiCases, targetOutput.cases || [], visibleCases);
        nextList = merged.merged;
        appended = merged.appended;
        mergeDiagnostics = merged.diagnostics || mergeDiagnostics;
        if (appended.length > 0) {
          changed = true;
          addedCount = appended.length;
          commitCaseList(moduleId, nextList, Number(task && task.durationMs || 0), '', 'keep-valid');
          if (moduleState) {
            setModuleTopupHighlight(moduleState, resolvedEntry.title, visibleCases.length, appended.length, {
              label: buildRootPipelineModuleHighlightLabel(String(task.rootPipelineActionId || ''), appended.length),
            });
          }
        } else {
          var appendNoChangeInfo = buildModuleNoChangeInfo(actionId, filtered.diagnostics, mergeDiagnostics, targetOutput, normalizedOutput.diagnostics);
          if (task && task.createdModuleBeforeAction === true && task.rootPipelineNewModule !== true && moduleId) {
            removeAiModuleRecord(moduleId);
          }
          updateRootPipelineState(function(current) {
            appendRootPipelineDiagnostics(current, '模块「' + historyModuleTitle + '」未新增用例：' + appendNoChangeInfo.reasonText);
          });
        }
      } else {
        nextList = Array.isArray(targetOutput.cases) ? targetOutput.cases.slice() : [];
        if (nextList.length > 0) {
          changed = true;
          addedCount = nextList.length;
          commitCaseList(moduleId, nextList, Number(task && task.durationMs || 0), '', '');
          if (moduleState) {
            if (task && task.rootPipelineNewModule === true) {
              setModuleTopupHighlight(moduleState, resolvedEntry.title, 0, nextList.length, { highlightScope: 'subtree' });
            } else if (String(task.rootPipelineActionId || '') === ROOT_ACTIONS.EXISTING_CASES) {
              setModuleTopupHighlight(moduleState, resolvedEntry.title, 0, nextList.length, {
                label: buildRootPipelineModuleHighlightLabel(String(task.rootPipelineActionId || ''), nextList.length),
              });
            } else {
              clearModuleTopupHighlight(moduleState);
            }
          }
        } else {
          var fallbackCases = normalizeFallbackCaseList(task && task.fallbackCases, historyModuleTitle);
          if (fallbackCases.length > 0) {
            changed = true;
            nextList = fallbackCases.slice();
            addedCount = nextList.length;
            commitCaseList(moduleId, nextList, Number(task && task.durationMs || 0), '', '');
            updateRootPipelineState(function(current) {
              appendRootPipelineDiagnostics(current, '模块「' + historyModuleTitle + '」模块任务返回空结果，已回退使用首轮结果');
            });
            if (moduleState) clearModuleTopupHighlight(moduleState);
          } else {
            var fullNoChangeInfo = buildModuleNoChangeInfo(actionId, filtered.diagnostics, mergeDiagnostics, targetOutput, normalizedOutput.diagnostics);
            if (task && task.createdModuleBeforeAction === true && task.rootPipelineNewModule !== true && moduleId) {
              removeAiModuleRecord(moduleId);
            }
            updateRootPipelineState(function(current) {
              appendRootPipelineDiagnostics(current, '模块「' + historyModuleTitle + '」未新增用例：' + fullNoChangeInfo.reasonText);
            });
          }
        }
      }

      if (moduleState) {
        moduleState.running = false;
        moduleState.taskId = '';
        moduleState.status = '';
        moduleState.error = '';
        moduleState.hideResults = false;
        clearModuleRootPendingAction(moduleState);
        moduleState.updatedAt = Date.now();
      }

      if (changed) {
        updateRootPipelineState(function(current) {
          current.addedCases += addedCount;
          if (String(task && task.rootPipelineActionId ? task.rootPipelineActionId : '') === ROOT_ACTIONS.FULL_CASES) {
            upsertRootPipelineDedupeModule(current, {
              moduleId: moduleId,
              moduleKey: String(task && task.moduleKey ? task.moduleKey : (resolvedEntry && resolvedEntry.moduleKey ? resolvedEntry.moduleKey : '')),
              module: historyModuleTitle,
              key_scenarios: resolvedEntry && resolvedEntry.aiModule && Array.isArray(resolvedEntry.aiModule.scenarios) ? resolvedEntry.aiModule.scenarios.slice() : [],
              test_points: resolvedEntry && resolvedEntry.aiModule && Array.isArray(resolvedEntry.aiModule.points) ? resolvedEntry.aiModule.points.slice() : [],
              coupled_modules: resolvedEntry && resolvedEntry.aiModule && Array.isArray(resolvedEntry.aiModule.coupled) ? resolvedEntry.aiModule.coupled.slice() : [],
              cases: nextList,
            });
          }
          appendRootPipelineModuleDetail(current, historyModuleTitle, addedCount);
        });
        clearDeleteHistoryStacks();
        syncCasesGenPageRender();
      }
      markRootPipelineModuleTaskCompleted(task);
      if (isDrawerOpen()) {
        queueTerminalMindRender({ reason: changed ? 'root-pipeline-module-committed' : 'root-pipeline-module-no-change', persist: false, anchorNodeId: anchorNodeId });
      }
      syncTerminalTaskRestoreContext(task);
      persistManagedTaskWorkspaceState(true);
      return changed;
    }

    function handleRootPipelineModuleTaskError(task, err, options) {
      var pipeline = ensureRootPipelineStateFromTask(task);
      if (!pipeline || String(pipeline.id || '') !== String(task && task.rootPipelineId ? task.rootPipelineId : '')) {
        return false;
      }
      var opts = options || {};
      var anchorNodeId = getManagedTaskAnchorNodeId(task, null);
      var moduleId = task && task.moduleId ? String(task.moduleId || '') : '';
      var moduleState = moduleId ? ensureModuleUiState(moduleId) : null;
      if (moduleState) {
        moduleState.running = false;
        moduleState.taskId = '';
        moduleState.status = opts.resultKind === 'cancelled' ? '' : 'error';
        moduleState.error = opts.resultKind === 'cancelled' ? '' : getTaskErrorMessage(task, err);
        moduleState.hideResults = false;
        clearModuleRootPendingAction(moduleState);
        moduleState.updatedAt = Date.now();
      }
      if (task && task.createdModuleBeforeAction === true && task.rootPipelineNewModule !== true && moduleId) {
        removeAiModuleRecord(moduleId);
      }
      var moduleTitle = normalizeModuleTitle(task && task.moduleTitle ? task.moduleTitle : '');
      var errorInfo = opts.resultKind === 'cancelled'
        ? buildGenerationCancelledInfo(task)
        : buildGenerationErrorInfo(new Error(moduleState && moduleState.error ? moduleState.error : getTaskErrorMessage(task, err)));
      updateRootPipelineState(function(current) {
        if (opts.resultKind === 'cancelled') {
          current.cancelled = true;
          if (!current.cancelReason) current.cancelReason = errorInfo.reasonText;
        } else {
          current.errorCount += 1;
        }
        appendRootPipelineDiagnostics(current, (opts.resultKind === 'cancelled'
          ? ['模块「' + (moduleTitle || '当前模块') + '」已中断：' + errorInfo.reasonText]
          : ['模块「' + (moduleTitle || '当前模块') + '」失败：' + errorInfo.reasonText]
        ).concat(errorInfo.diagnostics || []));
      });
      markRootPipelineModuleTaskCompleted(task);
      if (isDrawerOpen()) {
        queueTerminalMindRender({ reason: opts.renderReason || 'root-pipeline-module-error', persist: false, anchorNodeId: anchorNodeId });
      }
      syncTerminalTaskRestoreContext(task);
      persistManagedTaskWorkspaceState(true);
      return false;
    }

    function completeRootTaskSuccess(task) {
      if (task && task.rootPipelineId && String(task.pipelineStage || '') === 'discovery') {
        return handleRootPipelineDiscoveryTaskSuccess(task);
      }
      var actionId = String(task && task.actionId ? task.actionId : '');
      var anchorNodeId = getManagedTaskAnchorNodeId(task, null);
      var rootState = ensureRootUiState();
      var contract = task && task.contract ? task.contract : createOperationContract(actionId, null);
      var visibleContext = buildVisibleModuleContext();
      var normalizedOutput = normalizeModelModulesOutputDetailed(task && task.resultRaw ? task.resultRaw : '');
      var filtered = filterModulesByContract(normalizedOutput.list, contract, visibleContext);
      var modules = filtered.list;
      var coverageGapInfo = evaluateRootCoverageGaps(task, modules, contract);
      if (coverageGapInfo.shouldRetry === true) {
        try {
          if (tryStartRootCoverageRetry(task, coverageGapInfo, anchorNodeId)) {
            return false;
          }
        } catch (retryErr) {
          coverageGapInfo.retryStartError = retryErr && retryErr.message ? String(retryErr.message) : '自动补强未能启动';
        }
      }
      var applied = applyRootOutput(actionId, modules, visibleContext, Number(task && task.durationMs || 0));
      var historyDiagnostics = buildCoverageRetryHistoryDiagnostics(task);
      if (coverageGapInfo && coverageGapInfo.retryStartError) {
        historyDiagnostics.push('自动补强未启动：' + summarizeModelOutputText(coverageGapInfo.retryStartError, 80));
      }
      rootState.running = false;
      rootState.taskId = '';
      rootState.hideAiLayer = false;
      rootState.status = '';
      rootState.error = '';
      rootState.updatedAt = Date.now();
      clearRootPendingModules(actionId);
      markOpenButtonCompletionNotice({ persist: false });
      if (!applied.changed) {
        var rootNoChangeInfo = buildRootNoChangeInfo(actionId, filtered.diagnostics, applied.diagnostics, normalizedOutput.diagnostics);
        recordGenerationHistory({
          scope: 'root',
          actionId: actionId,
          actionLabel: task && task.historyActionLabel ? task.historyActionLabel : getRootHistoryActionLabel(actionId, task && task.hadAiContentBeforeAction),
          moduleCount: 0,
          details: [],
          resultKind: rootNoChangeInfo.resultKind,
          reasonText: rootNoChangeInfo.reasonText,
          diagnostics: (rootNoChangeInfo.diagnostics || []).concat(historyDiagnostics),
          previewText: rootNoChangeInfo.previewText,
        });
        discardCaseGenOperationSnapshotEntry(task && task.snapshotId ? task.snapshotId : '');
        if (task && task.hadAiCasesBeforeAction === true) setAllModuleResultsVisibility(true);
        notifyStatus('本轮未生成新的模块或用例', 'warn', { forceInline: true });
        if (isDrawerOpen()) queueTerminalMindRender({ reason: 'root-task-no-change', persist: false, anchorNodeId: anchorNodeId });
        persistManagedTaskWorkspaceState(true);
        return false;
      }
      ensureState().mode = (
        actionId === ROOT_ACTIONS.FULL_MODULES
        || actionId === ROOT_ACTIONS.REGENERATE_MODULES
      ) ? 'modules' : 'full';
      rootState.snapshotId = String(ensureState().rootSnapshotId || (task && task.snapshotId ? task.snapshotId : '') || '');
      recordGenerationHistory({
        scope: 'root',
        actionId: actionId,
        actionLabel: task && task.historyActionLabel ? task.historyActionLabel : getRootHistoryActionLabel(actionId, task && task.hadAiContentBeforeAction),
        moduleCount: Array.isArray(applied.details) ? applied.details.length : 0,
        details: applied.details,
        diagnostics: historyDiagnostics,
      });
      var message = '';
      if (actionId === ROOT_ACTIONS.FULL_MODULES) {
        message = '已生成 ' + String(applied.createdModules) + ' 个模块';
      } else if (actionId === ROOT_ACTIONS.REGENERATE_MODULES) {
        message = '已重新生成 ' + String(applied.createdModules) + ' 个模块';
      } else if (actionId === ROOT_ACTIONS.FULL_CASES) {
        message = (task && task.hadAiContentBeforeAction ? '已重新生成 ' : '已生成 ')
          + String(applied.createdModules) + ' 个模块，' + String(applied.addedCases) + ' 条用例';
      } else {
        message = '已补充 ' + String(applied.createdModules) + ' 个模块，' + String(applied.addedCases) + ' 条用例';
      }
      notifyStatus(message, 'ok');
      clearDeleteHistoryStacks();
      syncCasesGenPageRender();
      if (isDrawerOpen()) queueTerminalMindRender({ reason: 'root-task-committed', persist: false, anchorNodeId: anchorNodeId });
      persistManagedTaskWorkspaceState(true);
      return true;
    }

    function completeRootTaskError(task, err, options) {
      if (task && task.rootPipelineId && String(task.pipelineStage || '') === 'discovery') {
        return handleRootPipelineDiscoveryTaskError(task, err, options);
      }
      var opts = options || {};
      var actionId = String(task && task.actionId ? task.actionId : '');
      var anchorNodeId = getManagedTaskAnchorNodeId(task, null);
      var rootState = ensureRootUiState();
      discardCaseGenOperationSnapshotEntry(task && task.snapshotId ? task.snapshotId : '');
      rootState.running = false;
      rootState.taskId = '';
      rootState.hideAiLayer = false;
      rootState.status = opts.resultKind === 'cancelled' ? '' : 'error';
      rootState.error = opts.resultKind === 'cancelled' ? '' : getTaskErrorMessage(task, err);
      rootState.updatedAt = Date.now();
      clearRootPendingModules(actionId);
      if (task && task.hadAiCasesBeforeAction === true) setAllModuleResultsVisibility(true);
      var errorInfo = opts.resultKind === 'cancelled'
        ? buildGenerationCancelledInfo(task)
        : buildGenerationErrorInfo(new Error(rootState.error));
      var retryHistoryDiagnostics = buildCoverageRetryHistoryDiagnostics(task);
      var failureLabel = opts.resultKind === 'cancelled'
        ? '已中断'
        : getGenerationFailureLabel('root', actionId, {
            hadAiContentBeforeAction: task && task.hadAiContentBeforeAction === true,
            hadAiCasesBeforeAction: task && task.hadAiCasesBeforeAction === true,
          });
      recordGenerationHistory({
        scope: 'root',
        actionId: actionId,
        actionLabel: task && task.historyActionLabel ? task.historyActionLabel : getRootHistoryActionLabel(actionId, task && task.hadAiContentBeforeAction),
        summaryText: failureLabel,
        moduleCount: 0,
        details: [],
        resultKind: errorInfo.resultKind,
        reasonText: errorInfo.reasonText,
        diagnostics: (errorInfo.diagnostics || []).concat(retryHistoryDiagnostics),
        previewText: errorInfo.previewText,
      });
      if (opts.resultKind === 'cancelled') {
        if (!shouldSuppressTaskCancelToast(task)) {
          notifyFloatingStatus('已中断当前 XMind 生成任务', 'warn', 3000);
        }
      } else {
        notifyStatus(failureLabel, 'err', { forceInline: true });
      }
      if (isDrawerOpen()) queueTerminalMindRender({ reason: opts.renderReason || 'root-task-error', persist: false, anchorNodeId: anchorNodeId });
      persistManagedTaskWorkspaceState(true);
      return false;
    }

    function completeModuleTaskSuccess(task) {
      if (task && task.rootPipelineId && task.historySuppressed === true) {
        return handleRootPipelineModuleTaskSuccess(task);
      }
      var actionId = String(task && task.actionId ? task.actionId : '');
      var visibleContext = buildVisibleModuleContext();
      var resolvedEntry = resolveTaskModuleEntry(task, visibleContext);
      var anchorNodeId = getManagedTaskAnchorNodeId(task, resolvedEntry);
      var historyModuleTitle = normalizeModuleTitle(
        resolvedEntry && resolvedEntry.title
          ? resolvedEntry.title
          : (task && task.moduleTitle ? task.moduleTitle : '')
      );
      var moduleId = resolvedEntry && resolvedEntry.aiModuleId ? resolvedEntry.aiModuleId : (task && task.moduleId ? task.moduleId : '');
      var moduleState = moduleId ? ensureModuleUiState(moduleId) : null;
      var contract = task && task.contract ? task.contract : createOperationContract(actionId, resolvedEntry);
      var normalizedOutput = normalizeModelModulesOutputDetailed(task && task.resultRaw ? task.resultRaw : '');
      var filtered = filterModulesByContract(normalizedOutput.list, contract, visibleContext);
      var modules = filtered.list;
      var targetKey = normalizeModuleKey(resolvedEntry && resolvedEntry.title ? resolvedEntry.title : historyModuleTitle);
      var targetOutput = null;
      modules.some(function(item) {
        if (normalizeModuleKey(item.module) === targetKey) {
          targetOutput = item;
          return true;
        }
        return false;
      });
      if (!targetOutput) {
        targetOutput = {
          module: historyModuleTitle,
          key_scenarios: [],
          test_points: [],
          coupled_modules: [],
          cases: [],
        };
      }
      var currentAiCases = getAiCasesForModule(moduleId);
      var visibleCases = resolvedEntry ? getVisibleCasesForModuleEntry(resolvedEntry).map(function(row) {
        return normalizeCaseItem(row.item, resolvedEntry.title);
      }).filter(Boolean) : [];
      var nextList = [];
      var appended = [];
      var mergeDiagnostics = {
        duplicateAgainstExisting: 0,
        duplicateWithinAdded: 0,
      };

      if (actionId === MODULE_ACTIONS.APPEND) {
        var merged = mergeCasesWithoutDuplicates(currentAiCases, targetOutput.cases || [], visibleCases);
        nextList = merged.merged;
        appended = merged.appended;
        mergeDiagnostics = merged.diagnostics || mergeDiagnostics;
        if (!appended.length) {
          markOpenButtonCompletionNotice({ persist: false });
          var appendNoChangeInfo = buildModuleNoChangeInfo(actionId, filtered.diagnostics, mergeDiagnostics, targetOutput, normalizedOutput.diagnostics);
          if (task && task.createdModuleBeforeAction === true && task.snapshotId) {
            rollbackCaseGenOperationSnapshotEntry(task.snapshotId);
          } else if (task && task.snapshotId) {
            discardCaseGenOperationSnapshotEntry(task.snapshotId);
          }
          if (task && task.createdModuleBeforeAction === true) {
            removeAiModuleRecord(moduleId);
          }
          if (moduleState) {
            moduleState.running = false;
            moduleState.taskId = '';
            moduleState.hideResults = false;
            moduleState.snapshotId = '';
          }
          recordGenerationHistory({
            scope: 'module',
            moduleTitle: historyModuleTitle,
            actionId: actionId,
            actionLabel: task && task.historyActionLabel ? task.historyActionLabel : getModuleHistoryActionLabel(actionId, resolvedEntry, task && task.hadAiCasesBeforeAction),
            moduleCount: 1,
            details: [{ module: historyModuleTitle, caseCount: 0 }],
            resultKind: appendNoChangeInfo.resultKind,
            reasonText: appendNoChangeInfo.reasonText,
            diagnostics: appendNoChangeInfo.diagnostics,
            previewText: appendNoChangeInfo.previewText,
          });
          notifyStatus('当前模块未补充到新的用例', 'warn', { forceInline: true });
          if (isDrawerOpen()) queueTerminalMindRender({ reason: 'module-task-append-empty', persist: false, anchorNodeId: anchorNodeId });
          persistManagedTaskWorkspaceState(true);
          return false;
        }
        commitCaseList(moduleId, nextList, Number(task && task.durationMs || 0), '', 'keep-valid');
        if (moduleState) setModuleTopupHighlight(moduleState, resolvedEntry.title, visibleCases.length, appended.length);
      } else {
        nextList = Array.isArray(targetOutput.cases) ? targetOutput.cases.slice() : [];
        if (!nextList.length) {
          markOpenButtonCompletionNotice({ persist: false });
          var fullNoChangeInfo = buildModuleNoChangeInfo(actionId, filtered.diagnostics, mergeDiagnostics, targetOutput, normalizedOutput.diagnostics);
          if (task && task.createdModuleBeforeAction === true && task.snapshotId) {
            rollbackCaseGenOperationSnapshotEntry(task.snapshotId);
          } else if (task && task.snapshotId) {
            discardCaseGenOperationSnapshotEntry(task.snapshotId);
          }
          if (task && task.createdModuleBeforeAction === true) {
            removeAiModuleRecord(moduleId);
          }
          if (moduleState) {
            moduleState.running = false;
            moduleState.taskId = '';
            moduleState.hideResults = false;
            moduleState.snapshotId = '';
          }
          recordGenerationHistory({
            scope: 'module',
            moduleTitle: historyModuleTitle,
            actionId: actionId,
            actionLabel: task && task.historyActionLabel ? task.historyActionLabel : getModuleHistoryActionLabel(actionId, resolvedEntry, task && task.hadAiCasesBeforeAction),
            moduleCount: 1,
            details: [{ module: historyModuleTitle, caseCount: 0 }],
            resultKind: fullNoChangeInfo.resultKind,
            reasonText: fullNoChangeInfo.reasonText,
            diagnostics: fullNoChangeInfo.diagnostics,
            previewText: fullNoChangeInfo.previewText,
          });
          notifyStatus('当前模块未生成到有效用例', 'warn', { forceInline: true });
          if (isDrawerOpen()) queueTerminalMindRender({ reason: 'module-task-full-empty', persist: false, anchorNodeId: anchorNodeId });
          persistManagedTaskWorkspaceState(true);
          return false;
        }
        commitCaseList(moduleId, nextList, Number(task && task.durationMs || 0), '', '');
        if (moduleState) clearModuleTopupHighlight(moduleState);
      }
      markOpenButtonCompletionNotice({ persist: false });

      if (moduleState) {
        moduleState.running = false;
        moduleState.taskId = '';
        moduleState.status = '';
        moduleState.error = '';
        moduleState.hideResults = false;
        moduleState.updatedAt = Date.now();
      }
      recordGenerationHistory({
        scope: 'module',
        moduleTitle: historyModuleTitle,
        actionId: actionId,
        actionLabel: task && task.historyActionLabel ? task.historyActionLabel : getModuleHistoryActionLabel(actionId, resolvedEntry, task && task.hadAiCasesBeforeAction),
        moduleCount: 1,
        details: [{
          module: historyModuleTitle,
          caseCount: actionId === MODULE_ACTIONS.APPEND ? appended.length : nextList.length,
        }],
      });
      notifyStatus(
        actionId === MODULE_ACTIONS.APPEND
          ? ('已为该模块补充 ' + String(appended.length) + ' 条用例')
          : ((task && task.hadAiCasesBeforeAction ? '已重新生成 ' : '已生成 ') + String(nextList.length) + ' 条用例'),
        'ok'
      );
      clearDeleteHistoryStacks();
      syncCasesGenPageRender();
      if (isDrawerOpen()) queueTerminalMindRender({ reason: 'module-task-committed', persist: false, anchorNodeId: anchorNodeId });
      persistManagedTaskWorkspaceState(true);
      return true;
    }

    function completeModuleTaskError(task, err, options) {
      if (task && task.rootPipelineId && task.historySuppressed === true) {
        return handleRootPipelineModuleTaskError(task, err, options);
      }
      var opts = options || {};
      var actionId = String(task && task.actionId ? task.actionId : '');
      var anchorNodeId = getManagedTaskAnchorNodeId(task, null);
      var moduleId = task && task.moduleId ? String(task.moduleId || '') : '';
      var moduleState = moduleId ? ensureModuleUiState(moduleId) : null;
      if (task && task.createdModuleBeforeAction === true && task.snapshotId) {
        rollbackCaseGenOperationSnapshotEntry(task.snapshotId);
        if (moduleId) removeAiModuleRecord(moduleId);
      } else if (task && task.snapshotId) {
        discardCaseGenOperationSnapshotEntry(task.snapshotId);
      }
      if (moduleState) {
        moduleState.running = false;
        moduleState.taskId = '';
        moduleState.status = opts.resultKind === 'cancelled' ? '' : 'error';
        moduleState.error = opts.resultKind === 'cancelled' ? '' : getTaskErrorMessage(task, err);
        moduleState.hideResults = false;
        moduleState.updatedAt = Date.now();
      }
      var moduleTitle = normalizeModuleTitle(task && task.moduleTitle ? task.moduleTitle : '');
      var errorInfo = opts.resultKind === 'cancelled'
        ? buildGenerationCancelledInfo(task)
        : buildGenerationErrorInfo(new Error(moduleState && moduleState.error ? moduleState.error : getTaskErrorMessage(task, err)));
      var failureLabel = opts.resultKind === 'cancelled'
        ? '已中断'
        : getGenerationFailureLabel('module', actionId, {
            hadAiCasesBeforeAction: task && task.hadAiCasesBeforeAction === true,
          });
      recordGenerationHistory({
        scope: 'module',
        moduleTitle: moduleTitle,
        actionId: actionId,
        actionLabel: task && task.historyActionLabel ? task.historyActionLabel : getModuleHistoryActionLabel(actionId, null, task && task.hadAiCasesBeforeAction),
        summaryText: failureLabel,
        moduleCount: 0,
        details: [],
        resultKind: errorInfo.resultKind,
        reasonText: errorInfo.reasonText,
        diagnostics: errorInfo.diagnostics,
        previewText: errorInfo.previewText,
      });
      if (opts.resultKind === 'cancelled') {
        if (!shouldSuppressTaskCancelToast(task)) {
          notifyFloatingStatus('已中断当前 XMind 生成任务', 'warn', 3000);
        }
      } else {
        notifyStatus(failureLabel, 'err', { forceInline: true });
      }
      if (isDrawerOpen()) queueTerminalMindRender({ reason: opts.renderReason || 'module-task-error', persist: false, anchorNodeId: anchorNodeId });
      persistManagedTaskWorkspaceState(true);
      return false;
    }

    function buildDedupeHistoryDetails(result) {
      return (result && Array.isArray(result.modules) ? result.modules : []).map(function(item) {
        return {
          module: normalizeModuleTitle(item && item.module ? item.module : ''),
          caseCount: Number(item && item.afterCount || 0) || 0,
        };
      }).filter(function(item) {
        return Boolean(item && item.module);
      });
    }

    function buildDedupeDetailMap(result) {
      var map = {};
      buildDedupeHistoryDetails(result).forEach(function(item) {
        var key = normalizeModuleKey(item.module || '') || ('module-' + String(Object.keys(map).length + 1));
        map[key] = {
          module: item.module || '未命名模块',
          caseCount: Number(item.caseCount || 0) || 0,
        };
      });
      return map;
    }

    function completeDedupeTaskSuccess(task) {
      var dedupeCoreApi = getXmindCaseDedupeCoreApi();
      if (!dedupeCoreApi || typeof dedupeCoreApi.normalizeDedupeResult !== 'function') {
        throw new Error('AI 用例去重能力未就绪，请刷新后重试');
      }
      var dedupeMode = normalizeDedupeMode(task && task.dedupeMode);
      var result = dedupeCoreApi.normalizeDedupeResult(
        task && task.resultRaw ? task.resultRaw : '',
        task && Array.isArray(task.dedupeModules) ? task.dedupeModules : [],
        { dedupeMode: dedupeMode }
      );
      var diagnostics = normalizeHistoryDiagnostics(result && result.diagnostics ? result.diagnostics : []);
      var removedCount = Number(result && result.removedCount || 0) || 0;
      var executionSummary = getDedupeExecutionDiagnosticText(removedCount, dedupeMode);
      diagnostics = normalizeHistoryDiagnostics(diagnostics.concat(executionSummary));
      (result && Array.isArray(result.modules) ? result.modules : []).forEach(function(item) {
        var moduleId = item && item.moduleId ? String(item.moduleId || '') : '';
        if (!moduleId) {
          diagnostics.push('模块「' + normalizeModuleTitle(item && item.module ? item.module : '') + '」缺少模块标识，已跳过回写');
          return;
        }
        var moduleTitle = normalizeModuleTitle(item && item.module ? item.module : '');
        var nextCases = (Array.isArray(item && item.cases) ? item.cases : []).map(function(caseItem) {
          return normalizeCaseItem(caseItem, moduleTitle);
        }).filter(Boolean);
        commitCaseList(moduleId, nextCases, Number(task && task.durationMs || 0), '', '');
        var moduleState = ensureModuleUiState(moduleId);
        if (moduleState) {
          moduleState.running = false;
          moduleState.taskId = '';
          moduleState.status = '';
          moduleState.error = '';
          moduleState.hideResults = false;
          clearModuleTopupHighlight(moduleState);
          moduleState.updatedAt = Date.now();
        }
      });
      diagnostics = normalizeHistoryDiagnostics(diagnostics);
      var dedupeRecords = normalizeHistoryDedupeRecords(result && result.removedCases ? result.removedCases : []);

      var dedupeState = ensureDedupeUiState();
      dedupeState.lastResult = {
        status: 'done',
        source: task && task.dedupeSource ? String(task.dedupeSource || '') : 'manual-toolbar',
        dedupeMode: dedupeMode,
        beforeCount: Number(result && result.beforeCount || 0) || 0,
        afterCount: Number(result && result.afterCount || 0) || 0,
        removedCount: Number(result && result.removedCount || 0) || 0,
        moduleCount: result && Array.isArray(result.modules) ? result.modules.length : 0,
        diagnostics: diagnostics,
        dedupeRecords: dedupeRecords,
        updatedAt: Date.now(),
      };
      scheduleDedupeTerminalVisualState(task);
      clearDedupeRunningState('');
      clearDeleteHistoryStacks();
      saveActiveWorkspaceSnapshot({
        forceShared: true,
        skipSummaryDraftSync: true,
        skipViewStateCapture: true,
      });
      renderWorkspaceTabs();
      syncCasesGenPageRender();

      if (task && task.rootPipelineId) {
        updateRootPipelineState(function(current) {
          current.stage = 'modules';
          current.dedupeStatus = 'done';
          current.dedupeTaskId = String(task.id || '');
          current.dedupeMode = dedupeMode;
          current.dedupeBeforeCount = Number(result && result.beforeCount || 0) || 0;
          current.dedupeAfterCount = Number(result && result.afterCount || 0) || 0;
          current.dedupeRemovedCount = Number(result && result.removedCount || 0) || 0;
          current.dedupeError = '';
          current.dedupeRecords = dedupeRecords;
          current.addedCases = Number(result && result.afterCount || current.addedCases || 0) || 0;
          current.detailMap = buildDedupeDetailMap(result);
          appendRootPipelineDiagnostics(current, diagnostics);
        });
      } else if (!(task && task.historySuppressed === true)) {
        recordGenerationHistory({
          scope: 'root',
          actionId: DEDUPE_ACTION_ID,
          actionLabel: 'AI用例去重',
          summaryText: executionSummary,
          moduleCount: result && Array.isArray(result.modules) ? result.modules.length : 0,
          details: buildDedupeHistoryDetails(result),
          resultKind: removedCount > 0 ? 'changed' : 'no-change',
          reasonText: removedCount > 0 ? '' : '模型未发现明显重复或高度重叠用例',
          diagnostics: diagnostics,
          dedupeRecords: dedupeRecords,
        });
        if (!(task && task.notifySuppressed === true)) {
          notifyStatus(
            executionSummary,
            removedCount > 0 ? 'ok' : 'warn',
            { forceInline: true }
          );
        }
      }

      if (isDrawerOpen()) {
        queueTerminalMindRender({
          reason: task && task.rootPipelineId ? 'root-pipeline-dedupe-committed' : 'manual-dedupe-committed',
          persist: false,
          anchorNodeId: getRootNodeId(),
        });
      }
      syncTerminalTaskRestoreContext(task);
      persistManagedTaskWorkspaceState(true);
      return true;
    }

    function completeDedupeTaskError(task, err, options) {
      var opts = options || {};
      var resultKind = opts.resultKind === 'cancelled' ? 'cancelled' : 'error';
      var errorInfo = resultKind === 'cancelled'
        ? buildGenerationCancelledInfo(task)
        : buildGenerationErrorInfo(new Error(getTaskErrorMessage(task, err)));
      var errorText = resultKind === 'cancelled' ? errorInfo.reasonText : errorInfo.reasonText;
      var diagnostics = normalizeHistoryDiagnostics(errorInfo.diagnostics || []);
      var stateMessage = resultKind === 'cancelled' ? '' : errorText;
      var dedupeMode = normalizeDedupeMode(task && task.dedupeMode);
      var dedupeState = ensureDedupeUiState();
      dedupeState.lastResult = {
        status: resultKind,
        source: task && task.dedupeSource ? String(task.dedupeSource || '') : 'manual-toolbar',
        dedupeMode: dedupeMode,
        beforeCount: Number(task && task.dedupeBeforeCount || 0) || 0,
        afterCount: Number(task && task.dedupeBeforeCount || 0) || 0,
        removedCount: 0,
        moduleCount: task && Array.isArray(task.dedupeModules) ? task.dedupeModules.length : 0,
        diagnostics: diagnostics,
        error: errorText,
        updatedAt: Date.now(),
      };
      clearDedupeRunningState(stateMessage);

      if (task && task.rootPipelineId) {
        updateRootPipelineState(function(current) {
          current.stage = 'modules';
          current.dedupeStatus = resultKind;
          current.dedupeTaskId = String(task.id || '');
          current.dedupeMode = dedupeMode;
          current.dedupeBeforeCount = Number(task && task.dedupeBeforeCount || current.dedupeBeforeCount || 0) || 0;
          current.dedupeAfterCount = current.dedupeBeforeCount;
          current.dedupeRemovedCount = 0;
          current.dedupeError = errorText;
          appendRootPipelineDiagnostics(current, (resultKind === 'cancelled'
            ? ['AI 用例去重已中断，已保留原结果']
            : ['AI 用例去重失败：' + errorText, 'AI 用例去重失败，已保留原结果']
          ).concat(diagnostics));
        });
      } else if (!(task && task.historySuppressed === true)) {
        recordGenerationHistory({
          scope: 'root',
          actionId: DEDUPE_ACTION_ID,
          actionLabel: 'AI用例去重',
          summaryText: resultKind === 'cancelled' ? 'AI 用例去重已中断' : 'AI 用例去重失败',
          moduleCount: 0,
          details: [],
          resultKind: resultKind,
          reasonText: errorText,
          diagnostics: diagnostics,
          previewText: errorInfo.previewText,
        });
        if (resultKind === 'cancelled') {
          if (!shouldSuppressTaskCancelToast(task)) {
            notifyFloatingStatus('AI 用例去重已中断，已保留原结果', 'warn', 3000);
          }
        } else if (!(task && task.notifySuppressed === true)) {
          notifyStatus('AI 用例去重失败，已保留原结果', 'err', { forceInline: true });
        }
      }

      if (isDrawerOpen()) {
        queueTerminalMindRender({
          reason: resultKind === 'cancelled' ? 'dedupe-task-cancelled' : 'dedupe-task-error',
          persist: false,
          anchorNodeId: getRootNodeId(),
        });
      }
      syncTerminalTaskRestoreContext(task);
      persistManagedTaskWorkspaceState(true);
      return false;
    }

    function completeCoverageTaskSuccess(task) {
      var coverageCoreApi = getXmindRequirementCoverageCoreApi();
      if (!coverageCoreApi || typeof coverageCoreApi.normalizeCoverageResult !== 'function') {
        throw new Error('需求覆盖分析能力未就绪，请刷新后重试');
      }
      var request = task && task.coverageRequest && typeof task.coverageRequest === 'object'
        ? task.coverageRequest
        : {};
      var result = coverageCoreApi.normalizeCoverageResult(task && task.resultRaw ? task.resultRaw : '', request);
      var coverageState = ensureCoverageUiState();
      coverageState.result = result;
      coverageState.signature = String(result && result.signature ? result.signature : task && task.coverageSignature ? task.coverageSignature : '');
      coverageState.selectedSegmentId = String(result && result.selectedSegmentId ? result.selectedSegmentId : '');
      coverageState.running = false;
      coverageState.taskId = '';
      coverageState.status = 'done';
      coverageState.error = '';
      coverageState.updatedAt = Date.now();
      coverageHighlightedCaseId = '';
      if (summaryDialogOpen === true && summaryDialogMode === 'coverage') {
        renderCoverageDialog();
      }
      notifyStatus('需求覆盖分析完成', 'ok', { forceInline: true });
      syncTerminalTaskRestoreContext(task);
      persistManagedTaskWorkspaceState(true);
      return true;
    }

    function completeCoverageTaskError(task, err, options) {
      var opts = options || {};
      var resultKind = opts.resultKind === 'cancelled' ? 'cancelled' : 'error';
      var errorInfo = resultKind === 'cancelled'
        ? buildGenerationCancelledInfo(task)
        : buildGenerationErrorInfo(new Error(getTaskErrorMessage(task, err)));
      var errorText = resultKind === 'cancelled' ? errorInfo.reasonText : errorInfo.reasonText;
      clearCoverageRunningState(resultKind, resultKind === 'cancelled' ? '' : errorText);
      if (summaryDialogOpen === true && summaryDialogMode === 'coverage') {
        renderCoverageDialog();
      }
      if (resultKind === 'cancelled') {
        if (!shouldSuppressTaskCancelToast(task)) {
          notifyFloatingStatus('需求覆盖分析已中断', 'warn', 3000);
        }
      } else {
        notifyStatus('需求覆盖分析失败：' + errorText, 'err', { forceInline: true });
      }
      syncTerminalTaskRestoreContext(task);
      persistManagedTaskWorkspaceState(true);
      return false;
    }

    function runInWorkspaceContextNow(workspaceId, handler) {
      var targetId = String(workspaceId || '');
      var shouldUseShadow = shouldUseShadowWorkspaceContext(targetId);
      if (!targetId || !shouldUseShadow) {
        return Promise.resolve().then(function() {
          return handler(false);
        });
      }
      var host = ensureWorkspaceHostState();
      var sharedWorkspaces = host.workspaces;
      var orderSnapshot = host.workspaceOrder.slice();
      var nextWorkspaceSeq = Number(host.nextWorkspaceSeq || 1);
      var openButtonDotVisible = host.openButtonDotVisible === true;
      var previousId = String(host.activeWorkspaceId || '');
      var previousMirrorId = String(host.mirrorWorkspaceId || previousId || '');
      var previousSnapshot = null;
      var previousLiveSharedSnapshot = null;
      var liveOwnedByXmind = shouldXmindOwnLiveWorkspaceState();
      if (!liveOwnedByXmind) {
        previousLiveSharedSnapshot = buildCurrentSharedWorkspaceSnapshot();
      }
      if (liveOwnedByXmind && previousId && host.workspaces[previousId]) {
        previousSnapshot = createWorkspaceSnapshotFromCurrent();
        saveActiveWorkspaceSnapshot({
          skipSummaryDraftSync: true,
          skipViewStateCapture: true,
          overrideViewState: previousSnapshot && previousSnapshot.xmind
            ? previousSnapshot.xmind.viewState
            : null,
        });
      }
      var targetRecord = ensureWorkspaceRecordForTask(targetId);
      if (!targetRecord) {
        return Promise.resolve().then(function() {
          return handler(false);
        });
      }
      workspaceShadowDepth += 1;
      workspaceUiMutedDepth += 1;
      try {
        host.activeWorkspaceId = targetId;
        host.mirrorWorkspaceId = previousMirrorId;
        applySharedWorkspaceSnapshot(targetRecord.snapshot && targetRecord.snapshot.shared ? targetRecord.snapshot.shared : null, {
          silentDom: true,
        });
        applyActiveXmindStateSnapshot(targetRecord.snapshot && targetRecord.snapshot.xmind ? targetRecord.snapshot.xmind : null);
        getWorkspaceHostState().activeWorkspaceId = targetId;
        getWorkspaceHostState().mirrorWorkspaceId = previousMirrorId;
        getWorkspaceHostState().workspaceOrder = orderSnapshot.slice();
        getWorkspaceHostState().workspaces = sharedWorkspaces;
        getWorkspaceHostState().nextWorkspaceSeq = nextWorkspaceSeq;
        getWorkspaceHostState().openButtonDotVisible = openButtonDotVisible;
      } catch (switchErr) {
        workspaceUiMutedDepth -= 1;
        workspaceShadowDepth -= 1;
        throw switchErr;
      }
      return Promise.resolve()
        .then(function() {
          return handler(true);
        })
        .finally(function() {
          saveActiveWorkspaceSnapshot();
          var restoreHost = ensureWorkspaceHostState();
          var restoreWorkspaces = restoreHost.workspaces;
          var restoreSeq = Number(restoreHost.nextWorkspaceSeq || 1);
          if (!Number.isFinite(restoreSeq) || restoreSeq < nextWorkspaceSeq) restoreSeq = nextWorkspaceSeq;
          if (previousId && restoreWorkspaces[previousId]) {
            var previousRecord = restoreWorkspaces[previousId];
            var previousRecordSnapshot = normalizeWorkspaceSnapshot(previousRecord && previousRecord.snapshot ? previousRecord.snapshot : null);
            applySharedWorkspaceSnapshot(
              liveOwnedByXmind
                ? previousRecordSnapshot.shared
                : previousLiveSharedSnapshot,
              { silentDom: true }
            );
            applyActiveXmindStateSnapshot(previousRecordSnapshot.xmind);
            var restoredHost = getWorkspaceHostState();
            restoredHost.activeWorkspaceId = previousId;
            restoredHost.mirrorWorkspaceId = previousMirrorId;
            restoredHost.workspaceOrder = orderSnapshot.slice();
            restoredHost.workspaces = restoreWorkspaces;
            restoredHost.nextWorkspaceSeq = restoreSeq;
            restoredHost.openButtonDotVisible = state.xmindCaseGen && state.xmindCaseGen.openButtonDotVisible === true;
          } else {
            var emptyRestoreHost = getWorkspaceHostState();
            emptyRestoreHost.activeWorkspaceId = '';
            emptyRestoreHost.mirrorWorkspaceId = previousMirrorId;
            emptyRestoreHost.workspaceOrder = orderSnapshot.slice();
            emptyRestoreHost.workspaces = restoreWorkspaces;
            emptyRestoreHost.nextWorkspaceSeq = restoreSeq;
            emptyRestoreHost.openButtonDotVisible = state.xmindCaseGen && state.xmindCaseGen.openButtonDotVisible === true;
            shadowWorkspaceSharedState = null;
          }
          workspaceUiMutedDepth -= 1;
          workspaceShadowDepth -= 1;
          shadowWorkspaceSharedState = null;
          renderWorkspaceTabs();
          updateSummary();
          persistWorkflowStateNow();
          if (workspaceShadowDepth <= 0) {
            if (!isDrawerOpen()) {
              flushDeferredCasesGenPageRender();
            }
            scheduleManagedTaskReconcile('workspace-context-finished');
          }
        });
    }

    function runInWorkspaceContext(workspaceId, handler) {
      var targetId = String(workspaceId || '');
      var queued = workspaceContextQueue.catch(function() {
        return null;
      }).then(function() {
        return runInWorkspaceContextNow(targetId, handler);
      });
      workspaceContextQueue = queued.then(function() {
        return null;
      }, function() {
        return null;
      });
      return queued;
    }

    function consumeManagedXmindTask(task) {
      if (!task || !task.id || !isManagedTaskTerminal(task)) return Promise.resolve(false);
      if (xmindTaskProcessingMap[task.id]) return xmindTaskProcessingMap[task.id];
      var promise = runInWorkspaceContext(getTaskWorkspaceId(task), function() {
        return Promise.resolve()
          .then(function() {
            restoreWorkflowContextFromManagedTasks([task]);
            if (task.scope === 'dedupe') {
              showTerminalDedupeRunningState(task);
              return waitForDedupeMinVisibleDuration(task);
            }
            return null;
          })
          .then(function() {
            if (task.status === 'done') {
              if (task.scope === 'coverage') return completeCoverageTaskSuccess(task);
              if (task.scope === 'dedupe') return completeDedupeTaskSuccess(task);
              if (task.scope === 'root') return completeRootTaskSuccess(task);
              return completeModuleTaskSuccess(task);
            }
            if (task.status === 'cancelled') {
              if (task.scope === 'coverage') return completeCoverageTaskError(task, null, { resultKind: 'cancelled', renderReason: 'coverage-task-cancelled' });
              if (task.scope === 'dedupe') return completeDedupeTaskError(task, null, { resultKind: 'cancelled', renderReason: 'dedupe-task-cancelled' });
              if (task.scope === 'root') return completeRootTaskError(task, null, { resultKind: 'cancelled', renderReason: 'root-task-cancelled' });
              return completeModuleTaskError(task, null, { resultKind: 'cancelled', renderReason: 'module-task-cancelled' });
            }
            if (task.scope === 'coverage') return completeCoverageTaskError(task, null, { renderReason: 'coverage-task-error' });
            if (task.scope === 'dedupe') return completeDedupeTaskError(task, null, { renderReason: 'dedupe-task-error' });
            if (task.scope === 'root') return completeRootTaskError(task, null, { renderReason: 'root-task-error' });
            return completeModuleTaskError(task, null, { renderReason: 'module-task-error' });
          })
          .catch(function(err) {
            if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
              console.error('XMind managed task consume failed', {
                taskId: task && task.id ? String(task.id || '') : '',
                scope: task && task.scope ? String(task.scope || '') : '',
                actionId: task && task.actionId ? String(task.actionId || '') : '',
                workspaceId: getTaskWorkspaceId(task),
                error: err && err.stack ? String(err.stack || '') : String(err && err.message ? err.message : err || ''),
              });
            }
            if (task.scope === 'coverage') return completeCoverageTaskError(task, err, { renderReason: 'coverage-task-consume-error' });
            if (task.scope === 'dedupe') return completeDedupeTaskError(task, err, { renderReason: 'dedupe-task-consume-error' });
            if (task.scope === 'root') return completeRootTaskError(task, err, { renderReason: 'root-task-consume-error' });
            return completeModuleTaskError(task, err, { renderReason: 'module-task-consume-error' });
          });
      })
        .finally(async function() {
          var manager = getXmindTaskManager();
          if (manager && typeof manager.clearTask === 'function') {
            manager.clearTask(task.id, 'handled');
          }
          delete xmindTaskProcessingMap[task.id];
          await runInWorkspaceContext(getTaskWorkspaceId(task), async function() {
            if (task && task.rootPipelineId) {
              await pumpRootPipelineModuleQueue(String(task.rootPipelineId || ''), {
                workspaceId: getTaskWorkspaceId(task),
              });
              finalizeRootPipelineIfReady(String(task.rootPipelineId || ''), {
                anchorNodeId: getManagedTaskAnchorNodeId(task, null),
              });
            }
          });
          syncManagedRunningUiState({
            tasks: listManagedXmindTasks(),
            render: false,
            reason: 'task-consumed',
            persist: true,
          });
          // 终态任务消费期间，其他 workspace 可能已经出现新的 terminal task；
          // 补一次 reconcile，避免它们被卡在“已准备”而没有继续推进。
          scheduleManagedTaskReconcile('task-consumed-followup');
        });
      xmindTaskProcessingMap[task.id] = promise;
      return promise;
    }

    function consumeManagedTerminalTasks(tasks, preferredTask) {
      var pending = [];
      var seen = {};

      function enqueue(task) {
        var taskId = task && task.id ? String(task.id || '') : '';
        if (!taskId || seen[taskId] || !isManagedTaskTerminal(task)) return;
        seen[taskId] = true;
        pending.push(task);
      }

      enqueue(preferredTask);
      (Array.isArray(tasks) ? tasks : []).forEach(enqueue);
      pending.forEach(function(task) {
        consumeManagedXmindTask(task);
      });
      return pending.length;
    }

    function reconcileManagedXmindTasks(options) {
      var opts = options || {};
      var manager = getXmindTaskManager();
      if (!manager) {
        syncInterruptButton();
        return;
      }
      var tasks = listManagedXmindTasks();
      if (opts.resume === true && opts.reason === 'workflow-ready') {
        markRunningTaskRestoreContextsRestoredAfterRefresh();
        tasks = listManagedXmindTasks();
      }
      restoreWorkflowContextFromManagedTasks(tasks, {
        markRestoredAfterRefresh: opts.resume === true && opts.reason === 'workflow-ready',
      });
      if (opts.resume !== false && typeof manager.resumeTasks === 'function') {
        manager.resumeTasks({ force: true });
        tasks = listManagedXmindTasks();
      }
      syncManagedRunningUiState({
        tasks: tasks,
        render: opts.render === true && isDrawerOpen(),
        reason: opts.reason || 'task-reconcile',
        persist: opts.persist === true,
      });
      var terminalTasks = tasks.filter(isManagedTaskTerminal);
      consumeManagedTerminalTasks(terminalTasks, null);
      var pipeline = getRootPipelineState();
      if (pipeline && pipeline.id && terminalTasks.length <= 0) {
        pumpRootPipelineModuleQueue(String(pipeline.id || ''), {
          workspaceId: getActiveWorkspaceId(),
        }).then(function() {
          finalizeRootPipelineIfReady(String(pipeline.id || ''), { anchorNodeId: getRootNodeId() });
        });
      }
    }

    function bindManagedXmindTasks() {
      if (xmindTaskListenerBound === true) return;
      if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
      window.addEventListener('xmind-casegen-task', function(event) {
        var detail = event && event.detail ? event.detail : {};
        var task = detail && detail.task ? detail.task : null;
        var action = detail && detail.action ? String(detail.action || '') : '';
        var tasks = detail && Array.isArray(detail.tasks) ? detail.tasks : listManagedXmindTasks();
        if (workspaceShadowDepth > 0) {
          scheduleManagedTaskReconcile('task-event-' + (action || 'update'));
          return;
        }
        var isTerminalEventTask = Boolean(task && isManagedTaskTerminal(task));
        var shouldSkipRender = isTerminalEventTask || action === 'handled' || action === 'clear' || action === 'context';
        if (isTerminalEventTask) {
          consumeManagedTerminalTasks(tasks, task);
          return;
        }
        if (action !== 'heartbeat') {
          syncManagedRunningUiState({
            tasks: tasks,
            render: isDrawerOpen() && !shouldSkipRender,
            reason: 'task-event-' + (action || 'update'),
            persist: action === 'start' || action === 'cancel' || action === 'done' || action === 'error' || action === 'suspend' || action === 'retry',
            anchorNodeId: task ? getManagedTaskAnchorNodeId(task, null) : '',
          });
        } else {
          syncInterruptButton();
        }
        if (!task) {
          consumeManagedTerminalTasks(tasks, null);
        }
      });
      xmindTaskListenerBound = true;
    }

    function interruptRunningXmindTasks() {
      var manager = getXmindTaskManager();
      if (!manager || typeof manager.cancelTask !== 'function') {
        notifyFloatingStatus('中断能力未就绪，请刷新后重试', 'err', 5000);
        return false;
      }
      var currentWorkspaceId = getActiveWorkspaceId();
      var runningTasks = filterTasksByWorkspace(listManagedXmindTasks(), currentWorkspaceId).filter(function(task) {
        return task && task.status === 'running';
      });
      var pipeline = getRootPipelineState();
      var interruptedCount = 0;
      runningTasks.forEach(function(task) {
        if (!task || !task.id) return;
        if (manager.cancelTask(task.id, {
          reason: '已手动中断当前 XMind 生成任务',
          source: 'toolbar',
          abortReason: 'xmind-casegen-cancelled',
        })) {
          interruptedCount += 1;
        }
      });
      if (pipeline && pipeline.id) {
        updateRootPipelineState(function(current) {
          current.cancelled = true;
          current.cancelReason = '已手动中断当前 XMind 生成任务';
          current.pendingQueue = [];
        });
      }
      if (interruptedCount <= 0) {
        syncManagedRunningUiState({
          tasks: listManagedXmindTasks(),
          render: isDrawerOpen(),
          reason: 'task-cancel-none',
          persist: true,
        });
        if (pipeline && Array.isArray(pipeline.pendingQueue) && pipeline.pendingQueue.length > 0) {
          finalizeRootPipelineIfReady(String(pipeline.id || ''), { anchorNodeId: getRootNodeId() });
          notifyFloatingStatus('已中断当前 XMind 生成任务', 'warn', 3000);
          return true;
        }
        notifyFloatingStatus('当前没有可中断的生成任务', 'warn', 3000);
        return false;
      }
      syncManagedRunningUiState({
        tasks: listManagedXmindTasks(),
        render: isDrawerOpen(),
        reason: 'task-cancel-all',
        persist: true,
      });
      notifyFloatingStatus('已中断 ' + String(interruptedCount) + ' 个生成任务', 'warn', 3000);
      return true;
    }

    function shouldUseRootPipeline(actionId) {
      return actionId === ROOT_ACTIONS.FULL_CASES
        || actionId === ROOT_ACTIONS.EXISTING_CASES
        || actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES
        || actionId === ROOT_ACTIONS.APPEND_ALL;
    }

    function buildRootPipelineTaskDescriptors(actionId, visibleContext) {
      var descriptors = [];
      var context = ensureVisibleModuleContext(visibleContext);
      if (actionId !== ROOT_ACTIONS.EXISTING_CASES && actionId !== ROOT_ACTIONS.APPEND_ALL) {
        return descriptors;
      }
      context.list.forEach(function(entry) {
        if (!entry) return;
        var hasVisibleCases = getVisibleCasesForModuleEntry(entry).length > 0;
        descriptors.push({
          moduleEntry: entry,
          actionId: hasVisibleCases ? MODULE_ACTIONS.APPEND : MODULE_ACTIONS.FULL_CASES,
          rootPendingActionId: actionId === ROOT_ACTIONS.EXISTING_CASES && hasVisibleCases
            ? ROOT_ACTIONS.EXISTING_CASES
            : '',
          rootPipelineNewModule: false,
        });
      });
      return descriptors;
    }

    async function startManagedModuleTask(moduleEntry, actionId, options) {
      options = options || {};
      if (!moduleEntry) return null;
      var taskWorkspaceId = String(options.workspaceId || getActiveWorkspaceId() || '');
      var anchorNodeId = Object.prototype.hasOwnProperty.call(options, 'anchorNodeId')
        ? String(options.anchorNodeId || '')
        : getModuleNodeId(moduleEntry);
      var moduleId = moduleEntry.aiModuleId || generateLocalId('xmind-mod');
      var createdModuleRecordBeforeTask = !moduleEntry.aiModuleId;
      var snapshotId = '';

      if (options.skipSnapshot !== true) {
        if (casesGenApi && typeof casesGenApi.snapshotModuleCases === 'function') {
          snapshotId = casesGenApi.snapshotModuleCases(moduleId) || '';
        } else {
          snapshotId = createCaseGenOperationSnapshotLocal('module', moduleId) || '';
        }
      }

      if (createdModuleRecordBeforeTask) {
        moduleEntry.aiModule = ensureAiModuleRecord(moduleEntry.title, {
          module: moduleEntry.title,
        }, moduleId);
        moduleEntry.aiModuleId = moduleEntry.aiModule.id;
      }

      var moduleState = ensureModuleUiState(moduleEntry.aiModuleId);
      var hadAiCasesBeforeAction = actionId === MODULE_ACTIONS.FULL_CASES && hasAiCasesForModule(moduleEntry.aiModuleId);
      var historyActionLabel = getModuleHistoryActionLabel(actionId, moduleEntry, hadAiCasesBeforeAction);
      moduleState.snapshotId = snapshotId;
      moduleState.lastAction = actionId;
      moduleState.running = true;
      moduleState.taskId = '';
      moduleState.status = '';
      moduleState.error = '';
      moduleState.updatedAt = Date.now();
      moduleState.hideResults = hadAiCasesBeforeAction;
      clearModuleTopupHighlight(moduleState);
      if (options.rootPendingActionId) {
        setModuleRootPendingAction(moduleState, options.rootPendingActionId);
      }
      var moduleRunningRenderOptions = { reason: options.renderReason || 'module-running', anchorNodeId: anchorNodeId, persist: false };
      if (
        createdModuleRecordBeforeTask
        || hadAiCasesBeforeAction
        || actionId === MODULE_ACTIONS.APPEND
        || options.rootPendingActionId
      ) {
        queueStructureMindRender(moduleRunningRenderOptions);
      } else {
        queueStatusMindRender(moduleRunningRenderOptions);
      }

      var moduleTaskMeta = {
        scope: 'module',
        workspaceId: taskWorkspaceId,
        actionId: actionId,
        moduleId: String(moduleEntry.aiModuleId || moduleId || ''),
        moduleKey: String(moduleEntry.moduleKey || ''),
        moduleTitle: normalizeModuleTitle(moduleEntry.title || ''),
        snapshotId: snapshotId,
        createdModuleBeforeAction: Object.prototype.hasOwnProperty.call(options, 'forceCreatedModuleBeforeAction')
          ? options.forceCreatedModuleBeforeAction === true
          : createdModuleRecordBeforeTask,
        hadAiCasesBeforeAction: hadAiCasesBeforeAction,
        fallbackCases: normalizeFallbackCaseList(options.fallbackCases, moduleEntry.title || ''),
        rootPipelineId: String(options.rootPipelineId || ''),
        rootPipelineActionId: String(options.rootPipelineActionId || ''),
        rootPipelineNewModule: options.rootPipelineNewModule === true,
        historySuppressed: options.historySuppressed === true,
        notifySuppressed: options.notifySuppressed === true,
      };

      try {
        var visibleContext = ensureVisibleModuleContext(buildVisibleModuleContext());
        var visibleContextMap = visibleContext.map || {};
        var resolvedEntry = visibleContextMap[moduleEntry.moduleKey] || moduleEntry;
        var contract = options.contractOverride || createOperationContract(actionId, resolvedEntry);
        if (
          String(options.rootPipelineActionId || '') === ROOT_ACTIONS.APPEND_ALL
          && options.rootPipelineNewModule !== true
          && (actionId === MODULE_ACTIONS.APPEND || actionId === MODULE_ACTIONS.FULL_CASES)
        ) {
          contract = applyImportedBaselineCompletionPolicy(contract);
        }
        if (
          String(options.rootPipelineActionId || '') === ROOT_ACTIONS.EXISTING_CASES
          && (actionId === MODULE_ACTIONS.APPEND || actionId === MODULE_ACTIONS.FULL_CASES)
        ) {
          contract = applyExistingCasesCompletionPolicy(contract);
        }
        var historyModuleTitle = normalizeModuleTitle(resolvedEntry && resolvedEntry.title ? resolvedEntry.title : moduleEntry.title);
        moduleTaskMeta.contract = cloneJson(contract, {});
        moduleTaskMeta.historyActionLabel = historyActionLabel;
        moduleTaskMeta.moduleTitle = historyModuleTitle;
        moduleTaskMeta.moduleKey = String(resolvedEntry && resolvedEntry.moduleKey ? resolvedEntry.moduleKey : moduleEntry.moduleKey || '');
        moduleTaskMeta.moduleId = String(resolvedEntry && resolvedEntry.aiModuleId ? resolvedEntry.aiModuleId : moduleEntry.aiModuleId || moduleId || '');
        var knowledgeBaseActionKey = options.knowledgeBaseActionKey
          ? String(options.knowledgeBaseActionKey || '')
          : String(options.rootPipelineId || '');
        var moduleTaskInput = await buildXmindGenerationTaskInput(contract, visibleContext, resolvedEntry, {
          workspaceId: taskWorkspaceId,
          knowledgeBaseActionKey: knowledgeBaseActionKey,
        });
        var moduleTask = startManagedXmindTask(buildModuleTaskPayload(resolvedEntry, actionId, moduleTaskInput, moduleTaskMeta));
        moduleState.taskId = String(moduleTask && moduleTask.id ? moduleTask.id : '');
        moduleState.updatedAt = Date.now();
        persistXmindState(true);
        return {
          task: moduleTask,
          moduleEntry: resolvedEntry,
          moduleState: moduleState,
        };
      } catch (err) {
        completeModuleTaskError(moduleTaskMeta, err, { renderReason: 'module-start-error' });
        return null;
      }
    }

    async function pumpRootPipelineModuleQueue(pipelineId, options) {
      var targetId = String(pipelineId || '');
      var opts = options || {};
      if (!targetId) return 0;
      if (rootPipelinePumpMap[targetId]) return rootPipelinePumpMap[targetId];
      var pumpPromise = Promise.resolve().then(async function() {
        var pipeline = getRootPipelineState();
        if (!pipeline || String(pipeline.id || '') !== targetId) return 0;
        if (pipeline.cancelled === true) {
          replaceRootPipelinePendingQueue(targetId, []);
          return 0;
        }
        var runningTasks = collectRootPipelineRunningTasks(targetId);
        if (runningTasks.length > 0) return 0;
        var visibleContext = buildVisibleModuleContext();
        while (true) {
          var nextSerialized = shiftRootPipelinePendingDescriptor(targetId);
          if (!nextSerialized) return 0;
          var descriptor = resolveRootPipelineDescriptor(nextSerialized, visibleContext);
          if (!descriptor || !descriptor.moduleEntry || !descriptor.actionId) {
            updateRootPipelineState(function(current) {
              if (String(current.id || '') !== targetId) return;
              appendRootPipelineDiagnostics(current, '有 1 个待生成模块在当前画布中已不可用，已自动跳过');
            });
            visibleContext = buildVisibleModuleContext();
            continue;
          }
          var started = await startManagedModuleTask(descriptor.moduleEntry, descriptor.actionId, {
            workspaceId: String(opts.workspaceId || getActiveWorkspaceId() || ''),
            skipSnapshot: true,
            historySuppressed: true,
            notifySuppressed: true,
            fallbackCases: normalizeFallbackCaseList(descriptor.fallbackCases, descriptor.moduleEntry && descriptor.moduleEntry.title ? descriptor.moduleEntry.title : ''),
            rootPipelineId: pipeline && pipeline.id ? pipeline.id : '',
            rootPipelineActionId: pipeline && pipeline.actionId ? pipeline.actionId : '',
            rootPipelineNewModule: descriptor.rootPipelineNewModule === true,
            rootPendingActionId: descriptor.rootPendingActionId || '',
            forceCreatedModuleBeforeAction: descriptor.forceCreatedModuleBeforeAction === true,
            anchorNodeId: Object.prototype.hasOwnProperty.call(descriptor, 'anchorNodeId')
              ? String(descriptor.anchorNodeId || '')
              : '',
            renderReason: 'root-pipeline-module-running',
          });
          if (started && started.task && started.task.id) {
            return 1;
          }
          visibleContext = buildVisibleModuleContext();
        }
      }).finally(function() {
        delete rootPipelinePumpMap[targetId];
      });
      rootPipelinePumpMap[targetId] = pumpPromise;
      return pumpPromise;
    }

    async function startRootPipelineModuleTasks(pipeline, descriptors, options) {
      var list = Array.isArray(descriptors) ? descriptors : [];
      var targetId = pipeline && pipeline.id ? String(pipeline.id || '') : '';
      var taskWorkspaceId = String(
        options && options.workspaceId
          ? options.workspaceId
          : (getActiveWorkspaceId() || '')
      );
      if (!targetId) return 0;
      replaceRootPipelinePendingQueue(targetId, []);
      var validList = list.filter(function(descriptor) {
        return Boolean(descriptor && descriptor.moduleEntry && descriptor.actionId);
      });
      if (!validList.length) return 0;
      updateRootPipelineState(function(current) {
        if (String(current.id || '') !== targetId) return;
        current.moduleTaskTotal = Math.max(normalizeRootPipelineTaskCount(current.moduleTaskTotal), validList.length);
        current.moduleTaskCompletedKeys = normalizeUniqueStringList(current.moduleTaskCompletedKeys || []);
        current.moduleTaskCompleted = Math.max(normalizeRootPipelineTaskCount(current.moduleTaskCompleted), current.moduleTaskCompletedKeys.length);
      });
      var startedResults = await runConcurrentTasks(validList, validList.length || 1, async function(descriptor) {
        return await startManagedModuleTask(descriptor.moduleEntry, descriptor.actionId, {
          workspaceId: taskWorkspaceId,
          skipSnapshot: true,
          historySuppressed: true,
          notifySuppressed: true,
          fallbackCases: normalizeFallbackCaseList(descriptor.fallbackCases, descriptor.moduleEntry && descriptor.moduleEntry.title ? descriptor.moduleEntry.title : ''),
          rootPipelineId: pipeline && pipeline.id ? pipeline.id : '',
          rootPipelineActionId: pipeline && pipeline.actionId ? pipeline.actionId : '',
          rootPipelineNewModule: descriptor.rootPipelineNewModule === true,
          rootPendingActionId: descriptor.rootPendingActionId || '',
          forceCreatedModuleBeforeAction: descriptor.forceCreatedModuleBeforeAction === true,
          anchorNodeId: Object.prototype.hasOwnProperty.call(descriptor, 'anchorNodeId')
            ? String(descriptor.anchorNodeId || '')
            : '',
          renderReason: 'root-pipeline-module-running',
        });
      });
      return (Array.isArray(startedResults) ? startedResults : []).filter(function(item) {
        return Boolean(item && item.task && item.task.id);
      }).length;
    }

    async function startRootPipeline(actionId, rootTaskMeta, visibleContext) {
      var rootState = ensureRootUiState();
      var taskWorkspaceId = String(rootTaskMeta && rootTaskMeta.workspaceId ? rootTaskMeta.workspaceId : (getActiveWorkspaceId() || ''));
      var pipeline = createRootPipelineState({
        actionId: actionId,
        snapshotId: rootTaskMeta && rootTaskMeta.snapshotId ? String(rootTaskMeta.snapshotId || '') : '',
        historyActionLabel: rootTaskMeta && rootTaskMeta.historyActionLabel ? String(rootTaskMeta.historyActionLabel || '') : '',
        hadAiContentBeforeAction: rootTaskMeta && rootTaskMeta.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: rootTaskMeta && rootTaskMeta.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: rootTaskMeta && rootTaskMeta.hadAiCasesBeforeAction === true,
        stage: 'discovering',
        discoveryStatus: 'running',
      });
      setRootPipelineState(pipeline);

      var contract = rootTaskMeta && rootTaskMeta.contract
        ? cloneJson(rootTaskMeta.contract, {})
        : createOperationContract(actionId, null);
      var rootTaskInput = await buildXmindGenerationTaskInput(contract, visibleContext, null, {
        workspaceId: taskWorkspaceId,
        knowledgeBaseActionKey: String(pipeline && pipeline.id ? pipeline.id : ''),
      });
      var rootTask = startManagedXmindTask(buildRootTaskPayload(actionId, rootTaskInput, {
        workspaceId: taskWorkspaceId,
        scope: 'root',
        actionId: actionId,
        snapshotId: rootTaskMeta && rootTaskMeta.snapshotId ? String(rootTaskMeta.snapshotId || '') : '',
        contract: cloneJson(contract, {}),
        historyActionLabel: rootTaskMeta && rootTaskMeta.historyActionLabel ? String(rootTaskMeta.historyActionLabel || '') : '',
        hadAiContentBeforeAction: rootTaskMeta && rootTaskMeta.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: rootTaskMeta && rootTaskMeta.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: rootTaskMeta && rootTaskMeta.hadAiCasesBeforeAction === true,
        rootPipelineId: pipeline.id,
        rootPipelineActionId: actionId,
        pipelineStage: 'discovery',
        historySuppressed: true,
        notifySuppressed: true,
        skipCoverageRetry: actionId !== ROOT_ACTIONS.FULL_CASES,
      }));
      rootState.taskId = String(rootTask && rootTask.id ? rootTask.id : '');
      rootState.updatedAt = Date.now();
      persistXmindState(true);
      return true;
    }

    async function runRootAction(actionId, options) {
      options = options || {};
      if (!ensureActionAllowed(actionId, null)) return false;
      if (!ensurePrepReadyOrOpen()) return false;
      var rootState = ensureRootUiState();
      var anchorNodeId = options.anchorNodeId || getRootNodeId();
      if (actionId === ROOT_ACTIONS.ROLLBACK) {
        var rolledBack = false;
        if (casesGenApi && typeof casesGenApi.rollbackAllCaseGenState === 'function') {
          rolledBack = casesGenApi.rollbackAllCaseGenState() === true;
        }
        if (!rolledBack) rolledBack = rollbackAllCaseGenStateLocal() === true;
        if (rolledBack) {
          clearAllTopupHighlights();
          rootState.running = false;
          rootState.taskId = '';
          rootState.hideAiLayer = false;
          rootState.status = '';
          rootState.error = '';
          rootState.lastAction = ROOT_ACTIONS.ROLLBACK;
          rootState.snapshotId = '';
          clearDeleteHistoryStacks();
          notifyStatus('已放弃最近一次生成', 'ok');
          render({ reason: 'root-rollback', anchorNodeId: anchorNodeId });
        }
        return rolledBack;
      }

      var shouldResetAiLayerBeforeAction = actionId === ROOT_ACTIONS.FULL_CASES
        || actionId === ROOT_ACTIONS.REGENERATE_MODULES;
      var visibleContext = shouldResetAiLayerBeforeAction
        ? buildVisibleModuleContext({ includeAiLayer: false })
        : buildVisibleModuleContext();
      var contract = createOperationContract(actionId, null);
      var currentSnapshotId = '';
      var hadAiContentBeforeAction = hasAnyAiModules();
      var hadAiLayerBeforeAction = shouldResetAiLayerBeforeAction && hasAnyAiModules();
      var hadAiCasesBeforeAction = (
        actionId === ROOT_ACTIONS.FULL_CASES
        || actionId === ROOT_ACTIONS.REGENERATE_MODULES
      ) && hasAnyAiCases();
      var historyActionLabel = getRootHistoryActionLabel(actionId, hadAiContentBeforeAction);
      var taskWorkspaceId = String(getActiveWorkspaceId() || '');
      var knowledgeBaseActionKey = generateLocalId('kb-action');
      if (casesGenApi && typeof casesGenApi.snapshotAllCaseGenState === 'function') {
        currentSnapshotId = String(casesGenApi.snapshotAllCaseGenState() || '');
      }
      if (!currentSnapshotId) currentSnapshotId = snapshotAllCaseGenStateLocal();
      rootState.snapshotId = String(currentSnapshotId || ensureState().rootSnapshotId || '');
      rootState.lastAction = actionId;
      rootState.running = true;
      rootState.taskId = '';
      rootState.hideAiLayer = hadAiLayerBeforeAction;
      rootState.status = '';
      rootState.error = '';
      rootState.updatedAt = Date.now();
      clearAllTopupHighlights();
      if (actionId === ROOT_ACTIONS.EXISTING_CASES) {
        markRootPendingModules(visibleContext.list, actionId);
      }
      if (hadAiCasesBeforeAction) setAllModuleResultsVisibility(false);
      var rootRunningRenderOptions = { reason: 'root-running', anchorNodeId: anchorNodeId, persist: false };
      if (
        hadAiLayerBeforeAction
        || hadAiCasesBeforeAction
        || actionId === ROOT_ACTIONS.EXISTING_CASES
        || actionId === ROOT_ACTIONS.TOPUP_MODULES
        || actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES
      ) {
        queueStructureMindRender(rootRunningRenderOptions);
      } else {
        queueStatusMindRender(rootRunningRenderOptions);
      }
      var rootTaskMeta = {
        scope: 'root',
        workspaceId: taskWorkspaceId,
        actionId: actionId,
        snapshotId: currentSnapshotId,
        contract: cloneJson(contract, {}),
        historyActionLabel: historyActionLabel,
        hadAiContentBeforeAction: hadAiContentBeforeAction,
        hadAiLayerBeforeAction: hadAiLayerBeforeAction,
        hadAiCasesBeforeAction: hadAiCasesBeforeAction,
      };

      try {
        if (shouldUseRootPipeline(actionId)) {
          return await startRootPipeline(actionId, rootTaskMeta, visibleContext);
        }
        var rootTaskInput = await buildXmindGenerationTaskInput(contract, visibleContext, null, {
          workspaceId: taskWorkspaceId,
          knowledgeBaseActionKey: knowledgeBaseActionKey,
        });
        var rootTask = startManagedXmindTask(buildRootTaskPayload(actionId, rootTaskInput, rootTaskMeta));
        rootState.taskId = String(rootTask && rootTask.id ? rootTask.id : '');
        rootState.updatedAt = Date.now();
        persistXmindState(true);
        return true;
      } catch (err) {
        clearRootPipelineState();
        return completeRootTaskError(rootTaskMeta, err, { renderReason: 'root-start-error' });
      }
    }

    async function runModuleAction(moduleEntry, actionId, options) {
      options = options || {};
      if (!moduleEntry) return false;
      if (!ensureActionAllowed(actionId, moduleEntry)) return false;
      if (!ensurePrepReadyOrOpen()) return false;

      if (actionId === MODULE_ACTIONS.ROLLBACK) {
        var anchorNodeId = options.anchorNodeId || getModuleNodeId(moduleEntry);
        if (moduleEntry.aiModuleId) {
          var rolledBack = false;
          if (casesGenApi && typeof casesGenApi.rollbackModuleCases === 'function') {
            rolledBack = casesGenApi.rollbackModuleCases(moduleEntry.aiModuleId) === true;
          } else {
            var latestLocalOperation = getLatestCaseGenOperationSnapshotLocal();
            if (
              latestLocalOperation
              && latestLocalOperation.scope === 'module'
              && String(latestLocalOperation.moduleId || '') === String(moduleEntry.aiModuleId || '')
            ) {
              rolledBack = rollbackCaseGenOperationSnapshotLocal(String(latestLocalOperation.id || '')) === true;
            }
          }
          if (rolledBack) {
            var rolledState = ensureModuleUiState(moduleEntry.aiModuleId);
            if (rolledState) rolledState.taskId = '';
            clearModuleTopupHighlight(rolledState);
            clearDeleteHistoryStacks();
            notifyStatus('已放弃该模块最近一次生成', 'ok');
            render({ reason: 'module-rollback', anchorNodeId: anchorNodeId });
          }
          return rolledBack;
        }
        return false;
      }
      var started = await startManagedModuleTask(moduleEntry, actionId, {
        renderReason: 'module-running',
        anchorNodeId: options.anchorNodeId || getModuleNodeId(moduleEntry),
        knowledgeBaseActionKey: generateLocalId('kb-action'),
      });
      return Boolean(started && started.task && started.task.id);
    }

    function handleNodeAction(actionId, nodeMeta) {
      if (!actionId) return false;
      hideOpenMindContextMenu();
      if (isDeleteActionId(actionId)) {
        handleDeleteSelection(nodeMeta);
        return true;
      }
      var meta = nodeMeta && nodeMeta.meta ? nodeMeta.meta : {};
      if (meta.type === 'root') {
        runRootAction(actionId, {
          anchorNodeId: nodeMeta && nodeMeta.nodeId ? String(nodeMeta.nodeId) : getRootNodeId(),
        });
        return true;
      }
      if (meta.type === 'module') {
        runModuleAction(resolveModuleEntryByMeta(meta), actionId, {
          anchorNodeId: nodeMeta && nodeMeta.nodeId ? String(nodeMeta.nodeId) : getModuleNodeId(resolveModuleEntryByMeta(meta)),
        });
        return true;
      }
      return false;
    }

    function buildStoreValidationMessage(validation) {
      var parts = [];
      var missingCount = Array.isArray(validation && validation.missingModules) ? validation.missingModules.length : 0;
      var invalidCount = Array.isArray(validation && validation.invalidCaseKeys) ? validation.invalidCaseKeys.length : 0;
      if (missingCount > 0) {
        parts.push('仍有 ' + String(missingCount) + ' 个模块未生成用例');
      }
      if (invalidCount > 0) {
        parts.push('有 ' + String(invalidCount) + ' 条用例格式不符合入库要求');
      }
      return parts.length ? ('请先处理后再保存入库：' + parts.join('；')) : '当前内容暂时不能入库';
    }

    function validateAndMarkStoreScope(entries) {
      var validation = validateStoreScopeEntries(entries);
      if (validation.missingModules.length || validation.invalidCaseKeys.length) {
        setStoreValidationState(
          validation.missingModules.map(function(item) { return item && item.moduleKey ? item.moduleKey : ''; }),
          validation.invalidCaseKeys
        );
        notifyFloatingStatus(buildStoreValidationMessage(validation), 'warn', 5000);
        return null;
      }
      clearStoreValidationState(true);
      return validation;
    }

    async function handleStoreToLibrary() {
      if (hasAnyRunningGenerationOperation()) {
        notifyFloatingStatus('当前仍有生成任务进行中，请等待完成后再保存入库', 'warn', 5000);
        return false;
      }
      var origin = resolveImportedBaselineOrigin();
      var usesAppendStore = origin.hasBaseline && origin.sourceType === 'case-library-select';
      var scopeEntries = usesAppendStore ? buildAiStoreScopeEntries() : buildVisibleStoreScopeEntries();
      var validation = validateAndMarkStoreScope(scopeEntries);
      if (!validation) return false;
      if (!validation.items.length) {
        notifyFloatingStatus(
          usesAppendStore ? '当前没有新增生成的用例可追加入库' : '当前没有可入库的用例，请先完成生成',
          'warn',
          5000
        );
        return false;
      }
      if (!casesGenApi) {
        notifyFloatingStatus('入库能力未就绪，请刷新后重试', 'err', 5000);
        return false;
      }
      if (!usesAppendStore) {
        if (typeof casesGenApi.openCaseGenDbStoreNewDrawerWithItems !== 'function') {
          notifyFloatingStatus('新用例入库能力未就绪，请刷新后重试', 'err', 5000);
          return false;
        }
        casesGenApi.openCaseGenDbStoreNewDrawerWithItems(validation.items, {
          newAction: resolveDefaultStoreNewAction(),
          source: 'xmind_casegen',
          workspaceId: getActiveWorkspaceId(),
        });
        return true;
      }

      if (origin.targets.length !== 1) {
        var fallbackEntries = buildVisibleStoreScopeEntries();
        var fallbackValidation = validateAndMarkStoreScope(fallbackEntries);
        if (!fallbackValidation || !fallbackValidation.items.length) return false;
        notifyFloatingStatus('当前基线来自多份用例库用例，将按新用例入库处理', 'warn', 5000);
        if (typeof casesGenApi.openCaseGenDbStoreNewDrawerWithItems !== 'function') {
          notifyFloatingStatus('新用例入库能力未就绪，请刷新后重试', 'err', 5000);
          return false;
        }
        casesGenApi.openCaseGenDbStoreNewDrawerWithItems(fallbackValidation.items, {
          newAction: resolveDefaultStoreNewAction(),
          source: 'xmind_casegen',
          workspaceId: getActiveWorkspaceId(),
        });
        return true;
      }

      var target = origin.targets[0] || {};
      var confirmed = await openStoreConfirmDialog({
        title: '确认保存入库',
        message: '当前参考用例来自用例库。确认后会把本次新增生成的用例保存到【'
          + String(target.fileName || ('用例#' + String(target.caseFileId || '')))
          + '】。',
        confirmText: '继续保存',
        cancelText: '取消',
      });
      if (!confirmed) return false;
      if (typeof casesGenApi.openCaseGenDbStoreAppendDrawerWithItems !== 'function') {
        notifyFloatingStatus('旧用例追加入库能力未就绪，请刷新后重试', 'err', 5000);
        return false;
      }
      casesGenApi.openCaseGenDbStoreAppendDrawerWithItems(validation.items, {
        source: 'xmind_casegen',
        workspaceId: getActiveWorkspaceId(),
        projectId: target.projectId,
        versionId: target.versionId,
        caseFileId: target.caseFileId,
      });
      return true;
    }

    async function exportCurrentXmind() {
      var xmindCoreApi = getXmindCoreApi();
      if (!xmindCoreApi || typeof xmindCoreApi.buildXmindPackageFromMindData !== 'function') {
        notifyStatus('当前 XMind 导出能力未就绪', 'warn', { forceInline: true });
        return false;
      }
      var mindData = currentMindData || buildMindData();
      try {
        var exported = await xmindCoreApi.buildXmindPackageFromMindData(mindData, getRequirementLabelText());
        if (core && typeof core.downloadBlob === 'function') {
          core.downloadBlob(exported.fileName, exported.blob);
        }
        notifyStatus('已导出当前 XMind：' + exported.fileName, 'ok');
        return true;
      } catch (err) {
        notifyStatus('XMind 导出失败：' + (err && err.message ? err.message : '未知错误'), 'err', { forceInline: true });
        return false;
      }
    }

    function exportCurrentMarkdown() {
      var markdownCoreApi = getXmindMarkdownExportCoreApi();
      if (!markdownCoreApi || typeof markdownCoreApi.buildMarkdownExportFromSnapshot !== 'function') {
        notifyStatus('当前 Markdown 导出能力未就绪', 'warn', { forceInline: true });
        return false;
      }
      var visibleModules = buildVisibleModuleSnapshot(buildVisibleModuleContext());
      if (!visibleModules.length) {
        notifyStatus('当前没有可导出的模块，请先完成生成', 'warn', { forceInline: true });
        return false;
      }
      var exported = null;
      try {
        exported = markdownCoreApi.buildMarkdownExportFromSnapshot({
          requirementLabel: getRequirementLabelText(),
          modules: visibleModules,
          exportedAt: Date.now(),
        });
      } catch (err) {
        notifyStatus('Markdown 导出失败：' + (err && err.message ? err.message : '未知错误'), 'err', { forceInline: true });
        return false;
      }
      if (!exported || !exported.fileName || !exported.content) {
        notifyStatus('Markdown 导出失败：导出结果无效', 'err', { forceInline: true });
        return false;
      }
      if (utils && typeof utils.downloadText === 'function') {
        utils.downloadText(exported.fileName, exported.content);
      } else if (core && typeof core.downloadBlob === 'function') {
        core.downloadBlob(exported.fileName, new Blob([exported.content], { type: 'text/markdown;charset=utf-8' }));
      } else {
        notifyStatus('当前 Markdown 下载能力未就绪', 'warn', { forceInline: true });
        return false;
      }
      notifyStatus('已导出 AI Markdown：' + exported.fileName, 'ok');
      return true;
    }

    function buildWorkspaceId(seq) {
      return 'xmind-workspace-' + String(seq || 1);
    }

    function createWorkspaceSnapshotFromCurrent(options) {
      var opts = options || {};
      if (opts.skipSummaryDraftSync !== true) {
        syncSummaryDraftIntoState();
      }
      if (workspaceShadowDepth <= 0 && opts.skipViewStateCapture !== true) {
        captureCurrentViewState();
      }
      var overrideViewState = opts.overrideViewState && typeof opts.overrideViewState === 'object'
        ? normalizeStoredViewState(opts.overrideViewState, {
          drawerOpen: opts.overrideViewState.drawerOpen === true,
          fullscreen: opts.overrideViewState.fullscreen === true,
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
      workspaceViewRestoreToken += 1;
      clearStoreValidationState(true);
      clearDrawerRestoreRetry('workspace-switch-clear-ui');
      cleanupTopupHighlightPresentation();
      destroyMind();
    }

    function switchWorkspace(workspaceId, options) {
      var opts = options || {};
      var host = ensureWorkspaceHostState();
      var targetId = String(workspaceId || '');
      if (!targetId || !host.workspaces[targetId]) return false;
      if (restoreDrawerOpenInFlight === true) {
        pendingDrawerOpenWorkspaceId = targetId;
      }
      var targetRecord = host.workspaces[targetId];
      var targetStoredViewState = getWorkspaceStoredViewState(targetId);
      var previousWorkspaceViewState = null;
      var currentVisibleViewState = null;
      var shouldRestoreTargetViewport = shouldRestoreWorkspaceViewport(targetId, targetStoredViewState);
      var targetRenderViewState = shouldRestoreTargetViewport
        ? normalizeWorkspaceRenderViewState(targetStoredViewState, { skipAnchorAlign: true })
        : null;
      var shouldCenterTargetAfterRender = opts.centerRootAfterRender === true || !shouldRestoreTargetViewport;
      var currentId = String(host.activeWorkspaceId || '');
      if (currentId && currentId !== targetId) {
        currentVisibleViewState = captureVisibleMindViewStateFromDom();
      }
      if (
        opts.skipCurrentSnapshotSave !== true
        && currentId
        && host.workspaces[currentId]
        && shouldXmindOwnLiveWorkspaceState()
      ) {
        var preservedSharedSnapshot = (
          isDrawerOpen() !== true
          && workspaceShadowDepth <= 0
          && host.workspaces[currentId].snapshot
          && host.workspaces[currentId].snapshot.shared
        )
          ? normalizeWorkspaceSharedState(host.workspaces[currentId].snapshot.shared)
          : null;
        var preservedXmindSnapshot = (
          isDrawerOpen() !== true
          && workspaceShadowDepth <= 0
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
        host.workspaces[currentId].updatedAt = Date.now();
      }
      host.activeWorkspaceId = targetId;
      host.mirrorWorkspaceId = targetId;
      clearCurrentWorkspaceUiBeforeSwitch();
      hydrateWorkspaceSnapshot(targetId, {
        keepDrawerOpen: isDrawerOpen(),
      });
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
          reason: opts.reason || 'workspace-switch',
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
        openSummaryDialog(getPrepState().step || STEP_REQUIREMENT);
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
      var opts = options || {};
      var saved = saveActiveWorkspaceSnapshot({
        forceShared: opts.forceShared !== false,
        skipSummaryDraftSync: opts.skipSummaryDraftSync === true,
        skipViewStateCapture: opts.skipViewStateCapture === true,
        overrideViewState: opts.overrideViewState && typeof opts.overrideViewState === 'object'
          ? opts.overrideViewState
          : null,
      });
      if (opts.render !== false) {
        renderWorkspaceTabs();
      }
      return saved;
    }

    function createWorkspaceAndOpenPrep() {
      var host = ensureWorkspaceHostState();
      if (host.workspaceOrder.length >= WORKSPACE_MAX) {
        notifyFloatingStatus(getWorkspaceLimitText(), 'warn', 3000);
        return false;
      }
      var adoptCurrentSnapshot = host.workspaceOrder.length === 0 && currentActiveWorkspaceHasContent();
      var initialSnapshot = adoptCurrentSnapshot
        ? createWorkspaceSnapshotFromCurrent()
        : createWorkspaceSnapshot({
          drawerOpen: true,
          fullscreen: drawerEl && drawerEl.classList
            ? drawerEl.classList.contains('xmind-drawer-fullscreen')
            : false,
        });
      if (host.activeWorkspaceId && host.workspaces[host.activeWorkspaceId]) {
        host.workspaces[host.activeWorkspaceId].snapshot = createWorkspaceSnapshotFromCurrent();
        host.workspaces[host.activeWorkspaceId].updatedAt = Date.now();
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
      if (isDrawerOpen()) {
        render({ reason: 'workspace-create', persist: false, centerRootAfterRender: true });
      } else {
        persistXmindState(true);
      }
      var record = getWorkspaceRecord(workspaceId);
      if (record) record.pendingOpenPrep = false;
      openSummaryDialog(STEP_REQUIREMENT);
      return true;
    }

    function openWorkspaceFromProgressPanel(workspaceId) {
      var targetId = String(workspaceId || '');
      clearOpenButtonCompletionNotice({ persist: true });
      if (!isDrawerOpen() && shouldSyncLegacyBeforeOpen()) {
        syncLegacyWorkflowContext({ persist: false, force: true });
      }
      if (targetId) {
        setMirrorWorkspaceSelection(targetId);
      }
      if (targetId && targetId !== getActiveWorkspaceId()) {
        if (isDrawerOpen()) {
          switchWorkspace(targetId, {
            reason: 'workspace-progress-panel-switch',
            centerRootAfterRender: false,
          });
        }
      }
      if (!isDrawerOpen()) {
        open({
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
      var opts = options || {};
      var targetId = String(workspaceId || '');
      if (hasWorkspaceRunningTasks(targetId)) {
        setDebugState({
          closeWorkspaceAction: {
            workspaceId: targetId,
            phase: 'blocked-running',
          },
        });
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
        delete currentHost.workspaces[targetId];
        currentHost.workspaceOrder.splice(currentIndex, 1);
        if (!currentHost.workspaceOrder.length) {
          currentHost.activeWorkspaceId = '';
          currentHost.mirrorWorkspaceId = '';
          clearCurrentWorkspaceUiBeforeSwitch();
          closeSummaryDialog({ skipPersist: true });
          resetWorkflowStateForXmind(isDrawerOpen(), drawerEl && drawerEl.classList
            ? drawerEl.classList.contains('xmind-drawer-fullscreen')
            : false);
          renderWorkspaceTabs();
          updateSummary();
          if (isDrawerOpen()) {
            render({ reason: 'workspace-delete-empty', persist: false });
          } else {
            persistXmindState(true);
          }
          return true;
        }
        if (wasActive) {
          var nextId = currentHost.workspaceOrder[Math.max(0, currentIndex - 1)] || currentHost.workspaceOrder[0];
          return switchWorkspace(nextId, {
            reason: 'workspace-delete-switch',
            // 关闭当前页签后切回已有页签时，应优先恢复该页签自己的视图，不再额外强制根节点居中。
            centerRootAfterRender: false,
            skipCurrentSnapshotSave: true,
          });
        }
        renderWorkspaceTabs();
        persistXmindState(true);
        return true;
      };
      var needsConfirm = opts.skipConfirm === true ? false : workspaceNeedsCloseConfirm(targetId);
      setDebugState({
        closeWorkspaceAction: {
          workspaceId: targetId,
          phase: 'before-confirm',
          needsConfirm: needsConfirm === true,
        },
      });
      if (!needsConfirm) {
        return proceed();
      }
      openStoreConfirmDialog({
        title: '关闭生成页签',
        message: getWorkspaceDeleteConfirmMessage(getWorkspaceRecord(targetId)),
        confirmText: '直接关闭',
        cancelText: '取消',
      }).then(function(confirmed) {
        if (!confirmed) return;
        proceed();
      });
      return true;
    }

    function openDrawerShell(options) {
      var opts = options || {};
      var drawer = ensureDrawer();
      if (drawer && typeof drawer.open === 'function') {
        if (deferredDrawerCloseCleanupTimer) {
          clearTimeout(deferredDrawerCloseCleanupTimer);
          deferredDrawerCloseCleanupTimer = 0;
        }
        drawerOpenedViaDomRestore = false;
        drawer.open({
          instant: opts.instant === true,
        });
        return true;
      }
      getViewState().drawerOpen = true;
      getViewState().updatedAt = Date.now();
      syncOpenButtonState();
      render({
        reason: opts.reason || 'open-shell-fallback',
        centerRootAfterRender: opts.centerRootAfterRender === true,
        skipRestorableViewState: opts.centerRootAfterRender === true,
      });
      pendingOpenCenterRoot = false;
      persistXmindState(true);
      return false;
    }

    function applyDrawerOpenLayoutState() {
      var body = document && document.body ? document.body : null;
      var root = document && document.documentElement ? document.documentElement : null;
      if (body && body.classList && !body.classList.contains('drawer-open')) {
        body.classList.add('drawer-open');
      }
      if (root && root.classList && !root.classList.contains('drawer-open')) {
        root.classList.add('drawer-open');
      }
    }

    function releaseDrawerOpenLayoutState() {
      var body = document && document.body ? document.body : null;
      var root = document && document.documentElement ? document.documentElement : null;
      var otherOpen = document && document.querySelector
        ? document.querySelector('.drawer.open:not(#xmindCaseGenDrawer), .drawer.closing:not(#xmindCaseGenDrawer)')
        : null;
      if (otherOpen) return;
      if (body && body.classList) body.classList.remove('drawer-open');
      if (root && root.classList) root.classList.remove('drawer-open');
    }

    function finalizeDrawerClosedLifecycle() {
      if (deferredDrawerCloseCleanupTimer) {
        clearTimeout(deferredDrawerCloseCleanupTimer);
        deferredDrawerCloseCleanupTimer = 0;
      }
      drawerOpenedViaDomRestore = false;
      pendingDrawerOpenWorkspaceId = '';
      if (drawerOpenRenderTimer) {
        clearTimeout(drawerOpenRenderTimer);
        drawerOpenRenderTimer = 0;
      }
      clearDrawerRestoreRetry('drawer-onclose');
      clearStoreValidationState(true);
      if (isPageSuspending()) {
        syncOpenButtonState();
        if (drawerEl && drawerEl.classList) {
          drawerEl.classList.remove('xmind-drawer-fullscreen');
        }
        destroyMind();
        return;
      }
      // 关闭 XMind 抽屉后，页面主体仍停留在 XMind 镜像视图。
      // 旧流程数据只在用户切回旧视图时再按需恢复，避免收起瞬间触发大范围旧流程重渲染。
      finalizeLegacyWorkflowRestore();
      syncOpenButtonState();
      if (drawerEl && drawerEl.classList) {
        drawerEl.classList.remove('xmind-drawer-fullscreen');
      }
      closeSummaryDialog({ skipPersist: true });
      destroyMind();
      flushDeferredCasesGenPageRender();
      persistWorkflowStateNow();
    }

    function open(options) {
      var opts = options || {};
      var wasOpen = isDrawerOpen();
      var useRestoreFastPath = opts.restoreOpening === true && !wasOpen;
      var allowManualCloseOverride = opts.userInitiated === true || opts.ignoreManualCloseSuppress === true;
      var openWorkspaceId = !wasOpen
        ? String(opts.workspaceId || getMirrorWorkspaceId() || getActiveWorkspaceId() || '')
        : '';
      var restoreViewStateBeforeOpen = useRestoreFastPath
        ? getWorkspaceStoredViewState(openWorkspaceId || getActiveWorkspaceId())
        : null;
      var restoreWasFullscreen = Boolean(
        restoreViewStateBeforeOpen
        && restoreViewStateBeforeOpen.drawerOpen === true
        && restoreViewStateBeforeOpen.fullscreen === true
      );
      if (useRestoreFastPath && allowManualCloseOverride !== true && isDrawerManualCloseSuppressed()) {
        setDebugState({
          phase: 'drawer-restore-skipped-manual-close',
        });
        return false;
      }
      if (!useRestoreFastPath) {
        markDrawerManualCloseSuppressed(0);
      }
      restoreDrawerOpenInFlight = useRestoreFastPath === true;
      if (!wasOpen && openWorkspaceId) {
        pendingDrawerOpenWorkspaceId = openWorkspaceId;
        setMirrorWorkspaceSelection(openWorkspaceId);
      } else if (!wasOpen) {
        pendingDrawerOpenWorkspaceId = String(getActiveWorkspaceId() || '');
      }
      if (!wasOpen && !useRestoreFastPath && shouldSyncLegacyBeforeOpen()) {
        syncLegacyWorkflowContext({ persist: false, force: true });
      }
      if (!wasOpen && !useRestoreFastPath) {
        captureDrawerLegacyRestoreSnapshot();
      }
      if (!wasOpen && openWorkspaceId && openWorkspaceId !== getActiveWorkspaceId()) {
        switchWorkspace(openWorkspaceId, {
          reason: useRestoreFastPath ? 'workspace-open-restore-prepare' : 'workspace-open-prepare',
          centerRootAfterRender: false,
        });
      }
      if (useRestoreFastPath && restoreWasFullscreen) {
        clearWorkspaceFullscreenRestoreIntent(openWorkspaceId || getActiveWorkspaceId());
        pendingOpenSkipRestorableViewState = true;
      } else if (!wasOpen) {
        pendingOpenSkipRestorableViewState = false;
      }
      pendingOpenForceSnapshotHydrate = opts.forceSnapshotHydrate === true;
      pendingOpenCenterRoot = !wasOpen && (restoreWasFullscreen || !shouldRestoreWorkspaceViewport(getActiveWorkspaceId()));
      pendingOpenInstant = opts.instant === true || useRestoreFastPath === true;
      clearOpenButtonCompletionNotice({ persist: false });
      switchTab('casesgen');
      if (!state.caseGenSettings || typeof state.caseGenSettings !== 'object') {
        state.caseGenSettings = createDefaultCaseGenSettings();
      }
      if (!useRestoreFastPath) {
        setCasesGenModulesView();
      } else {
        state.caseGenSettings.activeTab = 'xmind-modules';
      }
      if (!wasOpen) {
        state.caseGenSettings.activeTab = 'xmind-modules';
        hydrateActiveWorkspaceSnapshot({ keepDrawerOpen: false });
      }
      return openDrawerShell({
        instant: pendingOpenInstant === true,
        centerRootAfterRender: pendingOpenCenterRoot === true,
        reason: useRestoreFastPath ? 'restore-open-shell' : 'open-fallback',
      });
    }

    function close() {
      markDrawerManualCloseSuppressed(1800);
      restoreDrawerOpenInFlight = false;
      if (drawerOpenRenderTimer) {
        clearTimeout(drawerOpenRenderTimer);
        drawerOpenRenderTimer = 0;
      }
      clearDrawerRestoreRetry('close-api');
      if (drawerOpenedViaDomRestore === true && drawerEl && drawerEl.classList && isDrawerOpen()) {
        persistDrawerClosedIntentState(true);
        drawerEl.classList.remove('open');
        drawerEl.classList.remove('closing');
        drawerEl.classList.remove('xmind-drawer-fullscreen');
        releaseDrawerOpenLayoutState();
        syncOpenButtonState();
        if (deferredDrawerCloseCleanupTimer) {
          clearTimeout(deferredDrawerCloseCleanupTimer);
          deferredDrawerCloseCleanupTimer = 0;
        }
        deferredDrawerCloseCleanupTimer = setTimeout(function() {
          deferredDrawerCloseCleanupTimer = 0;
          finalizeDrawerClosedLifecycle();
        }, 0);
        return true;
      }
      var drawer = ensureDrawer();
      if (drawer && typeof drawer.close === 'function') {
        persistDrawerClosedIntentState(true);
        drawer.close();
        return true;
      }
      persistDrawerClosedIntentState(false);
      releaseDrawerOpenLayoutState();
      finalizeDrawerClosedLifecycle();
      persistXmindState(true);
      return false;
    }

    function isTypingLikeTarget(target) {
      if (!target) return false;
      if (target.isContentEditable) return true;
      var tag = target.tagName ? String(target.tagName).toLowerCase() : '';
      return tag === 'input' || tag === 'textarea' || tag === 'select';
    }

    function bindButtons() {
      if (openBtn) {
        openBtn.addEventListener('click', function() {
          open();
        });
      }
      if (workspaceAddBtn) {
        workspaceAddBtn.addEventListener('click', function() {
          if (workspaceAddBtn.disabled) return;
          createWorkspaceAndOpenPrep();
        });
      }
      if (workspaceListEl) {
        workspaceListEl.addEventListener('click', function(event) {
          var closeTarget = event && event.target && event.target.closest
            ? event.target.closest('[data-xmind-workspace-close]')
            : null;
          if (closeTarget) {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
            var closeId = String(closeTarget.getAttribute('data-xmind-workspace-close') || '');
            if (closeId) deleteWorkspace(closeId);
            return;
          }
          var tabTarget = event && event.target && event.target.closest
            ? event.target.closest('[data-xmind-workspace-tab]')
            : null;
          if (!tabTarget) return;
          var tabId = String(tabTarget.getAttribute('data-xmind-workspace-tab') || '');
          if (!tabId || tabId === getActiveWorkspaceId()) return;
          switchWorkspace(tabId, {
            reason: 'workspace-manual-switch',
            centerRootAfterRender: false,
          });
        });
      }
      if (summaryBtn) {
        summaryBtn.addEventListener('click', function() {
          if (summaryDialogOpen === true && summaryDialogMode === 'prep') closeSummaryDialog();
          else openSummaryDialog(getPrepState().step || STEP_REQUIREMENT);
        });
      }
      if (historyBtn) {
        historyBtn.addEventListener('click', function() {
          if (summaryDialogOpen === true && summaryDialogMode === 'history') closeSummaryDialog();
          else openHistoryDialog();
        });
      }
      if (knowledgeRuleBtn) {
        knowledgeRuleBtn.addEventListener('click', function() {
          if (summaryDialogOpen === true && summaryDialogMode === 'knowledge-base') closeSummaryDialog();
          else openKnowledgeBaseDialog();
        });
      }
      if (knowledgeAiBtn) {
        knowledgeAiBtn.addEventListener('click', function() {
          if (summaryDialogOpen === true && summaryDialogMode === 'knowledge-base') closeSummaryDialog();
          else openKnowledgeBaseDialog();
        });
      }
      if (dedupeBtn) {
        dedupeBtn.addEventListener('click', function() {
          startManualAiDedupe();
        });
      }
      if (coverageBtn) {
        coverageBtn.addEventListener('click', function() {
          if (summaryDialogOpen === true && summaryDialogMode === 'coverage') closeSummaryDialog();
          else openCoverageDialog();
        });
      }
      if (storeBtn) {
        storeBtn.addEventListener('click', function() {
          handleStoreToLibrary();
        });
      }
      if (interruptBtn) {
        interruptBtn.addEventListener('click', function() {
          interruptRunningXmindTasks();
        });
      }
      if (deleteUndoBtn) {
        deleteUndoBtn.addEventListener('click', function() {
          undoLatestDeleteSelection();
        });
      }
      if (deleteRedoBtn) {
        deleteRedoBtn.addEventListener('click', function() {
          redoLatestDeleteSelection();
        });
      }
      if (summaryCloseBtn) {
        summaryCloseBtn.addEventListener('click', function() {
          closeSummaryDialog();
        });
      }
      if (exportBtn) {
        exportBtn.addEventListener('click', function() {
          exportCurrentXmind();
        });
      }
      if (exportMarkdownBtn) {
        exportMarkdownBtn.addEventListener('click', function() {
          exportCurrentMarkdown();
        });
      }
      if (summaryDialogBodyEl) {
        summaryDialogBodyEl.addEventListener('click', function(event) {
          var coverageActionTarget = event && event.target && event.target.closest
            ? event.target.closest('[data-coverage-action]')
            : null;
          if (coverageActionTarget) {
            var coverageActionId = String(coverageActionTarget.getAttribute('data-coverage-action') || '');
            if (coverageActionId === 'reanalyze' && coverageActionTarget.disabled !== true) {
              startRequirementCoverageTask({ force: true });
              return;
            }
          }
          var coverageJumpTarget = event && event.target && event.target.closest
            ? event.target.closest('[data-coverage-jump]')
            : null;
          if (coverageJumpTarget && coverageJumpTarget.disabled !== true) {
            var coverageJumpStatus = String(coverageJumpTarget.getAttribute('data-coverage-jump') || '');
            if (coverageJumpStatus && jumpToCoverageStatus(coverageJumpStatus)) {
              return;
            }
          }
          var coverageSelectedSegmentTarget = event && event.target && event.target.closest
            ? event.target.closest('[data-coverage-selected-segment]')
            : null;
          if (coverageSelectedSegmentTarget) {
            var coverageSelectedSegmentId = String(coverageSelectedSegmentTarget.getAttribute('data-coverage-selected-segment') || '');
            if (coverageSelectedSegmentId) {
              if (event && typeof event.preventDefault === 'function') event.preventDefault();
              var selectedCoverageState = ensureCoverageUiState();
              selectedCoverageState.selectedSegmentId = coverageSelectedSegmentId;
              selectedCoverageState.updatedAt = Date.now();
              persistXmindState(false);
              renderCoverageDialog({ resetSourceScroll: true });
              scrollCoverageSourceSegmentIntoView(coverageSelectedSegmentId);
              return;
            }
          }
          var coverageSegmentTarget = event && event.target && event.target.closest
            ? event.target.closest('[data-coverage-segment]')
            : null;
          if (coverageSegmentTarget) {
            var coverageSegmentId = String(coverageSegmentTarget.getAttribute('data-coverage-segment') || '');
            if (coverageSegmentId) {
              if (event && typeof event.preventDefault === 'function') event.preventDefault();
              var coverageAnchorState = readCoverageSourceAnchorState(coverageSegmentId);
              var coverageState = ensureCoverageUiState();
              coverageState.selectedSegmentId = coverageSegmentId;
              coverageHighlightedCaseId = '';
              coverageState.updatedAt = Date.now();
              persistXmindState(false);
              renderCoverageDialog({ sourceAnchorState: coverageAnchorState });
              return;
            }
          }
          var coverageCaseTarget = event && event.target && event.target.closest
            ? event.target.closest('[data-coverage-case]')
            : null;
          if (coverageCaseTarget) {
            var coverageCaseId = String(coverageCaseTarget.getAttribute('data-coverage-case') || '');
            if (coverageCaseId) {
              coverageHighlightedCaseId = coverageCaseId;
              var coverage = ensureCoverageUiState();
              var result = coverage.result && typeof coverage.result === 'object' ? coverage.result : null;
              var matchedSegments = findCoverageSegmentsByCaseId(result, coverageCaseId);
              var currentId = String(coverage.selectedSegmentId || '');
              var hasCurrent = matchedSegments.some(function(segment) {
                return segment && String(segment.id || '') === currentId;
              });
              if (!hasCurrent && matchedSegments[0]) {
                coverage.selectedSegmentId = String(matchedSegments[0].id || coverage.selectedSegmentId || '');
              }
              coverage.updatedAt = Date.now();
              persistXmindState(false);
              renderCoverageDialog();
              return;
            }
          }
          var choiceTarget = event && event.target && event.target.closest
            ? event.target.closest('label.xmind-casegen-prep-choice')
            : null;
          if (choiceTarget) {
            var radioInput = choiceTarget.querySelector ? choiceTarget.querySelector('input[type="radio"]') : null;
            if (radioInput && radioInput.disabled !== true) {
              if (event && event.target === radioInput) return;
              if (event && typeof event.preventDefault === 'function') event.preventDefault();
              radioInput.checked = true;
              dispatchNativeChange(radioInput);
              return;
            }
          }
          var toggleTarget = event && event.target && event.target.closest
            ? event.target.closest('label.xmind-casegen-prep-toggle')
            : null;
          if (toggleTarget) {
            var toggleInput = toggleTarget.querySelector ? toggleTarget.querySelector('input[type="checkbox"][data-casegen-setting]') : null;
            if (toggleInput && toggleInput.disabled !== true) {
              if (event && event.target === toggleInput) return;
              if (event && typeof event.preventDefault === 'function') event.preventDefault();
              toggleInput.checked = toggleInput.checked !== true;
              dispatchNativeChange(toggleInput);
              return;
            }
          }
          var navTarget = event && event.target && event.target.closest
            ? event.target.closest('[data-prep-nav]')
            : null;
          if (navTarget) {
            var navId = String(navTarget.getAttribute('data-prep-nav') || '');
            if (!navId || navTarget.disabled) return;
            handlePrepNav(navId);
            return;
          }
          var actionTarget = event && event.target && event.target.closest
            ? event.target.closest('[data-prep-action]')
            : null;
          if (!actionTarget) return;
          var actionId = String(actionTarget.getAttribute('data-prep-action') || '');
          if (!actionId) return;
          if (actionId === 'import-requirement') {
            triggerRequirementImport();
            return;
          }
          if (actionId === 'import-cases') {
            triggerCasesImport();
            return;
          }
          if (actionId === 'select-cases-library') {
            triggerCasesLibrarySelect();
            return;
          }
          if (actionId === 'upload-manual-images') {
            ensureManualImageInput().click();
            return;
          }
          if (actionId === 'reset-prep') {
            requestPrepReset();
            return;
          }
          if (actionId === 'remove-manual-image') {
            var imageIndex = Number(actionTarget.getAttribute('data-image-index'));
            if (Number.isFinite(imageIndex)) {
              removeManualRequirementImage(imageIndex);
              renderOpenedSummaryDialog();
            }
          }
        });
        summaryDialogBodyEl.addEventListener('change', function(event) {
          var target = event && event.target ? event.target : null;
          if (!target) return;
          if (target.name === 'xmindRequirementMode') {
            if (isPrepBaseLocked()) {
              renderOpenedSummaryDialog();
              return;
            }
            setPrepField('requirementMode', target.value === 'manual' ? 'manual' : 'document');
            renderOpenedSummaryDialog();
            return;
          }
          if (target.name === 'xmindCaseImportMode') {
            if (isPrepBaseLocked()) {
              renderOpenedSummaryDialog();
              return;
            }
            setPrepField('caseImportMode', target.value === 'import' ? 'import' : 'skip');
            renderOpenedSummaryDialog();
            scheduleRender('case-import-mode-change');
            return;
          }
          var settingKey = target.getAttribute ? target.getAttribute('data-casegen-setting') : '';
          if (settingKey) {
            setCaseGenOption(settingKey, target.type === 'checkbox' ? target.checked === true : (target.value || ''));
            if (target.type === 'checkbox') {
              syncPrepOptionToggleDom();
            } else {
              renderOpenedSummaryDialog();
            }
          }
        });
        summaryDialogBodyEl.addEventListener('input', function(event) {
          var target = event && event.target ? event.target : null;
          if (!target) return;
          var prepInputKey = target.getAttribute ? target.getAttribute('data-prep-input') : '';
          if (prepInputKey === 'manualRequirementLabel') {
            setPrepField('manualRequirementLabel', target.value || '');
            return;
          }
          if (prepInputKey === 'requirementSupplement') {
            setPrepField('requirementSupplement', target.value || '');
            return;
          }
          if (target.getAttribute && target.getAttribute('data-manual-requirement-text')) {
            setManualRequirementText(target.value || '');
            return;
          }
          var settingKey = target.getAttribute ? target.getAttribute('data-casegen-setting') : '';
          if (settingKey && target.type !== 'checkbox') {
            setCaseGenOption(settingKey, target.value || '');
          }
        });
        summaryDialogBodyEl.addEventListener('paste', function(event) {
          var target = event && event.target ? event.target : null;
          if (!target || !target.getAttribute || !target.getAttribute('data-manual-requirement-text')) return;
          var clipboardData = event.clipboardData;
          var files = [];
          if (clipboardData && clipboardData.items) {
            for (var i = 0; i < clipboardData.items.length; i += 1) {
              var item = clipboardData.items[i];
              if (!item || item.kind !== 'file') continue;
              var file = item.getAsFile ? item.getAsFile() : null;
              if (!file || !(file.type || '').match(/^image\//i)) continue;
              files.push(file);
            }
          }
          if (!files.length) return;
          event.preventDefault();
          appendManualRequirementImages(files).then(function(ok) {
            if (ok) {
              notifyStatus('已粘贴需求图片', 'ok');
              renderOpenedSummaryDialog();
            }
          });
        });
        summaryDialogBodyEl.addEventListener('dragover', function(event) {
          var target = event && event.target ? event.target : null;
          var dropZone = getPrepRequirementDropzone(target) || getPrepCasesDropzone(target);
          if (!dropZone || isPrepBaseLocked()) return;
          if (event.preventDefault) event.preventDefault();
          if (dropZone.classList) dropZone.classList.add('dragover');
        });
        summaryDialogBodyEl.addEventListener('dragleave', function(event) {
          var target = event && event.target ? event.target : null;
          var dropZone = getPrepRequirementDropzone(target) || getPrepCasesDropzone(target);
          if (!dropZone) return;
          var related = event ? event.relatedTarget : null;
          if (related && dropZone.contains && dropZone.contains(related)) return;
          if (dropZone.classList) dropZone.classList.remove('dragover');
        });
        summaryDialogBodyEl.addEventListener('drop', function(event) {
          var target = event && event.target ? event.target : null;
          var requirementZone = getPrepRequirementDropzone(target);
          var casesZone = getPrepCasesDropzone(target);
          var dropZone = requirementZone || casesZone;
          if (!dropZone) return;
          if (event.preventDefault) event.preventDefault();
          if (dropZone.classList) dropZone.classList.remove('dragover');
          if (isPrepBaseLocked()) return;
          var files = event && event.dataTransfer ? event.dataTransfer.files : null;
          if (requirementZone) {
            var file = files && files[0] ? files[0] : null;
            if (!file) return;
            importRequirementFileFromDrop(file);
            return;
          }
          if (casesZone) importCasesFilesFromDrop(files);
        });
      }
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('keydown', function(event) {
          if (!event) return;
          if (event.key === 'Escape') {
            if (!isDrawerOpen() || summaryDialogOpen !== true) return;
            closeSummaryDialog();
            return;
          }
          if (!isDrawerOpen() || summaryDialogOpen === true || isTypingLikeTarget(event.target)) return;
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
        }, true);
      }
      syncDeleteHistoryButtons();
      syncKnowledgeBaseToolbarState();
    }

    function bindRenderListeners() {
      var debouncedRender = debounce(function() {
        scheduleRender('dom-input');
      }, 120);
      ['rawText', 'caseText'].forEach(function(id) {
        var el = document.getElementById(id);
        if (!el || !el.addEventListener) return;
        el.addEventListener('input', function() {
          updateSummary();
          debouncedRender();
        });
        el.addEventListener('change', function() {
          updateSummary();
          debouncedRender();
        });
      });
      ['fileInput', 'caseFileInput'].forEach(function(id) {
        var input = document.getElementById(id);
        if (!input || !input.addEventListener) return;
        input.addEventListener('change', function() {
          setTimeout(function() {
            updateSummary();
            renderOpenedSummaryDialog();
            scheduleRender('file-change');
          }, 220);
        });
      });
      var caseFileList = document.getElementById('caseFileList');
      if (caseFileList && typeof MutationObserver !== 'undefined') {
        listObserver = new MutationObserver(function() {
          updateSummary();
          renderOpenedSummaryDialog();
          scheduleRender('case-list-mutation');
        });
        listObserver.observe(caseFileList, { childList: true, subtree: true });
      }
    }

    function hasDrawerRestoreIntent() {
      var viewState = getViewState();
      if (viewState.drawerOpen === true) return true;
      var activeWorkspaceId = String(getActiveWorkspaceId() || '');
      if (activeWorkspaceId && hasWorkspaceSnapshotDrawerRestoreIntent(activeWorkspaceId)) return true;
      return hasManagedTaskDrawerRestoreIntent();
    }

    function getDrawerRestoreWorkspaceId() {
      var activeId = String(getActiveWorkspaceId() || '');
      if (activeId && hasWorkspaceSnapshotDrawerRestoreIntent(activeId)) {
        return activeId;
      }
      return getManagedTaskRestoreWorkspaceId();
    }

    function getWorkspaceSnapshotViewState(workspaceId) {
      var record = getWorkspaceRecord(workspaceId);
      if (!record || !record.snapshot || !record.snapshot.xmind) return null;
      var viewState = record.snapshot.xmind.viewState;
      return viewState && typeof viewState === 'object' ? viewState : null;
    }

    function hasWorkspaceSnapshotDrawerRestoreIntent(workspaceId) {
      var viewState = getWorkspaceSnapshotViewState(workspaceId);
      return Boolean(viewState && viewState.drawerOpen === true);
    }

    function getManagedTaskRestoreWorkspaceId() {
      var matchedId = '';
      listManagedXmindTasks().some(function(task) {
        if (!task || isManagedTaskTerminal(task)) return false;
        var restoreContext = task && task.restoreContext && typeof task.restoreContext === 'object'
          ? task.restoreContext
          : null;
        if (!restoreContext || !restoreContext.viewState || restoreContext.viewState.drawerOpen !== true) {
          return false;
        }
        matchedId = String(restoreContext.workspaceId || task.workspaceId || '');
        return true;
      });
      return matchedId;
    }

    function hasManagedTaskDrawerRestoreIntent() {
      return Boolean(getManagedTaskRestoreWorkspaceId());
    }

    function hasManagedTaskRestoreContextForWorkspace(workspaceId) {
      var targetId = String(workspaceId || getActiveWorkspaceId() || '');
      if (!targetId) return false;
      return filterTasksByWorkspace(listManagedXmindTasks(), targetId).some(function(task) {
        return Boolean(task && task.restoreContext && typeof task.restoreContext === 'object');
      });
    }

    function shouldRestoreDrawerAfterRefresh() {
      if (isDrawerManualCloseSuppressed()) return false;
      if (!hasDrawerRestoreIntent()) return false;
      return String(state.activeTab || '') === 'casesgen';
    }

    function scheduleDrawerRestoreRetry(delayMs) {
      if (drawerRestoreRetryTimer) {
        clearTimeout(drawerRestoreRetryTimer);
        drawerRestoreRetryTimer = 0;
      }
      drawerRestoreRetryTimer = setTimeout(function() {
        drawerRestoreRetryTimer = 0;
        try {
          if (!shouldRestoreDrawerAfterRefresh()) {
            clearDrawerRestoreRetry('restore-should-skip');
            return;
          }
          drawerRestoreRetryCount += 1;
          if (!isDrawerOpen()) {
            drawerRestoreStableCount = 0;
            setDebugState({
              phase: 'drawer-restore-attempt',
              attempt: drawerRestoreRetryCount,
            });
            open({ restoreOpening: true });
          }
          if (isDrawerOpen()) {
            drawerRestoreStableCount += 1;
            setDebugState({
              phase: 'drawer-restore-open',
              attempt: drawerRestoreRetryCount,
              stableCount: drawerRestoreStableCount,
            });
          } else {
            drawerRestoreStableCount = 0;
          }
          if (drawerRestoreStableCount >= 2) {
            clearDrawerRestoreRetry('restore-stable-enough');
            return;
          }
          if (drawerRestoreRetryCount >= DRAWER_RESTORE_RETRY_LIMIT) {
            setDebugState({
              phase: 'drawer-restore-timeout',
              attempt: drawerRestoreRetryCount,
            });
            clearDrawerRestoreRetry('restore-timeout');
            return;
          }
          scheduleDrawerRestoreRetry(
            isDrawerOpen()
              ? 220
              : (getViewState().fullscreen === true ? 320 : 140)
          );
        } catch (err) {
          setDebugState({
            phase: 'drawer-restore-error',
            attempt: drawerRestoreRetryCount,
            error: err && err.message ? String(err.message) : '未知错误',
          });
          clearDrawerRestoreRetry('restore-error');
        }
      }, Math.max(0, Number(delayMs) || 0));
    }

    function restoreDrawerAfterRefreshIfNeeded() {
      clearDrawerRestoreRetry('restore-start');
      setDebugState({ phase: 'drawer-restore-start' });
      applyPendingSuspendViewStateCache();
      reconcileManagedXmindTasks({ resume: true, render: isDrawerOpen(), persist: false, reason: 'workflow-ready' });
      var restoreWorkspaceId = getDrawerRestoreWorkspaceId();
      if (restoreWorkspaceId) {
        ensureWorkspaceHostState().mirrorWorkspaceId = restoreWorkspaceId;
      }
      if (restoreWorkspaceId && restoreWorkspaceId !== String(getActiveWorkspaceId() || '')) {
        ensureWorkspaceHostState().activeWorkspaceId = restoreWorkspaceId;
      }
      setDebugState({
        phase: 'drawer-restore-after-reconcile',
        restoreIntent: hasDrawerRestoreIntent(),
        activeWorkspaceId: String(getActiveWorkspaceId() || ''),
      });
      ensureActiveWorkspaceHydrated();
      if (!hasDrawerRestoreIntent()) {
        setDebugState({
          phase: 'drawer-restore-no-intent',
          activeWorkspaceId: String(getActiveWorkspaceId() || ''),
        });
        return;
      }
      if (!isDrawerOpen()) {
        setDebugState({
          phase: 'drawer-restore-scheduled-open',
          activeWorkspaceId: String(getActiveWorkspaceId() || ''),
        });
        scheduleDrawerRestoreRetry(120);
        return;
      }
      setDebugState({
        phase: 'drawer-restore-opened',
        activeWorkspaceId: String(getActiveWorkspaceId() || ''),
      });
    }

    ensureDrawer();
    bindViewStatePersistenceLifecycle();
    bindButtons();
    bindManagedXmindTasks();
    bindRenderListeners();
    updateSummary();

    var api = {
      open: open,
      close: close,
      closeWorkspace: deleteWorkspace,
      activateWorkspace: activateWorkspace,
      openWorkspace: openWorkspaceFromProgressPanel,
      getWorkspaceProgressItems: listWorkspaceProgressItems,
      getWorkspaceModuleMirrorPayload: getWorkspaceModuleMirrorPayload,
      selectWorkspaceForMirror: selectWorkspaceForMirror,
      hydrateActiveWorkspaceSnapshot: hydrateActiveWorkspaceSnapshot,
      syncActiveWorkspaceSnapshot: syncActiveWorkspaceSnapshot,
      shouldDeferCasesGenPageRender: shouldDeferCasesGenPageRender,
      queueCasesGenPageRender: queueCasesGenPageRender,
      render: render,
      exportCurrentXmind: exportCurrentXmind,
      exportCurrentMarkdown: exportCurrentMarkdown,
      switchTab: switchTab,
      isOpen: isDrawerOpen,
      restoreAfterWorkflowReady: restoreDrawerAfterRefreshIfNeeded,
      resetAllState: resetXmindCasegenState,
      resetAfterStoreSuccess: resetAfterStoreSuccess,
    };
    window.app.xmindCasegenApi = api;
    syncCasesGenPageRender({ force: true });
    return api;
  }

  window.app = window.app || {};
  window.app.xmindCasegen = { init: init };
})();
