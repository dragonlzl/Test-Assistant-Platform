(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.xmindCasegenCaseModel = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var normalizeText = typeof opts.normalizeText === 'function'
      ? opts.normalizeText
      : function(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/\r/g, '\n').replace(/\s+/g, ' ').trim();
      };
    var stringifyField = typeof opts.stringifyField === 'function'
      ? opts.stringifyField
      : function(value) {
        if (Array.isArray(value)) {
          return value.map(function(item) { return normalizeText(item); }).filter(Boolean).join('；');
        }
        if (value && typeof value === 'object') {
          try {
            return JSON.stringify(value);
          } catch (err) {
            return '';
          }
        }
        return normalizeText(value);
      };
    var normalizeModuleTitle = typeof opts.normalizeModuleTitle === 'function'
      ? opts.normalizeModuleTitle
      : function(value) { return stringifyField(value || '').replace(/\s+/g, ' ').trim(); };
    var normalizeCaseTitle = typeof opts.normalizeCaseTitle === 'function'
      ? opts.normalizeCaseTitle
      : function(value) { return normalizeText(value).toLowerCase(); };

    function normalizeCasePriority(priority) {
      var text = normalizeText(priority).toUpperCase();
      if (text === 'P0' || text === 'P1' || text === 'P2') return text;
      return 'P1';
    }

    function compactCaseTitle(title) {
      var text = normalizeText(title);
      if (!text) return '未命名用例';
      text = text.replace(/^[\d一二三四五六七八九十]+[、.．)\]\s-]+/, '').trim();
      if (text.length <= 28) return text;
      var parts = text.split(/[，。；：,:]/);
      var first = normalizeText(parts[0] || '');
      if (first && first.length <= 28) return first;
      return text.slice(0, 28).trim();
    }

    function normalizeCaseSteps(steps) {
      var list = [];
      if (Array.isArray(steps)) {
        list = steps.map(function(item) { return normalizeText(item); }).filter(Boolean);
      } else {
        var text = normalizeText(steps);
        if (text) {
          list = text.split(/\n+/).map(function(item) { return normalizeText(item); }).filter(Boolean);
          if (!list.length) list = [text];
        }
      }
      return list.map(function(item, index) {
        var clean = item.replace(/^\d+[、.．)\]\s-]+/, '').trim();
        return String(index + 1) + '、' + (clean || ('步骤' + String(index + 1)));
      });
    }

    function normalizeCaseItem(item, fallbackModule) {
      if (!item || typeof item !== 'object') return null;
      var moduleTitle = normalizeModuleTitle(item.module || fallbackModule || '未命名模块');
      var title = compactCaseTitle(item.title || item.case_title || item['用例标题'] || moduleTitle);
      var expected = stringifyField(item.expected || item.result || item['预期结果']);
      if (!title) return null;
      return {
        module: moduleTitle,
        title: title,
        priority: normalizeCasePriority(item.priority || item.level || item['优先级']),
        preconditions: stringifyField(item.preconditions || item.precondition || item['前提条件']),
        steps: normalizeCaseSteps(item.steps || item.actions || item['操作步骤']),
        expected: expected || '-',
      };
    }

    function normalizeFallbackCaseList(list, fallbackModule) {
      var result = [];
      var seen = {};
      (Array.isArray(list) ? list : []).forEach(function(item) {
        var normalized = normalizeCaseItem(item, fallbackModule);
        var titleKey = normalizeCaseTitle(normalized && normalized.title ? normalized.title : '');
        if (!normalized || !titleKey || seen[titleKey]) return;
        seen[titleKey] = true;
        result.push(normalized);
      });
      return result;
    }

    function buildCaseSignature(item, fallbackModule) {
      var normalized = normalizeCaseItem(item, fallbackModule);
      if (!normalized) return '';
      var steps = Array.isArray(normalized.steps) ? normalized.steps.slice() : [];
      return [
        normalizeCaseTitle(normalized.title),
        normalizeCasePriority(normalized.priority),
        normalizeText(normalized.preconditions),
        steps.map(function(step) { return normalizeText(step); }).join('||'),
        normalizeText(normalized.expected),
      ].join('##');
    }

    return {
      normalizeCasePriority: normalizeCasePriority,
      compactCaseTitle: compactCaseTitle,
      normalizeCaseSteps: normalizeCaseSteps,
      normalizeCaseItem: normalizeCaseItem,
      normalizeFallbackCaseList: normalizeFallbackCaseList,
      buildCaseSignature: buildCaseSignature,
    };
  }

  return {
    create: create,
  };
});
