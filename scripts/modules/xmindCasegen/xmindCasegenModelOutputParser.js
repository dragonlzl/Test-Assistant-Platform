(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.xmindCasegenModelOutputParser = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var stripCodeFence = typeof opts.stripCodeFence === 'function'
      ? opts.stripCodeFence
      : function(text) {
        var raw = String(text || '').trim();
        var matched = raw.match(/^```[\w-]*\n([\s\S]*?)```$/);
        return matched && matched[1] ? matched[1].trim() : raw;
      };
    var normalizeModuleTitle = typeof opts.normalizeModuleTitle === 'function'
      ? opts.normalizeModuleTitle
      : function(value) { return String(value || '').replace(/\s+/g, ' ').trim(); };
    var normalizeArrayField = typeof opts.normalizeArrayField === 'function'
      ? opts.normalizeArrayField
      : function(value) {
        if (Array.isArray(value)) {
          return value.map(function(item) { return String(item || '').replace(/\s+/g, ' ').trim(); }).filter(Boolean);
        }
        var text = String(value || '').replace(/\s+/g, ' ').trim();
        return text ? [text] : [];
      };
    var normalizeCaseItem = typeof opts.normalizeCaseItem === 'function'
      ? opts.normalizeCaseItem
      : function() { return null; };

    function summarizeModelOutputText(text, maxLength) {
      var limit = Number(maxLength);
      var clean = String(text || '').replace(/\s+/g, ' ').trim();
      if (!clean) return '';
      if (!Number.isFinite(limit) || limit <= 0) limit = 120;
      if (clean.length <= limit) return clean;
      return clean.slice(0, limit).trim() + '…';
    }

    function normalizeHistoryLongText(text, maxLength) {
      var limit = Number(maxLength);
      var clean = String(text || '').replace(/\s+/g, ' ').trim();
      if (!clean) return '';
      if (!Number.isFinite(limit) || limit <= 0) limit = 2000;
      if (clean.length <= limit) return clean;
      return clean.slice(0, limit).trim() + '…';
    }

    function createModelOutputDiagnostics() {
      return {
        rawHasText: false,
        rawPreview: '',
        parseStatus: '',
        parseMode: '',
        payloadKind: '',
        sourceKind: '',
        missingModulesArray: false,
        emptyModulesArray: false,
        moduleCandidateCount: 0,
        normalizedModuleCount: 0,
        skippedNonObjectModules: 0,
        caseCandidateCount: 0,
        normalizedCaseCount: 0,
        skippedInvalidCases: 0,
      };
    }

    function extractJsonPayloadDetailed(text) {
      var raw = stripCodeFence(text || '');
      var diagnostics = createModelOutputDiagnostics();
      diagnostics.rawHasText = Boolean(raw);
      diagnostics.rawPreview = summarizeModelOutputText(raw, 120);
      if (!raw) {
        diagnostics.parseStatus = 'empty';
        return {
          payload: null,
          diagnostics: diagnostics,
        };
      }
      try {
        diagnostics.parseStatus = 'json';
        diagnostics.parseMode = 'direct';
        return {
          payload: JSON.parse(raw),
          diagnostics: diagnostics,
        };
      } catch (err) {}
      var start = raw.indexOf('{');
      var end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          diagnostics.parseStatus = 'json';
          diagnostics.parseMode = 'object-slice';
          return {
            payload: JSON.parse(raw.slice(start, end + 1)),
            diagnostics: diagnostics,
          };
        } catch (err2) {}
      }
      var arrStart = raw.indexOf('[');
      var arrEnd = raw.lastIndexOf(']');
      if (arrStart >= 0 && arrEnd > arrStart) {
        try {
          diagnostics.parseStatus = 'json';
          diagnostics.parseMode = 'array-slice';
          return {
            payload: JSON.parse(raw.slice(arrStart, arrEnd + 1)),
            diagnostics: diagnostics,
          };
        } catch (err3) {}
      }
      diagnostics.parseStatus = /[\{\[]/.test(raw) ? 'invalid-json' : 'plain-text';
      return {
        payload: null,
        diagnostics: diagnostics,
      };
    }

    function normalizeModelModulesOutputDetailed(content) {
      var extracted = extractJsonPayloadDetailed(content);
      var payload = extracted.payload;
      var diagnostics = extracted.diagnostics || createModelOutputDiagnostics();
      var arr = [];
      if (Array.isArray(payload)) {
        arr = payload;
        diagnostics.payloadKind = 'array';
        diagnostics.sourceKind = 'root-array';
      } else if (payload && typeof payload === 'object') {
        diagnostics.payloadKind = 'object';
        if (Array.isArray(payload.modules)) {
          arr = payload.modules;
          diagnostics.sourceKind = 'modules';
        } else if (Array.isArray(payload.data)) {
          arr = payload.data;
          diagnostics.sourceKind = 'data';
        } else {
          diagnostics.missingModulesArray = true;
        }
      } else if (payload !== null && payload !== undefined) {
        diagnostics.payloadKind = typeof payload;
        diagnostics.missingModulesArray = true;
      }

      diagnostics.moduleCandidateCount = Array.isArray(arr) ? arr.length : 0;
      diagnostics.emptyModulesArray = diagnostics.moduleCandidateCount === 0 && Boolean(diagnostics.sourceKind);

      var list = (Array.isArray(arr) ? arr : []).map(function(item) {
        if (!item || typeof item !== 'object') {
          diagnostics.skippedNonObjectModules += 1;
          return null;
        }
        var moduleTitle = normalizeModuleTitle(item.module || item.title || item.name || '未命名模块');
        if (!moduleTitle) return null;
        diagnostics.normalizedModuleCount += 1;
        var moduleInfo = {
          module: moduleTitle,
          key_scenarios: normalizeArrayField(item.key_scenarios || item.scenarios),
          test_points: normalizeArrayField(item.test_points || item.points),
          coupled_modules: normalizeArrayField(item.coupled_modules || item.coupled),
          cases: [],
        };
        var cases = Array.isArray(item.cases) ? item.cases : [];
        diagnostics.caseCandidateCount += cases.length;
        cases.forEach(function(caseItem) {
          var normalized = normalizeCaseItem(caseItem, moduleTitle);
          if (!normalized) {
            diagnostics.skippedInvalidCases += 1;
            return;
          }
          diagnostics.normalizedCaseCount += 1;
          moduleInfo.cases.push(normalized);
        });
        return moduleInfo;
      }).filter(Boolean);

      return {
        list: list,
        diagnostics: diagnostics,
      };
    }

    return {
      summarizeModelOutputText: summarizeModelOutputText,
      normalizeHistoryLongText: normalizeHistoryLongText,
      createModelOutputDiagnostics: createModelOutputDiagnostics,
      extractJsonPayloadDetailed: extractJsonPayloadDetailed,
      normalizeModelModulesOutputDetailed: normalizeModelModulesOutputDetailed,
    };
  }

  return {
    create: create,
  };
});
