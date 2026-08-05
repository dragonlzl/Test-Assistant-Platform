(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecImportParserOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var tempExecResultOptions = Array.isArray(opts.tempExecResultOptions)
      ? opts.tempExecResultOptions
      : ['未执行', '通过', '失败', '阻塞', '不适用'];
    var generateDefectLinkId = port('generateDefectLinkId', function() { return 'defect-' + Date.now(); });
    var generateReuseDetailId = port('generateReuseDetailId', function() { return 'reuse-detail-' + Date.now(); });
    var normalizeRequirementName = port('normalizeRequirementName', function(value) { return String(value || '').trim(); });
    var deriveCaseListFromText = port('deriveCaseListFromText', function() { return []; });
    var parseXmindFile = port('parseXmindFile', function() { return Promise.resolve({ text: '', list: [] }); });
    var parseXlsxFileToRows = typeof opts.parseXlsxFileToRows === 'function' ? opts.parseXlsxFileToRows : null;
    var buildTempExecCasesFromXmindPaths = port('buildTempExecCasesFromXmindPaths', function() {
      return { cases: [], reuseEnabled: false, hasResult: false };
    });
    var isReuseDetailRemoved = port('isReuseDetailRemoved', function(detail) { return Boolean(detail && detail.removed); });
    var resolveReuseAggregateStatus = port('resolveReuseAggregateStatus', function(details) {
      var list = Array.isArray(details) ? details : [];
      var statuses = list.filter(function(detail) { return detail && !detail.removed; }).map(function(detail) {
        return detail.status || '未执行';
      });
      if (!statuses.length) return '未执行';
      if (statuses.indexOf('失败') !== -1) return '失败';
      if (statuses.indexOf('阻塞') !== -1) return '阻塞';
      if (statuses.every(function(status) { return status === '通过' || status === '不适用'; })) return '通过';
      return '未执行';
    });

    function buildCaseItemPayloadFromTempCase(item) {
      if (!item) return null;
      var moduleName = String(item.module || '').trim();
      var title = String(item.title || '').trim();
      var expected = String(item.expected || '').trim();
      if (!moduleName || !title || !expected) return null;
      return {
        module: moduleName,
        title: title,
        expected: expected,
        priority: item.priority ? String(item.priority) : null,
        precondition: item.preconditions ? String(item.preconditions) : null,
        steps: item.steps ? String(item.steps) : null,
        remark: item.remark ? String(item.remark) : null,
      };
    }

    function buildExecImportPayloadFromTempCase(item, reuseEnabled) {
      if (!item) return null;
      var base = buildCaseItemPayloadFromTempCase(item);
      if (!base) return null;
      base.status = reuseEnabled
        ? resolveReuseAggregateStatus(Array.isArray(item.reuseDetails) ? item.reuseDetails : [])
        : (item.actual ? String(item.actual) : '未执行');
      base.reuse_details = Array.isArray(item.reuseDetails) ? item.reuseDetails : [];
      base.defect_links = Array.isArray(item.defectLinks) ? item.defectLinks : [];
      return base;
    }

    function buildTempExecCasesFromXlsxRows(rows) {
      var list = Array.isArray(rows) ? rows : [];
      if (!list.length) throw new Error('Excel 解析失败：缺少数据行');
      var headerRow = list[0] || [];
      var headerIndex = {};
      var headerMap = {
        '模块': 'module',
        '用例标题': 'title',
        '优先级': 'priority',
        '前提条件': 'preconditions',
        '操作步骤': 'steps',
        '预期结果': 'expected',
        '实际结果': 'actual',
        '备注': 'remark',
        '缺陷链接': 'defect',
      };
      var headerLabelByKey = {
        module: '模块',
        title: '用例标题',
        priority: '优先级',
        preconditions: '前提条件',
        steps: '操作步骤',
        expected: '预期结果',
        actual: '实际结果',
        remark: '备注',
        defect: '缺陷链接',
      };
      for (var index = 0; index < headerRow.length; index += 1) {
        var header = headerRow[index] !== undefined && headerRow[index] !== null
          ? String(headerRow[index]).trim()
          : '';
        if (header && headerMap[header]) headerIndex[headerMap[header]] = index;
      }
      if (headerIndex.module === undefined || headerIndex.title === undefined || headerIndex.expected === undefined) {
        throw new Error('Excel 格式不对：缺少表头（模块/用例标题/预期结果）');
      }
      var hasResultHeader = headerIndex.actual !== undefined || headerIndex.remark !== undefined || headerIndex.defect !== undefined;
      if (hasResultHeader && (headerIndex.actual === undefined || headerIndex.remark === undefined || headerIndex.defect === undefined)) {
        throw new Error('结果格式不对：带结果 Excel 需包含（实际结果/备注/缺陷链接）三列');
      }

      function pick(row, key) {
        var cellIndex = headerIndex[key];
        if (!row || cellIndex === undefined) return '';
        var value = row[cellIndex];
        return value === undefined || value === null ? '' : String(value);
      }

      function isHeaderLikeRow(row) {
        if (pick(row, 'module').trim() !== headerLabelByKey.module) return false;
        if (pick(row, 'title').trim() !== headerLabelByKey.title) return false;
        if (pick(row, 'expected').trim() !== headerLabelByKey.expected) return false;
        var keys = Object.keys(headerIndex);
        for (var keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
          var key = keys[keyIndex];
          var cell = pick(row, key).trim();
          if (cell && headerLabelByKey[key] && cell !== headerLabelByKey[key]) return false;
        }
        return true;
      }

      function normalizeStatusInput(value) {
        var text = value === null || value === undefined ? '' : String(value).trim();
        if (!text || text === 'pending') return '未执行';
        return tempExecResultOptions.indexOf(text) !== -1 ? text : null;
      }

      function parseDefectLinks(value) {
        var raw = value === null || value === undefined ? '' : String(value);
        var seen = {};
        return raw.replace(/\r\n/g, '\n').split(/[\s\n,;，；]+/).map(function(item) {
          return String(item || '').trim();
        }).filter(function(url) {
          if (!url || seen[url]) return false;
          seen[url] = true;
          return true;
        }).map(function(url) {
          return { id: generateDefectLinkId(), url: url };
        });
      }

      function detectHasExecResult(cases, reuseEnabled) {
        var caseList = Array.isArray(cases) ? cases : [];
        if (reuseEnabled) {
          return caseList.some(function(item) {
            return (item && Array.isArray(item.reuseDetails) ? item.reuseDetails : []).some(function(detail) {
              if (!detail || isReuseDetailRemoved(detail)) return false;
              return (detail.status && detail.status !== '未执行') || Boolean(detail.note && detail.note.trim());
            });
          });
        }
        return caseList.some(function(item) {
          var status = item && item.actual ? String(item.actual) : '未执行';
          return (status && status !== '未执行')
            || Boolean(item && item.remark && item.remark.trim())
            || Boolean(item && Array.isArray(item.defectLinks) && item.defectLinks.length);
        });
      }

      var result = [];
      var reuseEnabled = false;
      var current = null;
      for (var rowIndex = 1; rowIndex < list.length; rowIndex += 1) {
        var row = list[rowIndex] || [];
        var moduleName = pick(row, 'module').trim();
        var title = pick(row, 'title').trim();
        var priority = pick(row, 'priority').trim();
        var preconditions = pick(row, 'preconditions').trim();
        var steps = pick(row, 'steps').trim();
        var expected = pick(row, 'expected').trim();
        var actualRaw = pick(row, 'actual').trim();
        var remark = pick(row, 'remark');
        var defectRaw = pick(row, 'defect');
        var allText = moduleName + title + priority + preconditions + steps + expected + actualRaw + remark + defectRaw;
        if (!allText.trim() || isHeaderLikeRow(row)) continue;

        var isReuseDetailRow = !moduleName && !title && !priority && !preconditions && !steps && expected;
        if (isReuseDetailRow) {
          if (!hasResultHeader) throw new Error('结果格式不对：复用子项行仅允许出现在带结果的 Excel 中');
          if (!current) throw new Error('结果格式不对：复用子项行前缺少主用例行');
          if (defectRaw && String(defectRaw).trim()) throw new Error('结果格式不对：复用子项行“缺陷链接”必须为空');
          var childStatus = normalizeStatusInput(actualRaw);
          if (!childStatus) throw new Error('结果格式不对：复用子项行“实际结果”不合法');
          reuseEnabled = true;
          current.reuseDetails.push({
            id: generateReuseDetailId(),
            text: expected,
            note: remark || '',
            status: childStatus,
          });
          continue;
        }

        if (!moduleName || !title || !expected) {
          throw new Error('Excel 格式不对：第 ' + (rowIndex + 1) + ' 行缺少必填字段（模块/用例标题/预期结果）');
        }
        var status = '未执行';
        var defectLinks = [];
        if (hasResultHeader) {
          status = normalizeStatusInput(actualRaw);
          if (!status) throw new Error('结果格式不对：第 ' + (rowIndex + 1) + ' 行“实际结果”不合法');
          defectLinks = parseDefectLinks(defectRaw);
        }
        current = {
          module: moduleName,
          title: title,
          priority: priority || '',
          preconditions: preconditions || '',
          steps: steps || '',
          expected: expected,
          actual: status,
          remark: remark || '',
          reuseDetails: [],
          defectLinks: defectLinks,
        };
        result.push(current);
      }

      if (!result.length) throw new Error('Excel 解析失败：未解析到有效用例');
      if (reuseEnabled) {
        result.forEach(function(item) {
          if (!item || !item.reuseDetails.length) return;
          var aggregate = resolveReuseAggregateStatus(item.reuseDetails);
          if (!item.actual) throw new Error('结果格式不对：复用用例主行“实际结果”不能为空（' + (item.title || '') + '）');
          if (String(item.actual) !== String(aggregate)) {
            throw new Error('结果格式不对：复用用例主行“实际结果”需与子项汇总一致（' + (item.title || '') + '）');
          }
        });
        result.forEach(function(item) {
          item.actual = item.reuseDetails.length ? resolveReuseAggregateStatus(item.reuseDetails) : '未执行';
        });
      }
      return { cases: result, reuseEnabled: reuseEnabled, hasResult: detectHasExecResult(result, reuseEnabled) };
    }

    function readJsonImport(rawJson) {
      var list = [];
      var requirementFromContent = '';
      var isSnapshotFile = false;
      function applyParsed(parsed) {
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          && parsed.type === 'tempexec_snapshot_v1' && Array.isArray(parsed.files)) {
          isSnapshotFile = true;
        }
        if (Array.isArray(parsed)) {
          list = parsed;
          if (parsed.length && parsed[0]) {
            var firstRequirement = parsed[0].requirement || parsed[0].requirment;
            if (typeof firstRequirement === 'string') requirementFromContent = normalizeRequirementName(firstRequirement);
          }
          return true;
        }
        if (parsed && Array.isArray(parsed.cases)) {
          list = parsed.cases;
          var requirement = parsed.requirement || parsed.requirment;
          if (typeof requirement === 'string') requirementFromContent = normalizeRequirementName(requirement);
          return true;
        }
        return false;
      }
      try {
        var parsedJson = JSON.parse(rawJson);
        if (!applyParsed(parsedJson)) list = deriveCaseListFromText(rawJson);
      } catch (error) {
        var start = rawJson.indexOf('{');
        var end = rawJson.lastIndexOf('}');
        var parsedFallback = null;
        if (start !== -1 && end > start) {
          try { parsedFallback = JSON.parse(rawJson.slice(start, end + 1)); } catch (fallbackError) { parsedFallback = null; }
        }
        if (!parsedFallback || !applyParsed(parsedFallback)) list = deriveCaseListFromText(rawJson);
      }
      return { cases: list, requirementFromContent: requirementFromContent, isSnapshotFile: isSnapshotFile };
    }

    async function parseTempExecImportFile(file, parseOptions) {
      var settings = parseOptions && typeof parseOptions === 'object' ? parseOptions : {};
      var fileName = file && file.name ? String(file.name) : '';
      var extension = (fileName.split('.').pop() || '').toLowerCase();
      var text = '';
      var cases = [];
      var requirementFromContent = '';
      var inferredReuse = false;
      var hasResult = false;
      var isSnapshotFile = false;

      if (extension === 'xmind') {
        var parsed = await parseXmindFile(file);
        text = parsed && parsed.text ? parsed.text : '';
        cases = parsed && Array.isArray(parsed.list) ? parsed.list : [];
        var paths = parsed && Array.isArray(parsed.paths) ? parsed.paths : [];
        var rootTitle = parsed && parsed.rootTitle ? normalizeRequirementName(parsed.rootTitle) : '';
        if (paths.length) {
          var parsedExec = buildTempExecCasesFromXmindPaths(paths);
          if (parsedExec && parsedExec.hasResult && Array.isArray(parsedExec.cases) && parsedExec.cases.length) {
            cases = parsedExec.cases;
            hasResult = true;
          }
          inferredReuse = Boolean(parsedExec && parsedExec.reuseEnabled);
        }
        requirementFromContent = rootTitle;
      } else if (extension === 'xlsx') {
        if (typeof parseXlsxFileToRows !== 'function') throw new Error('缺少 Excel 解析能力');
        var rows = await parseXlsxFileToRows(file);
        var parsedRows = buildTempExecCasesFromXlsxRows(rows || []);
        cases = parsedRows.cases;
        inferredReuse = Boolean(parsedRows.reuseEnabled);
        hasResult = Boolean(parsedRows.hasResult);
      } else if (extension === 'json') {
        text = String(await file.text()).trim();
        var parsedJsonResult = readJsonImport(text);
        cases = parsedJsonResult.cases;
        requirementFromContent = parsedJsonResult.requirementFromContent;
        isSnapshotFile = parsedJsonResult.isSnapshotFile;
      } else {
        text = String(await file.text());
        cases = deriveCaseListFromText(text);
      }
      if (settings.rejectSnapshot && isSnapshotFile) {
        throw new Error('检测到执行页面配置文件，请使用“导入执行页面配置”按钮导入');
      }
      return {
        fileName: fileName,
        ext: extension,
        text: text,
        cases: Array.isArray(cases) ? cases : [],
        requirementFromContent: requirementFromContent,
        inferredReuse: inferredReuse,
        hasResult: hasResult,
        isSnapshotFile: isSnapshotFile,
      };
    }

    return {
      buildCaseItemPayloadFromTempCase: buildCaseItemPayloadFromTempCase,
      buildExecImportPayloadFromTempCase: buildExecImportPayloadFromTempCase,
      buildTempExecCasesFromXlsxRows: buildTempExecCasesFromXlsxRows,
      parseTempExecImportFile: parseTempExecImportFile,
    };
  }

  return { create: create };
});
