(function() {
  window.app = window.app || {};

  var DEFAULT_MAX_CASES_PER_BATCH = 60;
  var DEFAULT_MAX_CONCURRENT_BATCHES = 5;
  var DEFAULT_REFERENCE_TEXT_LIMITS = {};

  function cloneJson(value, fallback) {
    if (value === undefined || value === null) return fallback;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (err) {
      return fallback;
    }
  }

  function normalizeText(value) {
    return value === null || value === undefined ? '' : String(value || '').trim();
  }

  function normalizeModuleKey(value) {
    return normalizeText(value).toLowerCase().replace(/\s+/g, '');
  }

  function getModuleTitle(item) {
    var source = item && typeof item === 'object' ? item : {};
    return normalizeText(
      source.module || source.moduleName || source.module_name
      || source.title || source.moduleTitle || source.module_title || ''
    );
  }

  function getModuleKey(item, fallbackTitle) {
    var source = item && typeof item === 'object' ? item : {};
    return normalizeModuleKey(source.moduleKey || source.module_key || source.key || fallbackTitle || '');
  }

  function getModuleId(item) {
    return normalizeText(item.moduleId || item.module_id || '');
  }

  function getCaseDedupeId(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
    return normalizeText(item.dedupe_id || item.dedupeId || item.dedupeID || item.id || item.caseId || item.case_id || '');
  }

  function normalizeModule(item, index) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('AI 用例去重批次包含无效模块');
    if (!Array.isArray(item.cases)) throw new Error('AI 用例去重批次包含无效用例列表');
    if (!item.cases.length) return null;
    var title = getModuleTitle(item);
    var key = getModuleKey(item, title);
    if (!title || !key) throw new Error('AI 用例去重批次包含无效模块');
    var cases = cloneJson(item.cases, null);
    if (!cases) throw new Error('AI 用例去重批次包含无效用例列表');
    cases = cases.map(function(caseItem, caseIndex) {
      if (!caseItem || typeof caseItem !== 'object' || Array.isArray(caseItem)) throw new Error('AI 用例去重批次包含无效用例');
      if (!getCaseDedupeId(caseItem)) caseItem.dedupe_id = 'batch:' + key + ':' + String(caseIndex + 1);
      return caseItem;
    });
    return {
      moduleId: getModuleId(item),
      moduleKey: key,
      module: title,
      key_scenarios: Array.isArray(item.key_scenarios) ? cloneJson(item.key_scenarios, []) : [],
      test_points: Array.isArray(item.test_points) ? cloneJson(item.test_points, []) : [],
      coupled_modules: Array.isArray(item.coupled_modules) ? cloneJson(item.coupled_modules, []) : [],
      cases: cases,
      sourceIndex: Number(index || 0),
    };
  }

  function normalizeModules(list) {
    if (list !== undefined && list !== null && !Array.isArray(list)) throw new Error('AI 用例去重模块列表无效');
    var seen = Object.create(null);
    var caseIds = Object.create(null);
    return (Array.isArray(list) ? list : []).map(function(item, index) {
      var module = normalizeModule(item, index);
      if (!module) return null;
      if (seen[module.moduleKey]) throw new Error('AI 用例去重输入模块键重复：' + module.moduleKey);
      seen[module.moduleKey] = true;
      module.cases.forEach(function(caseItem) {
        var id = getCaseDedupeId(caseItem);
        if (caseIds[id]) throw new Error('AI 用例去重输入用例标识重复：' + id);
        caseIds[id] = true;
      });
      return module;
    }).filter(Boolean);
  }

  function compactReferenceCase(item, limits) {
    var source = item && typeof item === 'object' ? item : {};
    var result = {
      title: cloneJson(source.title || source.caseTitle || source.case_title || source.name || source['标题'] || '', ''),
      preconditions: cloneJson(source.preconditions || source.precondition || source['前置条件'] || '', ''),
      steps: cloneJson(source.steps !== undefined ? source.steps : (source.step !== undefined ? source.step : source['步骤'] || ''), ''),
      expected: cloneJson(source.expected || source.expect || source['预期结果'] || '', ''),
    };
    var dedupeId = getCaseDedupeId(source);
    if (dedupeId) result.dedupe_id = dedupeId;
    return result;
  }

  function mergeModuleFragment(target, fragment) {
    if (!target || !fragment) return target;
    target.cases = target.cases.concat(cloneJson(fragment.cases, []));
    return target;
  }

  function appendModuleFragment(list, module, cases) {
    if (!module || !Array.isArray(cases) || !cases.length) return;
    var last = list.length ? list[list.length - 1] : null;
    if (last && last.moduleKey === module.moduleKey) {
      mergeModuleFragment(last, { cases: cases });
      return;
    }
    list.push({
      moduleId: module.moduleId,
      moduleKey: module.moduleKey,
      module: module.module,
      key_scenarios: cloneJson(module.key_scenarios, []),
      test_points: cloneJson(module.test_points, []),
      coupled_modules: cloneJson(module.coupled_modules, []),
      cases: cloneJson(cases, []),
      sourceIndex: module.sourceIndex,
    });
  }

  function buildTargetBatches(modules, maxCasesPerBatch) {
    var batches = [];
    var currentModules = [];
    var currentCaseCount = 0;

    function flushCurrentBatch() {
      if (!currentModules.length) return;
      batches.push({
        id: 'dedupe-batch-' + String(batches.length + 1),
        index: batches.length,
        modules: currentModules,
        targetCaseCount: currentCaseCount,
      });
      currentModules = [];
      currentCaseCount = 0;
    }

    modules.forEach(function(module) {
      var offset = 0;
      while (offset < module.cases.length) {
        if (currentCaseCount >= maxCasesPerBatch) flushCurrentBatch();
        var available = Math.max(1, maxCasesPerBatch - currentCaseCount);
        var nextCases = module.cases.slice(offset, offset + available);
        appendModuleFragment(currentModules, module, nextCases);
        currentCaseCount += nextCases.length;
        offset += nextCases.length;
        if (currentCaseCount >= maxCasesPerBatch) flushCurrentBatch();
      }
    });
    flushCurrentBatch();
    return batches;
  }

  function buildReferenceModules(previousBatches, limits) {
    var result = [];
    var moduleMap = Object.create(null);
    (Array.isArray(previousBatches) ? previousBatches : []).forEach(function(batch) {
      (batch && Array.isArray(batch.modules) ? batch.modules : []).forEach(function(module) {
        if (!module || !module.moduleKey) return;
        var target = moduleMap[module.moduleKey];
        if (!target) {
          target = {
            moduleId: module.moduleId,
            moduleKey: module.moduleKey,
            module: module.module,
            cases: [],
          };
          moduleMap[module.moduleKey] = target;
          result.push(target);
        }
        (Array.isArray(module.cases) ? module.cases : []).forEach(function(caseItem) {
          target.cases.push(compactReferenceCase(caseItem, limits));
        });
      });
    });
    return result;
  }

  function buildBatchPlan(inputModules, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var modules = normalizeModules(inputModules);
    var configuredLimit = Number(opts.maxCasesPerBatch || DEFAULT_MAX_CASES_PER_BATCH);
    var maxCasesPerBatch = Number.isFinite(configuredLimit) && configuredLimit > 0
      ? Math.floor(configuredLimit)
      : DEFAULT_MAX_CASES_PER_BATCH;
    var configuredConcurrency = Number(opts.maxConcurrentBatches || DEFAULT_MAX_CONCURRENT_BATCHES);
    var maxConcurrentBatches = Number.isFinite(configuredConcurrency) && configuredConcurrency > 0
      ? Math.min(DEFAULT_MAX_CONCURRENT_BATCHES, Math.floor(configuredConcurrency))
      : DEFAULT_MAX_CONCURRENT_BATCHES;
    var limits = Object.assign({}, DEFAULT_REFERENCE_TEXT_LIMITS, opts.referenceTextLimits || {});
    var targetBatches = buildTargetBatches(modules, maxCasesPerBatch);
    var batches = targetBatches.map(function(batch, index) {
      var references = buildReferenceModules(targetBatches.slice(0, index), limits);
      var referenceCaseCount = references.reduce(function(total, module) {
        return total + (Array.isArray(module.cases) ? module.cases.length : 0);
      }, 0);
      return {
        id: batch.id,
        index: batch.index,
        modules: cloneJson(batch.modules, []),
        referenceModules: references,
        targetCaseCount: batch.targetCaseCount,
        referenceCaseCount: referenceCaseCount,
      };
    });
    var totalCaseCount = modules.reduce(function(total, module) {
      return total + module.cases.length;
    }, 0);
    return {
      enabled: batches.length > 1,
      maxCasesPerBatch: maxCasesPerBatch,
      maxConcurrentBatches: Math.min(maxConcurrentBatches, Math.max(1, batches.length)),
      totalCaseCount: totalCaseCount,
      moduleCount: modules.length,
      modules: cloneJson(modules, []),
      batchCount: batches.length,
      batches: batches,
    };
  }

  function buildRemovedRecordKey(item, index) {
    var source = item && typeof item === 'object' ? item : {};
    try {
      return 'json::' + JSON.stringify(source);
    } catch (err) {
      return 'index::' + String(index || 0);
    }
  }

  function getExpectedBatchKey(batch, index) {
    if (!batch || typeof batch !== 'object') return 'index::' + String(index);
    if (batch.id !== undefined && batch.id !== null && String(batch.id) !== '') return 'id::' + String(batch.id);
    if (batch.index !== undefined && batch.index !== null) return 'index::' + String(batch.index);
    return 'index::' + String(index);
  }

  function getBatchEntryKey(entry, index) {
    if (!entry || typeof entry !== 'object') return '';
    if (entry.id !== undefined && entry.id !== null && String(entry.id) !== '') return 'id::' + String(entry.id);
    if (entry.index !== undefined && entry.index !== null) return 'index::' + String(entry.index);
    return 'index::' + String(index);
  }

  function getExpectedBatchModules(batch) {
    if (!batch || !Array.isArray(batch.modules)) throw new Error('AI 用例去重批次包含无效模块列表');
    return batch.modules;
  }

  function buildModuleCaseIndex(module) {
    if (!module || typeof module !== 'object' || Array.isArray(module) || !Array.isArray(module.cases)) {
      throw new Error('AI 用例去重批次包含无效用例列表');
    }
    var title = getModuleTitle(module);
    var key = getModuleKey(module, title);
    if (!title || !key) throw new Error('AI 用例去重批次包含无效模块');
    var cases = Object.create(null);
    module.cases.forEach(function(caseItem) {
      var id = getCaseDedupeId(caseItem);
      if (!id) throw new Error('AI 用例去重批次包含无效用例标识');
      if (cases[id]) throw new Error('AI 用例去重批次包含重复用例标识');
      cases[id] = caseItem;
    });
    return { moduleKey: key, moduleId: getModuleId(module), module: title, cases: cases };
  }

  function validateModuleResult(module, expected, seenCaseIds) {
    var actual = buildModuleCaseIndex(module);
    if (actual.moduleId !== expected.moduleId) throw new Error('AI 用例去重批次模块ID被改写');
    if (actual.module !== expected.module) throw new Error('AI 用例去重批次模块标题被改写');
    Object.keys(actual.cases).forEach(function(id) {
      if (!expected.cases[id]) throw new Error('AI 用例去重批次返回了非目标用例：' + id);
      if (seenCaseIds[id]) throw new Error('AI 用例去重批次结果包含重复用例：' + id);
      seenCaseIds[id] = true;
    });
  }

  function validateBatchResult(entry, expectedBatch) {
    if (!entry || !entry.result || typeof entry.result !== 'object') {
      throw new Error('AI 用例去重批次缺少结果');
    }
    var expectedModules = getExpectedBatchModules(expectedBatch);
    var resultModules = Array.isArray(entry.result.modules) ? entry.result.modules : null;
    if (!resultModules) throw new Error('AI 用例去重批次缺少模块结果');
    var expectedKeys = Object.create(null);
    expectedModules.forEach(function(module) {
      var indexed = buildModuleCaseIndex(module);
      if (expectedKeys[indexed.moduleKey]) throw new Error('AI 用例去重批次包含重复模块');
      expectedKeys[indexed.moduleKey] = indexed;
    });
    var resultKeys = Object.create(null);
    var seenCaseIds = Object.create(null);
    resultModules.forEach(function(module) {
      if (!module || typeof module !== 'object' || !Array.isArray(module.cases)) {
        throw new Error('AI 用例去重批次包含无效用例列表');
      }
      var title = getModuleTitle(module);
      var key = getModuleKey(module, title);
      if (!key || resultKeys[key]) throw new Error('AI 用例去重批次包含重复或无效模块结果');
      if (!expectedKeys[key]) throw new Error('AI 用例去重批次返回了非目标模块');
      if (module.usedFallback === true) throw new Error('AI 用例去重批次缺少模块结果');
      validateModuleResult(module, expectedKeys[key], seenCaseIds);
      resultKeys[key] = true;
    });
    Object.keys(expectedKeys).forEach(function(key) {
      if (resultKeys[key] !== true) throw new Error('AI 用例去重批次缺少模块结果');
    });
  }

  function mergeBatchResults(originalModules, batchEntries, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var expectedBatches = Array.isArray(opts.expectedBatches) ? opts.expectedBatches : null;
    if (expectedBatches) {
      var entries = Array.isArray(batchEntries) ? batchEntries : [];
      var expectedKeys = Object.create(null);
      expectedBatches.forEach(function(batch, index) {
        var key = getExpectedBatchKey(batch, index);
        if (expectedKeys[key]) throw new Error('AI 用例去重批次计划包含重复批次');
        expectedKeys[key] = batch;
      });
      var actualKeys = Object.create(null);
      entries.forEach(function(entry, index) {
        var key = getBatchEntryKey(entry, index);
        if (!key || actualKeys[key]) throw new Error('AI 用例去重批次结果包含重复批次');
        if (!expectedKeys[key]) throw new Error('AI 用例去重批次结果无法匹配计划');
        actualKeys[key] = true;
        validateBatchResult(entry, expectedKeys[key]);
      });
      expectedBatches.forEach(function(batch, index) {
        if (actualKeys[getExpectedBatchKey(batch, index)] !== true) {
          throw new Error('AI 用例去重批次结果不完整');
        }
      });
    }
    var modules = normalizeModules(originalModules);
    var moduleMap = Object.create(null);
    var sourceModuleMap = Object.create(null);
    var seenCaseIds = Object.create(null);
    var removedCases = [];
    var removedSeen = Object.create(null);
    var diagnostics = [];
    modules.forEach(function(module) {
      sourceModuleMap[module.moduleKey] = buildModuleCaseIndex(module);
      moduleMap[module.moduleKey] = {
        moduleId: module.moduleId,
        moduleKey: module.moduleKey,
        module: module.module,
        beforeCount: module.cases.length,
        afterCount: 0,
        usedFallback: false,
        hasResult: false,
        cases: [],
      };
    });
    (Array.isArray(batchEntries) ? batchEntries : []).forEach(function(entry, batchIndex) {
      var result = entry && entry.result && typeof entry.result === 'object' ? entry.result : null;
      if (!result || !Array.isArray(result.modules)) throw new Error('AI 用例去重批次缺少模块结果');
      result.modules.forEach(function(module) {
        var key = getModuleKey(module, getModuleTitle(module));
        var target = moduleMap[key];
        if (!target) throw new Error('AI 用例去重批次返回了非目标模块');
        validateModuleResult(module, sourceModuleMap[key], seenCaseIds);
        var nextCases = cloneJson(module.cases, null);
        if (!nextCases) throw new Error('AI 用例去重聚合包含无效用例列表');
        target.cases = target.cases.concat(nextCases);
        target.afterCount = target.cases.length;
        target.hasResult = true;
        if (module.usedFallback === true) target.usedFallback = true;
      });
      (Array.isArray(result.removedCases) ? result.removedCases : []).forEach(function(item, itemIndex) {
        var key = buildRemovedRecordKey(item, batchIndex * 100000 + itemIndex);
        if (removedSeen[key]) return;
        removedSeen[key] = true;
        removedCases.push(cloneJson(item, {}));
      });
      (Array.isArray(result.diagnostics) ? result.diagnostics : []).forEach(function(item) {
        var text = normalizeText(item);
        if (text) diagnostics.push('批次 ' + String(batchIndex + 1) + '：' + text);
      });
    });
    var resultModules = modules.map(function(source) {
      var merged = moduleMap[source.moduleKey];
      if (!merged || !merged.hasResult) {
        return {
          moduleId: source.moduleId,
          moduleKey: source.moduleKey,
          module: source.module,
          beforeCount: source.cases.length,
          afterCount: source.cases.length,
          usedFallback: true,
          cases: cloneJson(source.cases, []),
        };
      }
      merged.afterCount = merged.cases.length;
      return merged;
    });
    var beforeCount = resultModules.reduce(function(total, module) {
      return total + Number(module.beforeCount || 0);
    }, 0);
    var afterCount = resultModules.reduce(function(total, module) {
      return total + Number(module.afterCount || 0);
    }, 0);
    return {
      modules: resultModules,
      beforeCount: beforeCount,
      afterCount: afterCount,
      removedCount: Math.max(0, beforeCount - afterCount),
      removedCases: removedCases,
      diagnostics: diagnostics,
    };
  }

  window.app.xmindDedupeBatchCore = {
    DEFAULT_MAX_CASES_PER_BATCH: DEFAULT_MAX_CASES_PER_BATCH,
    DEFAULT_MAX_CONCURRENT_BATCHES: DEFAULT_MAX_CONCURRENT_BATCHES,
    buildBatchPlan: buildBatchPlan,
    compactReferenceCase: compactReferenceCase,
    mergeBatchResults: mergeBatchResults,
  };
})();
