(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.aiGenTaskRunner = api;
  }
})(function() {
  function createRunnerError(code, message, cause) {
    var error = new Error(message);
    error.code = code;
    if (cause) error.cause = cause;
    return error;
  }

  function cloneParsedResult(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;
    try {
      return JSON.parse(JSON.stringify(parsed));
    } catch (err) {
      return null;
    }
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var aiGenModel = opts.model;
    if (!aiGenModel || typeof aiGenModel.parseResult !== 'function') {
      throw new Error('case library AI generation task runner model is required');
    }
    var getManager = typeof opts.getManager === 'function' ? opts.getManager : function() { return null; };
    var getCore = typeof opts.getCore === 'function' ? opts.getCore : function() { return null; };
    var getPrepApi = typeof opts.getPrepApi === 'function' ? opts.getPrepApi : function() { return null; };
    var getAssignments = typeof opts.getAssignments === 'function' ? opts.getAssignments : function() { return {}; };
    var appendPrompt = typeof opts.appendPrompt === 'function' ? opts.appendPrompt : function(value) { return value || ''; };
    var getDefaultPrompt = typeof opts.getDefaultPrompt === 'function' ? opts.getDefaultPrompt : function() { return ''; };
    var resolveCoverageThreshold = typeof opts.resolveCoverageThreshold === 'function'
      ? opts.resolveCoverageThreshold
      : function() { return 90; };
    var now = typeof opts.now === 'function' ? opts.now : Date.now;
    var random = typeof opts.random === 'function' ? opts.random : Math.random;
    var pendingByTaskId = Object.create(null);
    var resultByTaskId = Object.create(null);
    var revisionByTaskId = Object.create(null);

    function getRunningConflict(currentFileId) {
      var manager = getManager();
      if (!manager || typeof manager.getTask !== 'function') return null;
      var task = manager.getTask('case-library');
      if (!task || task.status !== 'running') return null;
      var activeFileId = task.caseFileId ? String(task.caseFileId) : '';
      var currentId = currentFileId ? String(currentFileId) : '';
      if (!activeFileId || !currentId) return null;
      if (activeFileId === currentId) {
        return { type: 'same-file', task: task };
      }
      return {
        type: 'other-file',
        task: task,
        fileName: task.caseFileName ? String(task.caseFileName) : '',
      };
    }

    function resolveAssignedModel(coreApi) {
      if (!coreApi || typeof coreApi.callModelWithConfig !== 'function'
        || typeof coreApi.getAssignedModel !== 'function') {
        throw createRunnerError('client-unavailable', '模型客户端不可用，请刷新页面后重试');
      }
      try {
        return coreApi.getAssignedModel('caselibrarygen');
      } catch (err) {
        throw createRunnerError('no-model', '请配置用例库 AI 生成功能模型', err);
      }
    }

    function buildXmindPipeline(prepApi, prepContext, caseFile, requirementText, moduleList, casePayload, threshold) {
      if (!prepContext || !prepApi || typeof prepApi.buildXmindEnhancedPipelineRequest !== 'function') return null;
      return prepApi.buildXmindEnhancedPipelineRequest({
        scene: 'case-library',
        caseFileId: caseFile.id || '',
        displayName: caseFile.file_name_clean || caseFile.name || '',
        projectId: caseFile.project_id || caseFile.projectId || '',
        versionId: caseFile.version_id || caseFile.versionId || '',
        requirementText: requirementText,
        moduleList: moduleList,
        existingCases: casePayload,
        coverageThreshold: threshold,
      }, prepContext);
    }

    function prepare(input) {
      var source = input && typeof input === 'object' ? input : {};
      var caseFile = source.caseFile && typeof source.caseFile === 'object' ? source.caseFile : null;
      if (!caseFile) throw createRunnerError('no-case', '请先选择查看&编辑用例');
      var requirementText = source.requirementText === null || source.requirementText === undefined
        ? ''
        : String(source.requirementText);
      var requirementFileName = source.requirementFileName === null || source.requirementFileName === undefined
        ? ''
        : String(source.requirementFileName);
      var items = Array.isArray(source.items) ? source.items : [];
      var prepContext = source.prepContext || null;
      var coreApi = getCore();
      var assignedModel = resolveAssignedModel(coreApi);
      var moduleList = aiGenModel.buildModuleList(items);
      var casePayload = aiGenModel.buildCasePayload(items);
      var threshold = resolveCoverageThreshold();
      var assignments = getAssignments() || {};
      var prompt = assignments.caseLibraryGenPrompt || getDefaultPrompt() || '';
      prompt = appendPrompt(prompt);
      var prepApi = getPrepApi();
      if (prepContext && prepApi && typeof prepApi.enrichPrompt === 'function') {
        prompt = prepApi.enrichPrompt(prompt, prepContext);
      }
      var reasoning = assignments.caseLibraryGenReasoning || '';
      var temperature = assignments.caseLibraryGenTemperature !== undefined
        ? assignments.caseLibraryGenTemperature
        : 0.2;
      var userPayload = {
        requirement_text: requirementText,
        module_list: moduleList,
        existing_cases: casePayload,
        coverage_threshold: threshold,
      };
      if (prepContext && prepApi && typeof prepApi.enrichPayload === 'function') {
        userPayload = prepApi.enrichPayload(userPayload, prepContext);
      }
      var userText = JSON.stringify(userPayload, null, 2);
      var xmindPipeline = buildXmindPipeline(
        prepApi,
        prepContext,
        caseFile,
        requirementText,
        moduleList,
        casePayload,
        threshold
      );
      if (xmindPipeline && xmindPipeline.enabled === true && xmindPipeline.root) {
        prompt = xmindPipeline.root.prompt || prompt;
        userText = xmindPipeline.root.userText || userText;
      }
      var signature = aiGenModel.buildSignature(caseFile.id, requirementText, moduleList, prepContext);
      var runToken = 'local-' + now().toString(36) + '-' + random().toString(36).slice(2, 6);
      var generationMode = aiGenModel.resolveGenerationMode(prepContext);
      return {
        caseFile: caseFile,
        items: items,
        requirementText: requirementText,
        requirementFileName: requirementFileName,
        prepContext: prepContext,
        prepApi: prepApi,
        coreApi: coreApi,
        assignedModel: assignedModel,
        moduleList: moduleList,
        coverageThreshold: threshold,
        prompt: prompt,
        reasoning: reasoning,
        temperature: temperature,
        userText: userText,
        xmindPipeline: xmindPipeline,
        signature: signature,
        runToken: runToken,
        generationMode: generationMode,
      };
    }

    function createTaskPayload(prepared) {
      var caseFile = prepared.caseFile;
      return {
        contextSignature: prepared.signature,
        caseFileId: caseFile.id || null,
        caseFileName: caseFile.file_name_clean || '',
        projectId: caseFile.project_id || null,
        versionId: caseFile.version_id || null,
        requirementText: prepared.requirementText,
        requirementFileName: prepared.requirementFileName,
        moduleList: prepared.moduleList,
        coverageThreshold: prepared.coverageThreshold,
        model: prepared.assignedModel,
        prompt: prepared.prompt,
        reasoning: prepared.reasoning,
        temperature: prepared.temperature,
        userText: prepared.userText,
        xmindPipeline: prepared.xmindPipeline && prepared.xmindPipeline.enabled === true
          ? prepared.xmindPipeline
          : null,
        prepContext: prepared.prepContext,
      };
    }

    function start(prepared, startOptions) {
      var executionOptions = startOptions && typeof startOptions === 'object' ? startOptions : {};
      var manager = getManager();
      if (manager && typeof manager.createTask === 'function' && typeof manager.startTask === 'function') {
        var task = manager.createTask('case-library', createTaskPayload(prepared));
        manager.startTask('case-library', task);
        return { mode: 'managed', task: task, resultToken: task && task.id ? String(task.id) : prepared.runToken };
      }
      var promise = Promise.resolve()
        .then(function() {
          return prepared.coreApi.callModelWithConfig(
            prepared.assignedModel,
            prepared.userText,
            prepared.prompt,
            prepared.reasoning,
            prepared.temperature
          );
        })
        .then(function(content) {
          var parsed = aiGenModel.parseResult(content);
          if (!parsed || parsed.error || !prepared.prepContext || !prepared.prepApi
            || typeof prepared.prepApi.applyAiDedupeToParsed !== 'function') {
            return parsed;
          }
          if (typeof executionOptions.onDedupeStart === 'function') executionOptions.onDedupeStart();
          var sourceCases = typeof executionOptions.getSourceCases === 'function'
            ? executionOptions.getSourceCases()
            : prepared.items;
          return prepared.prepApi.applyAiDedupeToParsed(parsed, sourceCases || [], prepared.prepContext, {
            model: prepared.assignedModel,
            reasoning: prepared.reasoning,
            temperature: prepared.temperature,
            callModelWithConfig: prepared.coreApi.callModelWithConfig,
          });
        });
      return { mode: 'direct', promise: promise, resultToken: prepared.runToken };
    }

    function persistSemanticDedupeResult(task, parsed, errorText) {
      if (!task || !task.id) return;
      var manager = getManager();
      if (!manager || typeof manager.updateTask !== 'function') return;
      var snapshot = cloneParsedResult(parsed);
      if (!snapshot) return;
      manager.updateTask('case-library', {
        semanticDedupeResult: snapshot,
        semanticDedupeCompletedAt: now(),
        semanticDedupeError: errorText ? String(errorText) : '',
      }, 'semantic-dedupe');
    }

    function resolveManagedResult(task, context) {
      if (!task || !task.resultRaw) return null;
      if (task.semanticDedupeResult && typeof task.semanticDedupeResult === 'object') {
        return { kind: 'ready', parsed: task.semanticDedupeResult };
      }
      var taskId = task.id ? String(task.id) : '';
      if (taskId && resultByTaskId[taskId]) {
        return { kind: 'ready', parsed: resultByTaskId[taskId] };
      }
      var parsed;
      try {
        parsed = aiGenModel.parseResult(task.resultRaw);
      } catch (err) {
        parsed = { error: err && err.message ? err.message : '解析失败' };
      }
      var resolveContext = context && typeof context === 'object' ? context : {};
      var prepApi = getPrepApi();
      var coreApi = getCore();
      var canDedupe = Boolean(
        parsed && !parsed.error && task.prepContext && taskId
        && prepApi && typeof prepApi.applyAiDedupeToParsed === 'function'
        && coreApi && typeof coreApi.callModelWithConfig === 'function'
      );
      if (!canDedupe) return { kind: 'ready', parsed: parsed };
      if (pendingByTaskId[taskId]) {
        return { kind: 'pending', promise: pendingByTaskId[taskId], started: false, semanticDedupe: true };
      }
      var sourceCases = Array.isArray(resolveContext.sourceCases) ? resolveContext.sourceCases : [];
      var revision = Number(revisionByTaskId[taskId] || 0);
      var promise = Promise.resolve()
        .then(function() {
          return prepApi.applyAiDedupeToParsed(parsed, sourceCases, task.prepContext, {
            model: task.model,
            reasoning: task.reasoning || '',
            temperature: task.temperature,
            callModelWithConfig: coreApi.callModelWithConfig,
          });
        })
        .then(function(nextParsed) {
          if (Number(revisionByTaskId[taskId] || 0) === revision) {
            resultByTaskId[taskId] = nextParsed;
            persistSemanticDedupeResult(task, nextParsed, '');
          }
          return nextParsed;
        })
        .catch(function() {
          if (Number(revisionByTaskId[taskId] || 0) === revision) {
            resultByTaskId[taskId] = parsed;
            persistSemanticDedupeResult(task, parsed, 'AI 语义去重失败');
          }
          return parsed;
        })
        .finally(function() {
          if (pendingByTaskId[taskId] === promise) delete pendingByTaskId[taskId];
          if (!pendingByTaskId[taskId] && !resultByTaskId[taskId]
            && Number(revisionByTaskId[taskId] || 0) !== revision) {
            delete revisionByTaskId[taskId];
          }
        });
      pendingByTaskId[taskId] = promise;
      return { kind: 'pending', promise: promise, started: true, semanticDedupe: true };
    }

    function clear(taskId) {
      if (!taskId) return;
      var key = String(taskId);
      if (pendingByTaskId[key]) {
        revisionByTaskId[key] = Number(revisionByTaskId[key] || 0) + 1;
      } else {
        delete revisionByTaskId[key];
      }
      delete pendingByTaskId[key];
      delete resultByTaskId[key];
    }

    return {
      getRunningConflict: getRunningConflict,
      prepare: prepare,
      createTaskPayload: createTaskPayload,
      start: start,
      resolveManagedResult: resolveManagedResult,
      clear: clear,
    };
  }

  return {
    create: create,
    cloneParsedResult: cloneParsedResult,
  };
});
