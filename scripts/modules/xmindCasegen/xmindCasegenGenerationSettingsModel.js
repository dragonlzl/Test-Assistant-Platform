(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenGenerationSettingsModel = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var DEDUPE_MODE_ONLY = String(opts.dedupeModeOnly || 'dedupe_only');
    var DEDUPE_MODE_SIMPLIFY = String(opts.dedupeModeSimplify || 'dedupe_simplify');
    var defaultPrompts = opts.defaultPrompts && typeof opts.defaultPrompts === 'object'
      ? opts.defaultPrompts
      : {};
    var getState = port('getState', function() { return {}; });
    var ensureCaseGenSettings = port('ensureCaseGenSettings', function() {
      var state = getState();
      return state.caseGenSettings || {};
    });
    var createDefaultCaseGenSettings = port('createDefaultCaseGenSettings', function() { return {}; });
    var getExistingCasesCompletionPolicy = port('getExistingCasesCompletionPolicy', function() { return false; });
    var getImportedBaselineCompletionPolicy = port('getImportedBaselineCompletionPolicy', function() { return false; });
    var getCaseGenPromptComponents = port('getCaseGenPromptComponents', function() { return []; });
    var setCaseGenSettingValue = port('setCaseGenSettingValue');
    var markPrepNeedsReconfirm = port('markPrepNeedsReconfirm');
    var persistXmindState = port('persistXmindState');

    function getCaseGenSettingsSnapshot() {
      return ensureCaseGenSettings() || {};
    }

    function buildXmindGenerationOptionsSnapshot() {
      var settings = getCaseGenSettingsSnapshot();
      return {
        customRequirement: String(settings.customRequirement || '').trim(),
        needFunctionCondition: settings.needFunctionCondition === true,
        needNumericValidation: settings.needNumericValidation === true,
        needBoundary: settings.needBoundary === true,
        needMobile: settings.needMobile === true,
        needSpecial: settings.needSpecial === true,
        specialRepeatOperation: settings.needSpecial === true && settings.specialRepeatOperation === true,
        specialMultiTouch: settings.needSpecial === true && settings.specialMultiTouch === true,
        specialRepeatExecution: settings.needSpecial === true && settings.specialRepeatExecution === true,
        specialWeakNetwork: settings.needSpecial === true && settings.specialWeakNetwork === true,
        specialInterruptResume: settings.needSpecial === true && settings.specialInterruptResume === true,
      };
    }

    function normalizeDedupeMode(value) {
      return String(value || '') === DEDUPE_MODE_SIMPLIFY ? DEDUPE_MODE_SIMPLIFY : DEDUPE_MODE_ONLY;
    }

    function isDedupeSimplifyMode(value) {
      return normalizeDedupeMode(value) === DEDUPE_MODE_SIMPLIFY;
    }

    function getDedupeModeFromSettings() {
      var settings = getCaseGenSettingsSnapshot();
      return settings.dedupeSimplify === true ? DEDUPE_MODE_SIMPLIFY : DEDUPE_MODE_ONLY;
    }

    function getDedupeModeActionText(mode) {
      return isDedupeSimplifyMode(mode) ? '去重并精简' : '仅去重';
    }

    function getDedupeBatchProgressText(progress) {
      var source = progress && typeof progress === 'object' ? progress : {};
      var completed = Math.max(0, Number(source.batchCompleted || 0));
      var total = Math.max(0, Number(source.batchTotal || 0));
      if (!total) return '';
      return String(Math.min(completed, total)) + '/' + String(total);
    }

    function getDedupeRunningLabel(mode, progress) {
      var label = isDedupeSimplifyMode(mode) ? 'AI 去重精简中' : 'AI 用例去重中';
      var progressText = getDedupeBatchProgressText(progress);
      return progressText ? (label + ' ' + progressText) : label;
    }

    function getDedupeRunningHint(mode, progress) {
      var hint = isDedupeSimplifyMode(mode)
        ? '正在对当前页签 AI 生成用例执行去重并精简'
        : '正在对当前页签 AI 生成用例执行仅去重';
      var progressText = getDedupeBatchProgressText(progress);
      return progressText ? (hint + '，批次进度 ' + progressText) : hint;
    }

    function getDedupeRemovedSummaryText(count, mode) {
      var total = Number(count || 0) || 0;
      return isDedupeSimplifyMode(mode)
        ? ('已去重精简 ' + String(total) + ' 条用例')
        : ('已去重 ' + String(total) + ' 条用例');
    }

    function getDedupeNoChangeSummaryText(mode) {
      return isDedupeSimplifyMode(mode)
        ? 'AI 用例去重精简完成，未发现可去重用例'
        : 'AI 用例去重完成，未发现可去重用例';
    }

    function getDedupeExecutionDiagnosticText(count, mode) {
      var total = Number(count || 0) || 0;
      if (total > 0) {
        return isDedupeSimplifyMode(mode)
          ? ('AI 用例去重精简完成，' + getDedupeRemovedSummaryText(total, mode))
          : ('AI 用例去重完成，' + getDedupeRemovedSummaryText(total, mode));
      }
      return getDedupeNoChangeSummaryText(mode);
    }

    function buildXmindGenerationOptionsSummary(settingsSnapshot) {
      var snapshot = settingsSnapshot && typeof settingsSnapshot === 'object'
        ? settingsSnapshot
        : buildXmindGenerationOptionsSnapshot();
      var lines = [];
      var specialNames = [];
      if (snapshot.customRequirement) lines.push('额外要求：' + String(snapshot.customRequirement || ''));
      if (snapshot.needFunctionCondition) {
        lines.push('已开启考虑功能使用条件：生成模块和用例时，需要覆盖解锁条件、可用条件、身份或等级门槛、资源消耗、前置任务和使用时间限制。');
      }
      if (snapshot.needNumericValidation) {
        lines.push('已开启数值验证：生成模块和用例时，需要覆盖数值显示、取值范围、阈值变化、计算结果、累计扣减和结算正确性。');
      }
      if (snapshot.needBoundary) {
        lines.push('已开启考虑边界：生成模块和用例时，需要覆盖上下限、临界值、空值、满值和异常边界。');
      }
      if (snapshot.needMobile) {
        lines.push('已开启考虑移动设备：生成模块和用例时，需要覆盖点击、长按、滑动、拖拽、横竖屏切换和系统手势干扰。');
      }
      if (snapshot.needSpecial) {
        if (snapshot.specialRepeatOperation) specialNames.push('重复操作');
        if (snapshot.specialMultiTouch) specialNames.push('多点触控');
        if (snapshot.specialRepeatExecution) specialNames.push('重复执行');
        if (snapshot.specialWeakNetwork) specialNames.push('弱网');
        if (snapshot.specialInterruptResume) specialNames.push('中断恢复');
        lines.push(specialNames.length
          ? ('已开启考虑特殊场景：本轮重点覆盖 ' + specialNames.join('、') + '。')
          : '已开启考虑特殊场景：本轮需要补充异常路径、非理想环境和非常规用户操作。');
      }
      if (!lines.length) lines.push('本轮未额外勾选生成选项，将按默认要求生成。');
      return lines.join('\n');
    }

    function buildEnabledXmindOptionLabels(settingsSnapshot) {
      var snapshot = settingsSnapshot && typeof settingsSnapshot === 'object'
        ? settingsSnapshot
        : buildXmindGenerationOptionsSnapshot();
      var labels = [];
      if (snapshot.needFunctionCondition) labels.push('功能使用条件');
      if (snapshot.needNumericValidation) labels.push('数值验证');
      if (snapshot.needBoundary) labels.push('边界场景');
      if (snapshot.needMobile) labels.push('移动设备场景');
      if (snapshot.needSpecial) labels.push('特殊场景');
      return labels;
    }

    function isRootFullGenerationContract(contract) {
      var scope = contract && contract.scope ? String(contract.scope || '') : '';
      var mode = contract && contract.mode ? String(contract.mode || '') : '';
      return scope === 'root' && (
        mode === 'full_cases'
        || mode === 'full_modules'
        || mode === 'regenerate_modules'
      );
    }

    function buildXmindHardConstraintText(contract, settingsSnapshot) {
      var snapshot = settingsSnapshot && typeof settingsSnapshot === 'object'
        ? settingsSnapshot
        : buildXmindGenerationOptionsSnapshot();
      var enabledLabels = buildEnabledXmindOptionLabels(snapshot);
      var existingCasesCompletionPolicy = getExistingCasesCompletionPolicy(contract);
      var importedBaselineCompletionPolicy = getImportedBaselineCompletionPolicy(contract);
      var lines = [];
      if (!enabledLabels.length && !existingCasesCompletionPolicy && !importedBaselineCompletionPolicy) return '';
      if (existingCasesCompletionPolicy) {
        var scope = contract && contract.scope ? String(contract.scope || '') : '';
        if (scope === 'root') {
          lines.push('当前是导入已有用例后的补全第一阶段：先评估当前已有模块是否足够覆盖需求。');
          lines.push('如果已有模块不足以覆盖需求，只返回缺失的新模块，且这些模块的 cases 必须为空数组或省略。');
          lines.push('如果已有模块已经足够覆盖需求，必须返回 {"modules":[]}。');
          lines.push('第一阶段不要输出已有模块，也不要为任何模块生成用例；用例会在后续模块阶段统一生成或补全。');
        } else {
          lines.push('当前是导入已有用例后的补全第二阶段：按当前模块已有用例情况生成或补全。');
          lines.push('如果当前模块没有可见用例，请围绕需求为该模块生成完整用例。');
          lines.push('如果当前模块已有用例，请以已有用例为已覆盖基线，继续按需求正文、生成选项和风格指南充分补齐该模块应有的正常流、异常流、边界、状态变化、权限/配置、兼容性、弱网/中断恢复和跨模块联动等新增候选。');
          lines.push('只有确认该模块在需求范围内已经完整覆盖，且不存在可补充的独立测试价值时，才返回当前模块 cases: []。');
          lines.push('不得改写、合并、删除、复述或替换导入的已有用例。');
        }
        if (enabledLabels.length) {
          lines.push('已开启的生成选项必须作为本轮补全维度纳入判断：' + enabledLabels.join('、') + '。');
          lines.push('不要因为已有用例覆盖主流程就停止补全；需要结合已开启选项继续补足未覆盖或覆盖薄弱的测试场景。');
        }
        if (snapshot.customRequirement) {
          lines.push('用户附加要求也只作为缺口判断依据，不能绕过先补模块、再生成或补全用例的流程。');
        }
        return lines.join('\n');
      }
      if (importedBaselineCompletionPolicy) {
        lines.push('当前是导入已有用例后的追加生成：导入用例只作为覆盖参考和去重基线，不要因为导入用例数量多而线性扩写。');
        lines.push('如果当前模块没有可见用例，请围绕需求为该模块生成完整用例。');
        lines.push('如果当前模块已有用例，请以已有用例为已覆盖基线，继续按需求正文、生成选项和风格指南充分补齐该模块应有的正常流、异常流、边界、状态变化、权限/配置、兼容性、弱网/中断恢复和跨模块联动等新增候选。');
        lines.push('只有确认该模块在需求范围内已经完整覆盖，且不存在可补充的独立测试价值时，才返回当前模块 cases: []。');
        lines.push('不得改写、合并、删除、复述或替换导入的已有用例。');
        if (enabledLabels.length) {
          lines.push('已开启的生成选项必须作为本轮补全维度纳入判断：' + enabledLabels.join('、') + '。');
          lines.push('不要因为导入用例很多就机械扩写，也不要因为已有用例覆盖主流程就停止补全；需要结合已开启选项继续补足未覆盖或覆盖薄弱的测试场景。');
        }
        if (snapshot.customRequirement) {
          lines.push('用户附加要求也只作为缺口判断依据，不能绕过导入用例的覆盖和去重基线。');
        }
        return lines.join('\n');
      }
      lines.push('已开启的生成选项属于本轮输出的硬性覆盖要求，不是参考建议。');
      lines.push('本轮必须直接覆盖：' + enabledLabels.join('、') + '。');
      if (isRootFullGenerationContract(contract)) {
        if (contract && String(contract.mode || '') === 'full_cases') {
          lines.push('当前是根节点全量用例生成的模块拆分阶段：先返回不重复的模块清单，每个模块必须代表独立测试范围，模块名不得重复或近义重复。');
          lines.push('模块拆分阶段可以提供候选 cases 作为后续模块生成兜底，但后续仍会逐模块执行用例生成；不得把跨模块去重视为模块生成完成。');
        } else {
          lines.push('当前是根节点首轮全量/重生成动作，首次输出必须直接覆盖上述要求，不允许把相关覆盖留到后续补全或追加。');
        }
      }
      if (snapshot.needFunctionCondition) {
        lines.push('如果需求存在解锁条件、开放条件、使用条件、身份/权限/等级/资格门槛、资源消耗、前置任务、时间窗、次数或可用前提，必须在模块拆分、关键场景、测试要点或用例中直接体现。');
      }
      if (snapshot.needNumericValidation) {
        lines.push('如果需求存在金额、积分、次数、数量、时长、上限/下限、阈值、比例、概率、累计、扣减或结算规则，必须在模块、测试要点或用例中直接体现数值验证。');
      }
      if (snapshot.needBoundary) {
        lines.push('如果开启了边界场景，首次输出必须直接覆盖上下限、临界值、空值、满值和异常边界。');
      }
      if (snapshot.needMobile) {
        lines.push('如果开启了移动设备场景，首次输出必须直接覆盖移动端交互、系统手势、横竖屏或设备差异带来的影响。');
      }
      if (snapshot.needSpecial) {
        lines.push('如果开启了特殊场景，首次输出必须直接覆盖非理想环境、异常路径和已勾选的特殊操作场景。');
      }
      if (snapshot.customRequirement) {
        lines.push('用户附加要求也属于本轮必须直接落实的内容，不要延后到补全阶段。');
      }
      return lines.join('\n');
    }

    function applyCaseGenOptionToSharedSettings(key, value) {
      var state = getState();
      if (!state.caseGenSettings || typeof state.caseGenSettings !== 'object') {
        state.caseGenSettings = createDefaultCaseGenSettings();
      }
      var settings = state.caseGenSettings;
      if (key === 'customRequirement') {
        settings.customRequirement = String(value || '');
        return settings;
      }
      if (
        key === 'dedupeSimplify'
        || key === 'needFunctionCondition'
        || key === 'needNumericValidation'
        || key === 'needBoundary'
        || key === 'needMobile'
        || key === 'needSpecial'
        || key === 'specialRepeatOperation'
        || key === 'specialMultiTouch'
        || key === 'specialRepeatExecution'
        || key === 'specialWeakNetwork'
        || key === 'specialInterruptResume'
      ) {
        settings[key] = value === true;
        if (key === 'needSpecial' && value !== true) {
          settings.specialRepeatOperation = false;
          settings.specialMultiTouch = false;
          settings.specialRepeatExecution = false;
          settings.specialWeakNetwork = false;
          settings.specialInterruptResume = false;
        }
        return settings;
      }
      settings[key] = value;
      return settings;
    }

    function setCaseGenOption(key, value) {
      applyCaseGenOptionToSharedSettings(key, value);
      setCaseGenSettingValue(key, value);
      markPrepNeedsReconfirm(false);
      persistXmindState(false);
    }

    function buildXmindPrompt(contract) {
      var state = getState();
      var settingsSnapshot = buildXmindGenerationOptionsSnapshot();
      var assignedPrompt = state.assignments && state.assignments.xmindCaseGenPrompt
        ? String(state.assignments.xmindCaseGenPrompt || '').trim()
        : '';
      var defaultPrompt = defaultPrompts && defaultPrompts.xmindcasegen
        ? String(defaultPrompts.xmindcasegen || '').trim()
        : '';
      var parts = [];
      if (defaultPrompt) parts.push(defaultPrompt);
      if (assignedPrompt && assignedPrompt !== defaultPrompt) parts.push(assignedPrompt);
      var extraParts = getCaseGenPromptComponents(getCaseGenSettingsSnapshot()) || [];
      extraParts.forEach(function(item) {
        if (item) parts.push(String(item));
      });
      var hardConstraintText = buildXmindHardConstraintText(contract, settingsSnapshot);
      if (hardConstraintText) parts.push('【XMind 生成硬约束】\n' + hardConstraintText);
      parts.push('operation_contract(JSON)：' + JSON.stringify(contract));
      return parts.join('\n\n');
    }

    return {
      getCaseGenSettingsSnapshot: getCaseGenSettingsSnapshot,
      buildXmindGenerationOptionsSnapshot: buildXmindGenerationOptionsSnapshot,
      normalizeDedupeMode: normalizeDedupeMode,
      isDedupeSimplifyMode: isDedupeSimplifyMode,
      getDedupeModeFromSettings: getDedupeModeFromSettings,
      getDedupeModeActionText: getDedupeModeActionText,
      getDedupeBatchProgressText: getDedupeBatchProgressText,
      getDedupeRunningLabel: getDedupeRunningLabel,
      getDedupeRunningHint: getDedupeRunningHint,
      getDedupeRemovedSummaryText: getDedupeRemovedSummaryText,
      getDedupeNoChangeSummaryText: getDedupeNoChangeSummaryText,
      getDedupeExecutionDiagnosticText: getDedupeExecutionDiagnosticText,
      buildXmindGenerationOptionsSummary: buildXmindGenerationOptionsSummary,
      buildEnabledXmindOptionLabels: buildEnabledXmindOptionLabels,
      isRootFullGenerationContract: isRootFullGenerationContract,
      buildXmindHardConstraintText: buildXmindHardConstraintText,
      applyCaseGenOptionToSharedSettings: applyCaseGenOptionToSharedSettings,
      setCaseGenOption: setCaseGenOption,
      buildXmindPrompt: buildXmindPrompt,
    };
  }

  return { create: create };
});
