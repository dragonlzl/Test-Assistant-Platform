 (function() {
  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var dom = ctx.dom || {};
    var utils = ctx.utils || {};
    var handlers = ctx.handlers || {};
    var config = ctx.config || {};

    var sanitizeCasesForExport = ctx.sanitizeCasesForExport || function(list) { return list || []; };
    var wrapDataWithRequirement = ctx.wrapDataWithRequirement || function(data) { return data; };
    var getSafeRequirementSlug = ctx.getSafeRequirementSlug || function() { return 'requirement'; };
    var normalizeRequirementName = ctx.normalizeRequirementName || function(text) { return text || ''; };
    var formatCompactTimestamp = ctx.formatCompactTimestamp || function() { return Date.now().toString(); };
    var defaultPrompts = config.defaultPrompts || {};

    var casesGenerationContainer = dom.casesGenerationContainer;
    var caseGenStatus = dom.caseGenStatus;
    var caseGenTimingEl = dom.caseGenTimingEl;
    var tempExecStatus = dom.tempExecStatus;
    var appendToExistingCasesBtn = dom.appendToExistingCasesBtn || dom.appendToExistingCases;

    var setStatus = ctx.setStatus || function() {};
    var downloadText = handlers.downloadText || function() {};
    var downloadBlob = handlers.downloadBlob || function() {};
    var stripCodeFence = handlers.stripCodeFence || function(text) { return text || ''; };
    var unwrapRequirementPayload = handlers.unwrapRequirementPayload || function(text) { return { payload: text, requirement: '', type: '' }; };
    var extractRequirementLabelFromText = handlers.extractRequirementLabelFromText || function() { return ''; };
    var promptRequirementLabel = handlers.promptRequirementLabel || function() { return ''; };
    var setRequirementLabel = handlers.setRequirementLabel || function() {};
    var ensureRequirementLabel = handlers.ensureRequirementLabel || function() { return ''; };
    var getRequirementLabel = handlers.getRequirementLabel || function() { return ''; };
    var getCleanedTextForModel = handlers.getCleanedTextForModel || function() { return ''; };
    var getModuleSuggestion = handlers.getModuleSuggestion || function(moduleId) {
      return (state.caseGenSuggestions && state.caseGenSuggestions[moduleId]) ? state.caseGenSuggestions[moduleId].trim() : '';
    };
    var getAssignedModel = handlers.getAssignedModel || function() { throw new Error('缺少模型'); };
    var getReasoningForType = handlers.getReasoningForType || function() { return ''; };
    var getTemperatureForType = handlers.getTemperatureForType || function() { return 0.2; };
    var callModelWithConfig = handlers.callModelWithConfig || function() { return Promise.resolve(''); };
    var updateModelTiming = handlers.updateModelTiming || function() {};
    var runConcurrent = handlers.runConcurrent || function(items, concurrency, worker) {
      return Promise.all(items.map(function(item, idx) { return worker(item, idx); }));
    };
    var hasImportedCases = handlers.hasImportedCases || function() { return false; };
    var getImportedCaseObjects = handlers.getImportedCaseObjects || function() { return []; };
    var addImportedCase = handlers.addImportedCase || null;
    var renderImportedCaseList = handlers.renderImportedCaseList || function() {};
    var refreshImportedCaseView = handlers.refreshImportedCaseView || function() {};
    var syncCaseTextWithImports = handlers.syncCaseTextWithImports || function() {};
    var deriveCaseListFromText = handlers.deriveCaseListFromText || function() { return []; };
    var buildXmindPackageFromCases = handlers.buildXmindPackageFromCases || null;
    var createTempExecFile = handlers.createTempExecFile || function() { return null; };
    var ensureTempExecReplacement = handlers.ensureTempExecReplacement || function() { return true; };
    var syncTempExecFocus = handlers.syncTempExecFocus || function() {};
    var persistTempExecState = handlers.persistTempExecState || function() {};
    var setTempExecActive = handlers.setTempExecActive || function() {};
    var switchTab = handlers.switchTab || function() {};
    var scrollElementIntoView = handlers.scrollElementIntoView || function() {};
    var renderCaseGenProgressBoard = handlers.renderCaseGenProgressBoard || function() {};
    var renderCaseModuleProgress = handlers.renderCaseModuleProgress || function() { return ''; };
    var updateCaseProgressView = handlers.updateCaseProgressView || function() {};
    var clearCaseProgress = handlers.clearCaseProgress || function() {};
    var initCaseProgress = handlers.initCaseProgress || function() {};
    var setCaseProgressGroupState = handlers.setCaseProgressGroupState || function() {};
    var setCaseProgressStep = handlers.setCaseProgressStep || function() {};
    var markAllCaseProgressGroups = handlers.markAllCaseProgressGroups || function() {};
    var setCaseModuleRunning = handlers.setCaseModuleRunning || function() {};
    var isCaseModuleRunning = handlers.isCaseModuleRunning || function() { return false; };
    function ensureCaseModuleStatusState() {
      if (!state.caseGenModuleStatus || typeof state.caseGenModuleStatus !== 'object') {
        state.caseGenModuleStatus = {};
      }
      return state.caseGenModuleStatus;
    }
    var syncCaseModuleStatus = handlers.syncCaseModuleStatus || function(moduleId) {
      if (!casesGenerationContainer || !moduleId) return;
      var el = casesGenerationContainer.querySelector('[data-case-status="' + moduleId + '"]');
      var statusInfo = ensureCaseModuleStatusState()[moduleId];
      if (!el) return;
      var text = statusInfo ? statusInfo.text : '';
      var type = statusInfo ? statusInfo.type : '';
      setStatus(el, text, type);
    };
    var setCaseModuleStatus = handlers.setCaseModuleStatus || function(moduleId, text, type) {
      if (!moduleId) return;
      ensureCaseModuleStatusState()[moduleId] = { text: text, type: type || '' };
      syncCaseModuleStatus(moduleId);
      renderCaseGenProgressBoard();
    };
    var clearCaseModuleStatus = handlers.clearCaseModuleStatus || function(moduleId) {
      if (!moduleId) return;
      var statusMap = ensureCaseModuleStatusState();
      delete statusMap[moduleId];
      syncCaseModuleStatus(moduleId);
      renderCaseGenProgressBoard();
    };
    var refreshExportCaseGenButton = handlers.refreshExportCaseGenButton || function() {};
    var setCaseViewHint = handlers.setCaseViewHint || function() {};
    var parseCaseList = handlers.parseCaseList || function() { return []; };
    var extractJsonObjects = handlers.extractJsonObjects || function() { return []; };

    function ensureCaseModuleTimingState() {
      if (!state.caseGenTiming || typeof state.caseGenTiming !== 'object') {
        state.caseGenTiming = {};
      }
      return state.caseGenTiming;
    }
    function getCaseTimingValueEl(moduleId) {
      if (!casesGenerationContainer || !moduleId) return null;
      return casesGenerationContainer.querySelector('[data-case-timing-value="' + moduleId + '"]');
    }
    function syncCaseModuleTiming(moduleId) {
      var map = ensureCaseModuleTimingState();
      var el = getCaseTimingValueEl(moduleId);
      if (!el) return;
      var val = map[moduleId];
      if (!Number.isFinite(val)) {
        el.textContent = '--';
        return;
      }
      el.textContent = (val / 1000).toFixed(2);
    }
    function setCaseModuleTiming(moduleId, durationMs) {
      var map = ensureCaseModuleTimingState();
      if (!Number.isFinite(durationMs)) {
        map[moduleId] = null;
      } else {
        map[moduleId] = durationMs;
      }
      syncCaseModuleTiming(moduleId);
    }

    var escapeHtml = utils.escapeHtml || function(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    var escapeHtmlPreserve = utils.escapeHtmlPreserve || function(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };
    var stringifyCaseField = utils.stringifyCaseField || function(text) {
      if (text === undefined || text === null) return '';
      return text.toString().trim();
    };

    function resolveModuleTitle(name) {
      var text = stringifyCaseField(name || '');
      return text || '未命名模块';
    }

    function normalizeModuleKey(name) {
      var text = stringifyCaseField(name || '');
      return text ? text.toLowerCase() : '未命名模块';
    }

    function normalizeCaseTitle(title) {
      var text = stringifyCaseField(title || '');
      return text ? text.toLowerCase() : '';
    }

    function chunkArray(list, size) {
      if (!Array.isArray(list) || !list.length) return [];
      var chunkSize = Math.max(1, size || 5);
      var result = [];
      for (var i = 0; i < list.length; i += chunkSize) {
        result.push(list.slice(i, i + chunkSize));
      }
      return result;
    }

    function resolveCaseSimilarityConcurrency(count) {
      if (!Number.isFinite(count) || count <= 0) return 1;
      return Math.max(1, Math.min(5, Math.round(count)));
    }

    function parseGeneratedCases(content) {
      var unwrap = unwrapRequirementPayload(content);
      var normalized = typeof unwrap.payload === 'string'
        ? unwrap.payload
        : unwrap.payload
        ? JSON.stringify(unwrap.payload, null, 2)
        : '';
      normalized = (normalized || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/&nbsp;/gi, ' ');
      var parsed = [];
      var hadRecovery = false;
      try {
        parsed = JSON.parse(normalized || '[]');
        if (!Array.isArray(parsed)) parsed = [];
        if (parsed.length) normalized = JSON.stringify(parsed, null, 2);
      } catch (err) {
        parsed = extractJsonObjects(normalized);
        if (parsed.length) {
          normalized = JSON.stringify(parsed, null, 2);
          hadRecovery = true;
        }
      }
      return { parsed: parsed, normalized: normalized, hadRecovery: hadRecovery };
    }

    function renderCaseTable(mod, list, options) {
      options = options || {};
      var selectable = Boolean(options.selectable);
      var moduleId = options.moduleId || '';
      var includeRemark = Boolean(options.showRemark);
      var selection = moduleId ? ensureCaseSelectionSet(moduleId) : new Set();
      var toolbar = selectable
        ? '<div class="caseview-toolbar">' +
            '<button class="secondary" data-export-selected="' + moduleId + '" ' + (selection.size ? '' : 'disabled') + '>导出所选用例</button>' +
            '<button class="secondary" data-xmind-selected="' + moduleId + '" ' + (selection.size ? '' : 'disabled') + '>转 XMind</button>' +
          '</div>'
        : '';
      var headerCheckbox = selectable ? '<th class="check"><input type="checkbox" data-case-select-all="' + moduleId + '"></th>' : '';
      var indexHeader = '<th class="index">编号</th>';
      var remarkHeader = includeRemark ? '<th class="remark">备注</th>' : '';
      var rows = list.map(function(item, idx) {
        var moduleTitle = mod && mod.title ? mod.title : '';
        var moduleName = item.module || moduleTitle || item.module_name || item['模块'] || '模块' + (idx + 1);
        var title = stringifyCaseField(item.title || item.case_title || moduleName);
        var priority = stringifyCaseField(item.priority || item.level);
        var preconditions = stringifyCaseField(item.preconditions || item.precondition);
        var steps = stringifyCaseField(item.steps || item.actions);
        var expected = stringifyCaseField(item.expected || item.result);
        var checkboxCell = selectable
          ? '<td class="check"><input type="checkbox" data-case-select="' + moduleId + '" data-index="' + idx + '" ' + (selection.has(idx) ? 'checked' : '') + '></td>'
          : '';
        var indexCell = '<td class="index">' + (idx + 1) + '</td>';
        var remarkCell = includeRemark ? '<td class="remark">' + escapeHtml(item.remark || '') + '</td>' : '';
        return '' +
          '<tr>' +
            checkboxCell +
            indexCell +
            '<td class="module">' + escapeHtml(moduleName || '-') + '</td>' +
            '<td class="title">' + escapeHtml(title || '-') + '</td>' +
            '<td>' + escapeHtml(priority || '-') + '</td>' +
            '<td>' + escapeHtml((preconditions || '-').replace(/\n/g, '<br>')) + '</td>' +
            '<td>' + escapeHtml((steps || '-').replace(/\n/g, '<br>')) + '</td>' +
            '<td>' + escapeHtml((expected || '-').replace(/\n/g, '<br>')) + '</td>' +
            remarkCell +
          '</tr>';
      }).join('');
      var baseCols = 7 + (selectable ? 1 : 0) + (includeRemark ? 1 : 0);
      var emptyRow = '<tr><td colspan="' + baseCols + '">未解析到有效用例</td></tr>';
      return '' +
        '<table class="table-view">' +
          '<thead>' +
            '<tr>' +
              headerCheckbox +
              indexHeader +
              '<th class="module">模块</th>' +
              '<th class="title">用例标题</th>' +
              '<th>优先级</th>' +
              '<th>前提条件</th>' +
              '<th>操作步骤</th>' +
              '<th>预期结果</th>' +
              remarkHeader +
            '</tr>' +
          '</thead>' +
          '<tbody>' + (rows || emptyRow) + '</tbody>' +
        '</table>' +
        toolbar;
    }

    function updateSupplementButtons(moduleId, hasResult) {
      if (!casesGenerationContainer) return;
      var topupBtn = casesGenerationContainer.querySelector('[data-topup="' + moduleId + '"]');
      var transferBtn = casesGenerationContainer.querySelector('[data-tempexec="' + moduleId + '"]');
      var busy = isCaseModuleRunning(moduleId);
      var selection = state.caseSelections[moduleId];
      var hasSelection = selection && selection.size > 0;
      var topupDisabled = !hasResult || busy;
      var transferDisabled = !hasResult || busy || !hasSelection;
      if (topupBtn) topupBtn.disabled = topupDisabled;
      if (transferBtn) transferBtn.disabled = transferDisabled;
    }

    function ensureCaseSelectionSet(moduleId) {
      if (!state.caseSelections[moduleId]) {
        state.caseSelections[moduleId] = new Set();
      }
      return state.caseSelections[moduleId];
    }

    function refreshCaseSelectionUI(moduleId) {
      if (!casesGenerationContainer) return;
      var container = casesGenerationContainer.querySelector('[data-view-container="' + moduleId + '"]');
      if (!container) return;
      var selection = ensureCaseSelectionSet(moduleId);
      var rowCheckboxes = container.querySelectorAll('input[data-case-select="' + moduleId + '"]');
      rowCheckboxes.forEach(function(cb) {
        cb.checked = selection.has(Number(cb.dataset.index));
      });
      var master = container.querySelector('input[data-case-select-all="' + moduleId + '"]');
      if (master) {
        var total = rowCheckboxes.length;
        master.checked = total > 0 && selection.size === total;
        master.indeterminate = selection.size > 0 && selection.size < total;
      }
      var exportBtn = container.querySelector('button[data-export-selected="' + moduleId + '"]');
      if (exportBtn) exportBtn.disabled = selection.size === 0;
      var xmindBtn = container.querySelector('button[data-xmind-selected="' + moduleId + '"]');
      if (xmindBtn) xmindBtn.disabled = selection.size === 0;
      refreshAppendExistingButton();
    }

    function hasSelectedGeneratedCases() {
      if (!state.caseGenModules || !state.caseGenModules.length) return false;
      for (var i = 0; i < state.caseGenModules.length; i += 1) {
        var mod = state.caseGenModules[i];
        var selection = state.caseSelections[mod.id];
        if (!selection || !selection.size) continue;
        var list = getCaseListForModule(mod.id);
        if (!list.length) continue;
        var matched = false;
        selection.forEach(function(idx) {
          if (!matched && list[idx]) matched = true;
        });
        if (matched) return true;
      }
      return false;
    }

    function refreshAppendExistingButton() {
      if (!appendToExistingCasesBtn) return;
      appendToExistingCasesBtn.disabled = !hasSelectedGeneratedCases();
    }

    function collectSelectedCaseEntries() {
      var results = [];
      if (!state.caseGenModules || !state.caseGenModules.length) return results;
      state.caseGenModules.forEach(function(mod) {
        var selection = state.caseSelections[mod.id];
        if (!selection || !selection.size) return;
        var list = getCaseListForModule(mod.id);
        if (!list.length) return;
        var moduleTitle = resolveModuleTitle(mod && (mod.title || mod.module));
        var selectedList = [];
        selection.forEach(function(idx) {
          if (list[idx]) {
            var cloned = Object.assign({}, list[idx]);
            if (!cloned.module) cloned.module = moduleTitle;
            selectedList.push(cloned);
          }
        });
        if (selectedList.length) {
          results.push({
            moduleId: mod.id,
            moduleKey: normalizeModuleKey(moduleTitle),
            moduleTitle: moduleTitle,
            cases: sanitizeCasesForExport(selectedList),
          });
        }
      });
      return results;
    }

    function getCaseListForModule(moduleId) {
      var raw = state.caseGenResults[moduleId] || '';
      if (!raw.trim()) return [];
      var list = parseCaseList(raw);
      if (list.length) return list;
      try {
        var parsed = JSON.parse(stripCodeFence(raw) || '[]');
        var parsedCasesField = parsed && parsed.cases;
        var parsedDataField = parsed && parsed.data;
        list = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsedCasesField)
          ? parsedCasesField
          : Array.isArray(parsedDataField)
          ? parsedDataField
          : [];
      } catch (err) {
        list = [];
      }
      return list.filter(function(item) { return item && typeof item === 'object'; });
    }

    function filterCasesAgainstImported(module, cases, actionLabel) {
      var moduleTitle = module && module.title ? module.title : '当前模块';
      var moduleId = module && module.id ? module.id : '';
      if (!hasImportedCases() || !cases.length) {
        if (moduleId) clearCaseProgress(moduleId);
        return Promise.resolve({ list: cases, removed: 0, hadError: false, skipped: true });
      }
      var importedList = getImportedCaseObjects();
      if (!importedList.length) {
        if (moduleId) clearCaseProgress(moduleId);
        return Promise.resolve({ list: cases, removed: 0, hadError: false, skipped: true });
      }
      var model;
      try {
        model = getAssignedModel('casefilter');
      } catch (err) {
        setCaseModuleStatus(moduleId, '【' + moduleTitle + '】' + actionLabel + '完成，但未配置“用例相似对比”模型，暂未过滤重复项', 'warn');
        if (moduleId) clearCaseProgress(moduleId);
        return Promise.resolve({ list: cases, removed: 0, hadError: false, skipped: true });
      }
      var prompt = state.assignments && state.assignments.caseFilterPrompt
        ? state.assignments.caseFilterPrompt.trim()
        : (defaultPrompts.casefilter || '');
      var reasoning = getReasoningForType('casefilter');
      var temperature = getTemperatureForType('casefilter');
      var baseCases = sanitizeCasesForExport(importedList);
      var baseJson = JSON.stringify(baseCases, null, 2);
      var groups = chunkArray(cases, 5);
      var concurrency = resolveCaseSimilarityConcurrency(groups.length);
      var hadError = false;
      if (moduleId) {
        initCaseProgress(moduleId, groups);
        setCaseProgressStep(moduleId, 'dedupe', 'running');
        setCaseModuleStatus(moduleId, '【' + moduleTitle + '】' + actionLabel + '完成，正在剔除重复用例（' + groups.length + ' 组）...', '');
      }
      return runConcurrent(groups, concurrency, function(group, idx) {
        if (!group || !group.length) return Promise.resolve([]);
        if (moduleId) setCaseProgressGroupState(moduleId, idx, 'running');
        var candidateJson = JSON.stringify(sanitizeCasesForExport(group), null, 2);
        var userContent = '模块：' + moduleTitle + '\n\n导入用例(JSON)：' + baseJson + '\n\n生成用例候选(JSON)：' + candidateJson + '\n\n请删除与导入用例重复或高度相似的候选，仅返回保留的候选 JSON 数组，不需要解释或额外文本。';
        return callModelWithConfig(model, userContent, prompt, reasoning, temperature).then(function(content) {
          var parsed = parseGeneratedCases(content).parsed;
          if (moduleId) setCaseProgressGroupState(moduleId, idx, 'done');
          return parsed.length ? parsed : [];
        }).catch(function(err) {
          console.warn('用例相似对比失败', err);
          hadError = true;
          if (moduleId) setCaseProgressGroupState(moduleId, idx, 'error');
          return group;
        });
      }).then(function(filteredGroups) {
        var flattened = filteredGroups.reduce(function(sum, group) { return sum.concat(group); }, []);
        var removed = Math.max(0, cases.length - flattened.length);
        if (moduleId) {
          setCaseProgressStep(moduleId, 'dedupe', hadError ? 'error' : 'done');
          var hint = hadError
            ? '【' + moduleTitle + '】重复用例剔除部分失败，请检查结果'
            : '【' + moduleTitle + '】重复用例剔除完成';
          setCaseModuleStatus(moduleId, hint, hadError ? 'warn' : 'ok');
        }
        return { list: flattened, removed: removed, hadError: hadError, skipped: false };
      });
    }

    function renderCaseGeneration() {
      if (!casesGenerationContainer) return;
      if (!state.caseGenModules.length) {
        casesGenerationContainer.innerHTML = '<p class="hint">请先在“测试模块拆分”中生成模块（JSON），然后点击“生成用例”进入本页。</p>';
        refreshExportCaseGenButton();
        refreshAppendExistingButton();
        return;
      }
      casesGenerationContainer.innerHTML = state.caseGenModules.map(function(mod, idx) {
        var rawResult = (state.caseGenResults[mod.id] || '').trim();
        var hasResult = Boolean(rawResult && !/^\[\s*\]$/.test(rawResult));
        var moduleBusy = isCaseModuleRunning(mod.id);
        var transferDisabled = !hasResult || moduleBusy;
        var generateLabel = moduleBusy ? '生成中...' : '生成用例';
        var resultInfo = parseGeneratedCases(state.caseGenResults[mod.id] || '');
        var resultText = resultInfo.normalized || '';
        var timing = ensureCaseModuleTimingState()[mod.id];
        var timingText = Number.isFinite(timing) ? (timing / 1000).toFixed(2) : '--';
        return '' +
        '<div class="usecase-card" data-module-id="' + mod.id + '">' +
          '<h3>' + (idx + 1) + '. ' + mod.title + '</h3>' +
          '<div class="actions">' +
            '<button class="secondary" data-generate="' + mod.id + '" ' + (moduleBusy ? 'disabled' : '') + '>' + generateLabel + '</button>' +
            '<button class="secondary" data-view="' + mod.id + '" ' + (hasResult ? '' : 'disabled') + '>用例视图</button>' +
            '<button class="secondary" data-export="' + mod.id + '" ' + (hasResult ? '' : 'disabled') + '>导出json</button>' +
            '<button class="pill primary" data-tempexec="' + mod.id + '" ' + (transferDisabled ? 'disabled' : '') + '>转到用例执行</button>' +
            '<button class="secondary" data-import="' + mod.id + '">导入json</button>' +
            '<button class="secondary" data-clear="' + mod.id + '" ' + (hasResult ? '' : 'disabled') + '>清除用例</button>' +
          '</div>' +
          '<p class="hint timing" data-case-timing="' + mod.id + '">模型用时：<strong data-case-timing-value="' + mod.id + '">' + timingText + '</strong> 秒</p>' +
          '<p class="status" data-case-status="' + mod.id + '"></p>' +
          '<div class="case-progress" data-progress="' + mod.id + '">' + renderCaseModuleProgress(mod.id) + '</div>' +
          '<textarea data-result="' + mod.id + '" placeholder="JSON 测试用例输出..." readonly>' + resultText + '</textarea>' +
          '<input type="file" data-import-input="' + mod.id + '" accept=".txt,.json" hidden>' +
          '<div class="caseview hidden" data-view-container="' + mod.id + '"></div>' +
          '<div class="suggestion-panel">' +
            '<label>生成建议</label>' +
            '<textarea data-suggestion="' + mod.id + '" placeholder="可输入补充说明/限制条件...">' + escapeHtml(state.caseGenSuggestions[mod.id] || '') + '</textarea>' +
            '<div class="actions suggestion-actions">' +
              '<button class="secondary" data-topup="' + mod.id + '" ' + (hasResult ? '' : 'disabled') + '>补全生成</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
      state.caseGenModules.forEach(function(mod) {
        syncCaseModuleStatus(mod.id);
        syncCaseModuleTiming(mod.id);
        updateCaseProgressView(mod.id);
        var rawResult = (state.caseGenResults[mod.id] || '').trim();
        var hasResult = Boolean(rawResult && !/^\[\s*\]$/.test(rawResult));
        updateSupplementButtons(mod.id, hasResult);
      });
      refreshExportCaseGenButton();
      renderCaseGenProgressBoard();
      refreshAppendExistingButton();
    }

    async function generateCasesForModule(moduleId) {
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return;
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再生成用例');
      if (!requirementLabel) {
        setCaseModuleStatus(moduleId, '已取消生成：需求标识为空', 'warn');
        return;
      }
      var cleanedContext = getCleanedTextForModel();
      var suggestion = getModuleSuggestion(moduleId);
      var model;
      try {
        model = getAssignedModel('casegen');
      } catch (err) {
        setCaseModuleStatus(moduleId, err.message, 'warn');
        updateModelTiming(caseGenTimingEl);
        return;
      }
      setCaseModuleTiming(moduleId);
      setCaseModuleRunning(moduleId, true);
      var textarea = casesGenerationContainer && casesGenerationContainer.querySelector('textarea[data-result="' + moduleId + '"]');
      if (textarea) textarea.value = '';
      var generateBtn = casesGenerationContainer && casesGenerationContainer.querySelector('button[data-generate="' + moduleId + '"]');
      var topupBtn = casesGenerationContainer && casesGenerationContainer.querySelector('button[data-topup="' + moduleId + '"]');
      if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.textContent = '生成中...';
      }
      if (topupBtn) topupBtn.disabled = true;
      setCaseModuleStatus(moduleId, '正在生成【' + mod.title + '】的测试用例...', '');
      clearCaseProgress(moduleId);
      updateSupplementButtons(moduleId, false);
      var hasResult = false;
      var overallStart = Date.now();
      try {
        var caseGenPromptValue = state.assignments && state.assignments.caseGenPrompt ? state.assignments.caseGenPrompt.trim() : '';
        var prompt = caseGenPromptValue || defaultPrompts.casegen || '';
        var ref = {
          module: mod.title,
          key_scenarios: mod.scenarios,
          test_points: mod.points,
          coupled_modules: mod.coupled,
        };
        var suggestionText = suggestion ? '\n\n用户附加要求：' + suggestion : '';
        var baseContext = cleanedContext
          ? '清洗后需求上下文：\n' + cleanedContext + '\n\n目标测试模块（JSON）：' + JSON.stringify(ref)
          : '测试模块信息（JSON）：' + JSON.stringify(ref);
        var userContent = baseContext + suggestionText + '\n请输出符合提示词要求的 JSON 数组。';
        var reasoning = getReasoningForType('casegen');
        var temperature = getTemperatureForType('casegen');
        var startTime = Date.now();
        var content = await callModelWithConfig(model, userContent, prompt, reasoning, temperature);
        var durationMs = Date.now() - startTime;
        updateModelTiming(caseGenTimingEl, durationMs);
        setCaseModuleTiming(moduleId, durationMs);
        var parsedInfo = parseGeneratedCases(content);
        var parsed = parsedInfo.parsed;
        var normalized = parsedInfo.normalized;
        var hadRecovery = parsedInfo.hadRecovery;
        if (!parsed.length) {
          setCaseModuleStatus(moduleId, '生成结果为空，请重新生成', 'warn');
          state.caseGenResults[moduleId] = '[]';
          state.caseSelections[moduleId] = new Set();
          if (textarea) textarea.value = '[]';
          if (state.caseGenProgress[moduleId]) {
            markAllCaseProgressGroups(moduleId, 'error');
            setCaseProgressStep(moduleId, 'dedupe', 'error');
            setCaseProgressStep(moduleId, 'finalize', 'error');
          }
          hasResult = false;
        } else {
          var dedupInfo = { list: parsed, removed: 0, hadError: false, skipped: true };
          if (hasImportedCases()) {
            dedupInfo = await filterCasesAgainstImported(mod, parsed, '用例生成');
          } else {
            initCaseProgress(moduleId, chunkArray(parsed, 5));
            markAllCaseProgressGroups(moduleId, 'done');
            setCaseProgressStep(moduleId, 'dedupe', 'done');
          }
          if (!dedupInfo.skipped) {
            setCaseProgressStep(moduleId, 'finalize', 'running');
          }
          var filteredList = dedupInfo.list || [];
          var removedByFilter = dedupInfo.removed || 0;
          var filterHadError = dedupInfo.hadError || false;
          if (!filteredList.length) {
            setCaseModuleStatus(moduleId, '生成的用例与导入用例重复，未保留新的用例', 'warn');
            state.caseGenResults[moduleId] = '[]';
            state.caseSelections[moduleId] = new Set();
            if (textarea) textarea.value = '[]';
            hasResult = false;
            if (!dedupInfo.skipped) setCaseProgressStep(moduleId, 'finalize', 'error');
          } else {
            var finalJson = dedupInfo.skipped ? normalized : JSON.stringify(filteredList, null, 2);
            state.caseGenResults[moduleId] = finalJson;
            state.caseSelections[moduleId] = new Set();
            if (textarea) textarea.value = finalJson;
            var durationSec = Math.max(1, Math.round((Date.now() - overallStart) / 1000));
            var parts = ['【' + mod.title + '】用例已生成 ' + filteredList.length + ' 条', '耗时 ' + durationSec + ' 秒'];
            if (removedByFilter) parts.push('剔除 ' + removedByFilter + ' 条重复用例');
            var message = hadRecovery
              ? parts.join('，') + '（检测到部分数据不完整，已保留完整条目）'
              : parts.join('，');
            var statusType = hadRecovery || filterHadError ? 'warn' : 'ok';
            setCaseModuleStatus(moduleId, message, statusType);
            hasResult = true;
            setCaseProgressStep(moduleId, 'finalize', 'done');
          }
        }
        var viewBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-view="' + moduleId + '"]');
        if (viewBtn) {
          viewBtn.disabled = !hasResult;
          viewBtn.textContent = '用例视图';
        }
        var viewContainer = casesGenerationContainer && casesGenerationContainer.querySelector('[data-view-container="' + moduleId + '"]');
        if (viewContainer) {
          viewContainer.classList.remove('visible');
          viewContainer.classList.add('hidden');
          viewContainer.innerHTML = '';
          refreshCaseSelectionUI(moduleId);
        }
        var exportBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-export="' + moduleId + '"]');
        if (exportBtn) exportBtn.disabled = !hasResult;
        var clearBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-clear="' + moduleId + '"]');
        if (clearBtn) clearBtn.disabled = !hasResult;
      } catch (err) {
        console.error(err);
        setCaseModuleStatus(moduleId, '生成失败：' + err.message, 'err');
        if (state.caseGenProgress[moduleId]) {
          setCaseProgressStep(moduleId, 'finalize', 'error');
        }
        updateModelTiming(caseGenTimingEl);
        setCaseModuleTiming(moduleId);
      } finally {
        if (generateBtn) {
          generateBtn.disabled = false;
          generateBtn.textContent = '生成用例';
        }
        if (topupBtn) topupBtn.disabled = !hasResult;
        setCaseModuleRunning(moduleId, false);
        updateSupplementButtons(moduleId, hasResult);
        renderCaseGeneration();
      }
    }

    async function topUpCasesForModule(moduleId) {
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return;
      var existingList = getCaseListForModule(moduleId);
      if (!existingList.length) {
        var modTitle = mod && mod.title ? mod.title : '';
        setCaseModuleStatus(moduleId, '【' + modTitle + '】暂无原始用例，无法补全', 'warn');
        return;
      }
      var cleanedContext = getCleanedTextForModel();
      var suggestion = getModuleSuggestion(moduleId);
      var model;
      try {
        model = getAssignedModel('casegen');
      } catch (err) {
        setCaseModuleStatus(moduleId, err.message, 'warn');
        updateModelTiming(caseGenTimingEl);
        return;
      }
      setCaseModuleTiming(moduleId);
      setCaseModuleRunning(moduleId, true);
      updateSupplementButtons(moduleId, false);
      var topupBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-topup="' + moduleId + '"]');
      var generateBtn = casesGenerationContainer && casesGenerationContainer.querySelector('button[data-generate="' + moduleId + '"]');
      if (topupBtn) {
        topupBtn.disabled = true;
        topupBtn.textContent = '补全中...';
      }
      if (generateBtn) generateBtn.disabled = true;
      setCaseModuleStatus(moduleId, '正在补全【' + mod.title + '】的测试用例...', '');
      clearCaseProgress(moduleId);
      var overallStart = Date.now();
      try {
        var caseGenPromptValue = state.assignments && state.assignments.caseGenPrompt ? state.assignments.caseGenPrompt.trim() : '';
        var prompt = caseGenPromptValue || defaultPrompts.casegen || '';
        var ref = {
          module: mod.title,
          key_scenarios: mod.scenarios,
          test_points: mod.points,
          coupled_modules: mod.coupled,
        };
        var baseContext = cleanedContext
          ? '清洗后需求上下文：\n' + cleanedContext + '\n\n目标测试模块（JSON）：' + JSON.stringify(ref)
          : '测试模块信息（JSON）：' + JSON.stringify(ref);
        var existingJson = JSON.stringify(sanitizeCasesForExport(existingList));
        var suggestionText = suggestion ? '\n\n额外要求：' + suggestion : '';
        var userContent = baseContext + '\n\n已有用例(JSON)：' + existingJson + '\n请在不重复的前提下补充新的测试用例，仅返回新增用例的 JSON 数组。' + suggestionText;
        var reasoning = getReasoningForType('casegen');
        var temperature = getTemperatureForType('casegen');
        var startTime = Date.now();
        var content = await callModelWithConfig(model, userContent, prompt, reasoning, temperature);
        var durationMs = Date.now() - startTime;
        updateModelTiming(caseGenTimingEl, durationMs);
        setCaseModuleTiming(moduleId, durationMs);
        var parsedInfo = parseGeneratedCases(content);
        var parsed = parsedInfo.parsed;
        var hadRecovery = parsedInfo.hadRecovery;
        if (!parsed.length) {
          setCaseModuleStatus(moduleId, '未补充到新的用例，请调整提示后重试', 'warn');
          if (state.caseGenProgress[moduleId]) {
            markAllCaseProgressGroups(moduleId, 'error');
            setCaseProgressStep(moduleId, 'dedupe', 'error');
            setCaseProgressStep(moduleId, 'finalize', 'error');
          }
        } else {
          var dedupInfo = { list: parsed, removed: 0, hadError: false, skipped: true };
          if (hasImportedCases()) {
            dedupInfo = await filterCasesAgainstImported(mod, parsed, '补全');
          } else {
            initCaseProgress(moduleId, chunkArray(parsed, 5));
            markAllCaseProgressGroups(moduleId, 'done');
            setCaseProgressStep(moduleId, 'dedupe', 'done');
          }
          if (!dedupInfo.skipped) setCaseProgressStep(moduleId, 'finalize', 'running');
          var filteredList = dedupInfo.list || [];
          if (!filteredList.length) {
            setCaseModuleStatus(moduleId, '补全的用例与导入用例重复，已全部过滤', 'warn');
            setCaseProgressStep(moduleId, 'finalize', 'error');
          } else {
            var appended = filteredList.map(function(item) { return Object.assign({}, item, { remark: '后补' }); });
            var updatedList = existingList.concat(appended);
            state.caseGenResults[moduleId] = JSON.stringify(updatedList, null, 2);
            var textarea = casesGenerationContainer && casesGenerationContainer.querySelector('textarea[data-result="' + moduleId + '"]');
            if (textarea) textarea.value = state.caseGenResults[moduleId];
            if (!state.caseSelections[moduleId]) {
              state.caseSelections[moduleId] = new Set();
            } else {
              var validSelection = new Set();
              updatedList.forEach(function(_, idx) {
                if (state.caseSelections[moduleId].has(idx)) validSelection.add(idx);
              });
              state.caseSelections[moduleId] = validSelection;
            }
            var durationSec = Math.max(1, Math.round((Date.now() - overallStart) / 1000));
            var parts = ['【' + mod.title + '】已补全 ' + appended.length + ' 条用例', '耗时 ' + durationSec + ' 秒'];
            if (dedupInfo.removed) {
              parts.push('剔除 ' + dedupInfo.removed + ' 条重复用例');
            }
            setCaseModuleStatus(
              moduleId,
              hadRecovery ? parts.join('，') + '（检测到结构异常，已保留有效条目）' : parts.join('，'),
              hadRecovery || dedupInfo.hadError ? 'warn' : 'ok'
            );
            var viewContainer = casesGenerationContainer && casesGenerationContainer.querySelector('[data-view-container="' + moduleId + '"]');
            if (viewContainer) {
              viewContainer.classList.remove('visible');
              viewContainer.classList.add('hidden');
              viewContainer.innerHTML = '';
              refreshCaseSelectionUI(moduleId);
            }
            setCaseProgressStep(moduleId, 'finalize', 'done');
            updateSupplementButtons(moduleId, true);
          }
        }
      } catch (err) {
        console.error(err);
        setCaseModuleStatus(moduleId, '补全失败：' + err.message, 'err');
        if (state.caseGenProgress[moduleId]) {
          setCaseProgressStep(moduleId, 'finalize', 'error');
        }
        updateModelTiming(caseGenTimingEl);
        setCaseModuleTiming(moduleId);
      } finally {
        if (topupBtn) {
          topupBtn.disabled = false;
          topupBtn.textContent = '补全生成';
        }
        if (generateBtn) generateBtn.disabled = false;
        setCaseModuleRunning(moduleId, false);
        updateSupplementButtons(moduleId, getCaseListForModule(moduleId).length > 0);
        renderCaseGeneration();
      }
    }

    function exportCaseGenerationResults() {
      if (!casesGenerationContainer) return;
      if (!state.caseGenModules || !state.caseGenModules.length) {
        setStatus(caseGenStatus, '请先生成测试用例', 'warn');
        return;
      }
      try {
        var requirementLabel = ensureRequirementLabel('请输入需求标识后再导出用例');
        if (!requirementLabel) {
          setStatus(caseGenStatus, '已取消导出（需求标识为空）', 'warn');
          return;
        }
        var exported = exportAllModulesData(state.caseGenModules, state.caseGenResults, requirementLabel);
        downloadText(exported.fileName, JSON.stringify(exported.payload, null, 2));
        setStatus(caseGenStatus, '已导出 ' + exported.count + ' 个模块用例', 'ok');
      } catch (err) {
        setStatus(caseGenStatus, err.message || '导出失败', 'err');
      }
    }

    function exportModuleCases(moduleId) {
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return;
      var list = getCaseListForModule(moduleId);
      if (!list.length) {
        setStatus(caseGenStatus, '【' + mod.title + '】还没有用例，无法导出', 'warn');
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再导出用例');
      if (!requirementLabel) {
        setStatus(caseGenStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      try {
        var rawResult = state.caseGenResults[moduleId] || JSON.stringify(list, null, 2);
        var exported = exportSingleModuleData(mod, rawResult, requirementLabel);
        var content = '#CASE_MODULE:' + mod.title + '\n' + JSON.stringify(exported.payload, null, 2);
        downloadText(exported.fileName, content);
        setStatus(caseGenStatus, '已导出【' + mod.title + '】用例（' + exported.count + ' 条）', 'ok');
      } catch (err) {
        setStatus(caseGenStatus, err.message || '导出失败', 'err');
      }
    }

    async function importModuleCases(moduleId, file) {
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod || !file) return;
      var moduleTitle = mod.title || '当前模块';
      try {
        var text = await file.text();
        var parts = text.split('\n');
        var firstLine = parts[0];
        var rest = parts.slice(1);
        if (!(firstLine && firstLine.indexOf('#CASE_MODULE:') === 0)) {
          setCaseModuleStatus(moduleId, '导入文件缺少 CASE MODULE 标识', 'err');
          return;
        }
        var tag = firstLine.replace('#CASE_MODULE:', '').trim();
        if (tag && tag !== mod.title) {
          setCaseModuleStatus(moduleId, '导入文件属于【' + tag + '】，与【' + moduleTitle + '】不匹配', 'err');
          return;
        }
        var payload = rest.join('\n').trim();
        var parsedLabel = extractRequirementLabelFromText(payload);
        if (!parsedLabel) {
          var reqMatch = payload.match(/"requir[e]?ment"\s*:\s*"([^"]+)"/i);
          if (reqMatch && reqMatch[1]) parsedLabel = normalizeRequirementName(reqMatch[1]);
        }
        if (parsedLabel) {
          setRequirementLabel(parsedLabel, 'import');
        } else {
          var ensured = promptRequirementLabel('请输入本次需求标识后再导入用例');
          if (!ensured) {
            setCaseModuleStatus(moduleId, '已取消导入（需求标识为空）', 'warn');
            return;
          }
        }
        if (!payload) {
          setCaseModuleStatus(moduleId, '导入文件内容为空', 'warn');
          return;
        }
        var normalized = stripCodeFence(payload);
        var parsedInfo = parseGeneratedCases(normalized);
        normalized = parsedInfo.normalized || normalized;
        state.caseGenResults[moduleId] = normalized;
        state.caseSelections[moduleId] = new Set();
        var textarea = casesGenerationContainer && casesGenerationContainer.querySelector('textarea[data-result="' + moduleId + '"]');
        if (textarea) textarea.value = normalized;
        var viewBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-view="' + moduleId + '"]');
        if (viewBtn) {
          viewBtn.disabled = false;
          viewBtn.textContent = '用例视图';
        }
        var exportBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-export="' + moduleId + '"]');
        if (exportBtn) exportBtn.disabled = false;
        var clearBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-clear="' + moduleId + '"]');
        if (clearBtn) clearBtn.disabled = false;
        var viewContainer = casesGenerationContainer && casesGenerationContainer.querySelector('[data-view-container="' + moduleId + '"]');
        if (viewContainer) {
          viewContainer.classList.remove('visible');
          viewContainer.classList.add('hidden');
          viewContainer.innerHTML = '';
        }
        updateSupplementButtons(moduleId, true);
        setCaseModuleStatus(moduleId, '已导入【' + moduleTitle + '】的用例', 'ok');
        refreshAppendExistingButton();
      } catch (err) {
        console.error(err);
        setCaseModuleStatus(moduleId, '导入失败：' + err.message, 'err');
      }
    }

    async function appendSelectedCasesToImported() {
      var selectedEntries = collectSelectedCaseEntries();
      if (!selectedEntries.length) {
        setStatus(caseGenStatus, '请先在用例视图勾选需要追加的用例', 'warn');
        refreshAppendExistingButton();
        return;
      }
      if (!hasImportedCases()) {
        setStatus(caseGenStatus, '请先在“功能工作流”导入 XMind/JSON 测试用例后再追加', 'warn');
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再追加到已有用例');
      if (!requirementLabel) {
        setStatus(caseGenStatus, '已取消追加（需求标识为空）', 'warn');
        return;
      }
      var importedList = sanitizeCasesForExport(getImportedCaseObjects());
      if (!importedList.length) {
        setStatus(caseGenStatus, '未获取到已导入的用例内容，请重新导入后再试', 'warn');
        return;
      }
      var normalizedImported = [];
      var moduleBuckets = {};
      importedList.forEach(function(item) {
        var moduleTitle = resolveModuleTitle(item.module || item.module_name || item['模块']);
        var key = normalizeModuleKey(moduleTitle);
        var cloned = Object.assign({}, item);
        cloned.module = cloned.module || moduleTitle;
        normalizedImported.push(cloned);
        if (!moduleBuckets[key]) moduleBuckets[key] = { title: moduleTitle, list: [] };
        moduleBuckets[key].list.push(cloned);
      });

      var additions = [];
      var duplicateCount = 0;
      var moduleCount = 0;
      selectedEntries.forEach(function(entry) {
        var bucketKey = entry.moduleKey;
        var bucket = moduleBuckets[bucketKey];
        if (!bucket) {
          bucket = { title: entry.moduleTitle, list: [] };
          moduleBuckets[bucketKey] = bucket;
        }
        moduleCount += 1;
        var existingTitleSet = new Set();
        bucket.list.forEach(function(item) {
          var key = normalizeCaseTitle(item.title || item.case_title || item['用例标题']);
          if (key) existingTitleSet.add(key);
        });
        entry.cases.forEach(function(item) {
          var titleKey = normalizeCaseTitle(item.title || item.case_title || item['用例标题']);
          if (titleKey && existingTitleSet.has(titleKey)) {
            duplicateCount += 1;
            return;
          }
          var mergedItem = Object.assign({}, item);
          mergedItem.module = resolveModuleTitle(bucket.title || entry.moduleTitle);
          additions.push(mergedItem);
          bucket.list.push(mergedItem);
          if (titleKey) existingTitleSet.add(titleKey);
        });
      });

      if (!additions.length) {
        var emptyMsg = duplicateCount
          ? '用例已经包含将要导入的用例，无需重复新增'
          : '未找到可追加的用例，请重新选择';
        setStatus(caseGenStatus, emptyMsg, 'warn');
        return;
      }

      var confirmParts = ['将向已有用例追加 ' + additions.length + ' 条新用例'];
      if (moduleCount) confirmParts.push('涉及 ' + moduleCount + ' 个模块');
      if (duplicateCount) confirmParts.push('其余 ' + duplicateCount + ' 条因标题重复将跳过');
      var confirmed = window.confirm(confirmParts.join('，') + '，是否继续？');
      if (!confirmed) {
        setStatus(caseGenStatus, '已取消追加到已有用例', 'warn');
        return;
      }

      var mergedList = normalizedImported.concat(additions);
      var appendedName = requirementLabel ? '追加用例-' + requirementLabel : '追加用例';
      try {
        var additionsText = '';
        try {
          additionsText = JSON.stringify(wrapDataWithRequirement(additions), null, 2);
        } catch (errWrap) {
          additionsText = JSON.stringify(additions, null, 2);
        }
        if (addImportedCase) {
          addImportedCase(appendedName, additionsText, additions);
        } else {
          if (!state.importedCases) state.importedCases = [];
          state.importedCases.push({
            id: 'case-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2),
            name: appendedName,
            text: additionsText,
            list: additions.slice(),
          });
          renderImportedCaseList();
          syncCaseTextWithImports();
          refreshImportedCaseView();
        }
        var entryName = requirementLabel ? '导入用例-' + requirementLabel : '导入用例';
        var entry = createTempExecFile(entryName, mergedList, 'current', null, null, requirementLabel);
        if (!entry) {
          setStatus(caseGenStatus, '未构建出可同步的用例，请检查数据格式', 'err');
          return;
        }
        if (!ensureTempExecReplacement(entry)) {
          setStatus(caseGenStatus, '已取消转到用例执行', 'warn');
          return;
        }
        state.tempExecFiles.push(entry);
        syncTempExecFocus();
        state.tempExecPages[entry.id] = 0;
        persistTempExecState();
        setTempExecActive(entry.id);
        if (tempExecStatus) {
          setStatus(tempExecStatus, '【' + entry.name + '】已同步 ' + entry.cases.length + ' 条用例', 'ok');
        }
        var statusParts = ['已追加 ' + additions.length + ' 条用例并同步到用例执行'];
        if (duplicateCount) statusParts.push('含 ' + duplicateCount + ' 条重复已跳过');
        setStatus(caseGenStatus, statusParts.join('，'), duplicateCount ? 'warn' : 'ok');
        switchTab('tempexec');
        var tempViewSection = document.querySelector('[data-section-id="tempexec-view"]');
        if (tempViewSection) scrollElementIntoView(tempViewSection, 'smooth', 140);
      } catch (err) {
        console.error(err);
        setStatus(caseGenStatus, '追加失败：' + err.message, 'err');
      }
    }

    async function transferModuleToTempExec(moduleId) {
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return;
      if (isCaseModuleRunning(moduleId)) {
        setStatus(caseGenStatus, '【' + mod.title + '】正在生成，请稍后再试', 'warn');
        return;
      }
      var list = getCaseListForModule(moduleId);
      var selection = state.caseSelections[moduleId];
      if (!list.length) {
        setStatus(caseGenStatus, '【' + mod.title + '】暂无可转移的用例', 'warn');
        updateSupplementButtons(moduleId, false);
        return;
      }
      if (!selection || !selection.size) {
        setStatus(caseGenStatus, '请先在用例视图中勾选需要转移的用例', 'warn');
        updateSupplementButtons(moduleId, true);
        return;
      }
      var selectedList = list.filter(function(_, idx) { return selection.has(idx); });
      if (!selectedList.length) {
        setStatus(caseGenStatus, '当前未勾选可转移的用例', 'warn');
        updateSupplementButtons(moduleId, true);
        return;
      }
      var transferBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-tempexec="' + moduleId + '"]');
      var originalLabel = transferBtn ? transferBtn.textContent : '';
      if (transferBtn) {
        transferBtn.disabled = true;
        transferBtn.textContent = '准备中...';
      }
      try {
        if (!buildXmindPackageFromCases) throw new Error('缺少 XMind 导出依赖');
        var exported = await buildXmindPackageFromCases(selectedList, mod.title, getRequirementLabel(true));
        downloadBlob(exported.fileName, exported.blob);
        var entryName = mod.title || '测试用例';
        var entry = createTempExecFile(entryName, selectedList, 'current', null, null, getRequirementLabel(true));
        if (!entry) {
          setStatus(caseGenStatus, '转移失败：未构建出有效的执行用例', 'err');
          return;
        }
        if (!ensureTempExecReplacement(entry)) {
          setStatus(caseGenStatus, '已取消转到用例执行', 'warn');
          return;
        }
        state.tempExecFiles.push(entry);
        syncTempExecFocus();
        state.tempExecPages[entry.id] = 0;
        persistTempExecState();
        setTempExecActive(entry.id);
        if (tempExecStatus) {
          setStatus(tempExecStatus, '【' + entry.name + '】已导入 ' + entry.cases.length + ' 条用例', 'ok');
        }
        setStatus(caseGenStatus, '已导出 ' + exported.count + ' 条用例为 XMind，并同步到用例执行', 'ok');
        switchTab('tempexec');
        var tempViewSection = document.querySelector('[data-section-id="tempexec-view"]');
        if (tempViewSection) scrollElementIntoView(tempViewSection, 'smooth', 140);
      } catch (err) {
        console.error(err);
        setStatus(caseGenStatus, '转到用例执行失败：' + err.message, 'err');
      } finally {
        if (transferBtn) {
          transferBtn.textContent = originalLabel || '转到用例执行';
        }
        updateSupplementButtons(moduleId, getCaseListForModule(moduleId).length > 0);
      }
    }

    function clearModuleCases(moduleId) {
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      if (!mod) return;
      if (!state.caseGenResults[moduleId]) {
        setCaseModuleStatus(moduleId, '【' + mod.title + '】暂无可清除的用例', 'warn');
        return;
      }
      var confirmed = window.confirm('确定要清除【' + mod.title + '】的用例吗？');
      if (!confirmed) return;
      delete state.caseGenResults[moduleId];
      delete state.caseSelections[moduleId];
      var textarea = casesGenerationContainer && casesGenerationContainer.querySelector('textarea[data-result="' + moduleId + '"]');
      if (textarea) textarea.value = '';
      var viewBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-view="' + moduleId + '"]');
      if (viewBtn) {
        viewBtn.disabled = true;
        viewBtn.textContent = '用例视图';
      }
      var exportBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-export="' + moduleId + '"]');
      if (exportBtn) exportBtn.disabled = true;
      var clearBtn = casesGenerationContainer && casesGenerationContainer.querySelector('[data-clear="' + moduleId + '"]');
      if (clearBtn) clearBtn.disabled = true;
      var viewContainer = casesGenerationContainer && casesGenerationContainer.querySelector('[data-view-container="' + moduleId + '"]');
      if (viewContainer) {
        viewContainer.classList.remove('visible');
        viewContainer.classList.add('hidden');
        viewContainer.innerHTML = '';
      }
      updateSupplementButtons(moduleId, false);
      clearCaseModuleStatus(moduleId);
      clearCaseProgress(moduleId);
      setCaseModuleStatus(moduleId, '已清除【' + mod.title + '】的用例', 'ok');
      refreshExportCaseGenButton();
      refreshAppendExistingButton();
    }

    function toggleCaseView(moduleId) {
      if (!casesGenerationContainer) return;
      var container = casesGenerationContainer.querySelector('[data-view-container="' + moduleId + '"]');
      var viewBtn = casesGenerationContainer.querySelector('[data-view="' + moduleId + '"]');
      if (!container || !viewBtn) return;
      if (container.classList.contains('visible')) {
        container.classList.remove('visible');
        container.classList.add('hidden');
        container.innerHTML = '';
        viewBtn.textContent = '用例视图';
        return;
      }
      var content = state.caseGenResults[moduleId];
      if (!content) {
        setStatus(caseGenStatus, '该模块尚未生成用例', 'warn');
        return;
      }
      var list = parseCaseList(content);
      if (!list.length) {
        setStatus(caseGenStatus, '解析到的用例列表为空，请确认模型输出 JSON', 'warn');
        return;
      }
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      container.innerHTML = renderCaseTable(mod, list, { selectable: true, moduleId: moduleId, showRemark: true });
      container.classList.remove('hidden');
      container.classList.add('visible');
      viewBtn.textContent = '收起用例视图';
      refreshCaseSelectionUI(moduleId);
    }

    function handleCaseSelectionChange(moduleId, index, checked) {
      var selection = ensureCaseSelectionSet(moduleId);
      if (checked) selection.add(index);
      else selection.delete(index);
      refreshCaseSelectionUI(moduleId);
      updateSupplementButtons(moduleId, getCaseListForModule(moduleId).length > 0);
    }

    function handleCaseSelectAll(moduleId, checked) {
      if (!casesGenerationContainer) return;
      var container = casesGenerationContainer.querySelector('[data-view-container="' + moduleId + '"]');
      if (!container) return;
      var selection = ensureCaseSelectionSet(moduleId);
      selection.clear();
      if (checked) {
        var rowCheckboxes = container.querySelectorAll('input[data-case-select="' + moduleId + '"]');
        rowCheckboxes.forEach(function(cb) { selection.add(Number(cb.dataset.index)); });
      }
      refreshCaseSelectionUI(moduleId);
      updateSupplementButtons(moduleId, getCaseListForModule(moduleId).length > 0);
    }

    function exportSelectedCases(moduleId) {
      var selection = state.caseSelections[moduleId];
      if (!selection || !selection.size) {
        setStatus(caseGenStatus, '请选择需要导出的用例', 'warn');
        return;
      }
      var list = getCaseListForModule(moduleId);
      if (!list.length) {
        setStatus(caseGenStatus, '当前模块没有可导出的用例', 'warn');
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再导出用例');
      if (!requirementLabel) {
        setStatus(caseGenStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      var name = mod && mod.title ? mod.title : '模块';
      try {
        var exported = exportSelectedCasesData(selection, list, name, requirementLabel);
        downloadText(exported.fileName, JSON.stringify(exported.payload, null, 2));
        setStatus(caseGenStatus, '已导出【' + name + '】选中的 ' + exported.count + ' 条用例', 'ok');
      } catch (err) {
        setStatus(caseGenStatus, err.message || '导出失败', 'err');
      }
    }

    async function exportSelectedCasesToXmind(moduleId) {
      var selection = state.caseSelections[moduleId];
      if (!selection || !selection.size) {
        setStatus(caseGenStatus, '请选择需要转换的用例', 'warn');
        return;
      }
      var requirementLabel = ensureRequirementLabel('请输入需求标识后再导出 XMind 用例');
      if (!requirementLabel) {
        setStatus(caseGenStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      var list = getCaseListForModule(moduleId);
      if (!list.length) {
        setStatus(caseGenStatus, '当前用例无法解析，请重新生成后再导出', 'warn');
        return;
      }
      var selectedCases = list.filter(function(_, idx) { return selection.has(idx); });
      if (!selectedCases.length) {
        setStatus(caseGenStatus, '请选择至少一条用例后再导出', 'warn');
        return;
      }
      var mod = state.caseGenModules.find(function(m) { return m.id === moduleId; });
      try {
        if (!buildXmindPackageFromCases) throw new Error('缺少 XMind 导出依赖');
        var exported = await buildXmindPackageFromCases(selectedCases, mod && mod.title ? mod.title : '模块', requirementLabel);
        downloadBlob(exported.fileName, exported.blob);
        setStatus(caseGenStatus, '已导出 ' + exported.count + ' 条用例为 XMind', 'ok');
      } catch (err) {
        console.error(err);
        setStatus(caseGenStatus, 'XMind 导出失败：' + err.message, 'err');
      }
    }

    function exportSelectedCasesData(selection, list, moduleTitle, requirementLabel) {
      if (!selection || !selection.size) throw new Error('未选中用例');
      if (!Array.isArray(list) || !list.length) throw new Error('当前模块没有可导出的用例');
      var selectedList = list.filter(function(_, idx) { return selection.has(idx); });
      if (!selectedList.length) throw new Error('请选择至少一条用例');
      var sanitized = sanitizeCasesForExport(selectedList);
      var name = moduleTitle || '模块';
      var payload = wrapDataWithRequirement({ module: name, cases: sanitized });
      var fileName = 'selected_' + getSafeRequirementSlug() + '_' + name + '_' + formatCompactTimestamp() + '.json';
      return { payload: payload, fileName: fileName, count: selectedList.length };
    }

    function exportAllModulesData(modules, caseGenResults, requirementLabel) {
      if (!Array.isArray(modules) || !modules.length) throw new Error('尚未生成任何用例，无法导出');
      var payload = modules.map(function(mod) {
        var raw = caseGenResults[mod.id] || '';
        var cases = [];
        try {
          cases = JSON.parse(raw || '[]');
        } catch (err) {
          cases = [];
        }
        return {
          module: normalizeRequirementName(mod.title || mod.module || ''),
          cases: sanitizeCasesForExport(cases),
        };
      });
      var fileName = 'usecases_' + getSafeRequirementSlug() + '_' + formatCompactTimestamp() + '.json';
      var count = payload.reduce(function(sum, mod) { return sum + (mod.cases ? mod.cases.length : 0); }, 0);
      return { payload: payload, fileName: fileName, count: count };
    }

    function exportSingleModuleData(mod, rawResult, requirementLabel) {
      if (!mod) throw new Error('未找到模块');
      var raw = rawResult || '';
      var parsed = [];
      try {
        parsed = JSON.parse(raw || '[]');
      } catch (err) {
        parsed = [];
      }
      if (!parsed.length) throw new Error('该模块尚未生成用例');
      var sanitized = sanitizeCasesForExport(parsed);
      var fileName = 'usecases_' + normalizeRequirementName(mod.title || mod.module || 'module') + '_' + formatCompactTimestamp();
      return { payload: sanitized, fileName: fileName, count: sanitized.length };
    }

    return {
      renderCaseGeneration: renderCaseGeneration,
      generateCasesForModule: generateCasesForModule,
      topUpCasesForModule: topUpCasesForModule,
      exportCaseGenerationResults: exportCaseGenerationResults,
      exportModuleCases: exportModuleCases,
      importModuleCases: importModuleCases,
      transferModuleToTempExec: transferModuleToTempExec,
      clearModuleCases: clearModuleCases,
      toggleCaseView: toggleCaseView,
      handleCaseSelectionChange: handleCaseSelectionChange,
      handleCaseSelectAll: handleCaseSelectAll,
      exportSelectedCases: exportSelectedCases,
      exportSelectedCasesToXmind: exportSelectedCasesToXmind,
      renderCaseTable: renderCaseTable,
      parseGeneratedCases: parseGeneratedCases,
      refreshCaseSelectionUI: refreshCaseSelectionUI,
      updateSupplementButtons: updateSupplementButtons,
      getCaseListForModule: getCaseListForModule,
      exportSelectedCasesData: exportSelectedCasesData,
      exportAllModulesData: exportAllModulesData,
      exportSingleModuleData: exportSingleModuleData,
      filterCasesAgainstImported: filterCasesAgainstImported,
      appendSelectedCasesToImported: appendSelectedCasesToImported,
    };
  }

  window.app = window.app || {};
  window.app.casesGenCore = { init: init };
})();
