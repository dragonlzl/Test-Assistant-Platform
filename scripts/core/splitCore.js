(function() {
  function init(deps) {
    var moduleFieldAliases = deps && deps.moduleFieldAliases ? deps.moduleFieldAliases : {};
    var normalizeRequirementName = deps && deps.normalizeRequirementName ? deps.normalizeRequirementName : function(text) { return text || ''; };
    var unwrapRequirementPayload = deps && deps.unwrapRequirementPayload ? deps.unwrapRequirementPayload : function(text) { return { payload: text }; };

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
      };
    }

    function parseSplitModules(rawText, setRequirementLabel) {
      var unwrap = unwrapRequirementPayload(rawText || '');
      var payload = unwrap.payload;
      var raw = typeof payload === 'string' ? payload.trim() : payload ? JSON.stringify(payload, null, 2) : '';
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
        console.warn('拆分结果解析失败', err);
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

      var setStatus = handlers.setStatus || function() {};
      var setStepInProgress = handlers.setStepInProgress || function() {};
      var clearStepInProgress = handlers.clearStepInProgress || function() {};
      var updateFlowStatus = handlers.updateFlowStatus || function() {};
      var ensureRequirementLabel = handlers.ensureRequirementLabel || function() { return ''; };
      var getCleanedTextForModel = handlers.getCleanedTextForModel || function() { return ''; };
      var getAssignedModel = handlers.getAssignedModel || function() { throw new Error('缺少模型'); };
      var getReasoningForType = handlers.getReasoningForType || function() { return ''; };
      var callModelWithConfig = handlers.callModelWithConfig || function() { return Promise.resolve(''); };
      var updateModelTiming = handlers.updateModelTiming || function() {};

      async function splitModules() {
        var cleaned = getCleanedTextForModel();
        if (!cleaned) {
          setStatus(splitStatus, '请先完成清洗，获取基础内容', 'warn');
          return;
        }
        var requirementLabel = ensureRequirementLabel('请输入本次需求标识后再进行测试模块拆分');
        if (!requirementLabel) {
          setStatus(splitStatus, '已取消测试模块拆分（需求标识为空）', 'warn');
          return;
        }
        if (splitBtnEl) splitBtnEl.setAttribute('disabled', 'disabled');
        var model;
        try {
          model = getAssignedModel('split');
        } catch (err) {
          setStatus(splitStatus, err.message, 'warn');
          updateModelTiming(splitTimingEl);
          if (splitBtnEl) splitBtnEl.removeAttribute('disabled');
          return;
        }
        if (splitResultEl) splitResultEl.value = '';
        setStepInProgress('split');
        setStatus(splitStatus, '正在拆分测试模块...', '');
        try {
          var splitPrompt = state.assignments && state.assignments.splitPrompt ? state.assignments.splitPrompt.trim() : '';
          var prompt = splitPrompt || (defaultPrompts.split || '');
          var reasoning = getReasoningForType('split');
          var startTime = Date.now();
          var content = await callModelWithConfig(model, cleaned, prompt, reasoning);
          updateModelTiming(splitTimingEl, Date.now() - startTime);
          if (splitResultEl) splitResultEl.value = content;
          setStatus(splitStatus, '拆分完成', 'ok');
          if (casesCoverageStatus) setStatus(casesCoverageStatus, '', '');
        } catch (err) {
          console.error(err);
          updateModelTiming(splitTimingEl);
          setStatus(splitStatus, '拆分失败：' + err.message, 'err');
        } finally {
          clearStepInProgress('split');
          updateFlowStatus();
          if (splitBtnEl) splitBtnEl.removeAttribute('disabled');
        }
      }

      return {
        splitModules: splitModules,
        ensureCaseGenModulesFromSplit: ensureCaseGenModulesFromSplit,
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
