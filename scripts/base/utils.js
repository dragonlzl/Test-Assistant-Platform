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
    return function debounced() {
      if (t) clearTimeout(t);
      var args = arguments;
      var ctx = this;
      t = setTimeout(function run() { fn.apply(ctx, args); }, delay);
    };
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
    removePendingTempExecByName: removePendingTempExecByName,
    ensureTempExecReplacement: ensureTempExecReplacement,
    formatJsonOrText: formatJsonOrText,
    escapeHtml: escapeHtml,
    escapeHtmlPreserve: escapeHtmlPreserve,
    formatCompactTimestamp: formatCompactTimestamp,
    scrollElementIntoView: scrollElementIntoView,
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
