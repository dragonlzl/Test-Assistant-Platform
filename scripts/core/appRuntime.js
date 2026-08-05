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
    var saveAssignments = ctx.saveAssignments || function() {};
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
    var callModelWithContent = ctx.callModelWithContent || function() { return Promise.reject(); };
    var getAssignedModel = ctx.getAssignedModel || function() {};
    var getReasoningForType = ctx.getReasoningForType || function() { return ''; };
    var getTemperatureForType = ctx.getTemperatureForType || function() { return 0.2; };
    var xmindCaseGenTaskManager = ctx.xmindCaseGenTaskManager || null;
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
    var xmindCasegenModule = null;
    var exportCaseGenerationResults = api.exportCaseGenerationResults || function() {};
    var sidebarBlockersBound = false;
    var workflowPersistenceFactory = window.app && window.app.workflowPersistenceOwner;
    if (!workflowPersistenceFactory || typeof workflowPersistenceFactory.create !== 'function') {
      throw new Error('workflowPersistenceOwner 未初始化');
    }
    var workflowPersistence = workflowPersistenceFactory.create({
      state: state,
      dom: dom,
      window: window,
      document: typeof document !== 'undefined' ? document : null,
      localStorage: typeof localStorage !== 'undefined' ? localStorage : null,
      storage: window.app && window.app.services ? window.app.services.storage : null,
      cloneJson: window.app.jsonCloneCore.cloneJson,
      debounce: appUtils.debounce,
      showCenterToast: appUtils.showCenterToast,
      workflowStorageKey: ctx.workflowStorageKey
        || (window.app && window.app.config && window.app.config.workflowStorageKey)
        || 'usecase-workflow-state-v1',
      getTaskManager: function() { return xmindCaseGenTaskManager; },
    });
    var persistWorkflowState = workflowPersistence.persist;
    var persistWorkflowStateNow = workflowPersistence.persistNow;
    var restoreWorkflowState = workflowPersistence.restore;
    var preclearOversizeWorkflowSnapshotBeforeModuleInit = workflowPersistence.preclearOversizeWorkflowSnapshotBeforeModuleInit;
    var preclearOversizeXmindTaskStorageBeforeModuleInit = workflowPersistence.preclearOversizeXmindTaskStorageBeforeModuleInit;
    var flushWorkflowRecoveryNotice = workflowPersistence.flushRecoveryNotice;
    var bindWorkflowPersistenceListeners = workflowPersistence.bindListeners;
    var deferredXmindRestoreTimer = 0;
    var deferredXmindRestoreFallbackTimer = 0;

    if (!window.app) window.app = {};
    window.app.persistWorkflowState = persistWorkflowState;
    window.app.persistWorkflowStateNow = persistWorkflowStateNow;
    api.persistWorkflowState = persistWorkflowState;
    api.persistWorkflowStateNow = persistWorkflowStateNow;

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
      var lockedGroup = window.app && window.app.lockedTabGroup ? String(window.app.lockedTabGroup) : '';
      var guideActive = Boolean(document.body && document.body.classList && document.body.classList.contains('guide-active'));
      if (guideActive && lockedGroup && name !== lockedGroup) return;
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
      // Flush workflow snapshot before cross-page navigation to avoid debounce loss.
      persistWorkflowStateNow();
      persistActiveTabForSession(name);
      try {
        window.location.href = buildTabUrl(target, name) || target;
      } catch (err) {
        // ignore
      }
      return true;
    }

    function restoreLegacyCaseGenContextBeforeLeave(nextTabName) {
      var nextName = nextTabName ? String(nextTabName || '') : '';
      if (!nextName || nextName === 'casesgen') return false;
      if (String(state.activeTab || '') !== 'casesgen') return false;
      var settings = state.caseGenSettings && typeof state.caseGenSettings === 'object'
        ? state.caseGenSettings
        : null;
      var activeCaseGenView = settings && (settings.activeTab === 'xmind-modules' || settings.activeTab === 'modules')
        ? 'xmind-modules'
        : (settings && settings.activeTab === 'legacy-modules' ? 'legacy-modules' : 'settings');
      var xmindApi = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      var xmindDrawerOpen = Boolean(xmindApi && typeof xmindApi.isOpen === 'function' && xmindApi.isOpen());
      if (!xmindDrawerOpen && activeCaseGenView !== 'xmind-modules') return false;
      if (xmindDrawerOpen && xmindApi && typeof xmindApi.close === 'function') {
        xmindApi.close();
      }
      if (!casesGenApi || typeof casesGenApi.restoreLegacyCaseGenState !== 'function') return false;
      casesGenApi.restoreLegacyCaseGenState({
        render: false,
        persist: false,
        restoreInputs: true,
      });
      if (typeof casesGenApi.renderCaseGeneration === 'function') {
        casesGenApi.renderCaseGeneration();
      }
      return true;
    }

    function switchTab(name, options) {
      if (name === 'xmind-casegen') {
        name = 'casesgen';
      }
      restoreLegacyCaseGenContextBeforeLeave(name);
      var mappedToOtherPage = false;
      if (name) {
        var mappedPage = resolveTabPage(name);
        var currentPage = getCurrentPageName();
        // 仅依赖 data-tab-section 会被“同名抽屉”误判；优先按页面映射判断是否应跨页跳转。
        mappedToOtherPage = Boolean(mappedPage && currentPage && mappedPage !== currentPage);
      }
      if (name && (shouldForceRedirect() || mappedToOtherPage || !hasLocalTabSection(name))) {
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
          [
            'reviewAssignStatus',
            'cleanAssignStatus',
            'compareAssignStatus',
            'splitAssignStatus',
            'casesAssignStatus',
            'caseGenAssignStatus',
            'caseFilterAssignStatus',
            'missingReminderAssignStatus',
            'caseLibraryGenAssignStatus',
          ]
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
      // 进入“用例执行”页签时递增同步触发序号；状态刷新由业务模块统一响应激活事件。
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
        function shouldSkipGlobalUnloadPersist() {
          try {
            var xmindApi = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
            if (!xmindApi || typeof xmindApi.isOpen !== 'function') return false;
            if (xmindApi.isOpen() !== true) return false;
            return getActiveTabFromDom() === 'casesgen';
          } catch (err) {
            return false;
          }
        }
        window.addEventListener('beforeunload', function() {
          if (!shouldSkipGlobalUnloadPersist()) {
            persistWorkflowStateNow();
          }
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
            if (!shouldSkipGlobalUnloadPersist()) {
              persistWorkflowStateNow();
            }
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
      renderCaseGenProgressBoard: renderCaseGenProgressBoard,
      persistWorkflowState: persistWorkflowState,
      persistWorkflowStateNow: persistWorkflowStateNow,
    }, Object.keys({
      state: 1, config: 1, utils: 1, setStatus: 1, switchTab: 1, scrollToSection: 1, hasCaseSource: 1, getCombinedCaseList: 1,
      getCombinedCaseText: 1, deriveCaseListFromText: 1, parseCaseList: 1, renderCaseTable: 1, formatCompactTimestamp: 1, escapeHtml: 1,
      escapeHtmlPreserve: 1, updateFlowStatus: 1, updateCurrentPath: 1, setCurrentPathSub: 1, callModelWithConfig: 1, getAssignedModel: 1, updateModelTiming: 1, setCaseViewHint: 1,
      downloadBlob: 1, parseXmindFile: 1, scrollElementIntoView: 1, updateAssignmentStatuses: 1, updateReasoningVisibility: 1, testModel: 1,
      renderCaseGeneration: 1, renderCaseGenProgressBoard: 1, persistWorkflowState: 1, persistWorkflowStateNow: 1,
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
      generateSuggestedCaseGenModules: api.generateSuggestedCaseGenModules || function() {},
      toggleCaseView: toggleCaseView,
      openXmindMirrorCaseView: api.openXmindMirrorCaseView || function() { return false; },
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
      refreshCaseGenBatchButtons: api.refreshCaseGenBatchButtons || function() {},
      ensureCaseGenSettings: api.ensureCaseGenSettings || function() { return {}; },
      setCaseGenSettingValue: api.setCaseGenSettingValue || function() {},
      syncCaseGenSpecialOptionsState: api.syncCaseGenSpecialOptionsState || function() {},
      setCaseGenViewTab: api.setCaseGenViewTab || function() {},
      setCaseGenStoreMode: api.setCaseGenStoreMode || function() {},
      openCaseGenBatchActionDrawer: api.openCaseGenBatchActionDrawer || function() {},
      openCaseGenModuleGenerateDrawer: api.openCaseGenModuleGenerateDrawer || function() {},
      openCaseGenSettingsDrawer: api.openCaseGenSettingsDrawer || function() {},
      getCaseGenPromptComponents: api.getCaseGenPromptComponents || function() { return []; },
      buildCaseGenPrompt: api.buildCaseGenPrompt || function() { return ''; },
      buildModuleCases: api.buildModuleCases || function() { return Promise.resolve(null); },
      buildModuleTopup: api.buildModuleTopup || function() { return Promise.resolve(null); },
      commitModuleCases: api.commitModuleCases || function() { return null; },
      snapshotModuleCases: api.snapshotModuleCases || function() { return null; },
      rollbackModuleCases: api.rollbackModuleCases || function() { return false; },
      snapshotAllCaseGenState: api.snapshotAllCaseGenState || function() { return null; },
      rollbackAllCaseGenState: api.rollbackAllCaseGenState || function() { return false; },
      getLatestCaseGenOperationSnapshot: api.getLatestCaseGenOperationSnapshot || function() { return null; },
      discardCaseGenOperationSnapshot: api.discardCaseGenOperationSnapshot || function() { return false; },
      rollbackCaseGenOperationSnapshot: api.rollbackCaseGenOperationSnapshot || function() { return false; },
      syncLegacyCaseGenState: api.syncLegacyCaseGenState || function() { return null; },
      restoreLegacyCaseGenState: api.restoreLegacyCaseGenState || function() { return false; },
      getCaseListForModule: api.getCaseListForModule || function() { return []; },
      refreshExportCaseGenXmindButton: api.refreshExportCaseGenXmindButton || function() {},
      setCaseGenDbStoreNewAction: api.setCaseGenDbStoreNewAction || function() {},
      clearCaseGenDbStoreNewActionError: api.clearCaseGenDbStoreNewActionError || function() {},
      openCaseGenAllView: api.openCaseGenAllView || function() {},
      openCaseGenDbStoreNewDrawer: api.openCaseGenDbStoreNewDrawer || function() {},
      openCaseGenDbStoreAppendDrawer: api.openCaseGenDbStoreAppendDrawer || function() {},
      openCaseGenDbStoreNewDrawerWithItems: api.openCaseGenDbStoreNewDrawerWithItems || function() {},
      openCaseGenDbStoreAppendDrawerWithItems: api.openCaseGenDbStoreAppendDrawerWithItems || function() {},
      renderAppendTargetOptions: api.renderAppendTargetOptions || function() {},
      handleCaseSelectionChange: handleCaseSelectionChange,
      handleCaseSelectAll: handleCaseSelectAll,
      handleCaseSelectAllModules: api.handleCaseSelectAllModules || function() {},
      exportCaseGenerationResults: exportCaseGenerationResults,
      ensureCaseGenModulesFromSplit: ensureCaseGenModulesFromSplit,
      renderCaseGeneration: renderCaseGeneration,
    }, Object.keys({
      goToCaseGeneration: 1, generateCasesForModule: 1, generateAllCaseGenModules: 1, generateSuggestedCaseGenModules: 1, toggleCaseView: 1, openXmindMirrorCaseView: 1, exportModuleCases: 1, exportSelectedCases: 1,
      exportSelectedCasesToXmind: 1, exportSelectedModulesToXmind: 1, transferModuleToTempExec: 1, importModuleCases: 1, clearModuleCases: 1, topUpCasesForModule: 1,
      topUpAllCaseGenModules: 1,
      appendSelectedCasesToImported: 1, transferSelectedCasesToExec: 1,
      refreshAppendExistingButton: 1, refreshCaseGenBatchButtons: 1,
      ensureCaseGenSettings: 1, setCaseGenSettingValue: 1, syncCaseGenSpecialOptionsState: 1, setCaseGenViewTab: 1, setCaseGenStoreMode: 1, openCaseGenBatchActionDrawer: 1, openCaseGenModuleGenerateDrawer: 1,
      openCaseGenSettingsDrawer: 1, getCaseGenPromptComponents: 1, buildCaseGenPrompt: 1,
      buildModuleCases: 1, buildModuleTopup: 1, commitModuleCases: 1, snapshotModuleCases: 1, rollbackModuleCases: 1,
      snapshotAllCaseGenState: 1, rollbackAllCaseGenState: 1,
      getLatestCaseGenOperationSnapshot: 1, discardCaseGenOperationSnapshot: 1, rollbackCaseGenOperationSnapshot: 1,
      syncLegacyCaseGenState: 1, restoreLegacyCaseGenState: 1,
      getCaseListForModule: 1,
      refreshExportCaseGenXmindButton: 1,
      setCaseGenDbStoreNewAction: 1, clearCaseGenDbStoreNewActionError: 1,
      openCaseGenAllView: 1, openCaseGenDbStoreNewDrawer: 1, openCaseGenDbStoreAppendDrawer: 1,
      openCaseGenDbStoreNewDrawerWithItems: 1, openCaseGenDbStoreAppendDrawerWithItems: 1,
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

    function markRuntimeStage(stage) {
      if (typeof window === 'undefined' || !window) return;
      window.app = window.app || {};
      window.app.__tapInitRuntimeStage = stage ? String(stage || '') : '';
      var nextHistory = Array.isArray(window.app.__tapInitRuntimeStageHistory)
        ? window.app.__tapInitRuntimeStageHistory.slice()
        : [];
      nextHistory.push(window.app.__tapInitRuntimeStage);
      if (nextHistory.length > 24) nextHistory = nextHistory.slice(nextHistory.length - 24);
      window.app.__tapInitRuntimeStageHistory = nextHistory;
      try {
        var root = document && document.documentElement ? document.documentElement : null;
        if (!root) return;
        var historyText = nextHistory.join('>');
        if (root.dataset) {
          root.dataset.tapRuntimeStage = window.app.__tapInitRuntimeStage;
          root.dataset.tapRuntimeStageHistory = historyText;
        } else {
          root.setAttribute('data-tap-runtime-stage', window.app.__tapInitRuntimeStage);
          root.setAttribute('data-tap-runtime-stage-history', historyText);
        }
      } catch (err) {
        // ignore
      }
    }

    function scheduleDeferredXmindRestore() {
      if (deferredXmindRestoreTimer) {
        clearTimeout(deferredXmindRestoreTimer);
        deferredXmindRestoreTimer = 0;
      }
      if (deferredXmindRestoreFallbackTimer) {
        clearTimeout(deferredXmindRestoreFallbackTimer);
        deferredXmindRestoreFallbackTimer = 0;
      }
      deferredXmindRestoreTimer = setTimeout(function() {
        deferredXmindRestoreTimer = 0;
        if (!xmindCasegenModule || typeof xmindCasegenModule.restoreAfterWorkflowReady !== 'function') return;
        markRuntimeStage('before-xmind-restore-after-ready');
        xmindCasegenModule.restoreAfterWorkflowReady();
        markRuntimeStage('after-xmind-restore-after-ready');
        deferredXmindRestoreFallbackTimer = setTimeout(function() {
          deferredXmindRestoreFallbackTimer = 0;
          if (!xmindCasegenModule || typeof xmindCasegenModule.isOpen !== 'function' || typeof xmindCasegenModule.open !== 'function') return;
          if (xmindCasegenModule.isOpen() === true) return;
          if (String(state.activeTab || '') !== 'casesgen') return;
          if (!state.xmindCaseGen || !state.xmindCaseGen.viewState || state.xmindCaseGen.viewState.drawerOpen !== true) return;
          try {
            xmindCasegenModule.open({ restoreOpening: true });
          } catch (err) {
            // ignore
          }
        }, 450);
      }, 0);
    }

    function initApp() {
      markRuntimeStage('initApp-enter');
      if (window.app && window.app._inited) return;
      if (!window.app) window.app = {};
      window.app._inited = true;
      window.app.__tapWorkflowReady = false;
      markRuntimeStage('inited-flag-set');
      workflowPersistence.setRestoring(true);
      restoreWorkflowState();
      markRuntimeStage('workflow-restored');
      ensureXmindCasegenModule();
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
      syncCaseTextWithImports();
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
      core.renderCaseGenProgressBoard = api.renderCaseGenProgressBoard;
    }
    if (casesGenApi && api && typeof api.renderCaseGenProgressBoard === 'function') {
      casesGenApi.renderCaseGenProgressBoard = api.renderCaseGenProgressBoard;
    }
    if (api && typeof api.renderCaseGenProgressBoard === 'function') {
      api.renderCaseGenProgressBoard();
    }
    if (state.caseGenModules && state.caseGenModules.length) {
      renderCaseGeneration();
    }
      setCaseViewHint('请先上传或输入 XMind 测试用例');
      updateFlowStatus();
      bindWorkflowPersistenceListeners();
      workflowPersistence.setRestoring(false);
      window.app.__tapWorkflowReady = true;
      markRuntimeStage('workflow-ready');
      flushWorkflowRecoveryNotice();
      scheduleDeferredXmindRestore();
      return { casegenHandlersModule: casegenHandlersModule, casegenCoreModule: casegenCoreModule, layoutHandlersModule: layoutHandlersModule };
    }
    window.app = window.app || {};
    window.app.__tapWorkflowReady = false;
    window.app.init = initApp;

    renderCaseGenProgressBoard();

    const xmindKnowledgeBaseApi = window.app.xmindKnowledgeBase && typeof window.app.xmindKnowledgeBase.init === 'function'
      ? window.app.xmindKnowledgeBase.init({
        state: state,
        apiClient: window.app.apiClient || null,
        escapeHtml: escapeHtml,
      })
      : null;
    if (xmindKnowledgeBaseApi) {
      window.app.xmindKnowledgeBaseApi = xmindKnowledgeBaseApi;
    }

    const moduleContext = {
      state: state,
      config: window.app.config,
      utils: appUtils,
      core: core,
      tempExecApi: tempExecApi,
      casesGenApi: casesGenApi,
      prepApi: {
        reviewRequirements: api.reviewRequirements,
        runCleaning: api.runCleaning,
        compareCoverage: api.compareCoverage || compareCoverage,
        splitModules: api.splitModules,
        compareCasesCoverage: api.compareCasesCoverage,
        runAutoWorkflow: api.runAutoWorkflow,
        buildAutoWorkflowSteps: api.buildAutoWorkflowSteps,
        executeAutoWorkflowSteps: api.executeAutoWorkflowSteps,
        interruptActiveExecutions: api.interruptActiveExecutions,
        resetWorkflowData: api.resetWorkflowData,
        hasCaseSource: hasCaseSource,
        switchTab: switchTab,
        scrollToSection: scrollToSection,
        updateFlowStatus: updateFlowStatus,
      },
      xmindGenApi: {
        callModelWithConfig: callModelWithConfig,
        callModelWithContent: callModelWithContent,
        getAssignedModel: getAssignedModel,
        getReasoningForType: getReasoningForType,
        getTemperatureForType: getTemperatureForType,
        taskManager: xmindCaseGenTaskManager,
        saveAssignments: saveAssignments,
        renderAssignmentsSelect: renderAssignmentsSelect,
        updateAssignmentStatuses: updateAssignmentStatuses,
        deriveCaseListFromText: deriveCaseListFromText,
        parseCaseList: parseCaseList,
        getCombinedCaseList: getCombinedCaseList,
        getCombinedCaseText: getCombinedCaseText,
        hasCaseSource: hasCaseSource,
      },
      xmindCoreApi: window.app.xmindCoreApi || null,
      xmindMarkdownExportCoreApi: window.app.xmindMarkdownExportCoreApi || null,
      mindElixirCoreApi: window.app.mindElixirCoreApi || null,
      casesCoreApi: window.app.casesCoreApi || null,
      xmindKnowledgeBaseApi: xmindKnowledgeBaseApi,
      casePageAiGenPrepApi: null,
      caseLibraryAiGenModelOwner: window.app && window.app.caseLibrary
        ? window.app.caseLibrary.aiGenModel
        : null,
      caseLibraryAiGenStoreOwner: window.app && window.app.caseLibrary
        ? window.app.caseLibrary.aiGenStore
        : null,
      caseLibraryDiffModel: window.app && window.app.caseLibrary
        ? window.app.caseLibrary.diffModel
        : null,
    };
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
        cancelAutoWorkflow: api.cancelAutoWorkflow,
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
    function ensureXmindCasegenModule() {
      if (xmindCasegenModule) return xmindCasegenModule;
      if (!window.app.xmindCasegen || typeof window.app.xmindCasegen.init !== 'function') {
        return null;
      }
      xmindCasegenModule = window.app.xmindCasegen.init(moduleContext) || null;
      return xmindCasegenModule;
    }

    preclearOversizeWorkflowSnapshotBeforeModuleInit();
    preclearOversizeXmindTaskStorageBeforeModuleInit();
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
