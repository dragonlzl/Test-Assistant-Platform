(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.missingReminderAiManager = api;
  }
})(function() {
function initMissingReminderAiManager(options) {
  const utils = options && options.utils ? options.utils : {};
  const callModel = options && typeof options.callModelWithConfig === 'function'
    ? options.callModelWithConfig
    : async function missingCall() {
      throw new Error('模型客户端不可用，请刷新页面后重试');
    };
  const storagePrefix = 'tap-missing-reminder-ai-task:';
  const runnerId = 'missing-reminder-ai-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const runningMap = {};
  const heartbeatIntervalMs = 2000;
  const staleMs = 6000;
  const takeoverTimers = {};
  var pageUnloading = false;

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', function() { pageUnloading = true; });
    window.addEventListener('beforeunload', function() { pageUnloading = true; });
  }

  function buildKey(scene) {
    return storagePrefix + scene;
  }

  function safeJsonParse(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function readTask(scene) {
    if (!scene || typeof localStorage === 'undefined') return null;
    try {
      return safeJsonParse(localStorage.getItem(buildKey(scene)));
    } catch (err) {
      return null;
    }
  }

  function emitTaskUpdate(scene, task, action) {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    try {
      if (typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('missing-reminder-ai-task', { detail: { scene: scene, task: task, action: action || '' } }));
      } else if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
        var evt = document.createEvent('CustomEvent');
        evt.initCustomEvent('missing-reminder-ai-task', false, false, { scene: scene, task: task, action: action || '' });
        window.dispatchEvent(evt);
      }
    } catch (err) {
      // ignore
    }
  }

  function writeTask(scene, task, action) {
    if (!scene || typeof localStorage === 'undefined') return task || null;
    if (!task) {
      try {
        localStorage.removeItem(buildKey(scene));
      } catch (err) {
        // ignore
      }
      emitTaskUpdate(scene, null, action || 'clear');
      return null;
    }
    var next = task;
    next.updatedAt = Date.now();
    try {
      localStorage.setItem(buildKey(scene), JSON.stringify(next));
    } catch (err) {
      // ignore
    }
    emitTaskUpdate(scene, next, action || 'update');
    return next;
  }

  function clearTask(scene) {
    writeTask(scene, null, 'clear');
  }

  function updateTask(scene, patch, action) {
    if (!scene) return null;
    var current = readTask(scene);
    if (!current) return null;
    var next = patch && typeof patch === 'object' ? Object.assign({}, current, patch) : current;
    return writeTask(scene, next, action || 'update');
  }

  function buildTaskId() {
    return 'missing-reminder-ai-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
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
    };
  }

  function createTask(scene, payload) {
    var base = payload && typeof payload === 'object' ? Object.assign({}, payload) : {};
    base.id = base.id || buildTaskId();
    base.scene = scene || base.scene || '';
    base.status = 'running';
    base.createdAt = base.createdAt || Date.now();
    base.updatedAt = base.updatedAt || base.createdAt;
    base.retryCount = Number(base.retryCount || 0);
    if (base.model) base.model = normalizeModelSnapshot(base.model);
    return base;
  }

  function parseTaskIds(content) {
    var raw = content || '';
    var stripped = utils && typeof utils.stripCodeFence === 'function'
      ? utils.stripCodeFence(raw)
      : String(raw || '').trim();
    var payloadText = utils && typeof utils.extractJsonPayload === 'function'
      ? utils.extractJsonPayload(stripped)
      : '';
    var text = payloadText || stripped;
    var data = JSON.parse(text);
    var ids = data && Array.isArray(data.ids) ? data.ids : [];
    return ids.map(function(id) { return String(id).trim(); }).filter(Boolean);
  }

  function resolveUserText(task) {
    if (!task) return '';
    if (typeof task.userText === 'string' && task.userText.trim()) return task.userText;
    if (task.userPayload && typeof task.userPayload === 'object') {
      try {
        return JSON.stringify(task.userPayload, null, 2);
      } catch (err) {
        return '';
      }
    }
    return '';
  }

  function cloneJson(value, fallback) {
    if (value === undefined || value === null) return fallback;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (err) {
      return fallback;
    }
  }

  function normalizeText(value) {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
      return value.map(function(item) { return normalizeText(item); }).filter(Boolean).join('\n');
    }
    return String(value).replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, '').replace(/\r/g, '\n').trim();
  }

  function normalizeFlatText(value) {
    return normalizeText(value).replace(/\s+/g, ' ').trim();
  }

  function normalizeModuleKey(value) {
    return normalizeFlatText(value).toLowerCase();
  }

  function normalizePriority(value) {
    var text = normalizeFlatText(value);
    if (!text) return 'P1';
    var head = text.charAt(0);
    if (head === 'p' || head === 'P') return 'P' + text.slice(1);
    return text;
  }

  function stripCodeFence(text) {
    var raw = String(text || '').trim();
    var fence = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fence ? String(fence[1] || '').trim() : raw;
  }

  function parseJsonPayload(text) {
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

  function normalizePipelineCase(raw, fallbackModule) {
    if (!raw || typeof raw !== 'object') return null;
    var moduleName = normalizeFlatText(raw.module || raw.module_name || fallbackModule || '');
    var title = normalizeFlatText(raw.title || raw.case_title || '');
    var expected = normalizeText(raw.expected || raw.expect || raw.result || '');
    if (!moduleName || !title || !expected) return null;
    return {
      module: moduleName,
      title: title,
      priority: normalizePriority(raw.priority || raw.level || ''),
      precondition: normalizeText(raw.precondition || raw.preconditions || ''),
      preconditions: normalizeText(raw.preconditions || raw.precondition || ''),
      steps: normalizeText(raw.steps || raw.step || raw.actions || ''),
      expected: expected,
      remark: normalizeText(raw.remark || raw.remarks || ''),
    };
  }

  function normalizePipelineModulesFromContent(content) {
    var payload = parseJsonPayload(content);
    var modules = [];
    if (Array.isArray(payload)) {
      modules = payload;
    } else if (payload && typeof payload === 'object') {
      if (Array.isArray(payload.modules)) modules = payload.modules;
      else if (Array.isArray(payload.data)) modules = payload.data;
    }
    return (Array.isArray(modules) ? modules : []).map(function(item) {
      if (!item || typeof item !== 'object') return null;
      var moduleName = normalizeFlatText(item.module || item.module_name || item.title || item.name || '');
      if (!moduleName) return null;
      var rawCases = Array.isArray(item.cases) ? item.cases : [];
      return {
        module: moduleName,
        moduleKey: normalizeModuleKey(moduleName),
        key_scenarios: Array.isArray(item.key_scenarios) ? item.key_scenarios.slice() : [],
        test_points: Array.isArray(item.test_points) ? item.test_points.slice() : [],
        coupled_modules: Array.isArray(item.coupled_modules) ? item.coupled_modules.slice() : [],
        coverage: Number(item.coverage),
        missing: item.missing === true,
        cases: rawCases.map(function(caseItem) {
          return normalizePipelineCase(caseItem, moduleName);
        }).filter(Boolean),
      };
    }).filter(Boolean);
  }

  function isLegacyCasePageGenerationOutput(content) {
    var payload = parseJsonPayload(content);
    return Boolean(
      payload
      && typeof payload === 'object'
      && Array.isArray(payload.missing_modules)
      && Array.isArray(payload.existing_modules)
    );
  }

  function buildPipelinePrompt(pipeline, contract) {
    var promptBase = pipeline && pipeline.promptBase ? String(pipeline.promptBase || '').trim() : '';
    var parts = [];
    if (promptBase) parts.push(promptBase);
    parts.push('operation_contract(JSON)：' + JSON.stringify(contract || {}));
    return parts.filter(Boolean).join('\n\n');
  }

  function buildPipelineStagePayload(pipeline, contract, stage, moduleEntry, discoveryModules) {
    var payload = cloneJson(pipeline && pipeline.basePayload, {});
    payload.operation_contract = cloneJson(contract || {}, {});
    payload.current_visible_modules = cloneJson(pipeline && pipeline.visibleModules, []);
    payload.current_ai_generation_layer = cloneJson(discoveryModules || [], []);
    payload.xmind_external_pipeline = {
      enabled: true,
      version: 1,
      stage: stage || 'module',
      pipeline: pipeline && pipeline.mode ? String(pipeline.mode || '') : 'append_all_modules_cases',
      root_mode: 'append_all_modules_cases',
      module_mode: contract && contract.mode ? String(contract.mode || '') : '',
      output_contract: 'xmind_modules',
      final_output_scope: 'new_cases_only',
      model_assignment_policy: 'use_case_library_generation_model',
      protect_original_cases: true,
    };
    if (moduleEntry) {
      payload.current_operation_module = cloneJson(moduleEntry, {});
    }
    return payload;
  }

  function buildPipelineContract(mode, moduleName) {
    if (mode === 'module_append_cases') {
      return {
        scope: 'module',
        mode: 'module_append_cases',
        targetModule: normalizeFlatText(moduleName || ''),
        allowNewModules: false,
        generateCasesForNewModules: false,
        generateCasesForExistingModules: true,
        dedupeAgainstVisibleModules: false,
        dedupeAgainstVisibleCases: true,
      };
    }
    return {
      scope: 'module',
      mode: 'module_full_cases',
      targetModule: normalizeFlatText(moduleName || ''),
      allowNewModules: false,
      generateCasesForNewModules: false,
      generateCasesForExistingModules: true,
      dedupeAgainstVisibleModules: false,
      dedupeAgainstVisibleCases: false,
    };
  }

  function findPipelineModuleByKey(modules, key) {
    var targetKey = String(key || '');
    var list = Array.isArray(modules) ? modules : [];
    for (var i = 0; i < list.length; i += 1) {
      if (normalizeModuleKey(list[i] && list[i].module) === targetKey) return list[i];
    }
    return null;
  }

  function buildPipelineDescriptors(pipeline, discoveryModules) {
    var visible = Array.isArray(pipeline && pipeline.visibleModules) ? pipeline.visibleModules : [];
    var visibleMap = {};
    var descriptors = [];
    visible.forEach(function(entry) {
      if (!entry || !entry.module) return;
      var key = normalizeModuleKey(entry.module);
      if (!key || visibleMap[key]) return;
      visibleMap[key] = true;
      descriptors.push({
        missing: false,
        module: entry.module,
        moduleKey: key,
        visibleCases: Array.isArray(entry.cases) ? entry.cases.slice() : [],
        action: entry.cases && entry.cases.length ? 'module_append_cases' : 'module_full_cases',
        discoveryModule: findPipelineModuleByKey(discoveryModules, key),
      });
    });
    (Array.isArray(discoveryModules) ? discoveryModules : []).forEach(function(item) {
      if (!item || !item.module) return;
      var key = normalizeModuleKey(item.module);
      if (!key || visibleMap[key]) return;
      visibleMap[key] = true;
      descriptors.push({
        missing: true,
        module: item.module,
        moduleKey: key,
        visibleCases: [],
        action: 'module_full_cases',
        discoveryModule: item,
      });
    });
    return descriptors;
  }

  function runPipelineQueue(items, limit, worker) {
    var list = Array.isArray(items) ? items : [];
    var max = Math.max(1, Math.min(Number(limit) || 1, list.length || 1));
    var index = 0;
    var results = new Array(list.length);
    function next() {
      if (index >= list.length) return Promise.resolve();
      var currentIndex = index;
      index += 1;
      return Promise.resolve(worker(list[currentIndex], currentIndex))
        .then(function(result) {
          results[currentIndex] = result;
        })
        .catch(function(err) {
          results[currentIndex] = {
            error: err && err.message ? String(err.message) : '模块生成失败',
          };
        })
        .then(next);
    }
    var workers = [];
    for (var i = 0; i < max; i += 1) workers.push(next());
    return Promise.all(workers).then(function() { return results; });
  }

  function updatePipelineStage(scene, taskId, patch, action) {
    var current = readTask(scene);
    if (!current || current.id !== taskId || current.status !== 'running') return null;
    var next = Object.assign({}, current, patch || {});
    return writeTask(scene, next, action || 'pipeline');
  }

  function buildFinalPipelineOutput(moduleResults) {
    var missing = [];
    var existing = [];
    (Array.isArray(moduleResults) ? moduleResults : []).forEach(function(result) {
      if (!result || result.error || !result.module) return;
      var cases = Array.isArray(result.cases) ? result.cases : [];
      if (!cases.length) return;
      var target = result.missing === true ? missing : existing;
      target.push({
        module: result.module,
        coverage: Number.isFinite(Number(result.coverage)) ? Number(result.coverage) : 0,
        cases: cases,
      });
    });
    return JSON.stringify({
      missing_modules: missing,
      existing_modules: existing,
      xmind_external_pipeline: {
        enabled: true,
        mode: 'append_all_modules_cases',
        missing_module_count: missing.length,
        existing_module_count: existing.length,
      },
    });
  }

  function runXmindExternalPipeline(scene, task, model) {
    var pipeline = task && task.xmindPipeline && task.xmindPipeline.enabled === true
      ? task.xmindPipeline
      : null;
    if (!pipeline || !pipeline.root || !pipeline.root.userText) {
      return Promise.resolve(callModel(model, resolveUserText(task), task.prompt || '', task.reasoning || '', task.temperature));
    }
    updatePipelineStage(scene, task.id, {
      pipelineStage: 'discovery',
      pipelineStatusText: '正在按 XMind pipeline 发现模块',
    }, 'pipeline-discovery');
    return callModel(
      model,
      String(pipeline.root.userText || ''),
      String(pipeline.root.prompt || task.prompt || ''),
      task.reasoning || '',
      task.temperature
    ).then(function(rootContent) {
      if (isLegacyCasePageGenerationOutput(rootContent)) return rootContent;
      var discoveryModules = normalizePipelineModulesFromContent(rootContent);
      var descriptors = buildPipelineDescriptors(pipeline, discoveryModules);
      if (!descriptors.length) {
        return buildFinalPipelineOutput(discoveryModules.map(function(item) {
          return {
            missing: item && item.missing === true,
            module: item && item.module ? item.module : '',
            coverage: item && Number.isFinite(Number(item.coverage)) ? Number(item.coverage) : 0,
            cases: item && Array.isArray(item.cases) ? item.cases : [],
          };
        }));
      }
      updatePipelineStage(scene, task.id, {
        pipelineStage: 'modules',
        pipelineStatusText: '正在按模块补强用例',
        pipelineModuleTotal: descriptors.length,
        pipelineModuleDone: 0,
      }, 'pipeline-modules');
      return runPipelineQueue(descriptors, pipeline.moduleConcurrency || 4, function(descriptor) {
        var contract = buildPipelineContract(descriptor.action, descriptor.module);
        var moduleEntry = {
          module: descriptor.module,
          moduleKey: descriptor.moduleKey,
          visible_cases: descriptor.visibleCases || [],
          discovery_module: descriptor.discoveryModule || null,
        };
        var userPayload = buildPipelineStagePayload(pipeline, contract, 'module', moduleEntry, discoveryModules);
        return callModel(
          model,
          JSON.stringify(userPayload, null, 2),
          buildPipelinePrompt(pipeline, contract),
          task.reasoning || '',
          task.temperature
        ).then(function(moduleContent) {
          var modules = normalizePipelineModulesFromContent(moduleContent);
          var target = findPipelineModuleByKey(modules, descriptor.moduleKey);
          if (!target && modules.length === 1) target = modules[0];
          var fallbackCases = descriptor.discoveryModule && Array.isArray(descriptor.discoveryModule.cases)
            ? descriptor.discoveryModule.cases
            : [];
          var cases = target && Array.isArray(target.cases) && target.cases.length
            ? target.cases
            : fallbackCases;
          var latest = readTask(scene);
          if (latest && latest.id === task.id && latest.status === 'running') {
            latest.pipelineModuleDone = Number(latest.pipelineModuleDone || 0) + 1;
            latest.updatedAt = Date.now();
            writeTask(scene, latest, 'pipeline-module-done');
          }
          return {
            missing: descriptor.missing === true,
            module: descriptor.module,
            coverage: target && Number.isFinite(Number(target.coverage)) ? Number(target.coverage) : 0,
            cases: cases,
          };
        });
      }).then(function(moduleResults) {
        return buildFinalPipelineOutput(moduleResults);
      });
    });
  }

  function isTransientFetchError(err) {
    if (!err) return false;
    var msg = err && err.message ? String(err.message) : String(err || '');
    if (!msg) return false;
    if (msg.indexOf('Failed to fetch') !== -1) return true;
    if (msg.indexOf('NetworkError') !== -1) return true;
    return false;
  }

  function isModelTimeoutError(err) {
    if (!err) return false;
    var msg = err && err.message ? String(err.message) : String(err || '');
    if (!msg) return false;
    return msg.indexOf('模型调用超时') !== -1;
  }

  function shouldSuspendForNavigation(err) {
    if (pageUnloading) return true;
    if (!err) return false;
    if (err.name === 'AbortError') return true;
    var msg = err && err.message ? String(err.message) : String(err || '');
    if (msg.indexOf('AbortError') !== -1) return true;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      if (isTransientFetchError(err)) return true;
      if (isModelTimeoutError(err)) return true;
      return false;
    }
    return false;
  }

  function isTaskStale(task) {
    if (!task) return true;
    var heartbeat = Number(task.heartbeatAt || 0);
    if (!heartbeat) return true;
    return Date.now() - heartbeat > staleMs;
  }

  function shouldTakeover(task) {
    if (!task || task.status !== 'running') return false;
    if (!task.runnerId || task.runnerId === runnerId) return true;
    return isTaskStale(task);
  }

  function startHeartbeat(scene, task) {
    if (!scene || !task) return function() {};
    var timer = setInterval(function() {
      var current = readTask(scene);
      if (!current || current.id !== task.id || current.status !== 'running') {
        clearInterval(timer);
        return;
      }
      if (current.runnerId && current.runnerId !== runnerId) {
        clearInterval(timer);
        return;
      }
      current.runnerId = runnerId;
      current.heartbeatAt = Date.now();
      current.updatedAt = current.heartbeatAt;
      writeTask(scene, current, 'heartbeat');
    }, heartbeatIntervalMs);
    return function stopHeartbeat() {
      clearInterval(timer);
    };
  }

  function runTask(scene, task) {
    if (!scene || !task) return Promise.resolve(null);
    if (runningMap[scene] && runningMap[scene].taskId === task.id) {
      return runningMap[scene].promise;
    }
    var stopHeartbeat = startHeartbeat(scene, task);
    var promise = Promise.resolve()
      .then(function() {
        var current = readTask(scene);
        if (!current || current.id !== task.id) return null;
        var model = current.model;
        if (!model || !model.baseUrl || !model.model) {
          throw new Error('未找到易漏用例推荐模型');
        }
        var userText = resolveUserText(current);
        if (!userText) {
          throw new Error('推荐上下文缺失');
        }
        return callModel(model, userText, current.prompt || '', current.reasoning || '', current.temperature);
      })
      .then(function(content) {
        var current = readTask(scene);
        if (!current || current.id !== task.id) return null;
        if (current.runnerId && current.runnerId !== runnerId) return null;
        var ids = parseTaskIds(content);
        current.status = 'done';
        current.resultIds = ids;
        current.error = '';
        current.updatedAt = Date.now();
        current.endedAt = current.updatedAt;
        current.heartbeatAt = 0;
        writeTask(scene, current, 'done');
        return current;
      })
      .catch(function(err) {
        var current = readTask(scene);
        if (!current || current.id !== task.id) return null;
        if (current.runnerId && current.runnerId !== runnerId) return null;
        var msg = err && err.message ? err.message : String(err || '');
        if (shouldSuspendForNavigation(err)) {
          current.status = 'running';
          current.error = '';
          current.runnerId = '';
          current.heartbeatAt = 0;
          current.updatedAt = Date.now();
          writeTask(scene, current, 'suspend');
          return current;
        }
        if (isTransientFetchError(err)) {
          current.retryCount = Number(current.retryCount || 0) + 1;
          if (current.retryCount <= 2) {
            current.status = 'running';
            current.error = '';
            current.runnerId = '';
            current.heartbeatAt = 0;
            current.updatedAt = Date.now();
            writeTask(scene, current, 'retry');
            return current;
          }
        }
        current.status = 'error';
        current.error = msg ? ('AI 推荐失败：' + msg) : 'AI 推荐失败';
        current.updatedAt = Date.now();
        current.endedAt = current.updatedAt;
        current.heartbeatAt = 0;
        writeTask(scene, current, 'error');
        return current;
      })
      .finally(function() {
        stopHeartbeat();
        if (runningMap[scene] && runningMap[scene].taskId === task.id) {
          delete runningMap[scene];
        }
      });
    runningMap[scene] = { taskId: task.id, promise: promise };
    return promise;
  }

  function startTask(scene, task, options) {
    if (!scene) return Promise.resolve(null);
    var active = task ? createTask(scene, task) : readTask(scene);
    if (!active) return Promise.resolve(null);
    if (active.status !== 'running') return Promise.resolve(active);
    if (!options || options.force !== true) {
      if (!shouldTakeover(active)) {
        if (!takeoverTimers[scene]) {
          takeoverTimers[scene] = setTimeout(function() {
            takeoverTimers[scene] = null;
            var latest = readTask(scene);
            if (latest && latest.status === 'running') {
              startTask(scene, latest);
            }
          }, staleMs);
        }
        return Promise.resolve(active);
      }
    }
    active.runnerId = runnerId;
    active.heartbeatAt = Date.now();
    writeTask(scene, active, 'start');
    return runTask(scene, active);
  }

  function resumeTasks(options) {
    ['case-library', 'temp-exec'].forEach(function(scene) {
      var task = readTask(scene);
      if (task && task.status === 'running') {
        startTask(scene, task, options);
      }
    });
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', function(e) {
      var key = e && e.key ? String(e.key) : '';
      if (!key || key.indexOf(storagePrefix) !== 0) return;
      var scene = key.slice(storagePrefix.length);
      emitTaskUpdate(scene, readTask(scene), 'storage');
    });
  }

  return {
    createTask: createTask,
    startTask: startTask,
    getTask: readTask,
    updateTask: updateTask,
    clearTask: clearTask,
    resumeTasks: resumeTasks,
    buildTaskId: buildTaskId,
    normalizeModelSnapshot: normalizeModelSnapshot,
  };
}

  return {
    init: initMissingReminderAiManager,
  };
});

