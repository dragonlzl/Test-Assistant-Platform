(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.shareViewAdapter = api;
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
      setStatus(dom.shareDrawerStatus, text || '', type || '');
    }

    function getProjectValue() {
      return dom.shareDrawerProjectSelect ? dom.shareDrawerProjectSelect.value : '';
    }

    function getVersionValue() {
      return dom.shareDrawerVersionSelect ? dom.shareDrawerVersionSelect.value : '';
    }

    function renderProjectOptions(projects, projectNameById, sortProjects) {
      if (!dom.shareDrawerProjectSelect) return;
      var list = Array.isArray(projects) ? projects.slice() : [];
      if (typeof sortProjects === 'function') list = sortProjects(list);
      var selected = String(dom.shareDrawerProjectSelect.value || '');
      var options = ['<option value="">请选择项目</option>'];
      list.forEach(function(project) {
        if (!project) return;
        var name = project.name || ('项目#' + project.id);
        projectNameById[project.id] = name;
        options.push('<option value="' + escapeHtml(project.id) + '">' + escapeHtml(name) + '</option>');
      });
      dom.shareDrawerProjectSelect.innerHTML = options.join('');
      if (selected) dom.shareDrawerProjectSelect.value = selected;
    }

    function renderVersionOptions(versions, versionNameById) {
      if (!dom.shareDrawerVersionSelect) return;
      var list = Array.isArray(versions) ? versions : [];
      if (!list.length) {
        dom.shareDrawerVersionSelect.disabled = true;
        dom.shareDrawerVersionSelect.innerHTML = '<option value="">无需选择版本</option>';
        dom.shareDrawerVersionSelect.value = '';
        return;
      }
      var options = ['<option value="">请选择版本</option>'];
      list.forEach(function(version) {
        if (!version) return;
        var name = version.name || ('版本#' + version.id);
        versionNameById[version.id] = name;
        options.push('<option value="' + escapeHtml(version.id) + '">' + escapeHtml(name) + '</option>');
      });
      dom.shareDrawerVersionSelect.disabled = false;
      dom.shareDrawerVersionSelect.innerHTML = options.join('');
      dom.shareDrawerVersionSelect.value = '';
    }

    function showVersionLoading() {
      if (!dom.shareDrawerVersionSelect) return;
      dom.shareDrawerVersionSelect.disabled = true;
      dom.shareDrawerVersionSelect.innerHTML = '<option value="">加载版本中...</option>';
    }

    function showVersionPlaceholder() {
      if (!dom.shareDrawerVersionSelect) return;
      dom.shareDrawerVersionSelect.disabled = true;
      dom.shareDrawerVersionSelect.innerHTML = '<option value="">请选择版本</option>';
      dom.shareDrawerVersionSelect.value = '';
    }

    function showVersionError() {
      if (!dom.shareDrawerVersionSelect) return;
      dom.shareDrawerVersionSelect.disabled = true;
      dom.shareDrawerVersionSelect.innerHTML = '<option value="">加载版本失败</option>';
    }

    function resetControls() {
      if (dom.shareDrawerProjectSelect) {
        dom.shareDrawerProjectSelect.innerHTML = '<option value="">请选择项目</option>';
        dom.shareDrawerProjectSelect.value = '';
      }
      showVersionPlaceholder();
      setDrawerStatus('', '');
    }

    function renderMeta(files, getProjectName, getVersionName) {
      var list = Array.isArray(files) ? files : [];
      var count = list.length;
      var caseName = '--';
      if (count === 1) caseName = list[0].file_name_clean || ('用例#' + list[0].id);
      else if (count > 1) caseName = '已选 ' + count + ' 份用例';
      if (dom.shareDrawerCaseName) dom.shareDrawerCaseName.textContent = caseName;

      var projectName = '--';
      if (count) {
        var projectId = list[0].project_id;
        var sameProject = list.every(function(item) {
          return item && String(item.project_id) === String(projectId);
        });
        projectName = sameProject ? getProjectName(projectId) : '多个项目';
      }
      if (dom.shareDrawerSourceProject) dom.shareDrawerSourceProject.textContent = projectName;

      var versionName = '--';
      if (count) {
        var versionId = list[0].version_id;
        var sameVersion = list.every(function(item) {
          return item && String(item.version_id) === String(versionId);
        });
        versionName = sameVersion ? getVersionName(list[0].project_id, versionId) : '多个版本';
      }
      if (dom.shareDrawerSourceVersion) dom.shareDrawerSourceVersion.textContent = versionName;
    }

    function syncControls(state, files, requiresVersion) {
      if (!dom.shareDrawerConfirmBtn) return;
      var source = state && typeof state === 'object' ? state : {};
      var hasFiles = Array.isArray(files) && files.length > 0;
      var needsVersion = source.projectId && requiresVersion(source.projectId);
      dom.shareDrawerConfirmBtn.disabled = Boolean(
        source.loading ||
        source.versionLoadFailed ||
        !hasFiles ||
        !source.projectId ||
        (needsVersion && !source.versionId)
      );
    }

    return {
      setDrawerStatus: setDrawerStatus,
      getProjectValue: getProjectValue,
      getVersionValue: getVersionValue,
      renderProjectOptions: renderProjectOptions,
      renderVersionOptions: renderVersionOptions,
      showVersionLoading: showVersionLoading,
      showVersionPlaceholder: showVersionPlaceholder,
      showVersionError: showVersionError,
      resetControls: resetControls,
      renderMeta: renderMeta,
      syncControls: syncControls,
    };
  }

  return { create: create };
});
