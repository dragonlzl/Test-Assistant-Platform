(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenMindRendererController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var mindContainer = opts.mindContainer || null;
    var toolbarEl = opts.toolbarEl || null;
    var documentRef = opts.document || (typeof document !== 'undefined' ? document : null);
    var escapeHtml = port('escapeHtml', function(value) { return String(value || ''); });
    var normalizeModuleKey = port('normalizeModuleKey', function(value) { return String(value || '').trim().toLowerCase(); });
    var isDeleteNodeType = port('isDeleteNodeType', function() { return false; });
    var buildDeleteTargetKey = port('buildDeleteTargetKey', function() { return ''; });
    var isInvalidStoreModuleMeta = port('isInvalidStoreModuleMeta', function() { return false; });
    var isInvalidStoreCaseMeta = port('isInvalidStoreCaseMeta', function() { return false; });
    var getTopupHighlightMapElement = port('getTopupHighlightMapElement', function() { return null; });
    var getTopupHighlightViewerElement = port('getTopupHighlightViewerElement', function() { return null; });
    var setTimer = port('setTimer', function(handler, delay) { return setTimeout(handler, delay); });
    var cleanupTopupHighlightPresentation = port('cleanupTopupHighlightPresentation');
    var restoreInlineControlsToBank = port('restoreInlineControlsToBank');
    var getWorkspaceShadowDepth = port('getWorkspaceShadowDepth', function() { return 0; });
    var persistXmindState = port('persistXmindState');
    var setDebugState = port('setDebugState');
    var updateSummary = port('updateSummary');
    var isDrawerOpen = port('isDrawerOpen', function() { return false; });
    var shouldRestoreDrawerAfterRefresh = port('shouldRestoreDrawerAfterRefresh', function() { return false; });
    var hasDrawerRestoreRetryTimer = port('hasDrawerRestoreRetryTimer', function() { return false; });
    var scheduleDrawerRestoreRetry = port('scheduleDrawerRestoreRetry');
    var getViewState = port('getViewState', function() { return {}; });
    var hasActiveWorkspace = port('hasActiveWorkspace', function() { return false; });
    var invalidateWorkspaceViewRestore = port('invalidateWorkspaceViewRestore');
    var destroyMind = port('destroyMind');
    var captureMindSearchStateForRender = port('captureMindSearchStateForRender', function() { return null; });
    var normalizeWorkspaceRenderViewState = port('normalizeWorkspaceRenderViewState', function(value) { return value || null; });
    var getRestorableViewState = port('getRestorableViewState', function() { return null; });
    var ensureState = port('ensureState', function() { return {}; });
    var getRestorableDrawerState = port('getRestorableDrawerState', function() { return null; });
    var getRestoreDrawerOpenInFlight = port('getRestoreDrawerOpenInFlight', function() { return false; });
    var setRestoreDrawerOpenInFlight = port('setRestoreDrawerOpenInFlight');
    var getMindInstance = port('getMindInstance', function() { return null; });
    var setMindInstance = port('setMindInstance');
    var setCurrentMindData = port('setCurrentMindData');
    var buildMindData = port('buildMindData', function() { return { nodeData: null }; });
    var getMindElixirCoreApi = port('getMindElixirCoreApi', function() { return null; });
    var isMindElixirReady = port('isMindElixirReady', function() { return false; });
    var ensureMindElixirCoreApiReady = port('ensureMindElixirCoreApiReady', function() { return Promise.resolve(null); });
    var getRootNodeId = port('getRootNodeId', function() { return ''; });
    var exportCurrentXmind = port('exportCurrentXmind');
    var getNodeActions = port('getNodeActions', function() { return []; });
    var handleNodeAction = port('handleNodeAction');
    var handleDeleteSelection = port('handleDeleteSelection');
    var scheduleTopupHighlightSync = port('scheduleTopupHighlightSync');
    var markManualViewportInteraction = port('markManualViewportInteraction');
    var persistViewportActionViewState = port('persistViewportActionViewState');
    var scheduleLightweightViewportCapture = port('scheduleLightweightViewportCapture');
    var scheduleCaptureCurrentViewState = port('scheduleCaptureCurrentViewState');
    var mountInlineControls = port('mountInlineControls');
    var syncDeleteHistoryButtons = port('syncDeleteHistoryButtons');
    var bindTopupHighlightPresentation = port('bindTopupHighlightPresentation');
    var bindLiveViewStateCapture = port('bindLiveViewStateCapture');
    var syncTopupHighlightPresentation = port('syncTopupHighlightPresentation');
    var centerRootNodeView = port('centerRootNodeView');
    var scheduleWorkspaceViewRestore = port('scheduleWorkspaceViewRestore');
    var getActiveWorkspaceId = port('getActiveWorkspaceId', function() { return ''; });
    var restoreMindSearchStateAfterRender = port('restoreMindSearchStateAfterRender');
    var mindApiReadyPromise = null;

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
      setTimer(function() {
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
        'xmind-casegen-node-status-running',
        'xmind-casegen-node-status-error',
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
          if (meta.hasPendingBranch) nodeEl.classList.add('xmind-casegen-node-has-pending-branch');
        }
        if (meta.status) {
          nodeEl.classList.add('xmind-casegen-node-has-status');
          nodeEl.classList.add(meta.status === 'running' ? 'xmind-casegen-node-status-running' : 'xmind-casegen-node-status-error');
          var badge = documentRef.createElement('span');
          badge.className = 'xmind-node-status-badge ' + (meta.status === 'running' ? 'is-running' : 'is-error');
          if (meta.status === 'running') {
            var spinner = documentRef.createElement('span');
            spinner.className = 'xmind-node-status-spinner';
            badge.appendChild(spinner);
          }
          var textSpan = documentRef.createElement('span');
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
        var spinnerEl = documentRef.createElement('span');
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

    function render(optionsValue) {
      var renderOptions = optionsValue || {};
      if (getWorkspaceShadowDepth() > 0) {
        if (renderOptions.persist !== false) persistXmindState(false);
        return;
      }
      setDebugState({ phase: 'render-enter', reason: String(renderOptions.reason || '') });
      try {
        updateSummary();
      } catch (summaryErr) {
        setDebugState({
          phase: 'render-summary-error',
          error: summaryErr && summaryErr.message ? String(summaryErr.message) : '未知错误'
        });
        if (renderOptions.persist !== false) persistXmindState(false);
        return;
      }
      var pendingDrawerRestore = !isDrawerOpen() && shouldRestoreDrawerAfterRefresh();
      if (!mindContainer || !isDrawerOpen()) {
        setDebugState({
          phase: pendingDrawerRestore ? 'render-pending-restore' : 'render-skipped',
          reason: String(renderOptions.reason || ''),
          hasContainer: Boolean(mindContainer),
          drawerOpen: isDrawerOpen()
        });
        if (pendingDrawerRestore && !hasDrawerRestoreRetryTimer()) {
          scheduleDrawerRestoreRetry(getViewState().fullscreen === true ? 320 : 120);
        }
        if (renderOptions.persist !== false) persistXmindState(false);
        return;
      }
      if (!hasActiveWorkspace()) {
        setDebugState({ phase: 'render-empty-workspace' });
        invalidateWorkspaceViewRestore();
        destroyMind();
        renderEmptyWorkspaceState();
        if (renderOptions.persist !== false) persistXmindState(false);
        return;
      }
      var searchState = captureMindSearchStateForRender();
      var skipRestorableViewState = renderOptions.skipRestorableViewState === true
        && renderOptions.centerRootAfterRender === true;
      var restorableViewState = skipRestorableViewState
        ? null
        : (normalizeWorkspaceRenderViewState(renderOptions.restoreViewState)
          || getRestorableViewState(ensureState().treeSourceSignature));
      var restorableDrawerState = getRestorableDrawerState(ensureState().treeSourceSignature);
      var deferInitialRestoreState = getRestoreDrawerOpenInFlight() === true;
      var currentInstance = getMindInstance();
      var shouldPreserveRenderedViewState = Boolean(currentInstance)
        && !(renderOptions.centerRootAfterRender === true && skipRestorableViewState === true);
      var freshRender = !currentInstance;
      var useStableFreshRootCenter = renderOptions.centerRootAfterRender === true
        && !restorableViewState
        && !shouldPreserveRenderedViewState;
      invalidateWorkspaceViewRestore();
      setDebugState({ phase: 'render-start', reason: String(renderOptions.reason || '') });
      var currentMindData = null;
      try {
        currentMindData = buildMindData();
        setCurrentMindData(currentMindData);
      } catch (buildErr) {
        setDebugState({ phase: 'build-error', error: buildErr && buildErr.message ? String(buildErr.message) : '未知错误' });
        cleanupTopupHighlightPresentation();
        mindContainer.innerHTML = '<p class="hint" style="padding:16px;">XMind 数据构建失败：' + escapeHtml(buildErr && buildErr.message ? buildErr.message : '未知错误') + '</p>';
        if (renderOptions.persist !== false) persistXmindState(false);
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
              if (!isMindElixirReady(readyApi)) throw new Error('MindElixir 依赖未就绪');
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
        var initialCenterNodeId = renderOptions.centerRootAfterRender === true && skipRestorableViewState
          ? getRootNodeId()
          : '';
        restoreInlineControlsToBank();
        var nextInstance = mindElixirCoreApi.renderMindMap(mindContainer, currentMindData, {
          instance: currentInstance,
          allowEdit: false,
          enableCustomBoxSelection: true,
          preserveViewState: shouldPreserveRenderedViewState,
          initialViewState: (currentInstance || deferInitialRestoreState) ? null : restorableViewState,
          initialDrawerState: (currentInstance || deferInitialRestoreState) ? null : restorableDrawerState,
          preserveAnchorNodeId: renderOptions.anchorNodeId || '',
          initialCenterNodeId: initialCenterNodeId,
          eagerInitialCenter: Boolean(initialCenterNodeId && freshRender),
          disableDeferredInitialCenterRetry: Boolean(initialCenterNodeId),
          onExportXmind: exportCurrentXmind,
          getNodeActions: getNodeActions,
          onNodeAction: handleNodeAction,
          onDeleteSelection: handleDeleteSelection,
          decorateNodeElement: decorateNodeElement,
          onViewStateChange: function(detail) {
            var reason = detail && detail.reason ? String(detail.reason || '') : '';
            scheduleTopupHighlightSync();
            if (
              reason === 'zoom-in'
              || reason === 'zoom-out'
              || reason === 'zoom-fit'
              || reason === 'drawer-fullscreen'
            ) {
              markManualViewportInteraction();
              persistViewportActionViewState();
              return;
            }
            if (reason === 'zoom-wheel' || reason === 'pan-wheel' || reason === 'pan-drag') {
              markManualViewportInteraction();
              scheduleLightweightViewportCapture();
              return;
            }
            scheduleCaptureCurrentViewState(false);
          },
        });
        setMindInstance(nextInstance);
        mountInlineControls();
        if (getRestoreDrawerOpenInFlight() === true) setRestoreDrawerOpenInFlight(false);
        syncDeleteHistoryButtons();
        bindTopupHighlightPresentation();
        bindLiveViewStateCapture();
        setDebugState({ phase: 'render-success' });
        setTimer(function() { syncTopupHighlightPresentation(); }, 90);
        if (renderOptions.centerRootAfterRender === true) {
          if (useStableFreshRootCenter) {
            centerRootNodeView({ persist: true, retryLimit: 7, retryDelayMs: 70 });
          } else {
            centerRootNodeView({ persist: true });
          }
        }
        if (
          renderOptions.centerRootAfterRender !== true
          && restorableViewState
          && renderOptions.restoreViewStateAfterRender !== false
        ) {
          scheduleWorkspaceViewRestore(restorableViewState, getActiveWorkspaceId());
        }
        restoreMindSearchStateAfterRender(searchState);
      } catch (err) {
        setDebugState({ phase: 'render-error', error: err && err.message ? String(err.message) : '未知错误' });
        cleanupTopupHighlightPresentation();
        mindContainer.innerHTML = '<p class="hint" style="padding:16px;">XMind 画布初始化失败：' + escapeHtml(err && err.message ? err.message : '未知错误') + '</p>';
      }
      if (renderOptions.persist !== false) persistXmindState(false);
    }

    return {
      findConnectorSvgPaths: findConnectorSvgPaths,
      findSiblingWrapperIndex: findSiblingWrapperIndex,
      isNodeFlowLeft: isNodeFlowLeft,
      markDashedConnectorLink: markDashedConnectorLink,
      decorateNodeElement: decorateNodeElement,
      renderEmptyWorkspaceState: renderEmptyWorkspaceState,
      render: render,
    };
  }

  return { create: create };
});
