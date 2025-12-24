(function() {
  function init(ctx) {
    if (!ctx) return {};
    var dom = ctx.dom || {};
    var handlers = ctx.handlers || {};
    var scrollToSection = ctx.scrollToSection || function() {};
    var switchTab = ctx.switchTab || function() {};
    var toggleSplitView = handlers.toggleSplitView || function() {};
    var toggleImportedCaseView = handlers.toggleImportedCaseView || function() {};
    var scrollElementIntoView = handlers.scrollElementIntoView || function() {};

    var flowNavSteps = dom.flowNavSteps || document.querySelectorAll('#flowNav .step');
    var scrollTopBtn = dom.scrollTopBtn;
    var scrollBottomBtn = dom.scrollBottomBtn;
    var tabButtons = dom.tabButtons || [];
    var jumpLinks = dom.jumpLinks || document.querySelectorAll('[data-jump]');
    var toggleSplitViewBtn = dom.toggleSplitViewBtn;
    var caseViewBtn = dom.caseViewBtn;
    var xmindStructureToggle = dom.xmindStructureToggle;
    var xmindStructureCard = dom.xmindStructureCard;
    var tempexecFlowNav = dom.tempexecFlowNav || document.getElementById('tempexecFlowNav');
    var rootEl = document.documentElement;
    var tempexecNavTimer;

    function setCssVar(name, value) {
      if (!name || !rootEl || !rootEl.style) return;
      rootEl.style.setProperty(name, value);
    }

    function syncTempexecNavHeight() {
      var nav = tempexecFlowNav || document.getElementById('tempexecFlowNav');
      if (!nav || nav.classList.contains('hidden')) return;
      var rect = nav.getBoundingClientRect();
      var height = Math.round((rect && rect.height) || nav.offsetHeight || 0);
      if (height > 0) setCssVar('--tempexec-nav-height', height + 'px');
    }

    function scheduleSyncTempexecNavHeight() {
      if (tempexecNavTimer) clearTimeout(tempexecNavTimer);
      tempexecNavTimer = setTimeout(syncTempexecNavHeight, 120);
    }
    if (tempexecFlowNav && typeof MutationObserver !== 'undefined') {
      var tempexecObserver = new MutationObserver(function(mutations) {
        var needSync = false;
        mutations.forEach(function(mutation) {
          if (mutation && mutation.type === 'attributes' && mutation.attributeName === 'class') {
            needSync = true;
          }
        });
        if (needSync && !tempexecFlowNav.classList.contains('hidden')) {
          scheduleSyncTempexecNavHeight();
        }
      });
      tempexecObserver.observe(tempexecFlowNav, { attributes: true });
    }

    document.querySelectorAll('section.card').forEach(function(card) {
      if (card.classList.contains('collapsed')) card.classList.remove('collapsed');
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

    if (toggleSplitViewBtn) {
      toggleSplitViewBtn.addEventListener('click', toggleSplitView);
    }

    if (caseViewBtn) {
      caseViewBtn.addEventListener('click', toggleImportedCaseView);
    }

    if (tabButtons && typeof tabButtons.forEach === 'function') {
      tabButtons.forEach(function(btn) {
        btn.addEventListener('click', function() {
          if (btn.dataset && btn.dataset.tabBtn) switchTab(btn.dataset.tabBtn);
          if (btn.dataset && btn.dataset.tabBtn === 'tempexec') scheduleSyncTempexecNavHeight();
        });
      });
    }

    if (jumpLinks && typeof jumpLinks.forEach === 'function') {
      jumpLinks.forEach(function(link) {
        link.addEventListener('click', function(e) {
          if (link.dataset && link.dataset.jump) {
            e.preventDefault();
            switchTab(link.dataset.jump);
            var section = document.querySelector('[data-tab-section="' + link.dataset.jump + '"]');
            if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });
    }

    if (xmindStructureToggle && xmindStructureCard) {
      var labelEl = xmindStructureToggle.querySelector('span:last-child');
      var drawer = window.app && window.app.drawer && typeof window.app.drawer.createDrawer === 'function'
        ? window.app.drawer.createDrawer({
            drawerId: 'xmindStructureDrawer',
            openButtons: ['xmindStructureToggle'],
            closeButtons: ['closeXmindStructureDrawerBtn'],
            onOpen: function() {
              xmindStructureToggle.classList.add('active');
              if (labelEl) labelEl.textContent = '收起 XMind 用例结构';
            },
            onClose: function() {
              xmindStructureToggle.classList.remove('active');
              if (labelEl) labelEl.textContent = 'XMind 用例结构';
            },
          })
        : null;
      if (!drawer) {
        var collapseCard = function() {
          xmindStructureCard.classList.add('collapsed-card');
          xmindStructureToggle.classList.remove('active');
          if (labelEl) labelEl.textContent = 'XMind 用例结构';
        };
        var expandCard = function() {
          xmindStructureCard.classList.remove('collapsed-card');
          xmindStructureToggle.classList.add('active');
          if (labelEl) labelEl.textContent = '收起 XMind 用例结构';
          requestAnimationFrame(function() {
            var target = xmindStructureCard;
            var rect = target.getBoundingClientRect();
            var offset = Math.max(120, (window.innerHeight / 2) - (rect.height / 2));
            scrollElementIntoView(target, 'smooth', offset);
          });
        };
        collapseCard();
        xmindStructureToggle.addEventListener('click', function() {
          var collapsed = xmindStructureCard.classList.contains('collapsed-card');
          if (collapsed) expandCard();
          else collapseCard();
        });
      } else {
        if (labelEl) labelEl.textContent = 'XMind 用例结构';
        xmindStructureToggle.classList.remove('active');
      }
    }

    scheduleSyncTempexecNavHeight();
    window.addEventListener('resize', scheduleSyncTempexecNavHeight);

    return {};
  }

  window.app = window.app || {};
  window.app.layoutHandlers = { init: init };
})();
