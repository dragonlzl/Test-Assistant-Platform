(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.missingCatalogMaintenanceViewAdapter = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var escapeHtml = typeof opts.escapeHtml === 'function'
      ? opts.escapeHtml
      : function(value) { return String(value === null || value === undefined ? '' : value); };
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};

    function setDrawerStatus(text, type) {
      setStatus(dom.missingDrawerStatus, text || '', type || '');
    }

    function setTypeAddStatus(text, type) {
      setStatus(dom.missingTypeAddStatus, text || '', type || '');
    }

    function setTypeManageStatus(text, type) {
      setStatus(dom.missingTypeManageStatus, text || '', type || '');
    }

    function setModuleAddStatus(text, type) {
      setStatus(dom.missingAddStatus, text || '', type || '');
    }

    function setModuleEditStatus(text, type) {
      setStatus(dom.missingEditStatus, text || '', type || '');
    }

    function prepareTypeAdd(projectName) {
      if (dom.missingTypeAddProjectName) dom.missingTypeAddProjectName.textContent = projectName || '';
      if (dom.missingTypeNameInput) dom.missingTypeNameInput.value = '';
      setTypeAddStatus('', '');
    }

    function getTypeName() {
      return dom.missingTypeNameInput ? String(dom.missingTypeNameInput.value || '').trim() : '';
    }

    function renderTypeManage(types, canDelete) {
      if (!dom.missingTypeManageBody) return;
      var list = Array.isArray(types) ? types : [];
      if (!list.length) {
        dom.missingTypeManageBody.innerHTML = '<p class="hint">暂无类型</p>';
        return;
      }
      dom.missingTypeManageBody.innerHTML = list.map(function(type) {
        if (!type || type.id === null || type.id === undefined) return '';
        var id = String(type.id);
        var count = Number(type.item_count);
        if (!Number.isFinite(count) || count < 0) count = 0;
        var actions = canDelete
          ? '<button class="secondary danger" type="button" data-case-lib-missing-type-delete="' + escapeHtml(id) + '">删除</button>'
          : '';
        return (
          '<div class="case-library-missing-type-manage-item">' +
            '<div class="case-library-missing-type-name">' + escapeHtml(type.name || ('类型#' + type.id)) + '</div>' +
            '<div class="case-library-missing-type-count">关联 ' + count + ' 条</div>' +
            '<div class="case-library-missing-type-actions">' + actions + '</div>' +
          '</div>'
        );
      }).join('');
    }

    function prepareModuleAdd(projectName) {
      if (dom.missingAddProjectName) dom.missingAddProjectName.textContent = projectName || '';
      if (dom.missingAddModuleNameInput) dom.missingAddModuleNameInput.value = '';
      setModuleAddStatus('', '');
    }

    function getModuleAddName() {
      return dom.missingAddModuleNameInput ? String(dom.missingAddModuleNameInput.value || '').trim() : '';
    }

    function prepareModuleEdit(projectName, moduleName) {
      if (dom.missingEditProjectName) dom.missingEditProjectName.textContent = projectName || '';
      if (dom.missingEditModuleNameInput) dom.missingEditModuleNameInput.value = moduleName || '';
      setModuleEditStatus('', '');
    }

    function getModuleEditName() {
      return dom.missingEditModuleNameInput ? String(dom.missingEditModuleNameInput.value || '').trim() : '';
    }

    return {
      setDrawerStatus: setDrawerStatus,
      setTypeAddStatus: setTypeAddStatus,
      setTypeManageStatus: setTypeManageStatus,
      setModuleAddStatus: setModuleAddStatus,
      setModuleEditStatus: setModuleEditStatus,
      prepareTypeAdd: prepareTypeAdd,
      getTypeName: getTypeName,
      renderTypeManage: renderTypeManage,
      prepareModuleAdd: prepareModuleAdd,
      getModuleAddName: getModuleAddName,
      prepareModuleEdit: prepareModuleEdit,
      getModuleEditName: getModuleEditName,
    };
  }

  return { create: create };
});
