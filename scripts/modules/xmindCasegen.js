(function() {
  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var utils = ctx.utils || {};
    var core = ctx.core || {};
    var casesGenApi = ctx.casesGenApi || {};

    var debounce = utils.debounce || function(fn) { return fn; };
    var showCenterToast = typeof utils.showCenterToast === 'function'
      ? utils.showCenterToast
      : function() {};
    var runConcurrentTasks = typeof utils.runConcurrent === 'function'
      ? utils.runConcurrent
      : function(items, concurrency, worker) {
        var list = Array.isArray(items) ? items.slice() : [];
        var limit = Math.max(1, Number(concurrency) || 1);
        var runner = typeof worker === 'function' ? worker : function(item) { return Promise.resolve(item); };
        var results = new Array(list.length);
        var cursor = 0;
        function startNext() {
          if (cursor >= list.length) return Promise.resolve();
          var index = cursor;
          cursor += 1;
          return Promise.resolve(runner(list[index], index))
            .then(function(result) {
              results[index] = result;
            })
            .then(startNext);
        }
        var workers = [];
        var workerCount = Math.min(limit, list.length || 1);
        for (var i = 0; i < workerCount; i += 1) {
          workers.push(startNext());
        }
        return Promise.all(workers).then(function() {
          return results;
        });
      };
    var setStatus = core.setStatus || function() {};
    var persistWorkflowState = core.persistWorkflowState || function() {};
    var persistWorkflowStateNow = core.persistWorkflowStateNow || persistWorkflowState;
    var switchTab = core.switchTab || function() {};

    var openBtn = document.getElementById('xmindCaseGenOpenBtn');
    var drawerEl = document.getElementById('xmindCaseGenDrawer');
    var drawerTitleEl = document.getElementById('xmindCaseGenDrawerTitle');
    var toolbarEl = document.getElementById('xmindCaseGenToolbar');
    var summaryBtn = document.getElementById('xmindCaseGenSummaryBtn');
    var summaryOverlayEl = document.getElementById('xmindCaseGenSummaryOverlay');
    var summaryDialogEl = document.getElementById('xmindCaseGenSummaryDialog');
    var summaryDialogBodyEl = document.getElementById('xmindCaseGenSummaryDialogBody');
    var summaryCloseBtn = document.getElementById('xmindCaseGenSummaryCloseBtn');
    var requirementBadgeEl = document.getElementById('xmindCaseGenRequirementBadge');
    var requirementSummaryEl = document.getElementById('xmindCaseGenRequirementSummary');
    var requirementMetaEl = document.getElementById('xmindCaseGenRequirementMeta');
    var casesBadgeEl = document.getElementById('xmindCaseGenCasesBadge');
    var casesSummaryEl = document.getElementById('xmindCaseGenCasesSummary');
    var casesMetaEl = document.getElementById('xmindCaseGenCasesMeta');
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
    var mindInstance = null;
    var currentMindData = null;
    var mindApiReadyPromise = null;
    var drawerInstance = null;
    var topupHighlightSyncTimer = 0;
    var topupHighlightMutationObserver = null;
    var topupHighlightMapObserver = null;
    var topupHighlightResizeObserver = null;
    var topupHighlightViewerEl = null;
    var topupHighlightCanvasEl = null;
    var topupHighlightScrollHandler = null;
    var topupHighlightResizeHandler = null;
    var summaryDialogOpen = false;
    var inlineControlsHost = null;
    var inlineStatusHost = null;

    function notifyInlineStatus(text, type) {
      setStatus(statusEl, text || '', type || '');
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
      var tone = type || '';
      if (tone === 'ok' && opts.forceInline !== true) {
        notifySuccessToast(text, opts.durationMs || 3000);
        return;
      }
      notifyInlineStatus(text, tone);
    }

    function getXmindCoreApi() {
      if (ctx.xmindCoreApi) return ctx.xmindCoreApi;
      return window.app && window.app.xmindCoreApi ? window.app.xmindCoreApi : null;
    }

    function getMindElixirCoreApi() {
      if (ctx.mindElixirCoreApi) return ctx.mindElixirCoreApi;
      return window.app && window.app.mindElixirCoreApi ? window.app.mindElixirCoreApi : null;
    }

    function ensureMindElixirCoreApiReady() {
      var readyApi = getMindElixirCoreApi();
      if (readyApi && typeof readyApi.renderMindMap === 'function') {
        return Promise.resolve(readyApi);
      }
      if (window.app && typeof window.app.ensureMindElixirCoreApi === 'function') {
        return window.app.ensureMindElixirCoreApi().then(function() {
          return getMindElixirCoreApi();
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
      var builtinExportBtn = controlsRoot.querySelector('[data-mind-action="export-xmind"]');
      if (builtinExportBtn && builtinExportBtn !== exportBtn) {
        builtinExportBtn.classList.add('xmind-casegen-default-export-hidden');
        builtinExportBtn.setAttribute('aria-hidden', 'true');
        builtinExportBtn.setAttribute('tabindex', '-1');
        builtinExportBtn.disabled = true;
      }
      return true;
    }

    function destroyMind() {
      cleanupTopupHighlightPresentation();
      restoreInlineControlsToBank();
      var mindElixirCoreApi = getMindElixirCoreApi();
      if (mindElixirCoreApi && typeof mindElixirCoreApi.destroyMindMap === 'function') {
        mindElixirCoreApi.destroyMindMap(mindInstance);
      }
      mindInstance = null;
      currentMindData = null;
      if (mindContainer) {
        mindContainer.innerHTML = '';
      }
    }

    function setCasesGenModulesView() {
      if (casesGenApi && typeof casesGenApi.setCaseGenViewTab === 'function') {
        casesGenApi.setCaseGenViewTab('modules');
      } else {
        var modulesTabBtn = document.getElementById('caseGenModulesTabBtn');
        if (modulesTabBtn && typeof modulesTabBtn.click === 'function') {
          modulesTabBtn.click();
        }
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
          setCasesGenModulesView();
          if (drawerTitleEl) {
            drawerTitleEl.textContent = 'XMind 用例生成';
          }
          closeSummaryDialog();
          setTimeout(function() {
            render({ reason: 'drawer-open', persist: false });
          }, 90);
        },
        onClose: function() {
          closeSummaryDialog();
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
          summaryCollapsed: false,
          nextSnapshotId: 1,
          snapshots: [],
          modules: {},
        };
      }
      if (!Array.isArray(state.xmindCaseGen.snapshots)) {
        state.xmindCaseGen.snapshots = [];
      }
      if (!state.xmindCaseGen.modules || typeof state.xmindCaseGen.modules !== 'object') {
        state.xmindCaseGen.modules = {};
      }
      if (!Number.isFinite(Number(state.xmindCaseGen.nextSnapshotId))) {
        state.xmindCaseGen.nextSnapshotId = 1;
      }
      if (Array.isArray(state.caseGenModules) && state.caseGenModules.length) {
        state.xmindCaseGen.hasModuleSkeleton = true;
      } else {
        state.xmindCaseGen.hasModuleSkeleton = false;
      }
      state.xmindCaseGen.mode = state.xmindCaseGen.mode === 'full' ? 'full' : 'modules';
      state.xmindCaseGen.treeSourceSignature = String(state.xmindCaseGen.treeSourceSignature || '');
      state.xmindCaseGen.summaryCollapsed = state.xmindCaseGen.summaryCollapsed === true;
      return state.xmindCaseGen;
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

    function resolveBuildResultList(buildResult) {
      if (!buildResult || typeof buildResult !== 'object') return [];
      if (Array.isArray(buildResult.list)) return buildResult.list.slice();
      if (buildResult.rawResult === undefined || buildResult.rawResult === null) return [];
      try {
        var parsed = JSON.parse(String(buildResult.rawResult || '[]'));
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        return [];
      }
    }

    function applyModuleTopupHighlight(moduleState, moduleId, buildResult) {
      if (!moduleState || typeof moduleState !== 'object') return null;
      var addedCount = Array.isArray(buildResult && buildResult.addedList) ? buildResult.addedList.length : 0;
      var list = resolveBuildResultList(buildResult);
      if (!addedCount || !list.length || addedCount > list.length) {
        clearModuleTopupHighlight(moduleState);
        return null;
      }
      moduleState.topupHighlight = {
        token: buildNodeId(['topup-highlight', moduleId, Date.now()]),
        label: buildTopupHighlightLabel(addedCount),
        startIndex: list.length - addedCount,
        count: addedCount,
        updatedAt: Date.now(),
      };
      return moduleState.topupHighlight;
    }

    function getModuleTopupHighlight(moduleState) {
      if (!moduleState || typeof moduleState !== 'object') return null;
      return cloneTopupHighlight(moduleState.topupHighlight);
    }

    function getCaseTopupHighlight(moduleState, caseIndex) {
      var marker = getModuleTopupHighlight(moduleState);
      var index = Number(caseIndex);
      if (!marker || !Number.isFinite(index) || index < 0) return null;
      if (index < marker.startIndex) return null;
      if (index >= marker.startIndex + marker.count) return null;
      return marker;
    }

    function clearTopupHighlightLayer(viewerEl) {
      if (!viewerEl || !viewerEl.querySelectorAll) return;
      var frames = viewerEl.querySelectorAll('[data-xmind-casegen-topup-frame]');
      if (frames && frames.length) {
        Array.prototype.forEach.call(frames, function(frameEl) {
          if (!frameEl || !frameEl.parentNode) return;
          frameEl.parentNode.removeChild(frameEl);
        });
      }
      var layer = viewerEl.querySelector
        ? viewerEl.querySelector('[data-xmind-casegen-topup-layer]')
        : null;
      if (layer && layer.parentNode) {
        layer.parentNode.removeChild(layer);
      }
    }

    function resolveTopupHighlightScale(viewerEl) {
      var scale = mindInstance && Number(mindInstance.scaleVal);
      if (Number.isFinite(scale) && scale > 0.01) return scale;
      var mapCanvasEl = viewerEl && viewerEl.querySelector
        ? viewerEl.querySelector('.map-canvas')
        : null;
      if (!mapCanvasEl || !mapCanvasEl.getBoundingClientRect) return 1;
      var rect = mapCanvasEl.getBoundingClientRect();
      var offsetWidth = Number(mapCanvasEl.offsetWidth || 0);
      if (offsetWidth > 0 && rect && rect.width > 0) {
        scale = rect.width / offsetWidth;
        if (Number.isFinite(scale) && scale > 0.01) return scale;
      }
      return 1;
    }

    function resolveTopupHighlightHost(wrapperEl) {
      if (!wrapperEl || !wrapperEl.parentElement) return null;
      var childrenEl = wrapperEl.parentElement;
      if (!childrenEl.tagName || String(childrenEl.tagName).toLowerCase() !== 'me-children') {
        return null;
      }
      return childrenEl.parentElement || null;
    }

    function getTopupHighlightViewerElement() {
      if (!mindContainer) return null;
      if (mindContainer.classList && mindContainer.classList.contains('xmind-structure-viewer')) {
        return mindContainer;
      }
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
      if (topupHighlightMapObserver) {
        topupHighlightMapObserver.disconnect();
        topupHighlightMapObserver = null;
      }
      if (topupHighlightResizeObserver) {
        topupHighlightResizeObserver.disconnect();
        topupHighlightResizeObserver = null;
      }
      if (topupHighlightCanvasEl && topupHighlightScrollHandler) {
        topupHighlightCanvasEl.removeEventListener('scroll', topupHighlightScrollHandler);
      }
      if (typeof window !== 'undefined' && topupHighlightResizeHandler) {
        window.removeEventListener('resize', topupHighlightResizeHandler);
      }
      if (topupHighlightViewerEl) {
        clearTopupHighlightLayer(topupHighlightViewerEl);
      }
      topupHighlightViewerEl = null;
      topupHighlightCanvasEl = null;
      topupHighlightScrollHandler = null;
      topupHighlightResizeHandler = null;
    }

    function scheduleTopupHighlightSync() {
      // `mindElixirCore` 会持续做节点装饰，画布 DOM 在短时间内可能频繁抖动。
      // 这里改成合并调度，避免反复 clearTimeout 导致高亮框同步永远得不到执行机会。
      if (topupHighlightSyncTimer) return;
      topupHighlightSyncTimer = setTimeout(function() {
        topupHighlightSyncTimer = 0;
        syncTopupHighlightPresentation();
      }, 24);
    }

    function syncTopupHighlightPresentation() {
      var viewerEl = topupHighlightViewerEl || getTopupHighlightViewerElement();
      if (!viewerEl || !viewerEl.getBoundingClientRect || !viewerEl.querySelectorAll) return;
      clearTopupHighlightLayer(viewerEl);
      if (!isDrawerOpen()) return;
      var nodes = viewerEl.querySelectorAll('me-tpc[data-xmind-topup-highlight-token]');
      if (!nodes || !nodes.length) return;
      var scale = resolveTopupHighlightScale(viewerEl);
      var groups = {};
      Array.prototype.forEach.call(nodes, function(nodeEl) {
        if (!nodeEl || !nodeEl.getAttribute) return;
        var token = String(nodeEl.getAttribute('data-xmind-topup-highlight-token') || '');
        if (!token) return;
        var wrapperEl = nodeEl.closest ? nodeEl.closest('me-wrapper') : null;
        var hostEl = resolveTopupHighlightHost(wrapperEl);
        if (!wrapperEl || !hostEl || !wrapperEl.getBoundingClientRect || !hostEl.getBoundingClientRect) return;
        var wrapperRect = wrapperEl.getBoundingClientRect();
        var hostRect = hostEl.getBoundingClientRect();
        if (
          !wrapperRect ||
          !hostRect ||
          wrapperRect.width <= 0 ||
          wrapperRect.height <= 0 ||
          hostRect.width <= 0 ||
          hostRect.height <= 0
        ) {
          return;
        }
        var left = (wrapperRect.left - hostRect.left) / scale;
        var top = (wrapperRect.top - hostRect.top) / scale;
        var right = left + (wrapperRect.width / scale);
        var bottom = top + (wrapperRect.height / scale);
        if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) {
          return;
        }
        if (!groups[token]) {
          groups[token] = {
            label: String(nodeEl.getAttribute('data-xmind-topup-highlight-label') || '本轮追加用例'),
            hostEl: hostEl,
            minLeft: left,
            minTop: top,
            maxRight: right,
            maxBottom: bottom,
          };
          return;
        }
        if (groups[token].hostEl !== hostEl) return;
        groups[token].minLeft = Math.min(groups[token].minLeft, left);
        groups[token].minTop = Math.min(groups[token].minTop, top);
        groups[token].maxRight = Math.max(groups[token].maxRight, right);
        groups[token].maxBottom = Math.max(groups[token].maxBottom, bottom);
      });
      Object.keys(groups).forEach(function(token) {
        var group = groups[token];
        var hostEl = group && group.hostEl ? group.hostEl : null;
        if (!group || !hostEl || !hostEl.appendChild) return;
        var frameEl = document.createElement('div');
        frameEl.className = 'xmind-casegen-topup-highlight-frame';
        frameEl.setAttribute('data-xmind-casegen-topup-frame', token);
        frameEl.style.left = String(group.minLeft - 12) + 'px';
        frameEl.style.top = String(group.minTop - 14) + 'px';
        frameEl.style.width = String(Math.max(48, group.maxRight - group.minLeft + 24)) + 'px';
        frameEl.style.height = String(Math.max(40, group.maxBottom - group.minTop + 26)) + 'px';
        var labelEl = document.createElement('span');
        labelEl.className = 'xmind-casegen-topup-highlight-label';
        labelEl.textContent = group.label || '本轮追加用例';
        frameEl.appendChild(labelEl);
        hostEl.appendChild(frameEl);
      });
    }

    function bindTopupHighlightPresentation() {
      cleanupTopupHighlightPresentation();
      var viewerEl = getTopupHighlightViewerElement();
      if (!viewerEl) return;
      topupHighlightViewerEl = viewerEl;
      topupHighlightCanvasEl = viewerEl.querySelector('[data-mind-canvas]');
      var mapRootEl = viewerEl.querySelector('.map-container') || viewerEl.querySelector('.map-canvas');
      if (topupHighlightCanvasEl && typeof topupHighlightCanvasEl.addEventListener === 'function') {
        topupHighlightScrollHandler = function() {
          scheduleTopupHighlightSync();
        };
        topupHighlightCanvasEl.addEventListener('scroll', topupHighlightScrollHandler, { passive: true });
      }
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        topupHighlightResizeHandler = function() {
          scheduleTopupHighlightSync();
        };
        window.addEventListener('resize', topupHighlightResizeHandler);
      }
      if (typeof MutationObserver !== 'undefined' && mapRootEl) {
        topupHighlightMutationObserver = new MutationObserver(function() {
          scheduleTopupHighlightSync();
        });
        topupHighlightMutationObserver.observe(mapRootEl, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'data-xmind-topup-highlight-token', 'data-xmind-topup-highlight-label'],
        });
      }
      if (typeof MutationObserver !== 'undefined' && mindInstance && mindInstance.map) {
        topupHighlightMapObserver = new MutationObserver(function() {
          scheduleTopupHighlightSync();
        });
        topupHighlightMapObserver.observe(mindInstance.map, {
          attributes: true,
          attributeFilter: ['style'],
        });
      }
      if (typeof ResizeObserver !== 'undefined') {
        topupHighlightResizeObserver = new ResizeObserver(function() {
          scheduleTopupHighlightSync();
        });
        topupHighlightResizeObserver.observe(viewerEl);
        if (mapRootEl) {
          topupHighlightResizeObserver.observe(mapRootEl);
        }
      }
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
        return item && valid[String(item.moduleId || '')];
      });
    }

    function hasCustomRequirementLabel() {
      var label = state.requirementLabel ? String(state.requirementLabel).trim() : '';
      var source = state.requirementLabelSource ? String(state.requirementLabelSource).trim() : '';
      if (!label) return false;
      if (source && source !== 'default') return true;
      return label !== '当前需求';
    }

    function getRequirementLabelText() {
      if (hasCustomRequirementLabel()) {
        return String(state.requirementLabel || '').trim();
      }
      return '';
    }

    function getDisplayRequirementLabel() {
      var label = getRequirementLabelText();
      return label || '当前需求';
    }

    function getImportedCaseCount() {
      var casesCoreApi = getCasesCoreApi();
      if (casesCoreApi && typeof casesCoreApi.getImportedCaseObjects === 'function') {
        return casesCoreApi.getImportedCaseObjects().length;
      }
      var count = 0;
      (state.importedCases || []).forEach(function(item) {
        if (item && Array.isArray(item.list)) count += item.list.length;
      });
      return count;
    }

    function applySummaryDialogState() {
      var open = summaryDialogOpen === true;
      if (toolbarEl && toolbarEl.classList) {
        toolbarEl.classList.toggle('is-summary-open', open);
      }
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
        summaryBtn.textContent = open ? '收起摘要' : '查看摘要';
        summaryBtn.title = open ? '关闭当前需求与参考用例摘要' : '查看当前需求与参考用例摘要';
      }
    }

    function openSummaryDialog() {
      summaryDialogOpen = true;
      applySummaryDialogState();
    }

    function closeSummaryDialog() {
      summaryDialogOpen = false;
      applySummaryDialogState();
    }

    function updateSummary() {
      var rawTextEl = document.getElementById('rawText');
      var rawText = rawTextEl && rawTextEl.value ? String(rawTextEl.value).trim() : '';
      var requirementLabel = getRequirementLabelText();
      if (requirementBadgeEl) {
        requirementBadgeEl.textContent = requirementLabel ? '已识别' : (rawText ? '待确认' : '未导入');
      }
      if (requirementSummaryEl) {
        requirementSummaryEl.textContent = requirementLabel || (rawText ? '已导入需求正文，待确认需求标识' : '未导入需求');
      }
      if (requirementMetaEl) {
        if (rawText) {
          var importName = state.lastRawImportName ? String(state.lastRawImportName) : '当前输入';
          requirementMetaEl.textContent = '来源：' + importName + '，需求正文 ' + String(rawText.length) + ' 字。';
        } else {
          requirementMetaEl.textContent = '请先导入或填写需求，再生成模块骨架。';
        }
      }

      var importedFiles = Array.isArray(state.importedCases) ? state.importedCases : [];
      var importedCount = importedFiles.length;
      var caseCount = getImportedCaseCount();
      var caseTextEl = document.getElementById('caseText');
      var caseTextValue = caseTextEl && caseTextEl.value ? String(caseTextEl.value).trim() : '';
      if (casesBadgeEl) {
        if (importedCount > 0) {
          casesBadgeEl.textContent = String(importedCount) + ' 份';
        } else if (caseTextValue) {
          casesBadgeEl.textContent = '文本';
        } else {
          casesBadgeEl.textContent = '0 份';
        }
      }
      if (casesSummaryEl) {
        if (importedCount > 0) {
          casesSummaryEl.textContent = '已导入 ' + importedCount + ' 份参考用例，累计 ' + caseCount + ' 条';
        } else if (caseTextValue) {
          casesSummaryEl.textContent = '当前存在手工输入的参考用例文本';
        } else {
          casesSummaryEl.textContent = '未导入参考用例';
        }
      }
      if (casesMetaEl) {
        if (importedCount > 0) {
          var names = importedFiles.slice(0, 3).map(function(item) {
            return item && item.name ? String(item.name) : '参考用例';
          }).join('、');
          var suffix = importedFiles.length > 3 ? ' 等' : '';
          casesMetaEl.textContent = '当前参考来源：' + names + suffix + '。';
        } else if (caseTextValue) {
          casesMetaEl.textContent = '当前文本会作为参考上下文和去重依据参与生成。';
        } else {
          casesMetaEl.textContent = '导入的用例只参与上下文与去重，不会并入当前 XMind 主树。';
        }
      }
      applySummaryDialogState();
    }

    function getSplitText() {
      var splitEl = document.getElementById('splitResult');
      return splitEl && splitEl.value ? String(splitEl.value).trim() : '';
    }

    function resetSharedCaseGenStateBySplit(splitText, modules) {
      var prevState = ensureState();
      state.caseGenModules = Array.isArray(modules) ? modules : [];
      state.caseGenResults = {};
      state.caseSelections = {};
      state.caseGenSuggestions = {};
      state.caseGenSource = String(splitText || '');
      state.caseGenModuleStatus = {};
      state.caseGenProgress = {};
      state.caseGenRunning = new Set();
      state.caseGenTiming = {};
      state.xmindCaseGen = {
        mode: 'modules',
        treeSourceSignature: '',
        hasModuleSkeleton: state.caseGenModules.length > 0,
        summaryCollapsed: prevState && prevState.summaryCollapsed === true,
        nextSnapshotId: 1,
        snapshots: [],
        modules: {},
      };
      if (casesGenApi && typeof casesGenApi.renderCaseGeneration === 'function') {
        casesGenApi.renderCaseGeneration();
      }
      if (casesGenApi && typeof casesGenApi.renderCaseGenProgressBoard === 'function') {
        casesGenApi.renderCaseGenProgressBoard();
      }
    }

    async function ensureModuleSkeleton(options) {
      options = options || {};
      var anchorNodeId = options.anchorNodeId || getRootNodeId();
      var ensuredLabel = window.app && typeof window.app.ensureRequirementLabel === 'function'
        ? window.app.ensureRequirementLabel('请输入需求标识后再生成模块')
        : getRequirementLabelText();
      if (!ensuredLabel) {
        notifyStatus('已取消生成模块（需求标识为空）', 'warn');
        render({ reason: 'module-label-cancelled', anchorNodeId: anchorNodeId });
        return false;
      }
      var splitText = getSplitText();
      if (!splitText && window.app && typeof window.app.splitModules === 'function') {
        notifyStatus('正在复用拆分链路生成模块...', '');
        try {
          await window.app.splitModules();
        } catch (err) {
          notifyStatus('模块拆分失败：' + (err && err.message ? err.message : '未知错误'), 'err');
          render({ reason: 'module-split-error', anchorNodeId: anchorNodeId });
          return false;
        }
        splitText = getSplitText();
      }
      if (!splitText) {
        notifyStatus('请先导入需求并完成模块拆分后再生成模块骨架', 'warn');
        render({ reason: 'module-split-missing', anchorNodeId: anchorNodeId });
        return false;
      }
      if (!state.caseGenModules.length || state.caseGenSource !== splitText || options.forceRefresh === true) {
        var modules = window.app && typeof window.app.parseSplitModules === 'function'
          ? window.app.parseSplitModules()
          : [];
        if (!modules.length) {
          notifyStatus('未解析到有效模块，请先检查当前拆分结果', 'warn');
          render({ reason: 'module-parse-empty', anchorNodeId: anchorNodeId });
          return false;
        }
        resetSharedCaseGenStateBySplit(splitText, modules);
      }
      var xmindState = ensureState();
      xmindState.hasModuleSkeleton = state.caseGenModules.length > 0;
      xmindState.mode = 'modules';
      xmindState.treeSourceSignature = buildTreeSignature();
      notifyStatus('已生成模块骨架，可在根节点或模块节点继续触发 AI 生成。', 'ok');
      persistWorkflowStateNow();
      render({ reason: 'module-skeleton-ready', anchorNodeId: anchorNodeId });
      return true;
    }

    function hasGeneratedCases(moduleId) {
      if (!casesGenApi || typeof casesGenApi.getCaseListForModule !== 'function') return false;
      return casesGenApi.getCaseListForModule(moduleId).length > 0;
    }

    function hasIncompleteModules() {
      if (!Array.isArray(state.caseGenModules) || !state.caseGenModules.length) return false;
      return state.caseGenModules.some(function(mod) {
        return Boolean(mod && mod.id && !hasGeneratedCases(mod.id));
      });
    }

    function resolveBatchConcurrency(count) {
      var total = Math.round(Number(count));
      if (!Number.isFinite(total) || total <= 0) return 1;
      return Math.max(1, Math.min(5, total));
    }

    function getRootDefaultActionId() {
      var xmindState = ensureState();
      if (!xmindState.hasModuleSkeleton || !state.caseGenModules.length) return 'build-modules';
      if (hasIncompleteModules()) return 'generate-full';
      return 'regenerate-all';
    }

    function getRootActions() {
      var disabled = false;
      var rootState = ensureState();
      Object.keys(rootState.modules).forEach(function(key) {
        var item = rootState.modules[key];
        if (item && item.running) disabled = true;
      });
      if (!rootState.hasModuleSkeleton || !state.caseGenModules.length) {
        return [{ id: 'build-modules', label: '仅生成模块', disabled: disabled }];
      }
      if (hasIncompleteModules()) {
        return [{ id: 'generate-full', label: '生成完整用例', disabled: disabled }];
      }
      return [
        { id: 'regenerate-all', label: '重新生成全部', disabled: disabled },
        { id: 'topup-all', label: '追加生成全部', disabled: disabled },
      ];
    }

    function getModuleDefaultActionId(moduleId) {
      if (!moduleId) return '';
      return hasGeneratedCases(moduleId) ? 'regenerate-module' : 'generate-module';
    }

    function getModuleActions(moduleId) {
      var uiState = ensureModuleUiState(moduleId);
      if (!uiState) return [];
      if (uiState.running) {
        return [{ id: getModuleDefaultActionId(moduleId) || 'generate-module', label: '生成中...', disabled: true }];
      }
      var actions = [];
      if (hasGeneratedCases(moduleId)) {
        actions.push({ id: 'regenerate-module', label: '重新生成', disabled: false });
        actions.push({ id: 'topup-module', label: '追加生成', disabled: false });
      } else {
        actions.push({ id: 'generate-module', label: '生成本模块用例', disabled: false });
      }
      if (uiState.snapshotId) {
        actions.push({ id: 'rollback-module', label: '放弃本次生成', disabled: false });
      }
      return actions;
    }

    function buildTreeSignature() {
      var payload = {
        requirementLabel: getDisplayRequirementLabel(),
        caseGenSource: state.caseGenSource || '',
        modules: (state.caseGenModules || []).map(function(mod) {
          return {
            id: mod && mod.id ? String(mod.id) : '',
            title: mod && (mod.title || mod.module) ? String(mod.title || mod.module) : '',
            result: state.caseGenResults && mod && mod.id ? String(state.caseGenResults[mod.id] || '') : '',
          };
        }),
      };
      try {
        return JSON.stringify(payload);
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
      return buildNodeId(['root', getDisplayRequirementLabel()]);
    }

    function getModuleNodeId(moduleId) {
      if (!moduleId) return '';
      var title = '';
      (state.caseGenModules || []).some(function(mod) {
        if (!mod || String(mod.id || '') !== String(moduleId)) return false;
        title = mod.title || mod.module || '';
        return true;
      });
      return buildNodeId(['module', moduleId, title || '模块']);
    }

    function createNode(topic, meta, children) {
      var stableNodeId = meta && meta.nodeId ? String(meta.nodeId) : '';
      var node = {
        id: stableNodeId || buildNodeId([meta && meta.type ? meta.type : 'node', meta && meta.moduleId ? meta.moduleId : '', meta && meta.caseIndex !== undefined ? meta.caseIndex : '', meta && meta.segment ? meta.segment : '', meta && meta.status ? meta.status : '', topic]),
        topic: topic || '-',
        expanded: true,
        xmindMeta: meta || {},
      };
      if (meta && meta.branchColor) {
        node.branchColor = String(meta.branchColor);
      }
      if (Array.isArray(children) && children.length) {
        node.children = children;
      }
      return node;
    }

    function buildTopupPendingNode(moduleId) {
      return createNode('追加生成中', {
        type: 'topup-placeholder',
        moduleId: moduleId,
        status: 'running',
        nodeId: buildNodeId(['topup-placeholder', moduleId]),
        branchColor: '#2563eb',
      });
    }

    function buildCaseTree(moduleId, moduleTitle, item, caseIndex, topupHighlight) {
      var xmindCoreApi = getXmindCoreApi();
      var fields = xmindCoreApi && typeof xmindCoreApi.buildCaseFieldsForXmind === 'function'
        ? xmindCoreApi.buildCaseFieldsForXmind(item || {}, moduleTitle || '模块')
        : [
            moduleTitle || '模块',
            item && item.title ? String(item.title) : '用例',
            item && item.priority ? String(item.priority) : 'P1',
            item && item.preconditions ? String(item.preconditions) : '-',
            item && item.steps ? String(item.steps) : '-',
            item && item.expected ? String(item.expected) : '-',
          ];
      var expectedNode = createNode(fields[5] || '-', { type: 'expected', moduleId: moduleId, caseIndex: caseIndex, segment: 'expected' });
      var stepsNode = createNode(fields[4] || '-', { type: 'steps', moduleId: moduleId, caseIndex: caseIndex, segment: 'steps' }, [expectedNode]);
      var preNode = createNode(fields[3] || '-', { type: 'preconditions', moduleId: moduleId, caseIndex: caseIndex, segment: 'preconditions' }, [stepsNode]);
      var priorityNode = createNode(fields[2] || 'P1', { type: 'priority', moduleId: moduleId, caseIndex: caseIndex, segment: 'priority' }, [preNode]);
      var caseMeta = { type: 'case', moduleId: moduleId, caseIndex: caseIndex };
      if (topupHighlight) {
        caseMeta.topupHighlightToken = String(topupHighlight.token || '');
        caseMeta.topupHighlightLabel = String(topupHighlight.label || '本轮追加用例');
      }
      return createNode(fields[1] || ('用例' + String(caseIndex + 1)), caseMeta, [priorityNode]);
    }

    function buildMindData() {
      clearStaleModuleUiState();
      var xmindState = ensureState();
      var children = [];
      var rootLabel = getDisplayRequirementLabel();

      if (!state.caseGenModules.length) {
        children.push(createNode('尚未生成模块骨架', { type: 'placeholder' }));
      } else {
        state.caseGenModules.forEach(function(mod, moduleIndex) {
          if (!mod || !mod.id) return;
          var moduleId = String(mod.id);
          var moduleTitle = mod.title || mod.module || ('模块' + String(moduleIndex + 1));
          var moduleUi = ensureModuleUiState(moduleId);
          var moduleChildren = [];
          var moduleMeta = {
            type: 'module',
            moduleId: moduleId,
            moduleIndex: moduleIndex,
            nodeId: getModuleNodeId(moduleId),
          };
          var moduleCases = casesGenApi && typeof casesGenApi.getCaseListForModule === 'function'
            ? casesGenApi.getCaseListForModule(moduleId)
            : [];

          if (moduleUi && moduleUi.running && moduleUi.lastAction !== 'topup-module') {
            moduleMeta.status = 'running';
            moduleMeta.statusText = '生成中';
          } else if (moduleUi && moduleUi.status === 'error') {
            moduleMeta.status = 'error';
            moduleMeta.statusText = moduleUi.error || '生成失败，请重试';
          }

          if (!(moduleUi && moduleUi.hideResults) && Array.isArray(moduleCases) && moduleCases.length) {
            moduleCases.forEach(function(item, caseIndex) {
              moduleChildren.push(buildCaseTree(
                moduleId,
                moduleTitle,
                item,
                caseIndex,
                getCaseTopupHighlight(moduleUi, caseIndex)
              ));
            });
          }
          if (moduleUi && moduleUi.running && moduleUi.lastAction === 'topup-module') {
            moduleChildren.push(buildTopupPendingNode(moduleId));
          }

          children.push(createNode(moduleTitle, moduleMeta, moduleChildren));
        });
      }

      xmindState.treeSourceSignature = buildTreeSignature();
      return {
        nodeData: createNode(rootLabel, {
          type: 'root',
          nodeId: getRootNodeId(),
        }, children),
      };
    }

    function getNodeActions(nodeMeta) {
      if (!nodeMeta || !nodeMeta.meta) return [];
      var meta = nodeMeta.meta;
      if (meta.type === 'root') return getRootActions();
      if (meta.type === 'module') return getModuleActions(meta.moduleId);
      if (meta.type === 'status') return getModuleActions(meta.moduleId);
      return [];
    }

    function getNodeQuickAction(nodeMeta) {
      if (!nodeMeta || !nodeMeta.meta) return null;
      var meta = nodeMeta.meta;
      if (meta.type === 'root') {
        var rootActions = getRootActions();
        var rootAction = rootActions && rootActions.length ? rootActions[0] : null;
        return {
          id: rootAction && rootAction.id ? rootAction.id : getRootDefaultActionId(),
          label: '+AI',
          disabled: rootAction ? rootAction.disabled === true : false,
        };
      }
      if (meta.type === 'module') {
        var moduleActions = getModuleActions(meta.moduleId);
        var moduleAction = moduleActions && moduleActions.length ? moduleActions[0] : null;
        return {
          id: moduleAction && moduleAction.id ? moduleAction.id : getModuleDefaultActionId(meta.moduleId),
          label: '+AI',
          disabled: moduleAction ? moduleAction.disabled === true : false,
        };
      }
      return null;
    }

    function decorateNodeElement(nodeEl, nodeMeta) {
      if (!nodeEl || !nodeEl.classList) return;
      var statusBadge = nodeEl.querySelector ? nodeEl.querySelector('.xmind-node-status-badge') : null;
      var topupSpinner = nodeEl.querySelector ? nodeEl.querySelector('.xmind-node-topup-spinner') : null;
      if (statusBadge && statusBadge.parentNode) {
        statusBadge.parentNode.removeChild(statusBadge);
      }
      if (topupSpinner && topupSpinner.parentNode) {
        topupSpinner.parentNode.removeChild(topupSpinner);
      }
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
      if (!nodeMeta || !nodeMeta.meta) return;
      var meta = nodeMeta.meta;
      if (meta.type === 'root') {
        nodeEl.classList.add('xmind-casegen-node-root');
        return;
      }
      if (meta.type === 'module') {
        nodeEl.classList.add('xmind-casegen-node-module');
        var branchMainEl = nodeEl.closest ? nodeEl.closest('me-main') : null;
        if (branchMainEl && branchMainEl.classList && branchMainEl.classList.contains('lhs')) {
          nodeEl.classList.add('xmind-casegen-node-flow-left');
        } else {
          nodeEl.classList.add('xmind-casegen-node-flow-right');
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
          if (meta.status !== 'running' && meta.statusText) {
            badge.title = String(meta.statusText);
          }
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
      if (meta.type === 'case' && meta.topupHighlightToken) {
        nodeEl.classList.add('xmind-casegen-node-topup-highlight-case');
        nodeEl.setAttribute('data-xmind-topup-highlight-token', String(meta.topupHighlightToken));
        nodeEl.setAttribute('data-xmind-topup-highlight-label', String(meta.topupHighlightLabel || '本轮追加用例'));
      }
    }

    function render(options) {
      options = options || {};
      updateSummary();
      if (!mindContainer || !isDrawerOpen()) {
        if (options.persist !== false) {
          persistWorkflowState();
        }
        return;
      }
      var freshRender = !mindInstance;
      currentMindData = buildMindData();
      var mindElixirCoreApi = getMindElixirCoreApi();
      if (!mindElixirCoreApi || typeof mindElixirCoreApi.renderMindMap !== 'function') {
        cleanupTopupHighlightPresentation();
        mindContainer.innerHTML = '<p class="hint" style="padding:16px;">正在加载 MindElixir 依赖...</p>';
        if (!mindApiReadyPromise) {
          mindApiReadyPromise = ensureMindElixirCoreApiReady()
            .then(function(readyApi) {
              mindApiReadyPromise = null;
              if (!readyApi || typeof readyApi.renderMindMap !== 'function') {
                throw new Error('MindElixir 依赖未就绪');
              }
              render({ reason: 'mind-ready', persist: false });
              return readyApi;
            })
            .catch(function(err) {
              mindApiReadyPromise = null;
              cleanupTopupHighlightPresentation();
              if (mindContainer) {
                mindContainer.innerHTML = '<p class="hint" style="padding:16px;">MindElixir 依赖加载失败：' + (err && err.message ? err.message : '未知错误') + '</p>';
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
      } catch (err) {
        cleanupTopupHighlightPresentation();
        mindContainer.innerHTML = '<p class="hint" style="padding:16px;">XMind 画布初始化失败：' + (err && err.message ? err.message : '未知错误') + '</p>';
      }
      if (options.persist !== false) persistWorkflowState();
    }

    function scheduleRender(reason) {
      if (renderTimer) clearTimeout(renderTimer);
      renderTimer = setTimeout(function() {
        renderTimer = 0;
        render({ reason: reason || 'scheduled' });
      }, 60);
    }

    async function runModuleAction(moduleId, actionId, options) {
      options = options || {};
      var moduleState = ensureModuleUiState(moduleId);
      if (!moduleState || moduleState.running) return false;
      var anchorNodeId = options.anchorNodeId || getModuleNodeId(moduleId);
      if (actionId === 'rollback-module') {
        if (casesGenApi && typeof casesGenApi.rollbackModuleCases === 'function') {
          var rollbackRestoreHighlight = cloneTopupHighlight(moduleState.rollbackRestoreTopupHighlight);
          var rolledBack = casesGenApi.rollbackModuleCases(moduleId);
          if (rolledBack) {
            moduleState.topupHighlight = rollbackRestoreHighlight;
            moduleState.rollbackRestoreTopupHighlight = null;
            notifyStatus('已回滚到本轮生成前的共享结果快照。', 'ok');
          }
          render({ reason: 'rollback-module', anchorNodeId: anchorNodeId });
          return rolledBack;
        }
        return false;
      }

      var buildFn = actionId === 'topup-module'
        ? casesGenApi.buildModuleTopup
        : casesGenApi.buildModuleCases;
      if (typeof buildFn !== 'function') return false;
      var preservedTopupHighlight = cloneTopupHighlight(moduleState.topupHighlight);

      var snapshotId = '';
      if (casesGenApi && typeof casesGenApi.snapshotModuleCases === 'function') {
        snapshotId = casesGenApi.snapshotModuleCases(moduleId) || '';
      }
      moduleState.snapshotId = snapshotId;
      moduleState.rollbackRestoreTopupHighlight = actionId === 'topup-module' ? null : preservedTopupHighlight;
      moduleState.lastAction = actionId;
      moduleState.running = true;
      moduleState.status = '';
      moduleState.error = '';
      moduleState.hideResults = actionId === 'topup-module' ? false : true;
      if (actionId === 'topup-module') {
        clearModuleTopupHighlight(moduleState);
      }
      moduleState.updatedAt = Date.now();
      notifyStatus('正在处理模块【' + String(moduleId) + '】...', '');
      render({ reason: 'module-running', persist: false, anchorNodeId: anchorNodeId });

      try {
        var promptSettings = casesGenApi && typeof casesGenApi.ensureCaseGenSettings === 'function'
          ? casesGenApi.ensureCaseGenSettings()
          : {};
        var buildResult = await buildFn(moduleId, {
          promptSettingsSnapshot: promptSettings,
        });
        if (!buildResult) {
          moduleState.running = false;
          moduleState.hideResults = false;
          moduleState.snapshotId = '';
          moduleState.rollbackRestoreTopupHighlight = null;
          if (actionId !== 'topup-module') {
            moduleState.topupHighlight = preservedTopupHighlight;
          }
          render({ reason: 'module-empty', anchorNodeId: anchorNodeId });
          return false;
        }
        if (buildResult.cancelled) {
          moduleState.running = false;
          moduleState.hideResults = false;
          moduleState.snapshotId = '';
          moduleState.rollbackRestoreTopupHighlight = null;
          if (actionId !== 'topup-module') {
            moduleState.topupHighlight = preservedTopupHighlight;
          }
          notifyStatus(buildResult.statusText || '已取消当前操作', buildResult.statusType || 'warn');
          render({ reason: 'module-cancelled', anchorNodeId: anchorNodeId });
          return false;
        }
        if (buildResult.shouldCommit === false) {
          moduleState.running = false;
          moduleState.hideResults = false;
          moduleState.snapshotId = '';
          moduleState.rollbackRestoreTopupHighlight = null;
          if (actionId !== 'topup-module') {
            moduleState.topupHighlight = preservedTopupHighlight;
          }
          notifyStatus(buildResult.statusText || '本轮未新增结果', buildResult.statusType || 'warn');
          render({ reason: 'module-no-commit', anchorNodeId: anchorNodeId });
          return false;
        }
        if (casesGenApi && typeof casesGenApi.commitModuleCases === 'function') {
          casesGenApi.commitModuleCases(moduleId, buildResult);
        }
        moduleState.running = false;
        moduleState.status = '';
        moduleState.error = '';
        moduleState.hideResults = false;
        if (actionId === 'topup-module') {
          applyModuleTopupHighlight(moduleState, moduleId, buildResult);
        } else {
          clearModuleTopupHighlight(moduleState);
        }
        moduleState.updatedAt = Date.now();
        notifyStatus(buildResult.statusText || '生成完成', buildResult.statusType || 'ok');
        render({ reason: 'module-committed', anchorNodeId: anchorNodeId });
        return true;
      } catch (err) {
        moduleState.running = false;
        moduleState.status = 'error';
        moduleState.error = err && err.message ? String(err.message) : '未知错误';
        moduleState.hideResults = false;
        moduleState.snapshotId = '';
        moduleState.rollbackRestoreTopupHighlight = null;
        if (actionId !== 'topup-module') {
          moduleState.topupHighlight = preservedTopupHighlight;
        }
        moduleState.updatedAt = Date.now();
        notifyStatus('生成失败：' + moduleState.error, 'err');
        render({ reason: 'module-error', anchorNodeId: anchorNodeId });
        return false;
      } finally {
        persistWorkflowStateNow();
      }
    }

    async function runBatchAction(actionId, options) {
      options = options || {};
      var anchorNodeId = options.anchorNodeId || getRootNodeId();
      if (actionId === 'build-modules') {
        return ensureModuleSkeleton({ anchorNodeId: anchorNodeId });
      }
      var ready = await ensureModuleSkeleton({ anchorNodeId: anchorNodeId });
      if (!ready) return false;
      var queue = [];
      (state.caseGenModules || []).forEach(function(mod) {
        if (!mod || !mod.id) return;
        if (actionId === 'generate-full') {
          if (!hasGeneratedCases(mod.id)) queue.push({ moduleId: mod.id, actionId: 'generate-module' });
        } else if (actionId === 'regenerate-all') {
          queue.push({ moduleId: mod.id, actionId: 'regenerate-module' });
        } else if (actionId === 'topup-all') {
          if (hasGeneratedCases(mod.id)) queue.push({ moduleId: mod.id, actionId: 'topup-module' });
        }
      });
      if (!queue.length) {
        notifyStatus(actionId === 'topup-all' ? '当前没有可追加生成的模块。' : '当前没有需要处理的模块。', 'warn');
        render({ reason: 'batch-empty', anchorNodeId: anchorNodeId });
        return false;
      }
      ensureState().mode = 'full';
      var parallelBatch = actionId === 'regenerate-all' || actionId === 'topup-all';
      var batchConcurrency = parallelBatch ? resolveBatchConcurrency(queue.length) : 1;
      if (parallelBatch && queue.length > 1) {
        var actionLabel = actionId === 'topup-all' ? '追加生成全部' : '重新生成全部';
        notifyStatus('正在' + actionLabel + '（' + queue.length + '个模块，并发 ' + batchConcurrency + '）', '');
      }
      var successCount = 0;
      var failedCount = 0;
      var results = null;
      if (parallelBatch && queue.length > 1) {
        results = await runConcurrentTasks(queue, batchConcurrency, function(task) {
          return Promise.resolve(runModuleAction(task.moduleId, task.actionId, {
            anchorNodeId: anchorNodeId,
          })).catch(function(err) {
            console.error('XMind 批量动作执行异常', err);
            return false;
          });
        });
      } else {
        results = [];
        for (var i = 0; i < queue.length; i += 1) {
          var task = queue[i];
          results.push(await runModuleAction(task.moduleId, task.actionId, {
            anchorNodeId: anchorNodeId,
          }));
        }
      }
      results.forEach(function(ok) {
        if (ok) successCount += 1;
        else failedCount += 1;
      });
      if (failedCount > 0) {
        notifyStatus('批量操作已完成：成功 ' + successCount + ' 个，失败 ' + failedCount + ' 个，可在节点上继续重试或回滚。', successCount > 0 ? 'warn' : 'err');
      } else {
        notifyStatus('批量操作已完成，可继续在节点上追加、重跑或回滚。', 'ok');
      }
      render({ reason: 'batch-complete', anchorNodeId: anchorNodeId });
      return failedCount === 0;
    }

    function handleNodeAction(actionId, nodeMeta) {
      if (!actionId) return false;
      var meta = nodeMeta && nodeMeta.meta ? nodeMeta.meta : {};
      if (meta.type === 'root') {
        runBatchAction(actionId, {
          anchorNodeId: nodeMeta && nodeMeta.nodeId ? String(nodeMeta.nodeId) : getRootNodeId(),
        });
        return true;
      }
      if (meta.type === 'module' || meta.type === 'status') {
        runModuleAction(meta.moduleId, actionId, {
          anchorNodeId: nodeMeta && nodeMeta.nodeId ? String(nodeMeta.nodeId) : getModuleNodeId(meta.moduleId),
        });
        return true;
      }
      return false;
    }

    async function exportCurrentXmind() {
      var requirementLabel = window.app && typeof window.app.ensureRequirementLabel === 'function'
        ? window.app.ensureRequirementLabel('请输入需求标识后再导出当前 XMind')
        : getRequirementLabelText();
      if (!requirementLabel) {
        notifyStatus('已取消导出（需求标识为空）', 'warn');
        return false;
      }
      var xmindCoreApi = getXmindCoreApi();
      if (!xmindCoreApi || typeof xmindCoreApi.buildXmindPackageFromMindData !== 'function') {
        notifyStatus('当前 XMind 导出能力未就绪', 'warn');
        return false;
      }
      var mindData = currentMindData || buildMindData();
      try {
        var exported = await xmindCoreApi.buildXmindPackageFromMindData(mindData, requirementLabel);
        if (core && typeof core.downloadBlob === 'function') {
          core.downloadBlob(exported.fileName, exported.blob);
        }
        notifyStatus('已导出当前 XMind：' + exported.fileName, 'ok');
        return true;
      } catch (err) {
        notifyStatus('XMind 导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
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
          if (summaryDialogOpen === true) {
            closeSummaryDialog();
            return;
          }
          openSummaryDialog();
        });
      }
      if (summaryCloseBtn) {
        summaryCloseBtn.addEventListener('click', function() {
          closeSummaryDialog();
        });
      }
      if (summaryOverlayEl) {
        summaryOverlayEl.addEventListener('click', function(event) {
          if (!event || event.target !== summaryOverlayEl) return;
          closeSummaryDialog();
        });
      }
      if (importRequirementBtn) {
        importRequirementBtn.addEventListener('click', function() {
          var input = document.getElementById('fileInput');
          if (input && typeof input.click === 'function') input.click();
        });
      }
      if (importCasesBtn) {
        importCasesBtn.addEventListener('click', function() {
          var input = document.getElementById('caseFileInput');
          if (input && typeof input.click === 'function') input.click();
        });
      }
      if (selectCasesBtn) {
        selectCasesBtn.addEventListener('click', function() {
          var caseLibraryApi = window.app && window.app.caseLibraryApi ? window.app.caseLibraryApi : null;
          if (caseLibraryApi && typeof caseLibraryApi.openImportSelectDrawer === 'function') {
            caseLibraryApi.openImportSelectDrawer();
            return;
          }
          var btn = document.getElementById('caseLibraryImportSelectBtn');
          if (btn && typeof btn.click === 'function') btn.click();
        });
      }
      if (generateModulesBtn) {
        generateModulesBtn.addEventListener('click', function() {
          runBatchAction('build-modules', {
            anchorNodeId: getRootNodeId(),
          });
        });
      }
      if (generateFullBtn) {
        generateFullBtn.addEventListener('click', function() {
          runBatchAction('generate-full', {
            anchorNodeId: getRootNodeId(),
          });
        });
      }
      if (exportBtn) {
        exportBtn.addEventListener('click', function() {
          exportCurrentXmind();
        });
      }
      if (promptBtn) {
        promptBtn.addEventListener('click', function() {
          if (casesGenApi && typeof casesGenApi.openCaseGenSettingsDrawer === 'function') {
            casesGenApi.openCaseGenSettingsDrawer();
            return;
          }
          if (casesGenApi && typeof casesGenApi.openCaseGenBatchActionDrawer === 'function') {
            casesGenApi.openCaseGenBatchActionDrawer('settings');
          }
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
      ['rawText', 'splitResult', 'caseText'].forEach(function(id) {
        var el = document.getElementById(id);
        if (!el || !el.addEventListener) return;
        el.addEventListener('input', debouncedRender);
        el.addEventListener('change', debouncedRender);
      });
      ['fileInput', 'caseFileInput'].forEach(function(id) {
        var fileEl = document.getElementById(id);
        if (!fileEl || !fileEl.addEventListener) return;
        fileEl.addEventListener('change', function() {
          setTimeout(function() {
            scheduleRender('file-change');
          }, 200);
        });
      });
      var caseFileList = document.getElementById('caseFileList');
      if (caseFileList && typeof MutationObserver !== 'undefined') {
        listObserver = new MutationObserver(function() {
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
