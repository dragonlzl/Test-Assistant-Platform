(function() {
  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var config = ctx.config || (window.app && window.app.config) || {};
    var core = ctx.core || (window.app && window.app.core) || {};
    var utils = ctx.utils || (window.app && window.app.utils) || {};
    var apiClient = ctx.apiClient || (window.app && window.app.apiClient) || null;
    var callModelWithConfig = ctx.callModelWithConfig || core.callModelWithConfig || function() {
      return Promise.reject(new Error('模型客户端不可用，请刷新页面后重试'));
    };
    var xmindKnowledgeBaseApi = ctx.xmindKnowledgeBaseApi || null;
    if (!xmindKnowledgeBaseApi && window.app && window.app.xmindKnowledgeBase && typeof window.app.xmindKnowledgeBase.init === 'function') {
      xmindKnowledgeBaseApi = window.app.xmindKnowledgeBase.init({
        state: state,
        apiClient: apiClient,
        escapeHtml: escapeHtml,
      });
    }

    var knowledgeBaseCache = {};
    var STEP_REQUIREMENT = 1;
    var STEP_CASES = 2;
    var STEP_OPTIONS = 3;
    var GENERATION_MODE_PRECISE = 'precise';
    var GENERATION_MODE_ENHANCED = 'enhanced';
    var dialogs = {};

    function escapeHtml(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function cloneJson(value, fallback) {
      if (value === undefined || value === null) return fallback;
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (err) {
        return fallback;
      }
    }

    function stableStringify(value) {
      if (value === undefined) return '';
      if (value === null) return 'null';
      if (typeof value !== 'object') return JSON.stringify(value);
      if (Array.isArray(value)) {
        return '[' + value.map(stableStringify).join(',') + ']';
      }
      var keys = Object.keys(value).sort();
      return '{' + keys.map(function(key) {
        return JSON.stringify(key) + ':' + stableStringify(value[key]);
      }).join(',') + '}';
    }

    function normalizeText(value) {
      if (value === null || value === undefined) return '';
      return String(value).replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, '').trim();
    }

    function normalizeMultiline(value) {
      if (Array.isArray(value)) {
        return value.map(function(item) { return normalizeText(item); }).filter(Boolean).join('\n');
      }
      return normalizeText(value);
    }

    function normalizePriority(value) {
      var text = normalizeText(value);
      if (!text) return 'P1';
      var head = text.charAt(0);
      if (head === 'p' || head === 'P') return 'P' + text.slice(1);
      return text;
    }

    function normalizeGenerationMode(value) {
      var text = normalizeText(value);
      if (text === GENERATION_MODE_PRECISE) return GENERATION_MODE_PRECISE;
      if (text === GENERATION_MODE_ENHANCED) return GENERATION_MODE_ENHANCED;
      return '';
    }

    function getGenerationModeMeta(mode) {
      var stable = normalizeGenerationMode(mode);
      if (stable === GENERATION_MODE_PRECISE) {
        return {
          mode: GENERATION_MODE_PRECISE,
          title: '精准补充',
          shortDesc: '执行时长快，新增数量少。',
          strategy: 'threshold_focused',
          coveragePolicy: 'hard_threshold',
          prompt: '生成模式：精准补充。请把 coverage_threshold 作为硬门槛，优先只补原用例明确缺失或覆盖不足的测试点；输出数量保持克制，执行时长优先。',
        };
      }
      if (stable === GENERATION_MODE_ENHANCED) {
        return {
          mode: GENERATION_MODE_ENHANCED,
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
      return {
        mode: '',
        title: '',
        shortDesc: '',
        strategy: '',
        coveragePolicy: '',
        prompt: '',
      };
    }

    function normalizeCaseItem(raw) {
      var source = raw && typeof raw === 'object' ? raw : {};
      return {
        module: normalizeText(source.module || source.module_name || ''),
        title: normalizeText(source.title || source.case_title || ''),
        priority: normalizePriority(source.priority || ''),
        precondition: normalizeMultiline(source.precondition || source.preconditions || ''),
        steps: normalizeMultiline(source.steps || source.step || ''),
        expected: normalizeMultiline(source.expected || source.expect || ''),
        remark: normalizeMultiline(source.remark || source.remarks || ''),
      };
    }

    function parseJsonPayload(text) {
      var raw = String(text || '').trim();
      if (!raw) return null;
      var fence = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
      if (fence) raw = String(fence[1] || '').trim();
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
      return null;
    }

    function normalizeCaseList(list) {
      return (Array.isArray(list) ? list : []).map(normalizeCaseItem).filter(function(item) {
        return Boolean(item.module || item.title || item.expected || item.steps);
      });
    }

    function buildModuleList(items) {
      var seen = {};
      var result = [];
      normalizeCaseList(items).forEach(function(item) {
        var moduleName = item.module || '未分组模块';
        var key = moduleName.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        result.push(moduleName);
      });
      return result;
    }

    function groupCasesByModule(items) {
      var map = {};
      var order = [];
      normalizeCaseList(items).forEach(function(item) {
        var moduleName = item.module || '未分组模块';
        var key = moduleName.toLowerCase();
        if (!map[key]) {
          map[key] = {
            moduleId: 'module-' + String(order.length + 1),
            moduleKey: key || ('module-' + String(order.length + 1)),
            module: moduleName,
            cases: [],
          };
          order.push(key);
        }
        map[key].cases.push({
          module: moduleName,
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
      var settings = prep && prep.settings ? prep.settings : {};
      return normalizeGenerationMode(settings.casePageGenerationMode || '') === GENERATION_MODE_ENHANCED;
    }

    function buildExternalXmindContract(mode, moduleName) {
      if (mode === 'module_append_cases') {
        return {
          scope: 'module',
          mode: 'module_append_cases',
          targetModule: normalizeText(moduleName || ''),
          allowNewModules: false,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: true,
          dedupeAgainstVisibleModules: false,
          dedupeAgainstVisibleCases: true,
        };
      }
      if (mode === 'module_full_cases') {
        return {
          scope: 'module',
          mode: 'module_full_cases',
          targetModule: normalizeText(moduleName || ''),
          allowNewModules: false,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: true,
          dedupeAgainstVisibleModules: false,
          dedupeAgainstVisibleCases: false,
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

    function buildExternalXmindPromptBase(prep) {
      var defaultPrompts = config && config.defaultPrompts ? config.defaultPrompts : {};
      var defaultPrompt = defaultPrompts && defaultPrompts.xmindcasegen
        ? String(defaultPrompts.xmindcasegen || '').trim()
        : '';
      var assignedPrompt = state && state.assignments && state.assignments.xmindCaseGenPrompt
        ? String(state.assignments.xmindCaseGenPrompt || '').trim()
        : '';
      var guide = config && config.caseWritingStyleGuidePrompt ? String(config.caseWritingStyleGuidePrompt || '').trim() : '';
      var promptContext = prep && prep.promptContext ? String(prep.promptContext || '').trim() : '';
      var parts = [];
      if (defaultPrompt) parts.push(defaultPrompt);
      if (assignedPrompt && assignedPrompt !== defaultPrompt) parts.push(assignedPrompt);
      if (promptContext) parts.push(promptContext);
      parts.push([
        '【外部用例基线生成约束】',
        '当前不是 XMind 页面本身，不能修改 XMind 页面状态；但生成语义需要复用 XMind 的模块化发现、已有模块补强、新模块全量生成思路。',
        '第二步导入用例为 locked_imported_cases，只读。原有用例只能作为模块基线、覆盖分析和重复判断上下文。',
        '输出只能包含新增候选用例；不要改写、删除、合并或返回原有用例。',
        '增强补全时，coverage_threshold 只作为参考，不能作为跳过模块或停止生成的依据。',
      ].join('\n'));
      if (guide && parts.join('\n').indexOf('AI_CASE_WRITING_STYLE_GUIDE.md') === -1) {
        parts.push(guide);
      }
      return parts.filter(Boolean).join('\n\n');
    }

    function buildExternalXmindPrompt(promptBase, contract) {
      var parts = [String(promptBase || '').trim()];
      parts.push('operation_contract(JSON)：' + JSON.stringify(contract || {}));
      return parts.filter(Boolean).join('\n\n');
    }

    function buildExternalXmindBasePayload(options, prep) {
      var opts = options || {};
      var settings = prep && prep.settings ? prep.settings : {};
      var payloadExtra = prep && prep.payloadExtra ? prep.payloadExtra : {};
      var existingCases = normalizeCaseList(opts.existingCases || prep && prep.sourceCases || []);
      var moduleList = Array.isArray(opts.moduleList) && opts.moduleList.length
        ? opts.moduleList.slice()
        : buildModuleList(existingCases);
      var context = opts.context || {};
      var generationModeMeta = getGenerationModeMeta(settings.casePageGenerationMode || '');
      var basePayload = {
        requirement_text: opts.requirementText || prep && prep.requirementText || '',
        requirement_supplement: prep && prep.requirementSupplement ? String(prep.requirementSupplement || '') : '',
        module_list: moduleList,
        existing_cases: existingCases,
        coverage_threshold: opts.coverageThreshold,
        generation_options: settings,
        coverage_threshold_policy: payloadExtra.coverage_threshold_policy || '',
        coverage_threshold_can_skip_module: payloadExtra.coverage_threshold_can_skip_module === true,
        case_page_generation_mode: payloadExtra.case_page_generation_mode || null,
        generation_policy: payloadExtra.generation_policy || null,
        locked_imported_cases: payloadExtra.locked_imported_cases || null,
        dedupe_contract: payloadExtra.dedupe_contract || null,
        knowledge_base: payloadExtra.knowledge_base || null,
        xmind_generation_context: payloadExtra.xmind_generation_context || null,
        source_context: {
          scene: opts.scene || context.scene || '',
          case_file_id: opts.caseFileId || context.caseFileId || '',
          display_name: opts.displayName || context.displayName || '',
          project_id: opts.projectId || context.projectId || '',
          version_id: opts.versionId || context.versionId || '',
        },
        generation_mode_summary: generationModeMeta.prompt,
      };
      return basePayload;
    }

    function buildExternalXmindStagePayload(basePayload, contract, visibleModules, stage, moduleEntry, discoveryModules) {
      var payload = cloneJson(basePayload || {}, {});
      payload.operation_contract = cloneJson(contract || {}, {});
      payload.current_visible_modules = cloneJson(visibleModules || [], []);
      payload.current_ai_generation_layer = cloneJson(discoveryModules || [], []);
      payload.xmind_external_pipeline = {
        enabled: true,
        version: 1,
        stage: stage || 'discovery',
        pipeline: 'append_all_modules_cases',
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

    function buildXmindEnhancedPipelineRequest(options, prep) {
      if (!isEnhancedGenerationContext(prep)) return null;
      var opts = options || {};
      var existingCases = normalizeCaseList(opts.existingCases || prep && prep.sourceCases || []);
      var visibleModules = groupCasesByModule(existingCases).map(function(entry) {
        return {
          moduleId: entry.moduleId,
          moduleKey: entry.moduleKey,
          module: entry.module,
          key_scenarios: [],
          test_points: [],
          coupled_modules: [],
          cases: entry.cases || [],
        };
      });
      var promptBase = buildExternalXmindPromptBase(prep || {});
      var rootContract = buildExternalXmindContract('append_all_modules_cases', '');
      var basePayload = buildExternalXmindBasePayload({
        scene: opts.scene || '',
        caseFileId: opts.caseFileId || '',
        displayName: opts.displayName || '',
        projectId: opts.projectId || '',
        versionId: opts.versionId || '',
        requirementText: opts.requirementText || '',
        moduleList: opts.moduleList || [],
        existingCases: existingCases,
        coverageThreshold: opts.coverageThreshold,
      }, prep || {});
      var rootPayload = buildExternalXmindStagePayload(basePayload, rootContract, visibleModules, 'discovery', null, []);
      return {
        enabled: true,
        version: 1,
        source: 'case-page-xmind-external-pipeline',
        mode: 'append_all_modules_cases',
        promptBase: promptBase,
        root: {
          prompt: buildExternalXmindPrompt(promptBase, rootContract),
          userText: JSON.stringify(rootPayload, null, 2),
          operationContract: rootContract,
        },
        basePayload: basePayload,
        visibleModules: visibleModules,
        moduleConcurrency: 4,
      };
    }

    function ensureSettings() {
      if (!state.caseGenSettings || typeof state.caseGenSettings !== 'object') {
        state.caseGenSettings = {};
      }
      var settings = state.caseGenSettings;
      if (settings.customRequirement === undefined || settings.customRequirement === null) settings.customRequirement = '';
      if (settings.casePageGenerationMode === undefined || settings.casePageGenerationMode === null) {
        settings.casePageGenerationMode = GENERATION_MODE_ENHANCED;
      }
      settings.dedupeSimplify = settings.dedupeSimplify === true;
      settings.needFunctionCondition = settings.needFunctionCondition !== false;
      settings.needNumericValidation = settings.needNumericValidation !== false;
      settings.needBoundary = settings.needBoundary === true;
      settings.needMobile = settings.needMobile === true;
      settings.needSpecial = settings.needSpecial === true;
      settings.specialRepeatOperation = settings.specialRepeatOperation === true;
      settings.specialMultiTouch = settings.specialMultiTouch === true;
      settings.specialRepeatExecution = settings.specialRepeatExecution === true;
      settings.specialWeakNetwork = settings.specialWeakNetwork === true;
      settings.specialInterruptResume = settings.specialInterruptResume === true;
      return settings;
    }

    function snapshotSettings() {
      var settings = ensureSettings();
      return {
        customRequirement: String(settings.customRequirement || ''),
        casePageGenerationMode: normalizeGenerationMode(settings.casePageGenerationMode || ''),
        dedupeSimplify: settings.dedupeSimplify === true,
        needFunctionCondition: settings.needFunctionCondition === true,
        needNumericValidation: settings.needNumericValidation === true,
        needBoundary: settings.needBoundary === true,
        needMobile: settings.needMobile === true,
        needSpecial: settings.needSpecial === true,
        specialRepeatOperation: settings.specialRepeatOperation === true,
        specialMultiTouch: settings.specialMultiTouch === true,
        specialRepeatExecution: settings.specialRepeatExecution === true,
        specialWeakNetwork: settings.specialWeakNetwork === true,
        specialInterruptResume: settings.specialInterruptResume === true,
      };
    }

    function getKnowledgeBaseBaseUrl() {
      var raw = state && state.settings && typeof state.settings.knowledgeBaseBaseUrl === 'string'
        ? state.settings.knowledgeBaseBaseUrl
        : '';
      if (xmindKnowledgeBaseApi && typeof xmindKnowledgeBaseApi.normalizeBaseUrl === 'function') {
        return xmindKnowledgeBaseApi.normalizeBaseUrl(raw);
      }
      return normalizeText(raw).replace(/[?#].*$/, '');
    }

    function buildKnowledgeBaseCacheKey(baseUrl, queryContext) {
      if (xmindKnowledgeBaseApi && typeof xmindKnowledgeBaseApi.buildQueryKey === 'function') {
        try {
          return xmindKnowledgeBaseApi.buildQueryKey({
            baseUrl: baseUrl,
            queryContext: queryContext || {},
          });
        } catch (err) {
          // fall through to local stable key
        }
      }
      return stableStringify({
        version: 1,
        baseUrl: baseUrl || '',
        queryContext: queryContext || {},
      });
    }

    function buildKnowledgeBaseSkipState(reason) {
      var baseUrl = getKnowledgeBaseBaseUrl();
      if (xmindKnowledgeBaseApi && typeof xmindKnowledgeBaseApi.createDefaultState === 'function') {
        var next = xmindKnowledgeBaseApi.createDefaultState();
        next.baseUrl = baseUrl;
        next.enabled = Boolean(baseUrl);
        next.ruleSearch.status = baseUrl ? 'skipped' : 'disabled';
        next.ruleSearch.reason = reason || (baseUrl ? '当前场景已跳过知识库检索' : '未配置共享知识库地址，本轮已跳过');
        next.aiFilter.status = baseUrl ? 'skipped' : 'disabled';
        next.aiFilter.reason = next.ruleSearch.reason;
        next.updatedAt = Date.now();
        return next;
      }
      return {
        baseUrl: baseUrl,
        enabled: Boolean(baseUrl),
        ruleSearch: { status: baseUrl ? 'skipped' : 'disabled', reason: reason || '' },
        aiFilter: { status: baseUrl ? 'skipped' : 'disabled', reason: reason || '' },
        injectedContextText: '',
        selectedSections: [],
        warnings: [],
      };
    }

    function getStageLabel(status) {
      if (xmindKnowledgeBaseApi && typeof xmindKnowledgeBaseApi.getStageLabel === 'function') {
        return xmindKnowledgeBaseApi.getStageLabel(status);
      }
      var stable = String(status || '');
      if (stable === 'done') return '完成';
      if (stable === 'pending') return '进行中';
      if (stable === 'skipped') return '跳过';
      if (stable === 'failed') return '失败';
      return '未启用';
    }

    function getDialog(scene) {
      var key = String(scene || 'default');
      if (dialogs[key]) return dialogs[key];
      dialogs[key] = {
        scene: key,
        open: false,
        step: STEP_REQUIREMENT,
        context: null,
        requirementMode: 'manual',
        requirementText: '',
        requirementSupplement: '',
        requirementFileName: '',
        allowRequirementDocument: true,
        loading: false,
        knowledgeBaseState: buildKnowledgeBaseSkipState('等待确认后按配置检索'),
        generationModeInvalid: false,
        statusText: '',
        statusType: '',
        resolver: null,
      };
      return dialogs[key];
    }

    function getOverlayId(scene) {
      return 'casePageAiGenPrepOverlay-' + String(scene || 'default').replace(/[^a-zA-Z0-9_-]/g, '-');
    }

    function getBodyId(scene) {
      return 'casePageAiGenPrepBody-' + String(scene || 'default').replace(/[^a-zA-Z0-9_-]/g, '-');
    }

    function closeDialog(scene, result) {
      var dialog = getDialog(scene);
      dialog.open = false;
      var overlay = document.getElementById(getOverlayId(scene));
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (dialog.resolver) {
        var resolve = dialog.resolver;
        dialog.resolver = null;
        resolve(result || { ok: false });
      }
    }

    function renderStepTabs(dialog) {
      var labels = [
        { step: STEP_REQUIREMENT, title: '需求来源' },
        { step: STEP_CASES, title: '导入用例' },
        { step: STEP_OPTIONS, title: '生成选项' },
      ];
      return '<div class="xmind-casegen-prep-stepper-row">' + labels.map(function(item) {
        var cls = 'xmind-casegen-prep-step';
        if (dialog.step === item.step) cls += ' is-active';
        if (dialog.step > item.step) cls += ' is-done';
        return '<button type="button" class="' + cls + '" data-case-page-prep-step="' + item.step + '">'
          + '<span class="xmind-casegen-prep-step-index">' + item.step + '</span>'
          + '<span>' + escapeHtml(item.title) + '</span>'
          + '</button>';
      }).join('') + '</div>';
    }

    function renderRequirementStep(dialog) {
      var allowDocument = dialog.allowRequirementDocument !== false;
      var mode = allowDocument && dialog.requirementMode === 'document' ? 'document' : 'manual';
      var docActive = mode === 'document' ? ' is-active' : '';
      var manualActive = mode === 'manual' ? ' is-active' : '';
      return ''
        + '<div class="xmind-casegen-prep-card xmind-casegen-prep-card-main">'
        +   '<div class="xmind-casegen-prep-card-head">'
        +     '<div class="xmind-casegen-prep-card-copy">'
        +       '<span class="xmind-casegen-prep-step-order">step1</span>'
        +       '<strong class="xmind-casegen-prep-card-title">需求来源</strong>'
        +     '</div>'
        +     '<span class="xmind-casegen-prep-status-badge is-' + (normalizeText(dialog.requirementText) ? 'done' : 'ready') + '">' + (normalizeText(dialog.requirementText) ? '已填写' : '待填写') + '</span>'
        +   '</div>'
        +   (allowDocument
          ? '<div class="xmind-casegen-prep-choice-grid">'
              + '<label class="xmind-casegen-prep-choice is-success' + docActive + '">'
              +   '<input type="radio" name="casePageRequirementMode-' + escapeHtml(dialog.scene) + '" value="document" ' + (mode === 'document' ? 'checked' : '') + ' />'
              +   '<span class="xmind-casegen-prep-choice-title">导入需求文档</span>'
              +   '<span class="xmind-casegen-prep-choice-desc">复用当前 AI 生成的需求导入能力，可补充说明。</span>'
              + '</label>'
              + '<label class="xmind-casegen-prep-choice is-success' + manualActive + '">'
              +   '<input type="radio" name="casePageRequirementMode-' + escapeHtml(dialog.scene) + '" value="manual" ' + (mode === 'manual' ? 'checked' : '') + ' />'
              +   '<span class="xmind-casegen-prep-choice-title">填写需求描述</span>'
              +   '<span class="xmind-casegen-prep-choice-desc">直接输入或粘贴本轮需求。</span>'
              + '</label>'
            + '</div>'
          : '<div class="xmind-casegen-prep-warning">当前页面请直接填写或调整本轮生成需求。</div>')
        +   (mode === 'document'
          ? '<div class="xmind-casegen-prep-field">'
              + '<label>需求文档</label>'
              + '<label class="zone xmind-casegen-prep-dropzone" data-case-page-prep-action="select-requirement">'
                + '<input type="file" accept=".doc,.docx,.txt,.md" hidden data-case-page-prep-file />'
                + '<div class="zone-line"><strong>原始需求</strong><span>拖拽或点击选择</span></div>'
                + '<div class="status' + (dialog.requirementFileName ? ' ok' : '') + '">' + escapeHtml(dialog.requirementFileName || '未选择文件') + '</div>'
              + '</label>'
            + '</div>'
          : '')
        +   '<div class="xmind-casegen-prep-field">'
        +     '<label for="casePageAiGenRequirementText-' + escapeHtml(dialog.scene) + '">' + (mode === 'document' ? '需求正文' : '需求描述') + '</label>'
        +     '<textarea id="casePageAiGenRequirementText-' + escapeHtml(dialog.scene) + '" data-case-page-prep-input="requirementText" placeholder="' + (allowDocument ? '请输入需求描述；也可以先导入需求文件。' : '请输入或调整本轮需求描述。') + '">' + escapeHtml(dialog.requirementText || '') + '</textarea>'
        +   '</div>'
        +   '<div class="xmind-casegen-prep-field">'
        +     '<label for="casePageAiGenRequirementSupplement-' + escapeHtml(dialog.scene) + '">需求补充</label>'
        +     '<textarea id="casePageAiGenRequirementSupplement-' + escapeHtml(dialog.scene) + '" data-case-page-prep-input="requirementSupplement" placeholder="非必填，会与需求正文一起作为生成上下文。">' + escapeHtml(dialog.requirementSupplement || '') + '</textarea>'
        +   '</div>'
        + '</div>';
    }

    function renderCasesStep(dialog) {
      var ctx = dialog.context || {};
      var cases = normalizeCaseList(ctx.cases || []);
      var title = ctx.displayName || '当前用例';
      var modules = buildModuleList(cases);
      return ''
        + '<div class="xmind-casegen-prep-card xmind-casegen-prep-card-main is-readonly">'
        +   '<div class="xmind-casegen-prep-card-head">'
        +     '<div class="xmind-casegen-prep-card-copy">'
        +       '<span class="xmind-casegen-prep-step-order">step2</span>'
        +       '<strong class="xmind-casegen-prep-card-title">是否导入用例</strong>'
        +     '</div>'
        +     '<span class="xmind-casegen-prep-status-badge is-done">已锁定</span>'
        +   '</div>'
        +   '<div class="xmind-casegen-prep-warning">当前页面会自动使用当前用例文件的全部用例作为基线，不可选择不导入，也不可改为其他来源。</div>'
        +   '<div class="xmind-casegen-prep-choice-grid">'
        +     '<label class="xmind-casegen-prep-choice is-success is-active is-readonly">'
        +       '<input type="radio" name="casePageImportMode-' + escapeHtml(dialog.scene) + '" value="import" checked disabled />'
        +       '<span class="xmind-casegen-prep-choice-title">导入已有用例</span>'
        +       '<span class="xmind-casegen-prep-choice-desc">来源：' + escapeHtml(title) + '</span>'
        +     '</label>'
        +   '</div>'
        +   '<div class="xmind-casegen-prep-context">'
        +     '<div class="xmind-casegen-prep-overview">'
        +       '<div class="xmind-casegen-prep-overview-item"><span>用例文件</span><strong>' + escapeHtml(title) + '</strong></div>'
        +       '<div class="xmind-casegen-prep-overview-item"><span>模块数</span><strong>' + String(modules.length) + '</strong></div>'
        +       '<div class="xmind-casegen-prep-overview-item"><span>用例数</span><strong>' + String(cases.length) + '</strong></div>'
        +     '</div>'
        +   '</div>'
        + '</div>';
    }

    function renderToggle(key, title, desc, checked, disabled) {
      return ''
        + '<label class="xmind-casegen-prep-toggle ' + (checked ? 'is-on' : 'is-off') + (disabled ? ' is-disabled' : '') + '">'
        +   '<input type="checkbox" data-case-page-prep-setting="' + escapeHtml(key) + '" ' + (checked ? 'checked ' : '') + (disabled ? 'disabled' : '') + '/>'
        +   '<span class="xmind-casegen-prep-toggle-main">'
        +     '<span class="xmind-casegen-prep-toggle-copy">'
        +       '<span class="xmind-casegen-prep-toggle-title">' + escapeHtml(title) + '</span>'
        +       '<span class="xmind-casegen-prep-toggle-desc">' + escapeHtml(desc) + '</span>'
        +     '</span>'
        +     '<span class="xmind-casegen-prep-toggle-switch" aria-hidden="true">'
        +       '<span class="xmind-casegen-prep-toggle-state xmind-casegen-prep-toggle-state-on">开</span>'
        +       '<span class="xmind-casegen-prep-toggle-state xmind-casegen-prep-toggle-state-off">关</span>'
        +       '<span class="xmind-casegen-prep-toggle-knob"></span>'
        +     '</span>'
        +   '</span>'
        + '</label>';
    }

    function renderGenerationModeChoice(dialog, mode, title, desc, active) {
      var cls = 'xmind-casegen-prep-choice xmind-casegen-prep-mode-choice';
      if (active) cls += ' is-active';
      return ''
        + '<label class="' + cls + '" data-case-page-prep-generation-mode-choice="' + escapeHtml(mode) + '">'
        +   '<input type="radio" name="casePageGenerationMode-' + escapeHtml(dialog.scene) + '" value="' + escapeHtml(mode) + '" ' + (active ? 'checked ' : '') + '/>'
        +   '<span class="xmind-casegen-prep-choice-title">' + escapeHtml(title) + '</span>'
        +   '<span class="xmind-casegen-prep-choice-desc">' + escapeHtml(desc) + '</span>'
        + '</label>';
    }

    function renderKnowledgeSummary(dialog) {
      var kb = dialog.knowledgeBaseState || buildKnowledgeBaseSkipState('');
      var rule = kb.ruleSearch || {};
      var ai = kb.aiFilter || {};
      var contextLen = kb.injectedContextText ? String(kb.injectedContextText || '').length : 0;
      return ''
        + '<div class="xmind-casegen-prep-option-group">'
        +   '<div class="xmind-casegen-prep-option-group-head">'
        +     '<strong class="xmind-casegen-prep-option-group-title">知识库检索</strong>'
        +     '<span class="xmind-casegen-prep-option-group-desc">确认后会按配置自动执行规则检索和 AI 精筛。</span>'
        +   '</div>'
        +   '<div class="xmind-casegen-kb-stage-grid">'
        +     '<div class="xmind-casegen-kb-stage-card"><div class="xmind-casegen-kb-stage-card-head"><strong class="xmind-casegen-kb-stage-title">规则检索：' + escapeHtml(getStageLabel(rule.status)) + '</strong></div><div class="xmind-casegen-kb-stage-reason">' + escapeHtml(rule.reason || rule.error || '等待确认后检查配置') + '</div></div>'
        +     '<div class="xmind-casegen-kb-stage-card"><div class="xmind-casegen-kb-stage-card-head"><strong class="xmind-casegen-kb-stage-title">AI筛选：' + escapeHtml(getStageLabel(ai.status)) + '</strong></div><div class="xmind-casegen-kb-stage-reason">' + escapeHtml(ai.reason || ai.error || '等待规则检索结果') + '</div></div>'
        +   '</div>'
        +   (contextLen ? '<div class="xmind-casegen-kb-used-badge">已注入知识库上下文 ' + String(contextLen) + ' 字</div>' : '')
        + '</div>';
    }

    function renderOptionsStep(dialog) {
      var settings = snapshotSettings();
      var specialDisabled = settings.needSpecial !== true;
      var generationMode = dialog.generationModeInvalid === true
        ? ''
        : normalizeGenerationMode(settings.casePageGenerationMode || '');
      var modeInvalid = dialog.generationModeInvalid === true && !generationMode;
      return ''
        + '<div class="xmind-casegen-prep-card xmind-casegen-prep-card-main">'
        +   '<div class="xmind-casegen-prep-card-head">'
        +     '<div class="xmind-casegen-prep-card-copy">'
        +       '<span class="xmind-casegen-prep-step-order">step3</span>'
        +       '<strong class="xmind-casegen-prep-card-title">生成选项</strong>'
        +     '</div>'
        +     '<span class="xmind-casegen-prep-status-badge is-ready">待确认</span>'
        +   '</div>'
        +   '<div class="xmind-casegen-prep-field">'
        +     '<label for="casePageAiGenCustomRequirement-' + escapeHtml(dialog.scene) + '">额外要求</label>'
        +     '<textarea id="casePageAiGenCustomRequirement-' + escapeHtml(dialog.scene) + '" data-case-page-prep-setting="customRequirement" placeholder="非必填，用于补充生成要求。">' + escapeHtml(settings.customRequirement || '') + '</textarea>'
        +   '</div>'
        +   '<div class="xmind-casegen-prep-option-stack">'
        +     '<div class="xmind-casegen-prep-option-group xmind-casegen-prep-generation-mode-group' + (modeInvalid ? ' is-invalid' : '') + '" data-case-page-prep-generation-mode-group>'
        +       '<div class="xmind-casegen-prep-option-group-head"><strong class="xmind-casegen-prep-option-group-title">生成模式<span class="xmind-casegen-prep-required">*</span></strong><span class="xmind-casegen-prep-option-group-desc">必选一项，决定本轮生成数量和执行时长。</span></div>'
        +       '<div class="xmind-casegen-prep-choice-grid">'
        +         renderGenerationModeChoice(dialog, GENERATION_MODE_PRECISE, '精准补充', '执行时长快，新增数量少。', generationMode === GENERATION_MODE_PRECISE)
        +         renderGenerationModeChoice(dialog, GENERATION_MODE_ENHANCED, '增强补全', '覆盖更全，执行时间稍长。', generationMode === GENERATION_MODE_ENHANCED)
        +       '</div>'
        +       (modeInvalid ? '<div class="xmind-casegen-prep-field-error">请选择一种生成模式。</div>' : '')
        +     '</div>'
        +     '<div class="xmind-casegen-prep-option-group">'
        +       '<div class="xmind-casegen-prep-option-group-head"><strong class="xmind-casegen-prep-option-group-title">去重设置</strong><span class="xmind-casegen-prep-option-group-desc">仅处理本轮 AI 生成用例，原有用例只读参与比对。</span></div>'
        +       '<div class="xmind-casegen-prep-toggle-grid">' + renderToggle('dedupeSimplify', '去重并精简', '关闭时只移除重复；开启后在保证覆盖前提下压缩冗余。', settings.dedupeSimplify) + '</div>'
        +     '</div>'
        +     '<div class="xmind-casegen-prep-option-group">'
        +       '<div class="xmind-casegen-prep-option-group-head"><strong class="xmind-casegen-prep-option-group-title">基础生成开关</strong><span class="xmind-casegen-prep-option-group-desc">与 XMind 用例生成页面保持一致。</span></div>'
        +       '<div class="xmind-casegen-prep-toggle-grid">'
        +         renderToggle('needFunctionCondition', '考虑功能使用条件', '补足解锁、可用、身份门槛、前置任务和时段限制。', settings.needFunctionCondition)
        +         renderToggle('needNumericValidation', '数值验证', '补足范围、阈值变化、累计扣减和结算正确性。', settings.needNumericValidation)
        +         renderToggle('needBoundary', '考虑边界', '补足上下限、临界值、空值和异常边界。', settings.needBoundary)
        +         renderToggle('needMobile', '考虑移动设备', '补足手势、横竖屏和系统打断等移动端场景。', settings.needMobile)
        +         renderToggle('needSpecial', '考虑特殊场景', '开启后可继续选择弱网、中断恢复等特殊场景。', settings.needSpecial)
        +       '</div>'
        +     '</div>'
        +     '<div class="xmind-casegen-prep-option-group ' + (specialDisabled ? 'is-disabled' : '') + '">'
        +       '<div class="xmind-casegen-prep-option-group-head"><strong class="xmind-casegen-prep-option-group-title">特殊场景细项</strong><span class="xmind-casegen-prep-option-group-desc">' + (specialDisabled ? '先开启“考虑特殊场景”，再选择具体细项。' : '按需补足本轮要覆盖的特殊场景。') + '</span></div>'
        +       '<div class="xmind-casegen-prep-toggle-grid xmind-casegen-prep-toggle-grid-compact">'
        +         renderToggle('specialRepeatOperation', '重复操作', '连续点击、重复提交或重复领取。', settings.specialRepeatOperation, specialDisabled)
        +         renderToggle('specialMultiTouch', '多点触控', '双指、误触连击和多点同时操作。', settings.specialMultiTouch, specialDisabled)
        +         renderToggle('specialRepeatExecution', '重复执行', '反复进入退出和连续重复执行流程。', settings.specialRepeatExecution, specialDisabled)
        +         renderToggle('specialWeakNetwork', '弱网', '高延迟、超时、断续连接和重试恢复。', settings.specialWeakNetwork, specialDisabled)
        +         renderToggle('specialInterruptResume', '中断恢复', '来电、切后台、锁屏或重启后的恢复。', settings.specialInterruptResume, specialDisabled)
        +       '</div>'
        +     '</div>'
        +     renderKnowledgeSummary(dialog)
        +   '</div>'
        + '</div>';
    }

    function renderFooter(dialog) {
      var nextDisabled = dialog.step === STEP_REQUIREMENT && !normalizeText(dialog.requirementText);
      var status = dialog.statusText
        ? '<span class="status ' + (dialog.statusType || '') + '">' + escapeHtml(dialog.statusText) + '</span>'
        : '<span></span>';
      return ''
        + '<div class="xmind-casegen-prep-footer">'
        +   '<div class="xmind-casegen-prep-footer-side">' + status + '</div>'
        +   '<div class="xmind-casegen-prep-nav">'
        +     (dialog.step > STEP_REQUIREMENT ? '<button type="button" class="secondary" data-case-page-prep-nav="prev" ' + (dialog.loading ? 'disabled' : '') + '>上一步</button>' : '')
        +     '<div class="xmind-casegen-prep-nav-main">'
        +       (dialog.step < STEP_OPTIONS
          ? '<button type="button" data-case-page-prep-nav="next" ' + (nextDisabled || dialog.loading ? 'disabled' : '') + '>下一步</button>'
          : '<button type="button" data-case-page-prep-nav="confirm" ' + (dialog.loading ? 'disabled' : '') + '>' + (dialog.loading ? '生成中...' : '确认并保存') + '</button>')
        +     '</div>'
        +   '</div>'
        + '</div>';
    }

    function renderDialog(scene) {
      var dialog = getDialog(scene);
      var body = document.getElementById(getBodyId(scene));
      if (!body) return;
      var main = dialog.step === STEP_REQUIREMENT
        ? renderRequirementStep(dialog)
        : (dialog.step === STEP_CASES ? renderCasesStep(dialog) : renderOptionsStep(dialog));
      body.innerHTML = '<div class="xmind-casegen-prep-flow">'
        + renderStepTabs(dialog)
        + main
        + renderFooter(dialog)
        + '</div>';
    }

    function openDialog(context) {
      context = context || {};
      var scene = context.scene || 'default';
      var dialog = getDialog(scene);
      dialog.context = {
        scene: scene,
        displayName: context.displayName || '当前用例',
        caseFileId: context.caseFileId || '',
        projectId: context.projectId || '',
        versionId: context.versionId || '',
        cases: normalizeCaseList(context.cases || []),
      };
      dialog.step = STEP_REQUIREMENT;
      dialog.allowRequirementDocument = context.allowRequirementDocument !== false;
      dialog.requirementMode = dialog.allowRequirementDocument !== false && dialog.requirementMode === 'document' ? 'document' : 'manual';
      dialog.requirementText = normalizeText(context.requirementText || dialog.requirementText || '');
      dialog.requirementSupplement = normalizeText(context.requirementSupplement || dialog.requirementSupplement || '');
      dialog.requirementFileName = '';
      dialog.loading = false;
      dialog.statusText = '';
      dialog.statusType = '';
      dialog.knowledgeBaseState = buildKnowledgeBaseSkipState('等待确认后按配置检索');
      dialog.generationModeInvalid = false;
      dialog.open = true;
      var settings = ensureSettings();
      if (!normalizeGenerationMode(settings.casePageGenerationMode || '')) {
        settings.casePageGenerationMode = GENERATION_MODE_ENHANCED;
      }

      var overlayId = getOverlayId(scene);
      var existing = document.getElementById(overlayId);
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      var overlay = document.createElement('div');
      overlay.className = 'xmind-casegen-summary-overlay case-page-ai-gen-prep-overlay';
      overlay.id = overlayId;
      overlay.setAttribute('aria-hidden', 'false');
      overlay.innerHTML = ''
        + '<div class="xmind-casegen-summary-dialog case-page-ai-gen-prep-dialog" role="dialog" aria-modal="true" aria-labelledby="' + overlayId + '-title">'
        +   '<div class="xmind-casegen-summary-dialog-head">'
        +     '<div class="xmind-casegen-summary-dialog-copy">'
        +       '<strong class="xmind-casegen-summary-dialog-title" id="' + overlayId + '-title">生成前置准备</strong>'
        +       '<p class="hint xmind-casegen-summary-dialog-desc">按 3 步完成前置准备，确认后会立即开始生成。</p>'
        +     '</div>'
        +     '<div class="xmind-casegen-summary-dialog-actions"><button class="link-toggle" type="button" data-case-page-prep-close>关闭</button></div>'
        +   '</div>'
        +   '<div class="xmind-casegen-summary-dialog-body" id="' + getBodyId(scene) + '"></div>'
        + '</div>';
      document.body.appendChild(overlay);
      bindOverlayEvents(overlay, scene);
      renderDialog(scene);
      return new Promise(function(resolve) {
        dialog.resolver = resolve;
      });
    }

    function bindOverlayEvents(overlay, scene) {
      overlay.addEventListener('click', function(event) {
        var target = event && event.target ? event.target : null;
        if (!target) return;
        if (target === overlay || (target.getAttribute && target.getAttribute('data-case-page-prep-close') !== null)) {
          closeDialog(scene, { ok: false, cancelled: true });
          return;
        }
        var stepBtn = target.closest ? target.closest('[data-case-page-prep-step]') : null;
        if (stepBtn) {
          var requested = Number(stepBtn.getAttribute('data-case-page-prep-step') || 1);
          navigateStep(scene, requested);
          return;
        }
        var nav = target.closest ? target.closest('[data-case-page-prep-nav]') : null;
        if (nav) {
          handleNav(scene, nav.getAttribute('data-case-page-prep-nav'));
        }
      });
      overlay.addEventListener('change', function(event) {
        var target = event && event.target ? event.target : null;
        if (!target) return;
        if (target.name && String(target.name).indexOf('casePageRequirementMode-') === 0) {
          var dialog = getDialog(scene);
          if (dialog.allowRequirementDocument === false) {
            dialog.requirementMode = 'manual';
            renderDialog(scene);
            return;
          }
          dialog.requirementMode = target.value === 'document' ? 'document' : 'manual';
          renderDialog(scene);
          return;
        }
        if (target.name && String(target.name).indexOf('casePageGenerationMode-') === 0) {
          var mode = normalizeGenerationMode(target.value || '');
          updateSetting('casePageGenerationMode', mode);
          var modeDialog = getDialog(scene);
          modeDialog.generationModeInvalid = false;
          modeDialog.statusText = '';
          modeDialog.statusType = '';
          renderDialog(scene);
          return;
        }
        if (target.getAttribute && target.getAttribute('data-case-page-prep-setting')) {
          updateSetting(target.getAttribute('data-case-page-prep-setting'), target.type === 'checkbox' ? target.checked : target.value);
          renderDialog(scene);
          return;
        }
        if (target.getAttribute && target.getAttribute('data-case-page-prep-file') !== null) {
          var file = target.files && target.files[0] ? target.files[0] : null;
          if (file) readRequirementFile(scene, file);
          try { target.value = ''; } catch (_) {}
        }
      });
      overlay.addEventListener('input', function(event) {
        var target = event && event.target ? event.target : null;
        if (!target || !target.getAttribute) return;
        var inputKey = target.getAttribute('data-case-page-prep-input');
        if (inputKey) {
          var dialog = getDialog(scene);
          dialog[inputKey] = String(target.value || '');
          renderFooterOnly(scene);
          return;
        }
        var settingKey = target.getAttribute('data-case-page-prep-setting');
        if (settingKey === 'customRequirement') {
          updateSetting(settingKey, target.value || '');
        }
      });
      overlay.addEventListener('dragover', function(event) {
        var zone = event && event.target && event.target.closest ? event.target.closest('[data-case-page-prep-action="select-requirement"]') : null;
        if (!zone) return;
        event.preventDefault();
        zone.classList.add('dragover');
      });
      overlay.addEventListener('dragleave', function(event) {
        var zone = event && event.target && event.target.closest ? event.target.closest('[data-case-page-prep-action="select-requirement"]') : null;
        if (zone) zone.classList.remove('dragover');
      });
      overlay.addEventListener('drop', function(event) {
        var zone = event && event.target && event.target.closest ? event.target.closest('[data-case-page-prep-action="select-requirement"]') : null;
        if (!zone) return;
        event.preventDefault();
        zone.classList.remove('dragover');
        var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0] ? event.dataTransfer.files[0] : null;
        if (file) readRequirementFile(scene, file);
      });
    }

    function renderFooterOnly(scene) {
      var dialog = getDialog(scene);
      var overlay = document.getElementById(getOverlayId(scene));
      if (!overlay) return;
      var nextBtn = overlay.querySelector('[data-case-page-prep-nav="next"]');
      if (nextBtn) {
        var nextDisabled = dialog.step === STEP_REQUIREMENT && !normalizeText(dialog.requirementText);
        nextBtn.disabled = Boolean(nextDisabled || dialog.loading);
      }
      if (dialog.step === STEP_REQUIREMENT) {
        var badge = overlay.querySelector('.xmind-casegen-prep-card-head .xmind-casegen-prep-status-badge');
        if (badge) {
          var done = Boolean(normalizeText(dialog.requirementText));
          badge.textContent = done ? '已填写' : '待填写';
          badge.className = 'xmind-casegen-prep-status-badge is-' + (done ? 'done' : 'ready');
        }
      }
    }

    function navigateStep(scene, requested) {
      var dialog = getDialog(scene);
      if (dialog.loading) return;
      var next = Math.max(STEP_REQUIREMENT, Math.min(STEP_OPTIONS, Number(requested) || STEP_REQUIREMENT));
      if (next > STEP_REQUIREMENT && !normalizeText(dialog.requirementText)) next = STEP_REQUIREMENT;
      dialog.step = next;
      renderDialog(scene);
    }

    function handleNav(scene, action) {
      var dialog = getDialog(scene);
      if (dialog.loading) return;
      if (action === 'prev') {
        navigateStep(scene, dialog.step - 1);
        return;
      }
      if (action === 'next') {
        navigateStep(scene, dialog.step + 1);
        return;
      }
      if (action === 'confirm') {
        confirmAndBuild(scene);
      }
    }

    function updateSetting(key, value) {
      var settings = ensureSettings();
      if (key === 'customRequirement') {
        settings.customRequirement = String(value || '');
      } else if (key === 'casePageGenerationMode') {
        settings.casePageGenerationMode = normalizeGenerationMode(value || '');
      } else {
        settings[key] = value === true;
        if (key === 'needSpecial' && value !== true) {
          settings.specialRepeatOperation = false;
          settings.specialMultiTouch = false;
          settings.specialRepeatExecution = false;
          settings.specialWeakNetwork = false;
          settings.specialInterruptResume = false;
        }
      }
      if (window.app && typeof window.app.persistWorkflowState === 'function') {
        window.app.persistWorkflowState();
      }
    }

    function readRequirementFile(scene, file) {
      var dialog = getDialog(scene);
      if (!file) return;
      dialog.requirementFileName = file.name || '';
      dialog.statusText = '正在读取文件...';
      dialog.statusType = '';
      renderDialog(scene);
      var ext = file.name && file.name.split ? (file.name.split('.').pop() || '').toLowerCase() : '';
      var readPromise;
      if (ext === 'docx' && window.JSZip) {
        readPromise = file.arrayBuffer().then(function(buffer) {
          return window.JSZip.loadAsync(buffer);
        }).then(function(zip) {
          var docFile = zip.file('word/document.xml') || zip.file('word/document2.xml');
          if (!docFile) throw new Error('docx 内容缺失，未找到 word/document.xml');
          return docFile.async('string');
        }).then(function(xml) {
          var parts = [];
          xml.replace(/<w:p[\s\S]*?<\/w:p>/g, function(para) {
            var texts = [];
            para.replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, function(_, text) {
              texts.push(text);
              return '';
            });
            var merged = decodeXmlEntities(texts.join('')).replace(/\s+/g, ' ').trim();
            if (merged) parts.push(merged);
            return '';
          });
          return parts.join('\n\n') || decodeXmlEntities(xml.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
        });
      } else {
        readPromise = file.text();
      }
      Promise.resolve(readPromise)
        .then(function(text) {
          dialog.requirementText = String(text || '');
          dialog.statusText = '文件读取完成';
          dialog.statusType = 'ok';
          renderDialog(scene);
        })
        .catch(function(err) {
          dialog.statusText = '读取失败：' + (err && err.message ? err.message : '未知错误');
          dialog.statusType = 'err';
          renderDialog(scene);
        });
    }

    function decodeXmlEntities(text) {
      return String(text || '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
    }

    function buildOptionsText(settings) {
      var lines = [];
      var generationModeMeta = getGenerationModeMeta(settings.casePageGenerationMode || '');
      if (generationModeMeta.mode) {
        lines.push('生成模式：' + generationModeMeta.title + '（' + generationModeMeta.shortDesc + '）');
        if (generationModeMeta.coveragePolicy === 'ignore_for_generation') {
          lines.push('增强补全强策略：忽略覆盖率停生成规则，coverage_threshold 仅作参考。');
        }
      }
      if (settings.customRequirement) lines.push('额外要求：' + settings.customRequirement);
      if (settings.needFunctionCondition) lines.push('考虑功能使用条件');
      if (settings.needNumericValidation) lines.push('数值验证');
      if (settings.needBoundary) lines.push('考虑边界');
      if (settings.needMobile) lines.push('考虑移动设备');
      if (settings.needSpecial) {
        var special = [];
        if (settings.specialRepeatOperation) special.push('重复操作');
        if (settings.specialMultiTouch) special.push('多点触控');
        if (settings.specialRepeatExecution) special.push('重复执行');
        if (settings.specialWeakNetwork) special.push('弱网');
        if (settings.specialInterruptResume) special.push('中断恢复');
        lines.push('考虑特殊场景' + (special.length ? '：' + special.join('、') : ''));
      }
      if (settings.dedupeSimplify) lines.push('生成后去重并精简，原有用例只读保护');
      else lines.push('生成后仅去重，原有用例只读保护');
      return lines.join('\n');
    }

    function focusGenerationModeGroup(scene) {
      setTimeout(function() {
        var overlay = document.getElementById(getOverlayId(scene));
        if (!overlay) return;
        var target = overlay.querySelector('[data-case-page-prep-generation-mode-group]');
        if (target && target.scrollIntoView) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (target && target.classList) {
          target.classList.add('is-invalid');
        }
      }, 0);
    }

    function resolveSelectedGenerationMode(scene, settings) {
      var overlay = document.getElementById(getOverlayId(scene));
      if (overlay && overlay.querySelectorAll) {
        var inputs = overlay.querySelectorAll('input[type="radio"]');
        for (var i = 0; i < inputs.length; i += 1) {
          var input = inputs[i];
          if (!input || !input.name || String(input.name).indexOf('casePageGenerationMode-') !== 0) continue;
          if (input.checked) return normalizeGenerationMode(input.value || '');
        }
        return '';
      }
      return normalizeGenerationMode(settings && settings.casePageGenerationMode ? settings.casePageGenerationMode : '');
    }

    async function runKnowledgeBase(dialog, model, reasoning, temperature) {
      var baseUrl = getKnowledgeBaseBaseUrl();
      if (!baseUrl) {
        return buildKnowledgeBaseSkipState('未配置共享知识库地址，本轮已跳过');
      }
      if (!xmindKnowledgeBaseApi || typeof xmindKnowledgeBaseApi.runPipeline !== 'function') {
        return buildKnowledgeBaseSkipState('知识库模块不可用，本轮已跳过');
      }
      var context = dialog.context || {};
      var queryContext = {
        requirementLabel: context.displayName || '当前用例',
        requirementText: dialog.requirementText || '',
        requirementSupplement: dialog.requirementSupplement || '',
        requirementMode: dialog.allowRequirementDocument === false ? 'manual' : (dialog.requirementMode || 'manual'),
        operationType: 'case-page-ai-gen',
      };
      var cacheKey = buildKnowledgeBaseCacheKey(baseUrl, queryContext);
      if (cacheKey && knowledgeBaseCache[cacheKey]) {
        var cached = cloneJson(knowledgeBaseCache[cacheKey], null);
        if (cached) {
          cached.cached = true;
          cached.updatedAt = Date.now();
          return cached;
        }
      }
      return xmindKnowledgeBaseApi.runPipeline({
        baseUrl: baseUrl,
        workspaceId: 'case-page-' + String(dialog.scene || 'default') + '-' + String(context.caseFileId || ''),
        requestId: 'case-page-kb-' + Date.now().toString(36),
        queryContext: queryContext,
        model: model,
        reasoning: reasoning || '',
        temperature: temperature,
        callModel: callModelWithConfig,
        onStateChange: function(nextState) {
          dialog.knowledgeBaseState = nextState;
          renderDialog(dialog.scene);
        },
      }).then(function(nextState) {
        if (cacheKey && nextState && nextState.enabled !== false) {
          knowledgeBaseCache[cacheKey] = cloneJson(nextState, null);
        }
        return nextState;
      });
    }

    async function confirmAndBuild(scene) {
      var dialog = getDialog(scene);
      if (!normalizeText(dialog.requirementText)) {
        dialog.statusText = '请先填写需求内容';
        dialog.statusType = 'warn';
        dialog.step = STEP_REQUIREMENT;
        renderDialog(scene);
        return;
      }
      var currentSettings = snapshotSettings();
      var selectedGenerationMode = resolveSelectedGenerationMode(scene, currentSettings);
      if (!selectedGenerationMode) {
        dialog.statusText = '请选择一种生成模式';
        dialog.statusType = 'warn';
        dialog.step = STEP_OPTIONS;
        dialog.generationModeInvalid = true;
        renderDialog(scene);
        focusGenerationModeGroup(scene);
        return;
      }
      currentSettings.casePageGenerationMode = selectedGenerationMode;
      updateSetting('casePageGenerationMode', selectedGenerationMode);
      dialog.loading = true;
      dialog.statusText = '正在准备生成上下文...';
      dialog.statusType = '';
      dialog.generationModeInvalid = false;
      renderDialog(scene);
      var settings = currentSettings;
      var context = dialog.context || {};
      var model = context.model || null;
      var reasoning = context.reasoning || '';
      var temperature = context.temperature;
      var kbState = null;
      try {
        kbState = await runKnowledgeBase(dialog, model, reasoning, temperature);
      } catch (err) {
        kbState = buildKnowledgeBaseSkipState(err && err.message ? err.message : '知识库检索失败，本轮已跳过');
      }
      dialog.knowledgeBaseState = kbState || buildKnowledgeBaseSkipState('');
      var result = buildGenerationContext(dialog, settings, dialog.knowledgeBaseState);
      closeDialog(scene, { ok: true, value: result });
    }

    function buildGenerationContext(dialog, settings, kbState) {
      var context = dialog.context || {};
      var existingCases = normalizeCaseList(context.cases || []);
      var knowledgeText = kbState && kbState.injectedContextText ? String(kbState.injectedContextText || '') : '';
      var optionsText = buildOptionsText(settings);
      var generationModeMeta = getGenerationModeMeta(settings.casePageGenerationMode || '');
      var payloadExtra = {
        generation_options: settings,
        coverage_threshold_policy: generationModeMeta.coveragePolicy === 'ignore_for_generation'
          ? 'ignore_for_enhanced_strong_completion'
          : 'hard_threshold',
        coverage_threshold_can_skip_module: generationModeMeta.coveragePolicy !== 'ignore_for_generation',
        xmind_generation_context: {
          requirement_mode: dialog.allowRequirementDocument === false ? 'manual' : (dialog.requirementMode || 'manual'),
          requirement_label: context.displayName || '当前用例',
          requirement_supplement: dialog.requirementSupplement || '',
          option_summary: optionsText,
          generation_mode: generationModeMeta.mode,
          generation_mode_label: generationModeMeta.title,
          generation_strategy: generationModeMeta.strategy,
          coverage_policy: generationModeMeta.coveragePolicy,
        },
        case_page_generation_mode: {
          mode: generationModeMeta.mode,
          label: generationModeMeta.title,
          strategy: generationModeMeta.strategy,
          coverage_policy: generationModeMeta.coveragePolicy,
          ignore_coverage_threshold: generationModeMeta.coveragePolicy === 'ignore_for_generation',
          speed: generationModeMeta.mode === GENERATION_MODE_PRECISE ? 'fast' : 'slower',
          expected_case_count: generationModeMeta.mode === GENERATION_MODE_PRECISE ? 'fewer' : 'more_complete',
          instruction: generationModeMeta.prompt,
        },
        generation_policy: {
          strategy: generationModeMeta.strategy,
          coverage_threshold_behavior: generationModeMeta.coveragePolicy === 'ignore_for_generation'
            ? 'ignore_for_generation_and_do_not_skip_modules'
            : 'hard_threshold_for_generation',
          must_generate_for_relevant_existing_modules: generationModeMeta.coveragePolicy === 'ignore_for_generation',
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
          enabled: Boolean(kbState && kbState.enabled),
          rule_status: kbState && kbState.ruleSearch ? kbState.ruleSearch.status : '',
          ai_status: kbState && kbState.aiFilter ? kbState.aiFilter.status : '',
          injected_context: knowledgeText,
        },
      };
      var promptContext = [
        generationModeMeta.prompt ? ('【执行页/用例库生成模式】\n' + generationModeMeta.prompt) : '',
        optionsText ? ('【XMind 用例生成选项】\n' + optionsText) : '',
        knowledgeText || '',
        '【导入已有用例规则】\n第二步已锁定为导入当前页面当前用例文件的全部用例；这些用例是只读基线，只能用于覆盖分析和重复判断。',
        '【去重保护规则】\n生成完成后只针对本轮生成用例去重；如果生成用例之间重复，或生成用例与原有用例重复，只能删除或合并生成用例，不能改动原有用例。',
      ].filter(Boolean).join('\n\n');
      return {
        requirementText: dialog.requirementText || '',
        requirementSupplement: dialog.requirementSupplement || '',
        requirementFileName: dialog.requirementFileName || '',
        settings: settings,
        knowledgeBaseState: cloneJson(kbState, null),
        payloadExtra: payloadExtra,
        promptContext: promptContext,
        sourceCases: existingCases,
      };
    }

    function enrichPayload(basePayload, prep) {
      var payload = cloneJson(basePayload || {}, {});
      var extra = prep && prep.payloadExtra ? prep.payloadExtra : {};
      Object.keys(extra).forEach(function(key) {
        payload[key] = extra[key];
      });
      if (prep && prep.requirementSupplement) payload.requirement_supplement = prep.requirementSupplement;
      if (prep && prep.promptContext) payload.xmind_context_reference = prep.promptContext;
      return payload;
    }

    function enrichPrompt(prompt, prep) {
      var base = prompt === undefined || prompt === null ? '' : String(prompt || '').trim();
      var contextText = prep && prep.promptContext ? String(prep.promptContext || '').trim() : '';
      var guide = config && config.caseWritingStyleGuidePrompt ? String(config.caseWritingStyleGuidePrompt || '').trim() : '';
      var parts = [base];
      if (contextText) parts.push(contextText);
      if (guide && base.indexOf('AI_CASE_WRITING_STYLE_GUIDE.md') === -1) parts.push(guide);
      return parts.filter(Boolean).join('\n\n');
    }

    function buildProtectedAiDedupePrompt(options) {
      var simplify = options && options.dedupeSimplify === true;
      return [
        '你是资深测试用例评审专家，请对“本轮 AI 生成用例”做整份用例级语义去重。',
        '必须保护原有用例：original_cases_readonly 只能作为重复判断基线，绝对不得修改、删除、合并或返回改写后的原有用例。',
        '可编辑范围只有 generated_cases_editable；如果生成用例与原有用例语义重复，只能删除或合并生成用例。',
        '必须全局扫描所有模块内和跨模块的生成用例；不要因为模块不同就跳过语义重复。',
        '重复判断要看测试目的、测试点、触发条件、关键步骤、预期校验和风险覆盖；标题或模块名不同但验证同一件事，也应判为重复。',
        simplify
          ? '本次策略：去重并精简。允许在不降低覆盖和缺陷发现能力的前提下合并生成用例。'
          : '本次策略：仅去重。只删除或合并明确语义重复的生成用例，不要为了减少数量而删掉有独立覆盖价值的用例。',
        '如果不确定某条生成用例是否冗余，应保留。',
        '返回只允许包含筛选后的 generated_modules 和 removed_cases，不得返回 original_cases_readonly。',
        'generated_modules 必须使用输入模块结构，cases 只包含保留后的生成用例；没有保留用例的模块可以省略。',
        'removed_cases 逐条说明被移除的生成用例，type 可为 duplicate_with_original、duplicate_generated 或 merge。',
        '只返回 JSON，不要输出解释、Markdown 或代码块。',
        '返回格式：{"generated_modules":[{"module":"模块名","coverage":60,"missing":false,"cases":[{"module":"模块名","title":"标题","priority":"P1","precondition":"","steps":"步骤","expected":"预期","remark":""}]}],"removed_cases":[{"type":"duplicate_with_original","module":"模块名","title":"被移除标题","reason":"与原用例重复","duplicate_with":"保留用例标题"}],"summary":{"removed":0,"reason":"简述"}}',
      ].join('\n');
    }

    function buildProtectedAiDedupeRequest(parsed, existingCases, prep, options) {
      var data = parsed && typeof parsed === 'object' ? parsed : {};
      var generatedModules = Array.isArray(data.modules) ? data.modules : [];
      var sourceCases = normalizeCaseList(existingCases || []);
      var settings = options || {};
      var payload = {
        operation_contract: {
          scope: 'case_page_generated_cases',
          mode: settings.dedupeSimplify === true ? 'semantic_dedupe_simplify' : 'semantic_dedupe_only',
          original_cases_readonly: true,
          generated_cases_editable: true,
          editable_scope: 'generated_cases_only',
          return_policy: 'return_kept_generated_cases_only',
          dedupe_scope: 'whole_case_file_global',
          cross_module_dedupe: true,
          protect_original_cases: true,
        },
        requirement: {
          text: prep && prep.requirementText ? String(prep.requirementText || '') : '',
          supplement: prep && prep.requirementSupplement ? String(prep.requirementSupplement || '') : '',
        },
        original_cases_readonly: sourceCases,
        generated_cases_editable: generatedModules,
      };
      return {
        prompt: buildProtectedAiDedupePrompt(settings),
        userText: JSON.stringify(payload, null, 2),
        generatedModules: generatedModules,
      };
    }

    function normalizeAiDedupeModules(rawModules, fallbackModules) {
      var source = Array.isArray(rawModules) ? rawModules : [];
      var output = [];
      source.forEach(function(mod) {
        if (!mod || typeof mod !== 'object') return;
        var cases = Array.isArray(mod.cases) ? mod.cases : [];
        if (!cases.length) return;
        var moduleName = normalizeText(mod.module || mod.module_name || mod.title || '');
        var nextMod = Object.assign({}, mod);
        nextMod.module = moduleName || (mod.module || '');
        nextMod.cases = cases;
        output.push(nextMod);
      });
      if (!output.length && Array.isArray(fallbackModules) && fallbackModules.length) return [];
      return output;
    }

    function countModuleCases(modules) {
      var source = Array.isArray(modules) ? modules : [];
      var total = 0;
      source.forEach(function(mod) {
        var cases = mod && Array.isArray(mod.cases) ? mod.cases : [];
        total += cases.length;
      });
      return total;
    }

    async function applyAiDedupeToParsed(parsed, existingCases, prep, modelOptions) {
      var data = parsed && typeof parsed === 'object' ? parsed : {};
      if (!data || data.error || !Array.isArray(data.modules) || !data.modules.length) return data;
      if (!modelOptions || typeof modelOptions.callModelWithConfig !== 'function' || !modelOptions.model) return data;
      var beforeCount = countModuleCases(data.modules);
      var request = buildProtectedAiDedupeRequest(data, existingCases, prep || {}, prep && prep.settings ? prep.settings : {});
      var content = '';
      try {
        content = await modelOptions.callModelWithConfig(
          modelOptions.model,
          request.userText,
          request.prompt,
          modelOptions.reasoning || '',
          modelOptions.temperature
        );
      } catch (err) {
        data.ai_dedupe_error = err && err.message ? err.message : 'AI 语义去重失败，已保留原始生成结果';
        return data;
      }
      var payload = parseJsonPayload(content);
      if (!payload || typeof payload !== 'object') {
        data.ai_dedupe_error = 'AI 语义去重返回格式不正确，已保留原始生成结果';
        return data;
      }
      var modules = normalizeAiDedupeModules(payload.generated_modules || payload.modules, data.modules);
      var aiRemoved = Array.isArray(payload.removed_cases) ? payload.removed_cases : [];
      var afterCount = countModuleCases(modules);
      var removedCount = Math.max(0, beforeCount - afterCount);
      data.modules = modules;
      data.ai_dedupe = {
        enabled: true,
        removedCases: aiRemoved,
        beforeCount: beforeCount,
        afterCount: afterCount,
        removedCount: removedCount,
        summary: payload.summary || null,
      };
      data.removed_cases = aiRemoved;
      return data;
    }

    return {
      open: openDialog,
      enrichPayload: enrichPayload,
      enrichPrompt: enrichPrompt,
      isEnhancedGenerationContext: isEnhancedGenerationContext,
      buildXmindEnhancedPipelineRequest: buildXmindEnhancedPipelineRequest,
      applyAiDedupeToParsed: applyAiDedupeToParsed,
      normalizeCaseList: normalizeCaseList,
      buildModuleList: buildModuleList,
      groupCasesByModule: groupCasesByModule,
    };
  }

  window.app = window.app || {};
  window.app.casePageAiGenPrep = { init: init };
})();
