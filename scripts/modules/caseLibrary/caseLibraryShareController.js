(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.shareController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var apiClient = opts.apiClient || null;
    var view = opts.view || null;
    if (!view) throw new Error('Case library share view is required');

    var ensureDrawer = typeof opts.ensureDrawer === 'function' ? opts.ensureDrawer : function() { return null; };
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function'
      ? opts.openConfirmDrawer
      : function() { return Promise.resolve({ ok: false }); };
    var normalizeId = typeof opts.normalizeId === 'function' ? opts.normalizeId : function(value) { return value || null; };
    var sortProjects = typeof opts.sortProjects === 'function' ? opts.sortProjects : null;
    var getProjectName = typeof opts.getProjectName === 'function' ? opts.getProjectName : function(id) { return '项目#' + id; };
    var getVersionName = typeof opts.getVersionName === 'function' ? opts.getVersionName : function(projectId, id) { return id ? ('版本#' + id) : '--'; };
    var captureAnchor = typeof opts.captureAnchor === 'function' ? opts.captureAnchor : function() { return null; };
    var showBlockHint = typeof opts.showBlockHint === 'function' ? opts.showBlockHint : function() {};
    var drawerInstance = null;
    var bound = false;

    function getState() {
      if (!state.shareDrawer || typeof state.shareDrawer !== 'object') state.shareDrawer = {};
      var target = state.shareDrawer;
      if (!Array.isArray(target.caseFiles)) target.caseFiles = [];
      if (!Array.isArray(target.projects)) target.projects = [];
      if (!target.projectNameById || typeof target.projectNameById !== 'object') target.projectNameById = {};
      if (!target.versionsByProject || typeof target.versionsByProject !== 'object') target.versionsByProject = {};
      if (!target.versionNameByProject || typeof target.versionNameByProject !== 'object') target.versionNameByProject = {};
      return target;
    }

    function normalizeCaseFiles(caseFiles) {
      if (Array.isArray(caseFiles)) return caseFiles.filter(function(item) { return item && item.id; });
      if (caseFiles && caseFiles.id) return [caseFiles];
      return [];
    }

    function getCaseFiles() {
      var target = getState();
      if (target.caseFiles.length) return target.caseFiles;
      return target.caseFile ? [target.caseFile] : [];
    }

    function requiresVersion(projectId) {
      var list = projectId && getState().versionsByProject[projectId]
        ? getState().versionsByProject[projectId]
        : [];
      return Array.isArray(list) && list.length > 0;
    }

    function syncControls() {
      view.syncControls(getState(), getCaseFiles(), requiresVersion);
    }

    function resetControls() {
      var target = getState();
      target.projectId = null;
      target.versionId = null;
      target.loading = false;
      target.versionLoadFailed = false;
      view.resetControls();
      syncControls();
    }

    function clearState() {
      var target = getState();
      resetControls();
      target.caseFile = null;
      target.caseFiles = [];
      target.previousDrawer = null;
      target.reopenPrevious = false;
    }

    function loadProjects() {
      if (!apiClient || typeof apiClient.listProjects !== 'function') return Promise.resolve([]);
      return apiClient.listProjects({ scope: 'share' }).then(function(projects) {
        var target = getState();
        target.projects = Array.isArray(projects) ? projects : [];
        target.projectNameById = {};
        view.renderProjectOptions(target.projects, target.projectNameById, sortProjects);
        return target.projects;
      });
    }

    function loadVersions(projectId) {
      var target = getState();
      if (!projectId) return Promise.resolve([]);
      if (target.versionsByProject[projectId]) return Promise.resolve(target.versionsByProject[projectId]);
      if (!apiClient || typeof apiClient.listProjectVersions !== 'function') return Promise.resolve([]);
      return apiClient.listProjectVersions(projectId, { scope: 'share' }).then(function(versions) {
        target.versionsByProject[projectId] = Array.isArray(versions) ? versions : [];
        target.versionNameByProject[projectId] = {};
        target.versionsByProject[projectId].forEach(function(version) {
          if (!version) return;
          target.versionNameByProject[projectId][version.id] = version.name || ('版本#' + version.id);
        });
        return target.versionsByProject[projectId];
      });
    }

    function ensureProjectsReady() {
      var target = getState();
      if (target.projects.length) {
        view.renderProjectOptions(target.projects, target.projectNameById, sortProjects);
        return Promise.resolve(target.projects);
      }
      view.setDrawerStatus('加载项目中...', '');
      return loadProjects().then(function(projects) {
        view.setDrawerStatus('', '');
        return projects;
      }).catch(function(error) {
        view.setDrawerStatus(error && error.message ? error.message : '加载项目失败', 'err');
        return [];
      });
    }

    function handleOpen() {
      resetControls();
      view.renderMeta(getCaseFiles(), getProjectName, getVersionName);
      ensureProjectsReady().then(function() {
        if (dom.shareDrawerProjectSelect) dom.shareDrawerProjectSelect.value = '';
      }).finally(syncControls);
    }

    function handleClose() {
      var target = getState();
      var previousDrawer = target.previousDrawer;
      var shouldReopen = Boolean(
        target.reopenPrevious &&
        previousDrawer &&
        previousDrawer.element &&
        previousDrawer.element.classList &&
        !previousDrawer.element.classList.contains('open')
      );
      clearState();
      if (shouldReopen && typeof previousDrawer.open === 'function') previousDrawer.open();
    }

    function initDrawer() {
      if (drawerInstance) return drawerInstance;
      drawerInstance = ensureDrawer('caseLibraryShareDrawer', [], handleOpen, handleClose);
      return drawerInstance;
    }

    function open(caseFiles, options) {
      var files = normalizeCaseFiles(caseFiles);
      if (!files.length) return false;
      var drawer = initDrawer();
      if (!drawer) return false;
      var target = getState();
      target.caseFiles = files;
      target.caseFile = files[0] || null;
      target.projectId = null;
      target.versionId = null;
      target.loading = false;
      target.previousDrawer = options && (options.previousDrawer || options.prevDrawer || options.drawer)
        ? (options.previousDrawer || options.prevDrawer || options.drawer)
        : null;
      target.reopenPrevious = false;
      if (
        target.previousDrawer &&
        target.previousDrawer.element &&
        target.previousDrawer.element.classList &&
        target.previousDrawer.element.classList.contains('open')
      ) {
        target.reopenPrevious = true;
        if (typeof target.previousDrawer.close === 'function') target.previousDrawer.close();
      }
      if (typeof drawer.open === 'function') drawer.open();
      return true;
    }

    function handleProjectChange() {
      var target = getState();
      target.projectId = normalizeId(view.getProjectValue());
      target.versionId = null;
      target.versionLoadFailed = false;
      view.setDrawerStatus('', '');
      view.showVersionLoading();
      syncControls();
      if (!target.projectId) {
        view.showVersionPlaceholder();
        syncControls();
        return Promise.resolve([]);
      }
      return loadVersions(target.projectId).then(function(versions) {
        var versionNames = target.versionNameByProject[target.projectId] || {};
        view.renderVersionOptions(versions, versionNames);
        syncControls();
        return versions;
      }).catch(function(error) {
        target.versionLoadFailed = true;
        view.showVersionError();
        view.setDrawerStatus(error && error.message ? error.message : '加载版本失败', 'err');
        syncControls();
        return [];
      });
    }

    function handleVersionChange() {
      getState().versionId = normalizeId(view.getVersionValue());
      syncControls();
    }

    function getCaseFileName(file) {
      if (!file) return '';
      return file.file_name_clean || ('用例#' + file.id);
    }

    function formatCaseFileNames(files, limit) {
      var names = (Array.isArray(files) ? files : []).map(getCaseFileName).filter(Boolean);
      if (!names.length) return '';
      var max = Number(limit);
      if (!isFinite(max) || max <= 0) max = 3;
      return names.length <= max ? names.join('、') : (names.slice(0, max).join('、') + '等' + names.length + '份');
    }

    function isDuplicateError(error) {
      var payload = error && error.payload ? error.payload : null;
      var detail = payload && payload.detail ? String(payload.detail || '') : '';
      return Boolean(error && (error.status === 409 || detail === 'case_file_duplicate'));
    }

    function submit(anchorRect) {
      var target = getState();
      var files = getCaseFiles();
      if (!files.length) {
        view.setDrawerStatus('未选择用例', 'warn');
        return Promise.resolve(null);
      }
      if (!apiClient || typeof apiClient.shareCaseFile !== 'function') {
        view.setDrawerStatus('共享接口未就绪', 'warn');
        return Promise.resolve(null);
      }
      target.loading = true;
      syncControls();
      view.setDrawerStatus('共享中...', '');
      var successFiles = [];
      var duplicateFiles = [];
      var failedFiles = [];
      var chain = Promise.resolve();
      files.forEach(function(file) {
        chain = chain.then(function() {
          return apiClient.shareCaseFile({
            case_file_id: file.id,
            target_project_id: target.projectId,
            target_version_id: target.versionId,
          }).then(function() {
            successFiles.push(file);
          }).catch(function(error) {
            if (isDuplicateError(error)) duplicateFiles.push(file);
            else failedFiles.push(file);
          });
        });
      });
      return chain.then(function() {
        var parts = [];
        if (successFiles.length) parts.push('共享成功：' + formatCaseFileNames(successFiles));
        if (duplicateFiles.length) parts.push('已存在未共享：' + formatCaseFileNames(duplicateFiles));
        if (failedFiles.length) parts.push('共享失败：' + formatCaseFileNames(failedFiles));
        var projectName = target.projectNameById[target.projectId] || ('项目#' + target.projectId);
        var message = parts.join('；') || ('已共享至项目「' + projectName + '」');
        var level = failedFiles.length ? 'err' : (duplicateFiles.length ? 'warn' : 'ok');
        view.setDrawerStatus(message, level);
        if (duplicateFiles.length) {
          var rect = anchorRect || captureAnchor(dom.shareDrawerConfirmBtn);
          if (rect) showBlockHint(rect, '该项目已有此用例，如有相关改动，请通知该项目人员。', 5000);
        }
        return { success: successFiles, duplicate: duplicateFiles, failed: failedFiles };
      }).finally(function() {
        target.loading = false;
        syncControls();
      });
    }

    function confirm() {
      var target = getState();
      if (target.loading) return Promise.resolve(false);
      var files = getCaseFiles();
      if (!files.length) {
        view.setDrawerStatus('未选择用例', 'warn');
        return Promise.resolve(false);
      }
      target.projectId = normalizeId(view.getProjectValue());
      if (!target.projectId) {
        view.setDrawerStatus('请先选择项目', 'warn');
        syncControls();
        return Promise.resolve(false);
      }
      target.versionId = normalizeId(view.getVersionValue());
      if (requiresVersion(target.projectId) && !target.versionId) {
        view.setDrawerStatus('请先选择版本', 'warn');
        syncControls();
        return Promise.resolve(false);
      }
      var projectName = target.projectNameById[target.projectId] || ('项目#' + target.projectId);
      var versionMap = target.versionNameByProject[target.projectId] || {};
      var versionName = target.versionId ? (versionMap[target.versionId] || ('版本#' + target.versionId)) : '';
      var subject = files.length === 1
        ? ('用例【' + getCaseFileName(files[0]) + '】')
        : ('已选 ' + files.length + ' 份用例');
      var message = '确认将' + subject + '分享给项目「' + projectName + '」' +
        (target.versionId ? ('（版本：' + versionName + '）') : '') + '吗？';
      var anchorRect = captureAnchor(dom.shareDrawerConfirmBtn);
      return openConfirmDrawer({
        title: '共享用例',
        message: message,
        confirmText: '确认共享',
        cancelText: '取消',
        previousDrawer: drawerInstance || null,
      }).then(function(result) {
        if (!result || result.ok !== true) {
          view.setDrawerStatus('已取消共享', 'warn');
          return false;
        }
        return submit(anchorRect).then(function() { return true; });
      });
    }

    function bindEvents() {
      if (bound) return;
      bound = true;
      if (dom.shareDrawerProjectSelect) dom.shareDrawerProjectSelect.addEventListener('change', handleProjectChange);
      if (dom.shareDrawerVersionSelect) dom.shareDrawerVersionSelect.addEventListener('change', handleVersionChange);
      if (dom.shareDrawerConfirmBtn) dom.shareDrawerConfirmBtn.addEventListener('click', confirm);
    }

    function invalidateCatalog() {
      var target = getState();
      target.projects = [];
      target.projectNameById = {};
      target.versionsByProject = {};
      target.versionNameByProject = {};
    }

    return {
      getState: getState,
      getCaseFiles: getCaseFiles,
      initDrawer: initDrawer,
      open: open,
      loadProjects: loadProjects,
      loadVersions: loadVersions,
      handleProjectChange: handleProjectChange,
      handleVersionChange: handleVersionChange,
      submit: submit,
      confirm: confirm,
      bindEvents: bindEvents,
      invalidateCatalog: invalidateCatalog,
      formatCaseFileNames: formatCaseFileNames,
      isDuplicateError: isDuplicateError,
    };
  }

  return { create: create };
});
