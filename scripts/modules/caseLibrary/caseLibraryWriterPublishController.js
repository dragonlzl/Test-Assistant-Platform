(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.writerPublishController = api;
  }
})(function() {
  function normalizeFileName(raw, cleanFileName) {
    var cleaner = typeof cleanFileName === 'function'
      ? cleanFileName
      : function(value) { return String(value || ''); };
    var text = raw === null || raw === undefined ? '' : String(raw);
    text = text.trim();
    if (!text) return { input: '', clean: '', fileName: '' };
    var clean = cleaner(text || '编写用例');
    clean = clean ? String(clean).trim() : '';
    return {
      input: text,
      clean: clean,
      fileName: clean ? (clean + '.xmind') : '',
    };
  }

  function isSameNameError(error) {
    var message = error && error.message ? String(error.message) : '入库失败';
    var payload = error && error.payload ? error.payload : null;
    return message.indexOf('同名') !== -1 || Boolean(payload && payload.existing_case_file_id);
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var apiClient = opts.apiClient || null;
    var view = opts.view || null;
    var reviewController = opts.reviewController || null;
    if (!view || !reviewController) throw new Error('Case library writer publish owners are required');

    var ensureDrawer = typeof opts.ensureDrawer === 'function' ? opts.ensureDrawer : function() { return null; };
    var ensureProjectsReady = typeof opts.ensureProjectsReady === 'function'
      ? opts.ensureProjectsReady
      : function() { return Promise.resolve([]); };
    var loadVersions = typeof opts.loadVersions === 'function'
      ? opts.loadVersions
      : function() { return Promise.resolve([]); };
    var normalizeId = typeof opts.normalizeId === 'function'
      ? opts.normalizeId
      : function(value) { return value || null; };
    var cleanFileName = typeof opts.cleanFileName === 'function'
      ? opts.cleanFileName
      : function(value) { return String(value || ''); };
    var validateItems = typeof opts.validateItems === 'function'
      ? opts.validateItems
      : function() { return []; };
    var sanitizeItems = typeof opts.sanitizeItems === 'function'
      ? opts.sanitizeItems
      : function(items) { return items || []; };
    var deriveDefaultFileName = typeof opts.deriveDefaultFileName === 'function'
      ? opts.deriveDefaultFileName
      : function() { return '编写用例'; };
    var getPreferredSelection = typeof opts.getPreferredSelection === 'function'
      ? opts.getPreferredSelection
      : function() { return {}; };
    var refreshCaseFiles = typeof opts.refreshCaseFiles === 'function'
      ? opts.refreshCaseFiles
      : function() { return Promise.resolve(); };
    var openImportedCase = typeof opts.openImportedCase === 'function'
      ? opts.openImportedCase
      : function() { return Promise.resolve(false); };
    var onSuccessStatus = typeof opts.onSuccessStatus === 'function' ? opts.onSuccessStatus : function() {};
    var utils = opts.utils && typeof opts.utils === 'object' ? opts.utils : {};

    var drawerInstance = null;
    var fileNameCheckTimer = 0;
    var fileNameCheckSeq = 0;
    var pendingResolve = null;
    var pendingReject = null;

    function getWriterState() {
      if (!state.writer || typeof state.writer !== 'object') state.writer = {};
      var writer = state.writer;
      if (!Array.isArray(writer.draftItems)) writer.draftItems = [];
      return writer;
    }

    function syncView() {
      var writer = getWriterState();
      view.syncFileNameStatus(writer);
      view.syncConfirmEnabled(writer);
    }

    function clearPending() {
      pendingResolve = null;
      pendingReject = null;
    }

    function resolvePending(payload) {
      var resolve = pendingResolve;
      clearPending();
      if (typeof resolve === 'function') resolve(payload || null);
    }

    function rejectPending(reason, silentOnly) {
      var reject = pendingReject;
      clearPending();
      if (typeof reject !== 'function') return;
      if (silentOnly) {
        reject({ silent: true, message: reason || '已取消入库' });
        return;
      }
      reject(new Error(reason || '入库失败'));
    }

    function cancelFileNameCheck() {
      if (fileNameCheckTimer) {
        clearTimeout(fileNameCheckTimer);
        fileNameCheckTimer = 0;
      }
      fileNameCheckSeq += 1;
    }

    function setFileName(raw, options) {
      var writer = getWriterState();
      var normalized = normalizeFileName(raw, cleanFileName);
      writer.fileNameInput = normalized.input;
      writer.fileNameClean = normalized.clean;
      writer.draftFileName = normalized.fileName;
      writer.fileNameDuplicate = false;
      writer.fileNameChecking = false;
      writer.duplicateCaseFileId = null;
      view.setFileNameInput(normalized.input);
      view.renderHint(writer);
      syncView();
      if (!(options && options.skipCheck === true)) scheduleDuplicateCheck(false);
      return normalized;
    }

    function runDuplicateCheck() {
      fileNameCheckTimer = 0;
      var writer = getWriterState();
      writer.fileNameChecking = false;
      writer.fileNameDuplicate = false;
      writer.duplicateCaseFileId = null;
      if (!writer.fileNameInput || !writer.fileNameClean || !writer.projectId) {
        syncView();
        return Promise.resolve(false);
      }
      if (!apiClient || typeof apiClient.listCaseFiles !== 'function') {
        syncView();
        return Promise.resolve(false);
      }

      var requestSeq = fileNameCheckSeq + 1;
      fileNameCheckSeq = requestSeq;
      writer.fileNameChecking = true;
      syncView();
      var projectId = writer.projectId;
      var targetCleanName = String(writer.fileNameClean || '');
      return apiClient.listCaseFiles(projectId)
        .then(function(files) {
          if (requestSeq !== fileNameCheckSeq) return false;
          var list = Array.isArray(files) ? files : [];
          var hit = null;
          for (var i = 0; i < list.length; i += 1) {
            var file = list[i];
            if (!file) continue;
            var dbName = cleanFileName(file.file_name_clean || file.file_name || '');
            if (String(dbName || '') !== targetCleanName) continue;
            hit = file;
            break;
          }
          writer.fileNameChecking = false;
          writer.fileNameDuplicate = Boolean(hit);
          writer.duplicateCaseFileId = hit && hit.id ? hit.id : null;
          syncView();
          return Boolean(hit);
        })
        .catch(function() {
          if (requestSeq !== fileNameCheckSeq) return false;
          writer.fileNameChecking = false;
          writer.fileNameDuplicate = false;
          writer.duplicateCaseFileId = null;
          view.setFileNameStatus('重名校验失败，确认入库时会再次校验', 'warn');
          view.syncConfirmEnabled(writer);
          return false;
        });
    }

    function scheduleDuplicateCheck(immediate) {
      if (fileNameCheckTimer) clearTimeout(fileNameCheckTimer);
      fileNameCheckTimer = setTimeout(runDuplicateCheck, immediate ? 0 : 220);
    }

    function fillVersionOptions(projectId, preferredVersionId) {
      var versions = projectId && state.versionsByProject && state.versionsByProject[projectId]
        ? state.versionsByProject[projectId]
        : [];
      var selected = view.renderVersions(projectId, normalizeId(preferredVersionId || ''), versions);
      getWriterState().versionId = selected ? normalizeId(selected) : null;
      view.syncConfirmEnabled(getWriterState());
    }

    function handleDrawerClose() {
      cancelFileNameCheck();
      var writer = getWriterState();
      writer.publishing = false;
      writer.fileNameChecking = false;
      syncView();
      if (pendingReject) rejectPending('已取消入库', true);
    }

    function initDrawer() {
      if (drawerInstance) return drawerInstance;
      drawerInstance = ensureDrawer(
        'caseLibraryWriterPublishDrawer',
        [],
        syncView,
        handleDrawerClose
      );
      return drawerInstance;
    }

    function open(items, summary, options) {
      var drawer = initDrawer();
      if (!drawer || typeof drawer.open !== 'function') {
        return Promise.reject(new Error('确认入库抽屉未就绪'));
      }
      var writer = getWriterState();
      writer.loading = false;
      writer.publishing = false;
      writer.summary = summary || null;
      writer.draftItems = Array.isArray(items) ? items.slice() : [];
      writer.fileNameDuplicate = false;
      writer.fileNameChecking = false;
      writer.duplicateCaseFileId = null;
      var defaultFileName = deriveDefaultFileName(writer.draftItems, options && options.saveMeta ? options.saveMeta : null);
      var normalized = normalizeFileName(defaultFileName, cleanFileName);
      writer.fileNameInput = normalized.input;
      writer.fileNameClean = normalized.clean;
      writer.draftFileName = normalized.fileName;

      var preferred = getPreferredSelection() || {};
      var preferredProjectId = normalizeId(preferred.projectId || '');
      var preferredVersionId = normalizeId(preferred.versionId || '');
      writer.projectId = preferredProjectId;
      writer.versionId = null;

      view.renderHint(writer);
      view.setFileNameInput(writer.fileNameInput || '');
      view.clearStatuses();
      view.renderProjectLoading();
      view.resetVersions('请选择版本');
      cancelFileNameCheck();
      syncView();
      drawer.open();

      view.setMainStatus('加载项目中...', '');
      return ensureProjectsReady()
        .then(function(projects) {
          var list = Array.isArray(projects) ? projects : [];
          var hasPreferred = list.some(function(project) {
            return project && String(project.id) === String(preferredProjectId || '');
          });
          if (!hasPreferred) {
            preferredProjectId = null;
            preferredVersionId = null;
          }
          if (!preferredProjectId && list.length === 1 && list[0] && list[0].id !== undefined && list[0].id !== null) {
            preferredProjectId = normalizeId(list[0].id);
          }
          writer.projectId = preferredProjectId;
          writer.versionId = null;
          view.renderProjects(preferredProjectId);
          view.resetVersions('请选择版本');
          view.syncConfirmEnabled(writer);
          if (!list.length) {
            view.setMainStatus('暂无可用项目，请先创建项目', 'warn');
            return false;
          }
          if (!preferredProjectId) {
            view.setMainStatus('请选择项目和版本后确认入库', '');
            view.syncFileNameStatus(writer);
            return true;
          }
          view.setMainStatus('加载版本中...', '');
          return loadVersions(preferredProjectId)
            .then(function() {
              fillVersionOptions(preferredProjectId, preferredVersionId);
              view.setMainStatus('', '');
              scheduleDuplicateCheck(true);
              return true;
            })
            .catch(function(error) {
              view.setMainStatus(error && error.message ? error.message : '加载版本失败', 'err');
              return false;
            });
        })
        .catch(function(error) {
          view.setMainStatus(error && error.message ? error.message : '加载项目失败', 'err');
          return false;
        });
    }

    function handleProjectChange() {
      var writer = getWriterState();
      writer.projectId = normalizeId(view.getProjectValue());
      writer.versionId = null;
      writer.fileNameChecking = false;
      writer.fileNameDuplicate = false;
      writer.duplicateCaseFileId = null;
      view.resetVersions('请选择版本');
      cancelFileNameCheck();
      syncView();
      if (!writer.projectId) {
        view.setMainStatus('请先选择项目', 'warn');
        return Promise.resolve(false);
      }
      view.setMainStatus('加载版本中...', '');
      return loadVersions(writer.projectId)
        .then(function() {
          fillVersionOptions(writer.projectId, null);
          view.setMainStatus('', '');
          scheduleDuplicateCheck(true);
          return true;
        })
        .catch(function(error) {
          view.setMainStatus(error && error.message ? error.message : '加载版本失败', 'err');
          return false;
        });
    }

    function addVersion(projectId, writer) {
      if (!projectId) {
        view.setMainStatus('请先选择项目', 'warn');
        view.setVersionValue(writer.versionId || '');
        return Promise.resolve(false);
      }
      if (typeof utils.openAddProjectVersionDrawer !== 'function') {
        view.setMainStatus('新增版本组件未就绪，请刷新后重试', 'err');
        view.setVersionValue(writer.versionId || '');
        return Promise.resolve(false);
      }
      view.setVersionValue(writer.versionId || '');
      view.setVersionDisabled(true);
      view.syncConfirmEnabled(writer);
      var projectName = state.projectNameById && state.projectNameById[projectId]
        ? state.projectNameById[projectId]
        : ('项目#' + projectId);
      return utils.openAddProjectVersionDrawer({
        projectId: projectId,
        projectName: projectName,
        previousDrawer: drawerInstance || null,
      }).then(function(result) {
        if (!result || result.ok !== true || !result.version) return false;
        if (!state.versionsByProject) state.versionsByProject = {};
        var list = state.versionsByProject[projectId];
        if (!Array.isArray(list)) list = [];
        var exists = list.some(function(version) {
          return version && String(version.id) === String(result.version.id);
        });
        if (!exists) list.unshift(result.version);
        state.versionsByProject[projectId] = list;
        if (!state.versionNameByProject) state.versionNameByProject = {};
        if (!state.versionNameByProject[projectId]) state.versionNameByProject[projectId] = {};
        state.versionNameByProject[projectId][result.version.id] =
          result.version.name || ('版本#' + result.version.id);
        writer.versionId = normalizeId(result.version.id);
        fillVersionOptions(projectId, writer.versionId);
        return true;
      }).finally(function() {
        view.setVersionDisabled(false);
        view.syncConfirmEnabled(writer);
      });
    }

    function handleVersionChange() {
      var writer = getWriterState();
      var raw = view.getVersionValue();
      if (typeof utils.isAddVersionOption === 'function' && utils.isAddVersionOption(raw)) {
        return addVersion(writer.projectId, writer);
      }
      writer.versionId = normalizeId(raw);
      view.syncConfirmEnabled(writer);
      return Promise.resolve(true);
    }

    function handleFileNameInput() {
      setFileName(view.getFileNameInput(), { skipCheck: false });
    }

    function buildImportPayload() {
      var writer = getWriterState();
      var items = Array.isArray(writer.draftItems) ? writer.draftItems : [];
      if (!writer.projectId || !writer.versionId || !items.length) return null;
      var normalized = normalizeFileName(writer.fileNameInput || writer.draftFileName || '', cleanFileName);
      writer.fileNameInput = normalized.input;
      writer.fileNameClean = normalized.clean;
      writer.draftFileName = normalized.fileName;
      if (!writer.draftFileName) return null;
      var payloadItems = sanitizeItems(items);
      if (!payloadItems.length) return null;
      return {
        project_id: writer.projectId,
        version_id: writer.versionId,
        file_name: writer.draftFileName,
        source: 'xmind_writer',
        items: payloadItems,
      };
    }

    function handleImportSuccess(payload, caseFile, overwrite) {
      var cleanName = cleanFileName(caseFile && caseFile.file_name_clean ? caseFile.file_name_clean : payload.file_name);
      var message = overwrite ? ('覆盖入库成功：' + cleanName) : ('入库成功：' + cleanName);
      view.setMainStatus(message, 'ok');
      onSuccessStatus(message);
      resolvePending({ caseFile: caseFile || null, overwrite: overwrite === true });
      if (drawerInstance && typeof drawerInstance.close === 'function') drawerInstance.close();
      refreshCaseFiles(payload.project_id)
        .catch(function() { return null; })
        .then(function() {
          openImportedCase(caseFile || null, payload.project_id, cleanName);
        });
    }

    function confirm() {
      var writer = getWriterState();
      if (writer.publishing) return Promise.resolve(false);
      var normalized = normalizeFileName(view.getFileNameInput() || writer.fileNameInput, cleanFileName);
      writer.fileNameInput = normalized.input;
      writer.fileNameClean = normalized.clean;
      writer.draftFileName = normalized.fileName;
      if (!writer.fileNameInput || !writer.fileNameClean || !writer.draftFileName) {
        view.setFileNameStatus('请输入有效的用例文件名（必填）', 'warn');
        view.syncConfirmEnabled(writer);
        return Promise.resolve(false);
      }
      if (writer.fileNameChecking) {
        view.setFileNameStatus('正在校验重名，请稍后再试', 'warn');
        view.syncConfirmEnabled(writer);
        return Promise.resolve(false);
      }
      var payload = buildImportPayload();
      if (!payload) {
        view.setMainStatus('待入库数据未就绪，请检查项目、版本和用例内容', 'warn');
        return Promise.resolve(false);
      }
      if (!apiClient || typeof apiClient.importCaseFile !== 'function') {
        view.setMainStatus('入库接口未就绪', 'err');
        return Promise.resolve(false);
      }
      writer.publishing = true;
      view.syncConfirmEnabled(writer);
      view.setMainStatus('入库中...', '');
      return apiClient.importCaseFile(payload)
        .then(function(caseFile) {
          handleImportSuccess(payload, caseFile || null, false);
          return true;
        })
        .catch(function(error) {
          var message = error && error.message ? String(error.message) : '入库失败';
          if (!isSameNameError(error)) {
            view.setMainStatus('入库失败：' + message, 'err');
            return false;
          }
          view.setMainStatus('检测到同名用例，打开差异对比中...', 'warn');
          return reviewController.openImportDiffForExternal({
            projectId: payload.project_id,
            versionId: payload.version_id,
            fileName: payload.file_name,
            items: payload.items,
            error: error,
            source: payload.source,
          }).then(function(result) {
            if (result && result.ok === true) {
              handleImportSuccess(payload, result.caseFile || null, true);
              return true;
            }
            view.setMainStatus('已取消同名覆盖，可继续编辑或重新入库', 'warn');
            return false;
          }).catch(function(diffError) {
            view.setMainStatus(diffError && diffError.message ? diffError.message : '同名差异处理失败', 'err');
            return false;
          });
        })
        .finally(function() {
          writer.publishing = false;
          view.syncConfirmEnabled(writer);
        });
    }

    function requestPublish(items, summary, saveMeta) {
      var writerItems = Array.isArray(items) ? items : [];
      var invalid = validateItems(writerItems);
      if (invalid.length) return Promise.reject(new Error('编写用例存在空字段，请补齐后再保存'));
      if (pendingReject) rejectPending('已取消上一次入库', true);
      return new Promise(function(resolve, reject) {
        pendingResolve = resolve;
        pendingReject = reject;
        open(writerItems, summary || null, { saveMeta: saveMeta || null }).catch(function(error) {
          rejectPending(error && error.message ? String(error.message) : '确认入库抽屉未就绪', false);
        });
      });
    }

    function bindEvents() {
      view.bindEvents({
        onProjectChange: handleProjectChange,
        onFileNameInput: handleFileNameInput,
        onVersionChange: handleVersionChange,
        onConfirm: confirm,
      });
    }

    return {
      initDrawer: initDrawer,
      bindEvents: bindEvents,
      open: open,
      confirm: confirm,
      requestPublish: requestPublish,
      runDuplicateCheck: runDuplicateCheck,
      setFileName: setFileName,
      getWriterState: getWriterState,
    };
  }

  return {
    create: create,
    normalizeFileName: normalizeFileName,
    isSameNameError: isSameNameError,
  };
});
