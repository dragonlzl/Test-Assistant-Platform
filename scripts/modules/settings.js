(function() {
  window.app = window.app || {};

  function init(ctx) {
    if (!ctx) return {};
    var state = ctx.state || {};
    var config = ctx.config || {};
    var utils = ctx.utils || {};
    var api = window.app && window.app.apiClient;
    var setStatus = ctx.setStatus || utils.setStatus || function noop() {};
    var escapeHtml = typeof utils.escapeHtml === 'function'
      ? utils.escapeHtml
      : function(text) {
          if (text === null || text === undefined) return '';
          return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
        };
    var clampTimeoutSeconds = ctx.clampTimeoutSeconds || function clampTimeoutSeconds(value) {
      var num = Math.round(Number(value));
      var min = config.minModelTimeoutSec || 30;
      var max = config.maxModelTimeoutSec || 1800;
      var fallback = config.defaultSettings && config.defaultSettings.timeoutSec ? config.defaultSettings.timeoutSec : 300;
      if (!Number.isFinite(num) || num <= 0) return fallback;
      return Math.min(max, Math.max(min, num));
    };
    var renderTempExecView = ctx.renderTempExecView || function noopRender() {};
    var dom = ctx.dom || {};
    var modelTimeoutInput = dom.modelTimeoutInput || document.getElementById('modelTimeoutInput');
    var modelTimeoutStatus = dom.modelTimeoutStatus || document.getElementById('modelTimeoutStatus');
    var feishuWebhookInput = dom.feishuWebhookInput || document.getElementById('feishuWebhook');
    var feishuMentionInput = dom.feishuMentionInput || document.getElementById('feishuNotifyUser');
    var feishuWebhookStatus = dom.feishuWebhookStatus || document.getElementById('feishuWebhookStatus');
    var tempExecColumnForm = dom.tempExecColumnForm || document.getElementById('tempExecColumnForm');
    var tempExecColumnStatus = dom.tempExecColumnStatus || document.getElementById('tempExecColumnStatus');
    var saveModelTimeoutBtn = dom.saveModelTimeoutBtn || document.getElementById('saveModelTimeout');
    var saveFeishuWebhookBtn = dom.saveFeishuWebhookBtn || document.getElementById('saveFeishuWebhook');
    var testFeishuWebhookBtn = dom.testFeishuWebhookBtn || document.getElementById('testFeishuWebhook');
    var saveTempExecColumnsBtn = dom.saveTempExecColumnsBtn || document.getElementById('saveTempExecColumns');
    var tempExecPageSizeInput = dom.tempExecPageSizeInput || document.getElementById('tempExecPageSizeInput');
    var saveTempExecPageSizeBtn = dom.saveTempExecPageSizeBtn || document.getElementById('saveTempExecPageSize');
    var tempExecPageSizeStatus = dom.tempExecPageSizeStatus || document.getElementById('tempExecPageSizeStatus');
    var caseViewFontSizeInput = dom.caseViewFontSizeInput || document.getElementById('caseViewFontSizeInput');
    var saveCaseViewFontSizeBtn = dom.saveCaseViewFontSizeBtn || document.getElementById('saveCaseViewFontSize');
    var caseViewFontSizeStatus = dom.caseViewFontSizeStatus || document.getElementById('caseViewFontSizeStatus');
    var projectSortGrid = dom.projectSortGrid || document.getElementById('projectSortGrid');
    var projectSortStatus = dom.projectSortStatus || document.getElementById('projectSortStatus');
    var pageGuideSettingsGrid = dom.pageGuideSettingsGrid || document.getElementById('pageGuideSettingsGrid');
    var pageGuideSettingsStatus = dom.pageGuideSettingsStatus || document.getElementById('pageGuideSettingsStatus');
    var pageGuideSelectAllInput = dom.pageGuideSelectAllInput || document.getElementById('pageGuideSelectAll');
    var smartTopNavToggle = dom.smartTopNavToggle || document.getElementById('smartTopNavToggle');
    var smartTopNavStatus = dom.smartTopNavStatus || document.getElementById('smartTopNavStatus');
    var themeSelect = dom.themeSelect || document.getElementById('themeSelect');
    var saveThemeSettingBtn = dom.saveThemeSettingBtn || document.getElementById('saveThemeSetting');
    var themeSettingStatus = dom.themeSettingStatus || document.getElementById('themeSettingStatus');
    var settingsNavButtons = dom.settingsNavButtons || document.querySelectorAll('[data-settings-target]');

    var defaultSettings = config.defaultSettings || {};
    var defaultTempExecColumns = config.defaultTempExecColumns || {};
    var defaultPageGuideSwitches = config.defaultPageGuideSwitches
      || (defaultSettings && typeof defaultSettings.pageGuideSwitches === 'object' ? defaultSettings.pageGuideSwitches : {});
    var defaultTempExecPageSize = config.defaultTempExecPageSize || 20;
    var defaultTheme = defaultSettings && defaultSettings.theme ? String(defaultSettings.theme) : 'light';
    var defaultCaseViewFontSize = Number(config.defaultCaseViewFontSize)
      || (defaultSettings && defaultSettings.caseViewFontSize ? Number(defaultSettings.caseViewFontSize) : 13);
    var minCaseViewFontSize = Number(config.minCaseViewFontSize) || 11;
    var maxCaseViewFontSize = Number(config.maxCaseViewFontSize) || 16;
    var settingsKey = config.settingsKey || 'usecase-settings-v1';
    var minModelTimeoutSec = config.minModelTimeoutSec || 30;
    var maxModelTimeoutSec = config.maxModelTimeoutSec || 1800;
    var clampTempExecPageSize = typeof ctx.clampTempExecPageSize === 'function'
      ? ctx.clampTempExecPageSize
      : function(value) {
          var num = Math.round(Number(value));
          if (!Number.isFinite(num) || num <= 0) return defaultTempExecPageSize;
          return num;
        };
    var applyTempExecPageSize = typeof ctx.applyTempExecPageSize === 'function'
      ? ctx.applyTempExecPageSize
      : function(value) {
          var size = clampTempExecPageSize(value);
          state.tempExecPageSize = size;
          if (state.settings && typeof state.settings === 'object') {
            state.settings.tempExecPageSize = size;
          }
          return { size: size, changed: true };
        };
    var lastFetchAt = 0;
    var minRefreshIntervalMs = config.minSettingsRefreshIntervalMs || 1500;
    var visibilityRefreshBound = false;
    var dirtyDrafts = {
      timeoutSec: false,
      feishuWebhook: false,
      feishuMention: false,
      tempExecColumns: false,
      tempExecPageSize: false,
      caseViewFontSize: false,
      projectOrder: false,
      defaultProjectId: false,
      theme: false,
    };

    function setSettingsReady(source) {
      state.settingsReady = true;
      if (!window.app) window.app = {};
      window.app.settingsReady = true;
      try {
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
          window.dispatchEvent(new CustomEvent('app-settings-loaded', { detail: { source: source || '' } }));
        }
      } catch (err) {
        try {
          if (typeof document !== 'undefined' && typeof document.createEvent === 'function' && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            var evt = document.createEvent('CustomEvent');
            evt.initCustomEvent('app-settings-loaded', false, false, { source: source || '' });
            window.dispatchEvent(evt);
          }
        } catch (err2) {
          // ignore
        }
      }
    }

    function setSettingsPending() {
      state.settingsReady = false;
      if (!window.app) window.app = {};
      window.app.settingsReady = false;
    }

    function scrollToSettingsSection(target) {
      if (!target) return;
      var section = document.querySelector('[data-settings-section="' + target + '"]');
      if (!section) return;
      if (section.classList && section.classList.contains('collapsed')) {
        section.classList.remove('collapsed');
      }
      if (section.scrollIntoView) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    var projectSortState = {
      loading: false,
      projects: [],
      draggingId: '',
      indicator: null,
    };

    function isRequiredTempExecColumn(key) {
      return key === 'select' || key === 'title' || key === 'actual' || key === 'remark' || key === 'defect' || key === 'ops';
    }

    function ensureTempExecColumns() {
      if (!state.settings) state.settings = Object.assign({}, defaultSettings);
      var cols = state.settings.tempExecColumns && typeof state.settings.tempExecColumns === 'object'
        ? Object.assign({}, defaultTempExecColumns, state.settings.tempExecColumns)
        : Object.assign({}, defaultTempExecColumns);
      Object.keys(cols).forEach(function(key) {
        if (isRequiredTempExecColumn(key)) cols[key] = true;
      });
      cols.title = true;
      cols.actual = true;
      cols.remark = true;
      cols.defect = true;
      cols.ops = true;
      state.settings.tempExecColumns = cols;
      return cols;
    }

    function ensurePageGuideSwitches() {
      if (!state.settings) state.settings = Object.assign({}, defaultSettings);
      var base = defaultPageGuideSwitches && typeof defaultPageGuideSwitches === 'object'
        ? defaultPageGuideSwitches
        : {};
      var current = state.settings.pageGuideSwitches && typeof state.settings.pageGuideSwitches === 'object'
        ? state.settings.pageGuideSwitches
        : {};
      var merged = Object.assign({}, base);
      Object.keys(current).forEach(function(key) {
        var val = current[key];
        if (typeof val === 'boolean') merged[key] = val;
      });
      state.settings.pageGuideSwitches = merged;
      return merged;
    }

    function normalizeTheme(value) {
      var key = value === null || value === undefined ? '' : String(value).toLowerCase();
      if (key === 'dark') return 'dark';
      return 'light';
    }

    function resolveTheme(value) {
      var base = defaultTheme ? String(defaultTheme) : 'light';
      var next = value === null || value === undefined ? base : value;
      return normalizeTheme(next);
    }

    function applyTheme(theme) {
      if (typeof document === 'undefined' || !document.documentElement) return;
      var next = resolveTheme(theme);
      if (document.documentElement.dataset) {
        document.documentElement.dataset.theme = next;
      } else {
        document.documentElement.setAttribute('data-theme', next);
      }
    }

    function clampCaseViewFontSize(value) {
      var num = Math.round(Number(value));
      if (!Number.isFinite(num) || num <= 0) return defaultCaseViewFontSize;
      if (num < minCaseViewFontSize) return minCaseViewFontSize;
      if (num > maxCaseViewFontSize) return maxCaseViewFontSize;
      return num;
    }

    function applyCaseViewFontSize(value) {
      if (typeof document === 'undefined' || !document.documentElement) return;
      var base = clampCaseViewFontSize(value);
      var small = base - 1;
      if (small < minCaseViewFontSize) small = minCaseViewFontSize;
      if (document.documentElement.style && document.documentElement.style.setProperty) {
        document.documentElement.style.setProperty('--case-view-font-size', base + 'px');
        document.documentElement.style.setProperty('--case-view-font-size-sm', small + 'px');
      }
    }

    function mergeServerSettings(list) {
      // owner_id 可能是 number 或 string；同时在 authReady 时序下 currentUser 可能暂未填充。
      var userId = null;
      if (state.currentUser && (state.currentUser.id || state.currentUser.id === 0)) {
        var parsedUserId = Number(state.currentUser.id);
        if (Number.isFinite(parsedUserId)) userId = parsedUserId;
      }
      var merged = {};
      (list || []).forEach(function(item) {
        if (!item || !item.key) return;
        var isUser = item.scope === 'user';
        var isGlobal = item.scope === 'global';
        if (isGlobal && merged[item.key] === undefined) {
          merged[item.key] = item.value_json;
        }
        if (isUser) {
          if (userId === null || userId === undefined) {
            // list 已由后端按当前用户过滤，当前用户未知时直接采用 user scoped 设置。
            merged[item.key] = item.value_json;
          } else if (Number(item.owner_id) === userId) {
            merged[item.key] = item.value_json;
          }
        }
      });
      if (!state.settings || typeof state.settings !== 'object') {
        state.settings = Object.assign({}, defaultSettings);
      }
      Object.keys(merged).forEach(function(key) {
        state.settings[key] = merged[key];
      });

      // Known fields normalization
      state.settings.timeoutSec = clampTimeoutSeconds(state.settings.timeoutSec);
      if (typeof state.settings.feishuWebhook === 'string') {
        state.settings.feishuWebhook = state.settings.feishuWebhook.trim();
      }
      if (typeof state.settings.feishuMention === 'string') {
        state.settings.feishuMention = state.settings.feishuMention.trim();
      } else if (state.settings.feishuMention === null || state.settings.feishuMention === undefined) {
        state.settings.feishuMention = '';
      }
      if (state.settings.tempExecColumns && typeof state.settings.tempExecColumns === 'object') {
        state.settings.tempExecColumns = Object.assign({}, defaultTempExecColumns, state.settings.tempExecColumns);
      }
      if (state.settings.tempExecPageSize !== undefined && state.settings.tempExecPageSize !== null) {
        var size = clampTempExecPageSize(state.settings.tempExecPageSize);
        state.tempExecPageSize = size;
        state.settings.tempExecPageSize = size;
      }
      if (state.settings.caseViewFontSize !== undefined && state.settings.caseViewFontSize !== null) {
        state.settings.caseViewFontSize = clampCaseViewFontSize(state.settings.caseViewFontSize);
      } else {
        state.settings.caseViewFontSize = defaultCaseViewFontSize;
      }
      if (state.settings.smartTopNavCollapse === undefined || state.settings.smartTopNavCollapse === null) {
        state.settings.smartTopNavCollapse = defaultSettings.smartTopNavCollapse === true;
      } else {
        state.settings.smartTopNavCollapse = state.settings.smartTopNavCollapse === true;
      }
      ensurePageGuideSwitches();
      ensureTempExecColumns();
      state.settings.theme = resolveTheme(state.settings.theme);
      applyTheme(state.settings.theme);
      applyCaseViewFontSize(state.settings.caseViewFontSize);
      setSettingsReady('server');
      // 如果执行页已打开，主动刷新以应用远端列/分页设置。
      try {
        renderTempExecView();
      } catch (err) {
        // ignore render failures
      }
    }

    function fetchSettingsFromServer() {
      if (!api || typeof api.listSettings !== 'function') return;
      lastFetchAt = Date.now();
      if (typeof api.getStoredToken === 'function' && typeof api.setToken === 'function') {
        var stored = api.getStoredToken();
        if (stored) api.setToken(stored);
      }
      var ownerId = state.currentUser && state.currentUser.id;
      var ready = state.authReady || (window.app && window.app.authReady);
      if (!ownerId && !ready) {
        setTimeout(fetchSettingsFromServer, 200);
        return;
      }
      api.listSettings('all', ownerId).then(function(list) {
        mergeServerSettings(list || []);
        renderSettingsUI();
      }).catch(function(err) {
        console.warn('加载设置失败', err);
      });
    }

    function requestSettingsRefresh(reason) {
      var ready = state.authReady || (window.app && window.app.authReady);
      if (!ready) return;
      var now = Date.now();
      if (now - lastFetchAt < minRefreshIntervalMs) return;
      lastFetchAt = now;
      fetchSettingsFromServer();
    }

    function bindVisibilityRefresh() {
      if (visibilityRefreshBound) return;
      visibilityRefreshBound = true;
      try {
        window.addEventListener('focus', function() {
          try {
            if (typeof document !== 'undefined' && document.hidden) return;
          } catch (err) {
            // ignore
          }
          requestSettingsRefresh('focus');
        });
      } catch (err) {
        // ignore
      }
      try {
        if (typeof document !== 'undefined' && document.addEventListener) {
          document.addEventListener('visibilitychange', function() {
            try {
              if (document.hidden) return;
            } catch (err) {
              // ignore
            }
            requestSettingsRefresh('visibility');
          });
        }
      } catch (err) {
        // ignore
      }
    }

    function collectSettingItems(keys) {
      var items = [];
      var onlyKeys = Array.isArray(keys) && keys.length
        ? keys.map(function(k) { return String(k); })
        : null;
      function shouldInclude(key) {
        if (!onlyKeys) return true;
        return onlyKeys.indexOf(key) !== -1;
      }
      if (state.settings && typeof state.settings === 'object') {
        Object.keys(state.settings).forEach(function(key) {
          if (!key) return;
          if (!shouldInclude(key)) return;
          var val = state.settings[key];
          if (val === undefined) return;
          if (typeof val === 'function') return;
          items.push({ key: key, value_json: val });
        });
      }
      // Backward compatibility: ensure page size is saved even if only stored on state.tempExecPageSize
      var needPageSize = !onlyKeys || onlyKeys.indexOf('tempExecPageSize') !== -1;
      if (needPageSize) {
        var hasPageSize = items.some(function(it) { return it.key === 'tempExecPageSize'; });
        if (!hasPageSize) {
          items.push({
            key: 'tempExecPageSize',
            value_json: state.tempExecPageSize || defaultTempExecPageSize,
          });
        }
      }
      return items;
    }

    function persistSettingsRemote(keys) {
      if (!api || typeof api.saveSettings !== 'function') return;
      if (typeof api.getStoredToken === 'function' && typeof api.setToken === 'function') {
        var stored = api.getStoredToken();
        if (stored) api.setToken(stored);
      }
      var items = collectSettingItems(keys);
      if (!items.length) return;
      api.saveSettings('user', items).then(function(savedList) {
        try {
          if (Array.isArray(savedList) && savedList.length) {
            mergeServerSettings(savedList);
            renderSettingsUI();
          }
        } catch (err) {
          // ignore merge failures; local already updated
        }
      }).catch(function(err) {
        console.warn('保存设置到后端失败', err);
      });
    }

    function bindAuthReady() {
      try {
        window.addEventListener('app-auth-ready', function() {
          fetchSettingsFromServer();
        });
      } catch (err) {
        // ignore
      }
    }

    function loadSettings() {
      setSettingsPending();
      if (!state.settings || typeof state.settings !== 'object') {
        state.settings = Object.assign({}, defaultSettings);
      }
      // DB-first：当检测到已登录（本地有 token 且后端设置接口可用）时，不使用本地缓存覆盖，
      // 以避免多端同号时出现本地旧值抢占；无登录/无后端时继续使用 localStorage 作为回退。
      var shouldUseLocal = true;
      try {
        if (api && typeof api.listSettings === 'function' && typeof api.getStoredToken === 'function') {
          var token = api.getStoredToken();
          if (token) shouldUseLocal = false;
        }
      } catch (err) {
        shouldUseLocal = true;
      }
      if (shouldUseLocal) {
        var saved = {};
        try {
          saved = JSON.parse(localStorage.getItem(settingsKey) || '{}') || {};
        } catch (err) {
          console.warn('调用设置加载失败', err);
          saved = {};
        }
        if (saved && typeof saved === 'object') {
          Object.keys(saved).forEach(function(key) {
            if (!Object.prototype.hasOwnProperty.call(saved, key)) return;
            var val = saved[key];
            if (val === undefined) return;
            state.settings[key] = val;
          });
        }
      }

      // Known fields normalization
      state.settings.timeoutSec = clampTimeoutSeconds(state.settings.timeoutSec);
      if (typeof state.settings.feishuWebhook === 'string') {
        state.settings.feishuWebhook = state.settings.feishuWebhook.trim();
      } else if (state.settings.feishuWebhook === null || state.settings.feishuWebhook === undefined) {
        state.settings.feishuWebhook = defaultSettings.feishuWebhook || '';
      }
      if (typeof state.settings.feishuMention === 'string') {
        state.settings.feishuMention = state.settings.feishuMention.trim();
      } else {
        state.settings.feishuMention = '';
      }
      if (state.settings.tempExecColumns && typeof state.settings.tempExecColumns === 'object') {
        state.settings.tempExecColumns = Object.assign({}, defaultTempExecColumns, state.settings.tempExecColumns);
      }
      if (state.settings.tempExecPageSize !== undefined && state.settings.tempExecPageSize !== null) {
        var size = clampTempExecPageSize(state.settings.tempExecPageSize);
        state.tempExecPageSize = size;
        state.settings.tempExecPageSize = size;
      } else if (state.tempExecPageSize !== undefined && state.tempExecPageSize !== null) {
        state.settings.tempExecPageSize = state.tempExecPageSize;
      } else {
        state.tempExecPageSize = defaultTempExecPageSize;
        state.settings.tempExecPageSize = defaultTempExecPageSize;
      }
      if (state.settings.caseViewFontSize !== undefined && state.settings.caseViewFontSize !== null) {
        state.settings.caseViewFontSize = clampCaseViewFontSize(state.settings.caseViewFontSize);
      } else {
        state.settings.caseViewFontSize = defaultCaseViewFontSize;
      }
      if (state.settings.smartTopNavCollapse === undefined || state.settings.smartTopNavCollapse === null) {
        state.settings.smartTopNavCollapse = defaultSettings.smartTopNavCollapse === true;
      } else {
        state.settings.smartTopNavCollapse = state.settings.smartTopNavCollapse === true;
      }
      ensurePageGuideSwitches();
      ensureTempExecColumns();
      state.settings.theme = resolveTheme(state.settings.theme);
      applyTheme(state.settings.theme);
      applyCaseViewFontSize(state.settings.caseViewFontSize);

      if (!Array.isArray(state.settings.projectOrder)) state.settings.projectOrder = [];
      state.settings.projectOrder = state.settings.projectOrder
        .map(function(v) { return v === null || v === undefined ? '' : String(v); })
        .filter(Boolean);
      if (state.settings.defaultProjectId === null || state.settings.defaultProjectId === undefined) {
        state.settings.defaultProjectId = '';
      } else {
        state.settings.defaultProjectId = String(state.settings.defaultProjectId || '');
      }
      if (shouldUseLocal) setSettingsReady('local');
    }

    function persistSettings(keys) {
      try {
        localStorage.setItem(settingsKey, JSON.stringify(state.settings));
      } catch (err) {
        console.warn('调用设置保存失败', err);
      }
      persistSettingsRemote(keys);
    }

    function renderTempExecColumnSettings() {
      if (!tempExecColumnForm) return;
      if (dirtyDrafts.tempExecColumns) return;
      var cols = ensureTempExecColumns();
      var inputs = tempExecColumnForm.querySelectorAll('input[data-temp-exec-col]');
      inputs.forEach(function(input) {
        var key = input.dataset.tempExecCol;
        if (!key) return;
        var required = isRequiredTempExecColumn(key);
        input.checked = required ? true : cols[key] !== false;
        input.disabled = required;
      });
      setStatus(tempExecColumnStatus, '', '');
    }

    function renderPageGuideSettings() {
      if (!pageGuideSettingsGrid) return;
      var switches = ensurePageGuideSwitches();
      var inputs = pageGuideSettingsGrid.querySelectorAll('input[data-page-guide]');
      inputs.forEach(function(input) {
        var key = input && input.dataset ? input.dataset.pageGuide : '';
        if (!key) return;
        input.checked = switches[key] !== false;
      });
      updatePageGuideSelectAllState();
      setStatus(pageGuideSettingsStatus, '', '');
    }

    function renderSettingsUI() {
      if (modelTimeoutInput) {
        if (!dirtyDrafts.timeoutSec) {
          modelTimeoutInput.value = state.settings.timeoutSec;
        }
      }
      if (feishuWebhookInput) {
        if (!dirtyDrafts.feishuWebhook) {
          feishuWebhookInput.value = state.settings.feishuWebhook || '';
        }
      }
      if (feishuMentionInput) {
        if (!dirtyDrafts.feishuMention) {
          feishuMentionInput.value = state.settings.feishuMention || '';
        }
      }
      if (tempExecPageSizeInput) {
        if (!dirtyDrafts.tempExecPageSize) {
          tempExecPageSizeInput.value = state.tempExecPageSize || defaultTempExecPageSize || '';
        }
      }
      if (caseViewFontSizeInput) {
        if (!dirtyDrafts.caseViewFontSize) {
          caseViewFontSizeInput.value = state.settings.caseViewFontSize || defaultCaseViewFontSize || '';
        }
      }
      if (themeSelect) {
        if (!dirtyDrafts.theme) {
          themeSelect.value = resolveTheme(state.settings.theme);
        }
      }
      if (smartTopNavToggle) {
        smartTopNavToggle.checked = state.settings.smartTopNavCollapse === true;
        setStatus(smartTopNavStatus, '', '');
      }
      renderTempExecColumnSettings();
      renderPageGuideSettings();
      renderProjectSortSetting();
    }

    function normalizeProjectList(list) {
      return (Array.isArray(list) ? list : [])
        .filter(function(p) { return p && p.id !== null && p.id !== undefined; })
        .map(function(p) {
          return { id: p.id, name: p.name || ('项目#' + p.id) };
        });
    }

    function sortProjectsBySetting(list) {
      var projects = Array.isArray(list) ? list.slice() : [];
      var order = state.settings && Array.isArray(state.settings.projectOrder) ? state.settings.projectOrder : [];
      var rank = {};
      order.forEach(function(id, idx) {
        var key = id === null || id === undefined ? '' : String(id);
        if (!key) return;
        if (rank[key] === undefined) rank[key] = idx;
      });
      projects.forEach(function(p, idx) {
        if (!p) return;
        p.__idx = idx;
      });
      projects.sort(function(a, b) {
        var aid = a && a.id !== null && a.id !== undefined ? String(a.id) : '';
        var bid = b && b.id !== null && b.id !== undefined ? String(b.id) : '';
        var ra = rank[aid];
        var rb = rank[bid];
        var hasA = ra !== undefined && ra !== null;
        var hasB = rb !== undefined && rb !== null;
        if (hasA && hasB) return Number(ra) - Number(rb);
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        var ia = a && a.__idx !== undefined ? Number(a.__idx) : 0;
        var ib = b && b.__idx !== undefined ? Number(b.__idx) : 0;
        return ia - ib;
      });
      projects.forEach(function(p) {
        if (!p) return;
        try { delete p.__idx; } catch (_) {}
      });
      return projects;
    }

    function ensureProjectOrderForProjects(projects) {
      var list = Array.isArray(projects) ? projects : [];
      var ids = list.map(function(p) { return p && p.id !== null && p.id !== undefined ? String(p.id) : ''; }).filter(Boolean);
      var existing = state.settings && Array.isArray(state.settings.projectOrder) ? state.settings.projectOrder.slice() : [];
      existing = existing.map(function(v) { return v === null || v === undefined ? '' : String(v); }).filter(Boolean);
      var hasUserOrder = existing.length > 0;

      var changed = false;
      var merged = existing.slice();
      if (hasUserOrder) {
        var filtered = existing.filter(function(id) { return ids.indexOf(id) !== -1; });
        var missing = ids.filter(function(id) { return filtered.indexOf(id) === -1; });
        merged = filtered.concat(missing);
        changed =
          merged.length !== existing.length ||
          merged.some(function(id, idx) { return String(existing[idx] || '') !== String(id || ''); });
        if (changed) {
          state.settings.projectOrder = merged.slice();
        }
      }

      var def = state.settings && state.settings.defaultProjectId ? String(state.settings.defaultProjectId || '') : '';
      var defChanged = false;
      if (def && ids.indexOf(def) === -1) {
        def = '';
        state.settings.defaultProjectId = '';
        defChanged = true;
      }
      // 仅一个所属项目时：默认选中并写入，避免用户每次都要点一次。
      if (!def && ids.length === 1) {
        def = ids[0];
        state.settings.defaultProjectId = def;
        defChanged = true;
      }
      // 仅当用户已配置项目排序（或已手动选择默认项目）时，才自动补齐默认项目，避免无意间影响旧的项目/版本排序策略。
      if (!def && hasUserOrder && merged.length) {
        def = merged[0];
        state.settings.defaultProjectId = def;
        defChanged = true;
      }
      return { changed: Boolean(changed || defChanged), order: hasUserOrder ? merged : ids, defaultProjectId: def };
    }

    function renderProjectSortSetting() {
      if (!projectSortGrid) return;
      if (projectSortState.loading) return;
      if (!api || typeof api.listProjects !== 'function') {
        projectSortGrid.innerHTML = '<p class="hint">当前模式不支持项目排序（需启用 DB 后端）</p>';
        return;
      }
      if (!projectSortState.projects || !projectSortState.projects.length) {
        projectSortState.loading = true;
        if (projectSortStatus) setStatus(projectSortStatus, '加载项目中...', '');
        api.listProjects().then(function(list) {
          projectSortState.projects = sortProjectsBySetting(normalizeProjectList(list));
          var res = ensureProjectOrderForProjects(projectSortState.projects);
          projectSortState.projects = sortProjectsBySetting(projectSortState.projects);
          renderProjectSortCards();
          if (projectSortStatus) setStatus(projectSortStatus, '', '');
          if (res && res.changed) {
            dirtyDrafts.projectOrder = false;
            dirtyDrafts.defaultProjectId = false;
            persistSettings(['projectOrder', 'defaultProjectId']);
          }
        }).catch(function(err) {
          projectSortState.projects = [];
          renderProjectSortCards();
          if (projectSortStatus) setStatus(projectSortStatus, err && err.message ? err.message : '加载项目失败', 'err');
        }).finally(function() {
          projectSortState.loading = false;
        });
        return;
      }
      renderProjectSortCards();
    }

    function renderProjectSortCards() {
      if (!projectSortGrid) return;
      var list = sortProjectsBySetting(projectSortState.projects || []);
      var ids = list.map(function(p) { return p && p.id !== null && p.id !== undefined ? String(p.id) : ''; }).filter(Boolean);
      var def = state.settings && state.settings.defaultProjectId ? String(state.settings.defaultProjectId || '') : '';
      if (def && ids.indexOf(def) === -1) def = '';
      if (!def) def = ids.length ? ids[0] : '';
      var html = list.map(function(p, idx) {
        if (!p) return '';
        var pid = p.id !== null && p.id !== undefined ? String(p.id) : '';
        if (!pid) return '';
        var cls = ['project-sort-card'];
        if (pid === def) cls.push('selected');
        var tags = [
          '<span class="rank">#' + (idx + 1) + '</span>',
        ];
        if (pid === def) tags.push('<span class="default">默认</span>');
        var name = escapeHtml(p.name || '');
        return (
          '<div class="' + cls.join(' ') + '" draggable="true" data-project-sort-id="' + pid + '">' +
            '<div class="name" title="' + name + '">' + name + '</div>' +
            '<div class="meta">' + tags.join('') + '</div>' +
          '</div>'
        );
      }).join('');
      if (!html) {
        projectSortGrid.innerHTML = '<p class="hint">暂无可排序项目</p>';
        return;
      }
      projectSortGrid.innerHTML = html;
    }

    function cleanupProjectSortIndicator() {
      var indicator = projectSortState.indicator;
      if (indicator && indicator.parentNode) {
        try { indicator.parentNode.removeChild(indicator); } catch (_) {}
      }
      projectSortState.indicator = null;
    }

    function ensureProjectSortIndicator() {
      if (projectSortState.indicator) return projectSortState.indicator;
      var el = document.createElement('div');
      el.className = 'project-sort-indicator';
      el.setAttribute('aria-hidden', 'true');
      projectSortState.indicator = el;
      return el;
    }

    function bindProjectSortEvents() {
      if (!projectSortGrid) return;
      if (projectSortGrid.dataset && projectSortGrid.dataset.bound === '1') return;
      if (projectSortGrid.dataset) projectSortGrid.dataset.bound = '1';

      projectSortGrid.addEventListener('click', function(e) {
        var card = e && e.target && e.target.closest ? e.target.closest('[data-project-sort-id]') : null;
        if (!card || !card.dataset) return;
        var pid = card.dataset.projectSortId || '';
        if (!pid) return;
        state.settings.defaultProjectId = String(pid);
        dirtyDrafts.defaultProjectId = false;
        persistSettings(['defaultProjectId']);
        renderProjectSortCards();
        if (projectSortStatus) setStatus(projectSortStatus, '默认项目已更新', 'ok');
      });

      projectSortGrid.addEventListener('dragstart', function(e) {
        var card = e && e.target && e.target.closest ? e.target.closest('[data-project-sort-id]') : null;
        if (!card || !card.dataset) return;
        var pid = card.dataset.projectSortId || '';
        if (!pid) return;
        projectSortState.draggingId = pid;
        try {
          card.classList.add('dragging');
        } catch (_) {}
        if (e.dataTransfer) {
          try { e.dataTransfer.setData('text/project-sort', pid); } catch (_) {}
          try { e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
        }
      });

      projectSortGrid.addEventListener('dragover', function(e) {
        var draggingId = projectSortState.draggingId || '';
        if (!draggingId) {
          try {
            draggingId = e && e.dataTransfer ? (e.dataTransfer.getData('text/project-sort') || '') : '';
          } catch (_) {}
        }
        if (!draggingId) return;
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        var card = e && e.target && e.target.closest ? e.target.closest('[data-project-sort-id]') : null;
        if (!card || !card.dataset) {
          // 指示框插入后可能会成为 hover 目标（尤其在 grid gap/落点框上），这里不主动清理避免闪动。
          return;
        }
        var rect = card.getBoundingClientRect ? card.getBoundingClientRect() : null;
        if (!rect) return;
        var after = e && typeof e.clientX === 'number' ? (e.clientX - rect.left > rect.width / 2) : false;
        var indicator = ensureProjectSortIndicator();
        indicator.dataset.dropAfter = after ? '1' : '0';
        indicator.dataset.dropTargetId = card.dataset.projectSortId || '';
        var ref = after ? card.nextSibling : card;
        if (ref !== indicator) {
          try {
            projectSortGrid.insertBefore(indicator, ref);
          } catch (_) {}
        }
      });

      projectSortGrid.addEventListener('dragleave', function(e) {
        if (!e || e.currentTarget !== projectSortGrid) return;
        if (e.target !== projectSortGrid) return;
        cleanupProjectSortIndicator();
      });

      projectSortGrid.addEventListener('dragend', function() {
        cleanupProjectSortIndicator();
        projectSortState.draggingId = '';
        try {
          projectSortGrid.querySelectorAll('.project-sort-card.dragging').forEach(function(node) {
            if (!node) return;
            node.classList.remove('dragging');
          });
        } catch (_) {}
      });

      projectSortGrid.addEventListener('drop', function(e) {
        var draggingId = projectSortState.draggingId || '';
        if (!draggingId) {
          try {
            draggingId = e && e.dataTransfer ? (e.dataTransfer.getData('text/project-sort') || '') : '';
          } catch (_) {}
        }
        if (!draggingId) return;
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        var indicator = projectSortState.indicator;
        var targetId = indicator && indicator.dataset ? (indicator.dataset.dropTargetId || '') : '';
        var after = indicator && indicator.dataset ? (indicator.dataset.dropAfter === '1') : false;
        cleanupProjectSortIndicator();
        projectSortState.draggingId = '';
        if (!targetId || targetId === draggingId) return;

        var list = sortProjectsBySetting(projectSortState.projects || []);
        var ids = list.map(function(p) { return p && p.id !== null && p.id !== undefined ? String(p.id) : ''; }).filter(Boolean);
        var fromIdx = ids.indexOf(String(draggingId));
        var toIdx = ids.indexOf(String(targetId));
        if (fromIdx === -1 || toIdx === -1) return;
        ids.splice(fromIdx, 1);
        if (fromIdx < toIdx) toIdx -= 1;
        var insertAt = after ? toIdx + 1 : toIdx;
        if (insertAt < 0) insertAt = 0;
        if (insertAt > ids.length) insertAt = ids.length;
        ids.splice(insertAt, 0, String(draggingId));
        state.settings.projectOrder = ids.slice();
        dirtyDrafts.projectOrder = false;
        persistSettings(['projectOrder']);
        // 重新按新顺序刷新卡片
        projectSortState.projects = sortProjectsBySetting(projectSortState.projects || []);
        renderProjectSortCards();
        if (projectSortStatus) setStatus(projectSortStatus, '项目排序已更新', 'ok');
      });
    }


    function saveTimeoutSetting() {
      if (!modelTimeoutInput) return;
      var raw = modelTimeoutInput.value.trim();
      if (!raw) {
        setStatus(modelTimeoutStatus, '请输入 ' + minModelTimeoutSec + '-' + maxModelTimeoutSec + ' 秒之间的数值', 'warn');
        return;
      }
      var sec = clampTimeoutSeconds(raw);
      if (sec !== Number(raw)) {
        modelTimeoutInput.value = sec;
      }
      state.settings.timeoutSec = sec;
      dirtyDrafts.timeoutSec = false;
      persistSettings(['timeoutSec']);
      setStatus(modelTimeoutStatus, '模型调用超时已更新为 ' + sec + ' 秒', 'ok');
    }

    function applyFeishuInput() {
      var webhook = feishuWebhookInput ? feishuWebhookInput.value.trim() : '';
      var mention = feishuMentionInput ? feishuMentionInput.value.trim() : '';
      state.settings.feishuWebhook = webhook;
      state.settings.feishuMention = mention;
      dirtyDrafts.feishuWebhook = false;
      dirtyDrafts.feishuMention = false;
      persistSettings(['feishuWebhook', 'feishuMention']);
      return webhook;
    }

    function getFeishuWebhookUrl() {
      return (state.settings && typeof state.settings.feishuWebhook === 'string' ? state.settings.feishuWebhook : '').trim();
    }

    function getFeishuMentionId() {
      return (state.settings && typeof state.settings.feishuMention === 'string' ? state.settings.feishuMention : '').trim();
    }

    async function postFeishuMessage(text, options) {
      var opts = options || {};
      var allowOpaqueFallback = opts.allowOpaqueFallback !== false;
      var url = getFeishuWebhookUrl();
      if (!url) return { ok: false, reason: '未配置 Webhook' };
      var mentionId = getFeishuMentionId();
      var suffix = mentionId ? '\n<at user_id="' + mentionId + '">提醒</at>' : '';
      var payload = JSON.stringify({ msg_type: 'text', content: { text: String(text || '') + suffix } });
      async function sendJsonRequest() {
        var res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
        if (!res.ok) {
          var body = await res.text().catch(function() { return ''; });
          throw new Error(body ? ('HTTP ' + res.status + '：' + body.slice(0, 120)) : ('HTTP ' + res.status));
        }
        await res.text().catch(function() { return ''; });
      }
      async function sendOpaqueRequest() {
        await fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: payload,
        });
      }
      try {
        await sendJsonRequest();
        return { ok: true };
      } catch (err) {
        if (!allowOpaqueFallback) {
          console.warn('飞书通知发送失败', err);
          return { ok: false, reason: err && err.message ? err.message : '网络异常' };
        }
        console.warn('飞书通知发送失败，尝试以 no-cors 方式发送', err);
        try {
          await sendOpaqueRequest();
          return { ok: true, opaque: true };
        } catch (fallbackErr) {
          console.warn('飞书通知 opaque 发送仍失败', fallbackErr);
          return { ok: false, reason: fallbackErr && fallbackErr.message ? fallbackErr.message : '网络异常' };
        }
      }
    }

    function saveFeishuWebhookConfig() {
      if (!feishuWebhookStatus) return;
      var value = applyFeishuInput();
      if (value) {
        setStatus(feishuWebhookStatus, '飞书 Webhook 已保存，执行结果会自动通知', 'ok');
      } else {
        setStatus(feishuWebhookStatus, '已清除 Webhook，不再发送执行通知', 'ok');
      }
    }

    async function testFeishuWebhookConfig() {
      if (!feishuWebhookStatus) return;
      var value = applyFeishuInput();
      if (!value) {
        setStatus(feishuWebhookStatus, '请先填写飞书机器人 Webhook 地址', 'warn');
        return;
      }
      setStatus(feishuWebhookStatus, '正在发送测试通知...', '');
      var result = await postFeishuMessage('【测试】已成功接入用例助手飞书通知，请忽略本消息。', { allowOpaqueFallback: true });
      if (result.ok && !result.opaque) {
        setStatus(feishuWebhookStatus, '测试通知已发送，可在飞书群内查看', 'ok');
      } else if (result.ok && result.opaque) {
        setStatus(feishuWebhookStatus, '请求已发送（目标接口未返回 CORS 结果），请在飞书群确认是否收到', 'warn');
      } else {
        setStatus(feishuWebhookStatus, '发送失败：' + (result.reason || '未知错误'), 'err');
      }
    }

    function saveTempExecColumnsSetting() {
      if (!tempExecColumnForm) return;
      var inputs = tempExecColumnForm.querySelectorAll('input[data-temp-exec-col]');
      var nextCols = Object.assign({}, defaultTempExecColumns);
      inputs.forEach(function(input) {
        var key = input.dataset.tempExecCol;
        if (!key) return;
        var required = isRequiredTempExecColumn(key);
        if (required) {
          nextCols[key] = true;
          input.checked = true;
          input.disabled = true;
          return;
        }
        nextCols[key] = input.checked;
      });
      state.settings.tempExecColumns = nextCols;
      ensureTempExecColumns();
      dirtyDrafts.tempExecColumns = false;
      persistSettings(['tempExecColumns']);
      renderTempExecView();
      setStatus(tempExecColumnStatus, '列显示设置已保存', 'ok');
    }

    function saveTempExecPageSize() {
      if (!tempExecPageSizeInput) return;
      var raw = tempExecPageSizeInput.value;
      var size = clampTempExecPageSize(raw);
      if (!Number.isFinite(size)) {
        setStatus(tempExecPageSizeStatus, '请输入数字', 'warn');
        return;
      }
      var result = applyTempExecPageSize(size);
      tempExecPageSizeInput.value = size;
      state.tempExecPageSize = size;
      if (state.settings && typeof state.settings === 'object') {
        state.settings.tempExecPageSize = size;
      }
      dirtyDrafts.tempExecPageSize = false;
      persistSettings(['tempExecPageSize']);
      notifyPageSizeChange(size);
      if (result.changed) {
        setStatus(tempExecPageSizeStatus, '全局分页设置已更新', 'ok');
      } else {
        setStatus(tempExecPageSizeStatus, '全局分页设置未变化', '');
      }
    }

    function saveCaseViewFontSize() {
      if (!caseViewFontSizeInput) return;
      var raw = caseViewFontSizeInput.value;
      var size = clampCaseViewFontSize(raw);
      if (!Number.isFinite(size)) {
        setStatus(caseViewFontSizeStatus, '请输入 ' + minCaseViewFontSize + '-' + maxCaseViewFontSize + ' 之间的数值', 'warn');
        return;
      }
      var prev = state.settings.caseViewFontSize;
      caseViewFontSizeInput.value = size;
      state.settings.caseViewFontSize = size;
      dirtyDrafts.caseViewFontSize = false;
      persistSettings(['caseViewFontSize']);
      applyCaseViewFontSize(size);
      if (!caseViewFontSizeStatus) return;
      if (prev === size) {
        setStatus(caseViewFontSizeStatus, '用例视图字号保持为 ' + size + 'px', 'ok');
      } else {
        setStatus(caseViewFontSizeStatus, '用例视图字号已更新为 ' + size + 'px', 'ok');
      }
    }

    function getThemeLabel(theme) {
      return theme === 'dark' ? '黑色主题' : '白色主题';
    }

    function saveThemeSetting() {
      if (!themeSelect) return;
      var next = resolveTheme(themeSelect.value);
      var prev = resolveTheme(state.settings.theme);
      state.settings.theme = next;
      dirtyDrafts.theme = false;
      persistSettings(['theme']);
      applyTheme(next);
      if (!themeSettingStatus) return;
      if (prev === next) {
        setStatus(themeSettingStatus, '主题已保存，保持为' + getThemeLabel(next), 'ok');
      } else {
        setStatus(themeSettingStatus, '主题已保存并切换为' + getThemeLabel(next), 'ok');
      }
    }

    function notifyPageSizeChange(size) {
      if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
      var detail = { size: size };
      try {
        window.dispatchEvent(new CustomEvent('app-page-size-changed', { detail: detail }));
      } catch (err) {
        try {
          var evt = document.createEvent('CustomEvent');
          evt.initCustomEvent('app-page-size-changed', false, false, detail);
          window.dispatchEvent(evt);
        } catch (err2) {
          // ignore
        }
      }
    }

    function handlePageGuideChange(e) {
      var target = e && e.target;
      if (!target) return;
      if (target.dataset && target.dataset.pageGuideAll) {
        setAllPageGuideSwitches(Boolean(target.checked));
        return;
      }
      if (!target.dataset || !target.dataset.pageGuide) return;
      var key = target.dataset.pageGuide;
      var switches = ensurePageGuideSwitches();
      switches[key] = Boolean(target.checked);
      state.settings.pageGuideSwitches = switches;
      persistSettings(['pageGuideSwitches']);
      updatePageGuideSelectAllState();
      setStatus(pageGuideSettingsStatus, '页面说明设置已保存', 'ok');
    }

    function setAllPageGuideSwitches(enabled) {
      var switches = ensurePageGuideSwitches();
      Object.keys(switches).forEach(function(key) {
        switches[key] = Boolean(enabled);
      });
      state.settings.pageGuideSwitches = switches;
      if (pageGuideSettingsGrid) {
        var inputs = pageGuideSettingsGrid.querySelectorAll('input[data-page-guide]');
        inputs.forEach(function(input) {
          input.checked = Boolean(enabled);
        });
      }
      if (pageGuideSelectAllInput) {
        pageGuideSelectAllInput.checked = Boolean(enabled);
        pageGuideSelectAllInput.indeterminate = false;
      }
      persistSettings(['pageGuideSwitches']);
      setStatus(pageGuideSettingsStatus, enabled ? '已全部开启' : '已全部关闭', 'ok');
    }

    function updatePageGuideSelectAllState() {
      if (!pageGuideSelectAllInput || !pageGuideSettingsGrid) return;
      var inputs = pageGuideSettingsGrid.querySelectorAll('input[data-page-guide]');
      var allChecked = true;
      var anyChecked = false;
      inputs.forEach(function(input) {
        if (input.checked) {
          anyChecked = true;
        } else {
          allChecked = false;
        }
      });
      if (!inputs.length) {
        pageGuideSelectAllInput.checked = false;
        pageGuideSelectAllInput.indeterminate = false;
        return;
      }
      pageGuideSelectAllInput.checked = allChecked;
      pageGuideSelectAllInput.indeterminate = !allChecked && anyChecked;
    }

    function handleSmartTopNavChange(e) {
      var target = e && e.target;
      if (!target) return;
      state.settings.smartTopNavCollapse = Boolean(target.checked);
      persistSettings(['smartTopNavCollapse']);
      setStatus(smartTopNavStatus, target.checked ? '导航栏智能收起已开启' : '导航栏智能收起已关闭', 'ok');
    }

    function bindEvents() {
      if (saveModelTimeoutBtn) saveModelTimeoutBtn.addEventListener('click', saveTimeoutSetting);
      if (modelTimeoutInput) modelTimeoutInput.addEventListener('input', function() {
        dirtyDrafts.timeoutSec = true;
        setStatus(modelTimeoutStatus, '', '');
      });
      if (saveFeishuWebhookBtn) saveFeishuWebhookBtn.addEventListener('click', saveFeishuWebhookConfig);
      if (testFeishuWebhookBtn) testFeishuWebhookBtn.addEventListener('click', testFeishuWebhookConfig);
      if (feishuWebhookInput) feishuWebhookInput.addEventListener('input', function() {
        dirtyDrafts.feishuWebhook = true;
        setStatus(feishuWebhookStatus, '', '');
      });
      if (feishuMentionInput) feishuMentionInput.addEventListener('input', function() {
        dirtyDrafts.feishuMention = true;
        setStatus(feishuWebhookStatus, '', '');
      });
      if (tempExecColumnForm) tempExecColumnForm.addEventListener('change', function() {
        saveTempExecColumnsSetting();
      });
      if (saveTempExecPageSizeBtn) saveTempExecPageSizeBtn.addEventListener('click', saveTempExecPageSize);
      if (tempExecPageSizeInput) tempExecPageSizeInput.addEventListener('input', function() {
        dirtyDrafts.tempExecPageSize = true;
        setStatus(tempExecPageSizeStatus, '', '');
      });
      if (saveCaseViewFontSizeBtn) saveCaseViewFontSizeBtn.addEventListener('click', saveCaseViewFontSize);
      if (caseViewFontSizeInput) caseViewFontSizeInput.addEventListener('input', function() {
        dirtyDrafts.caseViewFontSize = true;
        setStatus(caseViewFontSizeStatus, '', '');
      });
      if (saveThemeSettingBtn) saveThemeSettingBtn.addEventListener('click', saveThemeSetting);
      if (themeSelect) themeSelect.addEventListener('change', function() {
        var next = resolveTheme(themeSelect.value);
        dirtyDrafts.theme = true;
        setStatus(themeSettingStatus, '已选择' + getThemeLabel(next) + '，保存后生效', '');
      });
      if (pageGuideSettingsGrid) pageGuideSettingsGrid.addEventListener('change', handlePageGuideChange);
      if (smartTopNavToggle) smartTopNavToggle.addEventListener('change', handleSmartTopNavChange);
      bindProjectSortEvents();
      if (settingsNavButtons && typeof settingsNavButtons.forEach === 'function') {
        settingsNavButtons.forEach(function(btn) {
          btn.addEventListener('click', function() {
            var target = btn.dataset ? btn.dataset.settingsTarget : '';
            scrollToSettingsSection(target);
          });
        });
      }
    }

    bindEvents();
    loadSettings();
    renderSettingsUI();
    fetchSettingsFromServer();
    bindAuthReady();
    bindVisibilityRefresh();

    return {
      loadSettings: loadSettings,
      persistSettings: persistSettings,
      renderSettingsUI: renderSettingsUI,
      renderTempExecColumnSettings: renderTempExecColumnSettings,
      saveTimeoutSetting: saveTimeoutSetting,
      saveFeishuWebhookConfig: saveFeishuWebhookConfig,
      testFeishuWebhookConfig: testFeishuWebhookConfig,
      saveTempExecColumnsSetting: saveTempExecColumnsSetting,
      getFeishuWebhookUrl: getFeishuWebhookUrl,
      getFeishuMentionId: getFeishuMentionId,
      postFeishuMessage: postFeishuMessage,
      ensureTempExecColumns: ensureTempExecColumns,
      saveTempExecPageSize: saveTempExecPageSize,
    };
  }

  window.app.settings = { init: init };
})();
