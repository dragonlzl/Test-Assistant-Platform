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
    var autoMissingDrawerTitle = pickEl(dom.autoMissingDrawerTitle, 'autoMissingDrawerTitle');
    var autoMissingDrawer = null;
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
    var autoCompareMissingToggle = pickEl(dom.autoCompareMissingToggle, 'autoCompareMissingToggle');
    var autoCompareDrawerTitle = pickEl(dom.autoCompareDrawerTitle, 'autoCompareDrawerTitle');
    var autoCompareDrawer = null;
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

    if (!state.autoCompareSelections) state.autoCompareSelections = new Set();
    if (!state.autoCompareMissingList) state.autoCompareMissingList = [];
    if (!Object.prototype.hasOwnProperty.call(state, 'autoCompareSelectionTouched')) state.autoCompareSelectionTouched = false;

    function getRequirementDisplayName() {
      return getRequirementLabel(true);
    }

    function setMissingStatus(text, type) {
      if (type === void 0) type = '';
      if (missingViewStatus) setStatus(missingViewStatus, text, type);
      if (autoMissingStatus) setStatus(autoMissingStatus, text, type);
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

    function isDrawerOpen(drawer) {
      return Boolean(drawer && drawer.element && drawer.element.classList && drawer.element.classList.contains('open'));
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
          }
          if (autoMissingToggle) autoMissingToggle.textContent = '缺失模块视图';
          setMissingStatus('', '');
        },
      });
      return autoMissingDrawer;
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
          }
          if (autoCompareMissingToggle) autoCompareMissingToggle.textContent = '覆盖缺失列表';
        },
      });
      return autoCompareDrawer;
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
      if (!autoMissingView) return;
      autoMissingView.innerHTML = '';
      autoMissingView.classList.add('hidden');
      autoMissingView.classList.remove('visible');
      if (isDrawerOpen(autoMissingDrawer)) autoMissingDrawer.close();
      if (autoMissingToggle) autoMissingToggle.textContent = '缺失模块视图';
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
      if (!hasData) {
        resetAutoMissingView();
        setMissingStatus('', '');
        return;
      }
      if (autoMissingToggle) {
        autoMissingToggle.textContent = isDrawerOpen(autoMissingDrawer) ? '收起缺失视图' : '缺失模块视图';
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
      var open = isDrawerOpen(drawer);
      if (open) {
        drawer.close();
        return;
      }
      autoMissingView.innerHTML = renderAutoMissingTable();
      autoMissingView.classList.remove('hidden');
      autoMissingView.classList.add('visible');
      if (autoMissingDrawerTitle) {
        autoMissingDrawerTitle.textContent = '缺失模块视图（' + state.missingRowCache.length + '）';
      }
      autoMissingToggle.textContent = '收起缺失视图';
      refreshAutoMissingSelectionUI();
      drawer.open();
    }

    function ensureAutoMissingViewVisible(scrollIntoCenter) {
      if (scrollIntoCenter === void 0) scrollIntoCenter = false;
      if (!autoMissingView || !autoMissingToggle || autoMissingToggle.disabled) return;
      if (!autoMissingView.classList.contains('visible')) {
        toggleAutoMissingView();
      }
      if (scrollIntoCenter) {
        var section = (dom.autoMissingSectionSelector && document.querySelector(dom.autoMissingSectionSelector)) || (autoMissingView.closest && autoMissingView.closest('.card'));
        if (section) scrollElementIntoView(section, 'smooth', 160);
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
    }

    function handleMissingSelectAll(checked) {
      state.missingSelections.clear();
      if (checked) {
        state.missingRowCache.forEach(function(_, idx) { state.missingSelections.add(idx); });
      }
      refreshAutoMissingSelectionUI();
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
      switchTab('casesgen');
    }

    function resetAutoCompareMissingView() {
      if (!autoCompareMissing) return;
      autoCompareMissing.innerHTML = '';
      autoCompareMissing.classList.add('hidden');
      autoCompareMissing.classList.remove('visible');
      if (isDrawerOpen(autoCompareDrawer)) autoCompareDrawer.close();
      if (autoCompareMissingToggle) autoCompareMissingToggle.textContent = '覆盖缺失列表';
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

    function renderAutoCompareMissingView(list, coverage, preserveSelection) {
      if (preserveSelection === void 0) preserveSelection = false;
      if (coverage === void 0) coverage = extractCoverageFromCompareResult();
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
      if (autoCompareDrawerTitle) autoCompareDrawerTitle.textContent = '覆盖缺失列表（' + list.length + '）';
      if (autoCompareMissingToggle) autoCompareMissingToggle.textContent = '收起缺失列表';
      var drawer = ensureAutoCompareDrawer();
      if (drawer) drawer.open();
      updateAutoCompareActions(coverage);
    }

    function toggleAutoCompareMissingView() {
      if (!autoCompareMissingToggle || autoCompareMissingToggle.disabled) return;
      if (!state.autoCompareMissingList || !state.autoCompareMissingList.length) return;
      var drawer = ensureAutoCompareDrawer();
      if (!drawer) return;
      if (isDrawerOpen(drawer)) {
        drawer.close();
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
      var hasMissing = Array.isArray(state.autoCompareMissingList) && state.autoCompareMissingList.length && typeof coverage === 'number' && coverage < 100;
      if (autoCompareMissingToggle) {
        autoCompareMissingToggle.disabled = !hasMissing || state.autoRunning;
        autoCompareMissingToggle.textContent = hasMissing && isDrawerOpen(autoCompareDrawer) ? '收起缺失列表' : '覆盖缺失列表';
      }
    }

    function syncAutoCompareStatus() {
      var coverage = extractCoverageFromCompareResult();
      var data = extractCompareResultData();
      var missing = data && Array.isArray(data.missing) ? data.missing : [];
      if (autoCompareStatus) {
        autoCompareStatus.textContent = coverage === null ? '覆盖率：--' : '覆盖率：' + coverage + '%';
      }
      updateAutoCompareActions(coverage);
      if (autoRecleanStatus && !(coverage !== null && coverage < 100)) setStatus(autoRecleanStatus, '', '');
      if (!(coverage !== null && coverage < 100) && autoWorkflowStatus) setStatus(autoWorkflowStatus, '', '');
      renderAutoCompareMissingView(missing, coverage);
      return coverage;
    }

    function buildAutoWorkflowSteps() {
      return [
        {
          label: '需求评审',
          run: function() { return reviewRequirements(); },
          validate: function() { return Boolean(reviewResultEl && reviewResultEl.value && reviewResultEl.value.trim().length > 0); },
          after: function() { return handleAutoClarifyAfterReview(); },
        },
        { label: '需求清洗', run: function(ctx) { return runCleaning(ctx); }, validate: function() { return Boolean(cleanedTextEl && cleanedTextEl.value && cleanedTextEl.value.trim().length > 0); } },
        { label: '对比完整性', run: function() { return compareCoverage(); }, validate: function() { return Boolean(compareResultEl && compareResultEl.value && compareResultEl.value.trim().length > 0); }, after: function() { return enforceAutoCoverageRequirement(); } },
        { label: '测试模块拆分', run: function() { return splitModules(); }, validate: function() { return Boolean(splitResultEl && splitResultEl.value && splitResultEl.value.trim().length > 0); } },
        { label: '覆盖对比', run: function() { return compareCasesCoverage(); }, validate: function() { return Boolean(casesCompareResultEl && casesCompareResultEl.value && casesCompareResultEl.value.trim().length > 0); } },
      ];
    }

    async function executeAutoWorkflowSteps(startIndex, context) {
      if (startIndex === void 0) startIndex = 0;
      if (!context) context = {};
      var steps = buildAutoWorkflowSteps();
      for (var i = startIndex; i < steps.length; i += 1) {
        var step = steps[i];
        await step.run(context);
        if (!step.validate()) {
          throw new Error(step.label + '未产生有效输出，请检查模型配置或稍后重试');
        }
        if (step.after) {
          await step.after();
        }
      }
    }

    async function enforceAutoCoverageRequirement() {
      var coverage = syncAutoCompareStatus();
      if (coverage === null) {
        setStatus(autoWorkflowStatus, '无法解析对比完整性结果，自动流程已暂停', 'warn');
        if (autoRecleanBtn) autoRecleanBtn.disabled = false;
        if (autoIgnoreCoverageBtn) autoIgnoreCoverageBtn.disabled = true;
        if (autoRecleanStatus) setStatus(autoRecleanStatus, '请修正并重新清洗', 'warn');
        throw new Error('未解析到对比覆盖率');
      }
      if (coverage < 100) {
        setStatus(autoWorkflowStatus, '覆盖率仅 ' + coverage + '% ，自动流程已停止', 'warn');
        if (autoRecleanBtn) autoRecleanBtn.disabled = false;
        if (autoIgnoreCoverageBtn) autoIgnoreCoverageBtn.disabled = false;
        if (autoRecleanStatus) setStatus(autoRecleanStatus, '覆盖率不足，点击“重新清洗并继续”以重跑流程', 'warn');
        await notifyFeishuCoverageFailure();
        throw new Error('对比覆盖率不足100%');
      }
      if (autoRecleanBtn) autoRecleanBtn.disabled = true;
      if (autoIgnoreCoverageBtn) autoIgnoreCoverageBtn.disabled = true;
      if (autoJumpCleanViewBtn) autoJumpCleanViewBtn.disabled = true;
      if (autoRecleanStatus) setStatus(autoRecleanStatus, '', '');
    }

    async function handleAutoClarifyAfterReview() {
      if (!state.autoRequireClarifications) return;
      switchTab('auto');
      if (autoClarifySection) autoClarifySection.classList.remove('hidden');
      renderAutoClarifyView();
      openAutoClarifyPanel();
      await notifyFeishuClarificationNeeded();
      await waitForAutoClarification();
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
      if (state.autoRunning) {
        setStatus(autoWorkflowStatus, '正在执行，请稍候……', 'warn');
        return;
      }
      state.autoRunning = true;
      if (autoWorkflowBtn) autoWorkflowBtn.disabled = true;
      if (autoClarifyToggle) autoClarifyToggle.disabled = true;
      if (autoCompareStatus) autoCompareStatus.textContent = '等待对比结果';
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
      try {
        await executeAutoWorkflowSteps(0);
        setStatus(autoWorkflowStatus, 'AI 一键需求&用例评审完成，可切换至“功能工作流”查看详情', 'ok');
        state.autoExpandMissing = true;
        await notifyFeishuWorkflowSuccess();
      } catch (err) {
        console.error(err);
        setStatus(autoWorkflowStatus, 'AI 一键需求&用例评审中断：' + err.message, 'err');
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
      if (state.autoRunning) {
        setStatus(autoRecleanStatus, '当前已有执行任务，请稍候', 'warn');
        return;
      }
      var startMessage = options.startMessage || '重新执行中（从需求清洗开始）...';
      var workflowStartMessage = options.workflowStartMessage || '正在重新执行剩余步骤，请勿关闭页面';
      var successMessage = options.successMessage || '重新执行完成';
      var workflowSuccessMessage = options.workflowSuccessMessage || '重新执行完成，可切换至“功能工作流”查看详情';
      var failureMessage = options.failureMessage || '重新执行中断';
      var workflowFailureMessage = options.workflowFailureMessage || 'AI 一键需求&用例评审中断';
      var startTone = options.startTone || '';
      var workflowStartTone = options.workflowStartTone || '';
      var successTone = options.successTone || 'ok';
      var workflowSuccessTone = options.workflowSuccessTone || 'ok';
      var mode = options.mode || 'reclean';
      state.autoRunning = true;
      if (autoWorkflowBtn) autoWorkflowBtn.disabled = true;
      if (autoClarifyToggle) autoClarifyToggle.disabled = true;
      if (autoRecleanBtn) autoRecleanBtn.disabled = true;
      if (autoCompareStatus) autoCompareStatus.textContent = '等待对比结果';
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
      if (state.autoRunning) {
        setStatus(autoRecleanStatus, '当前已有执行任务，请稍候', 'warn');
        return;
      }
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
      try {
        await executeAutoWorkflowSteps(3);
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
      toggleAutoCompareMissingView: toggleAutoCompareMissingView,
      buildFilteredComparePayload: buildFilteredComparePayload,
      updateAutoCompareActions: updateAutoCompareActions,
      syncAutoCompareStatus: syncAutoCompareStatus,
      buildAutoWorkflowSteps: buildAutoWorkflowSteps,
      executeAutoWorkflowSteps: executeAutoWorkflowSteps,
      enforceAutoCoverageRequirement: enforceAutoCoverageRequirement,
      runAutoWorkflow: runAutoWorkflow,
      runAutoWorkflowFromClean: runAutoWorkflowFromClean,
      continueAutoWorkflowAfterCoverage: continueAutoWorkflowAfterCoverage,
    };
  }

  window.app = window.app || {};
  window.app.autoCore = { init: init };
})();
