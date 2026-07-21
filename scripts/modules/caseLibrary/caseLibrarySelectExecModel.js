(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.selectExecModel = api;
  }
})(function() {
  function normalizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\r\n/g, '\n').trim();
  }

  function positiveInteger(value) {
    var number = Number(value);
    if (!isFinite(number) || number <= 0 || Math.floor(number) !== number) return null;
    return number;
  }

  function optionalId(value) {
    if (value === null || value === undefined || value === '') return null;
    return positiveInteger(value);
  }

  function requireId(value, message) {
    var id = positiveInteger(value);
    if (!id) throw new Error(message);
    return id;
  }

  function buildRowKey(record) {
    var fileId = requireId(record && record.id, 'case file id is required');
    return 'case-library-select:' + fileId;
  }

  function normalizeSelectionIds(values) {
    var seen = Object.create(null);
    var result = [];
    (Array.isArray(values) ? values : []).forEach(function(value) {
      var id = positiveInteger(value);
      if (!id || seen[String(id)]) return;
      seen[String(id)] = true;
      result.push(id);
    });
    return result;
  }

  function associationCount(file) {
    var count = Number(file && file.association_count);
    if (!isFinite(count) || count <= 0) return 0;
    return Math.floor(count);
  }

  function syncAssociationSwitchMap(files, currentMap) {
    var source = currentMap && typeof currentMap === 'object' ? currentMap : {};
    var result = {};
    (Array.isArray(files) ? files : []).forEach(function(file) {
      var id = positiveInteger(file && file.id);
      if (!id) return;
      var key = String(id);
      var count = associationCount(file);
      result[key] = count > 0
        ? (Object.prototype.hasOwnProperty.call(source, key) ? source[key] === true : true)
        : false;
    });
    return result;
  }

  function normalizeExecByFileId(rows) {
    var result = {};
    (Array.isArray(rows) ? rows : []).forEach(function(row) {
      var id = positiveInteger(row && row.case_file_id);
      if (!id) return;
      result[String(id)] = row;
    });
    return result;
  }

  function activeUsers(execInfo) {
    var values = execInfo && Array.isArray(execInfo.active_users) ? execInfo.active_users : [];
    var seen = Object.create(null);
    var result = [];
    values.forEach(function(value) {
      var name = normalizeText(value);
      if (!name || seen[name]) return;
      seen[name] = true;
      result.push(name);
    });
    return result;
  }

  function lookupName(map, id, fallback) {
    var key = id === null || id === undefined ? '' : String(id);
    if (map && typeof map === 'object' && Object.prototype.hasOwnProperty.call(map, key)) {
      return normalizeText(map[key]) || fallback;
    }
    return fallback;
  }

  function versionName(context, projectId, versionId) {
    var maps = context && context.versionNameByProject && typeof context.versionNameByProject === 'object'
      ? context.versionNameByProject
      : {};
    var projectMap = maps[String(projectId)] || maps[projectId] || {};
    return lookupName(projectMap, versionId, versionId ? ('版本#' + versionId) : '--');
  }

  function normalizeRecords(files, context) {
    var ctx = context && typeof context === 'object' ? context : {};
    var projectNames = ctx.projectNameById && typeof ctx.projectNameById === 'object'
      ? ctx.projectNameById
      : {};
    var execByFileId = ctx.execByFileId && typeof ctx.execByFileId === 'object'
      ? ctx.execByFileId
      : {};
    var switches = syncAssociationSwitchMap(files, ctx.associationSwitchByFileId);
    var seen = Object.create(null);
    return (Array.isArray(files) ? files : []).map(function(file) {
      var rowKey = buildRowKey(file);
      if (seen[rowKey]) throw new Error('duplicate case library select row key: ' + rowKey);
      seen[rowKey] = true;
      var fileId = positiveInteger(file.id);
      var projectId = optionalId(file.project_id) || optionalId(ctx.projectId);
      if (!projectId) throw new Error('case file project id is required');
      var fileVersionId = optionalId(file.version_id);
      var count = associationCount(file);
      return {
        rowKey: rowKey,
        id: fileId,
        projectId: projectId,
        projectName: lookupName(projectNames, projectId, '项目#' + projectId),
        versionId: fileVersionId,
        versionName: versionName(ctx, projectId, fileVersionId),
        fileName: normalizeText(file.file_name_clean || file.file_name) || ('文件#' + fileId),
        reuseEnabled: file && file.reuse_enabled === true,
        activeUsers: activeUsers(execByFileId[String(fileId)]),
        importerName: normalizeText(file && file.importer_name) || '--',
        importedAt: file && file.imported_at ? file.imported_at : null,
        updatedAt: file && file.updated_at ? file.updated_at : null,
        associationCount: count,
        associationEnabled: count > 0 && switches[String(fileId)] === true,
        selected: false,
      };
    });
  }

  function filterRecords(records, query) {
    var list = Array.isArray(records) ? records : [];
    var source = query && typeof query === 'object' ? query : {};
    var term = normalizeText(source.searchText).toLowerCase();
    if (term) {
      return list.filter(function(record) {
        return normalizeText(record && record.fileName).toLowerCase().indexOf(term) !== -1;
      });
    }
    var versionId = optionalId(source.versionId);
    if (!versionId) return list.slice();
    return list.filter(function(record) {
      return Number(record && record.versionId) === versionId;
    });
  }

  function paginate(records, requestedPageIndex, requestedPageSize) {
    var list = Array.isArray(records) ? records : [];
    var pageSize = positiveInteger(requestedPageSize) || 10;
    var totalPages = list.length ? Math.ceil(list.length / pageSize) : 1;
    var pageIndex = Number(requestedPageIndex);
    if (!isFinite(pageIndex)) pageIndex = 0;
    pageIndex = Math.max(0, Math.min(Math.floor(pageIndex), totalPages - 1));
    var start = pageIndex * pageSize;
    var end = Math.min(list.length, start + pageSize);
    return {
      records: list.slice(start, end),
      pageIndex: pageIndex,
      pageSize: pageSize,
      total: list.length,
      totalPages: totalPages,
      start: start,
      end: end,
    };
  }

  function orderSelectionByRecords(records, selectedIds) {
    var selectedMap = Object.create(null);
    normalizeSelectionIds(selectedIds).forEach(function(id) { selectedMap[String(id)] = true; });
    return (Array.isArray(records) ? records : []).reduce(function(result, record) {
      var id = positiveInteger(record && record.id);
      if (id && selectedMap[String(id)]) result.push(id);
      return result;
    }, []);
  }

  function applyCurrentPageSelection(allRecords, selectedIds, currentPageRecords, checked) {
    var pageMap = Object.create(null);
    (Array.isArray(currentPageRecords) ? currentPageRecords : []).forEach(function(record) {
      var id = positiveInteger(record && record.id);
      if (id) pageMap[String(id)] = true;
    });
    var selectedMap = Object.create(null);
    normalizeSelectionIds(selectedIds).forEach(function(id) { selectedMap[String(id)] = true; });
    Object.keys(pageMap).forEach(function(key) {
      if (checked === true) selectedMap[key] = true;
      else delete selectedMap[key];
    });
    return orderSelectionByRecords(
      allRecords,
      Object.keys(selectedMap).map(function(key) { return Number(key); })
    );
  }

  function getCurrentPageSelectionState(currentPageRecords, selectedIds) {
    var selectedMap = Object.create(null);
    normalizeSelectionIds(selectedIds).forEach(function(id) { selectedMap[String(id)] = true; });
    var ids = (Array.isArray(currentPageRecords) ? currentPageRecords : []).map(function(record) {
      return positiveInteger(record && record.id);
    }).filter(Boolean);
    var selected = ids.reduce(function(count, id) {
      return count + (selectedMap[String(id)] ? 1 : 0);
    }, 0);
    return {
      total: ids.length,
      selected: selected,
      checked: ids.length > 0 && selected === ids.length,
      indeterminate: selected > 0 && selected < ids.length,
      disabled: ids.length === 0,
    };
  }

  function resolveAssociationDecision(record, enabled) {
    var count = associationCount({ association_count: record && record.associationCount });
    if (!count) {
      count = associationCount(record);
    }
    if (!count) {
      return { associationEnabled: false, requiresConfirmation: false };
    }
    var associationEnabled = enabled === undefined
      ? record && record.associationEnabled === true
      : enabled === true;
    return {
      associationEnabled: associationEnabled,
      requiresConfirmation: !associationEnabled,
    };
  }

  return {
    normalizeText: normalizeText,
    normalizeSelectionIds: normalizeSelectionIds,
    buildRowKey: buildRowKey,
    normalizeExecByFileId: normalizeExecByFileId,
    syncAssociationSwitchMap: syncAssociationSwitchMap,
    normalizeRecords: normalizeRecords,
    filterRecords: filterRecords,
    paginate: paginate,
    orderSelectionByRecords: orderSelectionByRecords,
    applyCurrentPageSelection: applyCurrentPageSelection,
    getCurrentPageSelectionState: getCurrentPageSelectionState,
    resolveAssociationDecision: resolveAssociationDecision,
  };
});
