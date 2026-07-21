(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.selectExecDrawerController = api;
  }
})(function() {
  function versionIdFromResult(result) {
    if (!result || typeof result !== 'object') return null;
    if (Object.prototype.hasOwnProperty.call(result, 'versionId')) return result.versionId;
    return result.exec_version_id || null;
  }

  function matchesVersion(serverValue, targetValue) {
    if (targetValue === null || targetValue === undefined || targetValue === '') {
      return serverValue === null || serverValue === undefined || String(serverValue) === '';
    }
    return String(serverValue) === String(targetValue);
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var apiClient = opts.apiClient || null;
    var model = opts.model || null;
    var workflow = opts.workflow || null;
    var view = opts.view || null;
    var getListController = typeof opts.getListController === 'function'
      ? opts.getListController
      : function() { return null; };
    if (!apiClient || !model || !workflow || !view) {
      throw new Error('Case library select exec drawer dependencies are required');
    }

    var normalizeId = typeof opts.normalizeId === 'function' ? opts.normalizeId : function(value) { return value || null; };
    var ensureProjectsReady = typeof opts.ensureProjectsReady === 'function'
      ? opts.ensureProjectsReady
      : function() { return Promise.resolve([]); };
    var loadVersions = typeof opts.loadVersions === 'function'
      ? opts.loadVersions
      : function() { return Promise.resolve([]); };
    var persistState = typeof opts.persistState === 'function' ? opts.persistState : function() {};
    var readPersistedState = typeof opts.readPersistedState === 'function' ? opts.readPersistedState : function() { return null; };
    var isAuthReady = typeof opts.isAuthReady === 'function' ? opts.isAuthReady : function() { return true; };
    var getCurrentUserId = typeof opts.getCurrentUserId === 'function' ? opts.getCurrentUserId : function() { return ''; };
    var nextLoadSeq = typeof opts.nextLoadSeq === 'function' ? opts.nextLoadSeq : function() { return 0; };
    var isLoadSeqCurrent = typeof opts.isLoadSeqCurrent === 'function'
      ? opts.isLoadSeqCurrent
      : function() { return true; };
    var resolveAssociation = typeof opts.resolveAssociation === 'function'
      ? opts.resolveAssociation
      : function() { return Promise.resolve({ ok: true, association_enabled: false }); };
    var transferItems = typeof opts.transferItems === 'function'
      ? opts.transferItems
      : function() { return Promise.resolve({ ok: false }); };
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function'
      ? opts.openConfirmDrawer
      : function() { return Promise.resolve({ ok: true }); };
    var isExecDbEnabled = typeof opts.isExecDbEnabled === 'function' ? opts.isExecDbEnabled : function() { return false; };
    var getVersionDrawer = typeof opts.getVersionDrawer === 'function' ? opts.getVersionDrawer : function() { return null; };
    var ensureDrawer = typeof opts.ensureDrawer === 'function' ? opts.ensureDrawer : function() { return null; };
    var closeAllDrawers = typeof opts.closeAllDrawers === 'function' ? opts.closeAllDrawers : function() {};
    var markSkipRestore = typeof opts.markSkipRestore === 'function' ? opts.markSkipRestore : function() {};
    var activateExecView = typeof opts.activateExecView === 'function' ? opts.activateExecView : function() {};
    var getVersionName = typeof opts.getVersionName === 'function'
      ? opts.getVersionName
      : function(projectId, versionId) { return versionId ? ('版本#' + versionId) : ''; };
    var drawerInstance = null;

    function getDrawer() {
      return drawerInstance;
    }

    function isOpen() {
      var element = drawerInstance && drawerInstance.element ? drawerInstance.element : null;
      return Boolean(element && element.classList && element.classList.contains('open'));
    }

    function restoreOpenState(wasOpen) {
      if (wasOpen && drawerInstance && typeof drawerInstance.open === 'function') drawerInstance.open();
    }

    function closeForNestedDrawer() {
      var wasOpen = isOpen();
      if (wasOpen && drawerInstance && typeof drawerInstance.close === 'function') {
        markSkipRestore();
        drawerInstance.close();
      }
      return wasOpen;
    }

    function setStatus(text, type) {
      view.setDrawerStatus(text, type);
    }

    function controllerContext(projectId, execSets) {
      return {
        projectId: projectId,
        projectNameById: state.projectNameById,
        versionNameByProject: state.versionNameByProject,
        validVersionIds: (state.versionsByProject[projectId] || []).map(function(version) {
          return version && version.id;
        }),
        execByFileId: model.normalizeExecByFileId(execSets),
      };
    }

    function emptyControllerContext(projectId) {
      return {
        projectId: projectId,
        projectNameById: state.projectNameById,
        versionNameByProject: state.versionNameByProject,
      };
    }

    function loadFiles(projectId, options) {
      var loadOptions = options && typeof options === 'object' ? options : {};
      var controller = getListController();
      if (!controller) return Promise.resolve(false);
      var seq = nextLoadSeq();
      setStatus('加载用例库...', '');
      controller.setLoading({
        projectId: projectId,
        resetAssociationSwitches: loadOptions.resetAssociationSwitches === true,
      });
      return Promise.all([
        apiClient.listCaseFiles(projectId),
        loadVersions(projectId),
        apiClient.listExecSetsByCaseFile(projectId),
      ]).then(function(result) {
        if (!isLoadSeqCurrent(seq)) return false;
        var files = Array.isArray(result && result[0]) ? result[0] : [];
        var execSets = Array.isArray(result && result[2]) ? result[2] : [];
        controller.setData(files, controllerContext(projectId, execSets));
        if (loadOptions.renderVersions === true) {
          var selectedVersionId = view.renderVersions(
            projectId,
            loadOptions.preferredVersionId || null,
            state.versionsByProject[projectId] || []
          );
          controller.setVersion(selectedVersionId);
        }
        setStatus('已加载 ' + files.length + ' 份用例文件', files.length ? 'ok' : 'warn');
        if (loadOptions.persistAfterLoad === true) persistState();
        return true;
      }).catch(function(error) {
        if (!isLoadSeqCurrent(seq)) return false;
        controller.setData([], emptyControllerContext(projectId));
        if (loadOptions.silentError !== true) {
          setStatus(error && error.message ? error.message : '加载失败', 'err');
        }
        return false;
      });
    }

    function reset() {
      nextLoadSeq();
      var controller = getListController();
      if (controller) controller.reset();
      view.reset();
    }

    function handleProjectChange() {
      var projectId = normalizeId(view.getProjectValue());
      var controller = getListController();
      if (!controller) return Promise.resolve(false);
      controller.setProject(projectId);
      persistState({ projectId: projectId, versionId: '' });
      view.resetVersions();
      view.setSearchValue('');
      if (!projectId) return Promise.resolve(false);
      return loadFiles(projectId, { renderVersions: true });
    }

    function handleVersionChange() {
      var controller = getListController();
      if (!controller) return;
      controller.setVersion(normalizeId(view.getVersionValue()));
      persistState();
    }

    function refresh() {
      var projectId = normalizeId(view.getProjectValue());
      var versionId = normalizeId(view.getVersionValue());
      var controller = getListController();
      if (!controller) return Promise.resolve(false);
      var controllerState = controller.getState();
      if (String(controllerState.projectId || '') !== String(projectId || '')) controller.setProject(projectId);
      controller.setVersion(versionId);
      controller.setSearch(view.getSearchValue());
      persistState({ projectId: projectId, versionId: versionId || '' });
      if (!projectId) {
        setStatus('请先选择项目', 'warn');
        return Promise.resolve(false);
      }
      return loadFiles(projectId, { resetAssociationSwitches: true });
    }

    function restore() {
      if (!isAuthReady()) return Promise.resolve(false);
      var persisted = readPersistedState();
      if (!persisted) return Promise.resolve(false);
      var userId = getCurrentUserId();
      if (!userId || String(persisted.user_id || '') !== String(userId)) return Promise.resolve(false);
      var projectId = normalizeId(persisted.project_id);
      var versionId = normalizeId(persisted.version_id);
      if (!projectId) return Promise.resolve(false);
      var hasProject = (state.projects || []).some(function(project) {
        return project && String(project.id) === String(projectId);
      });
      if (!hasProject) return Promise.resolve(false);
      var controller = getListController();
      if (!controller) return Promise.resolve(false);
      controller.setProject(projectId);
      view.setProjectValue(projectId);
      view.resetVersions();
      view.setSearchValue('');
      return loadFiles(projectId, {
        renderVersions: true,
        preferredVersionId: versionId,
        persistAfterLoad: true,
        silentError: true,
      });
    }

    function prepare() {
      return Promise.resolve(ensureProjectsReady()).then(function() {
        reset();
        return restore();
      });
    }

    function initDrawer() {
      if (drawerInstance) return drawerInstance;
      drawerInstance = ensureDrawer(
        'caseLibrarySelectExecDrawer',
        ['openCaseLibrarySelectExecDrawerBtn'],
        prepare
      );
      return drawerInstance;
    }

    function open() {
      closeAllDrawers();
      var drawer = initDrawer();
      if (drawer && typeof drawer.open === 'function') {
        drawer.open();
        return true;
      }
      return view.clickOpenButton();
    }

    function openVersionDrawer(projectId, options) {
      var drawerApi = getVersionDrawer();
      if (!drawerApi || typeof drawerApi.open !== 'function') {
        return Promise.resolve({ ok: false, reason: 'drawer_unavailable' });
      }
      var openOptions = options && typeof options === 'object' ? options : {};
      var pid = projectId || openOptions.projectId || openOptions.project_id || '';
      if (!pid) return Promise.resolve({ ok: false, reason: 'no_project' });
      var projectName = state.projectNameById && state.projectNameById[pid]
        ? state.projectNameById[pid]
        : ('项目#' + pid);
      return drawerApi.open(Object.assign({}, openOptions, { projectId: pid, projectName: projectName }));
    }

    function chooseSingleVersion(file) {
      var projectId = file.project_id || null;
      var wasOpen = closeForNestedDrawer();
      var importVersionId = file.version_id || null;
      return openVersionDrawer(projectId, {
        title: '选择执行版本',
        importVersionId: importVersionId,
        importVersionName: getVersionName(projectId, importVersionId) || '',
      }).then(function(result) {
        restoreOpenState(wasOpen);
        return result;
      });
    }

    function execFile(caseFile) {
      if (!caseFile || !caseFile.id || !caseFile.project_id) return Promise.resolve(false);
      return workflow.runSingle({
        file: caseFile,
        resolveAssociation: resolveAssociation,
        chooseVersion: chooseSingleVersion,
        loadItems: function(file) { return apiClient.listCaseItems(file.id); },
        transfer: function(file, items, context) {
          return transferItems(
            file,
            file.file_name_clean || ('用例#' + file.id),
            items,
            {
              statusTarget: 'select',
              execVersionId: versionIdFromResult(context.versionResult),
              previousDrawer: drawerInstance || null,
              openAssignDrawer: true,
              association_enabled: context.association_enabled === true,
            }
          );
        },
        onProgress: function() { setStatus('加载用例条目...', ''); },
      }).then(function(result) {
        if (!result || result.ok !== true) {
          var cancelled = result && (
            result.reason === 'association_cancelled' || result.reason === 'version_cancelled'
          );
          setStatus(
            cancelled ? '已取消转到执行' : (result && result.error && result.error.message ? result.error.message : '加载用例失败'),
            cancelled ? 'warn' : 'err'
          );
          return false;
        }
        if (drawerInstance && typeof drawerInstance.close === 'function') drawerInstance.close();
        return true;
      });
    }

    function buildBatchPrecheck(projectId, execVersionId, selectedFiles) {
      if (!isExecDbEnabled()) return Promise.resolve({ ok: true, skipConfirm: false });
      return apiClient.listExecSets(projectId || undefined).then(function(list) {
        var sets = Array.isArray(list) ? list : [];
        var filesById = {};
        var activeNames = [];
        selectedFiles.forEach(function(file) { filesById[Number(file.id)] = file; });
        sets.forEach(function(execSet) {
          if (!execSet || String(execSet.status || '') !== 'active') return;
          if (!matchesVersion(execSet.version_id, execVersionId)) return;
          var file = filesById[Number(execSet.case_file_id)];
          if (file) activeNames.push(file.file_name_clean || ('用例#' + file.id));
        });
        if (!activeNames.length) return { ok: true, skipConfirm: false };
        return openConfirmDrawer({
          title: '确认批量转到执行',
          message: '检测到以下用例已存在执行记录，将同步最新用例并尽量保留结果（模块+标题+预期一致保留），是否继续？\n' + activeNames.join('\n'),
          confirmText: '继续转到执行',
          cancelText: '取消',
          previousDrawer: drawerInstance || null,
        }).then(function(result) {
          return result && result.ok === true
            ? { ok: true, skipConfirm: true }
            : { ok: false, reason: 'cancel' };
        });
      }).catch(function() {
        return { ok: true, skipConfirm: false };
      });
    }

    function batchExec() {
      var controller = getListController();
      var controllerState = controller ? controller.getState() : null;
      var projectId = controllerState ? controllerState.projectId : null;
      if (!projectId) {
        setStatus('请先选择项目', 'warn');
        return Promise.resolve(false);
      }
      var selectedFiles = controller.getSelectedFiles();
      if (!selectedFiles.length) {
        setStatus('请先勾选用例', 'warn');
        return Promise.resolve(false);
      }
      var wasOpen = closeForNestedDrawer();
      return openVersionDrawer(projectId, { title: '选择执行版本', importVersionMultiple: true })
        .then(function(versionResult) {
          if (!versionResult || versionResult.ok !== true) {
            restoreOpenState(wasOpen);
            setStatus('已取消批量转到执行', 'warn');
            return null;
          }
          var execVersionId = versionIdFromResult(versionResult);
          restoreOpenState(wasOpen);
          var precheck = buildBatchPrecheck(projectId, execVersionId, selectedFiles);
          setStatus('批量转到执行中...', '');
          controller.setProcessing(true);
          return workflow.runBatch({
            files: selectedFiles,
            chooseVersion: function() { return versionResult; },
            precheck: function() { return precheck; },
            resolveAssociation: resolveAssociation,
            loadItems: function(file) { return apiClient.listCaseItems(file.id); },
            transfer: function(file, items, context) {
              return transferItems(
                file,
                file.file_name_clean || ('用例#' + file.id),
                items,
                {
                  statusTarget: 'select',
                  switchTab: false,
                  skipActiveConfirm: context.skipActiveConfirm === true,
                  execVersionId: execVersionId,
                  previousDrawer: drawerInstance || null,
                  association_enabled: context.association_enabled === true,
                }
              );
            },
            onProgress: function(progress) {
              var file = progress && progress.file ? progress.file : null;
              var name = file && file.file_name_clean
                ? file.file_name_clean
                : ('用例#' + (file && file.id ? file.id : ''));
              setStatus(
                '加载用例条目（' + (Number(progress.index) + 1) + '/' + progress.total + '）：' + name,
                ''
              );
            },
          }).then(function(result) {
            if (!result || result.reason === 'precheck_cancelled') {
              setStatus('已取消批量转到执行', 'warn');
              return false;
            }
            if (result.successes) activateExecView();
            if (result.failures.length) {
              setStatus(
                '批量转到执行完成：成功 ' + result.successes + ' 份，失败 ' + result.failures.length + ' 份',
                result.successes ? 'warn' : 'err'
              );
            } else {
              setStatus('批量转到执行完成：成功 ' + result.successes + ' 份', 'ok');
            }
            controller.clearSelection();
            if (drawerInstance && typeof drawerInstance.close === 'function') drawerInstance.close();
            return true;
          }).finally(function() {
            controller.setProcessing(false);
          });
        });
    }

    function syncListState(snapshot) {
      if (!snapshot) return;
      view.setVersionValue(snapshot.versionId || '');
    }

    function bindEvents() {
      view.bindEvents({
        onProjectChange: handleProjectChange,
        onVersionChange: handleVersionChange,
        onRefresh: refresh,
        onBatchExec: batchExec,
      });
    }

    return {
      initDrawer: initDrawer,
      getDrawer: getDrawer,
      open: open,
      reset: reset,
      restore: restore,
      prepare: prepare,
      refresh: refresh,
      handleProjectChange: handleProjectChange,
      handleVersionChange: handleVersionChange,
      openVersionDrawer: openVersionDrawer,
      execFile: execFile,
      batchExec: batchExec,
      syncListState: syncListState,
      bindEvents: bindEvents,
    };
  }

  return {
    create: create,
    versionIdFromResult: versionIdFromResult,
    matchesVersion: matchesVersion,
  };
});
