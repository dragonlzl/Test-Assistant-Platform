(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenCaseSourceModel = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var getState = port('getState', function() { return {}; });
    var stripCodeFence = port('stripCodeFence', function(value) { return String(value || '').trim(); });
    var parseCaseListPort = port('parseCaseList', function() { return []; });
    var deriveCaseListFromText = port('deriveCaseListFromText', function() { return []; });
    var buildDeletedBaselineModuleMapFromList = port('buildDeletedBaselineModuleMapFromList', function() { return {}; });
    var buildDeletedBaselineCaseMapFromList = port('buildDeletedBaselineCaseMapFromList', function() { return {}; });
    var normalizeModuleTitle = port('normalizeModuleTitle', function(value) { return String(value || '').trim(); });
    var normalizeModuleKey = port('normalizeModuleKey', function(value) { return String(value || '').trim().toLowerCase(); });
    var buildBaselineCaseDeleteKey = port('buildBaselineCaseDeleteKey', function(moduleTitle, signature) {
      return String(moduleTitle || '') + '::' + String(signature || '');
    });
    var buildCaseSignature = port('buildCaseSignature', function(item, moduleTitle) {
      return String(moduleTitle || '') + '::' + String(item && item.title || '');
    });
    var getVisibleBaselineCaseList = port('getVisibleBaselineCaseList', function() { return []; });
    var getRootUiState = port('getRootUiState', function() { return {}; });
    var getModuleUiState = port('getModuleUiState', function() { return {}; });
    var ensureXmindState = port('ensureXmindState', function() { return {}; });
    var normalizeCaseItem = port('normalizeCaseItem', function(item) { return item || null; });
    var generateLocalId = port('generateLocalId', function(prefix) {
      return String(prefix || 'xmind') + '-' + Date.now().toString(16);
    });
    var normalizeArrayField = port('normalizeArrayField', function(value) {
      return Array.isArray(value) ? value.slice() : (value ? [String(value)] : []);
    });

    function parseCaseList(rawText) {
      var parsed = parseCaseListPort(rawText || '');
      return Array.isArray(parsed) ? parsed : [];
    }

    function safeParseWorkspaceCaseList(rawValue) {
      var raw = rawValue === null || rawValue === undefined ? '' : String(rawValue || '');
      if (!raw.trim()) return [];
      var parsed = parseCaseList(raw);
      if (parsed.length) return parsed;
      try {
        var data = JSON.parse(stripCodeFence(raw) || '[]');
        if (Array.isArray(data)) return data;
      } catch (error) {
        // Fall through to the legacy text parser.
      }
      var derived = deriveCaseListFromText(raw);
      return Array.isArray(derived) ? derived : [];
    }

    function getSnapshotBaselineCaseList(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var shared = source.shared && typeof source.shared === 'object' ? source.shared : {};
      var xmind = source.xmind && typeof source.xmind === 'object' ? source.xmind : {};
      var prep = xmind.prep && typeof xmind.prep === 'object' ? xmind.prep : null;
      var importedCases = Array.isArray(shared.importedCases) ? shared.importedCases : [];
      var rawList = [];
      if (!prep || prep.caseImportMode !== 'import') return rawList;
      if (importedCases.length) {
        importedCases.forEach(function(item) {
          if (!item || typeof item !== 'object') return;
          if (Array.isArray(item.list) && item.list.length) {
            rawList = rawList.concat(item.list.filter(Boolean));
            return;
          }
          if (item.text && String(item.text || '').trim()) {
            rawList = rawList.concat(safeParseWorkspaceCaseList(item.text));
          }
        });
      } else if (shared.caseText && String(shared.caseText || '').trim()) {
        rawList = safeParseWorkspaceCaseList(shared.caseText);
      }
      var deletedBaselineModules = buildDeletedBaselineModuleMapFromList(xmind.deletedBaselineModuleKeys);
      var deletedBaselineCases = buildDeletedBaselineCaseMapFromList(xmind.deletedBaselineCaseKeys);
      return rawList.filter(function(item) {
        if (!item || typeof item !== 'object') return false;
        var moduleTitle = normalizeModuleTitle(item.module || item.module_name || item['模块'] || '未命名模块');
        var moduleKey = normalizeModuleKey(moduleTitle);
        if (!moduleKey || deletedBaselineModules[moduleKey]) return false;
        var caseDeleteKey = buildBaselineCaseDeleteKey(moduleTitle, buildCaseSignature(item, moduleTitle));
        return !(caseDeleteKey && deletedBaselineCases[caseDeleteKey]);
      });
    }

    function groupCasesByModule(list) {
      var order = [];
      var map = {};
      (Array.isArray(list) ? list : []).forEach(function(item) {
        if (!item || typeof item !== 'object') return;
        var title = normalizeModuleTitle(item.module || item.module_name || item['模块'] || '未命名模块');
        var key = normalizeModuleKey(title);
        if (!key) return;
        if (!map[key]) {
          map[key] = { key: key, title: title, cases: [] };
          order.push(key);
        }
        map[key].cases.push(item);
      });
      return { order: order, map: map };
    }

    function buildVisibleModuleContextFromSources(baselineList, modules, readAiCases) {
      var baselineGrouped = groupCasesByModule(baselineList);
      var order = baselineGrouped.order.slice();
      var map = {};
      order.forEach(function(key) {
        var info = baselineGrouped.map[key];
        map[key] = {
          moduleKey: key,
          title: info.title,
          baselineCases: info.cases.slice(),
          aiCases: [],
          aiModule: null,
          aiModuleId: '',
        };
      });
      (modules || []).forEach(function(mod, index) {
        if (!mod) return;
        var title = normalizeModuleTitle(mod.title || mod.module || ('模块' + (index + 1)));
        var key = normalizeModuleKey(title);
        var moduleId = String(mod.id || '');
        if (!key) return;
        if (!map[key]) {
          map[key] = {
            moduleKey: key,
            title: title,
            baselineCases: [],
            aiCases: [],
            aiModule: null,
            aiModuleId: '',
          };
          order.push(key);
        }
        map[key].aiModule = mod;
        map[key].aiModuleId = moduleId;
        map[key].title = title;
        map[key].aiCases = typeof readAiCases === 'function' ? readAiCases(mod, moduleId) : [];
      });
      return {
        order: order,
        map: map,
        list: order.map(function(key) { return map[key]; }),
      };
    }

    function buildWorkspaceVisibleModuleContextFromSnapshot(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var shared = source.shared && typeof source.shared === 'object' ? source.shared : {};
      var xmind = source.xmind && typeof source.xmind === 'object' ? source.xmind : {};
      var modules = Array.isArray(shared.caseGenModules) ? shared.caseGenModules : [];
      var results = shared.caseGenResults && typeof shared.caseGenResults === 'object'
        ? shared.caseGenResults
        : {};
      var xmindRoot = xmind.root && typeof xmind.root === 'object' ? xmind.root : {};
      var moduleStates = xmind.modules && typeof xmind.modules === 'object' ? xmind.modules : {};
      var includeAiLayer = xmindRoot.hideAiLayer !== true;
      return buildVisibleModuleContextFromSources(
        getSnapshotBaselineCaseList(snapshot),
        includeAiLayer !== false ? modules : [],
        function(mod, moduleId) {
          var moduleState = moduleId && moduleStates[moduleId] && typeof moduleStates[moduleId] === 'object'
            ? moduleStates[moduleId]
            : null;
          return moduleState && moduleState.hideResults === true
            ? []
            : safeParseWorkspaceCaseList(moduleId ? results[moduleId] : '');
        }
      );
    }

    function getAiCasesForModule(moduleId) {
      if (!moduleId) return [];
      var state = getState();
      var raw = state.caseGenResults && state.caseGenResults[moduleId]
        ? String(state.caseGenResults[moduleId] || '')
        : '';
      if (!raw.trim()) return [];
      var parsed = parseCaseList(raw);
      if (parsed.length) return parsed;
      try {
        var data = JSON.parse(stripCodeFence(raw) || '[]');
        return Array.isArray(data) ? data : [];
      } catch (error) {
        return [];
      }
    }

    function buildVisibleModuleContext(optionsValue) {
      var options = optionsValue || {};
      var state = getState();
      var rootState = getRootUiState();
      var includeAiLayer = options.includeAiLayer === true
        ? true
        : (options.includeAiLayer !== false && !(rootState && rootState.hideAiLayer === true));
      return buildVisibleModuleContextFromSources(
        getVisibleBaselineCaseList(),
        includeAiLayer !== false ? (state.caseGenModules || []) : [],
        function(mod) {
          var moduleState = getModuleUiState(mod.id);
          return moduleState && moduleState.hideResults === true ? [] : getAiCasesForModule(mod.id);
        }
      );
    }

    function ensureVisibleModuleContext(value) {
      if (value && Array.isArray(value.list) && value.map && typeof value.map === 'object') return value;
      if (value && Array.isArray(value.list)) {
        var fallbackMap = {};
        var fallbackOrder = [];
        value.list.forEach(function(entry) {
          if (!entry || typeof entry !== 'object') return;
          var key = String(entry.moduleKey || normalizeModuleKey(entry.title || '') || '').trim();
          if (!key || fallbackMap[key]) return;
          fallbackMap[key] = entry;
          fallbackOrder.push(key);
        });
        return {
          order: fallbackOrder,
          map: fallbackMap,
          list: fallbackOrder.map(function(key) { return fallbackMap[key]; }),
        };
      }
      return buildVisibleModuleContext();
    }

    function getVisibleCasesForModuleEntry(entry) {
      var result = [];
      if (!entry) return result;
      (entry.baselineCases || []).forEach(function(item, index) {
        result.push({
          source: 'baseline',
          sourceIndex: index,
          caseSignature: buildCaseSignature(item, entry.title),
          item: item,
        });
      });
      (entry.aiCases || []).forEach(function(item, index) {
        result.push({
          source: 'ai',
          sourceIndex: index,
          caseSignature: buildCaseSignature(item, entry.title),
          item: item,
        });
      });
      return result;
    }

    function summarizeVisibleModuleContext(context) {
      var list = context && Array.isArray(context.list) ? context.list : [];
      var caseCount = 0;
      list.forEach(function(entry) {
        caseCount += getVisibleCasesForModuleEntry(entry).length;
      });
      return { moduleCount: list.length, caseCount: caseCount };
    }

    function hasAiCasesForModule(moduleId) {
      return getAiCasesForModule(moduleId).length > 0;
    }

    function findAiModuleByTitle(title) {
      var key = normalizeModuleKey(title);
      if (!key) return null;
      var state = getState();
      var modules = Array.isArray(state.caseGenModules) ? state.caseGenModules : [];
      for (var i = 0; i < modules.length; i += 1) {
        var mod = modules[i];
        if (mod && normalizeModuleKey(mod.title || mod.module) === key) return mod;
      }
      return null;
    }

    function findAiModuleById(moduleId) {
      var targetId = String(moduleId || '');
      if (!targetId) return null;
      var state = getState();
      var modules = Array.isArray(state.caseGenModules) ? state.caseGenModules : [];
      for (var i = 0; i < modules.length; i += 1) {
        var mod = modules[i];
        if (mod && String(mod.id || '') === targetId) return mod;
      }
      return null;
    }

    function createAiModuleRecord(title, source, moduleId) {
      var item = source && typeof source === 'object' ? source : {};
      return {
        id: moduleId || generateLocalId('xmind-mod'),
        title: normalizeModuleTitle(title || item.module || item.title || '未命名模块'),
        scenarios: normalizeArrayField(item.key_scenarios || item.scenarios),
        points: normalizeArrayField(item.test_points || item.points),
        coupled: normalizeArrayField(item.coupled_modules || item.coupled),
        special: normalizeArrayField(item.special || item.special_points),
      };
    }

    function ensureAiModuleRecord(title, source, moduleId) {
      var existing = findAiModuleByTitle(title);
      if (existing) {
        if (source && typeof source === 'object') {
          var scenarios = normalizeArrayField(source.key_scenarios || source.scenarios);
          var points = normalizeArrayField(source.test_points || source.points);
          var coupled = normalizeArrayField(source.coupled_modules || source.coupled);
          if (scenarios.length) existing.scenarios = scenarios;
          if (points.length) existing.points = points;
          if (coupled.length) existing.coupled = coupled;
        }
        return existing;
      }
      var created = createAiModuleRecord(title, source, moduleId);
      var state = getState();
      if (!Array.isArray(state.caseGenModules)) state.caseGenModules = [];
      state.caseGenModules.push(created);
      ensureXmindState().hasModuleSkeleton = true;
      return created;
    }

    function buildVisibleModuleSnapshot(context) {
      return (context && context.list ? context.list : []).map(function(entry) {
        return {
          module: entry.title,
          key_scenarios: entry.aiModule && Array.isArray(entry.aiModule.scenarios) ? entry.aiModule.scenarios.slice() : [],
          test_points: entry.aiModule && Array.isArray(entry.aiModule.points) ? entry.aiModule.points.slice() : [],
          coupled_modules: entry.aiModule && Array.isArray(entry.aiModule.coupled) ? entry.aiModule.coupled.slice() : [],
          cases: getVisibleCasesForModuleEntry(entry).map(function(row) {
            return normalizeCaseItem(row.item, entry.title);
          }).filter(Boolean),
        };
      });
    }

    function buildAiLayerSnapshot() {
      var state = getState();
      return (Array.isArray(state.caseGenModules) ? state.caseGenModules : []).map(function(mod) {
        return {
          module: normalizeModuleTitle(mod.title || mod.module || ''),
          key_scenarios: Array.isArray(mod.scenarios) ? mod.scenarios.slice() : [],
          test_points: Array.isArray(mod.points) ? mod.points.slice() : [],
          coupled_modules: Array.isArray(mod.coupled) ? mod.coupled.slice() : [],
          cases: getAiCasesForModule(mod.id).map(function(item) {
            return normalizeCaseItem(item, mod.title || mod.module || '');
          }).filter(Boolean),
        };
      });
    }

    return {
      safeParseWorkspaceCaseList: safeParseWorkspaceCaseList,
      getSnapshotBaselineCaseList: getSnapshotBaselineCaseList,
      buildWorkspaceVisibleModuleContextFromSnapshot: buildWorkspaceVisibleModuleContextFromSnapshot,
      summarizeVisibleModuleContext: summarizeVisibleModuleContext,
      parseCaseList: parseCaseList,
      getAiCasesForModule: getAiCasesForModule,
      groupCasesByModule: groupCasesByModule,
      buildVisibleModuleContextFromSources: buildVisibleModuleContextFromSources,
      buildVisibleModuleContext: buildVisibleModuleContext,
      ensureVisibleModuleContext: ensureVisibleModuleContext,
      getVisibleCasesForModuleEntry: getVisibleCasesForModuleEntry,
      hasAiCasesForModule: hasAiCasesForModule,
      findAiModuleByTitle: findAiModuleByTitle,
      findAiModuleById: findAiModuleById,
      createAiModuleRecord: createAiModuleRecord,
      ensureAiModuleRecord: ensureAiModuleRecord,
      buildVisibleModuleSnapshot: buildVisibleModuleSnapshot,
      buildAiLayerSnapshot: buildAiLayerSnapshot,
    };
  }

  return { create: create };
});
