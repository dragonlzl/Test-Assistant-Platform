(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.tempExecImportDiffOwner = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var model = opts.model;
    if (!model || typeof model.buildComparison !== 'function') {
      throw new Error('temp exec import diff model is required');
    }
    var api = opts.api && typeof opts.api === 'object' ? opts.api : {};
    var getState = typeof opts.getState === 'function' ? opts.getState : function() { return {}; };
    var getApiClient = typeof opts.getApiClient === 'function' ? opts.getApiClient : function() { return null; };
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var escapeHtml = typeof opts.escapeHtml === 'function' ? opts.escapeHtml : function(value) { return String(value || ''); };
    var debounce = typeof opts.debounce === 'function' ? opts.debounce : function(fn) { return fn; };
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function'
      ? opts.openConfirmDrawer
      : function() { return Promise.resolve({ ok: false }); };
    var clearPendingImport = typeof opts.clearPendingImport === 'function' ? opts.clearPendingImport : function() {};
    var drawer = opts.drawer || null;
    var importDrawer = opts.importDrawer || null;
    var assignDrawer = opts.assignDrawer || null;
    var drawerElement = opts.drawerElement || null;
    var mainStatus = opts.mainStatus || null;
    var titleElement = opts.titleElement || null;
    var statusElement = opts.statusElement || null;
    var metaElement = opts.metaElement || null;
    var locateBarElement = opts.locateBarElement || null;
    var bodyElement = opts.bodyElement || null;
    var overwriteButton = opts.overwriteButton || null;
    var openTimer = 0;
    var locateHighlightTimer = 0;
    var locateEventsBound = false;

    function resolveState() {
      var state = getState();
      return state && typeof state === 'object' ? state : {};
    }

    function setResultFieldsVisible(visible) {
      if (!drawerElement || !drawerElement.querySelectorAll) return;
      var nodes = drawerElement.querySelectorAll('[data-tempexec-diff-result]');
      nodes.forEach(function(node) {
        if (!node || !node.classList) return;
        if (visible) node.classList.remove('hidden');
        else node.classList.add('hidden');
      });
    }

    function clearLocateHighlight() {
      if (locateHighlightTimer) clearTimeout(locateHighlightTimer);
      locateHighlightTimer = 0;
      if (!bodyElement || !bodyElement.querySelectorAll) return;
      bodyElement.querySelectorAll('tr.diff-locate-active').forEach(function(row) {
        if (row && row.classList) row.classList.remove('diff-locate-active');
      });
    }

    function getDiffRows() {
      if (!bodyElement || !bodyElement.querySelectorAll) return [];
      return Array.prototype.slice.call(
        bodyElement.querySelectorAll('tr.diff-row-added, tr.diff-row-removed, tr.diff-row-changed')
      );
    }

    function isAnyRowInView(rows, containerElement) {
      var list = Array.isArray(rows) ? rows : [];
      if (!list.length || !containerElement || !containerElement.getBoundingClientRect) return false;
      var containerRect = containerElement.getBoundingClientRect();
      var top = containerRect.top + 60;
      var bottom = containerRect.bottom - 40;
      for (var index = 0; index < list.length; index += 1) {
        var row = list[index];
        if (!row || !row.getBoundingClientRect) continue;
        var rowRect = row.getBoundingClientRect();
        if (rowRect.bottom > top && rowRect.top < bottom) return true;
      }
      return false;
    }

    function buildLocateBarHtml() {
      if (!locateBarElement) return '';
      var state = resolveState();
      var counts = state.diffCounts || { added: 0, removed: 0, changed: 0, total: 0 };
      var total = Number(counts.total) || 0;
      if (!total) {
        return '<div class="diff-locate-info">差异定位</div><div class="diff-locate-empty">暂无差异</div>';
      }
      var current = Number.isInteger(state.locateIndex) ? state.locateIndex : -1;
      var positionText = current >= 0
        ? ('位置 ' + String(current + 1) + '/' + String(total))
        : ('位置 --/' + String(total));
      var hasCurrent = current >= 0;
      return (
        '<div class="diff-locate-info">差异定位：新增 ' + String(counts.added || 0) +
          ' / 删除 ' + String(counts.removed || 0) +
          ' / 差异 ' + String(counts.changed || 0) +
          '，共 ' + String(total) + ' 处</div>' +
        '<div class="diff-locate-controls">' +
          '<button type="button" class="secondary" data-diff-locate-scope="tempexec-import-diff" data-diff-locate-action="first" ' + (hasCurrent && current <= 0 ? 'disabled' : '') + '>首处</button>' +
          '<button type="button" class="secondary" data-diff-locate-scope="tempexec-import-diff" data-diff-locate-action="prev" ' + (!hasCurrent || current <= 0 ? 'disabled' : '') + '>上一处</button>' +
          '<button type="button" class="secondary" data-diff-locate-scope="tempexec-import-diff" data-diff-locate-action="next" ' + (hasCurrent && current >= total - 1 ? 'disabled' : '') + '>下一处</button>' +
          '<button type="button" class="secondary" data-diff-locate-scope="tempexec-import-diff" data-diff-locate-action="last" ' + (hasCurrent && current >= total - 1 ? 'disabled' : '') + '>末处</button>' +
          '<span class="diff-locate-pos" data-diff-locate-pos>' + escapeHtml(positionText) + '</span>' +
          '<span class="diff-locate-hint hidden" data-diff-locate-hint></span>' +
        '</div>'
      );
    }

    function updateLocateHint() {
      if (!locateBarElement || !locateBarElement.querySelector) return;
      var hintElement = locateBarElement.querySelector('[data-diff-locate-hint]');
      if (!hintElement) return;
      var state = resolveState();
      var total = state.diffCounts ? Number(state.diffCounts.total) || 0 : 0;
      if (!total) {
        hintElement.textContent = '';
        if (hintElement.classList) hintElement.classList.add('hidden');
        return;
      }
      var drawerBody = drawerElement ? drawerElement.querySelector('.drawer-body') : null;
      var hint = isAnyRowInView(getDiffRows(), drawerBody)
        ? ''
        : '当前视口无差异，可点击“下一处”定位';
      hintElement.textContent = hint;
      if (hintElement.classList) hintElement.classList.toggle('hidden', !hint);
    }

    function renderLocateBar() {
      if (!locateBarElement) return;
      locateBarElement.innerHTML = buildLocateBarHtml();
      updateLocateHint();
    }

    function jumpToDiff(index) {
      var rows = getDiffRows();
      if (!rows.length) return;
      var resolvedIndex = Number(index);
      if (!Number.isFinite(resolvedIndex)) resolvedIndex = 0;
      if (resolvedIndex < 0) resolvedIndex = 0;
      if (resolvedIndex >= rows.length) resolvedIndex = rows.length - 1;
      resolveState().locateIndex = resolvedIndex;
      clearLocateHighlight();
      var row = rows[resolvedIndex];
      if (row && row.scrollIntoView) {
        try { row.scrollIntoView({ block: 'center' }); } catch (error) { row.scrollIntoView(); }
      }
      if (row && row.classList) row.classList.add('diff-locate-active');
      locateHighlightTimer = setTimeout(function() {
        if (row && row.classList) row.classList.remove('diff-locate-active');
      }, 2000);
      renderLocateBar();
    }

    function bindLocateEvents() {
      if (locateEventsBound) return;
      locateEventsBound = true;
      if (drawerElement && typeof drawerElement.addEventListener === 'function') {
        drawerElement.addEventListener('click', function(event) {
          var button = event && event.target && event.target.closest
            ? event.target.closest('[data-diff-locate-action]')
            : null;
          if (!button || !button.getAttribute) return;
          if (button.getAttribute('data-diff-locate-scope') !== 'tempexec-import-diff') return;
          var rows = getDiffRows();
          var state = resolveState();
          var action = button.getAttribute('data-diff-locate-action') || '';
          if (!rows.length || !action) return;
          if (action === 'first') jumpToDiff(0);
          else if (action === 'last') jumpToDiff(rows.length - 1);
          else if (action === 'next') jumpToDiff(state.locateIndex >= 0 ? state.locateIndex + 1 : 0);
          else if (action === 'prev') jumpToDiff(state.locateIndex >= 0 ? state.locateIndex - 1 : rows.length - 1);
        });
      }
      var drawerBody = drawerElement ? drawerElement.querySelector('.drawer-body') : null;
      if (drawerBody && typeof drawerBody.addEventListener === 'function') {
        drawerBody.addEventListener('scroll', debounce(updateLocateHint, 120));
      }
    }

    function buildValueBlock(leftText, rightText, placeholderText) {
      var left = model.normalizeText(leftText);
      var right = model.normalizeText(rightText);
      if (!left && !right) {
        return '<div class="diff-one"><p class="hint">' + escapeHtml(placeholderText || '--') + '</p></div>';
      }
      if (left && right) {
        if (left === right) return '<div class="diff-one">' + escapeHtml(left) + '</div>';
        return (
          '<div class="diff-pair">' +
            '<div class="diff-pair-line diff-pair-left"><span class="diff-pair-tag">导入</span><div class="diff-pair-text">' + escapeHtml(left) + '</div></div>' +
            '<div class="diff-pair-line diff-pair-right"><span class="diff-pair-tag">执行</span><div class="diff-pair-text">' + escapeHtml(right) + '</div></div>' +
          '</div>'
        );
      }
      var label = left ? '导入' : '执行';
      var value = left || right;
      return (
        '<div class="diff-one diff-one-with-tag">' +
          '<span class="diff-pair-tag">' + label + '</span>' +
          '<div class="diff-pair-text">' + escapeHtml(value) + '</div>' +
        '</div>'
      );
    }

    function renderTable(rows, includeResult) {
      if (!bodyElement) return;
      var list = Array.isArray(rows) ? rows : [];
      if (!list.length) {
        bodyElement.innerHTML = '<tr><td colspan="' + (includeResult ? '10' : '7') + '"><p class="hint">暂无数据</p></td></tr>';
        return;
      }
      bodyElement.innerHTML = list.map(function(row, index) {
        var left = row ? row.left : null;
        var right = row ? row.right : null;
        var rowClass = row && row.type !== 'unchanged' ? 'diff-row-' + row.type : '';
        var changed = row && row.type === 'changed' && row.diff ? row.diff : {};
        var badge = '';
        if (row && row.type === 'added') badge = '<span class="diff-badge diff-badge-added">新增</span>';
        else if (row && row.type === 'removed') badge = '<span class="diff-badge diff-badge-removed">将删除</span>';
        else if (row && row.type === 'changed') badge = '<span class="diff-badge diff-badge-changed">有差异</span>';
        var resultCells = includeResult
          ? (
              '<td data-tempexec-diff-result class="' + (changed.actual ? 'diff-cell-changed' : '') + '">' + buildValueBlock(left && left.actual, right && right.actual, '--') + '</td>' +
              '<td data-tempexec-diff-result class="' + (changed.remark ? 'diff-cell-changed' : '') + '">' + buildValueBlock(left && left.remark, right && right.remark, '--') + '</td>' +
              '<td data-tempexec-diff-result class="' + (changed.defect ? 'diff-cell-changed' : '') + '">' + buildValueBlock(left && left.defect, right && right.defect, '--') + '</td>'
            )
          : '';
        return (
          '<tr class="' + escapeHtml(rowClass) + '">' +
            '<td>' + escapeHtml(String(index + 1)) + '</td>' +
            '<td>' + buildValueBlock(left && left.module, right && right.module, '（缺失）') + '</td>' +
            '<td><div class="diff-cell-stack">' +
              buildValueBlock(left && left.title, right && right.title, '（缺失）') +
              (badge ? '<div class="diff-badge-row">' + badge + '</div>' : '') +
            '</div></td>' +
            '<td class="' + (changed.priority ? 'diff-cell-changed' : '') + '">' + buildValueBlock(left && left.priority, right && right.priority, '--') + '</td>' +
            '<td class="' + (changed.preconditions ? 'diff-cell-changed' : '') + '">' + buildValueBlock(left && left.preconditions, right && right.preconditions, '--') + '</td>' +
            '<td class="' + (changed.steps ? 'diff-cell-changed' : '') + '">' + buildValueBlock(left && left.steps, right && right.steps, '--') + '</td>' +
            '<td>' + buildValueBlock(left && left.expected, right && right.expected, '（缺失）') + '</td>' +
            resultCells +
          '</tr>'
        );
      }).join('');
    }

    function syncControls() {
      if (!overwriteButton) return;
      var state = resolveState();
      overwriteButton.disabled = !Boolean(
        !state.loading
        && !state.confirming
        && state.projectId
        && state.importVersionId
        && state.dbCaseFileId
        && state.cleanName
        && Array.isArray(state.importItems)
        && state.importItems.length
      );
    }

    function openLoading(payload) {
      var source = payload || {};
      var state = resolveState();
      state.loading = true;
      state.confirming = false;
      state.locateIndex = -1;
      state.diffCounts = { added: 0, removed: 0, changed: 0, total: 0 };
      state.fileName = source.fileName || '';
      state.cleanName = source.cleanName || '';
      state.projectId = source.projectId || null;
      state.importVersionId = source.importVersionId || null;
      state.dbVersionId = source.dbVersionId || null;
      state.ext = source.ext || '';
      state.source = source.source || '';
      state.importItems = Array.isArray(source.importItems) ? source.importItems : [];
      state.importExecCases = Array.isArray(source.importExecCases) ? source.importExecCases : [];
      state.importHasResult = source.importHasResult === true;
      state.importReuseEnabled = source.importReuseEnabled === true;
      state.requirement = source.requirement || '';
      state.dbCaseFileId = source.dbCaseFileId || null;
      state.dbItems = [];
      state.dbExecSetId = null;
      state.dbExecCases = [];
      state.dbReuseEnabled = false;
      state.dbHasResult = false;
      state.showResultFields = false;
      state.rows = [];
      if (titleElement) titleElement.textContent = '同名用例差异对比：' + (state.cleanName || state.fileName || '用例');
      if (statusElement) setStatus(statusElement, '正在加载差异对比...', '');
      if (metaElement) metaElement.textContent = '';
      if (bodyElement) bodyElement.innerHTML = '<tr><td colspan="10"><p class="hint">加载中...</p></td></tr>';
      setResultFieldsVisible(true);
      renderLocateBar();
      syncControls();
      if (importDrawer && typeof importDrawer.close === 'function') importDrawer.close();
      if (assignDrawer && typeof assignDrawer.close === 'function') assignDrawer.close();
      if (openTimer) clearTimeout(openTimer);
      openTimer = 0;
      if (drawer && typeof drawer.open === 'function') {
        var alreadyOpen = Boolean(drawerElement && drawerElement.classList && drawerElement.classList.contains('open'));
        if (alreadyOpen) drawer.open();
        else openTimer = setTimeout(function() { drawer.open(); }, 60);
      } else if (drawerElement && drawerElement.classList) {
        drawerElement.classList.add('open');
        drawerElement.classList.remove('hidden');
      }
    }

    function open(payload) {
      var source = payload || {};
      var state = resolveState();
      state.loading = false;
      state.confirming = false;
      state.dbItems = Array.isArray(source.dbItems) ? source.dbItems : [];
      state.dbExecSetId = source.dbExecSetId || null;
      state.dbExecCases = Array.isArray(source.dbExecCases) ? source.dbExecCases : [];
      state.dbReuseEnabled = source.dbReuseEnabled === true;
      state.dbHasResult = source.dbHasResult === true;
      state.importHasResult = source.importHasResult === true;
      state.showResultFields = Boolean(state.importHasResult || state.dbHasResult);
      var comparison = model.buildComparison({
        importItems: state.importItems,
        importExecCases: state.importExecCases,
        importReuseEnabled: state.importReuseEnabled,
        databaseItems: state.dbItems,
        databaseExecCases: state.dbExecCases,
        databaseReuseEnabled: state.dbReuseEnabled,
        includeResult: state.showResultFields,
      });
      state.rows = comparison.rows;
      state.diffCounts = comparison.counts;
      var leftCount = comparison.importRows.length;
      var rightCount = comparison.databaseRows.length;
      if (metaElement) {
        metaElement.textContent =
          '导入（' + leftCount + ' 条） / 执行中（' + rightCount + ' 条） / 新增 ' + comparison.counts.added +
          ' / 删除 ' + comparison.counts.removed + ' / 差异 ' + comparison.counts.changed;
        if (metaElement.classList) metaElement.classList.toggle('warn', leftCount !== rightCount);
      }
      setResultFieldsVisible(state.showResultFields);
      renderTable(state.rows, state.showResultFields);
      if (statusElement) setStatus(statusElement, '', '');
      syncControls();
      bindLocateEvents();
      renderLocateBar();
    }

    function resolveExternal(result) {
      var state = resolveState();
      var external = state.external || null;
      if (!external || typeof external.resolve !== 'function') return;
      state.external = null;
      try { external.resolve(result); } catch (error) {}
    }

    function closeDrawer() {
      if (drawer && typeof drawer.close === 'function') drawer.close();
      else if (drawerElement && drawerElement.classList) drawerElement.classList.remove('open');
    }

    function confirmOverwrite() {
      var state = resolveState();
      if (state.loading || state.confirming) return;
      var apiClient = getApiClient();
      if (!apiClient || typeof apiClient.importCaseFile !== 'function' || typeof apiClient.upsertExecSetFromCaseFile !== 'function') {
        if (statusElement) setStatus(statusElement, '后端入库接口未就绪', 'err');
        return;
      }
      var cleanName = state.cleanName || state.fileName || '用例';
      var secondMessage = '';
      if (state.dbHasResult && state.importHasResult) {
        secondMessage = '覆盖后将替换现有执行结果（实际结果/备注/缺陷链接），是否继续？';
      } else if (state.dbHasResult && !state.importHasResult) {
        secondMessage = '覆盖后将清空现有执行结果（实际结果/备注/缺陷链接），是否继续？';
      }
      state.confirming = true;
      syncControls();
      var started = false;
      return openConfirmDrawer({
        title: '确认覆盖导入',
        message: '是否确认覆盖导入用例：' + cleanName + '？',
        confirmText: '确认覆盖',
        cancelText: '取消',
        danger: true,
        previousDrawer: drawer,
        resolveAfterClose: true,
      })
        .then(function(result) {
          if (!result || result.ok !== true) return null;
          if (!secondMessage) return { ok: true };
          return openConfirmDrawer({
            title: '执行结果确认',
            message: secondMessage,
            confirmText: '继续覆盖',
            cancelText: '取消',
            danger: true,
            previousDrawer: drawer,
            resolveAfterClose: true,
          });
        })
        .then(function(result) {
          if (!result || result.ok !== true) return null;
          started = true;
          state.confirming = false;
          var extension = state.ext || (String(state.fileName || '').split('.').pop() || 'xmind');
          extension = String(extension || '').toLowerCase();
          if (!extension || extension === String(state.fileName || '').toLowerCase()) extension = 'xmind';
          var overwriteFileName = String(state.cleanName || cleanName || 'case') + '.' + extension;
          state.loading = true;
          syncControls();
          if (statusElement) setStatus(statusElement, '覆盖导入中...', '');
          setStatus(mainStatus, '覆盖导入中...', '');
          var shouldImportResult = Boolean(state.importHasResult);
          var shouldClearResult = Boolean(state.dbHasResult && !state.importHasResult);
          var importCases = null;
          var preferSource = 'db';
          if (shouldImportResult) {
            importCases = Array.isArray(state.importExecCases) ? state.importExecCases : [];
            preferSource = 'import';
          } else if (shouldClearResult) {
            importCases = (Array.isArray(state.importExecCases) ? state.importExecCases : []).map(function(row) {
              if (!row) return null;
              return Object.assign({}, row, { status: '未执行', remark: '', defect_links: [], reuse_details: [] });
            }).filter(Boolean);
            preferSource = 'import';
          }
          return apiClient.importCaseFile({
            project_id: state.projectId,
            version_id: state.importVersionId,
            file_name: overwriteFileName,
            source: state.source || 'tempexec',
            items: state.importItems,
          }, { overwrite: true })
            .then(function(caseFile) {
              if (!caseFile || !caseFile.id) throw new Error('覆盖入库失败：未返回用例文件');
              var execVersionId = Object.prototype.hasOwnProperty.call(state, 'execVersionId') ? state.execVersionId : null;
              if (execVersionId === undefined) execVersionId = null;
              return apiClient.upsertExecSetFromCaseFile({
                case_file_id: caseFile.id,
                mode: 'replace',
                preserve_results: false,
                prefer_result_source: preferSource,
                import_cases: importCases && importCases.length ? importCases : null,
                requirement: state.requirement || '',
                reuse_enabled: state.importReuseEnabled ? true : false,
                reuse_presets: null,
                exec_version_id: execVersionId,
              });
            })
            .then(function(execSet) {
              if (!execSet || !execSet.id) throw new Error('执行集更新失败');
              var chain = typeof api.loadTempExecState === 'function'
                ? Promise.resolve(api.loadTempExecState())
                : Promise.resolve();
              return chain.then(function() {
                if (typeof api.setTempExecActive === 'function') api.setTempExecActive(String(execSet.id));
                return execSet;
              });
            })
            .then(function() {
              var message = '覆盖导入成功：' + cleanName;
              if (statusElement) setStatus(statusElement, message, 'ok');
              setStatus(mainStatus, message, 'ok');
              resolveExternal({ ok: true, overwrite: true });
              var queue = state.queue || null;
              var keepOpen = Boolean(
                queue && queue.active && Number(queue.total) > 0 && Number(queue.index) < Number(queue.total) - 1
              );
              if (!keepOpen) {
                clearPendingImport();
                closeDrawer();
              }
            })
            .catch(function(error) {
              var message = error && error.message ? error.message : '覆盖导入失败';
              if (statusElement) setStatus(statusElement, '覆盖导入失败：' + message, 'err');
              setStatus(mainStatus, '覆盖导入失败：' + message, 'err');
              resolveExternal({ ok: false, reason: 'overwrite_failed', error: error || null });
            })
            .finally(function() {
              state.loading = false;
              syncControls();
            });
        })
        .finally(function() {
          if (!started) {
            state.confirming = false;
            syncControls();
          }
        });
    }

    function handleDrawerClose() {
      if (openTimer) clearTimeout(openTimer);
      openTimer = 0;
      clearLocateHighlight();
      resolveExternal({ ok: false, reason: 'closed' });
    }

    return {
      openLoading: openLoading,
      open: open,
      confirmOverwrite: confirmOverwrite,
      handleDrawerClose: handleDrawerClose,
      syncControls: syncControls,
    };
  }

  return { create: create };
});
