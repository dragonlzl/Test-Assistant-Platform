(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenStatusProjectionController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var openBtn = opts.openBtn || null;
    var historyBtn = opts.historyBtn || null;
    var mindContainer = opts.mindContainer || null;
    var documentObj = opts.document || (typeof document !== 'undefined' ? document : null);
    var dedupeActionId = String(opts.dedupeActionId || 'xmind-ai-dedupe');
    var existingCasesActionId = String(opts.existingCasesActionId || 'root-existing-cases');
    var ensureState = port('ensureState', function() { return {}; });
    var persistXmindState = port('persistXmindState');
    var isDrawerOpen = port('isDrawerOpen', function() { return false; });
    var isHistoryDialogOpen = port('isHistoryDialogOpen', function() { return false; });
    var renderCaseGenProgressBoard = port('renderCaseGenProgressBoard');
    var getCasesGenApi = port('getCasesGenApi', function() { return null; });
    var getMindInstance = port('getMindInstance', function() { return null; });
    var getRootNodeId = port('getRootNodeId', function() { return ''; });
    var getRequirementLabelText = port('getRequirementLabelText', function() { return ''; });
    var ensureRootUiState = port('ensureRootUiState', function() { return {}; });
    var isRootGenerationVisuallyRunning = port('isRootGenerationVisuallyRunning', function(rootState) {
      return Boolean(rootState && rootState.running);
    });
    var buildVisibleModuleContext = port('buildVisibleModuleContext', function() { return { list: [] }; });
    var ensureVisibleModuleContext = port('ensureVisibleModuleContext', function(context) {
      return context && typeof context === 'object' ? context : { list: [] };
    });
    var ensureModuleUiState = port('ensureModuleUiState', function() { return null; });
    var getModuleNodeId = port('getModuleNodeId', function() { return ''; });
    var syncInterruptButton = port('syncInterruptButton');
    var renderWorkspaceTabs = port('renderWorkspaceTabs');
    var syncInlineToolbarOverview = port('syncInlineToolbarOverview');
    var scheduleTimeout = port('setTimeout', function(handler, delay) { return setTimeout(handler, delay); });

    function hasOpenButtonCompletionNotice() {
      return ensureState().openButtonDotVisible === true;
    }

    function hasHistoryUnreadNotice() {
      return ensureState().historyUnread === true;
    }

    function syncCasegenProgressSidebar() {
      try {
        var casesGenApi = getCasesGenApi();
        if (casesGenApi && typeof casesGenApi.renderCaseGenProgressBoard === 'function') {
          casesGenApi.renderCaseGenProgressBoard();
          return;
        }
        renderCaseGenProgressBoard();
      } catch (err) {
        // ignore progress projection failures
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

    function syncHistoryButtonState() {
      if (!historyBtn || !historyBtn.classList) return;
      var unread = hasHistoryUnreadNotice();
      historyBtn.classList.toggle('has-notice-dot', unread);
      if (historyBtn.setAttribute) {
        historyBtn.setAttribute('aria-label', unread ? '生成记录（有新的生成记录）' : '生成记录');
      }
    }

    function clearOpenButtonCompletionNotice(optionsValue) {
      var noticeOptions = optionsValue || {};
      var xmindState = ensureState();
      var changed = xmindState.openButtonDotVisible === true;
      xmindState.openButtonDotVisible = false;
      syncOpenButtonState();
      if (changed && noticeOptions.persist !== false) persistXmindState(true);
      return changed;
    }

    function markOpenButtonCompletionNotice(optionsValue) {
      var noticeOptions = optionsValue || {};
      if (isDrawerOpen()) {
        syncOpenButtonState();
        return false;
      }
      var xmindState = ensureState();
      var changed = xmindState.openButtonDotVisible !== true;
      xmindState.openButtonDotVisible = true;
      syncOpenButtonState();
      if (changed && noticeOptions.persist !== false) persistXmindState(true);
      return changed;
    }

    function clearHistoryUnreadNotice(optionsValue) {
      var noticeOptions = optionsValue || {};
      var xmindState = ensureState();
      var changed = xmindState.historyUnread === true;
      xmindState.historyUnread = false;
      syncHistoryButtonState();
      if (changed && noticeOptions.persist !== false) persistXmindState(true);
      return changed;
    }

    function markHistoryUnreadNotice(optionsValue) {
      var noticeOptions = optionsValue || {};
      if (isHistoryDialogOpen()) {
        syncHistoryButtonState();
        return false;
      }
      var xmindState = ensureState();
      var changed = xmindState.historyUnread !== true;
      xmindState.historyUnread = true;
      syncHistoryButtonState();
      if (changed && noticeOptions.persist !== false) persistXmindState(true);
      return changed;
    }

    function getRenderedMindNodeStableId(nodeEl) {
      if (!nodeEl) return '';
      if (nodeEl.getAttribute) {
        var attrNodeId = String(nodeEl.getAttribute('data-xmind-node-id') || '');
        if (attrNodeId) return attrNodeId;
      }
      var nodeObj = nodeEl.nodeObj || null;
      var meta = nodeObj && nodeObj.xmindMeta && typeof nodeObj.xmindMeta === 'object'
        ? nodeObj.xmindMeta
        : null;
      if (meta && meta.nodeId) return String(meta.nodeId || '');
      if (nodeObj && nodeObj.id !== undefined && nodeObj.id !== null) return String(nodeObj.id || '');
      return '';
    }

    function findRenderedRootMindNodeFallback() {
      if (!mindContainer || !mindContainer.querySelector) return null;
      var rootByClass = mindContainer.querySelector('me-tpc.xmind-casegen-node-root');
      if (rootByClass) return rootByClass;
      var rootDirect = mindContainer.querySelector('me-root > me-tpc');
      if (rootDirect) return rootDirect;
      if (!mindContainer.querySelectorAll) return null;
      var nodes = mindContainer.querySelectorAll('me-tpc');
      var rootLabel = String(getRequirementLabelText() || '').trim();
      for (var i = 0; i < nodes.length; i += 1) {
        var nodeEl = nodes[i];
        var nodeObj = nodeEl && nodeEl.nodeObj ? nodeEl.nodeObj : null;
        var meta = nodeObj && nodeObj.xmindMeta && typeof nodeObj.xmindMeta === 'object'
          ? nodeObj.xmindMeta
          : null;
        if (meta && meta.type === 'root') return nodeEl;
        var topic = nodeObj && nodeObj.topic !== undefined && nodeObj.topic !== null
          ? String(nodeObj.topic || '').trim()
          : '';
        if (rootLabel && topic && topic === rootLabel) return nodeEl;
      }
      return null;
    }

    function buildRenderedMindNodeMap() {
      var map = {};
      if (!mindContainer || !mindContainer.querySelectorAll) return map;
      var nodes = mindContainer.querySelectorAll('me-tpc');
      for (var i = 0; i < nodes.length; i += 1) {
        var nodeEl = nodes[i];
        var stableId = getRenderedMindNodeStableId(nodeEl);
        if (stableId && !map[stableId]) map[stableId] = nodeEl;
      }
      return map;
    }

    function findRenderedMindNodeByStableId(nodeId, nodeMap) {
      var stableId = String(nodeId || '');
      if (!stableId) return null;
      if (nodeMap && Object.prototype.hasOwnProperty.call(nodeMap, stableId)) return nodeMap[stableId] || null;
      if (!mindContainer || !mindContainer.querySelectorAll) return null;
      var rootId = '';
      try {
        rootId = getRootNodeId();
      } catch (rootErr) {
        rootId = '';
      }
      if (rootId && stableId === rootId) {
        var rootFallback = findRenderedRootMindNodeFallback();
        if (rootFallback) return rootFallback;
      }
      var nodes = mindContainer.querySelectorAll('me-tpc');
      for (var i = 0; i < nodes.length; i += 1) {
        var nodeEl = nodes[i];
        if (getRenderedMindNodeStableId(nodeEl) === stableId) return nodeEl;
      }
      return null;
    }

    function syncRenderedMindNodeObjectStatus(nodeEl, nodeId, status, statusLabel, statusText) {
      if (!nodeEl || !nodeEl.nodeObj || typeof nodeEl.nodeObj !== 'object') return false;
      if (!nodeEl.nodeObj.xmindMeta || typeof nodeEl.nodeObj.xmindMeta !== 'object') nodeEl.nodeObj.xmindMeta = {};
      var meta = nodeEl.nodeObj.xmindMeta;
      if (nodeId) meta.nodeId = String(nodeId || '');
      if (!meta.type && nodeId && String(nodeId || '') === getRootNodeId()) meta.type = 'root';
      meta.status = status ? String(status || '') : '';
      meta.statusLabel = statusLabel ? String(statusLabel || '') : '';
      meta.statusText = statusText ? String(statusText || '') : '';
      return true;
    }

    function syncRenderedMindNodeStatus(nodeId, status, statusLabel, statusText, nodeMap) {
      var nodeEl = findRenderedMindNodeByStableId(nodeId, nodeMap);
      if (!nodeEl || !nodeEl.classList) return false;
      var stableId = String(nodeId || '');
      var rootId = '';
      try {
        rootId = getRootNodeId();
      } catch (rootErr) {
        rootId = '';
      }
      if (rootId && stableId === rootId) {
        nodeEl.classList.add('xmind-casegen-node-root');
        if (nodeEl.setAttribute) nodeEl.setAttribute('data-xmind-node-id', stableId);
      }
      syncRenderedMindNodeObjectStatus(nodeEl, stableId, status, statusLabel, statusText);
      var existing = nodeEl.querySelector ? nodeEl.querySelector('.xmind-node-status-badge') : null;
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      nodeEl.classList.remove(
        'xmind-casegen-node-has-status',
        'xmind-casegen-node-status-running',
        'xmind-casegen-node-status-error'
      );
      if (!status) return true;

      nodeEl.classList.add('xmind-casegen-node-has-status');
      nodeEl.classList.add(status === 'running' ? 'xmind-casegen-node-status-running' : 'xmind-casegen-node-status-error');
      if (!documentObj || !documentObj.createElement) return true;
      var badge = documentObj.createElement('span');
      badge.className = 'xmind-node-status-badge ' + (status === 'running' ? 'is-running' : 'is-error');
      if (status === 'running') {
        var spinner = documentObj.createElement('span');
        spinner.className = 'xmind-node-status-spinner';
        badge.appendChild(spinner);
      }
      var textSpan = documentObj.createElement('span');
      textSpan.textContent = statusLabel
        ? String(statusLabel || '')
        : (status === 'running' ? '生成中' : '失败');
      if (status !== 'running' && statusText) badge.title = String(statusText || '');
      badge.appendChild(textSpan);
      nodeEl.appendChild(badge);
      return true;
    }

    function syncRenderedRootMindStatusBadge(nodeMap) {
      if (!mindContainer || !getMindInstance() || !isDrawerOpen()) return;
      var renderedNodeMap = nodeMap || buildRenderedMindNodeMap();
      var rootState = ensureRootUiState();
      var rootRunning = isRootGenerationVisuallyRunning(rootState);
      return syncRenderedMindNodeStatus(
        getRootNodeId(),
        rootRunning ? 'running' : (rootState.status === 'error' ? 'error' : ''),
        rootRunning && rootState.lastAction === dedupeActionId ? '去重中' : '',
        rootState.error || '',
        renderedNodeMap
      );
    }

    function scheduleRenderedRootMindStatusBadgeRefresh() {
      [0, 80, 220].forEach(function(delayMs) {
        scheduleTimeout(function() {
          try {
            syncRenderedRootMindStatusBadge();
          } catch (err) {
            // ignore status-only rendering failures
          }
        }, delayMs);
      });
    }

    function syncRenderedMindStatusBadges() {
      if (!mindContainer || !getMindInstance() || !isDrawerOpen()) return;
      var nodeMap = buildRenderedMindNodeMap();
      syncRenderedRootMindStatusBadge(nodeMap);
      var context = ensureVisibleModuleContext(buildVisibleModuleContext());
      (Array.isArray(context.list) ? context.list : []).forEach(function(entry) {
        if (!entry || !entry.aiModuleId) return;
        var moduleState = ensureModuleUiState(entry.aiModuleId);
        syncRenderedMindNodeStatus(
          getModuleNodeId(entry),
          moduleState && moduleState.running && moduleState.rootPendingActionId !== existingCasesActionId
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

    return {
      buildRenderedMindNodeMap: buildRenderedMindNodeMap,
      clearHistoryUnreadNotice: clearHistoryUnreadNotice,
      clearOpenButtonCompletionNotice: clearOpenButtonCompletionNotice,
      findRenderedMindNodeByStableId: findRenderedMindNodeByStableId,
      findRenderedRootMindNodeFallback: findRenderedRootMindNodeFallback,
      flushLightweightMindStatus: flushLightweightMindStatus,
      getRenderedMindNodeStableId: getRenderedMindNodeStableId,
      hasHistoryUnreadNotice: hasHistoryUnreadNotice,
      hasOpenButtonCompletionNotice: hasOpenButtonCompletionNotice,
      markHistoryUnreadNotice: markHistoryUnreadNotice,
      markOpenButtonCompletionNotice: markOpenButtonCompletionNotice,
      scheduleRenderedRootMindStatusBadgeRefresh: scheduleRenderedRootMindStatusBadgeRefresh,
      syncCasegenProgressSidebar: syncCasegenProgressSidebar,
      syncHistoryButtonState: syncHistoryButtonState,
      syncOpenButtonState: syncOpenButtonState,
      syncRenderedMindNodeObjectStatus: syncRenderedMindNodeObjectStatus,
      syncRenderedMindNodeStatus: syncRenderedMindNodeStatus,
      syncRenderedMindStatusBadges: syncRenderedMindStatusBadges,
      syncRenderedRootMindStatusBadge: syncRenderedRootMindStatusBadge,
    };
  }

  return { create: create };
});
