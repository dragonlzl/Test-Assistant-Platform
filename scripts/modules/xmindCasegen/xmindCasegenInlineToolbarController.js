(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenInlineToolbarController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function defaultEscapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var state = opts.state || {};
    var xmindGenApi = opts.xmindGenApi || {};
    var toolbarEl = opts.toolbarEl || null;
    var summaryBtn = opts.summaryBtn || null;
    var historyBtn = opts.historyBtn || null;
    var knowledgeRuleBtn = opts.knowledgeRuleBtn || null;
    var knowledgeAiBtn = opts.knowledgeAiBtn || null;
    var dedupeBtn = opts.dedupeBtn || null;
    var coverageBtn = opts.coverageBtn || null;
    var storeBtn = opts.storeBtn || null;
    var interruptBtn = opts.interruptBtn || null;
    var deleteUndoBtn = opts.deleteUndoBtn || null;
    var deleteRedoBtn = opts.deleteRedoBtn || null;
    var exportBtn = opts.exportBtn || null;
    var exportMarkdownBtn = opts.exportMarkdownBtn || null;
    var statusEl = opts.statusEl || null;
    var mindContainer = opts.mindContainer || null;
    var documentObj = opts.documentObj || (typeof document !== 'undefined' ? document : null);
    var dedupeActionId = String(opts.dedupeActionId || 'xmind-ai-dedupe');

    var escapeHtml = port('escapeHtml', defaultEscapeHtml);
    var getViewState = port('getViewState', function() { return {}; });
    var ensureDedupeUiState = port('ensureDedupeUiState', function() { return {}; });
    var ensureCoverageUiState = port('ensureCoverageUiState', function() { return {}; });
    var buildVisibleModuleContext = port('buildVisibleModuleContext', function() { return { list: [] }; });
    var getVisibleCasesForModuleEntry = port('getVisibleCasesForModuleEntry', function() { return []; });
    var collectRunningGenerationOperations = port('collectRunningGenerationOperations', function() { return []; });
    var getRootPipelineState = port('getRootPipelineState', function() { return null; });
    var getDedupeModeFromSettings = port('getDedupeModeFromSettings', function() { return 'dedupe_only'; });
    var normalizeDedupeMode = port('normalizeDedupeMode', function(value) { return value || 'dedupe_only'; });
    var getDedupeModeActionText = port('getDedupeModeActionText', function() { return '去重'; });
    var getDedupeRunningLabel = port('getDedupeRunningLabel', function() { return 'AI用例去重中'; });
    var getDedupeRunningHint = port('getDedupeRunningHint', function() { return '去重进行中'; });
    var hasAnyRunningGenerationOperation = port('hasAnyRunningGenerationOperation', function() { return false; });
    var hasVisibleAiCasesForDedupe = port('hasVisibleAiCasesForDedupe', function() { return false; });
    var hasActiveWorkspace = port('hasActiveWorkspace', function() { return false; });
    var getSelectedRequirementSource = port('getSelectedRequirementSource', function() { return {}; });
    var isCoverageDialogOpen = port('isCoverageDialogOpen', function() { return false; });
    var isManualDedupeConfirming = port('isManualDedupeConfirming', function() { return false; });
    var syncDeleteHistoryButtons = port('syncDeleteHistoryButtons');
    var syncKnowledgeBaseToolbarState = port('syncKnowledgeBaseToolbarState');
    var syncHistoryButtonState = port('syncHistoryButtonState');
    var persistXmindState = port('persistXmindState');
    var persistWorkflowStateNow = port('persistWorkflowStateNow');
    var notifySuccessToast = port('notifySuccessToast');
    var now = port('now', function() { return Date.now(); });

    var inlinePrimaryHost = null;
    var inlineOverviewHost = null;
    var inlineControlsHost = null;
    var inlineStatusHost = null;
    var inlineModelHost = null;
    var toolbarCollapseBtn = null;
    var inlineGroupHosts = {};

    function getToolbarActionsBank() {
      if (!toolbarEl || !toolbarEl.querySelector) return null;
      return toolbarEl.querySelector('.xmind-casegen-actions');
    }

    function getInlineControlButtons() {
      return [
        summaryBtn,
        historyBtn,
        knowledgeRuleBtn,
        knowledgeAiBtn,
        dedupeBtn,
        coverageBtn,
        storeBtn,
        interruptBtn,
        deleteUndoBtn,
        deleteRedoBtn,
        exportBtn,
        exportMarkdownBtn,
      ].filter(Boolean);
    }

    function restoreInlineControlsToBank() {
      var bankEl = getToolbarActionsBank();
      if (bankEl && bankEl.appendChild) {
        getInlineControlButtons().forEach(function(btn) {
          if (!btn || btn.parentNode === bankEl) return;
          bankEl.appendChild(btn);
        });
      }
      if (toolbarEl && statusEl && statusEl.parentNode !== toolbarEl && toolbarEl.appendChild) {
        toolbarEl.appendChild(statusEl);
      }
      if (inlineStatusHost && inlineStatusHost.parentNode) {
        inlineStatusHost.parentNode.removeChild(inlineStatusHost);
      }
      if (inlineOverviewHost && inlineOverviewHost.parentNode) {
        inlineOverviewHost.parentNode.removeChild(inlineOverviewHost);
      }
      Object.keys(inlineGroupHosts).forEach(function(key) {
        var host = inlineGroupHosts[key];
        if (host && host.parentNode) host.parentNode.removeChild(host);
      });
      if (inlineModelHost && inlineModelHost.parentNode) {
        inlineModelHost.parentNode.removeChild(inlineModelHost);
      }
      if (toolbarCollapseBtn && toolbarCollapseBtn.parentNode) {
        toolbarCollapseBtn.parentNode.removeChild(toolbarCollapseBtn);
      }
      inlinePrimaryHost = null;
      inlineOverviewHost = null;
      inlineControlsHost = null;
      inlineStatusHost = null;
      inlineModelHost = null;
      toolbarCollapseBtn = null;
      inlineGroupHosts = {};
    }

    function getMindControlsRoot() {
      if (!mindContainer || !mindContainer.querySelector) return null;
      return mindContainer.querySelector('[data-mind-controls]');
    }

    function getInlinePrimaryHost() {
      var controlsRoot = getMindControlsRoot();
      if (!controlsRoot || !controlsRoot.querySelector) return null;
      var host = controlsRoot.querySelector('[data-mind-leading-host]');
      if (!host) {
        var searchGroup = controlsRoot.querySelector('.xmind-search-group');
        if (!searchGroup || !documentObj) return null;
        host = documentObj.createElement('div');
        host.className = 'xmind-controls-leading-host';
        host.setAttribute('data-mind-leading-host', '1');
        if (searchGroup.parentNode && searchGroup.parentNode.insertBefore) {
          searchGroup.parentNode.insertBefore(host, searchGroup);
        }
      }
      inlinePrimaryHost = host;
      return host;
    }

    function getInlineControlsHost() {
      var controlsRoot = getMindControlsRoot();
      if (!controlsRoot || !controlsRoot.querySelector) return null;
      var host = controlsRoot.querySelector('[data-mind-utility-host]');
      if (!host) {
        var searchGroup = controlsRoot.querySelector('.xmind-search-group');
        if (!searchGroup || !searchGroup.parentNode || !searchGroup.parentNode.insertBefore || !documentObj) return null;
        host = documentObj.createElement('div');
        host.className = 'xmind-controls-utility-host';
        host.setAttribute('data-mind-utility-host', '1');
        searchGroup.parentNode.insertBefore(host, searchGroup);
      }
      inlineControlsHost = host;
      return host;
    }

    function getInlineOverviewHost() {
      if (inlineOverviewHost && inlineOverviewHost.parentNode) return inlineOverviewHost;
      var primaryHost = getInlinePrimaryHost();
      if (!primaryHost || !documentObj) return null;
      var host = primaryHost.querySelector('[data-xmind-casegen-inline-overview]');
      if (!host) {
        host = documentObj.createElement('div');
        host.className = 'xmind-casegen-inline-overview';
        host.setAttribute('data-xmind-casegen-inline-overview', '1');
      }
      if (host.parentNode !== primaryHost && primaryHost.appendChild) primaryHost.appendChild(host);
      inlineOverviewHost = host;
      return host;
    }

    function getInlineGroupHost(groupName) {
      var key = groupName ? String(groupName || '') : '';
      if (!key) return null;
      if (inlineGroupHosts[key] && inlineGroupHosts[key].parentNode) return inlineGroupHosts[key];
      var controlsHost = getInlineControlsHost();
      if (!controlsHost || !documentObj) return null;
      var selector = '[data-xmind-casegen-inline-group="' + key + '"]';
      var host = controlsHost.querySelector(selector);
      if (!host) {
        host = documentObj.createElement('div');
        host.className = 'xmind-casegen-inline-group xmind-casegen-inline-group-' + key;
        host.setAttribute('data-xmind-casegen-inline-group', key);
        controlsHost.appendChild(host);
      }
      inlineGroupHosts[key] = host;
      return host;
    }

    function getInlineStatusHost() {
      var groupHost = getInlineGroupHost('task');
      if (!groupHost || !documentObj) return null;
      var host = groupHost.querySelector('[data-xmind-casegen-inline-status]');
      if (!host) {
        host = documentObj.createElement('div');
        host.className = 'xmind-casegen-inline-status';
        host.setAttribute('data-xmind-casegen-inline-status', '1');
        groupHost.appendChild(host);
      }
      inlineStatusHost = host;
      return host;
    }

    function getInlineModelHost() {
      var controlsRoot = getMindControlsRoot();
      if (!controlsRoot || !controlsRoot.querySelector || !documentObj) return null;
      var zoomGroup = controlsRoot.querySelector('.xmind-zoom-group');
      if (!zoomGroup) return null;
      var exportActionBtn = controlsRoot.querySelector('[data-mind-action="export-xmind"]');
      if (exportActionBtn && exportActionBtn.classList) {
        exportActionBtn.classList.add('xmind-casegen-default-export-hidden');
        exportActionBtn.setAttribute('aria-hidden', 'true');
        exportActionBtn.tabIndex = -1;
      }
      var host = controlsRoot.querySelector('[data-xmind-casegen-model-host]');
      if (!host) {
        host = documentObj.createElement('label');
        host.className = 'xmind-casegen-model-picker';
        host.setAttribute('data-xmind-casegen-model-host', '1');
      }
      if (host.parentNode !== zoomGroup && zoomGroup.appendChild) zoomGroup.appendChild(host);
      inlineModelHost = host;
      return host;
    }

    function getAvailableXmindModels() {
      return (Array.isArray(state && state.models) ? state.models : []).filter(function(item) {
        return Boolean(item && item.id);
      });
    }

    function syncInlineModelPicker() {
      var host = getInlineModelHost();
      if (!host) return false;
      var modelList = getAvailableXmindModels();
      var assignedId = state && state.assignments && state.assignments.xmindCaseGenId
        ? String(state.assignments.xmindCaseGenId || '')
        : '';
      var hasAssigned = false;
      var optionsHtml = modelList.map(function(item) {
        var id = String(item.id || '');
        var selected = id === assignedId;
        if (selected) hasAssigned = true;
        return '<option value="' + escapeHtml(id) + '"' + (selected ? ' selected' : '') + '>'
          + escapeHtml(item.name || id)
          + '</option>';
      }).join('');
      if (!hasAssigned) optionsHtml = '<option value="" selected>请选择模型</option>' + optionsHtml;
      host.innerHTML = '<span class="xmind-casegen-model-label">模型</span>'
        + '<select class="xmind-casegen-model-select" data-xmind-casegen-model-select aria-label="XMind 用例生成模型"'
        + (modelList.length ? '' : ' disabled')
        + '>'
        + optionsHtml
        + '</select>';
      var selectEl = host.querySelector('[data-xmind-casegen-model-select]');
      if (!selectEl) return false;
      selectEl.addEventListener('change', function() {
        var nextId = selectEl.value ? String(selectEl.value || '') : '';
        var prevId = state && state.assignments && state.assignments.xmindCaseGenId
          ? String(state.assignments.xmindCaseGenId || '')
          : '';
        if (nextId === prevId) return;
        state.assignments = state.assignments || {};
        state.assignments.xmindCaseGenId = nextId;
        if (xmindGenApi && typeof xmindGenApi.renderAssignmentsSelect === 'function') {
          xmindGenApi.renderAssignmentsSelect();
        }
        if (xmindGenApi && typeof xmindGenApi.saveAssignments === 'function') xmindGenApi.saveAssignments();
        if (xmindGenApi && typeof xmindGenApi.updateAssignmentStatuses === 'function') {
          xmindGenApi.updateAssignmentStatuses();
        }
        persistWorkflowStateNow();
        notifySuccessToast('已切换 XMind 模型', 2200);
      });
      return true;
    }

    function applyInlineButtonStyle(btn, extraClass) {
      if (!btn || !btn.classList) return;
      btn.classList.add('xmind-casegen-inline-btn');
      btn.classList.remove(
        'xmind-casegen-inline-btn-primary',
        'xmind-casegen-inline-btn-success',
        'xmind-casegen-inline-btn-danger'
      );
      if (extraClass) btn.classList.add(extraClass);
    }

    function isInlineToolbarCollapsed() {
      return getViewState().toolbarCollapsed === true;
    }

    function getInlineToolbarCollapseButton() {
      var controlsRoot = getMindControlsRoot();
      if (!controlsRoot || !controlsRoot.querySelector || !documentObj) return null;
      var btn = controlsRoot.querySelector('[data-xmind-casegen-toolbar-toggle]');
      if (!btn) {
        btn = documentObj.createElement('button');
        btn.type = 'button';
        btn.className = 'secondary xmind-toolbar-collapse-btn';
        btn.setAttribute('data-xmind-casegen-toolbar-toggle', '1');
        btn.addEventListener('click', function(event) {
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
          if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
          setInlineToolbarCollapsed(!isInlineToolbarCollapsed(), { persist: true });
        });
        controlsRoot.appendChild(btn);
      } else if (btn.parentNode !== controlsRoot && controlsRoot.appendChild) {
        controlsRoot.appendChild(btn);
      }
      toolbarCollapseBtn = btn;
      return btn;
    }

    function syncInlineToolbarCollapseState() {
      var controlsRoot = getMindControlsRoot();
      if (!controlsRoot) return false;
      var collapsed = isInlineToolbarCollapsed();
      var btn = getInlineToolbarCollapseButton();
      if (controlsRoot.classList) {
        if (collapsed) controlsRoot.classList.add('is-collapsed');
        else controlsRoot.classList.remove('is-collapsed');
      }
      controlsRoot.setAttribute('data-xmind-casegen-toolbar-collapsed', collapsed ? 'true' : 'false');
      controlsRoot.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      if (btn) {
        btn.textContent = collapsed ? '展开工具栏' : '收起工具栏';
        btn.title = collapsed ? '展开 XMind 生成工具栏' : '收起 XMind 生成工具栏';
        btn.setAttribute('aria-label', btn.title);
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      }
      return true;
    }

    function setInlineToolbarCollapsed(collapsed, options) {
      var viewState = getViewState();
      viewState.toolbarCollapsed = collapsed === true;
      viewState.updatedAt = now();
      syncInlineToolbarCollapseState();
      if (!(options && options.persist === false)) persistXmindState(true);
    }

    function getInlineToolbarDedupeSummary() {
      var dedupeState = ensureDedupeUiState();
      var result = dedupeState && dedupeState.lastResult && typeof dedupeState.lastResult === 'object'
        ? dedupeState.lastResult
        : null;
      if (!result || result.status !== 'done') return null;
      var removedCount = Number(result.removedCount || 0) || 0;
      if (removedCount < 0) removedCount = 0;
      var actionText = getDedupeModeActionText(result.dedupeMode);
      return {
        removedCount: removedCount,
        title: removedCount > 0
          ? ('最近一次 AI 用例' + actionText + '移除 ' + String(removedCount) + ' 条用例')
          : ('最近一次 AI 用例' + actionText + '未移除用例'),
      };
    }

    function getInlineToolbarOverviewSummary() {
      var context = buildVisibleModuleContext();
      var entries = context && Array.isArray(context.list) ? context.list : [];
      var caseCount = entries.reduce(function(total, entry) {
        return total + getVisibleCasesForModuleEntry(entry).length;
      }, 0);
      var sourceOperations = collectRunningGenerationOperations();
      var runningOperations = Array.isArray(sourceOperations) ? sourceOperations.slice() : [];
      var dedupeState = ensureDedupeUiState();
      var dedupeTerminalVisual = dedupeState.terminalVisualRunning === true
        && Number(dedupeState.terminalVisualUntil || 0) > now();
      if (dedupeTerminalVisual && !runningOperations.some(function(item) {
        return item && item.scope === 'dedupe';
      })) {
        runningOperations.push({
          scope: 'dedupe',
          actionId: dedupeActionId,
          dedupeMode: normalizeDedupeMode(dedupeState.dedupeMode),
          batchCompleted: Number(dedupeState.batchCompleted || 0),
          batchTotal: Number(dedupeState.batchTotal || 0),
          label: 'AI用例去重',
        });
      }
      var runningCount = runningOperations.length;
      var dedupeOperation = runningOperations.filter(function(item) {
        return item && item.scope === 'dedupe';
      })[0] || null;
      var coverageRunning = runningOperations.some(function(item) {
        return item && item.scope === 'coverage';
      });
      var moduleOperation = runningOperations.filter(function(item) {
        return item && item.scope === 'module';
      })[0] || null;
      var runningPipeline = getRootPipelineState();
      var moduleCompleted = Number(runningPipeline && runningPipeline.moduleTaskCompleted || 0);
      var moduleTotal = Number(runningPipeline && runningPipeline.moduleTaskTotal || 0);
      var moduleProgressText = moduleTotal > 0
        ? (String(Math.min(moduleCompleted, moduleTotal)) + '/' + String(moduleTotal))
        : '';
      var generationRunningLabel = moduleOperation && moduleProgressText
        ? ('正在生成模块用例 ' + moduleProgressText)
        : '正在执行生成任务';
      var generationRunningHint = moduleOperation
        ? ('当前模块：' + String(moduleOperation.label || '未命名模块') + '；超时上限遵循模型调用设置')
        : ('当前共有 ' + String(runningCount) + ' 个生成任务在执行');
      var dedupeMode = dedupeOperation
        ? normalizeDedupeMode(dedupeOperation.dedupeMode)
        : getDedupeModeFromSettings();
      return {
        runningCount: runningCount,
        runningState: runningCount > 0 ? 'running' : 'idle',
        runningLabel: runningCount > 0
          ? (coverageRunning
            ? '需求覆盖分析中'
            : (dedupeOperation ? getDedupeRunningLabel(dedupeMode, dedupeOperation) : generationRunningLabel))
          : '当前没有生成任务',
        runningHint: runningCount > 0
          ? (coverageRunning
            ? '正在分析当前页签可见用例对需求原文的覆盖'
            : (dedupeOperation ? getDedupeRunningHint(dedupeMode, dedupeOperation) : generationRunningHint))
          : '当前可继续发起生成、补全或删除操作',
        moduleCount: entries.length,
        caseCount: caseCount,
        dedupe: getInlineToolbarDedupeSummary(),
      };
    }

    function syncInlineToolbarOverview() {
      var host = getInlineOverviewHost();
      if (!host) return false;
      var summary = getInlineToolbarOverviewSummary();
      var taskClassName = 'xmind-casegen-inline-task-indicator is-' + summary.runningState;
      var taskBadgeHtml = summary.runningCount > 0
        ? ('<span class="xmind-casegen-inline-task-badge" data-xmind-casegen-task-count>' + escapeHtml(String(summary.runningCount)) + '</span>')
        : '';
      var dedupeCountHtml = summary.dedupe
        ? ('<span class="xmind-casegen-inline-count-pill is-dedupe" data-xmind-casegen-count-dedupe title="' + escapeHtml(summary.dedupe.title) + '">'
          + '<span>去重</span><strong>' + escapeHtml(String(summary.dedupe.removedCount)) + '</strong><span>条</span>'
          + '</span>')
        : '';
      host.innerHTML = ''
        + '<div class="' + taskClassName + '" data-xmind-casegen-task-state="' + escapeHtml(summary.runningState) + '" title="' + escapeHtml(summary.runningHint) + '">'
        + '<span class="xmind-casegen-inline-task-dot" aria-hidden="true"></span>'
        + '<span class="xmind-casegen-inline-task-label">' + escapeHtml(summary.runningLabel) + '</span>'
        + taskBadgeHtml
        + '</div>'
        + '<div class="xmind-casegen-inline-counts" data-xmind-casegen-counts title="当前画布展示的模块和用例总数会随生成、补全、删除实时刷新；去重为最近一次 AI 去重移除数量">'
        + '<span class="xmind-casegen-inline-count-pill" data-xmind-casegen-count-modules>'
        + '<strong>' + escapeHtml(String(summary.moduleCount)) + '</strong><span>模块</span>'
        + '</span>'
        + '<span class="xmind-casegen-inline-count-pill" data-xmind-casegen-count-cases>'
        + '<strong>' + escapeHtml(String(summary.caseCount)) + '</strong><span>用例</span>'
        + '</span>'
        + dedupeCountHtml
        + '</div>';
      return true;
    }

    function syncPersistenceActionToolbarButtons() {
      var running = hasAnyRunningGenerationOperation();
      var message = '当前有 XMind 任务进行中，请等待完成后再操作';
      [storeBtn, exportBtn, exportMarkdownBtn].forEach(function(btn) {
        if (!btn) return;
        if (!btn.getAttribute('data-xmind-default-title')) {
          btn.setAttribute('data-xmind-default-title', String(btn.title || ''));
        }
        btn.disabled = running;
        btn.title = running ? message : String(btn.getAttribute('data-xmind-default-title') || '');
      });
    }

    function syncDedupeToolbarButton() {
      if (!dedupeBtn) return;
      var running = hasAnyRunningGenerationOperation();
      var hasCases = hasVisibleAiCasesForDedupe();
      var confirming = isManualDedupeConfirming();
      dedupeBtn.disabled = running || !hasCases || confirming;
      if (running) dedupeBtn.title = '当前有 XMind 任务进行中，请等待完成后再去重';
      else if (confirming) dedupeBtn.title = 'AI 用例去重确认中，请先在弹窗中确认或取消';
      else if (!hasCases) dedupeBtn.title = '当前页签没有可去重的 AI 生成用例';
      else dedupeBtn.title = '对当前页签 AI 生成用例执行' + getDedupeModeActionText(getDedupeModeFromSettings());
    }

    function getVisibleCaseCountForCoverage() {
      var context = buildVisibleModuleContext();
      var entries = context && Array.isArray(context.list) ? context.list : [];
      return entries.reduce(function(total, entry) {
        return total + getVisibleCasesForModuleEntry(entry).length;
      }, 0);
    }

    function syncCoverageToolbarButton() {
      if (!coverageBtn) return;
      var runningOperations = collectRunningGenerationOperations();
      if (!Array.isArray(runningOperations)) runningOperations = [];
      var running = runningOperations.length > 0;
      var coverageState = ensureCoverageUiState();
      var coverageRunning = coverageState.running === true || runningOperations.some(function(item) {
        return item && item.scope === 'coverage';
      });
      var requirement = getSelectedRequirementSource() || {};
      var hasWorkspace = hasActiveWorkspace();
      var hasRequirementText = Boolean(String(requirement.text || '').trim());
      var hasCases = getVisibleCaseCountForCoverage() > 0;
      coverageBtn.disabled = running || !hasWorkspace || !hasRequirementText || !hasCases;
      coverageBtn.classList.toggle('is-running', coverageRunning);
      coverageBtn.setAttribute('aria-busy', coverageRunning ? 'true' : 'false');
      coverageBtn.setAttribute('aria-expanded', isCoverageDialogOpen() ? 'true' : 'false');
      coverageBtn.innerHTML = coverageRunning
        ? '<span class="xmind-casegen-coverage-spinner" aria-hidden="true"></span><span>分析中</span>'
        : '需求覆盖';
      if (coverageRunning) coverageBtn.title = '需求覆盖分析中，请等待完成';
      else if (running) coverageBtn.title = '当前有 XMind 任务进行中，请等待完成后再查看覆盖';
      else if (!hasWorkspace) coverageBtn.title = '请先新建生成页签';
      else if (!hasRequirementText) coverageBtn.title = '当前页签没有可分析的需求原文';
      else if (!hasCases) coverageBtn.title = '当前页签没有可分析的可见用例';
      else coverageBtn.title = '查看当前可见用例对需求原文的覆盖';
    }

    function syncInterruptButton() {
      if (!interruptBtn) return;
      var runningOperations = collectRunningGenerationOperations();
      var runningCount = Array.isArray(runningOperations) ? runningOperations.length : 0;
      interruptBtn.disabled = runningCount <= 0;
      interruptBtn.title = runningCount > 0
        ? ('中断当前 XMind 生成中的 ' + String(runningCount) + ' 个任务')
        : '当前没有进行中的 XMind 生成任务';
      syncPersistenceActionToolbarButtons();
      syncDedupeToolbarButton();
      syncCoverageToolbarButton();
      syncInlineToolbarOverview();
    }

    function mountInlineControls() {
      var controlsRoot = getMindControlsRoot();
      var primaryHost = getInlinePrimaryHost();
      var historyGroup = getInlineGroupHost('history');
      var knowledgeGroup = getInlineGroupHost('knowledge');
      var persistenceGroup = getInlineGroupHost('result');
      var deleteGroup = getInlineGroupHost('delete-history');
      var taskGroup = getInlineGroupHost('task');
      var statusHost = getInlineStatusHost();
      if (!controlsRoot || !primaryHost || !historyGroup || !knowledgeGroup || !persistenceGroup
        || !deleteGroup || !taskGroup) return false;
      controlsRoot.classList.add('xmind-casegen-inline-controls-ready');
      if (summaryBtn && primaryHost.appendChild) {
        applyInlineButtonStyle(summaryBtn, 'xmind-casegen-inline-btn-primary');
        primaryHost.appendChild(summaryBtn);
      }
      if (!getInlineOverviewHost()) return false;
      syncInlineToolbarOverview();
      [
        [historyBtn, historyGroup, ''],
        [knowledgeRuleBtn, knowledgeGroup, ''],
        [knowledgeAiBtn, knowledgeGroup, ''],
        [dedupeBtn, persistenceGroup, ''],
        [coverageBtn, persistenceGroup, ''],
        [storeBtn, persistenceGroup, 'xmind-casegen-inline-btn-success'],
        [exportBtn, persistenceGroup, ''],
        [exportMarkdownBtn, persistenceGroup, ''],
        [deleteUndoBtn, deleteGroup, ''],
        [deleteRedoBtn, deleteGroup, ''],
        [interruptBtn, taskGroup, 'xmind-casegen-inline-btn-danger'],
      ].forEach(function(item) {
        if (!item[0] || !item[1].appendChild) return;
        applyInlineButtonStyle(item[0], item[2]);
        item[1].appendChild(item[0]);
      });
      if (statusHost && statusEl) {
        statusEl.classList.add('xmind-casegen-inline-status-text');
        statusHost.appendChild(statusEl);
      }
      syncDeleteHistoryButtons();
      syncInterruptButton();
      syncDedupeToolbarButton();
      syncCoverageToolbarButton();
      syncKnowledgeBaseToolbarState();
      syncHistoryButtonState();
      syncInlineModelPicker();
      syncInlineToolbarCollapseState();
      return true;
    }

    return {
      getInlineToolbarOverviewSummary: getInlineToolbarOverviewSummary,
      mountInlineControls: mountInlineControls,
      restoreInlineControlsToBank: restoreInlineControlsToBank,
      setInlineToolbarCollapsed: setInlineToolbarCollapsed,
      syncCoverageToolbarButton: syncCoverageToolbarButton,
      syncDedupeToolbarButton: syncDedupeToolbarButton,
      syncInlineModelPicker: syncInlineModelPicker,
      syncInlineToolbarCollapseState: syncInlineToolbarCollapseState,
      syncInlineToolbarOverview: syncInlineToolbarOverview,
      syncInterruptButton: syncInterruptButton,
    };
  }

  return { create: create };
});
