(function() {
  function init(ctx) {
    if (!ctx) return;
    var state = ctx.state || {};
    var core = ctx.core || {};
    var utils = ctx.utils || {};
    var config = ctx.config || {};
    var api = ctx.tempExecApi || {};
    var setStatus = core.setStatus || utils.setStatus || function() {};
    var switchTab = core.switchTab || function() {};
    var setCurrentPathSub = core.setCurrentPathSub || function() {};
    var scrollElementIntoView = core.scrollElementIntoView || function() {};
    var downloadText = utils.downloadText || core.downloadText || function() {};
    var formatCompactTimestamp = core.formatCompactTimestamp || function() { return Date.now().toString(); };
    var escapeHtml = core.escapeHtml || utils.escapeHtml || function(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    var normalizeRequirementName = core.normalizeRequirementName || function(name) { return name || ''; };
    var defaultTempExecPageSize = config.defaultTempExecPageSize || 20;

    var tempExecDropZone = document.getElementById('tempExecDropZone');
    var tempExecInput = document.getElementById('tempExecInput');
    var tempExecImportFileHint = document.getElementById('tempExecImportFileHint');
    var tempExecImportProjectSelect = document.getElementById('tempExecImportProjectSelect');
    var tempExecImportVersionSelect = document.getElementById('tempExecImportVersionSelect');
    var tempExecImportConfirmBtn = document.getElementById('tempExecImportConfirmBtn');
    var tempExecStatus = document.getElementById('tempExecStatus');
    var tempExecNav = document.getElementById('tempExecNav');
    var tempVersionGrid = document.getElementById('tempVersionGrid');
    var tempExecToolbar = document.getElementById('tempExecToolbar');
    var tempExecToolbarCard = document.getElementById('tempExecToolbarCard');
    var tempexecFlowNav = document.getElementById('tempexecFlowNav');
    var toggleTempReqBtn = document.getElementById('toggleTempReq');
    var toggleTempVersionBtn = document.getElementById('toggleTempVersion');
    var createTempVersionBtn = document.getElementById('createTempVersionBtn');
    var tempExecAddCaseFromLibraryBtn = document.getElementById('tempExecAddCaseFromLibraryBtn');
    var tempExecViewFocusBlock = document.getElementById('tempExecViewFocusBlock');
    var tempExecViewFocusZone = tempExecViewFocusBlock
      ? tempExecViewFocusBlock.querySelector('[data-temp-focus-zone]')
      : null;
    var tempExecImportDrawerEl = document.getElementById('tempExecImportDrawer');
    var tempExecAssignDrawerEl = document.getElementById('tempExecAssignDrawer');
    var tempExecOverviewDrawerEl = document.getElementById('tempExecOverviewDrawer');
    var tempExecImportDiffDrawerEl = document.getElementById('tempExecImportDiffDrawer');
    var tempExecImportDiffTitle = document.getElementById('tempExecImportDiffTitle');
    var tempExecImportDiffStatus = document.getElementById('tempExecImportDiffStatus');
    var tempExecImportDiffMeta = document.getElementById('tempExecImportDiffMeta');
    var tempExecImportDiffLocateBar = document.getElementById('tempExecImportDiffLocateBar');
    var tempExecImportDiffBody = document.getElementById('tempExecImportDiffBody');
    var tempExecImportDiffOverwriteBtn = document.getElementById('tempExecImportDiffOverwriteBtn');
    var openTempExecImportDrawerBtn = document.getElementById('openTempExecImportDrawerBtn');
    var openTempExecAssignDrawerBtn = document.getElementById('openTempExecAssignDrawerBtn');
    var openTempExecCaseLibraryBtn = document.getElementById('openTempExecCaseLibraryBtn');
    var openTempExecCaseLibraryJumpBtn = document.getElementById('openTempExecCaseLibraryJumpBtn');
    var openTempExecViewNavBtn = document.getElementById('openTempExecViewNavBtn');
    var openTempExecOverviewNavBtn = document.getElementById('openTempExecOverviewNavBtn');
    var openTempExecBackupNavBtn = document.getElementById('openTempExecBackupNavBtn');
    var closeTempExecImportDrawerBtn = document.getElementById('closeTempExecImportDrawerBtn');
    var closeTempExecAssignDrawerBtn = document.getElementById('closeTempExecAssignDrawerBtn');
    var closeTempExecOverviewDrawerBtn = document.getElementById('closeTempExecOverviewDrawerBtn');
    var tempExecXmindViewBtn = document.getElementById('tempExecXmindViewBtn');
    var exportTempExecCasesXmindBtn = document.getElementById('exportTempExecCasesXmindBtn');
    var tempExecCaseLibraryChangesBtn = document.getElementById('tempExecCaseLibraryChangesBtn');
    var xmindStructureDrawerTitle = document.getElementById('xmindStructureDrawerTitle');
    var xmindStructureDrawerBody = document.getElementById('xmindStructureDrawerBody');
    var tempExecAiGenController = null;
    var tempExecImportDiffController = null;
    var tempExecDbImportWorkflowController = null;
    var tempExecTemplateWorkflow = null;
    var tempExecXmindLocateTimer = 0;
    var tempExecXmindLocateTarget = null;
    var tempExecXmindOwner = window.app && window.app.tempExecXmindOwner;
    if (!tempExecXmindOwner || typeof tempExecXmindOwner.create !== 'function') {
      throw new Error('temp exec XMind owner is required');
    }
    var tempExecXmind = tempExecXmindOwner.create({
      state: state,
      api: api,
      utils: utils,
      window: window,
      document: document,
      statusElement: tempExecStatus,
      titleElement: xmindStructureDrawerTitle,
      bodyElement: xmindStructureDrawerBody,
      setStatus: setStatus,
      normalizeRequirementName: normalizeRequirementName,
      safeLogOperation: safeLogOperation,
      jumpToCase: jumpToTempExecCase,
      flashLocate: flashTempExecXmindLocateHighlight,
      openConfirmDrawer: openConfirmDrawer,
    });
    var openTempExecXmindStructure = tempExecXmind.open;
    var triggerTempExecXmindExport = tempExecXmind.exportXmind;
    var tempExecTemplateWorkflowOwner = window.app && window.app.tempExecTemplateWorkflowOwner;
    if (!tempExecTemplateWorkflowOwner || typeof tempExecTemplateWorkflowOwner.create !== 'function') {
      throw new Error('temp exec template workflow owner is required');
    }
    tempExecTemplateWorkflow = tempExecTemplateWorkflowOwner.create({
      api: api,
      window: window,
      document: document,
      statusElement: tempExecStatus,
      setStatus: setStatus,
      escapeHtml: escapeHtml,
    });
    var navHoverFileId = '';
    var navHoverReqName = '';
    var debounce = utils.debounce || function(fn, wait) {
      var delay = Number(wait) || 150;
      var t = null;
      return function() {
        var args = arguments;
        var ctxThis = this;
        clearTimeout(t);
        t = setTimeout(function() {
          fn.apply(ctxThis, args);
        }, delay);
      };
    };
    function openConfirmDrawer(options) {
      if (utils && typeof utils.openConfirmDrawer === 'function') {
        return utils.openConfirmDrawer(options || {});
      }
      var msg = options && options.message ? String(options.message) : '';
      var ok = true;
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        ok = window.confirm(msg);
      }
      return Promise.resolve({ ok: ok });
    }

    function confirmRemoveFocus(fileId) {
      if (!fileId || !api || typeof api.getTempExecFile !== 'function' || typeof api.removeTempExecFocus !== 'function') return;
      var file = api.getTempExecFile(fileId);
      if (!file) return;
      var name = file && file.name ? String(file.name) : '测试用例';
      var prevDrawer = resolveTempExecActiveDrawer();
      openConfirmDrawer({
        title: '移出专注区',
        message: '确定将【' + name + '】移出专注区吗？',
        confirmText: '确认移出',
        cancelText: '取消',
        previousDrawer: prevDrawer || null,
      }).then(function(res) {
        if (!res || res.ok !== true) return;
        api.removeTempExecFocus(fileId, false);
      });
    }
    function resolveTempExecActiveDrawer() {
      var candidates = [
        tempExecArchiveReasonDrawer,
        tempExecImportDiffDrawer,
        tempExecImportDrawer,
        tempExecAssignDrawer,
        tempExecOverviewDrawer,
      ];
      for (var i = 0; i < candidates.length; i += 1) {
        var drawer = candidates[i];
        var el = drawer && drawer.element ? drawer.element : null;
        if (el && el.classList && el.classList.contains('open')) return drawer;
      }
      return null;
    }
    function getTempExecOrderedFileIdsSafe() {
      if (api && typeof api.getTempExecOrderedFileIds === 'function') {
        var ordered = api.getTempExecOrderedFileIds();
        return Array.isArray(ordered) ? ordered.slice() : [];
      }
      return (state.tempExecFiles || [])
        .map(function(file) { return file && file.id !== null && file.id !== undefined ? String(file.id) : ''; })
        .filter(Boolean);
    }
    function resolveTempExecCycleId(direction, requireDifferent) {
      var orderedIds = getTempExecOrderedFileIdsSafe();
      if (!orderedIds.length) return '';
      if (requireDifferent && orderedIds.length < 2) return '';
      var currentId = state && state.tempExecActiveId ? String(state.tempExecActiveId || '') : '';
      var idx = orderedIds.indexOf(currentId);
      if (idx === -1) idx = 0;
      var nextIdx = direction === 'prev' ? idx - 1 : idx + 1;
      if (nextIdx < 0) nextIdx = orderedIds.length - 1;
      if (nextIdx >= orderedIds.length) nextIdx = 0;
      var targetId = orderedIds[nextIdx] || '';
      if (requireDifferent && targetId && String(targetId) === String(currentId)) return '';
      return targetId;
    }
    function applyTempExecAfterArchive(nextId) {
      if (!api || typeof api.setTempExecActive !== 'function') return;
      var candidate = nextId ? String(nextId) : '';
      if (candidate && api.getTempExecFile && api.getTempExecFile(candidate)) {
        api.setTempExecActive(candidate);
        return;
      }
      var orderedIds = getTempExecOrderedFileIdsSafe();
      if (orderedIds.length) {
        api.setTempExecActive(orderedIds[0]);
      }
    }
    function promptTempVersionName(prevDrawer) {
      var drawerApi = window.app && window.app.confirmDrawer ? window.app.confirmDrawer : null;
      if (drawerApi && typeof drawerApi.open === 'function') {
        return drawerApi.open({
          title: '新建版本',
          message: '请输入版本名称',
          confirmText: '确认新增',
          cancelText: '取消',
          previousDrawer: prevDrawer || null,
          input: {
            label: '版本名称',
            placeholder: '请输入版本名称',
            required: true,
            requiredMessage: '请输入版本名称',
            maxLength: 50,
          },
        });
      }
      var name = window.prompt('请输入版本名称');
      var trimmed = name ? String(name).trim() : '';
      return Promise.resolve({ ok: Boolean(trimmed), value: trimmed });
    }
    function getCurrentUserId() {
      var globalState = window.app && window.app.state ? window.app.state : null;
      var user = globalState && globalState.currentUser ? globalState.currentUser : null;
      var userId = user && user.id !== undefined && user.id !== null ? user.id : null;
      if (!userId || String(userId) === '0') return null;
      return userId;
    }

    var tempExecAiGenControllerOwner = window.app && window.app.tempExecAiGenController;
    if (!tempExecAiGenControllerOwner || typeof tempExecAiGenControllerOwner.create !== 'function') {
      throw new Error('temp exec AI generation controller is required');
    }
    tempExecAiGenController = tempExecAiGenControllerOwner.create({
      state: state,
      core: core,
      utils: utils,
      config: config,
      api: api,
      context: ctx,
      document: document,
      window: window,
      statusElement: tempExecStatus,
      setStatus: setStatus,
      escapeHtml: escapeHtml,
      showToast: showTempExecCenterToast,
      openConfirmDrawer: openConfirmDrawer,
      getCurrentUserId: getCurrentUserId,
      modelOwner: ctx.caseLibraryAiGenModelOwner,
      storeOwner: ctx.caseLibraryAiGenStoreOwner,
      diffModel: ctx.caseLibraryDiffModel,
      viewOwner: window.app && window.app.tempExecAiGenViewOwner,
      taskRunnerOwner: window.app && window.app.casePageAiGenTaskRunner,
      toolbarOwner: window.app && window.app.tempExecAiGenToolbarOwner,
      taskStateOwner: window.app && window.app.tempExecAiGenTaskStateOwner,
      prepOwner: window.app && window.app.tempExecAiGenPrepOwner,
      fileParserOwner: window.app && window.app.casePageAiGenFileParser,
      apiClient: window.app && window.app.apiClient ? window.app.apiClient : null,
      xmindKnowledgeBaseApi: ctx.xmindKnowledgeBaseApi || null,
    });

    var tempExecImportDrawer = window.app.drawer && window.app.drawer.createDrawer({
      drawerId: 'tempExecImportDrawer',
      openButtons: ['openTempExecImportDrawerBtn'],
      closeButtons: ['closeTempExecImportDrawerBtn'],
      onOpen: function() {
        setCurrentPathSub('用例导入', 'tempexec');
      },
      onClose: tempExecTemplateWorkflow.close,
    });
    var tempExecAssignDrawer = window.app.drawer && window.app.drawer.createDrawer({
      drawerId: 'tempExecAssignDrawer',
      openButtons: ['openTempExecAssignDrawerBtn'],
      closeButtons: ['closeTempExecAssignDrawerBtn'],
      onOpen: function() {
        setCurrentPathSub('执行分配', 'tempexec');
        tempExecAiGenController.markAssignEntryBadgeRead();
        tempExecAiGenController.syncAssignEntryBadge();
        if (api && typeof api.renderTempVersionGrid === 'function') api.renderTempVersionGrid();
      },
    });
    var tempExecOverviewDrawer = window.app.drawer && window.app.drawer.createDrawer({
      drawerId: 'tempExecOverviewDrawer',
      openButtons: ['openTempExecOverviewNavBtn'],
      closeButtons: ['closeTempExecOverviewDrawerBtn'],
      onOpen: function() {
        setCurrentPathSub('归档操作&进度预览', 'tempexec');
      },
    });
    var tempExecArchiveWorkflowOwner = window.app && window.app.tempExecArchiveWorkflowOwner;
    if (!tempExecArchiveWorkflowOwner || typeof tempExecArchiveWorkflowOwner.create !== 'function') {
      throw new Error('temp exec archive workflow owner is required');
    }
    var tempExecArchiveWorkflow = tempExecArchiveWorkflowOwner.create({
      state: state,
      api: api,
      window: window,
      document: document,
      drawerManager: window.app && window.app.drawer ? window.app.drawer : null,
      mainStatus: tempExecStatus,
      setStatus: setStatus,
      showOverview: showTempExecOverview,
      getApiClient: function() { return window.app && window.app.apiClient ? window.app.apiClient : null; },
      getConfirmDrawer: function() { return window.app && window.app.confirmDrawer ? window.app.confirmDrawer : null; },
    });
    var tempExecArchiveReasonDrawer = tempExecArchiveWorkflow.getDrawer();
    var requestTempExecArchive = tempExecArchiveWorkflow.requestArchive;
    var tempExecAssignRequestSessionKey = 'tap-temp-exec-assign-request';

    function isTempExecActive() {
      var globalState = window.app && window.app.state ? window.app.state : {};
      if (globalState && globalState.activeTab === 'tempexec') return true;
      var visible = document.querySelector('section[data-tab-section="tempexec"]:not(.hidden)');
      return Boolean(visible);
    }

    function readTempExecAssignRequest() {
      var payload = null;
      try {
        if (window.app && window.app.__tempExecAssignRequest) payload = window.app.__tempExecAssignRequest;
      } catch (err) {
        // ignore
      }
      if (!payload && typeof sessionStorage !== 'undefined') {
        try {
          var raw = sessionStorage.getItem(tempExecAssignRequestSessionKey);
          if (raw) payload = JSON.parse(raw);
        } catch (err2) {
          payload = null;
        }
      }
      if (!payload || typeof payload !== 'object') return null;
      return payload;
    }

    function clearTempExecAssignRequest() {
      try {
        if (window.app) window.app.__tempExecAssignRequest = null;
      } catch (err) {
        // ignore
      }
      if (typeof sessionStorage !== 'undefined') {
        try {
          sessionStorage.removeItem(tempExecAssignRequestSessionKey);
        } catch (err2) {
          // ignore
        }
      }
    }

    function buildTempExecAssignToast(payload) {
      var name = payload && (payload.caseName || payload.name || payload.case_name) ? (payload.caseName || payload.name || payload.case_name) : '';
      var version = payload && (payload.versionName || payload.version || payload.version_name)
        ? (payload.versionName || payload.version || payload.version_name)
        : '';
      var caseLabel = name ? String(name) : '用例';
      var versionLabel = version ? String(version) : '未分配版本';
      return '用例：【' + caseLabel + '】已成功转到用例执行页内，请在当前【执行分配】页内查看选择。';
    }

    function openTempExecAssignDrawerFromRequest() {
      if (!isTempExecActive()) return false;
      if (window.app && window.app.drawer && typeof window.app.drawer.closeAllDrawers === 'function') {
        window.app.drawer.closeAllDrawers();
      }
      if (tempExecAssignDrawer && typeof tempExecAssignDrawer.open === 'function') {
        tempExecAssignDrawer.open();
        return true;
      }
      if (openTempExecAssignDrawerBtn && typeof openTempExecAssignDrawerBtn.click === 'function') {
        openTempExecAssignDrawerBtn.click();
        return true;
      }
      return false;
    }

    function applyTempExecAssignRequest(payload) {
      if (!payload) return false;
      var opened = openTempExecAssignDrawerFromRequest();
      if (!opened) return false;
      var msg = buildTempExecAssignToast(payload);
      if (utils && typeof utils.showCenterToast === 'function') {
        utils.showCenterToast(msg, 'ok', 5000);
      } else if (typeof showTempExecCenterToast === 'function') {
        showTempExecCenterToast(msg, 'ok');
      }
      return true;
    }

    function consumeTempExecAssignRequest() {
      var payload = readTempExecAssignRequest();
      if (!payload) return false;
      var applied = applyTempExecAssignRequest(payload);
      if (applied) clearTempExecAssignRequest();
      return applied;
    }

    function showTempExecCenterToast(text, level) {
      var msg = text === null || text === undefined ? '' : String(text);
      if (!msg) return;
      var kind = level === 'err' ? 'err' : (level === 'warn' ? 'warn' : 'ok');
      try {
        var app = window.app || {};
        window.app = app;
        var key = '__tapTempExecToast';
        var store = app[key] && typeof app[key] === 'object' ? app[key] : {};
        if (store.timer) {
          clearTimeout(store.timer);
          store.timer = 0;
        }
        if (store.fadeTimer) {
          clearTimeout(store.fadeTimer);
          store.fadeTimer = 0;
        }
        if (store.el && store.el.parentNode) {
          try { store.el.parentNode.removeChild(store.el); } catch (_) {}
        }
        var el = document.createElement('div');
        el.className = 'temp-center-toast ' + kind;
        el.textContent = msg;
        document.body.appendChild(el);
        store.el = el;
        store.timer = setTimeout(function() {
          if (!store.el) return;
          store.el.classList.add('fade-out');
          store.fadeTimer = setTimeout(function() {
            if (store.el && store.el.parentNode) {
              try { store.el.parentNode.removeChild(store.el); } catch (_) {}
            }
            store.el = null;
            store.timer = 0;
            store.fadeTimer = 0;
          }, 260);
        }, 3500);
        app[key] = store;
      } catch (err) {
        // ignore
      }
    }
    var tempExecImportDiffDrawer = window.app.drawer && window.app.drawer.createDrawer({
      drawerId: 'tempExecImportDiffDrawer',
      openButtons: [],
      closeButtons: [],
      onClose: function() {
        if (tempExecImportDiffController) tempExecImportDiffController.handleDrawerClose();
      },
    });
    var tempExecImportDiffModel = window.app && window.app.tempExecImportDiffModel;
    var tempExecImportDiffOwner = window.app && window.app.tempExecImportDiffOwner;
    if (!tempExecImportDiffModel || typeof tempExecImportDiffModel.buildComparison !== 'function') {
      throw new Error('temp exec import diff model is required');
    }
    if (!tempExecImportDiffOwner || typeof tempExecImportDiffOwner.create !== 'function') {
      throw new Error('temp exec import diff owner is required');
    }
    tempExecImportDiffController = tempExecImportDiffOwner.create({
      model: tempExecImportDiffModel,
      api: api,
      getState: function() { return importDiffState; },
      getApiClient: function() { return apiClient; },
      drawer: tempExecImportDiffDrawer,
      importDrawer: tempExecImportDrawer,
      assignDrawer: tempExecAssignDrawer,
      drawerElement: tempExecImportDiffDrawerEl,
      mainStatus: tempExecStatus,
      titleElement: tempExecImportDiffTitle,
      statusElement: tempExecImportDiffStatus,
      metaElement: tempExecImportDiffMeta,
      locateBarElement: tempExecImportDiffLocateBar,
      bodyElement: tempExecImportDiffBody,
      overwriteButton: tempExecImportDiffOverwriteBtn,
      setStatus: setStatus,
      escapeHtml: escapeHtml,
      debounce: debounce,
      openConfirmDrawer: openConfirmDrawer,
      clearPendingImport: function() {
        if (tempExecDbImportWorkflowController) tempExecDbImportWorkflowController.clearPendingFiles();
      },
    });
    var detectExecCasesHasResult = tempExecImportDiffModel.detectExecCasesHasResult;
    var openImportDiffDrawerLoading = tempExecImportDiffController.openLoading;
    var openImportDiffDrawer = tempExecImportDiffController.open;
    var confirmOverwriteImportFromDiff = tempExecImportDiffController.confirmOverwrite;
    if (tempExecImportDrawer || tempExecAssignDrawer) {
      var tabButtons = document.querySelectorAll('[data-tab-btn]');
      tabButtons.forEach(function(btn) {
        btn.addEventListener('click', function() {
          if (btn && btn.dataset && btn.dataset.tabBtn !== 'tempexec') {
            if (tempExecImportDrawer) tempExecImportDrawer.close();
            if (tempExecAssignDrawer) tempExecAssignDrawer.close();
            if (tempExecOverviewDrawer) tempExecOverviewDrawer.close();
          }
        });
      });
    }
    function showTempExecView(options) {
      var shouldScroll = !options || options.scroll !== false;
      var shouldReload = !options || options.reload !== false;
      if (!state || String(state.activeTab || '') !== 'tempexec') {
        switchTab('tempexec');
      }
      setCurrentPathSub('执行视图', 'tempexec');
      updateTempExecToolbarOffset();
      if (tempExecOverviewDrawer) tempExecOverviewDrawer.close();
      if (tempExecImportDrawer) tempExecImportDrawer.close();
      if (tempExecAssignDrawer) tempExecAssignDrawer.close();
      if (tempExecViewSection) {
        tempExecViewSection.classList.remove('hidden');
        if (shouldScroll) {
          scrollElementIntoView(tempExecViewSection, 'smooth', 140);
        }
      }
      // 再次打开“执行视图”时也触发一次“用例库同步+diff 检查”（仅 DB 模式会产生实际同步）。
      // 注意：这里只递增触发序号，不会改变当前已选中的执行用例。
      try {
        if (window.app) {
          var prev = Number(window.app.__tempexecCaseLibrarySyncSeq || 0);
          if (!isFinite(prev) || prev < 0) prev = 0;
          window.app.__tempexecCaseLibrarySyncSeq = prev + 1;
          window.app.__tempexecCaseLibrarySyncReason = 'view-enter';
        }
      } catch (err) {
        // ignore
      }
      try {
        var loadPromise = null;
        if (shouldReload && window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
          loadPromise = window.app.tempExecApi.loadTempExecState();
        }
        var tryAutoOpen = function() {
          try {
            if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.tryAutoOpenTempExecCaseLibraryDiff === 'function') {
              window.app.tempExecApi.tryAutoOpenTempExecCaseLibraryDiff();
            }
          } catch (err3) {
            // ignore
          }
        };
        if (loadPromise && typeof loadPromise.then === 'function') {
          Promise.resolve(loadPromise).then(tryAutoOpen);
        } else {
          setTimeout(tryAutoOpen, 0);
        }
      } catch (err2) {
        // ignore
      }
    }
    function showTempExecOverview() {
      switchTab('tempexec');
      setCurrentPathSub('归档操作&进度预览', 'tempexec');
      updateTempExecToolbarOffset();
      if (tempExecImportDrawer) tempExecImportDrawer.close();
      if (tempExecAssignDrawer) tempExecAssignDrawer.close();
      if (tempExecOverviewDrawer) tempExecOverviewDrawer.open();
      if (tempExecOverviewSection) {
        tempExecOverviewSection.classList.remove('hidden');
      }
      var drawerBody = tempExecOverviewDrawerEl && tempExecOverviewDrawerEl.querySelector('.drawer-body');
      if (drawerBody) drawerBody.scrollTop = 0;
    }

    function handlePathSubJump(event) {
      var detail = event && event.detail ? event.detail : null;
      if (!detail || detail.tab !== 'tempexec') return;
      var label = detail.sub ? String(detail.sub) : '';
      if (!label) return;
      if (label.indexOf('用例导入') !== -1) {
        if (tempExecImportDrawer && typeof tempExecImportDrawer.open === 'function') tempExecImportDrawer.open();
        return;
      }
      if (label.indexOf('执行分配') !== -1) {
        if (tempExecAssignDrawer && typeof tempExecAssignDrawer.open === 'function') tempExecAssignDrawer.open();
        return;
      }
      if (label.indexOf('归档操作') !== -1) {
        showTempExecOverview();
        return;
      }
      if (label.indexOf('执行视图') !== -1) {
        showTempExecView();
      }
    }

    window.addEventListener('app-path-sub-jump', handlePathSubJump);

    function clearTempExecXmindLocateHighlight() {
      if (tempExecXmindLocateTimer) {
        clearTimeout(tempExecXmindLocateTimer);
        tempExecXmindLocateTimer = 0;
      }
      if (tempExecXmindLocateTarget && tempExecXmindLocateTarget.classList) {
        tempExecXmindLocateTarget.classList.remove('xmind-locate-highlight');
      }
      tempExecXmindLocateTarget = null;
    }

    function flashTempExecXmindLocateHighlight(fileId, idx, durationMs) {
      var duration = Number(durationMs);
      if (!isFinite(duration) || duration <= 0) duration = 3200;
      var attempts = 0;
      var maxAttempts = 30;

      function tryApply() {
        attempts += 1;
        if (!tempExecView || typeof tempExecView.querySelector !== 'function') return;
        var selector = 'tr.case-row[data-temp-case-row="' + String(fileId) + '"][data-index="' + String(idx) + '"]';
        var row = tempExecView.querySelector(selector);
        if (!row) {
          if (attempts < maxAttempts) setTimeout(tryApply, 60);
          return;
        }

        if (tempExecXmindLocateTarget && tempExecXmindLocateTarget !== row) {
          clearTempExecXmindLocateHighlight();
        } else if (tempExecXmindLocateTimer) {
          clearTimeout(tempExecXmindLocateTimer);
          tempExecXmindLocateTimer = 0;
        }

        tempExecXmindLocateTarget = row;
        if (row.classList) row.classList.add('xmind-locate-highlight');
        tempExecXmindLocateTimer = setTimeout(function() {
          if (tempExecXmindLocateTarget === row && row.classList) {
            row.classList.remove('xmind-locate-highlight');
          }
          if (tempExecXmindLocateTarget === row) tempExecXmindLocateTarget = null;
          tempExecXmindLocateTimer = 0;
        }, duration);
      }

      setTimeout(tryApply, 80);
    }

    function scrollToTempExecCaseRow(fileId, idx, options) {
      var opts = options && typeof options === 'object' ? options : {};
      var attempts = 0;
      var maxAttempts = 30;
      var delay = Number(opts.delayMs);
      if (!Number.isFinite(delay) || delay < 0) delay = 0;
      if (!delay && opts.waitForDrawerUnlock) {
        var closing = false;
        if (tempExecOverviewDrawerEl && tempExecOverviewDrawerEl.classList) {
          closing = closing || tempExecOverviewDrawerEl.classList.contains('closing');
          closing = closing || tempExecOverviewDrawerEl.classList.contains('open');
        }
        if (tempExecImportDrawerEl && tempExecImportDrawerEl.classList) {
          closing = closing || tempExecImportDrawerEl.classList.contains('closing');
          closing = closing || tempExecImportDrawerEl.classList.contains('open');
        }
        if (tempExecAssignDrawerEl && tempExecAssignDrawerEl.classList) {
          closing = closing || tempExecAssignDrawerEl.classList.contains('closing');
          closing = closing || tempExecAssignDrawerEl.classList.contains('open');
        }
        // 抽屉关闭时会恢复 window.scrollTo(lockedScrollTop)，需要等解锁后再滚动到目标行，避免出现“先跳再被拉回”的上滚抖动。
        delay = closing ? 520 : 80;
      }
      function tryScroll() {
        attempts += 1;
        if (!tempExecView) return;
        var selector = 'tr.case-row[data-temp-case-row="' + String(fileId) + '"][data-index="' + String(idx) + '"]';
        var target = tempExecView.querySelector(selector);
        if (!target) {
          target = tempExecView.querySelector('[data-temp-result="' + String(fileId) + '"][data-index="' + String(idx) + '"]');
        }
        if (!target) {
          target = tempExecView.querySelector('[data-temp-remark="' + String(fileId) + '"][data-index="' + String(idx) + '"]');
        }
        if (target) {
          scrollElementIntoView(target, 'auto', 160);
          return;
        }
        if (attempts < maxAttempts) setTimeout(tryScroll, 40);
      }
      setTimeout(tryScroll, delay || 0);
    }

    function scrollToTempExecViewTop(options) {
      var opts = options && typeof options === 'object' ? options : {};
      var delay = Number(opts.delayMs);
      if (!Number.isFinite(delay) || delay < 0) delay = 0;
      if (!delay && opts.waitForDrawerUnlock) {
        var closing = false;
        if (tempExecOverviewDrawerEl && tempExecOverviewDrawerEl.classList) {
          closing = closing || tempExecOverviewDrawerEl.classList.contains('closing');
          closing = closing || tempExecOverviewDrawerEl.classList.contains('open');
        }
        if (tempExecImportDrawerEl && tempExecImportDrawerEl.classList) {
          closing = closing || tempExecImportDrawerEl.classList.contains('closing');
          closing = closing || tempExecImportDrawerEl.classList.contains('open');
        }
        if (tempExecAssignDrawerEl && tempExecAssignDrawerEl.classList) {
          closing = closing || tempExecAssignDrawerEl.classList.contains('closing');
          closing = closing || tempExecAssignDrawerEl.classList.contains('open');
        }
        delay = closing ? 520 : 0;
      }
      setTimeout(function() {
        if (tempExecViewSection) {
          scrollElementIntoView(tempExecViewSection, 'auto', 140);
        } else if (tempExecView) {
          scrollElementIntoView(tempExecView, 'auto', 140);
        }
      }, delay || 0);
    }

    function jumpToTempExecCase(fileId, caseIndex) {
      if (!fileId) return;
      var idx = Number(caseIndex);
      if (!Number.isFinite(idx) || idx < 0) idx = 0;
      var liveApi = window.app && window.app.tempExecApi ? window.app.tempExecApi : api;
      var globalState = window.app && window.app.state ? window.app.state : state;

      if (globalState && globalState.activeTab !== 'tempexec') {
        switchTab('tempexec');
      }
      updateTempExecToolbarOffset();
      try {
        if (window.app) window.app.__drawerSkipRestoreOnce = true;
      } catch (err) {
        // ignore
      }
      if (tempExecOverviewDrawer) tempExecOverviewDrawer.close();
      if (tempExecImportDrawer) tempExecImportDrawer.close();
      if (tempExecAssignDrawer) tempExecAssignDrawer.close();
      if (tempExecOverviewSection) tempExecOverviewSection.classList.add('hidden');
      if (tempExecViewSection) tempExecViewSection.classList.remove('hidden');

      if (liveApi && typeof liveApi.jumpToTempExecCase === 'function') {
        liveApi.jumpToTempExecCase(fileId, idx, { clearFilters: true });
      } else {
        if (globalState && (!globalState.tempExecPages || typeof globalState.tempExecPages !== 'object')) globalState.tempExecPages = {};
        var size = defaultTempExecPageSize;
        if (liveApi && typeof liveApi.getTempExecPageSize === 'function') size = Number(liveApi.getTempExecPageSize());
        if (!Number.isFinite(size) || size <= 0) size = defaultTempExecPageSize;
        var pageIndex = Math.floor(idx / size);
        if (globalState && globalState.tempExecPages && typeof globalState.tempExecPages === 'object') {
          globalState.tempExecPages[fileId] = pageIndex;
        }
        if (liveApi && typeof liveApi.setTempExecActive === 'function') liveApi.setTempExecActive(fileId);
      }

      scrollToTempExecCaseRow(fileId, idx, { waitForDrawerUnlock: true });
    }
    function focusTempExecBackup() {
      switchTab('tempexec');
      if (tempExecImportDrawer) tempExecImportDrawer.open();
      var drawerBody = tempExecImportDrawerEl && tempExecImportDrawerEl.querySelector('.drawer-body');
      if (drawerBody) drawerBody.scrollTop = 0;
      if (exportTempExecConfigBtn && typeof exportTempExecConfigBtn.focus === 'function') {
        exportTempExecConfigBtn.focus({ preventScroll: true });
      }
    }
    function openCaseLibrarySelectExecFromTempExec() {
      var selectExecRequestKey = 'tap-case-library-select-exec-request';
      try {
        if (window.app) window.app.__drawerSkipRestoreOnce = true;
      } catch (err) {
        // ignore
      }
      if (window.app && window.app.drawer && typeof window.app.drawer.closeAllDrawers === 'function') {
        window.app.drawer.closeAllDrawers();
      }
      var hasSelectExecDrawer = Boolean(document.getElementById('caseLibrarySelectExecDrawer'));
      if (window.app && window.app.caseLibraryApi && typeof window.app.caseLibraryApi.openSelectExecDrawer === 'function') {
        var opened = false;
        if (hasSelectExecDrawer) {
          opened = window.app.caseLibraryApi.openSelectExecDrawer({ source: 'tempexec', allowInactive: true });
        }
        if (opened) return;
        if (!hasSelectExecDrawer) {
          if (typeof window.app.caseLibraryApi.requestSelectExecDrawer === 'function') {
            window.app.caseLibraryApi.requestSelectExecDrawer();
          } else {
            window.app.caseLibraryApi.openSelectExecDrawer({ source: 'tempexec' });
            if (typeof sessionStorage !== 'undefined') {
              try {
                sessionStorage.setItem(selectExecRequestKey, '1');
              } catch (err) {
                // ignore
              }
            }
          }
        }
      } else if (!hasSelectExecDrawer) {
        try {
          if (window.app) window.app.__caseLibrarySelectExecRequest = true;
        } catch (err) {
          // ignore
        }
        if (typeof sessionStorage !== 'undefined') {
          try {
            sessionStorage.setItem(selectExecRequestKey, '1');
          } catch (err) {
            // ignore
          }
        }
      }
      if (!hasSelectExecDrawer && typeof switchTab === 'function') switchTab('case-library');
    }
    function openCaseLibraryFromTempExec() {
      try {
        if (window.app) window.app.__drawerSkipRestoreOnce = true;
      } catch (err) {
        // ignore
      }
      if (window.app && window.app.drawer && typeof window.app.drawer.closeAllDrawers === 'function') {
        window.app.drawer.closeAllDrawers();
      }
      if (typeof switchTab === 'function') switchTab('case-library');
    }
    if (openTempExecViewNavBtn) {
      openTempExecViewNavBtn.addEventListener('click', function() {
        showTempExecView();
      });
    }
    if (openTempExecOverviewNavBtn) {
      openTempExecOverviewNavBtn.addEventListener('click', function() {
        showTempExecOverview();
      });
    }
    if (openTempExecBackupNavBtn) {
      openTempExecBackupNavBtn.addEventListener('click', function() {
        focusTempExecBackup();
      });
    }
    if (openTempExecCaseLibraryBtn) {
      openTempExecCaseLibraryBtn.addEventListener('click', function() {
        openCaseLibrarySelectExecFromTempExec();
      });
    }
    if (openTempExecCaseLibraryJumpBtn) {
      openTempExecCaseLibraryJumpBtn.addEventListener('click', function() {
        openCaseLibraryFromTempExec();
      });
    }

    var lastToolbarNavHeight = 0;
    function updateTempExecToolbarOffset() {
      if (!tempexecFlowNav) return;
      var rect = tempexecFlowNav.getBoundingClientRect ? tempexecFlowNav.getBoundingClientRect() : null;
      var height = rect && rect.height ? rect.height : (tempexecFlowNav.scrollHeight || 0);
      if (!height && tempexecFlowNav.classList && tempexecFlowNav.classList.contains('hidden')) return;
      var resolved = height && height > 0 ? height : 120;
      if (Math.abs(resolved - lastToolbarNavHeight) < 1) return;
      lastToolbarNavHeight = resolved;
      document.documentElement.style.setProperty('--tempexec-nav-height', Math.round(resolved) + 'px');
    }
    var updateToolbarOffsetDebounced = debounce(updateTempExecToolbarOffset, 200);
    window.addEventListener('resize', updateToolbarOffsetDebounced);
    function syncTempExecReuseStatusAlign() {
      if (api && typeof api.syncTempExecReuseStatusAlign === 'function') {
        api.syncTempExecReuseStatusAlign();
      }
    }
    var syncReuseStatusAlignDebounced = debounce(syncTempExecReuseStatusAlign, 200);
    window.addEventListener('resize', syncReuseStatusAlignDebounced);
    setTimeout(updateTempExecToolbarOffset, 80);
    setTimeout(syncTempExecReuseStatusAlign, 120);
  function clearTempNavDragHints() {
    tempExecNav.querySelectorAll('.dragover').forEach(function(el) { el.classList.remove('dragover'); });
    tempExecNav.querySelectorAll('.dragover-target').forEach(function(el) { el.classList.remove('dragover-target'); });
    navHoverFileId = '';
    clearNavPlaceholder();
  }
    var navPlaceholderEl = null;
    function clearNavPlaceholder() {
      if (navPlaceholderEl && navPlaceholderEl.parentNode) {
        navPlaceholderEl.parentNode.removeChild(navPlaceholderEl);
      }
      navPlaceholderEl = null;
    }
    function renderNavPlaceholder(container, beforeId) {
      if (!container) {
        clearNavPlaceholder();
        return;
      }
      var list = container.classList.contains('temp-req-grid')
        ? container
        : container.querySelector('.temp-req-list');
      if (!list) {
        clearNavPlaceholder();
        return;
      }
      if (!navPlaceholderEl) {
        navPlaceholderEl = document.createElement('div');
        navPlaceholderEl.className = 'temp-drag-placeholder';
        navPlaceholderEl.textContent = '放置到此';
      }
      if (navPlaceholderEl.parentNode !== list) {
        list.appendChild(navPlaceholderEl);
      }
      if (beforeId) {
        var targetRow = list.querySelector('[data-temp-file="' + beforeId + '"]');
        if (targetRow && targetRow !== navPlaceholderEl.nextSibling) {
          list.insertBefore(navPlaceholderEl, targetRow);
          return;
        }
      }
      // ensure placeholder stays visible without forcing reflow
      list.appendChild(navPlaceholderEl);
    }
    function setNavHoverTarget(container, pointerY) {
      if (!container) return;
      var rows = Array.from(container.querySelectorAll('[data-temp-file]'));
      var candidateId = '';
      rows.some(function(row) {
        var rect = row.getBoundingClientRect();
        if (pointerY < rect.top + rect.height / 2) {
          candidateId = row.dataset.tempFile || '';
          return true;
        }
        return false;
      });
      navHoverFileId = candidateId;
      rows.forEach(function(row) {
        row.classList.toggle('dragover-target', row.dataset.tempFile === navHoverFileId);
      });
    }
    var tempExecView = document.getElementById('tempExecView');
    var tempExecMindBtn = document.getElementById('tempExecMindBtn');
    var tempExecOverview = document.getElementById('tempExecOverview');
    var tempExecOverviewSection = document.querySelector('[data-section-id="tempexec-overview"]');
    var tempExecViewSection = document.querySelector('[data-section-id="tempexec-view"]');
    var tempExecBackBtn = document.getElementById('tempExecBackBtn');
    var exportTempExecConfigBtn = document.getElementById('exportTempExecConfigBtn');
    var exportTempExecXmindBtn = document.getElementById('exportTempExecXmindBtn');
    var importTempExecConfigBtn = document.getElementById('importTempExecConfigBtn');
    var importTempExecConfigFile = document.getElementById('importTempExecConfigFile');
    var tempExecPageSizeInput = document.getElementById('tempExecPageSizeInput');
    var tempExecPageSizeStatus = document.getElementById('tempExecPageSizeStatus');
    var saveTempExecPageSizeBtn = document.getElementById('saveTempExecPageSize');
    var tempFocusBlock = document.getElementById('tempFocusBlock');
    var tempFocusZone = tempFocusBlock ? tempFocusBlock.querySelector('[data-temp-focus-zone]') : null;
    var tempExecReusePanelLifecycleOwner = window.app && window.app.tempExecReusePanelLifecycleOwner;
    if (!tempExecReusePanelLifecycleOwner || typeof tempExecReusePanelLifecycleOwner.create !== 'function') {
      throw new Error('temp exec reuse panel lifecycle owner is required');
    }
    var tempExecReusePanelLifecycle = tempExecReusePanelLifecycleOwner.create({
      state: state,
      api: api,
      window: window,
      document: document,
      view: tempExecView,
      viewSection: tempExecViewSection,
    });
    var autoCollapseTempExecReusePanels = tempExecReusePanelLifecycle.autoCollapse;
    var bindTempExecReuseAutoCollapse = tempExecReusePanelLifecycle.bind;

    var apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
    function safeLogOperation(action, targetType, targetId, detail, result) {
      if (!apiClient || typeof apiClient.createOperationLogEvent !== 'function') return;
      try {
        apiClient.createOperationLogEvent({
          action: action,
          target_type: targetType,
          target_id: targetId,
          result: result || undefined,
          detail: detail || null,
        }).catch(function() {
          // ignore
        });
      } catch (err) {
        // ignore
      }
    }
    var importDiffState = {
      loading: false,
      confirming: false,
      fileName: '',
      cleanName: '',
      projectId: null,
      importVersionId: null,
      dbVersionId: null,
      ext: '',
      source: '',
      importItems: [],
      importExecCases: [],
      importHasResult: false,
      importReuseEnabled: false,
      requirement: '',
      dbCaseFileId: null,
      dbItems: [],
      dbExecSetId: null,
      dbExecCases: [],
      dbReuseEnabled: false,
      dbHasResult: false,
      showResultFields: false,
      rows: [],
      locateIndex: -1,
      diffCounts: { added: 0, removed: 0, changed: 0, total: 0 },
      external: null,
      queue: { active: false, total: 0, index: -1 },
    };
    var tempExecDbImportWorkflowOwner = window.app && window.app.tempExecDbImportWorkflowOwner;
    if (!tempExecDbImportWorkflowOwner || typeof tempExecDbImportWorkflowOwner.create !== 'function') {
      throw new Error('temp exec database import workflow owner is required');
    }
    tempExecDbImportWorkflowController = tempExecDbImportWorkflowOwner.create({
      state: state,
      window: window,
      api: api,
      apiClient: apiClient,
      utils: utils,
      importDrawer: tempExecImportDrawer,
      diffDrawer: tempExecImportDiffDrawer,
      mainStatus: tempExecStatus,
      diffStatus: tempExecImportDiffStatus,
      setStatus: setStatus,
      escapeHtml: escapeHtml,
      getDiffState: function() { return importDiffState; },
      openDiffLoading: openImportDiffDrawerLoading,
      openDiff: openImportDiffDrawer,
      confirmOverwrite: confirmOverwriteImportFromDiff,
      detectExecCasesHasResult: detectExecCasesHasResult,
      dom: {
        fileInput: tempExecInput,
        dropZone: tempExecDropZone,
        fileHint: tempExecImportFileHint,
        projectSelect: tempExecImportProjectSelect,
        versionSelect: tempExecImportVersionSelect,
        confirmButton: tempExecImportConfirmBtn,
        diffOverwriteButton: tempExecImportDiffOverwriteBtn,
      },
    });

    if (typeof api.loadTempExecState === 'function') {
      api.loadTempExecState();
    }


    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('app-tab-activated', function(e) {
        var tabName = e && e.detail ? e.detail.tab : '';
        if (tabName !== 'tempexec') return;
        tempExecDbImportWorkflowController.ensureProjects();
        // 本地模式以内存状态为准；只有 DB 模式在页签激活时重新取数。
        try {
          var loadPromise = null;
          if (typeof api.refreshTempExecStateOnTabActivation === 'function') {
            loadPromise = api.refreshTempExecStateOnTabActivation();
          }
          var tryAutoOpen = function() {
            try {
              if (typeof api.tryAutoOpenTempExecCaseLibraryDiff === 'function') {
                api.tryAutoOpenTempExecCaseLibraryDiff();
              }
            } catch (_) {
              // ignore
            }
          };
          var trySyncAiGen = function() {
            try {
              tempExecAiGenController.syncContext();
            } catch (_) {
              // ignore
            }
          };
          if (loadPromise && typeof loadPromise.then === 'function') {
            Promise.resolve(loadPromise).then(function() {
              tryAutoOpen();
              trySyncAiGen();
            });
          } else {
            setTimeout(function() {
              tryAutoOpen();
              trySyncAiGen();
            }, 0);
          }
        } catch (err) {
          // ignore
        }
        consumeTempExecAssignRequest();
      });
      window.addEventListener('temp-exec-assign-request', function(e) {
        var payload = e && e.detail ? e.detail : null;
        if (!payload) return;
        if (applyTempExecAssignRequest(payload)) {
          clearTempExecAssignRequest();
        }
      });
      window.addEventListener('app-auth-ready', function() {
        tempExecDbImportWorkflowController.ensureProjects();
        // authReady 后 DB 能力才完整可用：补一次加载，确保“历史执行记录/个人执行集”能立即展示。
        try {
          var loadPromise = null;
          if (typeof api.loadTempExecState === 'function') {
            loadPromise = api.loadTempExecState();
          }
          var tryAutoOpen = function() {
            try {
              if (typeof api.tryAutoOpenTempExecCaseLibraryDiff === 'function') {
                api.tryAutoOpenTempExecCaseLibraryDiff();
              }
            } catch (_) {
              // ignore
            }
          };
          var trySyncAiGen = function() {
            try {
              tempExecAiGenController.syncContext();
            } catch (_) {
              // ignore
            }
          };
          if (loadPromise && typeof loadPromise.then === 'function') {
            Promise.resolve(loadPromise).then(function() {
              tryAutoOpen();
              trySyncAiGen();
            });
          } else {
            setTimeout(function() {
              tryAutoOpen();
              trySyncAiGen();
            }, 0);
          }
        } catch (err2) {
          // ignore
        }
      });
      window.addEventListener('app-projects-updated', function() {
        tempExecDbImportWorkflowController.invalidateProjectsCache();
        var globalState = window.app && window.app.state ? window.app.state : {};
        var tabName = globalState && globalState.activeTab ? globalState.activeTab : '';
        if (tabName === 'tempexec') {
          tempExecDbImportWorkflowController.ensureProjects();
          // 版本删除并转移后，需要同步刷新执行区的项目/版本分组
          if (typeof api.loadTempExecState === 'function') {
            var reloadPromise = api.loadTempExecState();
            if (reloadPromise && typeof reloadPromise.then === 'function') {
              Promise.resolve(reloadPromise).then(function() {
                tempExecAiGenController.syncContext();
              });
            } else {
              setTimeout(function() {
                tempExecAiGenController.syncContext();
              }, 0);
            }
          }
        }
      });
      window.addEventListener('case-library-ai-gen-task', function(e) {
        var detail = e && e.detail ? e.detail : null;
        if (!detail || detail.scene !== 'temp-exec') return;
        tempExecAiGenController.applyTaskState(detail.task);
      });
    }
    tempExecDbImportWorkflowController.init();
    consumeTempExecAssignRequest();
    state.onTempExecActiveChange = function() {
      tempExecAiGenController.syncContext();
    };
    state.onTempExecFocusChange = function() {
      tempExecAiGenController.syncAssignEntryBadge();
    };
    tempExecAiGenController.syncContext();
    tempExecAiGenController.syncAssignEntryBadge();

    tempExecTemplateWorkflow.init();

    if (tempExecToolbar) {
      var applyTempExecSearchDebounced = debounce(function(fileId, raw) {
        if (!api.applyTempExecSearch) return;
        api.applyTempExecSearch(fileId, raw, raw);
      }, 200);
      tempExecToolbar.addEventListener('compositionstart', function(e) {
        var target = e && e.target ? e.target : null;
        if (!target || !target.dataset || target.dataset.tempSearchInput === undefined) return;
        target.dataset.tempSearchComposed = '0';
        target.dataset.tempSearchComposing = '1';
        if (applyTempExecSearchDebounced.cancel) applyTempExecSearchDebounced.cancel();
      });
      tempExecToolbar.addEventListener('compositionend', function(e) {
        var target = e && e.target ? e.target : null;
        if (!target || !target.dataset || target.dataset.tempSearchInput === undefined) return;
        target.dataset.tempSearchComposed = '1';
        delete target.dataset.tempSearchComposing;
        var fileId = target.dataset.tempSearchInput;
        var val = target.value || '';
        applyTempExecSearchDebounced(fileId, val);
      });
      tempExecToolbar.addEventListener('input', function(e) {
        var target = e && e.target ? e.target : null;
        if (!target || !target.dataset || target.dataset.tempSearchInput === undefined) return;
        if (target.dataset.tempSearchComposing === '1') return;
        if (target.dataset.tempSearchComposed === '1') {
          delete target.dataset.tempSearchComposed;
          return;
        }
        if (e && (e.isComposing === true || e.inputType === 'insertCompositionText')) return;
        var fileId = target.dataset.tempSearchInput;
        var val = target.value || '';
        applyTempExecSearchDebounced(fileId, val);
      });
      tempExecToolbar.addEventListener('click', function(e) {
        var navBtn = e.target.closest('[data-temp-file-nav]');
        if (navBtn) {
          if (navBtn.disabled) return;
          var dir = navBtn.dataset ? (navBtn.dataset.tempFileNav || '') : '';
          if (dir !== 'prev' && dir !== 'next') return;
          var targetId = resolveTempExecCycleId(dir, true);
          if (targetId && api.setTempExecActive) {
            api.setTempExecActive(targetId);
            scrollToTempExecViewTop({ waitForDrawerUnlock: true });
          }
          return;
        }
        var archiveBtn = e.target.closest('[data-temp-file-archive]');
        if (archiveBtn) {
          if (archiveBtn.disabled) return;
          var archiveFileId = archiveBtn.dataset ? (archiveBtn.dataset.tempFileArchive || '') : '';
          if (!archiveFileId) archiveFileId = state && state.tempExecActiveId ? String(state.tempExecActiveId || '') : '';
          var fileForArchive = archiveFileId && api.getTempExecFile ? api.getTempExecFile(archiveFileId) : null;
          var nextId = resolveTempExecCycleId('next', true);
          requestTempExecArchive(fileForArchive, {
            execSetId: fileForArchive ? (fileForArchive.execSetId || fileForArchive.id) : '',
            resumeOverview: false,
            afterArchive: function() { applyTempExecAfterArchive(nextId); },
          });
          return;
        }
        var statusPill = e.target.closest('[data-temp-status-filter]');
        if (statusPill && api.setTempExecStatusFilter) {
          var sfFileId = statusPill.dataset.tempStatusFile;
          var sfStatus = statusPill.dataset.tempStatusFilter;
          api.setTempExecStatusFilter(sfFileId, sfStatus);
          return;
        }
      });
    }

    if (toggleTempReqBtn && typeof api.toggleTempExecRequirementZone === 'function') {
      toggleTempReqBtn.addEventListener('click', function() {
        api.toggleTempExecRequirementZone();
      });
    }
    if (toggleTempVersionBtn && typeof api.toggleTempExecVersionZone === 'function') {
      toggleTempVersionBtn.addEventListener('click', function() {
        api.toggleTempExecVersionZone();
      });
    }

    if (tempExecNav && api.getTempExecFile && api.setTempExecActive) {
      tempExecNav.addEventListener('click', function(e) {
        var focusRemoveBtn = e.target.closest('[data-temp-focus-remove]');
        if (focusRemoveBtn) {
          e.preventDefault();
          e.stopPropagation();
          confirmRemoveFocus(focusRemoveBtn.dataset.tempFocusRemove);
          return;
        }
        var removeBtn = e.target.closest('[data-temp-remove]');
        if (removeBtn && api.removeTempExecFile) {
          e.preventDefault();
          e.stopPropagation();
          var fileId = removeBtn.dataset.tempRemove;
          var targetFile = api.getTempExecFile(fileId);
          if (!targetFile) return;
          var confirmed = window.confirm("确定要删除【" + targetFile.name + "】吗？此操作不可撤销。");
          if (!confirmed) return;
          api.removeTempExecFile(fileId);
          return;
        }
        var btn = e.target.closest('button[data-temp-file]');
        if (!btn) return;
        var fileId = btn.dataset.tempFile;
        if (!fileId) return;
        if (!api.getTempExecFile(fileId)) return;
        tempExecAiGenController.markAssignItemBadgeRead(fileId);
        if (fileId !== state.tempExecActiveId) {
          api.setTempExecActive(fileId);
        }
        showTempExecView({ scroll: false, reload: false });
      });
      tempExecNav.addEventListener('dragstart', function(e) {
        var targetFile = e.target.closest('[data-temp-file]');
        var targetReq = e.target.closest('[data-temp-req]');
        if (!targetFile && !targetReq) return;
        if (targetReq && targetReq.closest('[data-temp-focus-zone]')) return;
        if (targetFile && targetFile.dataset && String(targetFile.dataset.tempArchived || '') === '1') {
          e.preventDefault();
          return;
        }
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        if (targetFile) {
          if (e.dataTransfer) e.dataTransfer.setData('text/plain', targetFile.dataset.tempFile || '');
        } else if (targetReq && targetReq.dataset.tempReq) {
          if (e.dataTransfer) e.dataTransfer.setData('text/temp-req', targetReq.dataset.tempReq);
        }
      });
      tempExecNav.addEventListener('dragover', function(e) {
        var reqBox = e.target.closest('[data-temp-req]');
        var fileRow = e.target.closest('[data-temp-file]');
        var poolZone = e.target.closest('[data-temp-req-pool]') || tempExecNav.querySelector('[data-temp-req-pool]');
        var dragCtx = (window.app && window.app.tempDragContext) || null;
        var draggingReq = dragCtx && dragCtx.type === 'req';
        e.preventDefault();
        if (poolZone) poolZone.classList.add('dragover');
        if (reqBox) {
          reqBox.classList.add('dragover');
          navHoverReqName = reqBox.dataset.tempReq || navHoverReqName;
          if (!draggingReq) {
            setNavHoverTarget(reqBox.querySelector('.temp-req-list'), e.clientY);
          }
        } else if (poolZone && draggingReq) {
          navHoverFileId = '';
          renderNavPlaceholder(poolZone, '');
        }
        if (fileRow) {
          fileRow.classList.add('dragover-target');
          navHoverFileId = fileRow.dataset.tempFile || navHoverFileId;
          navHoverReqName = fileRow.dataset.tempReq || navHoverReqName;
        }
      });
      tempExecNav.addEventListener('dragleave', function(e) {
        var next = e.relatedTarget;
        if (next && tempExecNav.contains(next)) return;
        var poolZone = e.target.closest('[data-temp-req-pool]');
        if (poolZone) poolZone.classList.remove('dragover');
        var reqBox = e.target.closest('[data-temp-req]');
        var fileRow = e.target.closest('[data-temp-file]');
        if (reqBox) reqBox.classList.remove('dragover');
        if (fileRow) fileRow.classList.remove('dragover-target');
        navHoverFileId = '';
        clearNavPlaceholder();
      });
      tempExecNav.addEventListener('drop', function(e) {
        var poolZone = e.target.closest('[data-temp-req-pool]') || tempExecNav.querySelector('[data-temp-req-pool]');
        var reqBox = e.target.closest('[data-temp-req]');
        var fileRow = e.target.closest('[data-temp-file]');
        e.preventDefault();
        if (!e.dataTransfer) return;
        var reqData = e.dataTransfer.getData('text/temp-req');
        var reqPayload = e.dataTransfer.getData('text/temp-req-version');
        var versionReorder = e.dataTransfer.getData('text/temp-version');
        var ids = e.dataTransfer.getData('text/plain');
        function resolveTargetRequirement() {
          if (reqBox && reqBox.dataset.tempReq) return reqBox.dataset.tempReq;
          if (fileRow && fileRow.dataset.tempReq) return fileRow.dataset.tempReq;
          if (navHoverReqName) return navHoverReqName;
          if (typeof document.elementFromPoint === 'function') {
            var node = document.elementFromPoint(e.clientX, e.clientY);
            var refReq = node ? node.closest('[data-temp-req]') : null;
            if (refReq && refReq.dataset.tempReq) return refReq.dataset.tempReq;
          }
          return '';
        }
        // 从版本盒拖回需求区：优先使用拖拽上下文或 payload 中的版本信息
        if (api.moveRequirementOutOfVersion) {
          var dragCtx = (window.app && window.app.tempDragContext) || null;
          var ctxReq = dragCtx && dragCtx.type === 'req' ? (dragCtx.req || reqData || '') : '';
          var ctxVer = dragCtx && dragCtx.type === 'req' ? (dragCtx.versionId || '') : '';
          var payloadReq = '';
          var payloadVer = '';
          if (reqPayload) {
            var partsPayload = reqPayload.split('||');
            payloadReq = partsPayload[0] || '';
            payloadVer = partsPayload[2] || '';
          }
          var finalMoveReq = payloadReq || ctxReq || reqData || '';
          var finalFromVer = payloadVer || ctxVer || '';
        if (poolZone && finalMoveReq && finalFromVer) {
          var targetReqNamePool = (reqBox && reqBox.dataset.tempReq) || '';
          api.moveRequirementOutOfVersion(finalFromVer, finalMoveReq, '');
          if (reqBox && api.reorderTempRequirement) {
            api.reorderTempRequirement(finalMoveReq, targetReqNamePool || finalMoveReq);
          }
          if (window.app) window.app.tempDragContext = null;
          clearTempNavDragHints();
          clearNavPlaceholder();
          navHoverReqName = '';
          return;
        }
        if (reqPayload && payloadReq && payloadVer && !reqBox && !fileRow && poolZone) {
          api.moveRequirementOutOfVersion(payloadVer, payloadReq, payloadReq);
          if (window.app) window.app.tempDragContext = null;
          clearTempNavDragHints();
          clearNavPlaceholder();
          return;
        }
        }
        const targetReqForReorder = resolveTargetRequirement();
        if (reqData && targetReqForReorder && api.reorderTempRequirement) {
          if (targetReqForReorder !== reqData) {
            api.reorderTempRequirement(reqData, targetReqForReorder);
          }
          clearNavPlaceholder();
          clearTempNavDragHints();
          navHoverReqName = '';
          return;
        }
        if (ids && api.moveTempExecFileToRequirement) {
          var targetReq = resolveTargetRequirement();
          if (!targetReq) return;
        var sourceReq = '';
        var dragCtxFile = (window.app && window.app.tempDragContext && window.app.tempDragContext.type === 'file') ? window.app.tempDragContext : null;
        if (dragCtxFile && dragCtxFile.requirement) sourceReq = dragCtxFile.requirement;
        if (!sourceReq && api.getTempExecFile) {
          var firstId = ids.split(',').map(function(s) { return s.trim(); }).find(function(s) { return s; }) || '';
          var firstFile = firstId ? api.getTempExecFile(firstId) : null;
          if (firstFile && firstFile.requirement) sourceReq = firstFile.requirement;
        }
        var normSrc = (sourceReq || '').toLowerCase();
        var normTgt = (targetReq || '').toLowerCase();
        if (normSrc && normTgt && normSrc !== normTgt) {
          var confirmedMove = window.confirm('确定要将该用例从【' + sourceReq + '】移动到【' + targetReq + '】吗？');
          if (!confirmedMove) {
            clearTempNavDragHints();
            navHoverFileId = '';
            clearNavPlaceholder();
            return;
          }
        }
        var beforeId = fileRow && fileRow.dataset.tempFile ? fileRow.dataset.tempFile : (navHoverFileId || '');
        if (!beforeId && reqBox) {
          setNavHoverTarget(reqBox.querySelector('.temp-req-list'), e.clientY);
          beforeId = navHoverFileId || '';
        }
        ids.split(',').forEach(function(id) {
          var trimmed = id.trim();
          if (!trimmed) return;
          var finalBefore = beforeId === trimmed ? '' : beforeId;
          api.moveTempExecFileToRequirement(trimmed, targetReq, finalBefore, { skipConfirm: true });
        });
        clearTempNavDragHints();
        navHoverFileId = '';
        navHoverReqName = '';
        return;
      }
        if (ids && api.removeTempExecFromVersion) {
          ids.split(',').forEach(function(id) {
            var trimmed = id.trim();
            if (trimmed) api.removeTempExecFromVersion(trimmed);
          });
        }
        if (window.app) window.app.tempDragContext = null;
        clearTempNavDragHints();
        clearNavPlaceholder();
        navHoverReqName = '';
      });
    }

    var tempExecProjectAssignmentGridOwner = window.app && window.app.tempExecProjectAssignmentGridOwner;
    if (!tempExecProjectAssignmentGridOwner || typeof tempExecProjectAssignmentGridOwner.create !== 'function') {
      throw new Error('temp exec project assignment grid owner is required');
    }
    var tempExecProjectAssignmentGrid = tempExecProjectAssignmentGridOwner.create({
      window: window,
      document: document,
      state: state,
      api: api,
      gridElement: tempVersionGrid,
      statusElement: tempExecStatus,
      setStatus: setStatus,
      normalizeRequirementName: normalizeRequirementName,
      resolveActiveDrawer: resolveTempExecActiveDrawer,
      openConfirmDrawer: openConfirmDrawer,
      safeLogOperation: safeLogOperation,
      showView: showTempExecView,
      setDragContext: setTempDragContext,
      getDragContext: function() {
        return window.app && window.app.tempDragContext ? window.app.tempDragContext : null;
      },
      showDragBlockHint: showTempExecDragBlockHint,
    });
    tempExecProjectAssignmentGrid.init();

    function setTempDragContext(ctx) {
      window.app = window.app || {};
      window.app.tempDragContext = ctx;
    }

    function showTempExecDragBlockHint(anchorEl, message) {
      var msg = message || '不同版本之间不支持拖拽移动用例';
      if (typeof showTempExecCenterToast === 'function') {
        showTempExecCenterToast(msg, 'warn');
        return;
      }
      var hintApi = api.showTempExecBlockHint;
      if (!hintApi && window.app && window.app.tempExecApi && typeof window.app.tempExecApi.showTempExecBlockHint === 'function') {
        hintApi = window.app.tempExecApi.showTempExecBlockHint;
      }
      if (!hintApi || !anchorEl) return;
      var rect = (typeof anchorEl.getBoundingClientRect === 'function') ? anchorEl.getBoundingClientRect() : anchorEl;
      if (!rect) return;
      hintApi(rect, msg);
    }

    function resolveVersionTargetReq(card, clientY) {
      if (!card) return { req: '', key: '' };
      var boxes = Array.prototype.slice.call(card.querySelectorAll('[data-temp-req]'));
      var target = { req: '', key: '' };
      boxes.some(function(box) {
        var rect = box.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
          target = { req: box.dataset.tempReq || '', key: box.dataset.tempReqKey || '' };
          return true;
        }
        return false;
      });
      if (!target.req && boxes.length) {
        var last = boxes[boxes.length - 1];
        target = { req: last.dataset.tempReq || '', key: last.dataset.tempReqKey || '' };
      }
      return target;
    }

    function resolveVersionFileInsertTarget(reqBox, clientY) {
      if (!reqBox) return '';
      var rows = Array.prototype.slice.call(reqBox.querySelectorAll('[data-temp-file]'));
      var targetId = '';
      rows.some(function(row) {
        var rect = row.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
          targetId = row.dataset.tempFile || '';
          return true;
        }
        return false;
      });
      return targetId;
    }

    if (tempVersionGrid) {
      tempVersionGrid.addEventListener('dragstart', function(e) {
        var targetFile = e.target.closest('[data-temp-file]');
        var targetReq = e.target.closest('[data-temp-req]');
        var targetVer = e.target.closest('[data-temp-version]');
        if (!targetFile && !targetReq && !targetVer) return;
        if (targetFile && targetFile.dataset && String(targetFile.dataset.tempArchived || '') === '1') {
          e.preventDefault();
          return;
        }
        if (!e.dataTransfer) return;
        e.dataTransfer.effectAllowed = 'move';
        if (targetFile) {
          e.dataTransfer.setData('text/plain', targetFile.dataset.tempFile || '');
        } else if (targetReq && targetReq.dataset.tempReq) {
          var payload = [
            targetReq.dataset.tempReq || '',
            targetReq.dataset.tempReqKey || '',
            targetReq.dataset.tempVersionGroup || '',
          ].join('||');
          e.dataTransfer.setData('text/temp-req-version', payload);
          e.dataTransfer.setData('text/temp-req', targetReq.dataset.tempReq);
          e.dataTransfer.setData('text/temp-req-key', targetReq.dataset.tempReqKey || '');
        } else if (targetVer && targetVer.dataset.tempVersion) {
          e.dataTransfer.setData('text/temp-version', targetVer.dataset.tempVersion);
        }
      });
      tempVersionGrid.addEventListener('dragover', function(e) {
        var card = e.target.closest('[data-temp-version]');
        if (card) {
          e.preventDefault();
          card.classList.add('dragover');
        }
        var reqBox = e.target.closest('[data-temp-req]');
        if (reqBox) {
          e.preventDefault();
          reqBox.classList.add('dragover');
        }
      });
      tempVersionGrid.addEventListener('dragleave', function(e) {
        var card = e.target.closest('[data-temp-version]');
        if (card) card.classList.remove('dragover');
        var reqBox = e.target.closest('[data-temp-req]');
        if (reqBox) reqBox.classList.remove('dragover');
      });
      tempVersionGrid.addEventListener('drop', function(e) {
        var card = e.target.closest('[data-temp-version]');
        if (!card) return;
        e.preventDefault();
        card.classList.remove('dragover');
        var reqBox = e.target.closest('[data-temp-req]');
        if (reqBox) reqBox.classList.remove('dragover');
        if (tempMouseDragFileId && tempMouseDragFromNav) {
          var dropReq = reqBox && reqBox.dataset ? reqBox.dataset.tempReq : '';
          var pendingFileId = tempMouseDragFileId;
          tempMouseDragFileId = '';
          tempMouseDragFromNav = false;
          if (api.getTempExecFile && api.getTempExecFile(pendingFileId)) {
            var pendingFile = api.getTempExecFile(pendingFileId);
            if (pendingFile && pendingFile.versionId && String(pendingFile.versionId) !== String(card.dataset.tempVersion || '')) {
              showTempExecDragBlockHint(card, '不同版本之间不支持拖拽移动用例');
              setStatus(tempExecStatus, '不同版本之间不支持拖拽移动用例', 'warn');
              return;
            }
            if (typeof api.moveTempExecFileWithinVersion === 'function') {
              api.moveTempExecFileWithinVersion(pendingFileId, card.dataset.tempVersion, dropReq || '', '');
            } else if (typeof api.moveTempExecToVersion === 'function') {
              api.moveTempExecToVersion(pendingFileId, card.dataset.tempVersion);
            }
            return;
          }
        }
        var dataTransfer = e.dataTransfer || null;
        var verId = dataTransfer ? dataTransfer.getData('text/temp-version') : '';
        if (verId) {
          if (api.reorderTempVersion) api.reorderTempVersion(verId, card.dataset.tempVersion);
          return;
        }
        var reqMove = dataTransfer ? dataTransfer.getData('text/temp-req') : '';
        var reqKeyMove = dataTransfer ? dataTransfer.getData('text/temp-req-key') : '';
        var reqPayload = dataTransfer ? dataTransfer.getData('text/temp-req-version') : '';
        var payloadText = reqPayload || (reqMove ? [reqMove, reqKeyMove || '', card.dataset.tempVersion || ''].join('||') : '');
        if (payloadText) {
          var parts = payloadText.split('||');
          var srcReq = parts[0] || '';
          var srcKey = parts[1] || '';
          var srcVer = parts[2] || '';
          var targetResolved = resolveVersionTargetReq(card, e.clientY);
          var tgtKey = reqBox && reqBox.dataset.tempReqKey ? reqBox.dataset.tempReqKey : targetResolved.key;
          var tgtReq = reqBox && reqBox.dataset.tempReq ? reqBox.dataset.tempReq : targetResolved.req;
          var targetVersion = card.dataset.tempVersion;
          var targetObj = api.getTempVersion ? api.getTempVersion(targetVersion) : null;
          var hasReqInVersion = targetObj && api.getVersionRequirementBlocks
            ? api.getVersionRequirementBlocks(targetObj).some(function(block) {
                return (block.key && block.key === srcKey) || (normalizeRequirementName(block.req) === normalizeRequirementName(srcReq));
              })
            : false;
          if (srcVer === card.dataset.tempVersion && (srcKey || srcReq)) {
            if (hasReqInVersion && api.reorderVersionRequirement) {
              api.reorderVersionRequirement(card.dataset.tempVersion, srcKey || srcReq, tgtKey || tgtReq || '');
            } else if (srcReq && api.moveRequirementToVersion) {
              api.moveRequirementToVersion(srcReq, card.dataset.tempVersion, tgtKey || tgtReq || '');
            }
            return;
          }
          if (srcReq && api.moveRequirementToVersion) {
            api.moveRequirementToVersion(srcReq, card.dataset.tempVersion, tgtKey || tgtReq || '');
            return;
          }
        }
        if (window.app && window.app.tempDragContext && window.app.tempDragContext.type === 'req' && window.app.tempDragContext.req) {
          if (typeof api.moveRequirementToVersion === 'function') {
            api.moveRequirementToVersion(window.app.tempDragContext.req, card.dataset.tempVersion, '');
            setTempDragContext(null);
            return;
          }
        }
        var ids = dataTransfer ? dataTransfer.getData('text/plain') : '';
        if (!ids && window.app && window.app.tempDragContext && window.app.tempDragContext.type === 'file') {
          ids = window.app.tempDragContext.fileId || '';
        }
        if (!payloadText && !reqMove && !reqKeyMove && !ids && tempExecNav) {
          var navReq = tempExecNav.querySelector('[data-temp-req]');
          var navReqName = navReq && navReq.dataset ? navReq.dataset.tempReq : '';
          if (navReqName && typeof api.moveRequirementToVersion === 'function') {
            api.moveRequirementToVersion(navReqName, card.dataset.tempVersion, '');
            setTempDragContext(null);
            return;
          }
        }
        if (ids) {
          var resolvedReq = reqBox && reqBox.dataset.tempReq ? reqBox.dataset.tempReq : resolveVersionTargetReq(card, e.clientY).req;
          var beforeId = resolveVersionFileInsertTarget(reqBox, e.clientY);
          if (!beforeId) {
            var fileRow = e.target.closest('[data-temp-file]');
            beforeId = fileRow && fileRow.dataset.tempFile ? fileRow.dataset.tempFile : '';
          }
          var idArr = ids.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
          var firstFile = idArr.length && api.getTempExecFile ? api.getTempExecFile(idArr[0]) : null;
          var targetVersionId = String(card.dataset.tempVersion || '');
          if (idArr.length && api.getTempExecFile) {
            var blocked = idArr.some(function(id) {
              var file = api.getTempExecFile(id);
              if (!file || !file.versionId) return false;
              return String(file.versionId) !== targetVersionId;
            });
            if (blocked) {
              showTempExecDragBlockHint(card, '不同版本之间不支持拖拽移动用例');
              setStatus(tempExecStatus, '不同版本之间不支持拖拽移动用例', 'warn');
              return;
            }
          }
          var srcReqName = normalizeRequirementName(firstFile && firstFile.requirement) || '';
          var tgtReqName = normalizeRequirementName(resolvedReq) || srcReqName;
          if (idArr.length && srcReqName && tgtReqName && srcReqName !== tgtReqName) {
            var confirmedMove = window.confirm('确定将用例从【' + srcReqName + '】移动到【' + tgtReqName + '】吗？');
            if (!confirmedMove) return;
          }
          if (api.moveTempExecFileWithinVersion) {
            api.moveTempExecFileWithinVersion(ids, card.dataset.tempVersion, resolvedReq, beforeId || '');
          } else if (api.moveTempExecToVersion) {
            api.moveTempExecToVersion(ids, card.dataset.tempVersion);
          }
        }
      });
      tempVersionGrid.addEventListener('click', function(e) {
        var filterBtn2 = e.target.closest('[data-tempexec-import-project-filter]');
        if (filterBtn2 && api.setTempExecImportProjectFilter) {
          var filterPid2 = filterBtn2.dataset.tempexecImportProjectFilter || '';
          api.setTempExecImportProjectFilter(filterPid2);
          return;
        }
        var removeBtn = e.target.closest('[data-temp-version-remove]');
        if (removeBtn && api.removeTempVersion) api.removeTempVersion(removeBtn.dataset.tempVersionRemove);
        var groupRemoveBtn = e.target.closest('[data-temp-group-remove]');
        if (groupRemoveBtn && api.removeTempGroupFromVersion) {
          api.removeTempGroupFromVersion(groupRemoveBtn.dataset.tempGroupRemove, groupRemoveBtn.dataset.tempGroupIds || '');
          return;
        }
        var renameBtn = e.target.closest('[data-temp-version-rename]');
        if (renameBtn && api.renameTempVersion) {
          api.renameTempVersion(renameBtn.dataset.tempVersionRename);
          return;
        }
        var fileBtn = e.target.closest('[data-temp-file]');
        if (fileBtn && typeof api.setTempExecActive === 'function') {
          var fileId = fileBtn.dataset.tempFile;
          if (fileId && api.getTempExecFile && api.getTempExecFile(fileId)) {
            tempExecAiGenController.markAssignItemBadgeRead(fileId);
            api.setTempExecActive(fileId);
            if (!(api.isTempExecProjectLayoutEnabled && api.isTempExecProjectLayoutEnabled())) {
              switchTab('tempexec');
            }
          }
        }
      });
    }

    function handleTempFileDragStart(e) {
      if (!e) return;
      setTempDragContext(null);
      var fileBtn = e.target.closest('[data-temp-file]');
      if (fileBtn) {
        if (fileBtn.dataset && String(fileBtn.dataset.tempArchived || '') === '1') return;
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', fileBtn.dataset.tempFile || '');
        }
        var file = api.getTempExecFile ? api.getTempExecFile(fileBtn.dataset.tempFile) : null;
        var req = normalizeRequirementName(file && file.requirement) || fileBtn.dataset.tempReq || '';
        setTempDragContext({
          type: 'file',
          fileId: fileBtn.dataset.tempFile || '',
          requirement: req,
          versionId: file && file.versionId ? file.versionId : '',
        });
        return;
      }
      var reqBox = e.target.closest('[data-temp-req]');
      if (reqBox && reqBox.dataset.tempReq) {
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/temp-req', reqBox.dataset.tempReq);
          var rect = reqBox.getBoundingClientRect();
          var ghost = reqBox.cloneNode(true);
          ghost.style.position = 'fixed';
          ghost.style.top = '-9999px';
          ghost.style.left = '-9999px';
          ghost.style.width = rect.width + 'px';
          ghost.style.maxWidth = rect.width + 'px';
          ghost.style.boxSizing = 'border-box';
          document.body.appendChild(ghost);
          var offsetX = Math.max(0, e.clientX - rect.left);
          var offsetY = Math.max(0, e.clientY - rect.top);
          e.dataTransfer.setDragImage(ghost, offsetX, offsetY);
          setTimeout(function() {
            if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
          }, 0);
        }
        setTempDragContext({ type: 'req', req: reqBox.dataset.tempReq, versionId: reqBox.dataset.tempVersionGroup || '' });
        return;
      }
      var versionCard = e.target.closest('[data-temp-version]');
      if (versionCard && versionCard.dataset.tempVersion) {
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/temp-version', versionCard.dataset.tempVersion);
        }
        setTempDragContext({ type: 'version', versionId: versionCard.dataset.tempVersion });
      }
    }

    document.addEventListener('dragstart', handleTempFileDragStart);
    var tempMouseDragFileId = '';
    var tempMouseDragFromNav = false;
    document.addEventListener('mousedown', function(e) {
      var fileRow = e.target.closest('[data-temp-file]');
      if (fileRow && fileRow.dataset.tempFile) {
        tempMouseDragFileId = fileRow.dataset.tempFile;
        tempMouseDragFromNav = Boolean(tempExecNav && tempExecNav.contains(fileRow));
      } else {
        tempMouseDragFileId = '';
        tempMouseDragFromNav = false;
      }
    });
    document.addEventListener('mouseup', function(e) {
      if (!tempMouseDragFileId || !tempMouseDragFromNav) return;
      var versionBody = e.target.closest('[data-temp-version] .temp-version-body');
      var versionCard = e.target.closest('[data-temp-version]');
      if (versionCard && versionCard.dataset && versionCard.dataset.tempVersion && versionBody) {
        var fileId = tempMouseDragFileId;
        tempMouseDragFileId = '';
        tempMouseDragFromNav = false;
        if (api.getTempExecFile && !api.getTempExecFile(fileId)) return;
        var targetFile = api.getTempExecFile ? api.getTempExecFile(fileId) : null;
        if (targetFile && targetFile.versionId && String(targetFile.versionId) !== String(versionCard.dataset.tempVersion || '')) {
          showTempExecDragBlockHint(versionCard, '不同版本之间不支持拖拽移动用例');
          setStatus(tempExecStatus, '不同版本之间不支持拖拽移动用例', 'warn');
          return;
        }
        var resolvedReq = versionBody.dataset && versionBody.dataset.tempReq ? versionBody.dataset.tempReq : '';
        if (typeof api.moveTempExecFileWithinVersion === 'function') {
          api.moveTempExecFileWithinVersion(fileId, versionCard.dataset.tempVersion, resolvedReq, '');
        } else if (typeof api.moveTempExecToVersion === 'function') {
          api.moveTempExecToVersion(fileId, versionCard.dataset.tempVersion);
        }
        return;
      }
      tempMouseDragFileId = '';
      tempMouseDragFromNav = false;
    });

    var tempExecFocusInteractionOwner = window.app && window.app.tempExecFocusInteractionOwner
      && typeof window.app.tempExecFocusInteractionOwner.create === 'function'
      ? window.app.tempExecFocusInteractionOwner.create({
        state: state,
        api: api,
        document: document,
        window: window,
        focusBlock: tempFocusBlock,
        focusZone: tempFocusZone,
        viewFocusBlock: tempExecViewFocusBlock,
        viewFocusZone: tempExecViewFocusZone,
        tempExecNav: tempExecNav,
        switchTab: switchTab,
        scrollToViewTop: scrollToTempExecViewTop,
        confirmRemoveFocus: confirmRemoveFocus,
        markFocusBadgeRead: tempExecAiGenController.markFocusBadgeRead,
        setDragContext: setTempDragContext,
        openAssignDrawer: function() {
          if (tempExecAssignDrawer && typeof tempExecAssignDrawer.open === 'function') {
            tempExecAssignDrawer.open();
          } else if (openTempExecAssignDrawerBtn && typeof openTempExecAssignDrawerBtn.click === 'function') {
            openTempExecAssignDrawerBtn.click();
          }
        },
        debounce: debounce,
      })
      : null;

	    if (tempExecOverview && api.setTempExecActive) {
	      tempExecOverview.addEventListener('click', function(e) {
	        var archivedTag = e.target.closest('.tag-archived');
	        if (archivedTag) {
	          var archivedCard = archivedTag.closest('[data-temp-archived="1"]');
	          if (archivedCard) {
	            e.preventDefault();
	            e.stopPropagation();
	            switchTab('tempexec');
	            updateTempExecToolbarOffset();
	            if (tempExecOverviewDrawer) tempExecOverviewDrawer.close();
	            if (tempExecOverviewSection) tempExecOverviewSection.classList.add('hidden');
	            if (tempExecViewSection) tempExecViewSection.classList.remove('hidden');
	            if (tempExecAssignDrawer) tempExecAssignDrawer.open();
	            return;
	          }
	        }
        var archiveBtn = e.target.closest('[data-temp-overview-archive]');
        if (archiveBtn) {
          e.preventDefault();
          e.stopPropagation();
          var execSetId = archiveBtn.dataset ? (archiveBtn.dataset.tempOverviewArchive || '') : '';
          var cardForArchive = archiveBtn.closest('[data-temp-file]');
          var fileIdForArchive = cardForArchive && cardForArchive.dataset ? (cardForArchive.dataset.tempFile || '') : '';
          var fileForArchive = fileIdForArchive && api.getTempExecFile ? api.getTempExecFile(fileIdForArchive) : null;
          requestTempExecArchive(fileForArchive, { execSetId: execSetId, resumeOverview: true });
          return;
        }
        var projectBtn = e.target.closest('[data-temp-overview-project]');
        if (projectBtn) {
          e.preventDefault();
          e.stopPropagation();
          var pid = projectBtn.dataset ? (projectBtn.dataset.tempOverviewProject || '') : '';
          if (state) {
            state.tempExecOverviewProjectId = pid;
            state.tempExecOverviewVersionId = '';
          }
          if (api.renderTempExecOverview) api.renderTempExecOverview();
          return;
        }
        var seg = e.target.closest('[data-temp-overview-file][data-temp-overview-status]');
        if (seg) {
          e.preventDefault();
          e.stopPropagation();
          var archivedSeg = seg.closest('[data-temp-archived="1"]');
          if (archivedSeg) {
            if (tempExecStatus) setStatus(tempExecStatus, '该用例已归档，请到【用例归档】页面查看', 'warn');
            showTempExecCenterToast('该用例已归档，请到【用例归档】页面查看', 'warn');
            return;
          }
          var segFileId = seg.dataset.tempOverviewFile;
          var segIndex = Number(seg.dataset.tempOverviewIndex);
          if (!Number.isFinite(segIndex) || segIndex < 0) segIndex = 0;
          jumpToTempExecCase(segFileId, segIndex);
          return;
        }
	        var card = e.target.closest('[data-temp-file]');
	        if (!card) return;
	        if (card.dataset && card.dataset.tempArchived) {
	          if (tempExecStatus) setStatus(tempExecStatus, '该用例已归档，请到【用例归档】页面查看', 'warn');
	          showTempExecCenterToast('该用例已归档，请到【用例归档】页面查看', 'warn');
	          return;
	        }
        var fileId = card.dataset.tempFile;
        if (fileId) {
          e.preventDefault();
          e.stopPropagation();
          try {
            if (window.app) window.app.__drawerSkipRestoreOnce = true;
          } catch (err2) {
            // ignore
          }
          switchTab('tempexec');
          updateTempExecToolbarOffset();
          if (tempExecOverviewDrawer) tempExecOverviewDrawer.close();
          if (tempExecImportDrawer) tempExecImportDrawer.close();
          if (tempExecAssignDrawer) tempExecAssignDrawer.close();
          if (tempExecOverviewSection) tempExecOverviewSection.classList.add('hidden');
          if (tempExecViewSection) tempExecViewSection.classList.remove('hidden');
          api.setTempExecActive(fileId);
          // 选中用例后回到执行视图：定位到执行视图顶部，避免抽屉关闭滚动恢复导致“列表上滚遮挡顶部”。
          scrollToTempExecViewTop({ waitForDrawerUnlock: true });
        }
      });
      tempExecOverview.addEventListener('change', function(e) {
        var sel = e && e.target && e.target.closest ? e.target.closest('[data-temp-overview-version-select]') : null;
        if (!sel) return;
        if (state) state.tempExecOverviewVersionId = sel.value || '';
        if (api.renderTempExecOverview) api.renderTempExecOverview();
      });
    }
    if (tempExecBackBtn) {
      tempExecBackBtn.addEventListener('click', function() {
        try {
          if (api.prioritizeTempExecUnassignedRequirements) {
            api.prioritizeTempExecUnassignedRequirements();
          }
        } catch (err) {
          // ignore
        }
        try {
          if (window.app) window.app.__drawerSkipRestoreOnce = true;
        } catch (err2) {
          // ignore
        }
        switchTab('tempexec');
        if (tempExecOverviewDrawer) tempExecOverviewDrawer.close();
        if (tempExecImportDrawer) tempExecImportDrawer.close();
        if (tempExecAssignDrawer) tempExecAssignDrawer.close();
        if (tempExecViewSection) {
          tempExecViewSection.classList.remove('hidden');
        }
        if (tempExecOverviewSection) tempExecOverviewSection.classList.add('hidden');
        scrollToTempExecViewTop({ waitForDrawerUnlock: true });
      });
    }
    if (tempExecMindBtn && api.renderTempExecView && api.getTempExecFile) {
      tempExecMindBtn.addEventListener('click', function() {
        var file = api.getTempExecFile(state.tempExecActiveId);
        if (!file) {
          setStatus(tempExecStatus, '当前没有可展示的用例', 'warn');
          return;
        }
        state.tempExecMindMode = !state.tempExecMindMode;
        api.renderTempExecView();
      });
    }
    if (tempExecXmindViewBtn) {
      tempExecXmindViewBtn.addEventListener('click', function() {
        openTempExecXmindStructure();
        var activeId = state && state.tempExecActiveId ? String(state.tempExecActiveId || '') : '';
        var execSetId = activeId ? Number(activeId) : null;
        safeLogOperation('view_exec_xmind_structure', 'exec_set', Number.isFinite(execSetId) ? execSetId : null, {
          exec_set_id: Number.isFinite(execSetId) ? execSetId : null,
        });
      });
    }

    if (createTempVersionBtn && api.createTempVersion) {
      createTempVersionBtn.addEventListener('click', function() {
        if (api.isTempExecProjectLayoutEnabled && api.isTempExecProjectLayoutEnabled()) {
          setStatus(tempExecStatus, '当前为项目分组模式，不支持手动新建版本', 'warn');
          return;
        }
        var prevDrawer = resolveTempExecActiveDrawer();
        promptTempVersionName(prevDrawer).then(function(res) {
          if (!res || res.ok !== true) return;
          var id = api.createTempVersion(res.value || '');
          if (id && tempExecStatus) setStatus(tempExecStatus, '版本已创建，可拖拽需求到对应版本', 'ok');
        });
      });
    }
    if (tempExecAddCaseFromLibraryBtn) {
      tempExecAddCaseFromLibraryBtn.addEventListener('click', function() {
        openCaseLibrarySelectExecFromTempExec();
      });
    }

    var tempExecViewInteractionOwner = window.app && window.app.tempExecViewInteractionOwner;
    if (!tempExecViewInteractionOwner || typeof tempExecViewInteractionOwner.create !== 'function') {
      throw new Error('temp exec view interaction owner is required');
    }
    var tempExecViewInteraction = tempExecViewInteractionOwner.create({
      state: state,
      api: api,
      window: window,
      document: document,
      viewElement: tempExecView,
      statusElement: tempExecStatus,
      setStatus: setStatus,
      switchTab: switchTab,
      openConfirmDrawer: openConfirmDrawer,
      reuseLifecycle: tempExecReusePanelLifecycle,
    });
    tempExecViewInteraction.init();

    bindTempExecReuseAutoCollapse();
    if (api && typeof api === 'object' && typeof api.autoCollapseTempExecReusePanels !== 'function') {
      api.autoCollapseTempExecReusePanels = autoCollapseTempExecReusePanels;
    }

    if (exportTempExecConfigBtn && api.exportTempExecSnapshot) {
      exportTempExecConfigBtn.addEventListener('click', function() {
        var activeId = state && state.tempExecActiveId ? String(state.tempExecActiveId || '') : '';
        var execSetId = activeId ? Number(activeId) : null;
        safeLogOperation('export_exec_snapshot', 'exec_set', Number.isFinite(execSetId) ? execSetId : null, {
          exec_set_id: Number.isFinite(execSetId) ? execSetId : null,
        });
        api.exportTempExecSnapshot();
      });
    }

    if (exportTempExecXmindBtn) {
      exportTempExecXmindBtn.addEventListener('click', function() {
        triggerTempExecXmindExport();
      });
    }
    if (exportTempExecCasesXmindBtn && api.exportTempExecCasesToXmind) {
      exportTempExecCasesXmindBtn.addEventListener('click', function() {
        var activeId = state && state.tempExecActiveId ? String(state.tempExecActiveId || '') : '';
        var execSetId = activeId ? Number(activeId) : null;
        safeLogOperation('export_cases_xmind', 'exec_set', Number.isFinite(execSetId) ? execSetId : null, {
          exec_set_id: Number.isFinite(execSetId) ? execSetId : null,
          format: 'xmind',
          with_result: false,
        });
        api.exportTempExecCasesToXmind();
      });
    }

    if (tempExecCaseLibraryChangesBtn && api.openTempExecCaseLibraryDiffDrawer) {
      tempExecCaseLibraryChangesBtn.addEventListener('click', function() {
        api.openTempExecCaseLibraryDiffDrawer({ manual: true });
      });
    }

    if (importTempExecConfigBtn && importTempExecConfigFile && api.importTempExecSnapshot) {
      importTempExecConfigBtn.addEventListener('click', function() { importTempExecConfigFile.click(); });
      importTempExecConfigFile.addEventListener('change', function(e) {
        var file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (file) api.importTempExecSnapshot(file);
      });
    }

    if (tempExecPageSizeInput) {
      tempExecPageSizeInput.value = state.tempExecPageSize || defaultTempExecPageSize;
      tempExecPageSizeInput.addEventListener('input', function() { setStatus(tempExecPageSizeStatus, '', ''); });
    }
    if (saveTempExecPageSizeBtn && api.applyTempExecPageSize) {
      saveTempExecPageSizeBtn.addEventListener('click', function() {
        if (!tempExecPageSizeInput) return;
        var desired = Number(tempExecPageSizeInput.value);
        var result = api.applyTempExecPageSize(desired);
        tempExecPageSizeInput.value = result.size;
        var message = result.changed
          ? '分页设置已更新，每页 ' + result.size + ' 条'
          : '分页设置已是每页 ' + result.size + ' 条';
        setStatus(tempExecPageSizeStatus, message, 'ok');
      });
    }
  }

  window.app = window.app || {};
  window.app.tempexec = { init: init };
})();
