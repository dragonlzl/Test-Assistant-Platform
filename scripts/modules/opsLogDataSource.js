(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.opsLogDataSource = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var apiClient = opts.apiClient || null;
    var isAutoOperation = typeof opts.isAutoOperation === 'function'
      ? opts.isAutoOperation
      : function() { return false; };
    var isAllowedLog = typeof opts.isAllowedLog === 'function'
      ? opts.isAllowedLog
      : function() { return true; };
    var isTimeInRange = typeof opts.isTimeInRange === 'function'
      ? opts.isTimeInRange
      : function() { return true; };

    function normalizeRange(range) {
      var source = range && typeof range === 'object' ? range : {};
      function normalizeBoundary(value) {
        if (value === null || value === undefined || value === '') return null;
        var numberValue = Number(value);
        return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : null;
      }
      return {
        startMs: normalizeBoundary(source.startMs),
        endMs: normalizeBoundary(source.endMs),
      };
    }

    function listPage(offset, range, userId) {
      if (!apiClient || typeof apiClient.listOperationLogs !== 'function') return Promise.resolve([]);
      return apiClient.listOperationLogs({
        limit: 500,
        offset: offset,
        user_id: userId !== null ? userId : undefined,
        start_ms: range.startMs !== null ? range.startMs : undefined,
        end_ms: range.endMs !== null ? range.endMs : undefined,
      });
    }

    function fetchByRange(rangeValue, optionsValue) {
      var range = normalizeRange(rangeValue);
      var options = optionsValue || {};
      var userId = options.userId || options.userId === 0 ? options.userId : null;
      var offset = 0;
      var results = [];

      function loadNext() {
        return listPage(offset, range, userId).then(function(list) {
          var rows = Array.isArray(list) ? list : [];
          if (!rows.length) return results;
          offset += rows.length;
          results = results.concat(rows.filter(function(row) { return !isAutoOperation(row); }));
          return rows.length >= 500 ? loadNext() : results;
        });
      }

      return loadNext();
    }

    function fetchDrawer(rangeValue, optionsValue) {
      var range = normalizeRange(rangeValue);
      var options = optionsValue || {};
      var userId = options.userId || options.userId === 0 ? options.userId : null;
      var maxAllowed = Number.isFinite(options.maxAllowed) ? options.maxAllowed : 500;
      var hasRange = range.startMs !== null || range.endMs !== null;
      var offset = 0;
      var results = [];
      var allowedCount = 0;
      var reachedCap = false;

      function buildResult() {
        return { logs: results, allowedCount: allowedCount, reachedCap: reachedCap };
      }

      function loadNext() {
        return listPage(offset, range, userId).then(function(list) {
          var rows = Array.isArray(list) ? list : [];
          if (!rows.length) return buildResult();
          offset += rows.length;
          rows.forEach(function(row) {
            if (isAutoOperation(row)) return;
            if (hasRange && !isTimeInRange(row && row.created_at, range)) return;
            results.push(row);
            if (isAllowedLog(row)) allowedCount += 1;
          });
          var shouldContinue = rows.length >= 500;
          if (shouldContinue && !hasRange && maxAllowed && allowedCount >= maxAllowed) {
            reachedCap = true;
            shouldContinue = false;
          }
          return shouldContinue ? loadNext() : buildResult();
        });
      }

      return loadNext();
    }

    return {
      fetchByRange: fetchByRange,
      fetchDrawer: fetchDrawer,
    };
  }

  return { create: create };
});
