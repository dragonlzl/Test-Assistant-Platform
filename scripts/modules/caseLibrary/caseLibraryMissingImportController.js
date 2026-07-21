(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.missingImportController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var apiClient = opts.apiClient || null;
    var model = opts.model || null;
    var fileParser = opts.fileParser || null;
    var view = opts.view || null;
    if (!model || !fileParser || !view) throw new Error('Missing import owners are required');

    var normalizeId = typeof opts.normalizeId === 'function' ? opts.normalizeId : function(value) { return value || null; };
    var buildCaseItemKey = typeof opts.buildCaseItemKey === 'function' ? opts.buildCaseItemKey : function() { return ''; };
    var buildImportDiffRows = typeof opts.buildImportDiffRows === 'function' ? opts.buildImportDiffRows : function() { return []; };
    var ensureDrawer = typeof opts.ensureDrawer === 'function' ? opts.ensureDrawer : function() { return null; };
    var syncProjectOptions = typeof opts.syncProjectOptions === 'function' ? opts.syncProjectOptions : function() {};
    var onProjectChange = typeof opts.onProjectChange === 'function' ? opts.onProjectChange : function() {};
    var reloadModules = typeof opts.reloadModules === 'function' ? opts.reloadModules : function() {};
    var diffDrawerInstance = null;
    var bound = false;

    function getImportState() {
      if (!state.missingImport || typeof state.missingImport !== 'object') {
        state.missingImport = {
          projectId: null,
          files: [],
          items: [],
          structuralErrors: [],
          loading: false,
          pending: false,
          invalid: [],
        };
      }
      return state.missingImport;
    }

    function getDiffState() {
      if (!state.missingImportDiff || typeof state.missingImportDiff !== 'object') {
        state.missingImportDiff = {
          projectId: null,
          rows: [],
          newItems: [],
          duplicateCount: 0,
          pendingItemsByModule: [],
          structuralErrors: [],
        };
      }
      return state.missingImportDiff;
    }

    function syncConfirmEnabled() {
      view.syncConfirmEnabled(getImportState());
    }

    function prepareProjectOptions() {
      syncProjectOptions(dom.missingImportProjectSelect, '请选择项目');
      view.setProjectValue(getImportState().projectId);
      syncConfirmEnabled();
    }

    function setProjectId(projectId) {
      var target = getImportState();
      target.projectId = projectId || null;
      view.setProjectValue(target.projectId);
      syncConfirmEnabled();
      return target.projectId;
    }

    function getProjectId() {
      return getImportState().projectId || null;
    }

    function reset() {
      var target = getImportState();
      target.projectId = null;
      target.files = [];
      target.items = [];
      target.structuralErrors = [];
      target.loading = false;
      target.pending = false;
      target.invalid = [];
      view.setImportStatus('', '');
      view.renderFileHint(target);
      syncProjectOptions(dom.missingImportProjectSelect, '请选择项目');
      view.setProjectValue(null);
      syncConfirmEnabled();
    }

    function handleFiles(files) {
      var list = Array.from(files || []).filter(Boolean);
      var target = getImportState();
      if (!list.length) {
        target.files = [];
        target.items = [];
        target.structuralErrors = [];
        target.invalid = [];
        view.renderFileHint(target);
        syncConfirmEnabled();
        view.setImportStatus('', '');
        return Promise.resolve(null);
      }
      target.files = list;
      target.items = [];
      target.structuralErrors = [];
      target.invalid = [];
      target.loading = true;
      view.renderFileHint(target);
      syncConfirmEnabled();
      view.setImportStatus('解析导入文件中...', '');

      var tasks = list.map(function(file) {
        return fileParser.parse(file).then(
          function(result) { return { file: file, result: result || {} }; },
          function(err) {
            return {
              file: file,
              result: {
                items: [],
                structuralErrors: [],
                error: err && err.message ? err.message : '解析失败',
              },
            };
          }
        );
      });

      return Promise.all(tasks).then(function(results) {
        var summary = model.buildParseSummary(results);
        target.items = summary.items;
        target.structuralErrors = summary.structuralErrors;
        target.invalid = summary.invalid;
        view.setImportStatus(summary.statusText, summary.statusType);
        return summary;
      }).catch(function(err) {
        target.items = [];
        target.structuralErrors = [];
        target.invalid = [];
        view.setImportStatus(err && err.message ? err.message : '导入解析失败', 'err');
        return null;
      }).finally(function() {
        target.loading = false;
        syncConfirmEnabled();
      });
    }

    function handleProjectChange() {
      var projectId = normalizeId(view.getProjectValue());
      setProjectId(projectId);
      onProjectChange(projectId);
    }

    function resetDiffState() {
      var target = getDiffState();
      target.projectId = null;
      target.rows = [];
      target.newItems = [];
      target.duplicateCount = 0;
      target.pendingItemsByModule = [];
      target.structuralErrors = [];
      return target;
    }

    function ensureDiffDrawer() {
      if (diffDrawerInstance) return diffDrawerInstance;
      diffDrawerInstance = ensureDrawer(
        'caseLibraryMissingImportDiffDrawer',
        [],
        null,
        function() {
          getImportState().pending = false;
          resetDiffState();
          view.clearDiff();
          syncConfirmEnabled();
        }
      );
      return diffDrawerInstance;
    }

    function openDiff(payload) {
      var drawer = ensureDiffDrawer();
      if (!drawer) return;
      var data = payload && typeof payload === 'object' ? payload : {};
      var target = getDiffState();
      target.projectId = data.projectId || null;
      target.rows = data.rows || [];
      target.newItems = data.newItems || [];
      target.duplicateCount = data.duplicateCount || 0;
      target.pendingItemsByModule = data.pendingItemsByModule || [];
      target.structuralErrors = Array.isArray(data.structuralErrors) ? data.structuralErrors : [];
      view.renderDiffSummary(target, data);
      if (typeof drawer.open === 'function') drawer.open();
    }

    function closeDiffDrawer() {
      if (diffDrawerInstance && typeof diffDrawerInstance.close === 'function') diffDrawerInstance.close();
    }

    function createModuleItems(moduleId, items) {
      var list = Array.isArray(items) ? items.slice() : [];
      if (!list.length) return Promise.resolve([]);
      if (!apiClient || typeof apiClient.createMissingModuleItem !== 'function') {
        return Promise.reject(new Error('易漏条目接口未就绪'));
      }
      return list.reduce(function(chain, item) {
        return chain.then(function() {
          return apiClient.createMissingModuleItem(moduleId, {
            title: item.title || '',
            priority: item.priority || null,
            precondition: item.precondition || '',
            steps: item.steps || '',
            expected: item.expected || '',
            remark: item.remark || null,
          });
        });
      }, Promise.resolve([]));
    }

    function executeMerge(payload) {
      if (!payload || !payload.pendingItemsByModule) return Promise.resolve(false);
      var projectId = payload.projectId;
      var entries = payload.pendingItemsByModule;
      var totalNewModules = 0;
      var totalNewItems = 0;
      var skippedItems = payload.duplicateCount || 0;
      view.setImportStatus('合并处理中...', '');

      function settle(promise) {
        return Promise.resolve(promise).then(
          function(value) { return { status: 'fulfilled', value: value }; },
          function(err) { return { status: 'rejected', reason: err }; }
        );
      }

      var chain = Promise.resolve();
      entries.forEach(function(entry) {
        var items = Array.isArray(entry.items) ? entry.items : [];
        if (!items.length) return;
        chain = chain.then(function() {
          if (entry.isNewModule) {
            if (!apiClient || typeof apiClient.createMissingModule !== 'function') {
              throw new Error('易漏模块接口未就绪');
            }
            return apiClient.createMissingModule({ project_id: projectId, name: entry.moduleName }).then(function(module) {
              var moduleId = module && module.id ? module.id : null;
              if (!moduleId) throw new Error('新模块创建失败');
              entry.moduleId = moduleId;
              totalNewModules += 1;
              return createModuleItems(moduleId, items).then(function() {
                totalNewItems += items.length;
                return module;
              });
            });
          }
          if (!entry.moduleId) return null;
          return createModuleItems(entry.moduleId, items).then(function() {
            totalNewItems += items.length;
            return null;
          });
        });
      });

      return settle(chain).then(function(result) {
        if (!result || result.status !== 'fulfilled') {
          throw result && result.reason ? result.reason : new Error('合并失败');
        }
        var message = '合并完成：新增模块 ' + totalNewModules + ' 个，新增条目 ' + totalNewItems + ' 条';
        if (skippedItems) message += '，重复跳过 ' + skippedItems + ' 条';
        view.setImportStatus(message, totalNewItems ? 'ok' : 'warn');
        var importState = getImportState();
        importState.files = [];
        importState.items = [];
        importState.invalid = [];
        view.renderFileHint(importState);
        syncConfirmEnabled();
        var missingDrawer = state.missingDrawer || {};
        if (missingDrawer.projectId && String(missingDrawer.projectId) === String(projectId || '')) {
          reloadModules(projectId);
        }
        return true;
      }).catch(function(err) {
        view.setImportStatus(err && err.message ? err.message : '合并失败', 'err');
        return false;
      }).finally(function() {
        getImportState().pending = false;
        syncConfirmEnabled();
      });
    }

    function confirm() {
      var importState = getImportState();
      if (importState.loading || importState.pending) return Promise.resolve(null);
      if (!apiClient || typeof apiClient.listMissingModules !== 'function') {
        view.setImportStatus('易漏模块接口未就绪', 'err');
        return Promise.resolve(null);
      }
      var projectId = importState.projectId || normalizeId(view.getProjectValue());
      setProjectId(projectId);
      if (!projectId) {
        view.setImportStatus('请先选择项目', 'warn');
        return Promise.resolve(null);
      }
      var items = Array.isArray(importState.items) ? importState.items : [];
      var structuralErrors = Array.isArray(importState.structuralErrors) ? importState.structuralErrors : [];
      if (!items.length) {
        if (structuralErrors.length) {
          importState.pending = true;
          syncConfirmEnabled();
          openDiff({
            projectId: projectId,
            rows: [],
            newItems: [],
            duplicateCount: 0,
            pendingItemsByModule: [],
            newCount: 0,
            importCount: 0,
            overlapModules: 0,
            structuralErrors: structuralErrors,
          });
          return Promise.resolve(null);
        }
        view.setImportStatus('请先选择漏测用例文件', 'warn');
        return Promise.resolve(null);
      }
      if (importState.invalid && importState.invalid.length) {
        view.setImportStatus('导入校验失败：请补齐必填字段', 'warn');
        return Promise.resolve(null);
      }

      importState.pending = true;
      syncConfirmEnabled();
      view.setImportStatus('校验同名模块中...', '');
      var groups = model.buildGroups(items);
      return apiClient.listMissingModules(projectId).then(function(list) {
        var moduleIndex = {};
        (Array.isArray(list) ? list : []).forEach(function(module) {
          if (!module || !module.name) return;
          var key = model.normalizeModuleKey(module.name);
          if (!moduleIndex[key]) moduleIndex[key] = module;
        });

        var overlapGroups = [];
        var newGroups = [];
        groups.forEach(function(group) {
          var existing = moduleIndex[group.key] || null;
          if (existing) overlapGroups.push({ group: group, module: existing });
          else newGroups.push(group);
        });

        if (!overlapGroups.length) {
          var pendingNew = newGroups.map(function(group) {
            return { moduleId: null, moduleName: group.moduleName, items: group.items, isNewModule: true };
          });
          if (structuralErrors.length) {
            var pendingCount = model.countPendingItems(pendingNew);
            openDiff({
              projectId: projectId,
              rows: [],
              newItems: [],
              duplicateCount: 0,
              pendingItemsByModule: pendingNew,
              newCount: pendingCount,
              importCount: pendingCount,
              overlapModules: 0,
              structuralErrors: structuralErrors,
            });
            return null;
          }
          return executeMerge({
            projectId: projectId,
            pendingItemsByModule: pendingNew,
            duplicateCount: 0,
          });
        }

        var loadTasks = overlapGroups.map(function(entry) {
          return apiClient.listMissingModuleItems(entry.module.id).then(function(itemsResult) {
            return { entry: entry, items: Array.isArray(itemsResult) ? itemsResult : [] };
          });
        });
        return Promise.all(loadTasks).then(function(existingLists) {
          var pending = [];
          var overlapImportItems = [];
          var overlapExistingItems = [];
          var duplicateCount = 0;
          var newCount = 0;
          var importCount = 0;

          existingLists.forEach(function(row) {
            var group = row.entry.group;
            var module = row.entry.module;
            var existingItems = Array.isArray(row.items) ? row.items : [];
            var existingKeySet = model.buildExistingItemKeySet(existingItems);
            var addItems = [];
            (group.items || []).forEach(function(item) {
              var key = buildCaseItemKey(item);
              if (key && existingKeySet[key]) duplicateCount += 1;
              else addItems.push(item);
            });
            importCount += (group.items || []).length;
            newCount += addItems.length;
            pending.push({
              moduleId: module.id,
              moduleName: module.name || group.moduleName,
              items: addItems,
              isNewModule: false,
            });
            overlapImportItems = overlapImportItems.concat(group.items || []);
            overlapExistingItems = overlapExistingItems.concat(existingItems);
          });

          newGroups.forEach(function(group) {
            importCount += (group.items || []).length;
            newCount += (group.items || []).length;
            pending.push({
              moduleId: null,
              moduleName: group.moduleName,
              items: group.items,
              isNewModule: true,
            });
          });

          openDiff({
            projectId: projectId,
            rows: buildImportDiffRows(overlapImportItems, overlapExistingItems),
            newItems: overlapImportItems,
            duplicateCount: duplicateCount,
            pendingItemsByModule: pending,
            newCount: newCount,
            importCount: importCount,
            overlapModules: overlapGroups.length,
            structuralErrors: structuralErrors,
          });
          return null;
        });
      }).catch(function(err) {
        importState.pending = false;
        syncConfirmEnabled();
        view.setImportStatus(err && err.message ? err.message : '导入失败', 'err');
        return null;
      });
    }

    function bindEvents() {
      if (bound) return;
      bound = true;
      if (dom.missingImportInput) {
        dom.missingImportInput.addEventListener('change', function(event) {
          var files = event && event.target && event.target.files ? Array.from(event.target.files) : [];
          handleFiles(files);
          view.clearFileInput();
        });
      }
      if (dom.missingImportDropZone) {
        dom.missingImportDropZone.addEventListener('dragover', function(event) {
          event.preventDefault();
          view.setDropZoneActive(true);
        });
        dom.missingImportDropZone.addEventListener('dragleave', function() {
          view.setDropZoneActive(false);
        });
        dom.missingImportDropZone.addEventListener('drop', function(event) {
          event.preventDefault();
          view.setDropZoneActive(false);
          var files = event && event.dataTransfer ? event.dataTransfer.files : null;
          if (files && files.length) handleFiles(files);
        });
      }
      if (dom.missingImportProjectSelect) {
        dom.missingImportProjectSelect.addEventListener('change', handleProjectChange);
      }
      if (dom.missingImportConfirmBtn) {
        dom.missingImportConfirmBtn.addEventListener('click', confirm);
      }
      if (dom.missingImportDiffConfirmBtn) {
        dom.missingImportDiffConfirmBtn.addEventListener('click', function() {
          executeMerge(getDiffState()).then(function(ok) {
            if (ok) closeDiffDrawer();
          });
        });
      }
    }

    return {
      getImportState: getImportState,
      getDiffState: getDiffState,
      getProjectId: getProjectId,
      setProjectId: setProjectId,
      prepareProjectOptions: prepareProjectOptions,
      syncConfirmEnabled: syncConfirmEnabled,
      reset: reset,
      handleFiles: handleFiles,
      handleProjectChange: handleProjectChange,
      openDiff: openDiff,
      executeMerge: executeMerge,
      confirm: confirm,
      bindEvents: bindEvents,
    };
  }

  return { create: create };
});
