(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var pendingModel = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.editorPendingModel
    : null;
  var lifecycleFactory = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.pendingOperationLifecycle
    : null;
  if (typeof module !== 'undefined' && module.exports) {
    pendingModel = pendingModel || require('./caseLibraryEditorPendingModel.js');
    lifecycleFactory = lifecycleFactory || require('./caseLibraryPendingOperationLifecycle.js');
  }
  var api = factory(pendingModel, lifecycleFactory);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.missingViewPendingController = api;
  }
})(function(pendingModel, lifecycleFactory) {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    if (!pendingModel || !lifecycleFactory || typeof opts.getView !== 'function' || !opts.apiClient) {
      throw new Error('Missing view pending controller dependencies are required');
    }
    var apiClient = opts.apiClient;
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : noop;
    var render = typeof opts.render === 'function' ? opts.render : noop;
    var syncBatchDeleteControls = typeof opts.syncBatchDeleteControls === 'function'
      ? opts.syncBatchDeleteControls
      : noop;
    var buildPayload = typeof opts.buildPayload === 'function' ? opts.buildPayload : function() { return null; };
    var validatePayload = typeof opts.validatePayload === 'function' ? opts.validatePayload : function() { return ''; };
    var syncRowInput = typeof opts.syncRowInput === 'function' ? opts.syncRowInput : noop;
    var getItemUiKey = typeof opts.getItemUiKey === 'function' ? opts.getItemUiKey : function() { return ''; };
    var normalizeCreated = typeof opts.normalizeCreated === 'function' ? opts.normalizeCreated : function(value) { return value; };
    var ensureItemKey = typeof opts.ensureItemKey === 'function' ? opts.ensureItemKey : noop;
    var markNewAdded = typeof opts.markNewAdded === 'function' ? opts.markNewAdded : noop;
    var unmarkNewAdded = typeof opts.unmarkNewAdded === 'function' ? opts.unmarkNewAdded : noop;
    var captureAnchorRect = typeof opts.captureAnchorRect === 'function'
      ? opts.captureAnchorRect
      : function() { return null; };
    var showBlockHint = typeof opts.showBlockHint === 'function' ? opts.showBlockHint : noop;
    var getPageSize = typeof opts.getPageSize === 'function' ? opts.getPageSize : function() { return 20; };
    var getModuleName = typeof opts.getModuleName === 'function'
      ? opts.getModuleName
      : function(moduleId) { return '模块#' + moduleId; };
    var openConfirm = typeof opts.openConfirm === 'function'
      ? opts.openConfirm
      : function() { return Promise.resolve({ ok: false }); };
    var getPreviousDrawer = typeof opts.getPreviousDrawer === 'function'
      ? opts.getPreviousDrawer
      : function() { return null; };
    var now = typeof opts.now === 'function' ? opts.now : Date.now;
    var random = typeof opts.random === 'function' ? opts.random : Math.random;

    function getView() {
      return opts.getView();
    }

    function showStatus(message, type) {
      setStatus(message, type || '');
    }

    function restoreRemoved(view, removed) {
      pendingModel.sortedRestoreEntries(removed).forEach(function(entry) {
        var index = Math.max(0, Math.min(Number(entry.index), view.items.length));
        view.items.splice(index, 0, entry.item);
      });
    }

    function undo() {
      var view = getView();
      var op = view && view.pendingOp ? view.pendingOp : null;
      if (!view || !op) return false;
      if (op.type === 'remove' && op.item) {
        var insertAt = Math.min(Math.max(op.index, 0), view.items.length);
        view.items.splice(insertAt, 0, op.item);
      } else if (op.type === 'remove_batch') {
        restoreRemoved(view, op.removed);
      } else if (op.type === 'insert' && op.itemKey) {
        var index = view.items.findIndex(function(item) {
          return item && item.__localId === op.itemKey;
        });
        if (index !== -1) view.items.splice(index, 1);
      }
      view.selection = new Set();
      lifecycle.clear();
      showStatus('已撤回增删操作（未入库）', 'ok');
      render();
      return true;
    }

    function commitSingleRemove(view, op) {
      if (typeof apiClient.deleteMissingModuleItem !== 'function') {
        lifecycle.clear();
        return Promise.resolve();
      }
      return apiClient.deleteMissingModuleItem(op.item.id).then(function() {
        showStatus('删除已入库', 'ok');
      }).catch(function(error) {
        showStatus(error && error.message ? error.message : '删除入库失败', 'err');
      }).finally(lifecycle.clear);
    }

    function commitBatchRemove(view, op) {
      if (typeof apiClient.deleteMissingModuleItem !== 'function') {
        lifecycle.clear();
        return Promise.resolve();
      }
      var entries = pendingModel.collectDeleteEntries(op.removed);
      if (!entries.length) {
        lifecycle.clear();
        showStatus('批量删除已撤回或无需入库', 'warn');
        render();
        return Promise.resolve();
      }
      var promises = entries.map(function(entry) {
        return pendingModel.settle(apiClient.deleteMissingModuleItem(entry.id, { batch: true }));
      });
      return Promise.all(promises).then(function(results) {
        var failures = [];
        for (var i = 0; i < results.length; i += 1) {
          if (results[i] && results[i].status === 'rejected') failures.push(entries[i]);
        }
        if (!failures.length) {
          showStatus('批量删除已入库（' + entries.length + '条）', 'ok');
          return;
        }
        restoreRemoved(view, failures);
        render();
        showStatus('批量删除部分失败：成功 ' + (entries.length - failures.length) + ' 条，失败 ' + failures.length + ' 条', 'warn');
      }).catch(function(error) {
        showStatus(error && error.message ? error.message : '批量删除入库失败', 'err');
      }).finally(lifecycle.clear);
    }

    function commitSingleInsert(view, op) {
      var index = view.items.findIndex(function(item) {
        return item && item.__localId === op.itemKey;
      });
      if (index === -1) {
        lifecycle.clear();
        showStatus('新增条目已撤回或不存在', 'warn');
        return Promise.resolve();
      }
      var item = view.items[index];
      syncRowInput(index, item, { skipEmptyRequired: true });
      var uiKey = getItemUiKey(item);
      var payload = buildPayload(item);
      var validationError = validatePayload(payload);
      if (validationError) {
        lifecycle.clear();
        showStatus('新增条目未入库：' + validationError, 'warn');
        return Promise.resolve();
      }
      var moduleId = item && item.module_id ? item.module_id : null;
      if (!moduleId || typeof apiClient.createMissingModuleItem !== 'function') {
        lifecycle.clear();
        showStatus('新增条目未入库：模块缺失', 'warn');
        return Promise.resolve();
      }
      return apiClient.createMissingModuleItem(moduleId, payload).then(function(created) {
        if (created) {
          normalizeCreated(created);
          ensureItemKey(created, '__uiKey', uiKey || '');
          view.items[index] = created;
          markNewAdded(moduleId, created);
        }
        showStatus('新增已入库', 'ok');
        render();
      }).catch(function(error) {
        showStatus(error && error.message ? error.message : '新增入库失败', 'err');
      }).finally(lifecycle.clear);
    }

    function commit() {
      var view = getView();
      var op = view && view.pendingOp ? view.pendingOp : null;
      if (!view || !op) return Promise.resolve();
      lifecycle.cleanup();
      showStatus('增删入库中...', '');
      if (op.type === 'remove' && op.item && op.item.id) return commitSingleRemove(view, op);
      if (op.type === 'remove_batch') return commitBatchRemove(view, op);
      if (op.type === 'insert' && op.itemKey) return commitSingleInsert(view, op);
      lifecycle.clear();
      showStatus('变更已应用', 'ok');
      return Promise.resolve();
    }

    var lifecycle = lifecycleFactory.create({
      getState: getView,
      document: opts.document,
      clearTimeout: opts.clearTimeout,
      setInterval: opts.setInterval,
      clearInterval: opts.clearInterval,
      countdownSeconds: opts.countdownSeconds,
      onUndo: undo,
      onCommit: commit,
      onClear: syncBatchDeleteControls,
    });

    function blockWhenPending(anchorEl) {
      var view = getView();
      if (!view || !view.pendingOp) return false;
      var message = '当前有待确认的增删操作，请先撤回或等待入库';
      showStatus(message, 'warn');
      var anchorRect = captureAnchorRect(anchorEl);
      if (anchorRect) showBlockHint(anchorRect, message);
      return true;
    }

    function insert(index, anchorEl) {
      var view = getView();
      if (!view || blockWhenPending(anchorEl)) return;
      var anchorRect = captureAnchorRect(anchorEl);
      var base = view.items[index] || {};
      var moduleId = base.module_id || (view.moduleIds && view.moduleIds.length ? view.moduleIds[0] : null);
      if (!moduleId) {
        showStatus('请先选择模块', 'warn');
        return;
      }
      var localId = 'missing-local-' + now().toString(16) + '-' + random().toString(16).slice(2, 6);
      var item = {
        __localId: localId,
        module_id: moduleId,
        module_name: base.module_name || getModuleName(moduleId),
        type_ids: [''],
        type_names: [],
        title: '',
        priority: '',
        precondition: '',
        steps: '',
        expected: '待补充',
        remark: '',
      };
      ensureItemKey(item, '__uiKey', '');
      var insertAt = Math.min(Math.max(Number(index) + 1, 0), view.items.length);
      view.items.splice(insertAt, 0, item);
      markNewAdded(moduleId, item);
      view.selection = new Set();
      view.pageIndex = Math.floor(insertAt / getPageSize());
      view.pendingOp = { type: 'insert', itemKey: localId, index: insertAt };
      render();
      lifecycle.start('已新增条目，超时将自动入库', { anchorRect: anchorRect });
    }

    function addEmpty(anchorEl) {
      var view = getView();
      if (!view || view.items.length) return;
      insert(-1, anchorEl);
    }

    function remove(index, anchorEl) {
      var view = getView();
      if (!view || blockWhenPending(anchorEl)) return Promise.resolve(false);
      var anchorRect = captureAnchorRect(anchorEl);
      var itemIndex = Math.max(0, Math.min(Number(index), view.items.length - 1));
      var item = view.items[itemIndex];
      if (!item) return Promise.resolve(false);
      return openConfirm({
        title: '确认删除条目',
        message: '确定删除该易漏用例吗？可在 8 秒内撤回。',
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
        previousDrawer: getPreviousDrawer(),
      }).then(function(result) {
        if (!result || result.ok !== true) return false;
        unmarkNewAdded(item.module_id, item);
        view.items.splice(itemIndex, 1);
        view.selection = new Set();
        view.pendingOp = { type: 'remove', item: item, index: itemIndex };
        render();
        lifecycle.start('已删除条目，超时将自动入库', { anchorRect: anchorRect });
        return true;
      });
    }

    function removeSelected(anchorEl) {
      var view = getView();
      if (!view || blockWhenPending(anchorEl)) return Promise.resolve(false);
      var indexes = pendingModel.collectSelectedIndexes(view.selection, view.items.length);
      if (!indexes.length) {
        showStatus('请先勾选需要删除的条目', 'warn');
        syncBatchDeleteControls();
        return Promise.resolve(false);
      }
      return openConfirm({
        title: '确认批量删除',
        message: '确定删除已勾选的 ' + indexes.length + ' 条易漏用例吗？可在 8 秒内撤回。',
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
        previousDrawer: getPreviousDrawer(),
      }).then(function(result) {
        if (!result || result.ok !== true) return false;
        var anchorRect = captureAnchorRect(anchorEl);
        indexes.sort(function(a, b) { return b - a; });
        var removed = [];
        indexes.forEach(function(itemIndex) {
          var item = view.items[itemIndex];
          if (!item) return;
          removed.push({ index: itemIndex, item: item });
          unmarkNewAdded(item.module_id, item);
          view.items.splice(itemIndex, 1);
        });
        if (!removed.length) {
          showStatus('未删除任何条目', 'warn');
          syncBatchDeleteControls();
          return false;
        }
        view.selection = new Set();
        view.pendingOp = { type: 'remove_batch', removed: removed };
        render();
        lifecycle.start('已删除条目 ' + removed.length + ' 条，超时将自动入库', { anchorRect: anchorRect });
        return true;
      });
    }

    return {
      cleanup: lifecycle.cleanup,
      clear: lifecycle.clear,
      start: lifecycle.start,
      undo: undo,
      commit: commit,
      insert: insert,
      addEmpty: addEmpty,
      remove: remove,
      removeSelected: removeSelected,
    };
  }

  return { create: create };
});
