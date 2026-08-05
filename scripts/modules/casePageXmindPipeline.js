(function(factory) {
  var cloneJson = typeof module !== 'undefined' && module.exports
    ? require('../core/jsonCloneCore.js').cloneJson
    : window.app.jsonCloneCore.cloneJson;
  var api = factory(cloneJson);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.casePageXmindPipeline = api;
  }
})(function(cloneJson) {
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

  function tryParseJson(text) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function parseJsonPayload(text) {
    var raw = stripCodeFence(text || '');
    if (!raw) return null;
    var direct = tryParseJson(raw);
    if (direct !== null) return direct;
    var start = raw.indexOf('{');
    var end = raw.lastIndexOf('}');
    var objectPayload = start >= 0 && end > start ? tryParseJson(raw.slice(start, end + 1)) : null;
    if (objectPayload !== null) return objectPayload;
    var arrStart = raw.indexOf('[');
    var arrEnd = raw.lastIndexOf(']');
    return arrStart >= 0 && arrEnd > arrStart ? tryParseJson(raw.slice(arrStart, arrEnd + 1)) : null;
  }

  function normalizeCase(raw, fallbackModule) {
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

  function normalizeModulesFromContent(content) {
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
          return normalizeCase(caseItem, moduleName);
        }).filter(Boolean),
      };
    }).filter(Boolean);
  }

  function isLegacyOutput(content) {
    var payload = parseJsonPayload(content);
    return Boolean(
      payload
      && typeof payload === 'object'
      && Array.isArray(payload.missing_modules)
      && Array.isArray(payload.existing_modules)
    );
  }

  function buildContract(mode, moduleName) {
    var moduleMode = mode === 'module_append_cases' || mode === 'module_full_cases';
    if (moduleMode) {
      return {
        scope: 'module',
        mode: mode,
        targetModule: normalizeFlatText(moduleName || ''),
        allowNewModules: false,
        generateCasesForNewModules: false,
        generateCasesForExistingModules: true,
        dedupeAgainstVisibleModules: false,
        dedupeAgainstVisibleCases: mode === 'module_append_cases',
      };
    }
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

  function buildPrompt(promptBase, contract) {
    var parts = [String(promptBase || '').trim()];
    parts.push('operation_contract(JSON)：' + JSON.stringify(contract || {}));
    return parts.filter(Boolean).join('\n\n');
  }

  function buildStagePayload(basePayload, contract, visibleModules, stage, moduleEntry, discoveryModules, pipelineMode) {
    var payload = cloneJson(basePayload || {}, {});
    payload.operation_contract = cloneJson(contract || {}, {});
    payload.current_visible_modules = cloneJson(visibleModules || [], []);
    payload.current_ai_generation_layer = cloneJson(discoveryModules || [], []);
    payload.xmind_external_pipeline = {
      enabled: true,
      version: 1,
      stage: stage || 'module',
      pipeline: pipelineMode ? String(pipelineMode) : 'append_all_modules_cases',
      root_mode: 'append_all_modules_cases',
      module_mode: contract && contract.mode ? String(contract.mode || '') : '',
      output_contract: 'xmind_modules',
      final_output_scope: 'new_cases_only',
      model_assignment_policy: 'use_case_library_generation_model',
      protect_original_cases: true,
    };
    if (moduleEntry) payload.current_operation_module = cloneJson(moduleEntry, {});
    return payload;
  }

  function findModuleByKey(modules, key) {
    var targetKey = String(key || '');
    var list = Array.isArray(modules) ? modules : [];
    for (var i = 0; i < list.length; i += 1) {
      if (normalizeModuleKey(list[i] && list[i].module) === targetKey) return list[i];
    }
    return null;
  }

  function buildDescriptors(pipeline, discoveryModules) {
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
        discoveryModule: findModuleByKey(discoveryModules, key),
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

  function buildFinalOutput(moduleResults) {
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

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var callModel = typeof opts.callModel === 'function'
      ? opts.callModel
      : function() { return Promise.reject(new Error('模型客户端不可用，请刷新页面后重试')); };
    var getTask = typeof opts.getTask === 'function' ? opts.getTask : function() { return null; };
    var updateTask = typeof opts.updateTask === 'function' ? opts.updateTask : function() { return null; };

    function runQueue(items, limit, worker) {
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

    function updateStage(scene, taskId, patch, action) {
      var current = getTask(scene);
      if (!current || current.id !== taskId || current.status !== 'running') return null;
      return updateTask(scene, patch || {}, action || 'pipeline');
    }

    function run(context) {
      var execution = context && typeof context === 'object' ? context : {};
      var task = execution.task && typeof execution.task === 'object' ? execution.task : {};
      var pipeline = task.xmindPipeline && task.xmindPipeline.enabled === true ? task.xmindPipeline : null;
      var model = execution.model || task.model || null;
      var userText = execution.userText || '';
      if (!pipeline || !pipeline.root || !pipeline.root.userText) {
        return Promise.resolve(callModel(model, userText, task.prompt || '', task.reasoning || '', task.temperature));
      }
      updateStage(execution.scene, task.id, {
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
        if (isLegacyOutput(rootContent)) return rootContent;
        var discoveryModules = normalizeModulesFromContent(rootContent);
        var descriptors = buildDescriptors(pipeline, discoveryModules);
        if (!descriptors.length) {
          return buildFinalOutput(discoveryModules.map(function(item) {
            return {
              missing: item && item.missing === true,
              module: item && item.module ? item.module : '',
              coverage: item && Number.isFinite(Number(item.coverage)) ? Number(item.coverage) : 0,
              cases: item && Array.isArray(item.cases) ? item.cases : [],
            };
          }));
        }
        updateStage(execution.scene, task.id, {
          pipelineStage: 'modules',
          pipelineStatusText: '正在按模块补强用例',
          pipelineModuleTotal: descriptors.length,
          pipelineModuleDone: 0,
        }, 'pipeline-modules');
        return runQueue(descriptors, pipeline.moduleConcurrency || 4, function(descriptor) {
          var contract = buildContract(descriptor.action, descriptor.module);
          var moduleEntry = {
            module: descriptor.module,
            moduleKey: descriptor.moduleKey,
            visible_cases: descriptor.visibleCases || [],
            discovery_module: descriptor.discoveryModule || null,
          };
          var userPayload = buildStagePayload(
            pipeline.basePayload,
            contract,
            pipeline.visibleModules,
            'module',
            moduleEntry,
            discoveryModules,
            pipeline.mode
          );
          return callModel(
            model,
            JSON.stringify(userPayload, null, 2),
            buildPrompt(pipeline.promptBase, contract),
            task.reasoning || '',
            task.temperature
          ).then(function(moduleContent) {
            var modules = normalizeModulesFromContent(moduleContent);
            var target = findModuleByKey(modules, descriptor.moduleKey);
            if (!target && modules.length === 1) target = modules[0];
            var fallbackCases = descriptor.discoveryModule && Array.isArray(descriptor.discoveryModule.cases)
              ? descriptor.discoveryModule.cases
              : [];
            var cases = target && Array.isArray(target.cases) && target.cases.length
              ? target.cases
              : fallbackCases;
            var latest = getTask(execution.scene);
            if (latest && latest.id === task.id && latest.status === 'running') {
              updateTask(execution.scene, {
                pipelineModuleDone: Number(latest.pipelineModuleDone || 0) + 1,
              }, 'pipeline-module-done');
            }
            return {
              missing: descriptor.missing === true,
              module: descriptor.module,
              coverage: target && Number.isFinite(Number(target.coverage)) ? Number(target.coverage) : 0,
              cases: cases,
            };
          });
        }).then(function(moduleResults) {
          return buildFinalOutput(moduleResults);
        });
      });
    }

    return { run: run };
  }

  return {
    create: create,
    cloneJson: cloneJson,
    normalizeText: normalizeText,
    normalizePriority: normalizePriority,
    parseJsonPayload: parseJsonPayload,
    buildContract: buildContract,
    buildPrompt: buildPrompt,
    buildStagePayload: buildStagePayload,
    normalizeModulesFromContent: normalizeModulesFromContent,
    isLegacyOutput: isLegacyOutput,
    buildDescriptors: buildDescriptors,
    buildFinalOutput: buildFinalOutput,
  };
});
