(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var model = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.editorPendingModel
    : null;
  var lifecycleFactory = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.pendingOperationLifecycle
    : null;
  if (typeof module !== 'undefined' && module.exports) {
    model = model || require('./caseLibraryEditorPendingModel.js');
    lifecycleFactory = lifecycleFactory || require('./caseLibraryPendingOperationLifecycle.js');
  }
  var api = factory(model, lifecycleFactory);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.editorPendingController = api;
  }
})(function(model, lifecycleFactory) {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    if (!model || !lifecycleFactory || typeof opts.getEditor !== 'function' || !opts.apiClient) {
      throw new Error('Case library editor pending controller dependencies are required');
    }
    var apiClient = opts.apiClient;
    var setTimeoutFn = opts.setTimeout || setTimeout;
    var now = typeof opts.now === 'function' ? opts.now : Date.now;
    var random = typeof opts.random === 'function' ? opts.random : Math.random;
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : noop;
    var renderEditor = typeof opts.renderEditor === 'function' ? opts.renderEditor : noop;
    var syncBatchDeleteControls = typeof opts.syncBatchDeleteControls === 'function'
      ? opts.syncBatchDeleteControls
      : noop;
    var syncBatchAddControls = typeof opts.syncBatchAddControls === 'function'
      ? opts.syncBatchAddControls
      : noop;
    var markNewAdded = typeof opts.markNewAdded === 'function' ? opts.markNewAdded : noop;
    var unmarkNewAdded = typeof opts.unmarkNewAdded === 'function' ? opts.unmarkNewAdded : noop;
    var ensureItemKey = typeof opts.ensureItemKey === 'function' ? opts.ensureItemKey : noop;
    var getItemUiKey = typeof opts.getItemUiKey === 'function' ? opts.getItemUiKey : function() { return ''; };
    var normalizeText = typeof opts.normalizeText === 'function'
      ? opts.normalizeText
      : function(value) { return value === null || value === undefined ? '' : String(value).trim(); };
    var buildInvisibleMarker = typeof opts.buildInvisibleMarker === 'function'
      ? opts.buildInvisibleMarker
      : function() { return ''; };
    var syncRowInput = typeof opts.syncRowInput === 'function' ? opts.syncRowInput : noop;
    var logOperation = typeof opts.logOperation === 'function' ? opts.logOperation : noop;
    var isEditing = typeof opts.isEditing === 'function' ? opts.isEditing : function() { return false; };
    var captureAnchorRect = typeof opts.captureAnchorRect === 'function'
      ? opts.captureAnchorRect
      : function() { return null; };
    var showBlockHint = typeof opts.showBlockHint === 'function' ? opts.showBlockHint : noop;
    var getPageSize = typeof opts.getPageSize === 'function' ? opts.getPageSize : function() { return 20; };
    var persistBatchAddCount = typeof opts.persistBatchAddCount === 'function'
      ? opts.persistBatchAddCount
      : noop;
    var scrollToIndex = typeof opts.scrollToIndex === 'function' ? opts.scrollToIndex : noop;
    var openConfirm = typeof opts.openConfirm === 'function'
      ? opts.openConfirm
      : function() { return Promise.resolve({ ok: false }); };
    var getPreviousDrawer = typeof opts.getPreviousDrawer === 'function'
      ? opts.getPreviousDrawer
      : function() { return null; };
    var getBatchAddInput = typeof opts.getBatchAddInput === 'function'
      ? opts.getBatchAddInput
      : function() { return null; };
    function getEditor() {
      return opts.getEditor();
    }

    function showStatus(message, type) {
      setStatus(message, type || '');
    }

    var lifecycle = lifecycleFactory.create({
      getState: getEditor,
      document: opts.document,
      clearTimeout: opts.clearTimeout,
      setInterval: opts.setInterval,
      clearInterval: opts.clearInterval,
      countdownSeconds: opts.countdownSeconds,
      onUndo: undo,
      onCommit: commit,
      onClear: function() {
        syncBatchDeleteControls();
        syncBatchAddControls();
      },
    });

    function cleanupToast() {
      return lifecycle.cleanup();
    }

    function clear() {
      return lifecycle.clear();
    }

    function resetTransientSelection(editor) {
      editor.selection = new Set();
      editor.remarkOpen = new Set();
    }

    function restoreRemoved(editor, removed) {
      model.sortedRestoreEntries(removed).forEach(function(entry) {
        var index = Math.max(0, Math.min(Number(entry.index), editor.items.length));
        editor.items.splice(index, 0, entry.item);
      });
    }

    function undo() {
      var editor = getEditor();
      var op = editor && editor.pendingOp ? editor.pendingOp : null;
      if (!editor || !op) return false;
      if (op.type === 'remove' && op.item) {
        var insertAt = Math.min(Math.max(op.index, 0), editor.items.length);
        editor.items.splice(insertAt, 0, op.item);
      } else if (op.type === 'remove_batch') {
        restoreRemoved(editor, op.removed);
      } else if (op.type === 'insert_batch') {
        model.insertedIndexesDescending(editor.items, op.itemKeys).forEach(function(index) {
          var removed = editor.items[index];
          if (removed) unmarkNewAdded(editor.caseFile ? editor.caseFile.id : null, removed);
          editor.items.splice(index, 1);
        });
      } else if (op.type === 'insert' && op.itemKey) {
        var index = editor.items.findIndex(function(item) {
          return item && item.__localId === op.itemKey;
        });
        if (index !== -1) editor.items.splice(index, 1);
      }
      resetTransientSelection(editor);
      clear();
      showStatus('已撤回增删操作（未入库）', 'ok');
      renderEditor();
      return true;
    }

    function start(message) {
      return lifecycle.start(message);
    }

    function renderAfterInsert(editor) {
      if (isEditing()) editor.pendingRender = true;
      else renderEditor();
    }

    function commitSingleRemove(editor, op) {
      return apiClient.deleteCaseItem(op.item.id).then(function() {
        showStatus('删除已入库', 'ok');
      }).catch(function(error) {
        showStatus(error && error.message ? error.message : '删除入库失败', 'err');
      }).finally(clear);
    }

    function commitBatchRemove(editor, file, op) {
      var entries = model.collectDeleteEntries(op.removed);
      if (!entries.length) {
        clear();
        showStatus('批量删除已撤回或无需入库', 'warn');
        renderEditor();
        return Promise.resolve();
      }
      var promises = entries.map(function(entry) {
        return model.settle(apiClient.deleteCaseItem(entry.id, { batch: true }));
      });
      return Promise.all(promises).then(function(results) {
        var failures = [];
        for (var i = 0; i < results.length; i += 1) {
          if (results[i] && results[i].status === 'rejected') failures.push(entries[i]);
        }
        var currentCount = editor.items.length;
        var successCount = entries.length - failures.length;
        var beforeCount = currentCount + entries.length;
        var afterCount = Math.max(beforeCount - successCount, 0);
        logOperation('batch_delete_case_items', 'case_item', null, {
          case_file_id: file.id,
          file_name: file.file_name_clean || '',
          count: entries.length,
          success: successCount,
          fail: failures.length,
          before_count: beforeCount,
          after_count: afterCount,
        }, failures.length ? 'partial' : 'success');
        if (!failures.length) {
          showStatus('批量删除已入库（' + entries.length + '条）', 'ok');
          return;
        }
        restoreRemoved(editor, failures);
        renderEditor();
        showStatus('批量删除部分失败：成功 ' + successCount + ' 条，失败 ' + failures.length + ' 条', 'warn');
      }).catch(function(error) {
        showStatus(error && error.message ? error.message : '批量删除入库失败', 'err');
      }).finally(clear);
    }

    function commitBatchInsert(editor, file, op) {
      var entries = model.collectInsertEntries(editor.items, op.itemKeys);
      entries.forEach(function(entry) {
        syncRowInput(entry.index, entry.item, { skipEmptyRequired: true });
      });
      if (!entries.length) {
        clear();
        showStatus('批量新增已撤回或不存在', 'warn');
        renderEditor();
        return Promise.resolve();
      }
      var promises = entries.map(function(entry, sequence) {
        var uiKey = getItemUiKey(entry.item);
        var payload = model.buildBatchItemPayload(entry.item, sequence, {
          normalizeText: normalizeText,
          buildInvisibleMarker: buildInvisibleMarker,
        });
        return model.settle(apiClient.createCaseItem(file.id, payload, { batch: true }).then(function(created) {
          if (!created) return created;
          ensureItemKey(created, '__uiKey', uiKey || '');
          editor.items[entry.index] = created;
          markNewAdded(file.id, created);
          return created;
        }));
      });
      return Promise.all(promises).then(function(results) {
        var failures = [];
        for (var i = 0; i < results.length; i += 1) {
          if (results[i] && results[i].status === 'rejected') failures.push(entries[i]);
        }
        var currentCount = editor.items.length;
        var successCount = entries.length - failures.length;
        var beforeCount = Math.max(currentCount - entries.length, 0);
        logOperation('batch_create_case_items', 'case_item', null, {
          case_file_id: file.id,
          file_name: file.file_name_clean || '',
          count: entries.length,
          success: successCount,
          fail: failures.length,
          before_count: beforeCount,
          after_count: beforeCount + successCount,
        }, failures.length ? 'partial' : 'success');
        if (!failures.length) {
          showStatus('批量新增已入库（' + entries.length + '条）', 'ok');
        } else {
          showStatus('批量新增部分失败：成功 ' + successCount + ' 条，失败 ' + failures.length + ' 条', 'warn');
        }
        renderAfterInsert(editor);
      }).catch(function(error) {
        showStatus(error && error.message ? error.message : '批量新增入库失败', 'err');
      }).finally(clear);
    }

    function commitSingleInsert(editor, file, op) {
      var index = editor.items.findIndex(function(item) {
        return item && item.__localId === op.itemKey;
      });
      if (index === -1) {
        clear();
        showStatus('新增用例已撤回或不存在', 'warn');
        return Promise.resolve();
      }
      var item = editor.items[index];
      syncRowInput(index, item, { skipEmptyRequired: true });
      var uiKey = getItemUiKey(item);
      var payload = model.buildItemPayload(item, normalizeText);
      var validationError = model.validatePayload(payload);
      if (validationError) {
        clear();
        showStatus('新增用例未入库：' + validationError, 'warn');
        return Promise.resolve();
      }
      return apiClient.createCaseItem(file.id, payload).then(function(created) {
        if (created) {
          ensureItemKey(created, '__uiKey', uiKey || '');
          editor.items[index] = created;
          markNewAdded(file.id, created);
        }
        showStatus('新增已入库', 'ok');
        renderAfterInsert(editor);
      }).catch(function(error) {
        showStatus(error && error.message ? error.message : '新增入库失败', 'err');
      }).finally(clear);
    }

    function commit() {
      var editor = getEditor();
      var op = editor && editor.pendingOp ? editor.pendingOp : null;
      if (!editor || !op) return Promise.resolve();
      var file = editor.caseFile;
      if (!file || !file.id) {
        clear();
        return Promise.resolve();
      }
      cleanupToast();
      showStatus('增删入库中...', '');
      if (op.type === 'remove' && op.item && op.item.id) return commitSingleRemove(editor, op);
      if (op.type === 'remove_batch') return commitBatchRemove(editor, file, op);
      if (op.type === 'insert_batch') return commitBatchInsert(editor, file, op);
      if (op.type === 'insert' && op.itemKey) return commitSingleInsert(editor, file, op);
      clear();
      showStatus('变更已应用', 'ok');
      return Promise.resolve();
    }

    function blockWhenPending(anchorEl) {
      var editor = getEditor();
      if (!editor || !editor.pendingOp) return false;
      var message = '当前有待确认的增删操作，请先撤回或等待入库';
      showStatus(message, 'warn');
      var anchorRect = captureAnchorRect(anchorEl);
      if (anchorRect) showBlockHint(anchorRect, message);
      return true;
    }

    function insertCaseItem(index, anchorEl) {
      var editor = getEditor();
      if (!editor || blockWhenPending(anchorEl)) return;
      var anchorRect = captureAnchorRect(anchorEl);
      var base = editor.items[index] || {};
      var localId = 'local-' + now().toString(16) + '-' + random().toString(16).slice(2, 6);
      var item = {
        __localId: localId,
        case_file_id: editor.caseFile ? editor.caseFile.id : null,
        module: String(base.module || '').trim() || '模块',
        title: '新用例-' + random().toString(16).slice(2, 6),
        priority: String(base.priority || '').trim() || 'P1',
        precondition: '',
        steps: '',
        expected: '待补充',
        remark: '',
      };
      ensureItemKey(item, '__uiKey', '');
      var insertAt = Math.min(Math.max(Number(index) + 1, 0), editor.items.length);
      editor.items.splice(insertAt, 0, item);
      markNewAdded(editor.caseFile ? editor.caseFile.id : null, item);
      resetTransientSelection(editor);
      editor.pageIndex = Math.floor(insertAt / getPageSize());
      editor.pendingOp = { type: 'insert', itemKey: localId, index: insertAt };
      renderEditor();
      start('已新增用例，超时将自动入库', { anchorRect: anchorRect });
    }

    function setBatchAddInputInvalid(invalid) {
      var input = getBatchAddInput();
      if (!input || !input.classList) return;
      if (invalid) input.classList.add('input-invalid');
      else input.classList.remove('input-invalid');
    }

    function batchInsertCaseItems(anchorEl) {
      var editor = getEditor();
      if (!editor || blockWhenPending(anchorEl)) return;
      if (!editor.caseFile) {
        showStatus('请先选择用例', 'warn');
        return;
      }
      var input = getBatchAddInput();
      var raw = input ? input.value : (editor.batchAddCount || 5);
      var parsed = model.parseBatchAddCount(raw);
      if (!parsed.ok) {
        setBatchAddInputInvalid(true);
        showStatus(parsed.reason || '批量新增数量不合法', 'warn');
        return;
      }
      setBatchAddInputInvalid(false);
      var count = parsed.value;
      editor.batchAddCount = count;
      persistBatchAddCount(count);
      var anchorRect = captureAnchorRect(anchorEl);
      var fileId = editor.caseFile.id;
      var startIndex = editor.items.length;
      var keys = [];
      for (var i = 0; i < count; i += 1) {
        var localId = 'local-batch-' + now().toString(16) + '-' + random().toString(16).slice(2, 6) + '-' + i;
        var item = {
          __localId: localId,
          case_file_id: fileId,
          module: '',
          title: '',
          priority: '',
          precondition: '',
          steps: '',
          expected: buildInvisibleMarker(localId),
          remark: '',
        };
        ensureItemKey(item, '__uiKey', '');
        markNewAdded(fileId, item);
        editor.items.push(item);
        keys.push(localId);
      }
      resetTransientSelection(editor);
      editor.pageIndex = Math.floor(startIndex / getPageSize());
      editor.pendingOp = { type: 'insert_batch', itemKeys: keys, startIndex: startIndex };
      renderEditor();
      setTimeoutFn(function() { scrollToIndex(startIndex); }, 0);
      start('已新增用例 ' + keys.length + ' 条，超时将自动入库', { anchorRect: anchorRect });
    }

    function removeCaseItem(index, anchorEl) {
      var editor = getEditor();
      if (!editor || blockWhenPending(anchorEl)) return Promise.resolve(false);
      var anchorRect = captureAnchorRect(anchorEl);
      var itemIndex = Math.max(0, Math.min(Number(index), editor.items.length - 1));
      var item = editor.items[itemIndex];
      if (!item) return Promise.resolve(false);
      return openConfirm({
        title: '确认删除用例',
        message: '确定删除该用例吗？可在 8 秒内撤回。',
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
        previousDrawer: getPreviousDrawer(),
      }).then(function(result) {
        if (!result || result.ok !== true) return false;
        unmarkNewAdded(editor.caseFile ? editor.caseFile.id : null, item);
        editor.items.splice(itemIndex, 1);
        resetTransientSelection(editor);
        editor.pendingOp = { type: 'remove', item: item, index: itemIndex };
        renderEditor();
        start('已删除用例，超时将自动入库', { anchorRect: anchorRect });
        return true;
      });
    }

    function removeSelectedCaseItems(anchorEl) {
      var editor = getEditor();
      if (!editor || blockWhenPending(anchorEl)) return Promise.resolve(false);
      if (!editor.caseFile) {
        showStatus('请先选择用例', 'warn');
        return Promise.resolve(false);
      }
      var indexes = model.collectSelectedIndexes(editor.selection, editor.items.length);
      if (!indexes.length) {
        showStatus('请先勾选需要删除的用例', 'warn');
        syncBatchDeleteControls();
        return Promise.resolve(false);
      }
      return openConfirm({
        title: '确认批量删除',
        message: '确定删除已勾选的 ' + indexes.length + ' 条用例吗？可在 8 秒内撤回。',
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
        previousDrawer: getPreviousDrawer(),
      }).then(function(result) {
        if (!result || result.ok !== true) return false;
        var anchorRect = captureAnchorRect(anchorEl);
        indexes.sort(function(a, b) { return b - a; });
        var removed = [];
        var fileId = editor.caseFile ? editor.caseFile.id : null;
        indexes.forEach(function(itemIndex) {
          var item = editor.items[itemIndex];
          if (!item) return;
          removed.push({ index: itemIndex, item: item });
          unmarkNewAdded(fileId, item);
          editor.items.splice(itemIndex, 1);
        });
        if (!removed.length) {
          showStatus('未删除任何用例', 'warn');
          syncBatchDeleteControls();
          return false;
        }
        resetTransientSelection(editor);
        editor.pendingOp = { type: 'remove_batch', removed: removed };
        renderEditor();
        start('已删除用例 ' + removed.length + ' 条，超时将自动入库', { anchorRect: anchorRect });
        return true;
      });
    }

    return {
      buildItemPayload: function(item) { return model.buildItemPayload(item, normalizeText); },
      validatePayload: model.validatePayload,
      parseBatchAddCount: model.parseBatchAddCount,
      setBatchAddInputInvalid: setBatchAddInputInvalid,
      cleanupToast: cleanupToast,
      clear: clear,
      undo: undo,
      start: start,
      commit: commit,
      insertCaseItem: insertCaseItem,
      batchInsertCaseItems: batchInsertCaseItems,
      removeCaseItem: removeCaseItem,
      removeSelectedCaseItems: removeSelectedCaseItems,
    };
  }

  return { create: create };
});
