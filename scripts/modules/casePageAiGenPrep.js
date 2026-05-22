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

    function ensureSettings() {
      if (!state.caseGenSettings || typeof state.caseGenSettings !== 'object') {
        state.caseGenSettings = {};
      }
      var settings = state.caseGenSettings;
      if (settings.customRequirement === undefined || settings.customRequirement === null) settings.customRequirement = '';
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
      dialog.open = true;

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
      dialog.loading = true;
      dialog.statusText = '正在准备生成上下文...';
      dialog.statusType = '';
      renderDialog(scene);
      var settings = snapshotSettings();
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
      var payloadExtra = {
          generation_options: settings,
        xmind_generation_context: {
          requirement_mode: dialog.allowRequirementDocument === false ? 'manual' : (dialog.requirementMode || 'manual'),
          requirement_label: context.displayName || '当前用例',
          requirement_supplement: dialog.requirementSupplement || '',
          option_summary: optionsText,
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

    async function applyAiDedupeToParsed(parsed, existingCases, prep, modelOptions) {
      var data = parsed && typeof parsed === 'object' ? parsed : {};
      if (!data || data.error || !Array.isArray(data.modules) || !data.modules.length) return data;
      if (!modelOptions || typeof modelOptions.callModelWithConfig !== 'function' || !modelOptions.model) return data;
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
      data.modules = modules;
      data.ai_dedupe = {
        enabled: true,
        removedCases: aiRemoved,
        summary: payload.summary || null,
      };
      data.removed_cases = aiRemoved;
      return data;
    }

    return {
      open: openDialog,
      enrichPayload: enrichPayload,
      enrichPrompt: enrichPrompt,
      applyAiDedupeToParsed: applyAiDedupeToParsed,
      normalizeCaseList: normalizeCaseList,
      buildModuleList: buildModuleList,
      groupCasesByModule: groupCasesByModule,
    };
  }

  window.app = window.app || {};
  window.app.casePageAiGenPrep = { init: init };
})();
