(function() {
  function setStatus(el, text, type) {
    if (!el) return;
    el.textContent = text || '';
    el.className = ['status', type || ''].filter(Boolean).join(' ');
  }
  function debounce(fn, wait) {
    var t;
    var delay = Number(wait);
    if (!Number.isFinite(delay) || delay < 0) delay = 200;
    function debounced() {
      if (t) clearTimeout(t);
      var args = arguments;
      var ctx = this;
      t = setTimeout(function run() { fn.apply(ctx, args); }, delay);
    }
    debounced.cancel = function() {
      if (t) clearTimeout(t);
      t = null;
    };
    return debounced;
  }
  function downloadBlob(filename, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function downloadText(filename, text) {
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(filename, blob);
  }
  function stripCodeFence(text) {
    if (!text) return '';
    var trimmed = String(text).trim();
    if (trimmed.indexOf('#NODE:') === 0) {
      var newline = trimmed.indexOf('\n');
      trimmed = newline !== -1 ? trimmed.slice(newline + 1).trim() : '';
    }
    var fenceMatch = trimmed.match(/^([`'"’“]{3})([\w-]*)?\s*\n?([\s\S]*?)\1\s*$/i);
    if (fenceMatch && fenceMatch[3]) {
      return (fenceMatch[3] || '').trim();
    }
    var inlineFence = trimmed.match(/^([`'"’“]{3})([\w-]*)?([\s\S]*?)([`'"’“]{3})\s*$/i);
    if (inlineFence && inlineFence[3]) {
      return (inlineFence[3] || '').trim();
    }
    if (/^([`'"’“]{3})/.test(trimmed)) {
      var parts = trimmed.split('\n');
      if (parts.length > 1) {
        var last = parts[parts.length - 1].trim();
        var body = parts.slice(1, last.match(/^([`'"’“]{3})$/) ? -1 : undefined).join('\n');
        return body.trim();
      }
    }
    return trimmed;
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
  function escapeHtmlPreserve(text) {
    var html = escapeHtml(text);
    return html.replace(/\n/g, '<br/>');
  }

  function tryFormatJson(text) {
    if (!text) return '';
    try {
      var parsed = JSON.parse(text);
      return JSON.stringify(parsed, null, 2);
    } catch (err) {
      return '';
    }
  }

  function extractJsonPayload(rawText) {
    var text = rawText || '';
    var stripped = stripCodeFence(text);
    var attempt = tryFormatJson(stripped);
    if (attempt) return attempt;
    var fenceMatch = text.match(/```(?:json)?([\s\S]*?)```/i);
    if (fenceMatch) {
      attempt = tryFormatJson((fenceMatch[1] || '').trim());
      if (attempt) return attempt;
    }
    var braceStart = stripped.indexOf('{');
    var braceEnd = stripped.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      attempt = tryFormatJson(stripped.slice(braceStart, braceEnd + 1));
      if (attempt) return attempt;
    }
    var bracketStart = stripped.indexOf('[');
    var bracketEnd = stripped.lastIndexOf(']');
    if (bracketStart !== -1 && bracketEnd > bracketStart) {
      attempt = tryFormatJson(stripped.slice(bracketStart, bracketEnd + 1));
      if (attempt) return attempt;
    }
    return '';
  }

  function extractJsonObjects(text) {
    var objs = [];
    var depth = 0;
    var start = -1;
    var inString = false;
    var prevChar = '';
    for (var i = 0; i < text.length; i += 1) {
      var ch = text[i];
      if (ch === '"' && prevChar !== '\\') {
        inString = !inString;
      }
      if (inString) {
        prevChar = ch;
        continue;
      }
      if (ch === '{') {
        if (depth === 0) start = i;
        depth += 1;
      } else if (ch === '}') {
        depth = Math.max(0, depth - 1);
        if (depth === 0 && start >= 0) {
          var raw = text.slice(start, i + 1);
          try {
            objs.push(JSON.parse(raw));
          } catch (err) {
            // ignore invalid chunk
          }
          start = -1;
        }
      }
      prevChar = ch;
    }
    return objs;
  }

  function sanitizeCasesForExport(list) {
    return (list || []).map(function(item) {
      if (!item || typeof item !== 'object') return item;
      var clone = {};
      Object.keys(item).forEach(function(key) {
        if (key === 'remark') return;
        clone[key] = item[key];
      });
      return clone;
    });
  }

  async function runConcurrent(items, concurrency, handler) {
    if (!Array.isArray(items) || !items.length) return [];
    var limit = Math.max(1, Number(concurrency) || 1);
    var results = new Array(items.length);
    var index = 0;
    async function worker() {
      while (index < items.length) {
        var currentIndex = index;
        index += 1;
        results[currentIndex] = await handler(items[currentIndex], currentIndex);
      }
    }
    var workers = Array.from({ length: Math.min(limit, items.length) }, function() { return worker(); });
    await Promise.all(workers);
    return results;
  }

  function generateTempExecId() {
    return 'tempexec-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
  }

  function generateTempVersionId() {
    return 'tempver-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
  }

  function normalizeTempExecName(name) {
    return (name || '').trim().toLowerCase();
  }

  function stringifyCaseField(value) {
    if (Array.isArray(value)) {
      return value
        .map(function(item) {
          var base = item === undefined || item === null ? '' : item;
          return base.toString().trim();
        })
        .filter(Boolean)
        .join(' / ');
    }
    if (value && typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (err) {
        return '';
      }
    }
    if (value === undefined || value === null) return '';
    return value.toString().trim();
  }

  function buildCaseSearchText(items, fields) {
    var list = Array.isArray(items) ? items : [];
    if (!list.length) return '';
    var keys = Array.isArray(fields) ? fields.filter(Boolean) : [];
    var parts = [];
    list.forEach(function(item) {
      if (!item || typeof item !== 'object') return;
      if (keys.length) {
        keys.forEach(function(key) {
          if (!key) return;
          var val = stringifyCaseField(item[key]);
          if (val) parts.push(val);
        });
        return;
      }
      Object.keys(item).forEach(function(key) {
        var val = stringifyCaseField(item[key]);
        if (val) parts.push(val);
      });
    });
    return parts.join(' ').toLowerCase();
  }

  var missingReminderStopWords = [
    '的', '了', '和', '与', '及', '以及', '或', '并', '等', '在', '对', '为', '通过', '进行', '可以', '需要',
    '是否', '允许', '禁止', '不能', '不可', '会', '不会', '作为', '当', '若', '如果', '则', '其', '该', '本',
    '此', '这个', '这些', '那些', '当前', '相关', '具体', '可能', '一般', '其中', '此外', '同时', '包括', '包含',
    '等于'
  ];
  var missingReminderSuffixes = [
    '角色', '用户', '账号', '权限', '身份', '登录', '注册', '认证', '鉴权', '会话', 'token', '验证码', '短信',
    '邮箱', '密码', '配置', '开关', '参数', '字段', '接口', '协议', '回调', '请求', '响应', '数据', '状态',
    '状态码', '流程', '步骤', '结果', '规则', '逻辑', '校验', '限制', '异常', '错误', '失败', '成功', '告警',
    '提示', '弹窗', '文案', '消息', '通知', '日志', '报表', '统计', '看板', '列表', '详情', '页面', '入口',
    '按钮', '表单', '输入', '选择', '下拉', '搜索', '筛选', '排序', '分页', '上传', '下载', '导入', '导出',
    '编辑', '保存', '提交', '发布', '撤回', '删除', '新增', '修改', '更新', '复制', '粘贴', '合并', '拆分',
    '绑定', '解绑', '关联', '同步', '权限组', '版本', '项目', '模块', '功能', '效果', '样式', '布局', '展示',
    '渲染', '兼容', '性能', '安全', '稳定', '体验', '交互'
  ];
  var missingReminderShortTokens = [
    'ui', 'api', 'db', 'id', 'ip', 'url', 'http', 'https', 'sql', 'ios', 'android', 'pc', 'h5', 'sdk'
  ];
  var missingReminderShortTokenMap = {};
  missingReminderShortTokens.forEach(function(token) {
    if (!token) return;
    missingReminderShortTokenMap[String(token).toLowerCase()] = true;
  });
  var missingReminderSuffixesSorted = missingReminderSuffixes.slice().sort(function(a, b) {
    return b.length - a.length;
  });

  function normalizeMissingReminderMatchConfig(value, fallback) {
    var base = fallback && typeof fallback === 'object' ? fallback : { type: true, module: true };
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

  function normalizeMissingReminderKeywordText(text) {
    var raw = String(text || '').toLowerCase();
    if (!raw) return '';
    missingReminderStopWords.forEach(function(word) {
      if (!word) return;
      raw = raw.split(word).join(' ');
    });
    raw = raw
      .replace(/[\t\r\n\f\v\u3000]+/g, ' ')
      .replace(/[，。,;；:：!?！？、/\\()\[\]{}<>"'`~|+=\-_*#@%^&]+/g, ' ')
      .replace(/\s+/g, ' ');
    return raw.trim();
  }

  function shouldKeepMissingReminderToken(token) {
    if (!token) return false;
    if (missingReminderShortTokenMap[token]) return true;
    return token.length >= 2;
  }

  function splitMissingReminderToken(token) {
    if (!token) return null;
    for (var i = 0; i < missingReminderSuffixesSorted.length; i += 1) {
      var suffix = missingReminderSuffixesSorted[i];
      if (!suffix) continue;
      if (token.length <= suffix.length) continue;
      if (token.slice(token.length - suffix.length) === suffix) {
        var prefix = token.slice(0, token.length - suffix.length);
        return [prefix, suffix];
      }
    }
    return null;
  }

  function buildMissingReminderKeywords(text) {
    var cleaned = normalizeMissingReminderKeywordText(text);
    if (!cleaned) return [];
    var tokens = cleaned.split(' ');
    var results = [];
    var seen = {};
    var pushToken = function(token) {
      if (!token) return;
      if (!shouldKeepMissingReminderToken(token)) return;
      if (seen[token]) return;
      seen[token] = true;
      results.push(token);
    };
    tokens.forEach(function(token) {
      var next = String(token || '').trim();
      if (!next) return;
      pushToken(next);
      var parts = splitMissingReminderToken(next);
      if (!parts || !parts.length) return;
      parts.forEach(function(part) {
        pushToken(String(part || '').trim());
      });
    });
    return results;
  }

  function removePendingTempExecByName(pendingList, name, normalizeName) {
    if (!Array.isArray(pendingList) || !pendingList.length) return;
    var normalize = typeof normalizeName === 'function' ? normalizeName : normalizeTempExecName;
    var target = normalize(name);
    for (var i = pendingList.length - 1; i >= 0; i -= 1) {
      var item = pendingList[i];
      if (normalize(item && item.name) === target) {
        pendingList.splice(i, 1);
      }
    }
  }

  function ensureTempExecReplacement(entry, options) {
    options = options || {};
    var existingList = Array.isArray(options.existingList) ? options.existingList : [];
    var pendingList = Array.isArray(options.pendingList) ? options.pendingList : [];
    var normalizeName = typeof options.normalizeName === 'function' ? options.normalizeName : normalizeTempExecName;
    var removeExisting = typeof options.removeExisting === 'function' ? options.removeExisting : function() {};
    var confirmFn = typeof options.confirmFn === 'function' ? options.confirmFn : function() { return true; };
    var removePending = typeof options.removePending === 'function'
      ? function(list, name) { options.removePending(list, name, normalizeName); }
      : function(list, name) { removePendingTempExecByName(list, name, normalizeName); };
    if (!entry || !entry.name) return true;
    var normalized = normalizeName(entry.name);
    var duplicates = existingList.filter(function(file) { return normalizeName(file && file.name) === normalized; });
    var pendingDuplicates = pendingList.filter(function(item) { return normalizeName(item && item.name) === normalized; });
    if (!duplicates.length && !pendingDuplicates.length) return true;
    var confirmed = confirmFn('检测到名称为【' + entry.name + '】的用例已存在，替换将清除原有执行结果，是否继续？');
    if (!confirmed) return false;
    duplicates.forEach(function(file) { removeExisting(file && file.id); });
    removePending(pendingList, entry.name);
    return true;
  }

  function formatJsonOrText(text) {
    if (!text) return '';
    var trimmed = text.trim();
    if (/^[\[{]/.test(trimmed)) {
      var formatted = tryFormatJson(trimmed);
      if (formatted) return formatted;
      return trimmed;
    }
    return trimmed;
  }
  function formatCompactTimestamp(date) {
    var d = date instanceof Date ? date : new Date();
    function pad(num) {
      return num < 10 ? '0' + num : String(num);
    }
    return (
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      '_' +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      pad(d.getSeconds())
    );
  }
  function scrollElementIntoView(el, behavior, offset) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    var top = el.getBoundingClientRect().top + window.scrollY;
    var targetTop = top - (Number(offset) || 0);
    window.scrollTo({ top: targetTop, behavior: behavior || 'smooth' });
  }

  function updateMissingReminderScrollHint(scrollEl) {
    if (!scrollEl) return;
    var clientHeight = Number(scrollEl.clientHeight) || 0;
    var scrollHeight = Number(scrollEl.scrollHeight) || 0;
    var maxScroll = scrollHeight - clientHeight;
    var canScroll = maxScroll > 1;
    if (scrollEl.dataset) {
      if (canScroll) scrollEl.dataset.missingScrollable = '1';
      else delete scrollEl.dataset.missingScrollable;
    } else if (canScroll) {
      scrollEl.setAttribute('data-missing-scrollable', '1');
    } else {
      scrollEl.removeAttribute('data-missing-scrollable');
    }
    if (!canScroll || !clientHeight) {
      if (scrollEl.style) {
        scrollEl.style.removeProperty('--missing-reminder-scroll-thumb-height');
        scrollEl.style.removeProperty('--missing-reminder-scroll-thumb-top');
      }
      return;
    }
    var padding = 6;
    var minThumb = 24;
    var track = Math.max(clientHeight - padding * 2, 0);
    var thumb = track ? Math.max(Math.round(track * clientHeight / scrollHeight), minThumb) : 0;
    if (thumb > track) thumb = track;
    var ratio = maxScroll > 0 ? (scrollEl.scrollTop / maxScroll) : 0;
    var top = padding + Math.round((track - thumb) * ratio);
    if (scrollEl.style) {
      scrollEl.style.setProperty('--missing-reminder-scroll-thumb-height', thumb + 'px');
      scrollEl.style.setProperty('--missing-reminder-scroll-thumb-top', top + 'px');
    }
  }

  function bindMissingReminderScrollHint(root) {
    if (!root) return;
    var scrollEl = null;
    if (root.classList && root.classList.contains('missing-reminder-scroll')) {
      scrollEl = root;
    } else if (root.querySelector) {
      scrollEl = root.querySelector('.missing-reminder-scroll');
    }
    if (!scrollEl) return;
    if (scrollEl.dataset && scrollEl.dataset.missingReminderScrollBound === '1') {
      updateMissingReminderScrollHint(scrollEl);
      return;
    }
    if (scrollEl.dataset) scrollEl.dataset.missingReminderScrollBound = '1';
    scrollEl.addEventListener('scroll', function() {
      updateMissingReminderScrollHint(scrollEl);
    });
    scrollEl.addEventListener('mouseenter', function() {
      updateMissingReminderScrollHint(scrollEl);
    });
    updateMissingReminderScrollHint(scrollEl);
  }

  var centerToastEl = null;
  var centerToastTimer = 0;
  function showCenterToast(text, type, durationMs) {
    if (typeof document === 'undefined') return;
    if (!text) return;
    var duration = Number(durationMs);
    if (!Number.isFinite(duration) || duration <= 0) duration = 3000;
    if (centerToastTimer) {
      clearTimeout(centerToastTimer);
      centerToastTimer = 0;
    }
    if (centerToastEl && centerToastEl.parentNode) {
      try { centerToastEl.parentNode.removeChild(centerToastEl); } catch (_) {}
    }
    centerToastEl = document.createElement('div');
    centerToastEl.className = 'temp-center-toast' + (type ? (' ' + String(type)) : '');
    centerToastEl.textContent = String(text);
    document.body.appendChild(centerToastEl);
    centerToastTimer = setTimeout(function() {
      if (!centerToastEl) return;
      centerToastEl.classList.add('fade-out');
      setTimeout(function() {
        if (centerToastEl && centerToastEl.parentNode) {
          try { centerToastEl.parentNode.removeChild(centerToastEl); } catch (_) {}
        }
        centerToastEl = null;
      }, 240);
    }, duration);
  }

  var addVersionOptionValue = '__add_version__';
  function isAddVersionOption(value) {
    return String(value || '') === addVersionOptionValue;
  }
  function buildAddVersionOption(label) {
    var text = label ? String(label) : '＋ 新增版本';
    return '<option value="' + addVersionOptionValue + '">' + escapeHtml(text) + '</option>';
  }
  function openAddProjectVersionDrawer(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var projectId = opts.projectId || opts.project_id || '';
    if (projectId === null || projectId === undefined || projectId === '') {
      return Promise.resolve({ ok: false, reason: 'no_project' });
    }
    var projectName = opts.projectName || opts.project_name || ('项目#' + projectId);
    var apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
    if (!apiClient || typeof apiClient.listProjectVersions !== 'function' || typeof apiClient.createVersion !== 'function') {
      return Promise.resolve({ ok: false, reason: 'api_unavailable' });
    }

    function normalizeName(value) {
      return String(value || '').trim();
    }

    function buildMessage(name) {
      var label = name ? ('【' + name + '】') : '版本';
      return '确认在' + projectName + '下添加' + label + '吗？';
    }

    function createVersionByName(name) {
      return apiClient
        .createVersion(projectId, { name: name })
        .then(function(version) {
          showCenterToast('添加版本成功', 'ok', 3000);
          return { ok: true, version: version, name: name };
        })
        .catch(function(err) {
          var msg = err && err.message ? err.message : '新增版本失败';
          showCenterToast(msg, 'err', 3000);
          return { ok: false, reason: 'error', error: err, message: msg };
        });
    }

    return apiClient.listProjectVersions(projectId).then(function(list) {
      var versions = Array.isArray(list) ? list : [];
      var nameMap = {};
      versions.forEach(function(v) {
        var name = normalizeName(v && v.name ? v.name : '');
        if (!name) return;
        nameMap[name] = true;
      });

      var confirmDrawer = window.app && window.app.confirmDrawer ? window.app.confirmDrawer : null;
      if (!confirmDrawer || typeof confirmDrawer.open !== 'function') {
        var raw = typeof window !== 'undefined' && typeof window.prompt === 'function'
          ? window.prompt('请输入版本号')
          : '';
        var trimmed = normalizeName(raw);
        if (!trimmed) return { ok: false, reason: 'empty' };
        if (nameMap[trimmed]) {
          showCenterToast('版本已存在，无法添加', 'warn', 3000);
          return { ok: false, reason: 'duplicate' };
        }
        return createVersionByName(trimmed);
      }

      var inputHandler = null;
      var inputEl = null;
      var messageEl = null;
      var openPromise = confirmDrawer.open({
        title: '新增版本',
        message: buildMessage(''),
        confirmText: '确认新增',
        cancelText: '取消',
        previousDrawer: opts.previousDrawer || opts.prevDrawer || null,
        input: {
          label: '版本号',
          placeholder: '请输入版本号',
          required: true,
          requiredMessage: '请输入版本号',
          maxLength: 50,
          validate: function(value) {
            var name = normalizeName(value);
            if (!name) return '';
            if (nameMap[name]) return '版本已存在，请换一个';
            return '';
          },
        },
      });

      setTimeout(function() {
        inputEl = document.getElementById('appConfirmDrawerInput');
        messageEl = document.getElementById('appConfirmDrawerMessage');
        if (!inputEl || !messageEl) return;
        inputHandler = function() {
          var name = normalizeName(inputEl.value || '');
          messageEl.textContent = buildMessage(name);
        };
        inputEl.addEventListener('input', inputHandler);
        inputHandler();
      }, 0);

      return openPromise.then(function(res) {
        if (inputEl && inputHandler) inputEl.removeEventListener('input', inputHandler);
        if (!res || res.ok !== true) return { ok: false, reason: 'cancel' };
        var trimmed = normalizeName(res.value);
        if (!trimmed) return { ok: false, reason: 'empty' };
        if (nameMap[trimmed]) {
          showCenterToast('版本已存在，无法添加', 'warn', 3000);
          return { ok: false, reason: 'duplicate' };
        }
        return createVersionByName(trimmed);
      });
    });
  }

  function openConfirmDrawer(options) {
    var drawerApi = window.app && window.app.confirmDrawer ? window.app.confirmDrawer : null;
    if (drawerApi && typeof drawerApi.open === 'function') {
      return drawerApi.open(options || {});
    }
    var msg = options && options.message ? String(options.message) : '';
    var ok = true;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      ok = window.confirm(msg);
    }
    return Promise.resolve({ ok: ok });
  }

  function normalizeIdForSort(value) {
    if (value === null || value === undefined) return '';
    if (value === 0 || String(value) === '0') return '0';
    return String(value || '');
  }

  function buildOrderIndex(orderIds) {
    var index = {};
    (orderIds || []).forEach(function(id, i) {
      var key = normalizeIdForSort(id);
      if (!key) return;
      if (!Object.prototype.hasOwnProperty.call(index, key)) index[key] = i;
    });
    return index;
  }

  function sortProjectsByOrder(projects, orderIds) {
    var list = Array.isArray(projects) ? projects.slice() : [];
    if (!list.length) return [];
    var index = buildOrderIndex(orderIds);
    var fallbackRank = 1000000;
    var wrapped = list.map(function(p, i) {
      var pid = p && (p.id || p.id === 0) ? normalizeIdForSort(p.id) : '';
      var rank = Object.prototype.hasOwnProperty.call(index, pid) ? index[pid] : fallbackRank;
      return { item: p, rank: rank, idx: i };
    });
    wrapped.sort(function(a, b) {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.idx - b.idx;
    });
    return wrapped.map(function(w) { return w.item; });
  }

  function sortIdsByOrder(ids, orderIds) {
    var list = Array.isArray(ids) ? ids.slice() : [];
    if (!list.length) return [];
    var index = buildOrderIndex(orderIds);
    var fallbackRank = 1000000;
    var wrapped = list.map(function(id, i) {
      var key = normalizeIdForSort(id);
      var rank = Object.prototype.hasOwnProperty.call(index, key) ? index[key] : fallbackRank;
      if (key === 'unknown') rank = fallbackRank + 9999;
      return { id: id, rank: rank, idx: i };
    });
    wrapped.sort(function(a, b) {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.idx - b.idx;
    });
    return wrapped.map(function(w) { return w.id; });
  }

  function getUserProjectSortSettings(state) {
    var st = state || (window.app && window.app.state ? window.app.state : {});
    var settings = st && st.settings && typeof st.settings === 'object' ? st.settings : {};
    var order = Array.isArray(settings.projectOrder) ? settings.projectOrder.slice() : [];
    order = order.map(function(id) { return normalizeIdForSort(id); }).filter(Boolean);
    var def = settings.defaultProjectId === null || settings.defaultProjectId === undefined
      ? ''
      : normalizeIdForSort(settings.defaultProjectId);
    return { order: order, defaultProjectId: def };
  }

  function sortProjectsByUserSettings(projects, state) {
    var st = getUserProjectSortSettings(state);
    return sortProjectsByOrder(projects, st.order);
  }

  function sortProjectIdsByUserSettings(ids, state) {
    var st = getUserProjectSortSettings(state);
    return sortIdsByOrder(ids, st.order);
  }

  function resolveDefaultProjectIdByUserSettings(projects, state) {
    var st = getUserProjectSortSettings(state);
    var list = sortProjectsByOrder(projects, st.order);
    var def = st.defaultProjectId;
    if (def) {
      var exists = list.some(function(p) { return p && (p.id || p.id === 0) && normalizeIdForSort(p.id) === def; });
      if (exists) return def;
    }
    if (list.length && list[0] && (list[0].id || list[0].id === 0)) {
      return normalizeIdForSort(list[0].id);
    }
    return '';
  }
  window.app = window.app || {};
  window.app.utils = {
    setStatus: setStatus,
    debounce: debounce,
    downloadBlob: downloadBlob,
    downloadText: downloadText,
    stripCodeFence: stripCodeFence,
    extractJsonPayload: extractJsonPayload,
    extractJsonObjects: extractJsonObjects,
    sanitizeCasesForExport: sanitizeCasesForExport,
    runConcurrent: runConcurrent,
    generateTempExecId: generateTempExecId,
    generateTempVersionId: generateTempVersionId,
    normalizeTempExecName: normalizeTempExecName,
    stringifyCaseField: stringifyCaseField,
    buildCaseSearchText: buildCaseSearchText,
    normalizeMissingReminderMatchConfig: normalizeMissingReminderMatchConfig,
    buildMissingReminderKeywords: buildMissingReminderKeywords,
    removePendingTempExecByName: removePendingTempExecByName,
    ensureTempExecReplacement: ensureTempExecReplacement,
    formatJsonOrText: formatJsonOrText,
    escapeHtml: escapeHtml,
    escapeHtmlPreserve: escapeHtmlPreserve,
    formatCompactTimestamp: formatCompactTimestamp,
    scrollElementIntoView: scrollElementIntoView,
    bindMissingReminderScrollHint: bindMissingReminderScrollHint,
    showCenterToast: showCenterToast,
    isAddVersionOption: isAddVersionOption,
    buildAddVersionOption: buildAddVersionOption,
    openAddProjectVersionDrawer: openAddProjectVersionDrawer,
    openConfirmDrawer: openConfirmDrawer,
    getUserProjectSortSettings: getUserProjectSortSettings,
    sortProjectsByOrder: sortProjectsByOrder,
    sortIdsByOrder: sortIdsByOrder,
    sortProjectsByUserSettings: sortProjectsByUserSettings,
    sortProjectIdsByUserSettings: sortProjectIdsByUserSettings,
    resolveDefaultProjectIdByUserSettings: resolveDefaultProjectIdByUserSettings,
  };
})();
