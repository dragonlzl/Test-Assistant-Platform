(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecCaseLibrarySyncOwner = api;
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
    var sessionStore = opts.sessionStorage || (browser && browser.sessionStorage ? browser.sessionStorage : null);
    var getTempExecFile = port('getTempExecFile', function() { return null; });
    var openTempExecCaseLibraryDiffDrawer = port('openTempExecCaseLibraryDiffDrawer', function() { return false; });
    var syncTempExecCaseLibraryChangesButton = port('syncTempExecCaseLibraryChangesButton');
    var renderTempExecCaseLibraryDiffCaseTabs = port('renderTempExecCaseLibraryDiffCaseTabs');
    var tempExecPendingRestoreDiffExecSetId = '';
    var tempExecPendingRestoreDiffStorageKey = 'tap-tempexec-pending-restore-diff';
    var tempExecCaseLibraryAutoPopupSeen = {};
    var tempExecCaseLibraryAutoPopupSeenLoaded = false;
    var tempExecCaseLibraryAutoPopupSeenStorageKey = 'tap-tempexec-case-lib-auto-popup-seen';
    var tempExecCaseLibrarySyncLastSeqConsumed = 0;

    function ensureTempExecCaseLibraryDiffState() {
      if (!state.tempExecCaseLibraryDiffByExecSetId || typeof state.tempExecCaseLibraryDiffByExecSetId !== 'object') {
        state.tempExecCaseLibraryDiffByExecSetId = {};
      }
      if (!state.tempExecCaseLibraryDiffFilterByExecSetId || typeof state.tempExecCaseLibraryDiffFilterByExecSetId !== 'object') {
        state.tempExecCaseLibraryDiffFilterByExecSetId = {};
      }
      return {
        byExecSetId: state.tempExecCaseLibraryDiffByExecSetId,
        filterByExecSetId: state.tempExecCaseLibraryDiffFilterByExecSetId,
      };
    }

    function ensureTempExecCaseLibraryAutoPopupState() {
      if (!state.tempExecCaseLibraryAutoPopupByKey || typeof state.tempExecCaseLibraryAutoPopupByKey !== 'object') {
        state.tempExecCaseLibraryAutoPopupByKey = {};
      }
      if (!Array.isArray(state.tempExecCaseLibraryAutoPopupOrder)) {
        state.tempExecCaseLibraryAutoPopupOrder = [];
      }
      return {
        byKey: state.tempExecCaseLibraryAutoPopupByKey,
        order: state.tempExecCaseLibraryAutoPopupOrder,
      };
    }

    function getTempExecCaseLibraryAutoPopupKey(execSetId, meta) {
      var key = '';
      if (meta && meta.caseFileId !== null && meta.caseFileId !== undefined) key = String(meta.caseFileId);
      if (!key && execSetId) key = 'execset:' + String(execSetId);
      return key;
    }

    function normalizeExecSetIdList(raw) {
      var list = Array.isArray(raw) ? raw.slice() : (raw ? [raw] : []);
      var result = [];
      list.forEach(function(id) {
        var key = String(id || '').trim();
        if (!key || result.indexOf(key) !== -1) return;
        result.push(key);
      });
      return result;
    }

    function loadTempExecCaseLibraryAutoPopupSeen() {
      if (tempExecCaseLibraryAutoPopupSeenLoaded) return;
      tempExecCaseLibraryAutoPopupSeenLoaded = true;
      if (!sessionStore || typeof sessionStore.getItem !== 'function') return;
      try {
        var raw = sessionStore.getItem(tempExecCaseLibraryAutoPopupSeenStorageKey) || '';
        var parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object') tempExecCaseLibraryAutoPopupSeen = parsed;
      } catch (err) {
        tempExecCaseLibraryAutoPopupSeen = {};
      }
    }

    function saveTempExecCaseLibraryAutoPopupSeen() {
      if (!sessionStore || typeof sessionStore.setItem !== 'function') return;
      try {
        sessionStore.setItem(tempExecCaseLibraryAutoPopupSeenStorageKey, JSON.stringify(tempExecCaseLibraryAutoPopupSeen));
      } catch (err) {
        // ignore unavailable session storage
      }
    }

    function resolveTempExecCaseLibraryMeta(execSetId, meta) {
      if (meta) return meta;
      if (!execSetId) return null;
      var store = ensureTempExecCaseLibraryDiffState();
      return store.byExecSetId ? store.byExecSetId[String(execSetId)] : null;
    }

    function resolveTempExecCaseLibraryDiffStamp(meta) {
      if (!meta) return '';
      if (meta.lastDiffAt) return String(meta.lastDiffAt);
      if (meta.history && meta.history.length && meta.history[0] && meta.history[0].diffAt) {
        return String(meta.history[0].diffAt);
      }
      if (meta.caseFileUpdatedAt) return String(meta.caseFileUpdatedAt);
      return '';
    }

    function markTempExecCaseLibraryAutoPopupSeen(execSetId, meta) {
      if (!execSetId) return;
      loadTempExecCaseLibraryAutoPopupSeen();
      var resolvedMeta = resolveTempExecCaseLibraryMeta(execSetId, meta);
      var stamp = resolveTempExecCaseLibraryDiffStamp(resolvedMeta) || String(Date.now());
      tempExecCaseLibraryAutoPopupSeen[String(execSetId)] = stamp;
      saveTempExecCaseLibraryAutoPopupSeen();
    }

    function hasTempExecCaseLibraryAutoPopupSeen(execSetId, meta) {
      if (!execSetId) return false;
      loadTempExecCaseLibraryAutoPopupSeen();
      var stored = tempExecCaseLibraryAutoPopupSeen[String(execSetId)] || '';
      if (!stored) return false;
      var resolvedMeta = resolveTempExecCaseLibraryMeta(execSetId, meta);
      var stamp = resolveTempExecCaseLibraryDiffStamp(resolvedMeta);
      return !stamp || stored === stamp;
    }

    function queueTempExecCaseLibraryAutoPopup(execSetId, meta) {
      if (!execSetId || !meta || !meta.shouldAutoPopup) return;
      if (hasTempExecCaseLibraryAutoPopupSeen(execSetId, meta)) return;
      var key = getTempExecCaseLibraryAutoPopupKey(execSetId, meta);
      if (!key) return;
      var store = ensureTempExecCaseLibraryAutoPopupState();
      store.byKey[key] = String(execSetId);
      if (store.order.indexOf(key) === -1) store.order.push(key);
    }

    function clearTempExecCaseLibraryAutoPopup(execSetId, meta) {
      var store = ensureTempExecCaseLibraryAutoPopupState();
      var resolved = getTempExecCaseLibraryAutoPopupKey(execSetId, meta);
      if (!resolved && execSetId) {
        var id = String(execSetId);
        for (var i = 0; i < store.order.length; i += 1) {
          var key = store.order[i];
          if (store.byKey[key] === id) {
            resolved = key;
            break;
          }
        }
      }
      if (!resolved) return;
      if (Object.prototype.hasOwnProperty.call(store.byKey, resolved)) delete store.byKey[resolved];
      var index = store.order.indexOf(resolved);
      if (index !== -1) store.order.splice(index, 1);
    }

    function pruneTempExecCaseLibraryAutoPopupQueue(keepIds) {
      var keepList = normalizeExecSetIdList(keepIds);
      if (!keepList.length) {
        state.tempExecCaseLibraryAutoPopupByKey = {};
        state.tempExecCaseLibraryAutoPopupOrder = [];
        return;
      }
      var keepMap = {};
      keepList.forEach(function(id) { keepMap[id] = true; });
      var store = ensureTempExecCaseLibraryAutoPopupState();
      var next = [];
      store.order.forEach(function(key) {
        var execSetId = store.byKey[key] ? String(store.byKey[key]) : '';
        if (!execSetId || !keepMap[execSetId]) {
          if (Object.prototype.hasOwnProperty.call(store.byKey, key)) delete store.byKey[key];
          return;
        }
        next.push(key);
      });
      state.tempExecCaseLibraryAutoPopupOrder = next;
    }

    function pickTempExecCaseLibraryAutoPopupExecSetId(activeId) {
      var store = ensureTempExecCaseLibraryAutoPopupState();
      var ids = store.order.map(function(key) { return store.byKey[key]; }).filter(Boolean);
      var active = activeId ? String(activeId) : '';
      if (active && ids.indexOf(active) !== -1) return active;
      return ids.length ? String(ids[0]) : '';
    }

    function readTempExecPendingRestoreDiffExecSetId() {
      if (tempExecPendingRestoreDiffExecSetId) return tempExecPendingRestoreDiffExecSetId;
      if (!sessionStore || typeof sessionStore.getItem !== 'function') return '';
      try {
        var raw = sessionStore.getItem(tempExecPendingRestoreDiffStorageKey) || '';
        if (raw) tempExecPendingRestoreDiffExecSetId = String(raw || '').trim();
      } catch (err) {
        // ignore unavailable session storage
      }
      return tempExecPendingRestoreDiffExecSetId;
    }

    function clearTempExecPendingRestoreDiffExecSetId() {
      tempExecPendingRestoreDiffExecSetId = '';
      if (!sessionStore || typeof sessionStore.removeItem !== 'function') return;
      try {
        sessionStore.removeItem(tempExecPendingRestoreDiffStorageKey);
      } catch (err) {
        // ignore unavailable session storage
      }
    }

    function isTempExecTabActive(strict) {
      var isStrict = strict === true;
      var isTempExecTab = String(state && state.activeTab ? state.activeTab : '') === 'tempexec';
      if (!isTempExecTab && !isStrict && sessionStore && typeof sessionStore.getItem === 'function') {
        try {
          var config = browser.app && browser.app.config ? browser.app.config : {};
          var key = config && config.activeTabKey ? config.activeTabKey : 'usecase-active-tab';
          var saved = key ? String(sessionStore.getItem(key) || '') : '';
          var reloadSource = String(sessionStore.getItem('tap-reload-source-tab') || '');
          isTempExecTab = saved === 'tempexec' || reloadSource === 'tempexec';
        } catch (err) {
          isTempExecTab = false;
        }
      }
      return isTempExecTab;
    }

    function normalizeDbTimeInput(input) {
      if (!input) return '';
      if (typeof input === 'number') return input;
      var text = String(input || '').trim();
      if (!text) return '';
      if (text.indexOf('T') === -1 && text.indexOf(' ') !== -1) text = text.replace(' ', 'T');
      text = text.replace(/(\.\d{3})\d+/, '$1');
      text = text.replace(/([+-]\d{2}):(\d{2})$/, '$1$2');
      var hasTz = /Z$/i.test(text) || /[+-]\d{2}\d{2}$/.test(text) || /[+-]\d{2}:\d{2}$/.test(text);
      var isIsoWithTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text);
      if (isIsoWithTime && !hasTz) text += 'Z';
      return text;
    }

    function parseDbTimeMs(value) {
      if (!value) return 0;
      if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0;
      var normalized = normalizeDbTimeInput(value);
      var timestamp = 0;
      try { timestamp = Date.parse(normalized || value); } catch (err) { timestamp = 0; }
      return isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
    }

    function normalizeCaseLibrarySyncMeta(raw) {
      var response = raw && typeof raw === 'object' ? raw : {};
      var summary = response.summary && typeof response.summary === 'object' ? response.summary : {};
      var history = (Array.isArray(response.history) ? response.history : [])
        .map(function(item) {
          var entry = item && typeof item === 'object' ? item : {};
          var sum = entry.summary && typeof entry.summary === 'object' ? entry.summary : {};
          var diffAt = entry.diff_at || entry.diffAt || entry.last_diff_at || entry.lastDiffAt || '';
          return {
            diffAt: diffAt ? String(diffAt) : '',
            operator: entry.operator || entry.operator_name || entry.operatorName || '',
            summary: {
              appended: Number(sum.appended) || 0,
              added: Number(sum.added) || 0,
              updated: Number(sum.updated) || 0,
              deleted: Number(sum.deleted) || 0,
            },
            diff: Array.isArray(entry.diff) ? entry.diff : [],
          };
        })
        .filter(function(item) { return item && item.diffAt; });
      history.sort(function(a, b) { return parseDbTimeMs(b.diffAt) - parseDbTimeMs(a.diffAt); });
      return {
        execSetId: response.exec_set_id || response.execSetId || null,
        caseFileId: response.case_file_id || response.caseFileId || null,
        caseFileUpdatedAt: response.case_file_updated_at || response.caseFileUpdatedAt || null,
        baseUpdatedAt: response.base_updated_at || response.baseUpdatedAt || null,
        lastDiffAt: response.last_diff_at || response.lastDiffAt || null,
        lastShownAt: response.last_shown_at || response.lastShownAt || null,
        everChanged: Boolean(response.ever_changed || response.everChanged),
        hasNewDiff: Boolean(response.has_new_diff || response.hasNewDiff),
        shouldAutoPopup: Boolean(response.should_auto_popup || response.shouldAutoPopup),
        summary: {
          appended: Number(summary.appended) || 0,
          added: Number(summary.added) || 0,
          updated: Number(summary.updated) || 0,
          deleted: Number(summary.deleted) || 0,
        },
        diff: Array.isArray(response.diff) ? response.diff : [],
        history: history,
      };
    }

    function hasCaseLibraryChangeSignal(meta) {
      if (!meta) return false;
      if (meta.everChanged === true) return true;
      if (Array.isArray(meta.diff) && meta.diff.length) return true;
      if (Array.isArray(meta.history) && meta.history.length) return true;
      var summary = meta.summary || {};
      if (Number(summary.appended) || Number(summary.added) || Number(summary.updated) || Number(summary.deleted)) return true;
      if (meta.lastDiffAt) return true;
      var baseTimestamp = parseDbTimeMs(meta.baseUpdatedAt);
      var fileTimestamp = parseDbTimeMs(meta.caseFileUpdatedAt);
      return Boolean(baseTimestamp && fileTimestamp && fileTimestamp > baseTimestamp);
    }

    function mergeCaseLibrarySyncMeta(previous, next) {
      if (!previous) return next;
      if (!next) return previous;
      if (hasCaseLibraryChangeSignal(next)) return next;
      var merged = {};
      Object.keys(next).forEach(function(key) { merged[key] = next[key]; });
      if (previous.everChanged) merged.everChanged = true;
      if ((!merged.diff || !merged.diff.length) && previous.diff && previous.diff.length) merged.diff = previous.diff;
      if ((!merged.history || !merged.history.length) && previous.history && previous.history.length) merged.history = previous.history;
      if (!merged.lastDiffAt && previous.lastDiffAt) merged.lastDiffAt = previous.lastDiffAt;
      if (!merged.lastShownAt && previous.lastShownAt) merged.lastShownAt = previous.lastShownAt;
      if (!hasCaseLibraryChangeSignal({ summary: merged.summary }) && previous.summary) merged.summary = previous.summary;
      if (!merged.caseFileId && previous.caseFileId) merged.caseFileId = previous.caseFileId;
      return merged;
    }

    function hasUnackedCaseLibraryDiff(meta) {
      if (!meta || !meta.lastDiffAt) return false;
      if (!meta.lastShownAt) return true;
      var diffTimestamp = parseDbTimeMs(meta.lastDiffAt);
      var shownTimestamp = parseDbTimeMs(meta.lastShownAt);
      return Boolean(diffTimestamp && (!shownTimestamp || diffTimestamp > shownTimestamp));
    }

    function applyTempExecCaseLibrarySyncMeta(file, syncResponse) {
      var meta = normalizeCaseLibrarySyncMeta(syncResponse);
      var execSetId = meta.execSetId || (file && file.execSetId ? file.execSetId : null);
      if (!execSetId) return null;
      meta.execSetId = meta.execSetId || execSetId;
      if (!meta.caseFileId && file && (file.caseFileId || file.caseFileId === 0)) meta.caseFileId = file.caseFileId;
      var store = ensureTempExecCaseLibraryDiffState();
      meta = mergeCaseLibrarySyncMeta(store.byExecSetId[String(execSetId)] || null, meta);
      store.byExecSetId[String(execSetId)] = meta;
      var latestFile = file || getTempExecFile(String(execSetId));
      if (latestFile) latestFile.caseLibraryMeta = meta;
      if (meta.shouldAutoPopup) queueTempExecCaseLibraryAutoPopup(execSetId, meta);
      else clearTempExecCaseLibraryAutoPopup(execSetId, meta);
      if (String(state.tempExecActiveId || '') === String(execSetId)) {
        syncTempExecCaseLibraryChangesButton(getTempExecFile(state.tempExecActiveId));
      }
      tryAutoOpenTempExecRestoreDiff(execSetId, meta);
      return meta;
    }

    function maybeOpenTempExecCaseLibraryAutoPopup(allowAutoPopup, activeId) {
      if (!allowAutoPopup) return false;
      var execSetId = pickTempExecCaseLibraryAutoPopupExecSetId(activeId);
      if (!execSetId) return false;
      var meta = ensureTempExecCaseLibraryDiffState().byExecSetId[String(execSetId)] || null;
      if (hasTempExecCaseLibraryAutoPopupSeen(execSetId, meta)) {
        clearTempExecCaseLibraryAutoPopup(execSetId, meta);
        return false;
      }
      var opened = openTempExecCaseLibraryDiffDrawer({ auto: true, execSetId: execSetId });
      if (opened) {
        clearTempExecCaseLibraryAutoPopup(execSetId, meta);
        markTempExecCaseLibraryAutoPopupSeen(execSetId, meta);
      }
      return opened;
    }

    function tryAutoOpenTempExecRestoreDiff(execSetId, meta) {
      var pendingId = readTempExecPendingRestoreDiffExecSetId();
      if (!pendingId) return false;
      var targetId = execSetId ? String(execSetId) : '';
      if (targetId && targetId !== String(pendingId)) return false;
      if (!isTempExecTabActive(true)) return false;
      var targetMeta = meta || ensureTempExecCaseLibraryDiffState().byExecSetId[String(pendingId)] || null;
      if (!targetMeta) return false;
      if (!hasUnackedCaseLibraryDiff(targetMeta) || !hasCaseLibraryChangeSignal(targetMeta)) {
        clearTempExecPendingRestoreDiffExecSetId();
        return false;
      }
      var opened = openTempExecCaseLibraryDiffDrawer({ auto: true, execSetId: String(pendingId) });
      if (opened) {
        clearTempExecPendingRestoreDiffExecSetId();
        clearTempExecCaseLibraryAutoPopup(pendingId, targetMeta);
        markTempExecCaseLibraryAutoPopupSeen(pendingId, targetMeta);
      }
      return opened;
    }

    function clearTempExecCaseLibraryDiffMeta(execSetIds, options2) {
      var ids = normalizeExecSetIdList(execSetIds);
      if (!ids.length) return false;
      var render = options2 && options2.render;
      var store = ensureTempExecCaseLibraryDiffState();
      var changed = false;
      ids.forEach(function(id) {
        if (Object.prototype.hasOwnProperty.call(store.byExecSetId, id)) {
          delete store.byExecSetId[id];
          changed = true;
        }
        if (Object.prototype.hasOwnProperty.call(store.filterByExecSetId, id)) {
          delete store.filterByExecSetId[id];
          changed = true;
        }
        var file = getTempExecFile(id);
        if (file && file.caseLibraryMeta) file.caseLibraryMeta = null;
        if (String(state.tempExecCaseLibraryDiffSelectedExecSetId || '') === id) state.tempExecCaseLibraryDiffSelectedExecSetId = '';
        if (String(state.tempExecCaseLibraryDiffLastRenderedExecSetId || '') === id) state.tempExecCaseLibraryDiffLastRenderedExecSetId = '';
        clearTempExecCaseLibraryAutoPopup(id);
        if (file && String(file.id || '') === String(state.tempExecActiveId || '')) syncTempExecCaseLibraryChangesButton(file);
      });
      if (changed && render) {
        var selected = getTempExecCaseLibraryDiffSelectedExecSetId();
        if (selected) renderTempExecCaseLibraryDiffCaseTabs(selected);
      }
      return changed;
    }

    function pruneTempExecCaseLibraryDiffStore(keepIds) {
      var keepList = normalizeExecSetIdList(keepIds);
      var keepMap = {};
      keepList.forEach(function(id) { keepMap[id] = true; });
      var store = ensureTempExecCaseLibraryDiffState();
      Object.keys(store.byExecSetId).forEach(function(id) { if (!keepMap[id]) delete store.byExecSetId[id]; });
      Object.keys(store.filterByExecSetId).forEach(function(id) { if (!keepMap[id]) delete store.filterByExecSetId[id]; });
      var selected = getTempExecCaseLibraryDiffSelectedExecSetId();
      if (selected && !keepMap[selected]) state.tempExecCaseLibraryDiffSelectedExecSetId = '';
      var lastRendered = String(state.tempExecCaseLibraryDiffLastRenderedExecSetId || '');
      if (lastRendered && !keepMap[lastRendered]) state.tempExecCaseLibraryDiffLastRenderedExecSetId = '';
      pruneTempExecCaseLibraryAutoPopupQueue(keepList);
    }

    function queueTempExecCaseLibraryDiffReset(execSetIds) {
      var ids = normalizeExecSetIdList(execSetIds);
      if (!ids.length) return;
      if (!Array.isArray(state.tempExecCaseLibraryDiffResetIds)) state.tempExecCaseLibraryDiffResetIds = [];
      ids.forEach(function(id) {
        if (state.tempExecCaseLibraryDiffResetIds.indexOf(id) === -1) state.tempExecCaseLibraryDiffResetIds.push(id);
      });
    }

    function applyTempExecCaseLibraryDiffReset() {
      var ids = normalizeExecSetIdList(state.tempExecCaseLibraryDiffResetIds || []);
      if (!ids.length) return;
      clearTempExecCaseLibraryDiffMeta(ids);
      state.tempExecCaseLibraryDiffResetIds = [];
    }

    function readTempExecCaseLibrarySyncSeq() {
      var raw = Number(browser && browser.app ? browser.app.__tempexecCaseLibrarySyncSeq || 0 : 0);
      return isFinite(raw) && raw >= 0 ? raw : 0;
    }

    function consumeTempExecCaseLibrarySyncTrigger() {
      var sequence = readTempExecCaseLibrarySyncSeq();
      if (!sequence || sequence <= tempExecCaseLibrarySyncLastSeqConsumed) return false;
      tempExecCaseLibrarySyncLastSeqConsumed = sequence;
      return true;
    }

    function getTempExecFileNameByExecSetId(execSetId) {
      var file = execSetId ? getTempExecFile(String(execSetId)) : null;
      return file && file.name ? String(file.name) : '执行集#' + String(execSetId || '');
    }

    function listTempExecCaseLibraryDiffExecSetIds() {
      var store = ensureTempExecCaseLibraryDiffState();
      var list = Object.keys(store.byExecSetId).map(function(id) {
        var meta = store.byExecSetId[id];
        if (!meta || !hasCaseLibraryChangeSignal(meta)) return null;
        var timestamp = meta.history && meta.history[0] ? parseDbTimeMs(meta.history[0].diffAt) : parseDbTimeMs(meta.lastDiffAt);
        return {
          execSetId: String(id),
          name: getTempExecFileNameByExecSetId(id),
          unacked: hasUnackedCaseLibraryDiff(meta),
          hasNew: Boolean(meta.hasNewDiff),
          shouldAuto: Boolean(meta.shouldAutoPopup),
          lastTs: timestamp || 0,
        };
      }).filter(Boolean);
      list.sort(function(a, b) {
        if (a.unacked !== b.unacked) return a.unacked ? -1 : 1;
        if (a.shouldAuto !== b.shouldAuto) return a.shouldAuto ? -1 : 1;
        if (a.hasNew !== b.hasNew) return a.hasNew ? -1 : 1;
        if (a.lastTs !== b.lastTs) return b.lastTs - a.lastTs;
        return a.name.localeCompare(b.name, 'zh-Hans-CN');
      });
      return list.map(function(item) { return item.execSetId; });
    }

    function setTempExecCaseLibraryDiffSelectedExecSetId(execSetId) {
      state.tempExecCaseLibraryDiffSelectedExecSetId = execSetId ? String(execSetId) : '';
    }

    function getTempExecCaseLibraryDiffSelectedExecSetId() {
      return state.tempExecCaseLibraryDiffSelectedExecSetId ? String(state.tempExecCaseLibraryDiffSelectedExecSetId) : '';
    }

    function updateTempExecFileCaseLibraryMeta(file, meta) {
      if (!file) return;
      file.caseLibraryMeta = meta || null;
      var execSetId = file.execSetId || (meta && meta.execSetId) || null;
      if (execSetId) ensureTempExecCaseLibraryDiffState().byExecSetId[String(execSetId)] = meta || null;
    }

    return {
      ensureTempExecCaseLibraryDiffState: ensureTempExecCaseLibraryDiffState,
      ensureTempExecCaseLibraryAutoPopupState: ensureTempExecCaseLibraryAutoPopupState,
      queueTempExecCaseLibraryAutoPopup: queueTempExecCaseLibraryAutoPopup,
      clearTempExecCaseLibraryAutoPopup: clearTempExecCaseLibraryAutoPopup,
      pruneTempExecCaseLibraryAutoPopupQueue: pruneTempExecCaseLibraryAutoPopupQueue,
      pickTempExecCaseLibraryAutoPopupExecSetId: pickTempExecCaseLibraryAutoPopupExecSetId,
      markTempExecCaseLibraryAutoPopupSeen: markTempExecCaseLibraryAutoPopupSeen,
      hasTempExecCaseLibraryAutoPopupSeen: hasTempExecCaseLibraryAutoPopupSeen,
      maybeOpenTempExecCaseLibraryAutoPopup: maybeOpenTempExecCaseLibraryAutoPopup,
      tryAutoOpenTempExecRestoreDiff: tryAutoOpenTempExecRestoreDiff,
      isTempExecTabActive: isTempExecTabActive,
      normalizeExecSetIdList: normalizeExecSetIdList,
      clearTempExecCaseLibraryDiffMeta: clearTempExecCaseLibraryDiffMeta,
      pruneTempExecCaseLibraryDiffStore: pruneTempExecCaseLibraryDiffStore,
      queueTempExecCaseLibraryDiffReset: queueTempExecCaseLibraryDiffReset,
      applyTempExecCaseLibraryDiffReset: applyTempExecCaseLibraryDiffReset,
      normalizeDbTimeInput: normalizeDbTimeInput,
      parseDbTimeMs: parseDbTimeMs,
      normalizeCaseLibrarySyncMeta: normalizeCaseLibrarySyncMeta,
      hasCaseLibraryChangeSignal: hasCaseLibraryChangeSignal,
      mergeCaseLibrarySyncMeta: mergeCaseLibrarySyncMeta,
      applyTempExecCaseLibrarySyncMeta: applyTempExecCaseLibrarySyncMeta,
      readTempExecCaseLibrarySyncSeq: readTempExecCaseLibrarySyncSeq,
      consumeTempExecCaseLibrarySyncTrigger: consumeTempExecCaseLibrarySyncTrigger,
      getTempExecFileNameByExecSetId: getTempExecFileNameByExecSetId,
      listTempExecCaseLibraryDiffExecSetIds: listTempExecCaseLibraryDiffExecSetIds,
      setTempExecCaseLibraryDiffSelectedExecSetId: setTempExecCaseLibraryDiffSelectedExecSetId,
      getTempExecCaseLibraryDiffSelectedExecSetId: getTempExecCaseLibraryDiffSelectedExecSetId,
      updateTempExecFileCaseLibraryMeta: updateTempExecFileCaseLibraryMeta,
      hasUnackedCaseLibraryDiff: hasUnackedCaseLibraryDiff,
    };
  }

  return { create: create };
});
