(function() {
  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var config = ctx.config || (window.app && window.app.config) || {};
    var core = ctx.core || (window.app && window.app.core) || {};
    var apiClient = ctx.apiClient || (window.app && window.app.apiClient) || null;
    var xmindPipeline = ctx.xmindPipeline || (window.app && window.app.casePageXmindPipeline) || null;
    var prepCoreOwner = ctx.prepCoreOwner || (window.app && window.app.casePageAiGenPrepCore) || null;
    var fileParserOwner = ctx.fileParserOwner || (window.app && window.app.casePageAiGenFileParser) || null;
    if (!prepCoreOwner || typeof prepCoreOwner.create !== 'function') throw new Error('用例生成准备核心未加载');
    if (!fileParserOwner || typeof fileParserOwner.create !== 'function') throw new Error('需求文件解析器未加载');
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
    var prepCore = prepCoreOwner.create({
      state: state,
      config: config,
      xmindPipeline: xmindPipeline,
      xmindKnowledgeBaseApi: xmindKnowledgeBaseApi,
      callModelWithConfig: callModelWithConfig,
    });
    var fileParser = fileParserOwner.create({
      getJSZip: function() { return window.JSZip || null; },
    });
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

    var normalizeText = xmindPipeline.normalizeText;
    var normalizeGenerationMode = prepCore.normalizeGenerationMode;
    var getGenerationModeMeta = prepCore.getGenerationModeMeta;
    var normalizeCaseList = prepCore.normalizeCaseList;
    var buildModuleList = prepCore.buildModuleList;
    var buildKnowledgeBaseSkipState = prepCore.buildKnowledgeBaseSkipState;
    var getStageLabel = prepCore.getStageLabel;
    var ensureSettings = prepCore.ensureSettings;
    var snapshotSettings = prepCore.snapshotSettings;

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
          try { target.value = ''; } catch {}
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
      fileParser.read(file)
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
        kbState = await prepCore.runKnowledgeBase({
          scene: dialog.scene,
          context: context,
          requirementText: dialog.requirementText,
          requirementSupplement: dialog.requirementSupplement,
          requirementMode: dialog.requirementMode,
          allowRequirementDocument: dialog.allowRequirementDocument,
          model: model,
          reasoning: reasoning,
          temperature: temperature,
          onStateChange: function(nextState) {
            dialog.knowledgeBaseState = nextState;
            renderDialog(dialog.scene);
          },
        });
      } catch (err) {
        kbState = buildKnowledgeBaseSkipState(err && err.message ? err.message : '知识库检索失败，本轮已跳过');
      }
      dialog.knowledgeBaseState = kbState || buildKnowledgeBaseSkipState('');
      var result = prepCore.buildGenerationContext(dialog, settings, dialog.knowledgeBaseState);
      closeDialog(scene, { ok: true, value: result });
    }

    return {
      open: openDialog,
      enrichPayload: prepCore.enrichPayload,
      enrichPrompt: prepCore.enrichPrompt,
      isEnhancedGenerationContext: prepCore.isEnhancedGenerationContext,
      buildXmindEnhancedPipelineRequest: prepCore.buildXmindEnhancedPipelineRequest,
      applyAiDedupeToParsed: prepCore.applyAiDedupeToParsed,
      normalizeCaseList: prepCore.normalizeCaseList,
      buildModuleList: prepCore.buildModuleList,
      groupCasesByModule: prepCore.groupCasesByModule,
    };
  }

  window.app = window.app || {};
  window.app.casePageAiGenPrep = { init: init };
})();
