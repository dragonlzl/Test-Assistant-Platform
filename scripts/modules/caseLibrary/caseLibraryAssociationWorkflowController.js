(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.associationWorkflowController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var apiClient = opts.apiClient || null;
    var model = opts.model || null;
    var view = opts.view || null;
    if (!model || !view) throw new Error('Case library association workflow owners are required');

    var getListController = typeof opts.getListController === 'function' ? opts.getListController : function() { return null; };
    var getCandidateController = typeof opts.getCandidateController === 'function' ? opts.getCandidateController : function() { return null; };
    var getItemController = typeof opts.getItemController === 'function' ? opts.getItemController : function() { return null; };
    var getSelectController = typeof opts.getSelectController === 'function' ? opts.getSelectController : function() { return null; };
    var getDrawers = typeof opts.getDrawers === 'function' ? opts.getDrawers : function() { return {}; };
    var loadVersions = typeof opts.loadVersions === 'function' ? opts.loadVersions : function() { return Promise.resolve([]); };
    var normalizeId = typeof opts.normalizeId === 'function' ? opts.normalizeId : function(value) { return value || null; };
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function'
      ? opts.openConfirmDrawer
      : function() { return Promise.resolve({ ok: false }); };
    var showToast = typeof opts.showToast === 'function' ? opts.showToast : function() {};
    var resolveAssociationDecision = typeof opts.resolveAssociationDecision === 'function'
      ? opts.resolveAssociationDecision
      : function() { return { associationEnabled: false, requiresConfirmation: false }; };
    var isDrawerOpen = typeof opts.isDrawerOpen === 'function'
      ? opts.isDrawerOpen
      : function(instance) {
        return Boolean(instance && instance.element && instance.element.classList && instance.element.classList.contains('open'));
      };

    function getMainState() {
      if (!state.associationDrawer || typeof state.associationDrawer !== 'object') state.associationDrawer = {};
      return state.associationDrawer;
    }

    function getPickState() {
      if (!state.associationPickDrawer || typeof state.associationPickDrawer !== 'object') state.associationPickDrawer = {};
      var pick = state.associationPickDrawer;
      if (!Array.isArray(pick.originalSelectedCaseItemIds)) pick.originalSelectedCaseItemIds = [];
      return pick;
    }

    function syncAddButton() {
      var controller = getListController();
      var controllerState = controller ? controller.getState() : { loading: false };
      var main = getMainState();
      view.syncAddButton(Boolean(controllerState.loading || main.processing || !main.caseFile));
    }

    function resetMain() {
      var main = getMainState();
      main.caseFile = null;
      main.processing = false;
      main.previousDrawer = null;
      main.pendingAction = '';
      main.pendingAssociationId = null;
      view.resetMain();
      var controller = getListController();
      if (controller) controller.reset();
      syncAddButton();
    }

    function loadMainRows(caseFileId) {
      var controller = getListController();
      if (!controller) return Promise.resolve([]);
      if (!apiClient || typeof apiClient.listCaseFileAssociations !== 'function') {
        controller.setData([], { mainCaseFileId: caseFileId });
        return Promise.resolve([]);
      }
      return apiClient.listCaseFileAssociations(caseFileId).then(function(rows) {
        controller.setData(Array.isArray(rows) ? rows : [], { mainCaseFileId: caseFileId });
        return controller.getRows();
      });
    }

    function openFromSelect(caseFile) {
      if (!caseFile || !caseFile.id) return Promise.resolve(false);
      var drawers = getDrawers();
      var main = getMainState();
      main.caseFile = caseFile;
      main.previousDrawer = drawers.select || null;
      var controller = getListController();
      if (controller) controller.setLoading({ mainCaseFileId: caseFile.id });
      syncAddButton();
      view.setMainCaseName(caseFile);
      view.setMainStatus('加载关联信息...', '');
      if (drawers.main && typeof drawers.main.open === 'function') drawers.main.open();
      return loadMainRows(caseFile.id)
        .then(function(rows) {
          syncAddButton();
          var hasRows = Array.isArray(rows) && rows.length > 0;
          view.setMainStatus(hasRows ? ('已加载 ' + rows.length + ' 条关联') : '当前暂无关联', hasRows ? 'ok' : 'warn');
          return true;
        })
        .catch(function(error) {
          if (controller) controller.setData([], { mainCaseFileId: caseFile.id });
          syncAddButton();
          view.setMainStatus(error && error.message ? error.message : '加载关联失败', 'err');
          return false;
        });
    }

    function resetPick() {
      var pick = getPickState();
      pick.mode = 'create';
      pick.mainCaseFile = null;
      pick.associationId = null;
      pick.subCaseFile = null;
      pick.originalSubCaseFileId = null;
      pick.originalSelectedCaseItemIds = [];
      pick.versionId = null;
      pick.processing = false;
      pick.previousDrawer = null;
      view.resetPick();
      var candidateController = getCandidateController();
      var itemController = getItemController();
      if (candidateController) candidateController.reset();
      if (itemController) itemController.reset();
    }

    function prepareVersions(mainCase) {
      var pick = getPickState();
      var projectId = mainCase && mainCase.project_id ? Number(mainCase.project_id) : null;
      if (!projectId) {
        pick.versionId = null;
        return Promise.resolve([]);
      }
      view.renderVersionLoading();
      return loadVersions(projectId)
        .then(function(list) {
          var preferredVersionId = mainCase && mainCase.version_id ? Number(mainCase.version_id) : null;
          pick.versionId = view.renderVersions(projectId, preferredVersionId);
          return Array.isArray(list) ? list : [];
        })
        .catch(function(error) {
          view.renderVersionError();
          pick.versionId = null;
          view.setPickStatus(error && error.message ? error.message : '加载版本失败', 'err');
          return [];
        });
    }

    function clearCandidatesAndItems() {
      var pick = getPickState();
      pick.subCaseFile = null;
      var candidateController = getCandidateController();
      var itemController = getItemController();
      if (candidateController) {
        candidateController.reset({ mainCaseFileId: pick.mainCaseFile && pick.mainCaseFile.id });
      }
      if (itemController) itemController.reset();
    }

    function loadCandidates() {
      var pick = getPickState();
      var mainCase = pick.mainCaseFile;
      var controller = getCandidateController();
      if (!mainCase || !mainCase.id || !apiClient || typeof apiClient.listCaseFileAssociationCandidates !== 'function') {
        if (controller) controller.reset({ mainCaseFileId: mainCase && mainCase.id });
        return Promise.resolve([]);
      }
      var versionId = normalizeId(pick.versionId);
      if (!versionId || versionId <= 0) {
        clearCandidatesAndItems();
        view.setPickStatus('请先选择版本', 'warn');
        return Promise.resolve([]);
      }
      pick.subCaseFile = null;
      if (controller) {
        controller.setLoading({
          mainCaseFileId: mainCase.id,
          selectedCandidateId: pick.originalSubCaseFileId,
        });
      }
      var itemController = getItemController();
      if (itemController) itemController.reset();
      return apiClient.listCaseFileAssociationCandidates(
        mainCase.id,
        { include_forbidden: true, version_id: versionId }
      ).then(function(rows) {
        var list = Array.isArray(rows) ? rows : [];
        if (controller) {
          controller.setData(list, {
            mainCaseFileId: mainCase.id,
            selectedCandidateId: pick.originalSubCaseFileId,
          });
          var selected = controller.getRows().find(function(row) {
            return row && row.selected === true;
          }) || null;
          pick.subCaseFile = selected ? { id: selected.id, file_name_clean: selected.fileNameClean } : null;
        }
        var total = controller ? controller.getState().total : list.length;
        view.setPickStatus(
          total ? '请选择副用例，点击“下一步选择条目”' : '当前版本暂无可选副用例',
          total ? 'ok' : 'warn'
        );
        return controller ? controller.getRows() : [];
      }).catch(function(error) {
        if (controller) controller.setData([], { mainCaseFileId: mainCase.id });
        view.setPickStatus(error && error.message ? error.message : '加载副用例失败', 'err');
        return [];
      });
    }

    function loadItems(subCase, selectedIds) {
      var controller = getItemController();
      if (!subCase || !subCase.id || !apiClient || typeof apiClient.listCaseItems !== 'function') {
        if (controller) controller.reset();
        return Promise.resolve([]);
      }
      view.setSubCaseName(subCase);
      if (controller) {
        controller.setLoading({ subCaseFileId: subCase.id, selectedItemIds: selectedIds });
      }
      return apiClient.listCaseItems(subCase.id)
        .then(function(items) {
          var list = Array.isArray(items) ? items : [];
          if (controller) {
            controller.setData(list, { subCaseFileId: subCase.id, selectedItemIds: selectedIds });
          }
          view.setPickStatus('已加载副用例条目', 'ok');
          return controller ? controller.getRows() : [];
        })
        .catch(function(error) {
          if (controller) controller.setData([], { subCaseFileId: subCase.id, selectedItemIds: [] });
          view.setPickStatus(error && error.message ? error.message : '加载副用例条目失败', 'err');
          return [];
        });
    }

    function openPick(mode, mainCaseFile, associationRow) {
      var pick = getPickState();
      var drawers = getDrawers();
      var editMode = mode === 'edit';
      var subCaseFileId = associationRow && associationRow.subCaseFileId
        ? associationRow.subCaseFileId
        : (associationRow && associationRow.sub_case_file_id ? associationRow.sub_case_file_id : null);
      var selectedItemIds = associationRow && Array.isArray(associationRow.selectedItemIds)
        ? associationRow.selectedItemIds
        : (associationRow && Array.isArray(associationRow.selected_case_item_ids)
          ? associationRow.selected_case_item_ids
          : []);
      var subCaseName = associationRow && associationRow.subCaseName
        ? associationRow.subCaseName
        : (associationRow && associationRow.sub_case_file_name ? associationRow.sub_case_file_name : '');
      pick.mode = editMode ? 'edit' : 'create';
      pick.mainCaseFile = mainCaseFile || null;
      pick.associationId = associationRow && associationRow.id ? associationRow.id : null;
      pick.subCaseFile = null;
      pick.originalSubCaseFileId = subCaseFileId;
      pick.originalSelectedCaseItemIds = model.normalizeSelectionIds(selectedItemIds);
      pick.versionId = null;
      pick.previousDrawer = drawers.main || null;
      if (drawers.item && typeof drawers.item.close === 'function') drawers.item.close();
      clearCandidatesAndItems();
      if (editMode) {
        var editSubCaseId = normalizeId(subCaseFileId);
        if (editSubCaseId && editSubCaseId > 0) {
          pick.subCaseFile = {
            id: editSubCaseId,
            file_name_clean: subCaseName ? String(subCaseName) : ('用例#' + editSubCaseId),
          };
          view.setPickStatus('加载副用例条目中...', '');
          if (drawers.item && typeof drawers.item.open === 'function') drawers.item.open();
          return loadItems(pick.subCaseFile, pick.originalSelectedCaseItemIds);
        }
      }
      view.setPickStatus('加载版本中...', '');
      if (drawers.pick && typeof drawers.pick.open === 'function') drawers.pick.open();
      return prepareVersions(mainCaseFile).then(function(result) {
        view.setPickStatus('请选择版本并查询副用例', '');
        return result;
      });
    }

    function openItemsFromPick() {
      var pick = getPickState();
      var mainCase = pick.mainCaseFile;
      var subCase = pick.subCaseFile;
      if (!mainCase || !mainCase.id) {
        view.setPickStatus('主用例缺失', 'err');
        return Promise.resolve(false);
      }
      if (!subCase || !subCase.id) {
        view.setPickStatus('请先选择副用例', 'warn');
        return Promise.resolve(false);
      }
      var selectedIds = [];
      if (pick.mode === 'edit' && pick.originalSubCaseFileId &&
        String(subCase.id) === String(pick.originalSubCaseFileId)) {
        selectedIds = pick.originalSelectedCaseItemIds.slice();
      }
      view.setSubCaseName(subCase);
      var drawers = getDrawers();
      if (drawers.item && typeof drawers.item.open === 'function') drawers.item.open();
      return loadItems(subCase, selectedIds).then(function() { return true; });
    }

    function refreshMain(message, type) {
      var main = getMainState();
      var caseFile = main.caseFile;
      if (!caseFile || !caseFile.id) return Promise.resolve([]);
      var controller = getListController();
      if (controller) controller.setLoading({ mainCaseFileId: caseFile.id });
      return loadMainRows(caseFile.id)
        .then(function(rows) {
          syncAddButton();
          view.setMainStatus(message || ('已加载 ' + rows.length + ' 条关联'), type || 'ok');
          var selectController = getSelectController();
          if (selectController) selectController.updateAssociationCount(caseFile.id, rows.length);
          return rows;
        })
        .catch(function(error) {
          if (controller) controller.setData([], { mainCaseFileId: caseFile.id });
          syncAddButton();
          view.setMainStatus(error && error.message ? error.message : '刷新关联失败', 'err');
          return [];
        });
    }

    function submitSelection() {
      var pick = getPickState();
      var mainCase = pick.mainCaseFile;
      var subCase = pick.subCaseFile;
      if (!mainCase || !mainCase.id) {
        view.setPickStatus('主用例缺失', 'err');
        return Promise.resolve(false);
      }
      if (!subCase || !subCase.id) {
        view.setPickStatus('请先选择副用例', 'warn');
        return Promise.resolve(false);
      }
      var itemController = getItemController();
      var selectedIds = itemController ? itemController.getSelectedItemIds() : [];
      if (!selectedIds.length) {
        showToast('请先勾选用例', 'warn', 5000);
        return Promise.resolve(false);
      }
      if (!apiClient) return Promise.resolve(false);
      pick.processing = true;
      view.setConfirmDisabled(true);
      view.setPickStatus('保存关联中...', '');
      var request = pick.mode === 'edit' && pick.associationId
        ? apiClient.updateCaseFileAssociation(mainCase.id, pick.associationId, {
          selected_case_item_ids: selectedIds,
        })
        : apiClient.createCaseFileAssociation(mainCase.id, {
          sub_case_file_id: subCase.id,
          selected_case_item_ids: selectedIds,
        });
      return Promise.resolve(request)
        .then(function() {
          pick.processing = false;
          view.setConfirmDisabled(false);
          showToast('已成功追加到主用例。', 'ok', 5000);
          var drawers = getDrawers();
          if (drawers.item && typeof drawers.item.close === 'function') drawers.item.close();
          if (drawers.pick && typeof drawers.pick.close === 'function') drawers.pick.close();
          return refreshMain('已成功追加到主用例。', 'ok').then(function() { return true; });
        })
        .catch(function(error) {
          pick.processing = false;
          view.setConfirmDisabled(false);
          view.setPickStatus(error && error.message ? error.message : '保存关联失败', 'err');
          showToast(error && error.message ? error.message : '保存关联失败', 'err', 5000);
          return false;
        });
    }

    function requestDelete(row) {
      if (!row || !row.id) return Promise.resolve(false);
      var main = getMainState();
      var drawers = getDrawers();
      main.pendingAssociationId = row.id;
      main.pendingAction = 'delete';
      if (drawers.deleteConfirm && typeof drawers.deleteConfirm.open === 'function') {
        drawers.deleteConfirm.open();
        return Promise.resolve(true);
      }
      return openConfirmDrawer({
        title: '确认删除关联',
        message: '确认删除该副用例关联吗？',
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
        previousDrawer: drawers.main || null,
      }).then(function(result) {
        if (!result || result.ok !== true) return false;
        return confirmDelete();
      });
    }

    function confirmDelete() {
      var main = getMainState();
      var associationId = main.pendingAssociationId;
      var mainCase = main.caseFile;
      main.pendingAssociationId = null;
      main.pendingAction = '';
      if (!associationId || !mainCase || !mainCase.id || !apiClient ||
        typeof apiClient.deleteCaseFileAssociation !== 'function') return Promise.resolve(false);
      main.processing = true;
      syncAddButton();
      view.setMainStatus('删除关联中...', '');
      return apiClient.deleteCaseFileAssociation(mainCase.id, associationId)
        .then(function() {
          main.processing = false;
          showToast('已删除该用例的关联。', 'ok', 5000);
          return refreshMain('已删除该用例的关联。', 'ok').then(function() { return true; });
        })
        .catch(function(error) {
          main.processing = false;
          syncAddButton();
          view.setMainStatus(error && error.message ? error.message : '删除关联失败', 'err');
          return false;
        });
    }

    function resolveExecAssociation(file) {
      var controller = getSelectController();
      var decision = controller
        ? controller.getAssociationDecision(file && file.id)
        : resolveAssociationDecision(file, false);
      if (!decision.requiresConfirmation) {
        return Promise.resolve({ ok: true, association_enabled: decision.associationEnabled === true });
      }
      return openConfirmDrawer({
        title: '确认不关联转执行',
        message: '当前已关闭关联用例，是否不关联直接转执行？',
        confirmText: '确认转执行',
        cancelText: '取消',
        previousDrawer: getDrawers().select || null,
      }).then(function(result) {
        if (!result || result.ok !== true) return { ok: false };
        return { ok: true, association_enabled: false };
      });
    }

    function handleAdd() {
      var mainCase = getMainState().caseFile;
      if (!mainCase || !mainCase.id) {
        view.setMainStatus('主用例缺失', 'warn');
        return Promise.resolve(false);
      }
      return openPick('create', mainCase, null);
    }

    function handleVersionChange() {
      var pick = getPickState();
      pick.versionId = normalizeId(view.getVersionValue());
      pick.subCaseFile = null;
      clearCandidatesAndItems();
      view.setPickStatus(pick.versionId ? '点击“查询”加载副用例' : '请先选择版本', '');
    }

    function handleCandidateSelect(record) {
      var pick = getPickState();
      pick.subCaseFile = record ? {
        id: record.id,
        file_name_clean: record.fileNameClean,
      } : null;
      view.setPickStatus(
        record ? '已选择副用例，点击“下一步选择条目”' : '请先选择副用例',
        ''
      );
    }

    function handleRefresh() {
      var mainCase = getPickState().mainCaseFile;
      return prepareVersions(mainCase).then(function() {
        view.setPickStatus('版本列表已刷新，请选择版本并查询', 'ok');
        clearCandidatesAndItems();
      });
    }

    function handleDeleteConfirm() {
      var drawers = getDrawers();
      return confirmDelete().finally(function() {
        if (drawers.deleteConfirm && typeof drawers.deleteConfirm.close === 'function') {
          drawers.deleteConfirm.close();
        }
      });
    }

    function handlePickDrawerClose() {
      if (!isDrawerOpen(getDrawers().item)) resetPick();
    }

    function handleItemDrawerClose() {
      getPickState().processing = false;
      var controller = getItemController();
      if (controller) controller.reset();
      view.setConfirmDisabled(false);
    }

    function handleDeleteDrawerClose() {
      var main = getMainState();
      main.pendingAssociationId = null;
      main.pendingAction = '';
    }

    function bindEvents() {
      view.bindEvents({
        onAdd: handleAdd,
        onVersionChange: handleVersionChange,
        onQuery: loadCandidates,
        onRefresh: handleRefresh,
        onNext: openItemsFromPick,
        onConfirm: submitSelection,
        onDeleteConfirm: handleDeleteConfirm,
      });
    }

    return {
      bindEvents: bindEvents,
      syncAddButton: syncAddButton,
      resetMain: resetMain,
      openFromSelect: openFromSelect,
      resetPick: resetPick,
      openPick: openPick,
      loadCandidates: loadCandidates,
      openItemsFromPick: openItemsFromPick,
      submitSelection: submitSelection,
      requestDelete: requestDelete,
      confirmDelete: confirmDelete,
      resolveExecAssociation: resolveExecAssociation,
      handlePickDrawerClose: handlePickDrawerClose,
      handleItemDrawerClose: handleItemDrawerClose,
      handleDeleteDrawerClose: handleDeleteDrawerClose,
      handleCandidateSelect: handleCandidateSelect,
    };
  }

  return { create: create };
});
