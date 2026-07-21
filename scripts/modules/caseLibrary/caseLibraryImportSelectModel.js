(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.importSelectModel = api;
  }
})(function() {
  function normalizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\r\n/g, '\n').trim();
  }

  function mapCaseItem(item) {
    if (!item) return null;
    return {
      module: normalizeText(item.module || ''),
      title: normalizeText(item.title || ''),
      priority: normalizeText(item.priority || ''),
      preconditions: normalizeText(item.precondition || item.preconditions || ''),
      steps: normalizeText(item.steps || ''),
      expected: normalizeText(item.expected || ''),
    };
  }

  function filterFiles(files, versionId, searchText) {
    var list = Array.isArray(files) ? files.slice() : [];
    if (versionId) {
      list = list.filter(function(file) {
        return String(file && file.version_id || '') === String(versionId || '');
      });
    }
    var term = normalizeText(searchText).toLowerCase();
    if (!term) return list;
    return list.filter(function(file) {
      var name = file && file.file_name_clean ? String(file.file_name_clean) : '';
      return name.toLowerCase().indexOf(term) !== -1;
    });
  }

  function paginate(items, requestedPageIndex, requestedPageSize) {
    var list = Array.isArray(items) ? items : [];
    var pageSize = Number(requestedPageSize);
    if (!isFinite(pageSize) || pageSize <= 0) pageSize = 20;
    pageSize = Math.floor(pageSize);
    var totalPages = list.length ? Math.ceil(list.length / pageSize) : 1;
    var pageIndex = Number(requestedPageIndex);
    if (!isFinite(pageIndex)) pageIndex = 0;
    pageIndex = Math.max(0, Math.min(Math.floor(pageIndex), totalPages - 1));
    var start = pageIndex * pageSize;
    var end = Math.min(list.length, start + pageSize);
    return {
      records: list.slice(start, end),
      total: list.length,
      pageSize: pageSize,
      totalPages: totalPages,
      pageIndex: pageIndex,
      start: start,
      end: end,
    };
  }

  function normalizeSelection(selection, visibleFiles) {
    var source = selection instanceof Set ? selection : new Set();
    var allowed = Object.create(null);
    (Array.isArray(visibleFiles) ? visibleFiles : []).forEach(function(file) {
      if (file && file.id) allowed[String(file.id)] = true;
    });
    var result = new Set();
    source.forEach(function(id) {
      var key = String(id);
      if (allowed[key]) result.add(key);
    });
    return result;
  }

  function buildSnapshot(drawerState, pageSize) {
    var drawer = drawerState && typeof drawerState === 'object' ? drawerState : {};
    var visibleFiles = filterFiles(drawer.files, drawer.versionId, drawer.searchText);
    var page = paginate(visibleFiles, drawer.pageIndex, pageSize);
    var selection = normalizeSelection(drawer.selection, visibleFiles);
    var pageSelected = page.records.reduce(function(count, file) {
      return file && file.id && selection.has(String(file.id)) ? count + 1 : count;
    }, 0);
    return {
      visibleFiles: visibleFiles,
      records: page.records,
      total: page.total,
      pageSize: page.pageSize,
      totalPages: page.totalPages,
      pageIndex: page.pageIndex,
      start: page.start,
      end: page.end,
      selection: selection,
      selectedCount: selection.size,
      pageSelectedCount: pageSelected,
      pageSelectionChecked: page.records.length > 0 && pageSelected === page.records.length,
      pageSelectionIndeterminate: pageSelected > 0 && pageSelected < page.records.length,
    };
  }

  function setPageSelection(snapshot, checked) {
    var current = snapshot && snapshot.selection instanceof Set
      ? new Set(snapshot.selection)
      : new Set();
    (snapshot && Array.isArray(snapshot.records) ? snapshot.records : []).forEach(function(file) {
      if (!file || !file.id) return;
      var key = String(file.id);
      if (checked === true) current.add(key);
      else current.delete(key);
    });
    return current;
  }

  function findFile(files, id) {
    var fileId = Number(id);
    if (!isFinite(fileId)) return null;
    return (Array.isArray(files) ? files : []).find(function(file) {
      return file && Number(file.id) === fileId;
    }) || null;
  }

  return {
    normalizeText: normalizeText,
    mapCaseItem: mapCaseItem,
    filterFiles: filterFiles,
    paginate: paginate,
    normalizeSelection: normalizeSelection,
    buildSnapshot: buildSnapshot,
    setPageSelection: setPageSelection,
    findFile: findFile,
  };
});
