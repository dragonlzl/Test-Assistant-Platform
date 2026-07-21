(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.missingDrawerModel = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var resolvePage = typeof opts.resolvePage === 'function'
      ? opts.resolvePage
      : function(total) { return { pageIndex: 0, totalPages: total ? 1 : 1, start: 0, end: total }; };
    var normalizeTypeId = typeof opts.normalizeTypeId === 'function'
      ? opts.normalizeTypeId
      : function(value) { return value || null; };
    var normalizeText = typeof opts.normalizeText === 'function'
      ? opts.normalizeText
      : function(value) { return String(value || '').trim(); };

    function getTypeFilterIds(typeState) {
      var selection = typeState && typeState.selection instanceof Set ? typeState.selection : new Set();
      return Array.from(selection);
    }

    function getVisibleModules(drawerState) {
      var drawer = drawerState && typeof drawerState === 'object' ? drawerState : {};
      var list = Array.isArray(drawer.modules) ? drawer.modules : [];
      if (!drawer.moduleId) return list.slice();
      return list.filter(function(module) {
        return String(module && module.id || '') === String(drawer.moduleId || '');
      });
    }

    function buildSnapshot(drawerState) {
      var drawer = drawerState && typeof drawerState === 'object' ? drawerState : {};
      var visible = getVisibleModules(drawer);
      var page = resolvePage(visible.length, drawer.pageIndex);
      var paged = visible.slice(page.start, page.end);
      var selected = drawer.selection instanceof Set ? drawer.selection : new Set();
      var visibleIds = {};
      visible.forEach(function(module) {
        if (module && module.id) visibleIds[String(module.id)] = true;
      });
      var selection = new Set();
      selected.forEach(function(id) {
        if (visibleIds[String(id)]) selection.add(String(id));
      });
      var pageSelected = paged.reduce(function(count, module) {
        if (!module || !module.id) return count;
        return selection.has(String(module.id)) ? count + 1 : count;
      }, 0);
      var totalItems = visible.reduce(function(total, module) {
        var count = Number(module && module.item_count);
        if (!Number.isFinite(count) || count < 0) count = 0;
        return total + count;
      }, 0);
      return {
        visible: visible,
        list: paged,
        total: visible.length,
        totalItems: totalItems,
        page: page,
        selection: selection,
        busy: Boolean(drawer.loading || drawer.processing),
        selectedCount: selection.size,
        pageSelected: pageSelected,
        pageTotal: paged.length,
      };
    }

    function setPageSelection(snapshot, checked) {
      var data = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var selection = data.selection instanceof Set ? new Set(data.selection) : new Set();
      (Array.isArray(data.list) ? data.list : []).forEach(function(module) {
        if (!module || !module.id) return;
        var key = String(module.id);
        if (checked) selection.add(key);
        else selection.delete(key);
      });
      return selection;
    }

    function findModuleById(modules, moduleId) {
      var key = String(moduleId || '');
      if (!key) return null;
      return (Array.isArray(modules) ? modules : []).find(function(module) {
        return module && String(module.id) === key;
      }) || null;
    }

    function isItemTypeComplete(item) {
      if (!item || typeof item !== 'object') return false;
      var slots = Array.isArray(item.type_ids) ? item.type_ids.slice() : [];
      if (!slots.length && item.type_id !== null && item.type_id !== undefined && item.type_id !== '') {
        slots = [item.type_id];
      }
      if (!slots.length) return false;
      for (var i = 0; i < slots.length; i += 1) {
        if (!normalizeTypeId(slots[i])) return false;
      }
      return true;
    }

    function isItemFieldsComplete(item) {
      if (!item || typeof item !== 'object') return false;
      var fields = ['title', 'priority', 'precondition', 'steps', 'expected'];
      for (var i = 0; i < fields.length; i += 1) {
        if (!normalizeText(item[fields[i]] || '')) return false;
      }
      return true;
    }

    function isModuleComplete(items) {
      if (!Array.isArray(items) || !items.length) return false;
      for (var i = 0; i < items.length; i += 1) {
        if (!isItemTypeComplete(items[i]) || !isItemFieldsComplete(items[i])) return false;
      }
      return true;
    }

    function isModuleDuplicateError(err) {
      var payload = err && err.payload ? err.payload : null;
      var detail = payload && payload.detail ? String(payload.detail || '') : '';
      return Boolean(err && (err.status === 409 || detail === 'missing_module_duplicate'));
    }

    function isTypeDuplicateError(err) {
      var payload = err && err.payload ? err.payload : null;
      var detail = payload && payload.detail ? payload.detail : null;
      if (detail && typeof detail === 'object' && detail.detail) detail = detail.detail;
      var detailText = detail ? String(detail || '') : '';
      return Boolean(err && (err.status === 409 || detailText === 'missing_type_duplicate'));
    }

    function readTypeInUseError(err) {
      var payload = err && err.payload ? err.payload : null;
      var detail = payload && payload.detail ? payload.detail : null;
      var code = payload && payload.code ? String(payload.code) : '';
      if (!code && detail && detail.code) code = String(detail.code);
      if (code !== 'MISSING_TYPE_IN_USE') return null;
      var count = 0;
      if (payload && typeof payload.item_count === 'number') count = payload.item_count;
      if (!count && detail && typeof detail.item_count === 'number') count = detail.item_count;
      return { count: count };
    }

    function buildTypeTransferOptions(types, excludedId) {
      return (Array.isArray(types) ? types : []).filter(function(type) {
        return type && String(type.id) !== String(excludedId);
      }).map(function(type) {
        return { value: String(type.id), label: type.name ? String(type.name) : ('类型#' + type.id) };
      }).filter(function(option) { return option && option.value; });
    }

    return {
      getTypeFilterIds: getTypeFilterIds,
      getVisibleModules: getVisibleModules,
      buildSnapshot: buildSnapshot,
      setPageSelection: setPageSelection,
      findModuleById: findModuleById,
      isItemTypeComplete: isItemTypeComplete,
      isItemFieldsComplete: isItemFieldsComplete,
      isModuleComplete: isModuleComplete,
      isModuleDuplicateError: isModuleDuplicateError,
      isTypeDuplicateError: isTypeDuplicateError,
      readTypeInUseError: readTypeInUseError,
      buildTypeTransferOptions: buildTypeTransferOptions,
    };
  }

  return { create: create };
});
