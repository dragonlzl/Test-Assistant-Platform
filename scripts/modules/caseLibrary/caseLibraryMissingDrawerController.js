(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.missingDrawerController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var apiClient = opts.apiClient || null;
    var model = opts.model || null;
    var view = opts.view || null;
    var missingImportController = opts.missingImportController || null;
    if (!model || !view || !missingImportController) throw new Error('Missing drawer owners are required');

    var normalizeId = typeof opts.normalizeId === 'function' ? opts.normalizeId : function(value) { return value || null; };
    var normalizeTypeSelection = typeof opts.normalizeTypeSelection === 'function'
      ? opts.normalizeTypeSelection
      : function() {};
    var persistProject = typeof opts.persistProject === 'function' ? opts.persistProject : function() {};
    var readPersistedState = typeof opts.readPersistedState === 'function' ? opts.readPersistedState : function() { return null; };
    var clearPersistedState = typeof opts.clearPersistedState === 'function' ? opts.clearPersistedState : function() {};
    var getCurrentUserId = typeof opts.getCurrentUserId === 'function' ? opts.getCurrentUserId : function() { return null; };
    var getCurrentLoginSeq = typeof opts.getCurrentLoginSeq === 'function' ? opts.getCurrentLoginSeq : function() { return null; };
    var getProjects = typeof opts.getProjects === 'function' ? opts.getProjects : function() { return []; };
    var getPageSize = typeof opts.getPageSize === 'function' ? opts.getPageSize : function() { return 20; };
    var onTypesChanged = typeof opts.onTypesChanged === 'function' ? opts.onTypesChanged : function() {};
    var onOpenTypeAdd = typeof opts.onOpenTypeAdd === 'function' ? opts.onOpenTypeAdd : function() {};
    var onOpenTypeManage = typeof opts.onOpenTypeManage === 'function' ? opts.onOpenTypeManage : function() {};
    var onAddModule = typeof opts.onAddModule === 'function' ? opts.onAddModule : function() {};
    var onViewModules = typeof opts.onViewModules === 'function' ? opts.onViewModules : function() {};
    var onEditModule = typeof opts.onEditModule === 'function' ? opts.onEditModule : function() {};
    var onDeleteModules = typeof opts.onDeleteModules === 'function' ? opts.onDeleteModules : function() {};
    var onExportXmind = typeof opts.onExportXmind === 'function' ? opts.onExportXmind : function() {};
    var onExportExcel = typeof opts.onExportExcel === 'function' ? opts.onExportExcel : function() {};
    var onConfirmTypeAdd = typeof opts.onConfirmTypeAdd === 'function' ? opts.onConfirmTypeAdd : function() {};
    var onDeleteType = typeof opts.onDeleteType === 'function' ? opts.onDeleteType : function() {};
    var bound = false;

    function getDrawerState() {
      return state.missingDrawer;
    }

    function getTypeState() {
      return state.missingType;
    }

    function buildSnapshot() {
      var drawer = getDrawerState();
      var snapshot = model.buildSnapshot(drawer);
      drawer.pageIndex = snapshot.page.pageIndex;
      drawer.selection = snapshot.selection;
      return snapshot;
    }

    function renderTypeFilters() {
      view.renderTypeFilters(getTypeState());
    }

    function syncTypeCatalog() {
      view.syncTypeSelect(getTypeState());
      renderTypeFilters();
    }

    function getTypeFilterIds() {
      return model.getTypeFilterIds(getTypeState());
    }

    function syncControls() {
      var snapshot = buildSnapshot();
      view.syncControls(snapshot);
      return snapshot;
    }

    function render() {
      var drawer = getDrawerState();
      var snapshot = buildSnapshot();
      view.renderList(drawer, snapshot);
      if (drawer.projectId && !drawer.loading && snapshot.total) syncModuleCompletion(snapshot.list);
      return snapshot;
    }

    function refreshModules() {
      var drawer = getDrawerState();
      drawer.moduleId = view.syncModuleSelect(drawer);
      return render();
    }

    function getSelectedModules() {
      var drawer = getDrawerState();
      var selection = drawer.selection instanceof Set ? drawer.selection : new Set();
      return (Array.isArray(drawer.modules) ? drawer.modules : []).filter(function(module) {
        return module && selection.has(String(module.id));
      });
    }

    function reset() {
      var drawer = getDrawerState();
      drawer.projectId = null;
      drawer.moduleId = null;
      drawer.modules = [];
      drawer.loading = false;
      drawer.processing = false;
      drawer.selection = new Set();
      drawer.pageIndex = 0;
      drawer.moduleCompletion = {};
      drawer.moduleCompletionLoading = {};
      drawer.moduleCompletionSeq = (drawer.moduleCompletionSeq || 0) + 1;
      var typeState = getTypeState();
      typeState.projectId = null;
      typeState.types = [];
      typeState.loading = false;
      typeState.selection = new Set();
      view.reset();
      missingImportController.reset();
    }

    function prepare() {
      var drawer = getDrawerState();
      view.prepareProjectOptions();
      missingImportController.prepareProjectOptions();
      var projectId = drawer.projectId || missingImportController.getProjectId() || null;
      if (!projectId) {
        var persisted = readPersistedState();
        if (persisted) {
          var userId = getCurrentUserId();
          var loginSeq = getCurrentLoginSeq();
          var validUser = userId && String(persisted.user_id || '') === String(userId);
          var validLogin = loginSeq && String(persisted.login_seq || '') === String(loginSeq);
          if (validUser || validLogin) {
            var persistedProjectId = normalizeId(persisted.project_id);
            if (persistedProjectId) {
              var projects = getProjects();
              var projectsLoaded = Boolean(projects && projects.length);
              if (!projectsLoaded || projects.some(function(project) {
                return project && String(project.id) === String(persistedProjectId);
              })) {
                projectId = persistedProjectId;
              } else {
                clearPersistedState();
              }
            }
          }
        }
      }
      drawer.projectId = projectId;
      missingImportController.setProjectId(projectId);
      if (!projectId) {
        reset();
        return;
      }
      view.setProjectValue(projectId);
      loadTypes(projectId);
      loadModules(projectId);
    }

    function loadTypes(projectId) {
      var typeState = getTypeState();
      if (!apiClient || typeof apiClient.listMissingTypes !== 'function') {
        view.setDrawerStatus('易漏类型接口未就绪', 'err');
        return Promise.resolve([]);
      }
      typeState.loading = true;
      renderTypeFilters();
      return apiClient.listMissingTypes(projectId).then(function(list) {
        typeState.projectId = projectId;
        typeState.types = Array.isArray(list) ? list : [];
        normalizeTypeSelection();
        onTypesChanged();
        return typeState.types;
      }).catch(function(err) {
        typeState.projectId = projectId || null;
        typeState.types = [];
        normalizeTypeSelection();
        onTypesChanged();
        view.setDrawerStatus(err && err.message ? err.message : '加载类型失败', 'err');
        return [];
      }).finally(function() {
        typeState.loading = false;
        renderTypeFilters();
      });
    }

    function loadModules(projectId) {
      var drawer = getDrawerState();
      if (!apiClient || typeof apiClient.listMissingModules !== 'function') {
        view.setDrawerStatus('易漏模块接口未就绪', 'err');
        return Promise.resolve([]);
      }
      drawer.processing = false;
      drawer.loading = true;
      drawer.moduleCompletion = {};
      drawer.moduleCompletionLoading = {};
      drawer.moduleCompletionSeq = (drawer.moduleCompletionSeq || 0) + 1;
      view.setDrawerStatus('加载易漏模块...', '');
      render();
      return apiClient.listMissingModules(projectId, {
        type_ids: model.getTypeFilterIds(getTypeState()),
      }).then(function(list) {
        drawer.modules = Array.isArray(list) ? list : [];
        drawer.moduleId = view.syncModuleSelect(drawer);
        return drawer.modules;
      }).catch(function(err) {
        drawer.modules = [];
        view.clearModuleSelect();
        view.setDrawerStatus(err && err.message ? err.message : '加载失败', 'err');
        return [];
      }).finally(function() {
        drawer.loading = false;
        render();
      });
    }

    function handleProjectChange() {
      var drawer = getDrawerState();
      var projectId = normalizeId(view.getProjectValue());
      persistProject(projectId);
      drawer.projectId = projectId;
      missingImportController.setProjectId(projectId);
      drawer.moduleId = null;
      drawer.modules = [];
      drawer.selection = new Set();
      drawer.pageIndex = 0;
      drawer.processing = false;
      drawer.moduleCompletion = {};
      drawer.moduleCompletionLoading = {};
      drawer.moduleCompletionSeq = (drawer.moduleCompletionSeq || 0) + 1;
      var typeState = getTypeState();
      typeState.projectId = projectId;
      typeState.types = [];
      typeState.loading = false;
      typeState.selection = new Set();
      if (!projectId) {
        view.showNoProject();
        render();
        return;
      }
      view.showTypeLoading();
      loadTypes(projectId);
      loadModules(projectId);
    }

    function handleModuleChange() {
      var drawer = getDrawerState();
      drawer.moduleId = normalizeId(view.getModuleValue());
      drawer.pageIndex = 0;
      render();
    }

    function handleTypeSelectChange() {
      var value = String(view.getTypeValue() || '');
      if (!value) return;
      if (value === '__add_type__') {
        view.clearTypeValue();
        onOpenTypeAdd();
        return;
      }
      var typeState = getTypeState();
      typeState.selection = typeState.selection instanceof Set ? typeState.selection : new Set();
      if (typeState.selection.has(value)) typeState.selection.delete(value);
      else typeState.selection.add(value);
      normalizeTypeSelection();
      view.clearTypeValue();
      renderTypeFilters();
      var drawer = getDrawerState();
      drawer.selection = new Set();
      drawer.pageIndex = 0;
      if (drawer.projectId) loadModules(drawer.projectId);
    }

    function handleTypeFilterChange(target) {
      if (!target || !target.getAttribute) return;
      var key = target.getAttribute('data-case-lib-missing-type');
      if (!key) return;
      var typeState = getTypeState();
      typeState.selection = typeState.selection instanceof Set ? typeState.selection : new Set();
      if (key === '__all__') typeState.selection.clear();
      else if (target.checked) typeState.selection.add(String(key));
      else typeState.selection.delete(String(key));
      normalizeTypeSelection();
      renderTypeFilters();
      var drawer = getDrawerState();
      drawer.selection = new Set();
      drawer.pageIndex = 0;
      if (drawer.projectId) loadModules(drawer.projectId);
    }

    function setPageSelection(checked) {
      var drawer = getDrawerState();
      drawer.selection = model.setPageSelection(buildSnapshot(), checked);
      render();
    }

    function setModuleSelection(moduleId, checked) {
      var drawer = getDrawerState();
      drawer.selection = drawer.selection instanceof Set ? drawer.selection : new Set();
      if (checked) drawer.selection.add(String(moduleId));
      else drawer.selection.delete(String(moduleId));
      syncControls();
    }

    function handlePaginationAction(action) {
      var drawer = getDrawerState();
      var total = model.getVisibleModules(drawer).length;
      var totalPages = total ? Math.ceil(total / getPageSize()) : 1;
      if (action === 'prev') drawer.pageIndex = Math.max(0, drawer.pageIndex - 1);
      if (action === 'next') drawer.pageIndex = Math.min(totalPages - 1, drawer.pageIndex + 1);
      render();
    }

    function handlePaginationJump(page) {
      var drawer = getDrawerState();
      var total = model.getVisibleModules(drawer).length;
      var totalPages = total ? Math.ceil(total / getPageSize()) : 1;
      var target = Math.max(1, Math.min(Number(page) || 1, totalPages));
      drawer.pageIndex = Math.max(0, target - 1);
      render();
    }

    function syncModuleCompletion(modules) {
      if (!apiClient || typeof apiClient.listMissingModuleItems !== 'function') return;
      var drawer = getDrawerState();
      drawer.moduleCompletion = drawer.moduleCompletion && typeof drawer.moduleCompletion === 'object'
        ? drawer.moduleCompletion
        : {};
      drawer.moduleCompletionLoading = drawer.moduleCompletionLoading && typeof drawer.moduleCompletionLoading === 'object'
        ? drawer.moduleCompletionLoading
        : {};
      var completionMap = drawer.moduleCompletion;
      var loadingMap = drawer.moduleCompletionLoading;
      var seq = drawer.moduleCompletionSeq || 0;
      var toLoad = [];
      (modules || []).forEach(function(module) {
        var id = module && module.id ? String(module.id) : '';
        if (!id) return;
        var count = Number(module && module.item_count);
        if (Number.isFinite(count) && count <= 0) {
          completionMap[id] = false;
          return;
        }
        if (Object.prototype.hasOwnProperty.call(completionMap, id) || loadingMap[id]) return;
        toLoad.push(id);
      });
      if (!toLoad.length) return;
      toLoad.forEach(function(id) { loadingMap[id] = true; });
      Promise.all(toLoad.map(function(id) {
        return apiClient.listMissingModuleItems(id).then(function(items) {
          if (drawer.moduleCompletionSeq === seq) completionMap[id] = model.isModuleComplete(items);
        }).catch(function() {
          if (drawer.moduleCompletionSeq === seq) completionMap[id] = false;
        }).finally(function() {
          if (drawer.moduleCompletionSeq === seq) delete loadingMap[id];
        });
      })).then(function() {
        if (drawer.moduleCompletionSeq === seq) render();
      });
    }

    function bindEvents() {
      if (bound) return;
      bound = true;
      if (dom.missingDrawerProjectSelect) dom.missingDrawerProjectSelect.addEventListener('change', handleProjectChange);
      if (dom.missingDrawerModuleSelect) dom.missingDrawerModuleSelect.addEventListener('change', handleModuleChange);
      if (dom.missingDrawerTypeSelect) dom.missingDrawerTypeSelect.addEventListener('change', handleTypeSelectChange);
      if (dom.missingDrawerTypeAddBtn) {
        dom.missingDrawerTypeAddBtn.addEventListener('click', function() { onOpenTypeAdd('drawer'); });
      }
      if (dom.missingDrawerTypeManageBtn) dom.missingDrawerTypeManageBtn.addEventListener('click', onOpenTypeManage);
      if (dom.missingDrawerTypeGrid) {
        dom.missingDrawerTypeGrid.addEventListener('change', function(event) {
          handleTypeFilterChange(event && event.target ? event.target : null);
        });
      }
      if (dom.missingDrawerQueryBtn) {
        dom.missingDrawerQueryBtn.addEventListener('click', function() {
          var projectId = getDrawerState().projectId;
          if (!projectId) {
            view.setDrawerStatus('请先选择项目', 'warn');
            return;
          }
          loadModules(projectId);
        });
      }
      if (dom.missingDrawerAddModuleBtn) dom.missingDrawerAddModuleBtn.addEventListener('click', onAddModule);
      if (dom.missingDrawerBatchViewBtn) {
        dom.missingDrawerBatchViewBtn.addEventListener('click', function() { onViewModules(getSelectedModules()); });
      }
      if (dom.missingDrawerDeleteBtn) {
        dom.missingDrawerDeleteBtn.addEventListener('click', function(event) {
          onDeleteModules(event && event.currentTarget ? event.currentTarget : null);
        });
      }
      if (dom.missingDrawerExportXmindBtn) dom.missingDrawerExportXmindBtn.addEventListener('click', onExportXmind);
      if (dom.missingDrawerExportExcelBtn) dom.missingDrawerExportExcelBtn.addEventListener('click', onExportExcel);
      if (dom.missingDrawerSelectAll) {
        dom.missingDrawerSelectAll.addEventListener('change', function() {
          setPageSelection(Boolean(dom.missingDrawerSelectAll.checked));
        });
      }
      if (dom.missingDrawerListBody) {
        dom.missingDrawerListBody.addEventListener('change', function(event) {
          var target = event && event.target ? event.target : null;
          if (!target || !target.getAttribute) return;
          var id = target.getAttribute('data-case-lib-missing-select');
          if (id) setModuleSelection(id, target.checked);
        });
        dom.missingDrawerListBody.addEventListener('click', function(event) {
          var target = event && event.target ? event.target : null;
          var viewButton = target && target.closest ? target.closest('[data-case-lib-missing-view]') : null;
          if (viewButton) {
            var module = model.findModuleById(getDrawerState().modules, viewButton.getAttribute('data-case-lib-missing-view'));
            if (module) onViewModules([module]);
            return;
          }
          var editButton = target && target.closest ? target.closest('[data-case-lib-missing-edit]') : null;
          if (!editButton) return;
          var editModule = model.findModuleById(getDrawerState().modules, editButton.getAttribute('data-case-lib-missing-edit'));
          if (editModule) onEditModule(editModule);
        });
      }
      if (dom.missingTypeAddConfirmBtn) dom.missingTypeAddConfirmBtn.addEventListener('click', onConfirmTypeAdd);
      if (dom.missingTypeManageBody) {
        dom.missingTypeManageBody.addEventListener('click', function(event) {
          var button = event && event.target && event.target.closest
            ? event.target.closest('[data-case-lib-missing-type-delete]')
            : null;
          if (!button) return;
          var type = model.findModuleById(getTypeState().types, button.getAttribute('data-case-lib-missing-type-delete'));
          if (type) onDeleteType(type, button);
        });
      }
    }

    return {
      getDrawerState: getDrawerState,
      getTypeState: getTypeState,
      getSelectedModules: getSelectedModules,
      getTypeFilterIds: getTypeFilterIds,
      renderTypeFilters: renderTypeFilters,
      syncTypeCatalog: syncTypeCatalog,
      syncControls: syncControls,
      render: render,
      refreshModules: refreshModules,
      reset: reset,
      prepare: prepare,
      loadTypes: loadTypes,
      loadModules: loadModules,
      handleProjectChange: handleProjectChange,
      handleModuleChange: handleModuleChange,
      handleTypeSelectChange: handleTypeSelectChange,
      handleTypeFilterChange: handleTypeFilterChange,
      setPageSelection: setPageSelection,
      setModuleSelection: setModuleSelection,
      handlePaginationAction: handlePaginationAction,
      handlePaginationJump: handlePaginationJump,
      syncModuleCompletion: syncModuleCompletion,
      bindEvents: bindEvents,
    };
  }

  return { create: create };
});
