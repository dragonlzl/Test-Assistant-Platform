(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.tempExecMissingReminderViewOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var tempExecView = opts.tempExecView || null;
    var escapeHtml = typeof opts.escapeHtml === 'function'
      ? opts.escapeHtml
      : function(value) { return value === null || value === undefined ? '' : String(value); };
    var normalizeMissingReminderTypeIds = typeof opts.normalizeMissingReminderTypeIds === 'function'
      ? opts.normalizeMissingReminderTypeIds
      : function(values) { return Array.isArray(values) ? values : []; };
    var resolveScoreLevel = typeof opts.resolveScoreLevel === 'function'
      ? opts.resolveScoreLevel
      : function(score, fallback) { return fallback || String(score || 0); };
    var bindMissingReminderScrollHint = typeof opts.bindMissingReminderScrollHint === 'function'
      ? opts.bindMissingReminderScrollHint
      : noop;
    var renderFallback = typeof opts.renderFallback === 'function' ? opts.renderFallback : noop;

    function buildSummary(reminder) {
      var modules = reminder && Array.isArray(reminder.matchedModules) ? reminder.matchedModules : [];
      var types = reminder && Array.isArray(reminder.matchedTypes) ? reminder.matchedTypes : [];
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
      if (!isFinite(limit) || limit <= 0) return 10;
      return limit;
    }

    function formatTypeLabel(item) {
      if (!item || typeof item !== 'object') return '未分类';
      var typeIds = normalizeMissingReminderTypeIds(item.type_ids);
      if (!typeIds.length && item.type_id) {
        typeIds = normalizeMissingReminderTypeIds([item.type_id]);
      }
      if (!typeIds.length) return '未分类';
      var names = Array.isArray(item.type_names)
        ? item.type_names
        : (item.type_name ? [item.type_name] : []);
      var textList = [];
      for (var i = 0; i < typeIds.length; i += 1) {
        textList.push(names[i] || ('类型#' + typeIds[i]));
      }
      return textList.length ? textList.join('、') : '未分类';
    }

    function buildTable(reminder, renderOptions) {
      var viewOptions = renderOptions && typeof renderOptions === 'object' ? renderOptions : {};
      var aiEnabled = viewOptions.aiEnabled === true;
      var contextSignature = reminder && reminder.aiContextSignature ? String(reminder.aiContextSignature) : '';
      var aiSignature = reminder && reminder.aiSignature ? String(reminder.aiSignature) : '';
      var aiActive = aiEnabled && contextSignature && aiSignature === contextSignature;
      var aiLoading = aiEnabled && aiActive && reminder && reminder.aiLoading === true;
      var aiGenerated = aiEnabled && aiActive && reminder && reminder.aiGenerated === true;
      var list = aiEnabled
        ? (aiGenerated ? (reminder.aiItems || []) : [])
        : (reminder && Array.isArray(reminder.items) ? reminder.items : []);
      var display = list.slice(0, resolveLimit(reminder));
      var cols = 8;
      var rows = display.map(function(item) {
        var moduleName = item && item.module_name ? String(item.module_name) : '--';
        var typeName = formatTypeLabel(item);
        var title = item && item.title ? String(item.title) : '';
        var priority = item && item.priority ? String(item.priority) : '';
        var precondition = item && item.precondition ? String(item.precondition) : '';
        var steps = item && item.steps ? String(item.steps) : '';
        var expected = item && item.expected ? String(item.expected) : '';
        var score = item && item.match_score !== undefined ? Number(item.match_score) : 0;
        if (!isFinite(score) || score < 0) score = 0;
        var scoreText = aiEnabled
          ? resolveScoreLevel(score, item && item.match_level ? item.match_level : '')
          : String(score);
        return (
          '<tr>' +
            '<td class="score">' + escapeHtml(scoreText) + '</td>' +
            '<td class="type">' + escapeHtml(typeName) + '</td>' +
            '<td class="module">' + escapeHtml(moduleName) + '</td>' +
            '<td class="title">' + escapeHtml(title) + '</td>' +
            '<td class="priority">' + escapeHtml(priority) + '</td>' +
            '<td>' + escapeHtml(precondition).replace(/\\n/g, '<br>') + '</td>' +
            '<td>' + escapeHtml(steps).replace(/\\n/g, '<br>') + '</td>' +
            '<td>' + escapeHtml(expected).replace(/\\n/g, '<br>') + '</td>' +
          '</tr>'
        );
      }).join('');
      if (!rows) {
        var hint = '暂无匹配易漏用例';
        if (aiEnabled) {
          if (reminder && reminder.libraryEmpty === true) {
            hint = '易漏库没有任何用例，请点击上方“跳转到易漏用例库”进行添加。';
          } else if (aiLoading) {
            hint = '正在生成 AI 推荐';
          } else if (reminder && reminder.aiError) {
            hint = reminder.aiError;
          } else if (!aiGenerated) {
            hint = '点击 AI 推荐生成易漏用例建议';
          }
        } else if (reminder && reminder.loading) {
          hint = '正在加载易漏用例...';
        } else if (reminder && reminder.pending) {
          hint = '滑动到此处加载易漏用例';
        }
        var hintClass = aiLoading ? 'hint missing-reminder-ai-loading' : 'hint';
        rows = '<tr><td colspan="' + cols + '"><p class="' + hintClass + '">' + escapeHtml(hint)
          + (aiLoading ? '<span class="missing-reminder-loading-dots"></span>' : '')
          + '</p></td></tr>';
      }
      var colGroup =
        '<colgroup>' +
          '<col class="col-score">' +
          '<col class="col-type">' +
          '<col class="col-module">' +
          '<col class="col-title">' +
          '<col class="col-priority">' +
          '<col class="col-precondition">' +
          '<col class="col-steps">' +
          '<col class="col-expected">' +
        '</colgroup>';
      var aiButtonDisabled = aiEnabled && (!reminder || reminder.aiContextReady !== true || reminder.aiLoading === true)
        ? ' disabled'
        : '';
      var aiButtonHtml = aiEnabled
        ? '<button type="button" class="missing-reminder-ai-btn" data-missing-reminder-ai="1"' + aiButtonDisabled + '>AI推荐</button>'
        : '';
      return (
        '<div class="missing-reminder-card">' +
          '<div class="missing-reminder-header">' +
            '<div class="missing-reminder-title-group">' +
              '<span class="missing-reminder-title">易漏用例参考</span>' +
              aiButtonHtml +
              '<button type="button" class="missing-reminder-link" data-missing-reminder-link="missing-library">跳转到易漏用例库</button>' +
            '</div>' +
            '<span class="missing-reminder-meta">' + escapeHtml(buildSummary(reminder)) + '</span>' +
          '</div>' +
          '<div class="missing-reminder-table-head">' +
            '<div class="temp-case-view">' +
              '<table class="missing-reminder-table">' +
                colGroup +
                '<thead><tr>' +
                  '<th class="score">匹配得分</th>' +
                  '<th class="type">类型</th>' +
                  '<th class="module">模块</th>' +
                  '<th class="title">用例标题</th>' +
                  '<th class="priority">优先级</th>' +
                  '<th>前提条件</th>' +
                  '<th>操作步骤</th>' +
                  '<th>预期结果</th>' +
                '</tr></thead>' +
              '</table>' +
            '</div>' +
          '</div>' +
          '<div class="missing-reminder-scroll">' +
            '<div class="temp-case-view">' +
              '<table class="missing-reminder-table">' + colGroup + '<tbody>' + rows + '</tbody></table>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }

    function renderBlock(reminder, renderOptions) {
      var viewOptions = renderOptions && typeof renderOptions === 'object' ? renderOptions : {};
      if (viewOptions.aiEnabled === true) {
        var showAi = reminder && (
          reminder.aiContextReady === true
          || (reminder.aiLoading === true && reminder.aiSignature)
          || (reminder.aiGenerated === true && reminder.aiSignature)
        );
        if (!showAi) return '';
      } else if (!reminder || (!reminder.hasMatch && !reminder.loading && !reminder.pending)) {
        return '';
      }
      return buildTable(reminder, viewOptions);
    }

    function renderRegion(reminder, renderOptions) {
      var slot = tempExecView && typeof tempExecView.querySelector === 'function'
        ? tempExecView.querySelector('[data-temp-missing-reminder-slot]')
        : null;
      if (!slot) {
        renderFallback();
        return false;
      }
      slot.innerHTML = renderBlock(reminder, renderOptions);
      bindMissingReminderScrollHint(slot);
      return true;
    }

    return {
      buildSummary: buildSummary,
      resolveLimit: resolveLimit,
      formatTypeLabel: formatTypeLabel,
      buildTable: buildTable,
      renderBlock: renderBlock,
      renderRegion: renderRegion,
    };
  }

  return { create: create };
});
