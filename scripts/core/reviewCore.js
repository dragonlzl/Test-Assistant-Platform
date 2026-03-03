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
    var getTemperatureForType = handlers.getTemperatureForType || function() { return 0.2; };
    var callModelWithConfig = handlers.callModelWithConfig || function() { return Promise.resolve(''); };
    var callModelWithContent = handlers.callModelWithContent || function() { return Promise.reject(new Error('多模态模型客户端不可用')); };
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
    var persistWorkflowState = handlers.persistWorkflowState || function() {};

    var rawText = dom.rawText;
    var reviewStatus = dom.reviewStatus;
    var clarifyStatus = dom.clarifyStatus;
    var reviewResultEl = dom.reviewResultEl;
    var reviewViewContainer = dom.reviewViewContainer;
    var toggleReviewViewBtn = dom.toggleReviewViewBtn;
    var confirmClarificationsBtn = dom.confirmClarificationsBtn;
    var reviewViewDrawerBody = dom.reviewViewDrawerBody;
    var reviewViewDrawerTitle = dom.reviewViewDrawerTitle;
    var reviewViewDrawer = null;
    var runReviewBtn = dom.runReviewBtn;
    var reviewTimingEl = dom.reviewTimingEl;
    var autoClarifyContainer = dom.autoClarifyContainer;
    var autoClarifyToggle = dom.autoClarifyToggle;
    var autoClarifyToggleBtn = dom.autoClarifyToggleBtn;
    var autoClarifyConfirmBtn = dom.autoClarifyConfirmBtn;
    var autoClarifySection = dom.autoClarifySection;
    var autoClarifyStatus = dom.autoClarifyStatus;
    var autoClarifyDrawerBody = dom.autoClarifyDrawerBody;
    var autoClarifyDrawerTitle = dom.autoClarifyDrawerTitle;
    var autoClarifyDrawer = null;
    var multimodalMaxImages = 20;
    var multimodalMaxEdge = 1600;
    var multimodalMaxBytes = 4 * 1024 * 1024;

    if (!Array.isArray(state.reviewRows)) state.reviewRows = [];
    if (!(state.reviewClarifications instanceof Map)) state.reviewClarifications = new Map();
    if (!(state.reviewSelections instanceof Set)) state.reviewSelections = new Set();
    if (!(state.reviewExpanded instanceof Set)) state.reviewExpanded = new Set();

    function ensureReviewDrawer() {
      if (reviewViewDrawer) return reviewViewDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      reviewViewDrawer = window.app.drawer.createDrawer({
        drawerId: 'reviewViewDrawer',
        closeButtons: ['closeReviewViewDrawerBtn'],
        onClose: function() {
          if (reviewViewContainer) {
            reviewViewContainer.classList.add('hidden');
            reviewViewContainer.classList.remove('visible');
            reviewViewContainer.innerHTML = '<p class="hint" style="padding:12px;">点击“前往视图确认澄清”查看详情</p>';
          }
          if (toggleReviewViewBtn) toggleReviewViewBtn.textContent = '前往视图确认澄清';
        },
      });
      return reviewViewDrawer;
    }

    function ensureAutoClarifyDrawer() {
      if (autoClarifyDrawer) return autoClarifyDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      autoClarifyDrawer = window.app.drawer.createDrawer({
        drawerId: 'autoClarifyDrawer',
        closeButtons: ['closeAutoClarifyDrawerBtn'],
        onClose: function() {
          if (autoClarifyContainer) {
            autoClarifyContainer.classList.add('hidden');
            autoClarifyContainer.classList.remove('visible');
          }
          setAutoClarifyToggleLabel(false);
        },
      });
      return autoClarifyDrawer;
    }

    function closeClarifyDrawers() {
      var reviewDrawer = reviewViewDrawer || ensureReviewDrawer();
      if (reviewDrawer && reviewDrawer.element && reviewDrawer.element.classList.contains('open')) {
        reviewDrawer.close();
      }
      var clarifyDrawer = autoClarifyDrawer || ensureAutoClarifyDrawer();
      if (clarifyDrawer && clarifyDrawer.element && clarifyDrawer.element.classList.contains('open')) {
        clarifyDrawer.close();
      }
    }

    function setAutoClarifyToggleLabel(open) {
      if (!autoClarifyToggleBtn) return;
      autoClarifyToggleBtn.textContent = open ? '收起澄清视图' : '前往视图确认澄清';
    }

    function setClarifyStatus(text, type) {
      setStatus(reviewStatus, text, type);
      if (clarifyStatus) setStatus(clarifyStatus, text, type);
    }

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
          setAutoClarifyToggleLabel(false);
        }
        setStatus(autoClarifyStatus, '', '');
        if (state.autoClarifyResolver) {
          state.autoClarifyResolver(true);
          state.autoClarifyResolver = null;
        }
        var drawer = autoClarifyDrawer || ensureAutoClarifyDrawer();
        if (drawer && drawer.element && drawer.element.classList.contains('open')) drawer.close();
      } else {
        if (autoClarifyToggleBtn) {
          autoClarifyToggleBtn.disabled = false;
          setAutoClarifyToggleLabel(autoClarifyDrawer && autoClarifyDrawer.element && autoClarifyDrawer.element.classList.contains('open'));
        }
        renderAutoClarifyView();
      }
      persistWorkflowState();
    }

    function renderAutoClarifyView() {
      if (!autoClarifyContainer) return;
      if (!state.autoRequireClarifications) {
        autoClarifyContainer.innerHTML = '<p class="hint" style="padding:12px;">未启用需求澄清</p>';
        autoClarifyContainer.classList.add('hidden');
        autoClarifyContainer.classList.remove('visible');
        if (autoClarifyConfirmBtn) autoClarifyConfirmBtn.disabled = true;
        setAutoClarifyToggleLabel(false);
        return;
      }
      if (!state.reviewRows.length) {
        autoClarifyContainer.innerHTML = '<p class="hint" style="padding:12px;">暂无评审结果，请先运行需求评审</p>';
        autoClarifyContainer.classList.remove('hidden');
        autoClarifyContainer.classList.add('visible');
        if (autoClarifyConfirmBtn) autoClarifyConfirmBtn.disabled = true;
        setAutoClarifyToggleLabel(autoClarifyDrawer && autoClarifyDrawer.element && autoClarifyDrawer.element.classList.contains('open'));
        return;
      }
      autoClarifyContainer.innerHTML = renderReviewView();
      autoClarifyContainer.classList.remove('hidden');
      autoClarifyContainer.classList.add('visible');
      setAutoClarifyToggleLabel(autoClarifyDrawer && autoClarifyDrawer.element && autoClarifyDrawer.element.classList.contains('open'));
      if (autoClarifyConfirmBtn) autoClarifyConfirmBtn.disabled = false;
    }

    function waitForAutoClarification() {
      if (!state.autoRequireClarifications) return Promise.resolve(true);
      if (!state.reviewRows.length) {
        return Promise.reject(new Error('暂无可澄清的数据，请先完成需求评审'));
      }
      renderAutoClarifyView();
      return new Promise(function(resolve) {
        setStatus(autoClarifyStatus, '请补充澄清结果并点击“确认澄清”继续', 'warn');
        state.autoClarifyResolver = function(value) {
          if (value === void 0) value = true;
          state.autoClarifyResolver = null;
          resolve(value);
        };
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
      persistWorkflowState();
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
        toggleReviewViewBtn.textContent = hasData && viewVisible ? '收起澄清视图' : '前往视图确认澄清';
      }
      if (state.autoRequireClarifications) {
        renderAutoClarifyView();
      }
      if (!reviewViewContainer) return;
      if (!hasData) {
        reviewViewContainer.classList.add('hidden');
        reviewViewContainer.classList.remove('visible');
        reviewViewContainer.innerHTML = '<p class="hint" style="padding:12px;">暂无评审数据，请先完成需求评审</p>';
        var drawer = ensureReviewDrawer();
        if (drawer) drawer.close();
      } else if (reviewViewContainer.classList.contains('visible')) {
        reviewViewContainer.innerHTML = renderReviewView();
      } else {
        reviewViewContainer.innerHTML = '<p class="hint" style="padding:12px;">点击“前往视图确认澄清”查看详情</p>';
      }
    }

    function toggleReviewView() {
      if (!state.reviewRows.length || !reviewViewContainer) {
        setStatus(reviewStatus, '当前没有可展示的澄清数据，请先完成评审', 'warn');
        return;
      }
      var drawer = ensureReviewDrawer();
      if (!drawer) return;
      var drawerEl = drawer.element;
      var isOpen = drawerEl && drawerEl.classList.contains('open');
      if (isOpen) {
        drawer.close();
        return;
      }
      reviewViewContainer.innerHTML = renderReviewView();
      reviewViewContainer.classList.add('visible');
      reviewViewContainer.classList.remove('hidden');
      if (reviewViewDrawerTitle) reviewViewDrawerTitle.textContent = '需求澄清点视图';
      if (toggleReviewViewBtn) toggleReviewViewBtn.textContent = '收起澄清视图';
      drawer.open();
    }

    function confirmClarifications() {
      var list = parseReviewList(reviewResultEl && reviewResultEl.value ? reviewResultEl.value : '');
      if (!list.length) {
        setClarifyStatus('当前没有可写入的评审结果', 'warn');
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
        setClarifyStatus('澄清结果已写入评审 JSON', 'ok');
        syncReviewViewFromResult();
        updateFlowStatus();
        closeClarifyDrawers();
      } catch (err) {
        console.warn('澄清结果写入失败', err);
        setClarifyStatus('澄清结果写入失败，请检查内容', 'warn');
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

    function modelSupportsVision(model) {
      if (!model || typeof model !== 'object') return false;
      var raw = model.capabilities || model.modelCapabilities || model.tags || model.multiModalTags || model.multimodalTags;
      var caps = [];
      if (Array.isArray(raw)) {
        caps = raw;
      } else if (typeof raw === 'string') {
        caps = raw.split(/[,|/、\s]+/);
      } else if (raw && typeof raw === 'object') {
        caps = Object.keys(raw).filter(function(key) { return raw[key]; });
      }
      for (var i = 0; i < caps.length; i += 1) {
        var key = String(caps[i] || '').trim().toLowerCase();
        if (!key) continue;
        if (key === 'vision' || key === '视觉') return true;
      }
      return false;
    }

    function collectRequirementImageBlobs() {
      var list = [];
      var media = state && state.requirementMedia && typeof state.requirementMedia === 'object'
        ? state.requirementMedia
        : null;
      if (!media) return list;
      var append = function(item, source) {
        if (!item || typeof item !== 'object') return;
        var blob = item.blob || item.file || null;
        if (!blob) return;
        list.push({
          blob: blob,
          source: source || '',
          index: Number(item.index) || (list.length + 1),
        });
      };
      if (Array.isArray(media.docxImages)) {
        media.docxImages.forEach(function(item) { append(item, 'docx'); });
      }
      if (Array.isArray(media.pastedImages)) {
        media.pastedImages.forEach(function(item) { append(item, 'paste'); });
      }
      return list;
    }

    function readBlobAsDataUrl(blob) {
      return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function() { resolve(String(reader.result || '')); };
        reader.onerror = function() { reject(reader.error || new Error('读取图片失败')); };
        reader.readAsDataURL(blob);
      });
    }

    function estimateDataUrlBytes(dataUrl) {
      if (!dataUrl) return 0;
      var comma = dataUrl.indexOf(',');
      if (comma === -1) return 0;
      var b64 = dataUrl.slice(comma + 1);
      var padding = 0;
      var matched = b64.match(/=+$/);
      if (matched && matched[0]) padding = matched[0].length;
      return Math.max(0, Math.floor(b64.length * 3 / 4) - padding);
    }

    function loadImageByDataUrl(dataUrl) {
      return new Promise(function(resolve, reject) {
        var img = new Image();
        img.onload = function() { resolve(img); };
        img.onerror = function() { reject(new Error('图片解码失败')); };
        img.src = dataUrl;
      });
    }

    async function resizeDataUrl(dataUrl, maxEdge, mimeType, quality) {
      if (!dataUrl) return '';
      if (typeof document === 'undefined' || !document.createElement) return dataUrl;
      var image;
      try {
        image = await loadImageByDataUrl(dataUrl);
      } catch (err) {
        return dataUrl;
      }
      var srcW = image.naturalWidth || image.width || 0;
      var srcH = image.naturalHeight || image.height || 0;
      if (!srcW || !srcH) return dataUrl;
      var longest = Math.max(srcW, srcH);
      var ratio = longest > maxEdge ? (maxEdge / longest) : 1;
      var targetW = Math.max(1, Math.round(srcW * ratio));
      var targetH = Math.max(1, Math.round(srcH * ratio));
      var canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      var ctx2d = canvas.getContext('2d');
      if (!ctx2d) return dataUrl;
      ctx2d.drawImage(image, 0, 0, targetW, targetH);
      var targetMime = mimeType || 'image/jpeg';
      try {
        return canvas.toDataURL(targetMime, quality);
      } catch (err) {
        try {
          return canvas.toDataURL('image/jpeg', quality);
        } catch (err2) {
          return dataUrl;
        }
      }
    }

    async function preprocessImageToDataUrl(blob) {
      if (!blob) return { ok: false, reason: 'missing_blob' };
      var dataUrl = '';
      try {
        dataUrl = await readBlobAsDataUrl(blob);
      } catch (err) {
        return { ok: false, reason: 'read_failed' };
      }
      var best = await resizeDataUrl(dataUrl, multimodalMaxEdge, null, 0.92);
      if (!best) best = dataUrl;
      var bytes = estimateDataUrlBytes(best);
      if (bytes > multimodalMaxBytes) {
        var jpegHigh = await resizeDataUrl(best, multimodalMaxEdge, 'image/jpeg', 0.85);
        if (jpegHigh) {
          best = jpegHigh;
          bytes = estimateDataUrlBytes(best);
        }
      }
      if (bytes > multimodalMaxBytes) {
        var jpegLow = await resizeDataUrl(best, multimodalMaxEdge, 'image/jpeg', 0.72);
        if (jpegLow) {
          best = jpegLow;
          bytes = estimateDataUrlBytes(best);
        }
      }
      if (bytes > multimodalMaxBytes) {
        return { ok: false, reason: 'too_large' };
      }
      return { ok: true, dataUrl: best };
    }

    async function buildImageContentBlocks(images) {
      var result = [];
      var stats = {
        total: Array.isArray(images) ? images.length : 0,
        sent: 0,
        skipped: 0,
      };
      if (!Array.isArray(images) || !images.length) return { blocks: result, stats: stats };
      for (var i = 0; i < images.length; i += 1) {
        if (i >= multimodalMaxImages) {
          stats.skipped += (images.length - i);
          break;
        }
        var item = images[i];
        var pre = await preprocessImageToDataUrl(item && item.blob ? item.blob : null);
        if (!pre.ok || !pre.dataUrl) {
          stats.skipped += 1;
          continue;
        }
        result.push({
          type: 'image',
          dataUrl: pre.dataUrl,
        });
        stats.sent += 1;
      }
      return { blocks: result, stats: stats };
    }

    async function reviewRequirements() {
      var raw = rawText && rawText.value ? rawText.value.trim() : '';
      var requirementImages = collectRequirementImageBlobs();
      if (!raw && !requirementImages.length) {
        setStatus(reviewStatus, '请先导入或填写原始需求', 'warn');
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入本次需求标识后再进行需求评审');
      if (!requirementLabel) {
        setStatus(reviewStatus, '已取消需求评审（需求标识为空）', 'warn');
        return;
      }
      if (reviewResultEl) reviewResultEl.value = '';
      if (reviewViewContainer) {
        reviewViewContainer.classList.add('hidden');
        reviewViewContainer.classList.remove('visible');
        reviewViewContainer.innerHTML = '<p class="hint" style="padding:12px;">点击“前往视图确认澄清”查看详情</p>';
      }
      updateFlowStatus();
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
        var temperature = getTemperatureForType('review');
        var modelHasVision = modelSupportsVision(model);
        var useVisionInput = modelHasVision && requirementImages.length > 0;
        if (!raw && !useVisionInput) {
          setStatus(reviewStatus, '当前评审模型不支持视觉，且文本为空，请先输入文本或更换支持视觉的模型', 'warn');
          return;
        }
        var startTime = Date.now();
        var content = '';
        if (useVisionInput) {
          var imageContent = await buildImageContentBlocks(requirementImages);
          var sentImages = imageContent && imageContent.stats ? Number(imageContent.stats.sent) || 0 : 0;
          if (!raw && sentImages < 1) {
            setStatus(reviewStatus, '当前无可用文本，且图片均未通过处理限制，请补充文本或缩小图片后重试', 'warn');
            return;
          }
          var visionUserText = raw || '（无文本，请根据图片进行需求评审）';
          if (sentImages > 0) {
            var contentBlocks = [{ type: 'text', text: visionUserText }].concat(imageContent.blocks || []);
            content = await callModelWithContent(model, contentBlocks, prompt, {
              reasoningEffort: reasoning,
              temperature: temperature,
            });
          } else {
            content = await callModelWithConfig(model, raw, prompt, reasoning, temperature);
          }
          var reviewMsg = '评审完成';
          if (sentImages > 0) {
            reviewMsg += '，已携带图片' + sentImages + '张';
          }
          if (imageContent.stats && imageContent.stats.skipped > 0) {
            reviewMsg += '，跳过图片' + imageContent.stats.skipped + '张';
          }
          if (!sentImages && requirementImages.length > 0) {
            reviewMsg += '（图片均未通过处理限制，本次仅使用文本）';
          }
          var warnStatus = false;
          if (imageContent.stats && imageContent.stats.skipped > 0) warnStatus = true;
          if (!sentImages && requirementImages.length > 0) warnStatus = true;
          setStatus(reviewStatus, reviewMsg, warnStatus ? 'warn' : 'ok');
        } else {
          content = await callModelWithConfig(model, raw, prompt, reasoning, temperature);
          if (requirementImages.length > 0 && !modelHasVision) {
            setStatus(reviewStatus, '评审完成（当前模型不支持视觉，本次仅使用文本）', 'warn');
          } else {
            setStatus(reviewStatus, '评审完成', 'ok');
          }
        }
        updateModelTiming(reviewTimingEl, Date.now() - startTime);
        reviewResultEl.value = wrapTextWithRequirement(formatJsonOrText(stripCodeFence(content)));
        syncReviewViewFromResult();
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
      var drawer = ensureAutoClarifyDrawer();
      if (!drawer) return;
      renderAutoClarifyView();
      autoClarifyContainer.classList.remove('hidden');
      autoClarifyContainer.classList.add('visible');
      if (autoClarifyDrawerBody) autoClarifyDrawerBody.scrollTop = 0;
      if (autoClarifyDrawerTitle) autoClarifyDrawerTitle.textContent = '需求澄清视图';
      setAutoClarifyToggleLabel(true);
      drawer.open();
    }

    function closeAutoClarifyPanel() {
      var drawer = autoClarifyDrawer || ensureAutoClarifyDrawer();
      if (drawer) drawer.close();
      else setAutoClarifyToggleLabel(false);
    }

    function toggleAutoClarifyPanel() {
      var drawer = autoClarifyDrawer || ensureAutoClarifyDrawer();
      if (!drawer) return;
      var isOpen = drawer.element && drawer.element.classList.contains('open');
      if (isOpen) closeAutoClarifyPanel();
      else openAutoClarifyPanel();
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
      closeAutoClarifyPanel: closeAutoClarifyPanel,
      toggleAutoClarifyPanel: toggleAutoClarifyPanel,
      handleAutoClarifyConfirm: handleAutoClarifyConfirm,
      waitForAutoClarification: waitForAutoClarification,
      syncReviewViewFromResult: syncReviewViewFromResult,
      buildReviewClarificationContext: buildReviewClarificationContext,
    };
  }

  window.app = window.app || {};
  window.app.reviewCore = { init: init };
})();
