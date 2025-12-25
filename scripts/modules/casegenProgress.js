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
    var caseGenProgressTabDot = dom.caseGenProgressTabDot;
    var sidebarTabCasegen = dom.sidebarTabCasegen;
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
      return state.caseGenProgressNotice;
    }

    function isCasegenTabActive() {
      if (sidebarTabCasegen && sidebarTabCasegen.classList) {
        return sidebarTabCasegen.classList.contains('is-active');
      }
      return true;
    }

    function syncTabDotVisible(visible) {
      if (!caseGenProgressTabDot) return;
      caseGenProgressTabDot.classList.toggle('is-visible', visible === true);
    }

    function markCasegenTabViewed() {
      var notice = ensureProgressNotice();
      notice.dotVisible = false;
      syncTabDotVisible(false);
    }

    function syncCasegenProgressDot(doneIds, hasNewDoneEvent) {
      var notice = ensureProgressNotice();
      var ids = doneIds || {};
      var hasDone = false;
      Object.keys(ids).forEach(function(key) {
        if (key) hasDone = true;
      });
      if (!hasDone) {
        notice.dotVisible = false;
        syncTabDotVisible(false);
        return;
      }
      if (isCasegenTabActive()) {
        notice.dotVisible = false;
        syncTabDotVisible(false);
        return;
      }
      if (hasNewDoneEvent) notice.dotVisible = true;
      syncTabDotVisible(notice.dotVisible === true);
    }

    function ensureCaseGenRunningSet() {
      if (!(state.caseGenRunning instanceof Set)) {
        state.caseGenRunning = new Set();
      }
      return state.caseGenRunning;
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

    var defaultContainer = dom.casesGenerationContainer;

    function pickContainer(root) {
      return root || defaultContainer || null;
    }

    function renderCaseGenProgressBoard() {
      if (!caseGenProgressPanel || !caseGenProgressList) return;
      var modules = Array.isArray(state.caseGenModules) ? state.caseGenModules : [];
      var notice = ensureProgressNotice();
      var doneIds = {};
      var nextStates = {};
      var hasNewDoneEvent = false;
      if (!modules.length) {
        caseGenProgressPanel.classList.remove('hidden');
        caseGenProgressList.innerHTML = '<p class="hint">暂无用例生成任务，请先完成“测试模块拆分”并生成用例</p>';
        notice.lastStates = {};
        syncCasegenProgressDot({});
        requestLayoutSync();
        return;
      }
      var html = modules.map(function(mod, idx) {
        var status = resolveCaseGenBoardState(mod.id);
        nextStates[mod.id] = status.state;
        if (status.state === 'done') doneIds[mod.id] = true;
        if (status.state === 'done' && notice.lastStates[mod.id] !== 'done') {
          hasNewDoneEvent = true;
        }
        var label = status.state === 'running'
          ? '生成中'
          : status.state === 'done'
          ? '完成'
          : status.state === 'warn'
          ? '注意'
          : status.state === 'error'
          ? '失败'
          : '未生成';
        var name = escapeHtml(mod.title || ('模块' + (idx + 1)));
        return '' +
          '<div class="casegen-progress-item state-' + (status.state || 'pending') + '" data-casegen-module="' + mod.id + '">' +
            '<div class="info">' +
              '<span class="status-dot"></span>' +
              '<div class="titles">' +
                '<div class="name">' + name + '</div>' +
              '</div>' +
            '</div>' +
            '<span class="badge">' + label + '</span>' +
          '</div>';
      }).join('');
      caseGenProgressList.innerHTML = html;
      caseGenProgressPanel.classList.remove('hidden');
      notice.lastStates = nextStates;
      syncCasegenProgressDot(doneIds, hasNewDoneEvent);
      requestLayoutSync();
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

    function renderCaseModuleProgress(moduleId) {
      var progress = state.caseGenProgress[moduleId];
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

    if (isCasegenTabActive()) {
      markCasegenTabViewed();
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
