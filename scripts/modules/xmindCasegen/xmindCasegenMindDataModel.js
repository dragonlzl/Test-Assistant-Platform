(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenMindDataModel = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var ROOT_ACTIONS = opts.rootActions || {};
    var MODULE_ACTIONS = opts.moduleActions || {};
    var DEDUPE_ACTION_ID = String(opts.dedupeActionId || 'xmind-ai-dedupe');
    var ensureVisibleModuleContext = port('ensureVisibleModuleContext', function(value) {
      return value && typeof value === 'object' ? value : { list: [], map: {} };
    });
    var buildVisibleModuleContext = port('buildVisibleModuleContext', function() { return { list: [], map: {} }; });
    var getRequirementLabelText = port('getRequirementLabelText', function() { return '需求'; });
    var getPrepState = port('getPrepState', function() { return {}; });
    var hasImportedBaselineCases = port('hasImportedBaselineCases', function() { return false; });
    var getCombinedCaseText = port('getCombinedCaseText', function() { return ''; });
    var buildVisibleModuleSnapshot = port('buildVisibleModuleSnapshot', function() { return []; });
    var ensureState = port('ensureState', function() { return { modules: {} }; });
    var ensureRootUiState = port('ensureRootUiState', function() { return {}; });
    var ensureModuleUiState = port('ensureModuleUiState', function() { return null; });
    var cloneTopupHighlight = port('cloneTopupHighlight', function(value) { return value || null; });
    var cloneJson = port('cloneJson', function(value, fallback) {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (error) {
        return fallback;
      }
    });
    var isRootGenerationVisuallyRunning = port('isRootGenerationVisuallyRunning', function(value) {
      return Boolean(value && value.running === true);
    });
    var getStoreValidationSignature = port('getStoreValidationSignature', function() { return ''; });
    var normalizeModuleKey = port('normalizeModuleKey', function(value) { return String(value || '').trim().toLowerCase(); });
    var normalizeModuleTitle = port('normalizeModuleTitle', function(value) { return String(value || '').trim(); });
    var buildViewStateNodeKey = port('buildViewStateNodeKey', function(meta, topic) {
      return meta && meta.nodeId ? String(meta.nodeId) : String(topic || '');
    });
    var getXmindCoreApi = port('getXmindCoreApi', function() { return null; });
    var buildCaseSignature = port('buildCaseSignature', function(item, moduleTitle) {
      return String(moduleTitle || '') + '::' + String(item && item.title || '');
    });
    var clearStaleModuleUiState = port('clearStaleModuleUiState');
    var getCollapsedNodeKeyMap = port('getCollapsedNodeKeyMap', function() { return {}; });
    var getVisibleCasesForModuleEntry = port('getVisibleCasesForModuleEntry', function() { return []; });
    var getCaseTopupHighlight = port('getCaseTopupHighlight', function() { return null; });
    var getModuleNodeTopupHighlight = port('getModuleNodeTopupHighlight', function() { return null; });
    var now = port('now', function() { return Date.now(); });
    var buildCache = {
      signature: '',
      treeSignature: '',
      data: null,
    };

    function buildTreeSignature(visibleContext) {
      try {
        var context = visibleContext
          ? ensureVisibleModuleContext(visibleContext)
          : buildVisibleModuleContext();
        return JSON.stringify({
          requirementLabel: getRequirementLabelText(),
          prep: getPrepState(),
          baseline: hasImportedBaselineCases() ? getCombinedCaseText() : '',
          modules: buildVisibleModuleSnapshot(context),
        });
      } catch (err) {
        return String(now());
      }
    }

    function getSortedTruthyKeys(map) {
      return Object.keys(map || {}).filter(function(key) {
        return map[key] === true;
      }).sort();
    }

    function buildMindDataVisualSignature(treeSignature, collapsedNodeMap, visibleContext, rootState) {
      var modulesState = ensureState().modules || {};
      var moduleVisuals = (visibleContext && Array.isArray(visibleContext.list) ? visibleContext.list : []).map(function(entry) {
        var moduleId = entry && entry.aiModuleId ? String(entry.aiModuleId || '') : '';
        var moduleState = moduleId && modulesState[moduleId] ? modulesState[moduleId] : null;
        var marker = moduleState && moduleState.topupHighlight
          ? cloneTopupHighlight(moduleState.topupHighlight)
          : null;
        return {
          moduleKey: entry && entry.moduleKey ? String(entry.moduleKey || '') : '',
          moduleId: moduleId,
          running: moduleState && moduleState.running === true,
          lastAction: moduleState ? String(moduleState.lastAction || '') : '',
          rootPendingActionId: moduleState ? String(moduleState.rootPendingActionId || '') : '',
          status: moduleState ? String(moduleState.status || '') : '',
          error: moduleState ? String(moduleState.error || '') : '',
          hideResults: moduleState && moduleState.hideResults === true,
          topupHighlight: marker ? {
            token: String(marker.token || ''),
            label: String(marker.label || ''),
            startIndex: Number(marker.startIndex || 0),
            count: Number(marker.count || 0),
            highlightScope: String(marker.highlightScope || ''),
          } : null,
        };
      });
      return JSON.stringify({
        tree: String(treeSignature || ''),
        collapsed: getSortedTruthyKeys(collapsedNodeMap),
        root: {
          running: isRootGenerationVisuallyRunning(rootState),
          lastAction: rootState ? String(rootState.lastAction || '') : '',
          status: rootState ? String(rootState.status || '') : '',
          error: rootState ? String(rootState.error || '') : '',
          hideAiLayer: rootState && rootState.hideAiLayer === true,
        },
        modules: moduleVisuals,
        validation: getStoreValidationSignature(),
      });
    }

    function rememberMindDataBuildCache(signature, treeSignature, data) {
      buildCache = {
        signature: String(signature || ''),
        treeSignature: String(treeSignature || ''),
        data: data || null,
      };
    }

    function buildNodeId(parts) {
      return parts.map(function(part) {
        return String(part === undefined || part === null ? '' : part)
          .replace(/[^a-zA-Z0-9_-]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }).filter(Boolean).join('_') || ('node_' + now());
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

    function buildModuleNodeId(moduleKey) {
      var key = String(moduleKey || '').trim() || 'module';
      return buildStableNodeId(['module', key]);
    }

    function getModuleNodeId(moduleEntry) {
      var entry = moduleEntry || {};
      var key = entry && entry.moduleKey ? String(entry.moduleKey || '') : '';
      if (!key) key = normalizeModuleKey(entry.title || entry.module || '');
      if (!key) key = normalizeModuleTitle(entry.title || entry.module || '');
      return buildModuleNodeId(key || 'module');
    }

    function createNode(topic, meta, children, optionsValue) {
      var nodeOptions = optionsValue || {};
      var stableNodeId = meta && meta.nodeId ? String(meta.nodeId) : '';
      var node = {
        id: stableNodeId || buildNodeId([meta && meta.type ? meta.type : 'node', topic]),
        topic: topic || '-',
        expanded: nodeOptions.expanded === false ? false : true,
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

    function buildModulePendingNode(moduleEntry, optionsValue) {
      var pendingOptions = optionsValue || {};
      return createNode(String(pendingOptions.label || '追加生成中'), {
        type: 'topup-placeholder',
        moduleKey: moduleEntry.moduleKey,
        moduleId: moduleEntry.aiModuleId || '',
        nodeId: buildNodeId([
          'topup-placeholder',
          moduleEntry.moduleKey,
          String(pendingOptions.pendingKey || pendingOptions.actionId || 'module')
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
          moduleTitle, caseTitle, fields[2] || 'P1', fields[3] || '-', fields[4] || '-', fields[5] || '-'
        ]),
      });
      var stepsNode = createNode(fields[4] || '-', stepsMeta, [expectedNode], {
        expanded: resolveNodeExpandedState(stepsMeta, collapsedNodeMap, fields[4] || '-', [
          moduleTitle, caseTitle, fields[2] || 'P1', fields[3] || '-', fields[4] || '-'
        ]),
      });
      var preNode = createNode(fields[3] || '-', preMeta, [stepsNode], {
        expanded: resolveNodeExpandedState(preMeta, collapsedNodeMap, fields[3] || '-', [
          moduleTitle, caseTitle, fields[2] || 'P1', fields[3] || '-'
        ]),
      });
      var priorityNode = createNode(fields[2] || 'P1', priorityMeta, [preNode], {
        expanded: resolveNodeExpandedState(priorityMeta, collapsedNodeMap, fields[2] || 'P1', [
          moduleTitle, caseTitle, fields[2] || 'P1'
        ]),
      });
      return createNode(fields[1] || ('用例' + String(caseIndex + 1)), caseMeta, [priorityNode], {
        expanded: resolveNodeExpandedState(caseMeta, collapsedNodeMap, fields[1] || ('用例' + String(caseIndex + 1)), [
          moduleTitle, caseTitle
        ]),
      });
    }

    function buildMindData() {
      clearStaleModuleUiState();
      var xmindState = ensureState();
      var rootState = ensureRootUiState();
      var collapsedNodeMap = getCollapsedNodeKeyMap();
      var visibleContext = buildVisibleModuleContext();
      var treeSignature = buildTreeSignature(visibleContext);
      var renderSignature = buildMindDataVisualSignature(treeSignature, collapsedNodeMap, visibleContext, rootState);
      var rootVisualRunning = isRootGenerationVisuallyRunning(rootState);
      var children = [];
      xmindState.treeSourceSignature = treeSignature;

      if (
        buildCache
        && buildCache.data
        && String(buildCache.signature || '') === String(renderSignature || '')
      ) {
        return buildCache.data;
      }

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

      var requirementLabel = getRequirementLabelText();
      var rootNodeId = getRootNodeId();
      var nextMindData = {
        nodeData: createNode(requirementLabel, {
          type: 'root',
          nodeId: rootNodeId,
          status: rootVisualRunning ? 'running' : (rootState.status === 'error' ? 'error' : ''),
          statusLabel: rootVisualRunning && rootState.lastAction === DEDUPE_ACTION_ID ? '去重中' : '',
          statusText: rootState.error || '',
        }, children, {
          expanded: resolveNodeExpandedState(
            { type: 'root', nodeId: rootNodeId },
            collapsedNodeMap,
            requirementLabel,
            [requirementLabel]
          ),
        }),
      };
      rememberMindDataBuildCache(renderSignature, treeSignature, nextMindData);
      return nextMindData;
    }

    function clearCache() {
      buildCache = { signature: '', treeSignature: '', data: null };
    }

    function getCacheState() {
      return buildCache;
    }

    return {
      buildTreeSignature: buildTreeSignature,
      buildMindDataVisualSignature: buildMindDataVisualSignature,
      buildNodeId: buildNodeId,
      buildStableNodeId: buildStableNodeId,
      getRootNodeId: getRootNodeId,
      buildModuleNodeId: buildModuleNodeId,
      getModuleNodeId: getModuleNodeId,
      createNode: createNode,
      buildCaseTree: buildCaseTree,
      buildMindData: buildMindData,
      clearCache: clearCache,
      getCacheState: getCacheState,
    };
  }

  return { create: create };
});
