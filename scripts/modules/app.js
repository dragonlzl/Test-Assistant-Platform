    window.app = window.app || {};
    function markInitStage(stage) {
      var stableStage = stage ? String(stage || '') : '';
      window.app.__tapInitStage = stableStage;
      var nextHistory = Array.isArray(window.app.__tapInitStageHistory)
        ? window.app.__tapInitStageHistory.slice()
        : [];
      nextHistory.push(stableStage);
      if (nextHistory.length > 24) nextHistory = nextHistory.slice(nextHistory.length - 24);
      window.app.__tapInitStageHistory = nextHistory;
      try {
        var root = document && document.documentElement ? document.documentElement : null;
        if (!root) return;
        var historyText = nextHistory.join('>');
        if (root.dataset) {
          root.dataset.tapInitStage = stableStage;
          root.dataset.tapInitStageHistory = historyText;
        } else {
          root.setAttribute('data-tap-init-stage', stableStage);
          root.setAttribute('data-tap-init-stage-history', historyText);
        }
      } catch (err) {
        // ignore
      }
    }
    markInitStage('app-script-start');
    const appUtils = window.app.utils || {};
    const appConfig = window.app.config || {};
    window.app.config = appConfig;

    const providerDefaults = appConfig.providerDefaults || {};
    const defaultPrompts = appConfig.defaultPrompts || {};
    const defaultPromptsKey = appConfig.defaultPromptsKey || 'usecase-default-prompts';
    const defaultMaxTokens = appConfig.defaultMaxTokens || 1024;
    const legacyCleanKey = appConfig.legacyCleanKey || 'cleaner-config-v1';
    const legacyCompareKey = appConfig.legacyCompareKey || 'cleaner-compare-config-v1';
    const modelsKey = appConfig.modelsKey || 'cleaner-models-v1';
    const assignmentKey = appConfig.assignmentKey || 'cleaner-assignment-v1';
    const activeTabKey = appConfig.activeTabKey || 'usecase-active-tab';
    const workflowStorageKey = appConfig.workflowStorageKey || 'usecase-workflow-state-v1';
    const tempExecStorageKey = appConfig.tempExecStorageKey || 'usecase-temp-exec-v1';
    const tempExecFocusStorageKey = appConfig.tempExecFocusStorageKey || 'tempexec-focus-v1';
    const tempExecPageSizeStorageKey = appConfig.tempExecPageSizeStorageKey || 'tempexec-page-size';
    const defaultTempExecPageSize = Number(appConfig.defaultTempExecPageSize) || 20;
    const tempExecResultOptions = Array.isArray(appConfig.tempExecResultOptions)
      ? appConfig.tempExecResultOptions
      : ['未执行', '通过', '失败', '阻塞', '不适用'];
    const defaultPlacement = appConfig.defaultPlacement || { requirementOrder: [], fileOrder: {}, versionOrder: [] };
    const defaultTempExecColumns = appConfig.defaultTempExecColumns || {
      select: true,
      index: true,
      module: true,
      priority: true,
      preconditions: true,
      steps: true,
      expected: true,
      ops: true,
    };
    const defaultSettings = appConfig.defaultSettings || {
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
      tempExecColumns: { ...defaultTempExecColumns },
      projectOrder: [],
      defaultProjectId: '',
    };
    const settingsKey = appConfig.settingsKey || 'usecase-settings-v1';
    const minModelTimeoutSec = Number(appConfig.minModelTimeoutSec) || 30;
    const maxModelTimeoutSec = Number(appConfig.maxModelTimeoutSec) || 1800;
    const defaultCaseViewFontSize = Number(appConfig.defaultCaseViewFontSize)
      || (defaultSettings && defaultSettings.caseViewFontSize ? Number(defaultSettings.caseViewFontSize) : 13);
    const minCaseViewFontSize = Number(appConfig.minCaseViewFontSize) || 11;
    const maxCaseViewFontSize = Number(appConfig.maxCaseViewFontSize) || 16;
    const legacyCasesPrompt = appConfig.legacyCasesPrompt || '你是测试审核专家，请对比“测试模块拆分结果”和“XMind 测试用例”，输出 JSON：{coverage: 百分比(0-100), missing: [模块缺失点], extra: [测试用例中多出的点]}，missing/extra 为空数组表示无缺失或冗余。';
    const legacyCleanPrompt = appConfig.legacyCleanPrompt || '你是资深需求分析师，请清洗并重写下面的原始需求，重新整理前，要充分理解需求，理解设计意图，然后整理成结构化、可读性强的条目，保持原意，保留关键信息与约束条件，输出JSON数组：[{"功能": 具体功能名称,"类别": 核心改动的类别,"功能描述": {"重新整理内容": 具体重新整理的功能原文内容,"功能目标": [如有则为功能的目标],"规则": [功能的具体规则],"约束": [如有则为功能的限制和约束],"流程": [功能触发的具体流程]},"原始需求描述": [原始需求的所有相关描述]}]。仅输出此 JSON 内容，禁止输出其它文字。';
    const legacyCaseGenPrompt = appConfig.legacyCaseGenPrompt || '你是测试用例专家，针对单个测试模块生成 JSON 用例列表，每条用例字段：{module, title, priority, preconditions, steps, expected}，steps 为数组。priority 字段必须严格使用 P0/P1/P2（三选一），不要输出“高/中/低”等描述。结合模块的关键场景/测试要点/耦合模块，给出至少 3 条高质量用例。';
    const cleanHighlightColors = appConfig.cleanHighlightColors || ['#5b8def', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];
    const moduleFieldAliases = appConfig.moduleFieldAliases || {
      title: ['module', 'name', 'title', '模块', '模块名称'],
      scenarios: ['key_scenarios', '测试场景', '关键场景'],
      points: ['test_points', '测点要点', '测试要点'],
      coupled: ['coupled_modules', '耦合模块'],
      special: ['special', 'special_points', '特殊测试点'],
    };
    const cleanedEntryFieldAliases = appConfig.cleanedEntryFieldAliases || {
      feature: ['feature', 'module', 'name', 'title', '功能', '功能点', '模块', '功能模块', '条目', '功能名称'],
      category: ['category', 'type', 'section', '章节', '分类', '类别'],
      description: ['description', 'desc', 'details', 'content', 'text', 'body', 'cleanedRequirement', 'cleaned', 'cleanedText', '整理内容', '需求描述', '功能描述', '模块描述', '清洗内容', '重新整理内容'],
      raw: ['rawText', 'rawRequirement', 'raw', 'original', 'originalRequirement', '原始需求', '原文', '清洗前内容', '需求原文', '原始需求描述'],
    };
    const cleanedDescriptionFieldAliases = appConfig.cleanedDescriptionFieldAliases || {
      summary: ['summary', '概述', '简介', '描述', '说明', '重新整理内容', '功能描述'],
      goals: ['goals', '目标', '目的', '意图', '设计意图', '功能目标'],
      rules: ['rules', '逻辑', '规则', '要点', '细节', '功能说明'],
      constraints: ['constraints', '约束', '限制', '前提', '注意事项'],
      flows: ['flows', '流程', '步骤', '操作流程', '交互流程'],
      values: ['数值', '数值配置', '数值设置', 'values'],
      configs: ['配置', '配置项', 'configurations', 'configs'],
    };

    const stateManager = window.app.stateManager || {};
    const state = typeof stateManager.initState === 'function'
      ? stateManager.initState({
          defaultSettings,
          defaultPlacement,
          defaultTempExecPageSize,
        })
      : (window.app.state || {});
    window.app.state = state;
    if (!state.requirementLabel) {
      state.requirementLabel = '当前需求';
      state.requirementLabelSource = state.requirementLabelSource || 'default';
    }
    const appInitHelpers = window.app.appInitHelpers || {};
    if (!appInitHelpers.createFallbacks) {
      throw new Error('appInitHelpers 未加载');
    }
    const appApi = appInitHelpers.createFallbacks({ defaultTempExecPageSize });
    const api = appApi;
    const proxyApi = function(name) {
      const wrapper = function() {
        if (api && typeof api[name] === 'function') {
          return api[name].apply(null, arguments);
        }
        return api ? api[name] : undefined;
      };
      wrapper.__appProxy = name;
      return wrapper;
    };
    const apiProxy = new Proxy({}, {
      get: function(_, prop) {
        return proxyApi(prop);
      },
    });
    const {
      refreshMissingSmartFillButton,
      updateMissingView,
      toggleMissingView,
      copyMissingJson,
      syncReviewViewFromResult,
      renderCaseGeneration,
      renderCaseTable,
      renderAutoRawInfo,
      renderCleanRawView,
      renderImportedCaseList,
      removeImportedCase,
      hasImportedCases,
      hasCaseSource,
      getImportedCaseObjects,
      syncCaseTextWithImports,
      toggleImportedCaseView,
      buildCasesComparePayload,
      buildReviewClarificationContext,
      resetImportedCaseView,
      refreshImportedCaseView,
      handleCaseFiles,
      updateAutoCompareActions,
      updateAutoMissingCard,
      syncAutoCompareStatus,
      exportCompareResult,
      importCompareResult,
      handleMissingSelectionChange,
      handleMissingSelectAll,
      smartFillMissingSuggestions,
      updateAutoClarifyVisibility,
      ensureCaseGenModulesFromSplit,
      exportCasesCoverage,
      importCasesCoverage,
      compareCoverage,
      compareCasesCoverage,
      extractCompareResultData,
      extractCoverageFromCompareResult,
      goCasesGenAndScroll,
      runCleaning,
      copyCleaned,
      syncSplitView,
      toggleSplitView,
      shouldExpectCleanJson,
      getCleanedTextForModel,
      renderCleanView,
      locateCleanRawSelection,
      jumpToCleanHighlightView,
      renderTempExecView,
      applyTempExecPageSize,
      clampTempExecPageSize,
      createTempExecFile,
      syncTempExecFocus,
      persistTempExecState,
      setTempExecActive,
      removeTempExecFile,
      getCaseExecutionDisplay,
      renderCaseGenProgressBoard,
      setCaseModuleRunning,
      isCaseModuleRunning,
      renderCaseModuleProgress,
      updateCaseProgressView,
      clearCaseProgress,
      initCaseProgress,
      setCaseProgressGroupState,
      setCaseProgressStep,
      markAllCaseProgressGroups,
      updateFlowStatus,
      scrollToSection,
      refreshExportCaseGenButton,
      setCaseViewHint,
    } = apiProxy;
    const buildDom = appInitHelpers.buildDom || function(ids, alias) {
      const result = {};
      (ids || []).forEach(function(id) { result[id] = document.getElementById(id); });
      (alias || []).forEach(function(item) {
        if (item && item.name) result[item.name] = document.getElementById(item.id || item.name);
      });
      return result;
    };
    const assignIfPresent = appInitHelpers.assignIfPresent || function(target, source, keys) {
      if (!target || !source) return target;
      (keys || []).forEach(function(key) {
        const val = source && source[key];
        if (!val || (val && val.__appProxy && val.__appProxy === key)) return;
        target[key] = val;
      });
      return target;
    };
    const baseInitModule = appInitHelpers.initModule || function(name, args) {
      const mod = window.app && window.app[name];
      return mod && typeof mod.init === 'function' ? mod.init(args || {}) : null;
    };
    const initModule = function(name, args) {
      try {
        return baseInitModule(name, args);
      } catch (err) {
        if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
          console.warn('模块初始化失败: ' + name, err);
        }
        return null;
      }
    };
    let debugNodes;
    let switchTab = function(name) {
      if (api && typeof api.switchTab === 'function') return api.switchTab(name);
      return null;
    };
    var persistWorkflowState = function() {};
    var persistWorkflowStateNow = function() {};
    function requestPersistWorkflowState() {
      return persistWorkflowState();
    }
    function requestPersistWorkflowStateNow() {
      return persistWorkflowStateNow();
    }

    function clampTimeoutSeconds(value) {
      const num = Math.round(Number(value));
      if (!Number.isFinite(num) || num <= 0) return defaultSettings.timeoutSec;
      return Math.min(maxModelTimeoutSec, Math.max(minModelTimeoutSec, num));
    }

    const setStatus = appUtils.setStatus;

    function updateModelTiming(el, durationMs) {
      if (!el) return;
      if (!Number.isFinite(durationMs)) {
        el.textContent = '--';
      } else {
        el.textContent = (durationMs / 1000).toFixed(2);
      }
    }

    const debounce = appUtils.debounce;

    const downloadBlob = appUtils.downloadBlob;
    const downloadText = appUtils.downloadText;
    const stripCodeFence = appUtils.stripCodeFence;
    const extractJsonPayload = appUtils.extractJsonPayload;
    const formatJsonOrText = appUtils.formatJsonOrText;
    const extractJsonObjects = appUtils.extractJsonObjects;
    const sanitizeCasesForExport = appUtils.sanitizeCasesForExport;
    const escapeHtml = appUtils.escapeHtml;
    const escapeHtmlPreserve = appUtils.escapeHtmlPreserve;
    const runConcurrent = appUtils.runConcurrent;

    const assignHandlersModule = initModule('assignHandlers', {
      state,
      defaultPrompts,
      storageKey: defaultPromptsKey,
      setStatus,
      downloadText,
    });
    const assignHandlersFallback = {
      loadCustomDefaultPrompts: function noopLoadPrompts() {},
      saveDefaultPrompts: function noopSavePrompts() {},
      exportDefaultPrompts: function noopExportPrompts() {},
      importDefaultPrompts: async function noopImportPrompts() {},
    };
    const {
      loadCustomDefaultPrompts,
      saveDefaultPrompts,
      exportDefaultPrompts,
      importDefaultPrompts,
    } = assignHandlersModule || assignHandlersFallback;
    loadCustomDefaultPrompts();

    const requirementCoreModule = initModule('requirementCore', {
      state,
      utils: { stripCodeFence },
      handlers: { renderAutoRawInfo: function renderAutoRawInfoProxy() { renderAutoRawInfo(); } },
    });
    if (!requirementCoreModule) {
      throw new Error('requirementCore 未加载');
    }
    const requirementApi = requirementCoreModule;
    const {
      normalizeRequirementName,
      stripRequirementHeader,
      setRequirementLabel,
      getRequirementLabel,
      buildRequirementPrompt,
      ensureRequirementLabel,
      promptRequirementLabel,
      promptTempExecRequirement,
      formatCompactTimestamp,
      wrapDataWithRequirement,
      unwrapRequirementPayload,
      extractRequirementLabelFromText,
      wrapTextWithRequirement,
      getRequirementDisplayName,
      getSafeRequirementSlug,
    } = requirementApi;
    window.app.setRequirementLabel = setRequirementLabel;
    window.app.getRequirementLabel = getRequirementLabel;
    window.app.ensureRequirementLabel = ensureRequirementLabel;

    const splitCore = window.app && window.app.splitCore && typeof window.app.splitCore.init === 'function'
      ? window.app.splitCore.init({ moduleFieldAliases, normalizeRequirementName, unwrapRequirementPayload, stripCodeFence })
      : null;
    const pickFirstString = splitCore && splitCore.pickFirstString ? splitCore.pickFirstString : function pickFirstStringFallback() { return ''; };
    const pickFirstValue = splitCore && splitCore.pickFirstValue ? splitCore.pickFirstValue : function pickFirstValueFallback() { return undefined; };
    const pickFirstArray = splitCore && splitCore.pickFirstArray ? splitCore.pickFirstArray : function pickFirstArrayFallback() { return []; };

    const cleanCore = window.app && window.app.cleanCore && typeof window.app.cleanCore.init === 'function'
      ? window.app.cleanCore.init({
        unwrapRequirementPayload,
        extractJsonObjects,
        cleanedEntryFieldAliases,
        cleanedDescriptionFieldAliases,
        pickFirstValue,
        pickFirstString,
      })
        : null;

    const modelClientService = window.app && window.app.services && window.app.services.modelClient;

    function getConfiguredTimeoutSec() {
      const storedTimeout = state.settings && Object.prototype.hasOwnProperty.call(state.settings, 'timeoutSec')
        ? state.settings.timeoutSec
        : undefined;
      return storedTimeout === null || storedTimeout === undefined ? defaultSettings.timeoutSec : storedTimeout;
    }

    function isR1Model(model) {
      const source = model && model.model ? String(model.model).toLowerCase() : '';
      return source.includes('deepseek-r1') || source.includes('deepseek-reasoner');
    }

    const modelClient = modelClientService && typeof modelClientService.createModelClient === 'function'
      ? modelClientService.createModelClient({
        defaultPrompts,
        defaultMaxTokens,
        clampTimeoutSeconds,
        getTimeoutSec: getConfiguredTimeoutSec,
        modelIsR1: isR1Model,
        stripCodeFence,
      })
      : null;

    function setLastModelError(err) {
      if (typeof window === 'undefined') return;
      if (!window.app) window.app = {};
      if (!err) {
        window.app.__lastModelError = null;
        return;
      }
      var msg = err && err.message ? err.message : String(err || '');
      window.app.__lastModelError = { message: msg, name: err && err.name ? err.name : '', at: Date.now() };
    }

    function getLastModelError() {
      if (typeof window === 'undefined' || !window.app) return null;
      var err = window.app.__lastModelError;
      return err && typeof err === 'object' ? err : null;
    }

    function clearLastModelError() {
      setLastModelError(null);
    }

    function wrapCallModelWithTracking(fn) {
      return async function wrappedCallModel() {
        try {
          var result = await fn.apply(null, arguments);
          clearLastModelError();
          return result;
        } catch (err) {
          setLastModelError(err);
          throw err;
        }
      };
    }

    const callModelWithConfig = wrapCallModelWithTracking(
      modelClient && typeof modelClient.callModelWithConfig === 'function'
        ? modelClient.callModelWithConfig
        : async function missingModelClient() {
          throw new Error('模型客户端不可用，请刷新页面后重试');
        }
    );
    const callModelWithContent = wrapCallModelWithTracking(
      modelClient && typeof modelClient.callModelWithContent === 'function'
        ? modelClient.callModelWithContent
        : async function missingContentModelClient() {
          throw new Error('多模态模型客户端不可用，请刷新页面后重试');
        }
    );
    const abortAllModelRequests = modelClient && typeof modelClient.abortAllRequests === 'function'
      ? modelClient.abortAllRequests
      : function noopAbortAllModelRequests() {};
    const abortModelRequestsByOwner = modelClient && typeof modelClient.abortRequestsByOwner === 'function'
      ? modelClient.abortRequestsByOwner
      : function noopAbortModelRequestsByOwner() { return 0; };

    function initMissingReminderAiManager(options) {
      const utils = options && options.utils ? options.utils : {};
      const callModel = options && typeof options.callModelWithConfig === 'function'
        ? options.callModelWithConfig
        : async function missingCall() {
          throw new Error('模型客户端不可用，请刷新页面后重试');
        };
      const storagePrefix = 'tap-missing-reminder-ai-task:';
      const runnerId = 'missing-reminder-ai-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      const runningMap = {};
      const heartbeatIntervalMs = 2000;
      const staleMs = 6000;
      const takeoverTimers = {};
      var pageUnloading = false;

      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('pagehide', function() { pageUnloading = true; });
        window.addEventListener('beforeunload', function() { pageUnloading = true; });
      }

      function buildKey(scene) {
        return storagePrefix + scene;
      }

      function safeJsonParse(raw) {
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch (err) {
          return null;
        }
      }

      function readTask(scene) {
        if (!scene || typeof localStorage === 'undefined') return null;
        try {
          return safeJsonParse(localStorage.getItem(buildKey(scene)));
        } catch (err) {
          return null;
        }
      }

      function emitTaskUpdate(scene, task, action) {
        if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
        try {
          if (typeof CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent('missing-reminder-ai-task', { detail: { scene: scene, task: task, action: action || '' } }));
          } else if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
            var evt = document.createEvent('CustomEvent');
            evt.initCustomEvent('missing-reminder-ai-task', false, false, { scene: scene, task: task, action: action || '' });
            window.dispatchEvent(evt);
          }
        } catch (err) {
          // ignore
        }
      }

      function writeTask(scene, task, action) {
        if (!scene || typeof localStorage === 'undefined') return task || null;
        if (!task) {
          try {
            localStorage.removeItem(buildKey(scene));
          } catch (err) {
            // ignore
          }
          emitTaskUpdate(scene, null, action || 'clear');
          return null;
        }
        var next = task;
        next.updatedAt = Date.now();
        try {
          localStorage.setItem(buildKey(scene), JSON.stringify(next));
        } catch (err) {
          // ignore
        }
        emitTaskUpdate(scene, next, action || 'update');
        return next;
      }

      function clearTask(scene) {
        writeTask(scene, null, 'clear');
      }

      function updateTask(scene, patch, action) {
        if (!scene) return null;
        var current = readTask(scene);
        if (!current) return null;
        var next = patch && typeof patch === 'object' ? Object.assign({}, current, patch) : current;
        return writeTask(scene, next, action || 'update');
      }

      function buildTaskId() {
        return 'missing-reminder-ai-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      }

      function normalizeModelSnapshot(model) {
        if (!model || typeof model !== 'object') return null;
        return {
          id: model.id || '',
          name: model.name || '',
          provider: model.provider || '',
          baseUrl: model.baseUrl || '',
          apiKey: model.apiKey || '',
          model: model.model || '',
          maxTokens: model.maxTokens,
          stream: model.stream,
          streamMode: model.streamMode,
        };
      }

      function createTask(scene, payload) {
        var base = payload && typeof payload === 'object' ? Object.assign({}, payload) : {};
        base.id = base.id || buildTaskId();
        base.scene = scene || base.scene || '';
        base.status = 'running';
        base.createdAt = base.createdAt || Date.now();
        base.updatedAt = base.updatedAt || base.createdAt;
        base.retryCount = Number(base.retryCount || 0);
        if (base.model) base.model = normalizeModelSnapshot(base.model);
        return base;
      }

      function parseTaskIds(content) {
        var raw = content || '';
        var stripped = utils && typeof utils.stripCodeFence === 'function'
          ? utils.stripCodeFence(raw)
          : String(raw || '').trim();
        var payloadText = utils && typeof utils.extractJsonPayload === 'function'
          ? utils.extractJsonPayload(stripped)
          : '';
        var text = payloadText || stripped;
        var data = JSON.parse(text);
        var ids = data && Array.isArray(data.ids) ? data.ids : [];
        return ids.map(function(id) { return String(id).trim(); }).filter(Boolean);
      }

      function resolveUserText(task) {
        if (!task) return '';
        if (typeof task.userText === 'string' && task.userText.trim()) return task.userText;
        if (task.userPayload && typeof task.userPayload === 'object') {
          try {
            return JSON.stringify(task.userPayload, null, 2);
          } catch (err) {
            return '';
          }
        }
        return '';
      }

      function cloneJson(value, fallback) {
        if (value === undefined || value === null) return fallback;
        try {
          return JSON.parse(JSON.stringify(value));
        } catch (err) {
          return fallback;
        }
      }

      function normalizeText(value) {
        if (value === null || value === undefined) return '';
        if (Array.isArray(value)) {
          return value.map(function(item) { return normalizeText(item); }).filter(Boolean).join('\n');
        }
        return String(value).replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, '').replace(/\r/g, '\n').trim();
      }

      function normalizeFlatText(value) {
        return normalizeText(value).replace(/\s+/g, ' ').trim();
      }

      function normalizeModuleKey(value) {
        return normalizeFlatText(value).toLowerCase();
      }

      function normalizePriority(value) {
        var text = normalizeFlatText(value);
        if (!text) return 'P1';
        var head = text.charAt(0);
        if (head === 'p' || head === 'P') return 'P' + text.slice(1);
        return text;
      }

      function stripCodeFence(text) {
        var raw = String(text || '').trim();
        var fence = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
        return fence ? String(fence[1] || '').trim() : raw;
      }

      function parseJsonPayload(text) {
        var raw = stripCodeFence(text || '');
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch (err) {}
        var start = raw.indexOf('{');
        var end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) {
          try {
            return JSON.parse(raw.slice(start, end + 1));
          } catch (err2) {}
        }
        var arrStart = raw.indexOf('[');
        var arrEnd = raw.lastIndexOf(']');
        if (arrStart >= 0 && arrEnd > arrStart) {
          try {
            return JSON.parse(raw.slice(arrStart, arrEnd + 1));
          } catch (err3) {}
        }
        return null;
      }

      function normalizePipelineCase(raw, fallbackModule) {
        if (!raw || typeof raw !== 'object') return null;
        var moduleName = normalizeFlatText(raw.module || raw.module_name || fallbackModule || '');
        var title = normalizeFlatText(raw.title || raw.case_title || '');
        var expected = normalizeText(raw.expected || raw.expect || raw.result || '');
        if (!moduleName || !title || !expected) return null;
        return {
          module: moduleName,
          title: title,
          priority: normalizePriority(raw.priority || raw.level || ''),
          precondition: normalizeText(raw.precondition || raw.preconditions || ''),
          preconditions: normalizeText(raw.preconditions || raw.precondition || ''),
          steps: normalizeText(raw.steps || raw.step || raw.actions || ''),
          expected: expected,
          remark: normalizeText(raw.remark || raw.remarks || ''),
        };
      }

      function normalizePipelineModulesFromContent(content) {
        var payload = parseJsonPayload(content);
        var modules = [];
        if (Array.isArray(payload)) {
          modules = payload;
        } else if (payload && typeof payload === 'object') {
          if (Array.isArray(payload.modules)) modules = payload.modules;
          else if (Array.isArray(payload.data)) modules = payload.data;
        }
        return (Array.isArray(modules) ? modules : []).map(function(item) {
          if (!item || typeof item !== 'object') return null;
          var moduleName = normalizeFlatText(item.module || item.module_name || item.title || item.name || '');
          if (!moduleName) return null;
          var rawCases = Array.isArray(item.cases) ? item.cases : [];
          return {
            module: moduleName,
            moduleKey: normalizeModuleKey(moduleName),
            key_scenarios: Array.isArray(item.key_scenarios) ? item.key_scenarios.slice() : [],
            test_points: Array.isArray(item.test_points) ? item.test_points.slice() : [],
            coupled_modules: Array.isArray(item.coupled_modules) ? item.coupled_modules.slice() : [],
            coverage: Number(item.coverage),
            missing: item.missing === true,
            cases: rawCases.map(function(caseItem) {
              return normalizePipelineCase(caseItem, moduleName);
            }).filter(Boolean),
          };
        }).filter(Boolean);
      }

      function isLegacyCasePageGenerationOutput(content) {
        var payload = parseJsonPayload(content);
        return Boolean(
          payload
          && typeof payload === 'object'
          && Array.isArray(payload.missing_modules)
          && Array.isArray(payload.existing_modules)
        );
      }

      function buildPipelinePrompt(pipeline, contract) {
        var promptBase = pipeline && pipeline.promptBase ? String(pipeline.promptBase || '').trim() : '';
        var parts = [];
        if (promptBase) parts.push(promptBase);
        parts.push('operation_contract(JSON)：' + JSON.stringify(contract || {}));
        return parts.filter(Boolean).join('\n\n');
      }

      function buildPipelineStagePayload(pipeline, contract, stage, moduleEntry, discoveryModules) {
        var payload = cloneJson(pipeline && pipeline.basePayload, {});
        payload.operation_contract = cloneJson(contract || {}, {});
        payload.current_visible_modules = cloneJson(pipeline && pipeline.visibleModules, []);
        payload.current_ai_generation_layer = cloneJson(discoveryModules || [], []);
        payload.xmind_external_pipeline = {
          enabled: true,
          version: 1,
          stage: stage || 'module',
          pipeline: pipeline && pipeline.mode ? String(pipeline.mode || '') : 'append_all_modules_cases',
          root_mode: 'append_all_modules_cases',
          module_mode: contract && contract.mode ? String(contract.mode || '') : '',
          output_contract: 'xmind_modules',
          final_output_scope: 'new_cases_only',
          model_assignment_policy: 'use_case_library_generation_model',
          protect_original_cases: true,
        };
        if (moduleEntry) {
          payload.current_operation_module = cloneJson(moduleEntry, {});
        }
        return payload;
      }

      function buildPipelineContract(mode, moduleName) {
        if (mode === 'module_append_cases') {
          return {
            scope: 'module',
            mode: 'module_append_cases',
            targetModule: normalizeFlatText(moduleName || ''),
            allowNewModules: false,
            generateCasesForNewModules: false,
            generateCasesForExistingModules: true,
            dedupeAgainstVisibleModules: false,
            dedupeAgainstVisibleCases: true,
          };
        }
        return {
          scope: 'module',
          mode: 'module_full_cases',
          targetModule: normalizeFlatText(moduleName || ''),
          allowNewModules: false,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: true,
          dedupeAgainstVisibleModules: false,
          dedupeAgainstVisibleCases: false,
        };
      }

      function findPipelineModuleByKey(modules, key) {
        var targetKey = String(key || '');
        var list = Array.isArray(modules) ? modules : [];
        for (var i = 0; i < list.length; i += 1) {
          if (normalizeModuleKey(list[i] && list[i].module) === targetKey) return list[i];
        }
        return null;
      }

      function buildPipelineDescriptors(pipeline, discoveryModules) {
        var visible = Array.isArray(pipeline && pipeline.visibleModules) ? pipeline.visibleModules : [];
        var visibleMap = {};
        var descriptors = [];
        visible.forEach(function(entry) {
          if (!entry || !entry.module) return;
          var key = normalizeModuleKey(entry.module);
          if (!key || visibleMap[key]) return;
          visibleMap[key] = true;
          descriptors.push({
            missing: false,
            module: entry.module,
            moduleKey: key,
            visibleCases: Array.isArray(entry.cases) ? entry.cases.slice() : [],
            action: entry.cases && entry.cases.length ? 'module_append_cases' : 'module_full_cases',
            discoveryModule: findPipelineModuleByKey(discoveryModules, key),
          });
        });
        (Array.isArray(discoveryModules) ? discoveryModules : []).forEach(function(item) {
          if (!item || !item.module) return;
          var key = normalizeModuleKey(item.module);
          if (!key || visibleMap[key]) return;
          visibleMap[key] = true;
          descriptors.push({
            missing: true,
            module: item.module,
            moduleKey: key,
            visibleCases: [],
            action: 'module_full_cases',
            discoveryModule: item,
          });
        });
        return descriptors;
      }

      function runPipelineQueue(items, limit, worker) {
        var list = Array.isArray(items) ? items : [];
        var max = Math.max(1, Math.min(Number(limit) || 1, list.length || 1));
        var index = 0;
        var results = new Array(list.length);
        function next() {
          if (index >= list.length) return Promise.resolve();
          var currentIndex = index;
          index += 1;
          return Promise.resolve(worker(list[currentIndex], currentIndex))
            .then(function(result) {
              results[currentIndex] = result;
            })
            .catch(function(err) {
              results[currentIndex] = {
                error: err && err.message ? String(err.message) : '模块生成失败',
              };
            })
            .then(next);
        }
        var workers = [];
        for (var i = 0; i < max; i += 1) workers.push(next());
        return Promise.all(workers).then(function() { return results; });
      }

      function updatePipelineStage(scene, taskId, patch, action) {
        var current = readTask(scene);
        if (!current || current.id !== taskId || current.status !== 'running') return null;
        var next = Object.assign({}, current, patch || {});
        return writeTask(scene, next, action || 'pipeline');
      }

      function buildFinalPipelineOutput(moduleResults) {
        var missing = [];
        var existing = [];
        (Array.isArray(moduleResults) ? moduleResults : []).forEach(function(result) {
          if (!result || result.error || !result.module) return;
          var cases = Array.isArray(result.cases) ? result.cases : [];
          if (!cases.length) return;
          var target = result.missing === true ? missing : existing;
          target.push({
            module: result.module,
            coverage: Number.isFinite(Number(result.coverage)) ? Number(result.coverage) : 0,
            cases: cases,
          });
        });
        return JSON.stringify({
          missing_modules: missing,
          existing_modules: existing,
          xmind_external_pipeline: {
            enabled: true,
            mode: 'append_all_modules_cases',
            missing_module_count: missing.length,
            existing_module_count: existing.length,
          },
        });
      }

      function runXmindExternalPipeline(scene, task, model) {
        var pipeline = task && task.xmindPipeline && task.xmindPipeline.enabled === true
          ? task.xmindPipeline
          : null;
        if (!pipeline || !pipeline.root || !pipeline.root.userText) {
          return Promise.resolve(callModel(model, resolveUserText(task), task.prompt || '', task.reasoning || '', task.temperature));
        }
        updatePipelineStage(scene, task.id, {
          pipelineStage: 'discovery',
          pipelineStatusText: '正在按 XMind pipeline 发现模块',
        }, 'pipeline-discovery');
        return callModel(
          model,
          String(pipeline.root.userText || ''),
          String(pipeline.root.prompt || task.prompt || ''),
          task.reasoning || '',
          task.temperature
        ).then(function(rootContent) {
          if (isLegacyCasePageGenerationOutput(rootContent)) return rootContent;
          var discoveryModules = normalizePipelineModulesFromContent(rootContent);
          var descriptors = buildPipelineDescriptors(pipeline, discoveryModules);
          if (!descriptors.length) {
            return buildFinalPipelineOutput(discoveryModules.map(function(item) {
              return {
                missing: item && item.missing === true,
                module: item && item.module ? item.module : '',
                coverage: item && Number.isFinite(Number(item.coverage)) ? Number(item.coverage) : 0,
                cases: item && Array.isArray(item.cases) ? item.cases : [],
              };
            }));
          }
          updatePipelineStage(scene, task.id, {
            pipelineStage: 'modules',
            pipelineStatusText: '正在按模块补强用例',
            pipelineModuleTotal: descriptors.length,
            pipelineModuleDone: 0,
          }, 'pipeline-modules');
          return runPipelineQueue(descriptors, pipeline.moduleConcurrency || 4, function(descriptor) {
            var contract = buildPipelineContract(descriptor.action, descriptor.module);
            var moduleEntry = {
              module: descriptor.module,
              moduleKey: descriptor.moduleKey,
              visible_cases: descriptor.visibleCases || [],
              discovery_module: descriptor.discoveryModule || null,
            };
            var userPayload = buildPipelineStagePayload(pipeline, contract, 'module', moduleEntry, discoveryModules);
            return callModel(
              model,
              JSON.stringify(userPayload, null, 2),
              buildPipelinePrompt(pipeline, contract),
              task.reasoning || '',
              task.temperature
            ).then(function(moduleContent) {
              var modules = normalizePipelineModulesFromContent(moduleContent);
              var target = findPipelineModuleByKey(modules, descriptor.moduleKey);
              if (!target && modules.length === 1) target = modules[0];
              var fallbackCases = descriptor.discoveryModule && Array.isArray(descriptor.discoveryModule.cases)
                ? descriptor.discoveryModule.cases
                : [];
              var cases = target && Array.isArray(target.cases) && target.cases.length
                ? target.cases
                : fallbackCases;
              var latest = readTask(scene);
              if (latest && latest.id === task.id && latest.status === 'running') {
                latest.pipelineModuleDone = Number(latest.pipelineModuleDone || 0) + 1;
                latest.updatedAt = Date.now();
                writeTask(scene, latest, 'pipeline-module-done');
              }
              return {
                missing: descriptor.missing === true,
                module: descriptor.module,
                coverage: target && Number.isFinite(Number(target.coverage)) ? Number(target.coverage) : 0,
                cases: cases,
              };
            });
          }).then(function(moduleResults) {
            return buildFinalPipelineOutput(moduleResults);
          });
        });
      }

      function isTransientFetchError(err) {
        if (!err) return false;
        var msg = err && err.message ? String(err.message) : String(err || '');
        if (!msg) return false;
        if (msg.indexOf('Failed to fetch') !== -1) return true;
        if (msg.indexOf('NetworkError') !== -1) return true;
        return false;
      }

      function isModelTimeoutError(err) {
        if (!err) return false;
        var msg = err && err.message ? String(err.message) : String(err || '');
        if (!msg) return false;
        return msg.indexOf('模型调用超时') !== -1;
      }

      function shouldSuspendForNavigation(err) {
        if (pageUnloading) return true;
        if (!err) return false;
        if (err.name === 'AbortError') return true;
        var msg = err && err.message ? String(err.message) : String(err || '');
        if (msg.indexOf('AbortError') !== -1) return true;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          if (isTransientFetchError(err)) return true;
          if (isModelTimeoutError(err)) return true;
          return false;
        }
        return false;
      }

      function isTaskStale(task) {
        if (!task) return true;
        var heartbeat = Number(task.heartbeatAt || 0);
        if (!heartbeat) return true;
        return Date.now() - heartbeat > staleMs;
      }

      function shouldTakeover(task) {
        if (!task || task.status !== 'running') return false;
        if (!task.runnerId || task.runnerId === runnerId) return true;
        return isTaskStale(task);
      }

      function startHeartbeat(scene, task) {
        if (!scene || !task) return function() {};
        var timer = setInterval(function() {
          var current = readTask(scene);
          if (!current || current.id !== task.id || current.status !== 'running') {
            clearInterval(timer);
            return;
          }
          if (current.runnerId && current.runnerId !== runnerId) {
            clearInterval(timer);
            return;
          }
          current.runnerId = runnerId;
          current.heartbeatAt = Date.now();
          current.updatedAt = current.heartbeatAt;
          writeTask(scene, current, 'heartbeat');
        }, heartbeatIntervalMs);
        return function stopHeartbeat() {
          clearInterval(timer);
        };
      }

      function runTask(scene, task) {
        if (!scene || !task) return Promise.resolve(null);
        if (runningMap[scene] && runningMap[scene].taskId === task.id) {
          return runningMap[scene].promise;
        }
        var stopHeartbeat = startHeartbeat(scene, task);
        var promise = Promise.resolve()
          .then(function() {
            var current = readTask(scene);
            if (!current || current.id !== task.id) return null;
            var model = current.model;
            if (!model || !model.baseUrl || !model.model) {
              throw new Error('未找到易漏用例推荐模型');
            }
            var userText = resolveUserText(current);
            if (!userText) {
              throw new Error('推荐上下文缺失');
            }
            return callModel(model, userText, current.prompt || '', current.reasoning || '', current.temperature);
          })
          .then(function(content) {
            var current = readTask(scene);
            if (!current || current.id !== task.id) return null;
            if (current.runnerId && current.runnerId !== runnerId) return null;
            var ids = parseTaskIds(content);
            current.status = 'done';
            current.resultIds = ids;
            current.error = '';
            current.updatedAt = Date.now();
            current.endedAt = current.updatedAt;
            current.heartbeatAt = 0;
            writeTask(scene, current, 'done');
            return current;
          })
          .catch(function(err) {
            var current = readTask(scene);
            if (!current || current.id !== task.id) return null;
            if (current.runnerId && current.runnerId !== runnerId) return null;
            var msg = err && err.message ? err.message : String(err || '');
            if (shouldSuspendForNavigation(err)) {
              current.status = 'running';
              current.error = '';
              current.runnerId = '';
              current.heartbeatAt = 0;
              current.updatedAt = Date.now();
              writeTask(scene, current, 'suspend');
              return current;
            }
            if (isTransientFetchError(err)) {
              current.retryCount = Number(current.retryCount || 0) + 1;
              if (current.retryCount <= 2) {
                current.status = 'running';
                current.error = '';
                current.runnerId = '';
                current.heartbeatAt = 0;
                current.updatedAt = Date.now();
                writeTask(scene, current, 'retry');
                return current;
              }
            }
            current.status = 'error';
            current.error = msg ? ('AI 推荐失败：' + msg) : 'AI 推荐失败';
            current.updatedAt = Date.now();
            current.endedAt = current.updatedAt;
            current.heartbeatAt = 0;
            writeTask(scene, current, 'error');
            return current;
          })
          .finally(function() {
            stopHeartbeat();
            if (runningMap[scene] && runningMap[scene].taskId === task.id) {
              delete runningMap[scene];
            }
          });
        runningMap[scene] = { taskId: task.id, promise: promise };
        return promise;
      }

      function startTask(scene, task, options) {
        if (!scene) return Promise.resolve(null);
        var active = task ? createTask(scene, task) : readTask(scene);
        if (!active) return Promise.resolve(null);
        if (active.status !== 'running') return Promise.resolve(active);
        if (!options || options.force !== true) {
          if (!shouldTakeover(active)) {
            if (!takeoverTimers[scene]) {
              takeoverTimers[scene] = setTimeout(function() {
                takeoverTimers[scene] = null;
                var latest = readTask(scene);
                if (latest && latest.status === 'running') {
                  startTask(scene, latest);
                }
              }, staleMs);
            }
            return Promise.resolve(active);
          }
        }
        active.runnerId = runnerId;
        active.heartbeatAt = Date.now();
        writeTask(scene, active, 'start');
        return runTask(scene, active);
      }

      function resumeTasks(options) {
        ['case-library', 'temp-exec'].forEach(function(scene) {
          var task = readTask(scene);
          if (task && task.status === 'running') {
            startTask(scene, task, options);
          }
        });
      }

      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('storage', function(e) {
          var key = e && e.key ? String(e.key) : '';
          if (!key || key.indexOf(storagePrefix) !== 0) return;
          var scene = key.slice(storagePrefix.length);
          emitTaskUpdate(scene, readTask(scene), 'storage');
        });
      }

      return {
        createTask: createTask,
        startTask: startTask,
        getTask: readTask,
        updateTask: updateTask,
        clearTask: clearTask,
        resumeTasks: resumeTasks,
        buildTaskId: buildTaskId,
        normalizeModelSnapshot: normalizeModelSnapshot,
      };
    }

    function initCaseLibraryAiGenManager(options) {
      const utils = options && options.utils ? options.utils : {};
      const callModel = options && typeof options.callModelWithConfig === 'function'
        ? options.callModelWithConfig
        : async function missingCall() {
          throw new Error('模型客户端不可用，请刷新页面后重试');
        };
      const storagePrefix = 'tap-case-library-ai-gen-task:';
      const runnerId = 'case-library-ai-gen-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      const runningMap = {};
      const heartbeatIntervalMs = 2000;
      const staleMs = 6000;
      const takeoverTimers = {};
      var pageUnloading = false;

      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('pagehide', function() { pageUnloading = true; });
        window.addEventListener('beforeunload', function() { pageUnloading = true; });
      }

      function buildKey(scene) {
        return storagePrefix + scene;
      }

      function safeJsonParse(raw) {
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch (err) {
          return null;
        }
      }

      function readTask(scene) {
        if (!scene || typeof localStorage === 'undefined') return null;
        try {
          return safeJsonParse(localStorage.getItem(buildKey(scene)));
        } catch (err) {
          return null;
        }
      }

      function emitTaskUpdate(scene, task, action) {
        if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
        try {
          if (typeof CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent('case-library-ai-gen-task', { detail: { scene: scene, task: task, action: action || '' } }));
          } else if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
            var evt = document.createEvent('CustomEvent');
            evt.initCustomEvent('case-library-ai-gen-task', false, false, { scene: scene, task: task, action: action || '' });
            window.dispatchEvent(evt);
          }
        } catch (err) {
          // ignore
        }
      }

      function writeTask(scene, task, action) {
        if (!scene || typeof localStorage === 'undefined') return task || null;
        if (!task) {
          try {
            localStorage.removeItem(buildKey(scene));
          } catch (err) {
            // ignore
          }
          emitTaskUpdate(scene, null, action || 'clear');
          return null;
        }
        var next = task;
        next.updatedAt = Date.now();
        try {
          localStorage.setItem(buildKey(scene), JSON.stringify(next));
        } catch (err) {
          // ignore
        }
        emitTaskUpdate(scene, next, action || 'update');
        return next;
      }

      function clearTask(scene) {
        writeTask(scene, null, 'clear');
      }

      function updateTask(scene, patch, action) {
        if (!scene) return null;
        var current = readTask(scene);
        if (!current) return null;
        var next = patch && typeof patch === 'object' ? Object.assign({}, current, patch) : current;
        return writeTask(scene, next, action || 'update');
      }

      function buildTaskId() {
        return 'case-library-ai-gen-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      }

      function normalizeModelSnapshot(model) {
        if (!model || typeof model !== 'object') return null;
        return {
          id: model.id || '',
          name: model.name || '',
          provider: model.provider || '',
          baseUrl: model.baseUrl || '',
          apiKey: model.apiKey || '',
          model: model.model || '',
          maxTokens: model.maxTokens,
          stream: model.stream,
          streamMode: model.streamMode,
        };
      }

      function createTask(scene, payload) {
        var base = payload && typeof payload === 'object' ? Object.assign({}, payload) : {};
        base.id = base.id || buildTaskId();
        base.scene = scene || base.scene || '';
        base.status = 'running';
        base.createdAt = base.createdAt || Date.now();
        base.updatedAt = base.updatedAt || base.createdAt;
        base.retryCount = Number(base.retryCount || 0);
        if (base.model) base.model = normalizeModelSnapshot(base.model);
        return base;
      }

      function resolveUserText(task) {
        if (!task) return '';
        if (typeof task.userText === 'string' && task.userText.trim()) return task.userText;
        if (task.userPayload && typeof task.userPayload === 'object') {
          try {
            return JSON.stringify(task.userPayload, null, 2);
          } catch (err) {
            return '';
          }
        }
        return '';
      }

      function cloneJson(value, fallback) {
        if (value === undefined || value === null) return fallback;
        try {
          return JSON.parse(JSON.stringify(value));
        } catch (err) {
          return fallback;
        }
      }

      function normalizePipelineText(value) {
        if (value === null || value === undefined) return '';
        if (Array.isArray(value)) {
          return value.map(function(item) { return normalizePipelineText(item); }).filter(Boolean).join('\n');
        }
        return String(value).replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, '').replace(/\r/g, '\n').trim();
      }

      function normalizePipelineFlatText(value) {
        return normalizePipelineText(value).replace(/\s+/g, ' ').trim();
      }

      function normalizePipelineModuleKey(value) {
        return normalizePipelineFlatText(value).toLowerCase();
      }

      function normalizePipelinePriority(value) {
        var text = normalizePipelineFlatText(value);
        if (!text) return 'P1';
        var head = text.charAt(0);
        if (head === 'p' || head === 'P') return 'P' + text.slice(1);
        return text;
      }

      function stripPipelineCodeFence(text) {
        var raw = String(text || '').trim();
        var fence = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
        return fence ? String(fence[1] || '').trim() : raw;
      }

      function parsePipelineJsonPayload(text) {
        var raw = stripPipelineCodeFence(text || '');
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch (err) {}
        var start = raw.indexOf('{');
        var end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) {
          try {
            return JSON.parse(raw.slice(start, end + 1));
          } catch (err2) {}
        }
        var arrStart = raw.indexOf('[');
        var arrEnd = raw.lastIndexOf(']');
        if (arrStart >= 0 && arrEnd > arrStart) {
          try {
            return JSON.parse(raw.slice(arrStart, arrEnd + 1));
          } catch (err3) {}
        }
        return null;
      }

      function normalizePipelineCase(raw, fallbackModule) {
        if (!raw || typeof raw !== 'object') return null;
        var moduleName = normalizePipelineFlatText(raw.module || raw.module_name || fallbackModule || '');
        var title = normalizePipelineFlatText(raw.title || raw.case_title || '');
        var expected = normalizePipelineText(raw.expected || raw.expect || raw.result || '');
        if (!moduleName || !title || !expected) return null;
        return {
          module: moduleName,
          title: title,
          priority: normalizePipelinePriority(raw.priority || raw.level || ''),
          precondition: normalizePipelineText(raw.precondition || raw.preconditions || ''),
          preconditions: normalizePipelineText(raw.preconditions || raw.precondition || ''),
          steps: normalizePipelineText(raw.steps || raw.step || raw.actions || ''),
          expected: expected,
          remark: normalizePipelineText(raw.remark || raw.remarks || ''),
        };
      }

      function normalizePipelineModulesFromContent(content) {
        var payload = parsePipelineJsonPayload(content);
        var modules = [];
        if (Array.isArray(payload)) {
          modules = payload;
        } else if (payload && typeof payload === 'object') {
          if (Array.isArray(payload.modules)) modules = payload.modules;
          else if (Array.isArray(payload.data)) modules = payload.data;
        }
        return (Array.isArray(modules) ? modules : []).map(function(item) {
          if (!item || typeof item !== 'object') return null;
          var moduleName = normalizePipelineFlatText(item.module || item.module_name || item.title || item.name || '');
          if (!moduleName) return null;
          var rawCases = Array.isArray(item.cases) ? item.cases : [];
          return {
            module: moduleName,
            moduleKey: normalizePipelineModuleKey(moduleName),
            key_scenarios: Array.isArray(item.key_scenarios) ? item.key_scenarios.slice() : [],
            test_points: Array.isArray(item.test_points) ? item.test_points.slice() : [],
            coupled_modules: Array.isArray(item.coupled_modules) ? item.coupled_modules.slice() : [],
            coverage: Number(item.coverage),
            missing: item.missing === true,
            cases: rawCases.map(function(caseItem) {
              return normalizePipelineCase(caseItem, moduleName);
            }).filter(Boolean),
          };
        }).filter(Boolean);
      }

      function isLegacyCasePageGenerationOutput(content) {
        var payload = parsePipelineJsonPayload(content);
        return Boolean(
          payload
          && typeof payload === 'object'
          && Array.isArray(payload.missing_modules)
          && Array.isArray(payload.existing_modules)
        );
      }

      function buildPipelinePrompt(pipeline, contract) {
        var promptBase = pipeline && pipeline.promptBase ? String(pipeline.promptBase || '').trim() : '';
        var parts = [];
        if (promptBase) parts.push(promptBase);
        parts.push('operation_contract(JSON)：' + JSON.stringify(contract || {}));
        return parts.filter(Boolean).join('\n\n');
      }

      function buildPipelineStagePayload(pipeline, contract, stage, moduleEntry, discoveryModules) {
        var payload = cloneJson(pipeline && pipeline.basePayload, {});
        payload.operation_contract = cloneJson(contract || {}, {});
        payload.current_visible_modules = cloneJson(pipeline && pipeline.visibleModules, []);
        payload.current_ai_generation_layer = cloneJson(discoveryModules || [], []);
        payload.xmind_external_pipeline = {
          enabled: true,
          version: 1,
          stage: stage || 'module',
          pipeline: pipeline && pipeline.mode ? String(pipeline.mode || '') : 'append_all_modules_cases',
          root_mode: 'append_all_modules_cases',
          module_mode: contract && contract.mode ? String(contract.mode || '') : '',
          output_contract: 'xmind_modules',
          final_output_scope: 'new_cases_only',
          model_assignment_policy: 'use_case_library_generation_model',
          protect_original_cases: true,
        };
        if (moduleEntry) payload.current_operation_module = cloneJson(moduleEntry, {});
        return payload;
      }

      function buildPipelineContract(mode, moduleName) {
        if (mode === 'module_append_cases') {
          return {
            scope: 'module',
            mode: 'module_append_cases',
            targetModule: normalizePipelineFlatText(moduleName || ''),
            allowNewModules: false,
            generateCasesForNewModules: false,
            generateCasesForExistingModules: true,
            dedupeAgainstVisibleModules: false,
            dedupeAgainstVisibleCases: true,
          };
        }
        return {
          scope: 'module',
          mode: 'module_full_cases',
          targetModule: normalizePipelineFlatText(moduleName || ''),
          allowNewModules: false,
          generateCasesForNewModules: false,
          generateCasesForExistingModules: true,
          dedupeAgainstVisibleModules: false,
          dedupeAgainstVisibleCases: false,
        };
      }

      function findPipelineModuleByKey(modules, key) {
        var targetKey = String(key || '');
        var list = Array.isArray(modules) ? modules : [];
        for (var i = 0; i < list.length; i += 1) {
          if (normalizePipelineModuleKey(list[i] && list[i].module) === targetKey) return list[i];
        }
        return null;
      }

      function buildPipelineDescriptors(pipeline, discoveryModules) {
        var visible = Array.isArray(pipeline && pipeline.visibleModules) ? pipeline.visibleModules : [];
        var visibleMap = {};
        var descriptors = [];
        visible.forEach(function(entry) {
          if (!entry || !entry.module) return;
          var key = normalizePipelineModuleKey(entry.module);
          if (!key || visibleMap[key]) return;
          visibleMap[key] = true;
          descriptors.push({
            missing: false,
            module: entry.module,
            moduleKey: key,
            visibleCases: Array.isArray(entry.cases) ? entry.cases.slice() : [],
            action: entry.cases && entry.cases.length ? 'module_append_cases' : 'module_full_cases',
            discoveryModule: findPipelineModuleByKey(discoveryModules, key),
          });
        });
        (Array.isArray(discoveryModules) ? discoveryModules : []).forEach(function(item) {
          if (!item || !item.module) return;
          var key = normalizePipelineModuleKey(item.module);
          if (!key || visibleMap[key]) return;
          visibleMap[key] = true;
          descriptors.push({
            missing: true,
            module: item.module,
            moduleKey: key,
            visibleCases: [],
            action: 'module_full_cases',
            discoveryModule: item,
          });
        });
        return descriptors;
      }

      function runPipelineQueue(items, limit, worker) {
        var list = Array.isArray(items) ? items : [];
        var max = Math.max(1, Math.min(Number(limit) || 1, list.length || 1));
        var index = 0;
        var results = new Array(list.length);
        function next() {
          if (index >= list.length) return Promise.resolve();
          var currentIndex = index;
          index += 1;
          return Promise.resolve(worker(list[currentIndex], currentIndex))
            .then(function(result) {
              results[currentIndex] = result;
            })
            .catch(function(err) {
              results[currentIndex] = {
                error: err && err.message ? String(err.message) : '模块生成失败',
              };
            })
            .then(next);
        }
        var workers = [];
        for (var i = 0; i < max; i += 1) workers.push(next());
        return Promise.all(workers).then(function() { return results; });
      }

      function updatePipelineStage(scene, taskId, patch, action) {
        var current = readTask(scene);
        if (!current || current.id !== taskId || current.status !== 'running') return null;
        var next = Object.assign({}, current, patch || {});
        return writeTask(scene, next, action || 'pipeline');
      }

      function buildFinalPipelineOutput(moduleResults) {
        var missing = [];
        var existing = [];
        (Array.isArray(moduleResults) ? moduleResults : []).forEach(function(result) {
          if (!result || result.error || !result.module) return;
          var cases = Array.isArray(result.cases) ? result.cases : [];
          if (!cases.length) return;
          var target = result.missing === true ? missing : existing;
          target.push({
            module: result.module,
            coverage: Number.isFinite(Number(result.coverage)) ? Number(result.coverage) : 0,
            cases: cases,
          });
        });
        return JSON.stringify({
          missing_modules: missing,
          existing_modules: existing,
          xmind_external_pipeline: {
            enabled: true,
            mode: 'append_all_modules_cases',
            missing_module_count: missing.length,
            existing_module_count: existing.length,
          },
        });
      }

      function runXmindExternalPipeline(scene, task, model) {
        var pipeline = task && task.xmindPipeline && task.xmindPipeline.enabled === true
          ? task.xmindPipeline
          : null;
        if (!pipeline || !pipeline.root || !pipeline.root.userText) {
          return Promise.resolve(callModel(model, resolveUserText(task), task.prompt || '', task.reasoning || '', task.temperature));
        }
        updatePipelineStage(scene, task.id, {
          pipelineStage: 'discovery',
          pipelineStatusText: '正在按 XMind pipeline 发现模块',
        }, 'pipeline-discovery');
        return callModel(
          model,
          String(pipeline.root.userText || ''),
          String(pipeline.root.prompt || task.prompt || ''),
          task.reasoning || '',
          task.temperature
        ).then(function(rootContent) {
          if (isLegacyCasePageGenerationOutput(rootContent)) return rootContent;
          var discoveryModules = normalizePipelineModulesFromContent(rootContent);
          var descriptors = buildPipelineDescriptors(pipeline, discoveryModules);
          if (!descriptors.length) {
            return buildFinalPipelineOutput(discoveryModules.map(function(item) {
              return {
                missing: item && item.missing === true,
                module: item && item.module ? item.module : '',
                coverage: item && Number.isFinite(Number(item.coverage)) ? Number(item.coverage) : 0,
                cases: item && Array.isArray(item.cases) ? item.cases : [],
              };
            }));
          }
          updatePipelineStage(scene, task.id, {
            pipelineStage: 'modules',
            pipelineStatusText: '正在按模块补强用例',
            pipelineModuleTotal: descriptors.length,
            pipelineModuleDone: 0,
          }, 'pipeline-modules');
          return runPipelineQueue(descriptors, pipeline.moduleConcurrency || 4, function(descriptor) {
            var contract = buildPipelineContract(descriptor.action, descriptor.module);
            var moduleEntry = {
              module: descriptor.module,
              moduleKey: descriptor.moduleKey,
              visible_cases: descriptor.visibleCases || [],
              discovery_module: descriptor.discoveryModule || null,
            };
            var userPayload = buildPipelineStagePayload(pipeline, contract, 'module', moduleEntry, discoveryModules);
            return callModel(
              model,
              JSON.stringify(userPayload, null, 2),
              buildPipelinePrompt(pipeline, contract),
              task.reasoning || '',
              task.temperature
            ).then(function(moduleContent) {
              var modules = normalizePipelineModulesFromContent(moduleContent);
              var target = findPipelineModuleByKey(modules, descriptor.moduleKey);
              if (!target && modules.length === 1) target = modules[0];
              var fallbackCases = descriptor.discoveryModule && Array.isArray(descriptor.discoveryModule.cases)
                ? descriptor.discoveryModule.cases
                : [];
              var cases = target && Array.isArray(target.cases) && target.cases.length
                ? target.cases
                : fallbackCases;
              var latest = readTask(scene);
              if (latest && latest.id === task.id && latest.status === 'running') {
                latest.pipelineModuleDone = Number(latest.pipelineModuleDone || 0) + 1;
                latest.updatedAt = Date.now();
                writeTask(scene, latest, 'pipeline-module-done');
              }
              return {
                missing: descriptor.missing === true,
                module: descriptor.module,
                coverage: target && Number.isFinite(Number(target.coverage)) ? Number(target.coverage) : 0,
                cases: cases,
              };
            });
          }).then(function(moduleResults) {
            return buildFinalPipelineOutput(moduleResults);
          });
        });
      }

      function isTransientFetchError(err) {
        if (!err) return false;
        var msg = err && err.message ? String(err.message) : String(err || '');
        if (!msg) return false;
        if (msg.indexOf('Failed to fetch') !== -1) return true;
        if (msg.indexOf('NetworkError') !== -1) return true;
        return false;
      }

      function isModelTimeoutError(err) {
        if (!err) return false;
        var msg = err && err.message ? String(err.message) : String(err || '');
        if (!msg) return false;
        return msg.indexOf('模型调用超时') !== -1;
      }

      function shouldSuspendForNavigation(err) {
        if (pageUnloading) return true;
        if (!err) return false;
        if (err.name === 'AbortError') return true;
        var msg = err && err.message ? String(err.message) : String(err || '');
        if (msg.indexOf('AbortError') !== -1) return true;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          if (isTransientFetchError(err)) return true;
          if (isModelTimeoutError(err)) return true;
          return false;
        }
        return false;
      }

      function isTaskStale(task) {
        if (!task) return true;
        var heartbeat = Number(task.heartbeatAt || 0);
        if (!heartbeat) return true;
        return Date.now() - heartbeat > staleMs;
      }

      function shouldTakeover(task) {
        if (!task || task.status !== 'running') return false;
        if (!task.runnerId || task.runnerId === runnerId) return true;
        return isTaskStale(task);
      }

      function startHeartbeat(scene, task) {
        if (!scene || !task) return function() {};
        var timer = setInterval(function() {
          var current = readTask(scene);
          if (!current || current.id !== task.id || current.status !== 'running') {
            clearInterval(timer);
            return;
          }
          if (current.runnerId && current.runnerId !== runnerId) {
            clearInterval(timer);
            return;
          }
          current.runnerId = runnerId;
          current.heartbeatAt = Date.now();
          current.updatedAt = current.heartbeatAt;
          writeTask(scene, current, 'heartbeat');
        }, heartbeatIntervalMs);
        return function stopHeartbeat() {
          clearInterval(timer);
        };
      }

      function runTask(scene, task) {
        if (!scene || !task) return Promise.resolve(null);
        if (runningMap[scene] && runningMap[scene].taskId === task.id) {
          return runningMap[scene].promise;
        }
        var stopHeartbeat = startHeartbeat(scene, task);
        var promise = Promise.resolve()
          .then(function() {
            var current = readTask(scene);
            if (!current || current.id !== task.id) return null;
            var model = current.model;
            if (!model || !model.baseUrl || !model.model) {
              throw new Error('未找到用例库生成模型');
            }
            var userText = resolveUserText(current);
            if (!userText) {
              throw new Error('生成上下文缺失');
            }
            if (current.xmindPipeline && current.xmindPipeline.enabled === true) {
              return runXmindExternalPipeline(scene, current, model);
            }
            return callModel(model, userText, current.prompt || '', current.reasoning || '', current.temperature);
          })
          .then(function(content) {
            var current = readTask(scene);
            if (!current || current.id !== task.id) return null;
            if (current.runnerId && current.runnerId !== runnerId) return null;
            current.status = 'done';
            current.resultRaw = content;
            current.error = '';
            current.updatedAt = Date.now();
            current.endedAt = current.updatedAt;
            current.heartbeatAt = 0;
            writeTask(scene, current, 'done');
            return current;
          })
          .catch(function(err) {
            var current = readTask(scene);
            if (!current || current.id !== task.id) return null;
            if (current.runnerId && current.runnerId !== runnerId) return null;
            var msg = err && err.message ? err.message : String(err || '');
            if (shouldSuspendForNavigation(err)) {
              current.status = 'running';
              current.error = '';
              current.runnerId = '';
              current.heartbeatAt = 0;
              current.updatedAt = Date.now();
              writeTask(scene, current, 'suspend');
              return current;
            }
            if (isTransientFetchError(err)) {
              current.retryCount = Number(current.retryCount || 0) + 1;
              if (current.retryCount <= 2) {
                current.status = 'running';
                current.error = '';
                current.runnerId = '';
                current.heartbeatAt = 0;
                current.updatedAt = Date.now();
                writeTask(scene, current, 'retry');
                return current;
              }
            }
            current.status = 'error';
            current.error = msg ? ('AI 用例生成失败：' + msg) : 'AI 用例生成失败';
            current.updatedAt = Date.now();
            current.endedAt = current.updatedAt;
            current.heartbeatAt = 0;
            writeTask(scene, current, 'error');
            return current;
          })
          .finally(function() {
            stopHeartbeat();
            if (runningMap[scene] && runningMap[scene].taskId === task.id) {
              delete runningMap[scene];
            }
          });
        runningMap[scene] = { taskId: task.id, promise: promise };
        return promise;
      }

      function startTask(scene, task, options) {
        if (!scene) return Promise.resolve(null);
        var active = task ? createTask(scene, task) : readTask(scene);
        if (!active) return Promise.resolve(null);
        if (active.status !== 'running') return Promise.resolve(active);
        if (!options || options.force !== true) {
          if (!shouldTakeover(active)) {
            if (!takeoverTimers[scene]) {
              takeoverTimers[scene] = setTimeout(function() {
                takeoverTimers[scene] = null;
                var latest = readTask(scene);
                if (latest && latest.status === 'running') {
                  startTask(scene, latest);
                }
              }, staleMs);
            }
            return Promise.resolve(active);
          }
        }
        active.runnerId = runnerId;
        active.heartbeatAt = Date.now();
        writeTask(scene, active, 'start');
        return runTask(scene, active);
      }

      function resumeTasks(options) {
        ['case-library', 'temp-exec'].forEach(function(scene) {
          var task = readTask(scene);
          if (task && task.status === 'running') {
            startTask(scene, task, options);
          }
        });
      }

      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('storage', function(e) {
          var key = e && e.key ? String(e.key) : '';
          if (!key || key.indexOf(storagePrefix) !== 0) return;
          var scene = key.slice(storagePrefix.length);
          emitTaskUpdate(scene, readTask(scene), 'storage');
        });
      }

      return {
        createTask: createTask,
        startTask: startTask,
        getTask: readTask,
        updateTask: updateTask,
        clearTask: clearTask,
        resumeTasks: resumeTasks,
        buildTaskId: buildTaskId,
        normalizeModelSnapshot: normalizeModelSnapshot,
      };
    }

    function initXmindCaseGenTaskManager(options) {
      const callModel = options && typeof options.callModelWithConfig === 'function'
        ? options.callModelWithConfig
        : async function missingTextModel() {
          throw new Error('模型客户端不可用，请刷新页面后重试');
        };
      const callModelWithContent = options && typeof options.callModelWithContent === 'function'
        ? options.callModelWithContent
        : async function missingContentModel() {
          throw new Error('多模态模型客户端不可用，请刷新页面后重试');
        };
      const abortByOwner = options && typeof options.abortRequestsByOwner === 'function'
        ? options.abortRequestsByOwner
        : function noopAbortByOwner() { return 0; };
      const getTimeoutSec = options && typeof options.getTimeoutSec === 'function'
        ? options.getTimeoutSec
        : function getDefaultTimeoutSec() { return 300; };
      const requestSchedulerCore = options && options.requestSchedulerCore
        ? options.requestSchedulerCore
        : (window.app && window.app.xmindRequestSchedulerCore ? window.app.xmindRequestSchedulerCore : null);
      const requestScheduler = requestSchedulerCore && typeof requestSchedulerCore.createScheduler === 'function'
        ? requestSchedulerCore.createScheduler({ maxConcurrentPerWorkspace: 5 })
        : null;
      const storageKey = 'tap-xmind-casegen-tasks';
      const maxTaskStorageChars = 900000;
      const persistTaskStorageChars = 350000;
      const runnerId = 'xmind-casegen-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      const runningMap = {};
      const heartbeatIntervalMs = 2000;
      const staleMs = 6000;
      const takeoverTimers = {};
      const retryTimers = {};
      const batchRetryTimers = {};
      const retryDelaysMs = [1000, 3000];
      const watchdogIntervalMs = 5000;
      var watchdogTimer = 0;
      var pageUnloading = false;
      var volatileTaskList = [];
      var preferVolatileTasks = false;

      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('pagehide', function() { pageUnloading = true; });
        window.addEventListener('beforeunload', function() { pageUnloading = true; });
      }

      function safeJsonParse(raw) {
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch (err) {
          return null;
        }
      }

      function cloneJson(value, fallback) {
        if (value === undefined || value === null) return fallback;
        try {
          return JSON.parse(JSON.stringify(value));
        } catch (err) {
          return fallback;
        }
      }

      function markTaskStorageRecovery(reason) {
        if (typeof window === 'undefined') return;
        window.app = window.app || {};
        window.app.__xmindCasegenTaskStorageRecovered = {
          reason: String(reason || ''),
          at: Date.now(),
        };
      }

      function rememberVolatileTasks(tasks, options) {
        var opts = options && typeof options === 'object' ? options : {};
        volatileTaskList = cloneJson(Array.isArray(tasks) ? tasks : [], []);
        if (opts.prefer === true) preferVolatileTasks = true;
        else if (opts.prefer === false) preferVolatileTasks = false;
        return cloneJson(volatileTaskList, []);
      }

      function readVolatileTasks() {
        return cloneJson(volatileTaskList, []);
      }

      function compactTaskCaseGenModules(modules) {
        return (Array.isArray(modules) ? modules : []).map(function(item) {
          if (item && item.title) {
            return {
              id: item.id ? String(item.id || '') : '',
              title: String(item.title || ''),
              scenarios: Array.isArray(item.scenarios) ? cloneJson(item.scenarios, []) : [],
              points: Array.isArray(item.points) ? cloneJson(item.points, []) : [],
              coupled: Array.isArray(item.coupled) ? cloneJson(item.coupled, []) : [],
              special: Array.isArray(item.special) ? cloneJson(item.special, []) : [],
            };
          }
          return {
            module: item && item.module ? String(item.module || '') : '',
            key_scenarios: Array.isArray(item && item.key_scenarios) ? cloneJson(item.key_scenarios, []) : [],
            test_points: Array.isArray(item && item.test_points) ? cloneJson(item.test_points, []) : [],
            coupled_modules: Array.isArray(item && item.coupled_modules) ? cloneJson(item.coupled_modules, []) : [],
            cases: [],
          };
        }).filter(function(item) {
          return Boolean(item && (item.module || item.title));
        });
      }

      function compactTaskRootPipelineSnapshot(snapshot) {
        var source = snapshot && typeof snapshot === 'object' ? snapshot : null;
        if (!source) return null;
        return {
          id: String(source.id || ''),
          actionId: String(source.actionId || ''),
          snapshotId: String(source.snapshotId || ''),
          historyActionLabel: String(source.historyActionLabel || ''),
          stage: String(source.stage || ''),
          discoveryStatus: String(source.discoveryStatus || ''),
          hadAiContentBeforeAction: source.hadAiContentBeforeAction === true,
          hadAiLayerBeforeAction: source.hadAiLayerBeforeAction === true,
          hadAiCasesBeforeAction: source.hadAiCasesBeforeAction === true,
          cancelled: source.cancelled === true,
          cancelReason: String(source.cancelReason || ''),
          errorCount: Number(source.errorCount || 0) || 0,
          createdModules: Number(source.createdModules || 0) || 0,
          addedCases: Number(source.addedCases || 0) || 0,
          dedupeStatus: String(source.dedupeStatus || ''),
          dedupeTaskId: String(source.dedupeTaskId || ''),
          dedupeBeforeCount: Number(source.dedupeBeforeCount || 0) || 0,
          dedupeAfterCount: Number(source.dedupeAfterCount || 0) || 0,
          dedupeRemovedCount: Number(source.dedupeRemovedCount || 0) || 0,
          dedupeError: String(source.dedupeError || ''),
          dedupeRecords: Array.isArray(source.dedupeRecords) ? cloneJson(source.dedupeRecords, []) || [] : [],
          detailMap: cloneJson(source.detailMap, {}) || {},
          diagnostics: Array.isArray(source.diagnostics) ? source.diagnostics.slice() : [],
          pendingQueue: Array.isArray(source.pendingQueue) ? cloneJson(source.pendingQueue, []) : [],
          updatedAt: Number(source.updatedAt || 0) || 0,
        };
      }

      function collectTaskRestoreSnapshotIds(task, restoreContext) {
        var ids = {};
        var directSnapshotId = task && task.snapshotId ? String(task.snapshotId || '') : '';
        if (directSnapshotId) ids[directSnapshotId] = true;
        var pipeline = restoreContext && restoreContext.rootPipeline && typeof restoreContext.rootPipeline === 'object'
          ? restoreContext.rootPipeline
          : null;
        var pipelineSnapshotId = pipeline && pipeline.snapshotId ? String(pipeline.snapshotId || '') : '';
        if (pipelineSnapshotId) ids[pipelineSnapshotId] = true;
        if (Object.keys(ids).length) return ids;
        var list = Array.isArray(restoreContext && restoreContext.operationSnapshots)
          ? restoreContext.operationSnapshots
          : [];
        var latest = list.length ? list[list.length - 1] : null;
        if (latest && latest.id) {
          ids[String(latest.id || '')] = true;
        }
        return ids;
      }

      function compactTaskOperationSnapshots(list, task, restoreContext) {
        var sourceList = Array.isArray(list) ? list : [];
        if (!sourceList.length) return [];
        var keepIds = collectTaskRestoreSnapshotIds(task, restoreContext);
        var filtered = sourceList.filter(function(item) {
          if (!item || !item.id) return false;
          if (!Object.keys(keepIds).length) return true;
          return keepIds[String(item.id || '')] === true;
        });
        if (!filtered.length && sourceList.length) {
          filtered = [sourceList[sourceList.length - 1]];
        }
        return filtered.map(function(item) {
          if (!item || typeof item !== 'object') return null;
          return {
            id: String(item.id || ''),
            scope: item.scope === 'module' ? 'module' : 'root',
            moduleId: item.moduleId ? String(item.moduleId || '') : '',
            caseGenModules: cloneJson(item.caseGenModules, []),
            caseGenResults: cloneJson(item.caseGenResults, {}),
            caseSelections: cloneJson(item.caseSelections, {}),
            caseGenSuggestions: cloneJson(item.caseGenSuggestions, {}),
            caseGenModuleStatus: cloneJson(item.caseGenModuleStatus, {}),
            caseGenProgress: cloneJson(item.caseGenProgress, {}),
            caseGenTiming: cloneJson(item.caseGenTiming, {}),
            caseGenSource: String(item.caseGenSource || ''),
            createdAt: Number(item.createdAt || 0),
          };
        }).filter(Boolean);
      }

      function compactTaskRestoreContext(restoreContext, task) {
        var source = restoreContext && typeof restoreContext === 'object' ? restoreContext : null;
        if (!source) return null;
        var next = {
          workspaceId: String(source.workspaceId || ''),
          requirementLabel: String(source.requirementLabel || ''),
          requirementLabelSource: String(source.requirementLabelSource || ''),
          lastRawImportName: String(source.lastRawImportName || ''),
          rawText: String(source.rawText || ''),
          caseGenModules: compactTaskCaseGenModules(source.caseGenModules),
          rootPipeline: compactTaskRootPipelineSnapshot(source.rootPipeline),
          prep: cloneJson(source.prep, {}),
          viewState: cloneJson(source.viewState, {}),
        };
        var operationSnapshots = compactTaskOperationSnapshots(source.operationSnapshots, task, source);
        if (operationSnapshots.length) {
          next.operationSnapshots = operationSnapshots;
          next.nextSnapshotId = Number(source.nextSnapshotId || 1) || 1;
        }
        return next;
      }

      function buildPersistableTask(task, options) {
        var opts = options && typeof options === 'object' ? options : {};
        var snapshot = task && typeof task === 'object' ? cloneJson(task, null) : null;
        if (!snapshot) return null;
        if (snapshot.model) snapshot.model = normalizeModelSnapshot(snapshot.model);
        if (snapshot.requestMode !== 'content') snapshot.contentBlocks = [];
        if (snapshot.restoreContext && typeof snapshot.restoreContext === 'object') {
          snapshot.restoreContext = opts.compactRestoreContext === true
            ? compactTaskRestoreContext(snapshot.restoreContext, snapshot)
            : cloneJson(snapshot.restoreContext, {});
        } else {
          delete snapshot.restoreContext;
        }
        if (isTaskTerminalStatus(snapshot.status)) {
          snapshot.prompt = '';
          snapshot.requestText = '';
          snapshot.contentBlocks = [];
          delete snapshot.modelRequestBatch;
          snapshot.requestOwner = '';
          snapshot.reasoning = '';
          snapshot.runnerId = '';
          snapshot.heartbeatAt = 0;
          delete snapshot.startedAt;
          delete snapshot.degradedToTextOnly;
          delete snapshot.retryCount;
          if (!snapshot.error) delete snapshot.error;
          if (!snapshot.model || typeof snapshot.model !== 'object') delete snapshot.model;
        } else {
          delete snapshot.resultRaw;
          delete snapshot.error;
          delete snapshot.durationMs;
          delete snapshot.endedAt;
          delete snapshot.cancelledAt;
          delete snapshot.cancelMeta;
        }
        return snapshot;
      }

      function buildPersistableTaskList(tasks, options) {
        return (Array.isArray(tasks) ? tasks : []).map(function(item) {
          return buildPersistableTask(item, options);
        }).filter(Boolean);
      }

      function serializeTaskList(persistableList) {
        if (!persistableList.length) {
          return {
            ok: true,
            raw: '',
          };
        }
        try {
          var raw = JSON.stringify(persistableList);
          if (raw.length > persistTaskStorageChars) {
            return {
              ok: false,
              reason: 'oversize',
            };
          }
          return {
            ok: true,
            raw: raw,
          };
        } catch (err) {
          return {
            ok: false,
            reason: 'serialize-failed',
          };
        }
      }

      function isTaskTerminalStatus(status) {
        var value = status === null || status === undefined ? '' : String(status || '');
        return value === 'done' || value === 'error' || value === 'cancelled';
      }

      function serializeTasksForStorage(tasks) {
        var persistableList = buildPersistableTaskList(tasks, {
          compactRestoreContext: false,
        });
        var serialized = serializeTaskList(persistableList);
        if (serialized.ok === true || serialized.reason === 'serialize-failed') {
          return serialized;
        }
        var compactList = buildPersistableTaskList(tasks, {
          compactRestoreContext: true,
        });
        return serializeTaskList(compactList);
      }

      function readTasks() {
        if (preferVolatileTasks === true) return readVolatileTasks();
        if (typeof localStorage === 'undefined') return readVolatileTasks();
        try {
          var raw = localStorage.getItem(storageKey) || '';
          if (!raw) return readVolatileTasks();
          if (raw.length > maxTaskStorageChars) {
            localStorage.removeItem(storageKey);
            if (volatileTaskList.length) {
              markTaskStorageRecovery('oversize-volatile');
              preferVolatileTasks = true;
              return readVolatileTasks();
            }
            markTaskStorageRecovery('oversize');
            return [];
          }
          var parsed = safeJsonParse(raw);
          if (!Array.isArray(parsed)) {
            localStorage.removeItem(storageKey);
            if (volatileTaskList.length) {
              markTaskStorageRecovery('invalid-volatile');
              preferVolatileTasks = true;
              return readVolatileTasks();
            }
            markTaskStorageRecovery('invalid');
            return [];
          }
          return rememberVolatileTasks(parsed, { prefer: false });
        } catch (err) {
          if (volatileTaskList.length) {
            markTaskStorageRecovery('read-failed-volatile');
            preferVolatileTasks = true;
            return readVolatileTasks();
          }
          return [];
        }
      }

      function emitTaskUpdate(task, action, tasks) {
        if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
        var detail = {
          task: task || null,
          action: action || '',
          tasks: Array.isArray(tasks) ? tasks : [],
        };
        try {
          if (typeof CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent('xmind-casegen-task', { detail: detail }));
          } else if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
            var evt = document.createEvent('CustomEvent');
            evt.initCustomEvent('xmind-casegen-task', false, false, detail);
            window.dispatchEvent(evt);
          }
        } catch (err) {
          // ignore
        }
      }

      function writeTasks(tasks, action, task) {
        var list = Array.isArray(tasks) ? tasks.slice() : [];
        var writeSucceeded = false;
        var serialized = serializeTasksForStorage(list);
        if (typeof localStorage !== 'undefined') {
          try {
            if (!list.length) localStorage.removeItem(storageKey);
            else if (serialized.ok === true) {
              localStorage.setItem(storageKey, serialized.raw);
              writeSucceeded = true;
            } else if (serialized.reason === 'oversize') {
              markTaskStorageRecovery('write-oversize-volatile');
            } else {
              markTaskStorageRecovery('write-serialize-failed-volatile');
            }
          } catch (err) {
            markTaskStorageRecovery('write-failed-volatile');
          }
        }
        rememberVolatileTasks(list, { prefer: writeSucceeded !== true });
        emitTaskUpdate(task || null, action || 'update', list);
        return list;
      }

      function getTask(taskId) {
        var targetId = taskId ? String(taskId || '') : '';
        if (!targetId) return null;
        var list = readTasks();
        for (var i = 0; i < list.length; i += 1) {
          if (!list[i] || String(list[i].id || '') !== targetId) continue;
          return list[i];
        }
        return null;
      }

      function getTasks() {
        return readTasks();
      }

      function buildTaskId() {
        return 'xmind-casegen-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      }

      function normalizeModelSnapshot(model) {
        if (!model || typeof model !== 'object') return null;
        return {
          id: model.id || '',
          name: model.name || '',
          provider: model.provider || '',
          baseUrl: model.baseUrl || '',
          apiKey: model.apiKey || '',
          model: model.model || '',
          maxTokens: model.maxTokens,
          stream: model.stream,
          streamMode: model.streamMode,
          capabilities: cloneJson(model.capabilities, []),
        };
      }

      function createTask(payload) {
        var base = payload && typeof payload === 'object' ? cloneJson(payload, {}) : {};
        base.id = base.id || buildTaskId();
        base.status = 'running';
        base.createdAt = base.createdAt || Date.now();
        base.updatedAt = base.updatedAt || base.createdAt;
        base.retryCount = Number(base.retryCount || 0);
        base.requestOwner = base.requestOwner ? String(base.requestOwner || '') : ('xmind-casegen:' + base.id);
        base.requestMode = base.requestMode === 'content' ? 'content' : 'text';
        base.prompt = base.prompt ? String(base.prompt || '') : '';
        base.reasoning = base.reasoning ? String(base.reasoning || '') : '';
        base.temperature = Number(base.temperature);
        if (!Number.isFinite(base.temperature)) base.temperature = 0.2;
        base.requestText = base.requestText ? String(base.requestText || '') : '';
        if (!Array.isArray(base.contentBlocks)) base.contentBlocks = [];
        if (base.model) base.model = normalizeModelSnapshot(base.model);
        return base;
      }

      function upsertTask(task, action) {
        if (!task || !task.id) return null;
        var list = readTasks();
        var next = cloneJson(task, null);
        if (!next) return null;
        next.updatedAt = Date.now();
        var replaced = false;
        for (var i = 0; i < list.length; i += 1) {
          if (!list[i] || String(list[i].id || '') !== String(next.id || '')) continue;
          list[i] = next;
          replaced = true;
          break;
        }
        if (!replaced) list.push(next);
        writeTasks(list, action || 'update', next);
        return next;
      }

      function buildHeartbeatEventTask(task) {
        if (!task || typeof task !== 'object') return null;
        return {
          id: String(task.id || ''),
          status: String(task.status || ''),
          scope: String(task.scope || ''),
          workspaceId: String(task.workspaceId || ''),
          rootPipelineId: String(task.rootPipelineId || ''),
          actionId: String(task.actionId || ''),
          dedupeMode: String(task.dedupeMode || ''),
          runnerId: String(task.runnerId || ''),
          heartbeatAt: Number(task.heartbeatAt || 0) || 0,
          updatedAt: Number(task.updatedAt || 0) || 0,
        };
      }

      function updateTaskHeartbeat(task) {
        if (!task || !task.id) return null;
        var list = volatileTaskList.length ? readVolatileTasks() : readTasks();
        var next = cloneJson(task, null);
        if (!next) return null;
        next.updatedAt = Date.now();
        var replaced = false;
        for (var i = 0; i < list.length; i += 1) {
          if (!list[i] || String(list[i].id || '') !== String(next.id || '')) continue;
          list[i] = next;
          replaced = true;
          break;
        }
        if (!replaced) list.push(next);
        rememberVolatileTasks(list, { prefer: true });
        emitTaskUpdate(buildHeartbeatEventTask(next), 'heartbeat', []);
        return next;
      }

      function clearTask(taskId, action) {
        var targetId = taskId ? String(taskId || '') : '';
        if (!targetId) return false;
        clearTaskRetryTimer(targetId);
        clearBatchRetryTimers(targetId);
        removeTaskRequestSlots(targetId);
        if (takeoverTimers[targetId]) {
          clearTimeout(takeoverTimers[targetId]);
          delete takeoverTimers[targetId];
        }
        var list = readTasks();
        var removed = null;
        var nextList = list.filter(function(item) {
          var matched = item && String(item.id || '') === targetId;
          if (matched) removed = item;
          return !matched;
        });
        if (!removed && nextList.length === list.length) return false;
        writeTasks(nextList, action || 'clear', removed);
        if (removed && removed.status === 'running' && removed.requestOwner) {
          abortByOwner(removed.requestOwner, 'xmind-casegen-cleared');
        }
        return true;
      }

      function clearAllTasks(action) {
        readTasks().forEach(function(task) {
          if (!task || task.status !== 'running' || !task.requestOwner) return;
          abortByOwner(task.requestOwner, 'xmind-casegen-clear-all');
        });
        Object.keys(takeoverTimers).forEach(function(taskId) {
          if (takeoverTimers[taskId]) clearTimeout(takeoverTimers[taskId]);
          delete takeoverTimers[taskId];
        });
        Object.keys(runningMap).forEach(function(taskId) {
          delete runningMap[taskId];
        });
        Object.keys(retryTimers).forEach(function(taskId) {
          clearTaskRetryTimer(taskId);
        });
        Object.keys(batchRetryTimers).forEach(function(taskId) {
          clearBatchRetryTimers(taskId);
        });
        if (requestScheduler && typeof requestScheduler.clearQueued === 'function') {
          requestScheduler.clearQueued();
        }
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.removeItem(storageKey);
          } catch (err) {
            markTaskStorageRecovery('clear-all-failed-volatile');
          }
        }
        rememberVolatileTasks([], { prefer: false });
        emitTaskUpdate(null, action || 'clear-all', []);
        return true;
      }

      function resetRunner(task) {
        if (!task) return;
        task.runnerId = '';
        task.heartbeatAt = 0;
      }

      function isTransientFetchError(err) {
        if (!err) return false;
        var msg = err && err.message ? String(err.message) : String(err || '');
        if (!msg) return false;
        var lower = msg.toLowerCase();
        if (lower.indexOf('failed to fetch') !== -1) return true;
        if (lower.indexOf('networkerror') !== -1) return true;
        if (lower.indexOf('network request failed') !== -1) return true;
        if (lower.indexOf('load failed') !== -1) return true;
        return false;
      }

      function getRetryableHttpStatus(err) {
        var msg = err && err.message ? String(err.message) : String(err || '');
        if (!msg) return 0;
        var match = msg.match(/\bHTTP\s*(429|502|503|504|520)\b/i);
        return match ? Number(match[1] || 0) : 0;
      }

      function getConfiguredTimeoutMs() {
        var timeoutSec = Number(getTimeoutSec());
        if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) timeoutSec = 300;
        return timeoutSec * 1000;
      }

      function isRetryableModelRequestError(err, timing) {
        if (isTransientFetchError(err)) return true;
        var status = getRetryableHttpStatus(err);
        if (!status) return false;
        if (status === 504) {
          var durationMs = Number(timing && timing.modelRequestDurationMs || 0);
          var timeoutMs = getConfiguredTimeoutMs();
          if (durationMs > 0 && timeoutMs > 0 && durationMs >= timeoutMs * 0.9) return false;
        }
        return true;
      }

      function isModelTimeoutError(err) {
        if (!err) return false;
        var msg = err && err.message ? String(err.message) : String(err || '');
        if (!msg) return false;
        return msg.indexOf('模型调用超时') !== -1;
      }

      function isAbortError(err) {
        if (!err) return false;
        if (err.name === 'AbortError') return true;
        var msg = err && err.message ? String(err.message) : String(err || '');
        if (!msg) return false;
        return msg.indexOf('AbortError') !== -1 || msg.indexOf('request-aborted') !== -1 || msg.indexOf('cancelled') !== -1;
      }

      function shouldSuspendForNavigation(err) {
        if (pageUnloading) return true;
        if (!err) return false;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          if (isAbortError(err)) return true;
          if (isTransientFetchError(err)) return true;
          if (isModelTimeoutError(err)) return true;
          return false;
        }
        return false;
      }

      function isTaskStale(task) {
        if (!task) return true;
        var heartbeat = Number(task.heartbeatAt || 0);
        if (!heartbeat) return true;
        return Date.now() - heartbeat > staleMs;
      }

      function shouldTakeover(task) {
        if (!task || task.status !== 'running') return false;
        if (!task.runnerId || task.runnerId === runnerId) return true;
        return isTaskStale(task);
      }

      function startHeartbeat(task) {
        if (!task || !task.id) return function() {};
        var timer = setInterval(function() {
          var current = getTask(task.id);
          if (!current || current.status !== 'running') {
            clearInterval(timer);
            return;
          }
          if (current.runnerId && current.runnerId !== runnerId) {
            clearInterval(timer);
            return;
          }
          current.runnerId = runnerId;
          current.heartbeatAt = Date.now();
          current.updatedAt = current.heartbeatAt;
          updateTaskHeartbeat(current);
        }, heartbeatIntervalMs);
        return function stopHeartbeat() {
          clearInterval(timer);
        };
      }

      function getTaskRequestWorkspaceId(task) {
        var restoreContext = task && task.restoreContext && typeof task.restoreContext === 'object'
          ? task.restoreContext
          : {};
        return String(task && task.workspaceId ? task.workspaceId : (restoreContext.workspaceId || ''));
      }

      function buildTaskRequestKey(taskId, suffix) {
        var targetId = String(taskId || '');
        var requestSuffix = suffix ? String(suffix || '') : '';
        return requestSuffix ? (targetId + ':' + requestSuffix) : targetId;
      }

      function acquireTaskRequestSlot(task, requestKey) {
        if (!requestScheduler || typeof requestScheduler.acquire !== 'function') {
          return Promise.reject(new Error('XMind 请求调度器不可用，请刷新页面后重试'));
        }
        var taskId = String(task && task.id ? task.id : '');
        if (!taskId || !requestKey) return Promise.resolve(false);
        return requestScheduler.acquire({
          workspaceId: getTaskRequestWorkspaceId(task),
          requestKey: String(requestKey || ''),
          taskId: taskId,
          isValid: function() {
            var current = getTask(taskId);
            return Boolean(current && current.status === 'running');
          },
        });
      }

      function releaseTaskRequestSlot(task, requestKey) {
        if (!requestScheduler || typeof requestScheduler.release !== 'function') return false;
        return requestScheduler.release({
          workspaceId: getTaskRequestWorkspaceId(task),
          requestKey: String(requestKey || ''),
        });
      }

      function removeTaskRequestSlots(taskId) {
        var targetId = String(taskId || '');
        if (!targetId || !requestScheduler || typeof requestScheduler.cancelTask !== 'function') return 0;
        return requestScheduler.cancelTask(targetId);
      }

      function hasTaskRequestActivity(taskId) {
        var targetId = String(taskId || '');
        if (!targetId || !requestScheduler || typeof requestScheduler.hasTask !== 'function') return false;
        return requestScheduler.hasTask(targetId);
      }

      function clearTaskRetryTimer(taskId) {
        var targetId = String(taskId || '');
        if (!targetId || !retryTimers[targetId]) return false;
        clearTimeout(retryTimers[targetId]);
        delete retryTimers[targetId];
        return true;
      }

      function clearBatchRetryTimers(taskId) {
        var targetId = String(taskId || '');
        var list = targetId && Array.isArray(batchRetryTimers[targetId])
          ? batchRetryTimers[targetId].slice()
          : [];
        if (!list.length) return false;
        delete batchRetryTimers[targetId];
        list.forEach(function(entry) {
          if (entry && entry.timer) clearTimeout(entry.timer);
          if (entry && typeof entry.resolve === 'function') entry.resolve(false);
        });
        return true;
      }

      function waitForBatchRetry(taskId, delayMs) {
        var targetId = String(taskId || '');
        var waitMs = Math.max(0, Number(delayMs || 0));
        if (!targetId || !waitMs) return Promise.resolve(true);
        return new Promise(function(resolve) {
          var entry = {
            timer: 0,
            resolve: resolve,
          };
          if (!Array.isArray(batchRetryTimers[targetId])) batchRetryTimers[targetId] = [];
          batchRetryTimers[targetId].push(entry);
          entry.timer = setTimeout(function() {
            var list = Array.isArray(batchRetryTimers[targetId]) ? batchRetryTimers[targetId] : [];
            var index = list.indexOf(entry);
            if (index !== -1) list.splice(index, 1);
            if (!list.length) delete batchRetryTimers[targetId];
            resolve(true);
          }, waitMs);
        });
      }

      function scheduleTaskRetry(taskId, retryCount) {
        var targetId = String(taskId || '');
        var retryIndex = Math.max(0, Number(retryCount || 1) - 1);
        var delayMs = retryDelaysMs[retryIndex];
        if (!targetId || !Number.isFinite(delayMs)) return false;
        clearTaskRetryTimer(targetId);
        retryTimers[targetId] = setTimeout(function() {
          delete retryTimers[targetId];
          var current = getTask(targetId);
          if (!current || current.status !== 'running') return;
          if (pageUnloading) return;
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
          startTask(targetId, { force: true });
        }, delayMs);
        return true;
      }

      function callTaskModel(current) {
        var model = current && current.model ? current.model : null;
        if (!model || !model.baseUrl || !model.model) {
          return Promise.reject(new Error('未找到 XMind 用例生成模型'));
        }
        if (current.requestMode === 'content') {
          return callModelWithContent(model, current.contentBlocks || [], current.prompt || '', {
            reasoningEffort: current.reasoning || '',
            temperature: current.temperature,
            owner: current.requestOwner || '',
          });
        }
        var requestText = current.requestText ? String(current.requestText || '') : '';
        if (!requestText.trim()) {
          return Promise.reject(new Error('生成上下文缺失'));
        }
        return callModel(model, requestText, current.prompt || '', current.reasoning || '', current.temperature, {
          owner: current.requestOwner || '',
        });
      }

      function startTaskModelRequestTiming(taskId) {
        var current = getTask(taskId);
        if (!current || current.status !== 'running') return Date.now();
        var startedAt = Date.now();
        current.modelRequestStartedAt = startedAt;
        current.updatedAt = startedAt;
        upsertTask(current, 'model-request-start');
        return startedAt;
      }

      function applyTaskModelRequestTiming(current, startedAt, endedAt) {
        if (!current) return 0;
        var activeStartedAt = Number(current.modelRequestStartedAt || 0);
        var expectedStartedAt = Number(startedAt || 0);
        if (!activeStartedAt || !expectedStartedAt || activeStartedAt !== expectedStartedAt) return 0;
        var finishAt = Number(endedAt || Date.now());
        var durationMs = Math.max(1, finishAt - expectedStartedAt);
        current.modelRequestStartedAt = 0;
        current.modelRequestDurationMs = durationMs;
        current.modelRequestTotalDurationMs = Number(current.modelRequestTotalDurationMs || 0) + durationMs;
        current.modelRequestAttemptCount = Number(current.modelRequestAttemptCount || 0) + 1;
        current.updatedAt = finishAt;
        return durationMs;
      }

      function finishTaskModelRequestTiming(taskId, startedAt) {
        var current = getTask(taskId);
        if (!current) return 0;
        var durationMs = applyTaskModelRequestTiming(current, startedAt, Date.now());
        if (!durationMs) return 0;
        upsertTask(current, 'model-request-finish');
        return durationMs;
      }

      function buildBatchModelTask(task, request) {
        var item = request && typeof request === 'object' ? request : {};
        return Object.assign({}, task, {
          requestMode: item.requestMode === 'content' ? 'content' : 'text',
          prompt: item.prompt ? String(item.prompt || '') : '',
          requestText: item.requestText ? String(item.requestText || '') : '',
          contentBlocks: Array.isArray(item.contentBlocks) ? item.contentBlocks : [],
          reasoning: item.reasoning ? String(item.reasoning || '') : String(task && task.reasoning || ''),
          temperature: Number.isFinite(Number(item.temperature))
            ? Number(item.temperature)
            : Number(task && task.temperature),
          requestOwner: task && task.requestOwner ? String(task.requestOwner || '') : '',
        });
      }

      function updateBatchRequestProgress(taskId, completedCount, totalCount, activeIndex) {
        var current = getTask(taskId);
        if (!current || current.status !== 'running') return null;
        current.modelRequestBatchCompleted = Math.max(0, Number(completedCount || 0));
        current.modelRequestBatchTotal = Math.max(0, Number(totalCount || 0));
        current.modelRequestBatchActiveIndex = Math.max(0, Number(activeIndex || 0));
        current.updatedAt = Date.now();
        return upsertTask(current, 'batch-progress');
      }

      function callBatchModelRequest(taskId, request, requestIndex) {
        var retryCount = 0;
        var requestKey = buildTaskRequestKey(taskId, 'batch-' + String(requestIndex));
        function runAttempt() {
          var current = getTask(taskId);
          if (!current || current.status !== 'running') {
            var cancelledError = new Error('request-aborted');
            cancelledError.name = 'AbortError';
            throw cancelledError;
          }
          var attemptStartedAt = 0;
          return acquireTaskRequestSlot(current, requestKey)
            .then(function(granted) {
              if (!granted) {
                var rejectedError = new Error('request-aborted');
                rejectedError.name = 'AbortError';
                throw rejectedError;
              }
              var latest = getTask(taskId);
              if (!latest || latest.status !== 'running') {
                releaseTaskRequestSlot(current, requestKey);
                var stoppedError = new Error('request-aborted');
                stoppedError.name = 'AbortError';
                throw stoppedError;
              }
              attemptStartedAt = Date.now();
              return Promise.resolve()
                .then(function() {
                  return callTaskModel(buildBatchModelTask(latest, request));
                })
                .finally(function() {
                  releaseTaskRequestSlot(latest, requestKey);
                });
            })
            .catch(function(err) {
              if (shouldSuspendForNavigation(err)) throw err;
              if (!isRetryableModelRequestError(err, {
                modelRequestDurationMs: Math.max(0, Date.now() - attemptStartedAt),
              }) || retryCount >= retryDelaysMs.length) {
                if (err && typeof err === 'object') err.xmindBatchRetryHandled = true;
                throw err;
              }
              var delayMs = retryDelaysMs[retryCount];
              retryCount += 1;
              var latest = getTask(taskId);
              if (latest && latest.status === 'running') {
                latest.modelRequestBatchRetryCount = Number(latest.modelRequestBatchRetryCount || 0) + 1;
                latest.modelRequestBatchRetryIndex = Number(requestIndex || 0);
                latest.updatedAt = Date.now();
                upsertTask(latest, 'batch-retry');
              }
              return waitForBatchRetry(taskId, delayMs).then(function(shouldContinue) {
                if (!shouldContinue) {
                  var abortedError = new Error('request-aborted');
                  abortedError.name = 'AbortError';
                  throw abortedError;
                }
                return runAttempt();
              });
            });
        }
        return runAttempt();
      }

      function executeTaskModelRequestBatch(taskId, task) {
        var requests = task && Array.isArray(task.modelRequestBatch) ? task.modelRequestBatch : [];
        if (!requests.length) return Promise.reject(new Error('去重批次请求缺失'));
        var configuredConcurrency = Number(task.modelRequestBatchConcurrency || 1);
        var concurrency = Number.isFinite(configuredConcurrency) && configuredConcurrency > 0
          ? Math.min(5, Math.floor(configuredConcurrency), requests.length)
          : 1;
        var results = new Array(requests.length);
        var completedMap = {};
        var nextIndex = 0;
        var stopped = false;
        updateBatchRequestProgress(taskId, 0, requests.length, 0);

        function runWorker() {
          if (stopped) return Promise.resolve();
          var requestIndex = nextIndex;
          nextIndex += 1;
          if (requestIndex >= requests.length) return Promise.resolve();
          return callBatchModelRequest(taskId, requests[requestIndex], requestIndex)
            .then(function(content) {
              results[requestIndex] = content;
              completedMap[requestIndex] = true;
              updateBatchRequestProgress(
                taskId,
                Object.keys(completedMap).length,
                requests.length,
                requestIndex
              );
              return runWorker();
            })
            .catch(function(err) {
              stopped = true;
              throw err;
            });
        }

        var workers = [];
        for (var i = 0; i < concurrency; i += 1) workers.push(runWorker());
        return Promise.all(workers).then(function() {
          return results;
        });
      }

      function executeTaskModelRequest(taskId) {
        var current = getTask(taskId);
        if (!current || current.status !== 'running') return Promise.resolve(current);
        if (Array.isArray(current.modelRequestBatch) && current.modelRequestBatch.length) {
          return executeTaskModelRequestBatch(taskId, current);
        }
        var requestKey = buildTaskRequestKey(taskId, 'request');
        return acquireTaskRequestSlot(current, requestKey).then(function(granted) {
          if (!granted) return getTask(taskId);
          var latest = getTask(taskId);
          if (!latest || latest.status !== 'running') {
            releaseTaskRequestSlot(current, requestKey);
            return latest;
          }
          var requestStartedAt = startTaskModelRequestTiming(taskId);
          return Promise.resolve()
            .then(function() {
              return callTaskModel(latest);
            })
            .then(function(content) {
              finishTaskModelRequestTiming(taskId, requestStartedAt);
              return content;
            }, function(err) {
              finishTaskModelRequestTiming(taskId, requestStartedAt);
              throw err;
            })
            .finally(function() {
              releaseTaskRequestSlot(latest, requestKey);
            });
        });
      }

      function runTask(task) {
        if (!task || !task.id) return Promise.resolve(null);
        if (runningMap[task.id] && runningMap[task.id].taskId === task.id) {
          return runningMap[task.id].promise;
        }
        var stopHeartbeat = startHeartbeat(task);
        function waitForTaskMinVisible(current) {
          var until = Number(current && current.minVisibleUntil || 0);
          if (!Number.isFinite(until) || until <= 0) return Promise.resolve(current);
          var delay = until - Date.now();
          if (!Number.isFinite(delay) || delay <= 0) return Promise.resolve(current);
          return new Promise(function(resolve) {
            setTimeout(function() {
              resolve(current);
            }, delay);
          });
        }
        var promise = Promise.resolve()
          .then(function() {
            return executeTaskModelRequest(task.id);
          })
          .then(function(content) {
            var current = getTask(task.id);
            return waitForTaskMinVisible(current).then(function() {
              return content;
            });
          })
          .then(function(content) {
            var current = getTask(task.id);
            if (!current) return null;
            if (current.status !== 'running') return current;
            if (current.runnerId && current.runnerId !== runnerId) return null;
            current.status = 'done';
            current.resultRaw = typeof content === 'string' ? content : JSON.stringify(content || '');
            current.error = '';
            current.durationMs = Math.max(0, Date.now() - Number(current.startedAt || current.createdAt || Date.now()));
            current.endedAt = Date.now();
            resetRunner(current);
            upsertTask(current, 'done');
            return current;
          })
          .catch(function(err) {
            var current = getTask(task.id);
            if (!current) return null;
            if (current.status === 'cancelled') return current;
            if (current.status !== 'running') return current;
            if (current.runnerId && current.runnerId !== runnerId) return null;
            var msg = err && err.message ? err.message : String(err || '');
            if (shouldSuspendForNavigation(err)) {
              current.status = 'running';
              current.error = '';
              resetRunner(current);
              current.updatedAt = Date.now();
              upsertTask(current, 'suspend');
              return current;
            }
            if (isRetryableModelRequestError(err, current) && !(err && err.xmindBatchRetryHandled === true)) {
              current.retryCount = Number(current.retryCount || 0) + 1;
              if (current.retryCount <= 2) {
                current.status = 'running';
                current.error = '';
                resetRunner(current);
                current.updatedAt = Date.now();
                upsertTask(current, 'retry');
                scheduleTaskRetry(current.id, current.retryCount);
                return current;
              }
            }
            current.status = 'error';
            current.error = msg ? ('XMind 用例生成失败：' + msg) : 'XMind 用例生成失败';
            current.endedAt = Date.now();
            clearBatchRetryTimers(current.id);
            removeTaskRequestSlots(current.id);
            resetRunner(current);
            upsertTask(current, 'error');
            if (current.requestOwner) {
              abortByOwner(current.requestOwner, 'xmind-casegen-error');
            }
            return current;
          })
          .finally(function() {
            stopHeartbeat();
            if (runningMap[task.id] && runningMap[task.id].taskId === task.id) {
              delete runningMap[task.id];
            }
          });
        runningMap[task.id] = {
          taskId: task.id,
          promise: promise,
        };
        return promise;
      }

      function startTask(task, options) {
        var active = null;
        if (typeof task === 'string') active = getTask(task);
        else active = task ? createTask(task) : null;
        if (!active || !active.id) return Promise.resolve(null);
        if (active.status !== 'running') return Promise.resolve(active);
        if (!options || options.force !== true) {
          if (!shouldTakeover(active)) {
            if (!takeoverTimers[active.id]) {
              takeoverTimers[active.id] = setTimeout(function() {
                takeoverTimers[active.id] = null;
                var latest = getTask(active.id);
                if (latest && latest.status === 'running') {
                  startTask(latest);
                }
              }, staleMs);
            }
            return Promise.resolve(active);
          }
        }
        active.runnerId = runnerId;
        active.heartbeatAt = Date.now();
        active.startedAt = active.startedAt || active.heartbeatAt;
        upsertTask(active, 'start');
        return runTask(active);
      }

      function resumeTasks(options) {
        getTasks().forEach(function(task) {
          if (!task || task.status !== 'running') return;
          if (retryTimers[String(task.id || '')]) return;
          startTask(task, options);
        });
      }

      function resumeOrphanedTasks() {
        if (pageUnloading) return 0;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return 0;
        var resumed = 0;
        getTasks().forEach(function(task) {
          if (!task || task.status !== 'running' || !task.id) return;
          var taskId = String(task.id || '');
          if (runningMap[taskId] || retryTimers[taskId] || batchRetryTimers[taskId]) return;
          if (hasTaskRequestActivity(taskId)) return;
          startTask(taskId);
          resumed += 1;
        });
        return resumed;
      }

      function failTask(taskId, options) {
        var opts = options && typeof options === 'object' ? options : {};
        var active = getTask(taskId);
        if (!active || active.status !== 'running') return false;
        var now = Date.now();
        var requestStartedAt = Number(active.modelRequestStartedAt || 0);
        clearTaskRetryTimer(taskId);
        clearBatchRetryTimers(taskId);
        removeTaskRequestSlots(taskId);
        if (takeoverTimers[taskId]) {
          clearTimeout(takeoverTimers[taskId]);
          delete takeoverTimers[taskId];
        }
        if (requestStartedAt > 0) {
          applyTaskModelRequestTiming(active, requestStartedAt, now);
        }
        active.status = 'error';
        active.error = opts.error ? String(opts.error || '') : 'XMind 用例生成失败';
        active.endedAt = now;
        active.failureMeta = opts.meta && typeof opts.meta === 'object'
          ? cloneJson(opts.meta, {})
          : {};
        resetRunner(active);
        upsertTask(active, opts.action || 'error');
        if (active.requestOwner) {
          abortByOwner(active.requestOwner, opts.abortReason || 'xmind-casegen-failed');
        }
        return true;
      }

      function cancelTask(taskId, options) {
        var opts = options && typeof options === 'object' ? options : {};
        var active = getTask(taskId);
        if (!active || active.status !== 'running') {
          if (opts.clear === true) clearTask(taskId, 'clear');
          return false;
        }
        var reasonText = opts.reason ? String(opts.reason) : '已中断当前 XMind 生成任务';
        clearTaskRetryTimer(taskId);
        clearBatchRetryTimers(taskId);
        removeTaskRequestSlots(taskId);
        if (takeoverTimers[taskId]) {
          clearTimeout(takeoverTimers[taskId]);
          delete takeoverTimers[taskId];
        }
        active.status = 'cancelled';
        active.error = reasonText;
        active.cancelledAt = Date.now();
        active.endedAt = active.cancelledAt;
        active.cancelMeta = {
          source: opts.source ? String(opts.source || '') : '',
          reason: reasonText,
        };
        resetRunner(active);
        upsertTask(active, 'cancel');
        if (active.requestOwner) {
          abortByOwner(active.requestOwner, opts.abortReason || 'xmind-casegen-cancelled');
        }
        return true;
      }

      function cancelAllRunning(options) {
        var count = 0;
        getTasks().forEach(function(task) {
          if (!task || task.status !== 'running') return;
          if (cancelTask(task.id, options)) count += 1;
        });
        return count;
      }

      function updateTasksContext(patch, options) {
        var opts = options && typeof options === 'object' ? options : {};
        var list = readTasks();
        if (!Array.isArray(list) || !list.length) return 0;
        var taskIds = Array.isArray(opts.taskIds) ? opts.taskIds.map(function(item) {
          return String(item || '');
        }).filter(Boolean) : null;
        var changedCount = 0;
        var latestChangedTask = null;
        var nextList = list.map(function(item) {
          if (!item || !item.id) return item;
          if (opts.onlyRunning === true && item.status !== 'running') return item;
          if (taskIds && taskIds.indexOf(String(item.id || '')) === -1) return item;
          var nextTask = cloneJson(item, null);
          if (!nextTask) return item;
          var nextContext = nextTask.restoreContext && typeof nextTask.restoreContext === 'object'
            ? cloneJson(nextTask.restoreContext, {})
            : {};
          if (typeof patch === 'function') {
            try {
              patch(nextContext, nextTask);
            } catch (err) {
              return item;
            }
          } else if (patch && typeof patch === 'object') {
            Object.keys(patch).forEach(function(key) {
              if (patch[key] === undefined) {
                delete nextContext[key];
              } else {
                nextContext[key] = patch[key];
              }
            });
          }
          nextTask.restoreContext = nextContext;
          nextTask.updatedAt = Date.now();
          changedCount += 1;
          latestChangedTask = nextTask;
          return nextTask;
        });
        if (changedCount <= 0) return 0;
        writeTasks(nextList, opts.action || 'context', latestChangedTask);
        return changedCount;
      }

      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('storage', function(e) {
          var key = e && e.key ? String(e.key) : '';
          if (key !== storageKey) return;
          emitTaskUpdate(null, 'storage', getTasks());
        });
        window.addEventListener('pageshow', function() {
          pageUnloading = false;
          resumeOrphanedTasks();
        });
      }
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', function() {
          if (document.visibilityState === 'hidden') return;
          pageUnloading = false;
          resumeOrphanedTasks();
        });
      }
      watchdogTimer = setInterval(function() {
        resumeOrphanedTasks();
      }, watchdogIntervalMs);

      return {
        createTask: createTask,
        startTask: startTask,
        getTask: getTask,
        getTasks: getTasks,
        clearTask: clearTask,
        clearAllTasks: clearAllTasks,
        cancelTask: cancelTask,
        failTask: failTask,
        cancelAllRunning: cancelAllRunning,
        updateTasksContext: updateTasksContext,
        resumeTasks: resumeTasks,
        buildTaskId: buildTaskId,
        normalizeModelSnapshot: normalizeModelSnapshot,
      };
    }

    function initAutoWorkflowManager(options) {
      const getSteps = options && typeof options.getSteps === 'function'
        ? options.getSteps
        : function() { return []; };
      const canRun = options && typeof options.canRun === 'function'
        ? options.canRun
        : function() { return true; };
      const persistWorkflowStateNow = options && typeof options.persistWorkflowStateNow === 'function'
        ? options.persistWorkflowStateNow
        : function() {};
      const getLastError = options && typeof options.getLastModelError === 'function'
        ? options.getLastModelError
        : function() { return null; };
      const clearLastError = options && typeof options.clearLastModelError === 'function'
        ? options.clearLastModelError
        : function() {};
      const abortModelRequests = options && typeof options.abortModelRequests === 'function'
        ? options.abortModelRequests
        : function() {};
      const storageKey = 'tap-auto-workflow-task';
      const runnerId = 'auto-workflow-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      const runningMap = {};
      const heartbeatIntervalMs = 2000;
      const staleMs = 6000;
      var takeoverTimer = null;
      var retryTimer = null;
      var pageUnloading = false;

      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('pagehide', function() { pageUnloading = true; });
        window.addEventListener('beforeunload', function() { pageUnloading = true; });
      }

      function safeJsonParse(raw) {
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch (err) {
          return null;
        }
      }

      function readTask() {
        if (typeof localStorage === 'undefined') return null;
        try {
          return safeJsonParse(localStorage.getItem(storageKey));
        } catch (err) {
          return null;
        }
      }

      function emitTaskUpdate(task, action) {
        if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
        try {
          if (typeof CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent('auto-workflow-task', { detail: { task: task, action: action || '' } }));
          } else if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
            var evt = document.createEvent('CustomEvent');
            evt.initCustomEvent('auto-workflow-task', false, false, { task: task, action: action || '' });
            window.dispatchEvent(evt);
          }
        } catch (err) {
          // ignore
        }
      }

      function writeTask(task, action) {
        if (typeof localStorage === 'undefined') return task || null;
        if (!task) {
          try {
            localStorage.removeItem(storageKey);
          } catch (err) {
            // ignore
          }
          emitTaskUpdate(null, action || 'clear');
          return null;
        }
        var next = task;
        next.updatedAt = Date.now();
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch (err) {
          // ignore
        }
        emitTaskUpdate(next, action || 'update');
        return next;
      }

      function clearTask() {
        writeTask(null, 'clear');
      }

      function cancelTask(options) {
        var opts = options && typeof options === 'object' ? options : {};
        var reasonText = opts.reason ? String(opts.reason) : '已中断当前执行任务';
        var active = readTask();
        if (!active || active.status !== 'running') {
          if (opts.clear === true) clearTask();
          return false;
        }
        active.status = 'cancelled';
        active.error = reasonText;
        active.cancelledAt = Date.now();
        active.endedAt = active.cancelledAt;
        resetRunner(active);
        writeTask(active, 'cancel');
        try {
          abortModelRequests('auto-workflow-cancelled');
        } catch (err) {
          // ignore
        }
        return true;
      }

      function updateTaskContext(patch, options) {
        var opts = options && typeof options === 'object' ? options : {};
        var active = readTask();
        if (!active) return null;
        if (opts.onlyRunning === true && active.status !== 'running') return null;
        var nextContext = active.context && typeof active.context === 'object'
          ? Object.assign({}, active.context)
          : {};
        if (typeof patch === 'function') {
          try {
            patch(nextContext, active);
          } catch (err) {
            // ignore
          }
        } else if (patch && typeof patch === 'object') {
          Object.keys(patch).forEach(function(key) {
            if (patch[key] === undefined) {
              delete nextContext[key];
            } else {
              nextContext[key] = patch[key];
            }
          });
        }
        active.context = nextContext;
        active.updatedAt = Date.now();
        writeTask(active, opts.action || 'context');
        return active;
      }

      function buildTaskId() {
        return 'auto-workflow-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      }

      function createTask(payload) {
        var base = payload && typeof payload === 'object' ? Object.assign({}, payload) : {};
        base.id = base.id || buildTaskId();
        base.status = 'running';
        base.createdAt = base.createdAt || Date.now();
        base.updatedAt = base.updatedAt || base.createdAt;
        base.retryCount = Number(base.retryCount || 0);
        base.startIndex = Number(base.startIndex || 0);
        if (!Number.isFinite(base.startIndex) || base.startIndex < 0) base.startIndex = 0;
        if (!Number.isFinite(Number(base.stepIndex))) base.stepIndex = base.startIndex;
        if (!base.context || typeof base.context !== 'object') base.context = {};
        if (!base.messages || typeof base.messages !== 'object') base.messages = {};
        return base;
      }

      function isTransientFetchError(err) {
        if (!err) return false;
        var msg = err && err.message ? String(err.message) : String(err || '');
        if (!msg) return false;
        if (msg.indexOf('Failed to fetch') !== -1) return true;
        if (msg.indexOf('NetworkError') !== -1) return true;
        return false;
      }

      function isModelTimeoutError(err) {
        if (!err) return false;
        var msg = err && err.message ? String(err.message) : String(err || '');
        if (!msg) return false;
        return msg.indexOf('模型调用超时') !== -1;
      }

      function shouldSuspendForNavigation(err) {
        if (pageUnloading) return true;
        if (!err) return false;
        if (err.name === 'AbortError') return true;
        var msg = err && err.message ? String(err.message) : String(err || '');
        if (msg.indexOf('AbortError') !== -1) return true;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          if (isTransientFetchError(err)) return true;
          if (isModelTimeoutError(err)) return true;
          return false;
        }
        return false;
      }

      function isTaskStale(task) {
        if (!task) return true;
        var heartbeat = Number(task.heartbeatAt || 0);
        if (!heartbeat) return true;
        return Date.now() - heartbeat > staleMs;
      }

      function shouldTakeover(task) {
        if (!task || task.status !== 'running') return false;
        if (!task.runnerId || task.runnerId === runnerId) return true;
        return isTaskStale(task);
      }

      function startHeartbeat(task) {
        if (!task) return function() {};
        var timer = setInterval(function() {
          var current = readTask();
          if (!current || current.id !== task.id || current.status !== 'running') {
            clearInterval(timer);
            return;
          }
          if (current.runnerId && current.runnerId !== runnerId) {
            clearInterval(timer);
            return;
          }
          current.runnerId = runnerId;
          current.heartbeatAt = Date.now();
          current.updatedAt = current.heartbeatAt;
          writeTask(current, 'heartbeat');
        }, heartbeatIntervalMs);
        return function stopHeartbeat() {
          clearInterval(timer);
        };
      }

      function resetRunner(task) {
        if (!task) return;
        task.runnerId = '';
        task.heartbeatAt = 0;
      }

      function scheduleRetry() {
        if (retryTimer) return;
        retryTimer = setTimeout(function() {
          retryTimer = null;
          var current = readTask();
          if (!current || current.status !== 'running') return;
          if (pageUnloading) return;
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
          startTask(current, { force: true });
        }, 800);
      }

      function handleRetry(current, action) {
        if (!current) return false;
        current.retryCount = Number(current.retryCount || 0) + 1;
        if (current.retryCount > 2) return false;
        current.status = 'running';
        current.error = '';
        resetRunner(current);
        current.updatedAt = Date.now();
        writeTask(current, action || 'retry');
        if (!pageUnloading && typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
          scheduleRetry();
        }
        return true;
      }

      function runTask(task) {
        if (!task) return Promise.resolve(null);
        if (runningMap.main && runningMap.main.taskId === task.id) {
          return runningMap.main.promise;
        }
        var stopHeartbeat = startHeartbeat(task);
        var promise = Promise.resolve()
          .then(async function() {
            var steps = getSteps();
            var current = readTask();
            if (!current || current.id !== task.id) return null;
            if (typeof canRun === 'function' && !canRun()) {
              current.status = 'running';
              current.error = '';
              resetRunner(current);
              current.updatedAt = Date.now();
              writeTask(current, 'suspend');
              return current;
            }
            if (!steps || !steps.length) {
              current.status = 'error';
              current.error = '未配置自动流程步骤';
              current.updatedAt = Date.now();
              current.endedAt = current.updatedAt;
              resetRunner(current);
              writeTask(current, 'error');
              return current;
            }
            var startIndex = Number(current.stepIndex);
            if (!Number.isFinite(startIndex) || startIndex < 0) startIndex = Number(current.startIndex || 0);
            if (!Number.isFinite(startIndex) || startIndex < 0) startIndex = 0;
            var context = current.context && typeof current.context === 'object' ? current.context : {};

            for (var i = startIndex; i < steps.length; i += 1) {
              var step = steps[i] || {};
              current = readTask();
              if (!current || current.id !== task.id) return null;
              if (current.status !== 'running') return current;
              if (current.runnerId && current.runnerId !== runnerId) return null;
              current.stepIndex = i;
              current.stepKey = step.key || '';
              current.stepLabel = step.label || '';
              current.updatedAt = Date.now();
              writeTask(current, 'step');
              if (typeof clearLastError === 'function') clearLastError();
              try {
                if (step && typeof step.run === 'function') {
                  await step.run(context);
                }
                current = readTask();
                if (!current || current.id !== task.id) return null;
                if (current.status !== 'running') return current;
                if (current.runnerId && current.runnerId !== runnerId) return null;
                var valid = step && typeof step.validate === 'function' ? step.validate() : false;
                if (!valid) {
                  var lastErr = typeof getLastError === 'function' ? getLastError() : null;
                  if (shouldSuspendForNavigation(lastErr)) {
                    current.status = 'running';
                    current.error = '';
                    resetRunner(current);
                    current.updatedAt = Date.now();
                    writeTask(current, 'suspend');
                    return current;
                  }
                  if (isTransientFetchError(lastErr) && handleRetry(current, 'retry')) {
                    return current;
                  }
                  var invalidReason = '';
                  if (step && typeof step.getInvalidReason === 'function') {
                    try {
                      invalidReason = step.getInvalidReason() || '';
                    } catch (errGetReason) {
                      invalidReason = '';
                    }
                  }
                  if (!invalidReason) {
                    invalidReason = (step && step.label ? step.label : '流程步骤') + '未产生有效输出，请检查模型配置或稍后重试';
                  }
                  throw new Error(invalidReason);
                }
                if (step && typeof step.after === 'function') {
                  await step.after();
                }
                current.stepIndex = i + 1;
                current.stepKey = '';
                current.stepLabel = '';
                current.updatedAt = Date.now();
                writeTask(current, 'progress');
                if (typeof persistWorkflowStateNow === 'function') persistWorkflowStateNow();
              } catch (err) {
                var lastErrInner = typeof getLastError === 'function' ? getLastError() : null;
                current = readTask();
                if (!current || current.id !== task.id) return null;
                if (current.status !== 'running') return current;
                if (current.runnerId && current.runnerId !== runnerId) return null;
                if (shouldSuspendForNavigation(err) || shouldSuspendForNavigation(lastErrInner)) {
                  current.status = 'running';
                  current.error = '';
                  resetRunner(current);
                  current.updatedAt = Date.now();
                  writeTask(current, 'suspend');
                  return current;
                }
                if ((isTransientFetchError(err) || isTransientFetchError(lastErrInner)) && handleRetry(current, 'retry')) {
                  return current;
                }
                var msg = err && err.message ? err.message : String(err || '');
                current.status = 'error';
                current.error = msg || '自动流程失败';
                current.updatedAt = Date.now();
                current.endedAt = current.updatedAt;
                resetRunner(current);
                writeTask(current, 'error');
                return current;
              }
            }
            current = readTask();
            if (!current || current.id !== task.id) return null;
            if (current.runnerId && current.runnerId !== runnerId) return null;
            current.status = 'done';
            current.error = '';
            current.updatedAt = Date.now();
            current.endedAt = current.updatedAt;
            current.heartbeatAt = 0;
            writeTask(current, 'done');
            return current;
          })
          .finally(function() {
            stopHeartbeat();
            if (runningMap.main && runningMap.main.taskId === task.id) {
              delete runningMap.main;
            }
          });
        runningMap.main = { taskId: task.id, promise: promise };
        return promise;
      }

      function startTask(task, options) {
        var active = task ? createTask(task) : readTask();
        if (!active) return Promise.resolve(null);
        if (active.status !== 'running') return Promise.resolve(active);
        if (!options || options.force !== true) {
          if (!shouldTakeover(active)) {
            if (!takeoverTimer) {
              takeoverTimer = setTimeout(function() {
                takeoverTimer = null;
                var latest = readTask();
                if (latest && latest.status === 'running') {
                  startTask(latest);
                }
              }, staleMs);
            }
            return Promise.resolve(active);
          }
        }
        active.runnerId = runnerId;
        active.heartbeatAt = Date.now();
        writeTask(active, 'start');
        return runTask(active);
      }

      function resumeTask(options) {
        var task = readTask();
        if (task && task.status === 'running') {
          startTask(task, options);
        }
      }

      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('storage', function(e) {
          var key = e && e.key ? String(e.key) : '';
          if (key !== storageKey) return;
          emitTaskUpdate(readTask(), 'storage');
        });
      }

      return {
        createTask: createTask,
        startTask: startTask,
        getTask: readTask,
        cancelTask: cancelTask,
        updateTaskContext: updateTaskContext,
        clearTask: clearTask,
        resumeTask: resumeTask,
      };
    }

    const missingReminderAiManager = initMissingReminderAiManager({
      utils: appUtils,
      callModelWithConfig: callModelWithConfig,
    });
    window.app.missingReminderAi = missingReminderAiManager;

    const caseLibraryAiGenManager = initCaseLibraryAiGenManager({
      utils: appUtils,
      callModelWithConfig: callModelWithConfig,
    });
    window.app.caseLibraryAiGen = caseLibraryAiGenManager;
    if (caseLibraryAiGenManager && typeof caseLibraryAiGenManager.resumeTasks === 'function') {
      caseLibraryAiGenManager.resumeTasks({ force: true });
    }

    const xmindCaseGenTaskManager = initXmindCaseGenTaskManager({
      callModelWithConfig: callModelWithConfig,
      callModelWithContent: callModelWithContent,
      abortRequestsByOwner: abortModelRequestsByOwner,
      getTimeoutSec: getConfiguredTimeoutSec,
      requestSchedulerCore: window.app && window.app.xmindRequestSchedulerCore
        ? window.app.xmindRequestSchedulerCore
        : null,
    });
    window.app.xmindCaseGenTaskManager = xmindCaseGenTaskManager;

    function shouldResumeMissingReminderAi() {
      return Boolean(state && state.settings && state.settings.missingCaseReminderAiEnabled === 'on');
    }

    function syncMissingReminderAiTasks() {
      if (!missingReminderAiManager || typeof missingReminderAiManager.resumeTasks !== 'function') return;
      if (!shouldResumeMissingReminderAi()) {
        if (typeof missingReminderAiManager.clearTask === 'function') {
          missingReminderAiManager.clearTask('case-library');
          missingReminderAiManager.clearTask('temp-exec');
        }
        return;
      }
      missingReminderAiManager.resumeTasks({ force: true });
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('app-settings-loaded', function() {
        syncMissingReminderAiTasks();
      });
      window.addEventListener('app-settings-updated', function(e) {
        var detail = e && e.detail ? e.detail : null;
        var keys = detail && Array.isArray(detail.keys) ? detail.keys : [];
        if (!keys.length || keys.indexOf('missingCaseReminderAiEnabled') !== -1) {
          syncMissingReminderAiTasks();
        }
      });
    }
    if (window.app && window.app.settingsReady === true) {
      syncMissingReminderAiTasks();
    }

    function ensureAutoWorkflowGhostFields() {
      if (typeof document === 'undefined' || !document.body) return;
      var ids = ['rawText', 'reviewResult', 'cleanedText', 'compareResult', 'splitResult', 'casesCompareResult', 'caseText'];
      var hasMissing = ids.some(function(id) { return !document.getElementById(id); });
      if (!hasMissing) return;
      var container = document.getElementById('autoWorkflowGhostFields');
      if (!container) {
        container = document.createElement('div');
        container.id = 'autoWorkflowGhostFields';
        container.style.display = 'none';
        document.body.appendChild(container);
      }
      ids.forEach(function(id) {
        if (document.getElementById(id)) return;
        var area = document.createElement('textarea');
        area.id = id;
        area.setAttribute('data-ghost', 'true');
        container.appendChild(area);
      });
    }

    ensureAutoWorkflowGhostFields();

    const domConfig = window.app.domConfig || {};
    const dom = buildDom(domConfig.ids, domConfig.alias);
    dom.tempFocusZone = dom.tempFocusBlock ? dom.tempFocusBlock.querySelector('[data-temp-focus-zone]') : null;
    dom.tempExecViewFocusBlock = document.getElementById('tempExecViewFocusBlock');
    dom.tempExecViewFocusZone = dom.tempExecViewFocusBlock
      ? dom.tempExecViewFocusBlock.querySelector('[data-temp-focus-zone]')
      : null;
    dom.tempExecOverviewSection = document.querySelector('[data-section-id="tempexec-overview"]');
    dom.tempExecViewSection = document.querySelector('[data-section-id="tempexec-view"]');
    dom.autoClarifySection = document.querySelector('[data-section-id="auto-clarify"]');
    dom.flowNav = document.getElementById('flowNav');
    dom.tempexecFlowNav = document.getElementById('tempexecFlowNav');
    dom.flowNavSteps = document.querySelectorAll('#flowNav .step');
    dom.tabButtons = document.querySelectorAll('[data-tab-btn]');
    dom.tabSections = document.querySelectorAll('[data-tab-section]');
    dom.tabGroups = document.querySelectorAll('.tab-group');
    dom.tabGroupButtons = document.querySelectorAll('.tab-group-btn');
    dom.tabSubmenus = document.querySelectorAll('.tab-submenu');
    dom.jumpLinks = document.querySelectorAll('[data-jump]');
    dom.autoMissingSectionSelector = '[data-section-id="auto-cases-missing"]';
    var reviewResultEl = dom.reviewResultEl;
    var cleanedTextEl = dom.cleanedTextEl;
    var compareResultEl = dom.compareResultEl;
    var splitResultEl = dom.splitResultEl;
    var casesCompareResultEl = dom.casesCompareResultEl;
    debugNodes = {
      raw: { textarea: dom.rawText, status: dom.parseStatus, label: '原始需求', tag: 'RAW' },
      cleaned: { textarea: dom.cleanedTextEl, status: dom.cleanStatus, label: '清洗结果', tag: 'CLEANED' },
      split: { textarea: dom.splitResultEl, status: dom.splitStatus, label: '拆分结果', tag: 'SPLIT' },
      cases: { textarea: dom.caseTextEl, status: dom.caseStatus, label: '测试用例', tag: 'CASES' },
    };

    function ensureMediaContextHintElement(hintId, anchorEl) {
      if (typeof document === 'undefined' || !anchorEl) return null;
      var el = document.getElementById(hintId);
      if (el) return el;
      el = document.createElement('p');
      el.id = hintId;
      el.className = 'hint media-context-hint';
      if (anchorEl.parentNode) {
        if (anchorEl.nextSibling) {
          anchorEl.parentNode.insertBefore(el, anchorEl.nextSibling);
        } else {
          anchorEl.parentNode.appendChild(el);
        }
      }
      return el;
    }

    function setMediaContextHint(el, text, tone) {
      if (!el) return;
      var className = 'hint media-context-hint';
      if (tone === 'warn') className += ' is-warn';
      else if (tone === 'ok') className += ' is-ok';
      el.className = className;
      el.textContent = text || '';
      el.classList.toggle('hidden', !text);
    }

    function getRequirementImageStats() {
      var stats = { total: 0, docx: 0, pasted: 0 };
      var media = state && state.requirementMedia && typeof state.requirementMedia === 'object'
        ? state.requirementMedia
        : null;
      if (!media) return stats;
      var docxList = Array.isArray(media.docxImages) ? media.docxImages : [];
      var pastedList = Array.isArray(media.pastedImages) ? media.pastedImages : [];
      stats.docx = docxList.reduce(function(sum, item) {
        return item && (item.blob || item.file) ? (sum + 1) : sum;
      }, 0);
      stats.pasted = pastedList.reduce(function(sum, item) {
        return item && (item.blob || item.file) ? (sum + 1) : sum;
      }, 0);
      stats.total = stats.docx + stats.pasted;
      return stats;
    }

    function normalizeModelCapabilityList(model) {
      if (!model || typeof model !== 'object') return [];
      var raw = model.capabilities || model.modelCapabilities || model.tags || model.multiModalTags || model.multimodalTags;
      var values = [];
      if (Array.isArray(raw)) {
        values = raw.slice();
      } else if (typeof raw === 'string') {
        values = raw.split(/[,|/、\s]+/);
      } else if (raw && typeof raw === 'object') {
        Object.keys(raw).forEach(function(key) {
          if (raw[key]) values.push(key);
        });
      }
      var seen = {};
      var normalized = [];
      values.forEach(function(item) {
        var text = String(item || '').trim();
        if (!text) return;
        var key = text.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        normalized.push(text);
      });
      return normalized;
    }

    function capabilitySupportsImage(capabilities) {
      if (!Array.isArray(capabilities) || !capabilities.length) return false;
      for (var i = 0; i < capabilities.length; i += 1) {
        var token = String(capabilities[i] || '').trim().toLowerCase();
        if (!token) continue;
        if (
          token === 'vision' || token === '视觉' ||
          token.indexOf('vision') !== -1 ||
          token.indexOf('visual') !== -1 ||
          token.indexOf('multimodal') !== -1 ||
          token.indexOf('multi-modal') !== -1 ||
          token.indexOf('multi_modal') !== -1 ||
          token.indexOf('image') !== -1 ||
          token.indexOf('图像') !== -1 ||
          token.indexOf('图片') !== -1 ||
          token.indexOf('视觉') !== -1
        ) {
          return true;
        }
      }
      return false;
    }

    function getModelDisplayName(model, fallback) {
      if (!model || typeof model !== 'object') return fallback || '未配置';
      var name = model.name || model.displayName || model.model || '';
      var text = String(name || '').trim();
      return text || (fallback || '未配置');
    }

    function resolveModelImageCapability(type, fallbackName) {
      var result = {
        configured: false,
        supportsImage: false,
        modelName: fallbackName || '未配置',
        capabilityText: '无',
      };
      if (typeof getAssignedModel !== 'function') return result;
      var model = null;
      try {
        model = getAssignedModel(type);
      } catch (err) {
        return result;
      }
      result.configured = true;
      result.modelName = getModelDisplayName(model, fallbackName);
      var capabilities = normalizeModelCapabilityList(model);
      result.supportsImage = capabilitySupportsImage(capabilities);
      result.capabilityText = capabilities.length
        ? capabilities.slice(0, 4).join('、') + (capabilities.length > 4 ? '…' : '')
        : '无';
      return result;
    }

    function buildModelCapabilitySummary(info) {
      if (!info || !info.configured) return '未配置';
      if (info.supportsImage) {
        return info.modelName + '（标签：' + info.capabilityText + '，可识别图片）';
      }
      return info.modelName + '（标签：' + info.capabilityText + '，不含视觉/多模态）';
    }

    function updateRequirementMediaContextHints() {
      var importHintEl = ensureMediaContextHintElement('mediaContextImportHint', dom.parseStatus);
      var reviewHintEl = ensureMediaContextHintElement('mediaContextReviewHint', dom.reviewStatus);
      var cleanHintEl = ensureMediaContextHintElement('mediaContextCleanHint', dom.cleanStatus);
      var autoImportHintEl = ensureMediaContextHintElement('mediaContextAutoImportHint', dom.autoRawListEl);
      if (!importHintEl && !reviewHintEl && !cleanHintEl && !autoImportHintEl) return;

      var stats = getRequirementImageStats();
      var hasImages = stats.total > 0;
      var reviewInfo = resolveModelImageCapability('review', '需求评审模型');
      var cleanInfo = resolveModelImageCapability('clean', '需求清洗模型');
      var imageLabel = hasImages
        ? ('图片上下文：' + stats.total + ' 张（文档 ' + stats.docx + '，粘贴 ' + stats.pasted + '）')
        : '图片上下文：0 张（当前仅文本）';

      var importNoImageCapability = hasImages && !reviewInfo.supportsImage && !cleanInfo.supportsImage;
      var importTone = importNoImageCapability ? 'warn' : (hasImages ? 'ok' : '');
      var importText = imageLabel
        + '。评审模型：' + buildModelCapabilitySummary(reviewInfo)
        + '；清洗模型：' + buildModelCapabilitySummary(cleanInfo) + '。';
      if (importNoImageCapability) {
        importText += ' 当前两者未配置或标签未声明视觉/多模态，执行时可能仅基于文本。';
      }
      setMediaContextHint(importHintEl, importText, importTone);
      if (autoImportHintEl) {
        var autoImportText = imageLabel
          + '。一键执行后续步骤模型能力：评审模型：' + buildModelCapabilitySummary(reviewInfo)
          + '；清洗模型：' + buildModelCapabilitySummary(cleanInfo) + '。';
        if (importNoImageCapability) {
          autoImportText += ' 当前两者未配置或标签未声明视觉/多模态，后续步骤可能仅基于文本。';
        } else if (hasImages) {
          autoImportText += ' 若继续执行需求评审/清洗，将按模型能力尝试识别图片内容。';
        } else {
          autoImportText += ' 当前不含图片，后续步骤将仅基于文本。';
        }
        setMediaContextHint(autoImportHintEl, autoImportText, importTone);
      }

      var reviewTone = '';
      var reviewText = imageLabel + '。当前评审模型：' + buildModelCapabilitySummary(reviewInfo) + '。';
      if (hasImages) {
        if (!reviewInfo.configured) {
          reviewText += ' 请先在功能指派中配置需求评审模型。';
          reviewTone = 'warn';
        } else if (reviewInfo.supportsImage) {
          reviewText += ' 本次评审将尝试携带并识别图片内容。';
          reviewTone = 'ok';
        } else {
          reviewText += ' 当前模型标签未声明视觉/多模态，本次可能仅使用文本。';
          reviewTone = 'warn';
        }
      } else {
        reviewText += ' 当前不含图片，本次仅基于文本评审。';
      }
      setMediaContextHint(reviewHintEl, reviewText, reviewTone);

      var cleanTone = '';
      var cleanText = imageLabel + '。当前清洗模型：' + buildModelCapabilitySummary(cleanInfo) + '。';
      if (hasImages) {
        if (!cleanInfo.configured) {
          cleanText += ' 请先在功能指派中配置需求清洗模型。';
          cleanTone = 'warn';
        } else if (cleanInfo.supportsImage) {
          cleanText += ' 本次清洗将尝试携带并识别图片内容。';
          cleanTone = 'ok';
        } else {
          cleanText += ' 当前模型标签未声明视觉/多模态，本次可能仅使用文本。';
          cleanTone = 'warn';
        }
      } else {
        cleanText += ' 当前不含图片，本次仅基于文本清洗。';
      }
      setMediaContextHint(cleanHintEl, cleanText, cleanTone);
    }

    const settingsModule = initModule('settings', {
      state,
      config: {
        defaultSettings,
        defaultTempExecColumns,
        defaultTempExecPageSize,
        defaultCaseViewFontSize,
        minCaseViewFontSize,
        maxCaseViewFontSize,
        settingsKey,
        minModelTimeoutSec,
        maxModelTimeoutSec,
      },
      utils: appUtils,
      setStatus,
      clampTimeoutSeconds,
      clampTempExecPageSize: function(value) { return api.clampTempExecPageSize(value); },
      renderTempExecView: proxyApi('renderTempExecView'),
      applyTempExecPageSize: function(value) { return api.applyTempExecPageSize(value); },
    });
    const {
      loadSettings,
      persistSettings,
      renderSettingsUI,
      renderTempExecColumnSettings,
      saveTimeoutSetting,
      saveFeishuWebhookConfig,
      testFeishuWebhookConfig,
      saveTempExecColumnsSetting,
      getFeishuWebhookUrl,
      getFeishuMentionId,
      postFeishuMessage,
      ensureTempExecColumns,
    } = settingsModule || {
      loadSettings: function noopLoad() {},
      persistSettings: function noopPersist() {},
      renderSettingsUI: function noopRender() {},
      renderTempExecColumnSettings: function noopRenderCols() {},
      saveTimeoutSetting: function noopSaveTimeout() {},
      saveFeishuWebhookConfig: function noopSaveFeishu() {},
      testFeishuWebhookConfig: function noopTestFeishu() {},
      saveTempExecColumnsSetting: function noopSaveCols() {},
      getFeishuWebhookUrl: function noopGetWebhook() { return ''; },
      getFeishuMentionId: function noopGetMention() { return ''; },
      postFeishuMessage: async function noopPost() { return { ok: false, reason: 'settings module missing' }; },
      ensureTempExecColumns: function fallbackEnsure() { return { ...defaultTempExecColumns }; },
    };
    loadSettings();
    markInitStage('settings-loaded');
    initModule('memoPad', {
      state: state,
      dom: dom,
      utils: appUtils,
      confirmDrawer: window.app && window.app.confirmDrawer ? window.app.confirmDrawer : null,
      persistSettings: persistSettings,
    });

    const defaultScrollOffset = 200;
    const scrollElementIntoView = function(el, behavior, offset) {
      if (!el) return;
      appUtils.scrollElementIntoView(el, behavior || 'smooth', offset === undefined ? defaultScrollOffset : offset);
    };

    const modelsModule = window.app.models && typeof window.app.models.init === 'function'
      ? window.app.models.init({
        state,
        config: {
          defaultPrompts,
          defaultMaxTokens,
          legacyCleanPrompt,
          legacyCaseGenPrompt,
          legacyCasesPrompt,
          providerDefaults,
          modelsKey,
          assignmentKey,
          legacyCleanKey,
          legacyCompareKey,
        },
        setStatus,
      })
      : null;

    const {
      loadModels,
      saveModels,
      renderModels,
      resetModelForm,
      fillModelForm,
      deleteModel,
      renderAssignmentsSelect,
      updateAssignmentStatuses,
      loadAssignments,
      saveAssignments,
      updateReasoningVisibility,
      getReasoningForType,
      getTemperatureForType,
      getAssignedModel,
      testModel,
      saveModel,
    } = modelsModule || {};
    markInitStage('models-module-ready');

    const parseSplitModules = function() {
      if (splitCore && splitCore.parseSplitModules && dom.splitResultEl) {
        return splitCore.parseSplitModules(dom.splitResultEl.value, setRequirementLabel);
      }
      return [];
    };

    const splitRuntime = splitCore && splitCore.createSplitRuntime
      ? splitCore.createSplitRuntime({
        state,
        config: { defaultPrompts },
        dom: dom,
        handlers: {
          setStatus,
          setStepInProgress,
          clearStepInProgress,
          updateFlowStatus: proxyApi('updateFlowStatus'),
          hasImportedCases: proxyApi('hasImportedCases'),
          getImportedCaseObjects: proxyApi('getImportedCaseObjects'),
          openConfirmDrawer: appUtils.openConfirmDrawer,
          scrollToSection: proxyApi('scrollToSection'),
          switchTab: function(name) { return switchTab(name); },
          ensureRequirementLabel,
          getCleanedTextForModel: proxyApi('getCleanedTextForModel'),
          getAssignedModel,
          getReasoningForType,
          getTemperatureForType,
          callModelWithConfig,
          updateModelTiming,
          parseSplitModules: function() { return parseSplitModules(); },
          refreshMissingSmartFillButton: proxyApi('refreshMissingSmartFillButton'),
          renderCaseGenProgressBoard: proxyApi('renderCaseGenProgressBoard'),
          syncSplitView: proxyApi('syncSplitView'),
        },
      })
      : null;
    if (splitRuntime && splitRuntime.splitModules) api.splitModules = splitRuntime.splitModules;
    if (splitRuntime && splitRuntime.ensureCaseGenModulesFromSplit) api.ensureCaseGenModulesFromSplit = splitRuntime.ensureCaseGenModulesFromSplit;
    if (splitRuntime && splitRuntime.applySplitResultText) {
      api.applySplitResultText = splitRuntime.applySplitResultText;
      window.app.applySplitResultText = splitRuntime.applySplitResultText;
    }
    window.app.splitModules = api.splitModules;
    window.app.ensureCaseGenModulesFromSplit = api.ensureCaseGenModulesFromSplit;
    window.app.parseSplitModules = parseSplitModules;

    const flowCore = window.app.flowCore && typeof window.app.flowCore.init === 'function'
      ? window.app.flowCore.init({
        state,
        handlers: {
          switchTab: function(name) { return switchTab(name); },
          scrollElementIntoView,
          hasCaseSource: function() { return api.hasCaseSource(); },
        },
      })
      : null;
    const renderFlowStatus = flowCore && flowCore.updateFlowStatus ? flowCore.updateFlowStatus : function noopFlowStatus() {};
    function updateFlowStatusWithValidation() {
      validateFlowData();
      renderFlowStatus();
      updateRequirementMediaContextHints();
      requestPersistWorkflowState();
    }
    if (flowCore && flowCore.updateFlowStatus) api.updateFlowStatus = updateFlowStatusWithValidation;
    if (flowCore && flowCore.scrollToSection) api.scrollToSection = flowCore.scrollToSection;
    if (flowCore && flowCore.refreshExportCaseGenButton) api.refreshExportCaseGenButton = flowCore.refreshExportCaseGenButton;
    if (flowCore && flowCore.setCaseViewHint) api.setCaseViewHint = flowCore.setCaseViewHint;

    const assignModule = window.app.assign && typeof window.app.assign.init === 'function'
      ? window.app.assign.init({
        state,
        utils: appUtils,
        debounce: appUtils.debounce,
        setStatus,
        updateAssignmentStatuses,
        updateReasoningVisibility,
        renderAssignmentsSelect,
        saveAssignments,
        testModel,
        updateFlowStatus: proxyApi('updateFlowStatus'),
      })
      : null;
    const compareCore = window.app && window.app.compareCore && typeof window.app.compareCore.init === 'function'
      ? window.app.compareCore.init({
        stripCodeFence,
        extractJsonPayload,
        unwrapRequirementPayload,
        state,
        setStatus,
        config: { defaultPrompts },
        utils: { escapeHtml },
        handlers: {
          updateAutoMissingCard: proxyApi('updateAutoMissingCard'),
          ensureRequirementLabel,
          getSafeRequirementSlug,
          downloadText,
          wrapTextWithRequirement,
          promptRequirementLabel,
          setRequirementLabel,
          updateFlowStatus: proxyApi('updateFlowStatus'),
          wrapDataWithRequirement,
          extractRequirementLabelFromText,
          resetAutoCompareUserInputs: proxyApi('resetAutoCompareUserInputs'),
          syncAutoCompareStatus: proxyApi('syncAutoCompareStatus'),
          getCleanedTextForModel: proxyApi('getCleanedTextForModel'),
          getAssignedModel,
          getReasoningForType,
          getTemperatureForType,
          callModelWithConfig,
          updateModelTiming,
          formatJsonOrText,
          buildCasesComparePayload: proxyApi('buildCasesComparePayload'),
          parseSplitModules,
          setStepInProgress,
          clearStepInProgress,
          runConcurrent,
          ensureCaseGenModulesFromSplit: api.ensureCaseGenModulesFromSplit,
          persistWorkflowState: requestPersistWorkflowState,
          persistWorkflowStateNow: requestPersistWorkflowStateNow,
        },
      })
      : null;
    const compareApi = compareCore || {};
    const clampCoveragePercent = compareApi.clampCoveragePercent || function(value) {
      const num = Number(value);
      if (!Number.isFinite(num)) return null;
      return Math.max(0, Math.min(100, Math.round(num)));
    };
    const buildSingleModulePayload = compareApi.buildSingleModulePayload || function(module, idx) {
      return {
        json: '',
        title: module && module.title ? module.title : `模块${idx + 1}`,
      };
    };
    const aggregateModuleCompareResults = compareApi.aggregateModuleCompareResults || function() { return { coverage: null, missing: [], extra: [] }; };
    const parseModuleCompareResponse = compareApi.parseModuleCompareResponse || function(content, moduleTitle) {
      const payload = extractJsonPayload(stripCodeFence(content));
      const data = payload ? JSON.parse(payload) : {};
      return { module: moduleTitle, coverage: clampCoveragePercent(data.coverage), missing: data.missing || [], extra: data.extra || [] };
    };
    const formatMissingRequirement = compareApi.formatMissingRequirement || function(item) {
      if (item === undefined || item === null) return '-';
      if (typeof item === 'string') return item.trim() || '-';
      return String(item);
    };
    const isCoveragePayload = compareApi.isCoveragePayload || function(data) {
      return !!(data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'coverage'));
    };
    const parseMissingModules = compareApi.parseMissingModules || api.emptyArr;
    const buildMissingRows = compareApi.buildMissingRows || api.emptyArr;
    const pickMissingSelections = compareApi.pickMissingSelections || api.emptyArr;
    assignIfPresent(api, compareApi, [
      'refreshMissingSmartFillButton',
      'updateMissingView',
      'toggleMissingView',
      'refreshMissingSelectionUI',
      'handleMissingSelectionChange',
      'handleMissingSelectAll',
      'copyMissingJson',
      'exportCasesCoverage',
      'importCasesCoverage',
      'exportCompareResult',
      'importCompareResult',
      'compareCoverage',
      'compareCasesCoverage',
      'extractCompareResultData',
      'extractCoverageFromCompareResult',
    ]);

    const debugCore = window.app && window.app.debugCore && typeof window.app.debugCore.init === 'function'
      ? window.app.debugCore.init({
        state,
        debugNodes,
        dom,
        skipAutoBind: true,
        handlers: {
          setStatus,
          extractRequirementLabelFromText,
          promptRequirementLabel,
          getRequirementLabel,
          setRequirementLabel,
          stripRequirementHeader,
          wrapTextWithRequirement,
          renderAutoRawInfo: proxyApi('renderAutoRawInfo'),
          renderCleanView: proxyApi('renderCleanView'),
          renderCleanRawView: proxyApi('renderCleanRawView'),
          renderCaseGeneration: proxyApi('renderCaseGeneration'),
          renderCaseGenProgressBoard: proxyApi('renderCaseGenProgressBoard'),
          refreshMissingSmartFillButton: proxyApi('refreshMissingSmartFillButton'),
          syncCaseTextWithImports: proxyApi('syncCaseTextWithImports'),
          renderImportedCaseList: proxyApi('renderImportedCaseList'),
          resetImportedCaseView: proxyApi('resetImportedCaseView'),
          setCaseViewHint: proxyApi('setCaseViewHint'),
          updateFlowStatus: proxyApi('updateFlowStatus'),
        },
        utils: { downloadText, stripCodeFence },
      })
      : null;
    if (debugCore) {
      assignIfPresent(api, debugCore, ['saveDebugText', 'importDebugText', 'bindDebugControls']);
      api.bindDebugControls('raw', dom.saveRawDebugBtn, dom.importRawDebugBtn, dom.rawDebugFileInput);
      api.bindDebugControls('cleaned', dom.saveCleanDebugBtn, dom.importCleanDebugBtn, dom.cleanDebugFileInput);
      api.bindDebugControls('split', dom.saveSplitDebugBtn, dom.importSplitDebugBtn, dom.splitDebugFileInput);
      api.bindDebugControls('cases', dom.saveCaseDebugBtn, dom.importCaseDebugBtn, dom.caseDebugFileInput);
    }
    const reviewCoreModule = window.app.reviewCore && typeof window.app.reviewCore.init === 'function'
      ? window.app.reviewCore.init({
        state,
        defaultPrompts,
        setStatus,
        escapeHtml,
        escapeHtmlPreserve,
        dom,
        handlers: {
          ensureRequirementLabel,
          getAssignedModel,
          getReasoningForType,
          getTemperatureForType,
          callModelWithConfig,
          callModelWithContent,
          updateModelTiming,
          wrapTextWithRequirement,
          formatJsonOrText,
          stripCodeFence,
          unwrapRequirementPayload,
          extractRequirementLabelFromText,
          setRequirementLabel,
          promptRequirementLabel,
          stripRequirementHeader,
          isCoveragePayload,
          downloadText,
          getSafeRequirementSlug,
          updateFlowStatus,
          setStepInProgress,
          clearStepInProgress,
          persistWorkflowState: requestPersistWorkflowState,
        },
      })
      : null;
    assignIfPresent(api, reviewCoreModule, [
      'reviewRequirements',
      'copyReviewResult',
      'exportReviewResult',
      'importReviewResult',
      'toggleReviewView',
      'confirmClarifications',
      'handleClarifyClickEvent',
      'handleClarifyChangeEvent',
      'handleClarifyInputEvent',
      'updateAutoClarifyVisibility',
      'renderAutoClarifyView',
      'openAutoClarifyPanel',
      'closeAutoClarifyPanel',
      'toggleAutoClarifyPanel',
      'handleAutoClarifyConfirm',
      'waitForAutoClarification',
      'syncReviewViewFromResult',
      'buildReviewClarificationContext',
    ]);
    const reviewModule = window.app.review && typeof window.app.review.init === 'function'
      ? window.app.review.init({
        state,
        handlers: {
          reviewRequirements: proxyApi('reviewRequirements'),
          copyReviewResult: proxyApi('copyReviewResult'),
          exportReviewResult: proxyApi('exportReviewResult'),
          importReviewResult: proxyApi('importReviewResult'),
          toggleReviewView: proxyApi('toggleReviewView'),
          confirmClarifications: proxyApi('confirmClarifications'),
          handleClarifyClickEvent: proxyApi('handleClarifyClickEvent'),
          handleClarifyChangeEvent: proxyApi('handleClarifyChangeEvent'),
          handleClarifyInputEvent: proxyApi('handleClarifyInputEvent'),
          updateAutoClarifyVisibility: proxyApi('updateAutoClarifyVisibility'),
          toggleAutoClarifyPanel: proxyApi('toggleAutoClarifyPanel'),
          handleAutoClarifyConfirm: proxyApi('handleAutoClarifyConfirm'),
        },
        dom,
      })
      : null;
    [dom.reviewTimingEl, dom.cleanTimingEl, dom.compareTimingEl, dom.splitTimingEl, dom.casesTimingEl, dom.caseGenTimingEl].forEach(el => updateModelTiming(el));

    if (dom.exportCaseGenBtn) dom.exportCaseGenBtn.disabled = true;

    const casesCore = window.app && window.app.casesCore && typeof window.app.casesCore.init === 'function'
      ? window.app.casesCore.init({
        deps: { extractJsonObjects },
        state,
        dom,
        handlers: {
          setStatus,
          setCaseViewHint: proxyApi('setCaseViewHint'),
          updateFlowStatus: proxyApi('updateFlowStatus'),
          refreshImportedCaseView: proxyApi('refreshImportedCaseView'),
          renderCaseTable: proxyApi('renderCaseTable'),
          setStepInProgress,
          clearStepInProgress,
          ensureRequirementLabel,
          parseXmindFile: function(file) {
            const parser = typeof parseXmindFile === 'function'
              ? parseXmindFile
              : (window.app && window.app.xmindCore && typeof window.app.xmindCore.parseXmindFile === 'function'
                ? window.app.xmindCore.parseXmindFile
                : null);
            return parser ? parser(file) : Promise.resolve({ text: '', list: [] });
          },
          extractRequirementLabelFromText,
          setRequirementLabel,
        },
        utils: { escapeHtml },
      })
      : null;
    if (casesCore) {
      window.app.casesCoreApi = casesCore;
    }
    const parseCaseList = casesCore && casesCore.parseCaseList
      ? casesCore.parseCaseList
      : function missingParseCaseList() { throw new Error('casesCore.parseCaseList 不可用'); };
    const deriveCaseListFromText = casesCore && casesCore.deriveCaseListFromText
      ? casesCore.deriveCaseListFromText
      : function missingDeriveCaseList() { throw new Error('casesCore.deriveCaseListFromText 不可用'); };
    assignIfPresent(api, casesCore, [
      'renderImportedCaseList',
      'addImportedCase',
      'removeImportedCase',
      'hasImportedCases',
      'hasCaseSource',
      'getCombinedCaseList',
      'getCombinedCaseText',
      'getImportedCaseObjects',
      'syncCaseTextWithImports',
      'syncImportedCaseStatus',
      'resetImportedCaseView',
      'refreshImportedCaseView',
      'toggleImportedCaseView',
      'buildCasesComparePayload',
      'importCaseFiles',
    ]);
    if (api.importCaseFiles) {
      api.handleCaseFiles = function handleCaseFilesProxy() {
        return api.importCaseFiles.apply(null, arguments);
      };
    }

    const generateTempExecId = appUtils.generateTempExecId;
    const generateTempVersionId = appUtils.generateTempVersionId;
    const normalizeTempExecName = appUtils.normalizeTempExecName;
    const stringifyCaseField = appUtils.stringifyCaseField;
    const buildMissingReminderKeywords = appUtils.buildMissingReminderKeywords;
    const normalizeMissingReminderMatchConfig = appUtils.normalizeMissingReminderMatchConfig;
    const removePendingTempExecByName = appUtils.removePendingTempExecByName;

    const ensureTempExecReplacement = function ensureTempExecReplacementProxy(entry, pendingList) {
      if (appUtils.ensureTempExecReplacement) {
        return appUtils.ensureTempExecReplacement(entry, {
          existingList: state.tempExecFiles,
          pendingList: pendingList || [],
          normalizeName: normalizeTempExecName,
          removeExisting: proxyApi('removeTempExecFile'),
          removePending: removePendingTempExecByName,
          confirmFn: window.confirm,
        });
      }
      const normalized = normalizeTempExecName(entry && entry.name);
      const pending = pendingList || [];
      const duplicates = state.tempExecFiles.filter(file => normalizeTempExecName(file && file.name) === normalized);
      const pendingDuplicates = pending.filter(item => normalizeTempExecName(item && item.name) === normalized);
      if (duplicates.length || pendingDuplicates.length) {
        const confirmMsg = `检测到名称为【${entry ? entry.name : ''}】的用例已存在，替换将清除原有执行结果，是否继续？`;
        if (!window.confirm(confirmMsg)) return false;
        duplicates.forEach(file => api.removeTempExecFile(file && file.id));
        removePendingTempExecByName(pending, entry && entry.name);
      }
      return true;
    };

    const autoCoreModule = window.app && window.app.autoCore && typeof window.app.autoCore.init === 'function'
      ? window.app.autoCore.init({
        state,
        dom,
        handlers: {
          setStatus,
          setStepWaiting,
          clearStepWaiting,
          clearAllWaitingSteps,
          setStepFailed,
          clearStepFailed,
          clearAllFailedSteps,
          updateFlowStatus,
          parseMissingModules,
          buildMissingRows,
          pickMissingSelections,
          scrollElementIntoView,
          switchTab,
          goToCaseGeneration: proxyApi('goToCaseGeneration'),
          ensureCaseGenModulesFromSplit,
          renderCaseGeneration: proxyApi('renderCaseGeneration'),
          setCaseGenViewTab: proxyApi('setCaseGenViewTab'),
          syncLegacyCaseGenState: proxyApi('syncLegacyCaseGenState'),
          getRequirementLabel,
          getFeishuWebhookUrl,
          postFeishuMessage,
          reviewRequirements: proxyApi('reviewRequirements'),
          runCleaning: proxyApi('runCleaning'),
          compareCoverage: proxyApi('compareCoverage'),
          splitModules: proxyApi('splitModules'),
          compareCasesCoverage: proxyApi('compareCasesCoverage'),
          extractCoverageFromCompareResult: proxyApi('extractCoverageFromCompareResult'),
          extractCompareResultData: proxyApi('extractCompareResultData'),
          formatMissingRequirement,
          shouldExpectCleanJson: proxyApi('shouldExpectCleanJson'),
          hasCaseSource: proxyApi('hasCaseSource'),
          scrollToSection: proxyApi('scrollToSection'),
          renderAutoClarifyView: proxyApi('renderAutoClarifyView'),
          openAutoClarifyPanel: proxyApi('openAutoClarifyPanel'),
          waitForAutoClarification: proxyApi('waitForAutoClarification'),
          updateAutoClarifyVisibility: proxyApi('updateAutoClarifyVisibility'),
          jumpToCleanHighlightView: proxyApi('jumpToCleanHighlightView'),
          persistWorkflowState: requestPersistWorkflowState,
        },
        utils: { escapeHtml },
      })
      : null;
    assignIfPresent(api, autoCoreModule, [
      'notifyFeishuWorkflowSuccess',
      'notifyFeishuCoverageFailure',
      'notifyFeishuClarificationNeeded',
      'resetAutoMissingView',
      'refreshAutoMissingSelectionUI',
      'updateAutoMissingCard',
      'toggleAutoMissingView',
      'ensureAutoMissingViewVisible',
      'copyAutoMissingJson',
      'handleMissingSelectionChange',
      'handleMissingSelectAll',
      'smartFillMissingSuggestions',
      'resetAutoCompareMissingView',
      'resetAutoCompareUserInputs',
      'renderAutoCompareMissingView',
      'toggleAutoCompareView',
      'buildFilteredComparePayload',
      'updateAutoCompareActions',
      'syncAutoCompareStatus',
      'buildAutoWorkflowSteps',
      'executeAutoWorkflowSteps',
      'enforceAutoCoverageRequirement',
      'runAutoWorkflow',
      'runAutoWorkflowFromClean',
      'continueAutoWorkflowAfterCoverage',
      'cancelAutoWorkflow',
      'applyAutoWorkflowTaskState',
    ]);

    const autoWorkflowManager = initAutoWorkflowManager({
      getSteps: function() {
        return autoCoreModule && typeof autoCoreModule.buildAutoWorkflowSteps === 'function'
          ? autoCoreModule.buildAutoWorkflowSteps()
          : [];
      },
      canRun: function() {
        return autoCoreModule && typeof autoCoreModule.isAutoWorkflowReady === 'function'
          ? autoCoreModule.isAutoWorkflowReady()
          : true;
      },
      persistWorkflowStateNow: requestPersistWorkflowStateNow,
      getLastModelError: getLastModelError,
      clearLastModelError: clearLastModelError,
      abortModelRequests: abortAllModelRequests,
    });
    window.app.autoWorkflowManager = autoWorkflowManager;

    function syncAutoWorkflowTaskState(task) {
      if (!autoCoreModule || typeof autoCoreModule.applyAutoWorkflowTaskState !== 'function') return;
      autoCoreModule.applyAutoWorkflowTaskState(task || null);
    }

    function resumeAutoWorkflowTaskWhenReady() {
      if (!autoWorkflowManager || typeof autoWorkflowManager.resumeTask !== 'function') return;
      var attempts = 0;
      var maxAttempts = 40;
      function attemptResume() {
        attempts += 1;
        if (window.app && window.app._inited === true) {
          if (typeof loadModels === 'function') loadModels();
          if (typeof loadAssignments === 'function') loadAssignments();
          autoWorkflowManager.resumeTask({ force: true });
          syncAutoWorkflowTaskState(autoWorkflowManager.getTask ? autoWorkflowManager.getTask() : null);
          return;
        }
        if (attempts < maxAttempts) {
          setTimeout(attemptResume, 200);
        }
      }
      attemptResume();
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('auto-workflow-task', function(e) {
        var detail = e && e.detail ? e.detail : null;
        syncAutoWorkflowTaskState(detail ? detail.task : null);
      });
    }
    resumeAutoWorkflowTaskWhenReady();
    const casesGenCoreModule = window.app && window.app.casesGenCore && typeof window.app.casesGenCore.init === 'function'
      ? window.app.casesGenCore.init({
        state,
        dom,
        setStatus,
        utils: {
          escapeHtml,
          escapeHtmlPreserve,
          stringifyCaseField,
        },
        handlers: {
          downloadText,
          downloadBlob,
          stripCodeFence,
          unwrapRequirementPayload,
          extractRequirementLabelFromText,
          promptRequirementLabel,
          setRequirementLabel,
          ensureRequirementLabel,
          getRequirementLabel,
          getCleanedTextForModel: proxyApi('getCleanedTextForModel'),
          getAssignedModel,
          getReasoningForType,
          getTemperatureForType,
          callModelWithConfig,
          updateModelTiming,
          runConcurrent,
          hasImportedCases: proxyApi('hasImportedCases'),
          getImportedCaseObjects: proxyApi('getImportedCaseObjects'),
          addImportedCase: proxyApi('addImportedCase'),
          renderImportedCaseList: proxyApi('renderImportedCaseList'),
          refreshImportedCaseView: proxyApi('refreshImportedCaseView'),
          syncCaseTextWithImports: proxyApi('syncCaseTextWithImports'),
          getTempExecFiles: function() { return state.tempExecFiles || []; },
          normalizeTempExecCases: function(list, fileId) {
            if (tempExecApi && typeof tempExecApi.normalizeTempExecCases === 'function') {
              return tempExecApi.normalizeTempExecCases(list, fileId);
            }
            return list;
          },
          deriveCaseListFromText,
          buildXmindPackageFromCases: function() {
            const impl = window.app && window.app.xmindCore && window.app.xmindCore.buildXmindPackageFromCases
              ? window.app.xmindCore.buildXmindPackageFromCases
              : (typeof buildXmindPackageFromCases === 'function' ? buildXmindPackageFromCases : null);
            if (!impl) return null;
            return impl.apply(null, arguments);
          },
          createTempExecFile: proxyApi('createTempExecFile'),
          ensureTempExecReplacement,
          syncTempExecFocus: proxyApi('syncTempExecFocus'),
          persistTempExecState: proxyApi('persistTempExecState'),
          setTempExecActive: proxyApi('setTempExecActive'),
          renderTempExecView: proxyApi('renderTempExecView'),
          switchTab,
          scrollElementIntoView,
          renderCaseGenProgressBoard: proxyApi('renderCaseGenProgressBoard'),
          renderCaseModuleProgress: proxyApi('renderCaseModuleProgress'),
          updateCaseProgressView: function(moduleId) { return api.updateCaseProgressView(moduleId); },
          clearCaseProgress: function(moduleId) { return api.clearCaseProgress(moduleId); },
          initCaseProgress: function(moduleId, groups) { return api.initCaseProgress(moduleId, groups); },
          setCaseProgressGroupState: function(moduleId, idx, stateVal) { return api.setCaseProgressGroupState(moduleId, idx, stateVal); },
          setCaseProgressStep: function(moduleId, step, stateVal) { return api.setCaseProgressStep(moduleId, step, stateVal); },
          markAllCaseProgressGroups: function(moduleId, stateVal) { return api.markAllCaseProgressGroups(moduleId, stateVal); },
          setCaseModuleRunning: function(moduleId, running) { return api.setCaseModuleRunning(moduleId, running); },
          isCaseModuleRunning: function(moduleId) { return api.isCaseModuleRunning(moduleId); },
          refreshExportCaseGenButton: proxyApi('refreshExportCaseGenButton'),
          setCaseViewHint: proxyApi('setCaseViewHint'),
          parseCaseList,
          extractJsonObjects,
          persistWorkflowState: requestPersistWorkflowState,
        },
        config: { defaultPrompts },
        sanitizeCasesForExport,
        wrapDataWithRequirement,
        getSafeRequirementSlug,
        normalizeRequirementName,
        formatCompactTimestamp,
      })
      : null;
    assignIfPresent(api, casesGenCoreModule, [
      'renderCaseGeneration',
      'renderCaseTable',
      'parseGeneratedCases',
      'generateCasesForModule',
      'generateAllCaseGenModules',
      'generateSuggestedCaseGenModules',
      'topUpCasesForModule',
      'topUpAllCaseGenModules',
      'exportCaseGenerationResults',
      'exportSelectedModulesToXmind',
      'exportModuleCases',
      'importModuleCases',
      'transferModuleToTempExec',
      'clearModuleCases',
      'toggleCaseView',
      'openXmindMirrorCaseView',
      'handleCaseSelectionChange',
      'handleCaseSelectAll',
      'handleCaseSelectAllModules',
      'exportSelectedCases',
      'exportSelectedCasesToXmind',
      'refreshCaseSelectionUI',
      'updateSupplementButtons',
      'refreshAppendExistingButton',
      'refreshCaseGenBatchButtons',
      'ensureCaseGenSettings',
      'setCaseGenSettingValue',
      'syncCaseGenSpecialOptionsState',
      'setCaseGenViewTab',
      'setCaseGenStoreMode',
      'openCaseGenBatchActionDrawer',
      'openCaseGenModuleGenerateDrawer',
      'openCaseGenSettingsDrawer',
      'getCaseGenPromptComponents',
      'buildCaseGenPrompt',
      'buildModuleCases',
      'buildModuleTopup',
      'commitModuleCases',
      'snapshotModuleCases',
      'rollbackModuleCases',
      'snapshotAllCaseGenState',
      'rollbackAllCaseGenState',
      'getLatestCaseGenOperationSnapshot',
      'discardCaseGenOperationSnapshot',
      'rollbackCaseGenOperationSnapshot',
      'syncLegacyCaseGenState',
      'restoreLegacyCaseGenState',
      'getCaseListForModule',
      'setCaseGenDbStoreNewAction',
      'clearCaseGenDbStoreNewActionError',
      'openCaseGenDbStoreNewDrawer',
      'openCaseGenDbStoreAppendDrawer',
      'openCaseGenDbStoreNewDrawerWithItems',
      'openCaseGenDbStoreAppendDrawerWithItems',
      'openCaseGenAllView',
      'refreshExportCaseGenXmindButton',
      'renderAppendTargetOptions',
    ]);

    let tempExecApi = {};
    const getCaseExecutionDisplayProxy = function(file, item) {
      if (tempExecApi && typeof tempExecApi.getCaseExecutionDisplay === 'function') {
        return tempExecApi.getCaseExecutionDisplay(file, item);
      }
      return { label: '' };
    };

    const xmindCore = window.app && window.app.xmindCore && typeof window.app.xmindCore.init === 'function'
      ? window.app.xmindCore.init({
        formatCompactTimestamp,
        normalizeRequirementName,
        getRequirementLabel,
        getCaseExecutionDisplay: getCaseExecutionDisplayProxy,
        deriveCaseListFromText,
        JSZip: window.JSZip,
      })
      : null;
    const xmindMarkdownExportCore = window.app && window.app.xmindMarkdownExportCore && typeof window.app.xmindMarkdownExportCore.init === 'function'
      ? window.app.xmindMarkdownExportCore.init({
        formatCompactTimestamp,
        normalizeRequirementName,
        getSafeFileBaseName: xmindCore && xmindCore.getSafeFileBaseName
          ? xmindCore.getSafeFileBaseName
          : null,
      })
      : null;
    const xmindCaseDedupeCore = window.app && window.app.xmindCaseDedupeCore && typeof window.app.xmindCaseDedupeCore.init === 'function'
      ? window.app.xmindCaseDedupeCore.init({})
      : null;
    const xmindRequirementCoverageCore = window.app && window.app.xmindRequirementCoverageCore && typeof window.app.xmindRequirementCoverageCore.init === 'function'
      ? window.app.xmindRequirementCoverageCore.init({})
      : null;
    const mindElixirCore = window.app && window.app.mindElixirCore && typeof window.app.mindElixirCore.init === 'function'
      ? window.app.mindElixirCore.init({
        xmindApi: xmindCore,
        renderPolicyCore: window.app.xmindRenderPolicyCore || null,
      })
      : null;
    const formatXmindNodeValue = xmindCore && xmindCore.formatXmindNodeValue
      ? xmindCore.formatXmindNodeValue
      : function formatXmindNodeValueFallback(val) { return (val || '').toString(); };
    const buildCaseFieldsForXmind = xmindCore && xmindCore.buildCaseFieldsForXmind
      ? xmindCore.buildCaseFieldsForXmind
      : function buildCaseFieldsForXmindFallback(item, fallbackModule) {
        return [(item && item.module) || fallbackModule || '模块'];
      };
    const buildXmindPackageFromCases = xmindCore && xmindCore.buildXmindPackageFromCases
      ? xmindCore.buildXmindPackageFromCases
      : null;
    if (xmindCore) {
      window.app.xmindCoreApi = xmindCore;
    }
    if (xmindMarkdownExportCore) {
      window.app.xmindMarkdownExportCoreApi = xmindMarkdownExportCore;
    }
    if (xmindCaseDedupeCore) {
      window.app.xmindCaseDedupeCoreApi = xmindCaseDedupeCore;
    }
    if (xmindRequirementCoverageCore) {
      window.app.xmindRequirementCoverageCoreApi = xmindRequirementCoverageCore;
    }
    if (mindElixirCore) {
      window.app.mindElixirCoreApi = mindElixirCore;
    }
    const resolveAssetUrl = function(path) {
      if (!path) return '';
      try {
        return new URL(path, window.location.href).href;
      } catch (err) {
        return String(path);
      }
    };
    const ensureStylesheetOnce = function(path, marker) {
      if (typeof document === 'undefined' || !document.querySelector) return;
      var href = resolveAssetUrl(path);
      if (!href) return;
      var key = marker ? String(marker) : href;
      var exists = document.querySelector('link[data-tap-asset="' + key + '"]');
      if (!exists) {
        var list = document.querySelectorAll('link[rel="stylesheet"][href]');
        Array.prototype.some.call(list || [], function(node) {
          if (!node || !node.href) return false;
          if (String(node.href) !== href) return false;
          exists = node;
          return true;
        });
      }
      if (exists) {
        if (exists.setAttribute) exists.setAttribute('data-tap-asset', key);
        return;
      }
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-tap-asset', key);
      var head = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
      if (head && head.appendChild) head.appendChild(link);
    };
    const loadLocalScriptOnce = function(path, readyCheck) {
      if (typeof readyCheck === 'function' && readyCheck()) {
        return Promise.resolve();
      }
      if (typeof document === 'undefined' || !document.createElement) {
        return Promise.reject(new Error('当前环境不支持动态加载脚本'));
      }
      window.app = window.app || {};
      if (!window.app.__tapScriptLoaders || typeof window.app.__tapScriptLoaders !== 'object') {
        window.app.__tapScriptLoaders = {};
      }
      var src = resolveAssetUrl(path);
      if (!src) return Promise.reject(new Error('脚本地址无效'));
      if (window.app.__tapScriptLoaders[src]) {
        return window.app.__tapScriptLoaders[src];
      }
      window.app.__tapScriptLoaders[src] = new Promise(function(resolve, reject) {
        var settled = false;
        var timeoutId = 0;
        var pollId = 0;
        function cleanup() {
          if (timeoutId) clearTimeout(timeoutId);
          if (pollId) clearInterval(pollId);
        }
        function finish(err) {
          if (settled) return;
          settled = true;
          cleanup();
          if (err) reject(err);
          else resolve();
        }
        function isReady() {
          return typeof readyCheck === 'function' ? readyCheck() : true;
        }
        if (isReady()) {
          finish();
          return;
        }
        var script = document.createElement('script');
        script.src = src;
        script.defer = true;
        script.async = false;
        script.setAttribute('data-tap-dynamic-script', src);
        script.onload = function() {
          if (isReady()) {
            finish();
            return;
          }
          timeoutId = setTimeout(function() {
            if (isReady()) finish();
            else finish(new Error('脚本已加载但依赖仍未就绪：' + path));
          }, 60);
        };
        script.onerror = function() {
          finish(new Error('脚本加载失败：' + path));
        };
        pollId = setInterval(function() {
          if (isReady()) finish();
        }, 40);
        timeoutId = setTimeout(function() {
          if (isReady()) {
            finish();
            return;
          }
          finish(new Error('脚本加载超时：' + path));
        }, 4000);
        var parent = document.body || document.head || document.documentElement;
        if (!parent || !parent.appendChild) {
          finish(new Error('页面容器不可用，无法加载脚本：' + path));
          return;
        }
        parent.appendChild(script);
      }).finally(function() {
        if (
          window.app &&
          window.app.__tapScriptLoaders &&
          window.app.__tapScriptLoaders[src]
        ) {
          delete window.app.__tapScriptLoaders[src];
        }
      });
      return window.app.__tapScriptLoaders[src];
    };
    const ensureMindElixirCoreApi = function() {
      if (
        window.app
        && window.app.xmindRenderPolicyCore
        && window.app.mindElixirCoreApi
        && typeof window.app.mindElixirCoreApi.renderMindMap === 'function'
      ) {
        return Promise.resolve(window.app.mindElixirCoreApi);
      }
      window.app = window.app || {};
      if (window.app.__tapMindElixirApiPromise) {
        return window.app.__tapMindElixirApiPromise;
      }
      window.app.__tapMindElixirApiPromise = Promise.resolve()
        .then(function() {
          ensureStylesheetOnce('./scripts/vendor/mind-elixir.css', 'mind-elixir-css');
          return loadLocalScriptOnce('./scripts/vendor/mind-elixir.iife.js', function() {
            return typeof window !== 'undefined' && typeof window.MindElixir !== 'undefined';
          });
        })
        .then(function() {
          return loadLocalScriptOnce('./scripts/core/xmindRenderPolicyCore.js', function() {
            return Boolean(window.app && window.app.xmindRenderPolicyCore);
          });
        })
        .then(function() {
          return loadLocalScriptOnce('./scripts/core/mindElixirCore.js', function() {
            return Boolean(window.app && window.app.mindElixirCore && typeof window.app.mindElixirCore.init === 'function');
          });
        })
        .then(function() {
          if (!window.app || !window.app.mindElixirCore || typeof window.app.mindElixirCore.init !== 'function') {
            throw new Error('MindElixir 核心模块未就绪');
          }
          if (!window.app.mindElixirCoreApi || typeof window.app.mindElixirCoreApi.renderMindMap !== 'function') {
            window.app.mindElixirCoreApi = window.app.mindElixirCore.init({
              xmindApi: window.app.xmindCoreApi || xmindCore || null,
              renderPolicyCore: window.app.xmindRenderPolicyCore || null,
            });
          }
          return window.app.mindElixirCoreApi || null;
        })
        .finally(function() {
          if (window.app) window.app.__tapMindElixirApiPromise = null;
        });
      return window.app.__tapMindElixirApiPromise;
    };
    window.app.ensureMindElixirCoreApi = ensureMindElixirCoreApi;
    const parseXmindFile = xmindCore && xmindCore.parseXmindFile
      ? xmindCore.parseXmindFile
      : async function parseXmindFileFallback() { return { text: '', list: [] }; };

    const lazyParseXmindFile = function(file) {
      const parser = typeof parseXmindFile === 'function'
        ? parseXmindFile
        : (window.app && window.app.xmindCore && typeof window.app.xmindCore.parseXmindFile === 'function'
          ? window.app.xmindCore.parseXmindFile
          : null);
      return parser ? parser(file) : Promise.resolve({ text: '', list: [] });
    };
    const lazyExtractRequirementLabel = function(text) {
      return typeof extractRequirementLabelFromText === 'function'
        ? extractRequirementLabelFromText(text)
        : '';
    };
    const lazyBuildTempExecXmindPackage = function(file, requirement) {
      const builder = window.app && (
        (window.app.xmindCoreApi && typeof window.app.xmindCoreApi.buildTempExecXmindPackage === 'function'
          ? window.app.xmindCoreApi.buildTempExecXmindPackage
          : null)
        || (window.app.xmindCore && typeof window.app.xmindCore.buildTempExecXmindPackage === 'function'
          ? window.app.xmindCore.buildTempExecXmindPackage
          : null)
      );
      if (!builder) return Promise.reject(new Error('缺少 XMind 导出依赖'));
      return builder(file, requirement);
    };
    const lazyBuildCasesXmindPackage = function(cases, moduleTitle, requirement) {
      const builder = window.app && (
        (window.app.xmindCoreApi && typeof window.app.xmindCoreApi.buildXmindPackageFromCases === 'function'
          ? window.app.xmindCoreApi.buildXmindPackageFromCases
          : null)
        || (window.app.xmindCore && typeof window.app.xmindCore.buildXmindPackageFromCases === 'function'
          ? window.app.xmindCore.buildXmindPackageFromCases
          : null)
      );
      if (!builder) return Promise.reject(new Error('缺少 XMind 导出依赖'));
      return builder(cases, moduleTitle, requirement);
    };

    const tempexecCore = window.app && window.app.tempexecCore && typeof window.app.tempexecCore.init === 'function'
      ? window.app.tempexecCore.init({
        setStatus,
        normalizeRequirementName,
        getRequirementLabel,
        ensureRequirementLabel,
        stripTimestampSuffix: xmindCore && xmindCore.stripTimestampSuffix,
        getSafeFileBaseName: xmindCore && xmindCore.getSafeFileBaseName,
        defaultTempExecColumns,
        defaultPlacement,
        state,
        tempExecStorageKey,
        tempExecFocusStorageKey,
        tempExecPageSizeStorageKey,
        modelsKey,
        assignmentKey,
        defaultTempExecPageSize,
        caseViewBaseFontSize: defaultCaseViewFontSize,
        escapeHtml,
        escapeHtmlPreserve,
        normalizeTempExecName,
        stringifyCaseField,
        buildMissingReminderKeywords,
        normalizeMissingReminderMatchConfig,
        callModelWithConfig,
        getAssignedModel,
        deriveCaseListFromText,
        parseXmindFile: lazyParseXmindFile,
        parseXlsxFileToRows: (window.app && window.app.xlsxCoreApi && typeof window.app.xlsxCoreApi.parseXlsxFileToRows === 'function')
          ? window.app.xlsxCoreApi.parseXlsxFileToRows
          : null,
        buildTempExecXmindPackage: lazyBuildTempExecXmindPackage,
        extractRequirementLabelFromText: lazyExtractRequirementLabel,
        promptTempExecRequirement,
        ensureTempExecReplacement,
        generateTempExecId,
        generateTempVersionId,
        setRequirementLabel,
        ensureTempExecColumns,
        persistSettings,
        formatCompactTimestamp,
        downloadText,
        downloadBlob,
        scrollElementIntoView,
        tempExecResultOptions,
        buildXmindPackageFromCases: lazyBuildCasesXmindPackage,
        openConfirmDrawer: appUtils.openConfirmDrawer,
        buildMindDataFromCases: mindElixirCore && mindElixirCore.buildMindDataFromCases,
        dom,
      })
      : null;
    tempExecApi = tempexecCore ? { ...tempexecCore } : {};
    const tempExecStatus = dom.tempExecStatus || null;
    const tempExecDefaults = window.app.tempexecDefaults && typeof window.app.tempexecDefaults.create === 'function'
      ? window.app.tempexecDefaults.create({
        state,
        defaultTempExecPageSize,
        tempExecStatus,
        setStatus,
        normalizeTempExecName,
        removePendingTempExecByName,
        removeTempExecFile: function(id) {
          if (tempExecApi.removeTempExecFile) return tempExecApi.removeTempExecFile(id);
          return undefined;
        },
        renderTempExecView: function() {
          if (typeof tempExecApi.renderTempExecView === 'function') tempExecApi.renderTempExecView();
        },
        generateTempExecId,
        generateTempVersionId,
        stringifyCaseField,
      })
      : {};
    Object.keys(tempExecDefaults).forEach(function(key) {
      if (!tempExecApi[key]) tempExecApi[key] = tempExecDefaults[key];
    });
    // 供用例库等独立模块复用执行页能力（转到执行/保留结果等）
    window.app.tempExecApi = tempExecApi;
    const getTempExecPageSizeFn = tempExecApi.getTempExecPageSize || function() { return defaultTempExecPageSize; };
    state.tempExecPageSize = getTempExecPageSizeFn();
    api.createTempExecFile = tempExecApi.createTempExecFile || api.createTempExecFile;
    api.syncTempExecFocus = tempExecApi.syncTempExecFocus || api.syncTempExecFocus;
    api.persistTempExecState = tempExecApi.persistTempExecState || api.persistTempExecState;
    api.setTempExecActive = tempExecApi.setTempExecActive || api.setTempExecActive;
    api.setTempExecStatusFilter = tempExecApi.setTempExecStatusFilter || api.setTempExecStatusFilter;
    api.removeTempExecFile = tempExecApi.removeTempExecFile || api.removeTempExecFile;
    api.getCaseExecutionDisplay = tempExecApi.getCaseExecutionDisplay || api.getCaseExecutionDisplay;
    api.renderTempExecView = tempExecApi.renderTempExecView || api.renderTempExecView;
    api.clampTempExecPageSize = tempExecApi.clampTempExecPageSize || api.clampTempExecPageSize;
    api.applyTempExecPageSize = tempExecApi.applyTempExecPageSize || function(value) { return { size: value, changed: false }; };

    function ensureInProgressMap() {
      if (!state.inProgressSteps || typeof state.inProgressSteps !== 'object') {
        state.inProgressSteps = {};
      }
      if (state.inProgressStep && !state.inProgressSteps[state.inProgressStep]) {
        state.inProgressSteps[state.inProgressStep] = true;
      }
      return state.inProgressSteps;
    }

    function ensureWaitingMap() {
      if (!state.waitingSteps || typeof state.waitingSteps !== 'object') {
        state.waitingSteps = {};
      }
      return state.waitingSteps;
    }

    function ensureWaitingReasonMap() {
      if (!state.waitingReasons || typeof state.waitingReasons !== 'object') {
        state.waitingReasons = {};
      }
      return state.waitingReasons;
    }

    function ensureFailedMap() {
      if (!state.failedSteps || typeof state.failedSteps !== 'object') {
        state.failedSteps = {};
      }
      return state.failedSteps;
    }

    function ensureFailedReasonMap() {
      if (!state.failedReasons || typeof state.failedReasons !== 'object') {
        state.failedReasons = {};
      }
      return state.failedReasons;
    }

    function ensureValidationFailedMap() {
      if (!state.validationFailedSteps || typeof state.validationFailedSteps !== 'object') {
        state.validationFailedSteps = {};
      }
      return state.validationFailedSteps;
    }

    function ensureValidationFailedReasonMap() {
      if (!state.validationFailedReasons || typeof state.validationFailedReasons !== 'object') {
        state.validationFailedReasons = {};
      }
      return state.validationFailedReasons;
    }

    function triggerUpdateFlowStatus() {
      if (api && typeof api.updateFlowStatus === 'function') {
        api.updateFlowStatus();
      } else if (typeof updateFlowStatusWithValidation === 'function') {
        updateFlowStatusWithValidation();
      }
    }

    function setStepWaiting(step, reason) {
      var map = ensureWaitingMap();
      var reasonMap = ensureWaitingReasonMap();
      if (step) map[step] = true;
      if (step) {
        if (reason) reasonMap[step] = String(reason);
        else if (Object.prototype.hasOwnProperty.call(reasonMap, step)) delete reasonMap[step];
      }
      triggerUpdateFlowStatus();
    }

    function clearStepWaiting(step) {
      var map = ensureWaitingMap();
      if (!step || !map[step]) return;
      delete map[step];
      var reasonMap = ensureWaitingReasonMap();
      if (Object.prototype.hasOwnProperty.call(reasonMap, step)) delete reasonMap[step];
      triggerUpdateFlowStatus();
    }

    function clearAllWaitingSteps() {
      var map = ensureWaitingMap();
      var keys = Object.keys(map);
      if (!keys.length) return;
      keys.forEach(function(key) { delete map[key]; });
      var reasonMap = ensureWaitingReasonMap();
      Object.keys(reasonMap).forEach(function(key) { delete reasonMap[key]; });
      triggerUpdateFlowStatus();
    }

    function setStepFailed(step, reason) {
      var map = ensureFailedMap();
      var reasonMap = ensureFailedReasonMap();
      if (step) map[step] = true;
      if (step) {
        if (reason) reasonMap[step] = String(reason);
        else if (Object.prototype.hasOwnProperty.call(reasonMap, step)) delete reasonMap[step];
      }
      triggerUpdateFlowStatus();
    }

    function clearStepFailed(step) {
      var map = ensureFailedMap();
      var validationMap = ensureValidationFailedMap();
      var reasonMap = ensureFailedReasonMap();
      var validationReasonMap = ensureValidationFailedReasonMap();
      var touched = false;
      if (step && map[step]) {
        delete map[step];
        touched = true;
      }
      if (step && Object.prototype.hasOwnProperty.call(reasonMap, step)) {
        delete reasonMap[step];
        touched = true;
      }
      if (step && validationMap[step]) {
        delete validationMap[step];
        touched = true;
      }
      if (step && Object.prototype.hasOwnProperty.call(validationReasonMap, step)) {
        delete validationReasonMap[step];
        touched = true;
      }
      if (touched) triggerUpdateFlowStatus();
    }

    function clearAllFailedSteps() {
      var map = ensureFailedMap();
      var validationMap = ensureValidationFailedMap();
      var keys = Object.keys(map).concat(Object.keys(validationMap));
      if (!keys.length) return;
      Object.keys(map).forEach(function(key) { delete map[key]; });
      Object.keys(validationMap).forEach(function(key) { delete validationMap[key]; });
      var reasonMap = ensureFailedReasonMap();
      var validationReasonMap = ensureValidationFailedReasonMap();
      Object.keys(reasonMap).forEach(function(key) { delete reasonMap[key]; });
      Object.keys(validationReasonMap).forEach(function(key) { delete validationReasonMap[key]; });
      triggerUpdateFlowStatus();
    }

    function setStepInProgress(step) {
      var map = ensureInProgressMap();
      clearStepWaiting(step);
      clearStepFailed(step);
      if (step) map[step] = true;
      state.inProgressStep = '';
      triggerUpdateFlowStatus();
    }

    function clearStepInProgress(step) {
      var map = ensureInProgressMap();
      if (step && map[step]) delete map[step];
      if (state.inProgressStep === step) {
        state.inProgressStep = '';
      }
      triggerUpdateFlowStatus();
    }

    function isStepLocked(step) {
      var waiting = ensureWaitingMap();
      var running = ensureInProgressMap();
      return Boolean(waiting[step] || running[step]);
    }

    function pickCoveragePayload(data) {
      if (!data || typeof data !== 'object') return null;
      if (isCoveragePayload(data)) return data;
      if (Array.isArray(data)) {
        for (var i = 0; i < data.length; i += 1) {
          var found = pickCoveragePayload(data[i]);
          if (found) return found;
        }
        return null;
      }
      if (data && typeof data === 'object') {
        if (data.data && typeof data.data === 'object') {
          var nested = pickCoveragePayload(data.data);
          if (nested) return nested;
        }
        var keys = Object.keys(data);
        for (var j = 0; j < keys.length; j += 1) {
          var child = data[keys[j]];
          if (child && typeof child === 'object') {
            var inner = pickCoveragePayload(child);
            if (inner) return inner;
          }
        }
      }
      return null;
    }

    function parseCoveragePayloadFromText(text, expectedType) {
      var content = text && text.trim ? text.trim() : '';
      if (!content) return null;
      try {
        var unwrap = unwrapRequirementPayload ? unwrapRequirementPayload(content) : { payload: content };
        if (expectedType && unwrap.type && unwrap.type !== expectedType) return null;
        var payload = typeof unwrap.payload === 'string' ? unwrap.payload : unwrap.payload;
        if (!payload) return null;
        var parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
        return pickCoveragePayload(parsed);
      } catch (err) {
        console.warn('覆盖数据解析失败', err);
        return null;
      }
    }

    function getValidationFailureReason(step) {
      switch (step) {
        case 'review':
          return '评审结果格式异常';
        case 'clean':
          return '清洗结果格式异常';
        case 'compare':
          return '对比结果格式异常';
        case 'split':
          return '拆分结果格式异常';
        case 'cases-upload':
          return '用例导入格式异常';
        case 'cases':
          return '覆盖对比结果格式异常';
        default:
          return '结果格式异常';
      }
    }

    function applyValidationFailure(step, failed) {
      var map = ensureValidationFailedMap();
      var reasonMap = ensureValidationFailedReasonMap();
      var changed = false;
      if (failed) {
        if (!map[step]) {
          map[step] = true;
          changed = true;
        }
        reasonMap[step] = getValidationFailureReason(step);
      } else if (map[step]) {
        delete map[step];
        if (Object.prototype.hasOwnProperty.call(reasonMap, step)) delete reasonMap[step];
        changed = true;
      }
      return changed;
    }

    function validateReviewResult() {
      var targetEl = reviewResultEl || (typeof document !== 'undefined' ? document.getElementById('reviewResult') : null);
      if (!targetEl || isStepLocked('review')) return false;
      var text = targetEl.value ? targetEl.value.trim() : '';
      if (!text) return applyValidationFailure('review', false);
      var payloadObj = unwrapRequirementPayload ? unwrapRequirementPayload(text) : { payload: text };
      var basePayload = Object.prototype.hasOwnProperty.call(payloadObj, 'payload') ? payloadObj.payload : text;
      var parsed = null;
      if (Array.isArray(basePayload)) {
        parsed = basePayload;
      } else if (basePayload && typeof basePayload === 'object' && Array.isArray(basePayload.data)) {
        parsed = basePayload.data;
      } else {
        try {
          parsed = typeof basePayload === 'string' ? JSON.parse(basePayload) : basePayload;
        } catch (err) {
          parsed = null;
        }
        if (parsed && parsed.data && Array.isArray(parsed.data)) {
          parsed = parsed.data;
        }
      }
      var valid = Array.isArray(parsed);
      return applyValidationFailure('review', !valid);
    }

    function validateCleanResult() {
      var targetEl = cleanedTextEl || (typeof document !== 'undefined' ? document.getElementById('cleanedText') : null);
      if (!targetEl || isStepLocked('clean')) return false;
      var text = targetEl.value ? targetEl.value.trim() : '';
      if (!text) return applyValidationFailure('clean', false);
      var expectJson = typeof shouldExpectCleanJson === 'function' ? shouldExpectCleanJson() : false;
      if (!expectJson) return applyValidationFailure('clean', false);
      var payloadObj = unwrapRequirementPayload ? unwrapRequirementPayload(text) : { payload: text };
      var basePayload = Object.prototype.hasOwnProperty.call(payloadObj, 'payload') ? payloadObj.payload : text;
      var parsed = null;
      if (Array.isArray(basePayload)) {
        parsed = basePayload;
      } else if (basePayload && typeof basePayload === 'object') {
        parsed = basePayload;
      } else {
        var raw = typeof basePayload === 'string' ? basePayload : '';
        if (stripRequirementHeader && raw) raw = stripRequirementHeader(raw);
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch (err) {
          parsed = null;
        }
        if (parsed && parsed.payload && typeof parsed.payload === 'object' && !Array.isArray(parsed.payload)) {
          parsed = parsed.payload;
        }
      }
      var valid = parsed && (Array.isArray(parsed) || typeof parsed === 'object');
      return applyValidationFailure('clean', !valid);
    }

    function validateCompareResult() {
      var targetEl = compareResultEl || (typeof document !== 'undefined' ? document.getElementById('compareResult') : null);
      if (!targetEl || isStepLocked('compare')) return false;
      var text = targetEl.value ? targetEl.value.trim() : '';
      if (!text) return applyValidationFailure('compare', false);
      var payload = parseCoveragePayloadFromText(text, 'compare');
      var valid = Boolean(payload) && isCoveragePayload(payload) && clampCoveragePercent(payload.coverage) !== null;
      return applyValidationFailure('compare', !valid);
    }

    function validateSplitResult() {
      var targetEl = splitResultEl || (typeof document !== 'undefined' ? document.getElementById('splitResult') : null);
      if (!targetEl || isStepLocked('split')) return false;
      var text = targetEl.value ? targetEl.value.trim() : '';
      if (!text) return applyValidationFailure('split', false);
      var modules = parseSplitModules();
      var valid = Array.isArray(modules) && modules.length > 0;
      return applyValidationFailure('split', !valid);
    }

    function validateCasesResult() {
      var targetEl = casesCompareResultEl || (typeof document !== 'undefined' ? document.getElementById('casesCompareResult') : null);
      if (!targetEl || isStepLocked('cases')) return false;
      var text = targetEl.value ? targetEl.value.trim() : '';
      if (!text) return applyValidationFailure('cases', false);
      var payload = parseCoveragePayloadFromText(text, 'cases_compare');
      var valid = Boolean(payload) && isCoveragePayload(payload) && clampCoveragePercent(payload.coverage) !== null;
      return applyValidationFailure('cases', !valid);
    }

    function validateCaseSource() {
      if (isStepLocked('cases-upload')) return false;
      var hasSource = false;
      if (typeof api.hasCaseSource === 'function') {
        hasSource = api.hasCaseSource();
      } else if (typeof hasCaseSource === 'function') {
        hasSource = hasCaseSource();
      }
      if (!hasSource) return applyValidationFailure('cases-upload', false);
      var list = typeof api.getCombinedCaseList === 'function' ? api.getCombinedCaseList() : [];
      var valid = Array.isArray(list) && list.length > 0;
      return applyValidationFailure('cases-upload', !valid);
    }

    function validateFlowData() {
      var changed = false;
      changed = validateReviewResult() || changed;
      changed = validateCleanResult() || changed;
      changed = validateCompareResult() || changed;
      changed = validateSplitResult() || changed;
      changed = validateCaseSource() || changed;
      changed = validateCasesResult() || changed;
      return changed;
    }

    api.setStepWaiting = setStepWaiting;
    api.clearStepWaiting = clearStepWaiting;
    api.clearAllWaitingSteps = clearAllWaitingSteps;
    api.setStepFailed = setStepFailed;
    api.clearStepFailed = clearStepFailed;
    api.clearAllFailedSteps = clearAllFailedSteps;

    function createEmptyRequirementMediaState() {
      return {
        docxImages: [],
        pastedImages: [],
        lastDocxImageCount: 0,
        updatedAt: Date.now(),
      };
    }

    function createEmptyLegacyCaseGenState() {
      return {
        requirementLabel: '',
        requirementLabelSource: '',
        lastRawImportName: '',
        rawText: '',
        caseText: '',
        importedCases: [],
        requirementMedia: createEmptyRequirementMediaState(),
        modules: [],
        source: '',
        results: {},
        selections: {},
        suggestions: {},
        moduleStatus: {},
        progress: {},
        timing: {},
        progressNotice: {},
        running: [],
      };
    }

    function hasLegacyCaseGenData() {
      var legacy = state.caseGenLegacy && typeof state.caseGenLegacy === 'object'
        ? state.caseGenLegacy
        : null;
      if (!legacy) return false;
      if (Array.isArray(legacy.modules) && legacy.modules.length > 0) return true;
      if (legacy.results && typeof legacy.results === 'object') {
        var hasResults = Object.keys(legacy.results).some(function(key) {
          var val = legacy.results[key];
          return Boolean(String(val || '').trim() && !/^\[\s*\]$/.test(String(val || '').trim()));
        });
        if (hasResults) return true;
      }
      if (legacy.suggestions && typeof legacy.suggestions === 'object') {
        var hasSuggestions = Object.keys(legacy.suggestions).some(function(key) {
          return Boolean(String(legacy.suggestions[key] || '').trim());
        });
        if (hasSuggestions) return true;
      }
      return false;
    }

    function hasXmindWorkspaceData() {
      var host = state.xmindCaseGen && typeof state.xmindCaseGen === 'object'
        ? state.xmindCaseGen
        : null;
      if (!host) return false;
      if (Array.isArray(host.workspaceOrder) && host.workspaceOrder.length > 0) return true;
      if (host.workspaces && typeof host.workspaces === 'object' && Object.keys(host.workspaces).length > 0) return true;
      if (host.activeWorkspaceId && String(host.activeWorkspaceId || '').trim()) return true;
      return false;
    }

    function shouldPreserveXmindSharedCaseStateOnWorkflowReset() {
      if (!hasXmindWorkspaceData()) return false;
      var settings = state.caseGenSettings && typeof state.caseGenSettings === 'object'
        ? state.caseGenSettings
        : {};
      var activeTab = settings.activeTab === 'modules' ? 'xmind-modules' : String(settings.activeTab || '');
      var xmindApi = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      var drawerOpen = Boolean(xmindApi && typeof xmindApi.isOpen === 'function' && xmindApi.isOpen());
      return drawerOpen || activeTab === 'xmind-modules';
    }

    function cloneCaseSelectionStateForReset(source) {
      var map = source && typeof source === 'object' ? source : {};
      var next = {};
      Object.keys(map).forEach(function(key) {
        var value = map[key];
        if (value instanceof Set) {
          next[key] = Array.from(value);
          return;
        }
        if (Array.isArray(value)) {
          next[key] = value.slice();
          return;
        }
        next[key] = cloneJson(value, []);
      });
      return next;
    }

    function restoreCaseSelectionStateAfterReset(source) {
      var map = source && typeof source === 'object' ? source : {};
      var next = {};
      Object.keys(map).forEach(function(key) {
        var value = map[key];
        next[key] = new Set(Array.isArray(value) ? value : []);
      });
      return next;
    }

    function captureXmindSharedCaseStateForWorkflowReset() {
      if (!shouldPreserveXmindSharedCaseStateOnWorkflowReset()) return null;
      return {
        caseGenModules: cloneJson(state.caseGenModules, []),
        caseGenSource: String(state.caseGenSource || ''),
        caseGenResults: cloneJson(state.caseGenResults, {}),
        caseSelections: cloneCaseSelectionStateForReset(state.caseSelections),
        caseGenSuggestions: cloneJson(state.caseGenSuggestions, {}),
        caseGenModuleStatus: cloneJson(state.caseGenModuleStatus, {}),
        caseGenProgress: cloneJson(state.caseGenProgress, {}),
        caseGenTiming: cloneJson(state.caseGenTiming, {}),
        caseGenProgressNotice: cloneJson(state.caseGenProgressNotice, {}),
        caseGenRunning: state.caseGenRunning instanceof Set ? Array.from(state.caseGenRunning) : [],
      };
    }

    function restoreXmindSharedCaseStateAfterWorkflowReset(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') return;
      state.caseGenModules = cloneJson(snapshot.caseGenModules, []);
      state.caseGenSource = String(snapshot.caseGenSource || '');
      state.caseGenResults = cloneJson(snapshot.caseGenResults, {});
      state.caseSelections = restoreCaseSelectionStateAfterReset(snapshot.caseSelections);
      state.caseGenSuggestions = cloneJson(snapshot.caseGenSuggestions, {});
      state.caseGenModuleStatus = cloneJson(snapshot.caseGenModuleStatus, {});
      state.caseGenProgress = cloneJson(snapshot.caseGenProgress, {});
      state.caseGenTiming = cloneJson(snapshot.caseGenTiming, {});
      state.caseGenProgressNotice = cloneJson(snapshot.caseGenProgressNotice, {});
      state.caseGenRunning = new Set(Array.isArray(snapshot.caseGenRunning) ? snapshot.caseGenRunning : []);
    }

    function hasWorkflowData() {
      var rawTextVal = dom.rawText && dom.rawText.value ? dom.rawText.value.trim() : '';
      var reviewTextVal = dom.reviewResultEl && dom.reviewResultEl.value ? dom.reviewResultEl.value.trim() : '';
      var cleanedTextVal = dom.cleanedTextEl && dom.cleanedTextEl.value ? dom.cleanedTextEl.value.trim() : '';
      var compareTextVal = dom.compareResultEl && dom.compareResultEl.value ? dom.compareResultEl.value.trim() : '';
      var splitTextVal = dom.splitResultEl && dom.splitResultEl.value ? dom.splitResultEl.value.trim() : '';
      var casesCompareVal = dom.casesCompareResultEl && dom.casesCompareResultEl.value ? dom.casesCompareResultEl.value.trim() : '';
      var caseTextVal = dom.caseTextEl && dom.caseTextEl.value ? dom.caseTextEl.value.trim() : '';
      var hasImported = Array.isArray(state.importedCases) && state.importedCases.length > 0;
      var hasAutoClarify = Boolean(state.autoRequireClarifications);
      var hasLegacyCaseGen = hasLegacyCaseGenData();
      var hasClarify = state.reviewClarifications && state.reviewClarifications.size > 0;
      var hasAutoSuggestion = state.autoCompareSuggestion && state.autoCompareSuggestion.trim();
      var hasLabel = false;
      if (state.requirementLabel && state.requirementLabel.trim()) {
        var labelText = state.requirementLabel.trim();
        var labelSource = state.requirementLabelSource ? String(state.requirementLabelSource).trim() : '';
        if (labelSource && labelSource !== 'default') {
          hasLabel = true;
        } else if (labelText !== '当前需求') {
          hasLabel = true;
        }
      }
      return Boolean(
        rawTextVal || reviewTextVal || cleanedTextVal || compareTextVal || splitTextVal || casesCompareVal ||
        caseTextVal || hasImported || hasLegacyCaseGen ||
        hasClarify || hasAutoSuggestion || hasLabel || hasAutoClarify
      );
    }

    function clearWorkflowStatuses() {
      var statusIds = [
        'parseStatus',
        'reviewStatus',
        'clarifyStatus',
        'cleanStatus',
        'compareStatus',
        'splitStatus',
        'caseStatus',
        'casesCoverageStatus',
        'caseGenStatus',
        'autoWorkflowStatus',
        'autoCompareStatus',
        'autoRecleanStatus',
        'autoMissingStatus',
        'missingViewStatus',
        'autoClarifyStatus',
      ];
      statusIds.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) setStatus(el, '', '');
      });
    }

    function interruptActiveExecutions(reasonText) {
      var reason = reasonText ? String(reasonText) : '已中断当前执行任务';
      var interrupted = false;
      if (autoWorkflowManager && typeof autoWorkflowManager.cancelTask === 'function') {
        try {
          interrupted = Boolean(autoWorkflowManager.cancelTask({ reason: reason }));
          if (interrupted && typeof syncAutoWorkflowTaskState === 'function') {
            syncAutoWorkflowTaskState(autoWorkflowManager.getTask ? autoWorkflowManager.getTask() : null);
          }
        } catch (err) {
          interrupted = false;
        }
      } else if (autoWorkflowManager && typeof autoWorkflowManager.getTask === 'function' && typeof autoWorkflowManager.clearTask === 'function') {
        var task = autoWorkflowManager.getTask();
        if (task && task.status === 'running') {
          autoWorkflowManager.clearTask();
          interrupted = true;
          if (typeof syncAutoWorkflowTaskState === 'function') syncAutoWorkflowTaskState(null);
        }
      }
      try {
        abortAllModelRequests('workflow-interrupted');
      } catch (err) {
        // ignore
      }
      return interrupted;
    }

    function resetWorkflowData() {
      var preservedXmindSharedCaseState = captureXmindSharedCaseStateForWorkflowReset();
      if (dom.rawText) dom.rawText.value = '';
      if (dom.reviewResultEl) dom.reviewResultEl.value = '';
      if (dom.cleanedTextEl) dom.cleanedTextEl.value = '';
      if (dom.compareResultEl) dom.compareResultEl.value = '';
      if (dom.splitResultEl) dom.splitResultEl.value = '';
      if (dom.casesCompareResultEl) dom.casesCompareResultEl.value = '';
      if (dom.caseTextEl) dom.caseTextEl.value = '';
      if (dom.fileName) dom.fileName.textContent = '未选择文件';
      state.lastRawImportName = '';
      state.requirementLabel = '';
      state.requirementLabelSource = '';
      state.requirementMedia = createEmptyRequirementMediaState();
      state.autoRunning = false;
      state.inProgressStep = '';
      state.inProgressSteps = {};
      state.failedSteps = {};
      state.waitingSteps = {};
      state.compareCaseAssistantStatus = 'idle';
      state.validationFailedSteps = {};
      state.failedReasons = {};
      state.waitingReasons = {};
      state.validationFailedReasons = {};
      state.reviewRows = [];
      state.reviewClarifications = new Map();
      state.reviewSelections = new Set();
      state.reviewExpanded = new Set();
      state.cleanEntries = [];
      state.cleanViewSelection = -1;
      state.cleanHighlightAll = false;
      state.cleanActiveHighlights = {};
      state.missingSelections = new Set();
      state.missingRowCache = [];
      state.missingLastList = [];
      state.autoCompareMissingList = [];
      state.autoCompareSelections = new Set();
      state.autoCompareSelectionTouched = false;
      state.autoCompareSuggestion = '';
      state.autoRequireClarifications = false;
      state.autoClarifyResolver = null;
      state.caseGenLegacy = createEmptyLegacyCaseGenState();
      state.caseGenModules = [];
      state.caseGenSource = '';
      state.caseGenResults = {};
      state.caseSelections = {};
      state.caseGenSuggestions = {};
      state.caseGenModuleStatus = {};
      state.caseGenProgress = {};
      state.caseGenTiming = {};
      state.caseGenProgressNotice = {};
      state.caseGenRunning = new Set();
      state.importedCases = [];
      restoreXmindSharedCaseStateAfterWorkflowReset(preservedXmindSharedCaseState);
      var autoCompareSuggestionInput = document.getElementById('autoCompareSuggestion');
      if (autoCompareSuggestionInput) autoCompareSuggestionInput.value = '';
      if (dom.autoClarifyToggle) dom.autoClarifyToggle.checked = false;
      clearWorkflowStatuses();
      if (typeof renderImportedCaseList === 'function') renderImportedCaseList();
      if (typeof resetImportedCaseView === 'function') resetImportedCaseView();
      if (typeof syncCaseTextWithImports === 'function') syncCaseTextWithImports();
      if (typeof renderCaseGeneration === 'function') renderCaseGeneration();
      if (typeof renderCaseGenProgressBoard === 'function') renderCaseGenProgressBoard();
      if (typeof renderCleanView === 'function') renderCleanView();
      if (typeof renderCleanRawView === 'function') renderCleanRawView(null);
      if (typeof syncReviewViewFromResult === 'function') syncReviewViewFromResult();
      if (typeof syncSplitView === 'function') syncSplitView();
      if (typeof updateMissingView === 'function') updateMissingView();
      if (typeof syncAutoCompareStatus === 'function') syncAutoCompareStatus();
      if (typeof updateAutoClarifyVisibility === 'function') updateAutoClarifyVisibility(false);
      if (typeof updateAutoMissingCard === 'function') updateAutoMissingCard();
      if (typeof renderAutoRawInfo === 'function') renderAutoRawInfo();
      if (typeof setCaseViewHint === 'function') {
        setCaseViewHint('请先上传或输入 XMind 测试用例');
      }
      triggerUpdateFlowStatus();
      requestPersistWorkflowStateNow();
    }

    api.resetWorkflowData = resetWorkflowData;
    api.interruptActiveExecutions = interruptActiveExecutions;

    function guardRequirementImport() {
      try {
        var scopedUntil = window.app && window.app.__xmindCasegenScopedRequirementImportUntil
          ? Number(window.app.__xmindCasegenScopedRequirementImportUntil || 0)
          : 0;
        if (scopedUntil > Date.now()) {
          if (window.app) window.app.__xmindCasegenScopedRequirementImportUntil = 0;
          return Promise.resolve(true);
        }
      } catch (err) {
        // ignore
      }
      var hasRunningTask = false;
      if (autoWorkflowManager && typeof autoWorkflowManager.getTask === 'function') {
        var task = autoWorkflowManager.getTask();
        hasRunningTask = Boolean(task && task.status === 'running');
      } else {
        hasRunningTask = Boolean(state.autoRunning);
      }
      if (!hasWorkflowData() && !hasRunningTask) return Promise.resolve(true);
      var confirmDrawer = window.app && window.app.confirmDrawer ? window.app.confirmDrawer : null;
      var message = '新导入需求后会清空当前功能流程与一键执行结果，并中断当前自动执行任务；已有 XMind 用例生成页签和结果会保留。是否确认导入新需求？';
      if (!confirmDrawer || typeof confirmDrawer.open !== 'function') {
        var ok = window.confirm(message);
        if (ok) {
          interruptActiveExecutions('导入新需求，已中断当前一键执行');
          resetWorkflowData();
        }
        return Promise.resolve(ok);
      }
      return confirmDrawer.open({
        title: '确认导入新需求',
        message: message,
        confirmText: '确认导入',
        cancelText: '取消',
        danger: true,
      }).then(function(result) {
        if (result && result.ok) {
          interruptActiveExecutions('导入新需求，已中断当前一键执行');
          resetWorkflowData();
          return true;
        }
        return false;
      });
    }

    const uploadModule = window.app.upload && typeof window.app.upload.init === 'function'
      ? window.app.upload.init({
        state,
        handlers: {
          guardRequirementImport: guardRequirementImport,
          handleCaseFiles,
          removeImportedCase,
          setStepInProgress,
          clearStepInProgress,
          setRequirementLabel,
          renderAutoRawInfo,
          updateAutoCompareActions,
          updateAutoMissingCard,
          updateFlowStatus,
          setStatus,
          renderCleanRawView,
          persistWorkflowState: requestPersistWorkflowState,
          parseDocx: xmindCore && xmindCore.parseDocx ? function(file) { return xmindCore.parseDocx(file); } : null,
        },
        dom,
      })
      : null;

    const splitHandlersModule = window.app.splitHandlers && typeof window.app.splitHandlers.init === 'function'
      ? window.app.splitHandlers.init({
        state,
        setStatus,
        utils: { escapeHtml },
        handlers: {
          refreshMissingSmartFillButton,
          updateFlowStatus,
          ensureCaseGenModulesFromSplit,
          renderCaseGeneration,
          parseSplitModules,
        },
        dom,
      })
      : null;
    assignIfPresent(api, splitHandlersModule, ['syncSplitView', 'toggleSplitView']);

    const cleanHandlersModule = window.app.cleanHandlers && typeof window.app.cleanHandlers.init === 'function'
      ? window.app.cleanHandlers.init({
        state,
        cleanCore,
        defaultPrompts,
        handlers: {
          setStatus,
          updateFlowStatus,
          renderCaseGeneration,
          renderCaseGenProgressBoard,
          refreshMissingSmartFillButton,
          setCaseViewHint,
          syncCaseTextWithImports,
          renderImportedCaseList,
          resetImportedCaseView,
          wrapTextWithRequirement,
          getRequirementLabel,
          hasImportedCases,
          stripRequirementHeader,
          stripCodeFence,
          unwrapRequirementPayload,
          stringifyDescription: cleanCore && cleanCore.stringifyDescription ? cleanCore.stringifyDescription : undefined,
          switchTab,
          escapeHtml,
          escapeHtmlPreserve,
          cleanHighlightColors,
          ensureRequirementLabel,
          buildReviewClarificationContext,
          getAssignedModel,
          getReasoningForType,
          getTemperatureForType,
          callModelWithConfig,
          callModelWithContent,
          updateModelTiming,
          extractJsonPayload,
          getLastModelError,
          setStepInProgress,
          clearStepInProgress,
          persistWorkflowState: requestPersistWorkflowState,
        },
        dom,
      })
      : null;
    assignIfPresent(api, cleanHandlersModule, [
      'renderAutoRawInfo',
      'handleRawInput',
      'handleCleanInput',
      'handleSplitInput',
      'handleCaseTextInput',
      'wrapCleanedText',
      'renderCleanRawView',
      'collectEntryRanges',
      'shouldExpectCleanJson',
      'getCleanedEntries',
      'getCleanedRequirementText',
      'getCleanedTextForModel',
      'renderCleanView',
      'locateCleanRawSelection',
      'jumpToCleanHighlightView',
      'runCleaning',
      'copyCleaned',
    ]);

    markInitStage('before-app-runtime-init');
    const runtime = window.app.appRuntime && typeof window.app.appRuntime.init === 'function'
      ? window.app.appRuntime.init({
        state,
        dom,
        api,
        appUtils,
        activeTabKey,
        assignIfPresent,
        tempExecApi,
        setStatus,
        renderAssignmentsSelect,
        saveAssignments,
        ensureCaseGenModulesFromSplit,
        renderCaseGeneration,
        updateAutoClarifyVisibility,
        syncAutoCompareStatus,
        updateAutoMissingCard,
        renderSettingsUI,
        updateMissingView,
        toggleSplitView,
        shouldExpectCleanJson,
        runCleaning,
        copyCleaned,
        renderCleanView,
        renderCleanRawView,
        locateCleanRawSelection,
        toggleMissingView,
        compareCoverage,
        compareCasesCoverage,
        exportCompareResult,
        importCompareResult,
        copyMissingJson,
        handleMissingSelectionChange,
        handleMissingSelectAll,
        smartFillMissingSuggestions,
        exportCasesCoverage,
        importCasesCoverage,
        getSafeRequirementSlug,
        parseSplitModules,
        scrollToSection,
        scrollElementIntoView,
        goCasesGenAndScroll,
        refreshMissingSmartFillButton,
        updateFlowStatus: triggerUpdateFlowStatus,
        setCaseViewHint,
        renderCaseGenProgressBoard,
        workflowStorageKey,
        persistSettings,
        loadModels,
        loadAssignments,
        renderModels,
        renderImportedCaseList,
        renderAutoRawInfo,
        syncReviewViewFromResult,
        syncSplitView,
        resetModelForm,
        toggleImportedCaseView,
        escapeHtml,
        escapeHtmlPreserve,
        formatCompactTimestamp,
        callModelWithConfig,
        callModelWithContent,
        xmindCaseDedupeCore,
        getAssignedModel,
        getReasoningForType,
        getTemperatureForType,
        xmindCaseGenTaskManager,
        updateModelTiming,
        downloadBlob,
        parseXmindFile,
        updateAssignmentStatuses,
        updateReasoningVisibility,
        testModel,
      })
      : null;
    markInitStage('after-app-runtime-init');
    if (window.app && typeof window.app.persistWorkflowState === 'function') {
      persistWorkflowState = window.app.persistWorkflowState;
    } else if (api && typeof api.persistWorkflowState === 'function') {
      persistWorkflowState = api.persistWorkflowState;
    }
    if (window.app && typeof window.app.persistWorkflowStateNow === 'function') {
      persistWorkflowStateNow = window.app.persistWorkflowStateNow;
    } else if (api && typeof api.persistWorkflowStateNow === 'function') {
      persistWorkflowStateNow = api.persistWorkflowStateNow;
    }
    if (runtime && runtime.switchTab) switchTab = runtime.switchTab;
    window.app.switchTab = switchTab;
    initModule('flowGuide', {
      utils: appUtils,
      switchTab: switchTab,
      setStatus: setStatus,
    });
    initModule('pageGuide', {
      state: state,
      config: {
        defaultPageGuideSwitches: appConfig.defaultPageGuideSwitches || {},
        defaultSettings: defaultSettings,
      },
      utils: appUtils,
      setStatus: setStatus,
    });
