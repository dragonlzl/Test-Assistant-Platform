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
    var summaryOverlayEl = document.getElementById('xmindCaseGenSummaryOverlay');
    var summaryDialogEl = document.getElementById('xmindCaseGenSummaryDialog');
    var summaryDialogBodyEl = document.getElementById('xmindCaseGenSummaryDialogBody');
    var prepResetBtn = document.getElementById('xmindCaseGenPrepResetBtn');
    var summaryCloseBtn = document.getElementById('xmindCaseGenSummaryCloseBtn');
    var importRequirementBtn = document.getElementById('xmindCaseGenImportRequirementBtn');
    var importCasesBtn = document.getElementById('xmindCaseGenImportCasesBtn');
    var selectCasesBtn = document.getElementById('xmindCaseGenSelectCasesBtn');
    var generateModulesBtn = document.getElementById('xmindCaseGenGenerateModulesBtn');
    var generateFullBtn = document.getElementById('xmindCaseGenGenerateFullBtn');
    var exportBtn = document.getElementById('xmindCaseGenExportBtn');
    var promptBtn = document.getElementById('xmindCaseGenPromptBtn');
    var statusEl = document.getElementById('xmindCaseGenStatus');
    var mindContainer = document.getElementById('xmindCaseGenMindContainer');

    var renderTimer = 0;
    var listObserver = null;
    var drawerInstance = null;
    var summaryDialogOpen = false;
    var currentMindData = null;
    var mindInstance = null;
    var mindApiReadyPromise = null;
    var inlineControlsHost = null;
    var inlineStatusHost = null;
    var manualImageInputEl = null;
    var topupHighlightSyncTimer = 0;
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
        importRequirementBtn,
        importCasesBtn,
        selectCasesBtn,
        generateModulesBtn,
        generateFullBtn,
        exportBtn,
        promptBtn,
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
          rootSnapshotId: '',
          rootSnapshots: [],
          root: createDefaultRootState(),
          summaryCollapsed: false,
          prep: createDefaultPrepState(),
          nextSnapshotId: 1,
          snapshots: [],
          modules: {},
        };
      }
      if (!Array.isArray(state.xmindCaseGen.rootSnapshots)) state.xmindCaseGen.rootSnapshots = [];
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
      state.xmindCaseGen.rootSnapshotId = String(state.xmindCaseGen.rootSnapshotId || '');
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

    function renderOptionsStepCard() {
      var settings = getCaseGenSettingsSnapshot();
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
        +   '<div class="xmind-casegen-prep-checkbox-grid">'
        +     '<label><input type="checkbox" data-casegen-setting="needBoundary" ' + (settings.needBoundary ? 'checked' : '') + ' />考虑边界</label>'
        +     '<label><input type="checkbox" data-casegen-setting="needMobile" ' + (settings.needMobile ? 'checked' : '') + ' />考虑移动设备</label>'
        +     '<label><input type="checkbox" data-casegen-setting="needSpecial" ' + (settings.needSpecial ? 'checked' : '') + ' />考虑特殊场景</label>'
        +   '</div>'
        +   '<div class="xmind-casegen-prep-checkbox-grid ' + (settings.needSpecial ? '' : 'is-disabled') + '">'
        +     '<label><input type="checkbox" data-casegen-setting="specialRepeatOperation" ' + (settings.specialRepeatOperation ? 'checked' : '') + ' ' + (settings.needSpecial ? '' : 'disabled') + ' />重复操作</label>'
        +     '<label><input type="checkbox" data-casegen-setting="specialMultiTouch" ' + (settings.specialMultiTouch ? 'checked' : '') + ' ' + (settings.needSpecial ? '' : 'disabled') + ' />多点触控</label>'
        +     '<label><input type="checkbox" data-casegen-setting="specialRepeatExecution" ' + (settings.specialRepeatExecution ? 'checked' : '') + ' ' + (settings.needSpecial ? '' : 'disabled') + ' />重复执行</label>'
        +     '<label><input type="checkbox" data-casegen-setting="specialWeakNetwork" ' + (settings.specialWeakNetwork ? 'checked' : '') + ' ' + (settings.needSpecial ? '' : 'disabled') + ' />弱网</label>'
        +     '<label><input type="checkbox" data-casegen-setting="specialInterruptResume" ' + (settings.specialInterruptResume ? 'checked' : '') + ' ' + (settings.needSpecial ? '' : 'disabled') + ' />中断恢复</label>'
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
            if (summaryDialogOpen === true) renderPrepDialog();
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
      if (summaryOverlayEl) {
        summaryOverlayEl.hidden = !open;
        summaryOverlayEl.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (summaryOverlayEl.classList) {
          summaryOverlayEl.classList.toggle('hidden', !open);
          summaryOverlayEl.classList.toggle('is-open', open);
        }
      }
      if (summaryBtn) {
        summaryBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        summaryBtn.textContent = '生成前置准备';
      }
      if (open) renderPrepDialog();
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
          rootSnapshotId: '',
          rootSnapshots: [],
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
      renderPrepDialog();
      scheduleRender('prep-reset');
      persistXmindState(true);
    }

    function setPrepStep(step) {
      var next = Math.max(STEP_REQUIREMENT, Math.min(STEP_OPTIONS, Number(step) || STEP_REQUIREMENT));
      setPrepField('step', next);
      if (summaryDialogOpen === true) renderPrepDialog();
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
      if (summaryDialogOpen === true) renderPrepDialog();
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
      var baselineList = hasImportedBaselineCases() && xmindGenApi && typeof xmindGenApi.getCombinedCaseList === 'function'
        ? xmindGenApi.getCombinedCaseList()
        : [];
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
      (entry.baselineCases || []).forEach(function(item) {
        result.push({ source: 'baseline', item: item });
      });
      (entry.aiCases || []).forEach(function(item) {
        result.push({ source: 'ai', item: item });
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

    function normalizeModelModulesOutput(content) {
      var payload = extractJsonPayload(content);
      var arr = [];
      if (Array.isArray(payload)) arr = payload;
      else if (payload && Array.isArray(payload.modules)) arr = payload.modules;
      else if (payload && Array.isArray(payload.data)) arr = payload.data;
      else arr = [];
      return arr.map(function(item) {
        if (!item || typeof item !== 'object') return null;
        var moduleTitle = normalizeModuleTitle(item.module || item.title || item.name || '未命名模块');
        if (!moduleTitle) return null;
        var moduleInfo = {
          module: moduleTitle,
          key_scenarios: normalizeArrayField(item.key_scenarios || item.scenarios),
          test_points: normalizeArrayField(item.test_points || item.points),
          coupled_modules: normalizeArrayField(item.coupled_modules || item.coupled),
          cases: [],
        };
        var cases = Array.isArray(item.cases) ? item.cases : [];
        cases.forEach(function(caseItem) {
          var normalized = normalizeCaseItem(caseItem, moduleTitle);
          if (normalized) moduleInfo.cases.push(normalized);
        });
        return moduleInfo;
      }).filter(Boolean);
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

    function filterModulesByContract(modules, contract, visibleContext) {
      var visibleMap = visibleContext && visibleContext.map ? visibleContext.map : {};
      var targetKey = normalizeModuleKey(contract.targetModule || '');
      var finalModules = [];
      var seenModules = {};

      (Array.isArray(modules) ? modules : []).forEach(function(item) {
        var moduleTitle = normalizeModuleTitle(item.module || '');
        var moduleKey = normalizeModuleKey(moduleTitle);
        if (!moduleKey || seenModules[moduleKey]) return;
        seenModules[moduleKey] = true;
        var existsVisible = Boolean(visibleMap[moduleKey]);
        if (contract.scope === 'module' && targetKey && moduleKey !== targetKey) return;
        if (contract.allowNewModules !== true && !existsVisible) return;
        if (contract.dedupeAgainstVisibleModules === true && existsVisible) return;

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
          if (!titleKey || caseSeen[titleKey]) return;
          if (contract.dedupeAgainstVisibleCases === true && visibleCaseSeen[titleKey]) return;
          caseSeen[titleKey] = true;
          nextItem.cases.push(normalizedCase);
        });

        if (existsVisible !== true && contract.generateCasesForNewModules !== true) {
          nextItem.cases = [];
        }
        if (existsVisible === true && contract.generateCasesForExistingModules !== true) {
          nextItem.cases = [];
        }
        finalModules.push(nextItem);
      });

      return finalModules;
    }

    function mergeCasesWithoutDuplicates(existingList, addedList, visibleList) {
      var result = Array.isArray(existingList) ? existingList.slice() : [];
      var visible = Array.isArray(visibleList) ? visibleList : [];
      var titleSeen = {};
      result.forEach(function(item) {
        var key = normalizeCaseTitle(item && item.title);
        if (key) titleSeen[key] = true;
      });
      visible.forEach(function(item) {
        var key = normalizeCaseTitle(item && item.title);
        if (key) titleSeen[key] = true;
      });
      var appended = [];
      (Array.isArray(addedList) ? addedList : []).forEach(function(item) {
        var key = normalizeCaseTitle(item && item.title);
        if (!key || titleSeen[key]) return;
        titleSeen[key] = true;
        appended.push(item);
        result.push(item);
      });
      return {
        merged: result,
        appended: appended,
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
      var startIndex = Number(marker.startIndex);
      var count = Number(marker.count);
      if (!Number.isFinite(startIndex) || startIndex < 0) return null;
      if (!Number.isFinite(count) || count <= 0) return null;
      return {
        token: marker.token ? String(marker.token) : '',
        label: marker.label ? String(marker.label) : '本轮追加用例',
        startIndex: startIndex,
        count: count,
        updatedAt: Number(marker.updatedAt || 0),
      };
    }

    function clearModuleTopupHighlight(moduleState) {
      if (!moduleState || typeof moduleState !== 'object') return;
      moduleState.topupHighlight = null;
    }

    function buildTopupHighlightLabel(count) {
      var total = Number(count);
      if (!Number.isFinite(total) || total <= 0) return '本轮追加用例';
      return total > 1 ? ('本轮追加用例 · ' + total + ' 条') : '本轮追加用例';
    }

    function setModuleTopupHighlight(moduleState, moduleKey, startIndex, count) {
      if (!moduleState || !Number.isFinite(startIndex) || !Number.isFinite(count) || count <= 0) {
        clearModuleTopupHighlight(moduleState);
        return null;
      }
      var tokenPrefix = buildNodeId(['topup-highlight', moduleKey || 'module']) || 'topup-highlight';
      moduleState.topupHighlight = {
        token: generateLocalId(tokenPrefix),
        label: buildTopupHighlightLabel(count),
        startIndex: startIndex,
        count: count,
        updatedAt: Date.now(),
      };
      setDebugState({
        topupPhase: 'set',
        topupModule: String(moduleKey || ''),
        topupStartIndex: startIndex,
        topupCount: count,
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
      if (!marker || !Number.isFinite(index) || index < 0) return null;
      if (index < marker.startIndex) return null;
      if (index >= marker.startIndex + marker.count) return null;
      return marker;
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

    function syncTopupHighlightPresentation() {
      var viewerEl = getTopupHighlightViewerElement();
      var mapEl = getTopupHighlightMapElement(viewerEl);
      if (!viewerEl || !mapEl) return;
      clearTopupHighlightLayer(mapEl);
      var highlightedNodes = mapEl.querySelectorAll('[data-xmind-topup-highlight-token]');
      if (!highlightedNodes || !highlightedNodes.length) {
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
          grouped[token] = { label: '', nodes: [] };
        }
        if (!grouped[token].label && nodeEl.getAttribute) {
          grouped[token].label = String(nodeEl.getAttribute('data-xmind-topup-highlight-label') || '本轮追加用例');
        }
        grouped[token].nodes.push(nodeEl);
      });
      Object.keys(grouped).forEach(function(token) {
        var group = grouped[token];
        if (!group || !group.nodes || !group.nodes.length) return;
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
        if (maxRight <= viewerRect.left || minLeft >= viewerRect.right || maxBottom <= viewerRect.top || minTop >= viewerRect.bottom) {
          return;
        }
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
      });
      setDebugState({
        topupPhase: 'rendered',
        topupNodeCount: highlightedNodes.length,
        topupFrameCount: layerEl.querySelectorAll ? layerEl.querySelectorAll('[data-xmind-casegen-topup-frame]').length : 0
      });
    }

    function snapshotAllCaseGenStateLocal() {
      var xmindState = ensureState();
      var snapshotId = 'root-snap-' + String(xmindState.nextSnapshotId || 1);
      xmindState.nextSnapshotId = Number(xmindState.nextSnapshotId || 1) + 1;
      xmindState.rootSnapshots.push({
        id: snapshotId,
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
      xmindState.rootSnapshotId = snapshotId;
      xmindState.root.snapshotId = snapshotId;
      xmindState.root.updatedAt = Date.now();
      return snapshotId;
    }

    function rollbackAllCaseGenStateLocal() {
      var xmindState = ensureState();
      var snapshotId = String(xmindState.rootSnapshotId || (xmindState.root && xmindState.root.snapshotId) || '');
      if (!snapshotId) return false;
      var snapshot = null;
      for (var i = xmindState.rootSnapshots.length - 1; i >= 0; i -= 1) {
        var item = xmindState.rootSnapshots[i];
        if (!item || String(item.id || '') !== snapshotId) continue;
        snapshot = item;
        break;
      }
      if (!snapshot) return false;
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
      xmindState.root.snapshotId = '';
      xmindState.rootSnapshotId = '';
      xmindState.root.updatedAt = Date.now();
      xmindState.modules = {};
      clearAllTopupHighlights();
      if (casesGenApi && typeof casesGenApi.renderCaseGeneration === 'function') {
        casesGenApi.renderCaseGeneration();
      }
      persistXmindState(true);
      return true;
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

    function getRootFullCasesLabel(hasAiCases) {
      return hasAiCases ? '重新生成全量用例' : '生成全量用例';
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

    function getRootActions() {
      var hasBaseline = hasImportedBaselineCases();
      var hasSkeleton = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      var hasAiCases = hasAnyAiCases();
      var fullCasesLabel = getRootFullCasesLabel(hasAiCases);
      var rootUiState = ensureRootUiState();
      var canRollback = Boolean(ensureState().rootSnapshotId || (rootUiState && rootUiState.snapshotId));
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
      var moduleState = moduleId ? ensureModuleUiState(moduleId) : null;
      var canRollback = Boolean(moduleState && moduleState.snapshotId);
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

    function buildTopupPendingNode(moduleEntry) {
      return createNode('追加生成中', {
        type: 'topup-placeholder',
        moduleKey: moduleEntry.moduleKey,
        moduleId: moduleEntry.aiModuleId || '',
        nodeId: buildNodeId(['topup-placeholder', moduleEntry.moduleKey]),
        branchColor: '#2563eb',
      });
    }

    function buildCaseTree(moduleEntry, item, caseIndex, topupHighlight) {
      var xmindCoreApi = getXmindCoreApi();
      var moduleTitle = moduleEntry ? moduleEntry.title : '模块';
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
        segment: 'expected'
      }, topupHighlight));
      var stepsNode = createNode(fields[4] || '-', withTopupHighlightMeta({
        type: 'steps',
        moduleKey: moduleEntry.moduleKey,
        caseIndex: caseIndex,
        segment: 'steps'
      }, topupHighlight), [expectedNode]);
      var preNode = createNode(fields[3] || '-', withTopupHighlightMeta({
        type: 'preconditions',
        moduleKey: moduleEntry.moduleKey,
        caseIndex: caseIndex,
        segment: 'preconditions'
      }, topupHighlight), [stepsNode]);
      var priorityNode = createNode(fields[2] || 'P1', withTopupHighlightMeta({
        type: 'priority',
        moduleKey: moduleEntry.moduleKey,
        caseIndex: caseIndex,
        segment: 'priority'
      }, topupHighlight), [preNode]);
      var caseMeta = withTopupHighlightMeta({ type: 'case', moduleKey: moduleEntry.moduleKey, caseIndex: caseIndex }, topupHighlight);
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
              row.item,
              caseIndex,
              getCaseTopupHighlight(moduleState, caseIndex)
            ));
          });
        }
        if (moduleState && moduleState.running && moduleState.lastAction === MODULE_ACTIONS.APPEND) {
          moduleChildren.push(buildTopupPendingNode(entry));
        }
        children.push(createNode(entry.title, {
          type: 'module',
          moduleKey: entry.moduleKey,
          moduleId: entry.aiModuleId || '',
          moduleTitle: entry.title,
          moduleIndex: moduleIndex,
          nodeId: getModuleNodeId(entry),
          status: moduleState && moduleState.running ? 'running' : (moduleState && moduleState.status === 'error' ? 'error' : ''),
          statusText: moduleState && moduleState.error ? moduleState.error : '',
        }, moduleChildren));
      });

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
      if (meta.type === 'root') return getRootActions();
      if (meta.type === 'module') {
        var context = buildVisibleModuleContext();
        return getModuleActions(context.map[meta.moduleKey]);
      }
      return [];
    }

    function getNodeQuickAction(nodeMeta) {
      var meta = nodeMeta && nodeMeta.meta ? nodeMeta.meta : null;
      var actions = getNodeActions(nodeMeta);
      if (!meta || !actions.length) return null;
      if (meta.type === 'module') {
        var context = buildVisibleModuleContext();
        var entry = context.map[meta.moduleKey] || null;
        var preferredActionId = entry && Array.isArray(entry.aiCases) && entry.aiCases.length > 0
          ? MODULE_ACTIONS.APPEND
          : MODULE_ACTIONS.FULL_CASES;
        var preferredAction = actions.filter(function(item) {
          return item && item.id === preferredActionId;
        })[0] || null;
        if (preferredAction) {
          return {
            id: preferredAction.id,
            label: '+AI',
            disabled: preferredAction.disabled === true,
          };
        }
      }
      var first = actions.filter(function(item) { return item && item.disabled !== true; })[0] || actions[0] || null;
      if (!first) return null;
      return {
        id: first.id,
        label: '+AI',
        disabled: first.disabled === true,
      };
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
        'xmind-casegen-node-flow-left',
        'xmind-casegen-node-flow-right'
      );
      if (nodeEl.removeAttribute) {
        nodeEl.removeAttribute('data-xmind-topup-highlight-token');
        nodeEl.removeAttribute('data-xmind-topup-highlight-label');
      }
      var meta = nodeMeta && nodeMeta.meta ? nodeMeta.meta : null;
      if (!meta) return;
      if (meta.type === 'root' || meta.type === 'module') {
        nodeEl.classList.add(meta.type === 'root' ? 'xmind-casegen-node-root' : 'xmind-casegen-node-module');
        if (meta.type === 'module') {
          var branchMainEl = nodeEl.closest ? nodeEl.closest('me-main') : null;
          if (branchMainEl && branchMainEl.classList && branchMainEl.classList.contains('lhs')) {
            nodeEl.classList.add('xmind-casegen-node-flow-left');
          } else {
            nodeEl.classList.add('xmind-casegen-node-flow-right');
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
        return;
      }
      if (meta.type === 'topup-placeholder') {
        nodeEl.classList.add('xmind-casegen-node-topup-placeholder');
        var spinnerEl = document.createElement('span');
        spinnerEl.className = 'xmind-node-topup-spinner';
        spinnerEl.setAttribute('aria-hidden', 'true');
        nodeEl.appendChild(spinnerEl);
        var wrapperEl = nodeEl.closest ? nodeEl.closest('me-wrapper') : null;
        var childrenEl = wrapperEl && wrapperEl.parentElement ? wrapperEl.parentElement : null;
        var parentWrapper = childrenEl && childrenEl.tagName && String(childrenEl.tagName).toLowerCase() === 'me-children'
          ? childrenEl.parentElement
          : null;
        if (parentWrapper && parentWrapper.children) {
          var directSubLines = null;
          for (var i = 0; i < parentWrapper.children.length; i += 1) {
            var childEl = parentWrapper.children[i];
            if (!childEl || !childEl.tagName) continue;
            if (String(childEl.tagName).toLowerCase() !== 'svg') continue;
            if (!(childEl.classList && childEl.classList.contains('subLines'))) continue;
            directSubLines = childEl;
            break;
          }
          if (directSubLines) {
            var pathList = directSubLines.querySelectorAll ? directSubLines.querySelectorAll('path') : [];
            var pendingPath = pathList && pathList.length ? pathList[pathList.length - 1] : null;
            if (pendingPath && pendingPath.setAttribute) {
              pendingPath.classList.add('xmind-casegen-pending-link');
              pendingPath.setAttribute('data-xmind-casegen-link', 'topup-pending');
              pendingPath.setAttribute('stroke-dasharray', '6 5');
              pendingPath.setAttribute('stroke-linecap', 'round');
            }
          }
        }
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
          preserveViewState: Boolean(mindInstance),
          preserveAnchorNodeId: options.anchorNodeId || '',
          initialCenterNodeId: freshRender ? getRootNodeId() : '',
          onExportXmind: exportCurrentXmind,
          getNodeActions: getNodeActions,
          onNodeAction: handleNodeAction,
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
      clearAllTopupHighlights();

      if (
        actionId === ROOT_ACTIONS.FULL_CASES
        || actionId === ROOT_ACTIONS.FULL_MODULES
        || actionId === ROOT_ACTIONS.REGENERATE_MODULES
      ) {
        clearCaseGenLayerForReplaceAll();
        (modules || []).forEach(function(item) {
          var record = ensureAiModuleRecord(item.module, item);
          createdModules += 1;
          if (actionId === ROOT_ACTIONS.FULL_CASES) {
            commitCaseList(record.id, item.cases || [], durationMs, '', '');
            if ((item.cases || []).length) {
              affectedModules += 1;
              addedCases += (item.cases || []).length;
            }
          }
        });
        return {
          changed: createdModules > 0 || addedCases > 0,
          createdModules: createdModules,
          affectedModules: affectedModules,
          addedCases: addedCases,
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
        if (!existedBefore) createdModules += 1;
        if (item.cases && item.cases.length) {
          var merged = mergeCasesWithoutDuplicates(existingAiCases, item.cases, visibleCases);
          if (merged.appended.length > 0) {
            commitCaseList(record.id, merged.merged, durationMs, '', 'keep-valid');
            affectedModules += 1;
            addedCases += merged.appended.length;
            var baselineCount = entryBefore && Array.isArray(entryBefore.baselineCases) ? entryBefore.baselineCases.length : 0;
            setModuleTopupHighlight(moduleState, item.module, baselineCount + existingAiCases.length, merged.appended.length);
          }
        }
      });
      return {
        changed: createdModules > 0 || affectedModules > 0,
        createdModules: createdModules,
        affectedModules: affectedModules,
        addedCases: addedCases,
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
          notifyStatus('已放弃最近一次根节点生成', 'ok');
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
      var previousSnapshotId = ensureState().rootSnapshotId;
      var currentSnapshotId = '';
      var hadAiLayerBeforeAction = shouldResetAiLayerBeforeAction && hasAnyAiModules();
      var hadAiCasesBeforeAction = (
        actionId === ROOT_ACTIONS.FULL_CASES
        || actionId === ROOT_ACTIONS.REGENERATE_MODULES
      ) && hasAnyAiCases();
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
      if (hadAiCasesBeforeAction) setAllModuleResultsVisibility(false);
      render({ reason: 'root-running', anchorNodeId: anchorNodeId, persist: false });

      try {
        var modelResult = await executeXmindGeneration(contract, visibleContext, null);
        var modules = filterModulesByContract(normalizeModelModulesOutput(modelResult.content), contract, visibleContext);
        var applied = applyRootOutput(actionId, modules, visibleContext, modelResult.durationMs);
        rootState.running = false;
        rootState.hideAiLayer = false;
        rootState.status = '';
        rootState.error = '';
        rootState.updatedAt = Date.now();
        if (!applied.changed) {
          if (hadAiCasesBeforeAction) setAllModuleResultsVisibility(true);
          ensureState().rootSnapshotId = String(previousSnapshotId || '');
          rootState.snapshotId = String(previousSnapshotId || '');
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
        var message = '';
        if (actionId === ROOT_ACTIONS.FULL_MODULES) {
          message = '已生成 ' + String(applied.createdModules) + ' 个模块';
        } else if (actionId === ROOT_ACTIONS.REGENERATE_MODULES) {
          message = '已重新生成 ' + String(applied.createdModules) + ' 个模块';
        } else if (actionId === ROOT_ACTIONS.FULL_CASES) {
          message = (hadAiCasesBeforeAction ? '已重新生成 ' : '已生成 ')
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
        rootState.running = false;
        rootState.hideAiLayer = false;
        rootState.status = 'error';
        rootState.error = err && err.message ? String(err.message) : '未知错误';
        rootState.updatedAt = Date.now();
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
        if (moduleEntry.aiModuleId && casesGenApi && typeof casesGenApi.rollbackModuleCases === 'function') {
          var rolledBack = casesGenApi.rollbackModuleCases(moduleEntry.aiModuleId);
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
      }
      if (createdModuleBeforeAction) {
        moduleEntry.aiModule = ensureAiModuleRecord(moduleEntry.title, {
          module: moduleEntry.title,
        }, moduleId);
        moduleEntry.aiModuleId = moduleEntry.aiModule.id;
      }

      var moduleState = ensureModuleUiState(moduleEntry.aiModuleId);
      var hadAiCasesBeforeAction = actionId === MODULE_ACTIONS.FULL_CASES && hasAiCasesForModule(moduleEntry.aiModuleId);
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
        var contract = createOperationContract(actionId, resolvedEntry);
        var modelResult = await executeXmindGeneration(contract, visibleContext, resolvedEntry);
        var modules = filterModulesByContract(normalizeModelModulesOutput(modelResult.content), contract, visibleContext);
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
        if (actionId === MODULE_ACTIONS.APPEND) {
          var merged = mergeCasesWithoutDuplicates(currentAiCases, targetOutput.cases || [], visibleCases);
          nextList = merged.merged;
          appended = merged.appended;
          if (!appended.length) {
            if (createdModuleBeforeAction && moduleEntry.aiModuleId && casesGenApi && typeof casesGenApi.rollbackModuleCases === 'function') {
              casesGenApi.rollbackModuleCases(moduleEntry.aiModuleId);
              moduleEntry.aiModule = null;
              moduleEntry.aiModuleId = '';
            }
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
            if (createdModuleBeforeAction && moduleEntry.aiModuleId && casesGenApi && typeof casesGenApi.rollbackModuleCases === 'function') {
              casesGenApi.rollbackModuleCases(moduleEntry.aiModuleId);
              moduleEntry.aiModule = null;
              moduleEntry.aiModuleId = '';
            }
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
        moduleState.running = false;
        moduleState.status = 'error';
        moduleState.error = err && err.message ? String(err.message) : '未知错误';
        moduleState.hideResults = false;
        moduleState.updatedAt = Date.now();
        notifyStatus('生成失败：' + moduleState.error, 'err', { forceInline: true });
        render({ reason: 'module-error', anchorNodeId: anchorNodeId });
        persistXmindState(true);
        return false;
      }
    }

    function handleNodeAction(actionId, nodeMeta) {
      if (!actionId) return false;
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
          if (summaryDialogOpen === true) closeSummaryDialog();
          else openSummaryDialog(getPrepState().step || STEP_REQUIREMENT);
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
      if (importRequirementBtn) {
        importRequirementBtn.addEventListener('click', function() {
          triggerRequirementImport();
        });
      }
      if (importCasesBtn) {
        importCasesBtn.addEventListener('click', function() {
          triggerCasesImport();
        });
      }
      if (selectCasesBtn) {
        selectCasesBtn.addEventListener('click', function() {
          triggerCasesLibrarySelect();
        });
      }
      if (generateModulesBtn) {
        generateModulesBtn.addEventListener('click', function() {
          runRootAction(ROOT_ACTIONS.FULL_MODULES, { anchorNodeId: getRootNodeId() });
        });
      }
      if (generateFullBtn) {
        generateFullBtn.addEventListener('click', function() {
          runRootAction(ROOT_ACTIONS.FULL_CASES, { anchorNodeId: getRootNodeId() });
        });
      }
      if (exportBtn) {
        exportBtn.addEventListener('click', function() {
          exportCurrentXmind();
        });
      }
      if (promptBtn) {
        promptBtn.addEventListener('click', function() {
          openSummaryDialog(STEP_OPTIONS);
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
              renderPrepDialog();
            }
          }
        });
        summaryDialogBodyEl.addEventListener('change', function(event) {
          var target = event && event.target ? event.target : null;
          if (!target) return;
          if (target.name === 'xmindRequirementMode') {
            setPrepField('requirementMode', target.value === 'manual' ? 'manual' : 'document');
            renderPrepDialog();
            return;
          }
          if (target.name === 'xmindCaseImportMode') {
            setPrepField('caseImportMode', target.value === 'import' ? 'import' : 'skip');
            renderPrepDialog();
            scheduleRender('case-import-mode-change');
            return;
          }
          var settingKey = target.getAttribute ? target.getAttribute('data-casegen-setting') : '';
          if (settingKey) {
            setCaseGenOption(settingKey, target.type === 'checkbox' ? target.checked === true : (target.value || ''));
            renderPrepDialog();
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
              if (summaryDialogOpen === true) renderPrepDialog();
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
            if (summaryDialogOpen === true) renderPrepDialog();
            scheduleRender('file-change');
          }, 220);
        });
      });
      var caseFileList = document.getElementById('caseFileList');
      if (caseFileList && typeof MutationObserver !== 'undefined') {
        listObserver = new MutationObserver(function() {
          updateSummary();
          if (summaryDialogOpen === true) renderPrepDialog();
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
