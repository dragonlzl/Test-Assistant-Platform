(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.missingViewController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var apiClient = opts.apiClient || null;
    var model = opts.model || null;
    var view = opts.view || null;
    if (!model || !view) throw new Error('Missing view model and adapter are required');
    var getView = typeof opts.getView === 'function' ? opts.getView : function() { return {}; };
    var getDrawerState = typeof opts.getDrawerState === 'function' ? opts.getDrawerState : function() { return {}; };
    var getDrawerController = typeof opts.getDrawerController === 'function' ? opts.getDrawerController : function() { return null; };
    var getMaintenanceController = typeof opts.getMaintenanceController === 'function' ? opts.getMaintenanceController : function() { return null; };
    var getDrawer = typeof opts.getDrawer === 'function' ? opts.getDrawer : function() { return null; };
    var normalizeItem = typeof opts.normalizeItem === 'function' ? opts.normalizeItem : function(item) { return item; };
    var normalizeTypeId = typeof opts.normalizeTypeId === 'function' ? opts.normalizeTypeId : function(value) { return value || null; };
    var ensureTypeSlots = typeof opts.ensureTypeSlots === 'function' ? opts.ensureTypeSlots : function(item) { return item.type_ids || ['']; };
    var collectTypeIds = typeof opts.collectTypeIds === 'function' ? opts.collectTypeIds : function(item) { return item.type_ids || []; };
    var normalizeText = typeof opts.normalizeText === 'function' ? opts.normalizeText : function(value) { return String(value || '').trim(); };
    var normalizePriority = typeof opts.normalizePriority === 'function' ? opts.normalizePriority : function(value) { return normalizeText(value); };
    var moveCaretToEnd = typeof opts.moveCaretToEnd === 'function' ? opts.moveCaretToEnd : function() {};
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var showToast = typeof opts.showToast === 'function' ? opts.showToast : function() {};
    var openConfirm = typeof opts.openConfirm === 'function' ? opts.openConfirm : function() { return Promise.resolve({ ok: true }); };
    var captureAnchor = typeof opts.captureAnchor === 'function' ? opts.captureAnchor : function() { return null; };
    var clearPending = typeof opts.clearPending === 'function' ? opts.clearPending : function() {};
    var persistView = typeof opts.persistView === 'function' ? opts.persistView : function() {};
    var persistLastView = typeof opts.persistLastView === 'function' ? opts.persistLastView : function() {};
    var normalizeViewFilters = typeof opts.normalizeViewFilters === 'function' ? opts.normalizeViewFilters : function() {};
    var showMissingCard = typeof opts.showMissingCard === 'function' ? opts.showMissingCard : function() {};
    var showEditorCard = typeof opts.showEditorCard === 'function' ? opts.showEditorCard : function() {};
    var setHistoryVisible = typeof opts.setHistoryVisible === 'function' ? opts.setHistoryVisible : function() {};
    var insertItem = typeof opts.insertItem === 'function' ? opts.insertItem : function() {};
    var removeItem = typeof opts.removeItem === 'function' ? opts.removeItem : function() {};
    var addEmptyItem = typeof opts.addEmptyItem === 'function' ? opts.addEmptyItem : function() {};
    var removeSelected = typeof opts.removeSelected === 'function' ? opts.removeSelected : function() {};
    var scheduleTimeout = typeof opts.setTimeout === 'function' ? opts.setTimeout : setTimeout;
    var cancelTimeout = typeof opts.clearTimeout === 'function' ? opts.clearTimeout : clearTimeout;
    var bound = false;

    function ensureAutoSaveState() {
      var state = getView();
      if (!state || typeof state !== 'object') return null;
      if (!state.autoSaveTimers || typeof state.autoSaveTimers !== 'object') state.autoSaveTimers = {};
      if (!state.autoSaveInFlight || typeof state.autoSaveInFlight !== 'object') state.autoSaveInFlight = {};
      return state;
    }

    function tryAutoSave(index) {
      var state = getView();
      var idx = Number(index);
      if (!state || !Array.isArray(state.items) || !isFinite(idx) || idx < 0 || idx >= state.items.length) return;
      var item = state.items[idx];
      if (!item || !item.id || !apiClient || typeof apiClient.updateMissingModuleItem !== 'function') return;
      var payload = model.buildItemPayload(item);
      if (model.validatePayload(payload)) return;
      var key = String(item.id);
      var store = ensureAutoSaveState();
      if (!store) return;
      if (store.autoSaveInFlight[key]) {
        store.autoSaveInFlight[key] = 'pending';
        return;
      }
      store.autoSaveInFlight[key] = true;
      apiClient.updateMissingModuleItem(item.id, payload).then(function(updated) {
        if (updated && typeof updated === 'object' && (updated.id || updated.id === 0)) {
          normalizeItem(updated);
          state.items[idx] = updated;
        }
      }).catch(function() {
        // Auto-save failures stay silent; explicit blur/save reports errors.
      }).finally(function() {
        var pending = store.autoSaveInFlight[key];
        delete store.autoSaveInFlight[key];
        if (pending === 'pending') scheduleTimeout(function() { tryAutoSave(idx); }, 200);
      });
    }

    function scheduleAutoSave(index) {
      var state = ensureAutoSaveState();
      if (!state) return;
      var key = String(index);
      if (state.autoSaveTimers[key]) cancelTimeout(state.autoSaveTimers[key]);
      state.autoSaveTimers[key] = scheduleTimeout(function() {
        delete state.autoSaveTimers[key];
        tryAutoSave(index);
      }, 800);
    }

    function syncTypeUpdate(index, previousSlots) {
      var state = getView();
      var idx = Number(index);
      if (!state || !Array.isArray(state.items) || !isFinite(idx) || idx < 0 || idx >= state.items.length) return;
      var item = state.items[idx];
      if (!item) return;
      var emptyCount = 0;
      if (Array.isArray(item.type_ids)) {
        item.type_ids.forEach(function(typeId) { if (!normalizeTypeId(typeId)) emptyCount += 1; });
      }
      var hasFilter = state.typeFilters && state.typeFilters.size;
      if (hasFilter) view.render();
      else {
        view.refreshTypeCell(idx);
        view.renderTypePills(state.items);
      }
      if (!item.id || !apiClient || typeof apiClient.updateMissingModuleItem !== 'function') return;
      apiClient.updateMissingModuleItem(item.id, { type_ids: collectTypeIds(item) }).then(function(updated) {
        if (!updated || typeof updated !== 'object' || (!updated.id && updated.id !== 0)) return;
        normalizeItem(updated);
        if (emptyCount > 0) {
          var slots = ensureTypeSlots(updated).slice();
          var selectedCount = collectTypeIds(updated).length;
          var maxSlots = selectedCount ? 3 : Math.max(1, Math.min(3, emptyCount));
          while (emptyCount > 0 && slots.length < maxSlots) {
            slots.push('');
            emptyCount -= 1;
          }
          updated.type_ids = slots;
        }
        if (!updated.module_name) updated.module_name = item.module_name;
        state.items[idx] = updated;
        if (hasFilter) view.render();
        else {
          view.refreshTypeCell(idx);
          view.renderTypePills(state.items);
        }
      }).catch(function(error) {
        if (Array.isArray(previousSlots)) item.type_ids = previousSlots.slice();
        if (hasFilter) view.render();
        else {
          view.refreshTypeCell(idx);
          view.renderTypePills(state.items);
        }
        setStatus(error && error.message ? error.message : '更新类型失败', 'err');
      });
    }

    function handleItemTypeChange(index, slotIndex, nextValue) {
      var state = getView();
      var idx = Number(index);
      var slot = Number(slotIndex);
      if (!state || !Array.isArray(state.items) || !isFinite(idx) || idx < 0 || idx >= state.items.length) return;
      if (!isFinite(slot) || slot < 0) return;
      var item = state.items[idx];
      if (!item) return;
      var slots = ensureTypeSlots(item);
      if (slot >= slots.length) return;
      if (String(nextValue) === '__add_type__') {
        var maintenance = getMaintenanceController();
        if (maintenance && typeof maintenance.openTypeAdd === 'function') maintenance.openTypeAdd('view');
        view.refreshTypeCell(idx);
        return;
      }
      var nextTypeId = normalizeTypeId(nextValue);
      if (nextTypeId && model.hasDuplicateType(slots, slot, nextTypeId)) {
        showToast('已选相同类型', 'warn', 3000);
        view.refreshTypeCell(idx);
        return;
      }
      var previousSlots = slots.slice();
      slots[slot] = nextTypeId ? String(nextTypeId) : '';
      item.type_ids = slots;
      syncTypeUpdate(idx, previousSlots);
    }

    function addTypeSlot(index) {
      var state = getView();
      var idx = Number(index);
      if (!state || !Array.isArray(state.items) || !isFinite(idx) || idx < 0 || idx >= state.items.length) return;
      var item = state.items[idx];
      if (!item) return;
      var slots = ensureTypeSlots(item);
      if (slots.length >= 3) return;
      slots.push('');
      item.type_ids = slots;
      view.refreshTypeCell(idx);
    }

    function removeTypeSlot(index, slotIndex, anchorEl) {
      var state = getView();
      var idx = Number(index);
      var slot = Number(slotIndex);
      if (!state || !Array.isArray(state.items) || !isFinite(idx) || idx < 0 || idx >= state.items.length) return;
      if (!isFinite(slot) || slot < 0) return;
      var item = state.items[idx];
      if (!item) return;
      var slots = ensureTypeSlots(item);
      if (slot >= slots.length) return;
      if (slots.length <= 1) {
        showToast('至少要保留1个类型', 'warn', 3000);
        return;
      }
      openConfirm({
        title: '确认删除类型',
        message: '确认删除类型【' + view.resolveTypeLabel(slots[slot], null) + '】吗？',
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
        anchorEl: anchorEl || null,
      }).then(function(result) {
        if (!result || result.ok !== true) return;
        var previousSlots = slots.slice();
        slots.splice(slot, 1);
        item.type_ids = slots.length ? slots : [''];
        syncTypeUpdate(idx, previousSlots);
      });
    }

    function toggleTypeFilter(key) {
      var state = getView();
      if (!state) return;
      var filters = state.typeFilters instanceof Set ? state.typeFilters : new Set();
      state.typeFilters = filters;
      var id = String(key || '');
      if (!id) return;
      if (filters.has(id)) filters.delete(id);
      else filters.add(id);
      state.selection = new Set();
      state.pageIndex = 0;
      view.render();
    }

    function handlePaginationAction(action) {
      var state = getView();
      if (!state) return;
      var page = model.resolvePage(state.items, state.typeFilters, state.pageIndex, opts.getPageSize());
      if (action === 'prev') state.pageIndex = Math.max(0, page.pageIndex - 1);
      if (action === 'next') state.pageIndex = Math.min(page.totalPages - 1, page.pageIndex + 1);
      view.render();
    }

    function handlePaginationJump(value) {
      var state = getView();
      if (!state) return;
      var page = model.resolvePage(state.items, state.typeFilters, state.pageIndex, opts.getPageSize());
      state.pageIndex = Math.max(0, Math.min((Number(value) || 1) - 1, page.totalPages - 1));
      view.render();
    }

    function saveItem(index, reason) {
      var state = getView();
      var idx = Number(index);
      if (!state || !Array.isArray(state.items) || !isFinite(idx) || idx < 0 || idx >= state.items.length) return;
      var item = state.items[idx];
      if (!item || !item.id || !apiClient || typeof apiClient.updateMissingModuleItem !== 'function') return;
      var payload = model.buildItemPayload(item);
      var error = model.validatePayload(payload);
      if (error) {
        setStatus(error, 'warn');
        return;
      }
      setStatus((reason || '保存中') + '...', '');
      apiClient.updateMissingModuleItem(item.id, payload).then(function(updated) {
        if (updated && typeof updated === 'object' && (updated.id || updated.id === 0)) {
          normalizeItem(updated);
          state.items[idx] = updated;
        }
        setStatus('已保存', 'ok');
        view.render();
      }).catch(function(error) {
        setStatus(error && error.message ? error.message : '保存失败', 'err');
      });
    }

    function loadItems(modules) {
      var state = getView();
      if (!apiClient || typeof apiClient.listMissingModuleItems !== 'function') {
        setStatus('易漏条目接口未就绪', 'err');
        return Promise.resolve([]);
      }
      var list = Array.isArray(modules) ? modules.filter(Boolean) : [];
      if (!list.length) {
        state.items = [];
        view.render();
        setStatus('暂无可用模块', 'warn');
        return Promise.resolve([]);
      }
      return Promise.all(list.map(function(module) {
        return apiClient.listMissingModuleItems(module.id).then(function(items) {
          return (Array.isArray(items) ? items : []).map(function(item) {
            var clone = item && typeof item === 'object' ? Object.assign({}, item) : {};
            clone.module_id = module.id;
            clone.module_name = module.name || ('模块#' + module.id);
            normalizeItem(clone);
            return clone;
          });
        }).catch(function() { return []; });
      })).then(function(groups) {
        var combined = [];
        groups.forEach(function(rows) { (rows || []).forEach(function(row) { combined.push(row); }); });
        state.items = combined;
        view.render();
        setStatus(combined.length ? ('已加载 ' + combined.length + ' 条易漏用例') : '暂无易漏用例条目', combined.length ? 'ok' : 'warn');
        return combined;
      });
    }

    function openForModules(modules) {
      var list = Array.isArray(modules) ? modules.filter(Boolean) : [];
      if (!list.length) {
        if (typeof opts.setDrawerStatus === 'function') opts.setDrawerStatus('请先选择模块', 'warn');
        return Promise.resolve([]);
      }
      var state = getView();
      var drawerState = getDrawerState() || {};
      state.projectId = drawerState.projectId || (list[0] && list[0].project_id ? list[0].project_id : null);
      state.modules = list;
      state.moduleIds = list.map(function(module) { return module && module.id ? module.id : null; }).filter(function(value) { return value !== null; });
      state.items = [];
      state.selection = new Set();
      state.pageIndex = 0;
      var drawerController = getDrawerController();
      var typeIds = drawerController && typeof drawerController.getTypeFilterIds === 'function'
        ? drawerController.getTypeFilterIds()
        : [];
      state.typeFilters = new Set(typeIds);
      normalizeViewFilters();
      clearPending();
      persistView();
      persistLastView('missing');
      setStatus('加载易漏用例...', '');
      view.render();
      if (state.projectId && drawerController && typeof drawerController.loadTypes === 'function') {
        drawerController.loadTypes(state.projectId);
      }
      var result = loadItems(list).then(function(items) {
        view.updateMeta();
        showMissingCard(true);
        setHistoryVisible(false);
        showEditorCard(false);
        return items;
      });
      var keepOpenOnce = Boolean(drawerState.keepOpenOnce);
      if (keepOpenOnce) drawerState.keepOpenOnce = false;
      var drawer = getDrawer();
      if (!keepOpenOnce && drawer && typeof drawer.close === 'function') drawer.close();
      return result;
    }

    function handleViewClick(event) {
      var target = event && event.target ? event.target : null;
      if (!target) return;
      var button = target.closest ? target.closest('[data-case-lib-missing-type-remove]') : null;
      if (button) return removeTypeSlot(button.getAttribute('data-index'), button.getAttribute('data-type-index'), button);
      button = target.closest ? target.closest('[data-case-lib-missing-type-add]') : null;
      if (button) return addTypeSlot(button.getAttribute('data-index'));
      button = target.closest ? target.closest('[data-case-lib-missing-insert]') : null;
      if (button) return insertItem(Number(button.getAttribute('data-index')), captureAnchor(button));
      button = target.closest ? target.closest('[data-case-lib-missing-remove]') : null;
      if (button) return removeItem(Number(button.getAttribute('data-index')), captureAnchor(button));
      button = target.closest ? target.closest('[data-case-lib-missing-empty-add]') : null;
      if (button) return addEmptyItem(captureAnchor(button));
      button = target.closest ? target.closest('[data-case-lib-missing-page]') : null;
      if (button) handlePaginationAction(button.getAttribute('data-case-lib-missing-page'));
    }

    function handleViewChange(event) {
      var target = event && event.target ? event.target : null;
      if (!target || !target.hasAttribute) return;
      if (target.hasAttribute('data-case-lib-missing-type')) {
        handleItemTypeChange(target.getAttribute('data-index'), target.getAttribute('data-type-index'), target.value);
        return;
      }
      if (target.hasAttribute('data-case-lib-missing-page-input')) return handlePaginationJump(target.value);
      var state = getView();
      var selection = state.selection instanceof Set ? state.selection : new Set();
      state.selection = selection;
      if (target.hasAttribute('data-case-lib-missing-select-all')) {
        var visible = (target.getAttribute('data-visible') || '').split(',').map(Number).filter(isFinite);
        visible.forEach(function(index) { if (target.checked) selection.add(index); else selection.delete(index); });
        view.render();
        return;
      }
      if (target.hasAttribute('data-case-lib-missing-select')) {
        var index = Number(target.getAttribute('data-index'));
        if (!isFinite(index)) return;
        if (target.checked) selection.add(index);
        else selection.delete(index);
        view.syncBatchDeleteControls();
      }
    }

    function readEditableTarget(target) {
      if (!target || !target.getAttribute) return null;
      var field = target.getAttribute('data-case-lib-missing-field');
      var index = Number(target.getAttribute('data-index'));
      if (!field || !isFinite(index)) return null;
      var state = getView();
      var item = state && state.items ? state.items[index] : null;
      if (!item) return null;
      var multiline = String(target.getAttribute('data-case-lib-missing-multiline') || '').toLowerCase() === 'true';
      return { field: field, index: index, item: item, multiline: multiline, raw: multiline ? target.innerText : target.textContent };
    }

    function handleViewInput(event) {
      var target = event && event.target ? event.target : null;
      var editable = readEditableTarget(target);
      if (!editable) return;
      var next = normalizeText(editable.raw);
      if (editable.field === 'priority') {
        next = normalizePriority(next);
        if (!editable.multiline && target.textContent !== next) {
          target.textContent = next;
          moveCaretToEnd(target);
        }
      }
      editable.item[editable.field] = next;
      scheduleAutoSave(editable.index);
    }

    function handleViewFocusOut(event) {
      var target = event && event.target ? event.target : null;
      var editable = readEditableTarget(target);
      if (!editable) return;
      var previous = normalizeText(editable.item[editable.field]);
      var next = normalizeText(editable.raw);
      if (editable.field === 'priority') {
        previous = normalizePriority(previous);
        next = normalizePriority(next);
        if (!editable.multiline && target.textContent !== next) target.textContent = next;
      }
      if (previous === next) return;
      editable.item[editable.field] = next;
      saveItem(editable.index, '保存');
    }

    function bindEvents() {
      if (bound) return;
      bound = true;
      if (dom.missingBatchDeleteBtn) {
        dom.missingBatchDeleteBtn.addEventListener('click', function(event) {
          removeSelected(event && event.currentTarget ? event.currentTarget : null);
        });
      }
      if (dom.missingView) {
        dom.missingView.addEventListener('click', handleViewClick);
        dom.missingView.addEventListener('change', handleViewChange);
        dom.missingView.addEventListener('input', handleViewInput);
        dom.missingView.addEventListener('focusout', handleViewFocusOut);
      }
      if (dom.missingTypePills) {
        dom.missingTypePills.addEventListener('click', function(event) {
          var target = event && event.target && event.target.closest
            ? event.target.closest('[data-case-lib-missing-type-pill]')
            : null;
          if (target) toggleTypeFilter(target.getAttribute('data-case-lib-missing-type-pill'));
        });
      }
    }

    return {
      ensureAutoSaveState: ensureAutoSaveState,
      tryAutoSave: tryAutoSave,
      scheduleAutoSave: scheduleAutoSave,
      syncTypeUpdate: syncTypeUpdate,
      handleItemTypeChange: handleItemTypeChange,
      addTypeSlot: addTypeSlot,
      removeTypeSlot: removeTypeSlot,
      toggleTypeFilter: toggleTypeFilter,
      handlePaginationAction: handlePaginationAction,
      handlePaginationJump: handlePaginationJump,
      saveItem: saveItem,
      loadItems: loadItems,
      openForModules: openForModules,
      bindEvents: bindEvents,
    };
  }

  return { create: create };
});
