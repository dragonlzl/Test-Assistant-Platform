(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.opsLogOverviewModel = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  var INVISIBLE_MARKER_RE = /[\u200b\u200c\u200d\u2060\ufeff]/g;

  var CONTRIBUTION_BEHAVIORS = [
    { key: 'import', label: '用例导入' },
    { key: 'add', label: '新增用例' },
    { key: 'edit', label: '修改用例' },
    { key: 'delete', label: '删除用例' },
  ];

  var EXEC_CONTRIBUTION_BEHAVIORS = [
    { key: 'exec', label: '用例执行' },
    { key: 'archive', label: '归档用例' },
  ];

  function normalizeAction(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeCaseText(value) {
    if (value === null || value === undefined) return '';
    try {
      return String(value).replace(INVISIBLE_MARKER_RE, '').trim();
    } catch (err) {
      return '';
    }
  }

  function readDetailBool(detail, key) {
    if (!detail || typeof detail !== 'object' || !(key in detail)) return null;
    var raw = detail[key];
    if (raw === true || raw === false) return raw;
    if (typeof raw === 'string') {
      var value = raw.trim().toLowerCase();
      if (value === 'true') return true;
      if (value === 'false') return false;
    }
    return null;
  }

  function getPositiveNumber(value) {
    var numberValue = Number(value);
    if (!isFinite(numberValue) || numberValue <= 0) return 0;
    return numberValue;
  }

  function isCaseItemCompleteFromDetail(detail) {
    if (!detail || typeof detail !== 'object') return null;
    return Boolean(
      normalizeCaseText(detail.module)
      && normalizeCaseText(detail.title)
      && normalizeCaseText(detail.precondition)
      && normalizeCaseText(detail.steps)
      && normalizeCaseText(detail.expected)
    );
  }

  function isCaseItemDeleteCompleteFromDetail(detail) {
    if (!detail || typeof detail !== 'object') return null;
    return Boolean(
      normalizeCaseText(detail.title)
      && normalizeCaseText(detail.precondition)
      && normalizeCaseText(detail.steps)
      && normalizeCaseText(detail.expected)
    );
  }

  function findBehaviorLabel(list, key) {
    var stableKey = String(key || '').trim();
    var match = list.filter(function(item) { return item.key === stableKey; })[0];
    return match && match.label ? match.label : stableKey;
  }

  function resolveContributionEntry(log) {
    if (!log || typeof log !== 'object') return null;
    var action = normalizeAction(log.action);
    var detail = log.detail && typeof log.detail === 'object' ? log.detail : {};
    var count = 0;
    var complete = null;
    if (action === 'import_case_file' || action === 'overwrite_case_file') {
      count = getPositiveNumber(detail.item_imported) || getPositiveNumber(detail.item_unique);
      return count ? { key: 'import', count: count } : null;
    }
    if (action === 'append_case_items') {
      count = getPositiveNumber(detail.item_appended_complete) || getPositiveNumber(detail.item_appended);
      return count ? { key: 'add', count: count } : null;
    }
    if (action === 'create_case_item') {
      complete = readDetailBool(detail, 'next_complete');
      if (complete === null) complete = readDetailBool(detail, 'complete');
      if (complete === null) complete = isCaseItemCompleteFromDetail(detail);
      return complete ? { key: 'add', count: 1 } : null;
    }
    if (action === 'update_case_item') {
      var previousComplete = readDetailBool(detail, 'prev_complete');
      var nextComplete = readDetailBool(detail, 'next_complete');
      if (nextComplete === null) nextComplete = isCaseItemCompleteFromDetail(detail);
      return previousComplete === false && nextComplete === true ? { key: 'add', count: 1 } : null;
    }
    if (action === 'delete_case_item') {
      complete = readDetailBool(detail, 'prev_delete_complete');
      if (complete === null) complete = readDetailBool(detail, 'prev_complete');
      if (complete === null) complete = readDetailBool(detail, 'complete');
      if (complete === null) complete = isCaseItemDeleteCompleteFromDetail(detail);
      return complete ? { key: 'delete', count: 1 } : null;
    }
    if (action === 'delete_case_file') {
      count = getPositiveNumber(detail.item_deleted_complete);
      return count ? { key: 'delete', count: count } : null;
    }
    if (action === 'create_missing_case_item') return { key: 'add', count: 1 };
    if (action === 'update_missing_case_item') return { key: 'edit', count: 1 };
    if (action === 'delete_missing_case_item') return { key: 'delete', count: 1 };
    return null;
  }

  function normalizeExecCaseKey(detail) {
    if (!detail || typeof detail !== 'object') return '';
    var execSetId = detail.exec_set_id || detail.exec_set_id === 0 ? String(detail.exec_set_id) : '';
    var caseKey = [
      normalizeCaseText(detail.module),
      normalizeCaseText(detail.title),
      normalizeCaseText(detail.precondition),
      normalizeCaseText(detail.steps),
      normalizeCaseText(detail.expected),
    ].join('::');
    return execSetId ? execSetId + '::' + caseKey : caseKey;
  }

  function resolveExecCaseFileName(detail) {
    if (!detail || typeof detail !== 'object') return '';
    return normalizeCaseText(detail.case_file_name)
      || normalizeCaseText(detail.file_name)
      || normalizeCaseText(detail.exec_set_name);
  }

  function readChangedFields(detail) {
    if (!detail || typeof detail !== 'object') return [];
    if (Array.isArray(detail.changed_fields)) {
      return detail.changed_fields.map(function(item) { return String(item || '').trim(); }).filter(Boolean);
    }
    if (typeof detail.changed_fields === 'string') {
      return detail.changed_fields.split(',').map(function(item) { return item.trim(); }).filter(Boolean);
    }
    return [];
  }

  function resolveReuseMeta(detail) {
    if (!detail || typeof detail !== 'object') {
      return { isReuse: false, executedCount: null, totalCount: null };
    }
    var total = Number(detail.reuse_total_count);
    var executed = Number(detail.reuse_executed_count);
    var totalOk = Number.isFinite(total) && total > 0;
    var executedOk = Number.isFinite(executed) && executed >= 0;
    return {
      isReuse: totalOk || readChangedFields(detail).indexOf('reuse_details') !== -1,
      executedCount: totalOk && executedOk ? executed : null,
      totalCount: totalOk ? total : null,
    };
  }

  function isExecCaseExecuted(detail) {
    if (!detail || typeof detail !== 'object') return false;
    var changed = readChangedFields(detail);
    var hasChanged = changed.indexOf('status') !== -1 || changed.indexOf('actual_result') !== -1;
    var statusRaw = String(detail.status || '').trim();
    var pendingMap = { '': true, pending: true, '未执行': true, '变更重跑': true, '有改动': true };
    var hasStatus = Boolean(statusRaw) && !pendingMap[statusRaw] && !pendingMap[statusRaw.toLowerCase()];
    return Boolean(hasChanged || hasStatus || normalizeCaseText(detail.actual_result));
  }

  function resolveExecCaseExecutedState(detail) {
    var reuseMeta = resolveReuseMeta(detail);
    if (reuseMeta.totalCount !== null && reuseMeta.executedCount !== null) {
      return reuseMeta.executedCount > 0;
    }
    return isExecCaseExecuted(detail);
  }

  function isExecCaseRunEvent(detail) {
    if (!detail || typeof detail !== 'object') return false;
    var changed = readChangedFields(detail);
    var hasSignal = changed.indexOf('status') !== -1
      || changed.indexOf('actual_result') !== -1
      || changed.indexOf('reuse_details') !== -1;
    return hasSignal && resolveExecCaseExecutedState(detail) === true;
  }

  function parseTimeMs(value) {
    if (!value && value !== 0) return null;
    var normalized = value;
    if (typeof value !== 'number') {
      normalized = String(value || '').trim();
      if (normalized.indexOf('T') === -1 && normalized.indexOf(' ') !== -1) {
        normalized = normalized.replace(' ', 'T');
      }
      normalized = normalized.replace(/(\.\d{3})\d+/, '$1');
      normalized = normalized.replace(/([+-]\d{2}):(\d{2})$/, '$1$2');
      var hasTimezone = /Z$/i.test(normalized)
        || /[+-]\d{2}\d{2}$/.test(normalized)
        || /[+-]\d{2}:\d{2}$/.test(normalized);
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized) && !hasTimezone) normalized += 'Z';
    }
    var dateValue = new Date(normalized);
    return !dateValue || isNaN(dateValue.getTime()) ? null : dateValue.getTime();
  }

  function getDayKeyFromMs(value) {
    if (!Number.isFinite(value)) return '';
    var dateValue = new Date(value);
    if (!dateValue || isNaN(dateValue.getTime())) return '';
    function pad(part) { return part < 10 ? '0' + part : String(part); }
    return dateValue.getFullYear() + '-' + pad(dateValue.getMonth() + 1) + '-' + pad(dateValue.getDate());
  }

  function buildExecCaseRunLogs(list, options) {
    if (!Array.isArray(list) || !list.length) return [];
    var now = options && typeof options.now === 'function' ? options.now : Date.now;
    var groups = {};
    var todayKey = getDayKeyFromMs(now());
    list.forEach(function(log) {
      if (!log || normalizeAction(log.action) !== 'update_exec_case') return;
      var detail = log.detail && typeof log.detail === 'object' ? log.detail : {};
      var timeMs = parseTimeMs(log.created_at);
      if (timeMs === null) return;
      var dayKey = getDayKeyFromMs(timeMs);
      var userId = log.user_id || log.user_id === 0 ? String(log.user_id) : '';
      if (!dayKey || !userId) return;
      var fileName = resolveExecCaseFileName(detail);
      var execSetId = detail.exec_set_id || detail.exec_set_id === 0 ? String(detail.exec_set_id) : '';
      var fileKey = fileName || (execSetId ? 'exec-set-' + execSetId : 'unknown');
      var groupKey = userId + '::' + dayKey + '::' + fileKey;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          userId: userId,
          dayKey: dayKey,
          fileKey: fileKey,
          fileName: fileName,
          username: log.username || '',
          logs: [],
        };
      }
      if (!groups[groupKey].username && log.username) groups[groupKey].username = log.username;
      if (!groups[groupKey].fileName && fileName) groups[groupKey].fileName = fileName;
      groups[groupKey].logs.push({ log: log, time: timeMs });
    });

    var results = [];
    Object.keys(groups).forEach(function(groupKey) {
      var group = groups[groupKey];
      var items = group.logs.slice().sort(function(a, b) { return a.time - b.time; });
      var executedMap = {};
      var executedCount = 0;
      var firstEvent = null;
      var lastEvent = null;
      items.forEach(function(entry) {
        var log = entry.log;
        var detail = log.detail && typeof log.detail === 'object' ? log.detail : {};
        var caseKey = normalizeExecCaseKey(detail);
        if (!caseKey) return;
        var previousExecuted = executedMap[caseKey] === true;
        var nextExecuted = resolveExecCaseExecutedState(detail) === true;
        var beforeCount = executedCount;
        if (nextExecuted !== previousExecuted) {
          executedCount = nextExecuted ? executedCount + 1 : Math.max(0, executedCount - 1);
          executedMap[caseKey] = nextExecuted;
        } else if (executedMap[caseKey] === undefined) {
          executedMap[caseKey] = nextExecuted;
        }
        if (!isExecCaseRunEvent(detail)) return;
        var reuseMeta = resolveReuseMeta(detail);
        var payload = {
          log: log,
          before: beforeCount,
          after: executedCount,
          title: String(detail.title || detail.case_title || detail.case_name || '').trim() || null,
          fileName: resolveExecCaseFileName(detail) || null,
          reuseType: reuseMeta.isReuse ? 'reuse' : '',
        };
        if (!firstEvent) firstEvent = payload;
        lastEvent = payload;
      });
      if (!firstEvent) return;
      function createSynthetic(stage, event, beforeCount, afterCount) {
        return {
          id: 'exec-case-run-' + stage + '-' + group.userId + '-' + group.dayKey + '-' + group.fileKey,
          user_id: event.log.user_id,
          username: event.log.username || group.username,
          action: 'exec_case_run',
          target_type: 'exec_set',
          target_id: null,
          result: 'success',
          detail: {
            page: 'tempexec',
            exec_day: group.dayKey,
            exec_stage: stage,
            exec_count: stage === 'first' ? 1 : afterCount - beforeCount,
            before_count: beforeCount,
            after_count: afterCount,
            case_title: event.title,
            case_file_name: event.fileName || group.fileName || null,
            case_type: event.reuseType,
          },
          created_at: event.log.created_at,
        };
      }
      results.push(createSynthetic('first', firstEvent, firstEvent.before, firstEvent.after));
      if (lastEvent && lastEvent !== firstEvent && group.dayKey !== todayKey) {
        results.push(createSynthetic('last', lastEvent, firstEvent.after, lastEvent.after));
      }
    });
    return results;
  }

  function resolveExecContributionEntry(log) {
    if (!log || typeof log !== 'object') return null;
    var action = normalizeAction(log.action);
    var detail = log.detail && typeof log.detail === 'object' ? log.detail : {};
    if (action === 'update_exec_case') {
      var caseKey = normalizeExecCaseKey(detail);
      if (!isExecCaseExecuted(detail) || !caseKey) return null;
      return { key: 'exec', count: 1, caseKey: caseKey };
    }
    if (action === 'archive_exec_set') {
      var archived = getPositiveNumber(detail.actual_result_count);
      return archived ? { key: 'archive', count: archived } : null;
    }
    return null;
  }

  function ensureUserRecord(userMap, log, userNameMap) {
    var userId = log && (log.user_id || log.user_id === 0) ? String(log.user_id) : '';
    if (!userId) return null;
    if (!userMap[userId]) {
      var fallbackName = userNameMap[userId] || ('用户#' + userId);
      userMap[userId] = {
        id: userId,
        name: String(log.username || fallbackName),
        behaviors: {},
      };
    }
    return userMap[userId];
  }

  function buildSummary(logs, options) {
    var opts = options || {};
    var mode = opts.mode || 'activity';
    var userNameMap = opts.userNameMap || {};
    var resolveActivityActionLabel = typeof opts.resolveActivityActionLabel === 'function'
      ? opts.resolveActivityActionLabel
      : function() { return ''; };
    var behaviorDefinitions = mode === 'contribution'
      ? CONTRIBUTION_BEHAVIORS
      : (mode === 'exec' ? EXEC_CONTRIBUTION_BEHAVIORS : []);
    var behaviorTotals = {};
    behaviorDefinitions.forEach(function(item) { behaviorTotals[item.key] = 0; });
    var userMap = {};
    var execCaseDedup = {};

    (Array.isArray(logs) ? logs : []).forEach(function(log) {
      var key = '';
      var count = 0;
      if (mode === 'activity') {
        key = resolveActivityActionLabel(log);
        count = key ? 1 : 0;
      } else {
        var resolved = mode === 'exec' ? resolveExecContributionEntry(log) : resolveContributionEntry(log);
        if (!resolved) return;
        key = resolved.key;
        count = getPositiveNumber(resolved.count);
        if (mode === 'exec' && key === 'exec') {
          var userId = log && (log.user_id || log.user_id === 0) ? String(log.user_id) : '';
          var caseKey = String(resolved.caseKey || '');
          if (!userId || !caseKey) return;
          if (!execCaseDedup[userId]) execCaseDedup[userId] = {};
          if (execCaseDedup[userId][caseKey]) return;
          execCaseDedup[userId][caseKey] = true;
          count = 1;
        }
      }
      if (!key || !count) return;
      var record = ensureUserRecord(userMap, log, userNameMap);
      if (!record) return;
      record.behaviors[key] = (record.behaviors[key] || 0) + count;
      behaviorTotals[key] = (behaviorTotals[key] || 0) + count;
    });

    var behaviors = behaviorDefinitions.length
      ? behaviorDefinitions.map(function(item) {
          return { key: item.key, label: item.label, count: behaviorTotals[item.key] || 0 };
        })
      : Object.keys(behaviorTotals).map(function(key) {
          return { key: key, label: key, count: behaviorTotals[key] };
        }).sort(function(a, b) {
          if (b.count !== a.count) return b.count - a.count;
          return String(a.label || '').localeCompare(String(b.label || ''));
        });
    return { behaviors: behaviors, userMap: userMap };
  }

  function buildAllowedBehaviorMap(selectedBehaviors) {
    var selected = selectedBehaviors || { all: true };
    if (selected.all) return null;
    var allowed = {};
    Object.keys(selected).forEach(function(key) {
      if (key !== 'all' && selected[key]) allowed[key] = true;
    });
    return allowed;
  }

  function selectActionUsers(summary, selectedBehaviors, mode) {
    var allowed = buildAllowedBehaviorMap(selectedBehaviors);
    var users = [];
    Object.keys(summary && summary.userMap ? summary.userMap : {}).forEach(function(id) {
      var entry = summary.userMap[id];
      var actions = [];
      var total = 0;
      Object.keys(entry.behaviors || {}).forEach(function(key) {
        if (allowed && !allowed[key]) return;
        var count = entry.behaviors[key] || 0;
        if (!count) return;
        total += count;
        var label = mode === 'contribution' ? findBehaviorLabel(CONTRIBUTION_BEHAVIORS, key) : key;
        actions.push({ key: key, label: label, count: count });
      });
      if (!total) return;
      actions.sort(function(a, b) {
        if (b.count !== a.count) return b.count - a.count;
        return String(a.label || '').localeCompare(String(b.label || ''));
      });
      users.push({ id: entry.id, name: entry.name, total: total, actions: actions });
    });
    users.sort(function(a, b) {
      if (b.total !== a.total) return b.total - a.total;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return users;
  }

  function selectExecUsers(summary, selectedBehaviors) {
    var allowed = buildAllowedBehaviorMap(selectedBehaviors);
    var users = [];
    Object.keys(summary && summary.userMap ? summary.userMap : {}).forEach(function(id) {
      var entry = summary.userMap[id];
      var execCount = !allowed || allowed.exec ? (entry.behaviors.exec || 0) : 0;
      var archiveCount = !allowed || allowed.archive ? (entry.behaviors.archive || 0) : 0;
      if (!execCount && !archiveCount) return;
      users.push({
        id: entry.id,
        name: entry.name,
        execCount: execCount,
        archiveCount: archiveCount,
        total: execCount + archiveCount,
      });
    });
    users.sort(function(a, b) {
      if (b.total !== a.total) return b.total - a.total;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return users;
  }

  return {
    CONTRIBUTION_BEHAVIORS: CONTRIBUTION_BEHAVIORS,
    EXEC_CONTRIBUTION_BEHAVIORS: EXEC_CONTRIBUTION_BEHAVIORS,
    buildExecCaseRunLogs: buildExecCaseRunLogs,
    buildSummary: buildSummary,
    isExecCaseExecuted: isExecCaseExecuted,
    normalizeExecCaseKey: normalizeExecCaseKey,
    resolveContributionEntry: resolveContributionEntry,
    resolveExecContributionEntry: resolveExecContributionEntry,
    selectActionUsers: selectActionUsers,
    selectExecUsers: selectExecUsers,
  };
});
