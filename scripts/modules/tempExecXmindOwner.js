(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.tempExecXmindOwner = api;
  }
})(function() {
  function normalizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function normalizeCase(item) {
    var row = item && typeof item === 'object' ? item : {};
    var module = normalizeText(row.module || row.module_name || row['模块']);
    var title = normalizeText(row.title || row.case_title || row['用例标题']);
    var priority = normalizeText(row.priority || row.level || row['优先级']) || 'P1';
    var precondition = normalizeText(row.preconditions || row.precondition || row['前提条件']);
    var steps = normalizeText(row.steps || row.actions || row['操作步骤']);
    var expected = normalizeText(row.expected || row.result || row['预期结果']);
    return {
      module: module,
      title: title,
      priority: priority,
      preconditions: precondition,
      precondition: precondition,
      steps: steps,
      expected: expected,
    };
  }

  function buildStrictKey(item) {
    var row = normalizeCase(item || {});
    return [row.module, row.title, row.priority, row.preconditions, row.steps, row.expected]
      .map(function(segment) { return normalizeText(segment).toLowerCase(); })
      .join('::');
  }

  function buildLooseKey(item) {
    var row = normalizeCase(item || {});
    return [row.module, row.title, row.expected]
      .map(function(segment) { return normalizeText(segment).toLowerCase(); })
      .join('::');
  }

  function normalizeLocatePath(path) {
    if (!Array.isArray(path)) return [];
    return path.map(function(segment) {
      if (segment === null || segment === undefined) return '';
      return String(segment).trim();
    });
  }

  function buildLocatePaths(list, mindApi) {
    var items = Array.isArray(list) ? list : [];
    if (mindApi && typeof mindApi.buildPathsFromCases === 'function') {
      try {
        var built = mindApi.buildPathsFromCases(items, { fallbackModule: '执行模块' });
        if (Array.isArray(built) && built.length) {
          return built.map(function(path) { return normalizeLocatePath(path); });
        }
      } catch (err) {
        // Fall back to the normalized execution fields.
      }
    }
    return items.map(function(item) {
      var row = normalizeCase(item || {});
      return normalizeLocatePath([
        row.module,
        row.title,
        row.priority,
        row.preconditions,
        row.steps,
        row.expected,
      ]);
    });
  }

  function isLocatePathMatch(targetPath, fullPath) {
    var target = Array.isArray(targetPath) ? targetPath : [];
    var full = Array.isArray(fullPath) ? fullPath : [];
    if (!target.length || full.length < target.length) return false;
    for (var index = 0; index < target.length; index += 1) {
      if (target[index] !== full[index]) return false;
    }
    return true;
  }

  function findCaseIndexByPath(path, list, mindApi) {
    var targetPath = normalizeLocatePath(path);
    if (!targetPath.length) return -1;
    var locatePaths = buildLocatePaths(list, mindApi);
    for (var index = 0; index < locatePaths.length; index += 1) {
      if (isLocatePathMatch(targetPath, locatePaths[index])) return index;
    }
    return -1;
  }

  function resolveExecCaseId(item) {
    if (!item || typeof item !== 'object') return 0;
    var id = item.execCaseId || item.id || 0;
    var numericId = Number(id);
    if (!isFinite(numericId) || numericId <= 0) return 0;
    return numericId;
  }

  function isStructureSame(oldRow, newRow) {
    var left = normalizeCase(oldRow || {});
    var right = normalizeCase(newRow || {});
    return left.module === right.module
      && left.title === right.title
      && left.priority === right.priority
      && left.preconditions === right.preconditions
      && left.steps === right.steps
      && left.expected === right.expected;
  }

  function buildPatchDiff(existingCases, nextCases) {
    var oldList = Array.isArray(existingCases) ? existingCases : [];
    var nextList = Array.isArray(nextCases) ? nextCases : [];
    var oldSlots = oldList.map(function(item, index) {
      return { index: index, item: item, normalized: normalizeCase(item), matched: false };
    });
    var nextSlots = nextList.map(function(item, index) {
      return { index: index, raw: item, normalized: normalizeCase(item), matchedOld: null };
    });

    function matchBy(buildOldKey, buildNextKey) {
      nextSlots.forEach(function(nextSlot) {
        if (nextSlot.matchedOld) return;
        var targetKey = buildNextKey(nextSlot.normalized);
        for (var index = 0; index < oldSlots.length; index += 1) {
          var oldSlot = oldSlots[index];
          if (oldSlot.matched || buildOldKey(oldSlot.normalized) !== targetKey) continue;
          oldSlot.matched = true;
          nextSlot.matchedOld = oldSlot;
          break;
        }
      });
    }

    matchBy(buildStrictKey, buildStrictKey);
    matchBy(buildLooseKey, buildLooseKey);

    var merged = [];
    var updates = [];
    var creates = [];
    var deletes = [];
    nextSlots.forEach(function(slot) {
      var normalized = slot.normalized;
      if (slot.matchedOld) {
        var oldItem = slot.matchedOld.item || {};
        var mergedItem = Object.assign({}, oldItem, {
          module: normalized.module,
          title: normalized.title,
          priority: normalized.priority,
          preconditions: normalized.preconditions,
          precondition: normalized.preconditions,
          steps: normalized.steps,
          expected: normalized.expected,
        });
        merged.push(mergedItem);
        if (!isStructureSame(oldItem, normalized)) {
          updates.push({
            oldItem: oldItem,
            newItem: mergedItem,
            payload: {
              module: mergedItem.module,
              title: mergedItem.title,
              priority: mergedItem.priority,
              precondition: mergedItem.preconditions,
              steps: mergedItem.steps,
              expected: mergedItem.expected,
            },
          });
        }
        return;
      }
      var createItem = {
        id: 'xmind-' + Date.now().toString(16) + '-' + String(slot.index),
        module: normalized.module,
        title: normalized.title,
        priority: normalized.priority,
        preconditions: normalized.preconditions,
        precondition: normalized.preconditions,
        steps: normalized.steps,
        expected: normalized.expected,
        actual: '未执行',
        remark: '',
        reuseDetails: [],
        defectLinks: [],
      };
      merged.push(createItem);
      creates.push({
        item: createItem,
        payload: {
          module: createItem.module,
          title: createItem.title,
          priority: createItem.priority,
          precondition: createItem.preconditions,
          steps: createItem.steps,
          expected: createItem.expected,
          status: createItem.actual,
          remark: createItem.remark,
          reuse_details: createItem.reuseDetails,
          defect_links: createItem.defectLinks,
        },
      });
    });
    oldSlots.forEach(function(oldSlot) {
      if (!oldSlot.matched) deletes.push({ item: oldSlot.item || null });
    });
    return { merged: merged, updates: updates, creates: creates, deletes: deletes };
  }

  function resolveDirection(items) {
    var modules = {};
    var count = 0;
    (Array.isArray(items) ? items : []).forEach(function(item) {
      var key = String(item && item.module ? item.module : '').replace(/\s+/g, ' ').trim();
      if (!key || modules[key]) return;
      modules[key] = true;
      count += 1;
    });
    return count > 2 ? 'side' : 'right';
  }

  function resolveRootNodeId(mindData) {
    return mindData && mindData.nodeData && mindData.nodeData.id
      ? String(mindData.nodeData.id)
      : '';
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var api = opts.api && typeof opts.api === 'object' ? opts.api : {};
    var utils = opts.utils && typeof opts.utils === 'object' ? opts.utils : {};
    var window = opts.window || (typeof globalThis !== 'undefined' ? globalThis : null);
    var document = opts.document || (window && window.document ? window.document : null);
    var statusElement = opts.statusElement || null;
    var titleElement = opts.titleElement || null;
    var bodyElement = opts.bodyElement || null;
    var setStatus = typeof opts.setStatus === 'function' ? opts.setStatus : function() {};
    var normalizeRequirementName = typeof opts.normalizeRequirementName === 'function'
      ? opts.normalizeRequirementName
      : function(value) { return value || ''; };
    var safeLogOperation = typeof opts.safeLogOperation === 'function' ? opts.safeLogOperation : function() {};
    var jumpToCase = typeof opts.jumpToCase === 'function' ? opts.jumpToCase : function() {};
    var flashLocate = typeof opts.flashLocate === 'function' ? opts.flashLocate : function() {};
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function'
      ? opts.openConfirmDrawer
      : function() { return Promise.resolve({ ok: false }); };
    var MutationObserverCtor = opts.MutationObserver
      || (window && window.MutationObserver ? window.MutationObserver : null);
    var drawer = null;
    var mindInstance = null;
    var themeObserver = null;
    var gestureGuard = { active: false, token: '', popHandler: null, restoring: false };

    function getMindApi() {
      return window && window.app && window.app.mindElixirCoreApi
        ? window.app.mindElixirCoreApi
        : null;
    }

    function ensureMindApiReady() {
      var readyApi = getMindApi();
      if (readyApi && typeof readyApi.renderMindMap === 'function') return Promise.resolve(readyApi);
      if (window && window.app && typeof window.app.ensureMindElixirCoreApi === 'function') {
        return window.app.ensureMindElixirCoreApi().then(getMindApi);
      }
      return Promise.resolve(readyApi);
    }

    function setViewerMode(enabled) {
      if (!bodyElement || !bodyElement.classList) return;
      if (enabled) bodyElement.classList.add('is-mind-viewer');
      else bodyElement.classList.remove('is-mind-viewer');
    }

    function markSkipScrollRestoreOnce() {
      try {
        if (window && window.app) window.app.__drawerSkipRestoreOnce = true;
      } catch (err) {
        // Ignore unavailable drawer state.
      }
    }

    function bindCloseScrollGuard(drawerElement) {
      if (!drawerElement || typeof drawerElement.addEventListener !== 'function') return;
      if (drawerElement.__tapXmindCloseScrollGuardBound) return;
      drawerElement.__tapXmindCloseScrollGuardBound = true;
      drawerElement.addEventListener('click', function(event) {
        var target = event && event.target && event.target.closest
          ? event.target.closest('[data-drawer-close="xmindStructureDrawer"]')
          : null;
        if (target) markSkipScrollRestoreOnce();
      }, true);
    }

    function enableGestureGuard() {
      if (gestureGuard.active || !window || !window.history) return;
      if (typeof window.addEventListener !== 'function' || typeof window.removeEventListener !== 'function') return;
      var token = 'tap-xmind-guard-' + Date.now() + '-' + Math.random().toString(16).slice(2);
      gestureGuard.token = token;
      gestureGuard.active = true;
      gestureGuard.restoring = false;
      try {
        window.history.pushState(
          { __tapXmindGestureGuard: token },
          document ? document.title : '',
          window.location ? window.location.href : undefined
        );
      } catch (err) {
        // Ignore unavailable history state.
      }
      var popHandler = function() {
        if (!gestureGuard.active || gestureGuard.restoring) return;
        if (window.history && typeof window.history.go === 'function') {
          try { window.history.go(1); } catch (err) {}
        }
      };
      gestureGuard.popHandler = popHandler;
      window.addEventListener('popstate', popHandler, true);
    }

    function disableGestureGuard() {
      if (!gestureGuard.active) return;
      var popHandler = gestureGuard.popHandler;
      gestureGuard.active = false;
      gestureGuard.popHandler = null;
      if (window && typeof window.removeEventListener === 'function' && popHandler) {
        window.removeEventListener('popstate', popHandler, true);
      }
      if (!window || !window.history) {
        gestureGuard.token = '';
        return;
      }
      var historyState = null;
      try { historyState = window.history.state; } catch (err) { historyState = null; }
      if (
        historyState
        && typeof historyState === 'object'
        && String(historyState.__tapXmindGestureGuard || '') === String(gestureGuard.token || '')
      ) {
        var nextState = {};
        try { nextState = JSON.parse(JSON.stringify(historyState)); } catch (err) { nextState = {}; }
        if (!nextState || typeof nextState !== 'object') nextState = {};
        delete nextState.__tapXmindGestureGuard;
        try {
          window.history.replaceState(
            nextState,
            document ? document.title : '',
            window.location ? window.location.href : undefined
          );
        } catch (err) {
          // Ignore unavailable history state.
        }
        gestureGuard.restoring = false;
      }
      gestureGuard.token = '';
    }

    function ensureDrawer() {
      if (drawer) return drawer;
      if (!window || !window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') {
        return null;
      }
      drawer = window.app.drawer.createDrawer({
        drawerId: 'xmindStructureDrawer',
        openButtons: [],
        closeButtons: ['closeXmindStructureDrawerBtn'],
        onOpen: enableGestureGuard,
        onClose: function() {
          disableGestureGuard();
          if (themeObserver && typeof themeObserver.disconnect === 'function') themeObserver.disconnect();
          themeObserver = null;
          var mindApi = getMindApi();
          if (mindApi && typeof mindApi.destroyMindMap === 'function') mindApi.destroyMindMap(mindInstance);
          mindInstance = null;
          if (bodyElement) {
            setViewerMode(false);
            bodyElement.innerHTML = '';
          }
        },
      });
      if (drawer && drawer.element) bindCloseScrollGuard(drawer.element);
      if (drawer && typeof drawer.close === 'function' && !drawer.__tapCloseWithSkipRestore) {
        var rawClose = drawer.close;
        drawer.close = function() {
          markSkipScrollRestoreOnce();
          return rawClose.apply(drawer, arguments);
        };
        drawer.__tapCloseWithSkipRestore = true;
      }
      return drawer;
    }

    function bindThemeSync(mindApi) {
      if (!mindApi || typeof mindApi.refreshMindTheme !== 'function') return;
      if (!document || !document.documentElement || !MutationObserverCtor) return;
      if (themeObserver && typeof themeObserver.disconnect === 'function') themeObserver.disconnect();
      themeObserver = new MutationObserverCtor(function() {
        if (mindInstance) mindApi.refreshMindTheme(mindInstance);
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });
    }

    function exportXmind() {
      if (!api || typeof api.exportTempExecToXmind !== 'function') {
        setStatus(statusElement, 'XMind 导出能力未就绪', 'err');
        return null;
      }
      var activeId = state && state.tempExecActiveId ? String(state.tempExecActiveId || '') : '';
      var execSetId = activeId ? Number(activeId) : null;
      safeLogOperation('export_exec_xmind', 'exec_set', Number.isFinite(execSetId) ? execSetId : null, {
        exec_set_id: Number.isFinite(execSetId) ? execSetId : null,
        format: 'xmind',
        with_result: true,
      });
      return api.exportTempExecToXmind();
    }

    function locateCase(activeFile, path, mindApi) {
      var file = activeFile && typeof activeFile === 'object' ? activeFile : null;
      var list = file && Array.isArray(file.cases) ? file.cases : [];
      var index = findCaseIndexByPath(path, list, mindApi);
      if (index < 0) {
        setStatus(statusElement, '未找到对应执行用例', 'warn');
        return;
      }
      var fileId = file && file.id ? file.id : state.tempExecActiveId;
      if (!fileId) {
        setStatus(statusElement, '当前执行用例未激活，无法定位', 'warn');
        return;
      }
      jumpToCase(fileId, index);
      flashLocate(fileId, index, 3200);
      setStatus(statusElement, '已定位到第 ' + String(index + 1) + ' 条执行用例', 'ok');
    }

    function canPersistToDb(file, client) {
      var target = file && typeof file === 'object' ? file : null;
      if (!target) return false;
      var execSetId = Number(target.execSetId || target.id || 0);
      if (!isFinite(execSetId) || execSetId <= 0 || !client) return false;
      if (
        typeof client.createExecCase !== 'function'
        || typeof client.updateExecCase !== 'function'
        || typeof client.deleteExecCase !== 'function'
      ) return false;
      var globalState = window && window.app && window.app.state ? window.app.state : {};
      return Boolean(globalState && globalState.currentUser && globalState.currentUser.id);
    }

    function applyCases(file, cases) {
      if (!file || !Array.isArray(cases)) return;
      file.cases = cases;
      if (api && typeof api.persistTempExecState === 'function') api.persistTempExecState();
      if (api && typeof api.renderTempExecView === 'function') api.renderTempExecView();
    }

    function saveCases(nextCases, summary) {
      var active = api && typeof api.getTempExecFile === 'function'
        ? api.getTempExecFile(state.tempExecActiveId)
        : null;
      if (!active) return Promise.reject(new Error('当前执行集不存在或已失效'));
      var existing = Array.isArray(active.cases) ? active.cases.slice() : [];
      var nextList = (Array.isArray(nextCases) ? nextCases : []).map(normalizeCase).filter(function(entry) {
        return Boolean(entry.module && entry.title && entry.expected);
      });
      var diff = buildPatchDiff(existing, nextList);
      var changeCount = diff.updates.length + diff.creates.length + diff.deletes.length;
      var apiClient = window && window.app && window.app.apiClient ? window.app.apiClient : null;
      var dbWritable = canPersistToDb(active, apiClient);
      var execSetId = Number(active.execSetId || active.id || 0);
      if (!changeCount) {
        applyCases(active, diff.merged);
        setStatus(statusElement, 'XMind 编辑无改动，已保持当前状态', 'ok');
        return Promise.resolve({ changed: 0, updates: 0, creates: 0, deletes: 0 });
      }
      setStatus(statusElement, '正在保存 XMind 编辑...', '');

      function finalizeSuccess() {
        applyCases(active, diff.merged);
        setStatus(statusElement, 'XMind 编辑保存成功', 'ok');
        safeLogOperation('save_exec_xmind_structure', 'exec_set', Number.isFinite(execSetId) ? execSetId : null, {
          exec_set_id: Number.isFinite(execSetId) ? execSetId : null,
          summary: summary || {},
          updates: diff.updates.length,
          creates: diff.creates.length,
          deletes: diff.deletes.length,
        });
        return {
          changed: changeCount,
          updates: diff.updates.length,
          creates: diff.creates.length,
          deletes: diff.deletes.length,
        };
      }

      if (!dbWritable) return Promise.resolve().then(finalizeSuccess);
      var chain = Promise.resolve();
      diff.deletes.forEach(function(entry) {
        var caseId = resolveExecCaseId(entry && entry.item ? entry.item : null);
        if (caseId) chain = chain.then(function() { return apiClient.deleteExecCase(caseId); });
      });
      diff.updates.forEach(function(entry) {
        var caseId = resolveExecCaseId(entry && entry.oldItem ? entry.oldItem : null);
        if (caseId) chain = chain.then(function() { return apiClient.updateExecCase(caseId, entry.payload || {}); });
      });
      diff.creates.forEach(function(entry) {
        chain = chain.then(function() {
          return apiClient.createExecCase(execSetId, entry.payload || {}).then(function(created) {
            if (!created || !entry || !entry.item) return;
            var nextId = Number(created.id || 0);
            if (isFinite(nextId) && nextId > 0) {
              entry.item.id = nextId;
              entry.item.execCaseId = nextId;
            }
            if (created.case_item_id || created.case_item_id === 0) entry.item.case_item_id = created.case_item_id;
          });
        });
      });
      return chain.then(finalizeSuccess).catch(function(error) {
        var message = error && error.message ? String(error.message) : '保存失败';
        setStatus(statusElement, 'XMind 编辑保存失败：' + message, 'err');
        throw error;
      });
    }

    async function open() {
      var mindApi = await ensureMindApiReady();
      if (!mindApi || typeof mindApi.buildMindDataFromCases !== 'function' || typeof mindApi.renderMindMap !== 'function') {
        setStatus(statusElement, 'XMind 结构渲染依赖未就绪', 'err');
        return;
      }
      var active = api && typeof api.getTempExecFile === 'function'
        ? api.getTempExecFile(state.tempExecActiveId)
        : null;
      var list = active && Array.isArray(active.cases) ? active.cases : [];
      if (!active || !list.length) {
        setStatus(statusElement, '当前用例无可展示内容', 'warn');
        return;
      }
      var activeDrawer = ensureDrawer();
      if (!activeDrawer || typeof activeDrawer.open !== 'function') {
        setStatus(statusElement, 'XMind 结构抽屉未就绪', 'err');
        return;
      }
      if (titleElement) titleElement.textContent = 'XMind 用例结构 - ' + (active.name || '当前用例');
      if (!bodyElement) {
        setStatus(statusElement, 'XMind 结构容器未找到', 'err');
        return;
      }
      activeDrawer.open();
      setViewerMode(true);
      bodyElement.innerHTML = '<div class="xmind-structure-viewer" id="tempExecXmindStructureViewer"></div>';
      var container = document && typeof document.getElementById === 'function'
        ? document.getElementById('tempExecXmindStructureViewer')
        : null;
      if (!container) {
        if (typeof activeDrawer.close === 'function') activeDrawer.close();
        setStatus(statusElement, 'XMind 结构容器初始化失败', 'err');
        return;
      }
      var rootTitle = normalizeRequirementName(active.name || active.requirement || '执行用例');
      var mindData = mindApi.buildMindDataFromCases(list, {
        rootTitle: rootTitle,
        fallbackModule: '执行模块',
      });
      try {
        mindInstance = mindApi.renderMindMap(container, mindData, {
          instance: mindInstance,
          direction: resolveDirection(list),
          initialCenterNodeId: resolveRootNodeId(mindData),
          enableCustomBoxSelection: true,
          onExportXmind: exportXmind,
          editableSessionKey: 'tap-temp-exec-xmind-edit-' + String(active.id || state.tempExecActiveId || ''),
          onSaveCases: saveCases,
          onNodeDblClickLocate: function(payload) {
            if (payload && Array.isArray(payload.path)) locateCase(active, payload.path, mindApi);
          },
          openConfirmDrawer: openConfirmDrawer,
          showToast: typeof utils.showCenterToast === 'function' ? utils.showCenterToast : null,
        });
        bindThemeSync(mindApi);
      } catch (error) {
        if (typeof console !== 'undefined' && console && typeof console.error === 'function') console.error(error);
        if (typeof activeDrawer.close === 'function') activeDrawer.close();
        setStatus(statusElement, 'XMind 结构渲染失败', 'err');
      }
    }

    return {
      open: open,
      exportXmind: exportXmind,
      saveCases: saveCases,
    };
  }

  return {
    create: create,
    normalizeCase: normalizeCase,
    buildPatchDiff: buildPatchDiff,
    findCaseIndexByPath: findCaseIndexByPath,
    resolveDirection: resolveDirection,
  };
});
