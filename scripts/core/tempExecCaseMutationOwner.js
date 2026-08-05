(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecCaseMutationOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function(root) {
  function noop() {}

  function normalizeTempExecModuleName(value) {
    if (value === null || value === undefined) return '';
    return String(value || '').trim().toLowerCase();
  }

  function resolveTempExecAppendIndex(list, moduleName) {
    var items = Array.isArray(list) ? list : [];
    if (!moduleName) return items.length;
    var key = normalizeTempExecModuleName(moduleName);
    if (!key) return items.length;
    var lastIndex = -1;
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      var mod = normalizeTempExecModuleName(item && item.module ? item.module : '');
      if (mod && mod === key) lastIndex = i;
    }
    return lastIndex >= 0 ? lastIndex + 1 : items.length;
  }

  function resolveTempExecCaseFieldChange(field, value) {
    var allowed = ['title', 'priority', 'preconditions', 'steps', 'expected'];
    if (allowed.indexOf(field) === -1) return null;
    var text = typeof value === 'string' ? value : '';
    var nextValue = field === 'priority' ? text.trim().toUpperCase() : text;
    var patch = {};
    if (field === 'title') patch.title = nextValue;
    if (field === 'priority') patch.priority = nextValue;
    if (field === 'preconditions') patch.precondition = nextValue;
    if (field === 'steps') patch.steps = nextValue;
    if (field === 'expected') patch.expected = nextValue;
    return { field: field, value: nextValue, patch: patch };
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var state = opts.state || {};
    var browser = opts.window || root || {};
    var documentRef = opts.document || (root && root.document ? root.document : null);
    var tempExecStatus = opts.tempExecStatus || null;
    var stringifyCaseField = port('stringifyCaseField', function(value) {
      return value === null || value === undefined ? '' : String(value);
    });
    var generateTempExecId = port('generateTempExecId', function() {
      return 'tempexec-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
    });
    var getTempExecFile = port('getTempExecFile', function() { return null; });
    var ensureTempExecSelection = port('ensureTempExecSelection', function() { return new Set(); });
    var isDbMode = port('isDbMode', function() { return false; });
    var queueExecCasePatchForItem = port('queueExecCasePatchForItem');
    var clearPendingExecCasePatch = port('clearPendingExecCasePatch');
    var commitTempExecUndoToDb = port('commitTempExecUndoToDb');
    var persistTempExecState = port('persistTempExecState');
    var renderTempExecView = port('renderTempExecView');
    var renderTempExecNav = port('renderTempExecNav');
    var renderTempVersionGrid = port('renderTempVersionGrid');
    var clearTempExecCaseStates = port('clearTempExecCaseStates');
    var getTempExecCaseUiKeys = port('getTempExecCaseUiKeys', function() { return []; });
    var ensureTempExecNewAddedUiKey = port('ensureTempExecNewAddedUiKey');
    var markTempExecNewAdded = port('markTempExecNewAdded');
    var unmarkTempExecNewAdded = port('unmarkTempExecNewAdded');
    var isTempExecNewAdded = port('isTempExecNewAdded', function() { return false; });
    var buildReuseDetailsFromPresets = port('buildReuseDetailsFromPresets', function() { return []; });
    var resolveReuseAggregateStatus = port('resolveReuseAggregateStatus', function() { return '未执行'; });
    var openConfirmDrawer = port('openConfirmDrawer', function() { return Promise.resolve({ ok: true }); });
    var setStatus = port('setStatus');
    var tempExecUndoTimer = null;
    var tempExecUndoInterval = null;
    var tempExecUndoEl = null;
    var tempExecBlockHintEl = null;
    var tempExecBlockHintTimer = null;

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
          if (item) queueExecCasePatchForItem(item, { status: value });
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
      if (isDbMode()) queueExecCasePatchForItem(file.cases[index], { remark: value });
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
        payload.cases.forEach(function(caseItem, idx) {
          file.cases.splice(insertAt + idx, 0, caseItem);
        });
        if (Array.isArray(payload.newAddedKeys) && payload.newAddedKeys.length) {
          payload.cases.forEach(function(caseItem) {
            var keys = getTempExecCaseUiKeys(caseItem);
            var hit = keys.some(function(key) { return payload.newAddedKeys.indexOf(key) !== -1; });
            if (hit) markTempExecNewAdded(file.id, caseItem);
          });
        }
        clearTempExecCaseStates(file.id);
        persistTempExecState();
        renderTempExecView();
        return true;
      }
      if (payload.type === 'insert' && typeof payload.index === 'number' && file.cases[payload.index]) {
        var removed = file.cases.splice(payload.index, 1);
        if (removed && removed[0]) unmarkTempExecNewAdded(file.id, removed[0]);
        if (payload.tempId) clearPendingExecCasePatch(payload.tempId);
        clearTempExecCaseStates(file.id);
        persistTempExecState();
        renderTempExecView();
        return true;
      }
      return false;
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

    function getOverlayGeometryCore() {
      if (opts.overlayGeometryCore) return opts.overlayGeometryCore;
      return browser && browser.app ? browser.app.overlayGeometryCore : null;
    }

    function positionTempExecBlockHint(hintEl, anchorRect) {
      if (!hintEl || !anchorRect || !documentRef) return;
      var hintRect = hintEl.getBoundingClientRect ? hintEl.getBoundingClientRect() : null;
      var core = getOverlayGeometryCore();
      if (!core || typeof core.computeAnchoredOverlayPosition !== 'function') return;
      var documentElement = documentRef.documentElement || {};
      var viewportWidth = browser.innerWidth || documentElement.clientWidth || 0;
      var viewportHeight = browser.innerHeight || documentElement.clientHeight || 0;
      var position = core.computeAnchoredOverlayPosition(anchorRect, {
        width: hintRect && hintRect.width ? hintRect.width : 260,
        height: hintRect && hintRect.height ? hintRect.height : 44,
      }, { width: viewportWidth, height: viewportHeight });
      if (!position) return;
      hintEl.style.left = position.left + 'px';
      hintEl.style.top = position.top + 'px';
    }

    function showTempExecBlockHint(anchorRect, message) {
      if (!anchorRect || !documentRef || !documentRef.body) return;
      cleanupTempExecBlockHint();
      var hint = documentRef.createElement('div');
      hint.className = 'temp-click-hint';
      var text = documentRef.createElement('span');
      text.textContent = message || '当前有待确认的增删操作，请先撤回或等待入库';
      hint.appendChild(text);
      documentRef.body.appendChild(hint);
      tempExecBlockHintEl = hint;
      positionTempExecBlockHint(hint, anchorRect);
      tempExecBlockHintTimer = setTimeout(function() {
        if (!tempExecBlockHintEl) return;
        try { tempExecBlockHintEl.classList.add('fade-out'); } catch (ignored) {}
        setTimeout(function() { cleanupTempExecBlockHint(); }, 220);
      }, 3000);
    }

    function captureTempExecAnchorRect(anchorEl) {
      var core = getOverlayGeometryCore();
      if (!core || typeof core.captureAnchorRect !== 'function') return null;
      return core.captureAnchorRect(anchorEl);
    }

    function startTempExecUndoTimer(message, optionsValue) {
      var timerOptions = optionsValue || {};
      var anchorRect = timerOptions.anchorRect || null;
      cleanupTempExecUndoUI();
      var baseMsg = message || '已应用变更';
      var remaining = 8;
      if (!documentRef || !documentRef.body) {
        if (tempExecStatus) setStatus(tempExecStatus, baseMsg, 'ok');
        return;
      }
      tempExecUndoEl = documentRef.createElement('div');
      tempExecUndoEl.className = 'temp-undo-toast';
      var text = documentRef.createElement('span');
      var btn = documentRef.createElement('button');
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
      documentRef.body.appendChild(tempExecUndoEl);
      renderCountdown();
      tempExecUndoInterval = setInterval(function() {
        remaining -= 1;
        if (remaining > 0) renderCountdown();
      }, 1000);
      tempExecUndoTimer = setTimeout(function() {
        commitTempExecUndoToDb();
        clearTempExecUndo();
        cleanupTempExecUndoUI();
      }, remaining * 1000);
      if (tempExecStatus) setStatus(tempExecStatus, baseMsg, 'ok');
    }

    function blockWhenMutationPending(anchorRect) {
      if (!tempExecUndoTimer) return false;
      var message = '当前有待确认的增删操作，请先撤回或等待入库';
      if (tempExecStatus) setStatus(tempExecStatus, message, 'warn');
      if (anchorRect) showTempExecBlockHint(anchorRect, message);
      return true;
    }

    function insertTempExecCase(fileId, index, anchorEl) {
      var file = getTempExecFile(fileId);
      if (!file || !Array.isArray(file.cases)) return;
      var anchorRect = captureTempExecAnchorRect(anchorEl);
      if (blockWhenMutationPending(anchorRect)) return;
      var base = file.cases[index] || {};
      var reuseDetails = buildReuseDetailsFromPresets(file);
      var fresh = {
        module: base.module || '',
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

    function appendTempExecAiCases(fileId, cases, anchorEl) {
      var file = getTempExecFile(fileId);
      if (!file || !Array.isArray(file.cases)) return { ok: false, reason: 'no-file' };
      var list = Array.isArray(cases) ? cases : [];
      if (!list.length) return { ok: false, reason: 'empty' };
      var anchorRect = captureTempExecAnchorRect(anchorEl);
      if (blockWhenMutationPending(anchorRect)) return { ok: false, reason: 'pending' };
      var count = 0;
      list.forEach(function(raw) {
        if (!raw || typeof raw !== 'object') return;
        var moduleName = stringifyCaseField(raw.module || '').trim();
        var title = stringifyCaseField(raw.title || '').trim();
        var priority = stringifyCaseField(raw.priority || '').trim();
        var preconditions = stringifyCaseField(raw.preconditions || raw.precondition || '').trim();
        var steps = stringifyCaseField(raw.steps || '').trim();
        var expected = stringifyCaseField(raw.expected || '').trim();
        var remark = stringifyCaseField(raw.remark || '').trim();
        if (!moduleName || !title || !expected) return;
        if (!priority) priority = 'P1';
        var reuseDetails = buildReuseDetailsFromPresets(file);
        var fresh = {
          module: moduleName,
          title: title,
          priority: priority,
          preconditions: preconditions,
          steps: steps,
          expected: expected,
          actual: file.reuseEnabled ? resolveReuseAggregateStatus(reuseDetails) : '未执行',
          remark: remark,
          reuseDetails: reuseDetails,
          defectLinks: [],
        };
        ensureTempExecNewAddedUiKey(fresh);
        if (isDbMode()) {
          fresh._tempId = generateTempExecId();
          fresh.pendingCreate = true;
        }
        var insertAt = resolveTempExecAppendIndex(file.cases, moduleName);
        file.cases.splice(insertAt, 0, fresh);
        markTempExecNewAdded(fileId, fresh);
        pushTempExecUndo({ type: 'insert', fileId: fileId, index: insertAt, tempId: fresh._tempId || '' });
        count += 1;
      });
      if (!count) return { ok: false, reason: 'empty' };
      clearTempExecCaseStates(fileId);
      persistTempExecState();
      renderTempExecView();
      if (tempExecStatus) {
        var message = '已追加用例 ' + count + ' 条';
        setStatus(tempExecStatus, message, 'ok');
        startTempExecUndoTimer(message, { anchorRect: anchorRect });
      }
      return { ok: true, count: count };
    }

    function removeTempExecCase(fileId, index, anchorEl) {
      var file = getTempExecFile(fileId);
      if (!file || !Array.isArray(file.cases) || !file.cases[index]) return;
      var anchorRect = captureTempExecAnchorRect(anchorEl);
      if (blockWhenMutationPending(anchorRect)) return;
      openConfirmDrawer({
        title: '删除用例',
        message: '确定删除该条用例吗？此操作不可撤销。',
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
      }).then(function(result) {
        if (!result || result.ok !== true || blockWhenMutationPending(anchorRect)) return;
        var targetFile = getTempExecFile(fileId);
        if (!targetFile || !Array.isArray(targetFile.cases) || !targetFile.cases[index]) return;
        var removed = targetFile.cases.splice(index, 1);
        var newAddedKeys = [];
        removed.forEach(function(item) {
          if (!isTempExecNewAdded(fileId, item)) return;
          getTempExecCaseUiKeys(item).forEach(function(key) {
            if (key && newAddedKeys.indexOf(key) === -1) newAddedKeys.push(key);
          });
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
      var change = resolveTempExecCaseFieldChange(field, value);
      if (!change) return;
      var item = file.cases[index];
      item[change.field] = change.value;
      if (isDbMode()) queueExecCasePatchForItem(item, change.patch);
      persistTempExecState();
    }

    function toggleTempExecSelection(fileId, index, checked) {
      if (!getTempExecFile(fileId)) return;
      var selection = ensureTempExecSelection(fileId);
      if (checked) selection.add(index);
      else selection.delete(index);
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

    return {
      updateTempExecResult: updateTempExecResult,
      updateTempExecRemark: updateTempExecRemark,
      pushTempExecUndo: pushTempExecUndo,
      clearTempExecUndo: clearTempExecUndo,
      restoreTempExecUndo: restoreTempExecUndo,
      cleanupTempExecUndoUI: cleanupTempExecUndoUI,
      startTempExecUndoTimer: startTempExecUndoTimer,
      showTempExecBlockHint: showTempExecBlockHint,
      captureTempExecAnchorRect: captureTempExecAnchorRect,
      insertTempExecCase: insertTempExecCase,
      appendTempExecAiCases: appendTempExecAiCases,
      removeTempExecCase: removeTempExecCase,
      updateTempExecCaseField: updateTempExecCaseField,
      toggleTempExecSelection: toggleTempExecSelection,
      toggleTempExecSelectAll: toggleTempExecSelectAll,
    };
  }

  return {
    create: create,
    normalizeTempExecModuleName: normalizeTempExecModuleName,
    resolveTempExecAppendIndex: resolveTempExecAppendIndex,
    resolveTempExecCaseFieldChange: resolveTempExecCaseFieldChange,
  };
});
