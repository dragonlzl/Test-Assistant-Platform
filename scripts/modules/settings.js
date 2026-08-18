(function() {
  window.app = window.app || {};

  function init(ctx) {
    if (!ctx) return {};
    var state = ctx.state || {};
    var config = ctx.config || {};
    var utils = ctx.utils || {};
    var api = window.app && window.app.apiClient;
    var setStatus = ctx.setStatus || utils.setStatus || function noop() {};
    var showCenterToast = typeof utils.showCenterToast === 'function' ? utils.showCenterToast : function() {};
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
    var caseAssistantProjectRootInput = dom.caseAssistantProjectRootInput || document.getElementById('caseAssistantProjectRootInput');
    var saveCaseAssistantProjectRootBtn = dom.saveCaseAssistantProjectRootBtn || document.getElementById('saveCaseAssistantProjectRoot');
    var caseAssistantProjectRootStatus = dom.caseAssistantProjectRootStatus || document.getElementById('caseAssistantProjectRootStatus');
    var knowledgeBaseBaseUrlInput = dom.knowledgeBaseBaseUrlInput || document.getElementById('knowledgeBaseBaseUrlInput');
    var saveKnowledgeBaseBaseUrlBtn = dom.saveKnowledgeBaseBaseUrlBtn || document.getElementById('saveKnowledgeBaseBaseUrl');
    var validateKnowledgeBaseBaseUrlBtn = dom.validateKnowledgeBaseBaseUrlBtn || document.getElementById('validateKnowledgeBaseBaseUrl');
    var knowledgeBaseBaseUrlStatus = dom.knowledgeBaseBaseUrlStatus || document.getElementById('knowledgeBaseBaseUrlStatus');
    var knowledgeBaseCatalogCharLimitInput = dom.knowledgeBaseCatalogCharLimitInput
      || document.getElementById('knowledgeBaseCatalogCharLimitInput');
    var knowledgeBaseInjectedContextCharLimitInput = dom.knowledgeBaseInjectedContextCharLimitInput
      || document.getElementById('knowledgeBaseInjectedContextCharLimitInput');
    var xmindRequestPayloadLimitInput = dom.xmindRequestPayloadLimitInput
      || document.getElementById('xmindRequestPayloadLimitInput');
    var saveKnowledgeBaseLimitSettingsBtn = dom.saveKnowledgeBaseLimitSettingsBtn
      || document.getElementById('saveKnowledgeBaseLimitSettings');
    var knowledgeBaseLimitSettingsStatus = dom.knowledgeBaseLimitSettingsStatus
      || document.getElementById('knowledgeBaseLimitSettingsStatus');
    var tempExecColumnForm = dom.tempExecColumnForm || document.getElementById('tempExecColumnForm');
    var tempExecColumnStatus = dom.tempExecColumnStatus || document.getElementById('tempExecColumnStatus');
    var saveModelTimeoutBtn = dom.saveModelTimeoutBtn || document.getElementById('saveModelTimeout');
    var saveTempExecColumnsBtn = dom.saveTempExecColumnsBtn || document.getElementById('saveTempExecColumns');
    var tempExecPageSizeInput = dom.tempExecPageSizeInput || document.getElementById('tempExecPageSizeInput');
    var saveTempExecPageSizeBtn = dom.saveTempExecPageSizeBtn || document.getElementById('saveTempExecPageSize');
    var tempExecPageSizeStatus = dom.tempExecPageSizeStatus || document.getElementById('tempExecPageSizeStatus');
    var caseViewFontSizeInput = dom.caseViewFontSizeInput || document.getElementById('caseViewFontSizeInput');
    var saveCaseViewFontSizeBtn = dom.saveCaseViewFontSizeBtn || document.getElementById('saveCaseViewFontSize');
    var caseViewFontSizeStatus = dom.caseViewFontSizeStatus || document.getElementById('caseViewFontSizeStatus');
    var caseLibraryGenCoverageInput = dom.caseLibraryGenCoverageInput || document.getElementById('caseLibraryGenCoverageInput');
    var saveCaseLibraryGenCoverageBtn = dom.saveCaseLibraryGenCoverageBtn || document.getElementById('saveCaseLibraryGenCoverage');
    var caseLibraryGenCoverageStatus = dom.caseLibraryGenCoverageStatus || document.getElementById('caseLibraryGenCoverageStatus');
    var projectSortGrid = dom.projectSortGrid || document.getElementById('projectSortGrid');
    var projectSortStatus = dom.projectSortStatus || document.getElementById('projectSortStatus');
    var smartTopNavToggle = dom.smartTopNavToggle || document.getElementById('smartTopNavToggle');
    var smartTopNavStatus = dom.smartTopNavStatus || document.getElementById('smartTopNavStatus');
    var themeSelect = dom.themeSelect || document.getElementById('themeSelect');
    var saveThemeSettingBtn = dom.saveThemeSettingBtn || document.getElementById('saveThemeSetting');
    var themeSettingStatus = dom.themeSettingStatus || document.getElementById('themeSettingStatus');
    var missingReminderPlacementSelect = dom.missingReminderPlacementSelect
      || document.getElementById('missingReminderPlacementSelect');
    var saveMissingReminderPlacementBtn = dom.saveMissingReminderPlacementBtn
      || document.getElementById('saveMissingReminderPlacement');
    var missingReminderPlacementStatus = dom.missingReminderPlacementStatus
      || document.getElementById('missingReminderPlacementStatus');
    var missingReminderMatchTypeInput = dom.missingReminderMatchTypeInput
      || document.getElementById('missingReminderMatchType');
    var missingReminderMatchModuleInput = dom.missingReminderMatchModuleInput
      || document.getElementById('missingReminderMatchModule');
    var saveMissingReminderMatchBtn = dom.saveMissingReminderMatchBtn
      || document.getElementById('saveMissingReminderMatch');
    var missingReminderMatchStatus = dom.missingReminderMatchStatus
      || document.getElementById('missingReminderMatchStatus');
    var missingReminderAiSelect = dom.missingReminderAiSelect
      || document.getElementById('missingReminderAiSelect');
    var saveMissingReminderAiBtn = dom.saveMissingReminderAiBtn
      || document.getElementById('saveMissingReminderAi');
    var missingReminderAiStatus = dom.missingReminderAiStatus
      || document.getElementById('missingReminderAiStatus');
    var settingsNavButtons = dom.settingsNavButtons || document.querySelectorAll('[data-settings-target]');

    var defaultSettings = config.defaultSettings || {};
    var defaultTempExecColumns = config.defaultTempExecColumns || {};
    var defaultTempExecPageSize = config.defaultTempExecPageSize || 20;
    var defaultTheme = defaultSettings && defaultSettings.theme ? String(defaultSettings.theme) : 'light';
    var defaultCaseViewFontSize = Number(config.defaultCaseViewFontSize)
      || (defaultSettings && defaultSettings.caseViewFontSize ? Number(defaultSettings.caseViewFontSize) : 13);
    var defaultCaseLibraryGenCoverageThreshold = defaultSettings && defaultSettings.caseLibraryGenCoverageThreshold
      ? Number(defaultSettings.caseLibraryGenCoverageThreshold)
      : 90;
    var defaultCaseAssistantProjectRoot = defaultSettings && typeof defaultSettings.caseAssistantProjectRoot === 'string'
      ? String(defaultSettings.caseAssistantProjectRoot || '')
      : '';
    var defaultKnowledgeBaseBaseUrl = defaultSettings && typeof defaultSettings.knowledgeBaseBaseUrl === 'string'
      ? String(defaultSettings.knowledgeBaseBaseUrl || '')
      : '';
    var defaultKnowledgeBaseCatalogCharLimit = Number(config.defaultKnowledgeBaseCatalogCharLimit)
      || (defaultSettings && defaultSettings.knowledgeBaseCatalogCharLimit ? Number(defaultSettings.knowledgeBaseCatalogCharLimit) : 120000);
    var minKnowledgeBaseCatalogCharLimit = Number(config.minKnowledgeBaseCatalogCharLimit) || 20000;
    var maxKnowledgeBaseCatalogCharLimit = Number(config.maxKnowledgeBaseCatalogCharLimit) || 2000000;
    var defaultKnowledgeBaseInjectedContextCharLimit = Number(config.defaultKnowledgeBaseInjectedContextCharLimit)
      || (defaultSettings && defaultSettings.knowledgeBaseInjectedContextCharLimit
        ? Number(defaultSettings.knowledgeBaseInjectedContextCharLimit)
        : 24000);
    var minKnowledgeBaseInjectedContextCharLimit = Number(config.minKnowledgeBaseInjectedContextCharLimit) || 4000;
    var maxKnowledgeBaseInjectedContextCharLimit = Number(config.maxKnowledgeBaseInjectedContextCharLimit) || 200000;
    var defaultXmindRequestPayloadLimit = Number(config.defaultXmindRequestPayloadLimit)
      || (defaultSettings && defaultSettings.xmindRequestPayloadLimit ? Number(defaultSettings.xmindRequestPayloadLimit) : 4000000);
    var minXmindRequestPayloadLimit = Number(config.minXmindRequestPayloadLimit) || 500000;
    var maxXmindRequestPayloadLimit = Number(config.maxXmindRequestPayloadLimit) || 10000000;
    var minCaseLibraryGenCoverageThreshold = 50;
    var maxCaseLibraryGenCoverageThreshold = 100;
    var defaultMissingReminderPlacement = defaultSettings && defaultSettings.missingCaseReminderPlacement
      ? String(defaultSettings.missingCaseReminderPlacement)
      : 'top';
    var defaultMissingReminderMatchConfig = defaultSettings && typeof defaultSettings.missingCaseReminderMatchConfig === 'object'
      ? defaultSettings.missingCaseReminderMatchConfig
      : { type: true, module: true };
    var defaultMissingReminderAiEnabled = defaultSettings && defaultSettings.missingCaseReminderAiEnabled
      ? String(defaultSettings.missingCaseReminderAiEnabled)
      : 'off';
    var minCaseViewFontSize = Number(config.minCaseViewFontSize) || 11;
    var maxCaseViewFontSize = Number(config.maxCaseViewFontSize) || 16;
    var settingsKey = config.settingsKey || 'usecase-settings-v1';
    var retainedSettingKeys = {
      timeoutSec: true,
      caseAssistantProjectRoot: true,
      knowledgeBaseBaseUrl: true,
      knowledgeBaseCatalogCharLimit: true,
      knowledgeBaseInjectedContextCharLimit: true,
      xmindRequestPayloadLimit: true,
      theme: true,
      caseViewFontSize: true,
      missingCaseReminderPlacement: true,
      missingCaseReminderMatchConfig: true,
      missingCaseReminderAiEnabled: true,
      caseLibraryGenCoverageThreshold: true,
      caseGenProgressCollapsed: true,
      sidebarTabActive: true,
      memoPad: true,
      smartTopNavCollapse: true,
      tempExecColumns: true,
      tempExecPageSize: true,
      projectOrder: true,
      defaultProjectId: true,
    };
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
      caseAssistantProjectRoot: false,
      knowledgeBaseBaseUrl: false,
      knowledgeBaseLimitSettings: false,
      tempExecColumns: false,
      tempExecPageSize: false,
      caseViewFontSize: false,
      caseLibraryGenCoverageThreshold: false,
      projectOrder: false,
      defaultProjectId: false,
      theme: false,
      missingCaseReminderPlacement: false,
      missingCaseReminderMatchConfig: false,
      missingCaseReminderAiEnabled: false,
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

    function resolveMissingReminderPlacement(value) {
      var key = value === null || value === undefined ? '' : String(value).toLowerCase();
      if (key === 'bottom') return 'bottom';
      return 'top';
    }

    function resolveMissingReminderMatchConfig(value) {
      if (utils && typeof utils.normalizeMissingReminderMatchConfig === 'function') {
        return utils.normalizeMissingReminderMatchConfig(value, defaultMissingReminderMatchConfig);
      }
      var base = defaultMissingReminderMatchConfig || { type: true, module: true };
      var raw = value && typeof value === 'object' ? value : {};
      var typeFlag = raw.type === true ? true : raw.type === false ? false : base.type !== false;
      var moduleFlag = raw.module === true ? true : raw.module === false ? false : base.module !== false;
      if (!typeFlag && !moduleFlag) {
        typeFlag = base.type !== false;
        moduleFlag = base.module !== false;
        if (!typeFlag && !moduleFlag) typeFlag = true;
      }
      return { type: typeFlag, module: moduleFlag };
    }

    function resolveMissingReminderAiEnabled(value) {
      var raw = value === undefined || value === null ? defaultMissingReminderAiEnabled : value;
      return String(raw || '').toLowerCase() === 'on' ? 'on' : 'off';
    }

    function normalizeCaseAssistantProjectRoot(value) {
      if (value === undefined || value === null) return '';
      return String(value).trim();
    }

    function normalizeKnowledgeBaseBaseUrl(value) {
      if (value === undefined || value === null) return '';
      var text = String(value).trim();
      if (!text) return '';
      text = text.replace(/[?#].*$/, '');
      if (/^https?:\/\//i.test(text) && text.charAt(text.length - 1) !== '/') {
        text += '/';
      }
      return text;
    }

    function isLikelyKnowledgeBaseUrl(value) {
      var text = normalizeKnowledgeBaseBaseUrl(value);
      if (!text) return false;
      if (text.indexOf('\0') !== -1) return false;
      return /^https?:\/\/[^/\s?#]+(?:\/[^\s?#]*)?$/i.test(text);
    }

    function isLikelyAbsoluteDirectoryPath(value) {
      var text = normalizeCaseAssistantProjectRoot(value);
      if (!text) return false;
      if (text.indexOf('\0') !== -1) return false;
      if (/^[A-Za-z]:[\\/]/.test(text)) {
        var withoutDrive = text.replace(/^[A-Za-z]:/, '');
        return !/[<>\"|?*]/.test(withoutDrive);
      }
      if (/^\\\\[^\\]+\\[^\\]+/.test(text)) {
        return !/[<>\"|?*]/.test(text);
      }
      if (/^\//.test(text)) return true;
      return false;
    }

    function applyTheme(theme) {
      if (typeof document === 'undefined' || !document.documentElement) return;
      var next = resolveTheme(theme);
      if (document.documentElement.dataset) {
        document.documentElement.dataset.theme = next;
      } else {
        document.documentElement.setAttribute('data-theme', next);
      }
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('tap-theme-hint', next);
        }
      } catch (err) {
        // ignore
      }
    }

    function clampCaseViewFontSize(value) {
      var num = Math.round(Number(value));
      if (!Number.isFinite(num) || num <= 0) return defaultCaseViewFontSize;
      if (num < minCaseViewFontSize) return minCaseViewFontSize;
      if (num > maxCaseViewFontSize) return maxCaseViewFontSize;
      return num;
    }

    function clampCaseLibraryGenCoverageThreshold(value) {
      var num = Math.round(Number(value));
      if (!Number.isFinite(num)) return defaultCaseLibraryGenCoverageThreshold;
      if (num < minCaseLibraryGenCoverageThreshold) return minCaseLibraryGenCoverageThreshold;
      if (num > maxCaseLibraryGenCoverageThreshold) return maxCaseLibraryGenCoverageThreshold;
      return num;
    }

    function clampKnowledgeBaseCatalogCharLimit(value) {
      var num = Math.round(Number(value));
      if (!Number.isFinite(num) || num <= 0) return defaultKnowledgeBaseCatalogCharLimit;
      if (num < minKnowledgeBaseCatalogCharLimit) return minKnowledgeBaseCatalogCharLimit;
      if (num > maxKnowledgeBaseCatalogCharLimit) return maxKnowledgeBaseCatalogCharLimit;
      return num;
    }

    function clampKnowledgeBaseInjectedContextCharLimit(value) {
      var num = Math.round(Number(value));
      if (!Number.isFinite(num) || num <= 0) return defaultKnowledgeBaseInjectedContextCharLimit;
      if (num < minKnowledgeBaseInjectedContextCharLimit) return minKnowledgeBaseInjectedContextCharLimit;
      if (num > maxKnowledgeBaseInjectedContextCharLimit) return maxKnowledgeBaseInjectedContextCharLimit;
      return num;
    }

    function clampXmindRequestPayloadLimit(value) {
      var num = Math.round(Number(value));
      if (!Number.isFinite(num) || num <= 0) return defaultXmindRequestPayloadLimit;
      if (num < minXmindRequestPayloadLimit) return minXmindRequestPayloadLimit;
      if (num > maxXmindRequestPayloadLimit) return maxXmindRequestPayloadLimit;
      return num;
    }

    function normalizeKnowledgeBaseLimitSettings() {
      if (!state.settings || typeof state.settings !== 'object') {
        state.settings = Object.assign({}, defaultSettings);
      }
      state.settings.knowledgeBaseCatalogCharLimit = clampKnowledgeBaseCatalogCharLimit(
        state.settings.knowledgeBaseCatalogCharLimit
      );
      state.settings.knowledgeBaseInjectedContextCharLimit = clampKnowledgeBaseInjectedContextCharLimit(
        state.settings.knowledgeBaseInjectedContextCharLimit
      );
      state.settings.xmindRequestPayloadLimit = clampXmindRequestPayloadLimit(
        state.settings.xmindRequestPayloadLimit
      );
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
        if (!item || !item.key || !retainedSettingKeys[item.key]) return;
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
      if (state.settings.caseAssistantProjectRoot === undefined || state.settings.caseAssistantProjectRoot === null) {
        state.settings.caseAssistantProjectRoot = defaultCaseAssistantProjectRoot;
      }
      state.settings.caseAssistantProjectRoot = normalizeCaseAssistantProjectRoot(state.settings.caseAssistantProjectRoot);
      if (state.settings.knowledgeBaseBaseUrl === undefined || state.settings.knowledgeBaseBaseUrl === null) {
        state.settings.knowledgeBaseBaseUrl = defaultKnowledgeBaseBaseUrl;
      }
      state.settings.knowledgeBaseBaseUrl = normalizeKnowledgeBaseBaseUrl(state.settings.knowledgeBaseBaseUrl);
      normalizeKnowledgeBaseLimitSettings();
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
      if (state.settings.caseLibraryGenCoverageThreshold !== undefined && state.settings.caseLibraryGenCoverageThreshold !== null) {
        state.settings.caseLibraryGenCoverageThreshold = clampCaseLibraryGenCoverageThreshold(
          state.settings.caseLibraryGenCoverageThreshold
        );
      } else {
        state.settings.caseLibraryGenCoverageThreshold = defaultCaseLibraryGenCoverageThreshold;
      }
      if (state.settings.caseLibraryGenCoverageThreshold !== undefined && state.settings.caseLibraryGenCoverageThreshold !== null) {
        state.settings.caseLibraryGenCoverageThreshold = clampCaseLibraryGenCoverageThreshold(
          state.settings.caseLibraryGenCoverageThreshold
        );
      } else {
        state.settings.caseLibraryGenCoverageThreshold = defaultCaseLibraryGenCoverageThreshold;
      }
      if (state.settings.missingCaseReminderPlacement === undefined || state.settings.missingCaseReminderPlacement === null) {
        state.settings.missingCaseReminderPlacement = defaultMissingReminderPlacement;
      }
      state.settings.missingCaseReminderPlacement = resolveMissingReminderPlacement(state.settings.missingCaseReminderPlacement);
      if (state.settings.missingCaseReminderMatchConfig === undefined || state.settings.missingCaseReminderMatchConfig === null) {
        state.settings.missingCaseReminderMatchConfig = defaultMissingReminderMatchConfig;
      }
      state.settings.missingCaseReminderMatchConfig = resolveMissingReminderMatchConfig(
        state.settings.missingCaseReminderMatchConfig
      );
      if (state.settings.missingCaseReminderMatchConfig === undefined || state.settings.missingCaseReminderMatchConfig === null) {
        state.settings.missingCaseReminderMatchConfig = defaultMissingReminderMatchConfig;
      }
      state.settings.missingCaseReminderMatchConfig = resolveMissingReminderMatchConfig(
        state.settings.missingCaseReminderMatchConfig
      );
      if (state.settings.missingCaseReminderAiEnabled === undefined || state.settings.missingCaseReminderAiEnabled === null) {
        state.settings.missingCaseReminderAiEnabled = defaultMissingReminderAiEnabled;
      }
      state.settings.missingCaseReminderAiEnabled = resolveMissingReminderAiEnabled(
        state.settings.missingCaseReminderAiEnabled
      );
      if (state.settings.smartTopNavCollapse === undefined || state.settings.smartTopNavCollapse === null) {
        state.settings.smartTopNavCollapse = defaultSettings.smartTopNavCollapse === true;
      } else {
        state.settings.smartTopNavCollapse = state.settings.smartTopNavCollapse === true;
      }
      ensureTempExecColumns();
      if (state.settings.theme === undefined || state.settings.theme === null || state.settings.theme === '') {
        try {
          if (typeof localStorage !== 'undefined') {
            var themeHint = localStorage.getItem('tap-theme-hint') || '';
            if (themeHint) state.settings.theme = themeHint;
          }
        } catch (err) {
          // ignore
        }
      }
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
        if (!retainedSettingKeys[key]) return false;
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
      var hasLocalSettings = false;
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
          var raw = localStorage.getItem(settingsKey) || '';
          if (raw) hasLocalSettings = true;
          saved = raw ? (JSON.parse(raw || '{}') || {}) : {};
        } catch (err) {
          console.warn('调用设置加载失败', err);
          saved = {};
        }
        if (saved && typeof saved === 'object') {
          Object.keys(saved).forEach(function(key) {
            if (!Object.prototype.hasOwnProperty.call(saved, key) || !retainedSettingKeys[key]) return;
            var val = saved[key];
            if (val === undefined) return;
            state.settings[key] = val;
          });
        }
      }

      // Known fields normalization
      state.settings.timeoutSec = clampTimeoutSeconds(state.settings.timeoutSec);
      if (state.settings.caseAssistantProjectRoot === undefined || state.settings.caseAssistantProjectRoot === null) {
        state.settings.caseAssistantProjectRoot = defaultCaseAssistantProjectRoot;
      }
      state.settings.caseAssistantProjectRoot = normalizeCaseAssistantProjectRoot(state.settings.caseAssistantProjectRoot);
      if (state.settings.knowledgeBaseBaseUrl === undefined || state.settings.knowledgeBaseBaseUrl === null) {
        state.settings.knowledgeBaseBaseUrl = defaultKnowledgeBaseBaseUrl;
      }
      state.settings.knowledgeBaseBaseUrl = normalizeKnowledgeBaseBaseUrl(state.settings.knowledgeBaseBaseUrl);
      normalizeKnowledgeBaseLimitSettings();
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
      if (state.settings.missingCaseReminderPlacement === undefined || state.settings.missingCaseReminderPlacement === null) {
        state.settings.missingCaseReminderPlacement = defaultMissingReminderPlacement;
      }
      state.settings.missingCaseReminderPlacement = resolveMissingReminderPlacement(state.settings.missingCaseReminderPlacement);
      if (state.settings.missingCaseReminderMatchConfig === undefined || state.settings.missingCaseReminderMatchConfig === null) {
        state.settings.missingCaseReminderMatchConfig = defaultMissingReminderMatchConfig;
      }
      state.settings.missingCaseReminderMatchConfig = resolveMissingReminderMatchConfig(
        state.settings.missingCaseReminderMatchConfig
      );
      if (state.settings.missingCaseReminderAiEnabled === undefined || state.settings.missingCaseReminderAiEnabled === null) {
        state.settings.missingCaseReminderAiEnabled = defaultMissingReminderAiEnabled;
      }
      state.settings.missingCaseReminderAiEnabled = resolveMissingReminderAiEnabled(
        state.settings.missingCaseReminderAiEnabled
      );
      if (state.settings.smartTopNavCollapse === undefined || state.settings.smartTopNavCollapse === null) {
        state.settings.smartTopNavCollapse = defaultSettings.smartTopNavCollapse === true;
      } else {
        state.settings.smartTopNavCollapse = state.settings.smartTopNavCollapse === true;
      }
      ensureTempExecColumns();
      try {
        if (typeof localStorage !== 'undefined') {
          var themeHint = localStorage.getItem('tap-theme-hint') || '';
          var needHint = state.settings.theme === undefined || state.settings.theme === null || state.settings.theme === '';
          if (!needHint && !hasLocalSettings) {
            var defaultTheme = defaultSettings && defaultSettings.theme ? String(defaultSettings.theme) : 'light';
            needHint = String(state.settings.theme || '') === defaultTheme;
          }
          if (themeHint && needHint) state.settings.theme = themeHint;
        }
      } catch (err) {
        // ignore
      }
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
        var localSettings = {};
        collectSettingItems().forEach(function(item) {
          localSettings[item.key] = item.value_json;
        });
        localStorage.setItem(settingsKey, JSON.stringify(localSettings));
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

    function renderSettingsUI() {
      if (modelTimeoutInput) {
        if (!dirtyDrafts.timeoutSec) {
          modelTimeoutInput.value = state.settings.timeoutSec;
        }
      }
      if (caseAssistantProjectRootInput) {
        if (!dirtyDrafts.caseAssistantProjectRoot) {
          caseAssistantProjectRootInput.value = normalizeCaseAssistantProjectRoot(state.settings.caseAssistantProjectRoot);
        }
      }
      if (caseAssistantProjectRootStatus) {
        setStatus(caseAssistantProjectRootStatus, '', '');
      }
      if (knowledgeBaseBaseUrlInput) {
        if (!dirtyDrafts.knowledgeBaseBaseUrl) {
          knowledgeBaseBaseUrlInput.value = normalizeKnowledgeBaseBaseUrl(state.settings.knowledgeBaseBaseUrl);
        }
      }
      if (knowledgeBaseCatalogCharLimitInput && !dirtyDrafts.knowledgeBaseLimitSettings) {
        knowledgeBaseCatalogCharLimitInput.value = state.settings.knowledgeBaseCatalogCharLimit || defaultKnowledgeBaseCatalogCharLimit || '';
      }
      if (knowledgeBaseInjectedContextCharLimitInput && !dirtyDrafts.knowledgeBaseLimitSettings) {
        knowledgeBaseInjectedContextCharLimitInput.value = state.settings.knowledgeBaseInjectedContextCharLimit
          || defaultKnowledgeBaseInjectedContextCharLimit
          || '';
      }
      if (xmindRequestPayloadLimitInput && !dirtyDrafts.knowledgeBaseLimitSettings) {
        xmindRequestPayloadLimitInput.value = state.settings.xmindRequestPayloadLimit || defaultXmindRequestPayloadLimit || '';
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
      if (caseLibraryGenCoverageInput) {
        if (!dirtyDrafts.caseLibraryGenCoverageThreshold) {
          caseLibraryGenCoverageInput.value = state.settings.caseLibraryGenCoverageThreshold || defaultCaseLibraryGenCoverageThreshold || '';
        }
      }
      if (caseLibraryGenCoverageStatus) {
        setStatus(caseLibraryGenCoverageStatus, '', '');
      }
      if (themeSelect) {
        if (!dirtyDrafts.theme) {
          themeSelect.value = resolveTheme(state.settings.theme);
        }
      }
      if (missingReminderPlacementSelect) {
        if (!dirtyDrafts.missingCaseReminderPlacement) {
          missingReminderPlacementSelect.value = resolveMissingReminderPlacement(
            state.settings.missingCaseReminderPlacement || defaultMissingReminderPlacement
          );
        }
      }
      if (missingReminderPlacementStatus) {
        setStatus(missingReminderPlacementStatus, '', '');
      }
      if (missingReminderMatchTypeInput && missingReminderMatchModuleInput) {
        if (!dirtyDrafts.missingCaseReminderMatchConfig) {
          var matchConfig = resolveMissingReminderMatchConfig(state.settings.missingCaseReminderMatchConfig);
          missingReminderMatchTypeInput.checked = matchConfig.type === true;
          missingReminderMatchModuleInput.checked = matchConfig.module === true;
        }
        if (missingReminderMatchStatus) {
          setStatus(missingReminderMatchStatus, '', '');
        }
      }
      if (missingReminderAiSelect) {
        if (!dirtyDrafts.missingCaseReminderAiEnabled) {
          missingReminderAiSelect.value = resolveMissingReminderAiEnabled(
            state.settings.missingCaseReminderAiEnabled
          );
        }
        if (missingReminderAiStatus) {
          setStatus(missingReminderAiStatus, '', '');
        }
      }
      if (smartTopNavToggle) {
        smartTopNavToggle.checked = state.settings.smartTopNavCollapse === true;
        setStatus(smartTopNavStatus, '', '');
      }
      renderTempExecColumnSettings();
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

    function saveCaseAssistantProjectRoot() {
      if (!caseAssistantProjectRootInput) return;
      var value = normalizeCaseAssistantProjectRoot(caseAssistantProjectRootInput.value);
      var prev = normalizeCaseAssistantProjectRoot(state.settings.caseAssistantProjectRoot);
      caseAssistantProjectRootInput.value = value;
      state.settings.caseAssistantProjectRoot = value;
      dirtyDrafts.caseAssistantProjectRoot = false;
      persistSettings(['caseAssistantProjectRoot']);
      if (!caseAssistantProjectRootStatus) return;
      if (!value) {
        setStatus(caseAssistantProjectRootStatus, '已清空项目路径，流程将跳过 Electron 补全调用', 'ok');
        return;
      }
      if (!isLikelyAbsoluteDirectoryPath(value)) {
        setStatus(caseAssistantProjectRootStatus, '项目路径已保存，但当前格式可能非法，流程会自动跳过该调用', 'warn');
        return;
      }
      if (prev === value) {
        setStatus(caseAssistantProjectRootStatus, '项目路径保持不变', 'ok');
      } else {
        setStatus(caseAssistantProjectRootStatus, '项目路径已保存', 'ok');
      }
    }

    function saveKnowledgeBaseBaseUrl() {
      if (!knowledgeBaseBaseUrlInput) return;
      var value = normalizeKnowledgeBaseBaseUrl(knowledgeBaseBaseUrlInput.value);
      var prev = normalizeKnowledgeBaseBaseUrl(state.settings.knowledgeBaseBaseUrl);
      knowledgeBaseBaseUrlInput.value = value;
      if (value && !isLikelyKnowledgeBaseUrl(value)) {
        if (knowledgeBaseBaseUrlStatus) {
          setStatus(knowledgeBaseBaseUrlStatus, '请输入合法的共享知识库地址，例如 http://192.168.50.10:8003/sk/', 'warn');
        }
        return;
      }
      state.settings.knowledgeBaseBaseUrl = value;
      dirtyDrafts.knowledgeBaseBaseUrl = false;
      persistSettings(['knowledgeBaseBaseUrl']);
      notifySettingsUpdated(['knowledgeBaseBaseUrl']);
      if (!knowledgeBaseBaseUrlStatus) return;
      if (!value) {
        setStatus(knowledgeBaseBaseUrlStatus, '已关闭共享知识库，后续生成将直接走原链路', 'ok');
        return;
      }
      if (prev === value) {
        setStatus(knowledgeBaseBaseUrlStatus, '知识库地址保持不变', 'ok');
      } else {
        setStatus(knowledgeBaseBaseUrlStatus, '知识库地址已保存，可继续点击“校验地址”确认可用性', 'ok');
      }
    }

    function saveKnowledgeBaseLimitSettings() {
      var nextCatalogLimit = clampKnowledgeBaseCatalogCharLimit(
        knowledgeBaseCatalogCharLimitInput ? knowledgeBaseCatalogCharLimitInput.value : state.settings.knowledgeBaseCatalogCharLimit
      );
      var nextInjectedLimit = clampKnowledgeBaseInjectedContextCharLimit(
        knowledgeBaseInjectedContextCharLimitInput
          ? knowledgeBaseInjectedContextCharLimitInput.value
          : state.settings.knowledgeBaseInjectedContextCharLimit
      );
      var nextPayloadLimit = clampXmindRequestPayloadLimit(
        xmindRequestPayloadLimitInput ? xmindRequestPayloadLimitInput.value : state.settings.xmindRequestPayloadLimit
      );
      var changed = false;
      if (Number(state.settings.knowledgeBaseCatalogCharLimit || 0) !== nextCatalogLimit) changed = true;
      if (Number(state.settings.knowledgeBaseInjectedContextCharLimit || 0) !== nextInjectedLimit) changed = true;
      if (Number(state.settings.xmindRequestPayloadLimit || 0) !== nextPayloadLimit) changed = true;
      state.settings.knowledgeBaseCatalogCharLimit = nextCatalogLimit;
      state.settings.knowledgeBaseInjectedContextCharLimit = nextInjectedLimit;
      state.settings.xmindRequestPayloadLimit = nextPayloadLimit;
      if (knowledgeBaseCatalogCharLimitInput) knowledgeBaseCatalogCharLimitInput.value = nextCatalogLimit;
      if (knowledgeBaseInjectedContextCharLimitInput) knowledgeBaseInjectedContextCharLimitInput.value = nextInjectedLimit;
      if (xmindRequestPayloadLimitInput) xmindRequestPayloadLimitInput.value = nextPayloadLimit;
      dirtyDrafts.knowledgeBaseLimitSettings = false;
      persistSettings([
        'knowledgeBaseCatalogCharLimit',
        'knowledgeBaseInjectedContextCharLimit',
        'xmindRequestPayloadLimit',
      ]);
      notifySettingsUpdated([
        'knowledgeBaseCatalogCharLimit',
        'knowledgeBaseInjectedContextCharLimit',
        'xmindRequestPayloadLimit',
      ]);
      if (!knowledgeBaseLimitSettingsStatus) return;
      if (!changed) {
        setStatus(knowledgeBaseLimitSettingsStatus, '知识库/XMind 上限保持不变', 'ok');
        return;
      }
      setStatus(
        knowledgeBaseLimitSettingsStatus,
        '上限已保存：目录送模 ' + nextCatalogLimit + '，知识库注入 ' + nextInjectedLimit + '，XMind 请求体 ' + nextPayloadLimit,
        'ok'
      );
    }

    async function validateKnowledgeBaseBaseUrl() {
      if (!knowledgeBaseBaseUrlInput) return;
      var value = normalizeKnowledgeBaseBaseUrl(knowledgeBaseBaseUrlInput.value);
      knowledgeBaseBaseUrlInput.value = value;
      if (!value) {
        if (knowledgeBaseBaseUrlStatus) {
          setStatus(knowledgeBaseBaseUrlStatus, '请先填写共享知识库地址', 'warn');
        }
        return;
      }
      if (!isLikelyKnowledgeBaseUrl(value)) {
        if (knowledgeBaseBaseUrlStatus) {
          setStatus(knowledgeBaseBaseUrlStatus, '地址格式不正确，请检查协议、IP 和目录路径', 'warn');
        }
        return;
      }
      if (!api || typeof api.validateKnowledgeBase !== 'function') {
        if (knowledgeBaseBaseUrlStatus) {
          setStatus(knowledgeBaseBaseUrlStatus, '知识库校验接口不可用，请刷新页面后重试', 'err');
        }
        return;
      }
      if (knowledgeBaseBaseUrlStatus) {
        setStatus(knowledgeBaseBaseUrlStatus, '正在校验共享知识库地址...', '');
      }
      try {
        var result = await api.validateKnowledgeBase({
          base_url: value,
          timeout_sec: clampTimeoutSeconds(state.settings.timeoutSec),
          deep_check: true,
        });
        var manifest = result && result.manifest && typeof result.manifest === 'object'
          ? result.manifest
          : {};
        var docCount = Number(manifest.doc_count || 0);
        var entryCount = Number(manifest.entry_count || 0);
        var warnings = Array.isArray(result && result.warnings) ? result.warnings : [];
        var summary = '校验成功';
        if (docCount > 0 || entryCount > 0) {
          summary += '：文档 ' + String(docCount) + ' 份，索引 ' + String(entryCount) + ' 条';
        }
        if (warnings.length) {
          summary += '；存在告警：' + String(warnings[0] || '');
        }
        if (knowledgeBaseBaseUrlStatus) {
          setStatus(knowledgeBaseBaseUrlStatus, summary, warnings.length ? 'warn' : 'ok');
        }
      } catch (err) {
        if (knowledgeBaseBaseUrlStatus) {
          setStatus(
            knowledgeBaseBaseUrlStatus,
            '校验失败：' + (err && err.message ? err.message : '共享知识库不可用'),
            'err'
          );
        }
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

    function saveCaseLibraryGenCoverageThreshold() {
      if (!caseLibraryGenCoverageInput) return;
      var raw = caseLibraryGenCoverageInput.value;
      var value = clampCaseLibraryGenCoverageThreshold(raw);
      if (!Number.isFinite(value)) {
        setStatus(
          caseLibraryGenCoverageStatus,
          '请输入 ' + minCaseLibraryGenCoverageThreshold + '-' + maxCaseLibraryGenCoverageThreshold + ' 之间的数值',
          'warn'
        );
        return;
      }
      var prev = state.settings.caseLibraryGenCoverageThreshold;
      caseLibraryGenCoverageInput.value = value;
      state.settings.caseLibraryGenCoverageThreshold = value;
      dirtyDrafts.caseLibraryGenCoverageThreshold = false;
      persistSettings(['caseLibraryGenCoverageThreshold']);
      notifySettingsUpdated(['caseLibraryGenCoverageThreshold']);
      if (!caseLibraryGenCoverageStatus) return;
      if (prev === value) {
        setStatus(caseLibraryGenCoverageStatus, '覆盖度阈值保持为 ' + value, 'ok');
      } else {
        setStatus(caseLibraryGenCoverageStatus, '覆盖度阈值已更新为 ' + value, 'ok');
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

    function getMissingReminderPlacementLabel(value) {
      return value === 'bottom' ? '下方' : '上方';
    }

    function notifySettingsUpdated(keys) {
      if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
      var detail = { keys: Array.isArray(keys) ? keys.slice() : [] };
      try {
        window.dispatchEvent(new CustomEvent('app-settings-updated', { detail: detail }));
      } catch (err) {
        try {
          var evt = document.createEvent('CustomEvent');
          evt.initCustomEvent('app-settings-updated', false, false, detail);
          window.dispatchEvent(evt);
        } catch (err2) {
          // ignore
        }
      }
    }

    function saveMissingReminderPlacement() {
      if (!missingReminderPlacementSelect) return;
      var next = resolveMissingReminderPlacement(missingReminderPlacementSelect.value);
      var prev = resolveMissingReminderPlacement(
        state.settings.missingCaseReminderPlacement || defaultMissingReminderPlacement
      );
      state.settings.missingCaseReminderPlacement = next;
      dirtyDrafts.missingCaseReminderPlacement = false;
      persistSettings(['missingCaseReminderPlacement']);
      if (missingReminderPlacementStatus) {
        if (prev === next) {
          setStatus(
            missingReminderPlacementStatus,
            '易漏用例提醒区域保持在' + getMissingReminderPlacementLabel(next),
            'ok'
          );
        } else {
          setStatus(
            missingReminderPlacementStatus,
            '易漏用例提醒区域已切换到' + getMissingReminderPlacementLabel(next),
            'ok'
          );
        }
      }
      notifySettingsUpdated(['missingCaseReminderPlacement']);
    }

    function getMissingReminderMatchLabel(config) {
      var cfg = resolveMissingReminderMatchConfig(config);
      var parts = [];
      if (cfg.type) parts.push('类型');
      if (cfg.module) parts.push('模块');
      if (!parts.length) return '未设置';
      return parts.join(' + ');
    }

    function saveMissingReminderMatchConfig() {
      if (!missingReminderMatchTypeInput || !missingReminderMatchModuleInput) return;
      var next = resolveMissingReminderMatchConfig({
        type: Boolean(missingReminderMatchTypeInput.checked),
        module: Boolean(missingReminderMatchModuleInput.checked),
      });
      var prev = resolveMissingReminderMatchConfig(state.settings.missingCaseReminderMatchConfig);
      if (!next.type && !next.module) {
        if (missingReminderMatchStatus) {
          setStatus(missingReminderMatchStatus, '至少勾选一个命中条件', 'warn');
        }
        return;
      }
      state.settings.missingCaseReminderMatchConfig = next;
      dirtyDrafts.missingCaseReminderMatchConfig = false;
      persistSettings(['missingCaseReminderMatchConfig']);
      if (missingReminderMatchStatus) {
        if (prev.type === next.type && prev.module === next.module) {
          setStatus(missingReminderMatchStatus, '易漏用例命中设定保持为' + getMissingReminderMatchLabel(next), 'ok');
        } else {
          setStatus(missingReminderMatchStatus, '易漏用例命中设定已更新为' + getMissingReminderMatchLabel(next), 'ok');
        }
      }
      notifySettingsUpdated(['missingCaseReminderMatchConfig']);
    }

    function findModelByAnyId(value) {
      var target = value === undefined || value === null ? '' : String(value);
      if (!target) return null;
      var list = Array.isArray(state.models) ? state.models : [];
      for (var i = 0; i < list.length; i += 1) {
        var model = list[i];
        if (!model) continue;
        var idVal = model.id === undefined || model.id === null ? '' : String(model.id);
        var remoteVal = model.remoteId === undefined || model.remoteId === null ? '' : String(model.remoteId);
        if (idVal === target || remoteVal === target) return model;
      }
      return null;
    }

    function isModelUsable(model) {
      if (!model || typeof model !== 'object') return false;
      var baseUrl = model.baseUrl ? String(model.baseUrl).trim() : '';
      var modelId = model.model ? String(model.model).trim() : '';
      var apiKey = model.apiKey ? String(model.apiKey).trim() : '';
      return Boolean(baseUrl && modelId && apiKey);
    }

    function canEnableMissingReminderAi() {
      var assignments = state.assignments && typeof state.assignments === 'object' ? state.assignments : {};
      var targetId = assignments.missingReminderId || '';
      if (!targetId) return false;
      var model = findModelByAnyId(targetId);
      return isModelUsable(model);
    }

    function saveMissingReminderAiSetting() {
      if (!missingReminderAiSelect) return;
      var next = resolveMissingReminderAiEnabled(missingReminderAiSelect.value);
      var prev = resolveMissingReminderAiEnabled(state.settings.missingCaseReminderAiEnabled);
      if (next === 'on' && !canEnableMissingReminderAi()) {
        if (missingReminderAiSelect) missingReminderAiSelect.value = 'off';
        if (missingReminderAiStatus) {
          setStatus(missingReminderAiStatus, '请先在功能指派配置易漏用例推荐模型', 'warn');
        }
        showCenterToast('请到AI功能-功能指派 页面下，配置该功能模型。', 'warn', 5000);
        return;
      }
      state.settings.missingCaseReminderAiEnabled = next;
      dirtyDrafts.missingCaseReminderAiEnabled = false;
      persistSettings(['missingCaseReminderAiEnabled']);
      if (missingReminderAiStatus) {
        if (prev === next) {
          setStatus(missingReminderAiStatus, '易漏用例推荐保持为' + (next === 'on' ? '开启' : '关闭'), 'ok');
        } else {
          setStatus(missingReminderAiStatus, '易漏用例推荐已设置为' + (next === 'on' ? '开启' : '关闭'), 'ok');
        }
      }
      notifySettingsUpdated(['missingCaseReminderAiEnabled']);
    }

    function handleMissingReminderMatchChange(e) {
      if (!missingReminderMatchTypeInput || !missingReminderMatchModuleInput) return;
      var typeChecked = Boolean(missingReminderMatchTypeInput.checked);
      var moduleChecked = Boolean(missingReminderMatchModuleInput.checked);
      if (!typeChecked && !moduleChecked) {
        if (e && e.target === missingReminderMatchTypeInput) {
          missingReminderMatchTypeInput.checked = true;
        } else if (e && e.target === missingReminderMatchModuleInput) {
          missingReminderMatchModuleInput.checked = true;
        } else {
          missingReminderMatchTypeInput.checked = true;
        }
        if (missingReminderMatchStatus) {
          setStatus(missingReminderMatchStatus, '至少勾选一个命中条件', 'warn');
        }
        return;
      }
      dirtyDrafts.missingCaseReminderMatchConfig = true;
      if (missingReminderMatchStatus) {
        setStatus(missingReminderMatchStatus, '', '');
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
      if (saveCaseAssistantProjectRootBtn) saveCaseAssistantProjectRootBtn.addEventListener('click', saveCaseAssistantProjectRoot);
      if (caseAssistantProjectRootInput) caseAssistantProjectRootInput.addEventListener('input', function() {
        dirtyDrafts.caseAssistantProjectRoot = true;
        setStatus(caseAssistantProjectRootStatus, '', '');
      });
      if (saveKnowledgeBaseBaseUrlBtn) saveKnowledgeBaseBaseUrlBtn.addEventListener('click', saveKnowledgeBaseBaseUrl);
      if (validateKnowledgeBaseBaseUrlBtn) {
        validateKnowledgeBaseBaseUrlBtn.addEventListener('click', validateKnowledgeBaseBaseUrl);
      }
      if (knowledgeBaseBaseUrlInput) knowledgeBaseBaseUrlInput.addEventListener('input', function() {
        dirtyDrafts.knowledgeBaseBaseUrl = true;
        setStatus(knowledgeBaseBaseUrlStatus, '', '');
      });
      if (saveKnowledgeBaseLimitSettingsBtn) {
        saveKnowledgeBaseLimitSettingsBtn.addEventListener('click', saveKnowledgeBaseLimitSettings);
      }
      if (knowledgeBaseCatalogCharLimitInput) {
        knowledgeBaseCatalogCharLimitInput.addEventListener('input', function() {
          dirtyDrafts.knowledgeBaseLimitSettings = true;
          setStatus(knowledgeBaseLimitSettingsStatus, '', '');
        });
      }
      if (knowledgeBaseInjectedContextCharLimitInput) {
        knowledgeBaseInjectedContextCharLimitInput.addEventListener('input', function() {
          dirtyDrafts.knowledgeBaseLimitSettings = true;
          setStatus(knowledgeBaseLimitSettingsStatus, '', '');
        });
      }
      if (xmindRequestPayloadLimitInput) {
        xmindRequestPayloadLimitInput.addEventListener('input', function() {
          dirtyDrafts.knowledgeBaseLimitSettings = true;
          setStatus(knowledgeBaseLimitSettingsStatus, '', '');
        });
      }
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
      if (saveCaseLibraryGenCoverageBtn) saveCaseLibraryGenCoverageBtn.addEventListener('click', saveCaseLibraryGenCoverageThreshold);
      if (caseLibraryGenCoverageInput) caseLibraryGenCoverageInput.addEventListener('input', function() {
        dirtyDrafts.caseLibraryGenCoverageThreshold = true;
        setStatus(caseLibraryGenCoverageStatus, '', '');
      });
      if (saveThemeSettingBtn) saveThemeSettingBtn.addEventListener('click', saveThemeSetting);
      if (themeSelect) themeSelect.addEventListener('change', function() {
        var next = resolveTheme(themeSelect.value);
        dirtyDrafts.theme = true;
        setStatus(themeSettingStatus, '已选择' + getThemeLabel(next) + '，保存后生效', '');
      });
      if (saveMissingReminderPlacementBtn) {
        saveMissingReminderPlacementBtn.addEventListener('click', saveMissingReminderPlacement);
      }
      if (missingReminderPlacementSelect) {
        missingReminderPlacementSelect.addEventListener('change', function() {
          dirtyDrafts.missingCaseReminderPlacement = true;
          setStatus(missingReminderPlacementStatus, '', '');
        });
      }
      if (saveMissingReminderMatchBtn) {
        saveMissingReminderMatchBtn.addEventListener('click', saveMissingReminderMatchConfig);
      }
      if (missingReminderMatchTypeInput) {
        missingReminderMatchTypeInput.addEventListener('change', handleMissingReminderMatchChange);
      }
      if (missingReminderMatchModuleInput) {
        missingReminderMatchModuleInput.addEventListener('change', handleMissingReminderMatchChange);
      }
      if (saveMissingReminderAiBtn) {
        saveMissingReminderAiBtn.addEventListener('click', saveMissingReminderAiSetting);
      }
      if (missingReminderAiSelect) {
        missingReminderAiSelect.addEventListener('change', function() {
          dirtyDrafts.missingCaseReminderAiEnabled = true;
          if (missingReminderAiStatus) setStatus(missingReminderAiStatus, '', '');
        });
      }
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
      saveCaseAssistantProjectRoot: saveCaseAssistantProjectRoot,
      saveKnowledgeBaseBaseUrl: saveKnowledgeBaseBaseUrl,
      validateKnowledgeBaseBaseUrl: validateKnowledgeBaseBaseUrl,
      saveTempExecColumnsSetting: saveTempExecColumnsSetting,
      ensureTempExecColumns: ensureTempExecColumns,
      saveTempExecPageSize: saveTempExecPageSize,
    };
  }

  window.app.settings = { init: init };
})();
