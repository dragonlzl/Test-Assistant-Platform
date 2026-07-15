(function() {
  window.app = window.app || {};

  var DEFAULT_MAX_CASES_PER_BATCH = 60;
  var DEFAULT_MAX_CONCURRENT_BATCHES = 5;
  var DEFAULT_REFERENCE_TEXT_LIMITS = {
    title: 120,
    preconditions: 160,
    steps: 280,
    expected: 200,
  };

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

  function normalizeModule(item, index) {
    if (!item || typeof item !== 'object') return null;
    var title = getModuleTitle(item);
    var key = getModuleKey(item, title);
    var cases = Array.isArray(item.cases) ? cloneJson(item.cases, []) : [];
    if (!title || !key || !cases.length) return null;
    return {
      moduleId: item.moduleId || item.module_id ? String(item.moduleId || item.module_id || '') : '',
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
    return (Array.isArray(list) ? list : []).map(normalizeModule).filter(Boolean);
  }

  function truncateText(value, limit) {
    var text = normalizeText(value);
    var maxLength = Number(limit || 0);
    if (!Number.isFinite(maxLength) || maxLength <= 0 || text.length <= maxLength) return text;
    return text.slice(0, Math.max(1, maxLength - 1)) + '…';
  }

  function normalizeCaseSteps(value) {
    if (Array.isArray(value)) {
      return value.map(normalizeText).filter(Boolean).join('；');
    }
    return normalizeText(value);
  }

  function compactReferenceCase(item, limits) {
    var source = item && typeof item === 'object' ? item : {};
    var activeLimits = limits && typeof limits === 'object' ? limits : DEFAULT_REFERENCE_TEXT_LIMITS;
    return {
      title: truncateText(
        source.title || source.caseTitle || source.case_title || source.name || source['标题'] || '',
        activeLimits.title
      ),
      preconditions: truncateText(
        source.preconditions || source.precondition || source['前置条件'] || '',
        activeLimits.preconditions
      ),
      steps: truncateText(
        normalizeCaseSteps(source.steps || source.step || source['步骤'] || ''),
        activeLimits.steps
      ),
      expected: truncateText(
        source.expected || source.expect || source['预期结果'] || '',
        activeLimits.expected
      ),
    };
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
    var moduleMap = {};
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
      batchCount: batches.length,
      batches: batches,
    };
  }

  function buildRemovedRecordKey(item, index) {
    var source = item && typeof item === 'object' ? item : {};
    return [
      normalizeModuleKey(source.moduleKey || source.module || ''),
      normalizeText(source.signature || source.title || ''),
      normalizeText(source.actionType || source.type || ''),
      normalizeText(source.duplicateOf || source.duplicate_with || ''),
      normalizeText(source.mergedInto || source.merged_into || ''),
      String(index || 0),
    ].join('::');
  }

  function mergeBatchResults(originalModules, batchEntries) {
    var modules = normalizeModules(originalModules);
    var moduleMap = {};
    var removedCases = [];
    var removedSeen = {};
    var diagnostics = [];
    modules.forEach(function(module) {
      moduleMap[module.moduleKey] = {
        moduleId: module.moduleId,
        moduleKey: module.moduleKey,
        module: module.module,
        beforeCount: module.cases.length,
        afterCount: 0,
        usedFallback: false,
        cases: [],
      };
    });
    (Array.isArray(batchEntries) ? batchEntries : []).forEach(function(entry, batchIndex) {
      var result = entry && entry.result && typeof entry.result === 'object' ? entry.result : {};
      (Array.isArray(result.modules) ? result.modules : []).forEach(function(module) {
        var key = getModuleKey(module, getModuleTitle(module));
        var target = moduleMap[key];
        if (!target) return;
        target.cases = target.cases.concat(cloneJson(module.cases, []));
        target.afterCount = target.cases.length;
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
      if (!merged || !merged.cases.length) {
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
      removedCount: Math.max(0, beforeCount - afterCount, removedCases.length),
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
