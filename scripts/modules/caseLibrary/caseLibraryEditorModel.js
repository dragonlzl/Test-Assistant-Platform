(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.editorModel = api;
  }
})(function() {
  var searchableFields = [
    'module',
    'title',
    'priority',
    'precondition',
    'steps',
    'expected',
    'remark',
  ];

  function text(value) {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  function normalizedIndex(value) {
    var number = Number(value);
    if (!isFinite(number) || number < 0 || Math.floor(number) !== number) return null;
    return number;
  }

  function normalizeIndexes(values) {
    var seen = Object.create(null);
    return (Array.isArray(values) ? values : []).reduce(function(result, value) {
      var index = normalizedIndex(value);
      if (index === null || seen[String(index)]) return result;
      seen[String(index)] = true;
      result.push(index);
      return result;
    }, []).sort(function(a, b) { return a - b; });
  }

  function stableRowKey(caseFileId, item) {
    var fileKey = text(caseFileId).trim();
    if (!fileKey) throw new Error('Case library editor stable row key requires a case file id');
    if (item && item.id !== null && item.id !== undefined && text(item.id).trim()) {
      return 'case-library-editor:' + fileKey + ':item:' + text(item.id).trim();
    }
    var localId = item && item.__localId !== null && item.__localId !== undefined
      ? text(item.__localId).trim()
      : '';
    if (!localId && item && item.__uiKey !== null && item.__uiKey !== undefined) {
      localId = text(item.__uiKey).trim();
    }
    if (!localId) throw new Error('Case library editor stable row key is missing');
    return 'case-library-editor:' + fileKey + ':local:' + localId;
  }

  function normalizeRecords(items, context) {
    var source = context && typeof context === 'object' ? context : {};
    var selection = Object.create(null);
    normalizeIndexes(source.selectedIndexes).forEach(function(index) {
      selection[String(index)] = true;
    });
    var normalizeDisplay = typeof source.normalizeDisplay === 'function'
      ? source.normalizeDisplay
      : text;
    var isNewAdded = typeof source.isNewAdded === 'function'
      ? source.isNewAdded
      : function() { return false; };
    var locatedIndex = normalizedIndex(source.locatedIndex);
    return (Array.isArray(items) ? items : []).map(function(item, index) {
      var record = {
        rowKey: stableRowKey(source.caseFileId, item),
        sourceIndex: index,
        item: item || {},
        number: index + 1,
        selected: selection[String(index)] === true,
        isNewAdded: isNewAdded(item, index) === true,
        isLocated: locatedIndex !== null && locatedIndex === index,
      };
      searchableFields.forEach(function(field) {
        record[field] = text(normalizeDisplay(item && item[field], field, item, index));
      });
      return record;
    });
  }

  function normalizeSearch(value) {
    return text(value).trim().toLowerCase();
  }

  function filterRecords(records, searchText) {
    var term = normalizeSearch(searchText);
    var list = Array.isArray(records) ? records : [];
    if (!term) return list.slice();
    return list.filter(function(record) {
      var haystack = searchableFields.map(function(field) {
        return text(record && record[field]).toLowerCase();
      }).join(' ');
      return haystack.indexOf(term) !== -1;
    });
  }

  function paginate(records, pageIndex, pageSize) {
    var list = Array.isArray(records) ? records : [];
    var size = Number(pageSize);
    if (!isFinite(size) || size <= 0) size = 20;
    size = Math.max(1, Math.floor(size));
    var total = list.length;
    var totalPages = total ? Math.ceil(total / size) : 1;
    var index = Number(pageIndex);
    if (!isFinite(index)) index = 0;
    index = Math.max(0, Math.min(Math.floor(index), totalPages - 1));
    var start = index * size;
    var end = Math.min(total, start + size);
    return {
      records: list.slice(start, end),
      total: total,
      pageIndex: index,
      pageSize: size,
      totalPages: totalPages,
      start: start,
      end: end,
    };
  }

  function pruneSelection(records, selectedIndexes) {
    var available = Object.create(null);
    (Array.isArray(records) ? records : []).forEach(function(record) {
      var index = normalizedIndex(record && record.sourceIndex);
      if (index !== null) available[String(index)] = true;
    });
    return normalizeIndexes(selectedIndexes).filter(function(index) {
      return available[String(index)] === true;
    });
  }

  function applyPageSelection(selectedIndexes, pageRecords, checked) {
    var selected = Object.create(null);
    normalizeIndexes(selectedIndexes).forEach(function(index) {
      selected[String(index)] = true;
    });
    (Array.isArray(pageRecords) ? pageRecords : []).forEach(function(record) {
      var index = normalizedIndex(record && record.sourceIndex);
      if (index === null) return;
      if (checked === true) selected[String(index)] = true;
      else delete selected[String(index)];
    });
    return Object.keys(selected).map(Number).sort(function(a, b) { return a - b; });
  }

  function pageSelectionState(pageRecords, selectedIndexes) {
    var page = Array.isArray(pageRecords) ? pageRecords : [];
    var selected = Object.create(null);
    normalizeIndexes(selectedIndexes).forEach(function(index) {
      selected[String(index)] = true;
    });
    var count = page.reduce(function(total, record) {
      return total + (selected[String(record && record.sourceIndex)] === true ? 1 : 0);
    }, 0);
    return {
      checked: page.length > 0 && count === page.length,
      indeterminate: count > 0 && count < page.length,
      disabled: page.length === 0,
      selectedCount: count,
    };
  }

  return {
    searchableFields: searchableFields.slice(),
    text: text,
    stableRowKey: stableRowKey,
    normalizeIndexes: normalizeIndexes,
    normalizeRecords: normalizeRecords,
    normalizeSearch: normalizeSearch,
    filterRecords: filterRecords,
    paginate: paginate,
    pruneSelection: pruneSelection,
    applyPageSelection: applyPageSelection,
    pageSelectionState: pageSelectionState,
  };
});
