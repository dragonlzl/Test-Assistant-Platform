(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenResultDeliveryController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var state = opts.state || {};
    var casesGenApi = opts.casesGenApi || {};
    var documentObj = opts.documentObj || (typeof document !== 'undefined' ? document : null);
    var normalizeModuleTitle = port('normalizeModuleTitle', function(value) { return String(value || '').trim(); });
    var normalizeModuleKey = port('normalizeModuleKey', function(value) { return String(value || '').trim().toLowerCase(); });
    var normalizeCaseItem = port('normalizeCaseItem', function(value) { return value || null; });
    var buildCaseSignature = port('buildCaseSignature', function(item) { return String(item && item.title || ''); });
    var buildDeleteTargetKey = port('buildDeleteTargetKey', function(value) { return JSON.stringify(value || {}); });
    var hasImportedBaselineCases = port('hasImportedBaselineCases', function() { return false; });
    var buildVisibleModuleContext = port('buildVisibleModuleContext', function() { return { list: [] }; });
    var getVisibleCasesForModuleEntry = port('getVisibleCasesForModuleEntry', function() { return []; });
    var getAiCasesForModule = port('getAiCasesForModule', function() { return []; });
    var hasAnyRunningGenerationOperation = port('hasAnyRunningGenerationOperation', function() { return false; });
    var notifyFloatingStatus = port('notifyFloatingStatus');
    var notifyStatus = port('notifyStatus');
    var notifySuccessToast = port('notifySuccessToast');
    var render = port('render');
    var isDrawerOpen = port('isDrawerOpen', function() { return false; });
    var openStoreConfirmDialog = port('openStoreConfirmDialog', function() { return Promise.resolve(true); });
    var getActiveWorkspaceId = port('getActiveWorkspaceId', function() { return ''; });
    var resetXmindCasegenState = port('resetXmindCasegenState', function() { return false; });
    var deleteWorkspace = port('deleteWorkspace', function() { return false; });
    var getXmindCoreApi = port('getXmindCoreApi', function() { return null; });
    var getXmindMarkdownExportCoreApi = port('getXmindMarkdownExportCoreApi', function() { return null; });
    var getCurrentMindData = port('getCurrentMindData', function() { return null; });
    var getRequirementLabelText = port('getRequirementLabelText', function() { return ''; });
    var buildVisibleModuleSnapshot = port('buildVisibleModuleSnapshot', function() { return []; });
    var downloadBlob = typeof opts.downloadBlob === 'function' ? opts.downloadBlob : null;
    var downloadText = typeof opts.downloadText === 'function' ? opts.downloadText : null;
    var createTextBlob = typeof opts.createTextBlob === 'function'
      ? opts.createTextBlob
      : function(content) {
        if (typeof Blob === 'undefined') return null;
        return new Blob([content], { type: 'text/markdown;charset=utf-8' });
      };
    var setTimer = port('setTimeout', function(handler, delay) { return setTimeout(handler, delay); });
    var clearTimer = port('clearTimeout', function(timer) { clearTimeout(timer); });
    var storeValidationClearTimer = 0;
    var storeValidationState = {
      moduleKeys: {},
      caseKeys: {},
    };

    function clearStoreValidationState(skipRender) {
      var hadMarks = Object.keys(storeValidationState.moduleKeys || {}).length > 0
        || Object.keys(storeValidationState.caseKeys || {}).length > 0;
      if (storeValidationClearTimer) {
        clearTimer(storeValidationClearTimer);
        storeValidationClearTimer = 0;
      }
      storeValidationState = {
        moduleKeys: {},
        caseKeys: {},
      };
      if (hadMarks && skipRender !== true && isDrawerOpen()) {
        render({ reason: 'store-validation-clear', persist: false });
      }
    }

    function setStoreValidationState(moduleKeys, caseKeys) {
      clearStoreValidationState(true);
      storeValidationState = {
        moduleKeys: {},
        caseKeys: {},
      };
      (Array.isArray(moduleKeys) ? moduleKeys : []).forEach(function(key) {
        var stableKey = String(key || '').trim();
        if (stableKey) storeValidationState.moduleKeys[stableKey] = true;
      });
      (Array.isArray(caseKeys) ? caseKeys : []).forEach(function(key) {
        var stableKey = String(key || '').trim();
        if (stableKey) storeValidationState.caseKeys[stableKey] = true;
      });
      if (Object.keys(storeValidationState.moduleKeys).length || Object.keys(storeValidationState.caseKeys).length) {
        if (isDrawerOpen()) render({ reason: 'store-validation-mark', persist: false });
        storeValidationClearTimer = setTimer(function() {
          storeValidationClearTimer = 0;
          clearStoreValidationState(false);
        }, 5000);
      }
    }

    function isInvalidStoreModuleMeta(meta) {
      if (!meta || meta.type !== 'module') return false;
      return Boolean(storeValidationState.moduleKeys[String(meta.moduleKey || '')]);
    }

    function isInvalidStoreCaseMeta(meta) {
      if (!meta || meta.type !== 'case') return false;
      return Boolean(storeValidationState.caseKeys[buildDeleteTargetKey(meta)]);
    }

    function getStoreValidationSignature() {
      return {
        modules: Object.keys(storeValidationState.moduleKeys || {}).filter(function(key) {
          return storeValidationState.moduleKeys[key] === true;
        }).sort(),
        cases: Object.keys(storeValidationState.caseKeys || {}).filter(function(key) {
          return storeValidationState.caseKeys[key] === true;
        }).sort(),
      };
    }

    function getImportedCaseEntries() {
      return Array.isArray(state.importedCases) ? state.importedCases.filter(Boolean) : [];
    }

    function resolveImportedBaselineOrigin() {
      if (!hasImportedBaselineCases()) {
        return {
          hasBaseline: false,
          sourceType: 'none',
          entries: [],
          targets: [],
        };
      }
      var entries = getImportedCaseEntries().filter(function(item) {
        return item && Array.isArray(item.list) && item.list.length > 0;
      });
      var allLibrary = entries.length > 0 && entries.every(function(item) {
        var meta = item && item.meta && typeof item.meta === 'object' ? item.meta : null;
        return Boolean(meta && meta.sourceType === 'case-library-select' && meta.caseFileId);
      });
      var seenTargets = {};
      var targets = [];
      if (allLibrary) {
        entries.forEach(function(item) {
          var meta = item && item.meta && typeof item.meta === 'object' ? item.meta : {};
          var targetKey = [
            String(meta.projectId || ''),
            String(meta.versionId || ''),
            String(meta.caseFileId || '')
          ].join('::');
          if (!meta.caseFileId || seenTargets[targetKey]) return;
          seenTargets[targetKey] = true;
          targets.push({
            projectId: meta.projectId ? Number(meta.projectId) : null,
            versionId: meta.versionId ? Number(meta.versionId) : null,
            caseFileId: meta.caseFileId ? Number(meta.caseFileId) : null,
            fileName: meta.fileName ? String(meta.fileName || '') : String(item.name || ''),
          });
        });
      }
      return {
        hasBaseline: true,
        sourceType: allLibrary ? 'case-library-select' : 'external-import',
        entries: entries,
        targets: targets,
      };
    }

    function createStoreScopeEntry(moduleKey, moduleId, moduleTitle, rows) {
      return {
        moduleKey: String(moduleKey || ''),
        moduleId: moduleId ? String(moduleId || '') : '',
        moduleTitle: normalizeModuleTitle(moduleTitle || '未命名模块'),
        rows: Array.isArray(rows) ? rows.slice() : [],
      };
    }

    function buildVisibleStoreScopeEntries() {
      var context = buildVisibleModuleContext() || {};
      return (Array.isArray(context.list) ? context.list : []).map(function(entry) {
        return createStoreScopeEntry(
          entry.moduleKey,
          entry.aiModuleId || '',
          entry.title,
          getVisibleCasesForModuleEntry(entry)
        );
      });
    }

    function buildAiStoreScopeEntries() {
      return (Array.isArray(state.caseGenModules) ? state.caseGenModules : []).map(function(mod, index) {
        var moduleTitle = normalizeModuleTitle(mod && (mod.title || mod.module) || ('模块' + String(index + 1)));
        var moduleId = mod && mod.id ? String(mod.id || '') : '';
        var rows = getAiCasesForModule(moduleId).map(function(item, caseIndex) {
          return {
            source: 'ai',
            sourceIndex: caseIndex,
            caseSignature: buildCaseSignature(item, moduleTitle),
            item: item,
          };
        });
        return createStoreScopeEntry(normalizeModuleKey(moduleTitle), moduleId, moduleTitle, rows);
      }).filter(function(entry) {
        return Boolean(entry && entry.moduleKey);
      });
    }

    function buildStoreCaseItemFromRow(row, moduleTitle) {
      var normalized = normalizeCaseItem(row && row.item ? row.item : row, moduleTitle);
      if (!normalized) return null;
      return {
        module: normalized.module,
        title: normalized.title,
        priority: normalized.priority,
        precondition: String(normalized.preconditions || '').trim(),
        steps: Array.isArray(normalized.steps) ? normalized.steps.join('\n').trim() : '',
        expected: String(normalized.expected || '').trim(),
        remark: null,
      };
    }

    function buildStoreCaseKey(entry, row) {
      var item = row && row.item ? row.item : row;
      return buildDeleteTargetKey({
        type: 'case',
        moduleKey: entry && entry.moduleKey ? entry.moduleKey : normalizeModuleKey(entry && entry.moduleTitle ? entry.moduleTitle : ''),
        moduleTitle: entry && entry.moduleTitle ? entry.moduleTitle : '',
        caseTitle: item && item.title ? String(item.title || '') : '',
        caseSource: row && row.source ? String(row.source || '') : 'ai',
        caseSourceIndex: row && Number.isFinite(Number(row.sourceIndex)) ? Number(row.sourceIndex) : 0,
        caseSignature: row && row.caseSignature ? String(row.caseSignature || '') : buildCaseSignature(item, entry && entry.moduleTitle ? entry.moduleTitle : ''),
      });
    }

    function validateStoreCaseItem(item) {
      if (!item || typeof item !== 'object') return false;
      var stepsText = String(item.steps || '').trim();
      if (!String(item.module || '').trim()) return false;
      if (!String(item.title || '').trim()) return false;
      if (!String(item.priority || '').trim()) return false;
      if (!String(item.precondition || '').trim()) return false;
      if (!stepsText) return false;
      if (!String(item.expected || '').trim()) return false;
      var steps = stepsText.split(/\n+/).map(function(text) { return String(text || '').trim(); }).filter(Boolean);
      if (!steps.length) return false;
      return steps.every(function(step, index) {
        return new RegExp('^' + String(index + 1) + '、').test(step);
      });
    }

    function validateStoreScopeEntries(entries) {
      var result = {
        items: [],
        missingModules: [],
        invalidCaseKeys: [],
      };
      (Array.isArray(entries) ? entries : []).forEach(function(entry) {
        var rows = Array.isArray(entry && entry.rows) ? entry.rows : [];
        if (!rows.length) {
          if (entry && entry.moduleKey) {
            result.missingModules.push({
              moduleKey: String(entry.moduleKey || ''),
              moduleTitle: entry.moduleTitle || '未命名模块',
            });
          }
          return;
        }
        rows.forEach(function(row) {
          var item = buildStoreCaseItemFromRow(row, entry.moduleTitle);
          if (!validateStoreCaseItem(item)) {
            result.invalidCaseKeys.push(buildStoreCaseKey(entry, row));
            return;
          }
          result.items.push(item);
        });
      });
      return result;
    }

    function resolveDefaultStoreNewAction() {
      var select = documentObj && documentObj.getElementById
        ? documentObj.getElementById('caseGenStoreActionSelect')
        : null;
      var value = select && select.value ? String(select.value || '') : '';
      return value || 'store';
    }

    function buildStoreValidationMessage(validation) {
      var parts = [];
      var missingCount = Array.isArray(validation && validation.missingModules) ? validation.missingModules.length : 0;
      var invalidCount = Array.isArray(validation && validation.invalidCaseKeys) ? validation.invalidCaseKeys.length : 0;
      if (missingCount > 0) {
        parts.push('仍有 ' + String(missingCount) + ' 个模块未生成用例');
      }
      if (invalidCount > 0) {
        parts.push('有 ' + String(invalidCount) + ' 条用例格式不符合入库要求');
      }
      return parts.length ? ('请先处理后再保存入库：' + parts.join('；')) : '当前内容暂时不能入库';
    }

    function validateAndMarkStoreScope(entries) {
      var validation = validateStoreScopeEntries(entries);
      if (validation.missingModules.length || validation.invalidCaseKeys.length) {
        setStoreValidationState(
          validation.missingModules.map(function(item) { return item && item.moduleKey ? item.moduleKey : ''; }),
          validation.invalidCaseKeys
        );
        notifyFloatingStatus(buildStoreValidationMessage(validation), 'warn', 5000);
        return null;
      }
      clearStoreValidationState(true);
      return validation;
    }

    async function handleStoreToLibrary() {
      if (hasAnyRunningGenerationOperation()) {
        notifyFloatingStatus('当前仍有生成任务进行中，请等待完成后再保存入库', 'warn', 5000);
        return false;
      }
      var origin = resolveImportedBaselineOrigin();
      var usesAppendStore = origin.hasBaseline && origin.sourceType === 'case-library-select';
      var scopeEntries = usesAppendStore ? buildAiStoreScopeEntries() : buildVisibleStoreScopeEntries();
      var validation = validateAndMarkStoreScope(scopeEntries);
      if (!validation) return false;
      if (!validation.items.length) {
        notifyFloatingStatus(
          usesAppendStore ? '当前没有新增生成的用例可追加入库' : '当前没有可入库的用例，请先完成生成',
          'warn',
          5000
        );
        return false;
      }
      if (!casesGenApi) {
        notifyFloatingStatus('入库能力未就绪，请刷新后重试', 'err', 5000);
        return false;
      }
      if (!usesAppendStore) {
        if (typeof casesGenApi.openCaseGenDbStoreNewDrawerWithItems !== 'function') {
          notifyFloatingStatus('新用例入库能力未就绪，请刷新后重试', 'err', 5000);
          return false;
        }
        casesGenApi.openCaseGenDbStoreNewDrawerWithItems(validation.items, {
          newAction: resolveDefaultStoreNewAction(),
          source: 'xmind_casegen',
          workspaceId: getActiveWorkspaceId(),
        });
        return true;
      }

      if (origin.targets.length !== 1) {
        var fallbackEntries = buildVisibleStoreScopeEntries();
        var fallbackValidation = validateAndMarkStoreScope(fallbackEntries);
        if (!fallbackValidation || !fallbackValidation.items.length) return false;
        notifyFloatingStatus('当前基线来自多份用例库用例，将按新用例入库处理', 'warn', 5000);
        if (typeof casesGenApi.openCaseGenDbStoreNewDrawerWithItems !== 'function') {
          notifyFloatingStatus('新用例入库能力未就绪，请刷新后重试', 'err', 5000);
          return false;
        }
        casesGenApi.openCaseGenDbStoreNewDrawerWithItems(fallbackValidation.items, {
          newAction: resolveDefaultStoreNewAction(),
          source: 'xmind_casegen',
          workspaceId: getActiveWorkspaceId(),
        });
        return true;
      }

      var target = origin.targets[0] || {};
      var confirmed = await openStoreConfirmDialog({
        title: '确认保存入库',
        message: '当前参考用例来自用例库。确认后会把本次新增生成的用例保存到【'
          + String(target.fileName || ('用例#' + String(target.caseFileId || '')))
          + '】。',
        confirmText: '继续保存',
        cancelText: '取消',
      });
      if (!confirmed) return false;
      if (typeof casesGenApi.openCaseGenDbStoreAppendDrawerWithItems !== 'function') {
        notifyFloatingStatus('旧用例追加入库能力未就绪，请刷新后重试', 'err', 5000);
        return false;
      }
      casesGenApi.openCaseGenDbStoreAppendDrawerWithItems(validation.items, {
        source: 'xmind_casegen',
        workspaceId: getActiveWorkspaceId(),
        projectId: target.projectId,
        versionId: target.versionId,
        caseFileId: target.caseFileId,
      });
      return true;
    }

    function resetAfterStoreSuccess(optionsValue) {
      var options = optionsValue || {};
      var activeWorkspaceId = getActiveWorkspaceId();
      var targetWorkspaceId = String(options.workspaceId || activeWorkspaceId || '');
      var shouldCloseWorkspace = options.closeWorkspace === true;
      var didReset = false;
      var didClose = false;
      var shouldResetCurrentWorkspace = !shouldCloseWorkspace && (!targetWorkspaceId || targetWorkspaceId === activeWorkspaceId);
      if (shouldResetCurrentWorkspace) {
        didReset = resetXmindCasegenState({
          reason: 'store-success-reset',
          reopenPrepDialog: false,
          toastText: '',
          silentBlocked: true,
        }) === true;
      }
      if (shouldCloseWorkspace && targetWorkspaceId) {
        didClose = deleteWorkspace(targetWorkspaceId, {
          skipConfirm: true,
        }) === true;
      }
      if (options.showToast === true) {
        notifySuccessToast(
          String(options.toastText || (didClose ? '入库并关闭页签成功' : '用例入库成功')),
          options.toastDurationMs || (didClose ? 5000 : 3000)
        );
      }
      return didReset || didClose;
    }

    async function exportCurrentXmind() {
      var xmindCoreApi = getXmindCoreApi();
      if (!xmindCoreApi || typeof xmindCoreApi.buildXmindPackageFromMindData !== 'function') {
        notifyStatus('当前 XMind 导出能力未就绪', 'warn', { forceInline: true });
        return false;
      }
      var mindData = getCurrentMindData();
      try {
        var exported = await xmindCoreApi.buildXmindPackageFromMindData(mindData, getRequirementLabelText());
        if (downloadBlob) downloadBlob(exported.fileName, exported.blob);
        notifyStatus('已导出当前 XMind：' + exported.fileName, 'ok');
        return true;
      } catch (err) {
        notifyStatus('XMind 导出失败：' + (err && err.message ? err.message : '未知错误'), 'err', { forceInline: true });
        return false;
      }
    }

    function exportCurrentMarkdown() {
      var markdownCoreApi = getXmindMarkdownExportCoreApi();
      if (!markdownCoreApi || typeof markdownCoreApi.buildMarkdownExportFromSnapshot !== 'function') {
        notifyStatus('当前 Markdown 导出能力未就绪', 'warn', { forceInline: true });
        return false;
      }
      var visibleModules = buildVisibleModuleSnapshot(buildVisibleModuleContext());
      if (!visibleModules.length) {
        notifyStatus('当前没有可导出的模块，请先完成生成', 'warn', { forceInline: true });
        return false;
      }
      var exported = null;
      try {
        exported = markdownCoreApi.buildMarkdownExportFromSnapshot({
          requirementLabel: getRequirementLabelText(),
          modules: visibleModules,
          exportedAt: Date.now(),
        });
      } catch (err) {
        notifyStatus('Markdown 导出失败：' + (err && err.message ? err.message : '未知错误'), 'err', { forceInline: true });
        return false;
      }
      if (!exported || !exported.fileName || !exported.content) {
        notifyStatus('Markdown 导出失败：导出结果无效', 'err', { forceInline: true });
        return false;
      }
      if (downloadText) {
        downloadText(exported.fileName, exported.content);
      } else if (downloadBlob) {
        var blob = createTextBlob(exported.content);
        if (!blob) {
          notifyStatus('当前 Markdown 下载能力未就绪', 'warn', { forceInline: true });
          return false;
        }
        downloadBlob(exported.fileName, blob);
      } else {
        notifyStatus('当前 Markdown 下载能力未就绪', 'warn', { forceInline: true });
        return false;
      }
      notifyStatus('已导出 AI Markdown：' + exported.fileName, 'ok');
      return true;
    }

    return {
      buildAiStoreScopeEntries: buildAiStoreScopeEntries,
      buildStoreCaseItemFromRow: buildStoreCaseItemFromRow,
      buildStoreCaseKey: buildStoreCaseKey,
      buildStoreValidationMessage: buildStoreValidationMessage,
      buildVisibleStoreScopeEntries: buildVisibleStoreScopeEntries,
      clearStoreValidationState: clearStoreValidationState,
      createStoreScopeEntry: createStoreScopeEntry,
      exportCurrentMarkdown: exportCurrentMarkdown,
      exportCurrentXmind: exportCurrentXmind,
      getImportedCaseEntries: getImportedCaseEntries,
      getStoreValidationSignature: getStoreValidationSignature,
      handleStoreToLibrary: handleStoreToLibrary,
      isInvalidStoreCaseMeta: isInvalidStoreCaseMeta,
      isInvalidStoreModuleMeta: isInvalidStoreModuleMeta,
      resetAfterStoreSuccess: resetAfterStoreSuccess,
      resolveDefaultStoreNewAction: resolveDefaultStoreNewAction,
      resolveImportedBaselineOrigin: resolveImportedBaselineOrigin,
      setStoreValidationState: setStoreValidationState,
      validateAndMarkStoreScope: validateAndMarkStoreScope,
      validateStoreCaseItem: validateStoreCaseItem,
      validateStoreScopeEntries: validateStoreScopeEntries,
    };
  }

  return { create: create };
});
