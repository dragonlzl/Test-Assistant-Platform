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
    var setStepWaiting = handlers.setStepWaiting || function() {};
    var clearStepWaiting = handlers.clearStepWaiting || function() {};
    var clearAllWaitingSteps = handlers.clearAllWaitingSteps || function() {};
    var updateFlowStatus = handlers.updateFlowStatus || function() {};
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
    var jumpToCleanHighlightView = handlers.jumpToCleanHighlightView || function() {};
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

    var caseAssistantChannelName = 'case-assistant:request';
    var caseAssistantTimeoutMs = 30 * 60 * 1000;

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

    function isElectronRendererEnv() {
      if (typeof window === 'undefined') return false;
      if (!window.electronAPI) return false;
      return true;
    }

    function normalizeCaseAssistantProjectRoot(value) {
      if (value === null || value === undefined) return '';
      return String(value).trim();
    }

    function isValidCaseAssistantProjectRoot(path) {
      var raw = normalizeCaseAssistantProjectRoot(path);
      if (!raw) return false;
      if (raw.indexOf('\0') !== -1) return false;
      var normalized = raw.replace(/\\/g, '/');
      var isWindowsDrive = /^[A-Za-z]:\//.test(normalized);
      var isPosix = /^\//.test(normalized);
      var isWindowsUnc = /^\\\\[^\\\/]+\\[^\\\/]+/.test(raw);
      if (!isWindowsDrive && !isPosix && !isWindowsUnc) return false;
      var cleaned = normalized.replace(/\/+$/, '');
      if (!cleaned) return false;
      var lastSegment = cleaned.split('/').pop() || '';
      if (!lastSegment || lastSegment === '.' || lastSegment === '..') return false;
      return true;
    }

    function unwrapRequirementText(rawText) {
      var text = rawText === null || rawText === undefined ? '' : String(rawText).trim();
      if (!text) return '';
      var lines = text.split(/\r?\n/);
      var filtered = [];
      for (var i = 0; i < lines.length; i += 1) {
        var line = lines[i] || '';
        var trimmed = line.trim();
        if (/^#需求标识：/.test(trimmed)) continue;
        if (/^#类型：/.test(trimmed)) continue;
        filtered.push(line);
      }
      var merged = filtered.join('\n').trim();
      if (!merged) return '';
      try {
        var parsed = JSON.parse(merged);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.prototype.hasOwnProperty.call(parsed, 'data')) {
          parsed = parsed.data;
        }
        if (typeof parsed === 'string') return parsed.trim();
        if (parsed === null || parsed === undefined) return '';
        return JSON.stringify(parsed, null, 2);
      } catch (err) {
        return merged;
      }
    }

    function buildCaseAssistantUserPrompt(projectRoot) {
      var rawRequirement = rawText && rawText.value ? unwrapRequirementText(rawText.value) : '';
      var expectedRequirement = cleanedTextEl && cleanedTextEl.value ? unwrapRequirementText(cleanedTextEl.value) : '';
      var compareResult = compareResultEl && compareResultEl.value ? unwrapRequirementText(compareResultEl.value) : '';
      if (!expectedRequirement) return '';
      var normalizedProjectRoot = normalizeCaseAssistantProjectRoot(projectRoot);
      var sections = [];
      sections.push('你是需求归并专家。请阅读 projectRoot 下代码对应的实际实现，并将“预期需求”和“实际实现需求”互补整合为一份完整需求文案。');
      sections.push('目标：为后续“测试模块拆分”提供可直接使用的完整需求输入。');
      if (normalizedProjectRoot) {
        sections.push('代码读取范围（projectRoot）：\n' + normalizedProjectRoot);
      }
      sections.push('输出要求：');
      sections.push('1. 仅输出需求文字，不要粘贴代码、不要输出文件路径。');
      sections.push('2. 将预期需求与实际实现互补：预期有但实现缺失标记为“待补齐”；实现存在但预期未写标记为“需补录到需求”。');
      sections.push('3. 覆盖功能规则、边界条件、异常分支、状态变化、数据约束、权限与前置条件。');
      sections.push('4. 最终结构包含：需求目标、功能清单、差异补充、测试关注点。');
      sections.push('5. 结果供测试拆分使用，请保证条目清晰、可执行。');
      if (rawRequirement) sections.push('【原始需求】\n' + rawRequirement);
      sections.push('【预期需求（需求清洗）】\n' + expectedRequirement);
      if (compareResult) sections.push('【对比完整性结果】\n' + compareResult);
      sections.push('请直接输出最终完整需求文案。');
      return sections.join('\n\n');
    }

    function createCaseAssistantRequestId() {
      try {
        if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
          return crypto.randomUUID();
        }
      } catch (err) {
        // ignore
      }
      return 'case-assistant-' + Date.now() + '-' + Math.random().toString(16).slice(2, 10);
    }

    function extractCaseAssistantRequirementText(data) {
      if (typeof data === 'string') return data.trim();
      if (!data || typeof data !== 'object') return '';
      var preferredKeys = ['requirement', 'requirementText', 'text', 'content', 'result', 'output'];
      for (var i = 0; i < preferredKeys.length; i += 1) {
        var key = preferredKeys[i];
        var value = data[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
      }
      try {
        return JSON.stringify(data, null, 2);
      } catch (err) {
        return '';
      }
    }

    async function invokeCaseAssistantForSplit(context) {
      if (!context || typeof context !== 'object') {
        console.info('[CaseAssistant] 跳过调用：上下文对象无效');
        return;
      }
      if (!isElectronRendererEnv()) {
        console.info('[CaseAssistant] 跳过调用：当前非 Electron 渲染进程或 window.electronAPI.invokeChannel 不可用');
        return;
      }
      if (context.caseAssistantInvoked === true && context.cleanedOverride) {
        console.info('[CaseAssistant] 跳过调用：当前流程上下文已存在可用结果，避免重复调用');
        return;
      }
      var projectRoot = state && state.settings ? normalizeCaseAssistantProjectRoot(state.settings.caseAssistantProjectRoot) : '';
      if (!isValidCaseAssistantProjectRoot(projectRoot)) {
        console.info('[CaseAssistant] 跳过调用：项目路径无效或未配置', projectRoot);
        return;
      }
      var userPrompt = buildCaseAssistantUserPrompt(projectRoot);
      if (!userPrompt) {
        console.info('[CaseAssistant] 跳过调用：未生成有效 userPrompt（通常是清洗结果为空）');
        return;
      }
      var requestId = createCaseAssistantRequestId();
      var payload = {
        projectRoot: projectRoot,
        userPrompt: userPrompt,
        requestId: requestId,
        timestamp: Date.now(),
        streamOutput: false,
        timeoutMs: caseAssistantTimeoutMs,
      };
      context.caseAssistantInvoked = true;
      context.caseAssistantRequestId = requestId;
      console.info('[CaseAssistant] 开始调用接口 case-assistant:request', {
        requestId: requestId,
        projectRoot: projectRoot,
        promptLength: userPrompt.length,
      });
      try {
        var response = await window.electronAPI.invokeChannel(caseAssistantChannelName, payload);
        if (!response || response.status !== true) {
          console.warn('[CaseAssistant] 调用返回失败状态', response);
          return;
        }
        var mergedRequirement = extractCaseAssistantRequirementText(response.data);
        if (!mergedRequirement) {
          console.warn('[CaseAssistant] 调用成功但未提取到有效需求文案', response && response.data);
          return;
        }
        context.cleanedOverride = mergedRequirement;
        if (state && typeof state === 'object') {
          state.autoCaseAssistantRequestId = requestId;
          state.autoCaseAssistantMergedRequirement = mergedRequirement;
        }
        console.info('[CaseAssistant] 调用成功，已写入 cleanedOverride', {
          requestId: requestId,
          mergedLength: mergedRequirement.length,
        });
      } catch (err) {
        console.warn('Case Assistant 调用失败，已跳过并继续后续流程', err);
      }
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
      if (autoCompareToggleBtn) autoCompareToggleBtn.disabled = Boolean(state.autoRunning);
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
      var canRetry = Boolean(!state.autoRunning && coverage !== null && coverage < 100);
      if (autoRecleanBtn) autoRecleanBtn.disabled = !canRetry;
      if (autoIgnoreCoverageBtn) autoIgnoreCoverageBtn.disabled = !canRetry;
      if (autoJumpCleanViewBtn) autoJumpCleanViewBtn.disabled = !(coverage !== null && hasClean);
      var selected = getSelectedAutoCompareMissing();
      var suggestion = state.autoCompareSuggestion ? state.autoCompareSuggestion.trim() : '';
      if (autoFillCleanBtn) autoFillCleanBtn.disabled = Boolean(state.autoRunning) || !(selected.length || suggestion);
      if (autoCompareToggleBtn) {
        var hasMissing = state.autoCompareMissingList && state.autoCompareMissingList.length;
        autoCompareToggleBtn.disabled = Boolean(state.autoRunning) || !hasMissing;
        if (!hasMissing) setAutoCompareToggleLabel(false);
      }
    }

    function syncAutoCompareStatus(shouldOpenDrawer) {
      if (shouldOpenDrawer === void 0) shouldOpenDrawer = true;
      var coverage = extractCoverageFromCompareResult();
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
      if (kind === 'reclean' || kind === 'supplement') {
        assignMessage('recleanStart', opts.startMessage || '重新执行中（从需求清洗开始）...', opts.startTone || '');
        assignMessage('workflowStart', opts.workflowStartMessage || '正在重新执行剩余步骤，请勿关闭页面', opts.workflowStartTone || '');
        assignMessage('recleanSuccess', opts.successMessage || '重新执行完成', opts.successTone || 'ok');
        assignMessage('workflowSuccess', opts.workflowSuccessMessage || '重新执行完成，可切换至“功能流程”查看详情', opts.workflowSuccessTone || 'ok');
        assignMessage('recleanFailure', opts.failureMessage || '重新执行中断', opts.failureTone || 'err');
        assignMessage('workflowFailure', opts.workflowFailureMessage || '一键执行中断', opts.workflowFailureTone || 'err');
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
      } else if (task.status === 'done') {
        var doneWorkflow = resolveMessage('workflowSuccess', '一键执行完成，可切换至“功能流程”查看详情', 'ok');
        if (autoWorkflowStatus) setStatus(autoWorkflowStatus, doneWorkflow.text, doneWorkflow.tone);
        if (kind !== 'full') {
          var doneReclean = resolveMessage('recleanSuccess', '', 'ok');
          if (autoRecleanStatus) setStatus(autoRecleanStatus, doneReclean.text, doneReclean.tone);
        }
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
      return [
        {
          key: 'review',
          label: '需求评审',
          run: function() { return reviewRequirements(); },
          validate: function() { return Boolean(reviewResultEl && reviewResultEl.value && reviewResultEl.value.trim().length > 0); },
          after: function() { return handleAutoClarifyAfterReview(); },
        },
        { key: 'clean', label: '需求清洗', run: function(ctx) { return runCleaning(ctx); }, validate: function() { return Boolean(cleanedTextEl && cleanedTextEl.value && cleanedTextEl.value.trim().length > 0); } },
        {
          key: 'compare',
          label: '对比完整性',
          run: function() { return compareCoverage(); },
          validate: function() { return Boolean(compareResultEl && compareResultEl.value && compareResultEl.value.trim().length > 0); },
          after: function(ctx) { return handleAutoCompareAfter(ctx); },
        },
        { key: 'split', label: '测试模块拆分', run: function(ctx) { return splitModules(ctx); }, validate: function() { return Boolean(splitResultEl && splitResultEl.value && splitResultEl.value.trim().length > 0); } },
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
            await step.after(context);
          }
        } catch (err) {
          if (step && step.key) setStepFailed(step.key, err && err.message ? err.message : '执行失败');
          updateFlowStatus();
          throw err;
        }
      }
    }

    async function enforceAutoCoverageRequirement() {
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
      if (coverage < 100) {
        setStatus(autoWorkflowStatus, '覆盖率仅 ' + coverage + '% ，自动流程已停止', 'warn');
        if (autoRecleanBtn) autoRecleanBtn.disabled = false;
        if (autoIgnoreCoverageBtn) autoIgnoreCoverageBtn.disabled = false;
        if (autoRecleanStatus) setStatus(autoRecleanStatus, '覆盖率不足，点击“重新清洗并继续”以重跑流程', 'warn');
        setStepWaiting('compare', '覆盖率不足，等待确认');
        updateFlowStatus();
        await notifyFeishuCoverageFailure();
        throw new Error('对比覆盖率不足100%');
      }
      if (autoRecleanBtn) autoRecleanBtn.disabled = true;
      if (autoIgnoreCoverageBtn) autoIgnoreCoverageBtn.disabled = true;
      if (autoJumpCleanViewBtn) autoJumpCleanViewBtn.disabled = true;
      if (autoRecleanStatus) setStatus(autoRecleanStatus, '', '');
    }

    async function handleAutoCompareAfter(context) {
      await enforceAutoCoverageRequirement();
      await invokeCaseAssistantForSplit(context || {});
    }

    async function handleAutoClarifyAfterReview() {
      if (!state.autoRequireClarifications) return;
      switchTab('auto');
      if (autoClarifySection) autoClarifySection.classList.remove('hidden');
      renderAutoClarifyView();
      setStepWaiting('review', '等待澄清确认');
      updateFlowStatus();
      try {
        await notifyFeishuClarificationNeeded();
        await waitForAutoClarification();
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
      clearAllWaitingSteps();
      clearAllFailedSteps();
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
      setStatus(autoWorkflowStatus, '正在执行完整工作流，请勿关闭页面', '');
      if (autoWorkflowManager && typeof autoWorkflowManager.startTask === 'function') {
        autoWorkflowManager.startTask({
          kind: 'full',
          startIndex: 0,
          stepIndex: 0,
          expandMissing: true,
          messages: buildAutoWorkflowTaskMessages('full'),
        }, { force: true });
        return;
      }
      try {
        await executeAutoWorkflowSteps(0);
        setStatus(autoWorkflowStatus, '一键执行完成，可切换至“功能流程”查看详情', 'ok');
        state.autoExpandMissing = true;
        await notifyFeishuWorkflowSuccess();
      } catch (err) {
        console.error(err);
        setStatus(autoWorkflowStatus, '一键执行中断：' + err.message, 'err');
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
      setStatus(autoWorkflowStatus, workflowStartMessage, workflowStartTone);
      if (autoWorkflowManager && typeof autoWorkflowManager.startTask === 'function') {
        var comparePayload = Object.prototype.hasOwnProperty.call(options, 'compareOverride')
          ? options.compareOverride
          : buildFilteredComparePayload();
        var suggestionPayload = options.suggestion ? options.suggestion.trim() : '';
        var context = {};
        if (comparePayload) context.compare = comparePayload;
        if (suggestionPayload) context.suggestion = suggestionPayload;
        if (mode) context.mode = mode;
        autoWorkflowManager.startTask({
          kind: mode === 'supplement' ? 'supplement' : 'reclean',
          startIndex: 1,
          stepIndex: 1,
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
          messages: buildAutoWorkflowTaskMessages(mode === 'supplement' ? 'supplement' : 'reclean', {
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
        await executeAutoWorkflowSteps(1, context);
        setStatus(autoRecleanStatus, successMessage, successTone);
        setStatus(autoWorkflowStatus, workflowSuccessMessage, workflowSuccessTone);
        await notifyFeishuWorkflowSuccess();
      } catch (err) {
        console.error(err);
        setStatus(autoRecleanStatus, failureMessage + '：' + err.message, 'err');
        setStatus(autoWorkflowStatus, workflowFailureMessage + '：' + err.message, 'err');
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

    async function continueAutoWorkflowAfterCoverage() {
      if (!autoRecleanStatus) return;
      if (!compareResultEl || !compareResultEl.value || !compareResultEl.value.trim()) {
        setStatus(autoRecleanStatus, '当前无对比结果可用，请先执行一次对比', 'warn');
        return;
      }
      var coverage = extractCoverageFromCompareResult();
      if (coverage === null || coverage >= 100) {
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
      setStatus(autoRecleanStatus, '已忽略覆盖率不足，正在执行剩余步骤…', 'warn');
      setStatus(autoWorkflowStatus, '已忽略覆盖率，正在继续执行后续流程', 'warn');
      var continueContext = {};
      await invokeCaseAssistantForSplit(continueContext);
      if (autoWorkflowManager && typeof autoWorkflowManager.startTask === 'function') {
        autoWorkflowManager.startTask({
          kind: 'continue',
          startIndex: 3,
          stepIndex: 3,
          context: continueContext,
          messages: buildAutoWorkflowTaskMessages('continue'),
        }, { force: true });
        return;
      }
      try {
        await executeAutoWorkflowSteps(3, continueContext);
        setStatus(autoRecleanStatus, '已忽略覆盖率完成剩余步骤，请检查结果', 'ok');
        setStatus(autoWorkflowStatus, '剩余步骤执行完成，覆盖率仍不足 100%，请注意风险', 'warn');
        await notifyFeishuWorkflowSuccess();
      } catch (err) {
        console.error(err);
        setStatus(autoRecleanStatus, '忽略覆盖率继续失败：' + err.message, 'err');
        setStatus(autoWorkflowStatus, '忽略覆盖率继续失败：' + err.message, 'err');
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

    return {
      notifyFeishuCoverageFailure: notifyFeishuCoverageFailure,
      notifyFeishuWorkflowSuccess: notifyFeishuWorkflowSuccess,
      notifyFeishuClarificationNeeded: notifyFeishuClarificationNeeded,
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
      invokeCaseAssistantForSplit: invokeCaseAssistantForSplit,
      runAutoWorkflow: runAutoWorkflow,
      runAutoWorkflowFromClean: runAutoWorkflowFromClean,
      continueAutoWorkflowAfterCoverage: continueAutoWorkflowAfterCoverage,
      applyAutoWorkflowTaskState: applyAutoWorkflowTaskState,
      isAutoWorkflowReady: isAutoWorkflowReady,
    };
  }

  window.app = window.app || {};
  window.app.autoCore = { init: init };
})();
