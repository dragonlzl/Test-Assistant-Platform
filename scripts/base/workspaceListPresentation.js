(function() {
  window.app = window.app || {};

  var scheduled = false;
  var observed = [];
  var commandIcons = {
    caseLibraryEditClearSearchBtn: 'close',
    caseLibraryAiGenBtn: 'sparkles',
    caseLibraryXmindViewBtn: 'xmind',
    caseLibraryEditBatchAddBtn: 'plus',
    caseLibraryEditBatchDeleteBtn: 'trash',
    caseLibraryEditToExecBtn: 'play'
  };

  function getIcons() {
    return window.app && window.app.workspaceIcons ? window.app.workspaceIcons : null;
  }

  function renderIcon(name) {
    var icons = getIcons();
    if (!icons || typeof icons.render !== 'function') return '';
    return icons.render(name, 'workspace-command-icon');
  }

  function normalizePriority(value) {
    var text = String(value || '').replace(/\s+/g, '').toUpperCase();
    if (text === 'P0' || text === 'P1' || text === 'P2' || text === 'P3') return text.toLowerCase();
    if (text === '高' || text === 'HIGH' || text === '紧急') return 'high';
    if (text === '中' || text === 'MEDIUM') return 'medium';
    if (text === '低' || text === 'LOW') return 'low';
    return '';
  }

  function normalizeStatus(value) {
    var text = String(value || '').trim();
    if (text === '通过' || text === '已完成' || text === '成功') return 'success';
    if (text === '失败' || text === '未通过') return 'danger';
    if (text === '阻塞' || text === '有改动' || text === '变更重跑') return 'warning';
    if (text === '不适用' || text === '跳过') return 'info';
    return 'idle';
  }

  function readText(element) {
    return element ? String(element.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function clearGeneratedTooltip(element) {
    if (!element || !element.dataset) return;
    if (element.dataset.workspaceTitle === '1') element.removeAttribute('title');
    element.dataset.workspaceTitle = '0';
  }

  function decorateInlineEditor(editor) {
    if (!editor) return;
    var text = readText(editor);
    var field = editor.getAttribute('data-temp-edit-field')
      || editor.getAttribute('data-case-lib-edit-field')
      || editor.getAttribute('data-case-lib-missing-field')
      || editor.getAttribute('data-case-lib-import-invalid-field')
      || '';
    editor.removeAttribute('data-workspace-clamp');
    editor.setAttribute('data-workspace-wrap', 'true');
    clearGeneratedTooltip(editor);
    if (String(field).toLowerCase().indexOf('priority') !== -1) {
      var priority = normalizePriority(text);
      if (priority) editor.setAttribute('data-priority', priority);
      else editor.removeAttribute('data-priority');
    }
  }

  function decoratePlainCell(cell) {
    if (!cell || cell.querySelector('input, select, textarea, button, [contenteditable="true"]')) return;
    var text = readText(cell);
    if (!text) return;
    cell.removeAttribute('data-workspace-clamp-cell');
    cell.setAttribute('data-workspace-wrap-cell', 'true');
    clearGeneratedTooltip(cell);
  }

  function decorateStatusSelect(select) {
    if (!select) return;
    var value = select.value || select.getAttribute('data-status') || '';
    select.setAttribute('data-workspace-state', normalizeStatus(value));
  }

  function decoratePrioritySelect(select) {
    if (!select) return;
    var priority = normalizePriority(select.value || select.getAttribute('data-priority') || '');
    if (priority) select.setAttribute('data-priority', priority);
    else select.removeAttribute('data-priority');
  }

  function decorateContainer(container) {
    if (!container) return;
    container.classList.add('workspace-list-view');
    Array.prototype.forEach.call(container.querySelectorAll('table'), function(table) {
      table.classList.add('workspace-data-table');
    });
    Array.prototype.forEach.call(container.querySelectorAll('.temp-inline-edit'), decorateInlineEditor);
    Array.prototype.forEach.call(container.querySelectorAll('tr.case-row > td.module, tr.case-row > td.title'), decoratePlainCell);
    Array.prototype.forEach.call(container.querySelectorAll('.status-select'), decorateStatusSelect);
    Array.prototype.forEach.call(container.querySelectorAll('.priority-select'), decoratePrioritySelect);
  }

  function decorateListHeaders() {
    var labels = {
      tempexec: '用例执行',
      'case-library': '用例库'
    };
    Object.keys(labels).forEach(function(key) {
      var nav = document.querySelector('[data-top-nav="' + key + '"]');
      if (!nav) return;
      nav.classList.add('workspace-list-header');
      var title = nav.querySelector('.flow-title');
      if (title) title.textContent = labels[key];
    });
  }

  function decorateCommands() {
    Object.keys(commandIcons).forEach(function(id) {
      var button = document.getElementById(id);
      if (!button || button.dataset.workspaceIconReady === '1') return;
      button.dataset.workspaceIconReady = '1';
      button.classList.add('workspace-command');
      button.insertAdjacentHTML('afterbegin', renderIcon(commandIcons[id]));
    });
  }

  function refresh() {
    scheduled = false;
    var targets = [
      document.getElementById('tempExecView'),
      document.getElementById('caseLibraryEditView'),
      document.getElementById('caseLibraryMissingView')
    ];
    targets.forEach(decorateContainer);
    decorateListHeaders();
    decorateCommands();
  }

  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;
    var raf = window.requestAnimationFrame || function(callback) { return window.setTimeout(callback, 16); };
    raf(refresh);
  }

  function observeContainer(container) {
    if (!container || observed.indexOf(container) !== -1) return;
    observed.push(container);
    var observer = new MutationObserver(scheduleRefresh);
    observer.observe(container, { childList: true, subtree: true });
  }

  function bindEvents() {
    document.addEventListener('focusin', function(event) {
      var editor = event.target && event.target.closest ? event.target.closest('.temp-inline-edit') : null;
      if (!editor) return;
      editor.classList.add('workspace-is-editing');
      editor.removeAttribute('title');
    });
    document.addEventListener('focusout', function(event) {
      var editor = event.target && event.target.closest ? event.target.closest('.temp-inline-edit') : null;
      if (!editor) return;
      editor.classList.remove('workspace-is-editing');
      decorateInlineEditor(editor);
    });
    document.addEventListener('change', function(event) {
      var statusSelect = event.target && event.target.closest ? event.target.closest('.status-select') : null;
      if (statusSelect) decorateStatusSelect(statusSelect);
      var prioritySelect = event.target && event.target.closest ? event.target.closest('.priority-select') : null;
      if (prioritySelect) decoratePrioritySelect(prioritySelect);
    });
  }

  function init() {
    if (document.documentElement.dataset.workspaceListReady === '1') return;
    document.documentElement.dataset.workspaceListReady = '1';
    [
      document.getElementById('tempExecView'),
      document.getElementById('caseLibraryEditView'),
      document.getElementById('caseLibraryMissingView')
    ].forEach(observeContainer);
    bindEvents();
    refresh();
  }

  window.app.workspaceListPresentation = {
    init: init,
    refresh: refresh
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
