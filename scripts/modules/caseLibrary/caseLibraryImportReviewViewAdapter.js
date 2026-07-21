(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.importReviewViewAdapter = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var escapeHtml = typeof opts.escapeHtml === 'function'
      ? opts.escapeHtml
      : function(value) { return String(value === null || value === undefined ? '' : value); };
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var normalizePriority = typeof opts.normalizePriority === 'function'
      ? opts.normalizePriority
      : function(value) { return String(value || '').trim(); };
    var debounce = typeof opts.debounce === 'function' ? opts.debounce : null;
    var locateHighlightTimer = null;
    var locateBound = false;
    var editBound = false;

    function setInvalidStatus(text, type) {
      setStatus(dom.importInvalidStatus, text || '', type || '');
    }

    function setDiffStatus(text, type) {
      setStatus(dom.importDiffStatus, text || '', type || '');
    }

    function syncInvalidControls(state) {
      if (!dom.importInvalidConfirmBtn) return;
      var source = state && typeof state === 'object' ? state : {};
      var items = Array.isArray(source.items) ? source.items : [];
      dom.importInvalidConfirmBtn.disabled = Boolean(source.loading || !items.length);
    }

    function syncDiffControls(state) {
      if (!dom.importDiffOverwriteBtn) return;
      var source = state && typeof state === 'object' ? state : {};
      var mode = source.mode ? String(source.mode) : 'import';
      var can = false;
      if (mode === 'append_overwrite') {
        can = Boolean(
          !source.loading &&
          !source.confirming &&
          source.caseFileId &&
          Array.isArray(source.importItems) &&
          source.importItems.length
        );
      } else {
        can = Boolean(
          !source.loading &&
          !source.confirming &&
          source.projectId &&
          source.importVersionId &&
          source.fileName &&
          Array.isArray(source.importItems) &&
          source.importItems.length
        );
      }
      dom.importDiffOverwriteBtn.disabled = !can;
    }

    function clearLocateHighlight() {
      if (locateHighlightTimer) clearTimeout(locateHighlightTimer);
      locateHighlightTimer = null;
      if (!dom.importInvalidBody || !dom.importInvalidBody.querySelectorAll) return;
      var active = dom.importInvalidBody.querySelectorAll('tr.import-invalid-locate-active');
      Array.prototype.forEach.call(active, function(row) {
        if (row && row.classList) row.classList.remove('import-invalid-locate-active');
      });
    }

    function getInvalidRows() {
      if (!dom.importInvalidBody || !dom.importInvalidBody.querySelectorAll) return [];
      var rows = Array.prototype.slice.call(dom.importInvalidBody.querySelectorAll('tr'));
      return rows.filter(function(row) {
        return row && row.querySelector && row.querySelector('td.invalid-cell');
      });
    }

    function isAnyInvalidRowInView(rows, containerEl) {
      var list = Array.isArray(rows) ? rows : [];
      if (!list.length || !containerEl || !containerEl.getBoundingClientRect) return false;
      var rect = containerEl.getBoundingClientRect();
      var top = rect.top + 60;
      var bottom = rect.bottom - 40;
      for (var i = 0; i < list.length; i += 1) {
        var row = list[i];
        if (!row || !row.getBoundingClientRect) continue;
        var rowRect = row.getBoundingClientRect();
        if (rowRect.bottom > top && rowRect.top < bottom) return true;
      }
      return false;
    }

    function buildLocateBarHtml(state) {
      if (!dom.importInvalidLocateBar) return '';
      var rows = getInvalidRows();
      var total = rows.length;
      if (!total) {
        return '<div class="diff-locate-info">缺失字段定位</div>' +
          '<div class="diff-locate-empty">暂无缺失字段</div>';
      }
      var current = Number.isInteger(state.locateIndex) ? state.locateIndex : -1;
      if (current >= total) current = total - 1;
      if (current < -1) current = -1;
      state.locateIndex = current;
      var posText = current >= 0 ? ('位置 ' + String(current + 1) + '/' + String(total)) : ('位置 --/' + String(total));
      var hasCurrent = current >= 0;
      return (
        '<div class="diff-locate-info">缺失字段定位：共 ' + String(total) + ' 行</div>' +
        '<div class="diff-locate-controls">' +
          '<button type="button" class="secondary" data-import-invalid-locate-action="first" ' + (hasCurrent && current <= 0 ? 'disabled' : '') + '>首处</button>' +
          '<button type="button" class="secondary" data-import-invalid-locate-action="prev" ' + (!hasCurrent || current <= 0 ? 'disabled' : '') + '>上一处</button>' +
          '<button type="button" class="secondary" data-import-invalid-locate-action="next" ' + (hasCurrent && current >= total - 1 ? 'disabled' : '') + '>下一处</button>' +
          '<button type="button" class="secondary" data-import-invalid-locate-action="last" ' + (hasCurrent && current >= total - 1 ? 'disabled' : '') + '>末处</button>' +
          '<span class="diff-locate-pos" data-import-invalid-locate-pos>' + escapeHtml(posText) + '</span>' +
          '<span class="diff-locate-hint hidden" data-import-invalid-locate-hint></span>' +
        '</div>'
      );
    }

    function updateLocateHint() {
      if (!dom.importInvalidLocateBar || !dom.importInvalidLocateBar.querySelector) return;
      var hintEl = dom.importInvalidLocateBar.querySelector('[data-import-invalid-locate-hint]');
      if (!hintEl) return;
      var rows = getInvalidRows();
      if (!rows.length) {
        hintEl.textContent = '';
        if (hintEl.classList) hintEl.classList.add('hidden');
        return;
      }
      var drawerEl = typeof document !== 'undefined' ? document.getElementById('caseLibraryImportInvalidDrawer') : null;
      var bodyEl = drawerEl && drawerEl.querySelector ? drawerEl.querySelector('.drawer-body') : null;
      var hint = isAnyInvalidRowInView(rows, bodyEl) ? '' : '当前视口无缺失字段，可点击“下一处”定位';
      hintEl.textContent = hint;
      if (hintEl.classList) hintEl.classList.toggle('hidden', !hint);
    }

    function renderLocateBar(state) {
      if (!dom.importInvalidLocateBar) return;
      dom.importInvalidLocateBar.innerHTML = buildLocateBarHtml(state);
      updateLocateHint();
    }

    function jumpToInvalidAt(state, index) {
      var rows = getInvalidRows();
      if (!rows.length) return;
      var target = Number(index);
      if (!Number.isFinite(target)) target = 0;
      target = Math.max(0, Math.min(target, rows.length - 1));
      state.locateIndex = target;
      clearLocateHighlight();
      var row = rows[target];
      if (row && row.scrollIntoView) {
        try { row.scrollIntoView({ block: 'center' }); } catch (err) { row.scrollIntoView(); }
      }
      if (row && row.classList) row.classList.add('import-invalid-locate-active');
      var focusCell = row && row.querySelector ? row.querySelector('td.invalid-cell .temp-inline-edit') : null;
      if (focusCell && focusCell.focus) {
        try { focusCell.focus(); } catch (err2) {}
      }
      locateHighlightTimer = setTimeout(function() {
        if (row && row.classList) row.classList.remove('import-invalid-locate-active');
      }, 2000);
      renderLocateBar(state);
    }

    function bindInvalidEvents(getState, onEdit) {
      var stateGetter = typeof getState === 'function' ? getState : function() { return {}; };
      if (!locateBound) {
        locateBound = true;
        var drawerEl = typeof document !== 'undefined' ? document.getElementById('caseLibraryImportInvalidDrawer') : null;
        if (drawerEl && typeof drawerEl.addEventListener === 'function') {
          drawerEl.addEventListener('click', function(event) {
            var button = event && event.target && event.target.closest
              ? event.target.closest('[data-import-invalid-locate-action]')
              : null;
            if (!button || !button.getAttribute) return;
            var action = button.getAttribute('data-import-invalid-locate-action') || '';
            var rows = getInvalidRows();
            if (!rows.length) return;
            var state = stateGetter();
            if (action === 'first') jumpToInvalidAt(state, 0);
            else if (action === 'last') jumpToInvalidAt(state, rows.length - 1);
            else if (action === 'next') jumpToInvalidAt(state, state.locateIndex >= 0 ? state.locateIndex + 1 : 0);
            else if (action === 'prev') jumpToInvalidAt(state, state.locateIndex >= 0 ? state.locateIndex - 1 : rows.length - 1);
          });
          var bodyEl = drawerEl.querySelector ? drawerEl.querySelector('.drawer-body') : null;
          if (bodyEl && typeof bodyEl.addEventListener === 'function') {
            var onScroll = function() { updateLocateHint(); };
            bodyEl.addEventListener('scroll', debounce ? debounce(onScroll, 120) : onScroll);
          }
        }
      }
      if (!editBound && dom.importInvalidBody && typeof dom.importInvalidBody.addEventListener === 'function') {
        editBound = true;
        dom.importInvalidBody.addEventListener('focusout', function(event) {
          var target = event && event.target ? event.target : null;
          if (!target || !target.getAttribute) return;
          var field = target.getAttribute('data-case-lib-import-invalid-field');
          if (!field) return;
          var index = Number(target.getAttribute('data-index'));
          if (!isFinite(index) || index < 0) return;
          var multiline = String(target.getAttribute('data-case-lib-multiline') || '').toLowerCase() === 'true';
          var raw = multiline ? target.innerText : target.textContent;
          var value = String(raw || '').trim();
          if (field === 'priority') value = normalizePriority(value);
          if (typeof onEdit === 'function') onEdit(index, field, value);
        });
      }
    }

    function renderInvalidTable(state) {
      if (!dom.importInvalidBody) return;
      clearLocateHighlight();
      var structural = Array.isArray(state.structuralErrors) ? state.structuralErrors : [];
      var invalid = Array.isArray(state.invalid) ? state.invalid : [];
      if (!structural.length && !invalid.length) {
        dom.importInvalidBody.innerHTML = '<tr><td colspan="7"><p class="hint">暂无数据</p></td></tr>';
        renderLocateBar(state);
        return;
      }

      function renderStructuralRow(entry) {
        var lineNo = entry && typeof entry.line === 'number' ? entry.line : null;
        var depth = entry && typeof entry.depth === 'number' ? entry.depth : null;
        var detail = '字段层级不足：当前为 ' + (depth === null ? '?' : String(depth)) +
          ' 层（需至少 6 层：模块/用例标题/优先级/前提条件/操作步骤/预期结果），请在 XMind 中补齐后重新导入';
        return '<tr class="import-structure-row"><td>' + escapeHtml(lineNo === null ? '-' : String(lineNo)) +
          '</td><td colspan="6">' + escapeHtml(detail) + '</td></tr>';
      }

      function renderItemRow(index, lineNo, item, error) {
        function cell(field, multiline) {
          var raw = item && item[field] !== undefined && item[field] !== null ? String(item[field]) : '';
          return '<td class="' + (error && error[field] ? 'invalid-cell' : '') + '">' +
            '<div class="temp-inline-edit" contenteditable="true" data-case-lib-import-invalid-field="' + field +
            '" data-index="' + index + '" data-case-lib-multiline="' + (multiline ? 'true' : 'false') +
            '" data-placeholder="点击此处编辑">' + (raw ? escapeHtml(raw) : '') + '</div></td>';
        }
        return '<tr><td>' + escapeHtml(String(lineNo)) + '</td>' +
          cell('module', false) + cell('title', false) + cell('priority', false) +
          cell('precondition', true) + cell('steps', true) + cell('expected', true) + '</tr>';
      }

      function isComplete(item) {
        return Boolean(
          item &&
          String(item.module || '').trim() &&
          String(item.title || '').trim() &&
          normalizePriority(item.priority) &&
          String(item.precondition || '').trim() &&
          String(item.steps || '').trim() &&
          String(item.expected || '').trim()
        );
      }

      var errorsByIndex = {};
      invalid.forEach(function(entry) {
        if (entry && typeof entry.index === 'number' && entry.index >= 0) {
          errorsByIndex[entry.index] = entry.err || {};
        }
      });
      var itemsByLine = {};
      (Array.isArray(state.items) ? state.items : []).forEach(function(item, index) {
        var lineNo = item && item._sourceLine ? Number(item._sourceLine) : index + 1;
        if (!lineNo || !isFinite(lineNo)) lineNo = index + 1;
        if (!itemsByLine[lineNo]) itemsByLine[lineNo] = [];
        itemsByLine[lineNo].push({ index: index, item: item });
      });
      var structuralByLine = {};
      structural.forEach(function(entry) {
        if (entry && typeof entry.line === 'number') structuralByLine[entry.line] = entry;
      });
      var lineMap = {};
      Object.keys(itemsByLine).forEach(function(line) { lineMap[Number(line)] = true; });
      Object.keys(structuralByLine).forEach(function(line) { lineMap[Number(line)] = true; });
      var lines = Object.keys(lineMap).map(Number).filter(function(line) {
        return isFinite(line) && line > 0;
      }).sort(function(a, b) { return a - b; });
      var html = lines.map(function(line) {
        var rowHtml = '';
        var itemList = itemsByLine[line] || [];
        itemList.forEach(function(record) {
          rowHtml += renderItemRow(record.index, line, record.item, errorsByIndex[record.index] || {});
        });
        var structuralEntry = structuralByLine[line];
        var repaired = itemList.some(function(record) { return isComplete(record.item); });
        if (structuralEntry && !repaired) rowHtml += renderStructuralRow(structuralEntry);
        return rowHtml;
      }).join('');
      dom.importInvalidBody.innerHTML = html || '<tr><td colspan="7"><p class="hint">暂无数据</p></td></tr>';
      renderLocateBar(state);
    }

    function renderInvalidHeader(state) {
      if (dom.importInvalidTitle) {
        dom.importInvalidTitle.textContent = '导入用例格式校验：' + (state.cleanName || state.fileName || '用例');
      }
      var structuralCount = Array.isArray(state.structuralErrors) ? state.structuralErrors.length : 0;
      var itemCount = Array.isArray(state.items) ? state.items.length : 0;
      var invalid = Array.isArray(state.invalid) ? state.invalid : [];
      if (!structuralCount) {
        setInvalidStatus('请补齐必填字段后再确认入库', 'warn');
        return;
      }
      if (!itemCount) {
        setInvalidStatus('全部条目字段层级不足（共 ' + structuralCount + ' 条），无法入库，请在 XMind 中补齐后重新导入', 'warn');
        return;
      }
      var structuralLines = {};
      state.structuralErrors.forEach(function(entry) {
        if (entry && typeof entry.line === 'number') structuralLines[entry.line] = true;
      });
      var invalidNonStructural = invalid.filter(function(entry) {
        return !entry || !entry.line || !structuralLines[entry.line];
      }).length;
      var restCount = Math.max(0, itemCount - structuralCount);
      var message = '检测到字段层级不足 ' + structuralCount + ' 条，可在列表内补齐字段后入库，未补齐将自动跳过';
      if (restCount) message += '；其余 ' + restCount + ' 条可继续入库';
      if (invalidNonStructural) message += '（请先补齐必填字段）';
      setInvalidStatus(message, 'warn');
    }

    function renderInvalid(state) {
      renderInvalidHeader(state);
      renderInvalidTable(state);
      syncInvalidControls(state);
    }

    function resetInvalid() {
      clearLocateHighlight();
      setInvalidStatus('', '');
      if (dom.importInvalidBody) {
        dom.importInvalidBody.innerHTML = '<tr><td colspan="7"><p class="hint">暂无数据</p></td></tr>';
      }
      if (dom.importInvalidLocateBar) dom.importInvalidLocateBar.innerHTML = '';
      syncInvalidControls({ items: [], loading: false });
    }

    function renderDuplicate(payload, cleanFileName) {
      var data = payload && typeof payload === 'object' ? payload : {};
      var fileName = data.fileName ? String(data.fileName) : '用例';
      var total = Number.isFinite(Number(data.total)) ? Number(data.total) : 0;
      var uniqueCount = Number.isFinite(Number(data.uniqueCount)) ? Number(data.uniqueCount) : 0;
      var duplicateCount = Number.isFinite(Number(data.duplicateCount)) ? Number(data.duplicateCount) : 0;
      var rows = Array.isArray(data.rows) ? data.rows : [];
      if (dom.importDuplicateTitle) {
        dom.importDuplicateTitle.textContent = '导入用例重复校验：' + cleanFileName(fileName);
      }
      setStatus(
        dom.importDuplicateStatus,
        '检测到重复条目 ' + duplicateCount + ' 条（模块/用例描述/前提条件/操作步骤/预期结果均相同），将自动去重：原 ' +
          total + ' 条 → 去重后 ' + uniqueCount + ' 条。',
        'warn'
      );
      if (dom.importDuplicateConfirmBtn) dom.importDuplicateConfirmBtn.disabled = !duplicateCount;
      if (!dom.importDuplicateBody) return;
      if (!rows.length) {
        dom.importDuplicateBody.innerHTML = '<tr><td colspan="9"><p class="hint">暂无重复条目</p></td></tr>';
        return;
      }
      function toHtml(value) {
        return escapeHtml(value === null || value === undefined ? '' : String(value)).replace(/\n/g, '<br>');
      }
      dom.importDuplicateBody.innerHTML = rows.map(function(entry) {
        var item = entry && entry.item ? entry.item : {};
        var line = entry && Number.isFinite(Number(entry.line)) ? Number(entry.line) : 0;
        return '<tr><td>' + (line ? String(line) : '-') + '</td>' +
          '<td>' + toHtml(item.module) + '</td><td>' + toHtml(item.title) + '</td>' +
          '<td>' + toHtml(item.priority) + '</td><td>' + toHtml(item.precondition) + '</td>' +
          '<td>' + toHtml(item.steps) + '</td><td>' + toHtml(item.expected) + '</td>' +
          '<td>' + toHtml(item.remark) + '</td><td>' + escapeHtml(entry && entry.keep ? '保留' : '移除') + '</td></tr>';
      }).join('');
    }

    function renderDiffLoading(state, context) {
      var data = context && typeof context === 'object' ? context : {};
      var appendMode = state.mode === 'append_overwrite';
      if (dom.importDiffTitle) {
        dom.importDiffTitle.textContent = (appendMode ? '追加入库差异对比：' : '同名用例差异对比：') +
          (state.cleanName || state.fileName || '用例');
      }
      if (dom.importDiffMeta) {
        dom.importDiffMeta.textContent = appendMode
          ? (data.projectName + ' / 版本：' + data.importVersionName + ' / 库中：--')
          : (data.projectName + ' / 导入版本：' + data.importVersionName + ' / 库中版本：--');
        if (dom.importDiffMeta.classList) dom.importDiffMeta.classList.remove('warn');
      }
      setDiffStatus('加载差异对比中...', '');
      if (dom.importDiffOverwriteBtn) {
        dom.importDiffOverwriteBtn.textContent = appendMode ? '确认覆盖并追加入库' : '确认覆盖导入';
      }
      syncDiffControls(state);
    }

    function renderDiff(state, context) {
      var data = context && typeof context === 'object' ? context : {};
      var counts = data.counts && typeof data.counts === 'object' ? data.counts : {};
      var appendMode = state.mode === 'append_overwrite';
      if (dom.importDiffTitle) {
        dom.importDiffTitle.textContent = (appendMode ? '追加入库差异对比：' : '同名用例差异对比：') +
          (state.cleanName || state.fileName || '用例');
      }
      if (dom.importDiffMeta) {
        if (appendMode) {
          dom.importDiffMeta.textContent = data.projectName + ' / 版本：' + data.importVersionName +
            ' / 待追加入库：' + data.leftCount + ' 条（新增 ' + (counts.added || 0) +
            ' / 重复 ' + data.rightCount + ' / 差异 ' + (counts.changed || 0) + '）';
          dom.importDiffMeta.classList.toggle('warn', Boolean(counts.changed));
        } else {
          dom.importDiffMeta.textContent = data.projectName + ' / 导入版本：' + data.importVersionName +
            '（' + data.leftCount + ' 条） / 库中版本：' + data.dbVersionName + '（' + data.rightCount +
            ' 条） / 新增 ' + (counts.added || 0) + ' / 删除 ' + (counts.removed || 0) +
            ' / 差异 ' + (counts.changed || 0);
          dom.importDiffMeta.classList.toggle('warn', data.leftCount !== data.rightCount);
        }
      }
      if (appendMode) {
        setDiffStatus('检测到重复用例：新增 ' + (counts.added || 0) + ' 条，差异 ' + (counts.changed || 0) + ' 条', counts.changed ? 'warn' : 'ok');
      } else {
        var hasDiff = Boolean(counts.added || counts.changed || counts.removed);
        setDiffStatus('对比完成：新增 ' + (counts.added || 0) + ' 条，差异 ' + (counts.changed || 0) +
          ' 条，库中多出 ' + (counts.removed || 0) + ' 条', hasDiff ? 'warn' : 'ok');
      }
      if (dom.importDiffOverwriteBtn) {
        dom.importDiffOverwriteBtn.textContent = appendMode ? '确认覆盖并追加入库' : '确认覆盖导入';
      }
      syncDiffControls(state);
    }

    function resetDiff() {
      if (dom.importDiffOverwriteBtn) dom.importDiffOverwriteBtn.textContent = '确认覆盖导入';
    }

    return {
      setInvalidStatus: setInvalidStatus,
      setDiffStatus: setDiffStatus,
      syncInvalidControls: syncInvalidControls,
      syncDiffControls: syncDiffControls,
      bindInvalidEvents: bindInvalidEvents,
      renderInvalidTable: renderInvalidTable,
      renderInvalid: renderInvalid,
      resetInvalid: resetInvalid,
      renderDuplicate: renderDuplicate,
      renderDiffLoading: renderDiffLoading,
      renderDiff: renderDiff,
      resetDiff: resetDiff,
    };
  }

  return { create: create };
});
