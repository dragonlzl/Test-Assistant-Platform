(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecStateSnapshotOwner = api;
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
    var reuseApplicabilityCore = opts.reuseApplicabilityCore || null;
    var defaultTempExecColumns = opts.defaultTempExecColumns || {};
    var defaultPlacement = opts.defaultPlacement || {
      requirementOrder: [],
      fileOrder: {},
      versionOrder: [],
      projectOrder: [],
      versionOrderByProject: {},
      fileOrderByProjectVersion: {},
    };
    var modelsStorageKey = opts.modelsStorageKey || 'cleaner-models-v1';
    var assignmentStorageKey = opts.assignmentStorageKey || 'cleaner-assignment-v1';
    var tempExecStatus = opts.tempExecStatus || null;
    var storage = opts.storage || (root && root.localStorage ? root.localStorage : null);
    var normalizeRequirementName = port('normalizeRequirementName', function(text) { return text || ''; });
    var generateReuseDetailId = port('generateReuseDetailId', function() { return 'reuse-detail-' + Date.now(); });
    var generateReusePresetId = port('generateReusePresetId', function() { return 'reuse-' + Date.now(); });
    var generateDefectLinkId = port('generateDefectLinkId', function() { return 'defect-' + Date.now(); });
    var generateTempExecId = port('generateTempExecId', function() { return 'tempexec-' + Date.now(); });
    var stringifyCaseField = port('stringifyCaseField', function(value) {
      return value === null || value === undefined ? '' : String(value);
    });
    var getSafeFileBaseName = port('getSafeFileBaseName', function(name, fallback) {
      return String(name || fallback || 'temp_exec');
    });
    var getRequirementLabel = port('getRequirementLabel', function() { return ''; });
    var setStatus = port('setStatus');
    var getTempExecPageSize = port('getTempExecPageSize', function() { return 0; });
    var formatCompactTimestamp = port('formatCompactTimestamp', function() {
      return new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    });
    var downloadText = port('downloadText');
    var applyVersionAssignments = port('applyVersionAssignments');
    var resetTempExecPages = port('resetTempExecPages');
    var saveTempExecFocus = port('saveTempExecFocus');
    var ensureTempExecColumns = port('ensureTempExecColumns');
    var persistSettings = port('persistSettings');
    var applyTempExecPageSize = port('applyTempExecPageSize');
    var setRequirementLabel = port('setRequirementLabel');
    var syncTempExecPlacement = port('syncTempExecPlacement');
    var persistTempExecState = port('persistTempExecState');
    var renderTempExecNav = port('renderTempExecNav');
    var renderTempExecView = port('renderTempExecView');
    var renderTempVersionGrid = port('renderTempVersionGrid');
    function isReuseDetailRemoved(detail) {
      return Boolean(detail && detail.removed);
    }

    function normalizeReuseApplicability(value) {
      if (reuseApplicabilityCore && typeof reuseApplicabilityCore.normalizeApplicability === 'function') {
        return reuseApplicabilityCore.normalizeApplicability(value);
      }
      if (!value || typeof value !== 'object') return null;
      var profile = value.profile ? String(value.profile).trim() : '';
      var optionValue = value.value ? String(value.value).trim() : '';
      return profile && optionValue ? { profile: profile, value: optionValue } : null;
    }

    function clearReuseDetailAutoStatus(detail) {
      if (!detail || typeof detail !== 'object') return;
      delete detail.statusOrigin;
      delete detail.statusOriginProfile;
    }

    function normalizeReuseDetails(list) {
      if (!Array.isArray(list)) return [];
      return list
        .map(function(detail) {
          var text = detail && detail.text ? String(detail.text).trim() : '';
          var presetId = detail && detail.presetId ? detail.presetId : '';
          var removed = isReuseDetailRemoved(detail);
          if (!text && (!removed || !presetId)) return null;
          var id = detail && detail.id ? detail.id : generateReuseDetailId();
          var normalized = {
            id: id,
            text: text,
            note: detail && detail.note ? detail.note : '',
            status: detail && detail.status ? detail.status : '未执行',
            presetId: presetId,
            removed: removed,
          };
          var statusOrigin = detail && detail.statusOrigin ? String(detail.statusOrigin).trim() : '';
          var statusOriginProfile = detail && detail.statusOriginProfile ? String(detail.statusOriginProfile).trim() : '';
          if (statusOrigin) normalized.statusOrigin = statusOrigin;
          if (statusOriginProfile) normalized.statusOriginProfile = statusOriginProfile;
          return normalized;
        })
        .filter(Boolean);
    }

    function normalizeReusePresets(list) {
      if (!Array.isArray(list)) return [];
      return list
        .map(function(item) {
          var text = item && item.text ? String(item.text).trim() : '';
          if (!text) return null;
          var id = item && item.id ? String(item.id) : generateReusePresetId();
          var normalized = { id: id, text: text };
          var applicability = normalizeReuseApplicability(item && item.applicability);
          if (applicability) normalized.applicability = applicability;
          return normalized;
        })
        .filter(Boolean);
    }

    function normalizeDefectLinks(list) {
      if (!Array.isArray(list)) return [];
      return list
        .map(function(item) {
          var id = item && item.id ? String(item.id) : generateDefectLinkId();
          var url = item && item.url ? String(item.url) : '';
          return { id: id, url: url };
        })
        .filter(Boolean);
    }

    function getTempExecFileBaseName(file, requirementLabel) {
      var requirement = normalizeRequirementName(requirementLabel) || '';
      var name = file && file.name ? file.name : '';
      var fallback = requirement || 'temp_exec';
      return getSafeFileBaseName(name, fallback);
    }

    function normalizeTempExecCase(item, fileId, idx) {
      var moduleName = stringifyCaseField(item && (item.module || item.module_name || item['模块'])) || ('模块' + (idx + 1));
      var title = stringifyCaseField(item && (item.title || item.case_title || item['用例标题'])) || moduleName;
      var priority = stringifyCaseField(item && (item.priority || item.level || item['优先级'])) || 'P1';
      var preconditions = stringifyCaseField(item && (item.preconditions || item.precondition || item['前提条件'])) || '';
      var steps = stringifyCaseField(item && (item.steps || item.actions || item['操作步骤'])) || '';
      var expected = stringifyCaseField(item && (item.expected || item.result || item['预期结果'])) || '';
      return {
        id: item && item.id ? item.id : (fileId + '-' + idx),
        module: moduleName,
        title: title,
        priority: priority,
        preconditions: preconditions,
        steps: steps,
        expected: expected,
        actual: item && item.actual ? item.actual : '未执行',
        remark: item && item.remark ? item.remark : '',
        reuseDetails: normalizeReuseDetails(item && item.reuseDetails),
        defectLinks: normalizeDefectLinks(item && item.defectLinks),
      };
    }

    function normalizeTempExecCases(list, fileId) {
      if (!Array.isArray(list)) return [];
      return list.map(function(item, idx) { return normalizeTempExecCase(item, fileId, idx); }).filter(Boolean);
    }

    function normalizeTempExecPlacement(raw) {
      var placement = raw && typeof raw === 'object' ? raw : {};
      var requirementOrder = Array.isArray(placement.requirementOrder)
        ? placement.requirementOrder.map(function(item) { return normalizeRequirementName(item); }).filter(Boolean)
        : [];
      var fileOrder = placement.fileOrder && typeof placement.fileOrder === 'object'
        ? Object.keys(placement.fileOrder).reduce(function(acc, key) {
            var normKey = normalizeRequirementName(key);
            if (!normKey) return acc;
            var arr = Array.isArray(placement.fileOrder[key]) ? placement.fileOrder[key] : [];
            acc[normKey] = arr.map(function(id) { return id && id.toString(); }).filter(Boolean);
            return acc;
          }, {})
        : {};
      var versionOrder = Array.isArray(placement.versionOrder)
        ? placement.versionOrder.map(function(id) { return id && id.toString(); }).filter(Boolean)
        : [];
      var projectOrder = Array.isArray(placement.projectOrder)
        ? placement.projectOrder.map(function(id) { return id && id.toString(); }).filter(Boolean)
        : [];
      var versionOrderByProject = placement.versionOrderByProject && typeof placement.versionOrderByProject === 'object'
        ? Object.keys(placement.versionOrderByProject).reduce(function(acc, projectId) {
            var pid = projectId && projectId.toString ? projectId.toString() : '';
            if (!pid) return acc;
            var arr = Array.isArray(placement.versionOrderByProject[projectId]) ? placement.versionOrderByProject[projectId] : [];
            acc[pid] = arr.map(function(id) { return id && id.toString(); }).filter(Boolean);
            return acc;
          }, {})
        : {};
      var fileOrderByProjectVersion = placement.fileOrderByProjectVersion && typeof placement.fileOrderByProjectVersion === 'object'
        ? Object.keys(placement.fileOrderByProjectVersion).reduce(function(acc, projectId) {
            var pid = projectId && projectId.toString ? projectId.toString() : '';
            if (!pid) return acc;
            var versions = placement.fileOrderByProjectVersion[projectId];
            if (!versions || typeof versions !== 'object') return acc;
            acc[pid] = Object.keys(versions).reduce(function(vacc, verId) {
              var vid = verId && verId.toString ? verId.toString() : '';
              if (vid === null || vid === undefined) return vacc;
              var arr = Array.isArray(versions[verId]) ? versions[verId] : [];
              vacc[vid] = arr.map(function(id) { return id && id.toString(); }).filter(Boolean);
              return vacc;
            }, {});
            return acc;
          }, {})
        : {};
      return {
        requirementOrder: requirementOrder,
        fileOrder: fileOrder,
        versionOrder: versionOrder,
        projectOrder: projectOrder,
        versionOrderByProject: versionOrderByProject,
        fileOrderByProjectVersion: fileOrderByProjectVersion,
      };
    }

    function serializeSingleTempExecFile(file) {
      if (!file) return null;
      return {
        id: file.id,
        name: file.name,
        scope: file.scope,
        requirement: file.requirement || getRequirementLabel(true),
        reuseEnabled: Boolean(file.reuseEnabled),
        createdAt: file.createdAt || Date.now(),
        projectId: file.projectId || '',
        versionId: file.versionId || '',
        reusePresets: Array.isArray(file.reusePresets)
          ? file.reusePresets.map(function(preset) {
            var normalizedPreset = {
              id: preset && preset.id ? preset.id : generateReusePresetId(),
              text: preset && preset.text ? preset.text : '',
            };
            var applicability = normalizeReuseApplicability(preset && preset.applicability);
            if (applicability) normalizedPreset.applicability = applicability;
            return normalizedPreset;
          })
          : [],
        cases: (file.cases || []).map(function(item) {
          return {
            module: item.module,
            title: item.title,
            priority: item.priority,
            preconditions: item.preconditions,
            steps: item.steps,
            expected: item.expected,
            actual: item.actual,
            remark: item.remark,
            reuseDetails: Array.isArray(item.reuseDetails)
              ? item.reuseDetails.map(function(detail) {
                var normalizedDetail = {
                  id: detail && detail.id ? detail.id : generateReuseDetailId(),
                  text: detail && detail.text ? detail.text : '',
                  note: detail && detail.note ? detail.note : '',
                  status: detail && detail.status ? detail.status : '未执行',
                  presetId: detail && detail.presetId ? detail.presetId : '',
                  removed: Boolean(detail && detail.removed),
                };
                if (detail && detail.statusOrigin) normalizedDetail.statusOrigin = detail.statusOrigin;
                if (detail && detail.statusOriginProfile) normalizedDetail.statusOriginProfile = detail.statusOriginProfile;
                return normalizedDetail;
              })
              : [],
            defectLinks: Array.isArray(item.defectLinks)
              ? item.defectLinks.map(function(link) {
                return {
                  id: link && link.id ? link.id : generateDefectLinkId(),
                  url: link && link.url ? link.url : '',
                };
              })
              : [],
          };
        }),
      };
    }

    function serializeTempExecFiles(state) {
      return (state.tempExecFiles || [])
        .map(function(file) { return serializeSingleTempExecFile(file); })
        .filter(Boolean);
    }

    function serializeTempExecVersions(state) {
      var fileIdSet = new Set((state.tempExecFiles || []).map(function(file) { return file.id; }));
      var seenVersionIds = new Set();
      return (state.tempExecVersions || [])
        .map(function(ver) {
          if (!ver || typeof ver !== 'object') return null;
          var id = ver.id || (generateTempExecId());
          while (seenVersionIds.has(id)) {
            id = generateTempExecId();
          }
          seenVersionIds.add(id);
          var name = (ver.name || '').trim() || '未命名版本';
          var ids = Array.isArray(ver.fileIds) ? ver.fileIds.filter(function(fid) { return fileIdSet.has(fid); }) : [];
          var deduped = [];
          var seen = new Set();
          ids.forEach(function(fid) {
            if (seen.has(fid)) return;
            seen.add(fid);
            deduped.push(fid);
          });
          return { id: id, name: name, fileIds: deduped };
        })
        .filter(Boolean);
    }

    function serializeModelList(list) {
      if (!Array.isArray(list)) return [];
      return list
        .map(function(item) {
          if (!item || typeof item !== 'object') return null;
          var model = {};
          Object.keys(item).forEach(function(key) {
            var val = item[key];
            if (val === undefined || typeof val === 'function') return;
            model[key] = val;
          });
          if (!model.id) {
            model.id = 'model-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
          }
          return model;
        })
        .filter(Boolean);
    }

    function serializeAssignments(raw) {
      if (!raw || typeof raw !== 'object') return {};
      var result = {};
      Object.keys(raw).forEach(function(key) {
        var val = raw[key];
        if (val === undefined || typeof val === 'function') return;
        result[key] = val;
      });
      return result;
    }

    function applyImportedModels(list) {
      var models = serializeModelList(list);
      if (!models.length) return;
      state.models = models;
      try {
        storage.setItem(modelsStorageKey, JSON.stringify(models));
      } catch (err) {
        console.warn('保存模型配置失败', err);
      }
    }

    function applyImportedAssignments(assignments) {
      if (!assignments || typeof assignments !== 'object') return;
      var merged = Object.assign({}, state.assignments || {}, serializeAssignments(assignments));
      state.assignments = merged;
      try {
        storage.setItem(assignmentStorageKey, JSON.stringify(merged));
      } catch (err) {
        console.warn('保存模型指派失败', err);
      }
    }

    function serializeTempExecSnapshot(state, getPageSize, columns) {
      return {
        type: 'tempexec_snapshot_v1',
        generatedAt: new Date().toISOString(),
        requirement: getRequirementLabel(true),
        files: serializeTempExecFiles(state),
        versions: serializeTempExecVersions(state),
        focus: Array.isArray(state.tempExecFocus) ? state.tempExecFocus.slice() : [],
        pageSize: typeof getPageSize === 'function' ? getPageSize() : 0,
        columns: columns || {},
        activeId: state.tempExecActiveId || '',
        placement: state.tempExecPlacement || defaultPlacement,
        models: serializeModelList(state.models || []),
        assignments: serializeAssignments(state.assignments || {}),
      };
    }

    function exportTempExecSnapshot() {
      var files = serializeTempExecFiles(state);
      if (!files.length) {
        if (tempExecStatus) setStatus(tempExecStatus, '暂无用例可导出，请先导入', 'warn');
        return;
      }
      var requirement = normalizeRequirementName(getRequirementLabel(true)) || 'temp_exec';
      var columns = (state && state.settings && state.settings.tempExecColumns)
        ? state.settings.tempExecColumns
        : defaultTempExecColumns;
      var snapshot = serializeTempExecSnapshot(state, getTempExecPageSize, columns);
      var stamp = formatCompactTimestamp ? formatCompactTimestamp() : new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      var safeReq = requirement.replace(/[\\/:*?"<>|]/g, '_');
      if (downloadText) {
        downloadText('tempexec_full_' + safeReq + '_' + stamp + '.json', JSON.stringify(snapshot, null, 2));
      }
      if (tempExecStatus) setStatus(tempExecStatus, '已导出执行页面配置，可用于完整还原', 'ok');
    }

    async function importTempExecSnapshot(file) {
      if (!file) return;
      var confirmed = true;
      if (typeof browser.confirm === 'function') {
        confirmed = browser.confirm('导入执行页面配置将覆盖当前页面的所有用例和执行数据，是否继续？');
      }
      if (!confirmed) return;
      try {
        var text = (await file.text()).trim();
        if (!text) {
          if (tempExecStatus) setStatus(tempExecStatus, '导入文件为空', 'warn');
          return;
        }
        var data = null;
        try {
          data = JSON.parse(text);
        } catch (err) {
          if (tempExecStatus) setStatus(tempExecStatus, '导入文件不是有效 JSON', 'err');
          return;
        }
        applyTempExecSnapshot(data);
        if (tempExecStatus) setStatus(tempExecStatus, '执行页面配置已导入并还原', 'ok');
      } catch (err) {
        console.error(err);
        if (tempExecStatus) setStatus(tempExecStatus, '导入失败：' + err.message, 'err');
      }
    }

    function applyTempExecSnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') throw new Error('导入内容为空或格式不正确');
      if (snapshot.models) {
        applyImportedModels(snapshot.models);
      }
      if (snapshot.assignments && typeof snapshot.assignments === 'object') {
        applyImportedAssignments(snapshot.assignments);
      }
      var filesRaw = Array.isArray(snapshot.files) ? snapshot.files : [];
      var versionsRaw = Array.isArray(snapshot.versions) ? snapshot.versions : [];
      var usedIds = new Set();
      var normalizedFiles = filesRaw
        .map(function(item) {
          if (!item || typeof item !== 'object') return null;
          var fileId = item.id || generateTempExecId();
          while (usedIds.has(fileId)) {
            fileId = generateTempExecId();
          }
          var list = normalizeTempExecCases(item.cases || [], fileId);
          if (!list.length) return null;
          usedIds.add(fileId);
          return {
            id: fileId,
            name: item.name || '测试用例',
            cases: list,
            scope: item.scope || 'history',
            requirement: normalizeRequirementName(item.requirement) || getRequirementLabel(true),
            reuseEnabled: Boolean(item.reuseEnabled),
            createdAt: Number.isFinite(Number(item.createdAt)) ? Number(item.createdAt) : Date.now(),
            reusePresets: item && item.reusePresets ? item.reusePresets : [],
            versionId: item.versionId || '',
          };
        })
        .filter(Boolean);
      state.tempExecFiles = normalizedFiles;
      applyVersionAssignments(versionsRaw);
      state.tempExecActiveId = '';
      state.tempExecSelections = {};
      state.tempExecRemarkOpen = {};
      state.tempExecReuseOpen = {};
      state.tempExecReuseBatchExpanded = {};
      state.tempExecDefectOpen = {};
      state.tempExecPresetDraft = null;
      state.tempExecStatusFilter = { fileId: '', status: '' };
      resetTempExecPages();
      state.tempExecMindMode = false;
      var focusList = Array.isArray(snapshot.focus) ? snapshot.focus : [];
      state.tempExecFocus = focusList.filter(function(id) {
        return normalizedFiles.some(function(file) { return file.id === id; });
      });
      saveTempExecFocus();
      var columns = snapshot.columns && typeof snapshot.columns === 'object'
        ? Object.assign({}, defaultTempExecColumns, snapshot.columns)
        : null;
      if (columns) {
        state.settings = state.settings || {};
        state.settings.tempExecColumns = columns;
        ensureTempExecColumns();
        // 仅持久化列设置，避免覆盖其他设备的设置项。
        persistSettings(['tempExecColumns']);
      }
      if (Number.isFinite(Number(snapshot.pageSize))) {
        applyTempExecPageSize(Number(snapshot.pageSize));
      }
      var activeCandidate = snapshot.activeId && normalizedFiles.some(function(file) { return file.id === snapshot.activeId; })
        ? snapshot.activeId
        : (normalizedFiles[0] ? normalizedFiles[0].id : '');
      state.tempExecActiveId = activeCandidate;
      state.tempExecPlacement = normalizeTempExecPlacement(snapshot.placement || snapshot.position);
      var requirement = normalizeRequirementName(snapshot.requirement || snapshot.requirment);
      if (requirement) setRequirementLabel(requirement, 'tempexec-import');
      syncTempExecPlacement();
      persistTempExecState();
      renderTempExecNav();
      renderTempExecView();
      renderTempVersionGrid();
    }

    return {
      isReuseDetailRemoved: isReuseDetailRemoved,
      normalizeReuseApplicability: normalizeReuseApplicability,
      clearReuseDetailAutoStatus: clearReuseDetailAutoStatus,
      normalizeReuseDetails: normalizeReuseDetails,
      normalizeReusePresets: normalizeReusePresets,
      normalizeDefectLinks: normalizeDefectLinks,
      getTempExecFileBaseName: getTempExecFileBaseName,
      normalizeTempExecCase: normalizeTempExecCase,
      normalizeTempExecCases: normalizeTempExecCases,
      normalizeTempExecPlacement: normalizeTempExecPlacement,
      serializeSingleTempExecFile: serializeSingleTempExecFile,
      serializeTempExecFiles: serializeTempExecFiles,
      serializeTempExecVersions: serializeTempExecVersions,
      serializeModelList: serializeModelList,
      serializeAssignments: serializeAssignments,
      applyImportedModels: applyImportedModels,
      applyImportedAssignments: applyImportedAssignments,
      serializeTempExecSnapshot: serializeTempExecSnapshot,
      exportTempExecSnapshot: exportTempExecSnapshot,
      importTempExecSnapshot: importTempExecSnapshot,
      applyTempExecSnapshot: applyTempExecSnapshot,
    };
  }

  return { create: create };
});
