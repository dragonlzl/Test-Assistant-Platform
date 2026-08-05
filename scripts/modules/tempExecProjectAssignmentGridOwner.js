(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.tempExecProjectAssignmentGridOwner = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var window = opts.window || (typeof globalThis !== 'undefined' ? globalThis : {});
    var document = opts.document || (window && window.document ? window.document : null);
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var api = opts.api && typeof opts.api === 'object' ? opts.api : {};
    var tempVersionGrid = opts.gridElement || null;
    var tempExecStatus = opts.statusElement || null;
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var normalizeRequirementName = typeof opts.normalizeRequirementName === 'function'
      ? opts.normalizeRequirementName
      : function(value) { return value || ''; };
    var resolveTempExecActiveDrawer = typeof opts.resolveActiveDrawer === 'function'
      ? opts.resolveActiveDrawer
      : function() { return null; };
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function'
      ? opts.openConfirmDrawer
      : function() { return Promise.resolve({ ok: false }); };
    var safeLogOperation = typeof opts.safeLogOperation === 'function' ? opts.safeLogOperation : function() {};
    var showTempExecView = typeof opts.showView === 'function' ? opts.showView : function() {};
    var setTempDragContext = typeof opts.setDragContext === 'function' ? opts.setDragContext : function() {};
    var getTempDragContext = typeof opts.getDragContext === 'function' ? opts.getDragContext : function() { return null; };
    var showTempExecDragBlockHint = typeof opts.showDragBlockHint === 'function'
      ? opts.showDragBlockHint
      : function() {};
    var bound = false;

    function parseProjectVersionKey(raw) {
      var text = String(raw || '');
      var parts = text.split('||');
      if (parts.length < 2) return { projectId: '', versionId: '' };
      return { projectId: parts[0] || '', versionId: parts.slice(1).join('||') || '' };
    }

    function getProjectFiles(projectId) {
      var pid = String(projectId || '');
      var list = Array.isArray(state.tempExecFiles) ? state.tempExecFiles : [];
      return list.filter(function(file) { return file && String(file.projectId || '') === pid; });
    }

    function getProjectVersionFiles(projectId, versionId) {
      var pid = String(projectId || '');
      var vid = String(versionId || '');
      var list = Array.isArray(state.tempExecFiles) ? state.tempExecFiles : [];
      return list.filter(function(file) {
        if (!file) return false;
        if (String(file.projectId || '') !== pid) return false;
        return String(file.versionId || '') === vid;
      });
    }

    function resolveInsertBeforeFileId(containerEl, clientY) {
      if (!containerEl || !containerEl.querySelectorAll) return '';
      var rows = Array.prototype.slice.call(containerEl.querySelectorAll('.temp-req-row[data-temp-file]'));
      if (!rows.length) return '';
      var target = '';
      rows.some(function(row) {
        if (!row || !row.getBoundingClientRect) return false;
        // 已归档占位固定在底部：插入点/高亮应忽略归档行，避免出现“可插到归档下方”的误导。
        if (row.dataset && String(row.dataset.tempArchived || '') === '1') return false;
        var rect = row.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
          target = row.dataset.tempFile || '';
          return true;
        }
        return false;
      });
      return target;
    }

    function resolveProjectLabel(projectId) {
      var pid = String(projectId || '');
      if (!pid) return '项目#未知';
      var list = Array.isArray(state.projects) ? state.projects : [];
      var found = list.find(function(p) { return p && String(p.id) === pid; });
      var name = found && found.name ? String(found.name) : '';
      return name.trim() || ('项目#' + pid);
    }

    function resolveVersionLabel(projectId, versionId) {
      var pid = String(projectId || '');
      var vid = String(versionId || '');
      if (!vid) return '全部版本';
      var byProject = state.projectVersionsByProject && typeof state.projectVersionsByProject === 'object'
        ? state.projectVersionsByProject
        : {};
      var list = pid && Array.isArray(byProject[pid]) ? byProject[pid] : [];
      var found = list.find(function(v) { return v && String(v.id) === vid; });
      var name = found && found.name ? String(found.name) : '';
      return name.trim() || ('版本#' + vid);
    }

    function init() {
      if (bound || !tempVersionGrid) return false;
      bound = true;
      if (tempVersionGrid) {
        var tempProjectLayoutDropIndicator = null;
        var tempProjectLayoutDrag = { type: '', key: '' };
        var tempProjectLayoutFileHover = { body: null, hoverId: '' };
        var tempProjectLayoutFileDropIndicator = null;
        function ensureTempProjectLayoutDropIndicator(type) {
          if (!tempProjectLayoutDropIndicator) {
            tempProjectLayoutDropIndicator = document.createElement('div');
            tempProjectLayoutDropIndicator.className = 'temp-drop-indicator';
            tempProjectLayoutDropIndicator.setAttribute('aria-hidden', 'true');
        }
        var t = type || '';
        tempProjectLayoutDropIndicator.classList.toggle('project', t === 'project');
        tempProjectLayoutDropIndicator.classList.toggle('version', t === 'version');
        tempProjectLayoutDropIndicator.dataset.dropType = t;
        return tempProjectLayoutDropIndicator;
      }
        function clearTempProjectLayoutDropIndicator() {
          if (tempProjectLayoutDropIndicator && tempProjectLayoutDropIndicator.parentNode) {
            tempProjectLayoutDropIndicator.parentNode.removeChild(tempProjectLayoutDropIndicator);
          }
          if (tempProjectLayoutDropIndicator) {
            tempProjectLayoutDropIndicator.dataset.dropType = '';
            tempProjectLayoutDropIndicator.dataset.dropTargetId = '';
            tempProjectLayoutDropIndicator.dataset.dropAfter = '';
            tempProjectLayoutDropIndicator.dataset.dropProjectId = '';
          }
        }

        function clearTempProjectLayoutFileHover() {
          var body = tempProjectLayoutFileHover && tempProjectLayoutFileHover.body ? tempProjectLayoutFileHover.body : null;
          if (body && body.classList) body.classList.remove('dragover-file');
          if (body && body.querySelectorAll) {
            var rows = body.querySelectorAll('.temp-req-row.dragover-target');
            rows.forEach(function(el) { el.classList.remove('dragover-target'); });
          }
          if (tempProjectLayoutFileDropIndicator && tempProjectLayoutFileDropIndicator.parentNode) {
            tempProjectLayoutFileDropIndicator.parentNode.removeChild(tempProjectLayoutFileDropIndicator);
          }
          tempProjectLayoutFileHover = { body: null, hoverId: '' };
        }

        function ensureTempProjectLayoutFileDropIndicator() {
          if (tempProjectLayoutFileDropIndicator) return tempProjectLayoutFileDropIndicator;
          tempProjectLayoutFileDropIndicator = document.createElement('div');
          tempProjectLayoutFileDropIndicator.className = 'temp-file-drop-indicator';
          tempProjectLayoutFileDropIndicator.setAttribute('aria-hidden', 'true');
          return tempProjectLayoutFileDropIndicator;
        }

        function autoScrollContainerOnDrag(container, clientY) {
          if (!container || !container.getBoundingClientRect) return;
          if (container.scrollHeight <= container.clientHeight) return;
          var rect = container.getBoundingClientRect();
          var threshold = 26;
          var step = 18;
          if (clientY < rect.top + threshold) {
            container.scrollTop = Math.max(0, container.scrollTop - step);
          } else if (clientY > rect.bottom - threshold) {
            var maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
            container.scrollTop = Math.min(maxTop, container.scrollTop + step);
          }
        }
      function getDropAfterByPointer(e, rect, prefer) {
        if (!e || !rect) return false;
        var mode = prefer || 'auto';
        if (mode === 'x') {
          return e.clientX > (rect.left + rect.width / 2);
        }
        if (mode === 'y') {
          return e.clientY > (rect.top + rect.height / 2);
        }
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dx = (e.clientX - cx) / Math.max(1, rect.width);
        var dy = (e.clientY - cy) / Math.max(1, rect.height);
        if (Math.abs(dx) >= Math.abs(dy)) return dx > 0;
        return dy > 0;
      }
      function getDropAfterByPointerAny(e, rect) {
        if (!e || !rect) return false;
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        return e.clientX > cx || e.clientY > cy;
      }
      function findCardUnderPointer(cards, x, y) {
        var list = Array.isArray(cards) ? cards : [];
        for (var i = 0; i < list.length; i += 1) {
          var el = list[i];
          if (!el || !el.getBoundingClientRect) continue;
          var rect = el.getBoundingClientRect();
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return el;
        }
        return null;
      }
      function trySetDragImage(e, el) {
        if (!e || !e.dataTransfer || !el || !el.getBoundingClientRect) return;
        try {
          var rect = el.getBoundingClientRect();
          var x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
          var y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
          if (typeof e.dataTransfer.setDragImage === 'function') {
            e.dataTransfer.setDragImage(el, x, y);
          }
        } catch (err) {}
      }

      tempVersionGrid.addEventListener('click', function(e) {
        var filterBtn = e.target.closest('[data-tempexec-import-project-filter]');
        if (filterBtn && api.setTempExecImportProjectFilter) {
          var filterPid = filterBtn.dataset.tempexecImportProjectFilter || '';
          api.setTempExecImportProjectFilter(filterPid);
          return;
        }
        var archivedDissolveBtn = e.target.closest('[data-temp-project-version-archived-dissolve]');
        if (archivedDissolveBtn && api.dissolveTempExecArchivedProjectVersion) {
          var key0 = archivedDissolveBtn.dataset.tempProjectVersionArchivedDissolve || '';
          var parsed0 = parseProjectVersionKey(key0);
          var versionLabel0 = resolveVersionLabel(parsed0.projectId, parsed0.versionId);
          var archivedList0 = Array.isArray(state.tempExecArchivedFiles)
            ? state.tempExecArchivedFiles.filter(function(f) {
                if (!f) return false;
                return String(f.projectId) === String(parsed0.projectId) && String(f.versionId || '') === String(parsed0.versionId || '');
              })
            : 0;
          var archivedCount0 = Array.isArray(archivedList0) ? archivedList0.length : 0;
          var archivedNames0 = Array.isArray(archivedList0)
            ? archivedList0.map(function(f) {
                if (!f) return '';
                return String(f.name || f.fileName || f.caseFileName || '').trim();
              }).filter(Boolean)
            : [];
          var archivedLabel0 = archivedNames0.length ? archivedNames0.join(' 、') : '暂无';
          var dissolveMsg = '确定解散版本【' + versionLabel0 + '】吗？版本包括待解散用例 ' + archivedLabel0;
          var prevDrawer = resolveTempExecActiveDrawer();
          openConfirmDrawer({
            title: '确认解散归档',
            message: dissolveMsg,
            confirmText: '确认解散',
            cancelText: '取消',
            previousDrawer: prevDrawer || null,
          }).then(function(res) {
            if (!res || res.ok !== true) return;
              safeLogOperation(
                'dissolve_exec_archived_placeholders',
                'project_version',
                parsed0.versionId ? Number(parsed0.versionId) : null,
                {
                  project_id: parsed0.projectId ? Number(parsed0.projectId) : null,
                  project_name: resolveProjectLabel(parsed0.projectId),
                  version_id: parsed0.versionId ? Number(parsed0.versionId) : null,
                  version_name: versionLabel0,
                  count: archivedCount0,
                  before_count: archivedCount0,
                  after_count: 0,
                  file_name: archivedNames0.length === 1 ? archivedNames0[0] : null,
                  file_names: archivedNames0,
                }
              );
            api.dissolveTempExecArchivedProjectVersion(parsed0.projectId, parsed0.versionId);
          });
          return;
        }
        var projectRemoveBtn = e.target.closest('[data-temp-project-remove]');
        if (projectRemoveBtn && api.removeTempExecProject) {
          var pid = projectRemoveBtn.dataset.tempProjectRemove || '';
          var projectFiles = getProjectFiles(pid);
          var projectLabel = resolveProjectLabel(pid);
          var prevDrawerProject = resolveTempExecActiveDrawer();
          openConfirmDrawer({
            title: '确认关闭项目',
            message: '是否确认关闭项目【' + projectLabel + '】（' + projectFiles.length + ' 份用例）？',
            confirmText: '确认关闭',
            cancelText: '取消',
            previousDrawer: prevDrawerProject || null,
          }).then(function(res) {
            if (!res || res.ok !== true) return;
            api.removeTempExecProject(pid);
          });
          return;
        }
        var versionRemoveBtn = e.target.closest('[data-temp-project-version-remove]');
        if (versionRemoveBtn && api.removeTempExecProjectVersion) {
          var key = versionRemoveBtn.dataset.tempProjectVersionRemove || '';
          var parsed = parseProjectVersionKey(key);
          var versionFiles = getProjectVersionFiles(parsed.projectId, parsed.versionId);
          var archivedInVersion = Array.isArray(state.tempExecArchivedFiles)
            ? state.tempExecArchivedFiles.filter(function(f) {
                if (!f) return false;
                return String(f.projectId) === String(parsed.projectId) && String(f.versionId || '') === String(parsed.versionId || '');
              })
            : [];
          var archivedCount = archivedInVersion.length;
          var versionLabel = resolveVersionLabel(parsed.projectId, parsed.versionId);
          var archivedNames = Array.isArray(archivedInVersion)
            ? archivedInVersion.map(function(f) {
                if (!f) return '';
                return String(f.name || f.fileName || f.caseFileName || '').trim();
              }).filter(Boolean)
            : [];
          var archivedLabel = archivedNames.length ? archivedNames.join(' 、') : '暂无';
          var closeMsg = '确定关闭版本【' + versionLabel + '】吗？';
          if (archivedCount) {
            closeMsg += '版本包括待解散用例 ' + archivedLabel + '。';
          }
          closeMsg += '确认后将关闭该版本（' + versionFiles.length + ' 份用例）。';
          var prevDrawer2 = resolveTempExecActiveDrawer();
          openConfirmDrawer({
            title: '确认关闭版本',
            message: closeMsg,
            confirmText: '确认关闭',
            cancelText: '取消',
            previousDrawer: prevDrawer2 || null,
          }).then(function(res) {
            if (!res || res.ok !== true) return;
            if (archivedCount && api.dissolveTempExecArchivedProjectVersion) {
              safeLogOperation(
                'dissolve_exec_archived_placeholders',
                'project_version',
                parsed.versionId ? Number(parsed.versionId) : null,
                {
                  project_id: parsed.projectId ? Number(parsed.projectId) : null,
                  project_name: resolveProjectLabel(parsed.projectId),
                  version_id: parsed.versionId ? Number(parsed.versionId) : null,
                  version_name: versionLabel,
                  count: archivedCount,
                  before_count: archivedCount,
                  after_count: 0,
                  file_name: archivedNames.length === 1 ? archivedNames[0] : null,
                  file_names: archivedNames,
                }
              );
              api.dissolveTempExecArchivedProjectVersion(parsed.projectId, parsed.versionId);
              if (window.app && window.app.utils && typeof window.app.utils.showCenterToast === 'function') {
                var toastLabel = archivedNames.length ? archivedNames.join(' 、') : ('共 ' + archivedCount + ' 份');
                window.app.utils.showCenterToast('已解散归档用例：' + toastLabel, 'ok', 3000);
              }
            }
            api.removeTempExecProjectVersion(parsed.projectId, parsed.versionId);
          });
          return;
        }
        var fileRemoveBtn = e.target.closest('[data-temp-remove]');
        if (fileRemoveBtn && api.removeTempExecFile) {
          e.preventDefault();
          e.stopPropagation();
          var fileId = fileRemoveBtn.dataset.tempRemove;
          var targetFile = api.getTempExecFile ? api.getTempExecFile(fileId) : null;
          if (!targetFile) return;
          var name = targetFile.name ? String(targetFile.name) : '测试用例';
          var prevDrawer3 = resolveTempExecActiveDrawer();
          openConfirmDrawer({
            title: '删除用例',
            message: '确定要删除【' + name + '】吗？此操作不可撤销。',
            confirmText: '确认删除',
            cancelText: '取消',
            previousDrawer: prevDrawer3 || null,
          }).then(function(res) {
            if (!res || res.ok !== true) return;
            api.removeTempExecFile(fileId);
          });
          return;
        }
        // 支持点击整行（含条数徽标/标签），不仅限于按钮本体
        var fileNode = e.target.closest('[data-temp-file]');
        if (!fileNode) return;
        if (fileNode.dataset && fileNode.dataset.tempArchived) {
          setStatus(tempExecStatus, '该用例已归档（仅占位，不影响同名导入/转入执行）；如需查看详情请到“用例归档”页。', 'warn');
          return;
        }
        var id = fileNode.dataset.tempFile;
        if (!id) return;
        if (api.getTempExecFile && !api.getTempExecFile(id)) return;
        if (id !== state.tempExecActiveId && api.setTempExecActive) api.setTempExecActive(id);
        // 项目/版本分组模式下：点击只切换当前用例，不强制关闭“导入&分配”抽屉（避免影响拖拽排序体验）。
        // 执行视图默认常驻展示：用户可自行关闭抽屉查看执行视图。
        if (!(api.isTempExecProjectLayoutEnabled && api.isTempExecProjectLayoutEnabled())) {
          showTempExecView({ scroll: true });
        }
      });

      tempVersionGrid.addEventListener('dragstart', function(e) {
        var project = e.target.closest('[data-temp-project-card]');
        var projectHeader = e.target.closest('[data-temp-project-drag]');
        var version = e.target.closest('[data-temp-project-version-card]');
        var versionHeader = e.target.closest('[data-temp-project-version-drag]');
        var fileRow = e.target.closest('[data-temp-file]');
        if (fileRow && fileRow.dataset && String(fileRow.dataset.tempArchived || '') === '1') {
          e.preventDefault();
          return;
        }
        if (!e.dataTransfer) return;
        // 兜底清理上一次拖拽类型，避免影响普通用例条目的拖拽排序。
        tempProjectLayoutDrag = { type: '', key: '' };
        e.dataTransfer.effectAllowed = 'move';
        if (project && projectHeader && project.dataset.tempProjectCard) {
          e.dataTransfer.setData('text/temp-project', project.dataset.tempProjectCard);
          tempProjectLayoutDrag = { type: 'project', key: String(project.dataset.tempProjectCard || '') };
          trySetDragImage(e, project);
          return;
        }
        if (version && versionHeader && version.dataset.tempProjectVersionCard) {
          e.dataTransfer.setData('text/temp-project-version', version.dataset.tempProjectVersionCard);
          tempProjectLayoutDrag = { type: 'version', key: String(version.dataset.tempProjectVersionCard || '') };
          trySetDragImage(e, version);
          return;
        }
        if (fileRow && fileRow.dataset.tempFile) {
          var fid = String(fileRow.dataset.tempFile || '');
          e.dataTransfer.setData('text/plain', fid);
          // 额外兜底：部分浏览器 drop/dragover 读不到 dataTransfer，此处同步记录拖拽上下文用于后续排序。
          var file = fid && api.getTempExecFile ? api.getTempExecFile(fid) : null;
          var req = normalizeRequirementName(file && file.requirement) || fileRow.dataset.tempReq || '';
          setTempDragContext({
            type: 'file',
            fileId: fid,
            requirement: req,
            versionId: file && file.versionId ? file.versionId : '',
          });
        }
      });

          tempVersionGrid.addEventListener('dragover', function(e) {
            if (!e) return;
            var dataTransfer = e.dataTransfer || null;
            var dragType = tempProjectLayoutDrag && tempProjectLayoutDrag.type ? tempProjectLayoutDrag.type : '';
            var dragKey = tempProjectLayoutDrag && tempProjectLayoutDrag.key ? tempProjectLayoutDrag.key : '';
            var ids = '';
            if (!dragType) {
              ids = dataTransfer ? (dataTransfer.getData('text/plain') || '') : '';
              if (!ids && getTempDragContext() && getTempDragContext().type === 'file') {
                ids = getTempDragContext().fileId || '';
              }
            }
            // 若无法识别任何拖拽类型，不应拦截页面默认行为（避免影响其他区域）。
            if (!dragType && !ids) return;
            e.preventDefault();
            if (!dragType) {
              var versionCardHover = e.target.closest('[data-temp-project-version-card]');
              var bodyHover = versionCardHover ? versionCardHover.querySelector('.temp-project-version-body') : null;
              if (ids && bodyHover) {
                if (tempProjectLayoutFileHover.body && tempProjectLayoutFileHover.body !== bodyHover) {
                  clearTempProjectLayoutFileHover();
                }
                bodyHover.classList.add('dragover-file');
              autoScrollContainerOnDrag(bodyHover, e.clientY);
              var beforeId = resolveInsertBeforeFileId(bodyHover, e.clientY);
              var indicatorFile = ensureTempProjectLayoutFileDropIndicator();
              var rows = Array.prototype.slice.call(bodyHover.querySelectorAll('.temp-req-row[data-temp-file]'));
              var inserted = false;
              if (beforeId) {
                var targetRow = bodyHover.querySelector('.temp-req-row[data-temp-file="' + beforeId + '"]');
                if (targetRow) {
                  bodyHover.insertBefore(indicatorFile, targetRow);
                  inserted = true;
                }
              }
              if (!inserted) {
                var firstRow = bodyHover.querySelector('.temp-req-row[data-temp-file]');
                var hint = bodyHover.querySelector('.hint');
                if (!firstRow && hint) {
                  bodyHover.insertBefore(indicatorFile, hint);
                  inserted = true;
                }
              }
              if (!inserted) {
                // 若版本盒子底部存在“已归档占位”，指示器必须插在其上方，避免误导为可拖到归档下方。
                var firstArchivedRow = bodyHover.querySelector('.temp-req-row[data-temp-archived="1"]');
                if (firstArchivedRow) {
                  bodyHover.insertBefore(indicatorFile, firstArchivedRow);
                  inserted = true;
                }
              }
              if (!inserted) {
                bodyHover.appendChild(indicatorFile);
              }
              rows.forEach(function(row) {
                row.classList.toggle('dragover-target', Boolean(beforeId) && row.dataset.tempFile === beforeId);
              });
              tempProjectLayoutFileHover = { body: bodyHover, hoverId: beforeId || '' };
              clearTempProjectLayoutDropIndicator();
                return;
              }
              clearTempProjectLayoutFileHover();
            }
            if (dragType === 'project' && dragKey) {
              clearTempProjectLayoutFileHover();
              var indicator = ensureTempProjectLayoutDropIndicator('project');
              var cards = Array.prototype.slice.call(tempVersionGrid.querySelectorAll('.temp-project-card'));
            cards = cards.filter(function(el) { return el && el !== indicator; });
            if (!cards.length) {
            tempVersionGrid.appendChild(indicator);
            indicator.dataset.dropTargetId = '';
            indicator.dataset.dropAfter = '0';
            return;
          }
          var insertIndex = cards.length;
          var targetId = cards[cards.length - 1].dataset.tempProjectCard || '';
          var after = true;
          for (var i = 0; i < cards.length; i += 1) {
            var card = cards[i];
            if (!card || !card.getBoundingClientRect) continue;
            var rect = card.getBoundingClientRect();
            var midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
              insertIndex = i;
              targetId = card.dataset.tempProjectCard || '';
              after = false;
              break;
            }
          }
          if (insertIndex >= cards.length) {
            targetId = cards[cards.length - 1].dataset.tempProjectCard || '';
            after = true;
          }
          indicator.dataset.dropTargetId = targetId;
          indicator.dataset.dropAfter = after ? '1' : '0';
          var ref = cards[insertIndex] || null;
            tempVersionGrid.insertBefore(indicator, ref);
            return;
          }
          if (dragType === 'version' && dragKey) {
            clearTempProjectLayoutFileHover();
            var src = parseProjectVersionKey(dragKey);
            var projectCard = e.target.closest('[data-temp-project-card]');
            if (!projectCard || !projectCard.dataset.tempProjectCard) {
              clearTempProjectLayoutDropIndicator();
            return;
          }
          if (src.projectId && String(src.projectId) !== String(projectCard.dataset.tempProjectCard || '')) {
            clearTempProjectLayoutDropIndicator();
            return;
          }
          var grid = projectCard.querySelector('.temp-project-versions');
          if (!grid) {
            clearTempProjectLayoutDropIndicator();
            return;
          }
          var indicator2 = ensureTempProjectLayoutDropIndicator('version');
          var versionCards = Array.prototype.slice.call(grid.querySelectorAll('.temp-project-version'));
          versionCards = versionCards.filter(function(el) { return el && el !== indicator2; });
          if (!versionCards.length) {
            grid.appendChild(indicator2);
            indicator2.dataset.dropProjectId = projectCard.dataset.tempProjectCard || '';
            indicator2.dataset.dropTargetId = '';
            indicator2.dataset.dropAfter = '0';
            return;
          }
          var hit = findCardUnderPointer(versionCards, e.clientX, e.clientY);
          var insertIndex2 = versionCards.length;
          var targetKey = versionCards[versionCards.length - 1].dataset.tempProjectVersionCard || '';
          var insertAfter2 = true;
          if (hit) {
            var rect2 = hit.getBoundingClientRect();
            insertAfter2 = getDropAfterByPointerAny(e, rect2);
            var idx2 = versionCards.indexOf(hit);
            if (idx2 === -1) idx2 = versionCards.length - 1;
            insertIndex2 = idx2 + (insertAfter2 ? 1 : 0);
            targetKey = hit.dataset.tempProjectVersionCard || targetKey;
          } else {
            var rowCandidates = versionCards.filter(function(card2) {
              if (!card2 || !card2.getBoundingClientRect) return false;
              var r2 = card2.getBoundingClientRect();
              return e.clientY >= r2.top && e.clientY <= r2.bottom;
            });
            if (rowCandidates.length) {
              rowCandidates.sort(function(a, b) { return a.getBoundingClientRect().left - b.getBoundingClientRect().left; });
              for (var j = 0; j < rowCandidates.length; j += 1) {
                var rc = rowCandidates[j];
                var rr = rc.getBoundingClientRect();
                var cx2 = rr.left + rr.width / 2;
                if (e.clientX < cx2) {
                  insertIndex2 = versionCards.indexOf(rc);
                  targetKey = rc.dataset.tempProjectVersionCard || targetKey;
                  insertAfter2 = false;
                  break;
                }
              }
              if (insertIndex2 === versionCards.length) {
                var last = rowCandidates[rowCandidates.length - 1];
                insertIndex2 = versionCards.indexOf(last) + 1;
                targetKey = last.dataset.tempProjectVersionCard || targetKey;
                insertAfter2 = true;
              }
            } else {
              for (var k = 0; k < versionCards.length; k += 1) {
                var c2 = versionCards[k];
                var cr = c2.getBoundingClientRect();
                var midY2 = cr.top + cr.height / 2;
                if (e.clientY < midY2) {
                  insertIndex2 = k;
                  targetKey = c2.dataset.tempProjectVersionCard || targetKey;
                  insertAfter2 = false;
                  break;
                }
              }
              if (insertIndex2 === versionCards.length) {
                targetKey = versionCards[versionCards.length - 1].dataset.tempProjectVersionCard || targetKey;
                insertAfter2 = true;
              }
            }
          }
          indicator2.dataset.dropProjectId = projectCard.dataset.tempProjectCard || '';
          indicator2.dataset.dropTargetId = targetKey;
          indicator2.dataset.dropAfter = insertAfter2 ? '1' : '0';
          var ref2 = versionCards[insertIndex2] || null;
            grid.insertBefore(indicator2, ref2);
            return;
          }
          // 其他拖拽（如用例条目拖拽）不走此指示器
          clearTempProjectLayoutDropIndicator();
        });

        tempVersionGrid.addEventListener('dragleave', function(e) {
          if (!e) return;
          // dragleave 会在子元素之间频繁触发：仅当离开整个容器时才清理
          if (e.currentTarget !== tempVersionGrid) return;
          if (e.target !== tempVersionGrid) return;
          clearTempProjectLayoutDropIndicator();
          clearTempProjectLayoutFileHover();
        });

        tempVersionGrid.addEventListener('dragend', function() {
          clearTempProjectLayoutDropIndicator();
          clearTempProjectLayoutFileHover();
          tempProjectLayoutDrag = { type: '', key: '' };
        });

      tempVersionGrid.addEventListener('drop', function(e) {
        e.preventDefault();
        var dataTransfer = e.dataTransfer || null;
        // 注意：不要在 drop 一开始就清理 fileHover/指示器，否则某些浏览器 clientY/dataTransfer 不可用时会导致“能拖动但不换位置”。
        // drop 时也可能无法读取 dataTransfer（浏览器安全策略差异），兜底使用 dragstart 记录的类型/键
        var dragProject = dataTransfer ? dataTransfer.getData('text/temp-project') : '';
        dragProject = dragProject || (tempProjectLayoutDrag.type === 'project' ? tempProjectLayoutDrag.key : '');
        if (dragProject && api.reorderTempExecProject) {
          var indicator = tempProjectLayoutDropIndicator;
            var targetId = indicator && indicator.dataset ? (indicator.dataset.dropTargetId || '') : '';
            var after = indicator && indicator.dataset ? (indicator.dataset.dropAfter === '1') : false;
          if (!targetId) {
            // 兜底：落在某个项目卡片上
            var projectCard = e.target.closest('[data-temp-project-card]');
            targetId = projectCard && projectCard.dataset ? (projectCard.dataset.tempProjectCard || '') : '';
            after = false;
          }
          if (targetId) api.reorderTempExecProject(dragProject, targetId, { after: after });
          clearTempProjectLayoutDropIndicator();
          clearTempProjectLayoutFileHover();
          tempProjectLayoutDrag = { type: '', key: '' };
          return;
        }
        var dragVerKey = dataTransfer ? dataTransfer.getData('text/temp-project-version') : '';
        dragVerKey = dragVerKey || (tempProjectLayoutDrag.type === 'version' ? tempProjectLayoutDrag.key : '');
        if (dragVerKey && api.reorderTempExecProjectVersion) {
            var src2 = parseProjectVersionKey(dragVerKey);
            var indicator2 = tempProjectLayoutDropIndicator;
            var targetKey = indicator2 && indicator2.dataset ? (indicator2.dataset.dropTargetId || '') : '';
          var after2 = indicator2 && indicator2.dataset ? (indicator2.dataset.dropAfter === '1') : false;
          var projectId = indicator2 && indicator2.dataset ? (indicator2.dataset.dropProjectId || '') : '';
          // 以 drop 时的落点为准：若落在具体版本盒子上，则根据落点左右半区判定前/后插入
          var versionCard = e.target.closest('[data-temp-project-version-card]');
          if (versionCard && versionCard.dataset && versionCard.dataset.tempProjectVersionCard) {
            targetKey = versionCard.dataset.tempProjectVersionCard || targetKey;
            var rect = versionCard.getBoundingClientRect ? versionCard.getBoundingClientRect() : null;
            after2 = rect ? getDropAfterByPointerAny(e, rect) : after2;
            projectId = '';
          }
          var tgt2 = parseProjectVersionKey(targetKey);
          var pid2 = projectId || tgt2.projectId || src2.projectId;
          if (src2.projectId && pid2 && String(src2.projectId) === String(pid2) && tgt2.versionId) {
            api.reorderTempExecProjectVersion(pid2, src2.versionId, tgt2.versionId, { after: after2 });
          } else if (src2.projectId && pid2 && String(src2.projectId) !== String(pid2)) {
            setStatus(tempExecStatus, '不同项目之间不支持拖拽调整版本顺序', 'warn');
          }
          clearTempProjectLayoutDropIndicator();
          clearTempProjectLayoutFileHover();
          tempProjectLayoutDrag = { type: '', key: '' };
          return;
        }
        clearTempProjectLayoutDropIndicator();
        tempProjectLayoutDrag = { type: '', key: '' };
        var ids = dataTransfer ? (dataTransfer.getData('text/plain') || '') : '';
          if (!ids && getTempDragContext() && getTempDragContext().type === 'file') {
            ids = getTempDragContext().fileId || '';
          }
        if (ids && api.reorderTempExecFileInProjectVersion) {
          var versionCard = e.target.closest('[data-temp-project-version-card]');
          if (!versionCard || !versionCard.dataset.tempProjectVersionCard) return;
          var parsed = parseProjectVersionKey(versionCard.dataset.tempProjectVersionCard);
          var idArr = ids.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
          if (!idArr.length) return;
          var file = api.getTempExecFile ? api.getTempExecFile(idArr[0]) : null;
          if (!file) return;
          var hasProject = file.projectId !== undefined && file.projectId !== null && String(file.projectId) !== '';
          var hasVersion = file.versionId !== undefined && file.versionId !== null && String(file.versionId) !== '';
          if (hasProject && hasVersion && (String(file.projectId) !== String(parsed.projectId || '') || String(file.versionId) !== String(parsed.versionId || ''))) {
            showTempExecDragBlockHint(versionCard, '不同项目/不同版本之间不支持拖拽移动用例');
            setStatus(tempExecStatus, '不同项目/不同版本之间不支持拖拽移动用例', 'warn');
            return;
          }
          var body = versionCard.querySelector('.temp-project-version-body');
          var beforeId = '';
          // 优先使用 dragover 插入的指示器位置（更可靠：部分浏览器 drop 不提供 clientY 或 clientY 不准确）。
          if (body && tempProjectLayoutFileDropIndicator && tempProjectLayoutFileDropIndicator.parentNode === body) {
            var next = tempProjectLayoutFileDropIndicator.nextElementSibling;
            if (next && next.dataset && next.dataset.tempFile && String(next.dataset.tempArchived || '') !== '1') {
              beforeId = next.dataset.tempFile || '';
            }
          }
          // 兜底使用 dragover 计算出的 hoverId（若指示器未能插入 DOM）。
          if (!beforeId && tempProjectLayoutFileHover && tempProjectLayoutFileHover.body === body) {
            beforeId = tempProjectLayoutFileHover.hoverId || '';
          }
          // 最后兜底用坐标计算插入点（兼容无 dragover 的极端场景）。
          if (!beforeId) {
            var cy = (typeof e.clientY === 'number' && Number.isFinite(e.clientY)) ? e.clientY : 0;
            beforeId = resolveInsertBeforeFileId(body, cy);
          }
          api.reorderTempExecFileInProjectVersion(parsed.projectId, parsed.versionId, String(file.id), beforeId || '');
          setTempDragContext(null);
        }
        clearTempProjectLayoutFileHover();
      });
      }
      return true;
    }

    return {
      init: init,
      isBound: function() { return bound; },
      parseProjectVersionKey: parseProjectVersionKey,
      resolveInsertBeforeFileId: resolveInsertBeforeFileId,
    };
  }

  return { create: create };
});
