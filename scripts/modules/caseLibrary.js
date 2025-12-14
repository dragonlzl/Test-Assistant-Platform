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

    importDiffTitle: document.getElementById('caseLibraryImportDiffTitle'),
    importDiffStatus: document.getElementById('caseLibraryImportDiffStatus'),
    importDiffLeftTitle: document.getElementById('caseLibraryImportDiffLeftTitle'),
    importDiffLeftMeta: document.getElementById('caseLibraryImportDiffLeftMeta'),
    importDiffLeftBody: document.getElementById('caseLibraryImportDiffLeftBody'),
    importDiffRightTitle: document.getElementById('caseLibraryImportDiffRightTitle'),
    importDiffRightMeta: document.getElementById('caseLibraryImportDiffRightMeta'),
    importDiffRightBody: document.getElementById('caseLibraryImportDiffRightBody'),
    importDiffOverwriteBtn: document.getElementById('caseLibraryImportDiffOverwriteBtn'),

    editDrawerProjectSelect: document.getElementById('caseLibraryEditProjectSelect'),
    editDrawerVersionSelect: document.getElementById('caseLibraryEditVersionSelect'),
    editDrawerConfirmBtn: document.getElementById('caseLibraryEditConfirmBtn'),
    editDrawerExportXmindBtn: document.getElementById('caseLibraryEditExportXmindBtn'),
    editDrawerExportExcelBtn: document.getElementById('caseLibraryEditExportExcelBtn'),
    editDrawerDeleteBtn: document.getElementById('caseLibraryEditDeleteBtn'),
    editDrawerSelectAll: document.getElementById('caseLibraryEditSelectAll'),
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

    importDiff: {
      fileName: '',
      cleanName: '',
      importedCleanName: '',
      source: '',
      projectId: null,
      importVersionId: null,
      dbVersionId: null,
      importItems: [],
      dbItems: [],
      rows: [],
      loading: false,
    },

    editDrawer: {
      projectId: null,
      versionId: null,
      files: [],
      loading: false,
      selection: new Set(),
      restoring: false,
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
      restoring: false,
    },
  };

  var importDrawerInstance = null;
  var importDiffDrawerInstance = null;
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

  function normalizeDiffText(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\r\n/g, '\n').trim();
  }

  function buildCaseItemKey(item) {
    if (!item) return '';
    var module = normalizeDiffText(item.module || '').toLowerCase();
    var title = normalizeDiffText(item.title || '').toLowerCase();
    var expected = normalizeDiffText(item.expected || '').toLowerCase();
    return [module, title, expected].join('::');
  }

  function dedupeCaseItemsByKey(list) {
    var items = Array.isArray(list) ? list : [];
    var seen = {};
    var out = [];
    items.forEach(function(it) {
      var k = buildCaseItemKey(it);
      if (!k) return;
      if (seen[k]) return;
      seen[k] = true;
      out.push(it);
    });
    return out;
  }

  function compareCaseItemFields(left, right) {
    var diff = {
      priority: false,
      precondition: false,
      steps: false,
    };
    if (!left || !right) return diff;
    diff.priority = normalizeDiffText(left.priority || '') !== normalizeDiffText(right.priority || '');
    diff.precondition = normalizeDiffText(left.precondition || left.preconditions || '') !== normalizeDiffText(right.precondition || right.preconditions || '');
    diff.steps = normalizeDiffText(left.steps || '') !== normalizeDiffText(right.steps || '');
    return diff;
  }

  function buildImportDiffRows(importItems, dbItems) {
    var leftList = dedupeCaseItemsByKey(importItems);
    var rightList = dedupeCaseItemsByKey(dbItems);
    var leftMap = {};
    var rightMap = {};
    leftList.forEach(function(it) {
      var k = buildCaseItemKey(it);
      if (!k) return;
      leftMap[k] = it;
    });
    rightList.forEach(function(it) {
      var k = buildCaseItemKey(it);
      if (!k) return;
      rightMap[k] = it;
    });
    var keys = {};
    Object.keys(leftMap).forEach(function(k) { keys[k] = true; });
    Object.keys(rightMap).forEach(function(k) { keys[k] = true; });
    var keyList = Object.keys(keys);
    keyList.sort(function(a, b) {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
    return keyList.map(function(k) {
      var left = leftMap[k] || null;
      var right = rightMap[k] || null;
      var rowType = '';
      var fieldDiff = compareCaseItemFields(left, right);
      var changed = Boolean(fieldDiff.priority || fieldDiff.precondition || fieldDiff.steps);
      if (left && !right) rowType = 'added';
      else if (!left && right) rowType = 'removed';
      else if (left && right && changed) rowType = 'changed';
      else rowType = 'same';
      return {
        key: k,
        left: left,
        right: right,
        type: rowType,
        diff: fieldDiff,
      };
    });
  }

  function renderImportDiffTable(bodyEl, rows, side) {
    if (!bodyEl) return;
    if (!rows || !rows.length) {
      bodyEl.innerHTML = '<tr><td colspan="7"><p class="hint">暂无数据</p></td></tr>';
      return;
    }
    bodyEl.innerHTML = rows.map(function(row, idx) {
      var item = side === 'left' ? row.left : row.right;
      var other = side === 'left' ? row.right : row.left;
      var isPlaceholder = !item;
      var rowCls = '';
      if (row.type === 'added' && side === 'left') rowCls = 'diff-row-added';
      if (row.type === 'removed' && side === 'right') rowCls = 'diff-row-removed';
      if (row.type === 'changed') rowCls = 'diff-row-changed';

      var module = item ? (item.module || '') : '';
      var title = item ? (item.title || '') : '';
      var expected = item ? (item.expected || '') : '';
      var priority = item ? (item.priority || '') : '';
      var precondition = item ? (item.precondition || item.preconditions || '') : '';
      var steps = item ? (item.steps || '') : '';

      var priorityCls = '';
      var preconditionCls = '';
      var stepsCls = '';
      if (!isPlaceholder && other && row.type === 'changed') {
        if (row.diff && row.diff.priority) priorityCls = 'diff-cell-changed';
        if (row.diff && row.diff.precondition) preconditionCls = 'diff-cell-changed';
        if (row.diff && row.diff.steps) stepsCls = 'diff-cell-changed';
      }

      var hint = isPlaceholder ? '<p class="hint">（无对应项）</p>' : '';
      return (
        '<tr class="' + escapeHtml(rowCls) + '">' +
          '<td>' + escapeHtml(String(idx + 1)) + '</td>' +
          '<td>' + escapeHtml(module) + '</td>' +
          '<td>' + escapeHtml(title) + hint + '</td>' +
          '<td class="' + escapeHtml(priorityCls) + '">' + escapeHtml(priority) + '</td>' +
          '<td class="' + escapeHtml(preconditionCls) + '">' + escapeHtml(precondition) + '</td>' +
          '<td class="' + escapeHtml(stepsCls) + '">' + escapeHtml(steps) + '</td>' +
          '<td>' + escapeHtml(expected) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function syncImportDiffControls() {
    if (!dom.importDiffOverwriteBtn) return;
    var can = Boolean(
      !state.importDiff.loading &&
      state.importDiff.projectId &&
      state.importDiff.importVersionId &&
      state.importDiff.fileName &&
      Array.isArray(state.importDiff.importItems) &&
      state.importDiff.importItems.length
    );
    dom.importDiffOverwriteBtn.disabled = !can;
  }

  function openImportDiffDrawer(payload) {
    payload = payload || {};
    state.importDiff.fileName = payload.fileName || '';
    state.importDiff.cleanName = payload.cleanName || '';
    state.importDiff.importedCleanName = payload.importedCleanName || '';
    state.importDiff.source = payload.source || '';
    state.importDiff.projectId = payload.projectId || null;
    state.importDiff.importVersionId = payload.importVersionId || null;
    state.importDiff.dbVersionId = payload.dbVersionId || null;
    state.importDiff.importItems = Array.isArray(payload.importItems) ? payload.importItems : [];
    state.importDiff.dbItems = Array.isArray(payload.dbItems) ? payload.dbItems : [];
    state.importDiff.rows = buildImportDiffRows(state.importDiff.importItems, state.importDiff.dbItems);
    state.importDiff.loading = false;

    var projectName = state.projectNameById[state.importDiff.projectId] || ('项目#' + state.importDiff.projectId);
    var importVerName = getVersionName(state.importDiff.projectId, state.importDiff.importVersionId);
    var dbVerName = getVersionName(state.importDiff.projectId, state.importDiff.dbVersionId);
    var leftCount = dedupeCaseItemsByKey(state.importDiff.importItems).length;
    var rightCount = dedupeCaseItemsByKey(state.importDiff.dbItems).length;
    var changedCount = state.importDiff.rows.filter(function(r) { return r && r.type === 'changed'; }).length;
    var addedCount = state.importDiff.rows.filter(function(r) { return r && r.type === 'added'; }).length;
    var removedCount = state.importDiff.rows.filter(function(r) { return r && r.type === 'removed'; }).length;

    if (dom.importDiffTitle) {
      dom.importDiffTitle.textContent = '同名用例差异对比：' + (state.importDiff.cleanName || state.importDiff.fileName || '用例');
    }
    if (dom.importDiffLeftTitle) dom.importDiffLeftTitle.textContent = '导入用例（待入库）';
    if (dom.importDiffRightTitle) dom.importDiffRightTitle.textContent = '库中用例（已存在）';
    if (dom.importDiffLeftMeta) {
      dom.importDiffLeftMeta.textContent = projectName + ' / ' + importVerName + ' / ' + leftCount + ' 条';
      if (leftCount !== rightCount) dom.importDiffLeftMeta.classList.add('warn');
      else dom.importDiffLeftMeta.classList.remove('warn');
    }
    if (dom.importDiffRightMeta) {
      dom.importDiffRightMeta.textContent = projectName + ' / ' + dbVerName + ' / ' + rightCount + ' 条';
      if (leftCount !== rightCount) dom.importDiffRightMeta.classList.add('warn');
      else dom.importDiffRightMeta.classList.remove('warn');
    }
    if (dom.importDiffStatus) {
      var summary = '对比完成：新增 ' + addedCount + ' 条，差异 ' + changedCount + ' 条，库中多出 ' + removedCount + ' 条';
      setStatus(dom.importDiffStatus, summary, (addedCount || changedCount || removedCount) ? 'warn' : 'ok');
    }
    renderImportDiffTable(dom.importDiffLeftBody, state.importDiff.rows, 'left');
    renderImportDiffTable(dom.importDiffRightBody, state.importDiff.rows, 'right');
    syncImportDiffControls();

    if (importDrawerInstance && typeof importDrawerInstance.close === 'function') {
      importDrawerInstance.close();
    }
    if (importDiffDrawerInstance && typeof importDiffDrawerInstance.open === 'function') {
      setTimeout(function() {
        importDiffDrawerInstance.open();
      }, 60);
    }
  }

  function openImportDiffDrawerLoading(payload) {
    payload = payload || {};
    var projectId = payload.projectId || null;
    var importVersionId = payload.importVersionId || null;
    var cleanName = payload.cleanName || payload.fileName || '';
    state.importDiff.fileName = payload.fileName || '';
    state.importDiff.cleanName = payload.cleanName || payload.fileName || '';
    state.importDiff.importedCleanName = payload.importedCleanName || '';
    state.importDiff.source = payload.source || '';
    state.importDiff.projectId = projectId;
    state.importDiff.importVersionId = importVersionId;
    state.importDiff.dbVersionId = null;
    state.importDiff.importItems = [];
    state.importDiff.dbItems = [];
    state.importDiff.rows = [];
    state.importDiff.loading = false;
    var projectName = state.projectNameById[projectId] || ('项目#' + projectId);
    var importVerName = getVersionName(projectId, importVersionId);

    if (dom.importDiffTitle) dom.importDiffTitle.textContent = '同名用例差异对比：' + (cleanName || '用例');
    if (dom.importDiffLeftTitle) dom.importDiffLeftTitle.textContent = '导入用例（待入库）';
    if (dom.importDiffRightTitle) dom.importDiffRightTitle.textContent = '库中用例（已存在）';
    if (dom.importDiffLeftMeta) {
      dom.importDiffLeftMeta.textContent = projectName + ' / ' + importVerName;
      dom.importDiffLeftMeta.classList.remove('warn');
    }
    if (dom.importDiffRightMeta) {
      dom.importDiffRightMeta.textContent = projectName + ' / ' + '--';
      dom.importDiffRightMeta.classList.remove('warn');
    }
    if (dom.importDiffStatus) setStatus(dom.importDiffStatus, '加载差异对比中...', '');
    if (dom.importDiffLeftBody) {
      dom.importDiffLeftBody.innerHTML = '<tr><td colspan="7"><p class="hint">加载中...</p></td></tr>';
    }
    if (dom.importDiffRightBody) {
      dom.importDiffRightBody.innerHTML = '<tr><td colspan="7"><p class="hint">加载中...</p></td></tr>';
    }
    syncImportDiffControls();

    if (importDrawerInstance && typeof importDrawerInstance.close === 'function') {
      importDrawerInstance.close();
    }
    if (importDiffDrawerInstance && typeof importDiffDrawerInstance.open === 'function') {
      setTimeout(function() {
        importDiffDrawerInstance.open();
      }, 60);
    }
  }

  function refreshCaseFileListsByProject(projectId) {
    if (!projectId) return Promise.resolve();
    if (!apiClient || typeof apiClient.listCaseFiles !== 'function') return Promise.resolve();
    return apiClient.listCaseFiles(projectId).then(function(files) {
      var list = Array.isArray(files) ? files : [];
      if (state.editDrawer.projectId && String(state.editDrawer.projectId) === String(projectId)) {
        state.editDrawer.files = list;
        renderEditDrawerList();
        syncEditDrawerControls();
      }
      if (state.selectDrawer.projectId && String(state.selectDrawer.projectId) === String(projectId)) {
        state.selectDrawer.files = list;
        renderSelectDrawerList();
      }
      var editorFile = state.editor && state.editor.caseFile ? state.editor.caseFile : null;
      if (editorFile && String(editorFile.project_id || '') === String(projectId || '')) {
        var name = editorFile.file_name_clean || '';
        var next = list.find(function(cf) { return cf && String(cf.file_name_clean || '') === String(name || ''); });
        if (next && next.id && apiClient && typeof apiClient.listCaseItems === 'function') {
          state.editor.caseFile = next;
          return apiClient.listCaseItems(next.id).then(function(items) {
            state.editor.items = Array.isArray(items) ? items : [];
            renderEditorCard();
          });
        }
      }
    });
  }

  function confirmOverwriteImportFromDiff() {
    if (state.importDiff.loading) return;
    if (!apiClient || typeof apiClient.importCaseFile !== 'function') {
      setStatus(dom.importDiffStatus, '后端导入接口未就绪', 'err');
      return;
    }
    var projectId = state.importDiff.projectId;
    var versionId = state.importDiff.importVersionId;
    var originalFileName = state.importDiff.fileName || '';
    var cleanName = state.importDiff.cleanName || originalFileName || '用例';
    var ext = (String(originalFileName || '').split('.').pop() || '').toLowerCase();
    if (!ext || ext === String(originalFileName || '').toLowerCase()) ext = 'xmind';
    var overwriteFileName = String(state.importDiff.cleanName || cleanCaseFileName(originalFileName) || 'case') + '.' + ext;
    var source = state.importDiff.source || extFromFileName(originalFileName);
    var items = Array.isArray(state.importDiff.importItems) ? state.importDiff.importItems : [];
    if (!projectId || !versionId || !overwriteFileName || !items.length) {
      setStatus(dom.importDiffStatus, '差异数据未就绪，请稍后重试', 'warn');
      return;
    }
    var ok = window.confirm('是否确认覆盖导入用例：' + cleanName + '？');
    if (!ok) return;

    state.importDiff.loading = true;
    syncImportDiffControls();
    setStatus(dom.importDiffStatus, '覆盖导入中...', '');
    setStatus(dom.importStatus, '覆盖导入中...', '');

    apiClient
      .importCaseFile(
        {
          project_id: projectId,
          version_id: versionId,
          file_name: overwriteFileName,
          source: source,
          items: items,
        },
        { overwrite: true }
      )
      .then(function() {
        var msg = '覆盖导入成功：' + cleanName;
        setStatus(dom.importDiffStatus, msg, 'ok');
        setStatus(dom.importStatus, msg, 'ok');
        setStatus(dom.status, msg, 'ok');
        refreshCaseFileListsByProject(projectId);
        if (importDiffDrawerInstance && typeof importDiffDrawerInstance.close === 'function') {
          importDiffDrawerInstance.close();
        }
      })
      .catch(function(err) {
        var msg = err && err.message ? err.message : '覆盖导入失败';
        setStatus(dom.importDiffStatus, '覆盖导入失败：' + msg, 'err');
        setStatus(dom.importStatus, '覆盖导入失败：' + msg, 'err');
      })
      .finally(function() {
        state.importDiff.loading = false;
        syncImportDiffControls();
      });
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

  function getDownloadBlob() {
    if (utils && typeof utils.downloadBlob === 'function') return utils.downloadBlob;
    var coreApi = getCore();
    if (coreApi && typeof coreApi.downloadBlob === 'function') return coreApi.downloadBlob;
    return function() {};
  }

  function sanitizeDownloadName(base, ext) {
    var name = String(base || '').trim() || '用例';
    name = name.replace(/\.[^.]+$/, '');
    name = name.replace(/[\\/:*?"<>|]/g, '_').trim();
    if (!name) name = '用例';
    return name + (ext || '');
  }

  function escapeXmlText(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function escapeXmlTextPreserve(text) {
    var escaped = escapeXmlText(text);
    escaped = escaped.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return escaped.replace(/\n/g, '&#10;');
  }

  function getCurrentUserId() {
    var globalState = window.app && window.app.state ? window.app.state : null;
    var user = globalState && globalState.currentUser ? globalState.currentUser : null;
    var userId = user && user.id !== undefined && user.id !== null ? user.id : null;
    if (!userId || String(userId) === '0') return null;
    return userId;
  }

  var editorPersistKey = 'tap-case-library-editor';

  function readEditorPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(editorPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeEditorPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(editorPersistKey);
        return;
      }
      localStorage.setItem(editorPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

  function clearEditorPersistedState() {
    writeEditorPersistedState(null);
  }

  var importDrawerPersistKey = 'tap-case-library-import-drawer';

  function readImportDrawerPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(importDrawerPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeImportDrawerPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(importDrawerPersistKey);
        return;
      }
      localStorage.setItem(importDrawerPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

  function persistImportDrawerState(nextProjectId, nextVersionId) {
    var userId = getCurrentUserId();
    if (!userId) return;
    // 若传入为空，默认不覆盖旧值，避免误把“初始化空值”写回导致无法恢复。
    var persisted = readImportDrawerPersistedState();
    if (persisted && String(persisted.user_id || '') !== String(userId)) {
      persisted = null;
    }
    var projectId = nextProjectId || (persisted ? normalizeId(persisted.project_id) : null);
    var versionId = nextVersionId || (persisted ? normalizeId(persisted.version_id) : null);
    if (!projectId) return;
    writeImportDrawerPersistedState({
      user_id: userId,
      project_id: projectId || '',
      version_id: versionId || '',
      saved_at: Date.now(),
    });
  }

  function restoreImportDrawerFromPersistedState() {
    if (!isAuthReady()) return Promise.resolve(false);
    var persisted = readImportDrawerPersistedState();
    if (!persisted) return Promise.resolve(false);
    var userId = getCurrentUserId();
    if (!userId || String(persisted.user_id || '') !== String(userId)) return Promise.resolve(false);

    var projectId = normalizeId(persisted.project_id);
    var versionId = normalizeId(persisted.version_id);
    if (!projectId) return Promise.resolve(false);

    var hasProject = (state.projects || []).some(function(p) { return p && String(p.id) === String(projectId); });
    if (!hasProject) return Promise.resolve(false);

    state.importDrawer.projectId = projectId;
    state.importDrawer.versionId = null;
    if (dom.importProjectSelect) dom.importProjectSelect.value = String(projectId);

    if (!dom.importVersionSelect) {
      syncImportConfirmEnabled();
      return Promise.resolve(true);
    }

    dom.importVersionSelect.disabled = true;
    dom.importVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
    dom.importVersionSelect.value = '';
    syncImportConfirmEnabled();

    return loadVersions(projectId)
      .then(function() {
        syncVersionOptions(dom.importVersionSelect, projectId, '请选择版本');
        dom.importVersionSelect.disabled = false;
        if (versionId) {
          // 仅当版本存在于下拉选项时才回填。
          var ok = (state.versionsByProject[projectId] || []).some(function(v) { return v && String(v.id) === String(versionId); });
          if (ok) {
            dom.importVersionSelect.value = String(versionId);
            state.importDrawer.versionId = versionId;
          }
        }
        syncImportConfirmEnabled();
        return true;
      })
      .catch(function() {
        // 恢复失败不影响抽屉使用
        return false;
      });
  }

  function persistEditorSelection(caseFile) {
    if (!caseFile || caseFile.id === null || caseFile.id === undefined) return;
    var userId = getCurrentUserId();
    if (!userId) return;
    var payload = {
      user_id: userId,
      project_id: caseFile.project_id,
      case_file_id: caseFile.id,
      saved_at: Date.now(),
    };
    writeEditorPersistedState(payload);
  }

  var editDrawerPersistKey = 'tap-case-library-edit-drawer';

  function readEditDrawerPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(editDrawerPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeEditDrawerPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(editDrawerPersistKey);
        return;
      }
      localStorage.setItem(editDrawerPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

  function persistEditDrawerState(opts) {
    opts = opts || {};
    var userId = getCurrentUserId();
    if (!userId) return;
    var projectId = state.editDrawer && state.editDrawer.projectId ? state.editDrawer.projectId : null;
    var versionId = state.editDrawer && state.editDrawer.versionId ? state.editDrawer.versionId : null;
    var selection = state.editDrawer && state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
    state.editDrawer.selection = selection;
    // 保护：避免“初始化/刷新期间 state 为空”时把已持久化的选择覆盖成空，导致无法恢复。
    if (!opts.force_clear && !projectId) {
      var existing = readEditDrawerPersistedState();
      if (existing && String(existing.user_id || '') === String(userId)) {
        var existingProjectId = normalizeId(existing.project_id);
        if (existingProjectId) projectId = existingProjectId;
        var existingVersionId = normalizeId(existing.version_id);
        if (!versionId && existingVersionId) versionId = existingVersionId;
        if (!selection.size && Array.isArray(existing.selected_ids) && existing.selected_ids.length) {
          selection = new Set(existing.selected_ids.map(function(v) { return String(v); }));
          state.editDrawer.selection = selection;
        }
      }
    }
    var payload = {
      user_id: userId,
      project_id: projectId || '',
      version_id: versionId || '',
      selected_ids: Array.from(selection),
      drawer_open: Boolean(opts.drawer_open),
      saved_at: Date.now(),
    };
    writeEditDrawerPersistedState(payload);
  }

  function restoreEditDrawerFromPersistedState() {
    if (!isAuthReady()) return Promise.resolve(false);
    if (state.editDrawer && state.editDrawer.restoring === true) return Promise.resolve(false);
    var persisted = readEditDrawerPersistedState();
    if (!persisted) return Promise.resolve(false);
    var userId = getCurrentUserId();
    if (!userId || String(persisted.user_id || '') !== String(userId)) return Promise.resolve(false);
    var projectId = normalizeId(persisted.project_id);
    var versionId = normalizeId(persisted.version_id);
    var ids = Array.isArray(persisted.selected_ids) ? persisted.selected_ids.map(function(v) { return String(v); }) : [];
    if (!projectId) return Promise.resolve(false);

    state.editDrawer = state.editDrawer || {};
    state.editDrawer.restoring = true;
    state.editDrawer.projectId = projectId;
    state.editDrawer.versionId = versionId || null;
    state.editDrawer.selection = new Set(ids);
    if (dom.editDrawerProjectSelect) dom.editDrawerProjectSelect.value = String(projectId);
    if (dom.editDrawerVersionSelect) {
      dom.editDrawerVersionSelect.disabled = true;
      dom.editDrawerVersionSelect.innerHTML = '<option value=\"\">全部版本</option>';
      dom.editDrawerVersionSelect.value = '';
    }
    renderEditDrawerList();
    syncEditDrawerControls();

    return loadVersions(projectId)
      .then(function() {
        if (dom.editDrawerVersionSelect) {
          syncVersionOptions(dom.editDrawerVersionSelect, projectId, '全部版本');
          dom.editDrawerVersionSelect.disabled = false;
          if (versionId) dom.editDrawerVersionSelect.value = String(versionId);
          else dom.editDrawerVersionSelect.value = '';
        }
        return apiClient.listCaseFiles(projectId);
      })
      .then(function(files) {
        state.editDrawer.files = Array.isArray(files) ? files : [];
        // 仅保留当前可见列表里的勾选，避免版本切换后隐藏项仍被导出。
        var visibleIds = {};
        getEditDrawerVisibleFiles().forEach(function(f) {
          if (!f || f.id === null || f.id === undefined) return;
          visibleIds[String(f.id)] = true;
        });
        var nextSel = new Set();
        (state.editDrawer.selection || new Set()).forEach(function(id) {
          if (visibleIds[String(id)]) nextSel.add(String(id));
        });
        state.editDrawer.selection = nextSel;
        renderEditDrawerList();
        syncEditDrawerControls();
        return true;
      })
      .catch(function(err) {
        console.error(err);
        return false;
      })
      .finally(function() {
        state.editDrawer.restoring = false;
      });
  }

  function isAuthReady() {
    if (window.app && window.app.authReady === true) return true;
    var globalState = window.app && window.app.state ? window.app.state : null;
    return Boolean(globalState && globalState.currentUser);
  }

  function isAdminUser() {
    if (!window.app || window.app.authReady !== true) return false;
    var globalState = window.app && window.app.state ? window.app.state : null;
    var user = globalState && globalState.currentUser ? globalState.currentUser : null;
    return Boolean(user && user.role === 'admin');
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

  function ensureDrawer(drawerId, openButtons, onOpen, onClose) {
    if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
    return window.app.drawer.createDrawer({
      drawerId: drawerId,
      openButtons: Array.isArray(openButtons) ? openButtons : [],
      closeButtons: [],
      onOpen: typeof onOpen === 'function' ? onOpen : undefined,
      onClose: typeof onClose === 'function' ? onClose : undefined,
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
      var importSelected = dom.importProjectSelect ? String(dom.importProjectSelect.value || '') : '';
      var editSelected = dom.editDrawerProjectSelect ? String(dom.editDrawerProjectSelect.value || '') : '';
      var selectSelected = dom.selectProjectSelect ? String(dom.selectProjectSelect.value || '') : '';
      state.projects = Array.isArray(list) ? list : [];
      syncProjectOptions(dom.importProjectSelect, '请选择项目');
      syncProjectOptions(dom.editDrawerProjectSelect, '请选择项目');
      syncProjectOptions(dom.selectProjectSelect, '请选择项目');
      // 仅刷新 option 列表，不强制清空用户已选项目；若新列表不含该值，浏览器会自动回到空值。
      if (dom.importProjectSelect && importSelected) dom.importProjectSelect.value = importSelected;
      if (dom.editDrawerProjectSelect && editSelected) dom.editDrawerProjectSelect.value = editSelected;
      if (dom.selectProjectSelect && selectSelected) dom.selectProjectSelect.value = selectSelected;
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
  }

  function bindProjectsUpdated() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('app-projects-updated', function() {
      invalidateProjectsCache();
      var globalState = window.app && window.app.state ? window.app.state : {};
      var tabName = globalState && globalState.activeTab ? globalState.activeTab : '';
      if (tabName === 'case-library' && isAuthReady()) {
        ensureProjectsReady()
          .then(function() {
            return restoreEditorFromPersistedState();
          })
          .then(function() {
            var persisted = readEditDrawerPersistedState();
            var userId = getCurrentUserId();
            var shouldOpen = Boolean(persisted && userId && String(persisted.user_id || '') === String(userId) && persisted.drawer_open === true);
            if (shouldOpen && editDrawerInstance && typeof editDrawerInstance.open === 'function') {
              editDrawerInstance.open();
            }
          });
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
    return restoreImportDrawerFromPersistedState();
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
    if (projectId) persistImportDrawerState(projectId, null);
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
    if (state.importDrawer.projectId && state.importDrawer.versionId) {
      persistImportDrawerState(state.importDrawer.projectId, state.importDrawer.versionId);
    }
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
    var diffOpened = false;
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
              var errPayload = err && err.payload ? err.payload : null;
              failDetails.push({ file: file && file.name ? file.name : '文件', reason: msg });
              if (msg.indexOf('同名') !== -1) {
                var importedCleanName = cleanCaseFileName(file.name);
                var matchedCaseFileId = errPayload && errPayload.existing_case_file_id ? errPayload.existing_case_file_id : null;
                var matchedCleanName = errPayload && errPayload.existing_file_name_clean ? String(errPayload.existing_file_name_clean) : importedCleanName;
                var matchedVersionId = errPayload && (errPayload.existing_version_id || errPayload.existing_version_id === 0) ? errPayload.existing_version_id : null;
                duplicateNames.push(matchedCleanName || importedCleanName);
                if (matchedCleanName && importedCleanName && matchedCleanName !== importedCleanName) {
                  msg = msg + '（匹配：' + matchedCleanName + '）';
                }
                if (!diffOpened) {
                  diffOpened = true;
                  var cleanName = matchedCleanName || importedCleanName;
                  var source = file.type || extFromFileName(file.name);
                  openImportDiffDrawerLoading({
                    fileName: file.name,
                    cleanName: cleanName,
                    importedCleanName: importedCleanName,
                    projectId: s.projectId,
                    importVersionId: s.versionId,
                    source: source,
                  });
                  // 拉取库中同名用例内容用于差异对比。
                  (matchedCaseFileId
                    ? Promise.all([apiClient.listCaseItems(matchedCaseFileId), loadVersions(s.projectId)]).then(function(res) {
                      var dbItems = Array.isArray(res && res[0]) ? res[0] : [];
                      openImportDiffDrawer({
                        fileName: file.name,
                        cleanName: cleanName,
                        importedCleanName: importedCleanName,
                        projectId: s.projectId,
                        importVersionId: s.versionId,
                        dbVersionId: matchedVersionId,
                        importItems: items,
                        dbItems: dbItems || [],
                        source: source,
                      });
                    })
                    : Promise.all([apiClient.listCaseFiles(s.projectId), loadVersions(s.projectId)])
                        .then(function(res) {
                          var files = Array.isArray(res && res[0]) ? res[0] : [];
                          var list = Array.isArray(files) ? files : [];
                          var existing = list.find(function(cf) {
                            return cf && String(cf.file_name_clean || '') === String(cleanName || '');
                          });
                          if (!existing) throw new Error('未找到库中同名用例：' + cleanName);
                          return apiClient.listCaseItems(existing.id).then(function(dbItems) {
                            openImportDiffDrawer({
                              fileName: file.name,
                              cleanName: cleanName,
                              importedCleanName: importedCleanName,
                              projectId: s.projectId,
                              importVersionId: s.versionId,
                              dbVersionId: existing.version_id || null,
                              importItems: items,
                              dbItems: dbItems || [],
                              source: source,
                            });
                          });
                        })
                  )
                    .catch(function(e) {
                      setStatus(dom.importDiffStatus, (e && e.message ? e.message : '打开差异对比失败'), 'err');
                      setStatus(dom.importStatus, (e && e.message ? e.message : '打开差异对比失败'), 'err');
                    });
                }
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
      // 防止重复导入：当本次导入全部成功后，自动清空文件选择（保留项目/版本默认值）。
      if (successCount > 0 && failCount === 0 && diffOpened !== true) {
        s.files = [];
        renderImportFileHint();
        if (dom.importInput) {
          try {
            dom.importInput.value = '';
          } catch (e) {
            // ignore
          }
        }
      }
      syncImportConfirmEnabled();
    });
  }

  function resetEditDrawer() {
    state.editDrawer.projectId = null;
    state.editDrawer.versionId = null;
    state.editDrawer.files = [];
    state.editDrawer.loading = false;
    state.editDrawer.selection = new Set();
    setStatus(dom.editDrawerStatus, '', '');
    syncProjectOptions(dom.editDrawerProjectSelect, '请选择项目');
    if (dom.editDrawerProjectSelect) dom.editDrawerProjectSelect.value = '';
    if (dom.editDrawerVersionSelect) {
      dom.editDrawerVersionSelect.disabled = true;
      dom.editDrawerVersionSelect.innerHTML = '<option value=\"\">全部版本</option>';
      dom.editDrawerVersionSelect.value = '';
    }
    if (dom.editDrawerExportXmindBtn) dom.editDrawerExportXmindBtn.disabled = true;
    if (dom.editDrawerExportExcelBtn) dom.editDrawerExportExcelBtn.disabled = true;
    if (dom.editDrawerListBody) {
      dom.editDrawerListBody.innerHTML = '<tr><td colspan=\"10\"><p class=\"hint\">请选择项目后自动刷新。</p></td></tr>';
    }
    syncEditDrawerControls();
  }

  function handleEditDrawerVersionChange() {
    state.editDrawer.versionId = normalizeId(dom.editDrawerVersionSelect ? dom.editDrawerVersionSelect.value : '');
    state.editDrawer.selection = new Set();
    renderEditDrawerList();
    syncEditDrawerControls();
    persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
  }

  function getSelectedEditDrawerCaseFiles() {
    var selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
    state.editDrawer.selection = selection;
    if (!selection.size) return [];
    var list = Array.isArray(state.editDrawer.files) ? state.editDrawer.files : [];
    return list.filter(function(f) { return f && f.id !== null && f.id !== undefined && selection.has(String(f.id)); });
  }

  function exportEditDrawerSelectionToXmind() {
    if (state.editDrawer.loading) return;
    var files = getSelectedEditDrawerCaseFiles();
    if (!files.length) {
      setStatus(dom.editDrawerStatus, '请先勾选要导出的用例文件', 'warn');
      return;
    }
    var builder = getXmindBuilder();
    if (!builder) {
      setStatus(dom.editDrawerStatus, '缺少 XMind 导出依赖', 'err');
      return;
    }
    if (!apiClient || typeof apiClient.listCaseItems !== 'function') {
      setStatus(dom.editDrawerStatus, '后端用例条目接口未就绪', 'err');
      return;
    }
    var downloadBlob = getDownloadBlob();
    var zipCtor = (typeof JSZip !== 'undefined' ? JSZip : (window.JSZip ? window.JSZip : null));
    var isBatch = files.length > 1;
    var zip = isBatch && zipCtor ? new zipCtor() : null;
    var success = 0;
    var fail = 0;
    if (dom.editDrawerExportXmindBtn) dom.editDrawerExportXmindBtn.disabled = true;
    setStatus(dom.editDrawerStatus, (isBatch ? ('批量导出 XMind（' + files.length + '份）...') : '正在导出 XMind...'), '');

    var chain = Promise.resolve();
    files.forEach(function(f) {
      chain = chain.then(function() {
        var baseName = f && f.file_name_clean ? String(f.file_name_clean) : ('用例#' + (f && f.id ? f.id : ''));
        return apiClient
          .listCaseItems(f.id)
          .then(function(items) { return builder(items || [], baseName, ''); })
          .then(function(pkg) {
            if (!pkg || !pkg.blob) throw new Error('无导出内容');
            var fileName = sanitizeDownloadName(baseName, '.xmind');
            if (zip) {
              zip.file(fileName, pkg.blob);
            } else {
              downloadBlob(fileName, pkg.blob);
            }
            success += 1;
          })
          .catch(function(err) {
            fail += 1;
            console.error(err);
          });
      });
    });
    chain
      .then(function() {
        if (zip) {
          if (!success) throw new Error('全部导出失败');
          return zip.generateAsync({ type: 'blob' }).then(function(blob) {
            downloadBlob('用例批量导出_xmind.zip', blob);
          });
        }
        return null;
      })
      .then(function() {
        setStatus(dom.editDrawerStatus, '导出完成：成功 ' + success + ' 份，失败 ' + fail + ' 份', fail ? 'warn' : 'ok');
      })
      .catch(function(err) {
        setStatus(dom.editDrawerStatus, '导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      })
      .finally(function() {
        if (dom.editDrawerExportXmindBtn) dom.editDrawerExportXmindBtn.disabled = false;
      });
  }

  function exportEditDrawerSelectionToExcel() {
    if (state.editDrawer.loading) return;
    var files = getSelectedEditDrawerCaseFiles();
    if (!files.length) {
      setStatus(dom.editDrawerStatus, '请先勾选要导出的用例文件', 'warn');
      return;
    }
    if (!apiClient || typeof apiClient.listCaseItems !== 'function') {
      setStatus(dom.editDrawerStatus, '后端用例条目接口未就绪', 'err');
      return;
    }
    var downloadBlob = getDownloadBlob();
    var zipCtor = (typeof JSZip !== 'undefined' ? JSZip : (window.JSZip ? window.JSZip : null));
    var isBatch = files.length > 1;
    var zip = isBatch && zipCtor ? new zipCtor() : null;
    var success = 0;
    var fail = 0;
    if (dom.editDrawerExportExcelBtn) dom.editDrawerExportExcelBtn.disabled = true;
    setStatus(dom.editDrawerStatus, (isBatch ? ('批量导出 Excel（' + files.length + '份）...') : '正在导出 Excel...'), '');

    var chain = Promise.resolve();
    files.forEach(function(f) {
      chain = chain.then(function() {
        var baseName = f && f.file_name_clean ? String(f.file_name_clean) : ('用例#' + (f && f.id ? f.id : ''));
        return apiClient
          .listCaseItems(f.id)
          .then(function(items) { return buildCaseLibraryExcelBlob(items || [], baseName); })
          .then(function(blob) {
            var fileName = sanitizeDownloadName(baseName, '.xlsx');
            if (zip) {
              zip.file(fileName, blob);
            } else {
              downloadBlob(fileName, blob);
            }
            success += 1;
          })
          .catch(function(err) {
            fail += 1;
            console.error(err);
          });
      });
    });
    chain
      .then(function() {
        if (zip) {
          if (!success) throw new Error('全部导出失败');
          return zip.generateAsync({ type: 'blob' }).then(function(blob) {
            downloadBlob('用例批量导出_excel.zip', blob);
          });
        }
        return null;
      })
      .then(function() {
        setStatus(dom.editDrawerStatus, '导出完成：成功 ' + success + ' 份，失败 ' + fail + ' 份', fail ? 'warn' : 'ok');
      })
      .catch(function(err) {
        setStatus(dom.editDrawerStatus, '导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      })
      .finally(function() {
        if (dom.editDrawerExportExcelBtn) dom.editDrawerExportExcelBtn.disabled = false;
      });
  }

  function handleEditDrawerProjectChange() {
    var projectId = normalizeId(dom.editDrawerProjectSelect ? dom.editDrawerProjectSelect.value : '');
    state.editDrawer.projectId = projectId;
    state.editDrawer.versionId = null;
    state.editDrawer.files = [];
    state.editDrawer.selection = new Set();
    if (dom.editDrawerVersionSelect) {
      dom.editDrawerVersionSelect.disabled = true;
      dom.editDrawerVersionSelect.innerHTML = '<option value=\"\">全部版本</option>';
      dom.editDrawerVersionSelect.value = '';
    }
    if (dom.editDrawerExportXmindBtn) dom.editDrawerExportXmindBtn.disabled = true;
    if (dom.editDrawerExportExcelBtn) dom.editDrawerExportExcelBtn.disabled = true;
    renderEditDrawerList();
    if (!projectId) {
      setStatus(dom.editDrawerStatus, '请先选择项目', 'warn');
      if (dom.editDrawerListBody) {
        dom.editDrawerListBody.innerHTML = '<tr><td colspan=\"10\"><p class=\"hint\">请选择项目后自动刷新。</p></td></tr>';
      }
      syncEditDrawerControls();
      persistEditDrawerState({
        drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')),
        force_clear: true,
      });
      return;
    }
    persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
    loadEditDrawerFiles();
  }

  function getEditDrawerVisibleFiles() {
    var list = Array.isArray(state.editDrawer.files) ? state.editDrawer.files : [];
    if (!state.editDrawer.versionId) return list;
    return list.filter(function(f) { return String(f && f.version_id || '') === String(state.editDrawer.versionId || ''); });
  }

  function syncEditDrawerControls() {
    var list = getEditDrawerVisibleFiles();
    var selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
    state.editDrawer.selection = selection;
    var canDelete = isAdminUser();

    if (dom.editDrawerDeleteBtn) {
      dom.editDrawerDeleteBtn.disabled = !canDelete || Boolean(state.editDrawer.loading) || selection.size === 0;
    }
    if (dom.editDrawerExportXmindBtn) {
      dom.editDrawerExportXmindBtn.disabled = Boolean(state.editDrawer.loading) || selection.size === 0;
    }
    if (dom.editDrawerExportExcelBtn) {
      dom.editDrawerExportExcelBtn.disabled = Boolean(state.editDrawer.loading) || selection.size === 0;
    }
    if (dom.editDrawerSelectAll) {
      if (!list.length) {
        dom.editDrawerSelectAll.checked = false;
        dom.editDrawerSelectAll.indeterminate = false;
      } else {
        var total = list.length;
        var selected = selection.size;
        dom.editDrawerSelectAll.checked = selected === total;
        dom.editDrawerSelectAll.indeterminate = selected > 0 && selected < total;
      }
      dom.editDrawerSelectAll.disabled = Boolean(state.editDrawer.loading) || !list.length;
    }
  }

  function setEditDrawerSelectionAll(checked) {
    var list = getEditDrawerVisibleFiles();
    state.editDrawer.selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
    state.editDrawer.selection.clear();
    if (checked) {
      list.forEach(function(f) {
        if (!f || f.id === null || f.id === undefined) return;
        state.editDrawer.selection.add(String(f.id));
      });
    }
    renderEditDrawerList();
    syncEditDrawerControls();
    persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
  }

  function renderEditDrawerList() {
    if (!dom.editDrawerListBody) return;
    var list = getEditDrawerVisibleFiles();
    if (!list.length) {
      var hint = state.editDrawer.versionId ? '该版本暂无用例文件' : '暂无用例文件';
      dom.editDrawerListBody.innerHTML = '<tr><td colspan=\"10\"><p class=\"hint\">' + escapeHtml(hint) + '</p></td></tr>';
      syncEditDrawerControls();
      return;
    }
    var canDelete = isAdminUser();
    dom.editDrawerListBody.innerHTML = list.map(function(f) {
      // 兼容：列表项应自带 project_id/version_id；若 state 发生波动（例如刷新恢复过程中），优先使用行数据保证展示正确。
      var rowProjectId = f && (f.project_id || f.project_id === 0) ? f.project_id : state.editDrawer.projectId;
      var projectName = state.projectNameById[rowProjectId] || ('项目#' + rowProjectId);
      var versionName = getVersionName(rowProjectId, f && f.version_id ? f.version_id : null);
      var importerName = f && f.importer_name ? f.importer_name : '--';
      var importedAt = formatTime(f && f.imported_at);
      var updaterName = f && f.last_updated_by_name ? f.last_updated_by_name : (importerName || '--');
      var updatedAt = formatTime(f && f.updated_at);
      var itemCount = (f && (f.item_count || f.item_count === 0)) ? String(f.item_count) : '--';
      var fileId = f && f.id !== null && f.id !== undefined ? String(f.id) : '';
      var checked = Boolean(fileId && state.editDrawer.selection && state.editDrawer.selection.has(fileId));
      var selectCell = '<td><input type=\"checkbox\" data-case-lib-edit-select=\"' + escapeHtml(fileId) + '\"' + (checked ? ' checked' : '') + ' /></td>';
      return (
        '<tr>' +
          selectCell +
          '<td>' + escapeHtml(projectName) + '</td>' +
          '<td>' + escapeHtml(versionName) + '</td>' +
          '<td>' + escapeHtml(f && f.file_name_clean ? f.file_name_clean : ('文件#' + (f && f.id ? f.id : ''))) + '</td>' +
          '<td>' + escapeHtml(itemCount) + '</td>' +
          '<td>' + escapeHtml(importerName) + '</td>' +
          '<td>' + escapeHtml(importedAt) + '</td>' +
          '<td>' + escapeHtml(updaterName) + '</td>' +
          '<td>' + escapeHtml(updatedAt) + '</td>' +
          '<td><button class=\"secondary\" type=\"button\" data-case-lib-edit=\"' + escapeHtml(f && f.id ? f.id : '') + '\">编辑</button></td>' +
        '</tr>'
      );
    }).join('');
    syncEditDrawerControls();
  }

  function deleteSelectedCaseFiles() {
    if (state.editDrawer.loading) return;
    if (!isAdminUser()) {
      setStatus(dom.editDrawerStatus, '仅管理员可删除', 'warn');
      return;
    }
    var selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
    state.editDrawer.selection = selection;
    if (!selection.size) {
      setStatus(dom.editDrawerStatus, '请先勾选要删除的用例文件', 'warn');
      return;
    }
    if (!apiClient || typeof apiClient.deleteCaseFile !== 'function') {
      setStatus(dom.editDrawerStatus, '后端删除接口未就绪', 'err');
      return;
    }
    var ids = Array.from(selection);
    var list = Array.isArray(state.editDrawer.files) ? state.editDrawer.files : [];
    var items = ids.map(function(id) {
      var found = list.find(function(f) { return f && String(f.id) === String(id); });
      var name = found && found.file_name_clean ? String(found.file_name_clean) : ('文件#' + id);
      var count = found && (found.item_count || found.item_count === 0) ? Number(found.item_count) : NaN;
      var countText = (isFinite(count) && count >= 0) ? (String(Math.floor(count)) + '条') : '?条';
      return { name: name, countText: countText };
    });
    var pairs = (items || []).map(function(it) {
      if (!it) return '';
      return String(it.name || '用例') + '，' + String(it.countText || '?条');
    }).filter(Boolean);
    var head = pairs.slice(0, 6).join('、');
    var suffix = pairs.length > 6 ? (' 等' + pairs.length + '份') : '';
    var ok = window.confirm('是否确认删除用例：' + head + suffix + '？');
    if (!ok) return;

    state.editDrawer.loading = true;
    syncEditDrawerControls();
    setStatus(dom.editDrawerStatus, '删除中...', '');
    var success = 0;
    var fail = 0;
    var deletedIds = [];
    var chain = Promise.resolve();
    ids.forEach(function(id) {
      chain = chain.then(function() {
        return apiClient
          .deleteCaseFile(id)
          .then(function() {
            success += 1;
            deletedIds.push(String(id));
          })
          .catch(function(err) {
            fail += 1;
            var msg = err && err.message ? err.message : '删除失败';
            setStatus(dom.editDrawerStatus, '删除失败：' + msg, 'err');
          });
      });
    });
    chain.then(function() {
      var msg = '删除完成：成功 ' + success + ' 份，失败 ' + fail + ' 份';
      setStatus(dom.editDrawerStatus, msg, fail ? 'warn' : 'ok');
    }).finally(function() {
      state.editDrawer.loading = false;
      state.editDrawer.selection = new Set();
      if (deletedIds.length) {
        var deletedSet = new Set(deletedIds);
        state.editDrawer.files = (state.editDrawer.files || []).filter(function(f) {
          if (!f || f.id === null || f.id === undefined) return true;
          return !deletedSet.has(String(f.id));
        });
        // 若当前编辑视图正在编辑被删除的用例文件，需立即清空视图，避免误以为仍可编辑。
        var editorFile = state.editor && state.editor.caseFile ? state.editor.caseFile : null;
        if (editorFile && editorFile.id !== null && editorFile.id !== undefined) {
          if (deletedSet.has(String(editorFile.id))) {
            state.editor.caseFile = null;
            state.editor.items = [];
            state.editor.searchText = '';
            state.editor.pageIndex = 0;
            state.editor.selection = new Set();
            state.editor.remarkOpen = new Set();
            showEditorCard(false);
            clearEditorPersistedState();
            setStatus(dom.editStatus, '当前编辑用例已被删除', 'warn');
          }
        }
      }
      renderEditDrawerList();
      syncEditDrawerControls();
    });
  }

  function loadEditDrawerFiles() {
    var projectId = normalizeId(dom.editDrawerProjectSelect ? dom.editDrawerProjectSelect.value : '');
    state.editDrawer.projectId = projectId;
    state.editDrawer.versionId = normalizeId(dom.editDrawerVersionSelect ? dom.editDrawerVersionSelect.value : '');
    state.editDrawer.files = [];
    state.editDrawer.selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
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
        if (dom.editDrawerVersionSelect) {
          syncVersionOptions(dom.editDrawerVersionSelect, projectId, '全部版本');
          dom.editDrawerVersionSelect.disabled = false;
          if (state.editDrawer.versionId) {
            dom.editDrawerVersionSelect.value = String(state.editDrawer.versionId);
          } else {
            dom.editDrawerVersionSelect.value = '';
          }
        }
        setStatus(dom.editDrawerStatus, '已加载 ' + files.length + ' 份用例文件', files.length ? 'ok' : 'warn');
        // 若列表更新，清理掉不存在/不可见的勾选项，避免按钮状态与实际不一致。
        var visibleIds = {};
        getEditDrawerVisibleFiles().forEach(function(f) {
          if (!f || f.id === null || f.id === undefined) return;
          visibleIds[String(f.id)] = true;
        });
        var nextSel = new Set();
        (state.editDrawer.selection || new Set()).forEach(function(id) {
          if (visibleIds[String(id)]) nextSel.add(String(id));
        });
        state.editDrawer.selection = nextSel;
        renderEditDrawerList();
      })
      .catch(function(err) {
        setStatus(dom.editDrawerStatus, err && err.message ? err.message : '加载失败', 'err');
      })
      .finally(function() {
        state.editDrawer.loading = false;
        syncEditDrawerControls();
        persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
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
      persistEditorSelection(caseFile);
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

  function getXmindBuilder() {
    var api = window.app && window.app.xmindCoreApi ? window.app.xmindCoreApi : null;
    if (api && typeof api.buildXmindPackageFromCases === 'function') return api.buildXmindPackageFromCases;
    var coreApi = window.app && window.app.xmindCore ? window.app.xmindCore : null;
    if (coreApi && typeof coreApi.buildXmindPackageFromCases === 'function') return coreApi.buildXmindPackageFromCases;
    return null;
  }

  function buildCaseLibraryExcelBlob(items, sheetName) {
    var JSZipCtor = typeof JSZip !== 'undefined' ? JSZip : (window.JSZip ? window.JSZip : null);
    if (!JSZipCtor) return Promise.reject(new Error('缺少 JSZip 依赖，无法导出 Excel'));
    var header = ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果'];
    var rows = [header].concat((items || []).map(function(it) {
      var item = it || {};
      return [
        item.module || '',
        item.title || '',
        item.priority || '',
        item.precondition || '',
        item.steps || '',
        item.expected || '',
      ];
    }));

    var letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    var sheetRowsXml = rows.map(function(row, rIdx) {
      var r = rIdx + 1;
      var cells = letters.map(function(col, cIdx) {
        var ref = col + r;
        var value = row && row.length > cIdx ? row[cIdx] : '';
        var text = escapeXmlTextPreserve(value);
        return (
          '<c r=\"' + ref + '\" t=\"inlineStr\">' +
            '<is><t xml:space=\"preserve\">' + text + '</t></is>' +
          '</c>'
        );
      }).join('');
      return '<row r=\"' + r + '\">' + cells + '</row>';
    }).join('');

    var worksheetXml =
      '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>' +
      '<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" ' +
        'xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">' +
        '<sheetData>' + sheetRowsXml + '</sheetData>' +
      '</worksheet>';

    var workbookXml =
      '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>' +
      '<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" ' +
        'xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">' +
        '<sheets>' +
          '<sheet name=\"' + escapeXmlText(sheetName || '用例') + '\" sheetId=\"1\" r:id=\"rId1\"/>' +
        '</sheets>' +
      '</workbook>';

    var contentTypesXml =
      '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>' +
      '<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">' +
        '<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>' +
        '<Default Extension=\"xml\" ContentType=\"application/xml\"/>' +
        '<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>' +
        '<Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>' +
      '</Types>';

    var relsXml =
      '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>' +
      '<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">' +
        '<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>' +
      '</Relationships>';

    var workbookRelsXml =
      '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>' +
      '<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">' +
        '<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/>' +
      '</Relationships>';

    var zip = new JSZipCtor();
    zip.file('[Content_Types].xml', contentTypesXml);
    zip.folder('_rels').file('.rels', relsXml);
    var xl = zip.folder('xl');
    xl.file('workbook.xml', workbookXml);
    xl.folder('_rels').file('workbook.xml.rels', workbookRelsXml);
    xl.folder('worksheets').file('sheet1.xml', worksheetXml);
    return zip.generateAsync({ type: 'blob', compression: 'STORE' });
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
          '<td><button type=\"button\" class=\"' + remarkBtnClass.join(' ') + '\" data-case-lib-remark-toggle data-index=\"' + idx + '\">' + (hasRemark ? '备注已填' : '备注') + '</button></td>' +
          '<td class=\"case-op-col\">' +
            '<div class=\"case-ops\">' +
              '<button type=\"button\" class=\"case-op remove\" title=\"删除当前用例\" data-case-lib-remove data-index=\"' + idx + '\">−</button>' +
              '<button type=\"button\" class=\"case-op add\" title=\"在下方插入用例\" data-case-lib-insert data-index=\"' + idx + '\">＋</button>' +
            '</div>' +
          '</td>' +
        '</tr>' +
        '<tr class=\"remark-row ' + (isRemarkOpen ? 'visible' : '') + '\">' +
          '<td colspan=\"10\">' +
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
      : '<tr><td colspan=\"10\">' + (state.editor.items.length ? '当前页暂无用例' : '未解析到有效用例') + '</td></tr>';
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

  function restoreEditorFromPersistedState() {
    if (!isAuthReady()) return Promise.resolve(false);
    if (state.editor.restoring === true) return Promise.resolve(false);
    var persisted = readEditorPersistedState();
    if (!persisted) return Promise.resolve(false);
    var userId = getCurrentUserId();
    if (!userId || String(persisted.user_id || '') !== String(userId)) return Promise.resolve(false);
    var projectId = normalizeId(persisted.project_id);
    var caseFileId = Number(persisted.case_file_id);
    if (!projectId || isNaN(caseFileId) || caseFileId <= 0) return Promise.resolve(false);

    state.editor.restoring = true;
    setStatus(dom.editStatus, '', '');
    return ensureProjectsReady()
      .then(function() { return loadVersions(projectId); })
      .then(function() { return apiClient.listCaseFiles(projectId); })
      .then(function(files) {
        var list = Array.isArray(files) ? files : [];
        var found = list.find(function(f) { return f && Number(f.id) === caseFileId; }) || null;
        if (!found) {
          clearEditorPersistedState();
          state.editor.caseFile = null;
          state.editor.items = [];
          showEditorCard(false);
          return false;
        }
        return apiClient.listCaseItems(caseFileId).then(function(items) {
          state.editor.caseFile = found;
          state.editor.items = Array.isArray(items) ? items : [];
          if (dom.editSearchInput) dom.editSearchInput.value = '';
          state.editor.searchText = '';
          state.editor.pageIndex = 0;
          state.editor.selection = new Set();
          state.editor.remarkOpen = new Set();
          renderEditorCard();
          return true;
        });
      })
      .catch(function(err) {
        console.error(err);
        // 可能是权限变化/项目不可见，避免卡死：清理后不再恢复。
        clearEditorPersistedState();
        return false;
      })
      .finally(function() {
        state.editor.restoring = false;
      });
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
    state.selectDrawer.loadSeq = 0;
    setStatus(dom.selectStatus, '', '');
    syncProjectOptions(dom.selectProjectSelect, '请选择项目');
    if (dom.selectProjectSelect) dom.selectProjectSelect.value = '';
    if (dom.selectVersionSelect) {
      dom.selectVersionSelect.disabled = true;
      dom.selectVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
      dom.selectVersionSelect.value = '';
    }
    if (dom.selectListBody) {
      dom.selectListBody.innerHTML = '<tr><td colspan=\"7\"><p class=\"hint\">请选择项目后自动刷新。</p></td></tr>';
    }
  }

  function handleSelectProjectChange() {
    var projectId = normalizeId(dom.selectProjectSelect ? dom.selectProjectSelect.value : '');
    state.selectDrawer.projectId = projectId;
    state.selectDrawer.versionId = null;
    state.selectDrawer.files = [];
    if (!dom.selectVersionSelect) return;
    dom.selectVersionSelect.disabled = true;
    dom.selectVersionSelect.innerHTML = '<option value=\"\">请选择版本</option>';
    if (!projectId) return;
    state.selectDrawer.loading = true;
    state.selectDrawer.loadSeq = Number(state.selectDrawer.loadSeq || 0) + 1;
    var seq = state.selectDrawer.loadSeq;
    setStatus(dom.selectStatus, '加载用例库...', '');
    renderSelectDrawerList();
    Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId)])
      .then(function(res) {
        if (seq !== state.selectDrawer.loadSeq) return;
        var files = Array.isArray(res && res[0]) ? res[0] : [];
        state.selectDrawer.files = files;
        syncVersionOptions(dom.selectVersionSelect, projectId, '请选择版本');
        dom.selectVersionSelect.disabled = false;
        setStatus(dom.selectStatus, '已加载 ' + files.length + ' 份用例文件', files.length ? 'ok' : 'warn');
      })
      .catch(function(err) {
        if (seq !== state.selectDrawer.loadSeq) return;
        state.selectDrawer.files = [];
        setStatus(dom.selectStatus, err && err.message ? err.message : '加载失败', 'err');
      })
      .finally(function() {
        if (seq !== state.selectDrawer.loadSeq) return;
        state.selectDrawer.loading = false;
        renderSelectDrawerList();
      });
  }

  function handleSelectVersionChange() {
    state.selectDrawer.versionId = normalizeId(dom.selectVersionSelect ? dom.selectVersionSelect.value : '');
    renderSelectDrawerList();
  }

  function renderSelectDrawerList() {
    if (!dom.selectListBody) return;
    if (!state.selectDrawer.projectId) {
      dom.selectListBody.innerHTML = '<tr><td colspan=\"7\"><p class=\"hint\">请选择项目后自动刷新。</p></td></tr>';
      return;
    }
    if (state.selectDrawer.loading) {
      dom.selectListBody.innerHTML = '<tr><td colspan=\"7\"><p class=\"hint\">加载中...</p></td></tr>';
      return;
    }
    var list = Array.isArray(state.selectDrawer.files) ? state.selectDrawer.files : [];
    if (state.selectDrawer.versionId) {
      list = list.filter(function(f) { return String(f && f.version_id || '') === String(state.selectDrawer.versionId || ''); });
    }
    if (!list.length) {
      dom.selectListBody.innerHTML = '<tr><td colspan=\"7\"><p class=\"hint\">暂无用例文件</p></td></tr>';
      return;
    }
    dom.selectListBody.innerHTML = list.map(function(f) {
      var rowProjectId = f && (f.project_id || f.project_id === 0) ? f.project_id : state.selectDrawer.projectId;
      var projectName = state.projectNameById[rowProjectId] || ('项目#' + rowProjectId);
      var versionName = getVersionName(rowProjectId, f && f.version_id ? f.version_id : null);
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
    state.selectDrawer.loadSeq = Number(state.selectDrawer.loadSeq || 0) + 1;
    var seq = state.selectDrawer.loadSeq;
    Promise.all([apiClient.listCaseFiles(projectId), loadVersions(projectId)])
      .then(function(res) {
        if (seq !== state.selectDrawer.loadSeq) return;
        var files = Array.isArray(res && res[0]) ? res[0] : [];
        state.selectDrawer.files = files;
        setStatus(dom.selectStatus, '已加载 ' + files.length + ' 份用例文件', files.length ? 'ok' : 'warn');
      })
      .catch(function(err) {
        if (seq !== state.selectDrawer.loadSeq) return;
        state.selectDrawer.files = [];
        setStatus(dom.selectStatus, err && err.message ? err.message : '加载失败', 'err');
      })
      .finally(function() {
        if (seq !== state.selectDrawer.loadSeq) return;
        state.selectDrawer.loading = false;
        renderSelectDrawerList();
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
    if (dom.importDiffOverwriteBtn) {
      dom.importDiffOverwriteBtn.addEventListener('click', confirmOverwriteImportFromDiff);
    }

    if (dom.editDrawerConfirmBtn) {
      dom.editDrawerConfirmBtn.addEventListener('click', loadEditDrawerFiles);
    }
    if (dom.editDrawerProjectSelect) {
      dom.editDrawerProjectSelect.addEventListener('change', handleEditDrawerProjectChange);
    }
    if (dom.editDrawerVersionSelect) {
      dom.editDrawerVersionSelect.addEventListener('change', handleEditDrawerVersionChange);
    }
    if (dom.editDrawerDeleteBtn) {
      dom.editDrawerDeleteBtn.addEventListener('click', deleteSelectedCaseFiles);
    }
    if (dom.editDrawerSelectAll) {
      dom.editDrawerSelectAll.addEventListener('change', function() {
        setEditDrawerSelectionAll(Boolean(dom.editDrawerSelectAll && dom.editDrawerSelectAll.checked));
      });
    }
    if (dom.editDrawerListBody) {
      dom.editDrawerListBody.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        if (!t || !t.getAttribute) return;
        var id = t.getAttribute('data-case-lib-edit-select');
        if (!id) return;
        state.editDrawer.selection = state.editDrawer.selection instanceof Set ? state.editDrawer.selection : new Set();
        if (t.checked) state.editDrawer.selection.add(String(id));
        else state.editDrawer.selection.delete(String(id));
        syncEditDrawerControls();
        persistEditDrawerState({ drawer_open: Boolean(editDrawerInstance && editDrawerInstance.element && editDrawerInstance.element.classList && editDrawerInstance.element.classList.contains('open')) });
      });
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
    if (dom.editDrawerExportXmindBtn) {
      dom.editDrawerExportXmindBtn.addEventListener('click', exportEditDrawerSelectionToXmind);
    }
    if (dom.editDrawerExportExcelBtn) {
      dom.editDrawerExportExcelBtn.addEventListener('click', exportEditDrawerSelectionToExcel);
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
      ensureProjectsReady().then(function() {
        return restoreEditorFromPersistedState();
      }).then(function() {
        var persisted = readEditDrawerPersistedState();
        var userId = getCurrentUserId();
        var shouldOpen = Boolean(persisted && userId && String(persisted.user_id || '') === String(userId) && persisted.drawer_open === true);
        if (shouldOpen && editDrawerInstance && typeof editDrawerInstance.open === 'function') {
          editDrawerInstance.open();
        }
      });
    });
    window.addEventListener('app-auth-ready', function() {
      var globalState = window.app && window.app.state ? window.app.state : {};
      var tabName = globalState && globalState.activeTab ? globalState.activeTab : '';
      if (tabName === 'case-library') {
        ensureProjectsReady().then(function() {
          return restoreEditorFromPersistedState();
        }).then(function() {
          var persisted = readEditDrawerPersistedState();
          var userId = getCurrentUserId();
          var shouldOpen = Boolean(persisted && userId && String(persisted.user_id || '') === String(userId) && persisted.drawer_open === true);
          if (shouldOpen && editDrawerInstance && typeof editDrawerInstance.open === 'function') {
            editDrawerInstance.open();
          }
        });
      }
    });
  }

  function init() {
    if (!dom.root) return;
    importDrawerInstance = ensureDrawer('caseLibraryImportDrawer', ['openCaseLibraryImportDrawerBtn'], function() {
      ensureProjectsReady().then(resetImportDrawer);
    });
    importDiffDrawerInstance = ensureDrawer('caseLibraryImportDiffDrawer', [], function() {
      // noop
    });
    editDrawerInstance = ensureDrawer(
      'caseLibraryEditDrawer',
      ['openCaseLibraryEditDrawerBtn'],
      function() {
        var prevPersisted = readEditDrawerPersistedState();
        ensureProjectsReady().then(function() {
          resetEditDrawer();
          return restoreEditDrawerFromPersistedState()
            .then(function(restored) {
              if (restored) {
                persistEditDrawerState({ drawer_open: true });
                return;
              }
              // 恢复失败时尽量不覆盖旧选择，仅更新 open 状态。
              var userId = getCurrentUserId();
              if (
                prevPersisted &&
                userId &&
                String(prevPersisted.user_id || '') === String(userId)
              ) {
                prevPersisted.drawer_open = true;
                writeEditDrawerPersistedState(prevPersisted);
              } else {
                persistEditDrawerState({ drawer_open: true });
              }
            });
        });
      },
      function() {
        persistEditDrawerState({ drawer_open: false });
      }
    );
    selectDrawerInstance = ensureDrawer('caseLibrarySelectExecDrawer', ['openCaseLibrarySelectExecDrawerBtn'], function() {
      ensureProjectsReady().then(resetSelectDrawer);
    });

    bindEvents();
    bindTabActivation();
    bindProjectsUpdated();

    // 若刷新后停留在用例库页，补一次加载。
    var visible = document.querySelector('section[data-tab-section=\"case-library\"]:not(.hidden)');
    if (visible && isAuthReady()) {
      ensureProjectsReady().then(function() {
        return restoreEditorFromPersistedState();
      }).then(function() {
        var persisted = readEditDrawerPersistedState();
        var userId = getCurrentUserId();
        var shouldOpen = Boolean(persisted && userId && String(persisted.user_id || '') === String(userId) && persisted.drawer_open === true);
        if (shouldOpen && editDrawerInstance && typeof editDrawerInstance.open === 'function') {
          editDrawerInstance.open();
        }
      });
    }
    window.app = window.app || {};
    window.app.caseLibraryBound = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
