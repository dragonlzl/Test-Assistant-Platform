(function() {
  function init(deps) {
    var setStatus = deps && deps.setStatus ? deps.setStatus : function() {};
    var normalizeRequirementName = deps && deps.normalizeRequirementName ? deps.normalizeRequirementName : function(text) { return text || ''; };
    var getRequirementLabel = deps && deps.getRequirementLabel ? deps.getRequirementLabel : function() { return ''; };
    var generateTempExecId = deps && deps.generateTempExecId
      ? deps.generateTempExecId
      : function() {
        return 'tempexec-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
      };
    var generateTempVersionId = deps && deps.generateTempVersionId
      ? deps.generateTempVersionId
      : function() {
        return 'tempver-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
      };
    var reuseDetailSeed = 0;
    var generateReusePresetId = deps && deps.generateReusePresetId ? deps.generateReusePresetId : function() { return 'reuse-' + Date.now(); };
    var generateReuseDetailId = deps && deps.generateReuseDetailId
      ? deps.generateReuseDetailId
      : function() {
        reuseDetailSeed += 1;
        return 'reuse-detail-' + Date.now().toString(16) + '-' + reuseDetailSeed.toString(16) + '-' + Math.random().toString(16).slice(2, 6);
      };
    var generateDefectLinkId = deps && deps.generateDefectLinkId ? deps.generateDefectLinkId : function() { return 'defect-' + Date.now(); };
    var normalizeTempExecName = deps && deps.normalizeTempExecName ? deps.normalizeTempExecName : function(name) {
      return (name || '').trim().toLowerCase();
    };
    var stringifyCaseField = deps && deps.stringifyCaseField ? deps.stringifyCaseField : function(val) { return (val || '').toString(); };
    var buildMissingReminderKeywords = deps && deps.buildMissingReminderKeywords
      ? deps.buildMissingReminderKeywords
      : function() { return []; };
    var normalizeMissingReminderMatchConfig = deps && deps.normalizeMissingReminderMatchConfig
      ? deps.normalizeMissingReminderMatchConfig
      : function(value, fallback) {
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
        };
    var callModelWithConfig = deps && deps.callModelWithConfig
      ? deps.callModelWithConfig
      : function() { return Promise.reject(new Error('模型客户端不可用')); };
    var getAssignedModel = deps && deps.getAssignedModel
      ? deps.getAssignedModel
      : function() { throw new Error('未配置模型'); };
    var defaultTempExecColumns = deps && deps.defaultTempExecColumns ? deps.defaultTempExecColumns : {};
    var defaultPlacement = deps && deps.defaultPlacement
      ? deps.defaultPlacement
      : {
        requirementOrder: [],
        fileOrder: {},
        versionOrder: [],
        projectOrder: [],
        versionOrderByProject: {},
        fileOrderByProjectVersion: {},
      };
    var state = deps && deps.state ? deps.state : {};
    var tempExecStorageKey = deps && deps.tempExecStorageKey ? deps.tempExecStorageKey : 'usecase-temp-exec-v1';
    var tempExecFocusStorageKey = deps && deps.tempExecFocusStorageKey ? deps.tempExecFocusStorageKey : 'tempexec-focus-v1';
    var tempExecPageSizeStorageKey = deps && deps.tempExecPageSizeStorageKey ? deps.tempExecPageSizeStorageKey : 'tempexec-page-size';
    var modelsStorageKey = deps && deps.modelsKey ? deps.modelsKey : 'cleaner-models-v1';
    var assignmentStorageKey = deps && deps.assignmentKey ? deps.assignmentKey : 'cleaner-assignment-v1';
    var navPrefersUnassigned = false;
    var defaultTempExecPageSize = deps && deps.defaultTempExecPageSize ? deps.defaultTempExecPageSize : 20;
    var caseViewBaseFontSize = deps && Number.isFinite(deps.caseViewBaseFontSize) ? deps.caseViewBaseFontSize : 13;
    var tempExecStatus = deps && deps.dom && deps.dom.tempExecStatus ? deps.dom.tempExecStatus : null;
    var tempVersionGrid = deps && deps.dom && deps.dom.tempVersionGrid ? deps.dom.tempVersionGrid : null;
    var tempExecNav = deps && deps.dom && deps.dom.tempExecNav ? deps.dom.tempExecNav : null;
    var tempFocusZone = deps && deps.dom && deps.dom.tempFocusZone ? deps.dom.tempFocusZone : null;
    var tempExecViewFocusZone = deps && deps.dom && deps.dom.tempExecViewFocusZone ? deps.dom.tempExecViewFocusZone : null;
    var tempExecOverview = deps && deps.dom && deps.dom.tempExecOverview ? deps.dom.tempExecOverview : null;
    var tempExecView = deps && deps.dom && deps.dom.tempExecView ? deps.dom.tempExecView : null;
    var tempExecToolbar = deps && deps.dom && deps.dom.tempExecToolbar ? deps.dom.tempExecToolbar : null;
    var tempExecToolbarCard = deps && deps.dom && deps.dom.tempExecToolbarCard ? deps.dom.tempExecToolbarCard : null;
    var tempReqToggleBtn = deps && deps.dom && deps.dom.toggleTempReq ? deps.dom.toggleTempReq : null;
    var tempVersionToggleBtn = deps && deps.dom && deps.dom.toggleTempVersion ? deps.dom.toggleTempVersion : null;
    var createTempVersionBtn = deps && deps.dom && deps.dom.createTempVersionBtn ? deps.dom.createTempVersionBtn : null;
    var tempExecViewSection = deps && deps.dom && deps.dom.tempExecViewSection ? deps.dom.tempExecViewSection : null;
    var tempExecMindContainer = deps && deps.dom && deps.dom.tempExecMindContainer ? deps.dom.tempExecMindContainer : null;
    var tempExecMindBtn = deps && deps.dom && deps.dom.tempExecMindBtn ? deps.dom.tempExecMindBtn : null;
    var exportTempExecBtn = deps && deps.dom && deps.dom.exportTempExecBtn ? deps.dom.exportTempExecBtn : null;
    var exportTempExecConfigBtn = deps && deps.dom && deps.dom.exportTempExecConfigBtn ? deps.dom.exportTempExecConfigBtn : null;
    var exportTempExecXmindBtn = deps && deps.dom && deps.dom.exportTempExecXmindBtn ? deps.dom.exportTempExecXmindBtn : null;
    var exportTempExecCasesXmindBtn = deps && deps.dom && deps.dom.exportTempExecCasesXmindBtn ? deps.dom.exportTempExecCasesXmindBtn : null;
    var tempExecCaseLibraryChangesBtn = null;
    var tempExecCaseLibraryDiffStatus = null;
    var tempExecCaseLibraryDiffBody = null;
    var tempExecCaseLibraryDiffAppendedPill = null;
    var tempExecCaseLibraryDiffAddedPill = null;
    var tempExecCaseLibraryDiffUpdatedPill = null;
    var tempExecCaseLibraryDiffDeletedPill = null;
    var tempExecCaseLibraryDiffCaseName = null;
    var tempExecCaseLibraryDiffCaseTabs = null;
    var tempExecCaseLibraryDiffSelectCaseBtn = null;
    var tempExecCaseLibraryDiffDrawer = null;
    try {
      if (typeof document !== 'undefined') {
        tempExecCaseLibraryChangesBtn = document.getElementById('tempExecCaseLibraryChangesBtn');
        tempExecCaseLibraryDiffStatus = document.getElementById('tempExecCaseLibraryDiffStatus');
        tempExecCaseLibraryDiffBody = document.getElementById('tempExecCaseLibraryDiffBody');
        tempExecCaseLibraryDiffAppendedPill = document.getElementById('tempExecCaseLibraryDiffAppendedPill');
        tempExecCaseLibraryDiffAddedPill = document.getElementById('tempExecCaseLibraryDiffAddedPill');
        tempExecCaseLibraryDiffUpdatedPill = document.getElementById('tempExecCaseLibraryDiffUpdatedPill');
        tempExecCaseLibraryDiffDeletedPill = document.getElementById('tempExecCaseLibraryDiffDeletedPill');
        tempExecCaseLibraryDiffCaseName = document.getElementById('tempExecCaseLibraryDiffCaseName');
        tempExecCaseLibraryDiffCaseTabs = document.getElementById('tempExecCaseLibraryDiffCaseTabs');
        tempExecCaseLibraryDiffSelectCaseBtn = document.getElementById('tempExecCaseLibraryDiffSelectCaseBtn');
      }
    } catch (err) {
      // ignore
    }
    var escapeHtml = deps && deps.escapeHtml ? deps.escapeHtml : function(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    var escapeHtmlPreserve = deps && deps.escapeHtmlPreserve ? deps.escapeHtmlPreserve : function(text) {
      return escapeHtml(text).replace(/\n/g, '<br>');
    };
    var saveTempExecFocus = deps && deps.saveTempExecFocus ? deps.saveTempExecFocus : function() {};
    var ensureTempExecColumns = deps && deps.ensureTempExecColumns ? deps.ensureTempExecColumns : function() { return defaultTempExecColumns; };
    var persistSettings = deps && deps.persistSettings ? deps.persistSettings : function() {};
    var setRequirementLabel = deps && deps.setRequirementLabel ? deps.setRequirementLabel : function() {};
    var formatCompactTimestamp = deps && deps.formatCompactTimestamp
      ? deps.formatCompactTimestamp
      : function() {
        var pad = function(num) {
          return num < 10 ? '0' + num : String(num);
        };
        var now = new Date();
        return now.getFullYear().toString()
          + pad(now.getMonth() + 1)
          + pad(now.getDate())
          + '_' + pad(now.getHours())
          + pad(now.getMinutes())
          + pad(now.getSeconds());
      };
    function emToPx(value) {
      var num = Number(value);
      if (!Number.isFinite(num)) return 0;
      var px = num * caseViewBaseFontSize;
      return Math.round(px * 100) / 100;
    }
    var downloadText = deps && deps.downloadText ? deps.downloadText : function() {};
    var downloadBlob = deps && deps.downloadBlob ? deps.downloadBlob : function() {};
    var scrollElementIntoView = deps && deps.scrollElementIntoView ? deps.scrollElementIntoView : function() {};
    var openConfirmDrawer = deps && deps.openConfirmDrawer
      ? deps.openConfirmDrawer
      : function(options) {
        var msg = options && options.message ? String(options.message) : '';
        var ok = true;
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          ok = window.confirm(msg);
        }
        return Promise.resolve({ ok: ok });
      };
    var tempExecResultOptions = deps && deps.tempExecResultOptions ? deps.tempExecResultOptions : ['未执行', '通过', '失败', '阻塞', '不适用'];
    var deriveCaseListFromText = deps && deps.deriveCaseListFromText ? deps.deriveCaseListFromText : function() { return []; };
    var parseXmindFile = deps && deps.parseXmindFile ? deps.parseXmindFile : function() { return Promise.resolve({ text: '', list: [] }); };
    var parseXlsxFileToRows = deps && deps.parseXlsxFileToRows ? deps.parseXlsxFileToRows : null;
    var extractRequirementLabelFromText = deps && deps.extractRequirementLabelFromText ? deps.extractRequirementLabelFromText : function() { return ''; };
    var promptTempExecRequirement = deps && deps.promptTempExecRequirement
      ? deps.promptTempExecRequirement
      : function(fileName, fallbackLabel) {
        var base = normalizeRequirementName(fallbackLabel || '')
          || normalizeRequirementName(getRequirementLabel())
          || normalizeRequirementName((fileName || '').replace(/\.[^.]+$/, ''));
        var input = window.prompt('请输入需求标识', base);
        return input ? normalizeRequirementName(input) : '';
    };
    var ensureRequirementLabel = deps && deps.ensureRequirementLabel ? deps.ensureRequirementLabel : function() {
      return normalizeRequirementName(getRequirementLabel());
    };
    var buildTempExecXmindPackage = deps && deps.buildTempExecXmindPackage ? deps.buildTempExecXmindPackage : null;
    var buildXmindPackageFromCases = deps && deps.buildXmindPackageFromCases ? deps.buildXmindPackageFromCases : null;
    var stripTimestampSuffix = deps && deps.stripTimestampSuffix ? deps.stripTimestampSuffix : function(text) { return text || ''; };
    var getSafeFileBaseName = deps && deps.getSafeFileBaseName
      ? deps.getSafeFileBaseName
      : function(name, fallback) {
        var raw = typeof name === 'string' ? name : (name && name.toString ? name.toString() : '');
        var trimmed = raw.trim();
        var withoutExt = trimmed.replace(/\.[^.]+$/, '');
        var candidate = stripTimestampSuffix(withoutExt || trimmed) || withoutExt || trimmed || (fallback || '');
        if (!candidate) candidate = 'temp_exec';
        var safe = candidate.replace(/[\\/:*?"<>|]/g, '_');
        return safe || 'temp_exec';
      };
    var ensureTempExecReplacement = deps && deps.ensureTempExecReplacement
      ? function(entry, pendingList) { return deps.ensureTempExecReplacement(entry, pendingList || []); }
      : function(entry, pendingList) {
        var normalized = normalizeTempExecName(entry && entry.name);
        var duplicates = state.tempExecFiles.filter(function(file) {
          return normalizeTempExecName(file && file.name) === normalized;
        });
        var pendingDuplicates = (pendingList || []).filter(function(item) {
          return normalizeTempExecName(item && item.name) === normalized;
        });
        if (duplicates.length || pendingDuplicates.length) {
          var confirmMsg = '检测到名称为【' + (entry && entry.name ? entry.name : '') + '】的用例已存在，替换将清除原有执行结果，是否继续？';
          if (!window.confirm(confirmMsg)) return false;
          duplicates.forEach(function(file) { removeTempExecFile(file && file.id); });
          pendingDuplicates.forEach(function(item) {
            var idx = pendingList.indexOf(item);
            if (idx !== -1) pendingList.splice(idx, 1);
          });
        }
        return true;
      };
    var tempExecUndoTimer = null;
    var tempExecUndoInterval = null;
    var tempExecUndoEl = null;

    function getApiClient() {
      if (typeof window === 'undefined') return null;
      return window.app && window.app.apiClient ? window.app.apiClient : null;
    }

    var appUtils = null;
    try {
      if (typeof window !== 'undefined') {
        appUtils = window.app && window.app.utils ? window.app.utils : null;
      }
    } catch (err) {
      appUtils = null;
    }

    function isDbMode() {
      if (typeof window === 'undefined') return false;
      if (!window.app || window.app.authReady !== true) return false;
      var liveState = window.app && window.app.state ? window.app.state : state;
      var user = liveState && liveState.currentUser ? liveState.currentUser : null;
      // 约定：e2e skip auth 用 user.id = 0，不走 DB 入库，避免静态模式误触发 API。
      if (!user || !user.id) return false;
      var client = getApiClient();
      return Boolean(
        client &&
          typeof client.listExecSets === 'function' &&
          typeof client.listExecCases === 'function' &&
          typeof client.updateExecCase === 'function'
      );
    }

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
      if (meta && meta.caseFileId !== null && meta.caseFileId !== undefined) {
        key = String(meta.caseFileId);
      }
      if (!key && execSetId) key = 'execset:' + String(execSetId);
      return key;
    }

    function queueTempExecCaseLibraryAutoPopup(execSetId, meta) {
      if (!execSetId || !meta || !meta.shouldAutoPopup) return;
      var key = getTempExecCaseLibraryAutoPopupKey(execSetId, meta);
      if (!key) return;
      var store = ensureTempExecCaseLibraryAutoPopupState();
      store.byKey[key] = String(execSetId);
      if (store.order.indexOf(key) === -1) store.order.push(key);
    }

    function clearTempExecCaseLibraryAutoPopup(execSetId, meta) {
      var store = ensureTempExecCaseLibraryAutoPopupState();
      var key = getTempExecCaseLibraryAutoPopupKey(execSetId, meta);
      var resolved = key;
      if (!resolved && execSetId) {
        var id = String(execSetId);
        for (var i = 0; i < store.order.length; i += 1) {
          var k = store.order[i];
          if (store.byKey[k] === id) {
            resolved = k;
            break;
          }
        }
      }
      if (!resolved) return;
      if (Object.prototype.hasOwnProperty.call(store.byKey, resolved)) delete store.byKey[resolved];
      var idx = store.order.indexOf(resolved);
      if (idx !== -1) store.order.splice(idx, 1);
    }

    function pruneTempExecCaseLibraryAutoPopupQueue(keepIds) {
      var keepList = normalizeExecSetIdList(keepIds);
      if (!keepList.length) {
        var store = ensureTempExecCaseLibraryAutoPopupState();
        store.byKey = {};
        store.order = [];
        state.tempExecCaseLibraryAutoPopupByKey = store.byKey;
        state.tempExecCaseLibraryAutoPopupOrder = store.order;
        return;
      }
      var keepMap = {};
      keepList.forEach(function(id) { keepMap[id] = true; });
      var store2 = ensureTempExecCaseLibraryAutoPopupState();
      var next = [];
      store2.order.forEach(function(key) {
        var execSetId = store2.byKey[key] ? String(store2.byKey[key]) : '';
        if (!execSetId || !keepMap[execSetId]) {
          if (Object.prototype.hasOwnProperty.call(store2.byKey, key)) delete store2.byKey[key];
          return;
        }
        next.push(key);
      });
      store2.order = next;
      state.tempExecCaseLibraryAutoPopupOrder = store2.order;
    }

    function pickTempExecCaseLibraryAutoPopupExecSetId(activeId) {
      var store = ensureTempExecCaseLibraryAutoPopupState();
      var ids = store.order.map(function(key) { return store.byKey[key]; }).filter(Boolean);
      var active = activeId ? String(activeId) : '';
      if (active && ids.indexOf(active) !== -1) return active;
      return ids.length ? String(ids[0]) : '';
    }

    var tempExecPendingRestoreDiffExecSetId = '';
    var tempExecPendingRestoreDiffStorageKey = 'tap-tempexec-pending-restore-diff';
    function readTempExecPendingRestoreDiffExecSetId() {
      if (tempExecPendingRestoreDiffExecSetId) return tempExecPendingRestoreDiffExecSetId;
      if (typeof sessionStorage === 'undefined') return '';
      try {
        var raw = sessionStorage.getItem(tempExecPendingRestoreDiffStorageKey) || '';
        if (raw) tempExecPendingRestoreDiffExecSetId = String(raw || '').trim();
      } catch (err) {
        // ignore
      }
      return tempExecPendingRestoreDiffExecSetId;
    }
    function clearTempExecPendingRestoreDiffExecSetId() {
      tempExecPendingRestoreDiffExecSetId = '';
      if (typeof sessionStorage === 'undefined') return;
      try {
        sessionStorage.removeItem(tempExecPendingRestoreDiffStorageKey);
      } catch (err) {
        // ignore
      }
    }

    var tempExecCaseLibraryAutoPopupSeen = {};
    function markTempExecCaseLibraryAutoPopupSeen(execSetId) {
      if (!execSetId) return;
      tempExecCaseLibraryAutoPopupSeen[String(execSetId)] = true;
    }
    function hasTempExecCaseLibraryAutoPopupSeen(execSetId) {
      if (!execSetId) return false;
      return tempExecCaseLibraryAutoPopupSeen[String(execSetId)] === true;
    }

    function maybeOpenTempExecCaseLibraryAutoPopup(allowAutoPopup, activeId) {
      if (!allowAutoPopup) return false;
      var execSetId = pickTempExecCaseLibraryAutoPopupExecSetId(activeId);
      if (!execSetId) return false;
      var opened = openTempExecCaseLibraryDiffDrawer({ auto: true, execSetId: execSetId });
      if (opened) {
        clearTempExecCaseLibraryAutoPopup(execSetId);
        markTempExecCaseLibraryAutoPopupSeen(execSetId);
      }
      return opened;
    }

    // 归档恢复后跨页面进入执行视图：若存在待提醒 diff，优先自动弹出。
    function tryAutoOpenTempExecRestoreDiff(execSetId, meta) {
      var pendingId = readTempExecPendingRestoreDiffExecSetId();
      if (!pendingId) return false;
      var targetId = execSetId ? String(execSetId) : '';
      if (targetId && targetId !== String(pendingId)) return false;
      if (!isTempExecTabActive(true)) return false;
      var store = ensureTempExecCaseLibraryDiffState();
      var targetMeta = meta || (store.byExecSetId ? store.byExecSetId[String(pendingId)] : null);
      if (!targetMeta) return false;
      if (!hasUnackedCaseLibraryDiff(targetMeta) || !hasCaseLibraryChangeSignal(targetMeta)) {
        clearTempExecPendingRestoreDiffExecSetId();
        return false;
      }
      var opened = openTempExecCaseLibraryDiffDrawer({ auto: true, execSetId: String(pendingId) });
      if (opened) {
        clearTempExecPendingRestoreDiffExecSetId();
        clearTempExecCaseLibraryAutoPopup(pendingId, targetMeta);
        markTempExecCaseLibraryAutoPopupSeen(pendingId);
      }
      return opened;
    }

    function isTempExecTabActive(strict) {
      var isStrict = strict === true;
      var isTempExecTab = false;
      try {
        isTempExecTab = String(state && state.activeTab ? state.activeTab : '') === 'tempexec';
      } catch (err) {
        isTempExecTab = false;
      }
      if (!isTempExecTab && !isStrict) {
        try {
          if (typeof sessionStorage !== 'undefined') {
            var cfg = window.app && window.app.config ? window.app.config : {};
            var key = cfg && cfg.activeTabKey ? cfg.activeTabKey : 'usecase-active-tab';
            var saved = key ? String(sessionStorage.getItem(key) || '') : '';
            if (saved === 'tempexec') isTempExecTab = true;
            if (!isTempExecTab) {
              var reloadSource = String(sessionStorage.getItem('tap-reload-source-tab') || '');
              if (reloadSource === 'tempexec') isTempExecTab = true;
            }
          }
        } catch (err2) {
          // ignore
        }
      }
      return isTempExecTab;
    }

    function normalizeExecSetIdList(raw) {
      var list = Array.isArray(raw) ? raw.slice() : (raw ? [raw] : []);
      var result = [];
      list.forEach(function(id) {
        var key = String(id || '').trim();
        if (!key) return;
        if (result.indexOf(key) !== -1) return;
        result.push(key);
      });
      return result;
    }

    function clearTempExecCaseLibraryDiffMeta(execSetIds, options) {
      var ids = normalizeExecSetIdList(execSetIds);
      if (!ids.length) return false;
      var opts = options || {};
      var store = ensureTempExecCaseLibraryDiffState();
      var changed = false;
      ids.forEach(function(id) {
        if (store.byExecSetId && Object.prototype.hasOwnProperty.call(store.byExecSetId, id)) {
          delete store.byExecSetId[id];
          changed = true;
        }
        if (store.filterByExecSetId && Object.prototype.hasOwnProperty.call(store.filterByExecSetId, id)) {
          delete store.filterByExecSetId[id];
          changed = true;
        }
        var file = getTempExecFile(id);
        if (file && file.caseLibraryMeta) file.caseLibraryMeta = null;
        if (String(state.tempExecCaseLibraryDiffSelectedExecSetId || '') === id) {
          state.tempExecCaseLibraryDiffSelectedExecSetId = '';
        }
        if (String(state.tempExecCaseLibraryDiffLastRenderedExecSetId || '') === id) {
          state.tempExecCaseLibraryDiffLastRenderedExecSetId = '';
        }
        clearTempExecCaseLibraryAutoPopup(id);
        if (file && String(file.id || '') === String(state.tempExecActiveId || '')) {
          syncTempExecCaseLibraryChangesButton(file);
        }
      });
      if (changed && opts.render && typeof renderTempExecCaseLibraryDiffCaseTabs === 'function') {
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
      Object.keys(store.byExecSetId || {}).forEach(function(id) {
        if (!keepMap[id]) delete store.byExecSetId[id];
      });
      Object.keys(store.filterByExecSetId || {}).forEach(function(id) {
        if (!keepMap[id]) delete store.filterByExecSetId[id];
      });
      var selected = getTempExecCaseLibraryDiffSelectedExecSetId();
      if (selected && !keepMap[selected]) state.tempExecCaseLibraryDiffSelectedExecSetId = '';
      var lastRendered = state.tempExecCaseLibraryDiffLastRenderedExecSetId
        ? String(state.tempExecCaseLibraryDiffLastRenderedExecSetId)
        : '';
      if (lastRendered && !keepMap[lastRendered]) state.tempExecCaseLibraryDiffLastRenderedExecSetId = '';
      pruneTempExecCaseLibraryAutoPopupQueue(keepList);
    }

    function queueTempExecCaseLibraryDiffReset(execSetIds) {
      var ids = normalizeExecSetIdList(execSetIds);
      if (!ids.length) return;
      if (!Array.isArray(state.tempExecCaseLibraryDiffResetIds)) state.tempExecCaseLibraryDiffResetIds = [];
      ids.forEach(function(id) {
        if (state.tempExecCaseLibraryDiffResetIds.indexOf(id) !== -1) return;
        state.tempExecCaseLibraryDiffResetIds.push(id);
      });
    }

    function applyTempExecCaseLibraryDiffReset() {
      var ids = normalizeExecSetIdList(state.tempExecCaseLibraryDiffResetIds || []);
      if (!ids.length) return;
      clearTempExecCaseLibraryDiffMeta(ids);
      state.tempExecCaseLibraryDiffResetIds = [];
    }

    function mountTempExecToolbarButtons() {
      if (!tempExecToolbar) return;
      var stash = document.getElementById('tempExecToolbarStash');
      var changeSlot = tempExecToolbar.querySelector('#tempExecCaseLibraryChangeSlot');
      var exportSlot = tempExecToolbar.querySelector('#tempExecExportSlot');
      if (tempExecCaseLibraryChangesBtn && changeSlot && tempExecCaseLibraryChangesBtn.parentNode !== changeSlot) {
        changeSlot.appendChild(tempExecCaseLibraryChangesBtn);
      }
      if (exportSlot) {
        if (exportTempExecXmindBtn && exportTempExecXmindBtn.parentNode !== exportSlot) {
          exportSlot.appendChild(exportTempExecXmindBtn);
        }
        if (exportTempExecCasesXmindBtn && exportTempExecCasesXmindBtn.parentNode !== exportSlot) {
          exportSlot.appendChild(exportTempExecCasesXmindBtn);
        }
      }
      if (stash && stash.classList.contains('hidden')) {
        // keep stash hidden
      }
    }

    function stashTempExecToolbarButtons() {
      var stash = document.getElementById('tempExecToolbarStash');
      if (!stash) return;
      var items = [tempExecCaseLibraryChangesBtn, exportTempExecXmindBtn, exportTempExecCasesXmindBtn];
      items.forEach(function(btn) {
        if (!btn) return;
        if (btn.parentNode !== stash) stash.appendChild(btn);
      });
    }

    function normalizeDiffKind(raw) {
      var kind = String(raw || '').trim().toLowerCase();
      if (kind === 'appended' || kind === 'added' || kind === 'updated' || kind === 'deleted') return kind;
      return '';
    }

    var execCasePatchTimers = {};
    var execCasePatchQueue = {};
    var pendingExecCasePatchByTempId = {};

    function queueExecCasePatch(execCaseId, patch, options) {
      if (!execCaseId) return;
      if (!patch || typeof patch !== 'object') return;
      if (!execCasePatchQueue[execCaseId]) execCasePatchQueue[execCaseId] = {};
      Object.keys(patch).forEach(function(key) {
        execCasePatchQueue[execCaseId][key] = patch[key];
      });
      if (execCasePatchTimers[execCaseId]) clearTimeout(execCasePatchTimers[execCaseId]);
      execCasePatchTimers[execCaseId] = setTimeout(function() {
        var payload = execCasePatchQueue[execCaseId] || null;
        delete execCasePatchQueue[execCaseId];
        delete execCasePatchTimers[execCaseId];
        if (!payload) return;
        var client = getApiClient();
        if (!client || typeof client.updateExecCase !== 'function') return;
        client.updateExecCase(execCaseId, payload).catch(function(err) {
          if (tempExecStatus) {
            var msg = err && err.message ? err.message : '执行数据保存失败';
            setStatus(tempExecStatus, msg, 'err');
          }
          if (options && typeof options.onError === 'function') {
            try { options.onError(err); } catch (e) {}
          }
        });
      }, 320);
    }

    function queueExecCasePatchForItem(item, patch) {
      if (!item || !patch || typeof patch !== 'object') return;
      var caseId = item.execCaseId || item.id;
      if (caseId) {
        queueExecCasePatch(caseId, patch);
        return;
      }
      var tempId = item._tempId ? String(item._tempId) : '';
      if (!tempId) return;
      if (!pendingExecCasePatchByTempId[tempId] || typeof pendingExecCasePatchByTempId[tempId] !== 'object') {
        pendingExecCasePatchByTempId[tempId] = {};
      }
      Object.keys(patch).forEach(function(key) {
        pendingExecCasePatchByTempId[tempId][key] = patch[key];
      });
    }

    function consumePendingExecCasePatch(tempId) {
      var key = tempId ? String(tempId) : '';
      if (!key) return null;
      var payload = pendingExecCasePatchByTempId[key] || null;
      if (payload) delete pendingExecCasePatchByTempId[key];
      return payload;
    }

    function clearPendingExecCasePatch(tempId) {
      var key = tempId ? String(tempId) : '';
      if (!key) return;
      if (pendingExecCasePatchByTempId[key]) delete pendingExecCasePatchByTempId[key];
    }

    var execSetPatchTimer = null;
    var execSetPatchQueue = {};
    function queueExecSetPatch(execSetId, patch) {
      if (!execSetId) return;
      if (!patch || typeof patch !== 'object') return;
      Object.keys(patch).forEach(function(key) {
        execSetPatchQueue[key] = patch[key];
      });
      if (execSetPatchTimer) clearTimeout(execSetPatchTimer);
      execSetPatchTimer = setTimeout(function() {
        execSetPatchTimer = null;
        var payload = execSetPatchQueue;
        execSetPatchQueue = {};
        var client = getApiClient();
        if (!client || typeof client.updateExecSet !== 'function') return;
        client.updateExecSet(execSetId, payload).catch(function(err) {
          if (tempExecStatus) {
            var msg = err && err.message ? err.message : '执行集保存失败';
            setStatus(tempExecStatus, msg, 'err');
          }
        });
      }, 400);
    }

    var tempExecUiSaveTimer = null;
    function scheduleTempExecUiSave() {
      if (!isDbMode()) return;
      var client = getApiClient();
      if (!client || typeof client.saveSettings !== 'function') return;
      if (tempExecUiSaveTimer) clearTimeout(tempExecUiSaveTimer);
      tempExecUiSaveTimer = setTimeout(function() {
        tempExecUiSaveTimer = null;
        var payload = {
          type: 'tempexec_ui_v1',
          activeId: state.tempExecActiveId || '',
          placement: state.tempExecPlacement || defaultPlacement,
          collapsed: {
            req: Boolean(state.tempExecReqCollapsed),
            version: Boolean(state.tempExecVersionCollapsed),
          },
          focus: Array.isArray(state.tempExecFocus) ? state.tempExecFocus : [],
          versions: serializeTempExecVersions(state),
          pageSize: state.tempExecPageSize || defaultTempExecPageSize,
          importProjectFilterId: state.tempExecImportProjectFilterId ? String(state.tempExecImportProjectFilterId) : '',
          archivedHidden: Array.isArray(state.tempExecArchivedHidden) ? state.tempExecArchivedHidden : [],
        };
        client.saveSettings('user', [{ key: 'tempexec_ui_v1', value_json: payload }]).catch(function() {});
      }, 500);
    }

    var tempExecImportDuplicateDrawer = null;
    var tempExecImportDuplicateResolve = null;
    var tempExecImportDuplicateResolved = false;
    var tempExecImportDuplicateConfirmBound = false;

    function ensureTempExecImportDuplicateDrawer() {
      if (tempExecImportDuplicateDrawer) return tempExecImportDuplicateDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      tempExecImportDuplicateDrawer = window.app.drawer.createDrawer({
        drawerId: 'tempExecImportDuplicateDrawer',
        onClose: function() {
          if (tempExecImportDuplicateResolved) return;
          if (typeof tempExecImportDuplicateResolve === 'function') {
            tempExecImportDuplicateResolved = true;
            try { tempExecImportDuplicateResolve(false); } catch (e) {}
            tempExecImportDuplicateResolve = null;
          }
        },
      });
      if (!tempExecImportDuplicateConfirmBound) {
        tempExecImportDuplicateConfirmBound = true;
        var confirmBtn = document.getElementById('tempExecImportDuplicateConfirmBtn');
        if (confirmBtn && typeof confirmBtn.addEventListener === 'function') {
          confirmBtn.addEventListener('click', function() {
            if (tempExecImportDuplicateResolved) return;
            if (typeof tempExecImportDuplicateResolve !== 'function') return;
            tempExecImportDuplicateResolved = true;
            var resolve = tempExecImportDuplicateResolve;
            tempExecImportDuplicateResolve = null;
            try { resolve(true); } catch (e) {}
            if (tempExecImportDuplicateDrawer && typeof tempExecImportDuplicateDrawer.close === 'function') {
              tempExecImportDuplicateDrawer.close();
            }
          });
        }
      }
      return tempExecImportDuplicateDrawer;
    }

    function renderTempExecImportDuplicateDrawer(payload) {
      var titleEl = document.getElementById('tempExecImportDuplicateTitle');
      var statusEl = document.getElementById('tempExecImportDuplicateStatus');
      var bodyEl = document.getElementById('tempExecImportDuplicateBody');
      var confirmBtn = document.getElementById('tempExecImportDuplicateConfirmBtn');

      var fileName = payload && payload.fileName ? String(payload.fileName) : '用例';
      var total = payload && Number.isFinite(Number(payload.total)) ? Number(payload.total) : 0;
      var uniqueCount = payload && Number.isFinite(Number(payload.uniqueCount)) ? Number(payload.uniqueCount) : 0;
      var duplicateCount = payload && Number.isFinite(Number(payload.duplicateCount)) ? Number(payload.duplicateCount) : 0;
      var rows = payload && Array.isArray(payload.rows) ? payload.rows : [];

      if (titleEl) titleEl.textContent = '导入用例重复校验：' + fileName;
      if (statusEl) {
        var msg = '检测到重复条目 ' + duplicateCount + ' 条（模块/用例描述/前提条件/操作步骤/预期结果均相同），将自动去重：原 ' + total + ' 条 → 去重后 ' + uniqueCount + ' 条。';
        setStatus(statusEl, msg, 'warn');
      }
      if (confirmBtn) confirmBtn.disabled = !duplicateCount;

      if (!bodyEl) return;
      if (!rows.length) {
        bodyEl.innerHTML = '<tr><td colspan="11"><p class="hint">暂无重复条目</p></td></tr>';
        return;
      }

      function toHtml(val) {
        var text = val === null || val === undefined ? '' : String(val);
        return escapeHtml(text).replace(/\n/g, '<br>');
      }
      function formatDefects(list) {
        if (!Array.isArray(list) || !list.length) return '';
        var urls = list.map(function(d) {
          if (!d) return '';
          if (typeof d === 'string') return d;
          if (d.url) return String(d.url);
          if (d.value) return String(d.value);
          return '';
        }).filter(Boolean);
        return urls.join('\n');
      }

      bodyEl.innerHTML = rows.map(function(entry) {
        var item = entry && entry.payload ? entry.payload : null;
        var src = entry && entry.source ? entry.source : null;
        var line = entry && Number.isFinite(Number(entry.line)) ? Number(entry.line) : 0;
        var keep = entry && entry.keep ? true : false;

        var module = item && item.module ? String(item.module) : '';
        var title = item && item.title ? String(item.title) : '';
        var priority = item && item.priority ? String(item.priority) : '';
        var pre = item && item.precondition ? String(item.precondition) : '';
        var steps = item && item.steps ? String(item.steps) : '';
        var expected = item && item.expected ? String(item.expected) : '';
        var actual = src && src.actual ? String(src.actual) : '';
        var remark = src && src.remark ? String(src.remark) : (item && item.remark ? String(item.remark) : '');
        var defect = formatDefects(src && src.defectLinks ? src.defectLinks : []);
        var action = keep ? '保留' : '移除';
        return (
          '<tr>' +
            '<td>' + (line ? String(line) : '-') + '</td>' +
            '<td>' + toHtml(module) + '</td>' +
            '<td>' + toHtml(title) + '</td>' +
            '<td>' + toHtml(priority) + '</td>' +
            '<td>' + toHtml(pre) + '</td>' +
            '<td>' + toHtml(steps) + '</td>' +
            '<td>' + toHtml(expected) + '</td>' +
            '<td>' + toHtml(actual) + '</td>' +
            '<td>' + toHtml(remark) + '</td>' +
            '<td>' + toHtml(defect) + '</td>' +
            '<td>' + escapeHtml(action) + '</td>' +
          '</tr>'
        );
      }).join('');
    }

    function confirmTempExecImportDuplicateByDrawer(payload) {
      var drawer = ensureTempExecImportDuplicateDrawer();
      if (!drawer) return Promise.resolve(false);

      tempExecImportDuplicateResolved = false;
      renderTempExecImportDuplicateDrawer(payload);
      drawer.open();

      return new Promise(function(resolve) {
        tempExecImportDuplicateResolve = resolve;
      });
    }
    function syncTempSectionToggleButtons() {
      var isProjectLayout = isTempExecProjectLayoutEnabled();
      if (tempReqToggleBtn) {
        // DB 模式下不展示“需求区”，但保留旧逻辑以便未来再次启用
        tempReqToggleBtn.classList.toggle('hidden', Boolean(isProjectLayout));
        tempReqToggleBtn.classList.toggle('collapsed', Boolean(state.tempExecReqCollapsed));
        var reqLabel = state.tempExecReqCollapsed ? '展开需求区' : '收起需求区';
        tempReqToggleBtn.setAttribute('aria-label', reqLabel);
        tempReqToggleBtn.setAttribute('title', reqLabel);
        tempReqToggleBtn.textContent = reqLabel;
      }
      if (tempVersionToggleBtn) {
        tempVersionToggleBtn.classList.toggle('collapsed', Boolean(state.tempExecVersionCollapsed));
        var verLabel = isProjectLayout
          ? (state.tempExecVersionCollapsed ? '展开项目区' : '收起项目区')
          : (state.tempExecVersionCollapsed ? '展开版本区' : '收起版本区');
        tempVersionToggleBtn.setAttribute('aria-label', verLabel);
        tempVersionToggleBtn.setAttribute('title', verLabel);
        tempVersionToggleBtn.textContent = verLabel;
      }
      if (createTempVersionBtn) {
        createTempVersionBtn.classList.toggle('hidden', Boolean(state.tempExecVersionCollapsed) || Boolean(isProjectLayout));
        createTempVersionBtn.disabled = Boolean(isProjectLayout);
      }
      if (tempExecNav) {
        var header = tempExecNav.previousElementSibling;
        if (header && header.classList && header.classList.contains('temp-exec-header')) {
          header.classList.toggle('hidden', Boolean(isProjectLayout));
        }
        tempExecNav.classList.toggle('hidden', Boolean(isProjectLayout));
      }
      if (tempVersionGrid) {
        tempVersionGrid.classList.toggle('temp-project-layout', Boolean(isProjectLayout));
        var header2 = tempVersionGrid.previousElementSibling;
        if (header2 && header2.querySelector) {
          var titleEl = header2.querySelector('.temp-version-title');
          if (titleEl) titleEl.textContent = isProjectLayout ? '项目分组' : '版本分组';
        }
      }
    }

    function isTempExecProjectLayoutEnabled() {
      return isDbMode();
    }

    function isReuseDetailRemoved(detail) {
      return Boolean(detail && detail.removed);
    }

    function normalizeReuseDetails(list) {
      if (!Array.isArray(list)) return [];
      return list
        .map(function(detail) {
          var text = detail && detail.text ? String(detail.text).trim() : '';
          var presetId = detail && detail.presetId ? detail.presetId : '';
          var removed = isReuseDetailRemoved(detail);
          if (!text && (!removed || !presetId)) return null;
          var id = detail && detail.id ? detail.id : generateReuseDetailId();
          return {
            id: id,
            text: text,
            note: detail && detail.note ? detail.note : '',
            status: detail && detail.status ? detail.status : '未执行',
            presetId: presetId,
            removed: removed,
          };
        })
        .filter(Boolean);
    }

    function normalizeReusePresets(list) {
      if (!Array.isArray(list)) return [];
      return list
        .map(function(item) {
          var text = item && item.text ? String(item.text).trim() : '';
          if (!text) return null;
          var id = item && item.id ? String(item.id) : generateReusePresetId();
          return { id: id, text: text };
        })
        .filter(Boolean);
    }

    function normalizeDefectLinks(list) {
      if (!Array.isArray(list)) return [];
      return list
        .map(function(item) {
          var id = item && item.id ? String(item.id) : generateDefectLinkId();
          var url = item && item.url ? String(item.url) : '';
          return { id: id, url: url };
        })
        .filter(Boolean);
    }

    function getTempExecFileBaseName(file, requirementLabel) {
      var requirement = normalizeRequirementName(requirementLabel) || '';
      var name = file && file.name ? file.name : '';
      var fallback = requirement || 'temp_exec';
      return getSafeFileBaseName(name, fallback);
    }

    function normalizeTempExecCase(item, fileId, idx) {
      var moduleName = stringifyCaseField(item && (item.module || item.module_name || item['模块'])) || ('模块' + (idx + 1));
      var title = stringifyCaseField(item && (item.title || item.case_title || item['用例标题'])) || moduleName;
      var priority = stringifyCaseField(item && (item.priority || item.level || item['优先级'])) || 'P1';
      var preconditions = stringifyCaseField(item && (item.preconditions || item.precondition || item['前提条件'])) || '';
      var steps = stringifyCaseField(item && (item.steps || item.actions || item['操作步骤'])) || '';
      var expected = stringifyCaseField(item && (item.expected || item.result || item['预期结果'])) || '';
      return {
        id: item && item.id ? item.id : (fileId + '-' + idx),
        module: moduleName,
        title: title,
        priority: priority,
        preconditions: preconditions,
        steps: steps,
        expected: expected,
        actual: item && item.actual ? item.actual : '未执行',
        remark: item && item.remark ? item.remark : '',
        reuseDetails: normalizeReuseDetails(item && item.reuseDetails),
        defectLinks: normalizeDefectLinks(item && item.defectLinks),
      };
    }

    function normalizeTempExecCases(list, fileId) {
      if (!Array.isArray(list)) return [];
      return list.map(function(item, idx) { return normalizeTempExecCase(item, fileId, idx); }).filter(Boolean);
    }

    function normalizeTempExecPlacement(raw) {
      var placement = raw && typeof raw === 'object' ? raw : {};
      var requirementOrder = Array.isArray(placement.requirementOrder)
        ? placement.requirementOrder.map(function(item) { return normalizeRequirementName(item); }).filter(Boolean)
        : [];
      var fileOrder = placement.fileOrder && typeof placement.fileOrder === 'object'
        ? Object.keys(placement.fileOrder).reduce(function(acc, key) {
            var normKey = normalizeRequirementName(key);
            if (!normKey) return acc;
            var arr = Array.isArray(placement.fileOrder[key]) ? placement.fileOrder[key] : [];
            acc[normKey] = arr.map(function(id) { return id && id.toString(); }).filter(Boolean);
            return acc;
          }, {})
        : {};
      var versionOrder = Array.isArray(placement.versionOrder)
        ? placement.versionOrder.map(function(id) { return id && id.toString(); }).filter(Boolean)
        : [];
      var projectOrder = Array.isArray(placement.projectOrder)
        ? placement.projectOrder.map(function(id) { return id && id.toString(); }).filter(Boolean)
        : [];
      var versionOrderByProject = placement.versionOrderByProject && typeof placement.versionOrderByProject === 'object'
        ? Object.keys(placement.versionOrderByProject).reduce(function(acc, projectId) {
            var pid = projectId && projectId.toString ? projectId.toString() : '';
            if (!pid) return acc;
            var arr = Array.isArray(placement.versionOrderByProject[projectId]) ? placement.versionOrderByProject[projectId] : [];
            acc[pid] = arr.map(function(id) { return id && id.toString(); }).filter(Boolean);
            return acc;
          }, {})
        : {};
      var fileOrderByProjectVersion = placement.fileOrderByProjectVersion && typeof placement.fileOrderByProjectVersion === 'object'
        ? Object.keys(placement.fileOrderByProjectVersion).reduce(function(acc, projectId) {
            var pid = projectId && projectId.toString ? projectId.toString() : '';
            if (!pid) return acc;
            var versions = placement.fileOrderByProjectVersion[projectId];
            if (!versions || typeof versions !== 'object') return acc;
            acc[pid] = Object.keys(versions).reduce(function(vacc, verId) {
              var vid = verId && verId.toString ? verId.toString() : '';
              if (vid === null || vid === undefined) return vacc;
              var arr = Array.isArray(versions[verId]) ? versions[verId] : [];
              vacc[vid] = arr.map(function(id) { return id && id.toString(); }).filter(Boolean);
              return vacc;
            }, {});
            return acc;
          }, {})
        : {};
      return {
        requirementOrder: requirementOrder,
        fileOrder: fileOrder,
        versionOrder: versionOrder,
        projectOrder: projectOrder,
        versionOrderByProject: versionOrderByProject,
        fileOrderByProjectVersion: fileOrderByProjectVersion,
      };
    }

    function serializeSingleTempExecFile(file) {
      if (!file) return null;
      return {
        id: file.id,
        name: file.name,
        scope: file.scope,
        requirement: file.requirement || getRequirementLabel(true),
        reuseEnabled: Boolean(file.reuseEnabled),
        createdAt: file.createdAt || Date.now(),
        projectId: file.projectId || '',
        versionId: file.versionId || '',
        reusePresets: Array.isArray(file.reusePresets)
          ? file.reusePresets.map(function(preset) {
            return {
              id: preset && preset.id ? preset.id : generateReusePresetId(),
              text: preset && preset.text ? preset.text : '',
            };
          })
          : [],
        cases: (file.cases || []).map(function(item) {
          return {
            module: item.module,
            title: item.title,
            priority: item.priority,
            preconditions: item.preconditions,
            steps: item.steps,
            expected: item.expected,
            actual: item.actual,
            remark: item.remark,
            reuseDetails: Array.isArray(item.reuseDetails)
              ? item.reuseDetails.map(function(detail) {
                return {
                  id: detail && detail.id ? detail.id : generateReuseDetailId(),
                  text: detail && detail.text ? detail.text : '',
                  note: detail && detail.note ? detail.note : '',
                  status: detail && detail.status ? detail.status : '未执行',
                  presetId: detail && detail.presetId ? detail.presetId : '',
                  removed: Boolean(detail && detail.removed),
                };
              })
              : [],
            defectLinks: Array.isArray(item.defectLinks)
              ? item.defectLinks.map(function(link) {
                return {
                  id: link && link.id ? link.id : generateDefectLinkId(),
                  url: link && link.url ? link.url : '',
                };
              })
              : [],
          };
        }),
      };
    }

    function serializeTempExecFiles(state) {
      return (state.tempExecFiles || [])
        .map(function(file) { return serializeSingleTempExecFile(file); })
        .filter(Boolean);
    }

    function serializeTempExecVersions(state) {
      var fileIdSet = new Set((state.tempExecFiles || []).map(function(file) { return file.id; }));
      var seenVersionIds = new Set();
      return (state.tempExecVersions || [])
        .map(function(ver) {
          if (!ver || typeof ver !== 'object') return null;
          var id = ver.id || (generateTempExecId());
          while (seenVersionIds.has(id)) {
            id = generateTempExecId();
          }
          seenVersionIds.add(id);
          var name = (ver.name || '').trim() || '未命名版本';
          var ids = Array.isArray(ver.fileIds) ? ver.fileIds.filter(function(fid) { return fileIdSet.has(fid); }) : [];
          var deduped = [];
          var seen = new Set();
          ids.forEach(function(fid) {
            if (seen.has(fid)) return;
            seen.add(fid);
            deduped.push(fid);
          });
          return { id: id, name: name, fileIds: deduped };
        })
        .filter(Boolean);
    }

    function serializeModelList(list) {
      if (!Array.isArray(list)) return [];
      return list
        .map(function(item) {
          if (!item || typeof item !== 'object') return null;
          var model = {};
          Object.keys(item).forEach(function(key) {
            var val = item[key];
            if (val === undefined || typeof val === 'function') return;
            model[key] = val;
          });
          if (!model.id) {
            model.id = 'model-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
          }
          return model;
        })
        .filter(Boolean);
    }

    function serializeAssignments(raw) {
      if (!raw || typeof raw !== 'object') return {};
      var result = {};
      Object.keys(raw).forEach(function(key) {
        var val = raw[key];
        if (val === undefined || typeof val === 'function') return;
        result[key] = val;
      });
      return result;
    }

    function applyImportedModels(list) {
      var models = serializeModelList(list);
      if (!models.length) return;
      state.models = models;
      try {
        localStorage.setItem(modelsStorageKey, JSON.stringify(models));
      } catch (err) {
        console.warn('保存模型配置失败', err);
      }
    }

    function applyImportedAssignments(assignments) {
      if (!assignments || typeof assignments !== 'object') return;
      var merged = Object.assign({}, state.assignments || {}, serializeAssignments(assignments));
      state.assignments = merged;
      try {
        localStorage.setItem(assignmentStorageKey, JSON.stringify(merged));
      } catch (err) {
        console.warn('保存模型指派失败', err);
      }
    }

    function serializeTempExecSnapshot(state, getPageSize, columns) {
      return {
        type: 'tempexec_snapshot_v1',
        generatedAt: new Date().toISOString(),
        requirement: getRequirementLabel(true),
        files: serializeTempExecFiles(state),
        versions: serializeTempExecVersions(state),
        focus: Array.isArray(state.tempExecFocus) ? state.tempExecFocus.slice() : [],
        pageSize: typeof getPageSize === 'function' ? getPageSize() : 0,
        columns: columns || {},
        activeId: state.tempExecActiveId || '',
        placement: state.tempExecPlacement || defaultPlacement,
        models: serializeModelList(state.models || []),
        assignments: serializeAssignments(state.assignments || {}),
      };
    }

    function exportTempExecSnapshot() {
      var files = serializeTempExecFiles(state);
      if (!files.length) {
        if (tempExecStatus) setStatus(tempExecStatus, '暂无用例可导出，请先导入', 'warn');
        return;
      }
      var requirement = normalizeRequirementName(getRequirementLabel(true)) || 'temp_exec';
      var columns = (state && state.settings && state.settings.tempExecColumns)
        ? state.settings.tempExecColumns
        : defaultTempExecColumns;
      var snapshot = serializeTempExecSnapshot(state, getTempExecPageSize, columns);
      var stamp = formatCompactTimestamp ? formatCompactTimestamp() : new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      var safeReq = requirement.replace(/[\\/:*?"<>|]/g, '_');
      if (downloadText) {
        downloadText('tempexec_full_' + safeReq + '_' + stamp + '.json', JSON.stringify(snapshot, null, 2));
      }
      if (tempExecStatus) setStatus(tempExecStatus, '已导出执行页面配置，可用于完整还原', 'ok');
    }

    async function importTempExecSnapshot(file) {
      if (!file) return;
      var confirmed = true;
      if (typeof window !== 'undefined' && window.confirm) {
        confirmed = window.confirm('导入执行页面配置将覆盖当前页面的所有用例和执行数据，是否继续？');
      }
      if (!confirmed) return;
      try {
        var text = (await file.text()).trim();
        if (!text) {
          if (tempExecStatus) setStatus(tempExecStatus, '导入文件为空', 'warn');
          return;
        }
        var data = null;
        try {
          data = JSON.parse(text);
        } catch (err) {
          if (tempExecStatus) setStatus(tempExecStatus, '导入文件不是有效 JSON', 'err');
          return;
        }
        applyTempExecSnapshot(data);
        if (tempExecStatus) setStatus(tempExecStatus, '执行页面配置已导入并还原', 'ok');
      } catch (err) {
        console.error(err);
        if (tempExecStatus) setStatus(tempExecStatus, '导入失败：' + err.message, 'err');
      }
    }

    function applyTempExecSnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') throw new Error('导入内容为空或格式不正确');
      if (snapshot.models) {
        applyImportedModels(snapshot.models);
      }
      if (snapshot.assignments && typeof snapshot.assignments === 'object') {
        applyImportedAssignments(snapshot.assignments);
      }
      var filesRaw = Array.isArray(snapshot.files) ? snapshot.files : [];
      var versionsRaw = Array.isArray(snapshot.versions) ? snapshot.versions : [];
      var usedIds = new Set();
      var normalizedFiles = filesRaw
        .map(function(item) {
          if (!item || typeof item !== 'object') return null;
          var fileId = item.id || generateTempExecId();
          while (usedIds.has(fileId)) {
            fileId = generateTempExecId();
          }
          var list = normalizeTempExecCases(item.cases || [], fileId);
          if (!list.length) return null;
          usedIds.add(fileId);
          return {
            id: fileId,
            name: item.name || '测试用例',
            cases: list,
            scope: item.scope || 'history',
            requirement: normalizeRequirementName(item.requirement) || getRequirementLabel(true),
            reuseEnabled: Boolean(item.reuseEnabled),
            createdAt: Number.isFinite(Number(item.createdAt)) ? Number(item.createdAt) : Date.now(),
            reusePresets: item && item.reusePresets ? item.reusePresets : [],
            versionId: item.versionId || '',
          };
        })
        .filter(Boolean);
      state.tempExecFiles = normalizedFiles;
      applyVersionAssignments(versionsRaw);
      state.tempExecActiveId = '';
      state.tempExecSelections = {};
      state.tempExecRemarkOpen = {};
      state.tempExecReuseOpen = {};
      state.tempExecDefectOpen = {};
      state.tempExecPresetDraft = null;
      state.tempExecStatusFilter = { fileId: '', status: '' };
      resetTempExecPages();
      state.tempExecMindMode = false;
      var focusList = Array.isArray(snapshot.focus) ? snapshot.focus : [];
      state.tempExecFocus = focusList.filter(function(id) {
        return normalizedFiles.some(function(file) { return file.id === id; });
      });
      saveTempExecFocus();
      var columns = snapshot.columns && typeof snapshot.columns === 'object'
        ? Object.assign({}, defaultTempExecColumns, snapshot.columns)
        : null;
      if (columns) {
        state.settings = state.settings || {};
        state.settings.tempExecColumns = columns;
        ensureTempExecColumns();
        // 仅持久化列设置，避免覆盖其他设备的设置项。
        persistSettings(['tempExecColumns']);
      }
      if (Number.isFinite(Number(snapshot.pageSize))) {
        applyTempExecPageSize(Number(snapshot.pageSize));
      }
      var activeCandidate = snapshot.activeId && normalizedFiles.some(function(file) { return file.id === snapshot.activeId; })
        ? snapshot.activeId
        : (normalizedFiles[0] ? normalizedFiles[0].id : '');
      state.tempExecActiveId = activeCandidate;
      state.tempExecPlacement = normalizeTempExecPlacement(snapshot.placement || snapshot.position);
      var requirement = normalizeRequirementName(snapshot.requirement || snapshot.requirment);
      if (requirement) setRequirementLabel(requirement, 'tempexec-import');
      syncTempExecPlacement();
      persistTempExecState();
      renderTempExecNav();
      renderTempExecView();
      renderTempVersionGrid();
    }

    function ensureTempExecPlacement() {
      if (!state.tempExecPlacement || typeof state.tempExecPlacement !== 'object') {
        state.tempExecPlacement = normalizeTempExecPlacement(defaultPlacement);
      }
      if (!Array.isArray(state.tempExecPlacement.requirementOrder)) state.tempExecPlacement.requirementOrder = [];
      if (!state.tempExecPlacement.fileOrder || typeof state.tempExecPlacement.fileOrder !== 'object') {
        state.tempExecPlacement.fileOrder = {};
      }
      if (!Array.isArray(state.tempExecPlacement.versionOrder)) state.tempExecPlacement.versionOrder = [];
      if (!Array.isArray(state.tempExecPlacement.projectOrder)) state.tempExecPlacement.projectOrder = [];
      if (!state.tempExecPlacement.versionOrderByProject || typeof state.tempExecPlacement.versionOrderByProject !== 'object') {
        state.tempExecPlacement.versionOrderByProject = {};
      }
      if (!state.tempExecPlacement.fileOrderByProjectVersion || typeof state.tempExecPlacement.fileOrderByProjectVersion !== 'object') {
        state.tempExecPlacement.fileOrderByProjectVersion = {};
      }
      return state.tempExecPlacement;
    }

    function resolveProjectName(projectId) {
      var pid = projectId === null || projectId === undefined ? '' : String(projectId);
      if (!pid) return '项目#未知';
      var list = Array.isArray(state.projects) ? state.projects : [];
      var found = list.find(function(p) { return p && String(p.id) === pid; });
      var name = found && found.name ? String(found.name) : '';
      return name.trim() || ('项目#' + pid);
    }

    function resolveVersionName(projectId, versionId) {
      var vid = versionId === null || versionId === undefined ? '' : String(versionId);
      if (!vid) return '版本#未知';
      var pid = projectId === null || projectId === undefined ? '' : String(projectId);
      var byProject = state.projectVersionsByProject && typeof state.projectVersionsByProject === 'object'
        ? state.projectVersionsByProject
        : {};
      var list = byProject && pid && Array.isArray(byProject[pid]) ? byProject[pid] : [];
      var found = list.find(function(v) { return v && String(v.id) === vid; });
      var name = found && found.name ? String(found.name) : '';
      return name.trim() || ('版本#' + vid);
    }

    function updateTempExecFileCountBadge(fileId) {
      if (!fileId) return;
      var file = getTempExecFile(fileId);
      if (!file) return;
      var count = getTempExecFileCaseCount(file);
      var badgeText = count + ' 条';
      try {
        var nodes = [];
        if (tempVersionGrid && tempVersionGrid.querySelectorAll) {
          nodes = nodes.concat(Array.prototype.slice.call(tempVersionGrid.querySelectorAll('.temp-req-row[data-temp-file="' + String(fileId) + '"] .temp-req-count-badge')));
        }
        if (tempExecNav && tempExecNav.querySelectorAll) {
          nodes = nodes.concat(Array.prototype.slice.call(tempExecNav.querySelectorAll('.temp-req-row[data-temp-file="' + String(fileId) + '"] .temp-req-count-badge')));
        }
        nodes.forEach(function(node) {
          if (!node) return;
          node.textContent = badgeText;
        });
      } catch (err) {
        // ignore dom update errors
      }
    }

    function ensureProjectOrder(projectIds, projectMeta) {
      var placement = ensureTempExecPlacement();
      var list = Array.isArray(projectIds) ? projectIds : [];
      var normalized = list.map(function(id) { return id === null || id === undefined ? '' : String(id); }).filter(Boolean);
      var globalState = window.app && window.app.state ? window.app.state : {};
      var settings = globalState && globalState.settings && typeof globalState.settings === 'object' ? globalState.settings : {};
      var userOrder = Array.isArray(settings.projectOrder) ? settings.projectOrder.slice() : [];
      userOrder = userOrder.map(function(id) { return id === null || id === undefined ? '' : String(id); }).filter(Boolean);
      var useUserOrder = userOrder.length > 0;

      var existing = useUserOrder
        ? userOrder.filter(function(id) { return normalized.includes(id); })
        : placement.projectOrder.filter(function(id) { return normalized.includes(id); });
      var missing = normalized.filter(function(id) { return existing.indexOf(id) === -1; });
      if (missing.length) {
        var metaMap = projectMeta && typeof projectMeta.get === 'function' ? projectMeta : null;
        missing.sort(function(a, b) {
          var ta = metaMap ? Number(metaMap.get(a) || 0) : 0;
          var tb = metaMap ? Number(metaMap.get(b) || 0) : 0;
          if (ta !== tb) return tb - ta;
          return a.localeCompare(b, 'zh-Hans-CN');
        });
      }
      // 用户已在“项目排序”设置中明确配置时：按用户排序为准，新增项目自动追加到末尾。
      // 未配置时：延续旧逻辑（新出现的项目优先靠前）。
      placement.projectOrder = useUserOrder ? existing.concat(missing) : missing.concat(existing);
      return placement.projectOrder.slice();
    }

    function ensureProjectVersionOrder(projectId, versionIds, metaMap) {
      var placement = ensureTempExecPlacement();
      var pid = projectId === null || projectId === undefined ? '' : String(projectId);
      if (!pid) return [];
      if (!placement.versionOrderByProject[pid]) placement.versionOrderByProject[pid] = [];
      var list = Array.isArray(versionIds) ? versionIds : [];
      var normalized = list.map(function(id) { return id === null || id === undefined ? '' : String(id || ''); });
      normalized = normalized.filter(function(id) { return id !== null && id !== undefined; });
      var existing = placement.versionOrderByProject[pid].filter(function(id) { return normalized.includes(id); });
      var missing = normalized.filter(function(id) { return existing.indexOf(id) === -1; });
      if (missing.length) {
        var meta = metaMap && typeof metaMap.get === 'function' ? metaMap : null;
        missing.sort(function(a, b) {
          var ta = meta ? Number(meta.get(a) || 0) : 0;
          var tb = meta ? Number(meta.get(b) || 0) : 0;
          if (ta !== tb) return tb - ta;
          return a.localeCompare(b, 'zh-Hans-CN');
        });
      }
      placement.versionOrderByProject[pid] = missing.concat(existing);
      return placement.versionOrderByProject[pid].slice();
    }

    function ensureProjectVersionFileOrder(projectId, versionId, fileIds, metaMap) {
      var placement = ensureTempExecPlacement();
      var pid = projectId === null || projectId === undefined ? '' : String(projectId);
      if (!pid) return [];
      var vid = versionId === null || versionId === undefined ? '' : String(versionId || '');
      if (!placement.fileOrderByProjectVersion[pid]) placement.fileOrderByProjectVersion[pid] = {};
      if (!placement.fileOrderByProjectVersion[pid][vid]) placement.fileOrderByProjectVersion[pid][vid] = [];
      var list = Array.isArray(fileIds) ? fileIds : [];
      var normalized = list.map(function(id) { return id === null || id === undefined ? '' : String(id); }).filter(Boolean);
      var existing = placement.fileOrderByProjectVersion[pid][vid].filter(function(id) { return normalized.includes(id); });
      var missing = normalized.filter(function(id) { return existing.indexOf(id) === -1; });
      if (missing.length) {
        var meta = metaMap && typeof metaMap.get === 'function' ? metaMap : null;
        missing.sort(function(a, b) {
          var ta = meta ? Number(meta.get(a) || 0) : 0;
          var tb = meta ? Number(meta.get(b) || 0) : 0;
          if (ta !== tb) return tb - ta;
          return a.localeCompare(b, 'zh-Hans-CN');
        });
      }
      placement.fileOrderByProjectVersion[pid][vid] = missing.concat(existing);
      return placement.fileOrderByProjectVersion[pid][vid].slice();
    }

    function ensureRequirementOrder(reqList) {
      var placement = ensureTempExecPlacement();
      var normalizedList = (reqList || []).map(normalizeRequirementName).filter(Boolean);
      normalizedList.forEach(function(req) {
        if (!placement.requirementOrder.includes(req)) placement.requirementOrder.push(req);
      });
      placement.requirementOrder = placement.requirementOrder.filter(function(req) { return normalizedList.includes(req); });
      return placement.requirementOrder.slice();
    }

    function ensureFileOrder(requirement, fileIds) {
      var placement = ensureTempExecPlacement();
      var req = normalizeRequirementName(requirement) || '未标识需求';
      var list = Array.isArray(fileIds) ? fileIds.map(function(id) { return id && id.toString(); }).filter(Boolean) : [];
      if (!placement.fileOrder[req]) placement.fileOrder[req] = [];
      var order = placement.fileOrder[req];
      list.forEach(function(id) {
        if (!order.includes(id)) order.push(id);
      });
      placement.fileOrder[req] = order.filter(function(id) { return list.includes(id); });
      return placement.fileOrder[req].slice();
    }

    function ensureVersionOrder(versionIds) {
      var placement = ensureTempExecPlacement();
      var list = Array.isArray(versionIds) ? versionIds.map(function(id) { return id && id.toString(); }).filter(Boolean) : [];
      list.forEach(function(id) {
        if (!placement.versionOrder.includes(id)) placement.versionOrder.push(id);
      });
      placement.versionOrder = placement.versionOrder.filter(function(id) { return list.includes(id); });
      return placement.versionOrder.slice();
    }

    function reorderRequirementOrder(sourceReq, targetReq) {
      var placement = ensureTempExecPlacement();
      var src = normalizeRequirementName(sourceReq);
      var tgt = normalizeRequirementName(targetReq);
      if (!src || !tgt || src === tgt) return;
      var currentOrder = placement.requirementOrder.slice();
      var srcIdx = currentOrder.indexOf(src);
      var tgtIdx = currentOrder.indexOf(tgt);
      placement.requirementOrder = placement.requirementOrder.filter(function(r) { return r && r !== src; });
      if (tgtIdx === -1) {
        placement.requirementOrder.push(src);
      } else {
        var targetAfterRemoval = srcIdx !== -1 && srcIdx < tgtIdx ? tgtIdx - 1 : tgtIdx;
        var placeAfter = srcIdx !== -1 && srcIdx < tgtIdx;
        var insertIndex = placeAfter ? targetAfterRemoval + 1 : targetAfterRemoval;
        if (insertIndex < 0) insertIndex = 0;
        if (insertIndex > placement.requirementOrder.length) insertIndex = placement.requirementOrder.length;
        placement.requirementOrder.splice(insertIndex, 0, src);
      }
      persistTempExecState();
    }

    function updateVersionOrder(sourceId, targetId) {
      var placement = ensureTempExecPlacement();
      var src = sourceId || '';
      var tgt = targetId || '';
      if (!src || src === tgt) return;
      placement.versionOrder = placement.versionOrder.filter(function(id) { return id !== src; });
      var idx = placement.versionOrder.indexOf(tgt);
      if (idx === -1) placement.versionOrder.push(src);
      else placement.versionOrder.splice(idx, 0, src);
      persistTempExecState();
    }

    function removeFileFromOrder(requirement, fileId) {
      var placement = ensureTempExecPlacement();
      var req = normalizeRequirementName(requirement) || '未标识需求';
      var id = fileId && fileId.toString();
      if (!id) return;
      if (!placement.fileOrder[req]) placement.fileOrder[req] = [];
      placement.fileOrder[req] = placement.fileOrder[req].filter(function(item) { return item !== id; });
    }

    function insertFileIntoOrder(requirement, fileId, beforeId) {
      var placement = ensureTempExecPlacement();
      var req = normalizeRequirementName(requirement) || '未标识需求';
      var id = fileId && fileId.toString();
      if (!id) return;
      if (!placement.fileOrder[req]) placement.fileOrder[req] = [];
      var order = placement.fileOrder[req].filter(function(item) { return item !== id; });
      if (beforeId && order.includes(beforeId)) {
        var idx = order.indexOf(beforeId);
        order.splice(idx, 0, id);
      } else {
        order.push(id);
      }
      placement.fileOrder[req] = order;
    }

    function syncTempExecPlacement() {
      var reqs = (state.tempExecFiles || []).map(function(file) {
        return normalizeRequirementName(file && file.requirement) || '未标识需求';
      });
      ensureRequirementOrder(reqs);
      var uniqueReqs = Array.from(new Set(reqs));
      uniqueReqs.forEach(function(req) {
        var ids = (state.tempExecFiles || [])
          .filter(function(file) {
            var name = normalizeRequirementName(file && file.requirement) || '未标识需求';
            return name === req && !file.versionId;
          })
          .map(function(file) { return file.id; });
        ensureFileOrder(req, ids);
      });
      ensureVersionOrder((state.tempExecVersions || []).map(function(ver) { return ver.id; }));

      if (isTempExecProjectLayoutEnabled()) {
        var files = Array.isArray(state.tempExecFiles) ? state.tempExecFiles.slice() : [];
        var projects = new Map();
        var projectMeta = new Map();
        files.forEach(function(file) {
          var pid = file && file.projectId ? String(file.projectId) : '';
          if (!pid) return;
          if (!projects.has(pid)) projects.set(pid, new Map());
          var vid = file && file.versionId !== null && file.versionId !== undefined ? String(file.versionId || '') : '';
          if (!projects.get(pid).has(vid)) projects.get(pid).set(vid, []);
          projects.get(pid).get(vid).push(String(file.id));
          var ts = Number(file && file.createdAt) || 0;
          if (!Number.isFinite(ts)) ts = 0;
          var prev = projectMeta.has(pid) ? Number(projectMeta.get(pid) || 0) : 0;
          if (ts > prev) projectMeta.set(pid, ts);
        });
        ensureProjectOrder(Array.from(projects.keys()), projectMeta);
        projects.forEach(function(vmap, pid) {
          var versionMeta = new Map();
          vmap.forEach(function(idList, vid) {
            var ts = 0;
            idList.forEach(function(id) {
              var file = getTempExecFile(id);
              var fts = Number(file && file.createdAt) || 0;
              if (Number.isFinite(fts) && fts > ts) ts = fts;
            });
            versionMeta.set(String(vid || ''), ts);
          });
          ensureProjectVersionOrder(pid, Array.from(vmap.keys()), versionMeta);
          vmap.forEach(function(idList, vid) {
            var fileMeta = new Map();
            idList.forEach(function(id) {
              var file = getTempExecFile(id);
              var ts = Number(file && file.createdAt) || 0;
              if (!Number.isFinite(ts)) ts = 0;
              fileMeta.set(String(id), ts);
            });
            ensureProjectVersionFileOrder(pid, String(vid || ''), idList, fileMeta);
          });
        });
      }
    }

    function moveTempExecFileToRequirement(fileId, requirement, beforeId, opts) {
      if (!fileId) return;
      var options = opts || {};
      var file = getTempExecFile(fileId);
      if (!file) return;
      var targetReq = normalizeRequirementName(requirement) || '未标识需求';
      if (file.requirement === targetReq && !beforeId) return;
      removeFileFromOrder(file.requirement, fileId);
      ensureRequirementOrder(state.tempExecFiles.map(function(f) { return normalizeRequirementName(f.requirement) || '未标识需求'; }));
      ensureFileOrder(targetReq, getTempExecFilesByRequirement(targetReq).map(function(f) { return f.id; }));
      file.requirement = targetReq;
      insertFileIntoOrder(targetReq, fileId, beforeId);
      ensureRequirementOrder(state.tempExecFiles.map(function(f) { return normalizeRequirementName(f.requirement) || '未标识需求'; }));
      ensureFileOrder(targetReq, getTempExecFilesByRequirement(targetReq).map(function(f) { return f.id; }));
      persistTempExecState();
      if (!options.silent) {
        renderTempExecNav();
        renderTempVersionGrid();
        renderTempExecView();
      }
    }

    function clampTempExecPageSize(value) {
      var num = Math.round(Number(value));
      if (!Number.isFinite(num)) return defaultTempExecPageSize;
      return Math.min(200, Math.max(5, num));
    }

    function loadTempExecPageSizeSetting() {
      try {
        var stored = localStorage.getItem(tempExecPageSizeStorageKey);
        if (stored === null || stored === undefined) return defaultTempExecPageSize;
        return clampTempExecPageSize(Number(stored));
      } catch (err) {
        return defaultTempExecPageSize;
      }
    }

    function saveTempExecPageSizeSetting(value) {
      try {
        var size = clampTempExecPageSize(value);
        localStorage.setItem(tempExecPageSizeStorageKey, size);
        return size;
      } catch (err) {
        return clampTempExecPageSize(value);
      }
    }

    function ensureTempExecPageIndex(fileId) {
      if (!fileId) return 0;
      if (typeof state.tempExecPages[fileId] !== 'number' || Number.isNaN(state.tempExecPages[fileId])) {
        state.tempExecPages[fileId] = 0;
      }
      return state.tempExecPages[fileId];
    }

    function getTempExecPageSize() {
      var size = clampTempExecPageSize(state.tempExecPageSize || defaultTempExecPageSize);
      state.tempExecPageSize = size;
      return size;
    }

    function resetTempExecPages(fileId) {
      if (!fileId) {
        state.tempExecPages = {};
        (state.tempExecFiles || []).forEach(function(file) {
          state.tempExecPages[file.id] = 0;
        });
        return;
      }
      state.tempExecPages[fileId] = 0;
    }

    function setTempExecPage(fileId, page, suppressRender) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      var size = getTempExecPageSize();
      var totalPages = Math.max(1, Math.ceil(file.cases.length / size));
      var next = Math.min(Math.max(0, Number(page) || 0), totalPages - 1);
      state.tempExecPages[fileId] = next;
      if (!suppressRender) renderTempExecView();
    }

    function changeTempExecPage(fileId, action) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      var size = getTempExecPageSize();
      var totalPages = Math.max(1, Math.ceil(file.cases.length / size));
      var current = ensureTempExecPageIndex(fileId);
      if (action === 'prev') current -= 1;
      else if (action === 'next') current += 1;
      else if (typeof action === 'number') current = action;
      else return;
      current = Math.min(Math.max(0, current), totalPages - 1);
      state.tempExecPages[fileId] = current;
      renderTempExecView();
      scrollTempExecViewTop();
    }

    function jumpToTempExecCase(fileId, caseIndex, options) {
      var opts = options && typeof options === 'object' ? options : {};
      if (!fileId) return { ok: false, reason: 'missing_file_id' };
      var file = getTempExecFile(fileId);
      if (!file) return { ok: false, reason: 'file_not_found' };
      var idx = Math.floor(Number(caseIndex));
      if (!Number.isFinite(idx) || idx < 0) idx = 0;

      if (opts.clearFilters !== false) {
        var statusFilter = state.tempExecStatusFilter || { fileId: '', status: '' };
        if (statusFilter.fileId === fileId && statusFilter.status) {
          state.tempExecStatusFilter = { fileId: '', status: '' };
        }
        var searchState = state.tempExecSearch || { fileId: '', term: '', raw: '' };
        if (searchState.fileId === fileId && (searchState.term || searchState.raw)) {
          state.tempExecSearch = { fileId: '', term: '', raw: '' };
        }
      }

      if (!state.tempExecPages || typeof state.tempExecPages !== 'object') state.tempExecPages = {};
      var size = getTempExecPageSize();
      if (!Number.isFinite(size) || size <= 0) size = defaultTempExecPageSize;
      var totalCases = Array.isArray(file.cases) ? file.cases.length : 0;
      var totalPages = totalCases ? Math.ceil(totalCases / size) : 1;
      var pageIndex = totalCases ? Math.floor(idx / size) : 0;
      if (!Number.isFinite(pageIndex) || pageIndex < 0) pageIndex = 0;
      if (pageIndex >= totalPages) pageIndex = Math.max(totalPages - 1, 0);
      state.tempExecPages[fileId] = pageIndex;

      setTempExecActive(fileId);
      return { ok: true, fileId: fileId, index: idx, pageIndex: pageIndex, pageSize: size };
    }

    function applyTempExecPageSize(value) {
      var size = clampTempExecPageSize(value);
      var changed = state.tempExecPageSize !== size;
      state.tempExecPageSize = size;
      // Keep settings in sync so cross-device persistence works even when page size
      // is changed from the execution view.
      if (state.settings && typeof state.settings === 'object') {
        state.settings.tempExecPageSize = size;
        try {
          // 仅持久化分页设置，避免覆盖其他设备的设置项。
          persistSettings(['tempExecPageSize']);
        } catch (err) {
          // ignore persistence failures here; UI layer will show status if needed
        }
      }
      saveTempExecPageSizeSetting(size);
      resetTempExecPages();
      if (changed) {
        renderTempExecView();
        scheduleTempExecUiSave();
      }
      return { size: size, changed: changed };
    }

    function ensureTempVersionList() {
      if (!Array.isArray(state.tempExecVersions)) state.tempExecVersions = [];
    }

    function getTempVersion(versionId) {
      if (!versionId) return null;
      ensureTempVersionList();
      return state.tempExecVersions.find(function(item) { return item && item.id === versionId; }) || null;
    }

    function applyVersionAssignments(rawVersions) {
      ensureTempVersionList();
      var fileMap = new Map((state.tempExecFiles || []).map(function(file) { return [file.id, file]; }));
      var seenFiles = new Set();
      var normalized = [];
      (rawVersions || []).forEach(function(ver) {
        if (!ver || typeof ver !== 'object') return;
        var id = ver.id || generateTempVersionId();
        while (normalized.some(function(v) { return v && v.id === id; })) {
          id = generateTempVersionId();
        }
        var name = (ver.name || '').trim() || '未命名版本';
        var fileIds = Array.isArray(ver.fileIds) ? ver.fileIds.filter(function(fid) { return fileMap.has(fid); }) : [];
        var deduped = [];
        fileIds.forEach(function(fid) {
          if (seenFiles.has(fid)) return;
          seenFiles.add(fid);
          deduped.push(fid);
          var file = fileMap.get(fid);
          if (file) file.versionId = id;
        });
        normalized.push({ id: id, name: name, fileIds: deduped });
      });
      (state.tempExecFiles || []).forEach(function(file) {
        if (!seenFiles.has(file.id)) file.versionId = '';
      });
      state.tempExecVersions = normalized;
    }

    function isVersionNameDuplicate(name, excludeId) {
      var normalized = normalizeTempExecName(name);
      if (!normalized) return false;
      return (state.tempExecVersions || []).some(function(ver) {
        if (!ver) return false;
        if (excludeId && ver.id === excludeId) return false;
        return normalizeTempExecName(ver.name) === normalized;
      });
    }

    function buildTempExecCasesFromXmindPaths(paths) {
      var map = new Map();
      var hasResult = false;
      var reuseFound = false;
      if (!Array.isArray(paths) || !paths.length) return { cases: [], hasResult: false, reuseEnabled: false };
      paths.forEach(function(path) {
        if (!Array.isArray(path)) return;
        var clean = path.filter(Boolean);
        if (clean.length < 7) return;
        var trimmed = clean.slice(0);
        if (trimmed.length > 0) trimmed = trimmed.slice(1);
        if (trimmed.length < 6) trimmed = clean.slice(clean.length - 6);
        if (!trimmed || trimmed.length < 6) return;
        var base = trimmed.slice(0, 6);
        var extras = trimmed.slice(6);
        var key = base.join('||');
        if (!map.has(key)) {
          map.set(key, {
            module: base[0] || '',
            title: base[1] || '',
            priority: base[2] || '',
            preconditions: base[3] || '',
            steps: base[4] || '',
            expected: base[5] || '',
            actual: '',
            remark: '',
            reuseDetails: [],
            defectLinks: [],
          });
        }
        var entry = map.get(key);
        if (extras && extras.length) {
          hasResult = true;
          if (extras.length > 1) {
            reuseFound = true;
            entry.reuseDetails = entry.reuseDetails || [];
            entry.reuseDetails.push({
              id: generateReuseDetailId(),
              text: extras[0] || '',
              note: extras.length > 2 ? extras.slice(2).join('；') : '',
              status: extras[1] || '未执行',
              presetId: '',
            });
          } else if (!entry.reuseDetails || !entry.reuseDetails.length) {
            entry.actual = extras[0] || entry.actual || '';
          }
        }
      });
      return {
        cases: Array.from(map.values()),
        hasResult: hasResult,
        reuseEnabled: reuseFound,
      };
    }

    function createTempVersion(name) {
      ensureTempVersionList();
      var trimmed = (name || '').trim();
      if (!trimmed) return null;
      if (isVersionNameDuplicate(trimmed)) {
        if (tempExecStatus) setStatus(tempExecStatus, '版本名称【' + trimmed + '】已存在，请换一个', 'warn');
        window.alert('版本名称【' + trimmed + '】已存在，请换一个');
        return null;
      }
      var version = { id: generateTempVersionId(), name: trimmed, fileIds: [] };
      state.tempExecVersions.push(version);
      var placement = ensureTempExecPlacement();
      placement.versionOrder = placement.versionOrder.filter(function(id) { return id !== version.id; });
      placement.versionOrder.push(version.id);
      persistTempExecState();
      renderTempVersionGrid();
      return version.id;
    }

    function removeTempExecFromVersion(fileId, opts) {
      if (!fileId) return;
      var options = opts || {};
      ensureTempVersionList();
      var file = getTempExecFile(fileId);
      var prevId = file && file.versionId ? file.versionId : '';
      if (prevId) {
        var prev = getTempVersion(prevId);
        if (prev && Array.isArray(prev.fileIds)) {
          prev.fileIds = prev.fileIds.filter(function(id) { return id !== fileId; });
        }
      } else {
        state.tempExecVersions.forEach(function(ver) {
          if (!ver || !Array.isArray(ver.fileIds)) return;
          ver.fileIds = ver.fileIds.filter(function(id) { return id !== fileId; });
        });
      }
      if (file) file.versionId = '';
      if (options.silent) return;
      persistTempExecState();
      renderTempExecNav();
      renderTempVersionGrid();
    }

    function removeTempGroupFromVersion(versionId, ids) {
      var list = Array.isArray(ids) ? ids : String(ids || '').split(',').map(function(id) { return id.trim(); }).filter(Boolean);
      if (!list.length) return;
      list.forEach(function(id) { removeTempExecFromVersion(id, { silent: true }); });
      persistTempExecState();
      renderTempExecNav();
      renderTempVersionGrid();
      renderTempExecView();
    }

    function moveTempExecToVersion(fileIds, versionId) {
      if (!fileIds) return;
      var list = Array.isArray(fileIds) ? fileIds : String(fileIds).split(',').map(function(id) { return id.trim(); }).filter(Boolean);
      if (!list.length) return;
      if (!versionId) {
        list.forEach(function(id) { removeTempExecFromVersion(id); });
        return;
      }
      var version = getTempVersion(versionId);
      if (!version) return;
      if (!Array.isArray(version.fileIds)) version.fileIds = [];
      list.forEach(function(fileId) {
        var file = getTempExecFile(fileId);
        if (!file) return;
        if (file.versionId && file.versionId !== versionId) {
          removeTempExecFromVersion(fileId, { silent: true });
        }
        if (version.fileIds.indexOf(fileId) === -1) version.fileIds.push(fileId);
        file.versionId = versionId;
      });
      persistTempExecState();
      renderTempExecNav();
      renderTempVersionGrid();
      renderTempExecView();
    }

    function getVersionRequirementBlocks(version) {
      if (!version || !Array.isArray(version.fileIds)) return [];
      var fileMap = new Map((state.tempExecFiles || []).map(function(file) { return [file.id, file]; }));
      var counters = Object.create(null);
      var blocks = [];
      var lastReq = '';
      var current = null;
      version.fileIds.forEach(function(fid) {
        var file = fileMap.get(fid);
        if (!file) return;
        var req = normalizeRequirementName(file.requirement) || '未标识需求';
        if (req !== lastReq) {
          counters[req] = (counters[req] || 0) + 1;
          current = {
            key: req + '::' + counters[req],
            req: req,
            ids: [],
          };
          blocks.push(current);
          lastReq = req;
        }
        if (current) current.ids.push(fid);
      });
      return blocks;
    }

    function moveTempExecFileWithinVersion(fileIds, versionId, targetRequirement, beforeId) {
      var version = getTempVersion(versionId);
      var ids = Array.isArray(fileIds) ? fileIds : String(fileIds || '').split(',').map(function(id) { return id.trim(); }).filter(Boolean);
      if (!version || !ids.length) return;
      if (!Array.isArray(version.fileIds)) version.fileIds = [];
      state.tempExecVersions.forEach(function(ver) {
        if (!ver || !Array.isArray(ver.fileIds)) return;
        ver.fileIds = ver.fileIds.filter(function(id) { return ids.indexOf(id) === -1; });
      });
      var targetReq = normalizeRequirementName(targetRequirement) || '';
      ids.forEach(function(fid) {
        var file = getTempExecFile(fid);
        if (!file) return;
        file.versionId = versionId;
        if (targetReq) file.requirement = targetReq;
      });
      var existing = version.fileIds.filter(function(id) { return ids.indexOf(id) === -1; });
      var insertIndex = existing.length;
      if (beforeId && existing.indexOf(beforeId) !== -1) {
        insertIndex = existing.indexOf(beforeId);
      } else if (targetReq) {
        var fileMap = new Map((state.tempExecFiles || []).map(function(item) { return [item.id, item]; }));
        for (var i = 0; i < existing.length; i += 1) {
          var file = fileMap.get(existing[i]);
          var req = normalizeRequirementName(file && file.requirement) || '未标识需求';
          if (req === targetReq) insertIndex = i + 1;
        }
      }
      if (insertIndex < 0) insertIndex = 0;
      if (insertIndex > existing.length) insertIndex = existing.length;
      var nextOrder = existing.slice();
      ids.forEach(function(fid, idx) {
        nextOrder.splice(insertIndex + idx, 0, fid);
      });
      version.fileIds = nextOrder;
      persistTempExecState();
      renderTempExecNav();
      renderTempVersionGrid();
      renderTempExecView();
    }

    function parseReqPayload(text) {
      var parts = (text || '').split('||');
      return {
        req: normalizeRequirementName(parts[0] || '') || '',
        key: parts[1] || '',
        fromVersion: parts[2] || '',
      };
    }

    function reorderVersionRequirement(versionId, sourceKey, targetKey) {
      var version = getTempVersion(versionId);
      if (!version || !Array.isArray(version.fileIds)) return;
      var blocks = getVersionRequirementBlocks(version);
      if (!blocks.length) return;
      var normSource = normalizeRequirementName(sourceKey) || '';
      var normTarget = normalizeRequirementName(targetKey) || '';
      var findIndexByKey = function(list, key, norm) {
        var idx = list.findIndex(function(b) { return b.key === key; });
        if (idx === -1 && norm) idx = list.findIndex(function(b) { return normalizeRequirementName(b.req) === norm; });
        return idx;
      };
      var srcIdx = findIndexByKey(blocks, sourceKey, normSource);
      var tgtIdx = findIndexByKey(blocks, targetKey, normTarget);
      if (srcIdx === -1) return;
      var srcBlock = blocks.splice(srcIdx, 1)[0];
      if (!srcBlock) return;
      var insertIndex = blocks.length;
      if (tgtIdx !== -1) {
        var targetAfterRemoval = srcIdx < tgtIdx ? tgtIdx - 1 : tgtIdx;
        var placeAfter = srcIdx < tgtIdx;
        insertIndex = placeAfter ? targetAfterRemoval + 1 : targetAfterRemoval;
      } else if (targetKey || normTarget) {
        insertIndex = findIndexByKey(blocks, targetKey, normTarget);
        if (insertIndex === -1) insertIndex = blocks.length;
      }
      if (insertIndex < 0) insertIndex = 0;
      if (insertIndex > blocks.length) insertIndex = blocks.length;
      blocks.splice(insertIndex, 0, srcBlock);
      version.fileIds = blocks.flatMap(function(b) { return b.ids; });
      persistTempExecState();
      renderTempVersionGrid();
    }

    function moveRequirementToVersion(requirement, versionId, beforeKey) {
      var version = getTempVersion(versionId);
      if (!version) return;
      var req = normalizeRequirementName(requirement) || '未标识需求';
      var candidates = (state.tempExecFiles || []).filter(function(file) {
        var name = normalizeRequirementName(file && file.requirement) || '未标识需求';
        return name === req;
      });
      if (!candidates.length) return;
      candidates.forEach(function(file) {
        if (file.versionId && file.versionId !== versionId) {
          removeTempExecFromVersion(file.id, { silent: true });
        }
      });
      if (!Array.isArray(version.fileIds)) version.fileIds = [];
      var blocks = getVersionRequirementBlocks(version);
      var remainingBlocks = blocks.filter(function(block) { return normalizeRequirementName(block.req) !== req; });
      var count = blocks.filter(function(block) { return normalizeRequirementName(block.req) === req; }).length;
      var fileOrder = ensureFileOrder(req, candidates.map(function(file) { return file.id; }));
      var ids = fileOrder.filter(function(id) { return candidates.some(function(f) { return f.id === id; }); });
      var newKey = req + '::' + (count + 1);
      var newBlock = { req: req, key: newKey, ids: ids };
      var insertIndex = remainingBlocks.length;
      if (beforeKey) {
        var idx = remainingBlocks.findIndex(function(b) { return b.key === beforeKey || normalizeRequirementName(b.req) === normalizeRequirementName(beforeKey); });
        if (idx !== -1) insertIndex = idx;
      }
      remainingBlocks.splice(insertIndex, 0, newBlock);
      version.fileIds = remainingBlocks.reduce(function(acc, block) { return acc.concat(block.ids); }, []);
      candidates.forEach(function(file) {
        file.versionId = versionId;
      });
      persistTempExecState();
      renderTempExecNav();
      renderTempVersionGrid();
      renderTempExecView();
    }

    function moveRequirementOutOfVersion(versionId, requirement, targetRequirement) {
      var version = getTempVersion(versionId);
      if (!version || !Array.isArray(version.fileIds)) return;
      var srcReq = normalizeRequirementName(requirement) || '未标识需求';
      var tgtReq = normalizeRequirementName(targetRequirement) || srcReq;
      var fileMap = new Map((state.tempExecFiles || []).map(function(file) { return [file.id, file]; }));
      var remaining = [];
      version.fileIds.forEach(function(fid) {
        var file = fileMap.get(fid);
        if (!file) return;
        var req = normalizeRequirementName(file.requirement) || '未标识需求';
        if (req === srcReq) {
          file.versionId = '';
          file.requirement = tgtReq;
          insertFileIntoOrder(tgtReq, file.id);
        } else {
          remaining.push(fid);
        }
      });
      version.fileIds = remaining;
      ensureRequirementOrder((state.tempExecFiles || []).map(function(f) { return normalizeRequirementName(f && f.requirement) || '未标识需求'; }));
      ensureFileOrder(tgtReq, (state.tempExecFiles || [])
        .filter(function(f) { return (normalizeRequirementName(f && f.requirement) || '未标识需求') === tgtReq; })
        .map(function(f) { return f.id; }));
      if (targetRequirement) {
        reorderRequirementOrder(tgtReq, targetRequirement);
      }
      persistTempExecState();
      renderTempExecNav();
      renderTempVersionGrid();
      renderTempExecView();
    }

    function removeTempVersion(versionId) {
      if (!versionId) return;
      var version = getTempVersion(versionId);
      if (!version) return;
      var confirmed = window.confirm('确定删除版本【' + (version.name || '') + '】？版本内的用例会回到需求盒子区。');
      if (!confirmed) return;
      var fileSet = new Set(Array.isArray(version.fileIds) ? version.fileIds : []);
      (state.tempExecFiles || []).forEach(function(file) {
        if (fileSet.has(file.id)) file.versionId = '';
      });
      state.tempExecVersions = (state.tempExecVersions || []).filter(function(ver) { return ver && ver.id !== versionId; });
      var placement = ensureTempExecPlacement();
      placement.versionOrder = placement.versionOrder.filter(function(id) { return id !== versionId; });
      persistTempExecState();
      renderTempExecNav();
      renderTempVersionGrid();
    }

    function reorderTempVersion(sourceId, targetId) {
      var placement = ensureTempExecPlacement();
      var src = sourceId || '';
      var tgt = targetId || '';
      if (!src || src === tgt) return;
      ensureVersionOrder((state.tempExecVersions || []).map(function(ver) { return ver.id; }));
      placement.versionOrder = placement.versionOrder.filter(function(id) { return id !== src; });
      var idx = placement.versionOrder.indexOf(tgt);
      if (idx === -1) placement.versionOrder.push(src);
      else placement.versionOrder.splice(idx, 0, src);
      persistTempExecState();
      renderTempVersionGrid();
    }

    function renameTempVersion(versionId) {
      var version = getTempVersion(versionId);
      if (!version) return;
      var nextName = window.prompt('请输入新的版本名称', version.name || '');
      if (nextName === null) return;
      var trimmed = (nextName || '').trim();
      if (!trimmed) {
        if (tempExecStatus) setStatus(tempExecStatus, '版本名称不能为空', 'warn');
        return;
      }
      if (isVersionNameDuplicate(trimmed, versionId)) {
        if (tempExecStatus) setStatus(tempExecStatus, '版本名称【' + trimmed + '】已存在，请换一个', 'warn');
        window.alert('版本名称【' + trimmed + '】已存在，请换一个');
        return;
      }
      version.name = trimmed;
      persistTempExecState();
      renderTempVersionGrid();
      if (tempExecStatus) setStatus(tempExecStatus, '版本名称已更新', 'ok');
    }

    function getTempVersionName(versionId) {
      if (!versionId) return '';
      var ver = getTempVersion(versionId);
      return ver && ver.name ? ver.name : '';
    }

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
      window.open(targetUrl, '_blank');
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
      if (typeof document === 'undefined') return null;
      var active = document.activeElement;
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
      if (typeof input.focus === 'function') input.focus();
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

    function buildTempExecTag(file, isFocused) {
      if (isFocused) return '<span class="tag tag-focus">专注</span>';
      if (file && file.reuseEnabled) {
        return '<span class="tag tag-reuse">复</span>';
      }
      return '';
    }

    function getTempExecFileCaseCount(file) {
      if (!file) return 0;
      if (Array.isArray(file.cases) && file.cases.length) return file.cases.length;
      var fallback = file.caseCount;
      if (fallback === null || fallback === undefined) fallback = file.case_count;
      if (fallback === null || fallback === undefined) fallback = file.itemCount;
      if (fallback === null || fallback === undefined) fallback = file.item_count;
      var num = Number(fallback);
      if (!Number.isFinite(num) || num < 0) return 0;
      return Math.round(num);
    }

    function renderTempExecItemRow(file, options) {
      var opts = options || {};
      var isArchived = Boolean(file && String(file.status || '') === 'archived');
      var active = opts.activeId === file.id ? 'active' : '';
      var focusSet = opts.focusSet || new Set();
      var stateClass = resolveTempExecState(file);
      var tagHtml = buildTempExecTag(file, focusSet.has(file.id));
      var removeHtml = (opts.hideRemove || isArchived) ? '' : '<span class="remove" title="删除" data-temp-remove="' + file.id + '">×</span>';
      var reqKey = normalizeRequirementName(file && file.requirement) || '未标识需求';
      var archivedMask = isArchived ? '<div class="temp-archived-mask">已归档</div>' : '';
      return (
        '<div class="temp-req-row ' + stateClass + (isArchived ? ' archived' : '') + '" data-temp-file="' + file.id + '" data-temp-req="' + reqKey + '"' + (isArchived ? ' data-temp-archived="1"' : '') + ' draggable="' + (isArchived ? 'false' : 'true') + '">' +
          tagHtml +
          '<span class="temp-req-count-badge">' + getTempExecFileCaseCount(file) + ' 条</span>' +
          '<button type="button" data-temp-file="' + file.id + '"' + (isArchived ? ' data-temp-archived="1"' : '') + ' class="temp-req-item ' + active + '" draggable="' + (isArchived ? 'false' : 'true') + '">' +
            '<div class="temp-req-line">' +
              '<span class="name" title="' + escapeHtml(file && file.name ? file.name : '测试用例') + '"><span class="name-text">' + escapeHtml(file && file.name ? file.name : '测试用例') + '</span></span>' +
            '</div>' +
            removeHtml +
          '</button>' +
          archivedMask +
        '</div>'
      );
    }

    function renderTempVersionGrid() {
      if (!tempVersionGrid) return;
      if (isTempExecProjectLayoutEnabled()) {
        renderTempProjectGrid();
        return;
      }
      ensureTempVersionList();
      syncTempSectionToggleButtons();
      if (state.tempExecVersionCollapsed) {
        tempVersionGrid.classList.add('collapsed');
        tempVersionGrid.innerHTML = '<span class="hint">版本区已收起，点击“展开版本区”查看</span>';
        return;
      }
      tempVersionGrid.classList.remove('collapsed');
      if (!state.tempExecVersions.length) {
        tempVersionGrid.innerHTML = '<span class="hint">暂无版本，点击“新建版本”创建</span>';
        return;
      }
      var placement = ensureTempExecPlacement();
      var orderedIds = ensureVersionOrder(state.tempExecVersions.map(function(ver) { return ver.id; }));
      var versions = state.tempExecVersions.slice().sort(function(a, b) {
        var ia = orderedIds.indexOf(a.id);
        var ib = orderedIds.indexOf(b.id);
        if (ia === -1 && ib === -1) return (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN');
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
      var fileMap = new Map(state.tempExecFiles.map(function(file) { return [file.id, file]; }));
      var focusSet = new Set(state.tempExecFocus || []);
      var cards = versions.map(function(ver) {
        var name = (ver && ver.name ? ver.name : '').trim() || '未命名版本';
        var fileList = Array.isArray(ver && ver.fileIds)
          ? ver.fileIds.map(function(fid) { return fileMap.get(fid); }).filter(Boolean)
          : [];
        var reqBlocks = getVersionRequirementBlocks(ver);
        var body = reqBlocks.length
          ? reqBlocks.map(function(block) {
              var ids = block.ids.join(',');
              var reqRows = block.ids.map(function(fid) {
                var file = fileMap.get(fid);
                if (!file) return '';
                return renderTempExecItemRow(file, {
                  focusSet: focusSet,
                  activeId: state.tempExecActiveId,
                  hideRemove: true,
                });
              }).join('');
              return (
                '<div class="temp-req-box" data-temp-req="' + block.req + '" data-temp-req-key="' + block.key + '" data-temp-file-group="' + ids + '" data-temp-version-group="' + ver.id + '" draggable="true">' +
                  '<div class="temp-req-header">' +
                    '<span class="temp-req-title">' + escapeHtml(block.req) + '</span>' +
                    '<div class="temp-req-actions">' +
                      '<span class="temp-req-count">' + block.ids.length + ' 份</span>' +
                      '<span class="box-remove" title="移出版本" data-temp-group-remove="' + ver.id + '" data-temp-group-ids="' + ids + '">×</span>' +
                    '</div>' +
                  '</div>' +
                  '<div class="temp-req-list">' + reqRows + '</div>' +
                '</div>'
              );
            }).join('')
          : '<span class="placeholder">拖拽需求盒子到此</span>';
        return (
          '<div class="temp-version-card" data-temp-version="' + ver.id + '">' +
            '<div class="header">' +
              '<span class="title" title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</span>' +
              '<div class="version-actions">' +
                '<button class="chip" type="button" data-temp-version-rename="' + ver.id + '" title="重命名">重命名</button>' +
                '<span class="remove" data-temp-version-remove="' + ver.id + '" title="删除版本">×</span>' +
              '</div>' +
            '</div>' +
            '<div class="temp-version-body">' + body + '</div>' +
          '</div>'
        );
      }).join('');
      tempVersionGrid.innerHTML = cards;
      enforceTempFileDraggable(tempVersionGrid);
    }

    function normalizeTempExecImportProjectFilterId(raw) {
      var pid = raw === null || raw === undefined ? '' : String(raw);
      if (!pid) return '';
      var list = Array.isArray(state.projects) ? state.projects : [];
      if (list.length) {
        var ok = list.some(function(project) { return project && String(project.id) === pid; });
        return ok ? pid : '';
      }
      var files = Array.isArray(state.tempExecFiles) ? state.tempExecFiles : [];
      var ok2 = files.some(function(file) { return file && file.projectId && String(file.projectId) === pid; });
      return ok2 ? pid : '';
    }

    function getTempExecImportProjectFilterProjectIds(fallbackIds) {
      var list = Array.isArray(state.projects) ? state.projects : [];
      if (list.length) {
        var utils = window.app && window.app.utils ? window.app.utils : {};
        var globalState = window.app && window.app.state ? window.app.state : {};
        if (utils && typeof utils.sortProjectsByUserSettings === 'function') {
          list = utils.sortProjectsByUserSettings(list, globalState);
        }
      }
      var ids = list
        .map(function(project) { return project && project.id !== null && project.id !== undefined ? String(project.id) : ''; })
        .filter(Boolean);
      if (ids.length) return ids;
      return Array.isArray(fallbackIds) ? fallbackIds.slice() : [];
    }

    function renderTempExecImportProjectFilterBlock(projectIds, activeProjectId) {
      var list = Array.isArray(projectIds) ? projectIds : [];
      if (!list.length) return '';
      var active = activeProjectId ? String(activeProjectId) : '';
      var icon =
        '<span class="nav-entry-icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" role="presentation" focusable="false">' +
            '<path d="M3 6h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"></path>' +
          '</svg>' +
        '</span>';
      var allCls = 'nav-entry-card nav-entry-overview' + (!active ? ' active' : '');
      var allBtn =
        '<button type="button" class="' + allCls + '" data-tempexec-import-project-filter="" data-tempexec-import-project-filter-all="1">' +
          icon +
          '<span class="nav-entry-text">' +
            '<span class="nav-entry-title">全部项目</span>' +
            '<span class="nav-entry-desc">显示所有项目分组</span>' +
          '</span>' +
        '</button>';
      var cards = list.map(function(pid) {
        var name = resolveProjectName(pid);
        var cls = 'nav-entry-card nav-entry-overview' + (String(pid) === String(active) ? ' active' : '');
        return (
          '<button type="button" class="' + cls + '" data-tempexec-import-project-filter="' + escapeHtml(pid) + '">' +
            icon +
            '<span class="nav-entry-text">' +
              '<span class="nav-entry-title">' + escapeHtml(name) + '</span>' +
              '<span class="nav-entry-desc">仅展示该项目分组</span>' +
            '</span>' +
          '</button>'
        );
      }).join('');
      return (
        '<div class="tempexec-project-filter">' +
          '<div class="tempexec-project-filter-title">项目</div>' +
          '<div class="nav-entry-grid tempexec-project-filter-grid">' + allBtn + cards + '</div>' +
        '</div>'
      );
    }

    function renderTempProjectGrid() {
      if (!tempVersionGrid) return;
      syncTempSectionToggleButtons();

      if (state.tempExecVersionCollapsed) {
        tempVersionGrid.classList.add('collapsed');
        tempVersionGrid.innerHTML = '<span class="hint">项目区已收起，点击“展开项目区”查看</span>';
        return;
      }
      tempVersionGrid.classList.remove('collapsed');

      var activeFiles = Array.isArray(state.tempExecFiles) ? state.tempExecFiles.slice() : [];
      activeFiles = activeFiles.filter(function(file) { return file && file.projectId; });
      // 已归档执行集：作为“占位”渲染在版本盒子底部（用于避免“全部归档导致版本盒子消失无法关闭/解散”）
      var archivedFiles = Array.isArray(state.tempExecArchivedFiles) ? state.tempExecArchivedFiles.slice() : [];
      archivedFiles = archivedFiles.filter(function(file) { return file && file.projectId; });
      var files = activeFiles.concat(archivedFiles);
      var activeFilterProjectId = normalizeTempExecImportProjectFilterId(state.tempExecImportProjectFilterId);
      state.tempExecImportProjectFilterId = activeFilterProjectId;

      var focusSet = new Set(state.tempExecFocus || []);
      var activeFileMap = new Map(activeFiles.map(function(file) { return [String(file.id), file]; }));
      var archivedFileMap = new Map(archivedFiles.map(function(file) { return [String(file.id), file]; }));

      if (!files.length) {
        var emptyFilterProjectIds = getTempExecImportProjectFilterProjectIds([]);
        var emptyFilterBlock = renderTempExecImportProjectFilterBlock(emptyFilterProjectIds, activeFilterProjectId);
        tempVersionGrid.innerHTML = emptyFilterBlock + '<span class="hint">暂无用例，导入用例后会按项目与版本自动分组</span>';
        return;
      }

      var projectMeta = new Map();
      var projectIdSet = new Set();
      files.forEach(function(file) {
        var pid = file && file.projectId ? String(file.projectId) : '';
        if (!pid) return;
        projectIdSet.add(pid);
        var ts = Number(file && (file.archivedAt || file.createdAt)) || 0;
        if (!Number.isFinite(ts)) ts = 0;
        var prev = projectMeta.has(pid) ? Number(projectMeta.get(pid) || 0) : 0;
        if (ts > prev) projectMeta.set(pid, ts);
      });
      var orderedProjects = ensureProjectOrder(Array.from(projectIdSet.values()), projectMeta);
      var filterProjectIds = getTempExecImportProjectFilterProjectIds(orderedProjects);
      var filterBlockHtml = renderTempExecImportProjectFilterBlock(filterProjectIds, activeFilterProjectId);

      var visibleProjects = activeFilterProjectId
        ? orderedProjects.filter(function(pid) { return String(pid) === String(activeFilterProjectId); })
        : orderedProjects.slice();
      if (!visibleProjects.length) {
        tempVersionGrid.innerHTML = filterBlockHtml + '<span class="hint">当前项目暂无用例，可切换其他项目或继续导入</span>';
        return;
      }

      var html = visibleProjects.map(function(pid) {
        var projectFiles = files.filter(function(file) { return file && String(file.projectId) === pid; });
        var versionMap = new Map();
        var versionMeta = new Map();
        projectFiles.forEach(function(file) {
          var vid = file && file.versionId !== null && file.versionId !== undefined ? String(file.versionId || '') : '';
          if (!versionMap.has(vid)) versionMap.set(vid, []);
          versionMap.get(vid).push(file);
          var ts = Number(file && (file.archivedAt || file.createdAt)) || 0;
          if (!Number.isFinite(ts)) ts = 0;
          var prev = versionMeta.has(vid) ? Number(versionMeta.get(vid) || 0) : 0;
          if (ts > prev) versionMeta.set(vid, ts);
        });
        var orderedVersions = ensureProjectVersionOrder(pid, Array.from(versionMap.keys()), versionMeta);

        var versionsHtml = orderedVersions.map(function(vid) {
          var list = versionMap.get(vid) || [];
          var archivedList = list.filter(function(file) { return file && String(file.status || '') === 'archived'; });
          var activeList = list.filter(function(file) { return file && String(file.status || '') !== 'archived'; });

          // 排序规则：
          // - 未归档：沿用用户自定义顺序（placement.fileOrderByProjectVersion）与最近更新时间补齐
          // - 已归档：固定在版本盒子底部，按“最近归档时间”倒序（最近归档在上）
          var fileMeta = new Map();
          activeList.forEach(function(file) {
            var ts = Number(file && file.createdAt) || 0;
            if (!Number.isFinite(ts)) ts = 0;
            fileMeta.set(String(file.id), ts);
          });
          var orderedActiveIds = ensureProjectVersionFileOrder(pid, vid, activeList.map(function(file) { return String(file.id); }), fileMeta);
          var orderedActiveFiles = orderedActiveIds
            .map(function(id) { return activeFileMap.get(id); })
            .filter(function(file) { return file && String(file.projectId) === pid && String(file.versionId || '') === String(vid || ''); });

          archivedList = archivedList.slice().sort(function(a, b) {
            var ta = Number(a && (a.archivedAt || a.createdAt)) || 0;
            var tb = Number(b && (b.archivedAt || b.createdAt)) || 0;
            if (ta !== tb) return tb - ta;
            return String(a && a.id ? a.id : '').localeCompare(String(b && b.id ? b.id : ''), 'zh-Hans-CN');
          });
          var orderedArchivedFiles = archivedList
            .map(function(file) { return archivedFileMap.get(String(file.id)); })
            .filter(Boolean);

          var orderedFiles = orderedActiveFiles.concat(orderedArchivedFiles);

          var rows = orderedFiles.length
            ? orderedFiles.map(function(file) {
                return renderTempExecItemRow(file, {
                  focusSet: focusSet,
                  activeId: state.tempExecActiveId,
                });
              }).join('')
            : '<span class="hint">暂无用例</span>';

          var versionName = resolveVersionName(pid, vid);
          var archivedCount = orderedArchivedFiles.length;
          var dissolveBtn = archivedCount
            ? (
              '<button type="button" class="archived-dissolve" data-temp-project-version-archived-dissolve="' + escapeHtml(pid + '||' + vid) + '" title="仅清除已归档占位，不影响归档记录">' +
                '解散归档' +
              '</button>'
            )
            : '';
          var actionsHtml = (
            '<span class="temp-project-version-actions">' +
              dissolveBtn +
              '<span class="remove" title="关闭版本" data-temp-project-version-remove="' + escapeHtml(pid + '||' + vid) + '">×</span>' +
            '</span>'
          );
          return (
            '<div class="temp-project-version" data-temp-project-version-card="' + escapeHtml(pid + '||' + vid) + '">' +
              '<div class="temp-project-version-header" data-temp-project-version-drag="' + escapeHtml(pid + '||' + vid) + '" draggable="true">' +
                '<span class="title" title="' + escapeHtml(versionName) + '">' + escapeHtml(versionName) + '</span>' +
                actionsHtml +
              '</div>' +
              '<div class="temp-project-version-body">' + rows + '</div>' +
            '</div>'
          );
        }).join('');

        var projectName = resolveProjectName(pid);
        return (
          '<div class="temp-project-card" data-temp-project-card="' + escapeHtml(pid) + '">' +
            '<div class="temp-project-header" data-temp-project-drag="' + escapeHtml(pid) + '" draggable="true">' +
              '<span class="title" title="' + escapeHtml(projectName) + '">' + escapeHtml(projectName) + '</span>' +
              '<span class="remove" title="关闭项目" data-temp-project-remove="' + escapeHtml(pid) + '">×</span>' +
            '</div>' +
            '<div class="temp-project-body">' +
              '<div class="temp-project-versions">' + versionsHtml + '</div>' +
            '</div>' +
          '</div>'
        );
      }).join('');

      tempVersionGrid.innerHTML = filterBlockHtml + html;
      enforceTempFileDraggable(tempVersionGrid);
    }

    function enforceTempFileDraggable(root) {
      if (!root) return;
      var list = root.querySelectorAll('[data-temp-file], [data-temp-file-group]');
      list.forEach(function(el) {
        if (el && el.dataset && String(el.dataset.tempArchived || '') === '1') return;
        if (!el.getAttribute('draggable')) {
          el.setAttribute('draggable', 'true');
        }
      });
    }

    function isRequiredTempExecColumn(key) {
      return key === 'select' || key === 'title' || key === 'actual' || key === 'remark' || key === 'defect' || key === 'ops';
    }

    function scrollTempExecViewTop() {
      var target = tempExecView || tempExecViewSection;
      if (target) scrollElementIntoView(target, 'smooth', 140);
    }

    function ensureReusePresets(file) {
      if (!file) return [];
      if (!Array.isArray(file.reusePresets)) file.reusePresets = [];
      return file.reusePresets;
    }

    function buildReuseDetailsFromPresets(file) {
      if (!file || !file.reuseEnabled) return [];
      var presets = ensureReusePresets(file);
      if (!presets.length) return [];
      return presets.map(function(preset) {
        return {
          id: generateReuseDetailId(),
          text: preset && preset.text ? preset.text : '',
          note: '',
          status: '未执行',
          presetId: preset && preset.id ? preset.id : '',
          removed: false,
        };
      });
    }

    function startTempExecPresetDraft(fileId) {
      state.tempExecPresetDraft = { fileId: fileId, value: '' };
      renderTempExecView();
    }

    function cancelTempExecPresetDraft() {
      state.tempExecPresetDraft = null;
      renderTempExecView();
    }

    function updateTempExecPresetDraft(value) {
      if (!state.tempExecPresetDraft) return;
      state.tempExecPresetDraft.value = value;
    }

    function applyPresetToCases(file, preset) {
      if (!file || !preset) return;
      file.cases.forEach(function(caseItem) {
        if (!caseItem) return;
        if (!Array.isArray(caseItem.reuseDetails)) caseItem.reuseDetails = [];
        var exists = caseItem.reuseDetails.some(function(detail) { return detail && detail.presetId === preset.id; });
        if (!exists) {
          caseItem.reuseDetails.push({
            id: generateReuseDetailId(),
            text: preset.text,
            note: '',
            status: '未执行',
            presetId: preset.id,
            removed: false,
          });
        }
      });
    }

    function applyPresetsToCase(file, caseItem) {
      if (!file || !caseItem) return false;
      if (!file.reuseEnabled) return false;
      var presets = ensureReusePresets(file);
      if (!presets.length) return false;
      if (!Array.isArray(caseItem.reuseDetails)) caseItem.reuseDetails = [];
      var changed = false;
      presets.forEach(function(preset) {
        if (!preset || !preset.id) return;
        var exists = caseItem.reuseDetails.some(function(detail) { return detail && detail.presetId === preset.id; });
        if (!exists) {
          caseItem.reuseDetails.push({
            id: generateReuseDetailId(),
            text: preset.text || '',
            note: '',
            status: '未执行',
            presetId: preset.id,
            removed: false,
          });
          changed = true;
        }
      });
      return changed;
    }

    function removePresetFromCases(file, presetId) {
      if (!file || !presetId) return;
      file.cases.forEach(function(caseItem) {
        if (!caseItem || !Array.isArray(caseItem.reuseDetails)) return;
        caseItem.reuseDetails = caseItem.reuseDetails.filter(function(detail) { return detail && detail.presetId !== presetId; });
      });
    }

    function confirmTempExecPresetDraft(fileId) {
      var draft = state.tempExecPresetDraft;
      if (!draft || !draft.value || draft.value.trim() === '') {
        if (tempExecStatus) setStatus(tempExecStatus, '请先输入复用预设内容', 'warn');
        return;
      }
      var file = getTempExecFile(fileId);
      if (!file) return;
      var presets = ensureReusePresets(file);
      var exists = presets.some(function(item) { return item && item.text === draft.value; });
      if (exists) {
        if (tempExecStatus) setStatus(tempExecStatus, '已存在相同的预设子项', 'warn');
        return;
      }
      var preset = { id: generateReusePresetId(), text: draft.value };
      presets.push(preset);
      applyPresetToCases(file, preset);
      state.tempExecPresetDraft = null;
      if (isDbMode()) {
        var execSetId = file.execSetId || Number(file.id);
        if (execSetId) {
          queueExecSetPatch(execSetId, { reuse_presets: file.reusePresets || [], reuse_enabled: Boolean(file.reuseEnabled) });
        }
        (file.cases || []).forEach(function(item) {
          if (!item) return;
          queueExecCasePatchForItem(item, { reuse_details: item.reuseDetails || [] });
        });
      }
      persistTempExecState();
      renderTempExecView();
    }

    function renameTempExecPreset(fileId, presetId, nextText) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      var presets = ensureReusePresets(file);
      var target = presets.find(function(item) { return item && item.id === presetId; });
      if (!target) return;
      var trimmed = (nextText || '').trim();
      if (!trimmed) {
        if (tempExecStatus) setStatus(tempExecStatus, '预设子项内容不能为空', 'warn');
        return;
      }
      if (target.text === trimmed) return;
      var exists = presets.some(function(item) { return item && item.id !== presetId && item.text === trimmed; });
      if (exists) {
        if (tempExecStatus) setStatus(tempExecStatus, '已存在相同的预设子项', 'warn');
        return;
      }
      var oldText = target.text || '';
      target.text = trimmed;
      (file.cases || []).forEach(function(caseItem) {
        if (!caseItem || !Array.isArray(caseItem.reuseDetails)) return;
        caseItem.reuseDetails.forEach(function(detail) {
          if (!detail) return;
          if (detail.text === oldText) detail.text = trimmed;
        });
      });
      if (isDbMode()) {
        var execSetId = file.execSetId || Number(file.id);
        if (execSetId) {
          queueExecSetPatch(execSetId, { reuse_presets: file.reusePresets || [], reuse_enabled: Boolean(file.reuseEnabled) });
        }
        (file.cases || []).forEach(function(item) {
          if (!item) return;
          queueExecCasePatchForItem(item, { reuse_details: item.reuseDetails || [] });
        });
      }
      persistTempExecState();
      renderTempExecView();
    }

    function removeTempExecPreset(fileId, presetId) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      var presets = ensureReusePresets(file);
      var before = presets.length;
      file.reusePresets = presets.filter(function(item) { return item && item.id !== presetId; });
      if (before !== file.reusePresets.length) {
        removePresetFromCases(file, presetId);
        if (isDbMode()) {
          var execSetId = file.execSetId || Number(file.id);
          if (execSetId) {
            queueExecSetPatch(execSetId, { reuse_presets: file.reusePresets || [], reuse_enabled: Boolean(file.reuseEnabled) });
          }
          (file.cases || []).forEach(function(item) {
            if (!item) return;
            queueExecCasePatchForItem(item, { reuse_details: item.reuseDetails || [] });
          });
        }
        persistTempExecState();
        renderTempExecView();
      }
    }

    function resolveTempExecState(file) {
      if (!file || !Array.isArray(file.cases)) return 'pending';
      var summary = buildTempExecSummary(file);
      var total = summary.total || 0;
      var completionCount = summary.passed + summary.unspecified;
      var hasFailure = summary.failed > 0 || summary.blocked > 0;
      if (total && completionCount === total && !hasFailure) return 'ok';
      // 只要存在失败/阻塞，就用红色标识（不要求“全部执行完”），方便在项目/版本盒子里快速定位风险用例。
      if (hasFailure) return 'err';
      if (summary.executed > 0) return 'running';
      return 'pending';
    }

    function updateTempExecFileStateClass(fileId) {
      if (!fileId) return;
      var file = getTempExecFile(fileId);
      if (!file) return;
      var stateClass = resolveTempExecState(file);
      var known = ['ok', 'err', 'warn', 'running', 'pending'];
      function patchRoot(root) {
        if (!root || !root.querySelectorAll) return;
        var nodes = root.querySelectorAll('.temp-req-row[data-temp-file="' + String(fileId) + '"]');
        Array.prototype.slice.call(nodes || []).forEach(function(node) {
          if (!node || !node.classList) return;
          known.forEach(function(cls) { node.classList.remove(cls); });
          node.classList.add(stateClass);
        });
      }
      patchRoot(tempVersionGrid);
      patchRoot(tempExecNav);
    }

    function getCaseExecutionStatus(file, caseItem) {
      if (!file || !caseItem) return '未执行';
      // 系统态：后端可能标记为“变更重跑/有改动”，该状态统计与过滤均按“未执行”处理。
      var raw = caseItem.actual || '未执行';
      try { raw = String(raw).trim(); } catch (err) { raw = raw || '未执行'; }
      if (raw === 'pending') raw = '未执行';
      if (raw === '变更重跑' || raw === '有改动') return '未执行';
      if (!file.reuseEnabled) return raw;
      return resolveReuseAggregateStatus(caseItem.reuseDetails);
    }

    function aggregateReuseDetails(details) {
      var stats = { pending: 0, passed: 0, failed: 0, blocked: 0, unspecified: 0 };
      if (!Array.isArray(details)) return stats;
      details.forEach(function(detail) {
        if (!detail) return;
        if (isReuseDetailRemoved(detail)) return;
        var status = detail.status || '未执行';
        try { status = String(status).trim(); } catch (err) { status = status || '未执行'; }
        if (status === '通过') stats.passed += 1;
        else if (status === '失败') stats.failed += 1;
        else if (status === '阻塞') stats.blocked += 1;
        else if (status === '不适用') stats.unspecified += 1;
        else stats.pending += 1;
      });
      return stats;
    }

    function resolveReuseAggregateStatus(details) {
      var aggregate = aggregateReuseDetails(details);
      var total = aggregate.passed + aggregate.failed + aggregate.blocked + aggregate.unspecified + aggregate.pending;
      if (!total) return '未执行';
      if (aggregate.failed) return '失败';
      if (aggregate.blocked) return '阻塞';
      if (aggregate.pending) return '未执行';
      if (aggregate.passed) return '通过';
      if (aggregate.unspecified && !aggregate.passed) return '不适用';
      return '未执行';
    }

    function buildTempExecSummary(file) {
      var summary = { total: 0, executed: 0, passed: 0, failed: 0, blocked: 0, unspecified: 0, pending: 0 };
      if (!file || !Array.isArray(file.cases)) return summary;
      summary.total = file.cases.length;
      file.cases.forEach(function(item) {
        var status = getCaseExecutionStatus(file, item);
        if (status !== '未执行') summary.executed += 1;
        if (status === '通过') summary.passed += 1;
        else if (status === '失败') summary.failed += 1;
        else if (status === '阻塞') summary.blocked += 1;
        else if (status === '不适用') summary.unspecified += 1;
        else summary.pending += 1;
      });
      return summary;
    }

    function getTempExecOrderedFileIds() {
      var files = Array.isArray(state.tempExecFiles) ? state.tempExecFiles.slice() : [];
      if (!files.length) return [];
      var ordered = [];
      var added = new Set();
      if (isTempExecProjectLayoutEnabled()) {
        var projectMeta = new Map();
        var projectIdSet = new Set();
        var fallbackFiles = [];
        files.forEach(function(file) {
          if (!file) return;
          var pid = file && file.projectId ? String(file.projectId) : '';
          if (!pid) {
            fallbackFiles.push(file);
            return;
          }
          projectIdSet.add(pid);
          var ts = Number(file && file.createdAt) || 0;
          var prev = projectMeta.has(pid) ? Number(projectMeta.get(pid) || 0) : 0;
          if (ts > prev) projectMeta.set(pid, ts);
        });
        var orderedProjects = ensureProjectOrder(Array.from(projectIdSet.values()), projectMeta);
        orderedProjects.forEach(function(pid) {
          var projectFiles = files.filter(function(file) { return file && String(file.projectId || '') === String(pid); });
          if (!projectFiles.length) return;
          var versionMap = new Map();
          var versionMeta = new Map();
          projectFiles.forEach(function(file) {
            var vid = file && file.versionId !== null && file.versionId !== undefined ? String(file.versionId || '') : '';
            if (!versionMap.has(vid)) versionMap.set(vid, []);
            versionMap.get(vid).push(file);
            var ts = Number(file && file.createdAt) || 0;
            var prev = versionMeta.has(vid) ? Number(versionMeta.get(vid) || 0) : 0;
            if (ts > prev) versionMeta.set(vid, ts);
          });
          var orderedVersions = ensureProjectVersionOrder(pid, Array.from(versionMap.keys()), versionMeta);
          orderedVersions.forEach(function(vid) {
            var list = versionMap.get(vid) || [];
            if (!list.length) return;
            var fileMeta = new Map();
            list.forEach(function(file) {
              var fid = file && file.id !== null && file.id !== undefined ? String(file.id) : '';
              if (!fid) return;
              var ts = Number(file && file.createdAt) || 0;
              fileMeta.set(fid, ts);
            });
            var orderedIds = ensureProjectVersionFileOrder(
              pid,
              vid,
              list
                .map(function(file) { return file && file.id !== null && file.id !== undefined ? String(file.id) : ''; })
                .filter(Boolean),
              fileMeta
            );
            orderedIds.forEach(function(fid) {
              if (!fid || added.has(fid)) return;
              added.add(fid);
              ordered.push(fid);
            });
          });
        });
        if (fallbackFiles.length) {
          fallbackFiles
            .slice()
            .sort(function(a, b) {
              var ta = Number(a && a.createdAt) || 0;
              var tb = Number(b && b.createdAt) || 0;
              if (ta !== tb) return tb - ta;
              var na = a && a.name ? String(a.name) : '';
              var nb = b && b.name ? String(b.name) : '';
              return na.localeCompare(nb, 'zh-Hans-CN');
            })
            .forEach(function(file) {
              var fid = file && file.id !== null && file.id !== undefined ? String(file.id) : '';
              if (!fid || added.has(fid)) return;
              added.add(fid);
              ordered.push(fid);
            });
        }
      } else {
        var reqMap = new Map();
        files.forEach(function(file) {
          if (!file) return;
          var req = normalizeRequirementName(file && file.requirement) || '未标识需求';
          if (!reqMap.has(req)) reqMap.set(req, []);
          reqMap.get(req).push(file);
        });
        var reqOrderList = ensureRequirementOrder(Array.from(reqMap.keys()));
        reqOrderList.forEach(function(req) {
          var list = reqMap.get(req) || [];
          var orderedIds = ensureFileOrder(
            req,
            list.map(function(file) { return file && file.id !== null && file.id !== undefined ? String(file.id) : ''; }).filter(Boolean)
          );
          orderedIds.forEach(function(fid) {
            if (!fid || added.has(fid)) return;
            added.add(fid);
            ordered.push(fid);
          });
        });
      }
      files.forEach(function(file) {
        var fid = file && file.id !== null && file.id !== undefined ? String(file.id) : '';
        if (!fid || added.has(fid)) return;
        added.add(fid);
        ordered.push(fid);
      });
      return ordered;
    }

    function renderTempExecToolbar(file) {
      if (!tempExecToolbar || !tempExecToolbarCard) return;
      if (!file) {
        stashTempExecToolbarButtons();
        tempExecToolbar.innerHTML = '';
        tempExecToolbarCard.classList.add('hidden');
        return;
      }
      var summary = buildTempExecSummary(file);
      var statusFilter = state.tempExecStatusFilter || { fileId: '', status: '' };
      var activeFilter = statusFilter.fileId === file.id ? statusFilter.status : '';
      var searchState = state.tempExecSearch || { fileId: '', term: '', raw: '' };
      var searchRaw = searchState.fileId === file.id ? (searchState.raw || '') : '';
      var orderedIds = getTempExecOrderedFileIds();
      var navDisabled = orderedIds.length < 2;
      var navAttr = navDisabled ? ' disabled' : '';
      var navHintPrev = navDisabled ? '暂无可切换用例' : '切换上一份用例';
      var navHintNext = navDisabled ? '暂无可切换用例' : '切换下一份用例';
      var navHtml =
        '<div class="toolbar-nav" role="group" aria-label="切换用例">' +
          '<span class="nav-label">用例切换：</span>' +
          '<button type="button" class="pill secondary nav-btn prev" data-temp-file-nav="prev"' + navAttr + ' title="' + escapeHtml(navHintPrev) + '">' +
            '上一份' +
          '</button>' +
          '<button type="button" class="pill primary nav-btn next" data-temp-file-nav="next"' + navAttr + ' title="' + escapeHtml(navHintNext) + '">' +
            '下一份' +
          '</button>' +
        '</div>';
      var archiveHtml = '';
      if (isDbMode() && !(file && String(file.status || '') === 'archived')) {
        var disabled = file && file._casesLoading ? ' disabled' : '';
        var tip = file && file._casesLoading ? '用例加载中，稍后再试' : '归档当前用例';
        archiveHtml =
          '<button type="button" class="pill accent toolbar-archive" data-temp-file-archive="' + escapeHtml(file.id) + '"' + disabled + ' title="' + escapeHtml(tip) + '">' +
            '归档' +
          '</button>';
      }
      var actionsHtml =
        '<div class="toolbar-actions">' +
          '<div class="toolbar-block toolbar-search">' +
            '<input class="temp-search-input" data-temp-search-input="' + file.id + '" value="' + escapeHtml(searchRaw) + '" placeholder="搜索用例关键字">' +
          '</div>' +
          '<div class="toolbar-block toolbar-middle">' +
            '<div class="toolbar-change-slot" id="tempExecCaseLibraryChangeSlot"></div>' +
            navHtml +
            '<div class="toolbar-archive-wrap">' + archiveHtml + '</div>' +
          '</div>' +
          '<div class="toolbar-block toolbar-export" id="tempExecExportSlot"></div>' +
        '</div>';
      var pillsHtml =
        '<div class="toolbar-pills">' +
          '<span class="summary-pill executed ' + (activeFilter === 'executed' ? 'active' : '') + '" data-temp-status-filter="executed" data-temp-status-file="' + file.id + '">已执行 ' + summary.executed + '</span>' +
          '<span class="summary-pill pending ' + (activeFilter === 'pending' ? 'active' : '') + '" data-temp-status-filter="pending" data-temp-status-file="' + file.id + '">未执行 ' + summary.pending + '</span>' +
          '<span class="summary-pill passed ' + (activeFilter === 'passed' ? 'active' : '') + '" data-temp-status-filter="passed" data-temp-status-file="' + file.id + '">通过 ' + summary.passed + '</span>' +
          '<span class="summary-pill failed ' + (activeFilter === 'failed' ? 'active' : '') + '" data-temp-status-filter="failed" data-temp-status-file="' + file.id + '">失败 ' + summary.failed + '</span>' +
          '<span class="summary-pill blocked ' + (activeFilter === 'blocked' ? 'active' : '') + '" data-temp-status-filter="blocked" data-temp-status-file="' + file.id + '">阻塞 ' + summary.blocked + '</span>' +
          '<span class="summary-pill unspecified ' + (activeFilter === 'unspecified' ? 'active' : '') + '" data-temp-status-filter="unspecified" data-temp-status-file="' + file.id + '">不适用 ' + summary.unspecified + '</span>' +
        '</div>';
      var toolbarHtml = [
        '<div class="toolbar-file">当前文件：<strong>' + escapeHtml(file.name) + '</strong></div>',
        pillsHtml,
        actionsHtml,
      ].join('');
      tempExecToolbar.innerHTML = toolbarHtml;
      mountTempExecToolbarButtons();
      tempExecToolbarCard.classList.remove('hidden');
    }

    function mapFilterToStatus(matchKey, status) {
      if (matchKey === 'executed') return status !== '未执行';
      if (matchKey === 'pending') return status === '未执行';
      if (matchKey === 'passed') return status === '通过';
      if (matchKey === 'failed') return status === '失败';
      if (matchKey === 'blocked') return status === '阻塞';
      if (matchKey === 'unspecified') return status === '不适用';
      return true;
    }

    function setTempExecStatusFilter(fileId, filterKey) {
      var current = state.tempExecStatusFilter || { fileId: '', status: '' };
      var next = { fileId: '', status: '' };
      if (fileId && filterKey && (current.fileId !== fileId || current.status !== filterKey)) {
        next = { fileId: fileId, status: filterKey };
      }
      state.tempExecStatusFilter = next;
      renderTempExecView();
    }

    function mapStatusToClass(status) {
      var text = status === null || status === undefined ? '' : String(status);
      text = text.trim();
      if (text === '通过') return 'passed';
      if (text === '失败') return 'failed';
      if (text === '阻塞') return 'blocked';
      if (text === '不适用') return 'unspecified';
      return 'pending';
    }

    function getCaseExecutionDisplay(file, caseItem) {
      var raw = caseItem && caseItem.actual ? String(caseItem.actual) : '未执行';
      raw = raw.trim();
      if (raw === 'pending') raw = '未执行';
      if (raw === '变更重跑' || raw === '有改动') {
        return { label: raw, className: 'changed' };
      }
      var status = getCaseExecutionStatus(file, caseItem);
      var className = mapStatusToClass(status);
      var label = status || '未执行';
      return { label: label, className: className || 'pending' };
    }

    function renderTempExecOverview() {
      if (!tempExecOverview) return;
      var isProjectLayout = isTempExecProjectLayoutEnabled();
      var archived = Array.isArray(state.tempExecArchivedFiles) ? state.tempExecArchivedFiles : [];
      var combined = state.tempExecFiles.concat(archived);
      var files = combined.slice().sort(function(a, b) {
        var sa = buildTempExecSummary(a);
        var sb = buildTempExecSummary(b);
        var pa = sa.total ? sa.executed / sa.total : 0;
        var pb = sb.total ? sb.executed / sb.total : 0;
        if (pa === pb) return (a.createdAt || 0) - (b.createdAt || 0);
        return pa - pb;
      });
      if (!files.length) {
        tempExecOverview.innerHTML = '<p class="hint">暂无用例执行数据</p>';
        return;
      }
      var currentFile = getTempExecFile(state.tempExecActiveId);
      var currentBlock = currentFile
        ? '<div class="temp-overview-grid two-cols">' + renderTempExecOverviewEntry(currentFile) + '</div>'
        : '<p class="hint">暂无正在执行的用例</p>';
      if (isProjectLayout) {
        // DB 模式个人总览：按项目卡片 + 版本盒子展示（风格对齐执行总览）。
        tempExecOverview.innerHTML = (
          '<div class="temp-overview-section temp-overview-current">' +
            '<h3 class="temp-overview-section-title">当前执行区</h3>' +
            currentBlock +
          '</div>' +
          renderTempExecOverviewProjectLayout(files, currentFile)
        );
        return;
      }
      var versionMap = new Map();
      files.forEach(function(file) {
        var label = '';
        if (isProjectLayout) {
          var pid = file && file.projectId ? String(file.projectId) : '';
          var vid = file && file.versionId !== null && file.versionId !== undefined ? String(file.versionId || '') : '';
          label = resolveProjectName(pid) + ' / ' + resolveVersionName(pid, vid);
        } else {
          label = getTempVersionName(file.versionId) || '未分配版本';
        }
        if (!versionMap.has(label)) versionMap.set(label, []);
        versionMap.get(label).push(file);
      });
      var versionList = Array.from(versionMap.entries()).map(function(entry) {
        return { name: entry[0], list: entry[1] };
      });
      versionList.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh-Hans-CN'); });
      var versionBlock = versionList
        .filter(function(group) { return !isProjectLayout && group.name === '未分配版本' ? false : true; })
        .map(function(group) { return renderTempExecOverviewVersion(group.name, group.list); })
        .join('') || '<p class="hint">暂无分配到版本的用例</p>';
      var unassigned = !isProjectLayout ? versionList.find(function(group) { return group.name === '未分配版本'; }) : null;
      var unassignedBlock = unassigned ? renderTempExecOverviewUnassigned(unassigned.list) : '<p class="hint">暂无未分配的用例</p>';
      tempExecOverview.innerHTML = (
        '<div class="temp-overview-section temp-overview-current">' +
          '<h3 class="temp-overview-section-title">当前执行区</h3>' +
          currentBlock +
        '</div>' +
        '<div class="temp-overview-section">' +
          '<h3 class="temp-overview-section-title">' + (isProjectLayout ? '项目/版本区' : '版本区') + '</h3>' +
          '<div class="temp-overview-version-grid">' + versionBlock + '</div>' +
        '</div>' +
        (isProjectLayout
          ? ''
          : (
            '<div class="temp-overview-section">' +
              '<h3 class="temp-overview-section-title">需求区（未分配版本）</h3>' +
              unassignedBlock +
            '</div>'
          )
        )
      );
    }

    function renderTempExecOverviewProjectLayout(files, currentFile) {
      var list = Array.isArray(files) ? files : [];
      if (!list.length) {
        return (
          '<div class="temp-overview-section">' +
            '<h3 class="temp-overview-section-title">项目/版本区</h3>' +
            '<p class="hint">暂无项目执行数据</p>' +
          '</div>'
        );
      }
      var summaryByFileId = new Map();
      var filesByProject = new Map();
      var projectMeta = new Map();
      list.forEach(function(file) {
        if (!file) return;
        var fid = file && file.id !== null && file.id !== undefined ? String(file.id) : '';
        if (!fid) return;
        var summary = buildTempExecSummary(file);
        summaryByFileId.set(fid, summary);
        var pid = file && file.projectId !== null && file.projectId !== undefined ? String(file.projectId) : '';
        if (!pid) pid = 'unknown';
        if (!filesByProject.has(pid)) filesByProject.set(pid, []);
        filesByProject.get(pid).push(file);
        var t = Number(file && file.createdAt ? file.createdAt : 0) || 0;
        var prev = Number(projectMeta.get(pid) || 0) || 0;
        if (t > prev) projectMeta.set(pid, t);
      });

      var projectIds = Array.from(filesByProject.keys());
      var orderedProjects = projectIds.slice();
      if (projectIds.length) {
        if (typeof ensureProjectOrder === 'function') {
          try {
            var normalized = projectIds.filter(function(pid) { return pid && pid !== 'unknown'; });
            var ordered = ensureProjectOrder(normalized, projectMeta);
            var tail = projectIds.indexOf('unknown') !== -1 ? ['unknown'] : [];
            orderedProjects = (ordered || []).concat(tail);
          } catch (err) {
            orderedProjects.sort(function(a, b) { return String(a).localeCompare(String(b), 'zh-Hans-CN'); });
          }
        } else {
          orderedProjects.sort(function(a, b) { return String(a).localeCompare(String(b), 'zh-Hans-CN'); });
        }
      }

      var defaultProjectId = '';
      if (state && state.tempExecOverviewProjectId) defaultProjectId = String(state.tempExecOverviewProjectId || '');
      if (!defaultProjectId || !filesByProject.has(defaultProjectId)) {
        var fromCurrent = currentFile && currentFile.projectId ? String(currentFile.projectId) : '';
        if (fromCurrent && filesByProject.has(fromCurrent)) defaultProjectId = fromCurrent;
        else defaultProjectId = orderedProjects.length ? orderedProjects[0] : '';
      }
      if (state) state.tempExecOverviewProjectId = defaultProjectId;
      var versionFilter = state && state.tempExecOverviewVersionId ? String(state.tempExecOverviewVersionId || '') : '';

      var projectCards = renderTempExecOverviewProjectCards(orderedProjects, defaultProjectId);
      var detail = renderTempExecOverviewProjectDetail(defaultProjectId, filesByProject.get(defaultProjectId) || [], summaryByFileId, versionFilter);

      return (
        '<div class="temp-overview-section">' +
          '<h3 class="temp-overview-section-title">项目区</h3>' +
          '<div class="nav-entry-grid">' + (projectCards || '<p class="hint">暂无项目</p>') + '</div>' +
        '</div>' +
        '<div class="temp-overview-section">' +
          '<h3 class="temp-overview-section-title">版本区</h3>' +
          detail +
        '</div>'
      );
    }

    function renderTempExecOverviewProjectCards(projectIds, activeProjectId) {
      var list = Array.isArray(projectIds) ? projectIds : [];
      if (!list.length) return '';
      var icon =
        '<span class="nav-entry-icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" role="presentation" focusable="false">' +
            '<path d="M3 6h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"></path>' +
          '</svg>' +
        '</span>';
      return list
        .map(function(pid) {
          var resolved = pid === 'unknown' ? '' : pid;
          var name = pid === 'unknown' ? '项目#未知' : resolveProjectName(resolved);
          var cls = 'nav-entry-card nav-entry-overview' + (String(pid) === String(activeProjectId) ? ' active' : '');
          return (
            '<button type="button" class="' + cls + '" data-temp-overview-project="' + escapeHtml(pid) + '">' +
              icon +
              '<span class="nav-entry-text">' +
                '<span class="nav-entry-title">' + escapeHtml(name) + '</span>' +
                '<span class="nav-entry-desc">查看版本与执行进度</span>' +
              '</span>' +
            '</button>'
          );
        })
        .join('');
    }

    function renderTempExecOverviewProjectDetail(projectId, files, summaryByFileId, versionFilter) {
      var pid = projectId === null || projectId === undefined ? '' : String(projectId);
      var list = Array.isArray(files) ? files : [];
      if (!pid || !list.length) {
        return '<p class="hint">暂无执行数据</p>';
      }
      function reorderArchivedToBottom(ids, fileMap) {
        var activeIds = [];
        var archivedIds = [];
        ids.forEach(function(fid) {
          var file = fileMap && fid ? fileMap[fid] : null;
          if (file && String(file.status || '') === 'archived') archivedIds.push(fid);
          else activeIds.push(fid);
        });
        return activeIds.concat(archivedIds);
      }
      var canUsePlacement = pid && pid !== 'unknown';
      var verMap = new Map();
      var unassigned = [];
      list.forEach(function(file) {
        if (!file) return;
        var vid = file && file.versionId !== null && file.versionId !== undefined ? String(file.versionId || '') : '';
        if (!vid) {
          unassigned.push(file);
          return;
        }
        if (!verMap.has(vid)) verMap.set(vid, []);
        verMap.get(vid).push(file);
      });

      var versionIds = Array.from(verMap.keys());
      var versionMeta = new Map();
      versionIds.forEach(function(vid) {
        var filesIn = verMap.get(vid) || [];
        var max = 0;
        filesIn.forEach(function(f) {
          var t = Number(f && f.createdAt ? f.createdAt : 0) || 0;
          if (t > max) max = t;
        });
        versionMeta.set(vid, max);
      });
      var orderedVersions = [];
      if (canUsePlacement && typeof ensureProjectVersionOrder === 'function') {
        try {
          orderedVersions = ensureProjectVersionOrder(pid, versionIds, versionMeta) || [];
        } catch (err) {
          orderedVersions = versionIds.slice().sort(function(a, b) { return String(a).localeCompare(String(b), 'zh-Hans-CN'); });
        }
      } else {
        orderedVersions = versionIds.slice().sort(function(a, b) { return String(a).localeCompare(String(b), 'zh-Hans-CN'); });
      }

      var filterVid = versionFilter ? String(versionFilter) : '';
      if (filterVid && orderedVersions.indexOf(filterVid) === -1) filterVid = '';

      var selectHtml = '';
      if (orderedVersions.length) {
        var opts = ['<option value=""' + (filterVid ? '' : ' selected') + '>全部版本</option>'];
        orderedVersions.forEach(function(vid) {
          var name = pid === 'unknown' ? ('版本#' + String(vid)) : resolveVersionName(pid, vid);
          var selected = filterVid && String(vid) === String(filterVid) ? ' selected' : '';
          opts.push('<option value="' + escapeHtml(vid) + '"' + selected + '>' + escapeHtml(name) + '</option>');
        });
        selectHtml =
          '<div class="exec-overview-detail-head" style="margin:0 0 12px;">' +
            '<h3 style="margin:0;font-size:16px;">' + escapeHtml(pid === 'unknown' ? '项目#未知' : resolveProjectName(pid)) + '</h3>' +
            '<label class="inline">版本 <select data-temp-overview-version-select="1">' + opts.join('') + '</select></label>' +
          '</div>';
      }

      var total = 0;
      var pending = 0;
      var passed = 0;
      var failed = 0;
      var blocked = 0;
      var na = 0;
      list.forEach(function(file) {
        if (!file) return;
        var fid = file && file.id !== null && file.id !== undefined ? String(file.id) : '';
        var s = summaryByFileId && typeof summaryByFileId.get === 'function' ? summaryByFileId.get(fid) : null;
        if (!s) s = buildTempExecSummary(file);
        total += Number(s.total) || 0;
        pending += Number(s.pending) || 0;
        passed += Number(s.passed) || 0;
        failed += Number(s.failed) || 0;
        blocked += Number(s.blocked) || 0;
        na += Number(s.unspecified) || 0;
      });

      var versionBoxes = [];
      orderedVersions.forEach(function(vid) {
        if (filterVid && String(vid) !== String(filterVid)) return;
        var filesIn = verMap.get(vid) || [];
        var fileIds = filesIn.map(function(f) { return f && f.id !== null && f.id !== undefined ? String(f.id) : ''; }).filter(Boolean);
        var fileMeta = new Map();
        filesIn.forEach(function(f) {
          var fid = f && f.id !== null && f.id !== undefined ? String(f.id) : '';
          if (!fid) return;
          var t = Number(f && f.createdAt ? f.createdAt : 0) || 0;
          fileMeta.set(fid, t);
        });
        var orderedFileIds = [];
        if (canUsePlacement && typeof ensureProjectVersionFileOrder === 'function') {
          try {
            orderedFileIds = ensureProjectVersionFileOrder(pid, vid, fileIds, fileMeta) || [];
          } catch (err) {
            orderedFileIds = fileIds.slice();
          }
        } else {
          orderedFileIds = fileIds.slice();
          orderedFileIds.sort(function(a, b) {
            var ta = Number(fileMeta.get(a) || 0) || 0;
            var tb = Number(fileMeta.get(b) || 0) || 0;
            if (ta !== tb) return tb - ta;
            return String(a).localeCompare(String(b), 'zh-Hans-CN');
          });
        }
        var byId = {};
        filesIn.forEach(function(f) {
          var fid = f && f.id !== null && f.id !== undefined ? String(f.id) : '';
          if (fid) byId[fid] = f;
        });
        orderedFileIds = reorderArchivedToBottom(orderedFileIds, byId);
        var chips = orderedFileIds
          .map(function(fid) {
            var file = byId[fid];
            if (!file) return '';
            var summary = summaryByFileId && typeof summaryByFileId.get === 'function' ? summaryByFileId.get(fid) : null;
            if (!summary) summary = buildTempExecSummary(file);
            return renderTempExecOverviewExecSetChip(file, summary);
          })
          .join('');
        var vname = pid === 'unknown' ? ('版本#' + String(vid)) : resolveVersionName(pid, vid);
        versionBoxes.push(
          '<div class="exec-overview-version-box">' +
            '<div class="head"><span class="title" title="' + escapeHtml(vname) + '">' + escapeHtml(vname) + '</span></div>' +
            '<div class="body">' + (chips || '<span class="hint">暂无用例</span>') + '</div>' +
          '</div>'
        );
      });

      if (!filterVid && unassigned.length) {
        var unassignedSorted = unassigned
          .slice()
          .sort(function(a, b) { return Number(b && b.createdAt ? b.createdAt : 0) - Number(a && a.createdAt ? a.createdAt : 0); });
        var unassignedMap = {};
        unassignedSorted.forEach(function(file) {
          var fid = file && file.id !== null && file.id !== undefined ? String(file.id) : '';
          if (fid) unassignedMap[fid] = file;
        });
        var unassignedIds = reorderArchivedToBottom(
          unassignedSorted
            .map(function(file) { return file && file.id !== null && file.id !== undefined ? String(file.id) : ''; })
            .filter(Boolean),
          unassignedMap
        );
        var chips2 = unassignedIds
          .map(function(fid) {
            var file = unassignedMap[fid];
            if (!file) return '';
            var summary = summaryByFileId && typeof summaryByFileId.get === 'function' ? summaryByFileId.get(fid) : null;
            if (!summary) summary = buildTempExecSummary(file);
            return renderTempExecOverviewExecSetChip(file, summary);
          })
          .join('');
        versionBoxes.push(
          '<div class="exec-overview-version-box">' +
            '<div class="head"><span class="title" title="未分配版本">未分配版本</span></div>' +
            '<div class="body">' + (chips2 || '<span class="hint">暂无用例</span>') + '</div>' +
          '</div>'
        );
      }

      var metaLine =
        '<div class="meta">' +
          '<span>总数 ' + total + '</span>' +
          '<span>待执行 ' + pending + '</span>' +
          '<span>通过 ' + passed + '</span>' +
          '<span>失败 ' + failed + '</span>' +
          '<span>阻塞 ' + blocked + '</span>' +
          '<span>不适用 ' + na + '</span>' +
        '</div>';

      var detail =
        '<div class="exec-overview-user-grid layout-mode">' +
          '<div class="exec-overview-user-card">' +
            '<div class="head"><div class="name">个人总览</div></div>' +
            metaLine +
            '<div class="exec-overview-layout">' + versionBoxes.join('') + '</div>' +
          '</div>' +
        '</div>';

      return selectHtml + detail;
    }

    function renderTempExecOverviewExecSetChip(file, summary) {
      var safe = function(n) { return Math.max(0, Number(n) || 0); };
      var total = safe(summary && summary.total);
      var pending = safe(summary && summary.pending);
      var passed = safe(summary && summary.passed);
      var failed = safe(summary && summary.failed);
      var blocked = safe(summary && summary.blocked);
      var na = safe(summary && summary.unspecified);
      if (!total) {
        var fallbackTotal = getTempExecFileCaseCount(file);
        if (fallbackTotal > 0) {
          total = fallbackTotal;
          pending = fallbackTotal;
          passed = 0;
          failed = 0;
          blocked = 0;
          na = 0;
        }
      }
      var executed = Math.max(0, total - pending);
      var done = passed + na;
      var pct = total ? Math.round((done / total) * 100) : 0;

      var statusText = '未执行';
      var statusCls = 'pending';
      if (total > 0 && (failed > 0 || blocked > 0)) {
        if (failed > 0 && blocked > 0) statusText = '失败/阻塞';
        else if (failed > 0) statusText = '失败';
        else statusText = '阻塞';
        statusCls = 'err';
      } else if (total > 0 && pending === 0) {
        statusText = '已完成';
        statusCls = 'ok';
      } else if (executed > 0) {
        statusText = '进行中';
        statusCls = 'running';
      }

      function findFirstIndex(key) {
        if (!file || !Array.isArray(file.cases)) return -1;
        for (var i = 0; i < file.cases.length; i += 1) {
          var s = getCaseExecutionStatus(file, file.cases[i]);
          if (mapFilterToStatus(key, s)) return i;
        }
        return -1;
      }

      var segs = [
        { key: 'passed', className: 'status-passed', count: passed },
        { key: 'failed', className: 'status-failed', count: failed },
        { key: 'blocked', className: 'status-blocked', count: blocked },
        { key: 'unspecified', className: 'status-unspecified', count: na },
        { key: 'pending', className: 'status-pending', count: pending },
      ].filter(function(seg) { return seg && seg.count > 0; });
      var barHtml = segs.length
        ? segs
          .map(function(seg) {
            var firstIndex = findFirstIndex(seg.key);
            return (
              '<div class="temp-overview-segment ' + seg.className + '" style="flex:' + seg.count + ';" data-temp-overview-file="' + escapeHtml(file.id) + '" data-temp-overview-status="' + escapeHtml(seg.key) + '" data-temp-overview-index="' + String(firstIndex) + '">' +
                '<span>' + String(seg.count) + '</span>' +
              '</div>'
            );
          })
          .join('')
        : '<div class="temp-overview-segment status-pending" style="flex:1;"><span>0</span></div>';

      var progress =
        '<div class="exec-overview-file-progress" title="执行进度 ' + pct + '%（' + done + '/' + total + '）">' +
          '<div class="temp-overview-bar">' + barHtml + '</div>' +
          '<div class="label">' + pct + '%</div>' +
        '</div>';

      var kvs = [
        '<span class="exec-overview-kv kv-done">已' + executed + '/' + total + '</span>',
        '<span class="exec-overview-kv kv-pending">待' + pending + '</span>',
        '<span class="exec-overview-kv kv-passed">过' + passed + '</span>',
        '<span class="exec-overview-kv kv-failed">失' + failed + '</span>',
        '<span class="exec-overview-kv kv-blocked">阻' + blocked + '</span>',
        (na > 0 ? '<span class="exec-overview-kv kv-na">NA' + na + '</span>' : ''),
      ].filter(Boolean);

      var meta =
        '<div class="exec-overview-file-meta">' +
          '<span class="exec-overview-file-status status-' + statusCls + '">' + escapeHtml(statusText) + '</span>' +
          '<span class="exec-overview-file-counts" title="' + escapeHtml(kvs.join(' ')) + '">' + kvs.join('') + '</span>' +
        '</div>';

      var label = file && file.name ? String(file.name) : '测试用例';
      var isArchived = file && String(file.status || '') === 'archived';
      var archiveTag = isArchived ? '<span class="tag tag-archived">归</span>' : '';
      var archiveAction = '';
      if (!isArchived && isDbMode()) {
        var execSetId = file && (file.execSetId || file.id) ? String(file.execSetId || file.id) : '';
        if (execSetId) {
          archiveAction =
            '<span class="exec-overview-chip-action" data-temp-overview-archive="' + escapeHtml(execSetId) + '" title="归档该份用例">归档</span>';
        }
      }
      return (
        '<button type="button" class="exec-overview-file-chip state-' + statusCls + '" data-temp-file="' + escapeHtml(file.id) + '"' + (isArchived ? ' data-temp-archived="1"' : '') + '>' +
          '<div class="row">' +
            archiveTag +
            '<span class="text" title="' + escapeHtml(label) + '">' + escapeHtml(label) + '</span>' +
            archiveAction +
            '<span class="badge">' + total + '</span>' +
          '</div>' +
          progress +
          meta +
        '</button>'
      );
    }

    function renderTempExecOverviewVersion(label, list) {
      var reqMap = new Map();
      list.forEach(function(file) {
        var req = normalizeRequirementName(file && file.requirement) || '未标识需求';
        if (!reqMap.has(req)) reqMap.set(req, []);
        reqMap.get(req).push(file);
      });
      var reqBlocks = Array.from(reqMap.entries()).map(function(entry) {
        var req = entry[0];
        var files = entry[1];
        var sorted = files.slice().sort(function(a, b) {
          var sa = buildTempExecSummary(a);
          var sb = buildTempExecSummary(b);
          var pa = sa.total ? sa.executed / sa.total : 0;
          var pb = sb.total ? sb.executed / sb.total : 0;
          if (pa === pb) return (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN');
          return pa - pb;
        });
        return (
          '<div class="temp-overview-req">' +
            '<div class="temp-overview-req-title">' + escapeHtml(req) + '</div>' +
            '<div class="temp-overview-grid two-cols">' + sorted.map(renderTempExecOverviewEntry).join('') + '</div>' +
          '</div>'
        );
      }).join('');
      return (
        '<div class="temp-overview-version">' +
          '<div class="temp-overview-version-header">' + escapeHtml(label) + '</div>' +
          (reqBlocks || '<p class="hint">暂无用例</p>') +
        '</div>'
      );
    }

    function renderTempExecOverviewUnassigned(list) {
      var sorted = list.slice().sort(function(a, b) {
        var sa = buildTempExecSummary(a);
        var sb = buildTempExecSummary(b);
        var pa = sa.total ? sa.executed / sa.total : 0;
        var pb = sb.total ? sb.executed / sb.total : 0;
        if (pa === pb) return (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN');
        return pa - pb;
      });
      return '<div class="temp-overview-grid four-cols">' + sorted.map(renderTempExecOverviewEntry).join('') + '</div>';
    }

    function renderTempExecOverviewEntry(file) {
      var summary = buildTempExecSummary(file);
      var total = summary.total || 0;
      var completionCount = summary.passed + summary.unspecified;
      var executedPercent = total ? Math.round((completionCount / total) * 100) : 0;
      var segments = [
        { key: 'passed', label: '通过', count: summary.passed, className: 'status-passed' },
        { key: 'failed', label: '失败', count: summary.failed, className: 'status-failed' },
        { key: 'blocked', label: '阻塞', count: summary.blocked, className: 'status-blocked' },
        { key: 'unspecified', label: '不适用', count: summary.unspecified, className: 'status-unspecified' },
        { key: 'pending', label: '未执行', count: summary.pending, className: 'status-pending' },
      ];
      function findFirstCaseIndexForOverview(key) {
        if (!file || !Array.isArray(file.cases)) return -1;
        for (var i = 0; i < file.cases.length; i += 1) {
          var status = getCaseExecutionStatus(file, file.cases[i]);
          if (mapFilterToStatus(key, status)) return i;
        }
        return -1;
      }
      var segmentHtml = total
        ? segments.filter(function(seg) { return seg.count > 0; }).map(function(seg) {
            var firstIndex = findFirstCaseIndexForOverview(seg.key);
            return (
              '<div class="temp-overview-segment ' + seg.className + '" style="flex:' + seg.count + ';" data-temp-overview-file="' + file.id + '" data-temp-overview-status="' + seg.key + '" data-temp-overview-index="' + firstIndex + '">' +
                '<span>' + seg.count + '</span>' +
              '</div>'
            );
          }).join('')
        : '<div class="temp-overview-segment status-pending" style="flex:1;"><span>0</span></div>';
      var metaHtml = segments.map(function(seg) {
        return '<span><span class="dot ' + (seg.className ? seg.className.replace('status-', '') : '') + '"></span>' + seg.label + ' ' + seg.count + '</span>';
      }).join('');
      var tags = [];
      if (file && String(file.status || '') === 'archived') tags.push('<span class="tag tag-archived">归</span>');
      if (state.tempExecFocus.indexOf(file.id) !== -1) tags.push('<span class="tag tag-focus">专注</span>');
      var tagHtml = tags.join(' ');
      var archiveBtn = '';
      if (isDbMode() && !(file && String(file.status || '') === 'archived')) {
        var execSetId = file && (file.execSetId || file.id) ? String(file.execSetId || file.id) : '';
        if (execSetId) {
          var disabled = file && file._casesLoading ? ' disabled' : '';
          var tip = file && file._casesLoading ? '用例加载中，稍后再试' : '归档该份用例';
          archiveBtn =
            '<button type="button" class="pill secondary tiny" data-temp-overview-archive="' + escapeHtml(execSetId) + '"' + disabled + ' title="' + escapeHtml(tip) + '">' +
              '归档' +
            '</button>';
        }
      }
      return (
        '<div class="temp-overview-entry" data-temp-file="' + file.id + '"' + (file && String(file.status || '') === 'archived' ? ' data-temp-archived="1"' : '') + '>' +
          '<div class="temp-overview-header">' +
            '<span>' + tagHtml + ' ' + escapeHtml(file && file.name ? file.name : '测试用例') + '</span>' +
            '<span class="temp-overview-actions">' +
              archiveBtn +
              '<span class="temp-overview-rate">执行进度 ' + executedPercent + '%（' + completionCount + '/' + summary.total + '）</span>' +
            '</span>' +
          '</div>' +
          '<div class="temp-overview-bar">' + segmentHtml + '</div>' +
          '<div class="temp-overview-meta">' + metaHtml + '</div>' +
        '</div>'
      );
    }

    function renderTempFocusZoneWithHint(zone, hintText) {
      if (!zone) return;
      var focusList = state.tempExecFocus
        .map(function(id) { return getTempExecFile(id); })
        .filter(Boolean);
      var html = focusList.length
        ? focusList.map(function(file) {
            return (
              '<button type="button" draggable="true" data-temp-file="' + file.id + '" class="' + (state.tempExecActiveId === file.id ? 'active' : '') + '">' +
                '<span class="tag tag-focus">专注</span>' +
                '<span>' + escapeHtml(file && file.name ? file.name : '测试用例') + '（' + getTempExecFileCaseCount(file) + '）</span>' +
                '<span class="remove" title="移出专注区" data-temp-focus-remove="' + file.id + '">×</span>' +
              '</button>'
            );
          }).join('')
        : '<span class="hint">' + escapeHtml(hintText || '') + '</span>';
      zone.innerHTML = html;
      enforceTempFileDraggable(zone);
    }

    function renderTempFocusZone() {
      renderTempFocusZoneWithHint(tempFocusZone, '拖拽用例到此区域，专注处理关键用例');
      renderTempFocusZoneWithHint(tempExecViewFocusZone, '暂无专注用例');
    }

    function renderTempExecNav() {
      if (!tempExecNav) return;
      syncTempSectionToggleButtons();
      var focusSet = new Set(state.tempExecFocus || []);
      if (state.tempExecReqCollapsed) {
        tempExecNav.classList.add('collapsed');
        tempExecNav.innerHTML = '<span class="hint temp-req-empty">需求区已收起，点击“展开需求区”查看</span>';
        if (exportTempExecBtn) exportTempExecBtn.disabled = !state.tempExecActiveId;
        if (exportTempExecConfigBtn) exportTempExecConfigBtn.disabled = !state.tempExecFiles.length;
        if (exportTempExecXmindBtn) exportTempExecXmindBtn.disabled = !state.tempExecActiveId;
        if (exportTempExecCasesXmindBtn) exportTempExecCasesXmindBtn.disabled = !state.tempExecActiveId;
        if (tempExecMindBtn) tempExecMindBtn.disabled = !state.tempExecActiveId;
        renderTempExecOverview();
        renderTempFocusZone();
        return;
      }
      tempExecNav.classList.remove('collapsed');
      var files = state.tempExecFiles
        .filter(function(file) { return !file.versionId; })
        .slice()
        .sort(function(a, b) {
          var nameA = (a && a.name) || '';
          var nameB = (b && b.name) || '';
          return nameA.localeCompare(nameB, 'zh-Hans-CN');
        });
      var groupMap = new Map();
      files.forEach(function(file) {
        var req = normalizeRequirementName(file && file.requirement) || '未标识需求';
        if (!groupMap.has(req)) groupMap.set(req, []);
        groupMap.get(req).push(file);
      });
      var reqOrderList = ensureRequirementOrder(Array.from(groupMap.keys()));
      var globalOrder = files.slice().sort(function(a, b) {
        var na = (a && a.name) || '';
        var nb = (b && b.name) || '';
        return na.localeCompare(nb, 'zh-Hans-CN');
      }).map(function(file) { return file.id; });
      var orderedReqs = reqOrderList.slice();
      var groups = orderedReqs
        .map(function(req) {
          var list = groupMap.get(req) || [];
          var orderedIds = ensureFileOrder(req, list.map(function(item) { return item.id; }));
          var orderedFiles = list.slice().sort(function(a, b) {
            var ia = orderedIds.indexOf(a.id);
            var ib = orderedIds.indexOf(b.id);
            if (ia !== -1 && ib !== -1 && ia !== ib) return ia - ib;
            var ga = globalOrder.indexOf(a.id);
            var gb = globalOrder.indexOf(b.id);
            if (ga !== -1 && gb !== -1 && ga !== gb) return ga - gb;
            if (ia !== -1 && ib === -1) return -1;
            if (ia === -1 && ib !== -1) return 1;
            if (ga !== -1 && gb === -1) return -1;
            if (ga === -1 && gb !== -1) return 1;
            return sortByCreatedDesc(a, b);
          });
          return { req: req, list: orderedFiles };
        })
        .filter(function(group) { return group.list.length; });
      var reqOrderMap = new Map();
      orderedReqs.forEach(function(req, idx) { reqOrderMap.set(req, idx); });
      var reqCreatedMap = new Map();
      groups.forEach(function(group) {
        var times = group.list.map(function(file) { return Number(file && file.createdAt) || 0; }).filter(function(t) { return Number.isFinite(t); });
        var ts = times.length ? Math.min.apply(null, times) : 0;
        reqCreatedMap.set(group.req, ts);
      });
      groups.sort(function(a, b) {
        if (navPrefersUnassigned) {
          var aHasUnassigned = a.list.some(function(file) { return !file.versionId; });
          var bHasUnassigned = b.list.some(function(file) { return !file.versionId; });
          if (aHasUnassigned !== bHasUnassigned) return aHasUnassigned ? -1 : 1;
        }
        var ia = reqOrderMap.has(a.req) ? reqOrderMap.get(a.req) : -1;
        var ib = reqOrderMap.has(b.req) ? reqOrderMap.get(b.req) : -1;
        if (ia !== -1 && ib !== -1 && ia !== ib) return ia - ib;
        var ta = reqCreatedMap.has(a.req) ? reqCreatedMap.get(a.req) : 0;
        var tb = reqCreatedMap.has(b.req) ? reqCreatedMap.get(b.req) : 0;
        if (ta !== tb) return ta - tb;
        return a.req.localeCompare(b.req, 'zh-Hans-CN');
      });
      var boxesHtml = groups.length
        ? groups.map(function(group) {
            return (
              '<div class="temp-req-box" data-temp-req="' + group.req + '" data-temp-file-group="' + group.list.map(function(item) { return item.id; }).join(',') + '" draggable="true">' +
                '<div class="temp-req-header">' +
                  '<span class="temp-req-title">' + escapeHtml(group.req) + '</span>' +
                  '<span class="temp-req-count">' + group.list.length + ' 份</span>' +
                '</div>' +
                '<div class="temp-req-list">' +
                  group.list.map(function(file) {
                    return renderTempExecItemRow(file, {
                      focusSet: focusSet,
                      activeId: state.tempExecActiveId,
                    });
                  }).join('') +
                '</div>' +
              '</div>'
            );
          }).join('')
        : '<span class="hint temp-req-empty">暂无未分配的用例，可从版本拖回或继续导入</span>';
      tempExecNav.innerHTML = '<div class="temp-req-grid" data-temp-req-pool="1">' + boxesHtml + '</div>';
      if (exportTempExecBtn) exportTempExecBtn.disabled = !state.tempExecActiveId;
      if (exportTempExecConfigBtn) exportTempExecConfigBtn.disabled = !state.tempExecFiles.length;
      if (exportTempExecXmindBtn) exportTempExecXmindBtn.disabled = !state.tempExecActiveId;
      if (exportTempExecCasesXmindBtn) exportTempExecCasesXmindBtn.disabled = !state.tempExecActiveId;
      if (tempExecMindBtn) tempExecMindBtn.disabled = !state.tempExecActiveId;
      renderTempExecOverview();
      renderTempFocusZone();
      enforceTempFileDraggable(tempExecNav);
    }

    function toggleTempExecRequirementZone() {
      state.tempExecReqCollapsed = !state.tempExecReqCollapsed;
      persistTempExecState();
      renderTempExecNav();
    }

    function toggleTempExecVersionZone() {
      state.tempExecVersionCollapsed = !state.tempExecVersionCollapsed;
      persistTempExecState();
      renderTempVersionGrid();
    }

    function setTempExecImportProjectFilter(projectId) {
      var next = normalizeTempExecImportProjectFilterId(projectId);
      var current = state.tempExecImportProjectFilterId ? String(state.tempExecImportProjectFilterId) : '';
      if (String(current) === String(next)) return;
      state.tempExecImportProjectFilterId = next;
      renderTempVersionGrid();
      scheduleTempExecUiSave();
    }

    function prioritizeTempExecUnassignedRequirements() {
      var placement = ensureTempExecPlacement();
      var reqs = placement.requirementOrder.slice();
      if (!reqs.length) return;
      var reqHasUnassigned = new Map();
      reqs.forEach(function(req) {
        var has = (state.tempExecFiles || []).some(function(file) {
          var r = normalizeRequirementName(file && file.requirement) || '未标识需求';
          return r === req && !file.versionId;
        });
        reqHasUnassigned.set(req, has);
      });
      navPrefersUnassigned = true;
      placement.requirementOrder = reqs.slice().sort(function(a, b) {
        var ha = reqHasUnassigned.get(a);
        var hb = reqHasUnassigned.get(b);
        if (ha !== hb) return ha ? -1 : 1;
        return reqs.indexOf(a) - reqs.indexOf(b);
      });
      renderTempExecNav();
    }

    function prioritizeTempExecUnassignedRequirements() {
      var placement = ensureTempExecPlacement();
      var reqs = placement.requirementOrder.slice();
      if (!reqs.length) return;
      var reqHasUnassigned = new Map();
      reqs.forEach(function(req) {
        var has = (state.tempExecFiles || []).some(function(file) {
          var r = normalizeRequirementName(file && file.requirement) || '未标识需求';
          return r === req && !file.versionId;
        });
        reqHasUnassigned.set(req, has);
      });
      var next = reqs.slice().sort(function(a, b) {
        var ha = reqHasUnassigned.get(a);
        var hb = reqHasUnassigned.get(b);
        if (ha !== hb) return ha ? -1 : 1;
        return reqs.indexOf(a) - reqs.indexOf(b);
      });
      placement.requirementOrder = Array.from(new Set(next));
      renderTempExecNav();
    }

    function syncTempExecReuseStatusAlign() {
      if (!tempExecView || !tempExecView.querySelectorAll) return;
      if (tempExecView.classList && tempExecView.classList.contains('hidden')) return;
      var tables = tempExecView.querySelectorAll('table');
      if (!tables.length) return;
      tables.forEach(function(table) {
        if (!table || !table.querySelectorAll) return;
        var targetEl = table.querySelector('tbody tr.case-row td.actual .reuse-status')
          || table.querySelector('tbody tr.case-row td.actual .status-select')
          || table.querySelector('thead th.actual');
        if (!targetEl || !targetEl.getBoundingClientRect) return;
        var targetRect = targetEl.getBoundingClientRect();
        if (!targetRect || !targetRect.width) return;
        var targetCenter = targetRect.left + targetRect.width / 2;
        var selects = table.querySelectorAll('.reuse-panel .reuse-entry .status-select');
        selects.forEach(function(select) {
          if (!select || !select.getBoundingClientRect) return;
          if (select.offsetParent === null) {
            if (select.style) select.style.transform = '';
            if (select.closest) {
              var hiddenEntry = select.closest('.reuse-entry');
              if (hiddenEntry && hiddenEntry.style) hiddenEntry.style.removeProperty('--reuse-status-shift');
            }
            return;
          }
          var rect = select.getBoundingClientRect();
          if (!rect || !rect.width) return;
          var currentCenter = rect.left + rect.width / 2;
          var delta = targetCenter - currentCenter;
          if (!Number.isFinite(delta)) return;
          if (Math.abs(delta) < 0.5) {
            if (select.style) select.style.transform = '';
            if (select.closest) {
              var nearEntry = select.closest('.reuse-entry');
              if (nearEntry && nearEntry.style) nearEntry.style.removeProperty('--reuse-status-shift');
            }
            return;
          }
          var rounded = Math.round(delta);
          if (select.style) select.style.transform = 'translateX(' + rounded + 'px)';
          if (select.closest) {
            var entry = select.closest('.reuse-entry');
            if (entry && entry.style) entry.style.setProperty('--reuse-status-shift', rounded + 'px');
          }
        });
        var syncButtons = table.querySelectorAll('.reuse-panel .reuse-actions .reuse-sync');
        syncButtons.forEach(function(button) {
          if (!button || !button.getBoundingClientRect) return;
          if (button.offsetParent === null) {
            if (button.style) button.style.transform = '';
            return;
          }
          var btnRect = button.getBoundingClientRect();
          if (!btnRect || !btnRect.width) return;
          var btnCenter = btnRect.left + btnRect.width / 2;
          var deltaBtn = targetCenter - btnCenter;
          if (!Number.isFinite(deltaBtn)) return;
          if (Math.abs(deltaBtn) < 0.5) {
            if (button.style) button.style.transform = '';
            return;
          }
          var roundedBtn = Math.round(deltaBtn);
          if (button.style) button.style.transform = 'translateX(' + roundedBtn + 'px)';
        });
      });
    }

    function ensureTempExecMissingReminderState() {
      if (!state.tempExecMissingReminder || typeof state.tempExecMissingReminder !== 'object') {
        state.tempExecMissingReminder = {
          projectId: '',
          signature: '',
          items: [],
          matchedModules: [],
          matchedTypes: [],
          hasMatch: false,
          pending: false,
          pendingPayload: null,
          loading: false,
          loaded: false,
          limit: 10,
          seq: 0,
          aiContextSignature: '',
          aiContextProjectId: '',
          aiContextReady: false,
          aiSignature: '',
          aiProjectId: '',
          aiItems: [],
          aiIds: [],
          aiLoading: false,
          aiGenerated: false,
          aiError: '',
          aiSeq: 0,
          libraryEmpty: false,
          libraryChecked: false,
          libraryLoading: false,
          libraryProjectId: '',
          librarySeq: 0,
          refreshTimer: null,
          observer: null,
          observerTarget: null,
          scrollHandler: null,
          scrollTimer: null,
        };
      }
      return state.tempExecMissingReminder;
    }

    function resolveMissingReminderPlacement() {
      var settings = state.settings && typeof state.settings === 'object' ? state.settings : {};
      var raw = settings.missingCaseReminderPlacement;
      var key = raw === null || raw === undefined ? '' : String(raw).toLowerCase();
      return key === 'bottom' ? 'bottom' : 'top';
    }

    function resolveMissingReminderMatchConfig() {
      var settings = state.settings && typeof state.settings === 'object' ? state.settings : {};
      var raw = settings.missingCaseReminderMatchConfig;
      return normalizeMissingReminderMatchConfig(raw, { type: true, module: true });
    }

    function resolveMissingReminderAiEnabled() {
      var settings = state.settings && typeof state.settings === 'object' ? state.settings : {};
      var raw = settings.missingCaseReminderAiEnabled;
      return String(raw || '').toLowerCase() === 'on' ? 'on' : 'off';
    }

    function hashReminderText(text) {
      var str = String(text || '');
      var hash = 0;
      for (var i = 0; i < str.length; i += 1) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return hash + ':' + str.length;
    }

    var tempExecSearchFields = [
      'module', 'title', 'priority', 'preconditions', 'precondition', 'steps', 'expected', 'actual', 'remark'
    ];
    var tempExecAiCaseFields = [
      'module', 'title', 'priority', 'precondition', 'preconditions', 'steps', 'expected'
    ];

    function buildTempExecAiCaseEntry(item) {
      if (!item || typeof item !== 'object') return null;
      var moduleVal = stringifyCaseField(item.module || item.module_name || '');
      var preconditionVal = stringifyCaseField(item.precondition || item.preconditions || '');
      return {
        module: moduleVal,
        title: stringifyCaseField(item.title || ''),
        priority: stringifyCaseField(item.priority || ''),
        precondition: preconditionVal,
        steps: stringifyCaseField(item.steps || ''),
        expected: stringifyCaseField(item.expected || ''),
      };
    }

    function buildTempExecAiCaseText(item) {
      if (!item || typeof item !== 'object') return '';
      var parts = [];
      tempExecAiCaseFields.forEach(function(key) {
        var val = stringifyCaseField(item[key]);
        if (val) parts.push(val);
      });
      return parts.join(' ').toLowerCase();
    }

    function buildTempExecAiCaseContext(cases) {
      var list = Array.isArray(cases) ? cases : [];
      var entries = [];
      var texts = [];
      list.forEach(function(item) {
        var entry = buildTempExecAiCaseEntry(item);
        if (entry) entries.push(entry);
        var text = buildTempExecAiCaseText(item);
        if (text) texts.push(text);
      });
      return {
        entries: entries,
        texts: texts,
        searchText: texts.join(' '),
        signatureText: texts.join('\n\n'),
      };
    }

    function buildTempExecCaseText(item) {
      if (!item || typeof item !== 'object') return '';
      var parts = [];
      tempExecSearchFields.forEach(function(key) {
        var val = stringifyCaseField(item[key]);
        if (val) parts.push(val);
      });
      return parts.join(' ').toLowerCase();
    }

    function buildTempExecCaseSearchText(cases) {
      var list = Array.isArray(cases) ? cases : [];
      if (!list.length) return '';
      var parts = [];
      list.forEach(function(item) {
        var text = buildTempExecCaseText(item);
        if (text) parts.push(text);
      });
      return parts.join('\n\n');
    }

    function buildTempExecCaseFieldText(item, keys) {
      if (!item || typeof item !== 'object') return '';
      var parts = [];
      (keys || []).forEach(function(key) {
        if (!key) return;
        var val = stringifyCaseField(item[key]);
        if (val) parts.push(val);
      });
      return parts.join(' ').toLowerCase();
    }

    function buildTempExecReminderFieldTextMap(cases) {
      var list = Array.isArray(cases) ? cases : [];
      var titles = [];
      var preconditions = [];
      var steps = [];
      var expected = [];
      list.forEach(function(item) {
        var title = buildTempExecCaseFieldText(item, ['title']);
        if (title) titles.push(title);
        var pre = buildTempExecCaseFieldText(item, ['precondition', 'preconditions']);
        if (pre) preconditions.push(pre);
        var step = buildTempExecCaseFieldText(item, ['steps']);
        if (step) steps.push(step);
        var exp = buildTempExecCaseFieldText(item, ['expected']);
        if (exp) expected.push(exp);
      });
      return {
        title: titles.join(' '),
        precondition: preconditions.join(' '),
        steps: steps.join(' '),
        expected: expected.join(' '),
      };
    }

    function hasReminderKeywordHit(text, keywords) {
      if (!text || !keywords || !keywords.length) return false;
      for (var i = 0; i < keywords.length; i += 1) {
        if (text.indexOf(keywords[i]) !== -1) return true;
      }
      return false;
    }

    function buildTempExecReminderScore(item, fieldTextMap) {
      if (!item || typeof item !== 'object') return 0;
      var map = fieldTextMap && typeof fieldTextMap === 'object' ? fieldTextMap : {};
      var score = 0;
      var titleKeys = buildMissingReminderKeywords(item.title);
      if (hasReminderKeywordHit(map.title, titleKeys)) score += 1;
      var preKeys = buildMissingReminderKeywords(item.precondition);
      if (hasReminderKeywordHit(map.precondition, preKeys)) score += 1;
      var stepKeys = buildMissingReminderKeywords(item.steps);
      if (hasReminderKeywordHit(map.steps, stepKeys)) score += 1;
      var expKeys = buildMissingReminderKeywords(item.expected);
      if (hasReminderKeywordHit(map.expected, expKeys)) score += 1;
      return score;
    }

    function resolveTempExecMissingReminderScoreLevel(score, fallback) {
      if (fallback) return String(fallback);
      var num = Number(score);
      if (!isFinite(num)) return '低';
      if (num >= 3) return '高';
      if (num >= 2) return '中';
      return '低';
    }

    function resolveTempExecMissingReminderLibraryEmpty(modules) {
      var list = Array.isArray(modules) ? modules : [];
      if (!list.length) return true;
      var hasCount = false;
      for (var i = 0; i < list.length; i += 1) {
        var item = list[i];
        if (!item) continue;
        if (item.item_count !== undefined && item.item_count !== null) {
          hasCount = true;
          var count = Number(item.item_count);
          if (isFinite(count) && count > 0) return false;
        }
      }
      if (!hasCount) return false;
      return true;
    }

    function resetTempExecMissingReminderLibrary(reminder) {
      var target = reminder || ensureTempExecMissingReminderState();
      target.libraryEmpty = false;
      target.libraryChecked = false;
      target.libraryLoading = false;
      target.libraryProjectId = '';
      target.librarySeq = (target.librarySeq || 0) + 1;
    }

    function showTempExecMissingReminderLibraryEmptyToast() {
      if (appUtils && typeof appUtils.showCenterToast === 'function') {
        appUtils.showCenterToast('易漏库没有任何用例，请点击上方“跳转到易漏用例库”进行添加。', 'warn', 3000);
      }
    }

    function checkTempExecMissingReminderLibrary(reminder, projectId) {
      var target = reminder || ensureTempExecMissingReminderState();
      var pid = projectId ? String(projectId) : '';
      if (!pid) {
        resetTempExecMissingReminderLibrary(target);
        return;
      }
      if (target.libraryChecked && target.libraryProjectId === pid) return;
      if (target.libraryLoading && target.libraryProjectId === pid) return;
      var client = getApiClient();
      if (!client || typeof client.listMissingModules !== 'function') return;
      var seq = (target.librarySeq || 0) + 1;
      target.librarySeq = seq;
      target.libraryLoading = true;
      target.libraryProjectId = pid;
      client.listMissingModules(pid)
        .then(function(modules) {
          if (target.librarySeq !== seq) return;
          target.libraryEmpty = resolveTempExecMissingReminderLibraryEmpty(modules);
          target.libraryChecked = true;
          target.libraryLoading = false;
          renderTempExecView();
        })
        .catch(function() {
          if (target.librarySeq !== seq) return;
          target.libraryEmpty = false;
          target.libraryChecked = false;
          target.libraryLoading = false;
          renderTempExecView();
        });
    }

    function buildTempExecMissingReminderSummary(reminder) {
      var modules = reminder && Array.isArray(reminder.matchedModules) ? reminder.matchedModules : [];
      var types = reminder && Array.isArray(reminder.matchedTypes) ? reminder.matchedTypes : [];
      var parts = [];
      if (modules.length) {
        var shownModules = modules.slice(0, 4);
        var text = shownModules.join('、');
        if (modules.length > shownModules.length) text += ' 等' + modules.length + '个';
        parts.push('模块：' + text);
      }
      if (types.length) {
        var shownTypes = types.slice(0, 4);
        var text2 = shownTypes.join('、');
        if (types.length > shownTypes.length) text2 += ' 等' + types.length + '个';
        parts.push('类型：' + text2);
      }
      return parts.join('；');
    }

    function resolveTempExecMissingReminderLimit(reminder) {
      var limit = reminder && reminder.limit !== undefined ? Number(reminder.limit) : 10;
      if (!isFinite(limit) || limit <= 0) return 10;
      return limit;
    }

    function normalizeMissingReminderTypeId(value) {
      if (value === null || value === undefined || value === '') return null;
      var num = Number(value);
      if (!isFinite(num) || num <= 0) return null;
      return num;
    }

    function normalizeMissingReminderTypeIds(values) {
      if (!Array.isArray(values)) {
        values = values === null || values === undefined ? [] : [values];
      }
      var result = [];
      var seen = {};
      values.forEach(function(raw) {
        var val = normalizeMissingReminderTypeId(raw);
        if (!val) return;
        var key = String(val);
        if (seen[key]) return;
        seen[key] = true;
        result.push(val);
      });
      return result;
    }

    function formatTempExecMissingTypeLabel(item) {
      if (!item || typeof item !== 'object') return '未分类';
      var typeIds = normalizeMissingReminderTypeIds(item.type_ids);
      if (!typeIds.length && item.type_id) {
        typeIds = normalizeMissingReminderTypeIds([item.type_id]);
      }
      if (!typeIds.length) return '未分类';
      var names = Array.isArray(item.type_names)
        ? item.type_names
        : (item.type_name ? [item.type_name] : []);
      var textList = [];
      for (var i = 0; i < typeIds.length; i += 1) {
        var name = names[i];
        if (!name) name = '类型#' + typeIds[i];
        textList.push(name);
      }
      return textList.length ? textList.join('、') : '未分类';
    }

    function buildTempExecMissingReminderTable(reminder) {
      var aiEnabled = resolveMissingReminderAiEnabled() === 'on';
      var contextSignature = reminder && reminder.aiContextSignature ? String(reminder.aiContextSignature) : '';
      var aiSignature = reminder && reminder.aiSignature ? String(reminder.aiSignature) : '';
      var aiActive = aiEnabled && contextSignature && aiSignature === contextSignature;
      var aiLoading = aiEnabled && aiActive && reminder && reminder.aiLoading === true;
      var aiGenerated = aiEnabled && aiActive && reminder && reminder.aiGenerated === true;
      var list = aiEnabled ? (aiGenerated ? (reminder.aiItems || []) : []) : (reminder && Array.isArray(reminder.items) ? reminder.items : []);
      var limit = resolveTempExecMissingReminderLimit(reminder);
      var display = list.slice(0, limit);
      var showScore = true;
      var cols = 8;
      var rows = display.map(function(item) {
        var moduleName = item && item.module_name ? String(item.module_name) : '--';
        var typeName = formatTempExecMissingTypeLabel(item);
        var title = item && item.title ? String(item.title) : '';
        var priority = item && item.priority ? String(item.priority) : '';
        var precondition = item && item.precondition ? String(item.precondition) : '';
        var steps = item && item.steps ? String(item.steps) : '';
        var expected = item && item.expected ? String(item.expected) : '';
        var score = item && item.match_score !== undefined ? Number(item.match_score) : 0;
        if (!isFinite(score) || score < 0) score = 0;
        var scoreText = String(score);
        if (aiEnabled) {
          scoreText = resolveTempExecMissingReminderScoreLevel(score, item && item.match_level ? item.match_level : '');
        }
        return (
          '<tr>' +
            (showScore ? ('<td class="score">' + escapeHtml(scoreText) + '</td>') : '') +
            '<td class="type">' + escapeHtml(typeName) + '</td>' +
            '<td class="module">' + escapeHtml(moduleName) + '</td>' +
            '<td class="title">' + escapeHtml(title) + '</td>' +
            '<td class="priority">' + escapeHtml(priority) + '</td>' +
            '<td>' + escapeHtml(precondition).replace(/\\n/g, '<br>') + '</td>' +
            '<td>' + escapeHtml(steps).replace(/\\n/g, '<br>') + '</td>' +
            '<td>' + escapeHtml(expected).replace(/\\n/g, '<br>') + '</td>' +
          '</tr>'
        );
      }).join('');
      if (!rows) {
        var hint = '暂无匹配易漏用例';
        if (aiEnabled) {
          if (reminder && reminder.libraryEmpty === true) {
            hint = '易漏库没有任何用例，请点击上方“跳转到易漏用例库”进行添加。';
          } else if (aiLoading) {
            hint = '正在生成 AI 推荐';
          } else if (reminder && reminder.aiError) {
            hint = reminder.aiError;
          } else if (!aiGenerated) {
            hint = '点击 AI 推荐生成易漏用例建议';
          }
        } else if (reminder && reminder.loading) {
          hint = '正在加载易漏用例...';
        } else if (reminder && reminder.pending) {
          hint = '滑动到此处加载易漏用例';
        }
        var hintClass = aiLoading ? 'hint missing-reminder-ai-loading' : 'hint';
        rows = '<tr><td colspan="' + cols + '"><p class="' + hintClass + '">' + escapeHtml(hint)
          + (aiLoading ? '<span class="missing-reminder-loading-dots"></span>' : '')
          + '</p></td></tr>';
      }
      var colGroup =
        '<colgroup>' +
          (showScore ? '<col class="col-score">' : '') +
          '<col class="col-type">' +
          '<col class="col-module">' +
          '<col class="col-title">' +
          '<col class="col-priority">' +
          '<col class="col-precondition">' +
          '<col class="col-steps">' +
          '<col class="col-expected">' +
        '</colgroup>';
      var aiButtonDisabled = aiEnabled && (!reminder || reminder.aiContextReady !== true || reminder.aiLoading === true) ? ' disabled' : '';
      var aiButtonHtml = aiEnabled
        ? '<button type="button" class="missing-reminder-ai-btn" data-missing-reminder-ai="1"' + aiButtonDisabled + '>AI推荐</button>'
        : '';
      return (
        '<div class="missing-reminder-card">' +
          '<div class="missing-reminder-header">' +
            '<div class="missing-reminder-title-group">' +
              '<span class="missing-reminder-title">易漏用例参考</span>' +
              aiButtonHtml +
              '<button type="button" class="missing-reminder-link" data-missing-reminder-link="missing-library">跳转到易漏用例库</button>' +
            '</div>' +
            '<span class="missing-reminder-meta">' +
              escapeHtml(buildTempExecMissingReminderSummary(reminder)) +
            '</span>' +
          '</div>' +
          '<div class="missing-reminder-table-head">' +
            '<div class="temp-case-view">' +
              '<table class="missing-reminder-table">' +
                colGroup +
                '<thead>' +
                  '<tr>' +
                    (showScore ? '<th class="score">匹配得分</th>' : '') +
                    '<th class="type">类型</th>' +
                    '<th class="module">模块</th>' +
                    '<th class="title">用例标题</th>' +
                    '<th class="priority">优先级</th>' +
                    '<th>前提条件</th>' +
                    '<th>操作步骤</th>' +
                    '<th>预期结果</th>' +
                  '</tr>' +
                '</thead>' +
              '</table>' +
            '</div>' +
          '</div>' +
          '<div class="missing-reminder-scroll">' +
            '<div class="temp-case-view">' +
              '<table class="missing-reminder-table">' +
                colGroup +
                '<tbody>' + rows + '</tbody>' +
              '</table>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }

    function renderTempExecMissingReminderBlock() {
      var reminder = ensureTempExecMissingReminderState();
      var aiEnabled = resolveMissingReminderAiEnabled() === 'on';
      if (aiEnabled) {
        var showAi = reminder.aiContextReady === true
          || (reminder.aiLoading === true && reminder.aiSignature)
          || (reminder.aiGenerated === true && reminder.aiSignature);
        if (!showAi) return '';
      } else if (!reminder.hasMatch && !reminder.loading && !reminder.pending) {
        return '';
      }
      return buildTempExecMissingReminderTable(reminder);
    }

    function cleanupTempExecMissingReminderObserver(reminder) {
      if (reminder.observer) {
        reminder.observer.disconnect();
        reminder.observer = null;
      }
      reminder.observerTarget = null;
      if (reminder.scrollHandler) {
        window.removeEventListener('scroll', reminder.scrollHandler);
        window.removeEventListener('resize', reminder.scrollHandler);
        reminder.scrollHandler = null;
      }
      if (reminder.scrollTimer) {
        clearTimeout(reminder.scrollTimer);
        reminder.scrollTimer = null;
      }
    }

    function resolveTempExecMissingReminderTarget() {
      if (!tempExecView || !tempExecView.querySelector) return null;
      return tempExecView.querySelector('.missing-reminder-card');
    }

    function isTempExecMissingReminderInView(target) {
      if (!target || !target.getBoundingClientRect) return false;
      if (target.offsetParent === null) return false;
      var rect = target.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight || 0;
      if (!vh) return false;
      return rect.bottom > 0 && rect.top < vh;
    }

    function scheduleTempExecMissingReminderLazyLoad() {
      var reminder = ensureTempExecMissingReminderState();
      if (!reminder.hasMatch || reminder.loading || reminder.loaded || !reminder.pendingPayload) return;
      var target = resolveTempExecMissingReminderTarget();
      if (!target) return;
      if (isTempExecMissingReminderInView(target)) {
        loadTempExecMissingReminderItems();
        return;
      }
      if (reminder.observerTarget !== target) cleanupTempExecMissingReminderObserver(reminder);
      if (reminder.observer) return;
      if (typeof IntersectionObserver === 'function') {
        reminder.observerTarget = target;
        reminder.observer = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (entry && (entry.isIntersecting || entry.intersectionRatio > 0)) {
              loadTempExecMissingReminderItems();
            }
          });
        }, { root: null, rootMargin: '120px 0px', threshold: 0.01 });
        reminder.observer.observe(target);
        return;
      }
      reminder.observerTarget = target;
      if (!reminder.scrollHandler) {
        reminder.scrollHandler = function() {
          if (reminder.scrollTimer) clearTimeout(reminder.scrollTimer);
          reminder.scrollTimer = setTimeout(function() {
            reminder.scrollTimer = null;
            if (!reminder.loaded && !reminder.loading && reminder.pendingPayload) {
              if (isTempExecMissingReminderInView(reminder.observerTarget)) loadTempExecMissingReminderItems();
            }
          }, 120);
        };
        window.addEventListener('scroll', reminder.scrollHandler, { passive: true });
        window.addEventListener('resize', reminder.scrollHandler);
      }
    }

    function clearTempExecMissingReminder() {
      var reminder = ensureTempExecMissingReminderState();
      reminder.items = [];
      reminder.matchedModules = [];
      reminder.matchedTypes = [];
      reminder.hasMatch = false;
      reminder.pending = false;
      reminder.pendingPayload = null;
      reminder.loading = false;
      reminder.loaded = false;
      reminder.signature = '';
      reminder.projectId = '';
      cleanupTempExecMissingReminderObserver(reminder);
      resetTempExecMissingReminderLibrary(reminder);
    }

    function requestTempExecMissingReminderRefresh() {
      var reminder = ensureTempExecMissingReminderState();
      if (reminder.refreshTimer) clearTimeout(reminder.refreshTimer);
      reminder.refreshTimer = setTimeout(function() {
        reminder.refreshTimer = null;
        refreshTempExecMissingReminder();
      }, 160);
    }

    function refreshTempExecMissingReminder() {
      var reminder = ensureTempExecMissingReminderState();
      if (resolveMissingReminderAiEnabled() === 'on') {
        var prevReady = reminder.aiContextReady;
        var prevSig = reminder.aiContextSignature;
        var prevProject = reminder.aiContextProjectId;
        var readyNow = syncTempExecMissingReminderAiContext(reminder);
        if (readyNow) {
          checkTempExecMissingReminderLibrary(reminder, reminder.aiContextProjectId);
        } else {
          resetTempExecMissingReminderLibrary(reminder);
        }
        if (prevReady === readyNow
          && prevSig === reminder.aiContextSignature
          && prevProject === reminder.aiContextProjectId) {
          return;
        }
        renderTempExecView();
        return;
      }
      var active = getTempExecFile(state.tempExecActiveId);
      if (!active || !active.projectId) {
        clearTempExecMissingReminder();
        return;
      }
      var cases = Array.isArray(active.cases) ? active.cases : [];
      if (!cases.length) {
        clearTempExecMissingReminder();
        return;
      }
      var caseTexts = [];
      cases.forEach(function(item) {
        var text = buildTempExecCaseText(item);
        if (text) caseTexts.push(text);
      });
      if (!caseTexts.length) {
        clearTempExecMissingReminder();
        return;
      }
      var projectId = String(active.projectId);
      var matchConfig = resolveMissingReminderMatchConfig();
      var matchKey = (matchConfig.type ? 't' : '') + (matchConfig.module ? 'm' : '');
      var fieldTextMap = buildTempExecReminderFieldTextMap(cases);
      var signatureText = caseTexts.join('\n\n');
      var caseSearchText = caseTexts.join(' ');
      var signature = projectId + ':' + hashReminderText(signatureText) + ':' + matchKey;
      if (reminder.signature === signature && reminder.projectId === projectId && (reminder.loaded || reminder.pending)) {
        scheduleTempExecMissingReminderLazyLoad();
        return;
      }
      reminder.signature = signature;
      reminder.projectId = projectId;
      reminder.items = [];
      reminder.matchedModules = [];
      reminder.matchedTypes = [];
      reminder.hasMatch = false;
      reminder.pending = false;
      reminder.pendingPayload = null;
      reminder.loading = false;
      reminder.loaded = false;
      cleanupTempExecMissingReminderObserver(reminder);
      var client = getApiClient();
      if (!client || typeof client.listMissingModules !== 'function' || typeof client.listMissingTypes !== 'function') {
        clearTempExecMissingReminder();
        return;
      }
      var seq = (reminder.seq || 0) + 1;
      reminder.seq = seq;
      Promise.all([client.listMissingModules(projectId), client.listMissingTypes(projectId)])
        .then(function(res) {
          if (reminder.seq !== seq) return null;
          var modules = Array.isArray(res && res[0]) ? res[0] : [];
          var types = Array.isArray(res && res[1]) ? res[1] : [];
          var requireModule = matchConfig.module === true;
          var requireType = matchConfig.type === true;
          var moduleMatches = [];
          var moduleIds = [];
          var allModuleIds = [];
          var matchedModuleMap = {};
          var moduleMap = {};
          modules.forEach(function(m) {
            if (!m || m.id === null || m.id === undefined) return;
            var name = m.name ? String(m.name).trim() : '';
            var idStr = String(m.id);
            moduleMap[idStr] = m;
            allModuleIds.push(idStr);
            if (name && caseSearchText.indexOf(name.toLowerCase()) !== -1) {
              moduleMatches.push(name);
              moduleIds.push(idStr);
              matchedModuleMap[idStr] = true;
            }
          });
          var typeMatches = [];
          var typeIds = [];
          var allTypeIds = [];
          var typeNameMap = {};
          var matchedTypeMap = {};
          types.forEach(function(t) {
            if (!t || t.id === null || t.id === undefined) return;
            var name = t.name ? String(t.name).trim() : '';
            var idStr = String(t.id);
            typeNameMap[idStr] = name || ('类型#' + idStr);
            allTypeIds.push(idStr);
            if (name && caseSearchText.indexOf(name.toLowerCase()) !== -1) {
              typeMatches.push(name);
              typeIds.push(idStr);
              matchedTypeMap[idStr] = true;
            }
          });
          if ((requireModule && !moduleIds.length) || (requireType && !typeIds.length) || (!allModuleIds.length)) {
            reminder.items = [];
            reminder.matchedModules = [];
            reminder.matchedTypes = [];
            reminder.hasMatch = false;
            reminder.pending = false;
            reminder.pendingPayload = null;
            reminder.loading = false;
            reminder.loaded = true;
            renderTempExecView();
            return null;
          }
          if (!requireModule) moduleIds = allModuleIds.slice();
          if (!requireType) typeIds = allTypeIds.slice();
          reminder.matchedModules = moduleMatches;
          reminder.matchedTypes = typeMatches;
          reminder.hasMatch = true;
          reminder.pending = true;
          reminder.pendingPayload = {
            projectId: projectId,
            moduleIds: moduleIds,
            typeIds: typeIds,
            moduleMap: moduleMap,
            typeNameMap: typeNameMap,
            matchedModuleMap: matchedModuleMap,
            matchedTypeMap: matchedTypeMap,
            matchConfig: matchConfig,
            fieldTextMap: fieldTextMap,
          };
          reminder.loading = false;
          reminder.loaded = false;
          renderTempExecView();
          return null;
        })
        .catch(function() {
          if (reminder.seq !== seq) return;
          reminder.items = [];
          reminder.matchedModules = [];
          reminder.matchedTypes = [];
          reminder.hasMatch = false;
          reminder.pending = false;
          reminder.pendingPayload = null;
          reminder.loading = false;
          reminder.loaded = false;
          cleanupTempExecMissingReminderObserver(reminder);
          renderTempExecView();
        });
    }

    function loadTempExecMissingReminderItems() {
      var reminder = ensureTempExecMissingReminderState();
      if (!reminder.pendingPayload || reminder.loading || reminder.loaded) return;
      var client = getApiClient();
      if (!client || typeof client.listMissingModules !== 'function' || typeof client.listMissingModuleItems !== 'function') {
        clearTempExecMissingReminder();
        return;
      }
      var payload = reminder.pendingPayload || {};
      var moduleIds = Array.isArray(payload.moduleIds) ? payload.moduleIds.slice() : [];
      var typeIds = Array.isArray(payload.typeIds) ? payload.typeIds.slice() : [];
      var moduleMap = payload.moduleMap && typeof payload.moduleMap === 'object' ? payload.moduleMap : {};
      var typeNameMap = payload.typeNameMap && typeof payload.typeNameMap === 'object' ? payload.typeNameMap : {};
      var matchedModuleMap = payload.matchedModuleMap && typeof payload.matchedModuleMap === 'object' ? payload.matchedModuleMap : {};
      var matchedTypeMap = payload.matchedTypeMap && typeof payload.matchedTypeMap === 'object' ? payload.matchedTypeMap : {};
      var matchConfig = normalizeMissingReminderMatchConfig(payload.matchConfig, { type: true, module: true });
      var requireModule = matchConfig.module === true;
      var requireType = matchConfig.type === true;
      if (!moduleIds.length) {
        clearTempExecMissingReminder();
        return;
      }
      if (requireModule && !Object.keys(matchedModuleMap).length) {
        clearTempExecMissingReminder();
        return;
      }
      if (requireType && (!typeIds.length || !Object.keys(matchedTypeMap).length)) {
        clearTempExecMissingReminder();
        return;
      }
      reminder.pending = false;
      reminder.pendingPayload = null;
      reminder.loading = true;
      reminder.loaded = false;
      cleanupTempExecMissingReminderObserver(reminder);
      renderTempExecView();
      var seq = (reminder.seq || 0) + 1;
      reminder.seq = seq;
      Promise.resolve([]).then(function() {
        if (reminder.seq !== seq) return null;
        var ids = moduleIds.slice();
        if (!ids.length) {
          reminder.items = [];
          reminder.loading = false;
          reminder.loaded = true;
          renderTempExecView();
          return null;
        }
        var tasks = ids.map(function(id) {
          return client
            .listMissingModuleItems(id)
            .then(function(list) {
              var rows = Array.isArray(list) ? list : [];
              return rows.map(function(it) {
                var clone = it && typeof it === 'object' ? Object.assign({}, it) : {};
                clone.module_id = id;
                clone.module_name = moduleMap[id] && moduleMap[id].name ? moduleMap[id].name : ('模块#' + id);
                var typeIds = normalizeMissingReminderTypeIds(clone.type_ids);
                if (!typeIds.length && clone.type_id) {
                  typeIds = normalizeMissingReminderTypeIds([clone.type_id]);
                }
                var resolvedNames = [];
                typeIds.forEach(function(typeId, idx) {
                  var key = String(typeId);
                  var base = Array.isArray(clone.type_names) ? clone.type_names[idx] : null;
                  if (!base && clone.type_name && idx === 0) base = clone.type_name;
                  var name = typeNameMap[key] || base || ('类型#' + typeId);
                  resolvedNames.push(name);
                });
                clone.type_ids = typeIds;
                clone.type_names = resolvedNames;
                clone.type_name = resolvedNames.length ? resolvedNames.join('、') : '未分类';
                return clone;
              });
            })
            .catch(function() { return []; });
        });
        return Promise.all(tasks).then(function(all) {
          if (reminder.seq !== seq) return null;
          var combined = [];
          (all || []).forEach(function(rows) {
            (rows || []).forEach(function(row) {
              if (!row) return;
              var moduleHit = requireModule ? (row.module_id && matchedModuleMap[String(row.module_id)]) : true;
              var rowTypeIds = normalizeMissingReminderTypeIds(row.type_ids);
              if (!rowTypeIds.length && row.type_id) {
                rowTypeIds = normalizeMissingReminderTypeIds([row.type_id]);
              }
              var typeHit = true;
              if (requireType) {
                typeHit = false;
                for (var i = 0; i < rowTypeIds.length; i += 1) {
                  if (matchedTypeMap[String(rowTypeIds[i])]) {
                    typeHit = true;
                    break;
                  }
                }
              }
              if (moduleHit && typeHit) combined.push(row);
            });
          });
          if (!combined.length) {
            reminder.items = [];
            reminder.matchedModules = [];
            reminder.matchedTypes = [];
            reminder.hasMatch = false;
            reminder.loading = false;
            reminder.loaded = true;
            renderTempExecView();
            return null;
          }
          var fieldTextMap = payload.fieldTextMap && typeof payload.fieldTextMap === 'object' ? payload.fieldTextMap : {};
          combined.forEach(function(item, idx) {
            item.match_score = buildTempExecReminderScore(item, fieldTextMap);
            item.__score_index = idx;
          });
          combined.sort(function(a, b) {
            var sa = Number(a && a.match_score) || 0;
            var sb = Number(b && b.match_score) || 0;
            if (sa !== sb) return sb - sa;
            var ia = Number(a && a.__score_index) || 0;
            var ib = Number(b && b.__score_index) || 0;
            return ia - ib;
          });
          var limit = resolveTempExecMissingReminderLimit(reminder);
          reminder.items = combined.slice(0, limit);
          reminder.items.forEach(function(item) { try { delete item.__score_index; } catch (_) {} });
          reminder.loading = false;
          reminder.loaded = true;
          renderTempExecView();
          return null;
        });
      }).catch(function() {
        if (reminder.seq !== seq) return;
        reminder.items = [];
        reminder.loading = false;
        reminder.loaded = false;
        renderTempExecView();
      });
    }

    function clearTempExecMissingReminderAi(reminder, options) {
      var target = reminder || ensureTempExecMissingReminderState();
      target.aiItems = [];
      target.aiIds = [];
      target.aiLoading = false;
      target.aiGenerated = false;
      target.aiError = '';
      target.aiSignature = '';
      target.aiProjectId = '';
      target.aiSeq = (target.aiSeq || 0) + 1;
      resetTempExecMissingReminderLibrary(target);
      if (!options || options.keepContext !== true) {
        target.aiContextSignature = '';
        target.aiContextProjectId = '';
        target.aiContextReady = false;
      }
    }

    function syncTempExecMissingReminderAiContext(reminder) {
      var target = reminder || ensureTempExecMissingReminderState();
      var active = getTempExecFile(state.tempExecActiveId);
      if (!active || !active.projectId) {
        target.aiContextReady = false;
        target.aiContextSignature = '';
        target.aiContextProjectId = '';
        return false;
      }
      var cases = Array.isArray(active.cases) ? active.cases : [];
      if (!cases.length) {
        target.aiContextReady = false;
        target.aiContextSignature = '';
        target.aiContextProjectId = '';
        return false;
      }
      var context = buildTempExecAiCaseContext(cases);
      if (!context.texts.length) {
        target.aiContextReady = false;
        target.aiContextSignature = '';
        target.aiContextProjectId = '';
        return false;
      }
      var projectId = String(active.projectId);
      var signature = projectId + ':' + hashReminderText(context.signatureText);
      target.aiContextSignature = signature;
      target.aiContextProjectId = projectId;
      target.aiContextReady = true;
      return true;
    }

    function buildTempExecMissingReminderAiCandidateSnapshot(items, fieldTextMap) {
      var map = {};
      var itemMap = {};
      var list = Array.isArray(items) ? items : [];
      list.forEach(function(item, idx) {
        if (!item) return;
        var score = buildTempExecReminderScore(item, fieldTextMap);
        var level = resolveTempExecMissingReminderScoreLevel(score, '');
        var clone = item && typeof item === 'object' ? Object.assign({}, item) : {};
        clone.match_score = score;
        clone.match_level = level;
        var id = String(idx + 1);
        var moduleName = clone.module_name || clone.module || '';
        var typeName = formatTempExecMissingTypeLabel(clone);
        map[id] = {
          module: stringifyCaseField(moduleName),
          type: stringifyCaseField(typeName),
          title: stringifyCaseField(item.title || ''),
          priority: stringifyCaseField(item.priority || ''),
          precondition: stringifyCaseField(item.precondition || ''),
          steps: stringifyCaseField(item.steps || ''),
          expected: stringifyCaseField(item.expected || ''),
          match_level: stringifyCaseField(level),
        };
        itemMap[id] = clone;
      });
      return { map: map, itemMap: itemMap };
    }

    function parseTempExecMissingReminderAiIds(content) {
      var raw = content || '';
      var stripped = appUtils && typeof appUtils.stripCodeFence === 'function'
        ? appUtils.stripCodeFence(raw)
        : String(raw || '').trim();
      var payloadText = appUtils && typeof appUtils.extractJsonPayload === 'function'
        ? appUtils.extractJsonPayload(stripped)
        : '';
      var text = payloadText || stripped;
      var data = JSON.parse(text);
      var ids = data && Array.isArray(data.ids) ? data.ids : [];
      return ids.map(function(id) { return String(id).trim(); }).filter(Boolean);
    }

    function fetchTempExecMissingReminderAiCandidates(projectId, caseSearchText) {
      var client = getApiClient();
      if (!client || typeof client.listMissingModules !== 'function' || typeof client.listMissingTypes !== 'function') {
        return Promise.resolve({
          items: [],
          matchedModules: [],
          matchedTypes: [],
          matchedModuleMap: {},
          matchedTypeMap: {},
          moduleMap: {},
          typeNameMap: {},
          libraryEmpty: false,
        });
      }
      return Promise.all([client.listMissingModules(projectId), client.listMissingTypes(projectId)])
        .then(function(res) {
          var modules = Array.isArray(res && res[0]) ? res[0] : [];
          var types = Array.isArray(res && res[1]) ? res[1] : [];
          var moduleMatches = [];
          var moduleIds = [];
          var allModuleIds = [];
          var matchedModuleMap = {};
          var moduleMap = {};
          var libraryEmpty = resolveTempExecMissingReminderLibraryEmpty(modules);
          modules.forEach(function(m) {
            if (!m || m.id === null || m.id === undefined) return;
            var name = m.name ? String(m.name).trim() : '';
            var idStr = String(m.id);
            moduleMap[idStr] = m;
            allModuleIds.push(idStr);
            if (name && caseSearchText.indexOf(name.toLowerCase()) !== -1) {
              moduleMatches.push(name);
              moduleIds.push(idStr);
              matchedModuleMap[idStr] = true;
            }
          });
          var typeMatches = [];
          var typeNameMap = {};
          var matchedTypeMap = {};
          types.forEach(function(t) {
            if (!t || t.id === null || t.id === undefined) return;
            var name = t.name ? String(t.name).trim() : '';
            var idStr = String(t.id);
            typeNameMap[idStr] = name || ('类型#' + idStr);
            if (name && caseSearchText.indexOf(name.toLowerCase()) !== -1) {
              typeMatches.push(name);
              matchedTypeMap[idStr] = true;
            }
          });
          var hasModuleMatch = moduleIds.length > 0;
          var hasTypeMatch = Object.keys(matchedTypeMap).length > 0;
          if (!hasModuleMatch && !hasTypeMatch) {
            return {
              items: [],
              matchedModules: moduleMatches,
              matchedTypes: typeMatches,
              matchedModuleMap: matchedModuleMap,
              matchedTypeMap: matchedTypeMap,
              moduleMap: moduleMap,
              typeNameMap: typeNameMap,
              libraryEmpty: libraryEmpty,
            };
          }
          var loadModuleIds = hasTypeMatch ? allModuleIds.slice() : moduleIds.slice();
          if (!loadModuleIds.length) {
            return {
              items: [],
              matchedModules: moduleMatches,
              matchedTypes: typeMatches,
              matchedModuleMap: matchedModuleMap,
              matchedTypeMap: matchedTypeMap,
              moduleMap: moduleMap,
              typeNameMap: typeNameMap,
              libraryEmpty: libraryEmpty,
            };
          }
          var tasks = loadModuleIds.map(function(id) {
            return client
              .listMissingModuleItems(id)
              .then(function(list) {
                var rows = Array.isArray(list) ? list : [];
                return rows.map(function(it) {
                  var clone = it && typeof it === 'object' ? Object.assign({}, it) : {};
                  clone.module_id = id;
                  clone.module_name = moduleMap[id] && moduleMap[id].name ? moduleMap[id].name : ('模块#' + id);
                  var typeIds = normalizeMissingReminderTypeIds(clone.type_ids);
                  if (!typeIds.length && clone.type_id) {
                    typeIds = normalizeMissingReminderTypeIds([clone.type_id]);
                  }
                  var resolvedNames = [];
                  typeIds.forEach(function(typeId, idx) {
                    var key = String(typeId);
                    var base = Array.isArray(clone.type_names) ? clone.type_names[idx] : null;
                    if (!base && clone.type_name && idx === 0) base = clone.type_name;
                    var name = typeNameMap[key] || base || ('类型#' + typeId);
                    resolvedNames.push(name);
                  });
                  clone.type_ids = typeIds;
                  clone.type_names = resolvedNames;
                  clone.type_name = resolvedNames.length ? resolvedNames.join('、') : '未分类';
                  return clone;
                });
              })
              .catch(function() { return []; });
          });
          return Promise.all(tasks).then(function(all) {
            var combined = [];
            (all || []).forEach(function(rows) {
              (rows || []).forEach(function(row) {
                if (!row) return;
                var moduleHit = row.module_id && matchedModuleMap[String(row.module_id)];
                var rowTypeIds = normalizeMissingReminderTypeIds(row.type_ids);
                if (!rowTypeIds.length && row.type_id) {
                  rowTypeIds = normalizeMissingReminderTypeIds([row.type_id]);
                }
                var typeHit = false;
                for (var i = 0; i < rowTypeIds.length; i += 1) {
                  if (matchedTypeMap[String(rowTypeIds[i])]) {
                    typeHit = true;
                    break;
                  }
                }
                if (moduleHit || typeHit) combined.push(row);
              });
            });
            return {
              items: combined,
              matchedModules: moduleMatches,
              matchedTypes: typeMatches,
              matchedModuleMap: matchedModuleMap,
              matchedTypeMap: matchedTypeMap,
              moduleMap: moduleMap,
              typeNameMap: typeNameMap,
              libraryEmpty: libraryEmpty,
            };
          });
        });
    }

    function runTempExecMissingReminderAiRecommend(options) {
      var reminder = ensureTempExecMissingReminderState();
      if (reminder.aiLoading) return;
      var contextReady = syncTempExecMissingReminderAiContext(reminder);
      if (!contextReady) {
        reminder.aiError = '暂无可用于推荐的用例内容';
        reminder.aiGenerated = true;
        reminder.aiLoading = false;
        reminder.aiItems = [];
        reminder.aiIds = [];
        renderTempExecView();
        return;
      }
      var projectId = reminder.aiContextProjectId;
      var signature = reminder.aiContextSignature;
      var active = getTempExecFile(state.tempExecActiveId);
      var cases = active && Array.isArray(active.cases) ? active.cases : [];
      var context = buildTempExecAiCaseContext(cases);
      var fieldTextMap = buildTempExecReminderFieldTextMap(cases);
      var caseSearchText = String(context.searchText || '').toLowerCase();
      var model;
      try {
        model = getAssignedModel('missingreminder');
      } catch (err) {
        reminder.aiError = err && err.message ? err.message : '未找到易漏用例推荐模型';
        reminder.aiGenerated = true;
        reminder.aiLoading = false;
        reminder.aiItems = [];
        reminder.aiIds = [];
        renderTempExecView();
        return;
      }
      reminder.aiLoading = true;
      reminder.aiGenerated = false;
      reminder.aiError = '';
      reminder.aiItems = [];
      reminder.aiIds = [];
      reminder.aiSignature = signature;
      reminder.aiProjectId = projectId;
      var seq = (reminder.aiSeq || 0) + 1;
      reminder.aiSeq = seq;
      renderTempExecView();
      fetchTempExecMissingReminderAiCandidates(projectId, caseSearchText)
        .then(function(res) {
          if (reminder.aiSeq !== seq) return null;
          var candidates = res && Array.isArray(res.items) ? res.items : [];
          reminder.matchedModules = res && Array.isArray(res.matchedModules) ? res.matchedModules : [];
          reminder.matchedTypes = res && Array.isArray(res.matchedTypes) ? res.matchedTypes : [];
          if (res && res.libraryEmpty !== undefined) {
            reminder.libraryEmpty = res.libraryEmpty === true;
            reminder.libraryChecked = true;
            reminder.libraryLoading = false;
            reminder.libraryProjectId = projectId;
          }
          if (!candidates.length) {
            reminder.aiLoading = false;
            reminder.aiGenerated = true;
            reminder.aiItems = [];
            reminder.aiIds = [];
            if (reminder.libraryEmpty === true) {
              showTempExecMissingReminderLibraryEmptyToast();
            }
            renderTempExecView();
            return null;
          }
          var snapshot = buildTempExecMissingReminderAiCandidateSnapshot(candidates, fieldTextMap);
          var prompt = (state.assignments && state.assignments.missingReminderPrompt)
            || (window.app && window.app.config && window.app.config.defaultPrompts
              ? window.app.config.defaultPrompts.missingreminder
              : '');
          var reasoning = state.assignments && state.assignments.missingReminderReasoning
            ? state.assignments.missingReminderReasoning
            : '';
          var temperature = state.assignments && state.assignments.missingReminderTemperature !== undefined
            ? state.assignments.missingReminderTemperature
            : 0.2;
          var userPayload = {
            current_cases: context.entries,
            candidate_map: snapshot.map,
          };
          var userText = JSON.stringify(userPayload, null, 2);
          return callModelWithConfig(model, userText, prompt, reasoning, temperature)
            .then(function(content) {
              if (reminder.aiSeq !== seq) return null;
              var ids = parseTempExecMissingReminderAiIds(content);
              var seen = {};
              var selected = [];
              ids.forEach(function(id) {
                var key = String(id || '').trim();
                if (!key || seen[key]) return;
                seen[key] = true;
                var item = snapshot.itemMap[key];
                if (item) {
                  var clone = Object.assign({}, item);
                  selected.push(clone);
                }
              });
              reminder.aiItems = selected;
              reminder.aiIds = ids;
              reminder.aiLoading = false;
              reminder.aiGenerated = true;
              renderTempExecView();
              return null;
            });
        })
        .catch(function(err) {
          if (reminder.aiSeq !== seq) return;
          reminder.aiLoading = false;
          reminder.aiGenerated = true;
          reminder.aiItems = [];
          reminder.aiIds = [];
          reminder.aiError = 'AI 推荐失败：' + (err && err.message ? err.message : err);
          renderTempExecView();
        });
    }

    function hasTempExecMissingReminderAiGenerated(reminder) {
      if (!reminder || reminder.aiGenerated !== true) return false;
      var contextSignature = reminder.aiContextSignature ? String(reminder.aiContextSignature) : '';
      var aiSignature = reminder.aiSignature ? String(reminder.aiSignature) : '';
      if (!contextSignature || !aiSignature) return false;
      return contextSignature === aiSignature;
    }

    function triggerTempExecMissingReminderAiRecommend() {
      var reminder = ensureTempExecMissingReminderState();
      if (resolveMissingReminderAiEnabled() !== 'on') return;
      if (reminder.aiLoading) return;
      var ready = syncTempExecMissingReminderAiContext(reminder);
      if (ready) {
        checkTempExecMissingReminderLibrary(reminder, reminder.aiContextProjectId);
        if (reminder.libraryChecked === true && reminder.libraryEmpty === true) {
          showTempExecMissingReminderLibraryEmptyToast();
          return;
        }
      }
      if (hasTempExecMissingReminderAiGenerated(reminder)) {
        openConfirmDrawer({
          title: '重新生成 AI 推荐',
          message: '已有 AI 推荐结果，是否重新生成？',
          confirmText: '重新生成',
          cancelText: '取消',
        }).then(function(res) {
          if (!res || res.ok !== true) return;
          runTempExecMissingReminderAiRecommend({ trigger: 'confirm' });
        });
        return;
      }
      runTempExecMissingReminderAiRecommend({ trigger: 'button' });
    }

    function renderTempExecView() {
      if (!tempExecView) return;
      var preserveScroll = Boolean(state.tempExecPreserveScrollOnce);
      var scrollSnapshot = null;
      if (preserveScroll && typeof window !== 'undefined' && tempExecView.getBoundingClientRect) {
        scrollSnapshot = {
          top: tempExecView.getBoundingClientRect().top,
          scrollY: window.pageYOffset || document.documentElement.scrollTop || 0,
        };
      }
      var restoreScroll = function() {
        if (!preserveScroll) return;
        state.tempExecPreserveScrollOnce = false;
        if (!scrollSnapshot || !tempExecView.getBoundingClientRect) return;
        var afterTop = tempExecView.getBoundingClientRect().top;
        var delta = afterTop - scrollSnapshot.top;
        if (Math.abs(delta) > 1 && typeof window !== 'undefined' && window.scrollTo) {
          window.scrollTo(0, scrollSnapshot.scrollY + delta);
        }
      };
      var active = getTempExecFile(state.tempExecActiveId);
      if (active) {
        try {
          state.tempExecLastActiveContext = {
            projectId: active.projectId ? String(active.projectId) : '',
            versionId: active.versionId !== null && active.versionId !== undefined ? String(active.versionId || '') : '',
          };
        } catch (err) {
          // ignore
        }
      }
      var ctx = state.tempExecLastActiveContext && typeof state.tempExecLastActiveContext === 'object'
        ? state.tempExecLastActiveContext
        : null;
      var ctxProjectId = active && active.projectId ? String(active.projectId) : (ctx && ctx.projectId ? String(ctx.projectId) : '');
      var ctxVersionId = active && active.versionId !== null && active.versionId !== undefined
        ? String(active.versionId || '')
        : (ctx && ctx.versionId !== null && ctx.versionId !== undefined ? String(ctx.versionId || '') : '');
      var ctxProjectName = ctxProjectId ? resolveProjectName(ctxProjectId) : '';
      var ctxVersionName = (ctxProjectId && ctxVersionId) ? resolveVersionName(ctxProjectId, ctxVersionId) : '';
      var ctxHtml = '';
      if (ctxProjectId || ctxVersionId) {
        ctxHtml =
          '<div class="temp-exec-context">' +
            '<span class="temp-exec-context-label">当前用例归属：</span>' +
            '<span class="temp-exec-context-kv">' +
              (ctxProjectName ? ('项目 ' + escapeHtml(ctxProjectName)) : '') +
              (ctxVersionName ? (' / 版本 ' + escapeHtml(ctxVersionName)) : '') +
            '</span>' +
          '</div>';
      }
      if (!active) {
        renderTempExecToolbar(null);
        clearTempExecMissingReminder();
        tempExecView.innerHTML = ctxHtml + '<div class="temp-case-empty">暂无执行用例，请通过“用例导入”抽屉导入，或在“执行分配”中选择历史记录</div>';
        if (tempExecMindContainer) tempExecMindContainer.classList.add('hidden');
        state.tempExecMindMode = false;
        if (exportTempExecBtn) exportTempExecBtn.disabled = true;
        if (exportTempExecXmindBtn) exportTempExecXmindBtn.disabled = true;
        if (tempExecCaseLibraryChangesBtn) tempExecCaseLibraryChangesBtn.disabled = true;
        if (tempExecMindBtn) {
          tempExecMindBtn.disabled = true;
          tempExecMindBtn.textContent = '切换思维导图视图';
        }
        tempExecView.classList.remove('hidden');
        restoreScroll();
        return;
      }
      renderTempExecToolbar(active);
      var reminderHtml = renderTempExecMissingReminderBlock();
      var placement = resolveMissingReminderPlacement();
      if (placement === 'bottom') {
        tempExecView.innerHTML = ctxHtml + renderTempExecTable(active) + reminderHtml;
      } else {
        tempExecView.innerHTML = ctxHtml + reminderHtml + renderTempExecTable(active);
      }
      var utils = window.app && window.app.utils ? window.app.utils : null;
      if (utils && typeof utils.bindMissingReminderScrollHint === 'function') {
        utils.bindMissingReminderScrollHint(tempExecView);
      }
      if (state.tempExecMindMode && tempExecMindContainer) {
        tempExecMindContainer.innerHTML = '';
        tempExecMindContainer.classList.remove('hidden');
        tempExecView.classList.add('hidden');
        if (tempExecMindBtn) tempExecMindBtn.textContent = '返回列表视图';
      } else if (tempExecMindContainer) {
        tempExecMindContainer.classList.add('hidden');
        tempExecView.classList.remove('hidden');
        if (tempExecMindBtn) tempExecMindBtn.textContent = '切换思维导图视图';
      }
      if (exportTempExecBtn) exportTempExecBtn.disabled = false;
      if (exportTempExecXmindBtn) exportTempExecXmindBtn.disabled = false;
      if (exportTempExecCasesXmindBtn) exportTempExecCasesXmindBtn.disabled = false;
      if (tempExecMindBtn) tempExecMindBtn.disabled = false;
      syncTempExecCaseLibraryChangesButton(active);
      renderTempExecOverview();
      syncTempExecReuseStatusAlign();
      requestTempExecMissingReminderRefresh();
      if (resolveMissingReminderAiEnabled() !== 'on') {
        scheduleTempExecMissingReminderLazyLoad();
      }
      restoreScroll();
    }

    function normalizeDbTimeInput(input) {
      if (!input) return '';
      if (typeof input === 'number') return input;
      var text = String(input || '').trim();
      if (!text) return '';
      // 兼容 SQLite/Pydantic 输出：若时间不含时区信息，默认按 UTC 解释（避免展示少 8 小时）。
      if (text.indexOf('T') === -1 && text.indexOf(' ') !== -1) {
        text = text.replace(' ', 'T');
      }
      // 毫秒统一裁剪为 3 位，避免部分浏览器解析失败。
      text = text.replace(/(\.\d{3})\d+/, '$1');
      // Safari 兼容：将 +08:00 转为 +0800
      text = text.replace(/([+-]\d{2}):(\d{2})$/, '$1$2');
      var hasTz = /Z$/i.test(text) || /[+-]\d{2}\d{2}$/.test(text) || /[+-]\d{2}:\d{2}$/.test(text);
      var isIsoWithTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text);
      if (isIsoWithTime && !hasTz) text += 'Z';
      return text;
    }

    function parseDbTimeMs(value) {
      if (!value) return 0;
      if (typeof value === 'number') {
        return Number.isFinite(value) && value > 0 ? value : 0;
      }
      var normalized = normalizeDbTimeInput(value);
      var ts = 0;
      try { ts = Date.parse(normalized || value); } catch (err) { ts = 0; }
      if (!isFinite(ts) || ts <= 0) return 0;
      return ts;
    }

    function normalizeCaseLibrarySyncMeta(raw) {
      var res = raw && typeof raw === 'object' ? raw : {};
      var summary = res.summary && typeof res.summary === 'object' ? res.summary : {};
      var diff = Array.isArray(res.diff) ? res.diff : [];
      var historyRaw = Array.isArray(res.history) ? res.history : [];
      var history = historyRaw
        .map(function(item) {
          var it = item && typeof item === 'object' ? item : {};
          var diffAt = it.diff_at || it.diffAt || it.last_diff_at || it.lastDiffAt || '';
          var operator = it.operator || it.operator_name || it.operatorName || '';
          var sum = it.summary && typeof it.summary === 'object' ? it.summary : {};
          var d = Array.isArray(it.diff) ? it.diff : [];
          return {
            diffAt: diffAt ? String(diffAt) : '',
            operator: operator ? String(operator) : '',
            summary: {
              appended: Number(sum.appended) || 0,
              added: Number(sum.added) || 0,
              updated: Number(sum.updated) || 0,
              deleted: Number(sum.deleted) || 0,
            },
            diff: d,
          };
        })
        .filter(function(item) { return item && item.diffAt; });
      history.sort(function(a, b) {
        return parseDbTimeMs(b && b.diffAt) - parseDbTimeMs(a && a.diffAt);
      });
      return {
        execSetId: res.exec_set_id || res.execSetId || null,
        caseFileId: res.case_file_id || res.caseFileId || null,
        caseFileUpdatedAt: res.case_file_updated_at || res.caseFileUpdatedAt || null,
        baseUpdatedAt: res.base_updated_at || res.baseUpdatedAt || null,
        lastDiffAt: res.last_diff_at || res.lastDiffAt || null,
        lastShownAt: res.last_shown_at || res.lastShownAt || null,
        everChanged: Boolean(res.ever_changed || res.everChanged),
        hasNewDiff: Boolean(res.has_new_diff || res.hasNewDiff),
        shouldAutoPopup: Boolean(res.should_auto_popup || res.shouldAutoPopup),
        summary: {
          appended: Number(summary.appended) || 0,
          added: Number(summary.added) || 0,
          updated: Number(summary.updated) || 0,
          deleted: Number(summary.deleted) || 0,
        },
        diff: diff,
        history: history,
      };
    }

    function hasCaseLibraryChangeSignal(meta) {
      if (!meta) return false;
      if (meta.everChanged === true) return true;
      if (Array.isArray(meta.diff) && meta.diff.length) return true;
      if (Array.isArray(meta.history) && meta.history.length) return true;
      if (meta.summary) {
        var summary = meta.summary || {};
        if (Number(summary.appended) || Number(summary.added) || Number(summary.updated) || Number(summary.deleted)) {
          return true;
        }
      }
      if (meta.lastDiffAt) return true;
      var baseTs = parseDbTimeMs(meta.baseUpdatedAt);
      var fileTs = parseDbTimeMs(meta.caseFileUpdatedAt);
      if (baseTs && fileTs && fileTs > baseTs) return true;
      return false;
    }

    function mergeCaseLibrarySyncMeta(prev, next) {
      if (!prev) return next;
      if (!next) return prev;
      var nextSummary = next.summary || {};
      var nextSummarySignal = Boolean(
        Number(nextSummary.appended) ||
        Number(nextSummary.added) ||
        Number(nextSummary.updated) ||
        Number(nextSummary.deleted)
      );
      var nextHasSignal = Boolean(
        next.everChanged === true ||
        (Array.isArray(next.diff) && next.diff.length) ||
        (Array.isArray(next.history) && next.history.length) ||
        next.lastDiffAt ||
        nextSummarySignal
      );
      if (nextHasSignal) return next;
      var merged = {};
      Object.keys(next).forEach(function(key) { merged[key] = next[key]; });
      if (prev.everChanged) merged.everChanged = true;
      if ((!merged.diff || !merged.diff.length) && Array.isArray(prev.diff) && prev.diff.length) {
        merged.diff = prev.diff;
      }
      if ((!merged.history || !merged.history.length) && Array.isArray(prev.history) && prev.history.length) {
        merged.history = prev.history;
      }
      if (!merged.lastDiffAt && prev.lastDiffAt) merged.lastDiffAt = prev.lastDiffAt;
      if (!merged.lastShownAt && prev.lastShownAt) merged.lastShownAt = prev.lastShownAt;
      if (merged.summary && prev.summary) {
        var sum = merged.summary;
        var empty = !(sum.appended || sum.added || sum.updated || sum.deleted);
        if (empty) merged.summary = prev.summary;
      }
      if (!merged.caseFileId && prev.caseFileId) merged.caseFileId = prev.caseFileId;
      return merged;
    }

    function applyTempExecCaseLibrarySyncMeta(file, syncRes) {
      var meta = normalizeCaseLibrarySyncMeta(syncRes);
      var execSetId = meta && meta.execSetId ? meta.execSetId : (file && file.execSetId ? file.execSetId : null);
      if (!execSetId) return null;
      if (!meta.execSetId) meta.execSetId = execSetId;
      if (!meta.caseFileId && file && (file.caseFileId || file.caseFileId === 0)) {
        meta.caseFileId = file.caseFileId;
      }
      var store = ensureTempExecCaseLibraryDiffState();
      var prevMeta = store.byExecSetId[String(execSetId)] || null;
      meta = mergeCaseLibrarySyncMeta(prevMeta, meta);
      store.byExecSetId[String(execSetId)] = meta;
      var latestFile = file || getTempExecFile(String(execSetId));
      if (latestFile) latestFile.caseLibraryMeta = meta;
      if (meta && meta.shouldAutoPopup) {
        queueTempExecCaseLibraryAutoPopup(execSetId, meta);
      } else {
        clearTempExecCaseLibraryAutoPopup(execSetId, meta);
      }
      if (String(state.tempExecActiveId || '') === String(execSetId)) {
        syncTempExecCaseLibraryChangesButton(getTempExecFile(state.tempExecActiveId));
      }
      tryAutoOpenTempExecRestoreDiff(execSetId, meta);
      return meta;
    }

    function getTempExecFileNameByExecSetId(execSetId) {
      if (!execSetId) return '';
      var file = getTempExecFile(String(execSetId));
      if (file && file.name) return String(file.name);
      return '执行集#' + String(execSetId);
    }

    function listTempExecCaseLibraryDiffExecSetIds(options) {
      options = options || {};
      var store = ensureTempExecCaseLibraryDiffState();
      var ids = Object.keys(store.byExecSetId || {});
      var list = ids
        .map(function(id) {
          var meta = store.byExecSetId[id] || null;
          if (!meta) return null;
          var hasHistory = Boolean(meta && Array.isArray(meta.history) && meta.history.length);
          var hasDiff = hasHistory || Boolean(meta && Array.isArray(meta.diff) && meta.diff.length);
          var available = Boolean(meta && (hasDiff || hasCaseLibraryChangeSignal(meta)));
          if (!available) return null;
          var ts = 0;
          if (hasHistory && meta.history[0] && meta.history[0].diffAt) {
            ts = parseDbTimeMs(meta.history[0].diffAt);
          } else if (meta.lastDiffAt) {
            ts = parseDbTimeMs(meta.lastDiffAt);
          }
          if (!isFinite(ts)) ts = 0;
          return {
            execSetId: String(id),
            name: getTempExecFileNameByExecSetId(id),
            unacked: hasUnackedCaseLibraryDiff(meta),
            hasNew: Boolean(meta && meta.hasNewDiff),
            shouldAuto: Boolean(meta && meta.shouldAutoPopup),
            lastTs: ts,
          };
        })
        .filter(Boolean);
      list.sort(function(a, b) {
        if (a.unacked !== b.unacked) return a.unacked ? -1 : 1;
        if (a.shouldAuto !== b.shouldAuto) return a.shouldAuto ? -1 : 1;
        if (a.hasNew !== b.hasNew) return a.hasNew ? -1 : 1;
        if (a.lastTs !== b.lastTs) return b.lastTs - a.lastTs;
        return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN');
      });
      return list.map(function(it) { return it.execSetId; });
    }

    function setTempExecCaseLibraryDiffSelectedExecSetId(execSetId) {
      state.tempExecCaseLibraryDiffSelectedExecSetId = execSetId ? String(execSetId) : '';
    }

    function getTempExecCaseLibraryDiffSelectedExecSetId() {
      var id = state.tempExecCaseLibraryDiffSelectedExecSetId ? String(state.tempExecCaseLibraryDiffSelectedExecSetId) : '';
      return id;
    }

    function updateTempExecFileCaseLibraryMeta(file, meta) {
      if (!file) return;
      file.caseLibraryMeta = meta || null;
      var store = ensureTempExecCaseLibraryDiffState();
      var execSetId = file.execSetId || (meta && meta.execSetId) || null;
      if (!execSetId) return;
      store.byExecSetId[String(execSetId)] = meta || null;
    }

    function hasUnackedCaseLibraryDiff(meta) {
      if (!meta) return false;
      var lastDiffAt = meta.lastDiffAt ? String(meta.lastDiffAt) : '';
      if (!lastDiffAt) return false;
      var lastShownAt = meta.lastShownAt ? String(meta.lastShownAt) : '';
      if (!lastShownAt) return true;
      var diffTs = parseDbTimeMs(lastDiffAt);
      var shownTs = parseDbTimeMs(lastShownAt);
      if (!diffTs) return false;
      if (!shownTs) return true;
      return diffTs > shownTs;
    }

    function syncTempExecCaseLibraryChangesButton(file) {
      if (!tempExecCaseLibraryChangesBtn) return;
      if (!file || !file.execSetId || !isDbMode()) {
        tempExecCaseLibraryChangesBtn.disabled = true;
        try { tempExecCaseLibraryChangesBtn.classList.remove('has-new'); } catch (err) {}
        return;
      }
      var store = ensureTempExecCaseLibraryDiffState();
      var meta = store.byExecSetId[String(file.execSetId)] || (file.caseLibraryMeta || null);
      tempExecCaseLibraryChangesBtn.disabled = false;
      try {
        tempExecCaseLibraryChangesBtn.classList.toggle('has-new', hasUnackedCaseLibraryDiff(meta));
      } catch (err) {
        // ignore
      }
    }

    function getCaseLibDiffKindLabel(kind) {
      if (kind === 'appended') return '追加';
      if (kind === 'added') return '新增';
      if (kind === 'updated') return '改动';
      if (kind === 'deleted') return '删除';
      return '';
    }

    function normalizeCaseLibDiffItemId(entry) {
      if (!entry) return '';
      var id = entry.case_item_id;
      if (id === null || id === undefined) id = entry.caseItemId;
      if (id === null || id === undefined) return '';
      return String(id);
    }

    function buildTempExecCaseItemIdSet(file) {
      if (!file || !Array.isArray(file.cases)) return null;
      if (file._casesLoading) return null;
      var ids = new Set();
      file.cases.forEach(function(item) {
        if (!item) return;
        var id = item.caseItemId || item.case_item_id || null;
        if (id === null || id === undefined) return;
        ids.add(String(id));
      });
      return ids;
    }

    function filterTempExecCaseLibraryDiffRows(execSetId, rows) {
      if (!execSetId || !Array.isArray(rows) || !rows.length) return rows;
      var file = getTempExecFile(String(execSetId));
      var idSet = buildTempExecCaseItemIdSet(file);
      if (!idSet) return rows;
      return rows.filter(function(row) {
        var entry = row && row.entry ? row.entry : null;
        var kind = normalizeDiffKind(entry && entry.kind ? entry.kind : '');
        if (kind === 'deleted') return true;
        var caseItemId = normalizeCaseLibDiffItemId(entry);
        if (!caseItemId) return true;
        return idSet.has(caseItemId);
      });
    }

    function summarizeTempExecCaseLibraryDiffRows(rows) {
      var summary = { appended: 0, added: 0, updated: 0, deleted: 0 };
      if (!Array.isArray(rows) || !rows.length) return summary;
      rows.forEach(function(row) {
        var kind = normalizeDiffKind(row && row.entry ? row.entry.kind : '');
        if (kind === 'appended') summary.appended += 1;
        if (kind === 'added') summary.added += 1;
        if (kind === 'updated') summary.updated += 1;
        if (kind === 'deleted') summary.deleted += 1;
      });
      return summary;
    }

    function findTempExecCaseIndexByItemId(file, caseItemId) {
      if (!file || !Array.isArray(file.cases)) return -1;
      var target = String(caseItemId || '');
      if (!target) return -1;
      for (var i = 0; i < file.cases.length; i += 1) {
        var item = file.cases[i];
        if (!item) continue;
        var id = item.caseItemId || item.case_item_id || null;
        if (id !== null && id !== undefined && String(id) === target) return i;
      }
      return -1;
    }

    var tempExecLocateTimer = 0;
    var tempExecLocateTarget = null;
    function clearTempExecLocateHighlight() {
      if (tempExecLocateTimer) clearTimeout(tempExecLocateTimer);
      tempExecLocateTimer = 0;
      if (tempExecLocateTarget && tempExecLocateTarget.classList) {
        tempExecLocateTarget.classList.remove('locate-highlight');
      }
      tempExecLocateTarget = null;
    }
    function flashTempExecLocate(target) {
      if (!target || !target.classList) return;
      if (tempExecLocateTarget && tempExecLocateTarget !== target) {
        clearTempExecLocateHighlight();
      } else if (tempExecLocateTimer) {
        clearTimeout(tempExecLocateTimer);
        tempExecLocateTimer = 0;
      }
      tempExecLocateTarget = target;
      target.classList.add('locate-highlight');
      tempExecLocateTimer = setTimeout(function() {
        if (tempExecLocateTarget === target && target.classList) {
          target.classList.remove('locate-highlight');
        }
        if (tempExecLocateTarget === target) tempExecLocateTarget = null;
        tempExecLocateTimer = 0;
      }, 1600);
    }

    function scrollToTempExecCaseRow(fileId, idx, options) {
      var opts = options && typeof options === 'object' ? options : {};
      var attempts = 0;
      var maxAttempts = 30;
      var offset = Number(opts.offset);
      if (!Number.isFinite(offset)) offset = 140;
      var storeRestore = opts.storeRestore !== false;
      function tryScroll() {
        attempts += 1;
        var container = tempExecView;
        if (!container) return;
        var selector = 'tr.case-row[data-temp-case-row="' + String(fileId) + '"][data-index="' + String(idx) + '"]';
        var target = container.querySelector(selector);
        if (!target) {
          if (attempts < maxAttempts) setTimeout(tryScroll, 40);
          return;
        }
        var desired = 0;
        if (storeRestore && typeof window !== 'undefined') {
          var rect = target.getBoundingClientRect();
          var scrollTop = 0;
          if (typeof window.scrollY === 'number') {
            scrollTop = window.scrollY;
          } else if (document && document.documentElement) {
            scrollTop = document.documentElement.scrollTop || document.body.scrollTop || 0;
          }
          desired = Math.max(0, Math.round(scrollTop + rect.top - offset));
          try {
            window.app = window.app || {};
            window.app.__drawerRestoreScrollTopOnce = desired;
          } catch (err) {
            // ignore
          }
        }
        var scrolled = false;
        if (target && typeof target.scrollIntoView === 'function') {
          try {
            target.scrollIntoView({ block: 'center', behavior: 'auto' });
            scrolled = true;
          } catch (err2) {
            try {
              target.scrollIntoView();
              scrolled = true;
            } catch (err3) {
              scrolled = false;
            }
          }
        }
        if (!scrolled) {
          scrollElementIntoView(target, 'auto', 160);
        }
        flashTempExecLocate(target);
        if (storeRestore && typeof window !== 'undefined') {
          setTimeout(function() {
            try {
              window.app = window.app || {};
              window.app.__drawerRestoreScrollTopOnce = desired;
              window.app.__drawerSkipRestoreOnce = true;
              window.app.__drawerRestoreScrollTopOnce = null;
            } catch (err4) {
              // ignore
            }
          }, 60);
        }
      }
      setTimeout(tryScroll, 60);
    }

    function locateTempExecCaseFromDiff(entry, execSetId) {
      var fileId = execSetId ? String(execSetId) : '';
      var caseItemId = normalizeCaseLibDiffItemId(entry);
      if (!fileId || !caseItemId) {
        if (tempExecCaseLibraryDiffStatus) setStatus(tempExecCaseLibraryDiffStatus, '未找到可定位的用例信息', 'warn');
        return;
      }
      var file = getTempExecFile(fileId);
      if (!file) {
        if (tempExecCaseLibraryDiffStatus) setStatus(tempExecCaseLibraryDiffStatus, '未找到对应执行用例文件', 'warn');
        return;
      }
      var idx = findTempExecCaseIndexByItemId(file, caseItemId);
      if (idx < 0) {
        if (tempExecCaseLibraryDiffStatus) setStatus(tempExecCaseLibraryDiffStatus, '未在执行视图找到对应变更用例', 'warn');
        return;
      }
      if (tempExecViewSection && tempExecViewSection.classList) {
        tempExecViewSection.classList.remove('hidden');
      }
      var result = jumpToTempExecCase(fileId, idx, { clearFilters: true });
      if (!result || result.ok !== true) {
        if (tempExecCaseLibraryDiffStatus) setStatus(tempExecCaseLibraryDiffStatus, '定位执行用例失败，请刷新后重试', 'warn');
        return;
      }
      scrollToTempExecCaseRow(fileId, idx, { storeRestore: true });
    }

    function renderTempExecCaseLibraryDiffCaseTabs(selectedExecSetId) {
      if (!tempExecCaseLibraryDiffCaseTabs) return;
      var ids = listTempExecCaseLibraryDiffExecSetIds();
      if (!ids.length) {
        tempExecCaseLibraryDiffCaseTabs.innerHTML = '';
        return;
      }
      tempExecCaseLibraryDiffCaseTabs.innerHTML = ids
        .map(function(id) {
          var store = ensureTempExecCaseLibraryDiffState();
          var meta = store.byExecSetId[String(id)] || null;
          var cls = 'summary-pill case-lib-diff-case-pill' + (String(id) === String(selectedExecSetId || '') ? ' active' : '');
          if (hasUnackedCaseLibraryDiff(meta)) cls += ' has-new';
          if (meta && meta.shouldAutoPopup) cls += ' needs-attention';
          return (
            '<button type="button" class="' + cls + '" data-case-lib-diff-exec-set="' + escapeHtml(id) + '">' +
              escapeHtml(getTempExecFileNameByExecSetId(id)) +
            '</button>'
          );
        })
        .join('');
    }

    function renderTempExecCaseLibraryDiff(execSetId) {
      if (!tempExecCaseLibraryDiffBody) return;
      var store = ensureTempExecCaseLibraryDiffState();
      var lastRendered = state.tempExecCaseLibraryDiffLastRenderedExecSetId ? String(state.tempExecCaseLibraryDiffLastRenderedExecSetId) : '';
      var nextRendered = execSetId ? String(execSetId) : '';
      if (nextRendered && nextRendered !== lastRendered) {
        store.filterByExecSetId[nextRendered] = '';
        state.tempExecCaseLibraryDiffLastRenderedExecSetId = nextRendered;
      }
      var meta = execSetId ? store.byExecSetId[String(execSetId)] : null;
      var filter = execSetId && store.filterByExecSetId[String(execSetId)]
        ? String(store.filterByExecSetId[String(execSetId)])
        : '';
      if (filter !== 'added' && filter !== 'updated' && filter !== 'deleted') filter = '';

      setTempExecCaseLibraryDiffSelectedExecSetId(execSetId);
      if (tempExecCaseLibraryDiffCaseName) {
        tempExecCaseLibraryDiffCaseName.textContent = getTempExecFileNameByExecSetId(execSetId || '');
      }
      renderTempExecCaseLibraryDiffCaseTabs(execSetId);

      function formatCaseLibDiffTime(iso) {
        if (!iso) return '';
        var ts = parseDbTimeMs(iso);
        if (!ts) return String(iso || '');
        var d = new Date(ts);
        var pad = function(n) { return n < 10 ? '0' + n : String(n); };
        return (
          d.getFullYear() + '-' +
          pad(d.getMonth() + 1) + '-' +
          pad(d.getDate()) + ' ' +
          pad(d.getHours()) + ':' +
          pad(d.getMinutes()) + ':' +
          pad(d.getSeconds())
        );
      }

      var batches = meta && Array.isArray(meta.history) && meta.history.length ? meta.history : [];
      if (!batches.length) {
        var fallbackDiff = meta && Array.isArray(meta.diff) ? meta.diff : [];
        var fallbackSummary = meta && meta.summary ? meta.summary : { appended: 0, added: 0, updated: 0, deleted: 0 };
        if (fallbackDiff.length) {
          batches = [{
            diffAt: meta && meta.lastDiffAt ? String(meta.lastDiffAt) : '',
            summary: fallbackSummary,
            diff: fallbackDiff,
          }];
        }
      }

      var totalSummary = { appended: 0, added: 0, updated: 0, deleted: 0 };
      var rows = [];
      batches.forEach(function(batch) {
        if (!batch) return;
        var diffAt = batch.diffAt ? String(batch.diffAt) : '';
        var operator = batch.operator ? String(batch.operator) : '';
        var batchTs = parseDbTimeMs(diffAt);
        if (!isFinite(batchTs)) batchTs = 0;
        var sum = batch.summary && typeof batch.summary === 'object' ? batch.summary : {};
        var diff = Array.isArray(batch.diff) ? batch.diff : [];
        var hasSum = Number.isFinite(Number(sum.appended)) || Number.isFinite(Number(sum.added)) || Number.isFinite(Number(sum.updated)) || Number.isFinite(Number(sum.deleted));
        if (hasSum) {
          totalSummary.appended += Number(sum.appended) || 0;
          totalSummary.added += Number(sum.added) || 0;
          totalSummary.updated += Number(sum.updated) || 0;
          totalSummary.deleted += Number(sum.deleted) || 0;
        } else {
          diff.forEach(function(entry) {
            var k = normalizeDiffKind(entry && entry.kind);
            if (k === 'appended') totalSummary.appended += 1;
            if (k === 'added') totalSummary.added += 1;
            if (k === 'updated') totalSummary.updated += 1;
            if (k === 'deleted') totalSummary.deleted += 1;
          });
        }
        diff.forEach(function(entry) {
          rows.push({ entry: entry, diffAt: diffAt, operator: operator, ts: batchTs });
        });
      });
      if (!rows.length && meta && meta.summary) {
        var fallbackSummary = meta.summary || {};
        var hasFallback = Number(fallbackSummary.appended) || Number(fallbackSummary.added) || Number(fallbackSummary.updated) || Number(fallbackSummary.deleted);
        var emptyTotals = !(totalSummary.appended || totalSummary.added || totalSummary.updated || totalSummary.deleted);
        if (hasFallback && emptyTotals) {
          totalSummary.appended = Number(fallbackSummary.appended) || 0;
          totalSummary.added = Number(fallbackSummary.added) || 0;
          totalSummary.updated = Number(fallbackSummary.updated) || 0;
          totalSummary.deleted = Number(fallbackSummary.deleted) || 0;
        }
      }

      rows.sort(function(a, b) {
        var ta = a && a.ts ? Number(a.ts) : 0;
        var tb = b && b.ts ? Number(b.ts) : 0;
        if (ta !== tb) return tb - ta;
        var ka = normalizeDiffKind(a && a.entry ? a.entry.kind : '');
        var kb = normalizeDiffKind(b && b.entry ? b.entry.kind : '');
        if (ka !== kb) return String(kb).localeCompare(String(ka));
        return 0;
      });

      var availableRows = filterTempExecCaseLibraryDiffRows(execSetId, rows);
      if (availableRows.length !== rows.length) {
        totalSummary = summarizeTempExecCaseLibraryDiffRows(availableRows);
      }

      var visible = availableRows.filter(function(row) {
        var entry = row && row.entry ? row.entry : null;
        var kind = normalizeDiffKind(entry && entry.kind);
        if (!kind) return false;
        if (!filter) return true;
        return kind === filter;
      });

      if (tempExecCaseLibraryDiffAppendedPill) {
        tempExecCaseLibraryDiffAppendedPill.textContent = '追加 ' + (totalSummary.appended || 0);
        tempExecCaseLibraryDiffAppendedPill.classList.toggle('active', filter === 'appended');
      }
      if (tempExecCaseLibraryDiffAddedPill) {
        tempExecCaseLibraryDiffAddedPill.textContent = '新增 ' + (totalSummary.added || 0);
        tempExecCaseLibraryDiffAddedPill.classList.toggle('active', filter === 'added');
      }
      if (tempExecCaseLibraryDiffUpdatedPill) {
        tempExecCaseLibraryDiffUpdatedPill.textContent = '改动 ' + (totalSummary.updated || 0);
        tempExecCaseLibraryDiffUpdatedPill.classList.toggle('active', filter === 'updated');
      }
      if (tempExecCaseLibraryDiffDeletedPill) {
        tempExecCaseLibraryDiffDeletedPill.textContent = '删除 ' + (totalSummary.deleted || 0);
        tempExecCaseLibraryDiffDeletedPill.classList.toggle('active', filter === 'deleted');
      }

      if (tempExecCaseLibraryDiffStatus) {
        var statusText = '';
        var hasSignal = hasCaseLibraryChangeSignal(meta);
        if (!meta) {
          statusText = '暂无用例变更数据';
        } else if (meta.hasNewDiff) {
          statusText = '已同步用例变更到执行页：追加 ' + totalSummary.appended + '，新增 ' + totalSummary.added + '，改动 ' + totalSummary.updated + '，删除 ' + totalSummary.deleted;
        } else if (meta.everChanged || hasSignal) {
          statusText = '暂无新的用例变更，可查看历史差异：追加 ' + totalSummary.appended + '，新增 ' + totalSummary.added + '，改动 ' + totalSummary.updated + '，删除 ' + totalSummary.deleted;
        } else {
          statusText = '当前用例未发生用例变更';
        }
        setStatus(tempExecCaseLibraryDiffStatus, statusText, meta && (meta.everChanged || hasSignal) ? 'ok' : '');
      }

      if (!visible.length) {
        tempExecCaseLibraryDiffBody.innerHTML = '<tr><td colspan="8"><p class="hint">暂无变更</p></td></tr>';
        return;
      }

      function buildCell(oldSnap, newSnap, key, changed) {
        var oldVal = oldSnap && oldSnap[key] !== undefined && oldSnap[key] !== null ? String(oldSnap[key]) : '';
        var newVal = newSnap && newSnap[key] !== undefined && newSnap[key] !== null ? String(newSnap[key]) : '';
        if (!changed) {
          var text = newVal || oldVal || '';
          return '<div class="case-lib-diff-cell"><div class="case-lib-diff-only">' + escapeHtmlPreserve(text) + '</div></div>';
        }
        return (
          '<div class="case-lib-diff-cell">' +
            '<div class="case-lib-diff-old">旧：' + escapeHtmlPreserve(oldVal) + '</div>' +
            '<div class="case-lib-diff-new">新：' + escapeHtmlPreserve(newVal) + '</div>' +
          '</div>'
        );
      }

      tempExecCaseLibraryDiffBody.innerHTML = visible.map(function(row) {
        var entry = row && row.entry ? row.entry : null;
        var kind = normalizeDiffKind(entry && entry.kind);
        var caseItemId = normalizeCaseLibDiffItemId(entry);
        var oldSnap = entry && entry.old && typeof entry.old === 'object' ? entry.old : null;
        var newSnap = entry && entry.new && typeof entry.new === 'object' ? entry.new : null;
        var changedFields = Array.isArray(entry && entry.changed_fields) ? entry.changed_fields : [];
        var changedMap = {};
        changedFields.forEach(function(f) { changedMap[String(f)] = true; });
        var typeTag = '<span class="tag case-lib-diff-kind ' + kind + '">' + escapeHtml(getCaseLibDiffKindLabel(kind)) + '</span>';
        var timeText = formatCaseLibDiffTime(row && row.diffAt ? row.diffAt : '');
        var operatorText = row && row.operator ? String(row.operator) : '';
        var canLocate = Boolean(caseItemId && (kind === 'appended' || kind === 'added' || kind === 'updated'));
        var rowClass = 'case-lib-diff-row' + (canLocate ? ' case-lib-diff-clickable' : '');
        var rowAttrs = canLocate
          ? (' data-case-lib-diff-case-id="' + escapeHtml(caseItemId) + '" data-case-lib-diff-kind="' + escapeHtml(kind) + '"')
          : '';
        return (
          '<tr class="' + rowClass + '"' + rowAttrs + '>' +
            '<td>' + typeTag + '</td>' +
            '<td class="case-lib-diff-time">' + escapeHtml(timeText) + '</td>' +
            '<td class="case-lib-diff-operator">' + escapeHtml(operatorText) + '</td>' +
            '<td>' + buildCell(oldSnap, newSnap, 'module', Boolean(changedMap.module)) + '</td>' +
            '<td>' + buildCell(oldSnap, newSnap, 'title', Boolean(changedMap.title)) + '</td>' +
            '<td>' + buildCell(oldSnap, newSnap, 'precondition', Boolean(changedMap.precondition)) + '</td>' +
            '<td>' + buildCell(oldSnap, newSnap, 'steps', Boolean(changedMap.steps)) + '</td>' +
            '<td>' + buildCell(oldSnap, newSnap, 'expected', Boolean(changedMap.expected)) + '</td>' +
          '</tr>'
        );
      }).join('');
    }

    function ensureTempExecCaseLibraryDiffDrawer() {
      if (tempExecCaseLibraryDiffDrawer) return tempExecCaseLibraryDiffDrawer;
      if (typeof window === 'undefined') return null;
      var drawerApi = window.app && window.app.drawer ? window.app.drawer : null;
      if (!drawerApi || typeof drawerApi.createDrawer !== 'function') return null;
      tempExecCaseLibraryDiffDrawer = drawerApi.createDrawer({ drawerId: 'tempExecCaseLibraryDiffDrawer' });
      if (tempExecCaseLibraryDiffDrawer && tempExecCaseLibraryDiffDrawer.element) {
        tempExecCaseLibraryDiffDrawer.element.addEventListener('click', function(e) {
          var target = e && e.target ? e.target : null;
          if (!target || !target.closest) return;
          var selectBtn = target.closest('#tempExecCaseLibraryDiffSelectCaseBtn');
          if (selectBtn) {
            var selected = getTempExecCaseLibraryDiffSelectedExecSetId();
            if (selected) setTempExecActive(String(selected));
            return;
          }
          var caseBtn = target.closest('[data-case-lib-diff-exec-set]');
          if (caseBtn && caseBtn.dataset && caseBtn.dataset.caseLibDiffExecSet) {
            var nextExecSetId = String(caseBtn.dataset.caseLibDiffExecSet || '');
            if (nextExecSetId) {
              renderTempExecCaseLibraryDiff(nextExecSetId);
            }
            return;
          }
          var diffRow = target.closest('tr.case-lib-diff-clickable');
          if (diffRow && diffRow.dataset && diffRow.dataset.caseLibDiffCaseId) {
            var execSetId = getTempExecCaseLibraryDiffSelectedExecSetId();
            if (!execSetId) execSetId = state.tempExecActiveId ? String(state.tempExecActiveId || '') : '';
            locateTempExecCaseFromDiff(
              { case_item_id: diffRow.dataset.caseLibDiffCaseId, kind: diffRow.dataset.caseLibDiffKind },
              execSetId
            );
            return;
          }
          var pill = target.closest('[data-case-lib-diff-filter]');
          if (!pill) return;
          var selectedExecSetId = getTempExecCaseLibraryDiffSelectedExecSetId();
          var execSetId = selectedExecSetId ? String(selectedExecSetId) : '';
          if (!execSetId) {
            var active = getTempExecFile(state.tempExecActiveId);
            execSetId = active && active.execSetId ? String(active.execSetId) : '';
          }
          if (!execSetId) return;
          var next = String(pill.dataset.caseLibDiffFilter || '');
          if (next !== 'appended' && next !== 'added' && next !== 'updated' && next !== 'deleted') return;
          var store = ensureTempExecCaseLibraryDiffState();
          var current = store.filterByExecSetId[execSetId] ? String(store.filterByExecSetId[execSetId]) : '';
          store.filterByExecSetId[execSetId] = (current === next) ? '' : next;
          renderTempExecCaseLibraryDiff(execSetId);
        });
      }
      return tempExecCaseLibraryDiffDrawer;
    }

    function openTempExecCaseLibraryDiffDrawer(options) {
      options = options || {};
      var manual = Boolean(options.manual);
      var desired = options.execSetId ? String(options.execSetId) : '';
      var saved = getTempExecCaseLibraryDiffSelectedExecSetId();
      var active = getTempExecFile(state.tempExecActiveId);
      var activeExecSetId = active && active.execSetId ? String(active.execSetId) : '';
      // 用户在执行视图点击“用例变更”时：优先打开当前用例的变更（并清除当前用例的醒目提醒）。
      // 避免出现“上次选中过其他用例 -> 本次点击仍打开旧用例 -> 当前按钮一直醒目”的错觉。
      var execSetId = desired || (manual ? (activeExecSetId || saved) : (saved || activeExecSetId)) || '';
      if (!execSetId && active && (active.execSetId || active.id)) {
        execSetId = String(active.execSetId || active.id || '');
      }
      if (!execSetId && Array.isArray(state.tempExecFiles) && state.tempExecFiles.length) {
        var fallback = state.tempExecFiles[0];
        if (fallback && (fallback.execSetId || fallback.id)) {
          execSetId = String(fallback.execSetId || fallback.id || '');
        }
      }
      if (!execSetId) return false;
      if (manual) setTempExecCaseLibraryDiffSelectedExecSetId(execSetId);
      var store = ensureTempExecCaseLibraryDiffState();
      var meta = store.byExecSetId[String(execSetId)] || null;
      var hasDiff = Boolean(meta && Array.isArray(meta.diff) && meta.diff.length);
      var hasHistory = Boolean(meta && Array.isArray(meta.history) && meta.history.length);
      var hasSignal = Boolean(meta && (hasDiff || hasHistory || hasCaseLibraryChangeSignal(meta)));
      if (manual && isDbMode()) {
        var client = getApiClient();
        if (client && typeof client.syncExecSetCaseLibrary === 'function') {
          ensureTempExecCaseLibraryDiffDrawer();
          renderTempExecCaseLibraryDiff(execSetId);
          if (tempExecCaseLibraryDiffStatus) {
            setStatus(tempExecCaseLibraryDiffStatus, '正在同步用例变更...', '');
          }
          if (tempExecCaseLibraryDiffBody && (!meta || !hasSignal)) {
            tempExecCaseLibraryDiffBody.innerHTML = '<tr><td colspan="8"><p class="hint">正在同步用例变更...</p></td></tr>';
          }
          if (tempExecCaseLibraryDiffDrawer && typeof tempExecCaseLibraryDiffDrawer.open === 'function') {
            tempExecCaseLibraryDiffDrawer.open();
          }
          client
            .syncExecSetCaseLibrary(execSetId)
            .then(function(syncRes) {
              var nextMeta = applyTempExecCaseLibrarySyncMeta(getTempExecFile(String(execSetId)), syncRes);
              if (!nextMeta) return;
              renderTempExecCaseLibraryDiff(execSetId);
              if (nextMeta.lastDiffAt) {
                nextMeta.lastShownAt = nextMeta.lastDiffAt;
                nextMeta.hasNewDiff = false;
                nextMeta.shouldAutoPopup = false;
                store.byExecSetId[String(execSetId)] = nextMeta;
                clearTempExecCaseLibraryAutoPopup(execSetId, nextMeta);
                if (active && String(active.execSetId || '') === String(execSetId)) {
                  syncTempExecCaseLibraryChangesButton(active);
                }
                renderTempExecCaseLibraryDiffCaseTabs(execSetId);
                if (client && typeof client.ackExecSetCaseLibraryDiff === 'function') {
                  client.ackExecSetCaseLibraryDiff(execSetId).catch(function() {});
                }
              }
            })
            .catch(function(err) {
              if (tempExecCaseLibraryDiffStatus) {
                var msg = err && err.message ? err.message : '同步失败';
                setStatus(tempExecCaseLibraryDiffStatus, '用例库同步失败：' + msg, 'err');
              }
            });
          return true;
        }
      }
      if (!meta || !hasSignal) {
        var fallbacks = listTempExecCaseLibraryDiffExecSetIds();
        if (fallbacks.length) {
          execSetId = String(fallbacks[0]);
          meta = store.byExecSetId[String(execSetId)] || null;
          hasDiff = Boolean(meta && Array.isArray(meta.diff) && meta.diff.length);
          hasHistory = Boolean(meta && Array.isArray(meta.history) && meta.history.length);
          hasSignal = Boolean(meta && (hasDiff || hasHistory || hasCaseLibraryChangeSignal(meta)));
        }
      }
      if (!meta) return false;
      if (!manual && !hasSignal) return false;
      ensureTempExecCaseLibraryDiffDrawer();
      renderTempExecCaseLibraryDiff(execSetId);
      if (tempExecCaseLibraryDiffDrawer && typeof tempExecCaseLibraryDiffDrawer.open === 'function') {
        tempExecCaseLibraryDiffDrawer.open();
      }
      // 仅在用户主动点击“用例变更”按钮时才清除提醒（ack），自动弹窗不清除醒目状态。
      if (manual && isDbMode()) {
        if (meta && meta.lastDiffAt) {
          meta.lastShownAt = meta.lastDiffAt;
          meta.hasNewDiff = false;
          meta.shouldAutoPopup = false;
          store.byExecSetId[String(execSetId)] = meta;
          clearTempExecCaseLibraryAutoPopup(execSetId, meta);
          if (active && String(active.execSetId || '') === String(execSetId)) {
            syncTempExecCaseLibraryChangesButton(active);
          }
          renderTempExecCaseLibraryDiffCaseTabs(execSetId);
        }
        var client = getApiClient();
        if (client && typeof client.ackExecSetCaseLibraryDiff === 'function') {
          client.ackExecSetCaseLibraryDiff(execSetId).catch(function() {});
        }
      }
      return true;
    }

    function tryAutoOpenTempExecCaseLibraryDiff() {
      if (!isDbMode()) return false;
      if (tryAutoOpenTempExecRestoreDiff()) return true;
      var allowAutoPopup = isTempExecTabActive(true);
      var activeId = state.tempExecActiveId ? String(state.tempExecActiveId) : '';
      var opened = maybeOpenTempExecCaseLibraryAutoPopup(allowAutoPopup, activeId);
      if (opened) return true;
      if (!allowAutoPopup || !activeId || hasTempExecCaseLibraryAutoPopupSeen(activeId)) return false;
      var store = ensureTempExecCaseLibraryDiffState();
      var meta = store.byExecSetId[String(activeId)] || null;
      if (!meta || !hasUnackedCaseLibraryDiff(meta)) return false;
      if (!hasCaseLibraryChangeSignal(meta)) return false;
      var fallbackOpened = openTempExecCaseLibraryDiffDrawer({ auto: true, execSetId: activeId });
      if (fallbackOpened) {
        clearTempExecCaseLibraryAutoPopup(activeId, meta);
        markTempExecCaseLibraryAutoPopupSeen(activeId);
      }
      return fallbackOpened;
    }

    function getTempExecFile(fileId) {
      if (!fileId) return null;
      return state.tempExecFiles.find(function(item) { return item.id === fileId; }) || null;
    }

    async function exportTempExecToXmind() {
      var active = getTempExecFile(state.tempExecActiveId);
      if (!active) {
        if (tempExecStatus) setStatus(tempExecStatus, '请选择需要导出的执行用例', 'warn');
        return;
      }
      var requirement = stripTimestampSuffix(normalizeRequirementName(active.requirement) || normalizeRequirementName(getRequirementLabel(true)));
      if (!requirement) requirement = ensureRequirementLabel('请输入需求标识后再导出执行 XMind');
      if (!requirement) {
        if (tempExecStatus) setStatus(tempExecStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      active.requirement = active.requirement || requirement;
      if (!state.requirementLabel && requirement) {
        setRequirementLabel(requirement, 'tempexec-export');
      }
      try {
        if (!buildTempExecXmindPackage) throw new Error('缺少 XMind 导出依赖');
        var result = await buildTempExecXmindPackage(active, requirement);
        if (result && downloadBlob && result.blob) {
          downloadBlob(result.fileName, result.blob);
        }
        if (tempExecStatus) setStatus(tempExecStatus, '已导出 ' + (result && result.count ? result.count : 0) + ' 条执行用例为 XMind', 'ok');
      } catch (err) {
        console.error(err);
        if (tempExecStatus) setStatus(tempExecStatus, 'XMind 导出失败：' + err.message, 'err');
      }
    }

    async function exportTempExecCasesToXmind() {
      var active = getTempExecFile(state.tempExecActiveId);
      if (!active) {
        if (tempExecStatus) setStatus(tempExecStatus, '请选择需要导出的执行用例', 'warn');
        return;
      }
      var requirement = stripTimestampSuffix(normalizeRequirementName(active.requirement) || normalizeRequirementName(getRequirementLabel(true)));
      if (!requirement) requirement = ensureRequirementLabel('请输入需求标识后再导出用例 XMind');
      if (!requirement) {
        if (tempExecStatus) setStatus(tempExecStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      var strippedCases = (active.cases || []).map(function(item) {
        var copy = {};
        Object.keys(item || {}).forEach(function(key) { copy[key] = item[key]; });
        delete copy.actual;
        delete copy.remark;
        delete copy.defectLinks;
        delete copy.reuseDetails;
        delete copy.reuseEnabled;
        delete copy.result;
        delete copy.actual_result;
        return copy;
      });
      try {
        var pkg = await buildXmindPackageFromCases(strippedCases, active.name || '用例', requirement);
        var baseFileName = getTempExecFileBaseName(active, requirement);
        var plainXmindName = baseFileName + '_' + formatCompactTimestamp() + '.xmind';
        if (pkg && downloadBlob && pkg.blob) {
          downloadBlob(plainXmindName, pkg.blob);
        }
        if (tempExecStatus) setStatus(tempExecStatus, '已导出用例 XMind（不含执行结果）', 'ok');
      } catch (err) {
        console.error(err);
        if (tempExecStatus) setStatus(tempExecStatus, '用例 XMind 导出失败：' + err.message, 'err');
      }
    }

    function getTempExecFilesByRequirement(req) {
      var target = normalizeRequirementName(req) || '未标识需求';
      return state.tempExecFiles.filter(function(file) {
        var name = normalizeRequirementName(file && file.requirement) || '未标识需求';
        return name === target;
      });
    }

    function persistTempExecState() {
      if (isDbMode()) {
        scheduleTempExecUiSave();
        return;
      }
      try {
        var payload = {
          files: serializeTempExecFiles(state),
          versions: serializeTempExecVersions(state),
          placement: state.tempExecPlacement || defaultPlacement,
          collapsed: {
            req: Boolean(state.tempExecReqCollapsed),
            version: Boolean(state.tempExecVersionCollapsed),
          },
          activeId: state.tempExecActiveId || '',
        };
        localStorage.setItem(tempExecStorageKey, JSON.stringify(payload));
      } catch (err) {
        console.warn('临时执行数据保存失败', err);
      }
    }

    function createTempExecFile(name, list, scope, explicitId, createdAt, requirementLabel) {
      var id = explicitId || generateTempExecId();
      var cases = normalizeTempExecCases(list || [], id);
      if (!cases.length) return null;
      var stamp = Number(createdAt);
      var requirement = normalizeRequirementName(requirementLabel) || getRequirementLabel(true);
      var entry = {
        id: id,
        name: name || ('用例' + ((state.tempExecFiles && state.tempExecFiles.length) ? (state.tempExecFiles.length + 1) : 1)),
        cases: cases,
        scope: scope || 'current',
        reuseEnabled: false,
        createdAt: Number.isFinite(stamp) && stamp > 0 ? stamp : Date.now(),
        reusePresets: [],
        requirement: requirement,
        projectId: '',
        versionId: '',
      };
      insertFileIntoOrder(requirement, id);
      ensureRequirementOrder(state.tempExecFiles.concat(entry).map(function(file) {
        return normalizeRequirementName(file && file.requirement) || '未标识需求';
      }));
      return entry;
    }

    function normalizeExecStatus(value) {
      var text = value === null || value === undefined ? '' : String(value);
      if (!text) return '未执行';
      if (text === 'pending') return '未执行';
      return text;
    }

    // 兼容历史 exec_case 字段：恢复归档时补齐执行结果/备注/缺陷链接。
    function normalizeExecCaseStatus(item) {
      var rawStatus = item && item.status !== null && item.status !== undefined ? String(item.status) : '';
      var status = normalizeExecStatus(rawStatus);
      if (status && status !== '未执行') return status;
      var actualText = item && item.actual_result !== null && item.actual_result !== undefined ? String(item.actual_result) : '';
      actualText = actualText.trim();
      if (!actualText) return status || '未执行';
      if (actualText === 'pending') return '未执行';
      if (actualText === '变更重跑' || actualText === '有改动') return actualText;
      if (tempExecResultOptions.indexOf(actualText) !== -1) return actualText;
      return status || '未执行';
    }

    function normalizeExecCaseRemark(item) {
      var remark = item && item.remark !== null && item.remark !== undefined ? String(item.remark) : '';
      if (remark && remark.trim()) return remark;
      var actualText = item && item.actual_result !== null && item.actual_result !== undefined ? String(item.actual_result) : '';
      actualText = actualText.trim();
      if (!actualText) return remark;
      if (actualText === 'pending') return remark;
      if (actualText === '变更重跑' || actualText === '有改动') return remark;
      if (tempExecResultOptions.indexOf(actualText) !== -1) return remark;
      return actualText;
    }

    function normalizeExecReuseDetails(raw) {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string') {
        try {
          var parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
          return [];
        }
      }
      return [];
    }

    function isBlankDefectText(text) {
      if (text === null || text === undefined) return true;
      var raw = String(text);
      if (!raw.trim()) return true;
      var lower = raw.trim().toLowerCase();
      return lower === 'null' || lower === 'undefined';
    }

    function extractDefectLinksFromRaw(raw) {
      var list = [];
      if (raw === null || raw === undefined) return list;
      if (Array.isArray(raw)) {
        raw.forEach(function(entry) {
          list = list.concat(extractDefectLinksFromRaw(entry));
        });
        return list;
      }
      if (typeof raw === 'object') {
        var url = raw.url || raw.value || '';
        if (!isBlankDefectText(url)) {
          list.push({ id: raw.id ? String(raw.id) : generateDefectLinkId(), url: String(url).trim() });
        }
        return list;
      }
      var text = String(raw);
      if (isBlankDefectText(text)) return list;
      var trimmed = text.trim();
      if (trimmed[0] === '[' || trimmed[0] === '{') {
        try {
          var parsed = JSON.parse(trimmed);
          return extractDefectLinksFromRaw(parsed);
        } catch (err) {
          // ignore and fallback to split
        }
      }
      trimmed = trimmed.replace(/\r\n/g, '\n');
      var parts = trimmed.split(/[\s\n,;，；]+/);
      parts.forEach(function(part) {
        if (isBlankDefectText(part)) return;
        list.push({ id: generateDefectLinkId(), url: String(part).trim() });
      });
      return list;
    }

    function normalizeDefectLinksFromExecCase(item) {
      var merged = [];
      if (item) {
        merged = merged.concat(extractDefectLinksFromRaw(item.defect_links));
        merged = merged.concat(extractDefectLinksFromRaw(item.defect_link));
      }
      if (!merged.length) return [];
      var seen = {};
      var out = [];
      merged.forEach(function(entry) {
        if (!entry || !entry.url) return;
        var url = String(entry.url).trim();
        if (!url || seen[url]) return;
        seen[url] = true;
        out.push({ id: entry.id ? String(entry.id) : generateDefectLinkId(), url: url });
      });
      return out;
    }

    function mapExecCaseToTempCase(item) {
      if (!item) return null;
      var reuse = item.reuse_details;
      return {
        id: item.id,
        execCaseId: item.id,
        caseItemId: item.case_item_id || null,
        module: item.module || '',
        title: item.title || '',
        priority: item.priority || '',
        preconditions: item.precondition || '',
        steps: item.steps || '',
        expected: item.expected || '',
        actual: normalizeExecCaseStatus(item),
        remark: normalizeExecCaseRemark(item),
        reuseDetails: normalizeExecReuseDetails(reuse),
        defectLinks: normalizeDefectLinksFromExecCase(item),
      };
    }

    // 用例库同步触发：通过序号机制“消费一次触发”，避免同一次页面生命周期内重复触发。
    // - 刷新前处于 tempexec：appRuntime 启动时递增序号
    // - 切到 tempexec 页签：tempexec 模块递增序号
    var tempExecCaseLibrarySyncLastSeqConsumed = 0;

    function readTempExecCaseLibrarySyncSeq() {
      try {
        if (typeof window === 'undefined') return 0;
        if (!window.app) return 0;
        var raw = Number(window.app.__tempexecCaseLibrarySyncSeq || 0);
        if (!isFinite(raw) || raw < 0) return 0;
        return raw;
      } catch (err) {
        return 0;
      }
    }

    function consumeTempExecCaseLibrarySyncTrigger() {
      var seq = readTempExecCaseLibrarySyncSeq();
      if (!seq) return false;
      if (!isFinite(tempExecCaseLibrarySyncLastSeqConsumed) || tempExecCaseLibrarySyncLastSeqConsumed < 0) {
        tempExecCaseLibrarySyncLastSeqConsumed = 0;
      }
      if (seq <= tempExecCaseLibrarySyncLastSeqConsumed) return false;
      tempExecCaseLibrarySyncLastSeqConsumed = seq;
      return true;
    }

    var tempExecDbLoadSeq = 0;
    var tempExecDbLoadPromise = null;
    var tempExecDbLoadPending = false;

    // “＋”新增用例高亮：仅保留在本次页面生命周期（刷新后清空），避免写入 localStorage/DB。
    var tempExecNewAddedCaseUiKeysByFileId = {};
    function ensureTempExecNewAddedStore(fileId) {
      var id = fileId ? String(fileId) : '';
      if (!id) id = 'unknown';
      if (!tempExecNewAddedCaseUiKeysByFileId[id] || typeof tempExecNewAddedCaseUiKeysByFileId[id] !== 'object') {
        tempExecNewAddedCaseUiKeysByFileId[id] = {};
      }
      return tempExecNewAddedCaseUiKeysByFileId[id];
    }
    function ensureTempExecNonEnumerableKey(obj, keyName, value) {
      if (!obj || typeof obj !== 'object') return '';
      var has = false;
      try { has = Object.prototype.hasOwnProperty.call(obj, keyName); } catch (err) { has = false; }
      if (has) {
        try { return String(obj[keyName] || ''); } catch (e) { return ''; }
      }
      var v = value || ('ui-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6));
      try {
        Object.defineProperty(obj, keyName, { value: v, enumerable: false, configurable: true, writable: true });
      } catch (err2) {
        try { obj[keyName] = v; } catch (err3) {}
      }
      return String(v || '');
    }
    function getTempExecCaseUiKeys(item) {
      if (!item || typeof item !== 'object') return [];
      var keys = [];
      var uiKey = '';
      try { uiKey = String(item.__uiKey || ''); } catch (_) { uiKey = ''; }
      if (uiKey) keys.push(uiKey);
      var cid = item.execCaseId || item.id || null;
      if (cid) keys.push('id-' + String(cid));
      var tmpId = item._tempId ? String(item._tempId) : '';
      if (tmpId) keys.push('tmp-' + tmpId);
      return keys;
    }
    function ensureTempExecNewAddedUiKey(item) {
      if (!item || typeof item !== 'object') return '';
      var key = '';
      try { key = String(item.__uiKey || ''); } catch (_) { key = ''; }
      if (key) return key;
      return ensureTempExecNonEnumerableKey(item, '__uiKey', '');
    }
    function markTempExecNewAdded(fileId, item) {
      var store = ensureTempExecNewAddedStore(fileId);
      var keys = getTempExecCaseUiKeys(item);
      if (!keys.length) {
        var ensured = ensureTempExecNewAddedUiKey(item);
        if (ensured) keys = [ensured];
      }
      keys.forEach(function(k) { if (k) store[k] = true; });
    }
    function unmarkTempExecNewAdded(fileId, item) {
      var store = ensureTempExecNewAddedStore(fileId);
      var keys = getTempExecCaseUiKeys(item);
      keys.forEach(function(k) { if (k) delete store[k]; });
      var ensured = '';
      try { ensured = String(item && item.__uiKey ? item.__uiKey : ''); } catch (_) { ensured = ''; }
      if (ensured) delete store[ensured];
    }
    function isTempExecNewAdded(fileId, item) {
      var store = ensureTempExecNewAddedStore(fileId);
      var keys = getTempExecCaseUiKeys(item);
      for (var i = 0; i < keys.length; i += 1) {
        var k = keys[i];
        if (k && store && store[k] === true) return true;
      }
      return false;
    }

    async function loadTempExecStateFromDb() {
      if (tempExecDbLoadPromise) {
        tempExecDbLoadPending = true;
        return tempExecDbLoadPromise;
      }
      var client = getApiClient();
      if (!client || typeof client.listExecSets !== 'function') return;
      tempExecDbLoadSeq += 1;
      var loadSeq = tempExecDbLoadSeq;
      var promise = (async function() {
        if (tempExecStatus) setStatus(tempExecStatus, '加载执行数据中...', '');
        var uiState = null;
        var hasSettingsPageSize = false;
        var settingsPageSize = null;
        if (typeof client.listSettings === 'function') {
          try {
            var settings = await client.listSettings('user');
            if (Array.isArray(settings)) {
              settings.forEach(function(item) {
                if (!item || !item.key) return;
                if (item.key === 'tempexec_ui_v1') {
                  uiState = item.value_json && typeof item.value_json === 'object' ? item.value_json : null;
                  return;
                }
                if (item.key === 'tempExecPageSize') {
                  settingsPageSize = item.value_json;
                  hasSettingsPageSize = true;
                }
              });
            }
          } catch (err) {
            uiState = null;
          }
        }
        var sets = [];
        try {
          sets = await client.listExecSets();
        } catch (err) {
          if (tempExecStatus) setStatus(tempExecStatus, err && err.message ? err.message : '加载执行数据失败', 'err');
          return;
        }
        var list = Array.isArray(sets) ? sets : [];
        list = list.filter(function(s) { return s && String(s.status || '') === 'active'; });
        // 按更新时间倒序，保持“最近执行的用例”更靠前
        list = list.slice().sort(function(a, b) {
          return parseDbTimeMs(b && b.updated_at) - parseDbTimeMs(a && a.updated_at);
        });
        var restoredArchiveIdSet = new Set();
        list.forEach(function(s) {
          if (!s) return;
          var rid = s.restored_from_id !== null && s.restored_from_id !== undefined
            ? s.restored_from_id
            : (s.restoredFromId !== null && s.restoredFromId !== undefined ? s.restoredFromId : null);
          if (rid === null || rid === undefined) return;
          restoredArchiveIdSet.add(String(rid));
        });
        var archivedSets = [];
        try {
          archivedSets = await client.listExecSets(null, { status_filter: 'archived' });
        } catch (err) {
          archivedSets = [];
        }
        var archivedList = Array.isArray(archivedSets) ? archivedSets : [];
        archivedList = archivedList.filter(function(s) { return s && String(s.status || '') === 'archived'; });
        var archivedHiddenKeys = uiState && Array.isArray(uiState.archivedHidden)
          ? uiState.archivedHidden.map(function(k) { return String(k || '').trim(); }).filter(Boolean)
          : [];
      // 若用户曾“关闭项目/关闭版本”，会写入 pid:: / pid::vid 隐藏键；
      // 当该项目/版本再次出现未归档执行集时，说明用户重新启用该范围，应自动清理旧隐藏键，避免后续归档占位无法出现。
      var prunedHiddenChanged = false;
      if (archivedHiddenKeys.length) {
        var activeProjectKeySet = new Set();
        var activeVersionKeySet = new Set();
        list.forEach(function(s) {
          if (!s) return;
          var pid2 = s && s.project_id !== null && s.project_id !== undefined ? String(s.project_id) : '';
          if (!pid2) return;
          var vid2 = s && s.version_id !== null && s.version_id !== undefined ? String(s.version_id || '') : '';
          activeProjectKeySet.add(pid2 + '::');
          activeVersionKeySet.add(pid2 + '::' + vid2);
        });
        var beforeKeys = archivedHiddenKeys.slice();
        archivedHiddenKeys = archivedHiddenKeys.filter(function(key) {
          var k = String(key || '').trim();
          if (!k) return false;
          // exec_set_id（不包含 ::）不参与此处清理
          if (k.indexOf('::') === -1) return true;
          if (activeProjectKeySet.has(k) || activeVersionKeySet.has(k)) return false;
          return true;
        });
        prunedHiddenChanged = archivedHiddenKeys.length !== beforeKeys.length;
      }
      if (archivedHiddenKeys.length) {
        var hiddenSet = new Set(archivedHiddenKeys);
        archivedList = archivedList.filter(function(s) {
          if (!s) return false;
          // archivedHidden 兼容两种形态：
          // - 项目/版本维度隐藏：pid::vid 或 pid::
          // - 归档占位解散：exec_set_id（即 s.id）
          var sid = s && s.id !== null && s.id !== undefined ? String(s.id) : '';
          if (sid && hiddenSet.has(sid)) return false;
          var pid = s && s.project_id !== null && s.project_id !== undefined ? String(s.project_id) : '';
          if (!pid) return true;
          var vid = s && s.version_id !== null && s.version_id !== undefined ? String(s.version_id || '') : '';
          var exact = pid + '::' + vid;
          var all = pid + '::';
          return !hiddenSet.has(exact) && !hiddenSet.has(all);
        });
      }
      if (restoredArchiveIdSet.size) {
        archivedList = archivedList.filter(function(s) {
          var sid = s && s.id !== null && s.id !== undefined ? String(s.id) : '';
          if (!sid) return false;
          return !restoredArchiveIdSet.has(sid);
        });
      }
      // 归档记录可能非常多：个人总览仅展示最近 N 份，完整列表请到“用例归档”理解。
      archivedList = archivedList
        .slice()
        .sort(function(a, b) {
          var ta = parseDbTimeMs(a && (a.archived_at || a.updated_at));
          var tb = parseDbTimeMs(b && (b.archived_at || b.updated_at));
          return tb - ta;
        })
        .slice(0, 80);

      // 补齐项目/版本名称缓存，避免执行页出现 “项目#null/版本#10” 等异常展示。
      var caseFileMetaById = {};
      var combinedSets = list.concat(archivedList);
      var needProjectIds = Array.from(
        new Set(
          combinedSets
            .map(function(set) { return set && set.project_id !== null && set.project_id !== undefined ? String(set.project_id) : ''; })
            .filter(Boolean)
        )
      );
      if (client && typeof client.listProjects === 'function') {
        try {
          var projects = await client.listProjects();
          state.projects = Array.isArray(projects) ? projects : [];
        } catch (err) {
          state.projects = Array.isArray(state.projects) ? state.projects : [];
        }
      }
      state.projectVersionsByProject = state.projectVersionsByProject && typeof state.projectVersionsByProject === 'object'
        ? state.projectVersionsByProject
        : {};
      if (client && typeof client.listProjectVersions === 'function') {
        await Promise.all(
          needProjectIds.map(function(pid) {
            return client
              .listProjectVersions(pid)
              .then(function(versions) {
                state.projectVersionsByProject[String(pid)] = Array.isArray(versions) ? versions : [];
              })
              .catch(function() {});
          })
        );
      }
      // 兜底：若 exec_sets.version_id 为空，则尝试从关联的 case_files.version_id 推断
      if (client && typeof client.listCaseFiles === 'function') {
        await Promise.all(
          needProjectIds.map(function(pid) {
            return client
              .listCaseFiles(Number(pid))
              .then(function(files) {
                var listFiles = Array.isArray(files) ? files : [];
                listFiles.forEach(function(item) {
                  if (!item || item.id === null || item.id === undefined) return;
                  caseFileMetaById[String(item.id)] = {
                    project_id: item.project_id,
                    version_id: item.version_id,
                    file_name_clean: item.file_name_clean,
                    item_count: item.item_count,
                  };
                });
              })
              .catch(function() {});
          })
        );
      }

      var files = list.map(function(set) {
        var createdAt = parseDbTimeMs(set && set.created_at);
        if (!Number.isFinite(createdAt) || createdAt <= 0) createdAt = Date.now();
        var cid = set && set.case_file_id !== null && set.case_file_id !== undefined ? String(set.case_file_id) : '';
        var meta = cid && caseFileMetaById[cid] ? caseFileMetaById[cid] : null;
        var resolvedProjectId = set && set.project_id !== null && set.project_id !== undefined
          ? String(set.project_id)
          : (meta && meta.project_id !== null && meta.project_id !== undefined ? String(meta.project_id) : '');
        var resolvedVersionId = set && set.version_id !== null && set.version_id !== undefined
          ? String(set.version_id)
          : (meta && meta.version_id !== null && meta.version_id !== undefined ? String(meta.version_id) : '');
        var resolvedCaseCount = null;
        if (set && set.case_count !== null && set.case_count !== undefined) {
          resolvedCaseCount = Number(set.case_count);
        } else if (meta && meta.item_count !== null && meta.item_count !== undefined) {
          resolvedCaseCount = Number(meta.item_count);
        }
        if (!Number.isFinite(resolvedCaseCount) || resolvedCaseCount < 0) resolvedCaseCount = 0;
        var restoredFromId = set && set.restored_from_id !== null && set.restored_from_id !== undefined
          ? String(set.restored_from_id)
          : (set && set.restoredFromId !== null && set.restoredFromId !== undefined ? String(set.restoredFromId) : '');
        return {
          id: String(set.id),
          execSetId: set.id,
          caseFileId: set.case_file_id || null,
          projectId: resolvedProjectId,
          name: set.name || '测试用例',
          cases: [],
          caseCount: resolvedCaseCount,
          scope: 'current',
          status: String(set.status || 'active'),
          restoredFromId: restoredFromId,
          requirement: normalizeRequirementName(set.requirement) || '',
          reuseEnabled: Boolean(set.reuse_enabled),
          createdAt: createdAt,
          reusePresets: Array.isArray(set.reuse_presets) ? normalizeReusePresets(set.reuse_presets) : [],
          versionId: resolvedVersionId,
          _casesLoading: true,
        };
      });
      var archivedFiles = archivedList.map(function(set) {
        var createdAt = parseDbTimeMs(set && set.created_at);
        if (!Number.isFinite(createdAt) || createdAt <= 0) createdAt = Date.now();
        var archivedAt = parseDbTimeMs(set && (set.archived_at || set.updated_at || set.created_at));
        if (!Number.isFinite(archivedAt) || archivedAt <= 0) archivedAt = createdAt;
        var cid = set && set.case_file_id !== null && set.case_file_id !== undefined ? String(set.case_file_id) : '';
        var meta = cid && caseFileMetaById[cid] ? caseFileMetaById[cid] : null;
        var resolvedProjectId = set && set.project_id !== null && set.project_id !== undefined
          ? String(set.project_id)
          : (meta && meta.project_id !== null && meta.project_id !== undefined ? String(meta.project_id) : '');
        var resolvedVersionId = set && set.version_id !== null && set.version_id !== undefined
          ? String(set.version_id)
          : (meta && meta.version_id !== null && meta.version_id !== undefined ? String(meta.version_id) : '');
        var resolvedCaseCount = null;
        if (set && set.case_count !== null && set.case_count !== undefined) {
          resolvedCaseCount = Number(set.case_count);
        } else if (meta && meta.item_count !== null && meta.item_count !== undefined) {
          resolvedCaseCount = Number(meta.item_count);
        }
        if (!Number.isFinite(resolvedCaseCount) || resolvedCaseCount < 0) resolvedCaseCount = 0;
        return {
          id: String(set.id),
          execSetId: set.id,
          caseFileId: set.case_file_id || null,
          projectId: resolvedProjectId,
          name: set.name || '测试用例',
          cases: [],
          caseCount: resolvedCaseCount,
          scope: 'archived',
          status: 'archived',
          requirement: normalizeRequirementName(set.requirement) || '',
          reuseEnabled: Boolean(set.reuse_enabled),
          createdAt: createdAt,
          archivedAt: archivedAt,
          reusePresets: Array.isArray(set.reuse_presets) ? normalizeReusePresets(set.reuse_presets) : [],
          versionId: resolvedVersionId,
          _casesLoading: true,
        };
      });

      state.tempExecFiles = files;
      state.tempExecArchivedFiles = archivedFiles;
      pruneTempExecCaseLibraryDiffStore(
        files.map(function(file) { return file && (file.execSetId || file.id) ? String(file.execSetId || file.id) : ''; })
      );
      applyTempExecCaseLibraryDiffReset();
      state.tempExecSelections = {};
      state.tempExecRemarkOpen = {};
      state.tempExecReuseOpen = {};
      state.tempExecDefectOpen = {};
      state.tempExecPresetDraft = null;
      resetTempExecPages();
      if (uiState && uiState.placement) {
        state.tempExecPlacement = normalizeTempExecPlacement(uiState.placement);
      }
      if (uiState && uiState.collapsed) {
        state.tempExecReqCollapsed = uiState.collapsed.req ? true : false;
        state.tempExecVersionCollapsed = uiState.collapsed.version ? true : false;
      }
      // DB 模式默认不展示需求区
      state.tempExecReqCollapsed = true;
      if (uiState && Array.isArray(uiState.focus)) {
        state.tempExecFocus = uiState.focus.filter(function(id) {
          return state.tempExecFiles.some(function(file) { return file && String(file.id) === String(id); });
        });
      } else {
        state.tempExecFocus = Array.isArray(state.tempExecFocus) ? state.tempExecFocus : [];
      }
      // DB 模式下 versionId 代表“项目版本ID”，不再复用旧的“临时版本分组”能力，避免覆盖 versionId。
      state.tempExecVersions = [];
      var resolvedPageSize = null;
      if (hasSettingsPageSize) {
        resolvedPageSize = clampTempExecPageSize(settingsPageSize);
      } else if (uiState && uiState.pageSize !== null && uiState.pageSize !== undefined) {
        resolvedPageSize = clampTempExecPageSize(uiState.pageSize);
      }
      if (resolvedPageSize !== null) {
        state.tempExecPageSize = resolvedPageSize;
        if (hasSettingsPageSize && uiState) {
          var uiPageSize = clampTempExecPageSize(uiState.pageSize);
          if (uiPageSize !== resolvedPageSize) {
            uiState.pageSize = resolvedPageSize;
            scheduleTempExecUiSave();
          }
        }
      }
      if (uiState && uiState.importProjectFilterId !== null && uiState.importProjectFilterId !== undefined) {
        state.tempExecImportProjectFilterId = normalizeTempExecImportProjectFilterId(uiState.importProjectFilterId);
      } else {
        state.tempExecImportProjectFilterId = normalizeTempExecImportProjectFilterId(state.tempExecImportProjectFilterId);
      }
      if (uiState && Array.isArray(uiState.archivedHidden)) {
        state.tempExecArchivedHidden = archivedHiddenKeys.slice();
      } else if (!Array.isArray(state.tempExecArchivedHidden)) {
        state.tempExecArchivedHidden = [];
      }
      if (prunedHiddenChanged) scheduleTempExecUiSave();
      syncTempExecPlacement();
      var firstId = state.tempExecFiles.length ? state.tempExecFiles[0].id : '';
      var savedActiveId = uiState && uiState.activeId ? String(uiState.activeId) : '';
      var currentActiveId = state.tempExecActiveId ? String(state.tempExecActiveId) : '';
      var keepActiveId = (currentActiveId && state.tempExecFiles.some(function(f) { return f && String(f.id) === currentActiveId; }))
        ? currentActiveId
        : '';
      var savedExists = savedActiveId && state.tempExecFiles.some(function(f) { return f && String(f.id) === savedActiveId; });
      var selectedActiveId = keepActiveId || (savedExists ? savedActiveId : '');
      if (selectedActiveId) {
        state.tempExecActiveId = selectedActiveId;
      } else {
        var lastCtx = state.tempExecLastActiveContext && typeof state.tempExecLastActiveContext === 'object'
          ? state.tempExecLastActiveContext
          : null;
        var lastProjectId = lastCtx && lastCtx.projectId ? String(lastCtx.projectId) : '';
        var lastVersionId = lastCtx && lastCtx.versionId !== null && lastCtx.versionId !== undefined ? String(lastCtx.versionId || '') : '';
        if (lastProjectId) {
          var sameProjectFiles = state.tempExecFiles.filter(function(f) { return f && String(f.projectId || '') === lastProjectId; });
          var sameVersionFiles = lastVersionId
            ? sameProjectFiles.filter(function(f) { return f && String(f.versionId || '') === lastVersionId; })
            : [];
          var preferred = sameVersionFiles.length
            ? String(sameVersionFiles[0].id)
            : (sameProjectFiles.length ? String(sameProjectFiles[0].id) : '');
          // 当前项目已无可执行用例时，不自动切换到其他项目（保持空态，便于用户查看归档占位并自行选择/导入）。
          state.tempExecActiveId = preferred;
        } else {
          state.tempExecActiveId = firstId;
        }
      }
      renderTempExecNav();
      renderTempExecView();
      renderTempVersionGrid();
      renderTempFocusZone();

      // 异步加载每个执行集的用例明细，避免执行集数量多时阻塞 UI 与“转到执行”链路。
      (async function() {
        if (!client || typeof client.listExecCases !== 'function') {
          if (tempExecStatus) setStatus(tempExecStatus, '', '');
          return;
        }
        var allowCaseLibrarySync = true;
        var allowAutoPopup = false;
        var isTempExecTab = isTempExecTabActive(true);
        // 消费触发序号，避免旧触发在后续重复命中；自动弹窗仍以当前执行页可见为准。
        consumeTempExecCaseLibrarySyncTrigger();
        // 用例库同步：始终执行以保持 meta/历史可用；自动弹窗仅在执行页可见时生效。
        allowAutoPopup = isTempExecTab;
        var activeId = state.tempExecActiveId ? String(state.tempExecActiveId) : '';
        var autoPopupOpened = false;
        var order = [];
        for (var i = 0; i < files.length; i += 1) order.push(i);
        if (activeId) {
          order.sort(function(a, b) {
            if (String(files[a] && files[a].id) === activeId) return -1;
            if (String(files[b] && files[b].id) === activeId) return 1;
            return a - b;
          });
        }
        var concurrency = 4;
        for (var start = 0; start < order.length; start += concurrency) {
          var chunk = order.slice(start, start + concurrency);
          await Promise.all(chunk.map(function(idx) {
            var file = files[idx];
            if (!file) return Promise.resolve();
            var syncChain = Promise.resolve();
            if (allowCaseLibrarySync && client && typeof client.syncExecSetCaseLibrary === 'function' && file.execSetId) {
              syncChain = client
                .syncExecSetCaseLibrary(file.execSetId)
                .then(function(syncRes) {
                  applyTempExecCaseLibrarySyncMeta(file, syncRes);
                  if (allowAutoPopup && !autoPopupOpened) {
                    var latestActiveId = state.tempExecActiveId ? String(state.tempExecActiveId) : activeId;
                    if (maybeOpenTempExecCaseLibraryAutoPopup(allowAutoPopup, latestActiveId)) {
                      autoPopupOpened = true;
                    }
                  }
                })
                .catch(function() {});
            }
            return syncChain.then(function() {
              return client
                .listExecCases(file.execSetId)
                .then(function(rawCases) {
                  var cases = Array.isArray(rawCases) ? rawCases.map(mapExecCaseToTempCase).filter(Boolean) : [];
                  var presetSynced = [];
                  if (file && file.reuseEnabled && Array.isArray(file.reusePresets) && file.reusePresets.length) {
                    cases.forEach(function(item) {
                      if (applyPresetsToCase(file, item)) presetSynced.push(item);
                    });
                    if (presetSynced.length) {
                      presetSynced.forEach(function(item) {
                        queueExecCasePatchForItem(item, { reuse_details: item.reuseDetails || [] });
                      });
                    }
                  }
                  // 仅在最新一次加载仍有效时写入，避免并发刷新导致状态回写错乱。
                  if (tempExecDbLoadSeq !== loadSeq) return;
                  file.cases = cases;
                  file.caseCount = Array.isArray(cases) ? cases.length : 0;
                  file._casesLoading = false;
                  updateTempExecFileCountBadge(file.id);
                  updateTempExecFileStateClass(file.id);
                  if (String(file.id) === String(state.tempExecActiveId || '')) {
                    renderTempExecView();
                  }
                  // 若个人总览抽屉打开，实时刷新归档/执行进度展示。
                  renderTempExecOverview();
                })
                .catch(function() {
                  if (tempExecDbLoadSeq !== loadSeq) return;
                  file.cases = [];
                  file.caseCount = 0;
                  file._casesLoading = false;
                  updateTempExecFileStateClass(file.id);
                  renderTempExecOverview();
                });
            });
          }));
          if (tempExecDbLoadSeq !== loadSeq) return;
        }
        // 归档执行集：仅用于个人总览展示“归”状态与执行结果，不参与执行页视图与用例库同步。
        if (archivedFiles && archivedFiles.length) {
          var archivedOrder = [];
          for (var j = 0; j < archivedFiles.length; j += 1) archivedOrder.push(j);
          var archivedConcurrency = 3;
          for (var start2 = 0; start2 < archivedOrder.length; start2 += archivedConcurrency) {
            var chunk2 = archivedOrder.slice(start2, start2 + archivedConcurrency);
            await Promise.all(chunk2.map(function(idx2) {
              var file2 = archivedFiles[idx2];
              if (!file2) return Promise.resolve();
              return client
                .listExecCases(file2.execSetId)
                .then(function(rawCases) {
                  var cases2 = Array.isArray(rawCases) ? rawCases.map(mapExecCaseToTempCase).filter(Boolean) : [];
                  if (tempExecDbLoadSeq !== loadSeq) return;
                  file2.cases = cases2;
                  file2.caseCount = Array.isArray(cases2) ? cases2.length : 0;
                  file2._casesLoading = false;
                  renderTempExecOverview();
                })
                .catch(function() {
                  if (tempExecDbLoadSeq !== loadSeq) return;
                  file2.cases = [];
                  file2.caseCount = 0;
                  file2._casesLoading = false;
                  renderTempExecOverview();
                });
            }));
            if (tempExecDbLoadSeq !== loadSeq) return;
          }
        }
        if (tempExecDbLoadSeq !== loadSeq) return;
        if (!autoPopupOpened) {
          maybeOpenTempExecCaseLibraryAutoPopup(allowAutoPopup, activeId);
        }
        if (tempExecStatus) setStatus(tempExecStatus, '', '');
      })();
      })();
      tempExecDbLoadPromise = promise;
      promise.finally(function() {
        if (tempExecDbLoadPromise === promise) tempExecDbLoadPromise = null;
        if (tempExecDbLoadPending) {
          tempExecDbLoadPending = false;
          loadTempExecStateFromDb();
        }
      });
      return promise;
    }

    async function loadTempExecState() {
      if (isDbMode()) {
        await loadTempExecStateFromDb();
        return;
      }
      var savedRaw = null;
      try {
        savedRaw = JSON.parse(localStorage.getItem(tempExecStorageKey) || '[]');
      } catch (err) {
        console.warn('临时执行数据解析失败', err);
        savedRaw = [];
      }
      var savedFiles = [];
      var savedVersions = [];
      var savedPlacement = null;
      var savedActiveId = '';
      var savedCollapsed = null;
      if (Array.isArray(savedRaw)) {
        savedFiles = savedRaw;
      } else if (savedRaw && typeof savedRaw === 'object') {
        savedFiles = Array.isArray(savedRaw.files) ? savedRaw.files : [];
        savedVersions = Array.isArray(savedRaw.versions) ? savedRaw.versions : [];
        savedPlacement = savedRaw.placement && typeof savedRaw.placement === 'object' ? savedRaw.placement : null;
        savedCollapsed = savedRaw.collapsed && typeof savedRaw.collapsed === 'object' ? savedRaw.collapsed : null;
        if (savedRaw.activeId) savedActiveId = String(savedRaw.activeId);
      }
      var usedIds = new Set();
      state.tempExecFiles = savedFiles
        .map(function(item) {
          if (!item || typeof item !== 'object') return null;
          var fileId = item.id || generateTempExecId();
          while (usedIds.has(fileId)) {
            fileId = generateTempExecId();
          }
          var list = normalizeTempExecCases(item.cases || [], fileId);
          if (!list.length) return null;
          usedIds.add(fileId);
          return {
            id: fileId,
            name: item.name || '测试用例',
            cases: list,
            scope: 'history',
            requirement: normalizeRequirementName(item.requirement) || '',
            reuseEnabled: Boolean(item.reuseEnabled),
            createdAt: Number.isFinite(Number(item.createdAt)) ? Number(item.createdAt) : Date.now(),
            reusePresets: item && item.reusePresets ? normalizeReusePresets(item.reusePresets) : [],
            projectId: item && item.projectId ? String(item.projectId) : '',
            versionId: item.versionId || '',
          };
        })
        .filter(Boolean);
      applyVersionAssignments(savedVersions);
      state.tempExecPlacement = normalizeTempExecPlacement(savedPlacement);
      state.tempExecReqCollapsed = savedCollapsed && savedCollapsed.req ? true : false;
      state.tempExecVersionCollapsed = savedCollapsed && savedCollapsed.version ? true : false;
      var firstId2 = state.tempExecFiles.length ? state.tempExecFiles[0].id : '';
      state.tempExecActiveId = (savedActiveId && state.tempExecFiles.some(function(f) { return f.id === savedActiveId; }))
        ? savedActiveId
        : firstId2;
      state.tempExecSelections = {};
      state.tempExecRemarkOpen = {};
      state.tempExecReuseOpen = {};
      state.tempExecDefectOpen = {};
      state.tempExecPresetDraft = null;
      resetTempExecPages();
      loadTempExecFocus();
      syncTempExecPlacement();
      renderTempExecNav();
      renderTempExecView();
      renderTempVersionGrid();
      renderTempFocusZone();
    }

    async function importTempExecFiles(fileList) {
      var files = Array.prototype.slice.call(fileList || []).sort(function(a, b) {
        var nameA = (a && a.name) || '';
        var nameB = (b && b.name) || '';
        return nameA.localeCompare(nameB, 'zh-Hans-CN');
      });
      if (!files.length) return;
      var firstImport = !state.tempExecFiles || !state.tempExecFiles.length;
      if (firstImport) {
        state.tempExecPlacement = {
          requirementOrder: [],
          fileOrder: {},
          versionOrder: [],
          projectOrder: [],
          versionOrderByProject: {},
          fileOrderByProjectVersion: {},
        };
        state.tempExecFocus = [];
        saveTempExecFocus();
      }
      if (tempExecStatus) setStatus(tempExecStatus, '正在解析测试用例...', '');
      var added = [];
      for (var i = 0; i < files.length; i += 1) {
        var file = files[i];
        try {
          var ext = (file && file.name && file.name.split ? (file.name.split('.').pop() || '') : '').toLowerCase();
          var text = '';
          var list = [];
          var requirementFromContent = '';
          var inferredReuse = false;
          var hasResult = false;
          if (ext === 'xmind') {
            var parsed = await parseXmindFile(file);
            text = parsed && parsed.text ? parsed.text : '';
            list = parsed && Array.isArray(parsed.list) ? parsed.list : [];
            var paths = parsed && Array.isArray(parsed.paths) ? parsed.paths : [];
            var xmindRootTitle = parsed && parsed.rootTitle ? normalizeRequirementName(parsed.rootTitle) : '';
            if (paths && paths.length) {
              var parsedExec = buildTempExecCasesFromXmindPaths(paths);
              if (parsedExec && parsedExec.hasResult && Array.isArray(parsedExec.cases) && parsedExec.cases.length) {
                list = parsedExec.cases;
                hasResult = true;
              }
              inferredReuse = Boolean(parsedExec && parsedExec.reuseEnabled);
              if (!requirementFromContent && xmindRootTitle) requirementFromContent = xmindRootTitle;
            }
          } else if (ext === 'xlsx') {
            if (typeof parseXlsxFileToRows !== 'function') throw new Error('缺少 Excel 解析能力');
            var rows = await parseXlsxFileToRows(file);
            var parsedXlsx = buildTempExecCasesFromXlsxRows(rows || []);
            list = parsedXlsx.cases;
            inferredReuse = Boolean(parsedXlsx.reuseEnabled);
            hasResult = Boolean(parsedXlsx.hasResult);
          } else if (ext === 'json') {
            text = (await file.text()).trim();
            var requirementRegex = /"requir[e]?ment"\s*:\s*"([^"]+)"/i;
            var reqMatch = text.match(requirementRegex);
            if (!requirementFromContent && reqMatch && reqMatch[1]) {
              requirementFromContent = normalizeRequirementName(reqMatch[1]);
            }
            var rawJson = text;
            try {
              var parsedJson = JSON.parse(rawJson);
              if (Array.isArray(parsedJson)) {
                list = parsedJson;
                if (!requirementFromContent && parsedJson.length && parsedJson[0]) {
                  var candidateReq = parsedJson[0].requirement || parsedJson[0].requirment;
                  if (typeof candidateReq === 'string') requirementFromContent = normalizeRequirementName(candidateReq);
                }
              } else if (parsedJson && Array.isArray(parsedJson.cases)) {
                list = parsedJson.cases;
                var candidate = parsedJson.requirement || parsedJson.requirment;
                if (!requirementFromContent && typeof candidate === 'string') {
                  requirementFromContent = normalizeRequirementName(candidate);
                }
              } else {
                list = deriveCaseListFromText(text);
              }
            } catch (err) {
              var start = rawJson.indexOf('{');
              var end = rawJson.lastIndexOf('}');
              var parsedFallback = null;
              if (start !== -1 && end > start) {
                var sliced = rawJson.slice(start, end + 1);
                try {
                  parsedFallback = JSON.parse(sliced);
                } catch (err2) {
                  console.warn('JSON 主体截取后仍无法解析', err2);
                }
              }
              if (parsedFallback) {
                if (Array.isArray(parsedFallback)) {
                  list = parsedFallback;
                  if (!requirementFromContent && parsedFallback.length && parsedFallback[0]) {
                    var candidateReqFallback = parsedFallback[0].requirement || parsedFallback[0].requirment;
                    if (typeof candidateReqFallback === 'string') requirementFromContent = normalizeRequirementName(candidateReqFallback);
                  }
                } else if (parsedFallback && Array.isArray(parsedFallback.cases)) {
                  list = parsedFallback.cases;
                  var candidateReq2 = parsedFallback.requirement || parsedFallback.requirment;
                  if (!requirementFromContent && typeof candidateReq2 === 'string') {
                    requirementFromContent = normalizeRequirementName(candidateReq2);
                  }
                }
              }
              if (!list.length) {
                console.warn('JSON 解析失败，尝试降级处理', err);
                list = deriveCaseListFromText(text);
              }
            }
          } else {
            text = await file.text();
            list = deriveCaseListFromText(text);
          }
          var extractedRequirement = requirementFromContent || extractRequirementLabelFromText(text) || '';
          var requirementLabel = extractedRequirement;
          if (!requirementLabel) {
            requirementLabel = promptTempExecRequirement(file && file.name, extractedRequirement || (file && file.name));
            if (!requirementLabel) {
              if (tempExecStatus) setStatus(tempExecStatus, '已取消导入（需求标识为空）', 'warn');
              break;
            }
          }
          if (requirementLabel && !state.requirementLabel) {
            setRequirementLabel(requirementLabel, 'import');
          }
          var entry = createTempExecFile(file && file.name, list, 'current', null, null, requirementLabel);
          if (hasResult && entry && Array.isArray(list)) {
            entry.cases = list;
          }
          if (inferredReuse) entry.reuseEnabled = true;
          if (entry) entry.fromImport = true;
          if (entry && ensureTempExecReplacement(entry, added)) {
            added.push(entry);
          }
        } catch (err3) {
          console.warn('导入临时执行用例失败', err3);
          if (tempExecStatus) setStatus(tempExecStatus, '解析 ' + (file && file.name ? file.name : '') + ' 失败：' + (err3 && err3.message ? err3.message : '未知错误'), 'warn');
        }
      }
      if (!added.length) {
        if (tempExecStatus) setStatus(tempExecStatus, '未解析到有效用例，请检查文件结构', 'warn');
        return;
      }
      state.tempExecFiles = (state.tempExecFiles || []).concat(added);
      syncTempExecFocus();
      if (!state.tempExecPages || typeof state.tempExecPages !== 'object') state.tempExecPages = {};
      added.forEach(function(entry) {
        state.tempExecPages[entry.id] = 0;
      });
      if (firstImport) {
        var placement = ensureTempExecPlacement();
        var keepVersions = Array.isArray(placement.versionOrder) ? placement.versionOrder.slice() : [];
        placement.requirementOrder = [];
        placement.fileOrder = {};
        placement.versionOrder = keepVersions;
        syncTempExecPlacement();
      }
      persistTempExecState();
      setTempExecActive(added[added.length - 1].id);
      if (tempExecStatus) setStatus(tempExecStatus, '已导入 ' + added.length + ' 份测试用例', 'ok');
    }

    function buildCaseItemPayloadFromTempCase(item) {
      if (!item) return null;
      var moduleName = String(item.module || '').trim();
      var title = String(item.title || '').trim();
      var expected = String(item.expected || '').trim();
      if (!moduleName || !title || !expected) return null;
      return {
        module: moduleName,
        title: title,
        expected: expected,
        priority: item.priority ? String(item.priority) : null,
        precondition: item.preconditions ? String(item.preconditions) : null,
        steps: item.steps ? String(item.steps) : null,
        remark: item.remark ? String(item.remark) : null,
      };
    }

    function buildExecImportPayloadFromTempCase(item, reuseEnabled) {
      if (!item) return null;
      var base = buildCaseItemPayloadFromTempCase(item);
      if (!base) return null;
      if (reuseEnabled) {
        base.status = resolveReuseAggregateStatus(Array.isArray(item.reuseDetails) ? item.reuseDetails : []);
      } else {
        base.status = item.actual ? String(item.actual) : '未执行';
      }
      base.reuse_details = Array.isArray(item.reuseDetails) ? item.reuseDetails : [];
      base.defect_links = Array.isArray(item.defectLinks) ? item.defectLinks : [];
      return base;
    }

    function buildTempExecCasesFromXlsxRows(rows) {
      var list = Array.isArray(rows) ? rows : [];
      if (!list.length) throw new Error('Excel 解析失败：缺少数据行');
      var headerRow = list[0] || [];
      var headerIndex = {};
      var headerMap = {
        '模块': 'module',
        '用例标题': 'title',
        '优先级': 'priority',
        '前提条件': 'preconditions',
        '操作步骤': 'steps',
        '预期结果': 'expected',
        '实际结果': 'actual',
        '备注': 'remark',
        '缺陷链接': 'defect',
      };
      var headerLabelByKey = {
        module: '模块',
        title: '用例标题',
        priority: '优先级',
        preconditions: '前提条件',
        steps: '操作步骤',
        expected: '预期结果',
        actual: '实际结果',
        remark: '备注',
        defect: '缺陷链接',
      };
      for (var i = 0; i < headerRow.length; i += 1) {
        var text = headerRow[i] !== undefined && headerRow[i] !== null ? String(headerRow[i]).trim() : '';
        if (!text) continue;
        if (headerMap[text]) headerIndex[headerMap[text]] = i;
      }
      var hasBaseHeader = Boolean(
        headerIndex.module !== undefined &&
        headerIndex.title !== undefined &&
        headerIndex.expected !== undefined
      );
      if (!hasBaseHeader) throw new Error('Excel 格式不对：缺少表头（模块/用例标题/预期结果）');

      var hasResultHeader = (
        headerIndex.actual !== undefined ||
        headerIndex.remark !== undefined ||
        headerIndex.defect !== undefined
      );
      if (hasResultHeader) {
        if (headerIndex.actual === undefined || headerIndex.remark === undefined || headerIndex.defect === undefined) {
          throw new Error('结果格式不对：带结果 Excel 需包含（实际结果/备注/缺陷链接）三列');
        }
      }

      function pick(row, key) {
        if (!row) return '';
        var idx = headerIndex[key];
        if (idx === undefined) return '';
        var val = row[idx];
        return val === undefined || val === null ? '' : String(val);
      }

      // 兼容用户复制/粘贴导致的数据区重复表头：将“看起来像表头”的行当作表头跳过，避免误当用例条目影响 diff。
      function isHeaderLikeRow(row) {
        if (!row) return false;
        var module0 = pick(row, 'module').trim();
        var title0 = pick(row, 'title').trim();
        var expected0 = pick(row, 'expected').trim();
        if (module0 !== headerLabelByKey.module) return false;
        if (title0 !== headerLabelByKey.title) return false;
        if (expected0 !== headerLabelByKey.expected) return false;
        var keys = Object.keys(headerIndex || {});
        for (var k = 0; k < keys.length; k += 1) {
          var key = keys[k];
          if (!key) continue;
          var label = headerLabelByKey[key] ? String(headerLabelByKey[key]) : '';
          if (!label) continue;
          var cell = pick(row, key).trim();
          if (!cell) continue;
          if (cell !== label) return false;
        }
        return true;
      }

      function normalizeStatusInput(value) {
        var text2 = value === null || value === undefined ? '' : String(value).trim();
        if (!text2) return '未执行';
        if (tempExecResultOptions.indexOf(text2) !== -1) return text2;
        if (text2 === 'pending') return '未执行';
        return null;
      }

      function parseDefectLinks(text3) {
        var raw = text3 === null || text3 === undefined ? '' : String(text3);
        raw = raw.replace(/\r\n/g, '\n');
        var parts = raw.split(/[\s\n,;，；]+/).map(function(s) { return String(s || '').trim(); }).filter(Boolean);
        var out = [];
        var seen = {};
        parts.forEach(function(url) {
          if (!url) return;
          if (seen[url]) return;
          seen[url] = true;
          out.push({ id: generateDefectLinkId(), url: url });
        });
        return out;
      }

      function detectHasExecResult(cases, reuseEnabled) {
        var list2 = Array.isArray(cases) ? cases : [];
        if (!list2.length) return false;
        if (reuseEnabled) {
          return list2.some(function(item) {
            var details = item && Array.isArray(item.reuseDetails) ? item.reuseDetails : [];
            return details.some(function(d) {
              if (!d || isReuseDetailRemoved(d)) return false;
              var st = d && d.status ? String(d.status) : '未执行';
              var note = d && d.note ? String(d.note) : '';
              return (st && st !== '未执行') || (note && note.trim());
            });
          });
        }
        return list2.some(function(item2) {
          var st2 = item2 && item2.actual ? String(item2.actual) : '未执行';
          var remark2 = item2 && item2.remark ? String(item2.remark) : '';
          var defects2 = item2 && Array.isArray(item2.defectLinks) ? item2.defectLinks : [];
          return (st2 && st2 !== '未执行') || (remark2 && remark2.trim()) || defects2.length;
        });
      }

      var out = [];
      var reuseEnabled = false;
      var current = null;
      for (var r = 1; r < list.length; r += 1) {
        var row = list[r] || [];
        var module = pick(row, 'module').trim();
        var title = pick(row, 'title').trim();
        var priority = pick(row, 'priority').trim();
        var preconditions = pick(row, 'preconditions').trim();
        var steps = pick(row, 'steps').trim();
        var expected = pick(row, 'expected').trim();
        var actualRaw = pick(row, 'actual').trim();
        var remark = pick(row, 'remark');
        var defectRaw = pick(row, 'defect');

        var allText = String(module || '') + String(title || '') + String(priority || '') + String(preconditions || '') + String(steps || '') + String(expected || '') + String(actualRaw || '') + String(remark || '') + String(defectRaw || '');
        if (!allText.trim()) continue;

        if (isHeaderLikeRow(row)) continue;

        var isReuseDetailRow = Boolean(
          !module &&
          !title &&
          !priority &&
          !preconditions &&
          !steps &&
          expected
        );
        if (isReuseDetailRow) {
          if (!hasResultHeader) throw new Error('结果格式不对：复用子项行仅允许出现在带结果的 Excel 中');
          if (!current) throw new Error('结果格式不对：复用子项行前缺少主用例行');
          if (defectRaw && String(defectRaw).trim()) throw new Error('结果格式不对：复用子项行“缺陷链接”必须为空');
          var childStatus = normalizeStatusInput(actualRaw);
          if (!childStatus) throw new Error('结果格式不对：复用子项行“实际结果”不合法');
          reuseEnabled = true;
          current.reuseDetails = Array.isArray(current.reuseDetails) ? current.reuseDetails : [];
          current.reuseDetails.push({
            id: generateReuseDetailId(),
            text: expected,
            note: remark || '',
            status: childStatus,
          });
          continue;
        }

        if (!module || !title || !expected) {
          throw new Error('Excel 格式不对：第 ' + (r + 1) + ' 行缺少必填字段（模块/用例标题/预期结果）');
        }
        var status = '未执行';
        var defectLinks = [];
        if (hasResultHeader) {
          var st4 = normalizeStatusInput(actualRaw);
          if (!st4) throw new Error('结果格式不对：第 ' + (r + 1) + ' 行“实际结果”不合法');
          status = st4;
          defectLinks = parseDefectLinks(defectRaw);
        }
        current = {
          module: module,
          title: title,
          priority: priority || '',
          preconditions: preconditions || '',
          steps: steps || '',
          expected: expected,
          actual: status,
          remark: remark || '',
          reuseDetails: [],
          defectLinks: defectLinks,
        };
        out.push(current);
      }

      if (!out.length) throw new Error('Excel 解析失败：未解析到有效用例');

      if (reuseEnabled) {
        out.forEach(function(item3) {
          if (!item3 || !Array.isArray(item3.reuseDetails) || !item3.reuseDetails.length) return;
          var expectedAggregate = resolveReuseAggregateStatus(item3.reuseDetails);
          if (!item3.actual || String(item3.actual).trim() === '') {
            throw new Error('结果格式不对：复用用例主行“实际结果”不能为空（' + (item3.title || '') + '）');
          }
          if (String(item3.actual) !== String(expectedAggregate)) {
            throw new Error('结果格式不对：复用用例主行“实际结果”需与子项汇总一致（' + (item3.title || '') + '）');
          }
        });
        out.forEach(function(item4) {
          if (!item4) return;
          if (Array.isArray(item4.reuseDetails) && item4.reuseDetails.length) {
            item4.actual = resolveReuseAggregateStatus(item4.reuseDetails);
          } else {
            item4.actual = '未执行';
          }
        });
      }

      return { cases: out, reuseEnabled: reuseEnabled, hasResult: detectHasExecResult(out, reuseEnabled) };
    }

    async function importTempExecFilesToDb(fileList, projectId, versionId, execVersionId) {
      if (!isDbMode()) {
        // 静态模式：仍沿用原本的本地导入逻辑，避免影响离线使用与既有自动化。
        await importTempExecFiles(fileList);
        return { imported: 0, failed: [], mode: 'local' };
      }
      var client = getApiClient();
      if (
        !client ||
        typeof client.listCaseFiles !== 'function' ||
        typeof client.listCaseItems !== 'function' ||
        typeof client.createCaseItem !== 'function' ||
        typeof client.importCaseFile !== 'function' ||
        typeof client.listExecSets !== 'function' ||
        typeof client.listExecCases !== 'function' ||
        typeof client.createExecCase !== 'function' ||
        typeof client.upsertExecSetFromCaseFile !== 'function'
      ) {
        throw new Error('后端入库接口未就绪');
      }
      var pid = Number(projectId);
      var vid = Number(versionId);
      if (!Number.isFinite(pid) || pid <= 0) throw new Error('请选择项目');
      if (!Number.isFinite(vid) || vid <= 0) throw new Error('请选择版本');
      var execVid = null;
      if (execVersionId !== null && execVersionId !== undefined && String(execVersionId) !== '') {
        var parsedExec = Number(execVersionId);
        execVid = Number.isFinite(parsedExec) ? parsedExec : null;
      }

      function normText(value) {
        if (normalizeTempExecName) return normalizeTempExecName(value);
        return String(value || '').trim().toLowerCase();
      }

      function buildMatchKey(moduleName, title, precondition, steps, expected) {
        return (
          normText(moduleName) + '::' +
          normText(title) + '::' +
          normText(precondition) + '::' +
          normText(steps) + '::' +
          normText(expected)
        );
      }

      function cleanImportFileName(name) {
        var raw = String(name || '');
        var base = raw.split(/[\\/]/).pop() || raw;
        var cleaned = '';
        if (typeof getSafeFileBaseName === 'function') {
          cleaned = getSafeFileBaseName(base, 'case');
        } else {
          cleaned = base.replace(/\.[^.]+$/, '');
        }
        // 兼容 Excel/JSON 等扩展名：无论 getSafeFileBaseName 是否已处理，都再兜底剥离一次后缀。
        cleaned = String(cleaned || '').replace(/\.[^.]+$/, '');
        cleaned = String(cleaned || '').replace(/^勾选用例[\s_\-\u2010-\u2015\u2212\uFE63\uFF0D]*/i, '');
        cleaned = cleaned.trim().replace(/^[_-]+|[_-]+$/g, '');
        return cleaned || 'case';
      }

      var files = Array.prototype.slice.call(fileList || []).filter(Boolean);
      files = files.sort(function(a, b) {
        var nameA = (a && a.name) || '';
        var nameB = (b && b.name) || '';
        return nameA.localeCompare(nameB, 'zh-Hans-CN');
      });
      if (!files.length) throw new Error('未选择文件');

      var importedExecSetIds = [];
      var importedNames = [];
      var failures = [];
      var duplicates = [];
      if (tempExecStatus) setStatus(tempExecStatus, '正在入库用例...', '');

      var existingCaseFiles = [];
      try {
        existingCaseFiles = await client.listCaseFiles(pid);
      } catch (err0) {
        existingCaseFiles = [];
      }
      var caseFileByName = {};
      (existingCaseFiles || []).forEach(function(f) {
        if (!f || !f.file_name_clean) return;
        var keyRaw = normText(f.file_name_clean);
        if (keyRaw) {
          var prev = caseFileByName[keyRaw];
          if (!prev || Number(f.id || 0) > Number(prev.id || 0)) {
            caseFileByName[keyRaw] = f;
          }
        }
        // 兼容历史数据：后端清洗规则曾未覆盖“勾选用例 ”等前缀，导入时需能匹配同一份用例。
        var keyClean = normText(cleanImportFileName(f.file_name_clean));
        if (keyClean) {
          var prev2 = caseFileByName[keyClean];
          if (!prev2 || Number(f.id || 0) > Number(prev2.id || 0)) {
            caseFileByName[keyClean] = f;
          }
        }
      });

      var existingExecSets = [];
      try {
        existingExecSets = await client.listExecSets(pid);
      } catch (err1) {
        existingExecSets = [];
      }
      var execSetByCaseFileId = {};
      (existingExecSets || []).forEach(function(s) {
        if (!s || !s.case_file_id) return;
        var cid = s.case_file_id;
        var prev = execSetByCaseFileId[cid];
        if (!prev || Number(s.id) > Number(prev.id)) {
          execSetByCaseFileId[cid] = s;
        }
      });

      for (var i = 0; i < files.length; i += 1) {
        var file = files[i];
        var fileName = file && file.name ? file.name : '';
        try {
          if (tempExecStatus) setStatus(tempExecStatus, '解析并入库：' + fileName, '');
          var ext = (fileName && fileName.split ? (fileName.split('.').pop() || '') : '').toLowerCase();
          var text = '';
          var list = [];
          var requirementFromContent = '';
          var inferredReuse = false;
          var hasResult = false;
          if (ext === 'xmind') {
            var parsed = await parseXmindFile(file);
            text = parsed && parsed.text ? parsed.text : '';
            list = parsed && Array.isArray(parsed.list) ? parsed.list : [];
            var paths = parsed && Array.isArray(parsed.paths) ? parsed.paths : [];
            var xmindRootTitle = parsed && parsed.rootTitle ? normalizeRequirementName(parsed.rootTitle) : '';
            if (paths && paths.length) {
              var parsedExec = buildTempExecCasesFromXmindPaths(paths);
              if (parsedExec && parsedExec.hasResult && Array.isArray(parsedExec.cases) && parsedExec.cases.length) {
                list = parsedExec.cases;
                hasResult = true;
              }
              inferredReuse = Boolean(parsedExec && parsedExec.reuseEnabled);
              if (!requirementFromContent && xmindRootTitle) requirementFromContent = xmindRootTitle;
            }
          } else if (ext === 'xlsx') {
            if (typeof parseXlsxFileToRows !== 'function') throw new Error('缺少 Excel 解析能力');
            var rows = await parseXlsxFileToRows(file);
            var parsedXlsx = buildTempExecCasesFromXlsxRows(rows || []);
            list = parsedXlsx.cases;
            inferredReuse = Boolean(parsedXlsx.reuseEnabled);
            hasResult = Boolean(parsedXlsx.hasResult);
          } else if (ext === 'json') {
            text = (await file.text()).trim();
            var requirementRegex = /"requir[e]?ment"\s*:\s*"([^"]+)"/i;
            var reqMatch = text.match(requirementRegex);
            if (!requirementFromContent && reqMatch && reqMatch[1]) {
              requirementFromContent = normalizeRequirementName(reqMatch[1]);
            }
            var rawJson = text;
            var isSnapshotFile = false;
            try {
              var parsedJson = JSON.parse(rawJson);
              if (
                parsedJson &&
                typeof parsedJson === 'object' &&
                !Array.isArray(parsedJson) &&
                parsedJson.type === 'tempexec_snapshot_v1' &&
                Array.isArray(parsedJson.files)
              ) {
                isSnapshotFile = true;
              }
              if (Array.isArray(parsedJson)) {
                list = parsedJson;
                if (!requirementFromContent && parsedJson.length && parsedJson[0]) {
                  var candidateReq = parsedJson[0].requirement || parsedJson[0].requirment;
                  if (typeof candidateReq === 'string') requirementFromContent = normalizeRequirementName(candidateReq);
                }
              } else if (parsedJson && Array.isArray(parsedJson.cases)) {
                list = parsedJson.cases;
                var candidate = parsedJson.requirement || parsedJson.requirment;
                if (!requirementFromContent && typeof candidate === 'string') {
                  requirementFromContent = normalizeRequirementName(candidate);
                }
              } else {
                list = deriveCaseListFromText(text);
              }
            } catch (err) {
              var start = rawJson.indexOf('{');
              var end = rawJson.lastIndexOf('}');
              var parsedFallback = null;
              if (start !== -1 && end > start) {
                var sliced = rawJson.slice(start, end + 1);
                try {
                  parsedFallback = JSON.parse(sliced);
                } catch (err2) {
                  console.warn('JSON 主体截取后仍无法解析', err2);
                }
              }
              if (parsedFallback) {
                if (Array.isArray(parsedFallback)) {
                  list = parsedFallback;
                  if (!requirementFromContent && parsedFallback.length && parsedFallback[0]) {
                    var candidateReqFallback = parsedFallback[0].requirement || parsedFallback[0].requirment;
                    if (typeof candidateReqFallback === 'string') requirementFromContent = normalizeRequirementName(candidateReqFallback);
                  }
                } else if (parsedFallback && Array.isArray(parsedFallback.cases)) {
                  list = parsedFallback.cases;
                  var candidateReq2 = parsedFallback.requirement || parsedFallback.requirment;
                  if (!requirementFromContent && typeof candidateReq2 === 'string') {
                    requirementFromContent = normalizeRequirementName(candidateReq2);
                  }
                }
              }
              if (!list.length) {
                console.warn('JSON 解析失败，尝试降级处理', err);
                list = deriveCaseListFromText(text);
              }
            }
            if (isSnapshotFile) {
              throw new Error('检测到执行页面配置文件，请使用“导入执行页面配置”按钮导入');
            }
          } else {
            text = await file.text();
            list = deriveCaseListFromText(text);
          }

          var extractedRequirement = requirementFromContent || extractRequirementLabelFromText(text) || '';
          var requirementLabel = extractedRequirement;
          if (!requirementLabel) {
            var existingLabel = state && state.requirementLabel ? normalizeRequirementName(state.requirementLabel) : '';
            if (existingLabel) {
              requirementLabel = existingLabel;
            } else {
              var fallbackLabel = cleanImportFileName(fileName);
              if (fallbackLabel) {
                requirementLabel = fallbackLabel;
              } else {
                requirementLabel = promptTempExecRequirement(fileName, extractedRequirement || fileName);
                if (!requirementLabel) {
                  failures.push({ file: fileName, reason: '已取消导入（需求标识为空）' });
                  continue;
                }
              }
            }
          }
          if (requirementLabel && !state.requirementLabel) {
            setRequirementLabel(requirementLabel, 'tempexec-import-db');
          }

          var tempId = 'import-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
          var casesList = [];
          if (hasResult && Array.isArray(list)) {
            casesList = list;
          } else {
            casesList = normalizeTempExecCases(list || [], tempId);
          }
          casesList = Array.isArray(casesList) ? casesList : [];
          var casePairs = [];
          var totalCaseCount = 0;
          var duplicateCaseCount = 0;
          var groupMap = {};
          var firstByKey = {};
          var seenCaseKeys = new Set();
          for (var ci = 0; ci < casesList.length; ci += 1) {
            var rawCase = casesList[ci];
            var payloadCase = buildCaseItemPayloadFromTempCase(rawCase);
            if (!payloadCase) continue;
            totalCaseCount += 1;
            var sourceLine = rawCase && Number.isFinite(Number(rawCase._sourceLine)) ? Number(rawCase._sourceLine) : 0;
            var lineNo = sourceLine > 0 ? sourceLine : totalCaseCount;
            var keyCase = buildMatchKey(payloadCase.module, payloadCase.title, payloadCase.precondition, payloadCase.steps, payloadCase.expected);
            if (!groupMap[keyCase]) groupMap[keyCase] = [];
            groupMap[keyCase].push({ line: lineNo, payload: payloadCase, source: rawCase });
            if (seenCaseKeys.has(keyCase)) {
              duplicateCaseCount += 1;
              continue;
            }
            seenCaseKeys.add(keyCase);
            firstByKey[keyCase] = totalCaseCount;
            casePairs.push({ key: keyCase, payload: payloadCase, source: rawCase });
          }
          if (!casePairs.length) {
            failures.push({ file: fileName, reason: '未解析到有效用例（缺少模块/标题/预期结果）' });
            continue;
          }
          if (duplicateCaseCount > 0) {
            var dupRows = [];
            Object.keys(groupMap).forEach(function(key) {
              var list = groupMap[key];
              if (!Array.isArray(list) || list.length <= 1) return;
              // 第一条保留，其余移除（去重逻辑与入库一致）
              list.forEach(function(entry, idx) {
                dupRows.push({
                  line: entry && entry.line ? entry.line : 0,
                  payload: entry && entry.payload ? entry.payload : null,
                  source: entry && entry.source ? entry.source : null,
                  keep: idx === 0,
                });
              });
            });
            dupRows.sort(function(a, b) {
              var la = a && a.line ? Number(a.line) : 0;
              var lb = b && b.line ? Number(b.line) : 0;
              return la - lb;
            });
            var confirmDuplicate = await confirmTempExecImportDuplicateByDrawer({
              fileName: fileName,
              total: totalCaseCount,
              uniqueCount: casePairs.length,
              duplicateCount: duplicateCaseCount,
              rows: dupRows.slice(0, 200),
            });
            if (!confirmDuplicate) {
              failures.push({ file: fileName, reason: '已取消导入（包含重复条目，请先去重再入库）' });
              continue;
            }
          }
          var caseItemPayload = casePairs.map(function(entry) { return entry.payload; });
          casesList = casePairs.map(function(entry) { return entry.source; });

          var cleanName = cleanImportFileName(fileName);
          var normalizedName = normText(cleanName);
          var existingCaseFile = caseFileByName[normalizedName] || null;

          // 用例执行导入与用例库导入对齐：遇到同名用例先走差异对比抽屉，再由用户确认是否覆盖导入。
          // 多文件导入时不阻塞非同名：同名用例先加入队列，后续依次弹出 diff 抽屉处理。
          if (existingCaseFile && existingCaseFile.id) {
            var importExecCasesAll = casesList
              .map(function(item) { return buildExecImportPayloadFromTempCase(item, inferredReuse); })
              .filter(Boolean);
            duplicates.push({
              payload: {
                existing_case_file_id: existingCaseFile.id,
                existing_file_name_clean: existingCaseFile.file_name_clean || cleanName,
                existing_version_id: existingCaseFile.version_id || null,
              },
              duplicate: {
                file_name: fileName,
                clean_name: cleanName,
                project_id: pid,
                version_id: vid,
                source: (file && file.type) ? file.type : (ext ? ('file:' + ext) : 'file'),
                ext: ext || '',
                items: caseItemPayload,
                exec_cases: importExecCasesAll,
                has_result: Boolean(hasResult),
                reuse_enabled: Boolean(inferredReuse),
                requirement: requirementLabel || '',
              },
            });
            continue;
          }

          var execSet = null;
          if (!existingCaseFile) {
            var caseFile = null;
            try {
              caseFile = await client.importCaseFile({
                project_id: pid,
                version_id: vid,
                file_name: fileName || 'case',
                source: 'tempexec',
                items: caseItemPayload,
              });
            } catch (errImport) {
              var msgImport = errImport && errImport.message ? String(errImport.message) : '';
              if (msgImport.indexOf('同名') !== -1) {
                var importExecCasesAll2 = casesList
                  .map(function(item2) { return buildExecImportPayloadFromTempCase(item2, inferredReuse); })
                  .filter(Boolean);
                duplicates.push({
                  payload: errImport && errImport.payload ? errImport.payload : null,
                  duplicate: {
                    file_name: fileName,
                    clean_name: cleanName,
                    project_id: pid,
                    version_id: vid,
                    source: (file && file.type) ? file.type : (ext ? ('file:' + ext) : 'file'),
                    ext: ext || '',
                    items: caseItemPayload,
                    exec_cases: importExecCasesAll2,
                    has_result: Boolean(hasResult),
                    reuse_enabled: Boolean(inferredReuse),
                    requirement: requirementLabel || '',
                  },
                });
                continue;
              }
              throw errImport;
            }
            caseFileByName[normText(caseFile.file_name_clean || cleanName)] = caseFile;
            existingCaseFile = caseFile;
            importedNames.push(caseFile.file_name_clean || cleanName);

            var importCases = null;
            if (hasResult || inferredReuse) {
              importCases = casesList
                .map(function(item3) { return buildExecImportPayloadFromTempCase(item3, inferredReuse); })
                .filter(Boolean);
            }
            execSet = await client.upsertExecSetFromCaseFile({
              case_file_id: caseFile.id,
              mode: 'replace',
              prefer_result_source: importCases && importCases.length ? 'import' : 'db',
              import_cases: importCases && importCases.length ? importCases : null,
              requirement: requirementLabel || '',
              reuse_enabled: inferredReuse ? true : false,
              reuse_presets: null,
              exec_version_id: execVid,
            });
            if (execSet && execSet.id) {
              importedExecSetIds.push(execSet.id);
              execSetByCaseFileId[caseFile.id] = execSet;
            }
            continue;
          }

          var existingItems = [];
          try {
            existingItems = await client.listCaseItems(existingCaseFile.id);
          } catch (err2) {
            existingItems = [];
          }
          var existingKeySet = new Set();
          var existingModuleSet = new Set();
          var titlesByModule = {};
          (existingItems || []).forEach(function(it) {
            if (!it) return;
            var k = buildMatchKey(it.module, it.title, it.precondition, it.steps, it.expected);
            existingKeySet.add(k);
            var modKey = normText(it.module);
            existingModuleSet.add(modKey);
            if (!titlesByModule[modKey]) titlesByModule[modKey] = new Set();
            titlesByModule[modKey].add(normText(it.title));
          });

          var importCaseMap = {};
          casesList.forEach(function(item) {
            var base = buildCaseItemPayloadFromTempCase(item);
            if (!base) return;
            var k = buildMatchKey(base.module, base.title, base.precondition, base.steps, base.expected);
            if (!importCaseMap[k]) importCaseMap[k] = item;
          });

          var newCases = [];
          caseItemPayload.forEach(function(payload) {
            var k = buildMatchKey(payload.module, payload.title, payload.precondition, payload.steps, payload.expected);
            if (!existingKeySet.has(k)) {
              newCases.push({ key: k, payload: payload, source: importCaseMap[k] || null });
            }
          });

          var hasNewCases = Boolean(newCases.length);
          if (hasNewCases) {
            var moduleMismatch = newCases.some(function(entry) {
              return !existingModuleSet.has(normText(entry && entry.payload ? entry.payload.module : ''));
            });
            var titleMismatch = false;
            if (!moduleMismatch) {
              titleMismatch = newCases.some(function(entry) {
                var modKey = normText(entry && entry.payload ? entry.payload.module : '');
                var titleKey = normText(entry && entry.payload ? entry.payload.title : '');
                var titles = titlesByModule[modKey] ? titlesByModule[modKey] : null;
                return !titles || !titles.has(titleKey);
              });
            }
            var reasonHint = moduleMismatch ? '包含新模块' : (titleMismatch ? '同模块新增用例标题' : '新增用例');
            var ok = window.confirm(
              '检测到【' + cleanName + '】在库中已存在，但导入文件包含新增条目（' +
                newCases.length + ' 条，' + reasonHint + '）。\\n\\n' +
                '确认后将把新增条目追加入库，并同步到执行页。\\n是否继续？'
            );
            if (!ok) {
              failures.push({ file: fileName, reason: '已取消导入（放弃追加新增条目）' });
              continue;
            }
          }

          var importCases2 = null;
          if (hasResult && preferResultSource === 'import') {
            importCases2 = casesList
              .map(function(item) { return buildExecImportPayloadFromTempCase(item, inferredReuse); })
              .filter(Boolean);
          }
          execSet = await client.upsertExecSetFromCaseFile({
            case_file_id: existingCaseFile.id,
            mode: 'replace',
            prefer_result_source: preferResultSource,
            import_cases: importCases2,
            requirement: requirementLabel || '',
            reuse_enabled: inferredReuse ? true : false,
            reuse_presets: null,
            exec_version_id: execVid,
          });
          if (!execSet || !execSet.id) {
            failures.push({ file: fileName, reason: '执行集创建失败' });
            continue;
          }
          importedExecSetIds.push(execSet.id);
          execSetByCaseFileId[existingCaseFile.id] = execSet;

          if (hasNewCases) {
            var execCases = [];
            try {
              execCases = await client.listExecCases(execSet.id);
            } catch (err3) {
              execCases = [];
            }
            execCases = Array.isArray(execCases) ? execCases : [];
            newCases.sort(function(a, b) {
              var am = normText(a && a.payload ? a.payload.module : '');
              var bm = normText(b && b.payload ? b.payload.module : '');
              if (am === bm) return 0;
              return am.localeCompare(bm, 'zh-Hans-CN');
            });
            var moduleMismatch2 = newCases.some(function(entry) {
              return !existingModuleSet.has(normText(entry && entry.payload ? entry.payload.module : ''));
            });

            for (var n = 0; n < newCases.length; n += 1) {
              var entry = newCases[n];
              var createdItem = null;
              try {
                createdItem = await client.createCaseItem(existingCaseFile.id, entry.payload);
              } catch (err4) {
                failures.push({ file: fileName, reason: '新增条目入库失败：' + (err4 && err4.message ? err4.message : '未知错误') });
                continue;
              }
              if (!createdItem || !createdItem.id) continue;

              var afterCaseId = null;
              if (!moduleMismatch2) {
                for (var r = execCases.length - 1; r >= 0; r -= 1) {
                  var row = execCases[r];
                  if (normText(row && row.module) === normText(entry.payload.module)) {
                    afterCaseId = row.id;
                    break;
                  }
                }
              }
              if (!afterCaseId && execCases.length) {
                afterCaseId = execCases[execCases.length - 1].id;
              }
              var src = entry.source || null;
              var payloadCreate = {
                case_item_id: createdItem.id,
                after_case_id: afterCaseId || null,
                status: src && src.actual ? String(src.actual) : '未执行',
                remark: src && src.remark ? String(src.remark) : (entry.payload.remark || ''),
                reuse_details: src && Array.isArray(src.reuseDetails) ? src.reuseDetails : [],
                defect_links: src && Array.isArray(src.defectLinks) ? src.defectLinks : [],
              };
              try {
                var createdExecCase = await client.createExecCase(execSet.id, payloadCreate);
                if (createdExecCase && createdExecCase.id) {
                  execCases.push(createdExecCase);
                  execCases.sort(function(a, b) {
                    return Number(a.order_no || 0) - Number(b.order_no || 0);
                  });
                }
              } catch (err5) {
                failures.push({ file: fileName, reason: '新增条目同步到执行页失败：' + (err5 && err5.message ? err5.message : '未知错误') });
              }
            }
          }
        } catch (err3) {
          if (err3 && err3.code === 'duplicate_case_file') {
            throw err3;
          }
          console.warn('执行用例入库失败', err3);
          failures.push({ file: fileName, reason: err3 && err3.message ? err3.message : '入库失败' });
        }
      }

      if (importedExecSetIds.length) {
        queueTempExecCaseLibraryDiffReset(importedExecSetIds);
        await loadTempExecStateFromDb();
        var latestId = String(importedExecSetIds[importedExecSetIds.length - 1]);
        if (getTempExecFile(latestId)) setTempExecActive(latestId);
      }
      var summary = '入库完成：成功 ' + importedExecSetIds.length + '，失败 ' + failures.length;
      if (duplicates.length) summary += '，同名待处理 ' + duplicates.length;
      var lines = [summary];
      if (failures.length) {
        failures.slice(0, 3).forEach(function(item) {
          var fname = item && item.file ? String(item.file) : '';
          var reason = item && item.reason ? String(item.reason) : '入库失败';
          lines.push(' - ' + (fname || '文件') + '：' + reason);
        });
        if (failures.length > 3) {
          lines.push(' - 还有 ' + (failures.length - 3) + ' 个失败未展开');
        }
      }
      if (tempExecStatus) setStatus(tempExecStatus, lines.join('\n'), failures.length ? 'warn' : 'ok');
      return { imported: importedExecSetIds.length, failed: failures, duplicates: duplicates, imported_names: importedNames, mode: 'db' };
    }

    function setTempExecActive(fileId) {
      if (fileId && getTempExecFile(fileId)) {
        state.tempExecActiveId = fileId;
        ensureTempExecPageIndex(fileId);
        try {
          var active = getTempExecFile(fileId);
          if (active) {
            state.tempExecLastActiveContext = {
              projectId: active.projectId ? String(active.projectId) : '',
              versionId: active.versionId !== null && active.versionId !== undefined ? String(active.versionId || '') : '',
            };
          }
        } catch (err) {
          // ignore
        }
      } else if (!fileId) {
        state.tempExecActiveId = '';
      } else {
        state.tempExecActiveId = '';
      }
      state.tempExecMindMode = false;
      if (state.tempExecPresetDraft && state.tempExecPresetDraft.fileId !== state.tempExecActiveId) {
        state.tempExecPresetDraft = null;
      }
      persistTempExecState();
      renderTempExecNav();
      renderTempExecView();
      renderTempVersionGrid();
      renderTempFocusZone();
    }

    function updateTempExecResult(fileId, index, value) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      var selection = ensureTempExecSelection(fileId);
      var targets = selection.size && selection.has(index) ? Array.from(selection) : [index];
      targets.forEach(function(idx) {
        if (file.cases[idx]) file.cases[idx].actual = value;
      });
      if (isDbMode()) {
        targets.forEach(function(idx) {
          var item = file.cases[idx];
          if (!item) return;
          queueExecCasePatchForItem(item, { status: value });
        });
      }
      persistTempExecState();
      renderTempExecView();
      renderTempExecNav();
      renderTempVersionGrid();
    }

    function updateTempExecRemark(fileId, index, value) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      file.cases[index].remark = value;
      if (isDbMode()) {
        var item = file.cases[index];
        if (item) queueExecCasePatchForItem(item, { remark: value });
      }
      persistTempExecState();
    }

    function pushTempExecUndo(payload) {
      if (!Array.isArray(state.tempExecUndoStack)) state.tempExecUndoStack = [];
      state.tempExecUndoStack.push({ ts: Date.now(), data: payload });
      if (state.tempExecUndoStack.length > 20) state.tempExecUndoStack.shift();
      return state.tempExecUndoStack.length;
    }

    function clearTempExecUndo() {
      state.tempExecUndoStack = [];
    }

    function restoreTempExecUndo() {
      if (!Array.isArray(state.tempExecUndoStack) || !state.tempExecUndoStack.length) return false;
      var undo = state.tempExecUndoStack.pop();
      if (!undo || !undo.data) return false;
      var payload = undo.data;
      var file = getTempExecFile(payload.fileId);
      if (!file) return false;
      if (payload.type === 'remove' && Array.isArray(payload.cases) && typeof payload.index === 'number') {
        var insertAt = Math.min(Math.max(payload.index, 0), file.cases.length);
        payload.cases.forEach(function(c, idx) {
          file.cases.splice(insertAt + idx, 0, c);
        });
        if (payload.newAddedKeys && Array.isArray(payload.newAddedKeys) && payload.newAddedKeys.length) {
          payload.cases.forEach(function(c) {
            var keys = getTempExecCaseUiKeys(c);
            var hit = keys.some(function(k) { return payload.newAddedKeys.indexOf(k) !== -1; });
            if (hit) markTempExecNewAdded(file.id, c);
          });
        }
        clearTempExecCaseStates(file.id);
        persistTempExecState();
        renderTempExecView();
        return true;
      }
      if (payload.type === 'insert' && typeof payload.index === 'number') {
        if (file.cases[payload.index]) {
          var removed = file.cases.splice(payload.index, 1);
          if (removed && removed[0]) unmarkTempExecNewAdded(file.id, removed[0]);
          if (payload.tempId) clearPendingExecCasePatch(payload.tempId);
          clearTempExecCaseStates(file.id);
          persistTempExecState();
          renderTempExecView();
          return true;
        }
      }
      return false;
    }

    function commitTempExecUndoToDb() {
      if (!isDbMode()) return;
      var client = getApiClient();
      if (!client || typeof client.createExecCase !== 'function' || typeof client.deleteExecCase !== 'function') return;
      if (!Array.isArray(state.tempExecUndoStack) || !state.tempExecUndoStack.length) return;

      var stack = state.tempExecUndoStack.slice();
      var chain = Promise.resolve();
      stack.forEach(function(entry) {
        chain = chain.then(function() {
          var payload = entry && entry.data ? entry.data : null;
          if (!payload || !payload.type) return;
          if (payload.type === 'remove' && Array.isArray(payload.cases)) {
            var removes = payload.cases.slice();
            removes.forEach(function(item) {
              if (!item) return;
              if (!item.execCaseId && !item.id && item._tempId) clearPendingExecCasePatch(item._tempId);
            });
            var sub = Promise.resolve();
            removes.forEach(function(item) {
              sub = sub.then(function() {
                var caseId = item && (item.execCaseId || item.id);
                if (!caseId) return;
                return client.deleteExecCase(caseId).catch(function() {});
              });
            });
            return sub;
          }
          if (payload.type === 'insert') {
            var file = getTempExecFile(payload.fileId);
            if (!file || !Array.isArray(file.cases)) return;
            var insertCase = null;
            if (payload.tempId) {
              insertCase = file.cases.find(function(item) { return item && item._tempId === payload.tempId; }) || null;
            }
            if (!insertCase && typeof payload.index === 'number') {
              insertCase = file.cases[payload.index] || null;
            }
            if (!insertCase) return;
            if (insertCase.execCaseId || insertCase.id) return;
            var tempId = insertCase._tempId ? String(insertCase._tempId) : '';
            var idx = file.cases.indexOf(insertCase);
            var afterCaseId = null;
            for (var i = idx - 1; i >= 0; i -= 1) {
              var prev = file.cases[i];
              var prevId = prev && (prev.execCaseId || prev.id);
              if (prevId) {
                afterCaseId = prevId;
                break;
              }
            }
            var execSetId = file.execSetId || Number(file.id);
            if (!execSetId) return;
            var payloadCreate = {
              after_case_id: afterCaseId || null,
              module: insertCase.module || '',
              title: insertCase.title || '',
              expected: insertCase.expected || '',
              priority: insertCase.priority || '',
              precondition: insertCase.preconditions || '',
              steps: insertCase.steps || '',
              remark: insertCase.remark || '',
              status: insertCase.actual || '未执行',
              reuse_details: insertCase.reuseDetails || [],
              defect_links: insertCase.defectLinks || [],
            };
            return client.createExecCase(execSetId, payloadCreate).then(function(created) {
              if (!created || !created.id) return;
              insertCase.execCaseId = created.id;
              insertCase.id = created.id;
              insertCase.caseItemId = created.case_item_id || null;
              insertCase.pendingCreate = false;
              var pendingPatch = tempId ? consumePendingExecCasePatch(tempId) : null;
              if (pendingPatch) queueExecCasePatch(created.id, pendingPatch);
              delete insertCase._tempId;
              // 入库后补充 id 标记：确保同一页面生命周期内即便触发 reload/load，也仍能保持高亮。
              markTempExecNewAdded(file.id, insertCase);
            }).catch(function() {});
          }
          return;
        });
      });
      chain.catch(function() {});
    }

    function cleanupTempExecUndoUI() {
      if (tempExecUndoTimer) {
        clearTimeout(tempExecUndoTimer);
        tempExecUndoTimer = null;
      }
      if (tempExecUndoInterval) {
        clearInterval(tempExecUndoInterval);
        tempExecUndoInterval = null;
      }
      if (tempExecUndoEl && tempExecUndoEl.parentNode) {
        tempExecUndoEl.parentNode.removeChild(tempExecUndoEl);
      }
      tempExecUndoEl = null;
    }

    var tempExecBlockHintEl = null;
    var tempExecBlockHintTimer = null;

    function cleanupTempExecBlockHint() {
      if (tempExecBlockHintTimer) {
        clearTimeout(tempExecBlockHintTimer);
        tempExecBlockHintTimer = null;
      }
      if (tempExecBlockHintEl && tempExecBlockHintEl.parentNode) {
        tempExecBlockHintEl.parentNode.removeChild(tempExecBlockHintEl);
      }
      tempExecBlockHintEl = null;
    }

    function positionTempExecBlockHint(hintEl, anchorRect) {
      if (!hintEl || !anchorRect) return;
      var rect = anchorRect;
      var hintRect = hintEl.getBoundingClientRect ? hintEl.getBoundingClientRect() : null;
      var hintW = hintRect && hintRect.width ? hintRect.width : 260;
      var hintH = hintRect && hintRect.height ? hintRect.height : 44;
      var vw = window.innerWidth || document.documentElement.clientWidth || 0;
      var vh = window.innerHeight || document.documentElement.clientHeight || 0;
      var margin = 8;
      var width = Number(rect.width) || 0;
      var height = Number(rect.height) || 0;
      var leftBase = Number(rect.left) || 0;
      var topBase = Number(rect.top) || 0;
      var bottomBase = Number.isFinite(Number(rect.bottom)) ? Number(rect.bottom) : (topBase + height);
      var centerX = leftBase + width / 2;
      var left = centerX - hintW / 2;
      if (vw) left = Math.min(Math.max(margin, left), Math.max(margin, vw - hintW - margin));
      var aboveTop = topBase - 10 - hintH;
      var belowTop = bottomBase + 10;
      var top = aboveTop >= margin ? aboveTop : belowTop;
      if (vh) top = Math.min(Math.max(margin, top), Math.max(margin, vh - hintH - margin));
      hintEl.style.left = Math.round(left) + 'px';
      hintEl.style.top = Math.round(top) + 'px';
    }

    function showTempExecBlockHint(anchorRect, message) {
      if (!anchorRect) return;
      cleanupTempExecBlockHint();
      var hint = document.createElement('div');
      hint.className = 'temp-click-hint';
      var text = document.createElement('span');
      text.textContent = message || '当前有待确认的增删操作，请先撤回或等待入库';
      hint.appendChild(text);
      document.body.appendChild(hint);
      tempExecBlockHintEl = hint;
      positionTempExecBlockHint(hint, anchorRect);
      tempExecBlockHintTimer = setTimeout(function() {
        if (!tempExecBlockHintEl) return;
        try { tempExecBlockHintEl.classList.add('fade-out'); } catch (_) {}
        setTimeout(function() { cleanupTempExecBlockHint(); }, 220);
      }, 3000);
    }

    function captureTempExecAnchorRect(anchorEl) {
      if (!anchorEl) return null;
      if (typeof anchorEl === 'object' && anchorEl.left !== undefined && anchorEl.top !== undefined) {
        var left0 = Number(anchorEl.left) || 0;
        var top0 = Number(anchorEl.top) || 0;
        var width0 = Number(anchorEl.width) || 0;
        var height0 = Number(anchorEl.height) || 0;
        var bottom0 = Number.isFinite(Number(anchorEl.bottom)) ? Number(anchorEl.bottom) : (top0 + height0);
        return { left: left0, top: top0, width: width0, height: height0, bottom: bottom0 };
      }
      if (typeof anchorEl.getBoundingClientRect !== 'function') return null;
      try {
        var rect = anchorEl.getBoundingClientRect();
        if (!rect) return null;
        var left = Number(rect.left) || 0;
        var top = Number(rect.top) || 0;
        var width = Number(rect.width) || 0;
        var height = Number(rect.height) || 0;
        return {
          left: left,
          top: top,
          width: width,
          height: height,
          bottom: Number.isFinite(Number(rect.bottom)) ? Number(rect.bottom) : (top + height),
        };
      } catch (err) {
        return null;
      }
    }

    function startTempExecUndoTimer(message, options) {
      options = options || {};
      var anchorRect = options.anchorRect || null;
      cleanupTempExecUndoUI();
      var baseMsg = message || '已应用变更';
      var remaining = 8;
      tempExecUndoEl = document.createElement('div');
      tempExecUndoEl.className = 'temp-undo-toast';
      var text = document.createElement('span');
      var btn = document.createElement('button');
      btn.className = 'pill secondary';
      btn.textContent = '撤销';
      var renderCountdown = function() {
        var count = Array.isArray(state.tempExecUndoStack) ? state.tempExecUndoStack.length : 0;
        var suffix = count > 1 ? '，可撤销 ' + count + ' 条' : '';
        text.textContent = baseMsg + suffix + '（' + remaining + 's）';
      };
      var handleUndoClick = function() {
        var success = restoreTempExecUndo();
        var hasMore = Array.isArray(state.tempExecUndoStack) && state.tempExecUndoStack.length > 0;
        if (success && hasMore) {
          remaining = 8;
          renderCountdown();
          return;
        }
        clearTempExecUndo();
        cleanupTempExecUndoUI();
        if (tempExecStatus) {
          setStatus(tempExecStatus, success ? '已撤销最近操作' : '无法撤销', success ? 'ok' : 'warn');
        }
      };
      btn.addEventListener('click', handleUndoClick);
      tempExecUndoEl.appendChild(text);
      tempExecUndoEl.appendChild(btn);
      document.body.appendChild(tempExecUndoEl);
      renderCountdown();
      tempExecUndoInterval = setInterval(function() {
        remaining -= 1;
        if (remaining <= 0) return;
        renderCountdown();
      }, 1000);
      tempExecUndoTimer = setTimeout(function() {
        commitTempExecUndoToDb();
        clearTempExecUndo();
        cleanupTempExecUndoUI();
      }, remaining * 1000);
      if (tempExecStatus) setStatus(tempExecStatus, baseMsg, 'ok');
    }

    function insertTempExecCase(fileId, index, anchorEl) {
      var file = getTempExecFile(fileId);
      if (!file || !Array.isArray(file.cases)) return;
      var anchorRect = captureTempExecAnchorRect(anchorEl);
      if (tempExecUndoTimer) {
        if (tempExecStatus) {
          setStatus(tempExecStatus, '当前有待确认的增删操作，请先撤回或等待入库', 'warn');
        }
        if (anchorRect) {
          showTempExecBlockHint(anchorRect, '当前有待确认的增删操作，请先撤回或等待入库');
        }
        return;
      }
      var base = file.cases[index] || {};
      var moduleName = base.module || '';
      var reuseDetails = buildReuseDetailsFromPresets(file);
      var fresh = {
        module: moduleName,
        title: '',
        priority: '',
        preconditions: '',
        steps: '',
        expected: '',
        actual: file.reuseEnabled ? resolveReuseAggregateStatus(reuseDetails) : '未执行',
        remark: '',
        reuseDetails: reuseDetails,
        defectLinks: [],
      };
      ensureTempExecNewAddedUiKey(fresh);
      if (isDbMode()) {
        fresh._tempId = generateTempExecId();
        fresh.pendingCreate = true;
      }
      var insertAt = Number.isInteger(index) && index >= -1 ? index + 1 : file.cases.length;
      file.cases.splice(insertAt, 0, fresh);
      markTempExecNewAdded(fileId, fresh);
      pushTempExecUndo({ type: 'insert', fileId: fileId, index: insertAt, tempId: fresh._tempId || '' });
      clearTempExecCaseStates(fileId);
      persistTempExecState();
      renderTempExecView();
      if (tempExecStatus) {
        setStatus(tempExecStatus, '已插入空用例', 'ok');
        startTempExecUndoTimer('已插入空用例', { anchorRect: anchorRect });
      }
    }

    function removeTempExecCase(fileId, index, anchorEl) {
      var file = getTempExecFile(fileId);
      if (!file || !Array.isArray(file.cases) || !file.cases[index]) return;
      var anchorRect = captureTempExecAnchorRect(anchorEl);
      if (tempExecUndoTimer) {
        if (tempExecStatus) {
          setStatus(tempExecStatus, '当前有待确认的增删操作，请先撤回或等待入库', 'warn');
        }
        if (anchorRect) {
          showTempExecBlockHint(anchorRect, '当前有待确认的增删操作，请先撤回或等待入库');
        }
        return;
      }
      openConfirmDrawer({
        title: '删除用例',
        message: '确定删除该条用例吗？此操作不可撤销。',
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
      }).then(function(result) {
        if (!result || result.ok !== true) return;
        if (tempExecUndoTimer) {
          if (tempExecStatus) {
            setStatus(tempExecStatus, '当前有待确认的增删操作，请先撤回或等待入库', 'warn');
          }
          if (anchorRect) {
            showTempExecBlockHint(anchorRect, '当前有待确认的增删操作，请先撤回或等待入库');
          }
          return;
        }
        var targetFile = getTempExecFile(fileId);
        if (!targetFile || !Array.isArray(targetFile.cases) || !targetFile.cases[index]) return;
        var removed = targetFile.cases.splice(index, 1);
        var newAddedKeys = [];
        removed.forEach(function(item) {
          if (!isTempExecNewAdded(fileId, item)) return;
          getTempExecCaseUiKeys(item).forEach(function(k) { if (k && newAddedKeys.indexOf(k) === -1) newAddedKeys.push(k); });
          unmarkTempExecNewAdded(fileId, item);
        });
        pushTempExecUndo({ type: 'remove', fileId: fileId, index: index, cases: removed, newAddedKeys: newAddedKeys });
        clearTempExecCaseStates(fileId);
        persistTempExecState();
        renderTempExecView();
        if (tempExecStatus) {
          setStatus(tempExecStatus, '用例已删除', 'ok');
          startTempExecUndoTimer('用例已删除', { anchorRect: anchorRect });
        }
      });
    }

    function updateTempExecCaseField(fileId, index, field, value) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var allowed = ['title', 'priority', 'preconditions', 'steps', 'expected'];
      if (allowed.indexOf(field) === -1) return;
      var text = typeof value === 'string' ? value : '';
      if (field === 'priority') {
        var normalized = (text || '').trim().toUpperCase();
        file.cases[index][field] = normalized;
      } else {
        file.cases[index][field] = text;
      }
      if (isDbMode()) {
        var item = file.cases[index];
        if (item) {
          var payload = {};
          if (field === 'title') payload.title = file.cases[index].title;
          if (field === 'priority') payload.priority = file.cases[index].priority;
          if (field === 'preconditions') payload.precondition = file.cases[index].preconditions;
          if (field === 'steps') payload.steps = file.cases[index].steps;
          if (field === 'expected') payload.expected = file.cases[index].expected;
          queueExecCasePatchForItem(item, payload);
        }
      }
      persistTempExecState();
    }

    function toggleTempExecSelection(fileId, index, checked) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      var selection = ensureTempExecSelection(fileId);
      if (checked) {
        selection.add(index);
      } else {
        selection.delete(index);
      }
      state.tempExecPreserveScrollOnce = true;
      renderTempExecView();
    }

    function toggleTempExecSelectAll(fileId, checked, indexes) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      var selection = ensureTempExecSelection(fileId);
      selection.clear();
      var targets = Array.isArray(indexes) && indexes.length
        ? indexes
        : file.cases.map(function(_, idx) { return idx; });
      if (checked) targets.forEach(function(idx) { selection.add(idx); });
      state.tempExecPreserveScrollOnce = true;
      renderTempExecView();
    }

	    function removeTempExecFile(fileId) {
	      var idx = state.tempExecFiles.findIndex(function(item) { return item.id === fileId; });
	      if (idx === -1) return;
	      var targetFile = state.tempExecFiles[idx];
	      var restoredFromId = targetFile && targetFile.restoredFromId ? String(targetFile.restoredFromId) : '';
	      var execSetId = targetFile && (targetFile.execSetId || targetFile.id) ? String(targetFile.execSetId || targetFile.id) : '';
	      if (execSetId) clearTempExecCaseLibraryDiffMeta(execSetId, { render: true });
	      if (isDbMode()) {
	        var client = getApiClient();
	        var execSetIdNum = targetFile && (targetFile.execSetId || Number(targetFile.id));
	        if (client && execSetIdNum && typeof client.deleteExecSet === 'function') {
	          var deletePromise = client.deleteExecSet(execSetIdNum);
	          if (deletePromise && typeof deletePromise.then === 'function') {
	            deletePromise.then(function() {
	              if (restoredFromId && typeof loadTempExecState === 'function') {
	                loadTempExecState();
	              }
	            }).catch(function(err) {
	              if (tempExecStatus) {
	                var msg = err && err.message ? err.message : '执行集删除失败，刷新后可能会再次出现';
	                setStatus(tempExecStatus, msg, 'warn');
	              }
	            });
	          } else if (restoredFromId && typeof loadTempExecState === 'function') {
	            loadTempExecState();
	          }
	        } else if (restoredFromId && typeof loadTempExecState === 'function') {
	          loadTempExecState();
	        }
	      }
	      removeTempExecFromVersion(fileId, { silent: true });
      state.tempExecFiles.splice(idx, 1);
      var placement = ensureTempExecPlacement();
      Object.keys(placement.fileOrder || {}).forEach(function(req) {
        removeFileFromOrder(req, fileId);
      });
      if (placement.fileOrderByProjectVersion && typeof placement.fileOrderByProjectVersion === 'object') {
        var pid = targetFile && targetFile.projectId ? String(targetFile.projectId) : '';
        var vid = targetFile && targetFile.versionId !== null && targetFile.versionId !== undefined ? String(targetFile.versionId || '') : '';
        if (pid && placement.fileOrderByProjectVersion[pid] && placement.fileOrderByProjectVersion[pid][vid]) {
          placement.fileOrderByProjectVersion[pid][vid] = placement.fileOrderByProjectVersion[pid][vid]
            .filter(function(id) { return String(id) !== String(fileId); });
        }
      }
      delete state.tempExecSelections[fileId];
      delete state.tempExecRemarkOpen[fileId];
      delete state.tempExecReuseOpen[fileId];
      delete state.tempExecPages[fileId];
      state.tempExecFocus = state.tempExecFocus.filter(function(id) { return id !== fileId; });
      saveTempExecFocus();
      delete state.tempExecDefectOpen[fileId];
      if (state.tempExecPresetDraft && state.tempExecPresetDraft.fileId === fileId) {
        state.tempExecPresetDraft = null;
      }
      var nextId = state.tempExecActiveId;
      if (state.tempExecActiveId === fileId) {
        if (isDbMode() && targetFile && targetFile.projectId) {
          var pid2 = String(targetFile.projectId || '');
          var sameProjectList = state.tempExecFiles.filter(function(item) {
            if (!item) return false;
            if (String(item.scope || '') !== 'current') return false;
            return String(item.projectId || '') === pid2;
          });
          nextId = sameProjectList.length ? sameProjectList[0].id : '';
        } else {
          var currentList = state.tempExecFiles.filter(function(item) { return item.scope === 'current'; });
          nextId = currentList.length ? currentList[0].id : (state.tempExecFiles[0] ? state.tempExecFiles[0].id : '');
        }
      }
      persistTempExecState();
      setTempExecActive(nextId);
      renderTempVersionGrid();
    }

    function reorderTempExecProject(sourceProjectId, targetProjectId, opts) {
      if (!isTempExecProjectLayoutEnabled()) return;
      var placement = ensureTempExecPlacement();
      var src = sourceProjectId === null || sourceProjectId === undefined ? '' : String(sourceProjectId);
      var tgt = targetProjectId === null || targetProjectId === undefined ? '' : String(targetProjectId);
      if (!src || !tgt || src === tgt) return;
      var insertAfter = false;
      if (opts && typeof opts === 'object') insertAfter = Boolean(opts.after);
      else if (opts === true) insertAfter = true;
      placement.projectOrder = Array.isArray(placement.projectOrder) ? placement.projectOrder : [];
      placement.projectOrder = placement.projectOrder.filter(function(id) { return id !== src; });
      var idx = placement.projectOrder.indexOf(tgt);
      if (idx === -1) {
        if (insertAfter) placement.projectOrder.push(src);
        else placement.projectOrder.unshift(src);
      } else {
        placement.projectOrder.splice(insertAfter ? (idx + 1) : idx, 0, src);
      }
      persistTempExecState();
      renderTempVersionGrid();
    }

    function reorderTempExecProjectVersion(projectId, sourceVersionId, targetVersionId, opts) {
      if (!isTempExecProjectLayoutEnabled()) return;
      var pid = projectId === null || projectId === undefined ? '' : String(projectId);
      if (!pid) return;
      var placement = ensureTempExecPlacement();
      if (!placement.versionOrderByProject[pid]) placement.versionOrderByProject[pid] = [];
      var src = sourceVersionId === null || sourceVersionId === undefined ? '' : String(sourceVersionId || '');
      var tgt = targetVersionId === null || targetVersionId === undefined ? '' : String(targetVersionId || '');
      if (src === tgt) return;
      var insertAfter = false;
      if (opts && typeof opts === 'object') insertAfter = Boolean(opts.after);
      else if (opts === true) insertAfter = true;
      placement.versionOrderByProject[pid] = placement.versionOrderByProject[pid].filter(function(id) { return id !== src; });
      var idx = placement.versionOrderByProject[pid].indexOf(tgt);
      if (idx === -1) {
        if (insertAfter) placement.versionOrderByProject[pid].push(src);
        else placement.versionOrderByProject[pid].unshift(src);
      } else {
        placement.versionOrderByProject[pid].splice(insertAfter ? (idx + 1) : idx, 0, src);
      }
      persistTempExecState();
      renderTempVersionGrid();
    }

    function reorderTempExecFileInProjectVersion(projectId, versionId, fileId, beforeId) {
      if (!isTempExecProjectLayoutEnabled()) return;
      var pid = projectId === null || projectId === undefined ? '' : String(projectId);
      if (!pid) return;
      var vid = versionId === null || versionId === undefined ? '' : String(versionId || '');
      var id = fileId === null || fileId === undefined ? '' : String(fileId);
      if (!id) return;
      var placement = ensureTempExecPlacement();
      if (!placement.fileOrderByProjectVersion[pid]) placement.fileOrderByProjectVersion[pid] = {};
      if (!placement.fileOrderByProjectVersion[pid][vid]) placement.fileOrderByProjectVersion[pid][vid] = [];
      var order = placement.fileOrderByProjectVersion[pid][vid].filter(function(item) { return item !== id; });
      var before = beforeId === null || beforeId === undefined ? '' : String(beforeId);
      if (before && order.indexOf(before) !== -1) {
        order.splice(order.indexOf(before), 0, id);
      } else {
        order.push(id);
      }
      placement.fileOrderByProjectVersion[pid][vid] = order;
      persistTempExecState();
      renderTempVersionGrid();
    }

	    function bulkRemoveTempExecFiles(fileIds, opts) {
      var list = Array.isArray(fileIds)
        ? fileIds.map(function(id) { return id === null || id === undefined ? '' : String(id); }).filter(Boolean)
        : String(fileIds || '').split(',').map(function(id) { return id.trim(); }).filter(Boolean);
      if (!list.length) return;
      var removeSet = new Set(list.map(function(id) { return String(id); }));
      var originalActiveId = String(state.tempExecActiveId || '');
      var removedActive = removeSet.has(originalActiveId);
      var placement = ensureTempExecPlacement();
      var needsReload = false;
      var deletePromises = [];
      list.forEach(function(id) {
        var idx = state.tempExecFiles.findIndex(function(item) { return item && String(item.id) === String(id); });
        if (idx === -1) return;
        var targetFile = state.tempExecFiles[idx];
        if (targetFile && targetFile.restoredFromId) needsReload = true;
	        if (isDbMode()) {
	          var client = getApiClient();
	          var execSetId = targetFile && (targetFile.execSetId || Number(targetFile.id));
	          if (client && execSetId && typeof client.deleteExecSet === 'function') {
	            var deletePromise = client.deleteExecSet(execSetId);
	            if (deletePromise && typeof deletePromise.then === 'function') {
	              deletePromises.push(deletePromise);
	            }
	          }
	        }
	        removeTempExecFromVersion(String(id), { silent: true });
        Object.keys(placement.fileOrder || {}).forEach(function(req) {
          removeFileFromOrder(req, String(id));
        });
        if (placement.fileOrderByProjectVersion && typeof placement.fileOrderByProjectVersion === 'object') {
          var pid = targetFile && targetFile.projectId ? String(targetFile.projectId) : '';
          var vid = targetFile && targetFile.versionId !== null && targetFile.versionId !== undefined ? String(targetFile.versionId || '') : '';
          if (pid && placement.fileOrderByProjectVersion[pid] && placement.fileOrderByProjectVersion[pid][vid]) {
            placement.fileOrderByProjectVersion[pid][vid] = placement.fileOrderByProjectVersion[pid][vid]
              .filter(function(item) { return String(item) !== String(id); });
	    }
        }
        delete state.tempExecSelections[String(id)];
        delete state.tempExecRemarkOpen[String(id)];
        delete state.tempExecReuseOpen[String(id)];
        delete state.tempExecPages[String(id)];
        state.tempExecFocus = (state.tempExecFocus || []).filter(function(fid) { return String(fid) !== String(id); });
        delete state.tempExecDefectOpen[String(id)];
        if (state.tempExecPresetDraft && String(state.tempExecPresetDraft.fileId) === String(id)) {
          state.tempExecPresetDraft = null;
        }
      });
      state.tempExecFiles = state.tempExecFiles.filter(function(file) { return file && !removeSet.has(String(file.id)); });
      saveTempExecFocus();
      var nextId = state.tempExecActiveId;
      if (removedActive) {
        nextId = state.tempExecFiles.length ? state.tempExecFiles[0].id : '';
      }
      persistTempExecState();
      setTempExecActive(nextId);
      renderTempVersionGrid();
      renderTempExecView();
      if (needsReload && deletePromises.length && typeof Promise !== 'undefined') {
        Promise.all(deletePromises.map(function(p) { return p.catch(function() { return null; }); }))
          .then(function() {
            if (typeof loadTempExecState === 'function') loadTempExecState();
          });
      } else if (needsReload && typeof loadTempExecState === 'function') {
        loadTempExecState();
      }
      if (tempExecStatus && !(opts && opts.silentStatus)) {
        setStatus(tempExecStatus, '已移除 ' + list.length + ' 份用例', 'ok');
      }
    }

    function removeTempExecProject(projectId) {
      if (!isTempExecProjectLayoutEnabled()) return;
      var pid = projectId === null || projectId === undefined ? '' : String(projectId);
      if (!pid) return;
      if (!Array.isArray(state.tempExecArchivedHidden)) state.tempExecArchivedHidden = [];
      var hideKey = pid + '::';
      if (state.tempExecArchivedHidden.indexOf(hideKey) === -1) state.tempExecArchivedHidden.push(hideKey);
      if (Array.isArray(state.tempExecArchivedFiles) && state.tempExecArchivedFiles.length) {
        state.tempExecArchivedFiles = state.tempExecArchivedFiles.filter(function(file) {
          return !(file && String(file.projectId) === pid);
        });
      }
      var ids = (state.tempExecFiles || [])
        .filter(function(file) { return file && String(file.projectId) === pid; })
        .map(function(file) { return String(file.id); });
      bulkRemoveTempExecFiles(ids, { silentStatus: false });
      renderTempExecOverview();
    }

    function removeTempExecProjectVersion(projectId, versionId) {
      if (!isTempExecProjectLayoutEnabled()) return;
      var pid = projectId === null || projectId === undefined ? '' : String(projectId);
      var vid = versionId === null || versionId === undefined ? '' : String(versionId || '');
      if (!pid) return;
      if (!Array.isArray(state.tempExecArchivedHidden)) state.tempExecArchivedHidden = [];
      var hideKey = pid + '::' + vid;
      if (state.tempExecArchivedHidden.indexOf(hideKey) === -1) state.tempExecArchivedHidden.push(hideKey);
      if (Array.isArray(state.tempExecArchivedFiles) && state.tempExecArchivedFiles.length) {
        state.tempExecArchivedFiles = state.tempExecArchivedFiles.filter(function(file) {
          if (!file) return false;
          return !(String(file.projectId) === pid && String(file.versionId || '') === vid);
        });
      }
      var ids = (state.tempExecFiles || [])
        .filter(function(file) { return file && String(file.projectId) === pid && String(file.versionId || '') === vid; })
        .map(function(file) { return String(file.id); });
      bulkRemoveTempExecFiles(ids, { silentStatus: false });
      renderTempExecOverview();
    }

    // 解散归档占位：仅移除“已归档”占位，不影响未归档用例与归档记录本身。
    function dissolveTempExecArchivedProjectVersion(projectId, versionId) {
      if (!isTempExecProjectLayoutEnabled()) return;
      var pid = projectId === null || projectId === undefined ? '' : String(projectId);
      var vid = versionId === null || versionId === undefined ? '' : String(versionId || '');
      if (!pid) return;
      var archived = Array.isArray(state.tempExecArchivedFiles) ? state.tempExecArchivedFiles.slice() : [];
      var targets = archived.filter(function(file) {
        if (!file) return false;
        return String(file.projectId) === pid && String(file.versionId || '') === vid;
      });
      if (!targets.length) {
        if (tempExecStatus) setStatus(tempExecStatus, '当前版本无已归档占位', 'ok');
        return;
      }
      if (!Array.isArray(state.tempExecArchivedHidden)) state.tempExecArchivedHidden = [];
      // 解散仅针对当前已有的归档占位（按 exec_set_id 记忆），不影响未来新归档用例再次占位。
      targets.forEach(function(file) {
        var sid = file && file.id !== null && file.id !== undefined ? String(file.id) : '';
        if (!sid) return;
        if (state.tempExecArchivedHidden.indexOf(sid) === -1) state.tempExecArchivedHidden.push(sid);
      });
      state.tempExecArchivedFiles = archived.filter(function(file) {
        if (!file) return false;
        return !(String(file.projectId) === pid && String(file.versionId || '') === vid);
      });
      persistTempExecState();
      renderTempVersionGrid();
      renderTempExecOverview();
      if (tempExecStatus) setStatus(tempExecStatus, '已解散归档占位（' + targets.length + ' 份）', 'ok');
    }

    function reorderTempRequirement(sourceReq, targetReq) {
      var src = normalizeRequirementName(sourceReq);
      var tgt = normalizeRequirementName(targetReq);
      if (!src || !tgt || src === tgt) return;
      reorderRequirementOrder(src, tgt);
      renderTempExecNav();
      renderTempVersionGrid();
    }

    function loadTempExecFocus() {
      var saved = [];
      try {
        saved = JSON.parse(localStorage.getItem(tempExecFocusStorageKey) || '[]');
      } catch (err) {
        saved = [];
      }
      if (!Array.isArray(saved)) saved = [];
      state.tempExecFocus = saved.filter(function(id) { return typeof id === 'string'; });
      syncTempExecFocus(true);
      saveTempExecFocus();
    }

    function saveTempExecFocus() {
      try {
        localStorage.setItem(tempExecFocusStorageKey, JSON.stringify(state.tempExecFocus));
      } catch (err) {
        console.warn('专注区数据保存失败', err);
      }
      scheduleTempExecUiSave();
    }

    function syncTempExecFocus(skipSave) {
      var valid = state.tempExecFocus.filter(function(id) { return Boolean(getTempExecFile(id)); });
      if (valid.length !== state.tempExecFocus.length) {
        state.tempExecFocus = valid;
        if (!skipSave) saveTempExecFocus();
      } else if (!skipSave) {
        saveTempExecFocus();
      }
    }

    function addTempExecFocus(fileId) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      if (state.tempExecFocus[0] === fileId) return;
      state.tempExecFocus = [fileId].concat(state.tempExecFocus.filter(function(id) { return id !== fileId; }));
      saveTempExecFocus();
      scheduleTempExecUiSave();
      if (state.tempExecActiveId !== fileId) {
        setTempExecActive(fileId);
      } else {
        renderTempExecNav();
        renderTempVersionGrid();
      }
      renderTempFocusZone();
    }

    function insertTempExecFocus(fileId, insertIndex) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      var list = (state.tempExecFocus || []).filter(function(id) { return id !== fileId; });
      var idx = Number(insertIndex);
      if (!Number.isFinite(idx)) idx = list.length;
      if (idx < 0) idx = 0;
      if (idx > list.length) idx = list.length;
      list.splice(idx, 0, fileId);
      state.tempExecFocus = list;
      saveTempExecFocus();
      scheduleTempExecUiSave();
      if (state.tempExecActiveId !== fileId) {
        setTempExecActive(fileId);
      } else {
        renderTempExecNav();
        renderTempVersionGrid();
        renderTempFocusZone();
      }
    }

    function removeTempExecFocus(fileId, requireConfirm) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      var needConfirm = requireConfirm !== false;
      if (needConfirm) {
        var confirmed = window.confirm('确定将【' + file.name + '】移出专注区吗？');
        if (!confirmed) return;
      }
      state.tempExecFocus = state.tempExecFocus.filter(function(id) { return id !== fileId; });
      file.scope = 'history';
      persistTempExecState();
      saveTempExecFocus();
      renderTempExecNav();
      renderTempVersionGrid();
      renderTempFocusZone();
    }

    function buildTempExecPagination(file, totalCases, pageIndex, totalPages, start, end) {
      var pageSize = getTempExecPageSize();
      var displayStart = totalCases ? start + 1 : 0;
      var displayEnd = totalCases ? Math.min(end, totalCases) : 0;
      var maxPage = Math.max(totalPages, 1);
      var currentPage = totalPages ? pageIndex + 1 : 1;
      var rangeInfo = totalCases
        ? '显示 ' + displayStart + '-' + displayEnd + ' / ' + totalCases + ' 条'
        : '暂无用例';
      return (
        '<div class="temp-pagination">' +
          '<div class="temp-pagination-info">' + rangeInfo + '，每页 ' + pageSize + ' 条</div>' +
          '<div class="temp-pagination-controls">' +
            '<button type="button" class="secondary" data-temp-page-action="' + file.id + '" data-action="prev" ' + (pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
            '<span>第 ' + currentPage + ' / ' + maxPage + ' 页</span>' +
            '<button type="button" class="secondary" data-temp-page-action="' + file.id + '" data-action="next" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
            '<label>跳至' +
              '<input type="number" min="1" max="' + maxPage + '" value="' + Math.min(currentPage, maxPage) + '" data-temp-page-input="' + file.id + '">' +
              '页' +
            '</label>' +
          '</div>' +
        '</div>'
      );
    }

    function renderReusePresetPanel(file) {
      var presets = ensureReusePresets(file);
      var draft = state.tempExecPresetDraft && state.tempExecPresetDraft.fileId === file.id
        ? state.tempExecPresetDraft.value || ''
        : null;
      var chips = presets.map(function(preset) {
        var presetText = preset && preset.text ? preset.text : '';
        return (
          '<span class="preset-chip">' +
            '<span class="preset-text" data-temp-reuse-preset-edit="' + file.id + '" data-preset="' + preset.id + '" title="点击编辑">' + escapeHtml(presetText) + '</span>' +
            '<span class="remove" data-temp-reuse-preset-remove="' + file.id + '" data-preset="' + preset.id + '" title="删除预设子项">×</span>' +
          '</span>'
        );
      }).join('');
      var inputHtml = draft !== null
        ? (
          '<span class="preset-input">' +
            '<input data-temp-reuse-preset-input="' + file.id + '" value="' + escapeHtml(draft) + '" placeholder="输入预设子项..." />' +
            '<button type="button" data-temp-reuse-preset-confirm="' + file.id + '">保存</button>' +
            '<button type="button" data-temp-reuse-preset-cancel>取消</button>' +
          '</span>'
        )
        : '';
      var placeholder = !chips && draft === null
        ? '<span class="hint">暂无预设子项，可提前配置常用测试项</span>'
        : '';
      return (
        '<div class="reuse-presets">' +
          '<button type="button" class="preset-add" data-temp-reuse-preset-add="' + file.id + '">＋ 预设子项</button>' +
          inputHtml +
          (chips || placeholder) +
        '</div>'
      );
    }

    function renderReuseEntries(file, caseItem, caseIndex) {
      var details = Array.isArray(caseItem.reuseDetails) ? caseItem.reuseDetails : [];
      var visibleDetails = details.filter(function(detail) { return detail && !isReuseDetailRemoved(detail); });
      if (!visibleDetails.length) {
        return '<p class="reuse-empty">暂无复用测试项，点击下方“＋ 添加测试项”。</p>';
      }
      return (
        '<div class="reuse-list">' +
          visibleDetails.map(function(detail) {
            var currentStatus = detail && detail.status ? String(detail.status) : '未执行';
            currentStatus = currentStatus.trim();
            if (currentStatus === 'pending') currentStatus = '未执行';
            var statusClass = mapStatusToClass(currentStatus);
            var optionsHtml = '';
            // 系统态：展示为当前值，但不允许用户主动选择（不出现在常规选项中）。
            if (currentStatus === '变更重跑' || currentStatus === '有改动') {
              statusClass = 'changed';
              optionsHtml += '<option value="' + escapeHtml(currentStatus) + '" selected disabled>' + escapeHtml(currentStatus) + '</option>';
            }
            optionsHtml += tempExecResultOptions.map(function(opt) {
              return '<option value="' + opt + '" ' + (currentStatus === opt ? 'selected' : '') + '>' + opt + '</option>';
            }).join('');
            return (
              '<div class="reuse-entry" data-detail="' + detail.id + '">' +
                '<input class="reuse-input" data-temp-reuse-text="' + file.id + '" data-index="' + caseIndex + '" data-detail="' + detail.id + '" placeholder="输入测试项..." value="' + escapeHtml(detail.text || '') + '"/>' +
                '<input class="reuse-note" data-temp-reuse-note="' + file.id + '" data-index="' + caseIndex + '" data-detail="' + detail.id + '" placeholder="输入独立备注..." value="' + escapeHtml(detail.note || '') + '"/>' +
                '<select class="status-select ' + statusClass + '" data-temp-reuse-status="' + file.id + '" data-index="' + caseIndex + '" data-detail="' + detail.id + '">' +
                  optionsHtml +
                '</select>' +
                '<button type="button" class="reuse-remove" data-temp-reuse-remove="' + file.id + '" data-index="' + caseIndex + '" data-detail="' + detail.id + '" title="删除测试项">删除</button>' +
              '</div>'
            );
          }).join('') +
        '</div>'
      );
    }

    function renderDefectLinks(caseItem, fileId, caseIndex) {
      var links = Array.isArray(caseItem.defectLinks) ? caseItem.defectLinks : [];
      if (!links.length) {
        return '<p class="reuse-empty">暂无缺陷链接，点击下方“＋ 添加链接”。</p>';
      }
      return (
        '<div class="defect-list">' +
          links.map(function(link) {
            return (
              '<div class="defect-entry" data-link="' + link.id + '">' +
                '<input type="url" placeholder="粘贴缺陷链接..." value="' + escapeHtml(link.url || '') + '" data-temp-defect-link="' + fileId + '" data-index="' + caseIndex + '" data-link="' + link.id + '">' +
                '<button type="button" class="defect-open" data-temp-defect-open="' + fileId + '" data-index="' + caseIndex + '" data-link="' + link.id + '">打开</button>' +
                '<button type="button" class="defect-remove" data-temp-defect-remove="' + fileId + '" data-index="' + caseIndex + '" data-link="' + link.id + '">删除</button>' +
              '</div>'
            );
          }).join('') +
        '</div>'
      );
    }

    function renderTempExecTable(file) {
      var searchState = state.tempExecSearch || { fileId: '', term: '', raw: '' };
      var searchTerm = searchState.fileId === file.id ? (searchState.term || '') : '';
      var statusFilter = state.tempExecStatusFilter || { fileId: '', status: '' };
      var hasFilter = statusFilter.fileId === file.id && statusFilter.status;
      var matches = file.cases.map(function(item, idx) { return { item: item, idx: idx }; }).filter(function(entry) {
        var status = getCaseExecutionStatus(file, entry.item);
        if (hasFilter && !mapFilterToStatus(statusFilter.status, status)) return false;
        if (!searchTerm) return true;
        var target = [
          entry.item.module,
          entry.item.title,
          entry.item.priority,
          entry.item.preconditions,
          entry.item.steps,
          entry.item.expected,
          entry.item.remark,
        ].map(function(text) { return (text || '').toString().toLowerCase(); }).join(' ');
        return target.indexOf(searchTerm) !== -1;
      });
      var selection = ensureTempExecSelection(file.id);
      var remarkOpenSet = ensureTempExecRemarkOpen(file.id);
      var reuseOpenSet = ensureTempExecReuseOpen(file.id);
      var defectOpenSet = ensureTempExecDefectOpen(file.id);
      var reuseEnabled = Boolean(file.reuseEnabled);
      var pageSize = getTempExecPageSize();
      var totalCases = matches.length;
      var totalPages = totalCases ? Math.ceil(totalCases / pageSize) : 1;
      var pageIndex = ensureTempExecPageIndex(file.id);
      if (pageIndex >= totalPages) {
        pageIndex = Math.max(totalPages - 1, 0);
        state.tempExecPages[file.id] = pageIndex;
      }
      var start = pageIndex * pageSize;
      var end = Math.min(totalCases, start + pageSize);
      var cols = ensureTempExecColumns();
      var show = function(key) { return isRequiredTempExecColumn(key) ? true : cols[key] !== false; };
      var visibleIndexes = [];
      var columnOrder = ['select', 'index', 'module', 'title', 'priority', 'preconditions', 'steps', 'expected', 'actual', 'remark', 'defect', 'ops'];
      var visibleKeys = columnOrder.filter(show);
      var colCount = visibleKeys.length || 1;

      // 字段列宽：对齐“归档详情”视图的字段宽度；实际/备注/缺陷链接按需求固定；隐藏字段的宽度平均补给其他可伸缩字段。
      var baseEm = {
        module: 8,
        title: 9,
        priority: 5,
        preconditions: 12,
        // 操作步骤减少 1 个汉字宽度；预期结果减少 2 个汉字宽度；宽度加到“实际结果”。
        steps: 14,
        expected: 14,
      };
      // 优先级列不参与“平均补宽”，保持基准宽度不变。
      var stretchKeys = Object.keys(baseEm).filter(function(key) { return key !== 'priority'; });
      var hiddenEm = 0;
      Object.keys(baseEm).forEach(function(key) {
        if (!show(key)) hiddenEm += Number(baseEm[key]) || 0;
      });
      // “编号”列被隐藏时，其宽度也应补给其他字段（近似按 4 个汉字宽度计算）。
      if (!show('index')) hiddenEm += 4;
      var stretchVisible = stretchKeys.filter(show);
      var extraEm = stretchVisible.length ? (hiddenEm / stretchVisible.length) : 0;
      var widthByKey = {
        select: '36px',
        index: '50px',
        actual: emToPx(7) + 'px',
        remark: emToPx(6) + 'px',
        defect: emToPx(6) + 'px',
        ops: '40px',
      };
      stretchVisible.forEach(function(key) {
        var base = Number(baseEm[key]) || 0;
        var w = base + extraEm;
        // 避免产生过长小数，减少 HTML 体积
        var fixed = Math.round(w * 100) / 100;
        widthByKey[key] = emToPx(fixed) + 'px';
      });
      if (show('priority')) widthByKey.priority = emToPx(Number(baseEm.priority) || 5) + 'px';
      var colgroup = '<colgroup>' + visibleKeys.map(function(key) {
        var width = widthByKey[key] || '';
        return width ? ('<col style="width:' + width + '">') : '<col>';
      }).join('') + '</colgroup>';

      var paged = matches.filter(function(_, idx) { return idx >= start && idx < end; });
      var rows = paged.map(function(entry) {
        var item = entry.item;
        var idx = entry.idx;
        visibleIndexes.push(idx);
        var editPlaceholder = '点击此处编辑';
        var moduleHtml = escapeHtml(item.module || '-');
        var titleHtml = item.title ? escapeHtml(item.title) : '';
        var priorityHtml = item.priority ? escapeHtml(item.priority) : '';
        var preHtml = item.preconditions ? escapeHtml(item.preconditions).replace(/\n/g, '<br>') : '';
        var stepsHtml = item.steps ? escapeHtml(item.steps).replace(/\n/g, '<br>') : '';
        var expectedHtml = item.expected ? escapeHtml(item.expected).replace(/\n/g, '<br>') : '';
        var remarkOpen = remarkOpenSet.has(idx);
        var reuseOpen = reuseOpenSet.has(idx);
        var hasRemark = Boolean(item.remark && item.remark.trim());
        var remarkBtnClass = ['remark-toggle'];
        if (remarkOpen) remarkBtnClass.push('active');
        if (hasRemark) remarkBtnClass.push('filled');
        var defectOpen = defectOpenSet.has(idx);
        var hasDefects = Array.isArray(item.defectLinks) && item.defectLinks.length;
        var defectBtnClass = ['defect-toggle'];
        if (defectOpen) defectBtnClass.push('active');
        if (hasDefects) defectBtnClass.push('filled');
        var currentStatus = item && item.actual ? String(item.actual) : '未执行';
        currentStatus = currentStatus.trim();
        if (currentStatus === 'pending') currentStatus = '未执行';
        var resultOptions = '';
        // 系统态：展示为当前值，但不允许用户主动选择（不出现在常规选项中）。
        if (currentStatus === '变更重跑' || currentStatus === '有改动') {
          resultOptions += '<option value="' + escapeHtml(currentStatus) + '" selected disabled>' + escapeHtml(currentStatus) + '</option>';
        }
        resultOptions += tempExecResultOptions.map(function(opt) {
          return '<option value="' + opt + '" ' + (currentStatus === opt ? 'selected' : '') + '>' + opt + '</option>';
        }).join('');
        var reuseStatus = getCaseExecutionDisplay(file, item);
        var pendingReuseCount = 0;
        if (reuseEnabled && !reuseOpen) {
          var details = Array.isArray(item.reuseDetails) ? item.reuseDetails : [];
          if (details.length) pendingReuseCount = aggregateReuseDetails(details).pending || 0;
        }
        var reusePendingBadge = pendingReuseCount > 0
          ? '<span class="reuse-pending-badge" data-reuse-pending="' + pendingReuseCount + '">' + pendingReuseCount + '</span>'
          : '';
        var actualCell = reuseEnabled
          ? '<td class="reuse-cell actual">' +
              '<button type="button" class="reuse-status ' + reuseStatus.className + '" data-temp-reuse-panel="' + file.id + '" data-index="' + idx + '">' +
                escapeHtml(reuseStatus.label) +
                reusePendingBadge +
              '</button>' +
            '</td>'
          : '<td class="actual">' +
              '<select class="status-select" data-temp-result="' + file.id + '" data-index="' + idx + '" data-status="' + item.actual + '">' +
                resultOptions +
              '</select>' +
            '</td>';
        var cells = [];
        visibleKeys.forEach(function(key) {
          if (key === 'select') {
            cells.push('<td class="check"><input type="checkbox" data-temp-select="' + file.id + '" data-index="' + idx + '" ' + (selection.has(idx) ? 'checked' : '') + '></td>');
          } else if (key === 'index') {
            cells.push('<td class="index">' + (idx + 1) + '</td>');
          } else if (key === 'module') {
            cells.push('<td class="module">' + moduleHtml + '</td>');
          } else if (key === 'title') {
            cells.push(
              '<td class="title"><div class="temp-inline-edit" contenteditable="true" data-temp-edit-field="title" data-temp-edit-file="' + file.id + '" data-temp-edit-index="' + idx + '" data-temp-edit-multiline="false" data-placeholder="' + editPlaceholder + '">' + titleHtml + '</div></td>'
            );
          } else if (key === 'priority') {
            cells.push(
              '<td><div class="temp-inline-edit" contenteditable="true" data-temp-edit-field="priority" data-temp-edit-file="' + file.id + '" data-temp-edit-index="' + idx + '" data-temp-edit-multiline="false" data-placeholder="' + editPlaceholder + '">' + priorityHtml + '</div></td>'
            );
          } else if (key === 'preconditions') {
            cells.push(
              '<td><div class="temp-inline-edit" contenteditable="true" data-temp-edit-field="preconditions" data-temp-edit-file="' + file.id + '" data-temp-edit-index="' + idx + '" data-temp-edit-multiline="true" data-placeholder="' + editPlaceholder + '">' + preHtml + '</div></td>'
            );
          } else if (key === 'steps') {
            cells.push(
              '<td><div class="temp-inline-edit" contenteditable="true" data-temp-edit-field="steps" data-temp-edit-file="' + file.id + '" data-temp-edit-index="' + idx + '" data-temp-edit-multiline="true" data-placeholder="' + editPlaceholder + '">' + stepsHtml + '</div></td>'
            );
          } else if (key === 'expected') {
            cells.push(
              '<td><div class="temp-inline-edit" contenteditable="true" data-temp-edit-field="expected" data-temp-edit-file="' + file.id + '" data-temp-edit-index="' + idx + '" data-temp-edit-multiline="true" data-placeholder="' + editPlaceholder + '">' + expectedHtml + '</div></td>'
            );
          } else if (key === 'actual') {
            cells.push(actualCell);
          } else if (key === 'remark') {
            cells.push('<td><button type="button" class="' + remarkBtnClass.join(' ') + '" data-temp-remark-toggle="' + file.id + '" data-index="' + idx + '">' + (hasRemark ? '备注已填' : '备注') + '</button></td>');
          } else if (key === 'defect') {
            cells.push('<td><button type="button" class="' + defectBtnClass.join(' ') + '" data-temp-defect-toggle="' + file.id + '" data-index="' + idx + '">' + (hasDefects ? '链接已填' : '缺陷链接') + '</button></td>');
          } else if (key === 'ops') {
            cells.push(
              '<td class="case-op-col">' +
                '<div class="case-ops">' +
                  '<button type="button" class="case-op remove" title="删除当前用例" data-temp-case-remove="' + file.id + '" data-index="' + idx + '">−</button>' +
                  '<button type="button" class="case-op add" title="在下方插入空用例" data-temp-case-insert="' + file.id + '" data-index="' + idx + '">＋</button>' +
                '</div>' +
              '</td>'
            );
          }
        });
        var reuseActions = reuseEnabled
          ? (
            '<div class="reuse-actions">' +
              '<button type="button" class="reuse-add" data-temp-reuse-add="' + file.id + '" data-index="' + idx + '">＋ 添加测试项</button>' +
              '<button type="button" class="reuse-sync" data-temp-reuse-sync="' + file.id + '" data-index="' + idx + '">同步结果</button>' +
            '</div>'
          )
          : '';
        var placeholderHeight = 0;
        if (!reuseOpen && state.tempExecReusePlaceholders && state.tempExecReusePlaceholders[file.id]) {
          var placeholderRaw = state.tempExecReusePlaceholders[file.id][String(idx)];
          var parsedHeight = Number(placeholderRaw);
          if (Number.isFinite(parsedHeight) && parsedHeight > 0) placeholderHeight = Math.round(parsedHeight);
        }
        var reuseRow = reuseEnabled
          ? (
            reuseOpen
              ? '<tr class="reuse-row visible" data-temp-reuse-row="' + escapeHtml(file.id) + '" data-index="' + idx + '">' +
                  '<td colspan="' + colCount + '">' +
                    '<div class="reuse-panel" data-temp-reuse-panel-container="' + file.id + '" data-index="' + idx + '">' +
                      renderReuseEntries(file, item, idx) +
                      reuseActions +
                    '</div>' +
                  '</td>' +
                '</tr>'
              : (placeholderHeight
                ? '<tr class="reuse-row placeholder" data-temp-reuse-row="' + escapeHtml(file.id) + '" data-index="' + idx + '">' +
                    '<td colspan="' + colCount + '">' +
                      '<div class="reuse-placeholder" style="height:' + placeholderHeight + 'px;"></div>' +
                    '</td>' +
                  '</tr>'
                : '<tr class="reuse-row" data-temp-reuse-row="' + escapeHtml(file.id) + '" data-index="' + idx + '">' +
                    '<td colspan="' + colCount + '"></td>' +
                  '</tr>'
              )
          )
          : '';
        var rowClass = 'case-row' + (isTempExecNewAdded(file.id, item) ? ' new-added' : '');
        return (
          '<tr class="' + rowClass + '" data-temp-case-row="' + file.id + '" data-index="' + idx + '">' +
            cells.join('') +
          '</tr>' +
          reuseRow +
          '<tr class="remark-row ' + (remarkOpen ? 'visible' : '') + '">' +
            '<td colspan="' + colCount + '">' +
              '<textarea class="remark-panel" data-temp-remark="' + file.id + '" data-index="' + idx + '" placeholder="填写执行说明...">' + escapeHtmlPreserve(item.remark) + '</textarea>' +
            '</td>' +
          '</tr>' +
          '<tr class="defect-row ' + (defectOpen ? 'visible' : '') + '">' +
            '<td colspan="' + colCount + '">' +
              '<div class="defect-panel" data-temp-defect-panel="' + file.id + '" data-index="' + idx + '">' +
                renderDefectLinks(item, file.id, idx) +
                '<button type="button" class="defect-add" data-temp-defect-add="' + file.id + '" data-index="' + idx + '">＋ 添加链接</button>' +
              '</div>' +
            '</td>' +
          '</tr>'
        );
      }).join('');
      var allVisibleSelected = visibleIndexes.length && visibleIndexes.every(function(idx) { return selection.has(idx); });
      var headerCheckbox = show('select')
        ? '<th class="check"><input type="checkbox" data-temp-select-all="' + file.id + '" data-temp-visible="' + visibleIndexes.join(',') + '" ' + (visibleIndexes.length ? (allVisibleSelected ? 'checked' : '') : 'disabled') + '></th>'
        : '';
      var emptyRow = visibleIndexes.length
        ? ''
        : '<tr><td colspan="' + colCount + '">' + (file.cases.length ? '当前页暂无用例' : '未解析到有效用例') + '</td></tr>';
      var summary = buildTempExecSummary(file);
      var reuseToggle = (
        '<div class="temp-reuse-toggle">' +
          '<label>' +
            '<input type="checkbox" data-temp-reuse-toggle="' + file.id + '" ' + (reuseEnabled ? 'checked' : '') + '>' +
            '<span>用例复用</span>' +
          '</label>' +
          '<span class="hint">' + (reuseEnabled ? '可为单条用例补充多条执行记录' : '开启后可为用例记录多条执行项') + '</span>' +
        '</div>'
      );
      var presetPanel = reuseEnabled ? renderReusePresetPanel(file) : '';
      var paginationBlock = buildTempExecPagination(file, totalCases, pageIndex, totalPages, start, end);
      var headerCells = [];
      if (headerCheckbox) headerCells.push(headerCheckbox);
      if (show('index')) headerCells.push('<th class="index">编号</th>');
      if (show('module')) headerCells.push('<th class="module">模块</th>');
      headerCells.push('<th class="title">用例标题</th>');
      if (show('priority')) headerCells.push('<th>优先级</th>');
      if (show('preconditions')) headerCells.push('<th>前提条件</th>');
      if (show('steps')) headerCells.push('<th>操作步骤</th>');
      if (show('expected')) headerCells.push('<th>预期结果</th>');
      headerCells.push('<th class="actual">实际结果</th>');
      headerCells.push('<th>备注</th>');
      headerCells.push('<th>缺陷链接</th>');
      if (show('ops')) headerCells.push('<th class="ops" title="增删">增删</th>');
      return (
        reuseToggle +
        presetPanel +
        paginationBlock +
        '<table data-resizable-id="temp-exec-' + escapeHtml(file.id) + '" data-resizable-label="执行视图 - ' + escapeHtml(file.name || '测试用例') + '">' +
          colgroup +
          '<thead>' +
            '<tr>' + headerCells.join('') + '</tr>' +
          '</thead>' +
          '<tbody>' + (rows || emptyRow) + '</tbody>' +
        '</table>' +
        paginationBlock
      );
    }

    function toggleTempExecReusePanel(fileId, indexes) {
      if (!fileId) return;
      var file = getTempExecFile(fileId);
      if (!file) return;
      var openSet = ensureTempExecReuseOpen(fileId);
      var list = Array.isArray(indexes) ? indexes : [indexes];
      var valid = list
        .map(function(idx) { return Number(idx); })
        .filter(function(idx) { return Number.isInteger(idx); });
      if (!valid.length) return;
      var shouldOpen = !valid.every(function(idx) { return openSet.has(idx); });
      valid.forEach(function(idx) {
        if (shouldOpen) openSet.add(idx);
        else openSet.delete(idx);
      });
      renderTempExecView();
    }

    function addTempExecReuseEntry(fileId, index) {
      var file = getTempExecFile(fileId);
      if (!file || !file.reuseEnabled) return;
      if (!file.cases[index]) return;
      var targetCase = file.cases[index];
      if (!Array.isArray(targetCase.reuseDetails)) targetCase.reuseDetails = [];
      targetCase.reuseDetails.push({ id: generateReuseDetailId(), text: '', note: '', status: '未执行', removed: false });
      // 复用模式下同时维护 exec_case.status，方便总览统计与清除“变更重跑”系统态。
      targetCase.actual = resolveReuseAggregateStatus(targetCase.reuseDetails);
      if (isDbMode()) {
        queueExecCasePatchForItem(targetCase, { reuse_details: targetCase.reuseDetails, status: targetCase.actual });
      }
      persistTempExecState();
      renderTempExecView();
    }

    function removeTempExecReuseEntry(fileId, index, detailId) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var targetCase = file.cases[index];
      if (!Array.isArray(targetCase.reuseDetails)) return;
      openConfirmDrawer({
        title: '删除复用测试项',
        message: '确定删除该复用测试项吗？该操作不可撤销。',
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
      }).then(function(result) {
        if (!result || result.ok !== true) return;
        var nextFile = getTempExecFile(fileId);
        if (!nextFile || !nextFile.cases[index]) return;
        var nextCase = nextFile.cases[index];
        if (!Array.isArray(nextCase.reuseDetails)) return;
        var details = nextCase.reuseDetails;
        var updated = false;
        for (var i = 0; i < details.length; i += 1) {
          var detail = details[i];
          if (!detail || detail.id !== detailId) continue;
          if (detail.presetId) {
            if (!detail.removed) {
              detail.removed = true;
              detail.status = '未执行';
              detail.note = '';
              updated = true;
            }
          } else {
            details.splice(i, 1);
            updated = true;
          }
          break;
        }
        if (!updated) return;
        nextCase.reuseDetails = details;
        nextCase.actual = resolveReuseAggregateStatus(nextCase.reuseDetails);
        if (isDbMode()) {
          queueExecCasePatchForItem(nextCase, { reuse_details: nextCase.reuseDetails, status: nextCase.actual });
        }
        persistTempExecState();
        renderTempExecView();
      });
    }

    function updateTempExecReuseStatus(fileId, index, detailId, value) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var targetCase = file.cases[index];
      if (!Array.isArray(targetCase.reuseDetails)) targetCase.reuseDetails = [];
      var entry = targetCase.reuseDetails.find(function(item) { return item.id === detailId; });
      if (!entry) return;
      if (isReuseDetailRemoved(entry)) return;
      var nextStatus = tempExecResultOptions.indexOf(value) !== -1 ? value : '未执行';
      entry.status = nextStatus;
      targetCase.actual = resolveReuseAggregateStatus(targetCase.reuseDetails);
      if (isDbMode()) {
        queueExecCasePatchForItem(targetCase, { reuse_details: targetCase.reuseDetails, status: targetCase.actual });
      }
      persistTempExecState();
      updateTempExecReuseStatusUi(fileId, index, detailId, nextStatus);
    }

    // 仅刷新复用子项结果的局部 UI，避免整页重绘导致抖动。
    function updateTempExecReuseStatusUi(fileId, index, detailId, status) {
      if (!tempExecView || !tempExecView.querySelectorAll) return;
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var targetCase = file.cases[index];
      var normalized = normalizeReuseDetailStatus(status);
      var statusClass = mapStatusToClass(normalized);
      var selectEl = null;
      var selects = tempExecView.querySelectorAll('select[data-temp-reuse-status]');
      for (var i = 0; i < selects.length; i += 1) {
        var node = selects[i];
        if (!node || !node.dataset) continue;
        if (String(node.dataset.tempReuseStatus || '') !== String(fileId)) continue;
        if (String(node.dataset.index || '') !== String(index)) continue;
        if (String(node.dataset.detail || '') !== String(detailId)) continue;
        selectEl = node;
        break;
      }
      if (selectEl) {
        if (selectEl.value !== normalized) selectEl.value = normalized;
        if (selectEl.classList) {
          selectEl.classList.remove('passed', 'failed', 'blocked', 'unspecified', 'pending', 'changed');
          if (statusClass) selectEl.classList.add(statusClass);
        } else if (selectEl.className !== undefined) {
          var cls = String(selectEl.className || '').split(/\s+/).filter(Boolean);
          cls = cls.filter(function(name) {
            return ['passed', 'failed', 'blocked', 'unspecified', 'pending', 'changed'].indexOf(name) === -1;
          });
          if (statusClass) cls.push(statusClass);
          selectEl.className = cls.join(' ');
        }
      }
      var buttonEl = null;
      var buttons = tempExecView.querySelectorAll('button[data-temp-reuse-panel]');
      for (var j = 0; j < buttons.length; j += 1) {
        var btn = buttons[j];
        if (!btn || !btn.dataset) continue;
        if (String(btn.dataset.tempReusePanel || '') !== String(fileId)) continue;
        if (String(btn.dataset.index || '') !== String(index)) continue;
        buttonEl = btn;
        break;
      }
      if (buttonEl) {
        var display = getCaseExecutionDisplay(file, targetCase);
        if (buttonEl.classList) {
          buttonEl.classList.remove('passed', 'failed', 'blocked', 'unspecified', 'pending', 'changed');
          if (display && display.className) buttonEl.classList.add(display.className);
        } else if (buttonEl.className !== undefined) {
          var btnCls = String(buttonEl.className || '').split(/\s+/).filter(Boolean);
          btnCls = btnCls.filter(function(name) {
            return ['passed', 'failed', 'blocked', 'unspecified', 'pending', 'changed'].indexOf(name) === -1;
          });
          if (display && display.className) btnCls.push(display.className);
          buttonEl.className = btnCls.join(' ');
        }
        while (buttonEl.firstChild) buttonEl.removeChild(buttonEl.firstChild);
        var label = display && display.label ? display.label : '未执行';
        buttonEl.appendChild(document.createTextNode(label));
        var openSet = ensureTempExecReuseOpen(fileId);
        var showPending = Boolean(file.reuseEnabled) && !openSet.has(index);
        if (showPending) {
          var summary = aggregateReuseDetails(targetCase.reuseDetails);
          var pendingCount = summary && summary.pending ? summary.pending : 0;
          if (pendingCount > 0) {
            var badge = document.createElement('span');
            badge.className = 'reuse-pending-badge';
            badge.setAttribute('data-reuse-pending', String(pendingCount));
            badge.textContent = String(pendingCount);
            buttonEl.appendChild(badge);
          }
        }
      }
      renderTempExecToolbar(file);
      renderTempExecOverview();
      updateTempExecFileStateClass(fileId);
    }

    function normalizeReuseDetailStatus(value) {
      var text = value === null || value === undefined ? '' : String(value);
      text = text.trim();
      if (!text || text === 'pending') return '未执行';
      return text;
    }

    function syncTempExecReuseStatusFromFirst(fileId, index, anchorEl) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var targetCase = file.cases[index];
      if (!Array.isArray(targetCase.reuseDetails) || !targetCase.reuseDetails.length) {
        var anchorRect = captureTempExecAnchorRect(anchorEl);
        if (anchorRect) {
          showTempExecBlockHint(anchorRect, '暂无可同步的复用子项');
        }
        if (tempExecStatus) setStatus(tempExecStatus, '暂无可同步的复用子项', 'warn');
        return;
      }
      var details = targetCase.reuseDetails;
      var visibleDetails = details.filter(function(detail) { return detail && !isReuseDetailRemoved(detail); });
      if (!visibleDetails.length) {
        var anchorRect2 = captureTempExecAnchorRect(anchorEl);
        if (anchorRect2) {
          showTempExecBlockHint(anchorRect2, '暂无可同步的复用子项');
        }
        if (tempExecStatus) setStatus(tempExecStatus, '暂无可同步的复用子项', 'warn');
        return;
      }
      var first = visibleDetails[0];
      var firstStatus = normalizeReuseDetailStatus(first.status);
      var blockedStatuses = {
        '失败': true,
        '通过': true,
        '阻塞': true,
        '不适用': true,
      };
      for (var i = 1; i < visibleDetails.length; i += 1) {
        var other = visibleDetails[i];
        var otherStatus = normalizeReuseDetailStatus(other.status);
        if (otherStatus !== firstStatus && blockedStatuses[otherStatus]) {
          var anchorRect3 = captureTempExecAnchorRect(anchorEl);
          if (anchorRect3) {
            showTempExecBlockHint(anchorRect3, '其他子项已有执行结果，无法直接同步');
          }
          if (tempExecStatus) setStatus(tempExecStatus, '其他子项已有执行结果，无法直接同步', 'warn');
          return;
        }
      }
      var changed = false;
      if (first.status !== firstStatus) {
        first.status = firstStatus;
        changed = true;
      }
      for (var i = 1; i < visibleDetails.length; i += 1) {
        var detail = visibleDetails[i];
        if (detail.status !== firstStatus) {
          detail.status = firstStatus;
          changed = true;
        }
      }
      if (!changed) {
        if (tempExecStatus) setStatus(tempExecStatus, '子项结果已一致', 'ok');
        return;
      }
      targetCase.actual = resolveReuseAggregateStatus(details);
      if (isDbMode()) {
        queueExecCasePatchForItem(targetCase, { reuse_details: targetCase.reuseDetails, status: targetCase.actual });
      }
      persistTempExecState();
      renderTempExecView();
      if (tempExecStatus) setStatus(tempExecStatus, '已同步结果', 'ok');
    }

    function updateTempExecReuseText(fileId, index, detailId, text) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var targetCase = file.cases[index];
      if (!Array.isArray(targetCase.reuseDetails)) targetCase.reuseDetails = [];
      var entry = targetCase.reuseDetails.find(function(item) { return item.id === detailId; });
      if (!entry) return;
      if (isReuseDetailRemoved(entry)) return;
      entry.text = text || '';
      if (isDbMode()) {
        queueExecCasePatchForItem(targetCase, { reuse_details: targetCase.reuseDetails });
      }
      persistTempExecState();
    }

    function updateTempExecReuseNote(fileId, index, detailId, text) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var targetCase = file.cases[index];
      if (!Array.isArray(targetCase.reuseDetails)) targetCase.reuseDetails = [];
      var entry = targetCase.reuseDetails.find(function(item) { return item.id === detailId; });
      if (!entry) return;
      if (isReuseDetailRemoved(entry)) return;
      entry.note = text || '';
      if (isDbMode()) {
        queueExecCasePatchForItem(targetCase, { reuse_details: targetCase.reuseDetails });
      }
      persistTempExecState();
    }

    function handleTempExecReuseToggle(fileId, enabled, checkboxEl) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      if (enabled === Boolean(file.reuseEnabled)) return;
      function applyReuseToggle(nextEnabled) {
        if (nextEnabled) {
          file.reuseEnabled = true;
          ensureReusePresets(file);
        } else {
          file.reuseEnabled = false;
          file.cases.forEach(function(item) {
            item.reuseDetails = [];
          });
          file.reusePresets = [];
          if (state.tempExecPresetDraft && state.tempExecPresetDraft.fileId === fileId) {
            state.tempExecPresetDraft = null;
          }
          resetTempExecReuseOpen(fileId);
        }
        if (isDbMode()) {
          var execSetId = file.execSetId || Number(file.id);
          if (execSetId) {
            queueExecSetPatch(execSetId, { reuse_enabled: Boolean(file.reuseEnabled), reuse_presets: file.reusePresets || [] });
          }
          if (nextEnabled) {
            file.cases.forEach(function(item) {
              if (!item) return;
              queueExecCasePatchForItem(item, { status: '未执行', remark: '' });
            });
          } else {
            file.cases.forEach(function(item) {
              if (!item) return;
              queueExecCasePatchForItem(item, { reuse_details: [], status: normalizeExecStatus(item.actual) });
            });
          }
        }
        persistTempExecState();
        renderTempExecView();
      }

      if (enabled) {
        var hasExecution = file.cases.some(function(item) {
          var status = getCaseExecutionStatus(file, item);
          return (status && status !== '未执行') || (item.remark && item.remark.trim());
        });
        if (hasExecution) {
          var confirmMsg = '开启“用例复用”会清空当前执行结果与备注，是否继续？';
          openConfirmDrawer({
            title: '开启用例复用',
            message: confirmMsg,
            danger: true,
          }).then(function(res) {
            if (!res || res.ok !== true) {
              if (checkboxEl) checkboxEl.checked = false;
              return;
            }
            file.cases.forEach(function(item) {
              item.actual = '未执行';
              item.remark = '';
            });
            applyReuseToggle(true);
          });
          return;
        }
        applyReuseToggle(true);
        return;
      }

      var hasReuse = file.cases.some(function(item) {
        var details = Array.isArray(item.reuseDetails) ? item.reuseDetails : [];
        return details.some(function(detail) { return detail && !isReuseDetailRemoved(detail); });
      });
      if (hasReuse) {
        var confirmClose = '关闭“用例复用”会删除所有复用测试项与预设子项，是否继续？';
        openConfirmDrawer({
          title: '关闭用例复用',
          message: confirmClose,
          danger: true,
        }).then(function(res2) {
          if (!res2 || res2.ok !== true) {
            if (checkboxEl) checkboxEl.checked = true;
            return;
          }
          applyReuseToggle(false);
        });
        return;
      }
      applyReuseToggle(false);
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('app-settings-loaded', function() {
        renderTempExecView();
      });
      window.addEventListener('app-settings-updated', function(e) {
        var detail = e && e.detail ? e.detail : null;
        var keys = detail && Array.isArray(detail.keys) ? detail.keys : [];
        var touchedAi = keys.indexOf('missingCaseReminderAiEnabled') !== -1;
        if (touchedAi) {
          var reminder = ensureTempExecMissingReminderState();
          if (resolveMissingReminderAiEnabled() !== 'on') {
            clearTempExecMissingReminderAi(reminder);
          }
        }
        if (!keys.length
          || keys.indexOf('missingCaseReminderPlacement') !== -1
          || keys.indexOf('missingCaseReminderMatchConfig') !== -1
          || touchedAi) {
          renderTempExecView();
        }
      });
    }

    return {
      normalizeTempExecCases: normalizeTempExecCases,
      normalizeTempExecPlacement: normalizeTempExecPlacement,
      serializeSingleTempExecFile: serializeSingleTempExecFile,
      serializeTempExecFiles: serializeTempExecFiles,
      serializeTempExecVersions: serializeTempExecVersions,
      serializeTempExecSnapshot: serializeTempExecSnapshot,
      exportTempExecSnapshot: exportTempExecSnapshot,
      importTempExecSnapshot: importTempExecSnapshot,
      applyTempExecSnapshot: applyTempExecSnapshot,
      createTempExecFile: createTempExecFile,
      exportTempExecToXmind: exportTempExecToXmind,
      exportTempExecCasesToXmind: exportTempExecCasesToXmind,
      loadTempExecState: loadTempExecState,
      importTempExecFiles: importTempExecFiles,
      importTempExecFilesToDb: importTempExecFilesToDb,
      ensureTempExecPlacement: ensureTempExecPlacement,
      ensureRequirementOrder: ensureRequirementOrder,
      ensureFileOrder: ensureFileOrder,
      ensureVersionOrder: ensureVersionOrder,
      reorderRequirementOrder: reorderRequirementOrder,
      updateVersionOrder: updateVersionOrder,
      removeFileFromOrder: removeFileFromOrder,
      insertFileIntoOrder: insertFileIntoOrder,
      syncTempExecPlacement: syncTempExecPlacement,
      moveTempExecFileToRequirement: moveTempExecFileToRequirement,
      clampTempExecPageSize: clampTempExecPageSize,
      loadTempExecPageSizeSetting: loadTempExecPageSizeSetting,
      saveTempExecPageSizeSetting: saveTempExecPageSizeSetting,
      ensureTempExecPageIndex: ensureTempExecPageIndex,
      getTempExecPageSize: getTempExecPageSize,
      resetTempExecPages: resetTempExecPages,
      setTempExecPage: setTempExecPage,
      changeTempExecPage: changeTempExecPage,
      applyTempExecPageSize: applyTempExecPageSize,
      ensureTempVersionList: ensureTempVersionList,
      getTempVersion: getTempVersion,
      applyVersionAssignments: applyVersionAssignments,
      isVersionNameDuplicate: isVersionNameDuplicate,
      createTempVersion: createTempVersion,
      removeTempExecFromVersion: removeTempExecFromVersion,
      removeTempGroupFromVersion: removeTempGroupFromVersion,
      moveTempExecToVersion: moveTempExecToVersion,
      moveTempExecFileWithinVersion: moveTempExecFileWithinVersion,
      getVersionRequirementBlocks: getVersionRequirementBlocks,
      parseReqPayload: parseReqPayload,
      reorderVersionRequirement: reorderVersionRequirement,
      moveRequirementToVersion: moveRequirementToVersion,
      moveRequirementOutOfVersion: moveRequirementOutOfVersion,
      removeTempVersion: removeTempVersion,
      reorderTempVersion: reorderTempVersion,
      renameTempVersion: renameTempVersion,
      getTempVersionName: getTempVersionName,
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
      openTempExecDefectLink: openTempExecDefectLink,
      toggleTempExecDefectPanel: toggleTempExecDefectPanel,
      applyTempExecSearch: applyTempExecSearch,
      setTempExecStatusFilter: setTempExecStatusFilter,
      getTempExecFile: getTempExecFile,
      getTempExecOrderedFileIds: getTempExecOrderedFileIds,
      getTempExecFilesByRequirement: getTempExecFilesByRequirement,
      setTempExecActive: setTempExecActive,
      updateTempExecResult: updateTempExecResult,
      updateTempExecRemark: updateTempExecRemark,
      pushTempExecUndo: pushTempExecUndo,
      clearTempExecUndo: clearTempExecUndo,
      restoreTempExecUndo: restoreTempExecUndo,
      cleanupTempExecUndoUI: cleanupTempExecUndoUI,
      startTempExecUndoTimer: startTempExecUndoTimer,
      showTempExecBlockHint: showTempExecBlockHint,
      insertTempExecCase: insertTempExecCase,
      removeTempExecCase: removeTempExecCase,
      updateTempExecCaseField: updateTempExecCaseField,
      toggleTempExecSelection: toggleTempExecSelection,
      toggleTempExecSelectAll: toggleTempExecSelectAll,
      removeTempExecFile: removeTempExecFile,
      reorderTempRequirement: reorderTempRequirement,
      persistTempExecState: persistTempExecState,
      renderTempExecNav: renderTempExecNav,
      renderTempExecView: renderTempExecView,
      triggerTempExecMissingReminderAiRecommend: triggerTempExecMissingReminderAiRecommend,
      renderTempVersionGrid: renderTempVersionGrid,
      renderTempExecTable: renderTempExecTable,
      renderTempExecOverview: renderTempExecOverview,
      syncTempExecReuseStatusAlign: syncTempExecReuseStatusAlign,
      renderTempFocusZone: renderTempFocusZone,
      toggleTempExecRequirementZone: toggleTempExecRequirementZone,
      toggleTempExecVersionZone: toggleTempExecVersionZone,
      setTempExecImportProjectFilter: setTempExecImportProjectFilter,
      isTempExecProjectLayoutEnabled: isTempExecProjectLayoutEnabled,
      reorderTempExecProject: reorderTempExecProject,
      reorderTempExecProjectVersion: reorderTempExecProjectVersion,
      reorderTempExecFileInProjectVersion: reorderTempExecFileInProjectVersion,
      removeTempExecProject: removeTempExecProject,
      removeTempExecProjectVersion: removeTempExecProjectVersion,
      dissolveTempExecArchivedProjectVersion: dissolveTempExecArchivedProjectVersion,
      scrollTempExecViewTop: scrollTempExecViewTop,
      ensureReusePresets: ensureReusePresets,
      startTempExecPresetDraft: startTempExecPresetDraft,
      cancelTempExecPresetDraft: cancelTempExecPresetDraft,
      updateTempExecPresetDraft: updateTempExecPresetDraft,
      confirmTempExecPresetDraft: confirmTempExecPresetDraft,
      renameTempExecPreset: renameTempExecPreset,
      removeTempExecPreset: removeTempExecPreset,
      toggleTempExecReusePanel: toggleTempExecReusePanel,
      addTempExecReuseEntry: addTempExecReuseEntry,
      removeTempExecReuseEntry: removeTempExecReuseEntry,
      syncTempExecReuseStatusFromFirst: syncTempExecReuseStatusFromFirst,
      updateTempExecReuseStatus: updateTempExecReuseStatus,
      updateTempExecReuseText: updateTempExecReuseText,
      updateTempExecReuseNote: updateTempExecReuseNote,
      handleTempExecReuseToggle: handleTempExecReuseToggle,
      getCaseExecutionDisplay: getCaseExecutionDisplay,
      loadTempExecFocus: loadTempExecFocus,
      saveTempExecFocus: saveTempExecFocus,
      syncTempExecFocus: syncTempExecFocus,
      addTempExecFocus: addTempExecFocus,
      insertTempExecFocus: insertTempExecFocus,
      removeTempExecFocus: removeTempExecFocus,
      prioritizeTempExecUnassignedRequirements: prioritizeTempExecUnassignedRequirements,
      openTempExecCaseLibraryDiffDrawer: openTempExecCaseLibraryDiffDrawer,
      tryAutoOpenTempExecCaseLibraryDiff: tryAutoOpenTempExecCaseLibraryDiff,
      jumpToTempExecCase: jumpToTempExecCase,
    };
  }

  window.app = window.app || {};
  window.app.tempexecCore = { init: init };
})();
