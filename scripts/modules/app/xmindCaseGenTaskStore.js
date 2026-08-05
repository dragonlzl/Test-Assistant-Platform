(function(factory) {
  var defaultRoot = typeof window !== 'undefined' ? window : null;
  var cloneJson = typeof module !== 'undefined' && module.exports
    ? require('../../core/jsonCloneCore.js').cloneJson
    : defaultRoot.app.jsonCloneCore.cloneJson;
  var api = factory(defaultRoot, cloneJson);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.xmindCaseGenTaskStore = api;
  }
})(function(defaultRoot, cloneJson) {
  function resolveStorage(options, root) {
    if (options && options.storage !== undefined) return options.storage;
    try {
      if (root && root.localStorage) return root.localStorage;
    } catch (err) {
      return null;
    }
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (err2) {
      return null;
    }
    return null;
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var root = opts.root || defaultRoot || null;
    var storage = resolveStorage(opts, root);
    var storageKey = opts.storageKey || 'tap-xmind-casegen-tasks';
    var maxTaskStorageChars = Number(opts.maxTaskStorageChars) || 900000;
    var persistTaskStorageChars = Number(opts.persistTaskStorageChars) || 350000;
    var volatileTaskList = [];
    var preferVolatileTasks = false;

    function safeJsonParse(raw) {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (err) {
        return null;
      }
    }

    function markTaskStorageRecovery(reason) {
      if (!root) return;
      root.app = root.app || {};
      root.app.__xmindCasegenTaskStorageRecovered = {
        reason: String(reason || ''),
        at: Date.now(),
      };
    }

    function rememberVolatileTasks(tasks, options) {
      var memoryOptions = options && typeof options === 'object' ? options : {};
      volatileTaskList = cloneJson(Array.isArray(tasks) ? tasks : [], []);
      if (memoryOptions.prefer === true) preferVolatileTasks = true;
      else if (memoryOptions.prefer === false) preferVolatileTasks = false;
      return cloneJson(volatileTaskList, []);
    }

    function readVolatileTasks() {
      return cloneJson(volatileTaskList, []);
    }

    function compactTaskCaseGenModules(modules) {
      return (Array.isArray(modules) ? modules : []).map(function(item) {
        if (item && item.title) {
          return {
            id: item.id ? String(item.id || '') : '',
            title: String(item.title || ''),
            scenarios: Array.isArray(item.scenarios) ? cloneJson(item.scenarios, []) : [],
            points: Array.isArray(item.points) ? cloneJson(item.points, []) : [],
            coupled: Array.isArray(item.coupled) ? cloneJson(item.coupled, []) : [],
            special: Array.isArray(item.special) ? cloneJson(item.special, []) : [],
          };
        }
        return {
          module: item && item.module ? String(item.module || '') : '',
          key_scenarios: Array.isArray(item && item.key_scenarios) ? cloneJson(item.key_scenarios, []) : [],
          test_points: Array.isArray(item && item.test_points) ? cloneJson(item.test_points, []) : [],
          coupled_modules: Array.isArray(item && item.coupled_modules) ? cloneJson(item.coupled_modules, []) : [],
          cases: [],
        };
      }).filter(function(item) {
        return Boolean(item && (item.module || item.title));
      });
    }

    function compactTaskRootPipelineSnapshot(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : null;
      if (!source) return null;
      return {
        id: String(source.id || ''),
        actionId: String(source.actionId || ''),
        snapshotId: String(source.snapshotId || ''),
        historyActionLabel: String(source.historyActionLabel || ''),
        stage: String(source.stage || ''),
        discoveryStatus: String(source.discoveryStatus || ''),
        hadAiContentBeforeAction: source.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: source.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: source.hadAiCasesBeforeAction === true,
        cancelled: source.cancelled === true,
        cancelReason: String(source.cancelReason || ''),
        errorCount: Number(source.errorCount || 0) || 0,
        createdModules: Number(source.createdModules || 0) || 0,
        addedCases: Number(source.addedCases || 0) || 0,
        dedupeStatus: String(source.dedupeStatus || ''),
        dedupeTaskId: String(source.dedupeTaskId || ''),
        dedupeBeforeCount: Number(source.dedupeBeforeCount || 0) || 0,
        dedupeAfterCount: Number(source.dedupeAfterCount || 0) || 0,
        dedupeRemovedCount: Number(source.dedupeRemovedCount || 0) || 0,
        dedupeError: String(source.dedupeError || ''),
        dedupeRecords: Array.isArray(source.dedupeRecords) ? cloneJson(source.dedupeRecords, []) || [] : [],
        detailMap: cloneJson(source.detailMap, {}) || {},
        diagnostics: Array.isArray(source.diagnostics) ? source.diagnostics.slice() : [],
        pendingQueue: Array.isArray(source.pendingQueue) ? cloneJson(source.pendingQueue, []) : [],
        updatedAt: Number(source.updatedAt || 0) || 0,
      };
    }

    function collectTaskRestoreSnapshotIds(task, restoreContext) {
      var ids = {};
      var directSnapshotId = task && task.snapshotId ? String(task.snapshotId || '') : '';
      if (directSnapshotId) ids[directSnapshotId] = true;
      var pipeline = restoreContext && restoreContext.rootPipeline && typeof restoreContext.rootPipeline === 'object'
        ? restoreContext.rootPipeline
        : null;
      var pipelineSnapshotId = pipeline && pipeline.snapshotId ? String(pipeline.snapshotId || '') : '';
      if (pipelineSnapshotId) ids[pipelineSnapshotId] = true;
      if (Object.keys(ids).length) return ids;
      var list = Array.isArray(restoreContext && restoreContext.operationSnapshots)
        ? restoreContext.operationSnapshots
        : [];
      var latest = list.length ? list[list.length - 1] : null;
      if (latest && latest.id) ids[String(latest.id || '')] = true;
      return ids;
    }

    function compactTaskOperationSnapshots(list, task, restoreContext) {
      var sourceList = Array.isArray(list) ? list : [];
      if (!sourceList.length) return [];
      var keepIds = collectTaskRestoreSnapshotIds(task, restoreContext);
      var filtered = sourceList.filter(function(item) {
        if (!item || !item.id) return false;
        if (!Object.keys(keepIds).length) return true;
        return keepIds[String(item.id || '')] === true;
      });
      if (!filtered.length && sourceList.length) filtered = [sourceList[sourceList.length - 1]];
      return filtered.map(function(item) {
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
      }).filter(Boolean);
    }

    function compactTaskRestoreContext(restoreContext, task) {
      var source = restoreContext && typeof restoreContext === 'object' ? restoreContext : null;
      if (!source) return null;
      var next = {
        workspaceId: String(source.workspaceId || ''),
        workspaceGenerationId: String(source.workspaceGenerationId || ''),
        workspaceCreatedAt: Number(source.workspaceCreatedAt || 0) || 0,
        requirementFingerprint: String(source.requirementFingerprint || ''),
        requirementLabel: String(source.requirementLabel || ''),
        requirementLabelSource: String(source.requirementLabelSource || ''),
        lastRawImportName: String(source.lastRawImportName || ''),
        rawText: String(source.rawText || ''),
        caseGenModules: compactTaskCaseGenModules(source.caseGenModules),
        rootPipeline: compactTaskRootPipelineSnapshot(source.rootPipeline),
        prep: cloneJson(source.prep, {}),
        viewState: cloneJson(source.viewState, {}),
      };
      var operationSnapshots = compactTaskOperationSnapshots(source.operationSnapshots, task, source);
      if (operationSnapshots.length) {
        next.operationSnapshots = operationSnapshots;
        next.nextSnapshotId = Number(source.nextSnapshotId || 1) || 1;
      }
      return next;
    }

    function normalizeModelSnapshot(model) {
      if (!model || typeof model !== 'object') return null;
      return {
        id: model.id || '',
        name: model.name || '',
        provider: model.provider || '',
        baseUrl: model.baseUrl || '',
        apiKey: model.apiKey || '',
        model: model.model || '',
        maxTokens: model.maxTokens,
        stream: model.stream,
        streamMode: model.streamMode,
        capabilities: cloneJson(model.capabilities, []),
      };
    }

    function isTaskTerminalStatus(status) {
      var value = status === null || status === undefined ? '' : String(status || '');
      return value === 'done' || value === 'error' || value === 'cancelled';
    }

    function buildPersistableTask(task, persistOptions) {
      var taskOptions = persistOptions && typeof persistOptions === 'object' ? persistOptions : {};
      var snapshot = task && typeof task === 'object' ? cloneJson(task, null) : null;
      if (!snapshot) return null;
      if (snapshot.model) snapshot.model = normalizeModelSnapshot(snapshot.model);
      if (snapshot.requestMode !== 'content') snapshot.contentBlocks = [];
      if (snapshot.restoreContext && typeof snapshot.restoreContext === 'object') {
        snapshot.restoreContext = taskOptions.compactRestoreContext === true
          ? compactTaskRestoreContext(snapshot.restoreContext, snapshot)
          : cloneJson(snapshot.restoreContext, {});
      } else {
        delete snapshot.restoreContext;
      }
      if (isTaskTerminalStatus(snapshot.status)) {
        snapshot.prompt = '';
        snapshot.requestText = '';
        snapshot.contentBlocks = [];
        delete snapshot.modelRequestBatch;
        snapshot.requestOwner = '';
        snapshot.reasoning = '';
        snapshot.runnerId = '';
        snapshot.heartbeatAt = 0;
        delete snapshot.startedAt;
        delete snapshot.degradedToTextOnly;
        delete snapshot.retryCount;
        if (!snapshot.error) delete snapshot.error;
        if (!snapshot.model || typeof snapshot.model !== 'object') delete snapshot.model;
      } else {
        delete snapshot.resultRaw;
        delete snapshot.error;
        delete snapshot.durationMs;
        delete snapshot.endedAt;
        delete snapshot.cancelledAt;
        delete snapshot.cancelMeta;
      }
      return snapshot;
    }

    function buildPersistableTaskList(tasks, persistOptions) {
      return (Array.isArray(tasks) ? tasks : []).map(function(item) {
        return buildPersistableTask(item, persistOptions);
      }).filter(Boolean);
    }

    function serializeTaskList(persistableList) {
      if (!persistableList.length) return { ok: true, raw: '' };
      try {
        var raw = JSON.stringify(persistableList);
        if (raw.length > persistTaskStorageChars) return { ok: false, reason: 'oversize' };
        return { ok: true, raw: raw };
      } catch (err) {
        return { ok: false, reason: 'serialize-failed' };
      }
    }

    function serializeTasksForStorage(tasks) {
      var persistableList = buildPersistableTaskList(tasks, { compactRestoreContext: false });
      var serialized = serializeTaskList(persistableList);
      if (serialized.ok === true || serialized.reason === 'serialize-failed') return serialized;
      return serializeTaskList(buildPersistableTaskList(tasks, { compactRestoreContext: true }));
    }

    function readTasks() {
      if (preferVolatileTasks === true) return readVolatileTasks();
      if (!storage) return readVolatileTasks();
      try {
        var raw = storage.getItem(storageKey) || '';
        if (!raw) return readVolatileTasks();
        if (raw.length > maxTaskStorageChars) {
          storage.removeItem(storageKey);
          if (volatileTaskList.length) {
            markTaskStorageRecovery('oversize-volatile');
            preferVolatileTasks = true;
            return readVolatileTasks();
          }
          markTaskStorageRecovery('oversize');
          return [];
        }
        var parsed = safeJsonParse(raw);
        if (!Array.isArray(parsed)) {
          storage.removeItem(storageKey);
          if (volatileTaskList.length) {
            markTaskStorageRecovery('invalid-volatile');
            preferVolatileTasks = true;
            return readVolatileTasks();
          }
          markTaskStorageRecovery('invalid');
          return [];
        }
        return rememberVolatileTasks(parsed, { prefer: false });
      } catch (err) {
        if (volatileTaskList.length) {
          markTaskStorageRecovery('read-failed-volatile');
          preferVolatileTasks = true;
          return readVolatileTasks();
        }
        return [];
      }
    }

    function emitTaskUpdate(task, action, tasks) {
      if (!root || typeof root.dispatchEvent !== 'function') return;
      var detail = {
        task: task || null,
        action: action || '',
        tasks: Array.isArray(tasks) ? tasks : [],
      };
      try {
        if (typeof root.CustomEvent === 'function') {
          root.dispatchEvent(new root.CustomEvent('xmind-casegen-task', { detail: detail }));
        } else if (root.document && typeof root.document.createEvent === 'function') {
          var evt = root.document.createEvent('CustomEvent');
          evt.initCustomEvent('xmind-casegen-task', false, false, detail);
          root.dispatchEvent(evt);
        }
      } catch (err) {
        // ignore
      }
    }

    function writeTasks(tasks, action, task) {
      var list = Array.isArray(tasks) ? tasks.slice() : [];
      var writeSucceeded = false;
      var serialized = serializeTasksForStorage(list);
      if (storage) {
        try {
          if (!list.length) storage.removeItem(storageKey);
          else if (serialized.ok === true) {
            storage.setItem(storageKey, serialized.raw);
            writeSucceeded = true;
          } else if (serialized.reason === 'oversize') {
            markTaskStorageRecovery('write-oversize-volatile');
          } else {
            markTaskStorageRecovery('write-serialize-failed-volatile');
          }
        } catch (err) {
          markTaskStorageRecovery('write-failed-volatile');
        }
      }
      rememberVolatileTasks(list, { prefer: writeSucceeded !== true });
      emitTaskUpdate(task || null, action || 'update', list);
      return list;
    }

    function getTask(taskId) {
      var targetId = taskId ? String(taskId || '') : '';
      if (!targetId) return null;
      var list = readTasks();
      for (var i = 0; i < list.length; i += 1) {
        if (list[i] && String(list[i].id || '') === targetId) return list[i];
      }
      return null;
    }

    function getTasks() {
      return readTasks();
    }

    function buildTaskId() {
      return 'xmind-casegen-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    }

    function createTask(payload) {
      var base = payload && typeof payload === 'object' ? cloneJson(payload, {}) : {};
      base.id = base.id || buildTaskId();
      base.status = 'running';
      base.createdAt = base.createdAt || Date.now();
      base.updatedAt = base.updatedAt || base.createdAt;
      base.retryCount = Number(base.retryCount || 0);
      base.requestOwner = base.requestOwner ? String(base.requestOwner || '') : ('xmind-casegen:' + base.id);
      base.requestMode = base.requestMode === 'content' ? 'content' : 'text';
      base.prompt = base.prompt ? String(base.prompt || '') : '';
      base.reasoning = base.reasoning ? String(base.reasoning || '') : '';
      base.temperature = Number(base.temperature);
      if (!Number.isFinite(base.temperature)) base.temperature = 0.2;
      base.requestText = base.requestText ? String(base.requestText || '') : '';
      if (!Array.isArray(base.contentBlocks)) base.contentBlocks = [];
      if (base.model) base.model = normalizeModelSnapshot(base.model);
      return base;
    }

    function upsertTask(task, action) {
      if (!task || !task.id) return null;
      var list = readTasks();
      var next = cloneJson(task, null);
      if (!next) return null;
      next.updatedAt = Date.now();
      var replaced = false;
      for (var i = 0; i < list.length; i += 1) {
        if (!list[i] || String(list[i].id || '') !== String(next.id || '')) continue;
        list[i] = next;
        replaced = true;
        break;
      }
      if (!replaced) list.push(next);
      writeTasks(list, action || 'update', next);
      return next;
    }

    function buildHeartbeatEventTask(task) {
      if (!task || typeof task !== 'object') return null;
      return {
        id: String(task.id || ''),
        status: String(task.status || ''),
        scope: String(task.scope || ''),
        workspaceId: String(task.workspaceId || ''),
        rootPipelineId: String(task.rootPipelineId || ''),
        actionId: String(task.actionId || ''),
        dedupeMode: String(task.dedupeMode || ''),
        runnerId: String(task.runnerId || ''),
        heartbeatAt: Number(task.heartbeatAt || 0) || 0,
        updatedAt: Number(task.updatedAt || 0) || 0,
      };
    }

    function updateTaskHeartbeat(task) {
      if (!task || !task.id) return null;
      var list = volatileTaskList.length ? readVolatileTasks() : readTasks();
      var next = cloneJson(task, null);
      if (!next) return null;
      next.updatedAt = Date.now();
      var replaced = false;
      for (var i = 0; i < list.length; i += 1) {
        if (!list[i] || String(list[i].id || '') !== String(next.id || '')) continue;
        list[i] = next;
        replaced = true;
        break;
      }
      if (!replaced) list.push(next);
      rememberVolatileTasks(list, { prefer: true });
      emitTaskUpdate(buildHeartbeatEventTask(next), 'heartbeat', []);
      return next;
    }

    function clearAll(action) {
      if (storage) {
        try {
          storage.removeItem(storageKey);
        } catch (err) {
          markTaskStorageRecovery('clear-all-failed-volatile');
        }
      }
      rememberVolatileTasks([], { prefer: false });
      emitTaskUpdate(null, action || 'clear-all', []);
      return true;
    }

    return {
      storageKey: storageKey,
      cloneJson: cloneJson,
      readTasks: readTasks,
      writeTasks: writeTasks,
      getTask: getTask,
      getTasks: getTasks,
      buildTaskId: buildTaskId,
      normalizeModelSnapshot: normalizeModelSnapshot,
      createTask: createTask,
      upsertTask: upsertTask,
      updateTaskHeartbeat: updateTaskHeartbeat,
      emitTaskUpdate: emitTaskUpdate,
      clearAll: clearAll,
    };
  }

  return { create: create };
});
