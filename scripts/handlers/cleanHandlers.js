(function() {
  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var cleanCore = ctx.cleanCore || {};
    var defaultPrompts = ctx.defaultPrompts || {};
    var handlers = ctx.handlers || {};
    var dom = ctx.dom || {};

    var setStatus = handlers.setStatus || function() {};
    var updateFlowStatus = handlers.updateFlowStatus || function() {};
    var getRequirementLabel = handlers.getRequirementLabel || function() { return ''; };
    var renderAutoRawInfo = handlers.renderAutoRawInfo || function() {};
    var renderCaseGeneration = handlers.renderCaseGeneration || function() {};
    var renderCaseGenProgressBoard = handlers.renderCaseGenProgressBoard || function() {};
    var refreshMissingSmartFillButton = handlers.refreshMissingSmartFillButton || function() {};
    var wrapTextWithRequirement = handlers.wrapTextWithRequirement || function(text) { return text; };
    var stripRequirementHeader = handlers.stripRequirementHeader || function(text) { return text; };
    var stripCodeFence = handlers.stripCodeFence || function(text) { return text; };
    var unwrapRequirementPayload = handlers.unwrapRequirementPayload || function(text) { return { payload: text }; };
    var ensureRequirementLabel = handlers.ensureRequirementLabel || function() { return ''; };
    var buildReviewClarificationContext = handlers.buildReviewClarificationContext || function() { return ''; };
    var getAssignedModel = handlers.getAssignedModel || function() { throw new Error('缺少模型'); };
    var getReasoningForType = handlers.getReasoningForType || function() { return ''; };
    var getTemperatureForType = handlers.getTemperatureForType || function() { return 0.2; };
    var callModelWithConfig = handlers.callModelWithConfig || function() { return Promise.resolve(''); };
    var updateModelTiming = handlers.updateModelTiming || function() {};
    var extractJsonPayload = handlers.extractJsonPayload || function(text) { return text; };
    var setStepInProgress = handlers.setStepInProgress || function() {};
    var clearStepInProgress = handlers.clearStepInProgress || function() {};
    var basicClean = handlers.basicClean || function(text) {
      var normalized = (text || '')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      var lines = normalized.split('\n').map(function(line) { return line.trim(); }).filter(Boolean);
      if (!lines.length) {
        return JSON.stringify({ 需求背景: '', 全局约束: [], 功能条目: [] }, null, 2);
      }
      var summary = lines.slice(0, 3).join(' ');
      var items = lines.map(function(line, idx) {
        var parts = line.split(/[：:]/);
        var hasTitle = parts.length > 1;
        var title = hasTitle ? parts[0].trim() : '功能' + (idx + 1);
        var desc = hasTitle ? parts.slice(1).join('：').trim() || line : line;
        return {
          编号: 'F' + String(idx + 1).padStart(2, '0'),
          标题: title || ('功能' + (idx + 1)),
          描述: desc,
          输入条件: '',
          输出结果: '',
          补充说明: '',
          原始引用: [line],
        };
      });
      var data = { 需求背景: summary || lines[0], 全局约束: [], 功能条目: items };
      return JSON.stringify(data, null, 2);
    };
    var stringifyDescription = handlers.stringifyDescription || function(desc) {
      if (!desc || typeof desc !== 'object') return '';
      return desc.summary || '';
    };

    function findSnippetRange(fullText, snippet, startIdx) {
      var target = (snippet || '').trim();
      if (!target) return null;
      var start = typeof startIdx === 'number' ? startIdx : 0;
      var idx = fullText.indexOf(target, start);
      var length = target.length;
      if (idx === -1) {
        var lines = target.split(/\n+/).map(function(line) { return line.trim(); }).filter(Boolean);
        if (lines.length) {
          var first = lines[0];
          idx = fullText.indexOf(first, start);
          length = first.length;
        }
      }
      if (idx === -1) {
        var pattern = escapeRegex(target).replace(/\s+/g, '\\s+');
        try {
          var regex = new RegExp(pattern, 'm');
          var sliced = fullText.slice(start);
          var match = regex.exec(sliced);
          if (match) {
            idx = start + match.index;
            length = match[0].length;
          }
        } catch (err) {
          idx = -1;
        }
      }
      if (idx === -1) {
        var normalized = buildNormalizedIndex(fullText);
        var normalizedSnippet = normalizeForSearch(snippet);
        if (normalizedSnippet) {
          var normStart = findNormalizedStartIndex(normalized.indexMap, start);
          var normIdx = normalized.text.indexOf(normalizedSnippet, normStart);
          if (normIdx !== -1) {
            var startOriginal = normalized.indexMap[normIdx];
            var endOriginal = normalized.indexMap[normIdx + normalizedSnippet.length - 1] + 1;
            return { start: startOriginal, end: endOriginal };
          }
        }
      }
      if (idx === -1) return null;
      return { start: idx, end: idx + length };
    }

    function escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function buildNormalizedIndex(text) {
      var chars = [];
      var indexMap = [];
      for (var i = 0; i < text.length; i += 1) {
        var ch = text[i];
        if (shouldSkipChar(ch)) continue;
        chars.push(ch);
        indexMap.push(i);
      }
      return { text: chars.join(''), indexMap: indexMap };
    }

    function findNormalizedStartIndex(indexMap, originalIndex) {
      for (var i = 0; i < indexMap.length; i += 1) {
        if (indexMap[i] >= originalIndex) return i;
      }
      return indexMap.length;
    }

    function normalizeForSearch(str) {
      var chars = [];
      for (var i = 0; i < str.length; i += 1) {
        var ch = str[i];
        if (shouldSkipChar(ch)) continue;
        chars.push(ch);
      }
      return chars.join('');
    }

    function shouldSkipChar(ch) {
      return /\s/.test(ch) || /[，,：:；;、。]/.test(ch);
    }
    var switchTab = handlers.switchTab || function() {};
    var escapeHtml = handlers.escapeHtml || function(text) {
      var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      var raw = text === undefined || text === null ? '' : text.toString();
      return raw.replace(/[&<>"']/g, function(ch) { return map[ch] || ''; });
    };
    var escapeHtmlPreserve = handlers.escapeHtmlPreserve || function(text) { return text; };
    var cleanHighlightColors = handlers.cleanHighlightColors || ['#5b8def', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];
    var setCaseViewHint = handlers.setCaseViewHint || function() {};
    var resetImportedCaseView = handlers.resetImportedCaseView || function() {};
    var renderImportedCaseList = handlers.renderImportedCaseList || function() {};
    var syncCaseTextWithImports = handlers.syncCaseTextWithImports || function() {};
    var hasImportedCases = handlers.hasImportedCases || function() { return false; };

    var rawText = dom.rawText;
    var cleanedTextEl = dom.cleanedTextEl;
    var splitResultEl = dom.splitResultEl;
    var casesCoverageStatus = dom.casesCoverageStatus;
    var caseGenStatus = dom.caseGenStatus;
    var cleanRawLocateBtn = dom.cleanRawLocateBtn;
    var cleanRawView = dom.cleanRawView;
    var cleanViewContainer = dom.cleanViewContainer;
    var cleanHighlightAllBtn = dom.cleanHighlightAllBtn;
    var cleanStatus = dom.cleanStatus;
    var caseTextEl = dom.caseTextEl;
    var runCleanBtn = dom.runCleanBtn;
    var cleanTimingEl = dom.cleanTimingEl;

    function renderAutoRawInfoImpl() {
      if (!dom.autoRawListEl || !rawText) return;
      var hasContent = rawText.value.trim().length > 0;
      if (!hasContent) {
        dom.autoRawListEl.innerHTML = '<span class="hint" data-auto-raw-placeholder>未导入需求</span>';
        if (dom.autoRawClearBtn) dom.autoRawClearBtn.disabled = true;
        return;
      }
      var label = getRequirementLabel(false) || '当前文本';
      var removable = Boolean(state.lastRawImportName);
      var chip = removable
        ? '<span class="file-chip">' + label.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '<button type="button" data-auto-raw-remove>×</button></span>'
        : '<span class="file-chip">' + label.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>';
      dom.autoRawListEl.innerHTML = chip;
      if (dom.autoRawClearBtn) dom.autoRawClearBtn.disabled = false;
    }

    function handleRawInput() {
      if (!rawText) return;
      if (!state.lastRawImportName) renderAutoRawInfoImpl();
      renderCleanRawView(state.cleanViewSelection);
      updateFlowStatus();
    }

    function handleCleanInput() {
      if (!cleanedTextEl) return;
      state.cleanEntries = [];
      state.cleanViewSelection = -1;
      state.cleanHighlightAll = false;
      state.cleanActiveHighlights = {};
      renderCleanView();
      renderCleanRawView(null);
      updateFlowStatus();
    }

    function handleSplitInput() {
      if (!splitResultEl) return;
      state.caseGenModules = [];
      state.caseGenResults = {};
      state.caseGenSource = '';
      state.caseGenModuleStatus = {};
      state.caseGenProgress = {};
      state.caseGenRunning = new Set();
      renderCaseGeneration();
      renderCaseGenProgressBoard();
      setStatus(casesCoverageStatus, '', '');
      setStatus(caseGenStatus, '', '');
      refreshMissingSmartFillButton();
    }

    function handleCaseTextInput() {
      if (!caseTextEl) return;
      if (caseTextEl.value.trim()) {
        setStatus(casesCoverageStatus, '', '');
        setCaseViewHint('');
      } else if (!hasImportedCases()) {
        setCaseViewHint('请先上传或输入 XMind 测试用例');
      }
      if (!hasImportedCases()) resetImportedCaseView();
      updateFlowStatus();
    }

    function wrapCleanedText(text) {
      return wrapTextWithRequirement(text, 'clean');
    }

    function shouldExpectCleanJson() {
      var prompt = state.assignments && state.assignments.cleanPrompt ? state.assignments.cleanPrompt.trim() : '';
      var basePrompt = prompt || (defaultPrompts.system || '');
      if (cleanCore.shouldExpectCleanJson) return cleanCore.shouldExpectCleanJson(basePrompt);
      return /json/i.test(basePrompt);
    }

    function getCleanedEntries() {
      if (!shouldExpectCleanJson()) return [];
      if (!cleanedTextEl) return [];
      var content = stripRequirementHeader(cleanedTextEl.value || '');
      if (!content.trim()) return [];
      if (cleanCore.buildCleanedEntries) {
        try {
          return cleanCore.buildCleanedEntries(rawText ? rawText.value || '' : '', content, true);
        } catch (err) {
          console.warn('清洗 JSON 解析失败', err);
          return [];
        }
      }
      return [];
    }

    function getCleanedRequirementText() {
      var entries = getCleanedEntries();
      if (!entries.length) return '';
      var stringify = cleanCore.stringifyDescription || stringifyDescription;
      var lines = entries.map(function(entry, idx) {
        var feature = entry.feature || ('功能点' + (idx + 1));
        var body = stringify(entry.description) || entry.rawRequirement || '';
        return body ? (idx + 1) + '. 【' + feature + '】' + body : (idx + 1) + '. 【' + feature + '】';
      }).filter(Boolean);
      return lines.join('\n');
    }

    function getCleanedTextForModel() {
      if (!cleanedTextEl) return '';
      var payloadObj = unwrapRequirementPayload(cleanedTextEl.value.trim());
      var text = typeof payloadObj.payload === 'string'
        ? payloadObj.payload
        : payloadObj.payload && typeof payloadObj.payload === 'object'
        ? JSON.stringify(payloadObj.payload, null, 2)
        : '';
      if (!text) return '';
      if (!shouldExpectCleanJson()) return text;
      var stripped = stripCodeFence(text);
      if (!stripped) return text;
      try {
        var parsed = JSON.parse(stripped);
        var stripRawFields = cleanCore.stripRawFields || function(data) { return data; };
        var sanitized = stripRawFields(parsed);
        return JSON.stringify(sanitized, null, 2);
      } catch (err) {
        console.warn('清洗 JSON 去除原始需求描述失败', err);
        return text;
      }
    }

    function collectEntryRanges(entry, fullText) {
      var segments = Array.isArray(entry && entry.rawSegments) && entry.rawSegments.length
        ? entry.rawSegments
        : (entry && entry.rawRequirement ? [entry.rawRequirement] : []);
      var ranges = [];
      var searchStart = 0;
      segments.forEach(function(seg) {
        var range = findSnippetRange(fullText, seg, searchStart);
        if (range) {
          ranges.push(range);
          searchStart = range.end;
        }
      });
      return ranges;
    }

    function renderCleanRawView(targetIndex) {
      if (targetIndex === void 0) targetIndex = null;
      if (!cleanRawView) return;
      var fullText = rawText && rawText.value ? rawText.value : '';
      if (!fullText.trim()) {
        cleanRawView.innerHTML = '<p class="hint" style="padding:12px;">暂无原始需求，请先导入或填写</p>';
        if (cleanRawLocateBtn) cleanRawLocateBtn.disabled = true;
        return;
      }
      var entries = state.cleanEntries || [];
      var highlights = [];
      Object.keys(state.cleanActiveHighlights || {}).forEach(function(key) {
        var idx = Number(key);
        if (!Number.isFinite(idx)) return;
        var entry = entries[idx];
        if (!entry) return;
        var color = cleanHighlightColors[idx % cleanHighlightColors.length];
        var ranges = collectEntryRanges(entry, fullText);
        ranges.forEach(function(range) { highlights.push(Object.assign({}, range, { color: color })); });
      });
      if (typeof targetIndex === 'number' && entries[targetIndex] && !(state.cleanActiveHighlights && state.cleanActiveHighlights[targetIndex])) {
        var selectionRanges = collectEntryRanges(entries[targetIndex], fullText);
        selectionRanges.forEach(function(range) { highlights.push(Object.assign({}, range, { color: '#c7d2fe' })); });
      }
      if (!highlights.length) {
        cleanRawView.innerHTML = '<pre>' + escapeHtmlPreserve(fullText) + '</pre>';
        if (cleanRawLocateBtn) cleanRawLocateBtn.disabled = !(state.cleanEntries && state.cleanEntries.length);
        return;
      }
      highlights.sort(function(a, b) { return a.start - b.start; });
      var html = '';
      var cursor = 0;
      highlights.forEach(function(seg) {
        if (seg.start >= cursor) {
          html += escapeHtmlPreserve(fullText.slice(cursor, seg.start));
          cursor = seg.start;
        }
        if (seg.end > cursor) {
          var snippet = escapeHtmlPreserve(fullText.slice(cursor, seg.end));
          html += '<mark style="background:' + seg.color + ';">' + snippet + '</mark>';
          cursor = seg.end;
        }
      });
      html += escapeHtmlPreserve(fullText.slice(cursor));
      cleanRawView.innerHTML = '<pre>' + html + '</pre>';
      var marker = cleanRawView.querySelector('mark');
      if (marker && marker.scrollIntoView) marker.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (cleanRawLocateBtn) cleanRawLocateBtn.disabled = !(state.cleanEntries && state.cleanEntries.length);
    }

    function formatCleanList(list) {
      if (cleanCore.formatCleanList) return cleanCore.formatCleanList(list, escapeHtml);
      if (!Array.isArray(list) || !list.length) return '-';
      return list.map(function(item) { return escapeHtml(item).replace(/\n/g, '<br>'); }).join('<br>');
    }

    function renderCleanView(refreshEntries) {
      if (refreshEntries === void 0) refreshEntries = true;
      if (!cleanViewContainer) return;
      if (!shouldExpectCleanJson()) {
        cleanViewContainer.innerHTML = '<p class="hint" style="padding:12px;">当前提示词未要求 JSON 结构，列表视图已禁用，可直接参考原始需求。</p>';
        state.cleanEntries = [];
        state.cleanViewSelection = -1;
        state.cleanHighlightAll = false;
        state.cleanActiveHighlights = {};
        if (cleanHighlightAllBtn) {
          cleanHighlightAllBtn.disabled = true;
          cleanHighlightAllBtn.textContent = '全部高亮';
        }
        renderCleanRawView(null);
        return;
      }
      var entries = state.cleanEntries;
      if (refreshEntries) {
        entries = getCleanedEntries();
        state.cleanEntries = entries;
        state.cleanViewSelection = -1;
        state.cleanHighlightAll = false;
        state.cleanActiveHighlights = {};
      }
      if (state.cleanViewSelection >= entries.length) {
        state.cleanViewSelection = -1;
      }
      if (!entries.length) {
        cleanViewContainer.innerHTML = '<p class="hint" style="padding:12px;">暂无清洗数据，请先完成需求清洗</p>';
        renderCleanRawView(null);
        if (cleanRawLocateBtn) cleanRawLocateBtn.disabled = true;
        state.cleanHighlightAll = false;
        if (cleanHighlightAllBtn) {
          cleanHighlightAllBtn.disabled = true;
          cleanHighlightAllBtn.textContent = '全部高亮';
        }
        return;
      }
      var allActive = entries.every(function(_, idx) { return state.cleanActiveHighlights[idx]; });
      state.cleanHighlightAll = allActive;
      if (cleanHighlightAllBtn) {
        cleanHighlightAllBtn.disabled = false;
        cleanHighlightAllBtn.textContent = state.cleanHighlightAll ? '取消全亮' : '全部高亮';
      }
      var active = state.cleanViewSelection;
      var rows = entries.map(function(entry, idx) {
        var desc = entry.description || {};
        var source = entry.descriptionSource || {};
        var rowClass = idx === active ? ' class="active"' : '';
        var summaryText = source.summary || desc.summary || '';
        var summary = summaryText ? escapeHtml(summaryText).replace(/\n/g, '<br>') : '-';
        var toggleColor = cleanHighlightColors[idx % cleanHighlightColors.length];
        var isToggled = Boolean(state.cleanActiveHighlights[idx]);
        var toggleStyle = isToggled
          ? 'color:#fff; background:' + toggleColor + '; border-color:' + toggleColor + ';'
          : 'color:' + toggleColor + '; border-color:' + toggleColor + ';';
        return '' +
          '<tr data-clean-index="' + idx + '"' + rowClass + '>' +
            '<td>' + escapeHtml(entry.feature || ('功能点' + (idx + 1))) + '</td>' +
            '<td>' + (entry.category ? escapeHtml(entry.category) : '-') + '</td>' +
            '<td>' + summary + '</td>' +
            '<td>' + formatCleanList((source.goals && source.goals.length ? source.goals : desc.goals) || []) + '</td>' +
            '<td>' + formatCleanList((source.rules && source.rules.length ? source.rules : desc.rules) || []) + '</td>' +
            '<td>' + formatCleanList((source.constraints && source.constraints.length ? source.constraints : desc.constraints) || []) + '</td>' +
            '<td>' + formatCleanList((source.flows && source.flows.length ? source.flows : desc.flows) || []) + '</td>' +
            '<td>' + formatCleanList((source.values && source.values.length ? source.values : desc.values) || []) + '</td>' +
            '<td>' + formatCleanList((source.configs && source.configs.length ? source.configs : desc.configs) || []) + '</td>' +
            '<td><button type="button" class="clean-toggle' + (isToggled ? ' active' : '') + '" data-clean-toggle="' + idx + '" style="' + toggleStyle + '">需求位置</button></td>' +
          '</tr>';
      }).join('');
      cleanViewContainer.innerHTML = '' +
        '<table class="clean-view-table">' +
          '<thead>' +
            '<tr>' +
              '<th>功能</th>' +
              '<th>类别</th>' +
              '<th>重新整理内容描述</th>' +
              '<th>功能目标</th>' +
              '<th>规则</th>' +
              '<th>约束</th>' +
              '<th>流程</th>' +
              '<th>数值</th>' +
              '<th>配置</th>' +
              '<th>操作</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>';
      renderCleanRawView(typeof active === 'number' ? active : null);
      if (cleanRawLocateBtn) cleanRawLocateBtn.disabled = !entries.length;
    }

    function locateCleanRawSelection() {
      if (!state.cleanEntries.length) {
        setStatus(cleanStatus, '暂无清洗条目可定位', 'warn');
        return;
      }
      var selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setStatus(cleanStatus, '请先在原始需求中选中一段文本', 'warn');
        return;
      }
      var anchorNode = selection.anchorNode;
      var focusNode = selection.focusNode;
      if (!cleanRawView || !cleanRawView.contains(anchorNode) || !cleanRawView.contains(focusNode)) {
        setStatus(cleanStatus, '选中的文本不在原始需求区域', 'warn');
        return;
      }
      var selectedText = selection.toString().trim();
      if (!selectedText) {
        setStatus(cleanStatus, '请先选中有效的文本', 'warn');
        return;
      }
      var normalized = selectedText.replace(/\s+/g, '');
      var entries = state.cleanEntries;
      var matchedIndex = -1;
      entries.some(function(entry, idx) {
        var raw = (entry.rawRequirement || '').replace(/\s+/g, '');
        var desc = stringifyDescription(entry.description || {}).replace(/\s+/g, '');
        if ((raw && raw.indexOf(normalized) !== -1) || (desc && desc.indexOf(normalized) !== -1)) {
          matchedIndex = idx;
          return true;
        }
        return false;
      });
      if (matchedIndex === -1) {
        setStatus(cleanStatus, '未在清洗条目中找到匹配内容', 'warn');
        return;
      }
      state.cleanViewSelection = matchedIndex;
      renderCleanView(false);
      if (cleanViewContainer && cleanViewContainer.scrollIntoView) {
        cleanViewContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    function jumpToCleanHighlightView() {
      if (!shouldExpectCleanJson()) {
        setStatus(cleanStatus, '当前清洗结果非结构化 JSON，无法展示高亮视图', 'warn');
        return;
      }
      var raw = cleanedTextEl ? cleanedTextEl.value.trim() : '';
      if (!raw) {
        setStatus(cleanStatus, '暂无清洗数据，请先执行需求清洗', 'warn');
        return;
      }
      if (!state.cleanEntries.length) {
        var parsed = getCleanedEntries();
        state.cleanEntries = parsed;
      }
      if (!state.cleanEntries.length) {
        setStatus(cleanStatus, '未解析到有效清洗条目', 'warn');
        return;
      }
      state.cleanActiveHighlights = {};
      state.cleanEntries.forEach(function(_, idx) {
        state.cleanActiveHighlights[idx] = true;
      });
      state.cleanHighlightAll = true;
      renderCleanView(false);
      renderCleanRawView(null);
      switchTab('clean');
      var cleanSection = document.querySelector('[data-section-id="clean-view"]');
      if (cleanSection && cleanSection.scrollIntoView) {
        cleanSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    function describeCleanMode(mode) {
      if (!mode) return '';
      if (mode === 'supplement') {
        return '【执行模式】补全缺失项：仅补充对比结果中列出的缺失条目，保持其余条目结构与内容，如需补充请直接在对应条目下添加必要字段，不要重写未提及部分。';
      }
      if (mode === 'reclean') {
        return '【执行模式】重新清洗：结合最新的对比反馈，全面重写所有功能条目，确保结构统一且完整覆盖全部需求。';
      }
      return '【执行模式】' + mode;
    }

    async function runCleaning(extraContext) {
      if (extraContext === void 0) extraContext = {};
      var text = rawText && rawText.value ? rawText.value.trim() : '';
      if (!text) {
        setStatus(cleanStatus, '请先导入或填写原始需求', 'warn');
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入本次需求标识后再进行需求清洗');
      if (!requirementLabel) {
        setStatus(cleanStatus, '已取消需求清洗（需求标识为空）', 'warn');
        return;
      }
      if (cleanedTextEl) cleanedTextEl.value = '';
      state.cleanEntries = [];
      state.cleanViewSelection = -1;
      state.cleanHighlightAll = false;
      state.cleanActiveHighlights = {};
      renderCleanView(false);
      renderCleanRawView(null);
      updateFlowStatus();
      if (runCleanBtn) runCleanBtn.disabled = true;
      setStepInProgress('clean');
      setStatus(cleanStatus, '正在清洗（若接口未配置将使用本地规则粗洗）...', '');
      try {
        var cleaned = '';
        try {
          var model = getAssignedModel('clean');
          var cleanedPrompt = state.assignments && state.assignments.cleanPrompt ? state.assignments.cleanPrompt.trim() : '';
          var prompt = cleanedPrompt || (defaultPrompts.system || '');
          var reasoning = getReasoningForType('clean');
          var temperature = getTemperatureForType('clean');
          var reviewContext = buildReviewClarificationContext();
          var modeInstruction = describeCleanMode(extraContext && extraContext.mode ? String(extraContext.mode) : '');
          var payloadSections = ['【原始需求】\n' + text];
          if (modeInstruction) payloadSections.push(modeInstruction);
          if (reviewContext) payloadSections.push('【需求澄清数据(JSON)】\n' + reviewContext);
          if (extraContext && extraContext.compare) payloadSections.push('【对比完整性结果(JSON)】\n' + extraContext.compare);
          if (extraContext && extraContext.suggestion) payloadSections.push('【用户补充说明】\n' + extraContext.suggestion);
          var payload = payloadSections.join('\n\n');
          var startTime = Date.now();
          cleaned = await callModelWithConfig(model, payload, prompt, reasoning, temperature);
          updateModelTiming(cleanTimingEl, Date.now() - startTime);
          var structured = extractJsonPayload(cleaned);
          if (structured) cleaned = structured;
          setStatus(cleanStatus, '清洗完成（模型返回）', 'ok');
        } catch (err) {
          console.warn('模型清洗失败，改用本地规则', err);
          cleaned = basicClean(text);
          updateModelTiming(cleanTimingEl);
          setStatus(cleanStatus, '模型调用失败：' + (err && err.message ? err.message : '') + '，已使用本地规则', 'warn');
        }
        if (cleanedTextEl) cleanedTextEl.value = wrapTextWithRequirement(cleaned);
        state.cleanEntries = [];
        state.cleanViewSelection = -1;
        state.cleanHighlightAll = false;
        state.cleanActiveHighlights = {};
        renderCleanView();
        renderCleanRawView(null);
      } catch (err) {
        console.error(err);
        updateModelTiming(cleanTimingEl);
        setStatus(cleanStatus, '清洗失败，请重试', 'err');
      } finally {
        if (runCleanBtn) runCleanBtn.disabled = false;
        clearStepInProgress('clean');
        updateFlowStatus();
      }
    }

    async function copyCleaned() {
      var text = cleanedTextEl && cleanedTextEl.value ? cleanedTextEl.value : '';
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        setStatus(cleanStatus, '已复制到剪贴板', 'ok');
      } catch (err) {
        console.error(err);
        setStatus(cleanStatus, '复制失败，请手动选择复制', 'warn');
      }
    }

    function normalizeCleanState() {
      if (!state.cleanActiveHighlights) state.cleanActiveHighlights = {};
      if (!Array.isArray(state.cleanEntries)) state.cleanEntries = [];
      if (typeof state.cleanViewSelection !== 'number') state.cleanViewSelection = -1;
    }

    normalizeCleanState();

    if (rawText && rawText.addEventListener) rawText.addEventListener('input', handleRawInput);
    if (cleanedTextEl && cleanedTextEl.addEventListener) cleanedTextEl.addEventListener('input', handleCleanInput);
    if (splitResultEl && splitResultEl.addEventListener) splitResultEl.addEventListener('input', handleSplitInput);
    if (caseTextEl && caseTextEl.addEventListener) caseTextEl.addEventListener('input', handleCaseTextInput);

    return {
      renderAutoRawInfo: renderAutoRawInfoImpl,
      handleRawInput: handleRawInput,
      handleCleanInput: handleCleanInput,
      handleSplitInput: handleSplitInput,
      handleCaseTextInput: handleCaseTextInput,
      wrapCleanedText: wrapCleanedText,
      shouldExpectCleanJson: shouldExpectCleanJson,
      getCleanedEntries: getCleanedEntries,
      getCleanedRequirementText: getCleanedRequirementText,
      getCleanedTextForModel: getCleanedTextForModel,
      renderCleanView: renderCleanView,
      renderCleanRawView: renderCleanRawView,
      collectEntryRanges: collectEntryRanges,
      locateCleanRawSelection: locateCleanRawSelection,
      jumpToCleanHighlightView: jumpToCleanHighlightView,
      runCleaning: runCleaning,
      copyCleaned: copyCleaned,
    };
  }

  window.app = window.app || {};
  window.app.cleanHandlers = { init: init };
})();
