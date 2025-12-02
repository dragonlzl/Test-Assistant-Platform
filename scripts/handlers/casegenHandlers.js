(function() {
  function init(ctx) {
    if (!ctx) return {};
    var handlers = ctx.handlers || {};
    var dom = ctx.dom || {};
    var caseGenProgressList = dom.caseGenProgressList;
    var caseGenProgressPanel = dom.caseGenProgressPanel;
    var toSplitFromCaseGenBtn = dom.toSplitFromCaseGenBtn;
    var autoMissingGoUsecaseBtn = dom.autoMissingGoUsecaseBtn;
    var goCasesGenAndScroll = handlers.goCasesGenAndScroll;
    var scrollToSection = handlers.scrollToSection;

    if (caseGenProgressList && typeof goCasesGenAndScroll === 'function') {
      caseGenProgressList.addEventListener('click', function(e) {
        var item = e.target && e.target.closest ? e.target.closest('[data-casegen-module]') : null;
        var moduleId = item && item.dataset ? item.dataset.casegenModule : '';
        goCasesGenAndScroll(moduleId || '');
      });
    }

    if (caseGenProgressPanel && typeof goCasesGenAndScroll === 'function') {
      caseGenProgressPanel.addEventListener('click', function(e) {
        var item = e.target && e.target.closest ? e.target.closest('[data-casegen-module]') : null;
        if (item) return;
        goCasesGenAndScroll('');
      });
    }

    if (toSplitFromCaseGenBtn && typeof scrollToSection === 'function') {
      toSplitFromCaseGenBtn.addEventListener('click', function() { scrollToSection('split'); });
    }
    if (autoMissingGoUsecaseBtn && typeof goCasesGenAndScroll === 'function') {
      autoMissingGoUsecaseBtn.addEventListener('click', function() { goCasesGenAndScroll(''); });
    }

    return {};
  }

  window.app = window.app || {};
  window.app.casegenHandlers = { init: init };
})();
