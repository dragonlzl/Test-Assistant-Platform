(function() {
  var caseWritingStyleGuidePrompt = [
    '【用例编写风格与人工特征参考：AI_CASE_WRITING_STYLE_GUIDE.md】',
    '在保证覆盖质量、字段完整、语义不重复的前提下，生成结果要贴近人工从 XMind/表格整理检查点的写法，并根据需求类型补充人工高频漏点：',
    '1、module 使用短业务分类，可保留项目编号习惯，不要写成长标题。',
    '2、title 写短检查点，优先 4-12 个字，不要批量写成“验证XXX功能是否正常”，不要把步骤或预期塞进标题。',
    '3、priority 只能填写 P0、P1、P2；P0 最高，核心链路/登录/支付/严重阻断/版本主功能用 P0，默认多数用例用 P1，边界/低频/兼容/展示细节可用 P2。',
    '4、preconditions 写当前测试状态，保持短句；多条时可用中文序号分点，不写背景解释。',
    '5、steps 优先单行动作，常用“进入、点击、查看、观察、检查、选择、装备、领取、购买、重复、重登”等测试动作，不要扩写成教学流程。',
    '6、expected 写直接可观察结果，常用“正常、正确、显示、展示、提示、可、不可、不会、到账、扣除、刷新、一致”等结果词。',
    '7、保留项目业务词和测试人员口吻，例如平A、红武、词条、专精、保底、回流、pvp、ui、重铸、羁绊；允许轻微人工差异和重复标题。',
    '8、优先补人工常见漏点：旧入口/旧逻辑兼容、真实入口矩阵、跨模式/跨场景兼容、快速连点/多指/重复进入等异常操作、断网/后台/重启/重登恢复、云存档/本地缓存/跨局/跨日状态一致性。',
    '9、涉及资源或奖励时，覆盖领取、购买、兑换、分解、返还、扣费、到账、次数减少、余额刷新、货币上限、已拥有/未拥有/全部拥有、取消不生效、失败不扣费、成功后刷新。',
    '10、涉及配置或随机时，覆盖空配置、缺字段、非法编号、异常品质、候选池不足、概率0/100、全档位映射、相邻档位切换、按兜底策略处理。',
    '11、涉及联机或多人时，覆盖主机/从机、自己/队友、第三人称观察、同步显示、归属隔离、多人弹窗或候选结果是否一致。',
    '12、涉及 UI、演示或资源时，覆盖多语言、字体切换、特殊分辨率、长文本超框、音画同步、资源缺失兜底、关闭返回层级和多次切换稳定性。',
    '13、不要为追求风格牺牲质量：字段必须完整，步骤和预期必须可执行/可观察，涉及数值、配置、奖励、付费、登录、状态变化时要写清关键校验点。'
  ].join('\n');

  var defaultPrompts = {
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

  var defaultSettings = {
    timeoutSec: 300,
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
  };

  var tabPageMap = {
    help: 'ai-workflow.html',
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
    'ai-workflow': 'casesgen',
    'ai-tools': 'assign',
    'case-exec': 'tempexec',
    'case-library': 'case-library',
    admin: 'project-admin',
    settings: 'settings',
    index: 'casesgen',
  };

  var config = {
    defaultPrompts: defaultPrompts,
    caseWritingStyleGuidePrompt: caseWritingStyleGuidePrompt,
    defaultPromptsKey: 'usecase-default-prompts',
    defaultMaxTokens: 1024,
    providerDefaults: providerDefaults,
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
    defaultTempExecColumns: defaultTempExecColumns,
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
    tabPageMap: tabPageMap,
    pageDefaultTabMap: pageDefaultTabMap,
  };

  window.app = window.app || {};
  window.app.config = Object.assign(window.app.config || {}, config);
})();
