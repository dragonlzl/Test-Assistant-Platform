(function() {
  var apiClient = window.app && window.app.apiClient;
  var state = window.app && window.app.state;
  if (!apiClient || !state) return;

  var dom = {
    refreshBtn: document.getElementById('opsLogRefresh'),
    limitSelect: document.getElementById('opsLogLimit'),
    statusEl: document.getElementById('opsLogStatus'),
    tableBody: document.getElementById('opsLogTableBody'),
    emptyHint: document.getElementById('opsLogEmpty'),
    tabBtn: document.querySelector('[data-tab-btn="ops-log"]'),
    tabSection: document.querySelector('[data-tab-section="ops-log"]'),
  };
  var loading = false;

  function setStatus(text, type) {
    if (!dom.statusEl) return;
    dom.statusEl.textContent = text || '';
    dom.statusEl.className = ['status', type || ''].filter(Boolean).join(' ');
  }

  function formatTime(value) {
    if (!value) return '--';
    try {
      return new Date(value).toLocaleString();
    } catch (e) {
      return value;
    }
  }

  function renderLogs(logs) {
    if (!dom.tableBody) return;
    if (!logs || !logs.length) {
      dom.tableBody.innerHTML = '';
      if (dom.emptyHint) dom.emptyHint.classList.remove('hidden');
      return;
    }
    if (dom.emptyHint) dom.emptyHint.classList.add('hidden');
    dom.tableBody.innerHTML = logs.map(function(log) {
      var target = [log.target_type || '--', log.target_id || ''].filter(Boolean).join('#');
      var detailText = '';
      try {
        detailText = log.detail ? JSON.stringify(log.detail) : '';
      } catch (e) {
        detailText = '';
      }
      return (
        '<tr>' +
          '<td>' + formatTime(log.created_at) + '</td>' +
          '<td>' + (log.username || log.user_id || '--') + '</td>' +
          '<td>' + (log.action || '--') + '</td>' +
          '<td>' + (target || '--') + '</td>' +
          '<td>' + (log.result || '--') + '</td>' +
          '<td class="mono">' + (detailText || '') + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function getLimit() {
    if (!dom.limitSelect) return 100;
    var val = Number(dom.limitSelect.value);
    if (!Number.isFinite(val) || val <= 0) return 100;
    return val;
  }

  function canView() {
    return state && state.currentUser && state.currentUser.role === 'admin';
  }

  function refreshLogs() {
    if (!canView()) {
      setStatus('仅管理员可查看操作记录', 'warn');
      renderLogs([]);
      return;
    }
    if (loading) return;
    loading = true;
    setStatus('加载中...', '');
    if (dom.refreshBtn) dom.refreshBtn.disabled = true;
    apiClient.listOperationLogs({ limit: getLimit() }).then(function(data) {
      renderLogs(data || []);
      setStatus('已加载 ' + (data ? data.length : 0) + ' 条记录', 'ok');
    }).catch(function(err) {
      setStatus(err && err.message ? err.message : '加载失败', 'error');
      renderLogs([]);
    }).finally(function() {
      loading = false;
      if (dom.refreshBtn) dom.refreshBtn.disabled = false;
    });
  }

  function bindEvents() {
    if (dom.refreshBtn) {
      dom.refreshBtn.addEventListener('click', refreshLogs);
    }
    if (dom.limitSelect) {
      dom.limitSelect.addEventListener('change', refreshLogs);
    }
    if (dom.tabBtn) {
      dom.tabBtn.addEventListener('click', refreshLogs);
    }
  }

  function init() {
    bindEvents();
    var visible = dom.tabSection && !dom.tabSection.classList.contains('hidden');
    if (visible) refreshLogs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
