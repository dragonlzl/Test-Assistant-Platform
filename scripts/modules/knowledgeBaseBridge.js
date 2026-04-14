(function() {
  window.app = window.app || {};

  function init(ctx) {
    ctx = ctx || {};
    var runtimeApi = ctx.api || null;
    var clientApi = window.app && window.app.apiClient ? window.app.apiClient : null;
    var api = runtimeApi;
    if ((!api || typeof api.queryKnowledgeBase !== 'function') && clientApi) {
      api = clientApi;
    }

    function normalizeBaseUrl(value) {
      var text = String(value || '').trim();
      if (!text) return '';
      while (text.length > 1 && text.charAt(text.length - 1) === '/') {
        text = text.slice(0, -1);
      }
      return text;
    }

    function isValidBaseUrl(value) {
      var text = normalizeBaseUrl(value);
      if (!text) return false;
      try {
        var parsed = new URL(text);
        var protocol = String(parsed.protocol || '').toLowerCase();
        return (protocol === 'http:' || protocol === 'https:') && Boolean(parsed.host);
      } catch (err) {
        return false;
      }
    }

    function buildQuerySignature(payload) {
      var body = payload && typeof payload === 'object' ? payload : {};
      return JSON.stringify({
        base_url: normalizeBaseUrl(body.base_url || body.baseUrl || ''),
        requirement_label: String(body.requirement_label || '').trim(),
        requirement_text: String(body.requirement_text || '').trim(),
        module_title: String(body.module_title || '').trim(),
        action_scope: String(body.action_scope || '').trim(),
        action_mode: String(body.action_mode || '').trim(),
      });
    }

    function normalizeHit(item) {
      var hit = item && typeof item === 'object' ? item : {};
      return {
        doc_id: String(hit.doc_id || ''),
        module: String(hit.module || ''),
        title: String(hit.title || ''),
        heading: String(hit.heading || ''),
        clean_path: String(hit.clean_path || ''),
        score: Number(hit.score || 0) || 0,
        reasons: Array.isArray(hit.reasons) ? hit.reasons.map(function(reason) {
          return String(reason || '');
        }).filter(Boolean) : [],
        used: hit.used === true,
      };
    }

    function normalizeManifestMeta(value) {
      var meta = value && typeof value === 'object' ? value : {};
      return {
        base_url: String(meta.base_url || ''),
        version: meta.version === undefined ? null : meta.version,
        generated_at: String(meta.generated_at || ''),
        index_path: String(meta.index_path || ''),
        docs_dir: String(meta.docs_dir || ''),
        doc_count: Number(meta.doc_count || 0) || 0,
        entry_count: Number(meta.entry_count || 0) || 0,
      };
    }

    function normalizeResult(raw, extra) {
      var result = raw && typeof raw === 'object' ? raw : {};
      var patch = extra && typeof extra === 'object' ? extra : {};
      return {
        used: result.used === true,
        status: String(result.status || patch.status || 'disabled'),
        reason: String(result.reason || patch.reason || ''),
        match_count: Number(result.match_count || 0) || 0,
        used_chunk_count: Number(result.used_chunk_count || 0) || 0,
        used_doc_count: Number(result.used_doc_count || 0) || 0,
        context_text: String(result.context_text || ''),
        hits: Array.isArray(result.hits) ? result.hits.map(normalizeHit) : [],
        manifest_meta: normalizeManifestMeta(result.manifest_meta),
        base_url: normalizeBaseUrl(
          patch.base_url || patch.baseUrl || (result.manifest_meta && result.manifest_meta.base_url) || ''
        ),
        query_signature: String(patch.query_signature || ''),
        prep_signature: String(patch.prep_signature || ''),
        scope: String(patch.scope || ''),
        action_mode: String(patch.action_mode || ''),
        module_title: String(patch.module_title || ''),
        updated_at: Number(patch.updated_at || Date.now()) || Date.now(),
      };
    }

    function canUseResult(result) {
      var normalized = normalizeResult(result);
      return normalized.status === 'ok' && normalized.used === true && Boolean(normalized.context_text);
    }

    function buildPromptSections(result) {
      var normalized = normalizeResult(result);
      if (!canUseResult(normalized)) return [];
      var hits = normalized.hits.slice(0, 20).map(function(item) {
        return {
          doc_id: item.doc_id,
          module: item.module,
          title: item.title,
          heading: item.heading,
          score: item.score,
          used: item.used,
          reasons: item.reasons,
        };
      });
      var summary = {
        used: normalized.used,
        status: normalized.status,
        reason: normalized.reason,
        match_count: normalized.match_count,
        used_chunk_count: normalized.used_chunk_count,
        used_doc_count: normalized.used_doc_count,
        module_title: normalized.module_title,
        action_scope: normalized.scope,
        action_mode: normalized.action_mode,
        manifest_meta: normalized.manifest_meta,
        hits: hits,
      };
      return [
        '【知识库检索结果(JSON)】\n' + JSON.stringify(summary, null, 2),
        '【知识库相关内容】\n' + normalized.context_text,
      ];
    }

    function queryKnowledgeBase(payload) {
      var body = payload && typeof payload === 'object' ? payload : {};
      if (!api || typeof api.queryKnowledgeBase !== 'function') {
        return Promise.resolve(normalizeResult({
          used: false,
          status: 'disabled',
          reason: '知识库查询接口不可用',
          match_count: 0,
          used_chunk_count: 0,
          used_doc_count: 0,
          context_text: '',
          hits: [],
          manifest_meta: {},
        }, body));
      }
      return api.queryKnowledgeBase(body).then(function(result) {
        return normalizeResult(result, body);
      }).catch(function(err) {
        return normalizeResult({
          used: false,
          status: 'unreachable',
          reason: err && err.message ? String(err.message) : '知识库请求失败',
          match_count: 0,
          used_chunk_count: 0,
          used_doc_count: 0,
          context_text: '',
          hits: [],
          manifest_meta: {},
        }, body);
      });
    }

    return {
      normalizeBaseUrl: normalizeBaseUrl,
      isValidBaseUrl: isValidBaseUrl,
      buildQuerySignature: buildQuerySignature,
      normalizeResult: normalizeResult,
      canUseResult: canUseResult,
      buildPromptSections: buildPromptSections,
      queryKnowledgeBase: queryKnowledgeBase,
    };
  }

  window.app.knowledgeBaseBridge = { init: init };
})();
