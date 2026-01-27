(function() {
  function init(deps) {
    var unwrapRequirementPayload = deps && deps.unwrapRequirementPayload ? deps.unwrapRequirementPayload : function(text) { return { payload: text }; };
    var extractJsonObjects = deps && deps.extractJsonObjects ? deps.extractJsonObjects : function() { return []; };
    var cleanedEntryFieldAliases = deps && deps.cleanedEntryFieldAliases ? deps.cleanedEntryFieldAliases : {};
    var cleanedDescriptionFieldAliases = deps && deps.cleanedDescriptionFieldAliases ? deps.cleanedDescriptionFieldAliases : {};
    var pickFirstValue = deps && deps.pickFirstValue ? deps.pickFirstValue : function() { return undefined; };
    var pickFirstString = deps && deps.pickFirstString ? deps.pickFirstString : function() { return ''; };

    var rawFieldNameSet = new Set((cleanedEntryFieldAliases.raw || []).map(function(name) { return String(name || '').toLowerCase(); }));

    function shouldExpectCleanJson(promptText) {
      return /json/i.test((promptText || '').toString());
    }

    function repairLooseNewlines(text) {
      var raw = text === undefined || text === null ? '' : String(text);
      if (!raw) return '';
      var out = '';
      var inString = false;
      var escaped = false;
      function isSpace(ch) { return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t'; }
      function prevNonSpace() {
        for (var i = out.length - 1; i >= 0; i -= 1) {
          var ch = out[i];
          if (!isSpace(ch)) return ch;
        }
        return '';
      }
      function nextNonSpace(idx) {
        for (var i = idx + 1; i < raw.length; i += 1) {
          var ch = raw[i];
          if (!isSpace(ch)) return ch;
        }
        return '';
      }
      for (var i = 0; i < raw.length; i += 1) {
        var ch = raw[i];
        if (inString) {
          if (escaped) {
            escaped = false;
            out += ch;
            continue;
          }
          if (ch === '\\') {
            escaped = true;
            out += ch;
            continue;
          }
          if (ch === '"') {
            inString = false;
            out += ch;
            continue;
          }
          out += ch;
          continue;
        }
        if (ch === '"') {
          inString = true;
          out += ch;
          continue;
        }
        if (ch === 'n') {
          var prev = prevNonSpace();
          var next = nextNonSpace(i);
          var prevOk = prev === '' || /[\[{,:\}\]\"]/.test(prev);
          var nextOk = next === '' || /[\[{,\}\]\"]/.test(next);
          if (prevOk && nextOk) {
            continue;
          }
        }
        out += ch;
      }
      return out;
    }

    function tryParseCleanJson(text) {
      var raw = text === undefined || text === null ? '' : text;
      var result = { parsed: null, text: '', repaired: false };
      if (!raw) return result;
      if (typeof raw !== 'string') {
        result.parsed = raw;
        return result;
      }
      var trimmed = raw.trim();
      if (!trimmed) return result;
      try {
        result.parsed = JSON.parse(trimmed);
        result.text = trimmed;
        return result;
      } catch (err) {
        // continue
      }
      var repaired = repairLooseNewlines(trimmed);
      if (repaired && repaired !== trimmed) {
        try {
          result.parsed = JSON.parse(repaired);
          result.text = repaired;
          result.repaired = true;
          return result;
        } catch (err) {
          // continue
        }
      }
      return result;
    }

    function parseCleanedContent(text) {
      if (!text) return '';
      var payloadObj = unwrapRequirementPayload(text) || {};
      var payload = Object.prototype.hasOwnProperty.call(payloadObj, 'payload') ? payloadObj.payload : text;
      var stripped = typeof payload === 'string' ? payload.trim() : payload;
      if (!stripped) return '';
      if (typeof stripped !== 'string') return stripped;
      var parsed = tryParseCleanJson(stripped);
      if (parsed && parsed.parsed !== null) return parsed.parsed;
      try {
        var candidate = parsed && parsed.text ? parsed.text : stripped;
        var recovered = extractJsonObjects(candidate);
        if (recovered && recovered.length) {
          return recovered.length === 1 ? recovered[0] : recovered;
        }
      } catch (inner) {
        console.warn('清洗结果解析失败', inner);
      }
      return stripped;
    }

    function createEmptyDescription() {
      return { summary: '', goals: [], rules: [], constraints: [], flows: [], values: [], configs: [] };
    }

    function coerceText(value) {
      if (value === undefined || value === null) return '';
      if (typeof value === 'string') return value.trim();
      if (Array.isArray(value)) return value.map(function(item) { return coerceText(item); }).filter(Boolean).join('\n');
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch (err) {
          return '';
        }
      }
      return value.toString();
    }

    function coerceTextList(value) {
      if (value === undefined || value === null) return [];
      if (Array.isArray(value)) return value.map(function(item) { return coerceText(item); }).filter(Boolean);
      var text = coerceText(value);
      return text ? [text] : [];
    }

    function determineDescriptionField(label) {
      if (!label) return '';
      var text = label.replace(/[：:]/g, '').toLowerCase();
      if (/目标|目的|intent|goal/.test(text)) return 'goals';
      if (/约束|限制|constraint|前提/.test(text)) return 'constraints';
      if (/流程|步骤|flow|process/.test(text)) return 'flows';
      if (/规则|逻辑|要点|rule/.test(text)) return 'rules';
      if (/概述|summary|描述|说明/.test(text)) return 'summary';
      return '';
    }

    function mergeDescriptionField(desc, field, value) {
      if (!desc || !field) return;
      if (field === 'summary') {
        var text = coerceText(value);
        if (text) {
          desc.summary = desc.summary ? desc.summary + '\n' + text : text;
        }
        return;
      }
      if (!Array.isArray(desc[field])) desc[field] = [];
      var list = coerceTextList(value);
      if (list.length) desc[field].push.apply(desc[field], list);
    }

    function fillDescriptionFromObject(desc, obj) {
      if (!obj || typeof obj !== 'object') return;
      Object.keys(cleanedDescriptionFieldAliases).forEach(function(field) {
        var aliases = cleanedDescriptionFieldAliases[field];
        var value = pickFirstValue(obj, aliases);
        if (value !== undefined) mergeDescriptionField(desc, field, value);
      });
      if (!desc.summary) {
        var fallback = pickFirstValue(obj, cleanedEntryFieldAliases.description);
        if (fallback !== undefined) mergeDescriptionField(desc, 'summary', fallback);
      }
    }

    function parseTextDescription(desc, text) {
      if (!text) return;
      var lines = text.split(/\n+/).map(function(line) { return line.trim(); }).filter(Boolean);
      var activeField = '';
      var summaryParts = [];
      lines.forEach(function(line) {
        var bullet = line.replace(/^[\-\*\u2022]+\s*/, '');
        var match = bullet.match(/^\*\*(.+?)\*\*[:：]?\s*(.*)$/);
        if (match) {
          var field = determineDescriptionField(match[1]);
          activeField = field || '';
          var content = match[2] ? match[2].trim() : '';
          if (field) {
            mergeDescriptionField(desc, field, content || '');
          } else if (content) {
            summaryParts.push(content);
          }
          return;
        }
        if (activeField) {
          mergeDescriptionField(desc, activeField, bullet);
        } else {
          summaryParts.push(bullet);
        }
      });
      if (summaryParts.length) mergeDescriptionField(desc, 'summary', summaryParts.join('\n'));
    }

    function normalizeDescriptionSource(value, fallbackRaw, expectJson) {
      var result = { summary: '', goals: [], rules: [], constraints: [], flows: [], values: [], configs: [] };
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.keys(cleanedDescriptionFieldAliases).forEach(function(field) {
          var aliases = cleanedDescriptionFieldAliases[field];
          var val = pickFirstValue(value, aliases);
          if (val !== undefined) {
            if (field === 'summary') {
              var text = coerceText(val);
              if (text) result.summary = text;
            } else {
              var list = coerceTextList(val);
              if (list.length) result[field] = list;
            }
          }
        });
        return result;
      }
      var textVal = coerceText(value);
      if (textVal) result.summary = textVal;
      else if (!expectJson && fallbackRaw) result.summary = fallbackRaw;
      return result;
    }

    function buildDescriptionForEntry(entry, fallbackRaw, expectJson) {
      var desc = createEmptyDescription();
      var descValue = pickFirstValue(entry, cleanedEntryFieldAliases.description);
      var source = normalizeDescriptionSource(descValue, fallbackRaw, expectJson);
      if (descValue && typeof descValue === 'object' && !Array.isArray(descValue)) {
        fillDescriptionFromObject(desc, descValue);
      } else if (descValue) {
        parseTextDescription(desc, coerceText(descValue));
      }
      Object.keys(cleanedDescriptionFieldAliases).forEach(function(field) {
        var value = pickFirstValue(entry, cleanedDescriptionFieldAliases[field]);
        if (value !== undefined) mergeDescriptionField(desc, field, value);
      });
      if (!desc.summary) {
        var fallback = !expectJson ? (coerceText(descValue) || fallbackRaw || '') : '';
        if (fallback) desc.summary = fallback;
      }
      if (!source.summary && desc.summary) source.summary = desc.summary;
      ['goals', 'rules', 'constraints', 'flows', 'values', 'configs'].forEach(function(field) {
        if ((!Array.isArray(source[field]) || !source[field].length) && Array.isArray(desc[field]) && desc[field].length) {
          source[field] = desc[field].slice();
        } else if (!Array.isArray(source[field])) {
          source[field] = [];
        }
      });
      return { desc: desc, source: source };
    }

    function normalizeCleanedEntry(entry, idx, fallbackRaw, expectJson) {
      var fallback = fallbackRaw || '';
      if (!entry || typeof entry !== 'object') {
        var text = entry === undefined || entry === null ? '' : entry.toString().trim();
        var desc = createEmptyDescription();
        if (text || fallback) desc.summary = text || fallback;
        return {
          feature: '功能点' + (idx + 1),
          category: '',
          description: desc,
          descriptionSource: Object.assign({}, desc),
          rawRequirement: text || fallback,
        };
      }
      var feature = (pickFirstString(entry, cleanedEntryFieldAliases.feature) || ('功能点' + (idx + 1))).trim();
      var category = pickFirstString(entry, cleanedEntryFieldAliases.category) || '';
      var rawValue = pickFirstValue(entry, cleanedEntryFieldAliases.raw);
      var rawList = Array.isArray(rawValue) ? rawValue.map(function(item) { return coerceText(item); }).filter(Boolean) : [];
      var rawSegments = rawList.length
        ? rawList
        : coerceText(rawValue)
        ? [coerceText(rawValue)]
        : fallback
        ? [fallback]
        : [];
      var rawRequirement = rawSegments.length ? rawSegments.join('\n') : fallback;
      var built = buildDescriptionForEntry(entry, rawRequirement, expectJson);
      return {
        feature: feature,
        category: category,
        description: built.desc,
        descriptionSource: built.source,
        rawSegments: rawSegments,
        rawRequirement: rawRequirement || fallback,
      };
    }

    function ensureCleanedEntries(data, rawTextValue, expectJson) {
      var fallback = rawTextValue || '';
      var entries = [];
      if (Array.isArray(data)) {
        entries = data;
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.items)) {
          entries = data.items;
        } else if (Array.isArray(data.list)) {
          entries = data.list;
        } else if (Array.isArray(data.data)) {
          entries = data.data;
        } else if (Array.isArray(data.功能条目)) {
          entries = data.功能条目;
        } else {
          entries = Object.entries(data).map(function(pair) {
            var key = pair[0];
            var value = pair[1];
            if (value && typeof value === 'object') return Object.assign({ feature: key }, value);
            return { feature: key, description: value };
          });
        }
      } else if (typeof data === 'string' && data.trim()) {
        entries = [{ feature: '功能点1', description: data.trim(), rawRequirement: fallback || data.trim() }];
      }
      if (!entries.length) {
        var desc = createEmptyDescription();
        if (fallback) desc.summary = fallback;
        return [{
          feature: '功能点1',
          category: '',
          description: desc,
          descriptionSource: Object.assign({}, desc),
          rawSegments: fallback ? [fallback] : [],
          rawRequirement: fallback,
        }];
      }
      return entries.map(function(entry, idx) { return normalizeCleanedEntry(entry, idx, fallback, expectJson); });
    }

    function buildCleanedEntries(rawTextValue, contentText, expectJson) {
      var parsed = parseCleanedContent(contentText || '');
      return ensureCleanedEntries(parsed, rawTextValue, expectJson);
    }

    function stringifyDescription(desc) {
      if (!desc) return '';
      if (typeof desc === 'string') return desc;
      var parts = [];
      if (desc.summary) parts.push(desc.summary);
      if (Array.isArray(desc.goals) && desc.goals.length) parts.push('目标：' + desc.goals.join('；'));
      if (Array.isArray(desc.rules) && desc.rules.length) parts.push('规则：' + desc.rules.join('；'));
      if (Array.isArray(desc.constraints) && desc.constraints.length) parts.push('约束：' + desc.constraints.join('；'));
      if (Array.isArray(desc.flows) && desc.flows.length) parts.push('流程：' + desc.flows.join('；'));
      if (Array.isArray(desc.values) && desc.values.length) parts.push('数值：' + desc.values.join('；'));
      if (Array.isArray(desc.configs) && desc.configs.length) parts.push('配置：' + desc.configs.join('；'));
      return parts.join('\n');
    }

    function stripRawFields(data) {
      if (Array.isArray(data)) {
        return data.map(function(item) { return stripRawFields(item); });
      }
      if (data && typeof data === 'object') {
        var clone = Array.isArray(data) ? [] : {};
        Object.keys(data).forEach(function(key) {
          if (rawFieldNameSet.has(key.toLowerCase())) return;
          clone[key] = stripRawFields(data[key]);
        });
        return clone;
      }
      return data;
    }

    function formatCleanList(list, escapeFn) {
      if (!Array.isArray(list) || !list.length) return '-';
      var escapeHtml = escapeFn || function(text) { return text; };
      return list.map(function(item) { return escapeHtml(item).replace(/\n/g, '<br>'); }).join('<br>');
    }

    return {
      shouldExpectCleanJson: shouldExpectCleanJson,
      buildCleanedEntries: buildCleanedEntries,
      stringifyDescription: stringifyDescription,
      stripRawFields: stripRawFields,
      formatCleanList: formatCleanList,
      tryParseCleanJson: tryParseCleanJson,
      repairCleanJsonText: repairLooseNewlines,
    };
  }

  window.app = window.app || {};
  window.app.cleanCore = { init: init };
})();
