(function() {
  window.app = window.app || {};
  window.app.services = window.app.services || {};

  function getNestedValue(obj, path) {
    if (!obj || !path || !path.length) return undefined;
    var cur = obj;
    for (var i = 0; i < path.length; i += 1) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[path[i]];
    }
    return cur;
  }

  function normalizeResponseContent(content) {
    if (content === null || content === undefined) return '';
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
      return content.map(function(item) {
        if (typeof item === 'string') return item;
        if (item === null || item === undefined) return '';
        try {
          return JSON.stringify(item);
        } catch (err) {
          return String(item);
        }
      }).join('\n').trim();
    }
    if (typeof content === 'object') {
      try {
        return JSON.stringify(content);
      } catch (err) {
        return String(content);
      }
    }
    return String(content).trim();
  }

  function createModelClient(options) {
    var defaultPrompts = options && options.defaultPrompts ? options.defaultPrompts : {};
    var defaultMaxTokens = options && options.defaultMaxTokens ? options.defaultMaxTokens : 1024;
    var clampTimeoutSeconds = typeof options.clampTimeoutSeconds === 'function'
      ? options.clampTimeoutSeconds
      : function clampTimeoutSeconds(value) {
          var num = Math.round(Number(value));
          if (!Number.isFinite(num) || num <= 0) return 300;
          return Math.min(1800, Math.max(30, num));
        };
    var getTimeoutSec = typeof options.getTimeoutSec === 'function'
      ? options.getTimeoutSec
      : function getTimeoutSec() { return 300; };
    var modelIsR1 = typeof options.modelIsR1 === 'function'
      ? options.modelIsR1
      : function modelIsR1() { return false; };
    var fetchImpl = options && options.fetchImpl ? options.fetchImpl : (typeof fetch === 'function' ? fetch : null);
    var getAuthHeader = typeof options.getAuthHeader === 'function'
      ? options.getAuthHeader
      : function getAuthHeader(apiKey) {
          return apiKey ? { Authorization: 'Bearer ' + apiKey } : {};
        };

    async function callModelWithConfig(model, userText, promptText, reasoningEffort) {
      if (!model || !model.baseUrl || !model.model) {
        throw new Error('模型配置不完整');
      }
      if (!fetchImpl) {
        throw new Error('当前环境不支持 fetch');
      }
      var prompt = promptText && promptText.trim() ? promptText.trim() : (defaultPrompts.system || '');
      var maxTokens = model.maxTokens || defaultMaxTokens;
      var body = {
        model: model.model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userText }
        ],
        temperature: 0.2,
        max_tokens: maxTokens,
      };
      if (reasoningEffort && modelIsR1(model)) {
        body.reasoning_effort = reasoningEffort;
      }
      var headers = Object.assign({ 'Content-Type': 'application/json' }, getAuthHeader(model.apiKey));
      var timeoutSec = clampTimeoutSeconds(getTimeoutSec());
      var timeoutMs = timeoutSec * 1000;
      var controller = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = null;
      if (controller) {
        timer = setTimeout(function onTimeout() { controller.abort('timeout'); }, timeoutMs);
      }
      var res;
      var rawBody = '';
      try {
        res = await fetchImpl(model.baseUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(body),
          signal: controller ? controller.signal : undefined,
        });
      } catch (err) {
        if (err && err.name === 'AbortError') {
          throw new Error('模型调用超时（超过 ' + timeoutSec + ' 秒），请重试或检查服务状态');
        }
        throw err;
      } finally {
        if (timer) clearTimeout(timer);
      }
      if (!res || !res.ok) {
        try {
          rawBody = res && typeof res.text === 'function' ? await res.text() : '';
        } catch (err) {
          rawBody = '';
        }
        var errText = rawBody ? ('：' + rawBody.slice(0, 200)) : '';
        throw new Error('HTTP ' + (res ? res.status : '未知') + errText);
      }
      rawBody = await res.text();
      var data = null;
      if (rawBody) {
        try {
          data = JSON.parse(rawBody);
        } catch (err) {
          var trimmed = rawBody.trim();
          if (trimmed) return trimmed;
        }
      }
      if (!data) {
        throw new Error('模型响应为空');
      }
      if (data && data.error) {
        var errMsg = data.error.message || data.error.code || (typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
        throw new Error(errMsg);
      }
      var content =
        normalizeResponseContent(getNestedValue(data, ['choices', 0, 'message', 'content'])) ||
        normalizeResponseContent(getNestedValue(data, ['choices', 0, 'message', 'reasoning_content'])) ||
        normalizeResponseContent(getNestedValue(data, ['choices', 0, 'delta', 'content'])) ||
        normalizeResponseContent(getNestedValue(data, ['choices', 0, 'delta', 'reasoning_content'])) ||
        normalizeResponseContent(getNestedValue(data, ['choices', 0, 'content'])) ||
        normalizeResponseContent(getNestedValue(data, ['choices', 0, 'text'])) ||
        normalizeResponseContent(getNestedValue(data, ['choices', 0, 'message', 'responses'])) ||
        normalizeResponseContent(getNestedValue(data, ['data', 0, 'contents', 0, 'text'])) ||
        normalizeResponseContent(getNestedValue(data, ['output_text']));
      if (!content) {
        var preview = rawBody ? (rawBody.length > 400 ? rawBody.slice(0, 400) + '...' : rawBody) : '';
        var extra = preview ? '（响应片段：' + preview + '）' : '';
        throw new Error('未找到模型返回内容' + extra);
      }
      return content;
    }

    return {
      callModelWithConfig: callModelWithConfig,
    };
  }

  window.app.services.modelClient = {
    createModelClient: createModelClient,
    getNestedValue: getNestedValue,
    normalizeResponseContent: normalizeResponseContent,
  };
})();
