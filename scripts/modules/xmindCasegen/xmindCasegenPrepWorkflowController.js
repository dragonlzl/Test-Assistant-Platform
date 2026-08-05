(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenPrepWorkflowController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var documentObj = opts.documentObj || null;
    var windowObj = opts.windowObj || null;
    var DataTransferCtor = opts.DataTransfer || null;
    var EventCtor = opts.Event || null;
    var xmindGenApi = opts.xmindGenApi || {};
    var manualImageInputEl = null;

    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var getPrepState = port('getPrepState', function() { return {}; });
    var isPrepBaseLocked = port('isPrepBaseLocked', function() { return false; });
    var setPrepField = port('setPrepField');
    var appendManualRequirementImages = port('appendManualRequirementImages', function() {
      return Promise.resolve(false);
    });
    var notifyStatus = port('notifyStatus');
    var renderOpenedSummaryDialog = port('renderOpenedSummaryDialog');
    var openStoreConfirmDialog = port('openStoreConfirmDialog', function() {
      return Promise.resolve(false);
    });
    var hasAnyRunningGenerationOperation = port('hasAnyRunningGenerationOperation', function() { return false; });
    var resetXmindCasegenState = port('resetXmindCasegenState', function() { return false; });
    var getCaseLibraryApi = port('getCaseLibraryApi', function() { return null; });
    var now = port('now', function() { return Date.now(); });

    function buildCasesSummaryInfo() {
      var prep = getPrepState();
      if (prep.caseImportMode !== 'skip' && prep.caseImportMode !== 'import') {
        return {
          done: false,
          title: '未选择是否导入已有用例',
          meta: '请选择是否导入已有用例，再进入下一步。',
        };
      }
      if (prep.caseImportMode === 'skip') {
        return {
          done: true,
          title: '本次不导入已有用例',
          meta: '主树将只展示 AI 生成层。',
        };
      }
      var list = typeof xmindGenApi.getCombinedCaseList === 'function'
        ? xmindGenApi.getCombinedCaseList()
        : [];
      var text = typeof xmindGenApi.getCombinedCaseText === 'function'
        ? xmindGenApi.getCombinedCaseText()
        : '';
      if (!Array.isArray(list) || !list.length) {
        return {
          done: false,
          title: '未导入已有用例',
          meta: text ? '已存在文本，但尚未解析到有效用例。' : '参考用例是可选项，可跳过。',
        };
      }
      return {
        done: true,
        title: '已导入已有用例',
        meta: '当前共 ' + String(list.length) + ' 条，将作为 XMind 可见基线。',
      };
    }

    function ensureManualImageInput() {
      if (manualImageInputEl) return manualImageInputEl;
      if (!documentObj || typeof documentObj.createElement !== 'function') return null;
      manualImageInputEl = documentObj.createElement('input');
      manualImageInputEl.type = 'file';
      manualImageInputEl.accept = 'image/*';
      manualImageInputEl.multiple = true;
      manualImageInputEl.className = 'hidden';
      manualImageInputEl.addEventListener('change', function(event) {
        var files = event && event.target && event.target.files
          ? Array.prototype.slice.call(event.target.files)
          : [];
        appendManualRequirementImages(files).then(function(ok) {
          if (ok) {
            notifyStatus('已添加需求图片', 'ok');
            renderOpenedSummaryDialog();
          }
        });
        manualImageInputEl.value = '';
      });
      if (documentObj.body && typeof documentObj.body.appendChild === 'function') {
        documentObj.body.appendChild(manualImageInputEl);
      }
      return manualImageInputEl;
    }

    function markScopedRequirementImport() {
      try {
        if (windowObj && windowObj.app) {
          windowObj.app.__xmindCasegenScopedRequirementImportUntil = now() + 10000;
        }
      } catch (err) {}
    }

    function triggerRequirementImport() {
      if (isPrepBaseLocked()) return false;
      setPrepField('requirementMode', 'document');
      markScopedRequirementImport();
      var input = documentObj && documentObj.getElementById
        ? documentObj.getElementById('fileInput')
        : null;
      if (input && typeof input.click === 'function') input.click();
      return Boolean(input);
    }

    function dispatchFilesToInput(input, fileList) {
      if (!input || !fileList) return false;
      var normalized = Array.isArray(fileList)
        ? fileList.filter(Boolean)
        : Array.prototype.slice.call(fileList || []).filter(Boolean);
      if (!normalized.length || !DataTransferCtor) return false;
      var files = null;
      try {
        var transfer = new DataTransferCtor();
        if (transfer.items && typeof transfer.items.add === 'function') {
          normalized.forEach(function(file) { transfer.items.add(file); });
          files = transfer.files || null;
        }
      } catch (err) {}
      if (!files || !files.length) return false;
      try {
        input.files = files;
      } catch (assignErr) {
        return false;
      }
      var changeEvent = null;
      if (EventCtor) {
        changeEvent = new EventCtor('change', { bubbles: true });
      } else if (documentObj && documentObj.createEvent) {
        changeEvent = documentObj.createEvent('Event');
        changeEvent.initEvent('change', true, false);
      }
      if (!changeEvent || typeof input.dispatchEvent !== 'function') return false;
      input.dispatchEvent(changeEvent);
      return true;
    }

    function importRequirementFileFromDrop(file) {
      if (isPrepBaseLocked() || !file) return false;
      setPrepField('requirementMode', 'document');
      markScopedRequirementImport();
      var input = documentObj && documentObj.getElementById
        ? documentObj.getElementById('fileInput')
        : null;
      if (!input) return false;
      if (dispatchFilesToInput(input, [file])) return true;
      notifyStatus('当前环境暂不支持拖拽导入，请点击选择文件', 'warn');
      return false;
    }

    function importCasesFilesFromDrop(fileList) {
      if (isPrepBaseLocked()) return false;
      var files = Array.isArray(fileList)
        ? fileList.filter(Boolean)
        : Array.prototype.slice.call(fileList || []).filter(Boolean);
      if (!files.length) return false;
      setPrepField('caseImportMode', 'import');
      var input = documentObj && documentObj.getElementById
        ? documentObj.getElementById('caseFileInput')
        : null;
      if (!input) return false;
      if (dispatchFilesToInput(input, files)) return true;
      notifyStatus('当前环境暂不支持拖拽导入，请点击选择文件', 'warn');
      return false;
    }

    function triggerCasesImport() {
      if (isPrepBaseLocked()) return false;
      setPrepField('caseImportMode', 'import');
      var input = documentObj && documentObj.getElementById
        ? documentObj.getElementById('caseFileInput')
        : null;
      if (input && typeof input.click === 'function') input.click();
      return Boolean(input);
    }

    function preserveXmindDrawerForNestedDrawer(ttlMs) {
      var ttl = Number(ttlMs);
      if (!Number.isFinite(ttl) || ttl <= 0) ttl = 1200;
      try {
        if (!windowObj || !windowObj.app) return false;
        windowObj.app.__drawerSkipCloseId = 'xmindCaseGenDrawer';
        windowObj.app.__drawerCloseGuard = {
          id: 'xmindCaseGenDrawer',
          until: now() + ttl,
        };
        return true;
      } catch (err) {
        return false;
      }
    }

    function triggerCasesLibrarySelect() {
      if (isPrepBaseLocked()) return false;
      setPrepField('caseImportMode', 'import');
      preserveXmindDrawerForNestedDrawer(1600);
      var caseLibraryApi = getCaseLibraryApi();
      if (caseLibraryApi && typeof caseLibraryApi.openImportSelectDrawer === 'function') {
        caseLibraryApi.openImportSelectDrawer();
        return true;
      }
      var button = documentObj && documentObj.getElementById
        ? documentObj.getElementById('caseLibraryImportSelectBtn')
        : null;
      if (button && typeof button.click === 'function') button.click();
      return Boolean(button);
    }

    function requestPrepReset() {
      if (hasAnyRunningGenerationOperation()) {
        notifyStatus('当前仍有生成任务进行中，请等待完成后再重置', 'warn', 5000);
        return Promise.resolve(false);
      }
      return Promise.resolve(openStoreConfirmDialog({
        title: '确认重置前置准备',
        message: '确认后会清空当前 XMind 画布中的导入和生成结果，并把生成前置准备恢复到初始状态。是否继续？',
        confirmText: '确认重置',
        cancelText: '取消',
      })).then(function(confirmed) {
        if (!confirmed) return false;
        return resetXmindCasegenState({
          reason: 'prep-manual-reset',
          reopenPrepDialog: true,
          toastText: '已重置当前 XMind 生成内容',
          toastDurationMs: 3000,
        });
      });
    }

    return {
      buildCasesSummaryInfo: buildCasesSummaryInfo,
      dispatchFilesToInput: dispatchFilesToInput,
      ensureManualImageInput: ensureManualImageInput,
      getManualImageInputEl: function() { return manualImageInputEl; },
      importCasesFilesFromDrop: importCasesFilesFromDrop,
      importRequirementFileFromDrop: importRequirementFileFromDrop,
      preserveXmindDrawerForNestedDrawer: preserveXmindDrawerForNestedDrawer,
      requestPrepReset: requestPrepReset,
      triggerCasesImport: triggerCasesImport,
      triggerCasesLibrarySelect: triggerCasesLibrarySelect,
      triggerRequirementImport: triggerRequirementImport,
    };
  }

  return { create: create };
});
