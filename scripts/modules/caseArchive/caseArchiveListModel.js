(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseArchive = window.app.caseArchive || {};
    window.app.caseArchive.listModel = api;
  }
})(function() {
  function normalizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
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

  function normalizeArchiveState(value) {
    var raw = normalizeText(value).toLowerCase();
    if (!raw) return 'archived';
    if (raw === 'rerun' || raw === 'reexec' || raw === 're-run' || raw === '重执') return 'rerun';
    if (raw === 'archived' || raw === '已归') return 'archived';
    return raw;
  }

  function getArchiveState(record) {
    var source = record && typeof record === 'object' ? record : {};
    return normalizeArchiveState(
      source.archive_state || source.archiveState || source.archive_status || source.archiveStatus
    );
  }

  function buildRowKey(record) {
    var source = record && typeof record === 'object' ? record : {};
    var id = normalizeText(source.exec_set_id || source.execSetId);
    if (!id) throw new Error('Archive execution set stable id is required');
    return 'case-archive:' + id;
  }

  function normalizeRecord(record, options) {
    var source = record && typeof record === 'object' ? record : {};
    var opts = options && typeof options === 'object' ? options : {};
    var archiveState = getArchiveState(source);
    var rearchiveCount = source.rearchive_count;
    if (rearchiveCount === undefined || rearchiveCount === null || rearchiveCount === '') {
      rearchiveCount = source.rearchiveCount;
    }
    rearchiveCount = Number(rearchiveCount);
    if (!isFinite(rearchiveCount) || rearchiveCount < 0) rearchiveCount = 0;
    return {
      rowKey: buildRowKey(source),
      execSetId: source.exec_set_id !== undefined ? source.exec_set_id : source.execSetId,
      projectName: normalizeText(source.project_name || source.projectName),
      versionName: normalizeText(source.version_name || source.versionName) || '--',
      name: normalizeText(source.name),
      caseCount: Math.max(0, Number(source.case_count || source.caseCount) || 0),
      rearchiveCount: Math.floor(rearchiveCount),
      archiveState: archiveState,
      stateLabel: archiveState === 'rerun' ? '重执' : '已归',
      reuseText: source.reuse_enabled || source.reuseEnabled ? '复用' : '非复用',
      importedByName: normalizeText(source.imported_by_name || source.importedByName) || '--',
      importedAt: source.imported_at || source.importedAt || '',
      archivedByName: normalizeText(source.archived_by_name || source.archivedByName) || '--',
      archivedAt: source.archived_at || source.archivedAt || '',
      canDelete: opts.isAdmin === true,
      source: source,
    };
  }

  function normalizeRecords(records, options) {
    var seen = Object.create(null);
    return (Array.isArray(records) ? records : []).map(function(record) {
      var normalized = normalizeRecord(record, options);
      if (seen[normalized.rowKey]) {
        throw new Error('Archive execution set stable row key is duplicate: ' + normalized.rowKey);
      }
      seen[normalized.rowKey] = true;
      return normalized;
    });
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
      records: list.slice(start, end).map(function(record, offset) {
        return Object.assign({}, record, { displayIndex: start + offset + 1 });
      }),
      pageIndex: index,
      pageSize: size,
      total: total,
      totalPages: totalPages,
      start: start,
      end: end,
    };
  }

  return {
    normalizeText: normalizeText,
    normalizePageSize: normalizePageSize,
    normalizeArchiveState: normalizeArchiveState,
    getArchiveState: getArchiveState,
    buildRowKey: buildRowKey,
    normalizeRecord: normalizeRecord,
    normalizeRecords: normalizeRecords,
    paginate: paginate,
  };
});
