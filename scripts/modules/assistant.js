(function() {
  window.app = window.app || {};

  var launcher = null;
  var launcherBtn = null;
  var lockDot = null;
  var panel = null;
  var closeBtn = null;
  var clearBtn = null;
  var modelPicker = null;
  var statusEl = null;
  var messagesEl = null;
  var inputEl = null;
  var sendBtn = null;
  var casePreview = null;
  var casePreviewCloseBtn = null;
  var casePreviewBody = null;

  var historyLimit = 80;
  var conversationHistoryLimit = 12;
  var failureHistoryLimit = 10;
  var actionHandlers = {};
  var approvalCounter = 0;
  var chatHistory = [];
  var failureHistory = [];
  var replyPending = false;
  var initialized = false;
  var assistantCaseTablePreviewLimit = 10;

  function byId(id) {
    return document.getElementById(id);
  }

  function ensureAssistantMount() {
    if (byId('assistantLauncher') && byId('assistantPanel')) return;
    if (typeof document === 'undefined' || !document.body) return;
    var mount = document.createElement('div');
    mount.id = 'assistantFloatingMount';
    mount.innerHTML = [
      '<div class="assistant-launcher" id="assistantLauncher" title="AI 助手">',
      '  <button class="assistant-launcher-btn" id="assistantLauncherBtn" type="button">AI 助手</button>',
      '  <span class="assistant-lock-dot hidden" id="assistantLockDot">未开启</span>',
      '</div>',
      '<section class="assistant-panel hidden" id="assistantPanel" aria-label="AI助手">',
      '  <header class="assistant-head">',
      '    <strong>AI助手</strong>',
      '    <div class="assistant-head-actions">',
      '      <select id="assistantModelPicker"></select>',
      '      <button class="link-toggle" id="assistantClearBtn" type="button">清空</button>',
      '      <button class="link-toggle" id="assistantCloseBtn" type="button">收起</button>',
      '    </div>',
      '  </header>',
      '  <div class="assistant-status" id="assistantStatus"></div>',
      '  <div class="assistant-messages" id="assistantMessages"></div>',
      '  <div class="assistant-input-row">',
      '    <textarea id="assistantInput" placeholder="输入你的问题或操作指令"></textarea>',
      '    <button id="assistantSendBtn" type="button">发送</button>',
      '  </div>',
      '</section>',
      '<section class="assistant-case-preview hidden" id="assistantCasePreview" aria-label="助手用例完整视图" aria-hidden="true">',
      '  <div class="assistant-case-preview-dialog">',
      '    <header class="assistant-case-preview-head">',
      '      <button class="assistant-case-preview-close" id="assistantCasePreviewClose" type="button" aria-label="关闭完整视图">×</button>',
      '    </header>',
      '    <div class="assistant-case-preview-body" id="assistantCasePreviewBody"></div>',
      '  </div>',
      '</section>',
    ].join('\n');
    document.body.appendChild(mount);
  }

  function dispatchAppEvent(name, detail) {
    if (!name) return;
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    try {
      if (typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
      } else if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
        var evt = document.createEvent('CustomEvent');
        evt.initCustomEvent(name, false, false, detail || {});
        window.dispatchEvent(evt);
      }
    } catch (err) {
      // ignore
    }
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderPlainMessageHtml(text) {
    return escapeHtml(text || '').replace(/\n/g, '<br/>');
  }

  function fallbackCopyText(text) {
    var value = String(text || '');
    if (!value) return false;
    if (typeof document === 'undefined' || !document.body) return false;
    var textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    var ok = false;
    try {
      textarea.focus();
      textarea.select();
      if (typeof textarea.setSelectionRange === 'function') {
        textarea.setSelectionRange(0, textarea.value.length);
      }
      if (typeof document.execCommand === 'function') {
        ok = document.execCommand('copy') === true;
      }
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(textarea);
    return ok;
  }

  async function copyTextToClipboard(text) {
    var value = String(text || '');
    if (!value) return false;
    try {
      if (typeof navigator !== 'undefined'
        && navigator.clipboard
        && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (err) {
      // fallback below
    }
    return fallbackCopyText(value);
  }

  function parseMarkdownCodeSegments(text) {
    var lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    var segments = [];
    var textBuffer = [];
    var codeBuffer = [];
    var inCode = false;
    var codeLang = '';

    function pushTextBuffer() {
      if (!textBuffer.length) return;
      segments.push({ type: 'text', content: textBuffer.join('\n') });
      textBuffer = [];
    }

    function pushCodeBuffer() {
      segments.push({ type: 'code', lang: codeLang, content: codeBuffer.join('\n') });
      codeBuffer = [];
      codeLang = '';
    }

    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i];
      var trimmed = String(line || '').trim();
      if (trimmed.indexOf('```') === 0) {
        if (inCode) {
          pushCodeBuffer();
          inCode = false;
        } else {
          pushTextBuffer();
          inCode = true;
          codeLang = trimmed.slice(3).trim();
        }
        continue;
      }
      if (inCode) {
        codeBuffer.push(line);
      } else {
        textBuffer.push(line);
      }
    }

    if (inCode) {
      pushCodeBuffer();
    } else {
      pushTextBuffer();
    }
    return segments;
  }

  function isMarkdownTableRow(line) {
    var text = String(line || '').trim();
    if (!text) return false;
    return text.indexOf('|') !== -1;
  }

  function isMarkdownTableSeparator(line) {
    var text = String(line || '').trim();
    if (!text) return false;
    if (text.charAt(0) === '|') text = text.slice(1);
    if (text.charAt(text.length - 1) === '|') text = text.slice(0, -1);
    var cells = text.split('|');
    if (cells.length < 2) return false;
    for (var i = 0; i < cells.length; i += 1) {
      var cell = String(cells[i] || '').trim();
      if (!/^:?-{3,}:?$/.test(cell)) return false;
    }
    return true;
  }

  function parseMarkdownTableRow(line) {
    var text = String(line || '').trim();
    if (text.charAt(0) === '|') text = text.slice(1);
    if (text.charAt(text.length - 1) === '|') text = text.slice(0, -1);
    return text.split('|').map(function(cell) {
      return String(cell || '').trim();
    });
  }

  function extractFirstAssistantMarkdownTable(text) {
    var lines = String(text || '').split('\n');
    var i = 0;
    for (i = 0; i + 1 < lines.length; i += 1) {
      if (!isMarkdownTableRow(lines[i]) || !isMarkdownTableSeparator(lines[i + 1])) continue;
      var headers = parseMarkdownTableRow(lines[i]);
      var rows = [];
      i += 2;
      while (i < lines.length) {
        var rowLine = lines[i];
        if (!String(rowLine || '').trim()) break;
        if (!isMarkdownTableRow(rowLine)) break;
        rows.push(parseMarkdownTableRow(rowLine));
        i += 1;
      }
      return {
        headers: headers,
        rows: rows,
      };
    }
    return null;
  }

  function isAssistantKeyValueMarkdownTable(text) {
    var meta = extractFirstAssistantMarkdownTable(text);
    var headers = null;
    var left = '';
    var right = '';
    if (!meta || !Array.isArray(meta.headers) || meta.headers.length !== 2) return false;
    headers = meta.headers.map(normalizeAssistantHeaderText);
    left = headers[0] || '';
    right = headers[1] || '';
    if (meta.rows.length < 3) return false;
    if (left !== '字段' && left !== '字段名' && left !== '项目' && left !== '属性') return false;
    if (right !== '内容' && right !== '值' && right !== '说明') return false;
    return true;
  }

  function normalizeSingleCaseDetailSummaryLayout(tool, args, data, text, fallbackText) {
    var toolName = normalizeMcpToolName(tool);
    var payloadArgs = args && typeof args === 'object' ? args : {};
    var sourceData = data && typeof data === 'object' ? data : {};
    var items = Array.isArray(sourceData.items) ? sourceData.items : [];
    var detailLevel = payloadArgs.detailLevel === undefined || payloadArgs.detailLevel === null
      ? ''
      : String(payloadArgs.detailLevel).trim().toLowerCase();
    if (toolName !== 'cases.list_current') return text;
    if (detailLevel !== 'full') return text;
    if (items.length !== 1) return text;
    if (!fallbackText) return text;
    if (!isAssistantKeyValueMarkdownTable(text)) return text;
    return String(fallbackText).trim() || text;
  }

  function normalizeExplicitAllCaseListSummaryLayout(userText, tool, args, data, text, fallbackText) {
    var toolName = normalizeMcpToolName(tool);
    var payloadArgs = args && typeof args === 'object' ? args : {};
    var sourceData = data && typeof data === 'object' ? data : {};
    var items = Array.isArray(sourceData.items) ? sourceData.items : [];
    var detailLevel = payloadArgs.detailLevel === undefined || payloadArgs.detailLevel === null
      ? ''
      : String(payloadArgs.detailLevel).trim().toLowerCase();
    var caseTable = null;
    if (toolName !== 'cases.list_current') return text;
    if (detailLevel !== 'full') return text;
    if (!isExplicitAllCaseDisplayIntent(userText)) return text;
    if (items.length <= 1) return text;
    if (!fallbackText) return text;
    if (sourceData.truncated === true) return String(fallbackText).trim() || text;
    caseTable = extractAssistantCaseTableInfo(text);
    if (!caseTable) return String(fallbackText).trim() || text;
    if (caseTable.rows.length !== items.length) return String(fallbackText).trim() || text;
    return text;
  }

  async function tryExecuteSummaryScaffoldReply(userText, text, tool, args, data, fallbackText) {
    var parsed = parseJsonObjectFromText(text);
    var calls = extractModelMcpCallList(parsed);
    var firstCall = null;
    var toolName = '';
    var callArgs = null;
    var callResult = null;
    if (!calls.length) return '';
    firstCall = calls[0];
    toolName = normalizeMcpToolName(firstCall.tool || firstCall.name || '');
    if (toolName !== 'assistant.render_scaffold' && toolName !== 'assistant.list_scaffolds') return '';
    callArgs = firstCall.args && typeof firstCall.args === 'object' ? Object.assign({}, firstCall.args) : {};
    if (toolName === 'assistant.render_scaffold') {
      if ((!callArgs.data || typeof callArgs.data !== 'object') && data && typeof data === 'object') {
        callArgs.data = Object.assign({}, data);
      }
      if (!callArgs.sourceTool) callArgs.sourceTool = normalizeMcpToolName(tool);
      if (!callArgs.userQuestion) callArgs.userQuestion = String(userText || '');
      if (!callArgs.fallbackText && fallbackText) callArgs.fallbackText = String(fallbackText);
    }
    callResult = await executeModelMcpToolCall({
      tool: toolName,
      args: callArgs,
      response: firstCall.response || '',
    }, userText, fallbackText || '');
    if (!callResult || callResult.handled !== true || !callResult.text) return '';
    return String(callResult.text || '').trim();
  }

  function normalizeMarkdownTableRow(cells, size) {
    var list = Array.isArray(cells) ? cells.slice() : [];
    var colSize = Number(size);
    if (!Number.isFinite(colSize) || colSize <= 0) colSize = 1;
    if (list.length > colSize) {
      var overflow = list.slice(colSize - 1).join(' | ');
      list = list.slice(0, colSize - 1);
      list.push(overflow);
    }
    while (list.length < colSize) list.push('');
    return list;
  }

  function renderInlineMarkdown(text) {
    var safe = escapeHtml(text || '');
    return safe.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  }

  function normalizeAssistantHeaderText(cell) {
    return String(cell || '').replace(/\s+/g, '');
  }

  function normalizeAssistantHeaderKey(cell) {
    return normalizeAssistantHeaderText(cell).toLowerCase();
  }

  function canonicalizeAssistantCaseHeader(cell) {
    var key = normalizeAssistantHeaderKey(cell);
    if (!key) return '';
    if (key === '序号' || key === '编号' || key === '条号' || key === '条目编号' || key === '条目序号' || key === '序') return '序号';
    if (key === 'id' || key === '用例id' || key === 'caseid' || key === 'case编号' || key === '用例编号') return 'ID';
    if (key === '模块' || key === '功能模块') return '模块';
    if (key === '标题' || key === '用例标题' || key === '名称' || key === '用例名称') return '标题';
    if (key === '优先级' || key === '级别') return '优先级';
    if (key === '前置条件' || key === '前置' || key === '前提条件') return '前置条件';
    if (key === '步骤' || key === '操作步骤' || key === '执行步骤') return '步骤';
    if (key === '预期结果' || key === '预期' || key === '期望结果') return '预期结果';
    if (key === '备注' || key === '说明' || key === '补充说明' || key === '备注说明') return '备注';
    if (key === '执行结果' || key === '结果' || key === '状态' || key === '实际结果' || key === '执行状态') return '执行结果';
    return '';
  }

  function buildAssistantCaseHeaderRenderList(headerCells) {
    var headers = Array.isArray(headerCells) ? headerCells : [];
    return headers.map(function(cell) {
      var canonical = canonicalizeAssistantCaseHeader(cell);
      return canonical || String(cell || '').trim();
    });
  }

  function resolveAssistantCaseTableMeta(headerCells) {
    var headers = Array.isArray(headerCells) ? headerCells : [];
    var renderHeaders = buildAssistantCaseHeaderRenderList(headers);
    var normalized = renderHeaders.map(normalizeAssistantHeaderText);
    var required = ['序号', 'ID', '模块', '标题', '优先级', '前置条件', '步骤', '预期结果', '备注'];
    var i = 0;
    for (i = 0; i < required.length; i += 1) {
      if (normalized.indexOf(required[i]) === -1) {
        return { isCaseTable: false, hasExecutionResult: false, headersForRender: renderHeaders };
      }
    }
    var hasExecutionResult = normalized.indexOf('执行结果') !== -1;
    return { isCaseTable: true, hasExecutionResult: hasExecutionResult, headersForRender: renderHeaders };
  }

  function extractAssistantCaseTableInfo(text) {
    var meta = extractFirstAssistantMarkdownTable(text);
    var tableMeta = null;
    if (!meta || !Array.isArray(meta.headers) || !meta.headers.length) return null;
    tableMeta = resolveAssistantCaseTableMeta(meta.headers);
    if (!tableMeta.isCaseTable) return null;
    return {
      headers: meta.headers.slice(),
      headersForRender: Array.isArray(tableMeta.headersForRender) ? tableMeta.headersForRender.slice() : buildAssistantCaseHeaderRenderList(meta.headers),
      rows: Array.isArray(meta.rows) ? meta.rows.slice() : [],
      hasExecutionResult: tableMeta.hasExecutionResult === true,
    };
  }

  function renderAssistantTableHeadHtml(renderHeaders) {
    var cells = Array.isArray(renderHeaders) ? renderHeaders : [];
    if (!cells.length) return '';
    return '<thead><tr>' + cells.map(function(cell) {
      return '<th>' + renderInlineMarkdown(cell) + '</th>';
    }).join('') + '</tr></thead>';
  }

  function renderAssistantTableBodyHtml(rowCells, columnCount) {
    var rows = Array.isArray(rowCells) ? rowCells : [];
    var totalColumns = Number(columnCount) || 0;
    if (!rows.length || totalColumns <= 0) return '';
    return '<tbody>' + rows.map(function(row) {
      var cells = normalizeMarkdownTableRow(row, totalColumns);
      return '<tr>' + cells.map(function(cell) {
        return '<td>' + renderInlineMarkdown(cell) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';
  }

  function buildAssistantTableHtml(tableClass, headHtml, bodyHtml) {
    return '<table class="' + tableClass + '">' + String(headHtml || '') + String(bodyHtml || '') + '</table>';
  }

  function buildAssistantCaseTablePreviewSummaryText(previewCount, totalCount, omittedCount) {
    var preview = Number(previewCount) || 0;
    var total = Number(totalCount) || 0;
    var omitted = Number(omittedCount) || 0;
    if (!preview || !omitted) return '';
    return '当前回复未完整展开：仅展示前 ' + preview + ' 条，共 ' + total + ' 条；其余 ' + omitted + ' 条已折叠，点击“展开查看”查看完整列表。';
  }

  function renderAssistantCaseTableOmittedRowHtml(columnCount, omittedCount, totalCount) {
    var columns = Number(columnCount) || 0;
    var omitted = Number(omittedCount) || 0;
    var total = Number(totalCount) || 0;
    var text = '';
    if (columns <= 0 || omitted <= 0) return '';
    text = '... 其余 ' + omitted + ' 条已折叠';
    if (total > 0) text += '（共 ' + total + ' 条）';
    text += '，点击“展开查看”查看完整列表。';
    return '<tbody class="assistant-case-table-ellipsis-body"><tr class="assistant-case-table-ellipsis-row"><td colspan="' + columns + '">' + escapeHtml(text) + '</td></tr></tbody>';
  }

  function renderMarkdownTableHtml(headerCells, rowCells) {
    var headers = Array.isArray(headerCells) ? headerCells : [];
    var rows = Array.isArray(rowCells) ? rowCells : [];
    if (!headers.length) return '';
    var tableMeta = resolveAssistantCaseTableMeta(headers);
    var isCaseTable = tableMeta.isCaseTable === true;
    var renderHeaders = isCaseTable && Array.isArray(tableMeta.headersForRender) && tableMeta.headersForRender.length
      ? tableMeta.headersForRender.slice()
      : headers.slice();
    var caseTypeClass = tableMeta.hasExecutionResult ? 'assistant-case-table-exec' : 'assistant-case-table-no-exec';
    var tableClass = isCaseTable
      ? ('assistant-msg-table assistant-case-table ' + caseTypeClass)
      : 'assistant-msg-table';
    var wrapperClass = isCaseTable
      ? 'assistant-table-scroll assistant-case-table-scroll'
      : 'assistant-table-scroll';
    var head = renderAssistantTableHeadHtml(renderHeaders);
    var body = renderAssistantTableBodyHtml(rows, renderHeaders.length);
    if (!isCaseTable) {
      return '<div class="' + wrapperClass + '">' + buildAssistantTableHtml(tableClass, head, body) + '</div>';
    }
    var previewRows = rows;
    var previewSummary = '';
    var previewBody = body;
    var fullTemplate = '';
    var omittedCount = 0;
    if (rows.length > assistantCaseTablePreviewLimit) {
      previewRows = rows.slice(0, assistantCaseTablePreviewLimit);
      omittedCount = rows.length - previewRows.length;
      previewSummary = '<span class="assistant-case-table-summary">' + escapeHtml(buildAssistantCaseTablePreviewSummaryText(previewRows.length, rows.length, omittedCount)) + '</span>';
      previewBody = renderAssistantTableBodyHtml(previewRows, renderHeaders.length) + renderAssistantCaseTableOmittedRowHtml(renderHeaders.length, omittedCount, rows.length);
      fullTemplate = '<template class="assistant-case-table-full-template">' + buildAssistantTableHtml(tableClass, head, body) + '</template>';
    }
    return (
      '<div class="assistant-case-table-wrap">' +
        '<div class="assistant-case-table-actions">' +
          '<button type="button" class="assistant-case-table-expand-btn">展开查看</button>' +
          previewSummary +
        '</div>' +
        '<div class="' + wrapperClass + '">' +
          buildAssistantTableHtml(tableClass, head, previewBody) +
        '</div>' +
        '<div class="assistant-table-scrollbar assistant-case-table-scrollbar">' +
          '<div class="assistant-table-scrollbar-track">' +
            '<div class="assistant-table-scrollbar-thumb"></div>' +
          '</div>' +
        '</div>' +
        fullTemplate +
      '</div>'
    );
  }

  function renderMarkdownTextSegmentHtml(text) {
    var lines = String(text || '').split('\n');
    var parts = [];
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (!String(line || '').trim()) {
        i += 1;
        continue;
      }
      if (i + 1 < lines.length && isMarkdownTableRow(lines[i]) && isMarkdownTableSeparator(lines[i + 1])) {
        var headerCells = parseMarkdownTableRow(lines[i]);
        i += 2;
        var tableRows = [];
        while (i < lines.length) {
          var rowLine = lines[i];
          if (!String(rowLine || '').trim()) break;
          if (!isMarkdownTableRow(rowLine)) break;
          tableRows.push(parseMarkdownTableRow(rowLine));
          i += 1;
        }
        parts.push(renderMarkdownTableHtml(headerCells, tableRows));
        continue;
      }
      var paragraph = [];
      while (i < lines.length) {
        var paraLine = lines[i];
        if (!String(paraLine || '').trim()) break;
        if (i + 1 < lines.length && isMarkdownTableRow(lines[i]) && isMarkdownTableSeparator(lines[i + 1])) break;
        paragraph.push(paraLine);
        i += 1;
      }
      if (paragraph.length) {
        parts.push('<p>' + renderInlineMarkdown(paragraph.join('\n')).replace(/\n/g, '<br/>') + '</p>');
      }
    }
    return parts.join('');
  }

  function renderMarkdownMessageHtml(text) {
    var segments = parseMarkdownCodeSegments(text || '');
    var html = [];
    for (var i = 0; i < segments.length; i += 1) {
      var segment = segments[i];
      if (!segment) continue;
      if (segment.type === 'code') {
        var langAttr = segment.lang ? (' data-lang="' + escapeHtml(segment.lang) + '"') : '';
        html.push(
          '<div class="assistant-code-block">'
          + '<button class="assistant-code-copy-btn" type="button">复制</button>'
          + '<pre><code' + langAttr + '>' + escapeHtml(segment.content || '') + '</code></pre>'
          + '</div>'
        );
      } else {
        html.push(renderMarkdownTextSegmentHtml(segment.content || ''));
      }
    }
    return html.join('');
  }

  function refreshAssistantCaseTableScrollWidth(wrap) {
    if (!wrap || !wrap.querySelector) return;
    var mainScroll = wrap.querySelector('.assistant-case-table-scroll');
    var proxyScroll = wrap.querySelector('.assistant-case-table-scrollbar');
    var proxyTrack = proxyScroll && proxyScroll.querySelector ? proxyScroll.querySelector('.assistant-table-scrollbar-track') : null;
    var proxyThumb = proxyScroll && proxyScroll.querySelector ? proxyScroll.querySelector('.assistant-table-scrollbar-thumb') : null;
    var table = mainScroll && mainScroll.querySelector ? mainScroll.querySelector('table.assistant-case-table') : null;
    if (!mainScroll || !proxyScroll || !proxyTrack || !proxyThumb || !table) return;
    var totalWidth = Math.max(Number(table.scrollWidth) || 0, Number(mainScroll.scrollWidth) || 0);
    var viewportWidth = Number(mainScroll.clientWidth) || 0;
    var scrollableWidth = totalWidth - viewportWidth;
    var trackWidth = Number(proxyTrack.clientWidth) || 0;
    if (trackWidth <= 0) trackWidth = Number(proxyScroll.clientWidth) || 0;
    var scrollable = scrollableWidth > 1 && trackWidth > 0;
    proxyScroll.classList.toggle('is-scrollable', scrollable);
    if (!scrollable) {
      proxyThumb.style.width = Math.max(trackWidth - 2, 0) + 'px';
      proxyThumb.style.transform = 'translateX(0px)';
      return;
    }
    var ratio = viewportWidth / totalWidth;
    var thumbWidth = Math.round(trackWidth * ratio);
    if (thumbWidth < 36) thumbWidth = 36;
    if (thumbWidth > trackWidth) thumbWidth = trackWidth;
    var thumbMax = trackWidth - thumbWidth;
    var scrollLeft = Number(mainScroll.scrollLeft) || 0;
    var thumbLeft = thumbMax > 0 ? Math.round((scrollLeft / scrollableWidth) * thumbMax) : 0;
    if (!Number.isFinite(thumbLeft) || thumbLeft < 0) thumbLeft = 0;
    if (thumbLeft > thumbMax) thumbLeft = thumbMax;
    proxyThumb.style.width = thumbWidth + 'px';
    proxyThumb.style.transform = 'translateX(' + thumbLeft + 'px)';
  }

  function setupAssistantCaseTableBehaviors(root) {
    var scope = root && root.querySelectorAll ? root : null;
    if (!scope) return;
    var wraps = scope.querySelectorAll('.assistant-case-table-wrap');
    for (var i = 0; i < wraps.length; i += 1) {
      var wrap = wraps[i];
      if (!wrap) continue;
      var mainScroll = wrap.querySelector('.assistant-case-table-scroll');
      var proxyScroll = wrap.querySelector('.assistant-case-table-scrollbar');
      var proxyTrack = proxyScroll && proxyScroll.querySelector ? proxyScroll.querySelector('.assistant-table-scrollbar-track') : null;
      var proxyThumb = proxyScroll && proxyScroll.querySelector ? proxyScroll.querySelector('.assistant-table-scrollbar-thumb') : null;
      if (!mainScroll || !proxyScroll || !proxyTrack || !proxyThumb) continue;
      if (wrap._assistantScrollSyncBound !== true) {
        (function(mainEl, proxyEl, trackEl, thumbEl, wrapEl) {
          var dragging = false;
          var startClientX = 0;
          var startScrollLeft = 0;

          function resolveMetrics() {
            var totalWidth = Number(mainEl.scrollWidth) || 0;
            var viewportWidth = Number(mainEl.clientWidth) || 0;
            var scrollableWidth = totalWidth - viewportWidth;
            var trackWidth = Number(trackEl.clientWidth) || 0;
            var thumbWidth = Number(thumbEl.offsetWidth) || 0;
            var thumbMax = trackWidth - thumbWidth;
            return {
              scrollableWidth: scrollableWidth > 0 ? scrollableWidth : 0,
              thumbMax: thumbMax > 0 ? thumbMax : 0,
            };
          }

          function handleDragMove(ev) {
            if (!dragging) return;
            var metrics = resolveMetrics();
            if (!metrics.scrollableWidth || !metrics.thumbMax) return;
            var deltaX = (Number(ev.clientX) || 0) - startClientX;
            var ratio = deltaX / metrics.thumbMax;
            var next = startScrollLeft + ratio * metrics.scrollableWidth;
            if (!Number.isFinite(next) || next < 0) next = 0;
            if (next > metrics.scrollableWidth) next = metrics.scrollableWidth;
            mainEl.scrollLeft = next;
            refreshAssistantCaseTableScrollWidth(wrapEl);
          }

          function handleDragEnd() {
            if (!dragging) return;
            dragging = false;
            if (typeof document !== 'undefined' && document.body && document.body.classList) {
              document.body.classList.remove('assistant-scrollbar-dragging');
            }
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
          }

          mainEl.addEventListener('scroll', function() {
            if (dragging) return;
            refreshAssistantCaseTableScrollWidth(wrapEl);
          });

          trackEl.addEventListener('click', function(ev) {
            if (ev.target === thumbEl) return;
            var rect = trackEl.getBoundingClientRect ? trackEl.getBoundingClientRect() : null;
            if (!rect || rect.width <= 0) return;
            var metrics = resolveMetrics();
            if (!metrics.scrollableWidth) return;
            var clickX = (Number(ev.clientX) || 0) - rect.left;
            if (clickX < 0) clickX = 0;
            if (clickX > rect.width) clickX = rect.width;
            var ratio = clickX / rect.width;
            mainEl.scrollLeft = ratio * metrics.scrollableWidth;
            refreshAssistantCaseTableScrollWidth(wrapEl);
          });

          thumbEl.addEventListener('mousedown', function(ev) {
            if (ev.button !== 0) return;
            var metrics = resolveMetrics();
            if (!metrics.scrollableWidth || !metrics.thumbMax) return;
            dragging = true;
            startClientX = Number(ev.clientX) || 0;
            startScrollLeft = Number(mainEl.scrollLeft) || 0;
            if (typeof document !== 'undefined' && document.body && document.body.classList) {
              document.body.classList.add('assistant-scrollbar-dragging');
            }
            window.addEventListener('mousemove', handleDragMove);
            window.addEventListener('mouseup', handleDragEnd);
            ev.preventDefault();
          });
        })(mainScroll, proxyScroll, proxyTrack, proxyThumb, wrap);
        wrap._assistantScrollSyncBound = true;
      }
      refreshAssistantCaseTableScrollWidth(wrap);
    }
  }

  function setAssistantCasePreviewVisible(visible) {
    if (!casePreview) return;
    var show = visible === true;
    casePreview.classList.toggle('hidden', !show);
    casePreview.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      document.body.classList.toggle('assistant-case-preview-open', show);
    }
    if (!show && casePreviewBody) {
      casePreviewBody.innerHTML = '';
    }
  }

  function closeAssistantCasePreview() {
    setAssistantCasePreviewVisible(false);
  }

  function openAssistantCasePreviewFromButton(button) {
    if (!button || !button.closest || !casePreviewBody) return;
    var wrap = button.closest('.assistant-case-table-wrap');
    if (!wrap || !wrap.querySelector) return;
    var sourceTable = null;
    var fullTemplate = wrap.querySelector('template.assistant-case-table-full-template');
    if (fullTemplate && fullTemplate.content && fullTemplate.content.querySelector) {
      sourceTable = fullTemplate.content.querySelector('table.assistant-case-table');
    }
    if (!sourceTable) {
      sourceTable = wrap.querySelector('table.assistant-case-table');
    }
    if (!sourceTable) return;

    casePreviewBody.innerHTML = '';

    var previewWrap = document.createElement('div');
    previewWrap.className = 'assistant-case-table-wrap assistant-case-table-wrap-preview';

    var mainScroll = document.createElement('div');
    mainScroll.className = 'assistant-table-scroll assistant-case-table-scroll temp-case-view assistant-case-preview-table-view';
    mainScroll.appendChild(sourceTable.cloneNode(true));
    previewWrap.appendChild(mainScroll);

    var proxyScroll = document.createElement('div');
    proxyScroll.className = 'assistant-table-scrollbar assistant-case-table-scrollbar';
    var proxyTrack = document.createElement('div');
    proxyTrack.className = 'assistant-table-scrollbar-track';
    var proxyThumb = document.createElement('div');
    proxyThumb.className = 'assistant-table-scrollbar-thumb';
    proxyTrack.appendChild(proxyThumb);
    proxyScroll.appendChild(proxyTrack);
    previewWrap.appendChild(proxyScroll);

    casePreviewBody.appendChild(previewWrap);
    setAssistantCasePreviewVisible(true);
    setupAssistantCaseTableBehaviors(casePreviewBody);
  }

  function handleAssistantWindowResize() {
    setupAssistantCaseTableBehaviors(messagesEl);
    setupAssistantCaseTableBehaviors(casePreviewBody);
  }

  function getApis() {
    return {
      assistantApi: window.app && window.app.assistantApi ? window.app.assistantApi : null,
      assistantMcpApi: window.app && window.app.assistantMcpApi ? window.app.assistantMcpApi : null,
      assistantSettingsApi: window.app && window.app.assistantSettingsApi ? window.app.assistantSettingsApi : null,
      assistantModelDiagApi: window.app && window.app.assistantModelDiagApi ? window.app.assistantModelDiagApi : null,
    };
  }

  function getUserKey() {
    var userId = '';
    if (window.app && window.app.state && window.app.state.currentUser && window.app.state.currentUser.id !== undefined && window.app.state.currentUser.id !== null) {
      userId = String(window.app.state.currentUser.id);
    }
    return userId ? ('uid-' + userId) : 'guest';
  }

  function getHistoryStorageKey() {
    return 'tap-assistant-history:' + getUserKey();
  }

  function loadHistory() {
    var key = getHistoryStorageKey();
    var list = [];
    try {
      var raw = localStorage.getItem(key) || '[]';
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed.filter(function(item) {
          return item && typeof item === 'object' && item.role && item.text !== undefined;
        }).map(function(item) {
          return {
            id: item.id || ('msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)),
            role: String(item.role || 'ai'),
            title: item.title ? String(item.title) : '',
            text: String(item.text || ''),
            createdAt: Number(item.createdAt) || Date.now(),
            actions: [],
          };
        });
      }
    } catch (err) {
      list = [];
    }
    chatHistory = list.slice(-historyLimit);
    renderMessages();
  }

  function saveHistory() {
    var key = getHistoryStorageKey();
    var data = chatHistory.slice(-historyLimit).filter(function(item) {
      if (!item || typeof item !== 'object') return false;
      if (item.transient === true) return false;
      if (item.thinking === true) return false;
      return true;
    }).map(function(item) {
      return {
        id: item.id,
        role: item.role,
        title: item.title,
        text: item.text,
        createdAt: item.createdAt,
      };
    });
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      // ignore
    }
  }

  function formatMessageTime(value) {
    var ts = Number(value);
    if (!Number.isFinite(ts) || ts <= 0) ts = Date.now();
    var date = new Date(ts);
    if (isNaN(date.getTime())) date = new Date();
    var two = function(num) {
      var n = Number(num);
      if (!Number.isFinite(n) || n < 0) n = 0;
      return n < 10 ? ('0' + n) : String(n);
    };
    return date.getFullYear()
      + '-' + two(date.getMonth() + 1)
      + '-' + two(date.getDate())
      + ' ' + two(date.getHours())
      + ':' + two(date.getMinutes())
      + ':' + two(date.getSeconds());
  }

  function scrollMessagesToBottom() {
    if (!messagesEl) return;
    try {
      messagesEl.scrollTop = messagesEl.scrollHeight;
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function() {
          if (!messagesEl) return;
          messagesEl.scrollTop = messagesEl.scrollHeight;
        });
      }
    } catch (err) {
      // ignore
    }
  }

  function setStatus(text) {
    if (!statusEl) return;
    statusEl.textContent = text ? String(text) : '';
  }

  function refreshSendState() {
    if (sendBtn) {
      sendBtn.disabled = replyPending === true;
      sendBtn.setAttribute('aria-disabled', replyPending === true ? 'true' : 'false');
    }
    if (inputEl) {
      inputEl.setAttribute('aria-busy', replyPending === true ? 'true' : 'false');
    }
  }

  function setReplyPending(value) {
    replyPending = value === true;
    refreshSendState();
  }

  function getRoleTitle(role, customTitle) {
    if (customTitle) return customTitle;
    if (role === 'user') return '你';
    if (role === 'sys') return '系统';
    return '助手';
  }

  function registerActionHandler(handler) {
    if (typeof handler !== 'function') return '';
    var id = 'act-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    actionHandlers[id] = handler;
    return id;
  }

  function normalizeAssistantActionVariant(value) {
    var raw = value === undefined || value === null ? '' : String(value).trim().toLowerCase();
    if (!raw) return '';
    if (raw === 'allow' || raw === 'approve' || raw === 'primary' || raw === 'confirm') return 'allow';
    if (raw === 'deny' || raw === 'reject' || raw === 'danger' || raw === 'cancel') return 'deny';
    return '';
  }

  function buildAssistantMessageActions(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var actions = [];
    if (!Array.isArray(opts.actions)) return actions;
    actions = opts.actions.map(function(action) {
      var item = action && typeof action === 'object' ? action : {};
      var handlerId = registerActionHandler(item.onClick);
      return {
        id: handlerId,
        label: item.label ? String(item.label) : '执行',
        variant: normalizeAssistantActionVariant(item.variant || item.type || item.style),
        title: item.title ? String(item.title) : '',
        className: item.className ? String(item.className) : '',
      };
    }).filter(function(item) { return item.id; });
    return actions;
  }

  function addMessage(role, text, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var actions = buildAssistantMessageActions(opts);
    var msg = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      role: role || 'ai',
      title: getRoleTitle(role, opts.title),
      text: text === undefined || text === null ? '' : String(text),
      createdAt: Date.now(),
      actions: actions,
      thinking: opts.thinking === true,
      transient: opts.transient === true,
    };
    chatHistory.push(msg);
    if (chatHistory.length > historyLimit) {
      chatHistory = chatHistory.slice(-historyLimit);
    }
    renderMessages();
    saveHistory();
    return msg;
  }

  function replaceMessage(messageId, text, options) {
    var id = messageId === undefined || messageId === null ? '' : String(messageId).trim();
    if (!id) return null;
    var opts = options && typeof options === 'object' ? options : {};
    for (var i = 0; i < chatHistory.length; i += 1) {
      var msg = chatHistory[i];
      if (!msg || String(msg.id || '') !== id) continue;
      if (opts.role) msg.role = String(opts.role);
      if (opts.title !== undefined) msg.title = String(opts.title || '');
      if (text !== undefined) msg.text = text === null ? '' : String(text);
      msg.createdAt = Date.now();
      msg.actions = buildAssistantMessageActions(opts);
      msg.thinking = opts.thinking === true;
      msg.transient = opts.transient === true;
      renderMessages();
      saveHistory();
      return msg;
    }
    return null;
  }

  function removeMessageById(messageId) {
    var id = messageId === undefined || messageId === null ? '' : String(messageId).trim();
    if (!id) return false;
    for (var i = 0; i < chatHistory.length; i += 1) {
      var msg = chatHistory[i];
      if (!msg || String(msg.id || '') !== id) continue;
      chatHistory.splice(i, 1);
      renderMessages();
      saveHistory();
      return true;
    }
    return false;
  }

  function renderMessages() {
    if (!messagesEl) return;
    messagesEl.innerHTML = '';
    chatHistory.forEach(function(msg) {
      var card = document.createElement('div');
      card.className = 'assistant-msg ' + (msg.role === 'user' ? 'user' : 'ai');

      var meta = document.createElement('div');
      meta.className = 'assistant-msg-meta';

      var title = document.createElement('div');
      title.className = 'assistant-msg-title';
      title.textContent = msg.title || getRoleTitle(msg.role);
      meta.appendChild(title);

      var timeEl = document.createElement('div');
      timeEl.className = 'assistant-msg-time';
      timeEl.textContent = formatMessageTime(msg.createdAt);
      meta.appendChild(timeEl);
      card.appendChild(meta);

      var body = document.createElement('div');
      body.className = 'assistant-msg-body';
      var bodyText = msg.text === undefined || msg.text === null ? '' : String(msg.text);
      if (msg.role === 'user') {
        body.innerHTML = renderPlainMessageHtml(bodyText);
      } else {
        if (msg.thinking === true) {
          card.classList.add('assistant-msg-thinking');
          body.innerHTML = (
            '<div class="assistant-thinking" aria-live="polite">'
            + '<span class="assistant-thinking-label">助手正在思考中</span>'
            + '<span class="assistant-thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span>'
            + '</div>'
          );
        } else {
          body.innerHTML = renderMarkdownMessageHtml(bodyText);
          if (body.querySelector && body.querySelector('.assistant-case-table-wrap')) {
            card.classList.add('assistant-msg-has-case-table');
          }
        }
      }
      card.appendChild(body);

      if (msg.thinking !== true && Array.isArray(msg.actions) && msg.actions.length) {
        var actionsWrap = document.createElement('div');
        actionsWrap.className = 'assistant-actions';
        msg.actions.forEach(function(action) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'assistant-action-btn';
          if (action.variant) {
            btn.classList.add('assistant-action-btn-' + action.variant);
          }
          if (action.className) {
            String(action.className).split(/\s+/).forEach(function(cls) {
              var name = String(cls || '').trim();
              if (!name) return;
              btn.classList.add(name);
            });
          }
          btn.textContent = action.label || '执行';
          if (action.title) btn.title = action.title;
          btn.dataset.actionId = action.id || '';
          btn.addEventListener('click', function() {
            if (btn.disabled) return;
            if (btn.classList.contains('assistant-approval-btn')) {
              var approvalBtns = actionsWrap.querySelectorAll('button.assistant-approval-btn');
              for (var ab = 0; ab < approvalBtns.length; ab += 1) {
                approvalBtns[ab].disabled = true;
              }
              if (btn.classList.contains('assistant-action-btn-allow')) {
                btn.textContent = '执行中...';
              } else if (btn.classList.contains('assistant-action-btn-deny')) {
                btn.textContent = '处理中...';
              }
            }
            var fn = actionHandlers[action.id || ''];
            if (typeof fn === 'function') {
              try {
                var res = fn();
                if (res && typeof res.then === 'function') {
                  res.catch(function(err) {
                    addMessage('sys', '操作执行失败：' + (err && err.message ? String(err.message) : '未知错误'), { title: '系统' });
                  });
                }
              } catch (err) {
                addMessage('sys', '操作执行失败：' + (err && err.message ? String(err.message) : '未知错误'), { title: '系统' });
              }
              return;
            }
            addMessage('sys', '该操作已失效，请重新发起。', { title: '系统' });
          });
          actionsWrap.appendChild(btn);
        });
        card.appendChild(actionsWrap);
      }

      messagesEl.appendChild(card);
    });
    setupAssistantCaseTableBehaviors(messagesEl);
    scrollMessagesToBottom();
  }

  function getSettingsSnapshot() {
    var apis = getApis();
    if (apis.assistantSettingsApi && typeof apis.assistantSettingsApi.getSettings === 'function') {
      return apis.assistantSettingsApi.getSettings();
    }
    return { assistantEnabled: false, assistantModelId: '', assistantModelName: '' };
  }

  function isAssistantEnabled() {
    var snap = getSettingsSnapshot();
    return snap && snap.assistantEnabled === true;
  }

  function setPanelVisible(visible) {
    if (!panel) return;
    panel.classList.toggle('hidden', !visible);
    if (visible) {
      scrollMessagesToBottom();
      setupAssistantCaseTableBehaviors(messagesEl);
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function() {
          setupAssistantCaseTableBehaviors(messagesEl);
        });
      }
    }
  }

  function refreshLockState() {
    var enabled = isAssistantEnabled();
    if (lockDot) lockDot.classList.toggle('hidden', enabled);
    if (launcherBtn) {
      launcherBtn.textContent = enabled ? 'AI 助手' : 'AI 助手(锁定)';
      launcherBtn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    }
    if (!enabled) {
      setPanelVisible(false);
    }
  }

  function refreshModelPicker() {
    if (!modelPicker) return;
    var apis = getApis();
    var settingsSnap = getSettingsSnapshot();
    var selectedId = settingsSnap && settingsSnap.assistantModelId ? String(settingsSnap.assistantModelId) : '';
    var models = [];
    if (apis.assistantSettingsApi && typeof apis.assistantSettingsApi.listModels === 'function') {
      models = apis.assistantSettingsApi.listModels() || [];
    }
    if (!Array.isArray(models) || !models.length) {
      modelPicker.innerHTML = '<option value="">暂无模型</option>';
      modelPicker.value = '';
      return;
    }
    modelPicker.innerHTML = models.map(function(model) {
      var id = model && model.id ? String(model.id) : '';
      if (!id) return '';
      var label = (model.name || '未命名模型') + ' (' + (model.provider || 'custom') + ')';
      var disabled = model.usable === false ? ' disabled' : '';
      return '<option value="' + escapeHtml(id) + '"' + disabled + '>' + escapeHtml(label) + '</option>';
    }).join('');
    if (selectedId) modelPicker.value = selectedId;
  }

  function refreshState() {
    refreshLockState();
    refreshModelPicker();
    refreshSendState();
  }

  function openSettingsForAssistant() {
    var apis = getApis();
    if (apis.assistantApi && typeof apis.assistantApi.switchTab === 'function') {
      apis.assistantApi.switchTab('settings');
    } else if (window.app && typeof window.app.switchTab === 'function') {
      window.app.switchTab('settings');
    }
  }

  function showLauncherClick() {
    if (!isAssistantEnabled()) {
      setStatus('助手未开启，已为你跳转到设置页。');
      addMessage('sys', '助手当前处于关闭状态。请在设置页开启后使用。');
      openSettingsForAssistant();
      return;
    }
    var hidden = panel && panel.classList.contains('hidden');
    setPanelVisible(hidden);
    if (hidden) {
      setStatus('助手已就绪');
      scrollMessagesToBottom();
    }
  }

  function clearChatHistory() {
    chatHistory = [];
    actionHandlers = {};
    saveHistory();
    renderMessages();
  }

  function handleClearChat() {
    if (!window.confirm('确认清空当前聊天记录吗？')) return;
    clearChatHistory();
    setStatus('聊天记录已清空');
  }

  function parseTabFromText(text) {
    var raw = String(text || '');
    var map = [
      { tab: 'settings', keys: ['设置', '配置'] },
      { tab: 'assign', keys: ['功能指派', '指派'] },
      { tab: 'models', keys: ['模型管理', '模型页'] },
      { tab: 'casesgen', keys: ['用例生成', '生成页'] },
      { tab: 'tempexec', keys: ['用例执行', '执行页', '执行中心'] },
      { tab: 'case-library', keys: ['用例库', '库页面'] },
      { tab: 'case-archive', keys: ['归档'] },
      { tab: 'exec-overview', keys: ['执行总览', '总览'] },
      { tab: 'auto', keys: ['一键执行', '功能流程', '自动流程', '评审', '清洗', '拆分'] },
    ];
    for (var i = 0; i < map.length; i += 1) {
      var item = map[i];
      for (var j = 0; j < item.keys.length; j += 1) {
        if (raw.indexOf(item.keys[j]) !== -1) return item.tab;
      }
    }
    return '';
  }

  function containsAny(text, keywords) {
    var source = String(text || '');
    if (!Array.isArray(keywords) || !keywords.length) return false;
    for (var i = 0; i < keywords.length; i += 1) {
      if (source.indexOf(keywords[i]) !== -1) return true;
    }
    return false;
  }

  function normalizeConversationRole(role) {
    var raw = String(role || '').toLowerCase();
    if (raw === 'user') return 'user';
    if (raw === 'ai' || raw === 'assistant') return 'assistant';
    return '';
  }

  function buildConversationHistory(limit, latestUserText) {
    var max = Number(limit);
    if (!Number.isFinite(max) || max <= 0) max = conversationHistoryLimit;
    var list = [];
    var skipUserText = latestUserText === undefined || latestUserText === null
      ? ''
      : String(latestUserText).trim();
    for (var i = chatHistory.length - 1; i >= 0; i -= 1) {
      var msg = chatHistory[i];
      if (!msg || typeof msg !== 'object') continue;
      var role = normalizeConversationRole(msg.role);
      if (!role) continue;
      var content = msg.text === undefined || msg.text === null ? '' : String(msg.text).trim();
      if (!content) continue;
      if (skipUserText && role === 'user' && content === skipUserText) {
        skipUserText = '';
        continue;
      }
      list.unshift({ role: role, content: content });
      if (list.length >= max) break;
    }
    return list;
  }

  function formatJsonCompact(data) {
    try {
      return JSON.stringify(data, null, 2);
    } catch (err) {
      return String(data || '');
    }
  }

  function formatWebSearchResponse(res, responseHint) {
    var result = res && typeof res === 'object' ? res : {};
    var query = result.query ? String(result.query) : '';
    var items = Array.isArray(result.items) ? result.items : [];
    var hint = responseHint === undefined || responseHint === null ? '' : String(responseHint).trim();
    if (!items.length) {
      if (hint) {
        return hint + '\n（联网搜索未找到可用结果，建议换关键词再试）';
      }
      return '已联网搜索“' + query + '”，但暂未找到可用结果。你可以换一个更具体的关键词。';
    }
    var lines = [];
    if (hint) {
      lines.push(hint);
    } else if (query) {
      lines.push('已联网搜索“' + query + '”，结果如下：');
    } else {
      lines.push('已完成联网搜索，结果如下：');
    }
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i] && typeof items[i] === 'object' ? items[i] : {};
      var title = item.title ? String(item.title) : ('结果' + (i + 1));
      var snippet = item.snippet ? String(item.snippet) : '';
      var url = item.url ? String(item.url) : '';
      lines.push((i + 1) + '. ' + title);
      if (snippet) lines.push('   ' + snippet);
      if (url) lines.push('   链接：' + url);
    }
    if (result.provider) {
      lines.push('搜索源：' + String(result.provider));
    }
    return lines.join('\n');
  }

  function requestAssistantOperationApproval(actionName, meta) {
    var label = actionName ? String(actionName).trim() : '';
    if (!label) label = '写操作';
    var payload = meta && typeof meta === 'object' ? meta : {};
    var detail = payload.detail === undefined || payload.detail === null ? '' : String(payload.detail).trim();
    var reason = payload.reason === undefined || payload.reason === null ? '' : String(payload.reason).trim();
    approvalCounter += 1;
    return new Promise(function(resolve) {
      var settled = false;
      var approvalMsg = null;
      var lines = [
        '准备执行：' + label,
        '该操作可能写入或修改数据，请确认是否允许。',
      ];
      if (detail) lines.push('说明：' + detail);
      if (reason) lines.push('原因：' + reason);
      function settleText(allowed) {
        return allowed === true ? '已允许，正在执行...' : '已拒绝，本次操作已取消。';
      }
      function updateApprovalCard(allowed) {
        if (!approvalMsg || !approvalMsg.id) return;
        replaceMessage(approvalMsg.id, lines.join('\n') + '\n' + settleText(allowed), {
          title: '系统',
        });
      }
      function finish(allowed) {
        if (settled) return;
        settled = true;
        var approved = allowed === true;
        updateApprovalCard(approved);
        setStatus('');
        resolve(approved);
      }
      approvalMsg = addMessage('sys', lines.join('\n'), {
        title: '系统',
        actions: [
          {
            label: '允许操作',
            variant: 'allow',
            className: 'assistant-approval-btn',
            title: '继续执行本次操作',
            onClick: function() { finish(true); },
          },
          {
            label: '不允许',
            variant: 'deny',
            className: 'assistant-approval-btn',
            title: '取消本次操作',
            onClick: function() { finish(false); },
          },
        ],
      });
    });
  }

  function looksLikeWeatherText(text) {
    var raw = String(text || '').toLowerCase();
    if (!raw) return false;
    return containsAny(raw, ['天气', 'weather', 'forecast', '气温', '温度', '降雨', '下雨']);
  }

  function extractWeatherCityFromText(text) {
    var raw = String(text || '').trim();
    if (!raw) return '';
    var cleaned = raw.replace(/[，,。！？!?;；:：/\\]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    var match = cleaned.match(/([A-Za-z\u4e00-\u9fff]{2,24})\s*(?:今天天气|今日天气|天气|weather|forecast)/i);
    var candidate = match && match[1] ? String(match[1]).trim() : '';
    if (!candidate) {
      var tokens = cleaned.split(' ').filter(function(item) { return !!item; });
      if (tokens.length) candidate = String(tokens[0]).trim();
    }
    var prefixes = ['帮我', '请帮我', '请问', '查询', '查下', '查一下', '看下', '看看', '现在', '当前', '今天', '今日'];
    for (var i = 0; i < prefixes.length; i += 1) {
      var prefix = prefixes[i];
      if (candidate.indexOf(prefix) === 0) {
        candidate = candidate.slice(prefix.length).trim();
      }
    }
    var suffixes = ['怎么样', '如何', '天气', 'weather', 'forecast', '今天', '今日', '的'];
    for (var j = 0; j < suffixes.length; j += 1) {
      var suffix = suffixes[j];
      if (candidate.length > suffix.length && candidate.slice(candidate.length - suffix.length) === suffix) {
        candidate = candidate.slice(0, candidate.length - suffix.length).trim();
      }
    }
    if (!candidate) return '';
    if (containsAny(candidate.toLowerCase(), ['今天', '今日', '现在', '当前', '天气', 'weather', 'forecast'])) {
      return '';
    }
    return candidate;
  }

  function normalizeWeatherSearchQuery(query, userText) {
    var queryText = String(query || '').trim();
    var userQuery = String(userText || '').trim();
    var weatherLikely = looksLikeWeatherText(queryText) || looksLikeWeatherText(userQuery);
    if (!weatherLikely) return queryText;
    var city = extractWeatherCityFromText(queryText) || extractWeatherCityFromText(userQuery);
    if (!city) return '';
    return city + ' 今日天气';
  }

  function trimSearchSnippet(text, maxLen) {
    var raw = String(text || '').trim();
    if (!raw) return '';
    var limit = Number(maxLen);
    if (!Number.isFinite(limit) || limit <= 0) limit = 140;
    if (raw.length <= limit) return raw;
    return raw.slice(0, limit) + '...';
  }

  function normalizeSearchItemsForSummary(items, limit) {
    var list = Array.isArray(items) ? items : [];
    var max = Number(limit);
    if (!Number.isFinite(max) || max <= 0) max = 5;
    var output = [];
    for (var i = 0; i < list.length; i += 1) {
      if (output.length >= max) break;
      var item = list[i] && typeof list[i] === 'object' ? list[i] : {};
      var title = item.title ? String(item.title).trim() : '';
      var snippet = item.snippet ? String(item.snippet).trim() : '';
      var url = item.url ? String(item.url).trim() : '';
      if (!title && !snippet && !url) continue;
      output.push({
        title: title || ('结果' + (output.length + 1)),
        snippet: trimSearchSnippet(snippet, 160),
        url: url,
      });
    }
    return output;
  }

  function buildCompactWebSearchFallback(res, responseHint) {
    var result = res && typeof res === 'object' ? res : {};
    var query = result.query ? String(result.query) : '';
    var items = normalizeSearchItemsForSummary(result.items, 5);
    var hint = responseHint === undefined || responseHint === null ? '' : String(responseHint).trim();
    if (!items.length) {
      if (hint) {
        return hint + '\n（联网搜索未找到可用结果，建议换关键词或补充城市/时间）';
      }
      return '已联网搜索“' + query + '”，但暂未找到可靠结果。建议补充更具体关键词后重试。';
    }
    var lines = [];
    if (hint) lines.push(hint);
    lines.push('我已根据联网结果整理为简版：');
    var first = items[0] || {};
    if (first.snippet) {
      lines.push('结论：' + trimSearchSnippet(first.snippet, 120));
    } else if (first.title) {
      lines.push('结论：' + first.title);
    }
    lines.push('补充要点：');
    for (var i = 0; i < items.length && i < 3; i += 1) {
      var item = items[i];
      var text = item.snippet || item.title || ('结果' + (i + 1));
      lines.push((i + 1) + '. ' + trimSearchSnippet(text, 90));
    }
    lines.push('参考来源：');
    for (var j = 0; j < items.length && j < 3; j += 1) {
      var src = items[j];
      var title = src.title || ('来源' + (j + 1));
      if (src.url) {
        lines.push((j + 1) + '. ' + title + ' - ' + src.url);
      } else {
        lines.push((j + 1) + '. ' + title);
      }
    }
    if (result.provider) lines.push('搜索源：' + String(result.provider));
    return lines.join('\n');
  }

  async function summarizeWebSearchByModel(userText, query, searchRes, responseHint) {
    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.callModel !== 'function') return '';
    var result = searchRes && typeof searchRes === 'object' ? searchRes : {};
    var items = normalizeSearchItemsForSummary(result.items, 5);
    if (!items.length) return '';
    var payload = {
      userQuestion: String(userText || ''),
      searchQuery: String(query || ''),
      provider: result.provider ? String(result.provider) : '',
      items: items,
    };
    var prompt = [
      '你是“联网结果整理助手”。',
      '基于搜索结果给出最终答复，必须简洁、可执行、避免堆砌原文。',
      '输出结构：',
      '1) 直接结论（1-2句）',
      '2) 关键要点（2-4条）',
      '3) 参考来源（最多3条，保留链接）',
      '要求：',
      '- 不要逐条复读全部搜索结果。',
      '- 不确定时要明确说明不确定点。',
      '- 对天气类问题，优先给出“今天”可用信息；缺城市时提示补充城市。',
      '- 输出中文纯文本，不要 JSON。',
    ].join('\n');
    var history = buildConversationHistory(8, userText);
    var res = null;
    try {
      res = await apis.assistantApi.callModel(JSON.stringify(payload, null, 2), {
        prompt: prompt,
        temperature: 0.1,
        history: history,
      });
    } catch (err) {
      res = { ok: false, reason: err && err.message ? String(err.message) : '整理异常' };
    }
    if (!res || res.ok !== true || !res.content) return '';
    var text = String(res.content || '').trim();
    if (!text) return '';
    var maybeJson = parseJsonObjectFromText(text);
    if (maybeJson && maybeJson.action) return '';
    if (responseHint) {
      var hint = String(responseHint).trim();
      if (hint) return hint + '\n' + text;
    }
    return text;
  }

  function isProjectScopedText(text) {
    var raw = String(text || '');
    if (!raw) return false;
    if (parseTabFromText(raw)) return true;
    return containsAny(raw, [
      '页面', '页签', 'tab',
      '项目', '需求',
      '用例', '漏测', '备忘',
      '历史', '变更', '改动', '差异',
      '模型', '连通性', '诊断',
      '设置', '功能指派', '执行',
      '助手',
    ]);
  }

  function parseJsonObjectFromText(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    function tryParseObjectCandidate(candidate) {
      if (!candidate) return null;
      try {
        var parsed = JSON.parse(candidate);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (err) {
        return null;
      }
    }
    var direct = tryParseObjectCandidate(raw);
    if (direct) return direct;

    var start = -1;
    var depth = 0;
    var inString = false;
    var escaping = false;
    for (var i = 0; i < raw.length; i += 1) {
      var ch = raw.charAt(i);
      if (start < 0) {
        if (ch === '{') {
          start = i;
          depth = 1;
          inString = false;
          escaping = false;
        }
        continue;
      }
      if (inString) {
        if (escaping) {
          escaping = false;
        } else if (ch === '\\') {
          escaping = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') {
        depth += 1;
        continue;
      }
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          var candidate = raw.slice(start, i + 1);
          var parsedCandidate = tryParseObjectCandidate(candidate);
          if (parsedCandidate) return parsedCandidate;
          start = -1;
          depth = 0;
        }
      }
    }
    return null;
  }

  function isKnownTabId(tabId) {
    var target = tabId === undefined || tabId === null ? '' : String(tabId).trim();
    if (!target) return false;
    var apis = getApis();
    if (apis.assistantApi && typeof apis.assistantApi.listTabs === 'function') {
      var tabs = apis.assistantApi.listTabs() || [];
      if (Array.isArray(tabs)) {
        for (var i = 0; i < tabs.length; i += 1) {
          var item = tabs[i] || {};
          var tab = item.tab === undefined || item.tab === null ? '' : String(item.tab).trim();
          if (tab && tab === target) return true;
        }
      }
    }
    return containsAny(target, [
      'settings',
      'assign',
      'models',
      'casesgen',
      'tempexec',
      'case-library',
      'case-archive',
      'exec-overview',
      'auto',
    ]);
  }

  function shouldRunIntentClassifier(text) {
    var raw = String(text || '');
    if (!raw) return false;
    var hasNavVerb = containsAny(raw, ['跳转', '打开', '进入', '前往', '去']);
    var hasQueryVerb = containsAny(raw, ['查看', '查询', '获取', '读取']);
    var hasQueryTarget = containsAny(raw, ['数据', '状态', '信息', '统计']);
    if (isCaseListIntent(raw) && isProjectScopedText(raw)) return true;
    if (hasNavVerb && isProjectScopedText(raw)) return true;
    if (hasQueryVerb && hasQueryTarget && isProjectScopedText(raw)) return true;
    return false;
  }

  function getTabLabelById(tabId) {
    var target = tabId === undefined || tabId === null ? '' : String(tabId);
    if (!target) return '';
    var apis = getApis();
    if (apis.assistantApi && typeof apis.assistantApi.listTabs === 'function') {
      var tabs = apis.assistantApi.listTabs() || [];
      if (Array.isArray(tabs)) {
        for (var i = 0; i < tabs.length; i += 1) {
          var item = tabs[i] || {};
          var tab = item.tab === undefined || item.tab === null ? '' : String(item.tab);
          if (!tab || tab !== target) continue;
          if (item.label !== undefined && item.label !== null && String(item.label).trim()) {
            return String(item.label).trim();
          }
          break;
        }
      }
    }
    var fallbackMap = {
      settings: '设置',
      assign: '功能指派',
      models: '模型管理',
      casesgen: '用例生成',
      tempexec: '用例执行',
      'case-library': '用例库',
      'case-archive': '用例归档',
      'exec-overview': '执行总览',
      auto: '一键执行',
    };
    return fallbackMap[target] || '';
  }

  function getTabOperationHints(tabId) {
    var map = {
      settings: [
        '查看和调整全局设置（主题、超时、助手开关等）',
        '切换助手默认模型并保存',
        '查看设置项效果说明',
      ],
      assign: [
        '给功能指派模型并测试连通性',
        '查看模型测试失败后的诊断建议',
        '应用建议配置后重测',
      ],
      models: [
        '新增/编辑/删除模型配置',
        '测试模型连通性',
        '查看模型配置完整性状态',
      ],
      casesgen: [
        '触发用例生成并查看进度',
        '查看各模块生成结果',
        '导出生成结果',
      ],
      tempexec: [
        '查看和更新执行结果',
        '按文件管理执行集',
        '导出执行数据',
      ],
      'case-library': [
        '查看&编辑用例内容',
        '导入/导出用例文件',
        '删除用例（会确认操作，且支持8秒撤回）',
      ],
      'case-archive': [
        '查看归档用例',
        '恢复归档到可编辑状态',
        '删除归档记录',
      ],
      'exec-overview': [
        '查看执行总览统计',
        '按条件筛选执行数据',
        '定位并跳转相关执行记录',
      ],
      auto: [
        '执行需求评审/清洗/拆分流程',
        '运行漏测推荐',
        '确认后生成补全内容',
      ],
    };
    var key = tabId === undefined || tabId === null ? '' : String(tabId).trim();
    var list = map[key];
    if (Array.isArray(list) && list.length) return list;
    return [
      '页面跳转',
      '页面数据查询',
      '根据当前页面执行可用操作',
    ];
  }

  function getPageFileName() {
    try {
      var path = window && window.location && window.location.pathname ? String(window.location.pathname) : '';
      if (!path) return '';
      var normalized = path.split('?')[0].split('#')[0];
      if (!normalized) return '';
      var parts = normalized.split('/');
      var name = parts.length ? parts[parts.length - 1] : '';
      return name || 'index.html';
    } catch (err) {
      return '';
    }
  }

  function isCaseListIntent(text) {
    var raw = String(text || '').trim();
    var filterInfo = null;
    var hasFlexibleFilter = false;
    if (!raw) return false;
    if (!containsAny(raw, ['用例', 'case'])) return false;
    if (containsAny(raw, ['用例生成', '生成用例', '删除用例', '修改用例', '编辑用例'])) return false;
    if (containsAny(raw, ['用例改动历史', '用例变更', '改动历史', '变更历史', '历史详情', '变更内容', '变更记录', '用例差异', '差异'])) return false;
    filterInfo = extractCaseListFilterInfo(raw);
    hasFlexibleFilter = filterInfo && filterInfo.hasFilter === true;
    if (containsAny(raw, [
      '当前有哪些用例',
      '有哪些用例',
      '当前页面都有哪些用例',
      '当前页面有哪些用例',
      '当前页面用例列表',
      '获取当前页面用例列表',
      '获取用例列表',
      '列出用例',
      '用例列表',
      '用例清单',
      '当前页面都有什么用例',
      '当前页面有什么用例',
      '当前页都有哪些用例',
      '当前页有哪些用例',
      '当前页都有什么用例',
      '当前页有什么用例',
      '本页都有哪些用例',
      '本页有哪些用例',
      '本页都有什么用例',
      '本页有什么用例',
      '现在的页面有什么用例',
      '现在页面有什么用例',
      '现在页面有哪些用例',
      '当前页面有多少条用例',
      '当前页面有几条用例',
      '当前页面用例有多少条',
      '当前页有多少条用例',
      '当前页有几条用例',
      '当前页用例有多少条',
      '本页有多少条用例',
      '本页有几条用例',
      '本页用例有多少条',
      '当前页面用例数量',
      '当前页面用例条数',
      '有啥用例',
      '什么用例',
    ])) return true;
    if (containsAny(raw, ['当前页面', '当前页', '本页', '这个页面', '该页面'])
      && containsAny(raw, ['有什么', '有啥', '哪些', '有哪些', '都有什么', '多少', '条数', '数量', '总数'])) {
      return true;
    }
    if (hasFlexibleFilter
      && containsAny(raw, ['查看', '查询', '获取', '读取', '列出', '列一下', '展示', '显示', '搜索', '查找', '筛选', '过滤', '搜', '找出', '筛出', '挑出', '哪些', '有哪些', '清单', '有什么', '有啥', '多少', '条数', '数量', '总数', '给我看', '看下', '看一下', '看看', '相关', '有关'])) {
      return true;
    }
    return containsAny(raw, ['查看', '查询', '获取', '读取', '列出', '列一下', '展示', '显示', '搜索', '查找', '筛选', '过滤', '搜', '找出', '筛出', '挑出', '哪些', '有哪些', '清单', '有什么', '有啥', '多少', '条数', '数量', '总数', '给我看', '看下', '看一下', '看看']);
  }

  function isCaseCountIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (!containsAny(raw, ['用例', 'case'])) return false;
    if (containsAny(raw, ['用例改动历史', '用例变更', '改动历史', '变更历史', '历史详情', '变更内容', '变更记录', '用例差异', '差异'])) return false;
    if (containsAny(raw, ['多少条', '几条', '条数', '数量', '总数', '多少个'])) return true;
    if (containsAny(raw, ['多少']) && containsAny(raw, ['当前页面', '当前页', '本页', '页面', '页'])) return true;
    return false;
  }

  function isCurrentCaseFullDetailIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (!containsAny(raw, ['用例', 'case'])) return false;
    if (containsAny(raw, ['用例改动历史', '用例变更', '改动历史', '变更历史', '历史详情', '变更内容', '变更记录', '用例差异', '差异'])) return false;
    if (containsAny(raw, ['当前项目', '项目里', '项目中', '项目下', '全项目', '所有项目'])) return false;
    var hasDetailWord = containsAny(raw, [
      '完整展示',
      '完整列出',
      '完整展开',
      '完整查看',
      '完整明细',
      '完整字段',
      '完整内容',
      '全部字段',
      '全部内容',
      '所有字段',
      '详细展示',
      '详细列出',
      '详细明细',
      '详细内容'
    ]);
    if (!hasDetailWord && containsAny(raw, ['完整', '全部', '所有', '详细'])
      && containsAny(raw, ['展示', '列出', '展开', '查看', '给我看', '看下', '看一下', '看看'])) {
      hasDetailWord = true;
    }
    if (!hasDetailWord) return false;
    if (containsAny(raw, ['该用例', '当前用例', '这个用例', '本用例'])) return true;
    if (containsAny(raw, ['当前页面', '当前页', '本页', '这个页面', '该页面'])) return true;
    return true;
  }

  function isCurrentPageFunctionIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (isCaseListIntent(raw)) return false;
    if (containsAny(raw, ['用例改动历史', '用例变更', '改动历史', '变更历史', '历史详情', '变更内容', '变更记录', '用例差异', '差异'])) return false;
    if (containsAny(raw, ['中文名', '中文名称', '页面名', '页签名', '什么页面', '哪个页面', '在哪个页面', '在哪个页签'])) return false;
    if (containsAny(raw, [
      '当前界面有什么用',
      '当前页面有什么用',
      '这个界面有什么用',
      '这个页面有什么用',
      '该页面有什么用',
      '介绍下这个页面',
      '介绍一下这个页面',
      '介绍下这个界面',
      '介绍一下这个界面',
      '介绍下页面功能',
      '介绍一下页面功能',
      '页面功能介绍',
      '页面主要功能',
      '页面是干嘛的',
      '界面是干嘛的'
    ])) return true;
    if (!containsAny(raw, ['页面', '界面', '页签', '当前页', '当前页面', '这个页面', '这个界面', '该页面', '本页'])) return false;
    if (containsAny(raw, ['功能', '作用', '用途', '有什么用', '做什么', '干嘛', '能做什么', '可以做什么', '可做什么', '支持什么', '怎么用', '介绍', '说明'])) return true;
    return false;
  }

  function isExplicitAllCaseDisplayIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (!containsAny(raw, ['用例', 'case', '条目', '记录'])) return false;
    if (containsAny(raw, ['用例改动历史', '用例变更', '改动历史', '变更历史', '历史详情', '变更内容', '变更记录', '用例差异', '差异'])) return false;
    if (containsAny(raw, ['全部用例', '所有用例', '全量用例', '全部条目', '所有条目', '全部记录', '所有记录', '全部都'])) return true;
    if (containsAny(raw, ['全部', '所有', '全都']) && containsAny(raw, ['用例', '条目', '记录'])) return true;
    return false;
  }

  function isCurrentPageCaseIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (!containsAny(raw, ['用例', 'case'])) return false;
    if (containsAny(raw, [
      '当前页面',
      '当前页',
      '本页',
      '这个页面',
      '该页面',
      '这个页',
      '该页',
      '现在页面',
      '现在的页面',
      '当前的页面',
      '当前所在页面',
      '当前所在页',
    ])) {
      return true;
    }
    if (containsAny(raw, ['页面']) && containsAny(raw, ['当前', '现在', '本页', '这个', '该'])) {
      return true;
    }
    return false;
  }

  function shouldPreferCurrentPageScopeForCaseQuery(text) {
    var raw = String(text || '').trim();
    var filterInfo = null;
    var hasFlexibleFilter = false;
    if (!raw) return false;
    if (!containsAny(raw, ['用例', 'case'])) return false;
    if (isCurrentPageCaseIntent(raw)) return true;
    if (containsAny(raw, ['当前项目', '项目里', '项目中', '项目下', '全项目', '所有项目'])) return false;
    filterInfo = extractCaseListFilterInfo(raw);
    hasFlexibleFilter = filterInfo && filterInfo.hasFilter === true;
    if (!hasFlexibleFilter && !containsAny(raw, ['搜索', '查找', '筛选', '过滤', '搜', '找出', '筛出', '挑出', '列出', '列一下', '展示', '显示', '给我看', '看下', '看一下', '看看'])) return false;
    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.getPageData !== 'function') return false;
    var pageData = null;
    try {
      pageData = apis.assistantApi.getPageData('');
    } catch (err) {
      pageData = null;
    }
    var tab = pageData && pageData.tab ? String(pageData.tab).trim().toLowerCase() : '';
    return tab === 'tempexec' || tab === 'case-library';
  }

  function isTempExecNextFileIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (containsAny(raw, ['下一个页面', '下一个问题', '下一个需求', '下一个模块'])) return false;
    var hasNextToken = containsAny(raw, ['下一份', '下一条']);
    if (!hasNextToken && raw.indexOf('下一个') !== -1) {
      hasNextToken = containsAny(raw, ['执行用例', '执行文件', '用例文件']);
    }
    if (!hasNextToken) return false;
    if (!containsAny(raw, ['用例', '执行', '文件', 'case'])) return false;
    return true;
  }

  function isTempExecNextFileCheckIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (containsAny(raw, ['是否', '有没有', '有无', '还有没有', '还有吗', '存在', '哪一份', '哪份', '哪个', '什么'])) return true;
    if (/[?？]/.test(raw)) return true;
    return /(吗|么)\s*$/.test(raw);
  }

  function getTempExecFileDisplayName(file, fallbackText) {
    var item = file && typeof file === 'object' ? file : {};
    var candidates = [
      item.name,
      item.file_name_clean,
      item.fileName,
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      var value = candidates[i];
      if (value === undefined || value === null) continue;
      var text = String(value).trim();
      if (text) return text;
    }
    return fallbackText ? String(fallbackText) : '目标用例';
  }

  function getTempExecNextFileSnapshot() {
    var state = window.app && window.app.state && typeof window.app.state === 'object'
      ? window.app.state
      : null;
    var list = state && Array.isArray(state.tempExecFiles) ? state.tempExecFiles : [];
    if (!list.length) return { ok: false, reason: '当前没有执行用例文件。' };

    var orderedIds = [];
    var tempApi = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
    if (tempApi && typeof tempApi.getTempExecOrderedFileIds === 'function') {
      try {
        var ordered = tempApi.getTempExecOrderedFileIds();
        if (Array.isArray(ordered)) {
          ordered.forEach(function(rawId) {
            if (rawId === undefined || rawId === null) return;
            var id = String(rawId).trim();
            if (!id) return;
            if (orderedIds.indexOf(id) !== -1) return;
            orderedIds.push(id);
          });
        }
      } catch (err) {
        orderedIds = [];
      }
    }
    if (!orderedIds.length) {
      list.forEach(function(file) {
        var item = file && typeof file === 'object' ? file : {};
        var id = item.id === undefined || item.id === null ? '' : String(item.id).trim();
        if (!id) return;
        if (orderedIds.indexOf(id) !== -1) return;
        orderedIds.push(id);
      });
    }
    if (!orderedIds.length) return { ok: false, reason: '当前没有可切换的执行用例。' };

    var fileMap = {};
    list.forEach(function(file) {
      var item = file && typeof file === 'object' ? file : {};
      var id = item.id === undefined || item.id === null ? '' : String(item.id).trim();
      if (!id) return;
      fileMap[id] = item;
    });

    var currentId = state
      ? (state.tempExecActiveId || state.tempExecActiveFileId || '')
      : '';
    currentId = currentId === undefined || currentId === null ? '' : String(currentId).trim();
    if (!currentId) currentId = orderedIds[0];
    var currentIndex = orderedIds.indexOf(currentId);
    if (currentIndex < 0) {
      currentIndex = 0;
      currentId = orderedIds[0];
    }
    var hasNext = orderedIds.length > 1;
    var nextId = hasNext ? orderedIds[(currentIndex + 1) % orderedIds.length] : '';
    var currentFile = fileMap[currentId] || null;
    var nextFile = nextId ? (fileMap[nextId] || null) : null;

    return {
      ok: true,
      total: orderedIds.length,
      currentId: currentId,
      currentIndex: currentIndex,
      currentName: getTempExecFileDisplayName(currentFile, '当前用例'),
      hasNext: hasNext,
      nextId: nextId,
      nextName: hasNext ? getTempExecFileDisplayName(nextFile, '下一份用例') : '',
    };
  }

  function looksLikeCaseHistoryIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (containsAny(raw, ['修改用例', '编辑用例', '删除用例', '更新用例'])) return false;
    if (containsAny(raw, [
      '用例改动历史',
      '改动历史',
      '变更历史',
      '历史详情',
      '变更详情',
      '变更内容',
      '变更记录',
      '改动记录',
      '用例差异',
      '用例变更',
      '新增变更',
      '删除变更',
      '改动变更',
      '追加变更',
      'diff',
      '差异',
    ])) return true;
    if (containsAny(raw, ['变更', '改动', '历史'])
      && containsAny(raw, ['整理', '总结', '归纳', '列出', '查看', '看下', '看看', '读取', '查询', '返回'])) {
      return true;
    }
    if (containsAny(raw, ['变更'])
      && containsAny(raw, ['新增', '删除', '改动', '追加'])
      && containsAny(raw, ['多少', '几条', '数量', '总数', '明细', '哪些', '哪条'])) {
      return true;
    }
    if (containsAny(raw, ['这页', '当前页', '当前页面', '页面内', '页面里', '这里'])
      && containsAny(raw, ['变更', '改动', '历史'])) {
      return true;
    }
    return false;
  }

  function hasCaseLibraryHistoryPageData(pageData) {
    var data = pageData && typeof pageData === 'object' ? pageData : null;
    var detail = data && data.caseLibraryHistoryDetail && typeof data.caseLibraryHistoryDetail === 'object'
      ? data.caseLibraryHistoryDetail
      : null;
    return Boolean(detail && detail.hasContext === true);
  }


  function hasTempExecCaseLibraryDiffPageData(pageData) {
    var data = pageData && typeof pageData === 'object' ? pageData : null;
    var detail = data && data.tempExecCaseLibraryDiffDetail && typeof data.tempExecCaseLibraryDiffDetail === 'object'
      ? data.tempExecCaseLibraryDiffDetail
      : null;
    return Boolean(detail && detail.hasContext === true);
  }

  function getTempExecCaseLibraryDiffKindLabel(kind) {
    var text = kind === undefined || kind === null ? '' : String(kind).trim();
    if (text === 'appended') return '追加';
    if (text === 'added') return '新增';
    if (text === 'updated') return '改动';
    if (text === 'deleted') return '删除';
    return '';
  }

  function buildTempExecCaseLibraryDiffTypeSummaryText(summary) {
    var source = summary && typeof summary === 'object' ? summary : {};
    var order = [
      { key: 'appended', label: '追加' },
      { key: 'added', label: '新增' },
      { key: 'updated', label: '改动' },
      { key: 'deleted', label: '删除' },
    ];
    var parts = [];
    for (var i = 0; i < order.length; i += 1) {
      var item = order[i];
      var count = Number(source[item.key]);
      if (!Number.isFinite(count) || count <= 0) continue;
      parts.push(item.label + ' ' + count + ' 条');
    }
    return parts.join('；');
  }

  function extractTempExecCaseLibraryDiffKindsFromText(text) {
    var raw = String(text || '').trim();
    var kinds = [];
    function pushKind(kind) {
      if (!kind) return;
      if (kinds.indexOf(kind) !== -1) return;
      kinds.push(kind);
    }
    if (containsAny(raw, ['追加'])) pushKind('appended');
    if (containsAny(raw, ['新增'])) pushKind('added');
    if (containsAny(raw, ['删除'])) pushKind('deleted');
    if (containsAny(raw, ['改动', '修改']) && !containsAny(raw, ['修改用例', '编辑用例'])) pushKind('updated');
    return kinds;
  }

  function filterTempExecCaseLibraryDiffEventsByKinds(events, kinds) {
    var list = Array.isArray(events) ? events : [];
    var filters = Array.isArray(kinds) ? kinds : [];
    if (!filters.length) return list.slice();
    return list.filter(function(item) {
      var kind = item && item.kind ? String(item.kind) : '';
      return filters.indexOf(kind) !== -1;
    });
  }

  function isCaseChangeCountIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    return containsAny(raw, ['多少', '几条', '数量', '总数', '条数', 'count']);
  }

  function getTempExecCaseLibraryDiffKindCount(summary, kind) {
    var source = summary && typeof summary === 'object' ? summary : {};
    var key = kind === undefined || kind === null ? '' : String(kind).trim();
    if (!key) return 0;
    return Number(source[key]) || 0;
  }

  function buildCaseHistoryTypeSummaryText(summary) {
    var source = summary && typeof summary === 'object' ? summary : {};
    var order = [
      { key: 'append', label: '追加' },
      { key: 'added', label: '新增' },
      { key: 'updated', label: '改动' },
      { key: 'deleted', label: '删除' },
      { key: 'import', label: '导入' },
      { key: 'reimport', label: '重导' },
      { key: 'file_deleted', label: '整份删除' },
      { key: 'version_changed', label: '版本变更' },
    ];
    var parts = [];
    for (var i = 0; i < order.length; i += 1) {
      var item = order[i];
      var count = Number(source[item.key]);
      if (!Number.isFinite(count) || count <= 0) continue;
      parts.push(item.label + ' ' + count + ' 条');
    }
    return parts.join('；');
  }

  function extractCaseHistoryKindsFromText(text) {
    var raw = String(text || '').trim();
    var kinds = [];
    function pushKind(kind) {
      if (!kind) return;
      if (kinds.indexOf(kind) !== -1) return;
      kinds.push(kind);
    }
    if (containsAny(raw, ['追加'])) pushKind('append');
    if (containsAny(raw, ['新增'])) pushKind('added');
    if (containsAny(raw, ['删除']) && !containsAny(raw, ['整份删除'])) pushKind('deleted');
    if (containsAny(raw, ['导入']) && !containsAny(raw, ['重导', '重新导入'])) pushKind('import');
    if (containsAny(raw, ['重导', '重新导入'])) pushKind('reimport');
    if (containsAny(raw, ['整份删除'])) pushKind('file_deleted');
    if (containsAny(raw, ['版本变更'])) pushKind('version_changed');
    return kinds;
  }

  function filterCaseHistoryEventsByKinds(events, kinds) {
    var list = Array.isArray(events) ? events : [];
    var filters = Array.isArray(kinds) ? kinds : [];
    if (!filters.length) return list.slice();
    return list.filter(function(item) {
      var kind = item && item.kind ? String(item.kind) : '';
      return filters.indexOf(kind) !== -1;
    });
  }

  function buildTempExecCaseLibraryDiffFallbackText(userText, pageData, responseHint) {
    var data = pageData && typeof pageData === 'object' ? pageData : {};
    var detail = data.tempExecCaseLibraryDiffDetail && typeof data.tempExecCaseLibraryDiffDetail === 'object'
      ? data.tempExecCaseLibraryDiffDetail
      : null;
    if (!detail || detail.hasContext !== true) return '';
    var raw = String(userText || '').trim();
    var hint = responseHint === undefined || responseHint === null ? '' : String(responseHint).trim();
    var lines = [];
    if (hint) lines.push(hint);
    var fileName = detail.fileName ? String(detail.fileName) : '当前执行用例';
    var summary = detail.summary && typeof detail.summary === 'object' ? detail.summary : {};
    var total = Number(detail.total) || 0;
    var kindFilters = extractTempExecCaseLibraryDiffKindsFromText(raw);
    var isCount = isCaseChangeCountIntent(raw);
    if (!detail.hasSignal && total <= 0) {
      lines.push('当前执行页“用例变更”暂无可读取的差异记录。');
      if (detail.statusText) lines.push(String(detail.statusText));
      return lines.join('\n');
    }
    if (kindFilters.length === 1 && isCount) {
      var kind = kindFilters[0];
      var count = getTempExecCaseLibraryDiffKindCount(summary, kind);
      var label = getTempExecCaseLibraryDiffKindLabel(kind) || '目标类型';
      lines.push('当前执行页“用例变更”中，' + label + ' ' + count + ' 条。');
      lines.push('统计范围：' + fileName + '。');
      var summaryTextSingle = buildTempExecCaseLibraryDiffTypeSummaryText(summary);
      if (summaryTextSingle) lines.push('全部变更统计：' + summaryTextSingle + '。');
      return lines.join('\n');
    }
    if (isCount && kindFilters.length > 1) {
      var totalByKinds = 0;
      for (var i = 0; i < kindFilters.length; i += 1) {
        totalByKinds += getTempExecCaseLibraryDiffKindCount(summary, kindFilters[i]);
      }
      lines.push('按你的问题口径，当前执行页“用例变更”命中 ' + totalByKinds + ' 条。');
      lines.push('统计范围：' + fileName + '。');
      return lines.join('\n');
    }
    if (isCount) {
      lines.push('当前执行页“用例变更”共 ' + total + ' 条。');
      lines.push('统计范围：' + fileName + '。');
      var summaryText = buildTempExecCaseLibraryDiffTypeSummaryText(summary);
      if (summaryText) lines.push('类型统计：' + summaryText + '。');
      return lines.join('\n');
    }
    lines.push('当前执行页“用例变更”（用例库同步差异）：' + fileName);
    if (detail.statusText) lines.push(String(detail.statusText));
    var fullSummaryText = buildTempExecCaseLibraryDiffTypeSummaryText(summary);
    if (fullSummaryText) lines.push('类型统计：' + fullSummaryText);
    if (detail.filterLabel) {
      lines.push('当前抽屉筛选：' + String(detail.filterLabel) + '，命中 ' + (Number(detail.filteredTotal) || 0) + ' 条。');
    }
    var sourceEvents = Array.isArray(detail.pageEvents) && detail.pageEvents.length
      ? detail.pageEvents
      : (Array.isArray(detail.events) ? detail.events : []);
    var events = filterTempExecCaseLibraryDiffEventsByKinds(sourceEvents, kindFilters);
    if (!events.length) {
      lines.push(kindFilters.length ? '当前没有命中你指定类型的变更。' : '当前没有可展示的变更明细。');
      return lines.join('\n');
    }
    lines.push('关键记录：');
    for (var j = 0; j < events.length && j < 5; j += 1) {
      var item = events[j] && typeof events[j] === 'object' ? events[j] : {};
      var title = item.title ? String(item.title) : (item.module ? String(item.module) : '未命名条目');
      var timeText = item.changedAt ? formatCaseListTime(item.changedAt) : '--';
      var operatorText = item.operator ? String(item.operator) : '--';
      var fieldsText = Array.isArray(item.changedFields) && item.changedFields.length
        ? item.changedFields.join('、')
        : '无字段差异';
      lines.push((j + 1) + '. ' + (item.kindLabel || getTempExecCaseLibraryDiffKindLabel(item.kind) || '变更') + ' | ' + title + ' | ' + fieldsText + ' | ' + operatorText + ' | ' + timeText);
    }
    if (detail.truncated === true) {
      lines.push('当前仅整理了前 ' + (Array.isArray(detail.events) ? detail.events.length : 0) + ' 条可读记录。');
    }
    return lines.join('\n');
  }

  function buildCaseHistoryReasonPayload(pageData) {
    var data = pageData && typeof pageData === 'object' ? pageData : {};
    var detail = data.caseLibraryHistoryDetail && typeof data.caseLibraryHistoryDetail === 'object'
      ? data.caseLibraryHistoryDetail
      : {};
    var events = Array.isArray(detail.events) ? detail.events.slice(0, 60) : [];
    var pageEvents = Array.isArray(detail.pageEvents) ? detail.pageEvents.slice(0, 20) : [];
    return {
      tab: data.tab ? String(data.tab) : '',
      projectId: detail.projectId ? String(detail.projectId) : '',
      projectName: detail.projectName ? String(detail.projectName) : '',
      versionId: detail.versionId ? String(detail.versionId) : '',
      versionName: detail.versionName ? String(detail.versionName) : '',
      fileNameClean: detail.fileNameClean ? String(detail.fileNameClean) : '',
      isDeleted: detail.isDeleted === true,
      loading: detail.loading === true,
      filter: detail.filter ? String(detail.filter) : '',
      filterLabel: detail.filterLabel ? String(detail.filterLabel) : '',
      total: Number(detail.total) || 0,
      filteredTotal: Number(detail.filteredTotal) || 0,
      currentPage: Number(detail.currentPage) || 1,
      totalPages: Number(detail.totalPages) || 1,
      pageSize: Number(detail.pageSize) || 0,
      pageStart: Number(detail.pageStart) || 0,
      pageEnd: Number(detail.pageEnd) || 0,
      truncated: detail.truncated === true,
      summary: detail.summary && typeof detail.summary === 'object' ? detail.summary : {},
      filteredSummary: detail.filteredSummary && typeof detail.filteredSummary === 'object' ? detail.filteredSummary : {},
      pageEvents: pageEvents,
      events: events,
    };
  }

  function buildCaseHistoryFallbackText(userText, pageData, responseHint) {
    var data = pageData && typeof pageData === 'object' ? pageData : {};
    var detail = data.caseLibraryHistoryDetail && typeof data.caseLibraryHistoryDetail === 'object'
      ? data.caseLibraryHistoryDetail
      : null;
    if (!detail || detail.hasContext !== true) return '';
    if (detail.loading === true) {
      return responseHint ? (String(responseHint).trim() + '\n当前用例改动历史仍在加载中，请稍后再试。') : '当前用例改动历史仍在加载中，请稍后再试。';
    }
    var raw = String(userText || '').trim();
    var lines = [];
    var hint = responseHint === undefined || responseHint === null ? '' : String(responseHint).trim();
    if (hint) lines.push(hint);
    var header = '当前查看的用例改动历史：' + (detail.fileNameClean ? String(detail.fileNameClean) : '目标用例');
    if (detail.projectName) {
      header += '（' + String(detail.projectName) + (detail.versionName ? (' / ' + String(detail.versionName)) : '') + '）';
    }
    lines.push(header);
    if (detail.isDeleted === true) {
      lines.push('状态：该用例已整份删除，历史记录仍保留。');
    }
    if (detail.filterLabel) {
      lines.push('当前筛选：' + String(detail.filterLabel) + '，命中 ' + (Number(detail.filteredTotal) || 0) + ' 条。');
    } else {
      lines.push('共 ' + (Number(detail.total) || 0) + ' 条历史记录。');
    }
    var summaryText = buildCaseHistoryTypeSummaryText(detail.summary);
    if (summaryText) lines.push('类型统计：' + summaryText);
    var kindFilters = extractCaseHistoryKindsFromText(raw);
    var sourceEvents = Array.isArray(detail.pageEvents) && detail.pageEvents.length
      ? detail.pageEvents
      : (Array.isArray(detail.events) ? detail.events : []);
    var events = filterCaseHistoryEventsByKinds(sourceEvents, kindFilters);
    if (!events.length) {
      lines.push(kindFilters.length ? '当前页没有命中你指定类型的变更记录。' : '当前页没有可展示的变更记录。');
      return lines.join('\n');
    }
    lines.push('当前页关键记录：');
    for (var i = 0; i < events.length && i < 5; i += 1) {
      var item = events[i] && typeof events[i] === 'object' ? events[i] : {};
      var title = item.title ? String(item.title) : (item.module ? String(item.module) : '未命名条目');
      var fields = Array.isArray(item.changedFields) && item.changedFields.length
        ? item.changedFields.join('、')
        : '无字段变化';
      var timeText = item.changedAt ? formatCaseListTime(item.changedAt) : '--';
      lines.push((i + 1) + '. ' + (item.kindLabel || item.kind || '变更') + ' | ' + title + ' | ' + fields + ' | ' + timeText);
    }
    if (Number(detail.totalPages) > 1) {
      lines.push('当前显示第 ' + (Number(detail.currentPage) || 1) + ' / ' + (Number(detail.totalPages) || 1) + ' 页。');
    }
    return lines.join('\n');
  }

  async function summarizeCaseHistoryPageDataByModel(userText, pageData, responseHint) {
    var data = pageData && typeof pageData === 'object' ? pageData : {};
    var detail = data.caseLibraryHistoryDetail && typeof data.caseLibraryHistoryDetail === 'object'
      ? data.caseLibraryHistoryDetail
      : null;
    if (!detail || detail.hasContext !== true) return '';
    if (detail.loading === true) {
      return responseHint ? (String(responseHint).trim() + '\n当前用例改动历史仍在加载中，请稍后再试。') : '当前用例改动历史仍在加载中，请稍后再试。';
    }
    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.callModel !== 'function') return '';
    var payload = {
      userQuestion: String(userText || ''),
      historyDetail: buildCaseHistoryReasonPayload(data),
    };
    var prompt = [
      '你是“用例改动历史整理助手”。',
      '请基于当前页面里的用例改动历史回答用户问题，不要编造页面上不存在的数据。',
      '回答规则：',
      '- 先直接回答问题，再补充关键依据。',
      '- 用户要求“整理/总结”时，优先归纳变更类型、变更字段和关键条目。',
      '- 用户明确指定新增/删除/导入/重导/追加/整份删除/版本变更时，只整理相关记录。',
      '- 用户问“多少/数量”时，直接给数字与口径。',
      '- 只有用户明确要求“列表/逐条/表格/明细”时才输出列表。',
      '- 输出中文自然语言，可用 Markdown，不要 JSON。',
    ].join('\n');
    var history = buildConversationHistory(8, userText);
    var res = null;
    try {
      res = await apis.assistantApi.callModel(JSON.stringify(payload, null, 2), {
        prompt: prompt,
        temperature: 0.1,
        history: history,
      });
    } catch (err) {
      res = { ok: false, reason: err && err.message ? String(err.message) : '整理异常' };
    }
    if (!res || res.ok !== true || !res.content) return '';
    var text = String(res.content || '').trim();
    if (!text) return '';
    if (parseJsonObjectFromText(text)) return '';
    if (responseHint) {
      var hint = String(responseHint).trim();
      if (hint) return hint + '\n' + text;
    }
    return text;
  }

  async function summarizeCaseChangePageData(userText, pageData, responseHint) {
    var data = pageData && typeof pageData === 'object' ? pageData : {};
    if (hasTempExecCaseLibraryDiffPageData(data)) {
      var execDiffText = buildTempExecCaseLibraryDiffFallbackText(userText, data, responseHint || '');
      if (execDiffText) return execDiffText;
    }
    if (hasCaseLibraryHistoryPageData(data)) {
      var summarized = await summarizeCaseHistoryPageDataByModel(userText, data, responseHint || '');
      if (summarized) return summarized;
      var fallbackText = buildCaseHistoryFallbackText(userText, data, responseHint || '');
      if (fallbackText) return fallbackText;
    }
    return '';
  }

  function buildCaseChangeNoContextText(pageData) {
    var data = pageData && typeof pageData === 'object' ? pageData : {};
    var tab = data.tab ? String(data.tab) : '';
    if (tab === 'tempexec') {
      return '当前处于用例执行页，但没有可读取的“用例变更”数据。请先打开一份执行用例，或点击执行页上的“用例变更”按钮同步差异。';
    }
    return '当前页面没有打开用例改动历史详情。请先进入“用例库 -> 用例改动历史”，打开某个用例的“历史详情”。';
  }

  function formatCaseListTime(value) {
    if (!value) return '--';
    var text = String(value);
    var date = new Date(text);
    if (isNaN(date.getTime())) return text;
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var two = function(num) { return num < 10 ? ('0' + num) : String(num); };
    return year + '-' + two(month) + '-' + two(day) + ' ' + two(hours) + ':' + two(minutes);
  }

  function buildEditorCaseListTitle(result) {
    var data = result && typeof result === 'object' ? result : {};
    var caseFile = data.caseFile && typeof data.caseFile === 'object' ? data.caseFile : {};
    var caseName = caseFile.name ? String(caseFile.name) : (caseFile.id ? ('用例#' + String(caseFile.id)) : '当前用例');
    var caseId = caseFile.id === undefined || caseFile.id === null ? '' : String(caseFile.id);
    var contextSource = data.contextSource ? String(data.contextSource) : '';
    var prefix = contextSource === 'tempexec' ? '当前正在查看用例：' : '当前正在编辑用例：';
    var title = prefix + caseName;
    if (caseId) title += '（ID: ' + caseId + '）';
    return title;
  }

  function normalizeCaseTableCell(value, fallback) {
    var text = value === undefined || value === null ? '' : String(value);
    text = text.replace(/\r\n/g, '\n').replace(/\n/g, ' / ').replace(/\|/g, '｜').trim();
    if (!text) return fallback || '—';
    return text;
  }

  function resolveCaseExecutionResult(item) {
    var row = item && typeof item === 'object' ? item : {};
    var candidates = [
      row.executionResult,
      row.actual,
      row.status,
      row.result,
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      var value = candidates[i];
      if (value === undefined || value === null) continue;
      var text = String(value).trim();
      if (text) return text;
    }
    return '';
  }


  function shouldIncludeExecutionResultColumn(result) {
    var source = result && result.contextSource ? String(result.contextSource) : '';
    return source === 'tempexec';
  }

  function buildEditorCaseListTableMarkdown(items, options) {
    var list = Array.isArray(items) ? items : [];
    var opts = options && typeof options === 'object' ? options : {};
    var includeExecutionResult = opts.includeExecutionResult === true;
    var lines = [
      includeExecutionResult
        ? '| 序号 | ID | 模块 | 标题 | 优先级 | 前置条件 | 步骤 | 预期结果 | 备注 | 执行结果 |'
        : '| 序号 | ID | 模块 | 标题 | 优先级 | 前置条件 | 步骤 | 预期结果 | 备注 |',
      includeExecutionResult
        ? '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
        : '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ];
    for (var i = 0; i < list.length; i += 1) {
      var row = list[i] && typeof list[i] === 'object' ? list[i] : {};
      var fallbackIndex = Number(row.sourceIndex) || Number(row.index) || (i + 1);
      var seq = normalizeCaseTableCell(fallbackIndex, String(fallbackIndex));
      var id = normalizeCaseTableCell(row.id, '—');
      var moduleName = normalizeCaseTableCell(row.module, '—');
      var titleText = normalizeCaseTableCell(row.title, '未命名条目#' + fallbackIndex);
      var priority = normalizeCaseTableCell(row.priority, '—');
      var precondition = normalizeCaseTableCell(row.precondition || row.preconditions, '—');
      var steps = normalizeCaseTableCell(row.steps, '—');
      var expected = normalizeCaseTableCell(row.expected, '—');
      var remark = normalizeCaseTableCell(row.remark, '—');
      var cells = [
        seq,
        id,
        moduleName,
        titleText,
        priority,
        precondition,
        steps,
        expected,
        remark,
      ];
      if (includeExecutionResult) {
        cells.push(normalizeCaseTableCell(resolveCaseExecutionResult(row), '—'));
      }
      lines.push('| ' + cells.join(' | ') + ' |');
    }
    return lines.join('\n');
  }

  function normalizeCaseFilterKeywordToken(rawText) {
    var token = String(rawText || '').trim();
    var prev = '';
    if (!token) return '';
    token = token.replace(/^[“"'`【\[\(（\s]+|[”"'`】\]\)）\s]+$/g, '');
    while (token && token !== prev) {
      prev = token;
      token = token.replace(/^(?:把|将|帮我|请|麻烦|给我|我想看|我想要|想看|想要|当前页面(?:中|内)?|当前页(?:中|内)?|本页(?:中|内)?|这个页面(?:中|内)?|该页面(?:中|内)?|现在页面(?:中|内)?|当前|所有|全部|所有的|全部的|只看|仅看|只要|仅要|聚焦|关注|搜索|查找|筛选|过滤|找出|筛出|挑出|列出|列一下|展示出来|展示|显示出来|显示|查看|读取|获取|给我看|看一下|看下|看看)+/g, '');
      token = token.replace(/^(?:和|与|跟|其中|里面|里边)+/g, '');
      token = token.replace(/(?:无关|不相关|有关|相关|匹配|命中)+$/g, '');
      token = token.replace(/(?:的)?(?:展示出来|列出来|显示出来|整理出来|给我看|看一下|看下|看看|展示|列出|列一下|显示|查看|筛出来|找出来|筛出|找出|挑出|列明细|展示下)+$/g, '');
      token = token.replace(/(?:的)?(?:用例|条目|内容|字段|标题|模块|方面|情况|明细|列表|清单)+$/g, '');
      token = token.replace(/(?:等等|等)(?:关键字|关键词|字样)$/g, '');
      token = token.replace(/(?:这些|那些|这类|此类|这样的|类似的|相关的|相关|有关的|有关)?(?:关键字|关键词|字样)(?:相关|有关)?$/g, '');
      token = token.replace(/的$/g, '');
      token = token.replace(/^\s+|\s+$/g, '');
    }
    return token;
  }

  function splitCaseFilterKeywords(rawText) {
    var text = String(rawText || '').trim();
    var chunks = null;
    var result = [];
    var i = 0;
    if (!text) return [];
    chunks = text.split(/(?:、|,|，|\/|\\|\||\s+|以及|及|和|或|或者)+/);
    for (i = 0; i < chunks.length; i += 1) {
      var token = normalizeCaseFilterKeywordToken(chunks[i]);
      if (!token) continue;
      result.push(token);
    }
    return result;
  }

  function pushUniqueCaseFilterKeyword(list, value) {
    var target = Array.isArray(list) ? list : null;
    if (!target) return;
    var key = normalizeCaseFilterKeywordToken(value);
    if (!key) return;
    for (var i = 0; i < target.length; i += 1) {
      if (String(target[i] || '') === key) return;
    }
    target.push(key);
  }

  function collectCaseFilterKeywordsByPattern(raw, pattern, bucket) {
    if (!raw || !pattern || !Array.isArray(bucket)) return;
    var match = null;
    while ((match = pattern.exec(raw)) !== null) {
      var segment = match[1] ? String(match[1]) : '';
      var tokens = splitCaseFilterKeywords(segment);
      for (var i = 0; i < tokens.length; i += 1) {
        pushUniqueCaseFilterKeyword(bucket, tokens[i]);
      }
    }
  }

  function normalizeCaseListParity(rawText) {
    var text = String(rawText || '').trim();
    if (!text) return '';
    if (containsAny(text, ['偶数', '双数', '双号'])) return 'even';
    if (containsAny(text, ['奇数', '单数', '单号'])) return 'odd';
    return '';
  }

  function collectCaseListParityInfo(raw, info) {
    var indexPatterns = [
      /(?:序号|编号|条号|条目序号|条目编号|第几条|第几项)(?:为|是|属于)?\s*(奇数|偶数|单数|双数|单号|双号)/g,
      /(奇数|偶数|单数|双数|单号|双号)(?:编号|序号|条目|条|项)?(?:的)?用例/g,
    ];
    var idPatterns = [
      /(?:用例\s*)?[Ii][Dd](?:编号)?(?:为|是|属于)?\s*(奇数|偶数|单数|双数|单号|双号)/g,
      /(奇数|偶数|单数|双数|单号|双号)\s*(?:的)?(?:用例\s*)?[Ii][Dd]/g,
    ];
    var parity = '';
    var match = null;
    var i = 0;
    if (!raw || !info || typeof info !== 'object') return;
    for (i = 0; i < idPatterns.length; i += 1) {
      idPatterns[i].lastIndex = 0;
      match = idPatterns[i].exec(raw);
      parity = match && match[1] ? normalizeCaseListParity(match[1]) : '';
      if (parity) {
        info.idParity = parity;
        break;
      }
    }
    for (i = 0; i < indexPatterns.length; i += 1) {
      indexPatterns[i].lastIndex = 0;
      match = indexPatterns[i].exec(raw);
      parity = match && match[1] ? normalizeCaseListParity(match[1]) : '';
      if (parity) {
        info.indexParity = parity;
        break;
      }
    }
  }

  function extractCaseListFilterInfo(text) {
    var raw = String(text || '').trim();
    var info = {
      includeKeywords: [],
      excludeKeywords: [],
      indexParity: '',
      idParity: '',
      hasFilter: false,
    };
    if (!raw) return info;

    collectCaseFilterKeywordsByPattern(raw, /(?:和|与|跟)([^，。！？!?；;：:\n]+?)无关/g, info.excludeKeywords);
    collectCaseFilterKeywordsByPattern(raw, /(?:和|与|跟)([^，。！？!?；;：:\n]+?)(?:不相关|没关系)/g, info.excludeKeywords);
    collectCaseFilterKeywordsByPattern(raw, /(?:不包含|不含|不看|不要|排除)([^，。！？!?；;：:\n]+)/g, info.excludeKeywords);
    collectCaseFilterKeywordsByPattern(raw, /除了([^，。！？!?；;：:\n]+?)(?:外|以外)/g, info.excludeKeywords);

    collectCaseFilterKeywordsByPattern(raw, /(?:和|与|跟)([^，。！？!?；;：:\n]+?)有关/g, info.includeKeywords);
    collectCaseFilterKeywordsByPattern(raw, /([^，。！？!?；;：:\n]+?)相关(?:的)?用例/g, info.includeKeywords);
    collectCaseFilterKeywordsByPattern(raw, /([^，。！？!?；;：:\n]+?)(?:匹配|命中)(?:的)?用例/g, info.includeKeywords);
    collectCaseFilterKeywordsByPattern(raw, /(?:^|[^不])(?:包含|含有|只看|仅看|只要|仅要|聚焦|关注)([^，。！？!?；;：:\n]+)/g, info.includeKeywords);
    collectCaseFilterKeywordsByPattern(raw, /(?:搜索|查找|筛选|过滤)([^，。！？!?；;：:\n]*?)用例/g, info.includeKeywords);
    collectCaseFilterKeywordsByPattern(raw, /用例(?:中|里)?(?:搜索|查找|筛选|过滤)([^，。！？!?；;：:\n]+)/g, info.includeKeywords);
    collectCaseFilterKeywordsByPattern(raw, /(?:用例|case)(?:中|里)?(?:包含|含有)([^，。！？!?；;：:\n]+)/g, info.includeKeywords);
    collectCaseFilterKeywordsByPattern(raw, /[“"'`【]([^“"'`【】]+)[”"'`】](?:相关|有关|匹配|命中)?(?:的)?用例/g, info.includeKeywords);
    collectCaseListParityInfo(raw, info);

    info.hasFilter = info.includeKeywords.length > 0
      || info.excludeKeywords.length > 0
      || Boolean(info.indexParity)
      || Boolean(info.idParity);
    return info;
  }

  function shouldPlanCaseListFilterByModel(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (containsAny(raw, ['偶数', '奇数', '单数', '双数', '单号', '双号'])) return true;
    if (containsAny(raw, ['包含', '含有', '搜索', '查找', '筛选', '过滤', '匹配', '命中', '关键字', '关键词', '排除', '不包含', '不含', '不看', '不要', '除了', '无关', '相关'])) return true;
    if (/[“"'`【][^“"'`【】]+[”"'`】]/.test(raw) && containsAny(raw, ['用例', 'case'])) return true;
    return false;
  }

  function normalizeCaseListFilterPlanArray(value) {
    if (Array.isArray(value)) return value.slice();
    if (value === undefined || value === null) return [];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return [String(value)];
    }
    return [];
  }

  function normalizeCaseListFilterPlan(rawPlan) {
    var plan = rawPlan && typeof rawPlan === 'object' ? rawPlan : null;
    var info = null;
    var includeValues = [];
    var excludeValues = [];
    var mode = '';
    var hasRecognizedField = false;
    var i = 0;
    if (!plan) return null;
    info = {
      includeKeywords: [],
      excludeKeywords: [],
      indexParity: '',
      idParity: '',
      hasFilter: false,
      source: 'model',
    };
    if (plan.mode !== undefined && plan.mode !== null) {
      mode = String(plan.mode).trim().toLowerCase();
      hasRecognizedField = true;
    }
    if (plan.hasFilter !== undefined || plan.noFilter !== undefined) {
      hasRecognizedField = true;
    }
    if (plan.includeKeywords !== undefined) {
      includeValues = includeValues.concat(normalizeCaseListFilterPlanArray(plan.includeKeywords));
      hasRecognizedField = true;
    }
    if (plan.include !== undefined) {
      includeValues = includeValues.concat(normalizeCaseListFilterPlanArray(plan.include));
      hasRecognizedField = true;
    }
    if (plan.keywords !== undefined) {
      includeValues = includeValues.concat(normalizeCaseListFilterPlanArray(plan.keywords));
      hasRecognizedField = true;
    }
    if (plan.excludeKeywords !== undefined) {
      excludeValues = excludeValues.concat(normalizeCaseListFilterPlanArray(plan.excludeKeywords));
      hasRecognizedField = true;
    }
    if (plan.exclude !== undefined) {
      excludeValues = excludeValues.concat(normalizeCaseListFilterPlanArray(plan.exclude));
      hasRecognizedField = true;
    }
    if (plan.excludeTerms !== undefined) {
      excludeValues = excludeValues.concat(normalizeCaseListFilterPlanArray(plan.excludeTerms));
      hasRecognizedField = true;
    }
    if (plan.indexParity !== undefined || plan.sequenceParity !== undefined || plan.orderParity !== undefined) {
      info.indexParity = normalizeCaseListParity(plan.indexParity !== undefined ? plan.indexParity : (plan.sequenceParity !== undefined ? plan.sequenceParity : plan.orderParity));
      hasRecognizedField = true;
    }
    if (plan.idParity !== undefined || plan.caseIdParity !== undefined) {
      info.idParity = normalizeCaseListParity(plan.idParity !== undefined ? plan.idParity : plan.caseIdParity);
      hasRecognizedField = true;
    }
    if (!hasRecognizedField) return null;
    for (i = 0; i < includeValues.length; i += 1) {
      pushUniqueCaseFilterKeyword(info.includeKeywords, includeValues[i]);
    }
    for (i = 0; i < excludeValues.length; i += 1) {
      pushUniqueCaseFilterKeyword(info.excludeKeywords, excludeValues[i]);
    }
    if (mode === 'none') mode = 'no_filter';
    if (mode === 'no-filter') mode = 'no_filter';
    if (mode === 'with_filter') mode = 'filter';
    if (mode === 'filtered') mode = 'filter';
    if (plan.noFilter === true || plan.hasFilter === false || mode === 'no_filter') {
      info.hasFilter = false;
      info.includeKeywords = [];
      info.excludeKeywords = [];
      info.indexParity = '';
      info.idParity = '';
      return info;
    }
    info.hasFilter = info.includeKeywords.length > 0
      || info.excludeKeywords.length > 0
      || Boolean(info.indexParity)
      || Boolean(info.idParity);
    if (!info.hasFilter && mode === 'filter') return null;
    if (!info.hasFilter && plan.hasFilter === true) return null;
    return info;
  }

  async function planCaseListFilterByModel(userText) {
    var raw = String(userText || '').trim();
    var apis = getApis();
    var payload = null;
    var prompt = '';
    var res = null;
    var parsed = null;
    var info = null;
    if (!shouldPlanCaseListFilterByModel(raw)) return null;
    if (!apis.assistantApi || typeof apis.assistantApi.callModel !== 'function') return null;
    payload = {
      userQuestion: raw,
      task: 'plan_case_list_filter',
    };
    prompt = [
      '你是用例筛选规划助手。',
      '请只根据用户原话提取用例列表过滤条件，并只输出一个 JSON 对象，不要代码块，不要解释。',
      'JSON 结构：{"mode":"filter|no_filter","includeKeywords":[],"excludeKeywords":[],"indexParity":"odd|even|","idParity":"odd|even|"}',
      '规则：',
      '- 只保留用户真正要筛的词，不要把“这些关键字/关键词/字样/相关的”之类修饰语当关键词。',
      '- “包含联机、死亡这些关键字” 应输出 includeKeywords=["联机","死亡"]。',
      '- “编号为偶数的用例” 应输出 indexParity="even"。',
      '- “ID 为奇数的用例” 应输出 idParity="odd"。',
      '- “排除联机” 应输出 excludeKeywords=["联机"]。',
      '- 如果用户只是想看当前页全部用例，没有明确筛选条件，输出 mode="no_filter"。',
      '- 不要编造不存在的关键词。',
    ].join('\n');
    try {
      res = await apis.assistantApi.callModel(JSON.stringify(payload, null, 2), {
        prompt: prompt,
        temperature: 0,
        history: buildConversationHistory(4, raw),
      });
    } catch (err) {
      res = null;
    }
    if (!res || res.ok !== true || !res.content) return null;
    parsed = parseJsonObjectFromText(res.content);
    info = normalizeCaseListFilterPlan(parsed);
    if (!info) return null;
    return {
      planned: true,
      filterInfo: info,
    };
  }

  function buildCaseListFilterLabel(filterInfo) {
    var info = filterInfo && typeof filterInfo === 'object' ? filterInfo : {};
    var include = Array.isArray(info.includeKeywords) ? info.includeKeywords : [];
    var exclude = Array.isArray(info.excludeKeywords) ? info.excludeKeywords : [];
    var indexParity = info.indexParity ? String(info.indexParity).trim() : '';
    var idParity = info.idParity ? String(info.idParity).trim() : '';
    var parts = [];
    if (include.length) parts.push('包含“' + include.join('”、“') + '”');
    if (exclude.length) parts.push('排除“' + exclude.join('”、“') + '”');
    if (indexParity === 'even') parts.push('序号为偶数');
    if (indexParity === 'odd') parts.push('序号为奇数');
    if (idParity === 'even') parts.push('ID 为偶数');
    if (idParity === 'odd') parts.push('ID 为奇数');
    return parts.join('，');
  }

  function buildCompactCaseListFilterInfo(filterInfo) {
    var info = filterInfo && typeof filterInfo === 'object' ? filterInfo : {};
    var payload = {};
    var include = Array.isArray(info.includeKeywords) ? info.includeKeywords.slice(0, 12) : [];
    var exclude = Array.isArray(info.excludeKeywords) ? info.excludeKeywords.slice(0, 12) : [];
    var hasPayload = false;
    var key = '';
    if (include.length) payload.includeKeywords = include;
    if (exclude.length) payload.excludeKeywords = exclude;
    if (info.indexParity) payload.indexParity = String(info.indexParity);
    if (info.idParity) payload.idParity = String(info.idParity);
    for (key in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        hasPayload = true;
        break;
      }
    }
    return hasPayload ? payload : null;
  }

  function buildCaseItemSearchText(item) {
    var row = item && typeof item === 'object' ? item : {};
    var text = [
      row.id,
      row.index,
      row.sourceIndex,
      row.module,
      row.title,
      row.priority,
      row.precondition,
      row.preconditions,
      row.steps,
      row.expected,
      row.remark,
      row.executionResult,
      row.actual,
      row.status,
      row.result,
    ].map(function(value) {
      return value === undefined || value === null ? '' : String(value);
    }).join(' ');
    return text.toLowerCase();
  }

  function resolveCaseItemSequenceNumber(item, fallbackIndex) {
    var row = item && typeof item === 'object' ? item : {};
    var raw = row.sourceIndex;
    var num = NaN;
    var match = null;
    if (raw === undefined || raw === null || raw === '') raw = row.index;
    num = Number(raw);
    if (!Number.isFinite(num)) {
      match = String(raw === undefined || raw === null ? '' : raw).match(/-?\d+/);
      num = match && match[0] ? Number(match[0]) : NaN;
    }
    if (!Number.isFinite(num) || num <= 0) num = Number(fallbackIndex);
    if (!Number.isFinite(num) || num <= 0) return NaN;
    return Math.floor(num);
  }

  function resolveCaseItemIdNumber(item) {
    var row = item && typeof item === 'object' ? item : {};
    var raw = row.id === undefined || row.id === null ? '' : String(row.id).trim();
    var num = NaN;
    if (!raw) return NaN;
    if (!/^[-+]?\d+$/.test(raw)) return NaN;
    num = Number(raw);
    if (!Number.isFinite(num)) return NaN;
    return Math.floor(Math.abs(num));
  }

  function doesCaseNumberMatchParity(num, parity) {
    if (!Number.isFinite(num)) return false;
    if (parity === 'even') return Math.abs(num % 2) === 0;
    if (parity === 'odd') return Math.abs(num % 2) === 1;
    return true;
  }

  function applyCaseListFilter(items, filterInfo) {
    var list = Array.isArray(items) ? items : [];
    var info = filterInfo && typeof filterInfo === 'object' ? filterInfo : {};
    var include = Array.isArray(info.includeKeywords) ? info.includeKeywords : [];
    var exclude = Array.isArray(info.excludeKeywords) ? info.excludeKeywords : [];
    var indexParity = info.indexParity ? String(info.indexParity).trim() : '';
    var idParity = info.idParity ? String(info.idParity).trim() : '';
    if (!include.length && !exclude.length && !indexParity && !idParity) return list.slice();
    return list.filter(function(item, idx) {
      var text = buildCaseItemSearchText(item);
      var i = 0;
      if (indexParity && !doesCaseNumberMatchParity(resolveCaseItemSequenceNumber(item, idx + 1), indexParity)) {
        return false;
      }
      if (idParity && !doesCaseNumberMatchParity(resolveCaseItemIdNumber(item), idParity)) {
        return false;
      }
      if (include.length) {
        var includeHit = false;
        for (i = 0; i < include.length; i += 1) {
          var includeKey = String(include[i] || '').toLowerCase();
          if (includeKey && text.indexOf(includeKey) !== -1) {
            includeHit = true;
            break;
          }
        }
        if (!includeHit) return false;
      }
      for (i = 0; i < exclude.length; i += 1) {
        var excludeKey = String(exclude[i] || '').toLowerCase();
        if (excludeKey && text.indexOf(excludeKey) !== -1) return false;
      }
      return true;
    });
  }


  function formatFilteredEditorCaseListResponse(result, filteredItems, filterInfo) {
    var items = Array.isArray(filteredItems) ? filteredItems : [];
    var sourceItems = Array.isArray(result && result.items) ? result.items : [];
    var total = Number(result && result.total);
    if (!Number.isFinite(total) || total < 0) total = sourceItems.length;
    var lines = [];
    lines.push(buildEditorCaseListTitle(result));
    var filterLabel = buildCaseListFilterLabel(filterInfo);
    if (filterLabel) {
      lines.push('已按条件过滤：' + filterLabel + '，命中 ' + items.length + ' / ' + total + ' 条。');
    } else {
      lines.push('已按条件过滤，命中 ' + items.length + ' / ' + total + ' 条。');
    }
    if (!items.length) {
      lines.push('当前过滤条件下没有匹配条目。');
      lines.push('你可以继续追问：');
      lines.push('1. 放宽条件（例如：只排除标题含“技能”）。');
      lines.push('2. 换更具体关键词（例如：排除“技能效果”，保留“联机”）。');
      return lines.join('\n');
    }
    lines.push('当前页面用例明细（完整字段）：');
    lines.push(buildEditorCaseListTableMarkdown(items, {
      includeExecutionResult: shouldIncludeExecutionResultColumn(result),
    }));
    if (result && result.truncated) {
      lines.push('注：当前仅在前 ' + sourceItems.length + ' 条可见条目中完成筛选。');
    }
    return lines.join('\n');
  }

  function formatFilteredEditorCaseCountResponse(result, filteredItems, filterInfo) {
    var items = Array.isArray(filteredItems) ? filteredItems : [];
    var sourceItems = Array.isArray(result && result.items) ? result.items : [];
    var total = Number(result && result.total);
    if (!Number.isFinite(total) || total < 0) total = sourceItems.length;
    var lines = [];
    lines.push(buildEditorCaseListTitle(result));
    var filterLabel = buildCaseListFilterLabel(filterInfo);
    if (filterLabel) {
      lines.push('已按条件过滤：' + filterLabel + '。');
    }
    lines.push('当前页面用例数量：' + items.length + ' 条（命中 ' + items.length + ' / ' + total + '）。');
    if (!items.length) {
      lines.push('当前过滤条件下没有匹配条目。');
    }
    return lines.join('\n');
  }

  function formatEditorCaseListResponse(result) {
    var items = Array.isArray(result.items) ? result.items : [];
    var searchText = result.searchText ? String(result.searchText).trim() : '';
    var total = Number(result.total);
    if (!Number.isFinite(total) || total < 0) total = items.length;
    var totalAll = Number(result.totalAll);
    if (!Number.isFinite(totalAll) || totalAll < 0) totalAll = total;
    var lines = [];
    lines.push(buildEditorCaseListTitle(result));
    if (!items.length) {
      if (searchText) {
        lines.push('当前搜索词“' + searchText + '”下没有匹配条目。');
        lines.push('当前用例总条目：' + totalAll + '。');
      } else {
        lines.push('当前用例暂无条目。');
      }
      return lines.join('\n');
    }
    if (searchText) {
      lines.push('已按搜索词“' + searchText + '”过滤，命中 ' + total + ' / ' + totalAll + ' 条：');
    } else {
      lines.push('当前页面用例明细（完整字段）：');
    }
    lines.push(buildEditorCaseListTableMarkdown(items, {
      includeExecutionResult: shouldIncludeExecutionResultColumn(result),
    }));
    if (result.truncated) {
      lines.push('已展示前 ' + items.length + ' 条，共 ' + (Number(result.total) || items.length) + ' 条。');
    }
    return lines.join('\n');
  }

  function formatNoEditorCaseContextResponse(result) {
    var projectId = result && result.projectId ? String(result.projectId) : '';
    var lines = [
      '当前页面没有正在编辑或查看的用例。',
      '你可以按下面步骤继续：',
      '1. 进入“用例库 -> 查看&编辑”，打开一个用例文件。',
    ];
    if (projectId) {
      lines.push('2. 或直接问我：“当前项目（' + projectId + '）有哪些用例”。');
    } else {
      lines.push('2. 或直接问我：“当前项目有哪些用例”。');
    }
    return lines.join('\n');
  }

  function formatCaseListResponse(res) {
    var result = res && typeof res === 'object' ? res : {};
    var scope = result.scope === undefined || result.scope === null ? '' : String(result.scope).trim();
    if (scope === 'editor' && (!result.caseFile || typeof result.caseFile !== 'object')) {
      return formatNoEditorCaseContextResponse(result);
    }
    if (scope === 'editor' || (result.caseFile && typeof result.caseFile === 'object')) {
      return formatEditorCaseListResponse(result);
    }
    var items = Array.isArray(result.items) ? result.items : [];
    if (!items.length) {
      if (result.projectId) return '当前项目（' + result.projectId + '）还没有用例。';
      return '当前还没有可查询的用例。';
    }
    var lines = [];
    lines.push(result.projectId ? ('当前项目（' + result.projectId + '）用例列表：') : '当前用例列表：');
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i] && typeof items[i] === 'object' ? items[i] : {};
      var name = item.name ? String(item.name) : ('用例#' + (item.id || (i + 1)));
      var itemCount = Number(item.itemCount);
      if (!Number.isFinite(itemCount) || itemCount < 0) itemCount = 0;
      var updated = formatCaseListTime(item.updatedAt || '');
      lines.push((i + 1) + '. ID: ' + (item.id || '-') + ' | 名称: ' + name + ' | 条目: ' + itemCount + ' | 更新: ' + updated);
    }
    if (result.truncated) {
      lines.push('已展示前 ' + items.length + ' 条，共 ' + (Number(result.total) || items.length) + ' 条。');
    }
    return lines.join('\n');
  }

  function formatCaseCountResponse(res) {
    var result = res && typeof res === 'object' ? res : {};
    var scope = result.scope === undefined || result.scope === null ? '' : String(result.scope).trim();
    if (scope === 'editor' && (!result.caseFile || typeof result.caseFile !== 'object')) {
      return formatNoEditorCaseContextResponse(result);
    }
    if (scope === 'editor' || (result.caseFile && typeof result.caseFile === 'object')) {
      var total = Number(result.total);
      var totalAll = Number(result.totalAll);
      var items = Array.isArray(result.items) ? result.items : [];
      if (!Number.isFinite(total) || total < 0) total = items.length;
      if (!Number.isFinite(totalAll) || totalAll < 0) totalAll = total;
      var lines = [];
      lines.push(buildEditorCaseListTitle(result));
      if (result.searchText) {
        var searchText = String(result.searchText || '').trim();
        lines.push('当前搜索词“' + searchText + '”命中 ' + total + ' / ' + totalAll + ' 条。');
      }
      lines.push('当前页面用例数量：' + total + ' 条。');
      return lines.join('\n');
    }
    var projectTotal = Number(result.total);
    if (!Number.isFinite(projectTotal) || projectTotal < 0) {
      var projectItems = Array.isArray(result.items) ? result.items : [];
      projectTotal = projectItems.length;
    }
    if (result.projectId) {
      return '当前项目（' + result.projectId + '）用例数量：' + projectTotal + ' 份用例文件。';
    }
    return '当前用例数量：' + projectTotal + ' 份用例文件。';
  }

  function normalizeCaseDetailLookupText(value) {
    return String(value || '').toLowerCase()
      .replace(/[\s　"'“”‘’《》【】（）()\[\]{}:：,，.。!！?？、;；]/g, '');
  }

  function extractCaseDetailIdCandidates(text) {
    var raw = String(text || '').trim();
    if (!raw) return [];
    var ids = [];
    raw.replace(/(?:^|[^a-zA-Z0-9])(?:id|ID)\s*[:：#]?\s*(\d{1,10})/g, function(_, id) {
      if (ids.indexOf(String(id)) === -1) ids.push(String(id));
      return _;
    });
    return ids;
  }

  function matchCaseItemsFromReferenceText(items, text) {
    var list = Array.isArray(items) ? items : [];
    var raw = String(text || '').trim();
    if (!raw || !list.length) return [];
    var ids = extractCaseDetailIdCandidates(raw);
    if (ids.length) {
      var byId = list.filter(function(item) {
        var row = item && typeof item === 'object' ? item : {};
        var id = row.id === undefined || row.id === null ? '' : String(row.id).trim();
        return Boolean(id && ids.indexOf(id) !== -1);
      });
      if (byId.length) return byId;
    }
    var normalizedText = normalizeCaseDetailLookupText(raw);
    if (!normalizedText) return [];
    return list.filter(function(item) {
      var row = item && typeof item === 'object' ? item : {};
      var title = normalizeCaseDetailLookupText(row.title || '');
      var moduleTitle = normalizeCaseDetailLookupText((row.module || '') + (row.title || ''));
      if (!title) return false;
      if (normalizedText.indexOf(title) !== -1) return true;
      if (moduleTitle && normalizedText.indexOf(moduleTitle) !== -1) return true;
      return false;
    });
  }

  function shouldRequireSpecificCaseDetailTarget(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (extractCaseDetailIdCandidates(raw).length) return true;
    if (containsAny(raw, ['该用例', '这条', '这一条', '这一个用例', '这个用例', '本用例'])) return true;
    return false;
  }

  function isCaseDetailClarificationIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (isCurrentCaseFullDetailIntent(raw)) return false;
    if (isCurrentPageFunctionIntent(raw)) return false;
    var prevAiText = getLatestAssistantMessageText();
    if (!prevAiText) return false;
    if (!containsAny(prevAiText, ['用例 ID', '用例ID', '完整标题', '完整展开', '完整字段', '当前结果里', '前 20 条', 'truncated=true', '请直接给我用例'])) {
      return false;
    }
    if (raw.length > 80) return false;
    return true;
  }

  function hasDirectCaseDetailReference(result, userText) {
    var data = result && typeof result === 'object' ? result : {};
    var items = Array.isArray(data.items) ? data.items : [];
    var raw = String(userText || '').trim();
    var matched = [];
    if (!raw || !items.length) return false;
    if (extractCaseDetailIdCandidates(raw).length) return true;
    if (containsAny(raw, ['该用例', '当前用例', '这个用例', '本用例', '这条', '这一条', '这一个用例'])) return true;
    matched = matchCaseItemsFromReferenceText(items, raw);
    return matched.length === 1;
  }

  function resolveRequestedCaseDetailTarget(result, userText, options) {
    var data = result && typeof result === 'object' ? result : {};
    var items = Array.isArray(data.items) ? data.items : [];
    var opts = options && typeof options === 'object' ? options : {};
    var texts = [];
    var currentText = String(userText || '').trim();
    if (!items.length) return null;
    if (items.length === 1 && Number(data.total) === 1) {
      return { item: Object.assign({}, items[0]), reason: 'single-item' };
    }
    if (currentText) texts.push(currentText);
    if (opts.includeConversationContext === true) {
      var prevUserText = getPreviousUserMessageText(currentText);
      if (prevUserText) texts.push(prevUserText);
      var prevAiText = getLatestAssistantMessageText();
      if (prevAiText) texts.push(prevAiText);
    }
    for (var i = 0; i < texts.length; i += 1) {
      var matched = matchCaseItemsFromReferenceText(items, texts[i]);
      if (matched.length === 1) {
        return { item: Object.assign({}, matched[0]), reason: i === 0 ? 'current-text' : (i === 1 ? 'previous-user' : 'previous-ai') };
      }
    }
    return null;
  }

  function buildCaseDetailTargetMissingText(result, userText) {
    var data = result && typeof result === 'object' ? result : {};
    var lines = [];
    lines.push(buildEditorCaseListTitle(data));
    var total = Number(data.total);
    if (!Number.isFinite(total) || total < 0) total = Array.isArray(data.items) ? data.items.length : 0;
    var raw = String(userText || '').trim();
    var ids = extractCaseDetailIdCandidates(raw);
    var label = '';
    if (ids.length) label = 'ID ' + ids[0];
    if (!label) {
      var normalizedText = normalizeCaseDetailLookupText(raw);
      var items = Array.isArray(data.items) ? data.items : [];
      for (var i = 0; i < items.length; i += 1) {
        var row = items[i] && typeof items[i] === 'object' ? items[i] : {};
        var title = row.title ? String(row.title).trim() : '';
        if (!title) continue;
        if (normalizedText && normalizedText.indexOf(normalizeCaseDetailLookupText(title)) !== -1) {
          label = '标题“' + title + '”';
          break;
        }
      }
    }
    if (!label && raw) label = '“' + raw + '”';
    lines.push('已按当前这份用例的完整条目范围检索' + (label ? ('：' + label) : '') + '。');
    lines.push('当前同份用例共 ' + total + ' 条，但没有命中目标条目。');
    lines.push('你可以继续直接发我：1. 用例 ID。2. 完整标题。');
    return lines.join('\n');
  }

  async function tryHandleCaseDetailClarificationIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    if (!isCaseDetailClarificationIntent(raw)) return null;
    return runModelCaseListAction(raw, {
      action: 'query_case_list',
      query: raw,
      pageScoped: true,
      scope: 'editor',
      detailLevel: 'full',
      limit: 1000,
    }, '');
  }

  async function tryHandleCurrentCaseFullDetailIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    if (!isCurrentCaseFullDetailIntent(raw)) return null;
    return runModelCaseListAction(raw, {
      action: 'query_case_list',
      query: raw,
      pageScoped: true,
      scope: 'editor',
      detailLevel: 'full',
      limit: 1000,
    }, '');
  }

  async function tryHandleCaseListIntent(text, options) {
    var raw = String(text || '').trim();
    var opts = options && typeof options === 'object' ? options : {};
    if (!raw) return null;
    if (!opts.force && !isCaseListIntent(raw)) return null;
    var countOnly = isCaseCountIntent(raw);
    var filterInfo = extractCaseListFilterInfo(raw);
    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.listCurrentCases !== 'function') {
      return '当前环境不支持读取用例列表。';
    }
    setStatus('正在获取用例列表...');
    var res = null;
    var pageScoped = opts.pageScoped === true || (opts.pageScoped !== false && (isCurrentPageCaseIntent(raw) || shouldPreferCurrentPageScopeForCaseQuery(raw)));
    var queryLimit = filterInfo && filterInfo.hasFilter ? 1000 : 20;
    try {
      res = await apis.assistantApi.listCurrentCases({
        limit: queryLimit,
        scope: pageScoped ? 'editor' : 'project',
        requireEditor: pageScoped,
      });
    } catch (err) {
      res = { ok: false, reason: err && err.message ? String(err.message) : '读取异常' };
    }
    if (!res || res.ok !== true) {
      setStatus('用例列表获取失败');
      return '获取用例列表失败：' + (res && res.reason ? res.reason : '未知错误');
    }
    setStatus('');
    if (filterInfo && filterInfo.hasFilter) {
      var scope = res && res.scope ? String(res.scope) : '';
      if (scope === 'editor' || (res && res.caseFile && typeof res.caseFile === 'object')) {
        var sourceItems = Array.isArray(res.items) ? res.items : [];
        var filteredItems = applyCaseListFilter(sourceItems, filterInfo);
        if (countOnly) {
          return formatFilteredEditorCaseCountResponse(res, filteredItems, filterInfo);
        }
        return formatFilteredEditorCaseListResponse(res, filteredItems, filterInfo);
      }
      return '该问题包含条件筛选，但当前结果仅有项目级用例文件列表。请先打开具体用例后再问我。';
    }
    if (countOnly) {
      return formatCaseCountResponse(res);
    }
    return formatCaseListResponse(res);
  }

  function getSafePageDataSnapshot(tabName) {
    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.getPageData !== 'function') return {};
    try {
      return apis.assistantApi.getPageData(tabName || '') || {};
    } catch (err) {
      return {};
    }
  }

  async function finalizeRouteReplyByModel(userText, routeName, fallbackText, routeData, options) {
    var fallback = fallbackText === undefined || fallbackText === null ? '' : String(fallbackText).trim();
    var name = routeName === undefined || routeName === null ? '' : String(routeName).trim();
    var data = routeData && typeof routeData === 'object' ? routeData : {};
    var opts = options && typeof options === 'object' ? options : {};
    var apis = getApis();
    var payload = null;
    var prompt = '';
    var history = null;
    var res = null;
    var text = '';
    var scaffoldText = '';
    if (!fallback) return '';
    if (opts.skipModel === true) return fallback;
    if (!apis.assistantApi || typeof apis.assistantApi.callModel !== 'function') return fallback;
    payload = {
      userQuestion: String(userText || ''),
      routeName: name,
      routeData: data,
      fallbackText: fallback,
    };
    prompt = [
      '你是测试助手平台的最终回答整理助手。',
      '系统已经完成意图识别，并提供了可靠的路由结果与兜底文本。',
      '请基于用户问题、路由结果和兜底文本，给出最终回答。',
      '回答规则：',
      '- 优先保留已有事实，不要编造，不要忽略路由结果。',
      '- 是否使用列表、表格、说明段落，由你自行判断。',
      '- 若平台已有合适展示手脚架，可直接输出单个 MCP JSON 调用 assistant.render_scaffold；若没有必要就直接自然语言/Markdown 回答。',
      '- 不要重复输出同一份列表、表格或结论。',
      '- 不要把页面功能介绍误判成用例检索，也不要要求用户补充无关的用例 ID 或完整标题。',
      '- 对写操作类结果，只能复述已执行/已确认的结果，不能假装再次执行。',
      '- 如果兜底文本已经足够清晰，可以直接沿用或轻微润色。',
      '- 输出中文自然语言，可用 Markdown；若输出 JSON，必须只输出一个 JSON 对象。',
    ].join('\n');
    history = buildConversationHistory(6, userText);
    try {
      res = await apis.assistantApi.callModel(JSON.stringify(payload, null, 2), {
        prompt: prompt,
        temperature: 0.1,
        history: history,
      });
    } catch (err) {
      res = { ok: false, reason: err && err.message ? String(err.message) : '最终整理异常' };
    }
    if (!res || res.ok !== true || !res.content) return fallback;
    text = String(res.content || '').trim();
    if (!text) return fallback;
    scaffoldText = await tryExecuteSummaryScaffoldReply(userText, text, '', {}, data, fallback);
    if (scaffoldText) return scaffoldText;
    if (parseJsonObjectFromText(text)) return fallback;
    return text;
  }

  function buildCurrentPageFunctionFallbackText(pageData) {
    var data = pageData && typeof pageData === 'object' ? pageData : {};
    var tab = data.tab ? String(data.tab) : '';
    var tabLabel = getTabLabelById(tab);
    var hints = getTabOperationHints(tab);
    var fileName = getPageFileName();
    var lines = [];
    var currentCaseContext = data.currentCaseContext && typeof data.currentCaseContext === 'object'
      ? data.currentCaseContext
      : null;
    if (tabLabel && tab) lines.push('当前页面是“' + tabLabel + '”（' + tab + '）。');
    else if (tabLabel) lines.push('当前页面是“' + tabLabel + '”。');
    else if (tab) lines.push('当前页面标识：' + tab + '。');
    else lines.push('当前页面信息暂不可用。');
    if (fileName) lines.push('页面文件：' + fileName + '。');
    if (Array.isArray(hints) && hints.length) {
      lines.push('这个页面主要支持：');
      for (var i = 0; i < hints.length; i += 1) {
        lines.push((i + 1) + '. ' + hints[i]);
      }
    }
    if (currentCaseContext && currentCaseContext.fileName) {
      var contextLine = currentCaseContext.contextSource === 'tempexec' ? '当前正在查看执行用例：' : '当前正在编辑用例：';
      contextLine += '《' + String(currentCaseContext.fileName) + '》';
      if (Number(currentCaseContext.totalAll) > 0) {
        contextLine += '，共 ' + Number(currentCaseContext.totalAll) + ' 条';
      }
      lines.push(contextLine + '。');
    }
    return lines.join('\n');
  }

  async function tryHandleCurrentPageFunctionIntent(text) {
    var raw = String(text || '').trim();
    var pageData = null;
    var fallback = '';
    if (!raw) return null;
    if (!isCurrentPageFunctionIntent(raw)) return null;
    pageData = getSafePageDataSnapshot('');
    fallback = buildCurrentPageFunctionFallbackText(pageData);
    return finalizeRouteReplyByModel(raw, 'current_page_function', fallback, {
      pageData: pageData,
      pageFileName: getPageFileName(),
      operationHints: getTabOperationHints(pageData && pageData.tab ? String(pageData.tab) : ''),
    }, {});
  }

  function tryHandleCurrentPageIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    if (isCurrentPageFunctionIntent(raw)) return null;
    if (isCaseListIntent(raw)) return null;
    if (containsAny(raw, ['用例']) && containsAny(raw, ['有什么', '有啥', '什么', '哪些', '有哪些', '列表', '清单', '多少'])) return null;
    var askCurrentPage = containsAny(raw, [
      '什么页面',
      '哪个页面',
      '当前页面',
      '现在页面',
      '当前页签',
      '现在页签',
      '在哪个页面',
      '在哪个页签',
    ]);
    if (!askCurrentPage) {
      if (!containsAny(raw, ['当前', '现在', '在哪'])) return null;
      if (!containsAny(raw, ['页面', '页签', 'tab'])) return null;
    }
    var apis = getApis();
    var data = null;
    if (apis.assistantApi && typeof apis.assistantApi.getPageData === 'function') {
      data = apis.assistantApi.getPageData('');
    }
    var tab = data && data.tab ? String(data.tab) : '';
    var tabLabel = getTabLabelById(tab);
    var fileName = getPageFileName();
    var askOperations = containsAny(raw, [
      '能做什么',
      '可以做什么',
      '可做什么',
      '有什么操作',
      '能做什么操作',
      '可执行',
      '支持什么',
    ]);
    var lines = [];
    if (tabLabel && tab) {
      lines.push('当前页面是：' + tabLabel + '（' + tab + '）');
    } else if (tabLabel) {
      lines.push('当前页面是：' + tabLabel);
    } else if (tab) {
      lines.push('当前页面是：' + tab);
    } else {
      lines.push('当前页面信息暂不可用。');
    }
    if (fileName) {
      lines.push('页面文件：' + fileName);
    }
    if (askOperations) {
      var hints = getTabOperationHints(tab);
      lines.push('当前页面可执行操作：');
      for (var i = 0; i < hints.length; i += 1) {
        lines.push((i + 1) + '. ' + hints[i]);
      }
    }
    return lines.join('\n');
  }

  function tryHandleNavigationIntent(text) {
    var raw = String(text || '');
    if (!containsAny(raw, ['跳转', '打开', '进入', '前往', '去'])) return null;
    var tab = parseTabFromText(raw);
    if (!tab) return null;
    var apis = getApis();
    if (apis.assistantApi && typeof apis.assistantApi.switchTab === 'function') {
      apis.assistantApi.switchTab(tab);
      return '已跳转到页面：' + tab;
    }
    return '页面跳转能力暂不可用';
  }

  function tryHandleQueryIntent(text) {
    var raw = String(text || '');
    if (!containsAny(raw, ['查看', '查询', '获取', '读取'])) return null;
    if (!containsAny(raw, ['数据', '状态', '信息', '统计'])) return null;
    if (!isProjectScopedText(raw)) return null;
    var tab = parseTabFromText(raw);
    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.getPageData !== 'function') {
      return '页面数据查询能力暂不可用';
    }
    var data = apis.assistantApi.getPageData(tab || '');
    return '页面数据如下：\n' + formatJsonCompact(data);
  }

  async function tryHandleTempExecFileIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    if (!isTempExecNextFileIntent(raw)) return null;
    var snapshot = getTempExecNextFileSnapshot();
    if (!snapshot || snapshot.ok !== true) {
      return snapshot && snapshot.reason ? String(snapshot.reason) : '当前没有执行用例文件。';
    }

    var isCheck = isTempExecNextFileCheckIntent(raw);
    var hasSwitchVerb = containsAny(raw, ['切换', '切到', '跳到', '打开', '前往', '进入', '去', '换到']);
    var shouldSwitch = hasSwitchVerb || !isCheck;
    if (!shouldSwitch) {
      if (!snapshot.hasNext) {
        return '没有下一份执行用例。当前仅有 1 份：' + snapshot.currentName + '。';
      }
      return '有下一份执行用例：' + snapshot.nextName + '（共 ' + snapshot.total + ' 份，当前第 ' + (snapshot.currentIndex + 1) + ' 份）。';
    }

    if (!snapshot.hasNext) {
      return '没有下一份执行用例可切换，当前仅有 1 份：' + snapshot.currentName + '。';
    }

    var apis = getApis();
    if (apis.assistantMcpApi && typeof apis.assistantMcpApi.callTool === 'function') {
      var mcpRes = null;
      try {
        mcpRes = await apis.assistantMcpApi.callTool('tempexec.next_file', {});
      } catch (err) {
        mcpRes = { ok: false, reason: err && err.message ? String(err.message) : '切换异常' };
      }
      if (!mcpRes || mcpRes.ok !== true) {
        return '切换下一份执行用例失败：' + (mcpRes && mcpRes.reason ? String(mcpRes.reason) : '未知错误');
      }
      var data = mcpRes.data && typeof mcpRes.data === 'object' ? mcpRes.data : {};
      var switchedName = data.fileName ? String(data.fileName) : '';
      return '已切换到下一份用例：' + (switchedName || snapshot.nextName || '目标用例');
    }

    var tempApi = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
    if (tempApi && typeof tempApi.setTempExecActive === 'function') {
      try {
        tempApi.setTempExecActive(snapshot.nextId);
      } catch (err2) {
        return '切换下一份执行用例失败：' + (err2 && err2.message ? String(err2.message) : '未知错误');
      }
      return '已切换到下一份用例：' + (snapshot.nextName || '目标用例');
    }

    return '当前页面不支持切换执行用例。';
  }

  async function tryHandleCaseHistoryIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    if (!looksLikeCaseHistoryIntent(raw)) return null;
    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.getPageData !== 'function') {
      return '当前环境不支持读取页面变更内容。';
    }
    var pageData = null;
    try {
      pageData = apis.assistantApi.getPageData('');
    } catch (err) {
      pageData = null;
    }
    var summarized = await summarizeCaseChangePageData(raw, pageData || {}, '');
    if (summarized) return summarized;
    return buildCaseChangeNoContextText(pageData || {});
  }

  function extractMemoText(raw) {
    var text = String(raw || '').trim();
    var match = text.match(/(?:新增|添加|记录|记下)\s*备忘[:：]?\s*(.+)$/);
    if (!match) {
      match = text.match(/备忘(?:新增|添加|记录|记下)?[:：]?\s*(.+)$/);
    }
    if (!match) return '';
    return match[1] ? String(match[1]).trim() : '';
  }

  function toPositiveInt(value, fallback) {
    var num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      num = Number(fallback);
    }
    if (!Number.isFinite(num) || num <= 0) num = 1;
    return Math.max(1, Math.floor(num));
  }

  function formatMemoListText(tabs) {
    var list = Array.isArray(tabs) ? tabs : [];
    if (!list.length) return '当前没有备忘内容。';
    var lines = [];
    list.forEach(function(tab) {
      var section = tab && typeof tab === 'object' ? tab : {};
      var prefix = section.isActive ? '[当前页签]' : '[页签]';
      lines.push(prefix + (section.name || '未命名'));
      var items = Array.isArray(section.items) ? section.items : [];
      items.forEach(function(item) {
        var row = item && typeof item === 'object' ? item : {};
        var mark = row.done ? '已完成' : '待办';
        lines.push('  ' + (row.index || 1) + '. (' + mark + ') ' + (row.text || ''));
      });
    });
    return lines.join('\n');
  }

  function getMutationActionLabel(actionName, meta) {
    var action = String(actionName || '').trim();
    var payload = meta && typeof meta === 'object' ? meta : {};
    if (action === 'memo_add') return '新增备忘';
    if (action === 'memo_toggle') return '更新备忘完成状态';
    if (action === 'memo_remove') return '删除备忘';
    if (action === 'settings_patch') return '修改设置';
    if (action === 'update_case' || action === 'case.update' || action === 'case_update') return '修改用例';
    if (action === 'run_case_generation') return '触发用例生成';
    if (action === 'run_missing_recommendation') return '触发漏测推荐';
    if (action === 'delete_case') {
      var idx = toPositiveInt(payload.index, 1);
      return '删除第 ' + idx + ' 条用例';
    }
    return '执行写操作';
  }

  async function requireDoubleConfirmForAction(actionName, meta) {
    var action = String(actionName || '').trim();
    if (!action) return true;
    var label = getMutationActionLabel(action, meta);
    return requestAssistantOperationApproval(label, {
      reason: '当前请求涉及数据写入或状态变更。',
    });
  }

  async function tryHandleMemoIntent(text) {
    var raw = String(text || '').trim();
    if (raw.indexOf('备忘') === -1) return null;
    var apis = getApis();
    if (!apis.assistantApi) return '备忘能力暂不可用';

    if (containsAny(raw, ['查看', '列表', '列出'])) {
      if (typeof apis.assistantApi.memoList !== 'function') return '备忘能力暂不可用';
      return formatMemoListText(apis.assistantApi.memoList() || []);
    }

    if (containsAny(raw, ['完成', '勾选']) && /\d+/.test(raw)) {
      if (typeof apis.assistantApi.memoToggle !== 'function') return '备忘能力暂不可用';
      var doneIndex = Number((raw.match(/\d+/) || [0])[0]);
      if (!await requireDoubleConfirmForAction('memo_toggle', { index: doneIndex })) return '已取消。';
      var doneRes = apis.assistantApi.memoToggle('', doneIndex, true);
      return doneRes && doneRes.ok ? ('已将备忘第 ' + doneIndex + ' 条标记为完成。') : (doneRes.reason || '标记失败');
    }

    if (containsAny(raw, ['删除', '移除']) && /\d+/.test(raw)) {
      if (typeof apis.assistantApi.memoRemove !== 'function') return '备忘能力暂不可用';
      var removeIndex = Number((raw.match(/\d+/) || [0])[0]);
      if (!await requireDoubleConfirmForAction('memo_remove', { index: removeIndex })) return '已取消。';
      var removeRes = apis.assistantApi.memoRemove('', removeIndex);
      return removeRes && removeRes.ok ? ('已删除第 ' + removeIndex + ' 条备忘。') : (removeRes.reason || '删除失败');
    }

    if (containsAny(raw, ['新增', '添加', '记录', '记下'])) {
      if (typeof apis.assistantApi.memoAdd !== 'function') return '备忘能力暂不可用';
      var content = extractMemoText(raw);
      if (!content) return '请在“新增备忘”后补充具体内容。';
      if (!await requireDoubleConfirmForAction('memo_add', { text: content })) return '已取消。';
      var addRes = apis.assistantApi.memoAdd(content, '');
      return addRes && addRes.ok ? ('已新增备忘：' + content) : (addRes.reason || '新增失败');
    }

    return '你可以让我：新增备忘、列出备忘、完成备忘、删除备忘。';
  }

  function normalizeCaseUpdateFieldName(rawField) {
    var text = rawField === undefined || rawField === null ? '' : String(rawField).trim().toLowerCase();
    text = text.replace(/\s+/g, '');
    if (!text) return '';
    if (text === 'priority' || text === 'level' || text === '优先级') return 'priority';
    if (text === 'module' || text === '模块') return 'module';
    if (text === 'title' || text === 'name' || text === '标题' || text === '用例标题') return 'title';
    if (text === 'precondition' || text === 'preconditions' || text === '前置条件' || text === '前提条件' || text === '前置') return 'precondition';
    if (text === 'steps' || text === 'step' || text === '步骤' || text === '操作步骤') return 'steps';
    if (text === 'expected' || text === 'expect' || text === '预期' || text === '预期结果') return 'expected';
    if (text === 'remark' || text === 'remarks' || text === 'note' || text === 'comment' || text === '备注') return 'remark';
    if (text === 'actual' || text === 'result' || text === 'status' || text === '执行结果' || text === '状态') return 'actual';
    return '';
  }

  function getCaseUpdateFieldAliases(rawField) {
    var field = normalizeCaseUpdateFieldName(rawField);
    if (!field) return [];
    if (field === 'priority') return ['优先级', 'priority', 'level'];
    if (field === 'module') return ['模块', 'module'];
    if (field === 'title') return ['标题', '用例标题', 'title', 'name'];
    if (field === 'precondition') return ['前置条件', '前提条件', '前置', 'precondition', 'preconditions'];
    if (field === 'steps') return ['步骤', '操作步骤', 'steps'];
    if (field === 'expected') return ['预期结果', '预期', 'expected'];
    if (field === 'remark') return ['备注', 'remark', 'note', 'comment'];
    if (field === 'actual') return ['执行结果', '状态', 'actual', 'result', 'status'];
    return [];
  }

  function isCaseUpdateClearableField(rawField) {
    var field = normalizeCaseUpdateFieldName(rawField);
    return field === 'module'
      || field === 'title'
      || field === 'precondition'
      || field === 'preconditions'
      || field === 'steps'
      || field === 'expected'
      || field === 'remark';
  }

  function detectCaseUpdateClearIntent(raw, field) {
    var text = String(raw || '');
    if (!text) return false;
    if (!/(?:清空|清除|移除|删除|去掉|取消|置空)/.test(text)) return false;
    var aliases = getCaseUpdateFieldAliases(field);
    if (!aliases.length) return false;
    for (var i = 0; i < aliases.length; i += 1) {
      var alias = String(aliases[i] || '');
      if (alias && text.toLowerCase().indexOf(alias.toLowerCase()) !== -1) return true;
    }
    return false;
  }

  function normalizeCaseActualValueToken(rawValue) {
    var raw = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
    if (!raw) return '';
    var compact = raw.toLowerCase().replace(/\s+/g, '');
    var map = {
      '未执行': '未执行',
      '待执行': '未执行',
      'pending': '未执行',
      'notrun': '未执行',
      '未测': '未执行',
      '通过': '通过',
      '成功': '通过',
      'pass': '通过',
      'passed': '通过',
      'ok': '通过',
      '失败': '失败',
      '不通过': '失败',
      'fail': '失败',
      'failed': '失败',
      'error': '失败',
      '阻塞': '阻塞',
      'blocked': '阻塞',
      'block': '阻塞',
      '不适用': '不适用',
      'na': '不适用',
      'n/a': '不适用',
      'skip': '不适用',
      'skipped': '不适用',
      '变更重跑': '变更重跑',
      '有改动': '有改动',
    };
    if (Object.prototype.hasOwnProperty.call(map, compact)) return map[compact];
    return '';
  }

  function detectCaseUpdateFieldFromText(raw) {
    var text = String(raw || '');
    var map = [
      { keys: ['优先级', 'priority', 'level'], field: 'priority' },
      { keys: ['模块', 'module'], field: 'module' },
      { keys: ['标题', '用例标题', 'title', 'name'], field: 'title' },
      { keys: ['前置条件', '前提条件', '前置', 'precondition', 'preconditions'], field: 'precondition' },
      { keys: ['步骤', '操作步骤', 'steps'], field: 'steps' },
      { keys: ['预期结果', '预期', 'expected'], field: 'expected' },
      { keys: ['执行结果', '状态', 'actual', 'result', 'status'], field: 'actual' },
      { keys: ['备注', 'remark', 'note', 'comment'], field: 'remark' },
    ];
    for (var i = 0; i < map.length; i += 1) {
      var item = map[i];
      for (var j = 0; j < item.keys.length; j += 1) {
        var key = item.keys[j];
        if (String(text).toLowerCase().indexOf(String(key).toLowerCase()) !== -1) return item.field;
      }
    }
    return '';
  }

  function extractCaseUpdateTargetIndex(raw) {
    var text = String(raw || '');
    var m = text.match(/第\s*(\d+)\s*条/);
    if (!m) return 0;
    var n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.floor(n);
  }

  function stripWrappedQuotes(text) {
    var value = String(text || '').trim();
    if (!value) return '';
    value = value.replace(/^[“"'`]+/, '').replace(/[”"'`]+$/, '').trim();
    return value;
  }

  function escapeRegexToken(raw) {
    var text = raw === undefined || raw === null ? '' : String(raw);
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function extractCaseUpdateValue(raw, field) {
    var text = String(raw || '').trim();
    var normalizedField = normalizeCaseUpdateFieldName(field);
    if (!text || !normalizedField) return '';
    if (normalizedField === 'priority') {
      var pm = text.match(/优先级\s*(?:改成|修改为|改为|设为|设成|设置为|更新为|更新成|调成|调为|调整为|调整成|变为|变成|改到|切到|为|是)\s*([Pp]\s*\d{1,2})/i);
      if (!pm) pm = text.match(/\b([Pp]\s*\d{1,2})\b/i);
      if (pm && pm[1]) {
        var pn = String(pm[1]).toUpperCase().replace(/[^P0-9]/g, '');
        if (/^P[0-9]{1,2}$/.test(pn)) return pn;
      }
    }
    if (normalizedField === 'actual') {
      var am = text.match(/(?:执行结果|状态)\s*(?:改成|修改为|改为|设为|设成|设置为|更新为|更新成|变回|变为|变成|切到|调成|调为|调整为|调整成|为|是)\s*(未执行|通过|失败|阻塞|不适用|变更重跑|有改动|pending|pass(?:ed)?|fail(?:ed)?|blocked?|na|n\/a|skip(?:ped)?)/i);
      if (!am) am = text.match(/(?:变回|变成|变为|设为|设成|改为|改成|调整为|调整成|更新为|更新成|切到)\s*(未执行|通过|失败|阻塞|不适用|变更重跑|有改动|pending|pass(?:ed)?|fail(?:ed)?|blocked?|na|n\/a|skip(?:ped)?)(?:状态|结果)?/i);
      if (!am) am = text.match(/\b(未执行|通过|失败|阻塞|不适用|变更重跑|有改动|pending|pass(?:ed)?|fail(?:ed)?|blocked?|na|n\/a|skip(?:ped)?)\b/i);
      if (am && am[1]) {
        var actualValue = normalizeCaseActualValueToken(am[1]);
        if (actualValue) return actualValue;
      }
    }
    var connector = text.match(/(?:改成|修改为|改为|设为|设成|设置为|更新为|更新成|改到|调成|调为|调整为|调整成|变为|变成|切到|为|是)\s*([^\n。；;，,]+)$/);
    if (connector && connector[1]) {
      var candidate = stripWrappedQuotes(connector[1]);
      if (normalizedField === 'priority') {
        var p = candidate.toUpperCase().replace(/[^P0-9]/g, '');
        if (/^P[0-9]{1,2}$/.test(p)) return p;
      } else if (candidate) {
        return candidate;
      }
    }
    var appendConnector = text.match(/(?:拼接上|拼接成|拼接为|拼接|追加上|追加成|追加为|追加|后缀加上|后缀加|后面加上|后面加|前缀加上|前缀加|前面加上|前面加|开头加上|开头加|末尾加上|末尾加|结尾加上|结尾加)\s*([^\n。；;，,]+)$/);
    if (appendConnector && appendConnector[1]) {
      var appendValue = stripWrappedQuotes(appendConnector[1]);
      if (appendValue) return appendValue;
    }
    var fieldAliases = getCaseUpdateFieldAliases(normalizedField);
    if (fieldAliases.length) {
      var escapedAliases = [];
      for (var i = 0; i < fieldAliases.length; i += 1) {
        escapedAliases.push(escapeRegexToken(fieldAliases[i]));
      }
      var aliasGroup = escapedAliases.join('|');
      if (aliasGroup) {
        var fieldAnchored = text.match(new RegExp(
          '(?:^|\\s|，|,|。|；|;|并且|而且|然后|再|同时|另外|顺便)(?:把|将)?\\s*(?:' + aliasGroup + ')(?:这一栏|这栏|字段|栏位|列|项|上|里|中)?\\s*(?:[:：]|[，,]|是|为|写成|写为|写|填成|填为|填|加上|加|追加|补充|改成|改为|设为|设成|更新为|更新成)?\\s*([^\\n。；;]+)$',
          'i'
        ));
        if (fieldAnchored && fieldAnchored[1]) {
          var anchoredValue = stripWrappedQuotes(fieldAnchored[1]);
          anchoredValue = anchoredValue.replace(/^(?:是|为|写成|写为|写|填成|填为|填|加上|加|追加|补充|改成|改为|设为|设成|更新为|更新成)\s*/i, '').trim();
          if (normalizedField === 'priority') {
            var p2 = anchoredValue.toUpperCase().replace(/[^P0-9]/g, '');
            if (/^P[0-9]{1,2}$/.test(p2)) return p2;
          } else if (anchoredValue) {
            return anchoredValue;
          }
        }
      }
    }
    if (normalizedField === 'actual') {
      var compactActual = normalizeCaseActualValueToken(text);
      if (compactActual) return compactActual;
    }
    var quoted = text.match(/[“"']([^“”"']+)[”"']/);
    if (quoted && quoted[1]) return String(quoted[1]).trim();
    return '';
  }

  function detectCaseUpdateOperationFromText(raw) {
    var text = String(raw || '');
    if (!text) return 'replace';
    if (containsAny(text, ['拼接', '追加', '后缀', '后面加', '后面拼', '末尾加', '结尾加', '尾部加'])) return 'append';
    if (containsAny(text, ['前缀', '前面加', '前面拼', '开头加', '头部加'])) return 'prepend';
    return 'replace';
  }

  function detectCaseUpdateScopeFromText(raw) {
    var text = String(raw || '');
    if (!text) return '';
    if (containsAny(text, ['全部用例', '所有用例', '全部条目', '所有条目', '全部记录', '所有记录', '全量用例', '全部都'])) return 'all';
    if (containsAny(text, ['全部', '所有', '全都']) && containsAny(text, ['用例', '条目', '记录'])) return 'all';
    if (/(?:把|将).*(?:都改|都设|都更新|全改|全设|全部改|全部设)/.test(text)) return 'all';
    return '';
  }

  function parseCaseUpdateCommand(raw) {
    var text = String(raw || '').trim();
    if (!text) return null;
    if (!containsAny(text, ['改成', '修改为', '改为', '设为', '设成', '设置为', '更新为', '更新成', '修改', '编辑', '调成', '调为', '调整为', '调整成', '变为', '变成', '变回', '改到', '切到', '拼接', '追加', '后缀', '前缀', '后面加', '前面加', '开头加', '末尾加', '结尾加', '清空', '清除', '删除', '移除', '去掉', '置空'])) return null;
    var field = detectCaseUpdateFieldFromText(text);
    if (!field) return null;
    var hasCaseContextWord = containsAny(text, ['用例', '该用例', '当前用例', '这条', '当前行', '本条']);
    if (!hasCaseContextWord) {
      var apis = getApis();
      var tab = '';
      if (apis.assistantApi && typeof apis.assistantApi.getPageData === 'function') {
        var pageData = apis.assistantApi.getPageData('');
        tab = pageData && pageData.tab ? String(pageData.tab) : '';
      }
      if (tab !== 'case-library' && tab !== 'tempexec') return null;
    }
    var clearIntent = detectCaseUpdateClearIntent(text, field) && isCaseUpdateClearableField(field);
    var value = extractCaseUpdateValue(text, field);
    if (!value && !clearIntent) return null;
    var index = extractCaseUpdateTargetIndex(text);
    var operation = detectCaseUpdateOperationFromText(text);
    var scope = detectCaseUpdateScopeFromText(text);
    if (index > 0) scope = 'single';
    return {
      field: field,
      value: value,
      index: index,
      operation: operation,
      scope: scope || 'single',
      clear: clearIntent === true,
    };
  }

  function inferCaseUpdateArgsFromText(baseArgs, rawText) {
    var args = baseArgs && typeof baseArgs === 'object' ? Object.assign({}, baseArgs) : {};
    var raw = String(rawText || '');
    var fieldRaw = '';
    if (args.field !== undefined && args.field !== null) fieldRaw = String(args.field);
    if (!fieldRaw && args.key !== undefined && args.key !== null) fieldRaw = String(args.key);
    if (!fieldRaw && args.column !== undefined && args.column !== null) fieldRaw = String(args.column);
    if (!fieldRaw && args.name !== undefined && args.name !== null) fieldRaw = String(args.name);
    var field = normalizeCaseUpdateFieldName(fieldRaw);
    if (!field) field = detectCaseUpdateFieldFromText(raw);
    if (field) args.field = field;
    var clearIntent = field && detectCaseUpdateClearIntent(raw, field) && isCaseUpdateClearableField(field);
    if (!clearIntent && field && isCaseUpdateClearableField(field) && (args.clear === true || String(args.mode || '').toLowerCase() === 'clear')) {
      clearIntent = true;
    }

    var valueRaw = args.value;
    if ((valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') && args.to !== undefined && args.to !== null) valueRaw = args.to;
    if ((valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') && args.text !== undefined && args.text !== null) valueRaw = args.text;
    if ((valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') && args.content !== undefined && args.content !== null) valueRaw = args.content;
    if ((valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') && args.newValue !== undefined && args.newValue !== null) valueRaw = args.newValue;
    if ((valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') && field) {
      valueRaw = extractCaseUpdateValue(raw, field);
    }
    if (valueRaw !== undefined && valueRaw !== null && String(valueRaw).trim() !== '') {
      args.value = String(valueRaw).trim();
    } else if (clearIntent) {
      args.value = '';
      args.clear = true;
    }

    var index = extractCaseUpdateTargetIndex(raw);
    var indexRaw = args.index;
    if ((indexRaw === undefined || indexRaw === null) && args.itemIndex !== undefined && args.itemIndex !== null) indexRaw = args.itemIndex;
    if ((indexRaw === undefined || indexRaw === null) && args.seq !== undefined && args.seq !== null) indexRaw = args.seq;
    var hasIndex = Number(indexRaw);
    if ((!Number.isFinite(hasIndex) || hasIndex <= 0) && index > 0) {
      args.index = index;
    }

    var scopeRaw = '';
    if (args.scope !== undefined && args.scope !== null) scopeRaw = String(args.scope).trim().toLowerCase();
    if (!scopeRaw && args.target !== undefined && args.target !== null) scopeRaw = String(args.target).trim().toLowerCase();
    if (!scopeRaw && args.range !== undefined && args.range !== null) scopeRaw = String(args.range).trim().toLowerCase();
    if (!scopeRaw && (args.all === true || args.applyAll === true || args.batch === true)) scopeRaw = 'all';
    if (scopeRaw !== 'all' && scopeRaw !== 'single') {
      scopeRaw = detectCaseUpdateScopeFromText(raw) || '';
    }
    if (Number.isFinite(hasIndex) && hasIndex > 0) scopeRaw = 'single';
    if (scopeRaw === 'all') {
      args.scope = 'all';
      if (Object.prototype.hasOwnProperty.call(args, 'index')) delete args.index;
    } else if (scopeRaw === 'single') {
      args.scope = 'single';
    }

    var operationRaw = '';
    if (args.operation !== undefined && args.operation !== null) operationRaw = String(args.operation).trim().toLowerCase();
    if (!operationRaw && args.mode !== undefined && args.mode !== null) operationRaw = String(args.mode).trim().toLowerCase();
    if (!operationRaw && args.action !== undefined && args.action !== null) operationRaw = String(args.action).trim().toLowerCase();
    if (operationRaw !== 'append' && operationRaw !== 'prepend' && operationRaw !== 'replace') {
      operationRaw = detectCaseUpdateOperationFromText(raw);
    }
    if (operationRaw === 'append' || operationRaw === 'prepend' || operationRaw === 'replace') {
      args.operation = operationRaw;
    }

    return args;
  }

  function normalizeCaseUpdateOperationFromArgs(args) {
    var payload = args && typeof args === 'object' ? args : {};
    var raw = '';
    if (payload.operation !== undefined && payload.operation !== null) raw = String(payload.operation).trim().toLowerCase();
    if (!raw && payload.mode !== undefined && payload.mode !== null) raw = String(payload.mode).trim().toLowerCase();
    if (!raw && payload.action !== undefined && payload.action !== null) raw = String(payload.action).trim().toLowerCase();
    if (raw === 'append' || raw === 'prepend' || raw === 'replace') return raw;
    return '';
  }

  function rewriteUiFillAsCaseUpdateIfNeeded(tool, args, userText) {
    if (tool !== 'ui.fill_input') return { tool: tool, args: args, rewritten: false };
    var source = args && typeof args === 'object' ? Object.assign({}, args) : {};
    var parsed = parseCaseUpdateCommand(userText);
    var candidate = {};

    if (parsed && parsed.field) candidate.field = parsed.field;
    if (parsed && parsed.value !== undefined && parsed.value !== null && String(parsed.value).trim() !== '') {
      candidate.value = String(parsed.value).trim();
    }
    if (parsed && parsed.clear === true) candidate.clear = true;
    if (parsed && Number(parsed.index) > 0) candidate.index = Number(parsed.index);
    if (parsed && parsed.operation) candidate.operation = String(parsed.operation);
    if (parsed && parsed.scope) candidate.scope = String(parsed.scope);

    var fieldRaw = '';
    if (!candidate.field && source.field !== undefined && source.field !== null) fieldRaw = String(source.field);
    if (!candidate.field && !fieldRaw && source.key !== undefined && source.key !== null) fieldRaw = String(source.key);
    if (!candidate.field && !fieldRaw && source.column !== undefined && source.column !== null) fieldRaw = String(source.column);
    if (!candidate.field && !fieldRaw && source.name !== undefined && source.name !== null) fieldRaw = String(source.name);
    var normalizedField = normalizeCaseUpdateFieldName(fieldRaw);
    if (normalizedField) candidate.field = normalizedField;

    var valueRaw = source.value;
    if ((valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') && source.input !== undefined && source.input !== null) valueRaw = source.input;
    if ((valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') && source.content !== undefined && source.content !== null) valueRaw = source.content;
    if ((valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') && source.keyword !== undefined && source.keyword !== null) valueRaw = source.keyword;
    if ((valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') && source.term !== undefined && source.term !== null) valueRaw = source.term;
    if ((valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') && source.query !== undefined && source.query !== null) valueRaw = source.query;
    if ((valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') && source.text !== undefined && source.text !== null) valueRaw = source.text;
    if ((candidate.value === undefined || candidate.value === null || String(candidate.value).trim() === '') && valueRaw !== undefined && valueRaw !== null && String(valueRaw).trim() !== '') {
      candidate.value = String(valueRaw).trim();
    }

    if (candidate.index === undefined || candidate.index === null || Number(candidate.index) <= 0) {
      var idxRaw = source.index;
      if ((idxRaw === undefined || idxRaw === null) && source.itemIndex !== undefined && source.itemIndex !== null) idxRaw = source.itemIndex;
      if ((idxRaw === undefined || idxRaw === null) && source.seq !== undefined && source.seq !== null) idxRaw = source.seq;
      if ((idxRaw === undefined || idxRaw === null) && source.row !== undefined && source.row !== null) idxRaw = source.row;
      if ((idxRaw === undefined || idxRaw === null) && source.sourceIndex !== undefined && source.sourceIndex !== null) idxRaw = source.sourceIndex;
      var idx = Number(idxRaw);
      if (Number.isFinite(idx) && idx > 0) candidate.index = Math.floor(idx);
    }

    var op = normalizeCaseUpdateOperationFromArgs(source);
    if (!op && parsed && parsed.operation) op = String(parsed.operation);
    if (op) candidate.operation = op;

    if (!candidate.scope) {
      var sourceScope = '';
      if (source.scope !== undefined && source.scope !== null) sourceScope = String(source.scope).trim().toLowerCase();
      if (!sourceScope && source.target !== undefined && source.target !== null) sourceScope = String(source.target).trim().toLowerCase();
      if (!sourceScope && source.range !== undefined && source.range !== null) sourceScope = String(source.range).trim().toLowerCase();
      if (!sourceScope && (source.all === true || source.applyAll === true || source.batch === true)) sourceScope = 'all';
      if (sourceScope === 'all' || sourceScope === 'single') candidate.scope = sourceScope;
    }

    if (source.context !== undefined && source.context !== null && String(source.context).trim()) {
      candidate.context = String(source.context).trim();
    }
    if (source.fileId !== undefined && source.fileId !== null && String(source.fileId).trim()) {
      candidate.fileId = String(source.fileId).trim();
    }
    if (source.caseFileId !== undefined && source.caseFileId !== null && String(source.caseFileId).trim()) {
      candidate.fileId = String(source.caseFileId).trim();
    }
    if (source.caseId !== undefined && source.caseId !== null && String(source.caseId).trim()) {
      candidate.fileId = String(source.caseId).trim();
    }

    candidate = inferCaseUpdateArgsFromText(candidate, userText);
    if (!candidate.field) return { tool: tool, args: args, rewritten: false };
    if ((candidate.value === undefined || candidate.value === null || String(candidate.value).trim() === '') && candidate.clear !== true) {
      return { tool: tool, args: args, rewritten: false };
    }
    return { tool: 'case.update', args: candidate, rewritten: true };
  }

  function buildCaseUpdateFieldLabel(field) {
    var fieldLabelMap = {
      module: '模块',
      title: '标题',
      priority: '优先级',
      precondition: '前置条件',
      preconditions: '前置条件',
      steps: '步骤',
      expected: '预期结果',
      remark: '备注',
      actual: '执行结果',
    };
    return fieldLabelMap[field] || field || '字段';
  }

  function formatCaseUpdateSuccessText(updateData, fallbackParsed) {
    var parsed = fallbackParsed && typeof fallbackParsed === 'object' ? fallbackParsed : {};
    var data = updateData && typeof updateData === 'object' ? updateData : {};
    var field = data.field ? String(data.field) : (parsed.field ? String(parsed.field) : '');
    var fieldLabel = buildCaseUpdateFieldLabel(field);
    var valueRaw = data.value;
    if (valueRaw === undefined) valueRaw = parsed.value;
    var value = valueRaw === undefined || valueRaw === null ? '' : String(valueRaw);
    var idx = toPositiveInt(data.index || parsed.index || 1, 1);
    var count = Number(data.count);
    var scope = data.scope ? String(data.scope).toLowerCase() : (parsed.scope ? String(parsed.scope).toLowerCase() : '');
    var isClear = data.cleared === true || (isCaseUpdateClearableField(field) && value === '');
    if ((scope === 'all') || (Number.isFinite(count) && count > 1)) {
      var total = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
      if (isClear) return '已批量修改用例：共 ' + total + ' 条，已清空' + fieldLabel;
      return '已批量修改用例：共 ' + total + ' 条，' + fieldLabel + ' = ' + value;
    }
    if (isClear) return '已修改用例：第 ' + idx + ' 条，已清空' + fieldLabel;
    return '已修改用例：第 ' + idx + ' 条，' + fieldLabel + ' = ' + value;
  }

  function buildExtraCaseUpdateArgsFromText(rawText, primaryArgs) {
    var text = String(rawText || '');
    if (!text) return [];
    var args = primaryArgs && typeof primaryArgs === 'object' ? primaryArgs : {};
    var extras = [];
    var hasRemarkClear = /(?:清空|清除|移除|删除|去掉|取消|置空)\s*备注/.test(text) || /备注\s*(?:清空|清除|移除|删除|去掉|取消|置空)/.test(text);
    if (hasRemarkClear && String(args.field || '') !== 'remark') {
      var extra = {
        field: 'remark',
        value: '',
        clear: true,
        operation: 'replace',
      };
      if (args.scope) extra.scope = String(args.scope);
      var idx = extractCaseUpdateTargetIndex(text);
      if (idx > 0) {
        extra.index = idx;
        extra.scope = 'single';
      }
      if (args.context) extra.context = args.context;
      if (args.fileId) extra.fileId = args.fileId;
      extras.push(extra);
    }
    return extras;
  }

  async function tryHandleCaseUpdateCommand(rawText) {
    var parsed = parseCaseUpdateCommand(rawText);
    if (!parsed) return null;
    var apis = getApis();
    var args = {
      field: parsed.field,
      value: parsed.value,
    };
    if (parsed.index > 0) args.index = parsed.index;
    if (parsed.operation) args.operation = parsed.operation;
    if (parsed.scope) args.scope = parsed.scope;
    if (parsed.clear === true) args.clear = true;
    var updateArgsList = [args];
    var extraArgs = buildExtraCaseUpdateArgsFromText(rawText, args);
    if (extraArgs.length) updateArgsList = updateArgsList.concat(extraArgs);

    if (apis.assistantMcpApi && typeof apis.assistantMcpApi.callTool === 'function') {
      var approved = false;
      var successLines = [];
      for (var u = 0; u < updateArgsList.length; u += 1) {
        var currentArgs = updateArgsList[u];
        var mcpRes = null;
        try {
          mcpRes = await apis.assistantMcpApi.callTool('case.update', approved ? Object.assign({}, currentArgs, { confirmed: true }) : currentArgs);
        } catch (err0) {
          mcpRes = { ok: false, reason: err0 && err0.message ? String(err0.message) : '修改失败' };
        }
        if (mcpRes && mcpRes.ok !== true && String(mcpRes.reason || '') === 'confirm_required') {
          if (!approved) {
            var confirmData = mcpRes.data && typeof mcpRes.data === 'object' ? mcpRes.data : {};
            var allowed = await requestAssistantOperationApproval(
              confirmData.actionLabel ? String(confirmData.actionLabel) : '修改用例',
              {
                detail: confirmData.message ? String(confirmData.message) : '',
                reason: '当前操作涉及数据写入或状态变更。',
              }
            );
            if (!allowed) return '已取消。';
            approved = true;
          }
          try {
            mcpRes = await apis.assistantMcpApi.callTool('case.update', Object.assign({}, currentArgs, { confirmed: true }));
          } catch (err1) {
            mcpRes = { ok: false, reason: err1 && err1.message ? String(err1.message) : '修改失败' };
          }
        }
        if (!mcpRes || mcpRes.ok !== true) {
          return mcpRes && mcpRes.reason ? String(mcpRes.reason) : '修改失败';
        }
        var updateData = mcpRes.data && typeof mcpRes.data === 'object' ? mcpRes.data : {};
        successLines.push(formatCaseUpdateSuccessText(updateData, currentArgs));
      }
      if (!successLines.length) return '修改失败';
      if (successLines.length === 1) return successLines[0];
      var merged = [];
      for (var s = 0; s < successLines.length; s += 1) {
        merged.push(String(s + 1) + '. ' + successLines[s]);
      }
      return '已完成以下修改：\n' + merged.join('\n');
    }

    if (!apis.assistantApi || typeof apis.assistantApi.updateCase !== 'function') {
      return '当前页面不支持助手修改用例。';
    }
    if (!await requireDoubleConfirmForAction('update_case', args)) return '已取消。';
    var res = apis.assistantApi.updateCase(args);
    if (!res || res.ok !== true) return res && res.reason ? String(res.reason) : '修改失败';
    var doneIdx = toPositiveInt(res.index || parsed.index || 1, 1);
    return '已修改用例：第 ' + doneIdx + ' 条，' + parsed.field + ' = ' + parsed.value;
  }

  async function tryHandleCaseIntent(text) {
    var raw = String(text || '');
    var apis = getApis();
    if (!apis.assistantApi) return null;

    var directUpdateReply = await tryHandleCaseUpdateCommand(raw);
    if (directUpdateReply) return directUpdateReply;

    if (raw.indexOf('用例') !== -1 && containsAny(raw, ['怎么改', '如何改', '怎么修改', '如何修改', '修改步骤', '编辑方法'])) {
      return [
        '修改用例建议这样操作：',
        '1. 进入“用例库 -> 查看&编辑”。',
        '2. 选中目标用例文件后在列表中直接编辑对应字段。',
        '3. 完成后保存（删除类操作会走确认与撤回机制）。',
        '你也可以直接让我“跳转到用例库”。',
      ].join('\n');
    }

    if (containsAny(raw, ['删除用例', '移除用例'])) {
      if (typeof apis.assistantApi.deleteCase !== 'function') return '当前页面不支持助手删除用例。';
      var idxMatch = raw.match(/第\s*(\d+)\s*条/);
      var idx = idxMatch ? Number(idxMatch[1]) : 1;
      if (!await requireDoubleConfirmForAction('delete_case', { index: idx })) return '已取消。';
      var delRes = apis.assistantApi.deleteCase(idx);
      if (delRes && delRes.ok) {
        return '删除已触发：第 ' + delRes.index + ' 条。若误删可在8秒内撤回。';
      }
      return delRes && delRes.reason ? delRes.reason : '删除触发失败';
    }

    if (containsAny(raw, ['用例生成']) && containsAny(raw, ['开始', '执行', '触发', '运行', '一键'])) {
      if (typeof apis.assistantApi.runCaseGeneration !== 'function') return '用例生成能力暂不可用';
      if (!await requireDoubleConfirmForAction('run_case_generation', {})) return '已取消。';
      setStatus('正在触发用例生成...');
      return apis.assistantApi.runCaseGeneration().then(function(res) {
        return res && res.ok ? '已触发用例生成流程，请查看用例生成页面进度。' : (res.reason || '用例生成触发失败');
      });
    }

    if (containsAny(raw, ['漏测', '易漏']) && containsAny(raw, ['推荐', '补全', '执行', '生成', '触发'])) {
      if (typeof apis.assistantApi.runMissingRecommendation !== 'function') return '漏测推荐能力暂不可用';
      if (!await requireDoubleConfirmForAction('run_missing_recommendation', {})) return '已取消。';
      setStatus('正在触发漏测推荐...');
      return apis.assistantApi.runMissingRecommendation().then(function(res) {
        return res && res.ok ? '已触发漏测推荐，请在页面确认后再生成。' : (res.reason || '漏测推荐触发失败');
      });
    }

    return null;
  }

  function parseSettingKey(raw) {
    if (containsAny(raw, ['助手模型', '聊天模型'])) return 'assistantModelId';
    if (containsAny(raw, ['助手', 'ai助手'])) return 'assistantEnabled';
    if (containsAny(raw, ['易漏', '漏测推荐'])) return 'missingCaseReminderAiEnabled';
    if (containsAny(raw, ['导航', '收起'])) return 'smartTopNavCollapse';
    if (containsAny(raw, ['主题'])) return 'theme';
    if (containsAny(raw, ['超时'])) return 'timeoutSec';
    return '';
  }

  async function tryHandleSettingsIntent(text) {
    var raw = String(text || '');
    var apis = getApis();
    if (!apis.assistantSettingsApi) return null;

    if (containsAny(raw, ['作用', '效果', '说明', '是什么意思']) && containsAny(raw, ['设置', '选项', '助手', '主题', '超时', '导航'])) {
      var explainKey = parseSettingKey(raw);
      if (!explainKey) return '请告诉我你想了解哪一项设置。';
      if (typeof apis.assistantSettingsApi.describeSetting === 'function') {
        return apis.assistantSettingsApi.describeSetting(explainKey);
      }
      return '该设置项说明暂不可用。';
    }

    if (containsAny(raw, ['关闭助手', '禁用助手'])) {
      return '安全策略限制：助手不能通过聊天关闭自己，请在设置页手动关闭。';
    }

    if (containsAny(raw, ['开启助手'])) {
      if (!await requireDoubleConfirmForAction('settings_patch', { patch: { assistantEnabled: true } })) return '已取消。';
      var onRes = apis.assistantSettingsApi.applyPatch({ assistantEnabled: true }, { source: 'assistant' });
      return onRes && onRes.ok ? '助手已开启。' : (onRes.reason || '开启失败');
    }

    if (containsAny(raw, ['开启', '关闭']) && containsAny(raw, ['易漏', '漏测推荐'])) {
      var aiOn = containsAny(raw, ['开启']);
      if (!await requireDoubleConfirmForAction('settings_patch', { patch: { missingCaseReminderAiEnabled: aiOn ? 'on' : 'off' } })) return '已取消。';
      var aiRes = apis.assistantSettingsApi.applyPatch(
        { missingCaseReminderAiEnabled: aiOn ? 'on' : 'off' },
        { source: 'assistant' }
      );
      return aiRes && aiRes.ok ? ('已' + (aiOn ? '开启' : '关闭') + '易漏用例推荐。') : (aiRes.reason || '设置失败');
    }

    if (containsAny(raw, ['开启', '关闭']) && containsAny(raw, ['导航', '收起'])) {
      var collapseOn = containsAny(raw, ['开启']);
      if (!await requireDoubleConfirmForAction('settings_patch', { patch: { smartTopNavCollapse: collapseOn } })) return '已取消。';
      var navRes = apis.assistantSettingsApi.applyPatch(
        { smartTopNavCollapse: collapseOn },
        { source: 'assistant' }
      );
      return navRes && navRes.ok ? ('已' + (collapseOn ? '开启' : '关闭') + '导航智能收起。') : (navRes.reason || '设置失败');
    }

    if (containsAny(raw, ['深色主题', '黑色主题', '浅色主题', '白色主题', '切换主题'])) {
      var theme = containsAny(raw, ['深色主题', '黑色主题']) ? 'dark' : 'light';
      if (!await requireDoubleConfirmForAction('settings_patch', { patch: { theme: theme } })) return '已取消。';
      var themeRes = apis.assistantSettingsApi.applyPatch({ theme: theme }, { source: 'assistant' });
      return themeRes && themeRes.ok ? '主题已切换。' : (themeRes.reason || '设置失败');
    }

    if (containsAny(raw, ['设置模型']) || containsAny(raw, ['切换模型'])) {
      if (!modelPicker) return '请在助手面板顶部选择模型。';
      return '可在助手面板顶部下拉框切换模型，或在设置页保存为默认模型。';
    }

    return null;
  }

  async function classifyIntentByModel(text) {
    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.callModel !== 'function') return null;
    var prompt = [
      '你是意图分类器。',
      '判断用户输入主要意图：navigate/query/query_case_list/chat。',
      '如果是 navigate/query，请尽量给出 tab 字段（例如 settings/assign/models/casesgen/tempexec/case-library/case-archive/exec-overview/auto）。',
      '当用户明确想看“当前有哪些用例/用例列表/列出用例”时，intent 请选择 query_case_list。',
      '只输出 JSON：{"intent":"navigate|query|query_case_list|chat","tab":"","reason":""}'
    ].join('\n');
    var res = await apis.assistantApi.callModel(String(text || ''), { prompt: prompt, temperature: 0 });
    if (!res || !res.ok || !res.content) return null;
    var parsed = null;
    try {
      var raw = String(res.content || '').trim();
      var payloadMatch = raw.match(/\{[\s\S]*\}/);
      if (!payloadMatch) return null;
      parsed = JSON.parse(payloadMatch[0]);
    } catch (err) {
      parsed = null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  }

  function normalizeModelActionName(actionRaw) {
    var action = actionRaw === undefined || actionRaw === null ? '' : String(actionRaw).trim().toLowerCase();
    if (!action) return '';
    action = action.replace(/\s+/g, '_').replace(/-/g, '_');
    if (containsAny(action, ['reply', 'chat', 'answer', 'respond'])) return 'reply';
    if (containsAny(action, ['navigate', 'switch_tab', 'goto', 'open_tab'])) return 'navigate';
    if (containsAny(action, ['query_case_list', 'list_cases', 'list_current_cases', 'case_list'])) return 'query_case_list';
    if (containsAny(action, ['query_page_data', 'get_page_data', 'read_page_data', 'query_page', 'query'])) return 'query_page_data';
    if (containsAny(action, ['current_page_info', 'current_page', 'which_page'])) return 'current_page_info';
    if (containsAny(action, ['web_search', 'search_web', 'search_online'])) return 'web_search';
    if (containsAny(action, ['memo_list', 'list_memo'])) return 'memo_list';
    if (containsAny(action, ['memo_add', 'add_memo'])) return 'memo_add';
    if (containsAny(action, ['memo_toggle', 'toggle_memo', 'complete_memo'])) return 'memo_toggle';
    if (containsAny(action, ['memo_remove', 'remove_memo', 'delete_memo'])) return 'memo_remove';
    if (containsAny(action, ['settings_patch', 'update_settings', 'change_settings'])) return 'settings_patch';
    if (containsAny(action, ['settings_describe', 'describe_setting', 'explain_setting'])) return 'settings_describe';
    if (containsAny(action, ['case_update', 'update_case', 'edit_case', 'modify_case', 'patch_case'])) return 'update_case';
    if (containsAny(action, ['delete_case', 'remove_case'])) return 'delete_case';
    if (containsAny(action, ['run_case_generation', 'case_generation'])) return 'run_case_generation';
    if (containsAny(action, ['run_missing_recommendation', 'missing_recommendation'])) return 'run_missing_recommendation';
    return action;
  }

  function extractModelActionList(parsed) {
    var payload = parsed && typeof parsed === 'object' ? parsed : null;
    if (!payload) return [];
    var actions = [];
    if (Array.isArray(payload.actions)) {
      payload.actions.forEach(function(item) {
        if (!item || typeof item !== 'object') return;
        actions.push(Object.assign({}, item));
      });
    } else if (payload.action && typeof payload.action === 'object') {
      var obj = Object.assign({}, payload.action);
      if (!obj.action && payload.action.name) obj.action = payload.action.name;
      actions.push(obj);
    } else if (payload.action) {
      actions.push(Object.assign({}, payload));
    }
    return actions;
  }

  function getFallbackMcpToolCatalog() {
    return [
      { name: 'page.current_info', mode: 'read', description: '获取当前页面名称与标识' },
      { name: 'page.get_data', mode: 'read', description: '读取页面数据快照' },
      { name: 'nav.switch_tab', mode: 'write', description: '切换目标页签' },
      { name: 'cases.list_current', mode: 'read', description: '读取当前页面或项目用例列表' },
      { name: 'ui.list_controls', mode: 'read', description: '列出当前页可操作控件' },
      { name: 'ui.click_control', mode: 'write', description: '点击指定页面控件' },
      { name: 'ui.fill_input', mode: 'write', description: '填写输入控件并触发事件' },
      { name: 'tempexec.search_cases', mode: 'read', description: '执行页搜索当前用例' },
      { name: 'tempexec.show_xmind', mode: 'read', description: '打开执行页 XMind 结构展示' },
      { name: 'tempexec.export_xmind', mode: 'write', description: '导出执行页 XMind' },
      { name: 'tempexec.next_file', mode: 'read', description: '切换到下一份执行用例' },
      { name: 'tempexec.switch_file', mode: 'read', description: '切换执行用例文件' },
      { name: 'web.search', mode: 'read', description: '联网搜索' },
      { name: 'memo.list', mode: 'read', description: '读取备忘列表' },
      { name: 'memo.add', mode: 'write', description: '新增备忘' },
      { name: 'memo.toggle', mode: 'write', description: '更新备忘完成状态' },
      { name: 'memo.remove', mode: 'write', description: '删除备忘' },
      { name: 'settings.describe', mode: 'read', description: '读取设置项说明' },
      { name: 'settings.patch', mode: 'write', description: '修改设置' },
      { name: 'assistant.list_scaffolds', mode: 'read', description: '查看可调用的标准展示手脚架清单' },
      { name: 'assistant.render_scaffold', mode: 'read', description: '渲染标准展示手脚架（如 case_table、markdown_table、numbered_list、bullet_list、key_value_table）' },
      { name: 'case.update', mode: 'write', description: '修改当前可见用例字段（优先级/标题/步骤等）' },
      { name: 'case.delete', mode: 'write', description: '删除用例条目' },
      { name: 'casegen.run', mode: 'write', description: '触发用例生成' },
      { name: 'missing_recommend.run', mode: 'write', description: '触发漏测推荐' },
    ];
  }

  function getAvailableMcpTools() {
    var apis = getApis();
    if (apis.assistantMcpApi && typeof apis.assistantMcpApi.listTools === 'function') {
      try {
        var tools = apis.assistantMcpApi.listTools();
        if (Array.isArray(tools) && tools.length) return tools;
      } catch (err) {
        // ignore and fallback
      }
    }
    return getFallbackMcpToolCatalog();
  }

  function normalizeMcpToolName(rawName) {
    var raw = rawName === undefined || rawName === null ? '' : String(rawName).trim().toLowerCase();
    if (!raw) return '';
    raw = raw.replace(/\s+/g, '_').replace(/-/g, '_');
    if (raw === 'page.current_info' || raw === 'current_page_info' || raw === 'page.info') return 'page.current_info';
    if (raw === 'page.get_data' || raw === 'query_page_data' || raw === 'page_data') return 'page.get_data';
    if (raw === 'nav.switch_tab' || raw === 'navigate' || raw === 'switch_tab') return 'nav.switch_tab';
    if (raw === 'cases.list_current' || raw === 'query_case_list' || raw === 'case_list') return 'cases.list_current';
    if (raw === 'ui.list_controls' || raw === 'list_controls' || raw === 'list_ui_controls') return 'ui.list_controls';
    if (raw === 'ui.click_control' || raw === 'click_control' || raw === 'click_ui_control') return 'ui.click_control';
    if (raw === 'ui.fill_input' || raw === 'fill_input' || raw === 'fill_ui_input') return 'ui.fill_input';
    if (raw === 'tempexec.search_cases' || raw === 'search_tempexec_cases') return 'tempexec.search_cases';
    if (raw === 'tempexec.show_xmind' || raw === 'show_tempexec_xmind' || raw === 'tempexec_xmind_view') return 'tempexec.show_xmind';
    if (raw === 'tempexec.export_xmind' || raw === 'export_tempexec_xmind') return 'tempexec.export_xmind';
    if (raw === 'tempexec.next_file' || raw === 'next_tempexec_file') return 'tempexec.next_file';
    if (raw === 'tempexec.switch_file' || raw === 'switch_tempexec_file') return 'tempexec.switch_file';
    if (raw === 'web.search' || raw === 'web_search' || raw === 'search_web') return 'web.search';
    if (raw === 'memo.list' || raw === 'memo_list') return 'memo.list';
    if (raw === 'memo.add' || raw === 'memo_add') return 'memo.add';
    if (raw === 'memo.toggle' || raw === 'memo_toggle') return 'memo.toggle';
    if (raw === 'memo.remove' || raw === 'memo_remove') return 'memo.remove';
    if (raw === 'settings.describe' || raw === 'settings_describe') return 'settings.describe';
    if (raw === 'settings.patch' || raw === 'settings_patch') return 'settings.patch';
    if (raw === 'assistant.list_scaffolds' || raw === 'assistant_list_scaffolds' || raw === 'list_scaffolds') return 'assistant.list_scaffolds';
    if (raw === 'assistant.render_scaffold' || raw === 'assistant_render_scaffold' || raw === 'render_scaffold' || raw === 'render_scaffold_tool') return 'assistant.render_scaffold';
    if (raw === 'case.update' || raw === 'case_update' || raw === 'update_case' || raw === 'edit_case' || raw === 'case_edit' || raw === 'case.patch' || raw === 'case_patch') return 'case.update';
    if (raw === 'case.delete' || raw === 'delete_case') return 'case.delete';
    if (raw === 'casegen.run' || raw === 'run_case_generation') return 'casegen.run';
    if (raw === 'missing_recommend.run' || raw === 'run_missing_recommendation') return 'missing_recommend.run';
    return raw;
  }

  function isUiControlListingIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (!containsAny(raw, ['控件', '按钮', '输入框', '组件', '元素'])) return false;
    return containsAny(raw, ['有哪些', '列表', '清单', '列出', '展示', '查看']);
  }

  function isPageDataListingIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (containsAny(raw, ['页面数据', '原始数据', '完整数据', '数据快照', 'json', 'JSON'])) return true;
    if (containsAny(raw, ['返回数据', '展示数据', '打印数据', '给我数据'])) return true;
    return false;
  }

  function looksLikeImperativeUiOperation(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (!containsAny(raw, ['输入', '填入', '填写', '点击', '点一下', '切换', '打开', '搜索', '查找'])) return false;
    if (containsAny(raw, ['多少', '几条', '数量', '哪些', '有没有', '是否', '是什么', '怎么', '为什么'])) return false;
    return true;
  }

  function getMcpToolMode(toolName) {
    var tool = normalizeMcpToolName(toolName);
    if (!tool) return '';
    var tools = getAvailableMcpTools();
    if (Array.isArray(tools) && tools.length) {
      for (var i = 0; i < tools.length; i += 1) {
        var row = tools[i] && typeof tools[i] === 'object' ? tools[i] : {};
        var rowName = normalizeMcpToolName(row.name || '');
        if (!rowName || rowName !== tool) continue;
        var mode = row.mode === undefined || row.mode === null ? '' : String(row.mode).trim().toLowerCase();
        if (mode) return mode;
      }
    }
    if (containsAny(tool, ['nav.switch_tab', 'ui.click_control', 'ui.fill_input', 'tempexec.export_xmind', 'settings.patch', 'case.update', 'case.delete', 'casegen.run', 'missing_recommend.run', 'memo.add', 'memo.toggle', 'memo.remove'])) {
      return 'write';
    }
    return 'read';
  }

  function shouldContinueMcpReasoning(userText, mcpCalls, mcpOutputs) {
    var calls = Array.isArray(mcpCalls) ? mcpCalls : [];
    var outputs = Array.isArray(mcpOutputs) ? mcpOutputs : [];
    if (!calls.length) return false;
    var hasRead = false;
    var hasWrite = false;
    var hasListControls = false;
    var hasPageData = false;
    var hasCaseList = false;
    var hasCurrentPage = false;
    var hasWebSearch = false;
    var hasTempExecSearch = false;
    for (var i = 0; i < calls.length; i += 1) {
      var call = calls[i] && typeof calls[i] === 'object' ? calls[i] : {};
      var tool = normalizeMcpToolName(call.tool || call.name || '');
      if (!tool) continue;
      var mode = getMcpToolMode(tool);
      if (mode === 'write') hasWrite = true;
      else hasRead = true;
      if (tool === 'ui.list_controls') hasListControls = true;
      if (tool === 'page.get_data') hasPageData = true;
      if (tool === 'cases.list_current') hasCaseList = true;
      if (tool === 'page.current_info') hasCurrentPage = true;
      if (tool === 'web.search') hasWebSearch = true;
      if (tool === 'tempexec.search_cases') hasTempExecSearch = true;
    }
    if (hasListControls && !isUiControlListingIntent(userText)) return true;
    if (hasPageData && !isPageDataListingIntent(userText)) return true;
    if (hasCaseList || hasCurrentPage || hasWebSearch || hasTempExecSearch) return false;
    if (hasWrite && !hasRead) {
      return false;
    }
    var outText = outputs.join('\n');
    if (containsAny(outText, ['当前可操作控件：']) && !isUiControlListingIntent(userText)) return true;
    if (containsAny(outText, ['按你的意图返回页面数据']) && !isPageDataListingIntent(userText)) return true;
    return false;
  }

  function shouldContinueActionReasoning(userText, actions, actionOutputs) {
    var list = Array.isArray(actions) ? actions : [];
    if (!list.length) return false;
    var hasQueryPageData = false;
    var hasCaseList = false;
    var hasCurrentPage = false;
    for (var i = 0; i < list.length; i += 1) {
      var action = list[i] && typeof list[i] === 'object' ? list[i] : {};
      var normalized = normalizeModelActionName(action.action || action.name || '');
      if (normalized === 'query_page_data') hasQueryPageData = true;
      if (normalized === 'query_case_list') hasCaseList = true;
      if (normalized === 'current_page_info') hasCurrentPage = true;
    }
    if (hasCaseList || hasCurrentPage) return false;
    if (hasQueryPageData && !isPageDataListingIntent(userText)) return true;
    var text = Array.isArray(actionOutputs) ? actionOutputs.join('\n') : '';
    if (containsAny(text, ['按你的意图返回页面数据']) && !isPageDataListingIntent(userText)) return true;
    return false;
  }

  function formatReasoningTraceEntry(round, type, plans, outputs) {
    var list = Array.isArray(plans) ? plans : [];
    var out = Array.isArray(outputs) ? outputs : [];
    var lines = [];
    lines.push('第 ' + round + ' 轮' + (type === 'action' ? '动作执行结果' : 'MCP 工具执行结果') + '：');
    list.forEach(function(plan, idx) {
      if (!plan || typeof plan !== 'object') return;
      if (type === 'action') {
        var actionName = normalizeModelActionName(plan.action || plan.name || '');
        lines.push('- 动作' + (idx + 1) + '：' + (actionName || 'unknown'));
        return;
      }
      var tool = normalizeMcpToolName(plan.tool || plan.name || '');
      lines.push('- 工具' + (idx + 1) + '：' + (tool || 'unknown'));
    });
    if (out.length) {
      lines.push('观察：');
      out.forEach(function(text, idx) {
        var content = String(text || '').trim();
        if (!content) return;
        lines.push((idx + 1) + '. ' + content);
      });
    } else {
      lines.push('观察：无有效输出');
    }
    return lines.join('\n');
  }

  function buildPlanSignature(type, plans) {
    var list = Array.isArray(plans) ? plans : [];
    var parts = [];
    list.forEach(function(plan) {
      if (!plan || typeof plan !== 'object') return;
      if (type === 'action') {
        var actionName = normalizeModelActionName(plan.action || plan.name || '');
        var actionPayload = Object.assign({}, plan);
        delete actionPayload.response;
        parts.push(actionName + '::' + formatJsonCompact(actionPayload));
        return;
      }
      var tool = normalizeMcpToolName(plan.tool || plan.name || '');
      var args = plan.args && typeof plan.args === 'object' ? plan.args : {};
      parts.push(tool + '::' + formatJsonCompact(args));
    });
    return type + '|' + parts.join('|');
  }

  function buildMcpReasoningPrompt(basePrompt, traceEntries) {
    var traces = Array.isArray(traceEntries) ? traceEntries : [];
    var text = traces.join('\n\n');
    return [
      basePrompt || '',
      '',
      '你刚刚调用工具得到如下结果：',
      text || '（无可用结果）',
      '',
      '请继续决策：',
      '- 如果信息已经足够，直接给用户最终自然语言答复。',
      '- 如果还需要下一步页面操作，继续输出 MCP JSON。',
      '- 不要机械复读工具输出；除非用户明确要求查看控件清单，否则不要只返回控件列表。',
      '- 非必要不要重复调用完全相同的工具和参数。',
    ].join('\n');
  }

  function extractModelMcpCallList(parsed) {
    var payload = parsed && typeof parsed === 'object' ? parsed : null;
    if (!payload) return [];
    var calls = [];
    var pushCall = function(item) {
      if (!item || typeof item !== 'object') return;
      var toolRaw = item.tool !== undefined && item.tool !== null
        ? item.tool
        : (item.name !== undefined && item.name !== null ? item.name : '');
      var tool = normalizeMcpToolName(toolRaw);
      if (!tool) return;
      var args = item.args && typeof item.args === 'object'
        ? Object.assign({}, item.args)
        : (item.params && typeof item.params === 'object' ? Object.assign({}, item.params) : {});
      calls.push({
        tool: tool,
        args: args,
        response: item.response !== undefined && item.response !== null ? String(item.response) : '',
      });
    };
    if (payload.mcp && typeof payload.mcp === 'object') {
      if (Array.isArray(payload.mcp.calls)) {
        payload.mcp.calls.forEach(pushCall);
      } else if (payload.mcp.tool || payload.mcp.name) {
        pushCall(payload.mcp);
      }
    }
    if (!calls.length && Array.isArray(payload.calls)) {
      payload.calls.forEach(function(item) {
        if (!item || typeof item !== 'object') return;
        if (!item.tool && !item.name) return;
        pushCall(item);
      });
    }
    if (!calls.length && (payload.tool || payload.name)) {
      pushCall(payload);
    }
    return calls;
  }

  function mapMcpToolToActionPayload(tool, args, responseHint, userText) {
    var name = normalizeMcpToolName(tool);
    var payloadArgs = args && typeof args === 'object' ? Object.assign({}, args) : {};
    var actionPayload = {
      response: responseHint ? String(responseHint) : '',
    };
    if (name === 'page.current_info') {
      actionPayload.action = 'current_page_info';
      actionPayload.query = payloadArgs.query || String(userText || '');
      return actionPayload;
    }
    if (name === 'page.get_data') {
      actionPayload.action = 'query_page_data';
      actionPayload.tab = payloadArgs.tab || '';
      actionPayload.query = payloadArgs.query || String(userText || '');
      return actionPayload;
    }
    if (name === 'nav.switch_tab') {
      actionPayload.action = 'navigate';
      actionPayload.tab = payloadArgs.tab || payloadArgs.targetTab || '';
      actionPayload.query = payloadArgs.query || String(userText || '');
      return actionPayload;
    }
    if (name === 'cases.list_current') {
      actionPayload.action = 'query_case_list';
      actionPayload.scope = payloadArgs.scope || '';
      actionPayload.query = payloadArgs.query || String(userText || '');
      actionPayload.countOnly = payloadArgs.countOnly === true || payloadArgs.count === true;
      actionPayload.detailLevel = payloadArgs.detailLevel || '';
      if (payloadArgs.requireEditor === true) actionPayload.pageScoped = true;
      return actionPayload;
    }
    if (name === 'web.search') {
      actionPayload.action = 'web_search';
      actionPayload.query = payloadArgs.query || String(userText || '');
      return actionPayload;
    }
    if (name === 'memo.list') {
      actionPayload.action = 'memo_list';
      actionPayload.tab = payloadArgs.tab || '';
      return actionPayload;
    }
    if (name === 'memo.add') {
      actionPayload.action = 'memo_add';
      actionPayload.tab = payloadArgs.tab || '';
      actionPayload.text = payloadArgs.text || payloadArgs.content || '';
      return actionPayload;
    }
    if (name === 'memo.toggle') {
      actionPayload.action = 'memo_toggle';
      actionPayload.tab = payloadArgs.tab || '';
      actionPayload.index = payloadArgs.index;
      actionPayload.done = payloadArgs.done;
      return actionPayload;
    }
    if (name === 'memo.remove') {
      actionPayload.action = 'memo_remove';
      actionPayload.tab = payloadArgs.tab || '';
      actionPayload.index = payloadArgs.index;
      return actionPayload;
    }
    if (name === 'settings.describe') {
      actionPayload.action = 'settings_describe';
      actionPayload.key = payloadArgs.key || '';
      return actionPayload;
    }
    if (name === 'settings.patch') {
      actionPayload.action = 'settings_patch';
      actionPayload.patch = payloadArgs.patch && typeof payloadArgs.patch === 'object'
        ? Object.assign({}, payloadArgs.patch)
        : (payloadArgs.settings && typeof payloadArgs.settings === 'object' ? Object.assign({}, payloadArgs.settings) : {});
      return actionPayload;
    }
    if (name === 'case.update') {
      actionPayload.action = 'update_case';
      if (payloadArgs.patch && typeof payloadArgs.patch === 'object') actionPayload.patch = Object.assign({}, payloadArgs.patch);
      if (payloadArgs.field !== undefined && payloadArgs.field !== null) actionPayload.field = payloadArgs.field;
      if (payloadArgs.key !== undefined && payloadArgs.key !== null) actionPayload.key = payloadArgs.key;
      if (payloadArgs.value !== undefined && payloadArgs.value !== null) actionPayload.value = payloadArgs.value;
      if (payloadArgs.to !== undefined && payloadArgs.to !== null) actionPayload.to = payloadArgs.to;
      if (payloadArgs.index !== undefined && payloadArgs.index !== null) actionPayload.index = payloadArgs.index;
      if (payloadArgs.itemIndex !== undefined && payloadArgs.itemIndex !== null) actionPayload.itemIndex = payloadArgs.itemIndex;
      return actionPayload;
    }
    if (name === 'case.delete') {
      actionPayload.action = 'delete_case';
      actionPayload.index = payloadArgs.index;
      return actionPayload;
    }
    if (name === 'casegen.run') {
      actionPayload.action = 'run_case_generation';
      return actionPayload;
    }
    if (name === 'missing_recommend.run') {
      actionPayload.action = 'run_missing_recommendation';
      return actionPayload;
    }
    return null;
  }

  function trimMcpReasonField(value, maxLen) {
    var text = value === undefined || value === null ? '' : String(value).trim();
    var limit = toPositiveInt(maxLen, 0);
    if (!text) return '';
    if (!limit || text.length <= limit) return text;
    return text.slice(0, limit) + '...';
  }

  function buildMcpReasonPayload(tool, args, data) {
    var name = normalizeMcpToolName(tool);
    var payloadArgs = args && typeof args === 'object' ? Object.assign({}, args) : {};
    var sourceData = data && typeof data === 'object' ? data : {};
    if (name === 'cases.list_current') {
      var items = Array.isArray(sourceData.items) ? sourceData.items : [];
      var detailLevel = payloadArgs.detailLevel === undefined || payloadArgs.detailLevel === null
        ? ''
        : String(payloadArgs.detailLevel).trim().toLowerCase();
      var compactFilterInfo = buildCompactCaseListFilterInfo(sourceData.filterInfo);
      var includeFullFields = detailLevel === 'full' || Boolean(compactFilterInfo);
      var maxItems = includeFullFields ? 200 : 80;
      var compactItems = items.slice(0, maxItems).map(function(item, idx) {
        var row = item && typeof item === 'object' ? item : {};
        var normalized = {
          index: row.index === undefined || row.index === null ? (idx + 1) : row.index,
          id: row.id === undefined || row.id === null ? '' : String(row.id),
          module: trimMcpReasonField(row.module, 60),
          title: trimMcpReasonField(row.title, 100),
          priority: row.priority === undefined || row.priority === null ? '' : String(row.priority),
          executionResult: trimMcpReasonField(resolveCaseExecutionResult(row), 60),
        };
        if (includeFullFields) {
          normalized.precondition = trimMcpReasonField(row.precondition !== undefined && row.precondition !== null ? row.precondition : row.preconditions, 120);
          normalized.steps = trimMcpReasonField(row.steps, 200);
          normalized.expected = trimMcpReasonField(row.expected, 200);
          normalized.remark = trimMcpReasonField(row.remark, 120);
        }
        return normalized;
      });
      return {
        tool: name,
        args: payloadArgs,
        scope: sourceData.scope || '',
        contextSource: sourceData.contextSource || '',
        total: Number(sourceData.total) || compactItems.length,
        truncated: sourceData.truncated === true,
        filterSummary: buildCaseListFilterLabel(sourceData.filterInfo),
        filterInfo: compactFilterInfo,
        caseFile: sourceData.caseFile && typeof sourceData.caseFile === 'object' ? {
          id: sourceData.caseFile.id || '',
          name: sourceData.caseFile.name || '',
        } : null,
        items: compactItems,
      };
    }
    return {
      tool: name,
      args: payloadArgs,
      data: sourceData,
    };
  }


  async function summarizeMcpToolResultByModel(userText, tool, args, data, fallbackText) {
    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.callModel !== 'function') return '';
    var payload = {
      userQuestion: String(userText || ''),
      toolResult: buildMcpReasonPayload(tool, args, data),
    };
    var prompt = [
      '你是工具结果解读助手。',
      '请基于用户问题和工具结果给出最终回答，不要编造数据。',
      '回答策略：',
      '- 直接输出最终内容，不要加“好的/按上文语境/如果你指的是”之类前言或兜底解释。',
      '- 先直接回答用户问题，不要默认输出列表。',
      '- 用户问“是否/有没有/全部都...”时，先给结论，再给关键依据。',
      '- 用户问“多少/数量”时，直接给数字与口径。',
      '- 当用户要求“完整展示/完整列出/全部字段/完整内容”时，可自主选择 Markdown 表格或编号列表；字段多、需要横向对比时优先表格，条目少、需要逐条展开时优先列表。',
      '- 若平台已有合适展示手脚架，可直接输出单个 MCP JSON 调用 assistant.render_scaffold；例如展示完整用例列表时优先用 case_table。',
      '- 若只有 1 条完整用例，禁止输出“字段 | 内容”这类纵向键值表；优先输出标准横向用例表，或改用分段小标题展开。',
      '- 若工具结果已提供完整字段，不要省略前置条件、步骤、预期结果、备注、执行结果等关键字段。',
      '- 若工具结果包含筛选条件（如任意字段模糊包含、相关匹配、编号奇偶），先点明筛选口径，再按你判断最清晰的格式展示命中条目。',
      '- 只有用户明确要求“列表/明细/逐条”，或你判断表格/列表更清晰时，才输出列表或表格。',
      '- 若输出 JSON，必须只输出一个 JSON 对象，不要代码块。',
      '- 输出中文自然语言，可用 Markdown。',
    ].join('\n');
    var history = buildConversationHistory(8, userText);
    var res = null;
    try {
      res = await apis.assistantApi.callModel(JSON.stringify(payload, null, 2), {
        prompt: prompt,
        temperature: 0.1,
        history: history,
      });
    } catch (err) {
      res = { ok: false, reason: err && err.message ? String(err.message) : '结果解读异常' };
    }
    if (!res || res.ok !== true || !res.content) return '';
    var text = String(res.content || '').trim();
    var scaffoldText = '';
    if (!text) return '';
    scaffoldText = await tryExecuteSummaryScaffoldReply(userText, text, tool, args, data, fallbackText);
    if (scaffoldText) {
      text = scaffoldText;
    } else if (parseJsonObjectFromText(text)) {
      return '';
    }
    text = normalizeSingleCaseDetailSummaryLayout(tool, args, data, text, fallbackText);
    text = normalizeExplicitAllCaseListSummaryLayout(userText, tool, args, data, text, fallbackText);
    if (fallbackText && text === String(fallbackText).trim()) return text;
    return text;
  }

  async function executeModelMcpToolCall(call, userText, defaultResponse) {
    var item = call && typeof call === 'object' ? call : {};
    var tool = normalizeMcpToolName(item.tool || item.name || '');
    if (!tool) return null;
    var args = item.args && typeof item.args === 'object' ? Object.assign({}, item.args) : {};
    var rewritten = rewriteUiFillAsCaseUpdateIfNeeded(tool, args, userText);
    if (rewritten && rewritten.rewritten === true) {
      tool = rewritten.tool;
      args = rewritten.args && typeof rewritten.args === 'object' ? Object.assign({}, rewritten.args) : {};
    }
    if (tool === 'case.update') {
      args = inferCaseUpdateArgsFromText(args, userText);
    }
    var responseHint = item.response && String(item.response).trim()
      ? String(item.response).trim()
      : (defaultResponse ? String(defaultResponse).trim() : '');

    var actionPayload = mapMcpToolToActionPayload(tool, args, responseHint, userText);
    var actionName = normalizeModelActionName(actionPayload && actionPayload.action ? actionPayload.action : '');

    if (tool === 'web.search') {
      var rawQuery = args.query && String(args.query).trim() ? String(args.query).trim() : String(userText || '').trim();
      var normalizedWeatherQuery = normalizeWeatherSearchQuery(rawQuery, userText);
      if ((looksLikeWeatherText(rawQuery) || looksLikeWeatherText(userText)) && !normalizedWeatherQuery) {
        return { handled: true, text: '可以。请先告诉我你所在的城市（例如“深圳”），我再给你今天的天气简报。' };
      }
      if (normalizedWeatherQuery) args.query = normalizedWeatherQuery;
    }

    var apis = getApis();
    if (!apis.assistantMcpApi || typeof apis.assistantMcpApi.callTool !== 'function') {
      if (!actionPayload) return { handled: true, text: '当前环境暂不支持 MCP 工具：' + tool };
      actionPayload._mcpUnavailable = true;
      return executeModelPlannedAction(actionPayload, userText, responseHint);
    }

    async function callMcpOnce(payload) {
      try {
        return await apis.assistantMcpApi.callTool(tool, payload || {});
      } catch (err) {
        return { ok: false, reason: err && err.message ? String(err.message) : 'MCP 调用异常' };
      }
    }

    function buildConfirmDetail(info) {
      if (!info || typeof info !== 'object') return '';
      if (info.message) return String(info.message);
      if (info.hint) return String(info.hint);
      if (info.controlText) return '目标控件：' + String(info.controlText);
      return '';
    }

    var callResult = null;
    var confirmedRetryTried = false;
    callResult = await callMcpOnce(args || {});
    if (callResult && callResult.ok !== true && String(callResult.reason || '') === 'confirm_required') {
      var confirmData = callResult.data && typeof callResult.data === 'object' ? callResult.data : {};
      var confirmLabel = confirmData.actionLabel
        ? String(confirmData.actionLabel)
        : getMutationActionLabel(actionName || tool, actionPayload || args);
      var allowed = await requestAssistantOperationApproval(confirmLabel, {
        detail: buildConfirmDetail(confirmData),
        reason: '当前操作涉及写入、编辑或删除。',
      });
      if (!allowed) {
        return { handled: true, text: '已取消。' };
      }
      var confirmedArgs = Object.assign({}, args || {}, { confirmed: true });
      confirmedRetryTried = true;
      callResult = await callMcpOnce(confirmedArgs);
    }
    if (!callResult || callResult.ok !== true) {
      var failedReason = callResult && callResult.reason ? String(callResult.reason) : '未知错误';
      var toolMode = getMcpToolMode(tool);
      // 写工具或确认后失败时，直接返回失败信息，避免回退链路再次触发确认弹窗。
      if (confirmedRetryTried || toolMode === 'write' || failedReason === 'confirm_required') {
        return { handled: true, text: 'MCP 工具执行失败：' + failedReason };
      }
      if (actionPayload) {
        // MCP 失败时回退到旧动作执行链路，保持可用性。
        actionPayload._mcpUnavailable = true;
        return executeModelPlannedAction(actionPayload, userText, responseHint);
      }
      return { handled: true, text: 'MCP 工具执行失败：' + failedReason };
    }
    var toolData = callResult.data;

    if (tool === 'ui.list_controls') {
      var controls = Array.isArray(toolData && toolData.controls) ? toolData.controls : [];
      if (!controls.length) return { handled: true, text: '当前页面没有可操作控件。' };
      var linesCtl = ['当前可操作控件：' + controls.length + ' 个。'];
      controls.slice(0, 40).forEach(function(row, idx) {
        var itemCtl = row && typeof row === 'object' ? row : {};
        var cid = itemCtl.controlId ? String(itemCtl.controlId) : '';
        var ctext = itemCtl.text ? String(itemCtl.text) : '';
        var ctype = itemCtl.type ? String(itemCtl.type) : '';
        var cdom = itemCtl.domId ? String(itemCtl.domId) : '';
        var mode = itemCtl.requiresConfirm === true ? 'write' : 'read';
        var label = ctext || cdom || cid || ('控件' + (idx + 1));
        linesCtl.push((idx + 1) + '. [' + mode + '] ' + label + (ctype ? (' | 类型: ' + ctype) : '') + (cid ? (' | controlId: ' + cid) : ''));
      });
      if (controls.length > 40) linesCtl.push('仅展示前 40 个控件。');
      return { handled: true, text: responseHint || linesCtl.join('\n') };
    }
    if (tool === 'ui.click_control') {
      var clickName = toolData && toolData.controlText ? String(toolData.controlText) : '';
      var clickId = toolData && toolData.controlId ? String(toolData.controlId) : '';
      if (responseHint) return { handled: true, text: responseHint };
      return { handled: true, text: '已执行点击：' + (clickName || clickId || '目标控件') };
    }
    if (tool === 'ui.fill_input') {
      var fillName = toolData && toolData.controlText ? String(toolData.controlText) : '';
      var fillValue = toolData && toolData.value !== undefined && toolData.value !== null ? String(toolData.value) : '';
      if (responseHint) return { handled: true, text: responseHint };
      return { handled: true, text: '已填写输入：' + (fillName || '输入框') + (fillValue ? (' = ' + fillValue) : '') };
    }
    if (tool === 'tempexec.search_cases') {
      if (responseHint) return { handled: true, text: responseHint };
      var keyword = toolData && toolData.term ? String(toolData.term) : '';
      var total = Number(toolData && toolData.total);
      if (!Number.isFinite(total) || total < 0) total = 0;
      var matched = Number(toolData && toolData.matched);
      if (!Number.isFinite(matched) || matched < 0) matched = 0;
      if (!keyword) return { handled: true, text: '已清空用例搜索。当前共 ' + total + ' 条。' };
      return { handled: true, text: '已搜索关键词“' + keyword + '”，命中 ' + matched + ' / ' + total + ' 条。' };
    }
    if (tool === 'tempexec.show_xmind') {
      return { handled: true, text: responseHint || '已打开 XMind 结构展示。' };
    }
    if (tool === 'tempexec.export_xmind') {
      return { handled: true, text: responseHint || '已触发 XMind 导出。' };
    }
    if (tool === 'tempexec.next_file') {
      var nextName = toolData && toolData.fileName ? String(toolData.fileName) : '';
      return { handled: true, text: responseHint || ('已切换到下一份用例：' + (nextName || '目标用例')) };
    }
    if (tool === 'tempexec.switch_file') {
      var switchedName = toolData && toolData.fileName ? String(toolData.fileName) : '';
      return { handled: true, text: responseHint || ('已切换用例：' + (switchedName || '目标用例')) };
    }

    if (tool === 'page.current_info') {
      var pageData = toolData && typeof toolData === 'object' ? toolData : {};
      var tab = pageData.tab ? String(pageData.tab) : '';
      var tabLabel = getTabLabelById(tab);
      var fileName = getPageFileName();
      var lines = [];
      if (tabLabel && tab) lines.push('当前页面是：' + tabLabel + '（' + tab + '）');
      else if (tabLabel) lines.push('当前页面是：' + tabLabel);
      else if (tab) lines.push('当前页面是：' + tab);
      else lines.push('当前页面信息暂不可用。');
      if (fileName) lines.push('页面文件：' + fileName);
      if (responseHint) lines.unshift(responseHint);
      return { handled: true, text: lines.join('\n') };
    }
    if (tool === 'page.get_data') {
      if (looksLikeCaseHistoryIntent(userText)) {
        var summarizedPageData = await summarizeCaseHistoryPageDataByModel(userText, toolData || {}, responseHint || '');
        if (summarizedPageData) return { handled: true, text: summarizedPageData };
        var historyFallback = buildCaseHistoryFallbackText(userText, toolData || {}, responseHint || '');
        if (historyFallback) return { handled: true, text: historyFallback };
      }
      if (responseHint) {
        return { handled: true, text: responseHint + '\n' + formatJsonCompact(toolData) };
      }
      return { handled: true, text: '按你的意图返回页面数据：\n' + formatJsonCompact(toolData) };
    }
    if (tool === 'nav.switch_tab') {
      var switchedTab = toolData && toolData.tab ? String(toolData.tab) : (args.tab ? String(args.tab) : '');
      if (responseHint) return { handled: true, text: responseHint };
      return { handled: true, text: '已按你的意图跳转到：' + switchedTab };
    }
    if (tool === 'cases.list_current') {
      var fallbackCasesText = (args.countOnly === true || args.count === true)
        ? formatCaseCountResponse(toolData || {})
        : formatCaseListResponse(toolData || {});
      var summarizedCases = await summarizeMcpToolResultByModel(userText, tool, args, toolData || {}, fallbackCasesText);
      if (summarizedCases) return { handled: true, text: summarizedCases };
      return { handled: true, text: fallbackCasesText };
    }
    if (tool === 'web.search') {
      var query = args.query && String(args.query).trim() ? String(args.query).trim() : String(userText || '').trim();
      var summarized = await summarizeWebSearchByModel(userText, query, toolData || {}, responseHint || '');
      if (summarized) return { handled: true, text: summarized };
      return { handled: true, text: buildCompactWebSearchFallback(toolData || {}, responseHint || '') };
    }
    if (tool === 'assistant.list_scaffolds') {
      var scaffolds = Array.isArray(toolData && toolData.scaffolds) ? toolData.scaffolds : [];
      if (!scaffolds.length) return { handled: true, text: '当前没有可用展示手脚架。' };
      var scaffoldLines = ['当前可用展示手脚架：'];
      scaffolds.forEach(function(item, idx) {
        var row = item && typeof item === 'object' ? item : {};
        var name = row.name ? String(row.name) : ('scaffold_' + (idx + 1));
        var desc = row.description ? String(row.description) : '';
        scaffoldLines.push((idx + 1) + '. ' + name + (desc ? ('：' + desc) : ''));
      });
      return { handled: true, text: scaffoldLines.join('\n') };
    }
    if (tool === 'assistant.render_scaffold') {
      var scaffoldContent = toolData && toolData.content ? String(toolData.content).trim() : '';
      var explicitScaffoldResponse = item.response && String(item.response).trim()
        ? String(item.response).trim()
        : '';
      if (scaffoldContent) {
        return { handled: true, text: explicitScaffoldResponse ? (explicitScaffoldResponse + '\n' + scaffoldContent) : scaffoldContent };
      }
      return { handled: true, text: explicitScaffoldResponse || '标准展示已生成。' };
    }
    if (tool === 'memo.list') {
      return { handled: true, text: formatMemoListText(toolData || []) };
    }
    if (tool === 'memo.add') {
      var added = toolData && toolData.text ? String(toolData.text) : (actionPayload && actionPayload.text ? String(actionPayload.text) : '');
      if (responseHint) return { handled: true, text: responseHint };
      return { handled: true, text: '已新增备忘：' + added };
    }
    if (tool === 'memo.toggle') {
      var doneIndex = toPositiveInt(toolData && toolData.index ? toolData.index : (actionPayload ? actionPayload.index : 1), 1);
      var doneValue = toolData && toolData.done === true;
      if (responseHint) return { handled: true, text: responseHint };
      return { handled: true, text: doneValue ? ('已将备忘第 ' + doneIndex + ' 条标记为完成。') : ('已将备忘第 ' + doneIndex + ' 条标记为未完成。') };
    }
    if (tool === 'memo.remove') {
      var removedIndex = toPositiveInt(toolData && toolData.index ? toolData.index : (actionPayload ? actionPayload.index : 1), 1);
      if (responseHint) return { handled: true, text: responseHint };
      return { handled: true, text: '已删除第 ' + removedIndex + ' 条备忘。' };
    }
    if (tool === 'settings.describe') {
      var descText = toolData && toolData.description ? String(toolData.description) : '';
      if (!descText) descText = '该设置项说明暂不可用。';
      return { handled: true, text: descText };
    }
    if (tool === 'settings.patch') {
      var patchKeys = actionPayload && actionPayload.patch && typeof actionPayload.patch === 'object'
        ? Object.keys(actionPayload.patch)
        : [];
      if (responseHint) return { handled: true, text: responseHint };
      if (!patchKeys.length) return { handled: true, text: '设置已更新。' };
      return { handled: true, text: '设置已更新：' + patchKeys.join('、') };
    }
    if (tool === 'case.update') {
      var updateField = toolData && toolData.field ? String(toolData.field) : (args.field ? String(args.field) : '');
      var updateValue = toolData && toolData.value !== undefined && toolData.value !== null
        ? String(toolData.value)
        : (args.value !== undefined && args.value !== null ? String(args.value) : '');
      var updateIndex = toPositiveInt(toolData && toolData.index ? toolData.index : (args.index ? args.index : 1), 1);
      var updateCount = Number(toolData && toolData.count);
      var updateScope = toolData && toolData.scope ? String(toolData.scope).toLowerCase() : (args.scope ? String(args.scope).toLowerCase() : '');
      var fieldLabelMap = {
        module: '模块',
        title: '标题',
        priority: '优先级',
        precondition: '前置条件',
        preconditions: '前置条件',
        steps: '步骤',
        expected: '预期结果',
        remark: '备注',
        actual: '执行结果',
      };
      var fieldLabel = fieldLabelMap[updateField] || updateField || '字段';
      var updateClear = toolData && toolData.cleared === true;
      if (!updateClear && isCaseUpdateClearableField(updateField) && updateValue === '') updateClear = true;
      if (responseHint) return { handled: true, text: responseHint };
      if (updateScope === 'all' || (Number.isFinite(updateCount) && updateCount > 1)) {
        var total = Number.isFinite(updateCount) && updateCount > 0 ? Math.floor(updateCount) : 1;
        if (updateClear) return { handled: true, text: '已批量修改用例：共 ' + total + ' 条，已清空' + fieldLabel };
        return { handled: true, text: '已批量修改用例：共 ' + total + ' 条，' + fieldLabel + ' = ' + updateValue };
      }
      if (updateClear) return { handled: true, text: '已修改用例：第 ' + updateIndex + ' 条，已清空' + fieldLabel };
      return { handled: true, text: '已修改用例：第 ' + updateIndex + ' 条，' + fieldLabel + ' = ' + updateValue };
    }
    if (tool === 'case.delete') {
      var deletedIdx = toPositiveInt(toolData && toolData.index ? toolData.index : (actionPayload ? actionPayload.index : 1), 1);
      if (responseHint) return { handled: true, text: responseHint };
      return { handled: true, text: '删除已触发：第 ' + deletedIdx + ' 条。若误删可在8秒内撤回。' };
    }
    if (tool === 'casegen.run') {
      return { handled: true, text: responseHint || '已触发用例生成流程，请查看用例生成页面进度。' };
    }
    if (tool === 'missing_recommend.run') {
      return { handled: true, text: responseHint || '已触发漏测推荐，请在页面确认后再生成。' };
    }

    if (actionPayload) {
      // MCP 失败时回退到旧动作执行链路，保持可用性。
      return executeModelPlannedAction(actionPayload, userText, responseHint);
    }
    if (responseHint) return { handled: true, text: responseHint };
    return { handled: true, text: '工具已执行：' + tool + '\n' + formatJsonCompact(toolData || {}) };
  }

  function sanitizeSettingsPatchFromModel(patch) {
    var source = patch && typeof patch === 'object' ? patch : {};
    var out = {};
    var allowKeys = [
      'assistantEnabled',
      'assistantModelId',
      'missingCaseReminderAiEnabled',
      'smartTopNavCollapse',
      'theme',
      'timeoutSec',
    ];
    for (var i = 0; i < allowKeys.length; i += 1) {
      var key = allowKeys[i];
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
      out[key] = source[key];
    }
    return out;
  }

  async function runModelWebSearchAction(userText, actionPayload, defaultResponse) {
    var payload = actionPayload && typeof actionPayload === 'object' ? actionPayload : {};
    var responseHint = payload.response && String(payload.response).trim()
      ? String(payload.response).trim()
      : (defaultResponse ? String(defaultResponse).trim() : '');
    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.searchWeb !== 'function') {
      return { handled: true, text: '当前环境未开启联网搜索能力。' };
    }
    var searchQuery = payload.query && String(payload.query).trim()
      ? String(payload.query).trim()
      : String(userText || '').trim();
    var normalizedWeatherQuery = normalizeWeatherSearchQuery(searchQuery, userText);
    if ((looksLikeWeatherText(searchQuery) || looksLikeWeatherText(userText)) && !normalizedWeatherQuery) {
      return { handled: true, text: '可以。请先告诉我你所在的城市（例如“深圳”），我再给你今天的天气简报。' };
    }
    if (normalizedWeatherQuery) searchQuery = normalizedWeatherQuery;
    var searchRes = null;
    setStatus('正在联网搜索...');
    try {
      searchRes = await apis.assistantApi.searchWeb(searchQuery, { limit: 5 });
    } catch (err) {
      searchRes = { ok: false, reason: err && err.message ? String(err.message) : '联网搜索异常' };
    }
    if (!searchRes || searchRes.ok !== true) {
      setStatus('联网搜索失败');
      return {
        handled: true,
        text: '联网搜索失败：' + (searchRes && searchRes.reason ? searchRes.reason : '未知错误'),
      };
    }
    setStatus('');
    var summarized = await summarizeWebSearchByModel(userText, searchQuery, searchRes, responseHint || '');
    if (summarized) return { handled: true, text: summarized };
    return { handled: true, text: buildCompactWebSearchFallback(searchRes, responseHint || '') };
  }

  function isEditorScopedCaseListQuery(scopeText) {
    var scope = scopeText === undefined || scopeText === null ? '' : String(scopeText).trim().toLowerCase();
    if (!scope) return false;
    return scope === 'editor' || scope === 'page' || scope === 'current_page' || scope === 'current';
  }

  function shouldSyncCaseSearchToPage(userText, filterInfo) {
    var raw = String(userText || '').trim();
    if (!raw) return false;
    if (!containsAny(raw, ['搜索', '查找', '筛选', '过滤', '搜', '找出', '筛出', '挑出', '列出', '列一下', '展示', '显示', '给我看', '看下', '看一下', '看看'])) return false;
    var info = filterInfo && typeof filterInfo === 'object' ? filterInfo : {};
    var include = Array.isArray(info.includeKeywords) ? info.includeKeywords : [];
    return include.length > 0;
  }

  function pickPrimaryCaseSearchKeyword(filterInfo) {
    var info = filterInfo && typeof filterInfo === 'object' ? filterInfo : {};
    var include = Array.isArray(info.includeKeywords) ? info.includeKeywords : [];
    if (!include.length) return '';
    for (var i = 0; i < include.length; i += 1) {
      var value = String(include[i] || '').trim();
      if (!value) continue;
      return value;
    }
    return '';
  }

  async function syncCaseSearchStateToPage(userText, filterInfo, options) {
    var opts = options && typeof options === 'object' ? options : {};
    if (opts.pageScoped !== true) return { synced: false };
    if (!shouldSyncCaseSearchToPage(userText, filterInfo)) return { synced: false };
    var keyword = pickPrimaryCaseSearchKeyword(filterInfo);
    if (!keyword) return { synced: false };
    var apis = getApis();
    if (!apis.assistantMcpApi || typeof apis.assistantMcpApi.callTool !== 'function') return { synced: false };
    var tab = '';
    if (apis.assistantApi && typeof apis.assistantApi.getPageData === 'function') {
      try {
        var pageData = apis.assistantApi.getPageData('');
        tab = pageData && pageData.tab ? String(pageData.tab).trim().toLowerCase() : '';
      } catch (err) {
        tab = '';
      }
    }
    try {
      if (tab === 'tempexec') {
        var searchRes = await apis.assistantMcpApi.callTool('tempexec.search_cases', { term: keyword });
        if (searchRes && searchRes.ok === true) return { synced: true, tab: tab, keyword: keyword };
        return { synced: false };
      }
      if (tab === 'case-library') {
        var fillRes = await apis.assistantMcpApi.callTool('ui.fill_input', { value: keyword });
        if (fillRes && fillRes.ok === true) return { synced: true, tab: tab, keyword: keyword };
        return { synced: false };
      }
    } catch (err2) {
      return { synced: false };
    }
    return { synced: false };
  }

  async function runModelCaseListAction(userText, actionPayload, defaultResponse, options) {
    var payload = actionPayload && typeof actionPayload === 'object' ? actionPayload : {};
    var opts = options && typeof options === 'object' ? options : {};
    var responseHint = payload.response && String(payload.response).trim()
      ? String(payload.response).trim()
      : (defaultResponse ? String(defaultResponse).trim() : '');
    var queryText = payload.query && String(payload.query).trim()
      ? String(payload.query).trim()
      : String(userText || '').trim();
    var scopeRaw = payload.scope === undefined || payload.scope === null ? '' : String(payload.scope).trim().toLowerCase();
    var pageScoped = payload.pageScoped === true
      || isEditorScopedCaseListQuery(scopeRaw)
      || isCurrentPageCaseIntent(queryText || userText)
      || shouldPreferCurrentPageScopeForCaseQuery(queryText || userText);
    var countOnly = payload.countOnly === true
      || payload.count === true
      || String(payload.mode || '').trim().toLowerCase() === 'count'
      || isCaseCountIntent(queryText || userText);
    var detailLevel = payload.detailLevel === undefined || payload.detailLevel === null
      ? ''
      : String(payload.detailLevel).trim().toLowerCase();
    var fullDetail = detailLevel === 'full' || isCurrentCaseFullDetailIntent(queryText || userText) || isCaseDetailClarificationIntent(queryText || userText);
    var modelFilterPlan = await planCaseListFilterByModel(queryText || userText);
    var filterInfo = modelFilterPlan && modelFilterPlan.planned === true && modelFilterPlan.filterInfo
      ? modelFilterPlan.filterInfo
      : extractCaseListFilterInfo(queryText || userText);
    var hasFilter = filterInfo && filterInfo.hasFilter === true;
    var maxQueryLimit = (fullDetail || hasFilter) ? 1000 : 100;
    var defaultLimit = hasFilter ? maxQueryLimit : (countOnly ? 20 : maxQueryLimit);
    var queryLimit = toPositiveInt(payload.limit, defaultLimit);
    if (!Number.isFinite(queryLimit) || queryLimit <= 0) queryLimit = defaultLimit;
    if (queryLimit > maxQueryLimit) queryLimit = maxQueryLimit;
    await syncCaseSearchStateToPage(queryText || userText, filterInfo, { pageScoped: pageScoped });
    var mcpArgs = {
      limit: queryLimit,
      scope: pageScoped ? 'editor' : 'project',
      requireEditor: pageScoped,
      countOnly: countOnly,
      detailLevel: fullDetail ? 'full' : 'summary',
      query: queryText,
    };

    var apis = getApis();
    var res = null;
    setStatus('正在获取用例数据...');
    if (!opts.skipMcp && apis.assistantMcpApi && typeof apis.assistantMcpApi.callTool === 'function') {
      try {
        var mcpRes = await apis.assistantMcpApi.callTool('cases.list_current', mcpArgs);
        if (mcpRes && mcpRes.ok === true && mcpRes.data && typeof mcpRes.data === 'object') {
          res = mcpRes.data;
        }
      } catch (err) {
        res = null;
      }
    }
    if (!res && apis.assistantApi && typeof apis.assistantApi.listCurrentCases === 'function') {
      try {
        res = await apis.assistantApi.listCurrentCases({
          limit: mcpArgs.limit,
          scope: mcpArgs.scope,
          requireEditor: mcpArgs.requireEditor,
          detailLevel: mcpArgs.detailLevel,
        });
      } catch (err2) {
        res = { ok: false, reason: err2 && err2.message ? String(err2.message) : '读取异常' };
      }
    }
    if (!res) {
      setStatus('用例数据获取失败');
      return { handled: true, text: '当前环境不支持读取用例列表。' };
    }
    if (res.ok !== true) {
      setStatus('用例数据获取失败');
      return { handled: true, text: '获取用例列表失败：' + (res.reason ? String(res.reason) : '未知错误') };
    }
    setStatus('');
    var scope = res.scope === undefined || res.scope === null ? '' : String(res.scope).trim();
    var isEditorScope = scope === 'editor' || (res.caseFile && typeof res.caseFile === 'object');
    var sourceItems = Array.isArray(res.items) ? res.items : [];
    var filteredItems = null;
    if (hasFilter && isEditorScope) {
      filteredItems = applyCaseListFilter(sourceItems, filterInfo);
    }
    var fallbackCasesText = '';
    if (countOnly) {
      if (filteredItems) {
        fallbackCasesText = formatFilteredEditorCaseCountResponse(res, filteredItems, filterInfo);
      } else {
        fallbackCasesText = formatCaseCountResponse(res);
      }
    } else {
      if (filteredItems) {
        fallbackCasesText = formatFilteredEditorCaseListResponse(res, filteredItems, filterInfo);
      } else {
        fallbackCasesText = formatCaseListResponse(res);
      }
    }
    var modelCaseData = res;
    if (filteredItems) {
      var totalAllRaw = Number(res.totalAll);
      if (!Number.isFinite(totalAllRaw) || totalAllRaw < 0) totalAllRaw = sourceItems.length;
      modelCaseData = Object.assign({}, res, {
        items: filteredItems,
        total: filteredItems.length,
        totalAll: totalAllRaw,
        filterInfo: filterInfo,
      });
    }
    var clarificationIntent = isCaseDetailClarificationIntent(queryText || userText);
    var allCaseDisplayIntent = isExplicitAllCaseDisplayIntent(queryText || userText);
    var targetRequired = shouldRequireSpecificCaseDetailTarget(queryText || userText) || clarificationIntent;
    var shouldResolveTarget = !allCaseDisplayIntent && (clarificationIntent || hasDirectCaseDetailReference(modelCaseData, queryText || userText));
    if (!countOnly && fullDetail && shouldResolveTarget) {
      var resolvedTarget = resolveRequestedCaseDetailTarget(modelCaseData, queryText || userText, {
        includeConversationContext: clarificationIntent,
      });
      if (resolvedTarget && resolvedTarget.item) {
        modelCaseData = Object.assign({}, modelCaseData, {
          items: [Object.assign({}, resolvedTarget.item)],
          total: 1,
          truncated: false,
          targetReason: resolvedTarget.reason,
        });
        fallbackCasesText = formatCaseListResponse(modelCaseData);
      } else if (targetRequired) {
        return { handled: true, text: buildCaseDetailTargetMissingText(modelCaseData, queryText || userText) };
      }
    }
    var summarizedCases = await summarizeMcpToolResultByModel(userText, 'cases.list_current', mcpArgs, modelCaseData, fallbackCasesText);
    if (summarizedCases) return { handled: true, text: summarizedCases };
    if (responseHint && responseHint !== fallbackCasesText) {
      return { handled: true, text: responseHint + '\n' + fallbackCasesText };
    }
    return { handled: true, text: fallbackCasesText };
  }

  async function executeModelPlannedAction(actionPayload, userText, defaultResponse) {
    var payload = actionPayload && typeof actionPayload === 'object' ? actionPayload : {};
    var action = normalizeModelActionName(payload.action || payload.name || '');
    var responseText = payload.response && String(payload.response).trim()
      ? String(payload.response).trim()
      : (defaultResponse ? String(defaultResponse).trim() : '');
    var apis = getApis();

    if (!action || action === 'reply') {
      if (responseText) return { handled: true, text: responseText };
      if (payload.text && String(payload.text).trim()) return { handled: true, text: String(payload.text).trim() };
      return null;
    }

    if (action === 'query_case_list') {
      var caseActionRes = await runModelCaseListAction(userText, payload, responseText, {
        skipMcp: payload._mcpUnavailable === true,
      });
      if (caseActionRes && caseActionRes.handled === true) return caseActionRes;
      return null;
    }

    if (action === 'current_page_info') {
      var currentPageReply = tryHandleCurrentPageIntent(payload.query || userText);
      if (currentPageReply) return { handled: true, text: currentPageReply };
      return null;
    }

    if (action === 'navigate') {
      var targetTabRaw = payload.tab ? String(payload.tab) : '';
      var targetTab = targetTabRaw && isKnownTabId(targetTabRaw) ? targetTabRaw : parseTabFromText(payload.query || userText);
      if (!targetTab) return null;
      if (apis.assistantApi && typeof apis.assistantApi.switchTab === 'function') {
        apis.assistantApi.switchTab(targetTab);
        if (responseText) return { handled: true, text: responseText };
        return { handled: true, text: '已按你的意图跳转到：' + targetTab };
      }
      return null;
    }

    if (action === 'query_page_data') {
      if (isCaseListIntent(userText)) {
        var casePayloadByQuery = {
          action: 'query_case_list',
          scope: payload.scope || '',
          query: payload.query || userText,
          countOnly: payload.countOnly === true || payload.count === true,
          response: responseText,
        };
        var caseListByQuery = await runModelCaseListAction(userText, casePayloadByQuery, responseText, {
          skipMcp: payload._mcpUnavailable === true,
        });
        if (caseListByQuery && caseListByQuery.handled === true) {
          return caseListByQuery;
        }
      }
      var queryTabRaw = payload.tab ? String(payload.tab) : '';
      var queryTab = queryTabRaw && isKnownTabId(queryTabRaw) ? queryTabRaw : parseTabFromText(payload.query || userText);
      if (!queryTab && !isProjectScopedText(payload.query || userText)) return null;
      if (apis.assistantApi && typeof apis.assistantApi.getPageData === 'function') {
        var data = apis.assistantApi.getPageData(queryTab || '');
        var pageQueryText = payload.query || userText;
        if (looksLikeCaseHistoryIntent(pageQueryText)) {
          var summarizedChangeData = await summarizeCaseChangePageData(pageQueryText, data || {}, responseText || '');
          if (summarizedChangeData) {
            return { handled: true, text: summarizedChangeData };
          }
        }
        if (responseText) {
          return { handled: true, text: responseText + '\n' + formatJsonCompact(data) };
        }
        return { handled: true, text: '按你的意图返回页面数据：\n' + formatJsonCompact(data) };
      }
      return null;
    }

    if (action === 'web_search') {
      return runModelWebSearchAction(userText, payload, responseText || '');
    }

    if (action === 'memo_list') {
      if (!apis.assistantApi || typeof apis.assistantApi.memoList !== 'function') return { handled: true, text: '备忘能力暂不可用' };
      return { handled: true, text: formatMemoListText(apis.assistantApi.memoList() || []) };
    }

    if (action === 'memo_add') {
      if (!apis.assistantApi || typeof apis.assistantApi.memoAdd !== 'function') return { handled: true, text: '备忘能力暂不可用' };
      var memoText = payload.text && String(payload.text).trim()
        ? String(payload.text).trim()
        : (payload.content && String(payload.content).trim() ? String(payload.content).trim() : '');
      if (!memoText) return { handled: true, text: '请提供要新增的备忘内容。' };
      if (!await requireDoubleConfirmForAction('memo_add', { text: memoText })) return { handled: true, text: '已取消。' };
      var addRes = apis.assistantApi.memoAdd(memoText, payload.tab || '');
      if (!addRes || addRes.ok !== true) return { handled: true, text: addRes && addRes.reason ? addRes.reason : '新增失败' };
      return { handled: true, text: '已新增备忘：' + memoText };
    }

    if (action === 'memo_toggle') {
      if (!apis.assistantApi || typeof apis.assistantApi.memoToggle !== 'function') return { handled: true, text: '备忘能力暂不可用' };
      var doneIndex = toPositiveInt(payload.index, 1);
      var doneValue = payload.done === undefined ? true : payload.done === true || String(payload.done).toLowerCase() === 'true' || String(payload.done) === '1';
      if (!await requireDoubleConfirmForAction('memo_toggle', { index: doneIndex, done: doneValue })) return { handled: true, text: '已取消。' };
      var toggleRes = apis.assistantApi.memoToggle(payload.tab || '', doneIndex, doneValue);
      if (!toggleRes || toggleRes.ok !== true) return { handled: true, text: toggleRes && toggleRes.reason ? toggleRes.reason : '更新失败' };
      return { handled: true, text: doneValue ? ('已将备忘第 ' + doneIndex + ' 条标记为完成。') : ('已将备忘第 ' + doneIndex + ' 条标记为未完成。') };
    }

    if (action === 'memo_remove') {
      if (!apis.assistantApi || typeof apis.assistantApi.memoRemove !== 'function') return { handled: true, text: '备忘能力暂不可用' };
      var removeIndex = toPositiveInt(payload.index, 1);
      if (!await requireDoubleConfirmForAction('memo_remove', { index: removeIndex })) return { handled: true, text: '已取消。' };
      var removeRes = apis.assistantApi.memoRemove(payload.tab || '', removeIndex);
      if (!removeRes || removeRes.ok !== true) return { handled: true, text: removeRes && removeRes.reason ? removeRes.reason : '删除失败' };
      return { handled: true, text: '已删除第 ' + removeIndex + ' 条备忘。' };
    }

    if (action === 'settings_describe') {
      if (!apis.assistantSettingsApi || typeof apis.assistantSettingsApi.describeSetting !== 'function') return { handled: true, text: '设置能力暂不可用。' };
      var explainKey = payload.key ? String(payload.key).trim() : parseSettingKey(userText || '');
      if (!explainKey) return { handled: true, text: '请先告诉我要查看哪一个设置项。' };
      return { handled: true, text: apis.assistantSettingsApi.describeSetting(explainKey) };
    }

    if (action === 'settings_patch') {
      if (!apis.assistantSettingsApi || typeof apis.assistantSettingsApi.applyPatch !== 'function') return { handled: true, text: '设置能力暂不可用。' };
      var patch = sanitizeSettingsPatchFromModel(payload.patch || payload.settings || {});
      var patchKeys = Object.keys(patch);
      if (!patchKeys.length) return { handled: true, text: '未提供可应用的设置项。' };
      if (Object.prototype.hasOwnProperty.call(patch, 'assistantEnabled') && patch.assistantEnabled === false) {
        return { handled: true, text: '安全策略限制：助手不能通过聊天关闭自己，请在设置页手动关闭。' };
      }
      if (!await requireDoubleConfirmForAction('settings_patch', { patch: patch })) return { handled: true, text: '已取消。' };
      var patchRes = apis.assistantSettingsApi.applyPatch(patch, { source: 'assistant-model-planner' });
      if (!patchRes || patchRes.ok !== true) {
        return { handled: true, text: patchRes && patchRes.reason ? patchRes.reason : '设置失败' };
      }
      if (responseText) return { handled: true, text: responseText };
      return { handled: true, text: '设置已更新：' + patchKeys.join('、') };
    }

    if (action === 'update_case') {
      var updateArgs = {};
      if (payload.patch && typeof payload.patch === 'object') updateArgs.patch = payload.patch;
      if (payload.field !== undefined && payload.field !== null) updateArgs.field = payload.field;
      if (payload.key !== undefined && payload.key !== null) updateArgs.key = payload.key;
      if (payload.value !== undefined && payload.value !== null) updateArgs.value = payload.value;
      if (payload.to !== undefined && payload.to !== null) updateArgs.to = payload.to;
      if (payload.index !== undefined && payload.index !== null) updateArgs.index = payload.index;
      if (payload.itemIndex !== undefined && payload.itemIndex !== null) updateArgs.itemIndex = payload.itemIndex;

      if (apis.assistantMcpApi && typeof apis.assistantMcpApi.callTool === 'function') {
        var mcpUpdateRes = null;
        try {
          mcpUpdateRes = await apis.assistantMcpApi.callTool('case.update', updateArgs);
        } catch (err0) {
          mcpUpdateRes = { ok: false, reason: err0 && err0.message ? String(err0.message) : '修改失败' };
        }
        if (mcpUpdateRes && mcpUpdateRes.ok !== true && String(mcpUpdateRes.reason || '') === 'confirm_required') {
          var confirmData = mcpUpdateRes.data && typeof mcpUpdateRes.data === 'object' ? mcpUpdateRes.data : {};
          var allowed = await requestAssistantOperationApproval(
            confirmData.actionLabel ? String(confirmData.actionLabel) : '修改用例',
            {
              detail: confirmData.message ? String(confirmData.message) : '',
              reason: '当前操作涉及数据写入或状态变更。',
            }
          );
          if (!allowed) return { handled: true, text: '已取消。' };
          try {
            mcpUpdateRes = await apis.assistantMcpApi.callTool('case.update', Object.assign({}, updateArgs, { confirmed: true }));
          } catch (err1) {
            mcpUpdateRes = { ok: false, reason: err1 && err1.message ? String(err1.message) : '修改失败' };
          }
        }
        if (!mcpUpdateRes || mcpUpdateRes.ok !== true) {
          return { handled: true, text: mcpUpdateRes && mcpUpdateRes.reason ? String(mcpUpdateRes.reason) : '修改失败' };
        }
        var updateData = mcpUpdateRes.data && typeof mcpUpdateRes.data === 'object' ? mcpUpdateRes.data : {};
        var idx = toPositiveInt(updateData.index || updateArgs.index || 1, 1);
        var field = updateData.field ? String(updateData.field) : (updateArgs.field ? String(updateArgs.field) : '');
        var val = updateData.value !== undefined && updateData.value !== null ? String(updateData.value) : (updateArgs.value !== undefined && updateArgs.value !== null ? String(updateArgs.value) : '');
        if (responseText) return { handled: true, text: responseText };
        return { handled: true, text: '已修改用例：第 ' + idx + ' 条，' + field + ' = ' + val };
      }

      if (!apis.assistantApi || typeof apis.assistantApi.updateCase !== 'function') return { handled: true, text: '当前页面不支持助手修改用例。' };
      if (!await requireDoubleConfirmForAction('update_case', updateArgs)) return { handled: true, text: '已取消。' };
      var updateRes = apis.assistantApi.updateCase(updateArgs);
      if (!updateRes || updateRes.ok !== true) return { handled: true, text: updateRes && updateRes.reason ? String(updateRes.reason) : '修改失败' };
      if (responseText) return { handled: true, text: responseText };
      var updateIdx = toPositiveInt(updateRes.index || updateArgs.index || 1, 1);
      var updateField = updateRes.field ? String(updateRes.field) : (updateArgs.field ? String(updateArgs.field) : '');
      var updateVal = updateRes.value !== undefined && updateRes.value !== null ? String(updateRes.value) : (updateArgs.value !== undefined && updateArgs.value !== null ? String(updateArgs.value) : '');
      return { handled: true, text: '已修改用例：第 ' + updateIdx + ' 条，' + updateField + ' = ' + updateVal };
    }

    if (action === 'delete_case') {
      if (!apis.assistantApi || typeof apis.assistantApi.deleteCase !== 'function') return { handled: true, text: '当前页面不支持助手删除用例。' };
      var idx = toPositiveInt(payload.index, 1);
      if (!await requireDoubleConfirmForAction('delete_case', { index: idx })) return { handled: true, text: '已取消。' };
      var delRes = apis.assistantApi.deleteCase(idx);
      if (!delRes || delRes.ok !== true) return { handled: true, text: delRes && delRes.reason ? delRes.reason : '删除触发失败' };
      return { handled: true, text: '删除已触发：第 ' + delRes.index + ' 条。若误删可在8秒内撤回。' };
    }

    if (action === 'run_case_generation') {
      if (!apis.assistantApi || typeof apis.assistantApi.runCaseGeneration !== 'function') return { handled: true, text: '用例生成能力暂不可用' };
      if (!await requireDoubleConfirmForAction('run_case_generation', {})) return { handled: true, text: '已取消。' };
      setStatus('正在触发用例生成...');
      var caseGenRes = await apis.assistantApi.runCaseGeneration();
      if (!caseGenRes || caseGenRes.ok !== true) {
        return { handled: true, text: caseGenRes && caseGenRes.reason ? caseGenRes.reason : '用例生成触发失败' };
      }
      return { handled: true, text: responseText || '已触发用例生成流程，请查看用例生成页面进度。' };
    }

    if (action === 'run_missing_recommendation') {
      if (!apis.assistantApi || typeof apis.assistantApi.runMissingRecommendation !== 'function') return { handled: true, text: '漏测推荐能力暂不可用' };
      if (!await requireDoubleConfirmForAction('run_missing_recommendation', {})) return { handled: true, text: '已取消。' };
      setStatus('正在触发漏测推荐...');
      var missRes = await apis.assistantApi.runMissingRecommendation();
      if (!missRes || missRes.ok !== true) {
        return { handled: true, text: missRes && missRes.reason ? missRes.reason : '漏测推荐触发失败' };
      }
      return { handled: true, text: responseText || '已触发漏测推荐，请在页面确认后再生成。' };
    }

    if (responseText) return { handled: true, text: responseText };
    return null;
  }

  async function tryHandleModelDrivenReply(text) {
    var content = String(text || '').trim();
    if (!content) return null;
    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.callModel !== 'function') return null;
    var mcpTools = getAvailableMcpTools();
    var mcpToolLines = [];
    if (Array.isArray(mcpTools)) {
      for (var i = 0; i < mcpTools.length; i += 1) {
        var tool = mcpTools[i] && typeof mcpTools[i] === 'object' ? mcpTools[i] : {};
        var name = tool.name ? String(tool.name).trim() : '';
        if (!name) continue;
        var mode = tool.mode ? String(tool.mode).trim() : '';
        var desc = tool.description ? String(tool.description).trim() : '';
        mcpToolLines.push('- ' + name + (mode ? (' [' + mode + ']') : '') + (desc ? ('：' + desc) : ''));
      }
    }
    if (!mcpToolLines.length) {
      mcpToolLines = [
        '- page.current_info [read]',
        '- page.get_data [read]',
        '- nav.switch_tab [write]',
        '- cases.list_current [read]',
        '- web.search [read]',
      ];
    }

    var prompt = [
      '你是测试助手平台内置 AI 助手。',
      '默认根据用户问题自由判断最合适回答方式；只有在需要调用页面工具时才输出 JSON。',
      '输出规则：',
      '1) 直接回答时：输出自然语言，可使用 Markdown（含列表/表格/代码块）。',
      '2) 需要调用工具时：优先输出 MCP 工具调用 JSON，不要代码块。',
      'MCP 工具列表：',
      mcpToolLines.join('\n'),
      '如果平台已有合适的展示手脚架，可调用 assistant.render_scaffold；当不确定有哪些手脚架时，可先调用 assistant.list_scaffolds。',
      '当用户要求“完整展示/完整列出当前或该用例”时，优先使用 cases.list_current 读取完整字段；若需要标准横向用例表，优先调用 assistant.render_scaffold 的 case_table。',
      'MCP JSON 格式支持：',
      '{"mcp":{"tool":"tool.name","args":{}},"response":""}',
      '{"mcp":{"calls":[{"tool":"tool.name","args":{}}]},"response":""}',
      '兼容旧动作格式：',
      '{"action":"xxx","tab":"","query":"","response":""}',
      '{"actions":[{"action":"xxx"}],"response":""}',
      '约束：',
      '- 若输出 JSON，必须只输出一个 JSON 对象；不要连续输出多个 JSON 对象。',
      '- 当用户询问当前页面用例/数量时，优先使用 cases.list_current（或兼容动作 query_case_list）。',
      '- 当用户询问当前用例改动历史、执行页“用例变更”或变更内容时，优先使用 page.get_data 读取当前页面对应的变更快照后再整理回答。',
      '- 当用户追问“中文名/中文名称”且上文在问当前页面时，直接返回 current_page_info 或直接回答，不要让用户改问法。',
      '- 当问题依赖实时信息（天气/新闻/最新版本）时，优先使用 web_search。',
      '- 写入、编辑、删除类动作会在聊天区展示“允许操作/不允许”确认按钮；不要伪造执行结果。',
      '- 项目外问题正常回答，不要强行返回页面数据。',
    ].join('\n');
    var conversationHistory = buildConversationHistory(conversationHistoryLimit, content);
    var mcpReasoningMaxRounds = 4;
    var reasoningTrace = [];
    var seenPlanSignatures = {};

    async function callModelWithPrompt(promptText) {
      var res = null;
      try {
        res = await apis.assistantApi.callModel(content, {
          prompt: promptText,
          temperature: 0.2,
          history: conversationHistory,
        });
      } catch (err) {
        res = { ok: false, reason: err && err.message ? String(err.message) : '模型调用异常' };
      }
      return res;
    }

    var initialRes = await callModelWithPrompt(prompt);
    if (!initialRes || initialRes.ok !== true || !initialRes.content) return null;
    var currentRaw = String(initialRes.content || '').trim();
    if (!currentRaw) return null;

    for (var round = 1; round <= mcpReasoningMaxRounds; round += 1) {
      var parsed = parseJsonObjectFromText(currentRaw);
      if (!parsed || typeof parsed !== 'object') {
        return { handled: true, text: currentRaw };
      }
      var topLevelResponse = parsed.response && String(parsed.response).trim() ? String(parsed.response).trim() : '';

      var mcpCalls = extractModelMcpCallList(parsed);
      if (mcpCalls.length) {
        var mcpSignature = buildPlanSignature('mcp', mcpCalls);
        if (seenPlanSignatures[mcpSignature]) {
          if (topLevelResponse) return { handled: true, text: topLevelResponse };
          return { handled: true, text: '工具计划重复，已停止自动重试。' };
        }
        seenPlanSignatures[mcpSignature] = true;
        var mcpOutputs = [];
        for (var m = 0; m < mcpCalls.length; m += 1) {
          var mcpResult = await executeModelMcpToolCall(mcpCalls[m], content, topLevelResponse);
          if (!mcpResult || mcpResult.handled !== true) continue;
          var mcpTextOut = mcpResult.text === undefined || mcpResult.text === null ? '' : String(mcpResult.text).trim();
          if (!mcpTextOut) continue;
          if (mcpOutputs.indexOf(mcpTextOut) === -1) mcpOutputs.push(mcpTextOut);
        }
        if (!mcpOutputs.length && topLevelResponse) mcpOutputs.push(topLevelResponse);
        var mcpText = mcpOutputs.join('\n').trim();
        var continueMcp = shouldContinueMcpReasoning(content, mcpCalls, mcpOutputs);
        if (!continueMcp || round >= mcpReasoningMaxRounds) {
          if (mcpText) return { handled: true, text: mcpText };
          if (topLevelResponse) return { handled: true, text: topLevelResponse };
          return { handled: true, text: currentRaw };
        }
        reasoningTrace.push(formatReasoningTraceEntry(round, 'mcp', mcpCalls, mcpOutputs));
        var followPrompt = buildMcpReasoningPrompt(prompt, reasoningTrace);
        var followRes = await callModelWithPrompt(followPrompt);
        if (!followRes || followRes.ok !== true || !followRes.content) {
          if (mcpText) return { handled: true, text: mcpText };
          if (topLevelResponse) return { handled: true, text: topLevelResponse };
          return null;
        }
        currentRaw = String(followRes.content || '').trim();
        if (!currentRaw) {
          if (mcpText) return { handled: true, text: mcpText };
          if (topLevelResponse) return { handled: true, text: topLevelResponse };
          return null;
        }
        continue;
      }

      var actions = extractModelActionList(parsed);
      if (actions.length) {
        var actionSignature = buildPlanSignature('action', actions);
        if (seenPlanSignatures[actionSignature]) {
          if (topLevelResponse) return { handled: true, text: topLevelResponse };
          return { handled: true, text: '动作计划重复，已停止自动重试。' };
        }
        seenPlanSignatures[actionSignature] = true;
        var actionOutputs = [];
        for (var a = 0; a < actions.length; a += 1) {
          var actionResult = await executeModelPlannedAction(actions[a], content, topLevelResponse);
          if (!actionResult || actionResult.handled !== true) continue;
          var actionTextOut = actionResult.text === undefined || actionResult.text === null ? '' : String(actionResult.text).trim();
          if (!actionTextOut) continue;
          if (actionOutputs.indexOf(actionTextOut) === -1) actionOutputs.push(actionTextOut);
        }
        if (!actionOutputs.length && topLevelResponse) actionOutputs.push(topLevelResponse);
        var actionText = actionOutputs.join('\n').trim();
        var continueAction = shouldContinueActionReasoning(content, actions, actionOutputs);
        if (!continueAction || round >= mcpReasoningMaxRounds) {
          if (actionText) return { handled: true, text: actionText };
          if (topLevelResponse) return { handled: true, text: topLevelResponse };
          return { handled: true, text: currentRaw };
        }
        reasoningTrace.push(formatReasoningTraceEntry(round, 'action', actions, actionOutputs));
        var actionPrompt = buildMcpReasoningPrompt(prompt, reasoningTrace);
        var actionFollowRes = await callModelWithPrompt(actionPrompt);
        if (!actionFollowRes || actionFollowRes.ok !== true || !actionFollowRes.content) {
          if (actionText) return { handled: true, text: actionText };
          if (topLevelResponse) return { handled: true, text: topLevelResponse };
          return null;
        }
        currentRaw = String(actionFollowRes.content || '').trim();
        if (!currentRaw) {
          if (actionText) return { handled: true, text: actionText };
          if (topLevelResponse) return { handled: true, text: topLevelResponse };
          return null;
        }
        continue;
      }

      if (parsed.response && String(parsed.response).trim()) {
        return { handled: true, text: String(parsed.response).trim() };
      }
      return { handled: true, text: currentRaw };
    }

    return null;
  }

  function formatDiagnosisText(diag) {
    var diagnosis = diag && typeof diag === 'object' ? diag : {};
    var lines = [];
    if (diagnosis.judgement) lines.push('问题判断：' + diagnosis.judgement);
    if (diagnosis.rootCause) lines.push('可能原因：' + diagnosis.rootCause);
    if (Array.isArray(diagnosis.steps) && diagnosis.steps.length) {
      lines.push('建议步骤：');
      diagnosis.steps.forEach(function(step, idx) {
        lines.push((idx + 1) + '. ' + String(step));
      });
    }
    if (Array.isArray(diagnosis.manualItems) && diagnosis.manualItems.length) {
      lines.push('需手动处理：');
      diagnosis.manualItems.forEach(function(item, idx) {
        lines.push((idx + 1) + '. ' + String(item));
      });
    }
    if (!lines.length) lines.push('已完成诊断，但没有返回可展示内容。');
    return lines.join('\n');
  }

  function pushFailureHistory(entry) {
    var item = entry && typeof entry === 'object' ? entry : null;
    if (!item) return;
    failureHistory.push(item);
    if (failureHistory.length > failureHistoryLimit) {
      failureHistory = failureHistory.slice(-failureHistoryLimit);
    }
  }

  function onModelTestFailed(event) {
    var detail = event && event.detail ? event.detail : null;
    if (!detail || typeof detail !== 'object') return;
    if (detail.errorMessage && String(detail.errorMessage).indexOf('未选择模型') !== -1) return;
    pushFailureHistory(detail);
    if (!isAssistantEnabled()) {
      setStatus('检测到模型测试失败。开启助手后可自动诊断。');
      return;
    }
    setPanelVisible(true);
    addMessage('sys', '检测到模型测试失败，正在自动诊断...');
    runAutoDiagnosis(detail);
  }

  async function runAutoDiagnosis(detail) {
    var apis = getApis();
    if (!apis.assistantModelDiagApi || typeof apis.assistantModelDiagApi.diagnoseFailure !== 'function') {
      addMessage('ai', '诊断能力暂不可用，请稍后重试。');
      return;
    }
    setStatus('正在诊断模型报错...');
    var diagRes = null;
    try {
      diagRes = await apis.assistantModelDiagApi.diagnoseFailure(detail, {});
    } catch (err) {
      diagRes = { ok: false, reason: err && err.message ? String(err.message) : '诊断执行异常' };
    }
    var diagnosis = diagRes && diagRes.diagnosis ? diagRes.diagnosis : null;
    if (!diagnosis) {
      addMessage('ai', '诊断失败：' + (diagRes && diagRes.reason ? diagRes.reason : '未知错误'));
      setStatus('诊断失败');
      return;
    }
    var modelId = detail.modelId ? String(detail.modelId) : '';
    var patch = diagnosis.patch && typeof diagnosis.patch === 'object' ? diagnosis.patch : {};
    var patchKeys = Object.keys(patch);

    var actions = [];
    if (patchKeys.length && apis.assistantModelDiagApi && typeof apis.assistantModelDiagApi.applyModelPatch === 'function' && modelId) {
      actions.push({
        label: '应用建议配置',
        variant: 'allow',
        onClick: function() {
          var patchText = formatJsonCompact(patch);
          requestAssistantOperationApproval('应用建议模型配置', {
            detail: patchText,
            reason: '将写入模型配置（不包含 API Key）。',
          }).then(function(allowed) {
            if (!allowed) {
              addMessage('sys', '已取消应用建议配置。', { title: '系统' });
              return;
            }
            applyDiagnosisPatch(modelId, patch);
          });
        },
      });
    }
    if (modelId && apis.assistantModelDiagApi && typeof apis.assistantModelDiagApi.retestModel === 'function') {
      actions.push({
        label: '立即重测',
        onClick: function() {
          retestModelFromAssistant(modelId);
        },
      });
    }

    addMessage('ai', formatDiagnosisText(diagnosis), { actions: actions });
    setStatus('诊断完成');
  }

  async function applyDiagnosisPatch(modelId, patch) {
    var apis = getApis();
    if (!apis.assistantModelDiagApi || typeof apis.assistantModelDiagApi.applyModelPatch !== 'function') {
      addMessage('ai', '模型代填能力暂不可用。');
      return;
    }
    setStatus('正在应用建议配置...');
    var res = null;
    try {
      res = await apis.assistantModelDiagApi.applyModelPatch(modelId, patch, { source: 'assistant' });
    } catch (err) {
      res = { ok: false, reason: err && err.message ? String(err.message) : '模型配置写入异常' };
    }
    if (!res || res.ok !== true) {
      addMessage('ai', '配置应用失败：' + (res && res.reason ? res.reason : '未知错误'));
      setStatus('应用失败');
      return;
    }
    addMessage('ai', '建议配置已应用成功。你可以点击“立即重测”验证。');
    refreshState();
    dispatchAppEvent('app-assistant-state-changed', { source: 'assistant-patch-applied' });
    setStatus('配置已应用');
  }

  async function retestModelFromAssistant(modelId) {
    var apis = getApis();
    if (!apis.assistantModelDiagApi || typeof apis.assistantModelDiagApi.retestModel !== 'function') {
      addMessage('ai', '重测能力暂不可用。');
      return;
    }
    setStatus('正在重测模型...');
    var result = null;
    try {
      result = await apis.assistantModelDiagApi.retestModel(modelId, 'assistant-retest');
    } catch (err) {
      result = { ok: false, errorMessage: err && err.message ? String(err.message) : '重测执行异常' };
    }
    if (result && result.ok) {
      addMessage('ai', '重测成功：模型可用。');
      setStatus('重测成功');
      return;
    }
    addMessage('ai', '重测失败：' + (result && result.errorMessage ? result.errorMessage : '未知错误'));
    setStatus('重测失败');
  }

  function getPreviousUserMessageText(currentText) {
    var latest = String(currentText || '').trim();
    var skippedCurrent = false;
    for (var i = chatHistory.length - 1; i >= 0; i -= 1) {
      var msg = chatHistory[i];
      if (!msg || msg.role !== 'user') continue;
      var text = msg.text === undefined || msg.text === null ? '' : String(msg.text).trim();
      if (!text) continue;
      if (!skippedCurrent && latest && text === latest) {
        skippedCurrent = true;
        continue;
      }
      return text;
    }
    return '';
  }

  function getLatestAssistantMessageText() {
    for (var i = chatHistory.length - 1; i >= 0; i -= 1) {
      var msg = chatHistory[i];
      if (!msg || msg.role !== 'ai') continue;
      var text = msg.text === undefined || msg.text === null ? '' : String(msg.text).trim();
      if (!text) continue;
      return text;
    }
    return '';
  }

  function tryHandleCurrentPageFollowUpIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    if (!containsAny(raw, ['中文名', '中文名称', '页面名', '页签名', '页面中文', '叫什么'])) return null;
    var prevUserText = getPreviousUserMessageText(raw);
    var prevAiText = getLatestAssistantMessageText();
    var hasCurrentPageContext = containsAny(prevUserText, [
      '当前页面',
      '现在页面',
      '什么页面',
      '哪个页面',
      '页签',
      '在哪个页面',
      '在哪个页签',
    ]) || containsAny(prevAiText, [
      '当前页面是：',
      '当前页面是',
      '当前页签',
      '页面文件：',
    ]);
    if (!hasCurrentPageContext) return null;
    var apis = getApis();
    var data = null;
    if (apis.assistantApi && typeof apis.assistantApi.getPageData === 'function') {
      data = apis.assistantApi.getPageData('');
    }
    var tab = data && data.tab ? String(data.tab) : '';
    var tabLabel = getTabLabelById(tab);
    if (tabLabel && tab) return '当前页面中文名：' + tabLabel + '（' + tab + '）';
    if (tabLabel) return '当前页面中文名：' + tabLabel;
    if (tab) return '当前页面标识：' + tab;
    return '当前页面信息暂不可用。';
  }

  async function handleUserInput(text, options) {
    var content = String(text || '').trim();
    if (!content) return;
    var opts = options && typeof options === 'object' ? options : {};
    var pendingReplyId = opts.pendingReplyId === undefined || opts.pendingReplyId === null
      ? ''
      : String(opts.pendingReplyId);
    var approvalCounterStart = approvalCounter;

    function addAiReply(replyText, replyOptions) {
      var msgText = replyText === undefined || replyText === null ? '' : String(replyText);
      setStatus('');
      if (pendingReplyId) {
        var hasApprovalFlow = approvalCounter > approvalCounterStart;
        if (!hasApprovalFlow) {
          var replaced = replaceMessage(pendingReplyId, msgText, Object.assign({}, replyOptions || {}, {
            role: 'ai',
            title: getRoleTitle('ai', replyOptions && replyOptions.title),
            thinking: false,
            transient: false,
          }));
          pendingReplyId = '';
          if (replaced) return replaced;
        } else {
          removeMessageById(pendingReplyId);
          pendingReplyId = '';
        }
      }
      return addMessage('ai', msgText, replyOptions || {});
    }

    async function addRouteReply(routeName, replyText, routeData, routeOptions, replyOptions) {
      var fallbackText = replyText === undefined || replyText === null ? '' : String(replyText);
      var finalText = await finalizeRouteReplyByModel(content, routeName, fallbackText, routeData || {}, routeOptions || {});
      addAiReply(finalText || fallbackText, replyOptions || {});
    }

    if (containsAny(content, ['关闭助手', '禁用助手'])) {
      addAiReply('安全策略限制：助手不能通过聊天关闭自己。请到设置页手动关闭。');
      return;
    }

    var followUpCurrentPageReply = tryHandleCurrentPageFollowUpIntent(content);
    if (followUpCurrentPageReply) {
      await addRouteReply('current_page_follow_up', followUpCurrentPageReply, {
        pageData: getSafePageDataSnapshot(''),
      }, {});
      return;
    }

    var currentPageFunctionReply = await tryHandleCurrentPageFunctionIntent(content);
    if (currentPageFunctionReply) {
      addAiReply(currentPageFunctionReply);
      return;
    }

    var caseDetailClarificationReply = await tryHandleCaseDetailClarificationIntent(content);
    if (caseDetailClarificationReply && caseDetailClarificationReply.handled === true && caseDetailClarificationReply.text) {
      addAiReply(caseDetailClarificationReply.text);
      return;
    }

    var currentCaseFullDetailReply = await tryHandleCurrentCaseFullDetailIntent(content);
    if (currentCaseFullDetailReply && currentCaseFullDetailReply.handled === true && currentCaseFullDetailReply.text) {
      addAiReply(currentCaseFullDetailReply.text);
      return;
    }

    if (isCaseListIntent(content)) {
      var earlyCaseListReply = await runModelCaseListAction(content, {
        action: 'query_case_list',
        query: content,
      }, '');
      if (earlyCaseListReply && earlyCaseListReply.handled === true && earlyCaseListReply.text) {
        addAiReply(earlyCaseListReply.text);
        return;
      }
    }

    var directCaseUpdateReply = await tryHandleCaseUpdateCommand(content);
    if (directCaseUpdateReply) {
      await addRouteReply('direct_case_update', directCaseUpdateReply, {
        pageData: getSafePageDataSnapshot(''),
      }, {});
      return;
    }

    var tempExecFileReply = await tryHandleTempExecFileIntent(content);
    if (tempExecFileReply) {
      await addRouteReply('tempexec_file', tempExecFileReply, {
        pageData: getSafePageDataSnapshot(''),
      }, {});
      return;
    }

    var caseHistoryReply = await tryHandleCaseHistoryIntent(content);
    if (caseHistoryReply) {
      addAiReply(caseHistoryReply);
      return;
    }

    var modelDriven = await tryHandleModelDrivenReply(content);
    if (modelDriven && modelDriven.handled && modelDriven.text) {
      addAiReply(modelDriven.text);
      return;
    }

    var currentPageReply = tryHandleCurrentPageIntent(content);
    if (currentPageReply) {
      await addRouteReply('current_page_info', currentPageReply, {
        pageData: getSafePageDataSnapshot(''),
      }, {});
      return;
    }

    var navReply = tryHandleNavigationIntent(content);
    if (navReply) {
      await addRouteReply('navigation', navReply, {
        targetTab: parseTabFromText(content) || '',
      }, {});
      return;
    }

    var queryReply = tryHandleQueryIntent(content);
    if (queryReply) {
      await addRouteReply('query', queryReply, {
        pageData: getSafePageDataSnapshot(parseTabFromText(content) || ''),
      }, {});
      return;
    }

    var memoReply = await tryHandleMemoIntent(content);
    if (memoReply) {
      await addRouteReply('memo', memoReply, {}, {});
      return;
    }

    var settingReply = await tryHandleSettingsIntent(content);
    if (settingReply) {
      await addRouteReply('settings', settingReply, {
        pageData: getSafePageDataSnapshot('settings'),
      }, {});
      return;
    }

    var caseReply = await tryHandleCaseIntent(content);
    if (caseReply) {
      await addRouteReply('case', caseReply, {
        pageData: getSafePageDataSnapshot(''),
      }, {});
      return;
    }

    if (shouldRunIntentClassifier(content)) {
      var classified = await classifyIntentByModel(content);
      if (classified && typeof classified === 'object') {
        if (classified.intent === 'query_case_list') {
          var caseListReplyByModel = await runModelCaseListAction(content, {
            action: 'query_case_list',
            query: content,
          }, '');
          if (caseListReplyByModel && caseListReplyByModel.handled === true && caseListReplyByModel.text) {
            addAiReply(caseListReplyByModel.text);
            return;
          }
        }
        if (classified.intent === 'navigate') {
          var targetTabRaw = classified.tab ? String(classified.tab) : '';
          var targetTab = targetTabRaw && isKnownTabId(targetTabRaw) ? targetTabRaw : parseTabFromText(content);
          if (targetTab) {
            var apis0 = getApis();
            if (apis0.assistantApi && typeof apis0.assistantApi.switchTab === 'function') {
              apis0.assistantApi.switchTab(targetTab);
              await addRouteReply('classified_navigation', '已按意图跳转到：' + targetTab, {
                targetTab: targetTab,
              }, {});
              return;
            }
          }
        }
        if (classified.intent === 'query') {
          if (isCaseListIntent(content)) {
            var caseListReplyByQuery = await runModelCaseListAction(content, {
              action: 'query_case_list',
              query: content,
            }, '');
            if (caseListReplyByQuery && caseListReplyByQuery.handled === true && caseListReplyByQuery.text) {
              addAiReply(caseListReplyByQuery.text);
              return;
            }
          }
          var queryTabRaw = classified.tab ? String(classified.tab) : '';
          var queryTab = queryTabRaw && isKnownTabId(queryTabRaw) ? queryTabRaw : parseTabFromText(content);
          if (!queryTab && !isProjectScopedText(content)) {
            // 非项目上下文问题走通用问答，不返回页面数据包。
          } else {
            var apis1 = getApis();
            if (apis1.assistantApi && typeof apis1.assistantApi.getPageData === 'function') {
              var data = apis1.assistantApi.getPageData(queryTab || '');
              await addRouteReply('classified_query', '按你的意图返回页面数据：\n' + formatJsonCompact(data), {
                pageData: data,
                targetTab: queryTab || '',
              }, {});
              return;
            }
          }
        }
      }
    }

    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.callModel !== 'function') {
      addAiReply('助手主对话能力暂不可用，请稍后重试。');
      return;
    }

    var prompt = [
      '你是测试助手平台内置AI助手。',
      '优先提供可执行建议，回答简洁。',
      '你可以根据内容类型自行决定输出格式：结构化对比用 Markdown 表格，命令/代码/配置示例用 Markdown 代码块。',
      '当涉及删除、配置变更等写操作，提醒需要确认后执行。',
      '若用户询问页面数据，可提示他让你直接“获取某页面数据”。',
      '若用户询问“当前有哪些用例/用例列表”，优先直接返回列表结果，不要要求用户改写问题。',
      '请结合最近对话上下文回答，用户使用“就这个/按刚才那个/就今天的”等省略表达时要承接前文语义。',
      '对于项目外问题（如天气、常识、日常咨询）也要正常回答，不要误返回页面数据。',
      '如果问题依赖实时信息（如天气）且缺少地点，可先询问城市后再回答。'
    ].join('\n');
    var conversationHistory = buildConversationHistory(conversationHistoryLimit, content);

    setStatus('助手思考中...');
    var res = await apis.assistantApi.callModel(content, {
      prompt: prompt,
      temperature: 0.2,
      history: conversationHistory,
    });
    if (!res || res.ok !== true) {
      addAiReply('回复失败：' + (res && res.reason ? res.reason : '未知错误'));
      setStatus('回复失败');
      return;
    }
    addAiReply(String(res.content || ''));
    setStatus('');
  }

  function handleSend() {
    if (!inputEl) return;
    if (replyPending) {
      setStatus('助手正在思考中，请稍候。');
      return;
    }
    if (!isAssistantEnabled()) {
      setStatus('助手未开启，请先到设置页开启。');
      openSettingsForAssistant();
      return;
    }
    var text = String(inputEl.value || '').trim();
    if (!text) return;
    inputEl.value = '';
    addMessage('user', text);
    var thinking = addMessage('ai', '', {
      thinking: true,
      transient: true,
      title: '助手',
    });
    var pendingId = thinking && thinking.id ? String(thinking.id) : '';
    setReplyPending(true);
    handleUserInput(text, {
      pendingReplyId: pendingId,
    }).catch(function(err) {
      var reason = err && err.message ? String(err.message) : '未知错误';
      if (pendingId) {
        var replaced = replaceMessage(pendingId, '回复失败：' + reason, {
          role: 'ai',
          title: getRoleTitle('ai'),
          thinking: false,
          transient: false,
        });
        if (!replaced) addMessage('ai', '回复失败：' + reason);
      } else {
        addMessage('ai', '回复失败：' + reason);
      }
      setStatus('回复失败');
    }).finally(function() {
      setReplyPending(false);
    });
  }

  async function handleCopyCodeButtonClick(button) {
    if (!button) return;
    var block = button.closest ? button.closest('.assistant-code-block') : null;
    if (!block || !block.querySelector) return;
    var codeEl = block.querySelector('pre code');
    var codeText = codeEl && codeEl.textContent ? String(codeEl.textContent) : '';
    if (!codeText) {
      setStatus('未找到可复制内容');
      return;
    }
    if (button.disabled) return;
    button.disabled = true;
    var ok = await copyTextToClipboard(codeText);
    if (!button.isConnected) return;
    if (!ok) {
      button.disabled = false;
      setStatus('复制失败，请手动复制');
      return;
    }
    button.textContent = '已复制';
    setStatus('代码已复制');
    setTimeout(function() {
      if (!button || !button.isConnected) return;
      button.textContent = '复制';
      button.disabled = false;
    }, 1200);
  }

  function bindUiEvents() {
    if (launcherBtn) {
      launcherBtn.addEventListener('click', function() {
        showLauncherClick();
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        setPanelVisible(false);
      });
    }
    if (casePreviewCloseBtn) {
      casePreviewCloseBtn.addEventListener('click', function() {
        closeAssistantCasePreview();
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        handleClearChat();
      });
    }
    if (sendBtn) {
      sendBtn.addEventListener('click', handleSend);
    }
    if (messagesEl) {
      messagesEl.addEventListener('click', function(e) {
        var node = e && e.target && e.target.closest ? e.target : null;
        if (!node) return;
        var expandBtn = node.closest('.assistant-case-table-expand-btn');
        if (expandBtn) {
          e.preventDefault();
          openAssistantCasePreviewFromButton(expandBtn);
          return;
        }
        var target = node.closest('.assistant-code-copy-btn');
        if (!target) return;
        e.preventDefault();
        handleCopyCodeButtonClick(target);
      });
    }
    if (inputEl) {
      inputEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    }
    if (modelPicker) {
      modelPicker.addEventListener('change', function() {
        var apis = getApis();
        if (!apis.assistantSettingsApi || typeof apis.assistantSettingsApi.applyPatch !== 'function') return;
        var modelId = modelPicker.value ? String(modelPicker.value) : '';
        var res = apis.assistantSettingsApi.applyPatch({ assistantModelId: modelId }, { source: 'assistant-ui', allowSelfDisable: true });
        if (!res || res.ok !== true) {
          setStatus(res && res.reason ? res.reason : '模型切换失败');
          refreshModelPicker();
          return;
        }
        var selectedText = '';
        if (modelPicker.options && modelPicker.selectedIndex >= 0) {
          selectedText = modelPicker.options[modelPicker.selectedIndex].text || '';
        }
        setStatus('助手模型已切换' + (selectedText ? '：' + selectedText : ''));
      });
    }
  }

  function bindRuntimeEvents() {
    try {
      window.addEventListener('app-assistant-api-ready', function() {
        refreshState();
      });
      window.addEventListener('app-assistant-state-changed', function() {
        refreshState();
      });
      window.addEventListener('app-models-updated', function() {
        refreshModelPicker();
      });
      window.addEventListener('app-settings-loaded', function() {
        refreshState();
      });
      window.addEventListener('app-auth-ready', function() {
        loadHistory();
      });
      window.addEventListener('app-model-test-failed', onModelTestFailed);
      window.addEventListener('resize', handleAssistantWindowResize);
    } catch (err) {
      // ignore
    }
  }

  function setupDom() {
    ensureAssistantMount();
    launcher = byId('assistantLauncher');
    launcherBtn = byId('assistantLauncherBtn');
    lockDot = byId('assistantLockDot');
    panel = byId('assistantPanel');
    closeBtn = byId('assistantCloseBtn');
    clearBtn = byId('assistantClearBtn');
    modelPicker = byId('assistantModelPicker');
    statusEl = byId('assistantStatus');
    messagesEl = byId('assistantMessages');
    inputEl = byId('assistantInput');
    sendBtn = byId('assistantSendBtn');
    casePreview = byId('assistantCasePreview');
    casePreviewCloseBtn = byId('assistantCasePreviewClose');
    casePreviewBody = byId('assistantCasePreviewBody');

    return Boolean(launcher && launcherBtn && panel && messagesEl && inputEl && sendBtn);
  }

  function init() {
    if (initialized) return;
    if (!setupDom()) return;
    initialized = true;
    bindUiEvents();
    bindRuntimeEvents();
    loadHistory();
    refreshState();
    if (!chatHistory.length) {
      addMessage('ai', '你好，我可以帮你做页面跳转、数据查询、备忘处理、用例生成触发、漏测推荐触发，以及模型报错自动诊断。');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
