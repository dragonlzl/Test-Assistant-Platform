(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.aiGenModel = api;
  }
})(function() {
  function defaultNormalizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\r\n/g, '\n').trim();
  }

  function defaultNormalizePriority(value) {
    return defaultNormalizeText(value);
  }

  function defaultBuildCaseKey(item) {
    var source = item && typeof item === 'object' ? item : {};
    return [
      source.module,
      source.title,
      source.precondition,
      source.steps,
      source.expected,
    ].map(defaultNormalizeText).join('::').toLowerCase();
  }

  function defaultCreateAiKey() {
    return 'ai-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var normalizeText = typeof opts.normalizeText === 'function' ? opts.normalizeText : defaultNormalizeText;
    var normalizePriority = typeof opts.normalizePriority === 'function'
      ? opts.normalizePriority
      : defaultNormalizePriority;
    var buildCaseKey = typeof opts.buildCaseKey === 'function' ? opts.buildCaseKey : defaultBuildCaseKey;
    var hashText = typeof opts.hashText === 'function' ? opts.hashText : function(value) { return String(value || ''); };
    var stripCodeFence = typeof opts.stripCodeFence === 'function'
      ? opts.stripCodeFence
      : function(value) { return String(value || '').trim(); };
    var extractJsonPayload = typeof opts.extractJsonPayload === 'function'
      ? opts.extractJsonPayload
      : function() { return ''; };
    var createAiKey = typeof opts.createAiKey === 'function' ? opts.createAiKey : defaultCreateAiKey;

    function createDefaultState() {
      return {
        caseFileId: null,
        requirementText: '',
        requirementFileName: '',
        loading: false,
        generated: false,
        error: '',
        modules: [],
        selection: new Set(),
        taskSignature: '',
        taskId: '',
        runToken: '',
        resultToken: '',
        readResultToken: '',
        hasUnreadResult: false,
        generationMode: '',
        resultGeneratedCount: 0,
        resultDedupeCount: 0,
      };
    }

    function ensureState(hostState) {
      var host = hostState && typeof hostState === 'object' ? hostState : {};
      if (!host.aiGen || typeof host.aiGen !== 'object') host.aiGen = createDefaultState();
      if (!(host.aiGen.selection instanceof Set)) host.aiGen.selection = new Set();
      if (!Array.isArray(host.aiGen.modules)) host.aiGen.modules = [];
      if (!isFinite(Number(host.aiGen.resultGeneratedCount))) host.aiGen.resultGeneratedCount = 0;
      if (!isFinite(Number(host.aiGen.resultDedupeCount))) host.aiGen.resultDedupeCount = 0;
      return host.aiGen;
    }

    function resolveGenerationMode(prepContext) {
      var settings = prepContext && prepContext.settings ? prepContext.settings : {};
      if (settings.casePageGenerationMode === undefined || settings.casePageGenerationMode === null) return '';
      return String(settings.casePageGenerationMode || '').trim();
    }

    function resolveCoverageThreshold(value) {
      var number = Number(value);
      if (!isFinite(number)) number = 90;
      if (number < 50) number = 50;
      if (number > 100) number = 100;
      return Math.round(number);
    }

    function buildModuleList(items) {
      var output = [];
      var seen = Object.create(null);
      (Array.isArray(items) ? items : []).forEach(function(item) {
        var name = normalizeText(item && item.module ? item.module : '');
        if (!name) return;
        var key = name.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        output.push(name);
      });
      return output;
    }

    function buildCasePayload(items) {
      return (Array.isArray(items) ? items : []).map(function(item) {
        var source = item && typeof item === 'object' ? item : {};
        return {
          module: normalizeText(source.module || ''),
          title: normalizeText(source.title || ''),
          priority: normalizePriority(source.priority || '') || '',
          precondition: normalizeText(source.precondition || ''),
          steps: normalizeText(source.steps || ''),
          expected: normalizeText(source.expected || ''),
          remark: normalizeText(source.remark || ''),
        };
      });
    }

    function buildSignature(fileId, requirementText, moduleList, prepContext) {
      var seed = String(fileId || '') + '|' + String(requirementText || '') + '|'
        + (Array.isArray(moduleList) ? moduleList : []).join('|');
      if (prepContext && prepContext.settings) {
        try {
          seed += '|' + JSON.stringify(prepContext.settings);
        } catch (err) {
          seed += '|prep';
        }
      }
      if (prepContext && prepContext.requirementSupplement) {
        seed += '|' + String(prepContext.requirementSupplement || '');
      }
      return hashText(seed);
    }

    function normalizeGeneratedText(value) {
      if (value === null || value === undefined) return '';
      if (Array.isArray(value)) {
        return value.map(normalizeGeneratedText).filter(Boolean).join('\n');
      }
      return normalizeText(String(value || ''));
    }

    function normalizeGeneratedCase(raw, moduleName) {
      var item = raw && typeof raw === 'object' ? raw : {};
      var normalized = {
        module: normalizeText(item.module || '') || normalizeText(moduleName || ''),
        title: normalizeText(item.title || ''),
        priority: normalizePriority(item.priority || '') || 'P1',
        precondition: normalizeGeneratedText(item.precondition || item.preconditions || ''),
        steps: normalizeGeneratedText(item.steps || ''),
        expected: normalizeText(item.expected || ''),
        remark: normalizeText(item.remark || ''),
      };
      if (!normalized.module || !normalized.title || !normalized.expected) return null;
      return normalized;
    }

    function parseResult(raw) {
      var stripped = stripCodeFence(raw || '');
      var payloadText = extractJsonPayload(stripped);
      var data = JSON.parse(payloadText || stripped);
      if (!data || typeof data !== 'object') return { error: '模型返回格式不正确' };
      var missing = Array.isArray(data.missing_modules) ? data.missing_modules : null;
      var existing = Array.isArray(data.existing_modules) ? data.existing_modules : null;
      var xmindModules = Array.isArray(data.modules) ? data.modules : null;
      if (!missing || !existing) {
        if (!xmindModules) return { error: '模型返回格式不正确：缺少 missing_modules/existing_modules' };
        missing = [];
        existing = [];
      }
      var modules = [];

      function pushModule(entry, type) {
        if (!entry || typeof entry !== 'object') return;
        var moduleName = normalizeText(entry.module || entry.module_name || '');
        if (!moduleName) return;
        var coverage = Number(entry.coverage);
        if (!isFinite(coverage)) coverage = 0;
        var cases = [];
        (Array.isArray(entry.cases) ? entry.cases : []).forEach(function(rawCase) {
          var normalized = normalizeGeneratedCase(rawCase, moduleName);
          if (!normalized) return;
          var caseKey = buildCaseKey(normalized);
          if (caseKey) normalized.__aiCaseKey = caseKey;
          normalized.__aiKey = createAiKey();
          cases.push(normalized);
        });
        if (!cases.length) return;
        modules.push({
          module: moduleName,
          coverage: coverage,
          missing: type === 'missing',
          cases: cases,
        });
      }

      if (xmindModules) {
        xmindModules.forEach(function(entry) {
          pushModule(entry, entry && entry.missing === true ? 'missing' : 'existing');
        });
      } else {
        missing.forEach(function(entry) { pushModule(entry, 'missing'); });
        existing.forEach(function(entry) { pushModule(entry, 'existing'); });
      }
      return { modules: modules };
    }

    function applyAppendMap(modules, appendedMap) {
      var map = appendedMap && typeof appendedMap === 'object' ? appendedMap : {};
      (Array.isArray(modules) ? modules : []).forEach(function(moduleEntry) {
        (moduleEntry && Array.isArray(moduleEntry.cases) ? moduleEntry.cases : []).forEach(function(item) {
          if (!item || typeof item !== 'object') return;
          var caseKey = item.__aiCaseKey || buildCaseKey(item);
          if (caseKey) item.__aiCaseKey = caseKey;
          item.__aiAppended = Boolean(caseKey && map[caseKey]);
        });
      });
      return modules;
    }

    function countModuleCases(modules) {
      return (Array.isArray(modules) ? modules : []).reduce(function(total, moduleEntry) {
        return total + (moduleEntry && Array.isArray(moduleEntry.cases) ? moduleEntry.cases.length : 0);
      }, 0);
    }

    function normalizeCount(value) {
      var number = Number(value);
      if (!isFinite(number) || number < 0) return null;
      return Math.round(number);
    }

    function buildResultStats(parsed) {
      var modules = parsed && Array.isArray(parsed.modules) ? parsed.modules : [];
      var keptCount = countModuleCases(modules);
      var dedupe = parsed && parsed.ai_dedupe && typeof parsed.ai_dedupe === 'object'
        ? parsed.ai_dedupe
        : null;
      var removedCount = dedupe ? normalizeCount(dedupe.removedCount) : null;
      var generatedCount = dedupe ? normalizeCount(dedupe.beforeCount) : null;
      if (removedCount === null && generatedCount !== null) removedCount = Math.max(0, generatedCount - keptCount);
      if (removedCount === null && parsed && Array.isArray(parsed.removed_cases)) {
        removedCount = parsed.removed_cases.length;
      }
      if (removedCount === null && dedupe && Array.isArray(dedupe.removedCases)) {
        removedCount = dedupe.removedCases.length;
      }
      if (removedCount === null) removedCount = 0;
      if (generatedCount === null) generatedCount = keptCount + removedCount;
      return { generatedCount: generatedCount, dedupeCount: removedCount };
    }

    function formatCompleteStatus(aiState) {
      var source = aiState && typeof aiState === 'object' ? aiState : {};
      var generatedCount = normalizeCount(source.resultGeneratedCount);
      var dedupeCount = normalizeCount(source.resultDedupeCount);
      var text = '生成 ' + (generatedCount === null ? 0 : generatedCount)
        + ' 条，去重 ' + (dedupeCount === null ? 0 : dedupeCount) + ' 条';
      if (!source.modules || !source.modules.length) return '生成完成：' + text + '，未返回可追加用例';
      return '生成完成：' + text;
    }

    function countSelectableCases(modules) {
      var total = 0;
      (Array.isArray(modules) ? modules : []).forEach(function(moduleEntry) {
        (moduleEntry && Array.isArray(moduleEntry.cases) ? moduleEntry.cases : []).forEach(function(item) {
          if (item && item.__aiAppended !== true) total += 1;
        });
      });
      return total;
    }

    function buildSelection(modules) {
      var selection = new Set();
      (Array.isArray(modules) ? modules : []).forEach(function(moduleEntry) {
        (moduleEntry && Array.isArray(moduleEntry.cases) ? moduleEntry.cases : []).forEach(function(item) {
          if (item && item.__aiKey && item.__aiAppended !== true) selection.add(item.__aiKey);
        });
      });
      return selection;
    }

    function collectSelectedCases(modules, selection) {
      var selected = selection instanceof Set ? selection : new Set();
      var output = [];
      (Array.isArray(modules) ? modules : []).forEach(function(moduleEntry) {
        (moduleEntry && Array.isArray(moduleEntry.cases) ? moduleEntry.cases : []).forEach(function(item) {
          if (item && item.__aiKey && selected.has(item.__aiKey) && item.__aiAppended !== true) output.push(item);
        });
      });
      return output;
    }

    return {
      createDefaultState: createDefaultState,
      ensureState: ensureState,
      resolveGenerationMode: resolveGenerationMode,
      resolveCoverageThreshold: resolveCoverageThreshold,
      buildModuleList: buildModuleList,
      buildCasePayload: buildCasePayload,
      buildSignature: buildSignature,
      normalizeGeneratedText: normalizeGeneratedText,
      normalizeGeneratedCase: normalizeGeneratedCase,
      parseResult: parseResult,
      applyAppendMap: applyAppendMap,
      countModuleCases: countModuleCases,
      normalizeCount: normalizeCount,
      buildResultStats: buildResultStats,
      formatCompleteStatus: formatCompleteStatus,
      countSelectableCases: countSelectableCases,
      buildSelection: buildSelection,
      collectSelectedCases: collectSelectedCases,
    };
  }

  return { create: create };
});
