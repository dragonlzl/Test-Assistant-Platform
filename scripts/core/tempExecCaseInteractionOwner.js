(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecCaseInteractionOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function(root) {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var state = opts.state || {};
    var browser = opts.window || root || {};
    var documentRef = opts.document || (root && root.document ? root.document : null);
    var tempExecStatus = opts.tempExecStatus || null;
    var tempExecToolbar = opts.tempExecToolbar || null;
    var generateDefectLinkId = port('generateDefectLinkId', function() { return 'defect-' + Date.now(); });
    var getTempExecFile = port('getTempExecFile', function() { return null; });
    var isDbMode = port('isDbMode', function() { return false; });
    var queueExecCasePatchForItem = port('queueExecCasePatchForItem');
    var persistTempExecState = port('persistTempExecState');
    var renderTempExecView = port('renderTempExecView');
    var openConfirmDrawer = port('openConfirmDrawer', function() { return Promise.resolve({ ok: true }); });
    var setStatus = port('setStatus');
    function ensureTempExecSelection(fileId) {
      if (!state.tempExecSelections || typeof state.tempExecSelections !== 'object') {
        state.tempExecSelections = {};
      }
      if (!fileId) return new Set();
      if (!state.tempExecSelections[fileId]) {
        state.tempExecSelections[fileId] = new Set();
      }
      return state.tempExecSelections[fileId];
    }

    function resetTempExecSelections(fileId) {
      if (!state.tempExecSelections || typeof state.tempExecSelections !== 'object') {
        state.tempExecSelections = {};
      }
      if (!fileId) {
        state.tempExecSelections = {};
        return;
      }
      state.tempExecSelections[fileId] = new Set();
    }

    function ensureTempExecRemarkOpen(fileId) {
      if (!state.tempExecRemarkOpen || typeof state.tempExecRemarkOpen !== 'object') {
        state.tempExecRemarkOpen = {};
      }
      if (!fileId) return new Set();
      if (!state.tempExecRemarkOpen[fileId]) {
        state.tempExecRemarkOpen[fileId] = new Set();
      }
      return state.tempExecRemarkOpen[fileId];
    }

    function resetTempExecRemarkOpen(fileId) {
      if (!state.tempExecRemarkOpen || typeof state.tempExecRemarkOpen !== 'object') {
        state.tempExecRemarkOpen = {};
      }
      if (!fileId) {
        state.tempExecRemarkOpen = {};
        return;
      }
      state.tempExecRemarkOpen[fileId] = new Set();
    }

    function ensureTempExecReuseOpen(fileId) {
      if (!state.tempExecReuseOpen || typeof state.tempExecReuseOpen !== 'object') {
        state.tempExecReuseOpen = {};
      }
      if (!fileId) return new Set();
      if (!state.tempExecReuseOpen[fileId]) {
        state.tempExecReuseOpen[fileId] = new Set();
      }
      return state.tempExecReuseOpen[fileId];
    }

    function resetTempExecReuseOpen(fileId) {
      if (!state.tempExecReuseOpen || typeof state.tempExecReuseOpen !== 'object') {
        state.tempExecReuseOpen = {};
      }
      if (!fileId) {
        state.tempExecReuseOpen = {};
        return;
      }
      state.tempExecReuseOpen[fileId] = new Set();
    }

    function ensureTempExecDefectOpen(fileId) {
      if (!state.tempExecDefectOpen || typeof state.tempExecDefectOpen !== 'object') {
        state.tempExecDefectOpen = {};
      }
      if (!fileId) return new Set();
      if (!state.tempExecDefectOpen[fileId]) {
        state.tempExecDefectOpen[fileId] = new Set();
      }
      return state.tempExecDefectOpen[fileId];
    }

    function resetTempExecDefectOpen(fileId) {
      if (!state.tempExecDefectOpen || typeof state.tempExecDefectOpen !== 'object') {
        state.tempExecDefectOpen = {};
      }
      if (!fileId) {
        state.tempExecDefectOpen = {};
        return;
      }
      state.tempExecDefectOpen[fileId] = new Set();
    }

    function clearTempExecCaseStates(fileId) {
      if (!fileId) return;
      ensureTempExecSelection(fileId).clear();
      ensureTempExecRemarkOpen(fileId).clear();
      ensureTempExecReuseOpen(fileId).clear();
      ensureTempExecDefectOpen(fileId).clear();
    }

    function ensureDefectLinks(caseItem) {
      if (!caseItem) return [];
      if (!Array.isArray(caseItem.defectLinks)) caseItem.defectLinks = [];
      return caseItem.defectLinks;
    }

    function addTempExecDefectLink(fileId, index) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var caseItem = file.cases[index];
      var links = ensureDefectLinks(caseItem);
      links.push({ id: generateDefectLinkId(), url: '' });
      var openSet = ensureTempExecDefectOpen(fileId);
      openSet.add(index);
      if (isDbMode()) {
        queueExecCasePatchForItem(caseItem, { defect_links: caseItem.defectLinks });
      }
      persistTempExecState();
      renderTempExecView();
    }

    function removeTempExecDefectLink(fileId, index, linkId) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var caseItem = file.cases[index];
      if (!Array.isArray(caseItem.defectLinks)) return;
      openConfirmDrawer({
        title: '删除缺陷链接',
        message: '确定删除该缺陷链接吗？',
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
      }).then(function(result) {
        if (!result || result.ok !== true) return;
        var nextFile = getTempExecFile(fileId);
        if (!nextFile || !nextFile.cases[index]) return;
        var nextCase = nextFile.cases[index];
        if (!Array.isArray(nextCase.defectLinks)) return;
        nextCase.defectLinks = nextCase.defectLinks.filter(function(link) { return link && link.id !== linkId; });
        if (isDbMode()) {
          queueExecCasePatchForItem(nextCase, { defect_links: nextCase.defectLinks });
        }
        persistTempExecState();
        renderTempExecView();
      });
    }

    function updateTempExecDefectLink(fileId, index, linkId, value) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var caseItem = file.cases[index];
      if (!Array.isArray(caseItem.defectLinks)) caseItem.defectLinks = [];
      var entry = caseItem.defectLinks.find(function(link) { return link && link.id === linkId; });
      if (!entry) return;
      entry.url = value || '';
      if (isDbMode()) {
        queueExecCasePatchForItem(caseItem, { defect_links: caseItem.defectLinks });
      }
      persistTempExecState();
    }

    function normalizeDefectOpenUrl(url) {
      var text = (url || '').trim();
      if (!text) return '';
      var lower = text.toLowerCase();
      if (lower.indexOf('http://') === 0 || lower.indexOf('https://') === 0) return text;
      if (/^[a-z][a-z0-9+.-]*:/.test(text)) return text;
      return 'https://' + text;
    }

    function openTempExecDefectLink(fileId, index, linkId) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var caseItem = file.cases[index];
      if (!Array.isArray(caseItem.defectLinks)) return;
      var entry = caseItem.defectLinks.find(function(link) { return link && link.id === linkId; });
      var targetUrl = normalizeDefectOpenUrl(entry && entry.url);
      if (!targetUrl) {
        if (tempExecStatus) setStatus(tempExecStatus, '请先填写有效的缺陷链接', 'warn');
        return;
      }
      browser.open(targetUrl, '_blank');
    }

    function toggleTempExecDefectPanel(fileId, indexes) {
      if (!fileId) return;
      var openSet = ensureTempExecDefectOpen(fileId);
      var list = Array.isArray(indexes) ? indexes : [indexes];
      var valid = list.map(function(idx) { return Number(idx); }).filter(function(idx) { return Number.isInteger(idx); });
      if (!valid.length) return;
      var shouldOpen = !valid.every(function(idx) { return openSet.has(idx); });
      valid.forEach(function(idx) {
        if (shouldOpen) openSet.add(idx);
        else openSet.delete(idx);
      });
      renderTempExecView();
    }

    function snapshotTempExecSearchFocus() {
      if (!documentRef) return null;
      var active = documentRef.activeElement;
      if (!active || !active.dataset || active.dataset.tempSearchInput === undefined) return null;
      var info = { fileId: active.dataset.tempSearchInput || '', selectionStart: null, selectionEnd: null };
      try {
        if (typeof active.selectionStart === 'number') info.selectionStart = active.selectionStart;
        if (typeof active.selectionEnd === 'number') info.selectionEnd = active.selectionEnd;
      } catch (err) {
        // ignore
      }
      return info;
    }

    function restoreTempExecSearchFocus(info) {
      if (!info || !tempExecToolbar || !tempExecToolbar.querySelector) return;
      var input = tempExecToolbar.querySelector('input[data-temp-search-input]');
      if (!input || !input.dataset) return;
      if (String(input.dataset.tempSearchInput || '') !== String(info.fileId || '')) return;
      if (typeof input.focus === 'function') {
        try {
          input.focus({ preventScroll: true });
        } catch (err) {
          input.focus();
        }
      }
      if (typeof input.setSelectionRange === 'function' && info.selectionStart !== null && info.selectionEnd !== null) {
        var len = input.value ? input.value.length : 0;
        var start = Math.max(0, Math.min(len, info.selectionStart));
        var end = Math.max(0, Math.min(len, info.selectionEnd));
        try { input.setSelectionRange(start, end); } catch (err) { /* ignore */ }
      }
    }

    function applyTempExecSearch(fileId, term, raw) {
      var focusSnapshot = snapshotTempExecSearchFocus();
      var normalized = (term || '').trim().toLowerCase();
      state.tempExecSearch = { fileId: fileId || '', term: normalized, raw: raw || '' };
      renderTempExecView();
      restoreTempExecSearchFocus(focusSnapshot);
      if (tempExecStatus) {
        if (normalized) {
          setStatus(tempExecStatus, '已应用搜索筛选', 'ok');
        } else {
          setStatus(tempExecStatus, '已清除搜索', 'ok');
        }
      }
    }

    return {
      ensureTempExecSelection: ensureTempExecSelection,
      resetTempExecSelections: resetTempExecSelections,
      ensureTempExecRemarkOpen: ensureTempExecRemarkOpen,
      resetTempExecRemarkOpen: resetTempExecRemarkOpen,
      ensureTempExecReuseOpen: ensureTempExecReuseOpen,
      resetTempExecReuseOpen: resetTempExecReuseOpen,
      ensureTempExecDefectOpen: ensureTempExecDefectOpen,
      resetTempExecDefectOpen: resetTempExecDefectOpen,
      clearTempExecCaseStates: clearTempExecCaseStates,
      ensureDefectLinks: ensureDefectLinks,
      addTempExecDefectLink: addTempExecDefectLink,
      removeTempExecDefectLink: removeTempExecDefectLink,
      updateTempExecDefectLink: updateTempExecDefectLink,
      normalizeDefectOpenUrl: normalizeDefectOpenUrl,
      openTempExecDefectLink: openTempExecDefectLink,
      toggleTempExecDefectPanel: toggleTempExecDefectPanel,
      snapshotTempExecSearchFocus: snapshotTempExecSearchFocus,
      restoreTempExecSearchFocus: restoreTempExecSearchFocus,
      applyTempExecSearch: applyTempExecSearch,
    };
  }

  return { create: create };
});

