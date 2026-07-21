(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.missingImportViewAdapter = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var escapeHtml = typeof opts.escapeHtml === 'function'
      ? opts.escapeHtml
      : function(value) { return String(value === null || value === undefined ? '' : value); };
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var formatStructuralDetail = typeof opts.formatStructuralDetail === 'function'
      ? opts.formatStructuralDetail
      : function() { return '字段层级不足'; };
    var countPendingItems = typeof opts.countPendingItems === 'function'
      ? opts.countPendingItems
      : function() { return 0; };

    function setImportStatus(text, type) {
      setStatus(dom.missingImportStatus, text || '', type || '');
    }

    function setDiffStatus(text, type) {
      setStatus(dom.missingImportDiffStatus, text || '', type || '');
    }

    function syncConfirmEnabled(importState) {
      if (!dom.missingImportConfirmBtn) return;
      var state = importState && typeof importState === 'object' ? importState : {};
      var hasFiles = state.files && state.files.length;
      var hasItems = state.items && state.items.length;
      var invalid = state.invalid && state.invalid.length;
      var hasStructural = state.structuralErrors && state.structuralErrors.length;
      dom.missingImportConfirmBtn.disabled = !hasFiles
        || (!hasItems && !hasStructural)
        || !state.projectId
        || state.loading
        || state.pending
        || invalid;
    }

    function renderFileHint(importState) {
      if (!dom.missingImportFileHint) return;
      var state = importState && typeof importState === 'object' ? importState : {};
      var files = Array.isArray(state.files) ? state.files : [];
      if (!files.length) {
        dom.missingImportFileHint.textContent = '未选择文件';
        return;
      }
      var names = files.map(function(file) { return file && file.name ? file.name : '文件'; });
      var head = names.slice(0, 2).join('、');
      dom.missingImportFileHint.textContent = names.length > 2
        ? ('已选择 ' + names.length + ' 个：' + head + '...')
        : ('已选择：' + head);
    }

    function getProjectValue() {
      return dom.missingImportProjectSelect ? dom.missingImportProjectSelect.value : '';
    }

    function setProjectValue(projectId) {
      if (dom.missingImportProjectSelect) {
        dom.missingImportProjectSelect.value = projectId ? String(projectId) : '';
      }
    }

    function setDropZoneActive(active) {
      if (!dom.missingImportDropZone || !dom.missingImportDropZone.classList) return;
      if (active) dom.missingImportDropZone.classList.add('dragover');
      else dom.missingImportDropZone.classList.remove('dragover');
    }

    function clearFileInput() {
      if (!dom.missingImportInput) return;
      try { dom.missingImportInput.value = ''; } catch (err) {}
    }

    function renderStructureTable(errors) {
      if (!dom.missingImportStructureBody || !dom.missingImportStructureWrap) return;
      var list = Array.isArray(errors) ? errors.slice() : [];
      if (!list.length) {
        dom.missingImportStructureWrap.classList.add('hidden');
        dom.missingImportStructureBody.innerHTML = '<tr><td colspan="3"><p class="hint">暂无数据</p></td></tr>';
        return;
      }
      list.sort(function(a, b) {
        var lineA = a && typeof a.line === 'number' ? a.line : 0;
        var lineB = b && typeof b.line === 'number' ? b.line : 0;
        return lineA - lineB;
      });
      dom.missingImportStructureWrap.classList.remove('hidden');
      dom.missingImportStructureBody.innerHTML = list.map(function(entry) {
        var lineNo = entry && typeof entry.line === 'number' ? entry.line : null;
        var depth = entry && typeof entry.depth === 'number' ? entry.depth : null;
        return (
          '<tr>' +
            '<td>' + escapeHtml(lineNo === null ? '-' : String(lineNo)) + '</td>' +
            '<td>' + escapeHtml(depth === null ? '-' : String(depth)) + '</td>' +
            '<td>' + escapeHtml(formatStructuralDetail(entry)) + '</td>' +
          '</tr>'
        );
      }).join('');
    }

    function renderDiffTable(rows) {
      if (!dom.missingImportDiffBody) return;
      var list = Array.isArray(rows) ? rows : [];
      if (!list.length) {
        dom.missingImportDiffBody.innerHTML = '<tr><td colspan="6"><p class="hint">暂无数据</p></td></tr>';
        return;
      }
      dom.missingImportDiffBody.innerHTML = list.map(function(row) {
        var item = row && row.left ? row.left : (row && row.right ? row.right : null);
        var status = '已存在';
        var badge = 'diff-badge';
        if (row && row.type === 'added') {
          status = '新增';
          badge = 'diff-badge diff-badge-added';
        } else if (row && row.type === 'changed') {
          status = '已存在（优先级差异）';
          badge = 'diff-badge diff-badge-changed';
        }
        return (
          '<tr>' +
            '<td><span class="' + escapeHtml(badge) + '">' + escapeHtml(status) + '</span></td>' +
            '<td>' + escapeHtml(item && (item.module || item.module_name) ? (item.module || item.module_name) : '') + '</td>' +
            '<td>' + escapeHtml(item && item.title ? item.title : '') + '</td>' +
            '<td>' + escapeHtml(item && item.precondition ? item.precondition : '') + '</td>' +
            '<td>' + escapeHtml(item && item.steps ? item.steps : '') + '</td>' +
            '<td>' + escapeHtml(item && item.expected ? item.expected : '') + '</td>' +
          '</tr>'
        );
      }).join('');
    }

    function syncDiffConfirmEnabled(diffState) {
      if (!dom.missingImportDiffConfirmBtn) return;
      var state = diffState && typeof diffState === 'object' ? diffState : {};
      dom.missingImportDiffConfirmBtn.disabled = countPendingItems(state.pendingItemsByModule || []) <= 0;
    }

    function renderDiffSummary(diffState, payload) {
      var state = diffState && typeof diffState === 'object' ? diffState : {};
      var data = payload && typeof payload === 'object' ? payload : {};
      var structuralCount = Array.isArray(state.structuralErrors) ? state.structuralErrors.length : 0;
      var statusText = '新增条目 ' + (data.newCount || 0) + ' 条，重复跳过 ' + (data.duplicateCount || 0) + ' 条。';
      if (structuralCount) statusText += ' 字段层级不足 ' + structuralCount + ' 条。';
      var statusType = data.newCount ? 'ok' : 'warn';
      if (structuralCount) statusType = 'warn';
      setDiffStatus(statusText, statusType);
      if (dom.missingImportDiffMeta) {
        var metaText = '同名模块 ' + (data.overlapModules || 0) + ' 个，导入条目 ' + (data.importCount || 0) + ' 条。';
        if (structuralCount) metaText += ' 字段层级不足 ' + structuralCount + ' 条。';
        dom.missingImportDiffMeta.textContent = metaText;
      }
      renderStructureTable(state.structuralErrors || []);
      renderDiffTable(state.rows || []);
      syncDiffConfirmEnabled(state);
    }

    function clearDiff() {
      setDiffStatus('', '');
      if (dom.missingImportDiffMeta) dom.missingImportDiffMeta.textContent = '';
      renderStructureTable([]);
      renderDiffTable([]);
      syncDiffConfirmEnabled({ pendingItemsByModule: [] });
    }

    return {
      setImportStatus: setImportStatus,
      syncConfirmEnabled: syncConfirmEnabled,
      renderFileHint: renderFileHint,
      getProjectValue: getProjectValue,
      setProjectValue: setProjectValue,
      setDropZoneActive: setDropZoneActive,
      clearFileInput: clearFileInput,
      renderStructureTable: renderStructureTable,
      renderDiffTable: renderDiffTable,
      syncDiffConfirmEnabled: syncDiffConfirmEnabled,
      renderDiffSummary: renderDiffSummary,
      clearDiff: clearDiff,
    };
  }

  return { create: create };
});
