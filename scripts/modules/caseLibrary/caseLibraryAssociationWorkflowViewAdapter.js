(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.associationWorkflowViewAdapter = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var syncVersionOptions = typeof opts.syncVersionOptions === 'function'
      ? opts.syncVersionOptions
      : function() {};
    var bound = false;

    function syncAddButton(disabled) {
      if (dom.associationAddBtn) dom.associationAddBtn.disabled = disabled === true;
    }

    function resetMain() {
      if (dom.associationCaseName) dom.associationCaseName.textContent = '--';
      setStatus(dom.associationStatus, '', '');
    }

    function setMainCaseName(caseFile) {
      if (!dom.associationCaseName) return;
      dom.associationCaseName.textContent = caseFile && caseFile.file_name_clean
        ? caseFile.file_name_clean
        : ('用例#' + (caseFile && caseFile.id ? caseFile.id : ''));
    }

    function setMainStatus(text, type) {
      setStatus(dom.associationStatus, text, type);
    }

    function resetPick() {
      setStatus(dom.associationPickStatus, '', '');
      if (dom.associationPickVersionSelect) {
        dom.associationPickVersionSelect.disabled = true;
        dom.associationPickVersionSelect.innerHTML = '<option value="">请选择版本</option>';
        dom.associationPickVersionSelect.value = '';
      }
      if (dom.associationPickSubCaseName) dom.associationPickSubCaseName.textContent = '--';
    }

    function renderVersionLoading() {
      if (!dom.associationPickVersionSelect) return;
      dom.associationPickVersionSelect.disabled = true;
      dom.associationPickVersionSelect.innerHTML = '<option value="">加载版本中...</option>';
      dom.associationPickVersionSelect.value = '';
    }

    function renderVersions(projectId, preferredVersionId) {
      if (!dom.associationPickVersionSelect) return null;
      syncVersionOptions(dom.associationPickVersionSelect, projectId, '请选择版本');
      dom.associationPickVersionSelect.disabled = false;
      dom.associationPickVersionSelect.value = preferredVersionId ? String(preferredVersionId) : '';
      return preferredVersionId || null;
    }

    function renderVersionError() {
      if (!dom.associationPickVersionSelect) return;
      dom.associationPickVersionSelect.disabled = true;
      dom.associationPickVersionSelect.innerHTML = '<option value="">加载版本失败</option>';
      dom.associationPickVersionSelect.value = '';
    }

    function getVersionValue() {
      return dom.associationPickVersionSelect ? dom.associationPickVersionSelect.value : '';
    }

    function setPickStatus(text, type) {
      setStatus(dom.associationPickStatus, text, type);
    }

    function setSubCaseName(subCase) {
      if (!dom.associationPickSubCaseName) return;
      dom.associationPickSubCaseName.textContent = subCase && subCase.file_name_clean
        ? subCase.file_name_clean
        : ('用例#' + (subCase && subCase.id ? subCase.id : ''));
    }

    function setConfirmDisabled(disabled) {
      if (dom.associationPickConfirmBtn) dom.associationPickConfirmBtn.disabled = disabled === true;
    }

    function bindEvents(handlers) {
      if (bound) return;
      bound = true;
      var actions = handlers && typeof handlers === 'object' ? handlers : {};
      var bindings = [
        [dom.associationAddBtn, 'click', actions.onAdd],
        [dom.associationPickVersionSelect, 'change', actions.onVersionChange],
        [dom.associationPickQueryBtn, 'click', actions.onQuery],
        [dom.associationPickRefreshBtn, 'click', actions.onRefresh],
        [dom.associationPickNextBtn, 'click', actions.onNext],
        [dom.associationPickConfirmBtn, 'click', actions.onConfirm],
        [dom.associationDeleteConfirmBtn, 'click', actions.onDeleteConfirm],
      ];
      bindings.forEach(function(binding) {
        if (binding[0] && typeof binding[2] === 'function') {
          binding[0].addEventListener(binding[1], binding[2]);
        }
      });
    }

    return {
      syncAddButton: syncAddButton,
      resetMain: resetMain,
      setMainCaseName: setMainCaseName,
      setMainStatus: setMainStatus,
      resetPick: resetPick,
      renderVersionLoading: renderVersionLoading,
      renderVersions: renderVersions,
      renderVersionError: renderVersionError,
      getVersionValue: getVersionValue,
      setPickStatus: setPickStatus,
      setSubCaseName: setSubCaseName,
      setConfirmDisabled: setConfirmDisabled,
      bindEvents: bindEvents,
    };
  }

  return { create: create };
});
