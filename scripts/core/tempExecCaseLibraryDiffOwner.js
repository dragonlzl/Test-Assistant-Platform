(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecCaseLibraryDiffOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function(root) {
  function noop() {}

  function normalizeDiffKind(raw) {
    var kind = String(raw || '').trim().toLowerCase();
    if (kind === 'appended' || kind === 'added' || kind === 'updated' || kind === 'deleted') return kind;
    return '';
  }

  function normalizeCaseLibDiffItemId(entry) {
    if (!entry) return '';
    var id = entry.case_item_id;
    if (id === null || id === undefined) id = entry.caseItemId;
    if (id === null || id === undefined) return '';
    return String(id);
  }

  function findTempExecCaseIndexByItemId(file, caseItemId) {
    if (!file || !Array.isArray(file.cases)) return -1;
    var target = String(caseItemId || '');
    if (!target) return -1;
    for (var i = 0; i < file.cases.length; i += 1) {
      var item = file.cases[i];
      if (!item) continue;
      var id = item.caseItemId;
      if (id === null || id === undefined) id = item.case_item_id;
      if (id !== null && id !== undefined && String(id) === target) return i;
      var sourceId = item.caseItemSourceId;
      if (sourceId === null || sourceId === undefined) sourceId = item.case_item_source_id;
      if (sourceId !== null && sourceId !== undefined && String(sourceId) === target) return i;
    }
    return -1;
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var windowRef = opts.window || root || {};
    var documentRef = opts.document || (windowRef && windowRef.document ? windowRef.document : null);
    var syncApi = opts.caseLibrarySyncApi && typeof opts.caseLibrarySyncApi === 'object'
      ? opts.caseLibrarySyncApi
      : {};
    var controllerFactory = opts.controllerFactory || null;
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};

    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    function syncPort(name, fallback) {
      return typeof syncApi[name] === 'function' ? syncApi[name] : (fallback || noop);
    }

    function resolveElement(name, id) {
      if (dom[name]) return dom[name];
      if (!documentRef || typeof documentRef.getElementById !== 'function') return null;
      return documentRef.getElementById(id);
    }

    var setStatus = port('setStatus');
    var escapeHtml = port('escapeHtml', function(value) {
      return value === null || value === undefined ? '' : String(value);
    });
    var scrollElementIntoView = port('scrollElementIntoView');
    var getTempExecFile = port('getTempExecFile', function(fileId) {
      return (state.tempExecFiles || []).find(function(file) {
        return file && String(file.id || file.execSetId || '') === String(fileId || '');
      }) || null;
    });
    var isDbMode = port('isDbMode', function() { return false; });
    var getApiClient = port('getApiClient', function() { return null; });
    var setTempExecActive = port('setTempExecActive');
    var jumpToTempExecCase = port('jumpToTempExecCase', function() { return { ok: false }; });
    var schedule = typeof opts.setTimeout === 'function'
      ? opts.setTimeout
      : function(callback, delay) { return setTimeout(callback, delay); };
    var cancelSchedule = typeof opts.clearTimeout === 'function'
      ? opts.clearTimeout
      : function(token) { clearTimeout(token); };

    var ensureDiffState = syncPort('ensureTempExecCaseLibraryDiffState', function() {
      if (!state.tempExecCaseLibraryDiff || typeof state.tempExecCaseLibraryDiff !== 'object') {
        state.tempExecCaseLibraryDiff = {};
      }
      var store = state.tempExecCaseLibraryDiff;
      if (!store.byExecSetId || typeof store.byExecSetId !== 'object') store.byExecSetId = {};
      if (!store.filterByExecSetId || typeof store.filterByExecSetId !== 'object') store.filterByExecSetId = {};
      return store;
    });
    var hasUnackedDiff = syncPort('hasUnackedCaseLibraryDiff', function() { return false; });
    var listDiffExecSetIds = syncPort('listTempExecCaseLibraryDiffExecSetIds', function() { return []; });
    var getFileName = syncPort('getTempExecFileNameByExecSetId', function(id) { return '执行集#' + String(id || ''); });
    var setSelectedExecSetId = syncPort('setTempExecCaseLibraryDiffSelectedExecSetId');
    var getSelectedExecSetId = syncPort('getTempExecCaseLibraryDiffSelectedExecSetId', function() { return ''; });
    var hasChangeSignal = syncPort('hasCaseLibraryChangeSignal', function() { return false; });
    var applySyncMeta = syncPort('applyTempExecCaseLibrarySyncMeta', function() { return null; });
    var clearAutoPopup = syncPort('clearTempExecCaseLibraryAutoPopup');
    var tryAutoOpenRestoreDiff = syncPort('tryAutoOpenTempExecRestoreDiff', function() { return false; });
    var isTempExecTabActive = syncPort('isTempExecTabActive', function() { return false; });
    var maybeOpenAutoPopup = syncPort('maybeOpenTempExecCaseLibraryAutoPopup', function() { return false; });
    var hasAutoPopupSeen = syncPort('hasTempExecCaseLibraryAutoPopupSeen', function() { return false; });
    var markAutoPopupSeen = syncPort('markTempExecCaseLibraryAutoPopupSeen');

    var changesButton = resolveElement('changesButton', 'tempExecCaseLibraryChangesBtn');
    var statusElement = resolveElement('status', 'tempExecCaseLibraryDiffStatus');
    var appendedPill = resolveElement('appendedPill', 'tempExecCaseLibraryDiffAppendedPill');
    var addedPill = resolveElement('addedPill', 'tempExecCaseLibraryDiffAddedPill');
    var updatedPill = resolveElement('updatedPill', 'tempExecCaseLibraryDiffUpdatedPill');
    var deletedPill = resolveElement('deletedPill', 'tempExecCaseLibraryDiffDeletedPill');
    var caseNameElement = resolveElement('caseName', 'tempExecCaseLibraryDiffCaseName');
    var caseTabsElement = resolveElement('caseTabs', 'tempExecCaseLibraryDiffCaseTabs');
    var tempExecView = dom.tempExecView || null;
    var tempExecViewSection = dom.tempExecViewSection || null;
    var drawer = null;
    var tableController = null;
    var locateTimer = 0;
    var locateTarget = null;

    function syncChangesButton(file) {
      if (!changesButton) return;
      if (!file || !file.execSetId || !isDbMode()) {
        changesButton.disabled = true;
        try { changesButton.classList.remove('has-new'); } catch (error) {}
        return;
      }
      var store = ensureDiffState();
      var meta = store.byExecSetId[String(file.execSetId)] || (file.caseLibraryMeta || null);
      changesButton.disabled = false;
      try {
        changesButton.classList.toggle('has-new', hasUnackedDiff(meta));
      } catch (error2) {
        // ignore unavailable classList implementations
      }
    }

    function clearLocateHighlight() {
      if (locateTimer) cancelSchedule(locateTimer);
      locateTimer = 0;
      if (locateTarget && locateTarget.classList) locateTarget.classList.remove('locate-highlight');
      locateTarget = null;
    }

    function flashLocate(target) {
      if (!target || !target.classList) return;
      if (locateTarget && locateTarget !== target) {
        clearLocateHighlight();
      } else if (locateTimer) {
        cancelSchedule(locateTimer);
        locateTimer = 0;
      }
      locateTarget = target;
      target.classList.add('locate-highlight');
      locateTimer = schedule(function() {
        if (locateTarget === target && target.classList) target.classList.remove('locate-highlight');
        if (locateTarget === target) locateTarget = null;
        locateTimer = 0;
      }, 1600);
    }

    function scrollToCaseRow(fileId, index, scrollOptions) {
      var scrollOpts = scrollOptions && typeof scrollOptions === 'object' ? scrollOptions : {};
      var attempts = 0;
      var maxAttempts = 30;
      var offset = Number(scrollOpts.offset);
      if (!Number.isFinite(offset)) offset = 140;
      var storeRestore = scrollOpts.storeRestore !== false;

      function tryScroll() {
        attempts += 1;
        if (!tempExecView || typeof tempExecView.querySelector !== 'function') return;
        var selector = 'tr.case-row[data-temp-case-row="' + String(fileId) + '"][data-index="' + String(index) + '"]';
        var target = tempExecView.querySelector(selector);
        if (!target) {
          if (attempts < maxAttempts) schedule(tryScroll, 40);
          return;
        }
        var desired = 0;
        if (storeRestore && windowRef) {
          var rect = target.getBoundingClientRect();
          var scrollTop = typeof windowRef.scrollY === 'number'
            ? windowRef.scrollY
            : (documentRef && documentRef.documentElement
                ? documentRef.documentElement.scrollTop || (documentRef.body ? documentRef.body.scrollTop : 0) || 0
                : 0);
          desired = Math.max(0, Math.round(scrollTop + rect.top - offset));
          windowRef.app = windowRef.app || {};
          windowRef.app.__drawerRestoreScrollTopOnce = desired;
        }
        var scrolled = false;
        if (typeof target.scrollIntoView === 'function') {
          try {
            target.scrollIntoView({ block: 'center', behavior: 'auto' });
            scrolled = true;
          } catch (error) {
            try {
              target.scrollIntoView();
              scrolled = true;
            } catch (error2) {
              scrolled = false;
            }
          }
        }
        if (!scrolled) scrollElementIntoView(target, 'auto', 160);
        flashLocate(target);
        if (storeRestore && windowRef) {
          schedule(function() {
            windowRef.app = windowRef.app || {};
            windowRef.app.__drawerRestoreScrollTopOnce = desired;
            windowRef.app.__drawerSkipRestoreOnce = true;
            windowRef.app.__drawerRestoreScrollTopOnce = null;
          }, 60);
        }
      }

      schedule(tryScroll, 60);
    }

    function locateCaseFromDiff(entry, execSetId) {
      var fileId = execSetId ? String(execSetId) : '';
      var caseItemId = normalizeCaseLibDiffItemId(entry);
      if (!fileId || !caseItemId) {
        if (statusElement) setStatus(statusElement, '未找到可定位的用例信息', 'warn');
        return false;
      }
      var file = getTempExecFile(fileId);
      if (!file) {
        if (statusElement) setStatus(statusElement, '未找到对应执行用例文件', 'warn');
        return false;
      }
      var index = findTempExecCaseIndexByItemId(file, caseItemId);
      if (index < 0) {
        if (statusElement) setStatus(statusElement, '未在执行视图找到对应变更用例', 'warn');
        return false;
      }
      if (tempExecViewSection && tempExecViewSection.classList) tempExecViewSection.classList.remove('hidden');
      var result = jumpToTempExecCase(fileId, index, { clearFilters: true });
      if (!result || result.ok !== true) {
        if (statusElement) setStatus(statusElement, '定位执行用例失败，请刷新后重试', 'warn');
        return false;
      }
      scrollToCaseRow(fileId, index, { storeRestore: true });
      return true;
    }

    function renderCaseTabs(selectedExecSetId) {
      if (!caseTabsElement) return;
      var ids = listDiffExecSetIds();
      if (!ids.length) {
        caseTabsElement.innerHTML = '';
        return;
      }
      caseTabsElement.innerHTML = ids.map(function(id) {
        var store = ensureDiffState();
        var meta = store.byExecSetId[String(id)] || null;
        var className = 'summary-pill case-lib-diff-case-pill'
          + (String(id) === String(selectedExecSetId || '') ? ' active' : '');
        if (hasUnackedDiff(meta)) className += ' has-new';
        if (meta && meta.shouldAutoPopup) className += ' needs-attention';
        return (
          '<button type="button" class="' + className + '" data-case-lib-diff-exec-set="' + escapeHtml(id) + '">' +
            escapeHtml(getFileName(id)) +
          '</button>'
        );
      }).join('');
    }

    function ensureTableController() {
      if (tableController) return tableController;
      if (!controllerFactory || typeof controllerFactory.create !== 'function') return null;
      var hostElement = resolveElement('tableHost', 'tempExecCaseLibraryDiffTableHost');
      if (!hostElement) return null;
      tableController = controllerFactory.create({
        hostEl: hostElement,
        onRowActivate: function(record) {
          var selectedExecSetId = getSelectedExecSetId();
          if (!selectedExecSetId && state.tempExecActiveId) {
            var active = getTempExecFile(state.tempExecActiveId);
            selectedExecSetId = active && active.execSetId ? String(active.execSetId) : '';
          }
          if (!selectedExecSetId || !record) return;
          locateCaseFromDiff({ case_item_id: record.caseItemId, kind: record.kind }, selectedExecSetId);
        },
      });
      return tableController;
    }

    function syncSummaryPill(element, label, value, active) {
      if (!element) return;
      element.textContent = label + ' ' + (value || 0);
      if (element.classList) element.classList.toggle('active', active);
    }

    function renderDiff(execSetId) {
      var controller = ensureTableController();
      if (!controller) return null;
      var store = ensureDiffState();
      var lastRendered = state.tempExecCaseLibraryDiffLastRenderedExecSetId
        ? String(state.tempExecCaseLibraryDiffLastRenderedExecSetId)
        : '';
      var nextRendered = execSetId ? String(execSetId) : '';
      if (nextRendered && nextRendered !== lastRendered) {
        store.filterByExecSetId[nextRendered] = '';
        state.tempExecCaseLibraryDiffLastRenderedExecSetId = nextRendered;
      }
      var meta = execSetId ? store.byExecSetId[String(execSetId)] : null;
      var filter = execSetId && store.filterByExecSetId[String(execSetId)]
        ? String(store.filterByExecSetId[String(execSetId)])
        : '';
      filter = normalizeDiffKind(filter);

      setSelectedExecSetId(execSetId);
      if (caseNameElement) caseNameElement.textContent = getFileName(execSetId || '');
      renderCaseTabs(execSetId);
      var tableState = controller.setData(meta, {
        execSetId: execSetId,
        file: execSetId ? getTempExecFile(String(execSetId)) : null,
        filter: filter,
        emptyText: '暂无变更',
      });
      var summary = tableState && tableState.summary
        ? tableState.summary
        : { appended: 0, added: 0, updated: 0, deleted: 0 };
      syncSummaryPill(appendedPill, '追加', summary.appended, filter === 'appended');
      syncSummaryPill(addedPill, '新增', summary.added, filter === 'added');
      syncSummaryPill(updatedPill, '改动', summary.updated, filter === 'updated');
      syncSummaryPill(deletedPill, '删除', summary.deleted, filter === 'deleted');

      if (statusElement) {
        var statusText = '';
        var hasSignal = hasChangeSignal(meta);
        if (!meta) {
          statusText = '暂无用例变更数据';
        } else if (meta.hasNewDiff) {
          statusText = '已同步用例变更到执行页：追加 ' + summary.appended + '，新增 ' + summary.added
            + '，改动 ' + summary.updated + '，删除 ' + summary.deleted;
        } else if (meta.everChanged || hasSignal) {
          statusText = '暂无新的用例变更，可查看历史差异：追加 ' + summary.appended + '，新增 ' + summary.added
            + '，改动 ' + summary.updated + '，删除 ' + summary.deleted;
        } else {
          statusText = '当前用例未发生用例变更';
        }
        setStatus(statusElement, statusText, meta && (meta.everChanged || hasSignal) ? 'ok' : '');
      }
      return tableState;
    }

    function handleDrawerClick(event) {
      var target = event && event.target ? event.target : null;
      if (!target || typeof target.closest !== 'function') return;
      var selectButton = target.closest('#tempExecCaseLibraryDiffSelectCaseBtn');
      if (selectButton) {
        var selected = getSelectedExecSetId();
        if (selected) setTempExecActive(String(selected));
        return;
      }
      var caseButton = target.closest('[data-case-lib-diff-exec-set]');
      if (caseButton && caseButton.dataset && caseButton.dataset.caseLibDiffExecSet) {
        renderDiff(String(caseButton.dataset.caseLibDiffExecSet || ''));
        return;
      }
      var pill = target.closest('[data-case-lib-diff-filter]');
      if (!pill) return;
      var selectedExecSetId = getSelectedExecSetId();
      var execSetId = selectedExecSetId ? String(selectedExecSetId) : '';
      if (!execSetId) {
        var active = getTempExecFile(state.tempExecActiveId);
        execSetId = active && active.execSetId ? String(active.execSetId) : '';
      }
      if (!execSetId) return;
      var next = normalizeDiffKind(pill.dataset ? pill.dataset.caseLibDiffFilter : '');
      if (!next) return;
      var store = ensureDiffState();
      var current = store.filterByExecSetId[execSetId] ? String(store.filterByExecSetId[execSetId]) : '';
      store.filterByExecSetId[execSetId] = current === next ? '' : next;
      renderDiff(execSetId);
    }

    function ensureDrawer() {
      if (drawer) return drawer;
      var drawerApi = windowRef && windowRef.app && windowRef.app.drawer ? windowRef.app.drawer : null;
      if (!drawerApi || typeof drawerApi.createDrawer !== 'function') return null;
      drawer = drawerApi.createDrawer({ drawerId: 'tempExecCaseLibraryDiffDrawer' });
      if (drawer && drawer.element && typeof drawer.element.addEventListener === 'function') {
        drawer.element.addEventListener('click', handleDrawerClick);
      }
      return drawer;
    }

    function acknowledgeDiff(execSetId, meta, store, active, client) {
      if (!meta || !meta.lastDiffAt) return;
      meta.lastShownAt = meta.lastDiffAt;
      meta.hasNewDiff = false;
      meta.shouldAutoPopup = false;
      store.byExecSetId[String(execSetId)] = meta;
      clearAutoPopup(execSetId, meta);
      if (active && String(active.execSetId || '') === String(execSetId)) syncChangesButton(active);
      renderCaseTabs(execSetId);
      if (client && typeof client.ackExecSetCaseLibraryDiff === 'function') {
        client.ackExecSetCaseLibraryDiff(execSetId).catch(function() {});
      }
    }

    function openDrawer(options) {
      var openOptions = options || {};
      var manual = Boolean(openOptions.manual);
      var desired = openOptions.execSetId ? String(openOptions.execSetId) : '';
      var saved = getSelectedExecSetId();
      var active = getTempExecFile(state.tempExecActiveId);
      var activeExecSetId = active && active.execSetId ? String(active.execSetId) : '';
      var execSetId = desired || (manual ? (activeExecSetId || saved) : (saved || activeExecSetId)) || '';
      if (!execSetId && active && (active.execSetId || active.id)) execSetId = String(active.execSetId || active.id || '');
      if (!execSetId && Array.isArray(state.tempExecFiles) && state.tempExecFiles.length) {
        var fallback = state.tempExecFiles[0];
        if (fallback && (fallback.execSetId || fallback.id)) execSetId = String(fallback.execSetId || fallback.id || '');
      }
      if (!execSetId) return false;
      if (manual) setSelectedExecSetId(execSetId);
      var store = ensureDiffState();
      var meta = store.byExecSetId[String(execSetId)] || null;
      var hasDiff = Boolean(meta && Array.isArray(meta.diff) && meta.diff.length);
      var hasHistory = Boolean(meta && Array.isArray(meta.history) && meta.history.length);
      var hasSignal = Boolean(meta && (hasDiff || hasHistory || hasChangeSignal(meta)));

      if (manual && isDbMode()) {
        var syncClient = getApiClient();
        if (syncClient && typeof syncClient.syncExecSetCaseLibrary === 'function') {
          ensureDrawer();
          renderDiff(execSetId);
          if (statusElement) setStatus(statusElement, '正在同步用例变更...', '');
          if (tableController && (!meta || !hasSignal)) tableController.setLoading();
          if (drawer && typeof drawer.open === 'function') drawer.open();
          syncClient.syncExecSetCaseLibrary(execSetId).then(function(syncResult) {
            var nextMeta = applySyncMeta(getTempExecFile(String(execSetId)), syncResult);
            if (!nextMeta) return;
            renderDiff(execSetId);
            acknowledgeDiff(execSetId, nextMeta, store, active, syncClient);
          }).catch(function(error) {
            if (!statusElement) return;
            var message = error && error.message ? error.message : '同步失败';
            setStatus(statusElement, '用例库同步失败：' + message, 'err');
          });
          return true;
        }
      }

      if (!meta || !hasSignal) {
        var fallbacks = listDiffExecSetIds();
        if (fallbacks.length) {
          execSetId = String(fallbacks[0]);
          meta = store.byExecSetId[String(execSetId)] || null;
          hasDiff = Boolean(meta && Array.isArray(meta.diff) && meta.diff.length);
          hasHistory = Boolean(meta && Array.isArray(meta.history) && meta.history.length);
          hasSignal = Boolean(meta && (hasDiff || hasHistory || hasChangeSignal(meta)));
        }
      }
      if (!meta || (!manual && !hasSignal)) return false;
      ensureDrawer();
      renderDiff(execSetId);
      if (drawer && typeof drawer.open === 'function') drawer.open();
      if (manual && isDbMode()) acknowledgeDiff(execSetId, meta, store, active, getApiClient());
      return true;
    }

    function tryAutoOpen() {
      if (!isDbMode()) return false;
      if (tryAutoOpenRestoreDiff()) return true;
      var allowAutoPopup = isTempExecTabActive(true);
      var activeId = state.tempExecActiveId ? String(state.tempExecActiveId) : '';
      var opened = maybeOpenAutoPopup(allowAutoPopup, activeId);
      if (opened) return true;
      if (!allowAutoPopup || !activeId || hasAutoPopupSeen(activeId)) return false;
      var store = ensureDiffState();
      var meta = store.byExecSetId[String(activeId)] || null;
      if (!meta || !hasUnackedDiff(meta) || !hasChangeSignal(meta)) return false;
      var fallbackOpened = openDrawer({ auto: true, execSetId: activeId });
      if (fallbackOpened) {
        clearAutoPopup(activeId, meta);
        markAutoPopupSeen(activeId, meta);
      }
      return fallbackOpened;
    }

    function destroy() {
      clearLocateHighlight();
      if (tableController && typeof tableController.destroy === 'function') tableController.destroy();
      tableController = null;
      if (drawer && drawer.element && typeof drawer.element.removeEventListener === 'function') {
        drawer.element.removeEventListener('click', handleDrawerClick);
      }
      drawer = null;
    }

    return {
      normalizeDiffKind: normalizeDiffKind,
      normalizeCaseLibDiffItemId: normalizeCaseLibDiffItemId,
      findTempExecCaseIndexByItemId: findTempExecCaseIndexByItemId,
      syncTempExecCaseLibraryChangesButton: syncChangesButton,
      clearTempExecLocateHighlight: clearLocateHighlight,
      flashTempExecLocate: flashLocate,
      scrollToTempExecCaseRow: scrollToCaseRow,
      locateTempExecCaseFromDiff: locateCaseFromDiff,
      renderTempExecCaseLibraryDiffCaseTabs: renderCaseTabs,
      renderTempExecCaseLibraryDiff: renderDiff,
      openTempExecCaseLibraryDiffDrawer: openDrawer,
      tryAutoOpenTempExecCaseLibraryDiff: tryAutoOpen,
      destroy: destroy,
    };
  }

  return {
    create: create,
    normalizeDiffKind: normalizeDiffKind,
    normalizeCaseLibDiffItemId: normalizeCaseLibDiffItemId,
    findTempExecCaseIndexByItemId: findTempExecCaseIndexByItemId,
  };
});
