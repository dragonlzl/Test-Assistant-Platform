(function() {
  function init(ctx) {
    ctx = ctx || {};
    var apiClient = ctx.apiClient || (window.app && window.app.apiClient) || null;
    var escapeHtml = ctx.escapeHtml || function(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    function cloneJson(value, fallback) {
      if (value === undefined || value === null) return fallback;
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (err) {
        return fallback;
      }
    }

    function normalizeBaseUrl(value) {
      var text = value === null || value === undefined ? '' : String(value || '').trim();
      if (!text) return '';
      text = text.replace(/[?#].*$/, '');
      if (!/^https?:\/\//i.test(text)) return text;
      if (text.charAt(text.length - 1) !== '/') text += '/';
      return text;
    }

    function normalizeStageStatus(value) {
      var text = value === null || value === undefined ? '' : String(value || '').trim();
      if (text === 'pending' || text === 'done' || text === 'skipped' || text === 'failed') return text;
      return 'disabled';
    }

    function createStageState(status) {
      return {
        status: normalizeStageStatus(status),
        requestId: '',
        startedAt: 0,
        finishedAt: 0,
        durationMs: 0,
        reason: '',
        error: '',
        candidateCount: 0,
        selectedCount: 0,
      };
    }

    function createValidationState() {
      return {
        status: 'disabled',
        normalizedBaseUrl: '',
        checkedAt: 0,
        docCount: 0,
        entryCount: 0,
        error: '',
      };
    }

    function createDefaultState() {
      return {
        baseUrl: '',
        enabled: false,
        workspaceId: '',
        queryKey: '',
        latestRequestId: '',
        lastOperation: '',
        validation: createValidationState(),
        ruleSearch: createStageState('disabled'),
        aiFilter: createStageState('disabled'),
        candidates: [],
        selectedItems: [],
        usedInLatestGeneration: false,
        injectedContextText: '',
        latestError: '',
        warnings: [],
        updatedAt: 0,
      };
    }

    function normalizeStageState(value, defaults) {
      var source = value && typeof value === 'object' ? value : {};
      var base = defaults && typeof defaults === 'object' ? defaults : createStageState('disabled');
      var next = createStageState(source.status || base.status);
      next.requestId = source.requestId ? String(source.requestId || '') : String(base.requestId || '');
      next.startedAt = Number(source.startedAt || base.startedAt || 0);
      next.finishedAt = Number(source.finishedAt || base.finishedAt || 0);
      next.durationMs = Number(source.durationMs || base.durationMs || 0);
      next.reason = source.reason ? String(source.reason || '') : String(base.reason || '');
      next.error = source.error ? String(source.error || '') : String(base.error || '');
      next.candidateCount = Number(source.candidateCount || base.candidateCount || 0);
      next.selectedCount = Number(source.selectedCount || base.selectedCount || 0);
      if (!Number.isFinite(next.startedAt) || next.startedAt < 0) next.startedAt = 0;
      if (!Number.isFinite(next.finishedAt) || next.finishedAt < 0) next.finishedAt = 0;
      if (!Number.isFinite(next.durationMs) || next.durationMs < 0) next.durationMs = 0;
      if (!Number.isFinite(next.candidateCount) || next.candidateCount < 0) next.candidateCount = 0;
      if (!Number.isFinite(next.selectedCount) || next.selectedCount < 0) next.selectedCount = 0;
      return next;
    }

    function normalizeValidationState(value) {
      var source = value && typeof value === 'object' ? value : {};
      var next = createValidationState();
      next.status = normalizeStageStatus(source.status);
      next.normalizedBaseUrl = source.normalizedBaseUrl ? String(source.normalizedBaseUrl || '') : '';
      next.checkedAt = Number(source.checkedAt || 0);
      next.docCount = Number(source.docCount || 0);
      next.entryCount = Number(source.entryCount || 0);
      next.error = source.error ? String(source.error || '') : '';
      if (!Number.isFinite(next.checkedAt) || next.checkedAt < 0) next.checkedAt = 0;
      if (!Number.isFinite(next.docCount) || next.docCount < 0) next.docCount = 0;
      if (!Number.isFinite(next.entryCount) || next.entryCount < 0) next.entryCount = 0;
      return next;
    }

    function normalizeCandidateItem(item) {
      var source = item && typeof item === 'object' ? item : {};
      return {
        candidateId: source.candidateId ? String(source.candidateId || '') : String(source.candidate_id || ''),
        docId: source.docId ? String(source.docId || '') : String(source.doc_id || ''),
        module: source.module ? String(source.module || '') : '',
        title: source.title ? String(source.title || '') : '',
        heading: source.heading ? String(source.heading || '') : '',
        summary: source.summary ? String(source.summary || '') : '',
        snippet: source.snippet ? String(source.snippet || '') : '',
        cleanPath: source.cleanPath ? String(source.cleanPath || '') : String(source.clean_path || ''),
        relativePath: source.relativePath ? String(source.relativePath || '') : String(source.relative_path || ''),
        sourceUrl: source.sourceUrl ? String(source.sourceUrl || '') : String(source.source_url || ''),
        chunkIndex: Number(source.chunkIndex || source.chunk_index || 0),
        score: Number(source.score || 0),
        matchedTerms: Array.isArray(source.matchedTerms)
          ? source.matchedTerms.map(function(text) { return String(text || '').trim(); }).filter(Boolean)
          : (Array.isArray(source.matched_terms)
            ? source.matched_terms.map(function(text) { return String(text || '').trim(); }).filter(Boolean)
            : []),
        documentExcerpt: source.documentExcerpt ? String(source.documentExcerpt || '') : String(source.document_excerpt || ''),
        reason: source.reason ? String(source.reason || '') : '',
      };
    }

    function normalizeState(value) {
      var source = value && typeof value === 'object' ? value : {};
      var next = createDefaultState();
      next.baseUrl = normalizeBaseUrl(source.baseUrl || source.base_url || '');
      next.enabled = source.enabled === true || Boolean(next.baseUrl);
      next.workspaceId = source.workspaceId ? String(source.workspaceId || '') : String(source.workspace_id || '');
      next.queryKey = source.queryKey ? String(source.queryKey || '') : '';
      next.latestRequestId = source.latestRequestId ? String(source.latestRequestId || '') : '';
      next.lastOperation = source.lastOperation ? String(source.lastOperation || '') : '';
      next.validation = normalizeValidationState(source.validation);
      next.ruleSearch = normalizeStageState(source.ruleSearch, createStageState(next.enabled ? 'pending' : 'disabled'));
      next.aiFilter = normalizeStageState(source.aiFilter, createStageState(next.enabled ? 'skipped' : 'disabled'));
      next.candidates = (Array.isArray(source.candidates) ? source.candidates : []).map(normalizeCandidateItem);
      next.selectedItems = (Array.isArray(source.selectedItems) ? source.selectedItems : []).map(normalizeCandidateItem);
      next.usedInLatestGeneration = source.usedInLatestGeneration === true;
      next.injectedContextText = source.injectedContextText ? String(source.injectedContextText || '') : '';
      next.latestError = source.latestError ? String(source.latestError || '') : '';
      next.warnings = (Array.isArray(source.warnings) ? source.warnings : []).map(function(text) {
        return String(text || '').trim();
      }).filter(Boolean);
      next.updatedAt = Number(source.updatedAt || 0);
      if (!Number.isFinite(next.updatedAt) || next.updatedAt < 0) next.updatedAt = 0;
      return next;
    }

    function buildQueryKey(input) {
      var baseUrl = normalizeBaseUrl(input && input.baseUrl ? input.baseUrl : '');
      var queryContext = input && input.queryContext && typeof input.queryContext === 'object'
        ? input.queryContext
        : {};
      return JSON.stringify({
        version: 2,
        baseUrl: baseUrl,
        requirementLabel: queryContext.requirementLabel ? String(queryContext.requirementLabel || '').trim() : '',
        requirementText: queryContext.requirementText ? String(queryContext.requirementText || '').trim() : '',
        requirementSupplement: queryContext.requirementSupplement ? String(queryContext.requirementSupplement || '').trim() : '',
        requirementMode: queryContext.requirementMode ? String(queryContext.requirementMode || '').trim() : '',
      });
    }

    function buildSearchPayload(input) {
      var queryContext = input && input.queryContext && typeof input.queryContext === 'object'
        ? input.queryContext
        : {};
      return {
        base_url: normalizeBaseUrl(input && input.baseUrl ? input.baseUrl : ''),
        workspace_id: input && input.workspaceId ? String(input.workspaceId || '') : '',
        request_id: input && input.requestId ? String(input.requestId || '') : '',
        timeout_sec: input && input.timeoutSec ? Number(input.timeoutSec) : 15,
        force_refresh: input && input.forceRefresh === true,
        max_candidates: input && input.maxCandidates ? Number(input.maxCandidates) : 12,
        requirement_label: queryContext.requirementLabel || '',
        requirement_text: queryContext.requirementText || '',
        requirement_supplement: queryContext.requirementSupplement || '',
        requirement_mode: queryContext.requirementMode || '',
        operation_type: queryContext.operationType || '',
        target_module: queryContext.targetModule || '',
        visible_modules: cloneJson(queryContext.visibleModules, []),
        visible_cases: cloneJson(queryContext.visibleCases, []),
        operation_contract: cloneJson(queryContext.operationContract, {}),
      };
    }

    function buildAiFilterPrompt() {
      return [
        '你是共享知识库精筛助手，只负责从候选知识块中筛出本轮 XMind 用例生成真正相关的内容。',
        '本次筛选服务于整份需求的用例生成，不需要按模块分别返回结果。',
        '只输出合法 JSON，不要输出解释、备注、Markdown 或代码块围栏。',
        '输出结构固定为：{"selected_ids":["kb-1"],"items":[{"candidate_id":"kb-1","reason":"关联原因"}]}。',
        '规则：',
        '1、只保留与整份需求直接相关的知识块；目标模块或当前可见模块仅作辅助参考，不作为必须条件。',
        '2、优先保留规则、机制、限制、边界、触发条件、数值逻辑等可直接指导用例设计的内容。',
        '3、与本轮需求无明显关系的目录、泛介绍、重复内容必须剔除。',
        '4、最多选择 6 条；如果没有明显相关内容，返回空数组。',
        '5、candidate_id 必须来自输入候选列表，不能编造。',
      ].join('\n');
    }

    function buildAiFilterUserText(queryContext, candidates) {
      return [
        '【检索上下文(JSON)】',
        JSON.stringify({
          requirementLabel: queryContext.requirementLabel || '',
          requirementText: queryContext.requirementText || '',
          requirementSupplement: queryContext.requirementSupplement || '',
          operationType: queryContext.operationType || '',
          targetModule: queryContext.targetModule || '',
          visibleModules: cloneJson(queryContext.visibleModules, []),
          visibleCases: cloneJson(queryContext.visibleCases, []),
        }, null, 2),
        '【候选知识块(JSON)】',
        JSON.stringify((Array.isArray(candidates) ? candidates : []).map(function(item) {
          return {
            candidate_id: item.candidateId,
            module: item.module,
            title: item.title,
            heading: item.heading,
            relative_path: item.relativePath,
            matched_terms: item.matchedTerms,
            snippet: item.snippet,
            document_excerpt: item.documentExcerpt,
          };
        }), null, 2),
      ].join('\n\n');
    }

    function extractJsonPayloadDetailed(text) {
      var raw = String(text || '').trim();
      if (!raw) return { payload: null, raw: '' };
      var content = raw;
      var fenceMatched = content.match(/^```[\w-]*\n([\s\S]*?)```$/);
      if (fenceMatched && fenceMatched[1]) {
        content = String(fenceMatched[1] || '').trim();
      }
      try {
        return { payload: JSON.parse(content), raw: content };
      } catch (err) {}
      var firstBrace = content.indexOf('{');
      var lastBrace = content.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        var objText = content.slice(firstBrace, lastBrace + 1);
        try {
          return { payload: JSON.parse(objText), raw: objText };
        } catch (err2) {}
      }
      var firstBracket = content.indexOf('[');
      var lastBracket = content.lastIndexOf(']');
      if (firstBracket >= 0 && lastBracket > firstBracket) {
        var arrText = content.slice(firstBracket, lastBracket + 1);
        try {
          return { payload: JSON.parse(arrText), raw: arrText };
        } catch (err3) {}
      }
      return { payload: null, raw: content };
    }

    function mapSelectedItems(candidates, parsed) {
      var list = Array.isArray(candidates) ? candidates : [];
      var map = {};
      list.forEach(function(item) {
        if (!item || !item.candidateId) return;
        map[item.candidateId] = item;
      });
      var orderedIds = [];
      var reasonMap = {};
      if (parsed && Array.isArray(parsed.selected_ids)) {
        parsed.selected_ids.forEach(function(item) {
          var id = String(item || '').trim();
          if (id) orderedIds.push(id);
        });
      }
      if (parsed && Array.isArray(parsed.ids)) {
        parsed.ids.forEach(function(item) {
          var id = String(item || '').trim();
          if (id) orderedIds.push(id);
        });
      }
      if (parsed && Array.isArray(parsed.items)) {
        parsed.items.forEach(function(item) {
          if (!item || typeof item !== 'object') return;
          var id = String(item.candidate_id || item.candidateId || '').trim();
          if (!id) return;
          orderedIds.push(id);
          reasonMap[id] = String(item.reason || '').trim();
        });
      }
      var result = [];
      var seen = {};
      orderedIds.forEach(function(id) {
        if (!id || seen[id] || !map[id]) return;
        seen[id] = true;
        var entry = cloneJson(map[id], null);
        if (!entry) return;
        entry.reason = reasonMap[id] || entry.reason || '';
        result.push(normalizeCandidateItem(entry));
      });
      return result.slice(0, 6);
    }

    function buildInjectedContextText(selectedItems) {
      var list = Array.isArray(selectedItems) ? selectedItems.map(normalizeCandidateItem) : [];
      if (!list.length) return '';
      var parts = [
        '【知识库上下文】',
        '以下内容来自共享知识库，仅作为本轮 XMind 用例生成的补充上下文，请优先结合当前需求判断，不要机械照抄无关内容。'
      ];
      var totalChars = parts.join('\n').length;
      for (var i = 0; i < list.length; i += 1) {
        var item = list[i];
        var lines = [];
        lines.push(String(i + 1) + '、' + (item.module ? (item.module + ' / ') : '') + (item.title || item.heading || '知识条目'));
        if (item.reason) lines.push('关联原因：' + item.reason);
        if (item.relativePath) lines.push('来源：' + item.relativePath);
        var excerpt = item.documentExcerpt || item.snippet || item.summary || '';
        if (excerpt) lines.push('内容摘要：' + excerpt);
        var block = lines.join('\n');
        if (!block) continue;
        if (totalChars + block.length > 4200 && i > 0) break;
        parts.push(block);
        totalChars += block.length;
      }
      return parts.join('\n\n');
    }

    function makePendingState(input) {
      var baseUrl = normalizeBaseUrl(input && input.baseUrl ? input.baseUrl : '');
      var requestId = input && input.requestId ? String(input.requestId || '') : '';
      var queryContext = input && input.queryContext && typeof input.queryContext === 'object'
        ? input.queryContext
        : {};
      var queryKey = buildQueryKey({ baseUrl: baseUrl, queryContext: queryContext });
      var now = Date.now();
      return normalizeState({
        baseUrl: baseUrl,
        enabled: Boolean(baseUrl),
        workspaceId: input && input.workspaceId ? String(input.workspaceId || '') : '',
        queryKey: queryKey,
        latestRequestId: requestId,
        lastOperation: queryContext.operationType || '',
        validation: {
          status: baseUrl ? 'pending' : 'disabled',
          normalizedBaseUrl: baseUrl,
        },
        ruleSearch: {
          status: baseUrl ? 'pending' : 'disabled',
          requestId: requestId,
          startedAt: now,
        },
        aiFilter: {
          status: baseUrl ? 'skipped' : 'disabled',
          requestId: requestId,
          reason: baseUrl ? '等待规则检索完成' : '未启用知识库',
        },
        updatedAt: now,
      });
    }

    function emitState(handler, value) {
      if (typeof handler !== 'function') return;
      try {
        handler(normalizeState(value));
      } catch (err) {
        // ignore
      }
    }

    async function runPipeline(input) {
      var baseUrl = normalizeBaseUrl(input && input.baseUrl ? input.baseUrl : '');
      var requestId = input && input.requestId ? String(input.requestId || '') : '';
      var queryContext = input && input.queryContext && typeof input.queryContext === 'object'
        ? input.queryContext
        : {};
      var queryKey = buildQueryKey({ baseUrl: baseUrl, queryContext: queryContext });
      var pendingState = makePendingState(input);
      emitState(input && input.onStateChange, pendingState);
      if (!baseUrl) {
        return pendingState;
      }
      if (!apiClient || typeof apiClient.searchKnowledgeBase !== 'function') {
        return normalizeState({
          baseUrl: baseUrl,
          enabled: true,
          workspaceId: input && input.workspaceId ? String(input.workspaceId || '') : '',
          queryKey: queryKey,
          latestRequestId: requestId,
          lastOperation: queryContext.operationType || '',
          validation: {
            status: 'failed',
            normalizedBaseUrl: baseUrl,
            checkedAt: Date.now(),
            error: '知识库接口不可用，请刷新页面后重试',
          },
          ruleSearch: {
            status: 'failed',
            requestId: requestId,
            startedAt: pendingState.ruleSearch.startedAt,
            finishedAt: Date.now(),
            durationMs: Math.max(0, Date.now() - pendingState.ruleSearch.startedAt),
            reason: '知识库接口不可用，请刷新页面后重试',
            error: '知识库接口不可用，请刷新页面后重试',
          },
          aiFilter: {
            status: 'skipped',
            requestId: requestId,
            reason: '规则检索失败，已跳过 AI 筛选',
          },
          latestError: '知识库接口不可用，请刷新页面后重试',
          updatedAt: Date.now(),
        });
      }

      var searchResponse = null;
      try {
        searchResponse = await apiClient.searchKnowledgeBase(buildSearchPayload(input));
      } catch (err) {
        return normalizeState({
          baseUrl: baseUrl,
          enabled: true,
          workspaceId: input && input.workspaceId ? String(input.workspaceId || '') : '',
          queryKey: queryKey,
          latestRequestId: requestId,
          lastOperation: queryContext.operationType || '',
          validation: {
            status: 'failed',
            normalizedBaseUrl: baseUrl,
            checkedAt: Date.now(),
            error: err && err.message ? err.message : '规则检索失败',
          },
          ruleSearch: {
            status: 'failed',
            requestId: requestId,
            startedAt: pendingState.ruleSearch.startedAt,
            finishedAt: Date.now(),
            durationMs: Math.max(0, Date.now() - pendingState.ruleSearch.startedAt),
            reason: err && err.message ? err.message : '规则检索失败',
            error: err && err.message ? err.message : '规则检索失败',
          },
          aiFilter: {
            status: 'skipped',
            requestId: requestId,
            reason: '规则检索失败，已跳过 AI 筛选',
          },
          latestError: err && err.message ? err.message : '规则检索失败',
          updatedAt: Date.now(),
        });
      }

      var normalizedCandidates = (searchResponse && Array.isArray(searchResponse.candidates)
        ? searchResponse.candidates
        : []).map(normalizeCandidateItem);
      var ruleFinishedAt = Date.now();
      var searchState = normalizeState({
        baseUrl: baseUrl,
        enabled: true,
        workspaceId: input && input.workspaceId ? String(input.workspaceId || '') : '',
        queryKey: queryKey,
        latestRequestId: requestId,
        lastOperation: queryContext.operationType || '',
        validation: {
          status: 'done',
          normalizedBaseUrl: searchResponse && searchResponse.normalized_base_url
            ? String(searchResponse.normalized_base_url || '')
            : baseUrl,
          checkedAt: ruleFinishedAt,
          docCount: searchResponse && searchResponse.manifest ? Number(searchResponse.manifest.doc_count || 0) : 0,
          entryCount: searchResponse && searchResponse.manifest ? Number(searchResponse.manifest.entry_count || 0) : 0,
        },
        ruleSearch: {
          status: 'done',
          requestId: requestId,
          startedAt: pendingState.ruleSearch.startedAt,
          finishedAt: ruleFinishedAt,
          durationMs: Math.max(0, ruleFinishedAt - pendingState.ruleSearch.startedAt),
          reason: normalizedCandidates.length
            ? ('规则检索命中 ' + String(normalizedCandidates.length) + ' 条候选知识')
            : '规则检索未命中候选知识',
          candidateCount: normalizedCandidates.length,
        },
        aiFilter: {
          status: normalizedCandidates.length ? 'pending' : 'skipped',
          requestId: requestId,
          startedAt: normalizedCandidates.length ? Date.now() : 0,
          reason: normalizedCandidates.length ? '正在执行 AI 精筛' : '规则检索未命中，已跳过 AI 筛选',
        },
        candidates: normalizedCandidates,
        warnings: searchResponse && Array.isArray(searchResponse.warnings) ? searchResponse.warnings : [],
        updatedAt: Date.now(),
      });
      emitState(input && input.onStateChange, searchState);

      if (!normalizedCandidates.length) {
        return searchState;
      }

      if (!input || !input.model || typeof input.callModel !== 'function') {
        return normalizeState({
          baseUrl: baseUrl,
          enabled: true,
          workspaceId: input && input.workspaceId ? String(input.workspaceId || '') : '',
          queryKey: queryKey,
          latestRequestId: requestId,
          lastOperation: queryContext.operationType || '',
          validation: searchState.validation,
          ruleSearch: searchState.ruleSearch,
          aiFilter: {
            status: 'failed',
            requestId: requestId,
            startedAt: searchState.aiFilter.startedAt,
            finishedAt: Date.now(),
            durationMs: Math.max(0, Date.now() - searchState.aiFilter.startedAt),
            reason: '当前 XMind 生成模型不可用，已跳过知识库注入',
            error: '当前 XMind 生成模型不可用，已跳过知识库注入',
          },
          candidates: normalizedCandidates,
          latestError: '当前 XMind 生成模型不可用，已跳过知识库注入',
          warnings: searchState.warnings,
          updatedAt: Date.now(),
        });
      }

      var rawFilterText = '';
      try {
        rawFilterText = await input.callModel(
          input.model,
          buildAiFilterUserText(queryContext, normalizedCandidates),
          buildAiFilterPrompt(),
          input.reasoning || '',
          input.temperature
        );
      } catch (err2) {
        return normalizeState({
          baseUrl: baseUrl,
          enabled: true,
          workspaceId: input && input.workspaceId ? String(input.workspaceId || '') : '',
          queryKey: queryKey,
          latestRequestId: requestId,
          lastOperation: queryContext.operationType || '',
          validation: searchState.validation,
          ruleSearch: searchState.ruleSearch,
          aiFilter: {
            status: 'failed',
            requestId: requestId,
            startedAt: searchState.aiFilter.startedAt,
            finishedAt: Date.now(),
            durationMs: Math.max(0, Date.now() - searchState.aiFilter.startedAt),
            reason: err2 && err2.message ? err2.message : 'AI 精筛失败',
            error: err2 && err2.message ? err2.message : 'AI 精筛失败',
          },
          candidates: normalizedCandidates,
          latestError: err2 && err2.message ? err2.message : 'AI 精筛失败',
          warnings: searchState.warnings,
          updatedAt: Date.now(),
        });
      }

      var extracted = extractJsonPayloadDetailed(rawFilterText);
      if (!extracted.payload || typeof extracted.payload !== 'object') {
        return normalizeState({
          baseUrl: baseUrl,
          enabled: true,
          workspaceId: input && input.workspaceId ? String(input.workspaceId || '') : '',
          queryKey: queryKey,
          latestRequestId: requestId,
          lastOperation: queryContext.operationType || '',
          validation: searchState.validation,
          ruleSearch: searchState.ruleSearch,
          aiFilter: {
            status: 'failed',
            requestId: requestId,
            startedAt: searchState.aiFilter.startedAt,
            finishedAt: Date.now(),
            durationMs: Math.max(0, Date.now() - searchState.aiFilter.startedAt),
            reason: 'AI 精筛返回结果无法解析为 JSON',
            error: 'AI 精筛返回结果无法解析为 JSON',
          },
          candidates: normalizedCandidates,
          latestError: 'AI 精筛返回结果无法解析为 JSON',
          warnings: searchState.warnings,
          updatedAt: Date.now(),
        });
      }

      var selectedItems = mapSelectedItems(normalizedCandidates, extracted.payload);
      var injectedContextText = buildInjectedContextText(selectedItems);
      return normalizeState({
        baseUrl: baseUrl,
        enabled: true,
        workspaceId: input && input.workspaceId ? String(input.workspaceId || '') : '',
        queryKey: queryKey,
        latestRequestId: requestId,
        lastOperation: queryContext.operationType || '',
        validation: searchState.validation,
        ruleSearch: searchState.ruleSearch,
        aiFilter: {
          status: 'done',
          requestId: requestId,
          startedAt: searchState.aiFilter.startedAt,
          finishedAt: Date.now(),
          durationMs: Math.max(0, Date.now() - searchState.aiFilter.startedAt),
          reason: selectedItems.length
            ? ('AI 精筛保留 ' + String(selectedItems.length) + ' 条有效知识')
            : 'AI 精筛后未命中可注入知识',
          selectedCount: selectedItems.length,
        },
        candidates: normalizedCandidates,
        selectedItems: selectedItems,
        usedInLatestGeneration: selectedItems.length > 0 && Boolean(injectedContextText),
        injectedContextText: injectedContextText,
        warnings: searchState.warnings,
        updatedAt: Date.now(),
      });
    }

    function getStageLabel(status) {
      var stable = normalizeStageStatus(status);
      if (stable === 'pending') return '进行中';
      if (stable === 'done') return '已完成';
      if (stable === 'skipped') return '已跳过';
      if (stable === 'failed') return '失败';
      return '未启用';
    }

    function getStatusClass(status) {
      var stable = normalizeStageStatus(status);
      if (stable === 'pending') return 'is-running';
      if (stable === 'done') return 'is-done';
      if (stable === 'skipped') return 'is-skipped';
      if (stable === 'failed') return 'is-failed';
      return 'is-blocked';
    }

    function formatDuration(durationMs) {
      var value = Number(durationMs || 0);
      if (!Number.isFinite(value) || value <= 0) return '';
      if (value < 1000) return Math.round(value) + 'ms';
      return (value / 1000).toFixed(value >= 10000 ? 0 : 1) + 's';
    }

    function renderStageCard(title, stage) {
      var info = normalizeStageState(stage);
      var meta = [];
      var durationText = formatDuration(info.durationMs);
      if (durationText) meta.push('耗时 ' + durationText);
      if (info.candidateCount > 0) meta.push('候选 ' + String(info.candidateCount));
      if (info.selectedCount > 0) meta.push('保留 ' + String(info.selectedCount));
      return ''
        + '<div class="xmind-casegen-kb-stage-card">'
        +   '<div class="xmind-casegen-kb-stage-card-head">'
        +     '<strong class="xmind-casegen-kb-stage-title">' + escapeHtml(title) + '</strong>'
        +     '<span class="xmind-casegen-prep-status-badge ' + getStatusClass(info.status) + '">' + escapeHtml(getStageLabel(info.status)) + '</span>'
        +   '</div>'
        +   '<div class="xmind-casegen-kb-stage-meta">' + escapeHtml(meta.join(' · ') || '暂无执行记录') + '</div>'
        +   (info.reason || info.error
          ? '<div class="xmind-casegen-kb-stage-reason">' + escapeHtml(info.reason || info.error) + '</div>'
          : '')
        + '</div>';
    }

    function renderResultCard(item) {
      var entry = normalizeCandidateItem(item);
      var title = entry.module ? (entry.module + ' / ' + (entry.title || entry.heading || '知识条目')) : (entry.title || entry.heading || '知识条目');
      var matchedText = entry.matchedTerms && entry.matchedTerms.length ? entry.matchedTerms.join('、') : '';
      return ''
        + '<article class="xmind-casegen-kb-result-card">'
        +   '<div class="xmind-casegen-kb-result-head">'
        +     '<div class="xmind-casegen-kb-result-copy">'
        +       '<strong class="xmind-casegen-kb-result-title">' + escapeHtml(title) + '</strong>'
        +       '<div class="xmind-casegen-kb-result-meta">'
        +         (entry.relativePath ? '<span>' + escapeHtml(entry.relativePath) + '</span>' : '')
        +         (entry.score ? '<span>得分 ' + escapeHtml(String(entry.score)) + '</span>' : '')
        +       '</div>'
        +     '</div>'
        +   '</div>'
        +   (entry.reason ? '<div class="xmind-casegen-kb-result-reason">' + escapeHtml(entry.reason) + '</div>' : '')
        +   (matchedText ? '<div class="xmind-casegen-kb-chip-row">' + matchedText.split('、').map(function(text) {
              return '<span class="xmind-casegen-kb-chip">' + escapeHtml(text) + '</span>';
            }).join('') + '</div>' : '')
        +   '<div class="xmind-casegen-kb-result-snippet">' + escapeHtml(entry.documentExcerpt || entry.snippet || entry.summary || '暂无内容摘录') + '</div>'
        + '</article>';
    }

    function renderDialogHtml(value) {
      var kbState = normalizeState(value);
      var finalList = Array.isArray(kbState.selectedItems) ? kbState.selectedItems : [];
      var fallbackCandidates = Array.isArray(kbState.candidates) ? kbState.candidates.slice(0, 5) : [];
      var validationMeta = [];
      if (kbState.validation && kbState.validation.normalizedBaseUrl) {
        validationMeta.push('地址：' + kbState.validation.normalizedBaseUrl);
      }
      if (kbState.validation && kbState.validation.docCount > 0) {
        validationMeta.push('文档 ' + String(kbState.validation.docCount));
      }
      if (kbState.validation && kbState.validation.entryCount > 0) {
        validationMeta.push('索引 ' + String(kbState.validation.entryCount));
      }
      if (!kbState.enabled) {
        return '<div class="xmind-casegen-kb-empty">当前页签未启用共享知识库。保存合法地址后，生成前会自动执行规则检索与 AI 精筛。</div>';
      }
      return ''
        + '<div class="xmind-casegen-kb-dialog">'
        +   '<div class="xmind-casegen-kb-head">'
        +     '<div class="xmind-casegen-kb-head-meta">' + escapeHtml(validationMeta.join(' · ') || '知识库信息待确认') + '</div>'
        +     (kbState.usedInLatestGeneration ? '<span class="xmind-casegen-kb-used-badge">已使用知识库</span>' : '')
        +   '</div>'
        +   '<div class="xmind-casegen-kb-stage-grid">'
        +     renderStageCard('规则检索', kbState.ruleSearch)
        +     renderStageCard('AI 筛选', kbState.aiFilter)
        +   '</div>'
        +   (finalList.length
          ? '<div class="xmind-casegen-kb-section">'
              + '<div class="xmind-casegen-kb-section-head">'
              +   '<strong class="xmind-casegen-kb-section-title">最终筛选结果</strong>'
              +   '<span class="xmind-casegen-kb-section-desc">这些内容会作为知识库上下文注入本轮生成。</span>'
              + '</div>'
              + '<div class="xmind-casegen-kb-result-list">' + finalList.map(renderResultCard).join('') + '</div>'
            + '</div>'
          : '')
        +   (!finalList.length && fallbackCandidates.length
          ? '<div class="xmind-casegen-kb-section">'
              + '<div class="xmind-casegen-kb-section-head">'
              +   '<strong class="xmind-casegen-kb-section-title">规则候选</strong>'
              +   '<span class="xmind-casegen-kb-section-desc">当前没有最终注入内容，以下为规则检索命中的候选知识。</span>'
              + '</div>'
              + '<div class="xmind-casegen-kb-result-list">' + fallbackCandidates.map(renderResultCard).join('') + '</div>'
            + '</div>'
          : '')
        +   (!finalList.length && !fallbackCandidates.length
          ? '<div class="xmind-casegen-kb-empty">当前页签最近一次知识库链路没有筛出可用内容。</div>'
          : '')
        +   (kbState.warnings && kbState.warnings.length
          ? '<div class="xmind-casegen-kb-warning-list">' + kbState.warnings.map(function(text) {
              return '<div class="xmind-casegen-kb-warning-item">' + escapeHtml(text) + '</div>';
            }).join('') + '</div>'
          : '')
        + '</div>';
    }

    return {
      createDefaultState: createDefaultState,
      normalizeState: normalizeState,
      normalizeBaseUrl: normalizeBaseUrl,
      buildQueryKey: buildQueryKey,
      runPipeline: runPipeline,
      buildInjectedContextText: buildInjectedContextText,
      renderDialogHtml: renderDialogHtml,
      getStageLabel: getStageLabel,
    };
  }

  window.app = window.app || {};
  window.app.xmindKnowledgeBase = {
    init: init,
  };
})();
