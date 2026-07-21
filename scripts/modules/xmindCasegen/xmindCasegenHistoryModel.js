(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.xmindCasegenHistoryModel = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var escapeHtml = typeof opts.escapeHtml === 'function' ? opts.escapeHtml : function(value) {
      if (value === null || value === undefined) return '';
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    var normalizeModuleTitle = typeof opts.normalizeModuleTitle === 'function'
      ? opts.normalizeModuleTitle
      : function(value) { return String(value || '').replace(/\s+/g, ' ').trim(); };
    var normalizeModuleKey = typeof opts.normalizeModuleKey === 'function'
      ? opts.normalizeModuleKey
      : function(value) { return normalizeModuleTitle(value).toLowerCase(); };
    var getRootFullCasesLabel = typeof opts.getRootFullCasesLabel === 'function'
      ? opts.getRootFullCasesLabel
      : function(hadAiContent) { return hadAiContent ? '重新生成全量用例' : '生成全量用例'; };
    var getModuleFullCasesLabel = typeof opts.getModuleFullCasesLabel === 'function'
      ? opts.getModuleFullCasesLabel
      : function() { return '生成全量用例'; };
    var getRequirementLabelText = typeof opts.getRequirementLabelText === 'function'
      ? opts.getRequirementLabelText
      : function() { return ''; };
    var rootActions = opts.rootActions || {};
    var moduleActions = opts.moduleActions || {};

    function padDatePart(value) {
      var num = Number(value) || 0;
      return num < 10 ? ('0' + String(num)) : String(num);
    }

    function formatHistoryTimestamp(timestamp) {
      var time = Number(timestamp);
      if (!Number.isFinite(time) || time <= 0) return '-';
      var date = new Date(time);
      if (isNaN(date.getTime())) return '-';
      return date.getFullYear()
        + '-' + padDatePart(date.getMonth() + 1)
        + '-' + padDatePart(date.getDate())
        + ' ' + padDatePart(date.getHours())
        + ':' + padDatePart(date.getMinutes())
        + ':' + padDatePart(date.getSeconds());
    }

    function getRootHistoryActionLabel(actionId, hadAiContentBeforeAction) {
      if (actionId === rootActions.FULL_CASES) return getRootFullCasesLabel(hadAiContentBeforeAction === true);
      if (actionId === rootActions.FULL_MODULES) return '生成全量模块';
      if (actionId === rootActions.REGENERATE_MODULES) return '重新生成模块';
      if (actionId === rootActions.EXISTING_CASES) return '已有模块补全用例';
      if (actionId === rootActions.TOPUP_MODULES) return '补全模块';
      if (actionId === rootActions.TOPUP_MODULES_CASES) return '补全模块+用例';
      if (actionId === rootActions.APPEND_ALL) return '追加生成全部模块+用例';
      return String(actionId || '');
    }

    function getModuleHistoryActionLabel(actionId, moduleEntry, hadAiCasesBeforeAction) {
      if (actionId === moduleActions.FULL_CASES) {
        if (typeof hadAiCasesBeforeAction === 'boolean') {
          return hadAiCasesBeforeAction ? '重新生成全量用例' : '生成全量用例';
        }
        return getModuleFullCasesLabel(moduleEntry);
      }
      if (actionId === moduleActions.APPEND) return '追加生成';
      return String(actionId || '');
    }

    function getGenerationFailureLabel(scope, actionId, optionsValue) {
      var failureOptions = optionsValue || {};
      if (scope === 'module') {
        if (actionId === moduleActions.APPEND) return '追加失败';
        if (actionId === moduleActions.FULL_CASES) {
          return failureOptions.hadAiCasesBeforeAction === true ? '重新生成失败' : '生成失败';
        }
        return '生成失败';
      }
      if (
        actionId === rootActions.TOPUP_MODULES
        || actionId === rootActions.TOPUP_MODULES_CASES
        || actionId === rootActions.EXISTING_CASES
      ) {
        return '补全失败';
      }
      if (actionId === rootActions.APPEND_ALL) return '追加失败';
      if (actionId === rootActions.REGENERATE_MODULES) return '重新生成失败';
      if (actionId === rootActions.FULL_CASES) {
        return failureOptions.hadAiContentBeforeAction === true ? '重新生成失败' : '生成失败';
      }
      return '生成失败';
    }

    function buildHistoryLocationLabel(scope, moduleTitle) {
      if (scope === 'module') {
        return '模块节点 · ' + (normalizeModuleTitle(moduleTitle) || '当前模块');
      }
      return '根节点 · ' + getRequirementLabelText();
    }

    function normalizeHistoryDurationMs(value) {
      var durationMs = Number(value || 0);
      if (!Number.isFinite(durationMs) || durationMs <= 0) return 0;
      return Math.round(durationMs);
    }

    function getTaskModelRequestDurationMs(task) {
      var totalDurationMs = normalizeHistoryDurationMs(task && task.modelRequestTotalDurationMs);
      if (totalDurationMs > 0) return totalDurationMs;
      var lastDurationMs = normalizeHistoryDurationMs(task && task.modelRequestDurationMs);
      if (lastDurationMs > 0) return lastDurationMs;
      return normalizeHistoryDurationMs(task && task.durationMs);
    }

    function formatHistoryDuration(durationMs) {
      var value = normalizeHistoryDurationMs(durationMs);
      if (!value) return '';
      if (value < 1000) return (value / 1000).toFixed(1) + ' 秒';
      if (value < 60000) {
        var seconds = value / 1000;
        return (seconds < 10 ? seconds.toFixed(1) : String(Math.round(seconds))) + ' 秒';
      }
      var totalSeconds = Math.round(value / 1000);
      var minutes = Math.floor(totalSeconds / 60);
      var remainingSeconds = totalSeconds % 60;
      return String(minutes) + ' 分 ' + String(remainingSeconds) + ' 秒';
    }

    function normalizeHistoryDetails(details) {
      var map = {};
      (Array.isArray(details) ? details : []).forEach(function(item) {
        if (!item) return;
        var moduleTitle = normalizeModuleTitle(item.module || item.moduleTitle || '');
        var key = normalizeModuleKey(moduleTitle || '');
        var stableKey = key || ('module-' + String(Object.keys(map).length + 1));
        if (!map[stableKey]) {
          map[stableKey] = {
            module: moduleTitle || '未命名模块',
            caseCount: 0,
            durationMs: 0,
          };
        }
        var caseCount = Number(item.caseCount);
        if (!Number.isFinite(caseCount) || caseCount < 0) caseCount = 0;
        map[stableKey].caseCount += caseCount;
        map[stableKey].durationMs = Math.max(
          Number(map[stableKey].durationMs || 0),
          normalizeHistoryDurationMs(item.durationMs)
        );
      });
      return Object.keys(map).map(function(key) { return map[key]; });
    }

    function normalizeHistoryDiagnostics(items) {
      var result = [];
      var seen = {};
      (Array.isArray(items) ? items : []).forEach(function(item) {
        var text = String(item || '').trim();
        if (!text || seen[text]) return;
        seen[text] = true;
        result.push(text);
      });
      return result;
    }

    function normalizeHistoryDedupeStringList(value) {
      var source = Array.isArray(value)
        ? value
        : (value === null || value === undefined ? [] : [value]);
      var seen = {};
      return source.map(function(item) {
        if (item && typeof item === 'object') {
          return String(item.title || item.caseTitle || item.case_title || item.name || '').replace(/\s+/g, ' ').trim();
        }
        return String(item || '').replace(/\s+/g, ' ').trim();
      }).filter(function(item) {
        if (!item || seen[item]) return false;
        seen[item] = true;
        return true;
      });
    }

    function normalizeHistoryDedupeActionType(value, detail) {
      var raw = String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (raw === 'merge' || raw === 'merged' || raw === 'combine' || raw.indexOf('合并') !== -1) return 'merge';
      if (raw === 'duplicate' || raw === 'dup' || raw.indexOf('重复') !== -1) return 'duplicate';
      if (detail && Array.isArray(detail.mergedFrom) && detail.mergedFrom.length) return 'merge';
      if (detail && detail.duplicateOf) return 'duplicate';
      if (detail && detail.mergedInto) return 'merge';
      return 'removed';
    }

    function normalizeHistoryDedupeReason(value) {
      var text = String(value || '').replace(/\s+/g, ' ').trim();
      text = text.replace(/^原因[：:]\s*/, '').replace(/^因为\s*/, '').trim();
      if (!text) return '覆盖高度重叠';
      var cutAt = -1;
      ['，', '。', '；', ';', '.', '、'].forEach(function(mark) {
        var index = text.indexOf(mark);
        if (index > 0 && (cutAt === -1 || index < cutAt)) cutAt = index;
      });
      if (cutAt > 0) text = text.slice(0, cutAt).trim();
      if (text.length > 24) text = text.slice(0, 24).trim() + '…';
      return text || '覆盖高度重叠';
    }

    function normalizeHistoryDedupeOptionalReason(value) {
      var text = String(value || '').replace(/\s+/g, ' ').trim();
      if (!text) return '';
      return normalizeHistoryDedupeReason(text);
    }

    function normalizeHistoryDedupeRecords(items) {
      var result = [];
      var seen = {};
      (Array.isArray(items) ? items : []).forEach(function(item) {
        if (!item || typeof item !== 'object') return;
        var moduleTitle = normalizeModuleTitle(item.module || item.moduleTitle || '');
        var title = String(item.title || item.caseTitle || item.case_title || '').replace(/\s+/g, ' ').trim();
        var reason = normalizeHistoryDedupeReason(item.reason || item.removeReason || item.remove_reason || '');
        var mergedInto = String(item.mergedInto || item.merged_into || item.keepTitle || item.keep_title || '').replace(/\s+/g, ' ').trim();
        var duplicateOf = String(item.duplicateOf || item.duplicate_of || item.duplicateWith || item.duplicate_with || item.sameAs || item.same_as || '').replace(/\s+/g, ' ').trim();
        var duplicatePoint = normalizeHistoryDedupeOptionalReason(item.duplicatePoint || item.duplicate_point || item.overlapPoint || item.overlap_point || item.samePoint || item.same_point || item.overlap || '');
        var mergedFrom = normalizeHistoryDedupeStringList(item.mergedFrom || item.merged_from || item.sourceTitles || item.source_titles || item.beforeTitles || item.before_titles || []);
        if (!title && mergedFrom.length) title = mergedFrom[0];
        if (!moduleTitle || !title) return;
        var actionType = normalizeHistoryDedupeActionType(item.type || item.action || item.actionType || item.action_type || item.kind || '', {
          duplicateOf: duplicateOf,
          mergedInto: mergedInto,
          mergedFrom: mergedFrom,
        });
        var key = normalizeModuleKey(moduleTitle) + '::' + title.toLowerCase() + '::' + reason + '::'
          + actionType + '::' + duplicateOf + '::' + duplicatePoint + '::' + mergedInto + '::' + mergedFrom.join('|');
        if (seen[key]) return;
        seen[key] = true;
        result.push({
          module: moduleTitle,
          title: title,
          reason: reason,
          actionType: actionType,
          duplicateOf: duplicateOf,
          duplicatePoint: duplicatePoint,
          mergedInto: mergedInto,
          mergedFrom: mergedFrom,
        });
      });
      return result;
    }

    function normalizeHistoryPreviewText(value) {
      var text = String(value || '').replace(/\s+/g, ' ').trim();
      if (!text) return '';
      if (text.length <= 140) return text;
      return text.slice(0, 140).trim() + '…';
    }

    function buildHistoryDiagnosticSectionsHtml(diagnostics) {
      var detailedDiagnostics = [];
      var chipDiagnostics = [];
      (Array.isArray(diagnostics) ? diagnostics : []).forEach(function(item) {
        var text = String(item || '').trim();
        if (!text) return;
        if (/^错误信息：/.test(text) || text.length > 120) detailedDiagnostics.push(text);
        else chipDiagnostics.push(text);
      });
      var sections = [];
      if (detailedDiagnostics.length) {
        sections.push(
          '<div class="xmind-casegen-history-diagnostics xmind-casegen-history-diagnostics-blocks">'
            + detailedDiagnostics.map(function(text) {
              var clean = String(text || '').trim();
              var match = clean.match(/^([^：]{2,20}：)\s*(.+)$/);
              var label = match ? String(match[1] || '') : '';
              var value = match ? String(match[2] || '') : clean;
              return '<div class="xmind-casegen-history-diagnostic-block">'
                + (label ? '<strong class="xmind-casegen-history-diagnostic-block-label">' + escapeHtml(label) + '</strong>' : '')
                + '<span class="xmind-casegen-history-diagnostic-block-text">' + escapeHtml(value) + '</span>'
                + '</div>';
            }).join('')
          + '</div>'
        );
      }
      if (chipDiagnostics.length) {
        sections.push(
          '<div class="xmind-casegen-history-diagnostics">'
            + chipDiagnostics.map(function(text) {
              return '<span class="xmind-casegen-history-diagnostic-chip">' + escapeHtml(text) + '</span>';
            }).join('')
          + '</div>'
        );
      }
      return sections.join('');
    }

    function appendUniqueHistoryDedupeTitle(list, title) {
      var text = String(title || '').replace(/\s+/g, ' ').trim();
      if (text && list.indexOf(text) === -1) list.push(text);
    }

    function buildHistoryDedupeDisplayItems(items) {
      var result = [];
      var mergeMap = {};
      (Array.isArray(items) ? items : []).forEach(function(item) {
        if (!item) return;
        if (item.actionType === 'merge') {
          var mergedFromSeed = Array.isArray(item.mergedFrom) && item.mergedFrom.length
            ? item.mergedFrom.slice()
            : [item.title];
          appendUniqueHistoryDedupeTitle(mergedFromSeed, item.title);
          var mergeKey = [
            'merge',
            normalizeModuleKey(item.module || ''),
            String(item.mergedInto || '').toLowerCase(),
            mergedFromSeed.join('|').toLowerCase(),
          ].join('::');
          if (!mergeMap[mergeKey]) {
            mergeMap[mergeKey] = {
              module: item.module,
              title: '',
              reason: item.reason,
              actionType: 'merge',
              duplicateOf: '',
              duplicatePoint: '',
              mergedInto: item.mergedInto,
              mergedFrom: [],
            };
            result.push(mergeMap[mergeKey]);
          }
          mergedFromSeed.forEach(function(title) {
            appendUniqueHistoryDedupeTitle(mergeMap[mergeKey].mergedFrom, title);
          });
          if (!mergeMap[mergeKey].mergedInto && item.mergedInto) mergeMap[mergeKey].mergedInto = item.mergedInto;
          return;
        }
        result.push(item);
      });
      result.forEach(function(item) {
        if (item && item.actionType === 'merge') {
          var count = Array.isArray(item.mergedFrom) ? item.mergedFrom.length : 0;
          item.title = count > 1 ? ('合并前 ' + String(count) + ' 条用例') : (item.mergedFrom[0] || item.title || '合并用例');
        }
      });
      return result;
    }

    function buildHistoryDedupeTitleListHtml(titles) {
      var list = normalizeHistoryDedupeStringList(titles);
      if (!list.length) return '<span class="xmind-casegen-history-dedupe-muted">未提供</span>';
      return '<span class="xmind-casegen-history-dedupe-title-list">'
        + list.map(function(title) {
          return '<span class="xmind-casegen-history-dedupe-title-chip" title="' + escapeHtml(title) + '">' + escapeHtml(title) + '</span>';
        }).join('')
      + '</span>';
    }

    function buildHistoryDedupeDetailHtml(item) {
      var actionType = item && item.actionType ? String(item.actionType || '') : 'removed';
      var reason = item && item.reason ? String(item.reason || '') : '覆盖高度重叠';
      if (actionType === 'duplicate') {
        return '<span class="xmind-casegen-history-dedupe-badge is-duplicate">重复</span>'
          + '<span class="xmind-casegen-history-dedupe-detail-main">'
            + (item.duplicateOf ? ('与「' + escapeHtml(item.duplicateOf) + '」重复') : escapeHtml(reason))
          + '</span>'
          + (item.duplicatePoint ? '<span class="xmind-casegen-history-dedupe-detail-sub">重复点：' + escapeHtml(item.duplicatePoint) + '</span>' : '');
      }
      if (actionType === 'merge') {
        var mergeSourceTitles = Array.isArray(item.mergedFrom) && item.mergedFrom.length ? item.mergedFrom : [item.title];
        return '<span class="xmind-casegen-history-dedupe-badge is-merge">合并</span>'
          + '<span class="xmind-casegen-history-dedupe-merge-flow">'
            + '<span class="xmind-casegen-history-dedupe-merge-label">合并前</span>'
            + buildHistoryDedupeTitleListHtml(mergeSourceTitles)
            + '<span class="xmind-casegen-history-dedupe-merge-label">合并后</span>'
            + '<strong class="xmind-casegen-history-dedupe-merge-target" title="' + escapeHtml(item.mergedInto || '') + '">' + escapeHtml(item.mergedInto || '未提供') + '</strong>'
          + '</span>'
          + '<span class="xmind-casegen-history-dedupe-detail-sub">' + escapeHtml(reason) + '</span>';
      }
      return '<span class="xmind-casegen-history-dedupe-badge is-removed">删除</span>'
        + '<span class="xmind-casegen-history-dedupe-detail-main">' + escapeHtml(reason) + '</span>';
    }

    function buildHistoryDedupeRecordsHtml(records) {
      var list = normalizeHistoryDedupeRecords(records);
      if (!list.length) return '';
      var groups = [];
      var groupMap = {};
      list.forEach(function(item) {
        var moduleName = item.module || '未命名模块';
        var key = normalizeModuleKey(moduleName) || moduleName;
        if (!groupMap[key]) {
          groupMap[key] = { module: moduleName, items: [] };
          groups.push(groupMap[key]);
        }
        groupMap[key].items.push(item);
      });
      return '<div class="xmind-casegen-history-dedupe-records">'
        + '<div class="xmind-casegen-history-dedupe-head">'
          + '<strong class="xmind-casegen-history-dedupe-title">去重记录</strong>'
          + '<span class="xmind-casegen-history-dedupe-summary">已去重 ' + escapeHtml(String(list.length)) + ' 条用例</span>'
        + '</div>'
        + '<div class="xmind-casegen-history-dedupe-module-list">'
          + groups.map(function(group) {
            return '<section class="xmind-casegen-history-dedupe-module-block">'
              + '<div class="xmind-casegen-history-dedupe-module-head">'
                + '<span class="xmind-casegen-history-dedupe-module">' + escapeHtml(group.module || '未命名模块') + '</span>'
                + '<span class="xmind-casegen-history-dedupe-module-count">' + escapeHtml(String(group.items.length)) + ' 条</span>'
              + '</div>'
              + '<div class="xmind-casegen-history-dedupe-table" role="table" aria-label="' + escapeHtml(group.module || '未命名模块') + '去重明细">'
                + '<div class="xmind-casegen-history-dedupe-row xmind-casegen-history-dedupe-row-head" role="row">'
                  + '<span role="columnheader">处理的用例</span>'
                  + '<span role="columnheader">处理关系</span>'
                + '</div>'
                + buildHistoryDedupeDisplayItems(group.items).map(function(item) {
                  var detailText = item.actionType === 'duplicate'
                    ? ((item.duplicateOf ? ('与「' + item.duplicateOf + '」重复') : item.reason) + (item.duplicatePoint ? ('，重复点：' + item.duplicatePoint) : ''))
                    : (item.actionType === 'merge'
                      ? ('合并前：' + normalizeHistoryDedupeStringList(Array.isArray(item.mergedFrom) && item.mergedFrom.length ? item.mergedFrom : [item.title]).join('、') + '；合并后：' + (item.mergedInto || '未提供'))
                      : item.reason);
                  return '<div class="xmind-casegen-history-dedupe-row" role="row">'
                    + '<span class="xmind-casegen-history-dedupe-case" role="cell" title="' + escapeHtml(item.title || '未命名用例') + '">' + escapeHtml(item.title || '未命名用例') + '</span>'
                    + '<span class="xmind-casegen-history-dedupe-reason" role="cell" title="' + escapeHtml(detailText) + '">' + buildHistoryDedupeDetailHtml(item) + '</span>'
                  + '</div>';
                }).join('')
              + '</div>'
            + '</section>';
          }).join('')
        + '</div>'
      + '</div>';
    }

    function buildHistoryListHtml(history) {
      if (!Array.isArray(history) || !history.length) {
        return '<div class="xmind-casegen-history-empty">暂无生成记录</div>';
      }
      return '<div class="xmind-casegen-history-list">'
        + history.map(function(entry) {
          var details = Array.isArray(entry.details) ? entry.details : [];
          var diagnostics = normalizeHistoryDiagnostics(entry && entry.diagnostics);
          var dedupeRecords = normalizeHistoryDedupeRecords(entry && entry.dedupeRecords);
          var resultKind = entry && entry.resultKind ? String(entry.resultKind) : 'changed';
          var summaryText = entry && entry.summaryText ? String(entry.summaryText) : '';
          if (!summaryText) {
            summaryText = '生成模块 ' + String(Number(entry.moduleCount) || 0) + ' 个';
            if (resultKind === 'error') summaryText = '本次生成未成功';
            else if (resultKind === 'cancelled') summaryText = '本次生成已中断';
            else if (resultKind === 'no-change' && !details.length) summaryText = '本次没有新增结果';
          }
          var detailHtml = details.length
            ? '<div class="xmind-casegen-history-detail-list">'
                + details.map(function(detail) {
                  var durationText = formatHistoryDuration(detail && detail.durationMs);
                  return '<div class="xmind-casegen-history-detail">'
                    + '<strong class="xmind-casegen-history-detail-module">' + escapeHtml(detail.module || '未命名模块') + '</strong>'
                    + '<span class="xmind-casegen-history-detail-count">'
                      + String(Number(detail.caseCount) || 0) + ' 条用例'
                      + (durationText ? (' · 耗时 ' + escapeHtml(durationText)) : '')
                    + '</span>'
                    + '</div>';
                }).join('')
              + '</div>'
            : '<div class="xmind-casegen-history-empty-inline">本次未生成新的模块或用例</div>';
          var reasonHtml = entry && entry.reasonText
            ? '<div class="xmind-casegen-history-reason' + (resultKind === 'error' ? ' is-error' : (resultKind === 'cancelled' ? ' is-cancelled' : '')) + '">'
                + '<strong class="xmind-casegen-history-reason-label">' + (
                  resultKind === 'error' ? '失败原因：' : (resultKind === 'cancelled' ? '中断原因：' : '未新增原因：')
                ) + '</strong>'
                + '<span class="xmind-casegen-history-reason-text">' + escapeHtml(entry.reasonText) + '</span>'
              + '</div>'
            : '';
          var previewHtml = entry && entry.previewText
            ? '<div class="xmind-casegen-history-preview">'
                + '<strong class="xmind-casegen-history-preview-label">模型返回片段：</strong>'
                + '<span class="xmind-casegen-history-preview-text">' + escapeHtml(entry.previewText) + '</span>'
              + '</div>'
            : '';
          return '<article class="xmind-casegen-history-card">'
            + '<div class="xmind-casegen-history-head">'
            +   '<div class="xmind-casegen-history-copy">'
            +     '<strong class="xmind-casegen-history-location">' + escapeHtml(entry.locationLabel || '-') + '</strong>'
            +     '<span class="xmind-casegen-history-time">' + escapeHtml(formatHistoryTimestamp(entry.createdAt)) + '</span>'
            +   '</div>'
            +   '<span class="xmind-casegen-history-pill">' + escapeHtml(entry.actionLabel || '-') + '</span>'
            + '</div>'
            + '<div class="xmind-casegen-history-summary">' + escapeHtml(summaryText) + '</div>'
            + detailHtml
            + reasonHtml
            + previewHtml
            + buildHistoryDedupeRecordsHtml(dedupeRecords)
            + buildHistoryDiagnosticSectionsHtml(diagnostics)
            + '</article>';
        }).join('')
        + '</div>';
    }

    return {
      formatHistoryTimestamp: formatHistoryTimestamp,
      getRootHistoryActionLabel: getRootHistoryActionLabel,
      getModuleHistoryActionLabel: getModuleHistoryActionLabel,
      getGenerationFailureLabel: getGenerationFailureLabel,
      buildHistoryLocationLabel: buildHistoryLocationLabel,
      normalizeHistoryDurationMs: normalizeHistoryDurationMs,
      getTaskModelRequestDurationMs: getTaskModelRequestDurationMs,
      formatHistoryDuration: formatHistoryDuration,
      normalizeHistoryDetails: normalizeHistoryDetails,
      normalizeHistoryDiagnostics: normalizeHistoryDiagnostics,
      normalizeHistoryDedupeRecords: normalizeHistoryDedupeRecords,
      normalizeHistoryPreviewText: normalizeHistoryPreviewText,
      buildHistoryDiagnosticSectionsHtml: buildHistoryDiagnosticSectionsHtml,
      buildHistoryDedupeRecordsHtml: buildHistoryDedupeRecordsHtml,
      buildHistoryListHtml: buildHistoryListHtml,
    };
  }

  return { create: create };
});
