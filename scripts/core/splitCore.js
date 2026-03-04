(function() {
  function init(deps) {
    var moduleFieldAliases = deps && deps.moduleFieldAliases ? deps.moduleFieldAliases : {};
    var specialAliases = moduleFieldAliases.special || ['special', 'special_points', '特殊测试点'];
    var normalizeRequirementName = deps && deps.normalizeRequirementName ? deps.normalizeRequirementName : function(text) { return text || ''; };
    var unwrapRequirementPayload = deps && deps.unwrapRequirementPayload ? deps.unwrapRequirementPayload : function(text) { return { payload: text }; };
    var stripCodeFence = deps && deps.stripCodeFence ? deps.stripCodeFence : function(text) { return text || ''; };

    function pickFirstString(source, aliases) {
      if (!source) return '';
      if (Array.isArray(source)) {
        for (var i = 0; i < source.length; i += 1) {
          var val = pickFirstString(source[i], aliases);
          if (val) return val;
        }
        return '';
      }
      if (typeof source === 'object') {
        for (var j = 0; j < aliases.length; j += 1) {
          var alias = aliases[j];
          var value = source[alias];
          if (typeof value === 'string' && value.trim()) return value.trim();
        }
      }
      return '';
    }

    function pickFirstValue(source, aliases) {
      if (!source) return undefined;
      if (Array.isArray(source)) {
        for (var i = 0; i < source.length; i += 1) {
          var val = pickFirstValue(source[i], aliases);
          if (val !== undefined) return val;
        }
        return undefined;
      }
      if (typeof source === 'object') {
        for (var j = 0; j < aliases.length; j += 1) {
          var alias = aliases[j];
          if (Object.prototype.hasOwnProperty.call(source, alias)) {
            var value = source[alias];
            if (value !== undefined) return value;
          }
        }
      }
      return undefined;
    }

    function pickFirstArray(source, aliases) {
      if (!source) return [];
      if (Array.isArray(source)) {
        for (var i = 0; i < source.length; i += 1) {
          var item = source[i];
          if (Array.isArray(item)) {
            if (item.length && typeof item[0] === 'string') return item;
          }
          if (item && typeof item === 'object') {
            var nested = pickFirstArray(item, aliases);
            if (nested && nested.length) return nested;
          }
        }
        return [];
      }
      if (typeof source === 'object') {
        for (var j = 0; j < aliases.length; j += 1) {
          var alias = aliases[j];
          var val = source[alias];
          if (Array.isArray(val)) return val;
        }
      }
      return [];
    }

    function normalizeModuleObject(item, idx) {
      if (!item || typeof item !== 'object') return null;
      var titleFromFields = pickFirstString(item, moduleFieldAliases.title);
      var scenarios = pickFirstArray(item, moduleFieldAliases.scenarios);
      var points = pickFirstArray(item, moduleFieldAliases.points);
      var coupled = pickFirstArray(item, moduleFieldAliases.coupled);
      var special = pickFirstArray(item, specialAliases);

      // 兼容结构：[{ "模块名": [{测试场景:[...]}, {测点要点:[...]}, ...] }]
      if (!titleFromFields && !scenarios.length && !points.length && !coupled.length && !special.length) {
        var entries = Object.entries(item);
        if (entries.length === 1) {
          var fallback = normalizeModuleBlocks(entries[0][0], entries[0][1], idx);
          if (fallback) return fallback;
        }
      }

      var title = (titleFromFields || ('模块' + (idx + 1))).trim();
      return {
        id: item.id || ('split-' + idx + '-' + Date.now()),
        title: title,
        scenarios: scenarios,
        points: points,
        coupled: coupled,
        special: special,
      };
    }

    function normalizeModuleArray(arr) {
      if (!Array.isArray(arr)) return [];
      var modules = [];
      arr.forEach(function(item, idx) {
        if (!item || typeof item !== 'object') {
          var normalized = normalizeModuleObject(item, idx);
          if (normalized) modules.push(normalized);
          return;
        }
        var hasDirectFields = Boolean(
          pickFirstString(item, moduleFieldAliases.title) ||
          pickFirstArray(item, moduleFieldAliases.scenarios).length ||
          pickFirstArray(item, moduleFieldAliases.points).length ||
          pickFirstArray(item, moduleFieldAliases.coupled).length ||
          pickFirstArray(item, specialAliases).length
        );
        if (hasDirectFields) {
          var direct = normalizeModuleObject(item, idx);
          if (direct) modules.push(direct);
          return;
        }
        var entries = Object.entries(item);
        if (entries.length) {
          entries.forEach(function(pair, subIdx) {
            var fromBlock = normalizeModuleBlocks(pair[0], pair[1], String(idx) + '-' + String(subIdx));
            if (fromBlock) modules.push(fromBlock);
          });
          return;
        }
        var fallback = normalizeModuleObject(item, idx);
        if (fallback) modules.push(fallback);
      });
      return modules;
    }

    function normalizeModuleBlocks(name, blocks, idx) {
      if (!blocks) return null;
      var blockArr = Array.isArray(blocks) ? blocks.filter(Boolean) : [blocks];
      if (!blockArr.length) return null;
      var titleFromBlock = pickFirstString(blockArr, moduleFieldAliases.title);
      var title = (titleFromBlock || (typeof name === 'string' ? name : '') || ('模块' + (idx + 1))).trim();
      return {
        id: 'split-' + idx + '-' + Date.now(),
        title: title,
        scenarios: pickFirstArray(blockArr, moduleFieldAliases.scenarios),
        points: pickFirstArray(blockArr, moduleFieldAliases.points),
        coupled: pickFirstArray(blockArr, moduleFieldAliases.coupled),
        special: pickFirstArray(blockArr, specialAliases),
      };
    }

    function parseSplitModules(rawText, setRequirementLabel) {
      var unwrap = unwrapRequirementPayload(stripCodeFence(rawText || ''));
      var payload = unwrap.payload;
      var raw = typeof payload === 'string' ? stripCodeFence(payload).trim() : payload ? JSON.stringify(payload, null, 2) : '';
      if (!raw) return [];
      var labelFromPayload = unwrap.requirement ? normalizeRequirementName(unwrap.requirement) : '';
      if (labelFromPayload && typeof setRequirementLabel === 'function') setRequirementLabel(labelFromPayload, 'import');
      try {
        var data = typeof payload === 'string' ? JSON.parse(raw) : payload;
        var modulesField = data && data.modules;
        var dataField = data && data.data;
        var arr = Array.isArray(data)
          ? data
          : Array.isArray(modulesField)
          ? modulesField
          : Array.isArray(dataField)
          ? dataField
          : null;
        if (arr) return normalizeModuleArray(arr);
        if (data && typeof data === 'object') {
          return Object.entries(data).map(function(pair, idx) {
            return normalizeModuleBlocks(pair[0], pair[1], idx);
          }).filter(Boolean);
        }
      } catch (err) {
        try {
          var patched = raw.replace(/}\\s*,\\s*\"/g, '],\n  \"');
          var patchedData = JSON.parse(patched);
          var modulesFieldPatched = patchedData && patchedData.modules;
          var dataFieldPatched = patchedData && patchedData.data;
          var arrPatched = Array.isArray(patchedData)
            ? patchedData
            : Array.isArray(modulesFieldPatched)
            ? modulesFieldPatched
            : Array.isArray(dataFieldPatched)
            ? dataFieldPatched
            : null;
          if (arrPatched) return normalizeModuleArray(arrPatched);
          if (patchedData && typeof patchedData === 'object') {
            return Object.entries(patchedData).map(function(pair, idx) {
              return normalizeModuleBlocks(pair[0], pair[1], idx);
            }).filter(Boolean);
          }
          console.warn('拆分结果解析失败', err);
        } catch (err2) {
          console.warn('拆分结果解析失败', err2);
        }
      }
      return [];
    }

    function createSplitRuntime(ctx) {
      ctx = ctx || {};
      var state = ctx.state || {};
      var dom = ctx.dom || {};
      var handlers = ctx.handlers || {};
      var config = ctx.config || {};
      var defaultPrompts = config.defaultPrompts || {};

      var splitResultEl = dom.splitResultEl;
      var splitStatus = dom.splitStatus;
      var splitBtnEl = dom.splitBtnEl;
      var splitTimingEl = dom.splitTimingEl;
      var casesCoverageStatus = dom.casesCoverageStatus;

      var parseSplitModulesFn = handlers.parseSplitModules || function() { return []; };
      var refreshMissingSmartFillButton = handlers.refreshMissingSmartFillButton || function() {};
      var renderCaseGenProgressBoard = handlers.renderCaseGenProgressBoard || function() {};
      var syncSplitView = handlers.syncSplitView || function() {};

      function ensureCaseGenModulesFromSplit() {
        if (state.caseGenModules && state.caseGenModules.length) return false;
        var splitText = splitResultEl && splitResultEl.value ? splitResultEl.value.trim() : '';
        if (!splitText) return false;
        var modules = parseSplitModulesFn();
        if (!modules.length) return false;
        state.caseGenModules = modules;
        state.caseGenResults = {};
        state.caseSelections = {};
        state.caseGenSuggestions = {};
        state.caseGenSource = splitText;
        state.caseGenModuleStatus = {};
        state.caseGenProgress = {};
        state.caseGenRunning = new Set();
        refreshMissingSmartFillButton();
        renderCaseGenProgressBoard();
        return true;
      }

      function applySplitResultText(text) {
        if (!splitResultEl) return;
        splitResultEl.value = text || '';
        if (typeof splitResultEl.dispatchEvent === 'function') {
          try {
            splitResultEl.dispatchEvent(new Event('input', { bubbles: true }));
          } catch (err) {
            splitResultEl.dispatchEvent(new Event('input'));
          }
        }
        syncSplitView();
      }

      var setStatus = handlers.setStatus || function() {};
      var setStepInProgress = handlers.setStepInProgress || function() {};
      var clearStepInProgress = handlers.clearStepInProgress || function() {};
      var updateFlowStatus = handlers.updateFlowStatus || function() {};
      var hasImportedCases = handlers.hasImportedCases || function() { return false; };
      var getImportedCaseObjects = handlers.getImportedCaseObjects || function() { return []; };
      var openConfirmDrawer = handlers.openConfirmDrawer || function(options) {
        var message = options && options.message ? String(options.message) : '';
        var ok = true;
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          ok = window.confirm(message);
        }
        return Promise.resolve({ ok: ok });
      };
      var scrollToSection = handlers.scrollToSection || function() {};
      var switchTab = handlers.switchTab || function() {};
      var ensureRequirementLabel = handlers.ensureRequirementLabel || function() { return ''; };
      var getCleanedTextForModel = handlers.getCleanedTextForModel || function() { return ''; };
      var getAssignedModel = handlers.getAssignedModel || function() { throw new Error('缺少模型'); };
      var getReasoningForType = handlers.getReasoningForType || function() { return ''; };
      var getTemperatureForType = handlers.getTemperatureForType || function() { return 0.2; };
      var callModelWithConfig = handlers.callModelWithConfig || function() { return Promise.resolve(''); };
      var updateModelTiming = handlers.updateModelTiming || function() {};

      function isManualSplitTrigger(trigger) {
        if (!trigger || typeof trigger !== 'object') return false;
        if (trigger.manual === true) return true;
        var type = typeof trigger.type === 'string' ? trigger.type.toLowerCase() : '';
        return type === 'click';
      }

      function shouldPromptCaseImport(trigger) {
        if (trigger && typeof trigger === 'object' && trigger.requireCaseImportConfirm === true) {
          return true;
        }
        return isManualSplitTrigger(trigger);
      }

      function normalizeModuleNode(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/\s+/g, ' ').trim();
      }

      function collectImportedModuleNodes() {
        var importedList = [];
        try {
          importedList = getImportedCaseObjects();
        } catch (err) {
          importedList = [];
        }
        if (!Array.isArray(importedList) || !importedList.length) return [];
        var aliases = moduleFieldAliases && Array.isArray(moduleFieldAliases.title) && moduleFieldAliases.title.length
          ? moduleFieldAliases.title
          : ['module', '模块', 'name', 'title'];
        var seen = {};
        var modules = [];
        importedList.forEach(function(item) {
          if (!item || typeof item !== 'object') return;
          var moduleName = '';
          if (typeof item.module === 'string' && item.module.trim()) {
            moduleName = item.module;
          } else {
            moduleName = pickFirstString(item, aliases);
          }
          moduleName = normalizeModuleNode(moduleName);
          if (!moduleName || seen[moduleName]) return;
          seen[moduleName] = true;
          modules.push(moduleName);
        });
        return modules;
      }

      function buildSplitPromptWithImportedModules(basePrompt, moduleNodes) {
        if (!Array.isArray(moduleNodes) || !moduleNodes.length) return basePrompt || '';
        var prompt = basePrompt || '';
        var maxCount = 40;
        var usedNodes = moduleNodes.slice(0, maxCount);
        var moduleLines = usedNodes.map(function(name, idx) {
          return String(idx + 1) + '. ' + name;
        }).join('\n');
        if (moduleNodes.length > usedNodes.length) {
          moduleLines += '\n...（其余' + String(moduleNodes.length - usedNodes.length) + '个模块略）';
        }
        var addition = [
          '',
          '补充约束（必须遵守）：',
          '请参考已导入用例的模块节点（根节点下一级）进行拆分，优先沿用以下模块名作为输出 module：',
          moduleLines,
          '仅当需求存在明显未覆盖范围时才允许新增模块；如果当前模块划分足够，则不要新增模块。',
          '最终输出格式保持不变：仅输出 JSON 数组，字段为 module、key_scenarios、test_points、coupled_modules。'
        ].join('\n');
        return prompt + addition;
      }

      function jumpToCaseImportSection() {
        if (typeof scrollToSection === 'function') {
          scrollToSection('cases-upload', { behavior: 'auto' });
          return;
        }
        if (typeof switchTab === 'function') switchTab('clean');
        if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
        var section = document.querySelector('[data-section-id="cases-upload"]');
        if (section && typeof section.scrollIntoView === 'function') {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }

      function waitForConfirmDrawerClosed() {
        return new Promise(function(resolve) {
          if (typeof document === 'undefined' || typeof setTimeout !== 'function') {
            resolve();
            return;
          }
          var drawerEl = document.getElementById('appConfirmDrawer');
          var bodyEl = document.body || null;
          var startAt = Date.now();
          var timeoutMs = 1000;
          function isReleased() {
            var drawerClosed = true;
            if (drawerEl && drawerEl.classList) {
              drawerClosed = !drawerEl.classList.contains('open') && !drawerEl.classList.contains('closing');
            }
            var bodyUnlocked = true;
            if (bodyEl && bodyEl.classList) {
              bodyUnlocked = !bodyEl.classList.contains('drawer-open');
            }
            return drawerClosed && bodyUnlocked;
          }
          function done() {
            resolve();
          }
          if (isReleased()) {
            setTimeout(done, 0);
            return;
          }
          function tick() {
            if (isReleased()) {
              done();
              return;
            }
            if (Date.now() - startAt >= timeoutMs) {
              done();
              return;
            }
            setTimeout(tick, 16);
          }
          setTimeout(tick, 16);
        });
      }

      async function ensureManualSplitCaseImport(trigger) {
        if (!shouldPromptCaseImport(trigger)) return true;
        var imported = false;
        try {
          imported = hasImportedCases();
        } catch (err) {
          imported = false;
        }
        if (imported) return true;
        var result = await openConfirmDrawer({
          title: '提示',
          message: '当前尚未导入测试用例。导入用例可作为模块拆分参考，是否先前往导入？',
          hint: '若选择“不导入用例”，将直接按当前需求继续拆分。',
          confirmText: '前往导入用例',
          cancelText: '不导入用例',
        });
        if (result && result.ok === true) {
          await waitForConfirmDrawerClosed();
          jumpToCaseImportSection();
          setStatus(splitStatus, '已跳转到“测试用例导入（XMind）”卡片，请先导入用例后再拆分', 'warn');
          return false;
        }
        if ((result && result.reason === 'cancel') || (result && result.ok === false && !result.reason)) {
          return true;
        }
        setStatus(splitStatus, '已取消测试模块拆分', 'warn');
        return false;
      }

      async function splitModules(trigger) {
        var cleaned = getCleanedTextForModel();
        if (!cleaned) {
          setStatus(splitStatus, '请先完成清洗，获取基础内容', 'warn');
          return;
        }
        var passedImportCheck = await ensureManualSplitCaseImport(trigger);
        if (!passedImportCheck) return;
        var requirementLabel = ensureRequirementLabel('请输入本次需求标识后再进行测试模块拆分');
        if (!requirementLabel) {
          setStatus(splitStatus, '已取消测试模块拆分（需求标识为空）', 'warn');
          return;
        }
        if (state.isSplitting) {
          setStatus(splitStatus, '正在拆分测试模块，请稍候', 'warn');
          return;
        }
        state.isSplitting = true;
        if (splitBtnEl) splitBtnEl.setAttribute('disabled', 'disabled');
        var model;
        try {
          model = getAssignedModel('split');
        } catch (err) {
        setStatus(splitStatus, err.message, 'warn');
        updateModelTiming(splitTimingEl);
        state.isSplitting = false;
        if (splitBtnEl) splitBtnEl.removeAttribute('disabled');
        clearStepInProgress('split');
        updateFlowStatus();
        return;
      }
        applySplitResultText('');
        setStepInProgress('split');
        setStatus(splitStatus, '正在拆分测试模块...', '');
        try {
          var splitPrompt = state.assignments && state.assignments.splitPrompt ? state.assignments.splitPrompt.trim() : '';
          var prompt = splitPrompt || (defaultPrompts.split || '');
          var importedModuleNodes = collectImportedModuleNodes();
          if (importedModuleNodes.length) {
            prompt = buildSplitPromptWithImportedModules(prompt, importedModuleNodes);
          }
          var reasoning = getReasoningForType('split');
          var temperature = getTemperatureForType('split');
          var startTime = Date.now();
          var content = await callModelWithConfig(model, cleaned, prompt, reasoning, temperature);
          updateModelTiming(splitTimingEl, Date.now() - startTime);
          var sanitized = stripCodeFence(content);
          applySplitResultText(sanitized);
          setStatus(splitStatus, '拆分完成', 'ok');
          if (casesCoverageStatus) setStatus(casesCoverageStatus, '', '');
        } catch (err) {
          console.error(err);
          updateModelTiming(splitTimingEl);
          setStatus(splitStatus, '拆分失败：' + err.message, 'err');
        } finally {
          state.isSplitting = false;
          clearStepInProgress('split');
          updateFlowStatus();
          if (splitBtnEl) splitBtnEl.removeAttribute('disabled');
        }
      }

      return {
        splitModules: splitModules,
        ensureCaseGenModulesFromSplit: ensureCaseGenModulesFromSplit,
        applySplitResultText: applySplitResultText,
      };
    }

    return {
      pickFirstString: pickFirstString,
      pickFirstValue: pickFirstValue,
      pickFirstArray: pickFirstArray,
      parseSplitModules: parseSplitModules,
      createSplitRuntime: createSplitRuntime,
    };
  }

  window.app = window.app || {};
  window.app.splitCore = { init: init };
})();
