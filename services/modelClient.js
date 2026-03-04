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
    var activeControllers = [];

    function resolveProxyModelRequest() {
      if (proxyModelRequest) return proxyModelRequest;
      if (window.app && window.app.apiClient && typeof window.app.apiClient.proxyModelRequest === 'function') {
        return window.app.apiClient.proxyModelRequest;
      }
      return null;
    }

    function registerActiveController(controller) {
      if (!controller) return;
      if (activeControllers.indexOf(controller) !== -1) return;
      activeControllers.push(controller);
    }

    function unregisterActiveController(controller) {
      if (!controller) return;
      var idx = activeControllers.indexOf(controller);
      if (idx === -1) return;
      activeControllers.splice(idx, 1);
    }

    function abortAllRequests(reason) {
      var list = activeControllers.slice();
      activeControllers.length = 0;
      list.forEach(function(controller) {
        if (!controller || typeof controller.abort !== 'function') return;
        try {
          controller.abort(reason || 'cancelled');
        } catch (err) {
          // ignore
        }
      });
    }

    function modelIsClaudeFamily(model) {
      if (!model || typeof model !== 'object') return false;
      var provider = model.provider ? String(model.provider).toLowerCase() : '';
      if (provider === 'claude' || provider === 'anthropic') return true;
      var modelId = model.model ? String(model.model).toLowerCase() : '';
      return modelId.indexOf('claude') !== -1;
    }

    function modelNeedsChatCompletionsCompat(model) {
      if (!modelIsClaudeFamily(model)) return false;
      var baseUrl = model && model.baseUrl ? String(model.baseUrl).toLowerCase() : '';
      if (!baseUrl) return false;
      return /\/responses(?:\?|$)/i.test(baseUrl);
    }

    function getEffectiveModelBaseUrl(model) {
      var baseUrl = model && model.baseUrl ? String(model.baseUrl) : '';
      if (!baseUrl) return '';
      if (!modelNeedsChatCompletionsCompat(model)) return baseUrl;
      return baseUrl.replace(/\/responses(\?|$)/i, '/chat/completions$1');
    }

    function getModelForRequest(model) {
      if (!model || typeof model !== 'object') return model;
      var nextBaseUrl = getEffectiveModelBaseUrl(model);
      if (!nextBaseUrl || nextBaseUrl === model.baseUrl) return model;
      var nextModel = {};
      Object.keys(model).forEach(function(key) {
        nextModel[key] = model[key];
      });
      nextModel.baseUrl = nextBaseUrl;
      return nextModel;
    }

    function modelUsesResponsesApi(model) {
      var baseUrl = getEffectiveModelBaseUrl(model).toLowerCase();
      if (!baseUrl) return false;
      return /\/responses(?:\?|$)/i.test(baseUrl);
    }

    function buildModelRequestBody(model, systemPrompt, userText, safeTemperature, maxTokens, reasoningEffort, deepseekJsonMode) {
      if (modelUsesResponsesApi(model)) {
        var safeText = userText === undefined || userText === null ? '' : String(userText);
        var responseBody = {
          model: model.model,
          stream: false,
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

    function normalizeContentBlocks(contentBlocks) {
      var normalized = [];
      if (!Array.isArray(contentBlocks)) return normalized;
      contentBlocks.forEach(function(block) {
        if (!block || typeof block !== 'object') return;
        if (block.type === 'text') {
          var text = block.text === undefined || block.text === null ? '' : String(block.text);
          if (text.trim()) normalized.push({ type: 'text', text: text });
          return;
        }
        if (block.type === 'image') {
          var dataUrl = block.dataUrl === undefined || block.dataUrl === null ? '' : String(block.dataUrl).trim();
          if (!dataUrl) return;
          normalized.push({ type: 'image', dataUrl: dataUrl });
        }
      });
      return normalized;
    }

    function buildMultimodalRequestBody(model, contentBlocks, promptText, options) {
      var opts = options && typeof options === 'object' ? options : {};
      var maxTokens = opts.maxTokens || model.maxTokens || defaultMaxTokens;
      var tempValue = Number(opts.temperature);
      var safeTemperature = Number.isFinite(tempValue) ? Math.min(1, Math.max(0, tempValue)) : 0.2;
      var reasoningEffort = opts.reasoningEffort || '';
      var systemPrompt = promptText && String(promptText).trim() ? String(promptText).trim() : '';
      var normalizedBlocks = normalizeContentBlocks(contentBlocks);
      if (!normalizedBlocks.length) {
        normalizedBlocks.push({ type: 'text', text: '请处理输入内容。' });
      }
      if (modelUsesResponsesApi(model)) {
        var responseContent = normalizedBlocks.map(function(block) {
          if (block.type === 'image') {
            return {
              type: 'input_image',
              image_url: block.dataUrl,
            };
          }
          return {
            type: 'input_text',
            text: block.text,
          };
        });
        var responseBody = {
          model: model.model,
          stream: false,
          input: [
            {
              role: 'user',
              content: responseContent,
            }
          ],
          temperature: safeTemperature,
          max_output_tokens: maxTokens,
        };
        if (systemPrompt) responseBody.instructions = systemPrompt;
        return responseBody;
      }
      var messageContent = normalizedBlocks.map(function(block) {
        if (block.type === 'image') {
          return {
            type: 'image_url',
            image_url: { url: block.dataUrl },
          };
        }
        return {
          type: 'text',
          text: block.text,
        };
      });
      var messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      if (messageContent.length === 1 && messageContent[0].type === 'text') {
        messages.push({ role: 'user', content: messageContent[0].text });
      } else {
        messages.push({ role: 'user', content: messageContent });
      }
      var chatBody = {
        model: model.model,
        messages: messages,
        temperature: safeTemperature,
        max_tokens: maxTokens,
      };
      if (reasoningEffort && modelIsR1(model)) {
        chatBody.reasoning_effort = reasoningEffort;
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

    function extractTextFromContentBlocks(content) {
      var textParts = [];

      function pushText(value) {
        if (typeof value !== 'string') return;
        var text = value.trim();
        if (text) textParts.push(text);
      }

      function visit(node) {
        if (node === null || node === undefined) return;
        if (typeof node === 'string') {
          pushText(node);
          return;
        }
        if (Array.isArray(node)) {
          node.forEach(visit);
          return;
        }
        if (typeof node !== 'object') return;
        pushText(node.text);
        pushText(node.output_text);
        if (typeof node.content === 'string') {
          pushText(node.content);
        } else if (Array.isArray(node.content)) {
          visit(node.content);
        }
        if (node.part && typeof node.part === 'object') visit(node.part);
      }

      visit(content);
      return textParts.join('\n').trim();
    }

    function extractContentFromParsedData(data) {
      function normalizeAndStrip(value) {
        var extracted = extractTextFromContentBlocks(value);
        if (extracted) return stripCodeFence(extracted);
        var normalized = normalizeResponseContent(value);
        if (!normalized) return '';
        return stripCodeFence(normalized);
      }
      return (
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'message', 'content'])) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'message', 'reasoning_content'])) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'delta', 'content'])) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'delta', 'reasoning_content'])) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'content'])) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'text'])) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'message', 'responses'])) ||
        normalizeAndStrip(getNestedValue(data, ['data', 0, 'contents', 0, 'text'])) ||
        normalizeAndStrip(extractResponsesOutput(data)) ||
        normalizeAndStrip(getNestedValue(data, ['output_text'])) ||
        normalizeAndStrip(getNestedValue(data, ['content'])) ||
        normalizeAndStrip(getNestedValue(data, ['text']))
      );
    }

    function normalizeModelError(errorValue) {
      if (!errorValue) return '';
      if (typeof errorValue === 'string') return errorValue;
      if (typeof errorValue.message === 'string' && errorValue.message) return errorValue.message;
      if (typeof errorValue.code === 'string' && errorValue.code) return errorValue.code;
      try {
        return JSON.stringify(errorValue);
      } catch (err) {
        return String(errorValue);
      }
    }

    function isAbortOrTimeoutError(err, signal) {
      if (err && err.name === 'AbortError') return true;
      if (signal && signal.aborted) return true;
      var msg = err && err.message ? String(err.message) : String(err || '');
      if (!msg) return false;
      var lower = msg.toLowerCase();
      if (lower.indexOf('aborterror') !== -1) return true;
      if (lower.indexOf('aborted') !== -1) return true;
      if (lower === 'timeout') return true;
      if (lower.indexOf('timed out') !== -1) return true;
      if (lower.indexOf('signal is aborted') !== -1) return true;
      return false;
    }

    function splitSseEvents(rawBody) {
      var text = rawBody === undefined || rawBody === null ? '' : String(rawBody);
      if (!text) return null;
      var lines = text.replace(/\r\n/g, '\n').split('\n');
      var sawStructuredLine = false;
      var sawInvalidLine = false;
      var events = [];
      var eventName = '';
      var dataLines = [];

      function parseLine(line) {
        var idx = line.indexOf(':');
        if (idx === -1) return '';
        var value = line.slice(idx + 1);
        if (value.charAt(0) === ' ') value = value.slice(1);
        return value;
      }

      function flushEvent() {
        if (!eventName && !dataLines.length) return;
        events.push({ event: eventName, data: dataLines.join('\n') });
        eventName = '';
        dataLines = [];
      }

      for (var i = 0; i < lines.length; i += 1) {
        var line = lines[i];
        if (!line) {
          flushEvent();
          continue;
        }
        if (line.indexOf('event:') === 0) {
          sawStructuredLine = true;
          eventName = parseLine(line);
          continue;
        }
        if (line.indexOf('data:') === 0) {
          sawStructuredLine = true;
          dataLines.push(parseLine(line));
          continue;
        }
        if (line.indexOf('id:') === 0 || line.indexOf('retry:') === 0 || line.indexOf(':') === 0) {
          sawStructuredLine = true;
          continue;
        }
        if (line.trim()) sawInvalidLine = true;
      }
      flushEvent();
      if (!sawStructuredLine || sawInvalidLine) return null;
      return events;
    }

    function extractSsePayloadContent(payload, fallbackEventName) {
      var result = {
        delta: '',
        content: '',
        completed: '',
        error: '',
      };
      if (payload === null || payload === undefined) return result;
      if (typeof payload !== 'object') {
        var normalized = normalizeResponseContent(payload);
        if (normalized) result.content = stripCodeFence(normalized);
        return result;
      }
      if (payload.error) {
        result.error = normalizeModelError(payload.error);
        return result;
      }

      var type = typeof payload.type === 'string' ? payload.type : (fallbackEventName || '');
      if (type === 'response.output_text.delta' && typeof payload.delta === 'string' && payload.delta) {
        result.delta = payload.delta;
      } else if (/\.delta$/i.test(type) && typeof payload.delta === 'string' && payload.delta) {
        result.delta = payload.delta;
      }

      var part = payload.part || payload.content_part || payload.contentPart || null;
      if (!result.delta && part && typeof part === 'object') {
        if (typeof part.delta === 'string' && part.delta) {
          result.delta = part.delta;
        } else if (typeof part.text === 'string' && part.text) {
          result.content = part.text;
        }
      }

      if (!result.delta) {
        var chatDelta = normalizeResponseContent(getNestedValue(payload, ['choices', 0, 'delta', 'content']));
        if (chatDelta) result.delta = chatDelta;
      }

      if (!result.content) {
        var payloadText = '';
        if (typeof payload.text === 'string' && payload.text) payloadText = payload.text;
        if (!payloadText && typeof payload.output_text === 'string' && payload.output_text) payloadText = payload.output_text;
        if (!payloadText && typeof payload.content === 'string' && payload.content) payloadText = payload.content;
        if (payloadText) result.content = stripCodeFence(normalizeResponseContent(payloadText));
      }

      if (!result.content && payload.item && typeof payload.item === 'object') {
        var itemContent = extractContentFromParsedData(payload.item);
        if (!itemContent) {
          itemContent = stripCodeFence(normalizeResponseContent(getNestedValue(payload, ['item', 'text'])));
        }
        if (itemContent) result.content = itemContent;
      }

      if (!result.content) {
        var directContent = extractContentFromParsedData(payload);
        if (directContent) result.content = directContent;
      }

      if (payload.response && typeof payload.response === 'object') {
        var completedContent = extractContentFromParsedData(payload.response);
        if (completedContent) result.completed = completedContent;
        if (!result.error && payload.response.error) {
          result.error = normalizeModelError(payload.response.error);
        }
      }

      return result;
    }

    function extractContentFromSse(rawBody) {
      var events = splitSseEvents(rawBody);
      if (!events || !events.length) {
        return { detected: false, content: '', error: '' };
      }
      var deltaParts = [];
      var contentParts = [];
      var completedContent = '';
      var sawDelta = false;
      for (var i = 0; i < events.length; i += 1) {
        var evt = events[i];
        var dataText = evt && evt.data ? String(evt.data).trim() : '';
        if (!dataText || dataText === '[DONE]') continue;
        var parsed = null;
        try {
          parsed = JSON.parse(dataText);
        } catch (err) {
          parsed = dataText;
        }
        var extracted = extractSsePayloadContent(parsed, evt && evt.event ? String(evt.event) : '');
        if (extracted.error) {
          return { detected: true, content: '', error: extracted.error };
        }
        if (extracted.delta) {
          sawDelta = true;
          deltaParts.push(extracted.delta);
        } else if (extracted.content) {
          contentParts.push(extracted.content);
        }
        if (extracted.completed) completedContent = extracted.completed;
      }
      var content = '';
      if (sawDelta && deltaParts.length) {
        content = deltaParts.join('');
      } else if (contentParts.length) {
        content = contentParts.join('');
      } else if (completedContent) {
        content = completedContent;
      }
      content = content ? stripCodeFence(normalizeResponseContent(content)) : '';
      return { detected: true, content: content, error: '' };
    }

    function parseModelRawBody(rawBody) {
      var text = rawBody === undefined || rawBody === null ? '' : String(rawBody);
      if (!text) {
        return { data: null, content: '', isSse: false };
      }
      try {
        return { data: JSON.parse(text), content: '', isSse: false };
      } catch (err) {
        // 非 JSON 时继续按 SSE 或纯文本处理。
      }
      var trimmed = text.trim();
      if (!trimmed) {
        return { data: null, content: '', isSse: false };
      }
      var sseResult = extractContentFromSse(trimmed);
      if (sseResult.detected) {
        if (sseResult.error) throw new Error(sseResult.error);
        return { data: null, content: sseResult.content || '', isSse: true };
      }
      var sanitizedRaw = stripCodeFence(trimmed);
      return { data: null, content: sanitizedRaw || trimmed, isSse: false };
    }

    async function sendModelRequest(model, headers, body, timeoutSec, signal) {
      var proxyFn = resolveProxyModelRequest();
      var requestUrl = getEffectiveModelBaseUrl(model);
      if (proxyFn) {
        try {
          var proxied = await proxyFn({
            base_url: requestUrl,
            api_key: model.apiKey || '',
            payload: body,
            timeout_sec: timeoutSec,
          }, signal);
          // 在纯静态模式（无后端 API）或未登录态下，回退到直连，保持旧行为兼容。
          if (proxied) {
            var status = Number(proxied.status);
            var canFallback = [401, 403, 404, 405, 501].indexOf(status) !== -1 || (status >= 500 && status < 600);
            if (!canFallback) return proxied;
          }
        } catch (err) {
          if (!fetchImpl) throw err;
        }
      }
      if (!fetchImpl) throw new Error('当前环境不支持 fetch');
      return fetchImpl(requestUrl, {
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
      var requestModel = getModelForRequest(model);
      var body = buildModelRequestBody(requestModel, systemPrompt, userText, safeTemperature, maxTokens, reasoningEffort, deepseekJsonMode);
      var headers = Object.assign({ 'Content-Type': 'application/json' }, getAuthHeader(model.apiKey));
      var timeoutSec = clampTimeoutSeconds(getTimeoutSec());
      var timeoutMs = timeoutSec * 1000;
      var controller = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = null;
      if (controller) {
        registerActiveController(controller);
        timer = setTimeout(function onTimeout() { controller.abort('timeout'); }, timeoutMs);
      }
      var res;
      var rawBody = '';
      try {
        res = await sendModelRequest(
          requestModel,
          headers,
          body,
          timeoutSec,
          controller ? controller.signal : undefined
        );
      } catch (err) {
        if (isAbortOrTimeoutError(err, controller ? controller.signal : null)) {
          throw new Error('模型调用超时（超过 ' + timeoutSec + ' 秒），请重试或检查服务状态');
        }
        throw err;
      } finally {
        if (timer) clearTimeout(timer);
        if (controller) unregisterActiveController(controller);
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
      var parsedRaw = parseModelRawBody(rawBody);
      var data = parsedRaw.data;
      if (!data && parsedRaw.content) return parsedRaw.content;
      if (!data && parsedRaw.isSse) {
        throw new Error('流式响应未解析到有效内容');
      }
      if (!data) {
        throw new Error('模型响应为空');
      }
      if (data && data.error) {
        var errMsg = normalizeModelError(data.error);
        throw new Error(errMsg);
      }
      var content = extractContentFromParsedData(data);
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

    async function callModelWithContent(model, contentBlocks, promptText, options) {
      if (!model || !model.baseUrl || !model.model) {
        throw new Error('模型配置不完整');
      }
      var proxyFn = resolveProxyModelRequest();
      if (!fetchImpl && !proxyFn) {
        throw new Error('当前环境不支持 fetch');
      }
      var opts = options && typeof options === 'object' ? options : {};
      var safePrompt = promptText && String(promptText).trim() ? String(promptText).trim() : '';
      var requestModel = getModelForRequest(model);
      var body = buildMultimodalRequestBody(requestModel, contentBlocks, safePrompt, opts);
      var headers = Object.assign({ 'Content-Type': 'application/json' }, getAuthHeader(model.apiKey));
      var timeoutSec = clampTimeoutSeconds(
        Object.prototype.hasOwnProperty.call(opts, 'timeoutSec') ? opts.timeoutSec : getTimeoutSec()
      );
      var timeoutMs = timeoutSec * 1000;
      var controller = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = null;
      if (controller) {
        registerActiveController(controller);
        timer = setTimeout(function onTimeout() { controller.abort('timeout'); }, timeoutMs);
      }
      var res;
      var rawBody = '';
      try {
        res = await sendModelRequest(
          requestModel,
          headers,
          body,
          timeoutSec,
          controller ? controller.signal : undefined
        );
      } catch (err) {
        if (isAbortOrTimeoutError(err, controller ? controller.signal : null)) {
          throw new Error('模型调用超时（超过 ' + timeoutSec + ' 秒），请重试或检查服务状态');
        }
        throw err;
      } finally {
        if (timer) clearTimeout(timer);
        if (controller) unregisterActiveController(controller);
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
      var parsedRaw = parseModelRawBody(rawBody);
      var data = parsedRaw.data;
      if (!data && parsedRaw.content) return parsedRaw.content;
      if (!data && parsedRaw.isSse) {
        throw new Error('流式响应未解析到有效内容');
      }
      if (!data) {
        throw new Error('模型响应为空');
      }
      if (data && data.error) {
        var errMsg = normalizeModelError(data.error);
        throw new Error(errMsg);
      }
      var content = extractContentFromParsedData(data);
      if (!content) {
        var preview = rawBody ? (rawBody.length > 400 ? rawBody.slice(0, 400) + '...' : rawBody) : '';
        var extra = preview ? '（响应片段：' + preview + '）' : '';
        throw new Error('未找到模型返回内容' + extra);
      }
      return content;
    }

    return {
      callModelWithConfig: callModelWithConfig,
      callModelWithContent: callModelWithContent,
      buildMultimodalRequestBody: buildMultimodalRequestBody,
      abortAllRequests: abortAllRequests,
    };
  }

  window.app.services.modelClient = {
    createModelClient: createModelClient,
    getNestedValue: getNestedValue,
    normalizeResponseContent: normalizeResponseContent,
  };
})();
