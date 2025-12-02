(function() {
  function init(ctx) {
    if (!ctx) return {};
    var state = ctx.state || {};
    var handlers = ctx.handlers || {};
    var dom = ctx.dom || {};
    var utils = ctx.utils || {};
    var splitResultEl = dom.splitResultEl;
    var splitViewContainer = dom.splitViewContainer;
    var toggleSplitViewBtn = dom.toggleSplitViewBtn;
    var splitStatus = dom.splitStatus;

    var refreshMissingSmartFillButton = handlers.refreshMissingSmartFillButton;
    var updateFlowStatus = handlers.updateFlowStatus;
    var ensureCaseGenModulesFromSplit = handlers.ensureCaseGenModulesFromSplit;
    var renderCaseGeneration = handlers.renderCaseGeneration;
    var parseSplitModules = handlers.parseSplitModules;
    var setStatus = ctx.setStatus || function() {};
    var caseGenStatus = dom.caseGenStatus;
    var escapeHtml = utils.escapeHtml || function(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    function normalizeSplitList(value) {
      var normalize = function(val) {
        var raw = val === undefined || val === null ? '' : val;
        var text = raw.toString().trim();
        if (!text || /^(undefined|null)$/i.test(text)) return '';
        return text;
      };
      if (Array.isArray(value)) {
        return value.map(normalize).filter(Boolean);
      }
      if (typeof value === 'string') {
        var trimmed = normalize(value);
        return trimmed ? [trimmed] : [];
      }
      if (value && typeof value === 'object') {
        return Object.values(value).map(normalize).filter(Boolean);
      }
      return [];
    }

    function formatSplitCell(list) {
      if (!list.length) return '-';
      return list.map(function(item) { return escapeHtml(item) + '；'; }).join('<br>');
    }

    function renderSplitViewTable(modules) {
      if (!modules.length) {
        return '<p class="hint" style="padding:12px;">暂无拆分数据，请先完成测试模块拆分</p>';
      }
      var body = modules.map(function(mod, idx) {
        var scenarios = normalizeSplitList(mod.scenarios);
        var points = normalizeSplitList(mod.points || mod.test_points);
        var coupled = normalizeSplitList(mod.coupled || mod.coupled_modules);
        var special = normalizeSplitList(mod.special || mod.special_points);
        return '' +
          '<tr>' +
            '<td class="index">' + (idx + 1) + '</td>' +
            '<td>' + escapeHtml(mod.title || mod.module || ('模块' + (idx + 1))) + '</td>' +
            '<td>' + formatSplitCell(scenarios) + '</td>' +
            '<td>' + formatSplitCell(points) + '</td>' +
            '<td>' + formatSplitCell(coupled) + '</td>' +
            '<td>' + formatSplitCell(special) + '</td>' +
          '</tr>';
      }).join('');
      return '' +
        '<table class="table-view">' +
          '<thead>' +
            '<tr>' +
              '<th class="index">编号</th>' +
              '<th>模块</th>' +
              '<th>测试场景</th>' +
              '<th>测试要点</th>' +
              '<th>耦合模块</th>' +
              '<th>特殊测试点</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' + body + '</tbody>' +
        '</table>';
    }

    function syncSplitView() {
      if (!splitViewContainer) return;
      var hasSplit = Boolean(splitResultEl && splitResultEl.value.trim());
      if (toggleSplitViewBtn) {
        toggleSplitViewBtn.disabled = !hasSplit;
        if (!hasSplit) toggleSplitViewBtn.textContent = '展开拆分视图';
      }
      if (!hasSplit) {
        splitViewContainer.classList.add('hidden');
        splitViewContainer.classList.remove('visible');
        splitViewContainer.innerHTML = '<p class="hint" style="padding:12px;">暂无拆分数据，请先完成测试模块拆分</p>';
        return;
      }
      if (splitViewContainer.classList.contains('visible')) {
        var modules = typeof parseSplitModules === 'function' ? parseSplitModules() : [];
        splitViewContainer.innerHTML = renderSplitViewTable(modules);
      } else {
        splitViewContainer.classList.add('hidden');
        splitViewContainer.classList.remove('visible');
        splitViewContainer.innerHTML = '<p class="hint" style="padding:12px;">点击“展开拆分视图”查看详情</p>';
      }
    }

    function toggleSplitView() {
      if (!splitViewContainer || !splitResultEl || !splitResultEl.value.trim()) {
        setStatus(splitStatus, '暂无拆分数据，请先运行“测试模块拆分”', 'warn');
        return;
      }
      var modules = typeof parseSplitModules === 'function' ? parseSplitModules() : [];
      if (!modules.length) {
        setStatus(splitStatus, '未解析到有效模块，请检查拆分 JSON 是否为数组且包含 module 字段', 'warn');
        return;
      }
      var visible = splitViewContainer.classList.contains('visible');
      if (visible) {
        splitViewContainer.classList.remove('visible');
        splitViewContainer.classList.add('hidden');
        splitViewContainer.innerHTML = '<p class="hint" style="padding:12px;">点击“展开拆分视图”查看详情</p>';
        if (toggleSplitViewBtn) toggleSplitViewBtn.textContent = '展开拆分视图';
      } else {
        splitViewContainer.innerHTML = renderSplitViewTable(modules);
        splitViewContainer.classList.add('visible');
        splitViewContainer.classList.remove('hidden');
        if (toggleSplitViewBtn) toggleSplitViewBtn.textContent = '收起拆分视图';
      }
    }

    if (splitResultEl) {
      splitResultEl.addEventListener('input', function() {
        var currentText = splitResultEl.value.trim();
        if (state.caseGenSource && state.caseGenSource !== currentText) {
          state.caseGenModules = [];
          state.caseGenResults = {};
          state.caseSelections = {};
          state.caseGenSuggestions = {};
          state.caseGenSource = '';
          state.caseGenModuleStatus = {};
          state.caseGenProgress = {};
          state.caseGenRunning = new Set();
          if (state.activeTab === 'casesgen' && typeof renderCaseGeneration === 'function') {
            renderCaseGeneration();
          }
        }
        if (typeof refreshMissingSmartFillButton === 'function') refreshMissingSmartFillButton();
        if (typeof updateFlowStatus === 'function') updateFlowStatus();
        var autoFilled = typeof ensureCaseGenModulesFromSplit === 'function'
          ? ensureCaseGenModulesFromSplit()
          : false;
        if (autoFilled && state.activeTab === 'casesgen') {
          if (setStatus) setStatus(caseGenStatus, '', '');
          if (renderCaseGeneration) renderCaseGeneration();
        }
        if (typeof syncSplitView === 'function') syncSplitView();
      });
    }

    return {
      syncSplitView: syncSplitView,
      toggleSplitView: toggleSplitView,
    };
  }

  window.app = window.app || {};
  window.app.splitHandlers = { init: init };
})();
