(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecDbImportOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function(root) {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var state = opts.state || {};
    var browser = opts.window || root || {};
    var tempExecStatus = opts.tempExecStatus || null;
    var isDbMode = port('isDbMode', function() { return false; });
    var importTempExecFiles = port('importTempExecFiles', function() { return Promise.resolve(); });
    var getApiClient = port('getApiClient', function() { return null; });
    var setStatus = port('setStatus');
    var normalizeTempExecName = port('normalizeTempExecName', function(value) { return String(value || '').trim().toLowerCase(); });
    var getSafeFileBaseName = port('getSafeFileBaseName', function(value) { return String(value || '').replace(/\.[^.]+$/, ''); });
    var parseTempExecImportFile = port('parseTempExecImportFile', function() {
      return Promise.resolve({ cases: [], text: '', requirementFromContent: '', inferredReuse: false, hasResult: false });
    });
    var normalizeRequirementName = port('normalizeRequirementName', function(value) { return String(value || '').trim(); });
    var extractRequirementLabelFromText = port('extractRequirementLabelFromText', function() { return ''; });
    var promptTempExecRequirement = port('promptTempExecRequirement', function() { return ''; });
    var setRequirementLabel = port('setRequirementLabel');
    var normalizeTempExecCases = port('normalizeTempExecCases', function(value) { return Array.isArray(value) ? value : []; });
    var buildCaseItemPayloadFromTempCase = port('buildCaseItemPayloadFromTempCase', function() { return null; });
    var buildExecImportPayloadFromTempCase = port('buildExecImportPayloadFromTempCase', function() { return null; });
    var confirmTempExecImportDuplicateByDrawer = port('confirmTempExecImportDuplicateByDrawer', function() { return Promise.resolve(false); });
    var queueTempExecCaseLibraryDiffReset = port('queueTempExecCaseLibraryDiffReset');
    var loadTempExecStateFromDb = port('loadTempExecStateFromDb', function() { return Promise.resolve(); });
    var getTempExecFile = port('getTempExecFile', function() { return null; });
    var setTempExecActive = port('setTempExecActive');

    function cleanImportFileName(name) {
      var raw = String(name || '');
      var base = raw.split(/[\\/]/).pop() || raw;
      var cleaned = getSafeFileBaseName(base, 'case');
      cleaned = String(cleaned || '').replace(/\.[^.]+$/, '');
      cleaned = cleaned.replace(/^勾选用例[\s_\-\u2010-\u2015\u2212\uFE63\uFF0D]*/i, '');
      cleaned = cleaned.trim().replace(/^[_-]+|[_-]+$/g, '');
      return cleaned || 'case';
    }

    function normalizeText(value) {
      return normalizeTempExecName ? normalizeTempExecName(value) : String(value || '').trim().toLowerCase();
    }

    function buildMatchKey(item) {
      return [item.module, item.title, item.precondition, item.steps, item.expected].map(normalizeText).join('::');
    }

    function deduplicateCases(cases) {
      var pairs = [];
      var groups = {};
      var seen = {};
      var total = 0;
      var duplicates = 0;
      (Array.isArray(cases) ? cases : []).forEach(function(source) {
        var payload = buildCaseItemPayloadFromTempCase(source);
        if (!payload) return;
        total += 1;
        var key = buildMatchKey(payload);
        var line = source && Number.isFinite(Number(source._sourceLine)) ? Number(source._sourceLine) : total;
        if (!groups[key]) groups[key] = [];
        groups[key].push({ line: line, payload: payload, source: source });
        if (seen[key]) {
          duplicates += 1;
          return;
        }
        seen[key] = true;
        pairs.push({ key: key, payload: payload, source: source });
      });
      return { pairs: pairs, groups: groups, total: total, duplicateCount: duplicates };
    }

    function buildDuplicateRows(groups) {
      var rows = [];
      Object.keys(groups || {}).forEach(function(key) {
        var list = groups[key];
        if (!Array.isArray(list) || list.length <= 1) return;
        list.forEach(function(entry, index) {
          rows.push({
            line: entry && entry.line ? entry.line : 0,
            payload: entry && entry.payload ? entry.payload : null,
            source: entry && entry.source ? entry.source : null,
            keep: index === 0,
          });
        });
      });
      rows.sort(function(a, b) { return Number(a.line || 0) - Number(b.line || 0); });
      return rows;
    }

    function buildDuplicatePayload(existingCaseFile, context) {
      return {
        payload: {
          existing_case_file_id: existingCaseFile.id,
          existing_file_name_clean: existingCaseFile.file_name_clean || context.cleanName,
          existing_version_id: existingCaseFile.version_id || null,
        },
        duplicate: {
          file_name: context.fileName,
          clean_name: context.cleanName,
          project_id: context.projectId,
          version_id: context.versionId,
          source: context.source,
          ext: context.ext || '',
          items: context.caseItemPayload,
          exec_cases: context.cases.map(function(item) {
            return buildExecImportPayloadFromTempCase(item, context.inferredReuse);
          }).filter(Boolean),
          has_result: Boolean(context.hasResult),
          reuse_enabled: Boolean(context.inferredReuse),
          requirement: context.requirementLabel || '',
        },
      };
    }

    function indexCaseFiles(files) {
      var byName = {};
      (Array.isArray(files) ? files : []).forEach(function(file) {
        if (!file || !file.file_name_clean) return;
        [normalizeText(file.file_name_clean), normalizeText(cleanImportFileName(file.file_name_clean))].forEach(function(key) {
          if (!key) return;
          var previous = byName[key];
          if (!previous || Number(file.id || 0) > Number(previous.id || 0)) byName[key] = file;
        });
      });
      return byName;
    }

    async function resolveRequirement(parsed, fileName) {
      var extracted = parsed.requirementFromContent || extractRequirementLabelFromText(parsed.text || '') || '';
      var requirement = extracted;
      if (!requirement) requirement = state.requirementLabel ? normalizeRequirementName(state.requirementLabel) : '';
      if (!requirement) requirement = cleanImportFileName(fileName);
      if (!requirement) requirement = promptTempExecRequirement(fileName, extracted || fileName);
      if (requirement && !state.requirementLabel) setRequirementLabel(requirement, 'tempexec-import-db');
      return requirement;
    }

    async function importTempExecFilesToDb(fileList, projectId, versionId, execVersionId) {
      if (!isDbMode()) {
        await importTempExecFiles(fileList);
        return { imported: 0, failed: [], mode: 'local' };
      }
      var client = getApiClient();
      if (!client
        || typeof client.listCaseFiles !== 'function'
        || typeof client.importCaseFile !== 'function'
        || typeof client.listExecSets !== 'function'
        || typeof client.listExecCases !== 'function'
        || typeof client.createExecCase !== 'function'
        || typeof client.updateExecCase !== 'function'
        || typeof client.upsertExecSetFromCaseFile !== 'function') {
        throw new Error('后端入库接口未就绪');
      }
      var pid = Number(projectId);
      var vid = Number(versionId);
      if (!Number.isFinite(pid) || pid <= 0) throw new Error('请选择项目');
      if (!Number.isFinite(vid) || vid <= 0) throw new Error('请选择版本');
      var execVersion = execVersionId !== null && execVersionId !== undefined && String(execVersionId) !== ''
        ? Number(execVersionId)
        : null;
      if (!Number.isFinite(execVersion)) execVersion = null;

      var files = Array.prototype.slice.call(fileList || []).filter(Boolean).sort(function(a, b) {
        return String(a && a.name || '').localeCompare(String(b && b.name || ''), 'zh-Hans-CN');
      });
      if (!files.length) throw new Error('未选择文件');
      if (tempExecStatus) setStatus(tempExecStatus, '正在入库用例...', '');

      var existingCaseFiles = [];
      try { existingCaseFiles = await client.listCaseFiles(pid); } catch (error) { existingCaseFiles = []; }
      var caseFileByName = indexCaseFiles(existingCaseFiles);
      var importedExecSetIds = [];
      var importedNames = [];
      var failures = [];
      var duplicates = [];

      for (var index = 0; index < files.length; index += 1) {
        var file = files[index];
        var fileName = file && file.name ? String(file.name) : '';
        try {
          if (tempExecStatus) setStatus(tempExecStatus, '解析并入库：' + fileName, '');
          var parsed = await parseTempExecImportFile(file, { rejectSnapshot: true });
          var requirementLabel = await resolveRequirement(parsed, fileName);
          if (!requirementLabel) {
            failures.push({ file: fileName, reason: '已取消导入（需求标识为空）' });
            continue;
          }
          var tempId = 'import-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
          var cases = parsed.hasResult
            ? parsed.cases
            : normalizeTempExecCases(parsed.cases || [], tempId);
          var deduplicated = deduplicateCases(cases);
          if (!deduplicated.pairs.length) {
            failures.push({ file: fileName, reason: '未解析到有效用例（缺少模块/标题/预期结果）' });
            continue;
          }
          if (deduplicated.duplicateCount > 0) {
            var confirmed = await confirmTempExecImportDuplicateByDrawer({
              fileName: fileName,
              total: deduplicated.total,
              uniqueCount: deduplicated.pairs.length,
              duplicateCount: deduplicated.duplicateCount,
              rows: buildDuplicateRows(deduplicated.groups).slice(0, 200),
            });
            if (!confirmed) {
              failures.push({ file: fileName, reason: '已取消导入（包含重复条目，请先去重再入库）' });
              continue;
            }
          }
          var cleanName = cleanImportFileName(fileName);
          var caseItemPayload = deduplicated.pairs.map(function(entry) { return entry.payload; });
          var sourceCases = deduplicated.pairs.map(function(entry) { return entry.source; });
          var existingCaseFile = caseFileByName[normalizeText(cleanName)] || null;
          var duplicateContext = {
            fileName: fileName,
            cleanName: cleanName,
            projectId: pid,
            versionId: vid,
            source: file && file.type ? file.type : (parsed.ext ? 'file:' + parsed.ext : 'file'),
            ext: parsed.ext,
            caseItemPayload: caseItemPayload,
            cases: sourceCases,
            inferredReuse: parsed.inferredReuse,
            hasResult: parsed.hasResult,
            requirementLabel: requirementLabel,
          };
          if (existingCaseFile && existingCaseFile.id) {
            duplicates.push(buildDuplicatePayload(existingCaseFile, duplicateContext));
            continue;
          }

          var caseFile = null;
          try {
            caseFile = await client.importCaseFile({
              project_id: pid,
              version_id: vid,
              file_name: fileName || 'case',
              source: 'tempexec',
              items: caseItemPayload,
            });
          } catch (importError) {
            var message = importError && importError.message ? String(importError.message) : '';
            if (message.indexOf('同名') !== -1) {
              var duplicateCaseFile = importError && importError.payload
                ? {
                    id: importError.payload.existing_case_file_id,
                    file_name_clean: importError.payload.existing_file_name_clean,
                    version_id: importError.payload.existing_version_id,
                  }
                : { id: null, file_name_clean: cleanName, version_id: null };
              var duplicateEntry = buildDuplicatePayload(duplicateCaseFile, duplicateContext);
              duplicateEntry.payload = importError && importError.payload ? importError.payload : duplicateEntry.payload;
              duplicates.push(duplicateEntry);
              continue;
            }
            throw importError;
          }
          caseFileByName[normalizeText(caseFile.file_name_clean || cleanName)] = caseFile;
          importedNames.push(caseFile.file_name_clean || cleanName);
          var importCases = parsed.hasResult || parsed.inferredReuse
            ? sourceCases.map(function(item) {
                return buildExecImportPayloadFromTempCase(item, parsed.inferredReuse);
              }).filter(Boolean)
            : null;
          var execSet = await client.upsertExecSetFromCaseFile({
            case_file_id: caseFile.id,
            mode: 'replace',
            prefer_result_source: importCases && importCases.length ? 'import' : 'db',
            import_cases: importCases && importCases.length ? importCases : null,
            requirement: requirementLabel || '',
            reuse_enabled: parsed.inferredReuse ? true : false,
            reuse_presets: null,
            exec_version_id: execVersion,
          });
          if (execSet && execSet.id) importedExecSetIds.push(execSet.id);
          else failures.push({ file: fileName, reason: '执行集创建失败' });
        } catch (error2) {
          if (error2 && error2.code === 'duplicate_case_file') throw error2;
          failures.push({ file: fileName, reason: error2 && error2.message ? error2.message : '入库失败' });
        }
      }

      if (importedExecSetIds.length) {
        queueTempExecCaseLibraryDiffReset(importedExecSetIds);
        await loadTempExecStateFromDb();
        var latestId = String(importedExecSetIds[importedExecSetIds.length - 1]);
        if (getTempExecFile(latestId)) setTempExecActive(latestId);
      }
      var summary = '入库完成：成功 ' + importedExecSetIds.length + '，失败 ' + failures.length;
      if (duplicates.length) summary += '，同名待处理 ' + duplicates.length;
      var lines = [summary];
      failures.slice(0, 3).forEach(function(item) {
        lines.push(' - ' + (item.file || '文件') + '：' + (item.reason || '入库失败'));
      });
      if (failures.length > 3) lines.push(' - 还有 ' + (failures.length - 3) + ' 个失败未展开');
      if (tempExecStatus) setStatus(tempExecStatus, lines.join('\n'), failures.length ? 'warn' : 'ok');
      return {
        imported: importedExecSetIds.length,
        failed: failures,
        duplicates: duplicates,
        imported_names: importedNames,
        mode: 'db',
      };
    }

    return {
      cleanImportFileName: cleanImportFileName,
      importTempExecFilesToDb: importTempExecFilesToDb,
    };
  }

  return { create: create };
});
