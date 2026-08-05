(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecPersistenceOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function(root) {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var state = opts.state || {};
    var browser = opts.window || root || {};
    var storage = opts.storage || (browser && browser.localStorage ? browser.localStorage : null);
    var tempExecStorageKey = opts.tempExecStorageKey || 'usecase-temp-exec-v1';
    var tempExecFocusStorageKey = opts.tempExecFocusStorageKey || 'tempexec-focus-v1';
    var defaultPlacement = opts.defaultPlacement || {};
    var defaultTempExecPageSize = opts.defaultTempExecPageSize || 20;
    var tempExecStatus = opts.tempExecStatus || null;
    var tempExecResultOptions = Array.isArray(opts.tempExecResultOptions)
      ? opts.tempExecResultOptions
      : ['未执行', '通过', '失败', '阻塞', '不适用'];
    var patchDelayMs = Number.isFinite(Number(opts.patchDelayMs)) ? Math.max(0, Number(opts.patchDelayMs)) : 320;
    var execSetPatchDelayMs = Number.isFinite(Number(opts.execSetPatchDelayMs)) ? Math.max(0, Number(opts.execSetPatchDelayMs)) : 400;
    var uiSaveDelayMs = Number.isFinite(Number(opts.uiSaveDelayMs)) ? Math.max(0, Number(opts.uiSaveDelayMs)) : 500;
    var setStatus = port('setStatus');
    var generateDefectLinkId = port('generateDefectLinkId', function() { return 'defect-' + Date.now(); });
    var normalizeRequirementName = port('normalizeRequirementName', function(value) { return String(value || '').trim(); });
    var normalizeTempExecCases = port('normalizeTempExecCases', function(value) { return Array.isArray(value) ? value : []; });
    var normalizeReusePresets = port('normalizeReusePresets', function(value) { return Array.isArray(value) ? value : []; });
    var normalizeTempExecPlacement = port('normalizeTempExecPlacement', function(value) { return value || {}; });
    var serializeTempExecFiles = port('serializeTempExecFiles', function() { return state.tempExecFiles || []; });
    var serializeTempExecVersions = port('serializeTempExecVersions', function() { return state.tempExecVersions || []; });
    var applyVersionAssignments = port('applyVersionAssignments');
    var resetTempExecPages = port('resetTempExecPages');
    var clampTempExecPageSize = port('clampTempExecPageSize', function(value) { return Number(value) || defaultTempExecPageSize; });
    var normalizeTempExecImportProjectFilterId = port('normalizeTempExecImportProjectFilterId', function(value) { return value ? String(value) : ''; });
    var syncTempExecPlacement = port('syncTempExecPlacement');
    var renderTempExecNav = port('renderTempExecNav');
    var renderTempExecView = port('renderTempExecView');
    var renderTempVersionGrid = port('renderTempVersionGrid');
    var renderTempFocusZone = port('renderTempFocusZone');
    var renderTempExecOverview = port('renderTempExecOverview');
    var notifyTempExecActiveChange = port('notifyTempExecActiveChange');
    var updateTempExecFileCountBadge = port('updateTempExecFileCountBadge');
    var updateTempExecFileStateClass = port('updateTempExecFileStateClass');
    var resetTempExecCaseStates = port('resetTempExecCaseStates');
    var applyPresetsToCase = port('applyPresetsToCase', function() { return false; });
    var pruneTempExecCaseLibraryDiffStore = port('pruneTempExecCaseLibraryDiffStore');
    var applyTempExecCaseLibraryDiffReset = port('applyTempExecCaseLibraryDiffReset');
    var parseDbTimeMs = port('parseDbTimeMs', function(value) { return Date.parse(value) || 0; });
    var isTempExecTabActive = port('isTempExecTabActive', function() { return false; });
    var consumeTempExecCaseLibrarySyncTrigger = port('consumeTempExecCaseLibrarySyncTrigger', function() { return false; });
    var applyTempExecCaseLibrarySyncMeta = port('applyTempExecCaseLibrarySyncMeta');
    var maybeOpenTempExecCaseLibraryAutoPopup = port('maybeOpenTempExecCaseLibraryAutoPopup', function() { return false; });
    var markTempExecNewAdded = port('markTempExecNewAdded');
    var getTempExecCaseUiKeys = port('getTempExecCaseUiKeys', function() { return []; });
    var syncTempExecFocus = port('syncTempExecFocus');

    var execCasePatchTimers = {};
    var execCasePatchQueue = {};
    var pendingExecCasePatchByTempId = {};
    var execSetPatchTimer = null;
    var execSetPatchQueue = {};
    var tempExecUiSaveTimer = null;
    var tempExecDbLoadSeq = 0;
    var tempExecDbLoadPromise = null;
    var tempExecDbLoadPending = false;

    function getApiClient() {
      return browser && browser.app && browser.app.apiClient ? browser.app.apiClient : null;
    }

    function isDbMode() {
      if (!browser || !browser.app || browser.app.authReady !== true) return false;
      var liveState = browser.app.state || state;
      var user = liveState && liveState.currentUser ? liveState.currentUser : null;
      if (!user || !user.id) return false;
      var client = getApiClient();
      return Boolean(client
        && typeof client.listExecSets === 'function'
        && typeof client.listExecCases === 'function'
        && typeof client.updateExecCase === 'function');
    }

    function queueExecCasePatch(execCaseId, patch, queueOptions) {
      if (!execCaseId || !patch || typeof patch !== 'object') return;
      if (!execCasePatchQueue[execCaseId]) execCasePatchQueue[execCaseId] = {};
      Object.keys(patch).forEach(function(key) { execCasePatchQueue[execCaseId][key] = patch[key]; });
      if (execCasePatchTimers[execCaseId]) clearTimeout(execCasePatchTimers[execCaseId]);
      execCasePatchTimers[execCaseId] = setTimeout(function() {
        var payload = execCasePatchQueue[execCaseId] || null;
        delete execCasePatchQueue[execCaseId];
        delete execCasePatchTimers[execCaseId];
        if (!payload) return;
        var client = getApiClient();
        if (!client || typeof client.updateExecCase !== 'function') return;
        client.updateExecCase(execCaseId, payload).catch(function(error) {
          if (tempExecStatus) setStatus(tempExecStatus, error && error.message ? error.message : '执行数据保存失败', 'err');
          if (queueOptions && typeof queueOptions.onError === 'function') {
            try { queueOptions.onError(error); } catch (ignored) {}
          }
        });
      }, patchDelayMs);
    }

    function queueExecCasePatchForItem(item, patch) {
      if (!item || !patch || typeof patch !== 'object') return;
      var caseId = item.execCaseId || item.id;
      if (caseId) {
        queueExecCasePatch(caseId, patch);
        return;
      }
      var tempId = item._tempId ? String(item._tempId) : '';
      if (!tempId) return;
      if (!pendingExecCasePatchByTempId[tempId] || typeof pendingExecCasePatchByTempId[tempId] !== 'object') {
        pendingExecCasePatchByTempId[tempId] = {};
      }
      Object.keys(patch).forEach(function(key) { pendingExecCasePatchByTempId[tempId][key] = patch[key]; });
    }

    function consumePendingExecCasePatch(tempId) {
      var key = tempId ? String(tempId) : '';
      if (!key) return null;
      var payload = pendingExecCasePatchByTempId[key] || null;
      if (payload) delete pendingExecCasePatchByTempId[key];
      return payload;
    }

    function clearPendingExecCasePatch(tempId) {
      var key = tempId ? String(tempId) : '';
      if (key && pendingExecCasePatchByTempId[key]) delete pendingExecCasePatchByTempId[key];
    }

    function queueExecSetPatch(execSetId, patch) {
      if (!execSetId || !patch || typeof patch !== 'object') return;
      Object.keys(patch).forEach(function(key) { execSetPatchQueue[key] = patch[key]; });
      if (execSetPatchTimer) clearTimeout(execSetPatchTimer);
      execSetPatchTimer = setTimeout(function() {
        execSetPatchTimer = null;
        var payload = execSetPatchQueue;
        execSetPatchQueue = {};
        var client = getApiClient();
        if (!client || typeof client.updateExecSet !== 'function') return;
        client.updateExecSet(execSetId, payload).catch(function(error) {
          if (tempExecStatus) setStatus(tempExecStatus, error && error.message ? error.message : '执行集保存失败', 'err');
        });
      }, execSetPatchDelayMs);
    }

    function scheduleTempExecUiSave() {
      if (!isDbMode()) return;
      var client = getApiClient();
      if (!client || typeof client.saveSettings !== 'function') return;
      if (tempExecUiSaveTimer) clearTimeout(tempExecUiSaveTimer);
      tempExecUiSaveTimer = setTimeout(function() {
        tempExecUiSaveTimer = null;
        var payload = {
          type: 'tempexec_ui_v1',
          activeId: state.tempExecActiveId || '',
          placement: state.tempExecPlacement || defaultPlacement,
          collapsed: {
            req: Boolean(state.tempExecReqCollapsed),
            version: Boolean(state.tempExecVersionCollapsed),
          },
          focus: Array.isArray(state.tempExecFocus) ? state.tempExecFocus : [],
          versions: serializeTempExecVersions(state),
          pageSize: state.tempExecPageSize || defaultTempExecPageSize,
          importProjectFilterId: state.tempExecImportProjectFilterId ? String(state.tempExecImportProjectFilterId) : '',
          archivedHidden: Array.isArray(state.tempExecArchivedHidden) ? state.tempExecArchivedHidden : [],
        };
        client.saveSettings('user', [{ key: 'tempexec_ui_v1', value_json: payload }]).catch(function() {});
      }, uiSaveDelayMs);
    }

    function persistTempExecState() {
      if (isDbMode()) {
        scheduleTempExecUiSave();
        return;
      }
      if (!storage || typeof storage.setItem !== 'function') return;
      try {
        storage.setItem(tempExecStorageKey, JSON.stringify({
          files: serializeTempExecFiles(state),
          versions: serializeTempExecVersions(state),
          placement: state.tempExecPlacement || defaultPlacement,
          collapsed: {
            req: Boolean(state.tempExecReqCollapsed),
            version: Boolean(state.tempExecVersionCollapsed),
          },
          activeId: state.tempExecActiveId || '',
        }));
      } catch (error) {
        if (typeof console !== 'undefined' && console.warn) console.warn('临时执行数据保存失败', error);
      }
    }

    function normalizeExecStatus(value) {
      var text = value === null || value === undefined ? '' : String(value);
      return !text || text === 'pending' ? '未执行' : text;
    }

    function normalizeExecCaseStatus(item) {
      var status = normalizeExecStatus(item && item.status !== null && item.status !== undefined ? item.status : '');
      if (status && status !== '未执行') return status;
      var actualText = item && item.actual_result !== null && item.actual_result !== undefined
        ? String(item.actual_result).trim()
        : '';
      if (!actualText || actualText === 'pending') return status || '未执行';
      if (actualText === '变更重跑' || actualText === '有改动' || tempExecResultOptions.indexOf(actualText) !== -1) return actualText;
      return status || '未执行';
    }

    function normalizeExecCaseRemark(item) {
      var remark = item && item.remark !== null && item.remark !== undefined ? String(item.remark) : '';
      if (remark && remark.trim()) return remark;
      var actualText = item && item.actual_result !== null && item.actual_result !== undefined
        ? String(item.actual_result).trim()
        : '';
      if (!actualText || actualText === 'pending' || actualText === '变更重跑' || actualText === '有改动') return remark;
      return tempExecResultOptions.indexOf(actualText) !== -1 ? remark : actualText;
    }

    function normalizeExecReuseDetails(raw) {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (typeof raw !== 'string') return [];
      try {
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    }

    function isBlankDefectText(text) {
      if (text === null || text === undefined || !String(text).trim()) return true;
      var lower = String(text).trim().toLowerCase();
      return lower === 'null' || lower === 'undefined';
    }

    function extractDefectLinksFromRaw(raw) {
      var list = [];
      if (raw === null || raw === undefined) return list;
      if (Array.isArray(raw)) {
        raw.forEach(function(entry) { list = list.concat(extractDefectLinksFromRaw(entry)); });
        return list;
      }
      if (typeof raw === 'object') {
        var url = raw.url || raw.value || '';
        if (!isBlankDefectText(url)) list.push({ id: raw.id ? String(raw.id) : generateDefectLinkId(), url: String(url).trim() });
        return list;
      }
      var text = String(raw).trim();
      if (isBlankDefectText(text)) return list;
      if (text[0] === '[' || text[0] === '{') {
        try { return extractDefectLinksFromRaw(JSON.parse(text)); } catch (error) {}
      }
      text.replace(/\r\n/g, '\n').split(/[\s\n,;，；]+/).forEach(function(part) {
        if (!isBlankDefectText(part)) list.push({ id: generateDefectLinkId(), url: String(part).trim() });
      });
      return list;
    }

    function normalizeDefectLinksFromExecCase(item) {
      var merged = item
        ? extractDefectLinksFromRaw(item.defect_links).concat(extractDefectLinksFromRaw(item.defect_link))
        : [];
      var seen = {};
      return merged.filter(function(entry) {
        var url = entry && entry.url ? String(entry.url).trim() : '';
        if (!url || seen[url]) return false;
        seen[url] = true;
        entry.url = url;
        return true;
      });
    }

    function mapExecCaseToTempCase(item) {
      if (!item) return null;
      return {
        id: item.id,
        execCaseId: item.id,
        caseItemId: item.case_item_id || null,
        caseItemSourceId: item.case_item_source_id || null,
        module: item.module || '',
        title: item.title || '',
        priority: item.priority || '',
        preconditions: item.precondition || '',
        steps: item.steps || '',
        expected: item.expected || '',
        actual: normalizeExecCaseStatus(item),
        remark: normalizeExecCaseRemark(item),
        reuseDetails: normalizeExecReuseDetails(item.reuse_details),
        defectLinks: normalizeDefectLinksFromExecCase(item),
      };
    }

    function loadTempExecFocus() {
      var saved = [];
      if (storage && typeof storage.getItem === 'function') {
        try { saved = JSON.parse(storage.getItem(tempExecFocusStorageKey) || '[]'); } catch (error) { saved = []; }
      }
      if (!Array.isArray(saved)) saved = [];
      state.tempExecFocus = saved.filter(function(id) { return typeof id === 'string'; });
      syncTempExecFocus(true);
      saveTempExecFocus();
    }

    function saveTempExecFocus() {
      if (storage && typeof storage.setItem === 'function') {
        try {
          storage.setItem(tempExecFocusStorageKey, JSON.stringify(state.tempExecFocus));
        } catch (error) {
          if (typeof console !== 'undefined' && console.warn) console.warn('专注区数据保存失败', error);
        }
      }
      scheduleTempExecUiSave();
    }

    function commitTempExecUndoToDb() {
      if (!isDbMode()) return;
      var client = getApiClient();
      if (!client || typeof client.createExecCase !== 'function' || typeof client.deleteExecCase !== 'function') return;
      if (!Array.isArray(state.tempExecUndoStack) || !state.tempExecUndoStack.length) return;
      var chain = Promise.resolve();
      state.tempExecUndoStack.slice().forEach(function(entry) {
        chain = chain.then(function() {
          var payload = entry && entry.data ? entry.data : null;
          if (!payload || !payload.type) return;
          if (payload.type === 'remove' && Array.isArray(payload.cases)) {
            var removeChain = Promise.resolve();
            payload.cases.forEach(function(item) {
              if (item && !item.execCaseId && !item.id && item._tempId) clearPendingExecCasePatch(item._tempId);
              removeChain = removeChain.then(function() {
                var caseId = item && (item.execCaseId || item.id);
                return caseId ? client.deleteExecCase(caseId).catch(function() {}) : undefined;
              });
            });
            return removeChain;
          }
          if (payload.type !== 'insert') return;
          var file = (state.tempExecFiles || []).find(function(item) { return item && item.id === payload.fileId; }) || null;
          if (!file || !Array.isArray(file.cases)) return;
          var insertCase = payload.tempId
            ? file.cases.find(function(item) { return item && item._tempId === payload.tempId; }) || null
            : null;
          if (!insertCase && typeof payload.index === 'number') insertCase = file.cases[payload.index] || null;
          if (!insertCase || insertCase.execCaseId || insertCase.id) return;
          var tempId = insertCase._tempId ? String(insertCase._tempId) : '';
          var caseIndex = file.cases.indexOf(insertCase);
          var afterCaseId = null;
          for (var index = caseIndex - 1; index >= 0; index -= 1) {
            var previous = file.cases[index];
            var previousId = previous && (previous.execCaseId || previous.id);
            if (previousId) {
              afterCaseId = previousId;
              break;
            }
          }
          var execSetId = file.execSetId || Number(file.id);
          if (!execSetId) return;
          return client.createExecCase(execSetId, {
            after_case_id: afterCaseId || null,
            module: insertCase.module || '',
            title: insertCase.title || '',
            expected: insertCase.expected || '',
            priority: insertCase.priority || '',
            precondition: insertCase.preconditions || '',
            steps: insertCase.steps || '',
            remark: insertCase.remark || '',
            status: insertCase.actual || '未执行',
            reuse_details: insertCase.reuseDetails || [],
            defect_links: insertCase.defectLinks || [],
          }).then(function(created) {
            if (!created || !created.id) return;
            insertCase.execCaseId = created.id;
            insertCase.id = created.id;
            insertCase.caseItemId = created.case_item_id || null;
            insertCase.pendingCreate = false;
            var pendingPatch = tempId ? consumePendingExecCasePatch(tempId) : null;
            if (pendingPatch) queueExecCasePatch(created.id, pendingPatch);
            delete insertCase._tempId;
            markTempExecNewAdded(file.id, insertCase);
          }).catch(function() {});
        });
      });
      chain.catch(function() {});
    }

    async function readTempExecUiSettings(client) {
      var result = { uiState: null, hasPageSize: false, pageSize: null };
      if (!client || typeof client.listSettings !== 'function') return result;
      try {
        var settings = await client.listSettings('user');
        (Array.isArray(settings) ? settings : []).forEach(function(item) {
          if (!item || !item.key) return;
          if (item.key === 'tempexec_ui_v1') {
            result.uiState = item.value_json && typeof item.value_json === 'object' ? item.value_json : null;
          } else if (item.key === 'tempExecPageSize') {
            result.pageSize = item.value_json;
            result.hasPageSize = true;
          }
        });
      } catch (error) {
        result.uiState = null;
      }
      return result;
    }

    function activeExecSets(rawSets) {
      return (Array.isArray(rawSets) ? rawSets : []).filter(function(item) {
        return item && String(item.status || '') === 'active';
      }).slice().sort(function(a, b) {
        return parseDbTimeMs(b && b.updated_at) - parseDbTimeMs(a && a.updated_at);
      });
    }

    function filterArchivedExecSets(rawSets, activeSets, hiddenKeys) {
      var restoredIds = {};
      activeSets.forEach(function(item) {
        var restoredId = item && item.restored_from_id !== null && item.restored_from_id !== undefined
          ? item.restored_from_id
          : (item && item.restoredFromId !== null && item.restoredFromId !== undefined ? item.restoredFromId : null);
        if (restoredId !== null && restoredId !== undefined) restoredIds[String(restoredId)] = true;
      });
      var hidden = {};
      hiddenKeys.forEach(function(key) { hidden[String(key)] = true; });
      return (Array.isArray(rawSets) ? rawSets : []).filter(function(item) {
        if (!item || String(item.status || '') !== 'archived') return false;
        var id = item.id !== null && item.id !== undefined ? String(item.id) : '';
        if (!id || restoredIds[id] || hidden[id]) return false;
        var projectId = item.project_id !== null && item.project_id !== undefined ? String(item.project_id) : '';
        if (!projectId) return true;
        var versionId = item.version_id !== null && item.version_id !== undefined ? String(item.version_id || '') : '';
        return !hidden[projectId + '::'] && !hidden[projectId + '::' + versionId];
      }).slice().sort(function(a, b) {
        return parseDbTimeMs(b && (b.archived_at || b.updated_at)) - parseDbTimeMs(a && (a.archived_at || a.updated_at));
      }).slice(0, 80);
    }

    function pruneArchivedHiddenKeys(activeSets, hiddenKeys) {
      var activeKeys = {};
      activeSets.forEach(function(item) {
        var projectId = item && item.project_id !== null && item.project_id !== undefined ? String(item.project_id) : '';
        if (!projectId) return;
        var versionId = item.version_id !== null && item.version_id !== undefined ? String(item.version_id || '') : '';
        activeKeys[projectId + '::'] = true;
        activeKeys[projectId + '::' + versionId] = true;
      });
      return hiddenKeys.filter(function(key) {
        var normalized = String(key || '').trim();
        return normalized && (normalized.indexOf('::') === -1 || !activeKeys[normalized]);
      });
    }

    async function loadExecSetMetadata(client, execSets) {
      var caseFileMetaById = {};
      var projectIds = [];
      execSets.forEach(function(item) {
        var projectId = item && item.project_id !== null && item.project_id !== undefined ? String(item.project_id) : '';
        if (projectId && projectIds.indexOf(projectId) === -1) projectIds.push(projectId);
      });
      if (typeof client.listProjects === 'function') {
        try {
          var projects = await client.listProjects();
          state.projects = Array.isArray(projects) ? projects : [];
        } catch (error) {
          state.projects = Array.isArray(state.projects) ? state.projects : [];
        }
      }
      state.projectVersionsByProject = state.projectVersionsByProject && typeof state.projectVersionsByProject === 'object'
        ? state.projectVersionsByProject
        : {};
      if (typeof client.listProjectVersions === 'function') {
        await Promise.all(projectIds.map(function(projectId) {
          return client.listProjectVersions(projectId).then(function(versions) {
            state.projectVersionsByProject[String(projectId)] = Array.isArray(versions) ? versions : [];
          }).catch(function() {});
        }));
      }
      if (typeof client.listCaseFiles === 'function') {
        await Promise.all(projectIds.map(function(projectId) {
          return client.listCaseFiles(Number(projectId)).then(function(files) {
            (Array.isArray(files) ? files : []).forEach(function(item) {
              if (!item || item.id === null || item.id === undefined) return;
              caseFileMetaById[String(item.id)] = {
                project_id: item.project_id,
                version_id: item.version_id,
                item_count: item.item_count,
              };
            });
          }).catch(function() {});
        }));
      }
      return caseFileMetaById;
    }

    function mapExecSetToFile(execSet, caseFileMetaById, archived) {
      var createdAt = parseDbTimeMs(execSet && execSet.created_at);
      if (!Number.isFinite(createdAt) || createdAt <= 0) createdAt = Date.now();
      var caseFileId = execSet && execSet.case_file_id !== null && execSet.case_file_id !== undefined
        ? String(execSet.case_file_id)
        : '';
      var meta = caseFileId && caseFileMetaById[caseFileId] ? caseFileMetaById[caseFileId] : null;
      var projectId = execSet && execSet.project_id !== null && execSet.project_id !== undefined
        ? String(execSet.project_id)
        : (meta && meta.project_id !== null && meta.project_id !== undefined ? String(meta.project_id) : '');
      var versionId = execSet && execSet.version_id !== null && execSet.version_id !== undefined
        ? String(execSet.version_id)
        : (meta && meta.version_id !== null && meta.version_id !== undefined ? String(meta.version_id) : '');
      var caseCount = execSet && execSet.case_count !== null && execSet.case_count !== undefined
        ? Number(execSet.case_count)
        : (meta && meta.item_count !== null && meta.item_count !== undefined ? Number(meta.item_count) : 0);
      if (!Number.isFinite(caseCount) || caseCount < 0) caseCount = 0;
      var file = {
        id: String(execSet.id),
        execSetId: execSet.id,
        caseFileId: execSet.case_file_id || null,
        projectId: projectId,
        name: execSet.name || '测试用例',
        cases: [],
        caseCount: caseCount,
        scope: archived ? 'archived' : 'current',
        status: archived ? 'archived' : String(execSet.status || 'active'),
        requirement: normalizeRequirementName(execSet.requirement) || '',
        reuseEnabled: Boolean(execSet.reuse_enabled),
        associationEnabled: Boolean(execSet.association_enabled),
        createdAt: createdAt,
        reusePresets: Array.isArray(execSet.reuse_presets) ? normalizeReusePresets(execSet.reuse_presets) : [],
        versionId: versionId,
        _casesLoading: true,
      };
      if (archived) {
        var archivedAt = parseDbTimeMs(execSet.archived_at || execSet.updated_at || execSet.created_at);
        file.archivedAt = archivedAt > 0 ? archivedAt : createdAt;
      } else {
        var restoredFromId = execSet.restored_from_id !== null && execSet.restored_from_id !== undefined
          ? execSet.restored_from_id
          : execSet.restoredFromId;
        file.restoredFromId = restoredFromId !== null && restoredFromId !== undefined ? String(restoredFromId) : '';
      }
      return file;
    }

    function applyLoadedUiState(uiState, settingsInfo, archivedHiddenKeys) {
      state.tempExecSelections = {};
      state.tempExecRemarkOpen = {};
      state.tempExecReuseOpen = {};
      state.tempExecReuseBatchExpanded = {};
      state.tempExecDefectOpen = {};
      state.tempExecPresetDraft = null;
      resetTempExecPages();
      if (uiState && uiState.placement) state.tempExecPlacement = normalizeTempExecPlacement(uiState.placement);
      if (uiState && uiState.collapsed) {
        state.tempExecReqCollapsed = Boolean(uiState.collapsed.req);
        state.tempExecVersionCollapsed = Boolean(uiState.collapsed.version);
      }
      state.tempExecReqCollapsed = true;
      if (uiState && Array.isArray(uiState.focus)) {
        state.tempExecFocus = uiState.focus.filter(function(id) {
          return state.tempExecFiles.some(function(file) { return file && String(file.id) === String(id); });
        });
      } else {
        state.tempExecFocus = Array.isArray(state.tempExecFocus) ? state.tempExecFocus : [];
      }
      state.tempExecVersions = [];
      var resolvedPageSize = null;
      if (settingsInfo.hasPageSize) resolvedPageSize = clampTempExecPageSize(settingsInfo.pageSize);
      else if (uiState && uiState.pageSize !== null && uiState.pageSize !== undefined) {
        resolvedPageSize = clampTempExecPageSize(uiState.pageSize);
      }
      if (resolvedPageSize !== null) state.tempExecPageSize = resolvedPageSize;
      state.tempExecImportProjectFilterId = normalizeTempExecImportProjectFilterId(
        uiState && uiState.importProjectFilterId !== null && uiState.importProjectFilterId !== undefined
          ? uiState.importProjectFilterId
          : state.tempExecImportProjectFilterId
      );
      state.tempExecArchivedHidden = archivedHiddenKeys.slice();
      syncTempExecPlacement();
    }

    function selectLoadedActiveFile(uiState) {
      var files = state.tempExecFiles || [];
      var savedActiveId = uiState && uiState.activeId ? String(uiState.activeId) : '';
      var currentActiveId = state.tempExecActiveId ? String(state.tempExecActiveId) : '';
      if (currentActiveId && files.some(function(file) { return file && String(file.id) === currentActiveId; })) {
        state.tempExecActiveId = currentActiveId;
        return;
      }
      if (savedActiveId && files.some(function(file) { return file && String(file.id) === savedActiveId; })) {
        state.tempExecActiveId = savedActiveId;
        return;
      }
      var context = state.tempExecLastActiveContext && typeof state.tempExecLastActiveContext === 'object'
        ? state.tempExecLastActiveContext
        : null;
      var projectId = context && context.projectId ? String(context.projectId) : '';
      var versionId = context && context.versionId !== null && context.versionId !== undefined ? String(context.versionId || '') : '';
      if (projectId) {
        var projectFiles = files.filter(function(file) { return file && String(file.projectId || '') === projectId; });
        var versionFiles = versionId
          ? projectFiles.filter(function(file) { return file && String(file.versionId || '') === versionId; })
          : [];
        state.tempExecActiveId = versionFiles.length
          ? String(versionFiles[0].id)
          : (projectFiles.length ? String(projectFiles[0].id) : '');
        return;
      }
      state.tempExecActiveId = files.length ? files[0].id : '';
    }

    async function loadExecCasesInChunks(client, files, loadSeq, archived) {
      var activeId = state.tempExecActiveId ? String(state.tempExecActiveId) : '';
      var order = files.map(function(file, index) { return index; });
      if (!archived && activeId) {
        order.sort(function(a, b) {
          if (String(files[a] && files[a].id) === activeId) return -1;
          if (String(files[b] && files[b].id) === activeId) return 1;
          return a - b;
        });
      }
      var concurrency = archived ? 3 : 4;
      var allowAutoPopup = !archived && isTempExecTabActive(true);
      var autoPopupOpened = false;
      for (var start = 0; start < order.length; start += concurrency) {
        var chunk = order.slice(start, start + concurrency);
        await Promise.all(chunk.map(function(index) {
          var file = files[index];
          if (!file) return Promise.resolve();
          var syncChain = Promise.resolve();
          if (!archived && typeof client.syncExecSetCaseLibrary === 'function' && file.execSetId) {
            syncChain = client.syncExecSetCaseLibrary(file.execSetId).then(function(syncResponse) {
              applyTempExecCaseLibrarySyncMeta(file, syncResponse);
              if (allowAutoPopup && !autoPopupOpened && maybeOpenTempExecCaseLibraryAutoPopup(true, state.tempExecActiveId || activeId)) {
                autoPopupOpened = true;
              }
            }).catch(function() {});
          }
          return syncChain.then(function() {
            return client.listExecCases(file.execSetId).then(function(rawCases) {
              if (tempExecDbLoadSeq !== loadSeq) return;
              var cases = (Array.isArray(rawCases) ? rawCases : []).map(mapExecCaseToTempCase).filter(Boolean);
              if (!archived && file.reuseEnabled && Array.isArray(file.reusePresets) && file.reusePresets.length) {
                cases.forEach(function(item) {
                  if (applyPresetsToCase(file, item)) queueExecCasePatchForItem(item, { reuse_details: item.reuseDetails || [] });
                });
              }
              file.cases = cases;
              var existingCount = Number(file.caseCount);
              if (cases.length > 0 || !Number.isFinite(existingCount) || existingCount <= 0) file.caseCount = cases.length;
              file._casesLoading = false;
              if (!archived) {
                updateTempExecFileCountBadge(file.id);
                updateTempExecFileStateClass(file.id);
                if (String(file.id) === String(state.tempExecActiveId || '')) renderTempExecView();
              }
              renderTempExecOverview();
            }).catch(function() {
              if (tempExecDbLoadSeq !== loadSeq) return;
              file.cases = [];
              if (!Number.isFinite(Number(file.caseCount)) || Number(file.caseCount) <= 0) file.caseCount = 0;
              file._casesLoading = false;
              if (!archived) updateTempExecFileStateClass(file.id);
              renderTempExecOverview();
            });
          });
        }));
        if (tempExecDbLoadSeq !== loadSeq) return false;
      }
      if (!archived && !autoPopupOpened) maybeOpenTempExecCaseLibraryAutoPopup(allowAutoPopup, activeId);
      return true;
    }

    async function loadTempExecStateFromDb() {
      if (tempExecDbLoadPromise) {
        tempExecDbLoadPending = true;
        return tempExecDbLoadPromise;
      }
      var client = getApiClient();
      if (!client || typeof client.listExecSets !== 'function') return;
      tempExecDbLoadSeq += 1;
      var loadSeq = tempExecDbLoadSeq;
      var promise = (async function() {
        if (tempExecStatus) setStatus(tempExecStatus, '加载执行数据中...', '');
        var settingsInfo = await readTempExecUiSettings(client);
        var rawActiveSets = [];
        try {
          rawActiveSets = await client.listExecSets();
        } catch (error) {
          if (tempExecStatus) setStatus(tempExecStatus, error && error.message ? error.message : '加载执行数据失败', 'err');
          return;
        }
        var activeSets = activeExecSets(rawActiveSets);
        var archivedHiddenKeys = settingsInfo.uiState && Array.isArray(settingsInfo.uiState.archivedHidden)
          ? settingsInfo.uiState.archivedHidden.map(function(key) { return String(key || '').trim(); }).filter(Boolean)
          : [];
        var prunedHiddenKeys = pruneArchivedHiddenKeys(activeSets, archivedHiddenKeys);
        var hiddenChanged = prunedHiddenKeys.length !== archivedHiddenKeys.length;
        var rawArchivedSets = [];
        try {
          rawArchivedSets = await client.listExecSets(null, { status_filter: 'archived' });
        } catch (error2) {
          rawArchivedSets = [];
        }
        var archivedSets = filterArchivedExecSets(rawArchivedSets, activeSets, prunedHiddenKeys);
        var metadata = await loadExecSetMetadata(client, activeSets.concat(archivedSets));
        var files = activeSets.map(function(item) { return mapExecSetToFile(item, metadata, false); });
        var archivedFiles = archivedSets.map(function(item) { return mapExecSetToFile(item, metadata, true); });
        if (tempExecDbLoadSeq !== loadSeq) return;
        state.tempExecFiles = files;
        state.tempExecArchivedFiles = archivedFiles;
        pruneTempExecCaseLibraryDiffStore(files.map(function(file) { return String(file.execSetId || file.id || ''); }));
        applyTempExecCaseLibraryDiffReset();
        applyLoadedUiState(settingsInfo.uiState, settingsInfo, prunedHiddenKeys);
        if (hiddenChanged) scheduleTempExecUiSave();
        selectLoadedActiveFile(settingsInfo.uiState);
        renderTempExecNav();
        renderTempExecView();
        renderTempVersionGrid();
        renderTempFocusZone();

        if (typeof client.listExecCases !== 'function') {
          if (tempExecStatus) setStatus(tempExecStatus, '', '');
          return;
        }
        consumeTempExecCaseLibrarySyncTrigger();
        await loadExecCasesInChunks(client, files, loadSeq, false);
        if (tempExecDbLoadSeq !== loadSeq) return;
        await loadExecCasesInChunks(client, archivedFiles, loadSeq, true);
        if (tempExecDbLoadSeq === loadSeq && tempExecStatus) setStatus(tempExecStatus, '', '');
      })();
      tempExecDbLoadPromise = promise;
      promise.finally(function() {
        if (tempExecDbLoadPromise === promise) tempExecDbLoadPromise = null;
        if (tempExecDbLoadPending) {
          tempExecDbLoadPending = false;
          loadTempExecStateFromDb();
        }
      });
      return promise;
    }

    async function loadTempExecState() {
      if (isDbMode()) {
        await loadTempExecStateFromDb();
        return;
      }
      var savedRaw = [];
      if (storage && typeof storage.getItem === 'function') {
        try {
          savedRaw = JSON.parse(storage.getItem(tempExecStorageKey) || '[]');
        } catch (error) {
          if (typeof console !== 'undefined' && console.warn) console.warn('临时执行数据解析失败', error);
          savedRaw = [];
        }
      }
      var savedFiles = Array.isArray(savedRaw) ? savedRaw : (Array.isArray(savedRaw.files) ? savedRaw.files : []);
      var savedVersions = Array.isArray(savedRaw && savedRaw.versions) ? savedRaw.versions : [];
      var savedPlacement = savedRaw && !Array.isArray(savedRaw) && savedRaw.placement && typeof savedRaw.placement === 'object'
        ? savedRaw.placement
        : null;
      var savedCollapsed = savedRaw && !Array.isArray(savedRaw) && savedRaw.collapsed && typeof savedRaw.collapsed === 'object'
        ? savedRaw.collapsed
        : null;
      var savedActiveId = savedRaw && !Array.isArray(savedRaw) && savedRaw.activeId ? String(savedRaw.activeId) : '';
      var usedIds = {};
      state.tempExecFiles = savedFiles.map(function(item) {
        if (!item || typeof item !== 'object') return null;
        var fileId = item.id || ('tempexec-' + Date.now() + '-' + Math.random());
        while (usedIds[fileId]) fileId = 'tempexec-' + Date.now() + '-' + Math.random();
        var cases = normalizeTempExecCases(item.cases || [], fileId);
        if (!cases.length) return null;
        usedIds[fileId] = true;
        return {
          id: fileId,
          name: item.name || '测试用例',
          cases: cases,
          scope: 'history',
          requirement: normalizeRequirementName(item.requirement) || '',
          reuseEnabled: Boolean(item.reuseEnabled),
          createdAt: Number.isFinite(Number(item.createdAt)) ? Number(item.createdAt) : Date.now(),
          reusePresets: item.reusePresets ? normalizeReusePresets(item.reusePresets) : [],
          projectId: item.projectId ? String(item.projectId) : '',
          versionId: item.versionId || '',
        };
      }).filter(Boolean);
      applyVersionAssignments(savedVersions);
      state.tempExecPlacement = normalizeTempExecPlacement(savedPlacement);
      state.tempExecReqCollapsed = Boolean(savedCollapsed && savedCollapsed.req);
      state.tempExecVersionCollapsed = Boolean(savedCollapsed && savedCollapsed.version);
      state.tempExecActiveId = savedActiveId && state.tempExecFiles.some(function(file) { return file.id === savedActiveId; })
        ? savedActiveId
        : (state.tempExecFiles.length ? state.tempExecFiles[0].id : '');
      state.tempExecSelections = {};
      state.tempExecRemarkOpen = {};
      state.tempExecReuseOpen = {};
      state.tempExecReuseBatchExpanded = {};
      state.tempExecDefectOpen = {};
      state.tempExecPresetDraft = null;
      resetTempExecPages();
      loadTempExecFocus();
      syncTempExecPlacement();
      renderTempExecNav();
      renderTempExecView();
      renderTempVersionGrid();
      renderTempFocusZone();
      notifyTempExecActiveChange(state.tempExecActiveId);
    }

    function refreshTempExecStateOnTabActivation() {
      if (!isDbMode()) return null;
      return loadTempExecStateFromDb();
    }

    return {
      getApiClient: getApiClient,
      isDbMode: isDbMode,
      queueExecCasePatch: queueExecCasePatch,
      queueExecCasePatchForItem: queueExecCasePatchForItem,
      consumePendingExecCasePatch: consumePendingExecCasePatch,
      clearPendingExecCasePatch: clearPendingExecCasePatch,
      queueExecSetPatch: queueExecSetPatch,
      scheduleTempExecUiSave: scheduleTempExecUiSave,
      persistTempExecState: persistTempExecState,
      normalizeExecStatus: normalizeExecStatus,
      normalizeExecCaseStatus: normalizeExecCaseStatus,
      normalizeExecCaseRemark: normalizeExecCaseRemark,
      normalizeExecReuseDetails: normalizeExecReuseDetails,
      extractDefectLinksFromRaw: extractDefectLinksFromRaw,
      normalizeDefectLinksFromExecCase: normalizeDefectLinksFromExecCase,
      mapExecCaseToTempCase: mapExecCaseToTempCase,
      loadTempExecStateFromDb: loadTempExecStateFromDb,
      loadTempExecState: loadTempExecState,
      refreshTempExecStateOnTabActivation: refreshTempExecStateOnTabActivation,
      loadTempExecFocus: loadTempExecFocus,
      saveTempExecFocus: saveTempExecFocus,
      commitTempExecUndoToDb: commitTempExecUndoToDb,
    };
  }

  return { create: create };
});
