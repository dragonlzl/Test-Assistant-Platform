(function(factory) {
  var pipeline = null;
  if (typeof module !== 'undefined' && module.exports) {
    pipeline = require('./casePageXmindPipeline.js');
  } else if (typeof window !== 'undefined' && window.app) {
    pipeline = window.app.casePageXmindPipeline || null;
  }
  var api = factory(pipeline);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.casePageAiGenPrepCore = api;
  }
})(function(defaultPipeline) {
  var MODE_PRECISE = 'precise';
  var MODE_ENHANCED = 'enhanced';
  var BOOLEAN_SETTINGS = [
    'dedupeSimplify', 'needFunctionCondition', 'needNumericValidation', 'needBoundary', 'needMobile', 'needSpecial',
    'specialRepeatOperation', 'specialMultiTouch', 'specialRepeatExecution', 'specialWeakNetwork', 'specialInterruptResume',
  ];

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state || {};
    var config = opts.config || {};
    var pipeline = opts.xmindPipeline || defaultPipeline;
    var knowledgeApi = opts.xmindKnowledgeBaseApi || null;
    var callModel = typeof opts.callModelWithConfig === 'function'
      ? opts.callModelWithConfig
      : function() { return Promise.reject(new Error('模型客户端不可用，请刷新页面后重试')); };
    var now = typeof opts.now === 'function' ? opts.now : Date.now;
    var knowledgeCache = {};
    if (!pipeline || typeof pipeline.cloneJson !== 'function'
      || typeof pipeline.normalizeText !== 'function'
      || typeof pipeline.normalizePriority !== 'function'
      || typeof pipeline.parseJsonPayload !== 'function') {
      throw new Error('XMind 流水线未加载');
    }

    function ensureSettings() {
      if (!state.caseGenSettings || typeof state.caseGenSettings !== 'object') state.caseGenSettings = {};
      var settings = state.caseGenSettings;
      if (settings.customRequirement === undefined || settings.customRequirement === null) settings.customRequirement = '';
      if (settings.casePageGenerationMode === undefined || settings.casePageGenerationMode === null) {
        settings.casePageGenerationMode = MODE_ENHANCED;
      }
      BOOLEAN_SETTINGS.forEach(function(key) {
        settings[key] = key === 'needFunctionCondition' || key === 'needNumericValidation'
          ? settings[key] !== false : settings[key] === true;
      });
      return settings;
    }

    function snapshotSettings() {
      var settings = ensureSettings();
      var snapshot = {
        customRequirement: String(settings.customRequirement || ''),
        casePageGenerationMode: normalizeGenerationMode(settings.casePageGenerationMode),
      };
      BOOLEAN_SETTINGS.forEach(function(key) { snapshot[key] = settings[key] === true; });
      return snapshot;
    }

    function normalizeGenerationMode(value) {
      var mode = pipeline.normalizeText(value);
      return mode === MODE_PRECISE || mode === MODE_ENHANCED ? mode : '';
    }

    function getGenerationModeMeta(value) {
      var mode = normalizeGenerationMode(value);
      if (mode === MODE_PRECISE) {
        return {
          mode: mode,
          title: '精准补充',
          shortDesc: '执行时长快，新增数量少。',
          strategy: 'threshold_focused',
          coveragePolicy: 'hard_threshold',
          prompt: '生成模式：精准补充。请把 coverage_threshold 作为硬门槛，优先只补原用例明确缺失或覆盖不足的测试点；输出数量保持克制，执行时长优先。',
        };
      }
      if (mode === MODE_ENHANCED) {
        return {
          mode: mode,
          title: '增强补全',
          shortDesc: '覆盖更全，执行时间稍长。',
          strategy: 'strong_completion',
          coveragePolicy: 'ignore_for_generation',
          prompt: [
            '生成模式：增强补全，执行强补全策略。',
            '本策略优先级高于基础提示词中“coverage_threshold 达到阈值可不生成”的规则；请忽略 coverage_threshold 的停生成效果，coverage_threshold 只作为参考信息，不允许作为跳过模块或停止生成的依据。',
            '请参考 XMind 补全思路，对需求相关的已有模块和缺失模块都进行补全；即使原用例覆盖了主流程，也要继续按测试场景维度补足异常流、边界值、状态变化、配置/权限、兼容/移动端、弱网/中断恢复和跨模块联动等高价值候选。',
            '原有用例只作为上下文和语义重复判断基线；仍然只能输出新增候选，不能改动原有用例。',
          ].join('\n'),
        };
      }
      return { mode: '', title: '', shortDesc: '', strategy: '', coveragePolicy: '', prompt: '' };
    }

    function normalizeCaseList(list) {
      return (Array.isArray(list) ? list : []).map(function(raw) {
        var source = raw && typeof raw === 'object' ? raw : {};
        return {
          module: pipeline.normalizeText(source.module || source.module_name || ''),
          title: pipeline.normalizeText(source.title || source.case_title || ''),
          priority: pipeline.normalizePriority(source.priority || ''),
          precondition: pipeline.normalizeText(source.precondition || source.preconditions || ''),
          steps: pipeline.normalizeText(source.steps || source.step || ''),
          expected: pipeline.normalizeText(source.expected || source.expect || ''),
          remark: pipeline.normalizeText(source.remark || source.remarks || ''),
        };
      }).filter(function(item) {
        return Boolean(item.module || item.title || item.expected || item.steps);
      });
    }

    function buildModuleList(items) {
      var seen = {};
      return normalizeCaseList(items).map(function(item) { return item.module || '未分组模块'; }).filter(function(name) {
        var key = name.toLowerCase();
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
    }

    function groupCasesByModule(items) {
      var map = {};
      var order = [];
      normalizeCaseList(items).forEach(function(item) {
        var name = item.module || '未分组模块';
        var key = name.toLowerCase();
        if (!map[key]) {
          map[key] = { moduleId: 'module-' + String(order.length + 1), moduleKey: key, module: name, cases: [] };
          order.push(key);
        }
        map[key].cases.push({
          module: name,
          title: item.title,
          priority: item.priority,
          preconditions: item.precondition,
          precondition: item.precondition,
          steps: item.steps,
          expected: item.expected,
          remark: item.remark,
        });
      });
      return order.map(function(key) { return map[key]; });
    }

    function isEnhancedGenerationContext(prep) {
      return normalizeGenerationMode(prep && prep.settings && prep.settings.casePageGenerationMode) === MODE_ENHANCED;
    }

    function buildExternalPromptBase(prep) {
      var defaults = config.defaultPrompts || {};
      var defaultPrompt = String(defaults.xmindcasegen || '').trim();
      var assignedPrompt = String(state.assignments && state.assignments.xmindCaseGenPrompt || '').trim();
      var guide = String(config.caseWritingStyleGuidePrompt || '').trim();
      var context = String(prep && prep.promptContext || '').trim();
      var parts = [defaultPrompt];
      if (assignedPrompt && assignedPrompt !== defaultPrompt) parts.push(assignedPrompt);
      if (context) parts.push(context);
      parts.push([
        '【外部用例基线生成约束】',
        '当前不是 XMind 页面本身，不能修改 XMind 页面状态；但生成语义需要复用 XMind 的模块化发现、已有模块补强、新模块全量生成思路。',
        '第二步导入用例为 locked_imported_cases，只读。原有用例只能作为模块基线、覆盖分析和重复判断上下文。',
        '输出只能包含新增候选用例；不要改写、删除、合并或返回原有用例。',
        '增强补全时，coverage_threshold 只作为参考，不能作为跳过模块或停止生成的依据。',
      ].join('\n'));
      if (guide && parts.join('\n').indexOf('AI_CASE_WRITING_STYLE_GUIDE.md') === -1) parts.push(guide);
      return parts.filter(Boolean).join('\n\n');
    }

    function buildExternalBasePayload(options, prep) {
      var input = options || {};
      var extra = prep && prep.payloadExtra || {};
      var settings = prep && prep.settings || {};
      var existingCases = normalizeCaseList(input.existingCases || prep && prep.sourceCases || []);
      var context = input.context || {};
      return {
        requirement_text: input.requirementText || prep && prep.requirementText || '',
        requirement_supplement: prep && prep.requirementSupplement || '',
        module_list: Array.isArray(input.moduleList) && input.moduleList.length ? input.moduleList.slice() : buildModuleList(existingCases),
        existing_cases: existingCases,
        coverage_threshold: input.coverageThreshold,
        generation_options: settings,
        coverage_threshold_policy: extra.coverage_threshold_policy || '',
        coverage_threshold_can_skip_module: extra.coverage_threshold_can_skip_module === true,
        case_page_generation_mode: extra.case_page_generation_mode || null,
        generation_policy: extra.generation_policy || null,
        locked_imported_cases: extra.locked_imported_cases || null,
        dedupe_contract: extra.dedupe_contract || null,
        knowledge_base: extra.knowledge_base || null,
        xmind_generation_context: extra.xmind_generation_context || null,
        source_context: {
          scene: input.scene || context.scene || '',
          case_file_id: input.caseFileId || context.caseFileId || '',
          display_name: input.displayName || context.displayName || '',
          project_id: input.projectId || context.projectId || '',
          version_id: input.versionId || context.versionId || '',
        },
        generation_mode_summary: getGenerationModeMeta(settings.casePageGenerationMode).prompt,
      };
    }

    function buildXmindEnhancedPipelineRequest(options, prep) {
      if (!isEnhancedGenerationContext(prep)) return null;
      var input = options || {};
      var existingCases = normalizeCaseList(input.existingCases || prep && prep.sourceCases || []);
      var visibleModules = groupCasesByModule(existingCases).map(function(entry) {
        return Object.assign({}, entry, { key_scenarios: [], test_points: [], coupled_modules: [] });
      });
      var promptBase = buildExternalPromptBase(prep || {});
      var contract = pipeline.buildContract('append_all_modules_cases', '');
      var basePayload = buildExternalBasePayload(Object.assign({}, input, { existingCases: existingCases }), prep || {});
      var rootPayload = pipeline.buildStagePayload(
        basePayload, contract, visibleModules, 'discovery', null, [], 'append_all_modules_cases'
      );
      return {
        enabled: true,
        version: 1,
        source: 'case-page-xmind-external-pipeline',
        mode: 'append_all_modules_cases',
        promptBase: promptBase,
        root: {
          prompt: pipeline.buildPrompt(promptBase, contract),
          userText: JSON.stringify(rootPayload, null, 2),
          operationContract: contract,
        },
        basePayload: basePayload,
        visibleModules: visibleModules,
        moduleConcurrency: 4,
      };
    }

    function getKnowledgeBaseBaseUrl() {
      var raw = state.settings && typeof state.settings.knowledgeBaseBaseUrl === 'string'
        ? state.settings.knowledgeBaseBaseUrl : '';
      return knowledgeApi && typeof knowledgeApi.normalizeBaseUrl === 'function'
        ? knowledgeApi.normalizeBaseUrl(raw)
        : pipeline.normalizeText(raw).replace(/[?#].*$/, '');
    }

    function createKnowledgeState(reason) {
      var baseUrl = getKnowledgeBaseBaseUrl();
      var stateValue = knowledgeApi && typeof knowledgeApi.createDefaultState === 'function'
        ? knowledgeApi.createDefaultState()
        : { ruleSearch: {}, aiFilter: {}, injectedContextText: '', selectedSections: [], warnings: [] };
      stateValue.baseUrl = baseUrl;
      stateValue.enabled = Boolean(baseUrl);
      stateValue.ruleSearch.status = baseUrl ? 'skipped' : 'disabled';
      stateValue.ruleSearch.reason = reason || (baseUrl ? '当前场景已跳过知识库检索' : '未配置共享知识库地址，本轮已跳过');
      stateValue.aiFilter.status = baseUrl ? 'skipped' : 'disabled';
      stateValue.aiFilter.reason = stateValue.ruleSearch.reason;
      stateValue.updatedAt = now();
      return stateValue;
    }

    function getStageLabel(status) {
      if (knowledgeApi && typeof knowledgeApi.getStageLabel === 'function') return knowledgeApi.getStageLabel(status);
      return { done: '完成', pending: '进行中', skipped: '跳过', failed: '失败' }[String(status || '')] || '未启用';
    }

    function buildKnowledgeKey(baseUrl, queryContext) {
      if (knowledgeApi && typeof knowledgeApi.buildQueryKey === 'function') {
        try {
          return knowledgeApi.buildQueryKey({ baseUrl: baseUrl, queryContext: queryContext });
        } catch (err) {}
      }
      return JSON.stringify({ version: 1, baseUrl: baseUrl, queryContext: queryContext });
    }

    function runKnowledgeBase(options) {
      var input = options || {};
      var baseUrl = getKnowledgeBaseBaseUrl();
      if (!baseUrl) return Promise.resolve(createKnowledgeState('未配置共享知识库地址，本轮已跳过'));
      if (!knowledgeApi || typeof knowledgeApi.runPipeline !== 'function') {
        return Promise.resolve(createKnowledgeState('知识库模块不可用，本轮已跳过'));
      }
      var context = input.context || {};
      var queryContext = {
        requirementLabel: context.displayName || '当前用例',
        requirementText: input.requirementText || '',
        requirementSupplement: input.requirementSupplement || '',
        requirementMode: input.allowRequirementDocument === false ? 'manual' : (input.requirementMode || 'manual'),
        operationType: 'case-page-ai-gen',
      };
      var cacheKey = buildKnowledgeKey(baseUrl, queryContext);
      var cached = cacheKey ? pipeline.cloneJson(knowledgeCache[cacheKey], null) : null;
      if (cached) {
        cached.cached = true;
        cached.updatedAt = now();
        return Promise.resolve(cached);
      }
      return knowledgeApi.runPipeline({
        baseUrl: baseUrl,
        workspaceId: 'case-page-' + String(input.scene || 'default') + '-' + String(context.caseFileId || ''),
        requestId: 'case-page-kb-' + now().toString(36),
        queryContext: queryContext,
        model: input.model || null,
        reasoning: input.reasoning || '',
        temperature: input.temperature,
        callModel: callModel,
        onStateChange: typeof input.onStateChange === 'function' ? input.onStateChange : function() {},
      }).then(function(nextState) {
        if (cacheKey && nextState && nextState.enabled !== false) {
          knowledgeCache[cacheKey] = pipeline.cloneJson(nextState, null);
        }
        return nextState;
      });
    }

    function buildOptionsText(settings) {
      var value = settings || {};
      var mode = getGenerationModeMeta(value.casePageGenerationMode);
      var lines = [];
      if (mode.mode) {
        lines.push('生成模式：' + mode.title + '（' + mode.shortDesc + '）');
        if (mode.coveragePolicy === 'ignore_for_generation') lines.push('增强补全强策略：忽略覆盖率停生成规则，coverage_threshold 仅作参考。');
      }
      if (value.customRequirement) lines.push('额外要求：' + value.customRequirement);
      [
        ['needFunctionCondition', '考虑功能使用条件'],
        ['needNumericValidation', '数值验证'],
        ['needBoundary', '考虑边界'],
        ['needMobile', '考虑移动设备'],
      ].forEach(function(entry) { if (value[entry[0]]) lines.push(entry[1]); });
      if (value.needSpecial) {
        var special = [
          ['specialRepeatOperation', '重复操作'],
          ['specialMultiTouch', '多点触控'],
          ['specialRepeatExecution', '重复执行'],
          ['specialWeakNetwork', '弱网'],
          ['specialInterruptResume', '中断恢复'],
        ].filter(function(entry) { return value[entry[0]]; }).map(function(entry) { return entry[1]; });
        lines.push('考虑特殊场景' + (special.length ? '：' + special.join('、') : ''));
      }
      lines.push(value.dedupeSimplify ? '生成后去重并精简，原有用例只读保护' : '生成后仅去重，原有用例只读保护');
      return lines.join('\n');
    }

    function buildGenerationContext(dialog, settings, knowledgeState) {
      var context = dialog.context || {};
      var existingCases = normalizeCaseList(context.cases || []);
      var knowledgeText = String(knowledgeState && knowledgeState.injectedContextText || '');
      var optionsText = buildOptionsText(settings);
      var mode = getGenerationModeMeta(settings.casePageGenerationMode);
      var policyIgnoresThreshold = mode.coveragePolicy === 'ignore_for_generation';
      var payloadExtra = {
        generation_options: settings,
        coverage_threshold_policy: policyIgnoresThreshold ? 'ignore_for_enhanced_strong_completion' : 'hard_threshold',
        coverage_threshold_can_skip_module: !policyIgnoresThreshold,
        xmind_generation_context: {
          requirement_mode: dialog.allowRequirementDocument === false ? 'manual' : (dialog.requirementMode || 'manual'),
          requirement_label: context.displayName || '当前用例',
          requirement_supplement: dialog.requirementSupplement || '',
          option_summary: optionsText,
          generation_mode: mode.mode,
          generation_mode_label: mode.title,
          generation_strategy: mode.strategy,
          coverage_policy: mode.coveragePolicy,
        },
        case_page_generation_mode: {
          mode: mode.mode,
          label: mode.title,
          strategy: mode.strategy,
          coverage_policy: mode.coveragePolicy,
          ignore_coverage_threshold: policyIgnoresThreshold,
          speed: mode.mode === MODE_PRECISE ? 'fast' : 'slower',
          expected_case_count: mode.mode === MODE_PRECISE ? 'fewer' : 'more_complete',
          instruction: mode.prompt,
        },
        generation_policy: {
          strategy: mode.strategy,
          coverage_threshold_behavior: policyIgnoresThreshold
            ? 'ignore_for_generation_and_do_not_skip_modules' : 'hard_threshold_for_generation',
          must_generate_for_relevant_existing_modules: policyIgnoresThreshold,
          must_generate_for_missing_modules: true,
          protect_original_cases: true,
          output_scope: 'new_cases_only',
        },
        locked_imported_cases: {
          mode: 'import',
          readonly: true,
          source: 'current-case-file',
          file_id: context.caseFileId || '',
          file_name: context.displayName || '',
          case_count: existingCases.length,
          module_list: buildModuleList(existingCases),
          cases: existingCases,
        },
        dedupe_contract: {
          original_cases_readonly: true,
          generated_cases_editable: true,
          rule: '只允许删除或合并本轮生成用例；原有用例只参与重复判断，不得修改、删除或合并。',
        },
        knowledge_base: {
          enabled: Boolean(knowledgeState && knowledgeState.enabled),
          rule_status: knowledgeState && knowledgeState.ruleSearch ? knowledgeState.ruleSearch.status : '',
          ai_status: knowledgeState && knowledgeState.aiFilter ? knowledgeState.aiFilter.status : '',
          injected_context: knowledgeText,
        },
      };
      var promptContext = [
        mode.prompt ? '【执行页/用例库生成模式】\n' + mode.prompt : '',
        optionsText ? '【XMind 用例生成选项】\n' + optionsText : '',
        knowledgeText,
        '【导入已有用例规则】\n第二步已锁定为导入当前页面当前用例文件的全部用例；这些用例是只读基线，只能用于覆盖分析和重复判断。',
        '【去重保护规则】\n生成完成后只针对本轮生成用例去重；如果生成用例之间重复，或生成用例与原有用例重复，只能删除或合并生成用例，不能改动原有用例。',
      ].filter(Boolean).join('\n\n');
      return {
        requirementText: dialog.requirementText || '',
        requirementSupplement: dialog.requirementSupplement || '',
        requirementFileName: dialog.requirementFileName || '',
        settings: settings,
        knowledgeBaseState: pipeline.cloneJson(knowledgeState, null),
        payloadExtra: payloadExtra,
        promptContext: promptContext,
        sourceCases: existingCases,
      };
    }

    function enrichPayload(basePayload, prep) {
      var payload = pipeline.cloneJson(basePayload || {}, {});
      var extra = prep && prep.payloadExtra || {};
      Object.keys(extra).forEach(function(key) { payload[key] = extra[key]; });
      if (prep && prep.requirementSupplement) payload.requirement_supplement = prep.requirementSupplement;
      if (prep && prep.promptContext) payload.xmind_context_reference = prep.promptContext;
      return payload;
    }

    function enrichPrompt(prompt, prep) {
      var base = String(prompt || '').trim();
      var context = String(prep && prep.promptContext || '').trim();
      var guide = String(config.caseWritingStyleGuidePrompt || '').trim();
      var parts = [base, context];
      if (guide && base.indexOf('AI_CASE_WRITING_STYLE_GUIDE.md') === -1) parts.push(guide);
      return parts.filter(Boolean).join('\n\n');
    }

    function buildDedupeRequest(parsed, existingCases, prep) {
      var settings = prep && prep.settings || {};
      var simplify = settings.dedupeSimplify === true;
      var prompt = [
        '你是资深测试用例评审专家，请对“本轮 AI 生成用例”做整份用例级语义去重。',
        '必须保护原有用例：original_cases_readonly 只能作为重复判断基线，绝对不得修改、删除、合并或返回改写后的原有用例。',
        '可编辑范围只有 generated_cases_editable；如果生成用例与原有用例语义重复，只能删除或合并生成用例。',
        '必须全局扫描所有模块内和跨模块的生成用例；不要因为模块不同就跳过语义重复。',
        '重复判断要看测试目的、测试点、触发条件、关键步骤、预期校验和风险覆盖；标题或模块名不同但验证同一件事，也应判为重复。',
        simplify ? '本次策略：去重并精简。允许在不降低覆盖和缺陷发现能力的前提下合并生成用例。'
          : '本次策略：仅去重。只删除或合并明确语义重复的生成用例，不要为了减少数量而删掉有独立覆盖价值的用例。',
        '如果不确定某条生成用例是否冗余，应保留。',
        '返回只允许包含筛选后的 generated_modules 和 removed_cases，不得返回 original_cases_readonly。',
        'generated_modules 必须使用输入模块结构，cases 只包含保留后的生成用例；没有保留用例的模块可以省略。',
        'removed_cases 逐条说明被移除的生成用例，type 可为 duplicate_with_original、duplicate_generated 或 merge。',
        '只返回 JSON，不要输出解释、Markdown 或代码块。',
        '返回格式：{"generated_modules":[{"module":"模块名","coverage":60,"missing":false,"cases":[{"module":"模块名","title":"标题","priority":"P1","precondition":"","steps":"步骤","expected":"预期","remark":""}]}],"removed_cases":[{"type":"duplicate_with_original","module":"模块名","title":"被移除标题","reason":"与原用例重复","duplicate_with":"保留用例标题"}],"summary":{"removed":0,"reason":"简述"}}',
      ].join('\n');
      return {
        prompt: prompt,
        userText: JSON.stringify({
          operation_contract: {
            scope: 'case_page_generated_cases',
            mode: simplify ? 'semantic_dedupe_simplify' : 'semantic_dedupe_only',
            original_cases_readonly: true,
            generated_cases_editable: true,
            editable_scope: 'generated_cases_only',
            return_policy: 'return_kept_generated_cases_only',
            dedupe_scope: 'whole_case_file_global',
            cross_module_dedupe: true,
            protect_original_cases: true,
          },
          requirement: {
            text: String(prep && prep.requirementText || ''),
            supplement: String(prep && prep.requirementSupplement || ''),
          },
          original_cases_readonly: normalizeCaseList(existingCases || []),
          generated_cases_editable: parsed.modules,
        }, null, 2),
      };
    }

    function countCases(modules) {
      return (Array.isArray(modules) ? modules : []).reduce(function(total, item) {
        return total + (item && Array.isArray(item.cases) ? item.cases.length : 0);
      }, 0);
    }

    function normalizeDedupeModules(rawModules) {
      return (Array.isArray(rawModules) ? rawModules : []).map(function(item) {
        if (!item || typeof item !== 'object' || !Array.isArray(item.cases) || !item.cases.length) return null;
        var next = Object.assign({}, item);
        next.module = pipeline.normalizeText(item.module || item.module_name || item.title || '') || item.module || '';
        next.cases = item.cases;
        return next;
      }).filter(Boolean);
    }

    function applyAiDedupeToParsed(parsed, existingCases, prep, modelOptions) {
      var data = parsed && typeof parsed === 'object' ? parsed : {};
      var modelInput = modelOptions || {};
      if (data.error || !Array.isArray(data.modules) || !data.modules.length
        || !modelInput.model || typeof modelInput.callModelWithConfig !== 'function') {
        return Promise.resolve(data);
      }
      var request = buildDedupeRequest(data, existingCases, prep || {});
      var beforeCount = countCases(data.modules);
      return Promise.resolve(modelInput.callModelWithConfig(
        modelInput.model, request.userText, request.prompt, modelInput.reasoning || '', modelInput.temperature
      )).then(function(content) {
        var payload = pipeline.parseJsonPayload(content);
        if (!payload || typeof payload !== 'object') {
          data.ai_dedupe_error = 'AI 语义去重返回格式不正确，已保留原始生成结果';
          return data;
        }
        var modules = normalizeDedupeModules(payload.generated_modules || payload.modules);
        var removedCases = Array.isArray(payload.removed_cases) ? payload.removed_cases : [];
        var afterCount = countCases(modules);
        data.modules = modules;
        data.ai_dedupe = {
          enabled: true,
          removedCases: removedCases,
          beforeCount: beforeCount,
          afterCount: afterCount,
          removedCount: Math.max(0, beforeCount - afterCount),
          summary: payload.summary || null,
        };
        data.removed_cases = removedCases;
        return data;
      }).catch(function(err) {
        data.ai_dedupe_error = err && err.message ? err.message : 'AI 语义去重失败，已保留原始生成结果';
        return data;
      });
    }

    return {
      ensureSettings: ensureSettings,
      snapshotSettings: snapshotSettings,
      normalizeGenerationMode: normalizeGenerationMode,
      getGenerationModeMeta: getGenerationModeMeta,
      normalizeCaseList: normalizeCaseList,
      buildModuleList: buildModuleList,
      groupCasesByModule: groupCasesByModule,
      isEnhancedGenerationContext: isEnhancedGenerationContext,
      buildXmindEnhancedPipelineRequest: buildXmindEnhancedPipelineRequest,
      getKnowledgeBaseBaseUrl: getKnowledgeBaseBaseUrl,
      buildKnowledgeBaseSkipState: createKnowledgeState,
      getStageLabel: getStageLabel,
      runKnowledgeBase: runKnowledgeBase,
      buildGenerationContext: buildGenerationContext,
      enrichPayload: enrichPayload,
      enrichPrompt: enrichPrompt,
      applyAiDedupeToParsed: applyAiDedupeToParsed,
    };
  }

  return { create: create };
});
