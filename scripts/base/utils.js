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
  function downloadText(filename, text) {
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function stripCodeFence(text) {
    if (!text) return '';
    var trimmed = text.trim();
    var match = trimmed.match(/^```[\w-]*\n?([\s\S]*?)```$/i);
    return match ? match[1].trim() : trimmed;
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
    downloadText: downloadText,
    stripCodeFence: stripCodeFence,
    escapeHtml: escapeHtml,
    escapeHtmlPreserve: escapeHtmlPreserve,
    formatCompactTimestamp: formatCompactTimestamp,
    scrollElementIntoView: scrollElementIntoView,
  };
})();
