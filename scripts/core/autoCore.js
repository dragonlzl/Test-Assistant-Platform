(function() {
  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var dom = ctx.dom || {};
    var pickEl = function(el, id) {
      if (el) return el;
      if (typeof document !== 'undefined') return document.getElementById(id);
      return null;
    };
    var handlers = ctx.handlers || {};
    var utils = ctx.utils || {};

    var setStatus = ctx.setStatus || handlers.setStatus || function() {};
    var setStepFailed = handlers.setStepFailed || function() {};
    var clearStepFailed = handlers.clearStepFailed || function() {};
    var clearAllFailedSteps = handlers.clearAllFailedSteps || function() {};
    var setStepInProgress = handlers.setStepInProgress || function() {};
    var clearStepInProgress = handlers.clearStepInProgress || function() {};
    var setStepWaiting = handlers.setStepWaiting || function() {};
    var clearStepWaiting = handlers.clearStepWaiting || function() {};
    var clearAllWaitingSteps = handlers.clearAllWaitingSteps || function() {};
    var updateFlowStatus = handlers.updateFlowStatus || function() {};
    var updateMissingView = handlers.updateMissingView || function() {};
    var persistWorkflowState = handlers.persistWorkflowState || function() {};
    var parseMissingModules = handlers.parseMissingModules || function() { return []; };
    var buildMissingRows = handlers.buildMissingRows || function(list) { return list || []; };
    var pickMissingSelections = handlers.pickMissingSelections || function() { return []; };
    var scrollElementIntoView = handlers.scrollElementIntoView || function() {};
    var switchTab = handlers.switchTab || function() {};
    var getRequirementLabel = handlers.getRequirementLabel || function() { return ''; };
    var getFeishuWebhookUrl = handlers.getFeishuWebhookUrl || function() { return ''; };
    var postFeishuMessage = handlers.postFeishuMessage || function() { return Promise.resolve(); };
    var reviewRequirements = handlers.reviewRequirements || function() { return Promise.resolve(); };
    var runCleaning = handlers.runCleaning || function() { return Promise.resolve(); };
    var compareCoverage = handlers.compareCoverage || function() { return Promise.resolve(); };
    var splitModules = handlers.splitModules || function() { return Promise.resolve(); };
    var compareCasesCoverage = handlers.compareCasesCoverage || function() { return Promise.resolve(); };
    var extractCoverageFromCompareResult = handlers.extractCoverageFromCompareResult || function() { return null; };
    var extractCompareResultData = handlers.extractCompareResultData || function() { return null; };
    var formatMissingRequirement = handlers.formatMissingRequirement || function(v) { return String(v || ''); };
    var shouldExpectCleanJson = handlers.shouldExpectCleanJson || function() { return false; };
    var hasCaseSource = handlers.hasCaseSource || function() { return false; };
    var scrollToSection = handlers.scrollToSection || function() {};
    var renderAutoClarifyView = handlers.renderAutoClarifyView || function() {};
    var openAutoClarifyPanel = handlers.openAutoClarifyPanel || function() {};
    var waitForAutoClarification = handlers.waitForAutoClarification || function() { return Promise.resolve(); };
    var updateAutoClarifyVisibility = handlers.updateAutoClarifyVisibility || function() {};
    var autoFillReviewClarifications = handlers.autoFillReviewClarifications || function() { return false; };
    var jumpToCleanHighlightView = handlers.jumpToCleanHighlightView || function() {};
    var getAssignedModel = handlers.getAssignedModel || function() { throw new Error('缺少模型'); };
    var getReasoningForType = handlers.getReasoningForType || function() { return ''; };
    var getTemperatureForType = handlers.getTemperatureForType || function() { return 0.2; };
    var callModelWithConfig = handlers.callModelWithConfig || function() { return Promise.resolve(''); };
    var stripCodeFence = handlers.stripCodeFence || utils.stripCodeFence || function(text) { return text || ''; };
    var extractJsonPayload = handlers.extractJsonPayload || utils.extractJsonPayload || function() { return ''; };
    var buildReviewClarificationContext = handlers.buildReviewClarificationContext || function() { return ''; };
    var ensureCaseGenModulesFromSplit = handlers.ensureCaseGenModulesFromSplit || function() { return false; };
    var generateAllCaseGenModules = handlers.generateAllCaseGenModules || function() { return Promise.resolve(); };
    var buildCasesComparePayload = handlers.buildCasesComparePayload || function() { return { text: '', isJson: false }; };
    var renderCleanView = handlers.renderCleanView || function() {};
    var renderCleanRawView = handlers.renderCleanRawView || function() {};
    var syncReviewViewFromResult = handlers.syncReviewViewFromResult || function() {};
    var syncSplitView = handlers.syncSplitView || function() {};
    var triggerMissingReminderAi = handlers.triggerMissingReminderAi || function() { return false; };
    var triggerCaseLibraryGen = handlers.triggerCaseLibraryGen || function() { return false; };
    var defaultPrompts = (ctx.config && ctx.config.defaultPrompts) ? ctx.config.defaultPrompts : {};
    var defaultAgentExtraPrompt = (ctx.config && typeof ctx.config.defaultAgentExtraPrompt === 'string')
      ? ctx.config.defaultAgentExtraPrompt
      : (window.app && window.app.config && typeof window.app.config.defaultAgentExtraPrompt === 'string'
        ? window.app.config.defaultAgentExtraPrompt
        : '需求澄清忽略数值和美术相关内容，模块拆分也忽略数值和美术。');
    var agentReviewPrompt = defaultPrompts && typeof defaultPrompts.agentreview === 'string'
      ? defaultPrompts.agentreview
      : '你是用例生成流程的结果复核 Agent。请根据输入的 step/prompt_hint/inputs/output 判断输出是否符合额外提示词与步骤要求，确保格式/字段不变且内容符合约束。你必须严格输出 JSON：{ok, reason, output, issues}，ok 为 true/false。issues 为违反要求的条目列表（字符串数组，简短描述问题点），ok 为 true 时 issues 为空数组且 output 为空字符串。若 ok 为 false，output 必须给出修正后的完整结果（保持原输出格式，不要包含多余文本或 Markdown）。reason 为简短问题说明，不输出推理过程。';
    var escapeHtml = utils.escapeHtml || function(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    var autoMissingToggle = pickEl(dom.autoMissingToggle, 'autoMissingToggle');
    var autoMissingCopy = pickEl(dom.autoMissingCopy, 'autoMissingCopy');
    var autoMissingSmartFillBtn = pickEl(dom.autoMissingSmartFillBtn, 'autoMissingSmartFill');
    var autoMissingView = pickEl(dom.autoMissingView, 'autoMissingView');
    var autoMissingStatus = pickEl(dom.autoMissingStatus, 'autoMissingStatus');
    var autoMissingGoUsecaseBtn = pickEl(dom.autoMissingGoUsecaseBtn, 'autoMissingGoUsecase');
    var casesCompareResultEl = pickEl(dom.casesCompareResultEl, 'casesCompareResult');
    var casesGenerationContainer = pickEl(dom.casesGenerationContainer, 'casesGenerationContainer');
    var caseGenStatus = pickEl(dom.caseGenStatus, 'caseGenStatus');
    var missingViewStatus = pickEl(dom.missingViewStatus, 'missingViewStatus');
    var autoWorkflowBtn = pickEl(dom.autoWorkflowBtn, 'runAutoWorkflow');
    var autoAgentStopBtn = pickEl(dom.autoAgentStopBtn, 'autoAgentStopBtn');
    var autoRecleanBtn = pickEl(dom.autoRecleanBtn, 'autoRecleanBtn');
    var autoIgnoreCoverageBtn = pickEl(dom.autoIgnoreCoverageBtn, 'autoIgnoreCoverageBtn');
    var autoCompareMissing = pickEl(dom.autoCompareMissing, 'autoCompareMissing');
    var autoCompareToggleBtn = pickEl(dom.autoCompareToggleBtn, 'autoCompareToggleBtn');
    var autoCompareStatusSummary = pickEl(dom.autoCompareStatusSummary, 'autoCompareStatusSummary');
    var autoCompareSuggestionInput = pickEl(dom.autoCompareSuggestionInput, 'autoCompareSuggestion');
    var autoFillCleanBtn = pickEl(dom.autoFillCleanBtn, 'autoFillCleanBtn');
    var autoJumpCleanViewBtn = pickEl(dom.autoJumpCleanViewBtn, 'autoJumpCleanView');
    var autoRecleanStatus = pickEl(dom.autoRecleanStatus, 'autoRecleanStatus');
    var autoCompareStatus = pickEl(dom.autoCompareStatus, 'autoCompareStatus');
    var autoWorkflowStatus = pickEl(dom.autoWorkflowStatus, 'autoWorkflowStatus');
    var autoClarifyStatus = pickEl(dom.autoClarifyStatus, 'autoClarifyStatus');
    var autoAgentPanel = pickEl(dom.autoAgentPanel, 'autoAgentPanel');
    var autoAgentPlan = pickEl(dom.autoAgentPlan, 'autoAgentPlan');
    var autoAgentLog = pickEl(dom.autoAgentLog, 'autoAgentLog');
    var autoAgentSuggestion = pickEl(dom.autoAgentSuggestion, 'autoAgentSuggestion');
    var autoAgentPromptHintBlock = pickEl(dom.autoAgentPromptHintBlock, 'autoAgentPromptHintBlock');
    var autoAgentTracePanel = pickEl(dom.autoAgentTracePanel, 'autoAgentTracePanel');
    var autoAgentTrace = pickEl(dom.autoAgentTrace, 'autoAgentTrace');
    var cleanedTextEl = pickEl(dom.cleanedTextEl, 'cleanedText');
    var rawText = pickEl(dom.rawText, 'rawText');
    var reviewResultEl = pickEl(dom.reviewResultEl, 'reviewResult');
    var compareResultEl = pickEl(dom.compareResultEl, 'compareResult');
    var splitResultEl = pickEl(dom.splitResultEl, 'splitResult');
    var autoClarifyToggle = pickEl(dom.autoClarifyToggle, 'autoNeedClarify');
    var autoClarifySection = dom.autoClarifySection || (typeof document !== 'undefined' ? document.querySelector('[data-section-id="auto-clarify"]') : null);
    var autoCompareDrawerTitle = pickEl(dom.autoCompareDrawerTitle, 'autoCompareDrawerTitle');
    var autoCompareDrawerBody = pickEl(dom.autoCompareDrawerBody, 'autoCompareDrawerBody');
    var autoMissingDrawerTitle = pickEl(dom.autoMissingDrawerTitle, 'autoMissingDrawerTitle');
    var autoMissingDrawerBody = pickEl(dom.autoMissingDrawerBody, 'autoMissingDrawerBody');

    var autoCompareDrawer = null;
    var autoMissingDrawer = null;

    if (!state.autoCompareSelections) state.autoCompareSelections = new Set();
    if (!state.autoCompareMissingList) state.autoCompareMissingList = [];
    if (!Object.prototype.hasOwnProperty.call(state, 'autoCompareSelectionTouched')) state.autoCompareSelectionTouched = false;
    if (!Array.isArray(state.caseGenAgentPlan)) state.caseGenAgentPlan = [];
    if (typeof state.caseGenAgentPlanSource !== 'string') state.caseGenAgentPlanSource = '';
    if (!Array.isArray(state.caseGenAgentLog)) state.caseGenAgentLog = [];
    if (!Array.isArray(state.caseGenAgentTrace)) state.caseGenAgentTrace = [];
    if (typeof state.caseGenAgentFixSuggestions !== 'string') state.caseGenAgentFixSuggestions = '';
    if (!state.caseGenAgentRetryCounters || typeof state.caseGenAgentRetryCounters !== 'object') state.caseGenAgentRetryCounters = {};
    if (typeof state.caseGenAgentCoverageRetries !== 'number') state.caseGenAgentCoverageRetries = 0;
    if (typeof state.caseGenAgentCoverageBelowFull !== 'boolean') state.caseGenAgentCoverageBelowFull = false;
    if (typeof state.autoAgentPromptHint !== 'string') state.autoAgentPromptHint = defaultAgentExtraPrompt;
    if (!Object.prototype.hasOwnProperty.call(state, 'caseGenAgentPromptRouting')) state.caseGenAgentPromptRouting = null;
    if (state.caseGenAgentPromptRouting && typeof state.caseGenAgentPromptRouting !== 'object') state.caseGenAgentPromptRouting = null;
    if (typeof state.autoClarifyDismissed !== 'boolean') state.autoClarifyDismissed = false;
    if (typeof state.autoAgentStopped !== 'boolean') state.autoAgentStopped = false;
    if (typeof state.caseGenAgentFlowStopNote !== 'string') state.caseGenAgentFlowStopNote = '';

    function getRequirementDisplayName() {
      return getRequirementLabel(true);
    }

    function setMissingStatus(text, type) {
      if (type === void 0) type = '';
      if (missingViewStatus) setStatus(missingViewStatus, text, type);
      if (autoMissingStatus) setStatus(autoMissingStatus, text, type);
    }

    function setAutoCompareStatusText(text) {
      if (autoCompareStatus) autoCompareStatus.textContent = text;
      if (autoCompareStatusSummary) autoCompareStatusSummary.textContent = text;
    }

    function setAutoCompareToggleLabel(open) {
      if (!autoCompareToggleBtn) return;
      autoCompareToggleBtn.textContent = open ? '收起覆盖缺失视图' : '覆盖缺失视图';
    }

    function setAutoMissingToggleLabel(open) {
      if (!autoMissingToggle) return;
      autoMissingToggle.textContent = open ? '收起缺失视图' : '前往勾选缺失模块生成缺失用例';
    }

    function getAutoWorkflowManager() {
      if (typeof window === 'undefined') return null;
      return window.app && window.app.autoWorkflowManager ? window.app.autoWorkflowManager : null;
    }

    function syncAgentStopButton() {
      if (!autoAgentStopBtn) return;
      var enabled = isCaseGenAgentEnabled();
      autoAgentStopBtn.classList.toggle('hidden', !enabled);
      autoAgentStopBtn.disabled = !enabled || !state.autoRunning || state.autoAgentStopped === true;
    }

    function resetAgentStopState() {
      state.autoAgentStopped = false;
      state.caseGenAgentFlowStopNote = '';
      syncAgentStopButton();
    }

    function createAgentStoppedError() {
      var err = new Error('Agent 已停止');
      err.code = 'AGENT_STOPPED';
      return err;
    }

    function isAgentStoppedError(err) {
      return Boolean(err && err.code === 'AGENT_STOPPED');
    }

    function ensureAgentNotStopped() {
      if (state.autoAgentStopped) {
        throw createAgentStoppedError();
      }
    }

    function stopAgentWorkflow() {
      if (!isCaseGenAgentEnabled()) return;
      state.autoAgentStopped = true;
      state.autoRunning = false;
      if (autoWorkflowBtn) autoWorkflowBtn.disabled = false;
      if (autoClarifyToggle) autoClarifyToggle.disabled = false;
      if (autoRecleanBtn) autoRecleanBtn.disabled = false;
      if (autoIgnoreCoverageBtn) autoIgnoreCoverageBtn.disabled = false;
      if (autoFillCleanBtn) autoFillCleanBtn.disabled = false;
      if (autoJumpCleanViewBtn) autoJumpCleanViewBtn.disabled = false;
      var manager = getAutoWorkflowManager();
      if (manager && typeof manager.clearTask === 'function') {
        manager.clearTask();
      }
      markAgentPlanStopped('已终止');
      setStatus(autoWorkflowStatus, 'Agent 已停止', 'warn');
      syncAgentStopButton();
    }

    function isCaseGenAgentEnabled() {
      var settings = state.settings || {};
      var raw = settings.caseGenAgentEnabled;
      if (raw === true) return true;
      return String(raw || '').toLowerCase() === 'on';
    }

    function isAgentCoverageWaiting() {
      return Boolean(isCaseGenAgentEnabled() && state.waitingSteps && state.waitingSteps.compare);
    }

    function clampAgentCoverageThreshold(value) {
      var num = Math.round(Number(value));
      if (!Number.isFinite(num)) return 100;
      if (num < 0) return 0;
      if (num > 100) return 100;
      return num;
    }

    function getAgentCoverageThreshold() {
      var settings = state.settings || {};
      return clampAgentCoverageThreshold(settings.caseGenAgentCoverageThreshold);
    }

    function getAgentPlanTemplate() {
      return [
        { key: 'review', label: '需求评审' },
        { key: 'clarify', label: '需求澄清确认' },
        { key: 'clean', label: '需求清洗' },
        { key: 'compare', label: '对比完整性' },
        { key: 'coverage', label: '覆盖率校验' },
        { key: 'split', label: '测试模块拆分' },
        { key: 'cases', label: '覆盖对比' },
      ];
    }

    function normalizeAgentStepKey(key) {
      if (!key) return '';
      var raw = String(key).trim().toLowerCase();
      var map = {
        review: 'review',
        clean: 'clean',
        compare: 'compare',
        split: 'split',
        cases: 'cases',
        clarify: 'clarify',
        coverage: 'coverage',
        '需求评审': 'review',
        '澄清': 'clarify',
        '需求澄清': 'clarify',
        '需求澄清确认': 'clarify',
        '需求清洗': 'clean',
        '对比完整性': 'compare',
        '对比计算': 'compare',
        '测试模块拆分': 'split',
        '覆盖对比': 'cases',
        '覆盖率校验': 'coverage',
        '覆盖率': 'coverage',
        '覆盖率对比': 'coverage',
      };
      return map[raw] || raw;
    }

    function normalizeAgentStepList(list) {
      var rawList = list;
      if (typeof rawList === 'string') {
        rawList = rawList.split(/[,\s，、]+/);
      }
      if (!Array.isArray(rawList)) return [];
      var result = [];
      rawList.forEach(function(item) {
        var key = normalizeAgentStepKey(item);
        if (!key) return;
        if (result.indexOf(key) === -1) result.push(key);
      });
      return result;
    }

    function normalizeAgentPromptRouting(raw, source) {
      if (!raw || typeof raw !== 'object') return null;
      var prompts = {};
      var rawPrompts = raw.prompts && typeof raw.prompts === 'object' ? raw.prompts : null;
      if (rawPrompts) {
        Object.keys(rawPrompts).forEach(function(key) {
          var stepKey = normalizeAgentStepKey(key);
          if (!stepKey) return;
          var value = rawPrompts[key];
          if (value === undefined || value === null) return;
          var text = String(value).trim();
          if (text) prompts[stepKey] = text;
        });
      }
      var remappedPrompts = {};
      if (prompts.clarify && !prompts.review) {
        prompts.review = prompts.clarify;
        remappedPrompts.review = '澄清';
      }
      if (prompts.coverage && !prompts.compare) {
        prompts.compare = prompts.coverage;
        remappedPrompts.compare = '覆盖率';
      }
      if (prompts.clarify) delete prompts.clarify;
      if (prompts.coverage) delete prompts.coverage;
      var flowRaw = raw.flow && typeof raw.flow === 'object' ? raw.flow : {};
      var stopAfter = normalizeAgentStepKey(flowRaw.stop_after || flowRaw.stopAfter || flowRaw.stop || '');
      var onlySteps = normalizeAgentStepList(flowRaw.only_steps || flowRaw.onlySteps || flowRaw.steps || []);
      var note = flowRaw.note || flowRaw.reason || raw.note || '';
      var normalized = {
        source: source || '',
        updatedAt: Date.now(),
        prompts: prompts,
        flow: {
          stop_after: stopAfter,
          only_steps: onlySteps,
          note: note ? String(note).trim() : '',
        },
      };
      if (Object.keys(remappedPrompts).length) normalized.remappedPrompts = remappedPrompts;
      return normalized;
    }

    function getAgentPromptRouting() {
      var routing = state.caseGenAgentPromptRouting;
      if (!routing || typeof routing !== 'object') return null;
      if (!routing.prompts || typeof routing.prompts !== 'object') routing.prompts = {};
      if (!routing.flow || typeof routing.flow !== 'object') routing.flow = {};
      return routing;
    }

    function setAgentPromptRouting(next) {
      if (!next || typeof next !== 'object') {
        state.caseGenAgentPromptRouting = null;
        if (persistWorkflowState) persistWorkflowState();
        return;
      }
      state.caseGenAgentPromptRouting = next;
      if (persistWorkflowState) persistWorkflowState();
    }

    function buildAgentRoutingSignature(routing) {
      if (!routing || typeof routing !== 'object') return '';
      var prompts = routing.prompts && typeof routing.prompts === 'object' ? routing.prompts : {};
      var flow = routing.flow && typeof routing.flow === 'object' ? routing.flow : {};
      var promptKeys = Object.keys(prompts).sort();
      var promptPairs = promptKeys.map(function(key) {
        return key + '=' + String(prompts[key] || '');
      });
      var onlySteps = Array.isArray(flow.only_steps) ? flow.only_steps.slice().sort() : [];
      var stopAfter = flow.stop_after ? String(flow.stop_after) : '';
      var note = flow.note ? String(flow.note) : '';
      return [routing.source || '', promptPairs.join('|'), stopAfter, onlySteps.join(','), note].join('#');
    }

    function extractPromptRoutingFromDecision(decision) {
      if (!decision || typeof decision !== 'object') return null;
      if (decision.prompt_routing && typeof decision.prompt_routing === 'object') return decision.prompt_routing;
      if (decision.promptRouting && typeof decision.promptRouting === 'object') return decision.promptRouting;
      if (decision.agent_prompt_routing && typeof decision.agent_prompt_routing === 'object') return decision.agent_prompt_routing;
      var promptHints = null;
      if (decision.prompt_hints && typeof decision.prompt_hints === 'object') promptHints = decision.prompt_hints;
      if (!promptHints && decision.promptHints && typeof decision.promptHints === 'object') promptHints = decision.promptHints;
      if (!promptHints && decision.step_prompts && typeof decision.step_prompts === 'object') promptHints = decision.step_prompts;
      if (!promptHints && decision.stepPrompts && typeof decision.stepPrompts === 'object') promptHints = decision.stepPrompts;
      if (promptHints) return { prompts: promptHints };
      if (decision.prompts || decision.flow) {
        return { prompts: decision.prompts || {}, flow: decision.flow || {} };
      }
      return null;
    }

    function extractRoutingNoteFromDecision(decision) {
      if (!decision || typeof decision !== 'object') return '';
      var note = '';
      if (decision.routing_note !== undefined && decision.routing_note !== null) {
        note = decision.routing_note;
      } else if (decision.routingNote !== undefined && decision.routingNote !== null) {
        note = decision.routingNote;
      }
      return note ? String(note).trim() : '';
    }

    function extractDecisionUnderstanding(decision) {
      if (!decision || typeof decision !== 'object') return '';
      var note = '';
      if (decision.understanding !== undefined && decision.understanding !== null) {
        note = decision.understanding;
      } else if (decision.understanding_note !== undefined && decision.understanding_note !== null) {
        note = decision.understanding_note;
      } else if (decision.understandingNote !== undefined && decision.understandingNote !== null) {
        note = decision.understandingNote;
      }
      return note ? String(note).trim() : '';
    }

    function extractDecisionAction(decision) {
      if (!decision || typeof decision !== 'object') return '';
      if (decision.action !== undefined && decision.action !== null) return String(decision.action).trim();
      if (decision.decision && decision.decision.action !== undefined && decision.decision.action !== null) {
        return String(decision.decision.action).trim();
      }
      return '';
    }

    function extractDecisionReason(decision) {
      if (!decision || typeof decision !== 'object') return '';
      if (decision.reason !== undefined && decision.reason !== null) return String(decision.reason).trim();
      if (decision.decision && decision.decision.reason !== undefined && decision.decision.reason !== null) {
        return String(decision.decision.reason).trim();
      }
      return '';
    }

    function isAgentPromptRoutingComplete(decision) {
      var routing = extractPromptRoutingFromDecision(decision);
      if (!routing) return false;
      var note = extractRoutingNoteFromDecision(decision);
      return Boolean(note);
    }

    function getAgentRoutingStatus(decision) {
      var hasRouting = Boolean(extractPromptRoutingFromDecision(decision));
      var hasNote = Boolean(extractRoutingNoteFromDecision(decision));
      var hasUnderstanding = Boolean(extractDecisionUnderstanding(decision));
      var hasDecision = Boolean(extractDecisionAction(decision));
      return {
        hasRouting: hasRouting,
        hasNote: hasNote,
        hasUnderstanding: hasUnderstanding,
        hasDecision: hasDecision,
        complete: hasRouting && hasNote && hasUnderstanding && hasDecision,
      };
    }

    function maybeApplyAgentPromptRoutingFromDecision(decision, extraPrompt) {
      var raw = extractPromptRoutingFromDecision(decision);
      if (!raw) return false;
      var source = extraPrompt ? String(extraPrompt).trim() : '';
      if (!source) return false;
      var normalized = normalizeAgentPromptRouting(raw, source);
      if (!normalized) return false;
      var remappedPrompts = normalized.remappedPrompts || null;
      if (remappedPrompts) delete normalized.remappedPrompts;
      var existing = getAgentPromptRouting();
      var prevSig = buildAgentRoutingSignature(existing);
      var nextSig = buildAgentRoutingSignature(normalized);
      if (prevSig && prevSig === nextSig) return false;
      setAgentPromptRouting(normalized);
      state.caseGenAgentFlowStopNote = '';
      pushAgentLog('info', '已根据 Agent 决策更新步骤提示');
      if (remappedPrompts) {
        var remapSummary = summarizeAgentPromptRouting({ prompts: remappedPrompts, flow: {} });
        if (remapSummary) pushAgentLog('info', '已将 Agent 路由映射到对应步骤：' + remapSummary);
      }
      var summary = summarizeAgentPromptRouting(normalized);
      if (summary) pushAgentLog('info', 'Agent 提示词路由：' + summary);
      logAgentPromptDelivery(normalized.prompts);
      return true;
    }

    function applyAgentPromptRoutingDecision(decision, promptOverride) {
      var source = '';
      if (promptOverride !== undefined && promptOverride !== null) {
        source = String(promptOverride).trim();
      } else {
        source = state.autoAgentPromptHint ? String(state.autoAgentPromptHint).trim() : '';
      }
      var applied = maybeApplyAgentPromptRoutingFromDecision(decision, source);
      var understanding = extractDecisionUnderstanding(decision);
      if (understanding) pushAgentLog('info', 'Agent 理解：' + understanding);
      var note = extractRoutingNoteFromDecision(decision);
      if (note) pushAgentLog('info', 'Agent 路由说明：' + note);
      return applied;
    }

    function resolveAgentReviewPrompt() {
      return agentReviewPrompt ? String(agentReviewPrompt).trim() : '';
    }

    function getAgentStepOutput(step) {
      if (step === 'review') return reviewResultEl ? reviewResultEl.value || '' : '';
      if (step === 'clean') return cleanedTextEl ? cleanedTextEl.value || '' : '';
      if (step === 'compare') return compareResultEl ? compareResultEl.value || '' : '';
      if (step === 'split') return splitResultEl ? splitResultEl.value || '' : '';
      if (step === 'cases') return casesCompareResultEl ? casesCompareResultEl.value || '' : '';
      return '';
    }

    function setAgentStepOutput(step, text) {
      var value = text === undefined || text === null ? '' : String(text);
      var updated = false;
      if (step === 'review' && reviewResultEl) {
        if (reviewResultEl.value !== value) {
          reviewResultEl.value = value;
          updated = true;
          if (typeof syncReviewViewFromResult === 'function') syncReviewViewFromResult();
        }
      } else if (step === 'clean' && cleanedTextEl) {
        if (cleanedTextEl.value !== value) {
          cleanedTextEl.value = value;
          updated = true;
          if (typeof renderCleanView === 'function') renderCleanView(true);
          if (typeof renderCleanRawView === 'function') renderCleanRawView(null);
        }
      } else if (step === 'compare' && compareResultEl) {
        if (compareResultEl.value !== value) {
          compareResultEl.value = value;
          updated = true;
          syncAutoCompareStatus(false);
        }
      } else if (step === 'split' && splitResultEl) {
        if (splitResultEl.value !== value) {
          splitResultEl.value = value;
          updated = true;
          if (typeof syncSplitView === 'function') syncSplitView();
        }
      } else if (step === 'cases' && casesCompareResultEl) {
        if (casesCompareResultEl.value !== value) {
          casesCompareResultEl.value = value;
          updated = true;
          if (typeof updateMissingView === 'function') updateMissingView();
        }
      }
      if (updated) {
        updateFlowStatus();
        if (persistWorkflowState) persistWorkflowState();
      }
      return updated;
    }

    function resolveAgentStepExpectation(step) {
      if (step === 'review') {
        return 'JSON 数组，元素字段：类别、不明确的需求点、不明确原因、可能存在的分支/边界情况。';
      }
      if (step === 'clean') {
        return 'JSON 数组，包含清洗后的需求条目与结构化字段。';
      }
      if (step === 'compare') {
        return 'JSON 对象：{coverage: 0-100, missing: []}。';
      }
      if (step === 'split') {
        return 'JSON 结构化模块清单，保持模块拆分字段不变。';
      }
      if (step === 'cases') {
        return 'JSON 对象：{coverage, missing, extra}，保持覆盖对比结构。';
      }
      return '';
    }

    function buildAgentStepReviewPayload(step, hint, output, context) {
      var label = resolveAgentActionLabel(step) || step;
      var raw = rawText && rawText.value ? rawText.value.trim() : '';
      var review = reviewResultEl && reviewResultEl.value ? reviewResultEl.value.trim() : '';
      var cleaned = cleanedTextEl && cleanedTextEl.value ? cleanedTextEl.value.trim() : '';
      var compare = compareResultEl && compareResultEl.value ? compareResultEl.value.trim() : '';
      var split = splitResultEl && splitResultEl.value ? splitResultEl.value.trim() : '';
      var casesCompare = casesCompareResultEl && casesCompareResultEl.value ? casesCompareResultEl.value.trim() : '';
      var casesPayload = buildCasesComparePayload ? buildCasesComparePayload() : null;
      var caseText = casesPayload && casesPayload.text ? casesPayload.text : '';
      var inputs = {};
      if (step === 'review') {
        if (raw) inputs.raw_requirement = raw;
      } else if (step === 'clean') {
        if (raw) inputs.raw_requirement = raw;
        if (review) inputs.review_result = review;
      } else if (step === 'compare') {
        if (raw) inputs.raw_requirement = raw;
        if (cleaned) inputs.cleaned_requirement = cleaned;
      } else if (step === 'split') {
        if (cleaned) inputs.cleaned_requirement = cleaned;
        if (raw) inputs.raw_requirement = raw;
      } else if (step === 'cases') {
        if (split) inputs.split_result = split;
        if (caseText) inputs.case_text = caseText;
        if (casesCompare && casesCompare !== output) inputs.cases_compare = casesCompare;
      }
      var expectation = resolveAgentStepExpectation(step);
      var meta = {
        step: step,
        step_label: label,
        prompt_hint: hint || '',
        output: output || '',
      };
      if (expectation) meta.expected_format = expectation;
      if (Object.keys(inputs).length) meta.inputs = inputs;
      if (context && context.mode) meta.mode = context.mode;
      return meta;
    }

    function normalizeAgentReviewOutput(output) {
      if (output === undefined || output === null) return '';
      if (typeof output === 'string') return stripCodeFence(output).trim();
      try {
        return JSON.stringify(output, null, 2);
      } catch (err) {
        return String(output);
      }
    }

    function normalizeAgentReviewDecision(decision) {
      if (!decision || typeof decision !== 'object') return null;
      var ok = decision.ok;
      if (ok === undefined || ok === null) {
        if (decision.pass !== undefined && decision.pass !== null) ok = decision.pass;
        if (ok === undefined || ok === null) ok = decision.valid;
      }
      if (ok === undefined || ok === null) ok = null;
      else ok = Boolean(ok);
      var reason = decision.reason ? String(decision.reason).trim() : '';
      var output = Object.prototype.hasOwnProperty.call(decision, 'output') ? decision.output : '';
      var issues = decision.issues;
      if (issues === undefined || issues === null) issues = decision.violations;
      if (issues === undefined || issues === null) issues = decision.problems;
      if (issues === undefined || issues === null) issues = decision.items;
      return { ok: ok, reason: reason, output: output, issues: issues };
    }

    function normalizeAgentReviewIssues(raw) {
      if (!raw) return [];
      if (Array.isArray(raw)) {
        return raw.map(function(item) {
          if (item === null || item === undefined) return '';
          if (typeof item === 'string') return item.trim();
          if (typeof item === 'object') {
            var idx = item.index !== undefined && item.index !== null ? String(item.index) : '';
            var text = item.text || item.issue || item.reason || '';
            var trimmed = text ? String(text).trim() : '';
            if (idx && trimmed) return idx + ':' + trimmed;
            return trimmed || idx;
          }
          return String(item);
        }).filter(function(item) { return Boolean(item); });
      }
      if (typeof raw === 'string') {
        var single = raw.trim();
        return single ? [single] : [];
      }
      if (typeof raw === 'object') {
        var list = raw.list || raw.items || raw.issues || [];
        return normalizeAgentReviewIssues(list);
      }
      return [];
    }

    function parseAgentReviewDecisionContent(content) {
      if (!content) return null;
      var jsonText = extractJsonPayload(content) || stripCodeFence(content);
      if (!jsonText) return null;
      try {
        var parsed = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
      } catch (err) {
        return null;
      }
    }

    function applyAgentReviewDecision(step, decision) {
      var normalized = normalizeAgentReviewDecision(decision);
      var label = resolveAgentActionLabel(step) || step;
      if (!normalized || normalized.ok === null) {
        pushAgentTrace('warn', 'Agent 复核失败：' + label + '未返回有效结果');
        return false;
      }
      var issues = normalizeAgentReviewIssues(normalized.issues);
      if (normalized.ok) {
        var okNote = normalized.reason ? '（' + normalized.reason + '）' : '';
        pushAgentTrace('info', 'Agent 复核通过：' + label + okNote);
        return false;
      }
      var output = normalizeAgentReviewOutput(normalized.output);
      var note = normalized.reason ? '（' + normalized.reason + '）' : '';
      if (issues.length) {
        issues.forEach(function(item) {
          pushAgentTrace('warn', '复核问题：' + item);
        });
      }
      if (!output) {
        pushAgentTrace('warn', 'Agent 复核失败：' + label + '未返回修正结果' + note);
        return false;
      }
      var updated = setAgentStepOutput(step, output);
      if (updated) {
        pushAgentTrace('warn', 'Agent 复核修正：' + label + note);
      } else {
        pushAgentTrace('warn', 'Agent 复核提示需修正但结果未变化：' + label + note);
      }
      return updated;
    }

    async function reviewAgentStepOutput(step, context, hint, options) {
      if (!isCaseGenAgentEnabled()) return false;
      var stepHint = hint ? String(hint).trim() : '';
      if (!stepHint) return false;
      var output = getAgentStepOutput(step);
      if (!output || !String(output).trim()) return false;
      var prompt = resolveAgentReviewPrompt();
      if (!prompt) return false;
      var label = resolveAgentActionLabel(step) || step;
      setAgentPlanStatus(step, 'reviewing', '正在复核');
      pushAgentTrace('info', '开始复核：' + label);
      setStepInProgress(step);
      var payload = buildAgentStepReviewPayload(step, stepHint, output, context || {});
      var opts = options || {};
      var decision = null;
      try {
        if (opts.decision && typeof opts.decision === 'object') {
          decision = opts.decision;
        } else {
          var model = getAssignedModel('casegenagent');
          var reasoning = getReasoningForType('casegenagent');
          var temperature = getTemperatureForType('casegenagent');
          ensureAgentNotStopped();
          var content = await callModelWithConfig(model, JSON.stringify(payload, null, 2), prompt, reasoning, temperature);
          ensureAgentNotStopped();
          decision = parseAgentReviewDecisionContent(content);
        }
        return applyAgentReviewDecision(step, decision);
      } catch (err) {
        var msg = err && err.message ? err.message : '模型调用失败';
        pushAgentTrace('warn', 'Agent 复核失败：' + label + '，' + msg);
        return false;
      } finally {
        clearStepInProgress(step);
      }
    }

    function getAgentStepPromptHint(step) {
      var routing = getAgentPromptRouting();
      if (!routing || !routing.prompts) return '';
      var key = normalizeAgentStepKey(step) || step;
      if (!key) return '';
      var hint = routing.prompts[key];
      return hint ? String(hint).trim() : '';
    }

    function resolveAgentFlowConstraint() {
      var routing = getAgentPromptRouting();
      if (!routing || !routing.flow) return null;
      var flow = routing.flow || {};
      var onlySteps = normalizeAgentStepList(flow.only_steps || []);
      var stopAfter = normalizeAgentStepKey(flow.stop_after || '');
      var order = ['review', 'clean', 'compare', 'split', 'cases'];
      var allowed = order.slice();
      if (onlySteps.length) {
        allowed = order.filter(function(step) { return onlySteps.indexOf(step) !== -1; });
      }
      if (stopAfter) {
        var stopIdx = order.indexOf(stopAfter);
        if (stopIdx !== -1) {
          allowed = allowed.filter(function(step) { return order.indexOf(step) <= stopIdx; });
        }
      }
      if (!allowed.length) return null;
      return {
        allowedSteps: allowed,
        onlySteps: onlySteps,
        stopAfter: stopAfter,
        note: flow.note ? String(flow.note).trim() : '',
      };
    }

    function buildAgentFlowNote(flow) {
      if (!flow) return '';
      if (flow.note) return flow.note;
      if (flow.stopAfter) return '根据提示仅执行到' + resolveAgentActionLabel(flow.stopAfter);
      if (flow.onlySteps && flow.onlySteps.length) {
        var labels = flow.onlySteps.map(function(step) { return resolveAgentActionLabel(step); }).filter(Boolean);
        if (labels.length) return '根据提示仅执行：' + labels.join('、');
      }
      return '根据提示调整执行范围';
    }

    function formatAgentPromptSnippet(text, limit) {
      var raw = text === undefined || text === null ? '' : String(text);
      var trimmed = raw.replace(/\s+/g, ' ').trim();
      var maxLen = Number(limit || 60);
      if (!trimmed) return '';
      if (trimmed.length <= maxLen) return trimmed;
      return trimmed.slice(0, maxLen) + '...';
    }

    function summarizeAgentPromptRouting(routing) {
      if (!routing || typeof routing !== 'object') return '';
      var prompts = routing.prompts && typeof routing.prompts === 'object' ? routing.prompts : {};
      var flow = routing.flow && typeof routing.flow === 'object' ? routing.flow : {};
      var order = ['review', 'clean', 'compare', 'split', 'cases'];
      var items = [];
      order.forEach(function(step) {
        if (!Object.prototype.hasOwnProperty.call(prompts, step)) return;
        var hint = prompts[step];
        if (!hint) return;
        var label = resolveAgentActionLabel(step);
        var snippet = formatAgentPromptSnippet(hint, 80);
        if (label && snippet) items.push(label + ':' + snippet);
      });
      var flowNote = buildAgentFlowNote({
        stopAfter: flow.stop_after || '',
        onlySteps: flow.only_steps || [],
        note: flow.note || '',
      });
      if (flowNote) items.push('流程:' + flowNote);
      return items.join('；');
    }

    function summarizeAgentPromptDelivery(prompts) {
      if (!prompts || typeof prompts !== 'object') return '';
      var order = ['review', 'clean', 'compare', 'split', 'cases'];
      var items = [];
      order.forEach(function(step) {
        if (!Object.prototype.hasOwnProperty.call(prompts, step)) return;
        var hint = prompts[step];
        if (!hint) return;
        var label = resolveAgentActionLabel(step) || step;
        var name = label && label !== step ? label + '(' + step + ')' : step;
        var snippet = formatAgentPromptSnippet(hint, 120);
        if (snippet) items.push(name + ':' + snippet);
      });
      return items.join('；');
    }

    function logAgentPromptDelivery(prompts) {
      var summary = summarizeAgentPromptDelivery(prompts);
      if (summary) pushAgentLog('info', '提示词投递到工具：' + summary);
    }

    function pickNextFlowStep(ctx, allowedSteps) {
      if (!ctx || !Array.isArray(allowedSteps) || !allowedSteps.length) return '';
      for (var i = 0; i < allowedSteps.length; i += 1) {
        var step = allowedSteps[i];
        if (!isAgentActionSatisfied(step, ctx)) return step;
      }
      return '';
    }

    function resolveFlowConstrainedAction(action, ctx, flow) {
      if (!flow || !Array.isArray(flow.allowedSteps) || !flow.allowedSteps.length) return action;
      if (action === 'wait_clarify') return action;
      if (action === 'wait_coverage') {
        return flow.allowedSteps.indexOf('compare') === -1 ? 'finish' : action;
      }
      var next = pickNextFlowStep(ctx, flow.allowedSteps);
      if (!next) return 'finish';
      if (action === 'finish' || flow.allowedSteps.indexOf(action) === -1) return next;
      return action;
    }

    function markAgentPlanSkippedByFlow(flow) {
      if (!flow || !Array.isArray(flow.allowedSteps) || !flow.allowedSteps.length) return;
      var plan = ensureAgentPlan();
      var allowMap = {};
      flow.allowedSteps.forEach(function(step) { allowMap[step] = true; });
      var allowReview = Boolean(allowMap.review);
      var allowCompare = Boolean(allowMap.compare);
      var note = buildAgentFlowNote(flow);
      plan.forEach(function(item) {
        if (!item || !item.key) return;
        if (item.status === 'done' || item.status === 'failed' || item.status === 'waiting') return;
        if (item.key === 'clarify') {
          if (state.autoRequireClarifications && allowReview) return;
        } else if (item.key === 'coverage') {
          if (allowCompare) return;
        } else if (allowMap[item.key]) {
          return;
        }
        item.status = 'skipped';
        item.note = note;
      });
      renderAgentPlan();
      if (persistWorkflowState) persistWorkflowState();
    }

    function normalizeAgentPlan(list) {
      if (!Array.isArray(list)) return [];
      var seen = {};
      var result = [];
      list.forEach(function(item, idx) {
        if (!item) return;
        var key = item.key ? normalizeAgentStepKey(item.key) : '';
        var label = item.label ? String(item.label).trim() : '';
        if (!key) key = label ? normalizeAgentStepKey(label) : '';
        if (key === 'casegen' || key === 'missingreminder' || key === 'caselibrary') return;
        if (!key) key = 'step_' + (idx + 1);
        if (seen[key]) key = key + '_' + (idx + 1);
        seen[key] = true;
        result.push({
          key: key,
          label: label || key,
          status: item.status || 'pending',
          attempts: Number(item.attempts || 0),
          note: item.note || '',
        });
      });
      return result;
    }

    function ensureAgentPlan() {
      var template = getAgentPlanTemplate();
      var existing = Array.isArray(state.caseGenAgentPlan) ? state.caseGenAgentPlan : [];
      if (state.caseGenAgentPlanSource === 'agent') {
        var normalized = normalizeAgentPlan(existing);
        if (normalized.length) {
          state.caseGenAgentPlan = normalized;
          return normalized;
        }
        state.caseGenAgentPlanSource = '';
      }
      var map = {};
      existing.forEach(function(item) {
        if (item && item.key) map[item.key] = item;
      });
      var next = template.map(function(item) {
        var prev = map[item.key] || {};
        return {
          key: item.key,
          label: item.label,
          status: prev.status || 'pending',
          attempts: Number(prev.attempts || 0),
          note: prev.note || '',
        };
      });
      state.caseGenAgentPlan = next;
      return next;
    }

    function updateAgentPanelVisibility() {
      if (!autoAgentPanel) return;
      var enabled = isCaseGenAgentEnabled();
      autoAgentPanel.classList.toggle('hidden', !enabled);
      if (autoAgentTracePanel) autoAgentTracePanel.classList.toggle('hidden', !enabled);
      if (autoAgentPromptHintBlock) autoAgentPromptHintBlock.classList.toggle('hidden', !enabled);
    }

    function resolveAgentStatusMeta(status) {
      if (status === 'running') return { text: '执行中', tone: '' };
      if (status === 'reviewing') return { text: '复核中', tone: 'warn' };
      if (status === 'done') return { text: '已完成', tone: 'ok' };
      if (status === 'waiting') return { text: '等待人工', tone: 'warn' };
      if (status === 'retrying') return { text: '重试中', tone: 'warn' };
      if (status === 'failed') return { text: '失败', tone: 'err' };
      if (status === 'skipped') return { text: '已跳过', tone: 'warn' };
      if (status === 'stopped') return { text: '已终止', tone: 'warn' };
      return { text: '待执行', tone: '' };
    }

    function renderAgentPlan() {
      if (!autoAgentPlan) return;
      var plan = ensureAgentPlan();
      if (!plan.length) {
        autoAgentPlan.innerHTML = '<p class="hint">暂无执行计划</p>';
        return;
      }
      var items = plan.map(function(item) {
        var meta = resolveAgentStatusMeta(item.status);
        var statusClass = meta.tone ? ('status ' + meta.tone) : 'status';
        var attemptsText = item.attempts ? ('重试 ' + item.attempts + '/2') : '';
        var noteText = item.note ? escapeHtml(item.note) : '';
        var metaText = [attemptsText, noteText].filter(Boolean).join(' · ');
        return '' +
          '<li class="agent-plan-item">' +
            '<span class="' + statusClass + '">' + meta.text + '</span>' +
            '<span class="agent-plan-label">' + escapeHtml(item.label || item.key || '') + '</span>' +
            (metaText ? ('<span class="agent-plan-meta">' + metaText + '</span>') : '') +
          '</li>';
      }).join('');
      autoAgentPlan.innerHTML = '<ul class="agent-plan-list">' + items + '</ul>';
    }

    function formatAgentLogTime(ts) {
      var date = new Date(ts);
      var hh = String(date.getHours()).padStart(2, '0');
      var mm = String(date.getMinutes()).padStart(2, '0');
      var ss = String(date.getSeconds()).padStart(2, '0');
      return hh + ':' + mm + ':' + ss;
    }

    function renderAgentLog() {
      if (!autoAgentLog) return;
      var logs = Array.isArray(state.caseGenAgentLog) ? state.caseGenAgentLog : [];
      if (!logs.length) {
        autoAgentLog.innerHTML = '<p class="hint">暂无决策记录</p>';
        return;
      }
      var list = logs.slice(-30).map(function(entry) {
        var time = entry && entry.ts ? formatAgentLogTime(entry.ts) : '--:--:--';
        var level = entry && entry.level ? String(entry.level) : 'info';
        var message = entry && entry.message ? String(entry.message) : '';
        var badge = level === 'warn' ? '⚠' : (level === 'err' ? '⛔' : '•');
        return '' +
          '<li class="agent-log-item">' +
            '<span>' + escapeHtml(time) + '</span>' +
            '<strong>' + badge + '</strong>' +
            '<span>' + escapeHtml(message) + '</span>' +
          '</li>';
      }).join('');
      autoAgentLog.innerHTML = '<ul class="agent-log-list">' + list + '</ul>';
    }

    function renderAgentSuggestion() {
      if (!autoAgentSuggestion) return;
      var text = state.caseGenAgentFixSuggestions ? state.caseGenAgentFixSuggestions.trim() : '';
      autoAgentSuggestion.textContent = text || '暂无修复建议';
    }

    function renderAgentTrace() {
      if (!autoAgentTrace) return;
      var list = Array.isArray(state.caseGenAgentTrace) ? state.caseGenAgentTrace : [];
      if (!list.length) {
        autoAgentTrace.innerHTML = '<p class="hint">暂无执行记录</p>';
        return;
      }
      var items = list.map(function(entry) {
        var time = entry && entry.ts ? formatAgentLogTime(entry.ts) : '--:--:--';
        var text = entry && entry.message ? escapeHtml(entry.message) : '';
        return '<li class="agent-trace-item"><strong>' + time + '</strong><span>' + text + '</span></li>';
      }).join('');
      autoAgentTrace.innerHTML = '<ul class="agent-trace-list">' + items + '</ul>';
    }

    function renderAgentPanel() {
      updateAgentPanelVisibility();
      syncAgentStopButton();
      renderAgentPlan();
      renderAgentLog();
      renderAgentSuggestion();
      renderAgentTrace();
    }

    function pushAgentLog(level, message) {
      var list = Array.isArray(state.caseGenAgentLog) ? state.caseGenAgentLog : [];
      list.push({ ts: Date.now(), level: level || 'info', message: message || '' });
      if (list.length > 200) list = list.slice(-200);
      state.caseGenAgentLog = list;
      renderAgentLog();
      pushAgentTrace(level, message);
    }

    function pushAgentTrace(level, message, options) {
      var opts = options || {};
      var list = Array.isArray(state.caseGenAgentTrace) ? state.caseGenAgentTrace : [];
      list.push({ ts: Date.now(), level: level || 'info', message: message || '' });
      if (list.length > 400) list = list.slice(-400);
      state.caseGenAgentTrace = list;
      if (!opts.silent) renderAgentTrace();
      if (persistWorkflowState) persistWorkflowState();
    }

    function setAgentFixSuggestions(text) {
      state.caseGenAgentFixSuggestions = text || '';
      renderAgentSuggestion();
      if (persistWorkflowState) persistWorkflowState();
    }

    function setAgentPlanStatus(key, status, note, attempts) {
      var plan = ensureAgentPlan();
      var item = plan.find(function(entry) { return entry.key === key; });
      if (!item) {
        var template = getAgentPlanTemplate();
        var fallback = template.find(function(entry) { return entry.key === key; });
        item = {
          key: key,
          label: fallback ? fallback.label : key,
          status: 'pending',
          attempts: 0,
          note: '',
        };
        plan.push(item);
      }
      if (status) item.status = status;
      if (note !== undefined) item.note = note || '';
      if (attempts !== undefined && attempts !== null) item.attempts = Number(attempts || 0);
      renderAgentPlan();
      if (persistWorkflowState) persistWorkflowState();
    }

    function markAgentPlanStopped(note) {
      var plan = ensureAgentPlan();
      var target = null;
      var statusOrder = ['reviewing', 'running', 'retrying', 'waiting'];
      for (var i = 0; i < statusOrder.length; i += 1) {
        target = plan.find(function(item) { return item && item.status === statusOrder[i]; });
        if (target) break;
      }
      if (!target) {
        target = plan.find(function(item) { return item && item.status === 'pending'; });
      }
      if (!target) return;
      target.status = 'stopped';
      target.note = note || '已终止';
      renderAgentPlan();
      if (persistWorkflowState) persistWorkflowState();
    }

    function applyAgentPlanOverride(list, source) {
      var prev = Array.isArray(state.caseGenAgentPlan) ? state.caseGenAgentPlan : [];
      var prevMap = {};
      prev.forEach(function(item) {
        if (item && item.key) prevMap[item.key] = item;
      });
      var normalized = normalizeAgentPlan(list).map(function(item) {
        var existing = prevMap[item.key];
        if (existing) {
          item.status = existing.status || item.status;
          item.attempts = Number(existing.attempts || item.attempts || 0);
          item.note = existing.note || item.note || '';
        }
        return item;
      });
      if (!normalized.length) return false;
      state.caseGenAgentPlan = normalized;
      state.caseGenAgentPlanSource = source || 'agent';
      renderAgentPlan();
      pushAgentTrace('info', 'Agent 更新了执行计划');
      return true;
    }

    function maybeApplyAgentPlanFromDecision(decision) {
      if (!decision || typeof decision !== 'object') return false;
      var plan = null;
      if (Array.isArray(decision.plan)) plan = decision.plan;
      if (!plan && Array.isArray(decision.plan_steps)) plan = decision.plan_steps;
      if (!plan && Array.isArray(decision.steps)) plan = decision.steps;
      if (!plan) return false;
      return applyAgentPlanOverride(plan, 'agent');
    }

    function bumpAgentRetryCount(stepKey) {
      var counters = state.caseGenAgentRetryCounters;
      if (!counters || typeof counters !== 'object') counters = {};
      var next = Math.min(2, Number(counters[stepKey] || 0) + 1);
      counters[stepKey] = next;
      state.caseGenAgentRetryCounters = counters;
      setAgentPlanStatus(stepKey, next > 0 ? 'retrying' : '', '', next);
      return next;
    }

    function resetAgentRetryCount(stepKey) {
      var counters = state.caseGenAgentRetryCounters;
      if (!counters || typeof counters !== 'object') counters = {};
      counters[stepKey] = 0;
      state.caseGenAgentRetryCounters = counters;
    }

    function resetAgentExecutionState() {
      var plan = ensureAgentPlan();
      plan.forEach(function(item) {
        item.status = 'pending';
        item.attempts = 0;
        item.note = '';
      });
      state.caseGenAgentLog = [];
      state.caseGenAgentTrace = [];
      state.caseGenAgentRetryCounters = {};
      state.caseGenAgentFixSuggestions = '';
      state.caseGenAgentCoverageRetries = 0;
      state.caseGenAgentCoverageBelowFull = false;
      state.autoClarifyDismissed = false;
      pushAgentLog('info', 'Agent 开始执行用例生成流程');
      renderAgentPanel();
    }

    function syncAgentPlanWithContext(ctx) {
      if (!ctx) return;
      var plan = ensureAgentPlan();
      function markDone(key, condition) {
        if (!condition) return;
        var item = plan.find(function(entry) { return entry.key === key; });
        if (!item) return;
        if (item.status === 'waiting' || item.status === 'failed') return;
        item.status = 'done';
      }
      markDone('review', ctx.has_review);
      markDone('clean', ctx.has_cleaned);
      markDone('compare', ctx.has_compare);
      markDone('coverage', ctx.coverage_percent !== null && ctx.coverage_percent !== undefined);
      markDone('split', ctx.has_split);
      markDone('cases', ctx.has_cases_compare);
      markDone('casegen', ctx.has_casegen_results);
      var clarifyItem = plan.find(function(entry) { return entry.key === 'clarify'; });
      if (clarifyItem && clarifyItem.status === 'pending' && !state.autoRequireClarifications) {
        clarifyItem.status = 'skipped';
        clarifyItem.note = '未启用人工澄清';
      }
      renderAgentPlan();
    }

    function createAgentManualWaitError(message, stepKey) {
      var err = new Error(message || '等待人工处理');
      err.code = 'AGENT_WAIT_MANUAL';
      err.stepKey = stepKey || '';
      return err;
    }

    function isAgentManualWaitError(err) {
      return Boolean(err && err.code === 'AGENT_WAIT_MANUAL');
    }

    function collectAgentContext(extra) {
      var raw = rawText && rawText.value ? rawText.value.trim() : '';
      var review = reviewResultEl && reviewResultEl.value ? reviewResultEl.value.trim() : '';
      var cleaned = cleanedTextEl && cleanedTextEl.value ? cleanedTextEl.value.trim() : '';
      var compare = compareResultEl && compareResultEl.value ? compareResultEl.value.trim() : '';
      var split = splitResultEl && splitResultEl.value ? splitResultEl.value.trim() : '';
      var casesCompare = casesCompareResultEl && casesCompareResultEl.value ? casesCompareResultEl.value.trim() : '';
      var caseGenModules = Array.isArray(state.caseGenModules) ? state.caseGenModules : [];
      var caseGenResults = state.caseGenResults && typeof state.caseGenResults === 'object' ? state.caseGenResults : {};
      var coverage = extractCoverageFromCompareResult();
      var threshold = getAgentCoverageThreshold();
      var extraCtx = extra && typeof extra === 'object' ? extra : {};
      var planSnapshot = ensureAgentPlan().map(function(item) {
        return {
          key: item.key,
          label: item.label,
          status: item.status,
        };
      });
      var clarificationPayload = buildReviewClarificationContext();
      var extraPrompt = state.autoAgentPromptHint ? state.autoAgentPromptHint.trim() : '';
      var routing = getAgentPromptRouting();
      var flowConstraint = resolveAgentFlowConstraint();
      return {
        requirement_label: getRequirementLabel(true),
        has_raw: Boolean(raw),
        has_review: Boolean(review),
        has_cleaned: Boolean(cleaned),
        has_compare: Boolean(compare),
        has_split: Boolean(split),
        has_cases_compare: Boolean(casesCompare),
        has_case_source: hasCaseSource(),
        has_casegen_modules: Boolean(caseGenModules && caseGenModules.length),
        has_casegen_results: Object.keys(caseGenResults).length > 0,
        review_clarifications_ready: Boolean(clarificationPayload),
        clarify_confirmed: Boolean(extraCtx.clarifyConfirmed),
        coverage_percent: coverage,
        coverage_threshold: threshold,
        force_ignore_coverage: Boolean(extraCtx.forceIgnoreCoverage),
        coverage_retry_count: Number(state.caseGenAgentCoverageRetries || 0),
        coverage_below_full: Boolean(state.caseGenAgentCoverageBelowFull),
        agent_extra_prompt: extraPrompt,
        agent_step_hints: routing && routing.prompts ? routing.prompts : {},
        agent_flow_constraint: flowConstraint ? {
          stop_after: flowConstraint.stopAfter || '',
          only_steps: flowConstraint.onlySteps || [],
          note: flowConstraint.note || '',
        } : {},
        plan_source: state.caseGenAgentPlanSource || '',
        plan_steps: planSnapshot,
      };
    }

    function normalizeAgentAction(action) {
      if (!action) return '';
      var raw = String(action).trim().toLowerCase();
      var map = {
        review: 'review',
        clean: 'clean',
        compare: 'compare',
        split: 'split',
        cases: 'cases',
        finish: 'finish',
        wait_coverage: 'wait_coverage',
        wait_clarify: 'wait_clarify',
        clarify: 'wait_clarify',
        coverage: 'wait_coverage',
      };
      return map[raw] || '';
    }

    function pickFallbackAgentAction(ctx) {
      if (!ctx || !ctx.has_raw) return 'wait_clarify';
      if (!ctx.has_review) return 'review';
      if (ctx.coverage_percent !== null && ctx.coverage_percent !== undefined) {
        if (!ctx.force_ignore_coverage && ctx.coverage_percent < ctx.coverage_threshold) return 'wait_coverage';
      }
      if (!ctx.has_cleaned) return 'clean';
      if (!ctx.has_compare) return 'compare';
      if (!ctx.has_split) return 'split';
      if (!ctx.has_cases_compare) return 'cases';
      return 'finish';
    }

    function pickResumeAgentAction(ctx) {
      var plan = ensureAgentPlan();
      var running = plan.find(function(item) {
        return item && (item.status === 'running' || item.status === 'retrying' || item.status === 'reviewing');
      });
      if (running && running.key) return running.key;
      var waiting = plan.find(function(item) { return item && item.status === 'waiting'; });
      if (!waiting || !waiting.key) return '';
      if (waiting.key === 'clarify') return 'wait_clarify';
      if (waiting.key === 'coverage') return 'wait_coverage';
      return waiting.key;
    }

    function isAgentActionSatisfied(action, ctx) {
      if (!ctx || !action) return false;
      if (action === 'review') return ctx.has_review;
      if (action === 'clean') return ctx.has_cleaned;
      if (action === 'compare') return ctx.has_compare;
      if (action === 'split') return ctx.has_split;
      if (action === 'cases') return ctx.has_cases_compare;
      return false;
    }

    function resolveAgentActionLabel(action) {
      if (!action) return '';
      var lookup = action;
      if (action === 'wait_coverage') lookup = 'coverage';
      if (action === 'wait_clarify') lookup = 'clarify';
      var plan = ensureAgentPlan();
      for (var i = 0; i < plan.length; i += 1) {
        var item = plan[i];
        if (item && item.key === lookup) return item.label || lookup;
      }
      return lookup;
    }

    function parseAgentDecisionContent(content) {
      if (!content) return null;
      var jsonText = extractJsonPayload(content) || stripCodeFence(content);
      if (!jsonText) return null;
      try {
        var parsed = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
      } catch (err) {
        return null;
      }
    }

    async function requestAgentDecision(model, payload, prompt, reasoning, temperature) {
      var content = await callModelWithConfig(model, payload, prompt, reasoning, temperature);
      return parseAgentDecisionContent(content);
    }

    async function decideAgentNextAction(ctx) {
      var model = getAssignedModel('casegenagent');
      var prompt = state.assignments && state.assignments.caseGenAgentPrompt
        ? state.assignments.caseGenAgentPrompt.trim()
        : '';
      if (!prompt) prompt = defaultPrompts.casegenagent || '';
      var extraPrompt = state.autoAgentPromptHint ? state.autoAgentPromptHint.trim() : '';
      if (extraPrompt) {
        prompt = prompt ? (prompt + '\n\n补充提示：' + extraPrompt) : extraPrompt;
      }
      var reasoning = getReasoningForType('casegenagent');
      var temperature = getTemperatureForType('casegenagent');
      var payload = JSON.stringify(ctx, null, 2);
      var parsed = await requestAgentDecision(model, payload, prompt, reasoning, temperature);
      if (!parsed || typeof parsed !== 'object') return null;
      var routingRetryFailed = false;
      var routingStatus = getAgentRoutingStatus(parsed);
      if (!routingStatus.complete) {
        var missing = [];
        if (!routingStatus.hasRouting) missing.push('提示词路由');
        if (!routingStatus.hasNote) missing.push('路由说明');
        if (!routingStatus.hasUnderstanding) missing.push('理解字段');
        if (!routingStatus.hasDecision) missing.push('决策字段');
        var retryReason = 'Agent 未输出' + (missing.length ? missing.join('、') : '必要字段') + '，已发起补齐重试';
        pushAgentLog('warn', retryReason);
        var retryPrompt = prompt
          ? (prompt + '\n\n补充要求：必须输出 prompt_routing、routing_note、understanding、decision 字段，不要省略。')
          : '补充要求：必须输出 prompt_routing、routing_note、understanding、decision 字段，不要省略。';
        var retryParsed = await requestAgentDecision(model, payload, retryPrompt, reasoning, temperature);
        if (retryParsed && getAgentRoutingStatus(retryParsed).complete) {
          parsed = retryParsed;
          routingStatus = getAgentRoutingStatus(parsed);
          pushAgentLog('info', 'Agent 已补齐提示词路由与理解说明');
        } else {
          routingStatus = getAgentRoutingStatus(parsed);
          if (!routingStatus.hasRouting) {
            routingRetryFailed = true;
            pushAgentLog('warn', 'Agent 未输出提示词路由，本次不追加提示');
          } else if (!routingStatus.hasNote) {
            pushAgentLog('warn', 'Agent 未输出路由说明，本次不追加说明');
          } else if (!routingStatus.hasUnderstanding) {
            pushAgentLog('warn', 'Agent 未输出理解字段，本次不追加理解说明');
          } else if (!routingStatus.hasDecision) {
            pushAgentLog('warn', 'Agent 未输出决策字段，本次不追加决策说明');
          }
        }
      }
      maybeApplyAgentPlanFromDecision(parsed);
      var routingApplied = applyAgentPromptRoutingDecision(parsed, extraPrompt);
      if (extraPrompt && !routingApplied && !routingRetryFailed) {
        var existing = getAgentPromptRouting();
        var sameSource = existing && existing.source === extraPrompt;
        if (!sameSource) {
          pushAgentLog('warn', 'Agent 未输出额外提示词路由，本次不追加提示');
        }
      }
      return parsed;
    }

    async function runAgentStep(step, context) {
      var handler = null;
      var validator = null;
      var after = null;
      var stepHint = '';
      if (step === 'review') {
        handler = function() {
          var reviewContext = context && context.reviewContext ? context.reviewContext : '';
          var hint = getAgentStepPromptHint('review');
          stepHint = hint;
          var payload = {};
          if (reviewContext) payload.clarifications = reviewContext;
          if (hint) payload.promptHint = hint;
          return reviewRequirements(Object.keys(payload).length ? payload : null);
        };
        validator = function() { return Boolean(reviewResultEl && reviewResultEl.value && reviewResultEl.value.trim().length > 0); };
        after = function() { return handleAutoClarifyAfterReview(context); };
      } else if (step === 'clean') {
        handler = function() {
          var hint = getAgentStepPromptHint('clean');
          stepHint = hint;
          var payload = Object.assign({}, context || {});
          if (hint) payload.promptHint = hint;
          return runCleaning(payload);
        };
        validator = function() { return Boolean(cleanedTextEl && cleanedTextEl.value && cleanedTextEl.value.trim().length > 0); };
      } else if (step === 'compare') {
        handler = function() {
          var hint = getAgentStepPromptHint('compare');
          stepHint = hint;
          return compareCoverage(hint ? { promptHint: hint } : {});
        };
        validator = function() { return Boolean(compareResultEl && compareResultEl.value && compareResultEl.value.trim().length > 0); };
      } else if (step === 'split') {
        handler = function() {
          var hint = getAgentStepPromptHint('split');
          stepHint = hint;
          return splitModules(hint ? { promptHint: hint } : {});
        };
        validator = function() { return Boolean(splitResultEl && splitResultEl.value && splitResultEl.value.trim().length > 0); };
      } else if (step === 'cases') {
        handler = function() {
          var hint = getAgentStepPromptHint('cases');
          stepHint = hint;
          return compareCasesCoverage(hint ? { promptHint: hint } : {});
        };
        validator = function() { return Boolean(casesCompareResultEl && casesCompareResultEl.value && casesCompareResultEl.value.trim().length > 0); };
      } else if (step === 'casegen') {
        handler = function() {
          if (!ensureCaseGenModulesFromSplit()) {
            if (!state.caseGenModules || !state.caseGenModules.length) {
              throw new Error('尚无可用的模块拆分结果，无法生成用例');
            }
          }
          return generateAllCaseGenModules();
        };
        validator = function() { return state.caseGenResults && Object.keys(state.caseGenResults).length > 0; };
      }
      if (!handler) return;
      clearStepFailed(step);
      await handler();
      if (stepHint) {
        await reviewAgentStepOutput(step, context, stepHint);
      }
      if (validator && !validator()) {
        var invalidReason = '步骤「' + step + '」未产生有效输出，请检查模型配置或稍后重试';
        setStepFailed(step, invalidReason);
        updateFlowStatus();
        var invalidError = new Error(invalidReason);
        invalidError.validationFailed = true;
        throw invalidError;
      }
      if (after) await after();
      if (persistWorkflowState) persistWorkflowState();
    }

    async function runAgentStepWithRetry(step, context, options) {
      var opts = options || {};
      var label = opts.label || step;
      var note = opts.note || '';
      var maxRetries = 2;
      var attempts = 0;
      while (attempts <= maxRetries) {
        ensureAgentNotStopped();
        clearStepWaiting(step);
        if (attempts === 0) {
          setAgentPlanStatus(step, 'running', note);
          pushAgentTrace('info', '开始执行步骤：' + label);
        } else {
          setAgentPlanStatus(step, 'retrying', note, attempts);
          pushAgentLog('warn', '步骤「' + label + '」校验失败，自动重试第 ' + attempts + ' 次');
          pushAgentTrace('warn', '步骤「' + label + '」开始重试，第 ' + attempts + ' 次');
        }
        try {
          await runAgentStep(step, context);
          ensureAgentNotStopped();
          setAgentPlanStatus(step, 'done', note, attempts);
          resetAgentRetryCount(step);
          pushAgentTrace('info', '步骤完成：' + label);
          return;
        } catch (err) {
          attempts += 1;
          bumpAgentRetryCount(step);
          if (attempts <= maxRetries) {
            continue;
          }
          var msg = err && err.message ? err.message : '步骤执行失败';
          setAgentPlanStatus(step, 'waiting', msg, attempts - 1);
          setStepWaiting(step, msg);
          updateFlowStatus();
          pushAgentTrace('warn', '步骤暂停：' + label + '，等待人工处理');
          throw createAgentManualWaitError('步骤「' + label + '」校验失败，已等待人工处理：' + msg, step);
        }
      }
    }

    function normalizeAgentTriggerResult(result) {
      if (result && typeof result === 'object') {
        if (Object.prototype.hasOwnProperty.call(result, 'ok')) {
          return { ok: Boolean(result.ok), reason: result.reason || '' };
        }
        return { ok: true, reason: '' };
      }
      if (result === false) return { ok: false, reason: '' };
      if (typeof result === 'string') return { ok: false, reason: result };
      return { ok: Boolean(result), reason: '' };
    }

    async function runAgentOptionalStep(key, label, runner) {
      if (!runner || typeof runner !== 'function') {
        setAgentPlanStatus(key, 'skipped', '未配置触发入口');
        return;
      }
      setAgentPlanStatus(key, 'running', '');
      try {
        var res = runner();
        if (res && typeof res.then === 'function') res = await res;
        var normalized = normalizeAgentTriggerResult(res);
        if (!normalized.ok) {
          var reason = normalized.reason || '未满足触发条件';
          setAgentPlanStatus(key, 'skipped', reason);
          pushAgentLog('warn', label + '未触发：' + reason);
          return;
        }
        setAgentPlanStatus(key, 'done', '');
        pushAgentLog('info', label + '已触发');
      } catch (err) {
        var msg = err && err.message ? err.message : '触发失败';
        setAgentPlanStatus(key, 'skipped', msg);
        pushAgentLog('warn', label + '触发失败：' + msg);
      }
    }

    async function runClarifyFollowupIfNeeded(agentContext) {
      if (!agentContext || !agentContext.clarifyConfirmed || agentContext.clarifyReReviewed) return;
      agentContext.clarifyReReviewed = true;
      var reviewContext = buildReviewClarificationContext();
      var reviewCtx = Object.assign({}, agentContext, { skipClarify: true, reviewContext: reviewContext });
      await runAgentStepWithRetry('review', reviewCtx, { label: '需求评审', note: '澄清后再评审' });
      var cleanCtx = Object.assign({}, agentContext, { mode: 'reclean' });
      await runAgentStepWithRetry('clean', cleanCtx, { label: '需求清洗', note: '澄清后重新清洗' });
      pushAgentLog('info', '已根据澄清结果重新评审并清洗');
    }

    async function runCaseGenAgentWorkflow(context) {
      var agentContext = context && typeof context === 'object' ? Object.assign({}, context) : {};
      var maxTurns = 16;
      var lastSignature = '';
      renderAgentPanel();
      var extraPrompt = state.autoAgentPromptHint ? state.autoAgentPromptHint.trim() : '';
      if (extraPrompt && !agentContext.promptHintLogged) {
        agentContext.promptHintLogged = true;
        pushAgentLog('info', '收到额外提示词：' + formatAgentPromptSnippet(extraPrompt, 120));
      }
      for (var i = 0; i < maxTurns; i += 1) {
        ensureAgentNotStopped();
        if (agentContext && agentContext.coverageAction) {
          var manualAction = String(agentContext.coverageAction || '').trim().toLowerCase();
          agentContext.coverageAction = '';
          if (manualAction === 'ignore') {
            agentContext.forceIgnoreCoverage = true;
            pushAgentLog('info', '收到人工选择：忽略覆盖率继续');
          } else if (manualAction === 'supplement' || manualAction === 'reclean') {
            agentContext.mode = manualAction === 'supplement' ? 'supplement' : 'reclean';
            pushAgentLog('info', manualAction === 'supplement' ? '收到人工选择：补全清洗并继续' : '收到人工选择：重新清洗并继续');
            await runAgentStepWithRetry('clean', agentContext, {
              label: '需求清洗',
              note: manualAction === 'supplement' ? '人工补全清洗' : '人工重新清洗'
            });
            await runAgentStepWithRetry('compare', agentContext, {
              label: '对比完整性',
              note: manualAction === 'supplement' ? '人工补全后复查' : '人工重清洗后复查'
            });
            continue;
          }
        }
        var ctx = collectAgentContext(agentContext);
        syncAgentPlanWithContext(ctx);
        if (!ctx.has_raw) {
          var waitErr = '缺少原始需求';
          setStatus(autoWorkflowStatus, '请先导入原始需求', 'warn');
          setAgentPlanStatus('review', 'waiting', waitErr);
          throw createAgentManualWaitError(waitErr, 'review');
        }
        if (ctx.has_cases_compare) {
          return;
        }
        var signature = JSON.stringify({
          has_review: ctx.has_review,
          has_cleaned: ctx.has_cleaned,
          has_compare: ctx.has_compare,
          has_split: ctx.has_split,
          has_cases_compare: ctx.has_cases_compare,
          has_casegen_results: ctx.has_casegen_results,
          coverage: ctx.coverage_percent,
        });
        if (signature === lastSignature && i > 1) {
          throw new Error('Agent 决策未推进流程，请检查模型输出');
        }
        lastSignature = signature;
        var decision = null;
        var action = '';
        try {
          if (autoWorkflowStatus) setStatus(autoWorkflowStatus, 'Agent 正在决策下一步…', '');
          decision = await decideAgentNextAction(ctx);
        } catch (err) {
          decision = null;
        }
        var decisionAction = extractDecisionAction(decision);
        var decisionReason = extractDecisionReason(decision);
        if (decisionAction && decisionReason) {
          pushAgentLog('info', 'Agent 决策：' + decisionAction + '（' + decisionReason + '）');
        } else if (decisionAction) {
          pushAgentLog('info', 'Agent 决策：' + decisionAction);
        }
        action = normalizeAgentAction(decisionAction);
        if (!action) action = pickFallbackAgentAction(ctx);
        if (isAgentActionSatisfied(action, ctx)) {
          pushAgentLog('info', '检测到已有结果，跳过步骤：' + resolveAgentActionLabel(action));
          action = pickFallbackAgentAction(ctx);
        }
        if (action === 'finish' && !ctx.has_cases_compare) {
          action = pickFallbackAgentAction(ctx);
        }
        var flowConstraint = resolveAgentFlowConstraint();
        if (flowConstraint) {
          var constrained = resolveFlowConstrainedAction(action, ctx, flowConstraint);
          if (constrained !== action && constrained !== 'finish') {
            pushAgentLog('info', '根据提示调整下一步：' + resolveAgentActionLabel(constrained));
          }
          action = constrained;
          if (action === 'finish') {
            var flowNote = buildAgentFlowNote(flowConstraint);
            markAgentPlanSkippedByFlow(flowConstraint);
            if (flowNote) {
              pushAgentLog('info', flowNote + '，已按提示结束流程');
              if (autoWorkflowStatus) setStatus(autoWorkflowStatus, flowNote + '，Agent 已按提示结束流程', 'warn');
              state.caseGenAgentFlowStopNote = flowNote;
            }
            return;
          }
        }
        if (action === 'wait_clarify') {
          if (!state.autoRequireClarifications) {
            pushAgentLog('info', '未启用澄清确认，跳过等待');
            action = pickFallbackAgentAction(ctx);
          } else if (!ctx.has_review) {
            pushAgentLog('info', '澄清前缺少评审结果，先执行需求评审');
            action = 'review';
          } else if (!ctx.review_clarifications_ready) {
            pushAgentLog('warn', '评审结果未生成澄清点，重新执行需求评审');
            action = 'review';
          } else if (ctx.clarify_confirmed) {
            pushAgentLog('info', '澄清已确认，继续执行后续步骤');
            action = pickFallbackAgentAction(ctx);
          }
        }
        if (action === 'finish') {
          return;
        }
        if (action === 'wait_coverage') {
          await handleAgentCoverageAfterCompare(agentContext);
          continue;
        }
        if (action === 'wait_clarify') {
          await handleAutoClarifyAfterReview(agentContext);
          await runClarifyFollowupIfNeeded(agentContext);
          continue;
        }
        if (action === 'review') {
          await runAgentStepWithRetry('review', agentContext, { label: '需求评审' });
          await runClarifyFollowupIfNeeded(agentContext);
          continue;
        }
        if (action === 'clean') {
          await runAgentStepWithRetry('clean', agentContext, { label: '需求清洗' });
          continue;
        }
        if (action === 'compare') {
          await runAgentStepWithRetry('compare', agentContext, { label: '对比完整性' });
          await handleAgentCoverageAfterCompare(agentContext);
          continue;
        }
        if (action === 'split') {
          await runAgentStepWithRetry('split', agentContext, { label: '测试模块拆分' });
          continue;
        }
        if (action === 'cases') {
          await runAgentStepWithRetry('cases', agentContext, { label: '覆盖对比' });
          continue;
        }
        await runAgentStepWithRetry(action, agentContext, { label: action });
      }
      throw new Error('Agent 达到最大执行轮次仍未完成');
    }

    async function notifyFeishuCoverageFailure() {
      if (!state.autoRunning || !getFeishuWebhookUrl()) return;
      await postFeishuMessage('需求：' + getRequirementDisplayName() + '，清洗覆盖率不足100%，需手动重新清洗。');
    }

    async function notifyFeishuWorkflowSuccess() {
      if (!getFeishuWebhookUrl()) return;
      await postFeishuMessage('全流程执行成功，请前往工具查看结果！！！');
    }

    async function notifyFeishuClarificationNeeded() {
      if (!state.autoRunning || !state.autoRequireClarifications) return;
      if (!getFeishuWebhookUrl()) return;
      await postFeishuMessage('请前往工具，进行需求澄清，确认澄清结果后可继续执行。');
    }

    function ensureAutoCompareDrawer() {
      if (autoCompareDrawer) return autoCompareDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      autoCompareDrawer = window.app.drawer.createDrawer({
        drawerId: 'autoCompareDrawer',
        closeButtons: ['closeAutoCompareDrawerBtn'],
        onClose: function() {
          if (autoCompareMissing) {
            autoCompareMissing.classList.add('hidden');
            autoCompareMissing.classList.remove('visible');
            autoCompareMissing.innerHTML = '';
          }
          setAutoCompareToggleLabel(false);
        },
      });
      return autoCompareDrawer;
    }

    function ensureAutoMissingDrawer() {
      if (autoMissingDrawer) return autoMissingDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      autoMissingDrawer = window.app.drawer.createDrawer({
        drawerId: 'autoMissingDrawer',
        closeButtons: ['closeAutoMissingDrawerBtn'],
        onClose: function() {
          if (autoMissingView) {
            autoMissingView.classList.add('hidden');
            autoMissingView.classList.remove('visible');
            autoMissingView.innerHTML = '';
          }
          setAutoMissingToggleLabel(false);
        },
      });
      return autoMissingDrawer;
    }

    function renderAutoMissingTable() {
      if (!state.missingRowCache.length) {
        return '<p class="hint" style="padding:12px;">暂无缺失测试点</p>';
      }
      var selectAllChecked = state.missingSelections.size && state.missingSelections.size === state.missingRowCache.length;
      var rows = state.missingRowCache.map(function(row, idx) {
        return '' +
          '<tr>' +
            '<td class="check"><input type="checkbox" data-auto-missing-index="' + idx + '" ' + (state.missingSelections.has(idx) ? 'checked' : '') + '></td>' +
            '<td class="module">' + escapeHtml(row.moduleName || '-') + '</td>' +
            '<td class="remark">' + escapeHtml(row.text || '（缺失测试点未解析）') + '</td>' +
          '</tr>';
      }).join('');
      return '' +
        '<table class="table-view">' +
          '<thead>' +
            '<tr>' +
              '<th class="check"><input type="checkbox" data-auto-missing-select-all ' + (selectAllChecked ? 'checked' : '') + '></th>' +
              '<th class="module">缺失模块</th>' +
              '<th class="remark">缺失测试点</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>';
    }

    function resetAutoMissingView() {
      if (autoMissingView) {
        autoMissingView.innerHTML = '';
        autoMissingView.classList.add('hidden');
        autoMissingView.classList.remove('visible');
      }
      setAutoMissingToggleLabel(false);
      var drawer = autoMissingDrawer || ensureAutoMissingDrawer();
      if (drawer && drawer.element && drawer.element.classList.contains('open')) drawer.close();
    }

    function refreshAutoMissingSelectionUI() {
      if (!autoMissingView) return;
      var length = state.missingRowCache.length;
      var rowCheckboxes = autoMissingView.querySelectorAll('input[data-auto-missing-index]');
      rowCheckboxes.forEach(function(cb) {
        var idx = Number(cb.dataset.autoMissingIndex);
        cb.checked = state.missingSelections.has(idx);
      });
      var master = autoMissingView.querySelector('input[data-auto-missing-select-all]');
      if (master) {
        master.checked = length > 0 && state.missingSelections.size === length;
        master.indeterminate = state.missingSelections.size > 0 && state.missingSelections.size < length;
      }
    }

    function updateAutoMissingCard() {
      if (!autoMissingView || !autoMissingToggle || !autoMissingCopy) return;
      var hasData = state.missingRowCache.length > 0;
      var disabled = !hasData || state.autoRunning;
      autoMissingToggle.disabled = disabled;
      autoMissingCopy.disabled = disabled;
      if (autoMissingSmartFillBtn) autoMissingSmartFillBtn.disabled = disabled;
      if (autoMissingGoUsecaseBtn) autoMissingGoUsecaseBtn.disabled = disabled;
      setAutoMissingToggleLabel(autoMissingDrawer && autoMissingDrawer.element && autoMissingDrawer.element.classList.contains('open'));
      if (!hasData) {
        resetAutoMissingView();
        setMissingStatus('', '');
        return;
      }
      if (autoMissingView.classList.contains('visible')) {
        autoMissingView.innerHTML = renderAutoMissingTable();
      }
    }

    function toggleAutoMissingView() {
      if (!autoMissingView || !autoMissingToggle || autoMissingToggle.disabled) return;
      if (!state.missingRowCache.length) {
        setMissingStatus('当前没有缺失测试点', 'warn');
        return;
      }
      var drawer = ensureAutoMissingDrawer();
      if (!drawer) return;
      var isOpen = drawer.element && drawer.element.classList.contains('open');
      if (isOpen) {
        drawer.close();
        setMissingStatus('', '');
        return;
      }
      autoMissingView.innerHTML = renderAutoMissingTable();
      autoMissingView.classList.remove('hidden');
      autoMissingView.classList.add('visible');
      setAutoMissingToggleLabel(true);
      refreshAutoMissingSelectionUI();
      if (autoMissingDrawerTitle) autoMissingDrawerTitle.textContent = '缺失模块视图';
      if (autoMissingDrawerBody) autoMissingDrawerBody.scrollTop = 0;
      drawer.open();
    }

    function ensureAutoMissingViewVisible(scrollIntoCenter) {
      if (scrollIntoCenter === void 0) scrollIntoCenter = false;
      if (!autoMissingView || !autoMissingToggle || autoMissingToggle.disabled) return;
      var drawer = ensureAutoMissingDrawer();
      if (!drawer) return;
      var isOpen = drawer.element && drawer.element.classList.contains('open');
      if (!autoMissingView.classList.contains('visible')) {
        autoMissingView.innerHTML = renderAutoMissingTable();
        autoMissingView.classList.remove('hidden');
        autoMissingView.classList.add('visible');
        refreshAutoMissingSelectionUI();
      }
      if (!isOpen) {
        setAutoMissingToggleLabel(true);
        if (autoMissingDrawerBody) autoMissingDrawerBody.scrollTop = 0;
        drawer.open();
      }
      if (scrollIntoCenter) {
        var target = drawer.element || (dom.autoMissingSectionSelector && document.querySelector(dom.autoMissingSectionSelector)) || (autoMissingView.closest && autoMissingView.closest('.card'));
        if (target) scrollElementIntoView(target, 'smooth', 160);
      }
    }

    function copyAutoMissingJson() {
      if (!autoMissingCopy || autoMissingCopy.disabled) return;
      var list = state.missingLastList.length ? state.missingLastList : parseMissingModules(casesCompareResultEl && casesCompareResultEl.value ? casesCompareResultEl.value : '');
      if (!list.length) {
        setMissingStatus('当前没有缺失测试点', 'warn');
        return;
      }
      var payload = JSON.stringify({ missing: list }, null, 2);
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(payload).then(function() {
          setMissingStatus(state.missingSelections.size ? '已复制所选缺失测试点 JSON' : '缺失模块 JSON 已复制', 'ok');
        }).catch(function() {
          setMissingStatus('复制失败，请手动复制', 'warn');
        });
      } else {
        setMissingStatus('当前浏览器不支持自动复制，请手动复制', 'warn');
      }
    }

    function handleMissingSelectionChange(index, checked) {
      if (checked) state.missingSelections.add(index);
      else state.missingSelections.delete(index);
      refreshAutoMissingSelectionUI();
      persistWorkflowState();
    }

    function handleMissingSelectAll(checked) {
      state.missingSelections.clear();
      if (checked) {
        state.missingRowCache.forEach(function(_, idx) { state.missingSelections.add(idx); });
      }
      refreshAutoMissingSelectionUI();
      persistWorkflowState();
    }

    function closeMissingDrawersAfterFill() {
      var autoDrawer = autoMissingDrawer || ensureAutoMissingDrawer();
      if (autoDrawer && autoDrawer.element && autoDrawer.element.classList.contains('open')) {
        autoDrawer.close();
      }
      if (typeof document === 'undefined') return;
      var missingDrawer = document.getElementById('missingViewDrawer');
      if (missingDrawer && missingDrawer.classList.contains('open')) {
        var closeTrigger = missingDrawer.querySelector('[data-drawer-close="missingViewDrawer"]') || missingDrawer.querySelector('.drawer-mask');
        if (closeTrigger && typeof closeTrigger.click === 'function') {
          closeTrigger.click();
        } else if (window.app && window.app.drawer && typeof window.app.drawer.createDrawer === 'function') {
          var tempDrawer = window.app.drawer.createDrawer({ drawerId: 'missingViewDrawer', closeButtons: ['closeMissingViewDrawerBtn'] });
          if (tempDrawer && typeof tempDrawer.close === 'function') tempDrawer.close();
        } else {
          missingDrawer.classList.remove('open');
        }
      }
    }

    function smartFillMissingSuggestions() {
      if (!state.caseGenModules.length) {
        setMissingStatus('请先完成测试模块拆分，才能智能填充建议', 'warn');
        return;
      }
      var list = state.missingLastList.length ? state.missingLastList : parseMissingModules(casesCompareResultEl && casesCompareResultEl.value ? casesCompareResultEl.value : '');
      if (!list.length) {
        setMissingStatus('当前没有可用的缺失模块数据', 'warn');
        return;
      }
      if (!state.missingRowCache.length) {
        state.missingRowCache = buildMissingRows(list);
      }
      var targets = state.missingSelections.size ? pickMissingSelections(state) : list;
      if (!targets.length) {
        setMissingStatus('未找到可填充的缺失测试点', 'warn');
        return;
      }
      var moduleMap = new Map(
        state.caseGenModules.map(function(mod) {
          var key = mod && mod.title ? mod.title.trim() : '';
          return [key, mod];
        })
      );
      var unmatched = [];
      var updatedCount = 0;
      targets.forEach(function(item) {
        if (!item) return;
        var mod = moduleMap.get((item.module || '').trim());
        if (!mod) {
          unmatched.push(item.module || '未命名模块');
          return;
        }
        var segments = [];
        if (item.scenarios && item.scenarios.length) segments.push('缺失测试场景：' + item.scenarios.join('；'));
        if (item.points && item.points.length) segments.push('缺失测试要点：' + item.points.join('；'));
        if (item.coupled && item.coupled.length) segments.push('耦合模块提示：' + item.coupled.join('；'));
        if (item.special && item.special.length) segments.push('特殊测试点：' + item.special.join('；'));
        if (!segments.length) return;
        var addition = segments.join('\n') + '\n\n完整补充上述测试要点的相关用例。';
        state.caseGenSuggestions[mod.id] = addition;
        if (casesGenerationContainer) {
          var textarea = casesGenerationContainer.querySelector('textarea[data-suggestion=\"' + mod.id + '\"]');
          if (textarea) textarea.value = state.caseGenSuggestions[mod.id];
        }
        updatedCount += 1;
      });
      if (!updatedCount) {
        setMissingStatus(unmatched.length ? '所选模块均未在拆分结果中找到：' + unmatched.join('、') : '未找到可填充的缺失信息', 'warn');
        return;
      }
      if (unmatched.length) {
        setMissingStatus('已填充 ' + updatedCount + ' 个模块，以下模块未在拆分结果中找到：' + unmatched.join('、'), 'warn');
      } else {
        setMissingStatus('已将 ' + updatedCount + ' 个缺失模块的建议同步至用例生成', 'ok');
      }
      closeMissingDrawersAfterFill();
      switchTab('casesgen');
    }

    function resetAutoCompareMissingView() {
      if (autoCompareMissing) {
        autoCompareMissing.innerHTML = '';
        autoCompareMissing.classList.add('hidden');
        autoCompareMissing.classList.remove('visible');
      }
      setAutoCompareToggleLabel(false);
      var drawer = autoCompareDrawer || ensureAutoCompareDrawer();
      if (drawer && drawer.element && drawer.element.classList.contains('open')) drawer.close();
      updateAutoCompareActions(extractCoverageFromCompareResult());
    }

    function resetAutoCompareUserInputs(clearSuggestion) {
      if (clearSuggestion === void 0) clearSuggestion = true;
      if (state.autoCompareSelections) state.autoCompareSelections.clear();
      if (clearSuggestion) {
        state.autoCompareSuggestion = '';
        if (autoCompareSuggestionInput) autoCompareSuggestionInput.value = '';
      }
    }

    function renderAutoCompareMissingView(list, coverage, preserveSelection, shouldOpenDrawer) {
      if (preserveSelection === void 0) preserveSelection = false;
      if (coverage === void 0) coverage = extractCoverageFromCompareResult();
      if (shouldOpenDrawer === void 0) shouldOpenDrawer = true;
      if (!autoCompareMissing) return;
      var shouldShow = Array.isArray(list) && list.length && typeof coverage === 'number' && coverage < 100;
      if (!shouldShow) {
        state.autoCompareMissingList = [];
        state.autoCompareSelections.clear();
        state.autoCompareSelectionTouched = false;
        resetAutoCompareMissingView();
        updateAutoCompareActions(coverage);
        return;
      }
      var drawer = ensureAutoCompareDrawer();
      if (!drawer) return;
      state.autoCompareMissingList = list.slice();
      if (!preserveSelection) {
        state.autoCompareSelections.clear();
        state.autoCompareSelectionTouched = false;
      } else {
        var filtered = new Set();
        state.autoCompareSelections.forEach(function(idx) {
          if (idx >= 0 && idx < list.length) filtered.add(idx);
        });
        state.autoCompareSelections = filtered;
      }
      var allSelected = list.length && state.autoCompareSelections.size === list.length;
      var rows = list.map(function(item, idx) {
        return '<tr>' +
          '<td class="check"><input type="checkbox" data-auto-compare-index="' + idx + '" ' + (state.autoCompareSelections.has(idx) ? 'checked' : '') + '></td>' +
          '<td class="index">' + (idx + 1) + '</td>' +
          '<td>' + escapeHtml(formatMissingRequirement(item)) + '</td>' +
        '</tr>';
      }).join('');
      autoCompareMissing.innerHTML = '<table class="table-view">' +
        '<thead>' +
          '<tr>' +
            '<th class="check"><input type="checkbox" data-auto-compare-select-all ' + (allSelected ? 'checked' : '') + '></th>' +
            '<th class="index">编号</th>' +
            '<th>缺少需求点</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>';
      autoCompareMissing.classList.remove('hidden');
      autoCompareMissing.classList.add('visible');
      if (shouldOpenDrawer) {
        setAutoCompareToggleLabel(true);
        if (autoCompareDrawerTitle) autoCompareDrawerTitle.textContent = '覆盖缺失视图';
        if (autoCompareDrawerBody) autoCompareDrawerBody.scrollTop = 0;
        drawer.open();
      }
      if (autoCompareToggleBtn) {
        var waitingCompare = Boolean(state.waitingSteps && state.waitingSteps.compare);
        autoCompareToggleBtn.disabled = Boolean(state.autoRunning && !waitingCompare);
      }
      updateAutoCompareActions(coverage);
    }

    function toggleAutoCompareView() {
      if (!autoCompareMissing || !autoCompareToggleBtn || autoCompareToggleBtn.disabled) return;
      if (!state.autoCompareMissingList.length) return;
      var drawer = ensureAutoCompareDrawer();
      if (!drawer) return;
      var isOpen = drawer.element && drawer.element.classList.contains('open');
      if (isOpen) {
        drawer.close();
        setAutoCompareToggleLabel(false);
        return;
      }
      renderAutoCompareMissingView(state.autoCompareMissingList, extractCoverageFromCompareResult(), true);
    }

    function getSelectedAutoCompareMissing() {
      var list = state.autoCompareMissingList || [];
      if (!list.length) return [];
      if (!state.autoCompareSelectionTouched) return list;
      if (!state.autoCompareSelections.size) return [];
      return list.filter(function(_, idx) { return state.autoCompareSelections.has(idx); });
    }

    function buildFilteredComparePayload() {
      var coverage = extractCoverageFromCompareResult();
      var selected = getSelectedAutoCompareMissing();
      var useList = selected.length ? selected : state.autoCompareMissingList;
      var payload = {};
      if (coverage !== null) payload.coverage = coverage;
      if (useList && useList.length) payload.missing = useList;
      return Object.keys(payload).length ? JSON.stringify(payload, null, 2) : '';
    }

    function updateAutoCompareActions(coverage) {
      if (coverage === void 0) coverage = extractCoverageFromCompareResult();
      var hasClean = shouldExpectCleanJson() && Boolean(cleanedTextEl && cleanedTextEl.value && cleanedTextEl.value.trim());
      var waitingCompare = Boolean(state.waitingSteps && state.waitingSteps.compare);
      var autoBlocked = Boolean(state.autoRunning && !waitingCompare);
      var canRetry = Boolean(!autoBlocked && coverage !== null && coverage < 100);
      if (autoRecleanBtn) autoRecleanBtn.disabled = !canRetry;
      if (autoIgnoreCoverageBtn) autoIgnoreCoverageBtn.disabled = !canRetry;
      if (autoJumpCleanViewBtn) autoJumpCleanViewBtn.disabled = !(coverage !== null && hasClean);
      var selected = getSelectedAutoCompareMissing();
      var suggestion = state.autoCompareSuggestion ? state.autoCompareSuggestion.trim() : '';
      if (autoFillCleanBtn) autoFillCleanBtn.disabled = Boolean(autoBlocked) || !(selected.length || suggestion);
      if (autoCompareToggleBtn) {
        var hasMissing = state.autoCompareMissingList && state.autoCompareMissingList.length;
        autoCompareToggleBtn.disabled = Boolean(autoBlocked) || !hasMissing;
        if (!hasMissing) setAutoCompareToggleLabel(false);
      }
    }

    function syncAutoCompareStatus(shouldOpenDrawer) {
      var coverage = extractCoverageFromCompareResult();
      if (shouldOpenDrawer === void 0) {
        shouldOpenDrawer = true;
        if (coverage !== null && coverage < 100 && state.autoRunning && isCaseGenAgentEnabled()) {
          var limit = getAgentCoverageThreshold();
          var retryCount = Number(state.caseGenAgentCoverageRetries || 0);
          if (coverage < limit && retryCount < 2) {
            shouldOpenDrawer = false;
          }
        }
      }
      var data = extractCompareResultData();
      var missing = data && Array.isArray(data.missing) ? data.missing : [];
      setAutoCompareStatusText(coverage === null ? '覆盖率：--' : '覆盖率：' + coverage + '%');
      updateAutoCompareActions(coverage);
      if (autoRecleanStatus && !(coverage !== null && coverage < 100)) setStatus(autoRecleanStatus, '', '');
      if (!(coverage !== null && coverage < 100) && autoWorkflowStatus) setStatus(autoWorkflowStatus, '', '');
      if (!(coverage !== null && coverage < 100)) clearStepWaiting('compare');
      renderAutoCompareMissingView(missing, coverage, false, shouldOpenDrawer);
      return coverage;
    }

    function buildAutoWorkflowTaskMessages(kind, options) {
      var opts = options || {};
      var result = {};
      function assignMessage(key, text, tone) {
        result[key] = { text: text || '', tone: tone || '' };
      }
      if (kind === 'continue') {
        assignMessage('recleanStart', '已忽略覆盖率不足，正在执行剩余步骤…', 'warn');
        assignMessage('workflowStart', '已忽略覆盖率，正在继续执行后续流程', 'warn');
        assignMessage('recleanSuccess', '已忽略覆盖率完成剩余步骤，请检查结果', 'ok');
        assignMessage('workflowSuccess', '剩余步骤执行完成，覆盖率仍不足 100%，请注意风险', 'warn');
        assignMessage('recleanFailure', '忽略覆盖率继续失败', 'err');
        assignMessage('workflowFailure', '忽略覆盖率继续失败', 'err');
        return result;
      }
      if (kind === 'agent_continue') {
        assignMessage('recleanStart', '已忽略覆盖率不足，Agent 正在继续执行…', 'warn');
        assignMessage('workflowStart', '已忽略覆盖率，Agent 正在继续执行后续流程', 'warn');
        assignMessage('recleanSuccess', '已忽略覆盖率完成剩余步骤，请检查结果', 'ok');
        assignMessage('workflowSuccess', 'Agent 已完成剩余步骤，覆盖率仍不足，请注意风险', 'warn');
        assignMessage('recleanFailure', '忽略覆盖率继续失败', 'err');
        assignMessage('workflowFailure', '忽略覆盖率继续失败', 'err');
        return result;
      }
      if (kind === 'reclean' || kind === 'supplement') {
        assignMessage('recleanStart', opts.startMessage || '重新执行中（从需求清洗开始）...', opts.startTone || '');
        assignMessage('workflowStart', opts.workflowStartMessage || '正在重新执行剩余步骤，请勿关闭页面', opts.workflowStartTone || '');
        assignMessage('recleanSuccess', opts.successMessage || '重新执行完成', opts.successTone || 'ok');
        assignMessage('workflowSuccess', opts.workflowSuccessMessage || '重新执行完成，可切换至“功能流程”查看详情', opts.workflowSuccessTone || 'ok');
        assignMessage('recleanFailure', opts.failureMessage || '重新执行中断', opts.failureTone || 'err');
        assignMessage('workflowFailure', opts.workflowFailureMessage || '一键执行中断', opts.workflowFailureTone || 'err');
        return result;
      }
      if (kind === 'agent') {
        assignMessage('workflowStart', 'Agent 正在执行用例生成流程，请勿关闭页面', '');
        assignMessage('workflowSuccess', 'Agent 已完成用例生成流程，请检查结果', 'ok');
        assignMessage('workflowFailure', 'Agent 执行中断', 'err');
        return result;
      }
      assignMessage('workflowStart', '正在执行完整工作流，请勿关闭页面', '');
      assignMessage('workflowSuccess', '一键执行完成，可切换至“功能流程”查看详情', 'ok');
      assignMessage('workflowFailure', '一键执行中断', 'err');
      return result;
    }

    function applyAutoWorkflowTaskState(task) {
      var hasTask = Boolean(task && typeof task === 'object');
      var running = Boolean(hasTask && task.status === 'running');
      state.autoRunning = running;
      if (autoWorkflowBtn) autoWorkflowBtn.disabled = running;
      if (autoClarifyToggle) autoClarifyToggle.disabled = running;
      if (autoRecleanBtn) autoRecleanBtn.disabled = running;
      if (autoIgnoreCoverageBtn) autoIgnoreCoverageBtn.disabled = running;
      if (autoFillCleanBtn) autoFillCleanBtn.disabled = running;
      if (autoJumpCleanViewBtn) autoJumpCleanViewBtn.disabled = running;
      syncAgentStopButton();

      if (!hasTask) {
        updateAutoCompareActions();
        updateAutoMissingCard();
        updateFlowStatus();
        return;
      }

      var kind = task.kind || 'full';
      var messages = task.messages && typeof task.messages === 'object'
        ? task.messages
        : buildAutoWorkflowTaskMessages(kind, task.messageOptions || {});

      function resolveMessage(key, fallbackText, fallbackTone) {
        var msg = messages && messages[key];
        if (msg && typeof msg === 'object') {
          return {
            text: msg.text || fallbackText || '',
            tone: msg.tone || fallbackTone || ''
          };
        }
        if (typeof msg === 'string') return { text: msg, tone: fallbackTone || '' };
        return { text: fallbackText || '', tone: fallbackTone || '' };
      }

      if (running) {
        var startWorkflow = resolveMessage('workflowStart', '正在执行完整工作流，请勿关闭页面', '');
        if (autoWorkflowStatus) setStatus(autoWorkflowStatus, startWorkflow.text, startWorkflow.tone);
        if (kind !== 'full') {
          var startReclean = resolveMessage('recleanStart', '', '');
          if (autoRecleanStatus) setStatus(autoRecleanStatus, startReclean.text, startReclean.tone);
        }
      } else if (task.status === 'waiting') {
        var waitText = task.error ? String(task.error) : '';
        var waitWorkflow = resolveMessage('workflowFailure', '等待人工处理', 'warn');
        var waitMsg = waitText ? (waitWorkflow.text + '：' + waitText) : waitWorkflow.text;
        if (autoWorkflowStatus) setStatus(autoWorkflowStatus, waitMsg, 'warn');
        if (kind !== 'full') {
          if (autoRecleanStatus) setStatus(autoRecleanStatus, waitMsg, 'warn');
        }
      } else if (task.status === 'done') {
        var doneWorkflow = resolveMessage('workflowSuccess', '一键执行完成，可切换至“功能流程”查看详情', 'ok');
        if (autoWorkflowStatus) setStatus(autoWorkflowStatus, doneWorkflow.text, doneWorkflow.tone);
        if (kind !== 'full') {
          var doneReclean = resolveMessage('recleanSuccess', '', 'ok');
          if (autoRecleanStatus) setStatus(autoRecleanStatus, doneReclean.text, doneReclean.tone);
        }
      } else if (task.status === 'stopped') {
        var stopText = task.error ? String(task.error) : '';
        var stopWorkflow = resolveMessage('workflowFailure', 'Agent 已停止', 'warn');
        var stopMsg = stopText ? (stopWorkflow.text + '：' + stopText) : stopWorkflow.text;
        if (autoWorkflowStatus) setStatus(autoWorkflowStatus, stopMsg, 'warn');
        if (kind !== 'full') {
          if (autoRecleanStatus) setStatus(autoRecleanStatus, stopMsg, 'warn');
        }
        markAgentPlanStopped('已终止');
      } else if (task.status === 'error') {
        var errText = task.error ? String(task.error) : '';
        var failWorkflow = resolveMessage('workflowFailure', '一键执行中断', 'err');
        var workflowMsg = errText ? (failWorkflow.text + '：' + errText) : failWorkflow.text;
        if (autoWorkflowStatus) setStatus(autoWorkflowStatus, workflowMsg, failWorkflow.tone || 'err');
        if (kind !== 'full') {
          var failReclean = resolveMessage('recleanFailure', '', 'err');
          var recleanMsg = errText ? (failReclean.text + '：' + errText) : failReclean.text;
          if (autoRecleanStatus) setStatus(autoRecleanStatus, recleanMsg, failReclean.tone || 'err');
        }
      }

      updateAutoClarifyVisibility();
      updateAutoCompareActions();
      updateAutoMissingCard();
      updateFlowStatus();
      if (task.status === 'done' && task.expandMissing) {
        ensureAutoMissingViewVisible(true);
      }
      renderAgentPanel();
    }

    function isAutoWorkflowReady() {
      return Boolean(
        rawText &&
        reviewResultEl &&
        cleanedTextEl &&
        compareResultEl &&
        splitResultEl &&
        casesCompareResultEl
      );
    }

    function buildAutoWorkflowSteps() {
      if (isCaseGenAgentEnabled()) {
        return [{
          key: 'agent',
          label: '用例生成 Agent',
          run: function(ctx) { return runCaseGenAgentWorkflow(ctx); },
          validate: function() { return true; },
        }];
      }
      return [
        {
          key: 'review',
          label: '需求评审',
          run: function() { return reviewRequirements(); },
          validate: function() { return Boolean(reviewResultEl && reviewResultEl.value && reviewResultEl.value.trim().length > 0); },
          after: function() { return handleAutoClarifyAfterReview(); },
        },
        { key: 'clean', label: '需求清洗', run: function(ctx) { return runCleaning(ctx); }, validate: function() { return Boolean(cleanedTextEl && cleanedTextEl.value && cleanedTextEl.value.trim().length > 0); } },
        { key: 'compare', label: '对比完整性', run: function() { return compareCoverage(); }, validate: function() { return Boolean(compareResultEl && compareResultEl.value && compareResultEl.value.trim().length > 0); }, after: function() { return enforceAutoCoverageRequirement(); } },
        { key: 'split', label: '测试模块拆分', run: function() { return splitModules(); }, validate: function() { return Boolean(splitResultEl && splitResultEl.value && splitResultEl.value.trim().length > 0); } },
        { key: 'cases', label: '覆盖对比', run: function() { return compareCasesCoverage(); }, validate: function() { return Boolean(casesCompareResultEl && casesCompareResultEl.value && casesCompareResultEl.value.trim().length > 0); } },
      ];
    }

    async function executeAutoWorkflowSteps(startIndex, context) {
      if (startIndex === void 0) startIndex = 0;
      if (!context) context = {};
      var steps = buildAutoWorkflowSteps();
      for (var i = startIndex; i < steps.length; i += 1) {
        var step = steps[i];
        if (step && step.key) clearStepFailed(step.key);
        try {
          await step.run(context);
          if (!step.validate()) {
            var invalidReason = step.label + '未产生有效输出，请检查模型配置或稍后重试';
            setStepFailed(step.key, invalidReason);
            updateFlowStatus();
            throw new Error(invalidReason);
          }
          if (step.after) {
            await step.after();
          }
        } catch (err) {
          if (step && step.key) setStepFailed(step.key, err && err.message ? err.message : '执行失败');
          updateFlowStatus();
          throw err;
        }
      }
    }

    function buildAgentCoverageFixSuggestions(coverage, limit) {
      var data = extractCompareResultData();
      var missing = data && Array.isArray(data.missing) ? data.missing : [];
      if (!missing.length) return '';
      var lines = missing.slice(0, 8).map(function(item, idx) {
        return (idx + 1) + '. ' + formatMissingRequirement(item);
      });
      if (missing.length > 8) {
        lines.push('... 还有 ' + (missing.length - 8) + ' 条未覆盖需求点');
      }
      var header = '覆盖率仅 ' + coverage + '%（阈值 ' + limit + '%），建议优先补充以下缺失项：';
      return header + '\n' + lines.join('\n');
    }

    function normalizeCoverageSnapshot(entry, fallbackIndex) {
      var item = entry && typeof entry === 'object' ? entry : {};
      var index = Number(item.index);
      if (!Number.isFinite(index)) index = fallbackIndex || 0;
      var coverage = Number(item.coverage);
      if (!Number.isFinite(coverage)) coverage = null;
      var compareText = '';
      if (typeof item.compare === 'string') compareText = item.compare.trim();
      if (!compareText && typeof item.compareText === 'string') compareText = item.compareText.trim();
      var cleanedText = '';
      if (typeof item.cleaned === 'string') cleanedText = item.cleaned;
      if (!cleanedText && typeof item.cleanedText === 'string') cleanedText = item.cleanedText;
      var note = item.note ? String(item.note) : '';
      return {
        index: index,
        coverage: coverage,
        compare: compareText,
        cleaned: cleanedText,
        note: note,
      };
    }

    function summarizeCoverageSnapshots(list) {
      if (!Array.isArray(list) || !list.length) return '';
      var parts = list
        .filter(function(item) { return item && Number.isFinite(item.coverage); })
        .map(function(item) {
          var label = '第' + item.index + '次 ' + item.coverage + '%';
          return item.note ? (label + '（' + item.note + '）') : label;
        })
        .filter(Boolean);
      return parts.join('、');
    }

    function pickBestCoverageSnapshot(list) {
      if (!Array.isArray(list) || !list.length) return null;
      var best = null;
      list.forEach(function(item) {
        if (!item || !Number.isFinite(item.coverage)) return;
        if (!best || item.coverage > best.coverage || (item.coverage === best.coverage && item.index > best.index)) {
          best = item;
        }
      });
      return best;
    }

    function applyAgentCoverageSelection(history, options) {
      if (!Array.isArray(history) || !history.length) return null;
      var normalized = history.map(function(item, idx) {
        return normalizeCoverageSnapshot(item, idx + 1);
      });
      var best = pickBestCoverageSnapshot(normalized);
      if (!best) return null;
      var summary = summarizeCoverageSnapshots(normalized);
      var opts = options || {};
      var logEnabled = opts.log !== false;
      if (logEnabled) {
        var message = 'Agent 决策：覆盖率仍不足阈值，保留最高覆盖率结果：第' + best.index + '次 ' + best.coverage + '%';
        if (summary) message += '（记录：' + summary + '）';
        pushAgentLog('warn', message);
      }
      var updated = false;
      if (compareResultEl && best.compare && compareResultEl.value.trim() !== best.compare) {
        compareResultEl.value = best.compare;
        updated = true;
      }
      if (cleanedTextEl && best.cleaned && cleanedTextEl.value !== best.cleaned) {
        cleanedTextEl.value = best.cleaned;
        updated = true;
      }
      if (updated) {
        if (typeof renderCleanView === 'function') renderCleanView(true);
        if (typeof renderCleanRawView === 'function') renderCleanRawView(null);
        if (persistWorkflowState) persistWorkflowState();
      }
      var shouldOpenDrawer = Object.prototype.hasOwnProperty.call(opts, 'shouldOpenDrawer')
        ? Boolean(opts.shouldOpenDrawer)
        : true;
      syncAutoCompareStatus(shouldOpenDrawer);
      updateFlowStatus();
      return best;
    }

    async function handleAgentCoverageAfterCompare(context) {
      var limit = getAgentCoverageThreshold();
      var retryCount = Number(state.caseGenAgentCoverageRetries || 0);
      var coverageHistory = [];
      function recordCoverageSnapshot(coverageValue, note) {
        var attemptIndex = coverageHistory.length + 1;
        var normalized = Number(coverageValue);
        if (!Number.isFinite(normalized)) normalized = null;
        var compareText = compareResultEl && compareResultEl.value ? compareResultEl.value.trim() : '';
        var cleanedText = cleanedTextEl && cleanedTextEl.value ? cleanedTextEl.value : '';
        coverageHistory.push({
          index: attemptIndex,
          coverage: normalized,
          compare: compareText,
          cleaned: cleanedText,
          note: note || '',
        });
        var label = '覆盖率记录：第' + attemptIndex + '次对比';
        if (!Number.isFinite(normalized)) {
          pushAgentTrace('warn', label + '解析失败' + (note ? '（' + note + '）' : ''));
        } else {
          pushAgentTrace('info', label + ' ' + normalized + '%' + (note ? '（' + note + '）' : ''));
        }
      }
      var previewCoverage = extractCoverageFromCompareResult();
      var shouldOpenDrawer = !(previewCoverage !== null && previewCoverage < limit && retryCount < 2);
      var coverage = syncAutoCompareStatus(shouldOpenDrawer);
      recordCoverageSnapshot(coverage, '初始');
      setAgentPlanStatus('coverage', 'running', '');
      clearStepFailed('compare');
      clearStepWaiting('compare');
      if (coverage === null) {
        var msg = '对比完整性结果解析失败';
        setAgentPlanStatus('coverage', 'waiting', msg);
        setStepWaiting('compare', msg);
        updateFlowStatus();
        throw createAgentManualWaitError(msg, 'compare');
      }
      if (context && context.forceIgnoreCoverage) {
        setAgentPlanStatus('coverage', 'done', '已忽略覆盖率不足');
        return coverage;
      }
      if (coverage >= limit) {
        if (coverage < 100) {
          state.caseGenAgentCoverageBelowFull = true;
          var warnText = '覆盖率 ' + coverage + '% 已达到阈值，但仍未满 100%';
          setAgentPlanStatus('coverage', 'done', warnText);
          pushAgentLog('warn', warnText);
          var suggestion = buildAgentCoverageFixSuggestions(coverage, limit);
          if (suggestion) setAgentFixSuggestions(suggestion);
        } else {
          state.caseGenAgentCoverageBelowFull = false;
          setAgentPlanStatus('coverage', 'done', '覆盖率已满足 100%');
        }
        return coverage;
      }
      while (coverage < limit && retryCount < 2) {
        retryCount += 1;
        state.caseGenAgentCoverageRetries = retryCount;
        var note = '覆盖率不足，自动重清洗第 ' + retryCount + ' 次';
        setAgentPlanStatus('coverage', 'retrying', note, retryCount);
        pushAgentLog('warn', '覆盖率仅 ' + coverage + '%，' + note);
        await runAgentStepWithRetry('clean', Object.assign({}, context, {
          mode: 'reclean',
          compare: buildFilteredComparePayload(),
          suggestion: state.autoCompareSuggestion || ''
        }), { label: '需求清洗', note: '覆盖率不足自动重清洗' });
        await runAgentStepWithRetry('compare', context, { label: '对比完整性', note: '覆盖率复查' });
        previewCoverage = extractCoverageFromCompareResult();
        shouldOpenDrawer = !(previewCoverage !== null && previewCoverage < limit && retryCount < 2);
        coverage = syncAutoCompareStatus(shouldOpenDrawer);
        recordCoverageSnapshot(coverage, '重清洗后');
        if (coverage === null) break;
      }
      if (coverage === null) {
        var parseMsg = '对比完整性结果解析失败';
        setAgentPlanStatus('coverage', 'waiting', parseMsg);
        setStepWaiting('compare', parseMsg);
        updateFlowStatus();
        throw createAgentManualWaitError(parseMsg, 'compare');
      }
      if (coverage < limit) {
        var selected = null;
        if (coverageHistory.length > 1) {
          selected = applyAgentCoverageSelection(coverageHistory, { shouldOpenDrawer: true });
          if (selected && Number.isFinite(selected.coverage)) {
            coverage = selected.coverage;
          }
        }
        var fixText = buildAgentCoverageFixSuggestions(coverage, limit);
        if (fixText) setAgentFixSuggestions(fixText);
        var waitMsg = '覆盖率仍不足 ' + limit + '%，等待人工处理';
        if (coverageHistory.length > 1 && Number.isFinite(coverage)) {
          waitMsg = '覆盖率仍不足 ' + limit + '%（最高 ' + coverage + '%），等待人工处理';
        }
        setAgentPlanStatus('coverage', 'waiting', waitMsg, retryCount);
        setStepWaiting('compare', waitMsg);
        updateFlowStatus();
        throw createAgentManualWaitError(waitMsg, 'compare');
      }
      setAgentPlanStatus('coverage', 'done', '覆盖率已达到阈值');
      if (coverage < 100) {
        state.caseGenAgentCoverageBelowFull = true;
        var warnMsg = '覆盖率 ' + coverage + '% 已达到阈值，但仍未满 100%';
        pushAgentLog('warn', warnMsg);
        var suggest = buildAgentCoverageFixSuggestions(coverage, limit);
        if (suggest) setAgentFixSuggestions(suggest);
      } else {
        state.caseGenAgentCoverageBelowFull = false;
      }
      return coverage;
    }

    async function enforceAutoCoverageRequirement(threshold, options) {
      var limit = threshold === undefined || threshold === null ? 100 : clampAgentCoverageThreshold(threshold);
      var allowContinue = options && options.allowContinue === true;
      var agentMode = options && options.agent === true;
      var coverage = syncAutoCompareStatus();
      clearStepFailed('compare');
      clearStepWaiting('compare');
      if (coverage === null) {
        setStatus(autoWorkflowStatus, '无法解析对比完整性结果，自动流程已暂停', 'warn');
        if (autoRecleanBtn) autoRecleanBtn.disabled = false;
        if (autoIgnoreCoverageBtn) autoIgnoreCoverageBtn.disabled = true;
        if (autoRecleanStatus) setStatus(autoRecleanStatus, '请修正并重新清洗', 'warn');
        setStepFailed('compare', '对比完整性结果解析失败');
        updateFlowStatus();
        throw new Error('未解析到对比覆盖率');
      }
      if (!allowContinue && coverage < limit) {
        setStatus(autoWorkflowStatus, '覆盖率仅 ' + coverage + '% ，自动流程已停止', 'warn');
        if (autoRecleanBtn) autoRecleanBtn.disabled = false;
        if (autoIgnoreCoverageBtn) autoIgnoreCoverageBtn.disabled = false;
        if (autoRecleanStatus) setStatus(autoRecleanStatus, '覆盖率不足，点击“重新清洗并继续”以重跑流程', 'warn');
        setStepWaiting('compare', '覆盖率不足，等待确认');
        updateFlowStatus();
        await notifyFeishuCoverageFailure();
        throw new Error('对比覆盖率不足' + limit + '%');
      }
      if (coverage < 100 && limit < 100 && agentMode && autoWorkflowStatus) {
        setStatus(autoWorkflowStatus, '覆盖率 ' + coverage + '% ，已达到阈值继续执行', 'warn');
      }
      if (autoRecleanBtn) autoRecleanBtn.disabled = true;
      if (autoIgnoreCoverageBtn) autoIgnoreCoverageBtn.disabled = true;
      if (autoJumpCleanViewBtn) autoJumpCleanViewBtn.disabled = true;
      if (autoRecleanStatus) setStatus(autoRecleanStatus, '', '');
    }

    async function handleAutoClarifyAfterReview(context) {
      if (!state.autoRequireClarifications) return;
      if (context && context.skipClarify) return;
      var agentMode = isCaseGenAgentEnabled();
      switchTab('auto');
      if (autoClarifySection) autoClarifySection.classList.remove('hidden');
      if (agentMode) {
        var filled = autoFillReviewClarifications({ source: 'agent' });
        if (filled) {
          pushAgentLog('info', '已基于评审结果自动填充澄清建议');
        }
      }
      renderAutoClarifyView();
      setStepWaiting('review', '等待澄清确认');
      updateFlowStatus();
      if (agentMode) {
        setAgentPlanStatus('clarify', 'waiting', '等待澄清确认');
        if (openAutoClarifyPanel) openAutoClarifyPanel();
      }
      try {
        await notifyFeishuClarificationNeeded();
        await waitForAutoClarification();
        if (context && typeof context === 'object') context.clarifyConfirmed = true;
        if (agentMode) {
          setAgentPlanStatus('clarify', 'done', '澄清已确认');
          pushAgentLog('info', '需求澄清已确认，继续执行');
        }
      } finally {
        clearStepWaiting('review');
      }
    }

    async function runAutoWorkflow() {
      if (!autoWorkflowStatus) return;
      if (!rawText || !rawText.value || !rawText.value.trim()) {
        setStatus(autoWorkflowStatus, '请先导入原始需求', 'warn');
        return;
      }
      if (!hasCaseSource()) {
        setStatus(autoWorkflowStatus, '请先导入至少一份测试用例', 'warn');
        return;
      }
      clearAllWaitingSteps();
      clearAllFailedSteps();
      var agentEnabled = isCaseGenAgentEnabled();
      if (agentEnabled) resetAgentStopState();
      var autoWorkflowManager = getAutoWorkflowManager();
      if (autoWorkflowManager && typeof autoWorkflowManager.getTask === 'function') {
        var activeTask = autoWorkflowManager.getTask();
        if (activeTask && activeTask.status === 'running') {
          setStatus(autoWorkflowStatus, '正在执行，请稍候……', 'warn');
          return;
        }
      } else if (state.autoRunning) {
        setStatus(autoWorkflowStatus, '正在执行，请稍候……', 'warn');
        return;
      }
      renderAgentPanel();
      state.autoRunning = true;
      if (autoWorkflowBtn) autoWorkflowBtn.disabled = true;
      if (autoClarifyToggle) autoClarifyToggle.disabled = true;
      setAutoCompareStatusText('等待对比结果');
      resetAutoCompareMissingView();
      if (autoRecleanBtn) autoRecleanBtn.disabled = true;
      if (autoIgnoreCoverageBtn) autoIgnoreCoverageBtn.disabled = true;
      if (autoFillCleanBtn) autoFillCleanBtn.disabled = true;
      if (autoJumpCleanViewBtn) autoJumpCleanViewBtn.disabled = true;
      if (autoRecleanStatus) setStatus(autoRecleanStatus, '', '');
      if (autoMissingToggle) autoMissingToggle.disabled = true;
      if (autoMissingCopy) autoMissingCopy.disabled = true;
      setMissingStatus('', '');
      if (autoJumpCleanViewBtn) autoJumpCleanViewBtn.disabled = true;
      resetAutoMissingView();
      setStatus(autoWorkflowStatus, agentEnabled ? 'Agent 正在执行用例生成流程，请勿关闭页面' : '正在执行完整工作流，请勿关闭页面', '');
      var useManager = Boolean(autoWorkflowManager && typeof autoWorkflowManager.startTask === 'function');
      if (useManager) {
        var taskKind = agentEnabled ? 'agent' : 'full';
        autoWorkflowManager.startTask({
          kind: taskKind,
          startIndex: 0,
          stepIndex: 0,
          expandMissing: true,
          messages: buildAutoWorkflowTaskMessages(taskKind),
        }, { force: true });
        return;
      }
      try {
        await executeAutoWorkflowSteps(0);
        if (agentEnabled && state.caseGenAgentFlowStopNote) {
          var flowNote = state.caseGenAgentFlowStopNote;
          state.caseGenAgentFlowStopNote = '';
          setStatus(autoWorkflowStatus, flowNote + '，已按提示结束流程', 'warn');
        } else if (agentEnabled && state.caseGenAgentCoverageBelowFull) {
          setStatus(autoWorkflowStatus, 'Agent 已完成用例生成流程，但覆盖率未满 100%，请查看修复建议', 'warn');
        } else {
          setStatus(autoWorkflowStatus, agentEnabled ? 'Agent 已完成用例生成流程，请检查结果' : '一键执行完成，可切换至“功能流程”查看详情', 'ok');
        }
        state.autoExpandMissing = true;
        await notifyFeishuWorkflowSuccess();
      } catch (err) {
        console.error(err);
        if (agentEnabled && isAgentStoppedError(err)) {
          setStatus(autoWorkflowStatus, err.message || 'Agent 已停止', 'warn');
        } else if (agentEnabled && isAgentManualWaitError(err)) {
          setStatus(autoWorkflowStatus, err.message || '等待人工处理', 'warn');
        } else {
          setStatus(autoWorkflowStatus, (agentEnabled ? 'Agent 执行中断：' : '一键执行中断：') + err.message, 'err');
        }
      } finally {
        state.autoRunning = false;
        if (autoWorkflowBtn) autoWorkflowBtn.disabled = false;
        if (autoClarifyToggle) autoClarifyToggle.disabled = false;
        updateAutoClarifyVisibility();
        var coverage = extractCoverageFromCompareResult();
        updateAutoCompareActions(coverage);
        if (state.autoExpandMissing) {
          ensureAutoMissingViewVisible(true);
          state.autoExpandMissing = false;
        }
        updateAutoMissingCard();
        updateFlowStatus();
      }
    }

    async function runAutoWorkflowFromClean(options) {
      if (options === void 0) options = {};
      if (!autoRecleanStatus) return;
      if (!rawText || !rawText.value || !rawText.value.trim()) {
        setStatus(autoRecleanStatus, '请先导入原始需求', 'warn');
        switchTab('clean');
        scrollToSection('import');
        return;
      }
      if (!hasCaseSource()) {
        setStatus(autoRecleanStatus, '请先导入至少一份测试用例', 'warn');
        switchTab('clean');
        scrollToSection('cases-upload');
        return;
      }
      if (!compareResultEl || !compareResultEl.value || !compareResultEl.value.trim()) {
        setStatus(autoRecleanStatus, '尚无对比结果可用，请先完成一次对比', 'warn');
        return;
      }
      var agentEnabled = isCaseGenAgentEnabled();
      if (agentEnabled && !isAgentCoverageWaiting()) {
        setStatus(autoRecleanStatus, 'Agent 模式请在覆盖率等待阶段使用此操作', 'warn');
        if (autoWorkflowStatus) setStatus(autoWorkflowStatus, 'Agent 模式请使用一键执行启动流程', 'warn');
        return;
      }
      var autoWorkflowManager = getAutoWorkflowManager();
      if (autoWorkflowManager && typeof autoWorkflowManager.getTask === 'function') {
        var runningTask = autoWorkflowManager.getTask();
        if (runningTask && runningTask.status === 'running') {
          setStatus(autoRecleanStatus, '当前已有执行任务，请稍候', 'warn');
          return;
        }
      } else if (state.autoRunning) {
        setStatus(autoRecleanStatus, '当前已有执行任务，请稍候', 'warn');
        return;
      }
      clearAllWaitingSteps();
      clearAllFailedSteps();
      var startMessage = options.startMessage || '重新执行中（从需求清洗开始）...';
      var workflowStartMessage = options.workflowStartMessage || '正在重新执行剩余步骤，请勿关闭页面';
      var successMessage = options.successMessage || '重新执行完成';
      var workflowSuccessMessage = options.workflowSuccessMessage || '重新执行完成，可切换至“功能流程”查看详情';
      var failureMessage = options.failureMessage || '重新执行中断';
      var workflowFailureMessage = options.workflowFailureMessage || '一键执行中断';
      var startTone = options.startTone || '';
      var workflowStartTone = options.workflowStartTone || '';
      var successTone = options.successTone || 'ok';
      var workflowSuccessTone = options.workflowSuccessTone || 'ok';
      var mode = options.mode || 'reclean';
      renderAgentPanel();
      state.autoRunning = true;
      if (autoWorkflowBtn) autoWorkflowBtn.disabled = true;
      if (autoClarifyToggle) autoClarifyToggle.disabled = true;
      if (autoRecleanBtn) autoRecleanBtn.disabled = true;
      setAutoCompareStatusText('等待对比结果');
      resetAutoCompareMissingView();
      resetAutoMissingView();
      if (autoMissingToggle) autoMissingToggle.disabled = true;
      if (autoMissingCopy) autoMissingCopy.disabled = true;
      setMissingStatus('', '');
      if (autoIgnoreCoverageBtn) autoIgnoreCoverageBtn.disabled = true;
      if (autoJumpCleanViewBtn) autoJumpCleanViewBtn.disabled = true;
      if (autoFillCleanBtn) autoFillCleanBtn.disabled = true;
      setStatus(autoRecleanStatus, startMessage, startTone);
      setStatus(autoWorkflowStatus, agentEnabled ? 'Agent 正在执行用例生成流程，请勿关闭页面' : workflowStartMessage, workflowStartTone);
      var useManager = Boolean(autoWorkflowManager && typeof autoWorkflowManager.startTask === 'function');
      if (useManager) {
        var comparePayload = Object.prototype.hasOwnProperty.call(options, 'compareOverride')
          ? options.compareOverride
          : buildFilteredComparePayload();
        var suggestionPayload = options.suggestion ? options.suggestion.trim() : '';
        var context = {};
        if (comparePayload) context.compare = comparePayload;
        if (suggestionPayload) context.suggestion = suggestionPayload;
        if (mode) context.mode = mode;
        if (options.coverageAction) context.coverageAction = options.coverageAction;
        autoWorkflowManager.startTask({
          kind: agentEnabled ? 'agent' : (mode === 'supplement' ? 'supplement' : 'reclean'),
          startIndex: agentEnabled ? 0 : 1,
          stepIndex: agentEnabled ? 0 : 1,
          context: context,
          messageOptions: {
            startMessage: startMessage,
            workflowStartMessage: workflowStartMessage,
            successMessage: successMessage,
            workflowSuccessMessage: workflowSuccessMessage,
            failureMessage: failureMessage,
            workflowFailureMessage: workflowFailureMessage,
            startTone: startTone,
            workflowStartTone: workflowStartTone,
            successTone: successTone,
            workflowSuccessTone: workflowSuccessTone,
          },
          messages: buildAutoWorkflowTaskMessages(agentEnabled ? 'agent' : (mode === 'supplement' ? 'supplement' : 'reclean'), {
            startMessage: startMessage,
            workflowStartMessage: workflowStartMessage,
            successMessage: successMessage,
            workflowSuccessMessage: workflowSuccessMessage,
            failureMessage: failureMessage,
            workflowFailureMessage: workflowFailureMessage,
            startTone: startTone,
            workflowStartTone: workflowStartTone,
            successTone: successTone,
            workflowSuccessTone: workflowSuccessTone,
          }),
        }, { force: true });
        return;
      }
      try {
        var comparePayload = Object.prototype.hasOwnProperty.call(options, 'compareOverride')
          ? options.compareOverride
          : buildFilteredComparePayload();
        var suggestionPayload = options.suggestion ? options.suggestion.trim() : '';
        var context = {};
        if (comparePayload) context.compare = comparePayload;
        if (suggestionPayload) context.suggestion = suggestionPayload;
        if (mode) context.mode = mode;
        if (options.coverageAction) context.coverageAction = options.coverageAction;
        await executeAutoWorkflowSteps(agentEnabled ? 0 : 1, context);
        setStatus(autoRecleanStatus, successMessage, successTone);
        if (agentEnabled && state.caseGenAgentFlowStopNote) {
          var flowNote = state.caseGenAgentFlowStopNote;
          state.caseGenAgentFlowStopNote = '';
          setStatus(autoRecleanStatus, flowNote + '，流程已按提示结束', 'warn');
          setStatus(autoWorkflowStatus, flowNote + '，已按提示结束流程', 'warn');
        } else if (agentEnabled && state.caseGenAgentCoverageBelowFull) {
          setStatus(autoWorkflowStatus, 'Agent 已完成用例生成流程，但覆盖率未满 100%，请查看修复建议', 'warn');
        } else {
          setStatus(autoWorkflowStatus, agentEnabled ? 'Agent 已完成用例生成流程，请检查结果' : workflowSuccessMessage, workflowSuccessTone);
        }
        await notifyFeishuWorkflowSuccess();
      } catch (err) {
        console.error(err);
        if (agentEnabled && isAgentStoppedError(err)) {
          setStatus(autoRecleanStatus, err.message || 'Agent 已停止', 'warn');
          setStatus(autoWorkflowStatus, err.message || 'Agent 已停止', 'warn');
        } else if (agentEnabled && isAgentManualWaitError(err)) {
          setStatus(autoRecleanStatus, err.message || '等待人工处理', 'warn');
          setStatus(autoWorkflowStatus, err.message || '等待人工处理', 'warn');
        } else {
          setStatus(autoRecleanStatus, failureMessage + '：' + err.message, 'err');
          setStatus(autoWorkflowStatus, (agentEnabled ? 'Agent 执行中断：' : workflowFailureMessage + '：') + err.message, 'err');
        }
      } finally {
        state.autoRunning = false;
        if (autoWorkflowBtn) autoWorkflowBtn.disabled = false;
        if (autoClarifyToggle) autoClarifyToggle.disabled = false;
        updateAutoClarifyVisibility();
        syncAutoCompareStatus();
        updateAutoMissingCard();
        updateFlowStatus();
      }
    }

    async function continueAutoWorkflowAfterCoverage(options) {
      if (!autoRecleanStatus) return;
      if (!compareResultEl || !compareResultEl.value || !compareResultEl.value.trim()) {
        setStatus(autoRecleanStatus, '当前无对比结果可用，请先执行一次对比', 'warn');
        return;
      }
      var agentEnabled = isCaseGenAgentEnabled();
      if (agentEnabled && !isAgentCoverageWaiting()) {
        setStatus(autoRecleanStatus, 'Agent 模式请在覆盖率等待阶段使用此操作', 'warn');
        if (autoWorkflowStatus) setStatus(autoWorkflowStatus, 'Agent 模式请使用一键执行启动流程', 'warn');
        return;
      }
      var coverage = extractCoverageFromCompareResult();
      var limit = agentEnabled ? getAgentCoverageThreshold() : 100;
      if (coverage === null) {
        setStatus(autoRecleanStatus, '当前覆盖率无法解析，请修正后再继续', 'warn');
        return;
      }
      if (coverage >= limit) {
        setStatus(autoRecleanStatus, '覆盖率已满足要求，无需忽略继续', 'warn');
        return;
      }
      var autoWorkflowManager = getAutoWorkflowManager();
      if (autoWorkflowManager && typeof autoWorkflowManager.getTask === 'function') {
        var runningTask = autoWorkflowManager.getTask();
        if (runningTask && runningTask.status === 'running') {
          setStatus(autoRecleanStatus, '当前已有执行任务，请稍候', 'warn');
          return;
        }
      } else if (state.autoRunning) {
        setStatus(autoRecleanStatus, '当前已有执行任务，请稍候', 'warn');
        return;
      }
      clearAllWaitingSteps();
      clearAllFailedSteps();
      state.autoRunning = true;
      renderAgentPanel();
      if (autoWorkflowBtn) autoWorkflowBtn.disabled = true;
      if (autoClarifyToggle) autoClarifyToggle.disabled = true;
      if (autoRecleanBtn) autoRecleanBtn.disabled = true;
      if (autoIgnoreCoverageBtn) autoIgnoreCoverageBtn.disabled = true;
      if (autoJumpCleanViewBtn) autoJumpCleanViewBtn.disabled = true;
      if (autoFillCleanBtn) autoFillCleanBtn.disabled = true;
      resetAutoMissingView();
      if (autoMissingToggle) autoMissingToggle.disabled = true;
      if (autoMissingCopy) autoMissingCopy.disabled = true;
      setMissingStatus('', '');
      setStatus(autoRecleanStatus, agentEnabled ? '已忽略覆盖率不足，Agent 正在继续执行…' : '已忽略覆盖率不足，正在执行剩余步骤…', 'warn');
      setStatus(autoWorkflowStatus, agentEnabled ? '已忽略覆盖率，Agent 正在继续执行后续流程' : '已忽略覆盖率，正在继续执行后续流程', 'warn');
      var useManager = Boolean(autoWorkflowManager && typeof autoWorkflowManager.startTask === 'function');
      var manualAction = options && options.coverageAction ? String(options.coverageAction).trim().toLowerCase() : '';
      var agentContext = agentEnabled ? { coverageAction: manualAction || 'ignore' } : {};
      if (useManager) {
        autoWorkflowManager.startTask({
          kind: agentEnabled ? 'agent_continue' : 'continue',
          startIndex: agentEnabled ? 0 : 3,
          stepIndex: agentEnabled ? 0 : 3,
          context: agentContext,
          messages: buildAutoWorkflowTaskMessages(agentEnabled ? 'agent_continue' : 'continue'),
        }, { force: true });
        return;
      }
      try {
        await executeAutoWorkflowSteps(agentEnabled ? 0 : 3, agentContext);
        setStatus(autoRecleanStatus, '已忽略覆盖率完成剩余步骤，请检查结果', 'ok');
        setStatus(autoWorkflowStatus, agentEnabled ? 'Agent 已完成剩余步骤，覆盖率仍不足，请注意风险' : '剩余步骤执行完成，覆盖率仍不足 100%，请注意风险', 'warn');
        await notifyFeishuWorkflowSuccess();
      } catch (err) {
        console.error(err);
        if (agentEnabled && isAgentStoppedError(err)) {
          setStatus(autoRecleanStatus, err.message || 'Agent 已停止', 'warn');
          setStatus(autoWorkflowStatus, err.message || 'Agent 已停止', 'warn');
        } else if (agentEnabled && isAgentManualWaitError(err)) {
          setStatus(autoRecleanStatus, err.message || '等待人工处理', 'warn');
          setStatus(autoWorkflowStatus, err.message || '等待人工处理', 'warn');
        } else {
          setStatus(autoRecleanStatus, '忽略覆盖率继续失败：' + err.message, 'err');
          setStatus(autoWorkflowStatus, '忽略覆盖率继续失败：' + err.message, 'err');
        }
      } finally {
        state.autoRunning = false;
        if (autoWorkflowBtn) autoWorkflowBtn.disabled = false;
        if (autoClarifyToggle) autoClarifyToggle.disabled = false;
        updateAutoClarifyVisibility();
        syncAutoCompareStatus();
        updateAutoCompareActions();
        updateAutoMissingCard();
        updateFlowStatus();
      }
    }

    renderAgentPanel();
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('app-settings-loaded', function() {
        renderAgentPanel();
      });
      window.addEventListener('app-settings-updated', function(e) {
        renderAgentPanel();
        var detail = e && e.detail ? e.detail : null;
        var keys = detail && Array.isArray(detail.keys) ? detail.keys : [];
      });
    }

    return {
      notifyFeishuCoverageFailure: notifyFeishuCoverageFailure,
      notifyFeishuWorkflowSuccess: notifyFeishuWorkflowSuccess,
      notifyFeishuClarificationNeeded: notifyFeishuClarificationNeeded,
      stopAgentWorkflow: stopAgentWorkflow,
      resetAutoMissingView: resetAutoMissingView,
      refreshAutoMissingSelectionUI: refreshAutoMissingSelectionUI,
      updateAutoMissingCard: updateAutoMissingCard,
      toggleAutoMissingView: toggleAutoMissingView,
      ensureAutoMissingViewVisible: ensureAutoMissingViewVisible,
      copyAutoMissingJson: copyAutoMissingJson,
      handleMissingSelectionChange: handleMissingSelectionChange,
      handleMissingSelectAll: handleMissingSelectAll,
      smartFillMissingSuggestions: smartFillMissingSuggestions,
      setMissingStatus: setMissingStatus,
      resetAutoCompareMissingView: resetAutoCompareMissingView,
      resetAutoCompareUserInputs: resetAutoCompareUserInputs,
      renderAutoCompareMissingView: renderAutoCompareMissingView,
      toggleAutoCompareView: toggleAutoCompareView,
      buildFilteredComparePayload: buildFilteredComparePayload,
      updateAutoCompareActions: updateAutoCompareActions,
      syncAutoCompareStatus: syncAutoCompareStatus,
      buildAutoWorkflowSteps: buildAutoWorkflowSteps,
      executeAutoWorkflowSteps: executeAutoWorkflowSteps,
      enforceAutoCoverageRequirement: enforceAutoCoverageRequirement,
      runAutoWorkflow: runAutoWorkflow,
      runAutoWorkflowFromClean: runAutoWorkflowFromClean,
      continueAutoWorkflowAfterCoverage: continueAutoWorkflowAfterCoverage,
      applyAutoWorkflowTaskState: applyAutoWorkflowTaskState,
      isAutoWorkflowReady: isAutoWorkflowReady,
      renderAgentPanel: renderAgentPanel,
      markAgentPlanSkippedByFlow: markAgentPlanSkippedByFlow,
      applyAgentPromptRoutingDecision: applyAgentPromptRoutingDecision,
      applyAgentReviewDecision: applyAgentReviewDecision,
      applyAgentCoverageSelection: applyAgentCoverageSelection,
    };
  }

  window.app = window.app || {};
  window.app.autoCore = { init: init };
})();
