(function() {
  window.app = window.app || {};

  var launcher = null;
  var launcherBtn = null;
  var lockDot = null;
  var panel = null;
  var closeBtn = null;
  var clearBtn = null;
  var modelPicker = null;
  var statusEl = null;
  var messagesEl = null;
  var inputEl = null;
  var sendBtn = null;

  var historyLimit = 80;
  var conversationHistoryLimit = 12;
  var failureHistoryLimit = 10;
  var actionHandlers = {};
  var chatHistory = [];
  var failureHistory = [];
  var initialized = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function ensureAssistantMount() {
    if (byId('assistantLauncher') && byId('assistantPanel')) return;
    if (typeof document === 'undefined' || !document.body) return;
    var mount = document.createElement('div');
    mount.id = 'assistantFloatingMount';
    mount.innerHTML = [
      '<div class="assistant-launcher" id="assistantLauncher" title="AI 助手">',
      '  <button class="assistant-launcher-btn" id="assistantLauncherBtn" type="button">AI 助手</button>',
      '  <span class="assistant-lock-dot hidden" id="assistantLockDot">未开启</span>',
      '</div>',
      '<section class="assistant-panel hidden" id="assistantPanel" aria-label="AI助手">',
      '  <header class="assistant-head">',
      '    <strong>AI助手</strong>',
      '    <div class="assistant-head-actions">',
      '      <select id="assistantModelPicker"></select>',
      '      <button class="link-toggle" id="assistantClearBtn" type="button">清空</button>',
      '      <button class="link-toggle" id="assistantCloseBtn" type="button">收起</button>',
      '    </div>',
      '  </header>',
      '  <div class="assistant-status" id="assistantStatus"></div>',
      '  <div class="assistant-messages" id="assistantMessages"></div>',
      '  <div class="assistant-input-row">',
      '    <textarea id="assistantInput" placeholder="输入你的问题或操作指令"></textarea>',
      '    <button id="assistantSendBtn" type="button">发送</button>',
      '  </div>',
      '</section>',
    ].join('\n');
    document.body.appendChild(mount);
  }

  function dispatchAppEvent(name, detail) {
    if (!name) return;
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    try {
      if (typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
      } else if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
        var evt = document.createEvent('CustomEvent');
        evt.initCustomEvent(name, false, false, detail || {});
        window.dispatchEvent(evt);
      }
    } catch (err) {
      // ignore
    }
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getApis() {
    return {
      assistantApi: window.app && window.app.assistantApi ? window.app.assistantApi : null,
      assistantSettingsApi: window.app && window.app.assistantSettingsApi ? window.app.assistantSettingsApi : null,
      assistantModelDiagApi: window.app && window.app.assistantModelDiagApi ? window.app.assistantModelDiagApi : null,
    };
  }

  function getUserKey() {
    var userId = '';
    if (window.app && window.app.state && window.app.state.currentUser && window.app.state.currentUser.id !== undefined && window.app.state.currentUser.id !== null) {
      userId = String(window.app.state.currentUser.id);
    }
    return userId ? ('uid-' + userId) : 'guest';
  }

  function getHistoryStorageKey() {
    return 'tap-assistant-history:' + getUserKey();
  }

  function loadHistory() {
    var key = getHistoryStorageKey();
    var list = [];
    try {
      var raw = localStorage.getItem(key) || '[]';
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed.filter(function(item) {
          return item && typeof item === 'object' && item.role && item.text !== undefined;
        }).map(function(item) {
          return {
            id: item.id || ('msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)),
            role: String(item.role || 'ai'),
            title: item.title ? String(item.title) : '',
            text: String(item.text || ''),
            createdAt: Number(item.createdAt) || Date.now(),
            actions: [],
          };
        });
      }
    } catch (err) {
      list = [];
    }
    chatHistory = list.slice(-historyLimit);
    renderMessages();
  }

  function saveHistory() {
    var key = getHistoryStorageKey();
    var data = chatHistory.slice(-historyLimit).map(function(item) {
      return {
        id: item.id,
        role: item.role,
        title: item.title,
        text: item.text,
        createdAt: item.createdAt,
      };
    });
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      // ignore
    }
  }

  function formatMessageTime(value) {
    var ts = Number(value);
    if (!Number.isFinite(ts) || ts <= 0) ts = Date.now();
    var date = new Date(ts);
    if (isNaN(date.getTime())) date = new Date();
    var two = function(num) {
      var n = Number(num);
      if (!Number.isFinite(n) || n < 0) n = 0;
      return n < 10 ? ('0' + n) : String(n);
    };
    return date.getFullYear()
      + '-' + two(date.getMonth() + 1)
      + '-' + two(date.getDate())
      + ' ' + two(date.getHours())
      + ':' + two(date.getMinutes())
      + ':' + two(date.getSeconds());
  }

  function scrollMessagesToBottom() {
    if (!messagesEl) return;
    try {
      messagesEl.scrollTop = messagesEl.scrollHeight;
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function() {
          if (!messagesEl) return;
          messagesEl.scrollTop = messagesEl.scrollHeight;
        });
      }
    } catch (err) {
      // ignore
    }
  }

  function setStatus(text) {
    if (!statusEl) return;
    statusEl.textContent = text ? String(text) : '';
  }

  function getRoleTitle(role, customTitle) {
    if (customTitle) return customTitle;
    if (role === 'user') return '你';
    if (role === 'sys') return '系统';
    return '助手';
  }

  function registerActionHandler(handler) {
    if (typeof handler !== 'function') return '';
    var id = 'act-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    actionHandlers[id] = handler;
    return id;
  }

  function addMessage(role, text, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var actions = [];
    if (Array.isArray(opts.actions)) {
      actions = opts.actions.map(function(action) {
        var item = action && typeof action === 'object' ? action : {};
        var handlerId = registerActionHandler(item.onClick);
        return {
          id: handlerId,
          label: item.label ? String(item.label) : '执行',
        };
      }).filter(function(item) { return item.id; });
    }
    var msg = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      role: role || 'ai',
      title: getRoleTitle(role, opts.title),
      text: text === undefined || text === null ? '' : String(text),
      createdAt: Date.now(),
      actions: actions,
    };
    chatHistory.push(msg);
    if (chatHistory.length > historyLimit) {
      chatHistory = chatHistory.slice(-historyLimit);
    }
    renderMessages();
    saveHistory();
    return msg;
  }

  function renderMessages() {
    if (!messagesEl) return;
    messagesEl.innerHTML = '';
    chatHistory.forEach(function(msg) {
      var card = document.createElement('div');
      card.className = 'assistant-msg ' + (msg.role === 'user' ? 'user' : 'ai');

      var meta = document.createElement('div');
      meta.className = 'assistant-msg-meta';

      var title = document.createElement('div');
      title.className = 'assistant-msg-title';
      title.textContent = msg.title || getRoleTitle(msg.role);
      meta.appendChild(title);

      var timeEl = document.createElement('div');
      timeEl.className = 'assistant-msg-time';
      timeEl.textContent = formatMessageTime(msg.createdAt);
      meta.appendChild(timeEl);
      card.appendChild(meta);

      var body = document.createElement('div');
      body.className = 'assistant-msg-body';
      body.innerHTML = escapeHtml(msg.text || '').replace(/\n/g, '<br/>');
      card.appendChild(body);

      if (Array.isArray(msg.actions) && msg.actions.length) {
        var actionsWrap = document.createElement('div');
        actionsWrap.className = 'assistant-actions';
        msg.actions.forEach(function(action) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = action.label || '执行';
          btn.dataset.actionId = action.id || '';
          btn.addEventListener('click', function() {
            var fn = actionHandlers[action.id || ''];
            if (typeof fn === 'function') {
              fn();
            }
          });
          actionsWrap.appendChild(btn);
        });
        card.appendChild(actionsWrap);
      }

      messagesEl.appendChild(card);
    });
    scrollMessagesToBottom();
  }

  function getSettingsSnapshot() {
    var apis = getApis();
    if (apis.assistantSettingsApi && typeof apis.assistantSettingsApi.getSettings === 'function') {
      return apis.assistantSettingsApi.getSettings();
    }
    return { assistantEnabled: false, assistantModelId: '', assistantModelName: '' };
  }

  function isAssistantEnabled() {
    var snap = getSettingsSnapshot();
    return snap && snap.assistantEnabled === true;
  }

  function setPanelVisible(visible) {
    if (!panel) return;
    panel.classList.toggle('hidden', !visible);
    if (visible) {
      scrollMessagesToBottom();
    }
  }

  function refreshLockState() {
    var enabled = isAssistantEnabled();
    if (lockDot) lockDot.classList.toggle('hidden', enabled);
    if (launcherBtn) {
      launcherBtn.textContent = enabled ? 'AI 助手' : 'AI 助手(锁定)';
      launcherBtn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    }
    if (!enabled) {
      setPanelVisible(false);
    }
  }

  function refreshModelPicker() {
    if (!modelPicker) return;
    var apis = getApis();
    var settingsSnap = getSettingsSnapshot();
    var selectedId = settingsSnap && settingsSnap.assistantModelId ? String(settingsSnap.assistantModelId) : '';
    var models = [];
    if (apis.assistantSettingsApi && typeof apis.assistantSettingsApi.listModels === 'function') {
      models = apis.assistantSettingsApi.listModels() || [];
    }
    if (!Array.isArray(models) || !models.length) {
      modelPicker.innerHTML = '<option value="">暂无模型</option>';
      modelPicker.value = '';
      return;
    }
    modelPicker.innerHTML = models.map(function(model) {
      var id = model && model.id ? String(model.id) : '';
      if (!id) return '';
      var label = (model.name || '未命名模型') + ' (' + (model.provider || 'custom') + ')';
      var disabled = model.usable === false ? ' disabled' : '';
      return '<option value="' + escapeHtml(id) + '"' + disabled + '>' + escapeHtml(label) + '</option>';
    }).join('');
    if (selectedId) modelPicker.value = selectedId;
  }

  function refreshState() {
    refreshLockState();
    refreshModelPicker();
  }

  function openSettingsForAssistant() {
    var apis = getApis();
    if (apis.assistantApi && typeof apis.assistantApi.switchTab === 'function') {
      apis.assistantApi.switchTab('settings');
    } else if (window.app && typeof window.app.switchTab === 'function') {
      window.app.switchTab('settings');
    }
  }

  function showLauncherClick() {
    if (!isAssistantEnabled()) {
      setStatus('助手未开启，已为你跳转到设置页。');
      addMessage('sys', '助手当前处于关闭状态。请在设置页开启后使用。');
      openSettingsForAssistant();
      return;
    }
    var hidden = panel && panel.classList.contains('hidden');
    setPanelVisible(hidden);
    if (hidden) {
      setStatus('助手已就绪');
      scrollMessagesToBottom();
    }
  }

  function clearChatHistory() {
    chatHistory = [];
    actionHandlers = {};
    saveHistory();
    renderMessages();
  }

  function handleClearChat() {
    if (!window.confirm('确认清空当前聊天记录吗？')) return;
    clearChatHistory();
    setStatus('聊天记录已清空');
  }

  function parseTabFromText(text) {
    var raw = String(text || '');
    var map = [
      { tab: 'settings', keys: ['设置', '配置'] },
      { tab: 'assign', keys: ['功能指派', '指派'] },
      { tab: 'models', keys: ['模型管理', '模型页'] },
      { tab: 'casesgen', keys: ['用例生成', '生成页'] },
      { tab: 'tempexec', keys: ['用例执行', '执行页', '执行中心'] },
      { tab: 'case-library', keys: ['用例库', '库页面'] },
      { tab: 'case-archive', keys: ['归档'] },
      { tab: 'exec-overview', keys: ['执行总览', '总览'] },
      { tab: 'auto', keys: ['一键执行', '功能流程', '自动流程', '评审', '清洗', '拆分'] },
    ];
    for (var i = 0; i < map.length; i += 1) {
      var item = map[i];
      for (var j = 0; j < item.keys.length; j += 1) {
        if (raw.indexOf(item.keys[j]) !== -1) return item.tab;
      }
    }
    return '';
  }

  function containsAny(text, keywords) {
    var source = String(text || '');
    if (!Array.isArray(keywords) || !keywords.length) return false;
    for (var i = 0; i < keywords.length; i += 1) {
      if (source.indexOf(keywords[i]) !== -1) return true;
    }
    return false;
  }

  function normalizeConversationRole(role) {
    var raw = String(role || '').toLowerCase();
    if (raw === 'user') return 'user';
    if (raw === 'ai' || raw === 'assistant') return 'assistant';
    return '';
  }

  function buildConversationHistory(limit, latestUserText) {
    var max = Number(limit);
    if (!Number.isFinite(max) || max <= 0) max = conversationHistoryLimit;
    var list = [];
    var skipUserText = latestUserText === undefined || latestUserText === null
      ? ''
      : String(latestUserText).trim();
    for (var i = chatHistory.length - 1; i >= 0; i -= 1) {
      var msg = chatHistory[i];
      if (!msg || typeof msg !== 'object') continue;
      var role = normalizeConversationRole(msg.role);
      if (!role) continue;
      var content = msg.text === undefined || msg.text === null ? '' : String(msg.text).trim();
      if (!content) continue;
      if (skipUserText && role === 'user' && content === skipUserText) {
        skipUserText = '';
        continue;
      }
      list.unshift({ role: role, content: content });
      if (list.length >= max) break;
    }
    return list;
  }

  function formatJsonCompact(data) {
    try {
      return JSON.stringify(data, null, 2);
    } catch (err) {
      return String(data || '');
    }
  }

  function formatWebSearchResponse(res, responseHint) {
    var result = res && typeof res === 'object' ? res : {};
    var query = result.query ? String(result.query) : '';
    var items = Array.isArray(result.items) ? result.items : [];
    var hint = responseHint === undefined || responseHint === null ? '' : String(responseHint).trim();
    if (!items.length) {
      if (hint) {
        return hint + '\n（联网搜索未找到可用结果，建议换关键词再试）';
      }
      return '已联网搜索“' + query + '”，但暂未找到可用结果。你可以换一个更具体的关键词。';
    }
    var lines = [];
    if (hint) {
      lines.push(hint);
    } else if (query) {
      lines.push('已联网搜索“' + query + '”，结果如下：');
    } else {
      lines.push('已完成联网搜索，结果如下：');
    }
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i] && typeof items[i] === 'object' ? items[i] : {};
      var title = item.title ? String(item.title) : ('结果' + (i + 1));
      var snippet = item.snippet ? String(item.snippet) : '';
      var url = item.url ? String(item.url) : '';
      lines.push((i + 1) + '. ' + title);
      if (snippet) lines.push('   ' + snippet);
      if (url) lines.push('   链接：' + url);
    }
    if (result.provider) {
      lines.push('搜索源：' + String(result.provider));
    }
    return lines.join('\n');
  }

  function looksLikeWeatherText(text) {
    var raw = String(text || '').toLowerCase();
    if (!raw) return false;
    return containsAny(raw, ['天气', 'weather', 'forecast', '气温', '温度', '降雨', '下雨']);
  }

  function extractWeatherCityFromText(text) {
    var raw = String(text || '').trim();
    if (!raw) return '';
    var cleaned = raw.replace(/[，,。！？!?;；:：/\\]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    var match = cleaned.match(/([A-Za-z\u4e00-\u9fff]{2,24})\s*(?:今天天气|今日天气|天气|weather|forecast)/i);
    var candidate = match && match[1] ? String(match[1]).trim() : '';
    if (!candidate) {
      var tokens = cleaned.split(' ').filter(function(item) { return !!item; });
      if (tokens.length) candidate = String(tokens[0]).trim();
    }
    var prefixes = ['帮我', '请帮我', '请问', '查询', '查下', '查一下', '看下', '看看', '现在', '当前', '今天', '今日'];
    for (var i = 0; i < prefixes.length; i += 1) {
      var prefix = prefixes[i];
      if (candidate.indexOf(prefix) === 0) {
        candidate = candidate.slice(prefix.length).trim();
      }
    }
    var suffixes = ['怎么样', '如何', '天气', 'weather', 'forecast', '今天', '今日', '的'];
    for (var j = 0; j < suffixes.length; j += 1) {
      var suffix = suffixes[j];
      if (candidate.length > suffix.length && candidate.slice(candidate.length - suffix.length) === suffix) {
        candidate = candidate.slice(0, candidate.length - suffix.length).trim();
      }
    }
    if (!candidate) return '';
    if (containsAny(candidate.toLowerCase(), ['今天', '今日', '现在', '当前', '天气', 'weather', 'forecast'])) {
      return '';
    }
    return candidate;
  }

  function normalizeWeatherSearchQuery(query, userText) {
    var queryText = String(query || '').trim();
    var userQuery = String(userText || '').trim();
    var weatherLikely = looksLikeWeatherText(queryText) || looksLikeWeatherText(userQuery);
    if (!weatherLikely) return queryText;
    var city = extractWeatherCityFromText(queryText) || extractWeatherCityFromText(userQuery);
    if (!city) return '';
    return city + ' 今日天气';
  }

  function trimSearchSnippet(text, maxLen) {
    var raw = String(text || '').trim();
    if (!raw) return '';
    var limit = Number(maxLen);
    if (!Number.isFinite(limit) || limit <= 0) limit = 140;
    if (raw.length <= limit) return raw;
    return raw.slice(0, limit) + '...';
  }

  function normalizeSearchItemsForSummary(items, limit) {
    var list = Array.isArray(items) ? items : [];
    var max = Number(limit);
    if (!Number.isFinite(max) || max <= 0) max = 5;
    var output = [];
    for (var i = 0; i < list.length; i += 1) {
      if (output.length >= max) break;
      var item = list[i] && typeof list[i] === 'object' ? list[i] : {};
      var title = item.title ? String(item.title).trim() : '';
      var snippet = item.snippet ? String(item.snippet).trim() : '';
      var url = item.url ? String(item.url).trim() : '';
      if (!title && !snippet && !url) continue;
      output.push({
        title: title || ('结果' + (output.length + 1)),
        snippet: trimSearchSnippet(snippet, 160),
        url: url,
      });
    }
    return output;
  }

  function buildCompactWebSearchFallback(res, responseHint) {
    var result = res && typeof res === 'object' ? res : {};
    var query = result.query ? String(result.query) : '';
    var items = normalizeSearchItemsForSummary(result.items, 5);
    var hint = responseHint === undefined || responseHint === null ? '' : String(responseHint).trim();
    if (!items.length) {
      if (hint) {
        return hint + '\n（联网搜索未找到可用结果，建议换关键词或补充城市/时间）';
      }
      return '已联网搜索“' + query + '”，但暂未找到可靠结果。建议补充更具体关键词后重试。';
    }
    var lines = [];
    if (hint) lines.push(hint);
    lines.push('我已根据联网结果整理为简版：');
    var first = items[0] || {};
    if (first.snippet) {
      lines.push('结论：' + trimSearchSnippet(first.snippet, 120));
    } else if (first.title) {
      lines.push('结论：' + first.title);
    }
    lines.push('补充要点：');
    for (var i = 0; i < items.length && i < 3; i += 1) {
      var item = items[i];
      var text = item.snippet || item.title || ('结果' + (i + 1));
      lines.push((i + 1) + '. ' + trimSearchSnippet(text, 90));
    }
    lines.push('参考来源：');
    for (var j = 0; j < items.length && j < 3; j += 1) {
      var src = items[j];
      var title = src.title || ('来源' + (j + 1));
      if (src.url) {
        lines.push((j + 1) + '. ' + title + ' - ' + src.url);
      } else {
        lines.push((j + 1) + '. ' + title);
      }
    }
    if (result.provider) lines.push('搜索源：' + String(result.provider));
    return lines.join('\n');
  }

  async function summarizeWebSearchByModel(userText, query, searchRes, responseHint) {
    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.callModel !== 'function') return '';
    var result = searchRes && typeof searchRes === 'object' ? searchRes : {};
    var items = normalizeSearchItemsForSummary(result.items, 5);
    if (!items.length) return '';
    var payload = {
      userQuestion: String(userText || ''),
      searchQuery: String(query || ''),
      provider: result.provider ? String(result.provider) : '',
      items: items,
    };
    var prompt = [
      '你是“联网结果整理助手”。',
      '基于搜索结果给出最终答复，必须简洁、可执行、避免堆砌原文。',
      '输出结构：',
      '1) 直接结论（1-2句）',
      '2) 关键要点（2-4条）',
      '3) 参考来源（最多3条，保留链接）',
      '要求：',
      '- 不要逐条复读全部搜索结果。',
      '- 不确定时要明确说明不确定点。',
      '- 对天气类问题，优先给出“今天”可用信息；缺城市时提示补充城市。',
      '- 输出中文纯文本，不要 JSON。',
    ].join('\n');
    var history = buildConversationHistory(8, userText);
    var res = null;
    try {
      res = await apis.assistantApi.callModel(JSON.stringify(payload, null, 2), {
        prompt: prompt,
        temperature: 0.1,
        history: history,
      });
    } catch (err) {
      res = { ok: false, reason: err && err.message ? String(err.message) : '整理异常' };
    }
    if (!res || res.ok !== true || !res.content) return '';
    var text = String(res.content || '').trim();
    if (!text) return '';
    var maybeJson = parseJsonObjectFromText(text);
    if (maybeJson && maybeJson.action) return '';
    if (responseHint) {
      var hint = String(responseHint).trim();
      if (hint) return hint + '\n' + text;
    }
    return text;
  }

  function isProjectScopedText(text) {
    var raw = String(text || '');
    if (!raw) return false;
    if (parseTabFromText(raw)) return true;
    return containsAny(raw, [
      '页面', '页签', 'tab',
      '项目', '需求',
      '用例', '漏测', '备忘',
      '模型', '连通性', '诊断',
      '设置', '功能指派', '执行',
      '助手',
    ]);
  }

  function shouldPreferModelThinking(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (isCaseListIntent(raw)) return false;
    if (containsAny(raw, ['删除用例', '移除用例', '开启助手', '关闭助手', '禁用助手'])) return false;
    if (containsAny(raw, ['当前页面', '什么页面', '哪个页面', '当前页签', '现在页签', '在哪个页面', '在哪个页签'])) return false;
    if (containsAny(raw, ['跳转', '打开', '进入', '前往', '去']) && isProjectScopedText(raw)) return false;
    if (containsAny(raw, ['获取', '查看', '查询', '读取']) && containsAny(raw, ['页面数据', '页面信息', '统计', '状态']) && isProjectScopedText(raw)) return false;
    if (containsAny(raw, ['新增备忘', '删除备忘', '完成备忘', '勾选备忘'])) return false;
    if (containsAny(raw, ['用例生成', '漏测推荐']) && containsAny(raw, ['执行', '触发', '开始', '运行'])) return false;
    if (containsAny(raw, ['怎么', '如何', '为什么', '为何', '能不能', '是否', '吗', '嘛', '呢', '哪些', '多少', '?', '？'])) return true;
    if (!isProjectScopedText(raw)) return true;
    return false;
  }

  function parseJsonObjectFromText(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    var candidate = raw;
    if (candidate.charAt(0) !== '{') {
      var match = candidate.match(/\{[\s\S]*\}/);
      if (!match) return null;
      candidate = match[0];
    }
    try {
      var parsed = JSON.parse(candidate);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  function isKnownTabId(tabId) {
    var target = tabId === undefined || tabId === null ? '' : String(tabId).trim();
    if (!target) return false;
    var apis = getApis();
    if (apis.assistantApi && typeof apis.assistantApi.listTabs === 'function') {
      var tabs = apis.assistantApi.listTabs() || [];
      if (Array.isArray(tabs)) {
        for (var i = 0; i < tabs.length; i += 1) {
          var item = tabs[i] || {};
          var tab = item.tab === undefined || item.tab === null ? '' : String(item.tab).trim();
          if (tab && tab === target) return true;
        }
      }
    }
    return containsAny(target, [
      'settings',
      'assign',
      'models',
      'casesgen',
      'tempexec',
      'case-library',
      'case-archive',
      'exec-overview',
      'auto',
    ]);
  }

  function shouldRunIntentClassifier(text) {
    var raw = String(text || '');
    if (!raw) return false;
    var hasNavVerb = containsAny(raw, ['跳转', '打开', '进入', '前往', '去']);
    var hasQueryVerb = containsAny(raw, ['查看', '查询', '获取', '读取']);
    var hasQueryTarget = containsAny(raw, ['数据', '状态', '信息', '统计']);
    if (isCaseListIntent(raw) && isProjectScopedText(raw)) return true;
    if (hasNavVerb && isProjectScopedText(raw)) return true;
    if (hasQueryVerb && hasQueryTarget && isProjectScopedText(raw)) return true;
    return false;
  }

  function getTabLabelById(tabId) {
    var target = tabId === undefined || tabId === null ? '' : String(tabId);
    if (!target) return '';
    var apis = getApis();
    if (apis.assistantApi && typeof apis.assistantApi.listTabs === 'function') {
      var tabs = apis.assistantApi.listTabs() || [];
      if (Array.isArray(tabs)) {
        for (var i = 0; i < tabs.length; i += 1) {
          var item = tabs[i] || {};
          var tab = item.tab === undefined || item.tab === null ? '' : String(item.tab);
          if (!tab || tab !== target) continue;
          if (item.label !== undefined && item.label !== null && String(item.label).trim()) {
            return String(item.label).trim();
          }
          break;
        }
      }
    }
    var fallbackMap = {
      settings: '设置',
      assign: '功能指派',
      models: '模型管理',
      casesgen: '用例生成',
      tempexec: '用例执行',
      'case-library': '用例库',
      'case-archive': '用例归档',
      'exec-overview': '执行总览',
      auto: '一键执行',
    };
    return fallbackMap[target] || '';
  }

  function getTabOperationHints(tabId) {
    var map = {
      settings: [
        '查看和调整全局设置（主题、超时、助手开关等）',
        '切换助手默认模型并保存',
        '查看设置项效果说明',
      ],
      assign: [
        '给功能指派模型并测试连通性',
        '查看模型测试失败后的诊断建议',
        '应用建议配置后重测',
      ],
      models: [
        '新增/编辑/删除模型配置',
        '测试模型连通性',
        '查看模型配置完整性状态',
      ],
      casesgen: [
        '触发用例生成并查看进度',
        '查看各模块生成结果',
        '导出生成结果',
      ],
      tempexec: [
        '查看和更新执行结果',
        '按文件管理执行集',
        '导出执行数据',
      ],
      'case-library': [
        '查看&编辑用例内容',
        '导入/导出用例文件',
        '删除用例（会二次确认，且支持8秒撤回）',
      ],
      'case-archive': [
        '查看归档用例',
        '恢复归档到可编辑状态',
        '删除归档记录',
      ],
      'exec-overview': [
        '查看执行总览统计',
        '按条件筛选执行数据',
        '定位并跳转相关执行记录',
      ],
      auto: [
        '执行需求评审/清洗/拆分流程',
        '运行漏测推荐',
        '确认后生成补全内容',
      ],
    };
    var key = tabId === undefined || tabId === null ? '' : String(tabId).trim();
    var list = map[key];
    if (Array.isArray(list) && list.length) return list;
    return [
      '页面跳转',
      '页面数据查询',
      '根据当前页面执行可用操作',
    ];
  }

  function getPageFileName() {
    try {
      var path = window && window.location && window.location.pathname ? String(window.location.pathname) : '';
      if (!path) return '';
      var normalized = path.split('?')[0].split('#')[0];
      if (!normalized) return '';
      var parts = normalized.split('/');
      var name = parts.length ? parts[parts.length - 1] : '';
      return name || 'index.html';
    } catch (err) {
      return '';
    }
  }

  function isCaseListIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (!containsAny(raw, ['用例', 'case'])) return false;
    if (containsAny(raw, ['用例生成', '生成用例', '删除用例', '修改用例', '编辑用例'])) return false;
    if (containsAny(raw, [
      '当前有哪些用例',
      '有哪些用例',
      '当前页面都有哪些用例',
      '当前页面有哪些用例',
      '当前页面用例列表',
      '获取当前页面用例列表',
      '获取用例列表',
      '列出用例',
      '用例列表',
      '用例清单',
      '当前页面都有什么用例',
      '当前页面有什么用例',
      '当前页都有哪些用例',
      '当前页有哪些用例',
      '当前页都有什么用例',
      '当前页有什么用例',
      '本页都有哪些用例',
      '本页有哪些用例',
      '本页都有什么用例',
      '本页有什么用例',
      '有啥用例',
      '什么用例',
    ])) return true;
    if (containsAny(raw, ['当前页面', '当前页', '本页', '这个页面', '该页面'])
      && containsAny(raw, ['有什么', '有啥', '哪些', '有哪些', '都有什么'])) {
      return true;
    }
    return containsAny(raw, ['查看', '查询', '获取', '读取', '列出', '哪些', '有哪些', '清单', '有什么', '有啥']);
  }

  function formatCaseListTime(value) {
    if (!value) return '--';
    var text = String(value);
    var date = new Date(text);
    if (isNaN(date.getTime())) return text;
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var two = function(num) { return num < 10 ? ('0' + num) : String(num); };
    return year + '-' + two(month) + '-' + two(day) + ' ' + two(hours) + ':' + two(minutes);
  }

  function formatEditorCaseListResponse(result) {
    var items = Array.isArray(result.items) ? result.items : [];
    var caseFile = result.caseFile && typeof result.caseFile === 'object' ? result.caseFile : {};
    var caseName = caseFile.name ? String(caseFile.name) : (caseFile.id ? ('用例#' + String(caseFile.id)) : '当前用例');
    var caseId = caseFile.id === undefined || caseFile.id === null ? '' : String(caseFile.id);
    var searchText = result.searchText ? String(result.searchText).trim() : '';
    var total = Number(result.total);
    if (!Number.isFinite(total) || total < 0) total = items.length;
    var totalAll = Number(result.totalAll);
    if (!Number.isFinite(totalAll) || totalAll < 0) totalAll = total;
    var lines = [];
    var title = '当前正在编辑用例：' + caseName;
    if (caseId) title += '（ID: ' + caseId + '）';
    lines.push(title);
    if (!items.length) {
      if (searchText) {
        lines.push('当前搜索词“' + searchText + '”下没有匹配条目。');
        lines.push('当前用例总条目：' + totalAll + '。');
      } else {
        lines.push('当前用例暂无条目。');
      }
      return lines.join('\n');
    }
    if (searchText) {
      lines.push('已按搜索词“' + searchText + '”过滤，命中 ' + total + ' / ' + totalAll + ' 条：');
    } else {
      lines.push('当前页面可见条目：');
    }
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i] && typeof items[i] === 'object' ? items[i] : {};
      var moduleName = item.module ? String(item.module) : '';
      var titleText = item.title ? String(item.title) : '';
      if (!titleText) {
        var fallbackIndex = Number(item.sourceIndex) || Number(item.index) || (i + 1);
        titleText = '未命名条目#' + fallbackIndex;
      }
      var line = (i + 1) + '. ';
      if (moduleName) line += '[' + moduleName + '] ';
      line += titleText;
      var meta = [];
      if (item.priority) meta.push('优先级: ' + String(item.priority));
      if (item.id) meta.push('ID: ' + String(item.id));
      if (meta.length) line += ' | ' + meta.join(' | ');
      lines.push(line);
    }
    if (result.truncated) {
      lines.push('已展示前 ' + items.length + ' 条，共 ' + (Number(result.total) || items.length) + ' 条。');
    }
    return lines.join('\n');
  }

  function formatCaseListResponse(res) {
    var result = res && typeof res === 'object' ? res : {};
    var scope = result.scope === undefined || result.scope === null ? '' : String(result.scope).trim();
    if (scope === 'editor' || (result.caseFile && typeof result.caseFile === 'object')) {
      return formatEditorCaseListResponse(result);
    }
    var items = Array.isArray(result.items) ? result.items : [];
    if (!items.length) {
      if (result.projectId) return '当前项目（' + result.projectId + '）还没有用例。';
      return '当前还没有可查询的用例。';
    }
    var lines = [];
    lines.push(result.projectId ? ('当前项目（' + result.projectId + '）用例列表：') : '当前用例列表：');
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i] && typeof items[i] === 'object' ? items[i] : {};
      var name = item.name ? String(item.name) : ('用例#' + (item.id || (i + 1)));
      var itemCount = Number(item.itemCount);
      if (!Number.isFinite(itemCount) || itemCount < 0) itemCount = 0;
      var updated = formatCaseListTime(item.updatedAt || '');
      lines.push((i + 1) + '. ' + name + ' | ID: ' + (item.id || '-') + ' | 条目: ' + itemCount + ' | 更新: ' + updated);
    }
    if (result.truncated) {
      lines.push('已展示前 ' + items.length + ' 条，共 ' + (Number(result.total) || items.length) + ' 条。');
    }
    return lines.join('\n');
  }

  async function tryHandleCaseListIntent(text, options) {
    var raw = String(text || '').trim();
    var opts = options && typeof options === 'object' ? options : {};
    if (!raw) return null;
    if (!opts.force && !isCaseListIntent(raw)) return null;
    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.listCurrentCases !== 'function') {
      return '当前环境不支持读取用例列表。';
    }
    setStatus('正在获取用例列表...');
    var res = null;
    try {
      res = await apis.assistantApi.listCurrentCases({ limit: 20 });
    } catch (err) {
      res = { ok: false, reason: err && err.message ? String(err.message) : '读取异常' };
    }
    if (!res || res.ok !== true) {
      setStatus('用例列表获取失败');
      return '获取用例列表失败：' + (res && res.reason ? res.reason : '未知错误');
    }
    setStatus('');
    return formatCaseListResponse(res);
  }

  function tryHandleCurrentPageIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    if (isCaseListIntent(raw)) return null;
    if (containsAny(raw, ['用例']) && containsAny(raw, ['有什么', '有啥', '什么', '哪些', '有哪些', '列表', '清单', '多少'])) return null;
    var askCurrentPage = containsAny(raw, [
      '什么页面',
      '哪个页面',
      '当前页面',
      '现在页面',
      '当前页签',
      '现在页签',
      '在哪个页面',
      '在哪个页签',
    ]);
    if (!askCurrentPage) {
      if (!containsAny(raw, ['当前', '现在', '在哪'])) return null;
      if (!containsAny(raw, ['页面', '页签', 'tab'])) return null;
    }
    var apis = getApis();
    var data = null;
    if (apis.assistantApi && typeof apis.assistantApi.getPageData === 'function') {
      data = apis.assistantApi.getPageData('');
    }
    var tab = data && data.tab ? String(data.tab) : '';
    var tabLabel = getTabLabelById(tab);
    var fileName = getPageFileName();
    var askOperations = containsAny(raw, [
      '能做什么',
      '可以做什么',
      '可做什么',
      '有什么操作',
      '能做什么操作',
      '可执行',
      '支持什么',
    ]);
    var lines = [];
    if (tabLabel && tab) {
      lines.push('当前页面是：' + tabLabel + '（' + tab + '）');
    } else if (tabLabel) {
      lines.push('当前页面是：' + tabLabel);
    } else if (tab) {
      lines.push('当前页面是：' + tab);
    } else {
      lines.push('当前页面信息暂不可用。');
    }
    if (fileName) {
      lines.push('页面文件：' + fileName);
    }
    if (askOperations) {
      var hints = getTabOperationHints(tab);
      lines.push('当前页面可执行操作：');
      for (var i = 0; i < hints.length; i += 1) {
        lines.push((i + 1) + '. ' + hints[i]);
      }
    }
    return lines.join('\n');
  }

  function tryHandleNavigationIntent(text) {
    var raw = String(text || '');
    if (!containsAny(raw, ['跳转', '打开', '进入', '前往', '去'])) return null;
    var tab = parseTabFromText(raw);
    if (!tab) return null;
    var apis = getApis();
    if (apis.assistantApi && typeof apis.assistantApi.switchTab === 'function') {
      apis.assistantApi.switchTab(tab);
      return '已跳转到页面：' + tab;
    }
    return '页面跳转能力暂不可用';
  }

  function tryHandleQueryIntent(text) {
    var raw = String(text || '');
    if (!containsAny(raw, ['查看', '查询', '获取', '读取'])) return null;
    if (!containsAny(raw, ['数据', '状态', '信息', '统计'])) return null;
    if (!isProjectScopedText(raw)) return null;
    var tab = parseTabFromText(raw);
    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.getPageData !== 'function') {
      return '页面数据查询能力暂不可用';
    }
    var data = apis.assistantApi.getPageData(tab || '');
    return '页面数据如下：\n' + formatJsonCompact(data);
  }

  function extractMemoText(raw) {
    var text = String(raw || '').trim();
    var match = text.match(/(?:新增|添加|记录|记下)\s*备忘[:：]?\s*(.+)$/);
    if (!match) {
      match = text.match(/备忘(?:新增|添加|记录|记下)?[:：]?\s*(.+)$/);
    }
    if (!match) return '';
    return match[1] ? String(match[1]).trim() : '';
  }

  function tryHandleMemoIntent(text) {
    var raw = String(text || '').trim();
    if (raw.indexOf('备忘') === -1) return null;
    var apis = getApis();
    if (!apis.assistantApi) return '备忘能力暂不可用';

    if (containsAny(raw, ['查看', '列表', '列出'])) {
      if (typeof apis.assistantApi.memoList !== 'function') return '备忘能力暂不可用';
      var tabs = apis.assistantApi.memoList() || [];
      if (!tabs.length) return '当前没有备忘内容。';
      var lines = [];
      tabs.forEach(function(tab) {
        var prefix = tab.isActive ? '[当前页签]' : '[页签]';
        lines.push(prefix + (tab.name || '未命名'));
        (tab.items || []).forEach(function(item) {
          var mark = item.done ? '已完成' : '待办';
          lines.push('  ' + item.index + '. (' + mark + ') ' + (item.text || ''));
        });
      });
      return lines.join('\n');
    }

    if (containsAny(raw, ['完成', '勾选']) && /\d+/.test(raw)) {
      if (typeof apis.assistantApi.memoToggle !== 'function') return '备忘能力暂不可用';
      var doneIndex = Number((raw.match(/\d+/) || [0])[0]);
      var doneRes = apis.assistantApi.memoToggle('', doneIndex, true);
      return doneRes && doneRes.ok ? ('已将备忘第 ' + doneIndex + ' 条标记为完成。') : (doneRes.reason || '标记失败');
    }

    if (containsAny(raw, ['删除', '移除']) && /\d+/.test(raw)) {
      if (!window.confirm('确认删除该备忘条目吗？')) return '已取消删除。';
      if (typeof apis.assistantApi.memoRemove !== 'function') return '备忘能力暂不可用';
      var removeIndex = Number((raw.match(/\d+/) || [0])[0]);
      var removeRes = apis.assistantApi.memoRemove('', removeIndex);
      return removeRes && removeRes.ok ? ('已删除第 ' + removeIndex + ' 条备忘。') : (removeRes.reason || '删除失败');
    }

    if (containsAny(raw, ['新增', '添加', '记录', '记下'])) {
      if (typeof apis.assistantApi.memoAdd !== 'function') return '备忘能力暂不可用';
      var content = extractMemoText(raw);
      if (!content) return '请在“新增备忘”后补充具体内容。';
      var addRes = apis.assistantApi.memoAdd(content, '');
      return addRes && addRes.ok ? ('已新增备忘：' + content) : (addRes.reason || '新增失败');
    }

    return '你可以让我：新增备忘、列出备忘、完成备忘、删除备忘。';
  }

  function tryHandleCaseIntent(text) {
    var raw = String(text || '');
    var apis = getApis();
    if (!apis.assistantApi) return null;

    if (raw.indexOf('用例') !== -1 && containsAny(raw, ['修改', '编辑', '怎么改', '如何改', '怎么修改', '如何修改'])) {
      return [
        '修改用例建议这样操作：',
        '1. 进入“用例库 -> 查看&编辑”。',
        '2. 选中目标用例文件后在列表中直接编辑对应字段。',
        '3. 完成后保存（删除类操作会走确认与撤回机制）。',
        '你也可以直接让我“跳转到用例库”。',
      ].join('\n');
    }

    if (containsAny(raw, ['删除用例', '移除用例'])) {
      if (typeof apis.assistantApi.deleteCase !== 'function') return '当前页面不支持助手删除用例。';
      var idxMatch = raw.match(/第\s*(\d+)\s*条/);
      var idx = idxMatch ? Number(idxMatch[1]) : 1;
      var delRes = apis.assistantApi.deleteCase(idx);
      if (delRes && delRes.ok) {
        return '删除已触发：第 ' + delRes.index + ' 条。若误删可在8秒内撤回。';
      }
      return delRes && delRes.reason ? delRes.reason : '删除触发失败';
    }

    if (containsAny(raw, ['用例生成']) && containsAny(raw, ['开始', '执行', '触发', '运行', '一键'])) {
      if (typeof apis.assistantApi.runCaseGeneration !== 'function') return '用例生成能力暂不可用';
      setStatus('正在触发用例生成...');
      return apis.assistantApi.runCaseGeneration().then(function(res) {
        return res && res.ok ? '已触发用例生成流程，请查看用例生成页面进度。' : (res.reason || '用例生成触发失败');
      });
    }

    if (containsAny(raw, ['漏测', '易漏']) && containsAny(raw, ['推荐', '补全', '执行', '生成', '触发'])) {
      if (typeof apis.assistantApi.runMissingRecommendation !== 'function') return '漏测推荐能力暂不可用';
      setStatus('正在触发漏测推荐...');
      return apis.assistantApi.runMissingRecommendation().then(function(res) {
        return res && res.ok ? '已触发漏测推荐，请在页面确认后再生成。' : (res.reason || '漏测推荐触发失败');
      });
    }

    return null;
  }

  function parseSettingKey(raw) {
    if (containsAny(raw, ['助手模型', '聊天模型'])) return 'assistantModelId';
    if (containsAny(raw, ['助手', 'ai助手'])) return 'assistantEnabled';
    if (containsAny(raw, ['易漏', '漏测推荐'])) return 'missingCaseReminderAiEnabled';
    if (containsAny(raw, ['导航', '收起'])) return 'smartTopNavCollapse';
    if (containsAny(raw, ['主题'])) return 'theme';
    if (containsAny(raw, ['超时'])) return 'timeoutSec';
    return '';
  }

  function tryHandleSettingsIntent(text) {
    var raw = String(text || '');
    var apis = getApis();
    if (!apis.assistantSettingsApi) return null;

    if (containsAny(raw, ['作用', '效果', '说明', '是什么意思']) && containsAny(raw, ['设置', '选项', '助手', '主题', '超时', '导航'])) {
      var explainKey = parseSettingKey(raw);
      if (!explainKey) return '请告诉我你想了解哪一项设置。';
      if (typeof apis.assistantSettingsApi.describeSetting === 'function') {
        return apis.assistantSettingsApi.describeSetting(explainKey);
      }
      return '该设置项说明暂不可用。';
    }

    if (containsAny(raw, ['关闭助手', '禁用助手'])) {
      return '安全策略限制：助手不能通过聊天关闭自己，请在设置页手动关闭。';
    }

    if (containsAny(raw, ['开启助手'])) {
      if (!window.confirm('确认开启 AI 助手？')) return '已取消。';
      var onRes = apis.assistantSettingsApi.applyPatch({ assistantEnabled: true }, { source: 'assistant' });
      return onRes && onRes.ok ? '助手已开启。' : (onRes.reason || '开启失败');
    }

    if (containsAny(raw, ['开启', '关闭']) && containsAny(raw, ['易漏', '漏测推荐'])) {
      var aiOn = containsAny(raw, ['开启']);
      if (!window.confirm('确认' + (aiOn ? '开启' : '关闭') + '易漏用例推荐？')) return '已取消。';
      var aiRes = apis.assistantSettingsApi.applyPatch(
        { missingCaseReminderAiEnabled: aiOn ? 'on' : 'off' },
        { source: 'assistant' }
      );
      return aiRes && aiRes.ok ? ('已' + (aiOn ? '开启' : '关闭') + '易漏用例推荐。') : (aiRes.reason || '设置失败');
    }

    if (containsAny(raw, ['开启', '关闭']) && containsAny(raw, ['导航', '收起'])) {
      var collapseOn = containsAny(raw, ['开启']);
      if (!window.confirm('确认' + (collapseOn ? '开启' : '关闭') + '导航智能收起？')) return '已取消。';
      var navRes = apis.assistantSettingsApi.applyPatch(
        { smartTopNavCollapse: collapseOn },
        { source: 'assistant' }
      );
      return navRes && navRes.ok ? ('已' + (collapseOn ? '开启' : '关闭') + '导航智能收起。') : (navRes.reason || '设置失败');
    }

    if (containsAny(raw, ['深色主题', '黑色主题', '浅色主题', '白色主题', '切换主题'])) {
      var theme = containsAny(raw, ['深色主题', '黑色主题']) ? 'dark' : 'light';
      if (!window.confirm('确认切换为' + (theme === 'dark' ? '黑色主题' : '白色主题') + '？')) return '已取消。';
      var themeRes = apis.assistantSettingsApi.applyPatch({ theme: theme }, { source: 'assistant' });
      return themeRes && themeRes.ok ? '主题已切换。' : (themeRes.reason || '设置失败');
    }

    if (containsAny(raw, ['设置模型']) || containsAny(raw, ['切换模型'])) {
      if (!modelPicker) return '请在助手面板顶部选择模型。';
      return '可在助手面板顶部下拉框切换模型，或在设置页保存为默认模型。';
    }

    return null;
  }

  async function classifyIntentByModel(text) {
    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.callModel !== 'function') return null;
    var prompt = [
      '你是意图分类器。',
      '判断用户输入主要意图：navigate/query/query_case_list/chat。',
      '如果是 navigate/query，请尽量给出 tab 字段（例如 settings/assign/models/casesgen/tempexec/case-library/case-archive/exec-overview/auto）。',
      '当用户明确想看“当前有哪些用例/用例列表/列出用例”时，intent 请选择 query_case_list。',
      '只输出 JSON：{"intent":"navigate|query|query_case_list|chat","tab":"","reason":""}'
    ].join('\n');
    var res = await apis.assistantApi.callModel(String(text || ''), { prompt: prompt, temperature: 0 });
    if (!res || !res.ok || !res.content) return null;
    var parsed = null;
    try {
      var raw = String(res.content || '').trim();
      var payloadMatch = raw.match(/\{[\s\S]*\}/);
      if (!payloadMatch) return null;
      parsed = JSON.parse(payloadMatch[0]);
    } catch (err) {
      parsed = null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  }

  async function tryHandleModelDrivenReply(text) {
    var content = String(text || '').trim();
    if (!content) return null;
    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.callModel !== 'function') return null;
    if (!shouldPreferModelThinking(content)) return null;

    var prompt = [
      '你是测试助手平台内置AI助手，先理解用户真实意图再决定回复方式。',
      '你有两种输出方式：',
      '1) 直接回复：输出自然语言文本。',
      '2) 需要执行工具动作时：只输出 JSON，不要代码块。格式：',
      '{"action":"navigate|query_page_data|query_case_list|web_search","tab":"","query":"","response":""}',
      '约束：',
      '- 当用户问“当前有哪些用例/用例列表”时，action 用 query_case_list。',
      '- 当用户明确要求页面跳转时，action 用 navigate 并给出 tab。',
      '- 当用户明确要求读取页面统计数据时，action 用 query_page_data。',
      '- 当问题依赖联网实时信息（天气/新闻/最新版本/官网资料）时，action 用 web_search，并填写 query。',
      '- 删除/配置变更等写操作不要在这里直接执行，先给建议。',
      '- 项目外问题要正常回答，不要强行返回页面数据。',
    ].join('\n');
    var conversationHistory = buildConversationHistory(conversationHistoryLimit, content);
    var res = null;
    try {
      res = await apis.assistantApi.callModel(content, {
        prompt: prompt,
        temperature: 0.2,
        history: conversationHistory,
      });
    } catch (err) {
      res = { ok: false, reason: err && err.message ? String(err.message) : '模型调用异常' };
    }
    if (!res || res.ok !== true || !res.content) return null;

    var raw = String(res.content || '').trim();
    if (!raw) return null;
    var parsed = parseJsonObjectFromText(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.action) {
      return { handled: true, text: raw };
    }

    var action = String(parsed.action || '').trim();
    if (!action) return { handled: true, text: raw };
    if (action === 'query_case_list') {
      var caseListReply = await tryHandleCaseListIntent(content, { force: true });
      if (caseListReply) return { handled: true, text: caseListReply };
      return null;
    }
    if (action === 'navigate') {
      var targetTabRaw = parsed.tab ? String(parsed.tab) : '';
      var targetTab = targetTabRaw && isKnownTabId(targetTabRaw) ? targetTabRaw : parseTabFromText(content);
      if (!targetTab) return null;
      if (apis.assistantApi && typeof apis.assistantApi.switchTab === 'function') {
        apis.assistantApi.switchTab(targetTab);
        if (parsed.response && String(parsed.response).trim()) {
          return { handled: true, text: String(parsed.response).trim() };
        }
        return { handled: true, text: '已按你的意图跳转到：' + targetTab };
      }
      return null;
    }
    if (action === 'query_page_data') {
      if (isCaseListIntent(content)) {
        var forcedCaseListReply = await tryHandleCaseListIntent(content, { force: true });
        if (forcedCaseListReply) {
          return { handled: true, text: forcedCaseListReply };
        }
      }
      var queryTabRaw = parsed.tab ? String(parsed.tab) : '';
      var queryTab = queryTabRaw && isKnownTabId(queryTabRaw) ? queryTabRaw : parseTabFromText(content);
      if (!queryTab && !isProjectScopedText(content)) return null;
      if (apis.assistantApi && typeof apis.assistantApi.getPageData === 'function') {
        var data = apis.assistantApi.getPageData(queryTab || '');
        return { handled: true, text: '按你的意图返回页面数据：\n' + formatJsonCompact(data) };
      }
      return null;
    }
    if (action === 'web_search') {
      if (!apis.assistantApi || typeof apis.assistantApi.searchWeb !== 'function') {
        return { handled: true, text: '当前环境未开启联网搜索能力。' };
      }
      var searchQuery = parsed.query && String(parsed.query).trim()
        ? String(parsed.query).trim()
        : content;
      var normalizedWeatherQuery = normalizeWeatherSearchQuery(searchQuery, content);
      if ((looksLikeWeatherText(searchQuery) || looksLikeWeatherText(content)) && !normalizedWeatherQuery) {
        return { handled: true, text: '可以。请先告诉我你所在的城市（例如“深圳”），我再给你今天的天气简报。' };
      }
      if (normalizedWeatherQuery) {
        searchQuery = normalizedWeatherQuery;
      }
      var searchRes = null;
      setStatus('正在联网搜索...');
      try {
        searchRes = await apis.assistantApi.searchWeb(searchQuery, { limit: 5 });
      } catch (err) {
        searchRes = { ok: false, reason: err && err.message ? String(err.message) : '联网搜索异常' };
      }
      if (!searchRes || searchRes.ok !== true) {
        setStatus('联网搜索失败');
        return {
          handled: true,
          text: '联网搜索失败：' + (searchRes && searchRes.reason ? searchRes.reason : '未知错误'),
        };
      }
      setStatus('');
      var summarized = await summarizeWebSearchByModel(content, searchQuery, searchRes, parsed.response || '');
      if (summarized) {
        return { handled: true, text: summarized };
      }
      return { handled: true, text: buildCompactWebSearchFallback(searchRes, parsed.response || '') };
    }
    if (parsed.response && String(parsed.response).trim()) {
      return { handled: true, text: String(parsed.response).trim() };
    }
    return null;
  }

  function formatDiagnosisText(diag) {
    var diagnosis = diag && typeof diag === 'object' ? diag : {};
    var lines = [];
    if (diagnosis.judgement) lines.push('问题判断：' + diagnosis.judgement);
    if (diagnosis.rootCause) lines.push('可能原因：' + diagnosis.rootCause);
    if (Array.isArray(diagnosis.steps) && diagnosis.steps.length) {
      lines.push('建议步骤：');
      diagnosis.steps.forEach(function(step, idx) {
        lines.push((idx + 1) + '. ' + String(step));
      });
    }
    if (Array.isArray(diagnosis.manualItems) && diagnosis.manualItems.length) {
      lines.push('需手动处理：');
      diagnosis.manualItems.forEach(function(item, idx) {
        lines.push((idx + 1) + '. ' + String(item));
      });
    }
    if (!lines.length) lines.push('已完成诊断，但没有返回可展示内容。');
    return lines.join('\n');
  }

  function pushFailureHistory(entry) {
    var item = entry && typeof entry === 'object' ? entry : null;
    if (!item) return;
    failureHistory.push(item);
    if (failureHistory.length > failureHistoryLimit) {
      failureHistory = failureHistory.slice(-failureHistoryLimit);
    }
  }

  function onModelTestFailed(event) {
    var detail = event && event.detail ? event.detail : null;
    if (!detail || typeof detail !== 'object') return;
    if (detail.errorMessage && String(detail.errorMessage).indexOf('未选择模型') !== -1) return;
    pushFailureHistory(detail);
    if (!isAssistantEnabled()) {
      setStatus('检测到模型测试失败。开启助手后可自动诊断。');
      return;
    }
    setPanelVisible(true);
    addMessage('sys', '检测到模型测试失败，正在自动诊断...');
    runAutoDiagnosis(detail);
  }

  async function runAutoDiagnosis(detail) {
    var apis = getApis();
    if (!apis.assistantModelDiagApi || typeof apis.assistantModelDiagApi.diagnoseFailure !== 'function') {
      addMessage('ai', '诊断能力暂不可用，请稍后重试。');
      return;
    }
    setStatus('正在诊断模型报错...');
    var diagRes = null;
    try {
      diagRes = await apis.assistantModelDiagApi.diagnoseFailure(detail, {});
    } catch (err) {
      diagRes = { ok: false, reason: err && err.message ? String(err.message) : '诊断执行异常' };
    }
    var diagnosis = diagRes && diagRes.diagnosis ? diagRes.diagnosis : null;
    if (!diagnosis) {
      addMessage('ai', '诊断失败：' + (diagRes && diagRes.reason ? diagRes.reason : '未知错误'));
      setStatus('诊断失败');
      return;
    }
    var modelId = detail.modelId ? String(detail.modelId) : '';
    var patch = diagnosis.patch && typeof diagnosis.patch === 'object' ? diagnosis.patch : {};
    var patchKeys = Object.keys(patch);

    var actions = [];
    if (patchKeys.length && apis.assistantModelDiagApi && typeof apis.assistantModelDiagApi.applyModelPatch === 'function' && modelId) {
      actions.push({
        label: '应用建议配置',
        onClick: function() {
          var patchText = formatJsonCompact(patch);
          var first = window.confirm('确认应用以下配置建议？\n' + patchText);
          if (!first) return;
          var second = window.confirm('确认后将写入模型配置（不包含 API Key）。是否继续？');
          if (!second) return;
          applyDiagnosisPatch(modelId, patch);
        },
      });
    }
    if (modelId && apis.assistantModelDiagApi && typeof apis.assistantModelDiagApi.retestModel === 'function') {
      actions.push({
        label: '立即重测',
        onClick: function() {
          retestModelFromAssistant(modelId);
        },
      });
    }

    addMessage('ai', formatDiagnosisText(diagnosis), { actions: actions });
    setStatus('诊断完成');
  }

  async function applyDiagnosisPatch(modelId, patch) {
    var apis = getApis();
    if (!apis.assistantModelDiagApi || typeof apis.assistantModelDiagApi.applyModelPatch !== 'function') {
      addMessage('ai', '模型代填能力暂不可用。');
      return;
    }
    setStatus('正在应用建议配置...');
    var res = null;
    try {
      res = await apis.assistantModelDiagApi.applyModelPatch(modelId, patch, { source: 'assistant' });
    } catch (err) {
      res = { ok: false, reason: err && err.message ? String(err.message) : '模型配置写入异常' };
    }
    if (!res || res.ok !== true) {
      addMessage('ai', '配置应用失败：' + (res && res.reason ? res.reason : '未知错误'));
      setStatus('应用失败');
      return;
    }
    addMessage('ai', '建议配置已应用成功。你可以点击“立即重测”验证。');
    refreshState();
    dispatchAppEvent('app-assistant-state-changed', { source: 'assistant-patch-applied' });
    setStatus('配置已应用');
  }

  async function retestModelFromAssistant(modelId) {
    var apis = getApis();
    if (!apis.assistantModelDiagApi || typeof apis.assistantModelDiagApi.retestModel !== 'function') {
      addMessage('ai', '重测能力暂不可用。');
      return;
    }
    setStatus('正在重测模型...');
    var result = null;
    try {
      result = await apis.assistantModelDiagApi.retestModel(modelId, 'assistant-retest');
    } catch (err) {
      result = { ok: false, errorMessage: err && err.message ? String(err.message) : '重测执行异常' };
    }
    if (result && result.ok) {
      addMessage('ai', '重测成功：模型可用。');
      setStatus('重测成功');
      return;
    }
    addMessage('ai', '重测失败：' + (result && result.errorMessage ? result.errorMessage : '未知错误'));
    setStatus('重测失败');
  }

  async function handleUserInput(text) {
    var content = String(text || '').trim();
    if (!content) return;

    if (containsAny(content, ['关闭助手', '禁用助手'])) {
      addMessage('ai', '安全策略限制：助手不能通过聊天关闭自己。请到设置页手动关闭。');
      return;
    }

    var modelDriven = await tryHandleModelDrivenReply(content);
    if (modelDriven && modelDriven.handled && modelDriven.text) {
      addMessage('ai', modelDriven.text);
      return;
    }

    var caseListReply = await tryHandleCaseListIntent(content);
    if (caseListReply) {
      addMessage('ai', caseListReply);
      return;
    }

    var currentPageReply = tryHandleCurrentPageIntent(content);
    if (currentPageReply) {
      addMessage('ai', currentPageReply);
      return;
    }

    var navReply = tryHandleNavigationIntent(content);
    if (navReply) {
      addMessage('ai', navReply);
      return;
    }

    var queryReply = tryHandleQueryIntent(content);
    if (queryReply) {
      addMessage('ai', queryReply);
      return;
    }

    var memoReply = tryHandleMemoIntent(content);
    if (memoReply) {
      addMessage('ai', memoReply);
      return;
    }

    var settingReply = tryHandleSettingsIntent(content);
    if (settingReply) {
      addMessage('ai', settingReply);
      return;
    }

    var caseReply = tryHandleCaseIntent(content);
    if (caseReply && typeof caseReply.then === 'function') {
      var asyncText = await caseReply;
      addMessage('ai', asyncText);
      return;
    }
    if (caseReply) {
      addMessage('ai', caseReply);
      return;
    }

    if (shouldRunIntentClassifier(content)) {
      var classified = await classifyIntentByModel(content);
      if (classified && typeof classified === 'object') {
        if (classified.intent === 'query_case_list') {
          var caseListReplyByModel = await tryHandleCaseListIntent(content, { force: true });
          if (caseListReplyByModel) {
            addMessage('ai', caseListReplyByModel);
            return;
          }
        }
        if (classified.intent === 'navigate') {
          var targetTabRaw = classified.tab ? String(classified.tab) : '';
          var targetTab = targetTabRaw && isKnownTabId(targetTabRaw) ? targetTabRaw : parseTabFromText(content);
          if (targetTab) {
            var apis0 = getApis();
            if (apis0.assistantApi && typeof apis0.assistantApi.switchTab === 'function') {
              apis0.assistantApi.switchTab(targetTab);
              addMessage('ai', '已按意图跳转到：' + targetTab);
              return;
            }
          }
        }
        if (classified.intent === 'query') {
          if (isCaseListIntent(content)) {
            var caseListReplyByQuery = await tryHandleCaseListIntent(content, { force: true });
            if (caseListReplyByQuery) {
              addMessage('ai', caseListReplyByQuery);
              return;
            }
          }
          var queryTabRaw = classified.tab ? String(classified.tab) : '';
          var queryTab = queryTabRaw && isKnownTabId(queryTabRaw) ? queryTabRaw : parseTabFromText(content);
          if (!queryTab && !isProjectScopedText(content)) {
            // 非项目上下文问题走通用问答，不返回页面数据包。
          } else {
          var apis1 = getApis();
          if (apis1.assistantApi && typeof apis1.assistantApi.getPageData === 'function') {
            var data = apis1.assistantApi.getPageData(queryTab || '');
            addMessage('ai', '按你的意图返回页面数据：\n' + formatJsonCompact(data));
            return;
          }
          }
        }
      }
    }

    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.callModel !== 'function') {
      addMessage('ai', '助手主对话能力暂不可用，请稍后重试。');
      return;
    }

    var prompt = [
      '你是测试助手平台内置AI助手。',
      '优先提供可执行建议，回答简洁。',
      '当涉及删除、配置变更等写操作，提醒需要确认后执行。',
      '若用户询问页面数据，可提示他让你直接“获取某页面数据”。',
      '若用户询问“当前有哪些用例/用例列表”，优先直接返回列表结果，不要要求用户改写问题。',
      '请结合最近对话上下文回答，用户使用“就这个/按刚才那个/就今天的”等省略表达时要承接前文语义。',
      '对于项目外问题（如天气、常识、日常咨询）也要正常回答，不要误返回页面数据。',
      '如果问题依赖实时信息（如天气）且缺少地点，可先询问城市后再回答。'
    ].join('\n');
    var conversationHistory = buildConversationHistory(conversationHistoryLimit, content);

    setStatus('助手思考中...');
    var res = await apis.assistantApi.callModel(content, {
      prompt: prompt,
      temperature: 0.2,
      history: conversationHistory,
    });
    if (!res || res.ok !== true) {
      addMessage('ai', '回复失败：' + (res && res.reason ? res.reason : '未知错误'));
      setStatus('回复失败');
      return;
    }
    addMessage('ai', String(res.content || ''));
    setStatus('');
  }

  function handleSend() {
    if (!inputEl) return;
    if (!isAssistantEnabled()) {
      setStatus('助手未开启，请先到设置页开启。');
      openSettingsForAssistant();
      return;
    }
    var text = String(inputEl.value || '').trim();
    if (!text) return;
    inputEl.value = '';
    addMessage('user', text);
    handleUserInput(text);
  }

  function bindUiEvents() {
    if (launcherBtn) {
      launcherBtn.addEventListener('click', function() {
        showLauncherClick();
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        setPanelVisible(false);
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        handleClearChat();
      });
    }
    if (sendBtn) {
      sendBtn.addEventListener('click', handleSend);
    }
    if (inputEl) {
      inputEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    }
    if (modelPicker) {
      modelPicker.addEventListener('change', function() {
        var apis = getApis();
        if (!apis.assistantSettingsApi || typeof apis.assistantSettingsApi.applyPatch !== 'function') return;
        var modelId = modelPicker.value ? String(modelPicker.value) : '';
        var res = apis.assistantSettingsApi.applyPatch({ assistantModelId: modelId }, { source: 'assistant-ui', allowSelfDisable: true });
        if (!res || res.ok !== true) {
          setStatus(res && res.reason ? res.reason : '模型切换失败');
          refreshModelPicker();
          return;
        }
        var selectedText = '';
        if (modelPicker.options && modelPicker.selectedIndex >= 0) {
          selectedText = modelPicker.options[modelPicker.selectedIndex].text || '';
        }
        setStatus('助手模型已切换' + (selectedText ? '：' + selectedText : ''));
      });
    }
  }

  function bindRuntimeEvents() {
    try {
      window.addEventListener('app-assistant-api-ready', function() {
        refreshState();
      });
      window.addEventListener('app-assistant-state-changed', function() {
        refreshState();
      });
      window.addEventListener('app-models-updated', function() {
        refreshModelPicker();
      });
      window.addEventListener('app-settings-loaded', function() {
        refreshState();
      });
      window.addEventListener('app-auth-ready', function() {
        loadHistory();
      });
      window.addEventListener('app-model-test-failed', onModelTestFailed);
    } catch (err) {
      // ignore
    }
  }

  function setupDom() {
    ensureAssistantMount();
    launcher = byId('assistantLauncher');
    launcherBtn = byId('assistantLauncherBtn');
    lockDot = byId('assistantLockDot');
    panel = byId('assistantPanel');
    closeBtn = byId('assistantCloseBtn');
    clearBtn = byId('assistantClearBtn');
    modelPicker = byId('assistantModelPicker');
    statusEl = byId('assistantStatus');
    messagesEl = byId('assistantMessages');
    inputEl = byId('assistantInput');
    sendBtn = byId('assistantSendBtn');

    return Boolean(launcher && launcherBtn && panel && messagesEl && inputEl && sendBtn);
  }

  function init() {
    if (initialized) return;
    if (!setupDom()) return;
    initialized = true;
    bindUiEvents();
    bindRuntimeEvents();
    loadHistory();
    refreshState();
    if (!chatHistory.length) {
      addMessage('ai', '你好，我可以帮你做页面跳转、数据查询、备忘处理、用例生成触发、漏测推荐触发，以及模型报错自动诊断。');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
