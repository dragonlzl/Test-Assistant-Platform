(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.execOverview = window.app.execOverview || {};
    window.app.execOverview.execSetModel = api;
  }
})(function() {
  function normalizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function normalizeSearchText(value) {
    return normalizeText(value).toLowerCase();
  }

  function buildRowKey(record) {
    var source = record && typeof record === 'object' ? record : {};
    var id = normalizeText(source.id);
    if (!id) throw new Error('Execution case stable id is required');
    return 'exec-case:' + id;
  }

  function normalizeRecord(record) {
    var source = record && typeof record === 'object' ? record : {};
    var actualResult = normalizeText(source.actual_result);
    if (!actualResult) actualResult = normalizeText(source.status);
    return {
      rowKey: buildRowKey(source),
      id: source.id,
      module: normalizeText(source.module),
      title: normalizeText(source.title),
      actualResult: actualResult,
      status: normalizeText(source.status),
      expected: normalizeText(source.expected),
      remark: normalizeText(source.remark),
      updatedAt: source.updated_at || '',
    };
  }

  function normalizeRecords(records) {
    var seen = Object.create(null);
    return (Array.isArray(records) ? records : []).map(function(record) {
      var normalized = normalizeRecord(record);
      if (seen[normalized.rowKey]) {
        throw new Error('Execution case stable row key is duplicate: ' + normalized.rowKey);
      }
      seen[normalized.rowKey] = true;
      return normalized;
    });
  }

  function matchesRecord(record, searchText) {
    var term = normalizeSearchText(searchText);
    if (!term) return true;
    var fields = ['module', 'title', 'actualResult', 'expected', 'remark'];
    return fields.some(function(field) {
      return normalizeSearchText(record && record[field]).indexOf(term) !== -1;
    });
  }

  function filterRecords(records, searchText) {
    var list = Array.isArray(records) ? records : [];
    var term = normalizeSearchText(searchText);
    if (!term) return list.slice();
    return list.filter(function(record) { return matchesRecord(record, term); });
  }

  function normalizePageSize(value, fallback) {
    var fallbackSize = Number(fallback);
    if (!isFinite(fallbackSize) || fallbackSize <= 0) fallbackSize = 20;
    var size = Number(value);
    if (!isFinite(size) || size <= 0) size = fallbackSize;
    if (size < 5) size = 5;
    if (size > 200) size = 200;
    return Math.floor(size);
  }

  function paginate(records, pageIndex, pageSize) {
    var list = Array.isArray(records) ? records : [];
    var size = normalizePageSize(pageSize, 20);
    var total = list.length;
    var totalPages = Math.max(1, Math.ceil(total / size));
    var index = Number(pageIndex);
    if (!isFinite(index)) index = 0;
    index = Math.max(0, Math.min(totalPages - 1, Math.floor(index)));
    var start = index * size;
    var end = Math.min(total, start + size);
    return {
      records: list.slice(start, end),
      pageIndex: index,
      pageSize: size,
      total: total,
      totalPages: totalPages,
      start: start,
      end: end,
    };
  }

  function buildView(records, searchText, pageIndex, pageSize) {
    var allRecords = Array.isArray(records) ? records.slice() : [];
    var filteredRecords = filterRecords(allRecords, searchText);
    return {
      allRecords: allRecords,
      filteredRecords: filteredRecords,
      page: paginate(filteredRecords, pageIndex, pageSize),
    };
  }

  return {
    normalizeText: normalizeText,
    normalizeSearchText: normalizeSearchText,
    buildRowKey: buildRowKey,
    normalizeRecord: normalizeRecord,
    normalizeRecords: normalizeRecords,
    matchesRecord: matchesRecord,
    filterRecords: filterRecords,
    normalizePageSize: normalizePageSize,
    paginate: paginate,
    buildView: buildView,
  };
});
