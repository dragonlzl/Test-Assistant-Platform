(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.importFileParser = api;
  }
})(function() {
  function toLineText(value) {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
      return value.filter(Boolean).map(function(item) { return String(item); }).join('\n');
    }
    return String(value);
  }

  function normalizeDashAsEmpty(value) {
    var text = value === null || value === undefined ? '' : String(value);
    text = text.trim();
    return text === '-' ? '' : text;
  }

  function buildItems(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function(item, index) {
      if (!item || typeof item !== 'object') return null;
      var forceKeep = item._forceKeep === true;
      var module = normalizeDashAsEmpty(item.module || item.module_name || item['模块'] || '');
      var title = normalizeDashAsEmpty(item.title || item.case_title || item['用例标题'] || '');
      var expected = normalizeDashAsEmpty(item.expected || item.result || item['预期结果'] || '');
      var priority = normalizeDashAsEmpty(item.priority || item.level || item['优先级'] || '');
      var precondition = normalizeDashAsEmpty(item.preconditions || item.precondition || item['前提条件'] || '');
      var steps = normalizeDashAsEmpty(toLineText(item.steps || item.actions || item['操作步骤'] || ''));
      var remark = normalizeDashAsEmpty(item.remark || '');
      var any = module + title + priority + precondition + steps + expected + remark;
      if (!any.trim() && !forceKeep) return null;
      var sourceLine = Number(item._sourceLine);
      if (!isFinite(sourceLine) || sourceLine <= 0) sourceLine = index + 1;
      return {
        module: module,
        title: title,
        expected: expected,
        priority: priority || '',
        precondition: precondition || '',
        steps: steps || '',
        remark: remark || null,
        _sourceLine: sourceLine,
      };
    }).filter(Boolean);
  }

  function normalizePriority(value) {
    var text = value === null || value === undefined ? '' : String(value);
    text = text.trim();
    if (!text) return '';
    var head = text.charAt(0);
    if (head === 'p' || head === 'P') return 'P' + text.slice(1);
    return text;
  }

  function sanitizeItems(items) {
    var list = Array.isArray(items) ? items : [];
    return list.map(function(item) {
      if (!item) return null;
      return {
        module: String(item.module || '').trim(),
        title: String(item.title || '').trim(),
        expected: String(item.expected || '').trim(),
        priority: item.priority === null || item.priority === undefined ? null : String(item.priority || '').trim(),
        precondition: item.precondition === null || item.precondition === undefined ? null : String(item.precondition || '').trim(),
        steps: item.steps === null || item.steps === undefined ? null : String(item.steps || '').trim(),
        remark: item.remark === null || item.remark === undefined ? null : String(item.remark || '').trim(),
      };
    }).filter(Boolean);
  }

  function validateItems(items) {
    var list = Array.isArray(items) ? items : [];
    var invalid = [];
    list.forEach(function(item, index) {
      if (!item) return;
      item.module = String(item.module === null || item.module === undefined ? '' : item.module).trim();
      item.title = String(item.title === null || item.title === undefined ? '' : item.title).trim();
      item.expected = String(item.expected === null || item.expected === undefined ? '' : item.expected).trim();
      item.priority = normalizePriority(item.priority);
      item.precondition = String(item.precondition === null || item.precondition === undefined ? '' : item.precondition).trim();
      item.steps = String(item.steps === null || item.steps === undefined ? '' : item.steps).trim();
      var error = {
        module: !item.module,
        title: !item.title,
        priority: !item.priority,
        precondition: !item.precondition,
        steps: !item.steps,
        expected: !item.expected,
      };
      if (error.module || error.title || error.priority || error.precondition || error.steps || error.expected) {
        var line = Number(item._sourceLine);
        if (!isFinite(line) || line <= 0) line = index + 1;
        invalid.push({ index: index, line: line, err: error });
      }
    });
    return invalid;
  }

  function normalizeXmindPathSegments(path, rootTitle) {
    if (!Array.isArray(path)) return [];
    var segments = path.filter(function(value) {
      return value !== null && value !== undefined;
    }).map(function(value) {
      return String(value).trim();
    });
    if (!segments.length) return [];
    var root = rootTitle === null || rootTitle === undefined ? '' : String(rootTitle).trim();
    return root && segments[0] === root ? segments.slice(1) : segments;
  }

  function buildFromXmindPaths(paths, rootTitle) {
    var list = Array.isArray(paths) ? paths : [];
    var structuralErrors = [];
    var raw = [];
    list.forEach(function(path, index) {
      var segments = normalizeXmindPathSegments(path, rootTitle);
      var line = index + 1;
      var tail = segments.slice(-6);
      var item = {
        module: tail[0] || '',
        title: tail[1] || '',
        priority: tail[2] || '',
        precondition: tail[3] || '',
        steps: tail[4] || '',
        expected: tail[5] || '',
        _sourceLine: line,
      };
      if (segments.length < 6) {
        item._forceKeep = true;
        structuralErrors.push({ line: line, depth: segments.length, segments: segments.slice() });
      }
      raw.push(item);
    });
    return { items: buildItems(raw), structuralErrors: structuralErrors };
  }

  function buildFromXlsxRows(rows) {
    var list = Array.isArray(rows) ? rows : [];
    if (!list.length) return [];
    var headerRow = list[0] || [];
    var headerIndex = {};
    var headerMap = {
      '模块': 'module',
      '用例标题': 'title',
      '优先级': 'priority',
      '前提条件': 'preconditions',
      '操作步骤': 'steps',
      '预期结果': 'expected',
    };
    headerRow.forEach(function(value, index) {
      var text = value === null || value === undefined ? '' : String(value).trim();
      if (text && headerMap[text]) headerIndex[headerMap[text]] = index;
    });
    var hasHeader = headerIndex.module !== undefined &&
      headerIndex.title !== undefined &&
      headerIndex.expected !== undefined;

    function pick(row, key, fallbackIndex) {
      var index = hasHeader && headerIndex[key] !== undefined ? headerIndex[key] : fallbackIndex;
      var value = row && row[index];
      return value === null || value === undefined ? '' : String(value);
    }

    var raw = [];
    for (var index = 1; index < list.length; index += 1) {
      var row = list[index] || [];
      var item = {
        module: pick(row, 'module', 0),
        title: pick(row, 'title', 1),
        priority: pick(row, 'priority', 2),
        preconditions: pick(row, 'preconditions', 3),
        steps: pick(row, 'steps', 4),
        expected: pick(row, 'expected', 5),
        _sourceLine: index + 1,
      };
      var any = item.module + item.title + item.priority + item.preconditions + item.steps + item.expected;
      if (any.trim()) raw.push(item);
    }
    return buildItems(raw);
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var getCore = typeof opts.getCore === 'function' ? opts.getCore : function() { return null; };
    var getXlsxCore = typeof opts.getXlsxCore === 'function' ? opts.getXlsxCore : function() { return null; };

    function deriveListFromText(text) {
      var core = getCore();
      if (core && typeof core.deriveCaseListFromText === 'function') {
        return core.deriveCaseListFromText(text || '');
      }
      try {
        var parsed = JSON.parse(String(text || '').trim() || '[]');
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.cases)) return parsed.cases;
      } catch (error) {
        return [];
      }
      return [];
    }

    function parseXlsxRows(file) {
      var core = getXlsxCore();
      if (!core || typeof core.parseXlsxFileToRows !== 'function') {
        return Promise.reject(new Error('缺少 Excel 解析能力'));
      }
      return core.parseXlsxFileToRows(file);
    }

    function parseFile(file) {
      if (!file) return Promise.resolve({ items: [] });
      var extension = (String(file.name || '').split('.').pop() || '').toLowerCase();
      var core = getCore();
      if (extension === 'xmind' && core && typeof core.parseXmindFile === 'function') {
        return core.parseXmindFile(file).then(function(result) {
          var paths = result && Array.isArray(result.paths) ? result.paths : [];
          var rootTitle = result && result.rootTitle ? String(result.rootTitle) : '';
          var mapped = buildFromXmindPaths(paths, rootTitle);
          return { items: mapped.items, structuralErrors: mapped.structuralErrors };
        });
      }
      if (extension === 'xlsx') {
        return parseXlsxRows(file).then(function(rows) {
          return { items: buildFromXlsxRows(rows || []) };
        });
      }
      return file.text().then(function(text) {
        var trimmed = String(text || '').trim();
        var list = [];
        if (extension === 'json') {
          try {
            var parsed = JSON.parse(trimmed || '[]');
            if (Array.isArray(parsed)) list = parsed;
            else if (parsed && Array.isArray(parsed.cases)) list = parsed.cases;
            else list = deriveListFromText(trimmed);
          } catch (error) {
            list = deriveListFromText(trimmed);
          }
        } else {
          list = deriveListFromText(trimmed);
        }
        return { items: buildItems(list) };
      });
    }

    return {
      parseFile: parseFile,
      parseXlsxRows: parseXlsxRows,
      buildItems: buildItems,
      buildFromXmindPaths: buildFromXmindPaths,
      buildFromXlsxRows: buildFromXlsxRows,
      normalizePriority: normalizePriority,
      sanitizeItems: sanitizeItems,
      validateItems: validateItems,
    };
  }

  return {
    create: create,
    toLineText: toLineText,
    buildItems: buildItems,
    buildFromXmindPaths: buildFromXmindPaths,
    buildFromXlsxRows: buildFromXlsxRows,
    normalizePriority: normalizePriority,
    sanitizeItems: sanitizeItems,
    validateItems: validateItems,
  };
});
