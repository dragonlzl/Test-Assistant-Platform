(function() {
  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var handlers = ctx.handlers || {};
    var utils = ctx.utils || {};

    var stripCodeFence = utils.stripCodeFence || function(text) { return text || ''; };
    var stripRequirementHeader = handlers.stripRequirementHeader || function(text) {
      if (!text) return '';
      var lines = text.split(/\r?\n/);
      if (lines.length && /^#需求标识：/.test(lines[0].trim())) {
        return lines.slice(1).join('\n');
      }
      return text;
    };
    var normalizeRequirementName = handlers.normalizeRequirementName || function(name) {
      if (!name) return '';
      var text = String(name).trim();
      if (!text) return '';
      return text.replace(/\.[^.\s]{1,6}$/i, '').trim();
    };
    var renderAutoRawInfo = handlers.renderAutoRawInfo || function() {};

    function buildRequirementPrompt(text) {
      var suffix = '请填写本次需求名称，作为需求标识（不可为空）';
      if (text && text.trim()) return text + '\n' + suffix;
      return '请填写本次需求名称，作为需求标识（不可为空）';
    }

    function setRequirementLabel(label, source) {
      var normalized = normalizeRequirementName(label);
      if (!normalized) return '';
      state.requirementLabel = normalized;
      if (source) state.requirementLabelSource = source;
      renderAutoRawInfo();
      return normalized;
    }

    function getRequirementLabel(allowFallback) {
      var label = state.requirementLabel || normalizeRequirementName(state.lastRawImportName);
      if (label) return label;
      if (allowFallback === false) return '';
      return '当前需求';
    }

    function ensureRequirementLabel(promptText) {
      var existing = getRequirementLabel(false);
      if (existing) return existing;
      var text = window.prompt(buildRequirementPrompt(promptText));
      if (!text) return '';
      var normalized = setRequirementLabel(text, 'manual');
      if (!normalized) return '';
      return normalized;
    }

    function promptRequirementLabel(promptText) {
      var current = getRequirementLabel(false);
      var text = window.prompt(buildRequirementPrompt(promptText), current || '');
      if (!text) return '';
      var normalized = setRequirementLabel(text, 'manual');
      return normalized;
    }

    function promptTempExecRequirement(fileName, fallbackLabel) {
      var base = normalizeRequirementName(fallbackLabel || '')
        || normalizeRequirementName(getRequirementLabel(false))
        || normalizeRequirementName((fileName || '').replace(/\.[^.]+$/, ''))
        || '';
      var input = window.prompt('请输入需求标识（用于区分执行用例），文件：' + (fileName || ''), base);
      if (!input) return '';
      var normalized = normalizeRequirementName(input);
      if (!normalized) return '';
      setRequirementLabel(normalized, 'import');
      return normalized;
    }

    function formatCompactTimestamp() {
      var d = new Date();
      var pad = function(n) { return n.toString().padStart(2, '0'); };
      return '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    }

    function getRequirementDisplayName() {
      return getRequirementLabel(true);
    }

    function getSafeRequirementSlug() {
      return (getRequirementLabel(true) || 'requirement').replace(/[\\/:*?"<>|]/g, '_');
    }

    function wrapDataWithRequirement(data, type) {
      var label = getRequirementLabel(true);
      var payload = data && typeof data === 'object' && !Array.isArray(data)
        ? (Object.prototype.hasOwnProperty.call(data, 'data') ? data.data : data)
        : data;
      var wrapped = { requirement: label, data: payload };
      if (type) wrapped.type = type;
      return wrapped;
    }

    function wrapTextWithRequirement(text, type) {
      var stripped = stripCodeFence(stripRequirementHeader(text || ''));
      if (!stripped) return '';
      try {
        var parsed = JSON.parse(stripped);
        return JSON.stringify(wrapDataWithRequirement(parsed, type), null, 2);
      } catch (err) {
        var header = ['#需求标识：' + getRequirementLabel(true)];
        if (type) header.push('#类型：' + type);
        return header.join('\n') + '\n' + stripped;
      }
    }

    function unwrapRequirementPayload(rawText) {
      var strippedFence = stripCodeFence(rawText || '').trim();
      if (!strippedFence) return { payload: '', requirement: '', type: '' };
      var lines = strippedFence.split(/\r?\n/);
      var requirement = '';
      var type = '';
      var remaining = [];
      lines.forEach(function(line) {
        var trimmed = line.trim();
        if (!requirement && /^#需求标识：/.test(trimmed)) {
          requirement = normalizeRequirementName(trimmed.replace(/^#需求标识：/, ''));
          return;
        }
        if (!type && /^#类型：/.test(trimmed)) {
          type = trimmed.replace(/^#类型：/, '').trim();
          return;
        }
        remaining.push(line);
      });
      var text = stripRequirementHeader(remaining.join('\n')).trim();
      if (!text) return { payload: '', requirement: requirement, type: type };
      try {
        var parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          var hasData = Object.prototype.hasOwnProperty.call(parsed, 'data');
          return {
            payload: hasData ? parsed.data : parsed,
            requirement: parsed.requirement || requirement,
            type: parsed.type || type,
          };
        }
        return { payload: parsed, requirement: requirement, type: type };
      } catch (err) {
        return { payload: text, requirement: requirement, type: type };
      }
    }

    function extractRequirementLabelFromText(text) {
      if (!text) return '';
      var prefixMatch = text.match(/^#需求标识：(.+)$/m);
      if (prefixMatch && prefixMatch[1]) {
        return normalizeRequirementName(prefixMatch[1]);
      }
      var stripped = stripCodeFence(text);
      if (!stripped) return '';
      try {
        var data = JSON.parse(stripped);
        if (data && typeof data === 'object') {
          if (typeof data.requirement === 'string') return normalizeRequirementName(data.requirement);
          if (data.data && typeof data.data === 'object' && typeof data.data.requirement === 'string') {
            return normalizeRequirementName(data.data.requirement);
          }
        }
      } catch (err) {
        return '';
      }
      return '';
    }

    return {
      setRequirementLabel: setRequirementLabel,
      getRequirementLabel: getRequirementLabel,
      ensureRequirementLabel: ensureRequirementLabel,
      promptRequirementLabel: promptRequirementLabel,
      promptTempExecRequirement: promptTempExecRequirement,
      stripRequirementHeader: stripRequirementHeader,
      buildRequirementPrompt: buildRequirementPrompt,
      getRequirementDisplayName: getRequirementDisplayName,
      getSafeRequirementSlug: getSafeRequirementSlug,
      formatCompactTimestamp: formatCompactTimestamp,
      wrapDataWithRequirement: wrapDataWithRequirement,
      wrapTextWithRequirement: wrapTextWithRequirement,
      unwrapRequirementPayload: unwrapRequirementPayload,
      extractRequirementLabelFromText: extractRequirementLabelFromText,
      normalizeRequirementName: normalizeRequirementName,
    };
  }

  window.app = window.app || {};
  window.app.requirementCore = { init: init };
})();
