(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.opsLogOverviewController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  var DEFAULT_PALETTE = [
    '#2563eb', '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16',
    '#eab308', '#f59e0b', '#f97316', '#ef4444', '#ec4899',
    '#8b5cf6', '#6366f1', '#64748b',
  ];

  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var model = opts.model;
    if (!model || typeof model.buildSummary !== 'function') {
      throw new Error('Operation log overview model is required');
    }

    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var setStatus = port('setStatus');
    var escapeHtml = port('escapeHtml', function(value) { return String(value || ''); });
    var canView = port('canView', function() { return false; });
    var normalizeView = port('normalizeView', function(value) { return value || 'activity'; });
    var persistRootViewState = port('persistRootViewState');
    var fetchLogs = port('fetchLogs', function() { return Promise.resolve([]); });
    var getDateRangeMs = port('getDateRangeMs', function() { return { startMs: null, endMs: null }; });
    var isTimeInRange = port('isTimeInRange', function() { return true; });
    var isAllowedLog = port('isAllowedLog', function() { return true; });
    var resolveActivityActionLabel = port('resolveActivityActionLabel', function() { return ''; });
    var loadUsers = port('loadUsers', function() { return Promise.resolve([]); });
    var createDrawer = port('createDrawer', function() { return null; });
    var now = port('now', function() { return Date.now(); });
    var storage = opts.storage || null;
    var defaultRange = opts.defaultRange || 'week';
    var barMaxRatio = Number(opts.barMaxRatio || 82);
    var autoRefreshIntervalMs = Number(opts.autoRefreshIntervalMs || 60000);
    var storageKeys = opts.storageKeys || {};
    var bound = false;

    var configs = {
      activity: {
        stateKey: 'activity',
        viewKey: 'activity',
        mode: 'activity',
        card: dom.activityCard,
        list: dom.activityList,
        empty: dom.activityEmpty,
        status: dom.activityStatus,
        drawerStatus: dom.activityDrawerStatus,
        userGrid: dom.activityUserGrid,
        selectAll: dom.activitySelectAll,
        applyBtn: dom.activityApplyBtn,
        userEmpty: dom.activityUserEmpty,
        timeRange: dom.activityTimeRange,
        dateStart: dom.activityDateStart,
        dateEnd: dom.activityDateEnd,
        behaviorGrid: dom.activityBehaviorGrid,
        refreshBtn: dom.activityRefreshBtn,
        selectionText: dom.activitySelectionText,
        userDatasetKey: 'opsActivityUser',
        behaviorDatasetKey: 'opsActivityBehavior',
        drawerId: 'opsActivityDrawer',
        openButtons: ['openOpsActivityDrawerBtn', 'openOpsActivityDrawerBtnInline'],
        deniedText: '仅管理员可查看活跃度',
        selectText: '请先选择人员查看活跃度',
        emptyText: '暂无活跃度数据',
        filteredEmptyText: '筛选后暂无活跃度数据',
      },
      contribution: {
        stateKey: 'contribution',
        viewKey: 'contribution',
        mode: 'contribution',
        card: dom.contributionCard,
        list: dom.contributionList,
        empty: dom.contributionEmpty,
        status: dom.contributionStatus,
        drawerStatus: dom.contributionDrawerStatus,
        userGrid: dom.contributionUserGrid,
        selectAll: dom.contributionSelectAll,
        applyBtn: dom.contributionApplyBtn,
        userEmpty: dom.contributionUserEmpty,
        timeRange: dom.contributionTimeRange,
        dateStart: dom.contributionDateStart,
        dateEnd: dom.contributionDateEnd,
        behaviorGrid: dom.contributionBehaviorGrid,
        refreshBtn: dom.contributionRefreshBtn,
        selectionText: dom.contributionSelectionText,
        userDatasetKey: 'opsContributionUser',
        behaviorDatasetKey: 'opsContributionBehavior',
        drawerId: 'opsContributionDrawer',
        openButtons: ['openOpsContributionDrawerBtn', 'openOpsContributionDrawerBtnInline'],
        deniedText: '仅管理员可查看用例贡献',
        selectText: '请先选择人员查看用例贡献',
        emptyText: '暂无贡献数据',
        filteredEmptyText: '筛选后暂无贡献数据',
      },
      execContribution: {
        stateKey: 'execContribution',
        viewKey: 'exec-contribution',
        mode: 'exec',
        card: dom.execContributionCard,
        list: dom.execContributionList,
        empty: dom.execContributionEmpty,
        status: dom.execContributionStatus,
        drawerStatus: dom.execContributionDrawerStatus,
        userGrid: dom.execContributionUserGrid,
        selectAll: dom.execContributionSelectAll,
        applyBtn: dom.execContributionApplyBtn,
        userEmpty: dom.execContributionUserEmpty,
        timeRange: dom.execContributionTimeRange,
        dateStart: dom.execContributionDateStart,
        dateEnd: dom.execContributionDateEnd,
        behaviorGrid: dom.execContributionBehaviorGrid,
        refreshBtn: dom.execContributionRefreshBtn,
        selectionText: dom.execContributionSelectionText,
        userDatasetKey: 'opsExecContributionUser',
        behaviorDatasetKey: 'opsExecContributionBehavior',
        drawerId: 'opsExecContributionDrawer',
        openButtons: ['openOpsExecContributionDrawerBtn', 'openOpsExecContributionDrawerBtnInline'],
        deniedText: '仅管理员可查看用例执行贡献',
        selectText: '请先选择人员查看用例执行贡献',
        emptyText: '暂无贡献数据',
        filteredEmptyText: '筛选后暂无贡献数据',
      },
    };

    function getConfigByView(viewKey) {
      var normalized = normalizeView(viewKey);
      if (normalized === 'contribution') return configs.contribution;
      if (normalized === 'exec-contribution') return configs.execContribution;
      return configs.activity;
    }

    function getViewState(config) {
      return state[config.stateKey];
    }

    function readPersisted(config) {
      var key = storageKeys[config.stateKey];
      if (!key || !storage || typeof storage.getJson !== 'function') return null;
      return storage.getJson(key, null);
    }

    function getSelectedBehaviorKeys(config) {
      var selected = getViewState(config).selectedBehaviors || {};
      if (selected.all) return [];
      return Object.keys(selected).filter(function(key) { return key !== 'all' && selected[key]; });
    }

    function persist(config) {
      var key = storageKeys[config.stateKey];
      if (!key || !storage || typeof storage.setJson !== 'function') return;
      var viewState = getViewState(config);
      storage.setJson(key, {
        userIds: Array.isArray(viewState.selectedUserIds) ? viewState.selectedUserIds.slice() : [],
        timeRange: viewState.timeRange || defaultRange,
        dateStart: viewState.dateStart || '',
        dateEnd: viewState.dateEnd || '',
        behaviors: getSelectedBehaviorKeys(config),
        behaviorAll: Boolean(viewState.selectedBehaviors && viewState.selectedBehaviors.all),
        hasSelection: Boolean(viewState.hasSelection),
        savedAt: now(),
      });
    }

    function restore(config) {
      var saved = readPersisted(config);
      if (!saved || typeof saved !== 'object') return;
      var viewState = getViewState(config);
      var ids = Array.isArray(saved.userIds) ? saved.userIds : [];
      viewState.selectedUserIds = ids.map(function(id) { return String(id); }).filter(Boolean);
      viewState.draftUserIds = viewState.selectedUserIds.slice();
      viewState.timeRange = saved.timeRange ? String(saved.timeRange) : defaultRange;
      viewState.dateStart = saved.dateStart ? String(saved.dateStart) : '';
      viewState.dateEnd = saved.dateEnd ? String(saved.dateEnd) : '';
      viewState.hasSelection = Boolean(saved.hasSelection || viewState.selectedUserIds.length);
      viewState.selectedBehaviors = { all: true };
      if (saved.behaviorAll === true) return;
      var behaviors = Array.isArray(saved.behaviors) ? saved.behaviors : [];
      if (!behaviors.length) return;
      viewState.selectedBehaviors = { all: false };
      behaviors.forEach(function(key) {
        if (key) viewState.selectedBehaviors[String(key)] = true;
      });
    }

    function setDraftUserIds(config, ids) {
      var seen = {};
      getViewState(config).draftUserIds = (Array.isArray(ids) ? ids : []).map(function(id) {
        return String(id || '').trim();
      }).filter(function(id) {
        if (!id || seen[id]) return false;
        seen[id] = true;
        return true;
      });
    }

    function getUserIds() {
      return (Array.isArray(state.users) ? state.users : []).map(function(user) {
        return user && (user.id || user.id === 0) ? String(user.id) : '';
      }).filter(Boolean);
    }

    function getUserNameMap() {
      var map = {};
      (Array.isArray(state.users) ? state.users : []).forEach(function(user) {
        if (!user || (user.id === null || user.id === undefined)) return;
        var id = String(user.id);
        map[id] = String(user.username || ('用户#' + id));
      });
      return map;
    }

    function syncSelectionText(config) {
      if (!config.selectionText) return;
      var selected = getViewState(config).selectedUserIds || [];
      if (!selected.length) {
        config.selectionText.textContent = '未选择';
        return;
      }
      var nameMap = getUserNameMap();
      var names = selected.map(function(id) { return nameMap[id] || ('用户#' + id); });
      var shown = names.slice(0, 3);
      config.selectionText.textContent = shown.join('、')
        + (names.length > shown.length ? (' 等' + names.length + ' 人') : '');
    }

    function syncUserGrid(config) {
      if (!config.userGrid) return;
      var users = Array.isArray(state.users) ? state.users : [];
      var draft = getViewState(config).draftUserIds || [];
      var selectedMap = {};
      draft.forEach(function(id) { selectedMap[String(id)] = true; });
      if (!users.length) {
        config.userGrid.innerHTML = '';
        if (config.userEmpty) config.userEmpty.classList.remove('hidden');
        if (config.selectAll) config.selectAll.checked = false;
        return;
      }
      if (config.userEmpty) config.userEmpty.classList.add('hidden');
      config.userGrid.innerHTML = users.map(function(user) {
        if (!user || (user.id === null || user.id === undefined)) return '';
        var id = String(user.id);
        return '<label class="ops-activity-user-chip">'
          + '<input type="checkbox" data-' + config.userDatasetKey.replace(/[A-Z]/g, function(ch) {
              return '-' + ch.toLowerCase();
            }) + '="' + escapeHtml(id) + '"' + (selectedMap[id] ? ' checked' : '') + ' />'
          + '<span>' + escapeHtml(user.username || ('用户#' + id)) + '</span>'
          + '</label>';
      }).join('');
      if (config.selectAll) config.selectAll.checked = Boolean(draft.length && draft.length === users.length);
    }

    function syncBehaviorSelection(config) {
      var viewState = getViewState(config);
      var selected = viewState.selectedBehaviors || { all: true };
      if (selected.all) return false;
      var available = {};
      (viewState.behaviors || []).forEach(function(item) {
        if (item && item.key) available[item.key] = true;
      });
      var keys = Object.keys(selected).filter(function(key) {
        return key !== 'all' && selected[key] && available[key];
      });
      if (!keys.length) {
        viewState.selectedBehaviors = { all: true };
        return true;
      }
      var next = { all: false };
      keys.forEach(function(key) { next[key] = true; });
      viewState.selectedBehaviors = next;
      return false;
    }

    function syncBehaviorFilters(config) {
      if (!config.behaviorGrid) return;
      var viewState = getViewState(config);
      var list = Array.isArray(viewState.behaviors) ? viewState.behaviors : [];
      if (!list.length && config.mode === 'activity') {
        config.behaviorGrid.innerHTML = '<span class="hint">暂无可用行为</span>';
        return;
      }
      var source = list;
      if (!source.length && config.mode === 'contribution') source = model.CONTRIBUTION_BEHAVIORS;
      if (!source.length && config.mode === 'exec') source = model.EXEC_CONTRIBUTION_BEHAVIORS;
      var selected = viewState.selectedBehaviors || { all: true };
      var dataName = config.behaviorDatasetKey.replace(/[A-Z]/g, function(ch) { return '-' + ch.toLowerCase(); });
      var html = [
        '<label class="ops-activity-filter-chip">'
          + '<input type="checkbox" data-' + dataName + '="all"' + (selected.all ? ' checked' : '') + ' />'
          + '<span>全部</span>'
        + '</label>'
      ];
      source.forEach(function(item) {
        if (!item || !item.key) return;
        var checked = !selected.all && selected[item.key] ? ' checked' : '';
        html.push(
          '<label class="ops-activity-filter-chip">'
            + '<input type="checkbox" data-' + dataName + '="' + escapeHtml(item.key) + '"' + checked + ' />'
            + '<span>' + escapeHtml(item.label || item.key) + ' ' + Number(item.count || 0) + '</span>'
          + '</label>'
        );
      });
      config.behaviorGrid.innerHTML = html.join('');
    }

    function syncRangeControls(config) {
      var viewState = getViewState(config);
      if (config.timeRange) config.timeRange.value = viewState.timeRange || defaultRange;
      if (config.dateStart) config.dateStart.value = viewState.dateStart || '';
      if (config.dateEnd) config.dateEnd.value = viewState.dateEnd || '';
    }

    function getRangeStartMs(config) {
      var range = getViewState(config).timeRange || defaultRange;
      if (range === 'all') return null;
      var dateValue = new Date(now());
      if (range === 'year') return new Date(dateValue.getFullYear(), 0, 1).getTime();
      if (range === 'month') return new Date(dateValue.getFullYear(), dateValue.getMonth(), 1).getTime();
      if (range === 'day') return new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate()).getTime();
      if (range === 'week') {
        var base = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
        var day = base.getDay();
        base.setDate(base.getDate() - (day === 0 ? 6 : day - 1));
        return base.getTime();
      }
      return null;
    }

    function getRange(config) {
      var viewState = getViewState(config);
      var range = getDateRangeMs(viewState.dateStart, viewState.dateEnd);
      if (range.startMs !== null || range.endMs !== null) return range;
      return { startMs: getRangeStartMs(config), endMs: null };
    }

    function filterLogs(config) {
      var viewState = getViewState(config);
      var selected = {};
      (viewState.selectedUserIds || []).forEach(function(id) { selected[String(id)] = true; });
      if (!Object.keys(selected).length) return [];
      var range = getRange(config);
      return (Array.isArray(viewState.logs) ? viewState.logs : []).filter(function(log) {
        if (!log || (config.mode === 'activity' && !isAllowedLog(log))) return false;
        var userId = log.user_id || log.user_id === 0 ? String(log.user_id) : '';
        return Boolean(userId && selected[userId] && isTimeInRange(log.created_at, range));
      });
    }

    function appendMissingUsers(users, selectedIds, mode) {
      var result = Array.isArray(users) ? users.slice() : [];
      var existing = {};
      result.forEach(function(user) { if (user && user.id) existing[String(user.id)] = true; });
      var nameMap = getUserNameMap();
      (selectedIds || []).forEach(function(id) {
        var key = String(id || '');
        if (!key || existing[key]) return;
        var base = { id: key, name: nameMap[key] || ('用户#' + key), total: 0 };
        if (mode === 'exec') {
          base.execCount = 0;
          base.archiveCount = 0;
        } else {
          base.actions = [];
        }
        result.push(base);
      });
      return result;
    }

    function getColor(config, label) {
      var viewState = getViewState(config);
      var key = String(label || '').trim().toLowerCase();
      if (!key) return '#9ca3af';
      if (viewState.colorMap[key]) return viewState.colorMap[key];
      var hash = 0;
      for (var i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
      var color = DEFAULT_PALETTE[Math.abs(hash) % DEFAULT_PALETTE.length];
      viewState.colorMap[key] = color;
      return color;
    }

    function buildViewUsers(config, filteredLogs) {
      var viewState = getViewState(config);
      var summary = model.buildSummary(filteredLogs, {
        mode: config.mode,
        userNameMap: getUserNameMap(),
        resolveActivityActionLabel: resolveActivityActionLabel,
      });
      viewState.behaviors = summary.behaviors;
      syncBehaviorSelection(config);
      var users = config.mode === 'exec'
        ? model.selectExecUsers(summary, viewState.selectedBehaviors)
        : model.selectActionUsers(summary, viewState.selectedBehaviors, config.mode);
      return appendMissingUsers(users, viewState.selectedUserIds, config.mode);
    }

    function renderActionBars(config, users) {
      var maxTotal = 0;
      users.forEach(function(user) { if (user.total > maxTotal) maxTotal = user.total; });
      return users.map(function(user) {
        var total = user.total || 0;
        var trackWidth = maxTotal ? (total / maxTotal) * barMaxRatio : 0;
        var segments = (user.actions || []).map(function(item) {
          var width = total ? (item.count / total) * 100 : 0;
          var label = item.label || '';
          return '<span class="ops-activity-bar-seg" title="' + escapeHtml(label + ' ' + item.count)
            + '" style="width:' + width.toFixed(2) + '%;background:' + getColor(config, label) + ';"></span>';
        }).join('');
        return '<div class="ops-activity-row">'
          + '<div class="ops-activity-user">' + escapeHtml(user.name) + '</div>'
          + '<div class="ops-activity-bar">'
            + '<div class="ops-activity-bar-track" style="width:' + trackWidth.toFixed(2) + '%;">' + segments + '</div>'
            + '<div class="ops-activity-count">' + total + '</div>'
          + '</div>'
        + '</div>';
      }).join('');
    }

    function renderExecBars(users, selectedBehaviors) {
      var selected = selectedBehaviors || { all: true };
      var allowExec = selected.all || Boolean(selected.exec);
      var allowArchive = selected.all || Boolean(selected.archive);
      if (!allowExec && !allowArchive) {
        allowExec = true;
        allowArchive = true;
      }
      var maxTotal = 0;
      users.forEach(function(user) {
        if (allowExec) maxTotal = Math.max(maxTotal, user.execCount || 0);
        if (allowArchive) maxTotal = Math.max(maxTotal, user.archiveCount || 0);
      });
      return users.map(function(user) {
        var bars = [];
        function appendBar(label, count, color) {
          var width = maxTotal ? (count / maxTotal) * barMaxRatio : 0;
          bars.push('<div class="ops-activity-bar-item">'
            + '<div class="ops-activity-bar-label">' + label + '</div>'
            + '<div class="ops-activity-bar-track exec-contribution" style="width:' + width.toFixed(2) + '%;">'
              + (count ? '<span class="ops-activity-bar-seg" title="' + label + ' ' + count
                + '" style="width:100%;background:' + color + ';"></span>' : '')
            + '</div>'
            + '<div class="ops-activity-count compact">' + count + '</div>'
          + '</div>');
        }
        if (allowExec) appendBar('执行', user.execCount || 0, '#3b82f6');
        if (allowArchive) appendBar('归档', user.archiveCount || 0, '#10b981');
        return '<div class="ops-activity-row ops-activity-row-stacked">'
          + '<div class="ops-activity-user">' + escapeHtml(user.name) + '</div>'
          + '<div class="ops-activity-bar ops-activity-bar-stack">' + bars.join('') + '</div>'
        + '</div>';
      }).join('');
    }

    function render(config) {
      if (!config.list || !config.empty) return;
      var viewState = getViewState(config);
      syncSelectionText(config);
      if (!canView()) {
        config.list.innerHTML = '';
        config.empty.textContent = config.deniedText;
        config.empty.classList.remove('hidden');
        setStatus(config.status, config.deniedText, 'warn');
        viewState.behaviors = [];
        syncBehaviorFilters(config);
        return;
      }
      if (!viewState.hasSelection || !viewState.selectedUserIds.length) {
        config.list.innerHTML = '';
        config.empty.textContent = config.selectText;
        config.empty.classList.remove('hidden');
        setStatus(config.status, '', '');
        viewState.behaviors = [];
        syncBehaviorFilters(config);
        return;
      }
      var filteredLogs = filterLogs(config);
      var users = buildViewUsers(config, filteredLogs);
      syncBehaviorFilters(config);
      if (!users.length) {
        config.list.innerHTML = '';
        config.empty.textContent = filteredLogs.length ? config.filteredEmptyText : config.emptyText;
        config.empty.classList.remove('hidden');
        return;
      }
      config.empty.classList.add('hidden');
      config.list.innerHTML = config.mode === 'exec'
        ? renderExecBars(users, viewState.selectedBehaviors)
        : renderActionBars(config, users);
    }

    function resolveSingleUserId(ids) {
      if (!Array.isArray(ids) || ids.length !== 1) return null;
      var userId = Number(ids[0]);
      return Number.isFinite(userId) ? userId : null;
    }

    function loadViewLogs(config, force) {
      var viewState = getViewState(config);
      if (!canView()) {
        viewState.logs = [];
        viewState.logsLoaded = true;
        render(config);
        return Promise.resolve([]);
      }
      if (viewState.loading || (viewState.logsLoaded && !force)) return Promise.resolve(viewState.logs);
      viewState.loading = true;
      if (config.refreshBtn) config.refreshBtn.disabled = true;
      setStatus(config.status, '加载中...', '');
      return fetchLogs(getRange(config), { userId: resolveSingleUserId(viewState.selectedUserIds) })
        .then(function(list) {
          viewState.logs = Array.isArray(list) ? list : [];
          viewState.logsLoaded = true;
          viewState.lastFetchedAt = now();
          setStatus(config.status, '已加载 ' + viewState.logs.length + ' 条记录', 'ok');
          return viewState.logs;
        })
        .catch(function(err) {
          viewState.logs = [];
          viewState.logsLoaded = true;
          setStatus(config.status, err && err.message ? err.message : '加载失败', 'err');
          return [];
        })
        .finally(function() {
          viewState.loading = false;
          if (config.refreshBtn) config.refreshBtn.disabled = false;
        });
    }

    function refresh(config, force) {
      var viewState = getViewState(config);
      if (!viewState.hasSelection || !viewState.selectedUserIds.length) {
        render(config);
        return Promise.resolve([]);
      }
      var ensureUsers = viewState.usersLoaded ? Promise.resolve([]) : loadUsers();
      return ensureUsers.then(function() {
        if (!viewState.logsLoaded || force) {
          return loadViewLogs(config, true).then(function() {
            render(config);
            return viewState.logs;
          });
        }
        render(config);
        return viewState.logs;
      });
    }

    function applyView(viewKey, optionsValue) {
      var options = optionsValue || {};
      var config = getConfigByView(viewKey);
      state.overviewView = config.viewKey;
      Object.keys(configs).forEach(function(key) {
        var card = configs[key].card;
        if (card && card.classList) card.classList.toggle('hidden', configs[key] !== config);
      });
      if (options.refresh !== false) refresh(config, true);
      if (options.persist !== false) persistRootViewState();
    }

    function shouldAutoRefresh(config) {
      var viewState = getViewState(config);
      if (!Number.isFinite(autoRefreshIntervalMs) || autoRefreshIntervalMs <= 0) return true;
      if (!viewState.logsLoaded) return true;
      var lastFetchedAt = Number(viewState.lastFetchedAt || 0);
      return !isFinite(lastFetchedAt) || lastFetchedAt <= 0 || now() - lastFetchedAt >= autoRefreshIntervalMs;
    }

    function refreshCurrentByPolicy() {
      var config = getConfigByView(state.overviewView);
      return refresh(config, shouldAutoRefresh(config));
    }

    function ensureDrawer(config) {
      var viewState = getViewState(config);
      if (viewState.drawer) return viewState.drawer;
      viewState.drawer = createDrawer({
        drawerId: config.drawerId,
        openButtons: config.openButtons,
        onOpen: function() {
          applyView(config.viewKey);
          setStatus(config.drawerStatus, '', '');
          setDraftUserIds(config, viewState.selectedUserIds);
          syncUserGrid(config);
          if (!viewState.usersLoaded) loadUsers().then(function() { syncUserGrid(config); });
        },
        onClose: function() {
          setDraftUserIds(config, viewState.selectedUserIds);
          syncUserGrid(config);
        },
      });
      return viewState.drawer;
    }

    function bindConfigEvents(config) {
      var viewState = getViewState(config);
      if (config.selectAll) {
        config.selectAll.addEventListener('change', function() {
          setDraftUserIds(config, config.selectAll.checked ? getUserIds() : []);
          syncUserGrid(config);
        });
      }
      if (config.userGrid) {
        config.userGrid.addEventListener('change', function(event) {
          var target = event && event.target ? event.target : null;
          var key = target && target.dataset ? String(target.dataset[config.userDatasetKey] || '') : '';
          if (!key) return;
          var draft = viewState.draftUserIds.slice();
          var index = draft.indexOf(key);
          if (target.checked && index === -1) draft.push(key);
          else if (!target.checked && index !== -1) draft.splice(index, 1);
          viewState.draftUserIds = draft;
          syncUserGrid(config);
        });
      }
      if (config.applyBtn) {
        config.applyBtn.addEventListener('click', function() {
          var draft = viewState.draftUserIds || [];
          if (!draft.length) {
            setStatus(config.drawerStatus, '请至少选择一位人员', 'warn');
            return;
          }
          viewState.selectedUserIds = draft.slice();
          viewState.hasSelection = true;
          persist(config);
          syncSelectionText(config);
          if (viewState.drawer && typeof viewState.drawer.close === 'function') viewState.drawer.close();
          refresh(config, true);
        });
      }
      if (config.timeRange) {
        config.timeRange.addEventListener('change', function() {
          viewState.timeRange = config.timeRange.value || defaultRange;
          persist(config);
          refresh(config, true);
        });
      }
      [
        { element: config.dateStart, key: 'dateStart' },
        { element: config.dateEnd, key: 'dateEnd' },
      ].forEach(function(binding) {
        if (!binding.element) return;
        binding.element.addEventListener('change', function() {
          viewState[binding.key] = binding.element.value || '';
          persist(config);
          refresh(config, true);
        });
      });
      if (config.behaviorGrid) {
        config.behaviorGrid.addEventListener('change', function(event) {
          var target = event && event.target ? event.target : null;
          var key = target && target.dataset ? String(target.dataset[config.behaviorDatasetKey] || '') : '';
          if (!key) return;
          if (key === 'all') {
            viewState.selectedBehaviors = { all: Boolean(target.checked) };
            if (!target.checked) viewState.selectedBehaviors = { all: true };
          } else {
            if (!viewState.selectedBehaviors || viewState.selectedBehaviors.all) {
              viewState.selectedBehaviors = { all: false };
            }
            viewState.selectedBehaviors[key] = Boolean(target.checked);
            syncBehaviorSelection(config);
          }
          syncBehaviorFilters(config);
          persist(config);
          render(config);
        });
      }
      if (config.refreshBtn) {
        config.refreshBtn.addEventListener('click', function() { refresh(config, true); });
      }
    }

    function notifyUsersChanged() {
      Object.keys(configs).forEach(function(key) {
        var config = configs[key];
        getViewState(config).usersLoaded = true;
        syncUserGrid(config);
        syncSelectionText(config);
      });
    }

    function renderAll() {
      Object.keys(configs).forEach(function(key) { render(configs[key]); });
    }

    function initialize() {
      Object.keys(configs).forEach(function(key) {
        var config = configs[key];
        restore(config);
        ensureDrawer(config);
        syncRangeControls(config);
        setDraftUserIds(config, getViewState(config).selectedUserIds);
        syncUserGrid(config);
        syncBehaviorFilters(config);
        syncSelectionText(config);
      });
      applyView(state.overviewView, { persist: false });
      if (!bound) {
        bound = true;
        Object.keys(configs).forEach(function(key) { bindConfigEvents(configs[key]); });
      }
    }

    return {
      applyView: applyView,
      handlePageSizeChanged: function() { render(getConfigByView(state.overviewView)); },
      initialize: initialize,
      notifyUsersChanged: notifyUsersChanged,
      refreshCurrentByPolicy: refreshCurrentByPolicy,
      renderAll: renderAll,
    };
  }

  return { create: create };
});
