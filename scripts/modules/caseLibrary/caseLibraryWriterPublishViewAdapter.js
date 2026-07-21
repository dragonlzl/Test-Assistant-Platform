(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.writerPublishViewAdapter = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var cleanFileName = typeof opts.cleanFileName === 'function'
      ? opts.cleanFileName
      : function(value) { return String(value || ''); };
    var syncProjectOptions = typeof opts.syncProjectOptions === 'function'
      ? opts.syncProjectOptions
      : function() {};
    var syncVersionOptions = typeof opts.syncVersionOptions === 'function'
      ? opts.syncVersionOptions
      : function() {};
    var bound = false;

    function syncConfirmEnabled(writer) {
      if (!dom.writerPublishConfirmBtn) return;
      var current = writer && typeof writer === 'object' ? writer : {};
      var canConfirm = Boolean(
        !current.publishing &&
        current.projectId &&
        current.versionId &&
        current.fileNameInput &&
        current.fileNameClean &&
        !current.fileNameChecking &&
        Array.isArray(current.draftItems) &&
        current.draftItems.length
      );
      dom.writerPublishConfirmBtn.disabled = !canConfirm;
    }

    function syncFileNameStatus(writer) {
      if (!dom.writerPublishFileNameStatus) return;
      var current = writer && typeof writer === 'object' ? writer : {};
      if (!current.fileNameInput || !current.fileNameClean) {
        setStatus(dom.writerPublishFileNameStatus, '请输入用例文件名（必填）', 'warn');
        return;
      }
      if (!current.projectId) {
        setStatus(dom.writerPublishFileNameStatus, '请选择项目后自动校验重名', '');
        return;
      }
      if (current.fileNameChecking) {
        setStatus(dom.writerPublishFileNameStatus, '正在校验重名...', '');
        return;
      }
      if (current.fileNameDuplicate) {
        setStatus(
          dom.writerPublishFileNameStatus,
          '检测到同名用例：' + current.fileNameClean + '，可继续确认并在下一步决定是否覆盖',
          'warn'
        );
        return;
      }
      setStatus(dom.writerPublishFileNameStatus, '文件名可用：' + current.fileNameClean, 'ok');
    }

    function renderHint(writer) {
      if (!dom.writerPublishHint) return;
      var current = writer && typeof writer === 'object' ? writer : {};
      var count = Array.isArray(current.draftItems) ? current.draftItems.length : 0;
      var cleanName = current.fileNameClean || cleanFileName(current.draftFileName || '编写用例');
      dom.writerPublishHint.textContent =
        '待入库用例 ' + count + ' 条；文件名：' + (cleanName || '编写用例') + '。请选择项目和版本后确认入库。';
    }

    function setFileNameInput(value) {
      if (!dom.writerPublishFileNameInput) return;
      var next = String(value || '');
      if (dom.writerPublishFileNameInput.value !== next) dom.writerPublishFileNameInput.value = next;
    }

    function getFileNameInput() {
      return dom.writerPublishFileNameInput ? dom.writerPublishFileNameInput.value : '';
    }

    function getProjectValue() {
      return dom.writerPublishProjectSelect ? dom.writerPublishProjectSelect.value : '';
    }

    function getVersionValue() {
      return dom.writerPublishVersionSelect ? dom.writerPublishVersionSelect.value : '';
    }

    function renderProjectLoading() {
      if (!dom.writerPublishProjectSelect) return;
      dom.writerPublishProjectSelect.innerHTML = '<option value="">加载项目中...</option>';
      dom.writerPublishProjectSelect.value = '';
    }

    function renderProjects(preferredProjectId) {
      if (!dom.writerPublishProjectSelect) return;
      syncProjectOptions(dom.writerPublishProjectSelect, '请选择项目');
      dom.writerPublishProjectSelect.value = preferredProjectId ? String(preferredProjectId) : '';
    }

    function resetVersions(message) {
      if (!dom.writerPublishVersionSelect) return;
      dom.writerPublishVersionSelect.disabled = true;
      dom.writerPublishVersionSelect.innerHTML = '<option value="">' + (message || '请选择版本') + '</option>';
      dom.writerPublishVersionSelect.value = '';
    }

    function renderVersions(projectId, preferredVersionId, versions) {
      if (!dom.writerPublishVersionSelect) return null;
      syncVersionOptions(dom.writerPublishVersionSelect, projectId, '请选择版本', true);
      dom.writerPublishVersionSelect.disabled = false;
      var desired = preferredVersionId ? String(preferredVersionId) : '';
      var list = Array.isArray(versions) ? versions : [];
      var exists = desired && list.some(function(version) {
        return version && String(version.id) === desired;
      });
      dom.writerPublishVersionSelect.value = exists ? desired : '';
      return exists ? preferredVersionId : null;
    }

    function setVersionValue(value) {
      if (dom.writerPublishVersionSelect) {
        dom.writerPublishVersionSelect.value = value ? String(value) : '';
      }
    }

    function setVersionDisabled(disabled) {
      if (dom.writerPublishVersionSelect) dom.writerPublishVersionSelect.disabled = disabled === true;
    }

    function setMainStatus(text, type) {
      setStatus(dom.writerPublishStatus, text, type);
    }

    function setFileNameStatus(text, type) {
      setStatus(dom.writerPublishFileNameStatus, text, type);
    }

    function clearStatuses() {
      setStatus(dom.writerPublishFileNameStatus, '', '');
      setStatus(dom.writerPublishStatus, '', '');
    }

    function bindEvents(handlers) {
      if (bound) return;
      bound = true;
      var actions = handlers && typeof handlers === 'object' ? handlers : {};
      if (dom.writerPublishProjectSelect && typeof actions.onProjectChange === 'function') {
        dom.writerPublishProjectSelect.addEventListener('change', actions.onProjectChange);
      }
      if (dom.writerPublishFileNameInput && typeof actions.onFileNameInput === 'function') {
        dom.writerPublishFileNameInput.addEventListener('input', actions.onFileNameInput);
        dom.writerPublishFileNameInput.addEventListener('change', actions.onFileNameInput);
      }
      if (dom.writerPublishVersionSelect && typeof actions.onVersionChange === 'function') {
        dom.writerPublishVersionSelect.addEventListener('change', actions.onVersionChange);
      }
      if (dom.writerPublishConfirmBtn && typeof actions.onConfirm === 'function') {
        dom.writerPublishConfirmBtn.addEventListener('click', actions.onConfirm);
      }
    }

    return {
      syncConfirmEnabled: syncConfirmEnabled,
      syncFileNameStatus: syncFileNameStatus,
      renderHint: renderHint,
      setFileNameInput: setFileNameInput,
      getFileNameInput: getFileNameInput,
      getProjectValue: getProjectValue,
      getVersionValue: getVersionValue,
      renderProjectLoading: renderProjectLoading,
      renderProjects: renderProjects,
      resetVersions: resetVersions,
      renderVersions: renderVersions,
      setVersionValue: setVersionValue,
      setVersionDisabled: setVersionDisabled,
      setMainStatus: setMainStatus,
      setFileNameStatus: setFileNameStatus,
      clearStatuses: clearStatuses,
      bindEvents: bindEvents,
    };
  }

  return { create: create };
});
