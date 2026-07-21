(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.historyModel = api;
  }
})(function() {
  var KIND_META = {
    append: { label: '追加', tone: 'added' },
    added: { label: '新增', tone: 'added' },
    updated: { label: '改动', tone: 'changed' },
    deleted: { label: '删除', tone: 'removed' },
    import: { label: '导入', tone: 'muted' },
    reimport: { label: '重导', tone: 'changed' },
    file_deleted: { label: '整份删除', tone: 'removed' },
    version_changed: { label: '版本变更', tone: 'changed' },
  };
  var SUMMARY_KINDS = [
    'append',
    'added',
    'updated',
    'deleted',
    'import',
    'reimport',
    'file_deleted',
    'version_changed',
  ];
  var SNAPSHOT_FIELDS = ['module', 'title', 'precondition', 'steps', 'expected'];
  var FILE_EVENT_KINDS = {
    append: true,
    import: true,
    reimport: true,
    file_deleted: true,
  };

  function normalizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\r\n/g, '\n').trim();
  }

  function normalizeKind(value) {
    return normalizeText(value).toLowerCase();
  }

  function getKindMeta(value) {
    var kind = normalizeKind(value);
    var source = KIND_META[kind];
    return {
      kind: kind,
      label: source ? source.label : (kind || '--'),
      tone: source ? source.tone : 'muted',
    };
  }

  function keyPart(value, fallback) {
    if (value === null || value === undefined || normalizeText(value) === '') return fallback;
    return encodeURIComponent(String(value));
  }

  function buildQueryRowKey(record) {
    var source = record && typeof record === 'object' ? record : {};
    var project = keyPart(source.project_id, 'none');
    var version = keyPart(source.version_id, 'none');
    if (source.case_file_id !== null && source.case_file_id !== undefined &&
      normalizeText(source.case_file_id) !== '') {
      return 'history-file:' + project + ':' + version + ':id:' + keyPart(source.case_file_id, 'none');
    }
    var name = normalizeText(source.file_name_clean);
    if (!name) throw new Error('History query file name is required when case_file_id is missing');
    return 'history-file:' + project + ':' + version + ':name:' + encodeURIComponent(name);
  }

  function buildDetailRowKey(record) {
    var source = record && typeof record === 'object' ? record : {};
    if (source.id === null || source.id === undefined || normalizeText(source.id) === '') {
      throw new Error('History detail id is required');
    }
    return 'history-event:' + encodeURIComponent(String(source.id));
  }

  function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (!value || typeof value !== 'object') return value;
    var output = {};
    Object.keys(value).forEach(function(key) {
      output[key] = cloneValue(value[key]);
    });
    return output;
  }

  function normalizeQueryRecord(record) {
    var source = record && typeof record === 'object' ? record : {};
    var lastOperator = normalizeText(source.last_operator);
    var updatedBy = normalizeText(source.last_updated_by_name) || lastOperator;
    return {
      rowKey: buildQueryRowKey(source),
      projectId: source.project_id,
      versionId: source.version_id,
      caseFileId: source.case_file_id,
      fileNameClean: normalizeText(source.file_name_clean),
      isDeleted: source.is_deleted === true,
      lastChangedAt: source.last_changed_at,
      lastOperator: lastOperator,
      importerName: normalizeText(source.importer_name),
      importedAt: source.imported_at,
      updatedBy: updatedBy,
      updatedAt: source.updated_at,
      totalEvents: Number(source.total_events) || 0,
    };
  }

  function normalizeQueryRecords(records) {
    return (Array.isArray(records) ? records : []).map(normalizeQueryRecord);
  }

  function snapshotValue(snapshot, field) {
    if (!snapshot || typeof snapshot !== 'object') return '';
    if (field === 'module') return normalizeText(snapshot.module || snapshot.module_name);
    if (field === 'precondition') {
      return normalizeText(snapshot.precondition || snapshot.preconditions);
    }
    return normalizeText(snapshot[field]);
  }

  function buildSnapshotCell(oldSnapshot, newSnapshot, field, changed) {
    var oldValue = snapshotValue(oldSnapshot, field);
    var newValue = snapshotValue(newSnapshot, field);
    if (changed === true) return '旧：' + oldValue + '\n新：' + newValue;
    return newValue || oldValue;
  }

  function normalizeChangedFields(value) {
    if (!Array.isArray(value)) return [];
    return value.map(function(field) { return normalizeText(field); }).filter(function(field) {
      return field !== '';
    });
  }

  function normalizeDetailRecord(record, context) {
    var source = record && typeof record === 'object' ? record : {};
    var meta = getKindMeta(source.kind);
    var oldSnapshot = source.old && typeof source.old === 'object' ? cloneValue(source.old) : null;
    var newSnapshot = source.new && typeof source.new === 'object' ? cloneValue(source.new) : null;
    var changedFields = normalizeChangedFields(source.changed_fields);
    var changedFieldMap = {};
    changedFields.forEach(function(field) { changedFieldMap[field] = true; });
    var cells = {};
    SNAPSHOT_FIELDS.forEach(function(field) {
      if (FILE_EVENT_KINDS[meta.kind]) {
        cells[field] = field === 'title' ? meta.label : '-';
        return;
      }
      cells[field] = buildSnapshotCell(
        oldSnapshot,
        newSnapshot,
        field,
        changedFieldMap[field] === true
      );
    });
    return {
      rowKey: buildDetailRowKey(source),
      id: source.id,
      kind: meta.kind,
      kindLabel: meta.label,
      kindTone: meta.tone,
      changedAt: source.changed_at,
      operator: normalizeText(source.operator),
      fileNameClean: normalizeText(context && context.fileNameClean),
      changedFields: changedFields.slice(),
      changedFieldMap: changedFieldMap,
      oldSnapshot: oldSnapshot,
      newSnapshot: newSnapshot,
      meta: cloneValue(source.meta),
      cells: cells,
    };
  }

  function normalizeDetailRecords(records, context) {
    var seen = Object.create(null);
    return (Array.isArray(records) ? records : []).map(function(record) {
      var row = normalizeDetailRecord(record, context || {});
      if (seen[row.rowKey]) throw new Error('History detail id is duplicate: ' + String(row.id));
      seen[row.rowKey] = true;
      return row;
    });
  }

  function filterQueryRecords(records, searchText) {
    var list = Array.isArray(records) ? records : [];
    var query = normalizeText(searchText).toLowerCase();
    if (!query) return list.slice();
    return list.filter(function(record) {
      return normalizeText(record && record.fileNameClean).toLowerCase().indexOf(query) !== -1;
    });
  }

  function filterDetailRecords(records, filter) {
    var list = Array.isArray(records) ? records : [];
    var kind = normalizeKind(filter);
    if (!kind) return list.slice();
    return list.filter(function(record) {
      return normalizeKind(record && record.kind) === kind;
    });
  }

  function summarizeDetailRecords(records) {
    var summary = { total: 0 };
    SUMMARY_KINDS.forEach(function(kind) { summary[kind] = 0; });
    (Array.isArray(records) ? records : []).forEach(function(record) {
      var kind = normalizeKind(record && record.kind);
      if (Object.prototype.hasOwnProperty.call(summary, kind)) summary[kind] += 1;
      summary.total += 1;
    });
    var ordered = {};
    SUMMARY_KINDS.forEach(function(kind) { ordered[kind] = summary[kind]; });
    ordered.total = summary.total;
    return ordered;
  }

  function positiveInteger(value, fallback) {
    var number = Number(value);
    if (!isFinite(number) || number <= 0) return fallback;
    return Math.max(1, Math.floor(number));
  }

  function paginate(records, pageIndex, pageSize) {
    var list = Array.isArray(records) ? records : [];
    var size = positiveInteger(pageSize, 20);
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

  return {
    kinds: SUMMARY_KINDS.slice(),
    normalizeText: normalizeText,
    normalizeKind: normalizeKind,
    getKindMeta: getKindMeta,
    buildQueryRowKey: buildQueryRowKey,
    buildDetailRowKey: buildDetailRowKey,
    normalizeQueryRecord: normalizeQueryRecord,
    normalizeQueryRecords: normalizeQueryRecords,
    normalizeDetailRecord: normalizeDetailRecord,
    normalizeDetailRecords: normalizeDetailRecords,
    buildSnapshotCell: buildSnapshotCell,
    filterQueryRecords: filterQueryRecords,
    filterDetailRecords: filterDetailRecords,
    summarizeDetailRecords: summarizeDetailRecords,
    paginate: paginate,
  };
});
