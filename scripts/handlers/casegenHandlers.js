(function() {
  function init(ctx) {
    if (!ctx) return {};
    var handlers = ctx.handlers || {};
    var dom = ctx.dom || {};
    var caseGenProgressList = dom.caseGenProgressList;
    var caseGenProgressPanel = dom.caseGenProgressPanel;
    var caseGenProgressToggle = dom.caseGenProgressToggle;
    var toSplitFromCaseGenBtn = dom.toSplitFromCaseGenBtn;
    var autoMissingGoUsecaseBtn = dom.autoMissingGoUsecaseBtn;
    var goCasesGenAndScroll = handlers.goCasesGenAndScroll;
    var scrollToSection = handlers.scrollToSection;
    var switchTab = handlers.switchTab;

    function jumpToSplit() {
      if (typeof switchTab === 'function') switchTab('clean');
      if (typeof scrollToSection === 'function') {
        scrollToSection('split');
        return;
      }
      var section = document.querySelector('[data-section-id="split"]');
      if (section && section.scrollIntoView) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    function setCaseGenProgressCollapsed(collapsed) {
      if (!caseGenProgressPanel || !caseGenProgressToggle) return;
      caseGenProgressPanel.classList.toggle('is-collapsed', collapsed);
      caseGenProgressToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      caseGenProgressToggle.textContent = collapsed ? '展开' : '收起';
    }

    if (caseGenProgressList && typeof goCasesGenAndScroll === 'function') {
      caseGenProgressList.addEventListener('click', function(e) {
        var item = e.target && e.target.closest ? e.target.closest('[data-casegen-module]') : null;
        var moduleId = item && item.dataset ? item.dataset.casegenModule : '';
        goCasesGenAndScroll(moduleId || '');
      });
    }

    if (caseGenProgressPanel && caseGenProgressToggle) {
      setCaseGenProgressCollapsed(caseGenProgressPanel.classList.contains('is-collapsed'));
      caseGenProgressToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        setCaseGenProgressCollapsed(!caseGenProgressPanel.classList.contains('is-collapsed'));
      });
    }

    if (caseGenProgressPanel && typeof goCasesGenAndScroll === 'function') {
      caseGenProgressPanel.addEventListener('click', function(e) {
        var toggleBtn = e.target && e.target.closest ? e.target.closest('#caseGenProgressToggle') : null;
        if (toggleBtn) return;
        var item = e.target && e.target.closest ? e.target.closest('[data-casegen-module]') : null;
        if (item) return;
        goCasesGenAndScroll('');
      });
    }

    if (toSplitFromCaseGenBtn) {
      toSplitFromCaseGenBtn.addEventListener('click', jumpToSplit);
    }
    if (autoMissingGoUsecaseBtn && typeof goCasesGenAndScroll === 'function') {
      autoMissingGoUsecaseBtn.addEventListener('click', function() { goCasesGenAndScroll(''); });
    }

    return {};
  }

  window.app = window.app || {};
  window.app.casegenHandlers = { init: init };
})();
