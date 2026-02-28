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
      var title = (pickFirstString(item, moduleFieldAliases.title) || ('模块' + (idx + 1))).trim();
      return {
        id: item.id || ('split-' + idx + '-' + Date.now()),
        title: title,
        scenarios: pickFirstArray(item, moduleFieldAliases.scenarios),
        points: pickFirstArray(item, moduleFieldAliases.points),
        coupled: pickFirstArray(item, moduleFieldAliases.coupled),
        special: pickFirstArray(item, specialAliases),
      };
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
        if (arr) return arr.map(normalizeModuleObject).filter(Boolean);
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
          if (arrPatched) return arrPatched.map(normalizeModuleObject).filter(Boolean);
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
      var ensureRequirementLabel = handlers.ensureRequirementLabel || function() { return ''; };
      var getCleanedTextForModel = handlers.getCleanedTextForModel || function() { return ''; };
      var getAssignedModel = handlers.getAssignedModel || function() { throw new Error('缺少模型'); };
      var getReasoningForType = handlers.getReasoningForType || function() { return ''; };
      var getTemperatureForType = handlers.getTemperatureForType || function() { return 0.2; };
      var callModelWithConfig = handlers.callModelWithConfig || function() { return Promise.resolve(''); };
      var updateModelTiming = handlers.updateModelTiming || function() {};

      async function splitModules(context) {
        var ctxPayload = context && typeof context === 'object' ? context : {};
        var cleanedOverride = ctxPayload.cleanedOverride && typeof ctxPayload.cleanedOverride === 'string'
          ? ctxPayload.cleanedOverride.trim()
          : '';
        var manualMergedRequirement = !state.autoRunning
          && state.manualCaseAssistantMergedRequirement
          && typeof state.manualCaseAssistantMergedRequirement === 'string'
          ? state.manualCaseAssistantMergedRequirement.trim()
          : '';
        var cleaned = cleanedOverride || manualMergedRequirement || getCleanedTextForModel();
        if (!cleaned) {
          setStatus(splitStatus, '请先完成清洗，获取基础内容', 'warn');
          return;
        }
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
