(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.tempExecImportDiffModel = api;
  }
})(function() {
  function normalizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\r\n/g, '\n').trim();
  }

  function normalizeKeyText(value) {
    return normalizeText(value).toLowerCase();
  }

  function buildCaseKey(moduleName, title, expected) {
    return normalizeKeyText(moduleName) + '::' + normalizeKeyText(title) + '::' + normalizeKeyText(expected);
  }

  function joinDefectLinks(list) {
    var links = Array.isArray(list) ? list : [];
    var output = [];
    links.forEach(function(link) {
      if (!link) return;
      var url = link.url !== undefined && link.url !== null ? String(link.url).trim() : '';
      if (url) output.push(url);
    });
    return output.join('\n');
  }

  function detectExecCasesHasResult(execCases, reuseEnabled) {
    var rows = Array.isArray(execCases) ? execCases : [];
    if (!rows.length) return false;
    if (reuseEnabled) {
      return rows.some(function(row) {
        var details = row && Array.isArray(row.reuse_details) ? row.reuse_details : [];
        return details.some(function(detail) {
          var status = detail && detail.status ? String(detail.status) : '未执行';
          var note = detail && detail.note ? String(detail.note) : '';
          return (status && status !== '未执行') || (note && note.trim());
        });
      });
    }
    return rows.some(function(row) {
      var status = row && row.status ? String(row.status) : '未执行';
      var remark = row && row.remark ? String(row.remark) : '';
      var defects = row && Array.isArray(row.defect_links) ? row.defect_links : [];
      return (status && status !== '未执行') || (remark && remark.trim()) || defects.length;
    });
  }

  function buildExecCaseMapByItemId(execCases) {
    var map = {};
    (Array.isArray(execCases) ? execCases : []).forEach(function(row) {
      if (!row) return;
      var id = row.case_item_id || row.caseItemId || null;
      if (id) map[String(id)] = row;
    });
    return map;
  }

  function buildImportExecCaseMapByKey(execCases) {
    var map = {};
    (Array.isArray(execCases) ? execCases : []).forEach(function(row) {
      if (!row) return;
      var key = buildCaseKey(row.module, row.title, row.expected);
      if (key) map[key] = row;
    });
    return map;
  }

  function flattenRows(items, execCaseMap, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var reuseEnabled = opts.reuseEnabled === true;
    var includeResult = opts.includeResult === true;
    var output = [];
    var reuseIndexByParent = {};
    (Array.isArray(items) ? items : []).forEach(function(item) {
      if (!item) return;
      var moduleName = item.module || '';
      var title = item.title || '';
      var expected = item.expected || '';
      var parentKey = buildCaseKey(moduleName, title, expected);
      var execRow = null;
      if (opts.matchBy === 'itemId') {
        var caseItemId = item.id || item.case_item_id || item.caseItemId || null;
        if (caseItemId !== null && caseItemId !== undefined) {
          execRow = execCaseMap ? execCaseMap[String(caseItemId)] : null;
        }
      } else {
        execRow = execCaseMap ? execCaseMap[parentKey] : null;
      }
      var status = execRow && execRow.status ? String(execRow.status) : '未执行';
      var remark = execRow && execRow.remark ? String(execRow.remark) : '';
      var defectLinks = execRow && Array.isArray(execRow.defect_links) ? execRow.defect_links : [];
      var reuseDetails = execRow && Array.isArray(execRow.reuse_details) ? execRow.reuse_details : [];
      output.push({
        key: 'main::' + parentKey,
        module: moduleName,
        title: title,
        priority: item.priority || '',
        preconditions: item.precondition || item.preconditions || '',
        steps: item.steps || '',
        expected: expected,
        actual: includeResult ? status : '',
        remark: includeResult ? remark : '',
        defect: includeResult ? joinDefectLinks(defectLinks) : '',
        reuseDetails: reuseEnabled ? reuseDetails : [],
        parentKey: parentKey,
        kind: 'main',
      });
      if (!reuseEnabled || !reuseDetails.length) return;
      if (!reuseIndexByParent[parentKey]) reuseIndexByParent[parentKey] = 0;
      reuseDetails.forEach(function(detail) {
        reuseIndexByParent[parentKey] += 1;
        var index = reuseIndexByParent[parentKey];
        var text = detail && detail.text ? String(detail.text) : '';
        output.push({
          key: 'reuse::' + parentKey + '::' + normalizeKeyText(text) + '::' + index,
          module: '',
          title: '',
          priority: '',
          preconditions: '',
          steps: '',
          expected: text,
          actual: includeResult && detail && detail.status ? String(detail.status) : (includeResult ? '未执行' : ''),
          remark: includeResult && detail && detail.note ? String(detail.note) : '',
          defect: '',
          reuseDetails: [],
          parentKey: parentKey,
          kind: 'reuse',
        });
      });
    });
    return output;
  }

  function compareFields(left, right, includeResult) {
    var diff = {
      module: false,
      title: false,
      priority: false,
      preconditions: false,
      steps: false,
      expected: false,
      actual: false,
      remark: false,
      defect: false,
    };
    if (!left || !right) return diff;
    ['module', 'title', 'priority', 'preconditions', 'steps', 'expected'].forEach(function(field) {
      diff[field] = normalizeText(left[field]) !== normalizeText(right[field]);
    });
    if (includeResult) {
      ['actual', 'remark', 'defect'].forEach(function(field) {
        diff[field] = normalizeText(left[field]) !== normalizeText(right[field]);
      });
    }
    return diff;
  }

  function buildRows(leftRows, rightRows, includeResult) {
    var leftMap = {};
    var rightMap = {};
    var keys = [];
    (Array.isArray(leftRows) ? leftRows : []).forEach(function(row) {
      if (!row || !row.key) return;
      leftMap[row.key] = row;
      keys.push(row.key);
    });
    (Array.isArray(rightRows) ? rightRows : []).forEach(function(row) {
      if (!row || !row.key) return;
      rightMap[row.key] = row;
      if (!leftMap[row.key]) keys.push(row.key);
    });
    return keys.map(function(key) {
      var left = leftMap[key] || null;
      var right = rightMap[key] || null;
      var type = 'unchanged';
      var diff = null;
      if (left && !right) type = 'added';
      else if (!left && right) type = 'removed';
      else if (left && right) {
        diff = compareFields(left, right, includeResult);
        if (Object.keys(diff).some(function(field) { return diff[field]; })) type = 'changed';
      }
      return { key: key, type: type, left: left, right: right, diff: diff };
    });
  }

  function buildComparison(input) {
    var source = input && typeof input === 'object' ? input : {};
    var includeResult = source.includeResult === true;
    var importRows = flattenRows(
      source.importItems,
      buildImportExecCaseMapByKey(source.importExecCases),
      { includeResult: includeResult, reuseEnabled: source.importReuseEnabled === true, matchBy: 'key' }
    );
    var databaseRows = flattenRows(
      source.databaseItems,
      buildExecCaseMapByItemId(source.databaseExecCases),
      { includeResult: includeResult, reuseEnabled: source.databaseReuseEnabled === true, matchBy: 'itemId' }
    );
    var rows = buildRows(importRows, databaseRows, includeResult);
    var counts = { added: 0, removed: 0, changed: 0, total: 0 };
    rows.forEach(function(row) {
      if (row && Object.prototype.hasOwnProperty.call(counts, row.type)) counts[row.type] += 1;
    });
    counts.total = counts.added + counts.removed + counts.changed;
    return { importRows: importRows, databaseRows: databaseRows, rows: rows, counts: counts };
  }

  return {
    normalizeText: normalizeText,
    buildCaseKey: buildCaseKey,
    detectExecCasesHasResult: detectExecCasesHasResult,
    flattenRows: flattenRows,
    compareFields: compareFields,
    buildRows: buildRows,
    buildComparison: buildComparison,
  };
});
