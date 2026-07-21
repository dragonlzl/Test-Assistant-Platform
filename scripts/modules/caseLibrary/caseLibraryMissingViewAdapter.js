(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.missingViewAdapter = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var model = opts.model || null;
    if (!model) throw new Error('Missing view model is required');
    var getView = typeof opts.getView === 'function' ? opts.getView : function() { return {}; };
    var getTypes = typeof opts.getTypes === 'function' ? opts.getTypes : function() { return []; };
    var getProjectName = typeof opts.getProjectName === 'function'
      ? opts.getProjectName
      : function(projectId) { return projectId ? ('项目#' + projectId) : '--'; };
    var escapeHtml = typeof opts.escapeHtml === 'function'
      ? opts.escapeHtml
      : function(value) { return value === null || value === undefined ? '' : String(value); };
    var stripInvisibleMarkers = typeof opts.stripInvisibleMarkers === 'function'
      ? opts.stripInvisibleMarkers
      : function(value) { return value === null || value === undefined ? '' : String(value); };
    var normalizeText = typeof opts.normalizeText === 'function'
      ? opts.normalizeText
      : function(value) { return value === null || value === undefined ? '' : String(value).trim(); };
    var normalizePriority = typeof opts.normalizePriority === 'function'
      ? opts.normalizePriority
      : function(value) { return normalizeText(value); };
    var ensureTypeSlots = typeof opts.ensureTypeSlots === 'function'
      ? opts.ensureTypeSlots
      : function(item) {
          if (!Array.isArray(item.type_ids) || !item.type_ids.length) item.type_ids = [''];
          return item.type_ids;
        };
    var isNewAdded = typeof opts.isNewAdded === 'function' ? opts.isNewAdded : function() { return false; };
    var getPageSize = typeof opts.getPageSize === 'function' ? opts.getPageSize : function() { return 20; };

    function ensureSelection(view) {
      view.selection = view.selection instanceof Set ? view.selection : new Set();
      return view.selection;
    }

    function ensureFilters(view) {
      view.typeFilters = view.typeFilters instanceof Set ? view.typeFilters : new Set();
      return view.typeFilters;
    }

    function getModuleName(moduleId) {
      var view = getView() || {};
      var list = Array.isArray(view.modules) ? view.modules : [];
      for (var i = 0; i < list.length; i += 1) {
        var module = list[i];
        if (module && String(module.id) === String(moduleId)) {
          return module.name || ('模块#' + module.id);
        }
      }
      return '模块#' + moduleId;
    }

    function updateMeta() {
      if (!dom.missingProject || !dom.missingModules) return;
      var view = getView() || {};
      dom.missingProject.textContent = view.projectId ? getProjectName(view.projectId) : '--';
      var modules = Array.isArray(view.modules) ? view.modules : [];
      if (!modules.length) {
        dom.missingModules.textContent = '--';
        return;
      }
      var names = modules.map(function(module) {
        return module && module.name ? String(module.name) : ('模块#' + (module && module.id ? module.id : ''));
      });
      var display = names.slice(0, 6).join('、');
      if (names.length > 6) display += ' 等' + names.length + '个';
      dom.missingModules.textContent = display;
    }

    function syncRowInput(index, item, options) {
      if (!dom.missingView || !dom.missingView.querySelector || !item) return false;
      var idx = Number(index);
      if (!isFinite(idx)) return false;
      var config = options || {};
      var fields = [
        { key: 'title', multiline: false, required: true },
        { key: 'priority', multiline: false },
        { key: 'precondition', multiline: true },
        { key: 'steps', multiline: true },
        { key: 'expected', multiline: true, required: true },
      ];
      var changed = false;
      fields.forEach(function(meta) {
        var selector = '[data-case-lib-missing-field="' + meta.key + '"][data-index="' + idx + '"]';
        var cell = dom.missingView.querySelector(selector);
        if (!cell) return;
        var raw = meta.multiline ? cell.innerText : cell.textContent;
        var next = normalizeText(raw);
        if (meta.key === 'priority') next = normalizePriority(next);
        if (config.skipEmptyRequired === true && meta.required && !next) return;
        if (item[meta.key] !== next) {
          item[meta.key] = next;
          changed = true;
        }
      });
      return changed;
    }

    function buildPagination(page) {
      var currentPage = page.totalPages ? page.pageIndex + 1 : 1;
      var rangeInfo = page.total ? ('显示 ' + (page.start + 1) + '-' + page.end + ' / 共 ' + page.total + ' 条') : '暂无记录';
      return (
        '<div class="temp-pagination" data-case-lib-missing-pagination="1">' +
          '<div class="temp-pagination-info">' + escapeHtml(rangeInfo) + '，每页 ' + page.pageSize + ' 条</div>' +
          '<div class="temp-pagination-controls">' +
            '<button type="button" class="secondary" data-case-lib-missing-page="prev" ' + (page.pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
            '<span>第 ' + currentPage + ' / ' + page.totalPages + ' 页</span>' +
            '<button type="button" class="secondary" data-case-lib-missing-page="next" ' + (page.pageIndex >= page.totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
            '<label>跳至<input type="number" min="1" max="' + page.totalPages + '" value="' + currentPage + '" data-case-lib-missing-page-input>页</label>' +
          '</div>' +
        '</div>'
      );
    }

    function buildTypeSelectOptions(list, activeId) {
      var active = activeId ? String(activeId) : '';
      var options = [];
      var emptySelected = active ? '' : ' selected';
      options.push('<option value=""' + emptySelected + '>' + (list.length ? '未设置' : '暂无类型') + '</option>');
      var hasActive = false;
      list.forEach(function(type) {
        if (!type || type.id === null || type.id === undefined) return;
        var id = String(type.id);
        var selected = active && id === active ? ' selected' : '';
        if (selected) hasActive = true;
        options.push('<option value="' + escapeHtml(id) + '"' + selected + '>' + escapeHtml(type.name || ('类型#' + type.id)) + '</option>');
      });
      if (active && !hasActive) {
        options.push('<option value="' + escapeHtml(active) + '" selected>类型#' + escapeHtml(active) + '</option>');
      }
      options.push('<option value="__add_type__">＋ 新增类型</option>');
      return options.join('');
    }

    function buildTypeSelectContent(item, index) {
      var types = Array.isArray(getTypes()) ? getTypes() : [];
      var slots = ensureTypeSlots(item);
      var rows = slots.map(function(activeId, slotIndex) {
        return (
          '<div class="case-library-missing-type-row">' +
            '<select class="case-library-missing-type-select" data-case-lib-missing-type data-index="' + index + '" data-type-index="' + slotIndex + '">' +
              buildTypeSelectOptions(types, activeId) +
            '</select>' +
            '<button type="button" class="case-library-missing-type-remove" data-case-lib-missing-type-remove data-index="' + index + '" data-type-index="' + slotIndex + '">×</button>' +
          '</div>'
        );
      }).join('');
      var addButton = slots.length < 3
        ? '<button type="button" class="case-library-missing-type-add" data-case-lib-missing-type-add data-index="' + index + '">＋ 新增</button>'
        : '';
      return '<div class="case-library-missing-type-group">' + rows + addButton + '</div>';
    }

    function renderTypePills(items) {
      if (!dom.missingTypePills) return;
      var pills = model.buildTypePills(items, getTypes());
      if (!pills.length) {
        dom.missingTypePills.innerHTML = '';
        return;
      }
      var filters = ensureFilters(getView());
      dom.missingTypePills.innerHTML = pills.map(function(pill) {
        var active = filters.size && filters.has(String(pill.key)) ? ' active' : '';
        return (
          '<button type="button" class="summary-pill case-library-missing-type-pill' + active + '" ' +
            'data-case-lib-missing-type-pill="' + escapeHtml(String(pill.key)) + '">' +
            escapeHtml(pill.label) + ' ' + pill.count +
          '</button>'
        );
      }).join('');
    }

    function syncBatchDeleteControls() {
      if (!dom.missingBatchDeleteBtn) return;
      var view = getView();
      var selected = view && view.selection && typeof view.selection.size === 'number' ? view.selection.size : 0;
      var disabled = !view || !view.modules || !view.modules.length || !selected || Boolean(view.pendingOp);
      dom.missingBatchDeleteBtn.textContent = '批量删除' + (selected ? ('（' + selected + '）') : '');
      dom.missingBatchDeleteBtn.disabled = disabled;
    }

    function render() {
      if (!dom.missingView) return null;
      var view = getView() || {};
      var modules = Array.isArray(view.modules) ? view.modules : [];
      if (!modules.length) {
        dom.missingView.innerHTML = '<p class="hint">请先选择模块查看易漏用例</p>';
        if (dom.missingTypePills) dom.missingTypePills.innerHTML = '';
        syncBatchDeleteControls();
        return null;
      }
      var items = Array.isArray(view.items) ? view.items : [];
      renderTypePills(items);
      var page = model.resolvePage(items, ensureFilters(view), view.pageIndex, getPageSize());
      view.pageIndex = page.pageIndex;
      var selection = ensureSelection(view);
      var visibleIndexes = [];
      var rows = page.pagedIndexes.map(function(index) {
        var item = items[index];
        visibleIndexes.push(index);
        var moduleName = item && (item.module_name || getModuleName(item.module_id));
        var title = stripInvisibleMarkers(item && item.title ? item.title : '');
        var priority = normalizePriority(stripInvisibleMarkers(item && item.priority ? item.priority : ''));
        var precondition = stripInvisibleMarkers(item && item.precondition ? item.precondition : '');
        var steps = stripInvisibleMarkers(item && item.steps ? item.steps : '');
        var expected = stripInvisibleMarkers(item && item.expected ? item.expected : '');
        var rowClass = 'case-row' + (isNewAdded(item && item.module_id ? item.module_id : null, item) ? ' new-added' : '');
        return (
          '<tr class="' + rowClass + '">' +
            '<td class="check"><input type="checkbox" data-case-lib-missing-select data-index="' + index + '" ' + (selection.has(index) ? 'checked' : '') + '></td>' +
            '<td class="index">' + (index + 1) + '</td>' +
            '<td class="type" data-case-lib-missing-type-cell="' + index + '">' + buildTypeSelectContent(item, index) + '</td>' +
            '<td class="module">' + escapeHtml(moduleName || '--') + '</td>' +
            '<td class="title"><div class="temp-inline-edit" contenteditable="true" data-case-lib-missing-field="title" data-index="' + index + '" data-case-lib-missing-multiline="false" data-placeholder="点击此处编辑">' + escapeHtml(title) + '</div></td>' +
            '<td class="priority"><div class="temp-inline-edit" contenteditable="true" data-case-lib-missing-field="priority" data-index="' + index + '" data-case-lib-missing-multiline="false" data-placeholder="点击此处编辑">' + escapeHtml(priority) + '</div></td>' +
            '<td><div class="temp-inline-edit" contenteditable="true" data-case-lib-missing-field="precondition" data-index="' + index + '" data-case-lib-missing-multiline="true" data-placeholder="点击此处编辑">' + escapeHtml(precondition).replace(/\n/g, '<br>') + '</div></td>' +
            '<td><div class="temp-inline-edit" contenteditable="true" data-case-lib-missing-field="steps" data-index="' + index + '" data-case-lib-missing-multiline="true" data-placeholder="点击此处编辑">' + escapeHtml(steps).replace(/\n/g, '<br>') + '</div></td>' +
            '<td><div class="temp-inline-edit" contenteditable="true" data-case-lib-missing-field="expected" data-index="' + index + '" data-case-lib-missing-multiline="true" data-placeholder="点击此处编辑">' + escapeHtml(expected).replace(/\n/g, '<br>') + '</div></td>' +
            '<td class="ops"><div class="case-ops">' +
              '<button type="button" class="case-op remove" title="删除当前条目" data-case-lib-missing-remove data-index="' + index + '">−</button>' +
              '<button type="button" class="case-op add" title="在下方插入条目" data-case-lib-missing-insert data-index="' + index + '">＋</button>' +
            '</div></td>' +
          '</tr>'
        );
      }).join('');
      var allSelected = visibleIndexes.length && visibleIndexes.every(function(index) { return selection.has(index); });
      var headerCheckbox = '<th class="check"><input type="checkbox" data-case-lib-missing-select-all data-visible="' + visibleIndexes.join(',') + '" ' +
        (visibleIndexes.length ? (allSelected ? 'checked' : '') : 'disabled') + '></th>';
      var emptyRow = '';
      if (!page.total) {
        emptyRow = items.length
          ? '<tr class="case-row case-library-missing-empty"><td colspan="10"><p class="hint">暂无匹配类型</p></td></tr>'
          : '<tr class="case-row case-library-missing-empty"><td colspan="10"><button type="button" class="secondary" data-case-lib-missing-empty-add>＋ 新增条目</button></td></tr>';
      }
      var pagination = buildPagination(page);
      dom.missingView.innerHTML = pagination + '<table><thead><tr>' + headerCheckbox +
        '<th class="index">编号</th><th class="type">类型</th><th class="module">模块</th>' +
        '<th class="title">用例标题</th><th class="priority">优先级</th><th>前提条件</th>' +
        '<th>操作步骤</th><th>预期结果</th><th class="ops" title="增删">增删</th>' +
        '</tr></thead><tbody>' + (rows || emptyRow) + '</tbody></table>' + pagination;
      syncBatchDeleteControls();
      return page;
    }

    function refreshTypeCell(index) {
      if (!dom.missingView || !dom.missingView.querySelector) return;
      var cell = dom.missingView.querySelector('td[data-case-lib-missing-type-cell="' + index + '"]');
      var view = getView() || {};
      var item = view.items && view.items[index];
      if (cell && item) cell.innerHTML = buildTypeSelectContent(item, index);
    }

    function refreshTypeCells() {
      if (!dom.missingView || !dom.missingView.querySelectorAll) return;
      var cells = dom.missingView.querySelectorAll('td[data-case-lib-missing-type-cell]');
      var view = getView() || {};
      for (var i = 0; i < cells.length; i += 1) {
        var index = Number(cells[i].getAttribute('data-case-lib-missing-type-cell'));
        var item = view.items && view.items[index];
        if (isFinite(index) && item) cells[i].innerHTML = buildTypeSelectContent(item, index);
      }
    }

    return {
      getModuleName: getModuleName,
      resolveTypeLabel: model.resolveTypeLabel,
      updateMeta: updateMeta,
      syncRowInput: syncRowInput,
      renderTypePills: renderTypePills,
      render: render,
      refreshTypeCell: refreshTypeCell,
      refreshTypeCells: refreshTypeCells,
      syncBatchDeleteControls: syncBatchDeleteControls,
    };
  }

  return { create: create };
});
