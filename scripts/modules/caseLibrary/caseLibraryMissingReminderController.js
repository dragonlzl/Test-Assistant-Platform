(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.missingReminderController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var apiClient = opts.apiClient || null;
    var model = opts.model || null;
    var view = opts.view || null;
    if (!model || !view) throw new Error('Missing reminder model and view are required');

    var normalizeTypeIds = typeof opts.normalizeTypeIds === 'function'
      ? opts.normalizeTypeIds
      : function(values) { return Array.isArray(values) ? values.map(String) : []; };
    var resolveTypeNames = typeof opts.resolveTypeNames === 'function'
      ? opts.resolveTypeNames
      : function(ids, names) { return Array.isArray(names) ? names.slice() : []; };
    var resolveTypeLabel = typeof opts.resolveTypeLabel === 'function'
      ? opts.resolveTypeLabel
      : function(id) { return '类型#' + id; };
    var formatTypeLabel = typeof opts.formatTypeLabel === 'function'
      ? opts.formatTypeLabel
      : function(item) { return item && item.type_name ? item.type_name : '未分类'; };
    var openMissingDrawer = typeof opts.openMissingDrawer === 'function' ? opts.openMissingDrawer : function() {};
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function'
      ? opts.openConfirmDrawer
      : function() { return Promise.resolve({ ok: true }); };
    var showToast = typeof opts.showToast === 'function' ? opts.showToast : function() {};
    var getCore = typeof opts.getCore === 'function' ? opts.getCore : function() { return null; };
    var getAssignments = typeof opts.getAssignments === 'function' ? opts.getAssignments : function() { return {}; };
    var getDefaultPrompt = typeof opts.getDefaultPrompt === 'function' ? opts.getDefaultPrompt : function() { return ''; };
    var getManager = typeof opts.getManager === 'function' ? opts.getManager : function() { return null; };
    var getSettings = typeof opts.getSettings === 'function' ? opts.getSettings : function() { return {}; };
    var eventTarget = opts.eventTarget || (typeof window !== 'undefined' ? window : null);
    var observerCtor = opts.IntersectionObserver
      || (typeof IntersectionObserver === 'function' ? IntersectionObserver : null);
    var scheduleTimeout = typeof opts.setTimeout === 'function' ? opts.setTimeout : setTimeout;
    var cancelTimeout = typeof opts.clearTimeout === 'function' ? opts.clearTimeout : clearTimeout;
    var bound = false;

    function ensureState() {
      return model.ensureState(state);
    }

    function resolvePlacement() {
      var settings = getSettings() || {};
      var raw = settings.missingCaseReminderPlacement;
      return String(raw || '').toLowerCase() === 'bottom' ? 'bottom' : 'top';
    }

    function resolveMatchConfig(value) {
      var settings = getSettings() || {};
      var raw = value === undefined ? settings.missingCaseReminderMatchConfig : value;
      return model.resolveMatchConfig(raw, { type: true, module: true });
    }

    function isAiEnabled() {
      var settings = getSettings() || {};
      return String(settings.missingCaseReminderAiEnabled || '').toLowerCase() === 'on';
    }

    function getEditorContext() {
      var file = state.editor && state.editor.caseFile ? state.editor.caseFile : null;
      var projectId = file && (file.project_id || file.project_id === 0) ? String(file.project_id) : '';
      return {
        visible: Boolean(dom.editCard && dom.editCard.classList && !dom.editCard.classList.contains('hidden')),
        projectId: projectId,
        items: state.editor && Array.isArray(state.editor.items) ? state.editor.items : [],
      };
    }

    function applyAiTaskState(reminder, task) {
      if (!reminder || !task || task.scene !== 'case-library') return false;
      var signature = task.contextSignature ? String(task.contextSignature) : '';
      if (!signature) return false;
      syncAiContext(reminder);
      if (!reminder.aiContextSignature || reminder.aiContextSignature !== signature) return false;
      reminder.aiSignature = signature;
      reminder.aiProjectId = task.projectId || '';
      reminder.aiLoading = task.status === 'running';
      reminder.aiGenerated = task.status === 'done' || task.status === 'error';
      reminder.aiError = task.status === 'error' ? (task.error || '') : '';
      reminder.aiIds = Array.isArray(task.resultIds) ? task.resultIds.slice() : [];
      reminder.aiItems = model.selectAiItems(reminder.aiIds, task.itemMap);
      if (Array.isArray(task.matchedModules)) reminder.matchedModules = task.matchedModules.slice();
      if (Array.isArray(task.matchedTypes)) reminder.matchedTypes = task.matchedTypes.slice();
      if (task.libraryEmpty !== undefined) {
        reminder.libraryEmpty = task.libraryEmpty === true;
        reminder.libraryChecked = true;
        reminder.libraryLoading = false;
        reminder.libraryProjectId = task.projectId || '';
      }
      return true;
    }

    function syncAiTaskState(reminder) {
      var manager = getManager();
      if (!manager || typeof manager.getTask !== 'function') return false;
      return applyAiTaskState(reminder, manager.getTask('case-library'));
    }

    function resetLibraryStatus(reminder) {
      var target = reminder || ensureState();
      target.libraryEmpty = false;
      target.libraryChecked = false;
      target.libraryLoading = false;
      target.libraryProjectId = '';
      target.librarySeq = (target.librarySeq || 0) + 1;
    }

    function showLibraryEmptyToast() {
      showToast('易漏库没有任何用例，请点击上方“跳转到易漏用例库”进行添加。', 'warn', 3000);
    }

    function checkLibraryStatus(reminder, projectId) {
      var target = reminder || ensureState();
      var id = projectId ? String(projectId) : '';
      if (!id) {
        resetLibraryStatus(target);
        return;
      }
      if (target.libraryChecked && target.libraryProjectId === id) return;
      if (target.libraryLoading && target.libraryProjectId === id) return;
      if (!apiClient || typeof apiClient.listMissingModules !== 'function') return;
      var seq = (target.librarySeq || 0) + 1;
      target.librarySeq = seq;
      target.libraryLoading = true;
      target.libraryProjectId = id;
      apiClient.listMissingModules(id).then(function(modules) {
        if (target.librarySeq !== seq) return;
        target.libraryEmpty = model.isLibraryEmpty(modules);
        target.libraryChecked = true;
        target.libraryLoading = false;
        render();
      }).catch(function() {
        if (target.librarySeq !== seq) return;
        target.libraryEmpty = false;
        target.libraryChecked = false;
        target.libraryLoading = false;
        render();
      });
    }

    function cleanupObserver(reminder) {
      if (reminder.observer) {
        reminder.observer.disconnect();
        reminder.observer = null;
      }
      reminder.observerTarget = null;
      if (reminder.scrollHandler && eventTarget && typeof eventTarget.removeEventListener === 'function') {
        eventTarget.removeEventListener('scroll', reminder.scrollHandler);
        eventTarget.removeEventListener('resize', reminder.scrollHandler);
        reminder.scrollHandler = null;
      }
      if (reminder.scrollTimer) {
        cancelTimeout(reminder.scrollTimer);
        reminder.scrollTimer = null;
      }
    }

    function scheduleLazyLoad() {
      var reminder = ensureState();
      if (!reminder.hasMatch || reminder.loading || reminder.loaded || !reminder.pendingPayload) return;
      var target = view.resolveTarget(resolvePlacement());
      if (!target) return;
      if (view.isInView(target)) {
        loadItems();
        return;
      }
      if (reminder.observerTarget !== target) cleanupObserver(reminder);
      if (reminder.observer) return;
      if (observerCtor) {
        reminder.observerTarget = target;
        reminder.observer = new observerCtor(function(entries) {
          (entries || []).forEach(function(entry) {
            if (entry && (entry.isIntersecting || entry.intersectionRatio > 0)) loadItems();
          });
        }, { root: null, rootMargin: '120px 0px', threshold: 0.01 });
        reminder.observer.observe(target);
        return;
      }
      reminder.observerTarget = target;
      if (!reminder.scrollHandler && eventTarget && typeof eventTarget.addEventListener === 'function') {
        reminder.scrollHandler = function() {
          if (reminder.scrollTimer) cancelTimeout(reminder.scrollTimer);
          reminder.scrollTimer = scheduleTimeout(function() {
            reminder.scrollTimer = null;
            if (!reminder.loaded && !reminder.loading && reminder.pendingPayload
              && view.isInView(reminder.observerTarget)) loadItems();
          }, 120);
        };
        eventTarget.addEventListener('scroll', reminder.scrollHandler, { passive: true });
        eventTarget.addEventListener('resize', reminder.scrollHandler);
      }
    }

    function render() {
      var reminder = ensureState();
      var aiEnabled = isAiEnabled();
      if (aiEnabled) syncAiTaskState(reminder);
      var result = view.render(reminder, {
        aiEnabled: aiEnabled,
        placement: resolvePlacement(),
      });
      if (!aiEnabled && result && result.visible) scheduleLazyLoad();
      return result;
    }

    function resetMatchState(reminder, loaded) {
      reminder.items = [];
      reminder.matchedModules = [];
      reminder.matchedTypes = [];
      reminder.hasMatch = false;
      reminder.pending = false;
      reminder.pendingPayload = null;
      reminder.loading = false;
      reminder.loaded = loaded === true;
    }

    function clear() {
      var reminder = ensureState();
      resetMatchState(reminder, false);
      reminder.signature = '';
      reminder.projectId = null;
      cleanupObserver(reminder);
      render();
    }

    function clearAi(reminder, options) {
      var target = reminder || ensureState();
      target.aiItems = [];
      target.aiIds = [];
      target.aiLoading = false;
      target.aiGenerated = false;
      target.aiError = '';
      target.aiSignature = '';
      target.aiProjectId = '';
      target.aiSeq = (target.aiSeq || 0) + 1;
      resetLibraryStatus(target);
      var manager = getManager();
      if (manager && typeof manager.clearTask === 'function') manager.clearTask('case-library');
      if (!options || options.keepContext !== true) {
        target.aiContextSignature = '';
        target.aiContextProjectId = '';
        target.aiContextReady = false;
      }
    }

    function requestRefresh() {
      var reminder = ensureState();
      if (reminder.refreshTimer) cancelTimeout(reminder.refreshTimer);
      reminder.refreshTimer = scheduleTimeout(function() {
        reminder.refreshTimer = null;
        refresh();
      }, 160);
    }

    function syncAiContext(reminder) {
      var target = reminder || ensureState();
      var editor = getEditorContext();
      if (!editor.visible || !editor.projectId || !editor.items.length) {
        target.aiContextReady = false;
        target.aiContextSignature = '';
        target.aiContextProjectId = '';
        return false;
      }
      var context = model.buildAiContext(editor.items);
      if (!context.texts.length) {
        target.aiContextReady = false;
        target.aiContextSignature = '';
        target.aiContextProjectId = '';
        return false;
      }
      target.aiContextSignature = editor.projectId + ':' + model.hashText(context.signatureText);
      target.aiContextProjectId = editor.projectId;
      target.aiContextReady = true;
      return true;
    }

    function refresh() {
      var reminder = ensureState();
      if (isAiEnabled()) {
        if (syncAiContext(reminder)) checkLibraryStatus(reminder, reminder.aiContextProjectId);
        else resetLibraryStatus(reminder);
        render();
        return;
      }
      var editor = getEditorContext();
      if (!editor.visible || !editor.projectId || !editor.items.length) {
        clear();
        return;
      }
      var context = model.buildSearchContext(editor.items);
      if (!context.texts.length) {
        clear();
        return;
      }
      var matchConfig = resolveMatchConfig();
      var matchKey = (matchConfig.type ? 't' : '') + (matchConfig.module ? 'm' : '');
      var signature = editor.projectId + ':' + model.hashText(context.signatureText) + ':' + matchKey;
      if (reminder.signature === signature && reminder.projectId === editor.projectId
        && (reminder.loaded || reminder.pending)) {
        render();
        return;
      }
      reminder.signature = signature;
      reminder.projectId = editor.projectId;
      resetMatchState(reminder, false);
      cleanupObserver(reminder);
      if (!apiClient || typeof apiClient.listMissingModules !== 'function'
        || typeof apiClient.listMissingTypes !== 'function') {
        clear();
        return;
      }
      var seq = (reminder.seq || 0) + 1;
      reminder.seq = seq;
      Promise.all([
        apiClient.listMissingModules(editor.projectId),
        apiClient.listMissingTypes(editor.projectId),
      ]).then(function(result) {
        if (reminder.seq !== seq) return null;
        var modules = Array.isArray(result && result[0]) ? result[0] : [];
        var types = Array.isArray(result && result[1]) ? result[1] : [];
        var catalogs = model.matchCatalogs(modules, types, context.searchText);
        if ((matchConfig.module && !catalogs.moduleIds.length)
          || (matchConfig.type && !catalogs.typeIds.length)
          || !catalogs.allModuleIds.length) {
          resetMatchState(reminder, true);
          render();
          return null;
        }
        var moduleIds = matchConfig.module ? catalogs.moduleIds.slice() : catalogs.allModuleIds.slice();
        var typeIds = matchConfig.type ? catalogs.typeIds.slice() : catalogs.allTypeIds.slice();
        reminder.matchedModules = catalogs.matchedModules;
        reminder.matchedTypes = catalogs.matchedTypes;
        reminder.hasMatch = true;
        reminder.pending = true;
        reminder.pendingPayload = {
          moduleIds: moduleIds,
          typeIds: typeIds,
          moduleMap: catalogs.moduleMap,
          typeNameMap: catalogs.typeNameMap,
          matchedModuleMap: catalogs.matchedModuleMap,
          matchedTypeMap: catalogs.matchedTypeMap,
          matchConfig: matchConfig,
          fieldTextMap: model.buildFieldTextMap(editor.items),
        };
        render();
        return null;
      }).catch(function() {
        if (reminder.seq !== seq) return;
        resetMatchState(reminder, false);
        cleanupObserver(reminder);
        render();
      });
    }

    function normalizeModuleItem(item, moduleId, moduleMap, typeNameMap) {
      var clone = item && typeof item === 'object' ? Object.assign({}, item) : {};
      clone.module_id = moduleId;
      clone.module_name = moduleMap[moduleId] && moduleMap[moduleId].name
        ? moduleMap[moduleId].name
        : ('模块#' + moduleId);
      var typeIds = normalizeTypeIds(clone.type_ids);
      if (!typeIds.length && clone.type_id) typeIds = normalizeTypeIds([clone.type_id]);
      var baseNames = resolveTypeNames(typeIds, clone.type_names || (clone.type_name ? [clone.type_name] : []));
      clone.type_ids = typeIds;
      clone.type_names = typeIds.map(function(typeId, index) {
        return typeNameMap[String(typeId)] || baseNames[index] || resolveTypeLabel(typeId, null);
      });
      clone.type_name = clone.type_names.length ? clone.type_names.join('、') : '未分类';
      return clone;
    }

    function loadModuleItems(moduleIds, moduleMap, typeNameMap) {
      return Promise.all((moduleIds || []).map(function(moduleId) {
        return apiClient.listMissingModuleItems(moduleId).then(function(items) {
          return (Array.isArray(items) ? items : []).map(function(item) {
            return normalizeModuleItem(item, moduleId, moduleMap, typeNameMap);
          });
        }).catch(function() { return []; });
      })).then(function(groups) {
        var combined = [];
        (groups || []).forEach(function(items) {
          (items || []).forEach(function(item) { if (item) combined.push(item); });
        });
        return combined;
      });
    }

    function loadItems() {
      var reminder = ensureState();
      if (!reminder.pendingPayload || reminder.loading || reminder.loaded) return;
      if (!apiClient || typeof apiClient.listMissingModuleItems !== 'function') {
        clear();
        return;
      }
      var payload = reminder.pendingPayload || {};
      var moduleIds = Array.isArray(payload.moduleIds) ? payload.moduleIds.slice() : [];
      var typeIds = Array.isArray(payload.typeIds) ? payload.typeIds.slice() : [];
      var matchConfig = resolveMatchConfig(payload.matchConfig);
      if (!moduleIds.length
        || (matchConfig.module && !Object.keys(payload.matchedModuleMap || {}).length)
        || (matchConfig.type && (!typeIds.length || !Object.keys(payload.matchedTypeMap || {}).length))) {
        clear();
        return;
      }
      reminder.pending = false;
      reminder.pendingPayload = null;
      reminder.loading = true;
      reminder.loaded = false;
      cleanupObserver(reminder);
      render();
      var seq = (reminder.seq || 0) + 1;
      reminder.seq = seq;
      loadModuleItems(moduleIds, payload.moduleMap || {}, payload.typeNameMap || {}).then(function(items) {
        if (reminder.seq !== seq) return null;
        var combined = items.filter(function(item) {
          return model.itemMatches(
            item,
            payload.matchedModuleMap || {},
            payload.matchedTypeMap || {},
            matchConfig,
            normalizeTypeIds,
            'all'
          );
        });
        if (!combined.length) {
          resetMatchState(reminder, true);
          render();
          return null;
        }
        reminder.items = model.sortAndLimit(combined, payload.fieldTextMap || {}, reminder);
        reminder.loading = false;
        reminder.loaded = true;
        render();
        return null;
      }).catch(function() {
        if (reminder.seq !== seq) return;
        reminder.items = [];
        reminder.loading = false;
        reminder.loaded = false;
        render();
      });
    }

    function fetchAiCandidates(projectId, searchText) {
      return Promise.all([
        apiClient.listMissingModules(projectId),
        apiClient.listMissingTypes(projectId),
      ]).then(function(result) {
        var modules = Array.isArray(result && result[0]) ? result[0] : [];
        var types = Array.isArray(result && result[1]) ? result[1] : [];
        var catalogs = model.matchCatalogs(modules, types, searchText);
        var response = {
          items: [],
          matchedModules: catalogs.matchedModules,
          matchedTypes: catalogs.matchedTypes,
          libraryEmpty: model.isLibraryEmpty(modules),
        };
        var hasModuleMatch = catalogs.moduleIds.length > 0;
        var hasTypeMatch = catalogs.typeIds.length > 0;
        if (!hasModuleMatch && !hasTypeMatch) return response;
        var loadIds = hasTypeMatch ? catalogs.allModuleIds.slice() : catalogs.moduleIds.slice();
        if (!loadIds.length) return response;
        return loadModuleItems(loadIds, catalogs.moduleMap, catalogs.typeNameMap).then(function(items) {
          response.items = items.filter(function(item) {
            return model.itemMatches(
              item,
              catalogs.matchedModuleMap,
              catalogs.matchedTypeMap,
              { type: true, module: true },
              normalizeTypeIds,
              'any'
            );
          });
          return response;
        });
      });
    }

    function runAiRecommend() {
      var reminder = ensureState();
      if (reminder.aiLoading) return;
      if (!syncAiContext(reminder)) {
        reminder.aiError = '暂无可用于推荐的用例内容';
        reminder.aiGenerated = true;
        reminder.aiLoading = false;
        reminder.aiItems = [];
        reminder.aiIds = [];
        render();
        return;
      }
      var editor = getEditorContext();
      var context = model.buildAiContext(editor.items);
      var fieldTextMap = model.buildFieldTextMap(editor.items);
      var core = getCore();
      if (!core || typeof core.callModelWithConfig !== 'function' || typeof core.getAssignedModel !== 'function') {
        reminder.aiError = '模型客户端不可用，请刷新页面后重试';
        reminder.aiGenerated = true;
        reminder.aiLoading = false;
        reminder.aiItems = [];
        reminder.aiIds = [];
        render();
        return;
      }
      var assignedModel;
      try {
        assignedModel = core.getAssignedModel('missingreminder');
      } catch (err) {
        reminder.aiError = err && err.message ? err.message : '未找到易漏用例推荐模型';
        reminder.aiGenerated = true;
        reminder.aiLoading = false;
        reminder.aiItems = [];
        reminder.aiIds = [];
        render();
        return;
      }
      var projectId = reminder.aiContextProjectId;
      var signature = reminder.aiContextSignature;
      reminder.aiLoading = true;
      reminder.aiGenerated = false;
      reminder.aiError = '';
      reminder.aiItems = [];
      reminder.aiIds = [];
      reminder.aiSignature = signature;
      reminder.aiProjectId = projectId;
      var seq = (reminder.aiSeq || 0) + 1;
      reminder.aiSeq = seq;
      render();
      fetchAiCandidates(projectId, String(context.searchText || '').toLowerCase()).then(function(result) {
        if (reminder.aiSeq !== seq) return null;
        var candidates = result && Array.isArray(result.items) ? result.items : [];
        reminder.matchedModules = result && Array.isArray(result.matchedModules) ? result.matchedModules : [];
        reminder.matchedTypes = result && Array.isArray(result.matchedTypes) ? result.matchedTypes : [];
        if (result && result.libraryEmpty !== undefined) {
          reminder.libraryEmpty = result.libraryEmpty === true;
          reminder.libraryChecked = true;
          reminder.libraryLoading = false;
          reminder.libraryProjectId = projectId;
        }
        if (!candidates.length) {
          reminder.aiLoading = false;
          reminder.aiGenerated = true;
          reminder.aiItems = [];
          reminder.aiIds = [];
          if (reminder.libraryEmpty) showLibraryEmptyToast();
          render();
          return null;
        }
        var snapshot = model.buildAiCandidateSnapshot(candidates, fieldTextMap, formatTypeLabel);
        var assignments = getAssignments() || {};
        var prompt = assignments.missingReminderPrompt || getDefaultPrompt();
        var reasoning = assignments.missingReminderReasoning || '';
        var temperature = assignments.missingReminderTemperature !== undefined
          ? assignments.missingReminderTemperature
          : 0.2;
        var userText = JSON.stringify({
          current_cases: context.entries,
          candidate_map: snapshot.map,
        }, null, 2);
        var manager = getManager();
        if (manager && typeof manager.createTask === 'function' && typeof manager.startTask === 'function') {
          var task = manager.createTask('case-library', {
            contextSignature: signature,
            projectId: projectId,
            model: assignedModel,
            prompt: prompt,
            reasoning: reasoning,
            temperature: temperature,
            userText: userText,
            itemMap: snapshot.itemMap,
            matchedModules: reminder.matchedModules,
            matchedTypes: reminder.matchedTypes,
            libraryEmpty: reminder.libraryEmpty === true,
          });
          manager.startTask('case-library', task);
          return null;
        }
        return core.callModelWithConfig(assignedModel, userText, prompt, reasoning, temperature)
          .then(function(content) {
            if (reminder.aiSeq !== seq) return null;
            reminder.aiIds = model.parseAiIds(content);
            reminder.aiItems = model.selectAiItems(reminder.aiIds, snapshot.itemMap);
            reminder.aiLoading = false;
            reminder.aiGenerated = true;
            render();
            return null;
          });
      }).catch(function(err) {
        if (reminder.aiSeq !== seq) return;
        reminder.aiLoading = false;
        reminder.aiGenerated = true;
        reminder.aiItems = [];
        reminder.aiIds = [];
        reminder.aiError = 'AI 推荐失败：' + (err && err.message ? err.message : err);
        render();
      });
    }

    function triggerAiRecommend() {
      var reminder = ensureState();
      if (!isAiEnabled() || reminder.aiLoading) return;
      if (syncAiContext(reminder)) {
        checkLibraryStatus(reminder, reminder.aiContextProjectId);
        if (reminder.libraryChecked && reminder.libraryEmpty) {
          showLibraryEmptyToast();
          return;
        }
      }
      if (model.hasAiGenerated(reminder)) {
        openConfirmDrawer({
          title: '重新生成 AI 推荐',
          message: '已有 AI 推荐结果，是否重新生成？',
          confirmText: '重新生成',
          cancelText: '取消',
        }).then(function(result) {
          if (result && result.ok === true) runAiRecommend();
        });
        return;
      }
      runAiRecommend();
    }

    function handleAction(event) {
      var target = event && event.target && event.target.closest
        ? event.target.closest('[data-missing-reminder-ai],[data-missing-reminder-link]')
        : null;
      if (!target) return;
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      if (target.getAttribute('data-missing-reminder-ai')) {
        if (!target.disabled) triggerAiRecommend();
        return;
      }
      if (target.getAttribute('data-missing-reminder-link')) {
        openMissingDrawer({ allowInactive: true, force: true });
      }
    }

    function handleSettingsUpdated(event) {
      var detail = event && event.detail ? event.detail : null;
      var keys = detail && Array.isArray(detail.keys) ? detail.keys : [];
      var touchedAi = keys.indexOf('missingCaseReminderAiEnabled') !== -1;
      if (touchedAi && !isAiEnabled()) clearAi(ensureState());
      if (!keys.length
        || keys.indexOf('missingCaseReminderPlacement') !== -1
        || keys.indexOf('missingCaseReminderMatchConfig') !== -1
        || touchedAi) {
        requestRefresh();
        render();
      }
    }

    function handleAiTaskEvent(event) {
      var detail = event && event.detail ? event.detail : null;
      if (!detail || detail.scene !== 'case-library' || !isAiEnabled()) return;
      if (applyAiTaskState(ensureState(), detail.task)) render();
    }

    function bindEvents() {
      if (bound) return;
      bound = true;
      if (dom.missingReminderTop && dom.missingReminderTop.addEventListener) {
        dom.missingReminderTop.addEventListener('click', handleAction);
      }
      if (dom.missingReminderBottom && dom.missingReminderBottom.addEventListener) {
        dom.missingReminderBottom.addEventListener('click', handleAction);
      }
      if (eventTarget && typeof eventTarget.addEventListener === 'function') {
        eventTarget.addEventListener('app-settings-loaded', render);
        eventTarget.addEventListener('app-settings-updated', handleSettingsUpdated);
        eventTarget.addEventListener('missing-reminder-ai-task', handleAiTaskEvent);
      }
    }

    ensureState();
    return {
      ensureState: ensureState,
      requestRefresh: requestRefresh,
      refresh: refresh,
      render: render,
      clear: clear,
      clearAi: clearAi,
      applyAiTaskState: applyAiTaskState,
      syncAiContext: syncAiContext,
      triggerAiRecommend: triggerAiRecommend,
      loadItems: loadItems,
      bindEvents: bindEvents,
    };
  }

  return { create: create };
});
