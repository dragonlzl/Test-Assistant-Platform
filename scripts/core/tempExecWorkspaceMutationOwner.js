(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecWorkspaceMutationOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function normalizeWorkspaceId(value) {
    return value === null || value === undefined ? '' : String(value);
  }

  function normalizeWorkspaceFileIds(value) {
    if (Array.isArray(value)) {
      return value.map(normalizeWorkspaceId).filter(Boolean);
    }
    return String(value || '').split(',').map(function(id) { return id.trim(); }).filter(Boolean);
  }

  function reorderWorkspaceIds(list, sourceId, targetId, insertAfter) {
    var source = normalizeWorkspaceId(sourceId);
    var target = normalizeWorkspaceId(targetId);
    if (!source || !target || source === target) return Array.isArray(list) ? list.slice() : [];
    var next = (Array.isArray(list) ? list : []).filter(function(id) { return String(id) !== source; });
    var targetIndex = next.map(String).indexOf(target);
    if (targetIndex === -1) {
      if (insertAfter) next.push(source);
      else next.unshift(source);
    } else {
      next.splice(insertAfter ? targetIndex + 1 : targetIndex, 0, source);
    }
    return next;
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var state = opts.state || {};
    var tempExecStatus = opts.tempExecStatus || null;
    var isDbMode = port('isDbMode', function() { return false; });
    var isTempExecProjectLayoutEnabled = port('isTempExecProjectLayoutEnabled', function() { return false; });
    var getApiClient = port('getApiClient', function() { return null; });
    var clearTempExecCaseLibraryDiffMeta = port('clearTempExecCaseLibraryDiffMeta');
    var loadTempExecState = port('loadTempExecState');
    var removeTempExecFromVersion = port('removeTempExecFromVersion');
    var ensureTempExecPlacement = port('ensureTempExecPlacement', function() { return {}; });
    var removeFileFromOrder = port('removeFileFromOrder');
    var saveTempExecFocus = port('saveTempExecFocus');
    var persistTempExecState = port('persistTempExecState');
    var setTempExecActive = port('setTempExecActive');
    var renderTempVersionGrid = port('renderTempVersionGrid');
    var renderTempExecView = port('renderTempExecView');
    var renderTempExecOverview = port('renderTempExecOverview');
    var setStatus = port('setStatus');

    function removeFileFromPlacement(fileId, targetFile, placement) {
      Object.keys(placement.fileOrder || {}).forEach(function(requirement) {
        removeFileFromOrder(requirement, String(fileId));
      });
      if (!placement.fileOrderByProjectVersion || typeof placement.fileOrderByProjectVersion !== 'object') return;
      var projectId = targetFile && targetFile.projectId ? String(targetFile.projectId) : '';
      var versionId = targetFile && targetFile.versionId !== null && targetFile.versionId !== undefined
        ? String(targetFile.versionId || '')
        : '';
      if (!projectId || !placement.fileOrderByProjectVersion[projectId]) return;
      if (!placement.fileOrderByProjectVersion[projectId][versionId]) return;
      placement.fileOrderByProjectVersion[projectId][versionId] = placement.fileOrderByProjectVersion[projectId][versionId]
        .filter(function(id) { return String(id) !== String(fileId); });
    }

    function clearFileUiState(fileId) {
      var id = String(fileId);
      ['tempExecSelections', 'tempExecRemarkOpen', 'tempExecReuseOpen', 'tempExecPages', 'tempExecDefectOpen']
        .forEach(function(key) {
          if (state[key] && typeof state[key] === 'object') delete state[key][id];
        });
      if (state.tempExecReuseBatchExpanded && typeof state.tempExecReuseBatchExpanded === 'object') {
        delete state.tempExecReuseBatchExpanded[id];
      }
      state.tempExecFocus = (state.tempExecFocus || []).filter(function(value) { return String(value) !== id; });
      if (state.tempExecPresetDraft && String(state.tempExecPresetDraft.fileId) === id) {
        state.tempExecPresetDraft = null;
      }
    }

    function requestSingleExecSetDelete(targetFile, restoredFromId) {
      if (!isDbMode()) return;
      var client = getApiClient();
      var execSetId = targetFile && (targetFile.execSetId || Number(targetFile.id));
      if (!client || !execSetId || typeof client.deleteExecSet !== 'function') {
        if (restoredFromId) loadTempExecState();
        return;
      }
      var deletePromise = client.deleteExecSet(execSetId);
      if (!deletePromise || typeof deletePromise.then !== 'function') {
        if (restoredFromId) loadTempExecState();
        return;
      }
      deletePromise.then(function() {
        if (restoredFromId) loadTempExecState();
      }).catch(function(error) {
        if (!tempExecStatus) return;
        var message = error && error.message ? error.message : '执行集删除失败，刷新后可能会再次出现';
        setStatus(tempExecStatus, message, 'warn');
      });
    }

    function removeTempExecFile(fileId) {
      var index = (state.tempExecFiles || []).findIndex(function(item) { return item && item.id === fileId; });
      if (index === -1) return;
      var targetFile = state.tempExecFiles[index];
      var restoredFromId = targetFile && targetFile.restoredFromId ? String(targetFile.restoredFromId) : '';
      var execSetId = targetFile && (targetFile.execSetId || targetFile.id) ? String(targetFile.execSetId || targetFile.id) : '';
      if (execSetId) clearTempExecCaseLibraryDiffMeta(execSetId, { render: true });
      requestSingleExecSetDelete(targetFile, restoredFromId);
      removeTempExecFromVersion(fileId, { silent: true });
      state.tempExecFiles.splice(index, 1);
      removeFileFromPlacement(fileId, targetFile, ensureTempExecPlacement());
      clearFileUiState(fileId);
      saveTempExecFocus();

      var nextId = state.tempExecActiveId;
      if (state.tempExecActiveId === fileId) {
        if (isDbMode() && targetFile && targetFile.projectId) {
          var projectId = String(targetFile.projectId || '');
          var sameProject = state.tempExecFiles.filter(function(item) {
            return item && String(item.scope || '') === 'current' && String(item.projectId || '') === projectId;
          });
          nextId = sameProject.length ? sameProject[0].id : '';
        } else {
          var currentFiles = state.tempExecFiles.filter(function(item) { return item && item.scope === 'current'; });
          nextId = currentFiles.length ? currentFiles[0].id : (state.tempExecFiles[0] ? state.tempExecFiles[0].id : '');
        }
      }
      persistTempExecState();
      setTempExecActive(nextId);
      renderTempVersionGrid();
    }

    function reorderTempExecProject(sourceProjectId, targetProjectId, reorderOptions) {
      if (!isTempExecProjectLayoutEnabled()) return;
      var source = normalizeWorkspaceId(sourceProjectId);
      var target = normalizeWorkspaceId(targetProjectId);
      if (!source || !target || source === target) return;
      var insertAfter = reorderOptions && typeof reorderOptions === 'object'
        ? Boolean(reorderOptions.after)
        : reorderOptions === true;
      var placement = ensureTempExecPlacement();
      placement.projectOrder = reorderWorkspaceIds(placement.projectOrder, source, target, insertAfter);
      persistTempExecState();
      renderTempVersionGrid();
    }

    function reorderTempExecProjectVersion(projectId, sourceVersionId, targetVersionId, reorderOptions) {
      if (!isTempExecProjectLayoutEnabled()) return;
      var pid = normalizeWorkspaceId(projectId);
      if (!pid) return;
      var source = normalizeWorkspaceId(sourceVersionId);
      var target = normalizeWorkspaceId(targetVersionId);
      if (source === target) return;
      var insertAfter = reorderOptions && typeof reorderOptions === 'object'
        ? Boolean(reorderOptions.after)
        : reorderOptions === true;
      var placement = ensureTempExecPlacement();
      if (!placement.versionOrderByProject[pid]) placement.versionOrderByProject[pid] = [];
      var order = placement.versionOrderByProject[pid].filter(function(id) { return String(id) !== source; });
      var targetIndex = order.map(String).indexOf(target);
      if (targetIndex === -1) {
        if (insertAfter) order.push(source);
        else order.unshift(source);
      } else {
        order.splice(insertAfter ? targetIndex + 1 : targetIndex, 0, source);
      }
      placement.versionOrderByProject[pid] = order;
      persistTempExecState();
      renderTempVersionGrid();
    }

    function reorderTempExecFileInProjectVersion(projectId, versionId, fileId, beforeId) {
      if (!isTempExecProjectLayoutEnabled()) return;
      var pid = normalizeWorkspaceId(projectId);
      var id = normalizeWorkspaceId(fileId);
      if (!pid || !id) return;
      var version = normalizeWorkspaceId(versionId);
      var before = normalizeWorkspaceId(beforeId);
      var placement = ensureTempExecPlacement();
      if (!placement.fileOrderByProjectVersion[pid]) placement.fileOrderByProjectVersion[pid] = {};
      if (!placement.fileOrderByProjectVersion[pid][version]) placement.fileOrderByProjectVersion[pid][version] = [];
      var order = placement.fileOrderByProjectVersion[pid][version]
        .filter(function(item) { return String(item) !== id; });
      var beforeIndex = before ? order.map(String).indexOf(before) : -1;
      if (beforeIndex >= 0) order.splice(beforeIndex, 0, id);
      else order.push(id);
      placement.fileOrderByProjectVersion[pid][version] = order;
      persistTempExecState();
      renderTempVersionGrid();
    }

    function bulkRemoveTempExecFiles(fileIds, mutationOptions) {
      var list = normalizeWorkspaceFileIds(fileIds);
      if (!list.length) return;
      var removeSet = new Set(list.map(String));
      var removedActive = removeSet.has(String(state.tempExecActiveId || ''));
      var placement = ensureTempExecPlacement();
      var needsReload = false;
      var deletePromises = [];
      list.forEach(function(id) {
        var index = (state.tempExecFiles || []).findIndex(function(item) {
          return item && String(item.id) === String(id);
        });
        if (index === -1) return;
        var targetFile = state.tempExecFiles[index];
        if (targetFile && targetFile.restoredFromId) needsReload = true;
        if (isDbMode()) {
          var client = getApiClient();
          var execSetId = targetFile && (targetFile.execSetId || Number(targetFile.id));
          if (client && execSetId && typeof client.deleteExecSet === 'function') {
            var deletePromise = client.deleteExecSet(execSetId);
            if (deletePromise && typeof deletePromise.then === 'function') deletePromises.push(deletePromise);
          }
        }
        removeTempExecFromVersion(id, { silent: true });
        removeFileFromPlacement(id, targetFile, placement);
        clearFileUiState(id);
      });
      state.tempExecFiles = state.tempExecFiles.filter(function(file) {
        return file && !removeSet.has(String(file.id));
      });
      saveTempExecFocus();
      var nextId = removedActive ? (state.tempExecFiles[0] ? state.tempExecFiles[0].id : '') : state.tempExecActiveId;
      persistTempExecState();
      setTempExecActive(nextId);
      renderTempVersionGrid();
      renderTempExecView();
      if (needsReload && deletePromises.length && typeof Promise !== 'undefined') {
        Promise.all(deletePromises.map(function(promise) { return promise.catch(function() { return null; }); }))
          .then(loadTempExecState);
      } else if (needsReload) {
        loadTempExecState();
      }
      if (tempExecStatus && !(mutationOptions && mutationOptions.silentStatus)) {
        setStatus(tempExecStatus, '已移除 ' + list.length + ' 份用例', 'ok');
      }
    }

    function removeTempExecProject(projectId) {
      if (!isTempExecProjectLayoutEnabled()) return;
      var pid = normalizeWorkspaceId(projectId);
      if (!pid) return;
      if (!Array.isArray(state.tempExecArchivedHidden)) state.tempExecArchivedHidden = [];
      var hideKey = pid + '::';
      if (state.tempExecArchivedHidden.indexOf(hideKey) === -1) state.tempExecArchivedHidden.push(hideKey);
      if (Array.isArray(state.tempExecArchivedFiles) && state.tempExecArchivedFiles.length) {
        state.tempExecArchivedFiles = state.tempExecArchivedFiles.filter(function(file) {
          return !(file && String(file.projectId) === pid);
        });
      }
      var ids = (state.tempExecFiles || []).filter(function(file) {
        return file && String(file.projectId) === pid;
      }).map(function(file) { return String(file.id); });
      bulkRemoveTempExecFiles(ids, { silentStatus: false });
      renderTempExecOverview();
    }

    function removeTempExecProjectVersion(projectId, versionId) {
      if (!isTempExecProjectLayoutEnabled()) return;
      var pid = normalizeWorkspaceId(projectId);
      var version = normalizeWorkspaceId(versionId);
      if (!pid) return;
      if (!Array.isArray(state.tempExecArchivedHidden)) state.tempExecArchivedHidden = [];
      var hideKey = pid + '::' + version;
      if (state.tempExecArchivedHidden.indexOf(hideKey) === -1) state.tempExecArchivedHidden.push(hideKey);
      if (Array.isArray(state.tempExecArchivedFiles) && state.tempExecArchivedFiles.length) {
        state.tempExecArchivedFiles = state.tempExecArchivedFiles.filter(function(file) {
          return file && !(String(file.projectId) === pid && String(file.versionId || '') === version);
        });
      }
      var ids = (state.tempExecFiles || []).filter(function(file) {
        return file && String(file.projectId) === pid && String(file.versionId || '') === version;
      }).map(function(file) { return String(file.id); });
      bulkRemoveTempExecFiles(ids, { silentStatus: false });
      renderTempExecOverview();
    }

    function dissolveTempExecArchivedProjectVersion(projectId, versionId) {
      if (!isTempExecProjectLayoutEnabled()) return;
      var pid = normalizeWorkspaceId(projectId);
      var version = normalizeWorkspaceId(versionId);
      if (!pid) return;
      var archived = Array.isArray(state.tempExecArchivedFiles) ? state.tempExecArchivedFiles.slice() : [];
      var targets = archived.filter(function(file) {
        return file && String(file.projectId) === pid && String(file.versionId || '') === version;
      });
      if (!targets.length) {
        if (tempExecStatus) setStatus(tempExecStatus, '当前版本无已归档占位', 'ok');
        return;
      }
      if (!Array.isArray(state.tempExecArchivedHidden)) state.tempExecArchivedHidden = [];
      targets.forEach(function(file) {
        var id = file && file.id !== null && file.id !== undefined ? String(file.id) : '';
        if (id && state.tempExecArchivedHidden.indexOf(id) === -1) state.tempExecArchivedHidden.push(id);
      });
      state.tempExecArchivedFiles = archived.filter(function(file) {
        return file && !(String(file.projectId) === pid && String(file.versionId || '') === version);
      });
      persistTempExecState();
      renderTempVersionGrid();
      renderTempExecOverview();
      if (tempExecStatus) setStatus(tempExecStatus, '已解散归档占位（' + targets.length + ' 份）', 'ok');
    }

    return {
      removeTempExecFile: removeTempExecFile,
      reorderTempExecProject: reorderTempExecProject,
      reorderTempExecProjectVersion: reorderTempExecProjectVersion,
      reorderTempExecFileInProjectVersion: reorderTempExecFileInProjectVersion,
      bulkRemoveTempExecFiles: bulkRemoveTempExecFiles,
      removeTempExecProject: removeTempExecProject,
      removeTempExecProjectVersion: removeTempExecProjectVersion,
      dissolveTempExecArchivedProjectVersion: dissolveTempExecArchivedProjectVersion,
    };
  }

  return {
    create: create,
    normalizeWorkspaceId: normalizeWorkspaceId,
    normalizeWorkspaceFileIds: normalizeWorkspaceFileIds,
    reorderWorkspaceIds: reorderWorkspaceIds,
  };
});
