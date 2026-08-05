(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecNavigationViewOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function(root) {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var state = opts.state || {};
    var windowRef = opts.window || root || {};
    var tempVersionGrid = opts.tempVersionGrid || null;
    var tempExecNav = opts.tempExecNav || null;
    var tempFocusZone = opts.tempFocusZone || null;
    var tempExecViewFocusZone = opts.tempExecViewFocusZone || null;
    var tempReqToggleBtn = opts.tempReqToggleBtn || null;
    var tempVersionToggleBtn = opts.tempVersionToggleBtn || null;
    var createTempVersionBtn = opts.createTempVersionBtn || null;
    var tempExecMindBtn = opts.tempExecMindBtn || null;
    var exportTempExecBtn = opts.exportTempExecBtn || null;
    var exportTempExecConfigBtn = opts.exportTempExecConfigBtn || null;
    var exportTempExecXmindBtn = opts.exportTempExecXmindBtn || null;
    var exportTempExecCasesXmindBtn = opts.exportTempExecCasesXmindBtn || null;
    var tempExecXmindViewBtn = opts.tempExecXmindViewBtn || null;
    var buildMindDataFromCases = typeof opts.buildMindDataFromCases === 'function' ? opts.buildMindDataFromCases : null;
    var normalizeRequirementName = port('normalizeRequirementName', function(value) { return String(value || '').trim(); });
    var escapeHtml = port('escapeHtml', function(value) { return value === null || value === undefined ? '' : String(value); });
    var getTempExecFile = port('getTempExecFile', function(fileId) {
      return (state.tempExecFiles || []).find(function(file) { return file && String(file.id) === String(fileId); }) || null;
    });
    var resolveTempExecState = port('resolveTempExecState', function() { return 'pending'; });
    var isTempExecProjectLayoutEnabled = port('isTempExecProjectLayoutEnabled', function() { return false; });
    var ensureTempVersionList = port('ensureTempVersionList');
    var ensureTempExecPlacement = port('ensureTempExecPlacement', function() {
      if (!state.tempExecPlacement) state.tempExecPlacement = { requirementOrder: [] };
      return state.tempExecPlacement;
    });
    var ensureVersionOrder = port('ensureVersionOrder', function(ids) { return ids || []; });
    var ensureRequirementOrder = port('ensureRequirementOrder', function(ids) { return ids || []; });
    var ensureFileOrder = port('ensureFileOrder', function(req, ids) { return ids || []; });
    var ensureProjectOrder = port('ensureProjectOrder', function(ids) { return ids || []; });
    var ensureProjectVersionOrder = port('ensureProjectVersionOrder', function(projectId, ids) { return ids || []; });
    var ensureProjectVersionFileOrder = port('ensureProjectVersionFileOrder', function(projectId, versionId, ids) { return ids || []; });
    var getVersionRequirementBlocks = port('getVersionRequirementBlocks', function() { return []; });
    var resolveProjectName = port('resolveProjectName', function(projectId) { return String(projectId || '未分配项目'); });
    var resolveVersionName = port('resolveVersionName', function(projectId, versionId) { return String(versionId || '未分配版本'); });
    var sortByCreatedDesc = port('sortByCreatedDesc', function(a, b) {
      return (Number(b && b.createdAt) || 0) - (Number(a && a.createdAt) || 0);
    });
    var persistTempExecState = port('persistTempExecState');
    var scheduleTempExecUiSave = port('scheduleTempExecUiSave');
    var renderTempExecOverview = port('renderTempExecOverview');
    var renderTempExecNavPort = function() { return renderTempExecNav(); };
    var renderTempVersionGridPort = function() { return renderTempVersionGrid(); };

    function setRenderPorts(ports) {
      var next = ports && typeof ports === 'object' ? ports : {};
      if (typeof next.renderTempExecNav === 'function') renderTempExecNavPort = next.renderTempExecNav;
      if (typeof next.renderTempVersionGrid === 'function') renderTempVersionGridPort = next.renderTempVersionGrid;
    }

    function syncTempSectionToggleButtons() {
      var isProjectLayout = isTempExecProjectLayoutEnabled();
      if (tempReqToggleBtn) {
        tempReqToggleBtn.classList.toggle('hidden', Boolean(isProjectLayout));
        tempReqToggleBtn.classList.toggle('collapsed', Boolean(state.tempExecReqCollapsed));
        var reqLabel = state.tempExecReqCollapsed ? '展开需求区' : '收起需求区';
        tempReqToggleBtn.setAttribute('aria-label', reqLabel);
        tempReqToggleBtn.setAttribute('title', reqLabel);
        tempReqToggleBtn.textContent = reqLabel;
      }
      if (tempVersionToggleBtn) {
        tempVersionToggleBtn.classList.toggle('collapsed', Boolean(state.tempExecVersionCollapsed));
        var verLabel = isProjectLayout
          ? (state.tempExecVersionCollapsed ? '展开项目区' : '收起项目区')
          : (state.tempExecVersionCollapsed ? '展开版本区' : '收起版本区');
        tempVersionToggleBtn.setAttribute('aria-label', verLabel);
        tempVersionToggleBtn.setAttribute('title', verLabel);
        tempVersionToggleBtn.textContent = verLabel;
      }
      if (createTempVersionBtn) {
        createTempVersionBtn.classList.toggle('hidden', Boolean(state.tempExecVersionCollapsed) || Boolean(isProjectLayout));
        createTempVersionBtn.disabled = Boolean(isProjectLayout);
      }
      if (tempExecNav) {
        var header = tempExecNav.previousElementSibling;
        if (header && header.classList && header.classList.contains('temp-exec-header')) {
          header.classList.toggle('hidden', Boolean(isProjectLayout));
        }
        tempExecNav.classList.toggle('hidden', Boolean(isProjectLayout));
      }
      if (tempVersionGrid) {
        tempVersionGrid.classList.toggle('temp-project-layout', Boolean(isProjectLayout));
        var header2 = tempVersionGrid.previousElementSibling;
        if (header2 && header2.querySelector) {
          var titleEl = header2.querySelector('.temp-version-title');
          if (titleEl) titleEl.textContent = isProjectLayout ? '项目分组' : '版本分组';
        }
      }
    }

    function buildTempExecTag(file, isFocused) {
      if (isFocused) return '<span class="tag tag-focus">专注</span>';
      var tags = [];
      if (file && file.reuseEnabled) tags.push('<span class="tag tag-reuse">复</span>');
      if (file && file.associationEnabled) tags.push('<span class="tag tag-association">关联</span>');
      return tags.join('');
    }

    function getTempExecFileCaseCount(file) {
      if (!file) return 0;
      if (Array.isArray(file.cases) && file.cases.length) return file.cases.length;
      var fallback = file.caseCount;
      if (fallback === null || fallback === undefined) fallback = file.case_count;
      if (fallback === null || fallback === undefined) fallback = file.itemCount;
      if (fallback === null || fallback === undefined) fallback = file.item_count;
      var num = Number(fallback);
      if (!Number.isFinite(num) || num < 0) return 0;
      return Math.round(num);
    }

    function getTempExecAiGenBadgeRecord(fileId) {
      var store = state.tempExecAiGenBadge;
      if (!store || typeof store !== 'object') return null;
      if (!store.files || typeof store.files !== 'object') return null;
      var key = String(fileId || '');
      if (!key) return null;
      var record = store.files[key];
      if (!record || typeof record !== 'object') return null;
      if (typeof record.result_token !== 'string') record.result_token = record.result_token ? String(record.result_token) : '';
      if (typeof record.focus_read_token !== 'string') record.focus_read_token = record.focus_read_token ? String(record.focus_read_token) : '';
      if (typeof record.assign_entry_read_token !== 'string') record.assign_entry_read_token = record.assign_entry_read_token ? String(record.assign_entry_read_token) : '';
      if (typeof record.assign_item_read_token !== 'string') record.assign_item_read_token = record.assign_item_read_token ? String(record.assign_item_read_token) : '';
      return record;
    }

    function canShowTempExecAiGenBadge(fileId) {
      var file = getTempExecFile(fileId);
      if (!file) return false;
      if (String(file.status || '') === 'archived') return false;
      return true;
    }

    function shouldShowTempExecAiGenFocusBadge(fileId) {
      if (!canShowTempExecAiGenBadge(fileId)) return false;
      var record = getTempExecAiGenBadgeRecord(fileId);
      if (!record || !record.result_token) return false;
      return String(record.focus_read_token || '') !== String(record.result_token || '');
    }

    function shouldShowTempExecAiGenAssignItemBadge(fileId) {
      if (!canShowTempExecAiGenBadge(fileId)) return false;
      var activeId = state && state.tempExecActiveId ? String(state.tempExecActiveId || '') : '';
      if (activeId && String(fileId || '') === activeId) return false;
      var focusSet = new Set(state.tempExecFocus || []);
      if (focusSet.has(String(fileId || ''))) return false;
      var record = getTempExecAiGenBadgeRecord(fileId);
      if (!record || !record.result_token) return false;
      return String(record.assign_item_read_token || '') !== String(record.result_token || '');
    }

    function renderTempExecItemRow(file, options) {
      var rowOptions = options || {};
      var isArchived = Boolean(file && String(file.status || '') === 'archived');
      var active = rowOptions.activeId === file.id ? 'active' : '';
      var focusSet = rowOptions.focusSet || new Set();
      var showAiDot = Boolean(rowOptions.showAiDot);
      var stateClass = resolveTempExecState(file);
      var tagHtml = buildTempExecTag(file, focusSet.has(file.id));
      var removeHtml = (rowOptions.hideRemove || isArchived)
        ? ''
        : '<button type="button" class="remove temp-req-remove" aria-label="删除' + escapeHtml(file && file.name ? file.name : '测试用例') + '" title="删除" data-temp-remove="' + file.id + '" draggable="false">×</button>';
      var reqKey = normalizeRequirementName(file && file.requirement) || '未标识需求';
      var archivedMask = isArchived ? '<div class="temp-archived-mask">已归档</div>' : '';
      var aiDot = showAiDot && shouldShowTempExecAiGenAssignItemBadge(file && file.id ? file.id : '') ? ' case-library-ai-gen-dot' : '';
      return (
        '<div class="temp-req-row ' + stateClass + (isArchived ? ' archived' : '') + '" data-temp-file="' + file.id + '" data-temp-req="' + reqKey + '"' + (isArchived ? ' data-temp-archived="1"' : '') + ' draggable="' + (isArchived ? 'false' : 'true') + '">' +
          tagHtml +
          '<span class="temp-req-count-badge">' + getTempExecFileCaseCount(file) + ' 条</span>' +
          '<button type="button" data-temp-file="' + file.id + '"' + (isArchived ? ' data-temp-archived="1"' : '') + ' class="temp-req-item ' + active + aiDot + '" draggable="' + (isArchived ? 'false' : 'true') + '">' +
            '<div class="temp-req-line">' +
              '<span class="name" title="' + escapeHtml(file && file.name ? file.name : '测试用例') + '"><span class="name-text">' + escapeHtml(file && file.name ? file.name : '测试用例') + '</span></span>' +
            '</div>' +
          '</button>' +
          removeHtml +
          archivedMask +
        '</div>'
      );
    }

    function renderTempVersionGrid() {
      if (!tempVersionGrid) return;
      if (isTempExecProjectLayoutEnabled()) {
        renderTempProjectGrid();
        return;
      }
      ensureTempVersionList();
      syncTempSectionToggleButtons();
      if (state.tempExecVersionCollapsed) {
        tempVersionGrid.classList.add('collapsed');
        tempVersionGrid.innerHTML = '<span class="hint">版本区已收起，点击“展开版本区”查看</span>';
        return;
      }
      tempVersionGrid.classList.remove('collapsed');
      if (!state.tempExecVersions.length) {
        tempVersionGrid.innerHTML = '<span class="hint">暂无版本，点击“新建版本”创建</span>';
        return;
      }
      ensureTempExecPlacement();
      var orderedIds = ensureVersionOrder(state.tempExecVersions.map(function(ver) { return ver.id; }));
      var versions = state.tempExecVersions.slice().sort(function(a, b) {
        var ia = orderedIds.indexOf(a.id);
        var ib = orderedIds.indexOf(b.id);
        if (ia === -1 && ib === -1) return (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN');
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
      var fileMap = new Map(state.tempExecFiles.map(function(file) { return [file.id, file]; }));
      var focusSet = new Set(state.tempExecFocus || []);
      var cards = versions.map(function(ver) {
        var name = (ver && ver.name ? ver.name : '').trim() || '未命名版本';
        var reqBlocks = getVersionRequirementBlocks(ver);
        var body = reqBlocks.length
          ? reqBlocks.map(function(block) {
              var ids = block.ids.join(',');
              var reqRows = block.ids.map(function(fid) {
                var file = fileMap.get(fid);
                if (!file) return '';
                return renderTempExecItemRow(file, {
                  focusSet: focusSet,
                  activeId: state.tempExecActiveId,
                  hideRemove: true,
                  showAiDot: true,
                });
              }).join('');
              return (
                '<div class="temp-req-box" data-temp-req="' + block.req + '" data-temp-req-key="' + block.key + '" data-temp-file-group="' + ids + '" data-temp-version-group="' + ver.id + '" draggable="true">' +
                  '<div class="temp-req-header">' +
                    '<span class="temp-req-title">' + escapeHtml(block.req) + '</span>' +
                    '<div class="temp-req-actions">' +
                      '<span class="temp-req-count">' + block.ids.length + ' 份</span>' +
                      '<span class="box-remove" title="移出版本" data-temp-group-remove="' + ver.id + '" data-temp-group-ids="' + ids + '">×</span>' +
                    '</div>' +
                  '</div>' +
                  '<div class="temp-req-list">' + reqRows + '</div>' +
                '</div>'
              );
            }).join('')
          : '<span class="placeholder">拖拽需求盒子到此</span>';
        return (
          '<div class="temp-version-card" data-temp-version="' + ver.id + '">' +
            '<div class="header">' +
              '<span class="title" title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</span>' +
              '<div class="version-actions">' +
                '<button class="chip" type="button" data-temp-version-rename="' + ver.id + '" title="重命名">重命名</button>' +
                '<span class="remove" data-temp-version-remove="' + ver.id + '" title="删除版本">×</span>' +
              '</div>' +
            '</div>' +
            '<div class="temp-version-body">' + body + '</div>' +
          '</div>'
        );
      }).join('');
      tempVersionGrid.innerHTML = cards;
      enforceTempFileDraggable(tempVersionGrid);
    }

    function normalizeTempExecImportProjectFilterId(raw) {
      var pid = raw === null || raw === undefined ? '' : String(raw);
      if (!pid) return '';
      var list = Array.isArray(state.projects) ? state.projects : [];
      if (list.length) {
        var ok = list.some(function(project) { return project && String(project.id) === pid; });
        return ok ? pid : '';
      }
      var files = Array.isArray(state.tempExecFiles) ? state.tempExecFiles : [];
      var ok2 = files.some(function(file) { return file && file.projectId && String(file.projectId) === pid; });
      return ok2 ? pid : '';
    }

    function getTempExecImportProjectFilterProjectIds(fallbackIds) {
      var list = Array.isArray(state.projects) ? state.projects : [];
      if (list.length) {
        var utils = windowRef.app && windowRef.app.utils ? windowRef.app.utils : {};
        var globalState = windowRef.app && windowRef.app.state ? windowRef.app.state : {};
        if (utils && typeof utils.sortProjectsByUserSettings === 'function') {
          list = utils.sortProjectsByUserSettings(list, globalState);
        }
      }
      var ids = list
        .map(function(project) { return project && project.id !== null && project.id !== undefined ? String(project.id) : ''; })
        .filter(Boolean);
      if (ids.length) return ids;
      return Array.isArray(fallbackIds) ? fallbackIds.slice() : [];
    }

    function renderTempExecImportProjectFilterBlock(projectIds, activeProjectId) {
      var list = Array.isArray(projectIds) ? projectIds : [];
      if (!list.length) return '';
      var active = activeProjectId ? String(activeProjectId) : '';
      var icon =
        '<span class="nav-entry-icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" role="presentation" focusable="false">' +
            '<path d="M3 6h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"></path>' +
          '</svg>' +
        '</span>';
      var allCls = 'nav-entry-card nav-entry-overview' + (!active ? ' active' : '');
      var allBtn =
        '<button type="button" class="' + allCls + '" data-tempexec-import-project-filter="" data-tempexec-import-project-filter-all="1">' +
          icon +
          '<span class="nav-entry-text">' +
            '<span class="nav-entry-title">全部项目</span>' +
            '<span class="nav-entry-desc">显示所有项目分组</span>' +
          '</span>' +
        '</button>';
      var cards = list.map(function(pid) {
        var name = resolveProjectName(pid);
        var cls = 'nav-entry-card nav-entry-overview' + (String(pid) === String(active) ? ' active' : '');
        return (
          '<button type="button" class="' + cls + '" data-tempexec-import-project-filter="' + escapeHtml(pid) + '">' +
            icon +
            '<span class="nav-entry-text">' +
              '<span class="nav-entry-title">' + escapeHtml(name) + '</span>' +
              '<span class="nav-entry-desc">仅展示该项目分组</span>' +
            '</span>' +
          '</button>'
        );
      }).join('');
      return (
        '<div class="tempexec-project-filter">' +
          '<div class="tempexec-project-filter-title">项目</div>' +
          '<div class="nav-entry-grid tempexec-project-filter-grid">' + allBtn + cards + '</div>' +
        '</div>'
      );
    }

    function renderTempProjectGrid() {
      if (!tempVersionGrid) return;
      syncTempSectionToggleButtons();
      if (state.tempExecVersionCollapsed) {
        tempVersionGrid.classList.add('collapsed');
        tempVersionGrid.innerHTML = '<span class="hint">项目区已收起，点击“展开项目区”查看</span>';
        return;
      }
      tempVersionGrid.classList.remove('collapsed');
      var activeFiles = Array.isArray(state.tempExecFiles) ? state.tempExecFiles.slice() : [];
      activeFiles = activeFiles.filter(function(file) { return file && file.projectId; });
      var archivedFiles = Array.isArray(state.tempExecArchivedFiles) ? state.tempExecArchivedFiles.slice() : [];
      archivedFiles = archivedFiles.filter(function(file) { return file && file.projectId; });
      var files = activeFiles.concat(archivedFiles);
      var activeFilterProjectId = normalizeTempExecImportProjectFilterId(state.tempExecImportProjectFilterId);
      state.tempExecImportProjectFilterId = activeFilterProjectId;
      var focusSet = new Set(state.tempExecFocus || []);
      var activeFileMap = new Map(activeFiles.map(function(file) { return [String(file.id), file]; }));
      var archivedFileMap = new Map(archivedFiles.map(function(file) { return [String(file.id), file]; }));
      if (!files.length) {
        var emptyFilterProjectIds = getTempExecImportProjectFilterProjectIds([]);
        var emptyFilterBlock = renderTempExecImportProjectFilterBlock(emptyFilterProjectIds, activeFilterProjectId);
        tempVersionGrid.innerHTML = emptyFilterBlock + '<span class="hint">暂无用例，导入用例后会按项目与版本自动分组</span>';
        return;
      }
      var projectMeta = new Map();
      var projectIdSet = new Set();
      files.forEach(function(file) {
        var pid = file && file.projectId ? String(file.projectId) : '';
        if (!pid) return;
        projectIdSet.add(pid);
        var ts = Number(file && (file.archivedAt || file.createdAt)) || 0;
        if (!Number.isFinite(ts)) ts = 0;
        var prev = projectMeta.has(pid) ? Number(projectMeta.get(pid) || 0) : 0;
        if (ts > prev) projectMeta.set(pid, ts);
      });
      var orderedProjects = ensureProjectOrder(Array.from(projectIdSet.values()), projectMeta);
      var filterProjectIds = getTempExecImportProjectFilterProjectIds(orderedProjects);
      var filterBlockHtml = renderTempExecImportProjectFilterBlock(filterProjectIds, activeFilterProjectId);
      var visibleProjects = activeFilterProjectId
        ? orderedProjects.filter(function(pid) { return String(pid) === String(activeFilterProjectId); })
        : orderedProjects.slice();
      if (!visibleProjects.length) {
        tempVersionGrid.innerHTML = filterBlockHtml + '<span class="hint">当前项目暂无用例，可切换其他项目或继续导入</span>';
        return;
      }
      var html = visibleProjects.map(function(pid) {
        var projectFiles = files.filter(function(file) { return file && String(file.projectId) === pid; });
        var versionMap = new Map();
        var versionMeta = new Map();
        projectFiles.forEach(function(file) {
          var vid = file && file.versionId !== null && file.versionId !== undefined ? String(file.versionId || '') : '';
          if (!versionMap.has(vid)) versionMap.set(vid, []);
          versionMap.get(vid).push(file);
          var ts = Number(file && (file.archivedAt || file.createdAt)) || 0;
          if (!Number.isFinite(ts)) ts = 0;
          var prev = versionMeta.has(vid) ? Number(versionMeta.get(vid) || 0) : 0;
          if (ts > prev) versionMeta.set(vid, ts);
        });
        var orderedVersions = ensureProjectVersionOrder(pid, Array.from(versionMap.keys()), versionMeta);
        var versionsHtml = orderedVersions.map(function(vid) {
          var list = versionMap.get(vid) || [];
          var archivedList = list.filter(function(file) { return file && String(file.status || '') === 'archived'; });
          var activeList = list.filter(function(file) { return file && String(file.status || '') !== 'archived'; });
          var fileMeta = new Map();
          activeList.forEach(function(file) {
            var ts = Number(file && file.createdAt) || 0;
            if (!Number.isFinite(ts)) ts = 0;
            fileMeta.set(String(file.id), ts);
          });
          var orderedActiveIds = ensureProjectVersionFileOrder(pid, vid, activeList.map(function(file) { return String(file.id); }), fileMeta);
          var orderedActiveFiles = orderedActiveIds
            .map(function(id) { return activeFileMap.get(id); })
            .filter(function(file) { return file && String(file.projectId) === pid && String(file.versionId || '') === String(vid || ''); });
          archivedList = archivedList.slice().sort(function(a, b) {
            var ta = Number(a && (a.archivedAt || a.createdAt)) || 0;
            var tb = Number(b && (b.archivedAt || b.createdAt)) || 0;
            if (ta !== tb) return tb - ta;
            return String(a && a.id ? a.id : '').localeCompare(String(b && b.id ? b.id : ''), 'zh-Hans-CN');
          });
          var orderedArchivedFiles = archivedList
            .map(function(file) { return archivedFileMap.get(String(file.id)); })
            .filter(Boolean);
          var orderedFiles = orderedActiveFiles.concat(orderedArchivedFiles);
          var rows = orderedFiles.length
            ? orderedFiles.map(function(file) {
                return renderTempExecItemRow(file, {
                  focusSet: focusSet,
                  activeId: state.tempExecActiveId,
                  showAiDot: true,
                });
              }).join('')
            : '<span class="hint">暂无用例</span>';
          var versionName = resolveVersionName(pid, vid);
          var versionCount = 0;
          orderedFiles.forEach(function(file) { versionCount += Number(getTempExecFileCaseCount(file)) || 0; });
          var versionCountLabel = '（' + versionCount + '条）';
          var archivedCount = orderedArchivedFiles.length;
          var dissolveBtn = archivedCount
            ? '<button type="button" class="archived-dissolve" data-temp-project-version-archived-dissolve="' + escapeHtml(pid + '||' + vid) + '" title="仅清除已归档占位，不影响归档记录">解散归档</button>'
            : '';
          var actionsHtml = '<span class="temp-project-version-actions">' + dissolveBtn + '<span class="remove" title="关闭版本" data-temp-project-version-remove="' + escapeHtml(pid + '||' + vid) + '">×</span></span>';
          return (
            '<div class="temp-project-version" data-temp-project-version-card="' + escapeHtml(pid + '||' + vid) + '">' +
              '<div class="temp-project-version-header" data-temp-project-version-drag="' + escapeHtml(pid + '||' + vid) + '" draggable="true">' +
                '<span class="title-wrap"><span class="title" title="' + escapeHtml(versionName) + '">' + escapeHtml(versionName) + '</span><span class="count">' + escapeHtml(versionCountLabel) + '</span></span>' +
                actionsHtml +
              '</div>' +
              '<div class="temp-project-version-body">' + rows + '</div>' +
            '</div>'
          );
        }).join('');
        var projectName = resolveProjectName(pid);
        return (
          '<div class="temp-project-card" data-temp-project-card="' + escapeHtml(pid) + '">' +
            '<div class="temp-project-header" data-temp-project-drag="' + escapeHtml(pid) + '" draggable="true">' +
              '<span class="title" title="' + escapeHtml(projectName) + '">' + escapeHtml(projectName) + '</span>' +
              '<span class="remove" title="关闭项目" data-temp-project-remove="' + escapeHtml(pid) + '">×</span>' +
            '</div>' +
            '<div class="temp-project-body"><div class="temp-project-versions">' + versionsHtml + '</div></div>' +
          '</div>'
        );
      }).join('');
      tempVersionGrid.innerHTML = filterBlockHtml + html;
      enforceTempFileDraggable(tempVersionGrid);
    }

    function enforceTempFileDraggable(container) {
      if (!container) return;
      var list = container.querySelectorAll('[data-temp-file], [data-temp-file-group]');
      list.forEach(function(element) {
        if (element && element.dataset && String(element.dataset.tempArchived || '') === '1') return;
        if (!element.getAttribute('draggable')) element.setAttribute('draggable', 'true');
      });
    }

    function renderTempFocusZoneWithHint(zone, hintText) {
      if (!zone) return;
      var focusList = (state.tempExecFocus || []).map(function(id) { return getTempExecFile(id); }).filter(Boolean);
      var html = focusList.length
        ? focusList.map(function(file) {
            var aiDot = shouldShowTempExecAiGenFocusBadge(file && file.id ? file.id : '') ? ' case-library-ai-gen-dot' : '';
            return (
              '<button type="button" draggable="true" data-temp-file="' + file.id + '" class="' + (state.tempExecActiveId === file.id ? 'active' : '') + aiDot + '">' +
                '<span class="tag tag-focus">专注</span>' +
                '<span>' + escapeHtml(file && file.name ? file.name : '测试用例') + '（' + getTempExecFileCaseCount(file) + '）</span>' +
                '<span class="remove" title="移出专注区" data-temp-focus-remove="' + file.id + '">×</span>' +
              '</button>'
            );
          }).join('')
        : '<span class="hint">' + escapeHtml(hintText || '') + '</span>';
      zone.innerHTML = html;
      enforceTempFileDraggable(zone);
    }

    function renderTempFocusZone() {
      renderTempFocusZoneWithHint(tempFocusZone, '拖拽用例到此区域，专注处理关键用例');
      renderTempFocusZoneWithHint(tempExecViewFocusZone, '暂无专注用例');
    }

    function renderTempExecNav() {
      if (!tempExecNav) return;
      syncTempSectionToggleButtons();
      var focusSet = new Set(state.tempExecFocus || []);
      if (state.tempExecReqCollapsed) {
        tempExecNav.classList.add('collapsed');
        tempExecNav.innerHTML = '<span class="hint temp-req-empty">需求区已收起，点击“展开需求区”查看</span>';
        if (exportTempExecBtn) exportTempExecBtn.disabled = !state.tempExecActiveId;
        if (exportTempExecConfigBtn) exportTempExecConfigBtn.disabled = !state.tempExecFiles.length;
        if (exportTempExecXmindBtn) exportTempExecXmindBtn.disabled = !state.tempExecActiveId;
        if (exportTempExecCasesXmindBtn) exportTempExecCasesXmindBtn.disabled = !state.tempExecActiveId;
        if (tempExecMindBtn) tempExecMindBtn.disabled = !state.tempExecActiveId;
        renderTempExecOverview();
        renderTempFocusZone();
        return;
      }
      tempExecNav.classList.remove('collapsed');
      var files = (state.tempExecFiles || []).filter(function(file) { return !file.versionId; }).slice().sort(function(a, b) {
        return ((a && a.name) || '').localeCompare((b && b.name) || '', 'zh-Hans-CN');
      });
      var groupMap = new Map();
      files.forEach(function(file) {
        var req = normalizeRequirementName(file && file.requirement) || '未标识需求';
        if (!groupMap.has(req)) groupMap.set(req, []);
        groupMap.get(req).push(file);
      });
      var reqOrderList = ensureRequirementOrder(Array.from(groupMap.keys()));
      var globalOrder = files.slice().sort(function(a, b) {
        return ((a && a.name) || '').localeCompare((b && b.name) || '', 'zh-Hans-CN');
      }).map(function(file) { return file.id; });
      var orderedReqs = reqOrderList.slice();
      var groups = orderedReqs.map(function(req) {
        var list = groupMap.get(req) || [];
        var orderedIds = ensureFileOrder(req, list.map(function(item) { return item.id; }));
        var orderedFiles = list.slice().sort(function(a, b) {
          var ia = orderedIds.indexOf(a.id);
          var ib = orderedIds.indexOf(b.id);
          if (ia !== -1 && ib !== -1 && ia !== ib) return ia - ib;
          var ga = globalOrder.indexOf(a.id);
          var gb = globalOrder.indexOf(b.id);
          if (ga !== -1 && gb !== -1 && ga !== gb) return ga - gb;
          if (ia !== -1 && ib === -1) return -1;
          if (ia === -1 && ib !== -1) return 1;
          if (ga !== -1 && gb === -1) return -1;
          if (ga === -1 && gb !== -1) return 1;
          return sortByCreatedDesc(a, b);
        });
        return { req: req, list: orderedFiles };
      }).filter(function(group) { return group.list.length; });
      var reqOrderMap = new Map();
      orderedReqs.forEach(function(req, index) { reqOrderMap.set(req, index); });
      var reqCreatedMap = new Map();
      groups.forEach(function(group) {
        var times = group.list.map(function(file) { return Number(file && file.createdAt) || 0; }).filter(function(time) { return Number.isFinite(time); });
        reqCreatedMap.set(group.req, times.length ? Math.min.apply(null, times) : 0);
      });
      groups.sort(function(a, b) {
        var ia = reqOrderMap.has(a.req) ? reqOrderMap.get(a.req) : -1;
        var ib = reqOrderMap.has(b.req) ? reqOrderMap.get(b.req) : -1;
        if (ia !== -1 && ib !== -1 && ia !== ib) return ia - ib;
        var ta = reqCreatedMap.has(a.req) ? reqCreatedMap.get(a.req) : 0;
        var tb = reqCreatedMap.has(b.req) ? reqCreatedMap.get(b.req) : 0;
        if (ta !== tb) return ta - tb;
        return a.req.localeCompare(b.req, 'zh-Hans-CN');
      });
      var boxesHtml = groups.length
        ? groups.map(function(group) {
            return (
              '<div class="temp-req-box" data-temp-req="' + group.req + '" data-temp-file-group="' + group.list.map(function(item) { return item.id; }).join(',') + '" draggable="true">' +
                '<div class="temp-req-header"><span class="temp-req-title">' + escapeHtml(group.req) + '</span><span class="temp-req-count">' + group.list.length + ' 份</span></div>' +
                '<div class="temp-req-list">' + group.list.map(function(file) {
                  return renderTempExecItemRow(file, { focusSet: focusSet, activeId: state.tempExecActiveId, showAiDot: true });
                }).join('') + '</div>' +
              '</div>'
            );
          }).join('')
        : '<span class="hint temp-req-empty">暂无未分配的用例，可从版本拖回或继续导入</span>';
      tempExecNav.innerHTML = '<div class="temp-req-grid" data-temp-req-pool="1">' + boxesHtml + '</div>';
      if (exportTempExecBtn) exportTempExecBtn.disabled = !state.tempExecActiveId;
      if (exportTempExecConfigBtn) exportTempExecConfigBtn.disabled = !state.tempExecFiles.length;
      if (exportTempExecXmindBtn) exportTempExecXmindBtn.disabled = !state.tempExecActiveId;
      if (exportTempExecCasesXmindBtn) exportTempExecCasesXmindBtn.disabled = !state.tempExecActiveId;
      if (tempExecXmindViewBtn) {
        var activeFile = getTempExecFile(state.tempExecActiveId);
        var hasCases = Boolean(activeFile && Array.isArray(activeFile.cases) && activeFile.cases.length);
        tempExecXmindViewBtn.disabled = !Boolean(state.tempExecActiveId && hasCases && buildMindDataFromCases);
      }
      if (tempExecMindBtn) tempExecMindBtn.disabled = !state.tempExecActiveId;
      renderTempExecOverview();
      renderTempFocusZone();
      enforceTempFileDraggable(tempExecNav);
    }

    function toggleTempExecRequirementZone() {
      state.tempExecReqCollapsed = !state.tempExecReqCollapsed;
      persistTempExecState();
      renderTempExecNavPort();
    }

    function toggleTempExecVersionZone() {
      state.tempExecVersionCollapsed = !state.tempExecVersionCollapsed;
      persistTempExecState();
      renderTempVersionGridPort();
    }

    function setTempExecImportProjectFilter(projectId) {
      var next = normalizeTempExecImportProjectFilterId(projectId);
      var current = state.tempExecImportProjectFilterId ? String(state.tempExecImportProjectFilterId) : '';
      if (String(current) === String(next)) return;
      state.tempExecImportProjectFilterId = next;
      renderTempVersionGridPort();
      scheduleTempExecUiSave();
    }

    function prioritizeTempExecUnassignedRequirements() {
      var placement = ensureTempExecPlacement();
      var reqs = placement.requirementOrder.slice();
      if (!reqs.length) return;
      var reqHasUnassigned = new Map();
      reqs.forEach(function(req) {
        var has = (state.tempExecFiles || []).some(function(file) {
          var normalized = normalizeRequirementName(file && file.requirement) || '未标识需求';
          return normalized === req && !file.versionId;
        });
        reqHasUnassigned.set(req, has);
      });
      var next = reqs.slice().sort(function(a, b) {
        var hasA = reqHasUnassigned.get(a);
        var hasB = reqHasUnassigned.get(b);
        if (hasA !== hasB) return hasA ? -1 : 1;
        return reqs.indexOf(a) - reqs.indexOf(b);
      });
      placement.requirementOrder = Array.from(new Set(next));
      renderTempExecNavPort();
    }

    return {
      setRenderPorts: setRenderPorts,
      getTempExecFileCaseCount: getTempExecFileCaseCount,
      normalizeTempExecImportProjectFilterId: normalizeTempExecImportProjectFilterId,
      renderTempExecNav: renderTempExecNav,
      renderTempVersionGrid: renderTempVersionGrid,
      renderTempFocusZone: renderTempFocusZone,
      toggleTempExecRequirementZone: toggleTempExecRequirementZone,
      toggleTempExecVersionZone: toggleTempExecVersionZone,
      setTempExecImportProjectFilter: setTempExecImportProjectFilter,
      prioritizeTempExecUnassignedRequirements: prioritizeTempExecUnassignedRequirements,
    };
  }

  return { create: create };
});
