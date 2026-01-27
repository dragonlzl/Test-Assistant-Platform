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

  function extractResponsesOutput(data) {
    if (!data || !Array.isArray(data.output)) return '';
    for (var i = 0; i < data.output.length; i += 1) {
      var item = data.output[i];
      if (!item) continue;
      var content = item.content;
      if (typeof content === 'string' && content.trim()) return content;
      if (Array.isArray(content)) {
        for (var j = 0; j < content.length; j += 1) {
          var part = content[j];
          if (!part) continue;
          if (typeof part === 'string' && part.trim()) return part;
          if (typeof part.text === 'string' && part.text.trim()) return part.text;
          if (typeof part.output_text === 'string' && part.output_text.trim()) return part.output_text;
        }
      }
    }
    return '';
  }

  function isSsePayload(rawText) {
    if (!rawText) return false;
    return /(^|\n)\s*(event|data):/i.test(String(rawText));
  }

  function extractSseEventText(obj) {
    if (!obj) return '';
    if (typeof obj.delta === 'string') return obj.delta;
    if (obj.delta && typeof obj.delta === 'object') {
      if (typeof obj.delta.text === 'string') return obj.delta.text;
      if (typeof obj.delta.output_text === 'string') return obj.delta.output_text;
      if (typeof obj.delta.content === 'string') return obj.delta.content;
      var nestedDelta = getNestedValue(obj.delta, ['content', 0, 'text']);
      if (nestedDelta) return normalizeResponseContent(nestedDelta);
    }
    if (typeof obj.output_text === 'string') return obj.output_text;
    if (typeof obj.text === 'string') return obj.text;
    var nested =
      getNestedValue(obj, ['choices', 0, 'delta', 'content']) ||
      getNestedValue(obj, ['choices', 0, 'delta', 'reasoning_content']) ||
      getNestedValue(obj, ['choices', 0, 'message', 'content']) ||
      getNestedValue(obj, ['choices', 0, 'text']);
    if (nested) return normalizeResponseContent(nested);
    var responseText = extractResponsesOutput(obj.response);
    if (responseText) return responseText;
    var outputText = extractResponsesOutput(obj);
    if (outputText) return outputText;
    return '';
  }

  function extractSseText(rawText) {
    if (!rawText) return '';
    var lines = String(rawText).split(/\r?\n/);
    var result = '';
    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i];
      if (!line) continue;
      if (line.indexOf('data:') !== 0 && line.indexOf('data: ') !== 0) continue;
      var payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      if (payload.indexOf('{') === 0 || payload.indexOf('[') === 0) {
        try {
          var parsed = JSON.parse(payload);
          var piece = extractSseEventText(parsed);
          if (piece) result += piece;
        } catch (err) {
          result += payload;
        }
      } else {
        result += payload;
      }
    }
    return result.trim();
  }

  function shouldRetryMissingRequiredFields(rawBody) {
    if (!rawBody) return false;
    var text = String(rawBody);
    if (/missing_required_fields/i.test(text)) return true;
    if (/messages[\s\S]{0,80}input/i.test(text)) return true;
    if (/input[\s\S]{0,80}messages/i.test(text)) return true;
    return false;
  }

  function shouldRetryServiceUnavailable(rawBody) {
    if (!rawBody) return false;
    var text = String(rawBody);
    if (/service_unavailable_error/i.test(text)) return true;
    if (/service unavailable/i.test(text)) return true;
    if (/供应商暂时不可用/.test(text)) return true;
    return false;
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
    var proxyCall = typeof options.proxyCall === 'function' ? options.proxyCall : null;
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
    var isResponsesEndpoint = typeof options.isResponsesEndpoint === 'function'
      ? options.isResponsesEndpoint
      : function isResponsesEndpoint(model) {
          var baseUrl = model && model.baseUrl ? String(model.baseUrl).toLowerCase() : '';
          return baseUrl.indexOf('/responses') !== -1;
        };

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
      if (!fetchImpl) {
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
      var useResponses = isResponsesEndpoint(model);
      var compatFlag = model && model.responsesCompat;
      var useResponsesCompat = compatFlag === true || compatFlag === 'true' || compatFlag === 1 || compatFlag === '1';
      var proxyFlag = model && model.useProxy;
      var useProxy = proxyFlag === true || proxyFlag === 'true' || proxyFlag === 1 || proxyFlag === '1';
      var body;
      var responsesBlocksBody = null;
      var responsesStringBody = null;
      if (useResponses) {
        var responsesBlocksInput = [];
        if (systemPrompt) {
          responsesBlocksInput.push({
            role: 'system',
            content: [{ type: 'input_text', text: systemPrompt }],
          });
        }
        responsesBlocksInput.push({
          role: 'user',
          content: [{ type: 'input_text', text: userText || '' }],
        });
        responsesBlocksBody = {
          model: model.model,
          input: responsesBlocksInput,
          temperature: safeTemperature,
          stream: false,
          max_output_tokens: maxTokens,
        };
        responsesStringBody = {
          model: model.model,
          input: systemPrompt ? (systemPrompt + '\n\n' + (userText || '')) : (userText || ''),
          temperature: safeTemperature,
          stream: true,
          max_output_tokens: maxTokens,
        };
        body = useResponsesCompat ? responsesStringBody : responsesBlocksBody;
      } else {
        body = {
          model: model.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText }
          ],
          temperature: safeTemperature,
          max_tokens: maxTokens,
        };
      }
      if (reasoningEffort && modelIsR1(model)) {
        body.reasoning_effort = reasoningEffort;
        if (responsesStringBody) responsesStringBody.reasoning_effort = reasoningEffort;
        if (responsesBlocksBody) responsesBlocksBody.reasoning_effort = reasoningEffort;
      }
      if (deepseekJsonMode && !useResponses) {
        body.response_format = { type: 'json_object' };
      }
      var headers = Object.assign({ 'Content-Type': 'application/json' }, getAuthHeader(model.apiKey));
      var timeoutSec = clampTimeoutSeconds(getTimeoutSec());
      var timeoutMs = timeoutSec * 1000;
      async function performRequest(payloadBody) {
        var controller = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = null;
        if (controller) {
          timer = setTimeout(function onTimeout() { controller.abort('timeout'); }, timeoutMs);
        }
        try {
          if (useProxy) {
            if (!proxyCall) {
              throw new Error('后端转发不可用，请检查服务或关闭“后端转发”选项');
            }
            return await proxyCall({
              base_url: model.baseUrl,
              headers: headers,
              body: payloadBody,
              timeout_sec: timeoutSec,
            });
          }
          return await fetchImpl(model.baseUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payloadBody),
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
      }
      async function readResponseText(response) {
        try {
          return response && typeof response.text === 'function' ? await response.text() : '';
        } catch (err) {
          return '';
        }
      }
      function cloneBody(source) {
        if (!source) return null;
        try {
          return JSON.parse(JSON.stringify(source));
        } catch (err) {
          return source;
        }
      }
      var res;
      var rawBody = '';
      res = await performRequest(body);
      if (!res || !res.ok) {
        rawBody = await readResponseText(res);
        if (useResponses && shouldRetryMissingRequiredFields(rawBody)) {
          var fallbackBody = useResponsesCompat ? responsesBlocksBody : responsesStringBody;
          if (fallbackBody) {
            res = await performRequest(fallbackBody);
            if (!res || !res.ok) {
              rawBody = await readResponseText(res);
              var retryErrText = rawBody ? ('：' + rawBody.slice(0, 200)) : '';
              throw new Error('HTTP ' + (res ? res.status : '未知') + retryErrText);
            }
            rawBody = await readResponseText(res);
          } else {
            var errText = rawBody ? ('：' + rawBody.slice(0, 200)) : '';
            throw new Error('HTTP ' + (res ? res.status : '未知') + errText);
          }
        } else if (useResponses && shouldRetryServiceUnavailable(rawBody)) {
          var hasReasoning = body && body.reasoning_effort !== undefined && body.reasoning_effort !== null;
          if (hasReasoning) {
            var strippedBody = cloneBody(body);
            if (strippedBody && strippedBody.reasoning_effort !== undefined) {
              delete strippedBody.reasoning_effort;
            }
            res = await performRequest(strippedBody || body);
            if (!res || !res.ok) {
              rawBody = await readResponseText(res);
              var stripErrText = rawBody ? ('：' + rawBody.slice(0, 200)) : '';
              throw new Error('HTTP ' + (res ? res.status : '未知') + stripErrText);
            }
            rawBody = await readResponseText(res);
          } else {
            var errTextReduced = rawBody ? ('：' + rawBody.slice(0, 200)) : '';
            throw new Error('HTTP ' + (res ? res.status : '未知') + errTextReduced);
          }
        } else {
          var errTextFinal = rawBody ? ('：' + rawBody.slice(0, 200)) : '';
          throw new Error('HTTP ' + (res ? res.status : '未知') + errTextFinal);
        }
      } else {
        rawBody = await readResponseText(res);
      }
      var data = null;
      if (rawBody) {
        try {
          data = JSON.parse(rawBody);
        } catch (err) {
          if (isSsePayload(rawBody)) {
            var sseText = extractSseText(rawBody);
            if (sseText) return stripCodeFence(sseText);
          }
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
        normalizeAndStrip(extractResponsesOutput(data)) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'message', 'content'])) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'message', 'reasoning_content'])) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'delta', 'content'])) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'delta', 'reasoning_content'])) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'content'])) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'text'])) ||
        normalizeAndStrip(getNestedValue(data, ['choices', 0, 'message', 'responses'])) ||
        normalizeAndStrip(getNestedValue(data, ['data', 0, 'contents', 0, 'text'])) ||
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
