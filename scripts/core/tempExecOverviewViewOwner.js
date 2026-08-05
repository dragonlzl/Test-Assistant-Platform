(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecOverviewViewOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var state = opts.state || {};
    var tempVersionGrid = opts.tempVersionGrid || null;
    var tempExecNav = opts.tempExecNav || null;
    var tempExecOverview = opts.tempExecOverview || null;
    var tempExecToolbar = opts.tempExecToolbar || null;
    var tempExecToolbarCard = opts.tempExecToolbarCard || null;
    var getTempExecFile = port('getTempExecFile', function(fileId) {
      return (state.tempExecFiles || []).find(function(file) { return file && String(file.id) === String(fileId); }) || null;
    });
    var getCaseExecutionStatus = port('getCaseExecutionStatus', function(file, item) { return item && item.actual ? item.actual : '未执行'; });
    var normalizeRequirementName = port('normalizeRequirementName', function(value) { return String(value || '').trim(); });
    var escapeHtml = port('escapeHtml', function(value) { return value === null || value === undefined ? '' : String(value); });
    var isTempExecProjectLayoutEnabled = port('isTempExecProjectLayoutEnabled', function() { return false; });
    var isDbMode = port('isDbMode', function() { return false; });
    var ensureProjectOrder = port('ensureProjectOrder', function(ids) { return ids || []; });
    var ensureProjectVersionOrder = port('ensureProjectVersionOrder', function(projectId, ids) { return ids || []; });
    var ensureProjectVersionFileOrder = port('ensureProjectVersionFileOrder', function(projectId, versionId, ids) { return ids || []; });
    var ensureRequirementOrder = port('ensureRequirementOrder', function(ids) { return ids || []; });
    var ensureFileOrder = port('ensureFileOrder', function(req, ids) { return ids || []; });
    var resolveProjectName = port('resolveProjectName', function(projectId) { return String(projectId || '项目#未知'); });
    var resolveVersionName = port('resolveVersionName', function(projectId, versionId) { return String(versionId || '未分配版本'); });
    var getTempVersionName = port('getTempVersionName', function(versionId) { return String(versionId || ''); });
    var getTempExecFileCaseCount = port('getTempExecFileCaseCount', function(file) { return file && Array.isArray(file.cases) ? file.cases.length : 0; });
    var stashTempExecToolbarButtons = port('stashTempExecToolbarButtons');
    var mountTempExecToolbarButtons = port('mountTempExecToolbarButtons');
    var renderTempExecView = port('renderTempExecView');

    function resolveTempExecState(file) {
      if (!file || !Array.isArray(file.cases)) return 'pending';
      var summary = buildTempExecSummary(file);
      var total = summary.total || 0;
      var completionCount = summary.passed + summary.unspecified;
      var hasFailure = summary.failed > 0 || summary.blocked > 0;
      if (total && completionCount === total && !hasFailure) return 'ok';
      if (hasFailure) return 'err';
      if (summary.executed > 0) return 'running';
      return 'pending';
    }

    function updateTempExecFileStateClass(fileId) {
      if (!fileId) return;
      var file = getTempExecFile(fileId);
      if (!file) return;
      var stateClass = resolveTempExecState(file);
      var known = ['ok', 'err', 'warn', 'running', 'pending'];
      function patchRoot(container) {
        if (!container || !container.querySelectorAll) return;
        var nodes = container.querySelectorAll('.temp-req-row[data-temp-file="' + String(fileId) + '"]');
        Array.prototype.slice.call(nodes || []).forEach(function(node) {
          if (!node || !node.classList) return;
          known.forEach(function(cls) { node.classList.remove(cls); });
          node.classList.add(stateClass);
        });
      }
      patchRoot(tempVersionGrid);
      patchRoot(tempExecNav);
    }

    function buildTempExecSummary(file) {
      var summary = { total: 0, executed: 0, passed: 0, failed: 0, blocked: 0, unspecified: 0, pending: 0 };
      if (!file || !Array.isArray(file.cases)) return summary;
      summary.total = file.cases.length;
      file.cases.forEach(function(item) {
        var status = getCaseExecutionStatus(file, item);
        if (status !== '未执行') summary.executed += 1;
        if (status === '通过') summary.passed += 1;
        else if (status === '失败') summary.failed += 1;
        else if (status === '阻塞') summary.blocked += 1;
        else if (status === '不适用') summary.unspecified += 1;
        else summary.pending += 1;
      });
      return summary;
    }

    function getTempExecOrderedFileIds() {
      var files = Array.isArray(state.tempExecFiles) ? state.tempExecFiles.slice() : [];
      if (!files.length) return [];
      var ordered = [];
      var added = new Set();
      if (isTempExecProjectLayoutEnabled()) {
        var projectMeta = new Map();
        var projectIdSet = new Set();
        var fallbackFiles = [];
        files.forEach(function(file) {
          if (!file) return;
          var pid = file && file.projectId ? String(file.projectId) : '';
          if (!pid) {
            fallbackFiles.push(file);
            return;
          }
          projectIdSet.add(pid);
          var ts = Number(file && file.createdAt) || 0;
          var prev = projectMeta.has(pid) ? Number(projectMeta.get(pid) || 0) : 0;
          if (ts > prev) projectMeta.set(pid, ts);
        });
        var orderedProjects = ensureProjectOrder(Array.from(projectIdSet.values()), projectMeta);
        orderedProjects.forEach(function(pid) {
          var projectFiles = files.filter(function(file) { return file && String(file.projectId || '') === String(pid); });
          if (!projectFiles.length) return;
          var versionMap = new Map();
          var versionMeta = new Map();
          projectFiles.forEach(function(file) {
            var vid = file && file.versionId !== null && file.versionId !== undefined ? String(file.versionId || '') : '';
            if (!versionMap.has(vid)) versionMap.set(vid, []);
            versionMap.get(vid).push(file);
            var ts = Number(file && file.createdAt) || 0;
            var prev = versionMeta.has(vid) ? Number(versionMeta.get(vid) || 0) : 0;
            if (ts > prev) versionMeta.set(vid, ts);
          });
          var orderedVersions = ensureProjectVersionOrder(pid, Array.from(versionMap.keys()), versionMeta);
          orderedVersions.forEach(function(vid) {
            var list = versionMap.get(vid) || [];
            if (!list.length) return;
            var fileMeta = new Map();
            list.forEach(function(file) {
              var fid = file && file.id !== null && file.id !== undefined ? String(file.id) : '';
              if (!fid) return;
              fileMeta.set(fid, Number(file && file.createdAt) || 0);
            });
            var orderedIds = ensureProjectVersionFileOrder(
              pid,
              vid,
              list.map(function(file) { return file && file.id !== null && file.id !== undefined ? String(file.id) : ''; }).filter(Boolean),
              fileMeta
            );
            orderedIds.forEach(function(fid) {
              if (!fid || added.has(fid)) return;
              added.add(fid);
              ordered.push(fid);
            });
          });
        });
        fallbackFiles.slice().sort(function(a, b) {
          var ta = Number(a && a.createdAt) || 0;
          var tb = Number(b && b.createdAt) || 0;
          if (ta !== tb) return tb - ta;
          return String(a && a.name ? a.name : '').localeCompare(String(b && b.name ? b.name : ''), 'zh-Hans-CN');
        }).forEach(function(file) {
          var fid = file && file.id !== null && file.id !== undefined ? String(file.id) : '';
          if (!fid || added.has(fid)) return;
          added.add(fid);
          ordered.push(fid);
        });
      } else {
        var reqMap = new Map();
        files.forEach(function(file) {
          if (!file) return;
          var req = normalizeRequirementName(file && file.requirement) || '未标识需求';
          if (!reqMap.has(req)) reqMap.set(req, []);
          reqMap.get(req).push(file);
        });
        ensureRequirementOrder(Array.from(reqMap.keys())).forEach(function(req) {
          var list = reqMap.get(req) || [];
          ensureFileOrder(req, list.map(function(file) {
            return file && file.id !== null && file.id !== undefined ? String(file.id) : '';
          }).filter(Boolean)).forEach(function(fid) {
            if (!fid || added.has(fid)) return;
            added.add(fid);
            ordered.push(fid);
          });
        });
      }
      files.forEach(function(file) {
        var fid = file && file.id !== null && file.id !== undefined ? String(file.id) : '';
        if (!fid || added.has(fid)) return;
        added.add(fid);
        ordered.push(fid);
      });
      return ordered;
    }

    function renderTempExecToolbar(file) {
      if (!tempExecToolbar || !tempExecToolbarCard) return;
      if (!file) {
        stashTempExecToolbarButtons();
        tempExecToolbar.innerHTML = '';
        tempExecToolbarCard.classList.add('hidden');
        return;
      }
      var summary = buildTempExecSummary(file);
      var statusFilter = state.tempExecStatusFilter || { fileId: '', status: '' };
      var activeFilter = statusFilter.fileId === file.id ? statusFilter.status : '';
      var searchState = state.tempExecSearch || { fileId: '', term: '', raw: '' };
      var searchRaw = searchState.fileId === file.id ? (searchState.raw || '') : '';
      var orderedIds = getTempExecOrderedFileIds();
      var navDisabled = orderedIds.length < 2;
      var navAttr = navDisabled ? ' disabled' : '';
      var navHintPrev = navDisabled ? '暂无可切换用例' : '切换上一份用例';
      var navHintNext = navDisabled ? '暂无可切换用例' : '切换下一份用例';
      var navHtml =
        '<div class="toolbar-nav" role="group" aria-label="切换用例">' +
          '<span class="nav-label">用例切换：</span>' +
          '<button type="button" class="pill secondary nav-btn prev" data-temp-file-nav="prev"' + navAttr + ' title="' + escapeHtml(navHintPrev) + '">上一份</button>' +
          '<button type="button" class="pill primary nav-btn next" data-temp-file-nav="next"' + navAttr + ' title="' + escapeHtml(navHintNext) + '">下一份</button>' +
        '</div>';
      var archiveHtml = '';
      if (isDbMode() && !(file && String(file.status || '') === 'archived')) {
        var disabled = file && file._casesLoading ? ' disabled' : '';
        var tip = file && file._casesLoading ? '用例加载中，稍后再试' : '归档当前用例';
        archiveHtml = '<button type="button" class="pill accent toolbar-archive" data-temp-file-archive="' + escapeHtml(file.id) + '"' + disabled + ' title="' + escapeHtml(tip) + '">归档</button>';
      }
      var actionsHtml =
        '<div class="toolbar-actions">' +
          '<div class="toolbar-block toolbar-search"><input class="temp-search-input" data-temp-search-input="' + file.id + '" value="' + escapeHtml(searchRaw) + '" placeholder="搜索用例关键字"></div>' +
          '<div class="toolbar-block toolbar-middle">' +
            '<div class="toolbar-ai-slot" id="tempExecAiGenSlot"></div>' +
            '<div class="toolbar-xmind-slot" id="tempExecXmindSlot"></div>' +
            '<div class="toolbar-change-slot" id="tempExecCaseLibraryChangeSlot"></div>' +
            navHtml +
            '<div class="toolbar-archive-wrap">' + archiveHtml + '</div>' +
          '</div>' +
          '<div class="toolbar-block toolbar-export" id="tempExecExportSlot"></div>' +
        '</div>';
      var pillsHtml =
        '<div class="toolbar-pills">' +
          '<span class="summary-pill executed ' + (activeFilter === 'executed' ? 'active' : '') + '" data-temp-status-filter="executed" data-temp-status-file="' + file.id + '">已执行 ' + summary.executed + '</span>' +
          '<span class="summary-pill pending ' + (activeFilter === 'pending' ? 'active' : '') + '" data-temp-status-filter="pending" data-temp-status-file="' + file.id + '">未执行 ' + summary.pending + '</span>' +
          '<span class="summary-pill passed ' + (activeFilter === 'passed' ? 'active' : '') + '" data-temp-status-filter="passed" data-temp-status-file="' + file.id + '">通过 ' + summary.passed + '</span>' +
          '<span class="summary-pill failed ' + (activeFilter === 'failed' ? 'active' : '') + '" data-temp-status-filter="failed" data-temp-status-file="' + file.id + '">失败 ' + summary.failed + '</span>' +
          '<span class="summary-pill blocked ' + (activeFilter === 'blocked' ? 'active' : '') + '" data-temp-status-filter="blocked" data-temp-status-file="' + file.id + '">阻塞 ' + summary.blocked + '</span>' +
          '<span class="summary-pill unspecified ' + (activeFilter === 'unspecified' ? 'active' : '') + '" data-temp-status-filter="unspecified" data-temp-status-file="' + file.id + '">不适用 ' + summary.unspecified + '</span>' +
        '</div>';
      tempExecToolbar.innerHTML = [
        '<div class="toolbar-file">当前文件：<strong>' + escapeHtml(file.name) + '</strong></div>',
        pillsHtml,
        actionsHtml,
      ].join('');
      mountTempExecToolbarButtons();
      tempExecToolbarCard.classList.remove('hidden');
    }

    function mapFilterToStatus(matchKey, status) {
      if (matchKey === 'executed') return status !== '未执行';
      if (matchKey === 'pending') return status === '未执行';
      if (matchKey === 'passed') return status === '通过';
      if (matchKey === 'failed') return status === '失败';
      if (matchKey === 'blocked') return status === '阻塞';
      if (matchKey === 'unspecified') return status === '不适用';
      return true;
    }

    function setTempExecStatusFilter(fileId, filterKey) {
      var current = state.tempExecStatusFilter || { fileId: '', status: '' };
      var next = { fileId: '', status: '' };
      if (fileId && filterKey && (current.fileId !== fileId || current.status !== filterKey)) {
        next = { fileId: fileId, status: filterKey };
      }
      state.tempExecStatusFilter = next;
      renderTempExecView();
    }

    function renderTempExecOverview() {
      if (!tempExecOverview) return;
      var isProjectLayout = isTempExecProjectLayoutEnabled();
      var archived = Array.isArray(state.tempExecArchivedFiles) ? state.tempExecArchivedFiles : [];
      var combined = (state.tempExecFiles || []).concat(archived);
      var files = combined.slice().sort(function(a, b) {
        var sa = buildTempExecSummary(a);
        var sb = buildTempExecSummary(b);
        var pa = sa.total ? sa.executed / sa.total : 0;
        var pb = sb.total ? sb.executed / sb.total : 0;
        if (pa === pb) return (a.createdAt || 0) - (b.createdAt || 0);
        return pa - pb;
      });
      if (!files.length) {
        tempExecOverview.innerHTML = '<p class="hint">暂无用例执行数据</p>';
        return;
      }
      var currentFile = getTempExecFile(state.tempExecActiveId);
      var currentBlock = currentFile
        ? '<div class="temp-overview-grid two-cols">' + renderTempExecOverviewEntry(currentFile) + '</div>'
        : '<p class="hint">暂无正在执行的用例</p>';
      if (isProjectLayout) {
        tempExecOverview.innerHTML = '<div class="temp-overview-section temp-overview-current"><h3 class="temp-overview-section-title">当前执行区</h3>' + currentBlock + '</div>' + renderTempExecOverviewProjectLayout(files, currentFile);
        return;
      }
      var versionMap = new Map();
      files.forEach(function(file) {
        var label = getTempVersionName(file.versionId) || '未分配版本';
        if (!versionMap.has(label)) versionMap.set(label, []);
        versionMap.get(label).push(file);
      });
      var versionList = Array.from(versionMap.entries()).map(function(entry) { return { name: entry[0], list: entry[1] }; });
      versionList.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh-Hans-CN'); });
      var versionBlock = versionList
        .filter(function(group) { return group.name !== '未分配版本'; })
        .map(function(group) { return renderTempExecOverviewVersion(group.name, group.list); })
        .join('') || '<p class="hint">暂无分配到版本的用例</p>';
      var unassigned = versionList.find(function(group) { return group.name === '未分配版本'; });
      var unassignedBlock = unassigned ? renderTempExecOverviewUnassigned(unassigned.list) : '<p class="hint">暂无未分配的用例</p>';
      tempExecOverview.innerHTML =
        '<div class="temp-overview-section temp-overview-current"><h3 class="temp-overview-section-title">当前执行区</h3>' + currentBlock + '</div>' +
        '<div class="temp-overview-section"><h3 class="temp-overview-section-title">版本区</h3><div class="temp-overview-version-grid">' + versionBlock + '</div></div>' +
        '<div class="temp-overview-section"><h3 class="temp-overview-section-title">需求区（未分配版本）</h3>' + unassignedBlock + '</div>';
    }

    function renderTempExecOverviewProjectLayout(files, currentFile) {
      var list = Array.isArray(files) ? files : [];
      if (!list.length) return '<div class="temp-overview-section"><h3 class="temp-overview-section-title">项目/版本区</h3><p class="hint">暂无项目执行数据</p></div>';
      var summaryByFileId = new Map();
      var filesByProject = new Map();
      var projectMeta = new Map();
      list.forEach(function(file) {
        if (!file) return;
        var fid = file && file.id !== null && file.id !== undefined ? String(file.id) : '';
        if (!fid) return;
        summaryByFileId.set(fid, buildTempExecSummary(file));
        var pid = file && file.projectId !== null && file.projectId !== undefined ? String(file.projectId) : '';
        if (!pid) pid = 'unknown';
        if (!filesByProject.has(pid)) filesByProject.set(pid, []);
        filesByProject.get(pid).push(file);
        var time = Number(file && file.createdAt ? file.createdAt : 0) || 0;
        if (time > (Number(projectMeta.get(pid) || 0) || 0)) projectMeta.set(pid, time);
      });
      var projectIds = Array.from(filesByProject.keys());
      var orderedProjects = projectIds.slice();
      if (projectIds.length) {
        try {
          var normalized = projectIds.filter(function(pid) { return pid && pid !== 'unknown'; });
          var ordered = ensureProjectOrder(normalized, projectMeta);
          orderedProjects = (ordered || []).concat(projectIds.indexOf('unknown') !== -1 ? ['unknown'] : []);
        } catch (err) {
          orderedProjects.sort(function(a, b) { return String(a).localeCompare(String(b), 'zh-Hans-CN'); });
        }
      }
      var defaultProjectId = state.tempExecOverviewProjectId ? String(state.tempExecOverviewProjectId || '') : '';
      if (!defaultProjectId || !filesByProject.has(defaultProjectId)) {
        var fromCurrent = currentFile && currentFile.projectId ? String(currentFile.projectId) : '';
        defaultProjectId = fromCurrent && filesByProject.has(fromCurrent) ? fromCurrent : (orderedProjects[0] || '');
      }
      state.tempExecOverviewProjectId = defaultProjectId;
      var versionFilter = state.tempExecOverviewVersionId ? String(state.tempExecOverviewVersionId || '') : '';
      var projectCards = renderTempExecOverviewProjectCards(orderedProjects, defaultProjectId);
      var detail = renderTempExecOverviewProjectDetail(defaultProjectId, filesByProject.get(defaultProjectId) || [], summaryByFileId, versionFilter);
      return (
        '<div class="temp-overview-section"><h3 class="temp-overview-section-title">项目区</h3><div class="nav-entry-grid">' + (projectCards || '<p class="hint">暂无项目</p>') + '</div></div>' +
        '<div class="temp-overview-section"><h3 class="temp-overview-section-title">版本区</h3>' + detail + '</div>'
      );
    }

    function renderTempExecOverviewProjectCards(projectIds, activeProjectId) {
      var list = Array.isArray(projectIds) ? projectIds : [];
      if (!list.length) return '';
      var icon = '<span class="nav-entry-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation" focusable="false"><path d="M3 6h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"></path></svg></span>';
      return list.map(function(pid) {
        var name = pid === 'unknown' ? '项目#未知' : resolveProjectName(pid);
        var cls = 'nav-entry-card nav-entry-overview' + (String(pid) === String(activeProjectId) ? ' active' : '');
        return '<button type="button" class="' + cls + '" data-temp-overview-project="' + escapeHtml(pid) + '">' + icon + '<span class="nav-entry-text"><span class="nav-entry-title">' + escapeHtml(name) + '</span><span class="nav-entry-desc">查看版本与执行进度</span></span></button>';
      }).join('');
    }

    function renderTempExecOverviewProjectDetail(projectId, files, summaryByFileId, versionFilter) {
      var pid = projectId === null || projectId === undefined ? '' : String(projectId);
      var list = Array.isArray(files) ? files : [];
      if (!pid || !list.length) return '<p class="hint">暂无执行数据</p>';
      function reorderArchivedToBottom(ids, fileMap) {
        var activeIds = [];
        var archivedIds = [];
        ids.forEach(function(fid) {
          var file = fileMap && fid ? fileMap[fid] : null;
          if (file && String(file.status || '') === 'archived') archivedIds.push(fid);
          else activeIds.push(fid);
        });
        return activeIds.concat(archivedIds);
      }
      var canUsePlacement = pid && pid !== 'unknown';
      var verMap = new Map();
      var unassigned = [];
      list.forEach(function(file) {
        if (!file) return;
        var vid = file && file.versionId !== null && file.versionId !== undefined ? String(file.versionId || '') : '';
        if (!vid) unassigned.push(file);
        else {
          if (!verMap.has(vid)) verMap.set(vid, []);
          verMap.get(vid).push(file);
        }
      });
      var versionIds = Array.from(verMap.keys());
      var versionMeta = new Map();
      versionIds.forEach(function(vid) {
        var max = 0;
        (verMap.get(vid) || []).forEach(function(file) {
          var time = Number(file && file.createdAt ? file.createdAt : 0) || 0;
          if (time > max) max = time;
        });
        versionMeta.set(vid, max);
      });
      var orderedVersions;
      try {
        orderedVersions = canUsePlacement ? (ensureProjectVersionOrder(pid, versionIds, versionMeta) || []) : versionIds.slice();
      } catch (err) {
        orderedVersions = versionIds.slice();
      }
      if (!canUsePlacement) orderedVersions.sort(function(a, b) { return String(a).localeCompare(String(b), 'zh-Hans-CN'); });
      var filterVid = versionFilter ? String(versionFilter) : '';
      if (filterVid && orderedVersions.indexOf(filterVid) === -1) filterVid = '';
      var selectHtml = '';
      if (orderedVersions.length) {
        var optionHtml = ['<option value=""' + (filterVid ? '' : ' selected') + '>全部版本</option>'];
        orderedVersions.forEach(function(vid) {
          var name = pid === 'unknown' ? ('版本#' + String(vid)) : resolveVersionName(pid, vid);
          var selected = filterVid && String(vid) === String(filterVid) ? ' selected' : '';
          optionHtml.push('<option value="' + escapeHtml(vid) + '"' + selected + '>' + escapeHtml(name) + '</option>');
        });
        selectHtml = '<div class="exec-overview-detail-head" style="margin:0 0 12px;"><h3 style="margin:0;font-size:16px;">' + escapeHtml(pid === 'unknown' ? '项目#未知' : resolveProjectName(pid)) + '</h3><label class="inline">版本 <select data-temp-overview-version-select="1">' + optionHtml.join('') + '</select></label></div>';
      }
      var totals = { total: 0, pending: 0, passed: 0, failed: 0, blocked: 0, na: 0 };
      list.forEach(function(file) {
        if (!file) return;
        var fid = file && file.id !== null && file.id !== undefined ? String(file.id) : '';
        var summary = summaryByFileId && typeof summaryByFileId.get === 'function' ? summaryByFileId.get(fid) : null;
        if (!summary) summary = buildTempExecSummary(file);
        totals.total += Number(summary.total) || 0;
        totals.pending += Number(summary.pending) || 0;
        totals.passed += Number(summary.passed) || 0;
        totals.failed += Number(summary.failed) || 0;
        totals.blocked += Number(summary.blocked) || 0;
        totals.na += Number(summary.unspecified) || 0;
      });
      var versionBoxes = [];
      orderedVersions.forEach(function(vid) {
        if (filterVid && String(vid) !== String(filterVid)) return;
        var filesIn = verMap.get(vid) || [];
        var fileIds = filesIn.map(function(file) { return file && file.id !== null && file.id !== undefined ? String(file.id) : ''; }).filter(Boolean);
        var fileMeta = new Map();
        var byId = {};
        filesIn.forEach(function(file) {
          var fid = file && file.id !== null && file.id !== undefined ? String(file.id) : '';
          if (!fid) return;
          fileMeta.set(fid, Number(file && file.createdAt ? file.createdAt : 0) || 0);
          byId[fid] = file;
        });
        var orderedFileIds;
        try {
          orderedFileIds = canUsePlacement ? (ensureProjectVersionFileOrder(pid, vid, fileIds, fileMeta) || []) : fileIds.slice();
        } catch (err) {
          orderedFileIds = fileIds.slice();
        }
        if (!canUsePlacement) orderedFileIds.sort(function(a, b) {
          var ta = Number(fileMeta.get(a) || 0) || 0;
          var tb = Number(fileMeta.get(b) || 0) || 0;
          return ta !== tb ? tb - ta : String(a).localeCompare(String(b), 'zh-Hans-CN');
        });
        orderedFileIds = reorderArchivedToBottom(orderedFileIds, byId);
        var versionCount = 0;
        var chips = orderedFileIds.map(function(fid) {
          var file = byId[fid];
          if (!file) return '';
          var summary = summaryByFileId && typeof summaryByFileId.get === 'function' ? summaryByFileId.get(fid) : null;
          if (!summary) summary = buildTempExecSummary(file);
          versionCount += Number(summary.total) || getTempExecFileCaseCount(file);
          return renderTempExecOverviewExecSetChip(file, summary);
        }).join('');
        var versionName = pid === 'unknown' ? ('版本#' + String(vid)) : resolveVersionName(pid, vid);
        versionBoxes.push('<div class="exec-overview-version-box"><div class="head"><span class="title" title="' + escapeHtml(versionName) + '">' + escapeHtml(versionName) + '</span><span class="count">' + escapeHtml('（' + versionCount + '条）') + '</span></div><div class="body">' + (chips || '<span class="hint">暂无用例</span>') + '</div></div>');
      });
      if (!filterVid && unassigned.length) {
        var unassignedSorted = unassigned.slice().sort(function(a, b) { return Number(b && b.createdAt ? b.createdAt : 0) - Number(a && a.createdAt ? a.createdAt : 0); });
        var unassignedMap = {};
        unassignedSorted.forEach(function(file) {
          var fid = file && file.id !== null && file.id !== undefined ? String(file.id) : '';
          if (fid) unassignedMap[fid] = file;
        });
        var unassignedIds = reorderArchivedToBottom(unassignedSorted.map(function(file) { return String(file.id || ''); }).filter(Boolean), unassignedMap);
        var unassignedCount = 0;
        var chips2 = unassignedIds.map(function(fid) {
          var file = unassignedMap[fid];
          if (!file) return '';
          var summary = summaryByFileId && typeof summaryByFileId.get === 'function' ? summaryByFileId.get(fid) : null;
          if (!summary) summary = buildTempExecSummary(file);
          unassignedCount += Number(summary.total) || getTempExecFileCaseCount(file);
          return renderTempExecOverviewExecSetChip(file, summary);
        }).join('');
        versionBoxes.push('<div class="exec-overview-version-box"><div class="head"><span class="title" title="未分配版本">未分配版本</span><span class="count">' + escapeHtml('（' + unassignedCount + '条）') + '</span></div><div class="body">' + (chips2 || '<span class="hint">暂无用例</span>') + '</div></div>');
      }
      var metaLine = '<div class="meta"><span>总数 ' + totals.total + '</span><span>待执行 ' + totals.pending + '</span><span>通过 ' + totals.passed + '</span><span>失败 ' + totals.failed + '</span><span>阻塞 ' + totals.blocked + '</span><span>不适用 ' + totals.na + '</span></div>';
      var detail = '<div class="exec-overview-user-grid layout-mode"><div class="exec-overview-user-card"><div class="head"><div class="name">个人总览</div></div>' + metaLine + '<div class="exec-overview-layout">' + versionBoxes.join('') + '</div></div></div>';
      return selectHtml + detail;
    }

    function renderTempExecOverviewExecSetChip(file, summary) {
      var safe = function(number) { return Math.max(0, Number(number) || 0); };
      var total = safe(summary && summary.total);
      var pending = safe(summary && summary.pending);
      var passed = safe(summary && summary.passed);
      var failed = safe(summary && summary.failed);
      var blocked = safe(summary && summary.blocked);
      var na = safe(summary && summary.unspecified);
      if (!total) {
        var fallbackTotal = getTempExecFileCaseCount(file);
        if (fallbackTotal > 0) {
          total = fallbackTotal;
          pending = fallbackTotal;
          passed = 0;
          failed = 0;
          blocked = 0;
          na = 0;
        }
      }
      var executed = Math.max(0, total - pending);
      var done = passed + na;
      var pct = total ? Math.round((done / total) * 100) : 0;
      var statusText = '未执行';
      var statusCls = 'pending';
      if (total > 0 && (failed > 0 || blocked > 0)) {
        statusText = failed > 0 && blocked > 0 ? '失败/阻塞' : (failed > 0 ? '失败' : '阻塞');
        statusCls = 'err';
      } else if (total > 0 && pending === 0) {
        statusText = '已完成';
        statusCls = 'ok';
      } else if (executed > 0) {
        statusText = '进行中';
        statusCls = 'running';
      }
      function findFirstIndex(key) {
        if (!file || !Array.isArray(file.cases)) return -1;
        for (var i = 0; i < file.cases.length; i += 1) {
          if (mapFilterToStatus(key, getCaseExecutionStatus(file, file.cases[i]))) return i;
        }
        return -1;
      }
      var segments = [
        { key: 'passed', className: 'status-passed', count: passed },
        { key: 'failed', className: 'status-failed', count: failed },
        { key: 'blocked', className: 'status-blocked', count: blocked },
        { key: 'unspecified', className: 'status-unspecified', count: na },
        { key: 'pending', className: 'status-pending', count: pending },
      ].filter(function(segment) { return segment && segment.count > 0; });
      var barHtml = segments.length ? segments.map(function(segment) {
        return '<div class="temp-overview-segment ' + segment.className + '" style="flex:' + segment.count + ';" data-temp-overview-file="' + escapeHtml(file.id) + '" data-temp-overview-status="' + escapeHtml(segment.key) + '" data-temp-overview-index="' + String(findFirstIndex(segment.key)) + '"><span>' + String(segment.count) + '</span></div>';
      }).join('') : '<div class="temp-overview-segment status-pending" style="flex:1;"><span>0</span></div>';
      var progress = '<div class="exec-overview-file-progress" title="执行进度 ' + pct + '%（' + done + '/' + total + '）"><div class="temp-overview-bar">' + barHtml + '</div><div class="label">' + pct + '%</div></div>';
      var kvs = [
        '<span class="exec-overview-kv kv-done">已' + executed + '/' + total + '</span>',
        '<span class="exec-overview-kv kv-pending">待' + pending + '</span>',
        '<span class="exec-overview-kv kv-passed">过' + passed + '</span>',
        '<span class="exec-overview-kv kv-failed">失' + failed + '</span>',
        '<span class="exec-overview-kv kv-blocked">阻' + blocked + '</span>',
        na > 0 ? '<span class="exec-overview-kv kv-na">NA' + na + '</span>' : '',
      ].filter(Boolean);
      var meta = '<div class="exec-overview-file-meta"><span class="exec-overview-file-status status-' + statusCls + '">' + escapeHtml(statusText) + '</span><span class="exec-overview-file-counts" title="' + escapeHtml(kvs.join(' ')) + '">' + kvs.join('') + '</span></div>';
      var label = file && file.name ? String(file.name) : '测试用例';
      var isArchived = file && String(file.status || '') === 'archived';
      var archiveTag = isArchived ? '<span class="tag tag-archived">归</span>' : '';
      var archiveAction = '';
      if (!isArchived && isDbMode()) {
        var execSetId = file && (file.execSetId || file.id) ? String(file.execSetId || file.id) : '';
        if (execSetId) archiveAction = '<span class="exec-overview-chip-action" data-temp-overview-archive="' + escapeHtml(execSetId) + '" title="归档该份用例">归档</span>';
      }
      return '<button type="button" class="exec-overview-file-chip state-' + statusCls + '" data-temp-file="' + escapeHtml(file.id) + '"' + (isArchived ? ' data-temp-archived="1"' : '') + '><div class="row">' + archiveTag + '<span class="text" title="' + escapeHtml(label) + '">' + escapeHtml(label) + '</span>' + archiveAction + '<span class="badge">' + total + '</span></div>' + progress + meta + '</button>';
    }

    function renderTempExecOverviewVersion(label, list) {
      var versionCount = 0;
      list.forEach(function(file) {
        var total = Number(buildTempExecSummary(file).total) || 0;
        versionCount += total || getTempExecFileCaseCount(file);
      });
      var reqMap = new Map();
      list.forEach(function(file) {
        var req = normalizeRequirementName(file && file.requirement) || '未标识需求';
        if (!reqMap.has(req)) reqMap.set(req, []);
        reqMap.get(req).push(file);
      });
      var reqBlocks = Array.from(reqMap.entries()).map(function(entry) {
        var sorted = entry[1].slice().sort(function(a, b) {
          var sa = buildTempExecSummary(a);
          var sb = buildTempExecSummary(b);
          var pa = sa.total ? sa.executed / sa.total : 0;
          var pb = sb.total ? sb.executed / sb.total : 0;
          return pa === pb ? (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN') : pa - pb;
        });
        return '<div class="temp-overview-req"><div class="temp-overview-req-title">' + escapeHtml(entry[0]) + '</div><div class="temp-overview-grid two-cols">' + sorted.map(renderTempExecOverviewEntry).join('') + '</div></div>';
      }).join('');
      return '<div class="temp-overview-version"><div class="temp-overview-version-header">' + escapeHtml(label) + '<span class="count">' + escapeHtml('（' + versionCount + '条）') + '</span></div>' + (reqBlocks || '<p class="hint">暂无用例</p>') + '</div>';
    }

    function renderTempExecOverviewUnassigned(list) {
      var sorted = list.slice().sort(function(a, b) {
        var sa = buildTempExecSummary(a);
        var sb = buildTempExecSummary(b);
        var pa = sa.total ? sa.executed / sa.total : 0;
        var pb = sb.total ? sb.executed / sb.total : 0;
        return pa === pb ? (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN') : pa - pb;
      });
      return '<div class="temp-overview-grid four-cols">' + sorted.map(renderTempExecOverviewEntry).join('') + '</div>';
    }

    function renderTempExecOverviewEntry(file) {
      var summary = buildTempExecSummary(file);
      var total = summary.total || 0;
      var completionCount = summary.passed + summary.unspecified;
      var executedPercent = total ? Math.round((completionCount / total) * 100) : 0;
      var segments = [
        { key: 'passed', label: '通过', count: summary.passed, className: 'status-passed' },
        { key: 'failed', label: '失败', count: summary.failed, className: 'status-failed' },
        { key: 'blocked', label: '阻塞', count: summary.blocked, className: 'status-blocked' },
        { key: 'unspecified', label: '不适用', count: summary.unspecified, className: 'status-unspecified' },
        { key: 'pending', label: '未执行', count: summary.pending, className: 'status-pending' },
      ];
      function findFirstIndex(key) {
        if (!file || !Array.isArray(file.cases)) return -1;
        for (var i = 0; i < file.cases.length; i += 1) {
          if (mapFilterToStatus(key, getCaseExecutionStatus(file, file.cases[i]))) return i;
        }
        return -1;
      }
      var segmentHtml = total ? segments.filter(function(segment) { return segment.count > 0; }).map(function(segment) {
        return '<div class="temp-overview-segment ' + segment.className + '" style="flex:' + segment.count + ';" data-temp-overview-file="' + file.id + '" data-temp-overview-status="' + segment.key + '" data-temp-overview-index="' + findFirstIndex(segment.key) + '"><span>' + segment.count + '</span></div>';
      }).join('') : '<div class="temp-overview-segment status-pending" style="flex:1;"><span>0</span></div>';
      var metaHtml = segments.map(function(segment) {
        return '<span><span class="dot ' + segment.className.replace('status-', '') + '"></span>' + segment.label + ' ' + segment.count + '</span>';
      }).join('');
      var tags = [];
      if (file && String(file.status || '') === 'archived') tags.push('<span class="tag tag-archived">归</span>');
      if ((state.tempExecFocus || []).indexOf(file.id) !== -1) tags.push('<span class="tag tag-focus">专注</span>');
      var archiveBtn = '';
      if (isDbMode() && !(file && String(file.status || '') === 'archived')) {
        var execSetId = file && (file.execSetId || file.id) ? String(file.execSetId || file.id) : '';
        if (execSetId) {
          var disabled = file && file._casesLoading ? ' disabled' : '';
          var tip = file && file._casesLoading ? '用例加载中，稍后再试' : '归档该份用例';
          archiveBtn = '<button type="button" class="pill secondary tiny" data-temp-overview-archive="' + escapeHtml(execSetId) + '"' + disabled + ' title="' + escapeHtml(tip) + '">归档</button>';
        }
      }
      return (
        '<div class="temp-overview-entry" data-temp-file="' + file.id + '"' + (file && String(file.status || '') === 'archived' ? ' data-temp-archived="1"' : '') + '>' +
          '<div class="temp-overview-header"><span>' + tags.join(' ') + ' ' + escapeHtml(file && file.name ? file.name : '测试用例') + '</span>' +
            '<span class="temp-overview-actions">' + archiveBtn + '<span class="temp-overview-rate">执行进度 ' + executedPercent + '%（' + completionCount + '/' + summary.total + '）</span></span>' +
          '</div>' +
          '<div class="temp-overview-bar">' + segmentHtml + '</div><div class="temp-overview-meta">' + metaHtml + '</div>' +
        '</div>'
      );
    }

    return {
      resolveTempExecState: resolveTempExecState,
      updateTempExecFileStateClass: updateTempExecFileStateClass,
      buildTempExecSummary: buildTempExecSummary,
      getTempExecOrderedFileIds: getTempExecOrderedFileIds,
      renderTempExecToolbar: renderTempExecToolbar,
      mapFilterToStatus: mapFilterToStatus,
      setTempExecStatusFilter: setTempExecStatusFilter,
      renderTempExecOverview: renderTempExecOverview,
    };
  }

  return { create: create };
});
