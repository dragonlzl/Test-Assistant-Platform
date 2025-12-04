(function() {
  window.app = window.app || {};

  function init(ctx) {
    if (!ctx) return {};
    var state = ctx.state || {};
    var config = ctx.config || {};
    var utils = ctx.utils || {};
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

    function loadSettings() {
      try {
        var saved = JSON.parse(localStorage.getItem(settingsKey) || '{}');
        if (saved && typeof saved === 'object') {
          var sec = clampTimeoutSeconds(saved.timeoutSec);
          state.settings.timeoutSec = sec;
          if (typeof saved.feishuWebhook === 'string') {
            state.settings.feishuWebhook = saved.feishuWebhook.trim();
          }
          if (typeof saved.feishuMention === 'string') {
            state.settings.feishuMention = saved.feishuMention.trim();
          }
          if (saved.tempExecColumns && typeof saved.tempExecColumns === 'object') {
            state.settings.tempExecColumns = Object.assign({}, defaultTempExecColumns, saved.tempExecColumns);
          }
        }
      } catch (err) {
        console.warn('调用设置加载失败', err);
        state.settings.timeoutSec = defaultSettings.timeoutSec || 300;
        state.settings.feishuWebhook = defaultSettings.feishuWebhook || '';
        state.settings.feishuMention = defaultSettings.feishuMention || '';
      }
      if (typeof state.settings.feishuMention !== 'string') {
        state.settings.feishuMention = '';
      }
      ensureTempExecColumns();
    }

    function persistSettings() {
      try {
        localStorage.setItem(settingsKey, JSON.stringify(state.settings));
      } catch (err) {
        console.warn('调用设置保存失败', err);
      }
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
    }

    bindEvents();

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
    };
  }

  window.app.settings = { init: init };
})();
