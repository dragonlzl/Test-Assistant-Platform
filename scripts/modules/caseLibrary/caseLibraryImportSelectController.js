(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.importSelectController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var apiClient = opts.apiClient || null;
    var model = opts.model || null;
    var view = opts.view || null;
    if (!model || !view) throw new Error('Case library import select owners are required');

    var normalizeId = typeof opts.normalizeId === 'function' ? opts.normalizeId : function(value) { return value || null; };
    var getPageSize = typeof opts.getPageSize === 'function' ? opts.getPageSize : function() { return 20; };
    var ensureProjectsReady = typeof opts.ensureProjectsReady === 'function'
      ? opts.ensureProjectsReady
      : function() { return Promise.resolve([]); };
    var loadVersions = typeof opts.loadVersions === 'function'
      ? opts.loadVersions
      : function() { return Promise.resolve([]); };
    var getVersions = typeof opts.getVersions === 'function' ? opts.getVersions : function() { return []; };
    var getDrawer = typeof opts.getDrawer === 'function' ? opts.getDrawer : function() { return null; };
    var closeAllDrawers = typeof opts.closeAllDrawers === 'function' ? opts.closeAllDrawers : function() {};
    var getCasesApi = typeof opts.getCasesApi === 'function' ? opts.getCasesApi : function() { return null; };
    var syncWorkflowStatus = typeof opts.syncWorkflowStatus === 'function' ? opts.syncWorkflowStatus : function() {};

    function getDrawerState() {
      if (!state.importSelectDrawer || typeof state.importSelectDrawer !== 'object') state.importSelectDrawer = {};
      var drawer = state.importSelectDrawer;
      if (!Array.isArray(drawer.files)) drawer.files = [];
      if (!(drawer.selection instanceof Set)) drawer.selection = new Set();
      return drawer;
    }

    function buildSnapshot() {
      var drawer = getDrawerState();
      var snapshot = model.buildSnapshot(drawer, getPageSize());
      drawer.pageIndex = snapshot.pageIndex;
      drawer.selection = snapshot.selection;
      return snapshot;
    }

    function render() {
      var drawer = getDrawerState();
      var snapshot = buildSnapshot();
      view.render(drawer, snapshot);
      return snapshot;
    }

    function reset() {
      var drawer = getDrawerState();
      drawer.projectId = null;
      drawer.versionId = null;
      drawer.searchText = '';
      drawer.files = [];
      drawer.loading = false;
      drawer.processing = false;
      drawer.selection = new Set();
      drawer.skipCloseImport = false;
      drawer.pageIndex = 0;
      drawer.loadSeq = 0;
      view.reset();
      return drawer;
    }

    function prepare() {
      return ensureProjectsReady().then(function() {
        reset();
        return true;
      });
    }

    function handleProjectChange() {
      var drawer = getDrawerState();
      var projectId = normalizeId(view.getProjectValue());
      drawer.projectId = projectId;
      drawer.versionId = null;
      drawer.files = [];
      drawer.processing = false;
      drawer.selection = new Set();
      drawer.pageIndex = 0;
      drawer.searchText = '';
      view.resetProjectFields();
      view.setDrawerStatus('', '');
      render();
      if (!projectId) return Promise.resolve([]);
      return loadVersions(projectId)
        .then(function(list) {
          if (String(getDrawerState().projectId || '') !== String(projectId)) return [];
          view.renderVersions(projectId, null, list);
          return Array.isArray(list) ? list : [];
        })
        .catch(function(error) {
          if (String(getDrawerState().projectId || '') === String(projectId)) {
            view.setDrawerStatus(error && error.message ? error.message : '加载版本失败', 'err');
          }
          return [];
        });
    }

    function handleVersionChange() {
      var drawer = getDrawerState();
      drawer.versionId = normalizeId(view.getVersionValue());
      drawer.pageIndex = 0;
      render();
    }

    function handleSearchInput() {
      var drawer = getDrawerState();
      drawer.searchText = view.getSearchValue();
      drawer.pageIndex = 0;
      render();
    }

    function loadFiles() {
      var drawer = getDrawerState();
      var projectId = normalizeId(view.getProjectValue());
      var versionId = normalizeId(view.getVersionValue());
      drawer.projectId = projectId;
      drawer.versionId = versionId;
      drawer.searchText = view.getSearchValue();
      drawer.files = [];
      drawer.processing = false;
      drawer.selection = new Set();
      drawer.pageIndex = 0;
      render();
      if (!projectId) {
        view.setDrawerStatus('请先选择项目', 'warn');
        return Promise.resolve(false);
      }
      if (!apiClient || typeof apiClient.listCaseFiles !== 'function') {
        view.setDrawerStatus('缺少用例文件接口（apiClient.listCaseFiles）', 'err');
        return Promise.resolve(false);
      }
      view.setDrawerStatus('加载用例库...', '');
      drawer.loading = true;
      drawer.loadSeq = Number(drawer.loadSeq || 0) + 1;
      var seq = drawer.loadSeq;
      render();
      return Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId)])
        .then(function(result) {
          if (seq !== drawer.loadSeq) return false;
          var files = Array.isArray(result && result[0]) ? result[0] : [];
          drawer.files = files;
          drawer.versionId = view.renderVersions(projectId, versionId, getVersions(projectId));
          view.setDrawerStatus('已加载 ' + files.length + ' 份用例文件', files.length ? 'ok' : 'warn');
          return true;
        })
        .catch(function(error) {
          if (seq !== drawer.loadSeq) return false;
          drawer.files = [];
          view.setDrawerStatus(error && error.message ? error.message : '加载失败', 'err');
          return false;
        })
        .finally(function() {
          if (seq !== drawer.loadSeq) return;
          drawer.loading = false;
          render();
        });
    }

    function handleSelectionChange(id, checked) {
      var drawer = getDrawerState();
      if (checked) drawer.selection.add(String(id));
      else drawer.selection.delete(String(id));
      render();
    }

    function setPageSelection(checked) {
      var drawer = getDrawerState();
      drawer.selection = model.setPageSelection(buildSnapshot(), checked === true);
      render();
    }

    function importFiles(files) {
      var list = Array.isArray(files) ? files.filter(Boolean) : [];
      if (!list.length) {
        view.setDrawerStatus('请先选择用例', 'warn');
        return Promise.resolve(false);
      }
      if (!apiClient || typeof apiClient.listCaseItems !== 'function') {
        view.setDrawerStatus('缺少用例明细接口（apiClient.listCaseItems）', 'err');
        return Promise.resolve(false);
      }
      var casesApi = getCasesApi();
      if (!casesApi || typeof casesApi.addImportedCase !== 'function') {
        view.setDrawerStatus('缺少用例导入能力（casesCore）', 'err');
        return Promise.resolve(false);
      }
      var drawer = getDrawerState();
      drawer.processing = true;
      render();
      view.setDrawerStatus('正在导入 ' + list.length + ' 份用例...', '');
      var successCount = 0;
      var failCount = 0;
      return Promise.all(list.map(function(file) {
        if (!file || !file.id) {
          failCount += 1;
          return Promise.resolve();
        }
        return apiClient.listCaseItems(file.id)
          .then(function(items) {
            var mapped = (Array.isArray(items) ? items : []).map(model.mapCaseItem).filter(function(item) {
              return item && item.module && item.title;
            });
            if (!mapped.length) {
              failCount += 1;
              return;
            }
            var name = file.file_name_clean || ('用例#' + file.id);
            casesApi.addImportedCase(name, JSON.stringify(mapped, null, 2), mapped, {
              sourceType: 'case-library-select',
              caseFileId: Number(file.id) || null,
              projectId: file.project_id ? Number(file.project_id) : null,
              versionId: file.version_id ? Number(file.version_id) : null,
              fileName: name,
            });
            successCount += 1;
          })
          .catch(function() { failCount += 1; });
      })).then(function() {
        var message = '已导入 ' + successCount + ' 份用例';
        var type = successCount ? 'ok' : 'warn';
        if (failCount) {
          message += '，失败 ' + failCount + ' 份';
          type = 'warn';
        }
        view.setDrawerStatus(message, type);
        syncWorkflowStatus(message, type, casesApi);
        return successCount > 0;
      }).finally(function() {
        drawer.processing = false;
        render();
      });
    }

    function closeAfterImport() {
      var drawer = getDrawerState();
      var instance = getDrawer();
      drawer.skipCloseImport = true;
      if (instance && typeof instance.close === 'function') instance.close();
    }

    function importSelected(options) {
      var drawer = getDrawerState();
      var ids = Array.from(drawer.selection);
      if (!ids.length) {
        view.setDrawerStatus('请先勾选需要导入的用例', 'warn');
        return Promise.resolve(false);
      }
      var files = ids.map(function(id) { return model.findFile(drawer.files, id); }).filter(Boolean);
      drawer.selection = new Set();
      render();
      return importFiles(files).then(function(ok) {
        if (ok && options && options.closeAfter === true) closeAfterImport();
        return ok;
      });
    }

    function importOne(id) {
      var file = model.findFile(getDrawerState().files, id);
      if (!file) return Promise.resolve(false);
      return importFiles([file]).then(function(ok) {
        if (ok) closeAfterImport();
        return ok;
      });
    }

    function open() {
      closeAllDrawers();
      var drawer = getDrawer();
      if (!drawer || typeof drawer.open !== 'function') return false;
      drawer.open();
      return true;
    }

    function handleClose() {
      var drawer = getDrawerState();
      if (drawer.skipCloseImport) {
        drawer.skipCloseImport = false;
        return Promise.resolve(false);
      }
      if (!drawer.selection.size) return Promise.resolve(false);
      return importSelected({ closeAfter: false });
    }

    function handlePaginationAction(action) {
      var drawer = getDrawerState();
      var snapshot = buildSnapshot();
      if (action === 'prev') drawer.pageIndex = snapshot.pageIndex - 1;
      else if (action === 'next') drawer.pageIndex = snapshot.pageIndex + 1;
      else if (action === 'first') drawer.pageIndex = 0;
      else if (action === 'last') drawer.pageIndex = snapshot.totalPages - 1;
      render();
    }

    function handlePaginationJump(value) {
      getDrawerState().pageIndex = Math.max(0, Number(value) - 1);
      render();
    }

    function bindEvents() {
      view.bindEvents({
        onProjectChange: handleProjectChange,
        onVersionChange: handleVersionChange,
        onSearchInput: handleSearchInput,
        onQuery: loadFiles,
        onBatchImport: function() { importSelected({ closeAfter: true }); },
        onSelectAll: setPageSelection,
        onSelectionChange: handleSelectionChange,
        onImportOne: importOne,
      });
    }

    return {
      bindEvents: bindEvents,
      prepare: prepare,
      reset: reset,
      render: render,
      loadFiles: loadFiles,
      importFiles: importFiles,
      importSelected: importSelected,
      importOne: importOne,
      open: open,
      handleClose: handleClose,
      handlePaginationAction: handlePaginationAction,
      handlePaginationJump: handlePaginationJump,
      getSnapshot: buildSnapshot,
    };
  }

  return { create: create };
});
