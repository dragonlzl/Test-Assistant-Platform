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
    var topNavStorageKey = 'usecase-top-nav-collapse-v1';
    var topNavState = {};
    var topNavList = [];
    var smartScrollDown = 0;
    var smartScrollUp = 0;
    var smartScrollThreshold = 60;
    var lastGuideActive = false;
    var state = ctx.state || {};

    function setCssVar(name, value) {
      if (!name || !rootEl || !rootEl.style) return;
      rootEl.style.setProperty(name, value);
    }

    function loadTopNavState() {
      var stored = {};
      try {
        stored = JSON.parse(localStorage.getItem(topNavStorageKey) || '{}') || {};
      } catch (err) {
        stored = {};
      }
      topNavState = stored && typeof stored === 'object' ? stored : {};
    }

    function saveTopNavState() {
      try {
        localStorage.setItem(topNavStorageKey, JSON.stringify(topNavState || {}));
      } catch (err) {
        // ignore save errors
      }
    }

    function getTopNavKey(nav) {
      if (!nav || !nav.dataset) return '';
      return nav.dataset.topNav || '';
    }

    function isNavCollapsed(nav) {
      if (!nav || !nav.classList) return false;
      return nav.classList.contains('is-collapsed');
    }

    function updateTopNavToggle(nav, collapsed) {
      if (!nav) return;
      var btn = nav.querySelector('[data-flow-toggle]');
      if (!btn) return;
      btn.textContent = collapsed ? '展开' : '收起';
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }

    function applyTopNavState(nav, collapsed, options) {
      if (!nav || !nav.classList) return;
      nav.classList.toggle('is-collapsed', collapsed);
      updateTopNavToggle(nav, collapsed);
      var key = getTopNavKey(nav);
      if (options && options.persist && key) {
        topNavState[key] = collapsed === true;
        saveTopNavState();
      }
      if (key === 'tempexec') {
        scheduleSyncTempexecNavHeight();
        try {
          window.dispatchEvent(new Event('resize'));
        } catch (err) {
          // ignore resize dispatch failures
        }
      }
    }

    function isTopNavVisible(nav) {
      if (!nav || !nav.classList) return false;
      if (nav.classList.contains('hidden')) return false;
      var head = nav.closest ? nav.closest('.tempexec-head') : null;
      if (head && head.classList && head.classList.contains('hidden')) return false;
      return true;
    }

    function getActiveTopNav() {
      for (var i = 0; i < topNavList.length; i += 1) {
        var nav = topNavList[i];
        if (isTopNavVisible(nav)) return nav;
      }
      return null;
    }

    function resetSmartScroll() {
      smartScrollDown = 0;
      smartScrollUp = 0;
    }

    function getScrollTop() {
      if (typeof window === 'undefined') return 0;
      if (typeof window.pageYOffset === 'number') return window.pageYOffset;
      if (document.documentElement && typeof document.documentElement.scrollTop === 'number') {
        return document.documentElement.scrollTop;
      }
      if (document.body && typeof document.body.scrollTop === 'number') return document.body.scrollTop;
      return 0;
    }

    function isSmartTopNavEnabled() {
      return state && state.settings && state.settings.smartTopNavCollapse === true;
    }

    function isSmartTopNavExcluded(nav) {
      if (!nav || !nav.dataset) return false;
      return nav.dataset.topNav === 'exec-overview';
    }

    function handleSmartTopNavWheel(e) {
      if (!e) return;
      if (!isSmartTopNavEnabled()) return;
      var body = document.body;
      if (body && body.classList) {
        if (body.classList.contains('guide-active')) return;
        if (body.classList.contains('drawer-open')) return;
      }
      if (e.ctrlKey) return;
      var delta = Number(e.deltaY);
      if (!Number.isFinite(delta) || delta === 0) return;
      var nav = getActiveTopNav();
      if (!nav) return;
      if (isSmartTopNavExcluded(nav)) return;
      if (delta > 0) {
        smartScrollUp = 0;
        if (!isNavCollapsed(nav)) {
          smartScrollDown += delta;
          if (smartScrollDown >= smartScrollThreshold) {
            applyTopNavState(nav, true, { persist: true });
            resetSmartScroll();
          }
        }
        return;
      }
      smartScrollDown = 0;
      if (!isNavCollapsed(nav)) return;
      var top = getScrollTop();
      if (!Number.isFinite(top)) top = 0;
      var upDelta = Math.abs(delta);
      var nearTop = top <= 1;
      var reachTop = top <= upDelta + 4;
      if (!nearTop && !reachTop) {
        smartScrollUp = 0;
        return;
      }
      smartScrollUp += upDelta;
      if (smartScrollUp >= smartScrollThreshold) {
        applyTopNavState(nav, false, { persist: true });
        resetSmartScroll();
      }
    }

    function expandTopNavForGuide() {
      topNavList.forEach(function(nav) {
        if (!nav || !nav.classList) return;
        if (nav.classList.contains('is-collapsed')) {
          applyTopNavState(nav, false, { persist: true });
        }
      });
    }

    function checkGuideActive() {
      var body = document.body;
      var active = Boolean(body && body.classList && body.classList.contains('guide-active'));
      if (active && !lastGuideActive) {
        lastGuideActive = true;
        expandTopNavForGuide();
        setTimeout(expandTopNavForGuide, 120);
      } else if (!active && lastGuideActive) {
        lastGuideActive = false;
      }
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

    loadTopNavState();
    topNavList = Array.prototype.slice.call(document.querySelectorAll('.flow[data-top-nav]') || []);
    topNavList.forEach(function(nav) {
      var key = getTopNavKey(nav);
      var collapsed = key && topNavState && topNavState[key] === true;
      applyTopNavState(nav, collapsed, { persist: false });
      var toggle = nav.querySelector('[data-flow-toggle]');
      if (toggle) {
        toggle.addEventListener('click', function() {
          var next = !isNavCollapsed(nav);
          applyTopNavState(nav, next, { persist: true });
          resetSmartScroll();
        });
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('wheel', handleSmartTopNavWheel);
    }
    if (document.body && typeof MutationObserver !== 'undefined') {
      var guideObserver = new MutationObserver(function(mutations) {
        var changed = false;
        mutations.forEach(function(mutation) {
          if (mutation && mutation.type === 'attributes' && mutation.attributeName === 'class') {
            changed = true;
          }
        });
        if (changed) checkGuideActive();
      });
      guideObserver.observe(document.body, { attributes: true });
      checkGuideActive();
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
          resetSmartScroll();
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
