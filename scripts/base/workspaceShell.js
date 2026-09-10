(function() {
  window.app = window.app || {};

  var activeTool = '';
  var activeToolTrigger = null;
  var userCloseTimer = 0;
  var toolLabels = {
    memo: '个人备忘'
  };
  var toolNavLabels = {
    memo: '个人备忘'
  };
  var navIcons = {
    casesgen: 'casesgen',
    assign: 'assign',
    models: 'models',
    tempexec: 'tempexec',
    'case-library': 'case-library',
    'case-archive': 'case-archive',
    'exec-overview': 'exec-overview',
    'project-admin': 'project-admin',
    'user-admin': 'user-admin',
    'ops-log': 'ops-log',
    settings: 'settings'
  };
  var navLabels = {
    casesgen: '用例生成',
    assign: '功能指派',
    models: '模型管理',
    tempexec: '用例执行',
    'case-library': '用例库',
    'case-archive': '用例归档',
    'exec-overview': '执行总览',
    'project-admin': '项目管理',
    'user-admin': '人员管理',
    'ops-log': '操作记录',
    settings: '通用设置'
  };

  // 跨页面生成提示只读取现有任务快照；已查看记录仅用于控制提示红点。
  var generationTaskStorageKey = 'tap-xmind-casegen-tasks';
  var generationCaseTaskStoragePrefix = 'tap-case-library-ai-gen-task:';
  var generationNoticeSeenStorageKey = 'tap-casegen-completion-seen-v1';
  var generationStatusTimer = 0;
  var generationStatusBound = false;
  var generationMiniPanel = null;
  var generationMiniExpanded = true;

  function getIcons() {
    return window.app && window.app.workspaceIcons ? window.app.workspaceIcons : null;
  }

  function renderIcon(name, className) {
    var icons = getIcons();
    if (!icons || typeof icons.render !== 'function') return '';
    return icons.render(name, className || '');
  }

  function createElement(tagName, className, html) {
    var el = document.createElement(tagName);
    if (className) el.className = className;
    if (html !== undefined) el.innerHTML = html;
    return el;
  }

  function safeJsonParse(raw, fallback) {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function readGenerationStorage(key, fallback) {
    if (typeof localStorage === 'undefined') return fallback;
    try {
      return safeJsonParse(localStorage.getItem(key) || '', fallback);
    } catch (err) {
      return fallback;
    }
  }

  function isGenerationTaskRunning(task) {
    var status = task && task.status ? String(task.status) : '';
    return ['queued', 'running', 'postprocessing', 'cancel_requested'].indexOf(status) !== -1;
  }

  function isGenerationTaskDone(task) {
    return Boolean(task && String(task.status || '') === 'done');
  }

  function normalizeGenerationPercent(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(100, Math.round(number)));
  }

  function deriveGenerationTaskPercent(task, source) {
    var item = task && typeof task === 'object' ? task : {};
    var status = String(item.status || '');
    if (status === 'done') return 100;
    if (item.preparationPending === true || status === 'queued') return 5;

    var batchTotal = Number(item.modelRequestBatchTotal || 0);
    var batchDone = Number(item.modelRequestBatchCompleted || 0);
    if (batchTotal > 0) {
      return normalizeGenerationPercent(65 + (Math.min(batchDone, batchTotal) / batchTotal) * 30);
    }

    var stage = String(item.pipelineStage || item.pipelineStatus || item.stage || '').toLowerCase();
    var moduleTotal = Number(item.pipelineModuleTotal || item.moduleTaskTotal || 0);
    var moduleDone = Number(item.pipelineModuleDone || item.moduleTaskCompleted || 0);
    if (stage.indexOf('discover') !== -1 || stage === 'discovery') return 20;
    if (stage.indexOf('module') !== -1 || stage === 'modules') {
      if (moduleTotal > 0) {
        return normalizeGenerationPercent(35 + (Math.min(moduleDone, moduleTotal) / moduleTotal) * 50);
      }
      return 55;
    }
    if (stage.indexOf('dedupe') !== -1 || stage.indexOf('去重') !== -1 || item.scope === 'dedupe') return 92;
    if (stage.indexOf('coverage') !== -1 || stage.indexOf('覆盖') !== -1 || item.scope === 'coverage') return 88;
    if (source === 'xmind' && item.scope === 'root') return 35;
    return 50;
  }

  function getGenerationTaskRequirementLabel(entry) {
    var task = entry && entry.task && typeof entry.task === 'object' ? entry.task : {};
    var restoreContext = task.restoreContext && typeof task.restoreContext === 'object'
      ? task.restoreContext
      : {};
    var label = task.requirementLabel || task.requirementName || task.requirementTitle
      || restoreContext.requirementLabel || task.importName || restoreContext.lastRawImportName;
    return label ? String(label).trim() : '';
  }

  function getGenerationTaskLabel(entry, index) {
    var requirementLabel = getGenerationTaskRequirementLabel(entry);
    if (requirementLabel) return requirementLabel;
    var task = entry && entry.task && typeof entry.task === 'object' ? entry.task : {};
    var explicitLabel = task.taskLabel || task.label || task.title || task.name;
    if (explicitLabel) return String(explicitLabel);
    if (entry && entry.source === 'xmind') {
      var scope = String(task.scope || '').toLowerCase();
      if (scope === 'module' && task.moduleTitle) return '模块：' + String(task.moduleTitle);
      if (scope === 'dedupe') return 'AI 用例去重';
      if (scope === 'coverage') return '需求覆盖分析';
      if (task.historyActionLabel || task.actionLabel) {
        return String(task.historyActionLabel || task.actionLabel);
      }
      if (scope === 'root') return '根节点生成';
      return 'XMind 生成任务 ' + String(index + 1);
    }
    if (entry && entry.scene === 'case-library') return '用例库生成';
    if (entry && entry.scene === 'temp-exec') return '临时执行生成';
    return '生成任务 ' + String(index + 1);
  }

  function getGenerationTaskGroupKey(entry) {
    var task = entry && entry.task && typeof entry.task === 'object' ? entry.task : {};
    var restoreContext = task.restoreContext && typeof task.restoreContext === 'object'
      ? task.restoreContext
      : {};
    var tabId = task.workspaceId || task.tabId || task.pageId || restoreContext.workspaceId;
    if (!tabId) tabId = task.rootPipelineId || task.generationId || task.rootPipelineActionId;
    if (tabId) return String(entry && entry.source ? entry.source : 'generation') + ':tab:' + String(tabId);
    if (entry && entry.scene) return String(entry.source || 'generation') + ':scene:' + String(entry.scene);
    return String(entry && entry.source ? entry.source : 'generation') + ':task:' + String(task.id || 'unknown');
  }

  function groupGenerationTasks(entries) {
    var groups = [];
    var groupMap = {};
    (Array.isArray(entries) ? entries : []).forEach(function(entry) {
      var key = getGenerationTaskGroupKey(entry);
      var group = groupMap[key];
      if (!group) {
        group = {
          key: key,
          entry: entry,
          entries: [],
        };
        groupMap[key] = group;
        groups.push(group);
      }
      group.entries.push(entry);
    });
    return groups;
  }

  function getGenerationGroupLabel(group, index) {
    var entries = group && Array.isArray(group.entries) ? group.entries : [];
    var requirementLabel = '';
    entries.some(function(entry) {
      requirementLabel = getGenerationTaskRequirementLabel(entry);
      return Boolean(requirementLabel);
    });
    if (requirementLabel) return requirementLabel;
    return getGenerationTaskLabel(group && group.entry ? group.entry : null, index);
  }

  function deriveGenerationGroupPercent(group) {
    var entries = group && Array.isArray(group.entries) ? group.entries : [];
    var total = entries.reduce(function(sum, entry) {
      return sum + deriveGenerationTaskPercent(entry.task, entry.source);
    }, 0);
    return normalizeGenerationPercent(entries.length ? total / entries.length : 0);
  }

  function collectGenerationTasks() {
    var entries = [];
    var xmindTasks = readGenerationStorage(generationTaskStorageKey, []);
    if (Array.isArray(xmindTasks)) {
      xmindTasks.forEach(function(task) {
        if (!task || !task.id) return;
        entries.push({
          source: 'xmind',
          scene: 'xmind',
          task: task,
          token: 'xmind:xmind:' + String(task.id) + ':' + String(task.endedAt || task.updatedAt || ''),
        });
      });
    }
    ['case-library', 'temp-exec'].forEach(function(scene) {
      var task = readGenerationStorage(generationCaseTaskStoragePrefix + scene, null);
      if (!task || !task.id) return;
      entries.push({
        source: 'case-page',
        scene: scene,
        task: task,
        token: 'case-page:' + scene + ':' + String(task.id) + ':' + String(task.endedAt || task.updatedAt || ''),
      });
    });
    return entries;
  }

  function readGenerationNoticeSeen() {
    var stored = readGenerationStorage(generationNoticeSeenStorageKey, {});
    if (Array.isArray(stored)) {
      var converted = {};
      stored.forEach(function(token) {
        if (token) converted[String(token)] = true;
      });
      return converted;
    }
    return stored && typeof stored === 'object' ? stored : {};
  }

  function writeGenerationNoticeSeen(seen) {
    if (typeof localStorage === 'undefined') return;
    var source = seen && typeof seen === 'object' ? seen : {};
    var keys = Object.keys(source);
    if (keys.length > 240) keys = keys.slice(keys.length - 240);
    var next = {};
    keys.forEach(function(key) { next[key] = true; });
    try {
      localStorage.setItem(generationNoticeSeenStorageKey, JSON.stringify(next));
    } catch (err) {
      // ignore storage quota and privacy errors
    }
  }

  function markGenerationCompletionsSeen(entries) {
    var seen = readGenerationNoticeSeen();
    var changed = false;
    (Array.isArray(entries) ? entries : []).forEach(function(entry) {
      if (!entry || !isGenerationTaskDone(entry.task) || !entry.token || seen[entry.token]) return;
      seen[entry.token] = true;
      changed = true;
    });
    if (changed) writeGenerationNoticeSeen(seen);
    return seen;
  }

  function getUnseenGenerationCompletions(entries, seen) {
    var known = seen && typeof seen === 'object' ? seen : {};
    return (Array.isArray(entries) ? entries : []).filter(function(entry) {
      return Boolean(entry && isGenerationTaskDone(entry.task) && entry.token && !known[entry.token]);
    });
  }

  function getUrlQueryTab() {
    if (typeof window === 'undefined' || !window.location) return '';
    var search = String(window.location.search || '').replace(/^\?/, '');
    if (!search) return '';
    var result = '';
    search.split('&').some(function(pair) {
      var parts = pair.split('=');
      var key = '';
      try { key = decodeURIComponent(parts.shift() || ''); } catch (err) { key = ''; }
      if (key !== 'tab') return false;
      try { result = decodeURIComponent(parts.join('=') || ''); } catch (err2) { result = ''; }
      return true;
    });
    return result;
  }

  function isXmindCasegenHome() {
    var body = document && document.body ? document.body : null;
    var page = body && body.dataset ? String(body.dataset.page || '') : '';
    if (page !== 'ai-workflow') return false;
    var queryTab = getUrlQueryTab();
    if (queryTab && queryTab !== 'casesgen' && queryTab !== 'xmind-casegen') return false;
    var app = window.app || {};
    var state = app.state || {};
    if (app.__tapWorkflowReady === true && state.activeTab && String(state.activeTab) !== 'casesgen') {
      return false;
    }
    return true;
  }

  function getGenerationNavButton() {
    return document.querySelector('[data-tab-btn="casesgen"]');
  }

  function syncGenerationNavNotice(visible) {
    var button = getGenerationNavButton();
    if (!button || !button.classList) return false;
    var nextVisible = visible === true;
    var changed = button.classList.contains('has-generation-notice') !== nextVisible;
    button.classList.toggle('has-generation-notice', nextVisible);
    var label = navLabels.casesgen;
    var accessible = nextVisible ? label + '，有新的生成结果' : label;
    button.setAttribute('aria-label', accessible);
    button.setAttribute('title', accessible);
    return changed;
  }

  function navigateToGenerationHome() {
    var entries = collectGenerationTasks();
    markGenerationCompletionsSeen(entries);
    syncGenerationNavNotice(false);
    try {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('casesgen');
        return;
      }
    } catch (err) {
      // fall through to the direct page URL
    }
    try {
      window.location.href = './ai-workflow.html?tab=casesgen';
    } catch (err2) {
      // ignore
    }
  }

  function setGenerationMiniExpanded(expanded) {
    generationMiniExpanded = expanded !== false;
    if (!generationMiniPanel) return;
    generationMiniPanel.classList.toggle('is-collapsed', generationMiniExpanded !== true);
    var toggle = generationMiniPanel.querySelector('[data-generation-mini-toggle]');
    if (toggle) {
      toggle.setAttribute('aria-expanded', generationMiniExpanded ? 'true' : 'false');
      toggle.setAttribute('aria-label', generationMiniExpanded ? '收起生成进度' : '展开生成进度');
      toggle.setAttribute('title', generationMiniExpanded ? '收起' : '展开');
      toggle.innerHTML = generationMiniExpanded ? '−' : '+';
    }
    var currentTitleEl = generationMiniPanel.querySelector('.workspace-generation-mini-title');
    var currentTitle = currentTitleEl ? String(currentTitleEl.textContent || '') : '当前生成任务数量';
    generationMiniPanel.setAttribute('aria-label', generationMiniExpanded
      ? currentTitle
      : '生成任务中...');
  }

  function ensureGenerationMiniPanel() {
    if (generationMiniPanel && generationMiniPanel.parentNode) return generationMiniPanel;
    var panel = document.createElement('section');
    panel.id = 'workspaceGenerationMini';
    panel.className = 'workspace-generation-mini is-collapsed';
    panel.setAttribute('aria-label', '当前生成任务进度');
    panel.innerHTML =
      '<div class="workspace-generation-mini-head">' +
        '<button type="button" class="workspace-generation-mini-main" data-generation-mini-main>' +
          '<span class="workspace-generation-mini-title">当前生成任务数量：1</span>' +
          '<span class="workspace-generation-mini-collapsed-label">生成任务中...</span>' +
        '</button>' +
        '<button type="button" class="workspace-generation-mini-toggle" data-generation-mini-toggle aria-expanded="false" aria-label="展开生成进度" title="展开">+</button>' +
      '</div>' +
      '<div class="workspace-generation-mini-body">' +
        '<div class="workspace-generation-mini-list" data-generation-mini-list aria-live="polite"></div>' +
      '</div>';
    document.body.appendChild(panel);
    generationMiniPanel = panel;
    var main = panel.querySelector('[data-generation-mini-main]');
    var toggle = panel.querySelector('[data-generation-mini-toggle]');
    if (main) main.addEventListener('click', navigateToGenerationHome);
    if (toggle) {
      toggle.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        setGenerationMiniExpanded(!generationMiniExpanded);
      });
    }
    setGenerationMiniExpanded(true);
    return panel;
  }

  function renderGenerationStatus() {
    var entries = collectGenerationTasks();
    var running = entries.filter(function(entry) { return isGenerationTaskRunning(entry.task); });
    var groups = groupGenerationTasks(running);
    var onXmindHome = isXmindCasegenHome();
    var seen = readGenerationNoticeSeen();
    if (onXmindHome) {
      seen = markGenerationCompletionsSeen(entries);
    }
    var hasNotice = !onXmindHome && getUnseenGenerationCompletions(entries, seen).length > 0;
    syncGenerationNavNotice(hasNotice);

    var panel = ensureGenerationMiniPanel();
    var shouldShowMini = !onXmindHome && running.length > 0;
    panel.classList.toggle('is-visible', shouldShowMini);
    if (!shouldShowMini) return;
    var titleEl = panel.querySelector('.workspace-generation-mini-title');
    if (titleEl) titleEl.textContent = '当前生成任务数量：' + String(groups.length);
    var listEl = panel.querySelector('[data-generation-mini-list]');
    if (listEl) {
      listEl.textContent = '';
      groups.forEach(function(group, index) {
        var taskPercent = deriveGenerationGroupPercent(group);
        var taskId = String(group.entry && group.entry.task && group.entry.task.id ? group.entry.task.id : '');
        var taskItem = createElement('div', 'workspace-generation-mini-task');
        taskItem.setAttribute('data-generation-mini-task', '');
        taskItem.setAttribute('data-generation-mini-group-key', group.key);
        if (taskId) taskItem.setAttribute('data-generation-mini-task-id', taskId);
        var taskHead = createElement('div', 'workspace-generation-mini-task-head');
        var taskTitle = createElement('span', 'workspace-generation-mini-task-title');
        taskTitle.textContent = getGenerationGroupLabel(group, index);
        taskTitle.title = taskTitle.textContent;
        var taskPercentEl = createElement('span', 'workspace-generation-mini-task-percent');
        taskPercentEl.setAttribute('data-generation-mini-task-percent', '');
        taskPercentEl.textContent = String(taskPercent) + '%';
        taskHead.appendChild(taskTitle);
        taskHead.appendChild(taskPercentEl);
        var taskTrack = createElement('div', 'workspace-generation-mini-task-track');
        taskTrack.setAttribute('role', 'progressbar');
        taskTrack.setAttribute('aria-label', taskTitle.textContent + '进度');
        taskTrack.setAttribute('aria-valuemin', '0');
        taskTrack.setAttribute('aria-valuemax', '100');
        taskTrack.setAttribute('aria-valuenow', String(taskPercent));
        taskTrack.setAttribute('aria-valuetext', String(taskPercent) + '%');
        taskTrack.setAttribute('data-generation-mini-task-track', '');
        var taskFill = createElement('span');
        taskFill.setAttribute('data-generation-mini-task-fill', '');
        taskFill.style.width = String(taskPercent) + '%';
        taskTrack.appendChild(taskFill);
        taskItem.appendChild(taskHead);
        taskItem.appendChild(taskTrack);
        listEl.appendChild(taskItem);
      });
    }
    panel.setAttribute('aria-label', generationMiniExpanded
      ? '当前生成任务数量：' + String(groups.length)
      : '生成任务中...');
  }

  function bindGenerationStatus() {
    if (generationStatusBound) return;
    generationStatusBound = true;
    var refresh = function() { renderGenerationStatus(); };
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('storage', function(event) {
        var key = event && event.key ? String(event.key) : '';
        if (key === generationTaskStorageKey || key.indexOf(generationCaseTaskStoragePrefix) === 0 || key === generationNoticeSeenStorageKey) {
          refresh();
        }
      });
      window.addEventListener('xmind-casegen-task', refresh);
      window.addEventListener('case-library-ai-gen-task', refresh);
      window.addEventListener('app-tab-activated', refresh);
      window.addEventListener('pageshow', refresh);
      window.addEventListener('focus', refresh);
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', function() {
          if (document.visibilityState !== 'hidden') refresh();
        });
      }
    }
    var navButton = getGenerationNavButton();
    if (navButton) {
      navButton.addEventListener('click', function() {
        markGenerationCompletionsSeen(collectGenerationTasks());
        syncGenerationNavNotice(false);
      });
    }
    renderGenerationStatus();
    if (!generationStatusTimer && typeof window !== 'undefined' && typeof window.setInterval === 'function') {
      generationStatusTimer = window.setInterval(refresh, 1000);
    }
  }

  function blockCategoryActivation(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function clearCategoryInteractionState(button) {
    if (!button || !button.classList) return;
    if (button.classList.contains('active')) button.classList.remove('active');
    if (button.classList.contains('hovering')) button.classList.remove('hovering');
  }

  function keepCategoriesPassive(nav) {
    var buttons = nav.querySelectorAll('.tab-group-btn');
    Array.prototype.forEach.call(buttons, clearCategoryInteractionState);
    if (typeof MutationObserver !== 'function') return;

    var observer = new MutationObserver(function(records) {
      Array.prototype.forEach.call(records, function(record) {
        var button = record.target;
        if (!button || !button.dataset || button.dataset.workspaceCategory !== '1') return;
        clearCategoryInteractionState(button);
      });
    });
    observer.observe(nav, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true
    });
  }

  function decorateBrand(sidebar) {
    var header = sidebar.querySelector('.sidebar-header');
    var title = header ? header.querySelector('h1') : null;
    if (!header || !title || title.dataset.workspaceReady === '1') return;
    title.dataset.workspaceReady = '1';
    title.setAttribute('aria-label', '用例助手');
    title.innerHTML =
      '<span class="workspace-brand-mark" aria-hidden="true"><span class="workspace-brand-letter">T</span></span>' +
      '<span class="workspace-brand-copy"><span class="workspace-brand-title">用例助手</span><span class="workspace-brand-subtitle">TEST ASSISTANT</span></span>';
  }

  function syncNavigationNotice(button) {
    if (!button || !button.dataset) return;
    var tabName = button.dataset.tabBtn || '';
    var labelElement = button.querySelector('.workspace-nav-label');
    var label = navLabels[tabName] || (labelElement ? String(labelElement.textContent || '').trim() : '');
    var notice = button.querySelector('.tab-notice');
    var noticeText = notice ? String(notice.textContent || '').trim() : '';
    var accessibleLabel = noticeText ? label + '，' + noticeText : label;
    if (notice) {
      notice.setAttribute('aria-hidden', 'true');
      notice.setAttribute('title', noticeText);
    }
    if (accessibleLabel) {
      button.setAttribute('aria-label', accessibleLabel);
      button.setAttribute('title', accessibleLabel);
    }
  }

  function watchNavigationNotices(nav) {
    if (!nav || nav.dataset.workspaceNoticeObserver === '1') return;
    nav.dataset.workspaceNoticeObserver = '1';
    Array.prototype.forEach.call(nav.querySelectorAll('[data-tab-btn]'), syncNavigationNotice);
    if (typeof MutationObserver !== 'function') return;

    var observer = new MutationObserver(function() {
      Array.prototype.forEach.call(nav.querySelectorAll('[data-tab-btn]'), syncNavigationNotice);
    });
    observer.observe(nav, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  function decorateNavigation(sidebar) {
    var nav = sidebar.querySelector('nav.tabs.vertical');
    if (!nav) return;
    nav.classList.add('workspace-nav');

    Array.prototype.forEach.call(nav.querySelectorAll('.tab-group'), function(group) {
      group.classList.add('workspace-nav-group');
      var groupButton = group.querySelector('.tab-group-btn');
      if (groupButton) {
        groupButton.setAttribute('tabindex', '-1');
        groupButton.setAttribute('role', 'heading');
        groupButton.setAttribute('aria-level', '2');
        groupButton.dataset.workspaceCategory = '1';
        groupButton.addEventListener('click', blockCategoryActivation, true);
      }
      var submenu = group.querySelector('.tab-submenu');
      if (submenu) submenu.classList.add('workspace-nav-list');
    });

    Array.prototype.forEach.call(nav.querySelectorAll('[data-tab-btn]'), function(button) {
      if (button.dataset && button.dataset.workspaceNavReady === '1') return;
      var tabName = button.dataset ? button.dataset.tabBtn : '';
      var iconName = navIcons[tabName] || 'brand';
      var label = navLabels[tabName] || String(button.textContent || '').trim();
      var icon = createElement('span', 'workspace-nav-icon', renderIcon(iconName));
      var labelElement = createElement('span', 'workspace-nav-label');
      labelElement.textContent = label;
      button.textContent = '';
      button.appendChild(icon);
      button.appendChild(labelElement);
      if (button.dataset) button.dataset.workspaceNavReady = '1';
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    });

    keepCategoriesPassive(nav);
    watchNavigationNotices(nav);
  }

  function selectToolPanel(toolId) {
    var tabBar = document.getElementById('sidebarTabBar');
    var panels = document.getElementById('sidebarTabPanels');
    if (tabBar) {
      Array.prototype.forEach.call(tabBar.querySelectorAll('[data-sidebar-tab]'), function(button) {
        var selected = button.dataset && button.dataset.sidebarTab === toolId;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
      });
    }
    if (panels) {
      Array.prototype.forEach.call(panels.querySelectorAll('[data-sidebar-panel]'), function(panel) {
        var selected = panel.dataset && panel.dataset.sidebarPanel === toolId;
        panel.classList.toggle('is-active', selected);
      });
    }
  }

  function syncToolTriggerState(open) {
    var tabBar = document.getElementById('sidebarTabBar');
    if (!tabBar) return;
    Array.prototype.forEach.call(tabBar.querySelectorAll('[data-sidebar-tab]'), function(button) {
      var expanded = open && button.dataset && button.dataset.sidebarTab === activeTool;
      button.classList.toggle('is-drawer-open', Boolean(expanded));
      button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  function closeUserCard() {
    var menu = document.getElementById('userMenu');
    var toggle = document.getElementById('userMenuToggle');
    if (userCloseTimer) {
      window.clearTimeout(userCloseTimer);
      userCloseTimer = 0;
    }
    if (menu) menu.classList.remove('menu-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  function closeToolDrawer(options) {
    var overlay = document.getElementById('workspaceToolOverlay');
    if (!overlay || !overlay.classList.contains('is-open')) return false;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('workspace-tool-open');
    syncToolTriggerState(false);
    var restoreFocus = !options || options.restoreFocus !== false;
    var trigger = activeToolTrigger;
    activeTool = '';
    activeToolTrigger = null;
    if (restoreFocus && trigger && typeof trigger.focus === 'function') {
      try { trigger.focus(); } catch (err) { /* ignore */ }
    }
    return true;
  }

  function openToolDrawer(toolId, trigger) {
    var normalized = toolId ? String(toolId) : '';
    var overlay = document.getElementById('workspaceToolOverlay');
    if (!overlay || !toolLabels[normalized]) return false;
    activeTool = normalized;
    activeToolTrigger = trigger || document.querySelector('[data-sidebar-tab="' + normalized + '"]');
    selectToolPanel(normalized);
    var title = document.getElementById('workspaceToolDrawerTitle');
    if (title) title.textContent = toolLabels[normalized];
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('workspace-tool-open');
    syncToolTriggerState(true);
    closeUserCard();
    return true;
  }

  function setupToolDrawer(sidebar) {
    var tabs = document.getElementById('sidebarTabs');
    var tabBar = document.getElementById('sidebarTabBar');
    var panels = document.getElementById('sidebarTabPanels');
    if (!tabs || !tabBar || !panels || document.getElementById('workspaceToolOverlay')) return;

    tabs.classList.add('workspace-tools');
    tabBar.setAttribute('aria-label', '个人工具');
    Array.prototype.forEach.call(tabBar.querySelectorAll('[data-sidebar-tab]'), function(button) {
      var toolId = button.dataset ? button.dataset.sidebarTab : '';
      var dot = button.querySelector('.sidebar-tab-dot');
      var iconName = toolId === 'memo' ? 'memo' : 'progress';
      button.textContent = '';
      button.insertAdjacentHTML('beforeend', renderIcon(iconName, 'workspace-tool-icon'));
      var label = createElement('span', 'workspace-tool-label');
      label.textContent = toolNavLabels[toolId] || toolLabels[toolId] || toolId;
      button.appendChild(label);
      if (dot) button.appendChild(dot);
      button.setAttribute('title', toolLabels[toolId] || toolId);
      button.setAttribute('aria-controls', 'workspaceToolDrawer');
      button.setAttribute('aria-expanded', 'false');
    });

    var overlay = createElement('div', 'workspace-tool-overlay');
    overlay.id = 'workspaceToolOverlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<button class="workspace-tool-mask" type="button" aria-label="关闭工具面板"></button>' +
      '<aside class="workspace-tool-drawer" id="workspaceToolDrawer" role="dialog" aria-modal="true" aria-labelledby="workspaceToolDrawerTitle">' +
        '<div class="workspace-tool-drawer-header">' +
          '<div><span class="workspace-tool-eyebrow">个人工具</span><h2 id="workspaceToolDrawerTitle">个人备忘</h2></div>' +
          '<button class="workspace-icon-button" id="workspaceToolDrawerClose" type="button" aria-label="关闭工具面板" title="关闭">' + renderIcon('close') + '</button>' +
        '</div>' +
        '<div class="workspace-tool-drawer-body"></div>' +
      '</aside>';
    document.body.appendChild(overlay);
    var body = overlay.querySelector('.workspace-tool-drawer-body');
    if (body) body.appendChild(panels);

    tabBar.addEventListener('click', function(event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-sidebar-tab]') : null;
      if (!button || !button.dataset) return;
      var toolId = button.dataset.sidebarTab || '';
      if (overlay.classList.contains('is-open') && activeTool === toolId) {
        closeToolDrawer();
        return;
      }
      openToolDrawer(toolId, button);
    });

    var mask = overlay.querySelector('.workspace-tool-mask');
    var closeButton = document.getElementById('workspaceToolDrawerClose');
    if (mask) mask.addEventListener('click', function() { closeToolDrawer(); });
    if (closeButton) closeButton.addEventListener('click', function() { closeToolDrawer(); });

    overlay.addEventListener('click', function(event) {
      var progressItem = event.target && event.target.closest ? event.target.closest('[data-casegen-workspace]') : null;
      if (progressItem) {
        window.setTimeout(function() { closeToolDrawer({ restoreFocus: false }); }, 0);
      }
    });
  }

  function updateUserCard() {
    var username = document.getElementById('currentUsername');
    var name = username ? String(username.textContent || '').trim() : '';
    var initial = name && name !== '未登录' ? name.slice(0, 1) : '访';
    var avatar = document.querySelector('#userMenuToggle .workspace-user-avatar');
    var cardAvatar = document.querySelector('#userMenu .workspace-user-card-avatar');
    var cardName = document.querySelector('#userMenu .workspace-user-card-name');
    if (avatar) avatar.textContent = initial;
    if (cardAvatar) cardAvatar.textContent = initial;
    if (cardName) cardName.textContent = name || '未登录';
  }

  function openUserCard() {
    var menu = document.getElementById('userMenu');
    var toggle = document.getElementById('userMenuToggle');
    if (userCloseTimer) {
      window.clearTimeout(userCloseTimer);
      userCloseTimer = 0;
    }
    if (menu) menu.classList.add('menu-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
  }

  function queueUserCardClose() {
    if (userCloseTimer) window.clearTimeout(userCloseTimer);
    userCloseTimer = window.setTimeout(function() {
      closeUserCard();
    }, 220);
  }

  function navigateToSettings() {
    closeUserCard();
    if (window.app && typeof window.app.switchTab === 'function') {
      window.app.switchTab('settings');
      return;
    }
    window.location.href = './settings.html?tab=settings';
  }

  function setupUserArea(sidebar) {
    var banner = document.getElementById('userBanner');
    var toggle = document.getElementById('userMenuToggle');
    var menu = document.getElementById('userMenu');
    var username = document.getElementById('currentUsername');
    var role = document.getElementById('currentUserRole');
    var logout = document.getElementById('logoutBtn');
    if (!banner || !toggle || !menu || !username || !logout) return;

    banner.classList.add('workspace-user-area');
    var prefix = banner.querySelector('.user-prefix');
    if (prefix) prefix.classList.add('workspace-visually-hidden');

    toggle.classList.add('workspace-user-trigger');
    toggle.innerHTML = '<span class="workspace-user-avatar">访</span>';
    toggle.setAttribute('title', '用户菜单');
    toggle.setAttribute('aria-haspopup', 'menu');
    toggle.setAttribute('aria-expanded', 'false');

    var summary = createElement('span', 'workspace-user-summary');
    summary.appendChild(username);
    banner.insertBefore(summary, menu);
    banner.insertBefore(toggle, summary);

    menu.classList.add('workspace-user-card');
    menu.setAttribute('role', 'menu');
    var profile = createElement('div', 'workspace-user-card-profile');
    profile.innerHTML =
      '<span class="workspace-user-card-avatar">访</span>' +
      '<span class="workspace-user-card-copy"><strong class="workspace-user-card-name">未登录</strong><span class="workspace-user-card-role-label">角色</span></span>';
    if (role) {
      role.classList.add('workspace-user-card-role');
      var copy = profile.querySelector('.workspace-user-card-copy');
      if (copy) copy.appendChild(role);
    }
    menu.insertBefore(profile, menu.firstChild);

    var settingsButton = createElement('button', 'workspace-user-action');
    settingsButton.id = 'workspaceUserSettingsBtn';
    settingsButton.type = 'button';
    settingsButton.setAttribute('role', 'menuitem');
    settingsButton.innerHTML = renderIcon('settings') + '<span>通用设置</span>';
    menu.insertBefore(settingsButton, logout);
    settingsButton.addEventListener('click', navigateToSettings);

    logout.classList.add('workspace-user-action', 'workspace-user-logout');
    logout.setAttribute('role', 'menuitem');
    logout.innerHTML = renderIcon('logout') + '<span>退出登录</span>';

    sidebar.appendChild(banner);

    toggle.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (document.body && document.body.classList.contains('drawer-open')) {
        closeUserCard();
        return;
      }
      openUserCard();
    });
    banner.addEventListener('mouseenter', openUserCard);
    banner.addEventListener('mouseleave', queueUserCardClose);
    banner.addEventListener('focusin', openUserCard);
    banner.addEventListener('focusout', function(event) {
      var next = event.relatedTarget;
      if (next && banner.contains(next)) return;
      queueUserCardClose();
    });
    banner.addEventListener('keydown', function(event) {
      if (event.key !== 'Escape') return;
      closeUserCard();
      try { toggle.focus(); } catch (err) { /* ignore */ }
    });

    var observer = new MutationObserver(updateUserCard);
    observer.observe(username, { childList: true, characterData: true, subtree: true });
    if (role) observer.observe(role, { childList: true, characterData: true, subtree: true });
    var menuObserver = new MutationObserver(function() {
      toggle.setAttribute('aria-expanded', menu.classList.contains('menu-open') ? 'true' : 'false');
    });
    menuObserver.observe(menu, { attributes: true, attributeFilter: ['class'] });
    updateUserCard();
  }

  function setWorkspaceSectionNavCollapsed(sectionNav, toggle, collapsed) {
    var isCollapsed = Boolean(collapsed);
    var label = isCollapsed ? '展开快捷导航' : '收起快捷导航';
    var expandedHost = sectionNav.querySelector('.workspace-section-nav-header');
    var collapsedHostId = toggle.getAttribute('data-collapsed-host') || '';
    var collapsedHost = collapsedHostId ? document.getElementById(collapsedHostId) : null;
    var targetHost = isCollapsed ? collapsedHost : expandedHost;
    var restoreFocus = document.activeElement === toggle;
    if (targetHost && toggle.parentNode !== targetHost) targetHost.appendChild(toggle);
    sectionNav.classList.toggle('is-collapsed', isCollapsed);
    toggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
    toggle.innerHTML = renderIcon(isCollapsed ? 'panel-left-open' : 'panel-left-close');
    if (restoreFocus && typeof toggle.focus === 'function') {
      try { toggle.focus({ preventScroll: true }); } catch (err) { toggle.focus(); }
    }
  }

  function setupWorkspaceSectionNav() {
    var sectionNavs = document.querySelectorAll('.workspace-section-nav');
    Array.prototype.forEach.call(sectionNavs, function(sectionNav) {
      var toggle = sectionNav.querySelector('.workspace-section-nav-toggle');
      if (!toggle || toggle.dataset.workspaceReady === '1') return;
      toggle.dataset.workspaceReady = '1';
      setWorkspaceSectionNavCollapsed(sectionNav, toggle, false);
      toggle.addEventListener('click', function() {
        setWorkspaceSectionNavCollapsed(sectionNav, toggle, !sectionNav.classList.contains('is-collapsed'));
      });
    });
  }

  function bindGlobalEvents() {
    document.addEventListener('click', function(event) {
      var banner = document.getElementById('userBanner');
      if (banner && event.target && banner.contains(event.target)) return;
      closeUserCard();
    });
    document.addEventListener('keydown', function(event) {
      if (event.key !== 'Escape') return;
      if (closeToolDrawer()) {
        event.preventDefault();
        return;
      }
      closeUserCard();
    });
  }

  function init() {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar || sidebar.dataset.workspaceReady === '1') return false;
    sidebar.dataset.workspaceReady = '1';
    document.documentElement.classList.add('workspace-shell-enabled');
    document.body.classList.add('workspace-shell-body');
    decorateBrand(sidebar);
    decorateNavigation(sidebar);
    bindGenerationStatus();
    setupToolDrawer(sidebar);
    setupUserArea(sidebar);
    setupWorkspaceSectionNav();
    bindGlobalEvents();
    return true;
  }

  window.app.workspaceShell = {
    init: init,
    openToolDrawer: openToolDrawer,
    closeToolDrawer: closeToolDrawer,
    openUserCard: openUserCard,
    closeUserCard: closeUserCard,
    isToolDrawerOpen: function() {
      var overlay = document.getElementById('workspaceToolOverlay');
      return Boolean(overlay && overlay.classList.contains('is-open'));
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
