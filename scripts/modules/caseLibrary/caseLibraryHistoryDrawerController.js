(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var queryControllerOwner = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.historyQueryController
    : null;
  var detailControllerOwner = root && root.app && root.app.caseLibrary
    ? root.app.caseLibrary.historyDetailController
    : null;
  if (typeof module !== 'undefined' && module.exports) {
    queryControllerOwner = queryControllerOwner || require('./caseLibraryHistoryQueryController.js');
    detailControllerOwner = detailControllerOwner || require('./caseLibraryHistoryDetailController.js');
  }
  var api = factory(queryControllerOwner, detailControllerOwner);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.caseLibrary = root.app.caseLibrary || {};
    root.app.caseLibrary.historyDrawerController = api;
    api.attachEarlyBridge(root);
  }
})(function(defaultQueryControllerOwner, defaultDetailControllerOwner) {
  var activeController = null;

  function attachEarlyBridge(root) {
    var doc = root && root.document ? root.document : null;
    var button = doc && typeof doc.getElementById === 'function'
      ? doc.getElementById('openCaseLibraryHistoryDrawerBtn')
      : null;
    if (!button || typeof button.addEventListener !== 'function' || button.__tapHistoryEarlyBridgeBound) return false;
    button.__tapHistoryEarlyBridgeBound = true;
    button.addEventListener('click', function(event) {
      if (event && typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      if (activeController && typeof activeController.openDrawer === 'function') {
        activeController.openDrawer();
        return;
      }
      root.app = root.app || {};
      root.app.__caseLibraryHistoryDrawerEarlyOpen = true;
      var drawer = doc.getElementById('caseLibraryHistoryDrawer');
      if (drawer && drawer.classList) {
        drawer.classList.remove('closing');
        drawer.classList.add('open');
      }
    });
    return true;
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var apiClient = opts.apiClient || null;
    var queryControllerOwner = opts.queryControllerOwner || defaultQueryControllerOwner;
    var detailControllerOwner = opts.detailControllerOwner || defaultDetailControllerOwner;
    if (!queryControllerOwner || !detailControllerOwner) {
      throw new Error('Case library history drawer controller owners are required');
    }

    var normalizeId = typeof opts.normalizeId === 'function' ? opts.normalizeId : function(value) { return value || null; };
    var getPageSize = typeof opts.getPageSize === 'function' ? opts.getPageSize : function() { return 20; };
    var formatTime = typeof opts.formatTime === 'function' ? opts.formatTime : function(value) { return String(value || '--'); };
    var getVersionName = typeof opts.getVersionName === 'function'
      ? opts.getVersionName
      : function(projectId, versionId) { return versionId || versionId === 0 ? String(versionId) : ''; };
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var syncProjectOptions = typeof opts.syncProjectOptions === 'function' ? opts.syncProjectOptions : function() {};
    var syncVersionOptionsWithAll = typeof opts.syncVersionOptionsWithAll === 'function'
      ? opts.syncVersionOptionsWithAll
      : function() {};
    var loadVersions = typeof opts.loadVersions === 'function' ? opts.loadVersions : function() { return Promise.resolve([]); };
    var ensureProjectsReady = typeof opts.ensureProjectsReady === 'function'
      ? opts.ensureProjectsReady
      : function() { return Promise.resolve([]); };
    var ensureDrawer = typeof opts.ensureDrawer === 'function' ? opts.ensureDrawer : function() { return null; };
    var getCurrentUserId = typeof opts.getCurrentUserId === 'function' ? opts.getCurrentUserId : function() { return null; };
    var getCurrentLoginSeq = typeof opts.getCurrentLoginSeq === 'function' ? opts.getCurrentLoginSeq : function() { return ''; };
    var isAuthReady = typeof opts.isAuthReady === 'function' ? opts.isAuthReady : function() { return true; };
    var getProjects = typeof opts.getProjects === 'function' ? opts.getProjects : function() { return state.projects || []; };
    var getProjectName = typeof opts.getProjectName === 'function'
      ? opts.getProjectName
      : function(projectId) { return '项目#' + projectId; };
    var persistLastView = typeof opts.persistLastView === 'function' ? opts.persistLastView : function() {};
    var hideEditorCard = typeof opts.hideEditorCard === 'function' ? opts.hideEditorCard : function() {};
    var hideMissingCard = typeof opts.hideMissingCard === 'function' ? opts.hideMissingCard : function() {};
    var hasEditorSelection = typeof opts.hasEditorSelection === 'function' ? opts.hasEditorSelection : function() { return false; };
    var storage = opts.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    var root = opts.root || (typeof window !== 'undefined' ? window : null);
    var queryPersistKey = opts.queryPersistKey || 'tap-case-library-history-query';
    var detailPersistKey = opts.detailPersistKey || 'tap-case-library-history-detail';
    var queryController = null;
    var detailController = null;
    var drawerInstance = null;
    var eventsBound = false;

    state.historyQueryDrawer = state.historyQueryDrawer || { projectId: null, versionId: null };
    state.historyDetail = state.historyDetail || {
      projectId: null,
      fileNameClean: '',
      isDeleted: false,
      versionId: null,
      restoring: false,
    };

    function readPersisted(key) {
      if (!storage || typeof storage.getItem !== 'function') return null;
      try {
        var raw = storage.getItem(key);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (error) {
        return null;
      }
    }

    function writePersisted(key, payload) {
      if (!storage) return;
      try {
        if (!payload) {
          if (typeof storage.removeItem === 'function') storage.removeItem(key);
          return;
        }
        if (typeof storage.setItem === 'function') storage.setItem(key, JSON.stringify(payload));
      } catch (error) {
        // ignore storage failures
      }
    }

    function sessionMatches(persisted) {
      if (!persisted) return false;
      var userId = getCurrentUserId();
      var loginSeq = getCurrentLoginSeq();
      var sameUser = userId && String(persisted.user_id || '') === String(userId);
      var sameLogin = loginSeq && String(persisted.login_seq || '') === String(loginSeq);
      return Boolean(sameUser || sameLogin);
    }

    function ensureQueryController() {
      if (queryController) return queryController;
      if (!dom.historyDrawerTableHost) return null;
      queryController = queryControllerOwner.create({
        hostEl: dom.historyDrawerTableHost,
        searchInputEl: dom.historyDrawerSearchInput,
        paginationTopEl: dom.historyDrawerPaginationTop,
        paginationBottomEl: dom.historyDrawerPaginationBottom,
        pageSize: getPageSize(),
        adapterOptions: {
          formatTime: formatTime,
          getVersionName: getVersionName,
        },
        onOpen: function(record) {
          openDetail(record.projectId, record.fileNameClean, record.versionId);
        },
        onStateChange: persistQueryState,
      });
      return queryController;
    }

    function ensureDetailController() {
      if (detailController) return detailController;
      if (!dom.historyTableHost) return null;
      detailController = detailControllerOwner.create({
        hostEl: dom.historyTableHost,
        filterElements: [
          dom.historyAppendPill,
          dom.historyAddedPill,
          dom.historyUpdatedPill,
          dom.historyDeletedPill,
          dom.historyImportPill,
          dom.historyReimportPill,
          dom.historyFileDeletedPill,
        ],
        paginationTopEl: dom.historyPaginationTop,
        paginationBottomEl: dom.historyPaginationBottom,
        pageSize: getPageSize(),
        adapterOptions: { formatTime: formatTime },
        onStateChange: persistDetailSelection,
      });
      return detailController;
    }

    function setDetailVisible(visible) {
      if (!dom.historyDetailCard || !dom.historyDetailCard.classList) return;
      try { dom.historyDetailCard.hidden = !visible; } catch (error) {}
      if (visible) dom.historyDetailCard.classList.remove('hidden');
      else dom.historyDetailCard.classList.add('hidden');
      if (visible) {
        hideEditorCard();
        hideMissingCard();
      }
    }

    function isDetailVisible() {
      return Boolean(
        dom.historyDetailCard &&
        dom.historyDetailCard.classList &&
        !dom.historyDetailCard.classList.contains('hidden')
      );
    }

    function syncDetailHeading() {
      if (!dom.historyCaseName) return;
      var detail = state.historyDetail || {};
      var projectId = detail.projectId ? String(detail.projectId) : '';
      var fileName = detail.fileNameClean ? String(detail.fileNameClean) : '';
      if (!projectId || !fileName) {
        dom.historyCaseName.textContent = '';
        return;
      }
      var versionId = detail.versionId || detail.versionId === 0 ? String(detail.versionId) : '';
      var label = getProjectName(projectId) + ' / ' + getVersionName(projectId, versionId) + ' / ' + fileName;
      dom.historyCaseName.textContent = label + (detail.isDeleted ? '（已删除）' : '');
    }

    function resetQueryDrawer() {
      state.historyQueryDrawer.projectId = null;
      state.historyQueryDrawer.versionId = null;
      setStatus(dom.historyDrawerStatus, '', '');
      syncProjectOptions(dom.historyDrawerProjectSelect, '请选择项目');
      if (dom.historyDrawerProjectSelect) dom.historyDrawerProjectSelect.value = '';
      if (dom.historyDrawerVersionSelect) {
        dom.historyDrawerVersionSelect.disabled = true;
        dom.historyDrawerVersionSelect.innerHTML = '<option value="">请选择版本</option><option value="0">全部版本</option>';
        dom.historyDrawerVersionSelect.value = '';
      }
      var controller = ensureQueryController();
      if (controller) controller.reset();
    }

    function handleQueryProjectChange() {
      state.historyQueryDrawer.projectId = normalizeId(
        dom.historyDrawerProjectSelect ? dom.historyDrawerProjectSelect.value : ''
      );
      state.historyQueryDrawer.versionId = null;
      setStatus(dom.historyDrawerStatus, '', '');
      var controller = ensureQueryController();
      var controllerState = controller ? controller.getState() : {};
      if (controller) controller.reset({ searchText: controllerState.searchText || '' });
      persistQueryState();
      if (dom.historyDrawerVersionSelect) {
        dom.historyDrawerVersionSelect.disabled = true;
        dom.historyDrawerVersionSelect.innerHTML = '<option value="">加载版本中...</option>';
      }
      var projectId = state.historyQueryDrawer.projectId;
      if (!projectId) {
        if (dom.historyDrawerVersionSelect) {
          dom.historyDrawerVersionSelect.disabled = true;
          dom.historyDrawerVersionSelect.innerHTML = '<option value="">请选择版本</option>';
          dom.historyDrawerVersionSelect.value = '';
        }
        return Promise.resolve(false);
      }
      return loadVersions(projectId).then(function() {
        if (!dom.historyDrawerVersionSelect) return true;
        dom.historyDrawerVersionSelect.disabled = false;
        syncVersionOptionsWithAll(dom.historyDrawerVersionSelect, projectId);
        dom.historyDrawerVersionSelect.value = '0';
        state.historyQueryDrawer.versionId = 0;
        persistQueryState();
        return true;
      });
    }

    function handleQueryVersionChange() {
      state.historyQueryDrawer.versionId = normalizeId(
        dom.historyDrawerVersionSelect ? dom.historyDrawerVersionSelect.value : ''
      );
      var controller = ensureQueryController();
      if (controller) controller.setPageIndex(0);
      persistQueryState();
    }

    function clearQuerySearch() {
      var controller = ensureQueryController();
      if (controller) controller.setSearch('');
      else if (dom.historyDrawerSearchInput) dom.historyDrawerSearchInput.value = '';
      persistQueryState();
    }

    function loadQueryFiles() {
      var controller = ensureQueryController();
      if (!apiClient || typeof apiClient.listCaseLibraryChangeFiles !== 'function') {
        setStatus(dom.historyDrawerStatus, '缺少历史接口（apiClient.listCaseLibraryChangeFiles）', 'warn');
        if (controller) controller.setData([]);
        return Promise.resolve([]);
      }
      var projectId = state.historyQueryDrawer.projectId;
      var versionId = state.historyQueryDrawer.versionId;
      if (!projectId || versionId === null || versionId === undefined) {
        setStatus(dom.historyDrawerStatus, '请先选择项目与版本', 'warn');
        return Promise.resolve([]);
      }
      if (controller) controller.setLoading();
      setStatus(dom.historyDrawerStatus, '加载中...', '');
      return apiClient.listCaseLibraryChangeFiles({
        project_id: projectId,
        version_id: versionId,
        limit: 500,
      }).then(function(list) {
        var records = Array.isArray(list) ? list : [];
        if (controller) controller.setData(records);
        setStatus(
          dom.historyDrawerStatus,
          '已加载 ' + records.length + ' 条（仅展示有改动记录的用例）',
          records.length ? 'ok' : ''
        );
        persistQueryState();
        return records;
      }).catch(function(error) {
        setStatus(dom.historyDrawerStatus, '查询失败：' + (error && error.message ? error.message : '加载失败'), 'err');
        if (controller) controller.setData([]);
        return [];
      });
    }

    function openDetail(projectId, fileNameClean, versionId) {
      var pid = projectId === null || projectId === undefined ? '' : String(projectId);
      var name = String(fileNameClean || '').trim();
      if (!pid || !name) return false;
      state.historyDetail.projectId = pid;
      state.historyDetail.fileNameClean = name;
      state.historyDetail.isDeleted = false;
      state.historyDetail.versionId = versionId || versionId === 0 ? versionId : null;
      setDetailVisible(true);
      syncDetailHeading();
      if (drawerInstance && typeof drawerInstance.close === 'function') drawerInstance.close();
      setStatus(dom.historyStatus, '加载历史记录中...', '');
      persistLastView('history');
      loadEntries(pid, name, { filter: '', pageIndex: 0 }).then(function() {
        try {
          if (dom.historyDetailCard && typeof dom.historyDetailCard.scrollIntoView === 'function') {
            dom.historyDetailCard.scrollIntoView();
          }
        } catch (error) {
          // ignore
        }
      });
      return true;
    }

    function loadEntries(projectId, fileNameClean, options) {
      var controller = ensureDetailController();
      var pid = projectId === null || projectId === undefined ? '' : String(projectId);
      var name = String(fileNameClean || '').trim();
      var source = options && typeof options === 'object' ? options : {};
      var currentView = controller ? controller.getState() : {};
      var viewState = {
        fileNameClean: name,
        filter: Object.prototype.hasOwnProperty.call(source, 'filter')
          ? String(source.filter || '')
          : String(currentView.filter || ''),
        pageIndex: Object.prototype.hasOwnProperty.call(source, 'pageIndex')
          ? Number(source.pageIndex) || 0
          : Number(currentView.pageIndex) || 0,
      };
      if (!apiClient || typeof apiClient.getCaseLibraryChangeHistory !== 'function') {
        setStatus(dom.historyStatus, '缺少历史接口（apiClient.getCaseLibraryChangeHistory）', 'warn');
        if (controller) controller.setData([], viewState);
        return Promise.resolve(null);
      }
      if (!pid || !name) {
        setStatus(dom.historyStatus, '请选择一个用例查看历史记录', '');
        if (controller) controller.setData([], viewState);
        return Promise.resolve(null);
      }
      if (controller) controller.setLoading(viewState);
      setStatus(dom.historyStatus, '加载历史记录中...', '');
      var versionId = state.historyDetail.versionId !== null && state.historyDetail.versionId !== undefined
        ? state.historyDetail.versionId
        : null;
      return apiClient.getCaseLibraryChangeHistory(pid, name, {
        limit: 800,
        version_id: versionId,
      }).then(function(result) {
        var history = result && Array.isArray(result.history) ? result.history : [];
        state.historyDetail.isDeleted = Boolean(result && result.is_deleted);
        state.historyDetail.versionId = result && (result.version_id || result.version_id === 0)
          ? result.version_id
          : state.historyDetail.versionId;
        syncDetailHeading();
        if (controller) controller.setData(history, viewState);
        var statusText = state.historyDetail.isDeleted
          ? '该用例已被整份删除（未重新导入），历史记录仍保留。'
          : (history.length ? ('已加载 ' + history.length + ' 条历史记录') : '暂无历史记录');
        setStatus(dom.historyStatus, statusText, history.length ? 'ok' : '');
        persistDetailSelection();
        return result;
      }).catch(function(error) {
        setStatus(dom.historyStatus, '加载历史记录失败：' + (error && error.message ? error.message : '加载失败'), 'err');
        if (controller) controller.setData([], viewState);
        return null;
      });
    }

    function persistQueryState() {
      var userId = getCurrentUserId();
      var loginSeq = getCurrentLoginSeq();
      if (!userId && !loginSeq) return;
      var persisted = readPersisted(queryPersistKey);
      if (persisted && !sessionMatches(persisted)) persisted = null;
      var projectId = state.historyQueryDrawer.projectId;
      var versionId = state.historyQueryDrawer.versionId;
      var controller = ensureQueryController();
      var controllerState = controller ? controller.getState() : {};
      var searchText = String(controllerState.searchText || '');
      if (!projectId && persisted) {
        projectId = normalizeId(persisted.project_id);
        versionId = normalizeId(persisted.version_id);
        searchText = persisted.search_text ? String(persisted.search_text) : searchText;
      }
      if (!projectId) return;
      writePersisted(queryPersistKey, {
        user_id: userId || '',
        login_seq: loginSeq || '',
        project_id: projectId || '',
        version_id: versionId || versionId === 0 ? versionId : '',
        search_text: searchText || '',
        saved_at: Date.now(),
      });
    }

    function restoreQueryDrawer() {
      if (!isAuthReady()) return Promise.resolve(false);
      var persisted = readPersisted(queryPersistKey);
      if (!persisted || !sessionMatches(persisted)) return Promise.resolve(false);
      var projectId = normalizeId(persisted.project_id);
      var versionId = normalizeId(persisted.version_id);
      if (!projectId) return Promise.resolve(false);
      var hasProject = getProjects().some(function(project) {
        return project && String(project.id) === String(projectId);
      });
      if (!hasProject) return Promise.resolve(false);
      state.historyQueryDrawer.projectId = projectId;
      state.historyQueryDrawer.versionId = versionId || versionId === 0 ? versionId : null;
      if (dom.historyDrawerProjectSelect) dom.historyDrawerProjectSelect.value = String(projectId);
      var controller = ensureQueryController();
      if (controller) controller.reset({ searchText: persisted.search_text ? String(persisted.search_text) : '' });
      if (!dom.historyDrawerVersionSelect) return Promise.resolve(true);
      dom.historyDrawerVersionSelect.disabled = true;
      dom.historyDrawerVersionSelect.innerHTML = '<option value="">加载版本中...</option>';
      dom.historyDrawerVersionSelect.value = '';
      return loadVersions(projectId).then(function() {
        if (!dom.historyDrawerVersionSelect) return true;
        dom.historyDrawerVersionSelect.disabled = false;
        syncVersionOptionsWithAll(dom.historyDrawerVersionSelect, projectId);
        var selectedVersion = state.historyQueryDrawer.versionId;
        dom.historyDrawerVersionSelect.value = selectedVersion || selectedVersion === 0 ? String(selectedVersion) : '';
        if (selectedVersion || selectedVersion === 0) {
          return loadQueryFiles().then(function() { return true; });
        }
        return true;
      }).catch(function() {
        return false;
      });
    }

    function readDetailPersistedState() {
      return readPersisted(detailPersistKey);
    }

    function clearDetailPersistedState() {
      writePersisted(detailPersistKey, null);
    }

    function persistDetailSelection() {
      var userId = getCurrentUserId();
      var loginSeq = getCurrentLoginSeq();
      if (!userId && !loginSeq) return;
      var projectId = state.historyDetail.projectId ? String(state.historyDetail.projectId) : '';
      var fileName = state.historyDetail.fileNameClean ? String(state.historyDetail.fileNameClean) : '';
      if (!projectId || !fileName) return;
      var controller = ensureDetailController();
      var controllerState = controller ? controller.getState() : {};
      writePersisted(detailPersistKey, {
        user_id: userId || '',
        login_seq: loginSeq || '',
        project_id: projectId,
        file_name_clean: fileName,
        version_id: state.historyDetail.versionId || state.historyDetail.versionId === 0
          ? state.historyDetail.versionId
          : '',
        filter: String(controllerState.filter || ''),
        page_index: isFinite(Number(controllerState.pageIndex)) ? Number(controllerState.pageIndex) : 0,
        saved_at: Date.now(),
      });
    }

    function restoreDetail() {
      if (!isAuthReady()) return Promise.resolve(false);
      if (state.historyDetail.restoring === true) return Promise.resolve(false);
      var persisted = readDetailPersistedState();
      if (!persisted || !sessionMatches(persisted)) return Promise.resolve(false);
      var projectId = normalizeId(persisted.project_id);
      var fileName = persisted.file_name_clean ? String(persisted.file_name_clean) : '';
      if (!projectId || !fileName.trim()) return Promise.resolve(false);
      var projects = getProjects();
      if (projects.length) {
        var hasProject = projects.some(function(project) {
          return project && String(project.id) === String(projectId);
        });
        if (!hasProject) return Promise.resolve(false);
      }
      state.historyDetail.restoring = true;
      state.historyDetail.projectId = String(projectId);
      state.historyDetail.fileNameClean = fileName.trim();
      state.historyDetail.versionId = persisted.version_id || persisted.version_id === 0
        ? persisted.version_id
        : null;
      state.historyDetail.isDeleted = false;
      setDetailVisible(true);
      syncDetailHeading();
      setStatus(dom.historyStatus, '加载历史记录中...', '');
      return loadEntries(projectId, fileName, {
        filter: persisted.filter ? String(persisted.filter) : '',
        pageIndex: isFinite(Number(persisted.page_index)) ? Number(persisted.page_index) : 0,
      }).then(function(result) {
        return Boolean(result);
      }).catch(function() {
        clearDetailPersistedState();
        setDetailVisible(false);
        return false;
      }).finally(function() {
        state.historyDetail.restoring = false;
      });
    }

    function prepareQueryDrawer() {
      return Promise.resolve(ensureProjectsReady()).then(function() {
        resetQueryDrawer();
        return restoreQueryDrawer();
      });
    }

    function initDrawer() {
      if (drawerInstance) return drawerInstance;
      drawerInstance = ensureDrawer(
        'caseLibraryHistoryDrawer',
        ['openCaseLibraryHistoryDrawerBtn'],
        prepareQueryDrawer
      );
      if (root && root.app && root.app.__caseLibraryHistoryDrawerEarlyOpen) {
        root.app.__caseLibraryHistoryDrawerEarlyOpen = false;
        if (drawerInstance && typeof drawerInstance.open === 'function') drawerInstance.open();
      }
      return drawerInstance;
    }

    function openDrawer() {
      var drawer = initDrawer();
      if (!drawer || typeof drawer.open !== 'function') return false;
      drawer.open();
      return true;
    }

    function refreshDetail() {
      var projectId = state.historyDetail.projectId ? String(state.historyDetail.projectId) : '';
      var fileName = state.historyDetail.fileNameClean ? String(state.historyDetail.fileNameClean) : '';
      if (!projectId || !fileName) {
        setStatus(dom.historyStatus, '请先选择一个用例查看历史详情', 'warn');
        return Promise.resolve(false);
      }
      return Promise.resolve(ensureProjectsReady()).then(function() {
        return loadEntries(projectId, fileName);
      });
    }

    function hideDetail() {
      setDetailVisible(false);
      clearDetailPersistedState();
      if (hasEditorSelection()) persistLastView('editor');
    }

    function bindEvents() {
      if (eventsBound) return;
      eventsBound = true;
      if (dom.historyDrawerProjectSelect) {
        dom.historyDrawerProjectSelect.addEventListener('change', handleQueryProjectChange);
      }
      if (dom.historyDrawerVersionSelect) {
        dom.historyDrawerVersionSelect.addEventListener('change', handleQueryVersionChange);
      }
      if (dom.historyDrawerQueryBtn) dom.historyDrawerQueryBtn.addEventListener('click', loadQueryFiles);
      if (dom.historyDrawerClearBtn) dom.historyDrawerClearBtn.addEventListener('click', clearQuerySearch);
      if (dom.historyRefreshBtn) dom.historyRefreshBtn.addEventListener('click', refreshDetail);
      if (dom.historyHideBtn) dom.historyHideBtn.addEventListener('click', hideDetail);
    }

    function setPageSize(pageSize) {
      var query = ensureQueryController();
      var detail = ensureDetailController();
      if (query) query.setPageSize(pageSize);
      if (detail) detail.setPageSize(pageSize);
    }

    var controllerApi = {
      ensureQueryController: ensureQueryController,
      ensureDetailController: ensureDetailController,
      initDrawer: initDrawer,
      openDrawer: openDrawer,
      bindEvents: bindEvents,
      resetQueryDrawer: resetQueryDrawer,
      restoreQueryDrawer: restoreQueryDrawer,
      loadQueryFiles: loadQueryFiles,
      openDetail: openDetail,
      loadEntries: loadEntries,
      refreshDetail: refreshDetail,
      hideDetail: hideDetail,
      setDetailVisible: setDetailVisible,
      isDetailVisible: isDetailVisible,
      setPageSize: setPageSize,
      persistQueryState: persistQueryState,
      persistDetailSelection: persistDetailSelection,
      readDetailPersistedState: readDetailPersistedState,
      clearDetailPersistedState: clearDetailPersistedState,
      restoreDetail: restoreDetail,
      getDrawer: function() { return drawerInstance; },
    };
    activeController = controllerApi;
    return controllerApi;
  }

  return { create: create, attachEarlyBridge: attachEarlyBridge };
});
