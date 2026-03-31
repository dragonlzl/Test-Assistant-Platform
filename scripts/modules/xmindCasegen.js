(function() {
  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var utils = ctx.utils || {};
    var core = ctx.core || {};
    var casesGenApi = ctx.casesGenApi || {};
    var prepApi = ctx.prepApi || {};
    var xmindGenApi = ctx.xmindGenApi || {};

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
    var toolbarEl = document.getElementById('xmindCaseGenToolbar');
    var summaryBtn = document.getElementById('xmindCaseGenSummaryBtn');
    var historyBtn = document.getElementById('xmindCaseGenHistoryBtn');
    var summaryOverlayEl = document.getElementById('xmindCaseGenSummaryOverlay');
    var summaryDialogEl = document.getElementById('xmindCaseGenSummaryDialog');
    var summaryDialogTitleEl = document.getElementById('xmindCaseGenSummaryDialogTitle');
    var summaryDialogDescEl = document.getElementById('xmindCaseGenSummaryDialogDesc');
    var summaryDialogBodyEl = document.getElementById('xmindCaseGenSummaryDialogBody');
    var prepResetBtn = document.getElementById('xmindCaseGenPrepResetBtn');
    var summaryCloseBtn = document.getElementById('xmindCaseGenSummaryCloseBtn');
    var exportBtn = document.getElementById('xmindCaseGenExportBtn');
    var statusEl = document.getElementById('xmindCaseGenStatus');
    var mindContainer = document.getElementById('xmindCaseGenMindContainer');

    var renderTimer = 0;
    var listObserver = null;
    var drawerInstance = null;
    var summaryDialogOpen = false;
    var summaryDialogMode = 'prep';
    var currentMindData = null;
    var mindInstance = null;
    var mindApiReadyPromise = null;
    var inlineControlsHost = null;
    var inlineStatusHost = null;
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

    var STEP_REQUIREMENT = 1;
    var STEP_CASES = 2;
    var STEP_OPTIONS = 3;
    var HISTORY_LIMIT = 80;
    var multimodalMaxImages = 20;
    var multimodalMaxEdge = 1600;
    var multimodalMaxBytes = 4 * 1024 * 1024;

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

    function createDefaultPrepState() {
      return {
        step: STEP_REQUIREMENT,
        requirementMode: '',
        requirementSupplement: '',
        manualRequirementBlocks: [],
        caseImportMode: '',
        completed: false,
      };
    }

    function createDefaultRootState() {
      return {
        lastAction: '',
        running: false,
        hideAiLayer: false,
        snapshotId: '',
        status: '',
        error: '',
        updatedAt: 0,
      };
    }

    function cloneJson(value, fallback) {
      if (value === undefined || value === null) return fallback;
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (err) {
        return fallback;
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

    function notifyInlineStatus(text, type) {
      setStatus(statusEl, text || '', type || '');
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
    }

    function notifySuccessToast(text, durationMs) {
      if (!text) {
        notifyInlineStatus('', '');
        return;
      }
      notifyInlineStatus('', '');
      showCenterToast(String(text), 'ok', durationMs || 3000);
    }

    function notifyStatus(text, type, options) {
      var opts = options || {};
      if ((type || '') === 'ok' && opts.forceInline !== true) {
        notifySuccessToast(text, opts.durationMs || 3000);
        return;
      }
      notifyInlineStatus(text, type || '');
    }

    function getXmindCoreApi() {
      if (ctx.xmindCoreApi) return ctx.xmindCoreApi;
      return window.app && window.app.xmindCoreApi ? window.app.xmindCoreApi : null;
    }

    function getMindElixirCoreApi() {
      if (ctx.mindElixirCoreApi) return ctx.mindElixirCoreApi;
      return window.app && window.app.mindElixirCoreApi ? window.app.mindElixirCoreApi : null;
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
        exportBtn,
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
      if (inlineControlsHost && inlineControlsHost.parentNode) {
        inlineControlsHost.parentNode.removeChild(inlineControlsHost);
      }
      if (inlineStatusHost && inlineStatusHost.parentNode) {
        inlineStatusHost.parentNode.removeChild(inlineStatusHost);
      }
      inlineControlsHost = null;
      inlineStatusHost = null;
    }

    function getMindControlsRoot() {
      if (!mindContainer || !mindContainer.querySelector) return null;
      return mindContainer.querySelector('[data-mind-controls]');
    }

    function getInlineControlsHost() {
      var controlsRoot = getMindControlsRoot();
      if (!controlsRoot || !controlsRoot.querySelector) return null;
      var searchGroup = controlsRoot.querySelector('.xmind-search-group');
      if (!searchGroup) return null;
      var host = controlsRoot.querySelector('[data-xmind-casegen-inline-actions]');
      if (!host) {
        host = document.createElement('div');
        host.className = 'xmind-casegen-inline-actions';
        host.setAttribute('data-xmind-casegen-inline-actions', '1');
        searchGroup.appendChild(host);
      }
      inlineControlsHost = host;
      return host;
    }

    function getInlineStatusHost() {
      var controlsRoot = getMindControlsRoot();
      if (!controlsRoot || !controlsRoot.querySelector) return null;
      var actionGroup = controlsRoot.querySelector('.xmind-action-group');
      if (!actionGroup) return null;
      var host = controlsRoot.querySelector('[data-xmind-casegen-inline-status]');
      if (!host) {
        host = document.createElement('div');
        host.className = 'xmind-casegen-inline-status';
        host.setAttribute('data-xmind-casegen-inline-status', '1');
        if (actionGroup.firstChild) {
          actionGroup.insertBefore(host, actionGroup.firstChild);
        } else {
          actionGroup.appendChild(host);
        }
      }
      inlineStatusHost = host;
      return host;
    }

    function mountInlineControls() {
      var controlsRoot = getMindControlsRoot();
      var actionsHost = getInlineControlsHost();
      var statusHost = getInlineStatusHost();
      if (!controlsRoot || !actionsHost) return false;
      controlsRoot.classList.add('xmind-casegen-inline-controls-ready');
      getInlineControlButtons().forEach(function(btn) {
        if (!btn || !actionsHost.appendChild) return;
        btn.classList.add('xmind-casegen-inline-btn');
        actionsHost.appendChild(btn);
      });
      if (statusHost && statusEl) {
        statusEl.classList.add('xmind-casegen-inline-status-text');
        statusHost.appendChild(statusEl);
      }
      return true;
    }

    function destroyMind() {
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
        casesGenApi.setCaseGenViewTab('modules', { persist: false });
      } else {
        var modulesTabBtn = document.getElementById('caseGenModulesTabBtn');
        if (modulesTabBtn && typeof modulesTabBtn.click === 'function') modulesTabBtn.click();
      }
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
          setDebugState({ phase: 'drawer-open' });
          try {
            setDebugState({ phase: 'drawer-open-set-view-start' });
            setCasesGenModulesView();
            setDebugState({ phase: 'drawer-open-set-view-done' });
          } catch (errView) {
            setDebugState({
              phase: 'drawer-open-set-view-error',
              error: errView && errView.message ? String(errView.message) : '未知错误'
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
            setTimeout(function() {
              setDebugState({ phase: 'drawer-open-render-callback' });
              render({ reason: 'drawer-open', persist: false });
            }, 90);
          } catch (errRender) {
            setDebugState({
              phase: 'drawer-open-schedule-render-error',
              error: errRender && errRender.message ? String(errRender.message) : '未知错误'
            });
          }
        },
        onClose: function() {
          closeSummaryDialog({ skipPersist: true });
          destroyMind();
          persistWorkflowStateNow();
        },
      });
      return drawerInstance;
    }

    function ensureState() {
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
      if (!Array.isArray(state.xmindCaseGen.deletedBaselineModuleKeys)) state.xmindCaseGen.deletedBaselineModuleKeys = [];
      if (!Array.isArray(state.xmindCaseGen.deletedBaselineCaseKeys)) state.xmindCaseGen.deletedBaselineCaseKeys = [];
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
      if (!Number.isFinite(Number(state.xmindCaseGen.nextSnapshotId))) {
        state.xmindCaseGen.nextSnapshotId = 1;
      }
      state.xmindCaseGen.mode = state.xmindCaseGen.mode === 'full' ? 'full' : 'modules';
      state.xmindCaseGen.treeSourceSignature = String(state.xmindCaseGen.treeSourceSignature || '');
      state.xmindCaseGen.hasModuleSkeleton = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      state.xmindCaseGen.hasImportedBaseline = hasImportedBaselineCases();
      state.xmindCaseGen.lastOperationSnapshotId = String(state.xmindCaseGen.lastOperationSnapshotId || '');
      state.xmindCaseGen.rootSnapshotId = String(state.xmindCaseGen.rootSnapshotId || '');
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
      if (!Array.isArray(state.xmindCaseGen.prep.manualRequirementBlocks)) {
        state.xmindCaseGen.prep.manualRequirementBlocks = [];
      }
      state.xmindCaseGen.prep.caseImportMode = state.xmindCaseGen.prep.caseImportMode === 'import'
        ? 'import'
        : (state.xmindCaseGen.prep.caseImportMode === 'skip' ? 'skip' : '');
      state.xmindCaseGen.prep.completed = state.xmindCaseGen.prep.completed === true;
      return state.xmindCaseGen;
    }

    function ensureRootUiState() {
      return ensureState().root;
    }

    function ensureModuleUiState(moduleId) {
      var rootState = ensureState();
      var key = String(moduleId || '');
      if (!key) return null;
      if (!rootState.modules[key] || typeof rootState.modules[key] !== 'object') {
        rootState.modules[key] = {
          lastAction: '',
          running: false,
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

    function getDeletedBaselineModuleMap() {
      var map = Object.create(null);
      ensureState().deletedBaselineModuleKeys.forEach(function(item) {
        var key = buildBaselineModuleDeleteKey(item);
        if (key) map[key] = true;
      });
      return map;
    }

    function getDeletedBaselineCaseMap() {
      var map = Object.create(null);
      ensureState().deletedBaselineCaseKeys.forEach(function(item) {
        var key = String(item || '').trim();
        if (key) map[key] = true;
      });
      return map;
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
        xmindState.root.hideAiLayer = false;
        xmindState.root.status = '';
        xmindState.root.error = '';
      }
      Object.keys(xmindState.modules || {}).forEach(function(key) {
        var moduleState = ensureModuleUiState(key);
        if (!moduleState) return;
        moduleState.snapshotId = '';
        moduleState.running = false;
        moduleState.rootPendingActionId = '';
        moduleState.status = '';
        moduleState.error = '';
        moduleState.hideResults = false;
        clearModuleTopupHighlight(moduleState);
      });
      clearAllTopupHighlights();
    }

    function persistXmindState(useImmediate) {
      ensureState().hasImportedBaseline = hasImportedBaselineCases();
      if (useImmediate === true) persistWorkflowStateNow();
      else persistWorkflowState();
    }

    function getPrepState() {
      return ensureState().prep;
    }

    function setPrepField(key, value, immediate) {
      var prep = getPrepState();
      prep[key] = value;
      if (key !== 'completed') prep.completed = false;
      persistXmindState(immediate === true);
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

    function getRequirementLabelText() {
      var label = state.requirementLabel ? String(state.requirementLabel).trim() : '';
      return label || '当前需求';
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
        });
      }
      if (Array.isArray(media.docxImages)) media.docxImages.forEach(function(item) { append(item, 'docx'); });
      if (Array.isArray(media.pastedImages)) media.pastedImages.forEach(function(item) { append(item, 'paste'); });
      return list;
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
      var prep = getPrepState();
      if (prep.requirementMode === 'manual') {
        return getManualRequirementText();
      }
      var rawTextEl = document.getElementById('rawText');
      return rawTextEl && rawTextEl.value ? String(rawTextEl.value).trim() : '';
    }

    function hasRequirementReady() {
      var prep = getPrepState();
      if (prep.requirementMode === 'manual') return hasManualRequirementContent();
      if (prep.requirementMode === 'document') return hasDocumentRequirementContent();
      return false;
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
      var prep = getPrepState();
      if (prep.requirementMode === 'manual') {
        var text = getManualRequirementText();
        var images = getManualRequirementImages().length;
        return {
          done: hasManualRequirementContent(),
          title: hasManualRequirementContent() ? '已填写需求描述' : '未填写需求描述',
          meta: hasManualRequirementContent()
            ? ('文本 ' + String(text.length) + ' 字' + (images ? '，图片 ' + String(images) + ' 张' : ''))
            : '请先填写文本或上传图片。',
        };
      }
      var rawTextEl = document.getElementById('rawText');
      var rawText = rawTextEl && rawTextEl.value ? String(rawTextEl.value).trim() : '';
      var supplement = String(prep.requirementSupplement || '').trim();
      var importName = state.lastRawImportName ? String(state.lastRawImportName) : '当前文档';
      return {
        done: Boolean(rawText),
        title: rawText ? '已导入需求文档' : '未导入需求文档',
        meta: rawText
          ? ('来源：' + importName + '，正文 ' + String(rawText.length) + ' 字' + (supplement ? '，补充已填写' : ''))
          : '请先导入需求文档。',
      };
    }

    function buildCasesSummaryInfo() {
      var prep = getPrepState();
      if (prep.caseImportMode === 'skip') {
        return {
          done: true,
          title: '本次不导入参考用例',
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
          title: '未导入参考用例',
          meta: text ? '已存在文本，但尚未解析到有效用例。' : '参考用例是可选项，可跳过。',
        };
      }
      return {
        done: true,
        title: '已导入参考用例',
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
      var scope = payload && payload.scope === 'module' ? 'module' : 'root';
      var moduleCount = Number(payload && payload.moduleCount);
      if (!Number.isFinite(moduleCount) || moduleCount < 0) moduleCount = details.length;
      history.unshift({
        id: 'history-' + String(Date.now()) + '-' + String(Math.floor(Math.random() * 100000)),
        scope: scope,
        locationLabel: buildHistoryLocationLabel(scope, payload && payload.moduleTitle),
        actionId: String(payload && payload.actionId ? payload.actionId : ''),
        actionLabel: String(payload && payload.actionLabel ? payload.actionLabel : ''),
        moduleCount: moduleCount,
        details: details,
        resultKind: payload && (
          payload.resultKind === 'no-change'
          || payload.resultKind === 'error'
        ) ? String(payload.resultKind) : 'changed',
        reasonText: payload && payload.reasonText ? String(payload.reasonText) : '',
        diagnostics: diagnostics,
        previewText: normalizeHistoryPreviewText(payload && payload.previewText),
        createdAt: Date.now(),
      });
      if (history.length > HISTORY_LIMIT) history.length = HISTORY_LIMIT;
      xmindState.history = history;
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
          var resultKind = entry && entry.resultKind ? String(entry.resultKind) : 'changed';
          var summaryText = '生成模块 ' + String(Number(entry.moduleCount) || 0) + ' 个';
          if (resultKind === 'error') summaryText = '本次生成未成功';
          else if (resultKind === 'no-change' && !details.length) summaryText = '本次没有新增结果';
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
            ? '<div class="xmind-casegen-history-reason' + (resultKind === 'error' ? ' is-error' : '') + '">'
                + '<strong class="xmind-casegen-history-reason-label">' + (resultKind === 'error' ? '失败原因：' : '未新增原因：') + '</strong>'
                + '<span class="xmind-casegen-history-reason-text">' + escapeHtml(entry.reasonText) + '</span>'
              + '</div>'
            : '';
          var previewHtml = entry && entry.previewText
            ? '<div class="xmind-casegen-history-preview">'
                + '<strong class="xmind-casegen-history-preview-label">模型返回片段：</strong>'
                + '<span class="xmind-casegen-history-preview-text">' + escapeHtml(entry.previewText) + '</span>'
              + '</div>'
            : '';
          var diagnosticsHtml = diagnostics.length
            ? '<div class="xmind-casegen-history-diagnostics">'
                + diagnostics.map(function(text) {
                  return '<span class="xmind-casegen-history-diagnostic-chip">' + escapeHtml(text) + '</span>';
                }).join('')
              + '</div>'
            : '';
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
            + diagnosticsHtml
            + '</article>';
        }).join('')
        + '</div>';
    }

    function renderOpenedSummaryDialog() {
      if (summaryDialogOpen !== true) return;
      if (summaryDialogMode === 'history') renderHistoryDialog();
      else renderPrepDialog();
    }

    function getCaseGenSettingsSnapshot() {
      if (casesGenApi && typeof casesGenApi.ensureCaseGenSettings === 'function') {
        return casesGenApi.ensureCaseGenSettings();
      }
      return state.caseGenSettings || {};
    }

    function setCaseGenOption(key, value) {
      if (casesGenApi && typeof casesGenApi.setCaseGenSettingValue === 'function') {
        casesGenApi.setCaseGenSettingValue(key, value);
        return;
      }
      state.caseGenSettings = state.caseGenSettings || {};
      state.caseGenSettings[key] = value;
      persistXmindState(false);
    }

    function renderPrepStepTabs() {
      var prep = getPrepState();
      var steps = [
        { step: STEP_REQUIREMENT, label: 'step1：需求导入', done: hasRequirementReady() },
        { step: STEP_CASES, label: 'step2：是否导入用例', done: hasCaseStepReady() },
        { step: STEP_OPTIONS, label: 'step3：生成选项', done: prep.completed === true },
      ];
      return '<div class="xmind-casegen-prep-stepper">'
        + steps.map(function(item) {
          var classes = ['xmind-casegen-prep-step'];
          if (prep.step === item.step) classes.push('is-active');
          else if (item.done) classes.push('is-done');
          return '<button type="button" class="' + classes.join(' ') + '" data-prep-step="' + item.step + '">'
            + '<span class="xmind-casegen-prep-step-badge">' + String(item.step) + '</span>'
            + '<span class="xmind-casegen-prep-step-copy">'
            + '<strong class="xmind-casegen-prep-step-title">' + escapeHtml(item.label) + '</strong>'
            + '<span class="xmind-casegen-prep-step-status">' + escapeHtml(item.done ? '已完成' : '待处理') + '</span>'
            + '</span>'
            + '</button>';
        }).join('')
        + '</div>';
    }

    function renderRequirementStepCard() {
      var prep = getPrepState();
      var mode = prep.requirementMode || '';
      var rawTextEl = document.getElementById('rawText');
      var docValue = rawTextEl && rawTextEl.value ? String(rawTextEl.value).trim() : '';
      var manualText = getManualRequirementText();
      var manualImages = getManualRequirementImages();
      var manualImagesHtml = manualImages.map(function(item, index) {
        var name = item && item.name ? String(item.name) : ('图片' + (index + 1));
        return '<div class="xmind-casegen-prep-image-item">'
          + '<img src="' + escapeHtml(item.dataUrl || '') + '" alt="' + escapeHtml(name) + '" />'
          + '<div class="xmind-casegen-prep-image-item-copy">'
          +   '<span>' + escapeHtml(name) + '</span>'
          +   '<button type="button" class="link-toggle" data-prep-action="remove-manual-image" data-image-index="' + index + '">移除</button>'
          + '</div>'
          + '</div>';
      }).join('');
      return ''
        + '<div class="xmind-casegen-prep-card xmind-casegen-prep-card-main">'
        +   '<div class="xmind-casegen-prep-card-head">'
        +     '<div class="xmind-casegen-prep-card-copy">'
        +       '<span class="xmind-casegen-prep-step-order">步骤 1 / 3</span>'
        +       '<strong class="xmind-casegen-prep-card-title">需求导入</strong>'
        +     '</div>'
        +     '<span class="xmind-casegen-prep-status-badge is-' + (hasRequirementReady() ? 'done' : 'ready') + '">' + (hasRequirementReady() ? '已完成' : '待选择') + '</span>'
        +   '</div>'
        +   '<div class="xmind-casegen-prep-choice-grid">'
        +     '<label class="xmind-casegen-prep-choice ' + (mode === 'document' ? 'is-active' : '') + '">'
        +       '<input type="radio" name="xmindRequirementMode" value="document" ' + (mode === 'document' ? 'checked' : '') + ' />'
        +       '<span class="xmind-casegen-prep-choice-title">导入需求文档</span>'
        +       '<span class="xmind-casegen-prep-choice-desc">复用现有需求导入链路，可附加需求补充。</span>'
        +     '</label>'
        +     '<label class="xmind-casegen-prep-choice ' + (mode === 'manual' ? 'is-active' : '') + '">'
        +       '<input type="radio" name="xmindRequirementMode" value="manual" ' + (mode === 'manual' ? 'checked' : '') + ' />'
        +       '<span class="xmind-casegen-prep-choice-title">填写需求描述</span>'
        +       '<span class="xmind-casegen-prep-choice-desc">支持文本 + 图片，作为 XMind 专属需求上下文。</span>'
        +     '</label>'
        +   '</div>'
        +   (mode === 'document'
          ? ''
            + '<div class="xmind-casegen-prep-field">'
            +   '<label>需求文档</label>'
            +   '<div class="xmind-casegen-prep-upload-row">'
            +     '<button type="button" data-prep-action="import-requirement">' + (docValue ? '重新导入需求文档' : '导入需求文档') + '</button>'
            +     '<span class="hint">' + escapeHtml(docValue ? ('已导入 ' + String(docValue.length) + ' 字') : '导入后才能进入下一步') + '</span>'
            +   '</div>'
            + '</div>'
            + '<div class="xmind-casegen-prep-field">'
            +   '<label for="xmindCaseGenRequirementSupplement">需求补充</label>'
            +   '<textarea id="xmindCaseGenRequirementSupplement" data-prep-input="requirementSupplement" placeholder="非必填，会与需求文档一起作为生成上下文。">' + escapeHtml(prep.requirementSupplement || '') + '</textarea>'
            + '</div>'
          : '')
        +   (mode === 'manual'
          ? ''
            + '<div class="xmind-casegen-prep-field">'
            +   '<label for="xmindCaseGenManualRequirementText">需求描述</label>'
            +   '<textarea id="xmindCaseGenManualRequirementText" data-manual-requirement-text="1" placeholder="请输入需求描述；也可直接粘贴图片到此区域。">' + escapeHtml(manualText) + '</textarea>'
            + '</div>'
            + '<div class="xmind-casegen-prep-field">'
            +   '<label>需求图片</label>'
            +   '<div class="xmind-casegen-prep-upload-row">'
            +     '<button type="button" class="secondary" data-prep-action="upload-manual-images">上传图片</button>'
            +     '<span class="hint">' + (manualImages.length ? ('已添加 ' + String(manualImages.length) + ' 张') : '支持上传或粘贴图片') + '</span>'
            +   '</div>'
            +   '<div class="xmind-casegen-prep-image-list">' + manualImagesHtml + '</div>'
            + '</div>'
          : '')
        + '</div>';
    }

    function renderCasesStepCard() {
      var prep = getPrepState();
      var mode = prep.caseImportMode || '';
      var casesInfo = buildCasesSummaryInfo();
      return ''
        + '<div class="xmind-casegen-prep-card xmind-casegen-prep-card-main">'
        +   '<div class="xmind-casegen-prep-card-head">'
        +     '<div class="xmind-casegen-prep-card-copy">'
        +       '<span class="xmind-casegen-prep-step-order">步骤 2 / 3</span>'
        +       '<strong class="xmind-casegen-prep-card-title">是否导入用例</strong>'
        +     '</div>'
        +     '<span class="xmind-casegen-prep-status-badge is-' + (hasCaseStepReady() ? 'done' : 'ready') + '">' + (hasCaseStepReady() ? '已完成' : '待选择') + '</span>'
        +   '</div>'
        +   '<div class="xmind-casegen-prep-choice-grid">'
        +     '<label class="xmind-casegen-prep-choice ' + (mode === 'skip' ? 'is-active' : '') + '">'
        +       '<input type="radio" name="xmindCaseImportMode" value="skip" ' + (mode === 'skip' ? 'checked' : '') + ' />'
        +       '<span class="xmind-casegen-prep-choice-title">不导入用例</span>'
        +       '<span class="xmind-casegen-prep-choice-desc">主树仅展示 AI 生成层。</span>'
        +     '</label>'
        +     '<label class="xmind-casegen-prep-choice ' + (mode === 'import' ? 'is-active' : '') + '">'
        +       '<input type="radio" name="xmindCaseImportMode" value="import" ' + (mode === 'import' ? 'checked' : '') + ' />'
        +       '<span class="xmind-casegen-prep-choice-title">导入参考用例</span>'
        +       '<span class="xmind-casegen-prep-choice-desc">导入后会作为主树可见基线。</span>'
        +     '</label>'
        +   '</div>'
        +   (mode === 'import'
          ? ''
            + '<div class="xmind-casegen-prep-field">'
            +   '<label>参考用例来源</label>'
            +   '<div class="xmind-casegen-prep-upload-row">'
            +     '<button type="button" data-prep-action="import-cases">' + (hasImportedBaselineCases() ? '继续导入用例' : '导入用例') + '</button>'
            +     '<button type="button" class="secondary" data-prep-action="select-cases-library">从用例库选择</button>'
            +   '</div>'
            +   '<p class="hint">' + escapeHtml(casesInfo.meta) + '</p>'
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

    function renderOptionsStepCard() {
      var settings = getCaseGenSettingsSnapshot();
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
        +       '<span class="xmind-casegen-prep-step-order">步骤 3 / 3</span>'
        +       '<strong class="xmind-casegen-prep-card-title">生成选项</strong>'
        +     '</div>'
        +     '<span class="xmind-casegen-prep-status-badge is-' + (getPrepState().completed ? 'done' : 'ready') + '">' + (getPrepState().completed ? '已确认' : '待确认') + '</span>'
        +   '</div>'
        +   '<div class="xmind-casegen-prep-field">'
        +     '<label for="xmindCaseGenOptionCustomRequirement">额外要求</label>'
        +     '<textarea id="xmindCaseGenOptionCustomRequirement" data-casegen-setting="customRequirement" placeholder="非必填，用于补充生成要求。">' + escapeHtml(settings.customRequirement || '') + '</textarea>'
        +   '</div>'
        +   '<div class="xmind-casegen-prep-option-stack">'
        +     '<div class="xmind-casegen-prep-option-group">'
        +       '<div class="xmind-casegen-prep-option-group-head">'
        +         '<strong class="xmind-casegen-prep-option-group-title">基础生成开关</strong>'
        +         '<span class="xmind-casegen-prep-option-group-desc">先把覆盖策略选好，再回到画布触发生成。</span>'
        +       '</div>'
        +       '<div class="xmind-casegen-prep-toggle-grid">' + primaryHtml + '</div>'
        +     '</div>'
        +     '<div class="xmind-casegen-prep-option-group ' + (settings.needSpecial ? '' : 'is-disabled') + '">'
        +       '<div class="xmind-casegen-prep-option-group-head">'
        +         '<strong class="xmind-casegen-prep-option-group-title">特殊场景细项</strong>'
        +         '<span class="xmind-casegen-prep-option-group-desc">' + (settings.needSpecial ? '按需补足本轮要覆盖的特殊场景。' : '先开启“考虑特殊场景”，再选择具体细项。') + '</span>'
        +       '</div>'
        +       '<div class="xmind-casegen-prep-toggle-grid xmind-casegen-prep-toggle-grid-compact">' + specialHtml + '</div>'
        +   '</div>'
        + '</div>';
    }

    function renderPrepFooter() {
      var prep = getPrepState();
      var step = prep.step;
      var nextDisabled = false;
      if (step === STEP_REQUIREMENT) nextDisabled = !hasRequirementReady();
      if (step === STEP_CASES) nextDisabled = !hasCaseStepReady();
      return '<div class="xmind-casegen-prep-footer">'
        + (step > STEP_REQUIREMENT
          ? '<button type="button" class="secondary" data-prep-nav="prev">上一步</button>'
          : '<span class="xmind-casegen-prep-nav-spacer"></span>')
        + '<div class="xmind-casegen-prep-nav-main">'
        +   (step < STEP_OPTIONS
          ? '<button type="button" data-prep-nav="next" ' + (nextDisabled ? 'disabled' : '') + '>下一步</button>'
          : '<button type="button" data-prep-nav="confirm">确认前置准备</button>')
        + '</div>'
        + '</div>';
    }

    function renderPrepDialog() {
      if (!summaryDialogBodyEl) return;
      var prep = getPrepState();
      var mainHtml = '';
      if (prep.step === STEP_REQUIREMENT) mainHtml = renderRequirementStepCard();
      else if (prep.step === STEP_CASES) mainHtml = renderCasesStepCard();
      else mainHtml = renderOptionsStepCard();
      summaryDialogBodyEl.innerHTML = ''
        + '<div class="xmind-casegen-prep-flow">'
        +   renderPrepStepTabs()
        +   buildSummaryCardsHtml()
        +   mainHtml
        +   renderPrepFooter()
        + '</div>';
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
      setPrepField('requirementMode', 'document');
      var input = document.getElementById('fileInput');
      if (input && typeof input.click === 'function') input.click();
    }

    function triggerCasesImport() {
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

    function openSummaryDialog(step) {
      var prep = getPrepState();
      if (Number(step) >= STEP_REQUIREMENT && Number(step) <= STEP_OPTIONS) {
        prep.step = Number(step);
      }
      summaryDialogMode = 'prep';
      summaryDialogOpen = true;
      applySummaryDialogState();
    }

    function openHistoryDialog() {
      summaryDialogMode = 'history';
      summaryDialogOpen = true;
      applySummaryDialogState();
    }

    function closeSummaryDialog(options) {
      summaryDialogOpen = false;
      if (!(options && options.skipPersist === true)) persistXmindState(true);
      applySummaryDialogState();
    }

    function applySummaryDialogState() {
      var open = summaryDialogOpen === true;
      var mode = summaryDialogMode === 'history' ? 'history' : 'prep';
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
      if (prepResetBtn) prepResetBtn.hidden = !(open && mode === 'prep');
      if (summaryDialogTitleEl) {
        summaryDialogTitleEl.textContent = mode === 'history' ? '生成记录' : '生成前置准备';
      }
      if (summaryDialogDescEl) {
        summaryDialogDescEl.textContent = mode === 'history'
          ? '记录当前 XMind 用例生成里每次节点操作的结果摘要。'
          : '按 3 步完成需求导入、参考用例选择与生成选项配置，然后回到画布触发生成。';
      }
      if (!open) return;
      if (mode === 'history') renderHistoryDialog();
      else renderPrepDialog();
    }

    function confirmResetPrepState() {
      var confirmDrawer = window.app && window.app.confirmDrawer ? window.app.confirmDrawer : null;
      var message = '将清空当前已导入的需求、参考用例、前置流程结果和当前 XMind 生成结果，并重置前置准备。是否继续？';
      if (!confirmDrawer || typeof confirmDrawer.open !== 'function') {
        var ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(message)
          : true;
        if (!ok) return Promise.resolve(false);
        executePrepReset();
        notifyStatus('已重置生成前置准备', 'ok');
        return Promise.resolve(true);
      }
      return confirmDrawer.open({
        title: '确认重置生成前置准备',
        message: message,
        confirmText: '确认重置',
        cancelText: '取消',
        danger: true,
      }).then(function(result) {
        if (result && result.ok) {
          executePrepReset();
          notifyStatus('已重置生成前置准备', 'ok');
          return true;
        }
        return false;
      });
    }

    function executePrepReset() {
      if (prepApi && typeof prepApi.interruptActiveExecutions === 'function') {
        try {
          prepApi.interruptActiveExecutions('重置 XMind 生成前置准备');
        } catch (err) {}
      }
      if (prepApi && typeof prepApi.resetWorkflowData === 'function') {
        prepApi.resetWorkflowData();
      } else {
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
          root: createDefaultRootState(),
          summaryCollapsed: false,
          prep: createDefaultPrepState(),
          nextSnapshotId: 1,
          snapshots: [],
          modules: {},
        };
        state.caseGenModules = [];
        state.caseGenSource = '';
        state.caseGenResults = {};
        state.caseSelections = {};
        state.caseGenSuggestions = {};
        state.caseGenModuleStatus = {};
        state.caseGenProgress = {};
        state.caseGenTiming = {};
        state.importedCases = [];
      }
      ensureState();
      renderOpenedSummaryDialog();
      scheduleRender('prep-reset');
      persistXmindState(true);
    }

    function setPrepStep(step) {
      var next = Math.max(STEP_REQUIREMENT, Math.min(STEP_OPTIONS, Number(step) || STEP_REQUIREMENT));
      setPrepField('step', next);
      renderOpenedSummaryDialog();
    }

    function handlePrepNav(actionId) {
      var prep = getPrepState();
      if (actionId === 'prev') {
        setPrepStep(prep.step - 1);
        return true;
      }
      if (actionId === 'next') {
        if (prep.step === STEP_REQUIREMENT && !hasRequirementReady()) return false;
        if (prep.step === STEP_CASES && !hasCaseStepReady()) return false;
        setPrepStep(prep.step + 1);
        return true;
      }
      if (actionId === 'confirm') {
        if (!hasRequirementReady() || !hasCaseStepReady()) return false;
        setPrepField('completed', true, true);
        notifyStatus('已完成生成前置准备', 'ok');
        closeSummaryDialog({ skipPersist: true });
        return true;
      }
      return false;
    }

    function updateSummary() {
      ensureState().hasImportedBaseline = hasImportedBaselineCases();
      ensureState().hasModuleSkeleton = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      renderOpenedSummaryDialog();
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
      var includeAiLayer = opts.includeAiLayer !== false && !(rootState && rootState.hideAiLayer === true);
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

    function createOperationContract(actionId, moduleEntry) {
      if (actionId === ROOT_ACTIONS.FULL_CASES) {
        return {
          scope: 'root',
          mode: 'full_cases',
          targetModule: '',
          allowNewModules: true,
          generateCasesForNewModules: true,
          generateCasesForExistingModules: true,
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
        return {
          scope: 'root',
          mode: 'existing_modules_cases',
          targetModule: '',
          allowNewModules: false,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: true,
          dedupeAgainstVisibleModules: false,
          dedupeAgainstVisibleCases: true,
        };
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

    function buildXmindPrompt(contract) {
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
      var prep = getPrepState();
      var aiLayerSnapshot = contract && (
        contract.mode === 'regenerate_modules'
        || (contract.scope === 'root' && contract.mode === 'full_cases')
      )
        ? []
        : buildAiLayerSnapshot();
      var sections = [];
      sections.push('【需求标识】\n' + getRequirementLabelText());
      sections.push('【operation_contract(JSON)】\n' + JSON.stringify(contract, null, 2));
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
      if (prep.requirementMode === 'document') {
        var rawTextEl = document.getElementById('rawText');
        var rawText = rawTextEl && rawTextEl.value ? String(rawTextEl.value).trim() : '';
        var supplement = String(prep.requirementSupplement || '').trim();
        sections.push('【需求正文】\n' + (rawText || '（无文本）'));
        if (supplement) sections.push('【需求补充】\n' + supplement);
        var images = collectDocumentRequirementImages();
        return {
          mode: 'document',
          text: sections.join('\n\n'),
          images: images,
        };
      }
      sections.push('【手填需求描述】\n' + (getManualRequirementText() || '（仅图片）'));
      return {
        mode: 'manual',
        text: sections.join('\n\n'),
        images: getManualRequirementImages(),
      };
    }

    async function executeXmindGeneration(contract, visibleContext, moduleEntry) {
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
      var start = Date.now();
      var content = '';
      var fallbackToTextOnly = false;

      if (payload.images && payload.images.length) {
        if (!modelCanSeeImages && !payload.text) {
          throw new Error('当前 XMind 用例生成模型不支持图片，且需求文本为空');
        }
        if (modelCanSeeImages && xmindGenApi && typeof xmindGenApi.callModelWithContent === 'function') {
          var imageBlocks = await buildImageContentBlocks(payload.images, payload.mode === 'manual');
          if (imageBlocks.stats.sent > 0) {
            var blocks = [{ type: 'text', text: payload.text }].concat(imageBlocks.blocks || []);
            content = await callXmindModelWithGuard(function() {
              return xmindGenApi.callModelWithContent(model, blocks, prompt, {
                reasoningEffort: reasoning,
                temperature: temperature,
              });
            });
          } else {
            fallbackToTextOnly = true;
          }
        } else {
          fallbackToTextOnly = true;
        }
      } else {
        fallbackToTextOnly = true;
      }

      if (fallbackToTextOnly) {
        content = await callXmindModelWithGuard(function() {
          return xmindGenApi.callModelWithConfig(model, payload.text, prompt, reasoning, temperature);
        });
      }

      return {
        content: content,
        durationMs: Date.now() - start,
        prompt: prompt,
        text: payload.text,
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
      var summary = summarizeModelOutputText(rawMessage, 120);
      var reasonText = '模型调用出错，请稍后重试。';
      if (/超时/.test(rawMessage)) {
        reasonText = '模型响应超时，请稍后重试。';
      } else if (/503|service unavailable/i.test(rawMessage)) {
        reasonText = '模型服务暂时不可用，请稍后重试。';
      } else if (/network|fetch|failed to fetch|网络/i.test(rawMessage)) {
        reasonText = '模型连接失败，请检查网络后重试。';
      }
      return {
        resultKind: 'error',
        reasonText: reasonText,
        diagnostics: summary ? ['错误信息：' + summary] : [],
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
      if (!highlightedNodes || !highlightedNodes.length) {
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
      xmindState.root.status = '';
      xmindState.root.error = '';
      xmindState.root.updatedAt = Date.now();
      Object.keys(xmindState.modules || {}).forEach(function(key) {
        var moduleState = ensureModuleUiState(key);
        moduleState.running = false;
        moduleState.rootPendingActionId = '';
        moduleState.status = '';
        moduleState.error = '';
        moduleState.hideResults = false;
        moduleState.lastAction = 'rollback';
        moduleState.updatedAt = Date.now();
      });
      syncCaseGenOperationPointersLocal();
      clearAllTopupHighlights();
      if (casesGenApi && typeof casesGenApi.renderCaseGeneration === 'function') {
        casesGenApi.renderCaseGeneration();
      }
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
      var operations = [];
      var rootState = ensureRootUiState();
      if (rootState && rootState.running && rootState.lastAction) {
        operations.push({
          scope: 'root',
          actionId: String(rootState.lastAction || ''),
          label: '根节点',
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
      var visibleContext = buildVisibleModuleContext();
      var moduleTargets = {};
      var caseTargets = {};

      selection.forEach(function(item) {
        var meta = item && item.meta ? item.meta : null;
        if (!meta || !isDeleteNodeType(meta.type)) return;
        var moduleKey = String(meta.moduleKey || normalizeModuleKey(meta.moduleTitle || ''));
        var moduleEntry = moduleKey ? visibleContext.map[moduleKey] : null;
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
      if (casesGenApi && typeof casesGenApi.renderCaseGeneration === 'function') {
        casesGenApi.renderCaseGeneration();
      }
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

    function getRootNodeId() {
      return buildNodeId(['root', getRequirementLabelText()]);
    }

    function getModuleNodeId(moduleEntry) {
      return buildNodeId(['module', moduleEntry && moduleEntry.moduleKey ? moduleEntry.moduleKey : 'module']);
    }

    function createNode(topic, meta, children) {
      var stableNodeId = meta && meta.nodeId ? String(meta.nodeId) : '';
      var node = {
        id: stableNodeId || buildNodeId([meta && meta.type ? meta.type : 'node', topic]),
        topic: topic || '-',
        expanded: true,
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
      return nextMeta;
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
      });
    }

    function buildCaseTree(moduleEntry, row, caseIndex, topupHighlight) {
      var xmindCoreApi = getXmindCoreApi();
      var moduleTitle = moduleEntry ? moduleEntry.title : '模块';
      var item = row && row.item ? row.item : row;
      var caseTitle = item && item.title ? String(item.title) : ('用例' + String(caseIndex + 1));
      var caseSource = row && row.source ? String(row.source || '') : 'ai';
      var caseSourceIndex = row && Number.isFinite(Number(row.sourceIndex)) ? Number(row.sourceIndex) : caseIndex;
      var caseSignature = row && row.caseSignature ? String(row.caseSignature || '') : buildCaseSignature(item, moduleTitle);
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
      var expectedNode = createNode(fields[5] || '-', withTopupHighlightMeta({
        type: 'expected',
        moduleKey: moduleEntry.moduleKey,
        caseIndex: caseIndex,
        moduleTitle: moduleTitle,
        caseTitle: caseTitle,
        caseSource: caseSource,
        caseSourceIndex: caseSourceIndex,
        caseSignature: caseSignature,
        segment: 'expected'
      }, topupHighlight));
      var stepsNode = createNode(fields[4] || '-', withTopupHighlightMeta({
        type: 'steps',
        moduleKey: moduleEntry.moduleKey,
        caseIndex: caseIndex,
        moduleTitle: moduleTitle,
        caseTitle: caseTitle,
        caseSource: caseSource,
        caseSourceIndex: caseSourceIndex,
        caseSignature: caseSignature,
        segment: 'steps'
      }, topupHighlight), [expectedNode]);
      var preNode = createNode(fields[3] || '-', withTopupHighlightMeta({
        type: 'preconditions',
        moduleKey: moduleEntry.moduleKey,
        caseIndex: caseIndex,
        moduleTitle: moduleTitle,
        caseTitle: caseTitle,
        caseSource: caseSource,
        caseSourceIndex: caseSourceIndex,
        caseSignature: caseSignature,
        segment: 'preconditions'
      }, topupHighlight), [stepsNode]);
      var priorityNode = createNode(fields[2] || 'P1', withTopupHighlightMeta({
        type: 'priority',
        moduleKey: moduleEntry.moduleKey,
        caseIndex: caseIndex,
        moduleTitle: moduleTitle,
        caseTitle: caseTitle,
        caseSource: caseSource,
        caseSourceIndex: caseSourceIndex,
        caseSignature: caseSignature,
        segment: 'priority'
      }, topupHighlight), [preNode]);
      var caseMeta = withTopupHighlightMeta({
        type: 'case',
        moduleKey: moduleEntry.moduleKey,
        caseIndex: caseIndex,
        moduleTitle: moduleTitle,
        caseTitle: caseTitle,
        caseSource: caseSource,
        caseSourceIndex: caseSourceIndex,
        caseSignature: caseSignature,
      }, topupHighlight);
      return createNode(fields[1] || ('用例' + String(caseIndex + 1)), caseMeta, [priorityNode]);
    }

    function buildMindData() {
      clearStaleModuleUiState();
      var xmindState = ensureState();
      var rootState = ensureRootUiState();
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
                getCaseTopupHighlight(moduleState, caseIndex)
              ));
          });
        }
        if (moduleState && moduleState.running && moduleState.lastAction === MODULE_ACTIONS.APPEND) {
          moduleChildren.push(buildModulePendingNode(entry, {
            label: '追加生成中',
            actionId: MODULE_ACTIONS.APPEND,
          }));
        } else if (moduleState && moduleState.rootPendingActionId === ROOT_ACTIONS.EXISTING_CASES) {
          moduleChildren.push(buildModulePendingNode(entry, {
            label: '补全用例中',
            actionId: ROOT_ACTIONS.EXISTING_CASES,
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
          status: moduleState && moduleState.running
            ? 'running'
            : (moduleState && moduleState.status === 'error' ? 'error' : ''),
          statusText: moduleState && moduleState.error ? moduleState.error : '',
        }, getModuleNodeTopupHighlight(moduleState)), moduleChildren));
      });
      if (
        rootState.running
        && (rootState.lastAction === ROOT_ACTIONS.TOPUP_MODULES || rootState.lastAction === ROOT_ACTIONS.TOPUP_MODULES_CASES)
      ) {
        children.push(buildRootPendingNode(rootState.lastAction));
      }

      xmindState.treeSourceSignature = buildTreeSignature();
      return {
        nodeData: createNode(getRequirementLabelText(), {
          type: 'root',
          nodeId: getRootNodeId(),
          status: rootState.running ? 'running' : (rootState.status === 'error' ? 'error' : ''),
          statusText: rootState.error || '',
        }, children),
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
        var context = buildVisibleModuleContext();
        return getModuleActions(context.map[meta.moduleKey]).concat([deleteAction]);
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
      var context = buildVisibleModuleContext();
      var entry = context.map[meta.moduleKey] || null;
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

    function markPendingPlaceholderLink(nodeEl) {
      function decoratePendingPath(pathEl) {
        if (!pathEl || !pathEl.setAttribute) return false;
        pathEl.classList.add('xmind-casegen-pending-link');
        pathEl.setAttribute('data-xmind-casegen-link', 'topup-pending');
        pathEl.setAttribute('stroke-dasharray', '6 5');
        pathEl.setAttribute('stroke-linecap', 'round');
        return true;
      }
      var currentEl = nodeEl && nodeEl.closest ? nodeEl.closest('me-wrapper') : null;
      while (currentEl && currentEl !== mindContainer) {
        var parentEl = currentEl.parentElement;
        if (!parentEl || !parentEl.children) break;
        var candidatePath = null;
        for (var i = 0; i < parentEl.children.length; i += 1) {
          var childEl = parentEl.children[i];
          if (!childEl || childEl === currentEl || !childEl.tagName) continue;
          if (String(childEl.tagName).toLowerCase() !== 'svg') continue;
          if (!(childEl.classList && childEl.classList.contains('subLines'))) continue;
          var pathList = childEl.querySelectorAll ? childEl.querySelectorAll('path') : [];
          if (pathList && pathList.length) {
            candidatePath = pathList[pathList.length - 1];
          }
        }
        if (!candidatePath && parentEl.querySelectorAll) {
          var nestedPathList = parentEl.querySelectorAll('svg.subLines path, svg.lines path');
          if (nestedPathList && nestedPathList.length) {
            candidatePath = nestedPathList[nestedPathList.length - 1];
          }
        }
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

    function decorateNodeElement(nodeEl, nodeMeta) {
      if (!nodeEl || !nodeEl.classList) return;
      var statusBadge = nodeEl.querySelector ? nodeEl.querySelector('.xmind-node-status-badge') : null;
      var topupSpinner = nodeEl.querySelector ? nodeEl.querySelector('.xmind-node-topup-spinner') : null;
      if (statusBadge && statusBadge.parentNode) statusBadge.parentNode.removeChild(statusBadge);
      if (topupSpinner && topupSpinner.parentNode) topupSpinner.parentNode.removeChild(topupSpinner);
      nodeEl.classList.remove(
        'xmind-casegen-node-root',
        'xmind-casegen-node-module',
        'xmind-casegen-node-topup-placeholder',
        'xmind-casegen-node-topup-highlight-case',
        'xmind-casegen-node-status',
        'xmind-casegen-node-has-status',
        'xmind-casegen-node-has-pending-branch',
        'xmind-casegen-node-flow-left',
        'xmind-casegen-node-flow-right'
      );
      if (nodeEl.removeAttribute) {
        nodeEl.removeAttribute('data-xmind-topup-highlight-token');
        nodeEl.removeAttribute('data-xmind-topup-highlight-label');
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
          textSpan.textContent = meta.status === 'running' ? '生成中' : '失败';
          if (meta.status !== 'running' && meta.statusText) badge.title = String(meta.statusText);
          badge.appendChild(textSpan);
          nodeEl.appendChild(badge);
        }
        if (meta.topupHighlightToken) {
          nodeEl.classList.add('xmind-casegen-node-topup-highlight-case');
          nodeEl.setAttribute('data-xmind-topup-highlight-token', String(meta.topupHighlightToken));
          nodeEl.setAttribute('data-xmind-topup-highlight-label', String(meta.topupHighlightLabel || '本轮追加用例'));
        }
        return;
      }
      if (meta.type === 'topup-placeholder') {
        nodeEl.classList.add('xmind-casegen-node-topup-placeholder');
        var spinnerEl = document.createElement('span');
        spinnerEl.className = 'xmind-node-topup-spinner';
        spinnerEl.setAttribute('aria-hidden', 'true');
        nodeEl.appendChild(spinnerEl);
        markPendingPlaceholderLink(nodeEl);
        return;
      }
      if (meta.topupHighlightToken) {
        nodeEl.classList.add('xmind-casegen-node-topup-highlight-case');
        nodeEl.setAttribute('data-xmind-topup-highlight-token', String(meta.topupHighlightToken));
        nodeEl.setAttribute('data-xmind-topup-highlight-label', String(meta.topupHighlightLabel || '本轮追加用例'));
      }
    }

    function render(options) {
      options = options || {};
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
      if (!mindContainer || !isDrawerOpen()) {
        setDebugState({
          phase: 'render-skipped',
          reason: String(options.reason || ''),
          hasContainer: Boolean(mindContainer),
          drawerOpen: isDrawerOpen()
        });
        if (options.persist !== false) persistXmindState(false);
        return;
      }
      var freshRender = !mindInstance;
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
        restoreInlineControlsToBank();
        mindInstance = mindElixirCoreApi.renderMindMap(mindContainer, currentMindData, {
          instance: mindInstance,
          allowEdit: false,
          enableCustomBoxSelection: true,
          preserveViewState: Boolean(mindInstance),
          preserveAnchorNodeId: options.anchorNodeId || '',
          initialCenterNodeId: freshRender ? getRootNodeId() : '',
          onExportXmind: exportCurrentXmind,
          getNodeActions: getNodeActions,
          onNodeAction: handleNodeAction,
          onDeleteSelection: handleDeleteSelection,
          getNodeQuickAction: getNodeQuickAction,
          decorateNodeElement: decorateNodeElement,
        });
        mountInlineControls();
        bindTopupHighlightPresentation();
        setDebugState({ phase: 'render-success' });
        setTimeout(function() {
          syncTopupHighlightPresentation();
        }, 90);
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
      var context = buildVisibleModuleContext();
      return context.map[meta && meta.moduleKey ? meta.moduleKey : ''] || null;
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
        var entryBefore = visibleContext.map[normalizeModuleKey(item.module)] || null;
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
          rootState.hideAiLayer = false;
          rootState.status = '';
          rootState.error = '';
          rootState.lastAction = ROOT_ACTIONS.ROLLBACK;
          rootState.snapshotId = '';
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
      if (casesGenApi && typeof casesGenApi.snapshotAllCaseGenState === 'function') {
        currentSnapshotId = String(casesGenApi.snapshotAllCaseGenState() || '');
      }
      if (!currentSnapshotId) currentSnapshotId = snapshotAllCaseGenStateLocal();
      rootState.snapshotId = String(currentSnapshotId || ensureState().rootSnapshotId || '');
      rootState.lastAction = actionId;
      rootState.running = true;
      rootState.hideAiLayer = hadAiLayerBeforeAction;
      rootState.status = '';
      rootState.error = '';
      rootState.updatedAt = Date.now();
      if (actionId === ROOT_ACTIONS.EXISTING_CASES) {
        markRootPendingModules(visibleContext.list, actionId);
      }
      if (hadAiCasesBeforeAction) setAllModuleResultsVisibility(false);
      render({ reason: 'root-running', anchorNodeId: anchorNodeId, persist: false });

      try {
        var modelResult = await executeXmindGeneration(contract, visibleContext, null);
        var normalizedOutput = normalizeModelModulesOutputDetailed(modelResult.content);
        var filtered = filterModulesByContract(normalizedOutput.list, contract, visibleContext);
        var modules = filtered.list;
        var applied = applyRootOutput(actionId, modules, visibleContext, modelResult.durationMs);
        rootState.running = false;
        rootState.hideAiLayer = false;
        rootState.status = '';
        rootState.error = '';
        rootState.updatedAt = Date.now();
        clearRootPendingModules(actionId);
        if (!applied.changed) {
          var rootNoChangeInfo = buildRootNoChangeInfo(actionId, filtered.diagnostics, applied.diagnostics, normalizedOutput.diagnostics);
          recordGenerationHistory({
            scope: 'root',
            actionId: actionId,
            actionLabel: historyActionLabel,
            moduleCount: 0,
            details: [],
            resultKind: rootNoChangeInfo.resultKind,
            reasonText: rootNoChangeInfo.reasonText,
            diagnostics: rootNoChangeInfo.diagnostics,
            previewText: rootNoChangeInfo.previewText,
          });
          discardCaseGenOperationSnapshotEntry(currentSnapshotId);
          if (hadAiCasesBeforeAction) setAllModuleResultsVisibility(true);
          notifyStatus('本轮未生成新的模块或用例', 'warn', { forceInline: true });
          render({ reason: 'root-no-change', anchorNodeId: anchorNodeId });
          persistXmindState(true);
          return false;
        }
        ensureState().mode = (
          actionId === ROOT_ACTIONS.FULL_MODULES
          || actionId === ROOT_ACTIONS.REGENERATE_MODULES
        ) ? 'modules' : 'full';
        rootState.snapshotId = String(ensureState().rootSnapshotId || currentSnapshotId || '');
        recordGenerationHistory({
          scope: 'root',
          actionId: actionId,
          actionLabel: historyActionLabel,
          moduleCount: Array.isArray(applied.details) ? applied.details.length : 0,
          details: applied.details,
        });
        var message = '';
        if (actionId === ROOT_ACTIONS.FULL_MODULES) {
          message = '已生成 ' + String(applied.createdModules) + ' 个模块';
        } else if (actionId === ROOT_ACTIONS.REGENERATE_MODULES) {
          message = '已重新生成 ' + String(applied.createdModules) + ' 个模块';
        } else if (actionId === ROOT_ACTIONS.FULL_CASES) {
          message = (hadAiContentBeforeAction ? '已重新生成 ' : '已生成 ')
            + String(applied.createdModules) + ' 个模块，' + String(applied.addedCases) + ' 条用例';
        } else {
          message = '已补充 ' + String(applied.createdModules) + ' 个模块，' + String(applied.addedCases) + ' 条用例';
        }
        notifyStatus(message, 'ok');
        if (casesGenApi && typeof casesGenApi.renderCaseGeneration === 'function') {
          casesGenApi.renderCaseGeneration();
        }
        render({ reason: 'root-committed', anchorNodeId: anchorNodeId });
        persistXmindState(true);
        return true;
      } catch (err) {
        discardCaseGenOperationSnapshotEntry(currentSnapshotId);
        rootState.running = false;
        rootState.hideAiLayer = false;
        rootState.status = 'error';
        rootState.error = err && err.message ? String(err.message) : '未知错误';
        rootState.updatedAt = Date.now();
        clearRootPendingModules(actionId);
        var rootErrorInfo = buildGenerationErrorInfo(err);
        recordGenerationHistory({
          scope: 'root',
          actionId: actionId,
          actionLabel: historyActionLabel,
          moduleCount: 0,
          details: [],
          resultKind: rootErrorInfo.resultKind,
          reasonText: rootErrorInfo.reasonText,
          diagnostics: rootErrorInfo.diagnostics,
          previewText: rootErrorInfo.previewText,
        });
        if (hadAiCasesBeforeAction) setAllModuleResultsVisibility(true);
        notifyStatus('生成失败：' + rootState.error, 'err', { forceInline: true });
        render({ reason: 'root-error', anchorNodeId: anchorNodeId });
        persistXmindState(true);
        return false;
      }
    }

    async function runModuleAction(moduleEntry, actionId, options) {
      options = options || {};
      if (!moduleEntry) return false;
      if (!ensureActionAllowed(actionId, moduleEntry)) return false;
      if (!ensurePrepReadyOrOpen()) return false;
      var anchorNodeId = options.anchorNodeId || getModuleNodeId(moduleEntry);
      var moduleId = moduleEntry.aiModuleId || generateLocalId('xmind-mod');
      var createdModuleBeforeAction = !moduleEntry.aiModuleId;
      var snapshotId = '';

      if (actionId === MODULE_ACTIONS.ROLLBACK) {
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
            clearModuleTopupHighlight(rolledState);
            notifyStatus('已放弃该模块最近一次生成', 'ok');
            render({ reason: 'module-rollback', anchorNodeId: anchorNodeId });
          }
          return rolledBack;
        }
        return false;
      }

      if (casesGenApi && typeof casesGenApi.snapshotModuleCases === 'function') {
        snapshotId = casesGenApi.snapshotModuleCases(moduleId) || '';
      } else {
        snapshotId = createCaseGenOperationSnapshotLocal('module', moduleId) || '';
      }
      if (createdModuleBeforeAction) {
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
      moduleState.status = '';
      moduleState.error = '';
      moduleState.updatedAt = Date.now();
      moduleState.hideResults = hadAiCasesBeforeAction;
      if (actionId === MODULE_ACTIONS.APPEND) {
        clearModuleTopupHighlight(moduleState);
      } else {
        clearModuleTopupHighlight(moduleState);
      }
      render({ reason: 'module-running', anchorNodeId: anchorNodeId, persist: false });

      try {
        var visibleContext = buildVisibleModuleContext();
        var resolvedEntry = visibleContext.map[moduleEntry.moduleKey] || moduleEntry;
        var historyModuleTitle = normalizeModuleTitle(resolvedEntry && resolvedEntry.title ? resolvedEntry.title : moduleEntry.title);
        var contract = createOperationContract(actionId, resolvedEntry);
        var modelResult = await executeXmindGeneration(contract, visibleContext, resolvedEntry);
        var normalizedOutput = normalizeModelModulesOutputDetailed(modelResult.content);
        var filtered = filterModulesByContract(normalizedOutput.list, contract, visibleContext);
        var modules = filtered.list;
        var targetKey = normalizeModuleKey(resolvedEntry.title);
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
            module: resolvedEntry.title,
            key_scenarios: [],
            test_points: [],
            coupled_modules: [],
            cases: [],
          };
        }
        var currentAiCases = getAiCasesForModule(resolvedEntry.aiModuleId || moduleEntry.aiModuleId);
        var visibleCases = getVisibleCasesForModuleEntry(resolvedEntry).map(function(row) {
          return normalizeCaseItem(row.item, resolvedEntry.title);
        }).filter(Boolean);
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
            var appendNoChangeInfo = buildModuleNoChangeInfo(actionId, filtered.diagnostics, mergeDiagnostics, targetOutput, normalizedOutput.diagnostics);
            if (createdModuleBeforeAction && snapshotId) {
              rollbackCaseGenOperationSnapshotEntry(snapshotId);
            } else if (snapshotId) {
              discardCaseGenOperationSnapshotEntry(snapshotId);
            }
            if (createdModuleBeforeAction) {
              moduleEntry.aiModule = null;
              moduleEntry.aiModuleId = '';
            }
            recordGenerationHistory({
              scope: 'module',
              moduleTitle: historyModuleTitle,
              actionId: actionId,
              actionLabel: historyActionLabel,
              moduleCount: 1,
              details: [{ module: historyModuleTitle, caseCount: 0 }],
              resultKind: appendNoChangeInfo.resultKind,
              reasonText: appendNoChangeInfo.reasonText,
              diagnostics: appendNoChangeInfo.diagnostics,
              previewText: appendNoChangeInfo.previewText,
            });
            moduleState.running = false;
            moduleState.hideResults = false;
            moduleState.snapshotId = '';
            notifyStatus('当前模块未补充到新的用例', 'warn', { forceInline: true });
            render({ reason: 'module-append-empty', anchorNodeId: anchorNodeId });
            persistXmindState(true);
            return false;
          }
          commitCaseList(moduleEntry.aiModuleId, nextList, modelResult.durationMs, '', 'keep-valid');
          setModuleTopupHighlight(moduleState, resolvedEntry.title, visibleCases.length, appended.length);
        } else {
          nextList = Array.isArray(targetOutput.cases) ? targetOutput.cases.slice() : [];
          if (!nextList.length) {
            var fullNoChangeInfo = buildModuleNoChangeInfo(actionId, filtered.diagnostics, mergeDiagnostics, targetOutput, normalizedOutput.diagnostics);
            if (createdModuleBeforeAction && snapshotId) {
              rollbackCaseGenOperationSnapshotEntry(snapshotId);
            } else if (snapshotId) {
              discardCaseGenOperationSnapshotEntry(snapshotId);
            }
            if (createdModuleBeforeAction) {
              moduleEntry.aiModule = null;
              moduleEntry.aiModuleId = '';
            }
            recordGenerationHistory({
              scope: 'module',
              moduleTitle: historyModuleTitle,
              actionId: actionId,
              actionLabel: historyActionLabel,
              moduleCount: 1,
              details: [{ module: historyModuleTitle, caseCount: 0 }],
              resultKind: fullNoChangeInfo.resultKind,
              reasonText: fullNoChangeInfo.reasonText,
              diagnostics: fullNoChangeInfo.diagnostics,
              previewText: fullNoChangeInfo.previewText,
            });
            moduleState.running = false;
            moduleState.hideResults = false;
            moduleState.snapshotId = '';
            notifyStatus('当前模块未生成到有效用例', 'warn', { forceInline: true });
            render({ reason: 'module-full-empty', anchorNodeId: anchorNodeId });
            persistXmindState(true);
            return false;
          }
          commitCaseList(moduleEntry.aiModuleId, nextList, modelResult.durationMs, '', '');
          clearModuleTopupHighlight(moduleState);
        }
        moduleState.running = false;
        moduleState.status = '';
        moduleState.error = '';
        moduleState.hideResults = false;
        moduleState.updatedAt = Date.now();
        recordGenerationHistory({
          scope: 'module',
          moduleTitle: historyModuleTitle,
          actionId: actionId,
          actionLabel: historyActionLabel,
          moduleCount: 1,
          details: [{
            module: historyModuleTitle,
            caseCount: actionId === MODULE_ACTIONS.APPEND ? appended.length : nextList.length,
          }],
        });
        notifyStatus(
          actionId === MODULE_ACTIONS.APPEND
            ? ('已为该模块补充 ' + String(appended.length) + ' 条用例')
            : ((hadAiCasesBeforeAction ? '已重新生成 ' : '已生成 ') + String(nextList.length) + ' 条用例'),
          'ok'
        );
        if (casesGenApi && typeof casesGenApi.renderCaseGeneration === 'function') {
          casesGenApi.renderCaseGeneration();
        }
        render({ reason: 'module-committed', anchorNodeId: anchorNodeId });
        persistXmindState(true);
        return true;
      } catch (err) {
        if (createdModuleBeforeAction && snapshotId) {
          rollbackCaseGenOperationSnapshotEntry(snapshotId);
          moduleEntry.aiModule = null;
          moduleEntry.aiModuleId = '';
        } else if (snapshotId) {
          discardCaseGenOperationSnapshotEntry(snapshotId);
        }
        moduleState.running = false;
        moduleState.status = 'error';
        moduleState.error = err && err.message ? String(err.message) : '未知错误';
        moduleState.hideResults = false;
        moduleState.updatedAt = Date.now();
        var moduleErrorInfo = buildGenerationErrorInfo(err);
        recordGenerationHistory({
          scope: 'module',
          moduleTitle: normalizeModuleTitle(moduleEntry && moduleEntry.title ? moduleEntry.title : ''),
          actionId: actionId,
          actionLabel: historyActionLabel,
          moduleCount: 0,
          details: [],
          resultKind: moduleErrorInfo.resultKind,
          reasonText: moduleErrorInfo.reasonText,
          diagnostics: moduleErrorInfo.diagnostics,
          previewText: moduleErrorInfo.previewText,
        });
        notifyStatus('生成失败：' + moduleState.error, 'err', { forceInline: true });
        render({ reason: 'module-error', anchorNodeId: anchorNodeId });
        persistXmindState(true);
        return false;
      }
    }

    function handleNodeAction(actionId, nodeMeta) {
      if (!actionId) return false;
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

    function open() {
      switchTab('casesgen');
      setCasesGenModulesView();
      var drawer = ensureDrawer();
      if (drawer && typeof drawer.open === 'function') {
        drawer.open();
        return true;
      }
      render({ reason: 'open-fallback' });
      return false;
    }

    function close() {
      var drawer = ensureDrawer();
      if (drawer && typeof drawer.close === 'function') {
        drawer.close();
        return true;
      }
      destroyMind();
      return false;
    }

    function bindButtons() {
      if (openBtn) {
        openBtn.addEventListener('click', function() {
          open();
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
      if (summaryCloseBtn) {
        summaryCloseBtn.addEventListener('click', function() {
          closeSummaryDialog();
        });
      }
      if (prepResetBtn) {
        prepResetBtn.addEventListener('click', function() {
          confirmResetPrepState();
        });
      }
      if (exportBtn) {
        exportBtn.addEventListener('click', function() {
          exportCurrentXmind();
        });
      }
      if (summaryDialogBodyEl) {
        summaryDialogBodyEl.addEventListener('click', function(event) {
          var stepTarget = event && event.target && event.target.closest
            ? event.target.closest('[data-prep-step]')
            : null;
          if (stepTarget) {
            var step = Number(stepTarget.getAttribute('data-prep-step'));
            if (Number.isFinite(step)) setPrepStep(step);
            return;
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
            setPrepField('requirementMode', target.value === 'manual' ? 'manual' : 'document');
            renderOpenedSummaryDialog();
            return;
          }
          if (target.name === 'xmindCaseImportMode') {
            setPrepField('caseImportMode', target.value === 'import' ? 'import' : 'skip');
            renderOpenedSummaryDialog();
            scheduleRender('case-import-mode-change');
            return;
          }
          var settingKey = target.getAttribute ? target.getAttribute('data-casegen-setting') : '';
          if (settingKey) {
            setCaseGenOption(settingKey, target.type === 'checkbox' ? target.checked === true : (target.value || ''));
            renderOpenedSummaryDialog();
          }
        });
        summaryDialogBodyEl.addEventListener('input', debounce(function(event) {
          var target = event && event.target ? event.target : null;
          if (!target) return;
          var prepInputKey = target.getAttribute ? target.getAttribute('data-prep-input') : '';
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
        }, 120));
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
      }
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('keydown', function(event) {
          if (!event || event.key !== 'Escape') return;
          if (!isDrawerOpen() || summaryDialogOpen !== true) return;
          closeSummaryDialog();
        });
      }
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

    ensureDrawer();
    bindButtons();
    bindRenderListeners();
    updateSummary();

    return {
      open: open,
      close: close,
      render: render,
      exportCurrentXmind: exportCurrentXmind,
      switchTab: switchTab,
      isOpen: isDrawerOpen,
    };
  }

  window.app = window.app || {};
  window.app.xmindCasegen = { init: init };
})();
