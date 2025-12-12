(function() {
  window.app = window.app || {};

  function init(ctx) {
    if (!ctx) return {};
    var state = ctx.state || {};
    var config = ctx.config || {};
    var utils = ctx.utils || {};
    var api = window.app && window.app.apiClient;
    var setStatus = ctx.setStatus || utils.setStatus || function noop() {};
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

    var defaultSettings = config.defaultSettings || {};
    var defaultTempExecColumns = config.defaultTempExecColumns || {};
    var defaultTempExecPageSize = config.defaultTempExecPageSize || 20;
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

    function mergeServerSettings(list) {
      var userId = state.currentUser && state.currentUser.id;
      var merged = {};
      (list || []).forEach(function(item) {
        if (!item || !item.key) return;
        var isUser = item.scope === 'user';
        var isGlobal = item.scope === 'global';
        if (isGlobal && merged[item.key] === undefined) {
          merged[item.key] = item.value_json;
        }
        if (isUser && item.owner_id === userId) {
          merged[item.key] = item.value_json;
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
      ensureTempExecColumns();
    }

    function fetchSettingsFromServer() {
      if (!api || typeof api.listSettings !== 'function') return;
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

    function collectSettingItems() {
      var items = [];
      if (state.settings && typeof state.settings === 'object') {
        Object.keys(state.settings).forEach(function(key) {
          if (!key) return;
          var val = state.settings[key];
          if (val === undefined) return;
          if (typeof val === 'function') return;
          items.push({ key: key, value_json: val });
        });
      }
      // Backward compatibility: ensure page size is saved even if only stored on state.tempExecPageSize
      var hasPageSize = items.some(function(it) { return it.key === 'tempExecPageSize'; });
      if (!hasPageSize) {
        items.push({ key: 'tempExecPageSize', value_json: state.tempExecPageSize || defaultTempExecPageSize });
      }
      return items;
    }

    function persistSettingsRemote() {
      if (!api || typeof api.saveSettings !== 'function') return;
      if (typeof api.getStoredToken === 'function' && typeof api.setToken === 'function') {
        var stored = api.getStoredToken();
        if (stored) api.setToken(stored);
      }
      api.saveSettings('user', collectSettingItems()).catch(function(err) {
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
      if (!state.settings || typeof state.settings !== 'object') {
        state.settings = Object.assign({}, defaultSettings);
      }
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
      ensureTempExecColumns();
    }

    function persistSettings() {
      try {
        localStorage.setItem(settingsKey, JSON.stringify(state.settings));
      } catch (err) {
        console.warn('调用设置保存失败', err);
      }
      persistSettingsRemote();
    }

    function renderTempExecColumnSettings() {
      if (!tempExecColumnForm) return;
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
        modelTimeoutInput.value = state.settings.timeoutSec;
      }
      if (feishuWebhookInput) {
        feishuWebhookInput.value = state.settings.feishuWebhook || '';
      }
      if (feishuMentionInput) {
        feishuMentionInput.value = state.settings.feishuMention || '';
      }
      if (tempExecPageSizeInput) {
        tempExecPageSizeInput.value = state.tempExecPageSize || defaultTempExecPageSize || '';
      }
      renderTempExecColumnSettings();
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
      persistSettings();
      setStatus(modelTimeoutStatus, '模型调用超时已更新为 ' + sec + ' 秒', 'ok');
    }

    function applyFeishuInput() {
      var webhook = feishuWebhookInput ? feishuWebhookInput.value.trim() : '';
      var mention = feishuMentionInput ? feishuMentionInput.value.trim() : '';
      state.settings.feishuWebhook = webhook;
      state.settings.feishuMention = mention;
      persistSettings();
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
      persistSettings();
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
      persistSettings();
      if (result.changed) {
        setStatus(tempExecPageSizeStatus, '分页设置已更新', 'ok');
      } else {
        setStatus(tempExecPageSizeStatus, '分页设置未变化', '');
      }
    }

    function bindEvents() {
      if (saveModelTimeoutBtn) saveModelTimeoutBtn.addEventListener('click', saveTimeoutSetting);
      if (modelTimeoutInput) modelTimeoutInput.addEventListener('input', function() { setStatus(modelTimeoutStatus, '', ''); });
      if (saveFeishuWebhookBtn) saveFeishuWebhookBtn.addEventListener('click', saveFeishuWebhookConfig);
      if (testFeishuWebhookBtn) testFeishuWebhookBtn.addEventListener('click', testFeishuWebhookConfig);
      if (feishuWebhookInput) feishuWebhookInput.addEventListener('input', function() { setStatus(feishuWebhookStatus, '', ''); });
      if (feishuMentionInput) feishuMentionInput.addEventListener('input', function() { setStatus(feishuWebhookStatus, '', ''); });
      if (saveTempExecColumnsBtn) saveTempExecColumnsBtn.addEventListener('click', saveTempExecColumnsSetting);
      if (saveTempExecPageSizeBtn) saveTempExecPageSizeBtn.addEventListener('click', saveTempExecPageSize);
    }

    bindEvents();
    loadSettings();
    renderSettingsUI();
    fetchSettingsFromServer();
    bindAuthReady();

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
