(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.missingReminderModel = api;
  }
})(function() {
  var AI_CASE_FIELDS = [
    'module', 'title', 'priority', 'precondition', 'preconditions', 'steps', 'expected'
  ];
  var SEARCH_CASE_FIELDS = AI_CASE_FIELDS.concat(['remark']);

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var stringifyCaseField = typeof opts.stringifyCaseField === 'function'
      ? opts.stringifyCaseField
      : function(value) { return value === null || value === undefined ? '' : String(value).trim(); };
    var buildCaseSearchText = typeof opts.buildCaseSearchText === 'function'
      ? opts.buildCaseSearchText
      : null;
    var buildKeywords = typeof opts.buildKeywords === 'function'
      ? opts.buildKeywords
      : function(value) { return String(value || '').toLowerCase().split(/\s+/).filter(Boolean); };
    var stripCodeFence = typeof opts.stripCodeFence === 'function'
      ? opts.stripCodeFence
      : function(value) { return String(value || '').trim(); };
    var extractJsonPayload = typeof opts.extractJsonPayload === 'function'
      ? opts.extractJsonPayload
      : function() { return ''; };

    function createDefaultState() {
      return {
        projectId: null,
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

    function ensureState(hostState) {
      var host = hostState && typeof hostState === 'object' ? hostState : {};
      var defaults = createDefaultState();
      if (!host.missingReminder || typeof host.missingReminder !== 'object') {
        host.missingReminder = defaults;
        return host.missingReminder;
      }
      Object.keys(defaults).forEach(function(key) {
        if (host.missingReminder[key] === undefined) host.missingReminder[key] = defaults[key];
      });
      if (!Array.isArray(host.missingReminder.items)) host.missingReminder.items = [];
      if (!Array.isArray(host.missingReminder.matchedModules)) host.missingReminder.matchedModules = [];
      if (!Array.isArray(host.missingReminder.matchedTypes)) host.missingReminder.matchedTypes = [];
      if (!Array.isArray(host.missingReminder.aiItems)) host.missingReminder.aiItems = [];
      if (!Array.isArray(host.missingReminder.aiIds)) host.missingReminder.aiIds = [];
      return host.missingReminder;
    }

    function resolveMatchConfig(value, fallback) {
      var base = fallback && typeof fallback === 'object' ? fallback : { type: true, module: true };
      var source = value && typeof value === 'object' ? value : {};
      var typeFlag = source.type === true ? true : source.type === false ? false : base.type !== false;
      var moduleFlag = source.module === true ? true : source.module === false ? false : base.module !== false;
      if (!typeFlag && !moduleFlag) {
        typeFlag = base.type !== false;
        moduleFlag = base.module !== false;
        if (!typeFlag && !moduleFlag) typeFlag = true;
      }
      return { type: typeFlag, module: moduleFlag };
    }

    function buildFieldText(item, keys) {
      if (!item || typeof item !== 'object') return '';
      var parts = [];
      (keys || []).forEach(function(key) {
        if (!key) return;
        var value = stringifyCaseField(item[key]);
        if (value) parts.push(value);
      });
      return parts.join(' ').toLowerCase();
    }

    function buildFieldTextMap(items) {
      var result = { title: [], precondition: [], steps: [], expected: [] };
      (Array.isArray(items) ? items : []).forEach(function(item) {
        var title = buildFieldText(item, ['title']);
        var precondition = buildFieldText(item, ['precondition', 'preconditions']);
        var steps = buildFieldText(item, ['steps']);
        var expected = buildFieldText(item, ['expected']);
        if (title) result.title.push(title);
        if (precondition) result.precondition.push(precondition);
        if (steps) result.steps.push(steps);
        if (expected) result.expected.push(expected);
      });
      return {
        title: result.title.join(' '),
        precondition: result.precondition.join(' '),
        steps: result.steps.join(' '),
        expected: result.expected.join(' '),
      };
    }

    function buildSearchText(item, fields) {
      if (!item || typeof item !== 'object') return '';
      if (buildCaseSearchText) return buildCaseSearchText([item], fields);
      return (fields || []).map(function(key) {
        return stringifyCaseField(item[key]);
      }).filter(Boolean).join(' ').toLowerCase();
    }

    function buildSearchContext(items) {
      var texts = [];
      (Array.isArray(items) ? items : []).forEach(function(item) {
        var text = buildSearchText(item, SEARCH_CASE_FIELDS);
        if (text) texts.push(text);
      });
      return {
        texts: texts,
        searchText: texts.join(' '),
        signatureText: texts.join('\n\n'),
      };
    }

    function buildAiContext(items) {
      var entries = [];
      var texts = [];
      (Array.isArray(items) ? items : []).forEach(function(item) {
        if (!item || typeof item !== 'object') return;
        entries.push({
          module: stringifyCaseField(item.module || item.module_name || ''),
          title: stringifyCaseField(item.title || ''),
          priority: stringifyCaseField(item.priority || ''),
          precondition: stringifyCaseField(item.precondition || item.preconditions || ''),
          steps: stringifyCaseField(item.steps || ''),
          expected: stringifyCaseField(item.expected || ''),
        });
        var text = buildSearchText(item, AI_CASE_FIELDS);
        if (text) texts.push(text);
      });
      return {
        entries: entries,
        texts: texts,
        searchText: texts.join(' '),
        signatureText: texts.join('\n\n'),
      };
    }

    function hasKeywordHit(text, keywords) {
      if (!text || !keywords || !keywords.length) return false;
      for (var i = 0; i < keywords.length; i += 1) {
        if (text.indexOf(keywords[i]) !== -1) return true;
      }
      return false;
    }

    function scoreItem(item, fieldTextMap) {
      if (!item || typeof item !== 'object') return 0;
      var map = fieldTextMap && typeof fieldTextMap === 'object' ? fieldTextMap : {};
      var score = 0;
      if (hasKeywordHit(map.title, buildKeywords(item.title))) score += 1;
      if (hasKeywordHit(map.precondition, buildKeywords(item.precondition))) score += 1;
      if (hasKeywordHit(map.steps, buildKeywords(item.steps))) score += 1;
      if (hasKeywordHit(map.expected, buildKeywords(item.expected))) score += 1;
      return score;
    }

    function resolveScoreLevel(score, fallback) {
      if (fallback) return String(fallback);
      var number = Number(score);
      if (!isFinite(number)) return '低';
      if (number >= 3) return '高';
      if (number >= 2) return '中';
      return '低';
    }

    function isLibraryEmpty(modules) {
      var list = Array.isArray(modules) ? modules : [];
      if (!list.length) return true;
      var hasCount = false;
      for (var i = 0; i < list.length; i += 1) {
        var item = list[i];
        if (!item || item.item_count === undefined || item.item_count === null) continue;
        hasCount = true;
        var count = Number(item.item_count);
        if (isFinite(count) && count > 0) return false;
      }
      return hasCount;
    }

    function hashText(text) {
      var value = String(text || '');
      var hash = 0;
      for (var i = 0; i < value.length; i += 1) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0;
      }
      return hash + ':' + value.length;
    }

    function buildSummary(reminder) {
      var source = reminder && typeof reminder === 'object' ? reminder : {};
      var modules = Array.isArray(source.matchedModules) ? source.matchedModules : [];
      var types = Array.isArray(source.matchedTypes) ? source.matchedTypes : [];
      var parts = [];
      if (modules.length) {
        var shownModules = modules.slice(0, 4);
        var moduleText = shownModules.join('、');
        if (modules.length > shownModules.length) moduleText += ' 等' + modules.length + '个';
        parts.push('模块：' + moduleText);
      }
      if (types.length) {
        var shownTypes = types.slice(0, 4);
        var typeText = shownTypes.join('、');
        if (types.length > shownTypes.length) typeText += ' 等' + types.length + '个';
        parts.push('类型：' + typeText);
      }
      return parts.join('；');
    }

    function resolveLimit(reminder) {
      var limit = reminder && reminder.limit !== undefined ? Number(reminder.limit) : 10;
      return isFinite(limit) && limit > 0 ? limit : 10;
    }

    function matchCatalogs(modules, types, searchText) {
      var text = String(searchText || '').toLowerCase();
      var result = {
        matchedModules: [],
        matchedTypes: [],
        moduleIds: [],
        typeIds: [],
        allModuleIds: [],
        allTypeIds: [],
        matchedModuleMap: {},
        matchedTypeMap: {},
        moduleMap: {},
        typeNameMap: {},
      };
      (Array.isArray(modules) ? modules : []).forEach(function(item) {
        if (!item || item.id === null || item.id === undefined) return;
        var id = String(item.id);
        var name = item.name ? String(item.name).trim() : '';
        result.moduleMap[id] = item;
        result.allModuleIds.push(id);
        if (name && text.indexOf(name.toLowerCase()) !== -1) {
          result.matchedModules.push(name);
          result.moduleIds.push(id);
          result.matchedModuleMap[id] = true;
        }
      });
      (Array.isArray(types) ? types : []).forEach(function(item) {
        if (!item || item.id === null || item.id === undefined) return;
        var id = String(item.id);
        var name = item.name ? String(item.name).trim() : '';
        result.typeNameMap[id] = name || ('类型#' + id);
        result.allTypeIds.push(id);
        if (name && text.indexOf(name.toLowerCase()) !== -1) {
          result.matchedTypes.push(name);
          result.typeIds.push(id);
          result.matchedTypeMap[id] = true;
        }
      });
      return result;
    }

    function itemMatches(item, matchedModuleMap, matchedTypeMap, matchConfig, normalizeTypeIds, mode) {
      var source = item && typeof item === 'object' ? item : {};
      var normalizeIds = typeof normalizeTypeIds === 'function' ? normalizeTypeIds : function(values) {
        return Array.isArray(values) ? values.map(String) : [];
      };
      var typeIds = normalizeIds(source.type_ids);
      if (!typeIds.length && source.type_id) typeIds = normalizeIds([source.type_id]);
      var moduleHit = Boolean(source.module_id && matchedModuleMap[String(source.module_id)]);
      var typeHit = typeIds.some(function(id) { return Boolean(matchedTypeMap[String(id)]); });
      if (mode === 'any') return moduleHit || typeHit;
      var config = resolveMatchConfig(matchConfig, { type: true, module: true });
      return (config.module !== true || moduleHit) && (config.type !== true || typeHit);
    }

    function sortAndLimit(items, fieldTextMap, reminder) {
      var ranked = (Array.isArray(items) ? items : []).map(function(item, index) {
        var clone = item && typeof item === 'object' ? Object.assign({}, item) : {};
        clone.match_score = scoreItem(clone, fieldTextMap);
        clone.__score_index = index;
        return clone;
      });
      ranked.sort(function(a, b) {
        var scoreA = Number(a && a.match_score) || 0;
        var scoreB = Number(b && b.match_score) || 0;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return (Number(a && a.__score_index) || 0) - (Number(b && b.__score_index) || 0);
      });
      return ranked.slice(0, resolveLimit(reminder)).map(function(item) {
        delete item.__score_index;
        return item;
      });
    }

    function buildAiCandidateSnapshot(items, fieldTextMap, formatTypeLabel) {
      var formatType = typeof formatTypeLabel === 'function' ? formatTypeLabel : function() { return ''; };
      var map = {};
      var itemMap = {};
      (Array.isArray(items) ? items : []).forEach(function(item, index) {
        if (!item) return;
        var clone = Object.assign({}, item);
        var score = scoreItem(clone, fieldTextMap);
        var level = resolveScoreLevel(score, '');
        clone.match_score = score;
        clone.match_level = level;
        var id = String(index + 1);
        map[id] = {
          module: stringifyCaseField(clone.module_name || clone.module || ''),
          type: stringifyCaseField(formatType(clone)),
          title: stringifyCaseField(clone.title || ''),
          priority: stringifyCaseField(clone.priority || ''),
          precondition: stringifyCaseField(clone.precondition || ''),
          steps: stringifyCaseField(clone.steps || ''),
          expected: stringifyCaseField(clone.expected || ''),
          match_level: stringifyCaseField(level),
        };
        itemMap[id] = clone;
      });
      return { map: map, itemMap: itemMap };
    }

    function parseAiIds(content) {
      var stripped = stripCodeFence(content || '');
      var payloadText = extractJsonPayload(stripped);
      var data = JSON.parse(payloadText || stripped);
      var ids = data && Array.isArray(data.ids) ? data.ids : [];
      return ids.map(function(id) { return String(id).trim(); }).filter(Boolean);
    }

    function selectAiItems(ids, itemMap) {
      var selected = [];
      var seen = {};
      var map = itemMap && typeof itemMap === 'object' ? itemMap : {};
      (Array.isArray(ids) ? ids : []).forEach(function(id) {
        var key = String(id || '').trim();
        if (!key || seen[key] || !map[key]) return;
        seen[key] = true;
        selected.push(Object.assign({}, map[key]));
      });
      return selected;
    }

    function hasAiGenerated(reminder) {
      if (!reminder || reminder.aiGenerated !== true) return false;
      var contextSignature = reminder.aiContextSignature ? String(reminder.aiContextSignature) : '';
      var aiSignature = reminder.aiSignature ? String(reminder.aiSignature) : '';
      return Boolean(contextSignature && aiSignature && contextSignature === aiSignature);
    }

    return {
      createDefaultState: createDefaultState,
      ensureState: ensureState,
      resolveMatchConfig: resolveMatchConfig,
      buildFieldTextMap: buildFieldTextMap,
      buildSearchContext: buildSearchContext,
      buildAiContext: buildAiContext,
      scoreItem: scoreItem,
      resolveScoreLevel: resolveScoreLevel,
      isLibraryEmpty: isLibraryEmpty,
      hashText: hashText,
      buildSummary: buildSummary,
      resolveLimit: resolveLimit,
      matchCatalogs: matchCatalogs,
      itemMatches: itemMatches,
      sortAndLimit: sortAndLimit,
      buildAiCandidateSnapshot: buildAiCandidateSnapshot,
      parseAiIds: parseAiIds,
      selectAiItems: selectAiItems,
      hasAiGenerated: hasAiGenerated,
    };
  }

  return { create: create };
});
