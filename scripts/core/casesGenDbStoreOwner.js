(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.casesGenDbStoreOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var runtime = opts.runtime || {};
    var state = opts.state;
    var utils = opts.utils;
    var caseGenStatus = opts.caseGenStatus;
    var apiClient = opts.apiClient;
    var caseGenStoreActionSelect = opts.caseGenStoreActionSelect;
    var caseGenDbStoreDrawerTitle = opts.caseGenDbStoreDrawerTitle;
    var caseGenDbStoreEntryNameRow = opts.caseGenDbStoreEntryNameRow;
    var caseGenDbStoreEntryNameInput = opts.caseGenDbStoreEntryNameInput;
    var caseGenDbStoreProjectSelect = opts.caseGenDbStoreProjectSelect;
    var caseGenDbStoreVersionSelect = opts.caseGenDbStoreVersionSelect;
    var caseGenDbStoreCaseFileRow = opts.caseGenDbStoreCaseFileRow;
    var caseGenDbStoreCaseFileSelect = opts.caseGenDbStoreCaseFileSelect;
    var caseGenDbStoreConfirmBtn = opts.caseGenDbStoreConfirmBtn;
    var caseGenDbStoreStatus = opts.caseGenDbStoreStatus;
    var setStatus = opts.setStatus;
    var ensureRequirementLabel = opts.ensureRequirementLabel;
    var getRequirementLabel = opts.getRequirementLabel;
    var setTempExecActive = opts.setTempExecActive;
    var switchTab = opts.switchTab;
    var escapeHtml = opts.escapeHtml;
    var caseGenDbStoreBound = opts.caseGenDbStoreBound;
    var setCaseGenStoreMode = typeof opts.setCaseGenStoreMode === 'function' ? opts.setCaseGenStoreMode : noop;
    var hasSelectedGeneratedCases = typeof opts.hasSelectedGeneratedCases === 'function' ? opts.hasSelectedGeneratedCases : noop;
    var hasGeneratedCases = typeof opts.hasGeneratedCases === 'function' ? opts.hasGeneratedCases : noop;
    var openCaseViewForSelectionHint = typeof opts.openCaseViewForSelectionHint === 'function' ? opts.openCaseViewForSelectionHint : noop;
    var listCaseGenModulesMissingSelectionOrGeneration = typeof opts.listCaseGenModulesMissingSelectionOrGeneration === 'function' ? opts.listCaseGenModulesMissingSelectionOrGeneration : noop;
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function' ? opts.openConfirmDrawer : noop;
    var collectSelectedCaseEntries = typeof opts.collectSelectedCaseEntries === 'function' ? opts.collectSelectedCaseEntries : noop;

    function ensureDbStoreState() {
      if (!state.caseGenDbStore || typeof state.caseGenDbStore !== 'object') {
        state.caseGenDbStore = {
          mode: '',
          newAction: '',
          explicitItems: [],
          explicitMissingModules: [],
          explicitSource: '',
          explicitWorkspaceId: '',
          preferredProjectId: '',
          preferredVersionId: '',
          preferredCaseFileId: '',
          loading: false,
          confirming: false,
          projects: [],
          versionsByProject: {},
          caseFilesByProject: {},
          projectId: '',
          versionId: '',
          caseFileId: '',
          entryName: '',
        };
      }
      return state.caseGenDbStore;
    }

    function clearExplicitDbStorePayload(st) {
      var storeState = st || ensureDbStoreState();
      storeState.explicitItems = [];
      storeState.explicitMissingModules = [];
      storeState.explicitSource = '';
      storeState.explicitWorkspaceId = '';
      storeState.preferredProjectId = '';
      storeState.preferredVersionId = '';
      storeState.preferredCaseFileId = '';
    }

    function normalizeExplicitDbStoreItems(items) {
      return (Array.isArray(items) ? items : []).map(function(item) {
        return buildCaseItemPayloadFromGenerated(item, item && item.module ? item.module : '');
      }).filter(Boolean);
    }

    function applyExplicitDbStorePayload(st, options) {
      var storeState = st || ensureDbStoreState();
      var opts = options || {};
      clearExplicitDbStorePayload(storeState);
      storeState.explicitItems = normalizeExplicitDbStoreItems(opts.items);
      storeState.explicitMissingModules = Array.isArray(opts.missingModules)
        ? opts.missingModules.map(function(item) { return String(item || '').trim(); }).filter(Boolean)
        : [];
      storeState.explicitSource = opts.source ? String(opts.source || '') : '';
      storeState.explicitWorkspaceId = opts.workspaceId ? String(opts.workspaceId || '') : '';
      storeState.preferredProjectId = opts.projectId === null || opts.projectId === undefined ? '' : String(opts.projectId || '');
      storeState.preferredVersionId = opts.versionId === null || opts.versionId === undefined ? '' : String(opts.versionId || '');
      storeState.preferredCaseFileId = opts.caseFileId === null || opts.caseFileId === undefined ? '' : String(opts.caseFileId || '');
      if (opts.newAction) storeState.newAction = String(opts.newAction || '');
    }

    function normalizeCaseGenDbStoreEntryName(name) {
      var raw = '';
      if (typeof name === 'string') {
        raw = name;
      } else if (name && typeof name.toString === 'function') {
        raw = name.toString();
      }
      var trimmed = raw.trim();
      if (!trimmed) return '';
      var withoutExt = trimmed.replace(/\.[^.]+$/, '');
      var stripped = withoutExt || trimmed;
      var pattern = /(_result)?_\d{8}(?:_?\d{6})?$/i;
      while (pattern.test(stripped)) {
        stripped = stripped.replace(pattern, '');
      }
      var candidate = stripped || withoutExt || trimmed;
      return candidate.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
    }

    function getCaseGenDbStoreDefaultEntryName() {
      var currentLabel = '';
      try {
        currentLabel = getRequirementLabel(false) || '';
      } catch (err) {
        currentLabel = '';
      }
      return normalizeCaseGenDbStoreEntryName(currentLabel) || '当前需求';
    }

    function renderCaseGenDbStoreEntryName() {
      var st = ensureDbStoreState();
      if (!caseGenDbStoreEntryNameInput) return;
      caseGenDbStoreEntryNameInput.value = st.entryName || '';
    }

    function buildCaseGenDbStoreFileName(entryName) {
      var normalized = normalizeCaseGenDbStoreEntryName(entryName);
      return normalized ? (normalized + '.xmind') : '';
    }

    function hasExplicitDbStoreItems() {
      var st = ensureDbStoreState();
      return Array.isArray(st.explicitItems) && st.explicitItems.length > 0;
    }

    function collectPendingDbStoreItems() {
      if (hasExplicitDbStoreItems()) {
        return normalizeExplicitDbStoreItems(ensureDbStoreState().explicitItems);
      }
      return collectDbStoreSelectedItems();
    }

    function listPendingDbStoreMissingModules() {
      var st = ensureDbStoreState();
      if (hasExplicitDbStoreItems()) {
        return Array.isArray(st.explicitMissingModules) ? st.explicitMissingModules.slice() : [];
      }
      return listCaseGenModulesMissingSelectionOrGeneration();
    }

    function isDbStoreReady() {
      return Boolean(
        apiClient &&
        typeof apiClient.listProjects === 'function' &&
        typeof apiClient.listProjectVersions === 'function' &&
        typeof apiClient.listCaseFiles === 'function' &&
        typeof apiClient.importCaseFile === 'function'
      );
    }

    function ensureCaseGenDbStoreDrawer() {
      if (runtime.caseGenDbStoreDrawer) return runtime.caseGenDbStoreDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      runtime.caseGenDbStoreDrawer = window.app.drawer.createDrawer({
        drawerId: 'caseGenDbStoreDrawer',
        closeButtons: ['closeCaseGenDbStoreDrawerBtn'],
        onClose: function() {
          var st = ensureDbStoreState();
          st.loading = false;
          st.confirming = false;
          st.mode = '';
          st.projectId = '';
          st.versionId = '';
          st.caseFileId = '';
          st.entryName = '';
          clearExplicitDbStorePayload(st);
          renderCaseGenDbStoreEntryName();
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '', '');
          syncCaseGenDbStoreControls();
        },
      });
      return runtime.caseGenDbStoreDrawer;
    }

    function clearCaseGenDbStoreNewActionError() {
      if (caseGenStoreActionSelect && caseGenStoreActionSelect.classList) {
        caseGenStoreActionSelect.classList.remove('input-invalid');
      }
    }

    function markCaseGenDbStoreNewActionError() {
      if (caseGenStoreActionSelect && caseGenStoreActionSelect.classList) {
        caseGenStoreActionSelect.classList.add('input-invalid');
      }
    }

    function setCaseGenDbStoreNewAction(action) {
      var st = ensureDbStoreState();
      st.newAction = String(action || '');
      clearCaseGenDbStoreNewActionError();
    }

    function setPendingCaseGenDbStoreAction(action) {
      runtime.pendingCaseGenDbStoreAction = action ? String(action) : '';
    }

    function consumePendingCaseGenDbStoreAction() {
      var next = runtime.pendingCaseGenDbStoreAction;
      runtime.pendingCaseGenDbStoreAction = '';
      return next;
    }

    function buildCaseItemPayloadFromGenerated(item, fallbackModule) {
      if (!item) return null;
      var module = String(item.module || fallbackModule || '').trim();
      var title = String(item.title || '').trim();
      var expected = String(item.expected || '').trim();
      if (!module || !title || !expected) return null;
      var priority = item.priority ? String(item.priority).trim() : '';
      var pre = item.precondition !== undefined ? item.precondition : item.preconditions;
      var preText = pre === null || pre === undefined ? '' : String(pre);
      var stepsRaw = item.steps;
      var stepsText = '';
      if (Array.isArray(stepsRaw)) {
        stepsText = stepsRaw.map(function(s) { return String(s || '').trim(); }).filter(Boolean).join('\n');
      } else if (stepsRaw !== null && stepsRaw !== undefined) {
        stepsText = String(stepsRaw);
      }
      var remark = item.remark ? String(item.remark).trim() : '';
      return {
        module: module,
        title: title,
        expected: expected,
        priority: priority || null,
        precondition: preText.trim() ? preText.trim() : null,
        steps: stepsText.trim() ? stepsText.trim() : null,
        remark: remark || null,
      };
    }

    function collectDbStoreSelectedItems() {
      var selectedEntries = collectSelectedCaseEntries();
      var items = [];
      selectedEntries.forEach(function(entry) {
        var moduleTitle = entry && entry.moduleTitle ? String(entry.moduleTitle) : '';
        var cases = entry && Array.isArray(entry.cases) ? entry.cases : [];
        cases.forEach(function(it) {
          var payload = buildCaseItemPayloadFromGenerated(it, moduleTitle);
          if (payload) items.push(payload);
        });
      });
      return items;
    }

    function syncCaseGenDbStoreControls() {
      var st = ensureDbStoreState();
      var mode = st.mode || '';
      if (caseGenDbStoreEntryNameRow && caseGenDbStoreEntryNameRow.classList) {
        caseGenDbStoreEntryNameRow.classList.toggle('hidden', mode !== 'new');
      }
      if (caseGenDbStoreCaseFileRow && caseGenDbStoreCaseFileRow.classList) {
        caseGenDbStoreCaseFileRow.classList.toggle('hidden', mode !== 'append');
      }
      var pid = st.projectId || '';
      var vid = st.versionId || '';
      var fid = st.caseFileId || '';
      var busy = Boolean(st.loading || st.confirming);
      var entryName = normalizeCaseGenDbStoreEntryName(st.entryName || '');
      if (caseGenDbStoreEntryNameInput) {
        caseGenDbStoreEntryNameInput.disabled = Boolean(busy || mode !== 'new');
      }
      if (caseGenDbStoreVersionSelect) {
        caseGenDbStoreVersionSelect.disabled = Boolean(busy || !pid);
      }
      if (caseGenDbStoreCaseFileSelect) {
        caseGenDbStoreCaseFileSelect.disabled = Boolean(busy || mode !== 'append' || !pid || !vid);
      }
      if (caseGenDbStoreConfirmBtn) {
        var needCaseFile = mode === 'append';
        var needEntryName = mode === 'new';
        var can = Boolean(!busy && pid && vid && (!needCaseFile || fid) && (!needEntryName || entryName));
        caseGenDbStoreConfirmBtn.disabled = !can;
      }
    }

    function renderCaseGenDbStoreProjects() {
      var st = ensureDbStoreState();
      if (!caseGenDbStoreProjectSelect) return;
      var list = Array.isArray(st.projects) ? st.projects : [];
      caseGenDbStoreProjectSelect.innerHTML = ['<option value=\"\">请选择项目</option>']
        .concat(
          list.map(function(p) {
            var id = p && (p.id || p.id === 0) ? String(p.id) : '';
            var name = p && p.name ? String(p.name) : ('项目#' + id);
            return '<option value=\"' + escapeHtml(id) + '\">' + escapeHtml(name) + '</option>';
          })
        )
        .join('');
      caseGenDbStoreProjectSelect.value = st.projectId || '';
    }

    function renderCaseGenDbStoreVersions() {
      var st = ensureDbStoreState();
      if (!caseGenDbStoreVersionSelect) return;
      var pid = st.projectId || '';
      var list = pid && st.versionsByProject && st.versionsByProject[pid] ? st.versionsByProject[pid] : [];
      list = Array.isArray(list) ? list : [];
      var appUtils = window.app && window.app.utils ? window.app.utils : null;
      caseGenDbStoreVersionSelect.innerHTML = ['<option value=\"\">请选择版本</option>']
        .concat(
          list.map(function(v) {
            var id = v && (v.id || v.id === 0) ? String(v.id) : '';
            var name = v && v.name ? String(v.name) : ('版本#' + id);
            return '<option value=\"' + escapeHtml(id) + '\">' + escapeHtml(name) + '</option>';
          })
        )
        .join('');
      if (appUtils && typeof appUtils.buildAddVersionOption === 'function') {
        caseGenDbStoreVersionSelect.innerHTML += appUtils.buildAddVersionOption('＋ 新增版本');
      } else {
        caseGenDbStoreVersionSelect.innerHTML += '<option value="__add_version__">＋ 新增版本</option>';
      }
      caseGenDbStoreVersionSelect.value = st.versionId || '';
      caseGenDbStoreVersionSelect.disabled = Boolean(st.loading || !pid);
    }

    function renderCaseGenDbStoreCaseFiles() {
      var st = ensureDbStoreState();
      if (!caseGenDbStoreCaseFileSelect) return;
      var pid = st.projectId || '';
      var vid = st.versionId || '';
      var list = pid && st.caseFilesByProject && st.caseFilesByProject[pid] ? st.caseFilesByProject[pid] : [];
      list = Array.isArray(list) ? list : [];
      var filtered = vid
        ? list.filter(function(cf) { return cf && String(cf.version_id || '') === String(vid); })
        : [];
      filtered.sort(function(a, b) {
        var na = a && a.file_name_clean ? String(a.file_name_clean) : '';
        var nb = b && b.file_name_clean ? String(b.file_name_clean) : '';
        return na.localeCompare(nb, 'zh-Hans-CN');
      });
      caseGenDbStoreCaseFileSelect.innerHTML = ['<option value=\"\">请选择用例</option>']
        .concat(
          filtered.map(function(cf) {
            var id = cf && (cf.id || cf.id === 0) ? String(cf.id) : '';
            var name = cf && cf.file_name_clean ? String(cf.file_name_clean) : ('用例#' + id);
            return '<option value=\"' + escapeHtml(id) + '\">' + escapeHtml(name) + '</option>';
          })
        )
        .join('');
      caseGenDbStoreCaseFileSelect.value = st.caseFileId || '';
      caseGenDbStoreCaseFileSelect.disabled = Boolean(st.loading || !pid || !vid);
    }

    function loadCaseGenDbStoreProjects() {
      if (!isDbStoreReady()) return Promise.reject(new Error('后端未就绪'));
      var st = ensureDbStoreState();
      if (st.loading) return Promise.resolve([]);
      st.loading = true;
      syncCaseGenDbStoreControls();
      if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '加载项目中...', '');
      return apiClient
        .listProjects()
        .then(function(list) {
          var projects = Array.isArray(list) ? list : [];
          var utils = window.app && window.app.utils ? window.app.utils : {};
          var globalState = window.app && window.app.state ? window.app.state : {};
          if (utils && typeof utils.sortProjectsByUserSettings === 'function') {
            projects = utils.sortProjectsByUserSettings(projects, globalState);
          } else {
            projects.sort(function(a, b) {
              var na = a && a.name ? String(a.name) : '';
              var nb = b && b.name ? String(b.name) : '';
              return na.localeCompare(nb, 'zh-Hans-CN');
            });
          }
          st.projects = projects;
          renderCaseGenDbStoreProjects();
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '', '');
          return projects;
        })
        .catch(function(err) {
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '加载项目失败：' + (err && err.message ? err.message : '未知错误'), 'err');
          return [];
        })
        .finally(function() {
          st.loading = false;
          syncCaseGenDbStoreControls();
        });
    }

    function loadCaseGenDbStoreVersions(projectId) {
      if (!isDbStoreReady()) return Promise.reject(new Error('后端未就绪'));
      var st = ensureDbStoreState();
      var pid = String(projectId || '');
      if (!pid) return Promise.resolve([]);
      if (st.versionsByProject && Array.isArray(st.versionsByProject[pid])) {
        return Promise.resolve(st.versionsByProject[pid]);
      }
      st.loading = true;
      syncCaseGenDbStoreControls();
      if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '加载版本中...', '');
      return apiClient
        .listProjectVersions(pid)
        .then(function(list) {
          var versions = Array.isArray(list) ? list : [];
          versions.sort(function(a, b) {
            var na = a && a.name ? String(a.name) : '';
            var nb = b && b.name ? String(b.name) : '';
            return na.localeCompare(nb, 'zh-Hans-CN');
          });
          st.versionsByProject[pid] = versions;
          renderCaseGenDbStoreVersions();
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '', '');
          return versions;
        })
        .catch(function(err) {
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '加载版本失败：' + (err && err.message ? err.message : '未知错误'), 'err');
          return [];
        })
        .finally(function() {
          st.loading = false;
          syncCaseGenDbStoreControls();
        });
    }

    function loadCaseGenDbStoreCaseFiles(projectId) {
      if (!isDbStoreReady()) return Promise.reject(new Error('后端未就绪'));
      var st = ensureDbStoreState();
      var pid = String(projectId || '');
      if (!pid) return Promise.resolve([]);
      if (st.caseFilesByProject && Array.isArray(st.caseFilesByProject[pid])) {
        return Promise.resolve(st.caseFilesByProject[pid]);
      }
      st.loading = true;
      syncCaseGenDbStoreControls();
      if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '加载用例列表中...', '');
      return apiClient
        .listCaseFiles(pid)
        .then(function(list) {
          var files = Array.isArray(list) ? list : [];
          st.caseFilesByProject[pid] = files;
          renderCaseGenDbStoreCaseFiles();
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '', '');
          return files;
        })
        .catch(function(err) {
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '加载用例列表失败：' + (err && err.message ? err.message : '未知错误'), 'err');
          return [];
        })
        .finally(function() {
          st.loading = false;
          syncCaseGenDbStoreControls();
        });
    }

    function maybeConfirmIncompleteModulesBeforeStore(actionLabel, drawerRef) {
      var missing = listPendingDbStoreMissingModules();
      if (!missing.length) return Promise.resolve(true);
      var label = actionLabel ? String(actionLabel) : '写入用例库';
      var msg = missing.join(' ') + ' 没有选择用例，确定继续' + label + '吗？';
      return openConfirmDrawer({
        title: '确认' + label,
        message: msg,
        confirmText: '继续' + label,
        cancelText: '返回检查',
        previousDrawer: drawerRef || null,
      }).then(function(res) {
        return Boolean(res && res.ok === true);
      });
    }

    function triggerTempExecCaseLibrarySync(reason) {
      try {
        if (window && window.app) {
          var prev = Number(window.app.__tempexecCaseLibrarySyncSeq || 0);
          if (!Number.isFinite(prev) || prev < 0) prev = 0;
          window.app.__tempexecCaseLibrarySyncSeq = prev + 1;
          window.app.__tempexecCaseLibrarySyncReason = reason || 'casegen-store';
        }
      } catch (err) {
        // ignore
      }
      try {
        if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
          window.app.tempExecApi.loadTempExecState();
        }
      } catch (err2) {
        // ignore
      }
    }

    function openTempExecViewByNav() {
      try {
        var btn = document.getElementById('openTempExecViewNavBtn');
        if (btn && typeof btn.click === 'function') btn.click();
      } catch (err) {
        // ignore
      }
    }

    function goToExecSet(execSetId) {
      if (!execSetId) return Promise.resolve();
      try {
        switchTab('tempexec');
      } catch (err) {
        // ignore
      }
      openTempExecViewByNav();
      if (!window.app || !window.app.tempExecApi) return Promise.resolve();
      var tempApi = window.app.tempExecApi;
      if (typeof tempApi.loadTempExecState !== 'function' || typeof tempApi.setTempExecActive !== 'function') return Promise.resolve();
      return Promise.resolve()
        .then(function() { return tempApi.loadTempExecState(); })
        .then(function() { tempApi.setTempExecActive(String(execSetId)); });
    }

    function applyCaseGenDbStorePreferredSelections(mode) {
      var st = ensureDbStoreState();
      var pid = String(st.preferredProjectId || '');
      var vid = String(st.preferredVersionId || '');
      var fid = String(st.preferredCaseFileId || '');
      if (!pid) return Promise.resolve(false);
      st.projectId = pid;
      renderCaseGenDbStoreProjects();
      renderCaseGenDbStoreVersions();
      renderCaseGenDbStoreCaseFiles();
      syncCaseGenDbStoreControls();
      return loadCaseGenDbStoreVersions(pid)
        .then(function() {
          if (vid) {
            st.versionId = vid;
            renderCaseGenDbStoreVersions();
            renderCaseGenDbStoreCaseFiles();
            syncCaseGenDbStoreControls();
          }
          if (mode !== 'append' || !pid) return true;
          return loadCaseGenDbStoreCaseFiles(pid).then(function() {
            if (fid) {
              st.caseFileId = fid;
              renderCaseGenDbStoreCaseFiles();
              syncCaseGenDbStoreControls();
            }
            return true;
          });
        })
        .catch(function() {
          return false;
        });
    }

    function openCaseGenDbStoreDrawer(mode, options) {
      if (!isDbStoreReady()) {
        setStatus(caseGenStatus, '后端未就绪，请先启动后端服务后再入库', 'warn');
        return;
      }
      var drawer = ensureCaseGenDbStoreDrawer();
      if (!drawer) {
        setStatus(caseGenStatus, '抽屉组件未就绪，无法入库', 'err');
        return;
      }
      var st = ensureDbStoreState();
      st.mode = mode || '';
      st.loading = false;
      st.confirming = false;
      st.projectId = '';
      st.versionId = '';
      st.caseFileId = '';
      st.entryName = options && Object.prototype.hasOwnProperty.call(options, 'entryName')
        ? normalizeCaseGenDbStoreEntryName(options.entryName)
        : getCaseGenDbStoreDefaultEntryName();
      if (options && Array.isArray(options.items)) {
        applyExplicitDbStorePayload(st, options);
      } else {
        clearExplicitDbStorePayload(st);
      }
      if (caseGenDbStoreDrawerTitle) {
        caseGenDbStoreDrawerTitle.textContent = (mode === 'append') ? '旧用例追加入库' : '新用例入库';
      }
      if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '', '');
      if (caseGenDbStoreVersionSelect) {
        caseGenDbStoreVersionSelect.value = '';
        caseGenDbStoreVersionSelect.disabled = true;
      }
      if (caseGenDbStoreCaseFileSelect) {
        caseGenDbStoreCaseFileSelect.value = '';
        caseGenDbStoreCaseFileSelect.disabled = true;
      }
      renderCaseGenDbStoreEntryName();
      renderCaseGenDbStoreProjects();
      renderCaseGenDbStoreVersions();
      renderCaseGenDbStoreCaseFiles();
      syncCaseGenDbStoreControls();
      drawer.open();
      loadCaseGenDbStoreProjects().then(function() {
        applyCaseGenDbStorePreferredSelections(mode);
      });
    }

    function bindCaseGenDbStoreEvents() {
      if (caseGenDbStoreBound) return;
      caseGenDbStoreBound = true;
      if (caseGenDbStoreEntryNameInput) {
        caseGenDbStoreEntryNameInput.addEventListener('input', function() {
          var st = ensureDbStoreState();
          st.entryName = caseGenDbStoreEntryNameInput.value || '';
          syncCaseGenDbStoreControls();
        });
        caseGenDbStoreEntryNameInput.addEventListener('blur', function() {
          var st = ensureDbStoreState();
          st.entryName = normalizeCaseGenDbStoreEntryName(caseGenDbStoreEntryNameInput.value || '');
          renderCaseGenDbStoreEntryName();
          syncCaseGenDbStoreControls();
        });
      }
      if (caseGenDbStoreProjectSelect) {
        caseGenDbStoreProjectSelect.addEventListener('change', function() {
          var st = ensureDbStoreState();
          st.projectId = caseGenDbStoreProjectSelect.value || '';
          st.versionId = '';
          st.caseFileId = '';
          renderCaseGenDbStoreVersions();
          renderCaseGenDbStoreCaseFiles();
          syncCaseGenDbStoreControls();
          if (st.projectId) loadCaseGenDbStoreVersions(st.projectId);
        });
      }
      if (caseGenDbStoreVersionSelect) {
        caseGenDbStoreVersionSelect.addEventListener('change', function() {
          var st = ensureDbStoreState();
          var raw = caseGenDbStoreVersionSelect.value || '';
          var appUtils = window.app && window.app.utils ? window.app.utils : null;
          if (appUtils && typeof appUtils.isAddVersionOption === 'function' && appUtils.isAddVersionOption(raw)) {
            var pid = st.projectId;
            if (!pid) {
              if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '请先选择项目', 'warn');
              caseGenDbStoreVersionSelect.value = st.versionId || '';
              return;
            }
            if (!appUtils || typeof appUtils.openAddProjectVersionDrawer !== 'function') {
              if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '新增版本组件未就绪，请刷新后重试', 'err');
              caseGenDbStoreVersionSelect.value = st.versionId || '';
              return;
            }
            var prevValue = st.versionId || '';
            caseGenDbStoreVersionSelect.value = prevValue;
            st.loading = true;
            syncCaseGenDbStoreControls();
            var projectLabel = '';
            try {
              var list = Array.isArray(st.projects) ? st.projects : [];
              var found = list.find(function(p) { return p && String(p.id) === String(pid); }) || null;
              projectLabel = found && found.name ? String(found.name) : '';
            } catch (_) {
              projectLabel = '';
            }
            appUtils
              .openAddProjectVersionDrawer({
                projectId: pid,
                projectName: projectLabel || ('项目#' + pid),
                previousDrawer: ensureCaseGenDbStoreDrawer(),
              })
              .then(function(res) {
                if (!res || res.ok !== true || !res.version) return;
                st.versionsByProject = st.versionsByProject && typeof st.versionsByProject === 'object' ? st.versionsByProject : {};
                var list = st.versionsByProject[pid];
                if (!Array.isArray(list)) list = [];
                var exists = list.some(function(v) { return v && String(v.id) === String(res.version.id); });
                if (!exists) list.push(res.version);
                list.sort(function(a, b) {
                  var na = a && a.name ? String(a.name) : '';
                  var nb = b && b.name ? String(b.name) : '';
                  return na.localeCompare(nb, 'zh-Hans-CN');
                });
                st.versionsByProject[pid] = list;
                st.versionId = String(res.version.id);
                st.caseFileId = '';
                renderCaseGenDbStoreVersions();
                renderCaseGenDbStoreCaseFiles();
              })
              .finally(function() {
                st.loading = false;
                syncCaseGenDbStoreControls();
              });
            return;
          }
          st.versionId = raw;
          st.caseFileId = '';
          renderCaseGenDbStoreCaseFiles();
          syncCaseGenDbStoreControls();
          if (st.mode === 'append' && st.projectId) {
            loadCaseGenDbStoreCaseFiles(st.projectId).then(function() {
              renderCaseGenDbStoreCaseFiles();
              syncCaseGenDbStoreControls();
            });
          }
        });
      }
      if (caseGenDbStoreCaseFileSelect) {
        caseGenDbStoreCaseFileSelect.addEventListener('change', function() {
          var st = ensureDbStoreState();
          st.caseFileId = caseGenDbStoreCaseFileSelect.value || '';
          syncCaseGenDbStoreControls();
        });
      }
      if (caseGenDbStoreConfirmBtn) {
        caseGenDbStoreConfirmBtn.addEventListener('click', function() {
          var st = ensureDbStoreState();
          if (st.mode === 'append') confirmCaseGenDbAppend();
          else confirmCaseGenDbNewImport();
        });
      }
    }

    function openCaseGenDbStoreNewDrawer(options) {
      options = options || {};
      setCaseGenStoreMode('new', { persist: false });
      var st = ensureDbStoreState();
      var hasExplicitItems = Array.isArray(options.items) && options.items.length > 0;
      if (hasExplicitItems) {
        applyExplicitDbStorePayload(st, options);
      } else {
        clearExplicitDbStorePayload(st);
      }
      var action = options.newAction || st.newAction || (caseGenStoreActionSelect ? caseGenStoreActionSelect.value : '');
      action = String(action || '');
      if (!action) {
        markCaseGenDbStoreNewActionError();
        setStatus(caseGenStatus, '请先选择“直接入库”或“入库并转到执行”', 'warn');
        return;
      }
      st.newAction = action;
      clearCaseGenDbStoreNewActionError();
      if (hasExplicitItems) {
        openCaseGenDbStoreDrawer('new', options);
        return;
      }
      if (!hasSelectedGeneratedCases()) {
        if (!hasGeneratedCases()) {
          setStatus(caseGenStatus, '请先生成用例后再入库', 'warn');
          return;
        }
        var viewState = openCaseViewForSelectionHint('new');
        if (viewState && viewState.blocked) return;
        var opened = viewState && viewState.opened;
        setStatus(caseGenStatus, opened ? '请先在全模块用例视图勾选需要入库的用例（已标记勾选区域）' : '请先在全模块用例视图勾选需要入库的用例', 'warn');
        return;
      }
      openCaseGenDbStoreDrawer('new');
    }

    function openCaseGenDbStoreAppendDrawer(options) {
      options = options || {};
      setCaseGenStoreMode('append', { persist: false });
      var st = ensureDbStoreState();
      var hasExplicitItems = Array.isArray(options.items) && options.items.length > 0;
      if (hasExplicitItems) {
        applyExplicitDbStorePayload(st, options);
        openCaseGenDbStoreDrawer('append', options);
        return;
      }
      clearExplicitDbStorePayload(st);
      if (!hasSelectedGeneratedCases()) {
        if (!hasGeneratedCases()) {
          setStatus(caseGenStatus, '请先生成用例后再追加入库', 'warn');
          return;
        }
        var viewState = openCaseViewForSelectionHint('append');
        if (viewState && viewState.blocked) return;
        var opened = viewState && viewState.opened;
        setStatus(caseGenStatus, opened ? '请先在全模块用例视图勾选需要追加的用例（已标记勾选区域）' : '请先在全模块用例视图勾选需要追加的用例', 'warn');
        return;
      }
      openCaseGenDbStoreDrawer('append');
    }

    function maybeResetXmindCasegenAfterStoreSuccess(source, options) {
      if (String(source || '') !== 'xmind_casegen') return false;
      var opts = options || {};
      try {
        var xmindCasegenApi = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
        if (xmindCasegenApi && typeof xmindCasegenApi.resetAfterStoreSuccess === 'function') {
          return xmindCasegenApi.resetAfterStoreSuccess({
            workspaceId: opts.workspaceId ? String(opts.workspaceId || '') : '',
            closeWorkspace: true,
            showToast: true,
            toastText: '入库并关闭页签成功',
            toastDurationMs: 5000,
          }) === true;
        }
      } catch (err) {
        // ignore
      }
      return false;
    }

    function confirmCaseGenDbNewImport() {
      var st = ensureDbStoreState();
      var explicitStoreSource = String(st.explicitSource || '');
      if (st.loading || st.confirming) return;
      var items = collectPendingDbStoreItems();
      if (!items.length) {
        var viewState = openCaseViewForSelectionHint();
        if (viewState && viewState.blocked) return;
        var opened = viewState && viewState.opened;
        setStatus(caseGenStatus, opened ? '请先在全模块用例视图勾选需要入库的用例（已标记勾选区域）' : '请先勾选用例后再入库', 'warn');
        return;
      }
      if (!st.projectId || !st.versionId) {
        if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '请先选择项目与版本', 'warn');
        return;
      }
      var drawerRef = ensureCaseGenDbStoreDrawer();
      st.confirming = true;
      syncCaseGenDbStoreControls();
      maybeConfirmIncompleteModulesBeforeStore('入库', drawerRef).then(function(okMissing) {
        st.confirming = false;
        syncCaseGenDbStoreControls();
        if (!okMissing) {
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '已取消入库', 'warn');
          return;
        }
        var requirementLabel = ensureRequirementLabel('请输入需求标识后再入库');
        if (!requirementLabel) {
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '已取消入库（需求标识为空）', 'warn');
          return;
        }
        var entryName = normalizeCaseGenDbStoreEntryName(st.entryName || '') || normalizeCaseGenDbStoreEntryName(requirementLabel || '');
        if (!entryName) {
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '请输入确认入库的用例名', 'warn');
          return;
        }
        st.entryName = entryName;
        renderCaseGenDbStoreEntryName();
        var fileName = buildCaseGenDbStoreFileName(entryName);
        var action = st.newAction || (caseGenStoreActionSelect ? caseGenStoreActionSelect.value : '');
        action = String(action || '');
        var projectIdNum = Number(st.projectId);
        var versionIdNum = Number(st.versionId);
        st.loading = true;
        syncCaseGenDbStoreControls();
        if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '入库中...', '');
        apiClient
          .importCaseFile({
            project_id: projectIdNum,
            version_id: versionIdNum,
            file_name: fileName,
            source: st.explicitSource || 'casegen',
            items: items,
          })
          .then(function(caseFile) {
            if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '入库成功：' + entryName, 'ok');
            setStatus(caseGenStatus, '入库成功：' + entryName, 'ok');
            var drawer = ensureCaseGenDbStoreDrawer();
            if (drawer) drawer.close();
            var handledXmindStore = maybeResetXmindCasegenAfterStoreSuccess(explicitStoreSource, {
              workspaceId: st.explicitWorkspaceId || '',
            });
            if (!handledXmindStore) {
              try {
                if (window.app && window.app.utils && typeof window.app.utils.showCenterToast === 'function') {
                  window.app.utils.showCenterToast('用例入库成功', 'ok', 3000);
                }
              } catch (_) {}
            }
            triggerTempExecCaseLibrarySync('casegen-new');
            if (action === 'store_to_exec' && caseFile && caseFile.id && typeof apiClient.upsertExecSetFromCaseFile === 'function') {
              var execVersionDrawerApi = window.app && window.app.execVersionDrawer ? window.app.execVersionDrawer : null;
              if (!execVersionDrawerApi || typeof execVersionDrawerApi.open !== 'function') return null;
              var projectName = '';
              try {
                var pList = Array.isArray(state.projects) ? state.projects : [];
                var found = pList.find(function(p) { return p && Number(p.id) === Number(projectIdNum); }) || null;
                projectName = found && found.name ? String(found.name) : '';
              } catch (_) {
                projectName = '';
              }
              return execVersionDrawerApi.open({
                title: '选择执行版本',
                projectId: projectIdNum,
                projectName: projectName || ('项目#' + projectIdNum),
                importVersionId: versionIdNum,
              }).then(function(res0) {
                if (!res0 || res0.ok !== true) return null;
                var execVid = Object.prototype.hasOwnProperty.call(res0, 'versionId') ? res0.versionId : (res0.exec_version_id || null);
                return apiClient
                  .upsertExecSetFromCaseFile({
                    case_file_id: caseFile.id,
                    mode: 'replace',
                    preserve_results: true,
                    prefer_result_source: 'db',
                    requirement: requirementLabel,
                    exec_version_id: execVid,
                  })
                  .then(function(execSet) {
                    if (execSet && execSet.id) return goToExecSet(execSet.id);
                    return null;
                  });
              });
            }
            return null;
          })
          .catch(function(err) {
            var msg = err && err.message ? err.message : '入库失败';
            if (msg.indexOf('同名') !== -1 && window.app && window.app.caseLibraryApi && typeof window.app.caseLibraryApi.openImportDiffForExternal === 'function') {
              var drawer2 = ensureCaseGenDbStoreDrawer();
              if (drawer2) drawer2.close();
              setStatus(caseGenStatus, '检测到同名用例，已打开差异对比抽屉', 'warn');
              return window.app.caseLibraryApi
                .openImportDiffForExternal({
                  projectId: projectIdNum,
                  versionId: versionIdNum,
                  fileName: fileName,
                  source: explicitStoreSource || 'casegen',
                  items: items,
                  error: err,
                })
                .then(function(res) {
                  if (!res || res.ok !== true) {
                    setStatus(caseGenStatus, '已取消覆盖导入', 'warn');
                    return null;
                  }
                  var caseFile2 = res.caseFile || null;
                  var handledXmindStore = maybeResetXmindCasegenAfterStoreSuccess(explicitStoreSource, {
                    workspaceId: st.explicitWorkspaceId || '',
                  });
                  if (!handledXmindStore) {
                    try {
                      if (window.app && window.app.utils && typeof window.app.utils.showCenterToast === 'function') {
                        window.app.utils.showCenterToast('用例入库成功', 'ok', 3000);
                      }
                    } catch (_) {}
                  }
                  triggerTempExecCaseLibrarySync('casegen-new-overwrite');
                  if (action === 'store_to_exec' && caseFile2 && caseFile2.id && typeof apiClient.upsertExecSetFromCaseFile === 'function') {
                    var execVersionDrawerApi2 = window.app && window.app.execVersionDrawer ? window.app.execVersionDrawer : null;
                    if (!execVersionDrawerApi2 || typeof execVersionDrawerApi2.open !== 'function') return null;
                    var projectName2 = '';
                    try {
                      var pList2 = Array.isArray(state.projects) ? state.projects : [];
                      var found2 = pList2.find(function(p) { return p && Number(p.id) === Number(projectIdNum); }) || null;
                      projectName2 = found2 && found2.name ? String(found2.name) : '';
                    } catch (_) {
                      projectName2 = '';
                    }
                    return execVersionDrawerApi2.open({
                      title: '选择执行版本',
                      projectId: projectIdNum,
                      projectName: projectName2 || ('项目#' + projectIdNum),
                      importVersionId: versionIdNum,
                    }).then(function(res1) {
                      if (!res1 || res1.ok !== true) return null;
                      var execVid2 = Object.prototype.hasOwnProperty.call(res1, 'versionId') ? res1.versionId : (res1.exec_version_id || null);
                      return apiClient
                        .upsertExecSetFromCaseFile({
                          case_file_id: caseFile2.id,
                          mode: 'replace',
                          preserve_results: true,
                          prefer_result_source: 'db',
                          requirement: requirementLabel,
                          exec_version_id: execVid2,
                        })
                        .then(function(execSet2) {
                          if (execSet2 && execSet2.id) return goToExecSet(execSet2.id);
                          return null;
                        });
                    });
                  }
                  return null;
                });
            }
            if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '入库失败：' + msg, 'err');
            setStatus(caseGenStatus, '入库失败：' + msg, 'err');
            return null;
          })
          .finally(function() {
            st.loading = false;
            syncCaseGenDbStoreControls();
          });
      });
    }

    function confirmCaseGenDbAppend() {
      var st = ensureDbStoreState();
      var explicitStoreSource = String(st.explicitSource || '');
      if (st.loading || st.confirming) return;
      var items = collectPendingDbStoreItems();
      if (!items.length) {
        var viewState = openCaseViewForSelectionHint();
        if (viewState && viewState.blocked) return;
        var opened = viewState && viewState.opened;
        setStatus(caseGenStatus, opened ? '请先在全模块用例视图勾选需要追加的用例（已标记勾选区域）' : '请先勾选用例后再追加入库', 'warn');
        return;
      }
      if (!st.projectId || !st.versionId || !st.caseFileId) {
        if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '请先选择项目、版本与目标用例', 'warn');
        return;
      }
      var selectedName = '';
      try {
        if (caseGenDbStoreCaseFileSelect) {
          var opt = caseGenDbStoreCaseFileSelect.options[caseGenDbStoreCaseFileSelect.selectedIndex];
          selectedName = opt ? String(opt.textContent || '').trim() : '';
        }
      } catch (err) {
        selectedName = '';
      }
      if (!apiClient || typeof apiClient.appendCaseItems !== 'function') {
        if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '后端追加接口未就绪', 'err');
        return;
      }
      var caseFileIdNum = Number(st.caseFileId);
      var projectIdNum = Number(st.projectId);
      var versionIdNum = Number(st.versionId);

      function applyAppendResult(res, overwrite) {
        var appended = res && (res.appended || res.appended_count) ? Number(res.appended || res.appended_count) : 0;
        var overwritten = res && (res.overwritten || res.overwritten_count) ? Number(res.overwritten || res.overwritten_count) : 0;
        var skipped = res && (res.skipped_db_conflicts || res.skipped) ? Number(res.skipped_db_conflicts || res.skipped) : 0;
        var skippedExisting = res && (res.skipped_existing_conflicts || res.skipped_existing_title_conflicts) ? Number(res.skipped_existing_conflicts || res.skipped_existing_title_conflicts) : 0;
        var msg = '追加入库成功：新增 ' + appended + ' 条';
        if (overwrite && overwritten) msg += '，覆盖 ' + overwritten + ' 条';
        if (!overwrite && skippedExisting) msg += '，重复已跳过 ' + skippedExisting + ' 条';
        if (!overwrite && !skippedExisting && skipped) msg += '，重复已跳过 ' + skipped + ' 条';
        if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, msg, 'ok');
        setStatus(caseGenStatus, msg, 'ok');
        triggerTempExecCaseLibrarySync(overwrite ? 'casegen-append-overwrite' : 'casegen-append');
      }

      function proceedAppend() {
        // 若目标用例中已存在同模块同标题用例：打开 diff 抽屉，确认是否覆盖后再追加入库。
        if (typeof apiClient.listCaseItems === 'function' &&
            window.app &&
            window.app.caseLibraryApi &&
            typeof window.app.caseLibraryApi.openAppendDiffForExternal === 'function') {
          st.loading = true;
          syncCaseGenDbStoreControls();
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '检查重复用例中...', '');
          apiClient
            .listCaseItems(caseFileIdNum)
            .then(function(dbItems) {
              var list = Array.isArray(dbItems) ? dbItems : [];
              var keyMap = {};
              items.forEach(function(it) {
                var mod = (it && it.module ? String(it.module) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                var title = (it && it.title ? String(it.title) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                var pre = (it && it.precondition ? String(it.precondition) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                var steps = (it && it.steps ? String(it.steps) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                var expected = (it && it.expected ? String(it.expected) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                if (mod && title && expected) keyMap[mod + '::' + title + '::' + pre + '::' + steps + '::' + expected] = true;
              });
              var hasConflict = list.some(function(it) {
                var mod = (it && it.module ? String(it.module) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                var title = (it && it.title ? String(it.title) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                var pre = (it && it.precondition ? String(it.precondition) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                var steps = (it && it.steps ? String(it.steps) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                var expected = (it && it.expected ? String(it.expected) : '').replace(/\r\n/g, '\n').trim().toLowerCase();
                return Boolean(mod && title && expected && keyMap[mod + '::' + title + '::' + pre + '::' + steps + '::' + expected]);
              });

              if (!hasConflict) {
                st.loading = true;
                syncCaseGenDbStoreControls();
                if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '追加入库中...', '');
                return apiClient.appendCaseItems(caseFileIdNum, { items: items }).then(function(res) {
                  applyAppendResult(res || null, false);
                  var drawer0 = ensureCaseGenDbStoreDrawer();
                  if (drawer0) drawer0.close();
                  var handledXmindStore = maybeResetXmindCasegenAfterStoreSuccess(explicitStoreSource, {
                    workspaceId: st.explicitWorkspaceId || '',
                  });
                  if (!handledXmindStore) {
                    try {
                      if (window.app && window.app.utils && typeof window.app.utils.showCenterToast === 'function') {
                        window.app.utils.showCenterToast('追加入库成功', 'ok', 3000);
                      }
                    } catch (_) {}
                  }
                  return null;
                }).finally(function() {
                  st.loading = false;
                  syncCaseGenDbStoreControls();
                });
              }

              var drawer = ensureCaseGenDbStoreDrawer();
              if (drawer) drawer.close();
              st.loading = false;
              syncCaseGenDbStoreControls();
              if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '', '');
              setStatus(caseGenStatus, '检测到重复用例，已打开差异对比，请确认是否覆盖', 'warn');
              return window.app.caseLibraryApi
                .openAppendDiffForExternal({
                  projectId: projectIdNum,
                  versionId: versionIdNum,
                  caseFileId: caseFileIdNum,
                  fileNameClean: selectedName || ('用例#' + caseFileIdNum),
                  items: items,
                  dbItems: list,
                })
                .then(function(res) {
                  if (res && res.ok === true) {
                    applyAppendResult(res.result || null, true);
                    var handledXmindStore = maybeResetXmindCasegenAfterStoreSuccess(explicitStoreSource, {
                      workspaceId: st.explicitWorkspaceId || '',
                    });
                    if (!handledXmindStore) {
                      try {
                        if (window.app && window.app.utils && typeof window.app.utils.showCenterToast === 'function') {
                          window.app.utils.showCenterToast('追加入库成功', 'ok', 3000);
                        }
                      } catch (_) {}
                    }
                    return null;
                  }
                  setStatus(caseGenStatus, '已取消追加入库', 'warn');
                  return null;
                });
            })
            .then(function() {
              // no-op
              return null;
            })
            .catch(function(err) {
              st.loading = false;
              syncCaseGenDbStoreControls();
              var msg = err && err.message ? err.message : '追加入库失败';
              if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '追加入库失败：' + msg, 'err');
              setStatus(caseGenStatus, '追加入库失败：' + msg, 'err');
            });
          return;
        }

        st.loading = true;
        syncCaseGenDbStoreControls();
        if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '追加入库中...', '');
        apiClient
          .appendCaseItems(caseFileIdNum, { items: items })
          .then(function(res) {
            applyAppendResult(res || null, false);
            var drawer = ensureCaseGenDbStoreDrawer();
            if (drawer) drawer.close();
            maybeResetXmindCasegenAfterStoreSuccess(explicitStoreSource);
            return null;
          })
          .catch(function(err) {
            var msg = err && err.message ? err.message : '追加入库失败';
            if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '追加入库失败：' + msg, 'err');
            setStatus(caseGenStatus, '追加入库失败：' + msg, 'err');
            return null;
          })
          .finally(function() {
            st.loading = false;
            syncCaseGenDbStoreControls();
          });
      }

      var drawerRef = ensureCaseGenDbStoreDrawer();
      st.confirming = true;
      syncCaseGenDbStoreControls();
      maybeConfirmIncompleteModulesBeforeStore('追加入库', drawerRef).then(function(okMissing) {
        st.confirming = false;
        syncCaseGenDbStoreControls();
        if (!okMissing) {
          if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '已取消追加入库', 'warn');
          return null;
        }
        proceedAppend();
        return null;
      }).catch(function(err) {
        st.confirming = false;
        st.loading = false;
        syncCaseGenDbStoreControls();
        var msg = err && err.message ? err.message : '追加入库失败';
        if (caseGenDbStoreStatus) setStatus(caseGenDbStoreStatus, '追加入库失败：' + msg, 'err');
        setStatus(caseGenStatus, '追加入库失败：' + msg, 'err');
      });
    }

    return {
      ensureDbStoreState: ensureDbStoreState,
      clearExplicitDbStorePayload: clearExplicitDbStorePayload,
      normalizeExplicitDbStoreItems: normalizeExplicitDbStoreItems,
      applyExplicitDbStorePayload: applyExplicitDbStorePayload,
      normalizeCaseGenDbStoreEntryName: normalizeCaseGenDbStoreEntryName,
      getCaseGenDbStoreDefaultEntryName: getCaseGenDbStoreDefaultEntryName,
      renderCaseGenDbStoreEntryName: renderCaseGenDbStoreEntryName,
      buildCaseGenDbStoreFileName: buildCaseGenDbStoreFileName,
      hasExplicitDbStoreItems: hasExplicitDbStoreItems,
      collectPendingDbStoreItems: collectPendingDbStoreItems,
      listPendingDbStoreMissingModules: listPendingDbStoreMissingModules,
      isDbStoreReady: isDbStoreReady,
      ensureCaseGenDbStoreDrawer: ensureCaseGenDbStoreDrawer,
      clearCaseGenDbStoreNewActionError: clearCaseGenDbStoreNewActionError,
      markCaseGenDbStoreNewActionError: markCaseGenDbStoreNewActionError,
      setCaseGenDbStoreNewAction: setCaseGenDbStoreNewAction,
      setPendingCaseGenDbStoreAction: setPendingCaseGenDbStoreAction,
      consumePendingCaseGenDbStoreAction: consumePendingCaseGenDbStoreAction,
      buildCaseItemPayloadFromGenerated: buildCaseItemPayloadFromGenerated,
      collectDbStoreSelectedItems: collectDbStoreSelectedItems,
      syncCaseGenDbStoreControls: syncCaseGenDbStoreControls,
      renderCaseGenDbStoreProjects: renderCaseGenDbStoreProjects,
      renderCaseGenDbStoreVersions: renderCaseGenDbStoreVersions,
      renderCaseGenDbStoreCaseFiles: renderCaseGenDbStoreCaseFiles,
      loadCaseGenDbStoreProjects: loadCaseGenDbStoreProjects,
      loadCaseGenDbStoreVersions: loadCaseGenDbStoreVersions,
      loadCaseGenDbStoreCaseFiles: loadCaseGenDbStoreCaseFiles,
      maybeConfirmIncompleteModulesBeforeStore: maybeConfirmIncompleteModulesBeforeStore,
      triggerTempExecCaseLibrarySync: triggerTempExecCaseLibrarySync,
      openTempExecViewByNav: openTempExecViewByNav,
      goToExecSet: goToExecSet,
      applyCaseGenDbStorePreferredSelections: applyCaseGenDbStorePreferredSelections,
      openCaseGenDbStoreDrawer: openCaseGenDbStoreDrawer,
      bindCaseGenDbStoreEvents: bindCaseGenDbStoreEvents,
      openCaseGenDbStoreNewDrawer: openCaseGenDbStoreNewDrawer,
      openCaseGenDbStoreAppendDrawer: openCaseGenDbStoreAppendDrawer,
      maybeResetXmindCasegenAfterStoreSuccess: maybeResetXmindCasegenAfterStoreSuccess,
      confirmCaseGenDbNewImport: confirmCaseGenDbNewImport,
      confirmCaseGenDbAppend: confirmCaseGenDbAppend,
    };
  }

  return { create: create };
});
