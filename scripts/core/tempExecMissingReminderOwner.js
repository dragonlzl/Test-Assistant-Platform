(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecMissingReminderOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function(root) {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var state = opts.state || {};
    var browser = opts.window || root || {};
    var documentRef = opts.document || (root && root.document ? root.document : null);
    var ObserverCtor = opts.IntersectionObserver
      || (browser && browser.IntersectionObserver ? browser.IntersectionObserver : null);
    var tempExecView = opts.tempExecView || null;
    var appUtils = opts.appUtils
      || (browser.app && browser.app.utils ? browser.app.utils : null);
    var normalizeMissingReminderMatchConfig = port('normalizeMissingReminderMatchConfig', function(value) {
      return value && typeof value === 'object' ? value : { type: true, module: true };
    });
    var stringifyCaseField = port('stringifyCaseField', function(value) {
      return value === null || value === undefined ? '' : String(value);
    });
    var buildMissingReminderKeywords = port('buildMissingReminderKeywords', function() { return []; });
    var escapeHtml = port('escapeHtml', function(value) {
      return value === null || value === undefined ? '' : String(value);
    });
    var getApiClient = port('getApiClient', function() {
      return browser.app && browser.app.apiClient ? browser.app.apiClient : null;
    });
    var renderTempExecView = port('renderTempExecView');
    var getTempExecFile = port('getTempExecFile', function() { return null; });
    var viewOwner = opts.missingReminderViewOwner
      || (browser.app && browser.app.tempExecMissingReminderViewOwner
        ? browser.app.tempExecMissingReminderViewOwner
        : null);
    if (!viewOwner || typeof viewOwner.create !== 'function') {
      throw new Error('Temp exec missing reminder view owner is required');
    }
    var getAssignedModel = port('getAssignedModel', function() {
      throw new Error('未配置模型');
    });
    var callModelWithConfig = port('callModelWithConfig', function() {
      return Promise.reject(new Error('模型客户端不可用'));
    });
    var openConfirmDrawer = port('openConfirmDrawer', function() {
      return Promise.resolve({ ok: true });
    });
    function ensureTempExecMissingReminderState() {
      if (!state.tempExecMissingReminder || typeof state.tempExecMissingReminder !== 'object') {
        state.tempExecMissingReminder = {
          projectId: '',
          signature: '',
          items: [],
          matchedModules: [],
          matchedTypes: [],
          hasMatch: false,
          pending: false,
          pendingPayload: null,
          loading: false,
          loaded: false,
          limit: 10,
          seq: 0,
          aiContextSignature: '',
          aiContextProjectId: '',
          aiContextReady: false,
          aiSignature: '',
          aiProjectId: '',
          aiItems: [],
          aiIds: [],
          aiLoading: false,
          aiGenerated: false,
          aiError: '',
          aiSeq: 0,
          libraryEmpty: false,
          libraryChecked: false,
          libraryLoading: false,
          libraryProjectId: '',
          librarySeq: 0,
          refreshTimer: null,
          observer: null,
          observerTarget: null,
          scrollHandler: null,
          scrollTimer: null,
        };
      }
      return state.tempExecMissingReminder;
    }

    function resolveMissingReminderPlacement() {
      var settings = state.settings && typeof state.settings === 'object' ? state.settings : {};
      var raw = settings.missingCaseReminderPlacement;
      var key = raw === null || raw === undefined ? '' : String(raw).toLowerCase();
      return key === 'bottom' ? 'bottom' : 'top';
    }

    function resolveMissingReminderMatchConfig() {
      var settings = state.settings && typeof state.settings === 'object' ? state.settings : {};
      var raw = settings.missingCaseReminderMatchConfig;
      return normalizeMissingReminderMatchConfig(raw, { type: true, module: true });
    }

    function resolveMissingReminderAiEnabled() {
      var settings = state.settings && typeof state.settings === 'object' ? state.settings : {};
      var raw = settings.missingCaseReminderAiEnabled;
      return String(raw || '').toLowerCase() === 'on' ? 'on' : 'off';
    }

    function hashReminderText(text) {
      var str = String(text || '');
      var hash = 0;
      for (var i = 0; i < str.length; i += 1) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return hash + ':' + str.length;
    }

    var tempExecSearchFields = [
      'module', 'title', 'priority', 'preconditions', 'precondition', 'steps', 'expected', 'actual', 'remark'
    ];
    var tempExecAiCaseFields = [
      'module', 'title', 'priority', 'precondition', 'preconditions', 'steps', 'expected'
    ];

    function buildTempExecAiCaseEntry(item) {
      if (!item || typeof item !== 'object') return null;
      var moduleVal = stringifyCaseField(item.module || item.module_name || '');
      var preconditionVal = stringifyCaseField(item.precondition || item.preconditions || '');
      return {
        module: moduleVal,
        title: stringifyCaseField(item.title || ''),
        priority: stringifyCaseField(item.priority || ''),
        precondition: preconditionVal,
        steps: stringifyCaseField(item.steps || ''),
        expected: stringifyCaseField(item.expected || ''),
      };
    }

    function buildTempExecAiCaseText(item) {
      if (!item || typeof item !== 'object') return '';
      var parts = [];
      tempExecAiCaseFields.forEach(function(key) {
        var val = stringifyCaseField(item[key]);
        if (val) parts.push(val);
      });
      return parts.join(' ').toLowerCase();
    }

    function buildTempExecAiCaseContext(cases) {
      var list = Array.isArray(cases) ? cases : [];
      var entries = [];
      var texts = [];
      list.forEach(function(item) {
        var entry = buildTempExecAiCaseEntry(item);
        if (entry) entries.push(entry);
        var text = buildTempExecAiCaseText(item);
        if (text) texts.push(text);
      });
      return {
        entries: entries,
        texts: texts,
        searchText: texts.join(' '),
        signatureText: texts.join('\n\n'),
      };
    }

    function buildTempExecCaseText(item) {
      if (!item || typeof item !== 'object') return '';
      var parts = [];
      tempExecSearchFields.forEach(function(key) {
        var val = stringifyCaseField(item[key]);
        if (val) parts.push(val);
      });
      return parts.join(' ').toLowerCase();
    }

    function buildTempExecCaseSearchText(cases) {
      var list = Array.isArray(cases) ? cases : [];
      if (!list.length) return '';
      var parts = [];
      list.forEach(function(item) {
        var text = buildTempExecCaseText(item);
        if (text) parts.push(text);
      });
      return parts.join('\n\n');
    }

    function buildTempExecCaseFieldText(item, keys) {
      if (!item || typeof item !== 'object') return '';
      var parts = [];
      (keys || []).forEach(function(key) {
        if (!key) return;
        var val = stringifyCaseField(item[key]);
        if (val) parts.push(val);
      });
      return parts.join(' ').toLowerCase();
    }

    function buildTempExecReminderFieldTextMap(cases) {
      var list = Array.isArray(cases) ? cases : [];
      var titles = [];
      var preconditions = [];
      var steps = [];
      var expected = [];
      list.forEach(function(item) {
        var title = buildTempExecCaseFieldText(item, ['title']);
        if (title) titles.push(title);
        var pre = buildTempExecCaseFieldText(item, ['precondition', 'preconditions']);
        if (pre) preconditions.push(pre);
        var step = buildTempExecCaseFieldText(item, ['steps']);
        if (step) steps.push(step);
        var exp = buildTempExecCaseFieldText(item, ['expected']);
        if (exp) expected.push(exp);
      });
      return {
        title: titles.join(' '),
        precondition: preconditions.join(' '),
        steps: steps.join(' '),
        expected: expected.join(' '),
      };
    }

    function hasReminderKeywordHit(text, keywords) {
      if (!text || !keywords || !keywords.length) return false;
      for (var i = 0; i < keywords.length; i += 1) {
        if (text.indexOf(keywords[i]) !== -1) return true;
      }
      return false;
    }

    function buildTempExecReminderScore(item, fieldTextMap) {
      if (!item || typeof item !== 'object') return 0;
      var map = fieldTextMap && typeof fieldTextMap === 'object' ? fieldTextMap : {};
      var score = 0;
      var titleKeys = buildMissingReminderKeywords(item.title);
      if (hasReminderKeywordHit(map.title, titleKeys)) score += 1;
      var preKeys = buildMissingReminderKeywords(item.precondition);
      if (hasReminderKeywordHit(map.precondition, preKeys)) score += 1;
      var stepKeys = buildMissingReminderKeywords(item.steps);
      if (hasReminderKeywordHit(map.steps, stepKeys)) score += 1;
      var expKeys = buildMissingReminderKeywords(item.expected);
      if (hasReminderKeywordHit(map.expected, expKeys)) score += 1;
      return score;
    }

    function resolveTempExecMissingReminderScoreLevel(score, fallback) {
      if (fallback) return String(fallback);
      var num = Number(score);
      if (!isFinite(num)) return '低';
      if (num >= 3) return '高';
      if (num >= 2) return '中';
      return '低';
    }

    function resolveTempExecMissingReminderLibraryEmpty(modules) {
      var list = Array.isArray(modules) ? modules : [];
      if (!list.length) return true;
      var hasCount = false;
      for (var i = 0; i < list.length; i += 1) {
        var item = list[i];
        if (!item) continue;
        if (item.item_count !== undefined && item.item_count !== null) {
          hasCount = true;
          var count = Number(item.item_count);
          if (isFinite(count) && count > 0) return false;
        }
      }
      if (!hasCount) return false;
      return true;
    }

    function getTempExecMissingReminderAiManager() {
      return browser.app && browser.app.missingReminderAi ? browser.app.missingReminderAi : null;
    }

    function buildTempExecMissingReminderAiItemsFromTask(task) {
      var ids = task && Array.isArray(task.resultIds) ? task.resultIds : [];
      var itemMap = task && task.itemMap && typeof task.itemMap === 'object' ? task.itemMap : {};
      var selected = [];
      var seen = {};
      ids.forEach(function(id) {
        var key = String(id || '').trim();
        if (!key || seen[key]) return;
        seen[key] = true;
        var item = itemMap[key];
        if (item) selected.push(Object.assign({}, item));
      });
      return selected;
    }

    function applyTempExecMissingReminderAiTaskState(reminder, task) {
      if (!reminder || !task || task.scene !== 'temp-exec') return false;
      var signature = task.contextSignature ? String(task.contextSignature) : '';
      if (!signature) return false;
      syncTempExecMissingReminderAiContext(reminder);
      if (!reminder.aiContextSignature || reminder.aiContextSignature !== signature) return false;
      reminder.aiSignature = signature;
      reminder.aiProjectId = task.projectId || '';
      reminder.aiLoading = task.status === 'running';
      reminder.aiGenerated = task.status === 'done' || task.status === 'error';
      reminder.aiError = task.status === 'error' ? (task.error || '') : '';
      reminder.aiIds = Array.isArray(task.resultIds) ? task.resultIds.slice() : [];
      reminder.aiItems = buildTempExecMissingReminderAiItemsFromTask(task);
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

    function syncTempExecMissingReminderAiTaskState(reminder) {
      var manager = getTempExecMissingReminderAiManager();
      if (!manager || typeof manager.getTask !== 'function') return false;
      var task = manager.getTask('temp-exec');
      return applyTempExecMissingReminderAiTaskState(reminder, task);
    }

    function resetTempExecMissingReminderLibrary(reminder) {
      var target = reminder || ensureTempExecMissingReminderState();
      target.libraryEmpty = false;
      target.libraryChecked = false;
      target.libraryLoading = false;
      target.libraryProjectId = '';
      target.librarySeq = (target.librarySeq || 0) + 1;
    }

    function showTempExecMissingReminderLibraryEmptyToast() {
      if (appUtils && typeof appUtils.showCenterToast === 'function') {
        appUtils.showCenterToast('易漏库没有任何用例，请点击上方“跳转到易漏用例库”进行添加。', 'warn', 3000);
      }
    }

    function checkTempExecMissingReminderLibrary(reminder, projectId) {
      var target = reminder || ensureTempExecMissingReminderState();
      var pid = projectId ? String(projectId) : '';
      if (!pid) {
        resetTempExecMissingReminderLibrary(target);
        return;
      }
      if (target.libraryChecked && target.libraryProjectId === pid) return;
      if (target.libraryLoading && target.libraryProjectId === pid) return;
      var client = getApiClient();
      if (!client || typeof client.listMissingModules !== 'function') return;
      var seq = (target.librarySeq || 0) + 1;
      target.librarySeq = seq;
      target.libraryLoading = true;
      target.libraryProjectId = pid;
      client.listMissingModules(pid)
        .then(function(modules) {
          if (target.librarySeq !== seq) return;
          target.libraryEmpty = resolveTempExecMissingReminderLibraryEmpty(modules);
          target.libraryChecked = true;
          target.libraryLoading = false;
          renderTempExecMissingReminderRegion();
        })
        .catch(function() {
          if (target.librarySeq !== seq) return;
          target.libraryEmpty = false;
          target.libraryChecked = false;
          target.libraryLoading = false;
          renderTempExecMissingReminderRegion();
        });
    }

    function normalizeMissingReminderTypeId(value) {
      if (value === null || value === undefined || value === '') return null;
      var num = Number(value);
      if (!isFinite(num) || num <= 0) return null;
      return num;
    }

    function normalizeMissingReminderTypeIds(values) {
      if (!Array.isArray(values)) {
        values = values === null || values === undefined ? [] : [values];
      }
      var result = [];
      var seen = {};
      values.forEach(function(raw) {
        var val = normalizeMissingReminderTypeId(raw);
        if (!val) return;
        var key = String(val);
        if (seen[key]) return;
        seen[key] = true;
        result.push(val);
      });
      return result;
    }

    var missingReminderViewApi = viewOwner.create({
      tempExecView: tempExecView,
      escapeHtml: escapeHtml,
      normalizeMissingReminderTypeIds: normalizeMissingReminderTypeIds,
      resolveScoreLevel: resolveTempExecMissingReminderScoreLevel,
      bindMissingReminderScrollHint: appUtils && typeof appUtils.bindMissingReminderScrollHint === 'function'
        ? function(container) { appUtils.bindMissingReminderScrollHint(container); }
        : noop,
      renderFallback: renderTempExecView,
    });

    function buildTempExecMissingReminderSummary(reminder) {
      return missingReminderViewApi.buildSummary(reminder);
    }

    function resolveTempExecMissingReminderLimit(reminder) {
      return missingReminderViewApi.resolveLimit(reminder);
    }

    function formatTempExecMissingTypeLabel(item) {
      return missingReminderViewApi.formatTypeLabel(item);
    }

    function buildTempExecMissingReminderTable(reminder) {
      return missingReminderViewApi.buildTable(reminder, {
        aiEnabled: resolveMissingReminderAiEnabled() === 'on',
      });
    }

    function renderTempExecMissingReminderBlock() {
      var reminder = ensureTempExecMissingReminderState();
      var aiEnabled = resolveMissingReminderAiEnabled() === 'on';
      if (aiEnabled) {
        syncTempExecMissingReminderAiTaskState(reminder);
      }
      return missingReminderViewApi.renderBlock(reminder, { aiEnabled: aiEnabled });
    }

    function renderTempExecMissingReminderRegion() {
      var reminder = ensureTempExecMissingReminderState();
      var aiEnabled = resolveMissingReminderAiEnabled() === 'on';
      if (aiEnabled) syncTempExecMissingReminderAiTaskState(reminder);
      return missingReminderViewApi.renderRegion(reminder, { aiEnabled: aiEnabled });
    }

    function cleanupTempExecMissingReminderObserver(reminder) {
      if (reminder.observer) {
        reminder.observer.disconnect();
        reminder.observer = null;
      }
      reminder.observerTarget = null;
      if (reminder.scrollHandler) {
        browser.removeEventListener('scroll', reminder.scrollHandler);
        browser.removeEventListener('resize', reminder.scrollHandler);
        reminder.scrollHandler = null;
      }
      if (reminder.scrollTimer) {
        clearTimeout(reminder.scrollTimer);
        reminder.scrollTimer = null;
      }
    }

    function resolveTempExecMissingReminderTarget() {
      if (!tempExecView || !tempExecView.querySelector) return null;
      return tempExecView.querySelector('.missing-reminder-card');
    }

    function isTempExecMissingReminderInView(target) {
      if (!target || !target.getBoundingClientRect) return false;
      if (target.offsetParent === null) return false;
      var rect = target.getBoundingClientRect();
      var vh = browser.innerHeight || documentRef.documentElement.clientHeight || 0;
      if (!vh) return false;
      return rect.bottom > 0 && rect.top < vh;
    }

    function scheduleTempExecMissingReminderLazyLoad() {
      var reminder = ensureTempExecMissingReminderState();
      if (!reminder.hasMatch || reminder.loading || reminder.loaded || !reminder.pendingPayload) return;
      var target = resolveTempExecMissingReminderTarget();
      if (!target) return;
      if (isTempExecMissingReminderInView(target)) {
        loadTempExecMissingReminderItems();
        return;
      }
      if (reminder.observerTarget !== target) cleanupTempExecMissingReminderObserver(reminder);
      if (reminder.observer) return;
      if (typeof ObserverCtor === 'function') {
        reminder.observerTarget = target;
        reminder.observer = new ObserverCtor(function(entries) {
          entries.forEach(function(entry) {
            if (entry && (entry.isIntersecting || entry.intersectionRatio > 0)) {
              loadTempExecMissingReminderItems();
            }
          });
        }, { root: null, rootMargin: '120px 0px', threshold: 0.01 });
        reminder.observer.observe(target);
        return;
      }
      reminder.observerTarget = target;
      if (!reminder.scrollHandler) {
        reminder.scrollHandler = function() {
          if (reminder.scrollTimer) clearTimeout(reminder.scrollTimer);
          reminder.scrollTimer = setTimeout(function() {
            reminder.scrollTimer = null;
            if (!reminder.loaded && !reminder.loading && reminder.pendingPayload) {
              if (isTempExecMissingReminderInView(reminder.observerTarget)) loadTempExecMissingReminderItems();
            }
          }, 120);
        };
        browser.addEventListener('scroll', reminder.scrollHandler, { passive: true });
        browser.addEventListener('resize', reminder.scrollHandler);
      }
    }

    function clearTempExecMissingReminder() {
      var reminder = ensureTempExecMissingReminderState();
      reminder.items = [];
      reminder.matchedModules = [];
      reminder.matchedTypes = [];
      reminder.hasMatch = false;
      reminder.pending = false;
      reminder.pendingPayload = null;
      reminder.loading = false;
      reminder.loaded = false;
      reminder.signature = '';
      reminder.projectId = '';
      cleanupTempExecMissingReminderObserver(reminder);
      resetTempExecMissingReminderLibrary(reminder);
    }

    function requestTempExecMissingReminderRefresh() {
      var reminder = ensureTempExecMissingReminderState();
      if (reminder.refreshTimer) clearTimeout(reminder.refreshTimer);
      reminder.refreshTimer = setTimeout(function() {
        reminder.refreshTimer = null;
        refreshTempExecMissingReminder();
      }, 160);
    }

    function refreshTempExecMissingReminder() {
      var reminder = ensureTempExecMissingReminderState();
      if (resolveMissingReminderAiEnabled() === 'on') {
        var prevReady = reminder.aiContextReady;
        var prevSig = reminder.aiContextSignature;
        var prevProject = reminder.aiContextProjectId;
        var readyNow = syncTempExecMissingReminderAiContext(reminder);
        if (readyNow) {
          checkTempExecMissingReminderLibrary(reminder, reminder.aiContextProjectId);
        } else {
          resetTempExecMissingReminderLibrary(reminder);
        }
        if (prevReady === readyNow
          && prevSig === reminder.aiContextSignature
          && prevProject === reminder.aiContextProjectId) {
          return;
        }
        renderTempExecMissingReminderRegion();
        return;
      }
      var active = getTempExecFile(state.tempExecActiveId);
      if (!active || !active.projectId) {
        clearTempExecMissingReminder();
        return;
      }
      var cases = Array.isArray(active.cases) ? active.cases : [];
      if (!cases.length) {
        clearTempExecMissingReminder();
        return;
      }
      var caseTexts = [];
      cases.forEach(function(item) {
        var text = buildTempExecCaseText(item);
        if (text) caseTexts.push(text);
      });
      if (!caseTexts.length) {
        clearTempExecMissingReminder();
        return;
      }
      var projectId = String(active.projectId);
      var matchConfig = resolveMissingReminderMatchConfig();
      var matchKey = (matchConfig.type ? 't' : '') + (matchConfig.module ? 'm' : '');
      var fieldTextMap = buildTempExecReminderFieldTextMap(cases);
      var signatureText = caseTexts.join('\n\n');
      var caseSearchText = caseTexts.join(' ');
      var signature = projectId + ':' + hashReminderText(signatureText) + ':' + matchKey;
      if (reminder.signature === signature && reminder.projectId === projectId && (reminder.loaded || reminder.pending)) {
        scheduleTempExecMissingReminderLazyLoad();
        return;
      }
      reminder.signature = signature;
      reminder.projectId = projectId;
      reminder.items = [];
      reminder.matchedModules = [];
      reminder.matchedTypes = [];
      reminder.hasMatch = false;
      reminder.pending = false;
      reminder.pendingPayload = null;
      reminder.loading = false;
      reminder.loaded = false;
      cleanupTempExecMissingReminderObserver(reminder);
      var client = getApiClient();
      if (!client || typeof client.listMissingModules !== 'function' || typeof client.listMissingTypes !== 'function') {
        clearTempExecMissingReminder();
        return;
      }
      var seq = (reminder.seq || 0) + 1;
      reminder.seq = seq;
      Promise.all([client.listMissingModules(projectId), client.listMissingTypes(projectId)])
        .then(function(res) {
          if (reminder.seq !== seq) return null;
          var modules = Array.isArray(res && res[0]) ? res[0] : [];
          var types = Array.isArray(res && res[1]) ? res[1] : [];
          var requireModule = matchConfig.module === true;
          var requireType = matchConfig.type === true;
          var moduleMatches = [];
          var moduleIds = [];
          var allModuleIds = [];
          var matchedModuleMap = {};
          var moduleMap = {};
          modules.forEach(function(m) {
            if (!m || m.id === null || m.id === undefined) return;
            var name = m.name ? String(m.name).trim() : '';
            var idStr = String(m.id);
            moduleMap[idStr] = m;
            allModuleIds.push(idStr);
            if (name && caseSearchText.indexOf(name.toLowerCase()) !== -1) {
              moduleMatches.push(name);
              moduleIds.push(idStr);
              matchedModuleMap[idStr] = true;
            }
          });
          var typeMatches = [];
          var typeIds = [];
          var allTypeIds = [];
          var typeNameMap = {};
          var matchedTypeMap = {};
          types.forEach(function(t) {
            if (!t || t.id === null || t.id === undefined) return;
            var name = t.name ? String(t.name).trim() : '';
            var idStr = String(t.id);
            typeNameMap[idStr] = name || ('类型#' + idStr);
            allTypeIds.push(idStr);
            if (name && caseSearchText.indexOf(name.toLowerCase()) !== -1) {
              typeMatches.push(name);
              typeIds.push(idStr);
              matchedTypeMap[idStr] = true;
            }
          });
          if ((requireModule && !moduleIds.length) || (requireType && !typeIds.length) || (!allModuleIds.length)) {
            reminder.items = [];
            reminder.matchedModules = [];
            reminder.matchedTypes = [];
            reminder.hasMatch = false;
            reminder.pending = false;
            reminder.pendingPayload = null;
            reminder.loading = false;
            reminder.loaded = true;
            renderTempExecMissingReminderRegion();
            return null;
          }
          if (!requireModule) moduleIds = allModuleIds.slice();
          if (!requireType) typeIds = allTypeIds.slice();
          reminder.matchedModules = moduleMatches;
          reminder.matchedTypes = typeMatches;
          reminder.hasMatch = true;
          reminder.pending = true;
          reminder.pendingPayload = {
            projectId: projectId,
            moduleIds: moduleIds,
            typeIds: typeIds,
            moduleMap: moduleMap,
            typeNameMap: typeNameMap,
            matchedModuleMap: matchedModuleMap,
            matchedTypeMap: matchedTypeMap,
            matchConfig: matchConfig,
            fieldTextMap: fieldTextMap,
          };
          reminder.loading = false;
          reminder.loaded = false;
          renderTempExecMissingReminderRegion();
          return null;
        })
        .catch(function() {
          if (reminder.seq !== seq) return;
          reminder.items = [];
          reminder.matchedModules = [];
          reminder.matchedTypes = [];
          reminder.hasMatch = false;
          reminder.pending = false;
          reminder.pendingPayload = null;
          reminder.loading = false;
          reminder.loaded = false;
          cleanupTempExecMissingReminderObserver(reminder);
          renderTempExecMissingReminderRegion();
        });
    }

    function loadTempExecMissingReminderItems() {
      var reminder = ensureTempExecMissingReminderState();
      if (!reminder.pendingPayload || reminder.loading || reminder.loaded) return;
      var client = getApiClient();
      if (!client || typeof client.listMissingModules !== 'function' || typeof client.listMissingModuleItems !== 'function') {
        clearTempExecMissingReminder();
        return;
      }
      var payload = reminder.pendingPayload || {};
      var moduleIds = Array.isArray(payload.moduleIds) ? payload.moduleIds.slice() : [];
      var typeIds = Array.isArray(payload.typeIds) ? payload.typeIds.slice() : [];
      var moduleMap = payload.moduleMap && typeof payload.moduleMap === 'object' ? payload.moduleMap : {};
      var typeNameMap = payload.typeNameMap && typeof payload.typeNameMap === 'object' ? payload.typeNameMap : {};
      var matchedModuleMap = payload.matchedModuleMap && typeof payload.matchedModuleMap === 'object' ? payload.matchedModuleMap : {};
      var matchedTypeMap = payload.matchedTypeMap && typeof payload.matchedTypeMap === 'object' ? payload.matchedTypeMap : {};
      var matchConfig = normalizeMissingReminderMatchConfig(payload.matchConfig, { type: true, module: true });
      var requireModule = matchConfig.module === true;
      var requireType = matchConfig.type === true;
      if (!moduleIds.length) {
        clearTempExecMissingReminder();
        return;
      }
      if (requireModule && !Object.keys(matchedModuleMap).length) {
        clearTempExecMissingReminder();
        return;
      }
      if (requireType && (!typeIds.length || !Object.keys(matchedTypeMap).length)) {
        clearTempExecMissingReminder();
        return;
      }
      reminder.pending = false;
      reminder.pendingPayload = null;
      reminder.loading = true;
      reminder.loaded = false;
      cleanupTempExecMissingReminderObserver(reminder);
      renderTempExecMissingReminderRegion();
      var seq = (reminder.seq || 0) + 1;
      reminder.seq = seq;
      Promise.resolve([]).then(function() {
        if (reminder.seq !== seq) return null;
        var ids = moduleIds.slice();
        if (!ids.length) {
          reminder.items = [];
          reminder.loading = false;
          reminder.loaded = true;
          renderTempExecMissingReminderRegion();
          return null;
        }
        var tasks = ids.map(function(id) {
          return client
            .listMissingModuleItems(id)
            .then(function(list) {
              var rows = Array.isArray(list) ? list : [];
              return rows.map(function(it) {
                var clone = it && typeof it === 'object' ? Object.assign({}, it) : {};
                clone.module_id = id;
                clone.module_name = moduleMap[id] && moduleMap[id].name ? moduleMap[id].name : ('模块#' + id);
                var typeIds = normalizeMissingReminderTypeIds(clone.type_ids);
                if (!typeIds.length && clone.type_id) {
                  typeIds = normalizeMissingReminderTypeIds([clone.type_id]);
                }
                var resolvedNames = [];
                typeIds.forEach(function(typeId, idx) {
                  var key = String(typeId);
                  var base = Array.isArray(clone.type_names) ? clone.type_names[idx] : null;
                  if (!base && clone.type_name && idx === 0) base = clone.type_name;
                  var name = typeNameMap[key] || base || ('类型#' + typeId);
                  resolvedNames.push(name);
                });
                clone.type_ids = typeIds;
                clone.type_names = resolvedNames;
                clone.type_name = resolvedNames.length ? resolvedNames.join('、') : '未分类';
                return clone;
              });
            })
            .catch(function() { return []; });
        });
        return Promise.all(tasks).then(function(all) {
          if (reminder.seq !== seq) return null;
          var combined = [];
          (all || []).forEach(function(rows) {
            (rows || []).forEach(function(row) {
              if (!row) return;
              var moduleHit = requireModule ? (row.module_id && matchedModuleMap[String(row.module_id)]) : true;
              var rowTypeIds = normalizeMissingReminderTypeIds(row.type_ids);
              if (!rowTypeIds.length && row.type_id) {
                rowTypeIds = normalizeMissingReminderTypeIds([row.type_id]);
              }
              var typeHit = true;
              if (requireType) {
                typeHit = false;
                for (var i = 0; i < rowTypeIds.length; i += 1) {
                  if (matchedTypeMap[String(rowTypeIds[i])]) {
                    typeHit = true;
                    break;
                  }
                }
              }
              if (moduleHit && typeHit) combined.push(row);
            });
          });
          if (!combined.length) {
            reminder.items = [];
            reminder.matchedModules = [];
            reminder.matchedTypes = [];
            reminder.hasMatch = false;
            reminder.loading = false;
            reminder.loaded = true;
            renderTempExecMissingReminderRegion();
            return null;
          }
          var fieldTextMap = payload.fieldTextMap && typeof payload.fieldTextMap === 'object' ? payload.fieldTextMap : {};
          combined.forEach(function(item, idx) {
            item.match_score = buildTempExecReminderScore(item, fieldTextMap);
            item.__score_index = idx;
          });
          combined.sort(function(a, b) {
            var sa = Number(a && a.match_score) || 0;
            var sb = Number(b && b.match_score) || 0;
            if (sa !== sb) return sb - sa;
            var ia = Number(a && a.__score_index) || 0;
            var ib = Number(b && b.__score_index) || 0;
            return ia - ib;
          });
          var limit = resolveTempExecMissingReminderLimit(reminder);
          reminder.items = combined.slice(0, limit);
          reminder.items.forEach(function(item) { try { delete item.__score_index; } catch (_) {} });
          reminder.loading = false;
          reminder.loaded = true;
          renderTempExecMissingReminderRegion();
          return null;
        });
      }).catch(function() {
        if (reminder.seq !== seq) return;
        reminder.items = [];
        reminder.loading = false;
        reminder.loaded = false;
        renderTempExecMissingReminderRegion();
      });
    }

    function clearTempExecMissingReminderAi(reminder, options) {
      var target = reminder || ensureTempExecMissingReminderState();
      target.aiItems = [];
      target.aiIds = [];
      target.aiLoading = false;
      target.aiGenerated = false;
      target.aiError = '';
      target.aiSignature = '';
      target.aiProjectId = '';
      target.aiSeq = (target.aiSeq || 0) + 1;
      resetTempExecMissingReminderLibrary(target);
      var manager = getTempExecMissingReminderAiManager();
      if (manager && typeof manager.clearTask === 'function') {
        manager.clearTask('temp-exec');
      }
      if (!options || options.keepContext !== true) {
        target.aiContextSignature = '';
        target.aiContextProjectId = '';
        target.aiContextReady = false;
      }
    }

    function syncTempExecMissingReminderAiContext(reminder) {
      var target = reminder || ensureTempExecMissingReminderState();
      var active = getTempExecFile(state.tempExecActiveId);
      if (!active || !active.projectId) {
        target.aiContextReady = false;
        target.aiContextSignature = '';
        target.aiContextProjectId = '';
        return false;
      }
      var cases = Array.isArray(active.cases) ? active.cases : [];
      if (!cases.length) {
        target.aiContextReady = false;
        target.aiContextSignature = '';
        target.aiContextProjectId = '';
        return false;
      }
      var context = buildTempExecAiCaseContext(cases);
      if (!context.texts.length) {
        target.aiContextReady = false;
        target.aiContextSignature = '';
        target.aiContextProjectId = '';
        return false;
      }
      var projectId = String(active.projectId);
      var signature = projectId + ':' + hashReminderText(context.signatureText);
      target.aiContextSignature = signature;
      target.aiContextProjectId = projectId;
      target.aiContextReady = true;
      return true;
    }

    function buildTempExecMissingReminderAiCandidateSnapshot(items, fieldTextMap) {
      var map = {};
      var itemMap = {};
      var list = Array.isArray(items) ? items : [];
      list.forEach(function(item, idx) {
        if (!item) return;
        var score = buildTempExecReminderScore(item, fieldTextMap);
        var level = resolveTempExecMissingReminderScoreLevel(score, '');
        var clone = item && typeof item === 'object' ? Object.assign({}, item) : {};
        clone.match_score = score;
        clone.match_level = level;
        var id = String(idx + 1);
        var moduleName = clone.module_name || clone.module || '';
        var typeName = formatTempExecMissingTypeLabel(clone);
        map[id] = {
          module: stringifyCaseField(moduleName),
          type: stringifyCaseField(typeName),
          title: stringifyCaseField(item.title || ''),
          priority: stringifyCaseField(item.priority || ''),
          precondition: stringifyCaseField(item.precondition || ''),
          steps: stringifyCaseField(item.steps || ''),
          expected: stringifyCaseField(item.expected || ''),
          match_level: stringifyCaseField(level),
        };
        itemMap[id] = clone;
      });
      return { map: map, itemMap: itemMap };
    }

    function parseTempExecMissingReminderAiIds(content) {
      var raw = content || '';
      var stripped = appUtils && typeof appUtils.stripCodeFence === 'function'
        ? appUtils.stripCodeFence(raw)
        : String(raw || '').trim();
      var payloadText = appUtils && typeof appUtils.extractJsonPayload === 'function'
        ? appUtils.extractJsonPayload(stripped)
        : '';
      var text = payloadText || stripped;
      var data = JSON.parse(text);
      var ids = data && Array.isArray(data.ids) ? data.ids : [];
      return ids.map(function(id) { return String(id).trim(); }).filter(Boolean);
    }

    function fetchTempExecMissingReminderAiCandidates(projectId, caseSearchText) {
      var client = getApiClient();
      if (!client || typeof client.listMissingModules !== 'function' || typeof client.listMissingTypes !== 'function') {
        return Promise.resolve({
          items: [],
          matchedModules: [],
          matchedTypes: [],
          matchedModuleMap: {},
          matchedTypeMap: {},
          moduleMap: {},
          typeNameMap: {},
          libraryEmpty: false,
        });
      }
      return Promise.all([client.listMissingModules(projectId), client.listMissingTypes(projectId)])
        .then(function(res) {
          var modules = Array.isArray(res && res[0]) ? res[0] : [];
          var types = Array.isArray(res && res[1]) ? res[1] : [];
          var moduleMatches = [];
          var moduleIds = [];
          var allModuleIds = [];
          var matchedModuleMap = {};
          var moduleMap = {};
          var libraryEmpty = resolveTempExecMissingReminderLibraryEmpty(modules);
          modules.forEach(function(m) {
            if (!m || m.id === null || m.id === undefined) return;
            var name = m.name ? String(m.name).trim() : '';
            var idStr = String(m.id);
            moduleMap[idStr] = m;
            allModuleIds.push(idStr);
            if (name && caseSearchText.indexOf(name.toLowerCase()) !== -1) {
              moduleMatches.push(name);
              moduleIds.push(idStr);
              matchedModuleMap[idStr] = true;
            }
          });
          var typeMatches = [];
          var typeNameMap = {};
          var matchedTypeMap = {};
          types.forEach(function(t) {
            if (!t || t.id === null || t.id === undefined) return;
            var name = t.name ? String(t.name).trim() : '';
            var idStr = String(t.id);
            typeNameMap[idStr] = name || ('类型#' + idStr);
            if (name && caseSearchText.indexOf(name.toLowerCase()) !== -1) {
              typeMatches.push(name);
              matchedTypeMap[idStr] = true;
            }
          });
          var hasModuleMatch = moduleIds.length > 0;
          var hasTypeMatch = Object.keys(matchedTypeMap).length > 0;
          if (!hasModuleMatch && !hasTypeMatch) {
            return {
              items: [],
              matchedModules: moduleMatches,
              matchedTypes: typeMatches,
              matchedModuleMap: matchedModuleMap,
              matchedTypeMap: matchedTypeMap,
              moduleMap: moduleMap,
              typeNameMap: typeNameMap,
              libraryEmpty: libraryEmpty,
            };
          }
          var loadModuleIds = hasTypeMatch ? allModuleIds.slice() : moduleIds.slice();
          if (!loadModuleIds.length) {
            return {
              items: [],
              matchedModules: moduleMatches,
              matchedTypes: typeMatches,
              matchedModuleMap: matchedModuleMap,
              matchedTypeMap: matchedTypeMap,
              moduleMap: moduleMap,
              typeNameMap: typeNameMap,
              libraryEmpty: libraryEmpty,
            };
          }
          var tasks = loadModuleIds.map(function(id) {
            return client
              .listMissingModuleItems(id)
              .then(function(list) {
                var rows = Array.isArray(list) ? list : [];
                return rows.map(function(it) {
                  var clone = it && typeof it === 'object' ? Object.assign({}, it) : {};
                  clone.module_id = id;
                  clone.module_name = moduleMap[id] && moduleMap[id].name ? moduleMap[id].name : ('模块#' + id);
                  var typeIds = normalizeMissingReminderTypeIds(clone.type_ids);
                  if (!typeIds.length && clone.type_id) {
                    typeIds = normalizeMissingReminderTypeIds([clone.type_id]);
                  }
                  var resolvedNames = [];
                  typeIds.forEach(function(typeId, idx) {
                    var key = String(typeId);
                    var base = Array.isArray(clone.type_names) ? clone.type_names[idx] : null;
                    if (!base && clone.type_name && idx === 0) base = clone.type_name;
                    var name = typeNameMap[key] || base || ('类型#' + typeId);
                    resolvedNames.push(name);
                  });
                  clone.type_ids = typeIds;
                  clone.type_names = resolvedNames;
                  clone.type_name = resolvedNames.length ? resolvedNames.join('、') : '未分类';
                  return clone;
                });
              })
              .catch(function() { return []; });
          });
          return Promise.all(tasks).then(function(all) {
            var combined = [];
            (all || []).forEach(function(rows) {
              (rows || []).forEach(function(row) {
                if (!row) return;
                var moduleHit = row.module_id && matchedModuleMap[String(row.module_id)];
                var rowTypeIds = normalizeMissingReminderTypeIds(row.type_ids);
                if (!rowTypeIds.length && row.type_id) {
                  rowTypeIds = normalizeMissingReminderTypeIds([row.type_id]);
                }
                var typeHit = false;
                for (var i = 0; i < rowTypeIds.length; i += 1) {
                  if (matchedTypeMap[String(rowTypeIds[i])]) {
                    typeHit = true;
                    break;
                  }
                }
                if (moduleHit || typeHit) combined.push(row);
              });
            });
            return {
              items: combined,
              matchedModules: moduleMatches,
              matchedTypes: typeMatches,
              matchedModuleMap: matchedModuleMap,
              matchedTypeMap: matchedTypeMap,
              moduleMap: moduleMap,
              typeNameMap: typeNameMap,
              libraryEmpty: libraryEmpty,
            };
          });
        });
    }

    function runTempExecMissingReminderAiRecommend(options) {
      var reminder = ensureTempExecMissingReminderState();
      if (reminder.aiLoading) return;
      var contextReady = syncTempExecMissingReminderAiContext(reminder);
      if (!contextReady) {
        reminder.aiError = '暂无可用于推荐的用例内容';
        reminder.aiGenerated = true;
        reminder.aiLoading = false;
        reminder.aiItems = [];
        reminder.aiIds = [];
        renderTempExecMissingReminderRegion();
        return;
      }
      var projectId = reminder.aiContextProjectId;
      var signature = reminder.aiContextSignature;
      var active = getTempExecFile(state.tempExecActiveId);
      var cases = active && Array.isArray(active.cases) ? active.cases : [];
      var context = buildTempExecAiCaseContext(cases);
      var fieldTextMap = buildTempExecReminderFieldTextMap(cases);
      var caseSearchText = String(context.searchText || '').toLowerCase();
      var model;
      try {
        model = getAssignedModel('missingreminder');
      } catch (err) {
        reminder.aiError = err && err.message ? err.message : '未找到易漏用例推荐模型';
        reminder.aiGenerated = true;
        reminder.aiLoading = false;
        reminder.aiItems = [];
        reminder.aiIds = [];
        renderTempExecMissingReminderRegion();
        return;
      }
      reminder.aiLoading = true;
      reminder.aiGenerated = false;
      reminder.aiError = '';
      reminder.aiItems = [];
      reminder.aiIds = [];
      reminder.aiSignature = signature;
      reminder.aiProjectId = projectId;
      var seq = (reminder.aiSeq || 0) + 1;
      reminder.aiSeq = seq;
      renderTempExecMissingReminderRegion();
      fetchTempExecMissingReminderAiCandidates(projectId, caseSearchText)
        .then(function(res) {
          if (reminder.aiSeq !== seq) return null;
          var candidates = res && Array.isArray(res.items) ? res.items : [];
          reminder.matchedModules = res && Array.isArray(res.matchedModules) ? res.matchedModules : [];
          reminder.matchedTypes = res && Array.isArray(res.matchedTypes) ? res.matchedTypes : [];
          if (res && res.libraryEmpty !== undefined) {
            reminder.libraryEmpty = res.libraryEmpty === true;
            reminder.libraryChecked = true;
            reminder.libraryLoading = false;
            reminder.libraryProjectId = projectId;
          }
          if (!candidates.length) {
            reminder.aiLoading = false;
            reminder.aiGenerated = true;
            reminder.aiItems = [];
            reminder.aiIds = [];
            if (reminder.libraryEmpty === true) {
              showTempExecMissingReminderLibraryEmptyToast();
            }
            renderTempExecMissingReminderRegion();
            return null;
          }
          var snapshot = buildTempExecMissingReminderAiCandidateSnapshot(candidates, fieldTextMap);
          var prompt = (state.assignments && state.assignments.missingReminderPrompt)
            || (browser.app && browser.app.config && browser.app.config.defaultPrompts
              ? browser.app.config.defaultPrompts.missingreminder
              : '');
          var reasoning = state.assignments && state.assignments.missingReminderReasoning
            ? state.assignments.missingReminderReasoning
            : '';
          var temperature = state.assignments && state.assignments.missingReminderTemperature !== undefined
            ? state.assignments.missingReminderTemperature
            : 0.2;
          var userPayload = {
            current_cases: context.entries,
            candidate_map: snapshot.map,
          };
          var userText = JSON.stringify(userPayload, null, 2);
          var manager = getTempExecMissingReminderAiManager();
          if (manager && typeof manager.createTask === 'function' && typeof manager.startTask === 'function') {
            var task = manager.createTask('temp-exec', {
              contextSignature: signature,
              projectId: projectId,
              model: model,
              prompt: prompt,
              reasoning: reasoning,
              temperature: temperature,
              userText: userText,
              itemMap: snapshot.itemMap,
              matchedModules: reminder.matchedModules,
              matchedTypes: reminder.matchedTypes,
              libraryEmpty: reminder.libraryEmpty === true,
            });
            manager.startTask('temp-exec', task);
            return null;
          }
          return callModelWithConfig(model, userText, prompt, reasoning, temperature)
            .then(function(content) {
              if (reminder.aiSeq !== seq) return null;
              var ids = parseTempExecMissingReminderAiIds(content);
              var seen = {};
              var selected = [];
              ids.forEach(function(id) {
                var key = String(id || '').trim();
                if (!key || seen[key]) return;
                seen[key] = true;
                var item = snapshot.itemMap[key];
                if (item) {
                  var clone = Object.assign({}, item);
                  selected.push(clone);
                }
              });
              reminder.aiItems = selected;
              reminder.aiIds = ids;
              reminder.aiLoading = false;
              reminder.aiGenerated = true;
              renderTempExecMissingReminderRegion();
              return null;
            });
        })
        .catch(function(err) {
          if (reminder.aiSeq !== seq) return;
          reminder.aiLoading = false;
          reminder.aiGenerated = true;
          reminder.aiItems = [];
          reminder.aiIds = [];
          reminder.aiError = 'AI 推荐失败：' + (err && err.message ? err.message : err);
          renderTempExecMissingReminderRegion();
        });
    }

    function hasTempExecMissingReminderAiGenerated(reminder) {
      if (!reminder || reminder.aiGenerated !== true) return false;
      var contextSignature = reminder.aiContextSignature ? String(reminder.aiContextSignature) : '';
      var aiSignature = reminder.aiSignature ? String(reminder.aiSignature) : '';
      if (!contextSignature || !aiSignature) return false;
      return contextSignature === aiSignature;
    }

    function triggerTempExecMissingReminderAiRecommend() {
      var reminder = ensureTempExecMissingReminderState();
      if (resolveMissingReminderAiEnabled() !== 'on') return;
      if (reminder.aiLoading) return;
      var ready = syncTempExecMissingReminderAiContext(reminder);
      if (ready) {
        checkTempExecMissingReminderLibrary(reminder, reminder.aiContextProjectId);
        if (reminder.libraryChecked === true && reminder.libraryEmpty === true) {
          showTempExecMissingReminderLibraryEmptyToast();
          return;
        }
      }
      if (hasTempExecMissingReminderAiGenerated(reminder)) {
        openConfirmDrawer({
          title: '重新生成 AI 推荐',
          message: '已有 AI 推荐结果，是否重新生成？',
          confirmText: '重新生成',
          cancelText: '取消',
        }).then(function(res) {
          if (!res || res.ok !== true) return;
          runTempExecMissingReminderAiRecommend({ trigger: 'confirm' });
        });
        return;
      }
      runTempExecMissingReminderAiRecommend({ trigger: 'button' });
    }
    return {
      ensureTempExecMissingReminderState: ensureTempExecMissingReminderState,
      resolveMissingReminderPlacement: resolveMissingReminderPlacement,
      resolveMissingReminderMatchConfig: resolveMissingReminderMatchConfig,
      resolveMissingReminderAiEnabled: resolveMissingReminderAiEnabled,
      hashReminderText: hashReminderText,
      buildTempExecAiCaseEntry: buildTempExecAiCaseEntry,
      buildTempExecAiCaseText: buildTempExecAiCaseText,
      buildTempExecAiCaseContext: buildTempExecAiCaseContext,
      buildTempExecCaseText: buildTempExecCaseText,
      buildTempExecCaseSearchText: buildTempExecCaseSearchText,
      buildTempExecCaseFieldText: buildTempExecCaseFieldText,
      buildTempExecReminderFieldTextMap: buildTempExecReminderFieldTextMap,
      hasReminderKeywordHit: hasReminderKeywordHit,
      buildTempExecReminderScore: buildTempExecReminderScore,
      resolveTempExecMissingReminderScoreLevel: resolveTempExecMissingReminderScoreLevel,
      resolveTempExecMissingReminderLibraryEmpty: resolveTempExecMissingReminderLibraryEmpty,
      getTempExecMissingReminderAiManager: getTempExecMissingReminderAiManager,
      buildTempExecMissingReminderAiItemsFromTask: buildTempExecMissingReminderAiItemsFromTask,
      applyTempExecMissingReminderAiTaskState: applyTempExecMissingReminderAiTaskState,
      syncTempExecMissingReminderAiTaskState: syncTempExecMissingReminderAiTaskState,
      resetTempExecMissingReminderLibrary: resetTempExecMissingReminderLibrary,
      showTempExecMissingReminderLibraryEmptyToast: showTempExecMissingReminderLibraryEmptyToast,
      checkTempExecMissingReminderLibrary: checkTempExecMissingReminderLibrary,
      buildTempExecMissingReminderSummary: buildTempExecMissingReminderSummary,
      resolveTempExecMissingReminderLimit: resolveTempExecMissingReminderLimit,
      normalizeMissingReminderTypeId: normalizeMissingReminderTypeId,
      normalizeMissingReminderTypeIds: normalizeMissingReminderTypeIds,
      formatTempExecMissingTypeLabel: formatTempExecMissingTypeLabel,
      buildTempExecMissingReminderTable: buildTempExecMissingReminderTable,
      renderTempExecMissingReminderBlock: renderTempExecMissingReminderBlock,
      renderTempExecMissingReminderRegion: renderTempExecMissingReminderRegion,
      cleanupTempExecMissingReminderObserver: cleanupTempExecMissingReminderObserver,
      resolveTempExecMissingReminderTarget: resolveTempExecMissingReminderTarget,
      isTempExecMissingReminderInView: isTempExecMissingReminderInView,
      scheduleTempExecMissingReminderLazyLoad: scheduleTempExecMissingReminderLazyLoad,
      clearTempExecMissingReminder: clearTempExecMissingReminder,
      requestTempExecMissingReminderRefresh: requestTempExecMissingReminderRefresh,
      refreshTempExecMissingReminder: refreshTempExecMissingReminder,
      loadTempExecMissingReminderItems: loadTempExecMissingReminderItems,
      clearTempExecMissingReminderAi: clearTempExecMissingReminderAi,
      syncTempExecMissingReminderAiContext: syncTempExecMissingReminderAiContext,
      buildTempExecMissingReminderAiCandidateSnapshot: buildTempExecMissingReminderAiCandidateSnapshot,
      parseTempExecMissingReminderAiIds: parseTempExecMissingReminderAiIds,
      fetchTempExecMissingReminderAiCandidates: fetchTempExecMissingReminderAiCandidates,
      runTempExecMissingReminderAiRecommend: runTempExecMissingReminderAiRecommend,
      hasTempExecMissingReminderAiGenerated: hasTempExecMissingReminderAiGenerated,
      triggerTempExecMissingReminderAiRecommend: triggerTempExecMissingReminderAiRecommend,
    };
  }

  return { create: create };
});
