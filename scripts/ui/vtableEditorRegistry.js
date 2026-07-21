(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.ui = root.app.ui || {};
    root.app.ui.vtableEditorRegistry = api;
  }
})(function(root) {
  var vendorPromise = null;
  var registered = {};
  var defaultSource = './scripts/vendor/vtable-editors.es2019.min.js';

  function getConstructors() {
    if (!root || !root.VTable || !root.VTable.editors) return null;
    var editors = root.VTable.editors;
    if (typeof editors.InputEditor !== 'function' ||
      typeof editors.TextAreaEditor !== 'function' ||
      typeof editors.DateInputEditor !== 'function' ||
      typeof editors.ListEditor !== 'function') {
      return null;
    }
    return editors;
  }

  function collect(model) {
    var seen = {};
    var columns = model && Array.isArray(model.columns) ? model.columns : [];
    return columns.reduce(function(result, column) {
      var editor = column && column.editor ? column.editor : null;
      if (!editor || !editor.name || seen[editor.name]) return result;
      seen[editor.name] = true;
      result.push({
        name: editor.name,
        type: editor.type,
        options: Object.assign({}, editor.options || {}),
        columnKey: column.key,
        attributes: editor.attributes || null,
      });
      return result;
    }, []);
  }

  function load(options) {
    var constructors = getConstructors();
    if (constructors) return Promise.resolve(constructors);
    if (vendorPromise) return vendorPromise;
    if (!root || !root.document) {
      return Promise.reject(new Error('VTable editors require a browser document'));
    }
    var opts = options || {};
    var source = String(opts.source || defaultSource);
    vendorPromise = new Promise(function(resolve, reject) {
      var existing = root.document.querySelector('script[data-tap-vtable-editors="1"]');
      var script = existing || root.document.createElement('script');

      function cleanup() {
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
      }
      function handleLoad() {
        cleanup();
        var loaded = getConstructors();
        if (!loaded) {
          vendorPromise = null;
          reject(new Error('VTable editor vendor loaded without constructors'));
          return;
        }
        resolve(loaded);
      }
      function handleError() {
        cleanup();
        vendorPromise = null;
        if (script.parentNode) script.parentNode.removeChild(script);
        reject(new Error('VTable editor vendor failed to load'));
      }

      script.addEventListener('load', handleLoad);
      script.addEventListener('error', handleError);
      if (!existing) {
        script.async = true;
        script.src = source;
        script.setAttribute('data-tap-vtable-editors', '1');
        root.document.head.appendChild(script);
      }
    });
    return vendorPromise;
  }

  function constructorFor(editors, type) {
    if (type === 'textarea') return editors.TextAreaEditor;
    if (type === 'date') return editors.DateInputEditor;
    if (type === 'list') return editors.ListEditor;
    return editors.InputEditor;
  }

  function createEditor(editors, config) {
    var Editor = constructorFor(editors, config.type);
    var instance = new Editor(config.options);
    var createElement = instance.createElement;
    if (typeof createElement === 'function') {
      instance.createElement = function() {
        var result = createElement.apply(instance, arguments);
        if (instance.element && instance.element.classList) {
          instance.element.classList.add('tap-vtable-editor');
          instance.element.setAttribute('data-editor-type', config.type);
        }
        return result;
      };
    }
    var onStart = instance.onStart;
    if (typeof onStart === 'function') {
      instance.onStart = function(context) {
        var result = onStart.apply(instance, arguments);
        var element = instance.element;
        if (!element || !element.setAttribute) return result;
        var normalized = context && context.table && typeof context.table.getRecordByCell === 'function'
          ? context.table.getRecordByCell(context.col, context.row)
          : null;
        if (normalized && typeof normalized.then === 'function') normalized = null;
        var source = normalized && normalized.__source ? normalized.__source : null;
        var sourceIndex = normalized && normalized.__sourceIndex !== undefined
          ? normalized.__sourceIndex
          : Math.max(0, Number(context && context.row) - 1);
        var attributes = typeof config.attributes === 'function'
          ? config.attributes(source, sourceIndex, context || {})
          : config.attributes;
        element.setAttribute('data-vtable-column', config.columnKey || '');
        if (attributes && typeof attributes === 'object') {
          Object.keys(attributes).forEach(function(name) {
            var value = attributes[name];
            if (value === undefined || value === null || value === false) return;
            element.setAttribute(name, value === true ? '' : String(value));
          });
        }
        return result;
      };
    }
    return instance;
  }

  function ensure(runtime, model, options) {
    var configs = collect(model);
    if (!configs.length) return Promise.resolve({ count: 0, names: [] });
    if (!runtime || !runtime.register || typeof runtime.register.editor !== 'function') {
      return Promise.reject(new Error('VTable runtime editor registry is unavailable'));
    }
    return load(options).then(function(editors) {
      configs.forEach(function(config) {
        if (registered[config.name]) return;
        var current = runtime.register.editor(config.name);
        if (!current) {
          runtime.register.editor(config.name, createEditor(editors, config));
        }
        registered[config.name] = true;
      });
      return {
        count: configs.length,
        names: configs.map(function(config) { return config.name; }),
      };
    });
  }

  function resetForRetry() {
    if (getConstructors()) return false;
    vendorPromise = null;
    return true;
  }

  return {
    ensure: ensure,
    load: load,
    collect: collect,
    getConstructors: getConstructors,
    resetForRetry: resetForRetry,
    source: defaultSource,
  };
});
