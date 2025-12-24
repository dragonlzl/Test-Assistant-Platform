(function() {
  function init(ctx) {
    if (!ctx) return {};
    var state = ctx.state || {};
    var handlers = ctx.handlers || {};
    var dom = ctx.dom || {};
    var setStatus = ctx.setStatus || function() {};

    var goUsecaseGenBtn = dom.goUsecaseGenBtn;
    var casesGoUsecaseGenBtn = dom.casesGoUsecaseGenBtn;
    var toSplitFromCaseGenBtn = dom.toSplitFromCaseGenBtn;
    var exportCaseGenBtn = dom.exportCaseGenBtn;
    var caseGenStatus = dom.caseGenStatus;
    var casesGenerationContainer = dom.casesGenerationContainer;
    var splitResultEl = dom.splitResultEl;
    var casesCoverageStatus = dom.casesCoverageStatus;
    var splitStatus = dom.splitStatus;
    var removeModuleFiles = handlers.removeModuleFiles || function() {};

    var renderCaseGeneration = handlers.renderCaseGeneration || function() {};
    var updateFlowStatus = handlers.updateFlowStatus || function() {};
    var switchTab = handlers.switchTab || function() {};
    var scrollElementIntoView = handlers.scrollElementIntoView || function() {};
    var parseSplitModules = handlers.parseSplitModules || function() { return []; };
    var scrollToSection = handlers.scrollToSection;
    var persistWorkflowState = handlers.persistWorkflowState || function() {};

    function hasGeneratedCasesForModule(moduleId) {
      if (!moduleId) return false;
      try {
        if (window.app && window.app.casesGenApi && typeof window.app.casesGenApi.getCaseListForModule === 'function') {
          var list = window.app.casesGenApi.getCaseListForModule(moduleId);
          if (Array.isArray(list)) return list.length > 0;
        }
      } catch (err) {
        // ignore
      }
      var raw = state.caseGenResults && state.caseGenResults[moduleId] ? String(state.caseGenResults[moduleId]) : '';
      var trimmed = raw.trim ? raw.trim() : '';
      return Boolean(trimmed && !/^\[\s*\]$/.test(trimmed));
    }

    function isCaseViewOpenedForModule(moduleId) {
      if (!moduleId || typeof document === 'undefined') return false;
      var drawer = document.getElementById('caseGenViewDrawer');
      if (!drawer || !drawer.classList || !drawer.classList.contains('open')) return false;
      var body = document.getElementById('caseGenViewDrawerBody');
      if (!body || !body.querySelector) return false;
      return Boolean(body.querySelector('[data-view-container="' + moduleId + '"]'));
    }

    function openCaseViewIfAvailable(moduleId, skipRestore) {
      if (!hasGeneratedCasesForModule(moduleId)) return;
      if (isCaseViewOpenedForModule(moduleId)) return;
      var api = window.app && window.app.casesGenApi ? window.app.casesGenApi : null;
      if (!api || typeof api.toggleCaseView !== 'function') return;
      if (skipRestore) {
        try { if (window.app) window.app.__drawerSkipRestoreOnce = true; } catch (_) {}
      }
      api.toggleCaseView(moduleId);
    }

    function goToCaseGeneration(trigger) {
      var splitText = splitResultEl && splitResultEl.value ? splitResultEl.value.trim() : '';
      if (!splitText) {
        var targetStatus = trigger === 'cases' ? casesCoverageStatus : splitStatus;
        setStatus(targetStatus, '请先完成拆分后再生成用例', 'warn');
        return;
      }
      var splitChanged = !state.caseGenModules.length || state.caseGenSource !== splitText;
      if (splitChanged) {
        var modules = parseSplitModules();
        if (!modules.length) {
          var warnTarget = trigger === 'cases' ? casesCoverageStatus : splitStatus;
          setStatus(warnTarget, '未解析到有效模块，请检查拆分 JSON 是否为数组且包含 module 字段', 'warn');
          return;
        }
        state.caseGenModules = modules;
        state.caseGenResults = {};
        state.caseSelections = {};
        state.caseGenSuggestions = {};
        state.caseGenSource = splitText;
        state.caseGenModuleStatus = {};
        state.caseGenProgress = {};
        state.caseGenRunning = new Set();
        if (typeof handlers.refreshMissingSmartFillButton === 'function') {
          handlers.refreshMissingSmartFillButton();
        }
        setStatus(caseGenStatus, '', '');
        renderCaseGeneration();
        updateFlowStatus();
        persistWorkflowState();
        if (typeof handlers.syncSplitView === 'function') handlers.syncSplitView();
      } else if (state.caseGenModules.length) {
        setStatus(caseGenStatus, '', '');
        renderCaseGeneration();
        updateFlowStatus();
        persistWorkflowState();
        if (typeof handlers.syncSplitView === 'function') handlers.syncSplitView();
      } else {
        updateFlowStatus();
        persistWorkflowState();
        if (typeof handlers.syncSplitView === 'function') handlers.syncSplitView();
      }
      switchTab('casesgen');
      if (typeof handlers.updateMissingView === 'function') handlers.updateMissingView();
    }

    function goCasesGenAndScroll(moduleId) {
      switchTab('casesgen');
      renderCaseGeneration();
      var targetCard = casesGenerationContainer
        ? casesGenerationContainer.querySelector('[data-module-id=\"' + moduleId + '\"]')
        : null;
      if (targetCard) {
        scrollElementIntoView(targetCard, 'smooth', 120);
      }
      if (moduleId) {
        openCaseViewIfAvailable(moduleId, true);
      }
    }

    function jumpToSplit() {
      if (typeof switchTab === 'function') switchTab('clean');
      if (typeof scrollToSection === 'function') {
        scrollToSection('split');
        return;
      }
      var section = document.querySelector('[data-section-id="split"]');
      if (section) {
        if (typeof scrollElementIntoView === 'function') scrollElementIntoView(section, 'smooth', 140);
        else if (section.scrollIntoView) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    if (toSplitFromCaseGenBtn) {
      toSplitFromCaseGenBtn.addEventListener('click', jumpToSplit);
    }
    if (exportCaseGenBtn && typeof handlers.exportCaseGenerationResults === 'function') {
      exportCaseGenBtn.addEventListener('click', handlers.exportCaseGenerationResults);
    }

    function ensureModules() {
      if (typeof handlers.ensureCaseGenModulesFromSplit === 'function') {
        var filled = handlers.ensureCaseGenModulesFromSplit();
        if (filled && typeof handlers.renderCaseGeneration === 'function') {
          setStatus(caseGenStatus, '', '');
          handlers.renderCaseGeneration();
          persistWorkflowState();
        }
      }
    }

    ensureModules();

    return {
      ensureModules: ensureModules,
      goToCaseGeneration: goToCaseGeneration,
      goCasesGenAndScroll: goCasesGenAndScroll,
    };
  }

  window.app = window.app || {};
  window.app.casegenCore = { init: init };
})();
