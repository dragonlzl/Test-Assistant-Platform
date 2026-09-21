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

  function looksLikeHtmlDocument(text) {
    if (text === null || text === undefined) return false;
    var trimmed = String(text).trim().toLowerCase();
    if (!trimmed) return false;
    if (trimmed.indexOf('<!doctype html') === 0) return true;
    if (trimmed.indexOf('<html') === 0) return true;
    if (trimmed.indexOf('<head') === 0) return true;
    if (trimmed.indexOf('<body') === 0) return true;
    return trimmed.indexOf('</html>') !== -1 && trimmed.indexOf('<title') !== -1;
  }

  function extractHtmlTitle(text) {
    if (text === null || text === undefined) return '';
    var match = String(text).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match || !match[1]) return '';
    return String(match[1]).replace(/\s+/g, ' ').trim();
  }

  function buildHtmlResponseError(rawText) {
    var title = extractHtmlTitle(rawText);
    var extra = title ? '（页面标题：' + title + '）' : '';
    return new Error('模型接口返回了 HTML 页面' + extra + '，请检查接口地址是否为实际 API 地址（如 /v1/responses 或 /v1/chat/completions），而不是网站首页/控制台页面');
  }

  function createModelClient(options) {
    var defaultPrompts = options && options.defaultPrompts ? options.defaultPrompts : {};
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
    var reasoningEffortValues = ['none', 'low', 'medium', 'high', 'xhigh', 'max'];
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

    function resolveModelTaskClient() {
      return window.app && window.app.services && window.app.services.modelTaskClient
        ? window.app.services.modelTaskClient
        : null;
    }

    function isModelTaskFallbackEnabled() {
      try {
        if (window.__APP_ALLOW_MODEL_TASK_FALLBACK === true) return true;
        if (typeof localStorage !== 'undefined') {
          var e2eFlag = localStorage.getItem('tap-e2e-skip-auth');
          if (e2eFlag === '1' || e2eFlag === 'true') return true;
        }
      } catch (err) {
        // ignore
      }
      return false;
    }

    function registerActiveController(controller, owner) {
      if (!controller) return;
      var existed = activeControllers.some(function(entry) {
        return entry && entry.controller === controller;
      });
      if (existed) return;
      activeControllers.push({
        controller: controller,
        owner: owner ? String(owner) : '',
      });
    }

    function unregisterActiveController(controller) {
      if (!controller) return;
      var idx = -1;
      for (var i = 0; i < activeControllers.length; i += 1) {
        if (activeControllers[i] && activeControllers[i].controller === controller) {
          idx = i;
          break;
        }
      }
      if (idx === -1) return;
      activeControllers.splice(idx, 1);
    }

    function abortAllRequests(reason) {
      var list = activeControllers.slice();
      activeControllers.length = 0;
      list.forEach(function(entry) {
        var controller = entry && entry.controller ? entry.controller : entry;
        if (!controller || typeof controller.abort !== 'function') return;
        try {
          controller.abort(reason || 'cancelled');
        } catch (err) {
          // ignore
        }
      });
    }

    function abortRequestsByOwner(owner, reason) {
      var targetOwner = owner ? String(owner) : '';
      if (!targetOwner) return 0;
      var remaining = [];
      var aborted = 0;
      activeControllers.forEach(function(entry) {
        var controller = entry && entry.controller ? entry.controller : null;
        var entryOwner = entry && entry.owner ? String(entry.owner) : '';
        if (!controller) return;
        if (entryOwner !== targetOwner) {
          remaining.push(entry);
          return;
        }
        try {
          controller.abort(reason || 'cancelled');
        } catch (err) {
          // ignore
        }
        aborted += 1;
      });
      activeControllers = remaining;
      return aborted;
    }

    function modelIsClaudeFamily(model) {
      if (!model || typeof model !== 'object') return false;
      var provider = model.provider ? String(model.provider).toLowerCase() : '';
      if (provider === 'claude' || provider === 'anthropic') return true;
      var modelId = model.model ? String(model.model).toLowerCase() : '';
      return modelId.indexOf('claude') !== -1;
    }

    function modelIsPackycode(model) {
      return isPackycodeModel(model);
    }

    function modelNeedsChatCompletionsCompat(model) {
      if (modelIsPackycode(model) || !modelIsClaudeFamily(model)) return false;
      var baseUrl = model && model.baseUrl ? String(model.baseUrl).toLowerCase() : '';
      if (!baseUrl) return false;
      return /\/responses(?:\?|$)/i.test(baseUrl);
    }

    function getEffectiveModelBaseUrl(model) {
      var baseUrl = model && model.baseUrl ? String(model.baseUrl) : '';
      if (!baseUrl) return '';
      if (modelNeedsChatCompletionsCompat(model)) {
        baseUrl = baseUrl.replace(/\/responses(\?|$)/i, '/chat/completions$1');
      }
      return normalizeModelEndpointUrl(baseUrl, model);
    }

    // 把用户填的「接口地址」规约成实际请求地址：既接受完整端点
    // （/chat/completions、/responses、/completions、/chat、/models），也接受
    // 裸的 API Base URL（如 https://x.com、https://x.com/v1、https://x.com/v1/）。
    // 裸 Base URL 按模型协议补默认端点；GPT-5 推理模型使用 Responses API。
    function normalizeModelEndpointUrl(rawUrl, model) {
      var url = String(rawUrl || '').trim();
      if (!url) return url;
      var hashIndex = url.indexOf('#');
      if (hashIndex !== -1) url = url.slice(0, hashIndex);
      var query = '';
      var qIndex = url.indexOf('?');
      if (qIndex !== -1) {
        query = url.slice(qIndex);
        url = url.slice(0, qIndex);
      }
      url = url.replace(/\/+$/, '');
      if (modelIsPackycode(model)) {
        url = url.replace(/\/(chat\/completions|completions|responses|chat|models)$/i, '');
        return url + (/\/v1$/i.test(url) ? '/responses' : '/v1/responses') + query;
      }
      var isFullEndpoint = /\/chat\/completions$/i.test(url)
        || /\/completions$/i.test(url)
        || /\/responses$/i.test(url)
        || /\/chat$/i.test(url)
        || /\/models$/i.test(url);
      if (!isFullEndpoint) {
        if (url) {
          if (modelPrefersResponsesEndpoint(model)) {
            url += /\/v1$/i.test(url) ? '/responses' : '/v1/responses';
          } else {
            url += '/chat/completions';
          }
        }
      }
      return url + query;
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

    function modelUsesStreaming(model) {
      if (modelIsPackycode(model)) return true;
      if (!model || typeof model !== 'object') return false;
      var value = model.stream !== undefined && model.stream !== null ? model.stream : model.streamMode;
      if (value === true) return true;
      var raw = value === undefined || value === null ? '' : String(value).trim().toLowerCase();
      if (!raw) return false;
      return raw === 'true' || raw === '1' || raw === 'stream' || raw === 'sse' || raw === 'on';
    }

    function modelNeedsPackyResponsesStreamCompat(model) {
      if (modelIsPackycode(model)) return false;
      if (!modelUsesStreaming(model)) return false;
      if (!modelUsesResponsesApi(model)) return false;
      var baseUrl = getEffectiveModelBaseUrl(model).toLowerCase();
      return baseUrl.indexOf('packyapi.com') !== -1;
    }

    function normalizeReasoningEffort(value) {
      var raw = value === undefined || value === null ? '' : String(value).trim().toLowerCase();
      return reasoningEffortValues.indexOf(raw) !== -1 ? raw : '';
    }

    function modelHasReasoningCapability(model) {
      if (!model || typeof model !== 'object') return false;
      var raw = model.capabilities || model.modelCapabilities || model.tags || model.multiModalTags || model.multimodalTags;
      if (Array.isArray(raw)) {
        return raw.some(function(item) { return String(item || '').trim().toLowerCase() === 'reasoning'; });
      }
      if (typeof raw === 'string') {
        return raw.split(/[,|/、\s]+/).some(function(item) {
          return String(item || '').trim().toLowerCase() === 'reasoning';
        });
      }
      if (raw && typeof raw === 'object') return Boolean(raw.reasoning || raw.推理);
      return false;
    }

    function isDeepseekR1Model(model) {
      var id = model && model.model ? String(model.model).trim().toLowerCase() : '';
      return id.indexOf('deepseek-r1') !== -1 || id.indexOf('deepseek-reasoner') !== -1;
    }

    function isGptReasoningModel(model) {
      var id = model && model.model ? String(model.model).trim().toLowerCase() : '';
      return (id.indexOf('gpt-5') === 0 || modelIsPackycode(model)) && id.indexOf('chat') === -1;
    }

    function modelPrefersResponsesEndpoint(model) {
      return isGptReasoningModel(model);
    }

    function modelSupportsReasoning(model) {
      return modelIsR1(model) || isDeepseekR1Model(model) || isGptReasoningModel(model) || modelHasReasoningCapability(model);
    }

    function resolveReasoningEffort(model, requested) {
      if (!modelSupportsReasoning(model)) return '';
      var explicit = normalizeReasoningEffort(requested);
      if (explicit) return explicit;
      return normalizeReasoningEffort(
        model && model.reasoningEffort !== undefined ? model.reasoningEffort : model && model.reasoning_effort
      );
    }

    function buildPromptPrefixedText(systemPrompt, userText) {
      var prompt = systemPrompt === undefined || systemPrompt === null ? '' : String(systemPrompt).trim();
      var text = userText === undefined || userText === null ? '' : String(userText);
      if (!prompt) return text;
      return prompt + '\n\n用户输入：\n' + text;
    }

    function applyPackycodeRequest(model, body, instructions, effort) {
      if (!modelIsPackycode(model)) return body;
      body.instructions = String(instructions || '').trim() || '请完成用户请求。';
      body.reasoning = { effort: effort || 'high' };
      body.stream = true;
      body.store = false;
      body.max_output_tokens = 16384;
      // prompt_cache_key 由后端在实际发送时生成，恢复查询不会创建新的上游调用。
      return body;
    }

    function buildModelRequestBody(model, systemPrompt, userText, reasoningEffort, deepseekJsonMode) {
      var useStream = modelUsesStreaming(model);
      var usePackyStreamCompat = modelNeedsPackyResponsesStreamCompat(model);
      var effectiveReasoningEffort = resolveReasoningEffort(model, reasoningEffort);
      if (modelUsesResponsesApi(model)) {
        var safeText = usePackyStreamCompat
          ? buildPromptPrefixedText(systemPrompt, userText)
          : (userText === undefined || userText === null ? '' : String(userText));
        var responseBody = {
          model: model.model,
          stream: useStream,
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: safeText }
              ],
            }
          ],
        };
        if (!usePackyStreamCompat && systemPrompt) responseBody.instructions = systemPrompt;
        if (effectiveReasoningEffort && (isGptReasoningModel(model) || modelHasReasoningCapability(model))) {
          responseBody.reasoning = { effort: effectiveReasoningEffort };
        }
        return applyPackycodeRequest(model, responseBody, systemPrompt, effectiveReasoningEffort);
      }
      var chatBody = {
        model: model.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText }
        ],
        stream: useStream,
      };
      if (effectiveReasoningEffort && (modelIsR1(model) || isDeepseekR1Model(model) || isGptReasoningModel(model) || modelHasReasoningCapability(model))) {
        chatBody.reasoning_effort = effectiveReasoningEffort;
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
      var reasoningEffort = resolveReasoningEffort(model, opts.reasoningEffort || '');
      var systemPrompt = promptText && String(promptText).trim() ? String(promptText).trim() : '';
      var useStream = modelUsesStreaming(model);
      var usePackyStreamCompat = modelNeedsPackyResponsesStreamCompat(model);
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
        if (usePackyStreamCompat && systemPrompt) {
          responseContent.unshift({
            type: 'input_text',
            text: systemPrompt,
          });
        }
        var responseBody = {
          model: model.model,
          stream: useStream,
          input: [
            {
              role: 'user',
              content: responseContent,
            }
          ],
        };
        if (!usePackyStreamCompat && systemPrompt) responseBody.instructions = systemPrompt;
        if (reasoningEffort && (isGptReasoningModel(model) || modelHasReasoningCapability(model))) {
          responseBody.reasoning = { effort: reasoningEffort };
        }
        return applyPackycodeRequest(model, responseBody, systemPrompt, reasoningEffort);
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
        stream: useStream,
      };
      if (reasoningEffort && (modelIsR1(model) || isDeepseekR1Model(model) || isGptReasoningModel(model) || modelHasReasoningCapability(model))) {
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

    function normalizeHttpErrorBody(rawBody) {
      var text = rawBody === undefined || rawBody === null ? '' : String(rawBody).trim();
      if (!text) return '';
      if (looksLikeHtmlDocument(text)) {
        var htmlTitle = extractHtmlTitle(text);
        return htmlTitle
          ? '上游返回 HTML 错误页（页面标题：' + htmlTitle + '）'
          : '上游返回 HTML 错误页';
      }
      try {
        var parsed = JSON.parse(text);
        var detail = normalizeModelError(parsed && parsed.error ? parsed.error : '')
          || (parsed && typeof parsed.detail === 'string' ? parsed.detail : '')
          || (parsed && typeof parsed.message === 'string' ? parsed.message : '');
        if (detail) return detail;
      } catch (err) {
        // ignore
      }
      return stripCodeFence(text);
    }

    function isTransientFetchError(err) {
      if (!err || err.name === 'AbortError') return false;
      var msg = err && err.message ? String(err.message) : String(err || '');
      if (!msg) return false;
      var lower = msg.toLowerCase();
      if (lower.indexOf('failed to fetch') !== -1) return true;
      if (lower.indexOf('networkerror') !== -1) return true;
      if (lower.indexOf('network request failed') !== -1) return true;
      if (lower.indexOf('load failed') !== -1) return true;
      return false;
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
      var metadata = {};
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
        metadata = mergeResponseMetadata(metadata, parsed);
        if (extracted.error) {
          return { detected: true, content: '', error: extracted.error, metadata: metadata };
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
      return { detected: true, content: content, error: '', metadata: metadata };
    }

    function mergeResponseMetadata(previous, data) {
      var base = previous && typeof previous === 'object' ? previous : {};
      var source = data && typeof data === 'object' ? data : {};
      var nested = source.response && typeof source.response === 'object' ? source.response : null;
      var candidate = nested || source;
      var choices = Array.isArray(candidate.choices) ? candidate.choices : [];
      var choice = choices.length && choices[0] && typeof choices[0] === 'object' ? choices[0] : {};
      var incomplete = candidate.incomplete_details && typeof candidate.incomplete_details === 'object'
        ? candidate.incomplete_details
        : (source.incomplete_details && typeof source.incomplete_details === 'object' ? source.incomplete_details : null);
      var usage = candidate.usage && typeof candidate.usage === 'object'
        ? candidate.usage
        : (source.usage && typeof source.usage === 'object' ? source.usage : null);
      var next = {
        responseId: candidate.id || base.responseId || '',
        responseError: candidate.error || source.error || base.responseError || null,
        responseStatus: candidate.status || source.status || base.responseStatus || '',
        finishReason: choice.finish_reason || candidate.finish_reason || source.finish_reason || base.finishReason || '',
        incompleteDetails: incomplete || base.incompleteDetails || null,
        usage: usage || base.usage || null,
        upstreamStatus: candidate.upstream_status || candidate.upstreamStatus || source.upstream_status || source.upstreamStatus || base.upstreamStatus || 0,
      };
      return next;
    }

    function buildModelResponseError(parsedRaw, metadata) {
      var info = metadata || {};
      var message = parsedRaw && parsedRaw.error
        ? parsedRaw.error
        : normalizeModelError(info.responseError);
      if (!message && String(info.responseStatus || '').toLowerCase() === 'failed') {
        message = '上游模型生成失败（response.failed）';
      }
      if (!message) return null;
      var error = new Error(message);
      error.code = info.responseError && info.responseError.code
        ? String(info.responseError.code)
        : 'MODEL_RESPONSE_FAILED';
      error.responseMetadata = info;
      return error;
    }

    function isOutputTokenLimitMetadata(metadata) {
      var info = metadata && typeof metadata === 'object' ? metadata : {};
      var status = String(info.responseStatus || '').toLowerCase();
      var finishReason = String(info.finishReason || '').toLowerCase();
      var incomplete = info.incompleteDetails && typeof info.incompleteDetails === 'object'
        ? info.incompleteDetails
        : {};
      var incompleteReason = String(incomplete.reason || '').toLowerCase();
      return (status === 'incomplete' && (!incompleteReason || incompleteReason.indexOf('token') !== -1))
        || finishReason === 'length'
        || finishReason === 'max_tokens'
        || incompleteReason === 'max_output_tokens'
        || incompleteReason === 'max_tokens'
        || incompleteReason.indexOf('token') !== -1;
    }

    function formatUsageSummary(metadata) {
      var usage = metadata && metadata.usage && typeof metadata.usage === 'object' ? metadata.usage : null;
      if (!usage) return '';
      var input = Number(usage.input_tokens !== undefined ? usage.input_tokens : usage.prompt_tokens);
      var output = Number(usage.output_tokens !== undefined ? usage.output_tokens : usage.completion_tokens);
      var total = Number(usage.total_tokens);
      var reasoningDetails = usage.output_tokens_details && typeof usage.output_tokens_details === 'object'
        ? usage.output_tokens_details
        : {};
      var reasoning = Number(reasoningDetails.reasoning_tokens);
      var parts = [];
      if (Number.isFinite(input) && input >= 0) parts.push('输入 ' + String(input));
      if (Number.isFinite(output) && output >= 0) parts.push('输出 ' + String(output));
      if (Number.isFinite(reasoning) && reasoning >= 0) parts.push('推理 ' + String(reasoning));
      if (Number.isFinite(total) && total >= 0) parts.push('合计 ' + String(total));
      return parts.join('，');
    }

    function buildOutputTokenLimitError(metadata) {
      var usageText = formatUsageSummary(metadata);
      var message = '模型输出达到 token 上限（由上游模型或代理决定），返回的 JSON 可能已被截断。';
      if (usageText) message += '上游用量：' + usageText + '。';
      message += '请缩小单次生成范围，或确认代理对该模型开放了足够的输出上限。';
      var error = new Error(message);
      error.code = 'MODEL_OUTPUT_TOKEN_LIMIT';
      error.responseMetadata = metadata || {};
      return error;
    }

    function summarizeResponsePreview(text, maxLength, fromTail) {
      var value = text === null || text === undefined ? '' : String(text);
      var limit = Number(maxLength);
      if (!Number.isFinite(limit) || limit <= 0) limit = 160;
      value = value.replace(/\s+/g, ' ').trim();
      if (!value) return '';
      if (value.length <= limit) return value;
      return fromTail === true
        ? '…' + value.slice(-limit).trim()
        : value.slice(0, limit).trim() + '…';
    }

    function reportModelResponseDiagnostics(requestOptions, metadata, rawBody, parsedRaw, content) {
      var opts = requestOptions && typeof requestOptions === 'object' ? requestOptions : {};
      var responseInfo = metadata && typeof metadata === 'object' ? metadata : {};
      var incomplete = responseInfo.incompleteDetails && typeof responseInfo.incompleteDetails === 'object'
        ? responseInfo.incompleteDetails
        : {};
      var rawText = rawBody === null || rawBody === undefined ? '' : String(rawBody);
      var contentText = content === null || content === undefined ? '' : String(content);
      var info = {
        responseId: String(responseInfo.responseId || ''),
        errorCode: responseInfo.responseError && responseInfo.responseError.code
          ? String(responseInfo.responseError.code)
          : '',
        upstreamStatus: Number(responseInfo.upstreamStatus || 0) || 0,
        responseStatus: String(responseInfo.responseStatus || ''),
        finishReason: String(responseInfo.finishReason || ''),
        incompleteReason: String(incomplete.reason || ''),
        usage: responseInfo.usage && typeof responseInfo.usage === 'object'
          ? responseInfo.usage
          : null,
        rawLength: rawText.length,
        rawTailPreview: summarizeResponsePreview(rawText, 160, true),
        contentLength: contentText.length,
        contentTailPreview: summarizeResponsePreview(contentText, 160, true),
        isSse: Boolean(parsedRaw && parsedRaw.isSse),
        isHtml: Boolean(parsedRaw && parsedRaw.isHtml),
        hasParsedData: Boolean(parsedRaw && parsedRaw.data),
      };
      if (typeof opts.onResponseDiagnostics === 'function') {
        try {
          opts.onResponseDiagnostics(info);
        } catch (callbackErr) {
        }
      }
      var owner = opts.owner ? String(opts.owner || '') : '';
      var scene = opts.scene ? String(opts.scene || '') : '';
      var shouldLog = opts.logModelResponse === true
        || owner.indexOf('xmind-casegen') === 0
        || scene === 'root'
        || scene === 'module';
      var incompleteReason = String(info.incompleteReason || '').toLowerCase();
      var finishReason = String(info.finishReason || '').toLowerCase();
      var responseLimited = String(info.responseStatus || '').toLowerCase() === 'incomplete'
        || finishReason === 'length'
        || finishReason === 'max_tokens'
        || incompleteReason.indexOf('token') !== -1;
      if (shouldLog && typeof console !== 'undefined' && console) {
        var logMethod = responseLimited ? console.warn : console.info;
        if (typeof logMethod !== 'function') logMethod = console.warn;
        if (typeof logMethod === 'function') {
          logMethod.call(console, '[TAP][model-response]', Object.assign({
            owner: owner,
            scene: scene,
          }, info));
        }
      }
      return info;
    }

    function parseModelRawBody(rawBody) {
      var text = rawBody === undefined || rawBody === null ? '' : String(rawBody);
      if (!text) {
        return { data: null, content: '', isSse: false, isHtml: false };
      }
      try {
        return { data: JSON.parse(text), content: '', isSse: false, isHtml: false };
      } catch (err) {
        // 非 JSON 时继续按 SSE 或纯文本处理。
      }
      var trimmed = text.trim();
      if (!trimmed) {
        return { data: null, content: '', isSse: false, isHtml: false };
      }
      if (looksLikeHtmlDocument(trimmed)) {
        return { data: null, content: '', isSse: false, isHtml: true };
      }
      var sseResult = extractContentFromSse(trimmed);
      if (sseResult.detected) {
        return {
          data: null,
          content: sseResult.content || '',
          error: sseResult.error || '',
          isSse: true,
          isHtml: false,
          metadata: sseResult.metadata || {},
        };
      }
      var sanitizedRaw = stripCodeFence(trimmed);
      return { data: null, content: sanitizedRaw || trimmed, isSse: false, isHtml: false };
    }

    async function sendModelRequest(model, headers, body, timeoutSec, signal, requestOptions) {
      var asyncTaskClient = resolveModelTaskClient();
      var opts = requestOptions && typeof requestOptions === 'object' ? requestOptions : {};
      if (opts.transport !== 'proxy' && asyncTaskClient && typeof asyncTaskClient.runModelRequest === 'function') {
        var asyncResponse = await asyncTaskClient.runModelRequest({
          model: model,
          payload: body,
          timeoutSec: timeoutSec,
          owner: opts.owner || '',
          requestKey: opts.requestKey || '',
          scene: opts.scene || 'generation',
          resumeOnly: opts.resumeOnly === true,
        }, signal);
        if (asyncResponse) return asyncResponse;
      }
      if (opts.transport !== 'proxy' && !isModelTaskFallbackEnabled()) {
        throw new Error('后端异步生成服务不可用，无法保证刷新后继续生成，请重启后端并刷新页面后重试');
      }
      var proxyFn = resolveProxyModelRequest();
      var requestUrl = getEffectiveModelBaseUrl(model);
      if (modelIsPackycode(model)) {
        if (!proxyFn) throw new Error('Packycode 需要后端代理设置请求头，请启动后端服务');
        // 请求一旦交给代理即不回退直连，避免在结果未知时重复计费。
        return proxyFn({
          base_url: requestUrl,
          provider: 'packycode',
          api_key: model.apiKey || '',
          payload: body,
          timeout_sec: timeoutSec,
        }, signal);
      }
      var proxyFallbackResponse = null;
      var proxyError = null;
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
            var canFallback = [401, 403, 404, 405, 501].indexOf(status) !== -1;
            if (!canFallback) return proxied;
            proxyFallbackResponse = proxied;
          }
        } catch (err) {
          proxyError = err;
          if (!fetchImpl) throw err;
        }
      }
      if (!fetchImpl) throw new Error('当前环境不支持 fetch');
      try {
        return await fetchImpl(requestUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(body),
          signal: signal,
        });
      } catch (err) {
        if (isAbortOrTimeoutError(err, signal)) throw err;
        if (proxyFallbackResponse && isTransientFetchError(err)) return proxyFallbackResponse;
        if (proxyError && isTransientFetchError(err)) throw proxyError;
        throw err;
      }
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
      if (/顶层[\s\S]{0,20}(对象|\{\})/i.test(raw)) return 'object';
      if (/(输出结构|返回结构|输出格式|返回格式)[\s\S]{0,40}\{\s*["']?[a-zA-Z0-9_\u4e00-\u9fa5]+["']?\s*:/i.test(raw)) return 'object';
      if (/\{\s*["']?modules["']?\s*:\s*\[/i.test(raw)) return 'object';
      if (/返回\s*\{\s*["']?[a-zA-Z0-9_\u4e00-\u9fa5]+["']?\s*:/i.test(raw)) return 'object';
      if (/输出\s*json\s*(数组|列表|用例列表)/i.test(raw)) return 'array';
      if (/json\s*(数组|列表|用例列表)/i.test(raw)) return 'array';
      if (/顶层[\s\S]{0,20}(数组|\[\])/i.test(raw)) return 'array';
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

    function buildAbortError(signal) {
      var reason = signal && Object.prototype.hasOwnProperty.call(signal, 'reason')
        ? signal.reason
        : '';
      var text = reason ? String(reason) : 'request-aborted';
      if (text === 'timeout') {
        var timeoutErr = new Error('request-timeout');
        timeoutErr.name = 'AbortError';
        timeoutErr.abortReason = 'timeout';
        return timeoutErr;
      }
      var err = new Error(text);
      err.name = 'AbortError';
      err.abortReason = text;
      return err;
    }

    function buildModelTimeoutError(timeoutSec) {
      return new Error('模型调用超时（超过 ' + timeoutSec + ' 秒），请重试或检查服务状态');
    }

    function validatePackycodeResult(model, parsedRaw) {
      if (!modelIsPackycode(model)) return;
      // 后端统一校验 SSE 完成事件并提取最终文本，HTTP 200 本身不代表成功。
      var data = parsedRaw.data;
      if (!data || data.status !== 'completed' || data.error || !data.output_text) {
        parsedRaw.error = 'Packycode 未返回经完成事件确认的有效结果，请检查后端版本或上游错误';
      }
    }

    function normalizeAbortOrTimeoutError(err, signal, timeoutSec, timedOut) {
      if (!isAbortOrTimeoutError(err, signal)) return null;
      if (timedOut === true) return buildModelTimeoutError(timeoutSec);
      var abortErr = buildAbortError(signal);
      if (abortErr && abortErr.abortReason === 'timeout') {
        return buildModelTimeoutError(timeoutSec);
      }
      return abortErr || err;
    }

    async function callModelWithConfig(model, userText, promptText, reasoningEffort, temperature, requestOptions) {
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
      var requestModel = getModelForRequest(model);
      var body = buildModelRequestBody(requestModel, systemPrompt, userText, reasoningEffort, deepseekJsonMode);
      var headers = Object.assign({ 'Content-Type': 'application/json' }, getAuthHeader(model.apiKey));
      var timeoutSec = clampTimeoutSeconds(getTimeoutSec());
      var timeoutMs = timeoutSec * 1000;
      var controller = typeof AbortController === 'function' ? new AbortController() : null;
      var requestOwner = requestOptions && requestOptions.owner ? String(requestOptions.owner || '') : '';
      var timer = null;
      var timedOut = false;
      if (controller) {
        registerActiveController(controller, requestOwner);
        timer = setTimeout(function onTimeout() {
          timedOut = true;
          controller.abort('timeout');
        }, timeoutMs);
      }
      var res;
      var rawBody = '';
      var responseTaskMetadata = null;
      try {
        res = await sendModelRequest(
          requestModel,
          headers,
          body,
          timeoutSec,
          controller ? controller.signal : undefined,
          requestOptions
        );
        responseTaskMetadata = res && res.modelTaskMetadata ? res.modelTaskMetadata : null;
        if (!res || !res.ok) {
          try {
            rawBody = res && typeof res.text === 'function' ? await res.text() : '';
          } catch (err2) {
            rawBody = '';
          }
          var errorParsedRaw = null;
          try {
            errorParsedRaw = parseModelRawBody(rawBody);
          } catch (parseError) {
            errorParsedRaw = { data: null, content: '', isSse: false, isHtml: false };
          }
          var errorResponseMetadata = mergeResponseMetadata(
            errorParsedRaw && errorParsedRaw.metadata,
            errorParsedRaw && errorParsedRaw.data
          );
          errorResponseMetadata.upstreamStatus = Number(res && res.status || 0) || 0;
          if (responseTaskMetadata) {
            errorResponseMetadata = mergeResponseMetadata(errorResponseMetadata, {
              upstreamStatus: responseTaskMetadata.upstreamStatus,
              status: responseTaskMetadata.responseStatus,
              finish_reason: responseTaskMetadata.finishReason,
              incomplete_details: responseTaskMetadata.incompleteDetails,
              usage: responseTaskMetadata.usage,
            });
          }
          reportModelResponseDiagnostics(requestOptions, errorResponseMetadata, rawBody, errorParsedRaw, '');
          var normalizedErr = normalizeHttpErrorBody(rawBody);
          var errText = normalizedErr ? ('：' + normalizedErr.slice(0, 200)) : '';
          throw new Error('HTTP ' + (res ? res.status : '未知') + errText);
        }
        rawBody = await res.text();
      } catch (err) {
        var abortErr = normalizeAbortOrTimeoutError(err, controller ? controller.signal : null, timeoutSec, timedOut);
        if (abortErr) {
          throw abortErr || err;
        }
        throw err;
      } finally {
        if (timer) clearTimeout(timer);
        if (controller) unregisterActiveController(controller);
      }
      var parsedRaw = parseModelRawBody(rawBody);
      parsedRaw.modelTaskMetadata = responseTaskMetadata;
      if (parsedRaw.isHtml) {
        throw buildHtmlResponseError(rawBody);
      }
      var data = parsedRaw.data;
      validatePackycodeResult(model, parsedRaw);
      var responseMetadata = mergeResponseMetadata(parsedRaw.metadata, data);
      responseMetadata.upstreamStatus = Number(res && res.status || 0) || 0;
      if (parsedRaw.modelTaskMetadata) responseMetadata = mergeResponseMetadata(responseMetadata, {
        upstreamStatus: parsedRaw.modelTaskMetadata.upstreamStatus,
        status: parsedRaw.modelTaskMetadata.responseStatus,
        finish_reason: parsedRaw.modelTaskMetadata.finishReason,
        incomplete_details: parsedRaw.modelTaskMetadata.incompleteDetails,
        usage: parsedRaw.modelTaskMetadata.usage,
      });
      var responseError = buildModelResponseError(parsedRaw, responseMetadata);
      if (responseError) {
        reportModelResponseDiagnostics(requestOptions, responseMetadata, rawBody, parsedRaw, '');
        throw responseError;
      }
      if (isOutputTokenLimitMetadata(responseMetadata)) {
        reportModelResponseDiagnostics(requestOptions, responseMetadata, rawBody, parsedRaw, '');
        throw buildOutputTokenLimitError(responseMetadata);
      }
      if (!data && parsedRaw.content) {
        reportModelResponseDiagnostics(requestOptions, responseMetadata, rawBody, parsedRaw, parsedRaw.content);
        return parsedRaw.content;
      }
      if (!data && parsedRaw.isSse) {
        reportModelResponseDiagnostics(requestOptions, responseMetadata, rawBody, parsedRaw, '');
        throw new Error('流式响应未解析到有效内容');
      }
      if (!data) {
        reportModelResponseDiagnostics(requestOptions, responseMetadata, rawBody, parsedRaw, '');
        throw new Error('模型响应为空');
      }
      var content = extractContentFromParsedData(data);
      if (!content) {
        reportModelResponseDiagnostics(requestOptions, responseMetadata, rawBody, parsedRaw, '');
        var preview = rawBody ? (rawBody.length > 400 ? rawBody.slice(0, 400) + '...' : rawBody) : '';
        var extra = preview ? '（响应片段：' + preview + '）' : '';
        throw new Error('未找到模型返回内容' + extra);
      }
      reportModelResponseDiagnostics(requestOptions, responseMetadata, rawBody, parsedRaw, content);
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
      var requestOwner = opts.owner ? String(opts.owner || '') : '';
      var timer = null;
      var timedOut = false;
      if (controller) {
        registerActiveController(controller, requestOwner);
        timer = setTimeout(function onTimeout() {
          timedOut = true;
          controller.abort('timeout');
        }, timeoutMs);
      }
      var res;
      var rawBody = '';
      var responseTaskMetadata = null;
      try {
        res = await sendModelRequest(
          requestModel,
          headers,
          body,
          timeoutSec,
          controller ? controller.signal : undefined,
          opts
        );
        responseTaskMetadata = res && res.modelTaskMetadata ? res.modelTaskMetadata : null;
        if (!res || !res.ok) {
          try {
            rawBody = res && typeof res.text === 'function' ? await res.text() : '';
          } catch (err2) {
            rawBody = '';
          }
          var errorParsedRaw = null;
          try {
            errorParsedRaw = parseModelRawBody(rawBody);
          } catch (parseError) {
            errorParsedRaw = { data: null, content: '', isSse: false, isHtml: false };
          }
          var errorResponseMetadata = mergeResponseMetadata(
            errorParsedRaw && errorParsedRaw.metadata,
            errorParsedRaw && errorParsedRaw.data
          );
          errorResponseMetadata.upstreamStatus = Number(res && res.status || 0) || 0;
          if (responseTaskMetadata) {
            errorResponseMetadata = mergeResponseMetadata(errorResponseMetadata, {
              upstreamStatus: responseTaskMetadata.upstreamStatus,
              status: responseTaskMetadata.responseStatus,
              finish_reason: responseTaskMetadata.finishReason,
              incomplete_details: responseTaskMetadata.incompleteDetails,
              usage: responseTaskMetadata.usage,
            });
          }
          reportModelResponseDiagnostics(opts, errorResponseMetadata, rawBody, errorParsedRaw, '');
          var normalizedErr = normalizeHttpErrorBody(rawBody);
          var errText = normalizedErr ? ('：' + normalizedErr.slice(0, 200)) : '';
          throw new Error('HTTP ' + (res ? res.status : '未知') + errText);
        }
        rawBody = await res.text();
      } catch (err) {
        var abortErr = normalizeAbortOrTimeoutError(err, controller ? controller.signal : null, timeoutSec, timedOut);
        if (abortErr) {
          throw abortErr || err;
        }
        throw err;
      } finally {
        if (timer) clearTimeout(timer);
        if (controller) unregisterActiveController(controller);
      }
      var parsedRaw = parseModelRawBody(rawBody);
      parsedRaw.modelTaskMetadata = responseTaskMetadata;
      if (parsedRaw.isHtml) {
        throw buildHtmlResponseError(rawBody);
      }
      var data = parsedRaw.data;
      validatePackycodeResult(model, parsedRaw);
      var responseMetadata = mergeResponseMetadata(parsedRaw.metadata, data);
      responseMetadata.upstreamStatus = Number(res && res.status || 0) || 0;
      if (parsedRaw.modelTaskMetadata) responseMetadata = mergeResponseMetadata(responseMetadata, {
        upstreamStatus: parsedRaw.modelTaskMetadata.upstreamStatus,
        status: parsedRaw.modelTaskMetadata.responseStatus,
        finish_reason: parsedRaw.modelTaskMetadata.finishReason,
        incomplete_details: parsedRaw.modelTaskMetadata.incompleteDetails,
        usage: parsedRaw.modelTaskMetadata.usage,
      });
      var responseError = buildModelResponseError(parsedRaw, responseMetadata);
      if (responseError) {
        reportModelResponseDiagnostics(opts, responseMetadata, rawBody, parsedRaw, '');
        throw responseError;
      }
      if (isOutputTokenLimitMetadata(responseMetadata)) {
        reportModelResponseDiagnostics(opts, responseMetadata, rawBody, parsedRaw, '');
        throw buildOutputTokenLimitError(responseMetadata);
      }
      if (!data && parsedRaw.content) {
        reportModelResponseDiagnostics(opts, responseMetadata, rawBody, parsedRaw, parsedRaw.content);
        return parsedRaw.content;
      }
      if (!data && parsedRaw.isSse) {
        reportModelResponseDiagnostics(opts, responseMetadata, rawBody, parsedRaw, '');
        throw new Error('流式响应未解析到有效内容');
      }
      if (!data) {
        reportModelResponseDiagnostics(opts, responseMetadata, rawBody, parsedRaw, '');
        throw new Error('模型响应为空');
      }
      var content = extractContentFromParsedData(data);
      if (!content) {
        reportModelResponseDiagnostics(opts, responseMetadata, rawBody, parsedRaw, '');
        var preview = rawBody ? (rawBody.length > 400 ? rawBody.slice(0, 400) + '...' : rawBody) : '';
        var extra = preview ? '（响应片段：' + preview + '）' : '';
        throw new Error('未找到模型返回内容' + extra);
      }
      reportModelResponseDiagnostics(opts, responseMetadata, rawBody, parsedRaw, content);
      return content;
    }

    return {
      callModelWithConfig: callModelWithConfig,
      callModelWithContent: callModelWithContent,
      buildMultimodalRequestBody: buildMultimodalRequestBody,
      abortAllRequests: abortAllRequests,
      abortRequestsByOwner: abortRequestsByOwner,
    };
  }

  function isPackycodeModel(model) {
    return Boolean(model && String(model.provider || '').trim().toLowerCase() === 'packycode');
  }

  window.app.services.modelClient = {
    isPackycodeModel: isPackycodeModel,
    createModelClient: createModelClient,
    getNestedValue: getNestedValue,
    normalizeResponseContent: normalizeResponseContent,
  };
})();
