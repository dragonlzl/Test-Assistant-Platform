(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.tempExecCaseLibraryDiff = window.app.tempExecCaseLibraryDiff || {};
    window.app.tempExecCaseLibraryDiff.model = api;
  }
})(function() {
  var KINDS = {
    appended: { label: '追加', tone: 'added' },
    added: { label: '新增', tone: 'added' },
    updated: { label: '改动', tone: 'changed' },
    deleted: { label: '删除', tone: 'removed' },
  };
  var FIELDS = ['module', 'title', 'precondition', 'steps', 'expected'];

  function text(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\r\n/g, '\n').trim();
  }

  function normalizeKind(value) {
    var kind = text(value).toLowerCase();
    return KINDS[kind] ? kind : '';
  }

  function kindMeta(value) {
    var kind = normalizeKind(value);
    var source = KINDS[kind] || { label: '', tone: 'muted' };
    return { kind: kind, label: source.label, tone: source.tone };
  }

  function normalizeCaseItemId(entry) {
    if (!entry || typeof entry !== 'object') return '';
    var value = entry.case_item_id;
    if (value === null || value === undefined) value = entry.caseItemId;
    if (value === null || value === undefined) return '';
    return text(value);
  }

  function parseTimeMs(value) {
    var raw = text(value);
    if (!raw) return 0;
    var parsed = Date.parse(raw);
    return isFinite(parsed) ? parsed : 0;
  }

  function formatTime(value) {
    var raw = text(value);
    if (!raw) return '';
    var timestamp = parseTimeMs(raw);
    if (!timestamp) return raw;
    var date = new Date(timestamp);
    var pad = function(number) { return number < 10 ? '0' + number : String(number); };
    return (
      date.getFullYear() + '-' +
      pad(date.getMonth() + 1) + '-' +
      pad(date.getDate()) + ' ' +
      pad(date.getHours()) + ':' +
      pad(date.getMinutes()) + ':' +
      pad(date.getSeconds())
    );
  }

  function snapshotValue(snapshot, field) {
    if (!snapshot || typeof snapshot !== 'object') return '';
    if (field === 'module') return text(snapshot.module || snapshot.module_name);
    if (field === 'precondition') {
      return text(snapshot.precondition || snapshot.preconditions);
    }
    return text(snapshot[field]);
  }

  function buildSnapshotCell(oldSnapshot, newSnapshot, field, changed) {
    var oldValue = snapshotValue(oldSnapshot, field);
    var newValue = snapshotValue(newSnapshot, field);
    if (changed === true) return '旧：' + oldValue + '\n新：' + newValue;
    return newValue || oldValue;
  }

  function normalizeChangedFields(value) {
    if (!Array.isArray(value)) return [];
    return value.map(text).filter(Boolean);
  }

  function emptySummary() {
    return { appended: 0, added: 0, updated: 0, deleted: 0 };
  }

  function addSummary(target, source) {
    var output = target || emptySummary();
    var input = source && typeof source === 'object' ? source : {};
    Object.keys(KINDS).forEach(function(kind) {
      output[kind] += Number(input[kind]) || 0;
    });
    return output;
  }

  function summarizeSourceRows(rows) {
    var summary = emptySummary();
    (Array.isArray(rows) ? rows : []).forEach(function(row) {
      var entry = row && row.entry ? row.entry : null;
      var kind = normalizeKind(entry && entry.kind);
      if (kind) summary[kind] += 1;
    });
    return summary;
  }

  function hasNumericSummary(summary) {
    var source = summary && typeof summary === 'object' ? summary : {};
    return Object.keys(KINDS).some(function(kind) {
      return isFinite(Number(source[kind]));
    });
  }

  function historyBatches(meta) {
    var source = meta && typeof meta === 'object' ? meta : {};
    if (Array.isArray(source.history) && source.history.length) return source.history.slice();
    if (Array.isArray(source.diff) && source.diff.length) {
      return [{
        diffAt: text(source.lastDiffAt || source.last_diff_at),
        operator: text(source.operator),
        summary: source.summary || emptySummary(),
        diff: source.diff.slice(),
      }];
    }
    return [];
  }

  function flattenMeta(meta) {
    var batches = historyBatches(meta);
    var summary = emptySummary();
    var rows = [];
    batches.forEach(function(batch, batchIndex) {
      if (!batch) return;
      var diffAt = text(batch.diffAt || batch.diff_at);
      var operator = text(batch.operator);
      var entries = Array.isArray(batch.diff) ? batch.diff : [];
      if (hasNumericSummary(batch.summary)) addSummary(summary, batch.summary);
      else addSummary(summary, summarizeSourceRows(entries.map(function(entry) { return { entry: entry }; })));
      entries.forEach(function(entry, entryIndex) {
        rows.push({
          entry: entry,
          diffAt: diffAt,
          operator: operator,
          timestamp: parseTimeMs(diffAt),
          batchIndex: batchIndex,
          entryIndex: entryIndex,
        });
      });
    });
    if (!batches.length && meta && meta.summary) addSummary(summary, meta.summary);
    rows.sort(function(left, right) {
      var leftTime = Number(left && left.timestamp) || 0;
      var rightTime = Number(right && right.timestamp) || 0;
      if (leftTime !== rightTime) return rightTime - leftTime;
      var leftKind = normalizeKind(left && left.entry ? left.entry.kind : '');
      var rightKind = normalizeKind(right && right.entry ? right.entry.kind : '');
      if (leftKind !== rightKind) return String(rightKind).localeCompare(String(leftKind));
      return Number(left && left.entryIndex) - Number(right && right.entryIndex);
    });
    return { rows: rows, summary: summary };
  }

  function buildCaseItemIdMap(file) {
    if (!file || !Array.isArray(file.cases) || file._casesLoading) return null;
    var ids = Object.create(null);
    file.cases.forEach(function(item) {
      if (!item) return;
      var id = item.caseItemId;
      if (id === null || id === undefined) id = item.case_item_id;
      if (id !== null && id !== undefined) ids[String(id)] = true;
      var sourceId = item.caseItemSourceId;
      if (sourceId === null || sourceId === undefined) sourceId = item.case_item_source_id;
      if (sourceId !== null && sourceId !== undefined) ids[String(sourceId)] = true;
    });
    return ids;
  }

  function filterSourceRowsForFile(rows, file) {
    var list = Array.isArray(rows) ? rows : [];
    var currentIds = buildCaseItemIdMap(file);
    if (!currentIds) return list.slice();
    var deletedIds = Object.create(null);
    list.forEach(function(row) {
      var entry = row && row.entry ? row.entry : null;
      if (normalizeKind(entry && entry.kind) !== 'deleted') return;
      var deletedId = normalizeCaseItemId(entry);
      if (deletedId) deletedIds[deletedId] = true;
    });
    return list.filter(function(row) {
      var entry = row && row.entry ? row.entry : null;
      var kind = normalizeKind(entry && entry.kind);
      if (kind === 'deleted') return true;
      var caseItemId = normalizeCaseItemId(entry);
      if (!caseItemId || currentIds[caseItemId]) return true;
      return (kind === 'added' || kind === 'appended') && deletedIds[caseItemId] === true;
    });
  }

  function hashText(value) {
    var input = String(value || '');
    var hash = 2166136261;
    for (var index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(36);
  }

  function rowFingerprint(row) {
    var entry = row && row.entry && typeof row.entry === 'object' ? row.entry : {};
    var oldSnapshot = entry.old && typeof entry.old === 'object' ? entry.old : null;
    var newSnapshot = entry.new && typeof entry.new === 'object' ? entry.new : null;
    var values = [text(row && row.operator), normalizeChangedFields(entry.changed_fields).sort().join(',')];
    FIELDS.forEach(function(field) {
      values.push(snapshotValue(oldSnapshot, field));
      values.push(snapshotValue(newSnapshot, field));
    });
    return hashText(values.join('\u001f'));
  }

  function buildRowKey(row, context, occurrence) {
    var entry = row && row.entry ? row.entry : {};
    return [
      'temp-exec-case-library-diff',
      encodeURIComponent(text(context && context.execSetId) || 'none'),
      encodeURIComponent(text(row && row.diffAt) || 'none'),
      normalizeKind(entry.kind) || 'unknown',
      encodeURIComponent(normalizeCaseItemId(entry) || 'none'),
      rowFingerprint(row),
      String(occurrence || 1),
    ].join(':');
  }

  function normalizeRecord(row, context, occurrence) {
    var entry = row && row.entry && typeof row.entry === 'object' ? row.entry : {};
    var meta = kindMeta(entry.kind);
    var oldSnapshot = entry.old && typeof entry.old === 'object' ? entry.old : null;
    var newSnapshot = entry.new && typeof entry.new === 'object' ? entry.new : null;
    var changedFields = normalizeChangedFields(entry.changed_fields);
    var changedFieldMap = Object.create(null);
    var cells = {};
    changedFields.forEach(function(field) { changedFieldMap[field] = true; });
    FIELDS.forEach(function(field) {
      cells[field] = buildSnapshotCell(
        oldSnapshot,
        newSnapshot,
        field,
        changedFieldMap[field] === true
      );
    });
    var caseItemId = normalizeCaseItemId(entry);
    return {
      rowKey: buildRowKey(row, context, occurrence),
      kind: meta.kind,
      kindLabel: meta.label,
      kindTone: meta.tone,
      diffAt: text(row && row.diffAt),
      timeText: formatTime(row && row.diffAt),
      operator: text(row && row.operator),
      caseItemId: caseItemId,
      canLocate: Boolean(caseItemId && (meta.kind === 'appended' || meta.kind === 'added' || meta.kind === 'updated')),
      changedFields: changedFields,
      changedFieldMap: changedFieldMap,
      oldSnapshot: oldSnapshot,
      newSnapshot: newSnapshot,
      cells: cells,
      entry: entry,
    };
  }

  function normalizeRecords(rows, context) {
    var occurrences = Object.create(null);
    var seen = Object.create(null);
    return (Array.isArray(rows) ? rows : []).filter(function(row) {
      return Boolean(normalizeKind(row && row.entry ? row.entry.kind : ''));
    }).map(function(row) {
      var base = buildRowKey(row, context || {}, 1).replace(/:1$/, '');
      occurrences[base] = (occurrences[base] || 0) + 1;
      var record = normalizeRecord(row, context || {}, occurrences[base]);
      if (seen[record.rowKey]) {
        throw new Error('Temp exec case library diff stable row key is duplicate: ' + record.rowKey);
      }
      seen[record.rowKey] = true;
      return record;
    });
  }

  function summarizeRecords(records) {
    var summary = emptySummary();
    (Array.isArray(records) ? records : []).forEach(function(record) {
      var kind = normalizeKind(record && record.kind);
      if (kind) summary[kind] += 1;
    });
    return summary;
  }

  function normalizeFilter(value) {
    return normalizeKind(value);
  }

  function buildView(meta, context) {
    var source = flattenMeta(meta);
    var availableRows = filterSourceRowsForFile(source.rows, context && context.file);
    var allRecords = normalizeRecords(availableRows, context || {});
    var filter = normalizeFilter(context && context.filter);
    var visibleRecords = filter
      ? allRecords.filter(function(record) { return record.kind === filter; })
      : allRecords.slice();
    return {
      allRecords: allRecords,
      records: visibleRecords,
      summary: availableRows.length === source.rows.length
        ? source.summary
        : summarizeRecords(allRecords),
      filter: filter,
    };
  }

  return {
    text: text,
    normalizeKind: normalizeKind,
    kindMeta: kindMeta,
    normalizeCaseItemId: normalizeCaseItemId,
    parseTimeMs: parseTimeMs,
    formatTime: formatTime,
    snapshotValue: snapshotValue,
    buildSnapshotCell: buildSnapshotCell,
    emptySummary: emptySummary,
    flattenMeta: flattenMeta,
    buildCaseItemIdMap: buildCaseItemIdMap,
    filterSourceRowsForFile: filterSourceRowsForFile,
    buildRowKey: buildRowKey,
    normalizeRecord: normalizeRecord,
    normalizeRecords: normalizeRecords,
    summarizeRecords: summarizeRecords,
    normalizeFilter: normalizeFilter,
    buildView: buildView,
  };
});
