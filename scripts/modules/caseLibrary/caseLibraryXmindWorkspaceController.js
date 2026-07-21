(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.xmindWorkspaceController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var model = opts.model || null;
    if (!model) throw new Error('Case library XMind model is required');

    var documentRef = opts.document || (typeof document !== 'undefined' ? document : null);
    var windowRef = opts.window || (typeof window !== 'undefined' ? window : null);
    var storage = opts.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    var MutationObserverCtor = opts.MutationObserver
      || (typeof MutationObserver !== 'undefined' ? MutationObserver : null);
    var apiClient = opts.apiClient || null;
    var getMindApi = typeof opts.getMindApi === 'function' ? opts.getMindApi : function() { return null; };
    var ensureDrawer = typeof opts.ensureDrawer === 'function' ? opts.ensureDrawer : function() { return null; };
    var getEditor = typeof opts.getEditor === 'function' ? opts.getEditor : function() { return {}; };
    var getXmindBuilder = typeof opts.getXmindBuilder === 'function' ? opts.getXmindBuilder : function() { return null; };
    var getDownloadBlob = typeof opts.getDownloadBlob === 'function' ? opts.getDownloadBlob : function() { return null; };
    var cleanFileName = typeof opts.cleanFileName === 'function'
      ? opts.cleanFileName
      : function(value) { return String(value || ''); };
    var sanitizeDownloadName = typeof opts.sanitizeDownloadName === 'function'
      ? opts.sanitizeDownloadName
      : function(value, extension) { return String(value || '') + String(extension || ''); };
    var setEditStatus = typeof opts.setEditStatus === 'function' ? opts.setEditStatus : function() {};
    var setMainStatus = typeof opts.setMainStatus === 'function' ? opts.setMainStatus : function() {};
    var logOperation = typeof opts.logOperation === 'function' ? opts.logOperation : function() {};
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function'
      ? opts.openConfirmDrawer
      : function() { return Promise.resolve({ ok: true }); };
    var showToast = typeof opts.showToast === 'function' ? opts.showToast : null;
    var getCurrentUserId = typeof opts.getCurrentUserId === 'function'
      ? opts.getCurrentUserId
      : function() { return ''; };
    var onEditorItemsReloaded = typeof opts.onEditorItemsReloaded === 'function'
      ? opts.onEditorItemsReloaded
      : function() {};
    var onLocateEditorIndex = typeof opts.onLocateEditorIndex === 'function'
      ? opts.onLocateEditorIndex
      : function() {};
    var requestWriterPublish = typeof opts.requestWriterPublish === 'function'
      ? opts.requestWriterPublish
      : function() { return Promise.reject(new Error('XMind 入库能力未就绪')); };

    var drawerInstance = null;
    var mindInstance = null;
    var themeObserver = null;
    var gestureGuard = {
      active: false,
      token: '',
      popHandler: null,
    };

    function markSkipScrollRestoreOnce() {
      try {
        if (windowRef && windowRef.app) windowRef.app.__drawerSkipRestoreOnce = true;
      } catch (err) {
        // ignore
      }
    }

    function bindCloseScrollGuard(drawerElement) {
      if (!drawerElement || typeof drawerElement.addEventListener !== 'function') return;
      if (drawerElement.__tapCaseLibraryXmindCloseScrollGuardBound) return;
      drawerElement.__tapCaseLibraryXmindCloseScrollGuardBound = true;
      drawerElement.addEventListener('click', function(event) {
        var target = event && event.target && event.target.closest
          ? event.target.closest('[data-drawer-close="xmindStructureDrawer"]')
          : null;
        if (target) markSkipScrollRestoreOnce();
      }, true);
    }

    function enableGestureGuard() {
      if (gestureGuard.active || !windowRef || !windowRef.history) return;
      if (typeof windowRef.addEventListener !== 'function' || typeof windowRef.removeEventListener !== 'function') return;
      var token = 'tap-xmind-guard-' + Date.now() + '-' + Math.random().toString(16).slice(2);
      gestureGuard.token = token;
      gestureGuard.active = true;
      try {
        windowRef.history.pushState(
          { __tapXmindGestureGuard: token },
          documentRef ? documentRef.title : '',
          windowRef.location ? windowRef.location.href : ''
        );
      } catch (err) {
        // ignore
      }
      gestureGuard.popHandler = function() {
        if (!gestureGuard.active || !windowRef.history || typeof windowRef.history.go !== 'function') return;
        try {
          windowRef.history.go(1);
        } catch (err0) {
          // ignore
        }
      };
      windowRef.addEventListener('popstate', gestureGuard.popHandler, true);
    }

    function disableGestureGuard() {
      if (!gestureGuard.active) return;
      var popHandler = gestureGuard.popHandler;
      gestureGuard.active = false;
      gestureGuard.popHandler = null;
      if (windowRef && typeof windowRef.removeEventListener === 'function' && popHandler) {
        windowRef.removeEventListener('popstate', popHandler, true);
      }
      if (!windowRef || !windowRef.history) {
        gestureGuard.token = '';
        return;
      }
      var historyState = null;
      try {
        historyState = windowRef.history.state;
      } catch (err1) {
        historyState = null;
      }
      if (
        historyState && typeof historyState === 'object'
        && String(historyState.__tapXmindGestureGuard || '') === String(gestureGuard.token || '')
      ) {
        var nextState = {};
        try {
          nextState = JSON.parse(JSON.stringify(historyState));
        } catch (err2) {
          nextState = {};
        }
        delete nextState.__tapXmindGestureGuard;
        try {
          windowRef.history.replaceState(
            nextState,
            documentRef ? documentRef.title : '',
            windowRef.location ? windowRef.location.href : ''
          );
        } catch (err3) {
          // ignore
        }
      }
      gestureGuard.token = '';
    }

    function getBody() {
      return documentRef && typeof documentRef.getElementById === 'function'
        ? documentRef.getElementById('xmindStructureDrawerBody')
        : null;
    }

    function setBodyViewerMode(enabled) {
      var body = getBody();
      if (!body || !body.classList) return;
      if (enabled) body.classList.add('is-mind-viewer');
      else body.classList.remove('is-mind-viewer');
    }

    function destroyMindMap() {
      if (themeObserver && typeof themeObserver.disconnect === 'function') themeObserver.disconnect();
      themeObserver = null;
      var mindApi = getMindApi();
      if (mindApi && typeof mindApi.destroyMindMap === 'function') mindApi.destroyMindMap(mindInstance);
      mindInstance = null;
      var body = getBody();
      if (body) {
        setBodyViewerMode(false);
        body.innerHTML = '';
      }
    }

    function ensureWorkspaceDrawer() {
      if (drawerInstance) return drawerInstance;
      drawerInstance = ensureDrawer(
        'xmindStructureDrawer',
        [],
        enableGestureGuard,
        function() {
          disableGestureGuard();
          destroyMindMap();
        }
      );
      if (drawerInstance && drawerInstance.element) bindCloseScrollGuard(drawerInstance.element);
      if (drawerInstance && typeof drawerInstance.close === 'function' && !drawerInstance.__tapCloseWithSkipRestore) {
        var rawClose = drawerInstance.close;
        drawerInstance.close = function() {
          markSkipScrollRestoreOnce();
          return rawClose.apply(drawerInstance, arguments);
        };
        drawerInstance.__tapCloseWithSkipRestore = true;
      }
      return drawerInstance;
    }

    function bindThemeSync(mindApi) {
      if (!mindApi || typeof mindApi.refreshMindTheme !== 'function') return;
      if (!documentRef || !documentRef.documentElement || !MutationObserverCtor) return;
      if (themeObserver && typeof themeObserver.disconnect === 'function') themeObserver.disconnect();
      themeObserver = new MutationObserverCtor(function() {
        if (mindInstance) mindApi.refreshMindTheme(mindInstance);
      });
      themeObserver.observe(documentRef.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });
    }

    function readMindData() {
      var instance = mindInstance;
      if (!instance) return null;
      try {
        if (typeof instance.getData === 'function') {
          var data = instance.getData();
          if (data && data.nodeData) return JSON.parse(JSON.stringify(data));
        }
      } catch (err0) {
        // ignore
      }
      try {
        if (typeof instance.getDataString === 'function') {
          var raw = instance.getDataString();
          if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed && parsed.nodeData) return parsed;
          }
        }
      } catch (err1) {
        // ignore
      }
      try {
        if (instance.nodeData) {
          return JSON.parse(JSON.stringify({ nodeData: instance.nodeData }, function(key, value) {
            return key === 'parent' ? undefined : value;
          }));
        }
      } catch (err2) {
        // ignore
      }
      return null;
    }

    function exportXmind(items, baseName, statusTarget, logDetail) {
      var builder = getXmindBuilder();
      if (!builder) {
        statusTarget('缺少 XMind 导出依赖', 'err');
        return Promise.resolve(false);
      }
      var downloadBlob = getDownloadBlob();
      if (!downloadBlob) {
        statusTarget('缺少下载能力，无法导出', 'err');
        return Promise.resolve(false);
      }
      statusTarget('正在导出 XMind...', '');
      return Promise.resolve()
        .then(function() { return builder(items, baseName, ''); })
        .then(function(pkg) {
          if (!pkg || !pkg.blob) throw new Error('无导出内容');
          var fileName = sanitizeDownloadName(baseName, '.xmind');
          downloadBlob(fileName, pkg.blob);
          statusTarget('已导出 XMind：' + fileName, 'ok');
          logOperation('export_case_files_xmind', 'case_file', logDetail.targetId || null, logDetail.detail);
          return true;
        })
        .catch(function(err) {
          statusTarget('导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
          return false;
        });
    }

    function exportCurrentViewer() {
      var editor = getEditor() || {};
      var currentFile = editor.caseFile || null;
      var items = Array.isArray(editor.items) ? editor.items : [];
      if (!currentFile || !items.length) {
        setEditStatus('当前用例无可导出内容', 'warn');
        return Promise.resolve(false);
      }
      var currentMindData = readMindData();
      var rootName = currentMindData && currentMindData.nodeData
        ? model.deriveWriterExportBaseName(currentMindData)
        : '';
      var baseName = cleanFileName(rootName || currentFile.file_name_clean || currentFile.file_name || '用例');
      var label = currentFile.file_name_clean || currentFile.file_name || '';
      return exportXmind(items, baseName, setEditStatus, {
        targetId: currentFile.id || null,
        detail: {
          format: 'xmind',
          count: 1,
          success: 1,
          fail: 0,
          case_file_ids: currentFile.id !== null && currentFile.id !== undefined ? [currentFile.id] : [],
          file_name: label,
          file_names: label ? [label] : [],
          source: 'xmind_structure_viewer',
        },
      });
    }

    function saveViewerCases(nextCases, summary) {
      var editor = getEditor() || {};
      var file = editor.caseFile || null;
      if (!file || !file.id) return Promise.reject(new Error('请先选择用例文件'));
      var existing = Array.isArray(editor.items) ? editor.items.slice() : [];
      var nextList = (Array.isArray(nextCases) ? nextCases : []).map(model.normalizeCase).filter(function(item) {
        return Boolean(item.module && item.title && item.expected);
      });
      var diff = model.buildPatchDiff(existing, nextList);
      var changeCount = diff.updates.length + diff.creates.length + diff.deletes.length;
      if (!changeCount) {
        setEditStatus('XMind 编辑无改动，已保持当前状态', 'ok');
        return Promise.resolve({ changed: 0, updates: 0, creates: 0, deletes: 0 });
      }
      setEditStatus('正在保存 XMind 编辑...', '');
      var chain = Promise.resolve();
      diff.updates.forEach(function(entry) {
        chain = chain.then(function() { return apiClient.updateCaseItem(entry.id, entry.payload || {}); });
      });
      diff.creates.forEach(function(entry) {
        chain = chain.then(function() { return apiClient.createCaseItem(file.id, entry.payload || {}); });
      });
      diff.deletes.forEach(function(entry) {
        chain = chain.then(function() { return apiClient.deleteCaseItem(entry.id); });
      });
      return chain
        .then(function() { return apiClient.listCaseItems(file.id); })
        .then(function(items) {
          onEditorItemsReloaded(Array.isArray(items) ? items : []);
          setEditStatus('XMind 编辑保存成功', 'ok');
          logOperation('save_case_file_xmind_structure', 'case_file', file.id || null, {
            case_file_id: file.id || null,
            summary: summary || {},
            updates: diff.updates.length,
            creates: diff.creates.length,
            deletes: diff.deletes.length,
          });
          return {
            changed: changeCount,
            updates: diff.updates.length,
            creates: diff.creates.length,
            deletes: diff.deletes.length,
          };
        })
        .catch(function(err) {
          setEditStatus('XMind 编辑保存失败：' + (err && err.message ? String(err.message) : '保存失败'), 'err');
          throw err;
        });
    }

    function locateViewerPath(path, mindApi) {
      var editor = getEditor() || {};
      var items = Array.isArray(editor.items) ? editor.items : [];
      var pathBuilder = mindApi && typeof mindApi.buildPathsFromCases === 'function'
        ? function(input, options) { return mindApi.buildPathsFromCases(input, options); }
        : null;
      var index = model.findIndexByPath(path, items, pathBuilder);
      if (index < 0) {
        setEditStatus('未找到对应的用例条目', 'warn');
        return -1;
      }
      onLocateEditorIndex(index);
      setEditStatus('已定位到第 ' + String(index + 1) + ' 条用例', 'ok');
      return index;
    }

    function openViewer() {
      var mindApi = getMindApi();
      if (!mindApi || typeof mindApi.buildMindDataFromCases !== 'function' || typeof mindApi.renderMindMap !== 'function') {
        setEditStatus('XMind 结构渲染依赖未就绪', 'err');
        return false;
      }
      var editor = getEditor() || {};
      var currentFile = editor.caseFile || null;
      var items = Array.isArray(editor.items) ? editor.items : [];
      if (!currentFile || !items.length) {
        setEditStatus('请先选择查看&编辑用例', 'warn');
        return false;
      }
      var drawer = ensureWorkspaceDrawer();
      if (!drawer || typeof drawer.open !== 'function') {
        setEditStatus('XMind 结构抽屉未就绪', 'err');
        return false;
      }
      var title = documentRef.getElementById('xmindStructureDrawerTitle');
      if (title) title.textContent = 'XMind 用例结构 - ' + (currentFile.file_name_clean || currentFile.file_name || '当前用例');
      var body = getBody();
      if (!body) {
        setEditStatus('XMind 结构容器未找到', 'err');
        return false;
      }
      drawer.open();
      setBodyViewerMode(true);
      body.innerHTML = '<div class="xmind-structure-viewer" id="caseLibraryXmindStructureViewer"></div>';
      var container = documentRef.getElementById('caseLibraryXmindStructureViewer');
      if (!container) {
        if (typeof drawer.close === 'function') drawer.close();
        setEditStatus('XMind 结构容器初始化失败', 'err');
        return false;
      }
      var mindData = mindApi.buildMindDataFromCases(items, {
        rootTitle: cleanFileName(currentFile.file_name_clean || currentFile.file_name || '用例'),
        fallbackModule: '用例模块',
      });
      try {
        mindInstance = mindApi.renderMindMap(container, mindData, {
          instance: mindInstance,
          direction: model.resolveDirection(items),
          initialCenterNodeId: model.resolveRootNodeId(mindData),
          enableCustomBoxSelection: true,
          onExportXmind: exportCurrentViewer,
          editableSessionKey: 'tap-case-library-xmind-edit-' + String(currentFile.id || ''),
          onSaveCases: saveViewerCases,
          onNodeDblClickLocate: function(payload) {
            if (payload && Array.isArray(payload.path)) locateViewerPath(payload.path, mindApi);
          },
          openConfirmDrawer: openConfirmDrawer,
          showToast: showToast,
        });
        bindThemeSync(mindApi);
      } catch (err) {
        if (typeof console !== 'undefined' && console && typeof console.error === 'function') console.error(err);
        if (typeof drawer.close === 'function') drawer.close();
        setEditStatus('XMind 结构渲染失败', 'err');
        return false;
      }
      logOperation('view_case_file_xmind_structure', 'case_file', currentFile.id || null, {
        case_file_id: currentFile.id || null,
        file_name: currentFile.file_name_clean || currentFile.file_name || '',
      });
      return true;
    }

    function getWriterSessionKey() {
      return model.getWriterSessionKey(getCurrentUserId());
    }

    function migrateWriterSession() {
      if (!storage) return;
      var key = getWriterSessionKey();
      var raw = '';
      try {
        raw = storage.getItem(String(key)) || '';
      } catch (err1) {
        raw = '';
      }
      if (!raw) return;
      var payload = null;
      try {
        payload = JSON.parse(raw);
      } catch (err2) {
        payload = null;
      }
      var migration = model.migrateWriterSessionPayload(payload);
      try {
        if (migration.action === 'remove') storage.removeItem(String(key));
        if (migration.action === 'update' && migration.payload) {
          storage.setItem(String(key), JSON.stringify(migration.payload));
        }
      } catch (err3) {
        // ignore
      }
    }

    function deriveWriterPublishDefaultFileName(items, saveMeta) {
      var meta = saveMeta && typeof saveMeta === 'object' ? saveMeta : null;
      var mindData = meta && meta.mindData && meta.mindData.nodeData ? meta.mindData : readMindData();
      var fromRoot = mindData && mindData.nodeData ? model.deriveWriterExportBaseName(mindData) : '';
      if (!fromRoot) {
        fromRoot = cleanFileName(model.deriveWriterImportFileName(Array.isArray(items) ? items : []) || '编写用例');
      }
      return fromRoot || '编写用例';
    }

    function exportCurrentWriter() {
      var mindData = readMindData();
      if (!mindData || !mindData.nodeData) {
        setMainStatus('当前导图无可导出内容', 'warn');
        return Promise.resolve(false);
      }
      var cases = model.buildWriterExportCases(mindData);
      if (!cases.length) {
        setMainStatus('当前导图无可导出内容', 'warn');
        return Promise.resolve(false);
      }
      return exportXmind(
        cases,
        model.deriveWriterExportBaseName(mindData) || '编写用例',
        setMainStatus,
        {
          targetId: null,
          detail: { format: 'xmind', count: 1, success: 1, fail: 0, source: 'case_library_writer_xmind' },
        }
      );
    }

    function openWriter() {
      var mindApi = getMindApi();
      if (!mindApi || typeof mindApi.buildMindDataFromPaths !== 'function' || typeof mindApi.renderMindMap !== 'function') {
        setMainStatus('XMind 结构渲染依赖未就绪', 'err');
        return false;
      }
      var drawer = ensureWorkspaceDrawer();
      if (!drawer || typeof drawer.open !== 'function') {
        setMainStatus('XMind 结构抽屉未就绪', 'err');
        return false;
      }
      var title = documentRef.getElementById('xmindStructureDrawerTitle');
      if (title) title.textContent = 'XMind 编写用例';
      var body = getBody();
      if (!body) {
        setMainStatus('XMind 结构容器未找到', 'err');
        return false;
      }
      drawer.open();
      setBodyViewerMode(true);
      body.innerHTML = '<div class="xmind-structure-viewer" id="caseLibraryWriterXmindStructureViewer"></div>';
      var container = documentRef.getElementById('caseLibraryWriterXmindStructureViewer');
      if (!container) {
        if (typeof drawer.close === 'function') drawer.close();
        setMainStatus('XMind 结构容器初始化失败', 'err');
        return false;
      }
      migrateWriterSession();
      var mindData = mindApi.buildMindDataFromPaths([model.getWriterDefaultPath()], {
        rootTitle: model.getWriterRootTitle(),
      });
      if (!mindData || !mindData.nodeData) {
        setMainStatus('默认编写结构初始化失败', 'err');
        return false;
      }
      try {
        mindInstance = mindApi.renderMindMap(container, mindData, {
          instance: mindInstance,
          direction: 'right',
          onExportXmind: exportCurrentWriter,
          editableSessionKey: getWriterSessionKey(),
          initialEditing: true,
          cancelConfirmSuffix: '确认要取消保存吗？取消后会丢弃全部更改并恢复默认结构。',
          fieldCount: 6,
          topicCaseParser: model.parseWriterTopics,
          onSaveCases: function(nextCases, summary, saveMeta) {
            return requestWriterPublish(model.mapWriterCasesToImportItems(nextCases || []), summary || null, saveMeta || null);
          },
          openConfirmDrawer: openConfirmDrawer,
          showToast: showToast,
        });
        bindThemeSync(mindApi);
      } catch (err) {
        if (typeof console !== 'undefined' && console && typeof console.error === 'function') console.error(err);
        if (typeof drawer.close === 'function') drawer.close();
        setMainStatus('编写结构渲染失败', 'err');
        return false;
      }
      setMainStatus('已打开编写用例视图，可直接编辑并确认入库', 'ok');
      logOperation('open_case_library_writer_xmind', 'case_file', null, { source: 'case_library_writer' });
      return true;
    }

    return {
      ensureDrawer: ensureWorkspaceDrawer,
      openViewer: openViewer,
      openWriter: openWriter,
      readMindData: readMindData,
      deriveWriterPublishDefaultFileName: deriveWriterPublishDefaultFileName,
      exportCurrentViewer: exportCurrentViewer,
      exportCurrentWriter: exportCurrentWriter,
      saveViewerCases: saveViewerCases,
      locateViewerPath: locateViewerPath,
      destroy: function() {
        disableGestureGuard();
        destroyMindMap();
      },
    };
  }

  return { create: create };
});
