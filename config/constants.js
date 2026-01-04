(function() {
  var defaultPrompts = {
    system: '你是资深需求分析师，请清洗并重写下面的原始需求，重新整理前，要充分理解需求，理解设计意图，然后整理成结构化、可读性强的条目，保持原意，保留关键信息与约束条件，输出JSON数组：[{"功能": 具体功能名称,"类别": 核心改动的类别,"功能描述": {"重新整理内容": 具体重新整理的功能原文内容,"功能目标": [如有则为功能的目标],"规则": [功能的具体规则],"约束": [如有则为功能的限制和约束],"流程": [功能触发的具体流程]},"原始需求描述": [原始需求的所有相关描述]}]',
    compare: '你是需求覆盖率审查专家，请对比“原始需求”和“清洗后的需求”，判断清洗后的内容是否完整覆盖原需求。输出 JSON：{coverage: 百分比(0-100), missing: [未覆盖要点数组]}，如完全覆盖则 missing 为空数组。',
    split: '你是元气骑士项目的资深测试设计专家，请将输入的需求拆分为测试模块/功能点，每个模块包含名称、测点要点、测试场景、耦合模块，输出结构化清单，确保覆盖核心业务与主要模块的交叉。仅输出 JSON，每个模块的字段为：{模块名: [{测试场景:[具体测试场景]}，{测点要点:[具体测试要点]}，{耦合模块:[具体的耦合模块]}，{特殊测试点:[具体的特殊测试点]}]}。',
    review: '你是资深游戏项目的需求分析师，精通理解分析需求，从游戏设计角度和玩家体验角度多维度分析需求存在的问题，请先对原始需求中存在的问题进行归类（类别仅可为：需求矛盾、需求模糊、需求不全、边界不明确、分支预期不足、多余需求、无效需求），然后输出 JSON 数组：[{"类别": 分类, "不明确的需求点": 描述, "不明确原因": 原因说明, "可能存在的分支/边界情况": 分支说明}]。若无不明确点返回空数组，不要输出其它文本。',
    cases: '你是测试审核专家，请仔细地对“测试模块拆分结果”和“XMind 测试用例”进行充分理解后，再进行对比，输出“XMind 测试用例”中缺少的模块测试点，以及“XMind 测试用例”中多出的测试点，输出 JSON：{coverage: 百分比(0-100), missing: [{模块名: [缺失的模块测试点，包括但不限于常规测试点、通用测试点、异常测试点、特殊测试点]}], extra: [测试用例中多出的点]}，missing/extra 为空数组表示无缺失或额外多出，严格按照上述结构进行输出。',
    casegen: '你是游戏测试用例专家，针对单个测试模块生成 JSON 用例列表，每条用例字段：{module, title, priority（仅从P0、P1、P2中选择）, preconditions, steps, expected}，steps 为数组。通过模块的测试场景/测试要点/耦合模块，也要充分思考基于手机操作的特殊场景，以及重复操作，比如重复获取，重复处理等情况，给出足矣覆盖测试点的高质量用例。',
    casefilter: '你是测试用例去重专家，请比较“生成用例候选”与“已导入用例”。保留在导入用例中不存在或不高度相似的候选，用例结构保持与输入一致，输出 JSON 用例列表，每条用例字段：{module, title, priority（仅从P0、P1、P2中选择）, preconditions, steps, expected}，steps 为数组。'
  };

  var providerDefaults = {
    deepseek: {
      baseUrl: 'https://api.deepseek.com/chat/completions',
      model: 'deepseek-chat',
    },
    kimi: {
      baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
      model: 'k2',
    },
  };

  var defaultTempExecColumns = {
    select: true,
    index: true,
    module: true,
    priority: true,
    preconditions: true,
    steps: true,
    expected: true,
    ops: true,
  };

  var defaultCaseViewFontSize = 13;
  var minCaseViewFontSize = 11;
  var maxCaseViewFontSize = 16;

  var defaultPageGuideSwitches = {
    auto: true,
    clean: true,
    casesgen: true,
    assign: true,
    models: true,
    tempexec: true,
    'case-library': true,
    'case-archive': true,
    'exec-overview': true,
  };

  var defaultSettings = {
    timeoutSec: 300,
    feishuWebhook: '',
    feishuMention: '',
    theme: 'light',
    caseViewFontSize: defaultCaseViewFontSize,
    caseGenProgressCollapsed: false,
    sidebarTabActive: 'casegen',
    memoPad: {
      collapsed: false,
      activeTabId: 'memo-tab-1',
      tabs: [{ id: 'memo-tab-1', name: '', items: [] }],
    },
    smartTopNavCollapse: false,
    tempExecColumns: Object.assign({}, defaultTempExecColumns),
    pageGuideSwitches: Object.assign({}, defaultPageGuideSwitches),
  };

  var tabPageMap = {
    help: 'ai-workflow.html',
    auto: 'ai-workflow.html',
    clean: 'ai-workflow.html',
    casesgen: 'ai-workflow.html',
    assign: 'ai-tools.html',
    models: 'ai-tools.html',
    tempexec: 'case-exec.html',
    'exec-overview': 'case-exec.html',
    'case-library': 'case-library.html',
    'case-archive': 'case-library.html',
    'project-admin': 'admin.html',
    'user-admin': 'admin.html',
    'ops-log': 'admin.html',
    settings: 'settings.html',
  };

  var pageDefaultTabMap = {
    'ai-workflow': 'auto',
    'ai-tools': 'assign',
    'case-exec': 'tempexec',
    'case-library': 'case-library',
    admin: 'project-admin',
    settings: 'settings',
    index: 'auto',
  };

  var config = {
    defaultPrompts: defaultPrompts,
    defaultPromptsKey: 'usecase-default-prompts',
    defaultMaxTokens: 1024,
    providerDefaults: providerDefaults,
    legacyCleanKey: 'cleaner-config-v1',
    legacyCompareKey: 'cleaner-compare-config-v1',
    modelsKey: 'cleaner-models-v1',
    assignmentKey: 'cleaner-assignment-v1',
    activeTabKey: 'usecase-active-tab',
    workflowStorageKey: 'usecase-workflow-state-v1',
    tempExecStorageKey: 'usecase-temp-exec-v1',
    tempExecFocusStorageKey: 'tempexec-focus-v1',
    tempExecPageSizeStorageKey: 'tempexec-page-size',
    opsLogViewStorageKey: 'tap-ops-log-view-v1',
    opsActivityViewStorageKey: 'tap-ops-activity-view-v1',
    opsContributionViewStorageKey: 'tap-ops-contribution-view-v1',
    opsExecContributionViewStorageKey: 'tap-ops-exec-contribution-view-v1',
    defaultTempExecPageSize: 20,
    tempExecResultOptions: ['未执行', '通过', '失败', '阻塞', '不适用'],
    defaultPlacement: {
      requirementOrder: [],
      fileOrder: {},
      versionOrder: [],
    },
    cleanHighlightColors: ['#5b8def', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'],
    legacyCasesPrompt: '你是测试审核专家，请对比“测试模块拆分结果”和“XMind 测试用例”，输出 JSON：{coverage: 百分比(0-100), missing: [模块缺失点], extra: [测试用例中多出的点]}，missing/extra 为空数组表示无缺失或冗余。',
    legacyCleanPrompt: '你是资深需求分析师，请清洗并重写下面的原始需求，重新整理前，要充分理解需求，理解设计意图，然后整理成结构化、可读性强的条目，保持原意，保留关键信息与约束条件，输出JSON数组：[{"功能": 具体功能名称,"类别": 核心改动的类别,"功能描述": {"重新整理内容": 具体重新整理的功能原文内容,"功能目标": [如有则为功能的目标],"规则": [功能的具体规则],"约束": [如有则为功能的限制和约束],"流程": [功能触发的具体流程]},"原始需求描述": [原始需求的所有相关描述]}]。仅输出此 JSON 内容，禁止输出其它文字。',
    legacyCaseGenPrompt: '你是测试用例专家，针对单个测试模块生成 JSON 用例列表，每条用例字段：{module, title, priority, preconditions, steps, expected}，steps 为数组。priority 字段必须严格使用 P0/P1/P2（三选一），不要输出“高/中/低”等描述。结合模块的关键场景/测试要点/耦合模块，给出至少 3 条高质量用例。',
    defaultTempExecColumns: defaultTempExecColumns,
    defaultPageGuideSwitches: defaultPageGuideSwitches,
    defaultSettings: defaultSettings,
    settingsKey: 'usecase-settings-v1',
    minModelTimeoutSec: 30,
    maxModelTimeoutSec: 1800,
    defaultCaseViewFontSize: defaultCaseViewFontSize,
    minCaseViewFontSize: minCaseViewFontSize,
    maxCaseViewFontSize: maxCaseViewFontSize,
    moduleFieldAliases: {
      title: ['module', 'name', 'title', '模块', '模块名称'],
      scenarios: ['key_scenarios', '测试场景', '关键场景'],
      points: ['test_points', '测点要点', '测试要点'],
      coupled: ['coupled_modules', '耦合模块'],
    },
    cleanedEntryFieldAliases: {
      feature: ['feature', 'module', 'name', 'title', '功能', '功能点', '模块', '功能模块', '条目', '功能名称'],
      category: ['category', 'type', 'section', '章节', '分类', '类别'],
      description: ['description', 'desc', 'details', 'content', 'text', 'body', 'cleanedRequirement', 'cleaned', 'cleanedText', '整理内容', '需求描述', '功能描述', '模块描述', '清洗内容', '重新整理内容'],
      raw: ['rawText', 'rawRequirement', 'raw', 'original', 'originalRequirement', '原始需求', '原文', '清洗前内容', '需求原文', '原始需求描述'],
    },
    cleanedDescriptionFieldAliases: {
      summary: ['summary', '概述', '简介', '描述', '说明', '重新整理内容', '功能描述'],
      goals: ['goals', '目标', '目的', '意图', '设计意图', '功能目标'],
      rules: ['rules', '逻辑', '规则', '要点', '细节', '功能说明'],
      constraints: ['constraints', '约束', '限制', '前提', '注意事项'],
      flows: ['flows', '流程', '步骤', '操作流程', '交互流程'],
      values: ['数值', '数值配置', '数值设置', 'values'],
      configs: ['配置', '配置项', 'configurations', 'configs'],
    },
    tabPageMap: tabPageMap,
    pageDefaultTabMap: pageDefaultTabMap,
  };

  window.app = window.app || {};
  window.app.config = Object.assign(window.app.config || {}, config);
})();
