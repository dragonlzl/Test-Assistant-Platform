(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenTaskInputController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var state = opts.state || {};
    var config = opts.config || {};
    var xmindGenApi = opts.xmindGenApi || {};
    var dedupeStrength = String(opts.dedupeStrength || 'conservative');
    var cloneJson = port('cloneJson', function(value, fallback) { return value === undefined ? fallback : value; });
    var normalizeArrayField = port('normalizeArrayField', function(value) { return Array.isArray(value) ? value : []; });
    var normalizeHistoryDiagnostics = port('normalizeHistoryDiagnostics', function(value) { return Array.isArray(value) ? value : []; });
    var extractJsonPayloadDetailed = port('extractJsonPayloadDetailed', function() { return null; });
    var buildXmindGenerationOptionsSnapshot = port('buildXmindGenerationOptionsSnapshot', function() { return {}; });
    var isRootFullGenerationContract = port('isRootFullGenerationContract', function() { return false; });
    var buildXmindPrompt = port('buildXmindPrompt', function() { return ''; });
    var buildRequirementPayload = port('buildRequirementPayload', function() {
      return Promise.resolve({ mode: 'document', text: '', images: [] });
    });
    var modelSupportsVision = port('modelSupportsVision', function() { return false; });
    var getActiveWorkspaceId = port('getActiveWorkspaceId', function() { return ''; });
    var buildImageContentBlocks = port('buildImageContentBlocks', function() {
      return Promise.resolve({ stats: { sent: 0 }, blocks: [] });
    });
    var runKnowledgeBasePipelineForGeneration = port('runKnowledgeBasePipelineForGeneration', function() {
      return Promise.resolve(null);
    });
    var getSelectedRequirementSource = port('getSelectedRequirementSource', function() { return {}; });
    var getPrepState = port('getPrepState', function() { return {}; });
    var getRequirementLabelText = port('getRequirementLabelText', function() { return ''; });
    var getXmindCaseDedupeCoreApi = port('getXmindCaseDedupeCoreApi', function() { return null; });
    var getXmindDedupeBatchCoreApi = port('getXmindDedupeBatchCoreApi', function() { return null; });
    var normalizeDedupeMode = port('normalizeDedupeMode', function(value) { return value || 'dedupe_only'; });
    var getDedupeModeFromSettings = port('getDedupeModeFromSettings', function() { return 'dedupe_only'; });
    var getXmindRequirementCoverageCoreApi = port('getXmindRequirementCoverageCoreApi', function() { return null; });
    var buildVisibleModuleContext = port('buildVisibleModuleContext', function() { return { list: [] }; });
    var buildVisibleModuleSnapshot = port('buildVisibleModuleSnapshot', function() { return []; });
    var getTaskWorkspaceId = port('getTaskWorkspaceId', function() { return ''; });

    function extractNamedSectionText(text, title) {
      var source = String(text || '');
      var marker = '【' + String(title || '').trim() + '】';
      if (!marker || marker === '【】') return '';
      var start = source.indexOf(marker);
      if (start === -1) return '';
      var rest = source.slice(start + marker.length);
      if (rest.charAt(0) === '\n') rest = rest.slice(1);
      var nextIndex = rest.indexOf('\n\n【');
      if (nextIndex === -1) nextIndex = rest.indexOf('\n【');
      if (nextIndex !== -1) rest = rest.slice(0, nextIndex);
      return String(rest || '').trim();
    }

    function parseJsonSectionText(text) {
      var extracted = extractJsonPayloadDetailed(text);
      return extracted && extracted.payload && typeof extracted.payload === 'object'
        ? extracted.payload
        : null;
    }

    function parseTaskGenerationOptions(task) {
      var requestText = task && task.requestText ? String(task.requestText || '') : '';
      var sectionText = extractNamedSectionText(requestText, '本轮生成选项(JSON)');
      var parsed = parseJsonSectionText(sectionText);
      if (!parsed || typeof parsed !== 'object') return buildXmindGenerationOptionsSnapshot();
      return {
        customRequirement: String(parsed.customRequirement || '').trim(),
        needFunctionCondition: parsed.needFunctionCondition === true,
        needNumericValidation: parsed.needNumericValidation === true,
        needBoundary: parsed.needBoundary === true,
        needMobile: parsed.needMobile === true,
        needSpecial: parsed.needSpecial === true,
        specialRepeatOperation: parsed.specialRepeatOperation === true,
        specialMultiTouch: parsed.specialMultiTouch === true,
        specialRepeatExecution: parsed.specialRepeatExecution === true,
        specialWeakNetwork: parsed.specialWeakNetwork === true,
        specialInterruptResume: parsed.specialInterruptResume === true,
      };
    }

    function buildTaskRequirementCoverageText(task) {
      var requestText = task && task.requestText ? String(task.requestText || '') : '';
      var parts = [];
      ['需求标识', '需求正文', '需求补充', '手填需求描述'].forEach(function(title) {
        var sectionText = extractNamedSectionText(requestText, title);
        if (sectionText) parts.push(sectionText);
      });
      return String(parts.join('\n') || '').replace(/\s+/g, ' ').trim();
    }

    function flattenModulesForCoverageText(modules) {
      var parts = [];
      (Array.isArray(modules) ? modules : []).forEach(function(item) {
        if (!item || typeof item !== 'object') return;
        if (item.module) parts.push(String(item.module || ''));
        normalizeArrayField(item.key_scenarios).forEach(function(text) { parts.push(String(text || '')); });
        normalizeArrayField(item.test_points).forEach(function(text) { parts.push(String(text || '')); });
        normalizeArrayField(item.coupled_modules).forEach(function(text) { parts.push(String(text || '')); });
        (Array.isArray(item.cases) ? item.cases : []).forEach(function(caseItem) {
          if (!caseItem || typeof caseItem !== 'object') return;
          if (caseItem.title) parts.push(String(caseItem.title || ''));
          if (caseItem.preconditions) parts.push(String(caseItem.preconditions || ''));
          (Array.isArray(caseItem.steps) ? caseItem.steps : []).forEach(function(step) {
            parts.push(String(step || ''));
          });
          if (caseItem.expected) parts.push(String(caseItem.expected || ''));
        });
      });
      return String(parts.join('\n') || '').replace(/\s+/g, ' ').trim();
    }

    function textMatchesAnyPattern(text, patterns) {
      var source = String(text || '').replace(/\s+/g, ' ').trim();
      if (!source) return false;
      var list = Array.isArray(patterns) ? patterns : [];
      for (var i = 0; i < list.length; i += 1) {
        if (list[i] && list[i].test(source)) return true;
      }
      return false;
    }

    function requirementSuggestsFunctionCondition(text) {
      return textMatchesAnyPattern(text, [
        /解锁/,
        /开放条件|开启条件|使用条件|可用条件/,
        /身份|权限|等级|资格|门槛/,
        /前置任务|前置条件/,
        /资源消耗|消耗.*(次数|积分|金币|钻石|体力|道具)/,
        /时间限制|使用时间|活动期间|开放时间|时段|冷却/,
        /(达到|满足).{0,8}(后|才|方可|即可)/,
        /仅限|才可|才能|方可/,
      ]);
    }

    function outputHasFunctionConditionCoverage(text) {
      return textMatchesAnyPattern(text, [
        /解锁/,
        /开放条件|开启条件|使用条件|可用条件/,
        /身份|权限|等级|资格|门槛/,
        /前置任务/,
        /资源消耗|消耗.*(次数|积分|金币|钻石|体力|道具)/,
        /时间限制|使用时间|活动期间|开放时间|时段|冷却/,
        /(达到|满足).{0,8}(后|才|方可|即可)/,
        /仅限|才可|才能|方可/,
      ]);
    }

    function requirementSuggestsNumericCoverage(text) {
      return textMatchesAnyPattern(text, [
        /数值|数值验证/,
        /金额|价格|费用|面额/,
        /积分|经验|金币|钻石|体力|奖励/,
        /次数|频次|上限|下限|阈值|临界值|范围/,
        /累计|扣减|增加|减少|消耗/,
        /比例|概率|百分比|占比/,
        /时长|秒|分钟|小时|天/,
        /\d+\s*(元|次|秒|分钟|小时|天|级|积分|经验|金币|钻石|体力|%|％)/,
      ]);
    }

    function outputHasNumericCoverage(text) {
      return textMatchesAnyPattern(text, [
        /数值|阈值|范围|上限|下限/,
        /金额|价格|费用/,
        /积分|经验|金币|钻石|体力|奖励/,
        /次数|频次|累计|扣减|增加|减少|结算/,
        /比例|概率|百分比|占比/,
        /时长|秒|分钟|小时|天/,
        /\d+\s*(元|次|秒|分钟|小时|天|级|积分|经验|金币|钻石|体力|%|％)/,
      ]);
    }

    function evaluateRootCoverageGaps(task, modules, contract) {
      var result = {
        shouldRetry: false,
        reasonLabels: [],
        diagnostics: [],
      };
      if (!isRootFullGenerationContract(contract)) return result;
      if (Number(task && task.coverageRetryCount || 0) >= 1) return result;
      var generationOptions = parseTaskGenerationOptions(task);
      var requirementText = buildTaskRequirementCoverageText(task);
      var outputText = flattenModulesForCoverageText(modules);
      if (
        generationOptions.needFunctionCondition === true
        && requirementSuggestsFunctionCondition(requirementText)
        && !outputHasFunctionConditionCoverage(outputText)
      ) {
        result.reasonLabels.push('功能使用条件');
        result.diagnostics.push('首轮结果未体现功能使用条件相关覆盖');
      }
      if (
        generationOptions.needNumericValidation === true
        && requirementSuggestsNumericCoverage(requirementText)
        && !outputHasNumericCoverage(outputText)
      ) {
        result.reasonLabels.push('数值验证');
        result.diagnostics.push('首轮结果未体现数值验证相关覆盖');
      }
      result.shouldRetry = result.reasonLabels.length > 0;
      return result;
    }

    function buildRootCoverageRetryInstruction(gapInfo) {
      var labels = Array.isArray(gapInfo && gapInfo.reasonLabels) ? gapInfo.reasonLabels : [];
      if (!labels.length) return '';
      var lines = [];
      lines.push('你上一轮输出没有充分覆盖这些已开启要求：' + labels.join('、') + '。');
      lines.push('请基于同一份需求重新输出完整 JSON 结果，不要只返回补丁。');
      lines.push('这次必须在模块拆分、关键场景、测试要点或用例中直接体现上述覆盖点。');
      lines.push('如果需求里存在解锁、门槛、可用条件、时间限制、资源消耗、次数、阈值、范围或累计扣减，请直接体现在结果中。');
      lines.push('若确实没有任何相关覆盖点，也要在模块/test_points 中明确说明你已检查且无新增必要。');
      return lines.join('\n');
    }

    function buildRootCoverageRetryTaskPayload(task, gapInfo) {
      var retryInstruction = buildRootCoverageRetryInstruction(gapInfo);
      var requestText = String(task && task.requestText ? task.requestText : '');
      var contentBlocks = cloneJson(task && task.contentBlocks, []);
      var taskWorkspaceId = getTaskWorkspaceId(task);
      if (retryInstruction) {
        requestText += '\n\n【首轮生成补强指令】\n' + retryInstruction;
        if (Array.isArray(contentBlocks) && contentBlocks.length && contentBlocks[0]
          && contentBlocks[0].type === 'text') {
          contentBlocks[0].text = requestText;
        }
      }
      return {
        workspaceId: taskWorkspaceId,
        scope: 'root',
        actionId: String(task && task.actionId ? task.actionId : ''),
        snapshotId: String(task && task.snapshotId ? task.snapshotId : ''),
        contract: cloneJson(task && task.contract, {}),
        historyActionLabel: String(task && task.historyActionLabel ? task.historyActionLabel : ''),
        hadAiContentBeforeAction: task && task.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: task && task.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: task && task.hadAiCasesBeforeAction === true,
        prompt: String(task && task.prompt ? task.prompt : ''),
        requestMode: task && task.requestMode === 'content' ? 'content' : 'text',
        requestText: requestText,
        contentBlocks: Array.isArray(contentBlocks) ? contentBlocks : [],
        degradedToTextOnly: task && task.degradedToTextOnly === true,
        model: cloneJson(task && task.model, null),
        reasoning: String(task && task.reasoning ? task.reasoning : ''),
        temperature: Number(task && task.temperature),
        restoreContext: cloneJson(task && task.restoreContext, {}),
        retryCount: 0,
        coverageRetryCount: Number(task && task.coverageRetryCount || 0) + 1,
        coverageRetryReasons: normalizeHistoryDiagnostics(
          (task && Array.isArray(task.coverageRetryReasons) ? task.coverageRetryReasons : [])
            .concat(gapInfo && gapInfo.reasonLabels ? gapInfo.reasonLabels : [])
        ),
        parentTaskId: String(task && task.id ? task.id : ''),
        rootPipelineId: String(task && task.rootPipelineId ? task.rootPipelineId : ''),
        rootPipelineActionId: String(task && task.rootPipelineActionId ? task.rootPipelineActionId : ''),
        pipelineStage: String(task && task.pipelineStage ? task.pipelineStage : ''),
        historySuppressed: task && task.historySuppressed === true,
        notifySuppressed: task && task.notifySuppressed === true,
      };
    }

    function buildCoverageRetryHistoryDiagnostics(task) {
      var labels = task && Array.isArray(task.coverageRetryReasons)
        ? normalizeHistoryDiagnostics(task.coverageRetryReasons)
        : [];
      if (!labels.length) return [];
      return ['已自动补强覆盖：' + labels.join('、')];
    }

    function estimateTaskContentBlocksSize(blocks) {
      try {
        return JSON.stringify(Array.isArray(blocks) ? blocks : []).length;
      } catch (err) {
        return 0;
      }
    }

    function clampPositiveInteger(value, fallback, min, max) {
      var num = Math.round(Number(value));
      var safeFallback = Math.round(Number(fallback));
      var lower = Math.round(Number(min || 0));
      var upper = Math.round(Number(max || 0));
      if (!Number.isFinite(safeFallback) || safeFallback <= 0) safeFallback = 1;
      if (!Number.isFinite(num) || num <= 0) num = safeFallback;
      if (Number.isFinite(lower) && lower > 0 && num < lower) num = lower;
      if (Number.isFinite(upper) && upper > 0 && num > upper) num = upper;
      return num;
    }

    function getXmindRequestPayloadLimit() {
      var defaultSettings = config && config.defaultSettings ? config.defaultSettings : {};
      var fallback = Number(config.defaultXmindRequestPayloadLimit)
        || Number(defaultSettings.xmindRequestPayloadLimit)
        || 4000000;
      var raw = state && state.settings ? state.settings.xmindRequestPayloadLimit : null;
      return clampPositiveInteger(
        raw,
        fallback,
        Number(config.minXmindRequestPayloadLimit) || 500000,
        Number(config.maxXmindRequestPayloadLimit) || 10000000
      );
    }

    function buildXmindPayloadLimitError(payloadSize, payloadLimit) {
      return new Error(
        'XMind 请求体超出当前上限（约 '
          + String(payloadSize)
          + ' 字符，当前上限 '
          + String(payloadLimit)
          + '）。请在设置中提高 XMind 请求体上限后重试。'
      );
    }

    async function buildXmindGenerationTaskInput(contract, visibleContext, moduleEntry, options) {
      var inputOptions = options || {};
      var prompt = buildXmindPrompt(contract);
      var payload = await buildRequirementPayload(contract, visibleContext, moduleEntry, {
        visibleModulesSnapshot: inputOptions.visibleModulesSnapshot,
      });
      var model = xmindGenApi && typeof xmindGenApi.getAssignedModel === 'function'
        ? xmindGenApi.getAssignedModel('xmindcasegen')
        : null;
      var reasoning = xmindGenApi && typeof xmindGenApi.getReasoningForType === 'function'
        ? xmindGenApi.getReasoningForType('xmindcasegen')
        : '';
      var temperature = xmindGenApi && typeof xmindGenApi.getTemperatureForType === 'function'
        ? xmindGenApi.getTemperatureForType('xmindcasegen')
        : 0.2;
      var modelCanSeeImages = modelSupportsVision(model);
      var requestMode = 'text';
      var requestText = payload.text;
      var contentBlocks = [];
      var degradedToTextOnly = false;
      var taskWorkspaceId = String(inputOptions.workspaceId || getActiveWorkspaceId() || '');
      var requestPayloadLimit = getXmindRequestPayloadLimit();
      if (payload.images && payload.images.length) {
        if (!modelCanSeeImages && !payload.text) {
          throw new Error('当前 XMind 用例生成模型不支持图片，且需求文本为空');
        }
        if (modelCanSeeImages && xmindGenApi && typeof xmindGenApi.callModelWithContent === 'function') {
          var imageBlocks = await buildImageContentBlocks(payload.images, payload.mode === 'manual');
          if (imageBlocks.stats.sent > 0) {
            contentBlocks = [{ type: 'text', text: payload.text }].concat(imageBlocks.blocks || []);
            var payloadSize = estimateTaskContentBlocksSize(contentBlocks);
            if (payloadSize > requestPayloadLimit) {
              throw buildXmindPayloadLimitError(payloadSize, requestPayloadLimit);
            }
            requestMode = 'content';
          }
        }
      }
      var kbState = await runKnowledgeBasePipelineForGeneration(
        contract,
        visibleContext,
        moduleEntry,
        model,
        reasoning,
        temperature,
        taskWorkspaceId,
        inputOptions.knowledgeBaseActionKey
      );
      if (kbState && kbState.injectedContextText) {
        requestText = String(requestText || '').trim()
          ? (String(requestText || '') + '\n\n' + kbState.injectedContextText)
          : kbState.injectedContextText;
        if (requestMode === 'content') {
          if (Array.isArray(contentBlocks) && contentBlocks.length && contentBlocks[0]
            && contentBlocks[0].type === 'text') {
            contentBlocks[0].text = requestText;
          } else {
            contentBlocks.unshift({ type: 'text', text: requestText });
          }
        }
      }
      return {
        prompt: prompt,
        requestMode: requestMode,
        requestText: requestText,
        contentBlocks: requestMode === 'content' ? contentBlocks : [],
        degradedToTextOnly: degradedToTextOnly,
        model: cloneJson(model, null),
        reasoning: reasoning,
        temperature: temperature,
      };
    }

    function buildDedupeRequirementSource() {
      var source = getSelectedRequirementSource();
      var prep = getPrepState();
      return {
        label: getRequirementLabelText(),
        text: source && source.text ? String(source.text || '') : '',
        supplement: source && source.supplement
          ? String(source.supplement || '')
          : String(prep && prep.requirementSupplement ? prep.requirementSupplement : ''),
      };
    }

    function buildXmindDedupeTaskInput(modules, options) {
      var inputOptions = options || {};
      var dedupeCoreApi = getXmindCaseDedupeCoreApi();
      if (!dedupeCoreApi || typeof dedupeCoreApi.buildDedupeRequest !== 'function') {
        throw new Error('AI 用例去重能力未就绪，请刷新后重试');
      }
      var model = xmindGenApi && typeof xmindGenApi.getAssignedModel === 'function'
        ? xmindGenApi.getAssignedModel('xmindcasegen')
        : null;
      if (!model || !model.baseUrl || !model.model) throw new Error('未找到 XMind 用例生成模型');
      var requirement = buildDedupeRequirementSource();
      var dedupeMode = normalizeDedupeMode(inputOptions.dedupeMode || getDedupeModeFromSettings());
      var built = dedupeCoreApi.buildDedupeRequest({
        requirementLabel: requirement.label,
        requirementText: requirement.text,
        requirementSupplement: requirement.supplement,
        modules: modules,
        referenceModules: Array.isArray(inputOptions.referenceModules) ? inputOptions.referenceModules : [],
        batchMode: inputOptions.batchMode === true,
        batchIndex: Number(inputOptions.batchIndex || 0),
        batchCount: Number(inputOptions.batchCount || 0),
        strength: dedupeStrength,
        dedupeMode: dedupeMode,
        source: inputOptions.source || 'manual-toolbar',
      });
      var requestText = String(built && built.requestText ? built.requestText : '');
      var payloadLimit = getXmindRequestPayloadLimit();
      if (requestText.length > payloadLimit) {
        throw buildXmindPayloadLimitError(requestText.length, payloadLimit);
      }
      return {
        prompt: String(built && built.prompt ? built.prompt : ''),
        requestMode: 'text',
        requestText: requestText,
        contentBlocks: [],
        degradedToTextOnly: false,
        model: cloneJson(model, null),
        reasoning: xmindGenApi && typeof xmindGenApi.getReasoningForType === 'function'
          ? xmindGenApi.getReasoningForType('xmindcasegen')
          : '',
        temperature: xmindGenApi && typeof xmindGenApi.getTemperatureForType === 'function'
          ? xmindGenApi.getTemperatureForType('xmindcasegen')
          : 0.2,
        modules: cloneJson(built && built.modules, []),
        dedupeMode: normalizeDedupeMode(built && built.dedupeMode ? built.dedupeMode : dedupeMode),
        partialModulesResponseAllowed: built && built.partialModulesResponseAllowed === true,
        beforeCaseCount: Number(built && built.beforeCaseCount || 0),
      };
    }

    function buildXmindDedupeExecutionInput(modules, options) {
      var inputOptions = options || {};
      var batchCoreApi = getXmindDedupeBatchCoreApi();
      if (!batchCoreApi || typeof batchCoreApi.buildBatchPlan !== 'function') {
        return buildXmindDedupeTaskInput(modules, inputOptions);
      }
      var plan = batchCoreApi.buildBatchPlan(modules, {
        maxCasesPerBatch: 60,
        maxConcurrentBatches: 5,
      });
      if (!plan || plan.enabled !== true || !Array.isArray(plan.batches) || plan.batches.length <= 1) {
        return buildXmindDedupeTaskInput(modules, inputOptions);
      }
      var batchInputs = plan.batches.map(function(batch) {
        var taskInput = buildXmindDedupeTaskInput(batch.modules, {
          source: inputOptions.source,
          dedupeMode: inputOptions.dedupeMode,
          referenceModules: batch.referenceModules,
          batchMode: true,
          batchIndex: Number(batch.index || 0),
          batchCount: Number(plan.batchCount || plan.batches.length),
        });
        return {
          id: String(batch.id || ''),
          index: Number(batch.index || 0),
          modules: cloneJson(taskInput.modules, []),
          targetCaseCount: Number(batch.targetCaseCount || taskInput.beforeCaseCount || 0),
          referenceCaseCount: Number(batch.referenceCaseCount || 0),
          model: cloneJson(taskInput.model, null),
          prompt: taskInput.prompt,
          requestMode: taskInput.requestMode,
          requestText: taskInput.requestText,
          contentBlocks: taskInput.contentBlocks,
          reasoning: taskInput.reasoning,
          temperature: taskInput.temperature,
        };
      });
      var firstInput = batchInputs[0] || {};
      return {
        prompt: '',
        requestMode: 'text',
        requestText: '',
        contentBlocks: [],
        degradedToTextOnly: false,
        model: cloneJson(firstInput.model, null),
        reasoning: String(firstInput.reasoning || ''),
        temperature: Number(firstInput.temperature),
        modules: cloneJson(modules, []),
        dedupeMode: normalizeDedupeMode(inputOptions.dedupeMode || getDedupeModeFromSettings()),
        partialModulesResponseAllowed: true,
        beforeCaseCount: Number(plan.totalCaseCount || 0),
        dedupeBatches: batchInputs.map(function(item) {
          return {
            id: item.id,
            index: item.index,
            modules: cloneJson(item.modules, []),
            targetCaseCount: item.targetCaseCount,
            referenceCaseCount: item.referenceCaseCount,
          };
        }),
        modelRequestBatch: batchInputs.map(function(item) {
          return {
            id: item.id,
            index: item.index,
            prompt: item.prompt,
            requestMode: item.requestMode,
            requestText: item.requestText,
            contentBlocks: cloneJson(item.contentBlocks, []),
            reasoning: item.reasoning,
            temperature: item.temperature,
          };
        }),
        modelRequestBatchConcurrency: Number(plan.maxConcurrentBatches || 1),
      };
    }

    function buildCoverageSourceRequest() {
      var coverageCoreApi = getXmindRequirementCoverageCoreApi();
      if (!coverageCoreApi || typeof coverageCoreApi.buildCoverageRequest !== 'function') {
        throw new Error('需求覆盖分析能力未就绪，请刷新后重试');
      }
      var requirementSource = getSelectedRequirementSource();
      var requirementText = requirementSource && requirementSource.text
        ? String(requirementSource.text || '').trim()
        : '';
      if (!requirementText) throw new Error('当前页签没有可分析的需求原文');
      var modules = buildVisibleModuleSnapshot(buildVisibleModuleContext());
      var request = coverageCoreApi.buildCoverageRequest({
        requirementText: requirementText,
        modules: modules,
      });
      if (!request || !request.segmentCount) throw new Error('当前需求原文无法拆分为可分析片段');
      if (!request.caseCount) throw new Error('当前页签没有可分析的可见用例');
      return request;
    }

    function buildXmindCoverageTaskInput(request) {
      var sourceRequest = request || buildCoverageSourceRequest();
      var model = xmindGenApi && typeof xmindGenApi.getAssignedModel === 'function'
        ? xmindGenApi.getAssignedModel('xmindcasegen')
        : null;
      if (!model || !model.baseUrl || !model.model) throw new Error('未找到 XMind 用例生成模型');
      var requestText = String(sourceRequest && sourceRequest.requestText ? sourceRequest.requestText : '');
      var payloadLimit = getXmindRequestPayloadLimit();
      if (requestText.length > payloadLimit) {
        throw buildXmindPayloadLimitError(requestText.length, payloadLimit);
      }
      return {
        prompt: String(sourceRequest && sourceRequest.prompt ? sourceRequest.prompt : ''),
        requestMode: 'text',
        requestText: requestText,
        contentBlocks: [],
        degradedToTextOnly: false,
        model: cloneJson(model, null),
        reasoning: xmindGenApi && typeof xmindGenApi.getReasoningForType === 'function'
          ? xmindGenApi.getReasoningForType('xmindcasegen')
          : '',
        temperature: xmindGenApi && typeof xmindGenApi.getTemperatureForType === 'function'
          ? xmindGenApi.getTemperatureForType('xmindcasegen')
          : 0.2,
        coverageRequest: {
          requirementText: String(sourceRequest.requirementText || ''),
          segments: cloneJson(sourceRequest.segments, []),
          cases: cloneJson(sourceRequest.cases, []),
          signature: String(sourceRequest.signature || ''),
        },
        coverageSignature: String(sourceRequest.signature || ''),
        segmentCount: Number(sourceRequest.segmentCount || 0),
        caseCount: Number(sourceRequest.caseCount || 0),
      };
    }

    return {
      buildCoverageRetryHistoryDiagnostics: buildCoverageRetryHistoryDiagnostics,
      buildCoverageSourceRequest: buildCoverageSourceRequest,
      buildRootCoverageRetryTaskPayload: buildRootCoverageRetryTaskPayload,
      buildXmindCoverageTaskInput: buildXmindCoverageTaskInput,
      buildXmindDedupeExecutionInput: buildXmindDedupeExecutionInput,
      buildXmindGenerationTaskInput: buildXmindGenerationTaskInput,
      estimateTaskContentBlocksSize: estimateTaskContentBlocksSize,
      evaluateRootCoverageGaps: evaluateRootCoverageGaps,
      extractNamedSectionText: extractNamedSectionText,
    };
  }

  return { create: create };
});
