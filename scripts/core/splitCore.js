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

    return {
      pickFirstString: pickFirstString,
      pickFirstValue: pickFirstValue,
      pickFirstArray: pickFirstArray,
      parseSplitModules: parseSplitModules,
    };
  }

  window.app = window.app || {};
  window.app.splitCore = { init: init };
})();
