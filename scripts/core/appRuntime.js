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
    var getAssignedModel = ctx.getAssignedModel || function() {};
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
    var exportCaseGenerationResults = api.exportCaseGenerationResults || function() {};
    var sidebarBlockersBound = false;

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

    function showTabGroup(name, opts) {
      opts = opts || {};
      var keepTabActive = Boolean(opts.keepTabActive);
      var expand = opts.expand !== false; // 默认展开
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
        if (btn && btn.classList) btn.classList.remove('active');
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
      // 高亮当前一级按钮，其余取消
      var btns = Array.prototype.slice.call(document.querySelectorAll('.tab-group-btn'));
      btns.forEach(function(b) {
        b.classList.toggle('active', b === tBtn);
      });
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

    function switchTab(name) {
      // 重复切到当前页签时不必关闭抽屉：避免误关，并避免影响“刷新后恢复抽屉打开态”的体验。
      if (state.activeTab !== name && window.app && window.app.drawer && typeof window.app.drawer.closeAllDrawers === 'function') {
        window.app.drawer.closeAllDrawers();
      }
      state.activeTab = name;
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
          name === 'tempexec' || name === 'project-admin' || name === 'user-admin' || name === 'exec-overview' || name === 'case-library' || name === 'case-archive'
        );
      }
      if (dom.tempexecFlowNav) {
        dom.tempexecFlowNav.classList.toggle('hidden', name !== 'tempexec');
      }
      if (name === 'models') clearStatusById('modelFormStatus');
      if (name === 'assign') {
        renderAssignmentsSelect();
        ['reviewAssignStatus', 'cleanAssignStatus', 'compareAssignStatus', 'splitAssignStatus', 'casesAssignStatus', 'caseGenAssignStatus', 'caseFilterAssignStatus']
          .forEach(clearStatusById);
        focusAssignSaveIfNeeded();
      }
      if (name === 'casesgen') {
        const autoFilled = ensureCaseGenModulesFromSplit();
        if (autoFilled) {
          setStatus(dom.caseGenStatus, '', '');
          renderCaseGeneration();
        } else if (state.caseGenModules.length) {
          renderCaseGeneration();
        }
        if (dom.toSplitFromCaseGenBtn) dom.toSplitFromCaseGenBtn.classList.remove('hidden');
      }
      if (name === 'auto') {
        updateAutoClarifyVisibility();
        syncAutoCompareStatus();
        updateAutoMissingCard();
      }
      if (name === 'settings') {
        renderSettingsUI();
        clearStatusById('feishuWebhookStatus');
      }
      // 进入“用例执行”页签时：递增一次“用例库同步触发序号”，并尽量触发一次执行页数据刷新。
      // 这样即便业务模块尚未绑定 app-tab-activated 监听，也能在切页时完成一次同步检查（仅 DB 模式会产生实际同步）。
      if (name === 'tempexec') {
        try {
          window.app = window.app || {};
          var prev = Number(window.app.__tempexecCaseLibrarySyncSeq || 0);
          if (!Number.isFinite(prev) || prev < 0) prev = 0;
          window.app.__tempexecCaseLibrarySyncSeq = prev + 1;
          window.app.__tempexecCaseLibrarySyncReason = 'tab-enter';
        } catch (err) {
          // ignore
        }
        try {
          if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
            setTimeout(function() {
              try {
                window.app.tempExecApi.loadTempExecState();
              } catch (err2) {
                // ignore
              }
            }, 0);
          }
        } catch (err3) {
          // ignore
        }
      }
      markActiveTabGroup(name);
      var grp = getGroupNameForTab(name);
      showTabGroup(grp, { keepTabActive: true, expand: false });
      // 给各业务模块一个统一的“页签激活”钩子：用于刷新后恢复页签时也能自动拉取数据。
      try {
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
          window.dispatchEvent(new CustomEvent('app-tab-activated', { detail: { tab: name } }));
        }
      } catch (err) {
        // ignore
      }
    }
    api.switchTab = switchTab;
    // 兜底：页面刷新/关闭前再写一次 activeTab，避免少数情况下首次切页后未落到 sessionStorage 的问题。
    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('beforeunload', function() {
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
            persistActiveTabForSession(getActiveTabFromDom());
          }
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
    }, Object.keys({
      state: 1, config: 1, utils: 1, setStatus: 1, switchTab: 1, scrollToSection: 1, hasCaseSource: 1, getCombinedCaseList: 1,
      getCombinedCaseText: 1, deriveCaseListFromText: 1, parseCaseList: 1, renderCaseTable: 1, formatCompactTimestamp: 1, escapeHtml: 1,
      escapeHtmlPreserve: 1, updateFlowStatus: 1, callModelWithConfig: 1, getAssignedModel: 1, updateModelTiming: 1, setCaseViewHint: 1,
      downloadBlob: 1, parseXmindFile: 1, scrollElementIntoView: 1, updateAssignmentStatuses: 1, updateReasoningVisibility: 1, testModel: 1,
      renderCaseGeneration: 1,
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
      toggleCaseView: toggleCaseView,
      exportModuleCases: exportModuleCases,
      exportSelectedCases: exportSelectedCases,
      exportSelectedCasesToXmind: exportSelectedCasesToXmind,
      exportSelectedModulesToXmind: exportSelectedModulesToXmind,
      transferModuleToTempExec: transferModuleToTempExec,
      transferSelectedCasesToExec: transferSelectedCasesToExec,
      importModuleCases: importModuleCases,
      clearModuleCases: clearModuleCases,
      topUpCasesForModule: topUpCasesForModule,
      appendSelectedCasesToImported: appendSelectedCasesToImported,
      refreshAppendExistingButton: api.refreshAppendExistingButton || function() {},
      refreshExportCaseGenXmindButton: api.refreshExportCaseGenXmindButton || function() {},
      setCaseGenDbStoreNewAction: api.setCaseGenDbStoreNewAction || function() {},
      clearCaseGenDbStoreNewActionError: api.clearCaseGenDbStoreNewActionError || function() {},
      openCaseGenDbStoreNewDrawer: api.openCaseGenDbStoreNewDrawer || function() {},
      openCaseGenDbStoreAppendDrawer: api.openCaseGenDbStoreAppendDrawer || function() {},
      renderAppendTargetOptions: api.renderAppendTargetOptions || function() {},
      handleCaseSelectionChange: handleCaseSelectionChange,
      handleCaseSelectAll: handleCaseSelectAll,
      exportCaseGenerationResults: exportCaseGenerationResults,
      ensureCaseGenModulesFromSplit: ensureCaseGenModulesFromSplit,
      renderCaseGeneration: renderCaseGeneration,
    }, Object.keys({
      goToCaseGeneration: 1, generateCasesForModule: 1, toggleCaseView: 1, exportModuleCases: 1, exportSelectedCases: 1,
      exportSelectedCasesToXmind: 1, exportSelectedModulesToXmind: 1, transferModuleToTempExec: 1, importModuleCases: 1, clearModuleCases: 1, topUpCasesForModule: 1,
      appendSelectedCasesToImported: 1, transferSelectedCasesToExec: 1,
      refreshAppendExistingButton: 1, refreshExportCaseGenXmindButton: 1,
      setCaseGenDbStoreNewAction: 1, clearCaseGenDbStoreNewActionError: 1,
      openCaseGenDbStoreNewDrawer: 1, openCaseGenDbStoreAppendDrawer: 1,
      handleCaseSelectionChange: 1, handleCaseSelectAll: 1, exportCaseGenerationResults: 1, ensureCaseGenModulesFromSplit: 1, renderCaseGeneration: 1,
      renderAppendTargetOptions: 1,
    }));
    window.app.casesGenApi = casesGenApi;

    function initApp() {
      if (window.app && window.app._inited) return;
      if (!window.app) window.app = {};
      window.app._inited = true;
      function resolveInitialTab() {
        var defaultTab = 'auto';
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
        if (dom.tabButtons && dom.tabButtons.length) {
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
      renderAutoRawInfo();
      renderCleanView();
      renderCleanRawView(null);
      updateAutoClarifyVisibility();
      updateAutoMissingCard();
      syncReviewViewFromResult();
      syncSplitView();
      resetModelForm();
      var initialTab = resolveInitialTab();
      switchTab(initialTab);
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
          handlers: {
            goCasesGenAndScroll: api.goCasesGenAndScroll || goCasesGenAndScroll,
            scrollToSection: scrollToSection,
            switchTab: switchTab,
          },
          dom: dom,
        })
        : null;
      const layoutHandlersModule = window.app.layoutHandlers && typeof window.app.layoutHandlers.init === 'function'
        ? window.app.layoutHandlers.init({
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
      setCaseViewHint('请先上传或输入 XMind 测试用例');
      updateFlowStatus();
      return { casegenHandlersModule: casegenHandlersModule, casegenCoreModule: casegenCoreModule, layoutHandlersModule: layoutHandlersModule };
    }
    window.app = window.app || {};
    window.app.init = initApp;

    renderCaseGenProgressBoard();

    const moduleContext = { state: state, config: window.app.config, utils: appUtils, core: core, tempExecApi: tempExecApi, casesGenApi: casesGenApi };
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
    syncAutoCompareStatus();
    if (window.app.casesgen && typeof window.app.casesgen.init === 'function') {
      window.app.casesgen.init(moduleContext);
    }
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
