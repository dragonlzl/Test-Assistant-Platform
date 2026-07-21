(function(factory) {
  var api = factory(typeof window !== 'undefined' ? window : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.xmindAssetLoader = api;
  }
})(function(defaultRoot) {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var window = opts.root || defaultRoot || { app: {} };
    var xmindCore = opts.xmindCore || null;
    var extractRequirementLabelFromText = typeof opts.extractRequirementLabelFromText === 'function'
      ? opts.extractRequirementLabelFromText
      : function() { return ''; };
    window.app = window.app || {};

    const resolveAssetUrl = function(path) {
      if (!path) return '';
      try {
        return new URL(path, window.location.href).href;
      } catch (err) {
        return String(path);
      }
    };
    const ensureStylesheetOnce = function(path, marker) {
      if (typeof document === 'undefined' || !document.querySelector) return;
      var href = resolveAssetUrl(path);
      if (!href) return;
      var key = marker ? String(marker) : href;
      var exists = document.querySelector('link[data-tap-asset="' + key + '"]');
      if (!exists) {
        var list = document.querySelectorAll('link[rel="stylesheet"][href]');
        Array.prototype.some.call(list || [], function(node) {
          if (!node || !node.href) return false;
          if (String(node.href) !== href) return false;
          exists = node;
          return true;
        });
      }
      if (exists) {
        if (exists.setAttribute) exists.setAttribute('data-tap-asset', key);
        return;
      }
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-tap-asset', key);
      var head = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
      if (head && head.appendChild) head.appendChild(link);
    };
    const loadLocalScriptOnce = function(path, readyCheck) {
      if (typeof readyCheck === 'function' && readyCheck()) {
        return Promise.resolve();
      }
      if (typeof document === 'undefined' || !document.createElement) {
        return Promise.reject(new Error('当前环境不支持动态加载脚本'));
      }
      window.app = window.app || {};
      if (!window.app.__tapScriptLoaders || typeof window.app.__tapScriptLoaders !== 'object') {
        window.app.__tapScriptLoaders = {};
      }
      var src = resolveAssetUrl(path);
      if (!src) return Promise.reject(new Error('脚本地址无效'));
      if (window.app.__tapScriptLoaders[src]) {
        return window.app.__tapScriptLoaders[src];
      }
      window.app.__tapScriptLoaders[src] = new Promise(function(resolve, reject) {
        var settled = false;
        var timeoutId = 0;
        var pollId = 0;
        function cleanup() {
          if (timeoutId) clearTimeout(timeoutId);
          if (pollId) clearInterval(pollId);
        }
        function finish(err) {
          if (settled) return;
          settled = true;
          cleanup();
          if (err) reject(err);
          else resolve();
        }
        function isReady() {
          return typeof readyCheck === 'function' ? readyCheck() : true;
        }
        if (isReady()) {
          finish();
          return;
        }
        var script = document.createElement('script');
        script.src = src;
        script.defer = true;
        script.async = false;
        script.setAttribute('data-tap-dynamic-script', src);
        script.onload = function() {
          if (isReady()) {
            finish();
            return;
          }
          timeoutId = setTimeout(function() {
            if (isReady()) finish();
            else finish(new Error('脚本已加载但依赖仍未就绪：' + path));
          }, 60);
        };
        script.onerror = function() {
          finish(new Error('脚本加载失败：' + path));
        };
        pollId = setInterval(function() {
          if (isReady()) finish();
        }, 40);
        timeoutId = setTimeout(function() {
          if (isReady()) {
            finish();
            return;
          }
          finish(new Error('脚本加载超时：' + path));
        }, 4000);
        var parent = document.body || document.head || document.documentElement;
        if (!parent || !parent.appendChild) {
          finish(new Error('页面容器不可用，无法加载脚本：' + path));
          return;
        }
        parent.appendChild(script);
      }).finally(function() {
        if (
          window.app &&
          window.app.__tapScriptLoaders &&
          window.app.__tapScriptLoaders[src]
        ) {
          delete window.app.__tapScriptLoaders[src];
        }
      });
      return window.app.__tapScriptLoaders[src];
    };
    const ensureMindElixirCoreApi = function() {
      if (
        window.app
        && window.app.xmindRenderPolicyCore
        && window.app.mindElixirCoreApi
        && typeof window.app.mindElixirCoreApi.renderMindMap === 'function'
      ) {
        return Promise.resolve(window.app.mindElixirCoreApi);
      }
      window.app = window.app || {};
      if (window.app.__tapMindElixirApiPromise) {
        return window.app.__tapMindElixirApiPromise;
      }
      window.app.__tapMindElixirApiPromise = Promise.resolve()
        .then(function() {
          ensureStylesheetOnce('./scripts/vendor/mind-elixir.css', 'mind-elixir-css');
          return loadLocalScriptOnce('./scripts/vendor/mind-elixir.iife.js', function() {
            return typeof window !== 'undefined' && typeof window.MindElixir !== 'undefined';
          });
        })
        .then(function() {
          return loadLocalScriptOnce('./scripts/core/xmindRenderPolicyCore.js', function() {
            return Boolean(window.app && window.app.xmindRenderPolicyCore);
          });
        })
        .then(function() {
          return loadLocalScriptOnce('./scripts/core/mindElixirCore.js', function() {
            return Boolean(window.app && window.app.mindElixirCore && typeof window.app.mindElixirCore.init === 'function');
          });
        })
        .then(function() {
          if (!window.app || !window.app.mindElixirCore || typeof window.app.mindElixirCore.init !== 'function') {
            throw new Error('MindElixir 核心模块未就绪');
          }
          if (!window.app.mindElixirCoreApi || typeof window.app.mindElixirCoreApi.renderMindMap !== 'function') {
            window.app.mindElixirCoreApi = window.app.mindElixirCore.init({
              xmindApi: window.app.xmindCoreApi || xmindCore || null,
              renderPolicyCore: window.app.xmindRenderPolicyCore || null,
            });
          }
          return window.app.mindElixirCoreApi || null;
        })
        .finally(function() {
          if (window.app) window.app.__tapMindElixirApiPromise = null;
        });
      return window.app.__tapMindElixirApiPromise;
    };
    window.app.ensureMindElixirCoreApi = ensureMindElixirCoreApi;
    const parseXmindFile = xmindCore && xmindCore.parseXmindFile
      ? xmindCore.parseXmindFile
      : async function parseXmindFileFallback() { return { text: '', list: [] }; };
    
    const lazyParseXmindFile = function(file) {
      const parser = typeof parseXmindFile === 'function'
        ? parseXmindFile
        : (window.app && window.app.xmindCore && typeof window.app.xmindCore.parseXmindFile === 'function'
          ? window.app.xmindCore.parseXmindFile
          : null);
      return parser ? parser(file) : Promise.resolve({ text: '', list: [] });
    };
    const lazyExtractRequirementLabel = function(text) {
      return typeof extractRequirementLabelFromText === 'function'
        ? extractRequirementLabelFromText(text)
        : '';
    };
    const lazyBuildTempExecXmindPackage = function(file, requirement) {
      const builder = window.app && (
        (window.app.xmindCoreApi && typeof window.app.xmindCoreApi.buildTempExecXmindPackage === 'function'
          ? window.app.xmindCoreApi.buildTempExecXmindPackage
          : null)
        || (window.app.xmindCore && typeof window.app.xmindCore.buildTempExecXmindPackage === 'function'
          ? window.app.xmindCore.buildTempExecXmindPackage
          : null)
      );
      if (!builder) return Promise.reject(new Error('缺少 XMind 导出依赖'));
      return builder(file, requirement);
    };
    const lazyBuildCasesXmindPackage = function(cases, moduleTitle, requirement) {
      const builder = window.app && (
        (window.app.xmindCoreApi && typeof window.app.xmindCoreApi.buildXmindPackageFromCases === 'function'
          ? window.app.xmindCoreApi.buildXmindPackageFromCases
          : null)
        || (window.app.xmindCore && typeof window.app.xmindCore.buildXmindPackageFromCases === 'function'
          ? window.app.xmindCore.buildXmindPackageFromCases
          : null)
      );
      if (!builder) return Promise.reject(new Error('缺少 XMind 导出依赖'));
      return builder(cases, moduleTitle, requirement);
    };

    return {
      ensureMindElixirCoreApi: ensureMindElixirCoreApi,
      parseXmindFile: parseXmindFile,
      lazyParseXmindFile: lazyParseXmindFile,
      lazyExtractRequirementLabel: lazyExtractRequirementLabel,
      lazyBuildTempExecXmindPackage: lazyBuildTempExecXmindPackage,
      lazyBuildCasesXmindPackage: lazyBuildCasesXmindPackage,
      resolveAssetUrl: resolveAssetUrl,
      ensureStylesheetOnce: ensureStylesheetOnce,
      loadLocalScriptOnce: loadLocalScriptOnce,
    };
  }

  return {
    create: create,
  };
});

