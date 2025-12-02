(function() {
  function init(ctx) {
    if (!ctx) return {};
    var dom = ctx.dom || {};
    var updateFlowStatus = ctx.updateFlowStatus || function() {};
    var scrollToSection = ctx.scrollToSection || function() {};

    var flowNavSteps = dom.flowNavSteps || document.querySelectorAll('#flowNav .step');
    var scrollTopBtn = dom.scrollTopBtn;
    var scrollBottomBtn = dom.scrollBottomBtn;

    document.querySelectorAll('section.card').forEach(function(card) {
      var header = card.querySelector('h2');
      var body = card.querySelector('.card-body');
      if (!header || !body) return;
      header.addEventListener('click', function() {
        card.classList.toggle('collapsed');
        updateFlowStatus();
      });
    });

    if (flowNavSteps && typeof flowNavSteps.forEach === 'function') {
      flowNavSteps.forEach(function(step) {
        step.addEventListener('click', function() {
          if (step.dataset && step.dataset.target) {
            scrollToSection(step.dataset.target);
          }
        });
      });
    }

    if (scrollTopBtn) {
      scrollTopBtn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
    if (scrollBottomBtn) {
      scrollBottomBtn.addEventListener('click', function() {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      });
    }

    return {};
  }

  window.app = window.app || {};
  window.app.layoutHandlers = { init: init };
})();
