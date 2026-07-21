(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.tempExecImportDuplicate = window.app.tempExecImportDuplicate || {};
    window.app.tempExecImportDuplicate.model = api;
  }
})(function() {
  function text(value) {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  function normalizeDefects(value) {
    var list = Array.isArray(value) ? value : [];
    return list.map(function(defect) {
      if (!defect) return '';
      if (typeof defect === 'string') return defect;
      if (defect.url) return text(defect.url);
      if (defect.value) return text(defect.value);
      return '';
    }).filter(Boolean).join('\n');
  }

  function normalizeLine(value, fallback) {
    var line = Number(value);
    if (!isFinite(line) || line <= 0) line = fallback;
    return Math.floor(line);
  }

  function buildRowKey(entry, index) {
    var source = entry && typeof entry === 'object' ? entry : {};
    var line = normalizeLine(source.line, index + 1);
    return 'temp-exec-import-duplicate:' + line + ':' + (source.keep === true ? 'keep' : 'remove');
  }

  function normalizeRecord(entry, index) {
    var source = entry && typeof entry === 'object' ? entry : {};
    var payload = source.payload && typeof source.payload === 'object' ? source.payload : {};
    var execution = source.source && typeof source.source === 'object' ? source.source : {};
    var line = normalizeLine(source.line, index + 1);
    var keep = source.keep === true;
    return {
      rowKey: buildRowKey(source, index),
      line: line,
      module: text(payload.module),
      title: text(payload.title),
      priority: text(payload.priority),
      precondition: text(payload.precondition),
      steps: text(payload.steps),
      expected: text(payload.expected),
      actual: text(execution.actual || execution.actual_result),
      remark: text(execution.remark || payload.remark),
      defects: normalizeDefects(execution.defectLinks || execution.defect_links),
      actionText: keep ? '保留' : '移除',
      keep: keep,
      source: source,
    };
  }

  function normalizeRecords(entries) {
    var seen = Object.create(null);
    return (Array.isArray(entries) ? entries : []).map(function(entry, index) {
      var record = normalizeRecord(entry, index);
      if (seen[record.rowKey]) {
        throw new Error('Temp exec duplicate stable row key is duplicate: ' + record.rowKey);
      }
      seen[record.rowKey] = true;
      return record;
    });
  }

  return {
    text: text,
    normalizeDefects: normalizeDefects,
    normalizeLine: normalizeLine,
    buildRowKey: buildRowKey,
    normalizeRecord: normalizeRecord,
    normalizeRecords: normalizeRecords,
  };
});
