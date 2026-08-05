(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.mindElixirThemeOwner = api;
  }
})(function() {
  function cloneTheme(source, fallbackName, fallbackType) {
    var src = source || {};
    var baseCss = src.cssVar && typeof src.cssVar === 'object' ? src.cssVar : {};
    var basePalette = Array.isArray(src.palette) ? src.palette.slice() : [];
    return {
      name: src.name || fallbackName,
      type: src.type || fallbackType,
      palette: basePalette,
      cssVar: Object.assign({}, baseCss),
    };
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var ctor = opts.ctor || null;
    var hasDocument = Object.prototype.hasOwnProperty.call(opts, 'document');
    var documentRef = hasDocument
      ? opts.document
      : (typeof document !== 'undefined' ? document : null);
    var hasComputedStyle = Object.prototype.hasOwnProperty.call(opts, 'getComputedStyle');
    var getComputedStyleFn = hasComputedStyle
      ? opts.getComputedStyle
      : (typeof window !== 'undefined' && window && typeof window.getComputedStyle === 'function'
          ? function(element) { return window.getComputedStyle(element); }
          : null);

    function buildTheme(darkMode) {
      if (!ctor) return null;
      var isDark = darkMode === true;
      var base = isDark ? ctor.DARK_THEME : ctor.THEME;
      var theme = cloneTheme(base, isDark ? 'Dark' : 'Latte', isDark ? 'dark' : 'light');
      if (!theme.cssVar) theme.cssVar = {};
      if (isDark) {
        theme.cssVar['--root-bgcolor'] = '#3b82f6';
        theme.cssVar['--main-bgcolor'] = '#1f2937';
        theme.cssVar['--main-bgcolor-transparent'] = 'rgba(31, 41, 55, 0.82)';
        theme.cssVar['--main-color'] = '#e5e7eb';
        theme.cssVar['--bgcolor'] = '#111827';
        theme.cssVar['--panel-bgcolor'] = '#0f172a';
        theme.cssVar['--panel-border-color'] = '#334155';
        theme.cssVar['--selected'] = '#60a5fa';
      } else {
        theme.cssVar['--root-bgcolor'] = '#2563eb';
        theme.cssVar['--main-bgcolor'] = '#ffffff';
        theme.cssVar['--main-bgcolor-transparent'] = 'rgba(255, 255, 255, 0.88)';
        theme.cssVar['--main-color'] = '#1f2937';
        theme.cssVar['--bgcolor'] = '#f8fafc';
        theme.cssVar['--panel-bgcolor'] = '#ffffff';
        theme.cssVar['--panel-border-color'] = '#dbe2ea';
        theme.cssVar['--selected'] = '#3b82f6';
      }
      return theme;
    }

    function resolveDarkMode() {
      var root = documentRef && documentRef.documentElement ? documentRef.documentElement : null;
      if (!root) return false;
      var theme = '';
      if (root.dataset && root.dataset.theme) {
        theme = String(root.dataset.theme || '').toLowerCase();
      } else if (typeof root.getAttribute === 'function') {
        theme = String(root.getAttribute('data-theme') || '').toLowerCase();
      }
      return theme === 'dark';
    }

    function syncDetachedGhostTheme(ghostEl, instance) {
      if (!ghostEl || !instance || !instance.container || typeof getComputedStyleFn !== 'function') return;
      var styles = null;
      try {
        styles = getComputedStyleFn(instance.container);
      } catch (err) {
        styles = null;
      }
      if (!styles || !ghostEl.style || typeof styles.getPropertyValue !== 'function') return;
      var mainBg = styles.getPropertyValue('--main-bgcolor');
      var mainColor = styles.getPropertyValue('--main-color');
      if (mainBg) ghostEl.style.backgroundColor = String(mainBg).trim();
      if (mainColor) {
        var color = String(mainColor).trim();
        if (color) {
          ghostEl.style.borderColor = color;
          ghostEl.style.color = color;
        }
      }
    }

    return {
      buildTheme: buildTheme,
      resolveDarkMode: resolveDarkMode,
      syncDetachedGhostTheme: syncDetachedGhostTheme,
    };
  }

  return { create: create };
});
