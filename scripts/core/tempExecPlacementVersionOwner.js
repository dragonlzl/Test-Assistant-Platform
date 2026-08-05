(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecPlacementVersionOwner = api;
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
    var storage = opts.storage || (root && root.localStorage ? root.localStorage : null);
    var defaultPlacement = opts.defaultPlacement || {
      requirementOrder: [],
      fileOrder: {},
      versionOrder: [],
      projectOrder: [],
      versionOrderByProject: {},
      fileOrderByProjectVersion: {},
    };
    var defaultTempExecPageSize = Number(opts.defaultTempExecPageSize) || 20;
    var tempExecPageSizeStorageKey = opts.tempExecPageSizeStorageKey || 'tempexec-page-size';
    var tempExecStatus = opts.tempExecStatus || null;
    var tempVersionGrid = opts.tempVersionGrid || null;
    var tempExecNav = opts.tempExecNav || null;
    var normalizeTempExecPlacement = port('normalizeTempExecPlacement', function(value) { return value || {}; });
    var normalizeRequirementName = port('normalizeRequirementName', function(text) { return text || ''; });
    var normalizeTempExecName = port('normalizeTempExecName', function(text) {
      return String(text || '').trim().toLowerCase();
    });
    var generateTempVersionId = port('generateTempVersionId', function() { return 'tempver-' + Date.now(); });
    var generateReuseDetailId = port('generateReuseDetailId', function() { return 'reuse-detail-' + Date.now(); });
    var getTempExecFile = port('getTempExecFile', function() { return null; });
    var getTempExecFileCaseCount = port('getTempExecFileCaseCount', function(file) {
      return file && Array.isArray(file.cases) ? file.cases.length : 0;
    });
    var getTempExecFilesByRequirement = port('getTempExecFilesByRequirement', function() { return []; });
    var isTempExecProjectLayoutEnabled = port('isTempExecProjectLayoutEnabled', function() { return false; });
    var persistTempExecState = port('persistTempExecState');
    var renderTempExecNav = port('renderTempExecNav');
    var renderTempVersionGrid = port('renderTempVersionGrid');
    var renderTempExecView = port('renderTempExecView');
    var scrollTempExecViewTop = port('scrollTempExecViewTop');
    var setTempExecActive = port('setTempExecActive');
    var persistSettings = port('persistSettings');
    var scheduleTempExecUiSave = port('scheduleTempExecUiSave');
    var setStatus = port('setStatus');
    function ensureTempExecPlacement() {
      if (!state.tempExecPlacement || typeof state.tempExecPlacement !== 'object') {
        state.tempExecPlacement = normalizeTempExecPlacement(defaultPlacement);
      }
      if (!Array.isArray(state.tempExecPlacement.requirementOrder)) state.tempExecPlacement.requirementOrder = [];
      if (!state.tempExecPlacement.fileOrder || typeof state.tempExecPlacement.fileOrder !== 'object') {
        state.tempExecPlacement.fileOrder = {};
      }
      if (!Array.isArray(state.tempExecPlacement.versionOrder)) state.tempExecPlacement.versionOrder = [];
      if (!Array.isArray(state.tempExecPlacement.projectOrder)) state.tempExecPlacement.projectOrder = [];
      if (!state.tempExecPlacement.versionOrderByProject || typeof state.tempExecPlacement.versionOrderByProject !== 'object') {
        state.tempExecPlacement.versionOrderByProject = {};
      }
      if (!state.tempExecPlacement.fileOrderByProjectVersion || typeof state.tempExecPlacement.fileOrderByProjectVersion !== 'object') {
        state.tempExecPlacement.fileOrderByProjectVersion = {};
      }
      return state.tempExecPlacement;
    }

    function resolveProjectName(projectId) {
      var pid = projectId === null || projectId === undefined ? '' : String(projectId);
      if (!pid) return '项目#未知';
      var list = Array.isArray(state.projects) ? state.projects : [];
      var found = list.find(function(p) { return p && String(p.id) === pid; });
      var name = found && found.name ? String(found.name) : '';
      return name.trim() || ('项目#' + pid);
    }

    function resolveVersionName(projectId, versionId) {
      var vid = versionId === null || versionId === undefined ? '' : String(versionId);
      if (!vid) return '版本#未知';
      var pid = projectId === null || projectId === undefined ? '' : String(projectId);
      var byProject = state.projectVersionsByProject && typeof state.projectVersionsByProject === 'object'
        ? state.projectVersionsByProject
        : {};
      var list = byProject && pid && Array.isArray(byProject[pid]) ? byProject[pid] : [];
      var found = list.find(function(v) { return v && String(v.id) === vid; });
      var name = found && found.name ? String(found.name) : '';
      return name.trim() || ('版本#' + vid);
    }

    function updateTempExecFileCountBadge(fileId) {
      if (!fileId) return;
      var file = getTempExecFile(fileId);
      if (!file) return;
      var count = getTempExecFileCaseCount(file);
      var badgeText = count + ' 条';
      try {
        var nodes = [];
        if (tempVersionGrid && tempVersionGrid.querySelectorAll) {
          nodes = nodes.concat(Array.prototype.slice.call(tempVersionGrid.querySelectorAll('.temp-req-row[data-temp-file="' + String(fileId) + '"] .temp-req-count-badge')));
        }
        if (tempExecNav && tempExecNav.querySelectorAll) {
          nodes = nodes.concat(Array.prototype.slice.call(tempExecNav.querySelectorAll('.temp-req-row[data-temp-file="' + String(fileId) + '"] .temp-req-count-badge')));
        }
        nodes.forEach(function(node) {
          if (!node) return;
          node.textContent = badgeText;
        });
      } catch (err) {
        // ignore dom update errors
      }
    }

    function ensureProjectOrder(projectIds, projectMeta) {
      var placement = ensureTempExecPlacement();
      var list = Array.isArray(projectIds) ? projectIds : [];
      var normalized = list.map(function(id) { return id === null || id === undefined ? '' : String(id); }).filter(Boolean);
      var globalState = browser.app && browser.app.state ? browser.app.state : {};
      var settings = globalState && globalState.settings && typeof globalState.settings === 'object' ? globalState.settings : {};
      var userOrder = Array.isArray(settings.projectOrder) ? settings.projectOrder.slice() : [];
      userOrder = userOrder.map(function(id) { return id === null || id === undefined ? '' : String(id); }).filter(Boolean);
      var useUserOrder = userOrder.length > 0;

      var existing = useUserOrder
        ? userOrder.filter(function(id) { return normalized.includes(id); })
        : placement.projectOrder.filter(function(id) { return normalized.includes(id); });
      var missing = normalized.filter(function(id) { return existing.indexOf(id) === -1; });
      if (missing.length) {
        var metaMap = projectMeta && typeof projectMeta.get === 'function' ? projectMeta : null;
        missing.sort(function(a, b) {
          var ta = metaMap ? Number(metaMap.get(a) || 0) : 0;
          var tb = metaMap ? Number(metaMap.get(b) || 0) : 0;
          if (ta !== tb) return tb - ta;
          return a.localeCompare(b, 'zh-Hans-CN');
        });
      }
      // 用户已在“项目排序”设置中明确配置时：按用户排序为准，新增项目自动追加到末尾。
      // 未配置时：延续旧逻辑（新出现的项目优先靠前）。
      placement.projectOrder = useUserOrder ? existing.concat(missing) : missing.concat(existing);
      return placement.projectOrder.slice();
    }

    function ensureProjectVersionOrder(projectId, versionIds, metaMap) {
      var placement = ensureTempExecPlacement();
      var pid = projectId === null || projectId === undefined ? '' : String(projectId);
      if (!pid) return [];
      if (!placement.versionOrderByProject[pid]) placement.versionOrderByProject[pid] = [];
      var list = Array.isArray(versionIds) ? versionIds : [];
      var normalized = list.map(function(id) { return id === null || id === undefined ? '' : String(id || ''); });
      normalized = normalized.filter(function(id) { return id !== null && id !== undefined; });
      var existing = placement.versionOrderByProject[pid].filter(function(id) { return normalized.includes(id); });
      var missing = normalized.filter(function(id) { return existing.indexOf(id) === -1; });
      if (missing.length) {
        var meta = metaMap && typeof metaMap.get === 'function' ? metaMap : null;
        missing.sort(function(a, b) {
          var ta = meta ? Number(meta.get(a) || 0) : 0;
          var tb = meta ? Number(meta.get(b) || 0) : 0;
          if (ta !== tb) return tb - ta;
          return a.localeCompare(b, 'zh-Hans-CN');
        });
      }
      placement.versionOrderByProject[pid] = missing.concat(existing);
      return placement.versionOrderByProject[pid].slice();
    }

    function ensureProjectVersionFileOrder(projectId, versionId, fileIds, metaMap) {
      var placement = ensureTempExecPlacement();
      var pid = projectId === null || projectId === undefined ? '' : String(projectId);
      if (!pid) return [];
      var vid = versionId === null || versionId === undefined ? '' : String(versionId || '');
      if (!placement.fileOrderByProjectVersion[pid]) placement.fileOrderByProjectVersion[pid] = {};
      if (!placement.fileOrderByProjectVersion[pid][vid]) placement.fileOrderByProjectVersion[pid][vid] = [];
      var list = Array.isArray(fileIds) ? fileIds : [];
      var normalized = list.map(function(id) { return id === null || id === undefined ? '' : String(id); }).filter(Boolean);
      var existing = placement.fileOrderByProjectVersion[pid][vid].filter(function(id) { return normalized.includes(id); });
      var missing = normalized.filter(function(id) { return existing.indexOf(id) === -1; });
      if (missing.length) {
        var meta = metaMap && typeof metaMap.get === 'function' ? metaMap : null;
        missing.sort(function(a, b) {
          var ta = meta ? Number(meta.get(a) || 0) : 0;
          var tb = meta ? Number(meta.get(b) || 0) : 0;
          if (ta !== tb) return tb - ta;
          return a.localeCompare(b, 'zh-Hans-CN');
        });
      }
      placement.fileOrderByProjectVersion[pid][vid] = missing.concat(existing);
      return placement.fileOrderByProjectVersion[pid][vid].slice();
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

      if (isTempExecProjectLayoutEnabled()) {
        var files = Array.isArray(state.tempExecFiles) ? state.tempExecFiles.slice() : [];
        var projects = new Map();
        var projectMeta = new Map();
        files.forEach(function(file) {
          var pid = file && file.projectId ? String(file.projectId) : '';
          if (!pid) return;
          if (!projects.has(pid)) projects.set(pid, new Map());
          var vid = file && file.versionId !== null && file.versionId !== undefined ? String(file.versionId || '') : '';
          if (!projects.get(pid).has(vid)) projects.get(pid).set(vid, []);
          projects.get(pid).get(vid).push(String(file.id));
          var ts = Number(file && file.createdAt) || 0;
          if (!Number.isFinite(ts)) ts = 0;
          var prev = projectMeta.has(pid) ? Number(projectMeta.get(pid) || 0) : 0;
          if (ts > prev) projectMeta.set(pid, ts);
        });
        ensureProjectOrder(Array.from(projects.keys()), projectMeta);
        projects.forEach(function(vmap, pid) {
          var versionMeta = new Map();
          vmap.forEach(function(idList, vid) {
            var ts = 0;
            idList.forEach(function(id) {
              var file = getTempExecFile(id);
              var fts = Number(file && file.createdAt) || 0;
              if (Number.isFinite(fts) && fts > ts) ts = fts;
            });
            versionMeta.set(String(vid || ''), ts);
          });
          ensureProjectVersionOrder(pid, Array.from(vmap.keys()), versionMeta);
          vmap.forEach(function(idList, vid) {
            var fileMeta = new Map();
            idList.forEach(function(id) {
              var file = getTempExecFile(id);
              var ts = Number(file && file.createdAt) || 0;
              if (!Number.isFinite(ts)) ts = 0;
              fileMeta.set(String(id), ts);
            });
            ensureProjectVersionFileOrder(pid, String(vid || ''), idList, fileMeta);
          });
        });
      }
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
        var stored = storage.getItem(tempExecPageSizeStorageKey);
        if (stored === null || stored === undefined) return defaultTempExecPageSize;
        return clampTempExecPageSize(Number(stored));
      } catch (err) {
        return defaultTempExecPageSize;
      }
    }

    function saveTempExecPageSizeSetting(value) {
      try {
        var size = clampTempExecPageSize(value);
        storage.setItem(tempExecPageSizeStorageKey, size);
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

    function jumpToTempExecCase(fileId, caseIndex, options) {
      var opts = options && typeof options === 'object' ? options : {};
      if (!fileId) return { ok: false, reason: 'missing_file_id' };
      var file = getTempExecFile(fileId);
      if (!file) return { ok: false, reason: 'file_not_found' };
      var idx = Math.floor(Number(caseIndex));
      if (!Number.isFinite(idx) || idx < 0) idx = 0;

      if (opts.clearFilters !== false) {
        var statusFilter = state.tempExecStatusFilter || { fileId: '', status: '' };
        if (statusFilter.fileId === fileId && statusFilter.status) {
          state.tempExecStatusFilter = { fileId: '', status: '' };
        }
        var searchState = state.tempExecSearch || { fileId: '', term: '', raw: '' };
        if (searchState.fileId === fileId && (searchState.term || searchState.raw)) {
          state.tempExecSearch = { fileId: '', term: '', raw: '' };
        }
      }

      if (!state.tempExecPages || typeof state.tempExecPages !== 'object') state.tempExecPages = {};
      var size = getTempExecPageSize();
      if (!Number.isFinite(size) || size <= 0) size = defaultTempExecPageSize;
      var totalCases = Array.isArray(file.cases) ? file.cases.length : 0;
      var totalPages = totalCases ? Math.ceil(totalCases / size) : 1;
      var pageIndex = totalCases ? Math.floor(idx / size) : 0;
      if (!Number.isFinite(pageIndex) || pageIndex < 0) pageIndex = 0;
      if (pageIndex >= totalPages) pageIndex = Math.max(totalPages - 1, 0);
      state.tempExecPages[fileId] = pageIndex;

      setTempExecActive(fileId);
      return { ok: true, fileId: fileId, index: idx, pageIndex: pageIndex, pageSize: size };
    }

    function applyTempExecPageSize(value) {
      var size = clampTempExecPageSize(value);
      var changed = state.tempExecPageSize !== size;
      state.tempExecPageSize = size;
      // Keep settings in sync so cross-device persistence works even when page size
      // is changed from the execution view.
      if (state.settings && typeof state.settings === 'object') {
        state.settings.tempExecPageSize = size;
        try {
          // 仅持久化分页设置，避免覆盖其他设备的设置项。
          persistSettings(['tempExecPageSize']);
        } catch (err) {
          // ignore persistence failures here; UI layer will show status if needed
        }
      }
      saveTempExecPageSizeSetting(size);
      resetTempExecPages();
      if (changed) {
        renderTempExecView();
        scheduleTempExecUiSave();
      }
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

    function buildTempExecCasesFromXmindPaths(paths) {
      var map = new Map();
      var hasResult = false;
      var reuseFound = false;
      if (!Array.isArray(paths) || !paths.length) return { cases: [], hasResult: false, reuseEnabled: false };
      paths.forEach(function(path) {
        if (!Array.isArray(path)) return;
        var clean = path.filter(Boolean);
        if (clean.length < 7) return;
        var trimmed = clean.slice(0);
        if (trimmed.length > 0) trimmed = trimmed.slice(1);
        if (trimmed.length < 6) trimmed = clean.slice(clean.length - 6);
        if (!trimmed || trimmed.length < 6) return;
        var base = trimmed.slice(0, 6);
        var extras = trimmed.slice(6);
        var key = base.join('||');
        if (!map.has(key)) {
          map.set(key, {
            module: base[0] || '',
            title: base[1] || '',
            priority: base[2] || '',
            preconditions: base[3] || '',
            steps: base[4] || '',
            expected: base[5] || '',
            actual: '',
            remark: '',
            reuseDetails: [],
            defectLinks: [],
          });
        }
        var entry = map.get(key);
        if (extras && extras.length) {
          hasResult = true;
          if (extras.length > 1) {
            reuseFound = true;
            entry.reuseDetails = entry.reuseDetails || [];
            entry.reuseDetails.push({
              id: generateReuseDetailId(),
              text: extras[0] || '',
              note: extras.length > 2 ? extras.slice(2).join('；') : '',
              status: extras[1] || '未执行',
              presetId: '',
            });
          } else if (!entry.reuseDetails || !entry.reuseDetails.length) {
            entry.actual = extras[0] || entry.actual || '';
          }
        }
      });
      return {
        cases: Array.from(map.values()),
        hasResult: hasResult,
        reuseEnabled: reuseFound,
      };
    }

    function createTempVersion(name) {
      ensureTempVersionList();
      var trimmed = (name || '').trim();
      if (!trimmed) return null;
      if (isVersionNameDuplicate(trimmed)) {
        if (tempExecStatus) setStatus(tempExecStatus, '版本名称【' + trimmed + '】已存在，请换一个', 'warn');
        browser.alert('版本名称【' + trimmed + '】已存在，请换一个');
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
      persistTempExecState();
      renderTempExecNav();
      renderTempVersionGrid();
      renderTempExecView();
    }

    function removeTempVersion(versionId) {
      if (!versionId) return;
      var version = getTempVersion(versionId);
      if (!version) return;
      var confirmed = browser.confirm('确定删除版本【' + (version.name || '') + '】？版本内的用例会回到需求盒子区。');
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
      var nextName = browser.prompt('请输入新的版本名称', version.name || '');
      if (nextName === null) return;
      var trimmed = (nextName || '').trim();
      if (!trimmed) {
        if (tempExecStatus) setStatus(tempExecStatus, '版本名称不能为空', 'warn');
        return;
      }
      if (isVersionNameDuplicate(trimmed, versionId)) {
        if (tempExecStatus) setStatus(tempExecStatus, '版本名称【' + trimmed + '】已存在，请换一个', 'warn');
        browser.alert('版本名称【' + trimmed + '】已存在，请换一个');
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

    return {
      ensureTempExecPlacement: ensureTempExecPlacement,
      resolveProjectName: resolveProjectName,
      resolveVersionName: resolveVersionName,
      updateTempExecFileCountBadge: updateTempExecFileCountBadge,
      ensureProjectOrder: ensureProjectOrder,
      ensureProjectVersionOrder: ensureProjectVersionOrder,
      ensureProjectVersionFileOrder: ensureProjectVersionFileOrder,
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
      jumpToTempExecCase: jumpToTempExecCase,
      applyTempExecPageSize: applyTempExecPageSize,
      ensureTempVersionList: ensureTempVersionList,
      getTempVersion: getTempVersion,
      applyVersionAssignments: applyVersionAssignments,
      isVersionNameDuplicate: isVersionNameDuplicate,
      buildTempExecCasesFromXmindPaths: buildTempExecCasesFromXmindPaths,
      createTempVersion: createTempVersion,
      removeTempExecFromVersion: removeTempExecFromVersion,
      removeTempGroupFromVersion: removeTempGroupFromVersion,
      moveTempExecToVersion: moveTempExecToVersion,
      getVersionRequirementBlocks: getVersionRequirementBlocks,
      moveTempExecFileWithinVersion: moveTempExecFileWithinVersion,
      parseReqPayload: parseReqPayload,
      reorderVersionRequirement: reorderVersionRequirement,
      moveRequirementToVersion: moveRequirementToVersion,
      moveRequirementOutOfVersion: moveRequirementOutOfVersion,
      removeTempVersion: removeTempVersion,
      reorderTempVersion: reorderTempVersion,
      renameTempVersion: renameTempVersion,
      getTempVersionName: getTempVersionName,
    };
  }

  return { create: create };
});

