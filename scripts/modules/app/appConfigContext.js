(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.appConfigContext = api;
  }
})(function() {
  function create(source) {
    var appConfig = source && typeof source === 'object' ? source : {};
    var defaultTempExecColumns = appConfig.defaultTempExecColumns || {
      select: true,
      index: true,
      module: true,
      priority: true,
      preconditions: true,
      steps: true,
      expected: true,
      ops: true,
    };
    var defaultSettings = appConfig.defaultSettings || {
      timeoutSec: 300,
      feishuWebhook: '',
      feishuMention: '',
      caseAssistantProjectRoot: '',
      theme: 'light',
      caseViewFontSize: 13,
      missingCaseReminderPlacement: 'top',
      missingCaseReminderMatchConfig: { type: true, module: true },
      missingCaseReminderAiEnabled: 'off',
      smartTopNavCollapse: false,
      tempExecColumns: Object.assign({}, defaultTempExecColumns),
      projectOrder: [],
      defaultProjectId: '',
    };
    var defaultCaseViewFontSize = Number(appConfig.defaultCaseViewFontSize)
      || (defaultSettings && defaultSettings.caseViewFontSize ? Number(defaultSettings.caseViewFontSize) : 13);

    return {
      providerDefaults: appConfig.providerDefaults || {},
      defaultPrompts: appConfig.defaultPrompts || {},
      defaultPromptsKey: appConfig.defaultPromptsKey || 'usecase-default-prompts',
      defaultMaxTokens: appConfig.defaultMaxTokens || 1024,
      legacyCleanKey: appConfig.legacyCleanKey || 'cleaner-config-v1',
      legacyCompareKey: appConfig.legacyCompareKey || 'cleaner-compare-config-v1',
      modelsKey: appConfig.modelsKey || 'cleaner-models-v1',
      assignmentKey: appConfig.assignmentKey || 'cleaner-assignment-v1',
      activeTabKey: appConfig.activeTabKey || 'usecase-active-tab',
      workflowStorageKey: appConfig.workflowStorageKey || 'usecase-workflow-state-v1',
      tempExecStorageKey: appConfig.tempExecStorageKey || 'usecase-temp-exec-v1',
      tempExecFocusStorageKey: appConfig.tempExecFocusStorageKey || 'tempexec-focus-v1',
      tempExecPageSizeStorageKey: appConfig.tempExecPageSizeStorageKey || 'tempexec-page-size',
      defaultTempExecPageSize: Number(appConfig.defaultTempExecPageSize) || 20,
      tempExecResultOptions: Array.isArray(appConfig.tempExecResultOptions)
        ? appConfig.tempExecResultOptions
        : ['未执行', '通过', '失败', '阻塞', '不适用'],
      defaultPlacement: appConfig.defaultPlacement || { requirementOrder: [], fileOrder: {}, versionOrder: [] },
      defaultTempExecColumns: defaultTempExecColumns,
      defaultSettings: defaultSettings,
      settingsKey: appConfig.settingsKey || 'usecase-settings-v1',
      minModelTimeoutSec: Number(appConfig.minModelTimeoutSec) || 30,
      maxModelTimeoutSec: Number(appConfig.maxModelTimeoutSec) || 1800,
      defaultCaseViewFontSize: defaultCaseViewFontSize,
      minCaseViewFontSize: Number(appConfig.minCaseViewFontSize) || 11,
      maxCaseViewFontSize: Number(appConfig.maxCaseViewFontSize) || 16,
      legacyCasesPrompt: appConfig.legacyCasesPrompt || '你是测试审核专家，请对比“测试模块拆分结果”和“XMind 测试用例”，输出 JSON：{coverage: 百分比(0-100), missing: [模块缺失点], extra: [测试用例中多出的点]}，missing/extra 为空数组表示无缺失或冗余。',
      legacyCleanPrompt: appConfig.legacyCleanPrompt || '你是资深需求分析师，请清洗并重写下面的原始需求，重新整理前，要充分理解需求，理解设计意图，然后整理成结构化、可读性强的条目，保持原意，保留关键信息与约束条件，输出JSON数组：[{"功能": 具体功能名称,"类别": 核心改动的类别,"功能描述": {"重新整理内容": 具体重新整理的功能原文内容,"功能目标": [如有则为功能的目标],"规则": [功能的具体规则],"约束": [如有则为功能的限制和约束],"流程": [功能触发的具体流程]},"原始需求描述": [原始需求的所有相关描述]}]。仅输出此 JSON 内容，禁止输出其它文字。',
      legacyCaseGenPrompt: appConfig.legacyCaseGenPrompt || '你是测试用例专家，针对单个测试模块生成 JSON 用例列表，每条用例字段：{module, title, priority, preconditions, steps, expected}，steps 为数组。priority 字段必须严格使用 P0/P1/P2（三选一），不要输出“高/中/低”等描述。结合模块的关键场景/测试要点/耦合模块，给出至少 3 条高质量用例。',
      cleanHighlightColors: appConfig.cleanHighlightColors || ['#5b8def', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'],
      moduleFieldAliases: appConfig.moduleFieldAliases || {
        title: ['module', 'name', 'title', '模块', '模块名称'],
        scenarios: ['key_scenarios', '测试场景', '关键场景'],
        points: ['test_points', '测点要点', '测试要点'],
        coupled: ['coupled_modules', '耦合模块'],
        special: ['special', 'special_points', '特殊测试点'],
      },
      cleanedEntryFieldAliases: appConfig.cleanedEntryFieldAliases || {
        feature: ['feature', 'module', 'name', 'title', '功能', '功能点', '模块', '功能模块', '条目', '功能名称'],
        category: ['category', 'type', 'section', '章节', '分类', '类别'],
        description: ['description', 'desc', 'details', 'content', 'text', 'body', 'cleanedRequirement', 'cleaned', 'cleanedText', '整理内容', '需求描述', '功能描述', '模块描述', '清洗内容', '重新整理内容'],
        raw: ['rawText', 'rawRequirement', 'raw', 'original', 'originalRequirement', '原始需求', '原文', '清洗前内容', '需求原文', '原始需求描述'],
      },
      cleanedDescriptionFieldAliases: appConfig.cleanedDescriptionFieldAliases || {
        summary: ['summary', '概述', '简介', '描述', '说明', '重新整理内容', '功能描述'],
        goals: ['goals', '目标', '目的', '意图', '设计意图', '功能目标'],
        rules: ['rules', '逻辑', '规则', '要点', '细节', '功能说明'],
        constraints: ['constraints', '约束', '限制', '前提', '注意事项'],
        flows: ['flows', '流程', '步骤', '操作流程', '交互流程'],
        values: ['数值', '数值配置', '数值设置', 'values'],
        configs: ['配置', '配置项', 'configurations', 'configs'],
      },
    };
  }

  return { create: create };
});
