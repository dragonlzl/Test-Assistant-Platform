(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.missingCatalogMaintenanceController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var apiClient = opts.apiClient || null;
    var model = opts.model || null;
    var view = opts.view || null;
    var drawerController = opts.drawerController || null;
    if (!model || !view || !drawerController) throw new Error('Missing catalog maintenance owners are required');

    var ensureDrawer = typeof opts.ensureDrawer === 'function' ? opts.ensureDrawer : function() { return null; };
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function'
      ? opts.openConfirmDrawer
      : function() { return Promise.resolve({ ok: true }); };
    var isAdminUser = typeof opts.isAdminUser === 'function' ? opts.isAdminUser : function() { return false; };
    var canDeleteModules = typeof opts.canDeleteModules === 'function' ? opts.canDeleteModules : function() { return false; };
    var getProjectName = typeof opts.getProjectName === 'function'
      ? opts.getProjectName
      : function(projectId) { return '项目#' + projectId; };
    var getMainDrawer = typeof opts.getMainDrawer === 'function' ? opts.getMainDrawer : function() { return null; };
    var showToast = typeof opts.showToast === 'function' ? opts.showToast : function() {};
    var captureAnchor = typeof opts.captureAnchor === 'function' ? opts.captureAnchor : function() { return null; };
    var showBlockHint = typeof opts.showBlockHint === 'function' ? opts.showBlockHint : function() {};
    var normalizeTypeSelection = typeof opts.normalizeTypeSelection === 'function'
      ? opts.normalizeTypeSelection
      : function() {};
    var normalizeTypeId = typeof opts.normalizeTypeId === 'function' ? opts.normalizeTypeId : function(value) { return value || null; };
    var normalizeTypeIds = typeof opts.normalizeTypeIds === 'function' ? opts.normalizeTypeIds : function(values) { return values || []; };
    var ensureItemTypeSlots = typeof opts.ensureItemTypeSlots === 'function'
      ? opts.ensureItemTypeSlots
      : function(item) { return item && Array.isArray(item.type_ids) ? item.type_ids : []; };
    var resolveItemTypeNames = typeof opts.resolveItemTypeNames === 'function'
      ? opts.resolveItemTypeNames
      : function(ids, names) { return names || []; };
    var formatItemTypeLabel = typeof opts.formatItemTypeLabel === 'function'
      ? opts.formatItemTypeLabel
      : function() { return ''; };
    var renderTypePills = typeof opts.renderTypePills === 'function' ? opts.renderTypePills : function() {};
    var refreshTypeCells = typeof opts.refreshTypeCells === 'function' ? opts.refreshTypeCells : function() {};
    var normalizeViewTypeFilters = typeof opts.normalizeViewTypeFilters === 'function'
      ? opts.normalizeViewTypeFilters
      : function() {};
    var isMissingCardVisible = typeof opts.isMissingCardVisible === 'function' ? opts.isMissingCardVisible : function() { return false; };
    var renderMissingView = typeof opts.renderMissingView === 'function' ? opts.renderMissingView : function() {};
    var updateMissingViewMeta = typeof opts.updateMissingViewMeta === 'function' ? opts.updateMissingViewMeta : function() {};
    var persistMissingView = typeof opts.persistMissingView === 'function' ? opts.persistMissingView : function() {};
    var clearMissingViewPersistence = typeof opts.clearMissingViewPersistence === 'function'
      ? opts.clearMissingViewPersistence
      : function() {};

    var moduleAddDrawer = null;
    var moduleEditDrawer = null;
    var typeAddDrawer = null;
    var typeManageDrawer = null;
    var bound = false;

    function refreshTypeUi() {
      drawerController.syncTypeCatalog();
      view.renderTypeManage(state.missingType.types, isAdminUser());
      normalizeViewTypeFilters();
      if (isMissingCardVisible()) renderMissingView();
    }

    function refreshMissingViewDetails() {
      updateMissingViewMeta();
      renderMissingView();
    }

    function initDrawers() {
      if (!moduleAddDrawer) {
        moduleAddDrawer = ensureDrawer(
          'caseLibraryMissingAddDrawer',
          [],
          function() { view.setModuleAddStatus('', ''); },
          function() { state.missingAdd.loading = false; }
        );
      }
      if (!moduleEditDrawer) {
        moduleEditDrawer = ensureDrawer(
          'caseLibraryMissingEditDrawer',
          [],
          function() { view.setModuleEditStatus('', ''); },
          function() {
            state.missingEdit.loading = false;
            state.missingEdit.moduleId = null;
            state.missingEdit.projectId = null;
            state.missingEdit.name = '';
          }
        );
      }
      if (!typeAddDrawer) {
        typeAddDrawer = ensureDrawer(
          'caseLibraryMissingTypeAddDrawer',
          [],
          function() { view.setTypeAddStatus('', ''); },
          function() { state.missingTypeAdd.loading = false; }
        );
      }
      if (!typeManageDrawer) {
        typeManageDrawer = ensureDrawer(
          'caseLibraryMissingTypeManageDrawer',
          [],
          renderTypeManage,
          function() { state.missingTypeManage.loading = false; }
        );
      }
      return {
        moduleAdd: moduleAddDrawer,
        moduleEdit: moduleEditDrawer,
        typeAdd: typeAddDrawer,
        typeManage: typeManageDrawer,
      };
    }

    function openTypeAdd(source) {
      initDrawers();
      var projectId = state.missingDrawer.projectId || (state.missingView ? state.missingView.projectId : null);
      if (!projectId) {
        view.setDrawerStatus('请先选择项目', 'warn');
        return;
      }
      state.missingTypeAdd.projectId = projectId;
      state.missingTypeAdd.source = source || 'drawer';
      view.prepareTypeAdd(getProjectName(projectId));
      if (typeAddDrawer && typeof typeAddDrawer.open === 'function') typeAddDrawer.open();
    }

    function openTypeManage() {
      initDrawers();
      var projectId = state.missingDrawer.projectId;
      if (!projectId) {
        view.setDrawerStatus('请先选择项目', 'warn');
        return;
      }
      view.setTypeManageStatus(isAdminUser() ? '' : '仅管理员可删除类型', isAdminUser() ? '' : 'warn');
      if (typeManageDrawer && typeof typeManageDrawer.open === 'function') typeManageDrawer.open();
      if (!state.missingType.loading) drawerController.loadTypes(projectId);
    }

    function confirmTypeAdd() {
      if (state.missingTypeAdd.loading) return Promise.resolve(null);
      var projectId = state.missingTypeAdd.projectId || state.missingDrawer.projectId;
      if (!projectId) {
        view.setTypeAddStatus('请先选择项目', 'warn');
        return Promise.resolve(null);
      }
      var name = view.getTypeName();
      if (!name) {
        view.setTypeAddStatus('请输入类型名', 'warn');
        return Promise.resolve(null);
      }
      if (!apiClient || typeof apiClient.createMissingType !== 'function') {
        view.setTypeAddStatus('易漏类型接口未就绪', 'err');
        return Promise.resolve(null);
      }
      state.missingTypeAdd.loading = true;
      view.setTypeAddStatus('添加中...', '');
      return apiClient.createMissingType({ project_id: projectId, name: name }).then(function(created) {
        var row = created && typeof created === 'object' ? created : null;
        if (row && row.id) {
          state.missingType.types = Array.isArray(state.missingType.types) ? state.missingType.types : [];
          state.missingType.types.push(row);
          state.missingType.types.sort(function(a, b) { return Number(a.id) - Number(b.id); });
          normalizeTypeSelection();
          refreshTypeUi();
          if (state.missingView && Array.isArray(state.missingView.items)) refreshTypeCells();
        }
        if (typeAddDrawer && typeof typeAddDrawer.close === 'function') typeAddDrawer.close();
        if (state.missingTypeAdd.source !== 'view') {
          var mainDrawer = getMainDrawer();
          if (mainDrawer && typeof mainDrawer.open === 'function') mainDrawer.open();
        }
        showToast('添加成功', 'ok', 3000);
        return row;
      }).catch(function(err) {
        if (model.isTypeDuplicateError(err)) {
          showToast('已有同名类型，添加失败', 'warn', 3000);
          return null;
        }
        view.setTypeAddStatus(err && err.message ? err.message : '添加失败', 'err');
        return null;
      }).finally(function() {
        state.missingTypeAdd.loading = false;
      });
    }

    function renderTypeManage() {
      view.renderTypeManage(state.missingType.types, isAdminUser());
    }

    function removeTypeById(typeId, transferId, movedCount) {
      var id = String(typeId || '');
      if (!id) return;
      var list = Array.isArray(state.missingType.types) ? state.missingType.types : [];
      state.missingType.types = list.filter(function(type) { return type && String(type.id) !== id; });
      if (transferId) {
        var moved = Number(movedCount);
        if (!Number.isFinite(moved) || moved < 0) moved = 0;
        state.missingType.types.forEach(function(type) {
          if (!type || String(type.id) !== String(transferId)) return;
          var current = Number(type.item_count);
          if (!Number.isFinite(current) || current < 0) current = 0;
          type.item_count = current + moved;
        });
      }
      state.missingType.selection = state.missingType.selection instanceof Set ? state.missingType.selection : new Set();
      state.missingType.selection.delete(id);
      normalizeTypeSelection();
      if (state.missingView && state.missingView.typeFilters instanceof Set) state.missingView.typeFilters.delete(id);
      if (transferId && state.missingView && Array.isArray(state.missingView.items)) {
        state.missingView.items.forEach(function(item) {
          if (!item) return;
          var slots = ensureItemTypeSlots(item).slice();
          var next = [];
          var removed = false;
          slots.forEach(function(value) {
            var normalized = normalizeTypeId(value);
            if (normalized && String(normalized) === id) removed = true;
            else next.push(value);
          });
          if (!removed) return;
          var transferKey = String(transferId);
          if (!next.some(function(value) { return String(value) === transferKey; })) next.push(transferKey);
          if (!next.length) next = [''];
          item.type_ids = next;
          item.type_names = resolveItemTypeNames(
            normalizeTypeIds(next),
            item.type_names || (item.type_name ? [item.type_name] : [])
          );
          item.type_name = formatItemTypeLabel(item);
        });
        renderTypePills(state.missingView.items);
        refreshTypeCells();
      }
      refreshTypeUi();
      if (state.missingView && Array.isArray(state.missingView.items)) {
        renderTypePills(state.missingView.items);
        refreshTypeCells();
      }
      if (state.missingDrawer.projectId) drawerController.loadModules(state.missingDrawer.projectId);
    }

    function requestDeleteType(missingType, anchorEl) {
      if (!missingType || missingType.id === null || missingType.id === undefined) return Promise.resolve(null);
      if (!isAdminUser()) {
        view.setTypeManageStatus('仅管理员可删除类型', 'warn');
        return Promise.resolve(null);
      }
      if (!apiClient || typeof apiClient.deleteMissingType !== 'function') {
        view.setTypeManageStatus('易漏类型接口未就绪', 'err');
        return Promise.resolve(null);
      }
      return openConfirmDrawer({
        title: '确认删除类型',
        message: '确认删除类型【' + (missingType.name || ('类型#' + missingType.id)) + '】吗？',
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
        previousDrawer: typeManageDrawer || null,
      }).then(function(result) {
        if (!result || result.ok !== true) return null;
        var anchorRect = captureAnchor(anchorEl);
        if (anchorRect) showBlockHint(anchorRect, '删除处理中...');
        return apiClient.deleteMissingType(missingType.id).then(function(response) {
          var moved = response && typeof response.moved_count === 'number' ? response.moved_count : 0;
          removeTypeById(missingType.id, null, moved);
          showToast('删除类型成功', 'ok', 3000);
          return response;
        }).catch(function(err) {
          var inUse = model.readTypeInUseError(err);
          if (!inUse) {
            view.setTypeManageStatus(err && err.message ? err.message : '删除类型失败', 'err');
            return null;
          }
          var types = Array.isArray(state.missingType.types) ? state.missingType.types : [];
          var options = model.buildTypeTransferOptions(types, missingType.id);
          if (!options.length) {
            openConfirmDrawer({
              title: '暂无可转移类型',
              message: '该类型下已有易漏用例，无法删除。',
              hint: '暂无可转移类型。新增类型后重新操作即可。',
              hintType: 'err',
              confirmText: '知道了',
              cancelText: '关闭',
              previousDrawer: typeManageDrawer || null,
            });
            view.setTypeManageStatus('暂无可转移类型，请先新增类型', 'warn');
            return null;
          }
          return openConfirmDrawer({
            title: '转移用例并删除类型',
            message: '该类型下已有 ' + (inUse.count || 0) + ' 条易漏用例，请选择要转移到的类型后删除。',
            confirmText: '确认删除',
            cancelText: '取消',
            previousDrawer: typeManageDrawer || null,
            input: {
              type: 'select',
              label: '转移到类型',
              placeholder: '请选择类型',
              required: true,
              options: options,
            },
          }).then(function(transferResult) {
            if (!transferResult || transferResult.ok !== true) return null;
            var transferId = transferResult.value ? String(transferResult.value).trim() : '';
            if (!transferId) {
              view.setTypeManageStatus('未选择转移类型，已取消删除', '');
              return null;
            }
            var target = types.find(function(type) { return type && String(type.id) === transferId; });
            if (!target) {
              view.setTypeManageStatus('转移类型不存在，请刷新后重试', 'err');
              return null;
            }
            return apiClient.deleteMissingType(missingType.id, transferId).then(function(response) {
              var movedCount = response && typeof response.moved_count === 'number' ? response.moved_count : 0;
              removeTypeById(missingType.id, transferId, movedCount);
              showToast('已转移用例并删除类型', 'ok', 3000);
              return response;
            }).catch(function(transferErr) {
              view.setTypeManageStatus(transferErr && transferErr.message ? transferErr.message : '删除类型失败', 'err');
              return null;
            });
          });
        });
      });
    }

    function openModuleAdd() {
      initDrawers();
      var projectId = state.missingDrawer.projectId;
      if (!projectId) {
        view.setDrawerStatus('请先选择项目', 'warn');
        return;
      }
      state.missingAdd.projectId = projectId;
      view.prepareModuleAdd(getProjectName(projectId));
      if (moduleAddDrawer && typeof moduleAddDrawer.open === 'function') moduleAddDrawer.open();
    }

    function openModuleEdit(module) {
      initDrawers();
      if (!module || !module.id) {
        view.setDrawerStatus('模块信息缺失', 'warn');
        return;
      }
      state.missingEdit.moduleId = module.id;
      state.missingEdit.projectId = module.project_id;
      state.missingEdit.name = module.name || '';
      view.prepareModuleEdit(getProjectName(module.project_id), module.name || '');
      if (moduleEditDrawer && typeof moduleEditDrawer.open === 'function') moduleEditDrawer.open();
    }

    function applyModuleNameUpdate(moduleId, nextName) {
      var id = String(moduleId || '');
      if (!id) return;
      var normalized = String(nextName || '').trim();
      (Array.isArray(state.missingDrawer.modules) ? state.missingDrawer.modules : []).forEach(function(module) {
        if (module && String(module.id) === id) module.name = normalized;
      });
      if (state.missingView && Array.isArray(state.missingView.modules)) {
        state.missingView.modules.forEach(function(module) {
          if (module && String(module.id) === id) module.name = normalized;
        });
      }
      if (state.missingView && Array.isArray(state.missingView.items)) {
        state.missingView.items.forEach(function(item) {
          if (item && String(item.module_id) === id) item.module_name = normalized;
        });
      }
      drawerController.refreshModules();
      refreshMissingViewDetails();
    }

    function removeModulesByIds(ids) {
      var idList = Array.isArray(ids) ? ids.map(function(value) { return String(value); }) : [];
      if (!idList.length) return;
      var idMap = {};
      idList.forEach(function(id) { if (id) idMap[id] = true; });
      state.missingDrawer.modules = (Array.isArray(state.missingDrawer.modules) ? state.missingDrawer.modules : []).filter(function(module) {
        return !module || !module.id || !idMap[String(module.id)];
      });
      if (state.missingDrawer.moduleCompletion && typeof state.missingDrawer.moduleCompletion === 'object') {
        idList.forEach(function(id) { delete state.missingDrawer.moduleCompletion[id]; });
      }
      if (state.missingDrawer.moduleCompletionLoading && typeof state.missingDrawer.moduleCompletionLoading === 'object') {
        idList.forEach(function(id) { delete state.missingDrawer.moduleCompletionLoading[id]; });
      }
      state.missingDrawer.selection = state.missingDrawer.selection instanceof Set ? state.missingDrawer.selection : new Set();
      idList.forEach(function(id) { state.missingDrawer.selection.delete(id); });
      if (state.missingDrawer.moduleId && idMap[String(state.missingDrawer.moduleId)]) state.missingDrawer.moduleId = null;
      drawerController.refreshModules();
      if (state.missingView && Array.isArray(state.missingView.modules) && state.missingView.modules.length) {
        var remaining = state.missingView.modules.filter(function(module) {
          return !module || !module.id || !idMap[String(module.id)];
        });
        state.missingView.modules = remaining;
        state.missingView.moduleIds = remaining.map(function(module) {
          return module && module.id ? module.id : null;
        }).filter(function(value) { return value !== null; });
        if (Array.isArray(state.missingView.items)) {
          state.missingView.items = state.missingView.items.filter(function(item) {
            return !item || item.module_id === null || item.module_id === undefined || !idMap[String(item.module_id)];
          });
        }
        state.missingView.selection = new Set();
        if (state.missingView.pageIndex) state.missingView.pageIndex = 0;
        refreshMissingViewDetails();
      }
      if (state.missingView && Array.isArray(state.missingView.modules) && state.missingView.modules.length) {
        persistMissingView();
      } else {
        clearMissingViewPersistence();
      }
    }

    function confirmModuleAdd() {
      if (state.missingAdd.loading) return Promise.resolve(null);
      var projectId = state.missingAdd.projectId || state.missingDrawer.projectId;
      if (!projectId) {
        view.setModuleAddStatus('请先选择项目', 'warn');
        return Promise.resolve(null);
      }
      var name = view.getModuleAddName();
      if (!name) {
        view.setModuleAddStatus('请输入模块名', 'warn');
        return Promise.resolve(null);
      }
      if (!apiClient || typeof apiClient.createMissingModule !== 'function') {
        view.setModuleAddStatus('易漏模块接口未就绪', 'err');
        return Promise.resolve(null);
      }
      state.missingAdd.loading = true;
      view.setModuleAddStatus('添加中...', '');
      return apiClient.createMissingModule({ project_id: projectId, name: name }).then(function(created) {
        var module = created && typeof created === 'object' ? created : null;
        if (module && module.id) {
          state.missingDrawer.modules = Array.isArray(state.missingDrawer.modules) ? state.missingDrawer.modules : [];
          state.missingDrawer.modules.push(module);
          drawerController.refreshModules();
        }
        if (moduleAddDrawer && typeof moduleAddDrawer.close === 'function') moduleAddDrawer.close();
        var mainDrawer = getMainDrawer();
        if (mainDrawer && typeof mainDrawer.open === 'function') mainDrawer.open();
        showToast('添加成功', 'ok', 3000);
        return module;
      }).catch(function(err) {
        if (model.isModuleDuplicateError(err)) {
          showToast('已有同名模块，添加失败', 'warn', 3000);
          return null;
        }
        view.setModuleAddStatus(err && err.message ? err.message : '添加失败', 'err');
        return null;
      }).finally(function() {
        state.missingAdd.loading = false;
      });
    }

    function confirmModuleEdit() {
      if (state.missingEdit.loading) return Promise.resolve(null);
      var moduleId = state.missingEdit.moduleId;
      if (!moduleId) {
        view.setModuleEditStatus('未选择模块', 'warn');
        return Promise.resolve(null);
      }
      var name = view.getModuleEditName();
      if (!name) {
        view.setModuleEditStatus('请输入模块名', 'warn');
        return Promise.resolve(null);
      }
      if (!apiClient || typeof apiClient.updateMissingModule !== 'function') {
        view.setModuleEditStatus('易漏模块接口未就绪', 'err');
        return Promise.resolve(null);
      }
      state.missingEdit.loading = true;
      view.setModuleEditStatus('保存中...', '');
      return apiClient.updateMissingModule(moduleId, { name: name }).then(function(updated) {
        var nextName = updated && updated.name ? String(updated.name) : name;
        applyModuleNameUpdate(moduleId, nextName);
        if (moduleEditDrawer && typeof moduleEditDrawer.close === 'function') moduleEditDrawer.close();
        var mainDrawer = getMainDrawer();
        if (mainDrawer && typeof mainDrawer.open === 'function') mainDrawer.open();
        showToast('修改成功', 'ok', 3000);
        return updated;
      }).catch(function(err) {
        if (model.isModuleDuplicateError(err)) {
          showToast('已有同名模块，修改失败', 'warn', 3000);
          return null;
        }
        view.setModuleEditStatus(err && err.message ? err.message : '保存失败', 'err');
        return null;
      }).finally(function() {
        state.missingEdit.loading = false;
      });
    }

    function deleteSelectedModules(anchorEl) {
      if (state.missingDrawer.processing) return Promise.resolve(null);
      if (!canDeleteModules()) {
        showToast('权限不足，请联系管理员或者组长进行操作。', 'warn', 3000);
        return Promise.resolve(null);
      }
      if (!apiClient || typeof apiClient.deleteMissingModule !== 'function') {
        view.setDrawerStatus('易漏模块接口未就绪', 'err');
        return Promise.resolve(null);
      }
      var modules = drawerController.getSelectedModules();
      if (!modules.length) {
        view.setDrawerStatus('请先勾选需要删除的模块', 'warn');
        return Promise.resolve(null);
      }
      return openConfirmDrawer({
        title: '确认删除模块',
        message: '确定删除已勾选的 ' + modules.length + ' 个模块吗？该模块下的易漏条目也会一并删除。',
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
        previousDrawer: getMainDrawer() || null,
      }).then(function(result) {
        if (!result || result.ok !== true) return null;
        var anchorRect = captureAnchor(anchorEl);
        if (anchorRect) showBlockHint(anchorRect, '删除处理中...');
        state.missingDrawer.processing = true;
        drawerController.syncControls();
        view.setDrawerStatus('删除模块中...', '');
        var entries = modules.map(function(module) {
          return { id: module && module.id ? module.id : null, name: module && module.name ? module.name : '' };
        }).filter(function(module) { return module.id !== null && module.id !== undefined; });
        var tasks = entries.map(function(entry) {
          return Promise.resolve(apiClient.deleteMissingModule(entry.id)).then(
            function(value) { return { status: 'fulfilled', value: value }; },
            function(err) { return { status: 'rejected', reason: err }; }
          );
        });
        return Promise.all(tasks).then(function(results) {
          var successIds = [];
          var failures = [];
          results.forEach(function(item, index) {
            if (item && item.status === 'fulfilled') successIds.push(entries[index].id);
            else failures.push(entries[index]);
          });
          if (successIds.length) removeModulesByIds(successIds);
          if (!failures.length) view.setDrawerStatus('已删除 ' + successIds.length + ' 个模块', 'ok');
          else view.setDrawerStatus('删除部分失败：成功 ' + successIds.length + ' 个，失败 ' + failures.length + ' 个', 'warn');
          return { successIds: successIds, failures: failures };
        }).catch(function(err) {
          view.setDrawerStatus(err && err.message ? err.message : '删除失败', 'err');
          return null;
        }).finally(function() {
          state.missingDrawer.processing = false;
          drawerController.syncControls();
        });
      });
    }

    function bindEvents() {
      if (bound) return;
      bound = true;
      if (opts.dom && opts.dom.missingAddConfirmBtn) {
        opts.dom.missingAddConfirmBtn.addEventListener('click', confirmModuleAdd);
      }
      if (opts.dom && opts.dom.missingEditConfirmBtn) {
        opts.dom.missingEditConfirmBtn.addEventListener('click', confirmModuleEdit);
      }
    }

    return {
      initDrawers: initDrawers,
      bindEvents: bindEvents,
      refreshTypeUi: refreshTypeUi,
      renderTypeManage: renderTypeManage,
      openTypeAdd: openTypeAdd,
      openTypeManage: openTypeManage,
      confirmTypeAdd: confirmTypeAdd,
      removeTypeById: removeTypeById,
      requestDeleteType: requestDeleteType,
      openModuleAdd: openModuleAdd,
      openModuleEdit: openModuleEdit,
      applyModuleNameUpdate: applyModuleNameUpdate,
      removeModulesByIds: removeModulesByIds,
      confirmModuleAdd: confirmModuleAdd,
      confirmModuleEdit: confirmModuleEdit,
      deleteSelectedModules: deleteSelectedModules,
    };
  }

  return { create: create };
});
