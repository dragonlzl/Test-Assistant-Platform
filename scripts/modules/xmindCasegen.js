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
    var statusEl = document.getElementById('xmindCaseGenStatus');
    var mindContainer = document.getElementById('xmindCaseGenMindContainer');

    var renderTimer = 0;
    var listObserver = null;
    var drawerInstance = null;
    var summaryDialogOpen = false;
    var summaryDialogMode = 'prep';
    var currentMindData = null;
    var mindInstance = null;
    var pendingCasesGenPageRender = false;
    var mindApiReadyPromise = null;
    var inlinePrimaryHost = null;
    var inlineOverviewHost = null;
    var inlineControlsHost = null;
    var inlineStatusHost = null;
    var inlineModelHost = null;
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
    var viewStateBeforeUnloadBound = false;
    var drawerRestoreRetryTimer = 0;
    var drawerRestoreRetryCount = 0;
    var drawerRestoreStableCount = 0;
    var recoveredStatePersistTimer = 0;
    var pendingOpenCenterRoot = false;
    var storeValidationClearTimer = 0;
    var xmindTaskListenerBound = false;
    var xmindTaskProcessingMap = {};
    var rootPipelinePumpMap = {};
    var storeValidationState = {
      moduleKeys: {},
      caseKeys: {},
    };

    var STEP_REQUIREMENT = 1;
    var STEP_CASES = 2;
    var STEP_OPTIONS = 3;
    var HISTORY_LIMIT = 80;
    var DRAWER_RESTORE_RETRY_LIMIT = 18;
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

    function createDefaultViewState() {
      return {
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

    function notifyFloatingStatus(text, type, durationMs) {
      if (!text) return;
      if (typeof showCenterToast === 'function') {
        showCenterToast(String(text), type || 'warn', durationMs || 5000);
        return;
      }
      notifyInlineStatus(text, type || '');
    }

    function syncCasesGenPageRender(options) {
      var opts = options || {};
      if (!casesGenApi || typeof casesGenApi.renderCaseGeneration !== 'function') return false;
      if (opts.force !== true && isDrawerOpen()) {
        pendingCasesGenPageRender = true;
        return false;
      }
      pendingCasesGenPageRender = false;
      casesGenApi.renderCaseGeneration();
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
        storeBtn,
        interruptBtn,
        deleteUndoBtn,
        deleteRedoBtn,
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
      inlinePrimaryHost = null;
      inlineOverviewHost = null;
      inlineControlsHost = null;
      inlineStatusHost = null;
      inlineModelHost = null;
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

    function getInlineToolbarOverviewSummary() {
      var context = buildVisibleModuleContext();
      var moduleCount = Array.isArray(context && context.list) ? context.list.length : 0;
      var caseCount = 0;
      (context && Array.isArray(context.list) ? context.list : []).forEach(function(entry) {
        caseCount += getVisibleCasesForModuleEntry(entry).length;
      });
      var runningCount = collectRunningGenerationOperations().length;
      return {
        runningCount: runningCount,
        runningState: runningCount > 0 ? 'running' : 'idle',
        runningLabel: runningCount > 0 ? '正在执行生成任务' : '当前没有生成任务',
        runningHint: runningCount > 0
          ? ('当前共有 ' + String(runningCount) + ' 个生成任务在执行')
          : '当前可继续发起生成、补全或删除操作',
        moduleCount: moduleCount,
        caseCount: caseCount,
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
      host.innerHTML = ''
        + '<div class="' + taskClassName + '" data-xmind-casegen-task-state="' + escapeHtml(summary.runningState) + '" title="' + escapeHtml(summary.runningHint) + '">'
        + '<span class="xmind-casegen-inline-task-dot" aria-hidden="true"></span>'
        + '<span class="xmind-casegen-inline-task-label">' + escapeHtml(summary.runningLabel) + '</span>'
        + taskBadgeHtml
        + '</div>'
        + '<div class="xmind-casegen-inline-counts" data-xmind-casegen-counts title="当前画布展示的模块和用例总数会随生成、补全、删除实时刷新">'
        + '<span class="xmind-casegen-inline-count-pill" data-xmind-casegen-count-modules>'
        + '<strong>' + escapeHtml(String(summary.moduleCount)) + '</strong><span>模块</span>'
        + '</span>'
        + '<span class="xmind-casegen-inline-count-pill" data-xmind-casegen-count-cases>'
        + '<strong>' + escapeHtml(String(summary.caseCount)) + '</strong><span>用例</span>'
        + '</span>'
        + '</div>';
      return true;
    }

    function mountInlineControls() {
      var controlsRoot = getMindControlsRoot();
      var primaryHost = getInlinePrimaryHost();
      var historyGroup = getInlineGroupHost('history');
      var persistenceGroup = getInlineGroupHost('result');
      var deleteGroup = getInlineGroupHost('delete-history');
      var taskGroup = getInlineGroupHost('task');
      var statusHost = getInlineStatusHost();
      if (!controlsRoot || !primaryHost || !historyGroup || !persistenceGroup || !deleteGroup || !taskGroup) {
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
      if (storeBtn && persistenceGroup.appendChild) {
        applyInlineButtonStyle(storeBtn, 'xmind-casegen-inline-btn-success');
        persistenceGroup.appendChild(storeBtn);
      }
      if (exportBtn && persistenceGroup.appendChild) {
        applyInlineButtonStyle(exportBtn);
        persistenceGroup.appendChild(exportBtn);
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
      syncInlineModelPicker();
      return true;
    }

    function syncInterruptButton() {
      if (!interruptBtn) return;
      var runningCount = collectRunningGenerationOperations().length;
      interruptBtn.disabled = runningCount <= 0;
      interruptBtn.title = runningCount > 0
        ? ('中断当前 XMind 生成中的 ' + String(runningCount) + ' 个任务')
        : '当前没有进行中的 XMind 生成任务';
      syncInlineToolbarOverview();
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
      viewStateScrollTarget = null;
      viewStateScrollHandler = null;
      viewStateInteractionTarget = null;
      viewStateClickHandler = null;
      viewStateWheelHandler = null;
    }

    function clearDrawerRestoreRetry() {
      if (drawerRestoreRetryTimer) {
        clearTimeout(drawerRestoreRetryTimer);
        drawerRestoreRetryTimer = 0;
      }
      drawerRestoreRetryCount = 0;
      drawerRestoreStableCount = 0;
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
          var shouldCenterRootAfterOpen = pendingOpenCenterRoot === true;
          pendingOpenCenterRoot = false;
          getViewState().drawerOpen = true;
          getViewState().updatedAt = Date.now();
          clearOpenButtonCompletionNotice({ persist: true });
          if (drawerEl && drawerEl.classList) {
            drawerEl.classList.toggle('xmind-drawer-fullscreen', getViewState().fullscreen === true);
          }
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
              render({
                reason: 'drawer-open',
                persist: false,
                centerRootAfterRender: shouldCenterRootAfterOpen,
              });
            }, 90);
          } catch (errRender) {
            setDebugState({
              phase: 'drawer-open-schedule-render-error',
              error: errRender && errRender.message ? String(errRender.message) : '未知错误'
            });
          }
        },
        onClose: function() {
          clearDrawerRestoreRetry();
          clearStoreValidationState(true);
          captureCurrentViewState();
          getViewState().drawerOpen = false;
          getViewState().fullscreen = false;
          getViewState().updatedAt = Date.now();
          syncOpenButtonState();
          if (drawerEl && drawerEl.classList) {
            drawerEl.classList.remove('xmind-drawer-fullscreen');
          }
          closeSummaryDialog({ skipPersist: true });
          destroyMind();
          flushDeferredCasesGenPageRender();
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
          openButtonDotVisible: false,
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
      if (!state.xmindCaseGen.viewState || typeof state.xmindCaseGen.viewState !== 'object') {
        state.xmindCaseGen.viewState = createDefaultViewState();
      }
      if (!Array.isArray(state.xmindCaseGen.viewState.collapsedNodeKeys)) {
        state.xmindCaseGen.viewState.collapsedNodeKeys = [];
      }
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
      if (!Number.isFinite(Number(state.xmindCaseGen.nextSnapshotId))) {
        state.xmindCaseGen.nextSnapshotId = 1;
      }
      state.xmindCaseGen.mode = state.xmindCaseGen.mode === 'full' ? 'full' : 'modules';
      state.xmindCaseGen.treeSourceSignature = String(state.xmindCaseGen.treeSourceSignature || '');
      state.xmindCaseGen.hasModuleSkeleton = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      state.xmindCaseGen.hasImportedBaseline = hasImportedBaselineCases();
      state.xmindCaseGen.openButtonDotVisible = state.xmindCaseGen.openButtonDotVisible === true;
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
      state.xmindCaseGen.viewState.collapsedNodeKeys = normalizeUniqueStringList(state.xmindCaseGen.viewState.collapsedNodeKeys);
      state.xmindCaseGen.viewState.treeSourceSignature = String(state.xmindCaseGen.viewState.treeSourceSignature || '');
      state.xmindCaseGen.viewState.updatedAt = Number(state.xmindCaseGen.viewState.updatedAt || 0);
      if (!isFinite(state.xmindCaseGen.viewState.updatedAt) || state.xmindCaseGen.viewState.updatedAt < 0) {
        state.xmindCaseGen.viewState.updatedAt = 0;
      }
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
        cancelled: input.cancelled === true,
        cancelReason: input.cancelReason ? String(input.cancelReason || '') : '',
        errorCount: Number(input.errorCount || 0),
        createdModules: Number(input.createdModules || 0),
        addedCases: Number(input.addedCases || 0),
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
        cancelled: snapshot.cancelled === true,
        cancelReason: snapshot.cancelReason,
        errorCount: snapshot.errorCount,
        createdModules: snapshot.createdModules,
        addedCases: snapshot.addedCases,
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

    function getRootPipelineSnapshotWeight(pipeline) {
      var detailMap = pipeline && pipeline.detailMap && typeof pipeline.detailMap === 'object'
        ? pipeline.detailMap
        : {};
      var detailCount = Object.keys(detailMap).length;
      var diagnosticsCount = Array.isArray(pipeline && pipeline.diagnostics) ? pipeline.diagnostics.length : 0;
      var pendingCount = Array.isArray(pipeline && pipeline.pendingQueue) ? pipeline.pendingQueue.length : 0;
      return (
        Number(pipeline && pipeline.createdModules || 0) * 1000
        + Number(pipeline && pipeline.addedCases || 0) * 10
        + detailCount * 100
        + diagnosticsCount * 10
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
      base.hadAiContentBeforeAction = base.hadAiContentBeforeAction === true || incoming.hadAiContentBeforeAction === true;
      base.hadAiLayerBeforeAction = base.hadAiLayerBeforeAction === true || incoming.hadAiLayerBeforeAction === true;
      base.hadAiCasesBeforeAction = base.hadAiCasesBeforeAction === true || incoming.hadAiCasesBeforeAction === true;
      base.cancelled = base.cancelled === true || incoming.cancelled === true;
      base.errorCount = Math.max(Number(base.errorCount || 0), Number(incoming.errorCount || 0));
      base.createdModules = Math.max(Number(base.createdModules || 0), Number(incoming.createdModules || 0));
      base.addedCases = Math.max(Number(base.addedCases || 0), Number(incoming.addedCases || 0));
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
      return {
        moduleId: String(moduleEntry && moduleEntry.aiModuleId ? moduleEntry.aiModuleId : ''),
        moduleKey: String(moduleEntry && moduleEntry.moduleKey ? moduleEntry.moduleKey : ''),
        moduleTitle: normalizeModuleTitle(moduleEntry && moduleEntry.title ? moduleEntry.title : ''),
        actionId: String(descriptor && descriptor.actionId ? descriptor.actionId : ''),
        rootPendingActionId: String(descriptor && descriptor.rootPendingActionId ? descriptor.rootPendingActionId : ''),
        rootPipelineNewModule: descriptor && descriptor.rootPipelineNewModule === true,
        forceCreatedModuleBeforeAction: descriptor && descriptor.forceCreatedModuleBeforeAction === true,
        anchorNodeId: descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'anchorNodeId')
          ? String(descriptor.anchorNodeId || '')
          : '',
      };
    }

    function resolveRootPipelineDescriptor(serialized, visibleContext) {
      if (!serialized || typeof serialized !== 'object') return null;
      var context = visibleContext && visibleContext.list ? visibleContext : buildVisibleModuleContext();
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
      if (!moduleEntry && targetModuleKey && context.map && context.map[targetModuleKey]) {
        moduleEntry = context.map[targetModuleKey];
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

    function persistXmindState(useImmediate) {
      ensureState().hasImportedBaseline = hasImportedBaselineCases();
      if (useImmediate === true) persistWorkflowStateNow();
      else persistWorkflowState();
      if (useImmediate === true) {
        syncRunningTaskRestoreContexts();
      }
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
        openButtonDotVisible: false,
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
      state.caseGenSuggestions = {};
      state.caseGenModuleStatus = {};
      state.caseGenProgress = {};
      state.caseGenTiming = {};
      state.caseGenProgressNotice = {};
      state.caseGenRunning = new Set();
    }

    function resetWorkflowStateForXmind(drawerOpen, fullscreen) {
      var didReuseSharedReset = false;
      if (prepApi && typeof prepApi.interruptActiveExecutions === 'function') {
        try {
          prepApi.interruptActiveExecutions('重置当前 XMind 生成前置准备');
        } catch (err) {
          // ignore
        }
      }
      if (prepApi && typeof prepApi.resetWorkflowData === 'function') {
        prepApi.resetWorkflowData();
        didReuseSharedReset = true;
      } else {
        resetRequirementPrepInputs();
        resetImportedCasePrepInputs();
        resetSharedCaseGenOutputs();
      }
      state.xmindCaseGen = createInitialXmindState({
        drawerOpen: drawerOpen === true,
        fullscreen: fullscreen === true,
      });
      return didReuseSharedReset;
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
      clearDrawerRestoreRetry();
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

    function resetAfterStoreSuccess() {
      return resetXmindCasegenState({
        reason: 'store-success-reset',
        reopenPrepDialog: false,
        toastText: '',
        silentBlocked: true,
      });
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
      viewState.drawerOpen = isDrawerOpen();
      if (!viewState.drawerOpen || !mindInstance) {
        viewState.fullscreen = drawerEl && drawerEl.classList ? drawerEl.classList.contains('xmind-drawer-fullscreen') : false;
        viewState.updatedAt = Date.now();
        return cloneJson(viewState, createDefaultViewState());
      }
      var captured = mindInstance && typeof mindInstance.__tapCaptureViewState === 'function'
        ? mindInstance.__tapCaptureViewState()
        : null;
      var drawerState = mindInstance && typeof mindInstance.__tapCaptureDrawerState === 'function'
        ? mindInstance.__tapCaptureDrawerState()
        : null;
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
      var collapsedFromDom = collectCollapsedNodeKeysFromMindDom();
      viewState.collapsedNodeKeys = collapsedFromDom.length
        ? collapsedFromDom
        : (mindData && mindData.nodeData ? collectCollapsedNodeKeysFromMindData(mindData.nodeData) : []);
      viewState.treeSourceSignature = String(ensureState().treeSourceSignature || '');
      viewState.updatedAt = Date.now();
      return cloneJson(viewState, createDefaultViewState());
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
      }, 90);
    }

    function getRestorableViewState(treeSignature) {
      var viewState = getViewState();
      if (viewState.drawerOpen !== true) return null;
      if (!viewState.transform) return null;
      if (String(viewState.treeSourceSignature || '') !== String(treeSignature || '')) return null;
      return {
        transform: String(viewState.transform || ''),
        scaleVal: Number(viewState.scaleVal || 1),
        scrollLeft: Number(viewState.scrollLeft || 0),
        scrollTop: Number(viewState.scrollTop || 0),
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
      viewStateClickHandler = function() {
        scheduleCaptureCurrentViewState(false);
      };
      viewStateWheelHandler = function() {
        scheduleCaptureCurrentViewState(false);
      };
      mindContainer.addEventListener('click', viewStateClickHandler, true);
      mindContainer.addEventListener('wheel', viewStateWheelHandler, true);
      var mapEl = mindContainer.querySelector ? mindContainer.querySelector('.map-canvas') : null;
      var canvasEl = mindContainer.querySelector ? mindContainer.querySelector('[data-mind-canvas]') : null;
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

      function attempt() {
        var mindElixirCoreApi = getMindElixirCoreApi();
        var centered = false;
        if (mindInstance && mindElixirCoreApi && typeof mindElixirCoreApi.centerMindNode === 'function') {
          try {
            centered = mindElixirCoreApi.centerMindNode(mindInstance, getRootNodeId()) === true;
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
        (function(runDelay) {
          setTimeout(function() {
            attempt();
          }, runDelay);
        }(delayMs));
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
          if (!isDrawerOpen()) return;
          scheduleCaptureCurrentViewState(true);
        }, true);
      }
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', function() {
          if (!document || document.visibilityState !== 'hidden') return;
          if (!isDrawerOpen()) return;
          scheduleCaptureCurrentViewState(true);
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
      return true;
    }

    function isPrepBaseField(key) {
      return key === 'requirementMode'
        || key === 'requirementSupplement'
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

    function getRequirementLabelText() {
      var label = state.requirementLabel ? String(state.requirementLabel).trim() : '';
      if (!label) {
        label = normalizeRequirementLabelFromFileName(state.lastRawImportName || '');
      }
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
        summaryText: payload && payload.summaryText ? String(payload.summaryText) : '',
        moduleCount: moduleCount,
        details: details,
        resultKind: payload && (
          payload.resultKind === 'no-change'
          || payload.resultKind === 'cancelled'
          || payload.resultKind === 'error'
        ) ? String(payload.resultKind) : 'changed',
        reasonText: payload && payload.reasonText ? String(payload.reasonText) : '',
        diagnostics: diagnostics,
        previewText: normalizeHistoryPreviewText(payload && payload.previewText),
        createdAt: Date.now(),
      });
      if (history.length > HISTORY_LIMIT) history.length = HISTORY_LIMIT;
      xmindState.history = history;
      persistXmindState(true);
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
      var lines = [];
      if (!enabledLabels.length) return '';
      lines.push('已开启的生成选项属于本轮输出的硬性覆盖要求，不是参考建议。');
      lines.push('本轮必须直接覆盖：' + enabledLabels.join('、') + '。');
      if (isRootFullGenerationContract(contract)) {
        lines.push('当前是根节点首轮全量/重生成动作，首次输出必须直接覆盖上述要求，不允许把相关覆盖留到后续补全或追加。');
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

    function setCaseGenOption(key, value) {
      if (casesGenApi && typeof casesGenApi.setCaseGenSettingValue === 'function') {
        casesGenApi.setCaseGenSettingValue(key, value);
      } else {
        state.caseGenSettings = state.caseGenSettings || {};
        state.caseGenSettings[key] = value;
      }
      markPrepNeedsReconfirm(false);
      persistXmindState(false);
    }

    function renderPrepStepTabs() {
      var prep = getPrepState();
      var steps = [
        { step: STEP_REQUIREMENT, label: '需求导入', shortLabel: 'step1', done: hasRequirementReady() },
        { step: STEP_CASES, label: '是否导入用例', shortLabel: 'step2', done: hasCaseStepReady() },
        { step: STEP_OPTIONS, label: '生成选项', shortLabel: 'step3', done: prep.completed === true },
      ];
      return '<div class="xmind-casegen-prep-stepper">'
        + steps.map(function(item) {
          var classes = ['xmind-casegen-prep-step'];
          if (prep.step === item.step) classes.push('is-active');
          else if (item.done) classes.push('is-done');
          return '<span class="' + classes.join(' ') + '" title="' + escapeHtml(item.label) + '"' + (prep.step === item.step ? ' aria-current="step"' : '') + '>'
            + '<span class="xmind-casegen-prep-step-badge">' + escapeHtml(item.shortLabel) + '</span>'
            + '</span>';
        }).join('')
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
      var docStatusText = docValue
        ? ('已导入' + (docImportName ? '：' + docImportName + '，' : '，') + '正文 ' + String(docValue.length) + ' 字')
        : '导入后内容会同步到当前需求上下文';
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
        +     '<span class="xmind-casegen-prep-status-badge is-' + (hasRequirementReady() ? 'done' : 'ready') + '">' + (hasRequirementReady() ? '已完成' : '待完成') + '</span>'
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
        +     '<span class="xmind-casegen-prep-status-badge is-' + (hasCaseStepReady() ? 'done' : 'ready') + '">' + (hasCaseStepReady() ? '已完成' : '待选择') + '</span>'
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

    function renderOptionsStepCard() {
      var prep = getPrepState();
      var settings = getCaseGenSettingsSnapshot();
      var locked = isPrepBaseLocked();
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
        +     '<span class="xmind-casegen-prep-status-badge is-' + (prep.completed ? 'done' : 'ready') + '">' + (prep.completed ? '已确认' : (locked ? '待重新确认' : '待确认')) + '</span>'
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
          return;
        } catch (err) {
          // ignore
        }
      }
      if (typeof document === 'undefined' || !document.querySelector) return;
      var menu = document.querySelector('.xmind-node-context-menu.is-open');
      if (!menu || !menu.classList) return;
      menu.classList.remove('is-open');
      if (menu.setAttribute) menu.setAttribute('aria-hidden', 'true');
    }

    function openSummaryDialog(step) {
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
      hideOpenMindContextMenu();
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
      if (summaryDialogTitleEl) {
        summaryDialogTitleEl.textContent = mode === 'history' ? '生成记录' : '生成前置准备';
      }
      if (summaryDialogDescEl) {
        summaryDialogDescEl.textContent = mode === 'history'
          ? '记录当前 XMind 用例生成里每次节点操作的结果摘要。'
          : '按 3 步完成前置准备，确认后 step1 和 step2 会在本次生成中锁定。';
      }
      if (!open) return;
      if (mode === 'history') renderHistoryDialog();
      else renderPrepDialog();
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
        if (!hasRequirementReady() || !hasCaseStepReady()) return false;
        var shouldCenterRoot = prep.completed !== true && String(prep.caseImportMode || '') === 'import';
        prep.baseLocked = true;
        prep.completed = true;
        prep.step = STEP_OPTIONS;
        persistXmindState(true);
        notifySuccessToast('已保存生成前置准备', 3000);
        closeSummaryDialog({ skipPersist: true });
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
      ensureState().hasImportedBaseline = hasImportedBaselineCases();
      ensureState().hasModuleSkeleton = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      syncOpenButtonState();
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
      var prep = getPrepState();
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
      ['需求标识', '需求正文', '需求补充', '手填需求描述', '本轮生成选项说明', '首轮生成硬约束'].forEach(function(title) {
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
      if (retryInstruction) {
        requestText += '\n\n【首轮生成补强指令】\n' + retryInstruction;
        if (Array.isArray(contentBlocks) && contentBlocks.length && contentBlocks[0] && contentBlocks[0].type === 'text') {
          contentBlocks[0].text = requestText;
        }
      }
      return {
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

    async function buildXmindGenerationTaskInput(contract, visibleContext, moduleEntry) {
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

      if (payload.images && payload.images.length) {
        if (!modelCanSeeImages && !payload.text) {
          throw new Error('当前 XMind 用例生成模型不支持图片，且需求文本为空');
        }
        if (modelCanSeeImages && xmindGenApi && typeof xmindGenApi.callModelWithContent === 'function') {
          var imageBlocks = await buildImageContentBlocks(payload.images, payload.mode === 'manual');
          if (imageBlocks.stats.sent > 0) {
            contentBlocks = [{ type: 'text', text: payload.text }].concat(imageBlocks.blocks || []);
            if (estimateTaskContentBlocksSize(contentBlocks) > 1800000 && String(payload.text || '').trim()) {
              degradedToTextOnly = true;
            } else {
              requestMode = 'content';
            }
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
      var restorableViewState = getRestorableViewState(ensureState().treeSourceSignature);
      var restorableDrawerState = getRestorableDrawerState(ensureState().treeSourceSignature);
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
          initialViewState: mindInstance ? null : restorableViewState,
          initialDrawerState: mindInstance ? null : restorableDrawerState,
          preserveAnchorNodeId: options.anchorNodeId || '',
          initialCenterNodeId: freshRender && !restorableViewState ? getRootNodeId() : '',
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
        syncDeleteHistoryButtons();
        bindTopupHighlightPresentation();
        bindLiveViewStateCapture();
        setDebugState({ phase: 'render-success' });
        setTimeout(function() {
          syncTopupHighlightPresentation();
        }, 90);
        if (options.centerRootAfterRender === true) {
          centerRootNodeView({ persist: true });
        }
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

    function isManagedTaskTerminal(task) {
      var status = task && task.status ? String(task.status || '') : '';
      return status === 'done' || status === 'error' || status === 'cancelled';
    }

    function listManagedXmindTasks() {
      var manager = getXmindTaskManager();
      if (!manager || typeof manager.getTasks !== 'function') return [];
      var list = manager.getTasks();
      return Array.isArray(list) ? list : [];
    }

    function clearManagedRunningUiState() {
      var rootState = ensureRootUiState();
      rootState.running = false;
      rootState.taskId = '';
      rootState.hideAiLayer = false;
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
      var rootState = ensureRootUiState();
      rootState.running = true;
      rootState.taskId = relatedTasks[0] && relatedTasks[0].scope === 'root'
        ? String(relatedTasks[0].id || '')
        : String(pipeline.id || '');
      rootState.lastAction = String(pipeline.actionId || rootState.lastAction || '');
      rootState.snapshotId = String(pipeline.snapshotId || rootState.snapshotId || '');
      rootState.hideAiLayer = pipeline.stage === 'discovering' && pipeline.hadAiLayerBeforeAction === true;
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

    function syncManagedRunningUiState(options) {
      var opts = options || {};
      var tasks = Array.isArray(opts.tasks) ? opts.tasks : listManagedXmindTasks();
      var runningTasks = tasks.filter(function(task) {
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
      if (opts.persist === true) persistXmindState(true);
      else if (opts.persist === false) {
        // noop
      } else persistXmindState(false);
      if (opts.render === true && isDrawerOpen()) {
        render({
          reason: opts.reason || 'task-sync',
          persist: false,
          anchorNodeId: opts.anchorNodeId || '',
        });
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
      var context = visibleContext && visibleContext.map ? visibleContext : buildVisibleModuleContext();
      if (task && task.moduleKey && context.map[task.moduleKey]) return context.map[task.moduleKey];
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
      var restoreContext = buildManagedTaskRestoreContext();
      return {
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
      var restoreContext = buildManagedTaskRestoreContext();
      return {
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
        restoreContext: restoreContext,
        rootPipelineId: String(opts.rootPipelineId || ''),
        rootPipelineActionId: String(opts.rootPipelineActionId || ''),
        rootPipelineNewModule: opts.rootPipelineNewModule === true,
        historySuppressed: opts.historySuppressed === true,
        notifySuppressed: opts.notifySuppressed === true,
      };
    }

    function buildManagedTaskRestoreContext() {
      var rawTextEl = document.getElementById('rawText');
      var caseTextEl = document.getElementById('caseText');
      var prep = cloneJson(getPrepState(), createDefaultPrepState());
      var viewState = cloneJson(getViewState(), createDefaultViewState());
      var requirementLabel = state.requirementLabel ? String(state.requirementLabel || '').trim() : '';
      if (!requirementLabel) {
        requirementLabel = normalizeRequirementLabelFromFileName(state.lastRawImportName || '');
      }
      return {
        requirementLabel: requirementLabel,
        requirementLabelSource: state.requirementLabelSource ? String(state.requirementLabelSource || '') : '',
        lastRawImportName: state.lastRawImportName ? String(state.lastRawImportName || '') : '',
        rawText: rawTextEl && rawTextEl.value ? String(rawTextEl.value || '') : '',
        caseText: caseTextEl && caseTextEl.value ? String(caseTextEl.value || '') : '',
        importedCases: cloneJson(state.importedCases, []),
        caseGenModules: cloneJson(state.caseGenModules, []),
        caseGenResults: cloneJson(state.caseGenResults, {}),
        operationSnapshots: cloneJson(ensureState().operationSnapshots, []),
        nextSnapshotId: Number(ensureState().nextSnapshotId || 1),
        history: cloneJson(ensureState().history, []),
        rootPipeline: cloneRootPipelineSnapshot(getRootPipelineState()),
        prep: prep,
        viewState: {
          drawerOpen: viewState.drawerOpen === true || isDrawerOpen(),
          fullscreen: viewState.fullscreen === true || Boolean(drawerEl && drawerEl.classList && drawerEl.classList.contains('xmind-drawer-fullscreen')),
        },
      };
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

      base.requirementLabel = pickString(base.requirementLabel, incoming.requirementLabel);
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
      if (Array.isArray(incomingPrep.manualRequirementBlocks) && incomingPrep.manualRequirementBlocks.length) {
        basePrep.manualRequirementBlocks = cloneJson(incomingPrep.manualRequirementBlocks, []);
      }
      if (incomingPrep.caseImportMode) basePrep.caseImportMode = String(incomingPrep.caseImportMode || '');
      basePrep.baseLocked = basePrep.baseLocked === true || incomingPrep.baseLocked === true;
      basePrep.completed = basePrep.completed === true || incomingPrep.completed === true;
      base.prep = basePrep;

      var baseView = base.viewState && typeof base.viewState === 'object' ? base.viewState : {};
      var incomingView = incoming.viewState && typeof incoming.viewState === 'object' ? incoming.viewState : {};
      baseView.drawerOpen = baseView.drawerOpen === true || incomingView.drawerOpen === true;
      baseView.fullscreen = baseView.fullscreen === true || incomingView.fullscreen === true;
      base.viewState = baseView;

      return base;
    }

    function syncRunningTaskRestoreContexts() {
      var manager = getXmindTaskManager();
      if (!manager || typeof manager.updateTasksContext !== 'function') return 0;
      var restoreContext = buildManagedTaskRestoreContext();
      return Number(manager.updateTasksContext(function(nextContext) {
        var merged = mergeTaskRestoreContext(nextContext, restoreContext);
        Object.keys(nextContext || {}).forEach(function(key) {
          delete nextContext[key];
        });
        Object.keys(merged).forEach(function(key) {
          nextContext[key] = cloneJson(merged[key], merged[key]);
        });
      }, {
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
      var restoreContext = buildManagedTaskRestoreContext();
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

    function restoreWorkflowContextFromManagedTasks(tasks) {
      var restoreContext = buildMergedManagedTaskRestoreContext(tasks);
      var latestTask = pickLatestManagedTaskRestoreContext(tasks);
      if (!restoreContext) return false;
      var changed = false;
      var rawTextEl = document.getElementById('rawText');
      var fileNameEl = document.getElementById('fileName');
      var caseTextEl = document.getElementById('caseText');
      var casesCoreApi = getCasesCoreApi();
      var currentLabel = state.requirementLabel ? String(state.requirementLabel).trim() : '';
      var currentLabelSource = state.requirementLabelSource ? String(state.requirementLabelSource).trim() : '';
      var restoreLabel = restoreContext.requirementLabel ? String(restoreContext.requirementLabel || '').trim() : '';
      if (!restoreLabel) {
        restoreLabel = normalizeRequirementLabelFromFileName(restoreContext.lastRawImportName || '');
      }
      if ((!currentLabel || currentLabel === '当前需求' || currentLabelSource === 'default') && restoreLabel) {
        state.requirementLabel = restoreLabel;
        state.requirementLabelSource = restoreContext.requirementLabelSource
          ? String(restoreContext.requirementLabelSource || '')
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
      var viewState = getViewState();
      var restoreView = restoreContext.viewState && typeof restoreContext.viewState === 'object'
        ? restoreContext.viewState
        : null;
      if (restoreView && viewState.drawerOpen !== true && restoreView.drawerOpen === true) {
        viewState.drawerOpen = true;
        changed = true;
      }
      if (restoreView && viewState.fullscreen !== true && restoreView.fullscreen === true) {
        viewState.fullscreen = true;
        changed = true;
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
      if (changed) {
        scheduleRecoveredStatePersist();
      }
      return changed;
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
        return (pipeline && pipeline.hadAiContentBeforeAction === true ? '已重新生成 ' : '已生成 ')
          + String(createdModules) + ' 个模块，' + String(addedCases) + ' 条用例';
      }
      if (actionId === ROOT_ACTIONS.EXISTING_CASES) {
        return '已为已有模块补充 ' + String(addedCases) + ' 条用例';
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
        });
        clearDeleteHistoryStacks();
        syncCasesGenPageRender();
      }

      clearRootPipelineState();
      if (notifyText) {
        notifyStatus(notifyText, notifyType, { forceInline: true });
      }
      if (isDrawerOpen()) {
        render({
          reason: renderReason,
          persist: false,
          anchorNodeId: Object.prototype.hasOwnProperty.call(opts, 'anchorNodeId') ? String(opts.anchorNodeId || '') : '',
        });
      }
      persistXmindState(true);
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
      var normalizedOutput = normalizeModelModulesOutputDetailed(task && task.resultRaw ? task.resultRaw : '');
      var filtered = filterModulesByContract(normalizedOutput.list, contract, visibleContext);
      var modules = filtered.list;
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

      var existingDescriptors = actionId === ROOT_ACTIONS.APPEND_ALL
        ? buildRootPipelineTaskDescriptors(actionId, visibleContext)
        : [];
      var newModules = [];
      var skeletonModules = [];
      var skeletonActionId = '';

      if (actionId === ROOT_ACTIONS.FULL_CASES) {
        newModules = modules.slice();
        skeletonModules = cloneModulesWithoutCases(newModules);
        skeletonActionId = ROOT_ACTIONS.FULL_MODULES;
      } else if (actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES || actionId === ROOT_ACTIONS.APPEND_ALL) {
        newModules = modules.filter(function(item) {
          return !visibleContext.map[normalizeModuleKey(item && item.module ? item.module : '')];
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

      updateRootPipelineState(function(current) {
        current.stage = 'modules';
        current.discoveryStatus = 'done';
        current.createdModules += Number(skeletonApplied.createdModules || 0);
        mergeRootPipelineDetails(current, skeletonApplied.details);
        if (coverageGapInfo && coverageGapInfo.retryStartError) {
          appendRootPipelineDiagnostics(current, '自动补强未启动：' + summarizeModelOutputText(coverageGapInfo.retryStartError, 80));
        }
      });

      var postContext = buildVisibleModuleContext();
      var descriptors = existingDescriptors.slice();
      newModules.forEach(function(item) {
        var moduleKey = normalizeModuleKey(item && item.module ? item.module : '');
        var resolvedEntry = moduleKey ? postContext.map[moduleKey] : null;
        if (!resolvedEntry) return;
        descriptors.push({
          moduleEntry: resolvedEntry,
          actionId: MODULE_ACTIONS.FULL_CASES,
          rootPipelineNewModule: actionId !== ROOT_ACTIONS.FULL_CASES,
          anchorNodeId: anchorNodeId,
        });
      });
      if (actionId === ROOT_ACTIONS.FULL_CASES) {
        descriptors = skeletonModules.map(function(item) {
          var moduleKey = normalizeModuleKey(item && item.module ? item.module : '');
          var resolvedEntry = moduleKey ? postContext.map[moduleKey] : null;
          if (!resolvedEntry) return null;
          return {
            moduleEntry: resolvedEntry,
            actionId: MODULE_ACTIONS.FULL_CASES,
            rootPipelineNewModule: false,
            anchorNodeId: anchorNodeId,
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
        render({ reason: 'root-pipeline-discovery-committed', persist: false, anchorNodeId: anchorNodeId });
      }
      syncTerminalTaskRestoreContext(task);
      persistXmindState(true);

      var startedCount = await startRootPipelineModuleTasks(pipeline, descriptors);
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
        render({ reason: opts.renderReason || 'root-pipeline-discovery-error', persist: false, anchorNodeId: anchorNodeId });
      }
      syncTerminalTaskRestoreContext(task);
      persistXmindState(true);
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
          var fullNoChangeInfo = buildModuleNoChangeInfo(actionId, filtered.diagnostics, mergeDiagnostics, targetOutput, normalizedOutput.diagnostics);
          if (task && task.createdModuleBeforeAction === true && task.rootPipelineNewModule !== true && moduleId) {
            removeAiModuleRecord(moduleId);
          }
          updateRootPipelineState(function(current) {
            appendRootPipelineDiagnostics(current, '模块「' + historyModuleTitle + '」未新增用例：' + fullNoChangeInfo.reasonText);
          });
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
          appendRootPipelineModuleDetail(current, historyModuleTitle, addedCount);
        });
        clearDeleteHistoryStacks();
        syncCasesGenPageRender();
      }
      if (isDrawerOpen()) {
        render({ reason: changed ? 'root-pipeline-module-committed' : 'root-pipeline-module-no-change', persist: false, anchorNodeId: anchorNodeId });
      }
      syncTerminalTaskRestoreContext(task);
      persistXmindState(true);
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
      if (isDrawerOpen()) {
        render({ reason: opts.renderReason || 'root-pipeline-module-error', persist: false, anchorNodeId: anchorNodeId });
      }
      syncTerminalTaskRestoreContext(task);
      persistXmindState(true);
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
        if (isDrawerOpen()) render({ reason: 'root-task-no-change', persist: false, anchorNodeId: anchorNodeId });
        persistXmindState(true);
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
      if (isDrawerOpen()) render({ reason: 'root-task-committed', persist: false, anchorNodeId: anchorNodeId });
      persistXmindState(true);
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
      if (isDrawerOpen()) render({ reason: opts.renderReason || 'root-task-error', persist: false, anchorNodeId: anchorNodeId });
      persistXmindState(true);
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
          if (isDrawerOpen()) render({ reason: 'module-task-append-empty', persist: false, anchorNodeId: anchorNodeId });
          persistXmindState(true);
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
          if (isDrawerOpen()) render({ reason: 'module-task-full-empty', persist: false, anchorNodeId: anchorNodeId });
          persistXmindState(true);
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
      if (isDrawerOpen()) render({ reason: 'module-task-committed', persist: false, anchorNodeId: anchorNodeId });
      persistXmindState(true);
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
      if (isDrawerOpen()) render({ reason: opts.renderReason || 'module-task-error', persist: false, anchorNodeId: anchorNodeId });
      persistXmindState(true);
      return false;
    }

    function consumeManagedXmindTask(task) {
      if (!task || !task.id || !isManagedTaskTerminal(task)) return Promise.resolve(false);
      if (xmindTaskProcessingMap[task.id]) return xmindTaskProcessingMap[task.id];
      var promise = Promise.resolve()
        .then(function() {
          if (task.status === 'done') {
            if (task.scope === 'root') return completeRootTaskSuccess(task);
            return completeModuleTaskSuccess(task);
          }
          if (task.status === 'cancelled') {
            if (task.scope === 'root') return completeRootTaskError(task, null, { resultKind: 'cancelled', renderReason: 'root-task-cancelled' });
            return completeModuleTaskError(task, null, { resultKind: 'cancelled', renderReason: 'module-task-cancelled' });
          }
          if (task.scope === 'root') return completeRootTaskError(task, null, { renderReason: 'root-task-error' });
          return completeModuleTaskError(task, null, { renderReason: 'module-task-error' });
        })
        .catch(function(err) {
          if (task.scope === 'root') return completeRootTaskError(task, err, { renderReason: 'root-task-consume-error' });
          return completeModuleTaskError(task, err, { renderReason: 'module-task-consume-error' });
        })
        .finally(async function() {
          var manager = getXmindTaskManager();
          if (manager && typeof manager.clearTask === 'function') {
            manager.clearTask(task.id, 'handled');
          }
          delete xmindTaskProcessingMap[task.id];
          if (task && task.rootPipelineId) {
            await pumpRootPipelineModuleQueue(String(task.rootPipelineId || ''));
            finalizeRootPipelineIfReady(String(task.rootPipelineId || ''), {
              anchorNodeId: getManagedTaskAnchorNodeId(task, null),
            });
          }
          syncManagedRunningUiState({
            tasks: listManagedXmindTasks(),
            render: false,
            reason: 'task-consumed',
            persist: true,
          });
        });
      xmindTaskProcessingMap[task.id] = promise;
      return promise;
    }

    function reconcileManagedXmindTasks(options) {
      var opts = options || {};
      var manager = getXmindTaskManager();
      if (!manager) {
        syncInterruptButton();
        return;
      }
      var tasks = listManagedXmindTasks();
      restoreWorkflowContextFromManagedTasks(tasks);
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
      terminalTasks.forEach(function(task) {
        consumeManagedXmindTask(task);
      });
      var pipeline = getRootPipelineState();
      if (pipeline && pipeline.id && terminalTasks.length <= 0) {
        pumpRootPipelineModuleQueue(String(pipeline.id || '')).then(function() {
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
        var isTerminalEventTask = Boolean(task && isManagedTaskTerminal(task));
        var shouldSkipRender = isTerminalEventTask || action === 'handled' || action === 'clear' || action === 'context';
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
        if (task && isManagedTaskTerminal(task)) {
          consumeManagedXmindTask(task);
          return;
        }
        if (!task) {
          tasks.filter(isManagedTaskTerminal).forEach(function(item) {
            consumeManagedXmindTask(item);
          });
        }
      });
      xmindTaskListenerBound = true;
    }

    function interruptRunningXmindTasks() {
      var manager = getXmindTaskManager();
      if (!manager || typeof manager.cancelAllRunning !== 'function') {
        notifyFloatingStatus('中断能力未就绪，请刷新后重试', 'err', 5000);
        return false;
      }
      var pipeline = getRootPipelineState();
      var interruptedCount = Number(manager.cancelAllRunning({
        reason: '已手动中断当前 XMind 生成任务',
        source: 'toolbar',
        abortReason: 'xmind-casegen-cancelled',
      }) || 0);
      if (pipeline && pipeline.id) {
        updateRootPipelineState(function(current) {
          current.cancelled = true;
          current.cancelReason = '已手动中断当前 XMind 生成任务';
          current.pendingQueue = [];
        });
      }
      if (interruptedCount <= 0) {
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
      var context = visibleContext && visibleContext.list ? visibleContext : buildVisibleModuleContext();
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
      render({ reason: options.renderReason || 'module-running', anchorNodeId: anchorNodeId, persist: false });

      var moduleTaskMeta = {
        scope: 'module',
        actionId: actionId,
        moduleId: String(moduleEntry.aiModuleId || moduleId || ''),
        moduleKey: String(moduleEntry.moduleKey || ''),
        moduleTitle: normalizeModuleTitle(moduleEntry.title || ''),
        snapshotId: snapshotId,
        createdModuleBeforeAction: Object.prototype.hasOwnProperty.call(options, 'forceCreatedModuleBeforeAction')
          ? options.forceCreatedModuleBeforeAction === true
          : createdModuleRecordBeforeTask,
        hadAiCasesBeforeAction: hadAiCasesBeforeAction,
        rootPipelineId: String(options.rootPipelineId || ''),
        rootPipelineActionId: String(options.rootPipelineActionId || ''),
        rootPipelineNewModule: options.rootPipelineNewModule === true,
        historySuppressed: options.historySuppressed === true,
        notifySuppressed: options.notifySuppressed === true,
      };

      try {
        var visibleContext = buildVisibleModuleContext();
        var resolvedEntry = visibleContext.map[moduleEntry.moduleKey] || moduleEntry;
        var contract = options.contractOverride || createOperationContract(actionId, resolvedEntry);
        var historyModuleTitle = normalizeModuleTitle(resolvedEntry && resolvedEntry.title ? resolvedEntry.title : moduleEntry.title);
        moduleTaskMeta.contract = cloneJson(contract, {});
        moduleTaskMeta.historyActionLabel = historyActionLabel;
        moduleTaskMeta.moduleTitle = historyModuleTitle;
        moduleTaskMeta.moduleKey = String(resolvedEntry && resolvedEntry.moduleKey ? resolvedEntry.moduleKey : moduleEntry.moduleKey || '');
        moduleTaskMeta.moduleId = String(resolvedEntry && resolvedEntry.aiModuleId ? resolvedEntry.aiModuleId : moduleEntry.aiModuleId || moduleId || '');
        var moduleTaskInput = await buildXmindGenerationTaskInput(contract, visibleContext, resolvedEntry);
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
            skipSnapshot: true,
            historySuppressed: true,
            notifySuppressed: true,
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

    async function startRootPipelineModuleTasks(pipeline, descriptors) {
      var list = Array.isArray(descriptors) ? descriptors : [];
      var targetId = pipeline && pipeline.id ? String(pipeline.id || '') : '';
      if (!targetId) return 0;
      replaceRootPipelinePendingQueue(targetId, []);
      if (!list.length) return 0;
      var startedResults = await runConcurrentTasks(list, list.length || 1, async function(descriptor) {
        if (!descriptor || !descriptor.moduleEntry || !descriptor.actionId) return null;
        return await startManagedModuleTask(descriptor.moduleEntry, descriptor.actionId, {
          skipSnapshot: true,
          historySuppressed: true,
          notifySuppressed: true,
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
      var pipeline = createRootPipelineState({
        actionId: actionId,
        snapshotId: rootTaskMeta && rootTaskMeta.snapshotId ? String(rootTaskMeta.snapshotId || '') : '',
        historyActionLabel: rootTaskMeta && rootTaskMeta.historyActionLabel ? String(rootTaskMeta.historyActionLabel || '') : '',
        hadAiContentBeforeAction: rootTaskMeta && rootTaskMeta.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: rootTaskMeta && rootTaskMeta.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: rootTaskMeta && rootTaskMeta.hadAiCasesBeforeAction === true,
        stage: actionId === ROOT_ACTIONS.EXISTING_CASES ? 'modules' : 'discovering',
        discoveryStatus: actionId === ROOT_ACTIONS.EXISTING_CASES ? 'skipped' : 'running',
      });
      setRootPipelineState(pipeline);

      if (actionId === ROOT_ACTIONS.EXISTING_CASES) {
        var existingDescriptors = buildRootPipelineTaskDescriptors(actionId, visibleContext).map(function(item) {
          return Object.assign({}, item, { anchorNodeId: getRootNodeId() });
        });
        var startedCount = await startRootPipelineModuleTasks(pipeline, existingDescriptors);
        rootState.taskId = startedCount > 0 ? String(pipeline.id || '') : '';
        rootState.updatedAt = Date.now();
        persistXmindState(true);
        if (startedCount <= 0) {
          finalizeRootPipelineIfReady(String(pipeline.id || ''), { anchorNodeId: getRootNodeId() });
        }
        return true;
      }

      var contract = rootTaskMeta && rootTaskMeta.contract
        ? cloneJson(rootTaskMeta.contract, {})
        : createOperationContract(actionId, null);
      var rootTaskInput = await buildXmindGenerationTaskInput(contract, visibleContext, null);
      var rootTask = startManagedXmindTask(buildRootTaskPayload(actionId, rootTaskInput, {
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
      render({ reason: 'root-running', anchorNodeId: anchorNodeId, persist: false });
      var rootTaskMeta = {
        scope: 'root',
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
        var rootTaskInput = await buildXmindGenerationTaskInput(contract, visibleContext, null);
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
      });
      return Boolean(started && started.task && started.task.id);
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

    function open(options) {
      var opts = options || {};
      var wasOpen = isDrawerOpen();
      pendingOpenCenterRoot = opts.restoreOpening === true ? false : !wasOpen;
      clearOpenButtonCompletionNotice({ persist: false });
      switchTab('casesgen');
      setCasesGenModulesView();
      var drawer = ensureDrawer();
      if (drawer && typeof drawer.open === 'function') {
        drawer.open({
          instant: opts.instant === true,
        });
        return true;
      }
      getViewState().drawerOpen = true;
      getViewState().updatedAt = Date.now();
      syncOpenButtonState();
      render({
        reason: 'open-fallback',
        centerRootAfterRender: pendingOpenCenterRoot === true,
      });
      pendingOpenCenterRoot = false;
      persistXmindState(true);
      return false;
    }

    function close() {
      clearDrawerRestoreRetry();
      var drawer = ensureDrawer();
      if (drawer && typeof drawer.close === 'function') {
        drawer.close();
        return true;
      }
      captureCurrentViewState();
      getViewState().drawerOpen = false;
      getViewState().fullscreen = false;
      getViewState().updatedAt = Date.now();
      syncOpenButtonState();
      if (drawerEl && drawerEl.classList) {
        drawerEl.classList.remove('xmind-drawer-fullscreen');
      }
      destroyMind();
      flushDeferredCasesGenPageRender();
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
      if (summaryDialogBodyEl) {
        summaryDialogBodyEl.addEventListener('click', function(event) {
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
      return hasManagedTaskDrawerRestoreIntent();
    }

    function hasManagedTaskDrawerRestoreIntent() {
      return listManagedXmindTasks().some(function(task) {
        var restoreContext = task && task.restoreContext && typeof task.restoreContext === 'object'
          ? task.restoreContext
          : null;
        return Boolean(restoreContext && restoreContext.viewState && restoreContext.viewState.drawerOpen === true);
      });
    }

    function shouldRestoreDrawerAfterRefresh() {
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
        if (!shouldRestoreDrawerAfterRefresh()) {
          clearDrawerRestoreRetry();
          return;
        }
        drawerRestoreRetryCount += 1;
        if (!isDrawerOpen()) {
          drawerRestoreStableCount = 0;
          setDebugState({
            phase: 'drawer-restore-attempt',
            attempt: drawerRestoreRetryCount,
          });
          open({ instant: true, restoreOpening: true });
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
          clearDrawerRestoreRetry();
          return;
        }
        if (drawerRestoreRetryCount >= DRAWER_RESTORE_RETRY_LIMIT) {
          setDebugState({
            phase: 'drawer-restore-timeout',
            attempt: drawerRestoreRetryCount,
          });
          clearDrawerRestoreRetry();
          return;
        }
        scheduleDrawerRestoreRetry(isDrawerOpen() ? 220 : 140);
      }, Math.max(0, Number(delayMs) || 0));
    }

    function restoreDrawerAfterRefreshIfNeeded() {
      clearDrawerRestoreRetry();
      reconcileManagedXmindTasks({ resume: true, render: isDrawerOpen(), persist: false, reason: 'workflow-ready' });
      if (!hasDrawerRestoreIntent()) return;
      scheduleDrawerRestoreRetry(80);
    }

    ensureDrawer();
    bindViewStatePersistenceLifecycle();
    bindButtons();
    bindManagedXmindTasks();
    bindRenderListeners();
    updateSummary();
    restoreDrawerAfterRefreshIfNeeded();

    var api = {
      open: open,
      close: close,
      render: render,
      exportCurrentXmind: exportCurrentXmind,
      switchTab: switchTab,
      isOpen: isDrawerOpen,
      restoreAfterWorkflowReady: restoreDrawerAfterRefreshIfNeeded,
      resetAllState: resetXmindCasegenState,
      resetAfterStoreSuccess: resetAfterStoreSuccess,
    };
    window.app.xmindCasegenApi = api;
    return api;
  }

  window.app = window.app || {};
  window.app.xmindCasegen = { init: init };
})();
