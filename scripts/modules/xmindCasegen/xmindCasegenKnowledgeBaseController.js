(function() {
  function create(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var knowledgeBaseApi = ctx.knowledgeBaseApi || null;
    var requiredMethods = [
      'createDefaultState',
      'normalizeState',
      'normalizeBaseUrl',
      'buildQueryKey',
      'runPipeline',
    ];
    if (!knowledgeBaseApi || requiredMethods.some(function(name) {
      return typeof knowledgeBaseApi[name] !== 'function';
    })) {
      throw new Error('xmindKnowledgeBaseApi 未完整初始化');
    }

    var createDefaultState = knowledgeBaseApi.createDefaultState;
    var normalizeState = knowledgeBaseApi.normalizeState;
    var normalizeBaseUrl = knowledgeBaseApi.normalizeBaseUrl;
    var buildQueryKey = knowledgeBaseApi.buildQueryKey;
    var cloneJson = typeof ctx.cloneJson === 'function'
      ? ctx.cloneJson
      : function(value, fallback) {
        try {
          return JSON.parse(JSON.stringify(value));
        } catch (err) {
          return fallback;
        }
      };
    var ensureXmindState = typeof ctx.ensureXmindState === 'function'
      ? ctx.ensureXmindState
      : function() {
        state.xmindCaseGen = state.xmindCaseGen || {};
        return state.xmindCaseGen;
      };
    var getActiveWorkspaceId = typeof ctx.getActiveWorkspaceId === 'function'
      ? ctx.getActiveWorkspaceId
      : function() {
        var xmindState = ensureXmindState();
        return xmindState && xmindState.activeWorkspaceId ? String(xmindState.activeWorkspaceId || '') : '';
      };
    var getWorkspaceRecord = typeof ctx.getWorkspaceRecord === 'function'
      ? ctx.getWorkspaceRecord
      : function(workspaceId) {
        var xmindState = ensureXmindState();
        var workspaces = xmindState && xmindState.workspaces ? xmindState.workspaces : {};
        return workspaces[String(workspaceId || '')] || null;
      };
    var createWorkspaceSnapshot = typeof ctx.createWorkspaceSnapshot === 'function'
      ? ctx.createWorkspaceSnapshot
      : function() { return { xmind: {} }; };
    var createInitialXmindState = typeof ctx.createInitialXmindState === 'function'
      ? ctx.createInitialXmindState
      : function() { return {}; };
    var getSelectedRequirementSource = typeof ctx.getSelectedRequirementSource === 'function'
      ? ctx.getSelectedRequirementSource
      : function() { return {}; };
    var getRequirementLabelText = typeof ctx.getRequirementLabelText === 'function'
      ? ctx.getRequirementLabelText
      : function() { return ''; };
    var generateLocalId = typeof ctx.generateLocalId === 'function'
      ? ctx.generateLocalId
      : function(prefix) { return String(prefix || 'kb') + '-' + String(Date.now()); };
    var callModelWithConfig = typeof ctx.callModelWithConfig === 'function'
      ? ctx.callModelWithConfig
      : null;
    var callModelWithGuard = typeof ctx.callModelWithGuard === 'function'
      ? ctx.callModelWithGuard
      : function(run) { return run(); };
    var persistWorkflowState = typeof ctx.persistWorkflowState === 'function'
      ? ctx.persistWorkflowState
      : function() {};
    var onActiveStateChange = typeof ctx.onActiveStateChange === 'function'
      ? ctx.onActiveStateChange
      : function() {};
    var getWorkspaceShadowDepth = typeof ctx.getWorkspaceShadowDepth === 'function'
      ? ctx.getWorkspaceShadowDepth
      : function() { return 0; };
    var now = typeof ctx.now === 'function' ? ctx.now : function() { return Date.now(); };
    var pipelinePromiseMap = {};
    var actionResultMap = {};

    function ensureStateOnSnapshot(xmindSnapshot) {
      if (!xmindSnapshot || typeof xmindSnapshot !== 'object') return createDefaultState();
      xmindSnapshot.knowledgeBase = normalizeState(xmindSnapshot.knowledgeBase);
      return xmindSnapshot.knowledgeBase;
    }

    function ensureStateOnRecord(record) {
      if (!record || typeof record !== 'object') return createDefaultState();
      if (!record.snapshot || typeof record.snapshot !== 'object') {
        record.snapshot = createWorkspaceSnapshot();
      }
      if (!record.snapshot.xmind || typeof record.snapshot.xmind !== 'object') {
        record.snapshot.xmind = createInitialXmindState();
      }
      return ensureStateOnSnapshot(record.snapshot.xmind);
    }

    function getRequestId(stateValue) {
      var kbState = normalizeState(stateValue);
      if (kbState.latestRequestId) return String(kbState.latestRequestId || '');
      if (kbState.aiFilter && kbState.aiFilter.requestId) return String(kbState.aiFilter.requestId || '');
      if (kbState.ruleSearch && kbState.ruleSearch.requestId) return String(kbState.ruleSearch.requestId || '');
      return '';
    }

    function shouldAcceptState(currentState, incomingState) {
      var currentId = getRequestId(currentState);
      var incomingId = getRequestId(incomingState);
      if (!incomingId) return true;
      if (!currentId) return true;
      if (currentId === incomingId) return true;
      if (
        incomingState
        && incomingState.ruleSearch
        && String(incomingState.ruleSearch.status || '') === 'pending'
      ) {
        return true;
      }
      return false;
    }

    function getCurrentBaseUrl() {
      var raw = state && state.settings && typeof state.settings.knowledgeBaseBaseUrl === 'string'
        ? state.settings.knowledgeBaseBaseUrl
        : '';
      return normalizeBaseUrl(raw);
    }

    function getActiveState() {
      return ensureStateOnSnapshot(ensureXmindState());
    }

    function getWorkspaceState(workspaceId) {
      var stableId = String(workspaceId || getActiveWorkspaceId() || '');
      if (!stableId) return normalizeState(createDefaultState());
      if (stableId === String(getActiveWorkspaceId() || '')) {
        return getActiveState();
      }
      return ensureStateOnRecord(getWorkspaceRecord(stableId));
    }

    function setWorkspaceState(workspaceId, nextValue, options) {
      var stableId = String(workspaceId || getActiveWorkspaceId() || '');
      if (!stableId) return false;
      var opts = options || {};
      var normalized = normalizeState(nextValue);
      var record = getWorkspaceRecord(stableId);
      if (!record) return false;
      var currentState = ensureStateOnRecord(record);
      if (opts.force !== true && !shouldAcceptState(currentState, normalized)) {
        return false;
      }
      record.snapshot.xmind.knowledgeBase = normalized;
      record.updatedAt = now();
      if (stableId === String(getActiveWorkspaceId() || '')) {
        ensureXmindState().knowledgeBase = normalizeState(normalized);
        onActiveStateChange(normalized);
      }
      if (getWorkspaceShadowDepth() <= 0 && opts.skipPersist !== true) {
        persistWorkflowState();
      }
      return true;
    }

    function buildSkipState(workspaceId, contract, reason) {
      var baseUrl = getCurrentBaseUrl();
      var stageStatus = baseUrl ? 'skipped' : 'disabled';
      return normalizeState({
        baseUrl: baseUrl,
        enabled: Boolean(baseUrl),
        workspaceId: String(workspaceId || ''),
        queryKey: '',
        latestRequestId: '',
        lastOperation: contract && contract.mode ? String(contract.mode || '') : '',
        validation: {
          status: 'disabled',
          normalizedBaseUrl: baseUrl,
        },
        ruleSearch: {
          status: stageStatus,
          reason: reason || (baseUrl ? '本轮未执行知识库检索' : '未启用知识库'),
        },
        aiFilter: {
          status: stageStatus,
          reason: reason || (baseUrl ? '本轮未执行知识库检索' : '未启用知识库'),
        },
        catalogItems: [],
        candidates: [],
        selectedDocuments: [],
        documentSections: [],
        selectedSections: [],
        selectedItems: [],
        usedInLatestGeneration: false,
        injectedContextText: '',
        latestError: '',
        warnings: [],
        updatedAt: now(),
      });
    }

    function buildQueryContext(requirementSource) {
      var source = requirementSource && typeof requirementSource === 'object' ? requirementSource : {};
      return {
        requirementLabel: getRequirementLabelText(),
        requirementText: source.text ? String(source.text || '') : '',
        requirementSupplement: source.supplement ? String(source.supplement || '') : '',
        requirementMode: source.mode ? String(source.mode || '') : '',
        operationType: 'workspace_requirement',
        targetModule: '',
        visibleModules: [],
        visibleCases: [],
        operationContract: {},
      };
    }

    function canReuseState(kbState, baseUrl, queryKey) {
      var normalized = normalizeState(kbState);
      if (!normalized.enabled) return false;
      if (normalizeBaseUrl(normalized.baseUrl) !== normalizeBaseUrl(baseUrl)) return false;
      if (!queryKey || String(normalized.queryKey || '') !== String(queryKey || '')) return false;
      if (!normalized.ruleSearch || String(normalized.ruleSearch.status || '') !== 'done') return false;
      if (!normalized.aiFilter) return false;
      var aiStatus = String(normalized.aiFilter.status || '');
      if (aiStatus === 'pending' || aiStatus === 'failed' || aiStatus === 'disabled') return false;
      if (aiStatus === 'done') return true;
      if (aiStatus === 'skipped') {
        return Number(normalized.ruleSearch.candidateCount || 0) <= 0
          || (Array.isArray(normalized.candidates) && normalized.candidates.length === 0);
      }
      return false;
    }

    function buildReusedState(kbState, contract, workspaceId) {
      var normalized = normalizeState(kbState);
      return normalizeState({
        baseUrl: normalized.baseUrl,
        enabled: normalized.enabled,
        workspaceId: String(workspaceId || normalized.workspaceId || ''),
        queryKey: normalized.queryKey,
        latestRequestId: normalized.latestRequestId,
        lastOperation: contract && contract.mode ? String(contract.mode || '') : normalized.lastOperation,
        validation: cloneJson(normalized.validation, {}),
        ruleSearch: cloneJson(normalized.ruleSearch, {}),
        aiFilter: cloneJson(normalized.aiFilter, {}),
        catalogItems: cloneJson(normalized.catalogItems, []),
        candidates: cloneJson(normalized.candidates, []),
        selectedDocuments: cloneJson(normalized.selectedDocuments, []),
        documentSections: cloneJson(normalized.documentSections, []),
        selectedSections: cloneJson(normalized.selectedSections, []),
        selectedItems: cloneJson(normalized.selectedItems, []),
        usedInLatestGeneration: Boolean(normalized.injectedContextText),
        injectedContextText: normalized.injectedContextText,
        latestError: normalized.latestError,
        warnings: cloneJson(normalized.warnings, []),
        updatedAt: now(),
      });
    }

    function getActionResult(workspaceId, actionKey, queryKey) {
      var stableWorkspaceId = String(workspaceId || '');
      var stableActionKey = String(actionKey || '');
      if (!stableWorkspaceId || !stableActionKey || !queryKey) return null;
      var cached = actionResultMap[stableWorkspaceId];
      if (!cached) return null;
      if (String(cached.actionKey || '') !== stableActionKey) return null;
      if (String(cached.queryKey || '') !== String(queryKey || '')) return null;
      return normalizeState(cached.state);
    }

    function callFilterModel(model, userText, prompt, reasoning, temperature) {
      if (!callModelWithConfig) {
        return Promise.reject(new Error('当前 XMind 生成模型不可用，无法执行知识库 AI 筛选'));
      }
      return callModelWithGuard(function() {
        return callModelWithConfig(model, userText, prompt, reasoning || '', temperature);
      });
    }

    async function runForGeneration(contract, visibleContext, moduleEntry, model, reasoning, temperature, workspaceId, actionKey) {
      var stableWorkspaceId = String(workspaceId || getActiveWorkspaceId() || '');
      if (!stableWorkspaceId) return null;
      var stableActionKey = String(actionKey || '');
      var baseUrl = getCurrentBaseUrl();
      var queryContext = buildQueryContext(getSelectedRequirementSource());
      var queryKey = buildQueryKey({
        baseUrl: baseUrl,
        queryContext: queryContext,
      });
      if (!baseUrl) {
        setWorkspaceState(
          stableWorkspaceId,
          buildSkipState(stableWorkspaceId, contract, '未配置共享知识库地址，本轮已跳过'),
          { force: true }
        );
        return null;
      }
      var existingState = getWorkspaceState(stableWorkspaceId);
      if (canReuseState(existingState, baseUrl, queryKey)) {
        var reusedState = buildReusedState(existingState, contract, stableWorkspaceId);
        setWorkspaceState(stableWorkspaceId, reusedState, { force: true });
        return reusedState;
      }
      var actionScopedState = getActionResult(stableWorkspaceId, stableActionKey, queryKey);
      if (actionScopedState) {
        var reusedActionState = buildReusedState(actionScopedState, contract, stableWorkspaceId);
        setWorkspaceState(stableWorkspaceId, reusedActionState, { force: true });
        return reusedActionState;
      }
      if (
        pipelinePromiseMap[stableWorkspaceId]
        && String(pipelinePromiseMap[stableWorkspaceId].actionKey || '') === stableActionKey
        && String(pipelinePromiseMap[stableWorkspaceId].queryKey || '') === String(queryKey || '')
      ) {
        var inflightState = await pipelinePromiseMap[stableWorkspaceId].promise;
        var reusedInflightState = buildReusedState(inflightState, contract, stableWorkspaceId);
        setWorkspaceState(stableWorkspaceId, reusedInflightState, { force: true });
        return reusedInflightState;
      }
      var requestId = generateLocalId('kb');
      var runPromise = knowledgeBaseApi.runPipeline({
        baseUrl: baseUrl,
        workspaceId: stableWorkspaceId,
        requestId: requestId,
        queryContext: queryContext,
        model: cloneJson(model, null),
        reasoning: reasoning,
        temperature: temperature,
        callModel: callFilterModel,
        onStateChange: function(nextState) {
          setWorkspaceState(stableWorkspaceId, nextState);
        },
      }).then(function(finalState) {
        var normalizedFinal = normalizeState(finalState);
        if (stableActionKey) {
          actionResultMap[stableWorkspaceId] = {
            actionKey: stableActionKey,
            queryKey: queryKey,
            state: normalizedFinal,
          };
        }
        setWorkspaceState(stableWorkspaceId, normalizedFinal);
        return normalizedFinal;
      }).finally(function() {
        var current = pipelinePromiseMap[stableWorkspaceId];
        if (current && current.promise === runPromise) {
          delete pipelinePromiseMap[stableWorkspaceId];
        }
      });
      pipelinePromiseMap[stableWorkspaceId] = {
        actionKey: stableActionKey,
        queryKey: queryKey,
        promise: runPromise,
      };
      return runPromise;
    }

    return {
      ensureStateOnSnapshot: ensureStateOnSnapshot,
      ensureStateOnRecord: ensureStateOnRecord,
      getRequestId: getRequestId,
      shouldAcceptState: shouldAcceptState,
      getCurrentBaseUrl: getCurrentBaseUrl,
      getActiveState: getActiveState,
      getWorkspaceState: getWorkspaceState,
      setWorkspaceState: setWorkspaceState,
      buildSkipState: buildSkipState,
      buildQueryContext: buildQueryContext,
      canReuseState: canReuseState,
      buildReusedState: buildReusedState,
      runForGeneration: runForGeneration,
    };
  }

  window.app = window.app || {};
  window.app.xmindCasegenKnowledgeBaseController = {
    create: create,
  };
})();
