(function() {
  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var config = ctx.config || (window.app && window.app.config) || {};
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

    var CATALOG_BATCH_SIZE = 60;
    var MAX_SELECTED_DOCS = 8;
    var MAX_SELECTED_SECTIONS = 8;
    var defaultSettings = config.defaultSettings || {};

    function clampPositiveNumber(value, fallback, min, max) {
      var num = Math.round(Number(value));
      var safeFallback = Math.round(Number(fallback));
      var lower = Math.round(Number(min || 0));
      var upper = Math.round(Number(max || 0));
      if (!Number.isFinite(safeFallback) || safeFallback <= 0) safeFallback = 1;
      if (!Number.isFinite(num) || num <= 0) num = safeFallback;
      if (Number.isFinite(lower) && lower > 0 && num < lower) num = lower;
      if (Number.isFinite(upper) && upper > 0 && num > upper) num = upper;
      return num;
    }

    function getKnowledgeBaseCatalogCharLimit() {
      var fallback = Number(config.defaultKnowledgeBaseCatalogCharLimit)
        || Number(defaultSettings.knowledgeBaseCatalogCharLimit)
        || 120000;
      var raw = state && state.settings ? state.settings.knowledgeBaseCatalogCharLimit : null;
      return clampPositiveNumber(
        raw,
        fallback,
        Number(config.minKnowledgeBaseCatalogCharLimit) || 20000,
        Number(config.maxKnowledgeBaseCatalogCharLimit) || 2000000
      );
    }

    function getKnowledgeBaseInjectedContextCharLimit() {
      var fallback = Number(config.defaultKnowledgeBaseInjectedContextCharLimit)
        || Number(defaultSettings.knowledgeBaseInjectedContextCharLimit)
        || 24000;
      var raw = state && state.settings ? state.settings.knowledgeBaseInjectedContextCharLimit : null;
      return clampPositiveNumber(
        raw,
        fallback,
        Number(config.minKnowledgeBaseInjectedContextCharLimit) || 4000,
        Number(config.maxKnowledgeBaseInjectedContextCharLimit) || 200000
      );
    }

    var cloneJson = window.app.jsonCloneCore.cloneJson;

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
        updatedAt: 0,
      };
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

    function normalizeCatalogItem(item) {
      var source = item && typeof item === 'object' ? item : {};
      return {
        docId: source.docId ? String(source.docId || '') : String(source.doc_id || ''),
        module: source.module ? String(source.module || '') : '',
        title: source.title ? String(source.title || '') : String(source.heading || ''),
        aliases: Array.isArray(source.aliases)
          ? source.aliases.map(function(text) { return String(text || '').trim(); }).filter(Boolean)
          : [],
        keywords: Array.isArray(source.keywords)
          ? source.keywords.map(function(text) { return String(text || '').trim(); }).filter(Boolean)
          : [],
        summary: source.summary ? String(source.summary || '') : String(source.snippet || ''),
        relativePath: source.relativePath ? String(source.relativePath || '') : String(source.relative_path || ''),
        cleanPath: source.cleanPath ? String(source.cleanPath || '') : String(source.clean_path || ''),
        sourceUrl: source.sourceUrl ? String(source.sourceUrl || '') : String(source.source_url || ''),
        headingSamples: Array.isArray(source.headingSamples)
          ? source.headingSamples.map(function(text) { return String(text || '').trim(); }).filter(Boolean)
          : (Array.isArray(source.heading_samples)
            ? source.heading_samples.map(function(text) { return String(text || '').trim(); }).filter(Boolean)
            : []),
        reason: source.reason ? String(source.reason || '') : '',
      };
    }

    function normalizeSectionItem(item) {
      var source = item && typeof item === 'object' ? item : {};
      var content = source.content ? String(source.content || '') : String(source.documentExcerpt || source.document_excerpt || source.snippet || '');
      return {
        sectionId: source.sectionId ? String(source.sectionId || '') : String(source.section_id || source.candidate_id || ''),
        docId: source.docId ? String(source.docId || '') : String(source.doc_id || ''),
        module: source.module ? String(source.module || '') : '',
        title: source.title ? String(source.title || '') : '',
        heading: source.heading ? String(source.heading || '') : String(source.title || ''),
        relativePath: source.relativePath ? String(source.relativePath || '') : String(source.relative_path || ''),
        cleanPath: source.cleanPath ? String(source.cleanPath || '') : String(source.clean_path || ''),
        sourceUrl: source.sourceUrl ? String(source.sourceUrl || '') : String(source.source_url || ''),
        content: content,
        charCount: Number(source.charCount || source.char_count || content.length || 0),
        reason: source.reason ? String(source.reason || '') : '',
      };
    }

    function firstArray() {
      for (var i = 0; i < arguments.length; i += 1) {
        if (Array.isArray(arguments[i])) return arguments[i];
      }
      return [];
    }

    function normalizeState(value) {
      var source = value && typeof value === 'object' ? value : {};
      var next = createDefaultState();
      var catalogSource = firstArray(source.catalogItems, source.selectedDocuments, source.candidates);
      var candidatesSource = firstArray(source.candidates, source.selectedDocuments, next.catalogItems);
      var selectedDocumentsSource = firstArray(source.selectedDocuments, source.catalogItems, source.candidates);
      var selectedSectionsSource = firstArray(source.selectedSections, source.selectedItems);
      next.baseUrl = normalizeBaseUrl(source.baseUrl || source.base_url || '');
      next.enabled = source.enabled === true || Boolean(next.baseUrl);
      next.workspaceId = source.workspaceId ? String(source.workspaceId || '') : String(source.workspace_id || '');
      next.queryKey = source.queryKey ? String(source.queryKey || '') : '';
      next.latestRequestId = source.latestRequestId ? String(source.latestRequestId || '') : '';
      next.lastOperation = source.lastOperation ? String(source.lastOperation || '') : '';
      next.validation = normalizeValidationState(source.validation);
      next.ruleSearch = normalizeStageState(source.ruleSearch, createStageState(next.enabled ? 'pending' : 'disabled'));
      next.aiFilter = normalizeStageState(source.aiFilter, createStageState(next.enabled ? 'skipped' : 'disabled'));
      next.catalogItems = catalogSource.map(normalizeCatalogItem);
      next.candidates = candidatesSource.map(normalizeCatalogItem);
      next.selectedDocuments = selectedDocumentsSource.map(normalizeCatalogItem);
      next.documentSections = (Array.isArray(source.documentSections) ? source.documentSections : []).map(normalizeDocumentResponseItem);
      next.selectedSections = selectedSectionsSource.map(normalizeSectionItem);
      next.selectedItems = next.selectedSections.map(function(item) { return cloneJson(item, item); });
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
        version: 3,
        baseUrl: baseUrl,
        requirementLabel: queryContext.requirementLabel ? String(queryContext.requirementLabel || '').trim() : '',
        requirementText: queryContext.requirementText ? String(queryContext.requirementText || '').trim() : '',
        requirementSupplement: queryContext.requirementSupplement ? String(queryContext.requirementSupplement || '').trim() : '',
        requirementMode: queryContext.requirementMode ? String(queryContext.requirementMode || '').trim() : '',
      });
    }

    function buildCatalogPayload(input) {
      return {
        base_url: normalizeBaseUrl(input && input.baseUrl ? input.baseUrl : ''),
        timeout_sec: input && input.timeoutSec ? Number(input.timeoutSec) : 15,
        force_refresh: input && input.forceRefresh === true,
        max_docs: input && input.maxDocs ? Number(input.maxDocs) : 300,
      };
    }

    function buildDocumentsPayload(input, docIds) {
      return {
        base_url: normalizeBaseUrl(input && input.baseUrl ? input.baseUrl : ''),
        timeout_sec: input && input.timeoutSec ? Number(input.timeoutSec) : 15,
        force_refresh: input && input.forceRefresh === true,
        doc_ids: Array.isArray(docIds) ? docIds.slice(0, MAX_SELECTED_DOCS) : [],
      };
    }

    function buildCatalogSelectionPrompt() {
      return [
        '你是共享知识库目录检索助手，只负责从知识库目录元数据里选出与当前整份需求最相关的文档。',
        '本次筛选服务于整份需求的 XMind 用例生成，不需要按模块分别返回结果。',
        '只输出合法 JSON，不要输出解释、备注、Markdown 或代码块围栏。',
        '输出结构固定为：{"selected_doc_ids":["doc-1"],"items":[{"doc_id":"doc-1","reason":"关联原因"}]}。',
        '规则：',
        '1、只能使用输入目录中已有的 doc_id，不能编造。',
        '2、优先选择能直接指导规则、和目标需求有直接关联或依赖的系统、和目标需求有间接关联或依赖的系统、限制、状态流转、边界、异常、数值逻辑、前置条件的文档。',
        '3、目录型、总览型、泛介绍且与当前需求没有直接指导价值的文档不要选。',
        '4、最多选择 8 篇；如果没有明显相关文档，返回空数组。',
      ].join('\n');
    }

    function buildCatalogSelectionUserText(queryContext, catalogItems) {
      return [
        '【需求上下文(JSON)】',
        JSON.stringify({
          requirementLabel: queryContext.requirementLabel || '',
          requirementText: queryContext.requirementText || '',
          requirementSupplement: queryContext.requirementSupplement || '',
          requirementMode: queryContext.requirementMode || '',
          operationType: queryContext.operationType || '',
        }, null, 2),
        '【知识库目录(JSON)】',
        JSON.stringify((Array.isArray(catalogItems) ? catalogItems : []).map(function(item) {
          return {
            doc_id: item.docId,
            module: item.module,
            title: item.title,
            aliases: item.aliases,
            keywords: item.keywords,
            summary: item.summary,
            relative_path: item.relativePath,
            heading_samples: item.headingSamples,
          };
        }), null, 2),
      ].join('\n\n');
    }

    function buildSectionFilterPrompt() {
      return [
        '你是共享知识库正文精筛助手，只负责从已选知识文档的 section 中筛出可注入本轮 XMind 用例生成的内容。',
        '本次筛选服务于整份需求的用例生成，不需要按模块拆分结果。',
        '只输出合法 JSON，不要输出解释、备注、Markdown 或代码块围栏。',
        '输出结构固定为：{"selected_sections":["doc-1::section-1"],"items":[{"section_id":"doc-1::section-1","reason":"关联原因"}]}。',
        '规则：',
        '1、只保留与当前需求直接相关、能指导模块拆分或用例设计的正文片段。',
        '2、优先保留规则、限制、状态、边界、异常、数值、前置条件、互斥条件、恢复/回滚机制等知识。',
        '3、重复、泛介绍、目录说明、噪声内容必须剔除。',
        '4、最多选择 8 个 section；如果没有明显相关内容，返回空数组。',
        '5、section_id 必须来自输入正文列表，不能编造。',
      ].join('\n');
    }

    function buildSectionFilterUserText(queryContext, documents) {
      return [
        '【需求上下文(JSON)】',
        JSON.stringify({
          requirementLabel: queryContext.requirementLabel || '',
          requirementText: queryContext.requirementText || '',
          requirementSupplement: queryContext.requirementSupplement || '',
          requirementMode: queryContext.requirementMode || '',
          operationType: queryContext.operationType || '',
        }, null, 2),
        '【知识文档正文(JSON)】',
        JSON.stringify((Array.isArray(documents) ? documents : []).map(function(doc) {
          return {
            doc_id: doc.docId,
            module: doc.module,
            title: doc.title,
            relative_path: doc.relativePath,
            sections: (Array.isArray(doc.sections) ? doc.sections : []).map(function(section) {
              return {
                section_id: section.sectionId,
                heading: section.heading,
                content: section.content,
              };
            }),
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

    function emitState(handler, value) {
      if (typeof handler !== 'function') return;
      try {
        handler(normalizeState(value));
      } catch (err) {
        // ignore
      }
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
          reason: baseUrl ? '等待知识检索完成' : '未启用知识库',
        },
        updatedAt: now,
      });
    }

    function buildFailedState(input, pendingState, stage, message, extra) {
      var baseUrl = normalizeBaseUrl(input && input.baseUrl ? input.baseUrl : '');
      var requestId = input && input.requestId ? String(input.requestId || '') : '';
      var queryContext = input && input.queryContext && typeof input.queryContext === 'object'
        ? input.queryContext
        : {};
      var now = Date.now();
      var source = extra && typeof extra === 'object' ? extra : {};
      var validationState = cloneJson(source.validation, null) || {
        status: 'failed',
        normalizedBaseUrl: baseUrl,
        checkedAt: now,
        error: message,
      };
      if (stage === 'ruleSearch') {
        return normalizeState({
          baseUrl: baseUrl,
          enabled: true,
          workspaceId: input && input.workspaceId ? String(input.workspaceId || '') : '',
          queryKey: buildQueryKey({ baseUrl: baseUrl, queryContext: queryContext }),
          latestRequestId: requestId,
          lastOperation: queryContext.operationType || '',
          validation: validationState,
          ruleSearch: {
            status: 'failed',
            requestId: requestId,
            startedAt: pendingState && pendingState.ruleSearch ? pendingState.ruleSearch.startedAt : 0,
            finishedAt: now,
            durationMs: Math.max(0, now - Number(pendingState && pendingState.ruleSearch ? pendingState.ruleSearch.startedAt : 0)),
            reason: message,
            error: message,
            candidateCount: source.ruleSearch && source.ruleSearch.candidateCount ? source.ruleSearch.candidateCount : 0,
            selectedCount: source.ruleSearch && source.ruleSearch.selectedCount ? source.ruleSearch.selectedCount : 0,
          },
          aiFilter: {
            status: 'skipped',
            requestId: requestId,
            reason: '知识检索失败，已跳过 AI 筛选',
          },
          catalogItems: source.catalogItems || [],
          candidates: source.selectedDocuments || source.catalogItems || [],
          selectedDocuments: source.selectedDocuments || [],
          warnings: source.warnings || [],
          latestError: message,
          updatedAt: now,
        });
      }
      var aiStartedAt = source.aiStartedAt || (source.aiFilter && source.aiFilter.startedAt) || now;
      return normalizeState({
        baseUrl: baseUrl,
        enabled: true,
        workspaceId: input && input.workspaceId ? String(input.workspaceId || '') : '',
        queryKey: buildQueryKey({ baseUrl: baseUrl, queryContext: queryContext }),
        latestRequestId: requestId,
        lastOperation: queryContext.operationType || '',
        validation: validationState,
        ruleSearch: source.ruleSearch || {},
        aiFilter: {
          status: 'failed',
          requestId: requestId,
          startedAt: aiStartedAt,
          finishedAt: now,
          durationMs: Math.max(0, now - Number(aiStartedAt || 0)),
          reason: message,
          error: message,
          candidateCount: source.aiFilter && source.aiFilter.candidateCount ? source.aiFilter.candidateCount : 0,
          selectedCount: source.aiFilter && source.aiFilter.selectedCount ? source.aiFilter.selectedCount : 0,
        },
        catalogItems: source.catalogItems || [],
        candidates: source.selectedDocuments || source.catalogItems || [],
        selectedDocuments: source.selectedDocuments || [],
        documentSections: source.documentSections || [],
        selectedSections: [],
        selectedItems: [],
        warnings: source.warnings || [],
        latestError: message,
        updatedAt: now,
      });
    }

    async function callModelForJson(input, prompt, userText, parseErrorMessage) {
      if (!input || !input.model || typeof input.callModel !== 'function') {
        throw new Error('当前 XMind 生成模型不可用，已跳过知识库注入');
      }
      var rawText = await input.callModel(
        input.model,
        userText,
        prompt,
        input.reasoning || '',
        input.temperature
      );
      var extracted = extractJsonPayloadDetailed(rawText);
      if (!extracted.payload || typeof extracted.payload !== 'object') {
        throw new Error(parseErrorMessage);
      }
      return extracted.payload;
    }

    function mapSelectedDocuments(items, parsed) {
      var list = Array.isArray(items) ? items.map(normalizeCatalogItem) : [];
      var lookup = {};
      list.forEach(function(item) {
        if (!item || !item.docId) return;
        lookup[item.docId] = item;
      });
      var orderedIds = [];
      var reasonMap = {};
      if (parsed && Array.isArray(parsed.selected_doc_ids)) {
        parsed.selected_doc_ids.forEach(function(raw) {
          var docId = String(raw || '').trim();
          if (docId) orderedIds.push(docId);
        });
      }
      if (parsed && Array.isArray(parsed.doc_ids)) {
        parsed.doc_ids.forEach(function(raw) {
          var docId = String(raw || '').trim();
          if (docId) orderedIds.push(docId);
        });
      }
      if (parsed && Array.isArray(parsed.items)) {
        parsed.items.forEach(function(item) {
          if (!item || typeof item !== 'object') return;
          var docId = String(item.doc_id || item.docId || '').trim();
          if (!docId) return;
          orderedIds.push(docId);
          reasonMap[docId] = String(item.reason || '').trim();
        });
      }
      var result = [];
      var seen = {};
      orderedIds.forEach(function(docId) {
        if (!docId || seen[docId] || !lookup[docId]) return;
        seen[docId] = true;
        var entry = cloneJson(lookup[docId], null);
        if (!entry) return;
        entry.reason = reasonMap[docId] || entry.reason || '';
        result.push(normalizeCatalogItem(entry));
      });
      return result.slice(0, MAX_SELECTED_DOCS);
    }

    function normalizeDocumentResponseItem(item) {
      var source = item && typeof item === 'object' ? item : {};
      return {
        docId: source.docId ? String(source.docId || '') : String(source.doc_id || ''),
        module: source.module ? String(source.module || '') : '',
        title: source.title ? String(source.title || '') : '',
        relativePath: source.relativePath ? String(source.relativePath || '') : String(source.relative_path || ''),
        cleanPath: source.cleanPath ? String(source.cleanPath || '') : String(source.clean_path || ''),
        sourceUrl: source.sourceUrl ? String(source.sourceUrl || '') : String(source.source_url || ''),
        sections: (Array.isArray(source.sections) ? source.sections : []).map(function(section) {
          return normalizeSectionItem({
            section_id: section && (section.section_id || section.sectionId),
            doc_id: source.docId || source.doc_id,
            module: source.module,
            title: source.title,
            heading: section && (section.heading || ''),
            relative_path: source.relativePath || source.relative_path,
            clean_path: source.cleanPath || source.clean_path,
            source_url: source.sourceUrl || source.source_url,
            content: section && (section.content || ''),
            char_count: section && (section.char_count || section.charCount || 0),
          });
        }),
      };
    }

    function mapSelectedSections(documents, parsed) {
      var list = Array.isArray(documents) ? documents : [];
      var sectionLookup = {};
      list.forEach(function(doc) {
        (Array.isArray(doc.sections) ? doc.sections : []).forEach(function(section) {
          if (!section || !section.sectionId) return;
          sectionLookup[section.sectionId] = section;
        });
      });
      var orderedIds = [];
      var reasonMap = {};
      if (parsed && Array.isArray(parsed.selected_sections)) {
        parsed.selected_sections.forEach(function(raw) {
          var sectionId = String(raw || '').trim();
          if (sectionId) orderedIds.push(sectionId);
        });
      }
      if (parsed && Array.isArray(parsed.section_ids)) {
        parsed.section_ids.forEach(function(raw) {
          var sectionId = String(raw || '').trim();
          if (sectionId) orderedIds.push(sectionId);
        });
      }
      if (parsed && Array.isArray(parsed.items)) {
        parsed.items.forEach(function(item) {
          if (!item || typeof item !== 'object') return;
          var sectionId = String(item.section_id || item.sectionId || '').trim();
          if (!sectionId) return;
          orderedIds.push(sectionId);
          reasonMap[sectionId] = String(item.reason || '').trim();
        });
      }
      var result = [];
      var seen = {};
      orderedIds.forEach(function(sectionId) {
        if (!sectionId || seen[sectionId] || !sectionLookup[sectionId]) return;
        seen[sectionId] = true;
        var entry = cloneJson(sectionLookup[sectionId], null);
        if (!entry) return;
        entry.reason = reasonMap[sectionId] || entry.reason || '';
        result.push(normalizeSectionItem(entry));
      });
      return result.slice(0, MAX_SELECTED_SECTIONS);
    }

    async function selectDocumentsOnce(input, queryContext, catalogItems) {
      var parsed = await callModelForJson(
        input,
        buildCatalogSelectionPrompt(),
        buildCatalogSelectionUserText(queryContext, catalogItems),
        'AI 目录检索返回结果无法解析为 JSON'
      );
      return mapSelectedDocuments(catalogItems, parsed);
    }

    async function selectDocumentsFromCatalog(input, queryContext, catalogItems) {
      var list = Array.isArray(catalogItems) ? catalogItems.map(normalizeCatalogItem) : [];
      if (!list.length) return [];
      var serializedLength = 0;
      var catalogCharLimit = getKnowledgeBaseCatalogCharLimit();
      try {
        serializedLength = JSON.stringify(list).length;
      } catch (err) {
        serializedLength = 0;
      }
      if (serializedLength <= catalogCharLimit) {
        return selectDocumentsOnce(input, queryContext, list);
      }
      var batchSelections = [];
      var batchLookup = {};
      for (var offset = 0; offset < list.length; offset += CATALOG_BATCH_SIZE) {
        var batch = list.slice(offset, offset + CATALOG_BATCH_SIZE);
        if (!batch.length) continue;
        var selected = await selectDocumentsOnce(input, queryContext, batch);
        selected.forEach(function(item) {
          if (!item || !item.docId || batchLookup[item.docId]) return;
          batchLookup[item.docId] = true;
          batchSelections.push(item);
        });
      }
      if (!batchSelections.length) return [];
      return selectDocumentsOnce(input, queryContext, batchSelections);
    }

    function buildInjectedContextResult(selectedSections) {
      var list = Array.isArray(selectedSections) ? selectedSections.map(normalizeSectionItem) : [];
      if (!list.length) {
        return {
          text: '',
          includedCount: 0,
          truncatedCount: 0,
          limit: getKnowledgeBaseInjectedContextCharLimit(),
        };
      }
      var contextCharLimit = getKnowledgeBaseInjectedContextCharLimit();
      var parts = [
        '【知识库上下文】',
        '以下内容来自共享知识库，仅作为本轮 XMind 用例生成的补充上下文，请优先结合当前需求判断，不要机械照抄无关内容。'
      ];
      var totalChars = parts.join('\n').length;
      var includedCount = 0;
      var truncatedCount = 0;
      for (var i = 0; i < list.length; i += 1) {
        var item = list[i];
        var lines = [];
        lines.push(String(i + 1) + '、' + (item.module ? (item.module + ' / ') : '') + (item.title || '知识文档'));
        if (item.heading) lines.push('章节：' + item.heading);
        if (item.reason) lines.push('关联原因：' + item.reason);
        if (item.relativePath) lines.push('来源：' + item.relativePath);
        if (item.content) lines.push('正文：' + item.content);
        var block = lines.join('\n');
        if (!block) continue;
        if (totalChars + block.length > contextCharLimit && includedCount > 0) {
          truncatedCount = list.length - i;
          break;
        }
        parts.push(block);
        totalChars += block.length;
        includedCount += 1;
      }
      return {
        text: parts.join('\n\n'),
        includedCount: includedCount,
        truncatedCount: truncatedCount,
        limit: contextCharLimit,
      };
    }

    function buildInjectedContextText(selectedSections) {
      return buildInjectedContextResult(selectedSections).text;
    }

    async function runPipeline(input) {
      var baseUrl = normalizeBaseUrl(input && input.baseUrl ? input.baseUrl : '');
      var requestId = input && input.requestId ? String(input.requestId || '') : '';
      var queryContext = input && input.queryContext && typeof input.queryContext === 'object'
        ? input.queryContext
        : {};
      var pendingState = makePendingState(input);
      emitState(input && input.onStateChange, pendingState);
      if (!baseUrl) return pendingState;

      if (
        !apiClient
        || typeof apiClient.catalogKnowledgeBase !== 'function'
        || typeof apiClient.getKnowledgeBaseDocuments !== 'function'
      ) {
        return buildFailedState(input, pendingState, 'ruleSearch', '知识库接口不可用，请刷新页面后重试');
      }

      var catalogResponse = null;
      try {
        catalogResponse = await apiClient.catalogKnowledgeBase(buildCatalogPayload(input));
      } catch (err) {
        return buildFailedState(
          input,
          pendingState,
          'ruleSearch',
          err && err.message ? err.message : '知识检索失败'
        );
      }

      var catalogItems = (catalogResponse && Array.isArray(catalogResponse.documents)
        ? catalogResponse.documents
        : []).map(normalizeCatalogItem);
      var catalogFinishedAt = Date.now();
      var validationState = {
        status: 'done',
        normalizedBaseUrl: catalogResponse && catalogResponse.normalized_base_url
          ? String(catalogResponse.normalized_base_url || '')
          : baseUrl,
        checkedAt: catalogFinishedAt,
        docCount: catalogResponse && catalogResponse.manifest ? Number(catalogResponse.manifest.doc_count || 0) : catalogItems.length,
        entryCount: catalogResponse && catalogResponse.manifest ? Number(catalogResponse.manifest.entry_count || 0) : 0,
      };
      var warnings = catalogResponse && Array.isArray(catalogResponse.warnings) ? catalogResponse.warnings : [];

      if (!catalogItems.length) {
        return normalizeState({
          baseUrl: baseUrl,
          enabled: true,
          workspaceId: input && input.workspaceId ? String(input.workspaceId || '') : '',
          queryKey: buildQueryKey({ baseUrl: baseUrl, queryContext: queryContext }),
          latestRequestId: requestId,
          lastOperation: queryContext.operationType || '',
          validation: validationState,
          ruleSearch: {
            status: 'done',
            requestId: requestId,
            startedAt: pendingState.ruleSearch.startedAt,
            finishedAt: catalogFinishedAt,
            durationMs: Math.max(0, catalogFinishedAt - pendingState.ruleSearch.startedAt),
            reason: '知识库目录为空或当前目录没有可用文档',
            candidateCount: 0,
            selectedCount: 0,
          },
          aiFilter: {
            status: 'skipped',
            requestId: requestId,
            reason: '知识检索未命中相关文档，已跳过 AI 筛选',
          },
          warnings: warnings,
          updatedAt: Date.now(),
        });
      }

      var selectedDocuments = [];
      try {
        selectedDocuments = await selectDocumentsFromCatalog(input, queryContext, catalogItems);
      } catch (err2) {
        return buildFailedState(
          input,
          pendingState,
          'ruleSearch',
          err2 && err2.message ? err2.message : '知识检索失败',
          {
            validation: validationState,
            catalogItems: catalogItems,
            warnings: warnings,
          }
        );
      }

      var ruleFinishedAt = Date.now();
      var ruleSearchState = {
        status: 'done',
        requestId: requestId,
        startedAt: pendingState.ruleSearch.startedAt,
        finishedAt: ruleFinishedAt,
        durationMs: Math.max(0, ruleFinishedAt - pendingState.ruleSearch.startedAt),
        reason: selectedDocuments.length
          ? ('知识库目录 ' + String(catalogItems.length) + ' 篇，AI 初筛选中 ' + String(selectedDocuments.length) + ' 篇文档')
          : ('知识库目录 ' + String(catalogItems.length) + ' 篇，AI 未选中相关文档'),
        candidateCount: catalogItems.length,
        selectedCount: selectedDocuments.length,
      };

      var searchState = normalizeState({
        baseUrl: baseUrl,
        enabled: true,
        workspaceId: input && input.workspaceId ? String(input.workspaceId || '') : '',
        queryKey: buildQueryKey({ baseUrl: baseUrl, queryContext: queryContext }),
        latestRequestId: requestId,
        lastOperation: queryContext.operationType || '',
        validation: validationState,
        ruleSearch: ruleSearchState,
        aiFilter: {
          status: selectedDocuments.length ? 'pending' : 'skipped',
          requestId: requestId,
          startedAt: selectedDocuments.length ? Date.now() : 0,
          reason: selectedDocuments.length ? '正在拉取知识文档并执行 AI 正文精筛' : '知识检索未选中相关文档，已跳过 AI 筛选',
        },
        catalogItems: selectedDocuments,
        candidates: selectedDocuments,
        selectedDocuments: selectedDocuments,
        warnings: warnings,
        updatedAt: Date.now(),
      });
      emitState(input && input.onStateChange, searchState);

      if (!selectedDocuments.length) {
        return searchState;
      }

      var documentsResponse = null;
      try {
        documentsResponse = await apiClient.getKnowledgeBaseDocuments(
          buildDocumentsPayload(input, selectedDocuments.map(function(item) { return item.docId; }))
        );
      } catch (err3) {
        return buildFailedState(
          input,
          pendingState,
          'aiFilter',
          err3 && err3.message ? err3.message : '读取知识文档失败',
          {
            validation: validationState,
            ruleSearch: ruleSearchState,
            catalogItems: selectedDocuments,
            selectedDocuments: selectedDocuments,
            aiStartedAt: searchState.aiFilter.startedAt,
            warnings: warnings,
          }
        );
      }

      var documentSections = (documentsResponse && Array.isArray(documentsResponse.documents)
        ? documentsResponse.documents
        : []).map(normalizeDocumentResponseItem);
      var documentWarnings = warnings.slice();
      if (documentsResponse && Array.isArray(documentsResponse.warnings)) {
        documentsResponse.warnings.forEach(function(text) {
          var item = String(text || '').trim();
          if (item && documentWarnings.indexOf(item) === -1) documentWarnings.push(item);
        });
      }

      if (!documentSections.length) {
        return normalizeState({
          baseUrl: baseUrl,
          enabled: true,
          workspaceId: input && input.workspaceId ? String(input.workspaceId || '') : '',
          queryKey: buildQueryKey({ baseUrl: baseUrl, queryContext: queryContext }),
          latestRequestId: requestId,
          lastOperation: queryContext.operationType || '',
          validation: validationState,
          ruleSearch: ruleSearchState,
          aiFilter: {
            status: 'done',
            requestId: requestId,
            startedAt: searchState.aiFilter.startedAt,
            finishedAt: Date.now(),
            durationMs: Math.max(0, Date.now() - searchState.aiFilter.startedAt),
            reason: '已选文档没有可用正文片段，未注入知识库',
            candidateCount: selectedDocuments.length,
            selectedCount: 0,
          },
          catalogItems: selectedDocuments,
          candidates: selectedDocuments,
          selectedDocuments: selectedDocuments,
          documentSections: [],
          selectedSections: [],
          selectedItems: [],
          warnings: documentWarnings,
          updatedAt: Date.now(),
        });
      }

      var parsedSectionSelection = null;
      try {
        parsedSectionSelection = await callModelForJson(
          input,
          buildSectionFilterPrompt(),
          buildSectionFilterUserText(queryContext, documentSections),
          'AI 正文精筛返回结果无法解析为 JSON'
        );
      } catch (err4) {
        return buildFailedState(
          input,
          pendingState,
          'aiFilter',
          err4 && err4.message ? err4.message : 'AI 筛选失败',
          {
            validation: validationState,
            ruleSearch: ruleSearchState,
            catalogItems: selectedDocuments,
            selectedDocuments: selectedDocuments,
            documentSections: documentSections,
            aiStartedAt: searchState.aiFilter.startedAt,
            warnings: documentWarnings,
          }
        );
      }

      var selectedSections = mapSelectedSections(documentSections, parsedSectionSelection);
      var injectedContextResult = buildInjectedContextResult(selectedSections);
      var finalWarnings = documentWarnings.slice();
      if (injectedContextResult.truncatedCount > 0) {
        finalWarnings.push(
          '知识库上下文超出当前注入上限（' + String(injectedContextResult.limit) + ' 字符），已注入 '
            + String(injectedContextResult.includedCount)
            + ' 个片段，剩余 '
            + String(injectedContextResult.truncatedCount)
            + ' 个片段未注入；可在设置中提升知识库注入上限后重试'
        );
      }
      return normalizeState({
        baseUrl: baseUrl,
        enabled: true,
        workspaceId: input && input.workspaceId ? String(input.workspaceId || '') : '',
        queryKey: buildQueryKey({ baseUrl: baseUrl, queryContext: queryContext }),
        latestRequestId: requestId,
        lastOperation: queryContext.operationType || '',
        validation: validationState,
        ruleSearch: ruleSearchState,
        aiFilter: {
          status: 'done',
          requestId: requestId,
          startedAt: searchState.aiFilter.startedAt,
          finishedAt: Date.now(),
          durationMs: Math.max(0, Date.now() - searchState.aiFilter.startedAt),
          reason: selectedSections.length
            ? ('AI 精筛保留 ' + String(selectedSections.length) + ' 个正文片段')
            : 'AI 精筛后未命中可注入知识片段',
          candidateCount: selectedDocuments.length,
          selectedCount: selectedSections.length,
        },
        catalogItems: selectedDocuments,
        candidates: selectedDocuments,
        selectedDocuments: selectedDocuments,
        documentSections: documentSections,
        selectedSections: selectedSections,
        selectedItems: selectedSections,
        usedInLatestGeneration: selectedSections.length > 0 && Boolean(injectedContextResult.text),
        injectedContextText: injectedContextResult.text,
        warnings: finalWarnings,
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

    function renderDocumentCard(item) {
      var entry = normalizeCatalogItem(item);
      var title = entry.module ? (entry.module + ' / ' + (entry.title || '知识文档')) : (entry.title || '知识文档');
      var chips = entry.keywords.concat(entry.headingSamples || []).slice(0, 6);
      return ''
        + '<article class="xmind-casegen-kb-result-card">'
        +   '<div class="xmind-casegen-kb-result-head">'
        +     '<div class="xmind-casegen-kb-result-copy">'
        +       '<strong class="xmind-casegen-kb-result-title">' + escapeHtml(title) + '</strong>'
        +       '<div class="xmind-casegen-kb-result-meta">'
        +         (entry.relativePath ? '<span>' + escapeHtml(entry.relativePath) + '</span>' : '')
        +       '</div>'
        +     '</div>'
        +   '</div>'
        +   (entry.reason ? '<div class="xmind-casegen-kb-result-reason">' + escapeHtml(entry.reason) + '</div>' : '')
        +   (chips.length
          ? '<div class="xmind-casegen-kb-chip-row">' + chips.map(function(text) {
              return '<span class="xmind-casegen-kb-chip">' + escapeHtml(text) + '</span>';
            }).join('') + '</div>'
          : '')
        +   '<div class="xmind-casegen-kb-result-snippet">' + escapeHtml(entry.summary || '暂无文档摘要') + '</div>'
        + '</article>';
    }

    function renderSectionCard(item) {
      var entry = normalizeSectionItem(item);
      var title = entry.module ? (entry.module + ' / ' + (entry.title || '知识文档')) : (entry.title || '知识文档');
      return ''
        + '<article class="xmind-casegen-kb-result-card">'
        +   '<div class="xmind-casegen-kb-result-head">'
        +     '<div class="xmind-casegen-kb-result-copy">'
        +       '<strong class="xmind-casegen-kb-result-title">' + escapeHtml(title) + '</strong>'
        +       '<div class="xmind-casegen-kb-result-meta">'
        +         (entry.heading ? '<span>' + escapeHtml(entry.heading) + '</span>' : '')
        +         (entry.relativePath ? '<span>' + escapeHtml(entry.relativePath) + '</span>' : '')
        +       '</div>'
        +     '</div>'
        +   '</div>'
        +   (entry.reason ? '<div class="xmind-casegen-kb-result-reason">' + escapeHtml(entry.reason) + '</div>' : '')
        +   '<div class="xmind-casegen-kb-result-snippet">' + escapeHtml(entry.content || '暂无正文内容') + '</div>'
        + '</article>';
    }

    function renderDialogHtml(value) {
      var kbState = normalizeState(value);
      var selectedDocuments = Array.isArray(kbState.selectedDocuments) ? kbState.selectedDocuments : [];
      var selectedSections = Array.isArray(kbState.selectedSections) ? kbState.selectedSections : [];
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
        return '<div class="xmind-casegen-kb-empty">当前页签未启用共享知识库。保存合法地址后，生成前会自动执行知识检索与 AI 筛选。</div>';
      }
      return ''
        + '<div class="xmind-casegen-kb-dialog">'
        +   '<div class="xmind-casegen-kb-head">'
        +     '<div class="xmind-casegen-kb-head-meta">' + escapeHtml(validationMeta.join(' · ') || '知识库信息待确认') + '</div>'
        +     (kbState.usedInLatestGeneration ? '<span class="xmind-casegen-kb-used-badge">已使用知识库</span>' : '')
        +   '</div>'
        +   '<div class="xmind-casegen-kb-stage-grid">'
        +     renderStageCard('知识检索', kbState.ruleSearch)
        +     renderStageCard('AI 筛选', kbState.aiFilter)
        +   '</div>'
        +   (selectedDocuments.length
          ? '<div class="xmind-casegen-kb-section">'
              + '<div class="xmind-casegen-kb-section-head">'
              +   '<strong class="xmind-casegen-kb-section-title">已选知识文档</strong>'
              +   '<span class="xmind-casegen-kb-section-desc">目录获取后，AI 首轮选中的相关文档。</span>'
              + '</div>'
              + '<div class="xmind-casegen-kb-result-list">' + selectedDocuments.map(renderDocumentCard).join('') + '</div>'
            + '</div>'
          : '')
        +   (selectedSections.length
          ? '<div class="xmind-casegen-kb-section">'
              + '<div class="xmind-casegen-kb-section-head">'
              +   '<strong class="xmind-casegen-kb-section-title">最终知识片段</strong>'
              +   '<span class="xmind-casegen-kb-section-desc">这些正文片段会作为知识库上下文注入本轮生成。</span>'
              + '</div>'
              + '<div class="xmind-casegen-kb-result-list">' + selectedSections.map(renderSectionCard).join('') + '</div>'
              + (kbState.injectedContextText
                ? '<div class="xmind-casegen-kb-stage-card"><div class="xmind-casegen-kb-stage-card-head"><strong class="xmind-casegen-kb-stage-title">注入预览</strong></div><div class="xmind-casegen-kb-result-snippet">' + escapeHtml(kbState.injectedContextText) + '</div></div>'
                : '')
            + '</div>'
          : '')
        +   (!selectedDocuments.length && !selectedSections.length
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
