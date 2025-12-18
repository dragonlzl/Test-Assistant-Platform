(function() {
  function init() {
    var drawer = null;
    var resolved = false;
    var resolveFn = null;
    var loading = false;
    var ctxState = null;

    var dom = {
      drawer: document.getElementById('execVersionSelectDrawer'),
      title: document.getElementById('execVersionSelectDrawerTitle'),
      hint: document.getElementById('execVersionSelectDrawerHint'),
      project: document.getElementById('execVersionSelectDrawerProject'),
      importVersion: document.getElementById('execVersionSelectDrawerImportVersion'),
      versionSelect: document.getElementById('execVersionSelectDrawerVersionSelect'),
      status: document.getElementById('execVersionSelectDrawerStatus'),
      confirmBtn: document.getElementById('execVersionSelectDrawerConfirmBtn'),
    };

    function getUtils() {
      return window.app && window.app.utils ? window.app.utils : null;
    }

    function setStatus(text, type) {
      var utils = getUtils();
      if (utils && typeof utils.setStatus === 'function') {
        utils.setStatus(dom.status, text || '', type || '');
        return;
      }
      if (!dom.status) return;
      dom.status.textContent = text || '';
      dom.status.className = ['status', type || ''].filter(Boolean).join(' ');
    }

    function ensureDrawer() {
      if (drawer) return drawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      drawer = window.app.drawer.createDrawer({
        drawerId: 'execVersionSelectDrawer',
        openButtons: [],
        closeButtons: [],
        onClose: function() {
          loading = false;
          if (dom.confirmBtn) dom.confirmBtn.disabled = true;
          if (dom.versionSelect) dom.versionSelect.disabled = true;
          if (dom.versionSelect) dom.versionSelect.innerHTML = '<option value=\"\">加载中...</option>';
          setStatus('', '');
          if (!resolved) {
            resolved = true;
            if (typeof resolveFn === 'function') resolveFn({ ok: false, reason: 'cancel' });
          }
          resolveFn = null;
          ctxState = null;
        },
      });
      return drawer;
    }

    function sortVersionsByLatest(list) {
      var versions = Array.isArray(list) ? list.slice() : [];
      function parseTime(v) {
        if (!v) return 0;
        var raw = v.updated_at || v.created_at || '';
        var t = Date.parse(raw);
        return isFinite(t) ? t : 0;
      }
      versions.sort(function(a, b) {
        var ta = parseTime(a);
        var tb = parseTime(b);
        if (tb !== ta) return tb - ta;
        var ia = Number(a && a.id);
        var ib = Number(b && b.id);
        if (isFinite(ia) && isFinite(ib) && ib !== ia) return ib - ia;
        return String(b && b.name || '').localeCompare(String(a && a.name || ''), 'zh-Hans-CN');
      });
      return versions;
    }

    function guessLatestVersionId(list) {
      var sorted = sortVersionsByLatest(list);
      var first = sorted.length ? sorted[0] : null;
      return first && (first.id || first.id === 0) ? String(first.id) : '';
    }

    function renderVersionOptions(versions, selectedId, allowUnassigned) {
      if (!dom.versionSelect) return;
      var opts = [];
      if (allowUnassigned !== false) {
        opts.push('<option value=\"\">未分配版本</option>');
      }
      (versions || []).forEach(function(v) {
        if (!v) return;
        var id = v.id || v.id === 0 ? String(v.id) : '';
        if (!id) return;
        var name = v.name ? String(v.name) : ('版本#' + id);
        opts.push('<option value=\"' + id.replace(/\"/g, '&quot;') + '\">' + name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</option>');
      });
      dom.versionSelect.innerHTML = opts.join('');
      dom.versionSelect.value = selectedId || '';
    }

    function loadVersions(projectId) {
      var apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
      if (!apiClient || typeof apiClient.listProjectVersions !== 'function') {
        return Promise.reject(new Error('版本列表接口不可用'));
      }
      return apiClient.listProjectVersions(projectId).then(function(list) {
        return Array.isArray(list) ? list : [];
      });
    }

    function normalizeExecVersionId(value) {
      if (value === null || value === undefined) return null;
      var s = String(value || '').trim();
      if (!s) return null;
      var n = Number(s);
      if (!isFinite(n)) return null;
      return n;
    }

    function open(options) {
      var drawerInstance = ensureDrawer();
      if (!drawerInstance) return Promise.resolve({ ok: false, reason: 'drawer_unavailable' });

      var opts = options && typeof options === 'object' ? options : {};
      var projectId = opts.projectId || opts.project_id || '';
      if (!projectId) {
        return Promise.resolve({ ok: false, reason: 'no_project' });
      }
      var projectName = opts.projectName || opts.project_name || '';
      var importVersionName = opts.importVersionName || opts.import_version_name || '';
      var importVersionId = opts.importVersionId || opts.import_version_id || '';
      var allowUnassigned = opts.allowUnassigned !== false;
      var preferred = opts.preferredExecVersionId || opts.execVersionId || opts.exec_version_id || '';

      resolved = false;
      resolveFn = null;
      ctxState = {
        projectId: String(projectId),
        allowUnassigned: allowUnassigned,
        importVersionId: importVersionId !== null && importVersionId !== undefined ? String(importVersionId) : '',
      };

      if (dom.title) dom.title.textContent = String(opts.title || '选择执行版本');
      if (dom.hint) dom.hint.textContent = String(opts.hint || dom.hint.textContent || '');
      if (dom.project) dom.project.textContent = projectName ? String(projectName) : ('项目#' + projectId);

      var importLabel = '--';
      if (opts.importVersionLabel) {
        importLabel = String(opts.importVersionLabel);
      } else if (importVersionName) {
        importLabel = String(importVersionName);
      } else if (importVersionId || importVersionId === 0) {
        importLabel = '版本#' + String(importVersionId);
      } else if (opts.importVersionMultiple) {
        importLabel = '多个版本';
      } else if (opts.importVersionUnknown) {
        importLabel = '未知';
      }
      if (dom.importVersion) dom.importVersion.textContent = importLabel;

      loading = true;
      if (dom.confirmBtn) dom.confirmBtn.disabled = true;
      if (dom.versionSelect) dom.versionSelect.disabled = true;
      setStatus('加载版本中...', '');
      drawerInstance.open();

      return new Promise(function(resolve) {
        resolveFn = resolve;

        loadVersions(projectId)
          .then(function(list) {
            if (!ctxState || String(ctxState.projectId) !== String(projectId)) return;
            var versions = sortVersionsByLatest(list);
            // 若能从版本列表中解析到导入版本名称，则优先展示名称（避免出现 “版本#13” 等不友好文案）。
            if (dom.importVersion && !opts.importVersionMultiple && !opts.importVersionUnknown) {
              var importId = ctxState && ctxState.importVersionId ? String(ctxState.importVersionId) : '';
              if (importId) {
                var matched = versions.find(function(v) { return v && String(v.id) === importId; }) || null;
                if (matched && matched.name) {
                  dom.importVersion.textContent = String(matched.name);
                } else {
                  dom.importVersion.textContent = '版本#' + importId;
                }
              }
            }
            var preferredStr = preferred !== null && preferred !== undefined ? String(preferred) : '';
            var normalizedPreferred = preferredStr.trim();
            var selectedId = normalizedPreferred;
            if (!selectedId) selectedId = guessLatestVersionId(versions);
            renderVersionOptions(versions, selectedId, allowUnassigned);
            if (dom.versionSelect) dom.versionSelect.disabled = false;
            if (dom.confirmBtn) dom.confirmBtn.disabled = false;
            setStatus('', '');
          })
          .catch(function(err) {
            if (!ctxState || String(ctxState.projectId) !== String(projectId)) return;
            var msg = err && err.message ? err.message : '加载版本失败';
            setStatus(msg, 'err');
            if (dom.versionSelect) {
              dom.versionSelect.disabled = true;
              dom.versionSelect.innerHTML = '<option value=\"\">加载失败</option>';
            }
            if (dom.confirmBtn) dom.confirmBtn.disabled = true;
          })
          .finally(function() {
            loading = false;
          });
      });
    }

    function bindEvents() {
      if (!dom.confirmBtn) return;
      dom.confirmBtn.addEventListener('click', function() {
        if (resolved) return;
        if (loading) return;
        if (!ctxState || !ctxState.projectId) return;
        var raw = dom.versionSelect ? dom.versionSelect.value : '';
        var normalized = normalizeExecVersionId(raw);
        resolved = true;
        if (typeof resolveFn === 'function') resolveFn({ ok: true, exec_version_id: normalized, versionId: normalized });
        resolveFn = null;
        var drawerInstance = ensureDrawer();
        if (drawerInstance) drawerInstance.close();
      });
    }

    bindEvents();

    return {
      open: open,
    };
  }

  window.app = window.app || {};
  window.app.execVersionDrawer = init();
})();
