(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecFileWorkflowOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function createEmptyTempExecPlacement() {
    return {
      requirementOrder: [],
      fileOrder: {},
      versionOrder: [],
      projectOrder: [],
      versionOrderByProject: {},
      fileOrderByProjectVersion: {},
    };
  }

  function stripTempExecExecutionFields(item) {
    var copy = {};
    Object.keys(item || {}).forEach(function(key) { copy[key] = item[key]; });
    ['actual', 'remark', 'defectLinks', 'reuseDetails', 'reuseEnabled', 'result', 'actual_result']
      .forEach(function(key) { delete copy[key]; });
    return copy;
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var state = opts.state || {};
    var tempExecStatus = opts.tempExecStatus || null;
    var normalizeRequirementName = port('normalizeRequirementName', function(value) { return String(value || '').trim(); });
    var getRequirementLabel = port('getRequirementLabel', function() { return ''; });
    var ensureRequirementLabel = port('ensureRequirementLabel', function() { return ''; });
    var setRequirementLabel = port('setRequirementLabel');
    var stripTimestampSuffix = port('stripTimestampSuffix', function(value) { return value || ''; });
    var buildTempExecXmindPackage = typeof opts.buildTempExecXmindPackage === 'function' ? opts.buildTempExecXmindPackage : null;
    var buildXmindPackageFromCases = typeof opts.buildXmindPackageFromCases === 'function' ? opts.buildXmindPackageFromCases : null;
    var getTempExecFileBaseName = port('getTempExecFileBaseName', function() { return 'temp_exec'; });
    var formatCompactTimestamp = port('formatCompactTimestamp', function() { return String(Date.now()); });
    var downloadBlob = port('downloadBlob');
    var setStatus = port('setStatus');
    var getTempExecFile = port('getTempExecFile', function() { return null; });
    var generateTempExecId = port('generateTempExecId', function() { return 'tempexec-' + Date.now(); });
    var normalizeTempExecCases = port('normalizeTempExecCases', function(value) { return Array.isArray(value) ? value : []; });
    var insertFileIntoOrder = port('insertFileIntoOrder');
    var ensureRequirementOrder = port('ensureRequirementOrder');
    var saveTempExecFocus = port('saveTempExecFocus');
    var parseTempExecImportFile = port('parseTempExecImportFile', function() { return Promise.resolve({ cases: [] }); });
    var extractRequirementLabelFromText = port('extractRequirementLabelFromText', function() { return ''; });
    var promptTempExecRequirement = port('promptTempExecRequirement', function() { return ''; });
    var ensureTempExecReplacement = port('ensureTempExecReplacement', function() { return true; });
    var syncTempExecFocus = port('syncTempExecFocus');
    var ensureTempExecPlacement = port('ensureTempExecPlacement', createEmptyTempExecPlacement);
    var syncTempExecPlacement = port('syncTempExecPlacement');
    var persistTempExecState = port('persistTempExecState');
    var setTempExecActive = port('setTempExecActive');

    function resolveExportRequirement(active, promptMessage) {
      var requirement = stripTimestampSuffix(
        normalizeRequirementName(active && active.requirement)
          || normalizeRequirementName(getRequirementLabel(true))
      );
      if (!requirement) requirement = ensureRequirementLabel(promptMessage);
      return requirement;
    }

    async function exportTempExecToXmind() {
      var active = getTempExecFile(state.tempExecActiveId);
      if (!active) {
        if (tempExecStatus) setStatus(tempExecStatus, '请选择需要导出的执行用例', 'warn');
        return;
      }
      var requirement = resolveExportRequirement(active, '请输入需求标识后再导出执行 XMind');
      if (!requirement) {
        if (tempExecStatus) setStatus(tempExecStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      active.requirement = active.requirement || requirement;
      if (!state.requirementLabel) setRequirementLabel(requirement, 'tempexec-export');
      try {
        if (!buildTempExecXmindPackage) throw new Error('缺少 XMind 导出依赖');
        var result = await buildTempExecXmindPackage(active, requirement);
        if (result && result.blob) downloadBlob(result.fileName, result.blob);
        if (tempExecStatus) {
          setStatus(tempExecStatus, '已导出 ' + (result && result.count ? result.count : 0) + ' 条执行用例为 XMind', 'ok');
        }
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) console.error(error);
        if (tempExecStatus) setStatus(tempExecStatus, 'XMind 导出失败：' + error.message, 'err');
      }
    }

    async function exportTempExecCasesToXmind() {
      var active = getTempExecFile(state.tempExecActiveId);
      if (!active) {
        if (tempExecStatus) setStatus(tempExecStatus, '请选择需要导出的执行用例', 'warn');
        return;
      }
      var requirement = resolveExportRequirement(active, '请输入需求标识后再导出用例 XMind');
      if (!requirement) {
        if (tempExecStatus) setStatus(tempExecStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      var strippedCases = (active.cases || []).map(stripTempExecExecutionFields);
      try {
        if (!buildXmindPackageFromCases) throw new Error('缺少用例 XMind 导出依赖');
        var result = await buildXmindPackageFromCases(strippedCases, active.name || '用例', requirement);
        var fileName = getTempExecFileBaseName(active, requirement) + '_' + formatCompactTimestamp() + '.xmind';
        if (result && result.blob) downloadBlob(fileName, result.blob);
        if (tempExecStatus) setStatus(tempExecStatus, '已导出用例 XMind（不含执行结果）', 'ok');
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) console.error(error);
        if (tempExecStatus) setStatus(tempExecStatus, '用例 XMind 导出失败：' + error.message, 'err');
      }
    }

    function createTempExecFile(name, list, scope, explicitId, createdAt, requirementLabel) {
      var id = explicitId || generateTempExecId();
      var cases = normalizeTempExecCases(list || [], id);
      if (!cases.length) return null;
      var timestamp = Number(createdAt);
      var requirement = normalizeRequirementName(requirementLabel) || getRequirementLabel(true);
      var entry = {
        id: id,
        name: name || ('用例' + ((state.tempExecFiles && state.tempExecFiles.length) ? state.tempExecFiles.length + 1 : 1)),
        cases: cases,
        scope: scope || 'current',
        reuseEnabled: false,
        createdAt: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now(),
        reusePresets: [],
        requirement: requirement,
        projectId: '',
        versionId: '',
      };
      insertFileIntoOrder(requirement, id);
      ensureRequirementOrder((state.tempExecFiles || []).concat(entry).map(function(file) {
        return normalizeRequirementName(file && file.requirement) || '未标识需求';
      }));
      return entry;
    }

    async function importTempExecFiles(fileList) {
      var files = Array.prototype.slice.call(fileList || []).sort(function(left, right) {
        return String(left && left.name || '').localeCompare(String(right && right.name || ''), 'zh-Hans-CN');
      });
      if (!files.length) return;
      var firstImport = !state.tempExecFiles || !state.tempExecFiles.length;
      if (firstImport) {
        state.tempExecPlacement = createEmptyTempExecPlacement();
        state.tempExecFocus = [];
        saveTempExecFocus();
      }
      if (tempExecStatus) setStatus(tempExecStatus, '正在解析测试用例...', '');
      var added = [];
      for (var index = 0; index < files.length; index += 1) {
        var file = files[index];
        try {
          var parsed = await parseTempExecImportFile(file);
          var requirement = parsed.requirementFromContent
            || extractRequirementLabelFromText(parsed.text || '')
            || '';
          if (!requirement) {
            requirement = promptTempExecRequirement(file && file.name, file && file.name);
            if (!requirement) {
              if (tempExecStatus) setStatus(tempExecStatus, '已取消导入（需求标识为空）', 'warn');
              break;
            }
          }
          if (requirement && !state.requirementLabel) setRequirementLabel(requirement, 'import');
          var entry = createTempExecFile(file && file.name, parsed.cases, 'current', null, null, requirement);
          if (parsed.hasResult && entry) entry.cases = parsed.cases;
          if (entry && parsed.inferredReuse) entry.reuseEnabled = true;
          if (entry) entry.fromImport = true;
          if (entry && ensureTempExecReplacement(entry, added)) added.push(entry);
        } catch (error) {
          if (typeof console !== 'undefined' && console.warn) console.warn('导入临时执行用例失败', error);
          if (tempExecStatus) {
            setStatus(
              tempExecStatus,
              '解析 ' + (file && file.name ? file.name : '') + ' 失败：' + (error && error.message ? error.message : '未知错误'),
              'warn'
            );
          }
        }
      }
      if (!added.length) {
        if (tempExecStatus) setStatus(tempExecStatus, '未解析到有效用例，请检查文件结构', 'warn');
        return;
      }
      state.tempExecFiles = (state.tempExecFiles || []).concat(added);
      syncTempExecFocus();
      if (!state.tempExecPages || typeof state.tempExecPages !== 'object') state.tempExecPages = {};
      added.forEach(function(entry) { state.tempExecPages[entry.id] = 0; });
      if (firstImport) {
        var placement = ensureTempExecPlacement();
        var keepVersions = Array.isArray(placement.versionOrder) ? placement.versionOrder.slice() : [];
        placement.requirementOrder = [];
        placement.fileOrder = {};
        placement.versionOrder = keepVersions;
        syncTempExecPlacement();
      }
      persistTempExecState();
      setTempExecActive(added[added.length - 1].id);
      if (tempExecStatus) setStatus(tempExecStatus, '已导入 ' + added.length + ' 份测试用例', 'ok');
    }

    return {
      exportTempExecToXmind: exportTempExecToXmind,
      exportTempExecCasesToXmind: exportTempExecCasesToXmind,
      createTempExecFile: createTempExecFile,
      importTempExecFiles: importTempExecFiles,
    };
  }

  return {
    create: create,
    createEmptyTempExecPlacement: createEmptyTempExecPlacement,
    stripTempExecExecutionFields: stripTempExecExecutionFields,
  };
});
