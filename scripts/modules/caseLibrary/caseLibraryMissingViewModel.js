(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.missingViewModel = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var normalizeText = typeof opts.normalizeText === 'function'
      ? opts.normalizeText
      : function(value) { return value === null || value === undefined ? '' : String(value).trim(); };
    var normalizePriority = typeof opts.normalizePriority === 'function'
      ? opts.normalizePriority
      : function(value) { return normalizeText(value); };
    var normalizeTypeId = typeof opts.normalizeTypeId === 'function'
      ? opts.normalizeTypeId
      : function(value) {
          if (value === null || value === undefined || value === '') return null;
          return String(value);
        };
    var normalizeTypeIds = typeof opts.normalizeTypeIds === 'function'
      ? opts.normalizeTypeIds
      : function(values) {
          return (Array.isArray(values) ? values : []).map(normalizeTypeId).filter(Boolean);
        };
    var collectTypeIds = typeof opts.collectTypeIds === 'function'
      ? opts.collectTypeIds
      : function(item) { return normalizeTypeIds(item && item.type_ids); };
    var resolveTypeNames = typeof opts.resolveTypeNames === 'function'
      ? opts.resolveTypeNames
      : function(ids, names) { return Array.isArray(names) ? names.slice() : []; };
    var resolveTypeLabel = typeof opts.resolveTypeLabel === 'function'
      ? opts.resolveTypeLabel
      : function(typeId, fallback) { return fallback || (typeId ? ('类型#' + typeId) : '未分类'); };

    function buildItemPayload(item) {
      var priority = normalizePriority(normalizeText(item && item.priority ? item.priority : ''));
      return {
        title: normalizeText(item && item.title ? item.title : ''),
        priority: priority || null,
        precondition: normalizeText(item && item.precondition ? item.precondition : ''),
        steps: normalizeText(item && item.steps ? item.steps : ''),
        expected: normalizeText(item && item.expected ? item.expected : ''),
        remark: normalizeText(item && item.remark ? item.remark : '') || null,
        type_ids: collectTypeIds(item),
      };
    }

    function validatePayload(payload) {
      if (!payload) return '内容不能为空';
      if (!payload.title) return '用例标题不能为空';
      if (!payload.expected) return '预期结果不能为空';
      return '';
    }

    function normalizeFilterSet(filters) {
      if (filters instanceof Set) return filters;
      return new Set(Array.isArray(filters) ? filters.map(String) : []);
    }

    function getFilteredIndexes(items, filters) {
      var list = Array.isArray(items) ? items : [];
      var active = normalizeFilterSet(filters);
      if (!active.size) {
        var all = [];
        for (var i = 0; i < list.length; i += 1) all.push(i);
        return all;
      }
      var result = [];
      list.forEach(function(item, index) {
        if (!item) return;
        var typeIds = normalizeTypeIds(item.type_ids);
        if (!typeIds.length && item.type_id) typeIds = normalizeTypeIds([item.type_id]);
        if (!typeIds.length) {
          if (active.has('none')) result.push(index);
          return;
        }
        for (var i = 0; i < typeIds.length; i += 1) {
          if (active.has(String(typeIds[i]))) {
            result.push(index);
            return;
          }
        }
      });
      return result;
    }

    function resolvePage(items, filters, pageIndex, pageSize) {
      var filteredIndexes = getFilteredIndexes(items, filters);
      var size = Math.max(1, Number(pageSize) || 1);
      var total = filteredIndexes.length;
      var totalPages = total ? Math.ceil(total / size) : 1;
      var index = Number(pageIndex);
      if (!isFinite(index)) index = 0;
      index = Math.max(0, Math.min(index, totalPages - 1));
      var start = index * size;
      var end = Math.min(total, start + size);
      return {
        filteredIndexes: filteredIndexes,
        pagedIndexes: filteredIndexes.slice(start, end),
        total: total,
        totalPages: totalPages,
        pageIndex: index,
        pageSize: size,
        start: start,
        end: end,
      };
    }

    function hasDuplicateType(slots, slotIndex, typeId) {
      if (!typeId || !Array.isArray(slots)) return false;
      var key = String(typeId);
      for (var i = 0; i < slots.length; i += 1) {
        if (i === Number(slotIndex)) continue;
        var existing = normalizeTypeId(slots[i]);
        if (existing && String(existing) === key) return true;
      }
      return false;
    }

    function buildTypePills(items, typeCatalog) {
      var counts = {};
      (Array.isArray(items) ? items : []).forEach(function(item) {
        if (!item) return;
        var typeIds = normalizeTypeIds(item.type_ids);
        if (!typeIds.length && item.type_id) typeIds = normalizeTypeIds([item.type_id]);
        var typeNames = resolveTypeNames(
          typeIds,
          item.type_names || (item.type_name ? [item.type_name] : [])
        );
        if (!typeIds.length) {
          if (!counts.none) {
            counts.none = { key: 'none', label: resolveTypeLabel(null, null), count: 0 };
          }
          counts.none.count += 1;
          return;
        }
        typeIds.forEach(function(typeId, index) {
          var key = String(typeId);
          if (!counts[key]) {
            counts[key] = {
              key: key,
              label: resolveTypeLabel(typeId, typeNames[index]),
              count: 0,
            };
          }
          counts[key].count += 1;
        });
      });
      var pills = [];
      (Array.isArray(typeCatalog) ? typeCatalog : []).forEach(function(type) {
        if (!type || type.id === null || type.id === undefined) return;
        var key = String(type.id);
        if (!counts[key]) return;
        if (type.name) counts[key].label = String(type.name);
        pills.push(counts[key]);
        delete counts[key];
      });
      Object.keys(counts).forEach(function(key) { pills.push(counts[key]); });
      return pills;
    }

    return {
      buildItemPayload: buildItemPayload,
      validatePayload: validatePayload,
      getFilteredIndexes: getFilteredIndexes,
      resolvePage: resolvePage,
      hasDuplicateType: hasDuplicateType,
      buildTypePills: buildTypePills,
      resolveTypeLabel: resolveTypeLabel,
    };
  }

  return { create: create };
});
