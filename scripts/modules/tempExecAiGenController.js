(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.tempExecAiGenController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var core = opts.core && typeof opts.core === 'object' ? opts.core : {};
    var utils = opts.utils && typeof opts.utils === 'object' ? opts.utils : {};
    var config = opts.config && typeof opts.config === 'object' ? opts.config : {};
    var api = opts.api && typeof opts.api === 'object' ? opts.api : {};
    var ctx = opts.context && typeof opts.context === 'object' ? opts.context : {};
    var window = opts.window || (typeof globalThis !== 'undefined' ? globalThis : null);
    var document = opts.document || (window && window.document ? window.document : null);
    var tempExecStatus = opts.statusElement || null;
    var setStatus = typeof opts.setStatus === 'function'
      ? opts.setStatus
      : (core.setStatus || utils.setStatus || function() {});
    var escapeHtml = typeof opts.escapeHtml === 'function'
      ? opts.escapeHtml
      : (core.escapeHtml || utils.escapeHtml || function(text) {
        if (text === null || text === undefined) return '';
        return String(text)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      });
    var showTempExecCenterToast = typeof opts.showToast === 'function' ? opts.showToast : function() {};
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function'
      ? opts.openConfirmDrawer
      : function() { return Promise.resolve({ ok: false }); };
    var tempExecAiGenModelOwner = opts.modelOwner;
    var tempExecAiGenStoreOwner = opts.storeOwner;
    var tempExecAiGenDiffModel = opts.diffModel;
    var tempExecAiGenViewOwner = opts.viewOwner;
    var tempExecAiGenTaskRunnerOwner = opts.taskRunnerOwner;
    var tempExecAiGenToolbarOwner = opts.toolbarOwner;
    var tempExecAiGenTaskStateOwner = opts.taskStateOwner;
    var tempExecAiGenPrepOwner = opts.prepOwner;
    var tempExecAiGenFileParserOwner = opts.fileParserOwner;
    var getCurrentUserIdOverride = typeof opts.getCurrentUserId === 'function' ? opts.getCurrentUserId : null;
    var apiClient = opts.apiClient || null;
    var xmindKnowledgeBaseApi = opts.xmindKnowledgeBaseApi || null;
    if (!tempExecAiGenModelOwner || typeof tempExecAiGenModelOwner.create !== 'function') {
      throw new Error('temp exec AI generation model owner is required');
    }
    if (!tempExecAiGenDiffModel || typeof tempExecAiGenDiffModel.buildCaseItemKey !== 'function') {
      throw new Error('temp exec AI generation diff model is required');
    }
    if (!tempExecAiGenStoreOwner || typeof tempExecAiGenStoreOwner.create !== 'function') {
      throw new Error('temp exec AI generation store owner is required');
    }
    if (!tempExecAiGenViewOwner || typeof tempExecAiGenViewOwner.create !== 'function') {
      throw new Error('temp exec AI generation view owner is required');
    }
    if (!tempExecAiGenTaskRunnerOwner || typeof tempExecAiGenTaskRunnerOwner.create !== 'function') {
      throw new Error('temp exec AI generation task runner owner is required');
    }
    if (!tempExecAiGenToolbarOwner || typeof tempExecAiGenToolbarOwner.create !== 'function') {
      throw new Error('temp exec AI generation toolbar owner is required');
    }
    if (!tempExecAiGenTaskStateOwner || typeof tempExecAiGenTaskStateOwner.create !== 'function') {
      throw new Error('temp exec AI generation task state owner is required');
    }
    if (!tempExecAiGenPrepOwner || typeof tempExecAiGenPrepOwner.create !== 'function') {
      throw new Error('temp exec AI generation prep owner is required');
    }
    if (!tempExecAiGenFileParserOwner || typeof tempExecAiGenFileParserOwner.create !== 'function') {
      throw new Error('temp exec AI generation file parser owner is required');
    }
    var tempExecAiGenFileParser = tempExecAiGenFileParserOwner.create({
      getJSZip: function() { return window && window.JSZip ? window.JSZip : null; },
    });
    var tempExecAiGenModel = tempExecAiGenModelOwner.create({
      normalizeText: normalizeTempExecAiText,
      normalizePriority: normalizeTempExecAiPriority,
      buildCaseKey: tempExecAiGenDiffModel.buildCaseItemKey,
      hashText: hashTempExecAiGenText,
      stripCodeFence: utils && typeof utils.stripCodeFence === 'function' ? utils.stripCodeFence : null,
      extractJsonPayload: utils && typeof utils.extractJsonPayload === 'function' ? utils.extractJsonPayload : null,
    });
    var tempExecAiGenStore = tempExecAiGenStoreOwner.create({
      state: state,
      getCurrentUserId: function() {
        if (getCurrentUserIdOverride) return getCurrentUserIdOverride();
        var globalState = window && window.app && window.app.state ? window.app.state : null;
        var user = globalState && globalState.currentUser ? globalState.currentUser : null;
        var userId = user && user.id !== undefined && user.id !== null ? user.id : null;
        if (!userId || String(userId) === '0') return null;
        return userId;
      },
      badgeStorageKey: 'tap-temp-exec-ai-gen-badges',
      appendStorageKey: 'tap-temp-exec-ai-gen-appended',
      badgeStateKey: 'tempExecAiGenBadge',
      appendStateKey: 'tempExecAiGenAppend',
      badgeTokenKeys: [
        'result_token',
        'ai_read_token',
        'focus_read_token',
        'assign_entry_read_token',
        'assign_item_read_token',
      ],
    });
    var tempExecAiGenTaskRunner = tempExecAiGenTaskRunnerOwner.create({
      scene: 'temp-exec',
      runTokenPrefix: 'temp-exec',
      model: tempExecAiGenModel,
      getManager: getTempExecAiGenManager,
      getCore: function() { return core; },
      getPrepApi: getCasePageAiGenPrepApi,
      getAssignments: function() { return state.assignments || {}; },
      appendPrompt: appendCaseWritingGuidePrompt,
      getDefaultPrompt: function() {
        return window && window.app && window.app.config && window.app.config.defaultPrompts
          ? window.app.config.defaultPrompts.caselibrarygen
          : '';
      },
      resolveCoverageThreshold: function() {
        return tempExecAiGenModel.resolveCoverageThreshold(
          state && state.settings ? state.settings.caseLibraryGenCoverageThreshold : undefined
        );
      },
      resolveFileMeta: function(file) {
        var source = file && typeof file === 'object' ? file : {};
        return {
          id: source.id || null,
          name: source.name || source.file_name_clean || '',
          projectId: source.projectId || source.project_id || null,
          versionId: source.versionId || source.version_id || null,
        };
      },
    });

    var tempExecAiGenView = tempExecAiGenViewOwner.create({
      state: state,
      model: tempExecAiGenModel,
      document: document,
      window: window,
      escapeHtml: escapeHtml,
      escapeHtmlPreserve: escapeHtmlPreserve,
      getState: ensureTempExecAiGenState,
      callbacks: {
        onOpen: function(optionsValue) { return tempExecAiGenPrep.open(optionsValue); },
        onFile: handleTempExecAiGenFile,
        onRequirementChange: function(value) {
          var ai = ensureTempExecAiGenState();
          ai.requirementText = value || '';
          syncTempExecAiGenRunBtn();
        },
        onClearRequirement: clearTempExecAiGenRequirement,
        onRun: runTempExecAiGen,
        onDiscard: function() { discardTempExecAiGenResult({ keepRequirement: true }); },
        onRegenerate: function() { return tempExecAiGenPrep.regenerate(); },
        onAppend: appendTempExecAiGenSelection,
        onDrawerOpen: function() {
          syncTempExecAiGenTaskState();
          renderTempExecAiGenResult();
          syncTempExecAiGenRunBtn();
          clearTempExecAiGenResultBadge();
        },
      },
    });
    var tempExecAiGenDom = tempExecAiGenView.dom;
    var tempExecAiGenFileName = tempExecAiGenDom.fileName;
    var tempExecAiGenImportStatus = tempExecAiGenDom.importStatus;
    var tempExecAiGenRequirementInput = tempExecAiGenDom.requirementInput;
    var tempExecAiGenStatus = tempExecAiGenDom.status;
    var tempExecAiGenToolbar = tempExecAiGenToolbarOwner.create({
      state: state,
      api: api,
      store: tempExecAiGenStore,
      dom: tempExecAiGenDom,
      getState: ensureTempExecAiGenState,
      normalizeText: normalizeTempExecAiText,
      hasAssignedModel: function() { return Boolean(resolveTempExecAiGenAssignedModel()); },
    });
    var syncTempExecAiGenBadgeForFile = tempExecAiGenToolbar.syncBadgeForFile;
    var syncTempExecAiGenAssignEntryBadge = tempExecAiGenToolbar.syncAssignEntryBadge;
    var markTempExecAiGenAssignEntryBadgeRead = tempExecAiGenToolbar.markAssignEntryBadgeRead;
    var markTempExecAiGenFocusBadgeRead = tempExecAiGenToolbar.markFocusBadgeRead;
    var markTempExecAiGenAssignItemBadgeRead = tempExecAiGenToolbar.markAssignItemBadgeRead;
    var resolveTempExecAiGenDisabledReason = tempExecAiGenToolbar.resolveDisabledReason;
    var syncTempExecAiGenRunBtn = tempExecAiGenToolbar.syncRunButton;
    var syncTempExecAiGenButton = tempExecAiGenToolbar.syncButton;
    var markTempExecAiGenResultReady = tempExecAiGenToolbar.markResultReady;
    var clearTempExecAiGenResultBadge = tempExecAiGenToolbar.clearResultBadge;
    var tempExecAiGenTaskState = tempExecAiGenTaskStateOwner.create({
      state: state,
      api: api,
      model: tempExecAiGenModel,
      store: tempExecAiGenStore,
      taskRunner: tempExecAiGenTaskRunner,
      toolbar: tempExecAiGenToolbar,
      getState: ensureTempExecAiGenState,
      getManager: getTempExecAiGenManager,
      callbacks: {
        setStatus: function(text, type) { setStatus(tempExecAiGenStatus, text, type); },
        renderResult: renderTempExecAiGenResult,
        prepareParsedResult: adaptTempExecAiGenCaseFields,
        applyResultStats: applyTempExecAiGenResultStats,
        setRequirementText: function(value) {
          if (tempExecAiGenRequirementInput) tempExecAiGenRequirementInput.value = value || '';
        },
        setRequirementFileName: function(value) {
          if (tempExecAiGenFileName) tempExecAiGenFileName.textContent = value || '未选择文件';
        },
      },
    });
    var applyTempExecAiGenTaskState = tempExecAiGenTaskState.applyTaskState;
    var syncTempExecAiGenTaskState = function() { return tempExecAiGenTaskState.syncTaskState(true); };
    var getCurrentTempExecAiGenTask = tempExecAiGenTaskState.getCurrentTask;
    var tempExecAiGenPrep = tempExecAiGenPrepOwner.create({
      state: state,
      api: api,
      view: tempExecAiGenView,
      toolbar: tempExecAiGenToolbar,
      taskState: tempExecAiGenTaskState,
      getState: ensureTempExecAiGenState,
      getPrepApi: getCasePageAiGenPrepApi,
      getAssignedModel: resolveTempExecAiGenAssignedModel,
      getRequirementText: function(ai) {
        return tempExecAiGenRequirementInput ? tempExecAiGenRequirementInput.value : ai.requirementText;
      },
      syncContext: syncTempExecAiGenContext,
      discardResult: discardTempExecAiGenResult,
      run: runTempExecAiGen,
      showToast: showTempExecCenterToast,
      openConfirmDrawer: openConfirmDrawer,
    });

    function appendCaseWritingGuidePrompt(promptText) {
      var prompt = promptText === undefined || promptText === null ? '' : String(promptText).trim();
      var guide = config && config.caseWritingStyleGuidePrompt
        ? String(config.caseWritingStyleGuidePrompt || '').trim()
        : '';
      if (!guide) return prompt;
      if (prompt.indexOf('AI_CASE_WRITING_STYLE_GUIDE.md') !== -1) return prompt;
      return [prompt, guide].filter(Boolean).join('\n\n');
    }

    function escapeHtmlPreserve(text) {
      if (utils && typeof utils.escapeHtmlPreserve === 'function') return utils.escapeHtmlPreserve(text);
      return escapeHtml(text).replace(/\n/g, '<br/>');
    }

    function getCurrentUserId() {
      if (getCurrentUserIdOverride) return getCurrentUserIdOverride();
      var globalState = window && window.app && window.app.state ? window.app.state : null;
      var user = globalState && globalState.currentUser ? globalState.currentUser : null;
      var userId = user && user.id !== undefined && user.id !== null ? user.id : null;
      if (!userId || String(userId) === '0') return null;
      return userId;
    }

    function ensureTempExecAiGenState() {
      var host = { aiGen: state.tempExecAiGen };
      var ai = tempExecAiGenModel.ensureState(host);
      state.tempExecAiGen = ai;
      return ai;
    }

    function getTempExecAiGenManager() {
      return window.app && window.app.caseLibraryAiGen ? window.app.caseLibraryAiGen : null;
    }

    function getCasePageAiGenPrepApi() {
      if (ctx.casePageAiGenPrepApi && typeof ctx.casePageAiGenPrepApi.open === 'function') {
        return ctx.casePageAiGenPrepApi;
      }
      if (window.app && window.app.casePageAiGenPrepApi && typeof window.app.casePageAiGenPrepApi.open === 'function') {
        ctx.casePageAiGenPrepApi = window.app.casePageAiGenPrepApi;
        return ctx.casePageAiGenPrepApi;
      }
      if (window.app && window.app.casePageAiGenPrep && typeof window.app.casePageAiGenPrep.init === 'function') {
        ctx.casePageAiGenPrepApi = window.app.casePageAiGenPrep.init({
          state: state,
          config: config,
          core: core,
          utils: utils,
          apiClient: window.app.apiClient || null,
          callModelWithConfig: core && typeof core.callModelWithConfig === 'function' ? core.callModelWithConfig : null,
          xmindKnowledgeBaseApi: ctx.xmindKnowledgeBaseApi || null,
        });
        if (window.app) window.app.casePageAiGenPrepApi = ctx.casePageAiGenPrepApi;
        return ctx.casePageAiGenPrepApi;
      }
      return null;
    }

    function hashTempExecAiGenText(text) {
      var str = String(text || '');
      var hash = 0;
      for (var i = 0; i < str.length; i += 1) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return hash + ':' + str.length;
    }

    function normalizeTempExecAiText(value) {
      if (value === null || value === undefined) return '';
      if (Array.isArray(value)) {
        return value.map(function(item) { return normalizeTempExecAiText(item); }).filter(Boolean).join('\n');
      }
      try {
        return String(value).replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, '').trim();
      } catch (err) {
        return '';
      }
    }

    function normalizeTempExecAiPriority(value) {
      var text = value === null || value === undefined ? '' : String(value);
      text = text.trim();
      if (!text) return '';
      var head = text.charAt(0);
      if (head === 'p' || head === 'P') return 'P' + text.slice(1);
      return text;
    }

    function adaptTempExecAiGenCaseFields(parsed) {
      (parsed && Array.isArray(parsed.modules) ? parsed.modules : []).forEach(function(moduleEntry) {
        (moduleEntry && Array.isArray(moduleEntry.cases) ? moduleEntry.cases : []).forEach(function(item) {
          var precondition = normalizeTempExecAiText(item.precondition || item.preconditions || '');
          item.precondition = precondition;
          item.preconditions = precondition;
        });
      });
      return parsed;
    }

    function parseTempExecAiGenResult(raw) {
      return adaptTempExecAiGenCaseFields(tempExecAiGenModel.parseResult(raw));
    }

    function applyTempExecAiGenResultStats(ai, parsed) {
      adaptTempExecAiGenCaseFields(parsed);
      var stats = tempExecAiGenModel.buildResultStats(parsed);
      ai.resultGeneratedCount = stats.generatedCount;
      ai.resultDedupeCount = stats.dedupeCount;
    }

    function syncTempExecAiGenResultSummary() {
      tempExecAiGenView.syncResultSummary();
    }

    function renderTempExecAiGenResult() {
      tempExecAiGenView.renderResult();
    }

    function getTempExecAiGenTotalCount() {
      return tempExecAiGenView.getTotalCount();
    }

    function syncTempExecAiGenSelectionHint(totalCount) {
      tempExecAiGenView.syncSelectionHint(totalCount);
    }

    function resolveTempExecAiGenAssignedModel() {
      var model = null;
      if (core && typeof core.getAssignedModel === 'function') {
        try {
          model = core.getAssignedModel('caselibrarygen');
        } catch (err) {
          model = null;
        }
      }
      if ((!model || !model.baseUrl || !model.model) && state && state.assignments && Array.isArray(state.models)) {
        var assignedId = state.assignments.caseLibraryGenId;
        var matchId = assignedId !== undefined && assignedId !== null ? String(assignedId) : '';
        if (matchId) {
          model = state.models.find(function(item) {
            if (!item) return false;
            var idVal = item.id !== undefined && item.id !== null ? String(item.id) : '';
            var remoteVal = item.remoteId !== undefined && item.remoteId !== null ? String(item.remoteId) : '';
            return idVal === matchId || remoteVal === matchId;
          }) || null;
        }
      }
      if (!model || !model.baseUrl || !model.model) return null;
      return model;
    }

    function resetTempExecAiGenState(options) {
      var ai = ensureTempExecAiGenState();
      var keepRequirement = options && options.keepRequirement === true;
      ai.loading = false;
      ai.generated = false;
      ai.error = '';
      ai.modules = [];
      ai.selection = new Set();
      ai.taskSignature = '';
      ai.taskId = '';
      ai.runToken = '';
      ai.resultToken = '';
      ai.readResultToken = '';
      ai.hasUnreadResult = false;
      ai.generationMode = '';
      ai.resultGeneratedCount = 0;
      ai.resultDedupeCount = 0;
      if (!keepRequirement) {
        ai.requirementText = '';
        ai.requirementFileName = '';
      }
      if (tempExecAiGenRequirementInput && !keepRequirement) {
        tempExecAiGenRequirementInput.value = '';
      }
      if (tempExecAiGenFileName && !keepRequirement) {
        tempExecAiGenFileName.textContent = '未选择文件';
      }
      if (tempExecAiGenImportStatus && !keepRequirement) {
        setStatus(tempExecAiGenImportStatus, '', '');
      }
      setStatus(tempExecAiGenStatus, '', '');
      renderTempExecAiGenResult();
      syncTempExecAiGenRunBtn();
      syncTempExecAiGenButton();
    }

    function discardTempExecAiGenResult(options) {
      options = options || {};
      var ai = ensureTempExecAiGenState();
      var fileId = ai.caseFileId || (state && state.tempExecActiveId ? state.tempExecActiveId : null);
      var task = getCurrentTempExecAiGenTask();
      var manager = getTempExecAiGenManager();
      if (task && task.id) tempExecAiGenTaskRunner.clear(task.id);
      if (manager && typeof manager.clearTask === 'function') manager.clearTask('temp-exec');
      tempExecAiGenStore.clearBadgeRecord(fileId);
      tempExecAiGenStore.clearAppendRecord(fileId);
      resetTempExecAiGenState({ keepRequirement: options.keepRequirement === true });
      ai.caseFileId = fileId;
      ai.hasUnreadResult = false;
      syncTempExecAiGenButton();
      syncTempExecAiGenRunBtn();
      syncTempExecAiGenAssignEntryBadge();
      if (api && typeof api.renderTempFocusZone === 'function') api.renderTempFocusZone();
      if (api && typeof api.renderTempVersionGrid === 'function') api.renderTempVersionGrid();
      if (api && typeof api.renderTempExecNav === 'function') api.renderTempExecNav();
      if (options.silent !== true) {
        setStatus(tempExecAiGenStatus, '已清空本次 AI 生成结果', 'ok');
        showTempExecCenterToast('已清空本次 AI 生成结果，可重新发起生成。', 'ok');
        tempExecAiGenView.closeDrawer();
      }
    }

    function syncTempExecAiGenContext() {
      var ai = ensureTempExecAiGenState();
      var fileId = state && state.tempExecActiveId ? state.tempExecActiveId : null;
      if (!fileId) {
        resetTempExecAiGenState();
        syncTempExecAiGenButton();
        syncTempExecAiGenRunBtn();
        syncTempExecAiGenAssignEntryBadge();
        return;
      }
      if (ai.caseFileId && String(ai.caseFileId) !== String(fileId)) {
        resetTempExecAiGenState();
      }
      ai.caseFileId = fileId;
      syncTempExecAiGenBadgeForFile(fileId);
      syncTempExecAiGenTaskState();
      syncTempExecAiGenButton();
      syncTempExecAiGenRunBtn();
      syncTempExecAiGenAssignEntryBadge();
    }

    function handleTempExecAiGenFile(file) {
      if (!file || !tempExecAiGenRequirementInput) return;
      var ai = ensureTempExecAiGenState();
      var name = file.name || '';
      if (tempExecAiGenFileName) tempExecAiGenFileName.textContent = name || '未选择文件';
      ai.requirementFileName = name || '';
      setStatus(tempExecAiGenImportStatus, '正在读取文件...', '');
      Promise.resolve().then(function() {
        return tempExecAiGenFileParser.read(file);
      })
        .then(function(text) {
          var content = String(text || '');
          ai.requirementText = content;
          tempExecAiGenRequirementInput.value = content;
          setStatus(tempExecAiGenImportStatus, '文件读取完成', 'ok');
        })
        .catch(function(err) {
          setStatus(tempExecAiGenImportStatus, '读取失败：' + (err && err.message ? err.message : '未知错误'), 'err');
        })
        .finally(function() {
          syncTempExecAiGenRunBtn();
        });
    }

    function clearTempExecAiGenRequirement() {
      var ai = ensureTempExecAiGenState();
      ai.requirementText = '';
      ai.requirementFileName = '';
      if (tempExecAiGenRequirementInput) tempExecAiGenRequirementInput.value = '';
      if (tempExecAiGenFileName) tempExecAiGenFileName.textContent = '未选择文件';
      if (tempExecAiGenImportStatus) setStatus(tempExecAiGenImportStatus, '', '');
      syncTempExecAiGenRunBtn();
    }

    function runTempExecAiGen(prepContext) {
      var ai = ensureTempExecAiGenState();
      if (ai.loading) return;
      var currentFileId = state && state.tempExecActiveId ? state.tempExecActiveId : null;
      var conflict = tempExecAiGenTaskRunner.getRunningConflict(currentFileId);
      if (conflict && conflict.type === 'other-file') {
        showTempExecCenterToast(
          conflict.fileName
            ? ('用例「' + conflict.fileName + '」正在生成，请等待完成后再生成。')
            : '已有用例正在生成，请等待完成后再生成。',
          'warn'
        );
        return;
      }
      if (conflict && conflict.type === 'same-file') {
        syncTempExecAiGenTaskState();
        showTempExecCenterToast('当前用例正在生成，请稍候。', 'warn');
        return;
      }
      var reason = resolveTempExecAiGenDisabledReason();
      if (reason === 'no-model') {
        showTempExecCenterToast('请到AI功能-功能指派 页面下，配置该功能模型。', 'warn');
        return;
      }
      if (reason === 'no-case') {
        showTempExecCenterToast('请先选择执行用例。', 'warn');
        return;
      }
      if (reason === 'archived') {
        showTempExecCenterToast('该用例已归档，无法生成。', 'warn');
        return;
      }
      var requirementText = prepContext && prepContext.requirementText !== undefined
        ? prepContext.requirementText
        : (tempExecAiGenRequirementInput ? tempExecAiGenRequirementInput.value : ai.requirementText);
      requirementText = normalizeTempExecAiText(requirementText || '');
      if (!requirementText) {
        setStatus(tempExecAiGenStatus, '请先填写需求内容', 'warn');
        return;
      }
      ai.requirementText = requirementText;
      if (prepContext && prepContext.requirementFileName !== undefined) {
        ai.requirementFileName = String(prepContext.requirementFileName || '');
      }
      if (tempExecAiGenRequirementInput) tempExecAiGenRequirementInput.value = requirementText;
      if (tempExecAiGenFileName) tempExecAiGenFileName.textContent = ai.requirementFileName || '未选择文件';
      var currentFile = api && typeof api.getTempExecFile === 'function'
        ? api.getTempExecFile(state.tempExecActiveId)
        : null;
      if (!currentFile || !Array.isArray(currentFile.cases)) {
        setStatus(tempExecAiGenStatus, '未找到执行用例内容', 'warn');
        return;
      }
      var prepared;
      try {
        prepared = tempExecAiGenTaskRunner.prepare({
          caseFile: currentFile,
          items: currentFile.cases || [],
          requirementText: requirementText,
          requirementFileName: ai.requirementFileName || '',
          prepContext: prepContext || null,
        });
      } catch (err) {
        if (err && err.code === 'no-model') {
          showTempExecCenterToast('请到AI功能-功能指派 页面下，配置该功能模型。', 'warn');
        } else {
          setStatus(
            tempExecAiGenStatus,
            err && err.message ? err.message : '模型客户端不可用，请刷新页面后重试',
            'err'
          );
        }
        return;
      }
      ai.runToken = prepared.runToken;
      ai.loading = true;
      ai.generated = false;
      ai.error = '';
      ai.modules = [];
      ai.selection = new Set();
      ai.taskSignature = prepared.signature;
      ai.caseFileId = currentFile ? currentFile.id : null;
      ai.generationMode = prepared.generationMode;
      ai.resultGeneratedCount = 0;
      ai.resultDedupeCount = 0;
      setStatus(tempExecAiGenStatus, '正在生成用例...', '');
      renderTempExecAiGenResult();
      syncTempExecAiGenRunBtn();
      syncTempExecAiGenButton();

      var execution = tempExecAiGenTaskRunner.start(prepared, {
        getSourceCases: function() { return currentFile.cases || []; },
        onDedupeStart: function() {
          setStatus(tempExecAiGenStatus, '正在进行 AI 语义去重...', '');
        },
      });
      if (execution.mode === 'managed') {
        applyTempExecAiGenTaskState(execution.task);
        return;
      }

      var genOk = false;
      var resultToken = execution.resultToken || ai.runToken;
      execution.promise
        .then(function(parsed) {
          if (resultToken) tempExecAiGenStore.resetAppendRecord(ai.caseFileId, resultToken);
          if (parsed && parsed.error) {
            ai.error = parsed.error;
            setStatus(tempExecAiGenStatus, '生成失败：' + parsed.error, 'err');
            ai.modules = [];
            ai.resultGeneratedCount = 0;
            ai.resultDedupeCount = 0;
          } else {
            ai.modules = parsed && Array.isArray(parsed.modules) ? parsed.modules : [];
            applyTempExecAiGenResultStats(ai, parsed);
            if (resultToken) {
              tempExecAiGenModel.applyAppendMap(
                ai.modules,
                tempExecAiGenStore.getAppendMap(ai.caseFileId, resultToken)
              );
            }
            setStatus(tempExecAiGenStatus, tempExecAiGenModel.formatCompleteStatus(ai), 'ok');
            genOk = true;
          }
        })
        .catch(function(err) {
          ai.error = err && err.message ? err.message : '生成失败';
          setStatus(tempExecAiGenStatus, '生成失败：' + ai.error, 'err');
        })
        .finally(function() {
          ai.loading = false;
          ai.generated = true;
          ai.selection = new Set();
          renderTempExecAiGenResult();
          if (genOk) markTempExecAiGenResultReady(resultToken, ai.caseFileId);
          syncTempExecAiGenRunBtn();
          syncTempExecAiGenButton();
        });
    }

    function selectAllTempExecAiGenCases() {
      tempExecAiGenView.selectAll();
    }

    function clearTempExecAiGenSelection() {
      tempExecAiGenView.clearSelection();
    }

    function appendTempExecAiGenSelection(anchorEl) {
      var ai = ensureTempExecAiGenState();
      var fileId = state && state.tempExecActiveId ? String(state.tempExecActiveId || '') : '';
      if (!fileId) {
        setStatus(tempExecStatus, '请先选择执行用例', 'warn');
        return;
      }
      if (!api || typeof api.appendTempExecAiCases !== 'function') return;
      var selection = ai.selection instanceof Set ? ai.selection : new Set();
      if (!selection.size) return;
      var selectedCases = tempExecAiGenModel.collectSelectedCases(ai.modules, selection);
      if (!selectedCases.length) return;
      openConfirmDrawer({
        title: '确认追加用例',
        message: '确定追加已勾选的 ' + selectedCases.length + ' 条用例吗？',
        confirmText: '确认追加',
        cancelText: '取消',
        previousDrawer: tempExecAiGenView.getDrawerReference(),
      }).then(function(res) {
        if (!res || res.ok !== true) return;
        var result = api.appendTempExecAiCases(fileId, selectedCases, anchorEl);
        if (!result || result.ok !== true) return;
        var count = Number.isFinite(Number(result.count)) ? Number(result.count) : selectedCases.length;
        var appendedKeys = [];
        var appendToken = ai.resultToken || ai.runToken || ai.taskSignature || '';
        selectedCases.forEach(function(item) {
          if (!item || typeof item !== 'object') return;
          var caseKey = item.__aiCaseKey || tempExecAiGenDiffModel.buildCaseItemKey(item);
          if (caseKey) {
            item.__aiCaseKey = caseKey;
            appendedKeys.push(caseKey);
          }
          item.__aiAppended = true;
        });
        if (appendToken && appendedKeys.length) {
          tempExecAiGenStore.markAppendKeys(fileId, appendToken, appendedKeys);
        }
        ai.selection = new Set();
        renderTempExecAiGenResult();
        syncTempExecAiGenSelectionHint(0);
        if (count > 0) {
          showTempExecCenterToast('追加 ' + count + '条 用例成功！', 'ok');
        }
      });
    }
    function bindTempExecAiGenEvents() {
      tempExecAiGenView.bindEvents();
    }

    bindTempExecAiGenEvents();

    return {
      getState: ensureTempExecAiGenState,
      applyTaskState: applyTempExecAiGenTaskState,
      syncContext: syncTempExecAiGenContext,
      syncTaskState: syncTempExecAiGenTaskState,
      syncButton: syncTempExecAiGenButton,
      syncRunButton: syncTempExecAiGenRunBtn,
      syncAssignEntryBadge: syncTempExecAiGenAssignEntryBadge,
      markAssignEntryBadgeRead: markTempExecAiGenAssignEntryBadgeRead,
      markFocusBadgeRead: markTempExecAiGenFocusBadgeRead,
      markAssignItemBadgeRead: markTempExecAiGenAssignItemBadgeRead,
      openPrepAndRun: tempExecAiGenPrep.open,
      handleFile: handleTempExecAiGenFile,
      clearRequirement: clearTempExecAiGenRequirement,
      run: runTempExecAiGen,
      selectAll: selectAllTempExecAiGenCases,
      clearSelection: clearTempExecAiGenSelection,
      discardResult: discardTempExecAiGenResult,
      regenerate: tempExecAiGenPrep.regenerate,
      appendSelection: appendTempExecAiGenSelection,
      setRequirementText: function(value) {
        var ai = ensureTempExecAiGenState();
        ai.requirementText = value === null || value === undefined ? '' : String(value);
        syncTempExecAiGenRunBtn();
      },
      setSelection: function(key, checked) {
        tempExecAiGenView.setSelection(key, checked);
      },
    };
  }

  return { create: create };
});
