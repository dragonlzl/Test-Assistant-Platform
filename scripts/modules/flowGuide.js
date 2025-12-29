(function() {
  function init(ctx) {
    ctx = ctx || {};
    var utils = ctx.utils || {};
    var switchTab = ctx.switchTab || (window.app && window.app.switchTab);
    var setStatus = ctx.setStatus || function() {};
    var scrollElementIntoView = utils.scrollElementIntoView || function() {};

    var guideKey = 'tap-flow-guide-state-v1';
    var guideTriggerBtn = document.getElementById('flowGuideTrigger');
    var drawerEl = document.getElementById('flowGuideDrawer');
    var drawerBody = document.getElementById('flowGuideDrawerBody');
    var drawerTitle = document.getElementById('flowGuideDrawerTitle');
    var closeDrawerBtn = document.getElementById('closeFlowGuideDrawerBtn');
    var guideDrawer = null;

    var activeGuideId = '';
    var activeStepIndex = 0;
    var activeSessionId = '';
    var activeFlow = null;
    var activeStep = null;
    var activeTarget = null;
    var allowedTarget = null;
    var renderToken = 0;
    var stepClickHandler = null;
    var stepDragHandler = null;
    var stepHoverHandler = null;
    var historyBound = false;
    var guardBound = false;
    var scrollGuardHandler = null;
    var clickGuardHandler = null;
    var keyGuardHandler = null;
    var sidebarGuardHandler = null;
    var guardOptions = null;
    var guideClickBypass = false;
    var drawerApiCache = {};
    var stepClickCapture = false;

    var overlay = null;
    var focusEl = null;
    var tooltipEl = null;
    var tooltipTextEl = null;
    var tooltipActionsEl = null;
    var tooltipIconEl = null;

    var fakeAssignPanel = null;
    var fakeMissingPanel = null;
    var fakeExecVersionPanel = null;
    var fakeArchiveBtn = null;

    function buildSessionId() {
      return String(Date.now()) + '_' + Math.random().toString(36).slice(2, 8);
    }

    function detectPassiveOptions() {
      var supportsPassive = false;
      try {
        var opts = Object.defineProperty({}, 'passive', {
          get: function() {
            supportsPassive = true;
          },
        });
        window.addEventListener('tap-passive-check', null, opts);
        window.removeEventListener('tap-passive-check', null, opts);
      } catch (err) {
        supportsPassive = false;
      }
      guardOptions = supportsPassive ? { passive: false, capture: true } : true;
    }

    function runWithClickBypass(fn) {
      guideClickBypass = true;
      try {
        if (typeof fn === 'function') fn();
      } finally {
        guideClickBypass = false;
      }
    }

    function getDrawerApi(drawerId) {
      if (!drawerId) return null;
      if (drawerApiCache[drawerId]) return drawerApiCache[drawerId];
      if (window.app && window.app.drawer && typeof window.app.drawer.createDrawer === 'function') {
        drawerApiCache[drawerId] = window.app.drawer.createDrawer({ drawerId: drawerId });
      }
      return drawerApiCache[drawerId] || null;
    }

    function isGuideInteractiveTarget(target) {
      if (!target || !target.closest) return false;
      if (target.closest('#flowGuideTooltip')) return true;
      if (target.closest('#flowGuideFocus')) return true;
      if (target.closest('.guide-allow')) return true;
      return false;
    }

    function bindGuideGuards() {
      if (guardBound) return;
      guardBound = true;
      if (!guardOptions) detectPassiveOptions();
      scrollGuardHandler = function(e) {
        if (!document.body.classList.contains('guide-active')) return;
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (e && typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      };
      clickGuardHandler = function(e) {
        if (!document.body.classList.contains('guide-active')) return;
        if (guideClickBypass) return;
        if (isGuideInteractiveTarget(e && e.target)) return;
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (e && typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      };
      keyGuardHandler = function(e) {
        if (!document.body.classList.contains('guide-active')) return;
        var key = e && e.key ? String(e.key) : '';
        var code = e && e.code ? String(e.code) : '';
        var scrollKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'];
        if (scrollKeys.indexOf(key) < 0 && scrollKeys.indexOf(code) < 0) return;
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (e && typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      };
      sidebarGuardHandler = function(e) {
        if (!document.body.classList.contains('guide-active')) return;
        if (!activeStep || !activeStep.lockMenu) return;
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (e && typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      };
      window.addEventListener('wheel', scrollGuardHandler, guardOptions);
      document.addEventListener('touchmove', scrollGuardHandler, guardOptions);
      document.addEventListener('mousedown', clickGuardHandler, true);
      document.addEventListener('click', clickGuardHandler, true);
      document.addEventListener('keydown', keyGuardHandler, true);
      var sidebar = document.querySelector('.sidebar');
      if (sidebar) sidebar.addEventListener('mouseleave', sidebarGuardHandler, true);
    }

    function unbindGuideGuards() {
      if (!guardBound) return;
      guardBound = false;
      window.removeEventListener('wheel', scrollGuardHandler, guardOptions);
      document.removeEventListener('touchmove', scrollGuardHandler, guardOptions);
      document.removeEventListener('mousedown', clickGuardHandler, true);
      document.removeEventListener('click', clickGuardHandler, true);
      document.removeEventListener('keydown', keyGuardHandler, true);
      var sidebar = document.querySelector('.sidebar');
      if (sidebar) sidebar.removeEventListener('mouseleave', sidebarGuardHandler, true);
      scrollGuardHandler = null;
      clickGuardHandler = null;
      keyGuardHandler = null;
      sidebarGuardHandler = null;
    }

    function loadGuideState() {
      if (typeof localStorage === 'undefined') return null;
      try {
        var raw = localStorage.getItem(guideKey);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || !parsed.id) return null;
        return parsed;
      } catch (err) {
        return null;
      }
    }

    function saveGuideState() {
      if (typeof localStorage === 'undefined') return;
      if (!activeGuideId) return;
      var payload = {
        id: activeGuideId,
        step: activeStepIndex,
        active: true,
        session: activeSessionId,
        updatedAt: Date.now(),
      };
      try {
        localStorage.setItem(guideKey, JSON.stringify(payload));
      } catch (err) {
        // ignore
      }
    }

    function clearGuideState() {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.removeItem(guideKey);
      } catch (err) {
        // ignore
      }
    }

    function getActiveTab() {
      var state = window.app && window.app.state ? window.app.state : null;
      if (state && state.activeTab) return String(state.activeTab);
      var btn = document.querySelector('[data-tab-btn].active');
      return btn && btn.dataset ? String(btn.dataset.tabBtn || '') : '';
    }

    function showTabGroup(name, opts) {
      if (window.app && typeof window.app.showTabGroup === 'function') {
        window.app.showTabGroup(name, opts);
        return;
      }
      var menus = Array.prototype.slice.call(document.querySelectorAll('.tab-submenu'));
      menus.forEach(function(menu) {
        if (!menu) return;
        menu.classList.add('hidden');
        menu.style.display = 'none';
        var group = menu.closest('.tab-group');
        if (group) group.classList.remove('open');
      });
      if (!name) return;
      var target = document.querySelector('[data-group-menu="' + name + '"]');
      var targetGroup = target && target.closest ? target.closest('.tab-group') : null;
      if (target) {
        target.classList.remove('hidden');
        target.style.display = 'flex';
      }
      if (targetGroup) targetGroup.classList.add('open');
    }

    function ensureOverlay() {
      if (overlay) return;
      overlay = document.createElement('div');
      overlay.id = 'flowGuideOverlay';
      overlay.className = 'guide-overlay hidden';
      document.body.appendChild(overlay);

      focusEl = document.createElement('div');
      focusEl.id = 'flowGuideFocus';
      focusEl.className = 'guide-focus hidden';
      focusEl.setAttribute('role', 'button');
      focusEl.setAttribute('aria-label', '引导聚焦区域');
      document.body.appendChild(focusEl);

      tooltipEl = document.createElement('div');
      tooltipEl.id = 'flowGuideTooltip';
      tooltipEl.className = 'guide-tooltip hidden';
      tooltipEl.innerHTML =
        '<div class="guide-tooltip-actions" id="flowGuideTooltipActions"></div>' +
        '<div class="guide-tooltip-body">' +
          '<div class="guide-tooltip-text" id="flowGuideTooltipText"></div>' +
          '<div class="guide-tooltip-icon" id="flowGuideTooltipIcon"></div>' +
        '</div>';
      document.body.appendChild(tooltipEl);

      tooltipTextEl = document.getElementById('flowGuideTooltipText');
      tooltipActionsEl = document.getElementById('flowGuideTooltipActions');
      tooltipIconEl = document.getElementById('flowGuideTooltipIcon');
      if (focusEl) {
        focusEl.addEventListener('click', function(e) {
          if (!activeStep || !activeStep.proxy) return;
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          handleStepAction('proxy');
        });
      }
    }

    function ensureFakeAssignPanel() {
      if (fakeAssignPanel) return fakeAssignPanel;
      fakeAssignPanel = document.getElementById('guideFakeAssignPanel');
      if (fakeAssignPanel) return fakeAssignPanel;
      fakeAssignPanel = document.createElement('div');
      fakeAssignPanel.id = 'guideFakeAssignPanel';
      fakeAssignPanel.className = 'guide-fake-panel hidden';
      fakeAssignPanel.innerHTML =
        '<div class="guide-fake-header">' +
          '<div class="guide-fake-title">执行分配（引导演示）</div>' +
          '<span class="guide-fake-sub">示例数据仅用于教学，不会写入实际数据</span>' +
        '</div>' +
        '<div class="guide-fake-body">' +
          '<div class="temp-version-grid guide-version-grid">' +
            '<div class="temp-version-card guide-version-card" id="guideAssignVersionBox1" draggable="true">' +
              '<div class="header"><span class="title">1.0.0</span></div>' +
              '<div class="temp-req-list">' +
                '<div class="temp-req-row" draggable="true"><div class="temp-req-item"><div class="name">用例例子1</div></div></div>' +
                '<div class="temp-req-row" draggable="true"><div class="temp-req-item"><div class="name">用例例子2</div></div></div>' +
              '</div>' +
            '</div>' +
            '<div class="temp-version-card guide-version-card" id="guideAssignVersionBox2" draggable="true">' +
              '<div class="header"><span class="title">2.0.0</span></div>' +
              '<div class="temp-req-list">' +
                '<div class="temp-req-row" draggable="true"><div class="temp-req-item"><div class="name">用例例子3</div></div></div>' +
                '<div class="temp-req-row" draggable="true"><div class="temp-req-item"><div class="name">用例例子4</div></div></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="temp-focus-block guide-focus-block" id="guideAssignFocusBlock">' +
            '<div class="temp-case-group-label">专注区</div>' +
            '<div class="temp-focus-zone" id="guideAssignFocusZone">' +
              '<span class="hint">拖拽用例到此区域</span>' +
            '</div>' +
            '<p class="hint">可从版本盒子中拖拽用例到专注区</p>' +
          '</div>' +
        '</div>';
      document.body.appendChild(fakeAssignPanel);
      return fakeAssignPanel;
    }

    function ensureFakeMissingPanel() {
      if (fakeMissingPanel) return fakeMissingPanel;
      fakeMissingPanel = document.getElementById('guideFakeMissingPanel');
      if (fakeMissingPanel) return fakeMissingPanel;
      fakeMissingPanel = document.createElement('div');
      fakeMissingPanel.id = 'guideFakeMissingPanel';
      fakeMissingPanel.className = 'guide-fake-panel hidden';
      fakeMissingPanel.innerHTML =
        '<div class="guide-fake-header">' +
          '<div class="guide-fake-title">缺失测试点视图（引导演示）</div>' +
          '<span class="guide-fake-sub">示例数据仅用于演示</span>' +
        '</div>' +
        '<div class="guide-fake-body">' +
          '<div class="guide-missing-list">' +
            '<div class="guide-missing-item">模块：登录安全 - 缺失测试点：多因子验证</div>' +
            '<div class="guide-missing-item">模块：消息通知 - 缺失测试点：推送失败重试</div>' +
            '<div class="guide-missing-item">模块：权限管理 - 缺失测试点：角色变更同步</div>' +
          '</div>' +
          '<div class="guide-missing-actions">' +
            '<button class="pill primary" id="guideMissingSmartFillBtn" type="button">智能填充</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(fakeMissingPanel);
      return fakeMissingPanel;
    }

    function ensureFakeExecVersionPanel() {
      if (fakeExecVersionPanel) return fakeExecVersionPanel;
      fakeExecVersionPanel = document.getElementById('guideFakeExecVersionPanel');
      if (fakeExecVersionPanel) return fakeExecVersionPanel;
      fakeExecVersionPanel = document.createElement('div');
      fakeExecVersionPanel.id = 'guideFakeExecVersionPanel';
      fakeExecVersionPanel.className = 'guide-fake-drawer hidden';
      fakeExecVersionPanel.innerHTML =
        '<div class="guide-fake-drawer-inner">' +
          '<div class="guide-fake-drawer-header">选择执行版本（引导演示）</div>' +
          '<div class="guide-fake-drawer-body">' +
            '<label class="guide-fake-label" for="guideExecVersionSelect">执行版本</label>' +
            '<select id="guideExecVersionSelect" class="guide-fake-select">' +
              '<option value="">请选择版本</option>' +
              '<option value="1.0.0">1.0.0</option>' +
              '<option value="1.1.0">1.1.0</option>' +
            '</select>' +
            '<p class="hint" style="margin:8px 0 0;">此处为引导示例，不会实际提交</p>' +
            '<div class="guide-fake-actions">' +
              '<button class="pill primary" id="guideExecVersionConfirm" type="button">确认并继续</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(fakeExecVersionPanel);
      return fakeExecVersionPanel;
    }

    function ensureFakeArchiveButton() {
      if (fakeArchiveBtn) return fakeArchiveBtn;
      fakeArchiveBtn = document.getElementById('guideArchiveBtn');
      if (fakeArchiveBtn) return fakeArchiveBtn;
      fakeArchiveBtn = document.createElement('button');
      fakeArchiveBtn.id = 'guideArchiveBtn';
      fakeArchiveBtn.type = 'button';
      fakeArchiveBtn.className = 'pill accent guide-archive-btn hidden';
      fakeArchiveBtn.textContent = '归档';
      document.body.appendChild(fakeArchiveBtn);
      return fakeArchiveBtn;
    }

    function showFakePanel(panel) {
      if (!panel || !panel.classList) return;
      panel.classList.remove('hidden');
      panel.classList.add('active');
    }

    function hideFakePanel(panel) {
      if (!panel || !panel.classList) return;
      panel.classList.add('hidden');
      panel.classList.remove('active');
    }

    function hideAllFakePanels() {
      hideFakePanel(fakeAssignPanel);
      hideFakePanel(fakeMissingPanel);
      hideFakePanel(fakeExecVersionPanel);
      if (fakeArchiveBtn && fakeArchiveBtn.classList) fakeArchiveBtn.classList.add('hidden');
    }

    function resolveTarget(step) {
      if (!step) return null;
      if (typeof step.target === 'function') return step.target();
      if (!step.target) return null;
      return document.querySelector(step.target);
    }

    function isTargetVisible(el) {
      if (!el || typeof el.getBoundingClientRect !== 'function') return false;
      var rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      if (typeof window === 'undefined') return true;
      var vw = window.innerWidth || 0;
      var vh = window.innerHeight || 0;
      if (rect.right < 0 || rect.bottom < 0) return false;
      if (rect.left > vw || rect.top > vh) return false;
      return true;
    }

    function clearStepListeners() {
      if (activeTarget && stepClickHandler) {
        activeTarget.removeEventListener('click', stepClickHandler, stepClickCapture);
        if (stepClickCapture) activeTarget.removeEventListener('mousedown', stepClickHandler, true);
      }
      if (activeTarget && stepHoverHandler) {
        activeTarget.removeEventListener('mouseenter', stepHoverHandler);
      }
      if (stepDragHandler) {
        var dragTargets = stepDragHandler.targets || [];
        dragTargets.forEach(function(el) {
          if (el && el.removeEventListener) {
            el.removeEventListener('dragstart', stepDragHandler.handler, true);
          }
        });
      }
      stepClickHandler = null;
      stepClickCapture = false;
      stepHoverHandler = null;
      stepDragHandler = null;
    }

    function resetTargetAllow() {
      if (allowedTarget && allowedTarget.classList) allowedTarget.classList.remove('guide-allow');
      allowedTarget = null;
    }

    function bindStepEvents(step, target) {
      clearStepListeners();
      if (!step || !target) return;
      if (step.interaction === 'drag') {
        var dragTargets = [];
        if (step.dragTargets && step.dragTargets.length) {
          step.dragTargets.forEach(function(sel) {
            if (!sel) return;
            var el = document.querySelector(sel);
            if (el) dragTargets.push(el);
            var list = document.querySelectorAll(sel);
            if (list && list.length > 1) {
              Array.prototype.forEach.call(list, function(item) { dragTargets.push(item); });
            }
          });
        } else {
          dragTargets = [target];
        }
        var handler = function() {
          completeStep();
        };
        dragTargets.forEach(function(el) {
          if (el && el.addEventListener) {
            el.addEventListener('dragstart', handler, true);
          }
        });
        stepDragHandler = { handler: handler, targets: dragTargets };
        return;
      }
      if (step.proxy) {
        var handled = false;
        stepClickHandler = function(e) {
          if (handled) return;
          handled = true;
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          handleStepAction('proxy-target');
        };
        stepClickCapture = true;
        target.addEventListener('mousedown', stepClickHandler, true);
        target.addEventListener('click', stepClickHandler, true);
        return;
      }
      stepClickHandler = function() {
        handleStepAction('direct');
      };
      target.addEventListener('click', stepClickHandler);
      if (step.interaction === 'hover') {
        stepHoverHandler = function() {
          handleStepAction('hover');
        };
        target.addEventListener('mouseenter', stepHoverHandler);
      }
    }

    function applyTargetAllow(step, target) {
      resetTargetAllow();
      if (!step || !target || !target.classList) return;
      if (step.allowTarget || step.proxy) {
        target.classList.add('guide-allow');
        allowedTarget = target;
      }
      activeTarget = target;
    }

    function updateFocusPosition(step, target) {
      if (!focusEl || !tooltipEl || !target) return;
      var rect = target.getBoundingClientRect();
      var pad = step && Number.isFinite(Number(step.padding)) ? Number(step.padding) : 8;
      var left = Math.max(0, rect.left - pad);
      var top = Math.max(0, rect.top - pad);
      var width = Math.max(0, rect.width + pad * 2);
      var height = Math.max(0, rect.height + pad * 2);

      focusEl.style.left = left + 'px';
      focusEl.style.top = top + 'px';
      focusEl.style.width = width + 'px';
      focusEl.style.height = height + 'px';
      focusEl.style.borderRadius = (step && step.radius) ? step.radius + 'px' : '12px';
      focusEl.style.setProperty('--guide-dim', step && step.dimOpacity ? 'rgba(15,23,42,' + step.dimOpacity + ')' : 'rgba(15,23,42,0.72)');
      focusEl.classList.toggle('guide-proxy', Boolean(step && step.proxy));

      if (tooltipEl) {
        var tipMaxWidth = 360;
        tooltipEl.style.maxWidth = tipMaxWidth + 'px';
        var tipRect = tooltipEl.getBoundingClientRect();
        var tipLeft = rect.left;
        var tipTop = rect.bottom + 12;
        var maxLeft = window.innerWidth - tipRect.width - 16;
        if (tipLeft > maxLeft) tipLeft = maxLeft;
        if (tipLeft < 16) tipLeft = 16;
        tooltipEl.style.left = tipLeft + 'px';
        tooltipEl.style.top = tipTop + 'px';
      }
    }

    function bindOverlayPosition() {
      if (historyBound) return;
      historyBound = true;
      window.addEventListener('resize', function() {
        if (activeStep && activeTarget) updateFocusPosition(activeStep, activeTarget);
      });
      window.addEventListener('scroll', function() {
        if (activeStep && activeTarget) updateFocusPosition(activeStep, activeTarget);
      }, true);
      window.addEventListener('popstate', function(e) {
        if (!activeGuideId || !activeSessionId) return;
        var state = e && e.state ? e.state : null;
        if (!state || state.guideSession !== activeSessionId || state.guideId !== activeGuideId) return;
        var step = Number(state.guideStep);
        if (!Number.isFinite(step)) return;
        goToStep(step, { fromHistory: true });
      });
    }

    function replaceHistoryState(stepIndex) {
      if (typeof window === 'undefined' || !window.history || typeof window.history.replaceState !== 'function') return;
      var prev = window.history.state || {};
      var next = Object.assign({}, prev, {
        guideSession: activeSessionId,
        guideId: activeGuideId,
        guideStep: stepIndex,
      });
      try {
        window.history.replaceState(next, '', window.location.href);
      } catch (err) {
        // ignore
      }
    }

    function pushHistoryState(stepIndex) {
      if (typeof window === 'undefined' || !window.history || typeof window.history.pushState !== 'function') return;
      var prev = window.history.state || {};
      var next = Object.assign({}, prev, {
        guideSession: activeSessionId,
        guideId: activeGuideId,
        guideStep: stepIndex,
      });
      try {
        window.history.pushState(next, '', window.location.href);
      } catch (err) {
        // ignore
      }
    }

    function renderTooltip(step) {
      if (!tooltipEl || !tooltipTextEl || !tooltipActionsEl || !tooltipIconEl) return;
      tooltipTextEl.textContent = step && step.tip ? String(step.tip) : '';
      tooltipActionsEl.innerHTML = '';
      tooltipIconEl.innerHTML = '';
      var skipAllBtn = document.createElement('button');
      skipAllBtn.type = 'button';
      skipAllBtn.className = 'guide-skip-all';
      skipAllBtn.textContent = '跳过全部';
      skipAllBtn.addEventListener('click', function(e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        endGuide(true);
      });
      var lastStep = activeFlow && activeFlow.steps && activeFlow.steps[activeFlow.steps.length - 1] === step;
      if ((step && step.skipNext === true) || lastStep) {
        tooltipActionsEl.appendChild(skipAllBtn);
      } else {
        var skipStepBtn = document.createElement('button');
        skipStepBtn.type = 'button';
        skipStepBtn.className = 'guide-skip-step';
        skipStepBtn.textContent = '跳过这一步';
        skipStepBtn.addEventListener('click', function(e) {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          completeStep({ skipped: true });
        });
        tooltipActionsEl.appendChild(skipStepBtn);
        tooltipActionsEl.appendChild(skipAllBtn);
      }
      if (step && step.swapIcon) {
        tooltipIconEl.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<path d="M7 7h10"></path>' +
          '<path d="M13.5 3.5 17 7l-3.5 3.5"></path>' +
          '<path d="M17 17H7"></path>' +
          '<path d="M10.5 20.5 7 17l3.5-3.5"></path>' +
          '</svg>' +
          '<span>拖拽交换</span>';
      }
    }

    function applyGuideOverlay(step, target) {
      ensureOverlay();
      if (!overlay || !focusEl || !tooltipEl) return;
      document.body.classList.add('guide-active');
      overlay.classList.remove('hidden');
      overlay.classList.add('active');
      if (focusEl) focusEl.classList.remove('hidden');
      if (tooltipEl) tooltipEl.classList.remove('hidden');
      focusEl.style.pointerEvents = step && step.proxy ? 'auto' : 'none';
      renderTooltip(step);
      updateFocusPosition(step, target);
    }

    function cleanupStep() {
      if (activeStep && typeof activeStep.cleanup === 'function') activeStep.cleanup();
      clearStepListeners();
      resetTargetAllow();
      activeTarget = null;
    }

    function ensureTab(step) {
      if (!step || !step.tab) return true;
      var currentTab = getActiveTab();
      if (currentTab && currentTab === step.tab) return true;
      if (typeof switchTab === 'function') {
        switchTab(step.tab);
        return false;
      }
      return true;
    }

    function waitForTarget(step, token) {
      var attempts = 0;
      function check() {
        if (token !== renderToken) return;
        var target = resolveTarget(step);
        if (target && isTargetVisible(target)) {
          activeTarget = target;
          applyTargetAllow(step, target);
          if (step && step.scrollIntoView) {
            scrollElementIntoView(target, 'smooth', 140);
          }
          applyGuideOverlay(step, target);
          bindStepEvents(step, target);
          setTimeout(function() {
            if (token !== renderToken) return;
            if (activeStep !== step || activeTarget !== target) return;
            updateFocusPosition(step, target);
          }, 360);
          return;
        }
        attempts += 1;
        if (attempts < 80) {
          setTimeout(check, 120);
        } else {
          setStatus(null, '引导目标加载失败，请刷新页面重试', 'warn');
        }
      }
      check();
    }

    function goToStep(index, options) {
      options = options || {};
      if (!activeFlow) return;
      if (index < 0) index = 0;
      if (index >= activeFlow.steps.length) {
        endGuide();
        return;
      }
      cleanupStep();
      activeStepIndex = index;
      activeStep = activeFlow.steps[index];
      saveGuideState();
      if (!options.fromHistory) pushHistoryState(index);

      if (!activeStep) return;
      if (activeStep.group) showTabGroup(activeStep.group, { keepTabActive: true });
      if (activeStep.lockMenu) showTabGroup(activeStep.lockMenu, { keepTabActive: true });

      if (!ensureTab(activeStep)) return;
      if (activeStep.prepare) activeStep.prepare();

      renderToken += 1;
      waitForTarget(activeStep, renderToken);
    }

    function handleStepAction(source) {
      if (!activeStep) return;
      if (typeof activeStep.onAction === 'function') {
        activeStep.onAction({ source: source || '' });
      }
      completeStep();
    }

    function completeStep(options) {
      options = options || {};
      if (!activeFlow) return;
      if (activeStep && typeof activeStep.onComplete === 'function') {
        activeStep.onComplete(options);
      }
      var nextIndex = activeStepIndex + 1;
      if (nextIndex >= activeFlow.steps.length) {
        endGuide();
        return;
      }
      goToStep(nextIndex);
    }

    function endGuide(fromSkipAll) {
      if (fromSkipAll && activeStep && typeof activeStep.onSkipAll === 'function') {
        activeStep.onSkipAll();
      }
      cleanupStep();
      hideAllFakePanels();
      if (overlay && overlay.classList) {
        overlay.classList.add('hidden');
        overlay.classList.remove('active');
      }
      if (focusEl && focusEl.classList) focusEl.classList.add('hidden');
      if (tooltipEl && tooltipEl.classList) tooltipEl.classList.add('hidden');
      document.body.classList.remove('guide-active');
      unbindGuideGuards();
      activeGuideId = '';
      activeStepIndex = 0;
      activeSessionId = '';
      activeFlow = null;
      activeStep = null;
      clearGuideState();
    }

    function startGuide(id, options) {
      options = options || {};
      if (!id) return;
      if (activeGuideId && activeGuideId !== id) {
        endGuide();
      }
      var flow = guideFlows[id];
      if (!flow) return;
      activeGuideId = id;
      activeFlow = flow;
      activeStepIndex = options.stepIndex ? Number(options.stepIndex) : 0;
      if (!Number.isFinite(activeStepIndex) || activeStepIndex < 0) activeStepIndex = 0;
      activeSessionId = options.sessionId || buildSessionId();
      bindOverlayPosition();
      bindGuideGuards();
      replaceHistoryState(activeStepIndex);
      saveGuideState();
      goToStep(activeStepIndex, { fromHistory: true });
    }

    function openDrawerByButton(buttonId, drawerId) {
      var drawer = drawerId ? document.getElementById(drawerId) : null;
      if (drawer && drawer.classList && drawer.classList.contains('open')) return;
      var api = drawerId ? getDrawerApi(drawerId) : null;
      if (api && typeof api.open === 'function') {
        api.open();
        return;
      }
      var btn = document.getElementById(buttonId);
      if (btn && typeof btn.click === 'function') {
        runWithClickBypass(function() { btn.click(); });
        return;
      }
      if (drawer && drawer.classList) {
        drawer.classList.remove('hidden');
        drawer.classList.add('open');
      }
    }

    function closeDrawerById(drawerId) {
      var drawer = drawerId ? document.getElementById(drawerId) : null;
      if (!drawer || !drawer.classList) return;
      var api = drawerId ? getDrawerApi(drawerId) : null;
      if (api && typeof api.close === 'function') {
        api.close();
        return;
      }
      var closer = drawer.querySelector('[data-drawer-close]') || drawer.querySelector('.drawer-mask');
      if (closer && typeof closer.click === 'function') {
        runWithClickBypass(function() { closer.click(); });
        return;
      }
      drawer.classList.remove('open');
    }

    function buildGuideListHtml() {
      var list = [
        { id: 'case-library-import', label: '用例导入引导（用例库）', desc: '导入用例到用例库并确认入库' },
        { id: 'temp-exec-import', label: '用例导入引导（用例执行）', desc: '导入用例并进入执行版本选择' },
        { id: 'temp-exec', label: '用例执行引导', desc: '执行分配与执行视图关键操作' },
        { id: 'auto-flow', label: 'AI一键功能使用引导', desc: '从导入到缺失测试点填充' },
        { id: 'casesgen', label: '用例生成', desc: '全模块生成与入库流程' },
      ];
      return list.map(function(item) {
        return (
          '<button type="button" class="guide-entry-card" data-guide-start="' + item.id + '">' +
            '<div class="guide-entry-title">' + item.label + '</div>' +
            '<div class="guide-entry-desc">' + item.desc + '</div>' +
          '</button>'
        );
      }).join('');
    }

    function buildGuideFlows() {
      return {
        'case-library-import': {
          steps: [
            {
              id: 'cases-menu',
              target: '.tab-group-btn[data-group="cases"]',
              tip: '点击展开「用例相关」菜单，进入用例库引导。',
              proxy: false,
              allowTarget: true,
              interaction: 'hover',
              onAction: function() {
                showTabGroup('cases', { keepTabActive: true });
              },
              onComplete: function() {
                showTabGroup('cases', { keepTabActive: true });
              },
            },
            {
              id: 'case-library-tab',
              group: 'cases',
              lockMenu: 'cases',
              target: '[data-tab-btn="case-library"]',
              tip: '点击「用例库」菜单按钮，进入用例库页面。',
              proxy: false,
              allowTarget: true,
              onAction: function() {},
            },
            {
              id: 'case-library-import-nav',
              tab: 'case-library',
              target: '#openCaseLibraryImportDrawerBtn',
              tip: '点击「用例导入」按钮，打开导入抽屉。',
              proxy: false,
              allowTarget: true,
              onAction: function() {},
            },
            {
              id: 'case-library-import-drop',
              tab: 'case-library',
              target: '#caseLibraryImportDropZone',
              tip: '点击选择用例 或 拖拽用例到此处。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
              prepare: function() {
                openDrawerByButton('openCaseLibraryImportDrawerBtn', 'caseLibraryImportDrawer');
              },
            },
            {
              id: 'case-library-import-project',
              tab: 'case-library',
              target: '#caseLibraryImportProjectSelect',
              tip: '选择用例所属项目。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
              prepare: function() {
                openDrawerByButton('openCaseLibraryImportDrawerBtn', 'caseLibraryImportDrawer');
              },
            },
            {
              id: 'case-library-import-version',
              tab: 'case-library',
              target: '#caseLibraryImportVersionSelect',
              tip: '选择用例所属版本。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
              prepare: function() {
                openDrawerByButton('openCaseLibraryImportDrawerBtn', 'caseLibraryImportDrawer');
              },
            },
            {
              id: 'case-library-import-confirm',
              tab: 'case-library',
              target: '#caseLibraryImportConfirmBtn',
              tip: '点击确认入库按钮，完成入库。',
              proxy: true,
              dimOpacity: 0.55,
              prepare: function() {
                openDrawerByButton('openCaseLibraryImportDrawerBtn', 'caseLibraryImportDrawer');
              },
              onComplete: function() {
                closeDrawerById('caseLibraryImportDrawer');
              },
            },
          ],
        },
        'temp-exec-import': {
          steps: [
            {
              id: 'cases-menu',
              target: '.tab-group-btn[data-group="cases"]',
              tip: '点击展开「用例相关」菜单，进入用例执行引导。',
              proxy: false,
              allowTarget: true,
              interaction: 'hover',
              onAction: function() {
                showTabGroup('cases', { keepTabActive: true });
              },
              onComplete: function() {
                showTabGroup('cases', { keepTabActive: true });
              },
            },
            {
              id: 'tempexec-tab',
              group: 'cases',
              lockMenu: 'cases',
              target: '[data-tab-btn="tempexec"]',
              tip: '点击「用例执行」菜单按钮，进入用例执行页面。',
              proxy: false,
              allowTarget: true,
            },
            {
              id: 'temp-import-nav',
              tab: 'tempexec',
              target: '#openTempExecImportDrawerBtn',
              tip: '点击「用例导入」按钮，打开导入抽屉。',
              proxy: false,
              allowTarget: true,
            },
            {
              id: 'temp-import-drop',
              tab: 'tempexec',
              target: '#tempExecDropZone',
              tip: '点击选择用例 或 拖拽用例到此处。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
              prepare: function() {
                openDrawerByButton('openTempExecImportDrawerBtn', 'tempExecImportDrawer');
              },
            },
            {
              id: 'temp-import-project',
              tab: 'tempexec',
              target: '#tempExecImportProjectSelect',
              tip: '选择用例所属项目。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
              prepare: function() {
                openDrawerByButton('openTempExecImportDrawerBtn', 'tempExecImportDrawer');
              },
            },
            {
              id: 'temp-import-version',
              tab: 'tempexec',
              target: '#tempExecImportVersionSelect',
              tip: '选择用例所属版本。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
              prepare: function() {
                openDrawerByButton('openTempExecImportDrawerBtn', 'tempExecImportDrawer');
              },
            },
            {
              id: 'temp-import-confirm',
              tab: 'tempexec',
              target: '#tempExecImportConfirmBtn',
              tip: '点击确认入库按钮。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
              prepare: function() {
                openDrawerByButton('openTempExecImportDrawerBtn', 'tempExecImportDrawer');
              },
              onComplete: function() {
                closeDrawerById('tempExecImportDrawer');
                showFakePanel(ensureFakeExecVersionPanel());
              },
            },
            {
              id: 'temp-exec-version-select',
              tab: 'tempexec',
              target: '#guideExecVersionSelect',
              tip: '点击选择执行用例的版本。点击此处进入下一步引导。',
              proxy: true,
              skipNext: true,
              prepare: function() {
                showFakePanel(ensureFakeExecVersionPanel());
              },
            },
            {
              id: 'temp-exec-version-confirm',
              tab: 'tempexec',
              target: '#guideExecVersionConfirm',
              tip: '点击确认并继续按钮，完成入库，并转到执行页面。',
              proxy: true,
              skipNext: true,
              prepare: function() {
                showFakePanel(ensureFakeExecVersionPanel());
              },
              onComplete: function() {
                hideFakePanel(fakeExecVersionPanel);
              },
            },
          ],
        },
        'temp-exec': {
          steps: [
            {
              id: 'cases-menu',
              target: '.tab-group-btn[data-group="cases"]',
              tip: '点击展开「用例相关」菜单，进入用例执行引导。',
              proxy: false,
              allowTarget: true,
              interaction: 'hover',
              onAction: function() {
                showTabGroup('cases', { keepTabActive: true });
              },
              onComplete: function() {
                showTabGroup('cases', { keepTabActive: true });
              },
            },
            {
              id: 'tempexec-tab',
              group: 'cases',
              lockMenu: 'cases',
              target: '[data-tab-btn="tempexec"]',
              tip: '点击「用例执行」菜单按钮，进入用例执行页面。',
              proxy: false,
              allowTarget: true,
            },
            {
              id: 'tempexec-select-nav',
              tab: 'tempexec',
              target: '#openTempExecCaseLibraryBtn',
              tip: '点击「选择用例执行」按钮，打开选择抽屉。',
              proxy: false,
              allowTarget: true,
            },
            {
              id: 'tempexec-select-project',
              tab: 'tempexec',
              target: '#caseLibrarySelectProjectSelect',
              tip: '选择目标用例所属项目。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
              scrollIntoView: true,
              prepare: function() {
                openDrawerByButton('openTempExecCaseLibraryBtn', 'caseLibrarySelectExecDrawer');
              },
            },
            {
              id: 'tempexec-select-version',
              tab: 'tempexec',
              target: '#caseLibrarySelectVersionSelect',
              tip: '选择目标用例所属项目版本。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
              scrollIntoView: true,
              prepare: function() {
                openDrawerByButton('openTempExecCaseLibraryBtn', 'caseLibrarySelectExecDrawer');
              },
            },
            {
              id: 'tempexec-select-refresh',
              tab: 'tempexec',
              target: '#caseLibrarySelectConfirmBtn',
              tip: '刷新后下方会展示用例列表，点击【转到执行】后即可。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
              prepare: function() {
                openDrawerByButton('openTempExecCaseLibraryBtn', 'caseLibrarySelectExecDrawer');
              },
              onComplete: function() {
                closeDrawerById('caseLibrarySelectExecDrawer');
              },
            },
            {
              id: 'tempexec-assign-nav',
              tab: 'tempexec',
              target: '#openTempExecAssignDrawerBtn',
              tip: '点击「执行分配」按钮，进入执行分配演示页面。',
              proxy: true,
              skipNext: true,
              onAction: function() {
                showFakePanel(ensureFakeAssignPanel());
              },
            },
            {
              id: 'tempexec-assign-version-click',
              tab: 'tempexec',
              target: '#guideAssignVersionBox1',
              tip: '可点击选择想要执行的用例。点击此处进入下一步引导。',
              proxy: true,
              skipNext: true,
              prepare: function() {
                showFakePanel(ensureFakeAssignPanel());
              },
            },
            {
              id: 'tempexec-assign-case-drag',
              tab: 'tempexec',
              target: '#guideAssignVersionBox1',
              tip: '拖拽用例可交换位置。点击此处进入下一步引导。',
              proxy: false,
              skipNext: true,
              swapIcon: true,
              interaction: 'drag',
              dragTargets: ['#guideAssignVersionBox1 .temp-req-row'],
              prepare: function() {
                showFakePanel(ensureFakeAssignPanel());
              },
              allowTarget: true,
            },
            {
              id: 'tempexec-assign-version-drag',
              tab: 'tempexec',
              target: '.guide-version-grid',
              tip: '拖拽版本盒子可交换位置。点击此处进入下一步引导。',
              proxy: false,
              skipNext: true,
              swapIcon: true,
              interaction: 'drag',
              dragTargets: ['.guide-version-card'],
              prepare: function() {
                showFakePanel(ensureFakeAssignPanel());
              },
              allowTarget: true,
            },
            {
              id: 'tempexec-assign-focus',
              tab: 'tempexec',
              target: '#guideAssignFocusZone',
              tip: '拖拽用例到专注区，可以在执行页快速切换。点击此处进入下一步引导。',
              proxy: true,
              skipNext: true,
              prepare: function() {
                showFakePanel(ensureFakeAssignPanel());
              },
              onComplete: function() {
                hideFakePanel(fakeAssignPanel);
              },
            },
            {
              id: 'tempexec-focus-block',
              tab: 'tempexec',
              target: '#tempExecViewFocusBlock',
              tip: '专注区的用例会显示在这里，点击这里可以快速打开【执行分配】页。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
            },
            {
              id: 'tempexec-archive',
              tab: 'tempexec',
              target: '#guideArchiveBtn',
              tip: '这是最后一步的操作，归档用于存储执行完成的用例，如果用例已经跑完，请务必点击归档，即可把执行记录入库。',
              proxy: true,
              dimOpacity: 0.55,
              prepare: function() {
                var btn = ensureFakeArchiveButton();
                if (btn && btn.classList) btn.classList.remove('hidden');
              },
              onComplete: function() {
                if (fakeArchiveBtn && fakeArchiveBtn.classList) fakeArchiveBtn.classList.add('hidden');
              },
            },
          ],
        },
        'auto-flow': {
          steps: [
            {
              id: 'ai-menu',
              target: '.tab-group-btn[data-group="ai"]',
              tip: '点击展开「AI 功能」菜单，进入一键执行引导。',
              proxy: false,
              allowTarget: true,
              interaction: 'hover',
              onAction: function() {
                showTabGroup('ai', { keepTabActive: true });
              },
              onComplete: function() {
                showTabGroup('ai', { keepTabActive: true });
              },
            },
            {
              id: 'auto-tab',
              group: 'ai',
              lockMenu: 'ai',
              target: '[data-tab-btn="auto"]',
              tip: '点击「一键执行」菜单按钮，进入流程页面。',
              proxy: false,
              allowTarget: true,
            },
            {
              id: 'auto-import-raw',
              tab: 'auto',
              target: '#autoRawDropZone',
              tip: '点击选择需求 或 拖拽需求到此处。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
              scrollIntoView: true,
            },
            {
              id: 'auto-import-case',
              tab: 'auto',
              target: '#autoCaseDropZone',
              tip: '点击选择用例 或 拖拽用例到此处。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
              scrollIntoView: true,
            },
            {
              id: 'auto-clarify-toggle',
              tab: 'auto',
              target: '#autoNeedClarify',
              tip: '勾选后将在需求评审后进入人工审核流程。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
            },
            {
              id: 'auto-run',
              tab: 'auto',
              target: '#runAutoWorkflow',
              tip: '点击后可直接执行功能流程。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
            },
            {
              id: 'auto-flow-nav',
              tab: 'auto',
              target: '#flowNav',
              tip: '可在此处观察执行进度，并点击按钮跳转到对应的功能流程中查看。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
            },
            {
              id: 'auto-missing-toggle',
              tab: 'auto',
              target: '#autoMissingToggle',
              tip: 'AI一键执行完毕后，点击可打开缺失测试点视图。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
              scrollIntoView: true,
            },
            {
              id: 'auto-missing-view',
              tab: 'auto',
              target: '#guideMissingSmartFillBtn',
              tip: '点击会自动填充缺失的测试点到对应的模块，可操作用例生成。点击此处进入下一步引导。',
              proxy: true,
              skipNext: true,
              prepare: function() {
                showFakePanel(ensureFakeMissingPanel());
                var btn = document.getElementById('guideMissingSmartFillBtn');
                if (btn) scrollElementIntoView(btn, 'auto', 120);
              },
              onComplete: function() {
                hideFakePanel(fakeMissingPanel);
              },
            },
          ],
        },
        casesgen: {
          steps: [
            {
              id: 'ai-menu',
              target: '.tab-group-btn[data-group="ai"]',
              tip: '点击展开「AI 功能」菜单，进入用例生成引导。',
              proxy: false,
              allowTarget: true,
              interaction: 'hover',
              onAction: function() {
                showTabGroup('ai', { keepTabActive: true });
              },
              onComplete: function() {
                showTabGroup('ai', { keepTabActive: true });
              },
            },
            {
              id: 'casesgen-tab',
              group: 'ai',
              lockMenu: 'ai',
              target: '[data-tab-btn="casesgen"]',
              tip: '点击「用例生成」菜单按钮，进入生成页面。',
              proxy: false,
              allowTarget: true,
            },
            {
              id: 'casesgen-all',
              tab: 'casesgen',
              target: '#caseGenAllGenerateBtn',
              tip: '点击可对所有模块进行生成，注意，生成的是全部内容。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
              scrollIntoView: true,
            },
            {
              id: 'casesgen-topup',
              tab: 'casesgen',
              target: '#caseGenAllTopupBtn',
              tip: '点击后可对全模块进行补充生成，注意，仅针对生成建议的内容进行补充的生成，不会去掉原来已经生成的用例数据。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
            },
            {
              id: 'casesgen-view',
              tab: 'casesgen',
              target: '#caseGenAllViewBtn',
              tip: '打开可展开全部已生成用例模块的视图，需要先进行勾选才能进行下一步操作。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
            },
            {
              id: 'casesgen-store-select',
              tab: 'casesgen',
              target: '#caseGenStoreActionSelect',
              tip: '此方式会将用例作为全新用例进入入库，需要先选择入库方式，直接入库则直接写入用例库，执行入库则写入数据库后，自动转执行。点击此处进入下一步引导。',
              proxy: true,
              dimOpacity: 0.55,
            },
            {
              id: 'casesgen-store-append',
              tab: 'casesgen',
              target: '#caseGenStoreAppendBtn',
              tip: '此方式会把当前选择的用例追加到已有的用例中。',
              proxy: true,
              dimOpacity: 0.55,
            },
          ],
        },
      };
    }

    var guideFlows = buildGuideFlows();

    if (drawerBody) {
      drawerBody.innerHTML = buildGuideListHtml();
      drawerBody.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-guide-start]') : null;
        if (!btn || !btn.dataset) return;
        var id = btn.dataset.guideStart;
        if (guideDrawer && typeof guideDrawer.close === 'function') guideDrawer.close();
        startGuide(id);
      });
    }

    if (drawerTitle) drawerTitle.textContent = '功能引导';
    if (guideTriggerBtn && drawerEl && window.app && window.app.drawer && typeof window.app.drawer.createDrawer === 'function') {
      guideDrawer = window.app.drawer.createDrawer({
        drawerId: 'flowGuideDrawer',
        openButtons: ['flowGuideTrigger'],
        closeButtons: ['closeFlowGuideDrawerBtn'],
      });
    } else if (guideTriggerBtn && closeDrawerBtn && drawerEl) {
      guideTriggerBtn.addEventListener('click', function() {
        drawerEl.classList.toggle('open');
        drawerEl.classList.remove('hidden');
      });
      closeDrawerBtn.addEventListener('click', function() {
        drawerEl.classList.remove('open');
      });
    }

    var restored = loadGuideState();
    if (restored && restored.id && restored.active) {
      startGuide(restored.id, { stepIndex: restored.step || 0, sessionId: restored.session });
    }

    window.app = window.app || {};
    window.app.flowGuide = {
      init: init,
      start: startGuide,
      stop: endGuide,
    };
    return window.app.flowGuide;
  }

  window.app = window.app || {};
  window.app.flowGuide = { init: init };
})();
