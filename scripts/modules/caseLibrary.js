(function() {
  var apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
  if (!apiClient) return;

  var utils = window.app && window.app.utils ? window.app.utils : {};

  function getCore() {
    return window.app && window.app.core ? window.app.core : {};
  }

  var dom = {
    root: document.getElementById('caseLibrary'),
    status: document.getElementById('caseLibraryStatus'),

    editCard: document.getElementById('caseLibraryEditCard'),
    editCardTitle: document.getElementById('caseLibraryEditCardTitle'),
    editProject: document.getElementById('caseLibraryEditProject'),
    editVersion: document.getElementById('caseLibraryEditVersion'),
    editFileName: document.getElementById('caseLibraryEditFileName'),
    editSearchInput: document.getElementById('caseLibraryEditSearchInput'),
    editClearSearchBtn: document.getElementById('caseLibraryEditClearSearchBtn'),
    editToExecBtn: document.getElementById('caseLibraryEditToExecBtn'),
    editStatus: document.getElementById('caseLibraryEditStatus'),
    editView: document.getElementById('caseLibraryEditView'),

    importDropZone: document.getElementById('caseLibraryImportDropZone'),
    importInput: document.getElementById('caseLibraryImportInput'),
    importFileHint: document.getElementById('caseLibraryImportFileHint'),
    importProjectSelect: document.getElementById('caseLibraryImportProjectSelect'),
    importVersionSelect: document.getElementById('caseLibraryImportVersionSelect'),
    importConfirmBtn: document.getElementById('caseLibraryImportConfirmBtn'),
    importStatus: document.getElementById('caseLibraryImportStatus'),

    editDrawerProjectSelect: document.getElementById('caseLibraryEditProjectSelect'),
    editDrawerConfirmBtn: document.getElementById('caseLibraryEditConfirmBtn'),
    editDrawerStatus: document.getElementById('caseLibraryEditDrawerStatus'),
    editDrawerListBody: document.getElementById('caseLibraryEditListBody'),

    selectProjectSelect: document.getElementById('caseLibrarySelectProjectSelect'),
    selectVersionSelect: document.getElementById('caseLibrarySelectVersionSelect'),
    selectConfirmBtn: document.getElementById('caseLibrarySelectConfirmBtn'),
    selectStatus: document.getElementById('caseLibrarySelectDrawerStatus'),
    selectListBody: document.getElementById('caseLibrarySelectListBody'),
  };

  var state = {
    projects: [],
    projectNameById: {},

    versionsByProject: {},
    versionNameByProject: {},

    importDrawer: {
      files: [],
      projectId: null,
      versionId: null,
      loading: false,
    },

    editDrawer: {
      projectId: null,
      files: [],
      loading: false,
    },

    selectDrawer: {
      projectId: null,
      versionId: null,
      files: [],
      loading: false,
    },

    editor: {
      caseFile: null,
      items: [],
      searchText: '',
      pageIndex: 0,
      selection: new Set(),
      remarkOpen: new Set(),
      pendingOp: null,
      pendingTimer: null,
      pendingInterval: null,
      pendingToast: null,
      pendingRemaining: 0,
    },
  };

  var importDrawerInstance = null;
  var editDrawerInstance = null;
  var selectDrawerInstance = null;

  function setStatus(el, text, type) {
    var coreApi = getCore();
    var setter = coreApi.setStatus || utils.setStatus;
    if (typeof setter === 'function') {
      setter(el, text, type);
      return;
    }
    if (!el) return;
    el.textContent = text || '';
    el.className = ['status', type || ''].filter(Boolean).join(' ');
  }

  function escapeHtml(text) {
    if (utils && typeof utils.escapeHtml === 'function') return utils.escapeHtml(text);
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTime(value) {
    if (!value) return '--';
    try {
      return new Date(value).toLocaleString();
    } catch (e) {
      return String(value || '--');
    }
  }

  function normalizeName(value) {
    return String(value || '').trim().toLowerCase();
  }

  function clampPageSize(value) {
    var n = Number(value);
    if (!isFinite(n) || n <= 0) return 20;
    if (n < 5) return 5;
    if (n > 200) return 200;
    return Math.floor(n);
  }

  function getPageSize() {
    var globalState = window.app && window.app.state ? window.app.state : {};
    return clampPageSize(globalState.tempExecPageSize || 20);
  }

  function cleanCaseFileName(name) {
    var raw = name || '';
    var base = raw.split(/[\\/]/).pop() || raw;
    var xmindApi = window.app && window.app.xmindCoreApi ? window.app.xmindCoreApi : null;
    var cleaned = '';
    if (xmindApi && typeof xmindApi.getSafeFileBaseName === 'function') {
      cleaned = xmindApi.getSafeFileBaseName(base, 'case');
    } else {
      cleaned = base.replace(/\.[^.]+$/, '');
      var pattern = /(_result)?_\d{8}(?:_?\d{6})?$/i;
      while (pattern.test(cleaned)) cleaned = cleaned.replace(pattern, '');
    }
    cleaned = String(cleaned || '').replace(/^勾选用例[\s_\-\u2010-\u2015\u2212\uFE63\uFF0D]*/i, '');
    cleaned = cleaned.trim().replace(/^[_-]+|[_-]+$/g, '');
    return cleaned || 'case';
  }

  function extFromFileName(name) {
    var ext = (String(name || '').split('.').pop() || '').toLowerCase();
    return ext ? ('file:' + ext) : 'file';
  }

  function isAuthReady() {
    if (window.app && window.app.authReady === true) return true;
    var globalState = window.app && window.app.state ? window.app.state : null;
    return Boolean(globalState && globalState.currentUser);
  }

  function getTempExecApi() {
    return window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
  }

  function isExecDbEnabled() {
    if (!window.app || window.app.authReady !== true) return false;
    var globalState = window.app && window.app.state ? window.app.state : null;
    var user = globalState && globalState.currentUser ? globalState.currentUser : null;
    var userId = user && user.id !== undefined && user.id !== null ? user.id : null;
    if (!userId || String(userId) === '0') return false;
    return Boolean(
      apiClient &&
        typeof apiClient.listExecSets === 'function' &&
        typeof apiClient.listExecCases === 'function' &&
        typeof apiClient.upsertExecSetFromCaseFile === 'function' &&
        typeof apiClient.listCaseItems === 'function'
    );
  }

  function mapExecCaseToImportPayload(row) {
    if (!row) return null;
    return {
      module: row.module || '',
      title: row.title || '',
      expected: row.expected || '',
      priority: row.priority || null,
      precondition: row.precondition || null,
      steps: row.steps || null,
      remark: row.remark || null,
      status: row.status || null,
      reuse_details: row.reuse_details || null,
      defect_links: row.defect_links || null,
    };
  }

  function ensureDrawer(drawerId, openButtons, onOpen) {
    if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
    return window.app.drawer.createDrawer({
      drawerId: drawerId,
      openButtons: Array.isArray(openButtons) ? openButtons : [],
      closeButtons: [],
      onOpen: typeof onOpen === 'function' ? onOpen : undefined,
    });
  }

  function syncProjectOptions(selectEl, placeholder) {
    if (!selectEl) return;
    var list = Array.isArray(state.projects) ? state.projects : [];
    var options = ['<option value=\"\">' + escapeHtml(placeholder || '请选择项目') + '</option>'];
    state.projectNameById = {};
    list.forEach(function(p) {
      if (!p) return;
      state.projectNameById[p.id] = p.name || ('项目#' + p.id);
      options.push('<option value=\"' + escapeHtml(p.id) + '\">' + escapeHtml(state.projectNameById[p.id]) + '</option>');
    });
    selectEl.innerHTML = options.join('');
  }

  function syncVersionOptions(selectEl, projectId, placeholder) {
    if (!selectEl) return;
    var list = projectId && state.versionsByProject[projectId] ? state.versionsByProject[projectId] : [];
    var options = ['<option value=\"\">' + escapeHtml(placeholder || '请选择版本') + '</option>'];
    if (!state.versionNameByProject[projectId]) state.versionNameByProject[projectId] = {};
    (list || []).forEach(function(v) {
      if (!v) return;
      state.versionNameByProject[projectId][v.id] = v.name || ('版本#' + v.id);
      options.push('<option value=\"' + escapeHtml(v.id) + '\">' + escapeHtml(state.versionNameByProject[projectId][v.id]) + '</option>');
    });
    selectEl.innerHTML = options.join('');
  }

  function getVersionName(projectId, versionId) {
    if (!versionId) return '--';
    var map = projectId && state.versionNameByProject[projectId] ? state.versionNameByProject[projectId] : null;
    if (map && map[versionId]) return map[versionId];
    return '版本#' + versionId;
  }

  function loadProjects() {
    return apiClient.listProjects().then(function(list) {
      state.projects = Array.isArray(list) ? list : [];
      syncProjectOptions(dom.importProjectSelect, '请选择项目');
      syncProjectOptions(dom.editDrawerProjectSelect, '请选择项目');
      syncProjectOptions(dom.selectProjectSelect, '请选择项目');
      return state.projects;
    });
  }

  function loadVersions(projectId) {
    if (!projectId) return Promise.resolve([]);
    if (state.versionsByProject[projectId]) return Promise.resolve(state.versionsByProject[projectId]);
    return apiClient.listProjectVersions(projectId).then(function(list) {
      state.versionsByProject[projectId] = Array.isArray(list) ? list : [];
      state.versionNameByProject[projectId] = {};
      (state.versionsByProject[projectId] || []).forEach(function(v) {
        if (!v) return;
        state.versionNameByProject[projectId][v.id] = v.name || ('版本#' + v.id);
      });
      return state.versionsByProject[projectId];
    });
  }

  function ensureProjectsReady() {
    if (state.projects && state.projects.length) return Promise.resolve(state.projects);
    setStatus(dom.status, '加载项目中...', '');
    return loadProjects()
      .then(function(list) {
        setStatus(dom.status, '', '');
        return list;
      })
      .catch(function(err) {
        setStatus(dom.status, err && err.message ? err.message : '加载项目失败', 'err');
        return [];
      });
  }

  function invalidateProjectsCache() {
    state.projects = [];
    state.projectNameById = {};
    state.versionsByProject = {};
    state.versionNameByProject = {};

    // 项目/版本列表发生变化时，避免“下拉已重建但 state 仍保留旧值”导致按钮可点击状态错误。
    state.importDrawer.projectId = null;
    state.importDrawer.versionId = null;
    if (dom.importProjectSelect) dom.importProjectSelect.value = '';
    if (dom.importVersionSelect) {
      dom.importVersionSelect.disabled = true;
      dom.importVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
      dom.importVersionSelect.value = '';
    }
    syncImportConfirmEnabled();

    state.editDrawer.projectId = null;
    if (dom.editDrawerProjectSelect) dom.editDrawerProjectSelect.value = '';
    if (dom.editDrawerListBody) {
      dom.editDrawerListBody.innerHTML = '<tr><td colspan=\"8\"><p class=\"hint\">请选择项目后点击确认。</p></td></tr>';
    }

    state.selectDrawer.projectId = null;
    state.selectDrawer.versionId = null;
    if (dom.selectProjectSelect) dom.selectProjectSelect.value = '';
    if (dom.selectVersionSelect) {
      dom.selectVersionSelect.disabled = true;
      dom.selectVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
      dom.selectVersionSelect.value = '';
    }
    if (dom.selectListBody) {
      dom.selectListBody.innerHTML = '<tr><td colspan=\"7\"><p class=\"hint\">请选择项目后点击确认。</p></td></tr>';
    }
  }

  function bindProjectsUpdated() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('app-projects-updated', function() {
      invalidateProjectsCache();
      var globalState = window.app && window.app.state ? window.app.state : {};
      var tabName = globalState && globalState.activeTab ? globalState.activeTab : '';
      if (tabName === 'case-library' && isAuthReady()) {
        ensureProjectsReady();
      }
    });
  }

  function normalizeId(value) {
    if (value === null || value === undefined) return null;
    if (value === '') return null;
    var n = Number(value);
    return isNaN(n) ? null : n;
  }

  function toLineText(val) {
    if (val === null || val === undefined) return '';
    if (Array.isArray(val)) return val.filter(Boolean).map(function(s) { return String(s); }).join('\n');
    return String(val);
  }

  function deriveCaseListFromText(text) {
    var coreApi = getCore();
    if (coreApi && typeof coreApi.deriveCaseListFromText === 'function') {
      return coreApi.deriveCaseListFromText(text || '');
    }
    try {
      var parsed = JSON.parse((text || '').trim() || '[]');
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.cases)) return parsed.cases;
    } catch (err) {
      // ignore
    }
    return [];
  }

  function buildImportItems(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map(function(item) {
        if (!item || typeof item !== 'object') return null;
        var module = String(item.module || item.module_name || item['模块'] || '').trim();
        var title = String(item.title || item.case_title || item['用例标题'] || '').trim();
        var expected = String(item.expected || item.result || item['预期结果'] || '').trim();
        if (!module || !title || !expected) return null;
        var priority = String(item.priority || item.level || item['优先级'] || '').trim();
        var precondition = String(item.preconditions || item.precondition || item['前提条件'] || '').trim();
        var steps = toLineText(item.steps || item.actions || item['操作步骤'] || '').trim();
        var remark = String(item.remark || '').trim();
        return {
          module: module,
          title: title,
          expected: expected,
          priority: priority || null,
          precondition: precondition || null,
          steps: steps || null,
          remark: remark || null,
        };
      })
      .filter(Boolean);
  }

  function parseImportFile(file) {
    if (!file) return Promise.resolve({ items: [] });
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    var coreApi = getCore();
    if (ext === 'xmind' && coreApi && typeof coreApi.parseXmindFile === 'function') {
      return coreApi.parseXmindFile(file).then(function(res) {
        var list = res && Array.isArray(res.list) ? res.list : [];
        return { items: buildImportItems(list) };
      });
    }
    return file.text().then(function(text) {
      var trimmed = (text || '').trim();
      var list = [];
      if (ext === 'json') {
        try {
          var parsed = JSON.parse(trimmed || '[]');
          if (Array.isArray(parsed)) list = parsed;
          else if (parsed && Array.isArray(parsed.cases)) list = parsed.cases;
          else list = deriveCaseListFromText(trimmed);
        } catch (err) {
          list = deriveCaseListFromText(trimmed);
        }
      } else {
        list = deriveCaseListFromText(trimmed);
      }
      return { items: buildImportItems(list) };
    });
  }

  function syncImportConfirmEnabled() {
    if (!dom.importConfirmBtn) return;
    var s = state.importDrawer;
    dom.importConfirmBtn.disabled = !(s.files && s.files.length && s.projectId && s.versionId) || s.loading;
  }

  function renderImportFileHint() {
    if (!dom.importFileHint) return;
    var files = state.importDrawer.files || [];
    if (!files.length) {
      dom.importFileHint.textContent = '未选择文件';
      return;
    }
    var names = files.map(function(f) { return f && f.name ? f.name : '文件'; });
    var head = names.slice(0, 2).join('、');
    dom.importFileHint.textContent = names.length > 2 ? ('已选择 ' + names.length + ' 个：' + head + '...') : ('已选择：' + head);
  }

  function resetImportDrawer() {
    state.importDrawer.files = [];
    state.importDrawer.projectId = null;
    state.importDrawer.versionId = null;
    state.importDrawer.loading = false;
    renderImportFileHint();
    setStatus(dom.importStatus, '', '');
    syncProjectOptions(dom.importProjectSelect, '请选择项目');
    if (dom.importProjectSelect) dom.importProjectSelect.value = '';
    if (dom.importVersionSelect) {
      dom.importVersionSelect.disabled = true;
      dom.importVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
      dom.importVersionSelect.value = '';
    }
    syncImportConfirmEnabled();
  }

  function handleImportFiles(files) {
    state.importDrawer.files = Array.from(files || []).filter(Boolean);
    renderImportFileHint();
    syncImportConfirmEnabled();
    setStatus(dom.importStatus, state.importDrawer.files.length ? '已选择文件，请继续选择项目与版本' : '未选择文件', state.importDrawer.files.length ? '' : 'warn');
  }

  function handleImportProjectChange() {
    var projectId = normalizeId(dom.importProjectSelect ? dom.importProjectSelect.value : '');
    state.importDrawer.projectId = projectId;
    state.importDrawer.versionId = null;
    syncImportConfirmEnabled();
    if (!dom.importVersionSelect) return;
    dom.importVersionSelect.disabled = true;
    dom.importVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
    if (!projectId) return;
    setStatus(dom.importStatus, '加载版本中...', '');
    loadVersions(projectId)
      .then(function() {
        syncVersionOptions(dom.importVersionSelect, projectId, '请选择版本');
        dom.importVersionSelect.disabled = false;
        setStatus(dom.importStatus, '', '');
      })
      .catch(function(err) {
        setStatus(dom.importStatus, err && err.message ? err.message : '加载版本失败', 'err');
      });
  }

  function handleImportVersionChange() {
    state.importDrawer.versionId = normalizeId(dom.importVersionSelect ? dom.importVersionSelect.value : '');
    syncImportConfirmEnabled();
  }

  function confirmImportToDb() {
    var s = state.importDrawer;
    if (!s.files.length) {
      setStatus(dom.importStatus, '请先选择用例文件', 'warn');
      return;
    }
    if (!s.projectId) {
      setStatus(dom.importStatus, '请先选择项目', 'warn');
      return;
    }
    if (!s.versionId) {
      setStatus(dom.importStatus, '请先选择版本', 'warn');
      return;
    }

    s.loading = true;
    syncImportConfirmEnabled();
    setStatus(dom.importStatus, '解析并导入中...', '');

    var successCount = 0;
    var failCount = 0;
    var duplicateNames = [];
    var failDetails = [];
    var chain = Promise.resolve();

    s.files.forEach(function(file) {
      chain = chain.then(function() {
        return parseImportFile(file)
          .then(function(parsed) {
            var items = parsed && parsed.items ? parsed.items : [];
            if (!items.length) {
              failCount += 1;
              var emptyMsg = '【' + (file && file.name ? file.name : '文件') + '】未解析到有效用例，已跳过';
              failDetails.push({ file: file && file.name ? file.name : '文件', reason: emptyMsg });
              setStatus(dom.importStatus, emptyMsg, 'warn');
              return;
            }
            return apiClient.importCaseFile({
              project_id: s.projectId,
              version_id: s.versionId,
              file_name: file.name,
              source: file.type || extFromFileName(file.name),
              items: items,
            }).then(function() {
              successCount += 1;
            }).catch(function(err) {
              failCount += 1;
              var msg = err && err.message ? err.message : '导入失败';
              failDetails.push({ file: file && file.name ? file.name : '文件', reason: msg });
              if (msg.indexOf('同名') !== -1) {
                duplicateNames.push(cleanCaseFileName(file.name));
              }
              setStatus(dom.importStatus, msg, 'err');
            });
          })
          .catch(function(err) {
            failCount += 1;
            var msg = err && err.message ? err.message : '解析失败';
            failDetails.push({ file: file && file.name ? file.name : '文件', reason: msg });
            setStatus(dom.importStatus, msg, 'err');
          });
      });
    });

    chain.then(function() {
      var msg = '导入完成：成功 ' + successCount + ' 份，失败/跳过 ' + failCount + ' 份';
      if (duplicateNames.length) {
        var head = duplicateNames.slice(0, 3).join('、');
        msg += '；同名用例已存在：' + head + (duplicateNames.length > 3 ? '...' : '');
      }
      if (failDetails.length) {
        var lines = [msg];
        failDetails.slice(0, 3).forEach(function(item) {
          if (!item) return;
          var fname = item.file ? String(item.file) : '文件';
          var reason = item.reason ? String(item.reason) : '失败';
          lines.push(' - ' + fname + '：' + reason);
        });
        if (failDetails.length > 3) {
          lines.push(' - 还有 ' + (failDetails.length - 3) + ' 个失败未展开');
        }
        msg = lines.join('\n');
      }
      setStatus(dom.importStatus, msg, failCount ? 'warn' : 'ok');
      setStatus(dom.status, msg, failCount ? 'warn' : 'ok');
    }).finally(function() {
      s.loading = false;
      syncImportConfirmEnabled();
    });
  }

  function resetEditDrawer() {
    state.editDrawer.projectId = null;
    state.editDrawer.files = [];
    state.editDrawer.loading = false;
    setStatus(dom.editDrawerStatus, '', '');
    syncProjectOptions(dom.editDrawerProjectSelect, '请选择项目');
    if (dom.editDrawerProjectSelect) dom.editDrawerProjectSelect.value = '';
    if (dom.editDrawerListBody) {
      dom.editDrawerListBody.innerHTML = '<tr><td colspan=\"8\"><p class=\"hint\">请选择项目后点击确认。</p></td></tr>';
    }
  }

  function renderEditDrawerList() {
    if (!dom.editDrawerListBody) return;
    var list = Array.isArray(state.editDrawer.files) ? state.editDrawer.files : [];
    if (!list.length) {
      dom.editDrawerListBody.innerHTML = '<tr><td colspan=\"8\"><p class=\"hint\">暂无用例文件</p></td></tr>';
      return;
    }
    var projectName = state.projectNameById[state.editDrawer.projectId] || ('项目#' + state.editDrawer.projectId);
    dom.editDrawerListBody.innerHTML = list.map(function(f) {
      var versionName = getVersionName(state.editDrawer.projectId, f && f.version_id ? f.version_id : null);
      var importerName = f && f.importer_name ? f.importer_name : '--';
      var importedAt = formatTime(f && f.imported_at);
      var updaterName = f && f.last_updated_by_name ? f.last_updated_by_name : (importerName || '--');
      var updatedAt = formatTime(f && f.updated_at);
      return (
        '<tr>' +
          '<td>' + escapeHtml(projectName) + '</td>' +
          '<td>' + escapeHtml(versionName) + '</td>' +
          '<td>' + escapeHtml(f && f.file_name_clean ? f.file_name_clean : ('文件#' + (f && f.id ? f.id : ''))) + '</td>' +
          '<td>' + escapeHtml(importerName) + '</td>' +
          '<td>' + escapeHtml(importedAt) + '</td>' +
          '<td>' + escapeHtml(updaterName) + '</td>' +
          '<td>' + escapeHtml(updatedAt) + '</td>' +
          '<td><button class=\"secondary\" type=\"button\" data-case-lib-edit=\"' + escapeHtml(f && f.id ? f.id : '') + '\">编辑</button></td>' +
        '</tr>'
      );
    }).join('');
  }

  function loadEditDrawerFiles() {
    var projectId = normalizeId(dom.editDrawerProjectSelect ? dom.editDrawerProjectSelect.value : '');
    state.editDrawer.projectId = projectId;
    state.editDrawer.files = [];
    renderEditDrawerList();
    if (!projectId) {
      setStatus(dom.editDrawerStatus, '请先选择项目', 'warn');
      return;
    }
    setStatus(dom.editDrawerStatus, '加载用例库...', '');
    state.editDrawer.loading = true;
    Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId)])
      .then(function(res) {
        var files = Array.isArray(res && res[0]) ? res[0] : [];
        state.editDrawer.files = files;
        setStatus(dom.editDrawerStatus, '已加载 ' + files.length + ' 份用例文件', files.length ? 'ok' : 'warn');
        renderEditDrawerList();
      })
      .catch(function(err) {
        setStatus(dom.editDrawerStatus, err && err.message ? err.message : '加载失败', 'err');
      })
      .finally(function() {
        state.editDrawer.loading = false;
      });
  }

  function findCaseFileInEditDrawer(id) {
    var fileId = Number(id);
    if (isNaN(fileId)) return null;
    return (state.editDrawer.files || []).find(function(f) { return f && f.id === fileId; }) || null;
  }

  function openEditorForCaseFile(caseFile) {
    if (!caseFile || !caseFile.id) return;
    setStatus(dom.editDrawerStatus, '加载用例条目...', '');
    apiClient.listCaseItems(caseFile.id).then(function(items) {
      state.editor.caseFile = caseFile;
      state.editor.items = Array.isArray(items) ? items : [];
      state.editor.searchText = '';
      state.editor.pageIndex = 0;
      state.editor.selection = new Set();
      state.editor.remarkOpen = new Set();
      setStatus(dom.editStatus, '已加载 ' + state.editor.items.length + ' 条用例，可直接编辑', 'ok');
      if (dom.editSearchInput) dom.editSearchInput.value = '';
      renderEditorCard();
      if (editDrawerInstance && typeof editDrawerInstance.close === 'function') editDrawerInstance.close();
    }).catch(function(err) {
      setStatus(dom.editDrawerStatus, err && err.message ? err.message : '加载用例失败', 'err');
    });
  }

  function showEditorCard(show) {
    if (!dom.editCard) return;
    if (show) dom.editCard.classList.remove('hidden');
    else dom.editCard.classList.add('hidden');
  }

  function applyEditorFilter() {
    var items = Array.isArray(state.editor.items) ? state.editor.items : [];
    var term = normalizeName(state.editor.searchText);
    if (!term) {
      return items.map(function(item, idx) { return { item: item, idx: idx }; });
    }
    return items
      .map(function(item, idx) { return { item: item, idx: idx }; })
      .filter(function(entry) {
        var it = entry.item || {};
        var hay = [
          it.module,
          it.title,
          it.priority,
          it.precondition,
          it.steps,
          it.expected,
          it.remark,
        ].map(function(s) { return String(s || '').toLowerCase(); }).join(' ');
        return hay.indexOf(term) !== -1;
      });
  }

  function buildEditorPagination(totalCases, pageIndex, totalPages, start, end) {
    var pageSize = getPageSize();
    var displayStart = totalCases ? start + 1 : 0;
    var displayEnd = totalCases ? Math.min(end, totalCases) : 0;
    var maxPage = Math.max(totalPages, 1);
    var currentPage = totalPages ? pageIndex + 1 : 1;
    var rangeInfo = totalCases
      ? '显示 ' + displayStart + '-' + displayEnd + ' / ' + totalCases + ' 条'
      : '暂无用例';
    return (
      '<div class=\"temp-pagination\" data-case-lib-pagination>' +
        '<div class=\"temp-pagination-info\">' + escapeHtml(rangeInfo) + '，每页 ' + pageSize + ' 条</div>' +
        '<div class=\"temp-pagination-controls\">' +
          '<button type=\"button\" class=\"secondary\" data-case-lib-page=\"prev\" ' + (pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
          '<span>第 ' + currentPage + ' / ' + maxPage + ' 页</span>' +
          '<button type=\"button\" class=\"secondary\" data-case-lib-page=\"next\" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
          '<label>跳至' +
            '<input type=\"number\" min=\"1\" max=\"' + maxPage + '\" value=\"' + Math.min(currentPage, maxPage) + '\" data-case-lib-page-input>' +
            '页' +
          '</label>' +
        '</div>' +
      '</div>'
    );
  }

  function renderEditorTable() {
    if (!dom.editView) return;
    if (!state.editor.caseFile) {
      dom.editView.innerHTML = '<p class=\"hint\">请先选择需要编辑的用例</p>';
      return;
    }
    var matches = applyEditorFilter();
    var pageSize = getPageSize();
    var totalCases = matches.length;
    var totalPages = totalCases ? Math.ceil(totalCases / pageSize) : 1;
    if (state.editor.pageIndex >= totalPages) state.editor.pageIndex = Math.max(totalPages - 1, 0);
    if (state.editor.pageIndex < 0) state.editor.pageIndex = 0;
    var start = state.editor.pageIndex * pageSize;
    var end = Math.min(totalCases, start + pageSize);
    var paged = matches.filter(function(_, idx) { return idx >= start && idx < end; });
    var visibleIndexes = [];
    var selection = state.editor.selection;
    var remarkOpen = state.editor.remarkOpen;
    var statusOptions = ['未执行', '通过', '失败', '阻塞', '不适用'];
    var rows = paged.map(function(entry) {
      var item = entry.item || {};
      var idx = entry.idx;
      visibleIndexes.push(idx);
      var editPlaceholder = '点击此处编辑';
      var moduleHtml = item.module ? escapeHtml(item.module) : '';
      var titleHtml = item.title ? escapeHtml(item.title) : '';
      var priorityHtml = item.priority ? escapeHtml(item.priority) : '';
      var preHtml = item.precondition ? escapeHtml(item.precondition).replace(/\n/g, '<br>') : '';
      var stepsHtml = item.steps ? escapeHtml(item.steps).replace(/\n/g, '<br>') : '';
      var expectedHtml = item.expected ? escapeHtml(item.expected).replace(/\n/g, '<br>') : '';
      var isRemarkOpen = remarkOpen.has(idx);
      var hasRemark = Boolean(item.remark && String(item.remark).trim());
      var remarkBtnClass = ['remark-toggle'];
      if (isRemarkOpen) remarkBtnClass.push('active');
      if (hasRemark) remarkBtnClass.push('filled');
      var resultOptions = statusOptions.map(function(opt) {
        return '<option value=\"' + escapeHtml(opt) + '\" ' + (opt === '未执行' ? 'selected' : '') + '>' + escapeHtml(opt) + '</option>';
      }).join('');
      return (
        '<tr class=\"case-row\">' +
          '<td class=\"check\"><input type=\"checkbox\" data-case-lib-select data-index=\"' + idx + '\" ' + (selection.has(idx) ? 'checked' : '') + '></td>' +
          '<td class=\"index\">' + (idx + 1) + '</td>' +
          '<td class=\"module\"><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-edit-field=\"module\" data-index=\"' + idx + '\" data-case-lib-multiline=\"false\" data-placeholder=\"' + editPlaceholder + '\">' + moduleHtml + '</div></td>' +
          '<td class=\"title\"><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-edit-field=\"title\" data-index=\"' + idx + '\" data-case-lib-multiline=\"false\" data-placeholder=\"' + editPlaceholder + '\">' + titleHtml + '</div></td>' +
          '<td><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-edit-field=\"priority\" data-index=\"' + idx + '\" data-case-lib-multiline=\"false\" data-placeholder=\"' + editPlaceholder + '\">' + priorityHtml + '</div></td>' +
          '<td><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-edit-field=\"precondition\" data-index=\"' + idx + '\" data-case-lib-multiline=\"true\" data-placeholder=\"' + editPlaceholder + '\">' + preHtml + '</div></td>' +
          '<td><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-edit-field=\"steps\" data-index=\"' + idx + '\" data-case-lib-multiline=\"true\" data-placeholder=\"' + editPlaceholder + '\">' + stepsHtml + '</div></td>' +
          '<td><div class=\"temp-inline-edit\" contenteditable=\"true\" data-case-lib-edit-field=\"expected\" data-index=\"' + idx + '\" data-case-lib-multiline=\"true\" data-placeholder=\"' + editPlaceholder + '\">' + expectedHtml + '</div></td>' +
          '<td class=\"actual\"><select class=\"status-select\" data-status=\"未执行\" disabled>' + resultOptions + '</select></td>' +
          '<td><button type=\"button\" class=\"' + remarkBtnClass.join(' ') + '\" data-case-lib-remark-toggle data-index=\"' + idx + '\">' + (hasRemark ? '备注已填' : '备注') + '</button></td>' +
          '<td class=\"case-op-col\">' +
            '<div class=\"case-ops\">' +
              '<button type=\"button\" class=\"case-op remove\" title=\"删除当前用例\" data-case-lib-remove data-index=\"' + idx + '\">−</button>' +
              '<button type=\"button\" class=\"case-op add\" title=\"在下方插入用例\" data-case-lib-insert data-index=\"' + idx + '\">＋</button>' +
            '</div>' +
          '</td>' +
        '</tr>' +
        '<tr class=\"remark-row ' + (isRemarkOpen ? 'visible' : '') + '\">' +
          '<td colspan=\"11\">' +
            '<textarea class=\"remark-panel\" data-case-lib-remark data-index=\"' + idx + '\" placeholder=\"填写备注...\">' + escapeHtml(item.remark || '') + '</textarea>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    var allVisibleSelected = visibleIndexes.length && visibleIndexes.every(function(idx) { return selection.has(idx); });
    var headerCheckbox = (
      '<th class=\"check\"><input type=\"checkbox\" data-case-lib-select-all data-visible=\"' + visibleIndexes.join(',') + '\" ' +
      (visibleIndexes.length ? (allVisibleSelected ? 'checked' : '') : 'disabled') + '></th>'
    );
    var emptyRow = visibleIndexes.length
      ? ''
      : '<tr><td colspan=\"11\">' + (state.editor.items.length ? '当前页暂无用例' : '未解析到有效用例') + '</td></tr>';
    var paginationTop = buildEditorPagination(totalCases, state.editor.pageIndex, totalPages, start, end);
    var paginationBottom = buildEditorPagination(totalCases, state.editor.pageIndex, totalPages, start, end);
    dom.editView.innerHTML = (
      paginationTop +
      '<table>' +
        '<thead>' +
          '<tr>' +
            headerCheckbox +
            '<th class=\"index\">编号</th>' +
            '<th class=\"module\">模块</th>' +
            '<th class=\"title\">用例标题</th>' +
            '<th>优先级</th>' +
            '<th>前提条件</th>' +
            '<th>操作步骤</th>' +
            '<th>预期结果</th>' +
            '<th class=\"actual\">实际结果</th>' +
            '<th>备注</th>' +
            '<th class=\"ops\" title=\"增删\">增删</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + (rows || emptyRow) + '</tbody>' +
      '</table>' +
      paginationBottom
    );
  }

  function renderEditorCard() {
    var file = state.editor.caseFile;
    if (!file) {
      showEditorCard(false);
      return;
    }
    showEditorCard(true);
    var projectName = state.projectNameById[file.project_id] || ('项目#' + file.project_id);
    var versionName = getVersionName(file.project_id, file.version_id);
    if (dom.editProject) dom.editProject.textContent = projectName;
    if (dom.editVersion) dom.editVersion.textContent = versionName;
    if (dom.editFileName) dom.editFileName.textContent = file.file_name_clean || ('文件#' + file.id);
    if (dom.editCardTitle) dom.editCardTitle.textContent = '用例编辑视图：' + (file.file_name_clean || ('#' + file.id));
    renderEditorTable();
  }

  function cleanupPendingToast() {
    var ed = state.editor;
    if (ed.pendingTimer) {
      clearTimeout(ed.pendingTimer);
      ed.pendingTimer = null;
    }
    if (ed.pendingInterval) {
      clearInterval(ed.pendingInterval);
      ed.pendingInterval = null;
    }
    if (ed.pendingToast && ed.pendingToast.parentNode) {
      ed.pendingToast.parentNode.removeChild(ed.pendingToast);
    }
    ed.pendingToast = null;
    ed.pendingRemaining = 0;
  }

  function clearPendingOp() {
    cleanupPendingToast();
    state.editor.pendingOp = null;
  }

  function startPendingToast(message) {
    cleanupPendingToast();
    var ed = state.editor;
    ed.pendingRemaining = 8;
    var toast = document.createElement('div');
    toast.className = 'temp-undo-toast';
    var text = document.createElement('span');
    var btn = document.createElement('button');
    btn.className = 'pill secondary';
    btn.textContent = '撤回';
    function renderCountdown() {
      text.textContent = (message || '已暂存变更') + '（' + ed.pendingRemaining + 's）';
    }
    btn.addEventListener('click', function() {
      var op = ed.pendingOp;
      if (!op) return;
      if (op.type === 'remove' && op.item) {
        var insertAt = Math.min(Math.max(op.index, 0), ed.items.length);
        ed.items.splice(insertAt, 0, op.item);
      } else if (op.type === 'insert' && op.itemKey) {
        var idx = ed.items.findIndex(function(it) { return it && it.__localId === op.itemKey; });
        if (idx !== -1) ed.items.splice(idx, 1);
      }
      ed.selection = new Set();
      ed.remarkOpen = new Set();
      clearPendingOp();
      setStatus(dom.editStatus, '已撤回增删操作（未入库）', 'ok');
      renderEditorTable();
    });
    toast.appendChild(text);
    toast.appendChild(btn);
    document.body.appendChild(toast);
    ed.pendingToast = toast;
    renderCountdown();
    ed.pendingInterval = setInterval(function() {
      ed.pendingRemaining -= 1;
      if (ed.pendingRemaining <= 0) {
        clearInterval(ed.pendingInterval);
        ed.pendingInterval = null;
        return;
      }
      renderCountdown();
    }, 1000);
    ed.pendingTimer = setTimeout(function() {
      commitPendingOp();
    }, ed.pendingRemaining * 1000);
  }

  function buildCaseItemPayload(item) {
    var priority = item && item.priority ? String(item.priority).trim() : '';
    var pre = item && item.precondition ? String(item.precondition).trim() : '';
    var steps = item && item.steps ? String(item.steps).trim() : '';
    var remark = item && item.remark ? String(item.remark).trim() : '';
    return {
      module: String(item && item.module ? item.module : '').trim(),
      title: String(item && item.title ? item.title : '').trim(),
      expected: String(item && item.expected ? item.expected : '').trim(),
      priority: priority || null,
      precondition: pre || null,
      steps: steps || null,
      remark: remark || null,
    };
  }

  function validatePayload(payload) {
    if (!payload) return '内容不能为空';
    if (!payload.module) return '模块不能为空';
    if (!payload.title) return '用例标题不能为空';
    if (!payload.expected) return '预期结果不能为空';
    return '';
  }

  function saveCaseItemAtIndex(index, reason) {
    var ed = state.editor;
    var file = ed.caseFile;
    if (!file || !file.id) return;
    var idx = Number(index);
    if (!isFinite(idx) || idx < 0 || idx >= ed.items.length) return;
    var item = ed.items[idx];
    if (!item) return;
    if (!item.id) return;
    var payload = buildCaseItemPayload(item);
    var err = validatePayload(payload);
    if (err) {
      setStatus(dom.editStatus, err, 'warn');
      return;
    }
    setStatus(dom.editStatus, (reason || '保存中') + '...', '');
    apiClient.updateCaseItem(item.id, payload).then(function(updated) {
      if (updated) ed.items[idx] = updated;
      setStatus(dom.editStatus, '已保存', 'ok');
      renderEditorTable();
    }).catch(function(e) {
      setStatus(dom.editStatus, e && e.message ? e.message : '保存失败', 'err');
    });
  }

  function commitPendingOp() {
    var ed = state.editor;
    var op = ed.pendingOp;
    if (!op) return;
    var file = ed.caseFile;
    if (!file || !file.id) {
      clearPendingOp();
      return;
    }
    cleanupPendingToast();
    setStatus(dom.editStatus, '增删入库中...', '');
    if (op.type === 'remove' && op.item && op.item.id) {
      apiClient.deleteCaseItem(op.item.id).then(function() {
        setStatus(dom.editStatus, '删除已入库', 'ok');
      }).catch(function(e) {
        setStatus(dom.editStatus, e && e.message ? e.message : '删除入库失败', 'err');
      }).finally(function() {
        ed.pendingOp = null;
      });
      return;
    }
    if (op.type === 'insert' && op.itemKey) {
      var createIndex = ed.items.findIndex(function(it) { return it && it.__localId === op.itemKey; });
      if (createIndex === -1) {
        clearPendingOp();
        setStatus(dom.editStatus, '新增用例已撤回或不存在', 'warn');
        return;
      }
      var newItem = ed.items[createIndex];
      var payload = buildCaseItemPayload(newItem);
      var err = validatePayload(payload);
      if (err) {
        clearPendingOp();
        setStatus(dom.editStatus, '新增用例未入库：' + err, 'warn');
        return;
      }
      apiClient.createCaseItem(file.id, payload).then(function(created) {
        if (created) ed.items[createIndex] = created;
        setStatus(dom.editStatus, '新增已入库', 'ok');
        renderEditorTable();
      }).catch(function(e) {
        setStatus(dom.editStatus, e && e.message ? e.message : '新增入库失败', 'err');
      }).finally(function() {
        ed.pendingOp = null;
      });
      return;
    }
    clearPendingOp();
    setStatus(dom.editStatus, '变更已应用', 'ok');
  }

  function insertCaseItem(index) {
    var ed = state.editor;
    if (ed.pendingOp) {
      setStatus(dom.editStatus, '当前有待确认的增删操作，请先撤回或等待入库', 'warn');
      return;
    }
    var base = ed.items[index] || {};
    var moduleName = String(base.module || '').trim() || '模块';
    var title = '新用例-' + Math.random().toString(16).slice(2, 6);
    var localId = 'local-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 6);
    var fresh = {
      __localId: localId,
      case_file_id: ed.caseFile ? ed.caseFile.id : null,
      module: moduleName,
      title: title,
      priority: String(base.priority || '').trim() || 'P1',
      precondition: '',
      steps: '',
      expected: '待补充',
      remark: '',
    };
    var insertAt = Math.min(Math.max(index + 1, 0), ed.items.length);
    ed.items.splice(insertAt, 0, fresh);
    ed.selection = new Set();
    ed.remarkOpen = new Set();
    ed.pageIndex = Math.floor(insertAt / getPageSize());
    ed.pendingOp = { type: 'insert', itemKey: localId, index: insertAt };
    renderEditorTable();
    startPendingToast('已新增用例，超时将自动入库');
  }

  function removeCaseItem(index) {
    var ed = state.editor;
    if (ed.pendingOp) {
      setStatus(dom.editStatus, '当前有待确认的增删操作，请先撤回或等待入库', 'warn');
      return;
    }
    var idx = Math.max(0, Math.min(Number(index), ed.items.length - 1));
    var item = ed.items[idx];
    if (!item) return;
    var confirmed = window.confirm('确定删除该用例吗？可在 8 秒内撤回。');
    if (!confirmed) return;
    ed.items.splice(idx, 1);
    ed.selection = new Set();
    ed.remarkOpen = new Set();
    ed.pendingOp = { type: 'remove', item: item, index: idx };
    renderEditorTable();
    startPendingToast('已删除用例，超时将自动入库');
  }

  function toggleRemark(index) {
    var idx = Number(index);
    if (!isFinite(idx)) return;
    if (state.editor.remarkOpen.has(idx)) state.editor.remarkOpen.delete(idx);
    else state.editor.remarkOpen.add(idx);
    renderEditorTable();
  }

  function handlePaginationAction(action) {
    var matches = applyEditorFilter();
    var total = matches.length;
    var totalPages = total ? Math.ceil(total / getPageSize()) : 1;
    if (action === 'prev') state.editor.pageIndex = Math.max(0, state.editor.pageIndex - 1);
    if (action === 'next') state.editor.pageIndex = Math.min(totalPages - 1, state.editor.pageIndex + 1);
    renderEditorTable();
  }

  function handlePaginationJump(page) {
    var matches = applyEditorFilter();
    var total = matches.length;
    var totalPages = total ? Math.ceil(total / getPageSize()) : 1;
    var target = Math.max(1, Math.min(Number(page) || 1, totalPages));
    state.editor.pageIndex = Math.max(0, target - 1);
    renderEditorTable();
  }

  function copyCaseExecFields(target, source) {
    if (!target || !source) return;
    if (source.actual) target.actual = source.actual;
    if (source.remark) target.remark = source.remark;
    if (Array.isArray(source.defectLinks)) {
      target.defectLinks = source.defectLinks.map(function(link) { return Object.assign({}, link); });
    }
    if (Array.isArray(source.reuseDetails)) {
      target.reuseDetails = source.reuseDetails.map(function(detail) { return Object.assign({}, detail); });
    }
  }

  function buildExecMatchKey(item) {
    var module = String(item && item.module ? item.module : '').trim();
    var title = String(item && item.title ? item.title : '').trim();
    var expected = String(item && item.expected ? item.expected : '').trim();
    return normalizeName(module) + '::' + normalizeName(title) + '::' + normalizeName(expected);
  }

  function transferItemsToTempExec(caseFile, fileName, items) {
    var tempExecApi = getTempExecApi();
    if (!tempExecApi || !window.app || !window.app.state) {
      setStatus(dom.status, '执行页未就绪，请先打开一次“用例执行”页签', 'warn');
      return;
    }
    if (isExecDbEnabled() && caseFile && caseFile.id) {
      var projectId = caseFile.project_id || null;
      var name = (caseFile.file_name_clean || fileName || '').trim() || ('用例#' + caseFile.id);
      setStatus(dom.status, '转到执行中...', '');
      apiClient
        .listExecSets(projectId || undefined)
        .then(function(list) {
          var sets = Array.isArray(list) ? list : [];
          var fileIdNum = Number(caseFile.id);
          var matched = sets.filter(function(s) {
            return s && Number(s.case_file_id) === fileIdNum;
          });
          matched.sort(function(a, b) { return Number(b.id) - Number(a.id); });
          var existingSet = matched.length ? matched[0] : null;
          if (existingSet && String(existingSet.status || '') === 'active') {
            var ok = window.confirm(
              '检测到执行页已存在【' + name + '】的执行记录，将同步最新用例并尽量保留结果（模块+标题+预期一致保留），是否继续？'
            );
            if (!ok) {
              var cancelErr = new Error('cancelled');
              cancelErr._cancel = true;
              throw cancelErr;
            }
          }
          if (!existingSet) return { importCases: [] };
          return apiClient
            .listExecCases(existingSet.id)
            .then(function(cases) {
              var rows = Array.isArray(cases) ? cases : [];
              return { importCases: rows.map(mapExecCaseToImportPayload).filter(Boolean) };
            })
            .catch(function() {
              return { importCases: [] };
            });
        })
        .then(function(ctx) {
          var importCases = ctx && ctx.importCases ? ctx.importCases : [];
          var prefer = importCases.length ? 'import' : 'db';
          return apiClient.upsertExecSetFromCaseFile({
            case_file_id: caseFile.id,
            mode: 'replace',
            prefer_result_source: prefer,
            import_cases: importCases.length ? importCases : null,
          });
        })
        .then(function(execSet) {
          if (!execSet || !execSet.id) throw new Error('执行集创建失败');
          var chain = Promise.resolve();
          if (tempExecApi && typeof tempExecApi.loadTempExecState === 'function') {
            chain = chain.then(function() { return tempExecApi.loadTempExecState(); });
          }
          return chain.then(function() {
            if (tempExecApi && typeof tempExecApi.setTempExecActive === 'function') {
              tempExecApi.setTempExecActive(String(execSet.id));
            }
            return execSet;
          });
        })
        .then(function() {
          setStatus(dom.status, '已转到执行：' + name, 'ok');
          var coreApi = getCore();
          var switchTab = window.app && typeof window.app.switchTab === 'function'
            ? window.app.switchTab
            : (coreApi && typeof coreApi.switchTab === 'function' ? coreApi.switchTab : null);
          if (typeof switchTab === 'function') switchTab('tempexec');
          var section = document.querySelector('[data-section-id=\"tempexec-view\"]');
          if (section && coreApi && typeof coreApi.scrollElementIntoView === 'function') {
            coreApi.scrollElementIntoView(section, 'smooth', 140);
          }
        })
        .catch(function(err) {
          if (err && err._cancel) return;
          setStatus(dom.status, '转到执行失败：' + (err && err.message ? err.message : '未知错误'), 'err');
        });
      return;
    }
    var globalState = window.app.state;
    if (!Array.isArray(globalState.tempExecFiles)) globalState.tempExecFiles = [];
    if (!globalState.tempExecPages || typeof globalState.tempExecPages !== 'object') globalState.tempExecPages = {};

    var list = Array.isArray(items) ? items.slice() : [];
    list = list.filter(function(it) {
      return it && String(it.module || '').trim() && String(it.title || '').trim() && String(it.expected || '').trim();
    });
    if (!list.length) {
      setStatus(dom.status, '用例为空或缺少必填字段（模块/标题/预期结果）', 'warn');
      return;
    }

    var name = (fileName || '').trim() || '用例';
    var normalizeTempName = utils && typeof utils.normalizeTempExecName === 'function'
      ? utils.normalizeTempExecName
      : function(v) { return String(v || '').trim().toLowerCase(); };
    var normalized = normalizeTempName(name);

    var existing = globalState.tempExecFiles.find(function(f) {
      return normalizeTempName(f && f.name) === normalized;
    }) || null;

    if (existing) {
      var ok = window.confirm('检测到名称为【' + name + '】的用例已存在，将用最新用例覆盖并尽量保留执行结果（标题+预期一致保留），是否继续？');
      if (!ok) return;

      var rebuilt = tempExecApi.createTempExecFile(
        existing.name,
        list,
        existing.scope,
        existing.id,
        existing.createdAt,
        existing.requirement
      );
      if (!rebuilt) {
        setStatus(dom.status, '转到执行失败：未解析到有效用例', 'err');
        return;
      }
      rebuilt.reuseEnabled = Boolean(existing.reuseEnabled);
      rebuilt.reusePresets = Array.isArray(existing.reusePresets) ? existing.reusePresets : [];
      rebuilt.versionId = existing.versionId || '';

      var oldMap = new Map();
      (existing.cases || []).forEach(function(c) {
        oldMap.set(buildExecMatchKey(c), c);
      });
      (rebuilt.cases || []).forEach(function(c) {
        var old = oldMap.get(buildExecMatchKey(c));
        if (!old) return;
        copyCaseExecFields(c, old);
      });

      var idx = globalState.tempExecFiles.findIndex(function(f) { return f && f.id === existing.id; });
      if (idx !== -1) {
        globalState.tempExecFiles[idx] = rebuilt;
      } else {
        globalState.tempExecFiles.push(rebuilt);
      }
      if (typeof tempExecApi.clearTempExecCaseStates === 'function') {
        tempExecApi.clearTempExecCaseStates(existing.id);
      }
      globalState.tempExecPages[rebuilt.id] = 0;
      if (typeof tempExecApi.persistTempExecState === 'function') tempExecApi.persistTempExecState();
      if (typeof tempExecApi.syncTempExecFocus === 'function') tempExecApi.syncTempExecFocus();
      if (typeof tempExecApi.setTempExecActive === 'function') tempExecApi.setTempExecActive(rebuilt.id);
      setStatus(dom.status, '已覆盖并转到执行：' + name, 'ok');
    } else {
      var entry = tempExecApi.createTempExecFile(name, list, 'current', null, null, globalState.requirementLabel);
      if (!entry) {
        setStatus(dom.status, '转到执行失败：未解析到有效用例', 'err');
        return;
      }
      globalState.tempExecFiles.push(entry);
      globalState.tempExecPages[entry.id] = 0;
      if (typeof tempExecApi.persistTempExecState === 'function') tempExecApi.persistTempExecState();
      if (typeof tempExecApi.syncTempExecFocus === 'function') tempExecApi.syncTempExecFocus();
      if (typeof tempExecApi.setTempExecActive === 'function') tempExecApi.setTempExecActive(entry.id);
      setStatus(dom.status, '已转到执行：' + name, 'ok');
    }

    var coreApi = getCore();
    var switchTab = window.app && typeof window.app.switchTab === 'function'
      ? window.app.switchTab
      : (coreApi && typeof coreApi.switchTab === 'function' ? coreApi.switchTab : null);
    if (typeof switchTab === 'function') switchTab('tempexec');
    var section = document.querySelector('[data-section-id=\"tempexec-view\"]');
    if (section && coreApi && typeof coreApi.scrollElementIntoView === 'function') {
      coreApi.scrollElementIntoView(section, 'smooth', 140);
    }
  }

  function resetSelectDrawer() {
    state.selectDrawer.projectId = null;
    state.selectDrawer.versionId = null;
    state.selectDrawer.files = [];
    state.selectDrawer.loading = false;
    setStatus(dom.selectStatus, '', '');
    syncProjectOptions(dom.selectProjectSelect, '请选择项目');
    if (dom.selectProjectSelect) dom.selectProjectSelect.value = '';
    if (dom.selectVersionSelect) {
      dom.selectVersionSelect.disabled = true;
      dom.selectVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
      dom.selectVersionSelect.value = '';
    }
    if (dom.selectListBody) {
      dom.selectListBody.innerHTML = '<tr><td colspan=\"7\"><p class=\"hint\">请选择项目后点击确认。</p></td></tr>';
    }
  }

  function handleSelectProjectChange() {
    var projectId = normalizeId(dom.selectProjectSelect ? dom.selectProjectSelect.value : '');
    state.selectDrawer.projectId = projectId;
    state.selectDrawer.versionId = null;
    if (!dom.selectVersionSelect) return;
    dom.selectVersionSelect.disabled = true;
    dom.selectVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
    if (!projectId) return;
    setStatus(dom.selectStatus, '加载版本中...', '');
    loadVersions(projectId)
      .then(function() {
        syncVersionOptions(dom.selectVersionSelect, projectId, '请选择版本');
        dom.selectVersionSelect.disabled = false;
        setStatus(dom.selectStatus, '', '');
      })
      .catch(function(err) {
        setStatus(dom.selectStatus, err && err.message ? err.message : '加载版本失败', 'err');
      });
  }

  function handleSelectVersionChange() {
    state.selectDrawer.versionId = normalizeId(dom.selectVersionSelect ? dom.selectVersionSelect.value : '');
  }

  function renderSelectDrawerList() {
    if (!dom.selectListBody) return;
    var list = Array.isArray(state.selectDrawer.files) ? state.selectDrawer.files : [];
    if (state.selectDrawer.versionId) {
      list = list.filter(function(f) { return String(f && f.version_id || '') === String(state.selectDrawer.versionId || ''); });
    }
    if (!list.length) {
      dom.selectListBody.innerHTML = '<tr><td colspan=\"7\"><p class=\"hint\">暂无用例文件</p></td></tr>';
      return;
    }
    var projectName = state.projectNameById[state.selectDrawer.projectId] || ('项目#' + state.selectDrawer.projectId);
    dom.selectListBody.innerHTML = list.map(function(f) {
      var versionName = getVersionName(state.selectDrawer.projectId, f && f.version_id ? f.version_id : null);
      var importerName = f && f.importer_name ? f.importer_name : '--';
      var importedAt = formatTime(f && f.imported_at);
      var updatedAt = formatTime(f && f.updated_at);
      return (
        '<tr>' +
          '<td>' + escapeHtml(projectName) + '</td>' +
          '<td>' + escapeHtml(versionName) + '</td>' +
          '<td>' + escapeHtml(f && f.file_name_clean ? f.file_name_clean : ('文件#' + (f && f.id ? f.id : ''))) + '</td>' +
          '<td>' + escapeHtml(importerName) + '</td>' +
          '<td>' + escapeHtml(importedAt) + '</td>' +
          '<td>' + escapeHtml(updatedAt) + '</td>' +
          '<td><button class=\"primary\" type=\"button\" data-case-lib-exec=\"' + escapeHtml(f && f.id ? f.id : '') + '\">转到执行</button></td>' +
        '</tr>'
      );
    }).join('');
  }

  function loadSelectDrawerFiles() {
    var projectId = normalizeId(dom.selectProjectSelect ? dom.selectProjectSelect.value : '');
    var versionId = normalizeId(dom.selectVersionSelect ? dom.selectVersionSelect.value : '');
    state.selectDrawer.projectId = projectId;
    state.selectDrawer.versionId = versionId;
    state.selectDrawer.files = [];
    renderSelectDrawerList();
    if (!projectId) {
      setStatus(dom.selectStatus, '请先选择项目', 'warn');
      return;
    }
    setStatus(dom.selectStatus, '加载用例库...', '');
    state.selectDrawer.loading = true;
    Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId)])
      .then(function(res) {
        var files = Array.isArray(res && res[0]) ? res[0] : [];
        state.selectDrawer.files = files;
        setStatus(dom.selectStatus, '已加载 ' + files.length + ' 份用例文件', files.length ? 'ok' : 'warn');
        renderSelectDrawerList();
      })
      .catch(function(err) {
        setStatus(dom.selectStatus, err && err.message ? err.message : '加载失败', 'err');
      })
      .finally(function() {
        state.selectDrawer.loading = false;
      });
  }

  function findCaseFileInSelectDrawer(id) {
    var fileId = Number(id);
    if (isNaN(fileId)) return null;
    return (state.selectDrawer.files || []).find(function(f) { return f && f.id === fileId; }) || null;
  }

  function execCaseFileFromDrawer(caseFile) {
    if (!caseFile || !caseFile.id) return;
    setStatus(dom.selectStatus, '加载用例条目...', '');
    apiClient.listCaseItems(caseFile.id).then(function(items) {
      transferItemsToTempExec(caseFile, caseFile.file_name_clean || ('用例#' + caseFile.id), items || []);
      setStatus(dom.selectStatus, '已转到执行：' + (caseFile.file_name_clean || ''), 'ok');
      if (selectDrawerInstance && typeof selectDrawerInstance.close === 'function') selectDrawerInstance.close();
    }).catch(function(err) {
      setStatus(dom.selectStatus, err && err.message ? err.message : '加载用例失败', 'err');
    });
  }

  function bindEvents() {
    if (dom.importInput) {
      dom.importInput.addEventListener('change', function(e) {
        var files = e && e.target && e.target.files ? Array.from(e.target.files) : [];
        handleImportFiles(files);
        try { e.target.value = ''; } catch (_) {}
      });
    }
    if (dom.importDropZone) {
      dom.importDropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dom.importDropZone.classList.add('dragover');
      });
      dom.importDropZone.addEventListener('dragleave', function() {
        dom.importDropZone.classList.remove('dragover');
      });
      dom.importDropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dom.importDropZone.classList.remove('dragover');
        var files = e && e.dataTransfer ? e.dataTransfer.files : null;
        if (files && files.length) handleImportFiles(files);
      });
    }
    if (dom.importProjectSelect) {
      dom.importProjectSelect.addEventListener('change', handleImportProjectChange);
    }
    if (dom.importVersionSelect) {
      dom.importVersionSelect.addEventListener('change', handleImportVersionChange);
    }
    if (dom.importConfirmBtn) {
      dom.importConfirmBtn.addEventListener('click', confirmImportToDb);
    }

    if (dom.editDrawerConfirmBtn) {
      dom.editDrawerConfirmBtn.addEventListener('click', loadEditDrawerFiles);
    }
    if (dom.editDrawerListBody) {
      dom.editDrawerListBody.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-case-lib-edit]') : null;
        if (!btn) return;
        var id = btn.getAttribute('data-case-lib-edit');
        var file = findCaseFileInEditDrawer(id);
        if (file) openEditorForCaseFile(file);
      });
    }

    if (dom.editSearchInput) {
      dom.editSearchInput.addEventListener('input', function() {
        state.editor.searchText = dom.editSearchInput.value || '';
        state.editor.pageIndex = 0;
        renderEditorTable();
      });
    }
    if (dom.editClearSearchBtn) {
      dom.editClearSearchBtn.addEventListener('click', function() {
        state.editor.searchText = '';
        state.editor.pageIndex = 0;
        if (dom.editSearchInput) dom.editSearchInput.value = '';
        renderEditorTable();
      });
    }
    if (dom.editToExecBtn) {
      dom.editToExecBtn.addEventListener('click', function() {
        var file = state.editor.caseFile;
        if (!file) {
          setStatus(dom.editStatus, '请先选择用例', 'warn');
          return;
        }
        transferItemsToTempExec(file, file.file_name_clean || ('用例#' + file.id), state.editor.items || []);
      });
    }
    if (dom.editView) {
      dom.editView.addEventListener('click', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t) return;
        var toggle = t.closest ? t.closest('[data-case-lib-remark-toggle]') : null;
        if (toggle) {
          toggleRemark(toggle.getAttribute('data-index'));
          return;
        }
        var insertBtn = t.closest ? t.closest('[data-case-lib-insert]') : null;
        if (insertBtn) {
          insertCaseItem(Number(insertBtn.getAttribute('data-index')));
          return;
        }
        var removeBtn = t.closest ? t.closest('[data-case-lib-remove]') : null;
        if (removeBtn) {
          removeCaseItem(Number(removeBtn.getAttribute('data-index')));
          return;
        }
        var pageBtn = t.closest ? t.closest('[data-case-lib-page]') : null;
        if (pageBtn) {
          handlePaginationAction(pageBtn.getAttribute('data-case-lib-page'));
        }
      });
      dom.editView.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t) return;
        if (t.hasAttribute && t.hasAttribute('data-case-lib-page-input')) {
          handlePaginationJump(t.value);
          return;
        }
        if (t.hasAttribute && t.hasAttribute('data-case-lib-select-all')) {
          var visibleStr = t.getAttribute('data-visible') || '';
          var visible = visibleStr.split(',').map(function(v) { return Number(v); }).filter(function(v) { return isFinite(v); });
          visible.forEach(function(idx) {
            if (t.checked) state.editor.selection.add(idx);
            else state.editor.selection.delete(idx);
          });
          renderEditorTable();
          return;
        }
        if (t.hasAttribute && t.hasAttribute('data-case-lib-select')) {
          var idx = Number(t.getAttribute('data-index'));
          if (!isFinite(idx)) return;
          if (t.checked) state.editor.selection.add(idx);
          else state.editor.selection.delete(idx);
        }
      });
      dom.editView.addEventListener('focusout', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.getAttribute) return;
        var field = t.getAttribute('data-case-lib-edit-field');
        if (!field) return;
        var idx = Number(t.getAttribute('data-index'));
        if (!isFinite(idx)) return;
        var multiline = String(t.getAttribute('data-case-lib-multiline') || '').toLowerCase() === 'true';
        var raw = multiline ? t.innerText : t.textContent;
        var value = String(raw || '').trim();
        var item = state.editor.items[idx];
        if (!item) return;
        item[field] = value;
        saveCaseItemAtIndex(idx, '保存');
      });
      dom.editView.addEventListener('blur', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.getAttribute) return;
        if (!t.hasAttribute('data-case-lib-remark')) return;
        var idx = Number(t.getAttribute('data-index'));
        if (!isFinite(idx)) return;
        var item = state.editor.items[idx];
        if (!item) return;
        item.remark = t.value || '';
        saveCaseItemAtIndex(idx, '保存');
      }, true);
    }

    if (dom.selectProjectSelect) {
      dom.selectProjectSelect.addEventListener('change', handleSelectProjectChange);
    }
    if (dom.selectVersionSelect) {
      dom.selectVersionSelect.addEventListener('change', handleSelectVersionChange);
    }
    if (dom.selectConfirmBtn) {
      dom.selectConfirmBtn.addEventListener('click', loadSelectDrawerFiles);
    }
    if (dom.selectListBody) {
      dom.selectListBody.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-case-lib-exec]') : null;
        if (!btn) return;
        var id = btn.getAttribute('data-case-lib-exec');
        var file = findCaseFileInSelectDrawer(id);
        if (file) execCaseFileFromDrawer(file);
      });
    }
  }

  function bindTabActivation() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('app-tab-activated', function(e) {
      var tabName = e && e.detail ? e.detail.tab : '';
      if (tabName !== 'case-library') return;
      if (!isAuthReady()) return;
      ensureProjectsReady();
    });
    window.addEventListener('app-auth-ready', function() {
      var globalState = window.app && window.app.state ? window.app.state : {};
      var tabName = globalState && globalState.activeTab ? globalState.activeTab : '';
      if (tabName === 'case-library') ensureProjectsReady();
    });
  }

  function init() {
    if (!dom.root) return;
    importDrawerInstance = ensureDrawer('caseLibraryImportDrawer', ['openCaseLibraryImportDrawerBtn'], function() {
      ensureProjectsReady().then(resetImportDrawer);
    });
    editDrawerInstance = ensureDrawer('caseLibraryEditDrawer', ['openCaseLibraryEditDrawerBtn'], function() {
      ensureProjectsReady().then(resetEditDrawer);
    });
    selectDrawerInstance = ensureDrawer('caseLibrarySelectExecDrawer', ['openCaseLibrarySelectExecDrawerBtn'], function() {
      ensureProjectsReady().then(resetSelectDrawer);
    });

    bindEvents();
    bindTabActivation();
    bindProjectsUpdated();

    // 若刷新后停留在用例库页，补一次加载。
    var visible = document.querySelector('section[data-tab-section=\"case-library\"]:not(.hidden)');
    if (visible && isAuthReady()) ensureProjectsReady();
    window.app = window.app || {};
    window.app.caseLibraryBound = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
