(function() {
  function init(ctx) {
    if (!ctx) return {};
    var state = ctx.state || {};
    var defaultPrompts = ctx.defaultPrompts || {};
    var setStatus = ctx.setStatus || function() {};
    var handlers = ctx.handlers || {};
    var dom = ctx.dom || {};
    var escapeHtml = ctx.escapeHtml || function(text) {
      var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
      var raw = text === undefined || text === null ? '' : text.toString();
      return raw.replace(/[&<>"]/g, function(ch) { return map[ch] || ''; });
    };
    var escapeHtmlPreserve = ctx.escapeHtmlPreserve || escapeHtml;

    var ensureRequirementLabel = handlers.ensureRequirementLabel || function() { return ''; };
    var getAssignedModel = handlers.getAssignedModel || function() { throw new Error('未配置模型'); };
    var getReasoningForType = handlers.getReasoningForType || function() { return ''; };
    var callModelWithConfig = handlers.callModelWithConfig || function() { return Promise.resolve(''); };
    var updateModelTiming = handlers.updateModelTiming || function() {};
    var wrapTextWithRequirement = handlers.wrapTextWithRequirement || function(text) { return text; };
    var formatJsonOrText = handlers.formatJsonOrText || function(text) { return text; };
    var stripCodeFence = handlers.stripCodeFence || function(text) { return text; };
    var unwrapRequirementPayload = handlers.unwrapRequirementPayload || function(text) { return { payload: text }; };
    var extractRequirementLabelFromText = handlers.extractRequirementLabelFromText || function() { return ''; };
    var setRequirementLabel = handlers.setRequirementLabel || function() {};
    var promptRequirementLabel = handlers.promptRequirementLabel || function() { return ''; };
    var stripRequirementHeader = handlers.stripRequirementHeader || function(text) { return text; };
    var isCoveragePayload = handlers.isCoveragePayload || function() { return false; };
    var downloadText = handlers.downloadText || function() {};
    var getSafeRequirementSlug = handlers.getSafeRequirementSlug || function() { return 'requirement'; };
    var updateFlowStatus = handlers.updateFlowStatus || function() {};
    var setStepInProgress = handlers.setStepInProgress || function() {};
    var clearStepInProgress = handlers.clearStepInProgress || function() {};

    var rawText = dom.rawText;
    var reviewStatus = dom.reviewStatus;
    var reviewResultEl = dom.reviewResultEl;
    var reviewViewContainer = dom.reviewViewContainer;
    var toggleReviewViewBtn = dom.toggleReviewViewBtn;
    var confirmClarificationsBtn = dom.confirmClarificationsBtn;
    var runReviewBtn = dom.runReviewBtn;
    var reviewTimingEl = dom.reviewTimingEl;
    var autoClarifyContainer = dom.autoClarifyContainer;
    var autoClarifyToggle = dom.autoClarifyToggle;
    var autoClarifyToggleBtn = dom.autoClarifyToggleBtn;
    var autoClarifyConfirmBtn = dom.autoClarifyConfirmBtn;
    var autoClarifySection = dom.autoClarifySection;
    var autoClarifyStatus = dom.autoClarifyStatus;

    if (!Array.isArray(state.reviewRows)) state.reviewRows = [];
    if (!(state.reviewClarifications instanceof Map)) state.reviewClarifications = new Map();
    if (!(state.reviewSelections instanceof Set)) state.reviewSelections = new Set();
    if (!(state.reviewExpanded instanceof Set)) state.reviewExpanded = new Set();

    function looksLikeCoverageSummary(data) {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
      var hasCoverage = Object.prototype.hasOwnProperty.call(data, 'coverage');
      var hasMissing = Object.prototype.hasOwnProperty.call(data, 'missing');
      var hasExtra = Object.prototype.hasOwnProperty.call(data, 'extra');
      if (hasCoverage && (hasMissing || hasExtra)) return true;
      var nestedKeys = ['result', 'summary', 'data', 'payload'];
      for (var i = 0; i < nestedKeys.length; i += 1) {
        var nested = data[nestedKeys[i]];
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
          if (looksLikeCoverageSummary(nested)) return true;
        }
      }
      return false;
    }

    function updateAutoClarifyVisibility(forceOpen) {
      if (forceOpen === void 0) forceOpen = false;
      var enabled = Boolean(autoClarifyToggle && autoClarifyToggle.checked);
      state.autoRequireClarifications = enabled;
      if (autoClarifySection) {
        var shouldShow = enabled && state.activeTab === 'auto';
        autoClarifySection.classList.toggle('hidden', !shouldShow);
      }
      if (!enabled) {
        if (autoClarifyContainer) {
          autoClarifyContainer.classList.add('hidden');
          autoClarifyContainer.innerHTML = '<p class="hint" style="padding:12px;">未启用需求澄清</p>';
        }
        if (autoClarifyConfirmBtn) autoClarifyConfirmBtn.disabled = true;
        if (autoClarifyToggleBtn) {
          autoClarifyToggleBtn.disabled = true;
          autoClarifyToggleBtn.textContent = '展开澄清视图';
        }
        setStatus(autoClarifyStatus, '', '');
        if (state.autoClarifyResolver) {
          state.autoClarifyResolver(true);
          state.autoClarifyResolver = null;
        }
      } else {
        if (autoClarifyToggleBtn) {
          autoClarifyToggleBtn.disabled = false;
          autoClarifyToggleBtn.textContent = autoClarifyContainer && !autoClarifyContainer.classList.contains('hidden')
            ? '收起澄清视图'
            : '展开澄清视图';
        }
        renderAutoClarifyView();
        if (forceOpen) openAutoClarifyPanel();
      }
    }

    function renderAutoClarifyView() {
      if (!autoClarifyContainer) return;
      if (!state.autoRequireClarifications) {
        autoClarifyContainer.innerHTML = '<p class="hint" style="padding:12px;">未启用需求澄清</p>';
        autoClarifyContainer.classList.add('hidden');
        autoClarifyContainer.classList.remove('visible');
        if (autoClarifyConfirmBtn) autoClarifyConfirmBtn.disabled = true;
        if (autoClarifyToggleBtn) autoClarifyToggleBtn.textContent = '展开澄清视图';
        return;
      }
      if (!state.reviewRows.length) {
        autoClarifyContainer.innerHTML = '<p class="hint" style="padding:12px;">暂无评审结果，请先运行需求评审</p>';
        autoClarifyContainer.classList.remove('hidden');
        autoClarifyContainer.classList.add('visible');
        if (autoClarifyToggleBtn) autoClarifyToggleBtn.textContent = '收起澄清视图';
        if (autoClarifyConfirmBtn) autoClarifyConfirmBtn.disabled = true;
        return;
      }
      autoClarifyContainer.innerHTML = renderReviewView();
      autoClarifyContainer.classList.remove('hidden');
      autoClarifyContainer.classList.add('visible');
      if (autoClarifyToggleBtn) autoClarifyToggleBtn.textContent = '收起澄清视图';
      if (autoClarifyConfirmBtn) autoClarifyConfirmBtn.disabled = false;
    }

    function waitForAutoClarification() {
      if (!state.autoRequireClarifications) return Promise.resolve(true);
      if (!state.reviewRows.length) {
        return Promise.reject(new Error('暂无可澄清的数据，请先完成需求评审'));
      }
      renderAutoClarifyView();
      openAutoClarifyPanel();
      return new Promise(function(resolve) {
        state.autoClarifyResolver = function(value) {
          if (value === void 0) value = true;
          state.autoClarifyResolver = null;
          resolve(value);
        };
        setStatus(autoClarifyStatus, '请补充澄清结果并点击“确认澄清”继续', 'warn');
      });
    }

    function handleAutoClarifyConfirm() {
      if (!state.reviewRows.length) {
        setStatus(autoClarifyStatus, '暂无评审结果可供澄清', 'warn');
        return;
      }
      confirmClarifications();
      setStatus(autoClarifyStatus, '澄清结果已确认，继续执行后续流程', 'ok');
      if (state.autoClarifyResolver) {
        var resolver = state.autoClarifyResolver;
        state.autoClarifyResolver = null;
        resolver(true);
      }
    }

    function parseReviewList(text) {
      var result = unwrapRequirementPayload(text || '');
      var raw = typeof result.payload === 'string' ? result.payload : result.payload && typeof result.payload === 'object' ? result.payload : '';
      if (!raw) {
        if (Array.isArray(result.payload)) return result.payload;
        return [];
      }
      try {
        var data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.data)) return data.data;
      } catch (err) {
        console.warn('需求评审 JSON 解析失败', err);
      }
      return [];
    }

    function normalizeReviewText(value) {
      var base = value === undefined || value === null ? '' : value;
      var str = base.toString().trim();
      if (!str) return '';
      if (/^(undefined|null)$/i.test(str)) return '';
      return str;
    }

    function stringifyReviewField(value) {
      if (Array.isArray(value)) {
        return value
          .map(function(v) { return normalizeReviewText(v); })
          .filter(Boolean)
          .join('；');
      }
      if (value && typeof value === 'object') {
        var text = Object.values(value)
          .map(function(v) { return normalizeReviewText(v); })
          .filter(Boolean)
          .join('；');
        return text || '';
      }
      return normalizeReviewText(value);
    }

    function extractReviewField(item, patterns) {
      if (!item || typeof item !== 'object') return '';
      for (var i = 0; i < Object.entries(item).length; i += 1) {
        var pair = Object.entries(item)[i];
        var key = pair[0];
        var value = pair[1];
        for (var j = 0; j < patterns.length; j += 1) {
          var pattern = patterns[j];
          if (pattern.test(key)) {
            var text = stringifyReviewField(value);
            if (text) return text;
          }
        }
      }
      return '';
    }

    function buildReviewRows(list) {
      return list.map(function(item, idx) {
        var clarification = extractReviewField(item, [/澄清/]);
        return {
          index: idx,
          source: item,
          category: normalizeReviewText(extractReviewField(item, [/类别|分类/])),
          point: normalizeReviewText(extractReviewField(item, [/不明确的需求点/])),
          reason: normalizeReviewText(extractReviewField(item, [/不明确原因/])),
          branch: normalizeReviewText(extractReviewField(item, [/分支/, /边界/])),
          clarification: normalizeReviewText(clarification),
        };
      });
    }

    function ensureReviewSelectionSet() {
      if (!(state.reviewSelections instanceof Set)) {
        state.reviewSelections = new Set();
      }
      return state.reviewSelections;
    }

    function ensureReviewExpandedSet() {
      if (!(state.reviewExpanded instanceof Set)) {
        state.reviewExpanded = new Set();
      }
      return state.reviewExpanded;
    }

    function renderReviewView() {
      if (!state.reviewRows.length) {
        return '<p class="hint" style="padding:12px;">暂无评审数据，请先执行需求评审</p>';
      }
      var selection = ensureReviewSelectionSet();
      var openSet = ensureReviewExpandedSet();
      var total = state.reviewRows.length;
      var selectAllChecked = Boolean(total) && selection.size === total;
      var body = state.reviewRows.map(function(row) {
        var storedClar = state.reviewClarifications.get(row.index);
        var fallbackClar = row.clarification;
        var value = storedClar !== undefined && storedClar !== null
          ? storedClar
          : (fallbackClar !== undefined && fallbackClar !== null ? fallbackClar : '');
        var normalizedValue = normalizeReviewText(value);
        var hasValue = Boolean(normalizedValue);
        var isOpen = openSet.has(row.index);
        var btnClass = ['remark-toggle'];
        if (hasValue) btnClass.push('filled');
        if (isOpen) btnClass.push('active');
        return '' +
          '<tr>' +
            '<td class="check"><input type="checkbox" data-clarify-select data-index="' + row.index + '" ' + (selection.has(row.index) ? 'checked' : '') + '></td>' +
            '<td class="index">' + (row.index + 1) + '</td>' +
            '<td>' + escapeHtml(row.category || '-') + '</td>' +
            '<td>' + escapeHtml(row.point || '-') + '</td>' +
            '<td>' + escapeHtml(row.reason || '-') + '</td>' +
            '<td>' + escapeHtml(row.branch || '-') + '</td>' +
            '<td>' +
              '<button type="button" class="' + btnClass.join(' ') + '" data-clarify-toggle="' + row.index + '">' +
                (hasValue ? '澄清已填' : '填写澄清') +
              '</button>' +
            '</td>' +
          '</tr>' +
          '<tr class="clarify-row ' + (isOpen ? 'visible' : '') + '">' +
            '<td class="check"></td>' +
            '<td colspan="6">' +
              '<textarea class="clarify-panel" data-clarify-index="' + row.index + '" placeholder="填写澄清结果...">' + escapeHtmlPreserve(normalizedValue) + '</textarea>' +
            '</td>' +
          '</tr>';
      }).join('');
      return '' +
        '<table class="clarify-table">' +
          '<thead>' +
            '<tr>' +
              '<th class="check"><input type="checkbox" data-clarify-select-all ' + (selectAllChecked ? 'checked' : '') + '></th>' +
              '<th class="index">编号</th>' +
              '<th>类别</th>' +
              '<th>不明确的需求点</th>' +
              '<th>不明确原因</th>' +
              '<th>可能存在的分支/边界情况</th>' +
              '<th>澄清结果</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' + body + '</tbody>' +
        '</table>';
    }

    function refreshClarifyTables() {
      if (reviewViewContainer && reviewViewContainer.classList.contains('visible')) {
        reviewViewContainer.innerHTML = renderReviewView();
      }
      if (autoClarifyContainer && state.autoRequireClarifications && !autoClarifyContainer.classList.contains('hidden')) {
        autoClarifyContainer.innerHTML = renderReviewView();
      }
    }

    function getClarifyTargets(fallbackIndex) {
      var selection = ensureReviewSelectionSet();
      if (selection.size) return Array.from(selection);
      if (typeof fallbackIndex === 'number' && !Number.isNaN(fallbackIndex)) {
        return [fallbackIndex];
      }
      return [];
    }

    function toggleClarifySelection(index, checked) {
      var selection = ensureReviewSelectionSet();
      if (checked) selection.add(index);
      else selection.delete(index);
      refreshClarifyTables();
    }

    function toggleClarifySelectAll(checked) {
      var selection = ensureReviewSelectionSet();
      selection.clear();
      if (checked) {
        state.reviewRows.forEach(function(_, idx) { selection.add(idx); });
      }
      refreshClarifyTables();
    }

    function toggleClarifyPanel(index) {
      var targets = getClarifyTargets(index);
      if (!targets.length) return;
      var openSet = ensureReviewExpandedSet();
      var shouldOpen = !targets.every(function(i) { return openSet.has(i); });
      targets.forEach(function(i) {
        if (shouldOpen) openSet.add(i);
        else openSet.delete(i);
      });
      refreshClarifyTables();
    }

    function handleClarifyInputEvent(e) {
      var textarea = e.target && e.target.closest ? e.target.closest('textarea[data-clarify-index]') : null;
      if (!textarea) return;
      var idx = Number(textarea.dataset.clarifyIndex);
      if (Number.isNaN(idx)) return;
      var value = normalizeReviewText(textarea.value);
      state.reviewClarifications.set(idx, value);
      textarea.value = value;
    }

    function handleClarifyClickEvent(e) {
      var target = e.target;
      while (target && target !== e.currentTarget) {
        if (target.hasAttribute && target.hasAttribute('data-clarify-toggle')) {
          var idx = Number(target.getAttribute('data-clarify-toggle'));
          if (!Number.isNaN(idx)) toggleClarifyPanel(idx);
          return;
        }
        target = target.parentNode;
      }
    }

    function handleClarifyChangeEvent(e) {
      var target = e.target;
      if (!target) return;
      if (target.hasAttribute('data-clarify-select-all')) {
        toggleClarifySelectAll(target.checked);
        return;
      }
      if (target.hasAttribute('data-clarify-select')) {
        var idx = Number(target.dataset.index);
        if (!Number.isNaN(idx)) {
          toggleClarifySelection(idx, target.checked);
        }
      }
    }

    function syncReviewViewFromResult() {
      var list = parseReviewList(reviewResultEl && reviewResultEl.value ? reviewResultEl.value : '');
      state.reviewRows = buildReviewRows(list);
      var newMap = new Map();
      state.reviewRows.forEach(function(row) {
        var existing = state.reviewClarifications.get(row.index);
        if (existing !== undefined) {
          newMap.set(row.index, existing);
        } else if (row.clarification) {
          newMap.set(row.index, row.clarification);
        }
      });
      state.reviewClarifications = newMap;
      var selection = ensureReviewSelectionSet();
      var openSet = ensureReviewExpandedSet();
      if (!state.reviewRows.length) {
        selection.clear();
        openSet.clear();
      } else {
        Array.from(selection).forEach(function(idx) {
          if (idx >= state.reviewRows.length) selection.delete(idx);
        });
        Array.from(openSet).forEach(function(idx) {
          if (idx >= state.reviewRows.length) openSet.delete(idx);
        });
      }
      var hasData = state.reviewRows.length > 0;
      if (confirmClarificationsBtn) confirmClarificationsBtn.disabled = !hasData;
      if (toggleReviewViewBtn) {
        toggleReviewViewBtn.disabled = !hasData;
        var viewVisible = reviewViewContainer && reviewViewContainer.classList.contains('visible');
        toggleReviewViewBtn.textContent = hasData && viewVisible ? '收起澄清视图' : '展开澄清视图';
      }
      if (state.autoRequireClarifications) {
        renderAutoClarifyView();
      }
      if (!reviewViewContainer) return;
      if (!hasData) {
        reviewViewContainer.classList.add('hidden');
        reviewViewContainer.classList.remove('visible');
        reviewViewContainer.innerHTML = '<p class="hint" style="padding:12px;">暂无评审数据，请先完成需求评审</p>';
      } else if (reviewViewContainer.classList.contains('visible')) {
        reviewViewContainer.innerHTML = renderReviewView();
      } else {
        reviewViewContainer.innerHTML = '<p class="hint" style="padding:12px;">点击“展开澄清视图”查看详情</p>';
      }
    }

    function toggleReviewView() {
      if (!state.reviewRows.length || !reviewViewContainer) {
        setStatus(reviewStatus, '当前没有可展示的澄清数据，请先完成评审', 'warn');
        return;
      }
      var visible = reviewViewContainer.classList.contains('visible');
      if (visible) {
        reviewViewContainer.classList.remove('visible');
        reviewViewContainer.classList.add('hidden');
        reviewViewContainer.innerHTML = '<p class="hint" style="padding:12px;">点击“展开澄清视图”查看详情</p>';
        if (toggleReviewViewBtn) toggleReviewViewBtn.textContent = '展开澄清视图';
      } else {
        reviewViewContainer.innerHTML = renderReviewView();
        reviewViewContainer.classList.add('visible');
        reviewViewContainer.classList.remove('hidden');
        if (toggleReviewViewBtn) toggleReviewViewBtn.textContent = '收起澄清视图';
      }
    }

    function confirmClarifications() {
      var list = parseReviewList(reviewResultEl && reviewResultEl.value ? reviewResultEl.value : '');
      if (!list.length) {
        setStatus(reviewStatus, '当前没有可写入的评审结果', 'warn');
        return;
      }
      var updated = list.map(function(item, idx) {
        var text = normalizeReviewText(state.reviewClarifications.get(idx));
        var merged = {};
        Object.keys(item || {}).forEach(function(key) { merged[key] = item[key]; });
        merged['需求澄清结果'] = text;
        return merged;
      });
      try {
        reviewResultEl.value = JSON.stringify(updated, null, 2);
        setStatus(reviewStatus, '澄清结果已写入评审 JSON', 'ok');
        syncReviewViewFromResult();
        updateFlowStatus();
      } catch (err) {
        console.warn('澄清结果写入失败', err);
        setStatus(reviewStatus, '澄清结果写入失败，请检查内容', 'warn');
      }
    }

    function buildReviewClarificationContext() {
      if (!reviewResultEl) return '';
      var reviews = parseReviewList(reviewResultEl.value || '');
      if (!reviews.length) return '';
      var rows = buildReviewRows(reviews);
      var hasClar = false;
      var enriched = rows.map(function(row) {
        var clar = normalizeReviewText(state.reviewClarifications.has(row.index) ? state.reviewClarifications.get(row.index) : row.clarification);
        if (clar) hasClar = true;
        var merged = {};
        Object.keys(row.source || {}).forEach(function(key) { merged[key] = row.source[key]; });
        if (clar) merged['需求澄清结果'] = clar;
        return merged;
      });
      if (!hasClar) return '';
      try {
        return JSON.stringify(enriched, null, 2);
      } catch (err) {
        console.warn('需求澄清 JSON 序列化失败', err);
        return '';
      }
    }

    async function copyReviewResult() {
      var text = reviewResultEl && reviewResultEl.value ? reviewResultEl.value.trim() : '';
      if (!text) {
        setStatus(reviewStatus, '暂无可复制的评审结果', 'warn');
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        setStatus(reviewStatus, '已复制评审 JSON', 'ok');
      } catch (err) {
        console.error(err);
        setStatus(reviewStatus, '复制失败，请手动复制', 'warn');
      }
    }

    function exportReviewResult() {
      var text = reviewResultEl && reviewResultEl.value ? reviewResultEl.value.trim() : '';
      if (!text) {
        setStatus(reviewStatus, '暂无可导出的评审结果', 'warn');
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再导出评审结果');
      if (!requirementLabel) {
        setStatus(reviewStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      var stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      var payload = wrapTextWithRequirement(text, 'compare');
      downloadText('review_' + getSafeRequirementSlug() + '_' + stamp + '.json', payload);
      setStatus(reviewStatus, '评审结果已导出', 'ok');
    }

    async function importReviewResult(file) {
      if (!file) return;
      try {
        var text = (await file.text()).trim();
        if (!text) {
          setStatus(reviewStatus, '导入内容为空', 'warn');
          return;
        }
        var parsedLabel = extractRequirementLabelFromText(text);
        if (parsedLabel) {
          setRequirementLabel(parsedLabel, 'import');
        } else {
          var ensured = promptRequirementLabel('请输入本次需求名称作为需求标识后再导入评审结果');
          if (!ensured) {
            setStatus(reviewStatus, '已取消导入（需求标识为空）', 'warn');
            return;
          }
        }
        var stripped = stripRequirementHeader(stripCodeFence(text));
        var parsed;
        try {
          parsed = JSON.parse(stripped);
        } catch (err) {
          setStatus(reviewStatus, '导入内容不是有效 JSON，请确认文件格式', 'warn');
          return;
        }
        if (isCoveragePayload(parsed)) {
          setStatus(reviewStatus, '检测到为覆盖对比结果，请导入需求评审 JSON', 'warn');
          return;
        }
        if (looksLikeCoverageSummary(parsed)) {
          setStatus(reviewStatus, '检测到该文件为覆盖对比结果，请导入需求评审 JSON', 'warn');
          return;
        }
        var list = Array.isArray(parsed)
          ? parsed
          : (parsed && Array.isArray(parsed.data) ? parsed.data : null);
        if (!Array.isArray(list)) {
          setStatus(reviewStatus, '未在文件中找到需求评审数组，请确认格式', 'warn');
          return;
        }
        reviewResultEl.value = wrapTextWithRequirement(stripped);
        setStatus(reviewStatus, '已导入评审结果', 'ok');
        updateFlowStatus();
        syncReviewViewFromResult();
      } catch (err) {
        console.error(err);
        setStatus(reviewStatus, '导入失败：' + err.message, 'err');
      }
    }

    async function reviewRequirements() {
      var raw = rawText && rawText.value ? rawText.value.trim() : '';
      if (!raw) {
        setStatus(reviewStatus, '请先导入或填写原始需求', 'warn');
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入本次需求标识后再进行需求评审');
      if (!requirementLabel) {
        setStatus(reviewStatus, '已取消需求评审（需求标识为空）', 'warn');
        return;
      }
      if (runReviewBtn) runReviewBtn.disabled = true;
      setStepInProgress('review');
      setStatus(reviewStatus, '正在分析需求模糊点...', '');
      var model;
      try {
        model = getAssignedModel('review');
      } catch (err) {
        setStatus(reviewStatus, err.message, 'warn');
        updateModelTiming(reviewTimingEl);
        if (runReviewBtn) runReviewBtn.disabled = false;
        clearStepInProgress('review');
        updateFlowStatus();
        return;
      }
      try {
        var reviewPrompt = state.assignments && state.assignments.reviewPrompt ? state.assignments.reviewPrompt.trim() : '';
        var prompt = reviewPrompt || defaultPrompts.review;
        var reasoning = getReasoningForType('review');
        var startTime = Date.now();
        var content = await callModelWithConfig(model, raw, prompt, reasoning);
        updateModelTiming(reviewTimingEl, Date.now() - startTime);
        reviewResultEl.value = wrapTextWithRequirement(formatJsonOrText(stripCodeFence(content)));
        syncReviewViewFromResult();
        setStatus(reviewStatus, '评审完成', 'ok');
      } catch (err) {
        console.error(err);
        updateModelTiming(reviewTimingEl);
        setStatus(reviewStatus, '评审失败：' + err.message, 'err');
      } finally {
        if (runReviewBtn) runReviewBtn.disabled = false;
        clearStepInProgress('review');
        updateFlowStatus();
      }
    }

    function openAutoClarifyPanel() {
      if (!autoClarifyContainer) return;
      renderAutoClarifyView();
      autoClarifyContainer.classList.remove('hidden');
      if (autoClarifyToggleBtn) autoClarifyToggleBtn.textContent = '收起澄清视图';
    }

    return {
      reviewRequirements: reviewRequirements,
      copyReviewResult: copyReviewResult,
      exportReviewResult: exportReviewResult,
      importReviewResult: importReviewResult,
      toggleReviewView: toggleReviewView,
      confirmClarifications: confirmClarifications,
      handleClarifyClickEvent: handleClarifyClickEvent,
      handleClarifyChangeEvent: handleClarifyChangeEvent,
      handleClarifyInputEvent: handleClarifyInputEvent,
      updateAutoClarifyVisibility: updateAutoClarifyVisibility,
      renderAutoClarifyView: renderAutoClarifyView,
      openAutoClarifyPanel: openAutoClarifyPanel,
      handleAutoClarifyConfirm: handleAutoClarifyConfirm,
      waitForAutoClarification: waitForAutoClarification,
      syncReviewViewFromResult: syncReviewViewFromResult,
      buildReviewClarificationContext: buildReviewClarificationContext,
    };
  }

  window.app = window.app || {};
  window.app.reviewCore = { init: init };
})();
