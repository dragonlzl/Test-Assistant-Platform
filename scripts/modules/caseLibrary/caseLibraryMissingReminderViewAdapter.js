(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.missingReminderViewAdapter = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var top = opts.top || null;
    var bottom = opts.bottom || null;
    var escapeHtml = typeof opts.escapeHtml === 'function'
      ? opts.escapeHtml
      : function(value) { return value === null || value === undefined ? '' : String(value); };
    var formatTypeLabel = typeof opts.formatTypeLabel === 'function'
      ? opts.formatTypeLabel
      : function() { return '未分类'; };
    var buildSummary = typeof opts.buildSummary === 'function' ? opts.buildSummary : function() { return ''; };
    var resolveLimit = typeof opts.resolveLimit === 'function' ? opts.resolveLimit : function() { return 10; };
    var resolveScoreLevel = typeof opts.resolveScoreLevel === 'function'
      ? opts.resolveScoreLevel
      : function(score) { return String(score || 0); };
    var bindScrollHint = typeof opts.bindScrollHint === 'function' ? opts.bindScrollHint : function() {};

    function resolveTarget(placement) {
      return placement === 'bottom' ? bottom : top;
    }

    function isInView(target) {
      if (!target || target.classList.contains('hidden')) return false;
      if (!target.getBoundingClientRect) return false;
      var rect = target.getBoundingClientRect();
      var height = window.innerHeight || document.documentElement.clientHeight || 0;
      if (!height) return false;
      return rect.bottom > 0 && rect.top < height;
    }

    function buildTable(reminder, aiEnabled) {
      var contextSignature = reminder && reminder.aiContextSignature ? String(reminder.aiContextSignature) : '';
      var aiSignature = reminder && reminder.aiSignature ? String(reminder.aiSignature) : '';
      var aiActive = aiEnabled && contextSignature && aiSignature === contextSignature;
      var aiLoading = aiEnabled && aiActive && reminder && reminder.aiLoading === true;
      var aiGenerated = aiEnabled && aiActive && reminder && reminder.aiGenerated === true;
      var list = aiEnabled
        ? (aiGenerated ? (reminder.aiItems || []) : [])
        : (reminder && Array.isArray(reminder.items) ? reminder.items : []);
      var display = list.slice(0, resolveLimit(reminder));
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
        rows = '<tr><td colspan="8"><p class="' + hintClass + '">' + escapeHtml(hint)
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
      var aiButtonDisabled = aiEnabled
        && (!reminder || reminder.aiContextReady !== true || reminder.aiLoading === true)
        ? ' disabled'
        : '';
      var aiButtonHtml = aiEnabled
        ? '<button type="button" class="missing-reminder-ai-btn" data-missing-reminder-ai="1"'
          + aiButtonDisabled + '>AI推荐</button>'
        : '';
      var headerHtml =
        '<div class="missing-reminder-header">' +
          '<div class="missing-reminder-title-group">' +
            '<span class="missing-reminder-title">易漏用例参考</span>' +
            aiButtonHtml +
            '<button type="button" class="missing-reminder-link" data-missing-reminder-link="missing-library">跳转到易漏用例库</button>' +
          '</div>' +
          '<span class="missing-reminder-meta">' + escapeHtml(buildSummary(reminder || {})) + '</span>' +
        '</div>';
      return (
        headerHtml +
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
            '<table class="missing-reminder-table">' +
              colGroup +
              '<tbody>' + rows + '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>'
      );
    }

    function hide(target) {
      if (!target) return;
      target.innerHTML = '';
      target.classList.add('hidden');
    }

    function render(reminder, options) {
      var viewOptions = options && typeof options === 'object' ? options : {};
      var aiEnabled = viewOptions.aiEnabled === true;
      var target = resolveTarget(viewOptions.placement);
      var other = target === top ? bottom : top;
      hide(other);
      if (!target) return { target: null, visible: false };
      var showAi = reminder && (
        reminder.aiContextReady === true
        || (reminder.aiLoading === true && reminder.aiSignature)
        || (reminder.aiGenerated === true && reminder.aiSignature)
      );
      var visible = aiEnabled
        ? Boolean(showAi)
        : Boolean(reminder && (reminder.hasMatch || reminder.loading || reminder.pending));
      if (!visible) {
        hide(target);
        return { target: target, visible: false };
      }
      target.innerHTML = buildTable(reminder, aiEnabled);
      target.classList.remove('hidden');
      bindScrollHint(target);
      return { target: target, visible: true };
    }

    return {
      buildTable: buildTable,
      render: render,
      resolveTarget: resolveTarget,
      isInView: isInView,
    };
  }

  return { create: create };
});
