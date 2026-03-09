    window.app = window.app || {};
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
      theme: 'light',
      caseViewFontSize: 13,
      missingCaseReminderPlacement: 'top',
      missingCaseReminderMatchConfig: { type: true, module: true },
      missingCaseReminderAiEnabled: 'off',
      smartTopNavCollapse: false,
      assistantEnabled: false,
      assistantModelId: '',
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
        clearTask: clearTask,
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
      getAssistantSettingsSnapshot,
      listAssistantModels,
      applyAssistantSettingsPatch,
      saveAssistantSettings,
      renderAssistantSettingsUI,
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
      getAssistantSettingsSnapshot: function noopGetAssistant() { return { assistantEnabled: false, assistantModelId: '', assistantModelName: '' }; },
      listAssistantModels: function noopListAssistantModels() { return []; },
      applyAssistantSettingsPatch: function noopApplyAssistantPatch() { return { ok: false, reason: 'settings module missing' }; },
      saveAssistantSettings: function noopSaveAssistantSettings() {},
      renderAssistantSettingsUI: function noopRenderAssistantSettings() {},
    };
    loadSettings();
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
      applyModelPatch,
      saveModel,
    } = modelsModule || {};

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
    const buildCaseSearchText = appUtils.buildCaseSearchText;
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
      'handleCaseSelectionChange',
      'handleCaseSelectAll',
      'handleCaseSelectAllModules',
      'exportSelectedCases',
      'exportSelectedCasesToXmind',
      'refreshCaseSelectionUI',
      'updateSupplementButtons',
      'refreshAppendExistingButton',
      'refreshCaseGenBatchButtons',
      'getCaseListForModule',
      'setCaseGenDbStoreNewAction',
      'clearCaseGenDbStoreNewActionError',
      'openCaseGenDbStoreNewDrawer',
      'openCaseGenDbStoreAppendDrawer',
      'openCaseGenAllView',
      'refreshExportCaseGenXmindButton',
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
    const mindElixirCore = window.app && window.app.mindElixirCore && typeof window.app.mindElixirCore.init === 'function'
      ? window.app.mindElixirCore.init({
        xmindApi: xmindCore,
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
    if (mindElixirCore) {
      window.app.mindElixirCoreApi = mindElixirCore;
    }
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

    function hasWorkflowData() {
      var rawTextVal = dom.rawText && dom.rawText.value ? dom.rawText.value.trim() : '';
      var reviewTextVal = dom.reviewResultEl && dom.reviewResultEl.value ? dom.reviewResultEl.value.trim() : '';
      var cleanedTextVal = dom.cleanedTextEl && dom.cleanedTextEl.value ? dom.cleanedTextEl.value.trim() : '';
      var compareTextVal = dom.compareResultEl && dom.compareResultEl.value ? dom.compareResultEl.value.trim() : '';
      var splitTextVal = dom.splitResultEl && dom.splitResultEl.value ? dom.splitResultEl.value.trim() : '';
      var casesCompareVal = dom.casesCompareResultEl && dom.casesCompareResultEl.value ? dom.casesCompareResultEl.value.trim() : '';
      var caseTextVal = dom.caseTextEl && dom.caseTextEl.value ? dom.caseTextEl.value.trim() : '';
      var hasImported = Array.isArray(state.importedCases) && state.importedCases.length > 0;
      var hasCaseGenModules = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      var hasAutoClarify = Boolean(state.autoRequireClarifications);
      var hasCaseGenResults = false;
      var hasCaseGenSuggestions = false;
      if (state.caseGenResults && typeof state.caseGenResults === 'object') {
        Object.keys(state.caseGenResults).some(function(key) {
          var val = (state.caseGenResults[key] || '').trim();
          if (val && !/^\[\s*\]$/.test(val)) {
            hasCaseGenResults = true;
            return true;
          }
          return false;
        });
      }
      if (state.caseGenSuggestions && typeof state.caseGenSuggestions === 'object') {
        Object.keys(state.caseGenSuggestions).some(function(key) {
          var val = (state.caseGenSuggestions[key] || '').trim();
          if (val) {
            hasCaseGenSuggestions = true;
            return true;
          }
          return false;
        });
      }
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
        caseTextVal || hasImported || hasCaseGenModules || hasCaseGenResults || hasCaseGenSuggestions ||
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
      state.requirementMedia = { docxImages: [], pastedImages: [], lastDocxImageCount: 0, updatedAt: Date.now() };
      state.autoRunning = false;
      state.inProgressStep = '';
      state.inProgressSteps = {};
      state.failedSteps = {};
      state.waitingSteps = {};
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
      state.caseGenModules = [];
      state.caseGenSource = '';
      state.caseGenResults = {};
      state.caseSelections = {};
      state.caseGenSuggestions = {};
      state.caseGenModuleStatus = {};
      state.caseGenProgress = {};
      state.caseGenRunning = new Set();
      state.importedCases = [];
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

    function guardRequirementImport() {
      var hasRunningTask = false;
      if (autoWorkflowManager && typeof autoWorkflowManager.getTask === 'function') {
        var task = autoWorkflowManager.getTask();
        hasRunningTask = Boolean(task && task.status === 'running');
      } else {
        hasRunningTask = Boolean(state.autoRunning);
      }
      if (!hasWorkflowData() && !hasRunningTask) return Promise.resolve(true);
      var confirmDrawer = window.app && window.app.confirmDrawer ? window.app.confirmDrawer : null;
      var message = '新导入需求后页面数据会被清空（含用例生成数据），并中断当前自动执行任务。需要重新执行全部操作，是否确认导入新需求？';
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
        getAssignedModel,
        updateModelTiming,
        downloadBlob,
        parseXmindFile,
        updateAssignmentStatuses,
        updateReasoningVisibility,
        testModel,
      })
      : null;
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
    if (runtime && runtime.resolveTabName) window.app.resolveTabName = runtime.resolveTabName;
    window.app.switchTab = switchTab;

    function assistantDispatchEvent(name, detail) {
      if (!name) return;
      if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
      try {
        if (typeof CustomEvent === 'function') {
          window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
        } else if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
          var evt = document.createEvent('CustomEvent');
          evt.initCustomEvent(name, false, false, detail || {});
          window.dispatchEvent(evt);
        }
      } catch (err) {
        // ignore
      }
    }

    function assistantGetStableModelId(model) {
      if (!model || typeof model !== 'object') return '';
      if (model.remoteId !== undefined && model.remoteId !== null) return String(model.remoteId);
      if (model.id !== undefined && model.id !== null) return String(model.id);
      return '';
    }

    function assistantFindModelByAnyId(value) {
      var target = value === undefined || value === null ? '' : String(value);
      if (!target) return null;
      var list = Array.isArray(state.models) ? state.models : [];
      for (var i = 0; i < list.length; i += 1) {
        var model = list[i];
        if (!model) continue;
        var idVal = model.id === undefined || model.id === null ? '' : String(model.id);
        var remoteVal = model.remoteId === undefined || model.remoteId === null ? '' : String(model.remoteId);
        if (idVal === target || remoteVal === target) return model;
      }
      return null;
    }

    function assistantIsModelUsable(model) {
      if (!model || typeof model !== 'object') return false;
      var baseUrl = model.baseUrl ? String(model.baseUrl).trim() : '';
      var modelId = model.model ? String(model.model).trim() : '';
      var apiKey = model.apiKey ? String(model.apiKey).trim() : '';
      return Boolean(baseUrl && modelId && apiKey);
    }

    function assistantSanitizeBaseUrl(url) {
      var raw = url === undefined || url === null ? '' : String(url).trim();
      if (!raw) return '';
      try {
        var parsed = new URL(raw);
        var path = parsed.pathname || '';
        return parsed.protocol + '//' + parsed.host + path;
      } catch (err) {
        return raw.split('?')[0];
      }
    }

    function assistantExtractJsonPayload(text) {
      var raw = text === undefined || text === null ? '' : String(text);
      if (!raw) return null;
      var stripped = stripCodeFence ? stripCodeFence(raw) : raw;
      var payload = extractJsonPayload ? extractJsonPayload(stripped) : '';
      var candidate = payload || stripped;
      if (!candidate) return null;
      try {
        return JSON.parse(candidate);
      } catch (err) {
        return null;
      }
    }

    function assistantNormalizeDiagPatch(patch) {
      var incoming = patch && typeof patch === 'object' ? patch : {};
      var normalized = {};
      if (Object.prototype.hasOwnProperty.call(incoming, 'provider')) {
        var provider = incoming.provider === undefined || incoming.provider === null ? '' : String(incoming.provider).trim();
        if (provider) normalized.provider = provider;
      }
      if (Object.prototype.hasOwnProperty.call(incoming, 'baseUrl')) {
        var baseUrl = incoming.baseUrl === undefined || incoming.baseUrl === null ? '' : String(incoming.baseUrl).trim();
        if (baseUrl) normalized.baseUrl = baseUrl;
      }
      if (Object.prototype.hasOwnProperty.call(incoming, 'model')) {
        var modelName = incoming.model === undefined || incoming.model === null ? '' : String(incoming.model).trim();
        if (modelName) normalized.model = modelName;
      }
      if (Object.prototype.hasOwnProperty.call(incoming, 'maxTokens')) {
        var maxTokens = Math.round(Number(incoming.maxTokens));
        if (Number.isFinite(maxTokens) && maxTokens > 0) normalized.maxTokens = maxTokens;
      }
      return normalized;
    }

    function assistantGetSettings() {
      return typeof getAssistantSettingsSnapshot === 'function'
        ? getAssistantSettingsSnapshot()
        : { assistantEnabled: false, assistantModelId: '', assistantModelName: '' };
    }

    function assistantGetSelectedModel(modelId) {
      var explicitId = modelId === undefined || modelId === null ? '' : String(modelId);
      var settingsSnapshot = assistantGetSettings();
      var targetId = explicitId || settingsSnapshot.assistantModelId || '';
      if (!targetId) return null;
      return assistantFindModelByAnyId(targetId);
    }

    function assistantNormalizeContentBlocks(blocks) {
      if (!Array.isArray(blocks)) return [];
      var normalized = [];
      blocks.forEach(function(block) {
        if (!block || typeof block !== 'object') return;
        if (block.type === 'text') {
          var text = block.text === undefined || block.text === null ? '' : String(block.text);
          if (text.trim()) normalized.push({ type: 'text', text: text });
          return;
        }
        if (block.type === 'image') {
          var dataUrl = block.dataUrl === undefined || block.dataUrl === null
            ? (block.url === undefined || block.url === null ? '' : String(block.url))
            : String(block.dataUrl);
          dataUrl = dataUrl.trim();
          if (!dataUrl) return;
          normalized.push({ type: 'image', dataUrl: dataUrl });
        }
      });
      return normalized;
    }

    function assistantContentBlocksHaveImage(blocks) {
      var list = assistantNormalizeContentBlocks(blocks);
      for (var i = 0; i < list.length; i += 1) {
        if (list[i] && list[i].type === 'image') return true;
      }
      return false;
    }

    function assistantGetSelectedModelInfo(modelId) {
      var model = assistantGetSelectedModel(modelId);
      var capabilities = normalizeModelCapabilityList(model);
      return {
        configured: Boolean(model),
        usable: assistantIsModelUsable(model),
        modelId: assistantGetStableModelId(model),
        modelName: model && model.name ? String(model.name) : getModelDisplayName(model, '未配置'),
        supportsImage: capabilitySupportsImage(capabilities),
        capabilities: capabilities,
      };
    }

    function assistantNormalizeHistory(history) {
      if (!Array.isArray(history) || !history.length) return [];
      var max = 12;
      var list = [];
      history.forEach(function(item) {
        if (!item || typeof item !== 'object') return;
        var roleRaw = item.role === undefined || item.role === null ? '' : String(item.role).toLowerCase();
        var role = '';
        if (roleRaw === 'user') role = 'user';
        if (roleRaw === 'assistant' || roleRaw === 'ai') role = 'assistant';
        if (roleRaw === 'system' || roleRaw === 'sys') role = 'system';
        if (!role) return;
        var content = item.content === undefined || item.content === null ? '' : String(item.content).trim();
        if (!content) return;
        if (content.length > 300) {
          content = content.slice(0, 300) + '...';
        }
        list.push({ role: role, content: content });
      });
      if (list.length > max) {
        list = list.slice(-max);
      }
      return list;
    }

    function assistantBuildHistoryPrompt(history) {
      var list = assistantNormalizeHistory(history);
      if (!list.length) return '';
      var lines = ['以下是最近对话上下文（按时间顺序）：'];
      list.forEach(function(item) {
        var prefix = item.role === 'user' ? '用户' : (item.role === 'assistant' ? '助手' : '系统');
        lines.push(prefix + '：' + item.content);
      });
      lines.push('请结合这些上下文回答当前用户输入。若用户存在省略表达，优先承接最近同主题语义。');
      return lines.join('\n');
    }

    function assistantCallModel(userText, options) {
      var opts = options && typeof options === 'object' ? options : {};
      var model = assistantGetSelectedModel(opts.modelId);
      if (!model) {
        return Promise.resolve({ ok: false, reason: '未选择助手模型，请先到设置页配置' });
      }
      if (!assistantIsModelUsable(model)) {
        return Promise.resolve({ ok: false, reason: '助手模型配置不完整，请补全接口/API Key/模型ID' });
      }
      var prompt = opts.prompt ? String(opts.prompt) : '';
      var reasoning = opts.reasoning ? String(opts.reasoning) : '';
      var temperature = opts.temperature;
      var historyPrompt = assistantBuildHistoryPrompt(opts.history);
      var normalizedBlocks = assistantNormalizeContentBlocks(Array.isArray(userText) ? userText : opts.contentBlocks);
      var hasImageInput = assistantContentBlocksHaveImage(normalizedBlocks);
      if (historyPrompt) {
        prompt = prompt ? (prompt + '\n' + historyPrompt) : historyPrompt;
      }
      if (hasImageInput && !capabilitySupportsImage(normalizeModelCapabilityList(model))) {
        return Promise.resolve({
          ok: false,
          reason: '当前助手模型不支持图片输入，请切换支持视觉/多模态的模型。',
          modelId: assistantGetStableModelId(model),
          modelName: model && model.name ? String(model.name) : '',
          unsupportedMedia: 'image',
        });
      }
      if (normalizedBlocks.length) {
        return callModelWithContent(model, normalizedBlocks, prompt, {
          reasoningEffort: reasoning,
          temperature: temperature,
        }).then(function(content) {
          return {
            ok: true,
            content: content,
            modelId: assistantGetStableModelId(model),
            modelName: model && model.name ? String(model.name) : '',
          };
        }).catch(function(err) {
          return {
            ok: false,
            reason: err && err.message ? String(err.message) : '模型调用失败',
          };
        });
      }
      return callModelWithConfig(model, String(userText || ''), prompt, reasoning, temperature)
        .then(function(content) {
          return {
            ok: true,
            content: content,
            modelId: assistantGetStableModelId(model),
            modelName: model && model.name ? String(model.name) : '',
          };
        })
        .catch(function(err) {
          return {
            ok: false,
            reason: err && err.message ? String(err.message) : '模型调用失败',
          };
        });
    }

    function assistantListTabs() {
      var list = [];
      var buttons = document.querySelectorAll('[data-tab-btn]');
      if (!buttons || typeof buttons.forEach !== 'function') return list;
      buttons.forEach(function(btn) {
        if (!btn || !btn.dataset) return;
        var tab = btn.dataset.tabBtn || '';
        if (!tab) return;
        var label = btn.textContent ? String(btn.textContent).trim() : tab;
        list.push({ tab: tab, label: label });
      });
      return list;
    }

    function assistantBuildPageCaseContextSummary(snapshot) {
      var data = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var caseFile = data.caseFile && typeof data.caseFile === 'object' ? data.caseFile : null;
      var total = Number(data.total);
      var totalAll = Number(data.totalAll);
      if (!caseFile) return null;
      if (!Number.isFinite(total) || total < 0) total = 0;
      if (!Number.isFinite(totalAll) || totalAll < 0) totalAll = total;
      return {
        contextSource: data.contextSource ? String(data.contextSource) : '',
        fileId: caseFile.id === undefined || caseFile.id === null ? '' : String(caseFile.id),
        fileName: caseFile.name === undefined || caseFile.name === null ? '' : String(caseFile.name),
        projectId: caseFile.projectId === undefined || caseFile.projectId === null ? '' : String(caseFile.projectId),
        versionId: caseFile.versionId === undefined || caseFile.versionId === null ? '' : String(caseFile.versionId),
        total: total,
        totalAll: totalAll,
        searchText: data.searchText === undefined || data.searchText === null ? '' : String(data.searchText),
        truncated: data.truncated === true,
      };
    }

    function assistantGetPageData(tabName) {
      var tab = tabName ? String(tabName) : (state.activeTab || '');
      if (tab && window.app && typeof window.app.resolveTabName === 'function') {
        var resolvedTab = window.app.resolveTabName(tab);
        if (resolvedTab) tab = resolvedTab;
      }
      var data = {
        tab: tab,
        requirementLabel: state.requirementLabel || '',
        modelsCount: Array.isArray(state.models) ? state.models.length : 0,
        importedCasesCount: Array.isArray(state.importedCases) ? state.importedCases.length : 0,
        caseGenModuleCount: Array.isArray(state.caseGenModules) ? state.caseGenModules.length : 0,
        tempExecFileCount: Array.isArray(state.tempExecFiles) ? state.tempExecFiles.length : 0,
      };
      if (tab === 'assign') {
        data.assignments = state.assignments && typeof state.assignments === 'object' ? Object.assign({}, state.assignments) : {};
      } else if (tab === 'casesgen') {
        var results = state.caseGenResults && typeof state.caseGenResults === 'object' ? state.caseGenResults : {};
        var generated = 0;
        Object.keys(results).forEach(function(key) {
          if (results[key] && String(results[key]).trim()) generated += 1;
        });
        data.generatedModuleCount = generated;
      } else if (tab === 'case-library') {
        var editorSnapshot = assistantReadEditorCaseSnapshot(20);
        var editorContext = assistantBuildPageCaseContextSummary(editorSnapshot);
        if (editorContext) data.currentCaseContext = editorContext;
        var historySnapshot = assistantReadCaseLibraryHistorySnapshot(60);
        if (historySnapshot && historySnapshot.ok === true && historySnapshot.hasContext === true) {
          data.caseLibraryHistoryDetail = historySnapshot;
        }
        var missingViewSnapshot = assistantReadMissingViewSnapshot(60);
        if (missingViewSnapshot && missingViewSnapshot.ok === true && missingViewSnapshot.hasContext === true) {
          data.missingCaseLibraryView = missingViewSnapshot;
        }
      } else if (tab === 'tempexec') {
        data.tempExecActiveFileId = state.tempExecActiveFileId || '';
        var tempExecSnapshot = assistantReadTempExecCaseSnapshot(20);
        var tempExecContext = assistantBuildPageCaseContextSummary(tempExecSnapshot);
        if (tempExecContext) data.currentCaseContext = tempExecContext;
        var tempExecDiffSnapshot = assistantReadTempExecCaseLibraryDiffSnapshot(60);
        if (tempExecDiffSnapshot && tempExecDiffSnapshot.ok === true && tempExecDiffSnapshot.hasContext === true) {
          data.tempExecCaseLibraryDiffDetail = tempExecDiffSnapshot;
        }
      }
      return data;
    }

    function assistantReadSelectValue(id) {
      if (!id) return '';
      var el = document.getElementById(String(id));
      if (!el) return '';
      var value = el.value === undefined || el.value === null ? '' : String(el.value).trim();
      return value;
    }

    function assistantResolveCaseLibraryProjectId(options) {
      var opts = options && typeof options === 'object' ? options : {};
      var explicit = opts.projectId === undefined || opts.projectId === null ? '' : String(opts.projectId).trim();
      if (explicit) return explicit;
      var candidates = [
        assistantReadSelectValue('caseLibraryEditProjectSelect'),
        assistantReadSelectValue('caseLibrarySelectProjectSelect'),
        assistantReadSelectValue('caseLibraryImportProjectSelect'),
        assistantReadSelectValue('caseLibraryImportSelectProjectSelect'),
        assistantReadSelectValue('caseLibraryMissingProjectSelect'),
        assistantReadSelectValue('caseLibraryHistoryProjectSelect'),
        assistantReadSelectValue('caseLibraryWriterPublishProjectSelect'),
      ];
      for (var i = 0; i < candidates.length; i += 1) {
        if (candidates[i]) return candidates[i];
      }
      return '';
    }

    function assistantNormalizeCaseFile(item, index) {
      var file = item && typeof item === 'object' ? item : {};
      var rawItemCount = Number(file.item_count);
      var rawAssociationCount = Number(file.association_count);
      return {
        index: index + 1,
        id: file.id === undefined || file.id === null ? '' : String(file.id),
        name: file.file_name_clean ? String(file.file_name_clean) : ('用例#' + (file.id === undefined || file.id === null ? (index + 1) : file.id)),
        itemCount: Number.isFinite(rawItemCount) ? rawItemCount : 0,
        associationCount: Number.isFinite(rawAssociationCount) ? rawAssociationCount : 0,
        projectId: file.project_id === undefined || file.project_id === null ? '' : String(file.project_id),
        versionId: file.version_id === undefined || file.version_id === null ? '' : String(file.version_id),
        updatedAt: file.updated_at || file.imported_at || '',
        source: file.source ? String(file.source) : '',
      };
    }

    function assistantReadCaseLibraryHistorySnapshot(limit) {
      var caseLibraryApi = window.app && window.app.caseLibraryApi ? window.app.caseLibraryApi : null;
      if (!caseLibraryApi || typeof caseLibraryApi.getCurrentHistoryDetailSnapshot !== 'function') return null;
      var snapshot = null;
      try {
        snapshot = caseLibraryApi.getCurrentHistoryDetailSnapshot({ limit: limit });
      } catch (err) {
        return null;
      }
      if (!snapshot || snapshot.ok !== true || snapshot.hasContext !== true) return null;
      return snapshot;
    }


    function assistantReadTempExecCaseLibraryDiffSnapshot(limit) {
      var tempExecApi = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
      if (!tempExecApi || typeof tempExecApi.getCurrentCaseLibraryDiffSnapshot !== 'function') return null;
      var snapshot = null;
      try {
        snapshot = tempExecApi.getCurrentCaseLibraryDiffSnapshot({ limit: limit });
      } catch (err) {
        return null;
      }
      if (!snapshot || snapshot.ok !== true || snapshot.hasContext !== true) return null;
      return snapshot;
    }

    function assistantReadEditorCaseSnapshot(limit) {
      var caseLibraryApi = window.app && window.app.caseLibraryApi ? window.app.caseLibraryApi : null;
      if (!caseLibraryApi || typeof caseLibraryApi.getCurrentEditorCaseSnapshot !== 'function') return null;
      var snapshot = null;
      try {
        snapshot = caseLibraryApi.getCurrentEditorCaseSnapshot({ limit: limit });
      } catch (err) {
        return null;
      }
      if (!snapshot || snapshot.ok !== true || snapshot.hasContext !== true) return null;
      var items = Array.isArray(snapshot.items) ? snapshot.items : [];
      var caseFile = snapshot.caseFile && typeof snapshot.caseFile === 'object'
        ? Object.assign({}, snapshot.caseFile)
        : null;
      var total = Number(snapshot.total);
      if (!Number.isFinite(total) || total < 0) total = items.length;
      var totalAll = Number(snapshot.totalAll);
      if (!Number.isFinite(totalAll) || totalAll < 0) totalAll = total;
      return {
        ok: true,
        scope: 'editor',
        contextSource: 'case-library',
        projectId: snapshot.projectId === undefined || snapshot.projectId === null ? '' : String(snapshot.projectId),
        caseFile: caseFile,
        searchText: snapshot.searchText === undefined || snapshot.searchText === null ? '' : String(snapshot.searchText),
        total: total,
        totalAll: totalAll,
        items: items,
        truncated: snapshot.truncated === true,
      };
    }


    function assistantReadMissingViewSnapshot(limit) {
      var caseLibraryApi = window.app && window.app.caseLibraryApi ? window.app.caseLibraryApi : null;
      if (!caseLibraryApi || typeof caseLibraryApi.getCurrentMissingViewSnapshot !== 'function') return null;
      var snapshot = null;
      try {
        snapshot = caseLibraryApi.getCurrentMissingViewSnapshot({ limit: limit });
      } catch (err) {
        return null;
      }
      if (!snapshot || snapshot.ok !== true || snapshot.hasContext !== true) return null;
      return snapshot;
    }

    function assistantResolveMissingLibraryProjectId(options) {
      var opts = options && typeof options === 'object' ? options : {};
      var explicit = opts.projectId === undefined || opts.projectId === null ? '' : String(opts.projectId).trim();
      if (explicit) return explicit;
      var currentCases = opts.currentCases && typeof opts.currentCases === 'object' ? opts.currentCases : null;
      if (currentCases && currentCases.projectId) return String(currentCases.projectId);
      var missingViewSnapshot = assistantReadMissingViewSnapshot(1);
      if (missingViewSnapshot && missingViewSnapshot.projectId) return String(missingViewSnapshot.projectId);
      var tempExecSnapshot = assistantReadTempExecCaseSnapshot(1);
      if (tempExecSnapshot && tempExecSnapshot.projectId) return String(tempExecSnapshot.projectId);
      var editorSnapshot = assistantReadEditorCaseSnapshot(1);
      if (editorSnapshot && editorSnapshot.projectId) return String(editorSnapshot.projectId);
      return assistantResolveCaseLibraryProjectId(opts);
    }

    function assistantNormalizeMissingLibraryText(value) {
      return value === undefined || value === null ? '' : String(value).trim().toLowerCase();
    }

    function assistantNormalizeMissingLibraryModule(module, index) {
      var row = module && typeof module === 'object' ? module : {};
      var itemCount = Number(row.item_count);
      if (!Number.isFinite(itemCount) || itemCount < 0) itemCount = 0;
      return {
        index: Number(index) + 1,
        id: row.id === undefined || row.id === null ? '' : String(row.id),
        name: row.name === undefined || row.name === null ? '' : String(row.name),
        projectId: row.project_id === undefined || row.project_id === null ? '' : String(row.project_id),
        itemCount: itemCount,
      };
    }

    function assistantResolveMissingLibraryTypeIds(item) {
      var row = item && typeof item === 'object' ? item : {};
      var source = Array.isArray(row.type_ids) ? row.type_ids : (Array.isArray(row.typeIds) ? row.typeIds : []);
      var seen = {};
      var ids = [];
      source.forEach(function(raw) {
        if (raw === undefined || raw === null || raw === '') return;
        var key = String(raw);
        if (seen[key]) return;
        seen[key] = true;
        ids.push(key);
      });
      if (!ids.length && row.type_id !== undefined && row.type_id !== null && row.type_id !== '') {
        ids.push(String(row.type_id));
      }
      return ids;
    }

    function assistantResolveMissingLibraryTypeNames(item, typeIds) {
      var row = item && typeof item === 'object' ? item : {};
      var ids = Array.isArray(typeIds) ? typeIds : assistantResolveMissingLibraryTypeIds(row);
      var names = [];
      ids.forEach(function(typeId, idx) {
        var base = Array.isArray(row.type_names) ? row.type_names[idx] : (Array.isArray(row.typeNames) ? row.typeNames[idx] : null);
        if (!base && row.type_name && idx === 0) base = row.type_name;
        if (!base && row.typeName && idx === 0) base = row.typeName;
        if (!base) return;
        names.push(String(base));
      });
      return names;
    }

    function assistantNormalizeMissingLibraryItem(item, index, module) {
      var row = item && typeof item === 'object' ? item : {};
      var moduleRow = module && typeof module === 'object' ? module : {};
      var moduleId = row.module_id === undefined || row.module_id === null ? '' : String(row.module_id);
      if (!moduleId && moduleRow.id !== undefined && moduleRow.id !== null) moduleId = String(moduleRow.id);
      var moduleName = row.module_name || row.module || moduleRow.name || '';
      var typeIds = assistantResolveMissingLibraryTypeIds(row);
      var typeNames = assistantResolveMissingLibraryTypeNames(row, typeIds);
      return {
        index: Number(index) + 1,
        id: row.id === undefined || row.id === null ? '' : String(row.id),
        moduleId: moduleId,
        module: moduleName ? String(moduleName) : '',
        typeIds: typeIds,
        typeNames: typeNames,
        typeLabel: typeNames.length ? typeNames.join('、') : '未分类',
        title: row.title === undefined || row.title === null ? '' : String(row.title),
        priority: row.priority === undefined || row.priority === null ? '' : String(row.priority),
        precondition: row.precondition === undefined || row.precondition === null ? '' : String(row.precondition),
        steps: row.steps === undefined || row.steps === null ? '' : String(row.steps),
        expected: row.expected === undefined || row.expected === null ? '' : String(row.expected),
      };
    }

    function assistantBuildMissingLibrarySearchText(item) {
      var row = item && typeof item === 'object' ? item : {};
      var parts = [
        row.module,
        row.typeLabel,
        Array.isArray(row.typeNames) ? row.typeNames.join(' '): '',
        row.title,
        row.priority,
        row.precondition,
        row.steps,
        row.expected,
      ];
      return assistantNormalizeMissingLibraryText(parts.join('\n'));
    }

    function assistantFilterMissingLibraryItems(items, queryText) {
      var list = Array.isArray(items) ? items : [];
      var raw = queryText === undefined || queryText === null ? '' : String(queryText).trim();
      if (!raw) return list.slice();
      var normalized = assistantNormalizeMissingLibraryText(raw);
      var keywords = typeof buildMissingReminderKeywords === 'function' ? buildMissingReminderKeywords(raw) : [];
      return list.filter(function(item) {
        var searchText = assistantBuildMissingLibrarySearchText(item);
        if (!searchText) return false;
        if (normalized && searchText.indexOf(normalized) !== -1) return true;
        if (!keywords.length) return false;
        var hitCount = 0;
        for (var i = 0; i < keywords.length; i += 1) {
          if (!keywords[i]) continue;
          if (searchText.indexOf(String(keywords[i]).toLowerCase()) !== -1) hitCount += 1;
        }
        return hitCount >= Math.min(2, keywords.length);
      });
    }

    function assistantLoadMissingLibraryProjectData(options) {
      var opts = options && typeof options === 'object' ? options : {};
      var projectId = assistantResolveMissingLibraryProjectId(opts);
      if (!projectId) {
        return Promise.resolve({
          ok: true,
          hasContext: false,
          reason: 'no-project-context',
          projectId: '',
          totalModules: 0,
          totalItems: 0,
          modules: [],
          items: [],
          libraryEmpty: false,
        });
      }
      var apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
      if (!apiClient || typeof apiClient.listMissingModules !== 'function' || typeof apiClient.listMissingModuleItems !== 'function') {
        return Promise.resolve({
          ok: false,
          reason: '漏测用例库能力暂不可用',
          projectId: projectId,
          totalModules: 0,
          totalItems: 0,
          modules: [],
          items: [],
          libraryEmpty: false,
        });
      }
      return apiClient.listMissingModules(projectId)
        .then(function(modules) {
          var list = Array.isArray(modules) ? modules : [];
          var normalizedModules = list.map(function(module, index) {
            return assistantNormalizeMissingLibraryModule(module, index);
          });
          var tasks = normalizedModules.map(function(module) {
            if (!module.id) return Promise.resolve([]);
            return apiClient.listMissingModuleItems(module.id)
              .then(function(items) {
                var rows = Array.isArray(items) ? items : [];
                return rows.map(function(item) {
                  var clone = item && typeof item === 'object' ? Object.assign({}, item) : {};
                  if (clone.module_id === undefined || clone.module_id === null || clone.module_id === '') clone.module_id = module.id;
                  if (!clone.module_name) clone.module_name = module.name || ('模块#' + module.id);
                  return clone;
                });
              })
              .catch(function() { return []; });
          });
          return Promise.all(tasks).then(function(result) {
            var normalizedItems = [];
            (result || []).forEach(function(rows) {
              (rows || []).forEach(function(row) {
                var source = row && typeof row === 'object' ? row : {};
                var moduleId = source.module_id === undefined || source.module_id === null ? '' : String(source.module_id);
                var moduleMeta = null;
                for (var i = 0; i < normalizedModules.length; i += 1) {
                  if (normalizedModules[i] && String(normalizedModules[i].id || '') === moduleId) {
                    moduleMeta = normalizedModules[i];
                    break;
                  }
                }
                normalizedItems.push(assistantNormalizeMissingLibraryItem(source, normalizedItems.length, moduleMeta));
              });
            });
            return {
              ok: true,
              hasContext: true,
              scope: 'project',
              projectId: projectId,
              totalModules: normalizedModules.length,
              totalItems: normalizedItems.length,
              modules: normalizedModules,
              items: normalizedItems,
              libraryEmpty: normalizedItems.length === 0,
            };
          });
        })
        .catch(function(err) {
          return {
            ok: false,
            reason: err && err.message ? String(err.message) : '读取漏测用例库失败',
            projectId: projectId,
            totalModules: 0,
            totalItems: 0,
            modules: [],
            items: [],
            libraryEmpty: false,
          };
        });
    }

    function assistantReadMissingLibrarySnapshot(options) {
      var opts = options && typeof options === 'object' ? options : {};
      var scope = opts.scope === undefined || opts.scope === null ? '' : String(opts.scope).trim().toLowerCase();
      var queryText = opts.query === undefined || opts.query === null
        ? (opts.searchText === undefined || opts.searchText === null ? '' : String(opts.searchText).trim())
        : String(opts.query).trim();
      var limit = Number(opts.limit);
      if (!Number.isFinite(limit) || limit <= 0) limit = 40;
      if (limit > 1000) limit = 1000;
      if (scope === 'view' || scope === 'visible') {
        var snapshot = assistantReadMissingViewSnapshot(limit);
        if (snapshot) {
          var visibleItems = Array.isArray(snapshot.items) ? snapshot.items : [];
          var filteredVisible = queryText ? assistantFilterMissingLibraryItems(visibleItems, queryText) : visibleItems.slice();
          var viewItems = filteredVisible.slice(0, limit);
          return Promise.resolve({
            ok: true,
            hasContext: true,
            scope: snapshot.scope || 'missing-view',
            contextSource: 'case-library',
            projectId: snapshot.projectId || '',
            projectName: snapshot.projectName || '',
            totalModules: Number(snapshot.totalModules) || 0,
            totalItems: Number(snapshot.totalAll) || visibleItems.length,
            total: filteredVisible.length,
            totalAll: Number(snapshot.total) || visibleItems.length,
            typeFilters: Array.isArray(snapshot.typeFilters) ? snapshot.typeFilters.slice() : [],
            typeFilterLabels: Array.isArray(snapshot.typeFilterLabels) ? snapshot.typeFilterLabels.slice() : [],
            modules: Array.isArray(snapshot.modules) ? snapshot.modules.slice() : [],
            items: viewItems,
            queryText: queryText,
            truncated: filteredVisible.length > viewItems.length,
            libraryEmpty: (Number(snapshot.totalAll) || visibleItems.length) <= 0,
          });
        }
      }
      return assistantLoadMissingLibraryProjectData(opts).then(function(res) {
        if (!res || res.ok !== true) return res;
        var sourceItems = Array.isArray(res.items) ? res.items : [];
        var filteredItems = queryText ? assistantFilterMissingLibraryItems(sourceItems, queryText) : sourceItems.slice();
        var visibleItems = filteredItems.slice(0, limit);
        return {
          ok: true,
          hasContext: res.hasContext === true,
          scope: 'project',
          contextSource: 'project',
          projectId: res.projectId || '',
          projectName: res.projectName || '',
          totalModules: Number(res.totalModules) || 0,
          totalItems: Number(res.totalItems) || sourceItems.length,
          total: filteredItems.length,
          totalAll: sourceItems.length,
          modules: Array.isArray(res.modules) ? res.modules.slice(0, 200) : [],
          items: visibleItems,
          queryText: queryText,
          truncated: filteredItems.length > visibleItems.length,
          libraryEmpty: res.libraryEmpty === true,
        };
      });
    }

    function assistantBuildCaseMatchFieldMap(item) {
      var row = item && typeof item === 'object' ? item : {};
      var precondition = row.precondition !== undefined && row.precondition !== null ? row.precondition : row.preconditions;
      var moduleText = assistantNormalizeMissingLibraryText(row.module);
      var titleText = assistantNormalizeMissingLibraryText(row.title);
      var preText = assistantNormalizeMissingLibraryText(precondition);
      var stepsText = assistantNormalizeMissingLibraryText(row.steps);
      var expectedText = assistantNormalizeMissingLibraryText(row.expected);
      return {
        module: moduleText,
        title: titleText,
        precondition: preText,
        steps: stepsText,
        expected: expectedText,
        combined: [moduleText, titleText, preText, stepsText, expectedText].filter(Boolean).join('\n'),
      };
    }

    function assistantBuildMissingLibraryKeywordInfo(item) {
      var row = item && typeof item === 'object' ? item : {};
      return {
        module: typeof buildMissingReminderKeywords === 'function' ? buildMissingReminderKeywords(row.module || '') : [],
        title: typeof buildMissingReminderKeywords === 'function' ? buildMissingReminderKeywords(row.title || '') : [],
        precondition: typeof buildMissingReminderKeywords === 'function' ? buildMissingReminderKeywords(row.precondition || '') : [],
        steps: typeof buildMissingReminderKeywords === 'function' ? buildMissingReminderKeywords(row.steps || '') : [],
        expected: typeof buildMissingReminderKeywords === 'function' ? buildMissingReminderKeywords(row.expected || '') : [],
      };
    }

    function assistantCollectMissingLibraryKeywordHits(text, keywords, limit) {
      var sourceText = assistantNormalizeMissingLibraryText(text);
      var list = Array.isArray(keywords) ? keywords : [];
      var max = Number(limit);
      if (!Number.isFinite(max) || max <= 0) max = 3;
      var hits = [];
      var seen = {};
      if (!sourceText || !list.length) return hits;
      for (var i = 0; i < list.length; i += 1) {
        var keyword = list[i] === undefined || list[i] === null ? '' : String(list[i]).trim().toLowerCase();
        if (!keyword || seen[keyword]) continue;
        if (sourceText.indexOf(keyword) === -1) continue;
        seen[keyword] = true;
        hits.push(keyword);
        if (hits.length >= max) break;
      }
      return hits;
    }

    function assistantResolveMissingLibraryMatchLevel(score) {
      var num = Number(score);
      if (!Number.isFinite(num)) return '低';
      if (num >= 5) return '高';
      if (num >= 3) return '中';
      return '低';
    }

    function assistantCompareCrossPageMissingCaseMatch(a, b) {
      var left = a && typeof a === 'object' ? a : {};
      var right = b && typeof b === 'object' ? b : {};
      var strictA = left.strictMatched === true ? 1 : 0;
      var strictB = right.strictMatched === true ? 1 : 0;
      if (strictA !== strictB) return strictB - strictA;
      var scoreA = Number(left.score);
      var scoreB = Number(right.score);
      if (!Number.isFinite(scoreA)) scoreA = 0;
      if (!Number.isFinite(scoreB)) scoreB = 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      var fieldHitA = Number(left.fieldHitCount);
      var fieldHitB = Number(right.fieldHitCount);
      if (!Number.isFinite(fieldHitA)) fieldHitA = 0;
      if (!Number.isFinite(fieldHitB)) fieldHitB = 0;
      if (fieldHitA !== fieldHitB) return fieldHitB - fieldHitA;
      var caseA = Number(left.currentCase ? left.currentCase.index : 0);
      var caseB = Number(right.currentCase ? right.currentCase.index : 0);
      if (!Number.isFinite(caseA)) caseA = 0;
      if (!Number.isFinite(caseB)) caseB = 0;
      if (caseA !== caseB) return caseA - caseB;
      var missingA = Number(left.missingItem ? left.missingItem.index : 0);
      var missingB = Number(right.missingItem ? right.missingItem.index : 0);
      if (!Number.isFinite(missingA)) missingA = 0;
      if (!Number.isFinite(missingB)) missingB = 0;
      return missingA - missingB;
    }

    function assistantResolveCrossPageMissingCaseCandidateLevel(match) {
      var row = match && typeof match === 'object' ? match : {};
      if (row.strictMatched === true) return '高相关';
      var score = Number(row.score);
      if (!Number.isFinite(score)) score = 0;
      var fieldHitCount = Number(row.fieldHitCount);
      if (!Number.isFinite(fieldHitCount)) fieldHitCount = 0;
      var titleHitCount = Number(row.titleHitCount);
      if (!Number.isFinite(titleHitCount)) titleHitCount = 0;
      var preHitCount = Number(row.preHitCount);
      if (!Number.isFinite(preHitCount)) preHitCount = 0;
      var stepHitCount = Number(row.stepHitCount);
      if (!Number.isFinite(stepHitCount)) stepHitCount = 0;
      var expectedHitCount = Number(row.expectedHitCount);
      if (!Number.isFinite(expectedHitCount)) expectedHitCount = 0;
      if (score >= 4 || (titleHitCount && fieldHitCount >= 2) || (stepHitCount + expectedHitCount) >= 2) return '高相关候选';
      if (score >= 2 || fieldHitCount >= 2 || titleHitCount || preHitCount) return '建议关注';
      return '弱相关候选';
    }

    function assistantShouldKeepCrossPageMissingCaseCandidate(match) {
      var row = match && typeof match === 'object' ? match : {};
      if (row.strictMatched === true) return true;
      var fieldHitCount = Number(row.fieldHitCount);
      if (!Number.isFinite(fieldHitCount) || fieldHitCount <= 0) return false;
      var titleHitCount = Number(row.titleHitCount);
      if (!Number.isFinite(titleHitCount)) titleHitCount = 0;
      var moduleHitCount = Number(row.moduleHitCount);
      if (!Number.isFinite(moduleHitCount)) moduleHitCount = 0;
      var preHitCount = Number(row.preHitCount);
      if (!Number.isFinite(preHitCount)) preHitCount = 0;
      var stepHitCount = Number(row.stepHitCount);
      if (!Number.isFinite(stepHitCount)) stepHitCount = 0;
      var expectedHitCount = Number(row.expectedHitCount);
      if (!Number.isFinite(expectedHitCount)) expectedHitCount = 0;
      if (titleHitCount > 0) return true;
      if ((stepHitCount + expectedHitCount) >= 2) return true;
      if (fieldHitCount >= 2) return true;
      return moduleHitCount > 0 && (preHitCount > 0 || stepHitCount > 0 || expectedHitCount > 0);
    }

    function assistantBuildCrossPageMissingCasePairKey(match) {
      var row = match && typeof match === 'object' ? match : {};
      var currentCase = row.currentCase && typeof row.currentCase === 'object' ? row.currentCase : {};
      var missingItem = row.missingItem && typeof row.missingItem === 'object' ? row.missingItem : {};
      var caseKey = String(currentCase.id || currentCase.index || '');
      var missingKey = String(missingItem.id || missingItem.index || '');
      return caseKey + '::' + missingKey;
    }

    function assistantDecorateCrossPageMissingCaseMatch(match, index) {
      var row = match && typeof match === 'object' ? match : {};
      return {
        index: Number(index) + 1,
        score: Number(row.score) || 0,
        matchLevel: row.matchLevel ? String(row.matchLevel) : '',
        candidateLevel: row.candidateLevel ? String(row.candidateLevel) : assistantResolveCrossPageMissingCaseCandidateLevel(row),
        strictMatched: row.strictMatched === true,
        fieldHitCount: Number(row.fieldHitCount) || 0,
        moduleHitCount: Number(row.moduleHitCount) || 0,
        titleHitCount: Number(row.titleHitCount) || 0,
        preHitCount: Number(row.preHitCount) || 0,
        stepHitCount: Number(row.stepHitCount) || 0,
        expectedHitCount: Number(row.expectedHitCount) || 0,
        reasons: Array.isArray(row.reasons) ? row.reasons.slice(0, 4) : [],
        keywordHits: row.keywordHits && typeof row.keywordHits === 'object' ? {
          module: Array.isArray(row.keywordHits.module) ? row.keywordHits.module.slice(0, 2) : [],
          title: Array.isArray(row.keywordHits.title) ? row.keywordHits.title.slice(0, 4) : [],
          precondition: Array.isArray(row.keywordHits.precondition) ? row.keywordHits.precondition.slice(0, 3) : [],
          steps: Array.isArray(row.keywordHits.steps) ? row.keywordHits.steps.slice(0, 4) : [],
          expected: Array.isArray(row.keywordHits.expected) ? row.keywordHits.expected.slice(0, 4) : [],
        } : {
          module: [],
          title: [],
          precondition: [],
          steps: [],
          expected: [],
        },
        currentCase: row.currentCase,
        missingItem: row.missingItem,
      };
    }

    function assistantComputeCrossPageMissingCaseMatch(caseItem, missingItem) {
      var currentCase = caseItem && typeof caseItem === 'object' ? caseItem : {};
      var target = missingItem && typeof missingItem === 'object' ? missingItem : {};
      var caseMap = assistantBuildCaseMatchFieldMap(currentCase);
      var keywordInfo = assistantBuildMissingLibraryKeywordInfo(target);
      var score = 0;
      var reasons = [];
      var moduleHits = assistantCollectMissingLibraryKeywordHits(caseMap.combined, keywordInfo.module, 2);
      var titleHits = assistantCollectMissingLibraryKeywordHits(caseMap.combined, keywordInfo.title, 4);
      var preHits = assistantCollectMissingLibraryKeywordHits(caseMap.precondition + '\n' + caseMap.steps + '\n' + caseMap.expected, keywordInfo.precondition, 3);
      var stepHits = assistantCollectMissingLibraryKeywordHits(caseMap.steps + '\n' + caseMap.expected, keywordInfo.steps, 4);
      var expectedHits = assistantCollectMissingLibraryKeywordHits(caseMap.expected + '\n' + caseMap.steps, keywordInfo.expected, 4);
      if (moduleHits.length) {
        score += 1;
        reasons.push('模块命中：' + moduleHits.join('、'));
      }
      if (titleHits.length) {
        score += Math.min(3, titleHits.length + 1);
        reasons.push('标题命中：' + titleHits.join('、'));
      }
      if (preHits.length) {
        score += 1;
        reasons.push('前置命中：' + preHits.join('、'));
      }
      if (stepHits.length) {
        score += 1;
        reasons.push('步骤命中：' + stepHits.join('、'));
      }
      if (expectedHits.length) {
        score += 1;
        reasons.push('预期命中：' + expectedHits.join('、'));
      }
      var fieldHitCount = 0;
      if (moduleHits.length) fieldHitCount += 1;
      if (titleHits.length) fieldHitCount += 1;
      if (preHits.length) fieldHitCount += 1;
      if (stepHits.length) fieldHitCount += 1;
      if (expectedHits.length) fieldHitCount += 1;
      if (!fieldHitCount) return null;
      var strictMatched = true;
      if (score < 2 && titleHits.length < 2 && fieldHitCount < 2 && !(stepHits.length && expectedHits.length)) strictMatched = false;
      if (!titleHits.length && !moduleHits.length && !(stepHits.length && expectedHits.length)) strictMatched = false;
      var result = {
        score: score,
        matchLevel: assistantResolveMissingLibraryMatchLevel(score),
        strictMatched: strictMatched,
        fieldHitCount: fieldHitCount,
        moduleHitCount: moduleHits.length,
        titleHitCount: titleHits.length,
        preHitCount: preHits.length,
        stepHitCount: stepHits.length,
        expectedHitCount: expectedHits.length,
        reasons: reasons,
        keywordHits: {
          module: moduleHits,
          title: titleHits,
          precondition: preHits,
          steps: stepHits,
          expected: expectedHits,
        },
        currentCase: {
          index: currentCase.index === undefined || currentCase.index === null ? '' : currentCase.index,
          id: currentCase.id === undefined || currentCase.id === null ? '' : String(currentCase.id),
          module: currentCase.module === undefined || currentCase.module === null ? '' : String(currentCase.module),
          title: currentCase.title === undefined || currentCase.title === null ? '' : String(currentCase.title),
          priority: currentCase.priority === undefined || currentCase.priority === null ? '' : String(currentCase.priority),
          precondition: currentCase.precondition === undefined || currentCase.precondition === null ? '' : String(currentCase.precondition),
          steps: currentCase.steps === undefined || currentCase.steps === null ? '' : String(currentCase.steps),
          expected: currentCase.expected === undefined || currentCase.expected === null ? '' : String(currentCase.expected),
        },
        missingItem: {
          index: target.index === undefined || target.index === null ? '' : target.index,
          id: target.id === undefined || target.id === null ? '' : String(target.id),
          module: target.module === undefined || target.module === null ? '' : String(target.module),
          typeLabel: target.typeLabel === undefined || target.typeLabel === null ? '' : String(target.typeLabel),
          title: target.title === undefined || target.title === null ? '' : String(target.title),
          priority: target.priority === undefined || target.priority === null ? '' : String(target.priority),
          precondition: target.precondition === undefined || target.precondition === null ? '' : String(target.precondition),
          steps: target.steps === undefined || target.steps === null ? '' : String(target.steps),
          expected: target.expected === undefined || target.expected === null ? '' : String(target.expected),
        },
      };
      result.candidateLevel = assistantResolveCrossPageMissingCaseCandidateLevel(result);
      return result;
    }

    function assistantMatchCurrentCasesWithMissingLibrary(options) {
      var opts = options && typeof options === 'object' ? options : {};
      var caseLimit = Number(opts.caseLimit);
      if (!Number.isFinite(caseLimit) || caseLimit <= 0) caseLimit = 1000;
      if (caseLimit > 2000) caseLimit = 2000;
      var matchLimit = Number(opts.limit);
      if (!Number.isFinite(matchLimit) || matchLimit <= 0) matchLimit = 60;
      if (matchLimit > 500) matchLimit = 500;
      var candidateLimit = Number(opts.candidateLimit);
      if (!Number.isFinite(candidateLimit) || candidateLimit <= 0) candidateLimit = Math.max(matchLimit * 2, 40);
      if (candidateLimit > 200) candidateLimit = 200;
      var candidatePerMissingLimit = Number(opts.candidatePerMissingLimit);
      if (!Number.isFinite(candidatePerMissingLimit) || candidatePerMissingLimit <= 0) candidatePerMissingLimit = 3;
      if (candidatePerMissingLimit > 5) candidatePerMissingLimit = 5;
      return assistantListCurrentCases({
        limit: caseLimit,
        scope: 'editor',
        requireEditor: true,
        detailLevel: 'full',
      }).then(function(currentCases) {
        var currentRes = currentCases && typeof currentCases === 'object' ? currentCases : null;
        var currentItems = currentRes && Array.isArray(currentRes.items) ? currentRes.items : [];
        if (!currentRes || currentRes.ok !== true || !currentItems.length || !currentRes.caseFile || typeof currentRes.caseFile !== 'object') {
          return {
            ok: true,
            hasContext: false,
            reason: 'no-current-cases',
            projectId: assistantResolveMissingLibraryProjectId(opts),
            currentCaseTotal: currentRes && Number.isFinite(Number(currentRes.total)) ? Number(currentRes.total) : currentItems.length,
            missingLibraryTotal: 0,
            totalModules: 0,
            matchTotal: 0,
            matchedCaseCount: 0,
            matchedMissingItemCount: 0,
            candidateTotal: 0,
            candidateMatchedCaseCount: 0,
            candidateMatchedMissingItemCount: 0,
            matches: [],
            candidates: [],
            truncated: false,
            candidateTruncated: false,
            libraryEmpty: false,
          };
        }
        return assistantLoadMissingLibraryProjectData({ projectId: assistantResolveMissingLibraryProjectId({ currentCases: currentRes, projectId: opts.projectId }) })
          .then(function(libraryRes) {
            if (!libraryRes || libraryRes.ok !== true) return libraryRes;
            var missingItems = Array.isArray(libraryRes.items) ? libraryRes.items : [];
            var matches = [];
            var candidates = [];
            var matchedCaseMap = {};
            var matchedMissingMap = {};
            var candidateCaseMap = {};
            var candidateMissingMap = {};
            var candidatePairMap = {};
            missingItems.forEach(function(missingItem) {
              var rankedMatches = [];
              currentItems.forEach(function(caseItem) {
                var nextMatch = assistantComputeCrossPageMissingCaseMatch(caseItem, missingItem);
                if (!nextMatch) return;
                rankedMatches.push(nextMatch);
              });
              if (!rankedMatches.length) return;
              rankedMatches.sort(assistantCompareCrossPageMissingCaseMatch);
              var bestStrict = null;
              for (var i = 0; i < rankedMatches.length; i += 1) {
                if (rankedMatches[i] && rankedMatches[i].strictMatched === true) {
                  bestStrict = rankedMatches[i];
                  break;
                }
              }
              var bestStrictKey = '';
              if (bestStrict) {
                matches.push(bestStrict);
                bestStrictKey = assistantBuildCrossPageMissingCasePairKey(bestStrict);
                var caseKey = String(bestStrict.currentCase.id || bestStrict.currentCase.index || matches.length);
                var missingKey = String(bestStrict.missingItem.id || bestStrict.missingItem.index || matches.length);
                matchedCaseMap[caseKey] = true;
                matchedMissingMap[missingKey] = true;
              }
              var candidateCount = 0;
              rankedMatches.forEach(function(row) {
                if (candidateCount >= candidatePerMissingLimit) return;
                if (!assistantShouldKeepCrossPageMissingCaseCandidate(row)) return;
                var pairKey = assistantBuildCrossPageMissingCasePairKey(row);
                if (!pairKey) return;
                if (bestStrictKey && pairKey === bestStrictKey) return;
                if (candidatePairMap[pairKey]) return;
                candidatePairMap[pairKey] = true;
                candidates.push(row);
                candidateCaseMap[String(row.currentCase.id || row.currentCase.index || candidates.length)] = true;
                candidateMissingMap[String(row.missingItem.id || row.missingItem.index || candidates.length)] = true;
                candidateCount += 1;
              });
            });
            matches.sort(assistantCompareCrossPageMissingCaseMatch);
            candidates.sort(assistantCompareCrossPageMissingCaseMatch);
            var visibleMatches = matches.slice(0, matchLimit).map(function(match, index) {
              return assistantDecorateCrossPageMissingCaseMatch(match, index);
            });
            var visibleCandidates = candidates.slice(0, candidateLimit).map(function(match, index) {
              return assistantDecorateCrossPageMissingCaseMatch(match, index);
            });
            return {
              ok: true,
              hasContext: true,
              scope: 'cross-page',
              projectId: currentRes.projectId || libraryRes.projectId || '',
              projectName: libraryRes.projectName || '',
              caseFile: currentRes.caseFile && typeof currentRes.caseFile === 'object' ? Object.assign({}, currentRes.caseFile) : null,
              currentCaseTotal: Number.isFinite(Number(currentRes.total)) ? Number(currentRes.total) : currentItems.length,
              missingLibraryTotal: Number(libraryRes.totalItems) || missingItems.length,
              totalModules: Number(libraryRes.totalModules) || 0,
              matchTotal: matches.length,
              matchedCaseCount: Object.keys(matchedCaseMap).length,
              matchedMissingItemCount: Object.keys(matchedMissingMap).length,
              candidateTotal: candidates.length,
              candidateMatchedCaseCount: Object.keys(candidateCaseMap).length,
              candidateMatchedMissingItemCount: Object.keys(candidateMissingMap).length,
              matches: visibleMatches,
              candidates: visibleCandidates,
              truncated: matches.length > visibleMatches.length,
              candidateTruncated: candidates.length > visibleCandidates.length,
              libraryEmpty: libraryRes.libraryEmpty === true,
            };
          });
      });
    }

    function assistantNormalizeTempExecCaseItem(item, index) {
      var row = item && typeof item === 'object' ? item : {};
      var pre = row.precondition !== undefined && row.precondition !== null
        ? row.precondition
        : row.preconditions;
      var executionResultRaw = row.executionResult !== undefined && row.executionResult !== null
        ? row.executionResult
        : (row.actual !== undefined && row.actual !== null
          ? row.actual
          : (row.status !== undefined && row.status !== null
            ? row.status
            : row.result));
      return {
        index: index + 1,
        sourceIndex: index + 1,
        id: row.id === undefined || row.id === null ? '' : String(row.id),
        module: row.module === undefined || row.module === null ? '' : String(row.module),
        title: row.title === undefined || row.title === null ? '' : String(row.title),
        priority: row.priority === undefined || row.priority === null ? '' : String(row.priority),
        precondition: pre === undefined || pre === null ? '' : String(pre),
        steps: row.steps === undefined || row.steps === null ? '' : String(row.steps),
        expected: row.expected === undefined || row.expected === null ? '' : String(row.expected),
        remark: row.remark === undefined || row.remark === null ? '' : String(row.remark),
        actual: row.actual === undefined || row.actual === null ? '' : String(row.actual),
        status: row.status === undefined || row.status === null ? '' : String(row.status),
        result: row.result === undefined || row.result === null ? '' : String(row.result),
        executionResult: executionResultRaw === undefined || executionResultRaw === null ? '' : String(executionResultRaw),
        updatedAt: '',
      };
    }

    function assistantReadTempExecCaseSnapshot(limit) {
      var activeTab = state.activeTab ? String(state.activeTab) : '';
      if (activeTab !== 'tempexec') return null;
      var list = Array.isArray(state.tempExecFiles) ? state.tempExecFiles : [];
      var activeIdRaw = state.tempExecActiveId || state.tempExecActiveFileId || '';
      var activeId = activeIdRaw === undefined || activeIdRaw === null ? '' : String(activeIdRaw);
      if (!activeId || !list.length) return null;
      var currentFile = null;
      for (var i = 0; i < list.length; i += 1) {
        var file = list[i] && typeof list[i] === 'object' ? list[i] : null;
        if (!file) continue;
        var fileId = file.id === undefined || file.id === null ? '' : String(file.id);
        if (fileId && fileId === activeId) {
          currentFile = file;
          break;
        }
      }
      if (!currentFile || !Array.isArray(currentFile.cases)) return null;
      var allItems = currentFile.cases.map(function(item, idx) {
        return assistantNormalizeTempExecCaseItem(item, idx);
      });
      var items = allItems.slice(0, limit);
      var fileIdText = currentFile.id === undefined || currentFile.id === null ? '' : String(currentFile.id);
      var caseName = currentFile.name || currentFile.file_name_clean || currentFile.fileName || '';
      var caseFile = {
        id: fileIdText,
        name: caseName ? String(caseName) : (fileIdText ? ('用例#' + fileIdText) : '当前用例'),
        projectId: currentFile.projectId === undefined || currentFile.projectId === null
          ? (currentFile.project_id === undefined || currentFile.project_id === null ? '' : String(currentFile.project_id))
          : String(currentFile.projectId),
        versionId: currentFile.versionId === undefined || currentFile.versionId === null
          ? (currentFile.version_id === undefined || currentFile.version_id === null ? '' : String(currentFile.version_id))
          : String(currentFile.versionId),
        updatedAt: '',
      };
      return {
        ok: true,
        scope: 'editor',
        contextSource: 'tempexec',
        projectId: caseFile.projectId || '',
        caseFile: caseFile,
        searchText: '',
        total: allItems.length,
        totalAll: allItems.length,
        items: items,
        truncated: allItems.length > items.length,
      };
    }

    function assistantListCurrentCases(options) {
      var opts = options && typeof options === 'object' ? options : {};
      var limit = Number(opts.limit);
      if (!Number.isFinite(limit) || limit <= 0) limit = 20;
      if (limit > 1000) limit = 1000;
      var scope = opts.scope === undefined || opts.scope === null ? '' : String(opts.scope).trim().toLowerCase();
      var requireEditor = opts.requireEditor === true || scope === 'editor';
      var activeTab = state.activeTab ? String(state.activeTab) : '';
      var editorSnapshot = assistantReadEditorCaseSnapshot(limit);
      if (editorSnapshot && editorSnapshot.ok === true) {
        return Promise.resolve(editorSnapshot);
      }
      if (activeTab === 'tempexec' || !requireEditor) {
        var tempExecSnapshot = assistantReadTempExecCaseSnapshot(limit);
        if (tempExecSnapshot && tempExecSnapshot.ok === true) {
          return Promise.resolve(tempExecSnapshot);
        }
      }
      var projectId = assistantResolveCaseLibraryProjectId(opts);
      if (requireEditor) {
        return Promise.resolve({
          ok: true,
          scope: 'editor',
          hasContext: false,
          reason: 'no-active-editor',
          projectId: projectId || '',
          total: 0,
          totalAll: 0,
          items: [],
          truncated: false,
        });
      }
      var apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
      if (!apiClient || typeof apiClient.listCaseFiles !== 'function') {
        return Promise.resolve({
          ok: false,
          reason: '用例列表能力暂不可用',
          projectId: projectId || '',
          total: 0,
          items: [],
        });
      }
      return apiClient.listCaseFiles(projectId || undefined)
        .then(function(files) {
          var list = Array.isArray(files) ? files : [];
          var normalized = list.map(function(file, idx) { return assistantNormalizeCaseFile(file, idx); });
          var items = normalized.slice(0, limit);
          return {
            ok: true,
            scope: 'project',
            projectId: projectId || '',
            total: normalized.length,
            items: items,
            truncated: normalized.length > items.length,
          };
        })
        .catch(function(err) {
          return {
            ok: false,
            reason: err && err.message ? String(err.message) : '读取用例列表失败',
            projectId: projectId || '',
            total: 0,
            items: [],
          };
        });
    }

    function assistantNormalizeCaseLibraryQueryKeywordList(value) {
      var source = Array.isArray(value)
        ? value
        : (value === undefined || value === null ? [] : [value]);
      var seen = {};
      var list = [];
      source.forEach(function(raw) {
        var text = raw === undefined || raw === null ? '' : String(raw).trim();
        var key = '';
        if (!text) return;
        key = text.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        list.push(text);
      });
      return list;
    }

    function assistantNormalizeCaseLibraryQueryParity(value) {
      var text = value === undefined || value === null ? '' : String(value).trim().toLowerCase();
      if (!text) return '';
      if (text === 'odd' || text === '奇数' || text === '单数' || text === '单号') return 'odd';
      if (text === 'even' || text === '偶数' || text === '双数' || text === '双号') return 'even';
      return '';
    }

    function assistantNormalizeCaseLibraryQueryFilterInfo(options) {
      var opts = options && typeof options === 'object' ? options : {};
      var rawFilter = opts.filterInfo && typeof opts.filterInfo === 'object' ? opts.filterInfo : {};
      var info = {
        includeKeywords: assistantNormalizeCaseLibraryQueryKeywordList(
          rawFilter.includeKeywords !== undefined
            ? rawFilter.includeKeywords
            : (opts.includeKeywords !== undefined
              ? opts.includeKeywords
              : (opts.keywords !== undefined ? opts.keywords : opts.keyword))
        ),
        excludeKeywords: assistantNormalizeCaseLibraryQueryKeywordList(
          rawFilter.excludeKeywords !== undefined
            ? rawFilter.excludeKeywords
            : (opts.excludeKeywords !== undefined ? opts.excludeKeywords : opts.exclude)
        ),
        indexParity: assistantNormalizeCaseLibraryQueryParity(
          rawFilter.indexParity !== undefined ? rawFilter.indexParity : (opts.indexParity !== undefined ? opts.indexParity : opts.sequenceParity)
        ),
        idParity: assistantNormalizeCaseLibraryQueryParity(
          rawFilter.idParity !== undefined ? rawFilter.idParity : (opts.idParity !== undefined ? opts.idParity : opts.caseIdParity)
        ),
        hasFilter: false,
      };
      info.hasFilter = info.includeKeywords.length > 0
        || info.excludeKeywords.length > 0
        || Boolean(info.indexParity)
        || Boolean(info.idParity);
      return info;
    }

    function assistantResolveCaseLibraryQueryText(options) {
      var opts = options && typeof options === 'object' ? options : {};
      var candidates = [opts.query, opts.q, opts.text, opts.searchText, opts.search, opts.keyword];
      for (var i = 0; i < candidates.length; i += 1) {
        if (candidates[i] === undefined || candidates[i] === null) continue;
        var text = String(candidates[i]).trim();
        if (text) return text;
      }
      var keywordList = assistantNormalizeCaseLibraryQueryKeywordList(opts.keywords !== undefined ? opts.keywords : opts.includeKeywords);
      return keywordList.join(' ');
    }

    function assistantBuildCaseLibraryProjectNameMap(projects) {
      var list = Array.isArray(projects) ? projects : [];
      var map = {};
      list.forEach(function(item) {
        var row = item && typeof item === 'object' ? item : {};
        var id = row.id === undefined || row.id === null ? '' : String(row.id);
        if (!id) return;
        map[id] = row.name === undefined || row.name === null ? '' : String(row.name);
      });
      return map;
    }

    function assistantResolveCaseLibraryQueryProjectByName(projects, projectName) {
      var target = projectName === undefined || projectName === null ? '' : String(projectName).trim().toLowerCase();
      var list = Array.isArray(projects) ? projects : [];
      var partial = null;
      if (!target) return null;
      for (var i = 0; i < list.length; i += 1) {
        var row = list[i] && typeof list[i] === 'object' ? list[i] : {};
        var name = row.name === undefined || row.name === null ? '' : String(row.name).trim();
        var normalized = name.toLowerCase();
        if (!normalized) continue;
        if (normalized === target) return row;
        if (!partial && normalized.indexOf(target) !== -1) partial = row;
      }
      return partial;
    }

    function assistantResolveCaseLibraryQuerySequenceNumber(item, fallbackIndex) {
      var row = item && typeof item === 'object' ? item : {};
      var raw = row.order_no;
      var num = NaN;
      var match = null;
      if (raw === undefined || raw === null || raw === '') raw = row.sourceIndex;
      if (raw === undefined || raw === null || raw === '') raw = row.index;
      num = Number(raw);
      if (!Number.isFinite(num)) {
        match = String(raw === undefined || raw === null ? '' : raw).match(/-?d+/);
        num = match && match[0] ? Number(match[0]) : NaN;
      }
      if (!Number.isFinite(num) || num <= 0) num = Number(fallbackIndex);
      if (!Number.isFinite(num) || num <= 0) return NaN;
      return Math.floor(num);
    }

    function assistantResolveCaseLibraryQueryIdNumber(item) {
      var row = item && typeof item === 'object' ? item : {};
      var raw = row.id === undefined || row.id === null ? '' : String(row.id).trim();
      var num = NaN;
      if (!raw) return NaN;
      if (!/^[-+]?d+$/.test(raw)) return NaN;
      num = Number(raw);
      if (!Number.isFinite(num)) return NaN;
      return Math.floor(Math.abs(num));
    }

    function assistantDoesCaseLibraryNumberMatchParity(num, parity) {
      if (!Number.isFinite(num)) return false;
      if (parity === 'even') return Math.abs(num % 2) === 0;
      if (parity === 'odd') return Math.abs(num % 2) === 1;
      return true;
    }

    function assistantBuildCaseLibraryQueryItemSearchText(item, caseFileMeta) {
      var row = item && typeof item === 'object' ? item : {};
      var meta = caseFileMeta && typeof caseFileMeta === 'object' ? caseFileMeta : {};
      var payload = [{
        id: row.id,
        index: row.index,
        sourceIndex: row.sourceIndex,
        module: row.module,
        title: row.title,
        priority: row.priority,
        precondition: row.precondition,
        preconditions: row.preconditions,
        steps: row.steps,
        expected: row.expected,
        remark: row.remark,
        caseFileName: meta.caseFileName || meta.name || '',
        projectName: meta.projectName || '',
      }];
      if (typeof buildCaseSearchText === 'function') {
        return String(buildCaseSearchText(payload) || '');
      }
      return payload.map(function(entry) {
        return Object.keys(entry).map(function(key) {
          return stringifyCaseField(entry[key]);
        }).join(' ');
      }).join(' ').toLowerCase();
    }

    function assistantMatchCaseLibraryQueryItem(item, caseFileMeta, filterInfo, queryText, fallbackIndex) {
      var info = filterInfo && typeof filterInfo === 'object' ? filterInfo : {};
      var includeKeywords = Array.isArray(info.includeKeywords) ? info.includeKeywords : [];
      var excludeKeywords = Array.isArray(info.excludeKeywords) ? info.excludeKeywords : [];
      var indexParity = info.indexParity ? String(info.indexParity).trim() : '';
      var idParity = info.idParity ? String(info.idParity).trim() : '';
      var normalizedQuery = queryText === undefined || queryText === null ? '' : String(queryText).trim().toLowerCase();
      var searchText = assistantBuildCaseLibraryQueryItemSearchText(item, caseFileMeta);
      var matchedKeywords = [];
      var i = 0;
      if (indexParity && !assistantDoesCaseLibraryNumberMatchParity(assistantResolveCaseLibraryQuerySequenceNumber(item, fallbackIndex), indexParity)) {
        return { matched: false, matchedKeywords: [] };
      }
      if (idParity && !assistantDoesCaseLibraryNumberMatchParity(assistantResolveCaseLibraryQueryIdNumber(item), idParity)) {
        return { matched: false, matchedKeywords: [] };
      }
      if (includeKeywords.length) {
        var includeHit = false;
        for (i = 0; i < includeKeywords.length; i += 1) {
          var includeKeyword = String(includeKeywords[i] || '').trim().toLowerCase();
          if (!includeKeyword) continue;
          if (searchText.indexOf(includeKeyword) !== -1) {
            includeHit = true;
            matchedKeywords.push(String(includeKeywords[i] || '').trim());
          }
        }
        if (!includeHit) return { matched: false, matchedKeywords: [] };
      } else if (normalizedQuery) {
        if (searchText.indexOf(normalizedQuery) === -1) {
          return { matched: false, matchedKeywords: [] };
        }
        matchedKeywords.push(String(queryText || '').trim());
      }
      for (i = 0; i < excludeKeywords.length; i += 1) {
        var excludeKeyword = String(excludeKeywords[i] || '').trim().toLowerCase();
        if (!excludeKeyword) continue;
        if (searchText.indexOf(excludeKeyword) !== -1) return { matched: false, matchedKeywords: [] };
      }
      return {
        matched: true,
        matchedKeywords: assistantNormalizeCaseLibraryQueryKeywordList(matchedKeywords),
      };
    }

    function assistantBuildCaseLibraryQueryChunks(items, chunkSize) {
      var list = Array.isArray(items) ? items : [];
      var size = Number(chunkSize);
      var chunks = [];
      var i = 0;
      if (!Number.isFinite(size) || size <= 0) size = list.length || 1;
      for (i = 0; i < list.length; i += size) {
        chunks.push(list.slice(i, i + size));
      }
      return chunks;
    }

    function assistantNormalizeCaseLibraryQueryItem(item, caseFile, projectName, fallbackIndex, matchedKeywords) {
      var row = item && typeof item === 'object' ? item : {};
      var file = caseFile && typeof caseFile === 'object' ? caseFile : {};
      var sourceIndex = assistantResolveCaseLibraryQuerySequenceNumber(row, fallbackIndex);
      return {
        index: Number.isFinite(sourceIndex) ? sourceIndex : fallbackIndex,
        sourceIndex: Number.isFinite(sourceIndex) ? sourceIndex : fallbackIndex,
        id: row.id === undefined || row.id === null ? '' : String(row.id),
        module: row.module === undefined || row.module === null ? '' : String(row.module),
        title: row.title === undefined || row.title === null ? '' : String(row.title),
        priority: row.priority === undefined || row.priority === null ? '' : String(row.priority),
        precondition: row.precondition !== undefined && row.precondition !== null
          ? String(row.precondition)
          : (row.preconditions !== undefined && row.preconditions !== null ? String(row.preconditions) : ''),
        preconditions: row.precondition !== undefined && row.precondition !== null
          ? String(row.precondition)
          : (row.preconditions !== undefined && row.preconditions !== null ? String(row.preconditions) : ''),
        steps: row.steps === undefined || row.steps === null ? '' : String(row.steps),
        expected: row.expected === undefined || row.expected === null ? '' : String(row.expected),
        remark: row.remark === undefined || row.remark === null ? '' : String(row.remark),
        caseFileId: file.id === undefined || file.id === null ? '' : String(file.id),
        caseFileName: file.file_name_clean ? String(file.file_name_clean) : (file.name ? String(file.name) : ''),
        projectId: file.project_id === undefined || file.project_id === null ? '' : String(file.project_id),
        projectName: projectName || '',
        versionId: file.version_id === undefined || file.version_id === null ? '' : String(file.version_id),
        updatedAt: file.updated_at || file.imported_at || '',
        matchedKeywords: assistantNormalizeCaseLibraryQueryKeywordList(matchedKeywords),
      };
    }

    function assistantQueryCaseLibraryCases(options) {
      var opts = options && typeof options === 'object' ? options : {};
      var apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
      var explicitProjectId = opts.projectId === undefined || opts.projectId === null ? '' : String(opts.projectId).trim();
      var explicitProjectName = opts.projectName === undefined || opts.projectName === null ? '' : String(opts.projectName).trim();
      var queryText = assistantResolveCaseLibraryQueryText(opts);
      var filterInfo = assistantNormalizeCaseLibraryQueryFilterInfo(opts);
      var limit = Number(opts.limit);
      var preferCurrentProject = opts.preferCurrentProject !== false;
      var allProjects = opts.allProjects === true || String(opts.scope || '').trim().toLowerCase() === 'all';
      var resolvedProjectId = explicitProjectId;
      var resolvedProjectName = explicitProjectName;
      var contextProjectId = '';
      var projectsPromise = Promise.resolve([]);
      if (!Number.isFinite(limit) || limit <= 0) limit = 20;
      if (limit > 200) limit = 200;
      if (!apiClient || typeof apiClient.listCaseFiles !== 'function' || typeof apiClient.listCaseItems !== 'function') {
        return Promise.resolve({
          ok: false,
          reason: '跨页面用例库内容查询能力暂不可用',
          projectId: resolvedProjectId,
          projectName: resolvedProjectName,
          total: 0,
          items: [],
        });
      }
      if (!resolvedProjectId && !allProjects && preferCurrentProject) {
        contextProjectId = assistantResolveMissingLibraryProjectId(opts) || assistantResolveCaseLibraryProjectId(opts);
        if (contextProjectId) resolvedProjectId = String(contextProjectId);
      }
      if (typeof apiClient.listProjects === 'function') {
        try {
          projectsPromise = Promise.resolve(apiClient.listProjects({ include_all: true })).catch(function() { return []; });
        } catch (err) {
          projectsPromise = Promise.resolve([]);
        }
      }
      return projectsPromise.then(function(projects) {
        var projectMap = assistantBuildCaseLibraryProjectNameMap(projects);
        var matchedProject = null;
        if (!resolvedProjectId && explicitProjectName) {
          matchedProject = assistantResolveCaseLibraryQueryProjectByName(projects, explicitProjectName);
          if (!matchedProject) {
            return {
              ok: false,
              reason: '未找到项目：' + explicitProjectName,
              projectId: '',
              projectName: explicitProjectName,
              total: 0,
              items: [],
            };
          }
          resolvedProjectId = matchedProject.id === undefined || matchedProject.id === null ? '' : String(matchedProject.id);
          resolvedProjectName = matchedProject.name === undefined || matchedProject.name === null ? explicitProjectName : String(matchedProject.name);
        }
        if (!resolvedProjectName && resolvedProjectId && projectMap[resolvedProjectId]) {
          resolvedProjectName = String(projectMap[resolvedProjectId]);
        }
        return apiClient.listCaseFiles(resolvedProjectId || undefined)
          .then(function(files) {
            var fileList = Array.isArray(files) ? files.slice() : [];
            var estimatedItemCount = 0;
            var workerCount = 1;
            var chunkSize = 1;
            var chunks = [];
            var capturePerChunk = 0;
            fileList.forEach(function(file) {
              var count = Number(file && file.item_count);
              if (!Number.isFinite(count) || count < 0) count = 0;
              estimatedItemCount += count;
            });
            if (estimatedItemCount > 120 || fileList.length > 8) workerCount = 2;
            if (estimatedItemCount > 240 || fileList.length > 18) workerCount = 3;
            if (estimatedItemCount > 400 || fileList.length > 32) workerCount = 4;
            if (estimatedItemCount > 700 || fileList.length > 48) workerCount = 5;
            if (estimatedItemCount > 1000 || fileList.length > 64) workerCount = 6;
            chunkSize = Math.max(1, Math.ceil((fileList.length || 1) / workerCount));
            chunks = assistantBuildCaseLibraryQueryChunks(fileList, chunkSize);
            capturePerChunk = Math.max(40, limit);
            if (capturePerChunk > 80) capturePerChunk = 80;
            if (!fileList.length) {
              return {
                ok: true,
                scope: resolvedProjectId ? 'project' : 'all-projects',
                projectId: resolvedProjectId || '',
                projectName: resolvedProjectName || '',
                queryText: queryText,
                filterInfo: filterInfo,
                total: 0,
                matchedFileCount: 0,
                searchedFileCount: 0,
                searchedItemCount: 0,
                projectCount: resolvedProjectId ? 1 : Object.keys(projectMap).length,
                items: [],
                files: [],
                truncated: false,
                fileTruncated: false,
                multiAgent: {
                  used: false,
                  workerCount: 1,
                  chunkCount: 0,
                },
                errorCount: 0,
                errors: [],
              };
            }
            var runner = typeof runConcurrent === 'function'
              ? function(list, concurrency, handler) { return runConcurrent(list, concurrency, handler); }
              : function(list, concurrency, handler) {
                return Promise.all((list || []).map(function(item, index) {
                  return handler(item, index);
                }));
              };
            return runner(chunks, workerCount, async function(chunk, chunkIndex) {
              var matchItems = [];
              var matchFiles = [];
              var errors = [];
              var searchedItemCount = 0;
              var matchTotal = 0;
              for (var i = 0; i < chunk.length; i += 1) {
                var file = chunk[i] && typeof chunk[i] === 'object' ? chunk[i] : {};
                var projectId = file.project_id === undefined || file.project_id === null ? '' : String(file.project_id);
                var projectName = projectMap[projectId] ? String(projectMap[projectId]) : '';
                var caseFileName = file.file_name_clean ? String(file.file_name_clean) : (file.name ? String(file.name) : ('用例#' + (file.id || (i + 1))));
                var fileItems = [];
                var matchedCount = 0;
                try {
                  fileItems = await apiClient.listCaseItems(file.id);
                } catch (err) {
                  errors.push({
                    caseFileId: file.id === undefined || file.id === null ? '' : String(file.id),
                    caseFileName: caseFileName,
                    reason: err && err.message ? String(err.message) : '读取用例内容失败',
                  });
                  continue;
                }
                fileItems = Array.isArray(fileItems) ? fileItems : [];
                searchedItemCount += fileItems.length;
                for (var j = 0; j < fileItems.length; j += 1) {
                  var rawItem = fileItems[j] && typeof fileItems[j] === 'object' ? fileItems[j] : {};
                  var matched = assistantMatchCaseLibraryQueryItem(rawItem, {
                    caseFileName: caseFileName,
                    projectName: projectName,
                  }, filterInfo, queryText, j + 1);
                  if (!matched.matched) continue;
                  matchedCount += 1;
                  matchTotal += 1;
                  if (matchItems.length < capturePerChunk) {
                    matchItems.push(assistantNormalizeCaseLibraryQueryItem(rawItem, file, projectName, j + 1, matched.matchedKeywords));
                  }
                }
                if (matchedCount > 0) {
                  matchFiles.push({
                    caseFileId: file.id === undefined || file.id === null ? '' : String(file.id),
                    caseFileName: caseFileName,
                    projectId: projectId,
                    projectName: projectName,
                    versionId: file.version_id === undefined || file.version_id === null ? '' : String(file.version_id),
                    matchedCount: matchedCount,
                    itemCount: fileItems.length,
                    updatedAt: file.updated_at || file.imported_at || '',
                    workerIndex: chunkIndex + 1,
                  });
                }
              }
              return {
                chunkIndex: chunkIndex + 1,
                matchItems: matchItems,
                matchFiles: matchFiles,
                matchTotal: matchTotal,
                searchedItemCount: searchedItemCount,
                errorCount: errors.length,
                errors: errors,
              };
            }).then(function(results) {
              var chunksOut = Array.isArray(results) ? results : [];
              var allItems = [];
              var allFiles = [];
              var errors = [];
              var total = 0;
              var searchedItemCount = 0;
              chunksOut.forEach(function(entry) {
                var row = entry && typeof entry === 'object' ? entry : {};
                total += Number(row.matchTotal) || 0;
                searchedItemCount += Number(row.searchedItemCount) || 0;
                if (Array.isArray(row.matchItems) && row.matchItems.length) {
                  allItems = allItems.concat(row.matchItems);
                }
                if (Array.isArray(row.matchFiles) && row.matchFiles.length) {
                  allFiles = allFiles.concat(row.matchFiles);
                }
                if (Array.isArray(row.errors) && row.errors.length) {
                  errors = errors.concat(row.errors);
                }
              });
              return {
                ok: true,
                scope: resolvedProjectId ? 'project' : 'all-projects',
                projectId: resolvedProjectId || '',
                projectName: resolvedProjectName || '',
                queryText: queryText,
                filterInfo: filterInfo,
                total: total,
                matchedFileCount: allFiles.length,
                searchedFileCount: fileList.length,
                searchedItemCount: searchedItemCount,
                estimatedItemCount: estimatedItemCount,
                projectCount: resolvedProjectId ? 1 : Object.keys(projectMap).length,
                items: allItems.slice(0, limit),
                files: allFiles.slice(0, 120),
                truncated: total > Math.min(allItems.length, limit),
                fileTruncated: allFiles.length > 120,
                multiAgent: {
                  used: workerCount > 1,
                  workerCount: workerCount,
                  chunkCount: chunks.length,
                },
                errorCount: errors.length,
                errors: errors.slice(0, 30),
              };
            });
          })
          .catch(function(err) {
            return {
              ok: false,
              reason: err && err.message ? String(err.message) : '查询用例库内容失败',
              projectId: resolvedProjectId || '',
              projectName: resolvedProjectName || '',
              total: 0,
              items: [],
            };
          });
      });
    }

    function assistantSearchExecCandidates(options) {
      var caseLibraryApi = window.app && window.app.caseLibraryApi ? window.app.caseLibraryApi : null;
      if (!caseLibraryApi || typeof caseLibraryApi.searchExecCandidates !== 'function') {
        return Promise.resolve({
          ok: false,
          reason: '用例转执行候选搜索能力暂不可用',
          total: 0,
          items: [],
        });
      }
      try {
        return Promise.resolve(caseLibraryApi.searchExecCandidates(options || {}));
      } catch (err) {
        return Promise.resolve({
          ok: false,
          reason: err && err.message ? String(err.message) : '搜索用例失败',
          total: 0,
          items: [],
        });
      }
    }

    function assistantTransferCaseFileToExec(options) {
      var caseLibraryApi = window.app && window.app.caseLibraryApi ? window.app.caseLibraryApi : null;
      if (!caseLibraryApi || typeof caseLibraryApi.transferCaseFileToExec !== 'function') {
        return Promise.resolve({
          ok: false,
          reason: '转到执行能力暂不可用',
        });
      }
      try {
        return Promise.resolve(caseLibraryApi.transferCaseFileToExec(options || {}));
      } catch (err) {
        return Promise.resolve({
          ok: false,
          reason: err && err.message ? String(err.message) : '转到执行失败',
        });
      }
    }

    function assistantBuildSearchRequest(url, timeoutMs) {
      var request = {
        url: url,
        options: { method: 'GET' },
        timerId: 0,
      };
      if (typeof AbortController === 'function') {
        var controller = new AbortController();
        request.options.signal = controller.signal;
        if (timeoutMs > 0) {
          request.timerId = setTimeout(function() {
            try {
              controller.abort();
            } catch (err) {
              // ignore
            }
          }, timeoutMs);
        }
      }
      return request;
    }

    function assistantClearSearchTimer(timerId) {
      if (!timerId) return;
      try {
        clearTimeout(timerId);
      } catch (err) {
        // ignore
      }
    }

    function assistantNormalizeSearchUrl(rawUrl) {
      var source = rawUrl === undefined || rawUrl === null ? '' : String(rawUrl).trim();
      if (!source) return '';
      var normalized = source;
      var uddgMatch = source.match(/[?&]uddg=([^&]+)/i);
      if (uddgMatch && uddgMatch[1]) {
        try {
          normalized = decodeURIComponent(uddgMatch[1]);
        } catch (err) {
          normalized = source;
        }
      }
      return normalized;
    }

    function assistantBuildSearchItem(title, url, snippet, sourceName) {
      var safeTitle = title === undefined || title === null ? '' : String(title).trim();
      var safeUrl = assistantNormalizeSearchUrl(url);
      var safeSnippet = snippet === undefined || snippet === null ? '' : String(snippet).trim();
      if (!safeTitle && safeSnippet) {
        var splitIdx = safeSnippet.indexOf(' - ');
        if (splitIdx > 0) {
          safeTitle = safeSnippet.slice(0, splitIdx).trim();
          safeSnippet = safeSnippet.slice(splitIdx + 3).trim();
        } else {
          safeTitle = safeSnippet.slice(0, 40);
        }
      }
      if (!safeTitle && safeUrl) safeTitle = safeUrl;
      if (!safeUrl && !safeSnippet) return null;
      return {
        title: safeTitle || '未命名结果',
        url: safeUrl,
        snippet: safeSnippet,
        source: sourceName || '',
      };
    }

    function assistantDedupSearchItems(items, limit) {
      var list = Array.isArray(items) ? items : [];
      var max = Number(limit);
      if (!Number.isFinite(max) || max <= 0) max = 5;
      if (max > 10) max = 10;
      var seen = {};
      var result = [];
      for (var i = 0; i < list.length; i += 1) {
        var item = list[i];
        if (!item || typeof item !== 'object') continue;
        var title = item.title ? String(item.title).trim() : '';
        var url = item.url ? String(item.url).trim() : '';
        var snippet = item.snippet ? String(item.snippet).trim() : '';
        var key = (url || (title + '|' + snippet)).toLowerCase();
        if (!key || seen[key]) continue;
        seen[key] = true;
        result.push({
          title: title || '未命名结果',
          url: url,
          snippet: snippet,
          source: item.source ? String(item.source) : '',
        });
        if (result.length >= max) break;
      }
      return result;
    }

    function assistantCollectDuckDuckGoTopics(rawTopics, sourceName, bucket) {
      if (!Array.isArray(rawTopics) || !rawTopics.length) return;
      for (var i = 0; i < rawTopics.length; i += 1) {
        var topic = rawTopics[i];
        if (!topic || typeof topic !== 'object') continue;
        if (Array.isArray(topic.Topics) && topic.Topics.length) {
          assistantCollectDuckDuckGoTopics(topic.Topics, sourceName, bucket);
          continue;
        }
        var item = assistantBuildSearchItem('', topic.FirstURL || '', topic.Text || '', sourceName);
        if (item) bucket.push(item);
      }
    }

    function assistantWebSearchViaDuckDuckGo(query, limit, timeoutMs) {
      var url = 'https://api.duckduckgo.com/?format=json&no_redirect=1&no_html=1&skip_disambig=1&q=' + encodeURIComponent(query);
      var request = assistantBuildSearchRequest(url, timeoutMs);
      return fetch(request.url, request.options)
        .then(function(res) {
          if (!res || !res.ok) {
            throw new Error('DuckDuckGo 搜索失败');
          }
          return res.json();
        })
        .then(function(data) {
          var payload = data && typeof data === 'object' ? data : {};
          var sourceName = 'DuckDuckGo';
          var items = [];
          var abstractItem = assistantBuildSearchItem(
            payload.Heading || '',
            payload.AbstractURL || '',
            payload.AbstractText || '',
            sourceName
          );
          if (abstractItem) items.push(abstractItem);
          if (Array.isArray(payload.Results)) {
            payload.Results.forEach(function(entry) {
              var item = assistantBuildSearchItem('', entry && entry.FirstURL ? entry.FirstURL : '', entry && entry.Text ? entry.Text : '', sourceName);
              if (item) items.push(item);
            });
          }
          assistantCollectDuckDuckGoTopics(payload.RelatedTopics, sourceName, items);
          return {
            provider: 'duckduckgo',
            items: assistantDedupSearchItems(items, limit),
          };
        })
        .finally(function() {
          assistantClearSearchTimer(request.timerId);
        });
    }

    function assistantWebSearchViaWikipedia(query, limit, timeoutMs) {
      var max = Number(limit);
      if (!Number.isFinite(max) || max <= 0) max = 5;
      var hosts = ['zh', 'en'];
      var idx = 0;
      var errors = [];

      function runNext() {
        if (idx >= hosts.length) {
          if (errors.length >= hosts.length) {
            return Promise.reject(new Error(errors.join('; ')));
          }
          return Promise.resolve({ provider: 'wikipedia', items: [] });
        }
        var lang = hosts[idx];
        idx += 1;
        var url = 'https://' + lang + '.wikipedia.org/w/api.php?action=opensearch&namespace=0&format=json&origin=*&limit=' + encodeURIComponent(String(max)) + '&search=' + encodeURIComponent(query);
        var request = assistantBuildSearchRequest(url, timeoutMs);
        return fetch(request.url, request.options)
          .then(function(res) {
            if (!res || !res.ok) throw new Error('Wikipedia 搜索失败');
            return res.json();
          })
          .then(function(data) {
            var arr = Array.isArray(data) ? data : [];
            var titles = Array.isArray(arr[1]) ? arr[1] : [];
            var snippets = Array.isArray(arr[2]) ? arr[2] : [];
            var urls = Array.isArray(arr[3]) ? arr[3] : [];
            var items = [];
            for (var i = 0; i < titles.length; i += 1) {
              var item = assistantBuildSearchItem(
                titles[i] || '',
                urls[i] || '',
                snippets[i] || '',
                'Wikipedia'
              );
              if (item) items.push(item);
            }
            items = assistantDedupSearchItems(items, max);
            if (items.length) {
              return { provider: 'wikipedia', items: items };
            }
            return runNext();
          })
          .catch(function(err) {
            errors.push(err && err.message ? String(err.message) : 'Wikipedia 搜索失败');
            return runNext();
          })
          .finally(function() {
            assistantClearSearchTimer(request.timerId);
          });
      }

      return runNext();
    }

    function assistantNormalizeWebSearchResult(raw, query, limit, fallbackProvider) {
      var payload = raw && typeof raw === 'object' ? raw : {};
      var items = Array.isArray(payload.items) ? payload.items : [];
      var normalizedItems = assistantDedupSearchItems(
        items.map(function(entry) {
          var item = entry && typeof entry === 'object' ? entry : {};
          return assistantBuildSearchItem(
            item.title || '',
            item.url || item.link || '',
            item.snippet || item.description || '',
            item.source || payload.provider || fallbackProvider || ''
          );
        }).filter(function(item) { return !!item; }),
        limit
      );
      return {
        ok: payload.ok === false ? false : true,
        query: payload.query ? String(payload.query) : String(query || ''),
        provider: payload.provider ? String(payload.provider) : (fallbackProvider || ''),
        items: normalizedItems,
        total: Number(payload.total) || normalizedItems.length,
        reason: payload.reason ? String(payload.reason) : '',
      };
    }

    function assistantWebSearchViaBackend(query, limit) {
      var apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
      if (!apiClient || typeof apiClient.webSearch !== 'function') {
        return Promise.resolve({ ok: false, reason: '后端搜索能力不可用', items: [] });
      }
      return apiClient.webSearch(query, { limit: limit })
        .then(function(res) {
          return assistantNormalizeWebSearchResult(res, query, limit, 'backend');
        })
        .catch(function(err) {
          return {
            ok: false,
            query: String(query || ''),
            provider: 'backend',
            items: [],
            total: 0,
            reason: err && err.message ? String(err.message) : '后端搜索失败',
          };
        });
    }

    function assistantSearchWeb(query, options) {
      var opts = options && typeof options === 'object' ? options : {};
      var text = query === undefined || query === null ? (opts.query || '') : query;
      var safeQuery = String(text || '').trim();
      if (!safeQuery) {
        return Promise.resolve({
          ok: false,
          query: '',
          items: [],
          total: 0,
          reason: '搜索关键词不能为空',
        });
      }
      var limit = Number(opts.limit);
      if (!Number.isFinite(limit) || limit <= 0) limit = 5;
      if (limit > 10) limit = 10;
      var timeoutMs = Number(opts.timeoutMs);
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) timeoutMs = 12000;
      if (timeoutMs > 30000) timeoutMs = 30000;
      var backendError = '';
      var firstError = '';
      var secondError = '';

      return assistantWebSearchViaBackend(safeQuery, limit)
        .then(function(backendRes) {
          var normalizedBackend = assistantNormalizeWebSearchResult(backendRes, safeQuery, limit, 'backend');
          if (normalizedBackend.items.length) {
            return normalizedBackend;
          }
          if (normalizedBackend.ok === false) {
            backendError = normalizedBackend.reason || '后端搜索失败';
          }
          return assistantWebSearchViaDuckDuckGo(safeQuery, limit, timeoutMs)
            .catch(function(err) {
              firstError = err && err.message ? String(err.message) : 'DuckDuckGo 搜索失败';
              return { provider: 'duckduckgo', items: [] };
            })
            .then(function(primary) {
              var firstItems = primary && Array.isArray(primary.items) ? primary.items : [];
              if (firstItems.length) {
                return {
                  ok: true,
                  query: safeQuery,
                  provider: primary.provider || 'duckduckgo',
                  items: firstItems,
                  total: firstItems.length,
                };
              }
              return assistantWebSearchViaWikipedia(safeQuery, limit, timeoutMs)
                .catch(function(err) {
                  secondError = err && err.message ? String(err.message) : 'Wikipedia 搜索失败';
                  return { provider: 'wikipedia', items: [] };
                })
                .then(function(secondary) {
                  var secondItems = secondary && Array.isArray(secondary.items) ? secondary.items : [];
                  if (secondItems.length) {
                    return {
                      ok: true,
                      query: safeQuery,
                      provider: secondary.provider || 'wikipedia',
                      items: secondItems,
                      total: secondItems.length,
                    };
                  }
                  var errorParts = [];
                  if (backendError) errorParts.push(backendError);
                  if (firstError) errorParts.push(firstError);
                  if (secondError) errorParts.push(secondError);
                  if (errorParts.length) {
                    return {
                      ok: false,
                      query: safeQuery,
                      provider: '',
                      items: [],
                      total: 0,
                      reason: errorParts.join('; '),
                    };
                  }
                  return {
                    ok: true,
                    query: safeQuery,
                    provider: '',
                    items: [],
                    total: 0,
                    reason: 'no_results',
                  };
                });
            });
        })
        .catch(function(err) {
          return {
            ok: false,
            query: safeQuery,
            provider: '',
            items: [],
            total: 0,
            reason: err && err.message ? String(err.message) : '搜索执行失败',
          };
        });
    }

    function ensureAssistantMemoPadState() {
      if (!state.settings || typeof state.settings !== 'object') {
        state.settings = Object.assign({}, defaultSettings);
      }
      var memo = state.settings.memoPad && typeof state.settings.memoPad === 'object'
        ? state.settings.memoPad
        : {};
      var tabs = Array.isArray(memo.tabs) ? memo.tabs : [];
      if (!tabs.length) {
        tabs = [{ id: 'memo-tab-1', name: '', items: [] }];
      }
      tabs = tabs.slice(0, 3).map(function(tab, idx) {
        var next = tab && typeof tab === 'object' ? tab : {};
        var tabId = next.id ? String(next.id) : ('memo-tab-' + (idx + 1));
        var items = Array.isArray(next.items) ? next.items : [];
        items = items.map(function(item, itemIdx) {
          var entry = item && typeof item === 'object' ? item : {};
          return {
            id: entry.id ? String(entry.id) : ('memo-item-' + Date.now() + '-' + idx + '-' + itemIdx),
            text: typeof entry.text === 'string' ? entry.text : '',
            done: entry.done === true,
          };
        });
        return {
          id: tabId,
          name: typeof next.name === 'string' ? next.name : '',
          items: items,
        };
      });
      var activeTabId = memo.activeTabId ? String(memo.activeTabId) : tabs[0].id;
      if (!tabs.some(function(tab) { return tab.id === activeTabId; })) {
        activeTabId = tabs[0].id;
      }
      memo.tabs = tabs;
      memo.activeTabId = activeTabId;
      memo.collapsed = memo.collapsed === true;
      state.settings.memoPad = memo;
      return memo;
    }

    function persistAssistantMemoPad() {
      persistSettings(['memoPad']);
      if (window.app && window.app.memoPadApi && typeof window.app.memoPadApi.renderMemoPad === 'function') {
        window.app.memoPadApi.renderMemoPad();
      }
    }

    function assistantMemoList() {
      var memo = ensureAssistantMemoPadState();
      return memo.tabs.map(function(tab) {
        return {
          id: tab.id,
          name: tab.name || '',
          items: (tab.items || []).map(function(item, idx) {
            return {
              index: idx + 1,
              id: item.id,
              text: item.text || '',
              done: item.done === true,
            };
          }),
          isActive: tab.id === memo.activeTabId,
        };
      });
    }

    function assistantMemoAdd(text, tabName) {
      var content = text === undefined || text === null ? '' : String(text).trim();
      if (!content) return { ok: false, reason: '备忘内容不能为空' };
      var memo = ensureAssistantMemoPadState();
      var targetTab = null;
      if (tabName) {
        var keyword = String(tabName).trim().toLowerCase();
        targetTab = memo.tabs.find(function(tab) {
          var tabTitle = tab && tab.name ? String(tab.name).trim().toLowerCase() : '';
          return tabTitle && tabTitle.indexOf(keyword) !== -1;
        }) || null;
      }
      if (!targetTab) {
        targetTab = memo.tabs.find(function(tab) { return tab.id === memo.activeTabId; }) || memo.tabs[0];
      }
      if (!targetTab.items) targetTab.items = [];
      targetTab.items.push({
        id: 'memo-item-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        text: content,
        done: false,
      });
      memo.activeTabId = targetTab.id;
      persistAssistantMemoPad();
      return { ok: true, tabId: targetTab.id, tabName: targetTab.name || '', text: content };
    }

    function assistantMemoToggle(tabId, index, done) {
      var memo = ensureAssistantMemoPadState();
      var targetTabId = tabId ? String(tabId) : memo.activeTabId;
      var tab = memo.tabs.find(function(item) { return item.id === targetTabId; }) || null;
      if (!tab) return { ok: false, reason: '未找到目标备忘页签' };
      var idx = Number(index);
      if (!Number.isFinite(idx) || idx <= 0 || idx > tab.items.length) {
        return { ok: false, reason: '备忘序号无效' };
      }
      tab.items[idx - 1].done = done === true;
      memo.activeTabId = tab.id;
      persistAssistantMemoPad();
      return { ok: true, tabId: tab.id, index: idx, done: done === true };
    }

    function assistantMemoRemove(tabId, index) {
      var memo = ensureAssistantMemoPadState();
      var targetTabId = tabId ? String(tabId) : memo.activeTabId;
      var tab = memo.tabs.find(function(item) { return item.id === targetTabId; }) || null;
      if (!tab) return { ok: false, reason: '未找到目标备忘页签' };
      var idx = Number(index);
      if (!Number.isFinite(idx) || idx <= 0 || idx > tab.items.length) {
        return { ok: false, reason: '备忘序号无效' };
      }
      var removed = tab.items.splice(idx - 1, 1);
      memo.activeTabId = tab.id;
      persistAssistantMemoPad();
      return { ok: true, removed: removed && removed[0] ? removed[0] : null, tabId: tab.id, index: idx };
    }

    function assistantRunCaseGeneration() {
      try {
        switchTab('casesgen');
      } catch (err) {
        // ignore
      }
      if (window.app && window.app.casesGenApi && typeof window.app.casesGenApi.goCasesGenAndScroll === 'function') {
        try {
          window.app.casesGenApi.goCasesGenAndScroll();
        } catch (err2) {
          // ignore
        }
      }
      if (api && typeof api.generateAllCaseGenModules === 'function') {
        return Promise.resolve()
          .then(function() { return api.generateAllCaseGenModules(); })
          .then(function() { return { ok: true, started: true }; })
          .catch(function(err) {
            return { ok: false, reason: err && err.message ? err.message : '用例生成触发失败' };
          });
      }
      return Promise.resolve({ ok: false, reason: '当前页面无法直接触发批量用例生成' });
    }

    function assistantRunMissingRecommendation() {
      try {
        switchTab('auto');
      } catch (err) {
        // ignore
      }
      if (!compareCasesCoverage || !smartFillMissingSuggestions) {
        return Promise.resolve({ ok: false, reason: '缺少漏测推荐能力依赖' });
      }
      return Promise.resolve()
        .then(function() { return compareCasesCoverage(); })
        .then(function() { return smartFillMissingSuggestions(); })
        .then(function() { return { ok: true }; })
        .catch(function(err) {
          return { ok: false, reason: err && err.message ? err.message : '漏测推荐执行失败' };
        });
    }

    function assistantHasPendingCaseDelete() {
      if (document.querySelector('.temp-undo-toast')) return true;
      var editStatus = document.getElementById('editStatus');
      var missingStatus = document.getElementById('missingStatus');
      var editText = editStatus && editStatus.textContent ? String(editStatus.textContent) : '';
      var missingText = missingStatus && missingStatus.textContent ? String(missingStatus.textContent) : '';
      return editText.indexOf('待确认') !== -1 || missingText.indexOf('待确认') !== -1;
    }

    function assistantPickCaseDeleteButton(index) {
      var selectors = [
        '[data-case-lib-edit-remove]',
        '[data-case-lib-missing-remove]',
      ];
      var list = [];
      selectors.forEach(function(selector) {
        var nodes = document.querySelectorAll(selector);
        if (!nodes || !nodes.length) return;
        nodes.forEach(function(node) {
          if (!node) return;
          if (node.disabled) return;
          if (node.offsetParent === null) return;
          list.push(node);
        });
      });
      if (!list.length) return null;
      var idx = Math.max(1, Number(index) || 1);
      if (idx > list.length) idx = list.length;
      return { button: list[idx - 1], index: idx, count: list.length };
    }

    function assistantDeleteCase(index) {
      if (assistantHasPendingCaseDelete()) {
        return { ok: false, reason: '当前存在待确认增删操作，请先撤回或等待8秒入库' };
      }
      var picked = assistantPickCaseDeleteButton(index);
      if (!picked || !picked.button) {
        return { ok: false, reason: '当前页面未找到可删除的用例，请先打开用例编辑/漏测编辑视图' };
      }
      picked.button.click();
      return { ok: true, index: picked.index, total: picked.count };
    }

    function assistantNormalizeCaseUpdateField(rawField, context) {
      var text = rawField === undefined || rawField === null ? '' : String(rawField).trim().toLowerCase();
      text = text.replace(/\s+/g, '');
      if (!text) return '';
      var isTempExec = context === 'tempexec';
      if (text === 'priority' || text === 'level' || text === '优先级') return 'priority';
      if (text === 'module' || text === '模块') return 'module';
      if (text === 'title' || text === 'name' || text === '标题' || text === '用例标题' || text === 'case') return 'title';
      if (text === 'precondition' || text === 'preconditions' || text === '前提条件' || text === '前置条件' || text === '前置') {
        return isTempExec ? 'preconditions' : 'precondition';
      }
      if (text === 'steps' || text === 'step' || text === '步骤' || text === '操作步骤') return 'steps';
      if (text === 'expected' || text === 'expect' || text === '预期' || text === '预期结果') return 'expected';
      if (text === 'remark' || text === 'remarks' || text === 'note' || text === 'comment' || text === '备注') return 'remark';
      if (text === 'actual' || text === 'result' || text === 'status' || text === '执行结果' || text === '状态') return 'actual';
      return '';
    }

    function assistantDispatchNodeEvent(node, typeName, bubbles) {
      if (!node || !typeName) return;
      var evt = null;
      try {
        evt = new Event(typeName, { bubbles: bubbles !== false, cancelable: true });
      } catch (err) {
        evt = null;
      }
      if (!evt && typeof document !== 'undefined' && document.createEvent) {
        try {
          evt = document.createEvent('Event');
          evt.initEvent(typeName, bubbles !== false, true);
        } catch (err2) {
          evt = null;
        }
      }
      if (!evt) return;
      try {
        node.dispatchEvent(evt);
      } catch (err3) {
        // ignore
      }
    }

    function assistantIsEditableNodeVisible(node) {
      if (!node) return false;
      if (node.disabled) return false;
      if (node.offsetParent !== null) return true;
      var style = null;
      try {
        style = window.getComputedStyle ? window.getComputedStyle(node) : null;
      } catch (err) {
        style = null;
      }
      if (!style) return false;
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return style.position === 'fixed';
    }

    function assistantCollectVisibleNodes(selectors) {
      var list = [];
      var seen = [];
      var arr = Array.isArray(selectors) ? selectors : [];
      arr.forEach(function(selector) {
        if (!selector || !document.querySelectorAll) return;
        var nodes = document.querySelectorAll(selector);
        if (!nodes || !nodes.length) return;
        nodes.forEach(function(node) {
          if (!node || !assistantIsEditableNodeVisible(node)) return;
          if (seen.indexOf(node) !== -1) return;
          seen.push(node);
          list.push(node);
        });
      });
      return list;
    }

    function assistantPickCaseLibraryEditableNode(field, index) {
      var idx = Number(index);
      var hasIndex = Number.isFinite(idx) && idx > 0;
      var sourceIndex = hasIndex ? (idx - 1) : -1;
      var selectors = [];
      if (field === 'remark') {
        selectors.push('[data-case-lib-remark]');
      } else {
        selectors.push('[data-case-lib-edit-field="' + field + '"]');
        selectors.push('[data-case-lib-missing-field="' + field + '"]');
      }
      if (hasIndex) {
        for (var i = 0; i < selectors.length; i += 1) {
          var exactSelector = selectors[i] + '[data-index="' + sourceIndex + '"]';
          var exactNode = document.querySelector(exactSelector);
          if (assistantIsEditableNodeVisible(exactNode)) return exactNode;
        }
      }
      var list = assistantCollectVisibleNodes(selectors);
      if (!list.length) return null;
      if (hasIndex && sourceIndex >= 0 && sourceIndex < list.length) return list[sourceIndex];
      return list[0];
    }

    function assistantPickTempExecEditableNode(field, index, fileId) {
      var selector = '[data-temp-edit-field="' + field + '"]';
      var list = assistantCollectVisibleNodes([selector]);
      if (!list.length) return null;
      var fileIdText = fileId === undefined || fileId === null ? '' : String(fileId).trim();
      if (fileIdText) {
        list = list.filter(function(node) {
          var fid = node && node.dataset ? String(node.dataset.tempEditFile || '') : '';
          return fid === fileIdText;
        });
      }
      if (!list.length) return null;
      var idx = Number(index);
      var hasIndex = Number.isFinite(idx) && idx > 0;
      var sourceIndex = hasIndex ? (idx - 1) : -1;
      if (hasIndex) {
        for (var i = 0; i < list.length; i += 1) {
          var node = list[i];
          var nodeIdx = node && node.dataset ? Number(node.dataset.tempEditIndex) : NaN;
          if (Number.isFinite(nodeIdx) && nodeIdx === sourceIndex) return node;
        }
        if (sourceIndex >= 0 && sourceIndex < list.length) return list[sourceIndex];
      }
      return list[0];
    }

    function assistantPickTempExecResultNode(index, fileId) {
      var list = assistantCollectVisibleNodes(['select[data-temp-result]']);
      if (!list.length) return null;
      var fileIdText = fileId === undefined || fileId === null ? '' : String(fileId).trim();
      if (fileIdText) {
        list = list.filter(function(node) {
          var fid = node && node.dataset ? String(node.dataset.tempResult || '') : '';
          return fid === fileIdText;
        });
      }
      if (!list.length) return null;
      var idx = Number(index);
      var hasIndex = Number.isFinite(idx) && idx > 0;
      var sourceIndex = hasIndex ? (idx - 1) : -1;
      if (hasIndex) {
        for (var i = 0; i < list.length; i += 1) {
          var node = list[i];
          var nodeIdx = node && node.dataset ? Number(node.dataset.index) : NaN;
          if (Number.isFinite(nodeIdx) && nodeIdx === sourceIndex) return node;
        }
        if (sourceIndex >= 0 && sourceIndex < list.length) return list[sourceIndex];
      }
      return list[0];
    }

    function assistantPickTempExecRemarkNode(index, fileId) {
      var list = assistantCollectVisibleNodes(['textarea[data-temp-remark]']);
      if (!list.length) return null;
      var fileIdText = fileId === undefined || fileId === null ? '' : String(fileId).trim();
      if (fileIdText) {
        list = list.filter(function(node) {
          var fid = node && node.dataset ? String(node.dataset.tempRemark || '') : '';
          return fid === fileIdText;
        });
      }
      if (!list.length) return null;
      var idx = Number(index);
      var hasIndex = Number.isFinite(idx) && idx > 0;
      var sourceIndex = hasIndex ? (idx - 1) : -1;
      if (hasIndex) {
        for (var i = 0; i < list.length; i += 1) {
          var node = list[i];
          var nodeIdx = node && node.dataset ? Number(node.dataset.index) : NaN;
          if (Number.isFinite(nodeIdx) && nodeIdx === sourceIndex) return node;
        }
        if (sourceIndex >= 0 && sourceIndex < list.length) return list[sourceIndex];
      }
      return list[0];
    }

    function assistantApplyEditableNodeValue(node, value) {
      if (!node) return false;
      var next = value === undefined || value === null ? '' : String(value);
      var tag = node.tagName ? String(node.tagName).toLowerCase() : '';
      if (tag === 'textarea' || tag === 'input' || tag === 'select') {
        if (node.value !== next) node.value = next;
        assistantDispatchNodeEvent(node, 'input', true);
        assistantDispatchNodeEvent(node, 'change', true);
        if (typeof node.blur === 'function') node.blur();
        return true;
      }
      if (typeof node.focus === 'function') node.focus();
      if (node.textContent !== next) node.textContent = next;
      assistantDispatchNodeEvent(node, 'input', true);
      if (typeof node.blur === 'function') node.blur();
      return true;
    }

    function assistantReadEditableNodeValue(node) {
      if (!node) return '';
      var tag = node.tagName ? String(node.tagName).toLowerCase() : '';
      if (tag === 'textarea' || tag === 'input' || tag === 'select') {
        return node.value === undefined || node.value === null ? '' : String(node.value);
      }
      return node.textContent === undefined || node.textContent === null ? '' : String(node.textContent);
    }

    function assistantNormalizeTempExecActualValue(rawValue) {
      var raw = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
      if (!raw) return '';
      var compact = raw.toLowerCase().replace(/\s+/g, '');
      var map = {
        '未执行': '未执行',
        '待执行': '未执行',
        'pending': '未执行',
        'notrun': '未执行',
        '未测': '未执行',
        '通过': '通过',
        '成功': '通过',
        'pass': '通过',
        'passed': '通过',
        'ok': '通过',
        '失败': '失败',
        '不通过': '失败',
        'fail': '失败',
        'failed': '失败',
        'error': '失败',
        '阻塞': '阻塞',
        'blocked': '阻塞',
        'block': '阻塞',
        '不适用': '不适用',
        'na': '不适用',
        'n/a': '不适用',
        'skip': '不适用',
        'skipped': '不适用',
        '变更重跑': '变更重跑',
        '有改动': '有改动',
      };
      if (Object.prototype.hasOwnProperty.call(map, compact)) return map[compact];
      return raw;
    }

    function assistantResolveSelectOptionValue(node, rawValue) {
      if (!node) return '';
      var value = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
      if (!value) return '';
      var options = node.options ? Array.from(node.options) : [];
      if (!options.length) return '';
      for (var i = 0; i < options.length; i += 1) {
        var option = options[i];
        if (!option) continue;
        var ov = option.value === undefined || option.value === null ? '' : String(option.value).trim();
        if (ov === value) return ov;
      }
      for (var j = 0; j < options.length; j += 1) {
        var option2 = options[j];
        if (!option2) continue;
        var text = option2.textContent === undefined || option2.textContent === null ? '' : String(option2.textContent).trim();
        if (text === value) {
          return option2.value === undefined || option2.value === null ? text : String(option2.value).trim();
        }
      }
      return '';
    }

    function assistantNormalizeCaseUpdateOperation(args, fallback) {
      var payload = args && typeof args === 'object' ? args : {};
      var opRaw = '';
      if (payload.operation !== undefined && payload.operation !== null) opRaw = String(payload.operation).trim().toLowerCase();
      if (!opRaw && payload.mode !== undefined && payload.mode !== null) opRaw = String(payload.mode).trim().toLowerCase();
      if (!opRaw && payload.action !== undefined && payload.action !== null) opRaw = String(payload.action).trim().toLowerCase();
      if (opRaw === 'append' || opRaw === 'prepend' || opRaw === 'replace') return opRaw;
      return fallback === 'append' || fallback === 'prepend' || fallback === 'replace' ? fallback : 'replace';
    }

    function assistantNormalizeCaseUpdateScope(args) {
      var payload = args && typeof args === 'object' ? args : {};
      if (payload.all === true || payload.applyAll === true || payload.batch === true) return 'all';
      var scopeRaw = '';
      if (payload.scope !== undefined && payload.scope !== null) scopeRaw = String(payload.scope).trim().toLowerCase();
      if (!scopeRaw && payload.target !== undefined && payload.target !== null) scopeRaw = String(payload.target).trim().toLowerCase();
      if (!scopeRaw && payload.range !== undefined && payload.range !== null) scopeRaw = String(payload.range).trim().toLowerCase();
      scopeRaw = scopeRaw.replace(/\s+/g, '');
      if (!scopeRaw) return 'single';
      if (
        scopeRaw === 'all' ||
        scopeRaw === '*' ||
        scopeRaw === 'batch' ||
        scopeRaw === 'global' ||
        scopeRaw === '全部' ||
        scopeRaw === '所有' ||
        scopeRaw === '全部用例' ||
        scopeRaw === '所有用例' ||
        scopeRaw === '全量'
      ) return 'all';
      return 'single';
    }

    function assistantIsTruthyFlag(raw) {
      if (raw === true) return true;
      if (raw === false || raw === undefined || raw === null) return false;
      var text = String(raw).trim().toLowerCase();
      return text === '1' || text === 'true' || text === 'yes' || text === 'y' || text === 'on' || text === 'ok';
    }

    function assistantIsCaseFieldClearable(field) {
      return field === 'module'
        || field === 'title'
        || field === 'precondition'
        || field === 'preconditions'
        || field === 'steps'
        || field === 'expected'
        || field === 'remark';
    }

    function assistantShouldAllowCaseEmptyValue(field, payload) {
      if (!assistantIsCaseFieldClearable(field)) return false;
      var source = payload && typeof payload === 'object' ? payload : {};
      if (assistantIsTruthyFlag(source.clear)) return true;
      if (assistantIsTruthyFlag(source.clearValue)) return true;
      if (assistantIsTruthyFlag(source.remove)) return true;
      if (assistantIsTruthyFlag(source.empty)) return true;
      return false;
    }

    function assistantResolveCaseEditableMeta(node) {
      if (!node || typeof node.getAttribute !== 'function') return null;
      var field = '';
      var context = '';
      var libField = node.getAttribute('data-case-lib-edit-field') || node.getAttribute('data-case-lib-missing-field');
      if (libField) {
        field = String(libField);
        context = 'case-library';
      } else {
        var tempField = node.getAttribute('data-temp-edit-field');
        if (tempField) {
          field = String(tempField);
          context = 'tempexec';
        }
      }
      if (!field && node.getAttribute('data-temp-remark') !== null) {
        field = 'remark';
        context = 'tempexec';
      }
      if (!field && node.getAttribute('data-temp-result') !== null) {
        field = 'actual';
        context = 'tempexec';
      }
      if (!field || !context) return null;
      var normalized = assistantNormalizeCaseUpdateField(field, context);
      if (!normalized) return null;
      return {
        context: context,
        field: normalized,
      };
    }

    function assistantNormalizeCaseUpdateValue(field, rawValue, options) {
      var opts = options && typeof options === 'object' ? options : {};
      var allowEmpty = opts.allowEmpty === true;
      var value = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
      if (!value) {
        if (allowEmpty && assistantIsCaseFieldClearable(field)) return { ok: true, value: '' };
        return { ok: false, reason: '缺少要写入的值' };
      }
      if (field === 'priority') {
        var normalized = value.toUpperCase().replace(/\s+/g, '');
        if (!/^P[0-9]{1,2}$/.test(normalized)) {
          return { ok: false, reason: '优先级格式应为 P + 数字（如 P0/P1/P2/P3）' };
        }
        return { ok: true, value: normalized };
      }
      if (field === 'actual') {
        return { ok: true, value: assistantNormalizeTempExecActualValue(value) };
      }
      return { ok: true, value: value };
    }

    function assistantExtractCaseUpdateFromPatch(patch, context) {
      var source = patch && typeof patch === 'object' ? patch : {};
      var keys = Object.keys(source);
      for (var i = 0; i < keys.length; i += 1) {
        var key = keys[i];
        var field = assistantNormalizeCaseUpdateField(key, context);
        if (!field) continue;
        return {
          field: field,
          value: source[key],
        };
      }
      return null;
    }

    function assistantBuildCaseUpdateFieldLabel(field) {
      var fieldLabelMap = {
        module: '模块',
        title: '标题',
        priority: '优先级',
        precondition: '前置条件',
        preconditions: '前置条件',
        steps: '步骤',
        expected: '预期结果',
        remark: '备注',
        actual: '执行结果',
      };
      return fieldLabelMap[field] || field || '字段';
    }

    function assistantTrimCaseUpdateConfirmValue(value, maxLen) {
      var text = value === undefined || value === null ? '' : String(value);
      var limit = Number(maxLen);
      text = text.replace(/\s+/g, ' ').trim();
      if (!text) return '';
      if (!Number.isFinite(limit) || limit < 8) limit = 24;
      if (text.length <= limit) return text;
      return text.slice(0, limit - 1) + '…';
    }

    function assistantResolveCaseUpdateRequestIndex(args) {
      var payload = args && typeof args === 'object' ? args : {};
      var idxRaw = payload.index;
      if ((idxRaw === undefined || idxRaw === null) && payload.itemIndex !== undefined && payload.itemIndex !== null) idxRaw = payload.itemIndex;
      if ((idxRaw === undefined || idxRaw === null) && payload.seq !== undefined && payload.seq !== null) idxRaw = payload.seq;
      if ((idxRaw === undefined || idxRaw === null) && payload.row !== undefined && payload.row !== null) idxRaw = payload.row;
      if ((idxRaw === undefined || idxRaw === null) && payload.sourceIndex !== undefined && payload.sourceIndex !== null) idxRaw = payload.sourceIndex;
      var index = Number(idxRaw);
      if (!Number.isFinite(index) || index <= 0) return 0;
      return Math.floor(index);
    }

    function assistantBuildCaseUpdateConfirmMeta(payload, contextOverride) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var fallbackMeta = {
        actionLabel: '修改用例',
        message: '该操作会写入用例内容，请确认继续。',
      };
      var contextRaw = args.context === undefined || args.context === null ? '' : String(args.context).trim().toLowerCase();
      var context = contextRaw || (contextOverride ? String(contextOverride).trim().toLowerCase() : '') || (state.activeTab === 'tempexec' ? 'tempexec' : (state.activeTab === 'case-library' ? 'case-library' : ''));
      var pair = null;
      var valueRaw = undefined;
      var normalizedValue = '';
      var allowEmptyValue = false;
      var normalizeValueRes = null;
      var operation = 'replace';
      var scope = 'single';
      var index = 0;
      var fieldLabel = '';
      var valueText = '';
      var targetLabel = '';
      var isClear = false;
      var message = '';
      if (args.patch && typeof args.patch === 'object') {
        pair = assistantExtractCaseUpdateFromPatch(args.patch, context);
      }
      if (!pair) {
        var fieldRaw = '';
        if (args.field !== undefined && args.field !== null) fieldRaw = String(args.field);
        if (!fieldRaw && args.key !== undefined && args.key !== null) fieldRaw = String(args.key);
        if (!fieldRaw && args.column !== undefined && args.column !== null) fieldRaw = String(args.column);
        if (!fieldRaw && args.name !== undefined && args.name !== null) fieldRaw = String(args.name);
        var normalizedField = assistantNormalizeCaseUpdateField(fieldRaw, context);
        if (!normalizedField) return fallbackMeta;
        valueRaw = args.value;
        if (valueRaw === undefined) valueRaw = args.to;
        if (valueRaw === undefined) valueRaw = args.text;
        if (valueRaw === undefined) valueRaw = args.content;
        if (valueRaw === undefined) valueRaw = args.newValue;
        pair = { field: normalizedField, value: valueRaw };
      }
      if (!pair || !pair.field) return fallbackMeta;
      allowEmptyValue = assistantShouldAllowCaseEmptyValue(pair.field, args);
      normalizeValueRes = assistantNormalizeCaseUpdateValue(pair.field, pair.value, { allowEmpty: allowEmptyValue });
      if (normalizeValueRes && normalizeValueRes.ok) {
        normalizedValue = normalizeValueRes.value;
      } else {
        normalizedValue = pair.value === undefined || pair.value === null ? '' : String(pair.value).trim();
      }
      operation = assistantNormalizeCaseUpdateOperation(args, 'replace');
      scope = assistantNormalizeCaseUpdateScope(args);
      index = assistantResolveCaseUpdateRequestIndex(args);
      fieldLabel = assistantBuildCaseUpdateFieldLabel(pair.field);
      valueText = assistantTrimCaseUpdateConfirmValue(normalizedValue, 32);
      isClear = allowEmptyValue && normalizedValue === '';
      if (scope === 'all') {
        targetLabel = context === 'tempexec' ? '当前执行中的全部用例' : '当前可见用例';
      } else if (index > 0) {
        targetLabel = '第 ' + index + ' 条用例';
      } else {
        targetLabel = context === 'tempexec' ? '当前执行中的目标用例' : '当前可见用例';
      }
      if (isClear) {
        message = '将' + targetLabel + '的' + fieldLabel + '清空。';
      } else if (operation === 'append') {
        message = '在' + targetLabel + '的' + fieldLabel + '末尾追加' + (valueText ? ('“' + valueText + '”') : '内容') + '。';
      } else if (operation === 'prepend') {
        message = '在' + targetLabel + '的' + fieldLabel + '开头追加' + (valueText ? ('“' + valueText + '”') : '内容') + '。';
      } else if (valueText) {
        message = '将' + targetLabel + '的' + fieldLabel + '改为“' + valueText + '”。';
      } else {
        message = '将修改' + targetLabel + '的' + fieldLabel + '。';
      }
      return {
        actionLabel: '修改用例' + fieldLabel + (scope === 'all' ? '（批量）' : ''),
        message: message,
      };
    }

    function assistantUpdateCase(payload) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var contextRaw = args.context === undefined || args.context === null ? '' : String(args.context).trim().toLowerCase();
      var context = contextRaw || (state.activeTab === 'tempexec' ? 'tempexec' : (state.activeTab === 'case-library' ? 'case-library' : ''));
      if (context !== 'tempexec' && context !== 'case-library') {
        return { ok: false, reason: '当前页面不支持用例编辑，请先进入“用例库”或“用例执行”页面' };
      }

      var pair = null;
      if (args.patch && typeof args.patch === 'object') {
        pair = assistantExtractCaseUpdateFromPatch(args.patch, context);
      }
      if (!pair) {
        var fieldRaw = '';
        if (args.field !== undefined && args.field !== null) fieldRaw = String(args.field);
        if (!fieldRaw && args.key !== undefined && args.key !== null) fieldRaw = String(args.key);
        if (!fieldRaw && args.column !== undefined && args.column !== null) fieldRaw = String(args.column);
        if (!fieldRaw && args.name !== undefined && args.name !== null) fieldRaw = String(args.name);
        var normalizedField = assistantNormalizeCaseUpdateField(fieldRaw, context);
        if (!normalizedField) return { ok: false, reason: '缺少可编辑字段，支持：模块/标题/优先级/前置条件/步骤/预期结果/备注' };
        var valueRaw = args.value;
        if (valueRaw === undefined) valueRaw = args.to;
        if (valueRaw === undefined) valueRaw = args.text;
        if (valueRaw === undefined) valueRaw = args.content;
        if (valueRaw === undefined) valueRaw = args.newValue;
        pair = { field: normalizedField, value: valueRaw };
      }
      if (!pair || !pair.field) return { ok: false, reason: '未找到可编辑字段' };
      var allowEmptyValue = assistantShouldAllowCaseEmptyValue(pair.field, args);
      var normalizeValueRes = assistantNormalizeCaseUpdateValue(pair.field, pair.value, { allowEmpty: allowEmptyValue });
      if (!normalizeValueRes.ok) return normalizeValueRes;
      var normalizedValue = normalizeValueRes.value;
      var operation = assistantNormalizeCaseUpdateOperation(args, 'replace');
      var scope = assistantNormalizeCaseUpdateScope(args);
      var cleared = allowEmptyValue && normalizedValue === '';
      if (cleared) operation = 'replace';

      var idxRaw = args.index;
      if ((idxRaw === undefined || idxRaw === null) && args.itemIndex !== undefined && args.itemIndex !== null) idxRaw = args.itemIndex;
      if ((idxRaw === undefined || idxRaw === null) && args.seq !== undefined && args.seq !== null) idxRaw = args.seq;
      if ((idxRaw === undefined || idxRaw === null) && args.row !== undefined && args.row !== null) idxRaw = args.row;
      if ((idxRaw === undefined || idxRaw === null) && args.sourceIndex !== undefined && args.sourceIndex !== null) idxRaw = args.sourceIndex;
      var index = Number(idxRaw);
      if (!Number.isFinite(index) || index <= 0) index = 0;

      var fileIdRaw = args.fileId;
      if ((fileIdRaw === undefined || fileIdRaw === null) && args.caseFileId !== undefined && args.caseFileId !== null) fileIdRaw = args.caseFileId;
      if ((fileIdRaw === undefined || fileIdRaw === null) && args.caseId !== undefined && args.caseId !== null) fileIdRaw = args.caseId;
      var fileId = fileIdRaw === undefined || fileIdRaw === null ? '' : String(fileIdRaw).trim();

      if (scope === 'all') {
        if (!(context === 'tempexec' && (pair.field === 'actual' || pair.field === 'remark'))) {
          return { ok: false, reason: '当前仅支持在用例执行页批量修改“执行结果/备注”字段' };
        }
        var tempApi = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
        var targetFileId = fileId || assistantResolveTempExecActiveFileId(tempApi);
        var targetFile = targetFileId ? assistantGetTempExecFileById(targetFileId) : null;
        if (!targetFile && Array.isArray(state.tempExecFiles) && state.tempExecFiles.length) {
          targetFile = state.tempExecFiles[0];
          targetFileId = targetFile && targetFile.id !== undefined && targetFile.id !== null ? String(targetFile.id) : '';
        }

        if (pair.field === 'actual') {
          operation = 'replace';
          var finalBulkValue = normalizedValue;
          var sampleNode = assistantPickTempExecResultNode(1, targetFileId);
          if (sampleNode) {
            finalBulkValue = assistantResolveSelectOptionValue(sampleNode, normalizedValue);
            if (!finalBulkValue) {
              return { ok: false, reason: '执行结果仅支持：未执行 / 通过 / 失败 / 阻塞 / 不适用' };
            }
          }
          if (targetFile && Array.isArray(targetFile.cases) && targetFile.cases.length && tempApi && typeof tempApi.updateTempExecResult === 'function') {
            var total = targetFile.cases.length;
            var fileIdText = targetFile.id !== undefined && targetFile.id !== null ? String(targetFile.id) : String(targetFileId || '');
            var touched = 0;
            for (var bi = 0; bi < total; bi += 1) {
              tempApi.updateTempExecResult(fileIdText, bi, finalBulkValue);
              touched += 1;
            }
            return {
              ok: true,
              context: context,
              field: 'actual',
              value: finalBulkValue,
              operation: operation,
              scope: 'all',
              count: touched,
              index: 1,
              fileId: fileIdText,
              cleared: false,
            };
          }
          var allVisible = assistantCollectVisibleNodes(['select[data-temp-result]']);
          if (targetFileId) {
            allVisible = allVisible.filter(function(node) {
              var fid = node && node.dataset ? String(node.dataset.tempResult || '') : '';
              return fid === targetFileId;
            });
          }
          if (!allVisible.length) {
            return { ok: false, reason: '未找到执行结果下拉框，请先确认当前在“用例执行”列表视图并且目标行可见' };
          }
          if (!sampleNode) {
            finalBulkValue = assistantResolveSelectOptionValue(allVisible[0], normalizedValue);
            if (!finalBulkValue) {
              return { ok: false, reason: '执行结果仅支持：未执行 / 通过 / 失败 / 阻塞 / 不适用' };
            }
          }
          var changed = 0;
          allVisible.forEach(function(node) {
            if (assistantApplyEditableNodeValue(node, finalBulkValue)) changed += 1;
          });
          if (changed <= 0) return { ok: false, reason: '写入失败，请重试' };
          return {
            ok: true,
            context: context,
            field: 'actual',
            value: finalBulkValue,
            operation: operation,
            scope: 'all',
            count: changed,
            index: 1,
            fileId: targetFileId,
            cleared: false,
          };
        }

        var finalRemarkValue = normalizedValue;
        if (targetFile && Array.isArray(targetFile.cases) && targetFile.cases.length && tempApi && typeof tempApi.updateTempExecRemark === 'function') {
          var totalRemark = targetFile.cases.length;
          var fileIdForRemark = targetFile.id !== undefined && targetFile.id !== null ? String(targetFile.id) : String(targetFileId || '');
          var touchedRemark = 0;
          for (var ri = 0; ri < totalRemark; ri += 1) {
            tempApi.updateTempExecRemark(fileIdForRemark, ri, finalRemarkValue);
            touchedRemark += 1;
          }
          return {
            ok: true,
            context: context,
            field: 'remark',
            value: finalRemarkValue,
            operation: operation,
            scope: 'all',
            count: touchedRemark,
            index: 1,
            fileId: fileIdForRemark,
            cleared: finalRemarkValue === '',
          };
        }
        var allRemarkVisible = assistantCollectVisibleNodes(['textarea[data-temp-remark]']);
        if (targetFileId) {
          allRemarkVisible = allRemarkVisible.filter(function(node) {
            var rid = node && node.dataset ? String(node.dataset.tempRemark || '') : '';
            return rid === targetFileId;
          });
        }
        if (!allRemarkVisible.length) {
          return { ok: false, reason: '未找到备注输入框，请先展开目标行备注并重试' };
        }
        var changedRemark = 0;
        allRemarkVisible.forEach(function(node) {
          if (assistantApplyEditableNodeValue(node, finalRemarkValue)) changedRemark += 1;
        });
        if (changedRemark <= 0) return { ok: false, reason: '写入失败，请重试' };
        return {
          ok: true,
          context: context,
          field: 'remark',
          value: finalRemarkValue,
          operation: operation,
          scope: 'all',
          count: changedRemark,
          index: 1,
          fileId: targetFileId,
          cleared: finalRemarkValue === '',
        };
      }

      var node = null;
      if (context === 'case-library') {
        if (pair.field === 'actual') return { ok: false, reason: '用例库页面不支持修改执行结果字段' };
        node = assistantPickCaseLibraryEditableNode(pair.field, index);
      } else {
        var tempField = pair.field;
        if (tempField === 'precondition') tempField = 'preconditions';
        if (tempField === 'remark') {
          var tempApiForRemark = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
          var remarkFileId = fileId || assistantResolveTempExecActiveFileId(tempApiForRemark);
          var remarkFile = remarkFileId ? assistantGetTempExecFileById(remarkFileId) : null;
          if (!remarkFile && Array.isArray(state.tempExecFiles) && state.tempExecFiles.length) {
            remarkFile = state.tempExecFiles[0];
            remarkFileId = remarkFile && remarkFile.id !== undefined && remarkFile.id !== null ? String(remarkFile.id) : '';
          }
          var remarkIndex = Number(index);
          if (!Number.isFinite(remarkIndex) || remarkIndex <= 0) remarkIndex = 1;
          var remarkSourceIndex = remarkIndex - 1;
          if (remarkFile && Array.isArray(remarkFile.cases) && remarkFile.cases.length) {
            if (remarkSourceIndex < 0 || remarkSourceIndex >= remarkFile.cases.length) {
              if (Number.isFinite(index) && index > 0) {
                return { ok: false, reason: '未找到目标可编辑单元格，请先确认已打开可编辑用例列表并可见目标行' };
              }
              remarkSourceIndex = 0;
              remarkIndex = 1;
            }
            var prevRemark = '';
            var remarkRow = remarkFile.cases[remarkSourceIndex];
            if (remarkRow && remarkRow.remark !== undefined && remarkRow.remark !== null) prevRemark = String(remarkRow.remark);
            var nextRemark = String(normalizedValue || '');
            if (operation === 'append') {
              nextRemark = String(prevRemark || '') + nextRemark;
            } else if (operation === 'prepend') {
              nextRemark = nextRemark + String(prevRemark || '');
            }
            if (tempApiForRemark && typeof tempApiForRemark.updateTempExecRemark === 'function' && remarkFileId) {
              tempApiForRemark.updateTempExecRemark(String(remarkFileId), remarkSourceIndex, nextRemark);
              return {
                ok: true,
                context: context,
                field: 'remark',
                value: nextRemark,
                operation: operation,
                scope: 'single',
                count: 1,
                index: remarkSourceIndex + 1,
                fileId: String(remarkFileId),
                cleared: nextRemark === '',
              };
            }
            normalizedValue = nextRemark;
            operation = 'replace';
            index = remarkIndex;
            fileId = String(remarkFileId || '');
          }
          node = assistantPickTempExecRemarkNode(index, fileId || remarkFileId || '');
        } else if (tempField === 'actual') {
          node = assistantPickTempExecResultNode(index, fileId);
        } else {
          node = assistantPickTempExecEditableNode(tempField, index, fileId);
        }
        pair.field = tempField;
      }
      if (!node) {
        if (context === 'tempexec' && pair.field === 'actual') {
          return { ok: false, reason: '未找到执行结果下拉框，请先确认当前在“用例执行”列表视图并且目标行可见' };
        }
        if (context === 'tempexec' && pair.field === 'remark') {
          return { ok: false, reason: '未找到备注输入框，请先展开目标行备注并重试' };
        }
        return { ok: false, reason: '未找到目标可编辑单元格，请先确认已打开可编辑用例列表并可见目标行' };
      }
      var finalValue = normalizedValue;
      if (pair.field === 'actual') {
        operation = 'replace';
        finalValue = assistantResolveSelectOptionValue(node, normalizedValue);
        if (!finalValue) {
          return { ok: false, reason: '执行结果仅支持：未执行 / 通过 / 失败 / 阻塞 / 不适用' };
        }
      } else if (pair.field !== 'priority') {
        var prevValue = assistantReadEditableNodeValue(node);
        if (operation === 'append') {
          finalValue = String(prevValue || '') + String(normalizedValue || '');
        } else if (operation === 'prepend') {
          finalValue = String(normalizedValue || '') + String(prevValue || '');
        }
      }
      if (!assistantApplyEditableNodeValue(node, finalValue)) {
        return { ok: false, reason: '写入失败，请重试' };
      }

      var resolvedIndex = 0;
      if (context === 'case-library') {
        var idxText = node.getAttribute ? node.getAttribute('data-index') : '';
        var idxNum = Number(idxText);
        if (Number.isFinite(idxNum) && idxNum >= 0) resolvedIndex = idxNum + 1;
      } else {
        var tempIdx = node && node.dataset ? Number(node.dataset.tempEditIndex) : NaN;
        if (!Number.isFinite(tempIdx)) tempIdx = node && node.dataset ? Number(node.dataset.index) : NaN;
        if (Number.isFinite(tempIdx) && tempIdx >= 0) resolvedIndex = tempIdx + 1;
      }

      var resolvedFileId = fileId;
      if (context === 'tempexec' && node && node.dataset) {
        resolvedFileId = String(node.dataset.tempEditFile || node.dataset.tempResult || fileId || '');
      }

      return {
        ok: true,
        context: context,
        field: pair.field,
        value: finalValue,
        operation: operation,
        scope: scope === 'all' ? 'all' : 'single',
        count: 1,
        index: resolvedIndex > 0 ? resolvedIndex : (index > 0 ? index : 1),
        fileId: context === 'tempexec' ? resolvedFileId : fileId,
        cleared: assistantIsCaseFieldClearable(pair.field) && String(finalValue || '') === '',
      };
    }

    function assistantSanitizeFailureContext(payload) {
      var source = payload && typeof payload === 'object' ? payload : {};
      var requestMeta = source.requestMeta && typeof source.requestMeta === 'object' ? source.requestMeta : {};
      return {
        scene: source.scene ? String(source.scene) : '',
        modelId: source.modelId ? String(source.modelId) : '',
        modelName: source.modelName ? String(source.modelName) : '',
        provider: source.provider ? String(source.provider) : '',
        statusCode: Number(source.statusCode) || 0,
        errorMessage: source.errorMessage ? String(source.errorMessage) : '',
        responsePreview: source.responsePreview ? String(source.responsePreview).slice(0, 200) : '',
        requestMeta: {
          hasApiKey: requestMeta.hasApiKey === true,
          baseUrl: assistantSanitizeBaseUrl(requestMeta.baseUrl || requestMeta.requestUrl || ''),
          isResponsesApi: requestMeta.isResponsesApi === true,
          usedProxy: requestMeta.usedProxy === true,
          usedFallbackDirect: requestMeta.usedFallbackDirect === true,
          timeoutSec: Number(requestMeta.timeoutSec) || 30,
        },
        timestamp: source.timestamp || Date.now(),
      };
    }

    function assistantBuildFailurePrompt() {
      return [
        '你是模型连通性诊断助手。',
        '请根据给定错误上下文做自由判断，输出“问题判断 + 修复步骤 + 可执行代填项”。',
        '输出 JSON，不要输出额外文本，结构如下：',
        '{"judgement":"", "rootCause":"", "steps":[""], "patch":{"provider":"","baseUrl":"","model":"","maxTokens":1024}, "manualItems":[""], "confidence":"high|medium|low"}',
        '约束：',
        '1) patch 仅可包含 provider/baseUrl/model/maxTokens；不允许 apiKey。',
        '2) 若无需代填，patch 输出空对象 {}。',
        '3) steps 必须给用户明确可执行步骤。',
      ].join('\n');
    }

    function assistantInferFailureFallback(ctx) {
      var statusCode = Number(ctx && ctx.statusCode) || 0;
      var errorText = ctx && ctx.errorMessage ? String(ctx.errorMessage).toLowerCase() : '';
      var judgement = '模型连通性异常';
      var steps = [];
      if (statusCode === 401 || statusCode === 403) {
        judgement = '鉴权或权限异常';
        steps = ['检查 API Key 是否有效且权限覆盖当前模型。', '若使用组织/项目鉴权，确认账号已授权该模型。'];
      } else if (statusCode === 404 || statusCode === 405) {
        judgement = '接口地址或协议不匹配';
        steps = ['检查 baseUrl 是否为正确的兼容端点。', '确认是否需要使用 /chat/completions 或 /responses 接口。'];
      } else if (statusCode === 429) {
        judgement = '请求被限流';
        steps = ['降低并发或增加重试退避。', '检查平台配额与速率限制配置。'];
      } else if (statusCode >= 500) {
        judgement = '模型服务端异常';
        steps = ['稍后重试并查看服务商状态页。', '适当上调超时时间或切换可用模型。'];
      } else if (errorText.indexOf('failed to fetch') !== -1 || errorText.indexOf('networkerror') !== -1) {
        judgement = '网络连接异常';
        steps = ['检查本机到模型服务的网络连通性。', '确认代理/网关/CORS 配置是否阻断请求。'];
      } else {
        steps = ['检查模型配置项是否完整。', '查看响应片段并按状态码进一步定位。'];
      }
      return {
        judgement: judgement,
        rootCause: judgement,
        steps: steps,
        patch: {},
        manualItems: ['API Key 需手动更新，助手不会自动填写。'],
        confidence: 'medium',
      };
    }

    async function assistantDiagnoseFailure(payload, options) {
      var opts = options && typeof options === 'object' ? options : {};
      var safeContext = assistantSanitizeFailureContext(payload);
      var prompt = assistantBuildFailurePrompt();
      var diagInput = JSON.stringify(safeContext, null, 2);
      var modelReply = await assistantCallModel(diagInput, {
        prompt: prompt,
        modelId: opts.modelId || '',
        temperature: 0.2,
      });
      if (!modelReply.ok) {
        return {
          ok: false,
          reason: modelReply.reason || '诊断模型调用失败',
          diagnosis: assistantInferFailureFallback(safeContext),
          context: safeContext,
        };
      }
      var parsed = assistantExtractJsonPayload(modelReply.content || '');
      var diagnosis = parsed && typeof parsed === 'object'
        ? parsed
        : assistantInferFailureFallback(safeContext);
      diagnosis.patch = assistantNormalizeDiagPatch(diagnosis.patch);
      if (!Array.isArray(diagnosis.steps)) diagnosis.steps = [];
      if (!Array.isArray(diagnosis.manualItems)) diagnosis.manualItems = [];
      return {
        ok: true,
        diagnosis: diagnosis,
        raw: modelReply.content || '',
        context: safeContext,
      };
    }

    function assistantApplyGeneralSettingsPatch(patch, options) {
      var incoming = patch && typeof patch === 'object' ? Object.assign({}, patch) : {};
      var opts = options && typeof options === 'object' ? options : {};
      var changedKeys = [];
      var assistantChangedKeys = [];

      var hasAssistantKeys = Object.prototype.hasOwnProperty.call(incoming, 'assistantEnabled')
        || Object.prototype.hasOwnProperty.call(incoming, 'assistantModelId');
      if (hasAssistantKeys) {
        var assistantPatch = {};
        if (Object.prototype.hasOwnProperty.call(incoming, 'assistantEnabled')) {
          assistantPatch.assistantEnabled = incoming.assistantEnabled === true;
        }
        if (Object.prototype.hasOwnProperty.call(incoming, 'assistantModelId')) {
          assistantPatch.assistantModelId = incoming.assistantModelId;
        }
        var assistantRes = applyAssistantSettingsPatch(assistantPatch, opts);
        if (!assistantRes || assistantRes.ok !== true) return assistantRes;
        if (assistantRes.changed) {
          if (Object.prototype.hasOwnProperty.call(assistantPatch, 'assistantEnabled')) {
            assistantChangedKeys.push('assistantEnabled');
          }
          if (Object.prototype.hasOwnProperty.call(assistantPatch, 'assistantModelId')) {
            assistantChangedKeys.push('assistantModelId');
          }
        }
        delete incoming.assistantEnabled;
        delete incoming.assistantModelId;
      }

      if (!state.settings || typeof state.settings !== 'object') {
        state.settings = Object.assign({}, defaultSettings);
      }
      if (Object.prototype.hasOwnProperty.call(incoming, 'missingCaseReminderAiEnabled')) {
        var aiEnabled = String(incoming.missingCaseReminderAiEnabled || '').toLowerCase() === 'on' ? 'on' : 'off';
        if (state.settings.missingCaseReminderAiEnabled !== aiEnabled) {
          state.settings.missingCaseReminderAiEnabled = aiEnabled;
          changedKeys.push('missingCaseReminderAiEnabled');
        }
      }
      if (Object.prototype.hasOwnProperty.call(incoming, 'smartTopNavCollapse')) {
        var navCollapse = incoming.smartTopNavCollapse === true;
        if (state.settings.smartTopNavCollapse !== navCollapse) {
          state.settings.smartTopNavCollapse = navCollapse;
          changedKeys.push('smartTopNavCollapse');
        }
      }
      if (Object.prototype.hasOwnProperty.call(incoming, 'theme')) {
        var theme = String(incoming.theme || '').toLowerCase() === 'dark' ? 'dark' : 'light';
        if (state.settings.theme !== theme) {
          state.settings.theme = theme;
          changedKeys.push('theme');
        }
      }
      if (Object.prototype.hasOwnProperty.call(incoming, 'timeoutSec')) {
        var sec = clampTimeoutSeconds(incoming.timeoutSec);
        if (state.settings.timeoutSec !== sec) {
          state.settings.timeoutSec = sec;
          changedKeys.push('timeoutSec');
        }
      }

      var allChangedKeys = assistantChangedKeys.concat(changedKeys);
      if (!allChangedKeys.length) {
        return { ok: true, changed: false, keys: [] };
      }
      if (changedKeys.length) {
        persistSettings(changedKeys);
        renderSettingsUI();
        assistantDispatchEvent('app-settings-updated', { keys: changedKeys.slice() });
        assistantDispatchEvent('app-assistant-state-changed', {
          source: opts.source || 'assistant',
          changed: true,
        });
      }
      return { ok: true, changed: true, keys: allChangedKeys.slice() };
    }

    function assistantDescribeSetting(key) {
      var map = {
        assistantEnabled: '控制右下角全局AI助手是否可用。关闭时入口可见但锁定。',
        assistantModelId: '设置助手聊天与诊断使用的模型，需先配置完整模型信息。',
        missingCaseReminderAiEnabled: '控制易漏用例推荐是否启用AI推断。',
        smartTopNavCollapse: '开启后顶部导航会根据场景自动收起，减少占用。',
        theme: '页面主题配色，支持白色/黑色主题。',
        timeoutSec: '模型调用超时时间（秒），影响各AI功能请求等待上限。',
      };
      return map[key] || '该设置项暂无内置说明。';
    }

    var assistantUiControlRegistry = {};
    var assistantUiControlSeq = 0;

    function assistantBuildMcpConfirmRequired(tool, payload) {
      return {
        ok: false,
        tool: tool,
        reason: 'confirm_required',
        data: payload && typeof payload === 'object' ? Object.assign({}, payload) : {},
      };
    }

    function assistantIsElementVisible(node) {
      if (!node || node.nodeType !== 1) return false;
      if (node.hidden) return false;
      if (node.offsetParent !== null) return true;
      if (typeof node.getClientRects === 'function' && node.getClientRects().length > 0) return true;
      return false;
    }

    function assistantControlText(node) {
      if (!node) return '';
      var tag = node.tagName ? String(node.tagName).toLowerCase() : '';
      if (tag === 'input') {
        var inputType = node.type ? String(node.type).toLowerCase() : '';
        if (inputType === 'button' || inputType === 'submit' || inputType === 'reset') {
          if (node.value !== undefined && node.value !== null && String(node.value).trim()) return String(node.value).trim();
        }
      }
      var aria = node.getAttribute ? node.getAttribute('aria-label') : '';
      if (aria && String(aria).trim()) return String(aria).trim();
      if (node.textContent && String(node.textContent).trim()) return String(node.textContent).trim();
      if (node.placeholder && String(node.placeholder).trim()) return String(node.placeholder).trim();
      if (node.value !== undefined && node.value !== null && String(node.value).trim()) return String(node.value).trim();
      return '';
    }

    function assistantControlType(node) {
      if (!node) return '';
      var tag = node.tagName ? String(node.tagName).toLowerCase() : '';
      if (node.dataset && node.dataset.tabBtn !== undefined) return 'tab';
      if (tag === 'button') return 'button';
      if (tag === 'textarea') return 'textarea';
      if (tag === 'select') return 'select';
      if (tag === 'a') return 'link';
      if (tag === 'input') {
        var inputType = node.type ? String(node.type).toLowerCase() : 'text';
        if (inputType === 'search') return 'search';
        if (inputType === 'checkbox' || inputType === 'radio') return 'toggle';
        return 'input';
      }
      if (node.getAttribute && node.getAttribute('role') === 'button') return 'button';
      return tag || 'node';
    }

    function assistantControlRequiresConfirm(meta) {
      var item = meta && typeof meta === 'object' ? meta : {};
      var text = [
        item.text || '',
        item.domId || '',
        item.className || '',
      ].join(' ').toLowerCase();
      var writeKeywords = [
        'save', 'submit', 'delete', 'remove', 'clear', 'create', 'add', 'update', 'edit', 'apply',
        'patch', 'archive', 'publish', 'overwrite', 'sync', 'generate', 'import', 'execute',
        '保存', '提交', '删除', '移除', '清空', '创建', '新增', '更新', '修改', '编辑', '应用',
        '归档', '发布', '覆盖', '同步', '生成', '导入', '执行', '触发', '确认',
      ];
      for (var i = 0; i < writeKeywords.length; i += 1) {
        if (text.indexOf(writeKeywords[i]) !== -1) return true;
      }
      return false;
    }

    function assistantInspectUiControl(node) {
      if (!node || node.nodeType !== 1) return null;
      if (assistantIsInsideAssistantPanel(node)) return null;
      var tag = node.tagName ? String(node.tagName).toLowerCase() : '';
      if (!tag) return null;
      if (tag === 'input') {
        var inputType = node.type ? String(node.type).toLowerCase() : '';
        if (inputType === 'hidden' || inputType === 'file') return null;
      }
      var info = {
        element: node,
        tag: tag,
        type: assistantControlType(node),
        text: assistantControlText(node),
        domId: node.id ? String(node.id) : '',
        className: node.className ? String(node.className) : '',
        disabled: Boolean(node.disabled),
        visible: assistantIsElementVisible(node),
      };
      info.requiresConfirm = assistantControlRequiresConfirm(info);
      return info;
    }

    function assistantListUiControls(options) {
      var opts = options && typeof options === 'object' ? options : {};
      var includeDisabled = opts.includeDisabled === true;
      var max = Number(opts.max);
      if (!Number.isFinite(max) || max <= 0) max = 120;
      if (max > 240) max = 240;
      assistantUiControlRegistry = {};
      var controls = [];
      var selectors = [
        'button',
        '[role="button"]',
        'a[href]',
        'input',
        'textarea',
        'select',
        '[data-tab-btn]',
      ].join(',');
      var nodes = document.querySelectorAll(selectors);
      var seen = [];
      for (var i = 0; i < nodes.length; i += 1) {
        var node = nodes[i];
        if (!node || seen.indexOf(node) !== -1) continue;
        seen.push(node);
        var info = assistantInspectUiControl(node);
        if (!info) continue;
        if (!info.visible) continue;
        if (!includeDisabled && info.disabled) continue;
        var controlId = 'ctl-' + Date.now() + '-' + String(++assistantUiControlSeq);
        assistantUiControlRegistry[controlId] = node;
        controls.push({
          controlId: controlId,
          type: info.type,
          tag: info.tag,
          text: info.text,
          domId: info.domId,
          disabled: info.disabled,
          requiresConfirm: info.requiresConfirm === true,
        });
        if (controls.length >= max) break;
      }
      return controls;
    }

    function assistantReadFirstArgString(args, keys) {
      var payload = args && typeof args === 'object' ? args : {};
      var list = Array.isArray(keys) ? keys : [];
      for (var i = 0; i < list.length; i += 1) {
        var key = String(list[i] || '').trim();
        if (!key) continue;
        if (payload[key] === undefined || payload[key] === null) continue;
        var text = String(payload[key]).trim();
        if (text) return text;
      }
      return '';
    }

    function assistantCollectUiLocateKeywords(args) {
      var payload = args && typeof args === 'object' ? args : {};
      var keys = ['controlText', 'target', 'targetText', 'label', 'field', 'text', 'control', 'name', 'title', 'placeholder', 'ariaLabel', 'keyword'];
      var out = [];
      for (var i = 0; i < keys.length; i += 1) {
        var key = keys[i];
        if (payload[key] === undefined || payload[key] === null) continue;
        var value = String(payload[key]).trim();
        if (!value) continue;
        if (out.indexOf(value) === -1) out.push(value);
      }
      return out;
    }

    function assistantResolveUiControl(payload, options) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var opts = options && typeof options === 'object' ? options : {};
      var preferInput = opts.preferInput === true;
      var allowAssistantPanel = opts.allowAssistantPanel === true;
      if (args.controlId) {
        var nodeById = assistantUiControlRegistry[String(args.controlId)] || null;
        if (nodeById && (allowAssistantPanel || !assistantIsInsideAssistantPanel(nodeById))) return nodeById;
      }
      var domIdValue = assistantReadFirstArgString(args, ['domId', 'id', 'elementId']);
      if (domIdValue) {
        var byDomId = document.getElementById(String(domIdValue));
        if (byDomId && (allowAssistantPanel || !assistantIsInsideAssistantPanel(byDomId))) return byDomId;
      }
      if (args.selector) {
        try {
          var bySelector = document.querySelector(String(args.selector));
          if (bySelector && (allowAssistantPanel || !assistantIsInsideAssistantPanel(bySelector))) return bySelector;
        } catch (err) {
          return null;
        }
      }
      var locateKeywords = assistantCollectUiLocateKeywords(args);
      for (var k = 0; k < locateKeywords.length; k += 1) {
        var keyword = String(locateKeywords[k] || '').trim().toLowerCase();
        if (!keyword) continue;
        var nodes = document.querySelectorAll('button,[role="button"],a[href],label,input,textarea,select,[data-tab-btn]');
        var best = null;
        var bestScore = -1;
        for (var i = 0; i < nodes.length; i += 1) {
          var node = nodes[i];
          if (!assistantIsElementVisible(node)) continue;
          if (!allowAssistantPanel && assistantIsInsideAssistantPanel(node)) continue;
          var controlText = assistantControlText(node).toLowerCase();
          var idText = node.id ? String(node.id).toLowerCase() : '';
          var nameText = node.name ? String(node.name).toLowerCase() : '';
          var placeholderText = node.placeholder ? String(node.placeholder).toLowerCase() : '';
          var ariaText = node.getAttribute ? String(node.getAttribute('aria-label') || '').toLowerCase() : '';
          var classText = node.className ? String(node.className).toLowerCase() : '';
          var searchable = [controlText, idText, nameText, placeholderText, ariaText, classText].join(' ');
          if (!searchable || searchable.indexOf(keyword) === -1) continue;
          var score = 0;
          if (controlText) {
            if (controlText === keyword) score += 6;
            else if (controlText.indexOf(keyword) !== -1) score += 4;
          }
          if (idText) {
            if (idText === keyword) score += 5;
            else if (idText.indexOf(keyword) !== -1) score += 3;
          }
          if (nameText) {
            if (nameText === keyword) score += 4;
            else if (nameText.indexOf(keyword) !== -1) score += 2;
          }
          if (placeholderText) {
            if (placeholderText === keyword) score += 4;
            else if (placeholderText.indexOf(keyword) !== -1) score += 3;
          }
          if (ariaText) {
            if (ariaText === keyword) score += 4;
            else if (ariaText.indexOf(keyword) !== -1) score += 2;
          }
          if (preferInput && assistantIsInputLikeControl(node)) score += 8;
          var tag = node.tagName ? String(node.tagName).toLowerCase() : '';
          if (tag === 'label') score -= 2;
          if (score > bestScore) {
            best = node;
            bestScore = score;
          }
        }
        if (best) return best;
      }
      return null;
    }

    function assistantIsInputLikeControl(node) {
      if (!node || node.nodeType !== 1) return false;
      var tag = node.tagName ? String(node.tagName).toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (node.isContentEditable) return true;
      return false;
    }

    function assistantIsInsideAssistantPanel(node) {
      if (!node || typeof node.closest !== 'function') return false;
      return !!node.closest('#assistantPanel');
    }

    function assistantIsUsableInputControl(node) {
      if (!assistantIsInputLikeControl(node)) return false;
      if (!assistantIsElementVisible(node)) return false;
      if (node.disabled) return false;
      if (node.readOnly === true) return false;
      if (assistantIsInsideAssistantPanel(node)) return false;
      return true;
    }

    function assistantContainsSearchHint(text) {
      var source = text === undefined || text === null ? '' : String(text).toLowerCase();
      if (!source) return false;
      var keys = ['search', 'keyword', 'filter', 'query', 'q=', '搜索', '筛选', '关键字', '关键词'];
      for (var i = 0; i < keys.length; i += 1) {
        if (source.indexOf(keys[i]) !== -1) return true;
      }
      return false;
    }

    function assistantIsSearchLikeInput(node) {
      if (!assistantIsUsableInputControl(node)) return false;
      var tag = node.tagName ? String(node.tagName).toLowerCase() : '';
      if (tag === 'input') {
        var inputType = node.type ? String(node.type).toLowerCase() : '';
        if (inputType === 'search') return true;
      }
      if (node.dataset && node.dataset.tempSearchInput !== undefined) return true;
      var parts = [];
      if (node.id) parts.push(String(node.id));
      if (node.name) parts.push(String(node.name));
      if (node.className) parts.push(String(node.className));
      if (node.placeholder) parts.push(String(node.placeholder));
      if (node.getAttribute) {
        var aria = node.getAttribute('aria-label');
        if (aria) parts.push(String(aria));
      }
      return assistantContainsSearchHint(parts.join(' '));
    }

    function assistantPickFirstUsableInput(selectors) {
      var list = Array.isArray(selectors) ? selectors : [];
      for (var i = 0; i < list.length; i += 1) {
        var selector = String(list[i] || '').trim();
        if (!selector) continue;
        var nodes = [];
        try {
          nodes = document.querySelectorAll(selector);
        } catch (err) {
          nodes = [];
        }
        if (!nodes || !nodes.length) continue;
        for (var j = 0; j < nodes.length; j += 1) {
          var node = nodes[j];
          if (!assistantIsUsableInputControl(node)) continue;
          return node;
        }
      }
      return null;
    }

    function assistantFindUsableInputInNode(node) {
      if (!node || typeof node.querySelectorAll !== 'function') return null;
      var nodes = [];
      try {
        nodes = node.querySelectorAll('input:not([type="hidden"]):not([type="file"]),textarea,select,[contenteditable]');
      } catch (err) {
        nodes = [];
      }
      for (var i = 0; i < nodes.length; i += 1) {
        var current = nodes[i];
        if (assistantIsUsableInputControl(current)) return current;
      }
      return null;
    }

    function assistantResolveRelatedInputControl(node) {
      if (!node || node.nodeType !== 1) return null;
      if (assistantIsUsableInputControl(node)) return node;
      var tag = node.tagName ? String(node.tagName).toLowerCase() : '';
      if (tag === 'label') {
        if (node.control && assistantIsUsableInputControl(node.control)) return node.control;
        var forId = node.getAttribute ? String(node.getAttribute('for') || '').trim() : '';
        if (forId) {
          var byFor = document.getElementById(forId);
          if (assistantIsUsableInputControl(byFor)) return byFor;
        }
      }
      var inNode = assistantFindUsableInputInNode(node);
      if (inNode) return inNode;
      var parent = node.parentElement;
      var depth = 0;
      while (parent && depth < 4) {
        var inParent = assistantFindUsableInputInNode(parent);
        if (inParent) return inParent;
        parent = parent.parentElement;
        depth += 1;
      }
      return null;
    }

    function assistantResolveFallbackInputControl(payload) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var preferSearch = args.preferSearch !== false;
      var active = document.activeElement;
      if (assistantIsUsableInputControl(active)) {
        if (!preferSearch || assistantIsSearchLikeInput(active)) return active;
      }
      var activeTab = state && state.activeTab ? String(state.activeTab) : '';
      var tabSelectorMap = {
        tempexec: ['#tempExecToolbar input[data-temp-search-input]'],
        'case-library': [
          '#caseLibraryEditSearchInput',
          '#caseLibraryEditFileSearchInput',
          '#caseLibrarySelectSearchInput',
          '#caseLibraryAssociationPickSearchInput',
          '#caseLibraryHistorySearchInput',
          '#caseLibraryImportSelectSearchInput',
        ],
        'case-archive': ['#caseArchiveSearchInput', '#caseArchiveDetailSearchInput'],
        'exec-overview': ['#execOverviewExecSetSearchInput'],
      };
      if (Object.prototype.hasOwnProperty.call(tabSelectorMap, activeTab)) {
        var tabNode = assistantPickFirstUsableInput(tabSelectorMap[activeTab]);
        if (tabNode) return tabNode;
      }
      var searchSelectors = [
        'input[data-temp-search-input]',
        'input[type="search"]',
        'input[placeholder*="搜索"]',
        'input[placeholder*="search" i]',
        'input[id*="Search" i]',
        'textarea[placeholder*="搜索"]',
        'textarea[placeholder*="search" i]',
      ];
      var searchNode = assistantPickFirstUsableInput(searchSelectors);
      if (searchNode) return searchNode;
      if (preferSearch) return null;
      return assistantPickFirstUsableInput(['input:not([type="hidden"]):not([type="file"])', 'textarea', 'select', '[contenteditable]']);
    }

    function assistantResolveUiFillValue(payload) {
      var args = payload && typeof payload === 'object' ? payload : {};
      if (args.value !== undefined && args.value !== null) return String(args.value);
      if (args.input !== undefined && args.input !== null) return String(args.input);
      if (args.content !== undefined && args.content !== null) return String(args.content);
      if (args.keyword !== undefined && args.keyword !== null) return String(args.keyword);
      if (args.term !== undefined && args.term !== null) return String(args.term);
      if (args.query !== undefined && args.query !== null) return String(args.query);
      if (args.text !== undefined && args.text !== null) return String(args.text);
      return '';
    }

    function assistantClickUiControl(payload, tool) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var target = assistantResolveUiControl(args);
      if (!target && assistantIsExecArchiveControlRequest(args)) target = assistantResolveExecArchiveControl(args);
      if (!target) return { ok: false, tool: tool, reason: '未找到目标控件' };
      var info = assistantInspectUiControl(target);
      if (!info) return { ok: false, tool: tool, reason: '目标控件不可操作' };
      if (!info.visible) return { ok: false, tool: tool, reason: '目标控件当前不可见' };
      if (info.disabled) return { ok: false, tool: tool, reason: '目标控件当前不可用' };
      if (info.requiresConfirm && args.confirmed !== true) {
        var actionLabel = '点击控件';
        var message = '该控件可能触发写操作，请确认后执行。';
        if (assistantIsExecArchiveControlRequest(args)) {
          var tempApi = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
          var file = assistantResolveTempExecTargetFile(args, tempApi);
          var counts = assistantBuildTempExecArchiveCounts(file, tempApi);
          var confirmMeta = assistantBuildExecArchiveConfirmMeta(args, file, counts);
          actionLabel = confirmMeta.actionLabel;
          message = confirmMeta.message;
        }
        return assistantBuildMcpConfirmRequired(tool, {
          actionLabel: actionLabel,
          message: message,
          controlText: info.text || info.domId || '',
          controlId: args.controlId || '',
        });
      }
      try {
        target.click();
      } catch (err2) {
        return { ok: false, tool: tool, reason: err2 && err2.message ? String(err2.message) : '点击失败' };
      }
      return {
        ok: true,
        tool: tool,
        data: {
          controlId: args.controlId || '',
          domId: info.domId || '',
          controlText: info.text || '',
          type: info.type || '',
        },
      };
    }

    function assistantFillUiInput(payload, tool) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var hasExplicitLocator = Boolean(
        args.controlId ||
        args.domId ||
        args.id ||
        args.elementId ||
        args.selector ||
        args.controlText ||
        args.target ||
        args.targetText ||
        args.label ||
        args.field ||
        args.control ||
        args.name ||
        args.title ||
        args.placeholder ||
        args.ariaLabel
      );
      var resolveArgs = Object.assign({}, args);
      if (!hasExplicitLocator && resolveArgs.text !== undefined && resolveArgs.text !== null) {
        // 仅有 text 参数时优先将其视为“输入值”，避免被误当成控件定位词。
        delete resolveArgs.text;
      }
      var target = assistantResolveUiControl(resolveArgs, { preferInput: true });
      if (target && !assistantIsUsableInputControl(target)) {
        var related = assistantResolveRelatedInputControl(target);
        if (related) target = related;
      }
      if (!target && !hasExplicitLocator) target = assistantResolveFallbackInputControl({ preferSearch: true });
      if (!target) return { ok: false, tool: tool, reason: '未找到目标输入控件' };
      if (!assistantIsUsableInputControl(target)) return { ok: false, tool: tool, reason: '目标输入控件当前不可用' };
      var tag = target.tagName ? String(target.tagName).toLowerCase() : '';
      var value = assistantResolveUiFillValue(args);
      var caseEditableMeta = assistantResolveCaseEditableMeta(target);
      var operation = 'replace';
      if (caseEditableMeta) {
        if (args.confirmed !== true) {
          var caseEditConfirmMeta = assistantBuildCaseUpdateConfirmMeta(Object.assign({}, args, {
            context: caseEditableMeta.context,
            field: caseEditableMeta.field,
            value: value,
          }), caseEditableMeta.context);
          return assistantBuildMcpConfirmRequired(tool, {
            actionLabel: caseEditConfirmMeta.actionLabel,
            message: caseEditConfirmMeta.message,
            controlText: assistantControlText(target),
            domId: target.id ? String(target.id) : '',
          });
        }
        operation = assistantNormalizeCaseUpdateOperation(args, 'replace');
        var normalizeValueRes = assistantNormalizeCaseUpdateValue(caseEditableMeta.field, value, {
          allowEmpty: assistantShouldAllowCaseEmptyValue(caseEditableMeta.field, args),
        });
        if (!normalizeValueRes.ok) {
          return { ok: false, tool: tool, reason: normalizeValueRes.reason || '缺少要写入的值' };
        }
        value = normalizeValueRes.value;
        if (caseEditableMeta.field !== 'priority' && caseEditableMeta.field !== 'actual') {
          var prev = assistantReadEditableNodeValue(target);
          if (operation === 'append') {
            value = String(prev || '') + String(value || '');
          } else if (operation === 'prepend') {
            value = String(value || '') + String(prev || '');
          }
        }
      }
      try {
        if (tag === 'input' || tag === 'textarea' || tag === 'select') {
          target.value = value;
        } else if (target.isContentEditable) {
          target.textContent = value;
        } else {
          return { ok: false, tool: tool, reason: '目标控件不支持输入' };
        }
        var inputEvent = new Event('input', { bubbles: true });
        target.dispatchEvent(inputEvent);
        var changeEvent = new Event('change', { bubbles: true });
        target.dispatchEvent(changeEvent);
        if (args.submit === true || args.enter === true) {
          var keyEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
          target.dispatchEvent(keyEvent);
        }
      } catch (err) {
        return { ok: false, tool: tool, reason: err && err.message ? String(err.message) : '输入失败' };
      }
      return {
        ok: true,
        tool: tool,
        data: {
          controlId: args.controlId || '',
          domId: target.id ? String(target.id) : '',
          controlText: assistantControlText(target),
          value: value,
          operation: operation,
          context: caseEditableMeta ? caseEditableMeta.context : '',
          field: caseEditableMeta ? caseEditableMeta.field : '',
        },
      };
    }

    function assistantResolveTempExecActiveFileId(tempApi) {
      var list = Array.isArray(state.tempExecFiles) ? state.tempExecFiles : [];
      if (!list.length) return '';
      var activeId = state.tempExecActiveId || state.tempExecActiveFileId || '';
      if (activeId) return String(activeId);
      return list[0] && list[0].id !== undefined && list[0].id !== null ? String(list[0].id) : '';
    }

    function assistantGetTempExecFileById(fileId) {
      var list = Array.isArray(state.tempExecFiles) ? state.tempExecFiles : [];
      var id = fileId === undefined || fileId === null ? '' : String(fileId);
      if (!id) return null;
      for (var i = 0; i < list.length; i += 1) {
        var item = list[i];
        if (!item) continue;
        if (String(item.id || '') === id) return item;
      }
      return null;
    }

    function assistantResolveTempExecTargetFile(payload, tempApi) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var list = Array.isArray(state.tempExecFiles) ? state.tempExecFiles : [];
      var targetId = '';
      if (args.fileId !== undefined && args.fileId !== null) targetId = String(args.fileId).trim();
      if (!targetId && args.execFileId !== undefined && args.execFileId !== null) targetId = String(args.execFileId).trim();
      if (!targetId && args.caseFileId !== undefined && args.caseFileId !== null) targetId = String(args.caseFileId).trim();
      if (!targetId && args.caseId !== undefined && args.caseId !== null) targetId = String(args.caseId).trim();
      var fileNameAlias = '';
      if (!targetId && args.fileName !== undefined && args.fileName !== null) fileNameAlias = String(args.fileName).trim();
      if (!targetId && !fileNameAlias && args.name !== undefined && args.name !== null) fileNameAlias = String(args.name).trim();
      if (!targetId && !fileNameAlias && args.title !== undefined && args.title !== null) fileNameAlias = String(args.title).trim();
      if (!targetId && !fileNameAlias && args.file !== undefined && args.file !== null) fileNameAlias = String(args.file).trim();
      if (!targetId && fileNameAlias) targetId = assistantFindTempExecFileIdByName(fileNameAlias);
      var indexAlias = args.index;
      if ((indexAlias === undefined || indexAlias === null) && args.fileIndex !== undefined && args.fileIndex !== null) indexAlias = args.fileIndex;
      if ((indexAlias === undefined || indexAlias === null) && args.seq !== undefined && args.seq !== null) indexAlias = args.seq;
      if ((indexAlias === undefined || indexAlias === null) && args.position !== undefined && args.position !== null) indexAlias = args.position;
      if (!targetId && indexAlias !== undefined && indexAlias !== null) {
        var num = Math.floor(Number(indexAlias));
        if (Number.isFinite(num) && num > 0 && num <= list.length) {
          targetId = String(list[num - 1].id || '');
        }
      }
      if (!targetId) targetId = assistantResolveTempExecActiveFileId(tempApi);
      if (targetId) {
        var matched = assistantGetTempExecFileById(targetId);
        if (matched) return matched;
      }
      return list.length ? list[0] : null;
    }

    function assistantBuildTempExecArchiveCounts(file, tempApi) {
      var counts = { pending: 0, failed: 0, blocked: 0, total: 0 };
      var rows = file && Array.isArray(file.cases) ? file.cases : [];
      counts.total = rows.length;
      for (var i = 0; i < rows.length; i += 1) {
        var item = rows[i] && typeof rows[i] === 'object' ? rows[i] : {};
        var label = '';
        if (tempApi && typeof tempApi.getCaseExecutionDisplay === 'function') {
          try {
            var display = tempApi.getCaseExecutionDisplay(file, item);
            if (display && display.label !== undefined && display.label !== null) label = String(display.label).trim();
          } catch (_) {
            label = '';
          }
        }
        if (!label && item.actual !== undefined && item.actual !== null) label = String(item.actual).trim();
        if (!label && item.status !== undefined && item.status !== null) label = String(item.status).trim();
        if (!label && item.result !== undefined && item.result !== null) label = String(item.result).trim();
        label = assistantNormalizeTempExecActualValue(label) || '未执行';
        if (label === '通过' || label === '不适用') continue;
        if (label === '失败') counts.failed += 1;
        else if (label === '阻塞') counts.blocked += 1;
        else counts.pending += 1;
      }
      return counts;
    }

    function assistantResolveExecArchiveReason(payload, counts) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var explicitReason = assistantReadFirstArgString(args, ['reason', 'archiveReason', 'archive_reason']);
      if (explicitReason) return explicitReason;
      var info = counts && typeof counts === 'object' ? counts : { pending: 0, failed: 0, blocked: 0 };
      if (!(info.pending || info.failed || info.blocked)) return '';
      return '按用户指令归档；当前仍有未通过用例（未执行 ' + Number(info.pending || 0) + ' / 失败 ' + Number(info.failed || 0) + ' / 阻塞 ' + Number(info.blocked || 0) + '）。';
    }

    function assistantBuildExecArchiveConfirmMeta(payload, file, counts) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var info = counts && typeof counts === 'object' ? counts : { pending: 0, failed: 0, blocked: 0, total: 0 };
      var fileName = file && (file.name || file.file_name_clean || file.fileName)
        ? String(file.name || file.file_name_clean || file.fileName)
        : '';
      var targetLabel = fileName ? ('“' + assistantTrimCaseUpdateConfirmValue(fileName, 28) + '”') : '当前执行中的该份用例';
      var explicitReason = assistantReadFirstArgString(args, ['reason', 'archiveReason', 'archive_reason']);
      var finalReason = assistantResolveExecArchiveReason(args, info);
      var needReason = Boolean(info.pending || info.failed || info.blocked);
      var message = '';
      if (needReason) {
        var countText = '未执行 ' + Number(info.pending || 0) + ' / 失败 ' + Number(info.failed || 0) + ' / 阻塞 ' + Number(info.blocked || 0);
        if (explicitReason) {
          message = '将归档' + targetLabel + '；当前仍有未通过项（' + countText + '），将按提供原因继续：' + '“' + assistantTrimCaseUpdateConfirmValue(finalReason, 40) + '”。';
        } else {
          message = '将归档' + targetLabel + '；当前仍有未通过项（' + countText + '），确认后将自动补充归档原因：' + '“' + assistantTrimCaseUpdateConfirmValue(finalReason, 40) + '”。';
        }
      } else if (Number(info.total || 0) > 0) {
        message = '将归档' + targetLabel + '；当前用例已全部执行完成，归档后无法继续修改测试结果。';
      } else {
        message = '将归档' + targetLabel + '。';
      }
      return {
        actionLabel: '归档当前执行用例',
        message: message,
        reason: finalReason,
        needReason: needReason,
      };
    }

    function assistantIsExecArchiveControlRequest(payload) {
      var args = payload && typeof payload === 'object' ? payload : {};
      if (String(args.controlId || '').trim() === 'tempexecArchiveBtn') return true;
      var inspectText = [
        args.controlText,
        args.text,
        args.label,
        args.name,
        args.query,
        args.target,
        args.title,
      ].join(' ');
      return /归档|archive/i.test(inspectText);
    }

    function assistantResolveExecArchiveControl(payload) {
      var args = payload && typeof payload === 'object' ? payload : {};
      if (!assistantIsExecArchiveControlRequest(args)) return null;
      var tempApi = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
      var file = assistantResolveTempExecTargetFile(args, tempApi);
      var fileId = file && file.id !== undefined && file.id !== null ? String(file.id) : '';
      var execSetId = '';
      if (args.execSetId !== undefined && args.execSetId !== null && String(args.execSetId).trim()) execSetId = String(args.execSetId).trim();
      if (!execSetId && args.setId !== undefined && args.setId !== null && String(args.setId).trim()) execSetId = String(args.setId).trim();
      if (!execSetId && file && file.execSetId !== undefined && file.execSetId !== null && String(file.execSetId).trim()) execSetId = String(file.execSetId).trim();
      if (!execSetId && fileId) execSetId = fileId;
      var fileButtons = [];
      try {
        fileButtons = document.querySelectorAll('button[data-temp-file-archive]');
      } catch (_) {
        fileButtons = [];
      }
      var fallbackFileBtn = null;
      for (var i = 0; i < fileButtons.length; i += 1) {
        var fileBtn = fileButtons[i];
        if (!assistantIsElementVisible(fileBtn) || assistantIsInsideAssistantPanel(fileBtn) || fileBtn.disabled) continue;
        var currentFileId = fileBtn.getAttribute ? String(fileBtn.getAttribute('data-temp-file-archive') || '') : '';
        if (fileId && currentFileId === fileId) return fileBtn;
        if (!fallbackFileBtn) fallbackFileBtn = fileBtn;
      }
      var overviewButtons = [];
      try {
        overviewButtons = document.querySelectorAll('button[data-temp-overview-archive]');
      } catch (_) {
        overviewButtons = [];
      }
      var fallbackOverviewBtn = null;
      for (var j = 0; j < overviewButtons.length; j += 1) {
        var overviewBtn = overviewButtons[j];
        if (!assistantIsElementVisible(overviewBtn) || assistantIsInsideAssistantPanel(overviewBtn) || overviewBtn.disabled) continue;
        var currentExecSetId = overviewBtn.getAttribute ? String(overviewBtn.getAttribute('data-temp-overview-archive') || '') : '';
        if (execSetId && currentExecSetId === execSetId) return overviewBtn;
        if (!fallbackOverviewBtn) fallbackOverviewBtn = overviewBtn;
      }
      return fallbackFileBtn || fallbackOverviewBtn || null;
    }

    function assistantArchiveCurrentExecCases(payload, tool) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var tempApi = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
      var client = window.app && window.app.apiClient ? window.app.apiClient : null;
      var file = assistantResolveTempExecTargetFile(args, tempApi);
      if (!file) return Promise.resolve({ ok: false, tool: tool, reason: '当前没有可归档的执行用例' });
      if (file._casesLoading) return Promise.resolve({ ok: false, tool: tool, reason: '用例加载中，请稍后再试' });
      if (tempApi && typeof tempApi.setTempExecActive === 'function' && file.id !== undefined && file.id !== null) {
        try { tempApi.setTempExecActive(String(file.id)); } catch (_) {}
      }
      if (!client || typeof client.archiveExecSet !== 'function') {
        return Promise.resolve({ ok: false, tool: tool, reason: '当前模式不支持归档（需启用 DB 后端）' });
      }
      var sidRaw = args.execSetId;
      if ((sidRaw === undefined || sidRaw === null || String(sidRaw).trim() === '') && args.setId !== undefined && args.setId !== null) sidRaw = args.setId;
      if ((sidRaw === undefined || sidRaw === null || String(sidRaw).trim() === '') && args.execSet !== undefined && args.execSet !== null) sidRaw = args.execSet;
      if ((sidRaw === undefined || sidRaw === null || String(sidRaw).trim() === '') && file && file.execSetId !== undefined && file.execSetId !== null) sidRaw = file.execSetId;
      if ((sidRaw === undefined || sidRaw === null || String(sidRaw).trim() === '') && file && file.id !== undefined && file.id !== null) sidRaw = file.id;
      var sid = Number(sidRaw);
      if (!Number.isFinite(sid) || sid <= 0) {
        return Promise.resolve({ ok: false, tool: tool, reason: '归档失败：执行集 ID 无效' });
      }
      var counts = assistantBuildTempExecArchiveCounts(file, tempApi);
      var confirmMeta = assistantBuildExecArchiveConfirmMeta(args, file, counts);
      var fileName = file && (file.name || file.file_name_clean || file.fileName)
        ? String(file.name || file.file_name_clean || file.fileName)
        : '';
      if (args.confirmed !== true) {
        return Promise.resolve(assistantBuildMcpConfirmRequired(tool, {
          actionLabel: confirmMeta.actionLabel,
          message: confirmMeta.message,
          execSetId: sid,
          fileId: file && file.id !== undefined && file.id !== null ? String(file.id) : '',
          fileName: fileName,
          reason: confirmMeta.needReason ? confirmMeta.reason : '',
        }));
      }
      var requestPayload = {};
      if (confirmMeta.needReason && confirmMeta.reason) requestPayload.reason = confirmMeta.reason;
      return client.archiveExecSet(sid, requestPayload)
        .then(function() {
          var loadPromise = null;
          try {
            if (tempApi && typeof tempApi.loadTempExecState === 'function') loadPromise = tempApi.loadTempExecState();
          } catch (_) {
            loadPromise = null;
          }
          return Promise.resolve(loadPromise)
            .catch(function() { return null; })
            .then(function() {
              return {
                ok: true,
                tool: tool,
                data: {
                  archived: true,
                  execSetId: sid,
                  fileId: file && file.id !== undefined && file.id !== null ? String(file.id) : '',
                  fileName: fileName,
                  reason: requestPayload.reason || '',
                  counts: counts,
                },
              };
            });
        })
        .catch(function(err) {
          return { ok: false, tool: tool, reason: err && err.message ? String(err.message) : '归档失败' };
        });
    }

    function assistantFindTempExecFileIdByName(keyword) {
      var list = Array.isArray(state.tempExecFiles) ? state.tempExecFiles : [];
      var key = keyword === undefined || keyword === null ? '' : String(keyword).trim().toLowerCase();
      if (!key) return '';
      for (var i = 0; i < list.length; i += 1) {
        var item = list[i] && typeof list[i] === 'object' ? list[i] : null;
        if (!item) continue;
        var name = item.name || item.file_name_clean || item.fileName || '';
        if (name && String(name).toLowerCase().indexOf(key) !== -1) return String(item.id || '');
      }
      return '';
    }

    function assistantBuildTempExecSearchText(item) {
      var row = item && typeof item === 'object' ? item : {};
      return [
        row.module || '',
        row.title || '',
        row.priority || '',
        row.precondition || row.preconditions || '',
        row.steps || '',
        row.expected || '',
        row.remark || '',
        row.actual || '',
        row.status || '',
        row.result || '',
        row.executionResult || '',
      ].join(' ').toLowerCase();
    }

    function assistantRunTempExecSearch(payload) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var tempApi = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
      if (!tempApi || typeof tempApi.applyTempExecSearch !== 'function') {
        return { ok: false, reason: '当前页面不支持执行页搜索' };
      }
      if (state.activeTab !== 'tempexec') {
        try { switchTab('tempexec'); } catch (err) { /* ignore */ }
      }
      var activeId = '';
      if (args.fileId !== undefined && args.fileId !== null) activeId = String(args.fileId).trim();
      if (!activeId && args.id !== undefined && args.id !== null) activeId = String(args.id).trim();
      if (!activeId && args.caseId !== undefined && args.caseId !== null) activeId = String(args.caseId).trim();
      var fileNameAlias = '';
      if (args.fileName !== undefined && args.fileName !== null) fileNameAlias = String(args.fileName).trim();
      if (!fileNameAlias && args.name !== undefined && args.name !== null) fileNameAlias = String(args.name).trim();
      if (!fileNameAlias && args.title !== undefined && args.title !== null) fileNameAlias = String(args.title).trim();
      if (!fileNameAlias && args.file !== undefined && args.file !== null) fileNameAlias = String(args.file).trim();
      if (!activeId && fileNameAlias) activeId = assistantFindTempExecFileIdByName(fileNameAlias);
      if (!activeId) activeId = assistantResolveTempExecActiveFileId(tempApi);
      if (!activeId) return { ok: false, reason: '当前没有可搜索的执行用例' };
      if (typeof tempApi.setTempExecActive === 'function') {
        tempApi.setTempExecActive(activeId);
      }
      var termRaw = '';
      if (args.term !== undefined && args.term !== null) termRaw = String(args.term);
      if (!termRaw && args.keyword !== undefined && args.keyword !== null) termRaw = String(args.keyword);
      if (!termRaw && args.query !== undefined && args.query !== null) termRaw = String(args.query);
      if (!termRaw && args.text !== undefined && args.text !== null) termRaw = String(args.text);
      if (!termRaw && args.value !== undefined && args.value !== null) termRaw = String(args.value);
      var normalized = termRaw.trim().toLowerCase();
      tempApi.applyTempExecSearch(activeId, normalized, termRaw);
      var file = assistantGetTempExecFileById(activeId);
      var cases = file && Array.isArray(file.cases) ? file.cases : [];
      var matched = cases.length;
      if (normalized) {
        matched = 0;
        for (var i = 0; i < cases.length; i += 1) {
          if (assistantBuildTempExecSearchText(cases[i]).indexOf(normalized) !== -1) matched += 1;
        }
      }
      return {
        ok: true,
        data: {
          fileId: activeId,
          fileName: file && (file.name || file.file_name_clean || file.fileName) ? String(file.name || file.file_name_clean || file.fileName) : '',
          term: termRaw,
          matched: matched,
          total: cases.length,
        },
      };
    }

    function assistantSwitchTempExecFile(payload, useNext) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var tempApi = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
      if (!tempApi || typeof tempApi.setTempExecActive !== 'function') {
        return { ok: false, reason: '当前页面不支持切换执行用例' };
      }
      if (state.activeTab !== 'tempexec') {
        try { switchTab('tempexec'); } catch (err) { /* ignore */ }
      }
      var list = Array.isArray(state.tempExecFiles) ? state.tempExecFiles : [];
      if (!list.length) return { ok: false, reason: '当前没有执行用例文件' };
      var targetId = '';
      if (useNext === true) {
        var ordered = typeof tempApi.getTempExecOrderedFileIds === 'function'
          ? tempApi.getTempExecOrderedFileIds()
          : list.map(function(item) { return item && item.id !== undefined && item.id !== null ? String(item.id) : ''; }).filter(Boolean);
        if (!ordered.length) return { ok: false, reason: '未找到可切换的执行用例' };
        var current = state.tempExecActiveId || state.tempExecActiveFileId || '';
        var idx = ordered.indexOf(String(current || ''));
        if (idx < 0) idx = 0;
        targetId = ordered[(idx + 1) % ordered.length];
      } else {
        if (args.fileId !== undefined && args.fileId !== null) targetId = String(args.fileId).trim();
        if (!targetId && args.id !== undefined && args.id !== null) targetId = String(args.id).trim();
        if (!targetId && args.caseId !== undefined && args.caseId !== null) targetId = String(args.caseId).trim();
        var fileNameAlias = '';
        if (!targetId && args.fileName !== undefined && args.fileName !== null) fileNameAlias = String(args.fileName).trim();
        if (!targetId && !fileNameAlias && args.name !== undefined && args.name !== null) fileNameAlias = String(args.name).trim();
        if (!targetId && !fileNameAlias && args.title !== undefined && args.title !== null) fileNameAlias = String(args.title).trim();
        if (!targetId && !fileNameAlias && args.file !== undefined && args.file !== null) fileNameAlias = String(args.file).trim();
        if (!targetId && fileNameAlias) targetId = assistantFindTempExecFileIdByName(fileNameAlias);
        var indexAlias = args.index;
        if ((indexAlias === undefined || indexAlias === null) && args.fileIndex !== undefined && args.fileIndex !== null) indexAlias = args.fileIndex;
        if ((indexAlias === undefined || indexAlias === null) && args.seq !== undefined && args.seq !== null) indexAlias = args.seq;
        if ((indexAlias === undefined || indexAlias === null) && args.position !== undefined && args.position !== null) indexAlias = args.position;
        if (!targetId && indexAlias !== undefined && indexAlias !== null) {
          var num = Math.floor(Number(indexAlias));
          if (Number.isFinite(num) && num > 0 && num <= list.length) {
            targetId = String(list[num - 1].id || '');
          }
        }
        if (!targetId) targetId = assistantResolveTempExecActiveFileId(tempApi);
      }
      if (!targetId) return { ok: false, reason: '未找到目标执行用例' };
      tempApi.setTempExecActive(targetId);
      var file = assistantGetTempExecFileById(targetId);
      return {
        ok: true,
        data: {
          fileId: targetId,
          fileName: file && (file.name || file.file_name_clean || file.fileName) ? String(file.name || file.file_name_clean || file.fileName) : '',
        },
      };
    }

    function assistantShowTempExecXmind() {
      if (state.activeTab !== 'tempexec') {
        try { switchTab('tempexec'); } catch (err) { /* ignore */ }
      }
      var btn = document.getElementById('tempExecXmindViewBtn');
      if (!btn) return { ok: false, reason: '未找到 XMind 结构展示按钮' };
      if (btn.disabled) return { ok: false, reason: '当前无法打开 XMind 结构展示' };
      try {
        btn.click();
      } catch (err2) {
        return { ok: false, reason: err2 && err2.message ? String(err2.message) : '打开失败' };
      }
      return { ok: true, data: { opened: true } };
    }

    function assistantExportTempExecXmind(payload) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var tempApi = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
      if (!tempApi) return Promise.resolve({ ok: false, reason: '当前页面不支持 XMind 导出' });
      if (state.activeTab !== 'tempexec') {
        try { switchTab('tempexec'); } catch (err) { /* ignore */ }
      }
      var withoutResult = args.withoutResult === true || args.withResult === false;
      var fn = withoutResult ? tempApi.exportTempExecCasesToXmind : tempApi.exportTempExecToXmind;
      if (typeof fn !== 'function') return Promise.resolve({ ok: false, reason: '缺少导出能力' });
      return Promise.resolve()
        .then(function() { return fn(); })
        .then(function() {
          return { ok: true, data: { withoutResult: withoutResult === true } };
        })
        .catch(function(err2) {
          return { ok: false, reason: err2 && err2.message ? String(err2.message) : '导出失败' };
        });
    }

    function assistantNormalizeScaffoldName(name) {
      var raw = name === undefined || name === null ? '' : String(name).trim().toLowerCase();
      if (!raw) return '';
      raw = raw.replace(/\s+/g, '_').replace(/-/g, '_');
      if (raw === 'case_table' || raw === 'cases_table' || raw === 'case_list_table') return 'case_table';
      if (raw === 'markdown_table' || raw === 'table' || raw === 'standard_table') return 'markdown_table';
      if (raw === 'numbered_list' || raw === 'ordered_list' || raw === 'orderedlist') return 'numbered_list';
      if (raw === 'bullet_list' || raw === 'unordered_list' || raw === 'bulleted_list') return 'bullet_list';
      if (raw === 'key_value_table' || raw === 'kv_table' || raw === 'field_value_table' || raw === 'field_content_table') return 'key_value_table';
      return raw;
    }

    function assistantEscapeMarkdownTableCell(value) {
      var text = value === undefined || value === null ? '' : String(value);
      return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
    }
    function assistantScaffoldValueText(value) {
      if (value === undefined || value === null) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      try {
        return JSON.stringify(value);
      } catch (err) {
        return String(value);
      }
    }

    function assistantBuildMarkdownTable(headers, rows) {
      var head = Array.isArray(headers) ? headers : [];
      var body = Array.isArray(rows) ? rows : [];
      if (!head.length) return '';
      var lines = [];
      lines.push('| ' + head.map(assistantEscapeMarkdownTableCell).join(' | ') + ' |');
      lines.push('| ' + head.map(function() { return '---'; }).join(' | ') + ' |');
      body.forEach(function(row) {
        var cells = Array.isArray(row) ? row.slice() : [];
        while (cells.length < head.length) cells.push('');
        if (cells.length > head.length) {
          var overflow = cells.slice(head.length - 1).map(assistantScaffoldValueText).join(' | ');
          cells = cells.slice(0, head.length - 1);
          cells.push(overflow);
        }
        lines.push('| ' + cells.map(function(cell) {
          return assistantEscapeMarkdownTableCell(assistantScaffoldValueText(cell));
        }).join(' | ') + ' |');
      });
      return lines.join('\n');
    }

    function assistantResolveScaffoldItems(payload) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var data = args.data && typeof args.data === 'object' ? args.data : {};
      if (Array.isArray(args.items)) return args.items.slice();
      if (Array.isArray(data.items)) return data.items.slice();
      return [];
    }

    function assistantNormalizeCaseScaffoldItem(item, index) {
      var row = item && typeof item === 'object' ? item : {};
      var executionResultRaw = row.executionResult !== undefined && row.executionResult !== null
        ? row.executionResult
        : (row.actual !== undefined && row.actual !== null
          ? row.actual
          : (row.status !== undefined && row.status !== null
            ? row.status
            : row.result));
      var sourceIndex = row.sourceIndex !== undefined && row.sourceIndex !== null
        ? row.sourceIndex
        : (row.index !== undefined && row.index !== null ? row.index : (index + 1));
      return {
        index: sourceIndex,
        id: row.id === undefined || row.id === null ? '' : String(row.id),
        module: row.module === undefined || row.module === null ? '' : String(row.module),
        title: row.title === undefined || row.title === null ? '' : String(row.title),
        priority: row.priority === undefined || row.priority === null ? '' : String(row.priority),
        precondition: row.precondition !== undefined && row.precondition !== null
          ? String(row.precondition)
          : (row.preconditions !== undefined && row.preconditions !== null ? String(row.preconditions) : ''),
        steps: row.steps === undefined || row.steps === null ? '' : String(row.steps),
        expected: row.expected === undefined || row.expected === null ? '' : String(row.expected),
        remark: row.remark === undefined || row.remark === null ? '' : String(row.remark),
        executionResult: executionResultRaw === undefined || executionResultRaw === null ? '' : String(executionResultRaw),
      };
    }

    function assistantBuildCaseTableScaffold(payload) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var data = args.data && typeof args.data === 'object' ? args.data : {};
      var items = assistantResolveScaffoldItems(args).map(function(item, index) {
        return assistantNormalizeCaseScaffoldItem(item, index);
      });
      var includeExecutionResult = false;
      var headers = ['序号', 'ID', '模块', '标题', '优先级', '前置条件', '步骤', '预期结果', '备注'];
      var rows = [];
      var lines = [];
      var title = args.title !== undefined && args.title !== null ? String(args.title) : '';
      if (!title && args.intro !== undefined && args.intro !== null) title = String(args.intro);
      if (!title && args.header !== undefined && args.header !== null) title = String(args.header);
      if (!items.length) return { ok: false, reason: '缺少可渲染的用例数据' };
      includeExecutionResult = args.includeExecutionResult === true
        || args.withExecutionResult === true
        || items.some(function(item) { return String(item.executionResult || '').trim(); });
      if (includeExecutionResult) headers.push('执行结果');
      rows = items.map(function(item) {
        var row = [
          item.index,
          item.id,
          item.module,
          item.title,
          item.priority,
          item.precondition,
          item.steps,
          item.expected,
          item.remark,
        ];
        if (includeExecutionResult) row.push(item.executionResult);
        return row;
      });
      if (title) lines.push(title);
      lines.push(assistantBuildMarkdownTable(headers, rows));
      if (data.truncated === true) {
        var total = Number(data.total);
        if (!Number.isFinite(total) || total < 0) total = items.length;
        lines.push('已展示前 ' + items.length + ' 条，共 ' + total + ' 条。');
      }
      return { ok: true, scaffold: 'case_table', content: lines.join('\n') };
    }

    function assistantResolveTableHeaders(payload) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var data = args.data && typeof args.data === 'object' ? args.data : {};
      if (Array.isArray(args.headers)) return args.headers.slice();
      if (Array.isArray(args.columns)) return args.columns.slice();
      if (Array.isArray(data.headers)) return data.headers.slice();
      if (Array.isArray(data.columns)) return data.columns.slice();
      return [];
    }

    function assistantResolveTableRows(payload, headers) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var data = args.data && typeof args.data === 'object' ? args.data : {};
      var rows = Array.isArray(args.rows) ? args.rows : (Array.isArray(data.rows) ? data.rows : []);
      var head = Array.isArray(headers) ? headers : [];
      return rows.map(function(row) {
        if (Array.isArray(row)) return row.slice();
        if (row && typeof row === 'object' && head.length) {
          return head.map(function(key) {
            return row[key] === undefined || row[key] === null ? '' : row[key];
          });
        }
        return [assistantScaffoldValueText(row)];
      });
    }

    function assistantBuildGenericTableScaffold(payload) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var headers = assistantResolveTableHeaders(args);
      var rows = assistantResolveTableRows(args, headers);
      var lines = [];
      var title = args.title !== undefined && args.title !== null ? String(args.title) : '';
      if (!headers.length) return { ok: false, reason: '缺少表头 headers' };
      if (title) lines.push(title);
      lines.push(assistantBuildMarkdownTable(headers, rows));
      return { ok: true, scaffold: 'markdown_table', content: lines.join('\n') };
    }

    function assistantResolveListEntries(payload) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var data = args.data && typeof args.data === 'object' ? args.data : {};
      var list = Array.isArray(args.items) ? args.items : (Array.isArray(data.items) ? data.items : []);
      return list.map(function(item) {
        if (item && typeof item === 'object') {
          if (item.text !== undefined && item.text !== null) return String(item.text);
          if (item.label !== undefined && item.label !== null) return String(item.label);
          if (item.title !== undefined && item.title !== null) return String(item.title);
          if (item.name !== undefined && item.name !== null) return String(item.name);
        }
        return assistantScaffoldValueText(item);
      }).filter(function(item) { return String(item || '').trim(); });
    }

    function assistantBuildListScaffold(payload, ordered) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var lines = [];
      var title = args.title !== undefined && args.title !== null ? String(args.title) : '';
      var list = assistantResolveListEntries(args);
      var marker = ordered === true ? function(index) { return (index + 1) + '. '; } : function() { return '- '; };
      if (!list.length) return { ok: false, reason: '缺少列表项 items' };
      if (title) lines.push(title);
      list.forEach(function(item, index) {
        lines.push(marker(index) + item);
      });
      return { ok: true, scaffold: ordered === true ? 'numbered_list' : 'bullet_list', content: lines.join('\n') };
    }

    function assistantBuildKeyValueTableScaffold(payload) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var data = args.data && typeof args.data === 'object' ? args.data : {};
      var entries = Array.isArray(args.entries) ? args.entries : (Array.isArray(data.entries) ? data.entries : []);
      var title = args.title !== undefined && args.title !== null ? String(args.title) : '';
      var lines = [];
      var rows = entries.map(function(entry) {
        var row = entry && typeof entry === 'object' ? entry : {};
        var key = row.key !== undefined && row.key !== null
          ? row.key
          : (row.label !== undefined && row.label !== null ? row.label : (row.name !== undefined && row.name !== null ? row.name : ''));
        var value = row.value !== undefined && row.value !== null
          ? row.value
          : (row.content !== undefined && row.content !== null ? row.content : (row.text !== undefined && row.text !== null ? row.text : ''));
        return [key, value];
      });
      if (!rows.length) return { ok: false, reason: '缺少键值项 entries' };
      if (title) lines.push(title);
      lines.push(assistantBuildMarkdownTable(['字段', '内容'], rows));
      return { ok: true, scaffold: 'key_value_table', content: lines.join('\n') };
    }

    function assistantListScaffolds() {
      return [
        { name: 'case_table', description: '标准用例横向表，自动保留展开查看能力' },
        { name: 'markdown_table', description: '通用 Markdown 表格' },
        { name: 'numbered_list', description: '有序列表' },
        { name: 'bullet_list', description: '无序列表' },
        { name: 'key_value_table', description: '字段-内容键值表' },
      ];
    }

    function assistantRenderScaffold(payload) {
      var args = payload && typeof payload === 'object' ? payload : {};
      var scaffold = assistantNormalizeScaffoldName(args.scaffold || args.name || args.type || '');
      if (!scaffold) return { ok: false, reason: '缺少 scaffold 参数' };
      if (scaffold === 'case_table') return assistantBuildCaseTableScaffold(args);
      if (scaffold === 'markdown_table') return assistantBuildGenericTableScaffold(args);
      if (scaffold === 'numbered_list') return assistantBuildListScaffold(args, true);
      if (scaffold === 'bullet_list') return assistantBuildListScaffold(args, false);
      if (scaffold === 'key_value_table') return assistantBuildKeyValueTableScaffold(args);
      return { ok: false, reason: '未知展示手脚架：' + scaffold };
    }

    function assistantNormalizeMcpToolName(name) {
      var raw = name === undefined || name === null ? '' : String(name).trim().toLowerCase();
      if (!raw) return '';
      raw = raw.replace(/\s+/g, '_').replace(/-/g, '_');
      if (raw === 'page.current_info' || raw === 'current_page_info' || raw === 'page.info') return 'page.current_info';
      if (raw === 'page.get_data' || raw === 'query_page_data' || raw === 'page_data') return 'page.get_data';
      if (raw === 'nav.switch_tab' || raw === 'navigate' || raw === 'switch_tab') return 'nav.switch_tab';
      if (raw === 'cases.list_current' || raw === 'query_case_list' || raw === 'case_list' || raw === 'case_library.query_exec_cases' || raw === 'case_library_query_exec_cases' || raw === 'query_exec_cases' || raw === 'list_exec_cases' || raw === 'case_library.list_exec_cases' || raw === 'case_library_list_exec_cases') return 'cases.list_current';
      if (raw === 'case_library.query_cases' || raw === 'case_library_query_cases' || raw === 'query_case_library_cases' || raw === 'search_case_library_cases' || raw === 'case_library_search_case_content' || raw === 'search_case_content') return 'case_library.query_cases';
      if (raw === 'missing_library.list_current' || raw === 'missing_library_list_current' || raw === 'list_missing_library' || raw === 'missing_case_library_list') return 'missing_library.list_current';
      if (raw === 'cross_page.match_missing_cases' || raw === 'cross_page_match_missing_cases' || raw === 'match_missing_cases' || raw === 'match_case_missing_library') return 'cross_page.match_missing_cases';
      if (raw === 'case_library.search_exec_candidates' || raw === 'case_library_search_exec_candidates' || raw === 'search_case_files_for_exec' || raw === 'search_exec_candidates' || raw === 'case_library.search_exec_cases' || raw === 'case_library_search_exec_cases' || raw === 'search_exec_cases') return 'case_library.search_exec_candidates';
      if (raw === 'case_library.transfer_to_exec' || raw === 'case_library_transfer_to_exec' || raw === 'transfer_to_exec' || raw === 'transfer_case_to_exec' || raw === 'exec_case_file') return 'case_library.transfer_to_exec';
      if (raw === 'case_library.batch_update_exec_results' || raw === 'case_library_batch_update_exec_results' || raw === 'batch_update_exec_results' || raw === 'update_exec_results' || raw === 'case_library.batch_set_exec_results' || raw === 'case_library_batch_set_exec_results' || raw === 'batch_set_exec_results' || raw === 'set_exec_results' || raw === 'set_exec_result') return 'case_library.batch_update_exec_results';
      if (raw === 'case_library.batch_archive_exec_cases' || raw === 'case_library_batch_archive_exec_cases' || raw === 'batch_archive_exec_cases' || raw === 'archive_exec_cases' || raw === 'case_library.batch_archive_cases' || raw === 'case_library_batch_archive_cases' || raw === 'batch_archive_cases' || raw === 'archive_cases') return 'case_library.batch_archive_exec_cases';
      if (raw === 'ui.list_controls' || raw === 'list_controls' || raw === 'list_ui_controls') return 'ui.list_controls';
      if (raw === 'ui.click_control' || raw === 'click_control' || raw === 'click_ui_control') return 'ui.click_control';
      if (raw === 'ui.fill_input' || raw === 'fill_input' || raw === 'fill_ui_input') return 'ui.fill_input';
      if (raw === 'tempexec.search_cases' || raw === 'search_tempexec_cases') return 'tempexec.search_cases';
      if (raw === 'tempexec.show_xmind' || raw === 'show_tempexec_xmind' || raw === 'tempexec_xmind_view') return 'tempexec.show_xmind';
      if (raw === 'tempexec.export_xmind' || raw === 'export_tempexec_xmind') return 'tempexec.export_xmind';
      if (raw === 'tempexec.next_file' || raw === 'next_tempexec_file') return 'tempexec.next_file';
      if (raw === 'tempexec.switch_file' || raw === 'switch_tempexec_file') return 'tempexec.switch_file';
      if (raw === 'web.search' || raw === 'web_search' || raw === 'search_web') return 'web.search';
      if (raw === 'memo.list' || raw === 'memo_list') return 'memo.list';
      if (raw === 'memo.add' || raw === 'memo_add') return 'memo.add';
      if (raw === 'memo.toggle' || raw === 'memo_toggle') return 'memo.toggle';
      if (raw === 'memo.remove' || raw === 'memo_remove') return 'memo.remove';
      if (raw === 'settings.describe' || raw === 'settings_describe') return 'settings.describe';
      if (raw === 'settings.patch' || raw === 'settings_patch') return 'settings.patch';
      if (raw === 'assistant.list_scaffolds' || raw === 'assistant_list_scaffolds' || raw === 'list_scaffolds') return 'assistant.list_scaffolds';
      if (raw === 'assistant.render_scaffold' || raw === 'assistant_render_scaffold' || raw === 'render_scaffold') return 'assistant.render_scaffold';
      if (raw === 'case.update' || raw === 'case_update' || raw === 'update_case' || raw === 'edit_case' || raw === 'case_edit' || raw === 'case.patch' || raw === 'case_patch') return 'case.update';
      if (raw === 'case.delete' || raw === 'delete_case') return 'case.delete';
      if (raw === 'casegen.run' || raw === 'run_case_generation') return 'casegen.run';
      if (raw === 'missing_recommend.run' || raw === 'run_missing_recommendation') return 'missing_recommend.run';
      return raw;
    }

    function assistantMcpListTools() {
      return [
        { name: 'page.current_info', mode: 'read', description: '获取当前页面名称/标识信息' },
        { name: 'page.get_data', mode: 'read', description: '读取指定页面的数据快照' },
        { name: 'nav.switch_tab', mode: 'write', description: '切换到目标页签' },
        { name: 'cases.list_current', mode: 'read', description: '读取当前页面或项目用例列表' },
        { name: 'case_library.query_cases', mode: 'read', description: '跨页面查询用例库内容，并在大数据量时自动拆分子任务并发检索' },
        { name: 'case_library.search_exec_candidates', mode: 'read', description: '按项目/名称搜索可转到当前执行的用例文件候选' },
        { name: 'case_library.transfer_to_exec', mode: 'write', description: '将指定用例文件转到当前执行；若未指定执行版本，会返回待选择版本或待确认新建版本结果' },
        { name: 'case_library.batch_update_exec_results', mode: 'write', description: '批量修改当前执行用例的执行结果' },
        { name: 'case_library.batch_archive_exec_cases', mode: 'write', description: '归档当前执行中的用例' },
        { name: 'missing_library.list_current', mode: 'read', description: '读取当前项目的漏测/易漏用例库，可跨页面查询' },
        { name: 'cross_page.match_missing_cases', mode: 'read', description: '将当前页面用例与当前项目漏测用例库做跨页面匹配' },
        { name: 'ui.list_controls', mode: 'read', description: '列出当前页可操作控件（按钮/输入框/选择器等）' },
        { name: 'ui.click_control', mode: 'write', description: '点击指定控件（写操作会触发确认）' },
        { name: 'ui.fill_input', mode: 'write', description: '填写输入控件并触发输入事件' },
        { name: 'tempexec.search_cases', mode: 'read', description: '在用例执行页按关键词搜索当前用例' },
        { name: 'tempexec.show_xmind', mode: 'read', description: '打开用例执行页 XMind 结构展示' },
        { name: 'tempexec.export_xmind', mode: 'write', description: '导出用例执行页 XMind' },
        { name: 'tempexec.next_file', mode: 'read', description: '切换到下一份执行用例' },
        { name: 'tempexec.switch_file', mode: 'read', description: '按编号/名称切换执行用例' },
        { name: 'web.search', mode: 'read', description: '执行联网搜索' },
        { name: 'memo.list', mode: 'read', description: '查看备忘列表' },
        { name: 'memo.add', mode: 'write', description: '新增备忘' },
        { name: 'memo.toggle', mode: 'write', description: '更新备忘完成状态' },
        { name: 'memo.remove', mode: 'write', description: '删除备忘' },
        { name: 'settings.describe', mode: 'read', description: '读取设置项说明' },
        { name: 'settings.patch', mode: 'write', description: '修改助手设置' },
        { name: 'assistant.list_scaffolds', mode: 'read', description: '查看可调用的标准展示手脚架' },
        { name: 'assistant.render_scaffold', mode: 'read', description: '渲染标准展示手脚架（如 case_table、markdown_table、numbered_list、bullet_list、key_value_table）' },
        { name: 'case.update', mode: 'write', description: '修改当前可见用例字段（优先级/标题/步骤等）' },
        { name: 'case.delete', mode: 'write', description: '删除当前可见用例条目' },
        { name: 'casegen.run', mode: 'write', description: '触发用例生成流程' },
        { name: 'missing_recommend.run', mode: 'write', description: '触发漏测推荐流程' },
      ];
    }

    function assistantMcpCallTool(name, args) {
      var tool = assistantNormalizeMcpToolName(name);
      var payload = args && typeof args === 'object' ? Object.assign({}, args) : {};
      if (!tool) return Promise.resolve({ ok: false, reason: 'tool 不能为空', tool: '' });

      if (tool === 'page.current_info') {
        return Promise.resolve({ ok: true, tool: tool, data: assistantGetPageData('') });
      }
      if (tool === 'page.get_data') {
        var tab = '';
        if (payload.tab !== undefined && payload.tab !== null) tab = String(payload.tab);
        if (!tab && payload.page !== undefined && payload.page !== null) tab = String(payload.page);
        return Promise.resolve({ ok: true, tool: tool, data: assistantGetPageData(tab) });
      }
      if (tool === 'nav.switch_tab') {
        var targetTab = '';
        if (payload.tab !== undefined && payload.tab !== null) targetTab = String(payload.tab).trim();
        if (!targetTab && payload.targetTab !== undefined && payload.targetTab !== null) targetTab = String(payload.targetTab).trim();
        if (!targetTab && payload.page !== undefined && payload.page !== null) targetTab = String(payload.page).trim();
        if (!targetTab && payload.name !== undefined && payload.name !== null) targetTab = String(payload.name).trim();
        if (!targetTab) return Promise.resolve({ ok: false, tool: tool, reason: '缺少 tab 参数' });
        switchTab(targetTab);
        return Promise.resolve({ ok: true, tool: tool, data: { tab: targetTab } });
      }
      if (tool === 'cases.list_current') {
        return assistantListCurrentCases(payload).then(function(res) {
          if (!res || res.ok !== true) {
            return { ok: false, tool: tool, data: res || null, reason: res && res.reason ? String(res.reason) : '读取用例失败' };
          }
          return { ok: true, tool: tool, data: res };
        });
      }
      if (tool === 'case_library.query_cases') {
        return assistantQueryCaseLibraryCases(payload).then(function(res) {
          if (!res || res.ok !== true) {
            return { ok: false, tool: tool, data: res || null, reason: res && res.reason ? String(res.reason) : '查询用例库内容失败' };
          }
          return { ok: true, tool: tool, data: res };
        });
      }
      if (tool === 'case_library.search_exec_candidates') {
        return assistantSearchExecCandidates(payload).then(function(res) {
          if (!res || res.ok !== true) {
            return { ok: false, tool: tool, data: res || null, reason: res && res.reason ? String(res.reason) : '搜索转执行候选失败' };
          }
          return { ok: true, tool: tool, data: res };
        });
      }
      if (tool === 'case_library.transfer_to_exec') {
        var caseFileId = payload && payload.caseFileId !== undefined && payload.caseFileId !== null
          ? String(payload.caseFileId).trim()
          : (payload && payload.id !== undefined && payload.id !== null ? String(payload.id).trim() : '');
        if (!caseFileId) {
          return Promise.resolve({ ok: false, tool: tool, data: payload || null, reason: '缺少 caseFileId' });
        }
        if (payload.confirmed !== true) {
          return Promise.resolve(assistantBuildMcpConfirmRequired(tool, {
            actionLabel: '转到当前执行',
            message: '该操作会把目标用例加入当前执行，并可能同步覆盖已有执行结果。',
          }));
        }
        return assistantTransferCaseFileToExec(payload).then(function(res) {
          if (!res || res.ok !== true) {
            return { ok: false, tool: tool, data: res || null, reason: res && res.reason ? String(res.reason) : '转到执行失败' };
          }
          return { ok: true, tool: tool, data: res };
        });
      }
      if (tool === 'case_library.batch_update_exec_results') {
        var batchUpdatePayload = Object.assign({
          context: 'tempexec',
          scope: 'all',
          field: 'actual',
        }, payload || {});
        if (batchUpdatePayload.value === undefined || batchUpdatePayload.value === null || String(batchUpdatePayload.value).trim() === '') {
          if (batchUpdatePayload.result !== undefined && batchUpdatePayload.result !== null && String(batchUpdatePayload.result).trim()) {
            batchUpdatePayload.value = String(batchUpdatePayload.result).trim();
          } else if (batchUpdatePayload.status !== undefined && batchUpdatePayload.status !== null && String(batchUpdatePayload.status).trim()) {
            batchUpdatePayload.value = String(batchUpdatePayload.status).trim();
          } else if (batchUpdatePayload.to !== undefined && batchUpdatePayload.to !== null && String(batchUpdatePayload.to).trim()) {
            batchUpdatePayload.value = String(batchUpdatePayload.to).trim();
          }
        }
        if (batchUpdatePayload.confirmed !== true) {
          var batchUpdateConfirmMeta = assistantBuildCaseUpdateConfirmMeta(batchUpdatePayload, 'tempexec');
          return Promise.resolve(assistantBuildMcpConfirmRequired(tool, {
            actionLabel: batchUpdateConfirmMeta.actionLabel,
            message: batchUpdateConfirmMeta.message,
          }));
        }
        var batchUpdateRes = assistantUpdateCase(batchUpdatePayload);
        return Promise.resolve(batchUpdateRes && batchUpdateRes.ok
          ? { ok: true, tool: tool, data: batchUpdateRes }
          : { ok: false, tool: tool, data: batchUpdateRes || null, reason: batchUpdateRes && batchUpdateRes.reason ? String(batchUpdateRes.reason) : '批量修改执行结果失败' });
      }
      if (tool === 'case_library.batch_archive_exec_cases') {
        return assistantArchiveCurrentExecCases(payload || {}, tool);
      }

      if (tool === 'missing_library.list_current') {
        return assistantReadMissingLibrarySnapshot(payload).then(function(res) {
          if (!res || res.ok !== true) {
            return { ok: false, tool: tool, data: res || null, reason: res && res.reason ? String(res.reason) : '读取漏测用例库失败' };
          }
          return { ok: true, tool: tool, data: res };
        });
      }
      if (tool === 'cross_page.match_missing_cases') {
        return assistantMatchCurrentCasesWithMissingLibrary(payload).then(function(res) {
          if (!res || res.ok !== true) {
            return { ok: false, tool: tool, data: res || null, reason: res && res.reason ? String(res.reason) : '跨页面匹配失败' };
          }
          return { ok: true, tool: tool, data: res };
        });
      }
      if (tool === 'ui.list_controls') {
        return Promise.resolve({ ok: true, tool: tool, data: { controls: assistantListUiControls(payload) } });
      }
      if (tool === 'ui.click_control') {
        return Promise.resolve(assistantClickUiControl(payload, tool));
      }
      if (tool === 'ui.fill_input') {
        return Promise.resolve(assistantFillUiInput(payload, tool));
      }
      if (tool === 'tempexec.search_cases') {
        var searchRes = assistantRunTempExecSearch(payload);
        return Promise.resolve(searchRes && searchRes.ok
          ? { ok: true, tool: tool, data: searchRes.data || {} }
          : { ok: false, tool: tool, reason: searchRes && searchRes.reason ? String(searchRes.reason) : '搜索失败', data: searchRes || null });
      }
      if (tool === 'tempexec.show_xmind') {
        var viewRes = assistantShowTempExecXmind();
        return Promise.resolve(viewRes && viewRes.ok
          ? { ok: true, tool: tool, data: viewRes.data || {} }
          : { ok: false, tool: tool, reason: viewRes && viewRes.reason ? String(viewRes.reason) : '打开失败', data: viewRes || null });
      }
      if (tool === 'tempexec.export_xmind') {
        return assistantExportTempExecXmind(payload).then(function(res) {
          return res && res.ok
            ? { ok: true, tool: tool, data: res.data || {} }
            : { ok: false, tool: tool, reason: res && res.reason ? String(res.reason) : '导出失败', data: res || null };
        });
      }
      if (tool === 'tempexec.next_file') {
        var nextRes = assistantSwitchTempExecFile(payload, true);
        return Promise.resolve(nextRes && nextRes.ok
          ? { ok: true, tool: tool, data: nextRes.data || {} }
          : { ok: false, tool: tool, reason: nextRes && nextRes.reason ? String(nextRes.reason) : '切换失败', data: nextRes || null });
      }
      if (tool === 'tempexec.switch_file') {
        var switchRes = assistantSwitchTempExecFile(payload, false);
        return Promise.resolve(switchRes && switchRes.ok
          ? { ok: true, tool: tool, data: switchRes.data || {} }
          : { ok: false, tool: tool, reason: switchRes && switchRes.reason ? String(switchRes.reason) : '切换失败', data: switchRes || null });
      }
      if (tool === 'web.search') {
        var query = '';
        if (payload.query !== undefined && payload.query !== null) query = String(payload.query).trim();
        if (!query && payload.q !== undefined && payload.q !== null) query = String(payload.q).trim();
        if (!query && payload.keyword !== undefined && payload.keyword !== null) query = String(payload.keyword).trim();
        if (!query && payload.text !== undefined && payload.text !== null) query = String(payload.text).trim();
        if (!query) return Promise.resolve({ ok: false, tool: tool, reason: '缺少 query 参数' });
        return assistantSearchWeb(query, payload).then(function(res) {
          if (!res || res.ok !== true) {
            return { ok: false, tool: tool, data: res || null, reason: res && res.reason ? String(res.reason) : '联网搜索失败' };
          }
          return { ok: true, tool: tool, data: res };
        });
      }
      if (tool === 'memo.list') {
        return Promise.resolve({ ok: true, tool: tool, data: assistantMemoList() });
      }
      if (tool === 'memo.add') {
        if (payload.confirmed !== true) {
          return Promise.resolve(assistantBuildMcpConfirmRequired(tool, {
            actionLabel: '新增备忘',
            message: '该操作会写入备忘内容，请确认继续。',
          }));
        }
        var addText = '';
        if (payload.text !== undefined && payload.text !== null) addText = String(payload.text).trim();
        if (!addText && payload.content !== undefined && payload.content !== null) addText = String(payload.content).trim();
        if (!addText && payload.value !== undefined && payload.value !== null) addText = String(payload.value).trim();
        var addRes = assistantMemoAdd(addText, payload.tab || '');
        return Promise.resolve(addRes && addRes.ok
          ? { ok: true, tool: tool, data: addRes }
          : { ok: false, tool: tool, data: addRes || null, reason: addRes && addRes.reason ? String(addRes.reason) : '新增失败' });
      }
      if (tool === 'memo.toggle') {
        if (payload.confirmed !== true) {
          return Promise.resolve(assistantBuildMcpConfirmRequired(tool, {
            actionLabel: '更新备忘状态',
            message: '该操作会修改备忘状态，请确认继续。',
          }));
        }
        var toggleIndexRaw = payload.index;
        if ((toggleIndexRaw === undefined || toggleIndexRaw === null) && payload.itemIndex !== undefined && payload.itemIndex !== null) toggleIndexRaw = payload.itemIndex;
        if ((toggleIndexRaw === undefined || toggleIndexRaw === null) && payload.seq !== undefined && payload.seq !== null) toggleIndexRaw = payload.seq;
        var toggleIndex = Number(toggleIndexRaw);
        var done = payload.done === undefined
          ? (payload.completed === undefined ? (payload.checked === undefined ? true : payload.checked === true) : payload.completed === true)
          : payload.done === true;
        var toggleRes = assistantMemoToggle(payload.tab || '', toggleIndex, done);
        return Promise.resolve(toggleRes && toggleRes.ok
          ? { ok: true, tool: tool, data: toggleRes }
          : { ok: false, tool: tool, data: toggleRes || null, reason: toggleRes && toggleRes.reason ? String(toggleRes.reason) : '更新失败' });
      }
      if (tool === 'memo.remove') {
        if (payload.confirmed !== true) {
          return Promise.resolve(assistantBuildMcpConfirmRequired(tool, {
            actionLabel: '删除备忘',
            message: '该操作会删除备忘内容，请确认继续。',
          }));
        }
        var removeIndexRaw = payload.index;
        if ((removeIndexRaw === undefined || removeIndexRaw === null) && payload.itemIndex !== undefined && payload.itemIndex !== null) removeIndexRaw = payload.itemIndex;
        if ((removeIndexRaw === undefined || removeIndexRaw === null) && payload.seq !== undefined && payload.seq !== null) removeIndexRaw = payload.seq;
        var removeIndex = Number(removeIndexRaw);
        var removeRes = assistantMemoRemove(payload.tab || '', removeIndex);
        return Promise.resolve(removeRes && removeRes.ok
          ? { ok: true, tool: tool, data: removeRes }
          : { ok: false, tool: tool, data: removeRes || null, reason: removeRes && removeRes.reason ? String(removeRes.reason) : '删除失败' });
      }
      if (tool === 'settings.describe') {
        var key = '';
        if (payload.key !== undefined && payload.key !== null) key = String(payload.key).trim();
        if (!key && payload.setting !== undefined && payload.setting !== null) key = String(payload.setting).trim();
        if (!key && payload.name !== undefined && payload.name !== null) key = String(payload.name).trim();
        if (!key) return Promise.resolve({ ok: false, tool: tool, reason: '缺少 key 参数' });
        return Promise.resolve({ ok: true, tool: tool, data: { key: key, description: assistantDescribeSetting(key) } });
      }
      if (tool === 'settings.patch') {
        if (payload.confirmed !== true) {
          return Promise.resolve(assistantBuildMcpConfirmRequired(tool, {
            actionLabel: '修改助手设置',
            message: '该操作会写入设置，请确认继续。',
          }));
        }
        var patch = payload.patch && typeof payload.patch === 'object'
          ? payload.patch
          : (payload.settings && typeof payload.settings === 'object' ? payload.settings : payload);
        var patchRes = assistantApplyGeneralSettingsPatch(patch || {}, { source: 'assistant-mcp' });
        return Promise.resolve(patchRes && patchRes.ok
          ? { ok: true, tool: tool, data: patchRes }
          : { ok: false, tool: tool, data: patchRes || null, reason: patchRes && patchRes.reason ? String(patchRes.reason) : '设置失败' });
      }
      if (tool === 'assistant.list_scaffolds') {
        return Promise.resolve({ ok: true, tool: tool, data: { scaffolds: assistantListScaffolds() } });
      }
      if (tool === 'assistant.render_scaffold') {
        var scaffoldRes = assistantRenderScaffold(payload);
        return Promise.resolve(scaffoldRes && scaffoldRes.ok === true
          ? { ok: true, tool: tool, data: scaffoldRes }
          : { ok: false, tool: tool, data: scaffoldRes || null, reason: scaffoldRes && scaffoldRes.reason ? String(scaffoldRes.reason) : '渲染失败' });
      }
      if (tool === 'case.update') {
        if (payload.confirmed !== true) {
          var updateConfirmMeta = assistantBuildCaseUpdateConfirmMeta(payload || {});
          return Promise.resolve(assistantBuildMcpConfirmRequired(tool, {
            actionLabel: updateConfirmMeta.actionLabel,
            message: updateConfirmMeta.message,
          }));
        }
        var updateRes = assistantUpdateCase(payload || {});
        return Promise.resolve(updateRes && updateRes.ok
          ? { ok: true, tool: tool, data: updateRes }
          : { ok: false, tool: tool, data: updateRes || null, reason: updateRes && updateRes.reason ? String(updateRes.reason) : '修改失败' });
      }
      if (tool === 'case.delete') {
        if (payload.confirmed !== true) {
          return Promise.resolve(assistantBuildMcpConfirmRequired(tool, {
            actionLabel: '删除用例',
            message: '该操作会删除当前可见用例，请确认继续。',
          }));
        }
        var deleteIndexRaw = payload.index;
        if ((deleteIndexRaw === undefined || deleteIndexRaw === null) && payload.itemIndex !== undefined && payload.itemIndex !== null) deleteIndexRaw = payload.itemIndex;
        if ((deleteIndexRaw === undefined || deleteIndexRaw === null) && payload.seq !== undefined && payload.seq !== null) deleteIndexRaw = payload.seq;
        var delRes = assistantDeleteCase(Number(deleteIndexRaw));
        return Promise.resolve(delRes && delRes.ok
          ? { ok: true, tool: tool, data: delRes }
          : { ok: false, tool: tool, data: delRes || null, reason: delRes && delRes.reason ? String(delRes.reason) : '删除失败' });
      }
      if (tool === 'casegen.run') {
        if (payload.confirmed !== true) {
          return Promise.resolve(assistantBuildMcpConfirmRequired(tool, {
            actionLabel: '触发用例生成',
            message: '该操作会触发批量生成流程，请确认继续。',
          }));
        }
        return assistantRunCaseGeneration().then(function(res) {
          return res && res.ok
            ? { ok: true, tool: tool, data: res }
            : { ok: false, tool: tool, data: res || null, reason: res && res.reason ? String(res.reason) : '触发失败' };
        });
      }
      if (tool === 'missing_recommend.run') {
        if (payload.confirmed !== true) {
          return Promise.resolve(assistantBuildMcpConfirmRequired(tool, {
            actionLabel: '触发漏测推荐',
            message: '该操作会写入推荐结果，请确认继续。',
          }));
        }
        return assistantRunMissingRecommendation().then(function(res) {
          return res && res.ok
            ? { ok: true, tool: tool, data: res }
            : { ok: false, tool: tool, data: res || null, reason: res && res.reason ? String(res.reason) : '触发失败' };
        });
      }
      return Promise.resolve({ ok: false, tool: tool, reason: '未知 MCP 工具：' + tool });
    }

    window.app.assistantApi = {
      listTabs: assistantListTabs,
      switchTab: function(tab) { return switchTab(String(tab || '')); },
      getPageData: assistantGetPageData,
      listCurrentCases: assistantListCurrentCases,
      listCaseFiles: assistantListCurrentCases,
      queryCaseLibraryCases: assistantQueryCaseLibraryCases,
      searchWeb: assistantSearchWeb,
      webSearch: assistantSearchWeb,
      getSettings: assistantGetSettings,
      listModels: function() { return typeof listAssistantModels === 'function' ? listAssistantModels() : []; },
      getSelectedModelInfo: assistantGetSelectedModelInfo,
      callModel: assistantCallModel,
      runCaseGeneration: assistantRunCaseGeneration,
      runMissingRecommendation: assistantRunMissingRecommendation,
      memoList: assistantMemoList,
      memoAdd: assistantMemoAdd,
      memoToggle: assistantMemoToggle,
      memoRemove: assistantMemoRemove,
      updateCase: assistantUpdateCase,
      deleteCase: assistantDeleteCase,
      testModel: function(modelId, scene) { return testModel(modelId, null, scene || 'assistant-manual-test'); },
    };
    window.app.assistantMcpApi = {
      listTools: assistantMcpListTools,
      callTool: function(name, args) {
        return assistantMcpCallTool(name, args || {});
      },
    };
    window.app.assistantSettingsApi = {
      getSettings: assistantGetSettings,
      listModels: function() { return typeof listAssistantModels === 'function' ? listAssistantModels() : []; },
      applyPatch: function(patch, options) {
        var opts = options && typeof options === 'object' ? Object.assign({}, options) : {};
        if (!opts.source) opts.source = 'assistant';
        return assistantApplyGeneralSettingsPatch(patch || {}, opts);
      },
      saveFromUI: saveAssistantSettings,
      renderSettingsUI: renderAssistantSettingsUI,
      describeSetting: assistantDescribeSetting,
    };
    window.app.assistantModelDiagApi = {
      sanitizeFailureContext: assistantSanitizeFailureContext,
      diagnoseFailure: assistantDiagnoseFailure,
      applyModelPatch: function(modelId, patch, options) {
        if (typeof applyModelPatch !== 'function') {
          return Promise.resolve({ ok: false, reason: '模型补丁能力不可用' });
        }
        return applyModelPatch(modelId, patch, options || {});
      },
      retestModel: function(modelId, scene) {
        return testModel(modelId, null, scene || 'assistant-retest');
      },
    };
    assistantDispatchEvent('app-assistant-api-ready', {
      hasAssistantApi: true,
      hasAssistantMcpApi: true,
      hasAssistantSettingsApi: true,
      hasAssistantModelDiagApi: true,
    });

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
