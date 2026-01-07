(function() {
  // 启动时预标记“用例库同步触发序号”：
  // - 仅当刷新前处于 tempexec（sessionStorage 记录）时，认为本次加载需要触发一次“同步+自动弹 diff”检查
  // - 进入 tempexec 页签时也会由 tempexec 模块递增该序号
  try {
    window.app = window.app || {};
    var cfg = window.app.config || {};
    var key = cfg.activeTabKey || 'usecase-active-tab';
    var saved = '';
    if (key && typeof sessionStorage !== 'undefined') {
      try {
        saved = String(sessionStorage.getItem(key) || '');
      } catch (err) {
        saved = '';
      }
    }
    if (saved === 'tempexec') {
      var prev = Number(window.app.__tempexecCaseLibrarySyncSeq || 0);
      if (!Number.isFinite(prev) || prev < 0) prev = 0;
      window.app.__tempexecCaseLibrarySyncSeq = prev + 1;
      window.app.__tempexecCaseLibrarySyncReason = 'load';
    }
  } catch (err) {
    try {
      window.app = window.app || {};
      if (!Number.isFinite(Number(window.app.__tempexecCaseLibrarySyncSeq || 0))) {
        window.app.__tempexecCaseLibrarySyncSeq = 0;
      }
    } catch (err2) {
      // ignore
    }
  }

  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var dom = ctx.dom || {};
    var api = ctx.api || {};
    var activeTabKey = ctx.activeTabKey || 'usecase-active-tab';
    var appUtils = ctx.appUtils || {};
    var assignIfPresent = ctx.assignIfPresent || function(target) { return target; };
    var tempExecApi = ctx.tempExecApi || {};
    var setStatus = ctx.setStatus || function() {};
    var renderAssignmentsSelect = ctx.renderAssignmentsSelect || function() {};
    var ensureCaseGenModulesFromSplit = ctx.ensureCaseGenModulesFromSplit || function() { return false; };
    var renderCaseGeneration = ctx.renderCaseGeneration || function() {};
    var updateAutoClarifyVisibility = ctx.updateAutoClarifyVisibility || function() {};
    var syncAutoCompareStatus = ctx.syncAutoCompareStatus || function() {};
    var updateAutoMissingCard = ctx.updateAutoMissingCard || function() {};
    var renderSettingsUI = ctx.renderSettingsUI || function() {};
    var updateMissingView = ctx.updateMissingView || function() {};
    var toggleSplitView = ctx.toggleSplitView || function() {};
    var shouldExpectCleanJson = ctx.shouldExpectCleanJson || function() { return false; };
    var runCleaning = ctx.runCleaning || function() {};
    var copyCleaned = ctx.copyCleaned || function() {};
    var renderCleanView = ctx.renderCleanView || function() {};
    var renderCleanRawView = ctx.renderCleanRawView || function() {};
    var locateCleanRawSelection = ctx.locateCleanRawSelection || function() {};
    var compareCoverage = ctx.compareCoverage || function() {};
    var compareCasesCoverage = ctx.compareCasesCoverage || function() {};
    var exportCompareResult = ctx.exportCompareResult || function() {};
    var importCompareResult = ctx.importCompareResult || function() {};
    var toggleMissingView = ctx.toggleMissingView || function() {};
    var copyMissingJson = ctx.copyMissingJson || function() {};
    var handleMissingSelectionChange = ctx.handleMissingSelectionChange || function() {};
    var handleMissingSelectAll = ctx.handleMissingSelectAll || function() {};
    var smartFillMissingSuggestions = ctx.smartFillMissingSuggestions || function() {};
    var exportCasesCoverage = ctx.exportCasesCoverage || function() {};
    var importCasesCoverage = ctx.importCasesCoverage || function() {};
    var getSafeRequirementSlug = ctx.getSafeRequirementSlug || function() { return 'requirement'; };
    var parseSplitModules = ctx.parseSplitModules || function() { return []; };
    var scrollToSection = ctx.scrollToSection || function() {};
    var scrollElementIntoView = ctx.scrollElementIntoView || function() {};
    var goCasesGenAndScroll = ctx.goCasesGenAndScroll || function() {};
    var refreshMissingSmartFillButton = ctx.refreshMissingSmartFillButton || function() {};
    var updateFlowStatus = ctx.updateFlowStatus || function() {};
    var setCaseViewHint = ctx.setCaseViewHint || function() {};
    var renderCaseGenProgressBoard = api.renderCaseGenProgressBoard || ctx.renderCaseGenProgressBoard || function() {};
    var persistSettings = ctx.persistSettings || function() {};
    var loadModels = ctx.loadModels || function() {};
    var loadAssignments = ctx.loadAssignments || function() {};
    var renderModels = ctx.renderModels || function() {};
    var renderImportedCaseList = ctx.renderImportedCaseList || function() {};
    var renderAutoRawInfo = ctx.renderAutoRawInfo || function() {};
    var syncReviewViewFromResult = ctx.syncReviewViewFromResult || function() {};
    var syncSplitView = ctx.syncSplitView || function() {};
    var resetModelForm = ctx.resetModelForm || function() {};
    var toggleImportedCaseView = ctx.toggleImportedCaseView || function() {};
    var escapeHtml = ctx.escapeHtml;
    var escapeHtmlPreserve = ctx.escapeHtmlPreserve;
    var formatCompactTimestamp = ctx.formatCompactTimestamp || function() { return ''; };
    var callModelWithConfig = ctx.callModelWithConfig || function() { return Promise.reject(); };
    var getAssignedModel = ctx.getAssignedModel || function() {};
    var updateModelTiming = ctx.updateModelTiming || function() {};
    var downloadBlob = ctx.downloadBlob || function() {};
    var parseXmindFile = ctx.parseXmindFile || function() { return Promise.resolve({ text: '', list: [] }); };
    var updateAssignmentStatuses = ctx.updateAssignmentStatuses || function() {};
    var updateReasoningVisibility = ctx.updateReasoningVisibility || function() {};
    var testModel = ctx.testModel || function() {};
    var hasCaseSource = api.hasCaseSource || function() { return false; };
    var getCombinedCaseList = api.getCombinedCaseList || function() { return []; };
    var getCombinedCaseText = api.getCombinedCaseText || function() { return ''; };
    var deriveCaseListFromText = api.deriveCaseListFromText || function() { return []; };
    var parseCaseList = api.parseCaseList || function() { return []; };
    var renderCaseTable = api.renderCaseTable || function() {};
    var goToCaseGeneration = api.goToCaseGeneration || function() {};
    var generateCasesForModule = api.generateCasesForModule || function() {};
    var toggleCaseView = api.toggleCaseView || function() {};
    var exportModuleCases = api.exportModuleCases || function() {};
    var exportSelectedCases = api.exportSelectedCases || function() {};
    var exportSelectedCasesToXmind = api.exportSelectedCasesToXmind || function() {};
    var exportSelectedModulesToXmind = api.exportSelectedModulesToXmind || function() {};
    var transferModuleToTempExec = api.transferModuleToTempExec || function() {};
    var transferSelectedCasesToExec = api.transferSelectedCasesToExec || function() {};
    var importModuleCases = api.importModuleCases || function() {};
    var clearModuleCases = api.clearModuleCases || function() {};
    var topUpCasesForModule = api.topUpCasesForModule || function() {};
    var appendSelectedCasesToImported = api.appendSelectedCasesToImported || function() {};
    var handleCaseSelectionChange = api.handleCaseSelectionChange || function() {};
    var handleCaseSelectAll = api.handleCaseSelectAll || function() {};
    var exportCaseGenerationResults = api.exportCaseGenerationResults || function() {};
    var sidebarBlockersBound = false;
    var workflowStorageKey = ctx.workflowStorageKey
      || (window.app && window.app.config && window.app.config.workflowStorageKey)
      || 'usecase-workflow-state-v1';
    var storage = window.app && window.app.services && window.app.services.storage ? window.app.services.storage : null;
    var workflowPersistBound = false;
    var workflowRestoring = false;
    var autoCompareSuggestionInput = typeof document !== 'undefined' ? document.getElementById('autoCompareSuggestion') : null;

    function getPersistUserId() {
      if (state.currentUser && (state.currentUser.id || state.currentUser.id === 0)) {
        return String(state.currentUser.id);
      }
      return '';
    }

    function cloneJson(value, fallback) {
      if (value === undefined || value === null) return fallback;
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (err) {
        return fallback;
      }
    }

    function normalizeImportedCases(list) {
      if (!Array.isArray(list)) return [];
      return list.map(function(item, idx) {
        var entry = item && typeof item === 'object' ? item : {};
        var name = entry.name ? String(entry.name) : ('测试用例' + (idx + 1));
        var text = entry.text ? String(entry.text) : '';
        var id = entry.id ? String(entry.id) : ('case-' + Date.now().toString(16) + '-' + idx);
        var caseList = Array.isArray(entry.list) ? entry.list : [];
        return {
          id: id,
          name: name,
          text: text,
          list: caseList,
        };
      });
    }

    function serializeCaseSelections(selectionMap) {
      var result = {};
      if (!selectionMap || typeof selectionMap !== 'object') return result;
      Object.keys(selectionMap).forEach(function(key) {
        var sel = selectionMap[key];
        if (!sel || typeof sel.forEach !== 'function') return;
        result[key] = Array.from(sel);
      });
      return result;
    }

    function serializeNumberSet(value) {
      if (!value || typeof value.forEach !== 'function') return [];
      return Array.from(value);
    }

    function serializeReviewClarifications(map) {
      var list = [];
      if (!map || typeof map.forEach !== 'function') return list;
      map.forEach(function(value, key) {
        var idx = Number(key);
        if (!Number.isFinite(idx)) return;
        list.push({ index: idx, text: value ? String(value) : '' });
      });
      return list;
    }

    function buildWorkflowSnapshot() {
      var data = {
        requirementLabel: state.requirementLabel || '',
        requirementLabelSource: state.requirementLabelSource || '',
        lastRawImportName: state.lastRawImportName || '',
        rawText: dom.rawText && dom.rawText.value ? dom.rawText.value : '',
        reviewResult: dom.reviewResultEl && dom.reviewResultEl.value ? dom.reviewResultEl.value : '',
        cleanedText: dom.cleanedTextEl && dom.cleanedTextEl.value ? dom.cleanedTextEl.value : '',
        compareResult: dom.compareResultEl && dom.compareResultEl.value ? dom.compareResultEl.value : '',
        splitResult: dom.splitResultEl && dom.splitResultEl.value ? dom.splitResultEl.value : '',
        casesCompareResult: dom.casesCompareResultEl && dom.casesCompareResultEl.value ? dom.casesCompareResultEl.value : '',
        caseText: dom.caseTextEl && dom.caseTextEl.value ? dom.caseTextEl.value : '',
        importedCases: normalizeImportedCases(state.importedCases),
        reviewClarifications: serializeReviewClarifications(state.reviewClarifications),
        autoCompareSuggestion: state.autoCompareSuggestion || (autoCompareSuggestionInput ? autoCompareSuggestionInput.value : ''),
        autoRequireClarifications: Boolean(state.autoRequireClarifications),
        caseGenSource: state.caseGenSource || '',
        caseGenModules: cloneJson(state.caseGenModules, []),
        caseGenResults: cloneJson(state.caseGenResults, {}),
        caseGenSuggestions: cloneJson(state.caseGenSuggestions, {}),
        caseGenModuleStatus: cloneJson(state.caseGenModuleStatus, {}),
        caseGenProgress: cloneJson(state.caseGenProgress, {}),
        caseGenProgressNotice: cloneJson(state.caseGenProgressNotice, {}),
        caseSelections: serializeCaseSelections(state.caseSelections),
        missingSelections: serializeNumberSet(state.missingSelections),
      };
      return {
        version: 1,
        user_id: getPersistUserId(),
        updated_at: Date.now(),
        data: data,
      };
    }

    function buildWorkflowNavSnapshot(data) {
      if (!data || typeof data !== 'object') return {};
      return {
        rawText: data.rawText || '',
        reviewResult: data.reviewResult || '',
        cleanedText: data.cleanedText || '',
        compareResult: data.compareResult || '',
        splitResult: data.splitResult || '',
        casesCompareResult: data.casesCompareResult || '',
        caseText: data.caseText || '',
        importedCases: Array.isArray(data.importedCases) ? data.importedCases : [],
      };
    }

    function hasRequirementLabel(data) {
      if (!data) return false;
      var label = data.requirementLabel ? String(data.requirementLabel).trim() : '';
      if (!label) return false;
      var source = data.requirementLabelSource ? String(data.requirementLabelSource).trim() : '';
      if (source && source !== 'default') return true;
      return label !== '当前需求';
    }

    function snapshotHasContent(snapshot) {
      var data = snapshot && snapshot.data ? snapshot.data : {};
      function hasText(value) {
        return Boolean(value && String(value).trim());
      }
      if (hasText(data.rawText)) return true;
      if (hasText(data.reviewResult)) return true;
      if (hasText(data.cleanedText)) return true;
      if (hasText(data.compareResult)) return true;
      if (hasText(data.splitResult)) return true;
      if (hasText(data.casesCompareResult)) return true;
      if (hasText(data.caseText)) return true;
      if (hasText(data.autoCompareSuggestion)) return true;
      if (hasRequirementLabel(data)) return true;
      if (data.autoRequireClarifications) return true;
      if (Array.isArray(data.importedCases) && data.importedCases.length) return true;
      if (Array.isArray(data.caseGenModules) && data.caseGenModules.length) return true;
      if (data.reviewClarifications && data.reviewClarifications.length) return true;
      if (data.caseGenSuggestions && typeof data.caseGenSuggestions === 'object') {
        var hasSug = Object.keys(data.caseGenSuggestions).some(function(key) {
          return hasText(data.caseGenSuggestions[key]);
        });
        if (hasSug) return true;
      }
      if (data.caseGenResults && typeof data.caseGenResults === 'object') {
        var hasRes = Object.keys(data.caseGenResults).some(function(key) {
          var val = (data.caseGenResults[key] || '').trim();
          return Boolean(val && !/^\[\s*\]$/.test(val));
        });
        if (hasRes) return true;
      }
      return false;
    }

    function persistWorkflowStateNow() {
      if (workflowRestoring || !workflowStorageKey) return;
      if (!storage || typeof storage.setJson !== 'function') return;
      var snapshot = buildWorkflowSnapshot();
      if (!snapshotHasContent(snapshot)) {
        if (state) state.workflowNavSnapshot = {};
        if (storage && typeof storage.remove === 'function') storage.remove(workflowStorageKey);
        return;
      }
      if (state) state.workflowNavSnapshot = buildWorkflowNavSnapshot(snapshot.data);
      storage.setJson(workflowStorageKey, snapshot);
    }

    var persistWorkflowState = typeof appUtils.debounce === 'function'
      ? appUtils.debounce(persistWorkflowStateNow, 300)
      : persistWorkflowStateNow;
    if (!window.app) window.app = {};
    window.app.persistWorkflowState = persistWorkflowState;
    window.app.persistWorkflowStateNow = persistWorkflowStateNow;
    api.persistWorkflowState = persistWorkflowState;
    api.persistWorkflowStateNow = persistWorkflowStateNow;

    function restoreReviewClarifications(list) {
      var map = new Map();
      if (!Array.isArray(list)) return map;
      list.forEach(function(item) {
        if (!item || typeof item !== 'object') return;
        var idx = Number(item.index);
        if (!Number.isFinite(idx)) return;
        map.set(idx, item.text ? String(item.text) : '');
      });
      return map;
    }

    function restoreCaseSelections(data) {
      var result = {};
      if (!data || typeof data !== 'object') return result;
      Object.keys(data).forEach(function(key) {
        var items = Array.isArray(data[key]) ? data[key] : [];
        result[key] = new Set(items.map(function(v) { return Number(v); }).filter(function(v) { return Number.isFinite(v); }));
      });
      return result;
    }

    function restoreNumberSet(list) {
      if (!Array.isArray(list)) return new Set();
      return new Set(list.map(function(item) { return Number(item); }).filter(function(item) { return Number.isFinite(item); }));
    }

    function applyWorkflowSnapshot(snapshot) {
      if (!snapshot || !snapshot.data || typeof snapshot.data !== 'object') return false;
      var data = snapshot.data;
      if (state) state.workflowNavSnapshot = buildWorkflowNavSnapshot(data);
      state.requirementLabel = data.requirementLabel || '';
      state.requirementLabelSource = data.requirementLabelSource || '';
      state.lastRawImportName = data.lastRawImportName || '';
      if (dom.rawText) dom.rawText.value = data.rawText || '';
      if (dom.fileName) {
        dom.fileName.textContent = data.lastRawImportName ? String(data.lastRawImportName) : '未选择文件';
      }
      if (dom.reviewResultEl) dom.reviewResultEl.value = data.reviewResult || '';
      if (dom.cleanedTextEl) dom.cleanedTextEl.value = data.cleanedText || '';
      if (dom.compareResultEl) dom.compareResultEl.value = data.compareResult || '';
      if (dom.splitResultEl) dom.splitResultEl.value = data.splitResult || '';
      if (dom.casesCompareResultEl) dom.casesCompareResultEl.value = data.casesCompareResult || '';
      if (dom.caseTextEl) dom.caseTextEl.value = data.caseText || '';
      state.importedCases = normalizeImportedCases(data.importedCases);
      state.reviewClarifications = restoreReviewClarifications(data.reviewClarifications);
      state.autoCompareSuggestion = data.autoCompareSuggestion || '';
      state.autoRequireClarifications = Boolean(data.autoRequireClarifications);
      if (autoCompareSuggestionInput) autoCompareSuggestionInput.value = state.autoCompareSuggestion;
      if (dom.autoClarifyToggle) dom.autoClarifyToggle.checked = state.autoRequireClarifications;
      state.caseGenSource = data.caseGenSource || '';
      state.caseGenModules = Array.isArray(data.caseGenModules) ? data.caseGenModules : [];
      state.caseGenResults = (data.caseGenResults && typeof data.caseGenResults === 'object') ? data.caseGenResults : {};
      state.caseGenSuggestions = (data.caseGenSuggestions && typeof data.caseGenSuggestions === 'object') ? data.caseGenSuggestions : {};
      state.caseGenModuleStatus = (data.caseGenModuleStatus && typeof data.caseGenModuleStatus === 'object') ? data.caseGenModuleStatus : {};
      state.caseGenProgress = (data.caseGenProgress && typeof data.caseGenProgress === 'object') ? data.caseGenProgress : {};
      state.caseGenProgressNotice = (data.caseGenProgressNotice && typeof data.caseGenProgressNotice === 'object') ? data.caseGenProgressNotice : {};
      if (!state.caseGenProgressNotice.lastStates || typeof state.caseGenProgressNotice.lastStates !== 'object') {
        state.caseGenProgressNotice.lastStates = {};
      }
      state.caseGenProgressNotice.dotVisible = state.caseGenProgressNotice.dotVisible === true;
      state.caseSelections = restoreCaseSelections(data.caseSelections);
      state.missingSelections = restoreNumberSet(data.missingSelections);
      state.missingRowCache = [];
      state.missingLastList = [];
      state.caseGenRunning = new Set();
      state.inProgressStep = '';
      state.inProgressSteps = {};
      state.failedSteps = {};
      state.waitingSteps = {};
      state.validationFailedSteps = {};
      state.failedReasons = {};
      state.waitingReasons = {};
      state.validationFailedReasons = {};
      state.autoRunning = false;
      return true;
    }

    function restoreWorkflowState() {
      if (!storage || typeof storage.getJson !== 'function') return false;
      if (!workflowStorageKey) return false;
      var snapshot = storage.getJson(workflowStorageKey, null);
      if (!snapshot || typeof snapshot !== 'object') return false;
      if (snapshot.user_id && state.currentUser && (state.currentUser.id || state.currentUser.id === 0)) {
        if (String(snapshot.user_id) !== String(state.currentUser.id)) return false;
      }
      return applyWorkflowSnapshot(snapshot);
    }

    function bindWorkflowPersistenceListeners() {
      if (workflowPersistBound) return;
      var targets = [
        dom.rawText,
        dom.reviewResultEl,
        dom.cleanedTextEl,
        dom.compareResultEl,
        dom.splitResultEl,
        dom.casesCompareResultEl,
        dom.caseTextEl,
      ];
      targets.forEach(function(el) {
        if (!el || !el.addEventListener) return;
        el.addEventListener('input', function() { persistWorkflowState(); });
      });
      if (autoCompareSuggestionInput && autoCompareSuggestionInput.addEventListener) {
        autoCompareSuggestionInput.addEventListener('input', function() { persistWorkflowState(); });
      }
      if (dom.autoClarifyToggle && dom.autoClarifyToggle.addEventListener) {
        dom.autoClarifyToggle.addEventListener('change', function() { persistWorkflowState(); });
      }
      workflowPersistBound = true;
    }

    const cleanModule = window.app.clean && typeof window.app.clean.init === 'function'
      ? window.app.clean.init({
        state: state,
        shouldExpectCleanJson: shouldExpectCleanJson,
        handlers: {
          runCleaning: runCleaning,
          copyCleaned: copyCleaned,
          renderCleanView: renderCleanView,
          renderCleanRawView: renderCleanRawView,
          locateCleanRawSelection: locateCleanRawSelection,
        },
        dom: dom,
      })
      : null;
    const compareModule = window.app.compare && typeof window.app.compare.init === 'function'
      ? window.app.compare.init({
        handlers: {
          compareCoverage: compareCoverage,
          compareCasesCoverage: compareCasesCoverage,
          exportCompareResult: exportCompareResult,
          importCompareResult: importCompareResult,
          toggleMissingView: toggleMissingView,
          copyMissingJson: copyMissingJson,
          handleMissingSelectionChange: handleMissingSelectionChange,
          handleMissingSelectAll: handleMissingSelectAll,
          smartFillMissingSuggestions: smartFillMissingSuggestions,
          exportCasesCoverage: exportCasesCoverage,
          importCasesCoverage: importCasesCoverage,
          triggerCoverageSampleDownload: function(btn) {
            const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
            const slug = typeof getSafeRequirementSlug === 'function' ? getSafeRequirementSlug() : 'requirement';
            setTimeout(function() {
              const trigger = btn || document.getElementById('exportCasesCoverage');
              const link = document.createElement('a');
              link.id = 'exportCasesCoverage';
              link.className = trigger ? trigger.className : '';
              link.textContent = trigger ? trigger.textContent : '导出对比结果';
              link.download = 'cases_compare_' + slug + '_' + stamp + '.txt';
              link.href = 'assets/cases_compare_sample.txt';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }, 0);
          },
          handleCasesCompareInput: function() {
            updateMissingView();
            updateFlowStatus();
          },
        },
      })
      : null;
    const splitModule = window.app.split && typeof window.app.split.init === 'function'
      ? window.app.split.init({
        handlers: {
          splitModules: api.splitModules,
          toggleSplitView: toggleSplitView,
        },
      })
      : null;

    function focusAssignSaveIfNeeded() {
      var assignBtn = document.querySelector('[data-tab-btn="assign"]');
      var badge = assignBtn && assignBtn.querySelector('.tab-notice');
      var needScroll = Boolean(state && state.assignmentsMissing);
      if (!needScroll) {
        needScroll = badge && typeof badge.textContent === 'string' && badge.textContent.indexOf('未保存指派模型') !== -1;
      }
      if (!needScroll) return;
      var saveBar = document.getElementById('assignSaveBar');
      var saveBtn = document.getElementById('saveAssignments');
      if (saveBar) saveBar.classList.remove('hidden');
      var target = saveBar || saveBtn;
      if (!target) return;
      function scrollToSave() {
        if (target.scrollIntoView) {
          target.scrollIntoView({ behavior: 'auto', block: 'start' });
        } else if (typeof scrollElementIntoView === 'function') {
          scrollElementIntoView(target, 'auto', 140);
        }
      }
      setTimeout(scrollToSave, 0);
      setTimeout(scrollToSave, 200);
      setTimeout(scrollToSave, 400);
    }

    (function bindAssignTabClick() {
      var assignBtn = document.querySelector('[data-tab-btn="assign"]');
      if (!assignBtn) return;
      assignBtn.addEventListener('click', focusAssignSaveIfNeeded);
    })();

    function isDrawerOpen() {
      var body = document.body;
      var root = document.documentElement;
      var bodyHas = body && body.classList && body.classList.contains('drawer-open');
      var rootHas = root && root.classList && root.classList.contains('drawer-open');
      if (bodyHas || rootHas) return true;
      var openDrawer = document.querySelector ? document.querySelector('.drawer.open') : null;
      return Boolean(openDrawer);
    }

    function blockSidebarIfDrawerOpen(e) {
      if (!isDrawerOpen()) return false;
      var target = e && e.target && e.target.closest ? e.target.closest('.sidebar') : null;
      if (!target) return false;
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      return true;
    }

    function ensureSidebarBlockers() {
      var alreadyBound = sidebarBlockersBound || (window.app && window.app.sidebarBlockersBound);
      if (alreadyBound) return;
      document.addEventListener('pointerdown', blockSidebarIfDrawerOpen, true);
      document.addEventListener('click', blockSidebarIfDrawerOpen, true);
      document.addEventListener('keydown', blockSidebarIfDrawerOpen, true);
      sidebarBlockersBound = true;
      if (!window.app) window.app = {};
      window.app.sidebarBlockersBound = true;
    }
    if (!window.app) window.app = {};
    window.app.isDrawerOpen = isDrawerOpen;

    function getGroupNameForTab(tabName) {
      var menus = Array.prototype.slice.call(document.querySelectorAll('.tab-submenu'));
      for (var i = 0; i < menus.length; i++) {
        var menu = menus[i];
        if (!menu) continue;
        var match = menu.querySelector('[data-tab-btn="' + tabName + '"]');
        if (match && menu.dataset && menu.dataset.groupMenu) {
          return menu.dataset.groupMenu;
        }
      }
      return '';
    }

    var currentPathEl = dom.currentPath || document.getElementById('currentPath');
    var currentPathTextEl = dom.currentPathText || document.getElementById('currentPathText');
    var pathSubMap = { tempexec: '执行分配' };
    var lastTabByGroup = {};

    function getTabLabel(tabName) {
      if (!tabName) return '';
      var btn = document.querySelector('[data-tab-btn="' + tabName + '"]');
      if (!btn) return '';
      var labelEl = btn.querySelector ? btn.querySelector('.tab-submenu-label') : null;
      if (labelEl && labelEl.textContent) return String(labelEl.textContent).trim();
      return btn.textContent ? String(btn.textContent).trim() : '';
    }

    function getGroupLabel(tabName) {
      var groupName = getGroupNameForTab(tabName);
      if (!groupName) return '';
      var btn = document.querySelector('.tab-group-btn[data-group="' + groupName + '"]');
      if (!btn) return '';
      var labelEl = btn.querySelector ? btn.querySelector('.tab-group-label') : null;
      if (labelEl && labelEl.textContent) return String(labelEl.textContent).trim();
      return btn.textContent ? String(btn.textContent).trim() : '';
    }

    function renderCurrentPath(parts) {
      if (!currentPathTextEl) return;
      while (currentPathTextEl.firstChild) {
        currentPathTextEl.removeChild(currentPathTextEl.firstChild);
      }
      if (!parts || !parts.length) return;
      parts.forEach(function(part) {
        var meta = (part && typeof part === 'object') ? part : null;
        var label = meta ? (meta.label || '') : String(part || '');
        if (!label) return;
        var type = meta ? (meta.type || '') : '';
        var isLink = false;
        if (type === 'group' && meta.group) isLink = true;
        if (type === 'tab' && meta.tab) isLink = true;
        if (type === 'sub' && meta.tab && meta.sub) isLink = true;
        var item = document.createElement(isLink ? 'button' : 'span');
        item.className = 'path-item' + (isLink ? ' is-link' : '');
        if (isLink) item.setAttribute('type', 'button');
        if (isLink && type) item.setAttribute('data-path-type', type);
        if (isLink && type === 'group' && meta.group) item.setAttribute('data-path-group', meta.group);
        if (isLink && type === 'tab' && meta.tab) item.setAttribute('data-path-tab', meta.tab);
        if (isLink && type === 'sub') {
          if (meta.tab) item.setAttribute('data-path-tab', meta.tab);
          if (meta.sub) item.setAttribute('data-path-sub', meta.sub);
        }
        item.textContent = label;
        currentPathTextEl.appendChild(item);
      });
    }

    function updateCurrentPath(tabName, subLabel) {
      if (!currentPathEl || !currentPathTextEl) return;
      var tab = tabName || (state && state.activeTab ? state.activeTab : '');
      if (!tab) {
        renderCurrentPath([]);
        return;
      }
      var groupName = getGroupNameForTab(tab);
      var groupLabel = getGroupLabel(tab);
      var tabLabel = getTabLabel(tab) || tab;
      var parts = [];
      if (groupLabel) parts.push({ label: groupLabel, type: 'group', group: groupName });
      if (tabLabel) parts.push({ label: tabLabel, type: 'tab', tab: tab });
      if (subLabel) parts.push({ label: subLabel, type: 'sub', tab: tab, sub: subLabel });
      renderCurrentPath(parts);
    }

    function setCurrentPathSub(label, tabName) {
      var tab = tabName || (state && state.activeTab ? state.activeTab : '');
      if (!tab) return;
      pathSubMap[tab] = label ? String(label) : '';
      updateCurrentPath(tab, pathSubMap[tab]);
    }

    function resolveTabForGroup(groupName) {
      if (!groupName) return '';
      if (lastTabByGroup[groupName]) return lastTabByGroup[groupName];
      var menu = document.querySelector('[data-group-menu="' + groupName + '"]');
      if (!menu) return '';
      var buttons = Array.prototype.slice.call(menu.querySelectorAll('[data-tab-btn]'));
      for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        if (btn && btn.dataset && btn.dataset.tabBtn && !btn.classList.contains('hidden')) {
          return btn.dataset.tabBtn;
        }
      }
      if (buttons.length && buttons[0].dataset && buttons[0].dataset.tabBtn) {
        return buttons[0].dataset.tabBtn;
      }
      return '';
    }

    function dispatchPathSubJump(tabName, subLabel) {
      if (!subLabel) return;
      try {
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
          window.dispatchEvent(new CustomEvent('app-path-sub-jump', { detail: { tab: tabName || '', sub: subLabel } }));
        }
      } catch (err) {
        try {
          if (typeof document !== 'undefined' && typeof document.createEvent === 'function' && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            var evt = document.createEvent('CustomEvent');
            evt.initCustomEvent('app-path-sub-jump', false, false, { tab: tabName || '', sub: subLabel });
            window.dispatchEvent(evt);
          }
        } catch (err2) {
          // ignore
        }
      }
    }

    if (currentPathTextEl) {
      currentPathTextEl.addEventListener('click', function(e) {
        if (blockSidebarIfDrawerOpen(e)) return;
        var target = e && e.target && e.target.closest ? e.target.closest('.path-item.is-link') : null;
        if (!target || !currentPathTextEl.contains(target)) return;
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        var type = target.getAttribute('data-path-type') || '';
        if (type === 'group') {
          var group = target.getAttribute('data-path-group') || '';
          var tab = resolveTabForGroup(group);
          if (tab) switchTab(tab);
          else if (group) showTabGroup(group);
        } else if (type === 'tab') {
          var tabName = target.getAttribute('data-path-tab') || '';
          if (tabName) switchTab(tabName);
        } else if (type === 'sub') {
          var subTab = target.getAttribute('data-path-tab') || '';
          var subLabel = target.getAttribute('data-path-sub') || '';
          if (subTab) switchTab(subTab);
          if (subLabel) dispatchPathSubJump(subTab, subLabel);
        }
      });
    }

    function showTabGroup(name, opts) {
      opts = opts || {};
      var keepTabActive = Boolean(opts.keepTabActive);
      var expand = opts.expand !== false; // 默认展开
      if (!window.app) window.app = {};
      window.app.lastTabGroup = name || '';
      window.app.lastShowRan = true;
      var menus = Array.prototype.slice.call(document.querySelectorAll('.tab-submenu'));
      menus.forEach(function(menu) {
        var group = menu.closest('.tab-group');
        if (group && group.classList) group.classList.remove('open');
        menu.classList.add('hidden');
        menu.style.display = 'none';
        var btn = group && group.querySelector('.tab-group-btn');
        if (btn && btn.setAttribute) btn.setAttribute('aria-expanded', 'false');
        if (btn && btn.classList) btn.classList.remove('hovering');
      });
      if (!name) return;
      var target = document.querySelector('[data-group-menu="' + name + '"]');
      var targetGroup = target && target.closest ? target.closest('.tab-group') : null;
      var tBtn = targetGroup && targetGroup.querySelector ? targetGroup.querySelector('.tab-group-btn') : null;
      if (expand && target && targetGroup) {
        target.classList.remove('hidden');
        target.style.display = 'flex';
        targetGroup.classList.add('open');
        if (tBtn && tBtn.setAttribute) tBtn.setAttribute('aria-expanded', 'true');
      }
      if (expand && tBtn && tBtn.classList) tBtn.classList.add('hovering');
      if (keepTabActive) {
        var activeTabName = state && state.activeTab;
        if (activeTabName) {
          var tabBtns = Array.prototype.slice.call(document.querySelectorAll('[data-tab-btn]'));
          tabBtns.forEach(function(tb) {
            var isActive = tb.dataset && tb.dataset.tabBtn === activeTabName;
            tb.classList.toggle('active', isActive);
          });
        }
      }
    }
    if (window.app) window.app.showTabGroup = showTabGroup;

    function markActiveTabGroup(tabName) {
      var activeGroup = '';
      if (dom.tabSubmenus && typeof dom.tabSubmenus.forEach === 'function') {
        dom.tabSubmenus.forEach(function(menu) {
          var hasBtn = menu && menu.querySelector && menu.querySelector('[data-tab-btn=\"' + tabName + '\"]');
          if (hasBtn && menu.dataset && menu.dataset.groupMenu) {
            activeGroup = menu.dataset.groupMenu;
          }
        });
      }
      if (dom.tabGroupButtons && typeof dom.tabGroupButtons.forEach === 'function') {
        dom.tabGroupButtons.forEach(function(btn) {
          var match = btn.dataset && btn.dataset.group === activeGroup;
          btn.classList.toggle('active', Boolean(match));
        });
      }
    }

    (function bindTabGroups() {
      ensureSidebarBlockers();
      if (!window.app) window.app = {};
      window.app.isDrawerOpen = isDrawerOpen;
      var buttons = dom.tabGroupButtons;
      if (!buttons || typeof buttons.forEach !== 'function' || !buttons.length) {
        dom.tabGroups = document.querySelectorAll('.tab-group');
        dom.tabSubmenus = document.querySelectorAll('.tab-submenu');
        buttons = document.querySelectorAll('.tab-group-btn');
        dom.tabGroupButtons = buttons;
      }
      if (!buttons || typeof buttons.forEach !== 'function') return;
      window.app.tabGroupBound = true;
      if (dom.tabGroups && typeof dom.tabGroups.forEach === 'function') {
        dom.tabGroups.forEach(function(group) {
          var btn = group.querySelector('.tab-group-btn');
          var name = btn && btn.dataset ? btn.dataset.group : '';
          group.addEventListener('mouseenter', function() {
            if (isDrawerOpen()) return;
            showTabGroup(name);
          });
        });
      }
      buttons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          if (blockSidebarIfDrawerOpen(e)) return;
          if (!window.app) window.app = {};
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          var name = btn.dataset && btn.dataset.group;
          window.app.lastTabClick = name || '';
          window.app.lastShowCall = 'pending';
          if (!name) return;
          showTabGroup(name);
          window.app.lastShowCall = 'force-open-' + name;
        });
        btn.addEventListener('mouseenter', function() {
          if (isDrawerOpen()) return;
          var name = btn.dataset && btn.dataset.group;
          if (!name) return;
          showTabGroup(name);
        });
        btn.addEventListener('focus', function() {
          if (isDrawerOpen()) return;
          var name = btn.dataset && btn.dataset.group;
          if (!name) return;
          showTabGroup(name);
        });
      });
      document.addEventListener('click', function(e) {
        if (isDrawerOpen()) return;
        var insideGroup = e && e.target && e.target.closest && e.target.closest('.tab-group');
        if (!insideGroup) showTabGroup('');
      });
      var sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        sidebar.addEventListener('mouseleave', function() { showTabGroup(''); });
      }
      document.addEventListener('click', function(ev) {
        if (blockSidebarIfDrawerOpen(ev)) return;
        var btn = ev && ev.target && ev.target.closest ? ev.target.closest('.tab-group-btn') : null;
        if (!btn) return;
        var name = btn.dataset ? btn.dataset.group : '';
        if (!name) return;
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
        showTabGroup(name);
      });
    })();

    function getLoginSeq() {
      try {
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem('tap-login-seq') || '';
        }
      } catch (err) {
        // ignore
      }
      return '';
    }

    function persistActiveTabForSession(name) {
      if (!name) return;
      if (!activeTabKey || typeof sessionStorage === 'undefined') return;
      try {
        sessionStorage.setItem(activeTabKey, name);
        var seq = getLoginSeq();
        if (seq) sessionStorage.setItem('tap-active-tab-login-seq', seq);
      } catch (err) {
        // ignore
      }
    }

    function getActiveTabFromDom() {
      // 兜底：如果某些路径未走 switchTab，也尽量从 DOM 推断当前可见页签并持久化。
      var btn = document.querySelector('[data-tab-btn].active');
      var tab = btn && btn.dataset ? btn.dataset.tabBtn : '';
      return tab || (state && state.activeTab ? state.activeTab : '');
    }

    function getTabPageMap() {
      var cfg = window.app && window.app.config ? window.app.config : {};
      return cfg && cfg.tabPageMap ? cfg.tabPageMap : {};
    }

    function parseQuery(search) {
      var result = {};
      if (!search) return result;
      var raw = String(search || '').replace(/^\?/, '');
      if (!raw) return result;
      raw.split('&').forEach(function(pair) {
        if (!pair) return;
        var parts = pair.split('=');
        var key = decodeURIComponent(parts.shift() || '');
        if (!key) return;
        var value = parts.length ? decodeURIComponent(parts.join('=')) : '';
        result[key] = value;
      });
      return result;
    }

    function buildQuery(params) {
      var list = [];
      var keys = Object.keys(params || {});
      keys.forEach(function(key) {
        if (!key) return;
        var val = params[key];
        if (val === undefined || val === null || val === '') return;
        list.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(val)));
      });
      return list.length ? '?' + list.join('&') : '';
    }

    function getCurrentPageName() {
      if (typeof window === 'undefined' || !window.location) return '';
      var path = window.location.pathname || '';
      if (!path) return '';
      var parts = path.split('/').filter(Boolean);
      return parts.length ? parts[parts.length - 1] : '';
    }

    function getTabFromUrl() {
      if (typeof window === 'undefined' || !window.location) return '';
      var params = parseQuery(window.location.search || '');
      return params && params.tab ? String(params.tab || '') : '';
    }

    function buildTabUrl(path, tabName) {
      if (!path) return '';
      var hash = '';
      var hashIndex = path.indexOf('#');
      if (hashIndex >= 0) {
        hash = path.slice(hashIndex);
        path = path.slice(0, hashIndex);
      }
      var queryIndex = path.indexOf('?');
      var params = {};
      var base = path;
      if (queryIndex >= 0) {
        params = parseQuery(path.slice(queryIndex));
        base = path.slice(0, queryIndex);
      }
      if (tabName) {
        params.tab = tabName;
      } else if (params.tab) {
        delete params.tab;
      }
      return base + buildQuery(params) + hash;
    }

    function shouldForceRedirect() {
      var pageKey = '';
      if (document && document.body && document.body.dataset && document.body.dataset.page) {
        pageKey = String(document.body.dataset.page || '');
      }
      if (pageKey === 'index') return true;
      var current = getCurrentPageName();
      return !current || current === 'index.html' || current === 'index';
    }

    function syncHistoryForTab(name, options) {
      if (!name) return;
      if (typeof window === 'undefined' || !window.history || typeof window.history.pushState !== 'function') return;
      var current = (window.location ? (window.location.pathname || '') + (window.location.search || '') + (window.location.hash || '') : '');
      if (!current) return;
      var target = buildTabUrl(current, name);
      if (!target || target === current) return;
      try {
        if (options && options.replaceHistory) {
          window.history.replaceState({ tab: name }, '', target);
        } else {
          window.history.pushState({ tab: name }, '', target);
        }
      } catch (err) {
        // ignore
      }
    }

    function resolveTabPage(name) {
      if (!name) return '';
      var map = getTabPageMap();
      return map && map[name] ? String(map[name]) : '';
    }

    function hasLocalTabSection(name) {
      if (!name || typeof document === 'undefined') return false;
      return Boolean(document.querySelector('[data-tab-section=\"' + name + '\"]'));
    }

    function redirectToTabPage(name) {
      var target = resolveTabPage(name);
      if (!target) return false;
      var current = getCurrentPageName();
      if (current && current === target) return false;
      persistActiveTabForSession(name);
      try {
        window.location.href = buildTabUrl(target, name) || target;
      } catch (err) {
        // ignore
      }
      return true;
    }

    function switchTab(name, options) {
      if (name && (shouldForceRedirect() || !hasLocalTabSection(name))) {
        var redirected = redirectToTabPage(name);
        if (redirected) return;
      }
      var now = Date.now();
      var skipHooks = false;
      if (state.activeTab === name) {
        var lastName = state._lastTabSwitchName || '';
        var lastAt = Number(state._lastTabSwitchAt || 0);
        if (lastName === name && now - lastAt < 200) {
          skipHooks = true;
        }
      }
      state._lastTabSwitchName = name;
      state._lastTabSwitchAt = now;
      // 重复切到当前页签时不必关闭抽屉：避免误关，并避免影响“刷新后恢复抽屉打开态”的体验。
      if (state.activeTab !== name && window.app && window.app.drawer && typeof window.app.drawer.closeAllDrawers === 'function') {
        window.app.drawer.closeAllDrawers();
      }
      state.activeTab = name;
      var activeGroupName = getGroupNameForTab(name);
      if (activeGroupName) lastTabByGroup[activeGroupName] = name;
      // Only persist within the current tab session:
      // - refresh should restore the current tab
      // - re-login should go back to default (login flow clears sessionStorage)
      persistActiveTabForSession(name);
      dom.tabButtons.forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset && btn.dataset.tabBtn === name);
      });
      dom.tabSections.forEach(function(sec) {
        const match = sec.dataset && sec.dataset.tabSection === name;
        sec.classList.toggle('hidden', !match);
      });
      if (dom.autoClarifySection) {
        const shouldShow = state.autoRequireClarifications && name === 'auto';
        dom.autoClarifySection.classList.toggle('hidden', !shouldShow);
      }
      if (dom.flowNav) {
        // 管理类页面/执行页需要自己的顶部导航，隐藏默认“AI一键步骤”导航栏。
        dom.flowNav.classList.toggle(
          'hidden',
          name === 'tempexec' || name === 'project-admin' || name === 'user-admin' || name === 'exec-overview' || name === 'case-library' || name === 'case-archive' || name === 'ops-log' || name === 'settings'
        );
      }
      if (dom.tempexecFlowNav) {
        dom.tempexecFlowNav.classList.toggle('hidden', name !== 'tempexec');
      }
      if (name === 'models') clearStatusById('modelFormStatus');
      if (name === 'assign') {
        if (!skipHooks) {
          renderAssignmentsSelect();
          ['reviewAssignStatus', 'cleanAssignStatus', 'compareAssignStatus', 'splitAssignStatus', 'casesAssignStatus', 'caseGenAssignStatus', 'caseFilterAssignStatus']
            .forEach(clearStatusById);
          focusAssignSaveIfNeeded();
        }
      }
      if (name === 'casesgen') {
        if (!skipHooks) {
          const autoFilled = ensureCaseGenModulesFromSplit();
          if (autoFilled) {
            setStatus(dom.caseGenStatus, '', '');
            renderCaseGeneration();
          } else if (state.caseGenModules.length) {
            renderCaseGeneration();
          }
          if (dom.toSplitFromCaseGenBtn) dom.toSplitFromCaseGenBtn.classList.remove('hidden');
        }
      }
      if (name === 'auto') {
        if (!skipHooks) {
          updateAutoClarifyVisibility();
          syncAutoCompareStatus(false);
          updateAutoMissingCard();
        }
      }
      if (name === 'settings') {
        if (!skipHooks) {
          renderSettingsUI();
          clearStatusById('feishuWebhookStatus');
        }
      }
      // 进入“用例执行”页签时：递增一次“用例库同步触发序号”，并尽量触发一次执行页数据刷新。
      // 这样即便业务模块尚未绑定 app-tab-activated 监听，也能在切页时完成一次同步检查（仅 DB 模式会产生实际同步）。
      if (name === 'tempexec') {
        if (!skipHooks) {
          try {
            window.app = window.app || {};
            var prev = Number(window.app.__tempexecCaseLibrarySyncSeq || 0);
            if (!Number.isFinite(prev) || prev < 0) prev = 0;
            window.app.__tempexecCaseLibrarySyncSeq = prev + 1;
            window.app.__tempexecCaseLibrarySyncReason = 'tab-enter';
          } catch (err) {
            // ignore
          }
          try {
            if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
              setTimeout(function() {
                try {
                  window.app.tempExecApi.loadTempExecState();
                } catch (err2) {
                  // ignore
                }
              }, 0);
            }
          } catch (err3) {
            // ignore
          }
        }
      }
      markActiveTabGroup(name);
      updateCurrentPath(name, pathSubMap[name] || '');
      var grp = getGroupNameForTab(name);
      showTabGroup(grp, { keepTabActive: true, expand: false });
      // 给各业务模块一个统一的“页签激活”钩子：用于刷新后恢复页签时也能自动拉取数据。
      if (!skipHooks) {
        try {
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent('app-tab-activated', { detail: { tab: name } }));
          }
        } catch (err) {
          // ignore
        }
      }
      try {
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          var pageSize = state && Number.isFinite(Number(state.tempExecPageSize)) ? Number(state.tempExecPageSize) : null;
          if (pageSize !== null) {
            try {
              window.dispatchEvent(new CustomEvent('app-page-size-changed', { detail: { size: pageSize } }));
            } catch (err2) {
              if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
                var evt = document.createEvent('CustomEvent');
                evt.initCustomEvent('app-page-size-changed', false, false, { size: pageSize });
                window.dispatchEvent(evt);
              }
            }
          }
        }
      } catch (err3) {
        // ignore
      }
      if (!options || !options.skipHistory) {
        syncHistoryForTab(name, options);
      }
    }
    api.switchTab = switchTab;
    // 兜底：页面刷新/关闭前再写一次 activeTab，避免少数情况下首次切页后未落到 sessionStorage 的问题。
    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('beforeunload', function() {
          var tab = getActiveTabFromDom();
          persistActiveTabForSession(tab);
          // 标记“刷新来源页签”，用于执行页做“仅在执行页刷新才触发自动同步/diff”的判定。
          // 注意：来源标记会同时在“离开页面”时写入，但执行页侧会结合 navigation.type=reload 做最终判断，避免误触发。
          try {
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem('tap-reload-source-tab', tab || '');
            }
          } catch (err) {
            // ignore
          }
        });
        window.addEventListener('visibilitychange', function() {
          if (document && document.visibilityState === 'hidden') {
            persistActiveTabForSession(getActiveTabFromDom());
          }
        });
        window.addEventListener('popstate', function() {
          var tab = getTabFromUrl();
          if (tab) switchTab(tab, { skipHistory: true });
        });
      }
    } catch (err) {
      // ignore
    }
    document.addEventListener('click', function(e) {
      if (blockSidebarIfDrawerOpen(e)) return;
      const tabBtn = e && e.target && e.target.closest ? e.target.closest('[data-tab-btn]') : null;
      if (tabBtn && tabBtn.dataset && tabBtn.dataset.tabBtn) {
        switchTab(tabBtn.dataset.tabBtn);
      }
    });
    if (dom.toSplitFromCaseGenBtn) {
      dom.toSplitFromCaseGenBtn.addEventListener('click', function() {
        switchTab('clean');
        if (dom.tabButtons && typeof dom.tabButtons.forEach === 'function') {
          dom.tabButtons.forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset && btn.dataset.tabBtn === 'clean');
          });
        }
        if (dom.tabSections && typeof dom.tabSections.forEach === 'function') {
          dom.tabSections.forEach(function(sec) {
            var match = sec.dataset && sec.dataset.tabSection === 'clean';
            sec.classList.toggle('hidden', !match);
          });
        }
        if (typeof scrollToSection === 'function') {
          scrollToSection('split');
        } else if (dom.splitResultEl) {
          scrollElementIntoView(dom.splitResultEl, 'smooth', 140);
        }
      });
    }

    function clearStatusById(id) {
      const el = document.getElementById(id);
      if (el) setStatus(el, '', '');
    }

    const core = {};
    assignIfPresent(core, {
      state: state,
      config: window.app.config,
      utils: appUtils,
      setStatus: setStatus,
      switchTab: switchTab,
      scrollToSection: scrollToSection,
      hasCaseSource: hasCaseSource,
      getCombinedCaseList: getCombinedCaseList,
      getCombinedCaseText: getCombinedCaseText,
      deriveCaseListFromText: deriveCaseListFromText,
      parseCaseList: parseCaseList,
      renderCaseTable: renderCaseTable,
      formatCompactTimestamp: formatCompactTimestamp,
      escapeHtml: escapeHtml,
      escapeHtmlPreserve: escapeHtmlPreserve,
      updateFlowStatus: updateFlowStatus,
      updateCurrentPath: updateCurrentPath,
      setCurrentPathSub: setCurrentPathSub,
      callModelWithConfig: callModelWithConfig,
      getAssignedModel: getAssignedModel,
      updateModelTiming: updateModelTiming,
      setCaseViewHint: setCaseViewHint,
      downloadBlob: downloadBlob,
      parseXmindFile: parseXmindFile,
      scrollElementIntoView: scrollElementIntoView,
      updateAssignmentStatuses: updateAssignmentStatuses,
      updateReasoningVisibility: updateReasoningVisibility,
      testModel: testModel,
      renderCaseGeneration: renderCaseGeneration,
      persistWorkflowState: persistWorkflowState,
      persistWorkflowStateNow: persistWorkflowStateNow,
    }, Object.keys({
      state: 1, config: 1, utils: 1, setStatus: 1, switchTab: 1, scrollToSection: 1, hasCaseSource: 1, getCombinedCaseList: 1,
      getCombinedCaseText: 1, deriveCaseListFromText: 1, parseCaseList: 1, renderCaseTable: 1, formatCompactTimestamp: 1, escapeHtml: 1,
      escapeHtmlPreserve: 1, updateFlowStatus: 1, updateCurrentPath: 1, setCurrentPathSub: 1, callModelWithConfig: 1, getAssignedModel: 1, updateModelTiming: 1, setCaseViewHint: 1,
      downloadBlob: 1, parseXmindFile: 1, scrollElementIntoView: 1, updateAssignmentStatuses: 1, updateReasoningVisibility: 1, testModel: 1,
      renderCaseGeneration: 1, persistWorkflowState: 1, persistWorkflowStateNow: 1,
    }));
    assignIfPresent(core, api, [
      'waitForAutoClarification',
      'enforceAutoCoverageRequirement',
      'setStepWaiting',
      'clearStepWaiting',
      'clearAllWaitingSteps',
      'setStepFailed',
      'clearStepFailed',
      'clearAllFailedSteps',
      'syncAutoCompareStatus',
    ]);
    window.app.core = core;

    const casesGenApi = {};
    assignIfPresent(casesGenApi, {
      goToCaseGeneration: goToCaseGeneration,
      generateCasesForModule: generateCasesForModule,
      generateAllCaseGenModules: api.generateAllCaseGenModules || function() {},
      toggleCaseView: toggleCaseView,
      exportModuleCases: exportModuleCases,
      exportSelectedCases: exportSelectedCases,
      exportSelectedCasesToXmind: exportSelectedCasesToXmind,
      exportSelectedModulesToXmind: exportSelectedModulesToXmind,
      transferModuleToTempExec: transferModuleToTempExec,
      transferSelectedCasesToExec: transferSelectedCasesToExec,
      importModuleCases: importModuleCases,
      clearModuleCases: clearModuleCases,
      topUpCasesForModule: topUpCasesForModule,
      topUpAllCaseGenModules: api.topUpAllCaseGenModules || function() {},
      appendSelectedCasesToImported: appendSelectedCasesToImported,
      refreshAppendExistingButton: api.refreshAppendExistingButton || function() {},
      refreshExportCaseGenXmindButton: api.refreshExportCaseGenXmindButton || function() {},
      setCaseGenDbStoreNewAction: api.setCaseGenDbStoreNewAction || function() {},
      clearCaseGenDbStoreNewActionError: api.clearCaseGenDbStoreNewActionError || function() {},
      openCaseGenAllView: api.openCaseGenAllView || function() {},
      openCaseGenDbStoreNewDrawer: api.openCaseGenDbStoreNewDrawer || function() {},
      openCaseGenDbStoreAppendDrawer: api.openCaseGenDbStoreAppendDrawer || function() {},
      renderAppendTargetOptions: api.renderAppendTargetOptions || function() {},
      handleCaseSelectionChange: handleCaseSelectionChange,
      handleCaseSelectAll: handleCaseSelectAll,
      handleCaseSelectAllModules: api.handleCaseSelectAllModules || function() {},
      exportCaseGenerationResults: exportCaseGenerationResults,
      ensureCaseGenModulesFromSplit: ensureCaseGenModulesFromSplit,
      renderCaseGeneration: renderCaseGeneration,
    }, Object.keys({
      goToCaseGeneration: 1, generateCasesForModule: 1, generateAllCaseGenModules: 1, toggleCaseView: 1, exportModuleCases: 1, exportSelectedCases: 1,
      exportSelectedCasesToXmind: 1, exportSelectedModulesToXmind: 1, transferModuleToTempExec: 1, importModuleCases: 1, clearModuleCases: 1, topUpCasesForModule: 1,
      topUpAllCaseGenModules: 1,
      appendSelectedCasesToImported: 1, transferSelectedCasesToExec: 1,
      refreshAppendExistingButton: 1, refreshExportCaseGenXmindButton: 1,
      setCaseGenDbStoreNewAction: 1, clearCaseGenDbStoreNewActionError: 1,
      openCaseGenAllView: 1, openCaseGenDbStoreNewDrawer: 1, openCaseGenDbStoreAppendDrawer: 1,
      handleCaseSelectionChange: 1, handleCaseSelectAll: 1, handleCaseSelectAllModules: 1,
      exportCaseGenerationResults: 1, ensureCaseGenModulesFromSplit: 1, renderCaseGeneration: 1,
      renderAppendTargetOptions: 1,
    }));
    if (!casesGenApi.renderCaseGeneration && typeof api.renderCaseGeneration === 'function') {
      casesGenApi.renderCaseGeneration = api.renderCaseGeneration;
    }
    window.app.casesGenApi = casesGenApi;

    function clearPreloadNavFlags() {
      try {
        var root = document && document.documentElement ? document.documentElement : null;
        if (!root) return;
        if (root.dataset) {
          if (root.dataset.preloadNav !== undefined) delete root.dataset.preloadNav;
          if (root.dataset.initTab !== undefined) delete root.dataset.initTab;
        } else {
          root.removeAttribute('data-preload-nav');
          root.removeAttribute('data-init-tab');
        }
      } catch (err) {
        // ignore
      }
    }

    function initApp() {
      if (window.app && window.app._inited) return;
      if (!window.app) window.app = {};
      window.app._inited = true;
      workflowRestoring = true;
      restoreWorkflowState();
      function resolveInitialTab() {
        var defaultTab = 'auto';
        try {
          var cfg = window.app && window.app.config ? window.app.config : {};
          var pageDefaults = cfg && cfg.pageDefaultTabMap ? cfg.pageDefaultTabMap : {};
          var pageKey = '';
          if (document && document.body && document.body.dataset && document.body.dataset.page) {
            pageKey = String(document.body.dataset.page || '');
          }
          if (!pageKey) pageKey = 'index';
          if (pageDefaults && pageDefaults[pageKey]) {
            defaultTab = String(pageDefaults[pageKey] || defaultTab);
          }
        } catch (err) {
          defaultTab = 'auto';
        }
        var urlTab = getTabFromUrl();
        if (urlTab) return urlTab;
        var saved = '';
        if (activeTabKey && typeof sessionStorage !== 'undefined') {
          try {
            saved = sessionStorage.getItem(activeTabKey) || '';
          } catch (err) {
            saved = '';
          }
        }
        // 仅在同一次登录会话内恢复页签（避免登出/重新登录回到旧页签）。
        try {
          if (saved && typeof sessionStorage !== 'undefined') {
            var tabSeq = sessionStorage.getItem('tap-active-tab-login-seq') || '';
            var loginSeq = '';
            if (typeof localStorage !== 'undefined') loginSeq = localStorage.getItem('tap-login-seq') || '';
            if (loginSeq && !tabSeq) {
              // 补写一次，避免首次切页后刷新不生效需要第二次。
              sessionStorage.setItem('tap-active-tab-login-seq', loginSeq);
              tabSeq = loginSeq;
            }
            if (loginSeq && tabSeq && tabSeq !== loginSeq) {
              saved = '';
            }
          }
        } catch (err) {
          // ignore
        }
        var tabs = [];
        if (dom.tabSections && dom.tabSections.length) {
          dom.tabSections.forEach(function(sec) {
            if (sec && sec.dataset && sec.dataset.tabSection) {
              tabs.push(sec.dataset.tabSection);
            }
          });
        } else if (dom.tabButtons && dom.tabButtons.length) {
          dom.tabButtons.forEach(function(btn) {
            if (btn && btn.dataset && btn.dataset.tabBtn) {
              tabs.push(btn.dataset.tabBtn);
            }
          });
        }
        var isValidSaved = saved && tabs.indexOf(saved) !== -1;
        if (isValidSaved) return saved;
        var hasDefault = tabs.indexOf(defaultTab) !== -1;
        if (hasDefault) return defaultTab;
        return tabs.length ? tabs[0] : defaultTab;
      }
      loadModels();
      loadAssignments();
      renderModels();
      renderAssignmentsSelect();
      renderSettingsUI();
      renderCaseGeneration();
      renderImportedCaseList();
      renderAutoRawInfo();
      renderCleanView();
      renderCleanRawView(null);
      updateMissingView();
      updateAutoClarifyVisibility();
      updateAutoMissingCard();
      syncReviewViewFromResult();
      syncSplitView();
      resetModelForm();
      var initialTab = resolveInitialTab();
      switchTab(initialTab, { replaceHistory: true });
      clearPreloadNavFlags();
      if (initialTab === 'auto') {
        scrollToSection('auto-import', { behavior: 'instant' });
      }
      const casegenCoreModule = window.app.casegenCore && typeof window.app.casegenCore.init === 'function'
        ? window.app.casegenCore.init({
          state: state,
          handlers: {
            renderCaseGeneration: renderCaseGeneration,
            ensureCaseGenModulesFromSplit: ensureCaseGenModulesFromSplit,
            exportCaseGenerationResults: exportCaseGenerationResults,
            scrollToSection: scrollToSection,
            updateFlowStatus: updateFlowStatus,
            switchTab: switchTab,
            scrollElementIntoView: scrollElementIntoView,
            parseSplitModules: parseSplitModules,
            refreshMissingSmartFillButton: refreshMissingSmartFillButton,
            syncSplitView: syncSplitView,
            updateMissingView: updateMissingView,
            persistWorkflowState: persistWorkflowState,
          },
          setStatus: setStatus,
          dom: dom,
        })
        : null;
      assignIfPresent(api, casegenCoreModule, ['goToCaseGeneration', 'goCasesGenAndScroll']);
      if (typeof api.goToCaseGeneration === 'function') {
        casesGenApi.goToCaseGeneration = api.goToCaseGeneration;
      }
      if (typeof api.goCasesGenAndScroll === 'function') {
        casesGenApi.goCasesGenAndScroll = api.goCasesGenAndScroll;
      }

      const casegenHandlersModule = window.app.casegenHandlers && typeof window.app.casegenHandlers.init === 'function'
        ? window.app.casegenHandlers.init({
          state: state,
          handlers: {
            goCasesGenAndScroll: api.goCasesGenAndScroll || goCasesGenAndScroll,
            scrollToSection: scrollToSection,
            switchTab: switchTab,
          },
          persistSettings: persistSettings,
          dom: dom,
        })
        : null;
      const layoutHandlersModule = window.app.layoutHandlers && typeof window.app.layoutHandlers.init === 'function'
        ? window.app.layoutHandlers.init({
          state: state,
          updateFlowStatus: updateFlowStatus,
          scrollToSection: scrollToSection,
          switchTab: switchTab,
          handlers: {
            toggleSplitView: toggleSplitView,
            toggleImportedCaseView: toggleImportedCaseView,
            scrollElementIntoView: scrollElementIntoView,
          },
          dom: dom,
      })
      : null;
    const casegenProgressModule = window.app.casegenProgress && typeof window.app.casegenProgress.init === 'function'
      ? window.app.casegenProgress.init({
        state: state,
        dom: dom,
        utils: appUtils,
        escapeHtml: escapeHtml,
        persistWorkflowState: persistWorkflowState,
      })
      : null;
    assignIfPresent(api, casegenProgressModule, [
      'renderCaseGenProgressBoard',
      'setCaseModuleRunning',
      'isCaseModuleRunning',
      'renderCaseModuleProgress',
      'updateCaseProgressView',
      'clearCaseProgress',
      'initCaseProgress',
      'setCaseProgressGroupState',
      'setCaseProgressStep',
      'markAllCaseProgressGroups',
    ]);
    if (api && typeof api.renderCaseGenProgressBoard === 'function') {
      api.renderCaseGenProgressBoard();
    }
    if (state.caseGenModules && state.caseGenModules.length) {
      renderCaseGeneration();
    }
      setCaseViewHint('请先上传或输入 XMind 测试用例');
      updateFlowStatus();
      bindWorkflowPersistenceListeners();
      workflowRestoring = false;
      return { casegenHandlersModule: casegenHandlersModule, casegenCoreModule: casegenCoreModule, layoutHandlersModule: layoutHandlersModule };
    }
    window.app = window.app || {};
    window.app.init = initApp;

    renderCaseGenProgressBoard();

    const moduleContext = { state: state, config: window.app.config, utils: appUtils, core: core, tempExecApi: tempExecApi, casesGenApi: casesGenApi };
    const autoContext = {
      state: state,
      config: window.app.config,
      utils: appUtils,
      core: core,
      setStatus: setStatus,
      tempExecApi: tempExecApi,
      casesGenApi: casesGenApi,
      handlers: {
        toggleAutoMissingView: api.toggleAutoMissingView,
        copyAutoMissingJson: api.copyAutoMissingJson,
        smartFillMissingSuggestions: api.smartFillMissingSuggestions,
        handleMissingSelectionChange: api.handleMissingSelectionChange,
        handleMissingSelectAll: api.handleMissingSelectAll,
        resetAutoCompareMissingView: api.resetAutoCompareMissingView,
        resetAutoCompareUserInputs: api.resetAutoCompareUserInputs,
        renderAutoCompareMissingView: api.renderAutoCompareMissingView,
        toggleAutoCompareView: api.toggleAutoCompareView,
        buildFilteredComparePayload: api.buildFilteredComparePayload,
        updateAutoCompareActions: api.updateAutoCompareActions,
        syncAutoCompareStatus: api.syncAutoCompareStatus,
        runAutoWorkflow: api.runAutoWorkflow,
        runAutoWorkflowFromClean: api.runAutoWorkflowFromClean,
        continueAutoWorkflowAfterCoverage: api.continueAutoWorkflowAfterCoverage,
        executeAutoWorkflowSteps: api.executeAutoWorkflowSteps,
        enforceAutoCoverageRequirement: api.enforceAutoCoverageRequirement,
        reviewRequirements: api.reviewRequirements,
        runCleaning: api.runCleaning,
        compareCoverage: compareCoverage,
        splitModules: api.splitModules,
        compareCasesCoverage: api.compareCasesCoverage,
        extractCoverageFromCompareResult: api.extractCoverageFromCompareResult,
        extractCompareResultData: api.extractCompareResultData,
        formatMissingRequirement: api.formatMissingRequirement,
        shouldExpectCleanJson: shouldExpectCleanJson,
        hasCaseSource: hasCaseSource,
        switchTab: switchTab,
        scrollToSection: scrollToSection,
        resetAutoMissingView: api.resetAutoMissingView,
        ensureAutoMissingViewVisible: api.ensureAutoMissingViewVisible,
        updateAutoMissingCard: api.updateAutoMissingCard,
        updateFlowStatus: updateFlowStatus,
        updateAutoClarifyVisibility: updateAutoClarifyVisibility,
        renderAutoClarifyView: api.renderAutoClarifyView,
        openAutoClarifyPanel: api.openAutoClarifyPanel,
        waitForAutoClarification: api.waitForAutoClarification,
        notifyFeishuWorkflowSuccess: api.notifyFeishuWorkflowSuccess,
        notifyFeishuCoverageFailure: api.notifyFeishuCoverageFailure,
        notifyFeishuClarificationNeeded: api.notifyFeishuClarificationNeeded,
        jumpToCleanHighlightView: api.jumpToCleanHighlightView,
        persistWorkflowState: persistWorkflowState,
      },
    };
    if (window.app.auto && typeof window.app.auto.init === 'function') {
      const autoModule = window.app.auto.init(autoContext) || {};
      assignIfPresent(api, autoModule, [
        'resetAutoCompareMissingView',
        'resetAutoCompareUserInputs',
        'renderAutoCompareMissingView',
        'toggleAutoCompareView',
        'buildFilteredComparePayload',
        'updateAutoCompareActions',
        'syncAutoCompareStatus',
      ]);
    }
    syncAutoCompareStatus(false);
    if (window.app.casesgen && typeof window.app.casesgen.init === 'function') {
      window.app.casesgen.init(moduleContext);
    }
    if (window.app.tempexec && typeof window.app.tempexec.init === 'function') {
      window.app.tempexec.init(moduleContext);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }

    return {
      switchTab: switchTab,
      core: core,
      casesGenApi: casesGenApi,
      initApp: initApp,
    };
  }

  window.app = window.app || {};
  window.app.appRuntime = { init: init };
})();
