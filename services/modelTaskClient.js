(function() {
  window.app = window.app || {};
  window.app.services = window.app.services || {};

  var fallbackStatuses = [404, 405, 501];

  function resolveApi() {
    return window.app && window.app.apiClient ? window.app.apiClient : null;
  }

  function isCompatibilityFallbackEnabled() {
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

  function unavailableError(message, status) {
    var error = new Error(message || '后端异步生成服务不可用，无法保证刷新后继续生成');
    if (status) error.status = status;
    error.code = 'MODEL_TASK_BACKEND_REQUIRED';
    return error;
  }

  function resolveModelConfigId(model) {
    if (!model || typeof model !== 'object') return 0;
    var value = model.remoteId !== undefined && model.remoteId !== null
      ? model.remoteId
      : model.id;
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
  }

  function buildRandomKey() {
    return 'generation-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  function normalizeOwner(value) {
    var owner = value === undefined || value === null ? '' : String(value).trim();
    return owner || buildRandomKey();
  }

  function normalizeConfigVersion(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim().replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 48);
  }

  function resolveModelConfigVersion(model) {
    if (!model || typeof model !== 'object') return '';
    return normalizeConfigVersion(
      model.configUpdatedAt
      || model.updated_at
      || model.updatedAt
      || model.configCreatedAt
      || model.created_at
      || model.createdAt
    );
  }

  function hashModelIdentity(model) {
    if (!model || typeof model !== 'object') return '';
    var source = [
      model.provider,
      model.baseUrl || model.base_url,
      model.model || model.modelIdentifier || model.model_id,
    ].map(function(value) {
      return value === undefined || value === null ? '' : String(value);
    }).join('|');
    if (!source.replace(/\|/g, '')) return '';
    var hash = 2166136261;
    for (var index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function scopeRequestKeyToModel(requestKey, model) {
    var baseKey = requestKey === undefined || requestKey === null ? '' : String(requestKey).trim();
    var modelConfigId = resolveModelConfigId(model);
    var version = resolveModelConfigVersion(model);
    var identity = version || hashModelIdentity(model);
    if (!baseKey || !modelConfigId || !identity) return baseKey.slice(0, 255);
    var suffix = ':model-' + String(modelConfigId) + ':version-' + identity;
    return baseKey.slice(0, Math.max(1, 255 - suffix.length)) + suffix;
  }

  function buildRequestOptions(task, stage) {
    var source = task && typeof task === 'object' ? task : {};
    var owner = normalizeOwner(source.requestOwner || source.owner || source.id || 'generation');
    var stageKey = stage ? String(stage) : 'request';
    var attempt = Math.max(0, Number(source.retryCount || 0));
    return {
      owner: owner,
      requestKey: owner + ':' + stageKey + ':attempt-' + String(attempt),
      scene: source.scene || source.scope || 'generation',
      resumeOnly: source.requestPayloadCompacted === true,
    };
  }

  function buildAbortError(signal) {
    var reason = signal && signal.reason ? String(signal.reason) : 'cancelled';
    var error = new Error(reason);
    error.name = 'AbortError';
    error.abortReason = reason;
    return error;
  }

  function waitForPoll(delayMs, signal) {
    return new Promise(function(resolve, reject) {
      if (signal && signal.aborted) {
        reject(buildAbortError(signal));
        return;
      }
      var timer = setTimeout(function() {
        cleanup();
        resolve();
      }, Math.max(100, Number(delayMs || 0)));
      function onAbort() {
        clearTimeout(timer);
        cleanup();
        reject(buildAbortError(signal));
      }
      function cleanup() {
        if (signal && typeof signal.removeEventListener === 'function') {
          signal.removeEventListener('abort', onAbort);
        }
      }
      if (signal && typeof signal.addEventListener === 'function') {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }

  function isTaskShape(value) {
    return Boolean(value && typeof value === 'object' && value.id && value.status);
  }

  function buildResponse(task) {
    var statusCode = Number(task && task.upstream_status);
    if (!Number.isFinite(statusCode) || statusCode <= 0) statusCode = 200;
    var body = task && task.response_body !== undefined && task.response_body !== null
      ? String(task.response_body)
      : '';
    var contentType = task && task.response_content_type
      ? String(task.response_content_type)
      : 'application/json';
    return {
      ok: statusCode >= 200 && statusCode < 300,
      status: statusCode,
      modelTaskMetadata: {
        upstreamStatus: statusCode,
        responseStatus: task && task.response_status ? String(task.response_status) : '',
        finishReason: task && task.finish_reason ? String(task.finish_reason) : '',
        incompleteDetails: task && task.incomplete_details && typeof task.incomplete_details === 'object'
          ? task.incomplete_details
          : null,
        usage: task && task.usage_json && typeof task.usage_json === 'object'
          ? task.usage_json
          : null,
      },
      text: function() { return Promise.resolve(body); },
      headers: {
        get: function(name) {
          return String(name || '').toLowerCase() === 'content-type' ? contentType : null;
        },
      },
    };
  }

  function shouldFallback(err) {
    var status = Number(err && err.status);
    return fallbackStatuses.indexOf(status) !== -1;
  }

  function cancelByOwner(owner) {
    var api = resolveApi();
    var target = owner ? String(owner) : '';
    if (!target || !api || typeof api.cancelModelTasksByOwner !== 'function') {
      return Promise.resolve({ cancelled_count: 0, task_ids: [] });
    }
    return api.cancelModelTasksByOwner(target).catch(function(err) {
      if (shouldFallback(err)) return { cancelled_count: 0, task_ids: [] };
      throw err;
    });
  }

  async function runModelRequest(input, signal) {
    var source = input && typeof input === 'object' ? input : {};
    var api = resolveApi();
    if (!api || typeof api.createModelTask !== 'function' || typeof api.getModelTask !== 'function') {
      if (isCompatibilityFallbackEnabled()) return null;
      throw unavailableError('后端异步生成服务未加载，请刷新页面或重启后端后重试');
    }
    var modelConfigId = resolveModelConfigId(source.model);
    if (!modelConfigId) {
      if (isCompatibilityFallbackEnabled()) return null;
      throw unavailableError('当前模型尚未保存到后端，无法启动异步生成，请先保存模型配置');
    }
    var owner = normalizeOwner(source.owner);
    var requestKey = scopeRequestKeyToModel(source.requestKey ? String(source.requestKey) : owner, source.model);
    var created = null;
    var abortHandler = null;
    if (signal && signal.aborted) throw buildAbortError(signal);
    if (signal && typeof signal.addEventListener === 'function') {
      abortHandler = function() {
        cancelByOwner(owner).catch(function() {});
      };
      signal.addEventListener('abort', abortHandler, { once: true });
    }
    try {
      try {
        created = await api.createModelTask({
          model_config_id: modelConfigId,
          payload: source.payload || {},
          timeout_sec: source.timeoutSec || 60,
          scene: source.scene || 'generation',
          owner_key: owner,
          idempotency_key: requestKey,
          resume_only: source.resumeOnly === true,
        });
      } catch (err) {
        if (shouldFallback(err) && isCompatibilityFallbackEnabled()) return null;
        if (shouldFallback(err)) {
          throw unavailableError('后端异步生成接口不可用，请重启后端并刷新页面后重试', err && err.status);
        }
        throw err;
      }
      if (!isTaskShape(created)) {
        if (isCompatibilityFallbackEnabled()) return null;
        throw unavailableError('后端异步生成接口返回了无效任务，请检查后端版本');
      }
      var task = created;
      var pollDelay = 300;
      while (task && ['queued', 'running', 'cancel_requested'].indexOf(task.status) !== -1) {
        await waitForPoll(pollDelay, signal);
        task = await api.getModelTask(task.id);
        pollDelay = Math.min(1200, pollDelay + 150);
      }
      if (!task) throw new Error('后端模型任务不存在');
      if (task.status === 'succeeded') return buildResponse(task);
      if (task.status === 'cancelled') throw buildAbortError({ reason: task.error || 'cancelled' });
      throw new Error(task.error || '后端模型任务执行失败');
    } finally {
      if (signal && abortHandler && typeof signal.removeEventListener === 'function') {
        signal.removeEventListener('abort', abortHandler);
      }
    }
  }

  window.app.services.modelTaskClient = {
    runModelRequest: runModelRequest,
    cancelByOwner: cancelByOwner,
    buildRequestOptions: buildRequestOptions,
    resolveModelConfigId: resolveModelConfigId,
    scopeRequestKeyToModel: scopeRequestKeyToModel,
  };
})();
