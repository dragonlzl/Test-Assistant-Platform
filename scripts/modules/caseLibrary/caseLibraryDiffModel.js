(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.diffModel = api;
  }
})(function() {
  function normalizeDiffText(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\r\n/g, '\n').trim();
  }

  function buildCaseItemKey(item) {
    if (!item) return '';
    var moduleName = normalizeDiffText(item.module || item.module_name || '').toLowerCase();
    var title = normalizeDiffText(item.title || '').toLowerCase();
    var precondition = normalizeDiffText(item.precondition || item.preconditions || '').toLowerCase();
    var steps = normalizeDiffText(item.steps || '').toLowerCase();
    var expected = normalizeDiffText(item.expected || '').toLowerCase();
    return [moduleName, title, precondition, steps, expected].join('::');
  }

  function dedupeCaseItemsByKey(list) {
    var items = Array.isArray(list) ? list : [];
    var seen = {};
    var output = [];
    items.forEach(function(item) {
      var key = buildCaseItemKey(item);
      if (!key || seen[key]) return;
      seen[key] = true;
      output.push(item);
    });
    return output;
  }

  function compareCaseItemFields(left, right) {
    var diff = {
      priority: false,
      precondition: false,
      steps: false,
    };
    if (!left || !right) return diff;
    diff.priority = normalizeDiffText(left.priority || '') !== normalizeDiffText(right.priority || '');
    diff.precondition = normalizeDiffText(left.precondition || left.preconditions || '') !==
      normalizeDiffText(right.precondition || right.preconditions || '');
    diff.steps = normalizeDiffText(left.steps || '') !== normalizeDiffText(right.steps || '');
    return diff;
  }

  function compareCaseItemFieldsForAppendOverwrite(left, right) {
    var diff = {
      priority: false,
      precondition: false,
      steps: false,
      expected: false,
      remark: false,
    };
    if (!left || !right) return diff;
    diff.priority = normalizeDiffText(left.priority || '') !== normalizeDiffText(right.priority || '');
    diff.precondition = normalizeDiffText(left.precondition || left.preconditions || '') !==
      normalizeDiffText(right.precondition || right.preconditions || '');
    diff.steps = normalizeDiffText(left.steps || '') !== normalizeDiffText(right.steps || '');
    diff.expected = normalizeDiffText(left.expected || '') !== normalizeDiffText(right.expected || '');
    diff.remark = normalizeDiffText(left.remark || '') !== normalizeDiffText(right.remark || '');
    return diff;
  }

  function buildFirstItemMap(items) {
    var map = {};
    var list = Array.isArray(items) ? items : [];
    list.forEach(function(item) {
      var key = buildCaseItemKey(item);
      if (!key || map[key]) return;
      map[key] = item;
    });
    return map;
  }

  function sortedUnionKeys(leftMap, rightMap) {
    var keys = {};
    Object.keys(leftMap).forEach(function(key) { keys[key] = true; });
    Object.keys(rightMap).forEach(function(key) { keys[key] = true; });
    return Object.keys(keys).sort(function(left, right) {
      if (left < right) return -1;
      if (left > right) return 1;
      return 0;
    });
  }

  function buildImportDiffRows(importItems, dbItems) {
    var leftMap = buildFirstItemMap(dedupeCaseItemsByKey(importItems));
    var rightMap = buildFirstItemMap(dedupeCaseItemsByKey(dbItems));
    return sortedUnionKeys(leftMap, rightMap).map(function(key) {
      var left = leftMap[key] || null;
      var right = rightMap[key] || null;
      var fieldDiff = compareCaseItemFields(left, right);
      var changed = Boolean(fieldDiff.priority || fieldDiff.precondition || fieldDiff.steps);
      var type = '';
      if (left && !right) type = 'added';
      else if (!left && right) type = 'removed';
      else if (left && right && changed) type = 'changed';
      else type = 'same';
      return {
        key: key,
        left: left,
        right: right,
        type: type,
        diff: fieldDiff,
      };
    });
  }

  function buildAppendOverwriteDiffRows(appendItems, dbItems) {
    var leftMap = buildFirstItemMap(appendItems);
    var rightMap = buildFirstItemMap(dbItems);
    return sortedUnionKeys(leftMap, rightMap).map(function(key) {
      var left = leftMap[key] || null;
      var right = rightMap[key] || null;
      var fieldDiff = compareCaseItemFieldsForAppendOverwrite(left, right);
      var changed = Boolean(
        fieldDiff.priority ||
        fieldDiff.precondition ||
        fieldDiff.steps ||
        fieldDiff.expected ||
        fieldDiff.remark
      );
      var type = '';
      if (left && !right) type = 'added';
      else if (left && right && changed) type = 'changed';
      else type = 'same';
      return {
        key: key,
        left: left,
        right: right,
        type: type,
        diff: fieldDiff,
      };
    });
  }

  function countUniqueCaseItemsByKey(list) {
    var items = Array.isArray(list) ? list : [];
    var seen = {};
    items.forEach(function(item) {
      var key = buildCaseItemKey(item);
      if (!key || seen[key]) return;
      seen[key] = true;
    });
    return Object.keys(seen).length;
  }

  return {
    normalizeDiffText: normalizeDiffText,
    buildCaseItemKey: buildCaseItemKey,
    dedupeCaseItemsByKey: dedupeCaseItemsByKey,
    compareCaseItemFields: compareCaseItemFields,
    compareCaseItemFieldsForAppendOverwrite: compareCaseItemFieldsForAppendOverwrite,
    buildImportDiffRows: buildImportDiffRows,
    buildAppendOverwriteDiffRows: buildAppendOverwriteDiffRows,
    countUniqueCaseItemsByKey: countUniqueCaseItemsByKey,
  };
});
