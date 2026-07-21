(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.missingImportModel = api;
  }
})(function() {
  var REQUIRED_HEADERS = ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果'];

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var normalizePriorityInput = typeof opts.normalizePriorityInput === 'function'
      ? opts.normalizePriorityInput
      : function(value) { return value === null || value === undefined ? '' : String(value).trim(); };
    var normalizeDiffText = typeof opts.normalizeDiffText === 'function'
      ? opts.normalizeDiffText
      : function(value) { return value === null || value === undefined ? '' : String(value).trim(); };
    var buildCaseItemKey = typeof opts.buildCaseItemKey === 'function'
      ? opts.buildCaseItemKey
      : function() { return ''; };
    var dedupeCaseItemsByKey = typeof opts.dedupeCaseItemsByKey === 'function'
      ? opts.dedupeCaseItemsByKey
      : function(items) { return Array.isArray(items) ? items.slice() : []; };

    function normalizeText(value) {
      if (value === null || value === undefined) return '';
      return String(value).trim();
    }

    function normalizeItem(item) {
      if (!item) return null;
      return {
        module: normalizeText(item.module || ''),
        title: normalizeText(item.title || ''),
        expected: normalizeText(item.expected || ''),
        priority: normalizePriorityInput(item.priority || ''),
        precondition: normalizeText(item.precondition || item.preconditions || ''),
        steps: normalizeText(item.steps || ''),
        remark: item.remark === null || item.remark === undefined
          ? null
          : normalizeText(item.remark || ''),
      };
    }

    function validateHeaderRow(row) {
      var header = Array.isArray(row) ? row : [];
      var found = {};
      header.forEach(function(cell) {
        var text = normalizeText(cell);
        if (text) found[text] = true;
      });
      var missing = REQUIRED_HEADERS.filter(function(key) { return !found[key]; });
      return { ok: missing.length === 0, missing: missing };
    }

    function validateItems(items) {
      var invalid = [];
      (Array.isArray(items) ? items : []).forEach(function(item, index) {
        if (!item) return;
        var moduleName = normalizeText(item.module || '');
        var title = normalizeText(item.title || '');
        var expected = normalizeText(item.expected || '');
        if (!moduleName || !title || !expected) {
          invalid.push({
            index: index,
            module: !moduleName,
            title: !title,
            expected: !expected,
          });
        }
      });
      return invalid;
    }

    function buildParseSummary(results) {
      var items = [];
      var structuralErrors = [];
      var errorText = '';
      (Array.isArray(results) ? results : []).forEach(function(entry) {
        var result = entry && entry.result ? entry.result : {};
        if (result.error) {
          if (!errorText) {
            var fileName = entry && entry.file && entry.file.name ? String(entry.file.name) : '';
            errorText = fileName
              ? ('导入失败：' + fileName + ' - ' + result.error)
              : ('导入失败：' + result.error);
          }
          return;
        }
        if (Array.isArray(result.structuralErrors) && result.structuralErrors.length) {
          structuralErrors = structuralErrors.concat(result.structuralErrors);
        }
        if (Array.isArray(result.items) && result.items.length) items = items.concat(result.items);
      });

      if (errorText) {
        return {
          items: [],
          structuralErrors: [],
          invalid: [],
          statusText: errorText,
          statusType: 'err',
        };
      }

      var structuralLineMap = {};
      structuralErrors.forEach(function(entry) {
        var line = entry && typeof entry.line === 'number' ? entry.line : null;
        if (line && isFinite(line)) structuralLineMap[line] = true;
      });
      var filteredItems = structuralErrors.length
        ? items.filter(function(item) {
          var line = item && item._sourceLine ? Number(item._sourceLine) : null;
          if (!line || !isFinite(line)) return true;
          return !structuralLineMap[line];
        })
        : items;
      var normalized = dedupeCaseItemsByKey(filteredItems.map(normalizeItem).filter(Boolean));
      var invalid = validateItems(normalized);
      var statusText = '';
      var statusType = '';

      if (!normalized.length) {
        statusText = structuralErrors.length
          ? ('导入失败：字段层级不足 ' + structuralErrors.length + ' 条，未识别到可导入条目')
          : '导入失败：未识别到漏测用例条目';
        statusType = structuralErrors.length ? 'err' : 'warn';
      } else if (invalid.length) {
        statusText = '导入校验失败：请补齐模块/用例标题/预期结果（缺失 ' + invalid.length + ' 条）';
        if (structuralErrors.length) statusText += '，字段层级不足 ' + structuralErrors.length + ' 条';
        statusType = 'warn';
      } else if (structuralErrors.length) {
        statusText = '已识别 ' + normalized.length + ' 条漏测用例，字段层级不足 ' + structuralErrors.length + ' 条';
        statusType = 'warn';
      } else {
        statusText = '已识别 ' + normalized.length + ' 条漏测用例';
        statusType = 'ok';
      }

      return {
        items: normalized,
        structuralErrors: structuralErrors,
        invalid: invalid,
        statusText: statusText,
        statusType: statusType,
      };
    }

    function normalizeModuleKey(name) {
      return normalizeDiffText(name || '').toLowerCase();
    }

    function buildGroups(items) {
      var groupsByKey = {};
      (Array.isArray(items) ? items : []).forEach(function(item) {
        if (!item) return;
        var moduleName = normalizeText(item.module || '');
        if (!moduleName) return;
        var key = normalizeModuleKey(moduleName);
        if (!groupsByKey[key]) groupsByKey[key] = { key: key, moduleName: moduleName, items: [] };
        groupsByKey[key].items.push(item);
      });
      return Object.keys(groupsByKey).map(function(key) { return groupsByKey[key]; });
    }

    function buildExistingItemKeySet(items) {
      var seen = {};
      (Array.isArray(items) ? items : []).forEach(function(item) {
        var key = buildCaseItemKey(item);
        if (key) seen[key] = true;
      });
      return seen;
    }

    function formatStructuralDetail(entry) {
      var fields = REQUIRED_HEADERS.slice();
      var depth = entry && typeof entry.depth === 'number' ? entry.depth : null;
      var segments = entry && Array.isArray(entry.segments) ? entry.segments : [];
      var parts = [];
      for (var i = 0; i < segments.length && i < fields.length; i += 1) {
        var raw = segments[i];
        var text = raw === null || raw === undefined || String(raw).trim() === ''
          ? '（空）'
          : String(raw).trim();
        parts.push(fields[i] + '=' + text);
      }
      var missing = fields.slice(segments.length).join('、');
      var info = parts.length ? ('已识别：' + parts.join(' / ')) : '未识别到有效层级';
      var depthText = depth === null ? '' : ('当前 ' + depth + ' 层');
      var missingText = missing ? ('缺少：' + missing) : '';
      return ['字段层级不足', depthText, info, missingText].filter(Boolean).join('；');
    }

    function countPendingItems(entries) {
      var total = 0;
      (Array.isArray(entries) ? entries : []).forEach(function(entry) {
        if (entry && entry.items) total += entry.items.length || 0;
      });
      return total;
    }

    return {
      normalizeText: normalizeText,
      normalizeItem: normalizeItem,
      validateHeaderRow: validateHeaderRow,
      validateItems: validateItems,
      buildParseSummary: buildParseSummary,
      normalizeModuleKey: normalizeModuleKey,
      buildGroups: buildGroups,
      buildExistingItemKeySet: buildExistingItemKeySet,
      formatStructuralDetail: formatStructuralDetail,
      countPendingItems: countPendingItems,
    };
  }

  return { create: create };
});
