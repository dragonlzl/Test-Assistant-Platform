(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.importSelectViewAdapter = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var escapeHtml = typeof opts.escapeHtml === 'function' ? opts.escapeHtml : function(value) { return String(value || ''); };
    var syncProjectOptions = typeof opts.syncProjectOptions === 'function' ? opts.syncProjectOptions : function() {};
    var syncVersionOptionsWithAll = typeof opts.syncVersionOptionsWithAll === 'function'
      ? opts.syncVersionOptionsWithAll
      : function() {};
    var getProjectName = typeof opts.getProjectName === 'function'
      ? opts.getProjectName
      : function(id) { return '项目#' + id; };
    var getVersionName = typeof opts.getVersionName === 'function'
      ? opts.getVersionName
      : function(projectId, versionId) { return versionId ? ('版本#' + versionId) : '--'; };
    var bound = false;

    function setDrawerStatus(text, type) {
      setStatus(dom.importSelectStatus, text, type);
    }

    function getProjectValue() {
      return dom.importSelectProjectSelect ? dom.importSelectProjectSelect.value : '';
    }

    function getVersionValue() {
      return dom.importSelectVersionSelect ? dom.importSelectVersionSelect.value : '';
    }

    function getSearchValue() {
      return dom.importSelectSearchInput ? dom.importSelectSearchInput.value : '';
    }

    function setPagination(html) {
      if (dom.importSelectPaginationTop) dom.importSelectPaginationTop.innerHTML = html || '';
      if (dom.importSelectPaginationBottom) dom.importSelectPaginationBottom.innerHTML = html || '';
    }

    function buildPagination(snapshot) {
      var total = snapshot.total;
      var totalPages = snapshot.totalPages;
      var pageIndex = snapshot.pageIndex;
      var start = snapshot.start;
      var end = snapshot.end;
      var displayStart = total ? start + 1 : 0;
      var displayEnd = total ? Math.min(end, total) : 0;
      var maxPage = Math.max(totalPages, 1);
      var currentPage = totalPages ? pageIndex + 1 : 1;
      var rangeInfo = total ? ('显示 ' + displayStart + '-' + displayEnd + ' / ' + total + ' 条') : '暂无记录';
      return (
        '<div class="temp-pagination" data-case-lib-drawer-pagination="import-select">' +
          '<div class="temp-pagination-info">' + escapeHtml(rangeInfo) + '，每页 ' + snapshot.pageSize + ' 条</div>' +
          '<div class="temp-pagination-controls">' +
            '<button type="button" class="secondary" data-case-lib-drawer-page="prev" data-case-lib-drawer-scope="import-select" ' + (pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
            '<span>第 ' + currentPage + ' / ' + maxPage + ' 页</span>' +
            '<button type="button" class="secondary" data-case-lib-drawer-page="next" data-case-lib-drawer-scope="import-select" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
            '<label>跳至' +
              '<input type="number" min="1" max="' + maxPage + '" value="' + Math.min(currentPage, maxPage) + '" data-case-lib-drawer-page-input data-case-lib-drawer-scope="import-select">' +
              '页' +
            '</label>' +
          '</div>' +
        '</div>'
      );
    }

    function syncControls(drawer, snapshot) {
      var loading = Boolean(drawer.loading || drawer.processing);
      if (dom.importSelectBatchBtn) {
        dom.importSelectBatchBtn.disabled = loading || snapshot.selectedCount === 0;
      }
      if (dom.importSelectSelectAll) {
        dom.importSelectSelectAll.checked = snapshot.pageSelectionChecked;
        dom.importSelectSelectAll.indeterminate = snapshot.pageSelectionIndeterminate;
      }
    }

    function reset() {
      setDrawerStatus('', '');
      syncProjectOptions(dom.importSelectProjectSelect, '请选择项目');
      if (dom.importSelectProjectSelect) dom.importSelectProjectSelect.value = '';
      resetProjectFields();
      if (dom.importSelectListBody) {
        dom.importSelectListBody.innerHTML = '<tr><td colspan="7"><p class="hint">请选择项目后点击“查询”。</p></td></tr>';
      }
      setPagination('');
      if (dom.importSelectBatchBtn) dom.importSelectBatchBtn.disabled = true;
    }

    function resetProjectFields() {
      if (dom.importSelectSearchInput) dom.importSelectSearchInput.value = '';
      if (dom.importSelectVersionSelect) {
        dom.importSelectVersionSelect.disabled = true;
        dom.importSelectVersionSelect.innerHTML = '<option value="">请选择版本</option><option value="0">全部版本</option>';
        dom.importSelectVersionSelect.value = '';
      }
      if (dom.importSelectSelectAll) {
        dom.importSelectSelectAll.checked = false;
        dom.importSelectSelectAll.indeterminate = false;
      }
    }

    function renderVersions(projectId, requestedVersionId, versions) {
      if (!dom.importSelectVersionSelect) return null;
      syncVersionOptionsWithAll(dom.importSelectVersionSelect, projectId);
      dom.importSelectVersionSelect.disabled = false;
      if (requestedVersionId === 0) {
        dom.importSelectVersionSelect.value = '0';
        return 0;
      }
      var desired = requestedVersionId ? String(requestedVersionId) : '';
      var exists = desired && (Array.isArray(versions) ? versions : []).some(function(version) {
        return version && String(version.id) === desired;
      });
      dom.importSelectVersionSelect.value = exists ? desired : '';
      return exists ? requestedVersionId : null;
    }

    function render(drawer, snapshot) {
      if (!dom.importSelectListBody) return;
      if (!drawer.projectId) {
        dom.importSelectListBody.innerHTML = '<tr><td colspan="7"><p class="hint">请选择项目后点击“查询”。</p></td></tr>';
        setPagination('');
        syncControls(drawer, snapshot);
        return;
      }
      if (drawer.loading) {
        dom.importSelectListBody.innerHTML = '<tr><td colspan="7"><p class="hint">加载中...</p></td></tr>';
        setPagination('');
        syncControls(drawer, snapshot);
        return;
      }
      if (!snapshot.total) {
        var hint = String(drawer.searchText || '').trim() ? '未找到匹配的用例文件' : '暂无用例文件';
        dom.importSelectListBody.innerHTML = '<tr><td colspan="7"><p class="hint">' + escapeHtml(hint) + '</p></td></tr>';
        setPagination('');
        syncControls(drawer, snapshot);
        return;
      }
      dom.importSelectListBody.innerHTML = snapshot.records.map(function(file) {
        var projectId = file && (file.project_id || file.project_id === 0) ? file.project_id : drawer.projectId;
        var id = file && file.id ? String(file.id) : '';
        var checked = id && snapshot.selection.has(id) ? ' checked' : '';
        var disabled = drawer.processing ? ' disabled' : '';
        var fileName = file && file.file_name_clean ? file.file_name_clean : ('文件#' + (file && file.id ? file.id : ''));
        var reuseText = file && file.reuse_enabled ? '复用' : '普通';
        var itemCount = file && (file.item_count || file.item_count === 0) ? String(file.item_count) : '--';
        return (
          '<tr>' +
            '<td><input type="checkbox" data-case-lib-import-select="' + escapeHtml(id) + '"' + checked + disabled + '/></td>' +
            '<td>' + escapeHtml(getProjectName(projectId)) + '</td>' +
            '<td>' + escapeHtml(getVersionName(projectId, file && file.version_id ? file.version_id : null)) + '</td>' +
            '<td>' + escapeHtml(fileName) + '</td>' +
            '<td>' + escapeHtml(reuseText) + '</td>' +
            '<td>' + escapeHtml(itemCount) + '</td>' +
            '<td><button class="primary" type="button" data-case-lib-import-pick="' + escapeHtml(id) + '"' + disabled + '>导入</button></td>' +
          '</tr>'
        );
      }).join('');
      setPagination(buildPagination(snapshot));
      syncControls(drawer, snapshot);
    }

    function bindEvents(handlers) {
      if (bound) return;
      bound = true;
      var actions = handlers && typeof handlers === 'object' ? handlers : {};
      var bindings = [
        [dom.importSelectProjectSelect, 'change', actions.onProjectChange],
        [dom.importSelectVersionSelect, 'change', actions.onVersionChange],
        [dom.importSelectSearchInput, 'input', actions.onSearchInput],
        [dom.importSelectQueryBtn, 'click', actions.onQuery],
        [dom.importSelectBatchBtn, 'click', actions.onBatchImport],
      ];
      bindings.forEach(function(binding) {
        if (binding[0] && typeof binding[2] === 'function') binding[0].addEventListener(binding[1], binding[2]);
      });
      if (dom.importSelectSelectAll && typeof actions.onSelectAll === 'function') {
        dom.importSelectSelectAll.addEventListener('change', function() {
          actions.onSelectAll(dom.importSelectSelectAll.checked === true);
        });
      }
      if (dom.importSelectListBody) {
        dom.importSelectListBody.addEventListener('change', function(event) {
          var target = event && event.target ? event.target : null;
          var id = target && target.getAttribute ? target.getAttribute('data-case-lib-import-select') : '';
          if (id && typeof actions.onSelectionChange === 'function') actions.onSelectionChange(id, target.checked === true);
        });
        dom.importSelectListBody.addEventListener('click', function(event) {
          var target = event && event.target && event.target.closest
            ? event.target.closest('[data-case-lib-import-pick]')
            : null;
          var id = target && target.getAttribute ? target.getAttribute('data-case-lib-import-pick') : '';
          if (id && typeof actions.onImportOne === 'function') actions.onImportOne(id);
        });
      }
    }

    return {
      setDrawerStatus: setDrawerStatus,
      getProjectValue: getProjectValue,
      getVersionValue: getVersionValue,
      getSearchValue: getSearchValue,
      reset: reset,
      resetProjectFields: resetProjectFields,
      renderVersions: renderVersions,
      render: render,
      bindEvents: bindEvents,
    };
  }

  return { create: create };
});
