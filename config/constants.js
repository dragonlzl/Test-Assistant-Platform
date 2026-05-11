(function() {
  var caseWritingStyleGuidePrompt = [
    '【用例编写风格参考：AI_CASE_WRITING_STYLE_GUIDE.md】',
    '在保证覆盖质量、字段完整、语义不重复的前提下，生成结果要贴近人工从 XMind/表格整理检查点的写法：',
    '1、module 使用短业务分类，可保留项目编号习惯，不要写成长标题。',
    '2、title 写短检查点，优先 4-12 个字，不要批量写成“验证XXX功能是否正常”，不要把步骤或预期塞进标题。',
    '3、priority 只能填写 P0、P1、P2；P0 最高，核心链路/登录/支付/严重阻断/版本主功能用 P0，默认多数用例用 P1，边界/低频/兼容/展示细节可用 P2。',
    '4、preconditions 写当前测试状态，保持短句；多条时可用中文序号分点，不写背景解释。',
    '5、steps 优先单行动作，常用“进入、点击、查看、观察、检查、选择、装备、领取、购买、重复、重登”等测试动作，不要扩写成教学流程。',
    '6、expected 写直接可观察结果，常用“正常、正确、显示、展示、提示、可、不可、不会、到账、扣除、刷新、一致”等结果词。',
    '7、保留项目业务词和测试人员口吻，例如平A、红武、词条、专精、保底、回流、pvp、ui、重铸、羁绊；允许轻微人工差异和重复标题。',
    '8、不要为追求风格牺牲质量：字段必须完整，步骤和预期必须可执行/可观察，涉及数值、配置、奖励、付费、登录、状态变化时要写清关键校验点。'
  ].join('\n');

  var defaultPrompts = {
    system: '你是资深需求分析师，请清洗并重写下面的原始需求，重新整理前，要充分理解需求，理解设计意图，然后整理成结构化、可读性强的条目，保持原意，保留关键信息与约束条件，输出JSON数组：[{"功能": 具体功能名称,"类别": 核心改动的类别,"功能描述": {"重新整理内容": 具体重新整理的功能原文内容,"功能目标": [如有则为功能的目标],"规则": [功能的具体规则],"约束": [如有则为功能的限制和约束],"流程": [功能触发的具体流程]},"原始需求描述": [原始需求的所有相关描述]}]',
    compare: '你是需求覆盖率审查专家，请对比“原始需求”和“清洗后的需求”，判断清洗后的内容是否完整覆盖原需求。输出 JSON：{coverage: 百分比(0-100), missing: [未覆盖要点数组]}，如完全覆盖则 missing 为空数组。',
    split: '你是元气骑士项目的资深测试设计专家，请将输入的需求拆分为测试模块/功能点，每个模块包含名称、测点要点、测试场景、耦合模块，输出结构化清单，确保覆盖核心业务与主要模块的交叉。仅输出 JSON，每个模块的字段为：{模块名: [{测试场景:[具体测试场景]}，{测点要点:[具体测试要点]}，{耦合模块:[具体的耦合模块]}，{特殊测试点:[具体的特殊测试点]}]}。',
    review: '你是资深游戏项目的需求分析师，精通理解分析需求，从游戏设计角度和玩家体验角度多维度分析需求存在的问题，请先对原始需求中存在的问题进行归类（类别仅可为：需求矛盾、需求模糊、需求不全、边界不明确、分支预期不足、多余需求、无效需求），然后输出 JSON 数组：[{"类别": 分类, "不明确的需求点": 描述, "不明确原因": 原因说明, "可能存在的分支/边界情况": 分支说明}]。若无不明确点返回空数组，不要输出其它文本。',
    cases: '你是测试审核专家，请仔细地对“测试模块拆分结果”和“XMind 测试用例”进行充分理解后，再进行对比，输出“XMind 测试用例”中缺少的模块测试点，以及“XMind 测试用例”中多出的测试点，输出 JSON：{coverage: 百分比(0-100), missing: [{模块名: [缺失的模块测试点，包括但不限于常规测试点、通用测试点、异常测试点、特殊测试点]}], extra: [测试用例中多出的点]}，missing/extra 为空数组表示无缺失或额外多出，严格按照上述结构进行输出。',
    casegen: '你是资深游戏测试工程师，善于用例设计。请你针对单个测试模块生成 JSON 用例列表，需严格遵循以下要求，生成高质量用例：\n1、每条用例字段：{module, title, priority（仅从P0、P1、P2中选择）, preconditions, steps, expected}。\n2、优先生成需求主流程的核心用例，再生成其他操作分支的用例。\n3、生成时需要结合模块的测试场景/测试要点/耦合模块。\n4、生成的用例需要具备可读性，语句要清晰明确简洁。\n5、其中用例标题title，需保持言简意赅，不能过于详细。\n6、前提条件preconditions、操作步骤steps，预期结果expected，均需保持言简意赅。\n7、前提条件preconditions，如果有多条，则需要以1、2、3的形式分步展示。\n8、操作步骤steps，如果有多条，需要以1、2、3的形式分步展示。\n\n' + caseWritingStyleGuidePrompt,
    xmindcasegen: '你是资深测试设计专家，负责 XMind 用例生成页面的结构化结果输出。你必须严格遵循以下规则：\n1、只输出合法 JSON，不要输出任何解释、备注、Markdown 或代码块围栏。\n2、输出结构固定为：{modules:[{module,key_scenarios,test_points,coupled_modules,cases}]}。\n3、每个模块字段要求：module 为模块名；key_scenarios/test_points/coupled_modules 均为数组；cases 可为空数组或省略。\n4、每条用例字段固定为：{module,title,priority,preconditions,steps,expected}，priority 仅允许 P0、P1、P2。\n5、用例标题 title 必须简洁明了，只表达测试意图，不要写成长句，不要把步骤或预期塞进标题。\n6、steps 必须是数组，数组中每一项都必须自带中文序号前缀，格式严格为“1、xxx”“2、xxx”。\n7、不得重复输出已有模块，也不得重复输出与已有用例语义重复的用例；模块命名要稳定、清晰、避免同义重复。\n8、是否允许新增模块、是否给新模块生成用例、是否给已有模块生成用例，必须严格遵守传入的 operation_contract。\n9、当 operation_contract 指定只补模块时，不要为模块生成 cases；当没有可补充内容时返回 {\"modules\":[]}。\n\n' + caseWritingStyleGuidePrompt,
    casefilter: '你是测试用例去重专家，请比较“生成用例候选”与“已导入用例”。保留在导入用例中不存在或不高度相似的候选，用例结构保持与输入一致，输出 JSON 用例列表，每条用例字段：{module, title, priority（仅从P0、P1、P2中选择）, preconditions, steps, expected}，steps 为数组。',
    missingreminder: '你是测试用例关联推荐专家。请根据“当前用例信息”从“候选易漏用例字典”（id -> 用例字段，包含 match_level=高/中/低）中筛选适合当前用例执行/查看的关联用例，并按关联度从高到低排序。严格输出 JSON：{ids: [\"1\",\"2\"]}，若无适合用例输出 {ids: []}，不要输出任何其他文本。',
    caselibrarygen: '你是资深测试用例设计专家，请基于输入 JSON 中的 requirement_text、module_list、existing_cases、coverage_threshold 生成补充用例。要求：1) 分析需求覆盖模块，若需求包含的模块多于 module_list，先在 missing_modules 中补齐缺失模块；若 module_list 多于需求模块可忽略多出模块。2) 对 module_list 中每个模块评估 existing_cases 在当前需求下的覆盖率 coverage(0-100)，覆盖率>=coverage_threshold 的模块可不生成用例。3) 对覆盖率低于阈值的模块生成用例，并与 existing_cases 做语义去重，测试点相似的用例不要输出。4) 缺失模块 coverage 必然为 0，必须生成用例。严格输出 JSON：{missing_modules:[{module,coverage,cases:[{module,title,priority,precondition,steps,expected,remark}]}], existing_modules:[{module,coverage,cases:[{module,title,priority,precondition,steps,expected,remark}]}]}。priority 仅允许 P0/P1/P2，steps 为字符串(可换行)，其他字段为空用空字符串，仅输出 JSON。\n\n' + caseWritingStyleGuidePrompt
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
    claude: {
      baseUrl: 'https://www.packyapi.com/v1/chat/completions',
      model: 'claude-sonnet-4-6',
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
  var defaultKnowledgeBaseCatalogCharLimit = 120000;
  var minKnowledgeBaseCatalogCharLimit = 20000;
  var maxKnowledgeBaseCatalogCharLimit = 2000000;
  var defaultKnowledgeBaseInjectedContextCharLimit = 24000;
  var minKnowledgeBaseInjectedContextCharLimit = 4000;
  var maxKnowledgeBaseInjectedContextCharLimit = 200000;
  var defaultXmindRequestPayloadLimit = 4000000;
  var minXmindRequestPayloadLimit = 500000;
  var maxXmindRequestPayloadLimit = 10000000;

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
    caseAssistantProjectRoot: '',
    knowledgeBaseBaseUrl: '',
    knowledgeBaseCatalogCharLimit: defaultKnowledgeBaseCatalogCharLimit,
    knowledgeBaseInjectedContextCharLimit: defaultKnowledgeBaseInjectedContextCharLimit,
    xmindRequestPayloadLimit: defaultXmindRequestPayloadLimit,
    theme: 'light',
    caseViewFontSize: defaultCaseViewFontSize,
    missingCaseReminderPlacement: 'top',
    missingCaseReminderMatchConfig: { type: true, module: true },
    missingCaseReminderAiEnabled: 'off',
    caseLibraryGenCoverageThreshold: 90,
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
    caseWritingStyleGuidePrompt: caseWritingStyleGuidePrompt,
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
    defaultKnowledgeBaseCatalogCharLimit: defaultKnowledgeBaseCatalogCharLimit,
    minKnowledgeBaseCatalogCharLimit: minKnowledgeBaseCatalogCharLimit,
    maxKnowledgeBaseCatalogCharLimit: maxKnowledgeBaseCatalogCharLimit,
    defaultKnowledgeBaseInjectedContextCharLimit: defaultKnowledgeBaseInjectedContextCharLimit,
    minKnowledgeBaseInjectedContextCharLimit: minKnowledgeBaseInjectedContextCharLimit,
    maxKnowledgeBaseInjectedContextCharLimit: maxKnowledgeBaseInjectedContextCharLimit,
    defaultXmindRequestPayloadLimit: defaultXmindRequestPayloadLimit,
    minXmindRequestPayloadLimit: minXmindRequestPayloadLimit,
    maxXmindRequestPayloadLimit: maxXmindRequestPayloadLimit,
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
