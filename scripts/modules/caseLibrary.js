(function() {
  var apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
  if (!apiClient) return;

  var utils = window.app && window.app.utils ? window.app.utils : {};

  function safeLogOperation(action, targetType, targetId, detail, result) {
    if (!apiClient || typeof apiClient.createOperationLogEvent !== 'function') return;
    try {
      apiClient.createOperationLogEvent({
        action: action,
        target_type: targetType,
        target_id: targetId,
        result: result || undefined,
        detail: detail || null,
      }).catch(function() {
        // ignore
      });
    } catch (err) {
      // ignore
    }
  }

  function getCore() {
    return window.app && window.app.core ? window.app.core : {};
  }

  function openConfirmDrawer(options) {
    if (utils && typeof utils.openConfirmDrawer === 'function') {
      return utils.openConfirmDrawer(options || {});
    }
    var msg = options && options.message ? String(options.message) : '';
    var ok = true;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      ok = window.confirm(msg);
    }
    return Promise.resolve({ ok: ok });
  }

  var dom = {
    root: document.getElementById('caseLibrary'),
    status: document.getElementById('caseLibraryStatus'),

    editCard: document.getElementById('caseLibraryEditCard'),
    editCardTitle: document.getElementById('caseLibraryEditCardTitle'),
    editProject: document.getElementById('caseLibraryEditProject'),
    editVersion: document.getElementById('caseLibraryEditVersion'),
    editFileName: document.getElementById('caseLibraryEditFileName'),
	    editSearchInput: document.getElementById('caseLibraryEditSearchInput'),
	    editClearSearchBtn: document.getElementById('caseLibraryEditClearSearchBtn'),
	    editBatchDeleteBtn: document.getElementById('caseLibraryEditBatchDeleteBtn'),
	    editBatchAddCountInput: document.getElementById('caseLibraryEditBatchAddCountInput'),
	    editBatchAddBtn: document.getElementById('caseLibraryEditBatchAddBtn'),
	    editToExecBtn: document.getElementById('caseLibraryEditToExecBtn'),
	    editStatus: document.getElementById('caseLibraryEditStatus'),
	    editView: document.getElementById('caseLibraryEditView'),

    importDropZone: document.getElementById('caseLibraryImportDropZone'),
    importInput: document.getElementById('caseLibraryImportInput'),
    importFileHint: document.getElementById('caseLibraryImportFileHint'),
    importProjectSelect: document.getElementById('caseLibraryImportProjectSelect'),
    importVersionSelect: document.getElementById('caseLibraryImportVersionSelect'),
    importExcelTemplateTypeSelect: document.getElementById('caseLibraryImportExcelTemplateType'),
    importExcelTemplateBtn: document.getElementById('caseLibraryImportExcelTemplateBtn'),
    importXmindTemplateBtn: document.getElementById('caseLibraryImportXmindTemplateBtn'),
    importConfirmBtn: document.getElementById('caseLibraryImportConfirmBtn'),
    importStatus: document.getElementById('caseLibraryImportStatus'),

    importDiffTitle: document.getElementById('caseLibraryImportDiffTitle'),
    importDiffStatus: document.getElementById('caseLibraryImportDiffStatus'),
    importDiffMeta: document.getElementById('caseLibraryImportDiffMeta'),
    importDiffLocateBar: document.getElementById('caseLibraryImportDiffLocateBar'),
    importDiffBody: document.getElementById('caseLibraryImportDiffBody'),
	    importDiffOverwriteBtn: document.getElementById('caseLibraryImportDiffOverwriteBtn'),
	    importInvalidTitle: document.getElementById('caseLibraryImportInvalidTitle'),
	    importInvalidStatus: document.getElementById('caseLibraryImportInvalidStatus'),
	    importInvalidBody: document.getElementById('caseLibraryImportInvalidBody'),
	    importInvalidConfirmBtn: document.getElementById('caseLibraryImportInvalidConfirmBtn'),
      importDuplicateTitle: document.getElementById('caseLibraryImportDuplicateTitle'),
      importDuplicateStatus: document.getElementById('caseLibraryImportDuplicateStatus'),
      importDuplicateBody: document.getElementById('caseLibraryImportDuplicateBody'),
      importDuplicateConfirmBtn: document.getElementById('caseLibraryImportDuplicateConfirmBtn'),

    editDrawerProjectSelect: document.getElementById('caseLibraryEditProjectSelect'),
    editDrawerVersionSelect: document.getElementById('caseLibraryEditVersionSelect'),
    editDrawerOwnerFilterSelect: document.getElementById('caseLibraryEditOwnerFilterSelect'),
    editDrawerFileSearchInput: document.getElementById('caseLibraryEditFileSearchInput'),
    editDrawerConfirmBtn: document.getElementById('caseLibraryEditConfirmBtn'),
    editDrawerExportXmindBtn: document.getElementById('caseLibraryEditExportXmindBtn'),
    editDrawerExportExcelBtn: document.getElementById('caseLibraryEditExportExcelBtn'),
    editDrawerDeleteBtn: document.getElementById('caseLibraryEditDeleteBtn'),
    editDrawerSelectAll: document.getElementById('caseLibraryEditSelectAll'),
    editDrawerStatus: document.getElementById('caseLibraryEditDrawerStatus'),
    editDrawerListBody: document.getElementById('caseLibraryEditListBody'),

    selectProjectSelect: document.getElementById('caseLibrarySelectProjectSelect'),
    selectVersionSelect: document.getElementById('caseLibrarySelectVersionSelect'),
    selectConfirmBtn: document.getElementById('caseLibrarySelectConfirmBtn'),
    selectSelectAll: document.getElementById('caseLibrarySelectSelectAll'),
    selectBatchExecBtn: document.getElementById('caseLibrarySelectBatchExecBtn'),
    selectStatus: document.getElementById('caseLibrarySelectDrawerStatus'),
    selectListBody: document.getElementById('caseLibrarySelectListBody'),

    historyDrawerProjectSelect: document.getElementById('caseLibraryHistoryProjectSelect'),
    historyDrawerVersionSelect: document.getElementById('caseLibraryHistoryVersionSelect'),
    historyDrawerSearchInput: document.getElementById('caseLibraryHistorySearchInput'),
    historyDrawerQueryBtn: document.getElementById('caseLibraryHistoryQueryBtn'),
    historyDrawerClearBtn: document.getElementById('caseLibraryHistoryClearBtn'),
    historyDrawerStatus: document.getElementById('caseLibraryHistoryDrawerStatus'),
    historyDrawerListBody: document.getElementById('caseLibraryHistoryDrawerListBody'),

    historyDetailCard: document.getElementById('caseLibraryHistoryDetailCard'),
    historyStatus: document.getElementById('caseLibraryHistoryStatus'),
    historyCaseName: document.getElementById('caseLibraryHistoryCaseName'),
    historyRefreshBtn: document.getElementById('caseLibraryHistoryRefreshBtn'),
    historyHideBtn: document.getElementById('caseLibraryHistoryHideBtn'),
    historyAppendPill: document.getElementById('caseLibraryHistoryAppendPill'),
    historyAddedPill: document.getElementById('caseLibraryHistoryAddedPill'),
    historyUpdatedPill: document.getElementById('caseLibraryHistoryUpdatedPill'),
    historyDeletedPill: document.getElementById('caseLibraryHistoryDeletedPill'),
    historyImportPill: document.getElementById('caseLibraryHistoryImportPill'),
    historyReimportPill: document.getElementById('caseLibraryHistoryReimportPill'),
    historyFileDeletedPill: document.getElementById('caseLibraryHistoryFileDeletedPill'),
    historyPaginationTop: document.getElementById('caseLibraryHistoryPaginationTop'),
    historyPaginationBottom: document.getElementById('caseLibraryHistoryPaginationBottom'),
    historyBody: document.getElementById('caseLibraryHistoryBody'),
  };

  var state = {
    projects: [],
    projectNameById: {},

    versionsByProject: {},
    versionNameByProject: {},

    importDrawer: {
      files: [],
      projectId: null,
      versionId: null,
      loading: false,
    },

	    importDiff: {
        mode: 'import',
        caseFileId: null,
	      fileName: '',
	      cleanName: '',
	      importedCleanName: '',
	      source: '',
	      projectId: null,
	      importVersionId: null,
	      dbVersionId: null,
	      importItems: [],
	      dbItems: [],
	      rows: [],
	      loading: false,
        confirming: false,
        locateIndex: -1,
	    },

	    importInvalid: {
	      file: null,
	      fileName: '',
	      cleanName: '',
	      source: '',
	      projectId: null,
	      versionId: null,
	      structuralErrors: [],
	      items: [],
	      invalid: [],
	      loading: false,
	    },

    editDrawer: {
      projectId: null,
      versionId: null,
      ownerFilter: 'me',
      fileSearchText: '',
      files: [],
      execByFileId: {},
      loading: false,
      selection: new Set(),
      restoring: false,
    },

    selectDrawer: {
      projectId: null,
      versionId: null,
      files: [],
      execByFileId: {},
      loading: false,
      processing: false,
      selection: new Set(),
    },

    historyQueryDrawer: {
      projectId: null,
      versionId: null,
      files: [],
      loading: false,
      searchText: '',
    },

    historyDetail: {
      projectId: null,
      fileNameClean: '',
      isDeleted: false,
      versionId: null,
      history: [],
      filter: '',
      loading: false,
      pageIndex: 0,
    },

	    editor: {
	      caseFile: null,
	      items: [],
	      searchText: '',
	      pageIndex: 0,
	      batchAddCount: 5,
	      selection: new Set(),
	      remarkOpen: new Set(),
	      pendingOp: null,
	      pendingTimer: null,
      pendingInterval: null,
      pendingToast: null,
      pendingRemaining: 0,
      restoring: false,
    },
  };

	  var importDrawerInstance = null;
  var importDiffDrawerInstance = null;
  var importDiffDrawerOpenTimer = 0;
	  var importInvalidDrawerInstance = null;
	  var editDrawerInstance = null;
	  var selectDrawerInstance = null;
    var historyDrawerInstance = null;

  function setStatus(el, text, type) {
    var coreApi = getCore();
    var setter = coreApi.setStatus || utils.setStatus;
    if (typeof setter === 'function') {
      setter(el, text, type);
      return;
    }
    if (!el) return;
    el.textContent = text || '';
    el.className = ['status', type || ''].filter(Boolean).join(' ');
  }

  function escapeHtml(text) {
    if (utils && typeof utils.escapeHtml === 'function') return utils.escapeHtml(text);
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeHtmlPreserve(text) {
    if (utils && typeof utils.escapeHtmlPreserve === 'function') return utils.escapeHtmlPreserve(text);
    return escapeHtml(text).replace(/\n/g, '<br/>');
  }

  function normalizeDiffText(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\r\n/g, '\n').trim();
  }

  function buildCaseItemKey(item) {
    if (!item) return '';
    var module = normalizeDiffText(item.module || '').toLowerCase();
    var title = normalizeDiffText(item.title || '').toLowerCase();
    var precondition = normalizeDiffText(item.precondition || item.preconditions || '').toLowerCase();
    var steps = normalizeDiffText(item.steps || '').toLowerCase();
    var expected = normalizeDiffText(item.expected || '').toLowerCase();
    return [module, title, precondition, steps, expected].join('::');
  }

  function dedupeCaseItemsByKey(list) {
    var items = Array.isArray(list) ? list : [];
    var seen = {};
    var out = [];
    items.forEach(function(it) {
      var k = buildCaseItemKey(it);
      if (!k) return;
      if (seen[k]) return;
      seen[k] = true;
      out.push(it);
    });
    return out;
  }

  function compareCaseItemFields(left, right) {
    var diff = {
      priority: false,
      precondition: false,
      steps: false,
    };
    if (!left || !right) return diff;
    diff.priority = normalizeDiffText(left.priority || '') !== normalizeDiffText(right.priority || '');
    diff.precondition = normalizeDiffText(left.precondition || left.preconditions || '') !== normalizeDiffText(right.precondition || right.preconditions || '');
    diff.steps = normalizeDiffText(left.steps || '') !== normalizeDiffText(right.steps || '');
    return diff;
  }

  function compareCaseItemFieldsForAppendOverwrite(left, right) {
    var diff = {
      priority: false,
      precondition: false,
      steps: false,
      expected: false,
      remark: false,
    };
    if (!left || !right) return diff;
    diff.priority = normalizeDiffText(left.priority || '') !== normalizeDiffText(right.priority || '');
    diff.precondition = normalizeDiffText(left.precondition || left.preconditions || '') !== normalizeDiffText(right.precondition || right.preconditions || '');
    diff.steps = normalizeDiffText(left.steps || '') !== normalizeDiffText(right.steps || '');
    diff.expected = normalizeDiffText(left.expected || '') !== normalizeDiffText(right.expected || '');
    diff.remark = normalizeDiffText(left.remark || '') !== normalizeDiffText(right.remark || '');
    return diff;
  }

  function buildImportDiffRows(importItems, dbItems) {
    var leftList = dedupeCaseItemsByKey(importItems);
    var rightList = dedupeCaseItemsByKey(dbItems);
    var leftMap = {};
    var rightMap = {};
    leftList.forEach(function(it) {
      var k = buildCaseItemKey(it);
      if (!k) return;
      leftMap[k] = it;
    });
    rightList.forEach(function(it) {
      var k = buildCaseItemKey(it);
      if (!k) return;
      rightMap[k] = it;
    });
    var keys = {};
    Object.keys(leftMap).forEach(function(k) { keys[k] = true; });
    Object.keys(rightMap).forEach(function(k) { keys[k] = true; });
    var keyList = Object.keys(keys);
    keyList.sort(function(a, b) {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
    return keyList.map(function(k) {
      var left = leftMap[k] || null;
      var right = rightMap[k] || null;
      var rowType = '';
      var fieldDiff = compareCaseItemFields(left, right);
      var changed = Boolean(fieldDiff.priority || fieldDiff.precondition || fieldDiff.steps);
      if (left && !right) rowType = 'added';
      else if (!left && right) rowType = 'removed';
      else if (left && right && changed) rowType = 'changed';
      else rowType = 'same';
      return {
        key: k,
        left: left,
        right: right,
        type: rowType,
        diff: fieldDiff,
      };
    });
  }

  function buildAppendOverwriteDiffRows(appendItems, dbItems) {
    var leftList = Array.isArray(appendItems) ? appendItems : [];
    var rightList = Array.isArray(dbItems) ? dbItems : [];
    var leftMap = {};
    var rightMap = {};
    leftList.forEach(function(it) {
      var k = buildCaseItemKey(it);
      if (!k) return;
      if (leftMap[k]) return;
      leftMap[k] = it;
    });
    rightList.forEach(function(it) {
      var k = buildCaseItemKey(it);
      if (!k) return;
      if (rightMap[k]) return;
      rightMap[k] = it;
    });
    var keys = {};
    Object.keys(leftMap).forEach(function(k) { keys[k] = true; });
    Object.keys(rightMap).forEach(function(k) { keys[k] = true; });
    var keyList = Object.keys(keys);
    keyList.sort(function(a, b) {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
    return keyList.map(function(k) {
      var left = leftMap[k] || null;
      var right = rightMap[k] || null;
      var rowType = '';
      var fieldDiff = compareCaseItemFieldsForAppendOverwrite(left, right);
      var changed = Boolean(fieldDiff.priority || fieldDiff.precondition || fieldDiff.steps || fieldDiff.expected || fieldDiff.remark);
      if (left && !right) rowType = 'added';
      else if (left && right && changed) rowType = 'changed';
      else rowType = 'same';
      return {
        key: k,
        left: left,
        right: right,
        type: rowType,
        diff: fieldDiff,
      };
    });
  }

  function countUniqueCaseItemsByKey(list) {
    var items = Array.isArray(list) ? list : [];
    var seen = {};
    items.forEach(function(it) {
      var k = buildCaseItemKey(it);
      if (!k) return;
      if (seen[k]) return;
      seen[k] = true;
    });
    return Object.keys(seen).length;
  }

  function renderImportDiffTable(bodyEl, rows, side) {
    if (!bodyEl) return;
    if (!rows || !rows.length) {
      bodyEl.innerHTML = '<tr><td colspan="7"><p class="hint">暂无数据</p></td></tr>';
      return;
    }
    bodyEl.innerHTML = rows.map(function(row, idx) {
      var item = side === 'left' ? row.left : row.right;
      var other = side === 'left' ? row.right : row.left;
      var isPlaceholder = !item;
      var rowCls = '';
      if (row.type === 'added' && side === 'left') rowCls = 'diff-row-added';
      if (row.type === 'removed' && side === 'right') rowCls = 'diff-row-removed';
      if (row.type === 'changed') rowCls = 'diff-row-changed';

      var module = item ? (item.module || '') : '';
      var title = item ? (item.title || '') : '';
      var expected = item ? (item.expected || '') : '';
      var priority = item ? (item.priority || '') : '';
      var precondition = item ? (item.precondition || item.preconditions || '') : '';
      var steps = item ? (item.steps || '') : '';

      var priorityCls = '';
      var preconditionCls = '';
      var stepsCls = '';
      if (!isPlaceholder && other && row.type === 'changed') {
        if (row.diff && row.diff.priority) priorityCls = 'diff-cell-changed';
        if (row.diff && row.diff.precondition) preconditionCls = 'diff-cell-changed';
        if (row.diff && row.diff.steps) stepsCls = 'diff-cell-changed';
      }

      var hint = isPlaceholder ? '<p class="hint">（无对应项）</p>' : '';
      return (
        '<tr class="' + escapeHtml(rowCls) + '">' +
          '<td>' + escapeHtml(String(idx + 1)) + '</td>' +
          '<td>' + escapeHtml(module) + '</td>' +
          '<td>' + escapeHtml(title) + hint + '</td>' +
          '<td class="' + escapeHtml(priorityCls) + '">' + escapeHtml(priority) + '</td>' +
          '<td class="' + escapeHtml(preconditionCls) + '">' + escapeHtml(precondition) + '</td>' +
          '<td class="' + escapeHtml(stepsCls) + '">' + escapeHtml(steps) + '</td>' +
          '<td>' + escapeHtml(expected) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function renderImportDiffMergedTable(bodyEl, rows) {
    if (!bodyEl) return;
    if (!rows || !rows.length) {
      bodyEl.innerHTML = '<tr><td colspan="7"><p class="hint">暂无数据</p></td></tr>';
      return;
    }

    function buildValueBlock(leftText, rightText, placeholderText) {
      var left = normalizeDiffText(leftText);
      var right = normalizeDiffText(rightText);
      if (!left && !right) {
        return '<div class="diff-one"><p class="hint">' + escapeHtml(placeholderText || '--') + '</p></div>';
      }
      if (left && right) {
        if (left === right) {
          return '<div class="diff-one">' + escapeHtml(left) + '</div>';
        }
        return (
          '<div class="diff-pair">' +
            '<div class="diff-pair-line diff-pair-left"><span class="diff-pair-tag">导入</span><div class="diff-pair-text">' + escapeHtml(left) + '</div></div>' +
            '<div class="diff-pair-line diff-pair-right"><span class="diff-pair-tag">库</span><div class="diff-pair-text">' + escapeHtml(right) + '</div></div>' +
          '</div>'
        );
      }
      if (left) {
        return (
          '<div class="diff-one diff-one-with-tag">' +
            '<span class="diff-pair-tag">导入</span>' +
            '<div class="diff-pair-text">' + escapeHtml(left) + '</div>' +
          '</div>'
        );
      }
      return (
        '<div class="diff-one diff-one-with-tag">' +
          '<span class="diff-pair-tag">库</span>' +
          '<div class="diff-pair-text">' + escapeHtml(right) + '</div>' +
        '</div>'
      );
    }

    bodyEl.innerHTML = rows.map(function(row, idx) {
      var left = row ? row.left : null;
      var right = row ? row.right : null;
      var rowCls = '';
      if (row && row.type === 'added') rowCls = 'diff-row-added';
      if (row && row.type === 'removed') rowCls = 'diff-row-removed';
      if (row && row.type === 'changed') rowCls = 'diff-row-changed';

      var priorityCls = '';
      var preconditionCls = '';
      var stepsCls = '';
      if (row && row.type === 'changed') {
        if (row.diff && row.diff.priority) priorityCls = 'diff-cell-changed';
        if (row.diff && row.diff.precondition) preconditionCls = 'diff-cell-changed';
        if (row.diff && row.diff.steps) stepsCls = 'diff-cell-changed';
      }

      var badge = '';
      if (row && row.type === 'added') badge = '<span class="diff-badge diff-badge-added">新增</span>';
      else if (row && row.type === 'removed') badge = '<span class="diff-badge diff-badge-removed">将删除</span>';
      else if (row && row.type === 'changed') badge = '<span class="diff-badge diff-badge-changed">有差异</span>';

      return (
        '<tr class="' + escapeHtml(rowCls) + '">' +
          '<td>' + escapeHtml(String(idx + 1)) + '</td>' +
          '<td>' + buildValueBlock(left && left.module, right && right.module, '（缺失）') + '</td>' +
          '<td>' +
            '<div class="diff-cell-stack">' +
              buildValueBlock(left && left.title, right && right.title, '（缺失）') +
              (badge ? ('<div class="diff-badge-row">' + badge + '</div>') : '') +
            '</div>' +
          '</td>' +
          '<td class="' + escapeHtml(priorityCls) + '">' + buildValueBlock(left && left.priority, right && right.priority, '--') + '</td>' +
          '<td class="' + escapeHtml(preconditionCls) + '">' + buildValueBlock(left && (left.precondition || left.preconditions), right && (right.precondition || right.preconditions), '--') + '</td>' +
          '<td class="' + escapeHtml(stepsCls) + '">' + buildValueBlock(left && left.steps, right && right.steps, '--') + '</td>' +
          '<td>' + buildValueBlock(left && left.expected, right && right.expected, '（缺失）') + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  var importDiffLocateHighlightTimer = null;
  function clearImportDiffLocateHighlight() {
    if (importDiffLocateHighlightTimer) clearTimeout(importDiffLocateHighlightTimer);
    importDiffLocateHighlightTimer = null;
    if (!dom.importDiffBody || !dom.importDiffBody.querySelectorAll) return;
    var active = dom.importDiffBody.querySelectorAll('tr.diff-locate-active');
    active.forEach(function(tr) {
      if (!tr || !tr.classList) return;
      tr.classList.remove('diff-locate-active');
    });
  }

  function getImportDiffRowEls() {
    if (!dom.importDiffBody || !dom.importDiffBody.querySelectorAll) return [];
    return Array.prototype.slice.call(
      dom.importDiffBody.querySelectorAll('tr.diff-row-added, tr.diff-row-removed, tr.diff-row-changed')
    );
  }

  function isAnyImportDiffRowInView(rows, containerEl) {
    var list = Array.isArray(rows) ? rows : [];
    if (!list.length || !containerEl || !containerEl.getBoundingClientRect) return false;
    var crect = containerEl.getBoundingClientRect();
    var top = crect.top + 60;
    var bottom = crect.bottom - 40;
    for (var i = 0; i < list.length; i += 1) {
      var row = list[i];
      if (!row || !row.getBoundingClientRect) continue;
      var r = row.getBoundingClientRect();
      if (r.bottom > top && r.top < bottom) return true;
    }
    return false;
  }

  function buildImportDiffLocateBarHtml() {
    if (!dom.importDiffLocateBar) return '';
    var rows = Array.isArray(state.importDiff.rows) ? state.importDiff.rows : [];
    var added = rows.filter(function(r) { return r && r.type === 'added'; }).length;
    var removed = rows.filter(function(r) { return r && r.type === 'removed'; }).length;
    var changed = rows.filter(function(r) { return r && r.type === 'changed'; }).length;
    var total = added + removed + changed;
    if (!total) {
      return (
        '<div class="diff-locate-info">差异定位</div>' +
        '<div class="diff-locate-empty">暂无差异</div>'
      );
    }
    var current = Number.isInteger(state.importDiff.locateIndex) ? state.importDiff.locateIndex : -1;
    var posText = current >= 0 ? ('位置 ' + String(current + 1) + '/' + String(total)) : ('位置 --/' + String(total));
    var hasCurrent = current >= 0;
    var disablePrev = !hasCurrent || current <= 0;
    var disableNext = hasCurrent && current >= total - 1;
    var disableFirst = hasCurrent && current <= 0;
    var disableLast = hasCurrent && current >= total - 1;
    return (
      '<div class="diff-locate-info">差异定位：新增 ' + String(added) +
        ' / 删除 ' + String(removed) +
        ' / 差异 ' + String(changed) +
        '，共 ' + String(total) + ' 处</div>' +
      '<div class="diff-locate-controls">' +
        '<button type="button" class="secondary" data-diff-locate-scope="case-library-import-diff" data-diff-locate-action="first" ' + (disableFirst ? 'disabled' : '') + '>首处</button>' +
        '<button type="button" class="secondary" data-diff-locate-scope="case-library-import-diff" data-diff-locate-action="prev" ' + (disablePrev ? 'disabled' : '') + '>上一处</button>' +
        '<button type="button" class="secondary" data-diff-locate-scope="case-library-import-diff" data-diff-locate-action="next" ' + (disableNext ? 'disabled' : '') + '>下一处</button>' +
        '<button type="button" class="secondary" data-diff-locate-scope="case-library-import-diff" data-diff-locate-action="last" ' + (disableLast ? 'disabled' : '') + '>末处</button>' +
        '<span class="diff-locate-pos" data-diff-locate-pos>' + escapeHtml(posText) + '</span>' +
        '<span class="diff-locate-hint hidden" data-diff-locate-hint></span>' +
      '</div>'
    );
  }

  function renderImportDiffLocateBar() {
    if (!dom.importDiffLocateBar) return;
    dom.importDiffLocateBar.innerHTML = buildImportDiffLocateBarHtml();
    updateImportDiffLocateHint();
  }

  function updateImportDiffLocateHint() {
    if (!dom.importDiffLocateBar || !dom.importDiffLocateBar.querySelector) return;
    var hintEl = dom.importDiffLocateBar.querySelector('[data-diff-locate-hint]');
    if (!hintEl) return;
    var rows = Array.isArray(state.importDiff.rows) ? state.importDiff.rows : [];
    var added = rows.filter(function(r) { return r && r.type === 'added'; }).length;
    var removed = rows.filter(function(r) { return r && r.type === 'removed'; }).length;
    var changed = rows.filter(function(r) { return r && r.type === 'changed'; }).length;
    var total = added + removed + changed;
    if (!total) {
      hintEl.textContent = '';
      if (hintEl.classList) hintEl.classList.add('hidden');
      return;
    }
    var drawerEl = document.getElementById('caseLibraryImportDiffDrawer');
    var bodyEl = drawerEl ? drawerEl.querySelector('.drawer-body') : null;
    var inView = isAnyImportDiffRowInView(getImportDiffRowEls(), bodyEl);
    var hint = inView ? '' : '当前视口无差异，可点击“下一处”定位';
    hintEl.textContent = hint;
    if (!hintEl.classList) return;
    hintEl.classList.toggle('hidden', !hint);
  }

  function jumpToImportDiffAt(index) {
    var rows = getImportDiffRowEls();
    if (!rows.length) return;
    var idx = Number(index);
    if (!Number.isFinite(idx)) idx = 0;
    if (idx < 0) idx = 0;
    if (idx >= rows.length) idx = rows.length - 1;
    state.importDiff.locateIndex = idx;
    clearImportDiffLocateHighlight();
    var row = rows[idx];
    if (row && row.scrollIntoView) {
      try { row.scrollIntoView({ block: 'center' }); } catch (e) { row.scrollIntoView(); }
    }
    if (row && row.classList) row.classList.add('diff-locate-active');
    importDiffLocateHighlightTimer = setTimeout(function() {
      if (row && row.classList) row.classList.remove('diff-locate-active');
    }, 2000);
    renderImportDiffLocateBar();
  }

  var importDiffLocateBound = false;
  function bindImportDiffLocateEvents() {
    if (importDiffLocateBound) return;
    importDiffLocateBound = true;
    var drawerEl = document.getElementById('caseLibraryImportDiffDrawer');
    if (drawerEl && typeof drawerEl.addEventListener === 'function') {
      drawerEl.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-diff-locate-action]') : null;
        if (!btn || !btn.getAttribute) return;
        if (btn.getAttribute('data-diff-locate-scope') !== 'case-library-import-diff') return;
        var action = btn.getAttribute('data-diff-locate-action') || '';
        if (!action) return;
        var rows = getImportDiffRowEls();
        if (!rows.length) return;
        if (action === 'first') jumpToImportDiffAt(0);
        else if (action === 'last') jumpToImportDiffAt(rows.length - 1);
        else if (action === 'next') jumpToImportDiffAt((state.importDiff.locateIndex >= 0 ? state.importDiff.locateIndex + 1 : 0));
        else if (action === 'prev') jumpToImportDiffAt((state.importDiff.locateIndex >= 0 ? state.importDiff.locateIndex - 1 : rows.length - 1));
      });
      var bodyEl = drawerEl.querySelector('.drawer-body');
      if (bodyEl && typeof bodyEl.addEventListener === 'function') {
        var debounce = (utils && typeof utils.debounce === 'function') ? utils.debounce : null;
        var onScroll = function() { updateImportDiffLocateHint(); };
        bodyEl.addEventListener('scroll', debounce ? debounce(onScroll, 120) : onScroll);
      }
    }
  }

  function syncImportDiffControls() {
    if (!dom.importDiffOverwriteBtn) return;
    var mode = state.importDiff && state.importDiff.mode ? String(state.importDiff.mode) : 'import';
    var can = false;
    if (mode === 'append_overwrite') {
      can = Boolean(
        !state.importDiff.loading &&
        !state.importDiff.confirming &&
        state.importDiff.caseFileId &&
        Array.isArray(state.importDiff.importItems) &&
        state.importDiff.importItems.length
      );
    } else {
      can = Boolean(
        !state.importDiff.loading &&
        !state.importDiff.confirming &&
        state.importDiff.projectId &&
        state.importDiff.importVersionId &&
        state.importDiff.fileName &&
        Array.isArray(state.importDiff.importItems) &&
        state.importDiff.importItems.length
      );
    }
    dom.importDiffOverwriteBtn.disabled = !can;
  }

  function openImportDiffDrawer(payload) {
    payload = payload || {};
    state.importDiff.locateIndex = -1;
    state.importDiff.mode = payload.mode || 'import';
    state.importDiff.caseFileId = payload.caseFileId || null;
    state.importDiff.fileName = payload.fileName || '';
    state.importDiff.cleanName = payload.cleanName || '';
    state.importDiff.importedCleanName = payload.importedCleanName || '';
    state.importDiff.source = payload.source || '';
    state.importDiff.projectId = payload.projectId || null;
    state.importDiff.importVersionId = payload.importVersionId || null;
    state.importDiff.dbVersionId = payload.dbVersionId || null;
    state.importDiff.importItems = Array.isArray(payload.importItems) ? payload.importItems : [];
    state.importDiff.dbItems = Array.isArray(payload.dbItems) ? payload.dbItems : [];
    state.importDiff.rows = (state.importDiff.mode === 'append_overwrite')
      ? buildAppendOverwriteDiffRows(state.importDiff.importItems, state.importDiff.dbItems)
      : buildImportDiffRows(state.importDiff.importItems, state.importDiff.dbItems);
    state.importDiff.loading = false;
    state.importDiff.confirming = false;

    var projectName = state.projectNameById[state.importDiff.projectId] || ('项目#' + state.importDiff.projectId);
    var importVerName = getVersionName(state.importDiff.projectId, state.importDiff.importVersionId);
    var dbVerName = getVersionName(state.importDiff.projectId, state.importDiff.dbVersionId);
    var leftCount = (state.importDiff.mode === 'append_overwrite')
      ? countUniqueCaseItemsByKey(state.importDiff.importItems)
      : dedupeCaseItemsByKey(state.importDiff.importItems).length;
    var rightCount = (state.importDiff.mode === 'append_overwrite')
      ? countUniqueCaseItemsByKey(state.importDiff.dbItems)
      : dedupeCaseItemsByKey(state.importDiff.dbItems).length;
    var changedCount = state.importDiff.rows.filter(function(r) { return r && r.type === 'changed'; }).length;
    var addedCount = state.importDiff.rows.filter(function(r) { return r && r.type === 'added'; }).length;
    var removedCount = state.importDiff.rows.filter(function(r) { return r && r.type === 'removed'; }).length;

    if (dom.importDiffTitle) {
      dom.importDiffTitle.textContent = (state.importDiff.mode === 'append_overwrite' ? '追加入库差异对比：' : '同名用例差异对比：') +
        (state.importDiff.cleanName || state.importDiff.fileName || '用例');
    }
    if (dom.importDiffMeta) {
      if (state.importDiff.mode === 'append_overwrite') {
        dom.importDiffMeta.textContent = projectName + ' / 版本：' + importVerName +
          ' / 待追加入库：' + leftCount + ' 条（新增 ' + addedCount + ' / 重复 ' + rightCount + ' / 差异 ' + changedCount + '）';
        if (changedCount) dom.importDiffMeta.classList.add('warn');
        else dom.importDiffMeta.classList.remove('warn');
      } else {
        dom.importDiffMeta.textContent = projectName + ' / 导入版本：' + importVerName + '（' + leftCount + ' 条） / 库中版本：' + dbVerName + '（' + rightCount + ' 条）' +
          ' / 新增 ' + addedCount + ' / 删除 ' + removedCount + ' / 差异 ' + changedCount;
        if (leftCount !== rightCount) dom.importDiffMeta.classList.add('warn');
        else dom.importDiffMeta.classList.remove('warn');
      }
    }
    if (dom.importDiffStatus) {
      var summary = '';
      if (state.importDiff.mode === 'append_overwrite') {
        summary = '检测到重复用例：新增 ' + addedCount + ' 条，差异 ' + changedCount + ' 条';
        setStatus(dom.importDiffStatus, summary, changedCount ? 'warn' : 'ok');
      } else {
        summary = '对比完成：新增 ' + addedCount + ' 条，差异 ' + changedCount + ' 条，库中多出 ' + removedCount + ' 条';
        setStatus(dom.importDiffStatus, summary, (addedCount || changedCount || removedCount) ? 'warn' : 'ok');
      }
    }
    if (dom.importDiffOverwriteBtn) {
      dom.importDiffOverwriteBtn.textContent = (state.importDiff.mode === 'append_overwrite') ? '确认覆盖并追加入库' : '确认覆盖导入';
    }
    renderImportDiffMergedTable(dom.importDiffBody, state.importDiff.rows);
    bindImportDiffLocateEvents();
    renderImportDiffLocateBar();
    syncImportDiffControls();

    if (importDrawerInstance && typeof importDrawerInstance.close === 'function') {
      importDrawerInstance.close();
    }
    if (importDiffDrawerOpenTimer) {
      clearTimeout(importDiffDrawerOpenTimer);
      importDiffDrawerOpenTimer = 0;
    }
    if (importDiffDrawerInstance && typeof importDiffDrawerInstance.open === 'function') {
      var el = importDiffDrawerInstance.element;
      var alreadyOpen = Boolean(el && el.classList && el.classList.contains('open'));
      if (alreadyOpen) {
        importDiffDrawerInstance.open();
      } else {
        importDiffDrawerOpenTimer = setTimeout(function() {
          importDiffDrawerInstance.open();
        }, 60);
      }
    }
  }

	  function openImportDiffDrawerLoading(payload) {
    payload = payload || {};
    state.importDiff.locateIndex = -1;
    state.importDiff.mode = payload.mode || 'import';
    state.importDiff.caseFileId = payload.caseFileId || null;
    var projectId = payload.projectId || null;
    var importVersionId = payload.importVersionId || null;
    var cleanName = payload.cleanName || payload.fileName || '';
    state.importDiff.fileName = payload.fileName || '';
    state.importDiff.cleanName = payload.cleanName || payload.fileName || '';
    state.importDiff.importedCleanName = payload.importedCleanName || '';
    state.importDiff.source = payload.source || '';
    state.importDiff.projectId = projectId;
    state.importDiff.importVersionId = importVersionId;
    state.importDiff.dbVersionId = null;
    state.importDiff.importItems = [];
    state.importDiff.dbItems = [];
    state.importDiff.rows = [];
    state.importDiff.loading = false;
    state.importDiff.confirming = false;
    var projectName = state.projectNameById[projectId] || ('项目#' + projectId);
    var importVerName = getVersionName(projectId, importVersionId);

    if (dom.importDiffTitle) {
      dom.importDiffTitle.textContent = (state.importDiff.mode === 'append_overwrite' ? '追加入库差异对比：' : '同名用例差异对比：') + (cleanName || '用例');
    }
    if (dom.importDiffMeta) {
      dom.importDiffMeta.textContent = (state.importDiff.mode === 'append_overwrite')
        ? (projectName + ' / 版本：' + importVerName + ' / 库中：--')
        : (projectName + ' / 导入版本：' + importVerName + ' / 库中版本：--');
      dom.importDiffMeta.classList.remove('warn');
    }
    if (dom.importDiffStatus) setStatus(dom.importDiffStatus, '加载差异对比中...', '');
    if (dom.importDiffBody) dom.importDiffBody.innerHTML = '<tr><td colspan="7"><p class="hint">加载中...</p></td></tr>';
    renderImportDiffLocateBar();
    syncImportDiffControls();

    if (importDrawerInstance && typeof importDrawerInstance.close === 'function') {
      importDrawerInstance.close();
    }
	    if (importDiffDrawerOpenTimer) {
	      clearTimeout(importDiffDrawerOpenTimer);
	      importDiffDrawerOpenTimer = 0;
	    }
	    if (importDiffDrawerInstance && typeof importDiffDrawerInstance.open === 'function') {
	      var el = importDiffDrawerInstance.element;
	      var alreadyOpen = Boolean(el && el.classList && el.classList.contains('open'));
	      if (alreadyOpen) {
	        importDiffDrawerInstance.open();
	      } else {
	        importDiffDrawerOpenTimer = setTimeout(function() {
	          importDiffDrawerInstance.open();
	        }, 60);
	      }
	    }
		  }

  // 供外部模块（如“用例生成”）复用同名差异对比抽屉：打开后等待用户“确认覆盖导入”或关闭抽屉。
  function openImportDiffForExternal(options) {
    options = options || {};
    if (!apiClient || typeof apiClient.importCaseFile !== 'function' || typeof apiClient.listCaseItems !== 'function') {
      return Promise.resolve({ ok: false, reason: 'api_not_ready' });
    }
    var projectId = options.projectId || options.project_id || null;
    var versionId = options.versionId || options.version_id || null;
    var fileName = options.fileName || options.file_name || '';
    var items = Array.isArray(options.items) ? options.items : [];
    var err = options.error || null;
    var errPayload = err && err.payload ? err.payload : (options.payload || null);
    var existingCaseFileId = errPayload && errPayload.existing_case_file_id ? errPayload.existing_case_file_id : null;
    if (!projectId || !versionId || !fileName || !items.length || !existingCaseFileId) {
      return Promise.resolve({ ok: false, reason: 'invalid_params' });
    }
    var importedCleanName = cleanCaseFileName(fileName);
    var matchedCleanName = errPayload && errPayload.existing_file_name_clean ? String(errPayload.existing_file_name_clean) : '';
    var cleanName = matchedCleanName || importedCleanName;
    var dbVersionId = errPayload && (errPayload.existing_version_id || errPayload.existing_version_id === 0)
      ? errPayload.existing_version_id
      : null;
    var source = options.source || options.importSource || extFromFileName(fileName) || 'external';

    openImportDiffDrawerLoading({
      fileName: fileName,
      cleanName: cleanName,
      importedCleanName: importedCleanName,
      projectId: projectId,
      importVersionId: versionId,
      source: source,
    });

    return new Promise(function(resolve) {
      state.importDiff.external = { resolve: resolve };
      Promise.all([apiClient.listCaseItems(existingCaseFileId), loadVersions(projectId)])
        .then(function(res) {
          var dbItems = Array.isArray(res && res[0]) ? res[0] : [];
          openImportDiffDrawer({
            fileName: fileName,
            cleanName: cleanName,
            importedCleanName: importedCleanName,
            projectId: projectId,
            importVersionId: versionId,
            dbVersionId: dbVersionId,
            importItems: items,
            dbItems: dbItems,
            source: source,
          });
        })
        .catch(function(loadErr) {
          setStatus(dom.importDiffStatus, '加载差异对比失败：' + (loadErr && loadErr.message ? loadErr.message : '未知错误'), 'err');
          var external = state.importDiff.external || null;
          if (external && typeof external.resolve === 'function') {
            state.importDiff.external = null;
            try {
              external.resolve({ ok: false, reason: 'load_failed', error: loadErr || null });
            } catch (e) {
              // ignore
            }
          }
        });
    });
  }

  // 供外部模块复用“追加入库覆盖差异对比”：用于确认是否覆盖同模块同标题的重复用例。
  function openAppendDiffForExternal(options) {
    options = options || {};
    if (!apiClient || typeof apiClient.appendCaseItems !== 'function') {
      return Promise.resolve({ ok: false, reason: 'api_not_ready' });
    }
    var projectId = options.projectId || options.project_id || null;
    var versionId = options.versionId || options.version_id || null;
    var caseFileId = options.caseFileId || options.case_file_id || null;
    var fileNameClean = options.fileNameClean || options.file_name_clean || options.cleanName || '';
    var items = Array.isArray(options.items) ? options.items : [];
    var dbItems = Array.isArray(options.dbItems) ? options.dbItems : [];
    if (!projectId || !versionId || !caseFileId || !items.length) {
      return Promise.resolve({ ok: false, reason: 'invalid_params' });
    }
    var leftKeys = {};
    items.forEach(function(it) {
      var k = buildCaseItemKey(it);
      if (k) leftKeys[k] = true;
    });
    var relatedDbItems = dbItems.filter(function(it) {
      var k = buildCaseItemKey(it);
      return Boolean(k && leftKeys[k]);
    });
    var hasConflict = relatedDbItems.length > 0;
    if (!hasConflict) {
      return Promise.resolve({ ok: false, reason: 'no_conflict' });
    }

    openImportDiffDrawerLoading({
      mode: 'append_overwrite',
      caseFileId: caseFileId,
      fileName: fileNameClean || ('用例#' + caseFileId),
      cleanName: fileNameClean || ('用例#' + caseFileId),
      projectId: projectId,
      importVersionId: versionId,
      source: 'casegen',
    });

    return new Promise(function(resolve) {
      state.importDiff.external = { resolve: resolve };
      loadVersions(projectId)
        .then(function() {
          openImportDiffDrawer({
            mode: 'append_overwrite',
            caseFileId: caseFileId,
            fileName: fileNameClean || ('用例#' + caseFileId),
            cleanName: fileNameClean || ('用例#' + caseFileId),
            projectId: projectId,
            importVersionId: versionId,
            dbVersionId: null,
            importItems: items,
            dbItems: relatedDbItems,
            source: 'casegen',
          });
        })
        .catch(function(loadErr) {
          setStatus(dom.importDiffStatus, '加载差异对比失败：' + (loadErr && loadErr.message ? loadErr.message : '未知错误'), 'err');
          var external = state.importDiff.external || null;
          if (external && typeof external.resolve === 'function') {
            state.importDiff.external = null;
            try {
              external.resolve({ ok: false, reason: 'load_failed', error: loadErr || null });
            } catch (e) {
              // ignore
            }
          }
        });
    });
  }

	  function syncImportInvalidControls() {
	    if (!dom.importInvalidConfirmBtn) return;
	    var items = Array.isArray(state.importInvalid.items) ? state.importInvalid.items : [];
	    dom.importInvalidConfirmBtn.disabled = Boolean(state.importInvalid.loading || !items.length);
	  }

	  function renderImportInvalidTable() {
	    if (!dom.importInvalidBody) return;
	    var structural = Array.isArray(state.importInvalid.structuralErrors) ? state.importInvalid.structuralErrors : [];
	    var invalid = Array.isArray(state.importInvalid.invalid) ? state.importInvalid.invalid : [];
	    if (!structural.length && !invalid.length) {
	      dom.importInvalidBody.innerHTML = '<tr><td colspan="7"><p class="hint">暂无数据</p></td></tr>';
	      return;
	    }

	    function renderStructuralRows(list) {
	      if (!list || !list.length) return '';
	      return list.map(function(entry) {
	        var lineNo = entry && typeof entry.line === 'number' ? entry.line : null;
	        var depth = entry && typeof entry.depth === 'number' ? entry.depth : null;
	        var detail = '字段层级不足：当前为 ' + (depth === null ? '?' : String(depth)) + ' 层（需至少 6 层：模块/用例标题/优先级/前提条件/操作步骤/预期结果），请在 XMind 中补齐后重新导入';
	        return (
	          '<tr class="import-structure-row">' +
	            '<td>' + escapeHtml(lineNo === null ? '-' : String(lineNo)) + '</td>' +
	            '<td colspan="6">' + escapeHtml(detail) + '</td>' +
	          '</tr>'
	        );
	      }).join('');
	    }

	    function renderItemRow(idx, lineNo, item, err) {
	      function cell(field, multiline) {
	        var raw = item && item[field] !== undefined && item[field] !== null ? String(item[field]) : '';
	        var html = raw ? escapeHtml(raw) : '';
	        var cls = err && err[field] ? 'invalid-cell' : '';
	        return (
	          '<td class="' + cls + '">' +
	            '<div class="temp-inline-edit" contenteditable="true" data-case-lib-import-invalid-field="' + field + '" data-index="' + idx + '" data-case-lib-multiline="' + (multiline ? 'true' : 'false') + '" data-placeholder="点击此处编辑">' +
	              html +
	            '</div>' +
	          '</td>'
	        );
	      }
	      return (
	        '<tr>' +
	          '<td>' + escapeHtml(String(lineNo)) + '</td>' +
	          cell('module', false) +
	          cell('title', false) +
	          cell('priority', false) +
	          cell('precondition', true) +
	          cell('steps', true) +
	          cell('expected', true) +
	        '</tr>'
	      );
	    }

	    function buildErrByIndex(invalidList) {
	      var errByIndex = {};
	      (invalidList || []).forEach(function(entry) {
	        var idx = entry && typeof entry.index === 'number' ? entry.index : -1;
	        if (idx < 0) return;
	        errByIndex[idx] = entry && entry.err ? entry.err : {};
	      });
	      return errByIndex;
	    }

	    function buildItemsByLine(items) {
	      var itemsByLine = {};
	      (items || []).forEach(function(it, idx) {
	        var lineNo = it && it._sourceLine ? Number(it._sourceLine) : null;
	        if (!lineNo || !isFinite(lineNo)) lineNo = idx + 1;
	        if (!itemsByLine[lineNo]) itemsByLine[lineNo] = [];
	        itemsByLine[lineNo].push({ idx: idx, item: it });
	      });
	      return itemsByLine;
	    }

	    function buildSortedLines(structuralByLine, itemsByLine) {
	      var allLineMap = {};
	      Object.keys(structuralByLine || {}).forEach(function(k) { allLineMap[Number(k)] = true; });
	      Object.keys(itemsByLine || {}).forEach(function(k) { allLineMap[Number(k)] = true; });
	      var lines = Object.keys(allLineMap)
	        .map(function(k) { return Number(k); })
	        .filter(function(n) { return isFinite(n) && n > 0; });
	      lines.sort(function(a, b) { return a - b; });
	      return lines;
	    }

	    if (structural.length) {
	      var errByIndex = buildErrByIndex(invalid);
	      var structuralByLine = {};
	      structural.forEach(function(entry) {
	        var line = entry && typeof entry.line === 'number' ? entry.line : null;
	        if (!line) return;
	        structuralByLine[line] = entry;
	      });
	      var items = Array.isArray(state.importInvalid.items) ? state.importInvalid.items : [];
	      var itemsByLine = buildItemsByLine(items);
	      var lines = buildSortedLines(structuralByLine, itemsByLine);
	      var rows = lines.map(function(line) {
	        var html = '';
	        if (structuralByLine[line]) html += renderStructuralRows([structuralByLine[line]]);
	        var itemList = itemsByLine[line] || [];
	        itemList.forEach(function(rec) {
	          html += renderItemRow(rec.idx, line, rec.item, errByIndex[rec.idx] || {});
	        });
	        return html;
	      }).join('');
	      dom.importInvalidBody.innerHTML = rows || '<tr><td colspan="7"><p class="hint">暂无数据</p></td></tr>';
	      return;
	    }

	    // 内容校验：为保持完整性，展示同文件内所有可解析用例，并对缺失字段高亮。
	    var errByIndex = buildErrByIndex(invalid);
	    var items = Array.isArray(state.importInvalid.items) ? state.importInvalid.items : [];
	    if (!items.length) {
	      dom.importInvalidBody.innerHTML = '<tr><td colspan="7"><p class="hint">暂无数据</p></td></tr>';
	      return;
	    }
	    var itemsByLine = buildItemsByLine(items);
	    var lines = buildSortedLines({}, itemsByLine);
	    var rows = lines.map(function(line) {
	      var html = '';
	      var itemList = itemsByLine[line] || [];
	      itemList.forEach(function(rec) {
	        html += renderItemRow(rec.idx, line, rec.item, errByIndex[rec.idx] || {});
	      });
	      return html;
	    }).join('');
	    dom.importInvalidBody.innerHTML = rows || '<tr><td colspan="7"><p class="hint">暂无数据</p></td></tr>';
	  }

	  function openImportInvalidDrawer(payload) {
	    payload = payload || {};
	    state.importInvalid.file = payload.file || null;
	    state.importInvalid.fileName = payload.fileName || '';
	    state.importInvalid.cleanName = payload.cleanName || cleanCaseFileName(payload.fileName || '');
	    state.importInvalid.source = payload.source || '';
	    state.importInvalid.projectId = payload.projectId || null;
	    state.importInvalid.versionId = payload.versionId || null;
	    state.importInvalid.structuralErrors = Array.isArray(payload.structuralErrors) ? payload.structuralErrors : [];
	    state.importInvalid.items = Array.isArray(payload.items) ? payload.items : [];
	    state.importInvalid.invalid = validateImportItems(state.importInvalid.items);
	    state.importInvalid.loading = false;

	    if (dom.importInvalidTitle) {
	      dom.importInvalidTitle.textContent = '导入用例格式校验：' + (state.importInvalid.cleanName || state.importInvalid.fileName || '用例');
	    }
	    if (dom.importInvalidStatus) {
	      var structuralCount = state.importInvalid.structuralErrors ? state.importInvalid.structuralErrors.length : 0;
	      var itemCount = state.importInvalid.items ? state.importInvalid.items.length : 0;
	      var invalidCount = state.importInvalid.invalid ? state.importInvalid.invalid.length : 0;
	      if (structuralCount) {
	        if (itemCount) {
	          setStatus(dom.importInvalidStatus, '检测到字段层级不足 ' + structuralCount + ' 条（将跳过）；其余 ' + itemCount + ' 条可继续入库' + (invalidCount ? '（请先补齐必填字段）' : ''), 'warn');
	        } else {
	          setStatus(dom.importInvalidStatus, '全部条目字段层级不足（共 ' + structuralCount + ' 条），无法入库，请在 XMind 中补齐后重新导入', 'warn');
	        }
	      } else {
	        setStatus(dom.importInvalidStatus, '请补齐必填字段后再确认入库', 'warn');
	      }
	    }
	    renderImportInvalidTable();
	    syncImportInvalidControls();

	    if (importDrawerInstance && typeof importDrawerInstance.close === 'function') {
	      importDrawerInstance.close();
	    }
	    if (importInvalidDrawerInstance && typeof importInvalidDrawerInstance.open === 'function') {
	      setTimeout(function() {
	        importInvalidDrawerInstance.open();
	      }, 60);
	    }
	  }

	  function confirmImportFromInvalidDrawer() {
	    if (state.importInvalid.loading) return;
	    if (!apiClient || typeof apiClient.importCaseFile !== 'function') {
	      setStatus(dom.importInvalidStatus, '后端导入接口未就绪', 'err');
	      return;
	    }
	    var projectId = state.importInvalid.projectId;
	    var versionId = state.importInvalid.versionId;
	    var fileName = state.importInvalid.fileName || '用例';
	    var items = Array.isArray(state.importInvalid.items) ? state.importInvalid.items : [];
	    var structural = Array.isArray(state.importInvalid.structuralErrors) ? state.importInvalid.structuralErrors : [];
	    if (!projectId || !versionId || !items.length) {
	      if (structural.length) {
	        setStatus(dom.importInvalidStatus, '无可入库用例：字段层级不足 ' + structural.length + ' 条，请在 XMind 中补齐后重新导入', 'warn');
	      } else {
	        setStatus(dom.importInvalidStatus, '导入数据未就绪，请关闭后重新导入', 'warn');
	      }
	      return;
	    }

	    var invalid = validateImportItems(items);
	    state.importInvalid.invalid = invalid;
	    if (invalid.length) {
	      renderImportInvalidTable();
	      setStatus(dom.importInvalidStatus, '仍有 ' + invalid.length + ' 条用例必填字段为空，请修改后再确认', 'warn');
	      return;
	    }

      var dup = buildDuplicateGroupsForImport(items);
      if (dup.duplicateCount > 0) {
        confirmImportDuplicatesByDrawer({
          fileName: fileName,
          total: items.length,
          uniqueCount: dup.uniqueItems.length,
          duplicateCount: dup.duplicateCount,
          rows: dup.rows,
        }).then(function(ok) {
          if (!ok) {
            setStatus(dom.importInvalidStatus, '已取消入库（包含重复条目）', 'warn');
            return;
          }
          items = dup.uniqueItems;
          state.importInvalid.items = items;

          state.importInvalid.loading = true;
          syncImportInvalidControls();
          setStatus(dom.importInvalidStatus, '校验通过，入库中...', '');

          apiClient.importCaseFile({
            project_id: projectId,
            version_id: versionId,
            file_name: fileName,
            source: state.importInvalid.source || extFromFileName(fileName),
            items: sanitizeImportItemsForApi(items),
          }).then(function() {
            var msg = '入库成功：' + cleanCaseFileName(fileName);
            if (structural.length) msg += '（已跳过字段层级不足 ' + structural.length + ' 条）';
            setStatus(dom.importInvalidStatus, msg, 'ok');
            setStatus(dom.importStatus, msg, 'ok');
            setStatus(dom.status, msg, 'ok');
            refreshCaseFileListsByProject(projectId);

            if (importInvalidDrawerInstance && typeof importInvalidDrawerInstance.close === 'function') {
              importInvalidDrawerInstance.close();
            }

            // 成功后从导入列表中移除该文件，避免重复导入；若已无文件则清空 input。
            var file = state.importInvalid.file;
            if (file && state.importDrawer && Array.isArray(state.importDrawer.files)) {
              state.importDrawer.files = state.importDrawer.files.filter(function(f) { return f !== file; });
            }
            renderImportFileHint();
            if (dom.importInput && (!state.importDrawer.files || !state.importDrawer.files.length)) {
              try {
                dom.importInput.value = '';
              } catch (e) {
                // ignore
              }
            }
            syncImportConfirmEnabled();
          }).catch(function(err) {
            var msg = err && err.message ? err.message : '导入失败';
            setStatus(dom.importInvalidStatus, '入库失败：' + msg, 'err');
            setStatus(dom.importStatus, '入库失败：' + msg, 'err');
            if (msg.indexOf('同名') !== -1) {
              // 同名冲突：复用现有差异对比抽屉（保持导入数据为已修正内容）。
              if (importInvalidDrawerInstance && typeof importInvalidDrawerInstance.close === 'function') {
                importInvalidDrawerInstance.close();
              }
              var importedCleanName = cleanCaseFileName(fileName);
              var errPayload = err && err.payload ? err.payload : null;
              var matchedCaseFileId = errPayload && errPayload.existing_case_file_id ? errPayload.existing_case_file_id : null;
              var matchedCleanName = errPayload && errPayload.existing_file_name_clean ? String(errPayload.existing_file_name_clean) : importedCleanName;
              var matchedVersionId = errPayload && (errPayload.existing_version_id || errPayload.existing_version_id === 0) ? errPayload.existing_version_id : null;
              var cleanName = matchedCleanName || importedCleanName;
              var source = state.importInvalid.source || extFromFileName(fileName);
              openImportDiffDrawerLoading({
                fileName: fileName,
                cleanName: cleanName,
                importedCleanName: importedCleanName,
                projectId: projectId,
                importVersionId: versionId,
                source: source,
              });
              (matchedCaseFileId
                ? Promise.all([apiClient.listCaseItems(matchedCaseFileId), loadVersions(projectId)]).then(function(res) {
                  var dbItems = Array.isArray(res && res[0]) ? res[0] : [];
                  openImportDiffDrawer({
                    fileName: fileName,
                    cleanName: cleanName,
                    importedCleanName: importedCleanName,
                    projectId: projectId,
                    importVersionId: versionId,
                    dbVersionId: matchedVersionId,
                    importItems: items,
                    dbItems: dbItems || [],
                    source: source,
                  });
                })
                : Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId)])
                    .then(function(res) {
                      var files = Array.isArray(res && res[0]) ? res[0] : [];
                      var list = Array.isArray(files) ? files : [];
                      var existing = list.find(function(cf) {
                        return cf && String(cf.file_name_clean || '') === String(cleanName || '');
                      });
                      if (!existing) throw new Error('未找到库中同名用例：' + cleanName);
                      return apiClient.listCaseItems(existing.id).then(function(dbItems) {
                        openImportDiffDrawer({
                          fileName: fileName,
                          cleanName: cleanName,
                          importedCleanName: importedCleanName,
                          projectId: projectId,
                          importVersionId: versionId,
                          dbVersionId: existing.version_id || null,
                          importItems: items,
                          dbItems: dbItems || [],
                          source: source,
                        });
                      });
                    })
              )
                .catch(function(e) {
                  setStatus(dom.importDiffStatus, (e && e.message ? e.message : '打开差异对比失败'), 'err');
                  setStatus(dom.importInvalidStatus, '入库失败：' + msg, 'err');
                });
            }
          }).finally(function() {
            state.importInvalid.loading = false;
            syncImportInvalidControls();
          });
        });
        return;
      }

	    state.importInvalid.loading = true;
	    syncImportInvalidControls();
	    setStatus(dom.importInvalidStatus, '校验通过，入库中...', '');

	    apiClient.importCaseFile({
	      project_id: projectId,
	      version_id: versionId,
	      file_name: fileName,
	      source: state.importInvalid.source || extFromFileName(fileName),
	      items: sanitizeImportItemsForApi(items),
	    }).then(function() {
	      var msg = '入库成功：' + cleanCaseFileName(fileName);
	      if (structural.length) msg += '（已跳过字段层级不足 ' + structural.length + ' 条）';
	      setStatus(dom.importInvalidStatus, msg, 'ok');
	      setStatus(dom.importStatus, msg, 'ok');
	      setStatus(dom.status, msg, 'ok');
	      refreshCaseFileListsByProject(projectId);

	      if (importInvalidDrawerInstance && typeof importInvalidDrawerInstance.close === 'function') {
	        importInvalidDrawerInstance.close();
	      }

	      // 成功后从导入列表中移除该文件，避免重复导入；若已无文件则清空 input。
	      var file = state.importInvalid.file;
	      if (file && state.importDrawer && Array.isArray(state.importDrawer.files)) {
	        state.importDrawer.files = state.importDrawer.files.filter(function(f) { return f !== file; });
	      }
	      renderImportFileHint();
	      if (dom.importInput && (!state.importDrawer.files || !state.importDrawer.files.length)) {
	        try {
	          dom.importInput.value = '';
	        } catch (e) {
	          // ignore
	        }
	      }
	      syncImportConfirmEnabled();
	    }).catch(function(err) {
	      var msg = err && err.message ? err.message : '导入失败';
	      setStatus(dom.importInvalidStatus, '入库失败：' + msg, 'err');
	      setStatus(dom.importStatus, '入库失败：' + msg, 'err');
	      if (msg.indexOf('同名') !== -1) {
	        // 同名冲突：复用现有差异对比抽屉（保持导入数据为已修正内容）。
	        if (importInvalidDrawerInstance && typeof importInvalidDrawerInstance.close === 'function') {
	          importInvalidDrawerInstance.close();
	        }
	        var importedCleanName = cleanCaseFileName(fileName);
	        var errPayload = err && err.payload ? err.payload : null;
	        var matchedCaseFileId = errPayload && errPayload.existing_case_file_id ? errPayload.existing_case_file_id : null;
	        var matchedCleanName = errPayload && errPayload.existing_file_name_clean ? String(errPayload.existing_file_name_clean) : importedCleanName;
	        var matchedVersionId = errPayload && (errPayload.existing_version_id || errPayload.existing_version_id === 0) ? errPayload.existing_version_id : null;
	        var cleanName = matchedCleanName || importedCleanName;
	        var source = state.importInvalid.source || extFromFileName(fileName);
	        openImportDiffDrawerLoading({
	          fileName: fileName,
	          cleanName: cleanName,
	          importedCleanName: importedCleanName,
	          projectId: projectId,
	          importVersionId: versionId,
	          source: source,
	        });
	        (matchedCaseFileId
	          ? Promise.all([apiClient.listCaseItems(matchedCaseFileId), loadVersions(projectId)]).then(function(res) {
	            var dbItems = Array.isArray(res && res[0]) ? res[0] : [];
	            openImportDiffDrawer({
	              fileName: fileName,
	              cleanName: cleanName,
	              importedCleanName: importedCleanName,
	              projectId: projectId,
	              importVersionId: versionId,
	              dbVersionId: matchedVersionId,
	              importItems: items,
	              dbItems: dbItems || [],
	              source: source,
	            });
	          })
	          : Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId)])
	              .then(function(res) {
	                var files = Array.isArray(res && res[0]) ? res[0] : [];
	                var list = Array.isArray(files) ? files : [];
	                var existing = list.find(function(cf) {
	                  return cf && String(cf.file_name_clean || '') === String(cleanName || '');
	                });
	                if (!existing) throw new Error('未找到库中同名用例：' + cleanName);
	                return apiClient.listCaseItems(existing.id).then(function(dbItems) {
	                  openImportDiffDrawer({
	                    fileName: fileName,
	                    cleanName: cleanName,
	                    importedCleanName: importedCleanName,
	                    projectId: projectId,
	                    importVersionId: versionId,
	                    dbVersionId: existing.version_id || null,
	                    importItems: items,
	                    dbItems: dbItems || [],
	                    source: source,
	                  });
	                });
	              })
	        ).catch(function(e) {
	          setStatus(dom.importDiffStatus, (e && e.message ? e.message : '打开差异对比失败'), 'err');
	          setStatus(dom.importStatus, (e && e.message ? e.message : '打开差异对比失败'), 'err');
	        });
	      }
	    }).finally(function() {
	      state.importInvalid.loading = false;
	      syncImportInvalidControls();
	    });
	  }

  function refreshCaseFileListsByProject(projectId) {
    if (!projectId) return Promise.resolve();
    if (!apiClient || typeof apiClient.listCaseFiles !== 'function') return Promise.resolve();
    return apiClient.listCaseFiles(projectId).then(function(files) {
      var list = Array.isArray(files) ? files : [];
      if (state.editDrawer.projectId && String(state.editDrawer.projectId) === String(projectId)) {
        state.editDrawer.files = list;
        renderEditDrawerList();
        syncEditDrawerControls();
      }
      if (state.selectDrawer.projectId && String(state.selectDrawer.projectId) === String(projectId)) {
        state.selectDrawer.files = list;
        renderSelectDrawerList();
      }
      var editorFile = state.editor && state.editor.caseFile ? state.editor.caseFile : null;
      if (editorFile && String(editorFile.project_id || '') === String(projectId || '')) {
        var name = editorFile.file_name_clean || '';
        var next = list.find(function(cf) { return cf && String(cf.file_name_clean || '') === String(name || ''); });
        if (next && next.id && apiClient && typeof apiClient.listCaseItems === 'function') {
          state.editor.caseFile = next;
          return apiClient.listCaseItems(next.id).then(function(items) {
            state.editor.items = Array.isArray(items) ? items : [];
            renderEditorCard();
          });
        }
      }
    });
  }

  function confirmOverwriteImportFromDiff() {
    if (state.importDiff.loading || state.importDiff.confirming) return;
    var mode = state.importDiff && state.importDiff.mode ? String(state.importDiff.mode) : 'import';
    if (!apiClient || (mode === 'append_overwrite' ? typeof apiClient.appendCaseItems !== 'function' : typeof apiClient.importCaseFile !== 'function')) {
      setStatus(dom.importDiffStatus, mode === 'append_overwrite' ? '后端追加接口未就绪' : '后端导入接口未就绪', 'err');
      return;
    }

    if (mode === 'append_overwrite') {
      var caseFileId = state.importDiff.caseFileId;
      var items2 = Array.isArray(state.importDiff.importItems) ? state.importDiff.importItems : [];
      if (!caseFileId || !items2.length) {
        setStatus(dom.importDiffStatus, '差异数据未就绪，请稍后重试', 'warn');
        return;
      }
      state.importDiff.confirming = false;
      state.importDiff.loading = true;
      syncImportDiffControls();
      setStatus(dom.importDiffStatus, '覆盖并追加入库中...', '');

      apiClient
        .appendCaseItems(caseFileId, { items: items2, overwrite_existing: true })
        .then(function(res) {
          var appended = res && (res.appended || res.appended_count) ? Number(res.appended || res.appended_count) : 0;
          var overwritten = res && (res.overwritten || res.overwritten_count) ? Number(res.overwritten || res.overwritten_count) : 0;
          var msg = '追加入库成功：新增 ' + appended + ' 条，覆盖 ' + overwritten + ' 条';
          setStatus(dom.importDiffStatus, msg, 'ok');
          var external = state.importDiff.external || null;
          if (external && typeof external.resolve === 'function') {
            state.importDiff.external = null;
            try {
              external.resolve({ ok: true, overwrite: true, result: res || null });
            } catch (e) {
              // ignore
            }
          }
          var q = state.importDiff && state.importDiff.queue ? state.importDiff.queue : null;
          var keepOpen = Boolean(q && q.active && Number(q.total) > 0 && Number(q.index) < Number(q.total) - 1);
          if (!keepOpen && importDiffDrawerInstance && typeof importDiffDrawerInstance.close === 'function') {
            importDiffDrawerInstance.close();
          }
        })
        .catch(function(err) {
          var msg = err && err.message ? err.message : '追加入库失败';
          setStatus(dom.importDiffStatus, '追加入库失败：' + msg, 'err');
          var external = state.importDiff.external || null;
          if (external && typeof external.resolve === 'function') {
            state.importDiff.external = null;
            try {
              external.resolve({ ok: false, reason: 'append_overwrite_failed', error: err || null });
            } catch (e) {
              // ignore
            }
          }
        })
        .finally(function() {
          state.importDiff.loading = false;
          syncImportDiffControls();
        });
      return;
    }
    var projectId = state.importDiff.projectId;
    var versionId = state.importDiff.importVersionId;
    var originalFileName = state.importDiff.fileName || '';
    var cleanName = state.importDiff.cleanName || originalFileName || '用例';
    var ext = (String(originalFileName || '').split('.').pop() || '').toLowerCase();
    if (!ext || ext === String(originalFileName || '').toLowerCase()) ext = 'xmind';
    var overwriteFileName = String(state.importDiff.cleanName || cleanCaseFileName(originalFileName) || 'case') + '.' + ext;
    var source = state.importDiff.source || extFromFileName(originalFileName);
    var items = Array.isArray(state.importDiff.importItems) ? state.importDiff.importItems : [];
    if (!projectId || !versionId || !overwriteFileName || !items.length) {
      setStatus(dom.importDiffStatus, '差异数据未就绪，请稍后重试', 'warn');
      return;
    }
    var confirmMsg = '是否确认覆盖导入用例：' + cleanName + '？';
    state.importDiff.confirming = true;
    syncImportDiffControls();
    openConfirmDrawer({
      title: '确认覆盖导入',
      message: confirmMsg,
      confirmText: '确认覆盖导入',
      cancelText: '取消',
      previousDrawer: importDiffDrawerInstance,
    }).then(function(res) {
      state.importDiff.confirming = false;
      syncImportDiffControls();
      if (!res || res.ok !== true) return;

      state.importDiff.loading = true;
      syncImportDiffControls();
      setStatus(dom.importDiffStatus, '覆盖导入中...', '');
      setStatus(dom.importStatus, '覆盖导入中...', '');

      apiClient
        .importCaseFile(
          {
            project_id: projectId,
            version_id: versionId,
            file_name: overwriteFileName,
            source: source,
            items: items,
          },
          { overwrite: true }
        )
        .then(function(caseFile) {
          var msg = '覆盖导入成功：' + cleanName;
          setStatus(dom.importDiffStatus, msg, 'ok');
          setStatus(dom.importStatus, msg, 'ok');
          setStatus(dom.status, msg, 'ok');
          refreshCaseFileListsByProject(projectId);
          var external = state.importDiff.external || null;
          if (external && typeof external.resolve === 'function') {
            state.importDiff.external = null;
            try {
              external.resolve({ ok: true, overwrite: true, caseFile: caseFile || null });
            } catch (e) {
              // ignore
            }
          }
          var q = state.importDiff && state.importDiff.queue ? state.importDiff.queue : null;
          var keepOpen = Boolean(q && q.active && Number(q.total) > 0 && Number(q.index) < Number(q.total) - 1);
          if (!keepOpen && importDiffDrawerInstance && typeof importDiffDrawerInstance.close === 'function') {
            importDiffDrawerInstance.close();
          }
        })
        .catch(function(err) {
          var msg = err && err.message ? err.message : '覆盖导入失败';
          setStatus(dom.importDiffStatus, '覆盖导入失败：' + msg, 'err');
          setStatus(dom.importStatus, '覆盖导入失败：' + msg, 'err');
          var external = state.importDiff.external || null;
          if (external && typeof external.resolve === 'function') {
            state.importDiff.external = null;
            try {
              external.resolve({ ok: false, reason: 'overwrite_failed', error: err || null });
            } catch (e) {
              // ignore
            }
          }
        })
        .finally(function() {
          state.importDiff.loading = false;
          syncImportDiffControls();
        });
    });
  }

  function formatTime(value) {
    if (!value) return '--';
    function normalizeTimeInput(input) {
      if (!input) return '';
      if (typeof input === 'number') return input;
      var raw = String(input || '').trim();
      if (!raw) return '';
      // 兼容 SQLite/Pydantic 输出：若时间不含时区信息，默认按 UTC 解释（避免展示少 8 小时）。
      if (raw.indexOf('T') === -1 && raw.indexOf(' ') !== -1) {
        raw = raw.replace(' ', 'T');
      }
      raw = raw.replace(/(\.\d{3})\d+/, '$1');
      raw = raw.replace(/([+-]\d{2}):(\d{2})$/, '$1$2');
      var hasTz = /Z$/i.test(raw) || /[+-]\d{2}\d{2}$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw);
      var isIsoWithTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw);
      if (isIsoWithTime && !hasTz) raw += 'Z';
      return raw;
    }
    try {
      var normalized = normalizeTimeInput(value);
      var d = typeof normalized === 'number' ? new Date(normalized) : new Date(normalized || value);
      if (!d || isNaN(d.getTime())) return String(value || '--');
      return d.toLocaleString();
    } catch (e) {
      return String(value || '--');
    }
  }

  function normalizeCaseLibHistoryKind(raw) {
    var kind = String(raw || '').trim().toLowerCase();
    if (kind === 'append') return kind;
    if (kind === 'added' || kind === 'updated' || kind === 'deleted') return kind;
    if (kind === 'import' || kind === 'reimport' || kind === 'file_deleted') return kind;
    return kind;
  }

  function getCaseLibHistoryKindLabel(kind) {
    var k = normalizeCaseLibHistoryKind(kind);
    if (k === 'append') return '追加';
    if (k === 'added') return '新增';
    if (k === 'updated') return '改动';
    if (k === 'deleted') return '删除';
    if (k === 'import') return '导入';
    if (k === 'reimport') return '重导';
    if (k === 'file_deleted') return '整份删除';
    return k || '--';
  }

  function setCaseLibraryHistoryFilter(next) {
    var current = state.historyDetail && state.historyDetail.filter ? String(state.historyDetail.filter) : '';
    var normalized = normalizeCaseLibHistoryKind(next);
    state.historyDetail.filter = current === normalized ? '' : normalized;
    state.historyDetail.pageIndex = 0;
    renderCaseLibraryHistory();
    persistHistoryDetailSelection();
  }

  function setHistoryDetailVisible(visible) {
    if (!dom.historyDetailCard || !dom.historyDetailCard.classList) return;
    // 兜底：部分环境下静态 CSS 资源可能加载抖动，增加 hidden 属性确保“隐藏”语义可靠。
    try { dom.historyDetailCard.hidden = !visible; } catch (_) {}
    if (visible) dom.historyDetailCard.classList.remove('hidden');
    else dom.historyDetailCard.classList.add('hidden');
    // 保证视图互斥：展示历史详情时应隐藏编辑卡片（但不清理编辑持久化，方便回退）。
    if (visible) showEditorCard(false);
  }

  function renderCaseLibraryHistory() {
    if (!dom.historyBody) return;
    var selectedProjectId = state.historyDetail && state.historyDetail.projectId ? String(state.historyDetail.projectId) : '';
    var selectedFileName = state.historyDetail && state.historyDetail.fileNameClean ? String(state.historyDetail.fileNameClean) : '';

    function setHistoryPagination(html) {
      if (dom.historyPaginationTop) dom.historyPaginationTop.innerHTML = html || '';
      if (dom.historyPaginationBottom) dom.historyPaginationBottom.innerHTML = html || '';
    }

    function buildHistoryPagination(total, pageIndex, totalPages, start, end) {
      total = Number(total) || 0;
      pageIndex = Number(pageIndex) || 0;
      totalPages = Number(totalPages) || 1;
      start = Number(start) || 0;
      end = Number(end) || 0;
      var currentPage = totalPages ? pageIndex + 1 : 1;
      var maxPage = totalPages || 1;
      var rangeInfo = total ? ('显示 ' + (start + 1) + '-' + end + ' / 共 ' + total + ' 条') : '暂无记录';
      return (
        '<div class=\"temp-pagination\" data-case-lib-history-pagination>' +
          '<div class=\"temp-pagination-info\">' + escapeHtml(rangeInfo) + '，每页 ' + getPageSize() + ' 条</div>' +
          '<div class=\"temp-pagination-controls\">' +
            '<button type=\"button\" class=\"secondary\" data-case-lib-history-page=\"prev\" ' + (pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
            '<button type=\"button\" class=\"secondary\" data-case-lib-history-page=\"next\" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
            '<label>跳转</label>' +
            '<input type=\"number\" min=\"1\" max=\"' + maxPage + '\" value=\"' + Math.min(currentPage, maxPage) + '\" data-case-lib-history-page-input>' +
          '</div>' +
        '</div>'
      );
    }

    if (dom.historyCaseName) {
      if (selectedProjectId && selectedFileName) {
        var projectName = state.projectNameById[selectedProjectId] || ('项目#' + selectedProjectId);
        var versionName = getVersionName(
          selectedProjectId,
          state.historyDetail && state.historyDetail.versionId ? String(state.historyDetail.versionId) : ''
        );
        var base = projectName + ' / ' + versionName + ' / ' + (selectedFileName || '--');
        dom.historyCaseName.textContent = base + (state.historyDetail && state.historyDetail.isDeleted ? '（已删除）' : '');
      } else {
        dom.historyCaseName.textContent = '';
      }
    }

    var filter = state.historyDetail && state.historyDetail.filter ? String(state.historyDetail.filter) : '';
    var list = state.historyDetail && Array.isArray(state.historyDetail.history) ? state.historyDetail.history : [];
    var totalSummary = { append: 0, added: 0, updated: 0, deleted: 0, import: 0, reimport: 0, file_deleted: 0 };
    list.forEach(function(row) {
      var k = normalizeCaseLibHistoryKind(row && row.kind);
      if (k && totalSummary[k] !== undefined) totalSummary[k] += 1;
    });

    function syncPill(pillEl, key, label) {
      if (!pillEl) return;
      pillEl.textContent = label + ' ' + (totalSummary[key] || 0);
      pillEl.classList.toggle('active', filter === key);
    }
    syncPill(dom.historyAppendPill, 'append', '追加');
    syncPill(dom.historyAddedPill, 'added', '新增');
    syncPill(dom.historyUpdatedPill, 'updated', '改动');
    syncPill(dom.historyDeletedPill, 'deleted', '删除');
    syncPill(dom.historyImportPill, 'import', '导入');
    syncPill(dom.historyReimportPill, 'reimport', '重导');
    syncPill(dom.historyFileDeletedPill, 'file_deleted', '整份删除');

    var visible = filter
      ? list.filter(function(row) { return normalizeCaseLibHistoryKind(row && row.kind) === filter; })
      : list.slice();

    if (!selectedProjectId || !selectedFileName) {
      dom.historyBody.innerHTML = '<tr><td colspan="9"><p class="hint">请先在“用例改动历史”中选择用例查看详情。</p></td></tr>';
      setHistoryPagination('');
      return;
    }

    if (!visible.length) {
      dom.historyBody.innerHTML = '<tr><td colspan="9"><p class="hint">暂无记录</p></td></tr>';
      setHistoryPagination(buildHistoryPagination(0, 0, 1, 0, 0));
      return;
    }

    var pageSize = getPageSize();
    var total = visible.length;
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    if (state.historyDetail.pageIndex >= totalPages) state.historyDetail.pageIndex = Math.max(totalPages - 1, 0);
    if (state.historyDetail.pageIndex < 0) state.historyDetail.pageIndex = 0;
    var start = state.historyDetail.pageIndex * pageSize;
    var end = Math.min(total, start + pageSize);
    var paged = visible.slice(start, end);
    setHistoryPagination(buildHistoryPagination(total, state.historyDetail.pageIndex, totalPages, start, end));

    function buildCell(oldSnap, newSnap, key, changed) {
      var oldVal = oldSnap && oldSnap[key] !== undefined && oldSnap[key] !== null ? String(oldSnap[key]) : '';
      var newVal = newSnap && newSnap[key] !== undefined && newSnap[key] !== null ? String(newSnap[key]) : '';
      if (!changed) {
        var text = newVal || oldVal || '';
        return '<div class="case-lib-diff-cell"><div class="case-lib-diff-only">' + escapeHtmlPreserve(text) + '</div></div>';
      }
      return (
        '<div class="case-lib-diff-cell">' +
          '<div class="case-lib-diff-old">旧：' + escapeHtmlPreserve(oldVal) + '</div>' +
          '<div class="case-lib-diff-new">新：' + escapeHtmlPreserve(newVal) + '</div>' +
        '</div>'
      );
    }

    dom.historyBody.innerHTML = paged.map(function(row) {
      var kind = normalizeCaseLibHistoryKind(row && row.kind);
      var operator = row && row.operator ? String(row.operator) : '';
      var timeText = formatTime(row && row.changed_at ? row.changed_at : '');
      var typeTag = '<span class="tag case-lib-diff-kind ' + escapeHtml(kind) + '">' + escapeHtml(getCaseLibHistoryKindLabel(kind)) + '</span>';

      if (kind === 'append' || kind === 'import' || kind === 'reimport' || kind === 'file_deleted') {
        var titleText = getCaseLibHistoryKindLabel(kind);
        return (
          '<tr>' +
            '<td>' + typeTag + '</td>' +
            '<td class="case-lib-diff-time">' + escapeHtml(timeText) + '</td>' +
            '<td class="case-lib-diff-operator">' + escapeHtml(operator) + '</td>' +
            '<td><div class="case-lib-diff-cell"><div class="case-lib-diff-only">' + escapeHtml(selectedFileName) + '</div></div></td>' +
            '<td><div class="case-lib-diff-cell"><div class="case-lib-diff-only">-</div></div></td>' +
            '<td><div class="case-lib-diff-cell"><div class="case-lib-diff-only">' + escapeHtml(titleText) + '</div></div></td>' +
            '<td><div class="case-lib-diff-cell"><div class="case-lib-diff-only">-</div></div></td>' +
            '<td><div class="case-lib-diff-cell"><div class="case-lib-diff-only">-</div></div></td>' +
            '<td><div class="case-lib-diff-cell"><div class="case-lib-diff-only">-</div></div></td>' +
          '</tr>'
        );
      }

      var oldSnap = row && row.old && typeof row.old === 'object' ? row.old : null;
      var newSnap = row && row.new && typeof row.new === 'object' ? row.new : null;
      var changedFields = Array.isArray(row && row.changed_fields) ? row.changed_fields : [];
      var changedMap = {};
      changedFields.forEach(function(f) { changedMap[String(f)] = true; });

      return (
        '<tr>' +
          '<td>' + typeTag + '</td>' +
          '<td class="case-lib-diff-time">' + escapeHtml(timeText) + '</td>' +
          '<td class="case-lib-diff-operator">' + escapeHtml(operator) + '</td>' +
          '<td><div class="case-lib-diff-cell"><div class="case-lib-diff-only">' + escapeHtml(selectedFileName) + '</div></div></td>' +
          '<td>' + buildCell(oldSnap, newSnap, 'module', Boolean(changedMap.module)) + '</td>' +
          '<td>' + buildCell(oldSnap, newSnap, 'title', Boolean(changedMap.title)) + '</td>' +
          '<td>' + buildCell(oldSnap, newSnap, 'precondition', Boolean(changedMap.precondition)) + '</td>' +
          '<td>' + buildCell(oldSnap, newSnap, 'steps', Boolean(changedMap.steps)) + '</td>' +
          '<td>' + buildCell(oldSnap, newSnap, 'expected', Boolean(changedMap.expected)) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function handleHistoryDetailPaginationAction(action) {
    var filter = state.historyDetail && state.historyDetail.filter ? String(state.historyDetail.filter) : '';
    var list = state.historyDetail && Array.isArray(state.historyDetail.history) ? state.historyDetail.history : [];
    var visible = filter
      ? list.filter(function(row) { return normalizeCaseLibHistoryKind(row && row.kind) === filter; })
      : list.slice();
    var total = visible.length;
    var pageSize = getPageSize();
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    if (!action) return;
    if (action === 'prev') state.historyDetail.pageIndex -= 1;
    else if (action === 'next') state.historyDetail.pageIndex += 1;
    else if (action === 'first') state.historyDetail.pageIndex = 0;
    else if (action === 'last') state.historyDetail.pageIndex = totalPages - 1;
    if (state.historyDetail.pageIndex < 0) state.historyDetail.pageIndex = 0;
    if (state.historyDetail.pageIndex >= totalPages) state.historyDetail.pageIndex = Math.max(totalPages - 1, 0);
    renderCaseLibraryHistory();
    persistHistoryDetailSelection();
  }

  function handleHistoryDetailPaginationJump(value) {
    var filter = state.historyDetail && state.historyDetail.filter ? String(state.historyDetail.filter) : '';
    var list = state.historyDetail && Array.isArray(state.historyDetail.history) ? state.historyDetail.history : [];
    var visible = filter
      ? list.filter(function(row) { return normalizeCaseLibHistoryKind(row && row.kind) === filter; })
      : list.slice();
    var total = visible.length;
    var pageSize = getPageSize();
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    var n = Number(value);
    if (!isFinite(n)) return;
    var idx = Math.max(0, Math.min(totalPages - 1, Math.floor(n - 1)));
    state.historyDetail.pageIndex = idx;
    renderCaseLibraryHistory();
    persistHistoryDetailSelection();
  }

  function resetHistoryQueryDrawer() {
    state.historyQueryDrawer.projectId = null;
    state.historyQueryDrawer.versionId = null;
    state.historyQueryDrawer.searchText = '';
    state.historyQueryDrawer.files = [];
    state.historyQueryDrawer.loading = false;
    setStatus(dom.historyDrawerStatus, '', '');
    syncProjectOptions(dom.historyDrawerProjectSelect, '请选择项目');
    if (dom.historyDrawerProjectSelect) dom.historyDrawerProjectSelect.value = '';
    if (dom.historyDrawerVersionSelect) {
      dom.historyDrawerVersionSelect.disabled = true;
      dom.historyDrawerVersionSelect.innerHTML = '<option value=\"\">请选择版本</option><option value=\"0\">全部版本</option>';
      dom.historyDrawerVersionSelect.value = '';
    }
    if (dom.historyDrawerSearchInput) dom.historyDrawerSearchInput.value = '';
    if (dom.historyDrawerListBody) {
      dom.historyDrawerListBody.innerHTML = '<tr><td colspan=\"8\"><p class=\"hint\">请选择项目与版本后点击“查询”。</p></td></tr>';
    }
  }

  function getHistoryQueryVisibleFiles() {
    var list = state.historyQueryDrawer && Array.isArray(state.historyQueryDrawer.files) ? state.historyQueryDrawer.files : [];
    var q = state.historyQueryDrawer && state.historyQueryDrawer.searchText ? String(state.historyQueryDrawer.searchText).trim().toLowerCase() : '';
    if (!q) return list.slice();
    return list.filter(function(f) {
      var name = f && f.file_name_clean ? String(f.file_name_clean) : '';
      return name.toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderHistoryQueryDrawerList() {
    if (!dom.historyDrawerListBody) return;
    var visible = getHistoryQueryVisibleFiles();
    if (!visible.length) {
      dom.historyDrawerListBody.innerHTML = '<tr><td colspan=\"8\"><p class=\"hint\">暂无有改动记录的用例文件</p></td></tr>';
      return;
    }
    dom.historyDrawerListBody.innerHTML = visible.map(function(f) {
      var pid = f && (f.project_id || f.project_id === 0) ? String(f.project_id) : '';
      var vid = f && (f.version_id || f.version_id === 0) ? String(f.version_id) : '';
      var name = f && f.file_name_clean ? String(f.file_name_clean) : '--';
      var nameText = name + (f && f.is_deleted ? '（已删除）' : '');
      var changedAt = formatTime(f && f.last_changed_at ? f.last_changed_at : '');
      var versionName = vid ? getVersionName(pid, vid) : '--';
      var importer = f && f.importer_name ? String(f.importer_name) : '--';
      var importedAt = formatTime(f && f.imported_at ? f.imported_at : '');
      var updatedBy = f && f.last_updated_by_name ? String(f.last_updated_by_name) : (f && f.last_operator ? String(f.last_operator) : '--');
      var updatedAt = formatTime(f && f.updated_at ? f.updated_at : '');
      return (
        '<tr>' +
          '<td class=\"case-lib-diff-time\">' + escapeHtml(changedAt) + '</td>' +
          '<td>' + escapeHtml(nameText) + '</td>' +
          '<td>' + escapeHtml(versionName) + '</td>' +
          '<td class=\"case-lib-diff-operator\">' + escapeHtml(importer) + '</td>' +
          '<td class=\"case-lib-diff-time\">' + escapeHtml(importedAt) + '</td>' +
          '<td class=\"case-lib-diff-operator\">' + escapeHtml(updatedBy) + '</td>' +
          '<td class=\"case-lib-diff-time\">' + escapeHtml(updatedAt) + '</td>' +
          '<td>' +
            '<button type=\"button\" class=\"secondary\" data-case-lib-history-open=\"1\" data-case-lib-history-project=\"' + escapeHtml(pid) + '\" data-case-lib-history-file=\"' + escapeHtml(name) + '\" data-case-lib-history-version=\"' + escapeHtml(vid) + '\">历史详情</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function handleHistoryQueryProjectChange() {
    state.historyQueryDrawer.projectId = normalizeId(dom.historyDrawerProjectSelect ? dom.historyDrawerProjectSelect.value : '');
    state.historyQueryDrawer.versionId = null;
    state.historyQueryDrawer.files = [];
    setStatus(dom.historyDrawerStatus, '', '');
    persistHistoryQueryState();
    if (dom.historyDrawerVersionSelect) {
      dom.historyDrawerVersionSelect.disabled = true;
      dom.historyDrawerVersionSelect.innerHTML = '<option value=\"\">加载版本中...</option>';
    }
    renderHistoryQueryDrawerList();
    var pid = state.historyQueryDrawer.projectId;
    if (!pid) {
      if (dom.historyDrawerVersionSelect) {
        dom.historyDrawerVersionSelect.disabled = true;
        dom.historyDrawerVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
        dom.historyDrawerVersionSelect.value = '';
      }
      return;
    }
    loadVersions(pid).then(function() {
      if (dom.historyDrawerVersionSelect) {
        dom.historyDrawerVersionSelect.disabled = false;
        syncVersionOptionsWithAll(dom.historyDrawerVersionSelect, pid);
        dom.historyDrawerVersionSelect.value = '0';
        state.historyQueryDrawer.versionId = 0;
        persistHistoryQueryState();
      }
    });
  }

  function handleHistoryQueryVersionChange() {
    state.historyQueryDrawer.versionId = normalizeId(dom.historyDrawerVersionSelect ? dom.historyDrawerVersionSelect.value : '');
    persistHistoryQueryState();
  }

  function handleHistoryQuerySearchInput() {
    state.historyQueryDrawer.searchText = String(dom.historyDrawerSearchInput ? dom.historyDrawerSearchInput.value : '');
    renderHistoryQueryDrawerList();
    persistHistoryQueryState();
  }

  function clearHistoryQuerySearch() {
    state.historyQueryDrawer.searchText = '';
    if (dom.historyDrawerSearchInput) dom.historyDrawerSearchInput.value = '';
    renderHistoryQueryDrawerList();
    persistHistoryQueryState();
  }

  function loadHistoryQueryDrawerFiles() {
    if (!apiClient || typeof apiClient.listCaseLibraryChangeFiles !== 'function') {
      setStatus(dom.historyDrawerStatus, '缺少历史接口（apiClient.listCaseLibraryChangeFiles）', 'warn');
      state.historyQueryDrawer.files = [];
      renderHistoryQueryDrawerList();
      return Promise.resolve([]);
    }
    var pid = state.historyQueryDrawer.projectId;
    var vid = state.historyQueryDrawer.versionId;
    if (!pid || vid === null || vid === undefined) {
      setStatus(dom.historyDrawerStatus, '请先选择项目与版本', 'warn');
      return Promise.resolve([]);
    }
    state.historyQueryDrawer.loading = true;
    setStatus(dom.historyDrawerStatus, '加载中...', '');
    return apiClient
      .listCaseLibraryChangeFiles({ project_id: pid, version_id: vid, limit: 500 })
      .then(function(list) {
        state.historyQueryDrawer.files = Array.isArray(list) ? list : [];
        setStatus(dom.historyDrawerStatus, '已加载 ' + state.historyQueryDrawer.files.length + ' 条（仅展示有改动记录的用例）', state.historyQueryDrawer.files.length ? 'ok' : '');
        renderHistoryQueryDrawerList();
        persistHistoryQueryState();
        return state.historyQueryDrawer.files;
      })
      .catch(function(err) {
        var msg = err && err.message ? err.message : '加载失败';
        setStatus(dom.historyDrawerStatus, '查询失败：' + msg, 'err');
        state.historyQueryDrawer.files = [];
        renderHistoryQueryDrawerList();
        return [];
      })
      .finally(function() {
        state.historyQueryDrawer.loading = false;
      });
  }

  function openCaseLibraryHistoryDetail(projectId, fileNameClean, versionId) {
    var pid = projectId === null || projectId === undefined ? '' : String(projectId);
    var name = String(fileNameClean || '').trim();
    if (!pid || !name) return;
    state.historyDetail.projectId = pid;
    state.historyDetail.fileNameClean = name;
    state.historyDetail.filter = '';
    state.historyDetail.history = [];
    state.historyDetail.isDeleted = false;
    state.historyDetail.versionId = versionId || null;
    state.historyDetail.pageIndex = 0;
    setHistoryDetailVisible(true);
    if (dom.editCard && dom.editCard.classList) dom.editCard.classList.add('hidden');
    if (historyDrawerInstance && typeof historyDrawerInstance.close === 'function') historyDrawerInstance.close();
    setStatus(dom.historyStatus, '加载历史记录中...', '');
    renderCaseLibraryHistory();
    persistHistoryDetailSelection();
    persistCaseLibraryLastView('history');
    loadCaseLibraryHistoryEntries(pid, name).then(function() {
      try {
        if (dom.historyDetailCard && typeof dom.historyDetailCard.scrollIntoView === 'function') {
          dom.historyDetailCard.scrollIntoView();
        }
      } catch (e) {
        // ignore
      }
    });
  }

  function loadCaseLibraryHistoryEntries(projectId, fileNameClean) {
    if (!apiClient || typeof apiClient.getCaseLibraryChangeHistory !== 'function') {
      setStatus(dom.historyStatus, '缺少历史接口（apiClient.getCaseLibraryChangeHistory）', 'warn');
      state.historyDetail.history = [];
      renderCaseLibraryHistory();
      return Promise.resolve(null);
    }
    var pid = projectId === null || projectId === undefined ? '' : String(projectId);
    var name = String(fileNameClean || '').trim();
    if (!pid || !name) {
      state.historyDetail.history = [];
      setStatus(dom.historyStatus, '请选择一个用例查看历史记录', '');
      renderCaseLibraryHistory();
      return Promise.resolve(null);
    }
    state.historyDetail.loading = true;
    setStatus(dom.historyStatus, '加载历史记录中...', '');
    var vid = state.historyDetail && state.historyDetail.versionId !== null && state.historyDetail.versionId !== undefined
      ? state.historyDetail.versionId
      : null;
    return apiClient
      .getCaseLibraryChangeHistory(pid, name, { limit: 800, version_id: vid })
      .then(function(res) {
        var history = res && Array.isArray(res.history) ? res.history : [];
        state.historyDetail.isDeleted = Boolean(res && res.is_deleted);
        state.historyDetail.versionId = res && (res.version_id || res.version_id === 0) ? res.version_id : state.historyDetail.versionId;
        state.historyDetail.history = history;
        var statusText = '';
        if (state.historyDetail.isDeleted) {
          statusText = '该用例已被整份删除（未重新导入），历史记录仍保留。';
        } else {
          statusText = history.length ? ('已加载 ' + history.length + ' 条历史记录') : '暂无历史记录';
        }
        setStatus(dom.historyStatus, statusText, history.length ? 'ok' : '');
        renderCaseLibraryHistory();
        persistHistoryDetailSelection();
        return res;
      })
      .catch(function(err) {
        var msg = err && err.message ? err.message : '加载失败';
        setStatus(dom.historyStatus, '加载历史记录失败：' + msg, 'err');
        state.historyDetail.history = [];
        renderCaseLibraryHistory();
        return null;
      })
      .finally(function() {
        state.historyDetail.loading = false;
      });
  }

	  function normalizeName(value) {
	    return String(value || '').trim().toLowerCase();
	  }

	  var INVISIBLE_MARKER_RE = /[\u200b\u200c\u200d\u2060\ufeff]/g;
	  var INVISIBLE_MARKER_SET = ['\u200b', '\u200c', '\u200d', '\u2060', '\ufeff'];

	  function stripInvisibleMarkers(value) {
	    if (value === null || value === undefined) return '';
	    try {
	      return String(value).replace(INVISIBLE_MARKER_RE, '');
	    } catch (err) {
	      return '';
	    }
	  }

	  function normalizeEditorText(value) {
	    return stripInvisibleMarkers(value).trim();
	  }

	  function buildInvisibleMarker(seed) {
	    var raw = '';
	    try {
	      raw = String(seed || '') + '|' + Date.now().toString(16) + '|' + Math.random().toString(16).slice(2);
	    } catch (e) {
	      raw = Date.now().toString(16) + '|' + Math.random().toString(16).slice(2);
	    }
	    var out = '';
	    for (var i = 0; i < raw.length; i += 1) {
	      var code = raw.charCodeAt(i);
	      out += INVISIBLE_MARKER_SET[code % INVISIBLE_MARKER_SET.length];
	    }
	    return out || INVISIBLE_MARKER_SET[0];
	  }

  function clampPageSize(value) {
    var n = Number(value);
    if (!isFinite(n) || n <= 0) return 20;
    if (n < 5) return 5;
    if (n > 200) return 200;
    return Math.floor(n);
  }

  function getPageSize() {
    var globalState = window.app && window.app.state ? window.app.state : {};
    return clampPageSize(globalState.tempExecPageSize || 20);
  }

  function cleanCaseFileName(name) {
    var raw = name || '';
    var base = raw.split(/[\\/]/).pop() || raw;
    var xmindApi = window.app && window.app.xmindCoreApi ? window.app.xmindCoreApi : null;
    var cleaned = '';
    if (xmindApi && typeof xmindApi.getSafeFileBaseName === 'function') {
      cleaned = xmindApi.getSafeFileBaseName(base, 'case');
    } else {
      cleaned = base.replace(/\.[^.]+$/, '');
      var pattern = /(_result)?_\d{8}(?:_?\d{6})?$/i;
      while (pattern.test(cleaned)) cleaned = cleaned.replace(pattern, '');
    }
    cleaned = String(cleaned || '').replace(/^勾选用例[\s_\-\u2010-\u2015\u2212\uFE63\uFF0D]*/i, '');
    cleaned = cleaned.trim().replace(/^[_-]+|[_-]+$/g, '');
    return cleaned || 'case';
  }

  function extFromFileName(name) {
    var ext = (String(name || '').split('.').pop() || '').toLowerCase();
    return ext ? ('file:' + ext) : 'file';
  }

  function getDownloadBlob() {
    if (utils && typeof utils.downloadBlob === 'function') return utils.downloadBlob;
    var coreApi = getCore();
    if (coreApi && typeof coreApi.downloadBlob === 'function') return coreApi.downloadBlob;
    return function() {};
  }

  function sanitizeDownloadName(base, ext) {
    var name = String(base || '').trim() || '用例';
    name = name.replace(/\.[^.]+$/, '');
    name = name.replace(/[\\/:*?"<>|]/g, '_').trim();
    if (!name) name = '用例';
    return name + (ext || '');
  }

  function escapeXmlText(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function escapeXmlTextPreserve(text) {
    var escaped = escapeXmlText(text);
    escaped = escaped.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return escaped.replace(/\n/g, '&#10;');
  }

  function getCurrentUserId() {
    var globalState = window.app && window.app.state ? window.app.state : null;
    var user = globalState && globalState.currentUser ? globalState.currentUser : null;
    var userId = user && user.id !== undefined && user.id !== null ? user.id : null;
    if (!userId || String(userId) === '0') return null;
    return userId;
  }

  function getCurrentUsername() {
    var globalState = window.app && window.app.state ? window.app.state : null;
    var user = globalState && globalState.currentUser ? globalState.currentUser : null;
    var name = user && user.username ? String(user.username) : '';
    return name.trim();
  }

  function getCurrentLoginSeq() {
    // 兼容“用户信息尚未加载但已进入页面”的场景：用 loginSeq 作为一次登录会话的稳定标识。
    if (typeof localStorage === 'undefined') return '';
    try {
      return String(localStorage.getItem('tap-login-seq') || '');
    } catch (err) {
      return '';
    }
  }

  function normalizeEditDrawerOwnerFilter(value) {
    var raw = value === null || value === undefined ? '' : String(value);
    raw = raw.trim().toLowerCase();
    if (raw === 'all') return 'all';
    if (raw === 'me') return 'me';
    return 'me';
  }

  function syncEditDrawerOwnerFilterOptions() {
    if (!dom.editDrawerOwnerFilterSelect) return;
    var username = getCurrentUsername();
    dom.editDrawerOwnerFilterSelect.innerHTML =
      '<option value="all">全部</option>' +
      '<option value="me">' + escapeHtml(username || '我') + '</option>';
    var desired = normalizeEditDrawerOwnerFilter(state.editDrawer && state.editDrawer.ownerFilter ? state.editDrawer.ownerFilter : 'me');
    // 若未登录或拿不到用户信息，则默认“全部”，避免误过滤导致列表为空。
    if (!username) desired = 'all';
    state.editDrawer.ownerFilter = desired;
    dom.editDrawerOwnerFilterSelect.value = desired;
  }

	  var editorPersistKey = 'tap-case-library-editor';
	  var editorBatchAddCountPersistKey = 'tap-case-library-editor-batch-add-count';

	  function readEditorPersistedState() {
	    if (typeof localStorage === 'undefined') return null;
	    try {
      var raw = localStorage.getItem(editorPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeEditorPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(editorPersistKey);
        return;
      }
      localStorage.setItem(editorPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

	  function clearEditorPersistedState() {
	    writeEditorPersistedState(null);
	  }

	  function readEditorBatchAddCountPersistedState() {
	    if (typeof localStorage === 'undefined') return null;
	    try {
	      var raw = localStorage.getItem(editorBatchAddCountPersistKey);
	      if (!raw) return null;
	      var parsed = JSON.parse(raw);
	      if (!parsed || typeof parsed !== 'object') return null;
	      return parsed;
	    } catch (err) {
	      return null;
	    }
	  }

	  function writeEditorBatchAddCountPersistedState(payload) {
	    if (typeof localStorage === 'undefined') return;
	    try {
	      if (!payload) {
	        localStorage.removeItem(editorBatchAddCountPersistKey);
	        return;
	      }
	      localStorage.setItem(editorBatchAddCountPersistKey, JSON.stringify(payload));
	    } catch (err) {
	      // ignore
	    }
	  }

	  function clampBatchAddCount(value) {
	    var n = Number(value);
	    if (!isFinite(n)) return 5;
	    n = Math.floor(n);
	    if (n < 1) n = 1;
	    if (n > 10) n = 10;
	    return n;
	  }

	  function persistEditorBatchAddCount(count) {
	    var userId = getCurrentUserId();
	    writeEditorBatchAddCountPersistedState({
	      user_id: userId || null,
	      count: clampBatchAddCount(count),
	      updated_at: Date.now(),
	    });
	  }

	  function restoreEditorBatchAddCountFromPersistedState() {
	    var persisted = readEditorBatchAddCountPersistedState();
	    if (!persisted || typeof persisted !== 'object') return;
	    var userId = getCurrentUserId();
	    var persistedUser = persisted.user_id !== null && persisted.user_id !== undefined ? String(persisted.user_id) : '';
	    if (userId && persistedUser && persistedUser !== String(userId)) return;
	    state.editor.batchAddCount = clampBatchAddCount(persisted.count);
	  }

  var importDrawerPersistKey = 'tap-case-library-import-drawer';

  function readImportDrawerPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(importDrawerPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeImportDrawerPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(importDrawerPersistKey);
        return;
      }
      localStorage.setItem(importDrawerPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

  function persistImportDrawerState(nextProjectId, nextVersionId) {
    var userId = getCurrentUserId();
    if (!userId) return;
    // 若传入为空，默认不覆盖旧值，避免误把“初始化空值”写回导致无法恢复。
    var persisted = readImportDrawerPersistedState();
    if (persisted && String(persisted.user_id || '') !== String(userId)) {
      persisted = null;
    }
    var projectId = nextProjectId || (persisted ? normalizeId(persisted.project_id) : null);
    var versionId = nextVersionId || (persisted ? normalizeId(persisted.version_id) : null);
    if (!projectId) return;
    writeImportDrawerPersistedState({
      user_id: userId,
      project_id: projectId || '',
      version_id: versionId || '',
      saved_at: Date.now(),
    });
  }

  function restoreImportDrawerFromPersistedState() {
    if (!isAuthReady()) return Promise.resolve(false);
    var persisted = readImportDrawerPersistedState();
    if (!persisted) return Promise.resolve(false);
    var userId = getCurrentUserId();
    if (!userId || String(persisted.user_id || '') !== String(userId)) return Promise.resolve(false);

    var projectId = normalizeId(persisted.project_id);
    var versionId = normalizeId(persisted.version_id);
    if (!projectId) return Promise.resolve(false);

    var hasProject = (state.projects || []).some(function(p) { return p && String(p.id) === String(projectId); });
    if (!hasProject) return Promise.resolve(false);

    state.importDrawer.projectId = projectId;
    state.importDrawer.versionId = null;
    if (dom.importProjectSelect) dom.importProjectSelect.value = String(projectId);

    if (!dom.importVersionSelect) {
      syncImportConfirmEnabled();
      return Promise.resolve(true);
    }

    dom.importVersionSelect.disabled = true;
    dom.importVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
    dom.importVersionSelect.value = '';
    syncImportConfirmEnabled();

    return loadVersions(projectId)
      .then(function() {
        syncVersionOptions(dom.importVersionSelect, projectId, '请选择版本');
        dom.importVersionSelect.disabled = false;
        if (versionId) {
          // 仅当版本存在于下拉选项时才回填。
          var ok = (state.versionsByProject[projectId] || []).some(function(v) { return v && String(v.id) === String(versionId); });
          if (ok) {
            dom.importVersionSelect.value = String(versionId);
            state.importDrawer.versionId = versionId;
          }
        }
        syncImportConfirmEnabled();
        return true;
      })
      .catch(function() {
        // 恢复失败不影响抽屉使用
        return false;
      });
  }

  function persistEditorSelection(caseFile) {
    if (!caseFile || caseFile.id === null || caseFile.id === undefined) return;
    var userId = getCurrentUserId();
    if (!userId) return;
    var payload = {
      user_id: userId,
      project_id: caseFile.project_id,
      case_file_id: caseFile.id,
      saved_at: Date.now(),
    };
    writeEditorPersistedState(payload);
  }

  var historyQueryPersistKey = 'tap-case-library-history-query';

  function readHistoryQueryPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(historyQueryPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeHistoryQueryPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(historyQueryPersistKey);
        return;
      }
      localStorage.setItem(historyQueryPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

  function persistHistoryQueryState() {
    var userId = getCurrentUserId();
    var loginSeq = getCurrentLoginSeq();
    if (!userId && !loginSeq) return;
    var persisted = readHistoryQueryPersistedState();
    if (persisted) {
      var sameUser = userId && String(persisted.user_id || '') === String(userId);
      var sameLogin = loginSeq && String(persisted.login_seq || '') === String(loginSeq);
      if (!sameUser && !sameLogin) persisted = null;
    }
    var projectId = state.historyQueryDrawer ? state.historyQueryDrawer.projectId : null;
    var versionId = state.historyQueryDrawer ? state.historyQueryDrawer.versionId : null;
    var searchText = state.historyQueryDrawer ? String(state.historyQueryDrawer.searchText || '') : '';
    // 保护：避免“初始化空值”覆盖掉已有选择导致无法恢复。
    if (!projectId && persisted) {
      projectId = normalizeId(persisted.project_id);
      versionId = normalizeId(persisted.version_id);
      searchText = persisted.search_text ? String(persisted.search_text) : searchText;
    }
    if (!projectId) return;
    writeHistoryQueryPersistedState({
      user_id: userId || '',
      login_seq: loginSeq || '',
      project_id: projectId || '',
      version_id: (versionId || versionId === 0) ? versionId : '',
      search_text: searchText || '',
      saved_at: Date.now(),
    });
  }

  function restoreHistoryQueryDrawerFromPersistedState() {
    if (!isAuthReady()) return Promise.resolve(false);
    var persisted = readHistoryQueryPersistedState();
    if (!persisted) return Promise.resolve(false);
    var userId = getCurrentUserId();
    var loginSeq = getCurrentLoginSeq();
    var okByUser = userId && String(persisted.user_id || '') === String(userId);
    var okByLogin = loginSeq && String(persisted.login_seq || '') === String(loginSeq);
    if (!okByUser && !okByLogin) return Promise.resolve(false);
    var projectId = normalizeId(persisted.project_id);
    var versionId = normalizeId(persisted.version_id);
    // normalizeId 会把 "0" 解析成 0（期望），把 "" 解析成 null。
    if (!projectId) return Promise.resolve(false);
    var hasProject = (state.projects || []).some(function(p) { return p && String(p.id) === String(projectId); });
    if (!hasProject) return Promise.resolve(false);

    state.historyQueryDrawer.projectId = projectId;
    state.historyQueryDrawer.versionId = (versionId || versionId === 0) ? versionId : null;
    state.historyQueryDrawer.searchText = persisted.search_text ? String(persisted.search_text) : '';
    if (dom.historyDrawerProjectSelect) dom.historyDrawerProjectSelect.value = String(projectId);
    if (dom.historyDrawerSearchInput) dom.historyDrawerSearchInput.value = state.historyQueryDrawer.searchText || '';
    renderHistoryQueryDrawerList();

    if (!dom.historyDrawerVersionSelect) return Promise.resolve(true);
    dom.historyDrawerVersionSelect.disabled = true;
    dom.historyDrawerVersionSelect.innerHTML = '<option value=\"\">加载版本中...</option>';
    dom.historyDrawerVersionSelect.value = '';
    return loadVersions(projectId)
      .then(function() {
        if (!dom.historyDrawerVersionSelect) return true;
        dom.historyDrawerVersionSelect.disabled = false;
        syncVersionOptionsWithAll(dom.historyDrawerVersionSelect, projectId);
        var v = state.historyQueryDrawer.versionId;
        if (v || v === 0) dom.historyDrawerVersionSelect.value = String(v);
        else dom.historyDrawerVersionSelect.value = '';
        // 若此前已查询过，自动恢复列表（不加载“全量”，只加载已选择的项目/版本）。
        if (v || v === 0) {
          return loadHistoryQueryDrawerFiles().then(function() { return true; });
        }
        return true;
      })
      .catch(function() {
        return false;
      });
  }

  var historyDetailPersistKey = 'tap-case-library-history-detail';
  var caseLibraryLastViewPersistKey = 'tap-case-library-last-view';

  function readHistoryDetailPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(historyDetailPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeHistoryDetailPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(historyDetailPersistKey);
        return;
      }
      localStorage.setItem(historyDetailPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

  function clearHistoryDetailPersistedState() {
    writeHistoryDetailPersistedState(null);
  }

  function readCaseLibraryLastViewPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(caseLibraryLastViewPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeCaseLibraryLastViewPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(caseLibraryLastViewPersistKey);
        return;
      }
      localStorage.setItem(caseLibraryLastViewPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

  function persistCaseLibraryLastView(viewName) {
    var view = String(viewName || '').trim();
    if (view !== 'editor' && view !== 'history') return;
    var userId = getCurrentUserId();
    var loginSeq = getCurrentLoginSeq();
    if (!userId && !loginSeq) return;
    writeCaseLibraryLastViewPersistedState({
      user_id: userId || '',
      login_seq: loginSeq || '',
      view: view,
      saved_at: Date.now(),
    });
  }

  function persistHistoryDetailSelection() {
    var userId = getCurrentUserId();
    var loginSeq = getCurrentLoginSeq();
    if (!userId && !loginSeq) return;
    var pid = state.historyDetail && state.historyDetail.projectId ? String(state.historyDetail.projectId) : '';
    var name = state.historyDetail && state.historyDetail.fileNameClean ? String(state.historyDetail.fileNameClean) : '';
    if (!pid || !name) return;
    writeHistoryDetailPersistedState({
      user_id: userId || '',
      login_seq: loginSeq || '',
      project_id: pid,
      file_name_clean: name,
      version_id: (state.historyDetail.versionId || state.historyDetail.versionId === 0) ? state.historyDetail.versionId : '',
      filter: state.historyDetail && state.historyDetail.filter ? String(state.historyDetail.filter) : '',
      page_index: state.historyDetail && isFinite(Number(state.historyDetail.pageIndex)) ? Number(state.historyDetail.pageIndex) : 0,
      saved_at: Date.now(),
    });
  }

  var selectDrawerPersistKey = 'tap-case-library-select-drawer';

  function readSelectDrawerPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(selectDrawerPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeSelectDrawerPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(selectDrawerPersistKey);
        return;
      }
      localStorage.setItem(selectDrawerPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

  function persistSelectDrawerState(opts) {
    opts = opts || {};
    var userId = getCurrentUserId();
    if (!userId) return;
    var projectId = opts.projectId !== undefined ? normalizeId(opts.projectId) : normalizeId(state.selectDrawer && state.selectDrawer.projectId);
    var versionId = opts.versionId !== undefined ? normalizeId(opts.versionId) : normalizeId(state.selectDrawer && state.selectDrawer.versionId);
    writeSelectDrawerPersistedState({
      user_id: userId,
      project_id: projectId || '',
      version_id: versionId || '',
      saved_at: Date.now(),
    });
  }

  function restoreSelectDrawerFromPersistedState() {
    if (!isAuthReady()) return Promise.resolve(false);
    var persisted = readSelectDrawerPersistedState();
    if (!persisted) return Promise.resolve(false);
    var userId = getCurrentUserId();
    if (!userId || String(persisted.user_id || '') !== String(userId)) return Promise.resolve(false);

    var projectId = normalizeId(persisted.project_id);
    var versionId = normalizeId(persisted.version_id);
    if (!projectId) return Promise.resolve(false);

    var hasProject = (state.projects || []).some(function(p) { return p && String(p.id) === String(projectId); });
    if (!hasProject) return Promise.resolve(false);

    state.selectDrawer.projectId = projectId;
    state.selectDrawer.versionId = null;
    state.selectDrawer.files = [];
    state.selectDrawer.execByFileId = {};
    state.selectDrawer.processing = false;
    state.selectDrawer.selection = new Set();

    if (dom.selectProjectSelect) dom.selectProjectSelect.value = String(projectId);
    if (dom.selectVersionSelect) {
      dom.selectVersionSelect.disabled = true;
      dom.selectVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
      dom.selectVersionSelect.value = '';
    }

    state.selectDrawer.loading = true;
    state.selectDrawer.loadSeq = Number(state.selectDrawer.loadSeq || 0) + 1;
    var seq = state.selectDrawer.loadSeq;
    setStatus(dom.selectStatus, '加载用例库...', '');
    renderSelectDrawerList();

    return Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId), apiClient.listExecSetsByCaseFile(projectId)])
      .then(function(res) {
        if (seq !== state.selectDrawer.loadSeq) return false;
        var files = Array.isArray(res && res[0]) ? res[0] : [];
        var execSets = Array.isArray(res && res[2]) ? res[2] : [];
        state.selectDrawer.files = files;
        state.selectDrawer.execByFileId = buildExecMapByFileId(execSets);
        if (dom.selectVersionSelect) {
          syncVersionOptions(dom.selectVersionSelect, projectId, '请选择版本');
          dom.selectVersionSelect.disabled = false;
          if (versionId) {
            var ok = (state.versionsByProject[projectId] || []).some(function(v) { return v && String(v.id) === String(versionId); });
            if (ok) {
              dom.selectVersionSelect.value = String(versionId);
              state.selectDrawer.versionId = versionId;
            } else {
              dom.selectVersionSelect.value = '';
              state.selectDrawer.versionId = null;
            }
          } else {
            dom.selectVersionSelect.value = '';
            state.selectDrawer.versionId = null;
          }
        }
        setStatus(dom.selectStatus, '已加载 ' + files.length + ' 份用例文件', files.length ? 'ok' : 'warn');
        persistSelectDrawerState({ projectId: projectId, versionId: state.selectDrawer.versionId || '' });
        renderSelectDrawerList();
        return true;
      })
      .catch(function() {
        return false;
      })
      .finally(function() {
        if (seq !== state.selectDrawer.loadSeq) return;
        state.selectDrawer.loading = false;
        renderSelectDrawerList();
      });
  }

  var editDrawerPersistKey = 'tap-case-library-edit-drawer';

  function readEditDrawerPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(editDrawerPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeEditDrawerPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(editDrawerPersistKey);
        return;
      }
      localStorage.setItem(editDrawerPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

  function persistEditDrawerState(opts) {
    opts = opts || {};
    var userId = getCurrentUserId();
    if (!userId) return;
    var projectId = state.editDrawer && state.editDrawer.projectId ? state.editDrawer.projectId : null;
    var versionId = state.editDrawer && state.editDrawer.versionId ? state.editDrawer.versionId : null;
    var ownerFilter = normalizeEditDrawerOwnerFilter(state.editDrawer && state.editDrawer.ownerFilter ? state.editDrawer.ownerFilter : 'me');
    var selection = state.editDrawer && state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
    state.editDrawer.selection = selection;
    // 保护：避免“初始化/刷新期间 state 为空”时把已持久化的选择覆盖成空，导致无法恢复。
    if (!opts.force_clear && !projectId) {
      var existing = readEditDrawerPersistedState();
      if (existing && String(existing.user_id || '') === String(userId)) {
        var existingProjectId = normalizeId(existing.project_id);
        if (existingProjectId) projectId = existingProjectId;
        var existingVersionId = normalizeId(existing.version_id);
        if (!versionId && existingVersionId) versionId = existingVersionId;
        var existingOwnerFilter = normalizeEditDrawerOwnerFilter(existing.owner_filter || '');
        if (!ownerFilter && existingOwnerFilter) ownerFilter = existingOwnerFilter;
        if (!selection.size && Array.isArray(existing.selected_ids) && existing.selected_ids.length) {
          selection = new Set(existing.selected_ids.map(function(v) { return String(v); }));
          state.editDrawer.selection = selection;
        }
      }
    }
    var payload = {
      user_id: userId,
      project_id: projectId || '',
      version_id: versionId || '',
      owner_filter: ownerFilter,
      selected_ids: Array.from(selection),
      drawer_open: Boolean(opts.drawer_open),
      saved_at: Date.now(),
    };
    writeEditDrawerPersistedState(payload);
  }

  function restoreEditDrawerFromPersistedState() {
    if (!isAuthReady()) return Promise.resolve(false);
    if (state.editDrawer && state.editDrawer.restoring === true) return Promise.resolve(false);
    var persisted = readEditDrawerPersistedState();
    if (!persisted) return Promise.resolve(false);
    var userId = getCurrentUserId();
    if (!userId || String(persisted.user_id || '') !== String(userId)) return Promise.resolve(false);
    var projectId = normalizeId(persisted.project_id);
    var versionId = normalizeId(persisted.version_id);
    var ownerFilter = normalizeEditDrawerOwnerFilter(persisted.owner_filter || '');
    var ids = Array.isArray(persisted.selected_ids) ? persisted.selected_ids.map(function(v) { return String(v); }) : [];
    if (!projectId) return Promise.resolve(false);

    state.editDrawer = state.editDrawer || {};
    state.editDrawer.restoring = true;
    state.editDrawer.projectId = projectId;
    state.editDrawer.versionId = versionId || null;
    state.editDrawer.ownerFilter = ownerFilter;
    state.editDrawer.selection = new Set(ids);
    if (dom.editDrawerProjectSelect) dom.editDrawerProjectSelect.value = String(projectId);
    if (dom.editDrawerVersionSelect) {
      dom.editDrawerVersionSelect.disabled = true;
      dom.editDrawerVersionSelect.innerHTML = '<option value=\"\">全部版本</option>';
      dom.editDrawerVersionSelect.value = '';
    }
    syncEditDrawerOwnerFilterOptions();
    renderEditDrawerList();
    syncEditDrawerControls();

    return loadVersions(projectId)
      .then(function() {
        if (dom.editDrawerVersionSelect) {
          syncVersionOptions(dom.editDrawerVersionSelect, projectId, '全部版本');
          dom.editDrawerVersionSelect.disabled = false;
          if (versionId) dom.editDrawerVersionSelect.value = String(versionId);
          else dom.editDrawerVersionSelect.value = '';
        }
        var tasks = [apiClient.listCaseFiles(projectId)];
        if (apiClient && typeof apiClient.listExecSetsByCaseFile === 'function') {
          tasks.push(apiClient.listExecSetsByCaseFile(projectId));
        } else {
          tasks.push(Promise.resolve([]));
        }
        return Promise.all(tasks);
      })
      .then(function(res) {
        var files = Array.isArray(res && res[0]) ? res[0] : [];
        var execSets = Array.isArray(res && res[1]) ? res[1] : [];
        state.editDrawer.files = files;
        state.editDrawer.execByFileId = buildExecMapByFileId(execSets);
        // 仅保留当前可见列表里的勾选，避免版本切换后隐藏项仍被导出。
        var visibleIds = {};
        getEditDrawerVisibleFiles().forEach(function(f) {
          if (!f || f.id === null || f.id === undefined) return;
          visibleIds[String(f.id)] = true;
        });
        var nextSel = new Set();
        (state.editDrawer.selection || new Set()).forEach(function(id) {
          if (visibleIds[String(id)]) nextSel.add(String(id));
        });
        state.editDrawer.selection = nextSel;
        renderEditDrawerList();
        syncEditDrawerControls();
        return true;
      })
      .catch(function(err) {
        console.error(err);
        return false;
      })
      .finally(function() {
        state.editDrawer.restoring = false;
      });
  }

  function isAuthReady() {
    if (window.app && window.app.authReady === true) return true;
    var globalState = window.app && window.app.state ? window.app.state : null;
    return Boolean(globalState && globalState.currentUser);
  }

  function isAdminUser() {
    if (!window.app || window.app.authReady !== true) return false;
    var globalState = window.app && window.app.state ? window.app.state : null;
    var user = globalState && globalState.currentUser ? globalState.currentUser : null;
    return Boolean(user && user.role === 'admin');
  }

  function getTempExecApi() {
    return window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
  }

  function isExecDbEnabled() {
    if (!window.app || window.app.authReady !== true) return false;
    var globalState = window.app && window.app.state ? window.app.state : null;
    var user = globalState && globalState.currentUser ? globalState.currentUser : null;
    var userId = user && user.id !== undefined && user.id !== null ? user.id : null;
    if (!userId || String(userId) === '0') return false;
    return Boolean(
      apiClient &&
        typeof apiClient.listExecSets === 'function' &&
        typeof apiClient.listExecCases === 'function' &&
        typeof apiClient.upsertExecSetFromCaseFile === 'function' &&
        typeof apiClient.listCaseItems === 'function'
    );
  }

  function mapExecCaseToImportPayload(row) {
    if (!row) return null;
    return {
      module: row.module || '',
      title: row.title || '',
      expected: row.expected || '',
      priority: row.priority || null,
      precondition: row.precondition || null,
      steps: row.steps || null,
      remark: row.remark || null,
      status: row.status || null,
      reuse_details: row.reuse_details || null,
      defect_links: row.defect_links || null,
    };
  }

  function ensureDrawer(drawerId, openButtons, onOpen, onClose) {
    var openBtnIds = Array.isArray(openButtons) ? openButtons : [];
    var hasDrawerApi = Boolean(window.app && window.app.drawer && typeof window.app.drawer.createDrawer === 'function');
    if (hasDrawerApi) {
      return window.app.drawer.createDrawer({
        drawerId: drawerId,
        openButtons: openBtnIds,
        closeButtons: [],
        onOpen: typeof onOpen === 'function' ? onOpen : undefined,
        onClose: typeof onClose === 'function' ? onClose : undefined,
      });
    }

    // 兜底：极少数情况下静态资源加载抖动（例如 drawer.js 返回空响应）会导致抽屉 API 缺失；
    // 这里提供最小可用的 open/close，避免核心流程直接不可用。
    var drawer = drawerId ? document.getElementById(drawerId) : null;
    if (!drawer) return null;
    var panel = drawer.querySelector ? drawer.querySelector('.drawer-panel') : null;
    var mask = drawer.querySelector ? drawer.querySelector('.drawer-mask') : null;
    var bound = false;

    function open() {
      if (drawer.classList && drawer.classList.contains('closing')) drawer.classList.remove('closing');
      if (drawer.classList && !drawer.classList.contains('open')) drawer.classList.add('open');
      if (drawer.classList && drawer.classList.contains('hidden')) drawer.classList.remove('hidden');
      if (typeof onOpen === 'function') onOpen();
    }
    function close() {
      if (drawer.classList) drawer.classList.remove('open');
      if (typeof onClose === 'function') onClose();
    }
    function toggle() {
      if (drawer.classList && drawer.classList.contains('open')) close();
      else open();
    }
    function bindOnce() {
      if (bound) return;
      bound = true;
      openBtnIds.forEach(function(id) {
        var btn = document.getElementById(id);
        if (!btn || typeof btn.addEventListener !== 'function') return;
        btn.addEventListener('click', open);
      });
      if (mask && typeof mask.addEventListener === 'function') {
        mask.addEventListener('click', close);
      }
      if (panel && panel.querySelectorAll) {
        panel.querySelectorAll('[data-drawer-close]').forEach(function(node) {
          if (!node || typeof node.addEventListener !== 'function') return;
          node.addEventListener('click', close);
        });
      }
    }

    bindOnce();
    return { open: open, close: close, toggle: toggle, element: drawer };
  }

  function syncProjectOptions(selectEl, placeholder) {
    if (!selectEl) return;
    var list = Array.isArray(state.projects) ? state.projects : [];
    if (utils && typeof utils.sortProjectsByUserSettings === 'function') {
      list = utils.sortProjectsByUserSettings(list);
    }
    var options = ['<option value=\"\">' + escapeHtml(placeholder || '请选择项目') + '</option>'];
    state.projectNameById = {};
    list.forEach(function(p) {
      if (!p) return;
      state.projectNameById[p.id] = p.name || ('项目#' + p.id);
      options.push('<option value=\"' + escapeHtml(p.id) + '\">' + escapeHtml(state.projectNameById[p.id]) + '</option>');
    });
    selectEl.innerHTML = options.join('');
  }

  function syncVersionOptions(selectEl, projectId, placeholder) {
    if (!selectEl) return;
    var list = projectId && state.versionsByProject[projectId] ? state.versionsByProject[projectId] : [];
    var options = ['<option value=\"\">' + escapeHtml(placeholder || '请选择版本') + '</option>'];
    if (!state.versionNameByProject[projectId]) state.versionNameByProject[projectId] = {};
    (list || []).forEach(function(v) {
      if (!v) return;
      state.versionNameByProject[projectId][v.id] = v.name || ('版本#' + v.id);
      options.push('<option value=\"' + escapeHtml(v.id) + '\">' + escapeHtml(state.versionNameByProject[projectId][v.id]) + '</option>');
    });
    selectEl.innerHTML = options.join('');
  }

  function syncVersionOptionsWithAll(selectEl, projectId) {
    if (!selectEl) return;
    var list = projectId && state.versionsByProject[projectId] ? state.versionsByProject[projectId] : [];
    var options = ['<option value=\"\">请选择版本</option>', '<option value=\"0\">全部版本</option>'];
    if (!state.versionNameByProject[projectId]) state.versionNameByProject[projectId] = {};
    (list || []).forEach(function(v) {
      if (!v) return;
      state.versionNameByProject[projectId][v.id] = v.name || ('版本#' + v.id);
      options.push('<option value=\"' + escapeHtml(v.id) + '\">' + escapeHtml(state.versionNameByProject[projectId][v.id]) + '</option>');
    });
    selectEl.innerHTML = options.join('');
  }

  function getVersionName(projectId, versionId) {
    if (!versionId) return '--';
    var map = projectId && state.versionNameByProject[projectId] ? state.versionNameByProject[projectId] : null;
    if (map && map[versionId]) return map[versionId];
    return '版本#' + versionId;
  }

  function loadProjects() {
    return apiClient.listProjects().then(function(list) {
      var importSelected = dom.importProjectSelect ? String(dom.importProjectSelect.value || '') : '';
      var editSelected = dom.editDrawerProjectSelect ? String(dom.editDrawerProjectSelect.value || '') : '';
      var selectSelected = dom.selectProjectSelect ? String(dom.selectProjectSelect.value || '') : '';
      var historySelected = dom.historyDrawerProjectSelect ? String(dom.historyDrawerProjectSelect.value || '') : '';
      var projects = Array.isArray(list) ? list : [];
      if (utils && typeof utils.sortProjectsByUserSettings === 'function') {
        projects = utils.sortProjectsByUserSettings(projects);
      }
      state.projects = projects;
      syncProjectOptions(dom.importProjectSelect, '请选择项目');
      syncProjectOptions(dom.editDrawerProjectSelect, '请选择项目');
      syncProjectOptions(dom.selectProjectSelect, '请选择项目');
      syncProjectOptions(dom.historyDrawerProjectSelect, '请选择项目');
      // 仅刷新 option 列表，不强制清空用户已选项目；若新列表不含该值，浏览器会自动回到空值。
      if (dom.importProjectSelect && importSelected) dom.importProjectSelect.value = importSelected;
      if (dom.editDrawerProjectSelect && editSelected) dom.editDrawerProjectSelect.value = editSelected;
      if (dom.selectProjectSelect && selectSelected) dom.selectProjectSelect.value = selectSelected;
      if (dom.historyDrawerProjectSelect && historySelected) dom.historyDrawerProjectSelect.value = historySelected;
      return state.projects;
    });
  }

  function loadVersions(projectId) {
    if (!projectId) return Promise.resolve([]);
    if (state.versionsByProject[projectId]) return Promise.resolve(state.versionsByProject[projectId]);
    return apiClient.listProjectVersions(projectId).then(function(list) {
      state.versionsByProject[projectId] = Array.isArray(list) ? list : [];
      state.versionNameByProject[projectId] = {};
      (state.versionsByProject[projectId] || []).forEach(function(v) {
        if (!v) return;
        state.versionNameByProject[projectId][v.id] = v.name || ('版本#' + v.id);
      });
      return state.versionsByProject[projectId];
    });
  }

  function ensureProjectsReady() {
    if (state.projects && state.projects.length) return Promise.resolve(state.projects);
    setStatus(dom.status, '加载项目中...', '');
    return loadProjects()
      .then(function(list) {
        setStatus(dom.status, '', '');
        return list;
      })
      .catch(function(err) {
        setStatus(dom.status, err && err.message ? err.message : '加载项目失败', 'err');
        return [];
      });
  }

  function invalidateProjectsCache() {
    state.projects = [];
    state.projectNameById = {};
    state.versionsByProject = {};
    state.versionNameByProject = {};
  }

  function bindProjectsUpdated() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('app-projects-updated', function() {
      invalidateProjectsCache();
      var globalState = window.app && window.app.state ? window.app.state : {};
      var tabName = globalState && globalState.activeTab ? globalState.activeTab : '';
      if (tabName === 'case-library' && isAuthReady()) {
        ensureProjectsReady()
          .then(function() {
            return restoreCaseLibraryLastSelection();
          })
          .then(function(view) {
            var persisted = readEditDrawerPersistedState();
            var userId = getCurrentUserId();
            var shouldOpen = Boolean(persisted && userId && String(persisted.user_id || '') === String(userId) && persisted.drawer_open === true);
            if (view === 'editor' && shouldOpen && editDrawerInstance && typeof editDrawerInstance.open === 'function') {
              editDrawerInstance.open();
            }
          });
      }
    });
  }

  function normalizeId(value) {
    if (value === null || value === undefined) return null;
    if (value === '') return null;
    var n = Number(value);
    return isNaN(n) ? null : n;
  }

  function toLineText(val) {
    if (val === null || val === undefined) return '';
    if (Array.isArray(val)) return val.filter(Boolean).map(function(s) { return String(s); }).join('\n');
    return String(val);
  }

  function colLettersToIndex(letters) {
    var text = String(letters || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (!text) return -1;
    var sum = 0;
    for (var i = 0; i < text.length; i += 1) {
      var code = text.charCodeAt(i);
      if (code < 65 || code > 90) continue;
      sum = sum * 26 + (code - 64);
    }
    return sum - 1;
  }

  function parseXlsxSharedStrings(xmlText) {
    if (!xmlText) return [];
    var out = [];
    try {
      var parser = new DOMParser();
      var doc = parser.parseFromString(String(xmlText), 'application/xml');
      if (!doc || doc.getElementsByTagName('parsererror').length) return [];
      var sis = doc.getElementsByTagName('si');
      for (var i = 0; i < sis.length; i += 1) {
        var si = sis[i];
        if (!si) continue;
        // 兼容：Excel 可能用 <t> 或富文本 <r><t>。
        var ts = si.getElementsByTagName('t');
        if (!ts || !ts.length) {
          out.push('');
          continue;
        }
        var parts = [];
        for (var j = 0; j < ts.length; j += 1) {
          var t = ts[j];
          if (!t) continue;
          parts.push(t.textContent || '');
        }
        out.push(parts.join(''));
      }
    } catch (err) {
      return [];
    }
    return out;
  }

  function parseXlsxSheetToRows(xmlText, sharedStrings) {
    var rows = [];
    if (!xmlText) return rows;
    try {
      var parser = new DOMParser();
      var doc = parser.parseFromString(String(xmlText), 'application/xml');
      if (!doc || doc.getElementsByTagName('parsererror').length) return rows;
      var rowNodes = doc.getElementsByTagName('row');
      for (var i = 0; i < rowNodes.length; i += 1) {
        var row = rowNodes[i];
        if (!row) continue;
        var cells = row.getElementsByTagName('c');
        var map = {};
        var maxCol = -1;
        for (var j = 0; j < cells.length; j += 1) {
          var cell = cells[j];
          if (!cell) continue;
          var ref = cell.getAttribute('r') || '';
          var m = String(ref).match(/^([A-Za-z]+)/);
          if (!m) continue;
          var colIdx = colLettersToIndex(m[1]);
          if (colIdx < 0) continue;
          if (colIdx > maxCol) maxCol = colIdx;
          var t = (cell.getAttribute('t') || '').toLowerCase();
          var value = '';
          if (t === 'inlinestr') {
            var ts = cell.getElementsByTagName('t');
            var parts = [];
            for (var k = 0; k < ts.length; k += 1) {
              parts.push(ts[k] && ts[k].textContent ? ts[k].textContent : '');
            }
            value = parts.join('');
          } else if (t === 's') {
            var vNode = cell.getElementsByTagName('v')[0];
            var idx = vNode && vNode.textContent ? Number(String(vNode.textContent).trim()) : NaN;
            if (!isNaN(idx) && sharedStrings && sharedStrings.length && sharedStrings[idx] !== undefined) {
              value = sharedStrings[idx];
            } else {
              value = '';
            }
          } else {
            // number / general / 其它：优先 <v>，兜底 <t>
            var v = cell.getElementsByTagName('v')[0];
            if (v && v.textContent !== undefined && v.textContent !== null) value = v.textContent;
            else {
              var t2 = cell.getElementsByTagName('t')[0];
              value = t2 && t2.textContent ? t2.textContent : '';
            }
          }
          map[String(colIdx)] = value;
        }
        if (maxCol < 0) continue;
        var rowArr = [];
        for (var c = 0; c <= maxCol; c += 1) {
          rowArr[c] = map[String(c)] !== undefined ? map[String(c)] : '';
        }
        rows.push(rowArr);
      }
    } catch (err) {
      return rows;
    }
    return rows;
  }

  function parseXlsxFileToCaseRows(file) {
    var JSZipCtor = typeof JSZip !== 'undefined' ? JSZip : (window.JSZip ? window.JSZip : null);
    if (!JSZipCtor) return Promise.reject(new Error('缺少 JSZip 依赖，无法解析 Excel'));
    if (!file || typeof file.arrayBuffer !== 'function') return Promise.reject(new Error('Excel 文件不可用'));
    var zip = new JSZipCtor();
    return file.arrayBuffer().then(function(buf) {
      return zip.loadAsync(buf);
    }).then(function(z) {
      var shared = null;
      var sharedEntry = z.file('xl/sharedStrings.xml');
      var sharedPromise = sharedEntry ? sharedEntry.async('string').then(function(txt) {
        shared = parseXlsxSharedStrings(txt);
      }).catch(function() { shared = []; }) : Promise.resolve();

      return sharedPromise.then(function() {
        var sheetEntry = z.file('xl/worksheets/sheet1.xml');
        if (!sheetEntry) {
          var candidates = [];
          try {
            z.forEach(function(relPath) {
              if (!relPath) return;
              if (String(relPath).indexOf('xl/worksheets/') !== 0) return;
              if (String(relPath).slice(-4).toLowerCase() !== '.xml') return;
              candidates.push(String(relPath));
            });
          } catch (err) {
            candidates = [];
          }
          if (candidates.length) sheetEntry = z.file(candidates[0]);
        }
        if (!sheetEntry) throw new Error('Excel 解析失败：缺少工作表');
        return sheetEntry.async('string').then(function(sheetXml) {
          return parseXlsxSheetToRows(sheetXml, shared || []);
        });
      });
    });
  }

  function buildImportItemsFromXlsxRows(rows) {
    var list = Array.isArray(rows) ? rows : [];
    if (!list.length) return [];
    var headerRow = list[0] || [];
    var headerIndex = {};
    var headerMap = {
      '模块': 'module',
      '用例标题': 'title',
      '优先级': 'priority',
      '前提条件': 'preconditions',
      '操作步骤': 'steps',
      '预期结果': 'expected',
    };
    for (var i = 0; i < headerRow.length; i += 1) {
      var text = headerRow[i] !== undefined && headerRow[i] !== null ? String(headerRow[i]).trim() : '';
      if (!text) continue;
      if (headerMap[text]) headerIndex[headerMap[text]] = i;
    }
    var required = ['module', 'title', 'expected'];
    var hasHeader = Boolean(
      headerIndex.module !== undefined &&
      headerIndex.title !== undefined &&
      headerIndex.expected !== undefined
    );

    function pick(row, key, fallbackIndex) {
      if (!row) return '';
      var idx = hasHeader && headerIndex[key] !== undefined ? headerIndex[key] : fallbackIndex;
      var val = row[idx];
      return val === undefined || val === null ? '' : String(val);
    }

    var out = [];
    for (var r = 1; r < list.length; r += 1) {
      var row = list[r] || [];
      var module = pick(row, 'module', 0);
      var title = pick(row, 'title', 1);
      var priority = pick(row, 'priority', 2);
      var preconditions = pick(row, 'preconditions', 3);
      var steps = pick(row, 'steps', 4);
      var expected = pick(row, 'expected', 5);
      // 跳过空行
      var any = String(module || '') + String(title || '') + String(priority || '') + String(preconditions || '') + String(steps || '') + String(expected || '');
      if (!any.trim()) continue;
      out.push({
        module: module,
        title: title,
        priority: priority,
        preconditions: preconditions,
        steps: steps,
        expected: expected,
        _sourceLine: r + 1,
      });
    }
    return buildImportItems(out);
  }

  function deriveCaseListFromText(text) {
    var coreApi = getCore();
    if (coreApi && typeof coreApi.deriveCaseListFromText === 'function') {
      return coreApi.deriveCaseListFromText(text || '');
    }
    try {
      var parsed = JSON.parse((text || '').trim() || '[]');
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.cases)) return parsed.cases;
    } catch (err) {
      // ignore
    }
    return [];
  }

		  function buildImportItems(list) {
	    if (!Array.isArray(list)) return [];

	    function normalizeDashAsEmpty(text) {
	      var t = text === null || text === undefined ? '' : String(text);
	      t = t.trim();
	      return t === '-' ? '' : t;
	    }

	    return list
	      .map(function(item, idx) {
	        if (!item || typeof item !== 'object') return null;
	        var module = normalizeDashAsEmpty(item.module || item.module_name || item['模块'] || '');
	        var title = normalizeDashAsEmpty(item.title || item.case_title || item['用例标题'] || '');
	        var expected = normalizeDashAsEmpty(item.expected || item.result || item['预期结果'] || '');
	        var priority = normalizeDashAsEmpty(item.priority || item.level || item['优先级'] || '');
	        var precondition = normalizeDashAsEmpty(item.preconditions || item.precondition || item['前提条件'] || '');
	        var steps = normalizeDashAsEmpty(toLineText(item.steps || item.actions || item['操作步骤'] || ''));
	        var remark = normalizeDashAsEmpty(item.remark || '');
	        var any = String(module || '') + String(title || '') + String(priority || '') + String(precondition || '') + String(steps || '') + String(expected || '') + String(remark || '');
	        if (!any.trim()) return null;
          var sourceLine = item._sourceLine;
          if (!isFinite(Number(sourceLine)) || Number(sourceLine) <= 0) sourceLine = idx + 1;
	        return {
	          module: module,
	          title: title,
	          expected: expected,
	          priority: priority || '',
	          precondition: precondition || '',
	          steps: steps || '',
	          remark: remark || null,
	          _sourceLine: sourceLine,
	        };
	      })
		      .filter(Boolean);
		  }

	  function normalizePriorityInput(value) {
	    var text = value === null || value === undefined ? '' : String(value);
	    text = text.trim();
	    if (!text) return '';
	    var head = text.charAt(0);
	    if (head === 'p' || head === 'P') return 'P' + text.slice(1);
	    return text;
	  }

	  function sanitizeImportItemsForApi(items) {
	    var list = Array.isArray(items) ? items : [];
	    return list
	      .map(function(it) {
	        if (!it) return null;
	        return {
	          module: String(it.module || '').trim(),
	          title: String(it.title || '').trim(),
	          expected: String(it.expected || '').trim(),
	          priority: it.priority === null || it.priority === undefined ? null : String(it.priority || '').trim(),
	          precondition: it.precondition === null || it.precondition === undefined ? null : String(it.precondition || '').trim(),
	          steps: it.steps === null || it.steps === undefined ? null : String(it.steps || '').trim(),
	          remark: it.remark === null || it.remark === undefined ? null : String(it.remark || '').trim(),
	        };
	      })
	      .filter(Boolean);
	  }

	  function validateImportItems(items) {
	    var list = Array.isArray(items) ? items : [];
	    var invalid = [];
	    list.forEach(function(it, idx) {
	      if (!it) return;
	      it.module = String(it.module === null || it.module === undefined ? '' : it.module).trim();
	      it.title = String(it.title === null || it.title === undefined ? '' : it.title).trim();
	      it.expected = String(it.expected === null || it.expected === undefined ? '' : it.expected).trim();
	      it.priority = normalizePriorityInput(it.priority);
	      it.precondition = String(it.precondition === null || it.precondition === undefined ? '' : it.precondition).trim();
	      it.steps = String(it.steps === null || it.steps === undefined ? '' : it.steps).trim();

	      var err = {
	        module: !it.module,
	        title: !it.title,
	        priority: !it.priority,
	        precondition: !it.precondition,
	        steps: !it.steps,
	        expected: !it.expected,
	      };
	      if (err.module || err.title || err.priority || err.precondition || err.steps || err.expected) {
	        var lineNo = it && it._sourceLine ? Number(it._sourceLine) : (idx + 1);
	        if (!isFinite(lineNo) || lineNo <= 0) lineNo = idx + 1;
	        invalid.push({ index: idx, line: lineNo, err: err });
	      }
	    });
	    return invalid;
	  }

	  function normalizeXmindPathSegments(pathArr, rootTitle) {
	    if (!Array.isArray(pathArr)) return [];
	    // 保留空字符串：XMind 中“节点存在但标题为空”应作为字段内容为空处理，不应被当作层级缺失。
	    var clean = pathArr
	      .filter(function(s) { return s !== null && s !== undefined; })
	      .map(function(s) { return String(s).trim(); });
	    if (!clean.length) return [];
	    var rt = rootTitle === null || rootTitle === undefined ? '' : String(rootTitle).trim();
	    if (rt && clean[0] === rt) clean = clean.slice(1);
	    return clean;
	  }

	  function buildImportItemsFromXmindPaths(paths, rootTitle) {
	    var list = Array.isArray(paths) ? paths : [];
	    var structuralErrors = [];
	    var raw = [];

	    list.forEach(function(pathArr, idx) {
	      var segs = normalizeXmindPathSegments(pathArr, rootTitle);
	      if (segs.length < 6) {
	        structuralErrors.push({ line: idx + 1, depth: segs.length });
	        return;
	      }
	      var tail = segs.slice(-6);
	      raw.push({
	        module: tail[0] || '',
	        title: tail[1] || '',
	        priority: tail[2] || '',
	        precondition: tail[3] || '',
	        steps: tail[4] || '',
	        expected: tail[5] || '',
	        _sourceLine: idx + 1,
	      });
	    });

	    return { items: buildImportItems(raw), structuralErrors: structuralErrors };
	  }

  function parseImportFile(file) {
    if (!file) return Promise.resolve({ items: [] });
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    var coreApi = getCore();
    if (ext === 'xmind' && coreApi && typeof coreApi.parseXmindFile === 'function') {
      return coreApi.parseXmindFile(file).then(function(res) {
        var paths = res && Array.isArray(res.paths) ? res.paths : [];
        var rootTitle = res && res.rootTitle ? String(res.rootTitle) : '';
        var mapped = buildImportItemsFromXmindPaths(paths, rootTitle);
        return { items: mapped.items, structuralErrors: mapped.structuralErrors };
      });
    }
    if (ext === 'xlsx') {
      return parseXlsxFileToCaseRows(file).then(function(rows) {
        return { items: buildImportItemsFromXlsxRows(rows || []) };
      });
    }
    return file.text().then(function(text) {
      var trimmed = (text || '').trim();
      var list = [];
      if (ext === 'json') {
        try {
          var parsed = JSON.parse(trimmed || '[]');
          if (Array.isArray(parsed)) list = parsed;
          else if (parsed && Array.isArray(parsed.cases)) list = parsed.cases;
          else list = deriveCaseListFromText(trimmed);
        } catch (err) {
          list = deriveCaseListFromText(trimmed);
        }
      } else {
        list = deriveCaseListFromText(trimmed);
      }
      return { items: buildImportItems(list) };
    });
  }

  function syncImportConfirmEnabled() {
    if (!dom.importConfirmBtn) return;
    var s = state.importDrawer;
    dom.importConfirmBtn.disabled = !(s.files && s.files.length && s.projectId && s.versionId) || s.loading;
  }

  function renderImportFileHint() {
    if (!dom.importFileHint) return;
    var files = state.importDrawer.files || [];
    if (!files.length) {
      dom.importFileHint.textContent = '未选择文件';
      return;
    }
    var names = files.map(function(f) { return f && f.name ? f.name : '文件'; });
    var head = names.slice(0, 2).join('、');
    dom.importFileHint.textContent = names.length > 2 ? ('已选择 ' + names.length + ' 个：' + head + '...') : ('已选择：' + head);
  }

  function resetImportDrawer() {
    state.importDrawer.files = [];
    state.importDrawer.projectId = null;
    state.importDrawer.versionId = null;
    state.importDrawer.loading = false;
    renderImportFileHint();
    setStatus(dom.importStatus, '', '');
    syncProjectOptions(dom.importProjectSelect, '请选择项目');
    if (dom.importProjectSelect) dom.importProjectSelect.value = '';
    if (dom.importVersionSelect) {
      dom.importVersionSelect.disabled = true;
      dom.importVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
      dom.importVersionSelect.value = '';
    }
    syncImportConfirmEnabled();
    return restoreImportDrawerFromPersistedState();
  }

  var importDuplicateDrawerInstance = null;
  var importDuplicateResolve = null;
  var importDuplicateResolved = false;
  var importDuplicateConfirmBound = false;

  function renderImportDuplicateDrawer(payload) {
    var titleEl = dom.importDuplicateTitle;
    var statusEl = dom.importDuplicateStatus;
    var bodyEl = dom.importDuplicateBody;
    var confirmBtn = dom.importDuplicateConfirmBtn;

    var fileName = payload && payload.fileName ? String(payload.fileName) : '用例';
    var total = payload && Number.isFinite(Number(payload.total)) ? Number(payload.total) : 0;
    var uniqueCount = payload && Number.isFinite(Number(payload.uniqueCount)) ? Number(payload.uniqueCount) : 0;
    var duplicateCount = payload && Number.isFinite(Number(payload.duplicateCount)) ? Number(payload.duplicateCount) : 0;
    var rows = payload && Array.isArray(payload.rows) ? payload.rows : [];

    if (titleEl) titleEl.textContent = '导入用例重复校验：' + cleanCaseFileName(fileName);
    if (statusEl) {
      setStatus(statusEl, '检测到重复条目 ' + duplicateCount + ' 条（模块/用例描述/前提条件/操作步骤/预期结果均相同），将自动去重：原 ' + total + ' 条 → 去重后 ' + uniqueCount + ' 条。', 'warn');
    }
    if (confirmBtn) confirmBtn.disabled = !duplicateCount;

    if (!bodyEl) return;
    if (!rows.length) {
      bodyEl.innerHTML = '<tr><td colspan="9"><p class="hint">暂无重复条目</p></td></tr>';
      return;
    }
    bodyEl.innerHTML = rows.map(function(entry) {
      var item = entry && entry.item ? entry.item : null;
      var line = entry && Number.isFinite(Number(entry.line)) ? Number(entry.line) : 0;
      var keep = entry && entry.keep ? true : false;
      var action = keep ? '保留' : '移除';

      function toHtml(val) {
        var text = val === null || val === undefined ? '' : String(val);
        return escapeHtml(text).replace(/\n/g, '<br>');
      }

      return (
        '<tr>' +
          '<td>' + (line ? String(line) : '-') + '</td>' +
          '<td>' + toHtml(item && item.module ? item.module : '') + '</td>' +
          '<td>' + toHtml(item && item.title ? item.title : '') + '</td>' +
          '<td>' + toHtml(item && item.priority ? item.priority : '') + '</td>' +
          '<td>' + toHtml(item && item.precondition ? item.precondition : '') + '</td>' +
          '<td>' + toHtml(item && item.steps ? item.steps : '') + '</td>' +
          '<td>' + toHtml(item && item.expected ? item.expected : '') + '</td>' +
          '<td>' + toHtml(item && item.remark ? item.remark : '') + '</td>' +
          '<td>' + escapeHtml(action) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function ensureImportDuplicateDrawer() {
    if (importDuplicateDrawerInstance) return importDuplicateDrawerInstance;
    importDuplicateDrawerInstance = ensureDrawer('caseLibraryImportDuplicateDrawer', [], null, function() {
      if (importDuplicateResolved) return;
      if (typeof importDuplicateResolve === 'function') {
        importDuplicateResolved = true;
        try { importDuplicateResolve(false); } catch (e) {}
        importDuplicateResolve = null;
      }
    });
    if (!importDuplicateConfirmBound) {
      importDuplicateConfirmBound = true;
      if (dom.importDuplicateConfirmBtn) {
        dom.importDuplicateConfirmBtn.addEventListener('click', function() {
          if (importDuplicateResolved) return;
          if (typeof importDuplicateResolve !== 'function') return;
          importDuplicateResolved = true;
          var resolve = importDuplicateResolve;
          importDuplicateResolve = null;
          try { resolve(true); } catch (e) {}
          if (importDuplicateDrawerInstance && typeof importDuplicateDrawerInstance.close === 'function') {
            importDuplicateDrawerInstance.close();
          }
        });
      }
    }
    return importDuplicateDrawerInstance;
  }

  function confirmImportDuplicatesByDrawer(payload) {
    var drawer = ensureImportDuplicateDrawer();
    if (!drawer) return Promise.resolve(false);
    importDuplicateResolved = false;
    renderImportDuplicateDrawer(payload);
    if (typeof drawer.open === 'function') drawer.open();
    return new Promise(function(resolve) {
      importDuplicateResolve = resolve;
    });
  }

  function buildDuplicateGroupsForImport(items) {
    var list = Array.isArray(items) ? items : [];
    var seen = {};
    var groups = {};
    var unique = [];

    list.forEach(function(it, idx) {
      if (!it) return;
      var key = buildCaseItemKey(it);
      if (!key) return;
      if (!groups[key]) groups[key] = [];
      var line = it && Number.isFinite(Number(it._sourceLine)) ? Number(it._sourceLine) : (idx + 1);
      groups[key].push({ line: line, item: it });

      if (seen[key]) return;
      seen[key] = true;
      unique.push(it);
    });

    var rows = [];
    Object.keys(groups).forEach(function(k) {
      var arr = groups[k];
      if (!arr || arr.length <= 1) return;
      arr.forEach(function(entry, idx) {
        rows.push({
          line: entry && entry.line ? entry.line : 0,
          item: entry && entry.item ? entry.item : null,
          keep: idx === 0,
        });
      });
    });
    rows.sort(function(a, b) {
      var la = a && a.line ? Number(a.line) : 0;
      var lb = b && b.line ? Number(b.line) : 0;
      return la - lb;
    });
    var duplicateCount = list.length - unique.length;
    return { uniqueItems: unique, duplicateCount: duplicateCount, rows: rows };
  }

  function handleImportFiles(files) {
    state.importDrawer.files = Array.from(files || []).filter(Boolean);
    renderImportFileHint();
    syncImportConfirmEnabled();
    setStatus(dom.importStatus, state.importDrawer.files.length ? '已选择文件，请继续选择项目与版本' : '未选择文件', state.importDrawer.files.length ? '' : 'warn');
  }

  function handleImportProjectChange() {
    var projectId = normalizeId(dom.importProjectSelect ? dom.importProjectSelect.value : '');
    state.importDrawer.projectId = projectId;
    state.importDrawer.versionId = null;
    if (projectId) persistImportDrawerState(projectId, null);
    syncImportConfirmEnabled();
    if (!dom.importVersionSelect) return;
    dom.importVersionSelect.disabled = true;
    dom.importVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
    if (!projectId) return;
    setStatus(dom.importStatus, '加载版本中...', '');
    loadVersions(projectId)
      .then(function() {
        syncVersionOptions(dom.importVersionSelect, projectId, '请选择版本');
        dom.importVersionSelect.disabled = false;
        setStatus(dom.importStatus, '', '');
      })
      .catch(function(err) {
        setStatus(dom.importStatus, err && err.message ? err.message : '加载版本失败', 'err');
      });
  }

  function handleImportVersionChange() {
    state.importDrawer.versionId = normalizeId(dom.importVersionSelect ? dom.importVersionSelect.value : '');
    if (state.importDrawer.projectId && state.importDrawer.versionId) {
      persistImportDrawerState(state.importDrawer.projectId, state.importDrawer.versionId);
    }
    syncImportConfirmEnabled();
  }

  function confirmImportToDb() {
    var s = state.importDrawer;
    if (!s.files.length) {
      setStatus(dom.importStatus, '请先选择用例文件', 'warn');
      return;
    }
    if (!s.projectId) {
      setStatus(dom.importStatus, '请先选择项目', 'warn');
      return;
    }
    if (!s.versionId) {
      setStatus(dom.importStatus, '请先选择版本', 'warn');
      return;
    }

    function buildNameList(names, maxCount) {
      var list = Array.isArray(names) ? names.filter(Boolean) : [];
      var max = Number.isFinite(Number(maxCount)) ? Number(maxCount) : 8;
      if (!list.length) return '';
      var head = list.slice(0, max).join('、');
      return list.length > max ? (head + '...（共 ' + list.length + ' 份）') : head;
    }

    function pushSkip(skipped, name, reason) {
      skipped.push({ name: name || '用例', reason: reason || '已跳过' });
    }

    function pushFail(failed, name, reason) {
      failed.push({ name: name || '用例', reason: reason || '失败' });
    }

    function getSameNameMatchedCleanName(fileName, errPayload) {
      var importedCleanName = cleanCaseFileName(fileName || '');
      var matchedCleanName = errPayload && errPayload.existing_file_name_clean ? String(errPayload.existing_file_name_clean) : '';
      return matchedCleanName || importedCleanName || (fileName ? String(fileName) : '用例');
    }

    function enqueueSameNameDiffTask(queue, file, items, err) {
      var fileName = file && file.name ? file.name : '';
      var errPayload = err && err.payload ? err.payload : null;
      var cleanName = getSameNameMatchedCleanName(fileName, errPayload);
      queue.push({
        projectId: s.projectId,
        versionId: s.versionId,
        fileName: fileName,
        importItems: items,
        source: (file && file.type) ? file.type : (extFromFileName(fileName) || ''),
        error: err,
        cleanName: cleanName,
      });
      return cleanName;
    }

    function openImportDiffForQueueTask(task) {
      if (!task) return Promise.resolve({ ok: false, reason: 'invalid_task' });
      var projectId = task.projectId;
      var versionId = task.versionId;
      var fileName = task.fileName || '';
      var items = Array.isArray(task.importItems) ? task.importItems : [];
      var err = task.error || null;
      var errPayload = err && err.payload ? err.payload : null;
      var importedCleanName = cleanCaseFileName(fileName);
      var cleanName = task.cleanName || importedCleanName || '用例';
      var source = task.source || extFromFileName(fileName) || 'external';
      var existingCaseFileId = errPayload && errPayload.existing_case_file_id ? errPayload.existing_case_file_id : null;
      var dbVersionId = errPayload && (errPayload.existing_version_id || errPayload.existing_version_id === 0)
        ? errPayload.existing_version_id
        : null;

      // 优先走“带 existing_case_file_id”的通道（由后端返回），否则回退到拉列表按 cleanName 匹配。
      if (existingCaseFileId) {
        return openImportDiffForExternal({
          projectId: projectId,
          versionId: versionId,
          fileName: fileName,
          items: items,
          error: err,
          source: source,
        });
      }

      if (!projectId || !versionId || !fileName || !items.length) {
        return Promise.resolve({ ok: false, reason: 'invalid_params' });
      }

      openImportDiffDrawerLoading({
        fileName: fileName,
        cleanName: cleanName,
        importedCleanName: importedCleanName,
        projectId: projectId,
        importVersionId: versionId,
        source: source,
      });

      return new Promise(function(resolve) {
        state.importDiff.external = { resolve: resolve };
        Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId)])
          .then(function(res) {
            var files = Array.isArray(res && res[0]) ? res[0] : [];
            var list = Array.isArray(files) ? files : [];
            var existing = list.find(function(cf) {
              return cf && String(cf.file_name_clean || '') === String(cleanName || '');
            });
            if (!existing) throw new Error('未找到库中同名用例：' + cleanName);
            return apiClient.listCaseItems(existing.id).then(function(dbItems) {
              openImportDiffDrawer({
                fileName: fileName,
                cleanName: cleanName,
                importedCleanName: importedCleanName,
                projectId: projectId,
                importVersionId: versionId,
                dbVersionId: dbVersionId || existing.version_id || null,
                importItems: items,
                dbItems: dbItems || [],
                source: source,
              });
            });
          })
          .catch(function(loadErr) {
            setStatus(dom.importDiffStatus, '加载差异对比失败：' + (loadErr && loadErr.message ? loadErr.message : '未知错误'), 'err');
            var external = state.importDiff.external || null;
            if (external && typeof external.resolve === 'function') {
              state.importDiff.external = null;
              try {
                external.resolve({ ok: false, reason: 'load_failed', error: loadErr || null });
              } catch (e) {
                // ignore
              }
            }
          });
      });
    }

    function buildFinalImportMessage(imported, overwritten, skipped, failed) {
      var importedNames = imported.slice();
      var overwrittenNames = overwritten.slice();
      var skippedItems = Array.isArray(skipped) ? skipped : [];
      var failedItems = Array.isArray(failed) ? failed : [];
      var skippedNames = skippedItems.map(function(it) { return it && it.name ? it.name : '用例'; });
      var totalOk = importedNames.length + overwrittenNames.length;
      var totalSkip = skippedNames.length;
      var totalFail = failedItems.length;

      var lines = [];
      lines.push('导入完成：成功 ' + totalOk + ' 份，跳过 ' + totalSkip + ' 份，失败 ' + totalFail + ' 份');
      if (importedNames.length) lines.push('入库成功：' + buildNameList(importedNames, 10));
      if (overwrittenNames.length) lines.push('覆盖导入成功：' + buildNameList(overwrittenNames, 10));
      if (skippedItems.length) {
        skippedItems.slice(0, 6).forEach(function(it) {
          if (!it) return;
          lines.push('跳过 - ' + (it.name || '用例') + '：' + (it.reason || '已跳过'));
        });
        if (skippedItems.length > 6) lines.push('跳过 - 还有 ' + (skippedItems.length - 6) + ' 份未展开');
      }
      if (failedItems.length) {
        failedItems.slice(0, 6).forEach(function(it) {
          if (!it) return;
          lines.push('失败 - ' + (it.name || '用例') + '：' + (it.reason || '失败'));
        });
        if (failedItems.length > 6) lines.push('失败 - 还有 ' + (failedItems.length - 6) + ' 份未展开');
      }
      return lines.join('\n');
    }

    s.loading = true;
    syncImportConfirmEnabled();
    setStatus(dom.importStatus, '解析并导入中...', '');

    var importedNames = [];
    var overwrittenNames = [];
    var skippedItems = [];
    var failedItems = [];
    var diffQueue = [];
    var invalidOpened = false;
    var chain = Promise.resolve();

    s.files.forEach(function(file) {
      chain = chain.then(function() {
        if (invalidOpened) return;
        return parseImportFile(file)
          .then(function(parsed) {
            if (invalidOpened) return;
            var structural = parsed && Array.isArray(parsed.structuralErrors) ? parsed.structuralErrors : [];
            var items = parsed && parsed.items ? parsed.items : [];
            var cleanName = cleanCaseFileName(file && file.name ? file.name : '');
            if (!items.length) {
              var emptyMsg = '未解析到有效用例';
              pushSkip(skippedItems, cleanName || (file && file.name ? file.name : '文件'), emptyMsg);
              setStatus(dom.importStatus, '【' + (file && file.name ? file.name : '文件') + '】' + emptyMsg + '，已跳过', 'warn');
              return;
            }
            var invalid = validateImportItems(items);
            if (structural.length || invalid.length) {
              invalidOpened = true;
              openImportInvalidDrawer({
                file: file,
                fileName: file.name,
                cleanName: cleanCaseFileName(file.name),
                projectId: s.projectId,
                versionId: s.versionId,
                source: file.type || extFromFileName(file.name),
                items: items,
                structuralErrors: structural,
              });
              if (structural.length) {
                var hint = '导入发现字段层级不足 ' + structural.length + ' 条（将跳过）；可继续入库其余 ' + items.length + ' 条，或回到 XMind 补齐后重导入';
                setStatus(dom.importStatus, hint, 'warn');
                setStatus(dom.status, hint, 'warn');
              } else {
                setStatus(dom.importStatus, '导入校验失败：请在“格式校验”抽屉补齐必填字段后再确认入库', 'warn');
                setStatus(dom.status, '导入校验失败：请补齐必填字段后再确认入库', 'warn');
              }
              return;
            }

            function doImport(validItems) {
              return apiClient.importCaseFile({
                project_id: s.projectId,
                version_id: s.versionId,
                file_name: file.name,
                source: file.type || extFromFileName(file.name),
                items: sanitizeImportItemsForApi(validItems),
              }).then(function() {
                importedNames.push(cleanName || (file && file.name ? file.name : '用例'));
              }).catch(function(err) {
                var msg = err && err.message ? err.message : '导入失败';
                if (msg.indexOf('同名') !== -1) {
                  var matchedName = enqueueSameNameDiffTask(diffQueue, file, validItems, err);
                  setStatus(dom.importStatus, msg + '：' + matchedName + '（已加入差异对比队列）', 'warn');
                  return;
                }
                pushFail(failedItems, cleanName || (file && file.name ? file.name : '用例'), msg);
                setStatus(dom.importStatus, msg, 'err');
              });
            }

            var dup = buildDuplicateGroupsForImport(items);
            if (dup.duplicateCount > 0) {
              return confirmImportDuplicatesByDrawer({
                fileName: file.name,
                total: items.length,
                uniqueCount: dup.uniqueItems.length,
                duplicateCount: dup.duplicateCount,
                rows: dup.rows,
              }).then(function(ok) {
                if (!ok) {
                  pushSkip(skippedItems, cleanName || (file && file.name ? file.name : '用例'), '已取消导入（包含重复条目）');
                  setStatus(dom.importStatus, '已取消导入（包含重复条目）：' + (file && file.name ? file.name : '文件'), 'warn');
                  return;
                }
                return doImport(dup.uniqueItems);
              });
            }
            return doImport(items);
          })
          .catch(function(err) {
            if (invalidOpened) return;
            var msg = err && err.message ? err.message : '解析失败';
            var cleanName = cleanCaseFileName(file && file.name ? file.name : '');
            pushFail(failedItems, cleanName || (file && file.name ? file.name : '用例'), msg);
            setStatus(dom.importStatus, msg, 'err');
          });
      });
    });

    chain
      .then(function() {
        if (invalidOpened) return;
        if (!diffQueue.length) return;
        setStatus(dom.importStatus, '检测到同名用例冲突 ' + diffQueue.length + ' 份，请依次确认覆盖导入或关闭跳过', 'warn');
        state.importDiff.queue = { active: true, total: diffQueue.length, index: -1 };
        var diffChain = Promise.resolve();
        diffQueue.forEach(function(task, idx) {
          diffChain = diffChain.then(function() {
            if (!task) return;
            if (invalidOpened) return;
            if (state.importDiff.queue && state.importDiff.queue.active) state.importDiff.queue.index = idx;
            var tip = '同名用例已存在，处理差异对比（' + (idx + 1) + '/' + diffQueue.length + '）：' + (task.cleanName || '用例');
            setStatus(dom.importStatus, tip, 'warn');
            return openImportDiffForQueueTask(task).then(function(res) {
              if (res && res.ok) {
                overwrittenNames.push(task.cleanName || cleanCaseFileName(task.fileName));
                return;
              }
              if (res && res.reason === 'closed') {
                pushSkip(skippedItems, task.cleanName || cleanCaseFileName(task.fileName), '同名冲突已跳过');
                return;
              }
              var reason = res && res.reason ? String(res.reason) : '同名冲突处理失败';
              pushFail(failedItems, task.cleanName || cleanCaseFileName(task.fileName), reason);
            });
          });
        });
        return diffChain.finally(function() {
          if (state.importDiff.queue && state.importDiff.queue.active) {
            state.importDiff.queue.active = false;
            state.importDiff.queue.index = -1;
          }
        });
      })
      .then(function() {
        if (invalidOpened) return;
        var msg = buildFinalImportMessage(importedNames, overwrittenNames, skippedItems, failedItems);
        var hasIssues = Boolean(skippedItems.length || failedItems.length);
        setStatus(dom.importStatus, msg, hasIssues ? 'warn' : 'ok');
        setStatus(dom.status, msg, hasIssues ? 'warn' : 'ok');
        if (utils && typeof utils.showCenterToast === 'function') {
          utils.showCenterToast(msg, hasIssues ? 'warn' : 'ok', 10000);
        }
      })
      .finally(function() {
        s.loading = false;
        if (state.importDiff.queue && state.importDiff.queue.active) {
          state.importDiff.queue.active = false;
          state.importDiff.queue.index = -1;
        }
        // 防止重复导入：当本次导入无跳过/失败时，自动清空文件选择（保留项目/版本默认值）。
        if (
          !invalidOpened &&
          (importedNames.length || overwrittenNames.length) &&
          skippedItems.length === 0 &&
          failedItems.length === 0
        ) {
          s.files = [];
          renderImportFileHint();
          if (dom.importInput) {
            try {
              dom.importInput.value = '';
            } catch (e) {
              // ignore
            }
          }
        }
        syncImportConfirmEnabled();
      });
  }

  function resetEditDrawer() {
    state.editDrawer.projectId = null;
    state.editDrawer.versionId = null;
    state.editDrawer.files = [];
    state.editDrawer.execByFileId = {};
    state.editDrawer.loading = false;
    state.editDrawer.selection = new Set();
    if (!state.editDrawer.ownerFilter) state.editDrawer.ownerFilter = 'me';
    state.editDrawer.fileSearchText = '';
    setStatus(dom.editDrawerStatus, '', '');
    syncProjectOptions(dom.editDrawerProjectSelect, '请选择项目');
    if (dom.editDrawerProjectSelect) dom.editDrawerProjectSelect.value = '';
    if (dom.editDrawerVersionSelect) {
      dom.editDrawerVersionSelect.disabled = true;
      dom.editDrawerVersionSelect.innerHTML = '<option value=\"\">全部版本</option>';
      dom.editDrawerVersionSelect.value = '';
    }
    syncEditDrawerOwnerFilterOptions();
    if (dom.editDrawerFileSearchInput) dom.editDrawerFileSearchInput.value = '';
    if (dom.editDrawerExportXmindBtn) dom.editDrawerExportXmindBtn.disabled = true;
    if (dom.editDrawerExportExcelBtn) dom.editDrawerExportExcelBtn.disabled = true;
    if (dom.editDrawerListBody) {
      dom.editDrawerListBody.innerHTML = '<tr><td colspan=\"12\"><p class=\"hint\">请选择项目后自动刷新。</p></td></tr>';
    }
    syncEditDrawerControls();
  }

  function handleEditDrawerVersionChange() {
    state.editDrawer.versionId = normalizeId(dom.editDrawerVersionSelect ? dom.editDrawerVersionSelect.value : '');
    state.editDrawer.selection = new Set();
    renderEditDrawerList();
    syncEditDrawerControls();
    persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
  }

  function handleEditDrawerOwnerFilterChange() {
    state.editDrawer.ownerFilter = normalizeEditDrawerOwnerFilter(dom.editDrawerOwnerFilterSelect ? dom.editDrawerOwnerFilterSelect.value : '');
    // 切换过滤后，仅保留当前可见列表里的勾选，避免隐藏项仍被导出/删除。
    var visibleIds = {};
    getEditDrawerVisibleFiles().forEach(function(f) {
      if (!f || f.id === null || f.id === undefined) return;
      visibleIds[String(f.id)] = true;
    });
    var nextSel = new Set();
    (state.editDrawer.selection || new Set()).forEach(function(id) {
      if (visibleIds[String(id)]) nextSel.add(String(id));
    });
    state.editDrawer.selection = nextSel;
    renderEditDrawerList();
    syncEditDrawerControls();
    persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
  }

  function handleEditDrawerFileSearchInput() {
    if (!dom.editDrawerFileSearchInput) return;
    state.editDrawer.fileSearchText = String(dom.editDrawerFileSearchInput.value || '');
    // 搜索同样视为筛选：仅保留可见项的勾选。
    var visibleIds = {};
    getEditDrawerVisibleFiles().forEach(function(f) {
      if (!f || f.id === null || f.id === undefined) return;
      visibleIds[String(f.id)] = true;
    });
    var nextSel = new Set();
    (state.editDrawer.selection || new Set()).forEach(function(id) {
      if (visibleIds[String(id)]) nextSel.add(String(id));
    });
    state.editDrawer.selection = nextSel;
    renderEditDrawerList();
    syncEditDrawerControls();
    persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
  }

  function getSelectedEditDrawerCaseFiles() {
    var selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
    state.editDrawer.selection = selection;
    if (!selection.size) return [];
    var list = Array.isArray(state.editDrawer.files) ? state.editDrawer.files : [];
    return list.filter(function(f) { return f && f.id !== null && f.id !== undefined && selection.has(String(f.id)); });
  }

  function exportEditDrawerSelectionToXmind() {
    if (state.editDrawer.loading) return;
    var files = getSelectedEditDrawerCaseFiles();
    if (!files.length) {
      setStatus(dom.editDrawerStatus, '请先勾选要导出的用例文件', 'warn');
      return;
    }
    var builder = getXmindBuilder();
    if (!builder) {
      setStatus(dom.editDrawerStatus, '缺少 XMind 导出依赖', 'err');
      return;
    }
    if (!apiClient || typeof apiClient.listCaseItems !== 'function') {
      setStatus(dom.editDrawerStatus, '后端用例条目接口未就绪', 'err');
      return;
    }
    var downloadBlob = getDownloadBlob();
    var zipCtor = (typeof JSZip !== 'undefined' ? JSZip : (window.JSZip ? window.JSZip : null));
    var isBatch = files.length > 1;
    var zip = isBatch && zipCtor ? new zipCtor() : null;
    var success = 0;
    var fail = 0;
    if (dom.editDrawerExportXmindBtn) dom.editDrawerExportXmindBtn.disabled = true;
    setStatus(dom.editDrawerStatus, (isBatch ? ('批量导出 XMind（' + files.length + '份）...') : '正在导出 XMind...'), '');

    var chain = Promise.resolve();
    files.forEach(function(f) {
      chain = chain.then(function() {
        var fallbackName = '';
        if (f) {
          fallbackName = f.file_name_clean || f.file_name || f.name || '';
        }
        var baseName = fallbackName ? String(fallbackName) : ('用例#' + (f && f.id ? f.id : ''));
        return apiClient
          .listCaseItems(f.id)
          .then(function(items) { return builder(items || [], baseName, ''); })
          .then(function(pkg) {
            if (!pkg || !pkg.blob) throw new Error('无导出内容');
            var fileName = sanitizeDownloadName(baseName, '.xmind');
            if (zip) {
              zip.file(fileName, pkg.blob);
            } else {
              downloadBlob(fileName, pkg.blob);
            }
            success += 1;
          })
          .catch(function(err) {
            fail += 1;
            console.error(err);
          });
      });
    });
    chain
      .then(function() {
        if (zip) {
          if (!success) throw new Error('全部导出失败');
          return zip.generateAsync({ type: 'blob' }).then(function(blob) {
            downloadBlob('用例批量导出_xmind.zip', blob);
          });
        }
        return null;
      })
      .then(function() {
        setStatus(dom.editDrawerStatus, '导出完成：成功 ' + success + ' 份，失败 ' + fail + ' 份', fail ? 'warn' : 'ok');
        if (success) {
          var fileNames = files
            .map(function(f) {
              if (!f) return '';
              return String(f.file_name_clean || f.file_name || f.name || '').trim();
            })
            .filter(Boolean);
          safeLogOperation('export_case_files_xmind', 'case_file', files.length === 1 ? files[0].id : null, {
            format: 'xmind',
            count: files.length,
            success: success,
            fail: fail,
            case_file_ids: files.map(function(f) { return f && f.id ? f.id : null; }).filter(function(v) { return v !== null; }),
            file_name: files.length === 1 && fileNames.length ? fileNames[0] : null,
            file_names: fileNames,
          });
        }
      })
      .catch(function(err) {
        setStatus(dom.editDrawerStatus, '导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      })
      .finally(function() {
        if (dom.editDrawerExportXmindBtn) dom.editDrawerExportXmindBtn.disabled = false;
      });
  }

  function exportEditDrawerSelectionToExcel() {
    if (state.editDrawer.loading) return;
    var files = getSelectedEditDrawerCaseFiles();
    if (!files.length) {
      setStatus(dom.editDrawerStatus, '请先勾选要导出的用例文件', 'warn');
      return;
    }
    if (!apiClient || typeof apiClient.listCaseItems !== 'function') {
      setStatus(dom.editDrawerStatus, '后端用例条目接口未就绪', 'err');
      return;
    }
    var downloadBlob = getDownloadBlob();
    var zipCtor = (typeof JSZip !== 'undefined' ? JSZip : (window.JSZip ? window.JSZip : null));
    var isBatch = files.length > 1;
    var zip = isBatch && zipCtor ? new zipCtor() : null;
    var success = 0;
    var fail = 0;
    if (dom.editDrawerExportExcelBtn) dom.editDrawerExportExcelBtn.disabled = true;
    setStatus(dom.editDrawerStatus, (isBatch ? ('批量导出 Excel（' + files.length + '份）...') : '正在导出 Excel...'), '');

    var chain = Promise.resolve();
    files.forEach(function(f) {
      chain = chain.then(function() {
        var fallbackName = '';
        if (f) {
          fallbackName = f.file_name_clean || f.file_name || f.name || '';
        }
        var baseName = fallbackName ? String(fallbackName) : ('用例#' + (f && f.id ? f.id : ''));
        return apiClient
          .listCaseItems(f.id)
          .then(function(items) { return buildCaseLibraryExcelBlob(items || [], baseName); })
          .then(function(blob) {
            var fileName = sanitizeDownloadName(baseName, '.xlsx');
            if (zip) {
              zip.file(fileName, blob);
            } else {
              downloadBlob(fileName, blob);
            }
            success += 1;
          })
          .catch(function(err) {
            fail += 1;
            console.error(err);
          });
      });
    });
    chain
      .then(function() {
        if (zip) {
          if (!success) throw new Error('全部导出失败');
          return zip.generateAsync({ type: 'blob' }).then(function(blob) {
            downloadBlob('用例批量导出_excel.zip', blob);
          });
        }
        return null;
      })
      .then(function() {
        setStatus(dom.editDrawerStatus, '导出完成：成功 ' + success + ' 份，失败 ' + fail + ' 份', fail ? 'warn' : 'ok');
        if (success) {
          var fileNames = files
            .map(function(f) {
              if (!f) return '';
              return String(f.file_name_clean || f.file_name || f.name || '').trim();
            })
            .filter(Boolean);
          safeLogOperation('export_case_files_excel', 'case_file', files.length === 1 ? files[0].id : null, {
            format: 'xlsx',
            count: files.length,
            success: success,
            fail: fail,
            case_file_ids: files.map(function(f) { return f && f.id ? f.id : null; }).filter(function(v) { return v !== null; }),
            file_name: files.length === 1 && fileNames.length ? fileNames[0] : null,
            file_names: fileNames,
          });
        }
      })
      .catch(function(err) {
        setStatus(dom.editDrawerStatus, '导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      })
      .finally(function() {
        if (dom.editDrawerExportExcelBtn) dom.editDrawerExportExcelBtn.disabled = false;
      });
  }

  function handleEditDrawerProjectChange() {
    var projectId = normalizeId(dom.editDrawerProjectSelect ? dom.editDrawerProjectSelect.value : '');
    state.editDrawer.projectId = projectId;
    state.editDrawer.versionId = null;
    state.editDrawer.files = [];
    state.editDrawer.execByFileId = {};
    state.editDrawer.selection = new Set();
    if (dom.editDrawerVersionSelect) {
      dom.editDrawerVersionSelect.disabled = true;
      dom.editDrawerVersionSelect.innerHTML = '<option value=\"\">全部版本</option>';
      dom.editDrawerVersionSelect.value = '';
    }
    if (dom.editDrawerExportXmindBtn) dom.editDrawerExportXmindBtn.disabled = true;
    if (dom.editDrawerExportExcelBtn) dom.editDrawerExportExcelBtn.disabled = true;
    renderEditDrawerList();
    if (!projectId) {
      setStatus(dom.editDrawerStatus, '请先选择项目', 'warn');
      if (dom.editDrawerListBody) {
        dom.editDrawerListBody.innerHTML = '<tr><td colspan=\"12\"><p class=\"hint\">请选择项目后自动刷新。</p></td></tr>';
      }
      syncEditDrawerControls();
      persistEditDrawerState({
        drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')),
        force_clear: true,
      });
      return;
    }
    persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
    loadEditDrawerFiles();
  }

  function getEditDrawerVisibleFiles() {
    var list = Array.isArray(state.editDrawer.files) ? state.editDrawer.files : [];
    var visible = list;
    if (state.editDrawer.versionId) {
      visible = visible.filter(function(f) { return String(f && f.version_id || '') === String(state.editDrawer.versionId || ''); });
    }
    var ownerFilter = normalizeEditDrawerOwnerFilter(state.editDrawer && state.editDrawer.ownerFilter ? state.editDrawer.ownerFilter : 'me');
    if (ownerFilter === 'me') {
      var userId = getCurrentUserId();
      if (userId) {
        visible = visible.filter(function(f) {
          if (!f) return false;
          var importerId = f.importer_id !== null && f.importer_id !== undefined ? String(f.importer_id) : '';
          var updaterId = f.last_updated_by !== null && f.last_updated_by !== undefined ? String(f.last_updated_by) : '';
          return String(importerId) === String(userId) || String(updaterId) === String(userId);
        });
      }
    }
    var term = normalizeName(state.editDrawer && state.editDrawer.fileSearchText ? state.editDrawer.fileSearchText : '');
    if (!term) return visible;
    return visible.filter(function(f) {
      if (!f) return false;
      var name = normalizeName(f.file_name_clean || '');
      return name.indexOf(term) !== -1;
    });
  }

  function syncEditDrawerControls() {
    var list = getEditDrawerVisibleFiles();
    var selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
    state.editDrawer.selection = selection;
    var canDelete = isAdminUser();

    if (dom.editDrawerDeleteBtn) {
      dom.editDrawerDeleteBtn.disabled = !canDelete || Boolean(state.editDrawer.loading) || selection.size === 0;
    }
    if (dom.editDrawerExportXmindBtn) {
      dom.editDrawerExportXmindBtn.disabled = Boolean(state.editDrawer.loading) || selection.size === 0;
    }
    if (dom.editDrawerExportExcelBtn) {
      dom.editDrawerExportExcelBtn.disabled = Boolean(state.editDrawer.loading) || selection.size === 0;
    }
    if (dom.editDrawerSelectAll) {
      if (!list.length) {
        dom.editDrawerSelectAll.checked = false;
        dom.editDrawerSelectAll.indeterminate = false;
      } else {
        var total = list.length;
        var selected = selection.size;
        dom.editDrawerSelectAll.checked = selected === total;
        dom.editDrawerSelectAll.indeterminate = selected > 0 && selected < total;
      }
      dom.editDrawerSelectAll.disabled = Boolean(state.editDrawer.loading) || !list.length;
    }
  }

  function setEditDrawerSelectionAll(checked) {
    var list = getEditDrawerVisibleFiles();
    state.editDrawer.selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
    state.editDrawer.selection.clear();
    if (checked) {
      list.forEach(function(f) {
        if (!f || f.id === null || f.id === undefined) return;
        state.editDrawer.selection.add(String(f.id));
      });
    }
    renderEditDrawerList();
    syncEditDrawerControls();
    persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
  }

  function renderEditDrawerList() {
    if (!dom.editDrawerListBody) return;
    var list = getEditDrawerVisibleFiles();
    if (!list.length) {
      var hint = '暂无用例文件';
      var term = String(state.editDrawer && state.editDrawer.fileSearchText ? state.editDrawer.fileSearchText : '').trim();
      if (term) hint = '未找到匹配的用例文件';
      else if (state.editDrawer.versionId) hint = '该版本暂无用例文件';
      dom.editDrawerListBody.innerHTML = '<tr><td colspan=\"12\"><p class=\"hint\">' + escapeHtml(hint) + '</p></td></tr>';
      syncEditDrawerControls();
      return;
    }
    var canDelete = isAdminUser();
    dom.editDrawerListBody.innerHTML = list.map(function(f) {
      // 兼容：列表项应自带 project_id/version_id；若 state 发生波动（例如刷新恢复过程中），优先使用行数据保证展示正确。
      var rowProjectId = f && (f.project_id || f.project_id === 0) ? f.project_id : state.editDrawer.projectId;
      var projectName = state.projectNameById[rowProjectId] || ('项目#' + rowProjectId);
      var versionName = getVersionName(rowProjectId, f && f.version_id ? f.version_id : null);
      var importerName = f && f.importer_name ? f.importer_name : '--';
      var importedAt = formatTime(f && f.imported_at);
      var updaterName = f && f.last_updated_by_name ? f.last_updated_by_name : (importerName || '--');
      var updatedAt = formatTime(f && f.updated_at);
      var itemCount = (f && (f.item_count || f.item_count === 0)) ? String(f.item_count) : '--';
      var reuseEnabled = Boolean(f && f.reuse_enabled);
      var reuseText = reuseEnabled ? '是' : '否';
      var fileId = f && f.id !== null && f.id !== undefined ? String(f.id) : '';
      var checked = Boolean(fileId && state.editDrawer.selection && state.editDrawer.selection.has(fileId));
      var selectCell = '<td><input type=\"checkbox\" data-case-lib-edit-select=\"' + escapeHtml(fileId) + '\"' + (checked ? ' checked' : '') + ' /></td>';
      var fileName = f && f.file_name_clean ? f.file_name_clean : ('文件#' + (f && f.id ? f.id : ''));
      var reuseBadge = reuseEnabled ? ' <span class=\"badge case-library-reuse-badge\">复</span>' : '';
      var execInfo = state.editDrawer.execByFileId && fileId ? state.editDrawer.execByFileId[fileId] : null;
      var activeUsers = execInfo && Array.isArray(execInfo.active_users) ? execInfo.active_users : [];
      var execStatusCell = renderExecPageStatusCell(activeUsers);
      return (
        '<tr>' +
          selectCell +
          '<td>' + escapeHtml(projectName) + '</td>' +
          '<td>' + escapeHtml(versionName) + '</td>' +
          '<td>' + escapeHtml(fileName) + reuseBadge + '</td>' +
          '<td>' + execStatusCell + '</td>' +
          '<td>' + escapeHtml(itemCount) + '</td>' +
          '<td>' + escapeHtml(reuseText) + '</td>' +
          '<td>' + escapeHtml(importerName) + '</td>' +
          '<td>' + escapeHtml(importedAt) + '</td>' +
          '<td>' + escapeHtml(updaterName) + '</td>' +
          '<td>' + escapeHtml(updatedAt) + '</td>' +
          '<td><button class=\"secondary\" type=\"button\" data-case-lib-edit=\"' + escapeHtml(f && f.id ? f.id : '') + '\">查看&amp;编辑</button></td>' +
        '</tr>'
      );
    }).join('');
    syncEditDrawerControls();
  }

  function renderExecPageStatusCell(activeUsers) {
    var list = Array.isArray(activeUsers) ? activeUsers : [];
    if (!list.length) {
      return '<div><span class="tag muted case-lib-exec-tag-pending" title="未转执行">未</span></div>';
    }
    return list
      .map(function(name) {
        return (
          '<div>' +
            escapeHtml(name || '') +
            '：<span class="tag case-lib-exec-tag" title="执行中">执</span>' +
          '</div>'
        );
      })
      .join('');
  }

  function deleteSelectedCaseFiles() {
    if (state.editDrawer.loading) return;
    if (!isAdminUser()) {
      setStatus(dom.editDrawerStatus, '仅管理员可删除', 'warn');
      return;
    }
    var selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
    state.editDrawer.selection = selection;
    if (!selection.size) {
      setStatus(dom.editDrawerStatus, '请先勾选要删除的用例文件', 'warn');
      return;
    }
    if (!apiClient || typeof apiClient.deleteCaseFile !== 'function') {
      setStatus(dom.editDrawerStatus, '后端删除接口未就绪', 'err');
      return;
    }
    var ids = Array.from(selection);
    var list = Array.isArray(state.editDrawer.files) ? state.editDrawer.files : [];

    // 删除前强校验：只要存在于任意执行页（有人执行），必须先在执行页解散（删除执行集）再删库。
    var execByFileId = state.editDrawer.execByFileId && typeof state.editDrawer.execByFileId === 'object'
      ? state.editDrawer.execByFileId
      : {};
    var blocked = [];
    ids.forEach(function(id) {
      var key = String(id);
      var execInfo = execByFileId[key] ? execByFileId[key] : null;
      var activeUsers = execInfo && Array.isArray(execInfo.active_users) ? execInfo.active_users : [];
      if (activeUsers && activeUsers.length) {
        blocked.push({ id: key, activeUsers: activeUsers });
      }
    });
    if (blocked.length) {
      var lines = blocked.map(function(b) {
        var found = list.find(function(f) { return f && String(f.id) === String(b.id); });
        var name = found && found.file_name_clean ? String(found.file_name_clean) : ('文件#' + b.id);
        var usersText = (b.activeUsers || []).filter(Boolean).join('、') || '未知人员';
        return '- ' + name + '（' + usersText + '）';
      });
      var tip =
        '以下用例文件正在执行页中，解散前无法删除：\n' +
        lines.join('\n') +
        '\n\n请先通知正在执行人，在执行页面的分配页面中解散该份用例（移除/删除执行集），解散后再删除。';
      setStatus(dom.editDrawerStatus, '存在执行中用例，已阻止删除', 'warn');
      window.alert(tip);
      return;
    }

    var items = ids.map(function(id) {
      var found = list.find(function(f) { return f && String(f.id) === String(id); });
      var name = found && found.file_name_clean ? String(found.file_name_clean) : ('文件#' + id);
      var count = found && (found.item_count || found.item_count === 0) ? Number(found.item_count) : NaN;
      var countText = (isFinite(count) && count >= 0) ? (String(Math.floor(count)) + '条') : '?条';
      return { name: name, countText: countText };
    });
    var pairs = (items || []).map(function(it) {
      if (!it) return '';
      return String(it.name || '用例') + '，' + String(it.countText || '?条');
    }).filter(Boolean);
    var head = pairs.slice(0, 6).join('、');
    var suffix = pairs.length > 6 ? (' 等' + pairs.length + '份') : '';
    var confirmMsg = '是否确认删除用例：' + head + suffix + '？';
    openConfirmDrawer({
      title: '确认删除用例',
      message: confirmMsg,
      confirmText: '确认删除',
      cancelText: '取消',
      danger: true,
      previousDrawer: editDrawerInstance || null,
    }).then(function(res) {
      if (!res || res.ok !== true) return;
      state.editDrawer.loading = true;
      syncEditDrawerControls();
      setStatus(dom.editDrawerStatus, '删除中...', '');
      var success = 0;
      var fail = 0;
      var deletedIds = [];
      var chain = Promise.resolve();
      ids.forEach(function(id) {
        chain = chain.then(function() {
          return apiClient
            .deleteCaseFile(id)
            .then(function() {
              success += 1;
              deletedIds.push(String(id));
            })
            .catch(function(err) {
              fail += 1;
              var msg = err && err.message ? err.message : '删除失败';
              setStatus(dom.editDrawerStatus, '删除失败：' + msg, 'err');
            });
        });
      });
      chain.then(function() {
        var msg = '删除完成：成功 ' + success + ' 份，失败 ' + fail + ' 份';
        setStatus(dom.editDrawerStatus, msg, fail ? 'warn' : 'ok');
      }).finally(function() {
        state.editDrawer.loading = false;
        state.editDrawer.selection = new Set();
        if (deletedIds.length) {
          var deletedSet = new Set(deletedIds);
          state.editDrawer.files = (state.editDrawer.files || []).filter(function(f) {
            if (!f || f.id === null || f.id === undefined) return true;
            return !deletedSet.has(String(f.id));
          });
          // 若当前编辑视图正在编辑被删除的用例文件，需立即清空视图，避免误以为仍可编辑。
          var editorFile = state.editor && state.editor.caseFile ? state.editor.caseFile : null;
          if (editorFile && editorFile.id !== null && editorFile.id !== undefined) {
            if (deletedSet.has(String(editorFile.id))) {
              state.editor.caseFile = null;
              state.editor.items = [];
              state.editor.searchText = '';
              state.editor.pageIndex = 0;
              state.editor.selection = new Set();
              state.editor.remarkOpen = new Set();
              showEditorCard(false);
              clearEditorPersistedState();
              setStatus(dom.editStatus, '当前编辑用例已被删除', 'warn');
            }
          }
        }
        renderEditDrawerList();
        syncEditDrawerControls();
      });
    });
  }

  function loadEditDrawerFiles() {
    var projectId = normalizeId(dom.editDrawerProjectSelect ? dom.editDrawerProjectSelect.value : '');
    state.editDrawer.projectId = projectId;
    state.editDrawer.versionId = normalizeId(dom.editDrawerVersionSelect ? dom.editDrawerVersionSelect.value : '');
    state.editDrawer.files = [];
    state.editDrawer.execByFileId = {};
    state.editDrawer.selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
    renderEditDrawerList();
    if (!projectId) {
      setStatus(dom.editDrawerStatus, '请先选择项目', 'warn');
      return;
    }
    setStatus(dom.editDrawerStatus, '加载用例库...', '');
    state.editDrawer.loading = true;
    Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId), apiClient.listExecSetsByCaseFile(projectId)])
      .then(function(res) {
        var files = Array.isArray(res && res[0]) ? res[0] : [];
        state.editDrawer.files = files;
        var execSets = Array.isArray(res && res[2]) ? res[2] : [];
        state.editDrawer.execByFileId = buildExecMapByFileId(execSets);
        if (dom.editDrawerVersionSelect) {
          syncVersionOptions(dom.editDrawerVersionSelect, projectId, '全部版本');
          dom.editDrawerVersionSelect.disabled = false;
          if (state.editDrawer.versionId) {
            dom.editDrawerVersionSelect.value = String(state.editDrawer.versionId);
          } else {
            dom.editDrawerVersionSelect.value = '';
          }
        }
        setStatus(dom.editDrawerStatus, '已加载 ' + files.length + ' 份用例文件', files.length ? 'ok' : 'warn');
        // 若列表更新，清理掉不存在/不可见的勾选项，避免按钮状态与实际不一致。
        var visibleIds = {};
        getEditDrawerVisibleFiles().forEach(function(f) {
          if (!f || f.id === null || f.id === undefined) return;
          visibleIds[String(f.id)] = true;
        });
        var nextSel = new Set();
        (state.editDrawer.selection || new Set()).forEach(function(id) {
          if (visibleIds[String(id)]) nextSel.add(String(id));
        });
        state.editDrawer.selection = nextSel;
        renderEditDrawerList();
      })
      .catch(function(err) {
        setStatus(dom.editDrawerStatus, err && err.message ? err.message : '加载失败', 'err');
      })
      .finally(function() {
        state.editDrawer.loading = false;
        syncEditDrawerControls();
        persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
      });
  }

  function findCaseFileInEditDrawer(id) {
    var fileId = Number(id);
    if (isNaN(fileId)) return null;
    return (state.editDrawer.files || []).find(function(f) { return f && f.id === fileId; }) || null;
  }

	  function openEditorForCaseFile(caseFile) {
	    if (!caseFile || !caseFile.id) return;
	    setStatus(dom.editDrawerStatus, '加载用例条目...', '');
	    apiClient.listCaseItems(caseFile.id).then(function(items) {
	      // 保证视图互斥：切到编辑视图时，应隐藏“历史详情”卡片（但不清理其持久化，方便用户回退查看）。
	      setHistoryDetailVisible(false);
	      state.editor.caseFile = caseFile;
	      state.editor.items = reorderItemsByExistingModuleAppend(Array.isArray(items) ? items : []);
	      state.editor.searchText = '';
	      state.editor.pageIndex = 0;
	      state.editor.selection = new Set();
	      state.editor.remarkOpen = new Set();
	      setStatus(dom.editStatus, '已加载 ' + state.editor.items.length + ' 条用例，可直接编辑', 'ok');
      if (dom.editSearchInput) dom.editSearchInput.value = '';
      persistEditorSelection(caseFile);
      persistCaseLibraryLastView('editor');
      renderEditorCard();
      syncEditorSearchControls();
      if (editDrawerInstance && typeof editDrawerInstance.close === 'function') editDrawerInstance.close();
    }).catch(function(err) {
      setStatus(dom.editDrawerStatus, err && err.message ? err.message : '加载用例失败', 'err');
    });
  }

  function showEditorCard(show) {
    if (!dom.editCard) return;
    // 兜底：部分环境下静态 CSS 资源可能加载抖动，增加 hidden 属性确保“隐藏”语义可靠。
    try { dom.editCard.hidden = !show; } catch (_) {}
    if (show) dom.editCard.classList.remove('hidden');
    else dom.editCard.classList.add('hidden');
  }

  var exportDepsLoading = {
    jszip: null,
    xmindCore: null,
  };

  function hasJsZip() {
    return Boolean(typeof JSZip !== 'undefined' || (typeof window !== 'undefined' && typeof window.JSZip !== 'undefined'));
  }

  function hasXmindBuilder() {
    var api = window.app && (window.app.xmindCoreApi || window.app.xmindCore) ? (window.app.xmindCoreApi || window.app.xmindCore) : null;
    return Boolean(api && typeof api.buildXmindPackageFromCases === 'function');
  }

  function loadScriptWithRetry(key, baseSrc, isReady, maxAttempts) {
    var attempts = Number(maxAttempts);
    if (!isFinite(attempts) || attempts <= 0) attempts = 2;
    if (typeof isReady === 'function' && isReady()) return Promise.resolve(true);
    if (exportDepsLoading[key]) return exportDepsLoading[key];

    function appendOnce() {
      return new Promise(function(resolve) {
        if (typeof document === 'undefined' || !document.createElement) return resolve(false);
        var script = document.createElement('script');
        var sep = String(baseSrc).indexOf('?') === -1 ? '?' : '&';
        script.src = String(baseSrc) + sep + 'ts=' + Date.now();
        script.async = true;
        script.setAttribute('data-case-lib-dyn', key);
        script.onload = function() { resolve(true); };
        script.onerror = function() { resolve(false); };
        (document.head || document.documentElement || document.body).appendChild(script);
      });
    }

    function attempt(n) {
      return appendOnce().then(function() {
        if (typeof isReady === 'function' && isReady()) return true;
        if (n >= attempts) return false;
        return new Promise(function(resolve) {
          setTimeout(resolve, 220 + n * 260);
        }).then(function() {
          return attempt(n + 1);
        });
      });
    }

    exportDepsLoading[key] = attempt(0).finally(function() {
      // 若仍未就绪，允许后续再次触发加载（例如用户再次点击导出）。
      if (typeof isReady === 'function' && !isReady()) exportDepsLoading[key] = null;
    });
    return exportDepsLoading[key];
  }

  function ensureExportDepsReady() {
    // xmindCore 依赖 JSZip；两者均为本地静态资源，极少数情况下会因空响应导致未加载，做一次兜底重拉。
    var chain = Promise.resolve(true);
    if (!hasJsZip()) {
      chain = chain.then(function() {
        return loadScriptWithRetry('jszip', './scripts/vendor/jszip.min.js', hasJsZip, 2);
      });
    }
    if (!hasXmindBuilder()) {
      chain = chain.then(function() {
        return loadScriptWithRetry('xmindCore', './scripts/core/xmindCore.js', hasXmindBuilder, 2);
      });
    }
    return chain;
  }

  function getXmindBuilder() {
    var api = window.app && window.app.xmindCoreApi ? window.app.xmindCoreApi : null;
    if (api && typeof api.buildXmindPackageFromCases === 'function') return api.buildXmindPackageFromCases;
    var coreApi = window.app && window.app.xmindCore ? window.app.xmindCore : null;
    if (coreApi && typeof coreApi.buildXmindPackageFromCases === 'function') return coreApi.buildXmindPackageFromCases;
    return null;
  }

  function buildCaseLibraryExcelBlob(items, sheetName) {
    var JSZipCtor = typeof JSZip !== 'undefined' ? JSZip : (window.JSZip ? window.JSZip : null);
    if (!JSZipCtor) return Promise.reject(new Error('缺少 JSZip 依赖，无法导出 Excel'));
    var header = ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果'];
    var rows = [header].concat((items || []).map(function(it) {
      var item = it || {};
      return [
        item.module || '',
        item.title || '',
        item.priority || '',
        item.precondition || '',
        item.steps || '',
        item.expected || '',
      ];
    }));

    return buildSimpleXlsxBlob({
      sheets: [
        { name: sheetName || '用例', rows: rows },
      ],
    });
  }

  function buildSimpleXlsxBlob(options) {
    var JSZipCtor = typeof JSZip !== 'undefined' ? JSZip : (window.JSZip ? window.JSZip : null);
    if (!JSZipCtor) return Promise.reject(new Error('缺少 JSZip 依赖，无法导出 Excel'));
    var sheets = options && Array.isArray(options.sheets) ? options.sheets.filter(Boolean) : [];
    if (!sheets.length) return Promise.reject(new Error('无导出内容'));

    var colCount = 0;
    sheets.forEach(function(sheet) {
      var rows = sheet && Array.isArray(sheet.rows) ? sheet.rows : [];
      rows.forEach(function(row) {
        if (Array.isArray(row) && row.length > colCount) colCount = row.length;
      });
    });
    if (!colCount) colCount = 1;
    var letters = [];
    for (var i = 0; i < colCount; i += 1) {
      letters.push(String.fromCharCode(65 + i));
    }

    function buildSheetXml(rows) {
      var list = Array.isArray(rows) ? rows : [];
      var sheetRowsXml = list.map(function(row, rIdx) {
        var r = rIdx + 1;
        var cells = letters.map(function(col, cIdx) {
          var ref = col + r;
          var value = row && row.length > cIdx ? row[cIdx] : '';
          var text = escapeXmlTextPreserve(value);
          return (
            '<c r=\"' + ref + '\" t=\"inlineStr\">' +
              '<is><t xml:space=\"preserve\">' + text + '</t></is>' +
            '</c>'
          );
        }).join('');
        return '<row r=\"' + r + '\">' + cells + '</row>';
      }).join('');

      return (
        '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>' +
        '<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" ' +
          'xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">' +
          '<sheetData>' + sheetRowsXml + '</sheetData>' +
        '</worksheet>'
      );
    }

    var sheetEntries = sheets.map(function(sheet, idx) {
      var name = sheet && sheet.name ? String(sheet.name) : ('Sheet' + (idx + 1));
      var rows = sheet && Array.isArray(sheet.rows) ? sheet.rows : [[]];
      return { name: name, rows: rows, idx: idx + 1 };
    });

    var workbookSheetsXml = sheetEntries.map(function(entry) {
      return '<sheet name=\"' + escapeXmlText(entry.name) + '\" sheetId=\"' + entry.idx + '\" r:id=\"rId' + entry.idx + '\"/>';
    }).join('');

    var workbookXml =
      '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>' +
      '<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" ' +
        'xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">' +
        '<sheets>' + workbookSheetsXml + '</sheets>' +
      '</workbook>';

    var contentTypesOverrides = sheetEntries.map(function(entry) {
      return '<Override PartName=\"/xl/worksheets/sheet' + entry.idx + '.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>';
    }).join('');

    var contentTypesXml =
      '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>' +
      '<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">' +
        '<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>' +
        '<Default Extension=\"xml\" ContentType=\"application/xml\"/>' +
        '<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>' +
        contentTypesOverrides +
      '</Types>';

    var relsXml =
      '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>' +
      '<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">' +
        '<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>' +
      '</Relationships>';

    var workbookRelsXml =
      '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>' +
      '<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">' +
        sheetEntries.map(function(entry) {
          return '<Relationship Id=\"rId' + entry.idx + '\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet' + entry.idx + '.xml\"/>';
        }).join('') +
      '</Relationships>';

    var zip = new JSZipCtor();
    zip.file('[Content_Types].xml', contentTypesXml);
    zip.folder('_rels').file('.rels', relsXml);
    var xl = zip.folder('xl');
    xl.file('workbook.xml', workbookXml);
    xl.folder('_rels').file('workbook.xml.rels', workbookRelsXml);
    var worksheets = xl.folder('worksheets');
    sheetEntries.forEach(function(entry) {
      worksheets.file('sheet' + entry.idx + '.xml', buildSheetXml(entry.rows));
    });
    return zip.generateAsync({ type: 'blob', compression: 'STORE' });
  }

  function buildCaseLibraryReuseExcelTemplateBlob(sheetName) {
    var header = ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果'];
    var templateRows = [header];
    var headerWithResult = header.concat(['实际结果', '备注', '缺陷链接']);
    var exampleRows = [
      headerWithResult,
      [
        '登录',
        '账号密码登录（复用）',
        'P1',
        '已注册账号',
        '1. 输入账号与密码\n2. 点击登录',
        '复用场景主行（下一行起为复用子项行）',
        '失败',
        '主行备注：实际结果需与子项汇总一致',
        'https://example.com/bug/123',
      ],
      [
        '',
        '',
        '',
        '',
        '',
        '子项1：登录成功并进入首页',
        '通过',
        '子项1备注：成功路径',
        '',
      ],
      [
        '',
        '',
        '',
        '',
        '',
        '子项2：账号或密码错误时提示弹窗',
        '失败',
        '子项2备注：错误提示文案正确',
        '',
      ],
      [
        '支付',
        '下单支付（复用）',
        'P0',
        '已登录且有余额',
        '1. 选择商品\n2. 点击支付\n3. 完成支付',
        '复用场景主行（下一行起为复用子项行）',
        '通过',
        '主行备注：全部子项通过则主行为“通过”',
        '',
      ],
      [
        '',
        '',
        '',
        '',
        '',
        '子项1：余额支付成功并扣减余额',
        '通过',
        '子项1备注：余额扣减正确',
        '',
      ],
      [
        '',
        '',
        '',
        '',
        '',
        '子项2：重复点击支付按钮不重复下单',
        '通过',
        '子项2备注：幂等校验通过',
        '',
      ],
    ];
    return buildSimpleXlsxBlob({
      sheets: [
        { name: sheetName || '用例导入模板（复用）', rows: templateRows },
        { name: '示例（执行页带结果，不参与导入）', rows: exampleRows },
      ],
    });
  }

  function downloadImportExcelTemplate() {
    var downloadBlob = getDownloadBlob();
    if (!downloadBlob) return;
    var templateType = dom.importExcelTemplateTypeSelect ? String(dom.importExcelTemplateTypeSelect.value || '') : 'normal';
    var isReuse = templateType === 'reuse';
    var baseName = isReuse ? '用例导入模板（复用）' : '用例导入模板';
    setStatus(dom.importStatus, '生成 ' + baseName + '中...', '');
    var promise = isReuse ? buildCaseLibraryReuseExcelTemplateBlob(baseName) : buildCaseLibraryExcelBlob([], baseName);
    promise
      .then(function(blob) {
        if (!blob) throw new Error('无导出内容');
        downloadBlob(sanitizeDownloadName(baseName, '.xlsx'), blob);
        setStatus(dom.importStatus, '已导出 ' + baseName, 'ok');
        safeLogOperation('export_case_template_excel', 'case_template', null, {
          format: 'xlsx',
          template_type: isReuse ? 'reuse' : 'normal',
          name: baseName,
        });
      })
      .catch(function(err) {
        setStatus(dom.importStatus, '导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      });
  }

  function downloadImportXmindTemplate() {
    var builder = getXmindBuilder();
    if (!builder) {
      setStatus(dom.importStatus, '缺少 XMind 导出依赖', 'err');
      return;
    }
    var downloadBlob = getDownloadBlob();
    if (!downloadBlob) return;
    setStatus(dom.importStatus, '生成 XMind 导入模板中...', '');
	    var sample = [
	      {
	        module: '模块',
	        title: '用例标题',
	        priority: 'P1',
	        precondition: '前提条件（必填）',
	        steps: '1. 操作步骤（必填）',
	        expected: '预期结果',
	        remark: '',
	      },
	    ];
    builder(sample, '用例导入模板', '')
      .then(function(pkg) {
        if (!pkg || !pkg.blob) throw new Error('无导出内容');
        downloadBlob(sanitizeDownloadName('用例导入模板', '.xmind'), pkg.blob);
        setStatus(dom.importStatus, '已导出 XMind 导入模板', 'ok');
        safeLogOperation('export_case_template_xmind', 'case_template', null, {
          format: 'xmind',
          name: '用例导入模板',
        });
      })
      .catch(function(err) {
        setStatus(dom.importStatus, '导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      });
  }

  // “＋”新增用例高亮：仅保留在本次页面生命周期（刷新后清空），避免写入 localStorage/DB。
  var caseLibraryNewAddedCaseUiKeysByFileId = {};

  function ensureNonEnumerableKey(obj, keyName, value) {
    if (!obj || typeof obj !== 'object') return '';
    var has = false;
    try { has = Object.prototype.hasOwnProperty.call(obj, keyName); } catch (err) { has = false; }
    if (has) {
      try { return String(obj[keyName] || ''); } catch (e) { return ''; }
    }
    var v = value || ('ui-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6));
    try {
      Object.defineProperty(obj, keyName, { value: v, enumerable: false, configurable: true, writable: true });
    } catch (err2) {
      try { obj[keyName] = v; } catch (err3) {}
    }
    return String(v || '');
  }

  function getCaseLibraryEditorUiKey(item) {
    if (!item || typeof item !== 'object') return '';
    var key = '';
    try { key = String(item.__uiKey || ''); } catch (_) { key = ''; }
    if (key) return key;
    if (item.id !== null && item.id !== undefined) return 'id-' + String(item.id);
    return ensureNonEnumerableKey(item, '__uiKey', '');
  }

  function ensureCaseLibraryNewAddedStore(caseFileId) {
    var id = caseFileId !== null && caseFileId !== undefined ? String(caseFileId) : '';
    if (!id) id = 'unknown';
    if (!caseLibraryNewAddedCaseUiKeysByFileId[id] || typeof caseLibraryNewAddedCaseUiKeysByFileId[id] !== 'object') {
      caseLibraryNewAddedCaseUiKeysByFileId[id] = {};
    }
    return caseLibraryNewAddedCaseUiKeysByFileId[id];
  }

  function markCaseLibraryNewAdded(caseFileId, item) {
    var store = ensureCaseLibraryNewAddedStore(caseFileId);
    var key = getCaseLibraryEditorUiKey(item);
    if (!key) return;
    store[key] = true;
  }

  function unmarkCaseLibraryNewAdded(caseFileId, item) {
    var store = ensureCaseLibraryNewAddedStore(caseFileId);
    var key = getCaseLibraryEditorUiKey(item);
    if (!key) return;
    delete store[key];
  }

  function isCaseLibraryNewAdded(caseFileId, item) {
    var store = ensureCaseLibraryNewAddedStore(caseFileId);
    var key = getCaseLibraryEditorUiKey(item);
    return Boolean(key && store && store[key] === true);
  }


	  function applyEditorFilter() {
	    var items = Array.isArray(state.editor.items) ? state.editor.items : [];
	    var term = normalizeName(state.editor.searchText);
	    if (!term) {
	      return items.map(function(item, idx) { return { item: item, idx: idx }; });
	    }
	    return items
	      .map(function(item, idx) { return { item: item, idx: idx }; })
	      .filter(function(entry) {
	        var it = entry.item || {};
	        var hay = [
	          stripInvisibleMarkers(it.module),
	          stripInvisibleMarkers(it.title),
	          stripInvisibleMarkers(it.priority),
	          stripInvisibleMarkers(it.precondition),
	          stripInvisibleMarkers(it.steps),
	          stripInvisibleMarkers(it.expected),
	          stripInvisibleMarkers(it.remark),
	        ].map(function(s) { return String(s || '').toLowerCase(); }).join(' ');
	        return hay.indexOf(term) !== -1;
	      });
	  }

	  function shouldModuleRepositionItem(item, seenModules) {
	    if (!item) return false;
	    var moduleName = normalizeEditorText(item.module);
	    if (!moduleName) return false;
	    if (!seenModules || seenModules[moduleName] !== true) return false;
	    var title = normalizeEditorText(item.title);
	    var priority = normalizeEditorText(item.priority);
	    var pre = normalizeEditorText(item.precondition);
	    var steps = normalizeEditorText(item.steps);
	    var expected = normalizeEditorText(item.expected);
	    if (!title || !priority || !pre || !steps || !expected) return false;
	    return true;
	  }

	  function reorderItemsByExistingModuleAppend(items) {
	    var list = Array.isArray(items) ? items.slice() : [];
	    if (!list.length) return list;
	    var result = [];
	    var seenModules = {};
	    var moduleLastPos = {};

	    function bumpPositionsFrom(index) {
	      Object.keys(moduleLastPos).forEach(function(k) {
	        if (moduleLastPos[k] >= index) moduleLastPos[k] += 1;
	      });
	    }

	    list.forEach(function(it) {
	      var moduleName = normalizeEditorText(it && it.module);
	      var canMove = shouldModuleRepositionItem(it, seenModules);

	      if (!moduleName || !canMove || moduleLastPos[moduleName] === undefined) {
	        result.push(it);
	        if (moduleName) {
	          seenModules[moduleName] = true;
	          moduleLastPos[moduleName] = result.length - 1;
	        }
	        return;
	      }

	      var insertAt = moduleLastPos[moduleName] + 1;
	      bumpPositionsFrom(insertAt);
	      result.splice(insertAt, 0, it);
	      moduleLastPos[moduleName] = insertAt;
	      seenModules[moduleName] = true;
	    });
	    return result;
	  }

  function buildEditorPagination(totalCases, pageIndex, totalPages, start, end) {
    var pageSize = getPageSize();
    var displayStart = totalCases ? start + 1 : 0;
    var displayEnd = totalCases ? Math.min(end, totalCases) : 0;
    var maxPage = Math.max(totalPages, 1);
    var currentPage = totalPages ? pageIndex + 1 : 1;
    var rangeInfo = totalCases
      ? '显示 ' + displayStart + '-' + displayEnd + ' / ' + totalCases + ' 条'
      : '暂无用例';
    return (
      '<div class=\"temp-pagination\" data-case-lib-pagination>' +
        '<div class=\"temp-pagination-info\">' + escapeHtml(rangeInfo) + '，每页 ' + pageSize + ' 条</div>' +
        '<div class=\"temp-pagination-controls\">' +
          '<button type=\"button\" class=\"secondary\" data-case-lib-page=\"prev\" ' + (pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
          '<span>第 ' + currentPage + ' / ' + maxPage + ' 页</span>' +
          '<button type=\"button\" class=\"secondary\" data-case-lib-page=\"next\" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
          '<label>跳至' +
            '<input type=\"number\" min=\"1\" max=\"' + maxPage + '\" value=\"' + Math.min(currentPage, maxPage) + '\" data-case-lib-page-input>' +
            '页' +
          '</label>' +
        '</div>' +
      '</div>'
    );
  }

  function scrollEditorToIndex(index) {
    if (!dom.editView || typeof dom.editView.querySelector !== 'function') return;
    var idx = Number(index);
    if (!isFinite(idx) || idx < 0) return;
    var selector = '[data-case-lib-edit-field=\"module\"][data-index=\"' + idx + '\"]';
    var cell = dom.editView.querySelector(selector);
    var anchor = cell || dom.editView.querySelector('input[data-case-lib-select][data-index=\"' + idx + '\"]');
    if (!anchor) return;
    var row = anchor && anchor.closest ? anchor.closest('tr') : null;
    var target = row || anchor;
    if (target && target.scrollIntoView) {
      try { target.scrollIntoView({ block: 'center' }); } catch (e) { target.scrollIntoView(); }
    }
    if (cell && cell.focus) {
      try { cell.focus(); } catch (_) {}
    }
  }

  function renderEditorTable() {
    if (!dom.editView) return;
    if (!state.editor.caseFile) {
      dom.editView.innerHTML = '<p class=\"hint\">请先选择需要编辑的用例</p>';
      return;
    }
    var caseFileId = state.editor.caseFile && state.editor.caseFile.id ? state.editor.caseFile.id : null;
    var matches = applyEditorFilter();
    var pageSize = getPageSize();
    var totalCases = matches.length;
    var totalPages = totalCases ? Math.ceil(totalCases / pageSize) : 1;
    if (state.editor.pageIndex >= totalPages) state.editor.pageIndex = Math.max(totalPages - 1, 0);
    if (state.editor.pageIndex < 0) state.editor.pageIndex = 0;
    var start = state.editor.pageIndex * pageSize;
    var end = Math.min(totalCases, start + pageSize);
	    var paged = matches.filter(function(_, idx) { return idx >= start && idx < end; });
	    var visibleIndexes = [];
	    var selection = state.editor.selection;
		    var rows = paged.map(function(entry) {
		      var item = entry.item || {};
		      var idx = entry.idx;
		      visibleIndexes.push(idx);
	      var editPlaceholder = '点击此处编辑';
	      var moduleText = stripInvisibleMarkers(item.module);
	      var titleText = stripInvisibleMarkers(item.title);
	      var priorityText = stripInvisibleMarkers(item.priority);
	      var preText = stripInvisibleMarkers(item.precondition);
	      var stepsText = stripInvisibleMarkers(item.steps);
	      var expectedText = stripInvisibleMarkers(item.expected);
	      var moduleHtml = moduleText ? escapeHtml(moduleText) : '';
	      var titleHtml = titleText ? escapeHtml(titleText) : '';
	      var priorityHtml = priorityText ? escapeHtml(priorityText) : '';
		      var preHtml = preText ? escapeHtml(preText).replace(/\n/g, '<br>') : '';
		      var stepsHtml = stepsText ? escapeHtml(stepsText).replace(/\n/g, '<br>') : '';
		      var expectedHtml = expectedText ? escapeHtml(expectedText).replace(/\n/g, '<br>') : '';
		      var rowClass = 'case-row' + (isCaseLibraryNewAdded(caseFileId, item) ? ' new-added' : '');
	      return (
	        '<tr class=\"' + rowClass + '\">' +
	          '<td class=\"check\"><input type=\"checkbox\" data-case-lib-select data-index=\"' + idx + '\" ' + (selection.has(idx) ? 'checked' : '') + '></td>' +
          '<td class=\"index\">' + (idx + 1) + '</td>' +
          '<td class=\"module\"><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-edit-field=\"module\" data-index=\"' + idx + '\" data-case-lib-multiline=\"false\" data-placeholder=\"' + editPlaceholder + '\">' + moduleHtml + '</div></td>' +
          '<td class=\"title\"><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-edit-field=\"title\" data-index=\"' + idx + '\" data-case-lib-multiline=\"false\" data-placeholder=\"' + editPlaceholder + '\">' + titleHtml + '</div></td>' +
          '<td><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-edit-field=\"priority\" data-index=\"' + idx + '\" data-case-lib-multiline=\"false\" data-placeholder=\"' + editPlaceholder + '\">' + priorityHtml + '</div></td>' +
	          '<td><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-edit-field=\"precondition\" data-index=\"' + idx + '\" data-case-lib-multiline=\"true\" data-placeholder=\"' + editPlaceholder + '\">' + preHtml + '</div></td>' +
	          '<td><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-edit-field=\"steps\" data-index=\"' + idx + '\" data-case-lib-multiline=\"true\" data-placeholder=\"' + editPlaceholder + '\">' + stepsHtml + '</div></td>' +
	          '<td><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-edit-field=\"expected\" data-index=\"' + idx + '\" data-case-lib-multiline=\"true\" data-placeholder=\"' + editPlaceholder + '\">' + expectedHtml + '</div></td>' +
	          '<td class=\"case-op-col\">' +
	            '<div class=\"case-ops\">' +
	              '<button type=\"button\" class=\"case-op remove\" title=\"删除当前用例\" data-case-lib-remove data-index=\"' + idx + '\">−</button>' +
	              '<button type=\"button\" class=\"case-op add\" title=\"在下方插入用例\" data-case-lib-insert data-index=\"' + idx + '\">＋</button>' +
	            '</div>' +
	          '</td>' +
	        '</tr>'
	      );
	    }).join('');

    var allVisibleSelected = visibleIndexes.length && visibleIndexes.every(function(idx) { return selection.has(idx); });
    var headerCheckbox = (
      '<th class=\"check\"><input type=\"checkbox\" data-case-lib-select-all data-visible=\"' + visibleIndexes.join(',') + '\" ' +
      (visibleIndexes.length ? (allVisibleSelected ? 'checked' : '') : 'disabled') + '></th>'
	    );
	    var emptyRow = visibleIndexes.length
	      ? ''
	      : '<tr><td colspan=\"9\">' + (state.editor.items.length ? '当前页暂无用例' : '未解析到有效用例') + '</td></tr>';
    var paginationTop = buildEditorPagination(totalCases, state.editor.pageIndex, totalPages, start, end);
    var paginationBottom = buildEditorPagination(totalCases, state.editor.pageIndex, totalPages, start, end);
    dom.editView.innerHTML = (
      paginationTop +
      '<table>' +
        '<thead>' +
          '<tr>' +
            headerCheckbox +
            '<th class=\"index\">编号</th>' +
            '<th class=\"module\">模块</th>' +
            '<th class=\"title\">用例标题</th>' +
            '<th>优先级</th>' +
	            '<th>前提条件</th>' +
	            '<th>操作步骤</th>' +
	            '<th>预期结果</th>' +
	            '<th class=\"ops\" title=\"增删\">增删</th>' +
	          '</tr>' +
	        '</thead>' +
        '<tbody>' + (rows || emptyRow) + '</tbody>' +
      '</table>' +
      paginationBottom
    );
    syncEditorBatchDeleteControls();
    syncEditorBatchAddControls();
  }

  function renderEditorCard() {
    var file = state.editor.caseFile;
    if (!file) {
      showEditorCard(false);
      return;
    }
    showEditorCard(true);
    var projectName = state.projectNameById[file.project_id] || ('项目#' + file.project_id);
    var versionName = getVersionName(file.project_id, file.version_id);
    if (dom.editProject) dom.editProject.textContent = projectName;
    if (dom.editVersion) dom.editVersion.textContent = versionName;
    if (dom.editFileName) dom.editFileName.textContent = file.file_name_clean || ('文件#' + file.id);
    if (dom.editCardTitle) dom.editCardTitle.textContent = '用例编辑视图：' + (file.file_name_clean || ('#' + file.id));
    renderEditorTable();
    syncEditorSearchControls();
    syncEditorBatchDeleteControls();
    syncEditorBatchAddControls();
  }

  function syncEditorSearchControls() {
    if (!dom.editClearSearchBtn) return;
    var val = '';
    if (dom.editSearchInput) val = String(dom.editSearchInput.value || '');
    var term = String(state.editor && state.editor.searchText ? state.editor.searchText : '') || val;
    dom.editClearSearchBtn.disabled = !term.trim();
  }

  function syncEditorBatchDeleteControls() {
    if (!dom.editBatchDeleteBtn) return;
    var ed = state.editor;
    var selected = ed && ed.selection && typeof ed.selection.size === 'number' ? ed.selection.size : 0;
    var disabled = !ed || !ed.caseFile || !selected || Boolean(ed.pendingOp);
    var label = '批量删除';
    if (selected) label += '（' + selected + '）';
    dom.editBatchDeleteBtn.textContent = label;
    dom.editBatchDeleteBtn.disabled = disabled;
  }

  function syncEditorBatchAddControls() {
    var ed = state.editor;
    if (dom.editBatchAddCountInput) {
      if (ed && isFinite(Number(ed.batchAddCount))) {
        dom.editBatchAddCountInput.value = String(clampBatchAddCount(ed.batchAddCount));
      }
    }
    if (!dom.editBatchAddBtn) return;
    var disabled = !ed || !ed.caseFile || Boolean(ed.pendingOp);
    dom.editBatchAddBtn.disabled = disabled;
  }

  function restoreEditorFromPersistedState() {
    if (!isAuthReady()) return Promise.resolve(false);
    if (state.editor.restoring === true) return Promise.resolve(false);
    var persisted = readEditorPersistedState();
    if (!persisted) return Promise.resolve(false);
    var userId = getCurrentUserId();
    if (!userId || String(persisted.user_id || '') !== String(userId)) return Promise.resolve(false);
    var projectId = normalizeId(persisted.project_id);
    var caseFileId = Number(persisted.case_file_id);
    if (!projectId || isNaN(caseFileId) || caseFileId <= 0) return Promise.resolve(false);

    state.editor.restoring = true;
    setStatus(dom.editStatus, '', '');
    return ensureProjectsReady()
      .then(function() { return loadVersions(projectId); })
      .then(function() { return apiClient.listCaseFiles(projectId); })
      .then(function(files) {
        var list = Array.isArray(files) ? files : [];
        var found = list.find(function(f) { return f && Number(f.id) === caseFileId; }) || null;
        if (!found) {
          clearEditorPersistedState();
          state.editor.caseFile = null;
          state.editor.items = [];
          showEditorCard(false);
          return false;
        }
	        return apiClient.listCaseItems(caseFileId).then(function(items) {
	          state.editor.caseFile = found;
	          state.editor.items = reorderItemsByExistingModuleAppend(Array.isArray(items) ? items : []);
	          if (dom.editSearchInput) dom.editSearchInput.value = '';
	          state.editor.searchText = '';
	          state.editor.pageIndex = 0;
	          state.editor.selection = new Set();
          state.editor.remarkOpen = new Set();
          // 保证视图互斥：恢复“编辑”视图时应隐藏“历史详情”卡片。
          setHistoryDetailVisible(false);
          renderEditorCard();
          syncEditorSearchControls();
          return true;
        });
      })
      .catch(function(err) {
        console.error(err);
        // 可能是权限变化/项目不可见，避免卡死：清理后不再恢复。
        clearEditorPersistedState();
        return false;
      })
      .finally(function() {
        state.editor.restoring = false;
      });
  }

  function restoreHistoryDetailFromPersistedState() {
    if (!isAuthReady()) return Promise.resolve(false);
    if (state.historyDetail && state.historyDetail.restoring === true) return Promise.resolve(false);
    var persisted = readHistoryDetailPersistedState();
    if (!persisted) return Promise.resolve(false);
    var userId = getCurrentUserId();
    var loginSeq = getCurrentLoginSeq();
    var okByUser = userId && String(persisted.user_id || '') === String(userId);
    var okByLogin = loginSeq && String(persisted.login_seq || '') === String(loginSeq);
    if (!okByUser && !okByLogin) return Promise.resolve(false);
    var projectId = normalizeId(persisted.project_id);
    var fileNameClean = persisted.file_name_clean ? String(persisted.file_name_clean) : '';
    if (!projectId || !fileNameClean.trim()) return Promise.resolve(false);
    // 仅在“已加载过项目列表”时才严格校验项目存在；避免因为项目列表未就绪/加载失败导致历史详情无法恢复。
    var projectsLoaded = Boolean(state.projects && state.projects.length);
    if (projectsLoaded) {
      var hasProject = (state.projects || []).some(function(p) { return p && String(p.id) === String(projectId); });
      if (!hasProject) return Promise.resolve(false);
    }

    state.historyDetail.restoring = true;
    state.historyDetail.projectId = String(projectId);
    state.historyDetail.fileNameClean = String(fileNameClean).trim();
    state.historyDetail.filter = persisted.filter ? String(persisted.filter) : '';
    state.historyDetail.pageIndex = isFinite(Number(persisted.page_index)) ? Number(persisted.page_index) : 0;
    state.historyDetail.versionId = (persisted.version_id || persisted.version_id === 0) ? persisted.version_id : null;
    setHistoryDetailVisible(true);
    // 保证视图互斥：恢复“历史详情”时应隐藏编辑卡片。
    if (dom.editCard && dom.editCard.classList) dom.editCard.classList.add('hidden');
    try { if (dom.editCard) dom.editCard.hidden = true; } catch (_) {}
    setStatus(dom.historyStatus, '加载历史记录中...', '');
    renderCaseLibraryHistory();
    return loadCaseLibraryHistoryEntries(projectId, fileNameClean)
      .then(function(res) {
        if (!res) return false;
        return true;
      })
      .catch(function() {
        clearHistoryDetailPersistedState();
        setHistoryDetailVisible(false);
        return false;
      })
      .finally(function() {
        state.historyDetail.restoring = false;
      });
  }

  function restoreCaseLibraryLastSelection() {
    if (!isAuthReady()) return Promise.resolve(null);
    var lastView = readCaseLibraryLastViewPersistedState();
    if (lastView) {
      var userId = getCurrentUserId();
      var loginSeq = getCurrentLoginSeq();
      var okByUser = userId && String(lastView.user_id || '') === String(userId);
      var okByLogin = loginSeq && String(lastView.login_seq || '') === String(loginSeq);
      if (okByUser || okByLogin) {
        var viewName = lastView.view ? String(lastView.view) : '';
        if (viewName === 'history') {
          return restoreHistoryDetailFromPersistedState().then(function(ok) {
            if (ok) return 'history';
            setHistoryDetailVisible(false);
            showEditorCard(true);
            return restoreEditorFromPersistedState().then(function(ok2) { return ok2 ? 'editor' : null; });
          });
        }
        if (viewName === 'editor') {
          setHistoryDetailVisible(false);
          showEditorCard(true);
          return restoreEditorFromPersistedState().then(function(ok) {
            if (ok) return 'editor';
            return restoreHistoryDetailFromPersistedState().then(function(ok2) { return ok2 ? 'history' : null; });
          });
        }
      }
    }

    var editorPersisted = readEditorPersistedState();
    var historyPersisted = readHistoryDetailPersistedState();
    var editorAt = editorPersisted && isFinite(Number(editorPersisted.saved_at)) ? Number(editorPersisted.saved_at) : 0;
    var historyAt = historyPersisted && isFinite(Number(historyPersisted.saved_at)) ? Number(historyPersisted.saved_at) : 0;
    var preferHistory = historyAt > editorAt;

    if (preferHistory) {
      return restoreHistoryDetailFromPersistedState().then(function(ok) {
        if (ok) return 'history';
        setHistoryDetailVisible(false);
        showEditorCard(true);
        return restoreEditorFromPersistedState().then(function(ok2) { return ok2 ? 'editor' : null; });
      });
    }
    setHistoryDetailVisible(false);
    showEditorCard(true);
    return restoreEditorFromPersistedState().then(function(ok) {
      if (ok) return 'editor';
      return restoreHistoryDetailFromPersistedState().then(function(ok2) { return ok2 ? 'history' : null; });
      });
  }

  function isHistoryDetailVisible() {
    return Boolean(
      dom.historyDetailCard &&
        dom.historyDetailCard.classList &&
        !dom.historyDetailCard.classList.contains('hidden')
    );
  }

  function isEditorCardVisible() {
    return Boolean(dom.editCard && dom.editCard.classList && !dom.editCard.classList.contains('hidden'));
  }

  function bindUnloadPersistence() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('beforeunload', function() {
      try {
        // 刷新/关闭前再写一次“当前视图”，确保刷新后回到最后操作视图。
        if (isHistoryDetailVisible()) {
          persistHistoryDetailSelection();
          persistCaseLibraryLastView('history');
          return;
        }
        if (isEditorCardVisible()) {
          var file = state.editor && state.editor.caseFile ? state.editor.caseFile : null;
          if (file) persistEditorSelection(file);
          persistCaseLibraryLastView('editor');
        }
      } catch (err) {
        // ignore
      }
    });
  }

  function cleanupPendingToast() {
    var ed = state.editor;
    if (ed.pendingTimer) {
      clearTimeout(ed.pendingTimer);
      ed.pendingTimer = null;
    }
    if (ed.pendingInterval) {
      clearInterval(ed.pendingInterval);
      ed.pendingInterval = null;
    }
    if (ed.pendingToast && ed.pendingToast.parentNode) {
      ed.pendingToast.parentNode.removeChild(ed.pendingToast);
    }
    ed.pendingToast = null;
    ed.pendingRemaining = 0;
  }

	  function clearPendingOp() {
	    cleanupPendingToast();
	    state.editor.pendingOp = null;
	    syncEditorBatchDeleteControls();
	    syncEditorBatchAddControls();
	  }

  var caseLibraryBlockHintEl = null;
  var caseLibraryBlockHintTimer = null;

  function cleanupCaseLibraryBlockHint() {
    if (caseLibraryBlockHintTimer) {
      clearTimeout(caseLibraryBlockHintTimer);
      caseLibraryBlockHintTimer = null;
    }
    if (caseLibraryBlockHintEl && caseLibraryBlockHintEl.parentNode) {
      caseLibraryBlockHintEl.parentNode.removeChild(caseLibraryBlockHintEl);
    }
    caseLibraryBlockHintEl = null;
  }

  function positionCaseLibraryBlockHint(hintEl, anchorRect) {
    if (!hintEl || !anchorRect) return;
    var rect = anchorRect;
    var hintRect = hintEl.getBoundingClientRect ? hintEl.getBoundingClientRect() : null;
    var hintW = hintRect && hintRect.width ? hintRect.width : 260;
    var hintH = hintRect && hintRect.height ? hintRect.height : 44;
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    var margin = 8;
    var width = Number(rect.width) || 0;
    var height = Number(rect.height) || 0;
    var leftBase = Number(rect.left) || 0;
    var topBase = Number(rect.top) || 0;
    var bottomBase = Number.isFinite(Number(rect.bottom)) ? Number(rect.bottom) : (topBase + height);
    var centerX = leftBase + width / 2;
    var left = centerX - hintW / 2;
    if (vw) left = Math.min(Math.max(margin, left), Math.max(margin, vw - hintW - margin));
    var aboveTop = topBase - 10 - hintH;
    var belowTop = bottomBase + 10;
    var top = aboveTop >= margin ? aboveTop : belowTop;
    if (vh) top = Math.min(Math.max(margin, top), Math.max(margin, vh - hintH - margin));
    hintEl.style.left = Math.round(left) + 'px';
    hintEl.style.top = Math.round(top) + 'px';
  }

  function showCaseLibraryBlockHint(anchorRect, message) {
    if (!anchorRect) return;
    cleanupCaseLibraryBlockHint();
    var hint = document.createElement('div');
    hint.className = 'temp-click-hint';
    var text = document.createElement('span');
    text.textContent = message || '当前有待确认的增删操作，请先撤回或等待入库';
    hint.appendChild(text);
    document.body.appendChild(hint);
    caseLibraryBlockHintEl = hint;
    positionCaseLibraryBlockHint(hint, anchorRect);
    caseLibraryBlockHintTimer = setTimeout(function() {
      if (!caseLibraryBlockHintEl) return;
      try { caseLibraryBlockHintEl.classList.add('fade-out'); } catch (_) {}
      setTimeout(function() { cleanupCaseLibraryBlockHint(); }, 220);
    }, 3000);
  }

  function captureCaseLibraryAnchorRect(anchorEl) {
    if (!anchorEl) return null;
    if (typeof anchorEl === 'object' && anchorEl.left !== undefined && anchorEl.top !== undefined) {
      var left0 = Number(anchorEl.left) || 0;
      var top0 = Number(anchorEl.top) || 0;
      var width0 = Number(anchorEl.width) || 0;
      var height0 = Number(anchorEl.height) || 0;
      var bottom0 = Number.isFinite(Number(anchorEl.bottom)) ? Number(anchorEl.bottom) : (top0 + height0);
      return { left: left0, top: top0, width: width0, height: height0, bottom: bottom0 };
    }
    if (typeof anchorEl.getBoundingClientRect !== 'function') return null;
    try {
      var rect = anchorEl.getBoundingClientRect();
      if (!rect) return null;
      var left = Number(rect.left) || 0;
      var top = Number(rect.top) || 0;
      var width = Number(rect.width) || 0;
      var height = Number(rect.height) || 0;
      return {
        left: left,
        top: top,
        width: width,
        height: height,
        bottom: Number.isFinite(Number(rect.bottom)) ? Number(rect.bottom) : (top + height),
      };
    } catch (err) {
      return null;
    }
  }

  function startPendingToast(message, options) {
    options = options || {};
    var anchorRect = options.anchorRect || null;
    cleanupPendingToast();
    var ed = state.editor;
    ed.pendingRemaining = 8;
    var toast = document.createElement('div');
    toast.className = 'temp-undo-toast';
    var text = document.createElement('span');
    var btn = document.createElement('button');
    btn.className = 'pill secondary';
    btn.textContent = '撤回';
    function renderCountdown() {
      text.textContent = (message || '已暂存变更') + '（' + ed.pendingRemaining + 's）';
    }
    var handleUndoClick = function() {
      var op = ed.pendingOp;
      if (!op) return;
      if (op.type === 'remove' && op.item) {
        var insertAt = Math.min(Math.max(op.index, 0), ed.items.length);
        ed.items.splice(insertAt, 0, op.item);
      } else if (op.type === 'remove_batch' && Array.isArray(op.removed)) {
        var list = op.removed
          .filter(function(r) { return r && r.item; })
          .slice()
          .sort(function(a, b) { return Number(a.index) - Number(b.index); });
        list.forEach(function(r) {
          var idx = Math.max(0, Math.min(Number(r.index), ed.items.length));
          ed.items.splice(idx, 0, r.item);
        });
      } else if (op.type === 'insert_batch' && Array.isArray(op.itemKeys)) {
        var keys = op.itemKeys.slice();
        var removals = [];
        for (var i = 0; i < keys.length; i += 1) {
          var key = keys[i];
          var idx = ed.items.findIndex(function(it) { return it && it.__localId === key; });
          if (idx !== -1) removals.push(idx);
        }
        removals.sort(function(a, b) { return b - a; });
        removals.forEach(function(idx) {
          var removed = ed.items[idx];
          if (removed) unmarkCaseLibraryNewAdded(ed.caseFile ? ed.caseFile.id : null, removed);
          ed.items.splice(idx, 1);
        });
      } else if (op.type === 'insert' && op.itemKey) {
        var idx = ed.items.findIndex(function(it) { return it && it.__localId === op.itemKey; });
        if (idx !== -1) ed.items.splice(idx, 1);
      }
      ed.selection = new Set();
      ed.remarkOpen = new Set();
      clearPendingOp();
      setStatus(dom.editStatus, '已撤回增删操作（未入库）', 'ok');
      renderEditorTable();
    };
    btn.addEventListener('click', handleUndoClick);
    toast.appendChild(text);
    toast.appendChild(btn);
    document.body.appendChild(toast);
    ed.pendingToast = toast;
    renderCountdown();
    ed.pendingInterval = setInterval(function() {
      ed.pendingRemaining -= 1;
      if (ed.pendingRemaining <= 0) {
        clearInterval(ed.pendingInterval);
        ed.pendingInterval = null;
        return;
      }
      renderCountdown();
    }, 1000);
    ed.pendingTimer = setTimeout(function() {
      commitPendingOp();
    }, ed.pendingRemaining * 1000);
  }

	  function buildCaseItemPayload(item) {
	    var priority = normalizeEditorText(item && item.priority ? item.priority : '');
	    var pre = normalizeEditorText(item && item.precondition ? item.precondition : '');
	    var steps = normalizeEditorText(item && item.steps ? item.steps : '');
	    var remark = normalizeEditorText(item && item.remark ? item.remark : '');
	    return {
	      module: normalizeEditorText(item && item.module ? item.module : ''),
	      title: normalizeEditorText(item && item.title ? item.title : ''),
	      expected: normalizeEditorText(item && item.expected ? item.expected : ''),
	      priority: priority || null,
	      precondition: pre || null,
	      steps: steps || null,
	      remark: remark || null,
	    };
	  }

  function validatePayload(payload) {
    if (!payload) return '内容不能为空';
    if (!payload.module) return '模块不能为空';
    if (!payload.title) return '用例标题不能为空';
    if (!payload.expected) return '预期结果不能为空';
    return '';
  }

  function saveCaseItemAtIndex(index, reason) {
    var ed = state.editor;
    var file = ed.caseFile;
    if (!file || !file.id) return;
    var idx = Number(index);
    if (!isFinite(idx) || idx < 0 || idx >= ed.items.length) return;
    var item = ed.items[idx];
    if (!item) return;
    if (!item.id) return;
    var payload = buildCaseItemPayload(item);
    var err = validatePayload(payload);
    if (err) {
      setStatus(dom.editStatus, err, 'warn');
      return;
    }
    setStatus(dom.editStatus, (reason || '保存中') + '...', '');
    apiClient.updateCaseItem(item.id, payload).then(function(updated) {
      if (updated) ed.items[idx] = updated;
      setStatus(dom.editStatus, '已保存', 'ok');
      renderEditorTable();
    }).catch(function(e) {
      setStatus(dom.editStatus, e && e.message ? e.message : '保存失败', 'err');
    });
  }

  function commitPendingOp() {
    var ed = state.editor;
    var op = ed.pendingOp;
    if (!op) return;
    var file = ed.caseFile;
    if (!file || !file.id) {
      clearPendingOp();
      return;
    }
    cleanupPendingToast();
    setStatus(dom.editStatus, '增删入库中...', '');
    if (op.type === 'remove' && op.item && op.item.id) {
      apiClient.deleteCaseItem(op.item.id).then(function() {
        setStatus(dom.editStatus, '删除已入库', 'ok');
      }).catch(function(e) {
        setStatus(dom.editStatus, e && e.message ? e.message : '删除入库失败', 'err');
      }).finally(function() {
        clearPendingOp();
      });
      return;
    }

    if (op.type === 'remove_batch' && Array.isArray(op.removed)) {
      var removed = op.removed.slice();
      var toDelete = [];
      var seen = {};
      removed.forEach(function(r) {
        var item = r && r.item ? r.item : null;
        if (!item || !item.id) return;
        var id = String(item.id);
        if (seen[id]) return;
        seen[id] = true;
        toDelete.push({ id: item.id, index: r.index, item: item });
      });

      if (!toDelete.length) {
        ed.pendingOp = null;
        setStatus(dom.editStatus, '批量删除已撤回或无需入库', 'warn');
        renderEditorTable();
        return;
      }

      function settle(p) {
        return Promise.resolve(p).then(
          function(v) { return { status: 'fulfilled', value: v }; },
          function(err) { return { status: 'rejected', reason: err }; }
        );
      }

      var promises = toDelete.map(function(entry) {
        return settle(apiClient.deleteCaseItem(entry.id, { batch: true }));
      });

	      Promise.all(promises).then(function(results) {
	        var failures = [];
	        for (var i = 0; i < results.length; i += 1) {
	          if (results[i] && results[i].status === 'rejected') failures.push(toDelete[i]);
	        }
        safeLogOperation(
          'batch_delete_case_items',
          'case_item',
          null,
          {
            case_file_id: file.id,
            file_name: file.file_name_clean || '',
            count: toDelete.length,
            success: toDelete.length - failures.length,
            fail: failures.length,
          },
          failures.length ? 'partial' : 'success'
        );

        if (!failures.length) {
          setStatus(dom.editStatus, '批量删除已入库（' + toDelete.length + '条）', 'ok');
          return;
        }

        failures
          .slice()
          .sort(function(a, b) { return Number(a.index) - Number(b.index); })
          .forEach(function(entry) {
            var idx = Math.max(0, Math.min(Number(entry.index), ed.items.length));
            ed.items.splice(idx, 0, entry.item);
          });
        renderEditorTable();
        setStatus(
          dom.editStatus,
          '批量删除部分失败：成功 ' + (toDelete.length - failures.length) + ' 条，失败 ' + failures.length + ' 条',
          'warn'
        );
	      }).catch(function(e) {
	        setStatus(dom.editStatus, e && e.message ? e.message : '批量删除入库失败', 'err');
	      }).finally(function() {
	        clearPendingOp();
	      });
	      return;
	    }

    if (op.type === 'insert_batch' && Array.isArray(op.itemKeys)) {
      var keys = op.itemKeys.slice();
      var entries = [];
      keys.forEach(function(key) {
        var idx = ed.items.findIndex(function(it) { return it && it.__localId === key; });
        if (idx === -1) return;
        var item = ed.items[idx];
        if (!item) return;
        entries.push({ index: idx, item: item, key: key });
      });

      if (!entries.length) {
        ed.pendingOp = null;
        setStatus(dom.editStatus, '批量新增已撤回或不存在', 'warn');
        renderEditorTable();
        return;
      }

      function settle(p) {
        return Promise.resolve(p).then(
          function(v) { return { status: 'fulfilled', value: v }; },
          function(err) { return { status: 'rejected', reason: err }; }
        );
      }

      var promises = entries.map(function(entry, seq) {
        var item = entry.item || {};
        var uiKey = getCaseLibraryEditorUiKey(item);
        var module = normalizeEditorText(item.module);
        var title = normalizeEditorText(item.title);
        var priority = normalizeEditorText(item.priority);
        var pre = normalizeEditorText(item.precondition);
        var steps = normalizeEditorText(item.steps);

        var expectedRaw = item.expected !== null && item.expected !== undefined ? String(item.expected) : '';
        var expectedNorm = normalizeEditorText(expectedRaw);
        var expected = expectedNorm ? expectedNorm : expectedRaw;
        if (!expected) expected = buildInvisibleMarker(String(item.__localId || '') + '|' + seq);

        var payload = {
          module: module,
          title: title,
          expected: expected,
          priority: priority || null,
          precondition: pre || '',
          steps: steps || '',
          remark: normalizeEditorText(item.remark) || null,
        };

        return settle(apiClient.createCaseItem(file.id, payload, { batch: true }).then(function(created) {
          if (!created) return created;
          ensureNonEnumerableKey(created, '__uiKey', uiKey || '');
          ed.items[entry.index] = created;
          markCaseLibraryNewAdded(file.id, created);
          return created;
        }));
      });

	      Promise.all(promises).then(function(results) {
	        var failures = [];
	        for (var i = 0; i < results.length; i += 1) {
	          if (results[i] && results[i].status === 'rejected') failures.push(entries[i]);
	        }
        safeLogOperation(
          'batch_create_case_items',
          'case_item',
          null,
          {
            case_file_id: file.id,
            file_name: file.file_name_clean || '',
            count: entries.length,
            success: entries.length - failures.length,
            fail: failures.length,
          },
          failures.length ? 'partial' : 'success'
        );
        if (!failures.length) {
          setStatus(dom.editStatus, '批量新增已入库（' + entries.length + '条）', 'ok');
          renderEditorTable();
          return;
        }
        setStatus(dom.editStatus, '批量新增部分失败：成功 ' + (entries.length - failures.length) + ' 条，失败 ' + failures.length + ' 条', 'warn');
        renderEditorTable();
	      }).catch(function(e) {
	        setStatus(dom.editStatus, e && e.message ? e.message : '批量新增入库失败', 'err');
	      }).finally(function() {
	        clearPendingOp();
	      });
	      return;
	    }

    if (op.type === 'insert' && op.itemKey) {
      var createIndex = ed.items.findIndex(function(it) { return it && it.__localId === op.itemKey; });
      if (createIndex === -1) {
        clearPendingOp();
        setStatus(dom.editStatus, '新增用例已撤回或不存在', 'warn');
        return;
      }
      var newItem = ed.items[createIndex];
      var uiKey = getCaseLibraryEditorUiKey(newItem);
      var payload = buildCaseItemPayload(newItem);
      var err = validatePayload(payload);
      if (err) {
        clearPendingOp();
        setStatus(dom.editStatus, '新增用例未入库：' + err, 'warn');
        return;
      }
      apiClient.createCaseItem(file.id, payload).then(function(created) {
        if (created) {
          ensureNonEnumerableKey(created, '__uiKey', uiKey || '');
          ed.items[createIndex] = created;
          markCaseLibraryNewAdded(file.id, created);
        }
        setStatus(dom.editStatus, '新增已入库', 'ok');
        renderEditorTable();
	      }).catch(function(e) {
	        setStatus(dom.editStatus, e && e.message ? e.message : '新增入库失败', 'err');
	      }).finally(function() {
	        clearPendingOp();
	      });
	      return;
	    }
    clearPendingOp();
    setStatus(dom.editStatus, '变更已应用', 'ok');
  }

	  function insertCaseItem(index, anchorEl) {
	    var ed = state.editor;
	    if (ed.pendingOp) {
	      setStatus(dom.editStatus, '当前有待确认的增删操作，请先撤回或等待入库', 'warn');
      var anchorRectWarn = captureCaseLibraryAnchorRect(anchorEl);
      if (anchorRectWarn) showCaseLibraryBlockHint(anchorRectWarn, '当前有待确认的增删操作，请先撤回或等待入库');
      return;
    }
    var anchorRect = captureCaseLibraryAnchorRect(anchorEl);
    var base = ed.items[index] || {};
    var moduleName = String(base.module || '').trim() || '模块';
    var title = '新用例-' + Math.random().toString(16).slice(2, 6);
    var localId = 'local-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
    var fresh = {
      __localId: localId,
      case_file_id: ed.caseFile ? ed.caseFile.id : null,
      module: moduleName,
      title: title,
      priority: String(base.priority || '').trim() || 'P1',
      precondition: '',
      steps: '',
      expected: '待补充',
      remark: '',
    };
    ensureNonEnumerableKey(fresh, '__uiKey', '');
    var insertAt = Math.min(Math.max(index + 1, 0), ed.items.length);
    ed.items.splice(insertAt, 0, fresh);
    markCaseLibraryNewAdded(ed.caseFile ? ed.caseFile.id : null, fresh);
    ed.selection = new Set();
    ed.remarkOpen = new Set();
    ed.pageIndex = Math.floor(insertAt / getPageSize());
    ed.pendingOp = { type: 'insert', itemKey: localId, index: insertAt };
	    renderEditorTable();
	    startPendingToast('已新增用例，超时将自动入库', { anchorRect: anchorRect });
	  }

	  function parseBatchAddCountInput(raw) {
	    var text = raw === null || raw === undefined ? '' : String(raw);
	    text = text.trim();
	    if (!text) return { ok: false, reason: '请输入批量新增数量（1-10）' };
	    if (!/^\d+$/.test(text)) return { ok: false, reason: '数量仅支持正整数（1-10）' };
	    var n = Number(text);
	    if (!isFinite(n)) return { ok: false, reason: '数量格式不正确' };
	    n = Math.floor(n);
	    if (n < 1) return { ok: false, reason: '数量最小为 1' };
	    if (n > 10) return { ok: false, reason: '数量最大为 10' };
	    return { ok: true, value: n };
	  }

	  function setBatchAddCountInputInvalid(invalid) {
	    if (!dom.editBatchAddCountInput || !dom.editBatchAddCountInput.classList) return;
	    if (invalid) dom.editBatchAddCountInput.classList.add('input-invalid');
	    else dom.editBatchAddCountInput.classList.remove('input-invalid');
	  }

	  function batchInsertCaseItems(anchorEl) {
	    var ed = state.editor;
	    if (!ed) return;
	    if (ed.pendingOp) {
	      setStatus(dom.editStatus, '当前有待确认的增删操作，请先撤回或等待入库', 'warn');
	      var anchorRectWarn = captureCaseLibraryAnchorRect(anchorEl);
	      if (anchorRectWarn) showCaseLibraryBlockHint(anchorRectWarn, '当前有待确认的增删操作，请先撤回或等待入库');
	      return;
	    }
	    if (!ed.caseFile) {
	      setStatus(dom.editStatus, '请先选择用例', 'warn');
	      return;
	    }

	    var raw = dom.editBatchAddCountInput ? dom.editBatchAddCountInput.value : (ed.batchAddCount || 5);
	    var parsed = parseBatchAddCountInput(raw);
	    if (!parsed.ok) {
	      setBatchAddCountInputInvalid(true);
	      setStatus(dom.editStatus, parsed.reason || '批量新增数量不合法', 'warn');
	      return;
	    }
	    setBatchAddCountInputInvalid(false);

	    var count = parsed.value;
	    ed.batchAddCount = count;
	    persistEditorBatchAddCount(count);

	    var anchorRect = captureCaseLibraryAnchorRect(anchorEl);
	    var fileId = ed.caseFile ? ed.caseFile.id : null;
	    var startIndex = ed.items.length;
	    var keys = [];
	    for (var i = 0; i < count; i += 1) {
	      var localId = 'local-batch-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6) + '-' + i;
	      var marker = buildInvisibleMarker(localId);
	      var fresh = {
	        __localId: localId,
	        case_file_id: fileId,
	        module: '',
	        title: '',
	        priority: '',
	        precondition: '',
	        steps: '',
	        expected: marker,
	        remark: '',
	      };
	      ensureNonEnumerableKey(fresh, '__uiKey', '');
	      markCaseLibraryNewAdded(fileId, fresh);
	      ed.items.push(fresh);
	      keys.push(localId);
	    }

	    ed.selection = new Set();
	    ed.remarkOpen = new Set();
	    ed.pageIndex = Math.floor(startIndex / getPageSize());
	    ed.pendingOp = { type: 'insert_batch', itemKeys: keys, startIndex: startIndex };
	    renderEditorTable();
	    setTimeout(function() { scrollEditorToIndex(startIndex); }, 0);
	    startPendingToast('已新增用例 ' + keys.length + ' 条，超时将自动入库', { anchorRect: anchorRect });
	  }

	  function removeCaseItem(index, anchorEl) {
	    var ed = state.editor;
	    if (ed.pendingOp) {
	      setStatus(dom.editStatus, '当前有待确认的增删操作，请先撤回或等待入库', 'warn');
      var anchorRectWarn = captureCaseLibraryAnchorRect(anchorEl);
      if (anchorRectWarn) showCaseLibraryBlockHint(anchorRectWarn, '当前有待确认的增删操作，请先撤回或等待入库');
      return;
    }
    var anchorRect = captureCaseLibraryAnchorRect(anchorEl);
    var idx = Math.max(0, Math.min(Number(index), ed.items.length - 1));
    var item = ed.items[idx];
    if (!item) return;
    var confirmed = window.confirm('确定删除该用例吗？可在 8 秒内撤回。');
    if (!confirmed) return;
    unmarkCaseLibraryNewAdded(ed.caseFile ? ed.caseFile.id : null, item);
    ed.items.splice(idx, 1);
    ed.selection = new Set();
    ed.remarkOpen = new Set();
    ed.pendingOp = { type: 'remove', item: item, index: idx };
	    renderEditorTable();
	    startPendingToast('已删除用例，超时将自动入库', { anchorRect: anchorRect });
	  }

	  function removeSelectedCaseItems(anchorEl) {
	    var ed = state.editor;
	    if (!ed) return;
	    if (ed.pendingOp) {
	      setStatus(dom.editStatus, '当前有待确认的增删操作，请先撤回或等待入库', 'warn');
	      var anchorRectWarn = captureCaseLibraryAnchorRect(anchorEl);
	      if (anchorRectWarn) showCaseLibraryBlockHint(anchorRectWarn, '当前有待确认的增删操作，请先撤回或等待入库');
	      return;
	    }
	    if (!ed.caseFile) {
	      setStatus(dom.editStatus, '请先选择用例', 'warn');
	      return;
	    }
	    ed.selection = ed.selection instanceof Set ? ed.selection : new Set();
	    var raw = Array.from(ed.selection);
	    var indices = [];
	    var seen = {};
	    raw.forEach(function(v) {
	      var idx = Number(v);
	      if (!isFinite(idx)) return;
	      if (idx < 0 || idx >= ed.items.length) return;
	      var key = String(idx);
	      if (seen[key]) return;
	      seen[key] = true;
	      indices.push(idx);
	    });
	    if (!indices.length) {
	      setStatus(dom.editStatus, '请先勾选需要删除的用例', 'warn');
	      syncEditorBatchDeleteControls();
	      return;
	    }
    var confirmMsg = '确定删除已勾选的 ' + indices.length + ' 条用例吗？可在 8 秒内撤回。';
    openConfirmDrawer({
      title: '确认批量删除',
      message: confirmMsg,
      confirmText: '确认删除',
      cancelText: '取消',
      danger: true,
      previousDrawer: editDrawerInstance || null,
    }).then(function(res) {
      if (!res || res.ok !== true) return;

      var anchorRect = captureCaseLibraryAnchorRect(anchorEl);
      indices.sort(function(a, b) { return b - a; });
      var removed = [];
      var fileId = ed.caseFile ? ed.caseFile.id : null;
      indices.forEach(function(idx) {
        if (idx < 0 || idx >= ed.items.length) return;
        var item = ed.items[idx];
        if (!item) return;
        removed.push({ index: idx, item: item });
        unmarkCaseLibraryNewAdded(fileId, item);
        ed.items.splice(idx, 1);
      });
      if (!removed.length) {
        setStatus(dom.editStatus, '未删除任何用例', 'warn');
        syncEditorBatchDeleteControls();
        return;
      }
      ed.selection = new Set();
      ed.remarkOpen = new Set();
      ed.pendingOp = { type: 'remove_batch', removed: removed };
      renderEditorTable();
      startPendingToast('已删除用例 ' + removed.length + ' 条，超时将自动入库', { anchorRect: anchorRect });
    });
  }

	  function toggleRemark(index) {
	    var idx = Number(index);
	    if (!isFinite(idx)) return;
    if (state.editor.remarkOpen.has(idx)) state.editor.remarkOpen.delete(idx);
    else state.editor.remarkOpen.add(idx);
    renderEditorTable();
  }

  function handlePaginationAction(action) {
    var matches = applyEditorFilter();
    var total = matches.length;
    var totalPages = total ? Math.ceil(total / getPageSize()) : 1;
    if (action === 'prev') state.editor.pageIndex = Math.max(0, state.editor.pageIndex - 1);
    if (action === 'next') state.editor.pageIndex = Math.min(totalPages - 1, state.editor.pageIndex + 1);
    renderEditorTable();
  }

  function handlePaginationJump(page) {
    var matches = applyEditorFilter();
    var total = matches.length;
    var totalPages = total ? Math.ceil(total / getPageSize()) : 1;
    var target = Math.max(1, Math.min(Number(page) || 1, totalPages));
    state.editor.pageIndex = Math.max(0, target - 1);
    renderEditorTable();
  }

  function copyCaseExecFields(target, source) {
    if (!target || !source) return;
    if (source.actual) target.actual = source.actual;
    if (source.remark) target.remark = source.remark;
    if (Array.isArray(source.defectLinks)) {
      target.defectLinks = source.defectLinks.map(function(link) { return Object.assign({}, link); });
    }
    if (Array.isArray(source.reuseDetails)) {
      target.reuseDetails = source.reuseDetails.map(function(detail) { return Object.assign({}, detail); });
    }
  }

  function buildExecMatchKey(item) {
    var module = String(item && item.module ? item.module : '').trim();
    var title = String(item && item.title ? item.title : '').trim();
    var expected = String(item && item.expected ? item.expected : '').trim();
    return normalizeName(module) + '::' + normalizeName(title) + '::' + normalizeName(expected);
  }

  function transferItemsToTempExec(caseFile, fileName, items, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var statusEl = opts.statusEl || dom.status;
    var shouldSwitchTab = opts.switchTab !== false;
    var skipActiveConfirm = opts.skipActiveConfirm === true;
    var execVersionId = Object.prototype.hasOwnProperty.call(opts, 'execVersionId') ? opts.execVersionId : undefined;

    var tempExecApi = getTempExecApi();
    if (!tempExecApi || !window.app || !window.app.state) {
      setStatus(statusEl, '执行页未就绪，请先打开一次“用例执行”页签', 'warn');
      return Promise.resolve({ ok: false, reason: 'not_ready' });
    }
    if (isExecDbEnabled() && caseFile && caseFile.id) {
      var projectId = caseFile.project_id || null;
      var name = (caseFile.file_name_clean || fileName || '').trim() || ('用例#' + caseFile.id);
      setStatus(statusEl, '转到执行中...', '');
      var targetExecVersionId = null;
      if (execVersionId !== undefined) {
        targetExecVersionId = execVersionId === '' ? null : execVersionId;
      } else {
        targetExecVersionId = (caseFile && caseFile.version_id !== null && caseFile.version_id !== undefined) ? caseFile.version_id : null;
      }
      function matchExecVersionId(serverValue, targetValue) {
        if (targetValue === null || targetValue === undefined || targetValue === '') {
          return serverValue === null || serverValue === undefined || String(serverValue) === '';
        }
        return String(serverValue) === String(targetValue);
      }
      return apiClient
        .listExecSets(projectId || undefined)
        .then(function(list) {
          var sets = Array.isArray(list) ? list : [];
          var fileIdNum = Number(caseFile.id);
          var matched = sets.filter(function(s) {
            if (!s || Number(s.case_file_id) !== fileIdNum) return false;
            if (String(s.status || '') !== 'active') return false;
            return matchExecVersionId(s.version_id, targetExecVersionId);
          });
          matched.sort(function(a, b) { return Number(b.id) - Number(a.id); });
          var existingSet = matched.length ? matched[0] : null;
          if (!skipActiveConfirm && existingSet && String(existingSet.status || '') === 'active') {
            var ok = window.confirm(
              '检测到执行页已存在【' + name + '】的执行记录，将同步最新用例并尽量保留结果（模块+标题+预期一致保留），是否继续？'
            );
            if (!ok) {
              var cancelErr = new Error('cancelled');
              cancelErr._cancel = true;
              throw cancelErr;
            }
          }
          if (!existingSet) return { importCases: [] };
          return apiClient
            .listExecCases(existingSet.id)
            .then(function(cases) {
              var rows = Array.isArray(cases) ? cases : [];
              return { importCases: rows.map(mapExecCaseToImportPayload).filter(Boolean) };
            })
            .catch(function() {
              return { importCases: [] };
            });
        })
        .then(function(ctx) {
          var importCases = ctx && ctx.importCases ? ctx.importCases : [];
          var prefer = importCases.length ? 'import' : 'db';
          var payload = {
            case_file_id: caseFile.id,
            mode: 'replace',
            prefer_result_source: prefer,
            import_cases: importCases.length ? importCases : null,
          };
          if (execVersionId !== undefined) payload.exec_version_id = execVersionId;
          return apiClient.upsertExecSetFromCaseFile(payload);
        })
        .then(function(execSet) {
          if (!execSet || !execSet.id) throw new Error('执行集创建失败');
          var chain = Promise.resolve();
          if (tempExecApi && typeof tempExecApi.loadTempExecState === 'function') {
            chain = chain.then(function() { return tempExecApi.loadTempExecState(); });
          }
          return chain.then(function() {
            if (tempExecApi && typeof tempExecApi.setTempExecActive === 'function') {
              tempExecApi.setTempExecActive(String(execSet.id));
            }
            return execSet;
          });
        })
        .then(function() {
          setStatus(statusEl, '已转到执行：' + name, 'ok');
          if (shouldSwitchTab) {
            var coreApi = getCore();
            var switchTab = window.app && typeof window.app.switchTab === 'function'
              ? window.app.switchTab
              : (coreApi && typeof coreApi.switchTab === 'function' ? coreApi.switchTab : null);
            if (typeof switchTab === 'function') switchTab('tempexec');
            var section = document.querySelector('[data-section-id=\"tempexec-view\"]');
            if (section && coreApi && typeof coreApi.scrollElementIntoView === 'function') {
              coreApi.scrollElementIntoView(section, 'smooth', 140);
            }
          }
          return { ok: true };
        })
        .catch(function(err) {
          if (err && err._cancel) return { ok: false, reason: 'cancel' };
          setStatus(statusEl, '转到执行失败：' + (err && err.message ? err.message : '未知错误'), 'err');
          return { ok: false, err: err };
        });
    }
    var globalState = window.app.state;
    if (!Array.isArray(globalState.tempExecFiles)) globalState.tempExecFiles = [];
    if (!globalState.tempExecPages || typeof globalState.tempExecPages !== 'object') globalState.tempExecPages = {};

    var list = Array.isArray(items) ? items.slice() : [];
    list = list.filter(function(it) {
      return it && String(it.module || '').trim() && String(it.title || '').trim() && String(it.expected || '').trim();
    });
    if (!list.length) {
      setStatus(statusEl, '用例为空或缺少必填字段（模块/标题/预期结果）', 'warn');
      return Promise.resolve({ ok: false, reason: 'empty' });
    }

    var name = (fileName || '').trim() || '用例';
    var normalizeTempName = utils && typeof utils.normalizeTempExecName === 'function'
      ? utils.normalizeTempExecName
      : function(v) { return String(v || '').trim().toLowerCase(); };
    var normalized = normalizeTempName(name);

    var existing = globalState.tempExecFiles.find(function(f) {
      return normalizeTempName(f && f.name) === normalized;
    }) || null;

    if (existing) {
      var ok = window.confirm('检测到名称为【' + name + '】的用例已存在，将用最新用例覆盖并尽量保留执行结果（标题+预期一致保留），是否继续？');
      if (!ok) return Promise.resolve({ ok: false, reason: 'cancel' });

      var rebuilt = tempExecApi.createTempExecFile(
        existing.name,
        list,
        existing.scope,
        existing.id,
        existing.createdAt,
        existing.requirement
      );
      if (!rebuilt) {
        setStatus(statusEl, '转到执行失败：未解析到有效用例', 'err');
        return Promise.resolve({ ok: false, reason: 'invalid' });
      }
      rebuilt.reuseEnabled = Boolean(existing.reuseEnabled);
      rebuilt.reusePresets = Array.isArray(existing.reusePresets) ? existing.reusePresets : [];
      rebuilt.versionId = existing.versionId || '';

      var oldMap = new Map();
      (existing.cases || []).forEach(function(c) {
        oldMap.set(buildExecMatchKey(c), c);
      });
      (rebuilt.cases || []).forEach(function(c) {
        var old = oldMap.get(buildExecMatchKey(c));
        if (!old) return;
        copyCaseExecFields(c, old);
      });

      var idx = globalState.tempExecFiles.findIndex(function(f) { return f && f.id === existing.id; });
      if (idx !== -1) {
        globalState.tempExecFiles[idx] = rebuilt;
      } else {
        globalState.tempExecFiles.push(rebuilt);
      }
      if (typeof tempExecApi.clearTempExecCaseStates === 'function') {
        tempExecApi.clearTempExecCaseStates(existing.id);
      }
      globalState.tempExecPages[rebuilt.id] = 0;
      if (typeof tempExecApi.persistTempExecState === 'function') tempExecApi.persistTempExecState();
      if (typeof tempExecApi.syncTempExecFocus === 'function') tempExecApi.syncTempExecFocus();
      if (typeof tempExecApi.setTempExecActive === 'function') tempExecApi.setTempExecActive(rebuilt.id);
      setStatus(statusEl, '已覆盖并转到执行：' + name, 'ok');
    } else {
      var entry = tempExecApi.createTempExecFile(name, list, 'current', null, null, globalState.requirementLabel);
      if (!entry) {
        setStatus(statusEl, '转到执行失败：未解析到有效用例', 'err');
        return Promise.resolve({ ok: false, reason: 'invalid' });
      }
      globalState.tempExecFiles.push(entry);
      globalState.tempExecPages[entry.id] = 0;
      if (typeof tempExecApi.persistTempExecState === 'function') tempExecApi.persistTempExecState();
      if (typeof tempExecApi.syncTempExecFocus === 'function') tempExecApi.syncTempExecFocus();
      if (typeof tempExecApi.setTempExecActive === 'function') tempExecApi.setTempExecActive(entry.id);
      setStatus(statusEl, '已转到执行：' + name, 'ok');
    }

    if (shouldSwitchTab) {
      var coreApi = getCore();
      var switchTab = window.app && typeof window.app.switchTab === 'function'
        ? window.app.switchTab
        : (coreApi && typeof coreApi.switchTab === 'function' ? coreApi.switchTab : null);
      if (typeof switchTab === 'function') switchTab('tempexec');
      var section = document.querySelector('[data-section-id=\"tempexec-view\"]');
      if (section && coreApi && typeof coreApi.scrollElementIntoView === 'function') {
        coreApi.scrollElementIntoView(section, 'smooth', 140);
      }
    }
    return Promise.resolve({ ok: true });
  }

  function getSelectDrawerVisibleFiles() {
    var list = Array.isArray(state.selectDrawer.files) ? state.selectDrawer.files : [];
    if (state.selectDrawer.versionId) {
      list = list.filter(function(f) { return String(f && f.version_id || '') === String(state.selectDrawer.versionId || ''); });
    }
    return list;
  }

  function syncSelectDrawerControls() {
    if (!dom.selectBatchExecBtn && !dom.selectSelectAll) return;
    state.selectDrawer.selection = state.selectDrawer.selection instanceof Set ? state.selectDrawer.selection : new Set();

    var visible = getSelectDrawerVisibleFiles();
    var visibleIds = {};
    visible.forEach(function(f) {
      if (!f || !f.id) return;
      visibleIds[String(f.id)] = true;
    });

    var nextSel = new Set();
    state.selectDrawer.selection.forEach(function(id) {
      if (visibleIds[String(id)]) nextSel.add(String(id));
    });
    state.selectDrawer.selection = nextSel;

    var total = visible.length;
    var selected = state.selectDrawer.selection.size;
    var loading = Boolean(state.selectDrawer.loading || state.selectDrawer.processing);

    if (dom.selectBatchExecBtn) {
      dom.selectBatchExecBtn.disabled = loading || selected === 0;
    }
    if (dom.selectSelectAll) {
      dom.selectSelectAll.checked = Boolean(total && selected === total);
      dom.selectSelectAll.indeterminate = Boolean(selected && selected < total);
    }
  }

  function setSelectDrawerSelectionAll(checked) {
    state.selectDrawer.selection = state.selectDrawer.selection instanceof Set ? state.selectDrawer.selection : new Set();
    var visible = getSelectDrawerVisibleFiles();
    if (checked) {
      visible.forEach(function(f) {
        if (!f || !f.id) return;
        state.selectDrawer.selection.add(String(f.id));
      });
    } else {
      visible.forEach(function(f) {
        if (!f || !f.id) return;
        state.selectDrawer.selection.delete(String(f.id));
      });
    }
    renderSelectDrawerList();
    syncSelectDrawerControls();
  }

  function resetSelectDrawer() {
    state.selectDrawer.projectId = null;
    state.selectDrawer.versionId = null;
    state.selectDrawer.files = [];
    state.selectDrawer.execByFileId = {};
    state.selectDrawer.loading = false;
    state.selectDrawer.processing = false;
    state.selectDrawer.loadSeq = 0;
    state.selectDrawer.selection = new Set();
    setStatus(dom.selectStatus, '', '');
    syncProjectOptions(dom.selectProjectSelect, '请选择项目');
    if (dom.selectProjectSelect) dom.selectProjectSelect.value = '';
    if (dom.selectVersionSelect) {
      dom.selectVersionSelect.disabled = true;
      dom.selectVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
      dom.selectVersionSelect.value = '';
    }
    if (dom.selectListBody) {
      dom.selectListBody.innerHTML = '<tr><td colspan=\"9\"><p class=\"hint\">请选择项目后自动刷新。</p></td></tr>';
    }
    if (dom.selectSelectAll) {
      dom.selectSelectAll.checked = false;
      dom.selectSelectAll.indeterminate = false;
    }
    if (dom.selectBatchExecBtn) dom.selectBatchExecBtn.disabled = true;
  }

  function handleSelectProjectChange() {
    var projectId = normalizeId(dom.selectProjectSelect ? dom.selectProjectSelect.value : '');
    state.selectDrawer.projectId = projectId;
    state.selectDrawer.versionId = null;
    persistSelectDrawerState({ projectId: projectId, versionId: '' });
    state.selectDrawer.files = [];
    state.selectDrawer.execByFileId = {};
    state.selectDrawer.processing = false;
    state.selectDrawer.selection = new Set();
    if (dom.selectSelectAll) {
      dom.selectSelectAll.checked = false;
      dom.selectSelectAll.indeterminate = false;
    }
    if (!dom.selectVersionSelect) return;
    dom.selectVersionSelect.disabled = true;
    dom.selectVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
    if (!projectId) return;
    state.selectDrawer.loading = true;
    state.selectDrawer.loadSeq = Number(state.selectDrawer.loadSeq || 0) + 1;
    var seq = state.selectDrawer.loadSeq;
    setStatus(dom.selectStatus, '加载用例库...', '');
    renderSelectDrawerList();
	    Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId), apiClient.listExecSetsByCaseFile(projectId)])
	      .then(function(res) {
	        if (seq !== state.selectDrawer.loadSeq) return;
	        var files = Array.isArray(res && res[0]) ? res[0] : [];
	        var execSets = Array.isArray(res && res[2]) ? res[2] : [];
	        state.selectDrawer.files = files;
	        state.selectDrawer.execByFileId = buildExecMapByFileId(execSets);
        syncVersionOptions(dom.selectVersionSelect, projectId, '请选择版本');
        dom.selectVersionSelect.disabled = false;
        setStatus(dom.selectStatus, '已加载 ' + files.length + ' 份用例文件', files.length ? 'ok' : 'warn');
      })
      .catch(function(err) {
        if (seq !== state.selectDrawer.loadSeq) return;
        state.selectDrawer.files = [];
        state.selectDrawer.execByFileId = {};
        setStatus(dom.selectStatus, err && err.message ? err.message : '加载失败', 'err');
      })
      .finally(function() {
        if (seq !== state.selectDrawer.loadSeq) return;
        state.selectDrawer.loading = false;
        renderSelectDrawerList();
      });
  }

  function handleSelectVersionChange() {
    state.selectDrawer.versionId = normalizeId(dom.selectVersionSelect ? dom.selectVersionSelect.value : '');
    persistSelectDrawerState({ projectId: state.selectDrawer.projectId || '', versionId: state.selectDrawer.versionId || '' });
    renderSelectDrawerList();
  }

  function renderSelectDrawerList() {
    if (!dom.selectListBody) return;
    if (!state.selectDrawer.projectId) {
      dom.selectListBody.innerHTML = '<tr><td colspan=\"9\"><p class=\"hint\">请选择项目后自动刷新。</p></td></tr>';
      syncSelectDrawerControls();
      return;
    }
    if (state.selectDrawer.loading) {
      dom.selectListBody.innerHTML = '<tr><td colspan=\"9\"><p class=\"hint\">加载中...</p></td></tr>';
      syncSelectDrawerControls();
      return;
    }
    var list = getSelectDrawerVisibleFiles();
    if (!list.length) {
      dom.selectListBody.innerHTML = '<tr><td colspan=\"9\"><p class=\"hint\">暂无用例文件</p></td></tr>';
      syncSelectDrawerControls();
      return;
    }
    state.selectDrawer.selection = state.selectDrawer.selection instanceof Set ? state.selectDrawer.selection : new Set();
    var execByFileId = state.selectDrawer.execByFileId && typeof state.selectDrawer.execByFileId === 'object'
      ? state.selectDrawer.execByFileId
      : {};
	    dom.selectListBody.innerHTML = list.map(function(f) {
	      var rowProjectId = f && (f.project_id || f.project_id === 0) ? f.project_id : state.selectDrawer.projectId;
	      var projectName = state.projectNameById[rowProjectId] || ('项目#' + rowProjectId);
	      var versionName = getVersionName(rowProjectId, f && f.version_id ? f.version_id : null);
	      var importerName = f && f.importer_name ? f.importer_name : '--';
	      var importedAt = formatTime(f && f.imported_at);
	      var updatedAt = formatTime(f && f.updated_at);
	      var idStr = f && f.id ? String(f.id) : '';
	      var checked = idStr && state.selectDrawer.selection.has(idStr) ? ' checked' : '';
	      var fileName = f && f.file_name_clean ? f.file_name_clean : ('文件#' + (f && f.id ? f.id : ''));
	      var reuseBadge = (f && f.reuse_enabled) ? ' <span class=\"badge case-library-reuse-badge\">复</span>' : '';
	      var execInfo = idStr && execByFileId[idStr] ? execByFileId[idStr] : null;
	      var activeUsers = execInfo && Array.isArray(execInfo.active_users) ? execInfo.active_users : [];
	      var execStatusCell = renderExecPageStatusCell(activeUsers);
	      return (
	        '<tr>' +
	          '<td><input type=\"checkbox\" data-case-lib-select-select=\"' + escapeHtml(idStr) + '\"' + checked + '/></td>' +
	          '<td>' + escapeHtml(projectName) + '</td>' +
	          '<td>' + escapeHtml(versionName) + '</td>' +
	          '<td>' + escapeHtml(fileName) + reuseBadge + '</td>' +
	          '<td>' + execStatusCell + '</td>' +
	          '<td>' + escapeHtml(importerName) + '</td>' +
	          '<td>' + escapeHtml(importedAt) + '</td>' +
	          '<td>' + escapeHtml(updatedAt) + '</td>' +
	          '<td><button class=\"primary\" type=\"button\" data-case-lib-exec=\"' + escapeHtml(f && f.id ? f.id : '') + '\">转到执行</button></td>' +
	        '</tr>'
	      );
	    }).join('');
	    syncSelectDrawerControls();
	  }

	  function buildExecMapByFileId(rows) {
	    var list = Array.isArray(rows) ? rows : [];
	    var byFileId = {};
	    list.forEach(function(item) {
	      if (!item) return;
	      var fid = item.case_file_id || item.case_file_id === 0 ? String(item.case_file_id) : '';
	      if (!fid) return;
	      byFileId[fid] = item;
	    });
	    return byFileId;
	  }

  function loadSelectDrawerFiles() {
    var projectId = normalizeId(dom.selectProjectSelect ? dom.selectProjectSelect.value : '');
    var versionId = normalizeId(dom.selectVersionSelect ? dom.selectVersionSelect.value : '');
    state.selectDrawer.projectId = projectId;
    state.selectDrawer.versionId = versionId;
    persistSelectDrawerState({ projectId: projectId, versionId: versionId || '' });
    state.selectDrawer.files = [];
    state.selectDrawer.execByFileId = {};
    state.selectDrawer.processing = false;
    state.selectDrawer.selection = new Set();
    renderSelectDrawerList();
    if (!projectId) {
      setStatus(dom.selectStatus, '请先选择项目', 'warn');
      return;
    }
    setStatus(dom.selectStatus, '加载用例库...', '');
    state.selectDrawer.loading = true;
    state.selectDrawer.loadSeq = Number(state.selectDrawer.loadSeq || 0) + 1;
    var seq = state.selectDrawer.loadSeq;
	    Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId), apiClient.listExecSetsByCaseFile(projectId)])
	      .then(function(res) {
	        if (seq !== state.selectDrawer.loadSeq) return;
	        var files = Array.isArray(res && res[0]) ? res[0] : [];
	        var execSets = Array.isArray(res && res[2]) ? res[2] : [];
	        state.selectDrawer.files = files;
	        state.selectDrawer.execByFileId = buildExecMapByFileId(execSets);
        setStatus(dom.selectStatus, '已加载 ' + files.length + ' 份用例文件', files.length ? 'ok' : 'warn');
      })
      .catch(function(err) {
        if (seq !== state.selectDrawer.loadSeq) return;
        state.selectDrawer.files = [];
        state.selectDrawer.execByFileId = {};
        setStatus(dom.selectStatus, err && err.message ? err.message : '加载失败', 'err');
      })
      .finally(function() {
        if (seq !== state.selectDrawer.loadSeq) return;
        state.selectDrawer.loading = false;
        renderSelectDrawerList();
      });
  }

  function findCaseFileInSelectDrawer(id) {
    var fileId = Number(id);
    if (isNaN(fileId)) return null;
    return (state.selectDrawer.files || []).find(function(f) { return f && f.id === fileId; }) || null;
  }

  function openExecVersionSelectDrawer(projectId, options) {
    var drawerApi = window.app && window.app.execVersionDrawer ? window.app.execVersionDrawer : null;
    if (!drawerApi || typeof drawerApi.open !== 'function') {
      return Promise.resolve({ ok: true, versionId: null });
    }
    var opts = options && typeof options === 'object' ? options : {};
    var pid = projectId || opts.projectId || opts.project_id || '';
    if (!pid) return Promise.resolve({ ok: false, reason: 'no_project' });
    var projectName = state.projectNameById && state.projectNameById[pid] ? state.projectNameById[pid] : ('项目#' + pid);
    return drawerApi.open(Object.assign({}, opts, { projectId: pid, projectName: projectName }));
  }

  function execCaseFileFromDrawer(caseFile) {
    if (!caseFile || !caseFile.id) return;
    var pid = caseFile.project_id || null;
    if (!pid) return;

    var wasOpen = Boolean(
      selectDrawerInstance &&
      selectDrawerInstance.element &&
      selectDrawerInstance.element.classList &&
      selectDrawerInstance.element.classList.contains('open')
    );
    if (wasOpen && selectDrawerInstance && typeof selectDrawerInstance.close === 'function') {
      try { if (window.app) window.app.__drawerSkipRestoreOnce = true; } catch (_) {}
      selectDrawerInstance.close();
    }

    var importVid = caseFile.version_id || null;
    var importVerName = getVersionName(pid, importVid) || '';
    openExecVersionSelectDrawer(pid, {
      title: '选择执行版本',
      importVersionId: importVid,
      importVersionName: importVerName || '',
    }).then(function(res) {
      if (!res || res.ok !== true) {
        if (wasOpen && selectDrawerInstance && typeof selectDrawerInstance.open === 'function') selectDrawerInstance.open();
        setStatus(dom.selectStatus, '已取消转到执行', 'warn');
        return;
      }
      var execVid = Object.prototype.hasOwnProperty.call(res, 'versionId') ? res.versionId : (res.exec_version_id || null);
      if (wasOpen && selectDrawerInstance && typeof selectDrawerInstance.open === 'function') selectDrawerInstance.open();
      setStatus(dom.selectStatus, '加载用例条目...', '');
      apiClient.listCaseItems(caseFile.id).then(function(items) {
        transferItemsToTempExec(
          caseFile,
          caseFile.file_name_clean || ('用例#' + caseFile.id),
          items || [],
          { statusEl: dom.selectStatus, execVersionId: execVid }
        );
        if (selectDrawerInstance && typeof selectDrawerInstance.close === 'function') selectDrawerInstance.close();
      }).catch(function(err) {
        setStatus(dom.selectStatus, err && err.message ? err.message : '加载用例失败', 'err');
      });
    });
  }

  function batchExecSelectedCaseFilesFromSelectDrawer() {
    state.selectDrawer.selection = state.selectDrawer.selection instanceof Set ? state.selectDrawer.selection : new Set();
    var projectId = state.selectDrawer.projectId || null;
    if (!projectId) {
      setStatus(dom.selectStatus, '请先选择项目', 'warn');
      return;
    }
    var visible = getSelectDrawerVisibleFiles();
    var selectedFiles = visible.filter(function(f) {
      return f && f.id && state.selectDrawer.selection.has(String(f.id));
    });
    if (!selectedFiles.length) {
      setStatus(dom.selectStatus, '请先勾选用例', 'warn');
      return;
    }

    var failures = [];
    var successes = 0;
    var total = selectedFiles.length;

    var wasOpen = Boolean(
      selectDrawerInstance &&
      selectDrawerInstance.element &&
      selectDrawerInstance.element.classList &&
      selectDrawerInstance.element.classList.contains('open')
    );
    if (wasOpen && selectDrawerInstance && typeof selectDrawerInstance.close === 'function') {
      try { if (window.app) window.app.__drawerSkipRestoreOnce = true; } catch (_) {}
      selectDrawerInstance.close();
    }

    openExecVersionSelectDrawer(projectId, { title: '选择执行版本', importVersionMultiple: true })
      .then(function(res0) {
        if (!res0 || res0.ok !== true) {
          if (wasOpen && selectDrawerInstance && typeof selectDrawerInstance.open === 'function') selectDrawerInstance.open();
          setStatus(dom.selectStatus, '已取消批量转到执行', 'warn');
          return null;
        }
        var execVid = Object.prototype.hasOwnProperty.call(res0, 'versionId') ? res0.versionId : (res0.exec_version_id || null);
        if (wasOpen && selectDrawerInstance && typeof selectDrawerInstance.open === 'function') selectDrawerInstance.open();

        var precheck = Promise.resolve({ ok: true, skipConfirm: false });
        if (isExecDbEnabled()) {
          precheck = apiClient
            .listExecSets(projectId || undefined)
            .then(function(list) {
              var sets = Array.isArray(list) ? list : [];
              var activeNames = [];
              var ids = {};
              selectedFiles.forEach(function(f) { ids[Number(f.id)] = f; });
              function matchVersion(serverValue, targetValue) {
                if (targetValue === null || targetValue === undefined || targetValue === '') {
                  return serverValue === null || serverValue === undefined || String(serverValue) === '';
                }
                return String(serverValue) === String(targetValue);
              }
              sets.forEach(function(s) {
                if (!s || String(s.status || '') !== 'active') return;
                if (!matchVersion(s.version_id, execVid)) return;
                var fid = Number(s.case_file_id);
                var file = ids[fid];
                if (!file) return;
                activeNames.push(file.file_name_clean || ('用例#' + file.id));
              });
              if (!activeNames.length) return { ok: true, skipConfirm: false };
              var msg =
                '检测到以下用例已存在执行记录，将同步最新用例并尽量保留结果（模块+标题+预期一致保留），是否继续？\n' +
                activeNames.join('\n');
              var ok = window.confirm(msg);
              if (!ok) return { ok: false, reason: 'cancel' };
              return { ok: true, skipConfirm: true };
            })
            .catch(function() {
              return { ok: true, skipConfirm: false };
            });
        }

        setStatus(dom.selectStatus, '批量转到执行中...', '');
        state.selectDrawer.processing = true;
        syncSelectDrawerControls();

        return precheck
          .then(function(ctx) {
            if (!ctx || ctx.ok === false) {
              setStatus(dom.selectStatus, '已取消批量转到执行', 'warn');
              return null;
            }
            var skipConfirm = Boolean(ctx && ctx.skipConfirm);
            var chain = Promise.resolve();
            selectedFiles.forEach(function(file, index) {
              chain = chain.then(function() {
                var name = file.file_name_clean || ('用例#' + file.id);
                setStatus(dom.selectStatus, '加载用例条目（' + (index + 1) + '/' + total + '）：' + name, '');
                return apiClient
                  .listCaseItems(file.id)
                  .then(function(items) {
                    return transferItemsToTempExec(file, name, items || [], {
                      statusEl: dom.selectStatus,
                      switchTab: false,
                      skipActiveConfirm: skipConfirm,
                      execVersionId: execVid,
                    }).then(function(res) {
                      if (res && res.ok) successes += 1;
                    });
                  })
                  .catch(function(err) {
                    failures.push({ name: name, err: err });
                  });
              });
            });

            return chain.then(function() {
              if (successes) {
                var coreApi = getCore();
                var switchTab = window.app && typeof window.app.switchTab === 'function'
                  ? window.app.switchTab
                  : (coreApi && typeof coreApi.switchTab === 'function' ? coreApi.switchTab : null);
                if (typeof switchTab === 'function') switchTab('tempexec');
                var section = document.querySelector('[data-section-id=\"tempexec-view\"]');
                if (section && coreApi && typeof coreApi.scrollElementIntoView === 'function') {
                  coreApi.scrollElementIntoView(section, 'smooth', 140);
                }
              }

              if (failures.length) {
                setStatus(
                  dom.selectStatus,
                  '批量转到执行完成：成功 ' + successes + ' 份，失败 ' + failures.length + ' 份',
                  successes ? 'warn' : 'err'
                );
              } else {
                setStatus(dom.selectStatus, '批量转到执行完成：成功 ' + successes + ' 份', 'ok');
              }

              state.selectDrawer.selection = new Set();
              if (selectDrawerInstance && typeof selectDrawerInstance.close === 'function') selectDrawerInstance.close();
              return null;
            });
          })
          .finally(function() {
            state.selectDrawer.processing = false;
            renderSelectDrawerList();
          });
      });
  }

  function bindEvents() {
    if (dom.importInput) {
      dom.importInput.addEventListener('change', function(e) {
        var files = e && e.target && e.target.files ? Array.from(e.target.files) : [];
        handleImportFiles(files);
        try { e.target.value = ''; } catch (_) {}
      });
    }
    if (dom.importDropZone) {
      dom.importDropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dom.importDropZone.classList.add('dragover');
      });
      dom.importDropZone.addEventListener('dragleave', function() {
        dom.importDropZone.classList.remove('dragover');
      });
      dom.importDropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dom.importDropZone.classList.remove('dragover');
        var files = e && e.dataTransfer ? e.dataTransfer.files : null;
        if (files && files.length) handleImportFiles(files);
      });
    }
    if (dom.importProjectSelect) {
      dom.importProjectSelect.addEventListener('change', handleImportProjectChange);
    }
    if (dom.importVersionSelect) {
      dom.importVersionSelect.addEventListener('change', handleImportVersionChange);
    }
    if (dom.importConfirmBtn) {
      dom.importConfirmBtn.addEventListener('click', confirmImportToDb);
    }
    if (dom.importExcelTemplateBtn) {
      dom.importExcelTemplateBtn.addEventListener('click', downloadImportExcelTemplate);
    }
    if (dom.importXmindTemplateBtn) {
      dom.importXmindTemplateBtn.addEventListener('click', downloadImportXmindTemplate);
    }
    if (dom.importDiffOverwriteBtn) {
      dom.importDiffOverwriteBtn.addEventListener('click', confirmOverwriteImportFromDiff);
    }
    if (dom.importInvalidConfirmBtn) {
      dom.importInvalidConfirmBtn.addEventListener('click', confirmImportFromInvalidDrawer);
    }
    if (dom.importInvalidBody) {
      dom.importInvalidBody.addEventListener('focusout', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.getAttribute) return;
        var field = t.getAttribute('data-case-lib-import-invalid-field');
        if (!field) return;
        var idx = Number(t.getAttribute('data-index'));
        if (!isFinite(idx) || idx < 0) return;
        var multiline = String(t.getAttribute('data-case-lib-multiline') || '').toLowerCase() === 'true';
        var raw = multiline ? t.innerText : t.textContent;
        var value = String(raw || '').trim();
        var item = state.importInvalid.items[idx];
        if (!item) return;
        if (field === 'priority') value = normalizePriorityInput(value);
        item[field] = value;
      });
    }

    if (dom.editDrawerConfirmBtn) {
      dom.editDrawerConfirmBtn.addEventListener('click', loadEditDrawerFiles);
    }
    if (dom.editDrawerProjectSelect) {
      dom.editDrawerProjectSelect.addEventListener('change', handleEditDrawerProjectChange);
    }
    if (dom.editDrawerVersionSelect) {
      dom.editDrawerVersionSelect.addEventListener('change', handleEditDrawerVersionChange);
    }
    if (dom.editDrawerOwnerFilterSelect) {
      dom.editDrawerOwnerFilterSelect.addEventListener('change', handleEditDrawerOwnerFilterChange);
    }
    if (dom.editDrawerFileSearchInput) {
      dom.editDrawerFileSearchInput.addEventListener('input', handleEditDrawerFileSearchInput);
    }
    if (dom.editDrawerDeleteBtn) {
      dom.editDrawerDeleteBtn.addEventListener('click', deleteSelectedCaseFiles);
    }
    if (dom.editDrawerSelectAll) {
      dom.editDrawerSelectAll.addEventListener('change', function() {
        setEditDrawerSelectionAll(Boolean(dom.editDrawerSelectAll && dom.editDrawerSelectAll.checked));
      });
    }
    if (dom.editDrawerListBody) {
      dom.editDrawerListBody.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.getAttribute) return;
        var id = t.getAttribute('data-case-lib-edit-select');
        if (!id) return;
        state.editDrawer.selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
        if (t.checked) state.editDrawer.selection.add(String(id));
        else state.editDrawer.selection.delete(String(id));
        syncEditDrawerControls();
        persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
      });
      dom.editDrawerListBody.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-case-lib-edit]') : null;
        if (!btn) return;
        var id = btn.getAttribute('data-case-lib-edit');
        var file = findCaseFileInEditDrawer(id);
        if (file) {
          safeLogOperation('view_case_file', 'case_file', file.id, { file_name: file.file_name_clean || '' });
          openEditorForCaseFile(file);
        }
      });
    }

    if (dom.editSearchInput) {
      dom.editSearchInput.addEventListener('input', function() {
        state.editor.searchText = dom.editSearchInput.value || '';
        state.editor.pageIndex = 0;
        renderEditorTable();
        syncEditorSearchControls();
      });
    }
    if (dom.editClearSearchBtn) {
      dom.editClearSearchBtn.addEventListener('click', function() {
        var prev = String(state.editor && state.editor.searchText ? state.editor.searchText : '');
        state.editor.searchText = '';
        state.editor.pageIndex = 0;
        if (dom.editSearchInput) {
          dom.editSearchInput.value = '';
          // 兼容输入法组合状态：强制结束当前输入并触发一次 input，使 UI 一定更新。
          try { dom.editSearchInput.blur(); } catch (_) {}
          try { dom.editSearchInput.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
        }
        renderEditorTable();
        syncEditorSearchControls();
        if (prev && prev.trim()) {
          setStatus(dom.editStatus, '已清空搜索', 'ok');
          setTimeout(function() {
            // 避免覆盖其它流程提示：仅在仍为本次清空提示时再清理。
            if (dom.editStatus && String(dom.editStatus.textContent || '') === '已清空搜索') {
              setStatus(dom.editStatus, '', '');
            }
          }, 1400);
        }
      });
    }
    if (dom.editDrawerExportXmindBtn) {
      dom.editDrawerExportXmindBtn.addEventListener('click', exportEditDrawerSelectionToXmind);
    }
	    if (dom.editDrawerExportExcelBtn) {
	      dom.editDrawerExportExcelBtn.addEventListener('click', exportEditDrawerSelectionToExcel);
	    }
	    if (dom.editBatchAddCountInput) {
	      dom.editBatchAddCountInput.addEventListener('input', function() {
	        setBatchAddCountInputInvalid(false);
	        var parsed = parseBatchAddCountInput(dom.editBatchAddCountInput.value);
	        if (!parsed.ok) return;
	        state.editor.batchAddCount = parsed.value;
	        persistEditorBatchAddCount(parsed.value);
	        syncEditorBatchAddControls();
	      });
	      dom.editBatchAddCountInput.addEventListener('blur', function() {
	        var parsed = parseBatchAddCountInput(dom.editBatchAddCountInput.value);
	        if (!parsed.ok) {
	          setBatchAddCountInputInvalid(true);
	          return;
	        }
	        setBatchAddCountInputInvalid(false);
	        state.editor.batchAddCount = parsed.value;
	        persistEditorBatchAddCount(parsed.value);
	        syncEditorBatchAddControls();
	      });
	    }
	    if (dom.editBatchAddBtn) {
	      dom.editBatchAddBtn.addEventListener('click', function(e) {
	        var t = e && e.currentTarget ? e.currentTarget : null;
	        batchInsertCaseItems(t);
	      });
	    }
		    if (dom.editToExecBtn) {
		      dom.editToExecBtn.addEventListener('click', function() {
		        var file = state.editor.caseFile;
		        if (!file) {
	          setStatus(dom.editStatus, '请先选择用例', 'warn');
	          return;
	        }
            var pid = file.project_id || null;
            if (!pid) {
              setStatus(dom.editStatus, '用例项目缺失，无法转到执行', 'err');
              return;
            }
            var importVid = file.version_id || null;
            var importVerName = getVersionName(pid, importVid) || '';
            openExecVersionSelectDrawer(pid, {
              title: '选择执行版本',
              importVersionId: importVid,
              importVersionName: importVerName || '',
            }).then(function(res) {
              if (!res || res.ok !== true) {
                setStatus(dom.editStatus, '已取消转到执行', 'warn');
                return;
              }
              var execVid = Object.prototype.hasOwnProperty.call(res, 'versionId') ? res.versionId : (res.exec_version_id || null);
              transferItemsToTempExec(
                file,
                file.file_name_clean || ('用例#' + file.id),
                state.editor.items || [],
                { execVersionId: execVid }
              );
            });
		      });
		    }
	    if (dom.editBatchDeleteBtn) {
	      dom.editBatchDeleteBtn.addEventListener('click', function(e) {
	        var t = e && e.currentTarget ? e.currentTarget : null;
	        removeSelectedCaseItems(t);
	      });
	    }
	    if (dom.editView) {
	      dom.editView.addEventListener('click', function(e) {
	        var t = e && e.target ? e.target : null;
	        if (!t) return;
        var toggle = t.closest ? t.closest('[data-case-lib-remark-toggle]') : null;
        if (toggle) {
          toggleRemark(toggle.getAttribute('data-index'));
        return;
      }
      var insertBtn = t.closest ? t.closest('[data-case-lib-insert]') : null;
      if (insertBtn) {
          var ir = null;
          try { ir = insertBtn.getBoundingClientRect ? insertBtn.getBoundingClientRect() : null; } catch (_) { ir = null; }
          var anchorRect = ir ? { left: ir.left, top: ir.top, width: ir.width, height: ir.height, bottom: ir.bottom } : null;
          insertCaseItem(Number(insertBtn.getAttribute('data-index')), anchorRect);
          return;
      }
      var removeBtn = t.closest ? t.closest('[data-case-lib-remove]') : null;
      if (removeBtn) {
          var rr = null;
          try { rr = removeBtn.getBoundingClientRect ? removeBtn.getBoundingClientRect() : null; } catch (_) { rr = null; }
          var anchorRect2 = rr ? { left: rr.left, top: rr.top, width: rr.width, height: rr.height, bottom: rr.bottom } : null;
          removeCaseItem(Number(removeBtn.getAttribute('data-index')), anchorRect2);
          return;
      }
        var pageBtn = t.closest ? t.closest('[data-case-lib-page]') : null;
        if (pageBtn) {
          handlePaginationAction(pageBtn.getAttribute('data-case-lib-page'));
        }
      });
      dom.editView.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t) return;
        if (t.hasAttribute && t.hasAttribute('data-case-lib-page-input')) {
          handlePaginationJump(t.value);
          return;
        }
        if (t.hasAttribute && t.hasAttribute('data-case-lib-select-all')) {
          var visibleStr = t.getAttribute('data-visible') || '';
          var visible = visibleStr.split(',').map(function(v) { return Number(v); }).filter(function(v) { return isFinite(v); });
          visible.forEach(function(idx) {
            if (t.checked) state.editor.selection.add(idx);
            else state.editor.selection.delete(idx);
          });
          renderEditorTable();
          return;
        }
	        if (t.hasAttribute && t.hasAttribute('data-case-lib-select')) {
	          var idx = Number(t.getAttribute('data-index'));
	          if (!isFinite(idx)) return;
	          if (t.checked) state.editor.selection.add(idx);
	          else state.editor.selection.delete(idx);
	          syncEditorBatchDeleteControls();
	        }
	      });
	      dom.editView.addEventListener('focusout', function(e) {
	        var t = e && e.target ? e.target : null;
	        if (!t || !t.getAttribute) return;
	        var field = t.getAttribute('data-case-lib-edit-field');
	        if (!field) return;
	        var idx = Number(t.getAttribute('data-index'));
	        if (!isFinite(idx)) return;
	        var multiline = String(t.getAttribute('data-case-lib-multiline') || '').toLowerCase() === 'true';
	        var raw = multiline ? t.innerText : t.textContent;
	        var item = state.editor.items[idx];
	        if (!item) return;
	        var prevNorm = normalizeEditorText(item[field]);
	        var nextNorm = normalizeEditorText(raw);
	        if (prevNorm === nextNorm) return;
	        item[field] = nextNorm;
	        saveCaseItemAtIndex(idx, '保存');
	      });
      dom.editView.addEventListener('blur', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.getAttribute) return;
        if (!t.hasAttribute('data-case-lib-remark')) return;
        var idx = Number(t.getAttribute('data-index'));
        if (!isFinite(idx)) return;
        var item = state.editor.items[idx];
        if (!item) return;
        item.remark = t.value || '';
        saveCaseItemAtIndex(idx, '保存');
      }, true);
    }

    if (dom.selectProjectSelect) {
      dom.selectProjectSelect.addEventListener('change', handleSelectProjectChange);
    }
    if (dom.selectVersionSelect) {
      dom.selectVersionSelect.addEventListener('change', handleSelectVersionChange);
    }
    if (dom.selectConfirmBtn) {
      dom.selectConfirmBtn.addEventListener('click', loadSelectDrawerFiles);
    }
    if (dom.selectBatchExecBtn) {
      dom.selectBatchExecBtn.addEventListener('click', batchExecSelectedCaseFilesFromSelectDrawer);
    }
    if (dom.selectSelectAll) {
      dom.selectSelectAll.addEventListener('change', function() {
        setSelectDrawerSelectionAll(Boolean(dom.selectSelectAll && dom.selectSelectAll.checked));
      });
    }
    if (dom.selectListBody) {
      dom.selectListBody.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.getAttribute) return;
        var id = t.getAttribute('data-case-lib-select-select');
        if (!id) return;
        state.selectDrawer.selection = state.selectDrawer.selection instanceof Set ? state.selectDrawer.selection : new Set();
        if (t.checked) state.selectDrawer.selection.add(String(id));
        else state.selectDrawer.selection.delete(String(id));
        syncSelectDrawerControls();
      });
      dom.selectListBody.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-case-lib-exec]') : null;
        if (!btn) return;
        var id = btn.getAttribute('data-case-lib-exec');
        var file = findCaseFileInSelectDrawer(id);
        if (file) execCaseFileFromDrawer(file);
      });
    }

    if (dom.historyDrawerProjectSelect) {
      dom.historyDrawerProjectSelect.addEventListener('change', handleHistoryQueryProjectChange);
    }
    if (dom.historyDrawerVersionSelect) {
      dom.historyDrawerVersionSelect.addEventListener('change', handleHistoryQueryVersionChange);
    }
    if (dom.historyDrawerSearchInput) {
      dom.historyDrawerSearchInput.addEventListener('input', handleHistoryQuerySearchInput);
    }
    if (dom.historyDrawerQueryBtn) {
      dom.historyDrawerQueryBtn.addEventListener('click', loadHistoryQueryDrawerFiles);
    }
    if (dom.historyDrawerClearBtn) {
      dom.historyDrawerClearBtn.addEventListener('click', clearHistoryQuerySearch);
    }
    if (dom.historyDrawerListBody) {
      dom.historyDrawerListBody.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-case-lib-history-open]') : null;
        if (!btn) return;
        var pid = btn.getAttribute('data-case-lib-history-project') || '';
        var name = btn.getAttribute('data-case-lib-history-file') || '';
        var vid = btn.getAttribute('data-case-lib-history-version') || '';
        openCaseLibraryHistoryDetail(pid, name, vid);
      });
    }
    if (dom.historyRefreshBtn) {
      dom.historyRefreshBtn.addEventListener('click', function() {
        var pid = state.historyDetail && state.historyDetail.projectId ? String(state.historyDetail.projectId) : '';
        var name = state.historyDetail && state.historyDetail.fileNameClean ? String(state.historyDetail.fileNameClean) : '';
        if (!pid || !name) {
          setStatus(dom.historyStatus, '请先选择一个用例查看历史详情', 'warn');
          return;
        }
        ensureProjectsReady().then(function() {
          return loadCaseLibraryHistoryEntries(pid, name);
        });
      });
    }
    if (dom.historyHideBtn) {
      dom.historyHideBtn.addEventListener('click', function() {
        setHistoryDetailVisible(false);
        // 用户主动收起详情，视为切回“非详情”态：不再在刷新后自动恢复该详情。
        clearHistoryDetailPersistedState();
        // 若此前在编辑视图选中过用例，则刷新后优先恢复编辑视图；否则不指定。
        var hasEditor = Boolean(state.editor && state.editor.caseFile && state.editor.caseFile.id);
        if (hasEditor) persistCaseLibraryLastView('editor');
      });
    }
    if (dom.historyDetailCard) {
      dom.historyDetailCard.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-case-lib-history-page]') : null;
        if (!btn) return;
        var action = btn.getAttribute('data-case-lib-history-page') || '';
        if (!action) return;
        handleHistoryDetailPaginationAction(action);
      });
      dom.historyDetailCard.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.hasAttribute) return;
        if (!t.hasAttribute('data-case-lib-history-page-input')) return;
        handleHistoryDetailPaginationJump(t.value);
      });
    }
    [
      dom.historyAppendPill,
      dom.historyAddedPill,
      dom.historyUpdatedPill,
      dom.historyDeletedPill,
      dom.historyImportPill,
      dom.historyReimportPill,
      dom.historyFileDeletedPill,
    ].forEach(function(pill) {
      if (!pill || typeof pill.addEventListener !== 'function') return;
      pill.addEventListener('click', function() {
        var next = pill.getAttribute('data-case-lib-history-filter') || '';
        setCaseLibraryHistoryFilter(next);
      });
    });
  }

  var pendingCaseLibraryTab = false;
  var autoRestoreAttempt = 0;
  var autoRestoreTimer = null;
  var restoreAfterActivatedPromise = null;

		  function restoreCaseLibraryAfterActivated() {
		    if (restoreAfterActivatedPromise) return restoreAfterActivatedPromise;
		    restoreAfterActivatedPromise = (function() {
		      if (!isAuthReady()) {
		        pendingCaseLibraryTab = true;
		        setStatus(dom.status, '登录信息加载中...', '');
		        return Promise.resolve(null);
		      }
		      pendingCaseLibraryTab = false;
		      restoreEditorBatchAddCountFromPersistedState();
		      return ensureProjectsReady()
		        .then(function() { return restoreCaseLibraryLastSelection(); })
		        .then(function(view) {
		          var persisted = readEditDrawerPersistedState();
		          var userId = getCurrentUserId();
		          var shouldOpen = Boolean(persisted && userId && String(persisted.user_id || '') === String(userId) && persisted.drawer_open === true);
		          var hasEditor = Boolean(state.editor && state.editor.caseFile && state.editor.caseFile.id);
		          var inHistoryView = view === 'history' || isHistoryDetailVisible();
		          // 仅当不在历史详情视图时，才根据持久化状态自动打开“查看&编辑”抽屉。
		          // 例如：仅在抽屉内勾选/导出后刷新，也应保持抽屉开启与勾选状态。
		          if (!inHistoryView && shouldOpen && !hasEditor && editDrawerInstance && typeof editDrawerInstance.open === 'function') {
		            editDrawerInstance.open();
		          }
		          return view;
		        });
		    })();
		    return restoreAfterActivatedPromise.finally(function() {
		      restoreAfterActivatedPromise = null;
		    });
		  }

  function scheduleAutoRestoreProbe() {
    if (autoRestoreTimer) return;
    autoRestoreAttempt = 0;
    var maxAttempts = 150;
    var intervalMs = 200;

    function clearProbe() {
      if (autoRestoreTimer) clearTimeout(autoRestoreTimer);
      autoRestoreTimer = null;
    }

    function tick() {
      autoRestoreAttempt += 1;
      if (autoRestoreAttempt > maxAttempts) return clearProbe();

      var visible = document.querySelector('section[data-tab-section=\"case-library\"]:not(.hidden)');
      if (visible && isAuthReady()) {
        clearProbe();
        restoreCaseLibraryAfterActivated();
        return;
      }
      autoRestoreTimer = setTimeout(tick, intervalMs);
    }

    autoRestoreTimer = setTimeout(tick, 0);
  }

  function bindTabActivation() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('app-tab-activated', function(e) {
      var tabName = e && e.detail ? e.detail.tab : '';
      if (tabName !== 'case-library') return;
      restoreCaseLibraryAfterActivated();
    });
    window.addEventListener('app-auth-ready', function() {
      var globalState = window.app && window.app.state ? window.app.state : {};
      var tabName = globalState && globalState.activeTab ? globalState.activeTab : '';
      var visible = document.querySelector('section[data-tab-section=\"case-library\"]:not(.hidden)');
      if (tabName === 'case-library' || pendingCaseLibraryTab || visible) {
        restoreCaseLibraryAfterActivated();
      }
    });
  }

  function init() {
    if (!dom.root) return;

    // 兜底：本地静态资源偶发空响应时，提前触发一次导出依赖补拉，避免导出按钮处报“缺少依赖”。
    ensureExportDepsReady();

	    importDrawerInstance = ensureDrawer('caseLibraryImportDrawer', ['openCaseLibraryImportDrawerBtn'], function() {
	      ensureProjectsReady().then(resetImportDrawer);
	    });
	    importDiffDrawerInstance = ensureDrawer(
	      'caseLibraryImportDiffDrawer',
	      [],
	      function() {
	        // noop
	      },
	      function() {
	        if (importDiffDrawerOpenTimer) {
	          clearTimeout(importDiffDrawerOpenTimer);
	          importDiffDrawerOpenTimer = 0;
	        }
	        var external = state.importDiff && state.importDiff.external ? state.importDiff.external : null;
	        if (external && typeof external.resolve === 'function') {
	          state.importDiff.external = null;
	          try {
	            external.resolve({ ok: false, reason: 'closed' });
	          } catch (e) {
	            // ignore
	          }
          }
          state.importDiff.mode = 'import';
          state.importDiff.caseFileId = null;
          state.importDiff.confirming = false;
          if (dom.importDiffOverwriteBtn) dom.importDiffOverwriteBtn.textContent = '确认覆盖导入';
	      }
	    );
	    importInvalidDrawerInstance = ensureDrawer(
	      'caseLibraryImportInvalidDrawer',
	      [],
	      function() {
	        // noop
	      },
	      function() {
	        state.importInvalid.file = null;
	        state.importInvalid.fileName = '';
	        state.importInvalid.cleanName = '';
	        state.importInvalid.source = '';
	        state.importInvalid.projectId = null;
	        state.importInvalid.versionId = null;
	        state.importInvalid.items = [];
	        state.importInvalid.invalid = [];
	        state.importInvalid.loading = false;
	        syncImportInvalidControls();
	        if (dom.importInvalidStatus) setStatus(dom.importInvalidStatus, '', '');
	        if (dom.importInvalidBody) {
	          dom.importInvalidBody.innerHTML = '<tr><td colspan=\"7\"><p class=\"hint\">暂无数据</p></td></tr>';
	        }
	      }
	    );
	    editDrawerInstance = ensureDrawer(
	      'caseLibraryEditDrawer',
	      ['openCaseLibraryEditDrawerBtn'],
	      function() {
	        var prevPersisted = readEditDrawerPersistedState();
	        ensureProjectsReady().then(function() {
	          // 进入“查看&编辑”抽屉也视为 editor 视图，刷新应能按最后操作恢复并自动打开抽屉。
	          persistCaseLibraryLastView('editor');
	          resetEditDrawer();
	          return restoreEditDrawerFromPersistedState()
	            .then(function(restored) {
	              if (restored) {
	                persistEditDrawerState({ drawer_open: true });
                return;
              }
              // 恢复失败时尽量不覆盖旧选择，仅更新 open 状态。
              var userId = getCurrentUserId();
              if (
                prevPersisted &&
                userId &&
                String(prevPersisted.user_id || '') === String(userId)
              ) {
                prevPersisted.drawer_open = true;
                writeEditDrawerPersistedState(prevPersisted);
              } else {
                persistEditDrawerState({ drawer_open: true });
              }
            });
        });
      },
      function() {
        persistEditDrawerState({ drawer_open: false });
      }
    );
    selectDrawerInstance = ensureDrawer('caseLibrarySelectExecDrawer', ['openCaseLibrarySelectExecDrawerBtn'], function() {
      ensureProjectsReady().then(function() {
        resetSelectDrawer();
        return restoreSelectDrawerFromPersistedState();
      });
    });
    historyDrawerInstance = ensureDrawer('caseLibraryHistoryDrawer', ['openCaseLibraryHistoryDrawerBtn'], function() {
      ensureProjectsReady().then(function() {
        resetHistoryQueryDrawer();
        return restoreHistoryQueryDrawerFromPersistedState();
      });
    });

    bindEvents();
    bindTabActivation();
    bindProjectsUpdated();
    bindUnloadPersistence();

    // 兜底：某些时序下可能错过 app-tab-activated/app-auth-ready，短窗口轮询一次“是否需要恢复”。
    scheduleAutoRestoreProbe();
    window.app = window.app || {};
    window.app.caseLibraryApi = window.app.caseLibraryApi || {};
    window.app.caseLibraryApi.openImportDiffForExternal = openImportDiffForExternal;
    window.app.caseLibraryApi.openAppendDiffForExternal = openAppendDiffForExternal;
    window.app.caseLibraryBound = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
