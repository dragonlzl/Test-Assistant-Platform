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
