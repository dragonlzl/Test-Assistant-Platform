(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.selectExecViewAdapter = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var syncProjectOptions = typeof opts.syncProjectOptions === 'function'
      ? opts.syncProjectOptions
      : function() {};
    var syncVersionOptions = typeof opts.syncVersionOptions === 'function'
      ? opts.syncVersionOptions
      : function() {};
    var bound = false;

    function getProjectValue() {
      return dom.selectProjectSelect ? dom.selectProjectSelect.value : '';
    }

    function getVersionValue() {
      return dom.selectVersionSelect ? dom.selectVersionSelect.value : '';
    }

    function getSearchValue() {
      return dom.selectSearchInput ? dom.selectSearchInput.value : '';
    }

    function setProjectValue(value) {
      if (dom.selectProjectSelect) dom.selectProjectSelect.value = value ? String(value) : '';
    }

    function setVersionValue(value) {
      if (dom.selectVersionSelect) dom.selectVersionSelect.value = value ? String(value) : '';
    }

    function setSearchValue(value) {
      if (dom.selectSearchInput) dom.selectSearchInput.value = String(value || '');
    }

    function setDrawerStatus(text, type) {
      setStatus(dom.selectStatus, text, type);
    }

    function resetVersions() {
      if (!dom.selectVersionSelect) return;
      dom.selectVersionSelect.disabled = true;
      dom.selectVersionSelect.innerHTML = '<option value="">全部版本</option>';
      dom.selectVersionSelect.value = '';
    }

    function renderVersions(projectId, preferredVersionId, versions) {
      if (!dom.selectVersionSelect) return null;
      syncVersionOptions(dom.selectVersionSelect, projectId, '全部版本');
      dom.selectVersionSelect.disabled = false;
      var desired = preferredVersionId ? String(preferredVersionId) : '';
      var exists = desired && (Array.isArray(versions) ? versions : []).some(function(version) {
        return version && String(version.id) === desired;
      });
      dom.selectVersionSelect.value = exists ? desired : '';
      return exists ? preferredVersionId : null;
    }

    function reset() {
      setDrawerStatus('', '');
      syncProjectOptions(dom.selectProjectSelect, '请选择项目');
      setProjectValue('');
      resetVersions();
      setSearchValue('');
    }

    function clickOpenButton() {
      var button = dom.selectOpenButton || null;
      if (!button || typeof button.click !== 'function') return false;
      button.click();
      return true;
    }

    function bindEvents(handlers) {
      if (bound) return;
      bound = true;
      var actions = handlers && typeof handlers === 'object' ? handlers : {};
      var bindings = [
        [dom.selectProjectSelect, 'change', actions.onProjectChange],
        [dom.selectVersionSelect, 'change', actions.onVersionChange],
        [dom.selectConfirmBtn, 'click', actions.onRefresh],
        [dom.selectBatchExecBtn, 'click', actions.onBatchExec],
      ];
      bindings.forEach(function(binding) {
        if (binding[0] && typeof binding[2] === 'function') {
          binding[0].addEventListener(binding[1], binding[2]);
        }
      });
    }

    return {
      getProjectValue: getProjectValue,
      getVersionValue: getVersionValue,
      getSearchValue: getSearchValue,
      setProjectValue: setProjectValue,
      setVersionValue: setVersionValue,
      setSearchValue: setSearchValue,
      setDrawerStatus: setDrawerStatus,
      resetVersions: resetVersions,
      renderVersions: renderVersions,
      reset: reset,
      clickOpenButton: clickOpenButton,
      bindEvents: bindEvents,
    };
  }

  return { create: create };
});
