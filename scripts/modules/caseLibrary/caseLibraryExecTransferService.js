(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.execTransferService = api;
  }
})(function() {
  function normalizeName(value) {
    return String(value || '').trim().toLowerCase();
  }

  function copyExecFields(target, source) {
    if (!target || !source) return;
    if (source.actual) target.actual = source.actual;
    if (source.remark) target.remark = source.remark;
    if (Array.isArray(source.defectLinks)) {
      target.defectLinks = source.defectLinks.map(function(link) { return Object.assign({}, link); });
    }
    if (Array.isArray(source.reuseDetails)) {
      target.reuseDetails = source.reuseDetails.map(function(detail) { return Object.assign({}, detail); });
    }
  }

  function buildMatchKey(item) {
    var module = String(item && item.module ? item.module : '').trim();
    var title = String(item && item.title ? item.title : '').trim();
    var expected = String(item && item.expected ? item.expected : '').trim();
    return normalizeName(module) + '::' + normalizeName(title) + '::' + normalizeName(expected);
  }

  function resolveCaseName(caseFile, fileName) {
    var raw = caseFile && caseFile.file_name_clean ? caseFile.file_name_clean : fileName;
    var name = String(raw || '').trim();
    if (name) return name;
    if (caseFile && caseFile.id) return '用例#' + caseFile.id;
    return '用例';
  }

  function mapExecCaseToPayload(row) {
    if (!row) return null;
    return {
      module: row.module || '',
      title: row.title || '',
      expected: row.expected || '',
      priority: row.priority || null,
      precondition: row.precondition || null,
      steps: row.steps || null,
      remark: row.remark || null,
      status: row.status || null,
      reuse_details: row.reuse_details || null,
      defect_links: row.defect_links || null,
    };
  }

  function matchesVersion(serverValue, targetValue) {
    if (targetValue === null || targetValue === undefined || targetValue === '') {
      return serverValue === null || serverValue === undefined || String(serverValue) === '';
    }
    return String(serverValue) === String(targetValue);
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var apiClient = opts.apiClient || null;
    var utils = opts.utils && typeof opts.utils === 'object' ? opts.utils : {};
    var getTempExecApi = typeof opts.getTempExecApi === 'function' ? opts.getTempExecApi : function() { return null; };
    var getGlobalState = typeof opts.getGlobalState === 'function' ? opts.getGlobalState : function() { return null; };
    var isExecDbEnabled = typeof opts.isExecDbEnabled === 'function' ? opts.isExecDbEnabled : function() { return false; };
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var getDefaultStatusElement = typeof opts.getDefaultStatusElement === 'function'
      ? opts.getDefaultStatusElement
      : function() { return null; };
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function'
      ? opts.openConfirmDrawer
      : function() { return Promise.resolve({ ok: true }); };
    var confirmOverwrite = typeof opts.confirmOverwrite === 'function' ? opts.confirmOverwrite : function() { return true; };
    var getVersionName = typeof opts.getVersionName === 'function'
      ? opts.getVersionName
      : function(projectId, versionId) { return versionId || versionId === 0 ? String(versionId) : ''; };
    var requestAssignDrawer = typeof opts.requestAssignDrawer === 'function' ? opts.requestAssignDrawer : function() {};
    var activateExecView = typeof opts.activateExecView === 'function' ? opts.activateExecView : function() {};

    function resolveVersionLabel(projectId, execVersionId) {
      if (execVersionId === null || execVersionId === undefined || execVersionId === '') return '未分配版本';
      if (projectId) {
        var name = getVersionName(projectId, execVersionId);
        if (name && name !== '--') return name;
      }
      return '版本#' + execVersionId;
    }

    function finishTransfer(name, versionLabel, transferOptions, statusElement, message) {
      setStatus(statusElement, message, 'ok');
      if (transferOptions.openAssignDrawer === true) {
        requestAssignDrawer({ caseName: name, versionName: versionLabel });
      }
      if (transferOptions.switchTab !== false) activateExecView();
      return { ok: true };
    }

    function transferToDatabase(context) {
      var caseFile = context.caseFile;
      var options = context.options;
      var name = context.name;
      var projectId = context.projectId;
      var targetVersionId = context.versionId;
      setStatus(context.statusElement, '转到执行中...', '');
      return apiClient.listExecSets(projectId || undefined).then(function(list) {
        var fileId = Number(caseFile.id);
        var matched = (Array.isArray(list) ? list : []).filter(function(execSet) {
          if (!execSet || Number(execSet.case_file_id) !== fileId) return false;
          if (String(execSet.status || '') !== 'active') return false;
          return matchesVersion(execSet.version_id, targetVersionId);
        });
        matched.sort(function(a, b) { return Number(b.id) - Number(a.id); });
        var existingSet = matched.length ? matched[0] : null;
        var confirmPromise = Promise.resolve(true);
        if (options.skipActiveConfirm !== true && existingSet) {
          confirmPromise = openConfirmDrawer({
            title: '确认转到执行',
            message: '检测到执行页已存在【' + name + '】的执行记录，将同步最新用例并尽量保留结果（模块+标题+预期一致保留），是否继续？',
            confirmText: '继续转到执行',
            cancelText: '取消',
            previousDrawer: options.previousDrawer || null,
          }).then(function(result) {
            if (!result || result.ok !== true) {
              var error = new Error('cancelled');
              error._cancel = true;
              throw error;
            }
            return true;
          });
        }
        return confirmPromise.then(function() {
          if (!existingSet) return [];
          return apiClient.listExecCases(existingSet.id).then(function(cases) {
            return (Array.isArray(cases) ? cases : []).map(mapExecCaseToPayload).filter(Boolean);
          }).catch(function() {
            return [];
          });
        });
      }).then(function(importCases) {
        var payload = {
          case_file_id: caseFile.id,
          mode: 'replace',
          prefer_result_source: importCases.length ? 'import' : 'db',
          import_cases: importCases.length ? importCases : null,
        };
        if (options.execVersionId !== undefined) {
          payload.exec_version_id = options.execVersionId;
        }
        if (Object.prototype.hasOwnProperty.call(options, 'association_enabled')) {
          payload.association_enabled = options.association_enabled === true;
        }
        return apiClient.upsertExecSetFromCaseFile(payload);
      }).then(function(execSet) {
        if (!execSet || !execSet.id) throw new Error('执行集创建失败');
        var tempExecApi = context.tempExecApi;
        var chain = typeof tempExecApi.loadTempExecState === 'function'
          ? Promise.resolve(tempExecApi.loadTempExecState())
          : Promise.resolve();
        return chain.then(function() {
          if (typeof tempExecApi.setTempExecActive === 'function') {
            tempExecApi.setTempExecActive(String(execSet.id));
          }
          return finishTransfer(
            name,
            context.versionLabel,
            options,
            context.statusElement,
            '已转到执行：' + name
          );
        });
      }).catch(function(error) {
        if (error && error._cancel) return { ok: false, reason: 'cancel' };
        setStatus(
          context.statusElement,
          '转到执行失败：' + (error && error.message ? error.message : '未知错误'),
          'err'
        );
        return { ok: false, err: error };
      });
    }

    function transferToMemory(context) {
      var options = context.options;
      var globalState = context.globalState;
      var tempExecApi = context.tempExecApi;
      if (!Array.isArray(globalState.tempExecFiles)) globalState.tempExecFiles = [];
      if (!globalState.tempExecPages || typeof globalState.tempExecPages !== 'object') globalState.tempExecPages = {};
      var items = (Array.isArray(context.items) ? context.items : []).filter(function(item) {
        return item && String(item.module || '').trim() && String(item.title || '').trim() && String(item.expected || '').trim();
      });
      if (!items.length) {
        setStatus(context.statusElement, '用例为空或缺少必填字段（模块/标题/预期结果）', 'warn');
        return Promise.resolve({ ok: false, reason: 'empty' });
      }
      var normalizeTempName = typeof utils.normalizeTempExecName === 'function'
        ? utils.normalizeTempExecName
        : normalizeName;
      var normalizedName = normalizeTempName(context.name);
      var existing = globalState.tempExecFiles.find(function(file) {
        return normalizeTempName(file && file.name) === normalizedName;
      }) || null;
      var message = '已转到执行：' + context.name;
      if (existing) {
        var confirmed = confirmOverwrite(
          '检测到名称为【' + context.name + '】的用例已存在，将用最新用例覆盖并尽量保留执行结果（标题+预期一致保留），是否继续？'
        );
        if (!confirmed) return Promise.resolve({ ok: false, reason: 'cancel' });
        var rebuilt = tempExecApi.createTempExecFile(
          existing.name,
          items,
          existing.scope,
          existing.id,
          existing.createdAt,
          existing.requirement
        );
        if (!rebuilt) {
          setStatus(context.statusElement, '转到执行失败：未解析到有效用例', 'err');
          return Promise.resolve({ ok: false, reason: 'invalid' });
        }
        rebuilt.reuseEnabled = Boolean(existing.reuseEnabled);
        rebuilt.reusePresets = Array.isArray(existing.reusePresets) ? existing.reusePresets : [];
        rebuilt.versionId = existing.versionId || '';
        var oldByKey = new Map();
        (existing.cases || []).forEach(function(item) { oldByKey.set(buildMatchKey(item), item); });
        (rebuilt.cases || []).forEach(function(item) {
          var previous = oldByKey.get(buildMatchKey(item));
          if (previous) copyExecFields(item, previous);
        });
        var index = globalState.tempExecFiles.findIndex(function(file) { return file && file.id === existing.id; });
        if (index === -1) globalState.tempExecFiles.push(rebuilt);
        else globalState.tempExecFiles[index] = rebuilt;
        if (typeof tempExecApi.clearTempExecCaseStates === 'function') {
          tempExecApi.clearTempExecCaseStates(existing.id);
        }
        globalState.tempExecPages[rebuilt.id] = 0;
        message = '已覆盖并转到执行：' + context.name;
        context.activeId = rebuilt.id;
      } else {
        var entry = tempExecApi.createTempExecFile(
          context.name,
          items,
          'current',
          null,
          null,
          globalState.requirementLabel
        );
        if (!entry) {
          setStatus(context.statusElement, '转到执行失败：未解析到有效用例', 'err');
          return Promise.resolve({ ok: false, reason: 'invalid' });
        }
        globalState.tempExecFiles.push(entry);
        globalState.tempExecPages[entry.id] = 0;
        context.activeId = entry.id;
      }
      if (typeof tempExecApi.persistTempExecState === 'function') tempExecApi.persistTempExecState();
      if (typeof tempExecApi.syncTempExecFocus === 'function') tempExecApi.syncTempExecFocus();
      if (typeof tempExecApi.setTempExecActive === 'function') tempExecApi.setTempExecActive(context.activeId);
      return Promise.resolve(finishTransfer(
        context.name,
        context.versionLabel,
        options,
        context.statusElement,
        message
      ));
    }

    function transfer(caseFile, fileName, items, options) {
      var transferOptions = options && typeof options === 'object' ? options : {};
      var statusElement = transferOptions.statusEl || getDefaultStatusElement();
      var tempExecApi = getTempExecApi();
      var globalState = getGlobalState();
      if (!tempExecApi || !globalState) {
        setStatus(statusElement, '执行页未就绪，请先打开一次“用例执行”页签', 'warn');
        return Promise.resolve({ ok: false, reason: 'not_ready' });
      }
      var projectId = caseFile && caseFile.project_id ? caseFile.project_id : null;
      var requestedVersionId = Object.prototype.hasOwnProperty.call(transferOptions, 'execVersionId')
        ? transferOptions.execVersionId
        : undefined;
      var versionId = requestedVersionId !== undefined
        ? (requestedVersionId === '' ? null : requestedVersionId)
        : (caseFile && caseFile.version_id !== null && caseFile.version_id !== undefined ? caseFile.version_id : null);
      var context = {
        caseFile: caseFile,
        items: items,
        options: transferOptions,
        statusElement: statusElement,
        tempExecApi: tempExecApi,
        globalState: globalState,
        projectId: projectId,
        versionId: versionId,
        versionLabel: resolveVersionLabel(projectId, versionId),
        name: resolveCaseName(caseFile, fileName),
      };
      if (isExecDbEnabled() && apiClient && caseFile && caseFile.id) return transferToDatabase(context);
      return transferToMemory(context);
    }

    return { transfer: transfer };
  }

  return {
    create: create,
    copyExecFields: copyExecFields,
    buildMatchKey: buildMatchKey,
    resolveCaseName: resolveCaseName,
    mapExecCaseToPayload: mapExecCaseToPayload,
    matchesVersion: matchesVersion,
  };
});
