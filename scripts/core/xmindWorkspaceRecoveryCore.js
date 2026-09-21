(function() {
  window.app = window.app || {};

  function normalizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function hashText(value) {
    var text = String(value || '');
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function normalizeManualBlocks(blocks) {
    return (Array.isArray(blocks) ? blocks : []).map(function(item) {
      if (!item || typeof item !== 'object') return '';
      var type = normalizeText(item.type || 'text');
      var text = normalizeText(item.text || item.content || item.value || '');
      if (text) return type + ':' + text;
      var identity = normalizeText(item.name || item.fileName || item.alt || item.id || '');
      return identity ? (type + ':' + identity) : '';
    }).filter(Boolean).join('|');
  }

  function buildRequirementFingerprint(source) {
    var context = source && typeof source === 'object' ? source : {};
    var prep = context.prep && typeof context.prep === 'object' ? context.prep : {};
    var mode = normalizeText(prep.requirementMode || context.requirementMode || '');
    var manualBlocks = normalizeManualBlocks(prep.manualRequirementBlocks || context.manualRequirementBlocks);
    var manualLabel = normalizeText(prep.manualRequirementLabel || context.manualRequirementLabel || '');
    var label = mode === 'manual'
      ? manualLabel
      : normalizeText(context.requirementLabel || manualLabel || '');
    var rawText = normalizeText(context.rawText || context.requirementText || '');
    var body = mode === 'manual' ? (manualBlocks || rawText) : rawText;
    var supplement = normalizeText(prep.requirementSupplement || context.requirementSupplement || '');
    var importName = normalizeText(context.lastRawImportName || context.importName || '');
    var parts = [mode, label, body, supplement, importName];
    if (!parts.some(Boolean)) return '';
    return 'req-' + hashText(parts.join('\u001f'));
  }

  function getRequirementFingerprint(source) {
    var context = source && typeof source === 'object' ? source : {};
    var explicit = normalizeText(context.requirementFingerprint || '');
    return explicit || buildRequirementFingerprint(context);
  }

  function buildTokenPart(randomValue) {
    var numeric = Number(randomValue);
    if (!Number.isFinite(numeric)) numeric = 0;
    numeric = Math.abs(numeric % 1);
    return Math.floor(numeric * 4294967295).toString(36) || '0';
  }

  function normalizeTimestamp(nowValue) {
    var numeric = Number(nowValue);
    if (!Number.isFinite(numeric) || numeric < 0) numeric = 0;
    return Math.floor(numeric).toString(36);
  }

  function createWorkspaceId(seq, nowValue, randomValue) {
    var number = Number(seq || 1);
    if (!Number.isFinite(number) || number < 1) number = 1;
    return [
      'xmind-workspace',
      String(Math.floor(number)),
      normalizeTimestamp(nowValue),
      buildTokenPart(randomValue),
    ].join('-');
  }

  function createWorkspaceGenerationId(nowValue, randomValue) {
    return [
      'xmind-generation',
      normalizeTimestamp(nowValue),
      buildTokenPart(randomValue),
    ].join('-');
  }

  function getContextWorkspaceId(context) {
    var source = context && typeof context === 'object' ? context : {};
    return normalizeText(source.workspaceId || '');
  }

  function getContextGenerationId(context) {
    var source = context && typeof context === 'object' ? context : {};
    return normalizeText(source.workspaceGenerationId || source.generationId || '');
  }

  function areRestoreContextsCompatible(baseContext, incomingContext) {
    var base = baseContext && typeof baseContext === 'object' ? baseContext : null;
    var incoming = incomingContext && typeof incomingContext === 'object' ? incomingContext : null;
    if (!base || !incoming) return true;
    var baseWorkspaceId = getContextWorkspaceId(base);
    var incomingWorkspaceId = getContextWorkspaceId(incoming);
    if (baseWorkspaceId && incomingWorkspaceId && baseWorkspaceId !== incomingWorkspaceId) return false;
    var baseGenerationId = getContextGenerationId(base);
    var incomingGenerationId = getContextGenerationId(incoming);
    if (baseGenerationId && incomingGenerationId && baseGenerationId !== incomingGenerationId) return false;
    var baseFingerprint = getRequirementFingerprint(base);
    var incomingFingerprint = getRequirementFingerprint(incoming);
    if (baseFingerprint && incomingFingerprint && baseFingerprint !== incomingFingerprint) return false;
    if ((baseGenerationId || incomingGenerationId) && (!baseGenerationId || !incomingGenerationId)) {
      return Boolean(baseFingerprint && incomingFingerprint && baseFingerprint === incomingFingerprint);
    }
    return true;
  }

  function evaluateTaskRestore(task, workspace) {
    var sourceTask = task && typeof task === 'object' ? task : {};
    var taskContext = sourceTask.restoreContext && typeof sourceTask.restoreContext === 'object'
      ? sourceTask.restoreContext
      : {};
    var taskWorkspaceId = normalizeText(sourceTask.workspaceId || taskContext.workspaceId || '');
    if (!taskWorkspaceId) {
      return { allowed: false, recreateWorkspace: false, reason: 'task-workspace-missing' };
    }
    var sourceWorkspace = workspace && typeof workspace === 'object' ? workspace : null;
    if (!sourceWorkspace) {
      if (String(sourceTask.status || '') === 'running') {
        return { allowed: true, recreateWorkspace: true, reason: 'running-workspace-recovery' };
      }
      return { allowed: false, recreateWorkspace: false, reason: 'terminal-workspace-missing' };
    }
    var workspaceContext = sourceWorkspace.restoreContext && typeof sourceWorkspace.restoreContext === 'object'
      ? sourceWorkspace.restoreContext
      : (sourceWorkspace.context && typeof sourceWorkspace.context === 'object' ? sourceWorkspace.context : {});
    var workspaceId = normalizeText(sourceWorkspace.id || workspaceContext.workspaceId || '');
    if (workspaceId && taskWorkspaceId !== workspaceId) {
      return { allowed: false, recreateWorkspace: false, reason: 'workspace-mismatch' };
    }
    var taskGenerationId = getContextGenerationId(taskContext) || normalizeText(sourceTask.workspaceGenerationId || '');
    var workspaceGenerationId = normalizeText(sourceWorkspace.generationId || '')
      || getContextGenerationId(workspaceContext);
    if (taskGenerationId && workspaceGenerationId && taskGenerationId !== workspaceGenerationId) {
      return { allowed: false, recreateWorkspace: false, reason: 'generation-mismatch' };
    }
    var taskFingerprint = getRequirementFingerprint(taskContext);
    var workspaceFingerprint = getRequirementFingerprint(workspaceContext);
    if (taskFingerprint && workspaceFingerprint && taskFingerprint !== workspaceFingerprint) {
      return { allowed: false, recreateWorkspace: false, reason: 'requirement-mismatch' };
    }
    if (!taskGenerationId || !workspaceGenerationId) {
      var taskCreatedAt = Number(sourceTask.createdAt || taskContext.taskCreatedAt || 0);
      var workspaceCreatedAt = Number(sourceWorkspace.createdAt || workspaceContext.workspaceCreatedAt || 0);
      if (
        Number.isFinite(taskCreatedAt)
        && taskCreatedAt > 0
        && Number.isFinite(workspaceCreatedAt)
        && workspaceCreatedAt > 0
        && taskCreatedAt < workspaceCreatedAt
      ) {
        return { allowed: false, recreateWorkspace: false, reason: 'legacy-task-older-than-workspace' };
      }
      if ((taskGenerationId || workspaceGenerationId) && (!taskFingerprint || !workspaceFingerprint)) {
        return { allowed: false, recreateWorkspace: false, reason: 'legacy-task-identity-missing' };
      }
    }
    return { allowed: true, recreateWorkspace: false, reason: 'compatible' };
  }

  // 已关闭页签的墓碑表：关闭即丢弃，任何页面（含持有旧内存态的页面）都不得再把它写回流程缓存。
  var CLOSED_WORKSPACE_STORAGE_KEY = 'tap-xmind-closed-workspaces-v1';
  var CLOSED_WORKSPACE_MAX = 300;

  function readClosedWorkspaceMap() {
    if (typeof localStorage === 'undefined') return {};
    try {
      var raw = localStorage.getItem(CLOSED_WORKSPACE_STORAGE_KEY) || '';
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return parsed;
    } catch (err) {
      return {};
    }
  }

  function writeClosedWorkspaceMap(map) {
    if (typeof localStorage === 'undefined') return false;
    try {
      localStorage.setItem(CLOSED_WORKSPACE_STORAGE_KEY, JSON.stringify(map || {}));
      return true;
    } catch (err) {
      return false;
    }
  }

  function markWorkspaceClosed(workspaceId, closedAtValue) {
    var stableId = normalizeText(workspaceId);
    if (!stableId) return false;
    var map = readClosedWorkspaceMap();
    var closedAt = Number(closedAtValue);
    if (!Number.isFinite(closedAt) || closedAt <= 0) closedAt = Date.now();
    map[stableId] = closedAt;
    var keys = Object.keys(map);
    if (keys.length > CLOSED_WORKSPACE_MAX) {
      keys.sort(function(a, b) {
        return Number(map[a] || 0) - Number(map[b] || 0);
      });
      keys.slice(0, keys.length - CLOSED_WORKSPACE_MAX).forEach(function(key) {
        delete map[key];
      });
    }
    return writeClosedWorkspaceMap(map);
  }

  function isWorkspaceClosed(workspaceId) {
    var stableId = normalizeText(workspaceId);
    if (!stableId) return false;
    var map = readClosedWorkspaceMap();
    return Object.prototype.hasOwnProperty.call(map, stableId);
  }

  // 过滤掉已关闭页签，返回 { order, workspaces, activeWorkspaceId, mirrorWorkspaceId, changed }
  function filterClosedWorkspaces(source) {
    var input = source && typeof source === 'object' ? source : {};
    var order = Array.isArray(input.workspaceOrder) ? input.workspaceOrder.slice() : [];
    var workspaces = input.workspaces && typeof input.workspaces === 'object' ? input.workspaces : {};
    var activeWorkspaceId = input.activeWorkspaceId ? String(input.activeWorkspaceId || '') : '';
    var mirrorWorkspaceId = input.mirrorWorkspaceId ? String(input.mirrorWorkspaceId || '') : '';
    var closedMap = readClosedWorkspaceMap();
    var closedIds = Object.keys(closedMap);
    if (!closedIds.length) {
      return {
        order: order,
        workspaces: workspaces,
        activeWorkspaceId: activeWorkspaceId,
        mirrorWorkspaceId: mirrorWorkspaceId,
        changed: false,
      };
    }
    var changed = false;
    var nextOrder = order.filter(function(id) {
      var stableId = String(id || '');
      if (!stableId) return false;
      if (Object.prototype.hasOwnProperty.call(closedMap, stableId)) {
        changed = true;
        return false;
      }
      return true;
    });
    var nextWorkspaces = {};
    Object.keys(workspaces).forEach(function(id) {
      var stableId = String(id || '');
      if (stableId && Object.prototype.hasOwnProperty.call(closedMap, stableId)) {
        changed = true;
        return;
      }
      nextWorkspaces[id] = workspaces[id];
    });
    if (activeWorkspaceId && !nextWorkspaces[activeWorkspaceId]) {
      activeWorkspaceId = nextOrder.length ? String(nextOrder[0] || '') : '';
      changed = true;
    }
    if (mirrorWorkspaceId && !nextWorkspaces[mirrorWorkspaceId]) {
      mirrorWorkspaceId = activeWorkspaceId;
      changed = true;
    }
    return {
      order: nextOrder,
      workspaces: nextWorkspaces,
      activeWorkspaceId: activeWorkspaceId,
      mirrorWorkspaceId: mirrorWorkspaceId,
      changed: changed,
    };
  }

  window.app.xmindWorkspaceRecoveryCore = {
    areRestoreContextsCompatible: areRestoreContextsCompatible,
    buildRequirementFingerprint: buildRequirementFingerprint,
    createWorkspaceGenerationId: createWorkspaceGenerationId,
    createWorkspaceId: createWorkspaceId,
    evaluateTaskRestore: evaluateTaskRestore,
    filterClosedWorkspaces: filterClosedWorkspaces,
    getRequirementFingerprint: getRequirementFingerprint,
    isWorkspaceClosed: isWorkspaceClosed,
    markWorkspaceClosed: markWorkspaceClosed,
  };
})();
