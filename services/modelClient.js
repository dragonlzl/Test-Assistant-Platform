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

  function resolveStripCodeFence(options) {
    var candidate = options && typeof options.stripCodeFence === 'function' ? options.stripCodeFence : null;
    if (!candidate && window.app && window.app.utils && typeof window.app.utils.stripCodeFence === 'function') {
      candidate = window.app.utils.stripCodeFence;
    }
    if (candidate) {
      return function stripViaCandidate(text) {
        return candidate(text);
      };
    }
    return function fallbackStrip(text) {
      if (!text) return '';
      var trimmed = String(text).trim();
      if (trimmed.indexOf('#NODE:') === 0) {
        var newline = trimmed.indexOf('\n');
        trimmed = newline !== -1 ? trimmed.slice(newline + 1).trim() : '';
      }
      var fenceMatch = trimmed.match(/^([`'"\u2019\u201c]{3})([\w-]*)?\s*\n?([\s\S]*?)\1\s*$/i);
      if (fenceMatch && fenceMatch[3]) return (fenceMatch[3] || '').trim();
      var inlineFence = trimmed.match(/^([`'"\u2019\u201c]{3})([\w-]*)?([\s\S]*?)([`'"\u2019\u201c]{3})\s*$/i);
      if (inlineFence && inlineFence[3]) return (inlineFence[3] || '').trim();
      if (/^([`'"\u2019\u201c]{3})/.test(trimmed)) {
        var parts = trimmed.split('\n');
        if (parts.length > 1) {
          var last = parts[parts.length - 1].trim();
          var body = parts.slice(1, last.match(/^([`'"\u2019\u201c]{3})$/) ? -1 : undefined).join('\n');
          return body.trim();
        }
      }
      return trimmed;
    };
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
    var stripCodeFence = resolveStripCodeFence(options);
    var modelIsDeepseek = typeof options.modelIsDeepseek === 'function'
      ? options.modelIsDeepseek
      : function modelIsDeepseek(model) {
          if (!model) return false;
          var provider = model.provider ? String(model.provider).toLowerCase() : '';
          if (provider === 'deepseek') return true;
          var baseUrl = model.baseUrl ? String(model.baseUrl).toLowerCase() : '';
          if (baseUrl.indexOf('deepseek') !== -1) return true;
          var name = model.model ? String(model.model).toLowerCase() : '';
          return name.indexOf('deepseek') !== -1;
        };
    var proxyModelRequest = options && typeof options.proxyModelRequest === 'function'
      ? options.proxyModelRequest
      : null;

    function resolveProxyModelRequest() {
      if (proxyModelRequest) return proxyModelRequest;
      if (window.app && window.app.apiClient && typeof window.app.apiClient.proxyModelRequest === 'function') {
        return window.app.apiClient.proxyModelRequest;
      }
      return null;
    }

    function modelUsesResponsesApi(model) {
      var baseUrl = model && model.baseUrl ? String(model.baseUrl).toLowerCase() : '';
      if (!baseUrl) return false;
      return /\/responses(?:\?|$)/i.test(baseUrl);
    }

    function buildModelRequestBody(model, systemPrompt, userText, safeTemperature, maxTokens, reasoningEffort, deepseekJsonMode) {
      if (modelUsesResponsesApi(model)) {
        var safeText = userText === undefined || userText === null ? '' : String(userText);
        var responseBody = {
          model: model.model,
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: safeText }
              ],
            }
          ],
          temperature: safeTemperature,
          max_output_tokens: maxTokens,
        };
        if (systemPrompt) responseBody.instructions = systemPrompt;
        return responseBody;
      }
      var chatBody = {
        model: model.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText }
        ],
        temperature: safeTemperature,
        max_tokens: maxTokens,
      };
      if (reasoningEffort && modelIsR1(model)) {
        chatBody.reasoning_effort = reasoningEffort;
      }
      if (deepseekJsonMode) {
        chatBody.response_format = { type: 'json_object' };
      }
      return chatBody;
    }

    function extractResponsesOutput(data) {
      if (!data || !Array.isArray(data.output)) return '';
      var textParts = [];
      data.output.forEach(function(item) {
        if (!item) return;
        if (typeof item.output_text === 'string' && item.output_text.trim()) {
          textParts.push(item.output_text.trim());
          return;
        }
        var content = item.content;
        if (typeof content === 'string' && content.trim()) {
          textParts.push(content.trim());
          return;
        }
        if (!Array.isArray(content)) return;
        content.forEach(function(block) {
          if (block === null || block === undefined) return;
          if (typeof block === 'string') {
            if (block.trim()) textParts.push(block.trim());
            return;
          }
          var text = '';
          if (typeof block.text === 'string') text = block.text;
          if (!text && typeof block.output_text === 'string') text = block.output_text;
          if (!text && typeof block.content === 'string') text = block.content;
          if (text && text.trim()) textParts.push(text.trim());
        });
      });
      return textParts.join('\n').trim();
    }

    async function sendModelRequest(model, headers, body, timeoutSec, signal) {
      var proxyFn = resolveProxyModelRequest();
      if (proxyFn) {
        try {
          var proxied = await proxyFn({
            base_url: model.baseUrl,
            api_key: model.apiKey || '',
            payload: body,
            timeout_sec: timeoutSec,
          }, signal);
          // 在纯静态模式（无后端 API）或未登录态下，回退到直连，保持旧行为兼容。
          if (proxied && [401, 403, 404, 405].indexOf(Number(proxied.status)) === -1) {
            return proxied;
          }
        } catch (err) {
          if (!fetchImpl) throw err;
        }
      }
      if (!fetchImpl) throw new Error('当前环境不支持 fetch');
      return fetchImpl(model.baseUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        signal: signal,
      });
    }

    function shouldUseDeepseekJsonMode(model, promptText) {
      if (!modelIsDeepseek(model)) return false;
      if (!promptText) return false;
      return /json/i.test(String(promptText));
    }

    function detectDeepseekJsonShape(promptText) {
      if (!promptText) return '';
      var raw = String(promptText);
      if (!/json/i.test(raw)) return '';
      if (/输出\s*json\s*(数组|列表|用例列表)/i.test(raw)) return 'array';
      if (/json\s*(数组|列表|用例列表)/i.test(raw)) return 'array';
      if (/输出\s*json\s*[:：]\s*\[/i.test(raw)) return 'array';
      if (/输出[\s\S]{0,20}\[\s*\{/i.test(raw)) return 'array';
      return 'object';
    }

    function appendDeepseekJsonHint(promptText, shape) {
      if (!promptText || !shape) return promptText || '';
      var hint = '';
      if (shape === 'array') {
        hint = '\n\n请严格输出 JSON 数组，顶层必须是数组（[]），不要输出对象或其它文字。';
      } else if (shape === 'object') {
        hint = '\n\n请严格输出 JSON 对象，顶层必须是对象（{}），不要输出数组或其它文字。';
      }
      if (!hint) return promptText;
      if (promptText.indexOf(hint.trim()) !== -1) return promptText;
      return promptText + hint;
    }

    function enforceJsonArrayOutput(text) {
      var trimmed = String(text || '').trim();
      if (!trimmed) {
        throw new Error('模型输出为空');
      }
      var parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (err) {
        throw new Error('模型输出不是合法 JSON 数组');
      }
      if (!Array.isArray(parsed)) {
        throw new Error('模型输出不是 JSON 数组');
      }
      return trimmed;
    }

    async function callModelWithConfig(model, userText, promptText, reasoningEffort, temperature) {
      if (!model || !model.baseUrl || !model.model) {
        throw new Error('模型配置不完整');
      }
      var proxyFn = resolveProxyModelRequest();
      if (!fetchImpl && !proxyFn) {
        throw new Error('当前环境不支持 fetch');
      }
      var prompt = promptText && promptText.trim() ? promptText.trim() : (defaultPrompts.system || '');
      var jsonShape = '';
      var deepseekJsonMode = shouldUseDeepseekJsonMode(model, prompt);
      if (deepseekJsonMode) {
        jsonShape = detectDeepseekJsonShape(prompt);
      }
      var systemPrompt = deepseekJsonMode ? appendDeepseekJsonHint(prompt, jsonShape) : prompt;
      var maxTokens = model.maxTokens || defaultMaxTokens;
      var tempValue = Number(temperature);
      var safeTemperature = Number.isFinite(tempValue) ? Math.min(1, Math.max(0, tempValue)) : 0.2;
      var body = buildModelRequestBody(model, systemPrompt, userText, safeTemperature, maxTokens, reasoningEffort, deepseekJsonMode);
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
        res = await sendModelRequest(
          model,
          headers,
          body,
          timeoutSec,
          controller ? controller.signal : undefined
        );
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
          if (trimmed) {
            var sanitizedRaw = stripCodeFence(trimmed);
            return sanitizedRaw || trimmed;
          }
        }
      }
      if (!data) {
        throw new Error('模型响应为空');
      }
      if (data && data.error) {
        var errMsg = data.error.message || data.error.code || (typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
        throw new Error(errMsg);
      }
      function normalizeAndStrip(value) {
        var normalized = normalizeResponseContent(value);
        if (!normalized) return '';
        return stripCodeFence(normalized);
      }
      var content =
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'message', 'content'])) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'message', 'reasoning_content'])) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'delta', 'content'])) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'delta', 'reasoning_content'])) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'content'])) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'text'])) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'message', 'responses'])) ||
        normalizeAndStrip(getNestedValue(data, ['data', 0, 'contents', 0, 'text'])) ||
        normalizeAndStrip(extractResponsesOutput(data)) ||
        normalizeAndStrip(getNestedValue(data, ['output_text']));
      if (!content) {
        var preview = rawBody ? (rawBody.length > 400 ? rawBody.slice(0, 400) + '...' : rawBody) : '';
        var extra = preview ? '（响应片段：' + preview + '）' : '';
        throw new Error('未找到模型返回内容' + extra);
      }
      if (deepseekJsonMode && jsonShape === 'array') {
        return enforceJsonArrayOutput(content);
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
