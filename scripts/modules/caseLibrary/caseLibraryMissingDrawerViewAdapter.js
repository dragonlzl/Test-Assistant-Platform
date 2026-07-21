(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.missingDrawerViewAdapter = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var escapeHtml = typeof opts.escapeHtml === 'function'
      ? opts.escapeHtml
      : function(value) { return String(value === null || value === undefined ? '' : value); };
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var syncProjectOptions = typeof opts.syncProjectOptions === 'function' ? opts.syncProjectOptions : function() {};
    var syncModuleOptions = typeof opts.syncModuleOptions === 'function' ? opts.syncModuleOptions : function() {};
    var syncTypeOptions = typeof opts.syncTypeOptions === 'function' ? opts.syncTypeOptions : function() {};
    var setPagination = typeof opts.setPagination === 'function' ? opts.setPagination : function() {};
    var buildPagination = typeof opts.buildPagination === 'function' ? opts.buildPagination : function() { return ''; };

    function prepareProjectOptions() {
      syncProjectOptions(dom.missingDrawerProjectSelect, '请选择项目');
    }

    function setDrawerStatus(text, type) {
      setStatus(dom.missingDrawerStatus, text || '', type || '');
    }

    function getProjectValue() {
      return dom.missingDrawerProjectSelect ? dom.missingDrawerProjectSelect.value : '';
    }

    function setProjectValue(projectId) {
      if (dom.missingDrawerProjectSelect) {
        dom.missingDrawerProjectSelect.value = projectId ? String(projectId) : '';
      }
    }

    function getModuleValue() {
      return dom.missingDrawerModuleSelect ? dom.missingDrawerModuleSelect.value : '';
    }

    function getTypeValue() {
      return dom.missingDrawerTypeSelect ? dom.missingDrawerTypeSelect.value : '';
    }

    function clearTypeValue() {
      if (dom.missingDrawerTypeSelect) dom.missingDrawerTypeSelect.value = '';
    }

    function syncModuleSelect(drawerState) {
      var drawer = drawerState && typeof drawerState === 'object' ? drawerState : {};
      var modules = Array.isArray(drawer.modules) ? drawer.modules : [];
      syncModuleOptions(dom.missingDrawerModuleSelect, modules, '全部模块');
      if (!dom.missingDrawerModuleSelect) return drawer.moduleId || null;
      dom.missingDrawerModuleSelect.disabled = false;
      if (drawer.moduleId) {
        var exists = modules.some(function(module) {
          return module && String(module.id) === String(drawer.moduleId);
        });
        if (exists) dom.missingDrawerModuleSelect.value = String(drawer.moduleId);
        else {
          dom.missingDrawerModuleSelect.value = '';
          return null;
        }
      } else {
        dom.missingDrawerModuleSelect.value = '';
      }
      return drawer.moduleId || null;
    }

    function clearModuleSelect() {
      if (!dom.missingDrawerModuleSelect) return;
      dom.missingDrawerModuleSelect.disabled = true;
      dom.missingDrawerModuleSelect.innerHTML = '<option value="">全部模块</option>';
      dom.missingDrawerModuleSelect.value = '';
    }

    function renderTypeFilters(typeState) {
      if (!dom.missingDrawerTypeGrid) return;
      var state = typeState && typeof typeState === 'object' ? typeState : {};
      var list = Array.isArray(state.types) ? state.types : [];
      var selection = state.selection instanceof Set ? state.selection : new Set();
      if (state.loading) {
        dom.missingDrawerTypeGrid.innerHTML = '<p class="hint">加载中...</p>';
        return;
      }
      if (!list.length) {
        dom.missingDrawerTypeGrid.innerHTML = '<p class="hint">暂无类型</p>';
        return;
      }
      var allChecked = selection.size === 0;
      var html = [
        '<label class="ops-log-filter-chip">' +
          '<input type="checkbox" data-case-lib-missing-type="__all__"' + (allChecked ? ' checked' : '') + ' />' +
          '<span>全部</span>' +
        '</label>'
      ];
      list.forEach(function(type) {
        if (!type || type.id === null || type.id === undefined) return;
        var id = String(type.id);
        var checked = !allChecked && selection.has(id) ? ' checked' : '';
        html.push(
          '<label class="ops-log-filter-chip">' +
            '<input type="checkbox" data-case-lib-missing-type="' + escapeHtml(id) + '"' + checked + ' />' +
            '<span>' + escapeHtml(type.name || ('类型#' + type.id)) + '</span>' +
          '</label>'
        );
      });
      dom.missingDrawerTypeGrid.innerHTML = html.join('');
    }

    function syncTypeSelect(typeState) {
      var state = typeState && typeof typeState === 'object' ? typeState : {};
      syncTypeOptions(dom.missingDrawerTypeSelect, state.types || [], '请选择类型', true);
    }

    function showTypeLoading() {
      if (dom.missingDrawerTypeSelect) {
        dom.missingDrawerTypeSelect.disabled = false;
        syncTypeOptions(dom.missingDrawerTypeSelect, [], '请选择类型', true);
        dom.missingDrawerTypeSelect.value = '';
      }
      if (dom.missingDrawerTypeGrid) dom.missingDrawerTypeGrid.innerHTML = '<p class="hint">加载中...</p>';
    }

    function showNoProject() {
      clearModuleSelect();
      if (dom.missingDrawerTypeSelect) {
        dom.missingDrawerTypeSelect.disabled = true;
        syncTypeOptions(dom.missingDrawerTypeSelect, [], '请选择类型', true);
        dom.missingDrawerTypeSelect.value = '';
      }
      if (dom.missingDrawerTypeGrid) {
        dom.missingDrawerTypeGrid.innerHTML = '<p class="hint">请选择项目后自动刷新。</p>';
      }
    }

    function syncControls(snapshot) {
      var data = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var disabled = data.busy || !data.selectedCount;
      if (dom.missingDrawerBatchViewBtn) dom.missingDrawerBatchViewBtn.disabled = disabled;
      if (dom.missingDrawerDeleteBtn) dom.missingDrawerDeleteBtn.disabled = disabled;
      if (dom.missingDrawerExportXmindBtn) dom.missingDrawerExportXmindBtn.disabled = disabled;
      if (dom.missingDrawerExportExcelBtn) dom.missingDrawerExportExcelBtn.disabled = disabled;
      if (dom.missingDrawerSelectAll) {
        dom.missingDrawerSelectAll.checked = Boolean(data.pageTotal && data.pageSelected === data.pageTotal);
        dom.missingDrawerSelectAll.indeterminate = Boolean(data.pageSelected && data.pageSelected < data.pageTotal);
      }
    }

    function renderList(drawerState, snapshot) {
      if (!dom.missingDrawerListBody) return;
      var drawer = drawerState && typeof drawerState === 'object' ? drawerState : {};
      var data = snapshot && typeof snapshot === 'object' ? snapshot : {};
      if (!drawer.projectId) {
        dom.missingDrawerListBody.innerHTML = '<tr><td colspan="4"><p class="hint">请选择项目后自动刷新。</p></td></tr>';
        setPagination(dom.missingDrawerPaginationTop, dom.missingDrawerPaginationBottom, '');
        syncControls(data);
        return;
      }
      if (drawer.loading) {
        dom.missingDrawerListBody.innerHTML = '<tr><td colspan="4"><p class="hint">加载中...</p></td></tr>';
        setPagination(dom.missingDrawerPaginationTop, dom.missingDrawerPaginationBottom, '');
        syncControls(data);
        return;
      }
      if (!data.total) {
        dom.missingDrawerListBody.innerHTML = '<tr><td colspan="4"><p class="hint">暂无模块</p></td></tr>';
        setPagination(dom.missingDrawerPaginationTop, dom.missingDrawerPaginationBottom, '');
        syncControls(data);
        setStatus(dom.missingDrawerStatus, '暂无易漏模块', 'warn');
        return;
      }
      var completionMap = drawer.moduleCompletion && typeof drawer.moduleCompletion === 'object'
        ? drawer.moduleCompletion
        : {};
      dom.missingDrawerListBody.innerHTML = data.list.map(function(module) {
        var id = module && module.id ? String(module.id) : '';
        var name = module && module.name ? String(module.name) : ('模块#' + (module && module.id ? module.id : ''));
        var complete = id && completionMap[id] === true;
        var moduleClass = 'module' + (complete ? ' case-library-missing-module-complete' : '');
        var checked = id && data.selection.has(id) ? ' checked' : '';
        return (
          '<tr>' +
            '<td class="check"><input type="checkbox" data-case-lib-missing-select="' + escapeHtml(id) + '"' + checked + '/></td>' +
            '<td>' + escapeHtml(id || '--') + '</td>' +
            '<td class="' + moduleClass + '">' + escapeHtml(name) + '</td>' +
            '<td class="ops"><div class="actions">' +
              '<button class="primary" type="button" data-case-lib-missing-view="' + escapeHtml(id) + '">查看</button>' +
              '<button class="secondary" type="button" data-case-lib-missing-edit="' + escapeHtml(id) + '">编辑</button>' +
            '</div></td>' +
          '</tr>'
        );
      }).join('');
      setPagination(
        dom.missingDrawerPaginationTop,
        dom.missingDrawerPaginationBottom,
        buildPagination(data.total, data.page.pageIndex, data.page.totalPages, data.page.start, data.page.end, 'missing')
      );
      setStatus(
        dom.missingDrawerStatus,
        '已加载 ' + data.total + ' 个模块，' + data.totalItems + ' 条易漏用例。',
        data.total ? 'ok' : 'warn'
      );
      syncControls(data);
    }

    function reset() {
      setDrawerStatus('', '');
      prepareProjectOptions();
      setProjectValue(null);
      clearModuleSelect();
      if (dom.missingDrawerTypeSelect) {
        dom.missingDrawerTypeSelect.disabled = true;
        syncTypeOptions(dom.missingDrawerTypeSelect, [], '请选择类型', true);
        dom.missingDrawerTypeSelect.value = '';
      }
      if (dom.missingDrawerTypeGrid) dom.missingDrawerTypeGrid.innerHTML = '<p class="hint">请选择项目后自动刷新。</p>';
      if (dom.missingDrawerListBody) {
        dom.missingDrawerListBody.innerHTML = '<tr><td colspan="4"><p class="hint">请选择项目后自动刷新。</p></td></tr>';
      }
      setPagination(dom.missingDrawerPaginationTop, dom.missingDrawerPaginationBottom, '');
      syncControls({ busy: false, selectedCount: 0, pageTotal: 0, pageSelected: 0 });
    }

    return {
      prepareProjectOptions: prepareProjectOptions,
      setDrawerStatus: setDrawerStatus,
      getProjectValue: getProjectValue,
      setProjectValue: setProjectValue,
      getModuleValue: getModuleValue,
      getTypeValue: getTypeValue,
      clearTypeValue: clearTypeValue,
      syncModuleSelect: syncModuleSelect,
      clearModuleSelect: clearModuleSelect,
      renderTypeFilters: renderTypeFilters,
      syncTypeSelect: syncTypeSelect,
      showTypeLoading: showTypeLoading,
      showNoProject: showNoProject,
      syncControls: syncControls,
      renderList: renderList,
      reset: reset,
    };
  }

  return { create: create };
});
