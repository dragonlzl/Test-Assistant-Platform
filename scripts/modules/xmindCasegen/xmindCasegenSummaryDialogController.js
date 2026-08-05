(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenSummaryDialogController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var elements = opts.elements && typeof opts.elements === 'object' ? opts.elements : {};
    var stepRequirement = Number(opts.stepRequirement) || 1;
    var stepOptions = Number(opts.stepOptions) || 3;
    var state = { open: false, mode: 'prep' };

    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var hasActiveWorkspace = port('hasActiveWorkspace', function() { return false; });
    var notifyNoWorkspace = port('notifyNoWorkspace');
    var hideOpenMindContextMenu = port('hideOpenMindContextMenu');
    var getPrepState = port('getPrepState', function() { return {}; });
    var isPrepBaseLocked = port('isPrepBaseLocked', function() { return false; });
    var clampPrepStep = port('clampPrepStep', function(step) { return step; });
    var syncSummaryDraftIntoState = port('syncSummaryDraftIntoState');
    var renderPrep = port('renderPrep');
    var renderHistory = port('renderHistory');
    var renderKnowledgeBase = port('renderKnowledgeBase');
    var renderCoverage = port('renderCoverage');
    var hideCoverageTooltip = port('hideCoverageTooltip');
    var persistState = port('persistState');
    var releaseCoverageResources = port('releaseCoverageResources');
    var renderWorkspaceTabs = port('renderWorkspaceTabs');
    var clearHistoryUnreadNotice = port('clearHistoryUnreadNotice');
    var syncHistoryButtonState = port('syncHistoryButtonState');

    function normalizeMode(mode) {
      var value = String(mode || '');
      if (value === 'history' || value === 'knowledge-base' || value === 'coverage') return value;
      return 'prep';
    }

    function getState() {
      return { open: state.open === true, mode: normalizeMode(state.mode) };
    }

    function isOpen() {
      return state.open === true;
    }

    function isModeOpen(mode) {
      return state.open === true && state.mode === normalizeMode(mode);
    }

    function setExpanded(element, expanded) {
      if (!element || typeof element.setAttribute !== 'function') return;
      element.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    function projectShell() {
      var open = state.open === true;
      var mode = normalizeMode(state.mode);
      if (elements.overlayEl) {
        elements.overlayEl.hidden = !open;
        if (typeof elements.overlayEl.setAttribute === 'function') {
          elements.overlayEl.setAttribute('aria-hidden', open ? 'false' : 'true');
        }
        if (elements.overlayEl.classList) {
          elements.overlayEl.classList.toggle('hidden', !open);
          elements.overlayEl.classList.toggle('is-open', open);
        }
      }
      setExpanded(elements.prepBtn, open && mode === 'prep');
      if (elements.prepBtn) elements.prepBtn.textContent = '生成前置准备';
      setExpanded(elements.historyBtn, open && mode === 'history');
      if (elements.historyBtn) elements.historyBtn.textContent = '生成记录';
      syncHistoryButtonState();
      setExpanded(elements.knowledgeRuleBtn, open && mode === 'knowledge-base');
      setExpanded(elements.knowledgeAiBtn, open && mode === 'knowledge-base');
      setExpanded(elements.coverageBtn, open && mode === 'coverage');
      if (elements.dialogEl && elements.dialogEl.classList) {
        elements.dialogEl.classList.toggle('xmind-casegen-coverage-dialog', open && mode === 'coverage');
      }
      if (elements.bodyEl && elements.bodyEl.classList) {
        elements.bodyEl.classList.toggle('xmind-casegen-coverage-dialog-body', open && mode === 'coverage');
      }
      if (elements.titleEl) {
        elements.titleEl.textContent = mode === 'history'
          ? '生成记录'
          : (mode === 'knowledge-base'
            ? '知识库检索结果'
            : (mode === 'coverage' ? '需求覆盖' : '生成前置准备'));
      }
      if (elements.descEl) {
        elements.descEl.textContent = mode === 'history'
          ? '记录当前 XMind 用例生成里每次节点操作的结果摘要。'
          : (mode === 'knowledge-base'
            ? '展示当前页签最近一次知识检索与 AI 筛选的状态和最终筛选内容。'
            : (mode === 'coverage'
              ? '查看当前可见用例对需求原文本身的覆盖关系。'
              : '按 3 步完成前置准备，确认后 step1 和 step2 会在本次生成中锁定。'));
      }
    }

    function renderCurrentMode() {
      if (state.mode === 'history') {
        renderHistory();
        return;
      }
      if (state.mode === 'knowledge-base') {
        renderKnowledgeBase();
        return;
      }
      if (state.mode === 'coverage') {
        renderCoverage();
        return;
      }
      renderPrep();
    }

    function refreshMode() {
      state.mode = normalizeMode(state.mode);
      projectShell();
      if (state.open === true) renderCurrentMode();
      return getState();
    }

    function canOpen() {
      if (hasActiveWorkspace()) return true;
      notifyNoWorkspace();
      return false;
    }

    function openMode(mode, optionsValue) {
      if (!canOpen()) return false;
      var openOptions = optionsValue || {};
      if (openOptions.hideContextMenu !== false) hideOpenMindContextMenu();
      state.mode = normalizeMode(mode);
      state.open = true;
      refreshMode();
      return true;
    }

    function openPrep(step) {
      if (!canOpen()) return false;
      hideOpenMindContextMenu();
      var prep = getPrepState();
      if (isPrepBaseLocked()) {
        prep.step = stepOptions;
      } else {
        var requestedStep = Number(step);
        prep.step = clampPrepStep(requestedStep >= stepRequirement && requestedStep <= stepOptions
          ? requestedStep
          : prep.step);
      }
      state.mode = 'prep';
      state.open = true;
      refreshMode();
      return true;
    }

    function openHistory() {
      if (!openMode('history')) return false;
      clearHistoryUnreadNotice();
      return true;
    }

    function openKnowledgeBase() {
      return openMode('knowledge-base');
    }

    function openCoverageShell() {
      return openMode('coverage', { hideContextMenu: false });
    }

    function close(optionsValue) {
      var closeOptions = optionsValue || {};
      hideCoverageTooltip();
      syncSummaryDraftIntoState();
      state.open = false;
      if (closeOptions.skipPersist !== true) persistState(true);
      refreshMode();
      releaseCoverageResources();
      renderWorkspaceTabs();
      return true;
    }

    function renderOpen() {
      if (state.open !== true) return false;
      hideCoverageTooltip();
      if (!hasActiveWorkspace()) {
        close({ skipPersist: true });
        return false;
      }
      if (state.mode === 'prep') syncSummaryDraftIntoState();
      renderCurrentMode();
      return true;
    }

    return {
      close: close,
      getState: getState,
      isModeOpen: isModeOpen,
      isOpen: isOpen,
      openCoverageShell: openCoverageShell,
      openHistory: openHistory,
      openKnowledgeBase: openKnowledgeBase,
      openPrep: openPrep,
      refreshMode: refreshMode,
      renderOpen: renderOpen,
    };
  }

  return { create: create };
});
