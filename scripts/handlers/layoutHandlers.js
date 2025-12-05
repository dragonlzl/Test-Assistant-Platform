(function() {
  function init(ctx) {
    if (!ctx) return {};
    var dom = ctx.dom || {};
    var handlers = ctx.handlers || {};
    var updateFlowStatus = ctx.updateFlowStatus || function() {};
    var scrollToSection = ctx.scrollToSection || function() {};
    var switchTab = ctx.switchTab || function() {};
    var toggleSplitView = handlers.toggleSplitView || function() {};
    var toggleImportedCaseView = handlers.toggleImportedCaseView || function() {};
    var scrollElementIntoView = handlers.scrollElementIntoView || function() {};
    var collapseStorageKey = 'usecase-card-collapse-v1';

    function loadCollapseState() {
      try {
        var saved = JSON.parse(localStorage.getItem(collapseStorageKey) || '{}');
        if (saved && typeof saved === 'object') return saved;
      } catch (err) {
        console.warn('卡片折叠状态解析失败', err);
      }
      return {};
    }

    var collapseState = loadCollapseState();

    function persistCollapseState() {
      try {
        localStorage.setItem(collapseStorageKey, JSON.stringify(collapseState));
      } catch (err) {
        console.warn('卡片折叠状态保存失败', err);
      }
    }

    function getCardKey(card) {
      if (!card) return '';
      if (card.dataset && card.dataset.sectionId) return card.dataset.sectionId;
      if (card.id) return card.id;
      return '';
    }

    function setCardCollapsed(card, collapsed) {
      var key = getCardKey(card);
      if (!key) return;
      if (collapsed) card.classList.add('collapsed');
      else card.classList.remove('collapsed');
      collapseState[key] = Boolean(collapsed);
      persistCollapseState();
    }

    function applySavedCollapse(card) {
      var key = getCardKey(card);
      if (!key) return;
      var saved = collapseState[key];
      if (saved === true) card.classList.add('collapsed');
      else if (saved === false) card.classList.remove('collapsed');
    }

    function setCollapsedBySectionId(sectionId, collapsed) {
      if (!sectionId) return;
      var target = document.querySelector('[data-section-id="' + sectionId + '"]');
      if (!target) return;
      setCardCollapsed(target, collapsed);
    }

    window.app = window.app || {};
    window.app.cardCollapseStore = {
      setCardCollapsed: setCardCollapsed,
      setBySectionId: setCollapsedBySectionId,
      applySavedCollapse: applySavedCollapse,
      getState: function() { return Object.assign({}, collapseState); },
    };

    var flowNavSteps = dom.flowNavSteps || document.querySelectorAll('#flowNav .step');
    var scrollTopBtn = dom.scrollTopBtn;
    var scrollBottomBtn = dom.scrollBottomBtn;
    var tabButtons = dom.tabButtons || [];
    var jumpLinks = dom.jumpLinks || document.querySelectorAll('[data-jump]');
    var toggleSplitViewBtn = dom.toggleSplitViewBtn;
    var caseViewBtn = dom.caseViewBtn;
    var xmindStructureToggle = dom.xmindStructureToggle;
    var xmindStructureCard = dom.xmindStructureCard;

    document.querySelectorAll('section.card').forEach(function(card) {
      var header = card.querySelector('h2');
      var body = card.querySelector('.card-body');
      if (!header || !body) return;
      applySavedCollapse(card);
      header.addEventListener('click', function() {
        var willCollapse = !card.classList.contains('collapsed');
        setCardCollapsed(card, willCollapse);
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

    return {};
  }

  window.app = window.app || {};
  window.app.layoutHandlers = { init: init };
})();
