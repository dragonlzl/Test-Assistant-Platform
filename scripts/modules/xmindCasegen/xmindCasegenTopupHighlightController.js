(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenTopupHighlightController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var mindContainer = opts.mindContainer || null;
    var ensureState = port('ensureState', function() { return { modules: {} }; });
    var ensureModuleUiState = port('ensureModuleUiState', function() { return null; });
    var buildNodeId = port('buildNodeId', function(parts) { return (parts || []).join('-'); });
    var generateLocalId = port('generateLocalId', function(prefix) { return String(prefix || 'topup'); });
    var setDebugState = port('setDebugState');
    var getRenderPolicyCore = port('getRenderPolicyCore', function() { return null; });
    var isNodeFlowLeft = port('isNodeFlowLeft', function() { return false; });
    var getMindInstance = port('getMindInstance', function() { return null; });
    var scheduleTimeout = port('setTimeout', function(handler, delay) { return setTimeout(handler, delay); });
    var cancelTimeout = port('clearTimeout', function(timerId) { clearTimeout(timerId); });
    var now = port('now', function() { return Date.now(); });
    var windowObj = opts.windowObj || (typeof window !== 'undefined' ? window : null);
    var documentObj = opts.documentObj || (typeof document !== 'undefined' ? document : null);
    var MutationObserverCtor = opts.MutationObserver
      || (typeof MutationObserver !== 'undefined' ? MutationObserver : null);
    var ResizeObserverCtor = opts.ResizeObserver
      || (typeof ResizeObserver !== 'undefined' ? ResizeObserver : null);

    var syncTimer = 0;
    var retryTimer = 0;
    var retryCount = 0;
    var mutationObserver = null;
    var resizeObserver = null;
    var viewerElement = null;
    var mapElement = null;
    var canvasElement = null;
    var scrollHandler = null;
    var resizeHandler = null;

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
      var markerOptions = options || {};
      var highlightScope = markerOptions.highlightScope === 'module' || markerOptions.highlightScope === 'subtree'
        ? String(markerOptions.highlightScope || '')
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
        label: markerOptions.label
          ? String(markerOptions.label || '')
          : buildTopupHighlightLabel(safeCount, highlightScope),
        startIndex: Number.isFinite(safeStartIndex) && safeStartIndex >= 0 ? safeStartIndex : 0,
        count: Number.isFinite(safeCount) && safeCount >= 0 ? safeCount : 0,
        updatedAt: now(),
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
      var rootEl = viewerEl || viewerElement || mindContainer;
      var mindInstance = getMindInstance();
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
      if (!layerHostEl || !layerHostEl.querySelector || !layerHostEl.appendChild || !documentObj) return null;
      var layer = layerHostEl.querySelector('[data-xmind-casegen-topup-layer]');
      if (layer) return layer;
      layer = documentObj.createElement('div');
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
      if (!layerEl || !layerEl.querySelector || !layerEl.appendChild || !mapRect || !documentObj) return null;
      var svgEl = layerEl.querySelector('[data-xmind-casegen-topup-connectors]');
      if (!svgEl) {
        svgEl = documentObj.createElementNS('http://www.w3.org/2000/svg', 'svg');
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
      while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
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
      if (!nodeEl || !windowObj || !windowObj.getComputedStyle) return fallback;
      var boxEl = nodeEl.querySelector ? nodeEl.querySelector('.box') : null;
      var sourceEl = boxEl || nodeEl;
      if (!sourceEl) return fallback;
      var computed = windowObj.getComputedStyle(sourceEl);
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
        return { x: Number(numberMatches[0]), y: Number(numberMatches[1]) };
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
      var x = isStart ? (leftFlow ? rect.left : rect.right) : (leftFlow ? rect.right : rect.left);
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
        var pathData = String(pathEl.getAttribute('d') || '').trim();
        if (!pathData) return;
        var startPoint = parsePathEdgePoint(pathData, 'start');
        var endPoint = parsePathEdgePoint(pathData, 'end');
        if (!startPoint || !endPoint) return;
        var score = Math.abs(startPoint.x - expectedStart.x)
          + Math.abs(startPoint.y - expectedStart.y)
          + Math.abs(endPoint.x - expectedEnd.x)
          + Math.abs(endPoint.y - expectedEnd.y);
        if (score < bestScore) {
          bestScore = score;
          bestData = pathData;
          bestPathEl = pathEl;
        }
      });
      if (!bestData) return null;
      return { pathData: bestData, pathEl: bestPathEl };
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
        pathData: 'M ' + startX + ' ' + startY + ' C ' + controlStartX + ' ' + startY + ', '
          + controlEndX + ' ' + endY + ', ' + endX + ' ' + endY,
        pathEl: null,
      };
    }

    function resolveOverlayMaskColor(primaryEl, fallbackEl) {
      function readSolidBackground(element) {
        if (!element || !windowObj || !windowObj.getComputedStyle) return '';
        var computed = windowObj.getComputedStyle(element);
        if (!computed) return '';
        var background = String(computed.backgroundColor || '').trim();
        if (!background || background === 'transparent' || background === 'rgba(0, 0, 0, 0)') return '';
        return background;
      }
      var background = readSolidBackground(primaryEl) || readSolidBackground(fallbackEl);
      if (background) return background;
      var theme = documentObj && documentObj.documentElement
        ? String(documentObj.documentElement.getAttribute('data-theme') || '')
        : '';
      return theme === 'dark' ? '#0f172a' : '#f8fafc';
    }

    function appendOverlayConnector(svgEl, fromEl, toEl, mapEl, mapRect, scale, color, connectorType, maskColor) {
      if (!svgEl || !fromEl || !toEl || !documentObj) return false;
      var connectorPath = buildOverlayConnectorPath(fromEl, toEl, mapEl, mapRect, scale);
      if (!connectorPath || !connectorPath.pathData) return false;
      var pathData = connectorPath.pathData;
      if (connectorPath.pathEl && connectorPath.pathEl.setAttribute) {
        connectorPath.pathEl.setAttribute('data-xmind-casegen-overlay-source', String(connectorType || 'topup-overlay'));
        connectorPath.pathEl.setAttribute('stroke-opacity', '0');
        connectorPath.pathEl.setAttribute('opacity', '0');
      }
      var maskPathEl = documentObj.createElementNS('http://www.w3.org/2000/svg', 'path');
      maskPathEl.setAttribute('d', pathData);
      maskPathEl.setAttribute('fill', 'none');
      maskPathEl.setAttribute('stroke', maskColor || '#f8fafc');
      maskPathEl.setAttribute('stroke-width', '7');
      maskPathEl.setAttribute('stroke-linecap', 'round');
      maskPathEl.setAttribute('stroke-linejoin', 'round');
      maskPathEl.setAttribute('data-xmind-casegen-link-mask', String(connectorType || 'topup-overlay'));
      svgEl.appendChild(maskPathEl);
      var pathEl = documentObj.createElementNS('http://www.w3.org/2000/svg', 'path');
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
      var moduleNodes = mapEl.querySelectorAll(
        'me-tpc.xmind-casegen-node-module[data-xmind-topup-highlight-token][data-xmind-topup-highlight-scope]'
      );
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

    function getTopupHighlightViewerElement() {
      if (!mindContainer) return null;
      if (mindContainer.classList && mindContainer.classList.contains('xmind-structure-viewer')) return mindContainer;
      return mindContainer.querySelector ? mindContainer.querySelector('.xmind-structure-viewer') : null;
    }

    function cleanupTopupHighlightPresentation() {
      if (syncTimer) {
        cancelTimeout(syncTimer);
        syncTimer = 0;
      }
      if (retryTimer) {
        cancelTimeout(retryTimer);
        retryTimer = 0;
      }
      retryCount = 0;
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (mapElement || viewerElement) clearTopupHighlightLayer(mapElement || viewerElement);
      if (canvasElement && scrollHandler) canvasElement.removeEventListener('scroll', scrollHandler);
      if (windowObj && resizeHandler) windowObj.removeEventListener('resize', resizeHandler);
      viewerElement = null;
      mapElement = null;
      canvasElement = null;
      scrollHandler = null;
      resizeHandler = null;
    }

    function scheduleTopupHighlightSync() {
      if (syncTimer) cancelTimeout(syncTimer);
      syncTimer = scheduleTimeout(function() {
        syncTimer = 0;
        syncTopupHighlightPresentation();
      }, 40);
    }

    function scheduleTopupHighlightRetry(delayMs) {
      if (retryTimer) cancelTimeout(retryTimer);
      retryTimer = scheduleTimeout(function() {
        retryTimer = 0;
        syncTopupHighlightPresentation();
      }, Number(delayMs) || 120);
    }

    function getTopupMutationNodeClassName(node) {
      if (!node) return '';
      if (typeof node.className === 'string') return node.className;
      if (node.className && typeof node.className.baseVal === 'string') return node.className.baseVal;
      return '';
    }

    function isManagedTopupMutationNode(node) {
      var policyCore = getRenderPolicyCore();
      if (!node || Number(node.nodeType) !== 1) return false;
      if (node.matches && node.matches('[data-xmind-casegen-topup-layer]')) return true;
      if (node.closest && node.closest('[data-xmind-casegen-topup-layer]')) return true;
      if (!policyCore || typeof policyCore.isManagedDecorationClassName !== 'function') return false;
      return policyCore.isManagedDecorationClassName(getTopupMutationNodeClassName(node));
    }

    function isManagedTopupMutationOnly(mutation) {
      var nodes = [];
      Array.prototype.forEach.call(mutation && mutation.addedNodes ? mutation.addedNodes : [], function(node) {
        nodes.push(node);
      });
      Array.prototype.forEach.call(mutation && mutation.removedNodes ? mutation.removedNodes : [], function(node) {
        nodes.push(node);
      });
      var elementNodes = nodes.filter(function(node) {
        return Boolean(node && Number(node.nodeType) === 1);
      });
      return Boolean(elementNodes.length && elementNodes.every(isManagedTopupMutationNode));
    }

    function resolveTopupMutationTargetRole(target) {
      if (!target || Number(target.nodeType) !== 1) return 'tree';
      if (isManagedTopupMutationNode(target)) return 'overlay';
      if (target.matches && target.matches('me-tpc')) return 'topic';
      if (target.closest && target.closest('me-tpc')) return 'topic';
      if (target === mapElement) return 'map';
      if (target.classList && target.classList.contains('map-canvas')) return 'map';
      if (target.matches && target.matches('svg, path')) return 'connector';
      if (target.closest && target.closest('svg')) return 'connector';
      return 'tree';
    }

    function buildTopupHighlightMutationChanges(mutations) {
      return Array.prototype.map.call(mutations || [], function(mutation) {
        var target = mutation && mutation.target ? mutation.target : null;
        return {
          type: mutation && mutation.type ? String(mutation.type || '') : '',
          attributeName: mutation && mutation.attributeName ? String(mutation.attributeName || '') : '',
          targetRole: resolveTopupMutationTargetRole(target),
          insideManaged: isManagedTopupMutationNode(target),
          managedOnly: isManagedTopupMutationOnly(mutation),
        };
      });
    }

    function shouldScheduleTopupHighlightForMutations(mutations) {
      var policyCore = getRenderPolicyCore();
      if (!policyCore || typeof policyCore.shouldScheduleTopupHighlightSync !== 'function') return true;
      return policyCore.shouldScheduleTopupHighlightSync(buildTopupHighlightMutationChanges(mutations));
    }

    function handleTopupHighlightMutations(mutations) {
      if (!shouldScheduleTopupHighlightForMutations(mutations)) return;
      scheduleTopupHighlightSync();
    }

    function syncTopupHighlightPresentation() {
      var viewerEl = getTopupHighlightViewerElement();
      var mapEl = getTopupHighlightMapElement(viewerEl);
      if (!viewerEl || !mapEl) return;
      clearTopupHighlightLayer(mapEl);
      var highlightedNodes = mapEl.querySelectorAll('[data-xmind-topup-highlight-token]');
      var placeholderNodes = mapEl.querySelectorAll('me-tpc.xmind-casegen-node-topup-placeholder');
      var hasOverlayTargets = Boolean(
        (highlightedNodes && highlightedNodes.length) || (placeholderNodes && placeholderNodes.length)
      );
      if (!hasOverlayTargets) {
        retryCount = 0;
        setDebugState({ topupPhase: 'empty', topupNodeCount: 0 });
        return;
      }
      var viewerRect = viewerEl.getBoundingClientRect ? viewerEl.getBoundingClientRect() : null;
      var mapRect = mapEl.getBoundingClientRect ? mapEl.getBoundingClientRect() : null;
      if (!viewerRect || !mapRect) return;
      var layerEl = ensureTopupHighlightLayer(mapEl);
      if (!layerEl || !documentObj) return;
      var mindInstance = getMindInstance();
      var scale = Number(mindInstance && mindInstance.scaleVal);
      if (!Number.isFinite(scale) || scale <= 0) scale = 1;
      var grouped = {};
      Array.prototype.forEach.call(highlightedNodes, function(nodeEl) {
        var token = nodeEl && nodeEl.getAttribute
          ? String(nodeEl.getAttribute('data-xmind-topup-highlight-token') || '')
          : '';
        if (!token) return;
        if (!grouped[token]) grouped[token] = { label: '', nodes: [], hasVisibleNode: false };
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
        if (
          !Number.isFinite(minLeft)
          || !Number.isFinite(minTop)
          || !Number.isFinite(maxRight)
          || !Number.isFinite(maxBottom)
        ) return;
        var frameEl = documentObj.createElement('div');
        frameEl.className = 'xmind-casegen-topup-highlight-frame';
        frameEl.setAttribute('data-xmind-casegen-topup-frame', token);
        frameEl.style.left = ((minLeft - mapRect.left - 18) / scale) + 'px';
        frameEl.style.top = ((minTop - mapRect.top - 18) / scale) + 'px';
        frameEl.style.width = ((maxRight - minLeft + 36) / scale) + 'px';
        frameEl.style.height = ((maxBottom - minTop + 36) / scale) + 'px';
        var labelEl = documentObj.createElement('span');
        labelEl.className = 'xmind-casegen-topup-highlight-label';
        labelEl.textContent = group.label || '本轮追加用例';
        frameEl.appendChild(labelEl);
        layerEl.appendChild(frameEl);
        renderedFrameCount += 1;
      });
      renderOverlayConnectors(layerEl, mapEl, mapRect, scale);
      if (expectedFrameCount > renderedFrameCount && retryCount < 4) {
        retryCount += 1;
        scheduleTopupHighlightRetry(120 + (retryCount * 60));
      } else {
        retryCount = 0;
      }
      setDebugState({
        topupPhase: 'rendered',
        topupNodeCount: highlightedNodes.length,
        topupFrameCount: layerEl.querySelectorAll
          ? layerEl.querySelectorAll('[data-xmind-casegen-topup-frame]').length
          : 0,
        topupExpectedFrameCount: expectedFrameCount,
        topupRetryCount: retryCount,
      });
    }

    function bindTopupHighlightPresentation() {
      cleanupTopupHighlightPresentation();
      var viewerEl = getTopupHighlightViewerElement();
      if (!viewerEl) return;
      viewerElement = viewerEl;
      mapElement = getTopupHighlightMapElement(viewerEl);
      canvasElement = viewerEl.querySelector ? viewerEl.querySelector('[data-mind-canvas]') : null;
      scrollHandler = scheduleTopupHighlightSync;
      resizeHandler = scheduleTopupHighlightSync;
      if (canvasElement) canvasElement.addEventListener('scroll', scrollHandler, { passive: true });
      if (windowObj) windowObj.addEventListener('resize', resizeHandler, { passive: true });
      if (MutationObserverCtor) {
        mutationObserver = new MutationObserverCtor(handleTopupHighlightMutations);
        mutationObserver.observe(viewerEl, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: [
            'class',
            'data-xmind-topup-highlight-token',
            'data-xmind-topup-highlight-label',
            'data-xmind-topup-highlight-scope',
          ],
        });
      }
      if (ResizeObserverCtor) {
        resizeObserver = new ResizeObserverCtor(scheduleTopupHighlightSync);
        resizeObserver.observe(viewerEl);
      }
      syncTopupHighlightPresentation();
      scheduleTopupHighlightSync();
    }

    return {
      bindTopupHighlightPresentation: bindTopupHighlightPresentation,
      buildTopupHighlightLabel: buildTopupHighlightLabel,
      cleanupTopupHighlightPresentation: cleanupTopupHighlightPresentation,
      clearAllTopupHighlights: clearAllTopupHighlights,
      clearDashedConnectorPathMarks: clearDashedConnectorPathMarks,
      clearModuleTopupHighlight: clearModuleTopupHighlight,
      clearTopupHighlightLayer: clearTopupHighlightLayer,
      cloneTopupHighlight: cloneTopupHighlight,
      getCaseTopupHighlight: getCaseTopupHighlight,
      getModuleNodeTopupHighlight: getModuleNodeTopupHighlight,
      getModuleTopupHighlight: getModuleTopupHighlight,
      getTopupHighlightMapElement: getTopupHighlightMapElement,
      getTopupHighlightViewerElement: getTopupHighlightViewerElement,
      parsePathEdgePoint: parsePathEdgePoint,
      renderOverlayConnectors: renderOverlayConnectors,
      scheduleTopupHighlightSync: scheduleTopupHighlightSync,
      setModuleTopupHighlight: setModuleTopupHighlight,
      shouldScheduleTopupHighlightForMutations: shouldScheduleTopupHighlightForMutations,
      syncTopupHighlightPresentation: syncTopupHighlightPresentation,
    };
  }

  return { create: create };
});
