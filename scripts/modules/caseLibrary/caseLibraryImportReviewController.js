(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.importReviewController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var apiClient = opts.apiClient || null;
    var view = opts.view || null;
    var diffControllerOwner = opts.diffControllerOwner || null;
    if (!view || !diffControllerOwner || typeof diffControllerOwner.create !== 'function') {
      throw new Error('Case library import review owners are required');
    }

    var ensureDrawer = typeof opts.ensureDrawer === 'function' ? opts.ensureDrawer : function() { return null; };
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function'
      ? opts.openConfirmDrawer
      : function() { return Promise.resolve({ ok: false }); };
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var cleanFileName = typeof opts.cleanFileName === 'function' ? opts.cleanFileName : function(value) { return String(value || ''); };
    var extFromFileName = typeof opts.extFromFileName === 'function' ? opts.extFromFileName : function() { return ''; };
    var validateItems = typeof opts.validateItems === 'function' ? opts.validateItems : function() { return []; };
    var sanitizeItems = typeof opts.sanitizeItems === 'function' ? opts.sanitizeItems : function(items) { return items || []; };
    var buildItemKey = typeof opts.buildItemKey === 'function' ? opts.buildItemKey : function() { return ''; };
    var dedupeItems = typeof opts.dedupeItems === 'function' ? opts.dedupeItems : function(items) { return items || []; };
    var countUniqueItems = typeof opts.countUniqueItems === 'function' ? opts.countUniqueItems : function(items) { return (items || []).length; };
    var loadVersions = typeof opts.loadVersions === 'function' ? opts.loadVersions : function() { return Promise.resolve([]); };
    var getProjectName = typeof opts.getProjectName === 'function' ? opts.getProjectName : function(id) { return '项目#' + id; };
    var getVersionName = typeof opts.getVersionName === 'function' ? opts.getVersionName : function(id) { return '版本#' + id; };
    var getImportDrawer = typeof opts.getImportDrawer === 'function' ? opts.getImportDrawer : function() { return null; };
    var refreshCaseFiles = typeof opts.refreshCaseFiles === 'function' ? opts.refreshCaseFiles : function() { return Promise.resolve(); };
    var renderImportFileHint = typeof opts.renderImportFileHint === 'function' ? opts.renderImportFileHint : function() {};
    var syncImportConfirmEnabled = typeof opts.syncImportConfirmEnabled === 'function' ? opts.syncImportConfirmEnabled : function() {};

    var diffDrawerInstance = null;
    var invalidDrawerInstance = null;
    var duplicateDrawerInstance = null;
    var diffTableController = null;
    var diffOpenTimer = 0;
    var duplicateResolve = null;
    var duplicateResolved = false;
    var duplicateConfirmBound = false;
    var bound = false;

    function getDiffState() {
      if (!state.importDiff || typeof state.importDiff !== 'object') state.importDiff = {};
      var target = state.importDiff;
      if (!target.mode) target.mode = 'import';
      if (!Array.isArray(target.importItems)) target.importItems = [];
      if (!Array.isArray(target.dbItems)) target.dbItems = [];
      if (!target.queue || typeof target.queue !== 'object') {
        target.queue = { active: false, total: 0, index: -1 };
      }
      return target;
    }

    function getInvalidState() {
      if (!state.importInvalid || typeof state.importInvalid !== 'object') state.importInvalid = {};
      var target = state.importInvalid;
      if (!Array.isArray(target.structuralErrors)) target.structuralErrors = [];
      if (!Array.isArray(target.items)) target.items = [];
      if (!Array.isArray(target.invalid)) target.invalid = [];
      if (!Number.isInteger(target.locateIndex)) target.locateIndex = -1;
      return target;
    }

    function ensureDiffTableController() {
      if (diffTableController) return diffTableController;
      diffTableController = diffControllerOwner.create({
        hostEl: dom.importDiffTableHost,
        locateBarEl: dom.importDiffLocateBar,
      });
      return diffTableController;
    }

    function closeImportDrawer() {
      var drawer = getImportDrawer();
      if (drawer && typeof drawer.close === 'function') drawer.close();
    }

    function openDiffDrawerDeferred() {
      if (diffOpenTimer) {
        clearTimeout(diffOpenTimer);
        diffOpenTimer = 0;
      }
      if (!diffDrawerInstance || typeof diffDrawerInstance.open !== 'function') return;
      var element = diffDrawerInstance.element;
      var alreadyOpen = Boolean(element && element.classList && element.classList.contains('open'));
      if (alreadyOpen) {
        diffDrawerInstance.open();
        return;
      }
      diffOpenTimer = setTimeout(function() {
        diffOpenTimer = 0;
        diffDrawerInstance.open();
      }, 60);
    }

    function assignDiffPayload(payload) {
      var data = payload && typeof payload === 'object' ? payload : {};
      var target = getDiffState();
      target.mode = data.mode || 'import';
      target.caseFileId = data.caseFileId || null;
      target.fileName = data.fileName || '';
      target.cleanName = data.cleanName || data.fileName || '';
      target.importedCleanName = data.importedCleanName || '';
      target.source = data.source || '';
      target.projectId = data.projectId || null;
      target.importVersionId = data.importVersionId || null;
      target.dbVersionId = data.dbVersionId || null;
      target.importItems = Array.isArray(data.importItems) ? data.importItems : [];
      target.dbItems = Array.isArray(data.dbItems) ? data.dbItems : [];
      target.loading = false;
      target.confirming = false;
      return target;
    }

    function buildDiffContext(diffState, counts) {
      return {
        counts: counts || {},
        projectName: getProjectName(diffState.projectId),
        importVersionName: getVersionName(diffState.projectId, diffState.importVersionId),
        dbVersionName: getVersionName(diffState.projectId, diffState.dbVersionId),
        leftCount: diffState.mode === 'append_overwrite'
          ? countUniqueItems(diffState.importItems)
          : dedupeItems(diffState.importItems).length,
        rightCount: diffState.mode === 'append_overwrite'
          ? countUniqueItems(diffState.dbItems)
          : dedupeItems(diffState.dbItems).length,
      };
    }

    function openDiff(payload) {
      var diffState = assignDiffPayload(payload);
      var controller = ensureDiffTableController();
      controller.setData({
        mode: diffState.mode,
        importItems: diffState.importItems,
        dbItems: diffState.dbItems,
      });
      view.renderDiff(diffState, buildDiffContext(diffState, controller.getCounts()));
      closeImportDrawer();
      openDiffDrawerDeferred();
    }

    function openDiffLoading(payload) {
      var diffState = assignDiffPayload(payload);
      diffState.dbVersionId = null;
      diffState.importItems = [];
      diffState.dbItems = [];
      ensureDiffTableController().setLoading(diffState.mode);
      view.renderDiffLoading(diffState, buildDiffContext(diffState, {}));
      closeImportDrawer();
      openDiffDrawerDeferred();
    }

    function resolveExternal(result) {
      var diffState = getDiffState();
      var external = diffState.external || null;
      if (!external || typeof external.resolve !== 'function') return false;
      diffState.external = null;
      try { external.resolve(result); } catch (err) {}
      return true;
    }

    function resolveDiffLoadFailure(error) {
      view.setDiffStatus('加载差异对比失败：' + (error && error.message ? error.message : '未知错误'), 'err');
      resolveExternal({ ok: false, reason: 'load_failed', error: error || null });
    }

    function findExistingCaseFile(projectId, cleanName) {
      if (!apiClient || typeof apiClient.listCaseFiles !== 'function') {
        return Promise.reject(new Error('用例库接口未就绪'));
      }
      return apiClient.listCaseFiles(projectId).then(function(files) {
        var existing = (Array.isArray(files) ? files : []).find(function(caseFile) {
          return caseFile && String(caseFile.file_name_clean || '') === String(cleanName || '');
        });
        if (!existing) throw new Error('未找到库中同名用例：' + cleanName);
        return existing;
      });
    }

    function loadSameNameDiff(options) {
      var data = options && typeof options === 'object' ? options : {};
      var existingId = data.existingCaseFileId || null;
      var existingPromise = existingId
        ? Promise.resolve({ id: existingId, version_id: data.dbVersionId || null })
        : findExistingCaseFile(data.projectId, data.cleanName);
      return Promise.all([existingPromise, loadVersions(data.projectId)])
        .then(function(result) {
          var existing = result[0];
          return apiClient.listCaseItems(existing.id).then(function(dbItems) {
            openDiff({
              fileName: data.fileName,
              cleanName: data.cleanName,
              importedCleanName: data.importedCleanName,
              projectId: data.projectId,
              importVersionId: data.versionId,
              dbVersionId: data.dbVersionId || existing.version_id || null,
              importItems: data.items,
              dbItems: dbItems || [],
              source: data.source,
            });
          });
        });
    }

    function normalizeSameNameOptions(options) {
      var data = options && typeof options === 'object' ? options : {};
      var error = data.error || null;
      var payload = error && error.payload ? error.payload : (data.payload || null);
      var fileName = data.fileName || data.file_name || '';
      var importedCleanName = cleanFileName(fileName);
      return {
        projectId: data.projectId || data.project_id || null,
        versionId: data.versionId || data.version_id || null,
        fileName: fileName,
        items: Array.isArray(data.items) ? data.items : [],
        source: data.source || data.importSource || extFromFileName(fileName) || 'external',
        importedCleanName: importedCleanName,
        cleanName: payload && payload.existing_file_name_clean
          ? String(payload.existing_file_name_clean)
          : (data.cleanName || importedCleanName),
        existingCaseFileId: payload && payload.existing_case_file_id ? payload.existing_case_file_id : null,
        dbVersionId: payload && (payload.existing_version_id || payload.existing_version_id === 0)
          ? payload.existing_version_id
          : null,
      };
    }

    function openImportDiffForExternal(options) {
      if (!apiClient || typeof apiClient.importCaseFile !== 'function' || typeof apiClient.listCaseItems !== 'function') {
        return Promise.resolve({ ok: false, reason: 'api_not_ready' });
      }
      var data = normalizeSameNameOptions(options);
      if (!data.projectId || !data.versionId || !data.fileName || !data.items.length || !data.existingCaseFileId) {
        return Promise.resolve({ ok: false, reason: 'invalid_params' });
      }
      openDiffLoading({
        fileName: data.fileName,
        cleanName: data.cleanName,
        importedCleanName: data.importedCleanName,
        projectId: data.projectId,
        importVersionId: data.versionId,
        source: data.source,
      });
      return new Promise(function(resolve) {
        getDiffState().external = { resolve: resolve };
        loadSameNameDiff(data).catch(resolveDiffLoadFailure);
      });
    }

    function openAppendDiffForExternal(options) {
      if (!apiClient || typeof apiClient.appendCaseItems !== 'function') {
        return Promise.resolve({ ok: false, reason: 'api_not_ready' });
      }
      var data = options && typeof options === 'object' ? options : {};
      var projectId = data.projectId || data.project_id || null;
      var versionId = data.versionId || data.version_id || null;
      var caseFileId = data.caseFileId || data.case_file_id || null;
      var cleanName = data.fileNameClean || data.file_name_clean || data.cleanName || '';
      var items = Array.isArray(data.items) ? data.items : [];
      var dbItems = Array.isArray(data.dbItems) ? data.dbItems : [];
      if (!projectId || !versionId || !caseFileId || !items.length) {
        return Promise.resolve({ ok: false, reason: 'invalid_params' });
      }
      var leftKeys = {};
      items.forEach(function(item) {
        var key = buildItemKey(item);
        if (key) leftKeys[key] = true;
      });
      var relatedDbItems = dbItems.filter(function(item) {
        var key = buildItemKey(item);
        return Boolean(key && leftKeys[key]);
      });
      if (!relatedDbItems.length) return Promise.resolve({ ok: false, reason: 'no_conflict' });
      openDiffLoading({
        mode: 'append_overwrite',
        caseFileId: caseFileId,
        fileName: cleanName || ('用例#' + caseFileId),
        cleanName: cleanName || ('用例#' + caseFileId),
        projectId: projectId,
        importVersionId: versionId,
        source: 'casegen',
      });
      return new Promise(function(resolve) {
        getDiffState().external = { resolve: resolve };
        loadVersions(projectId).then(function() {
          openDiff({
            mode: 'append_overwrite',
            caseFileId: caseFileId,
            fileName: cleanName || ('用例#' + caseFileId),
            cleanName: cleanName || ('用例#' + caseFileId),
            projectId: projectId,
            importVersionId: versionId,
            dbVersionId: null,
            importItems: items,
            dbItems: relatedDbItems,
            source: 'casegen',
          });
        }).catch(resolveDiffLoadFailure);
      });
    }

    function openDiffForQueueTask(task) {
      if (!task) return Promise.resolve({ ok: false, reason: 'invalid_task' });
      var data = normalizeSameNameOptions({
        projectId: task.projectId,
        versionId: task.versionId,
        fileName: task.fileName,
        items: task.importItems,
        error: task.error,
        source: task.source,
        cleanName: task.cleanName,
      });
      if (!data.projectId || !data.versionId || !data.fileName || !data.items.length) {
        return Promise.resolve({ ok: false, reason: 'invalid_params' });
      }
      if (data.existingCaseFileId) return openImportDiffForExternal({
        projectId: data.projectId,
        versionId: data.versionId,
        fileName: data.fileName,
        items: data.items,
        error: task.error,
        source: data.source,
      });
      openDiffLoading({
        fileName: data.fileName,
        cleanName: data.cleanName,
        importedCleanName: data.importedCleanName,
        projectId: data.projectId,
        importVersionId: data.versionId,
        source: data.source,
      });
      return new Promise(function(resolve) {
        getDiffState().external = { resolve: resolve };
        loadSameNameDiff(data).catch(resolveDiffLoadFailure);
      });
    }

    function resetInvalidState() {
      var target = getInvalidState();
      target.file = null;
      target.fileName = '';
      target.cleanName = '';
      target.source = '';
      target.projectId = null;
      target.versionId = null;
      target.structuralErrors = [];
      target.items = [];
      target.invalid = [];
      target.loading = false;
      target.locateIndex = -1;
      view.resetInvalid();
    }

    function openInvalid(payload) {
      var data = payload && typeof payload === 'object' ? payload : {};
      var target = getInvalidState();
      target.file = data.file || null;
      target.fileName = data.fileName || '';
      target.cleanName = data.cleanName || cleanFileName(data.fileName || '');
      target.source = data.source || '';
      target.projectId = data.projectId || null;
      target.versionId = data.versionId || null;
      target.structuralErrors = Array.isArray(data.structuralErrors) ? data.structuralErrors : [];
      target.items = Array.isArray(data.items) ? data.items : [];
      target.invalid = validateItems(target.items);
      target.locateIndex = -1;
      target.loading = false;
      view.renderInvalid(target);
      closeImportDrawer();
      if (invalidDrawerInstance && typeof invalidDrawerInstance.open === 'function') {
        setTimeout(function() { invalidDrawerInstance.open(); }, 60);
      }
    }

    function buildDuplicateGroups(items) {
      var list = Array.isArray(items) ? items : [];
      var seen = {};
      var groups = {};
      var unique = [];
      list.forEach(function(item, index) {
        if (!item) return;
        var key = buildItemKey(item);
        if (!key) return;
        if (!groups[key]) groups[key] = [];
        var line = Number.isFinite(Number(item._sourceLine)) ? Number(item._sourceLine) : index + 1;
        groups[key].push({ line: line, item: item });
        if (seen[key]) return;
        seen[key] = true;
        unique.push(item);
      });
      var rows = [];
      Object.keys(groups).forEach(function(key) {
        var entries = groups[key];
        if (!entries || entries.length <= 1) return;
        entries.forEach(function(entry, index) {
          rows.push({ line: entry.line || 0, item: entry.item || null, keep: index === 0 });
        });
      });
      rows.sort(function(a, b) { return Number(a.line || 0) - Number(b.line || 0); });
      return { uniqueItems: unique, duplicateCount: list.length - unique.length, rows: rows };
    }

    function ensureDuplicateDrawer() {
      if (duplicateDrawerInstance) return duplicateDrawerInstance;
      duplicateDrawerInstance = ensureDrawer('caseLibraryImportDuplicateDrawer', [], null, function() {
        if (duplicateResolved || typeof duplicateResolve !== 'function') return;
        duplicateResolved = true;
        var resolve = duplicateResolve;
        duplicateResolve = null;
        try { resolve(false); } catch (err) {}
      });
      if (!duplicateConfirmBound && dom.importDuplicateConfirmBtn) {
        duplicateConfirmBound = true;
        dom.importDuplicateConfirmBtn.addEventListener('click', function() {
          if (duplicateResolved || typeof duplicateResolve !== 'function') return;
          duplicateResolved = true;
          var resolve = duplicateResolve;
          duplicateResolve = null;
          try { resolve(true); } catch (err) {}
          if (duplicateDrawerInstance && typeof duplicateDrawerInstance.close === 'function') duplicateDrawerInstance.close();
        });
      }
      return duplicateDrawerInstance;
    }

    function confirmDuplicates(payload) {
      var drawer = ensureDuplicateDrawer();
      if (!drawer) return Promise.resolve(false);
      duplicateResolved = false;
      view.renderDuplicate(payload, cleanFileName);
      if (typeof drawer.open === 'function') drawer.open();
      return new Promise(function(resolve) { duplicateResolve = resolve; });
    }

    function selectImportableInvalidItems() {
      var target = getInvalidState();
      var items = target.items;
      var structural = target.structuralErrors;
      var structuralLines = {};
      structural.forEach(function(entry) {
        if (entry && typeof entry.line === 'number') structuralLines[entry.line] = true;
      });
      var invalid = validateItems(items);
      target.invalid = invalid;
      var invalidNonStructural = invalid.filter(function(entry) {
        return !entry || !entry.line || !structuralLines[entry.line];
      });
      var pendingStructuralLines = {};
      invalid.forEach(function(entry) {
        if (entry && entry.line && structuralLines[entry.line]) pendingStructuralLines[entry.line] = true;
      });
      var importable = items.filter(function(item, index) {
        var line = item && item._sourceLine ? Number(item._sourceLine) : index + 1;
        if (!isFinite(line) || line <= 0) line = index + 1;
        return !pendingStructuralLines[line];
      });
      return {
        items: importable,
        invalidNonStructural: invalidNonStructural,
        pendingStructuralCount: Object.keys(pendingStructuralLines).length,
      };
    }

    function removeImportedInvalidFile(file) {
      if (file && state.importDrawer && Array.isArray(state.importDrawer.files)) {
        state.importDrawer.files = state.importDrawer.files.filter(function(candidate) { return candidate !== file; });
      }
      renderImportFileHint();
      if (dom.importInput && (!state.importDrawer.files || !state.importDrawer.files.length)) {
        try { dom.importInput.value = ''; } catch (err) {}
      }
      syncImportConfirmEnabled();
    }

    function openInvalidConflictDiff(error, items) {
      var target = getInvalidState();
      var data = normalizeSameNameOptions({
        projectId: target.projectId,
        versionId: target.versionId,
        fileName: target.fileName,
        items: items,
        error: error,
        source: target.source || extFromFileName(target.fileName),
      });
      if (invalidDrawerInstance && typeof invalidDrawerInstance.close === 'function') invalidDrawerInstance.close();
      openDiffLoading({
        fileName: data.fileName,
        cleanName: data.cleanName,
        importedCleanName: data.importedCleanName,
        projectId: data.projectId,
        importVersionId: data.versionId,
        source: data.source,
      });
      loadSameNameDiff(data).catch(function(loadError) {
        view.setDiffStatus(loadError && loadError.message ? loadError.message : '打开差异对比失败', 'err');
        view.setInvalidStatus('入库失败：' + (error && error.message ? error.message : '导入失败'), 'err');
      });
    }

    function executeInvalidImport(items, pendingStructuralCount) {
      var target = getInvalidState();
      target.loading = true;
      view.syncInvalidControls(target);
      view.setInvalidStatus('校验通过，入库中...', '');
      return apiClient.importCaseFile({
        project_id: target.projectId,
        version_id: target.versionId,
        file_name: target.fileName,
        source: target.source || extFromFileName(target.fileName),
        items: sanitizeItems(items),
      }).then(function() {
        var message = '入库成功：' + cleanFileName(target.fileName);
        if (pendingStructuralCount) message += '（已跳过字段层级不足 ' + pendingStructuralCount + ' 条）';
        view.setInvalidStatus(message, 'ok');
        setStatus(dom.importStatus, message, 'ok');
        setStatus(dom.status, message, 'ok');
        refreshCaseFiles(target.projectId);
        var file = target.file;
        if (invalidDrawerInstance && typeof invalidDrawerInstance.close === 'function') invalidDrawerInstance.close();
        removeImportedInvalidFile(file);
        return true;
      }).catch(function(error) {
        var message = error && error.message ? error.message : '导入失败';
        view.setInvalidStatus('入库失败：' + message, 'err');
        setStatus(dom.importStatus, '入库失败：' + message, 'err');
        var payload = error && error.payload ? error.payload : null;
        if (message.indexOf('同名') !== -1 || (payload && payload.existing_case_file_id)) {
          openInvalidConflictDiff(error, items);
        }
        return false;
      }).finally(function() {
        target.loading = false;
        view.syncInvalidControls(target);
      });
    }

    function confirmInvalid() {
      var target = getInvalidState();
      if (target.loading) return Promise.resolve(false);
      if (!apiClient || typeof apiClient.importCaseFile !== 'function') {
        view.setInvalidStatus('后端导入接口未就绪', 'err');
        return Promise.resolve(false);
      }
      if (!target.projectId || !target.versionId || !target.items.length) {
        if (target.structuralErrors.length) {
          view.setInvalidStatus('无可入库用例：字段层级不足 ' + target.structuralErrors.length + ' 条，请在 XMind 中补齐后重新导入', 'warn');
        } else {
          view.setInvalidStatus('导入数据未就绪，请关闭后重新导入', 'warn');
        }
        return Promise.resolve(false);
      }
      var selection = selectImportableInvalidItems();
      if (selection.invalidNonStructural.length) {
        view.renderInvalidTable(target);
        view.setInvalidStatus('仍有 ' + selection.invalidNonStructural.length + ' 条用例必填字段为空，请修改后再确认', 'warn');
        return Promise.resolve(false);
      }
      if (!selection.items.length) {
        view.setInvalidStatus('无可入库用例：字段层级不足 ' +
          (selection.pendingStructuralCount || target.structuralErrors.length) + ' 条，请补齐后再入库', 'warn');
        return Promise.resolve(false);
      }
      var duplicate = buildDuplicateGroups(selection.items);
      if (!duplicate.duplicateCount) return executeInvalidImport(selection.items, selection.pendingStructuralCount);
      return confirmDuplicates({
        fileName: target.fileName,
        total: selection.items.length,
        uniqueCount: duplicate.uniqueItems.length,
        duplicateCount: duplicate.duplicateCount,
        rows: duplicate.rows,
      }).then(function(confirmed) {
        if (!confirmed) {
          view.setInvalidStatus('已取消入库（包含重复条目）', 'warn');
          return false;
        }
        target.items = duplicate.uniqueItems;
        return executeInvalidImport(duplicate.uniqueItems, selection.pendingStructuralCount);
      });
    }

    function shouldKeepDiffOpen() {
      var queue = getDiffState().queue;
      return Boolean(queue && queue.active && Number(queue.total) > 0 && Number(queue.index) < Number(queue.total) - 1);
    }

    function closeDiffUnlessQueued() {
      if (!shouldKeepDiffOpen() && diffDrawerInstance && typeof diffDrawerInstance.close === 'function') {
        diffDrawerInstance.close();
      }
    }

    function confirmAppendOverwrite(diffState) {
      if (!diffState.caseFileId || !diffState.importItems.length) {
        view.setDiffStatus('差异数据未就绪，请稍后重试', 'warn');
        return Promise.resolve(false);
      }
      diffState.confirming = false;
      diffState.loading = true;
      view.syncDiffControls(diffState);
      view.setDiffStatus('覆盖并追加入库中...', '');
      return apiClient.appendCaseItems(diffState.caseFileId, {
        items: diffState.importItems,
        overwrite_existing: true,
      }).then(function(result) {
        var appended = Number(result && (result.appended || result.appended_count)) || 0;
        var overwritten = Number(result && (result.overwritten || result.overwritten_count)) || 0;
        view.setDiffStatus('追加入库成功：新增 ' + appended + ' 条，覆盖 ' + overwritten + ' 条', 'ok');
        resolveExternal({ ok: true, overwrite: true, result: result || null });
        closeDiffUnlessQueued();
        return true;
      }).catch(function(error) {
        view.setDiffStatus('追加入库失败：' + (error && error.message ? error.message : '追加入库失败'), 'err');
        resolveExternal({ ok: false, reason: 'append_overwrite_failed', error: error || null });
        return false;
      }).finally(function() {
        diffState.loading = false;
        view.syncDiffControls(diffState);
      });
    }

    function confirmImportOverwrite(diffState) {
      var projectId = diffState.projectId;
      var versionId = diffState.importVersionId;
      var originalFileName = diffState.fileName || '';
      var cleanName = diffState.cleanName || originalFileName || '用例';
      var extension = (String(originalFileName).split('.').pop() || '').toLowerCase();
      if (!extension || extension === String(originalFileName).toLowerCase()) extension = 'xmind';
      var overwriteFileName = String(diffState.cleanName || cleanFileName(originalFileName) || 'case') + '.' + extension;
      if (!projectId || !versionId || !overwriteFileName || !diffState.importItems.length) {
        view.setDiffStatus('差异数据未就绪，请稍后重试', 'warn');
        return Promise.resolve(false);
      }
      diffState.confirming = true;
      view.syncDiffControls(diffState);
      return openConfirmDrawer({
        title: '确认覆盖导入',
        message: '是否确认覆盖导入用例：' + cleanName + '？',
        confirmText: '确认覆盖导入',
        cancelText: '取消',
        previousDrawer: diffDrawerInstance,
      }).then(function(result) {
        diffState.confirming = false;
        view.syncDiffControls(diffState);
        if (!result || result.ok !== true) return false;
        diffState.loading = true;
        view.syncDiffControls(diffState);
        view.setDiffStatus('覆盖导入中...', '');
        setStatus(dom.importStatus, '覆盖导入中...', '');
        return apiClient.importCaseFile({
          project_id: projectId,
          version_id: versionId,
          file_name: overwriteFileName,
          source: diffState.source || extFromFileName(originalFileName),
          items: diffState.importItems,
        }, { overwrite: true }).then(function(caseFile) {
          var message = '覆盖导入成功：' + cleanName;
          view.setDiffStatus(message, 'ok');
          setStatus(dom.importStatus, message, 'ok');
          setStatus(dom.status, message, 'ok');
          refreshCaseFiles(projectId);
          resolveExternal({ ok: true, overwrite: true, caseFile: caseFile || null });
          closeDiffUnlessQueued();
          return true;
        }).catch(function(error) {
          var message = error && error.message ? error.message : '覆盖导入失败';
          view.setDiffStatus('覆盖导入失败：' + message, 'err');
          setStatus(dom.importStatus, '覆盖导入失败：' + message, 'err');
          resolveExternal({ ok: false, reason: 'overwrite_failed', error: error || null });
          return false;
        }).finally(function() {
          diffState.loading = false;
          view.syncDiffControls(diffState);
        });
      });
    }

    function confirmOverwrite() {
      var diffState = getDiffState();
      if (diffState.loading || diffState.confirming) return Promise.resolve(false);
      var appendMode = diffState.mode === 'append_overwrite';
      var ready = apiClient && (appendMode
        ? typeof apiClient.appendCaseItems === 'function'
        : typeof apiClient.importCaseFile === 'function');
      if (!ready) {
        view.setDiffStatus(appendMode ? '后端追加接口未就绪' : '后端导入接口未就绪', 'err');
        return Promise.resolve(false);
      }
      return appendMode ? confirmAppendOverwrite(diffState) : confirmImportOverwrite(diffState);
    }

    function handleDiffClose() {
      if (diffOpenTimer) {
        clearTimeout(diffOpenTimer);
        diffOpenTimer = 0;
      }
      resolveExternal({ ok: false, reason: 'closed' });
      var diffState = getDiffState();
      diffState.mode = 'import';
      diffState.caseFileId = null;
      diffState.confirming = false;
      view.resetDiff();
    }

    function initDrawers() {
      var hasDiff = typeof document !== 'undefined' && document.getElementById('caseLibraryImportDiffDrawer');
      var hasInvalid = typeof document !== 'undefined' && document.getElementById('caseLibraryImportInvalidDrawer');
      if (hasDiff && !diffDrawerInstance) {
        diffDrawerInstance = ensureDrawer('caseLibraryImportDiffDrawer', [], function() {}, handleDiffClose);
      }
      if (hasInvalid && !invalidDrawerInstance) {
        invalidDrawerInstance = ensureDrawer('caseLibraryImportInvalidDrawer', [], function() {}, resetInvalidState);
      }
      return Boolean(diffDrawerInstance || invalidDrawerInstance);
    }

    function bindEvents() {
      if (bound) return;
      bound = true;
      if (dom.importDiffOverwriteBtn) dom.importDiffOverwriteBtn.addEventListener('click', confirmOverwrite);
      if (dom.importInvalidConfirmBtn) dom.importInvalidConfirmBtn.addEventListener('click', confirmInvalid);
      view.bindInvalidEvents(getInvalidState, function(index, field, value) {
        var item = getInvalidState().items[index];
        if (item) item[field] = value;
      });
    }

    function startQueue(total) {
      var queue = getDiffState().queue;
      queue.active = true;
      queue.total = Math.max(0, Number(total) || 0);
      queue.index = -1;
    }

    function setQueueIndex(index) {
      var queue = getDiffState().queue;
      if (queue.active) queue.index = Number(index) || 0;
    }

    function finishQueue() {
      var queue = getDiffState().queue;
      queue.active = false;
      queue.index = -1;
    }

    return {
      getDiffState: getDiffState,
      getInvalidState: getInvalidState,
      initDrawers: initDrawers,
      bindEvents: bindEvents,
      openInvalid: openInvalid,
      confirmInvalid: confirmInvalid,
      buildDuplicateGroups: buildDuplicateGroups,
      confirmDuplicates: confirmDuplicates,
      openDiff: openDiff,
      openDiffLoading: openDiffLoading,
      openImportDiffForExternal: openImportDiffForExternal,
      openAppendDiffForExternal: openAppendDiffForExternal,
      openDiffForQueueTask: openDiffForQueueTask,
      confirmOverwrite: confirmOverwrite,
      startQueue: startQueue,
      setQueueIndex: setQueueIndex,
      finishQueue: finishQueue,
    };
  }

  return { create: create };
});
