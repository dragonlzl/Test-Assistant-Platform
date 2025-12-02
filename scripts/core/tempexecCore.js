(function() {
  function init(deps) {
    var setStatus = deps && deps.setStatus ? deps.setStatus : function() {};
    var normalizeRequirementName = deps && deps.normalizeRequirementName ? deps.normalizeRequirementName : function(text) { return text || ''; };
    var getRequirementLabel = deps && deps.getRequirementLabel ? deps.getRequirementLabel : function() { return ''; };
    var generateTempExecId = deps && deps.generateTempExecId
      ? deps.generateTempExecId
      : function() {
        return 'tempexec-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
      };
    var generateTempVersionId = deps && deps.generateTempVersionId
      ? deps.generateTempVersionId
      : function() {
        return 'tempver-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
      };
    var generateReusePresetId = deps && deps.generateReusePresetId ? deps.generateReusePresetId : function() { return 'reuse-' + Date.now(); };
    var generateReuseDetailId = deps && deps.generateReuseDetailId ? deps.generateReuseDetailId : function() { return 'reuse-detail-' + Date.now(); };
    var generateDefectLinkId = deps && deps.generateDefectLinkId ? deps.generateDefectLinkId : function() { return 'defect-' + Date.now(); };
    var normalizeTempExecName = deps && deps.normalizeTempExecName ? deps.normalizeTempExecName : function(name) {
      return (name || '').trim().toLowerCase();
    };
    var stringifyCaseField = deps && deps.stringifyCaseField ? deps.stringifyCaseField : function(val) { return (val || '').toString(); };
    var defaultTempExecColumns = deps && deps.defaultTempExecColumns ? deps.defaultTempExecColumns : {};
    var defaultPlacement = deps && deps.defaultPlacement ? deps.defaultPlacement : { requirementOrder: [], fileOrder: {}, versionOrder: [] };
    var state = deps && deps.state ? deps.state : {};
    var tempExecStorageKey = deps && deps.tempExecStorageKey ? deps.tempExecStorageKey : 'usecase-temp-exec-v1';
    var tempExecFocusStorageKey = deps && deps.tempExecFocusStorageKey ? deps.tempExecFocusStorageKey : 'tempexec-focus-v1';
    var tempExecPageSizeStorageKey = deps && deps.tempExecPageSizeStorageKey ? deps.tempExecPageSizeStorageKey : 'tempexec-page-size';
    var navPrefersUnassigned = false;
    var defaultTempExecPageSize = deps && deps.defaultTempExecPageSize ? deps.defaultTempExecPageSize : 20;
    var tempExecStatus = deps && deps.dom && deps.dom.tempExecStatus ? deps.dom.tempExecStatus : null;
    var tempVersionGrid = deps && deps.dom && deps.dom.tempVersionGrid ? deps.dom.tempVersionGrid : null;
    var tempExecNav = deps && deps.dom && deps.dom.tempExecNav ? deps.dom.tempExecNav : null;
    var tempFocusZone = deps && deps.dom && deps.dom.tempFocusZone ? deps.dom.tempFocusZone : null;
    var tempExecOverview = deps && deps.dom && deps.dom.tempExecOverview ? deps.dom.tempExecOverview : null;
    var tempExecView = deps && deps.dom && deps.dom.tempExecView ? deps.dom.tempExecView : null;
    var tempExecViewSection = deps && deps.dom && deps.dom.tempExecViewSection ? deps.dom.tempExecViewSection : null;
    var tempExecMindContainer = deps && deps.dom && deps.dom.tempExecMindContainer ? deps.dom.tempExecMindContainer : null;
    var tempExecMindBtn = deps && deps.dom && deps.dom.tempExecMindBtn ? deps.dom.tempExecMindBtn : null;
    var exportTempExecBtn = deps && deps.dom && deps.dom.exportTempExecBtn ? deps.dom.exportTempExecBtn : null;
    var exportTempExecConfigBtn = deps && deps.dom && deps.dom.exportTempExecConfigBtn ? deps.dom.exportTempExecConfigBtn : null;
    var exportTempExecXmindBtn = deps && deps.dom && deps.dom.exportTempExecXmindBtn ? deps.dom.exportTempExecXmindBtn : null;
    var escapeHtml = deps && deps.escapeHtml ? deps.escapeHtml : function(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    var escapeHtmlPreserve = deps && deps.escapeHtmlPreserve ? deps.escapeHtmlPreserve : function(text) {
      return escapeHtml(text).replace(/\n/g, '<br>');
    };
    var saveTempExecFocus = deps && deps.saveTempExecFocus ? deps.saveTempExecFocus : function() {};
    var ensureTempExecColumns = deps && deps.ensureTempExecColumns ? deps.ensureTempExecColumns : function() { return defaultTempExecColumns; };
    var persistSettings = deps && deps.persistSettings ? deps.persistSettings : function() {};
    var setRequirementLabel = deps && deps.setRequirementLabel ? deps.setRequirementLabel : function() {};
    var formatCompactTimestamp = deps && deps.formatCompactTimestamp
      ? deps.formatCompactTimestamp
      : function() {
        var pad = function(num) {
          return num < 10 ? '0' + num : String(num);
        };
        var now = new Date();
        return now.getFullYear().toString()
          + pad(now.getMonth() + 1)
          + pad(now.getDate())
          + '_' + pad(now.getHours())
          + pad(now.getMinutes())
          + pad(now.getSeconds());
      };
    var downloadText = deps && deps.downloadText ? deps.downloadText : function() {};
    var scrollElementIntoView = deps && deps.scrollElementIntoView ? deps.scrollElementIntoView : function() {};
    var tempExecResultOptions = deps && deps.tempExecResultOptions ? deps.tempExecResultOptions : ['未执行', '通过', '失败', '阻塞', '不适用'];

    function normalizeReuseDetails(list) {
      if (!Array.isArray(list)) return [];
      return list
        .map(function(detail) {
          var text = detail && detail.text ? String(detail.text).trim() : '';
          if (!text) return null;
          var id = detail && detail.id ? detail.id : generateReuseDetailId();
          return {
            id: id,
            text: text,
            note: detail && detail.note ? detail.note : '',
            status: detail && detail.status ? detail.status : '未执行',
            presetId: detail && detail.presetId ? detail.presetId : '',
          };
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
          return { id: id, text: text };
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
      return {
        requirementOrder: requirementOrder,
        fileOrder: fileOrder,
        versionOrder: versionOrder,
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
        versionId: file.versionId || '',
        reusePresets: Array.isArray(file.reusePresets)
          ? file.reusePresets.map(function(preset) {
            return {
              id: preset && preset.id ? preset.id : generateReusePresetId(),
              text: preset && preset.text ? preset.text : '',
            };
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
                return {
                  id: detail && detail.id ? detail.id : generateReuseDetailId(),
                  text: detail && detail.text ? detail.text : '',
                  note: detail && detail.note ? detail.note : '',
                  status: detail && detail.status ? detail.status : '未执行',
                  presetId: detail && detail.presetId ? detail.presetId : '',
                };
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
      if (typeof window !== 'undefined' && window.confirm) {
        confirmed = window.confirm('导入执行页面配置将覆盖当前页面的所有用例和执行数据，是否继续？');
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
      state.tempExecDefectOpen = {};
      state.tempExecPresetDraft = null;
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
        persistSettings();
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

    function ensureTempExecPlacement() {
      if (!state.tempExecPlacement || typeof state.tempExecPlacement !== 'object') {
        state.tempExecPlacement = Object.assign({}, defaultPlacement);
      }
      if (!Array.isArray(state.tempExecPlacement.requirementOrder)) state.tempExecPlacement.requirementOrder = [];
      if (!state.tempExecPlacement.fileOrder || typeof state.tempExecPlacement.fileOrder !== 'object') {
        state.tempExecPlacement.fileOrder = {};
      }
      if (!Array.isArray(state.tempExecPlacement.versionOrder)) state.tempExecPlacement.versionOrder = [];
      return state.tempExecPlacement;
    }

    function ensureRequirementOrder(reqList) {
      var placement = ensureTempExecPlacement();
      var normalizedList = (reqList || []).map(normalizeRequirementName).filter(Boolean);
      normalizedList.forEach(function(req) {
        if (!placement.requirementOrder.includes(req)) placement.requirementOrder.push(req);
      });
      placement.requirementOrder = placement.requirementOrder.filter(function(req) { return normalizedList.includes(req); });
      return placement.requirementOrder.slice();
    }

    function ensureFileOrder(requirement, fileIds) {
      var placement = ensureTempExecPlacement();
      var req = normalizeRequirementName(requirement) || '未标识需求';
      var list = Array.isArray(fileIds) ? fileIds.map(function(id) { return id && id.toString(); }).filter(Boolean) : [];
      if (!placement.fileOrder[req]) placement.fileOrder[req] = [];
      var order = placement.fileOrder[req];
      list.forEach(function(id) {
        if (!order.includes(id)) order.push(id);
      });
      placement.fileOrder[req] = order.filter(function(id) { return list.includes(id); });
      return placement.fileOrder[req].slice();
    }

    function ensureVersionOrder(versionIds) {
      var placement = ensureTempExecPlacement();
      var list = Array.isArray(versionIds) ? versionIds.map(function(id) { return id && id.toString(); }).filter(Boolean) : [];
      list.forEach(function(id) {
        if (!placement.versionOrder.includes(id)) placement.versionOrder.push(id);
      });
      placement.versionOrder = placement.versionOrder.filter(function(id) { return list.includes(id); });
      return placement.versionOrder.slice();
    }

    function reorderRequirementOrder(sourceReq, targetReq) {
      var placement = ensureTempExecPlacement();
      var src = normalizeRequirementName(sourceReq);
      var tgt = normalizeRequirementName(targetReq);
      if (!src || !tgt || src === tgt) return;
      var currentOrder = placement.requirementOrder.slice();
      var srcIdx = currentOrder.indexOf(src);
      var tgtIdx = currentOrder.indexOf(tgt);
      placement.requirementOrder = placement.requirementOrder.filter(function(r) { return r && r !== src; });
      if (tgtIdx === -1) {
        placement.requirementOrder.push(src);
      } else {
        var targetAfterRemoval = srcIdx !== -1 && srcIdx < tgtIdx ? tgtIdx - 1 : tgtIdx;
        var placeAfter = srcIdx !== -1 && srcIdx < tgtIdx;
        var insertIndex = placeAfter ? targetAfterRemoval + 1 : targetAfterRemoval;
        if (insertIndex < 0) insertIndex = 0;
        if (insertIndex > placement.requirementOrder.length) insertIndex = placement.requirementOrder.length;
        placement.requirementOrder.splice(insertIndex, 0, src);
      }
      persistTempExecState();
    }

    function updateVersionOrder(sourceId, targetId) {
      var placement = ensureTempExecPlacement();
      var src = sourceId || '';
      var tgt = targetId || '';
      if (!src || src === tgt) return;
      placement.versionOrder = placement.versionOrder.filter(function(id) { return id !== src; });
      var idx = placement.versionOrder.indexOf(tgt);
      if (idx === -1) placement.versionOrder.push(src);
      else placement.versionOrder.splice(idx, 0, src);
      persistTempExecState();
    }

    function removeFileFromOrder(requirement, fileId) {
      var placement = ensureTempExecPlacement();
      var req = normalizeRequirementName(requirement) || '未标识需求';
      var id = fileId && fileId.toString();
      if (!id) return;
      if (!placement.fileOrder[req]) placement.fileOrder[req] = [];
      placement.fileOrder[req] = placement.fileOrder[req].filter(function(item) { return item !== id; });
    }

    function insertFileIntoOrder(requirement, fileId, beforeId) {
      var placement = ensureTempExecPlacement();
      var req = normalizeRequirementName(requirement) || '未标识需求';
      var id = fileId && fileId.toString();
      if (!id) return;
      if (!placement.fileOrder[req]) placement.fileOrder[req] = [];
      var order = placement.fileOrder[req].filter(function(item) { return item !== id; });
      if (beforeId && order.includes(beforeId)) {
        var idx = order.indexOf(beforeId);
        order.splice(idx, 0, id);
      } else {
        order.push(id);
      }
      placement.fileOrder[req] = order;
    }

    function syncTempExecPlacement() {
      var reqs = (state.tempExecFiles || []).map(function(file) {
        return normalizeRequirementName(file && file.requirement) || '未标识需求';
      });
      ensureRequirementOrder(reqs);
      var uniqueReqs = Array.from(new Set(reqs));
      uniqueReqs.forEach(function(req) {
        var ids = (state.tempExecFiles || [])
          .filter(function(file) {
            var name = normalizeRequirementName(file && file.requirement) || '未标识需求';
            return name === req && !file.versionId;
          })
          .map(function(file) { return file.id; });
        ensureFileOrder(req, ids);
      });
      ensureVersionOrder((state.tempExecVersions || []).map(function(ver) { return ver.id; }));
    }

    function moveTempExecFileToRequirement(fileId, requirement, beforeId, opts) {
      if (!fileId) return;
      var options = opts || {};
      var file = getTempExecFile(fileId);
      if (!file) return;
      var targetReq = normalizeRequirementName(requirement) || '未标识需求';
      if (file.requirement === targetReq && !beforeId) return;
      removeFileFromOrder(file.requirement, fileId);
      ensureRequirementOrder(state.tempExecFiles.map(function(f) { return normalizeRequirementName(f.requirement) || '未标识需求'; }));
      ensureFileOrder(targetReq, getTempExecFilesByRequirement(targetReq).map(function(f) { return f.id; }));
      file.requirement = targetReq;
      insertFileIntoOrder(targetReq, fileId, beforeId);
      ensureRequirementOrder(state.tempExecFiles.map(function(f) { return normalizeRequirementName(f.requirement) || '未标识需求'; }));
      ensureFileOrder(targetReq, getTempExecFilesByRequirement(targetReq).map(function(f) { return f.id; }));
      persistTempExecState();
      if (!options.silent) {
        renderTempExecNav();
        renderTempVersionGrid();
        renderTempExecView();
      }
    }

    function clampTempExecPageSize(value) {
      var num = Math.round(Number(value));
      if (!Number.isFinite(num)) return defaultTempExecPageSize;
      return Math.min(200, Math.max(5, num));
    }

    function loadTempExecPageSizeSetting() {
      try {
        var stored = localStorage.getItem(tempExecPageSizeStorageKey);
        if (stored === null || stored === undefined) return defaultTempExecPageSize;
        return clampTempExecPageSize(Number(stored));
      } catch (err) {
        return defaultTempExecPageSize;
      }
    }

    function saveTempExecPageSizeSetting(value) {
      try {
        var size = clampTempExecPageSize(value);
        localStorage.setItem(tempExecPageSizeStorageKey, size);
        return size;
      } catch (err) {
        return clampTempExecPageSize(value);
      }
    }

    function ensureTempExecPageIndex(fileId) {
      if (!fileId) return 0;
      if (typeof state.tempExecPages[fileId] !== 'number' || Number.isNaN(state.tempExecPages[fileId])) {
        state.tempExecPages[fileId] = 0;
      }
      return state.tempExecPages[fileId];
    }

    function getTempExecPageSize() {
      var size = clampTempExecPageSize(state.tempExecPageSize || defaultTempExecPageSize);
      state.tempExecPageSize = size;
      return size;
    }

    function resetTempExecPages(fileId) {
      if (!fileId) {
        state.tempExecPages = {};
        (state.tempExecFiles || []).forEach(function(file) {
          state.tempExecPages[file.id] = 0;
        });
        return;
      }
      state.tempExecPages[fileId] = 0;
    }

    function setTempExecPage(fileId, page, suppressRender) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      var size = getTempExecPageSize();
      var totalPages = Math.max(1, Math.ceil(file.cases.length / size));
      var next = Math.min(Math.max(0, Number(page) || 0), totalPages - 1);
      state.tempExecPages[fileId] = next;
      if (!suppressRender) renderTempExecView();
    }

    function changeTempExecPage(fileId, action) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      var size = getTempExecPageSize();
      var totalPages = Math.max(1, Math.ceil(file.cases.length / size));
      var current = ensureTempExecPageIndex(fileId);
      if (action === 'prev') current -= 1;
      else if (action === 'next') current += 1;
      else if (typeof action === 'number') current = action;
      else return;
      current = Math.min(Math.max(0, current), totalPages - 1);
      state.tempExecPages[fileId] = current;
      renderTempExecView();
      scrollTempExecViewTop();
    }

    function applyTempExecPageSize(value) {
      var size = clampTempExecPageSize(value);
      var changed = state.tempExecPageSize !== size;
      state.tempExecPageSize = size;
      saveTempExecPageSizeSetting(size);
      resetTempExecPages();
      if (changed) renderTempExecView();
      return { size: size, changed: changed };
    }

    function ensureTempVersionList() {
      if (!Array.isArray(state.tempExecVersions)) state.tempExecVersions = [];
    }

    function getTempVersion(versionId) {
      if (!versionId) return null;
      ensureTempVersionList();
      return state.tempExecVersions.find(function(item) { return item && item.id === versionId; }) || null;
    }

    function applyVersionAssignments(rawVersions) {
      ensureTempVersionList();
      var fileMap = new Map((state.tempExecFiles || []).map(function(file) { return [file.id, file]; }));
      var seenFiles = new Set();
      var normalized = [];
      (rawVersions || []).forEach(function(ver) {
        if (!ver || typeof ver !== 'object') return;
        var id = ver.id || generateTempVersionId();
        while (normalized.some(function(v) { return v && v.id === id; })) {
          id = generateTempVersionId();
        }
        var name = (ver.name || '').trim() || '未命名版本';
        var fileIds = Array.isArray(ver.fileIds) ? ver.fileIds.filter(function(fid) { return fileMap.has(fid); }) : [];
        var deduped = [];
        fileIds.forEach(function(fid) {
          if (seenFiles.has(fid)) return;
          seenFiles.add(fid);
          deduped.push(fid);
          var file = fileMap.get(fid);
          if (file) file.versionId = id;
        });
        normalized.push({ id: id, name: name, fileIds: deduped });
      });
      (state.tempExecFiles || []).forEach(function(file) {
        if (!seenFiles.has(file.id)) file.versionId = '';
      });
      state.tempExecVersions = normalized;
    }

    function isVersionNameDuplicate(name, excludeId) {
      var normalized = normalizeTempExecName(name);
      if (!normalized) return false;
      return (state.tempExecVersions || []).some(function(ver) {
        if (!ver) return false;
        if (excludeId && ver.id === excludeId) return false;
        return normalizeTempExecName(ver.name) === normalized;
      });
    }

    function createTempVersion(name) {
      ensureTempVersionList();
      var trimmed = (name || '').trim();
      if (!trimmed) return null;
      if (isVersionNameDuplicate(trimmed)) {
        if (tempExecStatus) setStatus(tempExecStatus, '版本名称【' + trimmed + '】已存在，请换一个', 'warn');
        window.alert('版本名称【' + trimmed + '】已存在，请换一个');
        return null;
      }
      var version = { id: generateTempVersionId(), name: trimmed, fileIds: [] };
      state.tempExecVersions.push(version);
      var placement = ensureTempExecPlacement();
      placement.versionOrder = placement.versionOrder.filter(function(id) { return id !== version.id; });
      placement.versionOrder.push(version.id);
      persistTempExecState();
      renderTempVersionGrid();
      return version.id;
    }

    function removeTempExecFromVersion(fileId, opts) {
      if (!fileId) return;
      var options = opts || {};
      ensureTempVersionList();
      var file = getTempExecFile(fileId);
      var prevId = file && file.versionId ? file.versionId : '';
      if (prevId) {
        var prev = getTempVersion(prevId);
        if (prev && Array.isArray(prev.fileIds)) {
          prev.fileIds = prev.fileIds.filter(function(id) { return id !== fileId; });
        }
      } else {
        state.tempExecVersions.forEach(function(ver) {
          if (!ver || !Array.isArray(ver.fileIds)) return;
          ver.fileIds = ver.fileIds.filter(function(id) { return id !== fileId; });
        });
      }
      if (file) file.versionId = '';
      if (options.silent) return;
      persistTempExecState();
      renderTempExecNav();
      renderTempVersionGrid();
    }

    function removeTempGroupFromVersion(versionId, ids) {
      var list = Array.isArray(ids) ? ids : String(ids || '').split(',').map(function(id) { return id.trim(); }).filter(Boolean);
      if (!list.length) return;
      list.forEach(function(id) { removeTempExecFromVersion(id, { silent: true }); });
      persistTempExecState();
      renderTempExecNav();
      renderTempVersionGrid();
      renderTempExecView();
    }

    function moveTempExecToVersion(fileIds, versionId) {
      if (!fileIds) return;
      var list = Array.isArray(fileIds) ? fileIds : String(fileIds).split(',').map(function(id) { return id.trim(); }).filter(Boolean);
      if (!list.length) return;
      if (!versionId) {
        list.forEach(function(id) { removeTempExecFromVersion(id); });
        return;
      }
      var version = getTempVersion(versionId);
      if (!version) return;
      if (!Array.isArray(version.fileIds)) version.fileIds = [];
      list.forEach(function(fileId) {
        var file = getTempExecFile(fileId);
        if (!file) return;
        if (file.versionId && file.versionId !== versionId) {
          removeTempExecFromVersion(fileId, { silent: true });
        }
        if (version.fileIds.indexOf(fileId) === -1) version.fileIds.push(fileId);
        file.versionId = versionId;
      });
      persistTempExecState();
      renderTempExecNav();
      renderTempVersionGrid();
      renderTempExecView();
    }

    function getVersionRequirementBlocks(version) {
      if (!version || !Array.isArray(version.fileIds)) return [];
      var fileMap = new Map((state.tempExecFiles || []).map(function(file) { return [file.id, file]; }));
      var counters = Object.create(null);
      var blocks = [];
      var lastReq = '';
      var current = null;
      version.fileIds.forEach(function(fid) {
        var file = fileMap.get(fid);
        if (!file) return;
        var req = normalizeRequirementName(file.requirement) || '未标识需求';
        if (req !== lastReq) {
          counters[req] = (counters[req] || 0) + 1;
          current = {
            key: req + '::' + counters[req],
            req: req,
            ids: [],
          };
          blocks.push(current);
          lastReq = req;
        }
        if (current) current.ids.push(fid);
      });
      return blocks;
    }

    function moveTempExecFileWithinVersion(fileIds, versionId, targetRequirement, beforeId) {
      var version = getTempVersion(versionId);
      var ids = Array.isArray(fileIds) ? fileIds : String(fileIds || '').split(',').map(function(id) { return id.trim(); }).filter(Boolean);
      if (!version || !ids.length) return;
      if (!Array.isArray(version.fileIds)) version.fileIds = [];
      state.tempExecVersions.forEach(function(ver) {
        if (!ver || !Array.isArray(ver.fileIds)) return;
        ver.fileIds = ver.fileIds.filter(function(id) { return ids.indexOf(id) === -1; });
      });
      var targetReq = normalizeRequirementName(targetRequirement) || '';
      ids.forEach(function(fid) {
        var file = getTempExecFile(fid);
        if (!file) return;
        file.versionId = versionId;
        if (targetReq) file.requirement = targetReq;
      });
      var existing = version.fileIds.filter(function(id) { return ids.indexOf(id) === -1; });
      var insertIndex = existing.length;
      if (beforeId && existing.indexOf(beforeId) !== -1) {
        insertIndex = existing.indexOf(beforeId);
      } else if (targetReq) {
        var fileMap = new Map((state.tempExecFiles || []).map(function(item) { return [item.id, item]; }));
        for (var i = 0; i < existing.length; i += 1) {
          var file = fileMap.get(existing[i]);
          var req = normalizeRequirementName(file && file.requirement) || '未标识需求';
          if (req === targetReq) insertIndex = i + 1;
        }
      }
      if (insertIndex < 0) insertIndex = 0;
      if (insertIndex > existing.length) insertIndex = existing.length;
      var nextOrder = existing.slice();
      ids.forEach(function(fid, idx) {
        nextOrder.splice(insertIndex + idx, 0, fid);
      });
      version.fileIds = nextOrder;
      persistTempExecState();
      renderTempExecNav();
      renderTempVersionGrid();
      renderTempExecView();
    }

    function parseReqPayload(text) {
      var parts = (text || '').split('||');
      return {
        req: normalizeRequirementName(parts[0] || '') || '',
        key: parts[1] || '',
        fromVersion: parts[2] || '',
      };
    }

    function reorderVersionRequirement(versionId, sourceKey, targetKey) {
      var version = getTempVersion(versionId);
      if (!version || !Array.isArray(version.fileIds)) return;
      var blocks = getVersionRequirementBlocks(version);
      if (!blocks.length) return;
      var normSource = normalizeRequirementName(sourceKey) || '';
      var normTarget = normalizeRequirementName(targetKey) || '';
      var findIndexByKey = function(list, key, norm) {
        var idx = list.findIndex(function(b) { return b.key === key; });
        if (idx === -1 && norm) idx = list.findIndex(function(b) { return normalizeRequirementName(b.req) === norm; });
        return idx;
      };
      var srcIdx = findIndexByKey(blocks, sourceKey, normSource);
      var tgtIdx = findIndexByKey(blocks, targetKey, normTarget);
      if (srcIdx === -1) return;
      var srcBlock = blocks.splice(srcIdx, 1)[0];
      if (!srcBlock) return;
      var insertIndex = blocks.length;
      if (tgtIdx !== -1) {
        var targetAfterRemoval = srcIdx < tgtIdx ? tgtIdx - 1 : tgtIdx;
        var placeAfter = srcIdx < tgtIdx;
        insertIndex = placeAfter ? targetAfterRemoval + 1 : targetAfterRemoval;
      } else if (targetKey || normTarget) {
        insertIndex = findIndexByKey(blocks, targetKey, normTarget);
        if (insertIndex === -1) insertIndex = blocks.length;
      }
      if (insertIndex < 0) insertIndex = 0;
      if (insertIndex > blocks.length) insertIndex = blocks.length;
      blocks.splice(insertIndex, 0, srcBlock);
      version.fileIds = blocks.flatMap(function(b) { return b.ids; });
      persistTempExecState();
      renderTempVersionGrid();
    }

    function moveRequirementToVersion(requirement, versionId, beforeKey) {
      var version = getTempVersion(versionId);
      if (!version) return;
      var req = normalizeRequirementName(requirement) || '未标识需求';
      var candidates = (state.tempExecFiles || []).filter(function(file) {
        var name = normalizeRequirementName(file && file.requirement) || '未标识需求';
        return name === req;
      });
      if (!candidates.length) return;
      candidates.forEach(function(file) {
        if (file.versionId && file.versionId !== versionId) {
          removeTempExecFromVersion(file.id, { silent: true });
        }
      });
      if (!Array.isArray(version.fileIds)) version.fileIds = [];
      var blocks = getVersionRequirementBlocks(version);
      var remainingBlocks = blocks.filter(function(block) { return normalizeRequirementName(block.req) !== req; });
      var count = blocks.filter(function(block) { return normalizeRequirementName(block.req) === req; }).length;
      var fileOrder = ensureFileOrder(req, candidates.map(function(file) { return file.id; }));
      var ids = fileOrder.filter(function(id) { return candidates.some(function(f) { return f.id === id; }); });
      var newKey = req + '::' + (count + 1);
      var newBlock = { req: req, key: newKey, ids: ids };
      var insertIndex = remainingBlocks.length;
      if (beforeKey) {
        var idx = remainingBlocks.findIndex(function(b) { return b.key === beforeKey || normalizeRequirementName(b.req) === normalizeRequirementName(beforeKey); });
        if (idx !== -1) insertIndex = idx;
      }
      remainingBlocks.splice(insertIndex, 0, newBlock);
      version.fileIds = remainingBlocks.reduce(function(acc, block) { return acc.concat(block.ids); }, []);
      candidates.forEach(function(file) {
        file.versionId = versionId;
      });
      persistTempExecState();
      renderTempExecNav();
      renderTempVersionGrid();
      renderTempExecView();
    }

    function moveRequirementOutOfVersion(versionId, requirement, targetRequirement) {
      var version = getTempVersion(versionId);
      if (!version || !Array.isArray(version.fileIds)) return;
      var srcReq = normalizeRequirementName(requirement) || '未标识需求';
      var tgtReq = normalizeRequirementName(targetRequirement) || srcReq;
      var fileMap = new Map((state.tempExecFiles || []).map(function(file) { return [file.id, file]; }));
      var remaining = [];
      version.fileIds.forEach(function(fid) {
        var file = fileMap.get(fid);
        if (!file) return;
        var req = normalizeRequirementName(file.requirement) || '未标识需求';
        if (req === srcReq) {
          file.versionId = '';
          file.requirement = tgtReq;
          insertFileIntoOrder(tgtReq, file.id);
        } else {
          remaining.push(fid);
        }
      });
      version.fileIds = remaining;
      ensureRequirementOrder((state.tempExecFiles || []).map(function(f) { return normalizeRequirementName(f && f.requirement) || '未标识需求'; }));
      ensureFileOrder(tgtReq, (state.tempExecFiles || [])
        .filter(function(f) { return (normalizeRequirementName(f && f.requirement) || '未标识需求') === tgtReq; })
        .map(function(f) { return f.id; }));
      if (targetRequirement) {
        reorderRequirementOrder(tgtReq, targetRequirement);
      }
      var placement = ensureTempExecPlacement();
      placement.versionOrder = placement.versionOrder.filter(function(id) { return id !== versionId; });
      persistTempExecState();
      renderTempExecNav();
      renderTempVersionGrid();
      renderTempExecView();
    }

    function removeTempVersion(versionId) {
      if (!versionId) return;
      var version = getTempVersion(versionId);
      if (!version) return;
      var confirmed = window.confirm('确定删除版本【' + (version.name || '') + '】？版本内的用例会回到需求盒子区。');
      if (!confirmed) return;
      var fileSet = new Set(Array.isArray(version.fileIds) ? version.fileIds : []);
      (state.tempExecFiles || []).forEach(function(file) {
        if (fileSet.has(file.id)) file.versionId = '';
      });
      state.tempExecVersions = (state.tempExecVersions || []).filter(function(ver) { return ver && ver.id !== versionId; });
      var placement = ensureTempExecPlacement();
      placement.versionOrder = placement.versionOrder.filter(function(id) { return id !== versionId; });
      persistTempExecState();
      renderTempExecNav();
      renderTempVersionGrid();
    }

    function reorderTempVersion(sourceId, targetId) {
      var placement = ensureTempExecPlacement();
      var src = sourceId || '';
      var tgt = targetId || '';
      if (!src || src === tgt) return;
      ensureVersionOrder((state.tempExecVersions || []).map(function(ver) { return ver.id; }));
      placement.versionOrder = placement.versionOrder.filter(function(id) { return id !== src; });
      var idx = placement.versionOrder.indexOf(tgt);
      if (idx === -1) placement.versionOrder.push(src);
      else placement.versionOrder.splice(idx, 0, src);
      persistTempExecState();
      renderTempVersionGrid();
    }

    function renameTempVersion(versionId) {
      var version = getTempVersion(versionId);
      if (!version) return;
      var nextName = window.prompt('请输入新的版本名称', version.name || '');
      if (nextName === null) return;
      var trimmed = (nextName || '').trim();
      if (!trimmed) {
        if (tempExecStatus) setStatus(tempExecStatus, '版本名称不能为空', 'warn');
        return;
      }
      if (isVersionNameDuplicate(trimmed, versionId)) {
        if (tempExecStatus) setStatus(tempExecStatus, '版本名称【' + trimmed + '】已存在，请换一个', 'warn');
        window.alert('版本名称【' + trimmed + '】已存在，请换一个');
        return;
      }
      version.name = trimmed;
      persistTempExecState();
      renderTempVersionGrid();
      if (tempExecStatus) setStatus(tempExecStatus, '版本名称已更新', 'ok');
    }

    function getTempVersionName(versionId) {
      if (!versionId) return '';
      var ver = getTempVersion(versionId);
      return ver && ver.name ? ver.name : '';
    }

    function ensureTempExecSelection(fileId) {
      if (!state.tempExecSelections || typeof state.tempExecSelections !== 'object') {
        state.tempExecSelections = {};
      }
      if (!fileId) return new Set();
      if (!state.tempExecSelections[fileId]) {
        state.tempExecSelections[fileId] = new Set();
      }
      return state.tempExecSelections[fileId];
    }

    function resetTempExecSelections(fileId) {
      if (!state.tempExecSelections || typeof state.tempExecSelections !== 'object') {
        state.tempExecSelections = {};
      }
      if (!fileId) {
        state.tempExecSelections = {};
        return;
      }
      state.tempExecSelections[fileId] = new Set();
    }

    function ensureTempExecRemarkOpen(fileId) {
      if (!state.tempExecRemarkOpen || typeof state.tempExecRemarkOpen !== 'object') {
        state.tempExecRemarkOpen = {};
      }
      if (!fileId) return new Set();
      if (!state.tempExecRemarkOpen[fileId]) {
        state.tempExecRemarkOpen[fileId] = new Set();
      }
      return state.tempExecRemarkOpen[fileId];
    }

    function resetTempExecRemarkOpen(fileId) {
      if (!state.tempExecRemarkOpen || typeof state.tempExecRemarkOpen !== 'object') {
        state.tempExecRemarkOpen = {};
      }
      if (!fileId) {
        state.tempExecRemarkOpen = {};
        return;
      }
      state.tempExecRemarkOpen[fileId] = new Set();
    }

    function ensureTempExecReuseOpen(fileId) {
      if (!state.tempExecReuseOpen || typeof state.tempExecReuseOpen !== 'object') {
        state.tempExecReuseOpen = {};
      }
      if (!fileId) return new Set();
      if (!state.tempExecReuseOpen[fileId]) {
        state.tempExecReuseOpen[fileId] = new Set();
      }
      return state.tempExecReuseOpen[fileId];
    }

    function resetTempExecReuseOpen(fileId) {
      if (!state.tempExecReuseOpen || typeof state.tempExecReuseOpen !== 'object') {
        state.tempExecReuseOpen = {};
      }
      if (!fileId) {
        state.tempExecReuseOpen = {};
        return;
      }
      state.tempExecReuseOpen[fileId] = new Set();
    }

    function ensureTempExecDefectOpen(fileId) {
      if (!state.tempExecDefectOpen || typeof state.tempExecDefectOpen !== 'object') {
        state.tempExecDefectOpen = {};
      }
      if (!fileId) return new Set();
      if (!state.tempExecDefectOpen[fileId]) {
        state.tempExecDefectOpen[fileId] = new Set();
      }
      return state.tempExecDefectOpen[fileId];
    }

    function resetTempExecDefectOpen(fileId) {
      if (!state.tempExecDefectOpen || typeof state.tempExecDefectOpen !== 'object') {
        state.tempExecDefectOpen = {};
      }
      if (!fileId) {
        state.tempExecDefectOpen = {};
        return;
      }
      state.tempExecDefectOpen[fileId] = new Set();
    }

    function clearTempExecCaseStates(fileId) {
      if (!fileId) return;
      ensureTempExecSelection(fileId).clear();
      ensureTempExecRemarkOpen(fileId).clear();
      ensureTempExecReuseOpen(fileId).clear();
      ensureTempExecDefectOpen(fileId).clear();
    }

    function ensureDefectLinks(caseItem) {
      if (!caseItem) return [];
      if (!Array.isArray(caseItem.defectLinks)) caseItem.defectLinks = [];
      return caseItem.defectLinks;
    }

    function addTempExecDefectLink(fileId, index) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var caseItem = file.cases[index];
      var links = ensureDefectLinks(caseItem);
      links.push({ id: generateDefectLinkId(), url: '' });
      var openSet = ensureTempExecDefectOpen(fileId);
      openSet.add(index);
      persistTempExecState();
      renderTempExecView();
    }

    function removeTempExecDefectLink(fileId, index, linkId) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var caseItem = file.cases[index];
      if (!Array.isArray(caseItem.defectLinks)) return;
      var confirmed = window.confirm('确定删除该缺陷链接吗？');
      if (!confirmed) return;
      caseItem.defectLinks = caseItem.defectLinks.filter(function(link) { return link && link.id !== linkId; });
      persistTempExecState();
      renderTempExecView();
    }

    function updateTempExecDefectLink(fileId, index, linkId, value) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var caseItem = file.cases[index];
      if (!Array.isArray(caseItem.defectLinks)) caseItem.defectLinks = [];
      var entry = caseItem.defectLinks.find(function(link) { return link && link.id === linkId; });
      if (!entry) return;
      entry.url = value || '';
      persistTempExecState();
    }

    function normalizeDefectOpenUrl(url) {
      var text = (url || '').trim();
      if (!text) return '';
      var lower = text.toLowerCase();
      if (lower.indexOf('http://') === 0 || lower.indexOf('https://') === 0) return text;
      if (/^[a-z][a-z0-9+.-]*:/.test(text)) return text;
      return 'https://' + text;
    }

    function openTempExecDefectLink(fileId, index, linkId) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var caseItem = file.cases[index];
      if (!Array.isArray(caseItem.defectLinks)) return;
      var entry = caseItem.defectLinks.find(function(link) { return link && link.id === linkId; });
      var targetUrl = normalizeDefectOpenUrl(entry && entry.url);
      if (!targetUrl) {
        if (tempExecStatus) setStatus(tempExecStatus, '请先填写有效的缺陷链接', 'warn');
        return;
      }
      window.open(targetUrl, '_blank');
    }

    function toggleTempExecDefectPanel(fileId, indexes) {
      if (!fileId) return;
      var openSet = ensureTempExecDefectOpen(fileId);
      var list = Array.isArray(indexes) ? indexes : [indexes];
      var valid = list.map(function(idx) { return Number(idx); }).filter(function(idx) { return Number.isInteger(idx); });
      if (!valid.length) return;
      var shouldOpen = !valid.every(function(idx) { return openSet.has(idx); });
      valid.forEach(function(idx) {
        if (shouldOpen) openSet.add(idx);
        else openSet.delete(idx);
      });
      renderTempExecView();
    }

    function applyTempExecSearch(fileId, term, raw) {
      var normalized = (term || '').trim().toLowerCase();
      state.tempExecSearch = { fileId: fileId || '', term: normalized, raw: raw || '' };
      renderTempExecView();
      if (tempExecStatus) {
        if (normalized) {
          setStatus(tempExecStatus, '已应用搜索筛选', 'ok');
        } else {
          setStatus(tempExecStatus, '已清除搜索', 'ok');
        }
      }
    }

    function buildTempExecTag(file, isFocused) {
      if (isFocused) return '<span class="tag tag-focus">专注</span>';
      if (file && file.reuseEnabled) {
        return '<span class="tag tag-reuse">复</span>';
      }
      return '';
    }

    function renderTempExecItemRow(file, options) {
      var opts = options || {};
      var active = opts.activeId === file.id ? 'active' : '';
      var focusSet = opts.focusSet || new Set();
      var stateClass = resolveTempExecState(file);
      var tagHtml = buildTempExecTag(file, focusSet.has(file.id));
      var removeHtml = opts.hideRemove ? '' : '<span class="remove" title="删除" data-temp-remove="' + file.id + '">×</span>';
      var reqKey = normalizeRequirementName(file && file.requirement) || '未标识需求';
      return (
        '<div class="temp-req-row ' + stateClass + '" data-temp-file="' + file.id + '" data-temp-req="' + reqKey + '" draggable="true">' +
          tagHtml +
          '<span class="temp-req-count-badge">' + (file && file.cases ? file.cases.length : 0) + ' 条</span>' +
          '<button type="button" data-temp-file="' + file.id + '" class="temp-req-item ' + active + '">' +
            '<div class="temp-req-line">' +
              '<span class="name" title="' + escapeHtml(file && file.name ? file.name : '测试用例') + '"><span class="name-text">' + escapeHtml(file && file.name ? file.name : '测试用例') + '</span></span>' +
            '</div>' +
            removeHtml +
          '</button>' +
        '</div>'
      );
    }

    function renderTempVersionGrid() {
      if (!tempVersionGrid) return;
      ensureTempVersionList();
      if (!state.tempExecVersions.length) {
        tempVersionGrid.innerHTML = '<span class="hint">暂无版本，点击“新建版本”创建</span>';
        return;
      }
      var placement = ensureTempExecPlacement();
      var orderedIds = ensureVersionOrder(state.tempExecVersions.map(function(ver) { return ver.id; }));
      var versions = state.tempExecVersions.slice().sort(function(a, b) {
        var ia = orderedIds.indexOf(a.id);
        var ib = orderedIds.indexOf(b.id);
        if (ia === -1 && ib === -1) return (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN');
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
      var fileMap = new Map(state.tempExecFiles.map(function(file) { return [file.id, file]; }));
      var focusSet = new Set(state.tempExecFocus || []);
      var cards = versions.map(function(ver) {
        var name = (ver && ver.name ? ver.name : '').trim() || '未命名版本';
        var fileList = Array.isArray(ver && ver.fileIds)
          ? ver.fileIds.map(function(fid) { return fileMap.get(fid); }).filter(Boolean)
          : [];
        var reqBlocks = getVersionRequirementBlocks(ver);
        var body = reqBlocks.length
          ? reqBlocks.map(function(block) {
              var ids = block.ids.join(',');
              var reqRows = block.ids.map(function(fid) {
                var file = fileMap.get(fid);
                if (!file) return '';
                return renderTempExecItemRow(file, {
                  focusSet: focusSet,
                  activeId: state.tempExecActiveId,
                  hideRemove: true,
                });
              }).join('');
              return (
                '<div class="temp-req-box" data-temp-req="' + block.req + '" data-temp-req-key="' + block.key + '" data-temp-file-group="' + ids + '" data-temp-version-group="' + ver.id + '" draggable="true">' +
                  '<div class="temp-req-header">' +
                    '<span class="temp-req-title">' + escapeHtml(block.req) + '</span>' +
                    '<div class="temp-req-actions">' +
                      '<span class="temp-req-count">' + block.ids.length + ' 份</span>' +
                      '<span class="box-remove" title="移出版本" data-temp-group-remove="' + ver.id + '" data-temp-group-ids="' + ids + '">×</span>' +
                    '</div>' +
                  '</div>' +
                  '<div class="temp-req-list">' + reqRows + '</div>' +
                '</div>'
              );
            }).join('')
          : '<span class="placeholder">拖拽需求盒子到此</span>';
        return (
          '<div class="temp-version-card" data-temp-version="' + ver.id + '">' +
            '<div class="header">' +
              '<span class="title" title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</span>' +
              '<div class="version-actions">' +
                '<button class="chip" type="button" data-temp-version-rename="' + ver.id + '" title="重命名">重命名</button>' +
                '<span class="remove" data-temp-version-remove="' + ver.id + '" title="删除版本">×</span>' +
              '</div>' +
            '</div>' +
            '<div class="temp-version-body">' + body + '</div>' +
          '</div>'
        );
      }).join('');
      tempVersionGrid.innerHTML = cards;
      enforceTempFileDraggable(tempVersionGrid);
    }

    function enforceTempFileDraggable(root) {
      if (!root) return;
      var list = root.querySelectorAll('[data-temp-file], [data-temp-file-group]');
      list.forEach(function(el) {
        if (!el.getAttribute('draggable')) {
          el.setAttribute('draggable', 'true');
        }
      });
    }

    function isRequiredTempExecColumn(key) {
      return key === 'select' || key === 'title' || key === 'actual' || key === 'remark' || key === 'defect' || key === 'ops';
    }

    function scrollTempExecViewTop() {
      var target = tempExecView || tempExecViewSection;
      if (target) scrollElementIntoView(target, 'smooth', 140);
    }

    function ensureReusePresets(file) {
      if (!file) return [];
      if (!Array.isArray(file.reusePresets)) file.reusePresets = [];
      return file.reusePresets;
    }

    function startTempExecPresetDraft(fileId) {
      state.tempExecPresetDraft = { fileId: fileId, value: '' };
      renderTempExecView();
    }

    function cancelTempExecPresetDraft() {
      state.tempExecPresetDraft = null;
      renderTempExecView();
    }

    function updateTempExecPresetDraft(value) {
      if (!state.tempExecPresetDraft) return;
      state.tempExecPresetDraft.value = value;
    }

    function applyPresetToCases(file, preset) {
      if (!file || !preset) return;
      file.cases.forEach(function(caseItem) {
        if (!caseItem) return;
        if (!Array.isArray(caseItem.reuseDetails)) caseItem.reuseDetails = [];
        var exists = caseItem.reuseDetails.some(function(detail) { return detail && detail.presetId === preset.id; });
        if (!exists) {
          caseItem.reuseDetails.push({
            id: generateReuseDetailId(),
            text: preset.text,
            note: '',
            status: '未执行',
            presetId: preset.id,
          });
        }
      });
    }

    function removePresetFromCases(file, presetId) {
      if (!file || !presetId) return;
      file.cases.forEach(function(caseItem) {
        if (!caseItem || !Array.isArray(caseItem.reuseDetails)) return;
        caseItem.reuseDetails = caseItem.reuseDetails.filter(function(detail) { return detail && detail.presetId !== presetId; });
      });
    }

    function confirmTempExecPresetDraft(fileId) {
      var draft = state.tempExecPresetDraft;
      if (!draft || !draft.value || draft.value.trim() === '') {
        if (tempExecStatus) setStatus(tempExecStatus, '请先输入复用预设内容', 'warn');
        return;
      }
      var file = getTempExecFile(fileId);
      if (!file) return;
      var presets = ensureReusePresets(file);
      var exists = presets.some(function(item) { return item && item.text === draft.value; });
      if (exists) {
        if (tempExecStatus) setStatus(tempExecStatus, '已存在相同的预设子项', 'warn');
        return;
      }
      var preset = { id: generateReusePresetId(), text: draft.value };
      presets.push(preset);
      applyPresetToCases(file, preset);
      state.tempExecPresetDraft = null;
      persistTempExecState();
      renderTempExecView();
    }

    function removeTempExecPreset(fileId, presetId) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      var presets = ensureReusePresets(file);
      var before = presets.length;
      file.reusePresets = presets.filter(function(item) { return item && item.id !== presetId; });
      if (before !== file.reusePresets.length) {
        removePresetFromCases(file, presetId);
        persistTempExecState();
        renderTempExecView();
      }
    }

    function resolveTempExecState(file) {
      if (!file || !Array.isArray(file.cases)) return 'pending';
      var summary = buildTempExecSummary(file);
      var total = summary.total || 0;
      var completionCount = summary.passed + summary.unspecified;
      var hasFailure = summary.failed > 0 || summary.blocked > 0;
      if (total && completionCount === total && !hasFailure) return 'ok';
      if (total && summary.pending === 0 && hasFailure) return 'err';
      if (summary.executed > 0) return 'running';
      return 'pending';
    }

    function getCaseExecutionStatus(file, caseItem) {
      if (!file || !caseItem) return '未执行';
      if (!file.reuseEnabled) return caseItem.actual || '未执行';
      var aggregate = aggregateReuseDetails(caseItem.reuseDetails);
      if (aggregate.passed) return '通过';
      if (aggregate.failed) return '失败';
      if (aggregate.blocked) return '阻塞';
      if (aggregate.unspecified) return '不适用';
      return '未执行';
    }

    function aggregateReuseDetails(details) {
      var stats = { pending: 0, passed: 0, failed: 0, blocked: 0, unspecified: 0 };
      if (!Array.isArray(details)) return stats;
      details.forEach(function(detail) {
        if (!detail) return;
        var status = detail.status || '未执行';
        if (status === '通过') stats.passed += 1;
        else if (status === '失败') stats.failed += 1;
        else if (status === '阻塞') stats.blocked += 1;
        else if (status === '不适用') stats.unspecified += 1;
        else stats.pending += 1;
      });
      return stats;
    }

    function buildTempExecSummary(file) {
      var summary = { total: 0, executed: 0, passed: 0, failed: 0, blocked: 0, unspecified: 0, pending: 0 };
      if (!file || !Array.isArray(file.cases)) return summary;
      summary.total = file.cases.length;
      file.cases.forEach(function(item) {
        var status = getCaseExecutionStatus(file, item);
        if (status !== '未执行') summary.executed += 1;
        if (status === '通过') summary.passed += 1;
        else if (status === '失败') summary.failed += 1;
        else if (status === '阻塞') summary.blocked += 1;
        else if (status === '不适用') summary.unspecified += 1;
        else summary.pending += 1;
      });
      return summary;
    }

    function mapStatusToClass(status) {
      if (status === '通过') return 'ok';
      if (status === '失败') return 'err';
      if (status === '阻塞') return 'warn';
      if (status === '不适用') return 'info';
      return '';
    }

    function getCaseExecutionDisplay(file, caseItem) {
      var status = getCaseExecutionStatus(file, caseItem);
      var map = {
        通过: { label: '通过', className: 'status-ok' },
        失败: { label: '失败', className: 'status-err' },
        阻塞: { label: '阻塞', className: 'status-warn' },
        不适用: { label: '不适用', className: 'status-info' },
        未执行: { label: '未执行', className: 'status-pending' },
      };
      return map[status] || { label: status, className: 'status-pending' };
    }

    function renderTempExecOverview() {
      if (!tempExecOverview) return;
      var files = state.tempExecFiles.slice().sort(function(a, b) {
        var sa = buildTempExecSummary(a);
        var sb = buildTempExecSummary(b);
        var pa = sa.total ? sa.executed / sa.total : 0;
        var pb = sb.total ? sb.executed / sb.total : 0;
        if (pa === pb) return (a.createdAt || 0) - (b.createdAt || 0);
        return pa - pb;
      });
      if (!files.length) {
        tempExecOverview.innerHTML = '<p class="hint">暂无用例执行数据</p>';
        return;
      }
      var versionMap = new Map();
      files.forEach(function(file) {
        var verName = getTempVersionName(file.versionId) || '未分配版本';
        if (!versionMap.has(verName)) versionMap.set(verName, []);
        versionMap.get(verName).push(file);
      });
      var versionList = Array.from(versionMap.entries()).map(function(entry) {
        return { name: entry[0], list: entry[1] };
      });
      versionList.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh-Hans-CN'); });
      var versionBlock = versionList
        .filter(function(group) { return group.name !== '未分配版本'; })
        .map(function(group) { return renderTempExecOverviewVersion(group.name, group.list); })
        .join('') || '<p class="hint">暂无分配到版本的用例</p>';
      var unassigned = versionList.find(function(group) { return group.name === '未分配版本'; });
      var unassignedBlock = unassigned ? renderTempExecOverviewUnassigned(unassigned.list) : '<p class="hint">暂无未分配的用例</p>';
      tempExecOverview.innerHTML = (
        '<div class="temp-overview-section">' +
          '<h3 class="temp-overview-section-title">版本区</h3>' +
          '<div class="temp-overview-version-grid">' + versionBlock + '</div>' +
        '</div>' +
        '<div class="temp-overview-section">' +
          '<h3 class="temp-overview-section-title">需求区（未分配版本）</h3>' +
          unassignedBlock +
        '</div>'
      );
    }

    function renderTempExecOverviewVersion(label, list) {
      var reqMap = new Map();
      list.forEach(function(file) {
        var req = normalizeRequirementName(file && file.requirement) || '未标识需求';
        if (!reqMap.has(req)) reqMap.set(req, []);
        reqMap.get(req).push(file);
      });
      var reqBlocks = Array.from(reqMap.entries()).map(function(entry) {
        var req = entry[0];
        var files = entry[1];
        var sorted = files.slice().sort(function(a, b) {
          var sa = buildTempExecSummary(a);
          var sb = buildTempExecSummary(b);
          var pa = sa.total ? sa.executed / sa.total : 0;
          var pb = sb.total ? sb.executed / sb.total : 0;
          if (pa === pb) return (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN');
          return pa - pb;
        });
        return (
          '<div class="temp-overview-req">' +
            '<div class="temp-overview-req-title">' + escapeHtml(req) + '</div>' +
            '<div class="temp-overview-grid two-cols">' + sorted.map(renderTempExecOverviewEntry).join('') + '</div>' +
          '</div>'
        );
      }).join('');
      return (
        '<div class="temp-overview-version">' +
          '<div class="temp-overview-version-header">' + escapeHtml(label) + '</div>' +
          (reqBlocks || '<p class="hint">暂无用例</p>') +
        '</div>'
      );
    }

    function renderTempExecOverviewUnassigned(list) {
      var sorted = list.slice().sort(function(a, b) {
        var sa = buildTempExecSummary(a);
        var sb = buildTempExecSummary(b);
        var pa = sa.total ? sa.executed / sa.total : 0;
        var pb = sb.total ? sb.executed / sb.total : 0;
        if (pa === pb) return (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN');
        return pa - pb;
      });
      return '<div class="temp-overview-grid four-cols">' + sorted.map(renderTempExecOverviewEntry).join('') + '</div>';
    }

    function renderTempExecOverviewEntry(file) {
      var summary = buildTempExecSummary(file);
      var total = summary.total || 0;
      var completionCount = summary.passed + summary.unspecified;
      var executedPercent = total ? Math.round((completionCount / total) * 100) : 0;
      var segments = [
        { label: '通过', count: summary.passed, className: 'status-passed' },
        { label: '失败', count: summary.failed, className: 'status-failed' },
        { label: '阻塞', count: summary.blocked, className: 'status-blocked' },
        { label: '不适用', count: summary.unspecified, className: 'status-unspecified' },
        { label: '未执行', count: summary.pending, className: 'status-pending' },
      ];
      var segmentHtml = total
        ? segments.filter(function(seg) { return seg.count > 0; }).map(function(seg) {
            return (
              '<div class="temp-overview-segment ' + seg.className + '" style="flex:' + seg.count + ';">' +
                '<span>' + seg.count + '</span>' +
              '</div>'
            );
          }).join('')
        : '<div class="temp-overview-segment status-pending" style="flex:1;"><span>0</span></div>';
      var metaHtml = segments.map(function(seg) {
        return '<span><span class="dot ' + (seg.className ? seg.className.replace('status-', '') : '') + '"></span>' + seg.label + ' ' + seg.count + '</span>';
      }).join('');
      var tags = [];
      if (state.tempExecFocus.indexOf(file.id) !== -1) tags.push('<span class="tag tag-focus">专注</span>');
      var tagHtml = tags.join(' ');
      return (
        '<div class="temp-overview-entry" data-temp-file="' + file.id + '">' +
          '<div class="temp-overview-header">' +
            '<span>' + tagHtml + ' ' + escapeHtml(file && file.name ? file.name : '测试用例') + '</span>' +
            '<span class="temp-overview-rate">执行进度 ' + executedPercent + '%（' + completionCount + '/' + summary.total + '）</span>' +
          '</div>' +
          '<div class="temp-overview-bar">' + segmentHtml + '</div>' +
          '<div class="temp-overview-meta">' + metaHtml + '</div>' +
        '</div>'
      );
    }

    function renderTempFocusZone() {
      if (!tempFocusZone) return;
      var focusList = state.tempExecFocus
        .map(function(id) { return getTempExecFile(id); })
        .filter(Boolean);
      var html = focusList.length
        ? focusList.map(function(file) {
            return (
              '<button type="button" draggable="true" data-temp-file="' + file.id + '" class="' + (state.tempExecActiveId === file.id ? 'active' : '') + '">' +
                '<span class="tag tag-focus">专注</span>' +
                '<span>' + escapeHtml(file && file.name ? file.name : '测试用例') + '（' + (file && file.cases ? file.cases.length : 0) + '）</span>' +
                '<span class="remove" title="移出专注区" data-temp-focus-remove="' + file.id + '">×</span>' +
              '</button>'
            );
          }).join('')
        : '<span class="hint">拖拽用例到此区域，专注处理关键用例</span>';
      tempFocusZone.innerHTML = html;
      enforceTempFileDraggable(tempFocusZone);
    }

    function renderTempExecNav() {
      if (!tempExecNav) return;
      var focusSet = new Set(state.tempExecFocus || []);
      var files = state.tempExecFiles
        .filter(function(file) { return !file.versionId; })
        .slice()
        .sort(function(a, b) {
          var nameA = (a && a.name) || '';
          var nameB = (b && b.name) || '';
          return nameA.localeCompare(nameB, 'zh-Hans-CN');
        });
      var groupMap = new Map();
      files.forEach(function(file) {
        var req = normalizeRequirementName(file && file.requirement) || '未标识需求';
        if (!groupMap.has(req)) groupMap.set(req, []);
        groupMap.get(req).push(file);
      });
      var reqOrderList = ensureRequirementOrder(Array.from(groupMap.keys()));
      var globalOrder = files.slice().sort(function(a, b) {
        var na = (a && a.name) || '';
        var nb = (b && b.name) || '';
        return na.localeCompare(nb, 'zh-Hans-CN');
      }).map(function(file) { return file.id; });
      var orderedReqs = reqOrderList.slice();
      var groups = orderedReqs
        .map(function(req) {
          var list = groupMap.get(req) || [];
          var orderedIds = ensureFileOrder(req, list.map(function(item) { return item.id; }));
          var orderedFiles = list.slice().sort(function(a, b) {
            var ia = orderedIds.indexOf(a.id);
            var ib = orderedIds.indexOf(b.id);
            if (ia !== -1 && ib !== -1 && ia !== ib) return ia - ib;
            var ga = globalOrder.indexOf(a.id);
            var gb = globalOrder.indexOf(b.id);
            if (ga !== -1 && gb !== -1 && ga !== gb) return ga - gb;
            if (ia !== -1 && ib === -1) return -1;
            if (ia === -1 && ib !== -1) return 1;
            if (ga !== -1 && gb === -1) return -1;
            if (ga === -1 && gb !== -1) return 1;
            return sortByCreatedDesc(a, b);
          });
          return { req: req, list: orderedFiles };
        })
        .filter(function(group) { return group.list.length; });
      var reqOrderMap = new Map();
      orderedReqs.forEach(function(req, idx) { reqOrderMap.set(req, idx); });
      var reqCreatedMap = new Map();
      groups.forEach(function(group) {
        var times = group.list.map(function(file) { return Number(file && file.createdAt) || 0; }).filter(function(t) { return Number.isFinite(t); });
        var ts = times.length ? Math.min.apply(null, times) : 0;
        reqCreatedMap.set(group.req, ts);
      });
      groups.sort(function(a, b) {
        if (navPrefersUnassigned) {
          var aHasUnassigned = a.list.some(function(file) { return !file.versionId; });
          var bHasUnassigned = b.list.some(function(file) { return !file.versionId; });
          if (aHasUnassigned !== bHasUnassigned) return aHasUnassigned ? -1 : 1;
        }
        var ia = reqOrderMap.has(a.req) ? reqOrderMap.get(a.req) : -1;
        var ib = reqOrderMap.has(b.req) ? reqOrderMap.get(b.req) : -1;
        if (ia !== -1 && ib !== -1 && ia !== ib) return ia - ib;
        var ta = reqCreatedMap.has(a.req) ? reqCreatedMap.get(a.req) : 0;
        var tb = reqCreatedMap.has(b.req) ? reqCreatedMap.get(b.req) : 0;
        if (ta !== tb) return ta - tb;
        return a.req.localeCompare(b.req, 'zh-Hans-CN');
      });
      var boxesHtml = groups.length
        ? groups.map(function(group) {
            return (
              '<div class="temp-req-box" data-temp-req="' + group.req + '" data-temp-file-group="' + group.list.map(function(item) { return item.id; }).join(',') + '" draggable="true">' +
                '<div class="temp-req-header">' +
                  '<span class="temp-req-title">' + escapeHtml(group.req) + '</span>' +
                  '<span class="temp-req-count">' + group.list.length + ' 份</span>' +
                '</div>' +
                '<div class="temp-req-list">' +
                  group.list.map(function(file) {
                    return renderTempExecItemRow(file, {
                      focusSet: focusSet,
                      activeId: state.tempExecActiveId,
                    });
                  }).join('') +
                '</div>' +
              '</div>'
            );
          }).join('')
        : '<span class="hint temp-req-empty">暂无未分配的用例，可从版本拖回或继续导入</span>';
      tempExecNav.innerHTML = '<div class="temp-req-grid" data-temp-req-pool="1">' + boxesHtml + '</div>';
      if (exportTempExecBtn) exportTempExecBtn.disabled = !state.tempExecActiveId;
      if (exportTempExecConfigBtn) exportTempExecConfigBtn.disabled = !state.tempExecFiles.length;
      if (exportTempExecXmindBtn) exportTempExecXmindBtn.disabled = !state.tempExecActiveId;
      if (tempExecMindBtn) tempExecMindBtn.disabled = !state.tempExecActiveId;
      renderTempExecOverview();
      renderTempFocusZone();
      enforceTempFileDraggable(tempExecNav);
    }

    function prioritizeTempExecUnassignedRequirements() {
      var placement = ensureTempExecPlacement();
      var reqs = placement.requirementOrder.slice();
      if (!reqs.length) return;
      var reqHasUnassigned = new Map();
      reqs.forEach(function(req) {
        var has = (state.tempExecFiles || []).some(function(file) {
          var r = normalizeRequirementName(file && file.requirement) || '未标识需求';
          return r === req && !file.versionId;
        });
        reqHasUnassigned.set(req, has);
      });
      navPrefersUnassigned = true;
      placement.requirementOrder = reqs.slice().sort(function(a, b) {
        var ha = reqHasUnassigned.get(a);
        var hb = reqHasUnassigned.get(b);
        if (ha !== hb) return ha ? -1 : 1;
        return reqs.indexOf(a) - reqs.indexOf(b);
      });
      renderTempExecNav();
    }

    function prioritizeTempExecUnassignedRequirements() {
      var placement = ensureTempExecPlacement();
      var reqs = placement.requirementOrder.slice();
      if (!reqs.length) return;
      var reqHasUnassigned = new Map();
      reqs.forEach(function(req) {
        var has = (state.tempExecFiles || []).some(function(file) {
          var r = normalizeRequirementName(file && file.requirement) || '未标识需求';
          return r === req && !file.versionId;
        });
        reqHasUnassigned.set(req, has);
      });
      var next = reqs.slice().sort(function(a, b) {
        var ha = reqHasUnassigned.get(a);
        var hb = reqHasUnassigned.get(b);
        if (ha !== hb) return ha ? -1 : 1;
        return reqs.indexOf(a) - reqs.indexOf(b);
      });
      placement.requirementOrder = Array.from(new Set(next));
      renderTempExecNav();
    }

    function renderTempExecView() {
      if (!tempExecView) return;
      var active = getTempExecFile(state.tempExecActiveId);
      if (!active) {
        tempExecView.innerHTML = '<div class="temp-case-empty">请先在上方导入测试用例或点击历史用例</div>';
        if (tempExecMindContainer) tempExecMindContainer.classList.add('hidden');
        state.tempExecMindMode = false;
        if (exportTempExecBtn) exportTempExecBtn.disabled = true;
        if (exportTempExecXmindBtn) exportTempExecXmindBtn.disabled = true;
        if (tempExecMindBtn) {
          tempExecMindBtn.disabled = true;
          tempExecMindBtn.textContent = '切换思维导图视图';
        }
        tempExecView.classList.remove('hidden');
        return;
      }
      tempExecView.innerHTML = renderTempExecTable(active);
      if (state.tempExecMindMode && tempExecMindContainer) {
        tempExecMindContainer.innerHTML = '';
        tempExecMindContainer.classList.remove('hidden');
        tempExecView.classList.add('hidden');
        if (tempExecMindBtn) tempExecMindBtn.textContent = '返回列表视图';
      } else if (tempExecMindContainer) {
        tempExecMindContainer.classList.add('hidden');
        tempExecView.classList.remove('hidden');
        if (tempExecMindBtn) tempExecMindBtn.textContent = '切换思维导图视图';
      }
      if (exportTempExecBtn) exportTempExecBtn.disabled = false;
      if (exportTempExecXmindBtn) exportTempExecXmindBtn.disabled = false;
      if (tempExecMindBtn) tempExecMindBtn.disabled = false;
      renderTempExecOverview();
    }

    function getTempExecFile(fileId) {
      if (!fileId) return null;
      return state.tempExecFiles.find(function(item) { return item.id === fileId; }) || null;
    }

    function getTempExecFilesByRequirement(req) {
      var target = normalizeRequirementName(req) || '未标识需求';
      return state.tempExecFiles.filter(function(file) {
        var name = normalizeRequirementName(file && file.requirement) || '未标识需求';
        return name === target;
      });
    }

    function persistTempExecState() {
      try {
        var payload = {
          files: serializeTempExecFiles(state),
          versions: serializeTempExecVersions(state),
          placement: state.tempExecPlacement || defaultPlacement,
        };
        localStorage.setItem(tempExecStorageKey, JSON.stringify(payload));
      } catch (err) {
        console.warn('临时执行数据保存失败', err);
      }
    }

    function loadTempExecFocus() {
      var saved = [];
      try {
        saved = JSON.parse(localStorage.getItem(tempExecFocusStorageKey) || '[]');
      } catch (err) {
        saved = [];
      }
      if (!Array.isArray(saved)) saved = [];
      state.tempExecFocus = saved.filter(function(id) { return typeof id === 'string'; });
      syncTempExecFocus(true);
      saveTempExecFocus();
    }

    function saveTempExecFocus() {
      try {
        localStorage.setItem(tempExecFocusStorageKey, JSON.stringify(state.tempExecFocus));
      } catch (err) {
        console.warn('专注区数据保存失败', err);
      }
    }

    function syncTempExecFocus(skipSave) {
      var valid = state.tempExecFocus.filter(function(id) { return Boolean(getTempExecFile(id)); });
      if (valid.length !== state.tempExecFocus.length) {
        state.tempExecFocus = valid;
        if (!skipSave) saveTempExecFocus();
      } else if (!skipSave) {
        saveTempExecFocus();
      }
    }

    function addTempExecFocus(fileId) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      if (state.tempExecFocus[0] === fileId) return;
      state.tempExecFocus = [fileId].concat(state.tempExecFocus.filter(function(id) { return id !== fileId; }));
      saveTempExecFocus();
      if (state.tempExecActiveId !== fileId) {
        setTempExecActive(fileId);
      } else {
        renderTempExecNav();
        renderTempVersionGrid();
      }
      renderTempFocusZone();
    }

    function removeTempExecFocus(fileId, requireConfirm) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      var needConfirm = requireConfirm !== false;
      if (needConfirm) {
        var confirmed = window.confirm('确定将【' + file.name + '】移出专注区吗？');
        if (!confirmed) return;
      }
      state.tempExecFocus = state.tempExecFocus.filter(function(id) { return id !== fileId; });
      file.scope = 'history';
      persistTempExecState();
      saveTempExecFocus();
      renderTempExecNav();
      renderTempVersionGrid();
      renderTempFocusZone();
    }

    function buildTempExecPagination(file, totalCases, pageIndex, totalPages, start, end) {
      var pageSize = getTempExecPageSize();
      var displayStart = totalCases ? start + 1 : 0;
      var displayEnd = totalCases ? Math.min(end, totalCases) : 0;
      var maxPage = Math.max(totalPages, 1);
      var currentPage = totalPages ? pageIndex + 1 : 1;
      var rangeInfo = totalCases
        ? '显示 ' + displayStart + '-' + displayEnd + ' / ' + totalCases + ' 条'
        : '暂无用例';
      return (
        '<div class="temp-pagination">' +
          '<div class="temp-pagination-info">' + rangeInfo + '，每页 ' + pageSize + ' 条</div>' +
          '<div class="temp-pagination-controls">' +
            '<button type="button" class="secondary" data-temp-page-action="' + file.id + '" data-action="prev" ' + (pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
            '<span>第 ' + currentPage + ' / ' + maxPage + ' 页</span>' +
            '<button type="button" class="secondary" data-temp-page-action="' + file.id + '" data-action="next" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
            '<label>跳至' +
              '<input type="number" min="1" max="' + maxPage + '" value="' + Math.min(currentPage, maxPage) + '" data-temp-page-input="' + file.id + '">' +
              '页' +
            '</label>' +
          '</div>' +
        '</div>'
      );
    }

    function renderReusePresetPanel(file) {
      var presets = ensureReusePresets(file);
      var draft = state.tempExecPresetDraft && state.tempExecPresetDraft.fileId === file.id
        ? state.tempExecPresetDraft.value || ''
        : null;
      var chips = presets.map(function(preset) {
        return (
          '<span class="preset-chip">' +
            escapeHtml(preset.text) +
            '<span class="remove" data-temp-reuse-preset-remove="' + file.id + '" data-preset="' + preset.id + '">×</span>' +
          '</span>'
        );
      }).join('');
      var inputHtml = draft !== null
        ? (
          '<span class="preset-input">' +
            '<input data-temp-reuse-preset-input="' + file.id + '" value="' + escapeHtml(draft) + '" placeholder="输入预设子项..." />' +
            '<button type="button" data-temp-reuse-preset-confirm="' + file.id + '">保存</button>' +
            '<button type="button" data-temp-reuse-preset-cancel>取消</button>' +
          '</span>'
        )
        : '';
      var placeholder = !chips && draft === null
        ? '<span class="hint">暂无预设子项，可提前配置常用测试项</span>'
        : '';
      return (
        '<div class="reuse-presets">' +
          '<button type="button" class="preset-add" data-temp-reuse-preset-add="' + file.id + '">＋ 预设子项</button>' +
          inputHtml +
          (chips || placeholder) +
        '</div>'
      );
    }

    function renderReuseEntries(file, caseItem, caseIndex) {
      var details = Array.isArray(caseItem.reuseDetails) ? caseItem.reuseDetails : [];
      if (!details.length) {
        return '<p class="reuse-empty">暂无复用测试项，点击下方“＋ 添加测试项”。</p>';
      }
      return (
        '<div class="reuse-list">' +
          details.map(function(detail) {
            var statusClass = mapStatusToClass(detail.status);
            return (
              '<div class="reuse-entry" data-detail="' + detail.id + '">' +
                '<input class="reuse-input" data-temp-reuse-text="' + file.id + '" data-index="' + caseIndex + '" data-detail="' + detail.id + '" placeholder="输入测试项..." value="' + escapeHtml(detail.text || '') + '"/>' +
                '<input class="reuse-note" data-temp-reuse-note="' + file.id + '" data-index="' + caseIndex + '" data-detail="' + detail.id + '" placeholder="输入独立备注..." value="' + escapeHtml(detail.note || '') + '"/>' +
                '<select class="status-select ' + statusClass + '" data-temp-reuse-status="' + file.id + '" data-index="' + caseIndex + '" data-detail="' + detail.id + '">' +
                  tempExecResultOptions.map(function(opt) {
                    return '<option value="' + opt + '" ' + (detail.status === opt ? 'selected' : '') + '>' + opt + '</option>';
                  }).join('') +
                '</select>' +
                '<button type="button" class="reuse-remove" data-temp-reuse-remove="' + file.id + '" data-index="' + caseIndex + '" data-detail="' + detail.id + '" title="删除测试项">删除</button>' +
              '</div>'
            );
          }).join('') +
        '</div>'
      );
    }

    function renderDefectLinks(caseItem, fileId, caseIndex) {
      var links = Array.isArray(caseItem.defectLinks) ? caseItem.defectLinks : [];
      if (!links.length) {
        return '<p class="reuse-empty">暂无缺陷链接，点击下方“＋ 添加链接”。</p>';
      }
      return (
        '<div class="defect-list">' +
          links.map(function(link) {
            return (
              '<div class="defect-entry" data-link="' + link.id + '">' +
                '<input type="url" placeholder="粘贴缺陷链接..." value="' + escapeHtml(link.url || '') + '" data-temp-defect-link="' + fileId + '" data-index="' + caseIndex + '" data-link="' + link.id + '">' +
                '<button type="button" class="defect-open" data-temp-defect-open="' + fileId + '" data-index="' + caseIndex + '" data-link="' + link.id + '">打开</button>' +
                '<button type="button" class="defect-remove" data-temp-defect-remove="' + fileId + '" data-index="' + caseIndex + '" data-link="' + link.id + '">删除</button>' +
              '</div>'
            );
          }).join('') +
        '</div>'
      );
    }

    function renderTempExecTable(file) {
      var searchState = state.tempExecSearch || { fileId: '', term: '', raw: '' };
      var searchTerm = searchState.fileId === file.id ? (searchState.term || '') : '';
      var matches = file.cases.map(function(item, idx) { return { item: item, idx: idx }; }).filter(function(entry) {
        if (!searchTerm) return true;
        var target = [
          entry.item.module,
          entry.item.title,
          entry.item.priority,
          entry.item.preconditions,
          entry.item.steps,
          entry.item.expected,
          entry.item.remark,
        ].map(function(text) { return (text || '').toString().toLowerCase(); }).join(' ');
        return target.indexOf(searchTerm) !== -1;
      });
      var selection = ensureTempExecSelection(file.id);
      var remarkOpenSet = ensureTempExecRemarkOpen(file.id);
      var reuseOpenSet = ensureTempExecReuseOpen(file.id);
      var defectOpenSet = ensureTempExecDefectOpen(file.id);
      var reuseEnabled = Boolean(file.reuseEnabled);
      var pageSize = getTempExecPageSize();
      var totalCases = matches.length;
      var totalPages = totalCases ? Math.ceil(totalCases / pageSize) : 1;
      var pageIndex = ensureTempExecPageIndex(file.id);
      if (pageIndex >= totalPages) {
        pageIndex = Math.max(totalPages - 1, 0);
        state.tempExecPages[file.id] = pageIndex;
      }
      var start = pageIndex * pageSize;
      var end = Math.min(totalCases, start + pageSize);
      var cols = ensureTempExecColumns();
      var show = function(key) { return isRequiredTempExecColumn(key) ? true : cols[key] !== false; };
      var visibleIndexes = [];
      var columnOrder = ['select', 'index', 'module', 'title', 'priority', 'preconditions', 'steps', 'expected', 'actual', 'remark', 'defect', 'ops'];
      var visibleKeys = columnOrder.filter(show);
      var colCount = visibleKeys.length || 1;
      var paged = matches.filter(function(_, idx) { return idx >= start && idx < end; });
      var rows = paged.map(function(entry) {
        var item = entry.item;
        var idx = entry.idx;
        visibleIndexes.push(idx);
        var editPlaceholder = '点击此处编辑';
        var moduleHtml = escapeHtml(item.module || '-');
        var titleHtml = item.title ? escapeHtml(item.title) : '';
        var priorityHtml = item.priority ? escapeHtml(item.priority) : '';
        var preHtml = item.preconditions ? escapeHtml(item.preconditions).replace(/\n/g, '<br>') : '';
        var stepsHtml = item.steps ? escapeHtml(item.steps).replace(/\n/g, '<br>') : '';
        var expectedHtml = item.expected ? escapeHtml(item.expected).replace(/\n/g, '<br>') : '';
        var remarkOpen = remarkOpenSet.has(idx);
        var reuseOpen = reuseOpenSet.has(idx);
        var hasRemark = Boolean(item.remark && item.remark.trim());
        var remarkBtnClass = ['remark-toggle'];
        if (remarkOpen) remarkBtnClass.push('active');
        if (hasRemark) remarkBtnClass.push('filled');
        var defectOpen = defectOpenSet.has(idx);
        var hasDefects = Array.isArray(item.defectLinks) && item.defectLinks.length;
        var defectBtnClass = ['defect-toggle'];
        if (defectOpen) defectBtnClass.push('active');
        if (hasDefects) defectBtnClass.push('filled');
        var resultOptions = tempExecResultOptions.map(function(opt) {
          return '<option value="' + opt + '" ' + (item.actual === opt ? 'selected' : '') + '>' + opt + '</option>';
        }).join('');
        var reuseStatus = getCaseExecutionDisplay(file, item);
        var actualCell = reuseEnabled
          ? '<td class="reuse-cell actual">' +
              '<button type="button" class="reuse-status ' + reuseStatus.className + '" data-temp-reuse-panel="' + file.id + '" data-index="' + idx + '">' +
                escapeHtml(reuseStatus.label) +
              '</button>' +
            '</td>'
          : '<td class="actual">' +
              '<select class="status-select" data-temp-result="' + file.id + '" data-index="' + idx + '" data-status="' + item.actual + '">' +
                resultOptions +
              '</select>' +
            '</td>';
        var cells = [];
        visibleKeys.forEach(function(key) {
          if (key === 'select') {
            cells.push('<td class="check"><input type="checkbox" data-temp-select="' + file.id + '" data-index="' + idx + '" ' + (selection.has(idx) ? 'checked' : '') + '></td>');
          } else if (key === 'index') {
            cells.push('<td class="index">' + (idx + 1) + '</td>');
          } else if (key === 'module') {
            cells.push('<td class="module">' + moduleHtml + '</td>');
          } else if (key === 'title') {
            cells.push(
              '<td class="title"><div class="temp-inline-edit" contenteditable="true" data-temp-edit-field="title" data-temp-edit-file="' + file.id + '" data-temp-edit-index="' + idx + '" data-temp-edit-multiline="false" data-placeholder="' + editPlaceholder + '">' + titleHtml + '</div></td>'
            );
          } else if (key === 'priority') {
            cells.push(
              '<td><div class="temp-inline-edit" contenteditable="true" data-temp-edit-field="priority" data-temp-edit-file="' + file.id + '" data-temp-edit-index="' + idx + '" data-temp-edit-multiline="false" data-placeholder="' + editPlaceholder + '">' + priorityHtml + '</div></td>'
            );
          } else if (key === 'preconditions') {
            cells.push(
              '<td><div class="temp-inline-edit" contenteditable="true" data-temp-edit-field="preconditions" data-temp-edit-file="' + file.id + '" data-temp-edit-index="' + idx + '" data-temp-edit-multiline="true" data-placeholder="' + editPlaceholder + '">' + preHtml + '</div></td>'
            );
          } else if (key === 'steps') {
            cells.push(
              '<td><div class="temp-inline-edit" contenteditable="true" data-temp-edit-field="steps" data-temp-edit-file="' + file.id + '" data-temp-edit-index="' + idx + '" data-temp-edit-multiline="true" data-placeholder="' + editPlaceholder + '">' + stepsHtml + '</div></td>'
            );
          } else if (key === 'expected') {
            cells.push(
              '<td><div class="temp-inline-edit" contenteditable="true" data-temp-edit-field="expected" data-temp-edit-file="' + file.id + '" data-temp-edit-index="' + idx + '" data-temp-edit-multiline="true" data-placeholder="' + editPlaceholder + '">' + expectedHtml + '</div></td>'
            );
          } else if (key === 'actual') {
            cells.push(actualCell);
          } else if (key === 'remark') {
            cells.push('<td><button type="button" class="' + remarkBtnClass.join(' ') + '" data-temp-remark-toggle="' + file.id + '" data-index="' + idx + '">' + (hasRemark ? '备注已填' : '备注') + '</button></td>');
          } else if (key === 'defect') {
            cells.push('<td><button type="button" class="' + defectBtnClass.join(' ') + '" data-temp-defect-toggle="' + file.id + '" data-index="' + idx + '">' + (hasDefects ? '链接已填' : '缺陷链接') + '</button></td>');
          } else if (key === 'ops') {
            cells.push(
              '<td class="case-op-col">' +
                '<div class="case-ops">' +
                  '<button type="button" class="case-op remove" title="删除当前用例" data-temp-case-remove="' + file.id + '" data-index="' + idx + '">−</button>' +
                  '<button type="button" class="case-op add" title="在下方插入空用例" data-temp-case-insert="' + file.id + '" data-index="' + idx + '">＋</button>' +
                '</div>' +
              '</td>'
            );
          }
        });
        var reuseRow = reuseEnabled
          ? '<tr class="reuse-row ' + (reuseOpen ? 'visible' : '') + '">' +
              '<td colspan="' + colCount + '">' +
                '<div class="reuse-panel" data-temp-reuse-panel-container="' + file.id + '" data-index="' + idx + '">' +
                  renderReuseEntries(file, item, idx) +
                  '<button type="button" class="reuse-add" data-temp-reuse-add="' + file.id + '" data-index="' + idx + '">＋ 添加测试项</button>' +
                '</div>' +
              '</td>' +
            '</tr>'
          : '';
        return (
          '<tr>' +
            cells.join('') +
          '</tr>' +
          reuseRow +
          '<tr class="remark-row ' + (remarkOpen ? 'visible' : '') + '">' +
            '<td colspan="' + colCount + '">' +
              '<textarea class="remark-panel" data-temp-remark="' + file.id + '" data-index="' + idx + '" placeholder="填写执行说明...">' + escapeHtmlPreserve(item.remark) + '</textarea>' +
            '</td>' +
          '</tr>' +
          '<tr class="defect-row ' + (defectOpen ? 'visible' : '') + '">' +
            '<td colspan="' + colCount + '">' +
              '<div class="defect-panel" data-temp-defect-panel="' + file.id + '" data-index="' + idx + '">' +
                renderDefectLinks(item, file.id, idx) +
                '<button type="button" class="defect-add" data-temp-defect-add="' + file.id + '" data-index="' + idx + '">＋ 添加链接</button>' +
              '</div>' +
            '</td>' +
          '</tr>'
        );
      }).join('');
      var allVisibleSelected = visibleIndexes.length && visibleIndexes.every(function(idx) { return selection.has(idx); });
      var headerCheckbox = show('select')
        ? '<th class="check"><input type="checkbox" data-temp-select-all="' + file.id + '" data-temp-visible="' + visibleIndexes.join(',') + '" ' + (visibleIndexes.length ? (allVisibleSelected ? 'checked' : '') : 'disabled') + '></th>'
        : '';
      var emptyRow = visibleIndexes.length
        ? ''
        : '<tr><td colspan="' + colCount + '">' + (file.cases.length ? '当前页暂无用例' : '未解析到有效用例') + '</td></tr>';
      var summary = buildTempExecSummary(file);
      var reuseToggle = (
        '<div class="temp-reuse-toggle">' +
          '<label>' +
            '<input type="checkbox" data-temp-reuse-toggle="' + file.id + '" ' + (reuseEnabled ? 'checked' : '') + '>' +
            '<span>用例复用</span>' +
          '</label>' +
          '<span class="hint">' + (reuseEnabled ? '可为单条用例补充多条执行记录' : '开启后可为用例记录多条执行项') + '</span>' +
        '</div>'
      );
      var presetPanel = reuseEnabled ? renderReusePresetPanel(file) : '';
      var paginationBlock = buildTempExecPagination(file, totalCases, pageIndex, totalPages, start, end);
      var searchRaw = searchState.fileId === file.id ? (searchState.raw || '') : '';
      var searchBar = (
        '<div class="temp-search-bar">' +
          '<input class="temp-search-input" data-temp-search-input="' + file.id + '" value="' + escapeHtml(searchRaw) + '" placeholder="搜索用例关键字">' +
          '<button type="button" class="pill secondary" data-temp-search-btn="' + file.id + '">搜索</button>' +
          '<button type="button" class="pill secondary" data-temp-search-clear="' + file.id + '">清除</button>' +
        '</div>'
      );
      var headerCells = [];
      if (headerCheckbox) headerCells.push(headerCheckbox);
      if (show('index')) headerCells.push('<th class="index">编号</th>');
      if (show('module')) headerCells.push('<th class="module">模块</th>');
      headerCells.push('<th class="title">用例标题</th>');
      if (show('priority')) headerCells.push('<th>优先级</th>');
      if (show('preconditions')) headerCells.push('<th>前提条件</th>');
      if (show('steps')) headerCells.push('<th>操作步骤</th>');
      if (show('expected')) headerCells.push('<th>预期结果</th>');
      headerCells.push('<th class="actual">实际结果</th>');
      headerCells.push('<th>备注</th>');
      headerCells.push('<th>缺陷链接</th>');
      if (show('ops')) headerCells.push('<th class="ops" title="增删">增删</th>');
      return (
        reuseToggle +
        presetPanel +
        '<div class="temp-case-summary-row">' +
          '<div class="temp-case-summary">' +
            '当前文件：<strong>' + escapeHtml(file.name) + '</strong>' +
            '<span class="summary-pill executed">已执行 ' + summary.executed + '</span>' +
            '<span class="summary-pill pending">未执行 ' + summary.pending + '</span>' +
            '<span class="summary-pill passed">通过 ' + summary.passed + '</span>' +
            '<span class="summary-pill failed">失败 ' + summary.failed + '</span>' +
            '<span class="summary-pill blocked">阻塞 ' + summary.blocked + '</span>' +
            '<span class="summary-pill unspecified">不适用 ' + summary.unspecified + '</span>' +
          '</div>' +
          searchBar +
        '</div>' +
        paginationBlock +
        '<table data-resizable-id="temp-exec-' + escapeHtml(file.id) + '" data-resizable-label="执行视图 - ' + escapeHtml(file.name || '测试用例') + '">' +
          '<thead>' +
            '<tr>' + headerCells.join('') + '</tr>' +
          '</thead>' +
          '<tbody>' + (rows || emptyRow) + '</tbody>' +
        '</table>' +
        paginationBlock
      );
    }

    function toggleTempExecReusePanel(fileId, indexes) {
      if (!fileId) return;
      var file = getTempExecFile(fileId);
      if (!file) return;
      var openSet = ensureTempExecReuseOpen(fileId);
      var list = Array.isArray(indexes) ? indexes : [indexes];
      var valid = list
        .map(function(idx) { return Number(idx); })
        .filter(function(idx) { return Number.isInteger(idx); });
      if (!valid.length) return;
      var shouldOpen = !valid.every(function(idx) { return openSet.has(idx); });
      valid.forEach(function(idx) {
        if (shouldOpen) openSet.add(idx);
        else openSet.delete(idx);
      });
      renderTempExecView();
    }

    function addTempExecReuseEntry(fileId, index) {
      var file = getTempExecFile(fileId);
      if (!file || !file.reuseEnabled) return;
      if (!file.cases[index]) return;
      var targetCase = file.cases[index];
      if (!Array.isArray(targetCase.reuseDetails)) targetCase.reuseDetails = [];
      targetCase.reuseDetails.push({ id: generateReuseDetailId(), text: '', note: '', status: '未执行' });
      persistTempExecState();
      renderTempExecView();
    }

    function removeTempExecReuseEntry(fileId, index, detailId) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var targetCase = file.cases[index];
      if (!Array.isArray(targetCase.reuseDetails)) return;
      var confirmed = window.confirm('确定删除该复用测试项吗？该操作不可撤销。');
      if (!confirmed) return;
      targetCase.reuseDetails = targetCase.reuseDetails.filter(function(item) { return item.id !== detailId; });
      persistTempExecState();
      renderTempExecView();
    }

    function updateTempExecReuseStatus(fileId, index, detailId, value) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var targetCase = file.cases[index];
      if (!Array.isArray(targetCase.reuseDetails)) targetCase.reuseDetails = [];
      var entry = targetCase.reuseDetails.find(function(item) { return item.id === detailId; });
      if (!entry) return;
      entry.status = tempExecResultOptions.indexOf(value) !== -1 ? value : '未执行';
      persistTempExecState();
      renderTempExecView();
    }

    function updateTempExecReuseText(fileId, index, detailId, text) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var targetCase = file.cases[index];
      if (!Array.isArray(targetCase.reuseDetails)) targetCase.reuseDetails = [];
      var entry = targetCase.reuseDetails.find(function(item) { return item.id === detailId; });
      if (!entry) return;
      entry.text = text || '';
      persistTempExecState();
    }

    function updateTempExecReuseNote(fileId, index, detailId, text) {
      var file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      var targetCase = file.cases[index];
      if (!Array.isArray(targetCase.reuseDetails)) targetCase.reuseDetails = [];
      var entry = targetCase.reuseDetails.find(function(item) { return item.id === detailId; });
      if (!entry) return;
      entry.note = text || '';
      persistTempExecState();
    }

    function handleTempExecReuseToggle(fileId, enabled, checkboxEl) {
      var file = getTempExecFile(fileId);
      if (!file) return;
      if (enabled === Boolean(file.reuseEnabled)) return;
      if (enabled) {
        var hasExecution = file.cases.some(function(item) { return (item.actual && item.actual !== '未执行') || (item.remark && item.remark.trim()); });
        if (hasExecution) {
          var confirmMsg = '开启“用例复用”会清空当前执行结果与备注，是否继续？';
          if (!window.confirm(confirmMsg)) {
            if (checkboxEl) checkboxEl.checked = false;
            return;
          }
          file.cases.forEach(function(item) {
            item.actual = '未执行';
            item.remark = '';
          });
        }
        file.reuseEnabled = true;
        ensureReusePresets(file);
      } else {
        var hasReuse = file.cases.some(function(item) { return Array.isArray(item.reuseDetails) && item.reuseDetails.length; });
        if (hasReuse) {
          var confirmClose = '关闭“用例复用”会删除所有复用测试项与预设子项，是否继续？';
          if (!window.confirm(confirmClose)) {
            if (checkboxEl) checkboxEl.checked = true;
            return;
          }
        }
        file.reuseEnabled = false;
        file.cases.forEach(function(item) {
          item.reuseDetails = [];
        });
        file.reusePresets = [];
        if (state.tempExecPresetDraft && state.tempExecPresetDraft.fileId === fileId) {
          state.tempExecPresetDraft = null;
        }
        resetTempExecReuseOpen(fileId);
      }
      persistTempExecState();
      renderTempExecView();
    }

    return {
      normalizeTempExecCases: normalizeTempExecCases,
      normalizeTempExecPlacement: normalizeTempExecPlacement,
      serializeSingleTempExecFile: serializeSingleTempExecFile,
      serializeTempExecFiles: serializeTempExecFiles,
      serializeTempExecVersions: serializeTempExecVersions,
      serializeTempExecSnapshot: serializeTempExecSnapshot,
      exportTempExecSnapshot: exportTempExecSnapshot,
      importTempExecSnapshot: importTempExecSnapshot,
      applyTempExecSnapshot: applyTempExecSnapshot,
      ensureTempExecPlacement: ensureTempExecPlacement,
      ensureRequirementOrder: ensureRequirementOrder,
      ensureFileOrder: ensureFileOrder,
      ensureVersionOrder: ensureVersionOrder,
      reorderRequirementOrder: reorderRequirementOrder,
      updateVersionOrder: updateVersionOrder,
      removeFileFromOrder: removeFileFromOrder,
      insertFileIntoOrder: insertFileIntoOrder,
      syncTempExecPlacement: syncTempExecPlacement,
      moveTempExecFileToRequirement: moveTempExecFileToRequirement,
      clampTempExecPageSize: clampTempExecPageSize,
      loadTempExecPageSizeSetting: loadTempExecPageSizeSetting,
      saveTempExecPageSizeSetting: saveTempExecPageSizeSetting,
      ensureTempExecPageIndex: ensureTempExecPageIndex,
      getTempExecPageSize: getTempExecPageSize,
      resetTempExecPages: resetTempExecPages,
      setTempExecPage: setTempExecPage,
      changeTempExecPage: changeTempExecPage,
      applyTempExecPageSize: applyTempExecPageSize,
      ensureTempVersionList: ensureTempVersionList,
      getTempVersion: getTempVersion,
      applyVersionAssignments: applyVersionAssignments,
      isVersionNameDuplicate: isVersionNameDuplicate,
      createTempVersion: createTempVersion,
      removeTempExecFromVersion: removeTempExecFromVersion,
      removeTempGroupFromVersion: removeTempGroupFromVersion,
      moveTempExecToVersion: moveTempExecToVersion,
      moveTempExecFileWithinVersion: moveTempExecFileWithinVersion,
      getVersionRequirementBlocks: getVersionRequirementBlocks,
      parseReqPayload: parseReqPayload,
      reorderVersionRequirement: reorderVersionRequirement,
      moveRequirementToVersion: moveRequirementToVersion,
      moveRequirementOutOfVersion: moveRequirementOutOfVersion,
      removeTempVersion: removeTempVersion,
      reorderTempVersion: reorderTempVersion,
      renameTempVersion: renameTempVersion,
      getTempVersionName: getTempVersionName,
      ensureTempExecSelection: ensureTempExecSelection,
      resetTempExecSelections: resetTempExecSelections,
      ensureTempExecRemarkOpen: ensureTempExecRemarkOpen,
      resetTempExecRemarkOpen: resetTempExecRemarkOpen,
      ensureTempExecReuseOpen: ensureTempExecReuseOpen,
      resetTempExecReuseOpen: resetTempExecReuseOpen,
      ensureTempExecDefectOpen: ensureTempExecDefectOpen,
      resetTempExecDefectOpen: resetTempExecDefectOpen,
      clearTempExecCaseStates: clearTempExecCaseStates,
      ensureDefectLinks: ensureDefectLinks,
      addTempExecDefectLink: addTempExecDefectLink,
      removeTempExecDefectLink: removeTempExecDefectLink,
      updateTempExecDefectLink: updateTempExecDefectLink,
      openTempExecDefectLink: openTempExecDefectLink,
      toggleTempExecDefectPanel: toggleTempExecDefectPanel,
      applyTempExecSearch: applyTempExecSearch,
      getTempExecFile: getTempExecFile,
      getTempExecFilesByRequirement: getTempExecFilesByRequirement,
      persistTempExecState: persistTempExecState,
      renderTempExecNav: renderTempExecNav,
      renderTempExecView: renderTempExecView,
      renderTempVersionGrid: renderTempVersionGrid,
      renderTempExecTable: renderTempExecTable,
      renderTempExecOverview: renderTempExecOverview,
      renderTempFocusZone: renderTempFocusZone,
      scrollTempExecViewTop: scrollTempExecViewTop,
      ensureReusePresets: ensureReusePresets,
      startTempExecPresetDraft: startTempExecPresetDraft,
      cancelTempExecPresetDraft: cancelTempExecPresetDraft,
      updateTempExecPresetDraft: updateTempExecPresetDraft,
      confirmTempExecPresetDraft: confirmTempExecPresetDraft,
      removeTempExecPreset: removeTempExecPreset,
      toggleTempExecReusePanel: toggleTempExecReusePanel,
      addTempExecReuseEntry: addTempExecReuseEntry,
      removeTempExecReuseEntry: removeTempExecReuseEntry,
      updateTempExecReuseStatus: updateTempExecReuseStatus,
      updateTempExecReuseText: updateTempExecReuseText,
      updateTempExecReuseNote: updateTempExecReuseNote,
      handleTempExecReuseToggle: handleTempExecReuseToggle,
      getCaseExecutionDisplay: getCaseExecutionDisplay,
      loadTempExecFocus: loadTempExecFocus,
      saveTempExecFocus: saveTempExecFocus,
      syncTempExecFocus: syncTempExecFocus,
      addTempExecFocus: addTempExecFocus,
      removeTempExecFocus: removeTempExecFocus,
      prioritizeTempExecUnassignedRequirements: prioritizeTempExecUnassignedRequirements,
    };
  }

  window.app = window.app || {};
  window.app.tempexecCore = { init: init };
})();
