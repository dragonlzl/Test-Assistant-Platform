(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.editDrawerWorkflowController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var apiClient = opts.apiClient || null;
    var getListController = typeof opts.getListController === 'function'
      ? opts.getListController
      : function() { return null; };
    var setListData = typeof opts.setListData === 'function' ? opts.setListData : function() { return null; };
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var normalizeId = typeof opts.normalizeId === 'function' ? opts.normalizeId : function(value) { return value || null; };
    var syncProjectOptions = typeof opts.syncProjectOptions === 'function' ? opts.syncProjectOptions : function() {};
    var syncVersionOptions = typeof opts.syncVersionOptions === 'function' ? opts.syncVersionOptions : function() {};
    var syncChangeVersionOptions = typeof opts.syncChangeVersionOptions === 'function'
      ? opts.syncChangeVersionOptions
      : function() {};
    var syncOwnerFilterOptions = typeof opts.syncOwnerFilterOptions === 'function'
      ? opts.syncOwnerFilterOptions
      : function() {};
    var persistState = typeof opts.persistState === 'function' ? opts.persistState : function() {};
    var isDrawerOpen = typeof opts.isDrawerOpen === 'function' ? opts.isDrawerOpen : function() { return false; };
    var getDrawer = typeof opts.getDrawer === 'function' ? opts.getDrawer : function() { return null; };
    var getShareController = typeof opts.getShareController === 'function'
      ? opts.getShareController
      : function() { return null; };
    var logOperation = typeof opts.logOperation === 'function' ? opts.logOperation : function() {};
    var getXmindBuilder = typeof opts.getXmindBuilder === 'function' ? opts.getXmindBuilder : function() { return null; };
    var getDownloadBlob = typeof opts.getDownloadBlob === 'function' ? opts.getDownloadBlob : function() { return null; };
    var getJsZip = typeof opts.getJsZip === 'function' ? opts.getJsZip : function() { return null; };
    var sanitizeDownloadName = typeof opts.sanitizeDownloadName === 'function'
      ? opts.sanitizeDownloadName
      : function(name, extension) { return String(name || '') + String(extension || ''); };
    var buildExcelBlob = typeof opts.buildExcelBlob === 'function'
      ? opts.buildExcelBlob
      : function() { return Promise.reject(new Error('缺少 Excel 导出能力')); };
    var getVersionName = typeof opts.getVersionName === 'function'
      ? opts.getVersionName
      : function(projectId, versionId) { return '版本#' + versionId; };
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function'
      ? opts.openConfirmDrawer
      : function() { return Promise.resolve({ ok: false }); };
    var isAdminUser = typeof opts.isAdminUser === 'function' ? opts.isAdminUser : function() { return false; };
    var loadVersions = typeof opts.loadVersions === 'function' ? opts.loadVersions : function() { return Promise.resolve([]); };
    var getCurrentUserId = typeof opts.getCurrentUserId === 'function' ? opts.getCurrentUserId : function() { return null; };
    var resolvePage = typeof opts.resolvePage === 'function'
      ? opts.resolvePage
      : function() { return { total: 0, pageIndex: 0, pageSize: 0, totalPages: 0, start: 0, end: 0 }; };
    var alertUser = typeof opts.alertUser === 'function' ? opts.alertUser : function() {};
    var showEditorCard = typeof opts.showEditorCard === 'function' ? opts.showEditorCard : function() {};
    var syncAiGenContext = typeof opts.syncAiGenContext === 'function' ? opts.syncAiGenContext : function() {};
    var clearEditorPersistence = typeof opts.clearEditorPersistence === 'function'
      ? opts.clearEditorPersistence
      : function() {};
    var setEditorStatus = typeof opts.setEditorStatus === 'function' ? opts.setEditorStatus : function() {};

    function getEditState() {
      if (!state.editDrawer || typeof state.editDrawer !== 'object') state.editDrawer = {};
      return state.editDrawer;
    }

    function persist(extra) {
      persistState(Object.assign({ drawer_open: Boolean(isDrawerOpen()) }, extra || {}));
    }

    function reset() {
      var controller = getListController();
      if (controller) controller.reset();
      var target = getEditState();
      target.files = [];
      target.execByFileId = {};
      target.changeVersionId = null;
      setStatus(dom.editDrawerStatus, '', '');
      syncProjectOptions(dom.editDrawerProjectSelect, '请选择项目');
      if (dom.editDrawerProjectSelect) dom.editDrawerProjectSelect.value = '';
      if (dom.editDrawerVersionSelect) {
        dom.editDrawerVersionSelect.disabled = true;
        dom.editDrawerVersionSelect.innerHTML = '<option value="">全部版本</option>';
        dom.editDrawerVersionSelect.value = '';
      }
      if (dom.editDrawerChangeVersionSelect) {
        dom.editDrawerChangeVersionSelect.disabled = true;
        dom.editDrawerChangeVersionSelect.innerHTML = '<option value="">请选择版本</option>';
        dom.editDrawerChangeVersionSelect.value = '';
      }
      syncOwnerFilterOptions();
      if (dom.editDrawerFileSearchInput) dom.editDrawerFileSearchInput.value = '';
      if (dom.editDrawerShareBtn) dom.editDrawerShareBtn.disabled = true;
      if (dom.editDrawerExportXmindBtn) dom.editDrawerExportXmindBtn.disabled = true;
      if (dom.editDrawerExportExcelBtn) dom.editDrawerExportExcelBtn.disabled = true;
      syncControls();
    }

    function handleVersionChange() {
      var controller = getListController();
      if (controller) controller.setVersion(normalizeId(dom.editDrawerVersionSelect ? dom.editDrawerVersionSelect.value : ''));
      updateLoadedStatus();
      persist();
    }

    function handleChangeVersionSelectChange() {
      getEditState().changeVersionId = normalizeId(
        dom.editDrawerChangeVersionSelect ? dom.editDrawerChangeVersionSelect.value : ''
      );
      syncControls();
    }

    function handleOwnerFilterChange() {
      var controller = getListController();
      if (controller) {
        controller.setOwnerFilter(
          dom.editDrawerOwnerFilterSelect ? dom.editDrawerOwnerFilterSelect.value : '',
          true
        );
      }
      updateLoadedStatus();
      persist();
    }

    function handleFileSearchInput() {
      if (!dom.editDrawerFileSearchInput) return;
      var controller = getListController();
      if (controller) controller.setSearch(dom.editDrawerFileSearchInput.value || '');
      updateLoadedStatus();
      persist();
    }

    function getVisibleFiles() {
      var controller = getListController();
      return controller ? controller.getVisibleFiles() : [];
    }

    function updateLoadedStatus(list, force) {
      if (!dom.editDrawerStatus) return;
      if (!force && getEditState().loading) return;
      var files = Array.isArray(list) ? list : getVisibleFiles();
      var totalItems = 0;
      files.forEach(function(file) {
        var count = Number(file && file.item_count);
        if (!isFinite(count) || count < 0) count = 0;
        totalItems += count;
      });
      var message = '已加载 ' + files.length + ' 份用例文件，共' + totalItems + '条用例。';
      setStatus(dom.editDrawerStatus, message, files.length ? 'ok' : 'warn');
    }

    function getSelectedFiles() {
      var controller = getListController();
      return controller ? controller.getSelectedFiles() : [];
    }

    function openShareFromSelection() {
      if (getEditState().loading) return;
      var files = getSelectedFiles();
      if (!files.length) {
        setStatus(dom.editDrawerStatus, '请先勾选要共享的用例文件', 'warn');
        return;
      }
      var first = files[0];
      logOperation('open_share_case_file', 'case_file', first.id, {
        file_name: first.file_name_clean || '',
        selected_count: files.length,
      });
      var shareController = getShareController();
      if (!shareController || !shareController.open(files, { previousDrawer: getDrawer() })) {
        setStatus(dom.editDrawerStatus, '共享抽屉不可用', 'warn');
      }
    }

    function exportSelection(format) {
      if (getEditState().loading) return Promise.resolve(false);
      var files = getSelectedFiles();
      var isXmind = format === 'xmind';
      var label = isXmind ? 'XMind' : 'Excel';
      var extension = isXmind ? '.xmind' : '.xlsx';
      var button = isXmind ? dom.editDrawerExportXmindBtn : dom.editDrawerExportExcelBtn;
      if (!files.length) {
        setStatus(dom.editDrawerStatus, '请先勾选要导出的用例文件', 'warn');
        return Promise.resolve(false);
      }
      var builder = isXmind ? getXmindBuilder() : null;
      if (isXmind && !builder) {
        setStatus(dom.editDrawerStatus, '缺少 XMind 导出依赖', 'err');
        return Promise.resolve(false);
      }
      if (!apiClient || typeof apiClient.listCaseItems !== 'function') {
        setStatus(dom.editDrawerStatus, '后端用例条目接口未就绪', 'err');
        return Promise.resolve(false);
      }
      var downloadBlob = getDownloadBlob();
      var ZipCtor = getJsZip();
      var isBatch = files.length > 1;
      var zip = isBatch && ZipCtor ? new ZipCtor() : null;
      var success = 0;
      var fail = 0;
      if (button) button.disabled = true;
      setStatus(
        dom.editDrawerStatus,
        isBatch ? ('批量导出 ' + label + '（' + files.length + '份）...') : ('正在导出 ' + label + '...'),
        ''
      );

      var chain = Promise.resolve();
      files.forEach(function(file) {
        chain = chain.then(function() {
          var fallbackName = file
            ? (file.file_name_clean || file.file_name || file.name || '')
            : '';
          var baseName = fallbackName ? String(fallbackName) : ('用例#' + (file && file.id ? file.id : ''));
          return apiClient.listCaseItems(file.id).then(function(items) {
            if (isXmind) return builder(items || [], baseName, '');
            return buildExcelBlob(items || [], baseName);
          }).then(function(result) {
            var blob = isXmind ? (result && result.blob) : result;
            if (!blob) throw new Error('无导出内容');
            var fileName = sanitizeDownloadName(baseName, extension);
            if (zip) zip.file(fileName, blob);
            else downloadBlob(fileName, blob);
            success += 1;
          }).catch(function(error) {
            fail += 1;
            if (typeof console !== 'undefined' && console.error) console.error(error);
          });
        });
      });

      return chain.then(function() {
        if (!zip) return null;
        if (!success) throw new Error('全部导出失败');
        return zip.generateAsync({ type: 'blob' }).then(function(blob) {
          downloadBlob('用例批量导出_' + format + '.zip', blob);
        });
      }).then(function() {
        setStatus(
          dom.editDrawerStatus,
          '导出完成：成功 ' + success + ' 份，失败 ' + fail + ' 份',
          fail ? 'warn' : 'ok'
        );
        if (success) {
          var fileNames = files.map(function(file) {
            if (!file) return '';
            return String(file.file_name_clean || file.file_name || file.name || '').trim();
          }).filter(Boolean);
          logOperation('export_case_files_' + format, 'case_file', files.length === 1 ? files[0].id : null, {
            format: isXmind ? 'xmind' : 'xlsx',
            count: files.length,
            success: success,
            fail: fail,
            case_file_ids: files.map(function(file) {
              return file && file.id ? file.id : null;
            }).filter(function(value) { return value !== null; }),
            file_name: files.length === 1 && fileNames.length ? fileNames[0] : null,
            file_names: fileNames,
          });
        }
        return { success: success, fail: fail };
      }).catch(function(error) {
        setStatus(dom.editDrawerStatus, '导出失败：' + (error && error.message ? error.message : '未知错误'), 'err');
        return { success: success, fail: fail, error: error };
      }).finally(function() {
        if (button) button.disabled = false;
      });
    }

    function handleProjectChange() {
      var projectId = normalizeId(dom.editDrawerProjectSelect ? dom.editDrawerProjectSelect.value : '');
      var controller = getListController();
      if (controller) controller.setProject(projectId);
      var target = getEditState();
      target.files = [];
      target.execByFileId = {};
      target.changeVersionId = null;
      if (dom.editDrawerVersionSelect) {
        dom.editDrawerVersionSelect.disabled = true;
        dom.editDrawerVersionSelect.innerHTML = '<option value="">全部版本</option>';
        dom.editDrawerVersionSelect.value = '';
      }
      if (dom.editDrawerChangeVersionSelect) {
        dom.editDrawerChangeVersionSelect.disabled = true;
        dom.editDrawerChangeVersionSelect.innerHTML = '<option value="">请选择版本</option>';
        dom.editDrawerChangeVersionSelect.value = '';
      }
      if (dom.editDrawerExportXmindBtn) dom.editDrawerExportXmindBtn.disabled = true;
      if (dom.editDrawerExportExcelBtn) dom.editDrawerExportExcelBtn.disabled = true;
      render();
      if (!projectId) {
        setStatus(dom.editDrawerStatus, '请先选择项目', 'warn');
        syncControls();
        persist({ force_clear: true });
        return Promise.resolve(false);
      }
      persist();
      return loadFiles();
    }

    function getPagedFiles() {
      var controller = getListController();
      if (!controller) {
        return {
          page: resolvePage(0, 0),
          list: [],
          total: 0,
        };
      }
      var page = controller.getPageData();
      return { page: page, list: controller.getPageRows(), total: page.total };
    }

    function syncControls() {
      var controller = getListController();
      if (controller) controller.syncControls();
    }

    function render() {
      var controller = getListController();
      if (controller) controller.render();
    }

    function confirmChangeVersion() {
      var target = getEditState();
      if (target.loading) return Promise.resolve(false);
      var projectId = normalizeId(dom.editDrawerProjectSelect ? dom.editDrawerProjectSelect.value : '');
      target.projectId = projectId;
      if (!projectId) {
        setStatus(dom.editDrawerStatus, '请先选择项目', 'warn');
        return Promise.resolve(false);
      }
      var targetVersionId = normalizeId(
        dom.editDrawerChangeVersionSelect ? dom.editDrawerChangeVersionSelect.value : ''
      );
      target.changeVersionId = targetVersionId;
      if (!targetVersionId) {
        setStatus(dom.editDrawerStatus, '请先选择更换版本', 'warn');
        syncControls();
        return Promise.resolve(false);
      }
      var selection = target.selection instanceof Set ? target.selection : new Set();
      target.selection = selection;
      if (!selection.size) {
        setStatus(dom.editDrawerStatus, '请先勾选要更换版本的用例文件', 'warn');
        syncControls();
        return Promise.resolve(false);
      }
      if (!apiClient || typeof apiClient.changeCaseFileVersion !== 'function') {
        setStatus(dom.editDrawerStatus, '后端更换版本接口未就绪', 'err');
        return Promise.resolve(false);
      }
      var list = Array.isArray(target.files) ? target.files : [];
      var effectiveIds = Array.from(selection).filter(function(id) {
        var found = list.find(function(file) { return file && String(file.id) === String(id); });
        return found && String(found.version_id || '') !== String(targetVersionId);
      }).map(String);
      if (!effectiveIds.length) {
        setStatus(dom.editDrawerStatus, '所选用例已在目标版本', 'warn');
        return Promise.resolve(false);
      }
      var versionName = getVersionName(projectId, targetVersionId);
      return openConfirmDrawer({
        title: '确认更换版本',
        message: '是否确认把所选用例的版本更换版本为' + versionName + '？',
        confirmText: '确认更换',
        cancelText: '取消',
        previousDrawer: getDrawer(),
      }).then(function(result) {
        if (!result || result.ok !== true) {
          setStatus(dom.editDrawerStatus, '已取消更换版本', 'warn');
          return false;
        }
        var controller = getListController();
        if (controller) controller.setProcessing(true);
        setStatus(dom.editDrawerStatus, '更换版本中...', '');
        return apiClient.changeCaseFileVersion({
          project_id: projectId,
          target_version_id: targetVersionId,
          case_file_ids: effectiveIds,
        }).then(function(response) {
          var updatedIds = Array.isArray(response && response.updated_ids) ? response.updated_ids : [];
          var skippedIds = Array.isArray(response && response.skipped_ids) ? response.skipped_ids : [];
          var missingIds = Array.isArray(response && response.missing_ids) ? response.missing_ids : [];
          var updatedSet = Object.create(null);
          updatedIds.forEach(function(id) { updatedSet[String(id)] = true; });
          var nowText = new Date().toISOString();
          target.files.forEach(function(file) {
            if (!file || !updatedSet[String(file.id)]) return;
            file.version_id = targetVersionId;
            file.updated_at = nowText;
          });
          setListData(target.files, null, {
            projectId: projectId,
            execByFileId: target.execByFileId,
          });
          if (controller) controller.clearSelection();
          var message = '更换版本完成：成功 ' + updatedIds.length + ' 份';
          if (skippedIds.length) message += '，跳过 ' + skippedIds.length + ' 份';
          if (missingIds.length) message += '，缺失 ' + missingIds.length + ' 份';
          setStatus(dom.editDrawerStatus, message, missingIds.length ? 'warn' : 'ok');
          return true;
        }).catch(function(error) {
          setStatus(dom.editDrawerStatus, error && error.message ? error.message : '更换版本失败', 'err');
          return false;
        }).finally(function() {
          if (controller) controller.setProcessing(false);
          persist();
        });
      });
    }

    function buildDeleteBlockMessage(ids, list, execByFileId) {
      var blocked = [];
      ids.forEach(function(id) {
        var info = execByFileId[String(id)] || null;
        var activeUsers = info && Array.isArray(info.active_users) ? info.active_users : [];
        if (activeUsers.length) blocked.push({ id: String(id), activeUsers: activeUsers });
      });
      if (!blocked.length) return '';
      var lines = blocked.map(function(item) {
        var found = list.find(function(file) { return file && String(file.id) === item.id; });
        var name = found && found.file_name_clean ? String(found.file_name_clean) : ('文件#' + item.id);
        var usersText = item.activeUsers.filter(Boolean).join('、') || '未知人员';
        return '- ' + name + '（' + usersText + '）';
      });
      return '以下用例文件正在执行页中，解散前无法删除：\n' + lines.join('\n') +
        '\n\n请先通知正在执行人，在执行页面的分配页面中解散该份用例（移除/删除执行集），解散后再删除。';
    }

    function deleteSelected() {
      var target = getEditState();
      if (target.loading) return Promise.resolve(false);
      if (!isAdminUser()) {
        setStatus(dom.editDrawerStatus, '仅管理员可删除', 'warn');
        return Promise.resolve(false);
      }
      var selection = target.selection instanceof Set ? target.selection : new Set();
      target.selection = selection;
      if (!selection.size) {
        setStatus(dom.editDrawerStatus, '请先勾选要删除的用例文件', 'warn');
        return Promise.resolve(false);
      }
      if (!apiClient || typeof apiClient.deleteCaseFile !== 'function') {
        setStatus(dom.editDrawerStatus, '后端删除接口未就绪', 'err');
        return Promise.resolve(false);
      }
      var ids = Array.from(selection);
      var list = Array.isArray(target.files) ? target.files : [];
      var execByFileId = target.execByFileId && typeof target.execByFileId === 'object'
        ? target.execByFileId
        : {};
      var blockMessage = buildDeleteBlockMessage(ids, list, execByFileId);
      if (blockMessage) {
        setStatus(dom.editDrawerStatus, '存在执行中用例，已阻止删除', 'warn');
        alertUser(blockMessage);
        return Promise.resolve(false);
      }
      var labels = ids.map(function(id) {
        var found = list.find(function(file) { return file && String(file.id) === String(id); });
        var name = found && found.file_name_clean ? String(found.file_name_clean) : ('文件#' + id);
        var count = found && (found.item_count || found.item_count === 0) ? Number(found.item_count) : NaN;
        var countText = isFinite(count) && count >= 0 ? (String(Math.floor(count)) + '条') : '?条';
        return name + '，' + countText;
      });
      var head = labels.slice(0, 6).join('、');
      var suffix = labels.length > 6 ? (' 等' + labels.length + '份') : '';
      return openConfirmDrawer({
        title: '确认删除用例',
        message: '是否确认删除用例：' + head + suffix + '？',
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
        previousDrawer: getDrawer(),
      }).then(function(result) {
        if (!result || result.ok !== true) return false;
        var controller = getListController();
        if (controller) controller.setProcessing(true);
        setStatus(dom.editDrawerStatus, '删除中...', '');
        var success = 0;
        var fail = 0;
        var deletedIds = [];
        var chain = Promise.resolve();
        ids.forEach(function(id) {
          chain = chain.then(function() {
            return apiClient.deleteCaseFile(id).then(function() {
              success += 1;
              deletedIds.push(String(id));
            }).catch(function(error) {
              fail += 1;
              setStatus(
                dom.editDrawerStatus,
                '删除失败：' + (error && error.message ? error.message : '删除失败'),
                'err'
              );
            });
          });
        });
        return chain.then(function() {
          setStatus(
            dom.editDrawerStatus,
            '删除完成：成功 ' + success + ' 份，失败 ' + fail + ' 份',
            fail ? 'warn' : 'ok'
          );
          return success > 0;
        }).finally(function() {
          if (deletedIds.length) {
            var deletedSet = new Set(deletedIds);
            target.files = target.files.filter(function(file) {
              return !file || file.id === null || file.id === undefined || !deletedSet.has(String(file.id));
            });
            var editor = state.editor && typeof state.editor === 'object' ? state.editor : null;
            var editorFile = editor && editor.caseFile ? editor.caseFile : null;
            if (editorFile && deletedSet.has(String(editorFile.id))) {
              editor.caseFile = null;
              editor.items = [];
              editor.searchText = '';
              editor.pageIndex = 0;
              editor.selection = new Set();
              editor.remarkOpen = new Set();
              showEditorCard(false);
              syncAiGenContext();
              clearEditorPersistence();
              setEditorStatus('当前编辑用例已被删除', 'warn');
            }
          }
          setListData(target.files, null, {
            projectId: target.projectId,
            execByFileId: target.execByFileId,
          });
          if (controller) {
            controller.clearSelection();
            controller.setProcessing(false);
          }
        });
      });
    }

    function loadFiles() {
      var target = getEditState();
      var projectId = normalizeId(dom.editDrawerProjectSelect ? dom.editDrawerProjectSelect.value : '');
      var versionId = normalizeId(dom.editDrawerVersionSelect ? dom.editDrawerVersionSelect.value : '') ||
        normalizeId(target.versionId || '');
      var controller = getListController();
      var controllerState = controller ? controller.getState() : null;
      if (controller && String(controllerState.projectId || '') !== String(projectId || '')) {
        controller.setProject(projectId);
        controllerState = controller.getState();
      }
      if (controller && String(controllerState.versionId || '') !== String(versionId || '')) {
        controller.setVersion(versionId);
      }
      target.files = [];
      target.execByFileId = {};
      if (!projectId) {
        setStatus(dom.editDrawerStatus, '请先选择项目', 'warn');
        return Promise.resolve(false);
      }
      setStatus(dom.editDrawerStatus, '加载用例库...', '');
      if (controller) controller.setLoading({ projectId: projectId, preserveSelection: true });
      return Promise.all([
        apiClient.listCaseFiles(projectId),
        loadVersions(projectId),
        apiClient.listExecSetsByCaseFile(projectId),
      ]).then(function(result) {
        var files = Array.isArray(result && result[0]) ? result[0] : [];
        var execSets = Array.isArray(result && result[2]) ? result[2] : [];
        if (dom.editDrawerVersionSelect) {
          syncVersionOptions(dom.editDrawerVersionSelect, projectId, '全部版本');
          dom.editDrawerVersionSelect.disabled = false;
          dom.editDrawerVersionSelect.value = versionId ? String(versionId) : '';
        }
        syncChangeVersionOptions(projectId);
        setListData(files, execSets, { projectId: projectId });
        updateLoadedStatus(getVisibleFiles(), true);
        return files;
      }).catch(function(error) {
        if (controller) {
          controller.setData([], {
            projectId: projectId,
            currentUserId: getCurrentUserId(),
            projectNameById: state.projectNameById,
            versionNameByProject: state.versionNameByProject,
          });
        }
        setStatus(dom.editDrawerStatus, error && error.message ? error.message : '加载失败', 'err');
        return [];
      }).finally(function() {
        syncControls();
        persist();
      });
    }

    function findFile(id) {
      var controller = getListController();
      return controller ? controller.findFile(id) : null;
    }

    return {
      reset: reset,
      handleVersionChange: handleVersionChange,
      handleChangeVersionSelectChange: handleChangeVersionSelectChange,
      handleOwnerFilterChange: handleOwnerFilterChange,
      handleFileSearchInput: handleFileSearchInput,
      updateLoadedStatus: updateLoadedStatus,
      getSelectedFiles: getSelectedFiles,
      openShareFromSelection: openShareFromSelection,
      exportSelectionToXmind: function() { return exportSelection('xmind'); },
      exportSelectionToExcel: function() { return exportSelection('excel'); },
      handleProjectChange: handleProjectChange,
      getVisibleFiles: getVisibleFiles,
      getPagedFiles: getPagedFiles,
      syncControls: syncControls,
      render: render,
      confirmChangeVersion: confirmChangeVersion,
      deleteSelected: deleteSelected,
      loadFiles: loadFiles,
      findFile: findFile,
    };
  }

  return { create: create };
});
