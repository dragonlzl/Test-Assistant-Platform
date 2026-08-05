(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindDedupeContractModel = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function normalizeMode(value) {
    return String(value || '') === 'dedupe_simplify' ? 'dedupe_simplify' : 'dedupe_only';
  }

  function isSimplifyMode(value) {
    return normalizeMode(value) === 'dedupe_simplify';
  }

  function createModelModuleReturnPolicy() {
    return {
      return_all_input_modules: true,
      preserve_module_id_and_key: true,
      unchanged_modules_must_be_returned: true,
      partial_modules_response_allowed: false,
    };
  }

  function createTaskModuleReturnPolicy() {
    return {
      returnAllInputModules: true,
      preserveModuleIdAndKey: true,
      unchangedModulesMustBeReturned: true,
      partialModulesResponseAllowed: false,
    };
  }

  function createModelDuplicateDetectionPolicy() {
    return {
      compare_fields: [
        'module', 'title', 'preconditions', 'steps', 'expected',
        'test_purpose', 'test_point', 'validation_goal',
      ],
      require_full_module_scan: true,
      require_global_case_scan: true,
      stop_after_first_duplicate: false,
      treat_synonyms_as_duplicate_candidates: true,
      prefer_same_module_dedupe: false,
      cross_module_dedupe: true,
      duplicate_when_same_test_purpose_and_point: true,
    };
  }

  function createTaskDuplicateDetectionPolicy() {
    return {
      compareFields: [
        'module', 'title', 'preconditions', 'steps', 'expected',
        'test_purpose', 'test_point', 'validation_goal',
      ],
      requireFullModuleScan: true,
      requireGlobalCaseScan: true,
      stopAfterFirstDuplicate: false,
      treatSynonymsAsDuplicateCandidates: true,
      preferSameModuleDedupe: false,
      crossModuleDedupe: true,
      duplicateWhenSameTestPurposeAndPoint: true,
    };
  }

  function buildModelOperationContract(options) {
    var source = options && typeof options === 'object' ? options : {};
    var mode = normalizeMode(source.dedupeMode || source.mode);
    var batchMode = source.batchMode === true;
    var contract = {
      scope: 'xmind_ai_cases',
      mode: 'ai_dedupe_simplify',
      dedupe_mode: mode,
      dedupeMode: mode,
      simplify: isSimplifyMode(mode),
      strength: source.strength || 'conservative',
      source: source.source || 'manual-toolbar',
      return_full_replacement: true,
      return_changed_modules_only_allowed: false,
      editable_scope: 'ai_generated_cases_only',
      quality_goal: 'improve_product_quality_without_reducing_coverage_or_defect_detection_value',
      dedupe_scope: 'all_input_modules_global',
      dedupe_order: ['within_module', 'cross_module'],
      cross_module_dedupe: true,
      module_return_policy: createModelModuleReturnPolicy(),
      review_method: 'exhaustive_global_pairwise_scan',
      duplicate_detection_policy: createModelDuplicateDetectionPolicy(),
    };
    if (batchMode) {
      contract.batch_mode = true;
      contract.batch_index = Number(source.batchIndex || 0);
      contract.batch_count = Number(source.batchCount || 0);
      contract.editable_module_keys = Array.isArray(source.editableModuleKeys)
        ? source.editableModuleKeys.slice()
        : [];
      contract.readonly_reference_module_keys = Array.isArray(source.readonlyReferenceModuleKeys)
        ? source.readonlyReferenceModuleKeys.slice()
        : [];
      contract.readonly_reference_policy = {
        compare_against_references: true,
        references_are_not_editable: true,
        keep_reference_when_duplicate: true,
        return_reference_modules: false,
      };
    }
    return contract;
  }

  function buildTaskOperationContract(options) {
    var source = options && typeof options === 'object' ? options : {};
    var mode = normalizeMode(source.dedupeMode || source.mode);
    return {
      scope: 'xmind_ai_cases',
      mode: 'ai_dedupe_simplify',
      dedupeMode: mode,
      dedupe_mode: mode,
      simplify: isSimplifyMode(mode),
      strength: source.strength || 'conservative',
      editableScope: 'ai_generated_cases_only',
      dedupeScope: 'all_input_modules_global',
      dedupeOrder: ['within_module', 'cross_module'],
      dedupe_order: ['within_module', 'cross_module'],
      crossModuleDedupe: true,
      returnFullReplacement: true,
      moduleReturnPolicy: createTaskModuleReturnPolicy(),
      returnChangedModulesOnlyAllowed: false,
      reviewMethod: 'exhaustive_global_pairwise_scan',
      duplicateDetectionPolicy: createTaskDuplicateDetectionPolicy(),
    };
  }

  function buildReturnPolicyPrompt(options) {
    var source = options && typeof options === 'object' ? options : {};
    var batchMode = source.batchMode === true;
    return {
      batchContextLines: batchMode ? [
        '本次为全局去重的有界批次：target_modules 是本批唯一可编辑用例；readonly_reference_modules 是更早批次的只读用例摘要。',
        '必须把 target_modules 与 readonly_reference_modules 一起用于重复候选审查，但只能删除、合并或改写 target_modules 中的用例。',
        '当目标用例与只读引用重复时，保留只读引用对应覆盖，仅在目标模块中删除或合并重复项；不得返回或改写只读引用模块。',
        'modules 必须返回全部 target_modules，包括未发生变化的模块；不得返回 readonly_reference_modules。',
      ] : [],
      reviewLine: 'F. modules 必须返回全部可编辑输入模块，不得只返回发生变化的模块；每个模块都必须携带原 moduleId、moduleKey、module 和处理后的完整 cases，未发生变化的模块也必须原样返回。',
      moduleConstraintLine: '4. 必须返回每个可编辑输入模块的 moduleId、moduleKey、module 和完整 cases 数组，不得省略未变化模块。',
    };
  }

  return {
    buildModelOperationContract: buildModelOperationContract,
    buildReturnPolicyPrompt: buildReturnPolicyPrompt,
    buildTaskOperationContract: buildTaskOperationContract,
    isSimplifyMode: isSimplifyMode,
    normalizeMode: normalizeMode,
  };
});
