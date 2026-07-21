(function(factory) {
  var api = factory(typeof window !== 'undefined' ? window : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.modelRuntime = api;
  }
})(function(defaultRoot) {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var root = opts.root || defaultRoot;
    var state = opts.state || {};
    var defaultSettings = opts.defaultSettings || {};
    var defaultPrompts = opts.defaultPrompts || {};
    var defaultMaxTokens = opts.defaultMaxTokens || 1024;
    var clampTimeoutSeconds = typeof opts.clampTimeoutSeconds === 'function'
      ? opts.clampTimeoutSeconds
      : function(value) { return value; };
    var stripCodeFence = typeof opts.stripCodeFence === 'function'
      ? opts.stripCodeFence
      : function(value) { return value; };
    var modelClientService = opts.modelClientService || null;

    function getConfiguredTimeoutSec() {
      var storedTimeout = state.settings && Object.prototype.hasOwnProperty.call(state.settings, 'timeoutSec')
        ? state.settings.timeoutSec
        : undefined;
      return storedTimeout === null || storedTimeout === undefined ? defaultSettings.timeoutSec : storedTimeout;
    }

    function isR1Model(model) {
      var source = model && model.model ? String(model.model).toLowerCase() : '';
      return source.indexOf('deepseek-r1') !== -1 || source.indexOf('deepseek-reasoner') !== -1;
    }

    var modelClient = modelClientService && typeof modelClientService.createModelClient === 'function'
      ? modelClientService.createModelClient({
        defaultPrompts: defaultPrompts,
        defaultMaxTokens: defaultMaxTokens,
        clampTimeoutSeconds: clampTimeoutSeconds,
        getTimeoutSec: getConfiguredTimeoutSec,
        modelIsR1: isR1Model,
        stripCodeFence: stripCodeFence,
      })
      : null;

    function setLastModelError(err) {
      if (!root) return;
      root.app = root.app || {};
      if (!err) {
        root.app.__lastModelError = null;
        return;
      }
      var message = err && err.message ? err.message : String(err || '');
      root.app.__lastModelError = {
        message: message,
        name: err && err.name ? err.name : '',
        at: Date.now(),
      };
    }

    function getLastModelError() {
      if (!root || !root.app) return null;
      var err = root.app.__lastModelError;
      return err && typeof err === 'object' ? err : null;
    }

    function clearLastModelError() {
      setLastModelError(null);
    }

    function wrapCallModelWithTracking(fn) {
      return async function wrappedCallModel() {
        try {
          var result = await fn.apply(null, arguments);
          clearLastModelError();
          return result;
        } catch (err) {
          setLastModelError(err);
          throw err;
        }
      };
    }

    var callModelWithConfig = wrapCallModelWithTracking(
      modelClient && typeof modelClient.callModelWithConfig === 'function'
        ? modelClient.callModelWithConfig
        : async function missingModelClient() {
          throw new Error('模型客户端不可用，请刷新页面后重试');
        }
    );
    var callModelWithContent = wrapCallModelWithTracking(
      modelClient && typeof modelClient.callModelWithContent === 'function'
        ? modelClient.callModelWithContent
        : async function missingContentModelClient() {
          throw new Error('多模态模型客户端不可用，请刷新页面后重试');
        }
    );
    var abortAllModelRequests = modelClient && typeof modelClient.abortAllRequests === 'function'
      ? modelClient.abortAllRequests
      : function noopAbortAllModelRequests() {};
    var abortModelRequestsByOwner = modelClient && typeof modelClient.abortRequestsByOwner === 'function'
      ? modelClient.abortRequestsByOwner
      : function noopAbortModelRequestsByOwner() { return 0; };

    return {
      callModelWithConfig: callModelWithConfig,
      callModelWithContent: callModelWithContent,
      abortAllModelRequests: abortAllModelRequests,
      abortModelRequestsByOwner: abortModelRequestsByOwner,
      getLastModelError: getLastModelError,
      clearLastModelError: clearLastModelError,
      setLastModelError: setLastModelError,
      getConfiguredTimeoutSec: getConfiguredTimeoutSec,
      isR1Model: isR1Model,
    };
  }

  return {
    create: create,
  };
});
