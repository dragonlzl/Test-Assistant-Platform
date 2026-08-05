(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecTableViewOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function(root) {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var state = opts.state || {};
    var windowRef = opts.window || root || null;
    var documentRef = opts.document || (windowRef && windowRef.document ? windowRef.document : null);
    var tempExecView = opts.tempExecView || null;
    var tempExecViewSection = opts.tempExecViewSection || null;
    var tempExecMindContainer = opts.tempExecMindContainer || null;
    var tempExecMindBtn = opts.tempExecMindBtn || null;
    var exportTempExecBtn = opts.exportTempExecBtn || null;
    var exportTempExecXmindBtn = opts.exportTempExecXmindBtn || null;
    var exportTempExecCasesXmindBtn = opts.exportTempExecCasesXmindBtn || null;
    var tempExecXmindViewBtn = opts.tempExecXmindViewBtn || null;
    var tempExecCaseLibraryChangesBtn = opts.tempExecCaseLibraryChangesBtn || null;
    var tempExecResultOptions = Array.isArray(opts.tempExecResultOptions)
      ? opts.tempExecResultOptions
      : ['未执行', '通过', '失败', '阻塞', '不适用'];
    var caseViewBaseFontSize = Number.isFinite(Number(opts.caseViewBaseFontSize))
      ? Number(opts.caseViewBaseFontSize)
      : 13;
    var canBuildMindData = typeof opts.buildMindDataFromCases === 'function';

    var escapeHtml = port('escapeHtml', function(value) {
      return value === null || value === undefined ? '' : String(value);
    });
    var escapeHtmlPreserve = port('escapeHtmlPreserve', escapeHtml);
    var ensureTempExecColumns = port('ensureTempExecColumns', function() { return {}; });
    var scrollElementIntoView = port('scrollElementIntoView');
    var getTempExecFile = port('getTempExecFile', function(fileId) {
      return (state.tempExecFiles || []).find(function(file) {
        return file && String(file.id) === String(fileId);
      }) || null;
    });
    var resolveProjectName = port('resolveProjectName', function(value) { return String(value || ''); });
    var resolveVersionName = port('resolveVersionName', function(projectId, value) { return String(value || ''); });
    var ensureTempExecAssociationRows = port('ensureTempExecAssociationRows');
    var snapshotTempExecSearchFocus = port('snapshotTempExecSearchFocus', function() { return null; });
    var restoreTempExecSearchFocus = port('restoreTempExecSearchFocus');
    var renderTempExecToolbar = port('renderTempExecToolbar');
    var clearTempExecMissingReminder = port('clearTempExecMissingReminder');
    var renderTempExecMissingReminderBlock = port('renderTempExecMissingReminderBlock', function() { return ''; });
    var resolveMissingReminderPlacement = port('resolveMissingReminderPlacement', function() { return 'top'; });
    var bindMissingReminderScrollHint = port('bindMissingReminderScrollHint');
    var syncTempExecCaseLibraryChangesButton = port('syncTempExecCaseLibraryChangesButton');
    var renderTempExecOverview = port('renderTempExecOverview');
    var requestTempExecMissingReminderRefresh = port('requestTempExecMissingReminderRefresh');
    var resolveMissingReminderAiEnabled = port('resolveMissingReminderAiEnabled', function() { return 'off'; });
    var scheduleTempExecMissingReminderLazyLoad = port('scheduleTempExecMissingReminderLazyLoad');
    var getTempExecPageSize = port('getTempExecPageSize', function() { return 20; });
    var getCaseExecutionStatus = port('getCaseExecutionStatus', function(file, item) {
      return item && item.actual ? item.actual : '未执行';
    });
    var mapFilterToStatus = port('mapFilterToStatus', function(matchKey, status) { return matchKey === status; });
    var ensureTempExecSelection = port('ensureTempExecSelection', function() { return new Set(); });
    var ensureTempExecRemarkOpen = port('ensureTempExecRemarkOpen', function() { return new Set(); });
    var ensureTempExecReuseOpen = port('ensureTempExecReuseOpen', function() { return new Set(); });
    var ensureTempExecDefectOpen = port('ensureTempExecDefectOpen', function() { return new Set(); });
    var ensureTempExecPageIndex = port('ensureTempExecPageIndex', function() { return 0; });
    var getCaseExecutionDisplay = port('getCaseExecutionDisplay', function(file, item) {
      return { label: item && item.actual ? item.actual : '未执行', className: 'status-pending' };
    });
    var aggregateReuseDetails = port('aggregateReuseDetails', function() { return { pending: 0 }; });
    var renderReuseEntries = port('renderReuseEntries', function() { return ''; });
    var isTempExecNewAdded = port('isTempExecNewAdded', function() { return false; });
    var renderReusePresetPanel = port('renderReusePresetPanel', function() { return ''; });
    var buildTempExecSummary = port('buildTempExecSummary', function() { return {}; });

    function emToPx(value) {
      var num = Number(value);
      if (!Number.isFinite(num)) return 0;
      var px = num * caseViewBaseFontSize;
      return Math.round(px * 100) / 100;
    }

    function isRequiredTempExecColumn(key) {
      return key === 'select' || key === 'title' || key === 'actual' || key === 'remark' || key === 'defect' || key === 'ops';
    }

    function scrollTempExecViewTop() {
      var target = tempExecView || tempExecViewSection;
      if (target) scrollElementIntoView(target, 'smooth', 140);
    }

    function syncTempExecReuseStatusAlign() {
      if (!tempExecView || !tempExecView.querySelectorAll) return;
      if (tempExecView.classList && tempExecView.classList.contains('hidden')) return;
      var tables = tempExecView.querySelectorAll('table');
      if (!tables.length) return;
      tables.forEach(function(table) {
        if (!table || !table.querySelectorAll) return;
        var targetEl = table.querySelector('tbody tr.case-row td.actual .reuse-status')
          || table.querySelector('tbody tr.case-row td.actual .status-select')
          || table.querySelector('thead th.actual');
        if (!targetEl || !targetEl.getBoundingClientRect) return;
        var targetRect = targetEl.getBoundingClientRect();
        if (!targetRect || !targetRect.width) return;
        var targetCenter = targetRect.left + targetRect.width / 2;
        var selects = table.querySelectorAll('.reuse-panel .reuse-entry .status-select');
        selects.forEach(function(select) {
          if (!select || !select.getBoundingClientRect) return;
          if (select.offsetParent === null) {
            if (select.style) select.style.transform = '';
            if (select.closest) {
              var hiddenEntry = select.closest('.reuse-entry');
              if (hiddenEntry && hiddenEntry.style) hiddenEntry.style.removeProperty('--reuse-status-shift');
            }
            return;
          }
          var rect = select.getBoundingClientRect();
          if (!rect || !rect.width) return;
          var delta = targetCenter - (rect.left + rect.width / 2);
          if (!Number.isFinite(delta)) return;
          if (Math.abs(delta) < 0.5) {
            if (select.style) select.style.transform = '';
            if (select.closest) {
              var nearEntry = select.closest('.reuse-entry');
              if (nearEntry && nearEntry.style) nearEntry.style.removeProperty('--reuse-status-shift');
            }
            return;
          }
          var rounded = Math.round(delta);
          if (select.style) select.style.transform = 'translateX(' + rounded + 'px)';
          if (select.closest) {
            var entry = select.closest('.reuse-entry');
            if (entry && entry.style) entry.style.setProperty('--reuse-status-shift', rounded + 'px');
          }
        });
        var syncButtons = table.querySelectorAll('.reuse-panel .reuse-actions .reuse-sync');
        syncButtons.forEach(function(button) {
          if (!button || !button.getBoundingClientRect) return;
          if (button.offsetParent === null) {
            if (button.style) button.style.transform = '';
            return;
          }
          var btnRect = button.getBoundingClientRect();
          if (!btnRect || !btnRect.width) return;
          var delta = targetCenter - (btnRect.left + btnRect.width / 2);
          if (!Number.isFinite(delta)) return;
          if (Math.abs(delta) < 0.5) {
            if (button.style) button.style.transform = '';
            return;
          }
          if (button.style) button.style.transform = 'translateX(' + Math.round(delta) + 'px)';
        });
      });
    }

    function normalizeTempExecAssociationDisplayName(raw, fallback) {
      var text = raw === null || raw === undefined ? '' : String(raw);
      text = text.replace(/\s+/g, ' ').trim();
      return text || fallback || '';
    }

    function resolveTempExecMainComposeCount(file, associationRows) {
      if (!file || !file.associationEnabled) return 0;
      var cases = Array.isArray(file.cases) ? file.cases : [];
      if (cases.length && !file._casesLoading) {
        var mainCount = 0;
        cases.forEach(function(item) {
          if (!item) return;
          var caseItemId = item.caseItemId;
          if (caseItemId === null || caseItemId === undefined) caseItemId = item.case_item_id;
          var sourceId = item.caseItemSourceId;
          if (sourceId === null || sourceId === undefined) sourceId = item.case_item_source_id;
          if (!((caseItemId === null || caseItemId === undefined) && !(sourceId === null || sourceId === undefined))) {
            mainCount += 1;
          }
        });
        return mainCount;
      }
      var total = Number(file.caseCount);
      if (!Number.isFinite(total) || total < 0) return 0;
      var subCount = 0;
      (Array.isArray(associationRows) ? associationRows : []).forEach(function(row) {
        if (!row) return;
        var count = Number(row.selected_count);
        if (!Number.isFinite(count) || count < 0) {
          count = Array.isArray(row.selected_case_item_ids) ? row.selected_case_item_ids.length : 0;
        }
        subCount += Math.max(0, count);
      });
      return Math.max(0, Math.round(total - subCount));
    }

    function buildTempExecAssociationComposeParts(file) {
      if (!file || !file.associationEnabled) return [];
      var rows = Array.isArray(file.associationRows) ? file.associationRows : [];
      if (!rows.length) return [];
      var mainFallback = file.caseFileId ? ('用例#' + String(file.caseFileId)) : '当前用例';
      var parts = [{
        name: normalizeTempExecAssociationDisplayName(file.name, mainFallback),
        role: '主',
        count: resolveTempExecMainComposeCount(file, rows),
      }];
      rows.forEach(function(row) {
        if (!row) return;
        var subId = row.sub_case_file_id || '';
        var count = Number(row.selected_count);
        if (!Number.isFinite(count) || count < 0) {
          count = Array.isArray(row.selected_case_item_ids) ? row.selected_case_item_ids.length : 0;
        }
        parts.push({
          name: normalizeTempExecAssociationDisplayName(row.sub_case_file_name, subId ? ('用例#' + String(subId)) : '副用例'),
          role: '副',
          count: count,
        });
      });
      return parts;
    }

    function renderTempExecAssociationComposeHtml(file) {
      var parts = buildTempExecAssociationComposeParts(file);
      if (!parts.length) return '';
      var out = [];
      parts.forEach(function(part, index) {
        var role = part && part.role ? String(part.role) : '';
        var roleClass = role === '主' ? ' main' : ' sub';
        out.push(
          '<span class="temp-exec-combo-item' + roleClass + '">' +
            '<span class="temp-exec-combo-name">' + escapeHtml(part && part.name ? part.name : '') + '</span>' +
            '<span class="temp-exec-combo-role">' + escapeHtml('（' + role + '）') + '</span>' +
            '<span class="temp-exec-combo-count">' + escapeHtml(String(part.count) + '条') + '</span>' +
          '</span>'
        );
        if (index < parts.length - 1) out.push('<span class="temp-exec-combo-sep" aria-hidden="true">+</span>');
      });
      return out.join('');
    }

    function buildTempExecPagination(file, totalCases, pageIndex, totalPages, start, end) {
      var pageSize = getTempExecPageSize();
      var displayStart = totalCases ? start + 1 : 0;
      var displayEnd = totalCases ? Math.min(end, totalCases) : 0;
      var maxPage = Math.max(totalPages, 1);
      var currentPage = totalPages ? pageIndex + 1 : 1;
      var rangeInfo = totalCases ? '显示 ' + displayStart + '-' + displayEnd + ' / ' + totalCases + ' 条' : '暂无用例';
      return (
        '<div class="temp-pagination">' +
          '<div class="temp-pagination-info">' + rangeInfo + '，每页 ' + pageSize + ' 条</div>' +
          '<div class="temp-pagination-controls">' +
            '<button type="button" class="secondary" data-temp-page-action="' + file.id + '" data-action="prev" ' + (pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
            '<span>第 ' + currentPage + ' / ' + maxPage + ' 页</span>' +
            '<button type="button" class="secondary" data-temp-page-action="' + file.id + '" data-action="next" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
            '<label>跳至<input type="number" min="1" max="' + maxPage + '" value="' + Math.min(currentPage, maxPage) + '" data-temp-page-input="' + file.id + '">页</label>' +
          '</div>' +
        '</div>'
      );
    }

    function renderDefectLinks(caseItem, fileId, caseIndex) {
      var links = Array.isArray(caseItem && caseItem.defectLinks) ? caseItem.defectLinks : [];
      if (!links.length) return '<p class="reuse-empty">暂无缺陷链接，点击下方“＋ 添加链接”。</p>';
      return '<div class="defect-list">' + links.map(function(link) {
        return (
          '<div class="defect-entry" data-link="' + link.id + '">' +
            '<input type="url" placeholder="粘贴缺陷链接..." value="' + escapeHtml(link.url || '') + '" data-temp-defect-link="' + fileId + '" data-index="' + caseIndex + '" data-link="' + link.id + '">' +
            '<button type="button" class="defect-open" data-temp-defect-open="' + fileId + '" data-index="' + caseIndex + '" data-link="' + link.id + '">打开</button>' +
            '<button type="button" class="defect-remove" data-temp-defect-remove="' + fileId + '" data-index="' + caseIndex + '" data-link="' + link.id + '">删除</button>' +
          '</div>'
        );
      }).join('') + '</div>';
    }

    function renderTempExecTable(file) {
      var searchState = state.tempExecSearch || { fileId: '', term: '', raw: '' };
      var searchTerm = searchState.fileId === file.id ? (searchState.term || '') : '';
      var statusFilter = state.tempExecStatusFilter || { fileId: '', status: '' };
      var hasFilter = statusFilter.fileId === file.id && statusFilter.status;
      var cases = Array.isArray(file && file.cases) ? file.cases : [];
      var matches = cases.map(function(item, idx) { return { item: item, idx: idx }; }).filter(function(entry) {
        var status = getCaseExecutionStatus(file, entry.item);
        if (hasFilter && !mapFilterToStatus(statusFilter.status, status)) return false;
        if (!searchTerm) return true;
        var target = [
          entry.item.module,
          entry.item.title,
          entry.item.priority,
          entry.item.preconditions,
          entry.item.steps,
          entry.item.expected,
          entry.item.remark,
        ].map(function(text) { return (text || '').toString().toLowerCase(); }).join(' ');
        return target.indexOf(searchTerm) !== -1;
      });
      var matchIndexes = matches.map(function(entry) { return entry.idx; });
      var selection = ensureTempExecSelection(file.id);
      var remarkOpenSet = ensureTempExecRemarkOpen(file.id);
      var reuseOpenSet = ensureTempExecReuseOpen(file.id);
      var defectOpenSet = ensureTempExecDefectOpen(file.id);
      var reuseEnabled = Boolean(file.reuseEnabled);
      var pageSize = getTempExecPageSize();
      var totalCases = matches.length;
      var totalPages = totalCases ? Math.ceil(totalCases / pageSize) : 1;
      var pageIndex = ensureTempExecPageIndex(file.id);
      if (pageIndex >= totalPages) {
        pageIndex = Math.max(totalPages - 1, 0);
        if (!state.tempExecPages || typeof state.tempExecPages !== 'object') state.tempExecPages = {};
        state.tempExecPages[file.id] = pageIndex;
      }
      var start = pageIndex * pageSize;
      var end = Math.min(totalCases, start + pageSize);
      var columns = ensureTempExecColumns();
      var show = function(key) { return isRequiredTempExecColumn(key) ? true : columns[key] !== false; };
      var columnOrder = ['select', 'index', 'module', 'title', 'priority', 'preconditions', 'steps', 'expected', 'actual', 'remark', 'defect', 'ops'];
      var visibleKeys = columnOrder.filter(show);
      var colCount = visibleKeys.length || 1;
      var baseEm = { module: 8, title: 9, priority: 5, preconditions: 12, steps: 14, expected: 14 };
      var stretchKeys = Object.keys(baseEm).filter(function(key) { return key !== 'priority'; });
      var hiddenEm = 0;
      Object.keys(baseEm).forEach(function(key) { if (!show(key)) hiddenEm += Number(baseEm[key]) || 0; });
      if (!show('index')) hiddenEm += 4;
      var stretchVisible = stretchKeys.filter(show);
      var extraEm = stretchVisible.length ? hiddenEm / stretchVisible.length : 0;
      var widthByKey = {
        select: '36px',
        index: '50px',
        actual: emToPx(7) + 'px',
        remark: emToPx(6) + 'px',
        defect: emToPx(6) + 'px',
        ops: '40px',
      };
      stretchVisible.forEach(function(key) {
        widthByKey[key] = emToPx(Math.round(((Number(baseEm[key]) || 0) + extraEm) * 100) / 100) + 'px';
      });
      if (show('priority')) widthByKey.priority = emToPx(Number(baseEm.priority) || 5) + 'px';
      var colgroup = '<colgroup>' + visibleKeys.map(function(key) {
        return widthByKey[key] ? '<col style="width:' + widthByKey[key] + '">' : '<col>';
      }).join('') + '</colgroup>';
      var visibleIndexes = [];
      var paged = matches.filter(function(entry, index) { return index >= start && index < end; });
      var rows = paged.map(function(entry) {
        var item = entry.item;
        var idx = entry.idx;
        visibleIndexes.push(idx);
        var editPlaceholder = '点击此处编辑';
        var moduleHtml = escapeHtml(item.module || '-');
        var titleHtml = item.title ? escapeHtml(item.title) : '';
        var priorityHtml = item.priority ? escapeHtml(item.priority) : '';
        var preHtml = item.preconditions ? escapeHtml(item.preconditions).replace(/\n/g, '<br>') : '';
        var stepsHtml = item.steps ? escapeHtml(item.steps).replace(/\n/g, '<br>') : '';
        var expectedHtml = item.expected ? escapeHtml(item.expected).replace(/\n/g, '<br>') : '';
        var remarkOpen = remarkOpenSet.has(idx);
        var reuseOpen = reuseOpenSet.has(idx);
        var hasRemark = Boolean(item.remark && item.remark.trim());
        var remarkBtnClass = ['remark-toggle'];
        if (remarkOpen) remarkBtnClass.push('active');
        if (hasRemark) remarkBtnClass.push('filled');
        var defectOpen = defectOpenSet.has(idx);
        var hasDefects = Array.isArray(item.defectLinks) && item.defectLinks.length;
        var defectBtnClass = ['defect-toggle'];
        if (defectOpen) defectBtnClass.push('active');
        if (hasDefects) defectBtnClass.push('filled');
        var currentStatus = item && item.actual ? String(item.actual).trim() : '未执行';
        if (currentStatus === 'pending') currentStatus = '未执行';
        var resultOptions = '';
        if (currentStatus === '变更重跑' || currentStatus === '有改动') {
          resultOptions += '<option value="' + escapeHtml(currentStatus) + '" selected disabled>' + escapeHtml(currentStatus) + '</option>';
        }
        resultOptions += tempExecResultOptions.map(function(resultOption) {
          return '<option value="' + resultOption + '" ' + (currentStatus === resultOption ? 'selected' : '') + '>' + resultOption + '</option>';
        }).join('');
        var reuseStatus = getCaseExecutionDisplay(file, item);
        var pendingReuseCount = 0;
        if (reuseEnabled && !reuseOpen) {
          var details = Array.isArray(item.reuseDetails) ? item.reuseDetails : [];
          if (details.length) pendingReuseCount = aggregateReuseDetails(details).pending || 0;
        }
        var reusePendingBadge = pendingReuseCount > 0
          ? '<span class="reuse-pending-badge" data-reuse-pending="' + pendingReuseCount + '">' + pendingReuseCount + '</span>'
          : '';
        var actualCell = reuseEnabled
          ? '<td class="reuse-cell actual"><button type="button" class="reuse-status ' + reuseStatus.className + '" data-temp-reuse-panel="' + file.id + '" data-index="' + idx + '">' + escapeHtml(reuseStatus.label) + reusePendingBadge + '</button></td>'
          : '<td class="actual"><select class="status-select" data-temp-result="' + file.id + '" data-index="' + idx + '" data-status="' + item.actual + '">' + resultOptions + '</select></td>';
        var cells = [];
        visibleKeys.forEach(function(key) {
          if (key === 'select') {
            cells.push('<td class="check"><input type="checkbox" data-temp-select="' + file.id + '" data-index="' + idx + '" ' + (selection.has(idx) ? 'checked' : '') + '></td>');
          } else if (key === 'index') {
            cells.push('<td class="index">' + (idx + 1) + '</td>');
          } else if (key === 'module') {
            cells.push('<td class="module">' + moduleHtml + '</td>');
          } else if (key === 'title') {
            cells.push('<td class="title"><div class="temp-inline-edit" contenteditable="true" data-temp-edit-field="title" data-temp-edit-file="' + file.id + '" data-temp-edit-index="' + idx + '" data-temp-edit-multiline="false" data-placeholder="' + editPlaceholder + '">' + titleHtml + '</div></td>');
          } else if (key === 'priority') {
            cells.push('<td><div class="temp-inline-edit" contenteditable="true" data-temp-edit-field="priority" data-temp-edit-file="' + file.id + '" data-temp-edit-index="' + idx + '" data-temp-edit-multiline="false" data-placeholder="' + editPlaceholder + '">' + priorityHtml + '</div></td>');
          } else if (key === 'preconditions') {
            cells.push('<td><div class="temp-inline-edit" contenteditable="true" data-temp-edit-field="preconditions" data-temp-edit-file="' + file.id + '" data-temp-edit-index="' + idx + '" data-temp-edit-multiline="true" data-placeholder="' + editPlaceholder + '">' + preHtml + '</div></td>');
          } else if (key === 'steps') {
            cells.push('<td><div class="temp-inline-edit" contenteditable="true" data-temp-edit-field="steps" data-temp-edit-file="' + file.id + '" data-temp-edit-index="' + idx + '" data-temp-edit-multiline="true" data-placeholder="' + editPlaceholder + '">' + stepsHtml + '</div></td>');
          } else if (key === 'expected') {
            cells.push('<td><div class="temp-inline-edit" contenteditable="true" data-temp-edit-field="expected" data-temp-edit-file="' + file.id + '" data-temp-edit-index="' + idx + '" data-temp-edit-multiline="true" data-placeholder="' + editPlaceholder + '">' + expectedHtml + '</div></td>');
          } else if (key === 'actual') {
            cells.push(actualCell);
          } else if (key === 'remark') {
            cells.push('<td><button type="button" class="' + remarkBtnClass.join(' ') + '" data-temp-remark-toggle="' + file.id + '" data-index="' + idx + '">' + (hasRemark ? '备注已填' : '备注') + '</button></td>');
          } else if (key === 'defect') {
            cells.push('<td><button type="button" class="' + defectBtnClass.join(' ') + '" data-temp-defect-toggle="' + file.id + '" data-index="' + idx + '">' + (hasDefects ? '链接已填' : '缺陷链接') + '</button></td>');
          } else if (key === 'ops') {
            cells.push('<td class="case-op-col"><div class="case-ops"><button type="button" class="case-op remove" title="删除当前用例" data-temp-case-remove="' + file.id + '" data-index="' + idx + '">−</button><button type="button" class="case-op add" title="在下方插入空用例" data-temp-case-insert="' + file.id + '" data-index="' + idx + '">＋</button></div></td>');
          }
        });
        var reuseActions = reuseEnabled
          ? '<div class="reuse-actions"><button type="button" class="reuse-add" data-temp-reuse-add="' + file.id + '" data-index="' + idx + '">＋ 添加测试项</button><button type="button" class="reuse-sync" data-temp-reuse-sync="' + file.id + '" data-index="' + idx + '">同步结果</button></div>'
          : '';
        var placeholderHeight = 0;
        if (!reuseOpen && state.tempExecReusePlaceholders && state.tempExecReusePlaceholders[file.id]) {
          var parsedHeight = Number(state.tempExecReusePlaceholders[file.id][String(idx)]);
          if (Number.isFinite(parsedHeight) && parsedHeight > 0) placeholderHeight = Math.round(parsedHeight);
        }
        var reuseRow = '';
        if (reuseEnabled) {
          if (reuseOpen) {
            reuseRow = '<tr class="reuse-row visible" data-temp-reuse-row="' + escapeHtml(file.id) + '" data-index="' + idx + '"><td colspan="' + colCount + '"><div class="reuse-panel" data-temp-reuse-panel-container="' + file.id + '" data-index="' + idx + '">' + renderReuseEntries(file, item, idx) + reuseActions + '</div></td></tr>';
          } else if (placeholderHeight) {
            reuseRow = '<tr class="reuse-row placeholder" data-temp-reuse-row="' + escapeHtml(file.id) + '" data-index="' + idx + '"><td colspan="' + colCount + '"><div class="reuse-placeholder" style="height:' + placeholderHeight + 'px;"></div></td></tr>';
          } else {
            reuseRow = '<tr class="reuse-row" data-temp-reuse-row="' + escapeHtml(file.id) + '" data-index="' + idx + '"><td colspan="' + colCount + '"></td></tr>';
          }
        }
        var rowClassParts = ['case-row'];
        if (isTempExecNewAdded(file.id, item)) rowClassParts.push('new-added');
        var caseItemId = item && item.caseItemId;
        if (caseItemId === null || caseItemId === undefined) caseItemId = item && item.case_item_id !== undefined ? item.case_item_id : null;
        var caseItemSourceId = item && item.caseItemSourceId;
        if (caseItemSourceId === null || caseItemSourceId === undefined) caseItemSourceId = item && item.case_item_source_id !== undefined ? item.case_item_source_id : null;
        if (file.associationEnabled && (caseItemId === null || caseItemId === undefined) && !(caseItemSourceId === null || caseItemSourceId === undefined)) {
          rowClassParts.push('association-sub');
        }
        return (
          '<tr class="' + rowClassParts.join(' ') + '" data-temp-case-row="' + file.id + '" data-index="' + idx + '">' + cells.join('') + '</tr>' +
          reuseRow +
          '<tr class="remark-row ' + (remarkOpen ? 'visible' : '') + '"><td colspan="' + colCount + '"><textarea class="remark-panel" data-temp-remark="' + file.id + '" data-index="' + idx + '" placeholder="填写执行说明...">' + escapeHtmlPreserve(item.remark) + '</textarea></td></tr>' +
          '<tr class="defect-row ' + (defectOpen ? 'visible' : '') + '"><td colspan="' + colCount + '"><div class="defect-panel" data-temp-defect-panel="' + file.id + '" data-index="' + idx + '">' + renderDefectLinks(item, file.id, idx) + '<button type="button" class="defect-add" data-temp-defect-add="' + file.id + '" data-index="' + idx + '">＋ 添加链接</button></div></td></tr>'
        );
      }).join('');
      var allVisibleSelected = visibleIndexes.length && visibleIndexes.every(function(index) { return selection.has(index); });
      var headerCheckbox = show('select')
        ? '<th class="check"><input type="checkbox" data-temp-select-all="' + file.id + '" data-temp-visible="' + visibleIndexes.join(',') + '" ' + (visibleIndexes.length ? (allVisibleSelected ? 'checked' : '') : 'disabled') + '></th>'
        : '';
      var emptyRow = visibleIndexes.length ? '' : '<tr><td colspan="' + colCount + '">' + (cases.length ? '当前页暂无用例' : '未解析到有效用例') + '</td></tr>';
      var summary = buildTempExecSummary(file);
      var placeholderMap = state.tempExecReusePlaceholders && state.tempExecReusePlaceholders[file.id]
        ? state.tempExecReusePlaceholders[file.id]
        : null;
      var allMatchedReuseOpen = reuseEnabled && matchIndexes.length > 0 && matchIndexes.every(function(index) {
        return reuseOpenSet.has(index) || Boolean(placeholderMap && placeholderMap[String(index)] !== undefined);
      });
      var expandedMap = state.tempExecReuseBatchExpanded && typeof state.tempExecReuseBatchExpanded === 'object'
        ? state.tempExecReuseBatchExpanded
        : null;
      var remembered = Boolean(expandedMap && Object.prototype.hasOwnProperty.call(expandedMap, file.id));
      var batchExpanded = remembered ? Boolean(expandedMap[file.id]) : allMatchedReuseOpen;
      var reuseBatchToggle = reuseEnabled
        ? '<button type="button" class="secondary temp-reuse-expand-toggle" data-temp-reuse-toggle-all="' + file.id + '" data-temp-visible="' + escapeHtml(matchIndexes.join(',')) + '" data-temp-expanded="' + (batchExpanded ? '1' : '0') + '"' + (matchIndexes.length ? '' : ' disabled') + '>' + (batchExpanded ? '收起所有子项' : '展开所有子项') + '</button>'
        : '';
      var reuseToggle = '<div class="temp-reuse-toggle"><div class="temp-reuse-toggle-main"><label><input type="checkbox" data-temp-reuse-toggle="' + file.id + '" ' + (reuseEnabled ? 'checked' : '') + '><span>用例复用</span></label><span class="hint">' + (reuseEnabled ? '可为单条用例补充多条执行记录' : '开启后可为用例记录多条执行项') + '</span></div>' + reuseBatchToggle + '</div>';
      var presetPanel = reuseEnabled ? renderReusePresetPanel(file) : '';
      var paginationBlock = buildTempExecPagination(file, totalCases, pageIndex, totalPages, start, end);
      var headerCells = [];
      if (headerCheckbox) headerCells.push(headerCheckbox);
      if (show('index')) headerCells.push('<th class="index">编号</th>');
      if (show('module')) headerCells.push('<th class="module">模块</th>');
      headerCells.push('<th class="title">用例标题</th>');
      if (show('priority')) headerCells.push('<th>优先级</th>');
      if (show('preconditions')) headerCells.push('<th>前提条件</th>');
      if (show('steps')) headerCells.push('<th>操作步骤</th>');
      if (show('expected')) headerCells.push('<th>预期结果</th>');
      headerCells.push('<th class="actual">实际结果</th>');
      headerCells.push('<th>备注</th>');
      headerCells.push('<th>缺陷链接</th>');
      if (show('ops')) headerCells.push('<th class="ops" title="增删">增删</th>');
      return (
        reuseToggle + presetPanel + paginationBlock +
        '<table data-resizable-id="temp-exec-' + escapeHtml(file.id) + '" data-resizable-label="执行视图 - ' + escapeHtml(file.name || '测试用例') + '">' +
          colgroup + '<thead><tr>' + headerCells.join('') + '</tr></thead><tbody>' + (rows || emptyRow) + '</tbody>' +
        '</table>' + paginationBlock
      );
    }

    function renderTempExecView() {
      if (!tempExecView) return;
      var searchFocusSnapshot = snapshotTempExecSearchFocus();
      var preserveScroll = Boolean(state.tempExecPreserveScrollOnce);
      var scrollSnapshot = null;
      if (preserveScroll && windowRef && tempExecView.getBoundingClientRect) {
        scrollSnapshot = {
          top: tempExecView.getBoundingClientRect().top,
          scrollY: windowRef.pageYOffset || (documentRef && documentRef.documentElement ? documentRef.documentElement.scrollTop : 0) || 0,
        };
      }
      function restoreScroll() {
        if (!preserveScroll) return;
        state.tempExecPreserveScrollOnce = false;
        if (!scrollSnapshot || !tempExecView.getBoundingClientRect) return;
        var delta = tempExecView.getBoundingClientRect().top - scrollSnapshot.top;
        if (Math.abs(delta) > 1 && windowRef && windowRef.scrollTo) windowRef.scrollTo(0, scrollSnapshot.scrollY + delta);
      }
      var active = getTempExecFile(state.tempExecActiveId);
      if (active) {
        state.tempExecLastActiveContext = {
          projectId: active.projectId ? String(active.projectId) : '',
          versionId: active.versionId !== null && active.versionId !== undefined ? String(active.versionId || '') : '',
        };
      }
      var context = state.tempExecLastActiveContext && typeof state.tempExecLastActiveContext === 'object'
        ? state.tempExecLastActiveContext
        : null;
      var projectId = active && active.projectId ? String(active.projectId) : (context && context.projectId ? String(context.projectId) : '');
      var versionId = active && active.versionId !== null && active.versionId !== undefined
        ? String(active.versionId || '')
        : (context && context.versionId !== null && context.versionId !== undefined ? String(context.versionId || '') : '');
      var projectName = projectId ? resolveProjectName(projectId) : '';
      var versionName = projectId && versionId ? resolveVersionName(projectId, versionId) : '';
      if (active) ensureTempExecAssociationRows(active);
      var comboHtml = renderTempExecAssociationComposeHtml(active);
      var contextHtml = '';
      var ownerText = '';
      if (projectName) ownerText += '项目 ' + escapeHtml(projectName);
      if (versionName) ownerText += (ownerText ? ' / ' : '') + '版本 ' + escapeHtml(versionName);
      if (ownerText) {
        contextHtml += '<div class="temp-exec-context"><span class="temp-exec-context-label">当前用例归属：</span><span class="temp-exec-context-kv">' + ownerText + '</span></div>';
      }
      if (comboHtml) {
        contextHtml += '<div class="temp-exec-context temp-exec-context-combo"><span class="temp-exec-context-label">当前用例组合：</span><span class="temp-exec-context-kv temp-exec-context-combo-line">' + comboHtml + '</span></div>';
      }
      if (!active) {
        renderTempExecToolbar(null);
        clearTempExecMissingReminder();
        tempExecView.innerHTML = contextHtml + '<div class="temp-case-empty">暂无执行用例，请通过“用例导入”抽屉导入，或在“执行分配”中选择历史记录</div>';
        if (tempExecMindContainer) tempExecMindContainer.classList.add('hidden');
        state.tempExecMindMode = false;
        if (exportTempExecBtn) exportTempExecBtn.disabled = true;
        if (exportTempExecXmindBtn) exportTempExecXmindBtn.disabled = true;
        if (tempExecXmindViewBtn) tempExecXmindViewBtn.disabled = true;
        if (tempExecCaseLibraryChangesBtn) tempExecCaseLibraryChangesBtn.disabled = true;
        if (tempExecMindBtn) {
          tempExecMindBtn.disabled = true;
          tempExecMindBtn.textContent = '切换思维导图视图';
        }
        tempExecView.classList.remove('hidden');
        restoreScroll();
        restoreTempExecSearchFocus(searchFocusSnapshot);
        return;
      }
      renderTempExecToolbar(active);
      var reminderHtml = '<div data-temp-missing-reminder-slot="1">'
        + renderTempExecMissingReminderBlock()
        + '</div>';
      tempExecView.innerHTML = resolveMissingReminderPlacement() === 'bottom'
        ? contextHtml + renderTempExecTable(active) + reminderHtml
        : contextHtml + reminderHtml + renderTempExecTable(active);
      bindMissingReminderScrollHint(tempExecView);
      if (state.tempExecMindMode && tempExecMindContainer) {
        tempExecMindContainer.innerHTML = '';
        tempExecMindContainer.classList.remove('hidden');
        tempExecView.classList.add('hidden');
        if (tempExecMindBtn) tempExecMindBtn.textContent = '返回列表视图';
      } else if (tempExecMindContainer) {
        tempExecMindContainer.classList.add('hidden');
        tempExecView.classList.remove('hidden');
        if (tempExecMindBtn) tempExecMindBtn.textContent = '切换思维导图视图';
      }
      if (exportTempExecBtn) exportTempExecBtn.disabled = false;
      if (exportTempExecXmindBtn) exportTempExecXmindBtn.disabled = false;
      if (exportTempExecCasesXmindBtn) exportTempExecCasesXmindBtn.disabled = false;
      if (tempExecXmindViewBtn) tempExecXmindViewBtn.disabled = !(casesHaveItems(active) && canBuildMindData);
      if (tempExecMindBtn) tempExecMindBtn.disabled = false;
      syncTempExecCaseLibraryChangesButton(active);
      renderTempExecOverview();
      syncTempExecReuseStatusAlign();
      requestTempExecMissingReminderRefresh();
      if (resolveMissingReminderAiEnabled() !== 'on') scheduleTempExecMissingReminderLazyLoad();
      restoreScroll();
      restoreTempExecSearchFocus(searchFocusSnapshot);
    }

    function casesHaveItems(file) {
      return Boolean(file && Array.isArray(file.cases) && file.cases.length);
    }

    return {
      isRequiredTempExecColumn: isRequiredTempExecColumn,
      scrollTempExecViewTop: scrollTempExecViewTop,
      syncTempExecReuseStatusAlign: syncTempExecReuseStatusAlign,
      normalizeTempExecAssociationDisplayName: normalizeTempExecAssociationDisplayName,
      resolveTempExecMainComposeCount: resolveTempExecMainComposeCount,
      buildTempExecAssociationComposeParts: buildTempExecAssociationComposeParts,
      renderTempExecAssociationComposeHtml: renderTempExecAssociationComposeHtml,
      buildTempExecPagination: buildTempExecPagination,
      renderDefectLinks: renderDefectLinks,
      renderTempExecTable: renderTempExecTable,
      renderTempExecView: renderTempExecView,
    };
  }

  return { create: create };
});
