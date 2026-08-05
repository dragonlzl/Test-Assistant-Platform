(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.xmindCasegenGenerationPolicyModel = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var rootActions = opts.rootActions || {};
    var moduleActions = opts.moduleActions || {};
    var cloneJson = typeof opts.cloneJson === 'function'
      ? opts.cloneJson
      : function(value, fallback) {
        if (value === null || value === undefined) return fallback;
        try {
          return JSON.parse(JSON.stringify(value));
        } catch (err) {
          return fallback;
        }
      };
    var normalizeModuleTitle = typeof opts.normalizeModuleTitle === 'function'
      ? opts.normalizeModuleTitle
      : function(value) { return String(value || '').replace(/\s+/g, ' ').trim(); };
    var normalizeModuleKey = typeof opts.normalizeModuleKey === 'function'
      ? opts.normalizeModuleKey
      : function(value) { return normalizeModuleTitle(value).toLowerCase(); };
    var normalizeArrayField = typeof opts.normalizeArrayField === 'function'
      ? opts.normalizeArrayField
      : function(value) {
        if (Array.isArray(value)) {
          return value.map(function(item) { return String(item || '').replace(/\s+/g, ' ').trim(); }).filter(Boolean);
        }
        var text = String(value || '').replace(/\s+/g, ' ').trim();
        return text ? [text] : [];
      };
    var normalizeCaseTitle = typeof opts.normalizeCaseTitle === 'function'
      ? opts.normalizeCaseTitle
      : function(value) { return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase(); };
    var normalizeCaseItem = typeof opts.normalizeCaseItem === 'function'
      ? opts.normalizeCaseItem
      : function() { return null; };
    var getVisibleCasesForModuleEntry = typeof opts.getVisibleCasesForModuleEntry === 'function'
      ? opts.getVisibleCasesForModuleEntry
      : function() { return []; };
    var normalizeHistoryLongText = typeof opts.normalizeHistoryLongText === 'function'
      ? opts.normalizeHistoryLongText
      : function(value, maxLength) {
        var text = String(value || '').replace(/\s+/g, ' ').trim();
        var limit = Number(maxLength);
        if (!Number.isFinite(limit) || limit <= 0) limit = 2000;
        return text.length > limit ? (text.slice(0, limit).trim() + '…') : text;
      };
    var normalizeModelModulesOutputDetailed = typeof opts.normalizeModelModulesOutputDetailed === 'function'
      ? opts.normalizeModelModulesOutputDetailed
      : function() { return { list: [], diagnostics: {} }; };

    function createExistingCasesCompletionPolicy() {
      return {
        source: 'xmind_existing_cases_completion',
        generationStrategy: 'requirement_completion',
        completionStrength: 'full_reasonable_completion',
        onlyGenerateForClearCoverageGaps: false,
        returnEmptyWhenCovered: false,
        protectImportedCases: true,
        avoidImportedCaseLinearExpansion: true,
      };
    }

    function createImportedBaselineCompletionPolicy() {
      return {
        source: 'xmind_imported_baseline_completion',
        generationStrategy: 'requirement_completion',
        completionStrength: 'full_reasonable_completion',
        onlyGenerateForClearCoverageGaps: false,
        returnEmptyWhenCovered: false,
        protectImportedCases: true,
        avoidImportedCaseLinearExpansion: true,
      };
    }

    function createExistingCasesDiscoveryContract(contract) {
      var next = cloneJson(contract, {});
      next.existingCasesCompletion = true;
      next.discoveryThenModuleCases = true;
      next.generationPolicy = createExistingCasesCompletionPolicy();
      next.allowNewModules = true;
      next.generateCasesForNewModules = false;
      next.generateCasesForExistingModules = false;
      next.dedupeAgainstVisibleModules = true;
      next.dedupeAgainstVisibleCases = true;
      return next;
    }

    function createOperationContract(actionId, moduleEntry) {
      if (actionId === rootActions.FULL_CASES) {
        return {
          scope: 'root',
          mode: 'full_cases',
          targetModule: '',
          allowNewModules: true,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: false,
          dedupeAgainstVisibleModules: false,
          dedupeAgainstVisibleCases: false,
        };
      }
      if (actionId === rootActions.FULL_MODULES) {
        return {
          scope: 'root',
          mode: 'full_modules',
          targetModule: '',
          allowNewModules: true,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: false,
          dedupeAgainstVisibleModules: true,
          dedupeAgainstVisibleCases: false,
        };
      }
      if (actionId === rootActions.REGENERATE_MODULES) {
        return {
          scope: 'root',
          mode: 'regenerate_modules',
          targetModule: '',
          allowNewModules: true,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: false,
          dedupeAgainstVisibleModules: false,
          dedupeAgainstVisibleCases: false,
        };
      }
      if (actionId === rootActions.EXISTING_CASES) {
        return createExistingCasesDiscoveryContract({
          scope: 'root',
          mode: 'existing_modules_cases',
          targetModule: '',
          allowNewModules: true,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: false,
          dedupeAgainstVisibleModules: true,
          dedupeAgainstVisibleCases: true,
        });
      }
      if (actionId === rootActions.TOPUP_MODULES) {
        return {
          scope: 'root',
          mode: 'topup_modules',
          targetModule: '',
          allowNewModules: true,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: false,
          dedupeAgainstVisibleModules: true,
          dedupeAgainstVisibleCases: false,
        };
      }
      if (actionId === rootActions.TOPUP_MODULES_CASES) {
        return {
          scope: 'root',
          mode: 'topup_modules_cases',
          targetModule: '',
          allowNewModules: true,
          generateCasesForNewModules: true,
          generateCasesForExistingModules: false,
          dedupeAgainstVisibleModules: true,
          dedupeAgainstVisibleCases: false,
        };
      }
      if (actionId === rootActions.APPEND_ALL) {
        return {
          scope: 'root',
          mode: 'append_all_modules_cases',
          targetModule: '',
          allowNewModules: true,
          generateCasesForNewModules: true,
          generateCasesForExistingModules: true,
          dedupeAgainstVisibleModules: false,
          dedupeAgainstVisibleCases: true,
          importedBaselineCompletion: true,
          generationPolicy: createImportedBaselineCompletionPolicy(),
        };
      }
      if (actionId === moduleActions.APPEND) {
        return {
          scope: 'module',
          mode: 'module_append_cases',
          targetModule: moduleEntry ? moduleEntry.title : '',
          allowNewModules: false,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: true,
          dedupeAgainstVisibleModules: false,
          dedupeAgainstVisibleCases: true,
        };
      }
      if (actionId === moduleActions.FULL_CASES) {
        return {
          scope: 'module',
          mode: 'module_full_cases',
          targetModule: moduleEntry ? moduleEntry.title : '',
          allowNewModules: false,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: true,
          dedupeAgainstVisibleModules: false,
          dedupeAgainstVisibleCases: false,
        };
      }
      return {
        scope: 'module',
        mode: 'module_full_cases',
        targetModule: moduleEntry ? moduleEntry.title : '',
        allowNewModules: false,
        generateCasesForNewModules: false,
        generateCasesForExistingModules: true,
        dedupeAgainstVisibleModules: false,
        dedupeAgainstVisibleCases: true,
      };
    }

    function applyExistingCasesCompletionPolicy(contract) {
      var next = cloneJson(contract, {});
      next.existingCasesCompletion = true;
      next.discoveryThenModuleCases = true;
      next.generationPolicy = createExistingCasesCompletionPolicy();
      next.onlyGenerateForClearCoverageGaps = false;
      next.returnEmptyWhenCovered = false;
      next.allowNewModules = false;
      next.generateCasesForNewModules = false;
      next.generateCasesForExistingModules = true;
      next.dedupeAgainstVisibleCases = true;
      return next;
    }

    function applyImportedBaselineCompletionPolicy(contract) {
      var next = cloneJson(contract, {});
      next.importedBaselineCompletion = true;
      next.discoveryThenModuleCases = true;
      next.generationPolicy = createImportedBaselineCompletionPolicy();
      next.onlyGenerateForClearCoverageGaps = false;
      next.returnEmptyWhenCovered = false;
      next.allowNewModules = false;
      next.generateCasesForNewModules = false;
      next.generateCasesForExistingModules = true;
      next.dedupeAgainstVisibleCases = true;
      return next;
    }

    function getExistingCasesCompletionPolicy(contract) {
      if (!contract || typeof contract !== 'object') return null;
      var mode = contract.mode ? String(contract.mode || '') : '';
      if (contract.existingCasesCompletion === true || mode === 'existing_modules_cases') {
        return contract.generationPolicy && typeof contract.generationPolicy === 'object'
          ? contract.generationPolicy
          : createExistingCasesCompletionPolicy();
      }
      return null;
    }

    function getImportedBaselineCompletionPolicy(contract) {
      if (!contract || typeof contract !== 'object') return null;
      var mode = contract.mode ? String(contract.mode || '') : '';
      if (contract.importedBaselineCompletion === true || mode === 'append_all_modules_cases') {
        return contract.generationPolicy && typeof contract.generationPolicy === 'object'
          ? contract.generationPolicy
          : createImportedBaselineCompletionPolicy();
      }
      return null;
    }

    function createFilterDiagnostics() {
      return {
        inputModuleCount: 0,
        inputCaseCount: 0,
        outputModuleCount: 0,
        outputCaseCount: 0,
        skippedDuplicateOutputModules: 0,
        skippedTargetMismatchModules: 0,
        skippedNewModulesNotAllowed: 0,
        skippedDuplicateVisibleModules: 0,
        skippedCaseDuplicateWithinModule: 0,
        skippedCaseDuplicateVisible: 0,
        clearedCasesForNewModules: 0,
        clearedCasesForExistingModules: 0,
      };
    }

    function filterModulesByContract(modules, contract, visibleContext) {
      var visibleMap = visibleContext && visibleContext.map ? visibleContext.map : {};
      var targetKey = normalizeModuleKey(contract.targetModule || '');
      var finalModules = [];
      var seenModules = {};
      var diagnostics = createFilterDiagnostics();

      diagnostics.inputModuleCount = Array.isArray(modules) ? modules.length : 0;
      (Array.isArray(modules) ? modules : []).forEach(function(item) {
        diagnostics.inputCaseCount += Array.isArray(item && item.cases) ? item.cases.length : 0;
      });

      (Array.isArray(modules) ? modules : []).forEach(function(item) {
        var moduleTitle = normalizeModuleTitle(item.module || '');
        var moduleKey = normalizeModuleKey(moduleTitle);
        if (!moduleKey) return;
        if (seenModules[moduleKey]) {
          diagnostics.skippedDuplicateOutputModules += 1;
          return;
        }
        seenModules[moduleKey] = true;
        var existsVisible = Boolean(visibleMap[moduleKey]);
        if (contract.scope === 'module' && targetKey && moduleKey !== targetKey) {
          diagnostics.skippedTargetMismatchModules += 1;
          return;
        }
        if (contract.allowNewModules !== true && !existsVisible) {
          diagnostics.skippedNewModulesNotAllowed += 1;
          return;
        }
        if (contract.dedupeAgainstVisibleModules === true && existsVisible) {
          diagnostics.skippedDuplicateVisibleModules += 1;
          return;
        }

        var nextItem = {
          module: moduleTitle,
          key_scenarios: normalizeArrayField(item.key_scenarios),
          test_points: normalizeArrayField(item.test_points),
          coupled_modules: normalizeArrayField(item.coupled_modules),
          cases: [],
        };

        var caseSeen = {};
        var visibleCaseSeen = {};
        if (contract.dedupeAgainstVisibleCases === true && visibleMap[moduleKey]) {
          getVisibleCasesForModuleEntry(visibleMap[moduleKey]).forEach(function(row) {
            var key = normalizeCaseTitle(row.item && row.item.title);
            if (key) visibleCaseSeen[key] = true;
          });
        }

        (item.cases || []).forEach(function(caseItem) {
          var normalizedCase = normalizeCaseItem(caseItem, moduleTitle);
          if (!normalizedCase) return;
          var titleKey = normalizeCaseTitle(normalizedCase.title);
          if (!titleKey) return;
          if (caseSeen[titleKey]) {
            diagnostics.skippedCaseDuplicateWithinModule += 1;
            return;
          }
          if (contract.dedupeAgainstVisibleCases === true && visibleCaseSeen[titleKey]) {
            diagnostics.skippedCaseDuplicateVisible += 1;
            return;
          }
          caseSeen[titleKey] = true;
          nextItem.cases.push(normalizedCase);
        });

        if (existsVisible !== true && contract.generateCasesForNewModules !== true) {
          diagnostics.clearedCasesForNewModules += nextItem.cases.length;
          nextItem.cases = [];
        }
        if (existsVisible === true && contract.generateCasesForExistingModules !== true) {
          diagnostics.clearedCasesForExistingModules += nextItem.cases.length;
          nextItem.cases = [];
        }
        finalModules.push(nextItem);
        diagnostics.outputModuleCount += 1;
        diagnostics.outputCaseCount += nextItem.cases.length;
      });

      return {
        list: finalModules,
        diagnostics: diagnostics,
      };
    }

    function mergeCasesWithoutDuplicates(existingList, addedList, visibleList) {
      var result = Array.isArray(existingList) ? existingList.slice() : [];
      var visible = Array.isArray(visibleList) ? visibleList : [];
      var existingSeen = {};
      result.forEach(function(item) {
        var key = normalizeCaseTitle(item && item.title);
        if (key) existingSeen[key] = true;
      });
      visible.forEach(function(item) {
        var key = normalizeCaseTitle(item && item.title);
        if (key) existingSeen[key] = true;
      });
      var appended = [];
      var appendedSeen = {};
      var duplicateAgainstExisting = 0;
      var duplicateWithinAdded = 0;
      (Array.isArray(addedList) ? addedList : []).forEach(function(item) {
        var key = normalizeCaseTitle(item && item.title);
        if (!key) return;
        if (existingSeen[key]) {
          duplicateAgainstExisting += 1;
          return;
        }
        if (appendedSeen[key]) {
          duplicateWithinAdded += 1;
          return;
        }
        appendedSeen[key] = true;
        appended.push(item);
        result.push(item);
      });
      return {
        merged: result,
        appended: appended,
        diagnostics: {
          candidateCount: Array.isArray(addedList) ? addedList.length : 0,
          appendedCount: appended.length,
          duplicateAgainstExisting: duplicateAgainstExisting,
          duplicateWithinAdded: duplicateWithinAdded,
        },
      };
    }

    function resolveModuleTaskResult(input) {
      var source = input && typeof input === 'object' ? input : {};
      var normalizedOutput = normalizeModelModulesOutputDetailed(source.resultRaw || '');
      var filtered = filterModulesByContract(
        normalizedOutput.list,
        source.contract || {},
        source.visibleContext || {}
      );
      var moduleEntry = source.moduleEntry || null;
      var moduleTitle = normalizeModuleTitle(
        moduleEntry && moduleEntry.title ? moduleEntry.title : source.moduleTitle
      );
      var targetKey = normalizeModuleKey(moduleTitle);
      var targetOutput = filtered.list.find(function(item) {
        return normalizeModuleKey(item && item.module) === targetKey;
      }) || {
        module: moduleTitle,
        key_scenarios: [],
        test_points: [],
        coupled_modules: [],
        cases: [],
      };
      var visibleCases = moduleEntry ? getVisibleCasesForModuleEntry(moduleEntry).map(function(row) {
        return normalizeCaseItem(row && row.item, moduleEntry.title);
      }).filter(Boolean) : [];
      var merged = source.actionId === moduleActions.APPEND
        ? mergeCasesWithoutDuplicates(source.currentAiCases, targetOutput.cases, visibleCases)
        : null;
      return {
        normalizedOutput: normalizedOutput,
        filtered: filtered,
        targetOutput: targetOutput,
        visibleCases: visibleCases,
        nextList: merged ? merged.merged : targetOutput.cases.slice(),
        appended: merged ? merged.appended : [],
        mergeDiagnostics: merged ? merged.diagnostics : {
          duplicateAgainstExisting: 0,
          duplicateWithinAdded: 0,
        },
      };
    }

    function getDiagnosticsMetric(diag, key) {
      var value = diag && Number(diag[key]);
      if (!Number.isFinite(value) || value < 0) return 0;
      return value;
    }

    function appendDiagnosticMetric(list, label, count, unit) {
      var value = Number(count);
      if (!Number.isFinite(value) || value <= 0) return;
      list.push(label + ' ' + String(value) + ' ' + String(unit || ''));
    }

    function isRootAppendLikeAction(actionId) {
      return actionId === rootActions.TOPUP_MODULES
        || actionId === rootActions.TOPUP_MODULES_CASES
        || actionId === rootActions.APPEND_ALL;
    }

    function getFriendlyRootEmptyModulesText(actionId) {
      if (actionId === rootActions.TOPUP_MODULES) return '当前没有需要补充的新模块。';
      if (actionId === rootActions.TOPUP_MODULES_CASES) return '当前没有需要补充的新模块。';
      if (actionId === rootActions.EXISTING_CASES) return '当前已有模块下没有需要补充的新用例。';
      if (actionId === rootActions.APPEND_ALL) return '当前没有需要补充的新模块或新用例。';
      if (actionId === rootActions.FULL_MODULES || actionId === rootActions.REGENERATE_MODULES) {
        return '这次没有生成出任何模块。';
      }
      if (actionId === rootActions.FULL_CASES) return '这次没有生成出任何模块或用例。';
      return '这次没有生成出新的模块或用例。';
    }

    function getFriendlyModuleEmptyCasesText(actionId) {
      if (actionId === moduleActions.APPEND) return '当前模块没有需要补充的新用例。';
      if (actionId === moduleActions.FULL_CASES) return '这次没有为当前模块生成出用例。';
      return '这次没有为当前模块生成出新的用例。';
    }

    function buildGenerationErrorInfo(err) {
      var rawMessage = err && err.message ? String(err.message) : '未知错误';
      var detailText = normalizeHistoryLongText(rawMessage, 2000);
      var reasonText = '模型调用出错，请稍后重试。';
      if (/XMind 请求体超出当前上限/.test(rawMessage)) {
        reasonText = rawMessage;
      } else if (
        /context length|maximum context|context window|maximum context length|max context|too many tokens|token limit|prompt too long|input is too long|request too large|payload too large|context_length_exceeded|maximum token|超出.*上下文|上下文.*超限|输入.*过长/i.test(rawMessage)
      ) {
        reasonText = '模型上下文超限，请在设置中提高知识库注入上限、目录送模上限或 XMind 请求体上限后重试。';
      } else if (/超时/.test(rawMessage)) {
        reasonText = '模型响应超时，请稍后重试。';
      } else if (/503|service unavailable/i.test(rawMessage)) {
        reasonText = '模型服务暂时不可用，请稍后重试。';
      } else if (/network|fetch|failed to fetch|网络/i.test(rawMessage)) {
        reasonText = '模型连接失败，请检查网络后重试。';
      }
      return {
        resultKind: 'error',
        reasonText: reasonText,
        diagnostics: detailText ? ['错误信息：' + detailText] : [],
        previewText: '',
      };
    }

    function buildModelOutputNoChangeInfo(scope, actionId, modelDiagnostics) {
      var diagnostics = [];
      var previewText = modelDiagnostics && modelDiagnostics.rawPreview ? String(modelDiagnostics.rawPreview) : '';
      var reasonText = '';
      if (!modelDiagnostics) return null;

      if (modelDiagnostics.parseStatus === 'empty') {
        reasonText = '模型这次没有返回内容。';
        diagnostics.push('模型返回为空');
      } else if (modelDiagnostics.parseStatus === 'plain-text') {
        reasonText = '模型返回的是说明文字，不是系统可识别的结果。';
        diagnostics.push('返回格式：说明文字');
      } else if (modelDiagnostics.parseStatus === 'invalid-json') {
        reasonText = '模型返回结果格式不完整，系统暂时没法识别。';
        diagnostics.push('返回格式有问题');
      } else if (modelDiagnostics.missingModulesArray === true) {
        reasonText = '模型有返回内容，但没有给出可识别的模块列表。';
        diagnostics.push('没有返回模块列表');
      } else if (modelDiagnostics.emptyModulesArray === true) {
        reasonText = scope === 'module'
          ? getFriendlyModuleEmptyCasesText(actionId)
          : getFriendlyRootEmptyModulesText(actionId);
        diagnostics.push(scope === 'module' ? '模型返回空结果' : '模块列表为空');
      } else if (getDiagnosticsMetric(modelDiagnostics, 'moduleCandidateCount') > 0 && getDiagnosticsMetric(modelDiagnostics, 'normalizedModuleCount') <= 0) {
        reasonText = '模型有返回模块内容，但格式不完整，系统没法识别。';
        appendDiagnosticMetric(diagnostics, '未识别模块', getDiagnosticsMetric(modelDiagnostics, 'skippedNonObjectModules'), '个');
      } else if (getDiagnosticsMetric(modelDiagnostics, 'caseCandidateCount') > 0 && getDiagnosticsMetric(modelDiagnostics, 'normalizedCaseCount') <= 0) {
        reasonText = '模型有返回用例内容，但格式不完整，系统没法识别。';
        appendDiagnosticMetric(diagnostics, '未识别用例', getDiagnosticsMetric(modelDiagnostics, 'skippedInvalidCases'), '条');
      } else {
        return null;
      }

      return {
        resultKind: 'no-change',
        reasonText: reasonText,
        diagnostics: diagnostics,
        previewText: previewText,
      };
    }

    function buildRootNoChangeInfo(actionId, filterDiagnostics, applyDiagnostics, modelDiagnostics) {
      var rawModuleCount = getDiagnosticsMetric(filterDiagnostics, 'inputModuleCount');
      var rawCaseCount = getDiagnosticsMetric(filterDiagnostics, 'inputCaseCount');
      var outputModuleCount = getDiagnosticsMetric(filterDiagnostics, 'outputModuleCount');
      var outputCaseCount = getDiagnosticsMetric(filterDiagnostics, 'outputCaseCount');
      var duplicateVisibleModules = getDiagnosticsMetric(filterDiagnostics, 'skippedDuplicateVisibleModules');
      var duplicateVisibleCases = getDiagnosticsMetric(filterDiagnostics, 'skippedCaseDuplicateVisible')
        + getDiagnosticsMetric(applyDiagnostics, 'duplicateAgainstExistingCases');
      var duplicateOutputModules = getDiagnosticsMetric(filterDiagnostics, 'skippedDuplicateOutputModules');
      var duplicateOutputCases = getDiagnosticsMetric(filterDiagnostics, 'skippedCaseDuplicateWithinModule')
        + getDiagnosticsMetric(applyDiagnostics, 'duplicateWithinAddedCases');
      var targetMismatchModules = getDiagnosticsMetric(filterDiagnostics, 'skippedTargetMismatchModules');
      var blockedNewModules = getDiagnosticsMetric(filterDiagnostics, 'skippedNewModulesNotAllowed');
      var reasonText = '';
      var diagnostics = [];
      var previewText = '';

      appendDiagnosticMetric(diagnostics, '已有模块已覆盖', duplicateVisibleModules, '个');
      appendDiagnosticMetric(diagnostics, '已有用例已覆盖', duplicateVisibleCases, '条');
      appendDiagnosticMetric(diagnostics, '模型结果里有重复模块', duplicateOutputModules, '个');
      appendDiagnosticMetric(diagnostics, '模型结果里有重复用例', duplicateOutputCases, '条');
      appendDiagnosticMetric(diagnostics, '返回了当前目标外的模块', targetMismatchModules, '个');
      appendDiagnosticMetric(diagnostics, '本次动作不允许新增模块', blockedNewModules, '个');

      if (rawModuleCount <= 0 && rawCaseCount <= 0) {
        var modelOutputIssue = buildModelOutputNoChangeInfo('root', actionId, modelDiagnostics);
        if (modelOutputIssue) return modelOutputIssue;
        reasonText = '这次没有拿到可用的生成结果。';
        if (modelDiagnostics && modelDiagnostics.rawPreview) previewText = modelDiagnostics.rawPreview;
      } else if (duplicateVisibleModules > 0 && outputModuleCount <= 0) {
        reasonText = '当前模块已经覆盖，不需要再补充新模块。';
      } else if (duplicateVisibleCases > 0 && outputModuleCount > 0) {
        reasonText = '当前已有用例已经覆盖，本轮没有补出新的用例。';
      } else if (duplicateVisibleCases > 0 && outputCaseCount <= 0) {
        reasonText = '当前已有内容已经覆盖，本轮没有补出新的结果。';
      } else if (targetMismatchModules > 0 || blockedNewModules > 0) {
        reasonText = '模型返回的内容和当前操作不匹配，所以这次没有采用。';
      } else if (outputModuleCount > 0 && outputCaseCount <= 0) {
        if (actionId === rootActions.EXISTING_CASES || actionId === rootActions.APPEND_ALL) {
          reasonText = '模型识别到了模块，但判断当前没有需要补充的新用例。';
        } else if (isRootAppendLikeAction(actionId)) {
          reasonText = '当前没有需要补充的新模块。';
        } else {
          reasonText = '模型识别到了模块，但这次没有生成出新的用例。';
        }
      } else if (duplicateOutputModules > 0 || duplicateOutputCases > 0) {
        reasonText = '模型返回内容里有重复项，整理后没有留下新的结果。';
      } else {
        reasonText = '这次没有生成出新的模块或用例。';
      }

      return {
        resultKind: 'no-change',
        reasonText: reasonText,
        diagnostics: diagnostics,
        previewText: previewText,
      };
    }

    function buildModuleNoChangeInfo(actionId, filterDiagnostics, mergeDiagnostics, targetOutput, modelDiagnostics) {
      var rawModuleCount = getDiagnosticsMetric(filterDiagnostics, 'inputModuleCount');
      var rawCaseCount = getDiagnosticsMetric(filterDiagnostics, 'inputCaseCount');
      var outputModuleCount = getDiagnosticsMetric(filterDiagnostics, 'outputModuleCount');
      var outputCaseCount = getDiagnosticsMetric(filterDiagnostics, 'outputCaseCount');
      var duplicateVisibleCases = getDiagnosticsMetric(filterDiagnostics, 'skippedCaseDuplicateVisible')
        + getDiagnosticsMetric(mergeDiagnostics, 'duplicateAgainstExisting');
      var duplicateOutputCases = getDiagnosticsMetric(filterDiagnostics, 'skippedCaseDuplicateWithinModule')
        + getDiagnosticsMetric(mergeDiagnostics, 'duplicateWithinAdded');
      var targetMismatchModules = getDiagnosticsMetric(filterDiagnostics, 'skippedTargetMismatchModules');
      var blockedNewModules = getDiagnosticsMetric(filterDiagnostics, 'skippedNewModulesNotAllowed');
      var reasonText = '';
      var diagnostics = [];
      var targetCaseCount = Array.isArray(targetOutput && targetOutput.cases) ? targetOutput.cases.length : 0;
      var previewText = '';

      appendDiagnosticMetric(diagnostics, '已有用例已覆盖', duplicateVisibleCases, '条');
      appendDiagnosticMetric(diagnostics, '模型结果里有重复用例', duplicateOutputCases, '条');
      appendDiagnosticMetric(diagnostics, '返回了当前目标外的模块', targetMismatchModules, '个');
      appendDiagnosticMetric(diagnostics, '本次动作不允许新增模块', blockedNewModules, '个');

      if (rawModuleCount <= 0 && rawCaseCount <= 0) {
        var modelOutputIssue = buildModelOutputNoChangeInfo('module', actionId, modelDiagnostics);
        if (modelOutputIssue) return modelOutputIssue;
        reasonText = '这次没有拿到可用的生成结果。';
        if (modelDiagnostics && modelDiagnostics.rawPreview) previewText = modelDiagnostics.rawPreview;
      } else if (actionId === moduleActions.APPEND) {
        if (duplicateVisibleCases > 0) {
          reasonText = '当前模块已有用例已经覆盖，本轮没有补出新的用例。';
        } else if (targetMismatchModules > 0 || blockedNewModules > 0 || outputModuleCount <= 0) {
          reasonText = '模型返回的内容没有命中当前模块，所以这次没有采用。';
        } else if (duplicateOutputCases > 0 && targetCaseCount <= 0) {
          reasonText = '模型返回内容里有重复项，整理后没有留下新的用例。';
        } else if (targetCaseCount <= 0 || outputCaseCount <= 0) {
          reasonText = '当前模块没有需要补充的新用例。';
        } else {
          reasonText = '这次没有补出新的用例。';
        }
      } else if (targetMismatchModules > 0 || blockedNewModules > 0 || outputModuleCount <= 0) {
        reasonText = '模型返回的内容没有命中当前模块，所以这次没有采用。';
      } else if (duplicateOutputCases > 0 && targetCaseCount <= 0) {
        reasonText = '模型返回内容里有重复项，整理后没有留下新的用例。';
      } else if (targetCaseCount <= 0 || outputCaseCount <= 0) {
        reasonText = '这次没有为当前模块生成出用例。';
      } else {
        reasonText = '这次没有生成出新的用例。';
      }

      return {
        resultKind: 'no-change',
        reasonText: reasonText,
        diagnostics: diagnostics,
        previewText: previewText,
      };
    }

    return {
      createOperationContract: createOperationContract,
      applyExistingCasesCompletionPolicy: applyExistingCasesCompletionPolicy,
      applyImportedBaselineCompletionPolicy: applyImportedBaselineCompletionPolicy,
      getExistingCasesCompletionPolicy: getExistingCasesCompletionPolicy,
      getImportedBaselineCompletionPolicy: getImportedBaselineCompletionPolicy,
      filterModulesByContract: filterModulesByContract,
      mergeCasesWithoutDuplicates: mergeCasesWithoutDuplicates,
      resolveModuleTaskResult: resolveModuleTaskResult,
      getDiagnosticsMetric: getDiagnosticsMetric,
      buildGenerationErrorInfo: buildGenerationErrorInfo,
      getFriendlyRootEmptyModulesText: getFriendlyRootEmptyModulesText,
      buildRootNoChangeInfo: buildRootNoChangeInfo,
      buildModuleNoChangeInfo: buildModuleNoChangeInfo,
    };
  }

  return {
    create: create,
  };
});
