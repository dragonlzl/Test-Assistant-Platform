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
    removePendingTempExecByName: removePendingTempExecByName,
    ensureTempExecReplacement: ensureTempExecReplacement,
    formatJsonOrText: formatJsonOrText,
    escapeHtml: escapeHtml,
    escapeHtmlPreserve: escapeHtmlPreserve,
    formatCompactTimestamp: formatCompactTimestamp,
    scrollElementIntoView: scrollElementIntoView,
  };
})();
