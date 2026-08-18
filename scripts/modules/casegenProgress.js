(function() {
  function init(ctx) {
    if (!ctx) return {};
    var state = ctx.state || {};
    var dom = ctx.dom || {};
    var utils = ctx.utils || {};
    var escapeHtml = ctx.escapeHtml || (utils && utils.escapeHtml) || function(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    var caseGenProgressPanel = dom.caseGenProgressPanel;
    var caseGenProgressList = dom.caseGenProgressList;
    var caseGenProgressToggle = dom.caseGenProgressToggle;
    var caseGenProgressTabDot = dom.caseGenProgressTabDot;
    var sidebarTabCasegen = dom.sidebarTabCasegen;
    var persistWorkflowState = ctx.persistWorkflowState || function() {};
    var persistSettings = ctx.persistSettings || function() {};
    var caseGenProgressBoardHtml = '';
    function requestLayoutSync() {
      try {
        if (window.app && window.app.sidebarPanels && typeof window.app.sidebarPanels.requestLayoutSync === 'function') {
          window.app.sidebarPanels.requestLayoutSync();
        }
      } catch (err) {
        // ignore
      }
    }

    function ensureProgressNotice() {
      if (!state.caseGenProgressNotice || typeof state.caseGenProgressNotice !== 'object') {
        state.caseGenProgressNotice = { lastStates: {}, dotVisible: false };
      }
      if (!state.caseGenProgressNotice.lastStates || typeof state.caseGenProgressNotice.lastStates !== 'object') {
        state.caseGenProgressNotice.lastStates = {};
      }
      state.caseGenProgressNotice.dotVisible = state.caseGenProgressNotice.dotVisible === true;
      return state.caseGenProgressNotice;
    }

    function getSettingsSidebarTab() {
      if (window.app && window.app.settingsReady !== true) {
        return '';
      }
      if (!state.settings || state.settings.sidebarTabActive === undefined || state.settings.sidebarTabActive === null) {
        return '';
      }
      var value = String(state.settings.sidebarTabActive || '');
      if (value === 'casegen' || value === 'memo') return value;
      return '';
    }

    function isCasegenTabActive() {
      var settingsTab = getSettingsSidebarTab();
      if (settingsTab) return settingsTab === 'casegen';
      if (window.app && window.app.settingsReady === false) {
        return false;
      }
      if (sidebarTabCasegen && sidebarTabCasegen.classList) {
        return sidebarTabCasegen.classList.contains('is-active');
      }
      return true;
    }

    function syncTabDotVisible(visible) {
      if (!caseGenProgressTabDot || !caseGenProgressTabDot.classList) return false;
      var nextVisible = visible === true;
      var changed = caseGenProgressTabDot.classList.contains('is-visible') !== nextVisible;
      caseGenProgressTabDot.classList.toggle('is-visible', nextVisible);
      return changed;
    }

    function getXmindCasegenApi() {
      return window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
    }

    function ensureSettings() {
      if (!state.settings || typeof state.settings !== 'object') {
        state.settings = {};
      }
      return state.settings;
    }

    function getStoredProgressCollapsed() {
      return ensureSettings().caseGenProgressCollapsed === true;
    }

    function setCaseGenProgressCollapsed(collapsed, shouldPersist) {
      if (!caseGenProgressPanel || !caseGenProgressToggle) return;
      caseGenProgressPanel.classList.toggle('is-collapsed', collapsed === true);
      caseGenProgressToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      caseGenProgressToggle.textContent = collapsed ? '展开' : '收起';
      requestLayoutSync();
      if (shouldPersist === false) return;
      ensureSettings().caseGenProgressCollapsed = collapsed === true;
      persistSettings(['caseGenProgressCollapsed']);
    }

    function openXmindWorkspace(workspaceId) {
      var api = getXmindCasegenApi();
      try {
        if (api && typeof api.openWorkspace === 'function') {
          return api.openWorkspace(workspaceId || '') === true;
        }
        if (api && typeof api.open === 'function') {
          return api.open() === true;
        }
      } catch (err) {
        // ignore
      }
      return false;
    }

    function hasXmindCompletionNotice() {
      return Boolean(state && state.xmindCaseGen && state.xmindCaseGen.openButtonDotVisible === true);
    }

    function getXmindWorkspaceProgressItems() {
      var api = getXmindCasegenApi();
      if (!api || typeof api.getWorkspaceProgressItems !== 'function') return [];
      var items = api.getWorkspaceProgressItems();
      return Array.isArray(items) ? items : [];
    }

    function resolveWorkspaceProgressState(item) {
      var statusCls = item && item.statusCls ? String(item.statusCls || '') : '';
      if (statusCls === 'is-running') return 'running';
      if (statusCls === 'is-error') return 'error';
      if (statusCls === 'is-ready') return 'done';
      if (statusCls === 'is-dirty' || statusCls === 'is-draft') return 'warn';
      return 'pending';
    }

    function persistProgressNotice() {
      if (typeof persistWorkflowState === 'function') {
        persistWorkflowState();
      }
    }

    function markCasegenTabViewed() {
      return syncTabDotVisible(hasXmindCompletionNotice());
    }

    function syncCasegenProgressDot(doneIds, hasNewDoneEvent) {
      return syncTabDotVisible(hasXmindCompletionNotice());
    }

    function ensureCaseGenRunningSet() {
      if (!(state.caseGenRunning instanceof Set)) {
        state.caseGenRunning = new Set();
      }
      return state.caseGenRunning;
    }

    function ensureLegacyCaseGenRunningList() {
      if (!state.caseGenLegacy || typeof state.caseGenLegacy !== 'object') return null;
      if (state.caseGenLegacy.running instanceof Set) {
        state.caseGenLegacy.running = Array.from(state.caseGenLegacy.running);
      } else if (!Array.isArray(state.caseGenLegacy.running)) {
        state.caseGenLegacy.running = [];
      }
      return state.caseGenLegacy.running;
    }

    function isSameRunningModuleId(left, right) {
      if (left === right) return true;
      if (left === null || left === undefined || right === null || right === undefined) return false;
      return String(left) === String(right);
    }

    function syncLegacyCaseGenRunningState(moduleId, running) {
      if (!moduleId) return;
      var list = ensureLegacyCaseGenRunningList();
      if (!list) return;
      var nextList = list.filter(function(item) {
        return !isSameRunningModuleId(item, moduleId);
      });
      if (running === true) nextList.push(moduleId);
      state.caseGenLegacy.running = nextList;
    }

    function isCaseModuleRunning(moduleId) {
      if (!moduleId) return false;
      return ensureCaseGenRunningSet().has(moduleId);
    }

    function setCaseModuleRunning(moduleId, running) {
      if (!moduleId) return;
      var set = ensureCaseGenRunningSet();
      if (running) set.add(moduleId);
      else set.delete(moduleId);
      syncLegacyCaseGenRunningState(moduleId, running === true);
      renderCaseGenProgressBoard();
    }

    function resolveCaseGenBoardState(moduleId) {
      var statusInfo = state.caseGenModuleStatus[moduleId];
      var rawResult = state.caseGenResults[moduleId] || '';
      var trimmed = rawResult.trim();
      var hasResult = Boolean(trimmed && !/^\[\s*\]$/.test(trimmed));
      if (isCaseModuleRunning(moduleId)) return { state: 'running', text: '生成中...' };
      if (statusInfo && statusInfo.type === 'err') return { state: 'error', text: statusInfo.text || '生成失败' };
      if (hasResult) return { state: 'done', text: statusInfo && statusInfo.text ? statusInfo.text : '已完成' };
      if (statusInfo && statusInfo.type === 'warn') return { state: 'warn', text: statusInfo.text || '待处理' };
      return { state: 'pending', text: (statusInfo && statusInfo.text) || '未生成' };
    }

    function hasCaseGenSuggestion(moduleId) {
      if (moduleId === null || moduleId === undefined) return false;
      if (!state.caseGenSuggestions || typeof state.caseGenSuggestions !== 'object') return false;
      var raw = state.caseGenSuggestions[moduleId];
      if (raw === undefined || raw === null) {
        raw = state.caseGenSuggestions[String(moduleId)];
      }
      return Boolean(String(raw || '').trim());
    }

    var defaultContainer = dom.casesGenerationContainer;

    function pickContainer(root) {
      return root || defaultContainer || null;
    }

    function renderCaseGenProgressBoard() {
      if (!caseGenProgressPanel || !caseGenProgressList) return;
      var items = getXmindWorkspaceProgressItems();
      if (!items.length) {
        var emptyHtml = '<p class="hint">暂无 xmind 生成页签，点击打开 XMind 用例生成</p>';
        var panelWasHidden = caseGenProgressPanel.classList.contains('hidden');
        var htmlChanged = caseGenProgressBoardHtml !== emptyHtml;
        if (htmlChanged) {
          caseGenProgressList.innerHTML = emptyHtml;
          caseGenProgressBoardHtml = emptyHtml;
        }
        caseGenProgressPanel.classList.remove('hidden');
        var dotChanged = syncCasegenProgressDot();
        if (htmlChanged || panelWasHidden || dotChanged) requestLayoutSync();
        return;
      }
      var html = items.map(function(item) {
        var stateCls = resolveWorkspaceProgressState(item);
        var activeCls = item && item.active === true ? ' is-active' : '';
        return '' +
          '<button type="button" class="casegen-progress-item xmind-casegen-progress-item state-' + stateCls + activeCls + '" data-casegen-workspace="' + escapeHtml(item && item.id ? item.id : '') + '" title="' + escapeHtml(item && item.title ? item.title : '') + '">' +
            '<div class="info">' +
              '<span class="status-dot"></span>' +
              '<div class="titles">' +
                '<div class="name">' + escapeHtml(item && item.title ? item.title : '未命名生成') + '</div>' +
                '<div class="xmind-casegen-tab-meta">' +
                  '<span class="xmind-casegen-tab-state-pill ' + escapeHtml(item && item.statusCls ? item.statusCls : 'is-idle') + '" aria-hidden="true">' + escapeHtml(item && item.statusText ? item.statusText : '待准备') + '</span>' +
                  '<span class="xmind-casegen-tab-dot" aria-hidden="true"></span>' +
                  '<span class="xmind-casegen-tab-metric">' + String(item && item.moduleCount !== undefined ? item.moduleCount : 0) + ' 模块</span>' +
                  '<span class="xmind-casegen-tab-dot" aria-hidden="true"></span>' +
                  '<span class="xmind-casegen-tab-metric">' + String(item && item.caseCount !== undefined ? item.caseCount : 0) + ' 用例</span>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</button>';
      }).join('');
      var panelWasHidden2 = caseGenProgressPanel.classList.contains('hidden');
      var changed = caseGenProgressBoardHtml !== html;
      if (changed) {
        caseGenProgressList.innerHTML = html;
        caseGenProgressBoardHtml = html;
      }
      caseGenProgressPanel.classList.remove('hidden');
      var dotChanged2 = syncCasegenProgressDot();
      if (changed || panelWasHidden2 || dotChanged2) requestLayoutSync();
    }

    function renderCaseProgressItem(item) {
      var stateText = item.state === 'done'
        ? '完成'
        : item.state === 'running'
        ? '执行中...'
        : item.state === 'error'
        ? '失败'
        : item.state === 'skipped'
        ? '跳过'
        : '待执行';
      var marker = item.state === 'done'
        ? '✅'
        : item.state === 'running'
        ? '⏳'
        : item.state === 'error'
        ? '⚠️'
        : item.state === 'skipped'
        ? '—'
        : '●';
      var stateClass = item.state || 'pending';
      return '<div class="progress-item ' + stateClass + '"><span class="marker">' + marker + '</span><span class="label">' + escapeHtml(item.label || '') + '</span><span class="state">' + stateText + '</span></div>';
    }

    function renderCaseModuleProgress(moduleId, progressSource) {
      var source = progressSource && typeof progressSource === 'object'
        ? progressSource
        : state.caseGenProgress;
      var progress = source && moduleId ? source[moduleId] : null;
      if (!progress) {
        return '<div class="case-progress-list"><div class="progress-item pending"><span class="marker">●</span><span class="label">待执行</span><span class="state">待执行</span></div></div>';
      }
      var items = [];
      if (Array.isArray(progress.groups)) {
        progress.groups.forEach(function(group) { items.push(renderCaseProgressItem(group)); });
      }
      if (progress.dedupe) items.push(renderCaseProgressItem(progress.dedupe));
      if (progress.finalize) items.push(renderCaseProgressItem(progress.finalize));
      return items.length ? '<div class="case-progress-list">' + items.join('') + '</div>' : '<p class="hint" data-case-progress-empty>暂无执行记录</p>';
    }

    function updateCaseProgressView(moduleId, containerRoot) {
      var root = pickContainer(containerRoot);
      if (!root || !moduleId) return;
      var container = root.querySelector('[data-progress="' + moduleId + '"]');
      if (!container) return;
      container.innerHTML = renderCaseModuleProgress(moduleId);
    }

    function clearCaseProgress(moduleId, containerRoot) {
      if (!moduleId) return;
      delete state.caseGenProgress[moduleId];
      updateCaseProgressView(moduleId, containerRoot);
    }

    function initCaseProgress(moduleId, groups, containerRoot) {
      if (!moduleId) return;
      var normalizedGroups = (groups || []).map(function(group, idx) {
        var count = Array.isArray(group) ? group.length : Number(group) || 0;
        return {
          label: '第' + (idx + 1) + '组（' + count + '条）',
          state: 'pending',
        };
      });
      state.caseGenProgress[moduleId] = {
        groups: normalizedGroups,
        dedupe: { label: '删除重复用例', state: normalizedGroups.length ? 'pending' : 'skipped' },
        finalize: { label: '最终用例整合', state: 'pending' },
      };
      updateCaseProgressView(moduleId, containerRoot);
    }

    function setCaseProgressGroupState(moduleId, idx, newState, containerRoot) {
      var progress = state.caseGenProgress[moduleId];
      if (!progress || !progress.groups || !progress.groups[idx]) return;
      progress.groups[idx].state = newState;
      updateCaseProgressView(moduleId, containerRoot);
    }

    function setCaseProgressStep(moduleId, step, newState, containerRoot) {
      var progress = state.caseGenProgress[moduleId];
      if (!progress || !progress[step]) return;
      progress[step].state = newState;
      updateCaseProgressView(moduleId, containerRoot);
    }

    function markAllCaseProgressGroups(moduleId, newState, containerRoot) {
      var progress = state.caseGenProgress[moduleId];
      if (!progress || !Array.isArray(progress.groups)) return;
      progress.groups.forEach(function(_, idx) {
        progress.groups[idx].state = newState;
      });
      updateCaseProgressView(moduleId, containerRoot);
    }

    if (sidebarTabCasegen && sidebarTabCasegen.addEventListener) {
      sidebarTabCasegen.addEventListener('click', function() {
        markCasegenTabViewed();
      });
    }

    if (caseGenProgressList && caseGenProgressList.addEventListener) {
      caseGenProgressList.addEventListener('click', function(e) {
        var item = e.target && e.target.closest ? e.target.closest('[data-casegen-workspace]') : null;
        if (!item) return;
        var workspaceId = item.dataset ? item.dataset.casegenWorkspace : '';
        openXmindWorkspace(workspaceId || '');
      });
    }

    if (caseGenProgressPanel && caseGenProgressToggle) {
      setCaseGenProgressCollapsed(getStoredProgressCollapsed(), false);
      caseGenProgressToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        setCaseGenProgressCollapsed(!caseGenProgressPanel.classList.contains('is-collapsed'), true);
      });
      caseGenProgressPanel.addEventListener('click', function(e) {
        var toggle = e.target && e.target.closest ? e.target.closest('#caseGenProgressToggle') : null;
        var workspace = e.target && e.target.closest ? e.target.closest('[data-casegen-workspace]') : null;
        if (toggle || workspace) return;
        openXmindWorkspace('');
      });
    }

    function syncViewedIfActive() {
      if (!isCasegenTabActive()) return;
      var settingsTab = '';
      if (state.settings && state.settings.sidebarTabActive !== undefined && state.settings.sidebarTabActive !== null) {
        settingsTab = String(state.settings.sidebarTabActive || '');
      }
      if (settingsTab && settingsTab !== 'casegen') return;
      var notice = ensureProgressNotice();
      if (notice.dotVisible === true) return;
      markCasegenTabViewed();
    }

    if (window.app && window.app.settingsReady === true) {
      syncViewedIfActive();
    } else {
      try {
        window.addEventListener('app-settings-loaded', function() {
          setCaseGenProgressCollapsed(getStoredProgressCollapsed(), false);
          syncViewedIfActive();
        });
      } catch (err) {
        // ignore
      }
    }

    return {
      renderCaseGenProgressBoard: renderCaseGenProgressBoard,
      setCaseModuleRunning: setCaseModuleRunning,
      isCaseModuleRunning: isCaseModuleRunning,
      renderCaseModuleProgress: renderCaseModuleProgress,
      updateCaseProgressView: updateCaseProgressView,
      clearCaseProgress: clearCaseProgress,
      initCaseProgress: initCaseProgress,
      setCaseProgressGroupState: setCaseProgressGroupState,
      setCaseProgressStep: setCaseProgressStep,
      markAllCaseProgressGroups: markAllCaseProgressGroups,
    };
  }

  window.app = window.app || {};
  window.app.casegenProgress = { init: init };
})();
