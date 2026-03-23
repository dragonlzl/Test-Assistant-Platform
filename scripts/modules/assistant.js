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
  var composerEl = null;
  var attachmentsEl = null;
  var inputBoxEl = null;
  var attachBtn = null;
  var imageInputEl = null;
  var attachmentListEl = null;

  var pendingAttachments = [];
  var attachmentPendingCount = 0;

  var historyLimit = 80;
  var conversationHistoryLimit = 12;
  var conversationHistoryReferenceLimit = 6;
  var failureHistoryLimit = 10;
  var actionHandlers = {};
  var approvalCounter = 0;
  var approvalMessageIdBySignature = {};
  var pendingApprovalRequestBySignature = {};
  var chatHistory = [];
  var failureHistory = [];
  var replyPending = false;
  var initialized = false;
  var assistantCaseTablePreviewLimit = 10;
  var assistantInputImageMaxCount = 10;
  var assistantInputImageMaxEdge = 1600;
  var assistantInputImageMaxBytes = 4 * 1024 * 1024;
  var pendingInteraction = null;
  var pendingTempExecRemoveSelection = null;
  var pendingTempExecReuseTargetSelection = null;
  var pendingExecTransferSelection = null;
  var pendingExecTransferVersionSelection = null;
  var pendingExecTransferCreateVersionConfirm = null;
  var pendingExecTransferVersionNameClarify = null;
  var assistantPlatformContextMarkdownCache = '';
  var assistantPlatformContextMarkdownPromise = null;
  var assistantPlatformContextMarkdownUrl = 'assets/assistant-platform-context.md';

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
      '    <div class="assistant-composer" id="assistantComposer">',
      '      <div class="assistant-attachments hidden" id="assistantAttachments">',
      '        <div class="assistant-attachment-list" id="assistantAttachmentList"></div>',
      '      </div>',
      '      <div class="assistant-input-main">',
      '        <div class="assistant-input-box" id="assistantInputBox">',
      '          <textarea id="assistantInput" placeholder="输入你的问题或操作指令"></textarea>',
      '          <button class="assistant-attach-icon-btn" id="assistantAttachBtn" type="button" aria-label="添加图片" title="添加图片"></button>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <input id="assistantImageInput" class="hidden" type="file" accept="image/*" multiple/>',
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

  function normalizeAssistantAttachmentName(name, fallback) {
    var text = name === undefined || name === null ? '' : String(name).trim();
    if (text) return text;
    return fallback || '图片';
  }

  function sanitizeAssistantImageSrc(value) {
    var text = value === undefined || value === null ? '' : String(value).trim();
    if (!text) return '';
    if (text.indexOf('data:image/') === 0) return text;
    if (text.indexOf('blob:') === 0) return text;
    if (text.indexOf('https://') === 0 || text.indexOf('http://') === 0) return text;
    if (text.indexOf('/') === 0 || text.indexOf('./') === 0 || text.indexOf('../') === 0) return text;
    return '';
  }

  function normalizeAssistantMessageAttachments(list) {
    var items = Array.isArray(list) ? list : [];
    var normalized = [];
    items.forEach(function(item) {
      if (!item || typeof item !== 'object') return;
      var dataUrl = item.dataUrl === undefined || item.dataUrl === null ? '' : String(item.dataUrl).trim();
      var url = item.url === undefined || item.url === null ? '' : String(item.url).trim();
      if (!dataUrl && !url && !item.name) return;
      normalized.push({
        id: item.id ? String(item.id) : ('att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)),
        name: normalizeAssistantAttachmentName(item.name, '图片-' + (normalized.length + 1)),
        type: item.type ? String(item.type) : '',
        size: Number(item.size) || 0,
        dataUrl: dataUrl,
        url: url,
      });
    });
    return normalized;
  }

  function cloneAssistantAttachments(list) {
    return normalizeAssistantMessageAttachments(list).map(function(item) {
      return {
        id: item.id,
        name: item.name,
        type: item.type,
        size: item.size,
        dataUrl: item.dataUrl,
        url: item.url,
      };
    });
  }

  function buildAssistantAttachmentSummaryText(attachments) {
    var list = normalizeAssistantMessageAttachments(attachments);
    if (!list.length) return '';
    var names = [];
    for (var i = 0; i < list.length && i < 4; i += 1) {
      names.push(list[i].name || ('图片' + (i + 1)));
    }
    var text = '[附图' + list.length + '张';
    if (names.length) {
      text += '：' + names.join('、');
      if (list.length > names.length) text += ' 等';
    }
    return text + ']';
  }

  function composeAssistantConversationContent(text, attachments) {
    var content = text === undefined || text === null ? '' : String(text).trim();
    var attachmentText = buildAssistantAttachmentSummaryText(attachments);
    if (content && attachmentText) return content + '\n' + attachmentText;
    return content || attachmentText;
  }

  function normalizeAssistantContentBlocks(blocks) {
    if (!Array.isArray(blocks)) return [];
    var normalized = [];
    blocks.forEach(function(block) {
      if (!block || typeof block !== 'object') return;
      if (block.type === 'text') {
        var text = block.text === undefined || block.text === null ? '' : String(block.text);
        if (text.trim()) normalized.push({ type: 'text', text: text });
        return;
      }
      if (block.type === 'image') {
        var dataUrl = block.dataUrl === undefined || block.dataUrl === null
          ? (block.url === undefined || block.url === null ? '' : String(block.url))
          : String(block.dataUrl);
        dataUrl = dataUrl.trim();
        if (!dataUrl) return;
        normalized.push({ type: 'image', dataUrl: dataUrl });
      }
    });
    return normalized;
  }

  function assistantContentBlocksHaveImage(blocks) {
    var list = normalizeAssistantContentBlocks(blocks);
    for (var i = 0; i < list.length; i += 1) {
      if (list[i] && list[i].type === 'image') return true;
    }
    return false;
  }

  function isAssistantImageFile(file) {
    if (!file) return false;
    var type = file.type ? String(file.type).toLowerCase() : '';
    if (type.indexOf('image/') === 0) return true;
    var name = file.name ? String(file.name).toLowerCase() : '';
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
  }

  function collectClipboardImageFiles(event) {
    var clipboard = event && event.clipboardData;
    var items = clipboard && clipboard.items ? clipboard.items : [];
    var files = [];
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      if (!item || item.kind !== 'file') continue;
      var type = item.type ? String(item.type).toLowerCase() : '';
      if (type.indexOf('image/') !== 0) continue;
      var file = item.getAsFile ? item.getAsFile() : null;
      if (file) files.push(file);
    }
    return files;
  }

  function collectDataTransferImageFiles(dataTransfer) {
    var files = dataTransfer && dataTransfer.files ? dataTransfer.files : [];
    var result = [];
    for (var i = 0; i < files.length; i += 1) {
      if (isAssistantImageFile(files[i])) result.push(files[i]);
    }
    return result;
  }

  function readAssistantBlobAsDataUrl(blob) {
    return new Promise(function(resolve, reject) {
      if (!blob) {
        reject(new Error('missing_blob'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function() { resolve(String(reader.result || '')); };
      reader.onerror = function() { reject(reader.error || new Error('读取图片失败')); };
      reader.readAsDataURL(blob);
    });
  }

  function estimateAssistantDataUrlBytes(dataUrl) {
    if (!dataUrl) return 0;
    var comma = dataUrl.indexOf(',');
    if (comma === -1) return 0;
    var b64 = dataUrl.slice(comma + 1);
    var padding = 0;
    var matched = b64.match(/=+$/);
    if (matched && matched[0]) padding = matched[0].length;
    return Math.max(0, Math.floor(b64.length * 3 / 4) - padding);
  }

  function loadAssistantImageByDataUrl(dataUrl) {
    return new Promise(function(resolve, reject) {
      var img = new Image();
      img.onload = function() { resolve(img); };
      img.onerror = function() { reject(new Error('图片解码失败')); };
      img.src = dataUrl;
    });
  }

  async function resizeAssistantDataUrl(dataUrl, maxEdge, mimeType, quality) {
    if (!dataUrl) return '';
    if (typeof document === 'undefined' || !document.createElement) return dataUrl;
    var image;
    try {
      image = await loadAssistantImageByDataUrl(dataUrl);
    } catch (err) {
      return dataUrl;
    }
    var srcW = image.naturalWidth || image.width || 0;
    var srcH = image.naturalHeight || image.height || 0;
    if (!srcW || !srcH) return dataUrl;
    var longest = Math.max(srcW, srcH);
    var ratio = longest > maxEdge ? (maxEdge / longest) : 1;
    var targetW = Math.max(1, Math.round(srcW * ratio));
    var targetH = Math.max(1, Math.round(srcH * ratio));
    var canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    var ctx2d = canvas.getContext('2d');
    if (!ctx2d) return dataUrl;
    ctx2d.drawImage(image, 0, 0, targetW, targetH);
    var targetMime = mimeType || 'image/jpeg';
    try {
      return canvas.toDataURL(targetMime, quality);
    } catch (err) {
      try {
        return canvas.toDataURL('image/jpeg', quality);
      } catch (err2) {
        return dataUrl;
      }
    }
  }

  async function preprocessAssistantImageFile(file) {
    if (!file) return { ok: false, reason: 'missing_file' };
    var dataUrl = '';
    try {
      dataUrl = await readAssistantBlobAsDataUrl(file);
    } catch (err) {
      return { ok: false, reason: 'read_failed' };
    }
    var best = await resizeAssistantDataUrl(dataUrl, assistantInputImageMaxEdge, null, 0.92);
    if (!best) best = dataUrl;
    var bytes = estimateAssistantDataUrlBytes(best);
    if (bytes > assistantInputImageMaxBytes) {
      var jpegHigh = await resizeAssistantDataUrl(best, assistantInputImageMaxEdge, 'image/jpeg', 0.85);
      if (jpegHigh) {
        best = jpegHigh;
        bytes = estimateAssistantDataUrlBytes(best);
      }
    }
    if (bytes > assistantInputImageMaxBytes) {
      var jpegLow = await resizeAssistantDataUrl(best, assistantInputImageMaxEdge, 'image/jpeg', 0.72);
      if (jpegLow) {
        best = jpegLow;
        bytes = estimateAssistantDataUrlBytes(best);
      }
    }
    if (bytes > assistantInputImageMaxBytes) {
      return { ok: false, reason: 'too_large' };
    }
    return {
      ok: true,
      attachment: {
        id: 'att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        name: normalizeAssistantAttachmentName(file.name, '图片-' + (pendingAttachments.length + 1)),
        type: file.type ? String(file.type) : '',
        size: bytes,
        dataUrl: best,
      },
    };
  }

  function buildAssistantRequestContentBlocks(text, attachments) {
    var list = normalizeAssistantMessageAttachments(attachments);
    var blocks = [];
    var content = text === undefined || text === null ? '' : String(text).trim();
    if (content) {
      blocks.push({ type: 'text', text: content });
    } else if (list.length) {
      blocks.push({ type: 'text', text: '请结合我上传的图片直接分析并回答。' });
    }
    list.forEach(function(item) {
      var dataUrl = item.dataUrl || item.url || '';
      if (!dataUrl) return;
      blocks.push({ type: 'image', dataUrl: dataUrl });
    });
    return blocks;
  }

  function renderPendingAttachments() {
    if (!attachmentListEl) return;
    attachmentListEl.innerHTML = '';
    var hasAttachments = pendingAttachments.length > 0;
    if (attachmentsEl) {
      attachmentsEl.classList.toggle('hidden', !hasAttachments);
    }
    attachmentListEl.classList.toggle('hidden', !hasAttachments);
    pendingAttachments.forEach(function(item) {
      var row = document.createElement('span');
      row.className = 'assistant-attachment-row';
      row.dataset.attachmentId = item.id || '';

      var link = document.createElement('button');
      link.type = 'button';
      link.className = 'assistant-attachment-link';
      link.dataset.attachmentId = item.id || '';
      link.textContent = item.name || '图片';
      link.title = item.name || '图片';
      row.appendChild(link);

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'assistant-attachment-remove';
      removeBtn.textContent = 'x';
      removeBtn.setAttribute('aria-label', '移除图片');
      removeBtn.dataset.attachmentId = item.id || '';
      row.appendChild(removeBtn);

      attachmentListEl.appendChild(row);
    });
  }

  function findPendingAttachmentById(attachmentId) {
    var targetId = attachmentId === undefined || attachmentId === null ? '' : String(attachmentId).trim();
    if (!targetId) return null;
    for (var i = 0; i < pendingAttachments.length; i += 1) {
      var item = pendingAttachments[i];
      if (!item || String(item.id || '') !== targetId) continue;
      return item;
    }
    return null;
  }

  function openAssistantImagePreview(src, name) {
    var safeSrc = sanitizeAssistantImageSrc(src);
    if (!safeSrc || !casePreviewBody) return;
    var title = name === undefined || name === null ? '' : String(name).trim();
    var html = '<div class="assistant-image-preview-wrap">';
    if (title) {
      html += '<div class="assistant-image-preview-name">' + escapeHtml(title) + '</div>';
    }
    html += '<img class="assistant-image-preview" src="' + escapeHtml(safeSrc) + '" alt="' + escapeHtml(title || '图片预览') + '"/>';
    html += '</div>';
    casePreviewBody.innerHTML = html;
    setAssistantCasePreviewVisible(true);
  }

  function removePendingAttachment(attachmentId) {
    var targetId = attachmentId === undefined || attachmentId === null ? '' : String(attachmentId).trim();
    if (!targetId) return false;
    for (var i = 0; i < pendingAttachments.length; i += 1) {
      var item = pendingAttachments[i];
      if (!item || String(item.id || '') !== targetId) continue;
      pendingAttachments.splice(i, 1);
      renderPendingAttachments();
      refreshSendState();
      return true;
    }
    return false;
  }

  function clearPendingAttachments() {
    pendingAttachments = [];
    if (imageInputEl) imageInputEl.value = '';
    renderPendingAttachments();
    refreshSendState();
  }

  async function appendPendingAttachments(files, source) {
    var inputList = Array.isArray(files) ? files : Array.prototype.slice.call(files || []);
    if (!inputList.length) return { added: 0, ignored: 0, tooLarge: 0, failed: 0, overflow: 0 };
    var imageFiles = inputList.filter(isAssistantImageFile);
    var ignored = inputList.length - imageFiles.length;
    var remaining = assistantInputImageMaxCount - pendingAttachments.length;
    if (remaining <= 0) {
      setStatus('当前最多可同时发送 ' + assistantInputImageMaxCount + ' 张图片。');
      return { added: 0, ignored: inputList.length, tooLarge: 0, failed: 0, overflow: 0 };
    }
    var selected = imageFiles.slice(0, remaining);
    var overflow = Math.max(0, imageFiles.length - selected.length);
    var added = 0;
    var tooLarge = 0;
    var failed = 0;
    attachmentPendingCount += selected.length;
    refreshSendState();
    try {
      for (var i = 0; i < selected.length; i += 1) {
        var prepared = await preprocessAssistantImageFile(selected[i]);
        if (!prepared.ok || !prepared.attachment) {
          if (prepared.reason === 'too_large') {
            tooLarge += 1;
          } else {
            failed += 1;
          }
          continue;
        }
        pendingAttachments.push(prepared.attachment);
        added += 1;
      }
    } finally {
      attachmentPendingCount = Math.max(0, attachmentPendingCount - selected.length);
      renderPendingAttachments();
      refreshSendState();
    }
    var statusParts = [];
    if (added > 0) statusParts.push('已添加 ' + added + ' 张图片');
    if (overflow > 0) statusParts.push('超出上限的 ' + overflow + ' 张已忽略');
    if (ignored > 0) statusParts.push('非图片内容 ' + ignored + ' 项已忽略');
    if (tooLarge > 0) statusParts.push(tooLarge + ' 张图片过大未加入');
    if (failed > 0) statusParts.push(failed + ' 张图片读取失败');
    if (statusParts.length) {
      setStatus(statusParts.join('，') + '。');
    } else if (source) {
      setStatus('未检测到可发送的图片。');
    }
    return { added: added, ignored: ignored, tooLarge: tooLarge, failed: failed, overflow: overflow };
  }

  function appendMessageAttachments(container, attachments, options) {
    if (!container || typeof document === 'undefined' || !document.createElement) return;
    var list = normalizeAssistantMessageAttachments(attachments);
    if (!list.length) return;
    var opts = options && typeof options === 'object' ? options : {};
    var wrap = document.createElement('div');
    wrap.className = 'assistant-msg-attachments';
    list.forEach(function(item) {
      var src = item.dataUrl || sanitizeAssistantImageSrc(item.url);
      var card = document.createElement('figure');
      card.className = 'assistant-msg-attachment';
      if (src) {
        var img = document.createElement('img');
        img.className = 'assistant-msg-image assistant-image-preview-trigger';
        img.loading = 'lazy';
        img.alt = item.name || '图片';
        img.src = src;
        img.dataset.previewSrc = src;
        img.dataset.previewName = item.name || '图片';
        card.appendChild(img);
      }
      var caption = document.createElement('figcaption');
      caption.className = 'assistant-msg-attachment-name';
      caption.textContent = item.name || '图片';
      card.appendChild(caption);
      wrap.appendChild(card);
    });
    if (opts.prepend === true && container.firstChild) {
      container.insertBefore(wrap, container.firstChild);
      return;
    }
    container.appendChild(wrap);
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
    if (toolName !== 'cases.list_current' && toolName !== 'case_library.query_cases') return text;
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
    if (toolName !== 'cases.list_current' && toolName !== 'case_library.query_cases') return text;
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
      : 'assistant-msg-table assistant-generic-table';
    var wrapperClass = 'assistant-table-scroll assistant-case-table-scroll';
    var head = renderAssistantTableHeadHtml(renderHeaders);
    var body = renderAssistantTableBodyHtml(rows, renderHeaders.length);
    var previewRows = rows;
    var previewSummary = '';
    var previewBody = body;
    var fullTemplate = '';
    var omittedCount = 0;
    if (isCaseTable && rows.length > assistantCaseTablePreviewLimit) {
      previewRows = rows.slice(0, assistantCaseTablePreviewLimit);
      omittedCount = rows.length - previewRows.length;
      previewSummary = '<span class="assistant-case-table-summary">' + escapeHtml(buildAssistantCaseTablePreviewSummaryText(previewRows.length, rows.length, omittedCount)) + '</span>';
      previewBody = renderAssistantTableBodyHtml(previewRows, renderHeaders.length) + renderAssistantCaseTableOmittedRowHtml(renderHeaders.length, omittedCount, rows.length);
      fullTemplate = '<template class="assistant-case-table-full-template">' + buildAssistantTableHtml(tableClass, head, body) + '</template>';
    }
    return (
      '<div class="assistant-case-table-wrap' + (isCaseTable ? '' : ' assistant-generic-table-wrap') + '">' +
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

  function renderAssistantMarkdownImageHtml(alt, src) {
    var safeSrc = sanitizeAssistantImageSrc(src);
    if (!safeSrc) return renderInlineMarkdown('![' + (alt || '') + '](' + (src || '') + ')');
    var safeAlt = escapeHtml(alt || '图片');
    var safeCaption = safeAlt && safeAlt !== '图片'
      ? ('<figcaption class="assistant-msg-image-caption">' + safeAlt + '</figcaption>')
      : '';
    return '<figure class="assistant-markdown-image-wrap"><img class="assistant-markdown-image assistant-image-preview-trigger" loading="lazy" src="' + escapeHtml(safeSrc) + '" alt="' + safeAlt + '" data-preview-src="' + escapeHtml(safeSrc) + '" data-preview-name="' + safeAlt + '"/>' + safeCaption + '</figure>';
  }

  function renderMarkdownParagraphHtml(text) {
    var raw = String(text || '');
    var pattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
    var match = null;
    var lastIndex = 0;
    var parts = [];
    while ((match = pattern.exec(raw))) {
      var before = raw.slice(lastIndex, match.index);
      if (before && before.trim()) {
        parts.push('<p>' + renderInlineMarkdown(before).replace(/\n/g, '<br/>') + '</p>');
      }
      parts.push(renderAssistantMarkdownImageHtml(match[1], match[2]));
      lastIndex = match.index + match[0].length;
    }
    var tail = raw.slice(lastIndex);
    if (tail && tail.trim()) {
      parts.push('<p>' + renderInlineMarkdown(tail).replace(/\n/g, '<br/>') + '</p>');
    }
    if (!parts.length && raw.trim()) {
      parts.push('<p>' + renderInlineMarkdown(raw).replace(/\n/g, '<br/>') + '</p>');
    }
    return parts.join('');
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
        parts.push(renderMarkdownParagraphHtml(paragraph.join('\n')));
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
    var table = mainScroll && mainScroll.querySelector ? mainScroll.querySelector('table.assistant-msg-table') : null;
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
    var fullTemplate = wrap.querySelector('template.assistant-case-table-full-template, template.assistant-table-full-template');
    if (fullTemplate && fullTemplate.content && fullTemplate.content.querySelector) {
      sourceTable = fullTemplate.content.querySelector('table.assistant-msg-table');
    }
    if (!sourceTable) {
      sourceTable = wrap.querySelector('table.assistant-msg-table');
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
      assistantCapabilityApi: window.app && window.app.assistantCapabilityApi ? window.app.assistantCapabilityApi : null,
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

  function normalizeAssistantTaskStatus(value) {
    var raw = value === undefined || value === null ? '' : String(value).trim().toLowerCase();
    if (!raw) return '';
    if (raw === 'done' || raw === 'success' || raw === 'completed') return 'completed';
    if (raw === 'running' || raw === 'in_progress' || raw === 'processing') return 'running';
    if (raw === 'waiting' || raw === 'pending' || raw === 'paused' || raw === 'awaiting_user') return 'waiting';
    if (raw === 'blocked' || raw === 'failed' || raw === 'error') return 'blocked';
    if (raw === 'cancelled' || raw === 'canceled') return 'cancelled';
    return '';
  }

  function getAssistantTaskStatusLabel(status) {
    var normalized = normalizeAssistantTaskStatus(status);
    if (normalized === 'completed') return '已完成';
    if (normalized === 'waiting') return '等待继续';
    if (normalized === 'blocked') return '执行受阻';
    if (normalized === 'cancelled') return '已取消';
    return '执行中';
  }

  function sanitizeAssistantTaskStepLabel(rawLabel) {
    var text = rawLabel === undefined || rawLabel === null ? '' : String(rawLabel).trim();
    var splitIndex = -1;
    var head = '';
    var detail = '';
    var normalizedTool = '';
    var normalizedAction = '';
    var fallbackArgs = {};
    var fallbackLabel = '';
    if (!text) return '';
    splitIndex = text.indexOf('：');
    if (splitIndex < 0) splitIndex = text.indexOf(':');
    if (splitIndex >= 0) {
      head = String(text.slice(0, splitIndex)).trim();
      detail = String(text.slice(splitIndex + 1)).trim();
    } else {
      head = text;
    }
    normalizedTool = normalizeMcpToolName(head);
    if (normalizedTool) {
      if (detail) fallbackArgs.query = detail;
      fallbackLabel = buildAssistantFriendlyTaskLabel(normalizedTool, fallbackArgs, detail || '') || buildAssistantUnknownToolTaskLabel(normalizedTool, fallbackArgs);
      return fallbackLabel || text;
    }
    normalizedAction = normalizeModelActionName(head);
    if (normalizedAction) {
      fallbackArgs = { action: normalizedAction };
      if (detail) fallbackArgs.query = detail;
      fallbackLabel = buildAssistantTaskStepLabelFromAction(fallbackArgs);
      return fallbackLabel || text;
    }
    if (/^[a-z0-9_.-]+$/i.test(head) && (head.indexOf('.') !== -1 || head.indexOf('_') !== -1)) {
      if (detail) fallbackArgs.query = detail;
      fallbackLabel = buildAssistantUnknownToolTaskLabel(head, fallbackArgs);
      return fallbackLabel || text;
    }
    return text;
  }

  function normalizeAssistantTaskState(taskState) {
    var data = taskState && typeof taskState === 'object' ? taskState : null;
    var steps = [];
    var status = '';
    if (!data) return null;
    if (Array.isArray(data.steps)) {
      steps = data.steps.map(function(step, index) {
        var item = step && typeof step === 'object' ? step : {};
        var label = item.label !== undefined && item.label !== null
          ? String(item.label).trim()
          : (item.name !== undefined && item.name !== null ? String(item.name).trim() : '');
        var description = item.description !== undefined && item.description !== null
          ? String(item.description).trim()
          : '';
        var stepStatus = normalizeAssistantTaskStatus(item.status);
        var capabilityId = normalizeMcpToolName(item.capabilityId || item.capability || item.tool || item.name || '');
        var capabilityArgs = item.capabilityArgs && typeof item.capabilityArgs === 'object'
          ? JSON.parse(JSON.stringify(item.capabilityArgs))
          : (item.args && typeof item.args === 'object' ? JSON.parse(JSON.stringify(item.args)) : {});
        label = sanitizeAssistantTaskStepLabel(label);
        if (shouldUseAssistantProtocolTaskFallbackLabel(label) && description === '基于已执行步骤整理最终答复。') {
          label = '整理结果并回复用户';
        }
        if (shouldUseAssistantProtocolTaskFallbackLabel(label) && capabilityId) {
          var derivedLabel = buildAssistantTaskStepLabelFromMcpCall({ tool: capabilityId, args: capabilityArgs }, '');
          if (derivedLabel) label = derivedLabel;
        }
        if (!label) label = '步骤 ' + (index + 1);
        if (!stepStatus) stepStatus = 'waiting';
        return {
          id: item.id !== undefined && item.id !== null ? String(item.id) : ('step-' + (index + 1)),
          label: label,
          description: description,
          status: stepStatus,
          planKey: item.planKey !== undefined && item.planKey !== null ? String(item.planKey) : '',
          preview: item.preview === true,
          capabilityId: capabilityId,
          capabilityArgs: capabilityArgs,
        };
      }).filter(function(step) {
        return !!(step && step.label);
      });
    }
    status = normalizeAssistantTaskStatus(data.status);
    if (!status) {
      if (steps.some(function(step) { return step.status === 'running'; })) status = 'running';
      else if (steps.some(function(step) { return step.status === 'waiting'; })) status = 'waiting';
      else if (steps.some(function(step) { return step.status === 'blocked'; })) status = 'blocked';
      else if (steps.some(function(step) { return step.status === 'cancelled'; })) status = 'cancelled';
      else if (steps.length) status = 'completed';
      else status = 'running';
    }
    return {
      title: data.title !== undefined && data.title !== null && String(data.title).trim() ? String(data.title).trim() : '当前任务',
      summary: data.summary !== undefined && data.summary !== null ? String(data.summary).trim() : '',
      status: status,
      steps: steps,
    };
  }

  function cloneAssistantTaskState(taskState) {
    var normalized = normalizeAssistantTaskState(taskState);
    if (!normalized) return null;
    return {
      title: normalized.title,
      summary: normalized.summary,
      status: normalized.status,
      steps: normalized.steps.map(function(step) {
        return {
          id: step.id || '',
          label: step.label,
          description: step.description,
          status: step.status,
          planKey: step.planKey || '',
          preview: step.preview === true,
          capabilityId: step.capabilityId || '',
          capabilityArgs: step.capabilityArgs && typeof step.capabilityArgs === 'object' ? JSON.parse(JSON.stringify(step.capabilityArgs)) : {},
        };
      }),
    };
  }

  function cloneAssistantTaskContinuation(continuation) {
    var data = continuation && typeof continuation === 'object' ? continuation : null;
    var type = '';
    var items = [];
    var stepIndices = [];
    var i = 0;
    if (!data) return null;
    type = data.type === 'action' ? 'action' : (data.type === 'mcp' ? 'mcp' : '');
    if (!type) return null;
    if (Array.isArray(data.items)) {
      for (i = 0; i < data.items.length; i += 1) {
        if (!data.items[i] || typeof data.items[i] !== 'object') continue;
        items.push(JSON.parse(JSON.stringify(data.items[i])));
      }
    }
    if (!items.length) return null;
    if (Array.isArray(data.stepIndices)) {
      for (i = 0; i < data.stepIndices.length; i += 1) {
        var num = Number(data.stepIndices[i]);
        stepIndices.push(Number.isFinite(num) ? num : -1);
      }
    }
    return {
      type: type,
      userText: data.userText === undefined || data.userText === null ? '' : String(data.userText),
      responseHint: data.responseHint === undefined || data.responseHint === null ? '' : String(data.responseHint),
      items: items,
      stepIndices: stepIndices,
    };
  }

  function buildAssistantTaskContinuation(type, items, stepIndices, userText, responseHint) {
    var continuationType = type === 'action' ? 'action' : (type === 'mcp' ? 'mcp' : '');
    var list = Array.isArray(items) ? items : [];
    var indices = Array.isArray(stepIndices) ? stepIndices : [];
    if (!continuationType || !list.length) return null;
    return cloneAssistantTaskContinuation({
      type: continuationType,
      userText: userText === undefined || userText === null ? '' : String(userText),
      responseHint: responseHint === undefined || responseHint === null ? '' : String(responseHint),
      items: list,
      stepIndices: indices,
    });
  }

  function consumeAssistantTaskContinuationStep(continuation, toolName) {
    var data = cloneAssistantTaskContinuation(continuation);
    var normalizedTool = normalizeMcpToolName(toolName);
    var firstTool = '';
    if (!data || data.type !== 'mcp' || !data.items.length || !normalizedTool) return data;
    firstTool = normalizeMcpToolName(data.items[0] && (data.items[0].tool || data.items[0].name || ''));
    if (firstTool !== normalizedTool) return data;
    return buildAssistantTaskContinuation('mcp', data.items.slice(1), data.stepIndices.slice(1), data.userText || '', data.responseHint || '');
  }

  function normalizeAssistantBlockType(value) {
    var raw = value === undefined || value === null ? '' : String(value).trim().toLowerCase();
    if (!raw) return '';
    if (raw === 'notice' || raw === 'alert') return 'notice';
    if (raw === 'choice_list' || raw === 'choice' || raw === 'choices') return 'choice_list';
    if (raw === 'content_list' || raw === 'list' || raw === 'items') return 'content_list';
    if (raw === 'code_block' || raw === 'code') return 'code_block';
    return '';
  }

  function normalizeAssistantBlockNoticeLevel(value) {
    var raw = value === undefined || value === null ? '' : String(value).trim().toLowerCase();
    if (raw === 'success' || raw === 'ok') return 'success';
    if (raw === 'warn' || raw === 'warning') return 'warn';
    if (raw === 'error' || raw === 'danger' || raw === 'blocked') return 'error';
    return 'info';
  }

  function normalizeAssistantChoiceListItems(items) {
    var list = Array.isArray(items) ? items : [];
    return list.map(function(item, index) {
      var row = item && typeof item === 'object' ? item : {};
      var label = row.label !== undefined && row.label !== null
        ? String(row.label).trim()
        : (row.name !== undefined && row.name !== null ? String(row.name).trim() : '');
      var replyText = row.replyText !== undefined && row.replyText !== null
        ? String(row.replyText).trim()
        : (label ? ('选第' + (index + 1) + '个') : '');
      if (!label) label = '选项 ' + (index + 1);
      return {
        id: row.id !== undefined && row.id !== null ? String(row.id) : ('choice-' + (index + 1)),
        label: label,
        description: row.description !== undefined && row.description !== null ? String(row.description).trim() : '',
        replyText: replyText,
      };
    }).filter(function(item) { return !!(item && item.label); });
  }

  function normalizeAssistantContentListItems(items) {
    var list = Array.isArray(items) ? items : [];
    return list.map(function(item, index) {
      if (item && typeof item === 'object') {
        return {
          label: item.label !== undefined && item.label !== null ? String(item.label).trim() : '',
          description: item.description !== undefined && item.description !== null ? String(item.description).trim() : '',
          text: item.text !== undefined && item.text !== null ? String(item.text).trim() : '',
        };
      }
      var text = item === undefined || item === null ? '' : String(item).trim();
      return {
        label: '',
        description: '',
        text: text || ('条目 ' + (index + 1)),
      };
    }).filter(function(item) { return !!(item && (item.label || item.description || item.text)); });
  }

  function normalizeAssistantBlocks(blocks) {
    var list = Array.isArray(blocks) ? blocks : [];
    return list.map(function(block) {
      var item = block && typeof block === 'object' ? block : {};
      var type = normalizeAssistantBlockType(item.type || item.blockType || item.kind);
      if (!type) return null;
      if (type === 'notice') {
        return {
          type: 'notice',
          level: normalizeAssistantBlockNoticeLevel(item.level || item.variant || item.status),
          title: item.title !== undefined && item.title !== null ? String(item.title).trim() : '',
          text: item.text !== undefined && item.text !== null
            ? String(item.text).trim()
            : (item.message !== undefined && item.message !== null ? String(item.message).trim() : ''),
        };
      }
      if (type === 'choice_list') {
        return {
          type: 'choice_list',
          title: item.title !== undefined && item.title !== null ? String(item.title).trim() : '',
          prompt: item.prompt !== undefined && item.prompt !== null
            ? String(item.prompt).trim()
            : (item.text !== undefined && item.text !== null ? String(item.text).trim() : ''),
          items: normalizeAssistantChoiceListItems(item.items),
        };
      }
      if (type === 'content_list') {
        return {
          type: 'content_list',
          title: item.title !== undefined && item.title !== null ? String(item.title).trim() : '',
          ordered: item.ordered === true || item.order === true || item.listType === 'ordered',
          items: normalizeAssistantContentListItems(item.items),
        };
      }
      if (type === 'code_block') {
        return {
          type: 'code_block',
          title: item.title !== undefined && item.title !== null ? String(item.title).trim() : '',
          language: item.language !== undefined && item.language !== null ? String(item.language).trim().toLowerCase() : '',
          code: item.code !== undefined && item.code !== null
            ? String(item.code)
            : (item.content !== undefined && item.content !== null ? String(item.content) : ''),
        };
      }
      return null;
    }).filter(function(item) {
      if (!item) return false;
      if (item.type === 'notice') return !!(item.title || item.text);
      if (item.type === 'choice_list') return !!((item.prompt || item.title) && item.items && item.items.length);
      if (item.type === 'content_list') return !!(item.items && item.items.length);
      if (item.type === 'code_block') return !!item.code;
      return false;
    });
  }

  function cloneAssistantBlocks(blocks) {
    return normalizeAssistantBlocks(blocks).map(function(block) {
      return JSON.parse(JSON.stringify(block));
    });
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
            attachments: [],
            blocks: normalizeAssistantBlocks(item.blocks),
            taskState: normalizeAssistantTaskState(item.taskState),
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
      if (Array.isArray(item.attachments) && item.attachments.length) return false;
      var text = item.text === undefined || item.text === null ? '' : String(item.text);
      if (text.indexOf('data:image/') !== -1) return false;
      return true;
    }).map(function(item) {
      return {
        id: item.id,
        role: item.role,
        title: item.title,
        text: item.text,
        createdAt: item.createdAt,
        blocks: normalizeAssistantBlocks(item.blocks),
        taskState: normalizeAssistantTaskState(item.taskState),
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
    var hasText = inputEl ? Boolean(String(inputEl.value || '').trim()) : false;
    var hasAttachments = pendingAttachments.length > 0;
    var disabled = replyPending === true || attachmentPendingCount > 0 || (!hasText && !hasAttachments);
    if (sendBtn) {
      sendBtn.disabled = disabled;
      sendBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }
    if (attachBtn) {
      attachBtn.disabled = replyPending === true || attachmentPendingCount > 0;
    }
    if (imageInputEl) {
      imageInputEl.disabled = replyPending === true || attachmentPendingCount > 0;
    }
    if (inputEl) {
      inputEl.setAttribute('aria-busy', replyPending === true || attachmentPendingCount > 0 ? 'true' : 'false');
    }
    if (inputBoxEl && (replyPending === true || attachmentPendingCount > 0)) {
      inputBoxEl.classList.remove('dragover');
    }
    if (composerEl) {
      composerEl.classList.toggle('is-busy', replyPending === true || attachmentPendingCount > 0);
    }
  }

  function setReplyPending(value) {
    replyPending = value === true;
    refreshSendState();
  }

  function buildMessageBodyContent(text, attachments) {
    return composeAssistantConversationContent(text, attachments);
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

  function splitAssistantBinaryReplyTokens(value) {
    var raw = String(value === undefined || value === null ? '' : value).trim();
    if (!raw) return [];
    return raw.split(/[\/｜|、,，或]+/).map(function(item) {
      return String(item || '').trim();
    }).filter(function(item) {
      return !!item;
    });
  }

  function normalizeAssistantBinaryReplyToken(value) {
    return String(value === undefined || value === null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/[“”"'`]/g, '')
      .replace(/\s+/g, '');
  }

  function classifyAssistantBinaryReplyTokens(tokens) {
    var list = Array.isArray(tokens) ? tokens : [];
    var i = 0;
    for (i = 0; i < list.length; i += 1) {
      var token = normalizeAssistantBinaryReplyToken(list[i]);
      if (!token) continue;
      if (/^(?:是|好|好的|可以|确认|确定|行|继续|新建|创建|允许|允许操作)$/.test(token)) return 'positive';
      if (/^(?:否|不是|不|不要|不用|取消|算了|不允许|拒绝)$/.test(token)) return 'negative';
    }
    return '';
  }

  function pickAssistantBinaryReplySubmitText(tokens, type) {
    var list = Array.isArray(tokens) ? tokens : [];
    var expected = type === 'negative' ? 'negative' : 'positive';
    var i = 0;
    for (i = 0; i < list.length; i += 1) {
      if (classifyAssistantBinaryReplyTokens([list[i]]) === expected) return String(list[i]).trim();
    }
    return list.length ? String(list[0]).trim() : '';
  }

  function pickAssistantBinaryReplyDisplayLabel(tokens, type, fullText) {
    var list = Array.isArray(tokens) ? tokens : [];
    var normalized = list.map(function(item) {
      return normalizeAssistantBinaryReplyToken(item);
    });
    var raw = String(fullText || '');
    if (type === 'negative') {
      if (normalized.indexOf('取消') !== -1) return '取消';
      if (normalized.indexOf('不允许') !== -1) return '不允许';
      if (normalized.indexOf('拒绝') !== -1) return '拒绝';
      if (normalized.indexOf('否') !== -1) return '否';
      return list.length ? String(list[0]).trim() : '取消';
    }
    if (normalized.indexOf('继续') !== -1) return '继续';
    if (normalized.indexOf('允许操作') !== -1) return '允许操作';
    if (normalized.indexOf('允许') !== -1) return '允许';
    if (normalized.indexOf('新建') !== -1) return raw.indexOf('继续') !== -1 ? '新建并继续' : '新建';
    if (normalized.indexOf('创建') !== -1) return raw.indexOf('继续') !== -1 ? '创建并继续' : '创建';
    if (normalized.indexOf('确认') !== -1 || normalized.indexOf('确定') !== -1) return '确认';
    if (normalized.indexOf('是') !== -1) return '是';
    return list.length ? String(list[0]).trim() : '继续';
  }

  function buildAssistantQuickReplyActions(choices) {
    var list = Array.isArray(choices) ? choices : [];
    return list.map(function(choice) {
      var item = choice && typeof choice === 'object' ? choice : {};
      var replyText = item.replyText === undefined || item.replyText === null ? '' : String(item.replyText).trim();
      var label = item.label === undefined || item.label === null ? '' : String(item.label).trim();
      var className = item.className ? String(item.className).trim() : '';
      if (!replyText && !label) return null;
      if (!replyText) replyText = label;
      return {
        label: label || replyText,
        variant: normalizeAssistantActionVariant(item.variant || item.type || item.style),
        title: item.title ? String(item.title) : '',
        className: (className ? (className + ' ') : '') + 'assistant-quick-reply-btn assistant-one-shot-btn',
        busyLabel: item.busyLabel ? String(item.busyLabel) : '已发送...',
        onClick: function() {
          return submitAssistantQuickReply(replyText);
        },
      };
    }).filter(function(item) { return !!item; });
  }

  function inferAssistantBinaryReplyActionsFromText(text) {
    var raw = String(text === undefined || text === null ? '' : text).trim();
    var groupMatches = [];
    var match = null;
    var i = 0;
    if (!raw || raw.indexOf('回复') === -1) return [];
    var regex = /[“"]([^”"\n]{1,24})[”"]/g;
    while ((match = regex.exec(raw)) !== null) {
      if (match[1]) groupMatches.push(String(match[1]));
      if (groupMatches.length >= 4) break;
    }
    if (groupMatches.length < 2) return [];
    for (i = 0; i < groupMatches.length - 1; i += 1) {
      var leftTokens = splitAssistantBinaryReplyTokens(groupMatches[i]);
      var rightTokens = splitAssistantBinaryReplyTokens(groupMatches[i + 1]);
      var leftType = classifyAssistantBinaryReplyTokens(leftTokens);
      var rightType = classifyAssistantBinaryReplyTokens(rightTokens);
      var positiveTokens = null;
      var negativeTokens = null;
      if (!leftType || !rightType || leftType === rightType) continue;
      positiveTokens = leftType === 'positive' ? leftTokens : rightTokens;
      negativeTokens = leftType === 'negative' ? leftTokens : rightTokens;
      return buildAssistantQuickReplyActions([
        {
          label: pickAssistantBinaryReplyDisplayLabel(positiveTokens, 'positive', raw),
          replyText: pickAssistantBinaryReplySubmitText(positiveTokens, 'positive'),
          variant: 'allow',
          title: '快速回复：' + pickAssistantBinaryReplySubmitText(positiveTokens, 'positive'),
          busyLabel: '已发送...',
        },
        {
          label: pickAssistantBinaryReplyDisplayLabel(negativeTokens, 'negative', raw),
          replyText: pickAssistantBinaryReplySubmitText(negativeTokens, 'negative'),
          variant: 'deny',
          title: '快速回复：' + pickAssistantBinaryReplySubmitText(negativeTokens, 'negative'),
          busyLabel: '已发送...',
        },
      ]);
    }
    return [];
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
        busyLabel: item.busyLabel ? String(item.busyLabel) : '',
      };
    }).filter(function(item) { return item.id; });
    return actions;
  }

  function resolveAssistantMessageActions(role, text, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var explicitActions = buildAssistantMessageActions(opts);
    var normalizedRole = String(role === undefined || role === null ? '' : role).trim().toLowerCase();
    var autoActions = [];
    if (explicitActions.length) return explicitActions;
    if (opts.autoReplyActions === false) return [];
    if (normalizedRole !== 'ai' && normalizedRole !== 'assistant' && normalizedRole !== 'sys') return [];
    autoActions = inferAssistantBinaryReplyActionsFromText(text);
    if (!autoActions.length) return [];
    return buildAssistantMessageActions({ actions: autoActions });
  }

  function addMessage(role, text, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var msgRole = role || 'ai';
    var msgText = text === undefined || text === null ? '' : String(text);
    var actions = resolveAssistantMessageActions(msgRole, msgText, opts);
    var msg = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      role: msgRole,
      title: getRoleTitle(role, opts.title),
      text: msgText,
      createdAt: Date.now(),
      actions: actions,
      thinking: opts.thinking === true,
      transient: opts.transient === true,
      attachments: normalizeAssistantMessageAttachments(opts.attachments),
      blocks: normalizeAssistantBlocks(opts.blocks),
      taskState: normalizeAssistantTaskState(opts.taskState),
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
      if (Object.prototype.hasOwnProperty.call(opts, 'attachments')) {
        msg.attachments = normalizeAssistantMessageAttachments(opts.attachments);
      }
      if (Object.prototype.hasOwnProperty.call(opts, 'blocks')) {
        msg.blocks = normalizeAssistantBlocks(opts.blocks);
      }
      if (Object.prototype.hasOwnProperty.call(opts, 'taskState')) {
        msg.taskState = normalizeAssistantTaskState(opts.taskState);
      }
      msg.createdAt = Date.now();
      msg.actions = resolveAssistantMessageActions(msg.role, msg.text, opts);
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

  function appendMessageTextBlock(container, html) {
    if (!container) return null;
    var wrap = document.createElement('div');
    wrap.className = 'assistant-msg-text';
    wrap.innerHTML = html;
    container.appendChild(wrap);
    return wrap;
  }

  function appendAssistantCodeBlock(container, block) {
    var item = block && typeof block === 'object' ? block : {};
    var wrap = document.createElement('section');
    var title = null;
    var codeClass = item.language ? ('language-' + escapeHtml(item.language)) : '';
    wrap.className = 'assistant-block assistant-block-code';
    if (item.title) {
      title = document.createElement('div');
      title.className = 'assistant-block-title';
      title.textContent = item.title;
      wrap.appendChild(title);
    }
    wrap.insertAdjacentHTML('beforeend', '<div class="assistant-code-block"><button class="assistant-code-copy-btn" type="button">复制</button><pre><code' + (codeClass ? (' class=\"' + codeClass + '\"') : '') + '>' + escapeHtml(item.code || '') + '</code></pre></div>');
    container.appendChild(wrap);
    return wrap;
  }

  function appendAssistantNoticeBlock(container, block) {
    var item = block && typeof block === 'object' ? block : {};
    var wrap = document.createElement('section');
    var title = null;
    var textWrap = null;
    wrap.className = 'assistant-block assistant-block-notice assistant-block-notice-' + normalizeAssistantBlockNoticeLevel(item.level);
    if (item.title) {
      title = document.createElement('div');
      title.className = 'assistant-block-title';
      title.textContent = item.title;
      wrap.appendChild(title);
    }
    if (item.text) {
      textWrap = document.createElement('div');
      textWrap.className = 'assistant-block-content';
      textWrap.innerHTML = renderMarkdownMessageHtml(item.text);
      wrap.appendChild(textWrap);
    }
    container.appendChild(wrap);
    return wrap;
  }

  function appendAssistantContentListBlock(container, block) {
    var item = block && typeof block === 'object' ? block : {};
    var wrap = document.createElement('section');
    var title = null;
    var list = document.createElement(item.ordered === true ? 'ol' : 'ul');
    wrap.className = 'assistant-block assistant-block-list';
    list.className = 'assistant-block-list-items';
    if (item.title) {
      title = document.createElement('div');
      title.className = 'assistant-block-title';
      title.textContent = item.title;
      wrap.appendChild(title);
    }
    (Array.isArray(item.items) ? item.items : []).forEach(function(entry) {
      var row = entry && typeof entry === 'object' ? entry : {};
      var li = document.createElement('li');
      var main = row.text || row.label || '';
      if (row.label && row.text && row.label !== row.text) main = row.label + '：' + row.text;
      li.className = 'assistant-block-list-item';
      li.textContent = main || row.description || '';
      if (row.description && main) {
        var desc = document.createElement('div');
        desc.className = 'assistant-block-list-desc';
        desc.textContent = row.description;
        li.appendChild(desc);
      }
      list.appendChild(li);
    });
    wrap.appendChild(list);
    container.appendChild(wrap);
    return wrap;
  }

  function appendAssistantChoiceListBlock(container, block) {
    var item = block && typeof block === 'object' ? block : {};
    var wrap = document.createElement('section');
    var title = null;
    var prompt = null;
    var list = document.createElement('ol');
    var actions = document.createElement('div');
    wrap.className = 'assistant-block assistant-block-choice-list';
    list.className = 'assistant-block-choice-items';
    actions.className = 'assistant-actions assistant-block-choice-actions';
    if (item.title) {
      title = document.createElement('div');
      title.className = 'assistant-block-title';
      title.textContent = item.title;
      wrap.appendChild(title);
    }
    if (item.prompt) {
      prompt = document.createElement('div');
      prompt.className = 'assistant-block-content';
      prompt.innerHTML = renderMarkdownMessageHtml(item.prompt);
      wrap.appendChild(prompt);
    }
    (Array.isArray(item.items) ? item.items : []).forEach(function(choice) {
      var row = choice && typeof choice === 'object' ? choice : {};
      var li = document.createElement('li');
      li.className = 'assistant-block-choice-item';
      li.textContent = row.label || '选项';
      if (row.description) {
        var desc = document.createElement('div');
        desc.className = 'assistant-block-list-desc';
        desc.textContent = row.description;
        li.appendChild(desc);
      }
      list.appendChild(li);
      if (row.replyText) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'assistant-action-btn assistant-one-shot-btn';
        btn.textContent = row.label || row.replyText;
        btn.addEventListener('click', function() {
          submitAssistantQuickReply(row.replyText);
        });
        actions.appendChild(btn);
      }
    });
    wrap.appendChild(list);
    if (actions.childNodes.length) wrap.appendChild(actions);
    container.appendChild(wrap);
    return wrap;
  }

  function appendMessageBlocks(container, blocks) {
    var list = normalizeAssistantBlocks(blocks);
    if (!container || !list.length) return [];
    return list.map(function(block) {
      if (block.type === 'notice') return appendAssistantNoticeBlock(container, block);
      if (block.type === 'choice_list') return appendAssistantChoiceListBlock(container, block);
      if (block.type === 'content_list') return appendAssistantContentListBlock(container, block);
      if (block.type === 'code_block') return appendAssistantCodeBlock(container, block);
      return null;
    }).filter(function(item) { return !!item; });
  }

  function appendMessageTaskState(container, taskState) {
    var data = normalizeAssistantTaskState(taskState);
    if (!container || !data) return null;
    var card = document.createElement('section');
    var status = data.status || 'running';
    var steps = Array.isArray(data.steps) ? data.steps : [];
    card.className = 'assistant-task-card assistant-task-status-' + status;
    card.setAttribute('data-task-status', status);

    var head = document.createElement('div');
    head.className = 'assistant-task-head';

    var title = document.createElement('div');
    title.className = 'assistant-task-title';
    title.textContent = data.title || '当前任务';
    head.appendChild(title);

    var badge = document.createElement('div');
    badge.className = 'assistant-task-badge';
    badge.textContent = getAssistantTaskStatusLabel(status);
    head.appendChild(badge);
    card.appendChild(head);

    if (data.summary) {
      var summary = document.createElement('div');
      summary.className = 'assistant-task-summary';
      summary.textContent = data.summary;
      card.appendChild(summary);
    }

    if (steps.length) {
      var list = document.createElement('ol');
      list.className = 'assistant-task-step-list';
      steps.forEach(function(step) {
        var item = step && typeof step === 'object' ? step : {};
        var itemStatus = normalizeAssistantTaskStatus(item.status) || 'waiting';
        var row = document.createElement('li');
        row.className = 'assistant-task-step assistant-task-step-' + itemStatus;
        row.setAttribute('data-step-status', itemStatus);

        var icon = document.createElement('span');
        icon.className = 'assistant-task-step-icon';
        row.appendChild(icon);

        var textWrap = document.createElement('div');
        textWrap.className = 'assistant-task-step-text';

        var label = document.createElement('div');
        label.className = 'assistant-task-step-label';
        label.textContent = item.label || '步骤';
        textWrap.appendChild(label);

        if (item.description) {
          var desc = document.createElement('div');
          desc.className = 'assistant-task-step-desc';
          desc.textContent = item.description;
          textWrap.appendChild(desc);
        }

        row.appendChild(textWrap);
        list.appendChild(row);
      });
      card.appendChild(list);
    }

    container.appendChild(card);
    return card;
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
      var attachments = normalizeAssistantMessageAttachments(msg.attachments);
      var blocks = normalizeAssistantBlocks(msg.blocks);
      if (msg.role === 'user') {
        if (attachments.length) {
          appendMessageAttachments(body, attachments);
        }
        if (bodyText) {
          appendMessageTextBlock(body, renderPlainMessageHtml(bodyText));
        }
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
          if (msg.taskState) {
            appendMessageTaskState(body, msg.taskState);
          }
          if (blocks.length) {
            appendMessageBlocks(body, blocks);
          }
          if (bodyText) {
            appendMessageTextBlock(body, renderMarkdownMessageHtml(bodyText));
          }
          if (attachments.length) {
            appendMessageAttachments(body, attachments);
          }
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
            var fn = actionHandlers[action.id || ''];
            var shouldLock = btn.classList.contains('assistant-approval-btn') || btn.classList.contains('assistant-one-shot-btn');
            function lockActionButtons() {
              var selector = btn.classList.contains('assistant-approval-btn')
                ? 'button.assistant-approval-btn'
                : 'button.assistant-action-btn';
              var relatedBtns = actionsWrap.querySelectorAll(selector);
              for (var ab = 0; ab < relatedBtns.length; ab += 1) {
                relatedBtns[ab].disabled = true;
              }
              if (action.busyLabel) {
                btn.textContent = action.busyLabel;
              } else if (btn.classList.contains('assistant-action-btn-allow')) {
                btn.textContent = '执行中...';
              } else if (btn.classList.contains('assistant-action-btn-deny')) {
                btn.textContent = '处理中...';
              }
            }
            if (typeof fn === 'function') {
              try {
                var res = fn();
                if (res !== false && shouldLock) lockActionButtons();
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
    var selectedExists = false;
    if (apis.assistantSettingsApi && typeof apis.assistantSettingsApi.listModels === 'function') {
      models = apis.assistantSettingsApi.listModels() || [];
    }
    if (Array.isArray(models) && selectedId) {
      selectedExists = models.some(function(model) {
        return model && model.id && String(model.id) === selectedId;
      });
    }
    if (!Array.isArray(models) || !models.length) {
      if (selectedId) {
        modelPicker.innerHTML = '<option value="' + escapeHtml(selectedId) + '">已保存模型（待加载）：' + escapeHtml(selectedId) + '</option>';
        modelPicker.value = selectedId;
      } else {
        modelPicker.innerHTML = '<option value="">暂无模型</option>';
        modelPicker.value = '';
      }
      return;
    }
    modelPicker.innerHTML = (selectedId && !selectedExists
      ? ('<option value="' + escapeHtml(selectedId) + '">已保存模型（待同步或已删除）：' + escapeHtml(selectedId) + '</option>')
      : '') + models.map(function(model) {
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
    approvalMessageIdBySignature = {};
    pendingApprovalRequestBySignature = {};
    clearPendingInteraction();
    clearPendingTempExecReuseTargetSelection();
    clearPendingTempExecRemoveSelection();
    clearPendingExecTransferSelection();
    clearPendingExecTransferManualState();
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

  function trimConversationHistoryReferenceText(text, maxLen) {
    var raw = text === undefined || text === null ? '' : String(text);
    raw = raw.replace(/\s+/g, ' ').trim();
    var max = Number(maxLen);
    if (!Number.isFinite(max) || max <= 0) max = 180;
    if (raw.length <= max) return raw;
    return raw.slice(0, Math.max(1, max - 1)) + '…';
  }

  function buildConversationPriorityPrompt(latestUserText, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var pending = opts.pendingInteraction && typeof opts.pendingInteraction === 'object' ? opts.pendingInteraction : null;
    var pendingKind = pending && pending.kind ? String(pending.kind) : '';
    var pendingPrompt = pending && pending.prompt ? trimConversationHistoryReferenceText(String(pending.prompt), 100) : '';
    var pendingSourceUserText = pending && pending.sourceUserText ? trimConversationHistoryReferenceText(String(pending.sourceUserText), 140) : '';
    var latest = trimConversationHistoryReferenceText(latestUserText, 140);
    var lines = [
      '上下文处理策略：',
      '- 本轮最新消息是主任务，重要性约 90%。',
      '- 历史对话只作为弱参考，重要性约 10%。',
      '- 先只根据本轮最新消息判断：这是延续上文，还是一个新的独立指令/问题。',
      pending
        ? ('- 当前存在待确认上下文（kind=' + pendingKind + '），它比普通历史更重要；除非用户明显换了新话题，否则优先把本轮消息理解为对待确认问题的补充或回答。')
        : '',
      pendingPrompt
        ? ('- 当前待确认问题：' + pendingPrompt)
        : '',
      pendingSourceUserText
        ? ('- 当前待确认上下文对应的原始用户请求：' + pendingSourceUserText)
        : '',
      pending
        ? '- 若本轮最新消息是“是/不是/好的/全部/第2条/就改222”这类短回复，优先把它理解为对待确认问题的回答，不要误判成全新请求。'
        : '',
      (pendingKind === 'model_clarify' && pendingSourceUserText)
        ? '- 当最新消息较短、带省略、只补了范围/页面/对象时，应把它视为对上述原始用户请求的补充限定，不要把这句短回复单独改写成新的无关任务。'
        : '',
      '- 只有当最新消息与上文强相关，或出现“这个/那个/继续/刚才/上一个/就今天的/按刚才那个”等承接、省略、补充表达时，才回看历史。',
      '- 如果最新消息本身已经完整明确，应把它当作新的独立请求，忽略大部分历史，不要被旧话题带偏。',
      '- 若历史信息与本轮最新消息冲突，以本轮最新消息为准。',
      latest ? ('- 本轮最新消息（90%）：' + latest) : '- 本轮最新消息（90%）：见当前用户输入。',
      '- history 中提供的仅是“弱参考上下文（10%）”，请只在确认强相关后再使用。',
    ];
    return lines.join('\n');
  }

  function buildConversationPromptWithPriority(basePrompt, latestUserText, options) {
    var prompt = basePrompt === undefined || basePrompt === null ? '' : String(basePrompt).trim();
    var strategy = buildConversationPriorityPrompt(latestUserText, options);
    if (!prompt) return strategy;
    return prompt + '\n' + strategy;
  }

  function buildAssistantContinuationTaskUserText(latestUserText, pendingInteraction) {
    var latest = latestUserText === undefined || latestUserText === null ? '' : String(latestUserText).trim();
    var pending = pendingInteraction && typeof pendingInteraction === 'object' ? pendingInteraction : null;
    var source = pending && pending.sourceUserText ? String(pending.sourceUserText).trim() : '';
    if (!source) return latest;
    if (!latest) return source;
    if (latest === source) return source;
    return source + '\n补充信息：' + latest;
  }

  function buildConversationHistory(limit, latestUserText) {
    var max = Number(limit);
    if (!Number.isFinite(max) || max <= 0) max = conversationHistoryLimit;
    if (Number.isFinite(conversationHistoryReferenceLimit) && conversationHistoryReferenceLimit > 0) {
      max = Math.min(max, conversationHistoryReferenceLimit);
    }
    var list = [];
    var skipUserText = latestUserText === undefined || latestUserText === null
      ? ''
      : String(latestUserText).trim();
    for (var i = chatHistory.length - 1; i >= 0; i -= 1) {
      var msg = chatHistory[i];
      if (!msg || typeof msg !== 'object') continue;
      var role = normalizeConversationRole(msg.role);
      if (!role) continue;
      var rawContent = buildMessageBodyContent(msg.text, msg.attachments);
      if (!rawContent) continue;
      if (skipUserText && role === 'user' && rawContent === skipUserText) {
        skipUserText = '';
        continue;
      }
      list.unshift({
        role: role,
        content: trimConversationHistoryReferenceText(rawContent, 180),
      });
      if (list.length >= max) break;
    }
    return list.map(function(item, index) {
      var roleLabel = item.role === 'assistant' ? '助手历史' : '用户历史';
      return {
        role: item.role,
        content: '[弱参考上下文#' + (index + 1) + ' | ' + roleLabel + ' | 仅强相关时使用 | 权重约10%] ' + item.content,
      };
    });
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
    var signature = JSON.stringify({
      label: label,
      detail: detail,
      reason: reason,
    });
    if (signature && pendingApprovalRequestBySignature[signature] && pendingApprovalRequestBySignature[signature].promise) {
      return pendingApprovalRequestBySignature[signature].promise;
    }
    approvalCounter += 1;
    var requestState = { promise: null };
    requestState.promise = new Promise(function(resolve) {
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
      function setApprovalCard(text, actions) {
        var msgOptions = {
          title: '系统',
          actions: Array.isArray(actions) ? actions : [],
          autoReplyActions: false,
        };
        if (approvalMsg && approvalMsg.id) {
          replaceMessage(approvalMsg.id, text, msgOptions);
          return;
        }
        if (signature && approvalMessageIdBySignature[signature]) {
          removeMessageById(approvalMessageIdBySignature[signature]);
          delete approvalMessageIdBySignature[signature];
        }
        approvalMsg = addMessage('sys', text, msgOptions);
        if (signature && approvalMsg && approvalMsg.id) {
          approvalMessageIdBySignature[signature] = approvalMsg.id;
        }
      }
      function finish(allowed) {
        if (settled) return;
        settled = true;
        var approved = allowed === true;
        setApprovalCard(lines.join('\n') + '\n' + settleText(approved), []);
        if (signature && pendingApprovalRequestBySignature[signature] === requestState) {
          delete pendingApprovalRequestBySignature[signature];
        }
        setStatus('');
        resolve(approved);
      }
      setApprovalCard(lines.join('\n'), [
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
      ]);
    });
    if (signature) pendingApprovalRequestBySignature[signature] = requestState;
    return requestState.promise;
  }


  function clearPendingTempExecRemoveSelection() {
    pendingTempExecRemoveSelection = null;
  }

  function clearPendingTempExecReuseTargetSelection() {
    pendingTempExecReuseTargetSelection = null;
  }

  function clearPendingExecTransferSelection() {
    pendingExecTransferSelection = null;
  }

  function clearPendingExecTransferVersionSelection() {
    pendingExecTransferVersionSelection = null;
  }

  function clearPendingExecTransferCreateVersionConfirm() {
    pendingExecTransferCreateVersionConfirm = null;
  }

  function clearPendingExecTransferVersionNameClarify() {
    pendingExecTransferVersionNameClarify = null;
  }

  function clearPendingExecTransferManualState() {
    clearPendingExecTransferVersionSelection();
    clearPendingExecTransferCreateVersionConfirm();
    clearPendingExecTransferVersionNameClarify();
  }

  function getActivePendingExecTransferState() {
    if (pendingExecTransferVersionNameClarify) return pendingExecTransferVersionNameClarify;
    if (pendingExecTransferCreateVersionConfirm) return pendingExecTransferCreateVersionConfirm;
    if (pendingExecTransferVersionSelection) return pendingExecTransferVersionSelection;
    if (pendingExecTransferSelection) return pendingExecTransferSelection;
    return null;
  }

  function updateActivePendingExecTransferState(options) {
    var pending = getActivePendingExecTransferState();
    var opts = options && typeof options === 'object' ? options : {};
    var taskStepIndex = Number(opts.taskStepIndex);
    if (!pending) return null;
    if (Object.prototype.hasOwnProperty.call(opts, 'taskState')) {
      pending.taskState = cloneAssistantTaskState(opts.taskState);
    }
    if (Number.isFinite(taskStepIndex)) pending.taskStepIndex = taskStepIndex;
    if (Object.prototype.hasOwnProperty.call(opts, 'continuation')) {
      pending.continuation = cloneAssistantTaskContinuation(opts.continuation);
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'sourceUserText')) {
      pending.sourceUserText = opts.sourceUserText === undefined || opts.sourceUserText === null ? '' : String(opts.sourceUserText);
    }
    return pending;
  }

  function updateActivePendingAssistantState(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var taskStepIndex = Number(opts.taskStepIndex);
    if (pendingTempExecReuseTargetSelection) {
      if (Object.prototype.hasOwnProperty.call(opts, 'taskState')) {
        pendingTempExecReuseTargetSelection.taskState = cloneAssistantTaskState(opts.taskState);
      }
      if (Number.isFinite(taskStepIndex)) pendingTempExecReuseTargetSelection.taskStepIndex = taskStepIndex;
      if (Object.prototype.hasOwnProperty.call(opts, 'continuation')) {
        pendingTempExecReuseTargetSelection.continuation = cloneAssistantTaskContinuation(opts.continuation);
      }
      if (Object.prototype.hasOwnProperty.call(opts, 'sourceUserText')) {
        pendingTempExecReuseTargetSelection.sourceUserText = opts.sourceUserText === undefined || opts.sourceUserText === null ? '' : String(opts.sourceUserText);
      }
      return pendingTempExecReuseTargetSelection;
    }
    if (pendingTempExecRemoveSelection) {
      if (Object.prototype.hasOwnProperty.call(opts, 'taskState')) {
        pendingTempExecRemoveSelection.taskState = cloneAssistantTaskState(opts.taskState);
      }
      if (Number.isFinite(taskStepIndex)) pendingTempExecRemoveSelection.taskStepIndex = taskStepIndex;
      if (Object.prototype.hasOwnProperty.call(opts, 'continuation')) {
        pendingTempExecRemoveSelection.continuation = cloneAssistantTaskContinuation(opts.continuation);
      }
      if (Object.prototype.hasOwnProperty.call(opts, 'sourceUserText')) {
        pendingTempExecRemoveSelection.sourceUserText = opts.sourceUserText === undefined || opts.sourceUserText === null ? '' : String(opts.sourceUserText);
      }
      return pendingTempExecRemoveSelection;
    }
    return updateActivePendingExecTransferState(opts);
  }

  function getPendingExecTransferWaitingSummary() {
    if (pendingExecTransferVersionNameClarify) return '等待你确认是否按新版本处理。';
    if (pendingExecTransferCreateVersionConfirm) return '等待你确认是否新建执行版本。';
    if (pendingExecTransferVersionSelection) return '等待你选择执行版本。';
    if (pendingExecTransferSelection) return '等待你选择目标用例。';
    return '';
  }

  function buildTempExecReuseSelectionWaitingSummary(selectionType) {
    var type = selectionType === undefined || selectionType === null ? '' : String(selectionType);
    if (type === 'delete_scope') return '等待你确认要删除哪一层范围的全部子项。';
    if (type === 'rename_scope') return '等待你确认是改整份预设，还是只改某条用例的子项名称。';
    if (type === 'rename_case') return '等待你确认要修改哪一条用例的子项名称。';
    if (type === 'preset_scope') return '等待你确认是更新整份预设，还是只处理某条用例。';
    if (type === 'preset_case') return '等待你确认要给哪一条用例新增或设置子项。';
    if (type === 'detail_choice') return '等待你确认要操作哪一个复用子项。';
    if (type === 'detail_case') return '等待你确认要操作哪一条用例的子项。';
    return '等待你确认要操作哪一份复用执行用例。';
  }

  function getPendingAssistantWaitingSummary() {
    if (pendingTempExecReuseTargetSelection) {
      return buildTempExecReuseSelectionWaitingSummary(pendingTempExecReuseTargetSelection.selectionType);
    }
    if (pendingTempExecRemoveSelection) return '等待你确认要移出哪个版本的执行用例。';
    return getPendingExecTransferWaitingSummary();
  }

  function normalizeExecTransferSelectionText(value) {
    return String(value === undefined || value === null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[_\-—－]+/g, '')
      .replace(/[()（）\[\]【】]/g, '');
  }

  function looksLikeExecTransferPositiveReply(text) {
    var compact = String(text === undefined || text === null ? '' : text)
      .trim()
      .replace(/\s+/g, '');
    if (!compact) return false;
    return /^(?:是|好|好的|可以|确认|确定|行|继续|新建|创建|新建吧|创建吧)$/.test(compact);
  }

  function looksLikeExecTransferNegativeReply(text) {
    var compact = String(text === undefined || text === null ? '' : text)
      .trim()
      .replace(/\s+/g, '');
    if (!compact) return false;
    return /^(?:否|不是|不|不要|不用|不新建|先不|取消|算了)$/.test(compact);
  }

  function buildExecTransferSelectionCandidateLabel(item) {
    var row = item && typeof item === 'object' ? item : {};
    var parts = [];
    var name = row.name ? String(row.name) : '';
    if (name) parts.push(name);
    if (row.projectName) parts.push('项目：' + String(row.projectName));
    if (row.versionName) parts.push('版本：' + String(row.versionName));
    if (row.itemCount !== undefined && row.itemCount !== null && String(row.itemCount) !== '') parts.push('条目：' + String(row.itemCount));
    if (row.id) parts.push('caseFileId=' + String(row.id));
    return parts.join(' | ');
  }

  function buildExecTransferVersionCandidateLabel(item) {
    var row = item && typeof item === 'object' ? item : {};
    var parts = [];
    var name = row.name ? String(row.name) : '';
    if (name) {
      if (row.isImportedVersion === true) name += '（原用例版本）';
      parts.push(name);
    }
    if (row.updatedAt) parts.push('更新时间：' + String(row.updatedAt));
    if (row.id) parts.push('versionId=' + String(row.id));
    return parts.join(' | ');
  }

  function rememberExecTransferSelection(result, options) {
    var data = result && typeof result === 'object' ? result : {};
    var opts = options && typeof options === 'object' ? options : {};
    var items = Array.isArray(data.items) ? data.items : [];
    var taskStepIndex = Number(opts.taskStepIndex);
    if (!Number.isFinite(taskStepIndex)) taskStepIndex = -1;
    if (!items.length || data.selectionRequired !== true) {
      clearPendingExecTransferSelection();
      return;
    }
    pendingExecTransferSelection = {
      createdAt: Date.now(),
      query: data.query ? String(data.query) : '',
      projectName: data.projectName ? String(data.projectName) : '',
      sourceUserText: opts.sourceUserText !== undefined && opts.sourceUserText !== null ? String(opts.sourceUserText) : '',
      taskState: cloneAssistantTaskState(opts.taskState),
      taskStepIndex: taskStepIndex,
      continuation: cloneAssistantTaskContinuation(opts.continuation),
      items: items.map(function(item, index) {
        var row = item && typeof item === 'object' ? item : {};
        return {
          index: index + 1,
          id: row.id ? String(row.id) : '',
          name: row.name ? String(row.name) : '',
          projectId: row.projectId ? String(row.projectId) : '',
          projectName: row.projectName ? String(row.projectName) : '',
          versionId: row.versionId ? String(row.versionId) : '',
          versionName: row.versionName ? String(row.versionName) : '',
          itemCount: row.itemCount === undefined || row.itemCount === null ? '' : String(row.itemCount),
        };
      }).filter(function(item) { return item.id; }),
    };
    if (!pendingExecTransferSelection.items.length) clearPendingExecTransferSelection();
  }

  function getPendingExecTransferContinuationStepArgs(continuation, toolName) {
    var data = cloneAssistantTaskContinuation(continuation);
    var normalizedTool = normalizeMcpToolName(toolName);
    var first = null;
    if (!data || data.type !== 'mcp' || !data.items.length || !normalizedTool) return null;
    first = data.items[0] && typeof data.items[0] === 'object' ? data.items[0] : null;
    if (!first) return null;
    if (normalizeMcpToolName(first.tool || first.name || '') !== normalizedTool) return null;
    return first.args && typeof first.args === 'object' ? JSON.parse(JSON.stringify(first.args)) : {};
  }

  function rememberExecTransferVersionSelection(result, options) {
    var data = result && typeof result === 'object' ? result : {};
    var opts = options && typeof options === 'object' ? options : {};
    var caseFileId = data.caseFileId ? String(data.caseFileId) : '';
    var projectId = data.projectId ? String(data.projectId) : '';
    var taskStepIndex = Number(opts.taskStepIndex);
    if (!Number.isFinite(taskStepIndex)) taskStepIndex = -1;
    if (!caseFileId || !projectId) {
      clearPendingExecTransferVersionSelection();
      return;
    }
    var items = Array.isArray(data.items) ? data.items : [];
    pendingExecTransferVersionSelection = {
      createdAt: Date.now(),
      approved: opts.approved === true,
      caseFileId: caseFileId,
      name: data.name ? String(data.name) : '',
      projectId: projectId,
      projectName: data.projectName ? String(data.projectName) : '',
      importVersionId: data.importVersionId ? String(data.importVersionId) : '',
      importVersionName: data.importVersionName ? String(data.importVersionName) : '',
      requestedVersionName: opts.requestedVersionName !== undefined && opts.requestedVersionName !== null ? String(opts.requestedVersionName).trim() : '',
      sourceUserText: opts.sourceUserText !== undefined && opts.sourceUserText !== null ? String(opts.sourceUserText) : '',
      taskState: cloneAssistantTaskState(opts.taskState),
      taskStepIndex: taskStepIndex,
      continuation: cloneAssistantTaskContinuation(opts.continuation),
      items: items.map(function(item, index) {
        var row = item && typeof item === 'object' ? item : {};
        return {
          index: index + 1,
          id: row.id ? String(row.id) : '',
          name: row.name ? String(row.name) : '',
          updatedAt: row.updatedAt ? String(row.updatedAt) : '',
          isImportedVersion: row.isImportedVersion === true,
        };
      }).filter(function(item) {
        return item.id && item.name;
      }),
    };
  }

  function rememberExecTransferCreateVersionConfirm(result, requestedVersionName, options) {
    var pending = pendingExecTransferVersionSelection && typeof pendingExecTransferVersionSelection === 'object'
      ? pendingExecTransferVersionSelection
      : null;
    var data = result && typeof result === 'object' ? result : {};
    var opts = options && typeof options === 'object' ? options : {};
    var caseFileId = data.caseFileId ? String(data.caseFileId) : (pending && pending.caseFileId ? String(pending.caseFileId) : '');
    var projectId = data.projectId ? String(data.projectId) : (pending && pending.projectId ? String(pending.projectId) : '');
    var requestedName = requestedVersionName === undefined || requestedVersionName === null ? '' : String(requestedVersionName).trim();
    var taskStepIndex = Number(opts.taskStepIndex);
    if (!Number.isFinite(taskStepIndex)) taskStepIndex = pending && Number.isFinite(Number(pending.taskStepIndex)) ? Number(pending.taskStepIndex) : -1;
    if (!caseFileId || !projectId || !requestedName) {
      clearPendingExecTransferCreateVersionConfirm();
      return;
    }
    pendingExecTransferCreateVersionConfirm = {
      createdAt: Date.now(),
      approved: opts.approved === true || Boolean(pending && pending.approved === true),
      caseFileId: caseFileId,
      name: data.name ? String(data.name) : (pending && pending.name ? String(pending.name) : ''),
      projectId: projectId,
      projectName: data.projectName ? String(data.projectName) : (pending && pending.projectName ? String(pending.projectName) : ''),
      requestedVersionName: requestedName,
      sourceUserText: opts.sourceUserText !== undefined && opts.sourceUserText !== null
        ? String(opts.sourceUserText)
        : (pending && pending.sourceUserText ? String(pending.sourceUserText) : ''),
      taskState: cloneAssistantTaskState(opts.taskState || (pending ? pending.taskState : null)),
      taskStepIndex: taskStepIndex,
      continuation: cloneAssistantTaskContinuation(opts.continuation || (pending ? pending.continuation : null)),
      items: pending && Array.isArray(pending.items) ? pending.items.slice() : [],
    };
  }

  function rememberExecTransferVersionNameClarify(result, requestedVersionName, rawInput, options) {
    var pending = result && typeof result === 'object' ? result : null;
    var opts = options && typeof options === 'object' ? options : {};
    var requestedName = requestedVersionName === undefined || requestedVersionName === null ? '' : String(requestedVersionName).trim();
    var taskStepIndex = Number(opts.taskStepIndex);
    if (!Number.isFinite(taskStepIndex)) taskStepIndex = pending && Number.isFinite(Number(pending.taskStepIndex)) ? Number(pending.taskStepIndex) : -1;
    if (!pending || !pending.caseFileId || !pending.projectId || !requestedName) {
      clearPendingExecTransferVersionNameClarify();
      return;
    }
    pendingExecTransferVersionNameClarify = {
      createdAt: Date.now(),
      approved: pending.approved === true,
      caseFileId: String(pending.caseFileId),
      name: pending.name ? String(pending.name) : '',
      projectId: String(pending.projectId),
      projectName: pending.projectName ? String(pending.projectName) : '',
      requestedVersionName: requestedName,
      sourceUserText: opts.sourceUserText !== undefined && opts.sourceUserText !== null
        ? String(opts.sourceUserText)
        : (pending.sourceUserText ? String(pending.sourceUserText) : ''),
      rawInput: rawInput === undefined || rawInput === null ? requestedName : String(rawInput).trim(),
      items: Array.isArray(pending.items) ? pending.items.slice() : [],
      taskState: cloneAssistantTaskState(opts.taskState || pending.taskState),
      taskStepIndex: taskStepIndex,
      continuation: cloneAssistantTaskContinuation(opts.continuation || pending.continuation),
    };
  }

  function buildExecTransferSearchResultText(result, responseHint) {
    var data = result && typeof result === 'object' ? result : {};
    var prefix = responseHint ? String(responseHint).trim() : '';
    var items = Array.isArray(data.items) ? data.items : [];
    var lines = [];
    if (prefix) lines.push(prefix);
    if (!items.length) {
      lines.push('未找到可转到当前执行的用例文件。');
      if (data.projectName) lines.push('范围：' + String(data.projectName));
      if (data.query) lines.push('查询：' + String(data.query));
      lines.push('你可以补充更具体的项目名或用例名后再试。');
  return lines.join('\n');
    }
    if (data.selectionRequired === true) {
      lines.push('找到 ' + items.length + ' 个候选用例，请先选择再转执行：');
      items.forEach(function(item, idx) {
        lines.push((idx + 1) + '. ' + buildExecTransferSelectionCandidateLabel(item));
      });
      if (data.truncated === true && Number(data.total) > items.length) {
        lines.push('还有 ' + (Number(data.total) - items.length) + ' 个候选未展开。');
      }
      lines.push('请直接回复“选第1个”或回复候选名。');
  return lines.join('\n');
    }
    var target = data.recommended && typeof data.recommended === 'object'
      ? data.recommended
      : (items[0] && typeof items[0] === 'object' ? items[0] : null);
    if (!target) {
      lines.push('未找到明确候选。');
  return lines.join('\n');
    }
    lines.push('已定位到可转执行的目标用例：');
    lines.push('1. ' + buildExecTransferSelectionCandidateLabel(target));
    lines.push('可继续调用 case_library.transfer_to_exec 完成转入。');
return lines.join('\n');
  }

  function buildExecTransferVersionSelectionText(result) {
    var data = result && typeof result === 'object' ? result : {};
    var items = Array.isArray(data.items) ? data.items : [];
    var lines = [];
    if (data.name) lines.push('已定位到用例【' + String(data.name) + '】。');
    lines.push('请选择要转入的执行版本：');
    if (data.projectName) lines.push('项目：' + String(data.projectName));
    if (data.importVersionName) lines.push('原用例版本：' + String(data.importVersionName));
    if (items.length) {
      items.forEach(function(item, idx) {
        lines.push((idx + 1) + '. ' + buildExecTransferVersionCandidateLabel(item));
      });
      lines.push('请回复“选第1个”或直接回复版本名；若要新建版本，也可以直接回复新的版本名。');
    } else {
      lines.push('当前项目下还没有可用执行版本。');
      lines.push('你可以直接回复想新建的版本名，或回复“取消”。');
    }
return lines.join('\n');
  }

  function buildExecTransferCreateVersionConfirmText(result) {
    var data = result && typeof result === 'object' ? result : {};
    var requested = data.requestedVersionName ? String(data.requestedVersionName) : '';
    var lines = [];
    if (data.name) lines.push('目标用例：' + String(data.name));
    if (data.projectName) lines.push('项目：' + String(data.projectName));
    lines.push('当前项目下不存在执行版本【' + requested + '】。是否为你新建后继续转执行？');
    lines.push('回复“是/新建”继续，回复“否/取消”返回版本选择。');
return lines.join('\n');
  }

  function buildExecTransferVersionNameClarifyText(result) {
    var data = result && typeof result === 'object' ? result : {};
    var requested = data.requestedVersionName ? String(data.requestedVersionName) : '';
    var lines = [];
    if (data.name) lines.push('目标用例：' + String(data.name));
    if (data.projectName) lines.push('项目：' + String(data.projectName));
    lines.push('我没有在当前可选执行版本中识别到【' + requested + '】。这是你想输入的新版本名吗？');
    lines.push('回复“是/继续”我会按新版本处理；回复“否/取消”我会继续帮你判断更像现有版本笔误，还是回到版本选择。');
return lines.join('\n');
  }

  function buildExecTransferSuccessText(data, fallbackName) {
    var row = data && typeof data === 'object' ? data : {};
    var name = row.name ? String(row.name) : (fallbackName ? String(fallbackName) : '目标用例');
    if (row.createdVersionCreated === true && row.createdVersionName) {
      return '已新建版本【' + String(row.createdVersionName) + '】，并将【' + name + '】转到当前执行。';
    }
    return '已将【' + name + '】转到当前执行。';
  }

  function buildExecTransferVersionSelectionRetryText() {
    var pending = pendingExecTransferVersionSelection && typeof pendingExecTransferVersionSelection === 'object'
      ? pendingExecTransferVersionSelection
      : null;
    if (!pending) return '请回复版本名或“选第1个”。';
    if (Array.isArray(pending.items) && pending.items.length) {
      return '未识别到有效执行版本，请回复“选第1个”或直接回复版本名；若要新建版本，也可以直接回复新的版本名。';
    }
    return '当前还没有可选执行版本，请直接回复想新建的版本名，或回复“取消”。';
  }

  async function interpretExecTransferVersionClarifyNegativeReply(pending) {
    var data = pending && typeof pending === 'object' ? pending : null;
    var apis = getApis();
    var requested = data && data.requestedVersionName ? String(data.requestedVersionName) : '';
    var rawInput = data && data.rawInput ? String(data.rawInput) : requested;
    var items = data && Array.isArray(data.items) ? data.items : [];
    var payload = null;
    var res = null;
    var parsed = null;
    var mode = '';
    var suggestedName = '';
    var i = 0;
    if (!data || !rawInput) return '';
    if (!apis.assistantApi || typeof apis.assistantApi.callModel !== 'function') return '';
    payload = {
      task: 'interpret_exec_transfer_version_name',
      rawInput: rawInput,
      requestedVersionName: requested,
      caseName: data.name ? String(data.name) : '',
      projectName: data.projectName ? String(data.projectName) : '',
      availableVersions: items.map(function(item) {
        return item && item.name ? String(item.name) : '';
      }).filter(function(item) { return !!item; }),
    };
    try {
      res = await apis.assistantApi.callModel(JSON.stringify(payload, null, 2), {
        prompt: buildConversationPromptWithPriority([
          '你是测试助手平台内置 AI 助手。',
          '当前场景：用户在“选择执行版本”阶段输入了一个未匹配成功的内容。',
          '助手刚追问“这是不是想输入的新版本名”，用户回答了否。',
          '请根据 rawInput 与 availableVersions 判断：更像是现有版本笔误，还是应回到版本选择。',
          '若能高置信推断某个现有版本，输出单个 JSON：{"mode":"retry_existing","versionName":"版本名","response":"给用户的简洁回复"}',
          '若不能高置信推断，输出：{"mode":"return_selection","response":"给用户的简洁回复"}',
          '只输出一个 JSON 对象，不要代码块。'
        ].join('\n'), rawInput),
        temperature: 0.1,
        history: buildConversationHistory(4, rawInput),
      });
    } catch (err) {
      res = null;
    }
    if (!res || res.ok !== true || !res.content) return '';
    parsed = parseJsonObjectFromText(String(res.content || '').trim());
    if (!parsed || typeof parsed !== 'object') return '';
    mode = parsed.mode ? String(parsed.mode).trim().toLowerCase() : '';
    suggestedName = parsed.versionName ? String(parsed.versionName).trim() : '';
    if (mode === 'retry_existing' && suggestedName) {
      for (i = 0; i < items.length; i += 1) {
        if (!items[i] || !items[i].name) continue;
        if (normalizeExecTransferSelectionText(items[i].name) === normalizeExecTransferSelectionText(suggestedName)) {
          return parsed.response && String(parsed.response).trim()
            ? String(parsed.response).trim()
            : ('我先不把【' + requested + '】当作新版本，更像是现有版本【' + items[i].name + '】。如果是它，直接回复版本名即可；如果不是，我会继续保留版本列表供你选择。');
        }
      }
    }
    if (parsed.response && String(parsed.response).trim()) return String(parsed.response).trim();
    return '';
  }

  function handleExecTransferToolData(toolData, responseHint, options) {
    var data = toolData && typeof toolData === 'object' ? toolData : {};
    var opts = options && typeof options === 'object' ? options : {};
    if (data.versionSelectionRequired === true) {
      clearPendingExecTransferSelection();
      clearPendingExecTransferCreateVersionConfirm();
      clearPendingExecTransferVersionNameClarify();
      rememberExecTransferVersionSelection(data, {
        approved: opts.approved === true,
        taskState: opts.taskState,
        taskStepIndex: opts.taskStepIndex,
        continuation: opts.continuation,
        sourceUserText: opts.sourceUserText,
        requestedVersionName: opts.requestedVersionName,
      });
      return responseHint ? String(responseHint) : buildExecTransferVersionSelectionText(data);
    }
    if (data.versionCreateConfirmRequired === true) {
      clearPendingExecTransferSelection();
      clearPendingExecTransferVersionNameClarify();
      rememberExecTransferVersionSelection(data, {
        approved: opts.approved === true,
        taskState: opts.taskState,
        taskStepIndex: opts.taskStepIndex,
        continuation: opts.continuation,
        sourceUserText: opts.sourceUserText,
        requestedVersionName: opts.requestedVersionName,
      });
      rememberExecTransferCreateVersionConfirm(data, data.requestedVersionName || '', {
        approved: opts.approved === true,
        taskState: opts.taskState,
        taskStepIndex: opts.taskStepIndex,
        continuation: opts.continuation,
        sourceUserText: opts.sourceUserText,
      });
      return responseHint ? String(responseHint) : buildExecTransferCreateVersionConfirmText(data);
    }
    clearPendingExecTransferSelection();
    clearPendingExecTransferManualState();
    if (responseHint) return String(responseHint);
    return buildExecTransferSuccessText(data, opts.fallbackName || '目标用例');
  }

  function parseSimpleChinesePositiveInt(value) {
    var raw = value === undefined || value === null ? '' : String(value).trim();
    if (!raw) return 0;
    var map = { '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
    if (raw === '十') return 10;
    if (raw.indexOf('十') === -1) return map[raw] || 0;
    var parts = raw.split('十');
    var tens = parts[0] ? (map[parts[0]] || 0) : 1;
    var units = parts[1] ? (map[parts[1]] || 0) : 0;
    return tens * 10 + units;
  }

  function resolvePendingExecTransferCandidate(text) {
    var raw = text === undefined || text === null ? '' : String(text).trim();
    var pending = pendingExecTransferSelection && Array.isArray(pendingExecTransferSelection.items)
      ? pendingExecTransferSelection
      : null;
    if (!pending || !pending.items.length || !raw) return { candidate: null, invalid: false, cancelled: false };
    if (containsAny(raw, ['取消', '先不', '不用', '算了'])) {
      return { candidate: null, invalid: false, cancelled: true };
    }
    var compact = raw.replace(/\s+/g, '');
    var index = 0;
    var digitMatch = compact.match(/^(?:选|就|用|转|执行)?第?(\d+)(?:个|条|项|份|号)?$/);
    if (digitMatch) {
      index = toPositiveInt(digitMatch[1], 0);
    } else {
      var chineseMatch = compact.match(/^(?:选|就|用|转|执行)?第?([一二两三四五六七八九十]+)(?:个|条|项|份|号)?$/);
      if (chineseMatch) index = parseSimpleChinesePositiveInt(chineseMatch[1]);
    }
    if (index > 0) {
      return {
        candidate: pending.items[index - 1] || null,
        invalid: !(pending.items[index - 1]),
        cancelled: false,
      };
    }
    var normalized = normalizeExecTransferSelectionText(raw);
    if (normalized) {
      for (var i = 0; i < pending.items.length; i += 1) {
        var item = pending.items[i];
        if (!item) continue;
        var name = normalizeExecTransferSelectionText(item.name || '');
        if (name && (normalized.indexOf(name) !== -1 || name.indexOf(normalized) !== -1)) {
          return { candidate: item, invalid: false, cancelled: false };
        }
      }
    }
    var looksLikeChoice = Boolean(digitMatch) || /第.+个/.test(compact) || /^\d+$/.test(compact);
    return { candidate: null, invalid: looksLikeChoice, cancelled: false };
  }

  function resolveAssistantChoiceIndexFromText(text) {
    var compact = String(text === undefined || text === null ? '' : text).trim().replace(/\s+/g, '');
    var index = 0;
    var digitMatch = null;
    var chineseMatch = null;
    var suffix = '(?:子项|测试项|用例|版本|候选)?';
    if (!compact) return 0;
    digitMatch = compact.match(new RegExp('^(?:选|就|用|转|执行|改|删|删除|处理)?第?(\\d+)(?:个|条|项|份|号)?' + suffix + '$'));
    if (!digitMatch) digitMatch = compact.match(new RegExp('^第(\\d+)(?:个|条|项|份|号)' + suffix + '$'));
    if (digitMatch) return toPositiveInt(digitMatch[1], 0);
    chineseMatch = compact.match(new RegExp('^(?:选|就|用|转|执行|改|删|删除|处理)?第?([一二两三四五六七八九十]+)(?:个|条|项|份|号)?' + suffix + '$'));
    if (!chineseMatch) chineseMatch = compact.match(new RegExp('^第([一二两三四五六七八九十]+)(?:个|条|项|份|号)' + suffix + '$'));
    if (chineseMatch) index = parseSimpleChinesePositiveInt(chineseMatch[1]);
    return index > 0 ? index : 0;
  }

  function findAssistantChoiceItemByModelSelection(items, parsed) {
    var list = Array.isArray(items) ? items : [];
    var data = parsed && typeof parsed === 'object' ? parsed : {};
    var selectedIndex = toPositiveInt(data.selectedIndex, 0);
    var selectedId = data.selectedId !== undefined && data.selectedId !== null ? String(data.selectedId).trim() : '';
    var selectedName = data.selectedName !== undefined && data.selectedName !== null ? String(data.selectedName).trim() : '';
    var normalizedSelectedName = normalizeExecTransferSelectionText(selectedName);
    var i = 0;
    if (selectedIndex > 0 && list[selectedIndex - 1]) return list[selectedIndex - 1];
    if (selectedId) {
      for (i = 0; i < list.length; i += 1) {
        if (!list[i]) continue;
        if (String(list[i].id || '') === selectedId) return list[i];
      }
    }
    if (normalizedSelectedName) {
      for (i = 0; i < list.length; i += 1) {
        if (!list[i]) continue;
        if (normalizeExecTransferSelectionText(list[i].name || '') === normalizedSelectedName) return list[i];
      }
    }
    return null;
  }

  async function resolveExecTransferChoiceByModel(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var latestUserInput = opts.latestUserInput === undefined || opts.latestUserInput === null ? '' : String(opts.latestUserInput).trim();
    var originalUserRequest = opts.originalUserRequest === undefined || opts.originalUserRequest === null ? '' : String(opts.originalUserRequest).trim();
    var entityLabel = opts.entityLabel ? String(opts.entityLabel) : '目标项';
    var items = Array.isArray(opts.items) ? opts.items : [];
    var allowCreate = opts.allowCreate === true;
    var apis = getApis();
    var payload = null;
    var res = null;
    var parsed = null;
    if (!latestUserInput || !apis.assistantApi || typeof apis.assistantApi.callModel !== 'function') return null;
    payload = {
      task: 'resolve_exec_transfer_choice',
      entityLabel: entityLabel,
      latestUserInput: latestUserInput,
      originalUserRequest: originalUserRequest,
      allowCreate: allowCreate,
      caseName: opts.caseName ? String(opts.caseName) : '',
      projectName: opts.projectName ? String(opts.projectName) : '',
      importVersionName: opts.importVersionName ? String(opts.importVersionName) : '',
      availableItems: items.map(function(item, index) {
        var row = item && typeof item === 'object' ? item : {};
        return {
          index: index + 1,
          id: row.id ? String(row.id) : '',
          name: row.name ? String(row.name) : '',
          label: opts.labelBuilder ? String(opts.labelBuilder(row) || '') : (row.name ? String(row.name) : ''),
        };
      }),
    };
    try {
      res = await apis.assistantApi.callModel(JSON.stringify(payload, null, 2), {
        prompt: buildConversationPromptWithPriority([
          '你是测试助手平台内置 AI 助手。',
          '当前任务：根据用户最新输入，从给定的候选列表中判断他想选中的' + entityLabel + '。',
          '必须优先理解 latestUserInput，同时参考 originalUserRequest；不要只做机械字符串切分。',
          '如果只有 1 个候选明显符合用户意图，输出 {"mode":"select","selectedIndex":1}。',
          '如果有多个候选都合理，例如用户说 912，而可选项同时有 912 / aa912 / 912新建，输出 {"mode":"ambiguous","candidateIndices":[1,2],"response":"..."}。',
          allowCreate ? '如果没有现有候选命中，但用户明显是在指定一个新' + entityLabel + '名，输出 {"mode":"create_confirm","requestedName":"...","response":"..."}。' : '',
          allowCreate ? '如果没有现有候选命中，但还需要先确认用户输入是不是想作为新' + entityLabel + '名，输出 {"mode":"clarify_new_name","requestedName":"...","response":"..."}。' : '',
          '如果信息不足或无法可靠判断，输出 {"mode":"invalid","response":"..."}。',
          '只输出一个 JSON 对象，不要代码块，不要额外解释。'
        ].filter(function(line) { return !!line; }).join('\n'), latestUserInput),
        temperature: 0.1,
        history: buildConversationHistory(4, latestUserInput),
      });
    } catch (err) {
      res = null;
    }
    if (!res || res.ok !== true || !res.content) return null;
    parsed = parseJsonObjectFromText(String(res.content || '').trim());
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      mode: parsed.mode ? String(parsed.mode).trim().toLowerCase() : '',
      requestedName: parsed.requestedName ? String(parsed.requestedName).trim() : '',
      response: parsed.response ? String(parsed.response).trim() : '',
      selectedItem: findAssistantChoiceItemByModelSelection(items, parsed),
      raw: parsed,
    };
  }



  async function resolveAssistantChoiceByModel(options) {
    return resolveExecTransferChoiceByModel(options);
  }

  function listTempExecFilesForAssistant() {
    var state = window.app && window.app.state && typeof window.app.state === 'object'
      ? window.app.state
      : null;
    return state && Array.isArray(state.tempExecFiles) ? state.tempExecFiles : [];
  }

  function getActiveTempExecFileForAssistant() {
    var list = listTempExecFilesForAssistant();
    var state = window.app && window.app.state && typeof window.app.state === 'object'
      ? window.app.state
      : null;
    var activeId = state ? String(state.tempExecActiveId || state.tempExecActiveFileId || '').trim() : '';
    var i = 0;
    if (!list.length) return null;
    if (activeId) {
      for (i = 0; i < list.length; i += 1) {
        var item = list[i] && typeof list[i] === 'object' ? list[i] : null;
        if (!item) continue;
        if (String(item.id || '').trim() === activeId) return item;
      }
    }
    return list.length === 1 ? list[0] : null;
  }

  function isTempExecFileWithReuseCasesForAssistant(file) {
    var target = file && typeof file === 'object' ? file : null;
    var cases = [];
    var i = 0;
    if (!target) return false;
    if (target.reuseEnabled === true) return true;
    cases = Array.isArray(target.cases) ? target.cases : [];
    for (i = 0; i < cases.length; i += 1) {
      if (isAssistantReuseCaseItem(cases[i])) return true;
    }
    return false;
  }

  function isActiveTempExecReuseFileForAssistant() {
    var file = getActiveTempExecFileForAssistant();
    return !!(file && isTempExecFileWithReuseCasesForAssistant(file));
  }

  function buildLiveTempExecCaseDataForAssistant() {
    var file = getActiveTempExecFileForAssistant();
    var cases = [];
    var fileId = '';
    var fileName = '';
    var items = [];
    if (!file || !Array.isArray(file.cases)) return null;
    cases = file.cases;
    fileId = file.id === undefined || file.id === null ? '' : String(file.id);
    fileName = getTempExecFileDisplayName(file, '当前执行用例');
    items = cases.map(function(item, index) {
      var row = item && typeof item === 'object' ? item : {};
      var details = getVisibleReuseDetailsForAssistantCase(row).map(function(detail, detailIndex) {
        var detailRow = detail && typeof detail === 'object' ? detail : {};
        return {
          index: detailRow.index === undefined || detailRow.index === null ? (detailIndex + 1) : detailRow.index,
          id: detailRow.id === undefined || detailRow.id === null ? '' : String(detailRow.id),
          text: detailRow.text === undefined || detailRow.text === null ? '' : String(detailRow.text),
          status: detailRow.status === undefined || detailRow.status === null ? '' : String(detailRow.status),
          note: detailRow.note === undefined || detailRow.note === null ? '' : String(detailRow.note),
        };
      });
      return {
        index: index + 1,
        id: row.id === undefined || row.id === null ? '' : String(row.id),
        module: row.module === undefined || row.module === null ? '' : String(row.module),
        title: row.title === undefined || row.title === null ? '' : String(row.title),
        priority: row.priority === undefined || row.priority === null ? '' : String(row.priority),
        remark: row.remark === undefined || row.remark === null ? '' : String(row.remark),
        actual: row.actual === undefined || row.actual === null ? '' : String(row.actual),
        status: row.status === undefined || row.status === null ? '' : String(row.status),
        result: row.result === undefined || row.result === null ? '' : String(row.result),
        executionResult: resolveCaseExecutionResult(row),
        isReuseCase: isAssistantReuseCaseItem(row),
        reuseDetailCount: details.length,
        reuseDetails: details,
      };
    });
    return {
      contextSource: 'tempexec-live',
      scope: 'editor',
      total: items.length,
      totalAll: items.length,
      truncated: false,
      caseFile: {
        id: fileId,
        name: fileName,
        reuseEnabled: file.reuseEnabled === true,
        hasReuseCases: isTempExecFileWithReuseCasesForAssistant(file),
      },
      items: items,
    };
  }

  function readTempExecStateIndexList(source, fileId) {
    if (!source || !fileId) return [];
    var raw = source[fileId];
    var list = [];
    if (!raw) return list;
    if (typeof raw.size === 'number' && typeof raw.forEach === 'function') {
      raw.forEach(function(value) { list.push(Number(value)); });
    } else if (Array.isArray(raw)) {
      list = raw.slice();
    } else if (typeof raw === 'object') {
      Object.keys(raw).forEach(function(key) {
        if (raw[key]) list.push(Number(key));
      });
    }
    return list.filter(function(value) { return Number.isFinite(value) && value >= 0; })
      .map(function(value) { return Math.floor(value); });
  }

  function findTempExecReuseTargetFileForAssistant(args) {
    var payload = args && typeof args === 'object' ? args : {};
    var list = listTempExecFilesForAssistant();
    var state = window.app && window.app.state && typeof window.app.state === 'object'
      ? window.app.state
      : null;
    var activeId = state ? String(state.tempExecActiveId || state.tempExecActiveFileId || '').trim() : '';
    var activeFile = null;
    var query = assistantReadFirstArgString(payload, ['fileName', 'query', 'keyword', 'file', 'title', 'name']);
    var normalizedQuery = normalizeExecTransferSelectionText(query || '');
    var exact = [];
    var partial = [];
    var i = 0;
    if (!list.length) return null;
    for (i = 0; i < list.length; i += 1) {
      var item = list[i] && typeof list[i] === 'object' ? list[i] : null;
      if (!item) continue;
      var fileId = item.id === undefined || item.id === null ? '' : String(item.id).trim();
      var fileName = getTempExecFileDisplayName(item, '');
      var normalizedName = normalizeExecTransferSelectionText(fileName || '');
      if (activeId && fileId === activeId) activeFile = item;
      if (!normalizedQuery || !normalizedName) continue;
      if (normalizedName === normalizedQuery) exact.push(item);
      else if (normalizedName.indexOf(normalizedQuery) !== -1 || normalizedQuery.indexOf(normalizedName) !== -1) partial.push(item);
    }
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return null;
    if (partial.length === 1) return partial[0];
    if (partial.length > 1) return null;
    if (!normalizedQuery && activeFile) return activeFile;
    if (!normalizedQuery && list.length === 1) return list[0];
    return null;
  }

  function shouldPreferTempExecReuseStatusUpdateForAssistant(args) {
    var payload = args && typeof args === 'object' ? args : {};
    var file = findTempExecReuseTargetFileForAssistant(payload) || getActiveTempExecFileForAssistant();
    var scope = '';
    var explicitCaseIndexes = Array.isArray(payload.caseIndexes) ? payload.caseIndexes : (Array.isArray(payload.indexes) ? payload.indexes : []);
    var caseIndexes = [];
    var caseIndex = 0;
    var i = 0;
    if (!file || !isTempExecFileWithReuseCasesForAssistant(file)) return false;
    if (payload.scope !== undefined && payload.scope !== null) scope = String(payload.scope).trim().toLowerCase();
    if (!scope && payload.target !== undefined && payload.target !== null) scope = String(payload.target).trim().toLowerCase();
    if (!scope && payload.range !== undefined && payload.range !== null) scope = String(payload.range).trim().toLowerCase();
    if (scope === 'all' || scope === 'file_all' || scope === 'matched_cases' || scope === 'selected_cases') return true;
    if (payload.applyAll === true || payload.all === true || payload.batch === true) return true;
    for (i = 0; i < explicitCaseIndexes.length; i += 1) {
      var num = toPositiveInt(explicitCaseIndexes[i], 0);
      if (num > 0) caseIndexes.push(num);
    }
    if (caseIndexes.length) {
      for (i = 0; i < caseIndexes.length; i += 1) {
        if (Array.isArray(file.cases) && file.cases[caseIndexes[i] - 1] && isAssistantReuseCaseItem(file.cases[caseIndexes[i] - 1])) {
          return true;
        }
      }
      return false;
    }
    caseIndex = resolveTempExecReuseCaseIndexForAssistant(payload, file);
    if (caseIndex > 0) {
      return !!(Array.isArray(file.cases) && file.cases[caseIndex - 1] && isAssistantReuseCaseItem(file.cases[caseIndex - 1]));
    }
    if (Array.isArray(file.cases) && file.cases.length === 1) {
      return isAssistantReuseCaseItem(file.cases[0]);
    }
    return false;
  }

  function resolveTempExecReuseCaseIndexForAssistant(args, file) {
    var payload = args && typeof args === 'object' ? args : {};
    var index = toPositiveInt(payload.index || payload.caseIndex || payload.itemIndex || payload.seq || payload.row, 0);
    var caseIndexes = Array.isArray(payload.caseIndexes) ? payload.caseIndexes : [];
    if (index > 0) return index;
    if (caseIndexes.length === 1) return toPositiveInt(caseIndexes[0], 0);
    if (file && Array.isArray(file.cases) && file.cases.length === 1) return 1;
    var fileId = file && file.id !== undefined && file.id !== null ? String(file.id) : '';
    var state = window.app && window.app.state && typeof window.app.state === 'object' ? window.app.state : null;
    if (!state || !fileId) return 0;
    var selection = readTempExecStateIndexList(state.tempExecSelections, fileId);
    if (selection.length === 1) return selection[0] + 1;
    var reuseOpen = readTempExecStateIndexList(state.tempExecReuseOpen, fileId);
    if (reuseOpen.length === 1) return reuseOpen[0] + 1;
    var remarkOpen = readTempExecStateIndexList(state.tempExecRemarkOpen, fileId);
    if (remarkOpen.length === 1) return remarkOpen[0] + 1;
    var defectOpen = readTempExecStateIndexList(state.tempExecDefectOpen, fileId);
    if (defectOpen.length === 1) return defectOpen[0] + 1;
    return 0;
  }

  function buildTempExecReuseDetailChoiceCandidateLabel(item) {
    var row = item && typeof item === 'object' ? item : {};
    if (row.label && String(row.label).trim()) return String(row.label).trim();
    var name = row.name ? String(row.name) : ('子项' + String(row.detailIndex || row.index || 1));
    var parts = ['第 ' + String(row.detailIndex || row.index || 1) + ' 个：' + name];
    var extra = [];
    if (row.status) extra.push('执行结果：' + String(row.status));
    if (row.note) extra.push('备注：' + trimAssistantTaskLabelText(String(row.note), 16));
    if (extra.length) parts.push('（' + extra.join('，') + '）');
    return parts.join('');
  }

  function buildTempExecReuseDetailChoiceCandidates(file, caseIndex) {
    var sourceIndex = Math.max(0, Number(caseIndex || 1) - 1);
    var targetCase = file && Array.isArray(file.cases) && file.cases[sourceIndex] ? file.cases[sourceIndex] : null;
    var details = targetCase && Array.isArray(targetCase.reuseDetails)
      ? targetCase.reuseDetails.filter(function(detail) {
          return detail && detail.removed !== true;
        })
      : [];
    return details.map(function(detail, index) {
      var row = detail && typeof detail === 'object' ? detail : {};
      var name = row.text ? String(row.text) : ('子项' + String(index + 1));
      var candidate = {
        id: row.id ? ('reuse-detail-choice:' + String(row.id)) : ('reuse-detail-choice:index-' + String(index + 1)),
        name: name,
        detailId: row.id ? String(row.id) : '',
        detailIndex: index + 1,
        status: row.status ? String(row.status) : '',
        note: row.note ? String(row.note) : '',
        applyPatch: {
          index: caseIndex,
          detailIndex: index + 1,
        },
      };
      if (candidate.detailId) candidate.applyPatch.detailId = candidate.detailId;
      candidate.applyPatch.detailName = name;
      candidate.label = buildTempExecReuseDetailChoiceCandidateLabel(candidate);
      return candidate;
    });
  }

  function buildTempExecReuseDetailChoiceActionSummary(args) {
    var payload = args && typeof args === 'object' ? args : {};
    var mode = normalizeTempExecReuseModeHint(assistantReadFirstArgString(payload, ['mode', 'action', 'type', 'intent', 'task', 'operationType', 'operateType', 'operate', 'op']));
    var field = normalizeTempExecReuseFieldName(payload.field || payload.key || payload.column || payload.name || payload.detailField || payload.subField || '');
    var value = assistantReadFirstArgString(payload, ['value', 'to', 'text', 'content', 'newValue']);
    if (mode === 'detail_delete') return '准备删除一个复用子项';
    if (field === 'actual') return value ? ('准备把复用子项执行结果改为' + value) : '准备修改复用子项执行结果';
    if (field === 'remark') return value ? ('准备修改复用子项备注为：' + trimAssistantTaskLabelText(value, 20)) : '准备修改复用子项备注';
    if (field === 'text') return value ? ('准备把复用子项名称改为' + trimAssistantTaskLabelText(value, 18)) : '准备修改复用子项名称';
    return '准备修改复用子项';
  }

  function buildTempExecReuseDetailChoiceSelectionData(rawText, args, file, caseIndex, items, extraResponse) {
    var payload = args && typeof args === 'object' ? args : {};
    var list = Array.isArray(items) ? items : [];
    var sourceIndex = Math.max(0, Number(caseIndex || 1) - 1);
    var targetCase = file && Array.isArray(file.cases) && file.cases[sourceIndex] ? file.cases[sourceIndex] : null;
    var detailName = assistantReadFirstArgString(payload, ['detailName', 'subItemName', 'childName', 'detailText', 'subItemText', 'childText']);
    var caseTitle = targetCase && targetCase.title ? String(targetCase.title) : '';
    var caseModule = targetCase && targetCase.module ? String(targetCase.module) : '';
    var actionSummary = buildTempExecReuseDetailChoiceActionSummary(payload);
    var actionLabel = normalizeTempExecReuseModeHint(assistantReadFirstArgString(payload, ['mode', 'action', 'type', 'intent', 'task', 'operationType', 'operateType', 'operate', 'op'])) === 'detail_delete'
      ? '确认要删除的复用子项'
      : '确认要修改的复用子项';
    var message = extraResponse ? String(extraResponse).trim() : '';
    if (!message) {
      if (detailName) {
        message = '我还不能稳定判断你说的“' + detailName + '”具体对应哪一个复用子项，请先确认：';
      } else {
        message = '当前目标用例里有多个复用子项，请先确认要操作哪一个：';
      }
    }
    if (actionSummary) message += '\n本次操作：' + actionSummary;
    if (caseTitle) {
      message += '\n目标用例：第 ' + String(caseIndex) + ' 条';
      if (caseModule) message += '，模块：' + caseModule;
      message += '，标题：' + caseTitle;
    }
    return {
      ok: false,
      reason: 'selection_required',
      selectionRequired: true,
      selectionType: 'detail_choice',
      actionLabel: actionLabel,
      query: detailName || String(rawText || '').trim(),
      message: message,
      items: list,
      pendingArgs: Object.assign({}, payload, {
        index: caseIndex,
      }),
    };
  }

  async function prepareTempExecReuseArgsByModel(rawText, parsedArgs) {
    var args = parsedArgs && typeof parsedArgs === 'object' ? Object.assign({}, parsedArgs) : null;
    var mode = '';
    var detailId = '';
    var file = null;
    var caseIndex = 0;
    var caseMetas = [];
    var items = [];
    var modelResolved = null;
    var latestInput = String(rawText || (args && args.sourceUserText ? args.sourceUserText : '') || '').trim();
    if (!args) return { args: null, selectionData: null };
    mode = normalizeTempExecReuseModeHint(assistantReadFirstArgString(args, ['mode', 'action', 'type', 'intent', 'task', 'operationType', 'operateType', 'operate', 'op']));
    if (mode !== 'detail_update' && mode !== 'detail_delete') {
      return { args: args, selectionData: null };
    }
    detailId = assistantReadFirstArgString(args, ['detailId', 'subItemId', 'childId']);
    if (detailId || toPositiveInt(args.detailIndex || args.subItemIndex || args.childIndex || args.detailSeq, 0) > 0) {
      return { args: args, selectionData: null };
    }
    file = findTempExecReuseTargetFileForAssistant(args);
    if (!file || file.reuseEnabled !== true) {
      return { args: args, selectionData: null };
    }
    caseIndex = resolveTempExecReuseCaseIndexForAssistant(args, file);
    if (!(caseIndex > 0)) {
      caseMetas = file && Array.isArray(file.cases) ? file.cases.map(function(item, idx) {
        var row = item && typeof item === 'object' ? item : {};
        var title = row.title ? String(row.title) : ('第 ' + String(idx + 1) + ' 条用例');
        var moduleName = row.module ? String(row.module) : '';
        var detailCount = Array.isArray(row.reuseDetails)
          ? row.reuseDetails.filter(function(detail) { return detail && detail.removed !== true; }).length
          : 0;
        return {
          id: 'reuse-detail-case:' + String(idx + 1),
          name: title,
          caseIndex: idx + 1,
          label: '第 ' + String(idx + 1) + ' 条：' + title + '（' + detailCount + ' 个子项' + (moduleName ? '，模块：' + moduleName : '') + '）',
          applyPatch: { index: idx + 1 },
        };
      }).filter(function(meta) { return meta && meta.label; }) : [];
      if (caseMetas.length > 1) {
        return {
          args: null,
          selectionData: {
            ok: false,
            reason: 'selection_required',
            selectionRequired: true,
            selectionType: 'detail_case',
            actionLabel: '确认要操作的用例条目',
            query: String(rawText || '').trim(),
            message: '还需要确认具体要操作哪条用例的子项，请先选择条目：',
            items: caseMetas,
            pendingArgs: Object.assign({}, args),
          },
        };
      }
      if (caseMetas.length === 1) caseIndex = caseMetas[0].caseIndex;
    }
    if (!(caseIndex > 0)) {
      return { args: args, selectionData: null };
    }
    items = buildTempExecReuseDetailChoiceCandidates(file, caseIndex);
    if (!items.length) {
      return { args: args, selectionData: null };
    }
    if (items.length === 1) {
      args.detailId = items[0].detailId || args.detailId;
      args.detailIndex = items[0].detailIndex;
      args.detailName = items[0].name;
      args.index = caseIndex;
      return { args: args, selectionData: null };
    }
    if (!latestInput) latestInput = assistantReadFirstArgString(args, ['detailName', 'subItemName', 'childName', 'detailText', 'subItemText', 'childText']);
    modelResolved = latestInput ? await resolveAssistantChoiceByModel({
      latestUserInput: latestInput,
      originalUserRequest: args.sourceUserText ? String(args.sourceUserText) : latestInput,
      entityLabel: '复用子项',
      allowCreate: false,
      items: items,
      labelBuilder: buildTempExecReuseDetailChoiceCandidateLabel,
    }) : null;
    if (modelResolved && modelResolved.mode === 'select' && modelResolved.selectedItem) {
      var selectedItem = modelResolved.selectedItem;
      args.detailId = selectedItem.detailId || assistantReadFirstArgString(selectedItem, ['detailId', 'id']);
      args.detailIndex = toPositiveInt(selectedItem.detailIndex || selectedItem.index, 0) || args.detailIndex;
      args.detailName = selectedItem.name ? String(selectedItem.name) : args.detailName;
      args.index = caseIndex;
      return { args: args, selectionData: null };
    }
    return {
      args: null,
      selectionData: buildTempExecReuseDetailChoiceSelectionData(rawText, args, file, caseIndex, items, modelResolved && modelResolved.response ? String(modelResolved.response) : ''),
    };
  }

  function buildExecTransferSearchArgsFromModelResult(parsed) {
    var data = parsed && typeof parsed === 'object' ? parsed : {};
    var nextArgs = {};
    var keys = ['query', 'caseFileName', 'projectName', 'projectId', 'versionName', 'versionId'];
    var i = 0;
    for (i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      var value = '';
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      value = data[key] === undefined || data[key] === null ? '' : String(data[key]).trim();
      if (!value) continue;
      nextArgs[key] = value;
    }
    var limit = toPositiveInt(data.limit, 0);
    if (limit > 0) nextArgs.limit = limit;
    return nextArgs;
  }

  function buildExecTransferSearchOutcomeForModel(result) {
    var row = result && typeof result === 'object' ? result : {};
    var data = row.data && typeof row.data === 'object' ? row.data : {};
    var items = Array.isArray(data.items) ? data.items : [];
    return {
      ok: row.ok === true,
      reason: row.reason ? String(row.reason) : '',
      query: data.query ? String(data.query) : '',
      projectName: data.projectName ? String(data.projectName) : '',
      total: Number(data.total || items.length || 0),
      selectionRequired: data.selectionRequired === true,
      items: items.slice(0, 5).map(function(item, index) {
        var hit = item && typeof item === 'object' ? item : {};
        return {
          index: index + 1,
          id: hit.id ? String(hit.id) : '',
          name: hit.name ? String(hit.name) : '',
          projectName: hit.projectName ? String(hit.projectName) : '',
          versionName: hit.versionName ? String(hit.versionName) : '',
        };
      }),
    };
  }

  function areExecTransferSearchArgsEquivalent(left, right) {
    var a = left && typeof left === 'object' ? left : {};
    var b = right && typeof right === 'object' ? right : {};
    var keys = ['query', 'caseFileName', 'projectName', 'projectId', 'versionName', 'versionId', 'limit'];
    var i = 0;
    for (i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      var av = a[key] === undefined || a[key] === null ? '' : String(a[key]).trim();
      var bv = b[key] === undefined || b[key] === null ? '' : String(b[key]).trim();
      if (av !== bv) return false;
    }
    return true;
  }

  async function resolveExecTransferSearchArgsByModel(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var latestUserInput = opts.latestUserInput === undefined || opts.latestUserInput === null ? '' : String(opts.latestUserInput).trim();
    var originalUserRequest = opts.originalUserRequest === undefined || opts.originalUserRequest === null ? '' : String(opts.originalUserRequest).trim();
    var attemptedArgs = opts.attemptedArgs && typeof opts.attemptedArgs === 'object' ? opts.attemptedArgs : {};
    var apis = getApis();
    var payload = null;
    var res = null;
    var parsed = null;
    var nextArgs = null;
    if (!latestUserInput || !apis.assistantApi || typeof apis.assistantApi.callModel !== 'function') return null;
    payload = {
      task: 'repair_exec_transfer_search_args',
      latestUserInput: latestUserInput,
      originalUserRequest: originalUserRequest || latestUserInput,
      attemptedArgs: {
        query: attemptedArgs.query === undefined || attemptedArgs.query === null ? '' : String(attemptedArgs.query).trim(),
        caseFileName: attemptedArgs.caseFileName === undefined || attemptedArgs.caseFileName === null ? '' : String(attemptedArgs.caseFileName).trim(),
        projectName: attemptedArgs.projectName === undefined || attemptedArgs.projectName === null ? '' : String(attemptedArgs.projectName).trim(),
        projectId: attemptedArgs.projectId === undefined || attemptedArgs.projectId === null ? '' : String(attemptedArgs.projectId).trim(),
        versionName: attemptedArgs.versionName === undefined || attemptedArgs.versionName === null ? '' : String(attemptedArgs.versionName).trim(),
        versionId: attemptedArgs.versionId === undefined || attemptedArgs.versionId === null ? '' : String(attemptedArgs.versionId).trim(),
      },
      lastToolResult: buildExecTransferSearchOutcomeForModel(opts.lastToolResult),
    };
    try {
      res = await apis.assistantApi.callModel(JSON.stringify(payload, null, 2), {
        prompt: buildConversationPromptWithPriority([
          '你是测试助手平台内置 AI 助手。',
          '当前任务：修正 case_library.search_exec_candidates 的搜索参数。',
          '必须优先理解 latestUserInput，同时参考 originalUserRequest；不要只做机械关键词切分。',
          '像“皮肤用例”“联机死亡用例”这类完整短语，优先完整保留，不要无依据缩成“皮肤”“死亡这些关键字”。',
          '如果项目或版本条件并不确定，宁可留空，不要误把目标执行版本当成搜索过滤条件。',
          '只输出一个 JSON 对象，可包含 query、caseFileName、projectName、projectId、versionName、versionId、limit；不需要的字段留空字符串或省略。'
        ].join('\n'), latestUserInput),
        temperature: 0.1,
        history: buildConversationHistory(4, latestUserInput),
      });
    } catch (err) {
      res = null;
    }
    if (!res || res.ok !== true || !res.content) return null;
    parsed = parseJsonObjectFromText(String(res.content || '').trim());
    if (!parsed || typeof parsed !== 'object') return null;
    nextArgs = buildExecTransferSearchArgsFromModelResult(parsed);
    return Object.keys(nextArgs).length ? nextArgs : null;
  }

  async function retryExecTransferSearchByModel(callToolFn, currentArgs, currentResult, userText) {
    var latestUserInput = userText === undefined || userText === null ? '' : String(userText).trim();
    var attemptedArgs = currentArgs && typeof currentArgs === 'object' ? Object.assign({}, currentArgs) : {};
    var result = currentResult && typeof currentResult === 'object' ? currentResult : null;
    var data = result && result.data && typeof result.data === 'object' ? result.data : {};
    var items = Array.isArray(data.items) ? data.items : [];
    var shouldRetry = false;
    var repairedArgs = null;
    var retriedResult = null;
    if (!latestUserInput || typeof callToolFn !== 'function') return null;
    if (!result || result.ok !== true) shouldRetry = true;
    else if (!items.length && Number(data.total || 0) <= 0) shouldRetry = true;
    if (!shouldRetry) return null;
    repairedArgs = await resolveExecTransferSearchArgsByModel({
      latestUserInput: latestUserInput,
      originalUserRequest: latestUserInput,
      attemptedArgs: attemptedArgs,
      lastToolResult: result,
    });
    if (!repairedArgs || areExecTransferSearchArgsEquivalent(attemptedArgs, repairedArgs)) return null;
    try {
      retriedResult = await callToolFn(repairedArgs);
    } catch (err) {
      retriedResult = { ok: false, reason: err && err.message ? String(err.message) : 'MCP 调用异常' };
    }
    if (retriedResult && typeof retriedResult === 'object') {
      retriedResult.__assistantRetryInfo = {
        attemptedArgs: Object.assign({}, attemptedArgs),
        repairedArgs: Object.assign({}, repairedArgs),
      };
    }
    return {
      args: repairedArgs,
      result: retriedResult,
    };
  }

  async function resolvePendingExecTransferVersion(text, pendingOverride, options) {
    var raw = text === undefined || text === null ? '' : String(text).trim();
    var pending = pendingOverride && typeof pendingOverride === 'object'
      ? pendingOverride
      : (pendingExecTransferVersionSelection && typeof pendingExecTransferVersionSelection === 'object' ? pendingExecTransferVersionSelection : null);
    var opts = options && typeof options === 'object' ? options : {};
    var index = 0;
    var modelResolved = null;
    if (!pending || !raw) {
      return { version: null, invalid: false, cancelled: false, createName: '', confirmCreateName: '', response: '' };
    }
    if (containsAny(raw, ['取消', '先不', '不用', '算了'])) {
      return { version: null, invalid: false, cancelled: true, createName: '', confirmCreateName: '', response: '' };
    }
    index = resolveAssistantChoiceIndexFromText(raw);
    if (index > 0) {
      return {
        version: pending.items && pending.items[index - 1] ? pending.items[index - 1] : null,
        invalid: !(pending.items && pending.items[index - 1]),
        cancelled: false,
        createName: '',
        confirmCreateName: '',
        response: '',
      };
    }
    if (looksLikeExecTransferPositiveReply(raw) || looksLikeExecTransferNegativeReply(raw)) {
      return { version: null, invalid: true, cancelled: false, createName: '', confirmCreateName: '', response: '' };
    }
    modelResolved = await resolveExecTransferChoiceByModel({
      latestUserInput: raw,
      originalUserRequest: opts.sourceUserText || (pending.sourceUserText ? String(pending.sourceUserText) : ''),
      entityLabel: '执行版本',
      allowCreate: true,
      caseName: pending.name || '',
      projectName: pending.projectName || '',
      importVersionName: pending.importVersionName || '',
      items: pending.items || [],
      labelBuilder: buildExecTransferVersionCandidateLabel,
    });
    if (!modelResolved) {
      return { version: null, invalid: true, cancelled: false, createName: '', confirmCreateName: '', response: '' };
    }
    if (modelResolved.mode === 'select' && modelResolved.selectedItem) {
      return { version: modelResolved.selectedItem, invalid: false, cancelled: false, createName: '', confirmCreateName: '', response: modelResolved.response || '' };
    }
    if (modelResolved.mode === 'create_confirm' && modelResolved.requestedName) {
      return { version: null, invalid: false, cancelled: false, createName: modelResolved.requestedName, confirmCreateName: '', response: modelResolved.response || '' };
    }
    if (modelResolved.mode === 'clarify_new_name' && modelResolved.requestedName) {
      return { version: null, invalid: false, cancelled: false, createName: '', confirmCreateName: modelResolved.requestedName, response: modelResolved.response || '' };
    }
    return { version: null, invalid: true, cancelled: false, createName: '', confirmCreateName: '', response: modelResolved.response || '' };
  }

  async function continueExecTransferWithVersionSelection(pending, version, options) {
    var data = pending && typeof pending === 'object' ? pending : null;
    var selectedVersion = version && typeof version === 'object' ? version : null;
    var opts = options && typeof options === 'object' ? options : {};
    var nextContinuation = null;
    var continuedPending = null;
    var args = null;
    var runResult = null;
    var replyText = '';
    var followPending = null;
    if (!data || !selectedVersion || !selectedVersion.id) return null;
    clearPendingExecTransferCreateVersionConfirm();
    clearPendingExecTransferVersionNameClarify();
    nextContinuation = consumeAssistantTaskContinuationStep(data && data.continuation, 'case_library.transfer_to_exec');
    continuedPending = Object.assign({}, data, {
      continuation: nextContinuation,
    });
    args = {
      caseFileId: data.caseFileId,
      projectId: data.projectId,
      execVersionId: selectedVersion.id,
    };
    if (data.approved === true) args.confirmed = true;
    setStatus('正在转到执行...');
    runResult = await callAssistantMcpToolWithApproval('case_library.transfer_to_exec', args, '转到当前执行');
    setStatus('');
    if (!runResult || runResult.ok !== true) {
      if (runResult && runResult.cancelled === true) {
        return {
          handled: true,
          text: '已取消，本次执行版本选择仍保留，你可以继续回复版本名。',
          messageOptions: {
            taskState: buildExecTransferPendingTaskState(data, 'waiting', '任务等待你继续选择执行版本。'),
          },
        };
      }
      return {
        handled: true,
        text: '转到执行失败：' + (runResult && runResult.reason ? String(runResult.reason) : '未知错误'),
        messageOptions: {
          taskState: buildExecTransferPendingTaskState(data, 'blocked', '转到执行失败，任务已中断。'),
        },
      };
    }
    replyText = handleExecTransferToolData(runResult.data || {}, '', {
      approved: true,
      fallbackName: data.name || '目标用例',
      taskState: data.taskState,
      taskStepIndex: data.taskStepIndex,
      continuation: nextContinuation,
      sourceUserText: opts.sourceUserText || data.sourceUserText || '',
    });
    followPending = pendingExecTransferVersionNameClarify || pendingExecTransferCreateVersionConfirm || pendingExecTransferVersionSelection;
    if (followPending) {
      return {
        handled: true,
        text: replyText,
        messageOptions: {
          taskState: buildExecTransferPendingTaskState(followPending, 'waiting', pendingExecTransferVersionNameClarify
            ? '等待你确认是否按新版本处理。'
            : (pendingExecTransferCreateVersionConfirm ? '等待你确认是否新建执行版本。' : '等待你选择执行版本。')),
        },
      };
    }
    return continuePendingExecTransferTask(continuedPending, replyText, {
      onTaskStateChange: opts.onTaskStateChange,
    });
  }

  function shouldAutoResolvePendingExecTransferVersionFromSource(pending, options) {
    var data = pending && typeof pending === 'object' ? pending : null;
    var opts = options && typeof options === 'object' ? options : {};
    var requestedVersionName = opts.requestedVersionName !== undefined && opts.requestedVersionName !== null
      ? String(opts.requestedVersionName).trim()
      : (data && data.requestedVersionName ? String(data.requestedVersionName).trim() : '');
    return Boolean(requestedVersionName);
  }

  async function tryAutoResolvePendingExecTransferVersionFromSource(pending, options) {
    var data = pending && typeof pending === 'object' ? pending : null;
    var opts = options && typeof options === 'object' ? options : {};
    var sourceText = opts.sourceUserText !== undefined && opts.sourceUserText !== null
      ? String(opts.sourceUserText).trim()
      : (data && data.sourceUserText ? String(data.sourceUserText).trim() : '');
    var resolved = null;
    if (!data || !sourceText || !shouldAutoResolvePendingExecTransferVersionFromSource(data, opts)) return null;
    resolved = await resolvePendingExecTransferVersion(sourceText, data, {
      sourceUserText: sourceText,
    });
    if (!resolved || resolved.cancelled === true) return null;
    if (resolved.version) {
      return continueExecTransferWithVersionSelection(data, resolved.version, {
        onTaskStateChange: opts.onTaskStateChange,
        sourceUserText: sourceText,
      });
    }
    if (resolved.confirmCreateName) {
      rememberExecTransferVersionNameClarify(data, resolved.confirmCreateName, sourceText, {
        taskState: data.taskState,
        taskStepIndex: data.taskStepIndex,
        continuation: data.continuation,
        sourceUserText: sourceText,
      });
      return {
        handled: true,
        text: buildExecTransferVersionNameClarifyText({
          name: data.name || '',
          projectName: data.projectName || '',
          requestedVersionName: resolved.confirmCreateName,
        }),
        messageOptions: {
          taskState: buildExecTransferPendingTaskState(pendingExecTransferVersionSelection || data, 'waiting', '等待你确认是否按新版本处理。'),
        },
      };
    }
    if (resolved.createName) {
      rememberExecTransferCreateVersionConfirm(data, resolved.createName, {
        approved: data.approved === true,
        taskState: data.taskState,
        taskStepIndex: data.taskStepIndex,
        continuation: data.continuation,
        sourceUserText: sourceText,
      });
      return {
        handled: true,
        text: buildExecTransferCreateVersionConfirmText({
          name: data.name || '',
          projectName: data.projectName || '',
          requestedVersionName: resolved.createName,
        }),
        messageOptions: {
          taskState: buildExecTransferPendingTaskState(pendingExecTransferVersionSelection || data, 'waiting', '等待你确认是否新建执行版本。'),
        },
      };
    }
    var requestedVersionName = data.requestedVersionName ? String(data.requestedVersionName).trim() : '';
    if (requestedVersionName && Array.isArray(data.items) && data.items.length === 1) {
      var singleVersion = data.items[0] && typeof data.items[0] === 'object' ? data.items[0] : null;
      if (singleVersion && singleVersion.id
        && normalizeExecTransferSelectionText(singleVersion.name || '') === normalizeExecTransferSelectionText(requestedVersionName)) {
        return continueExecTransferWithVersionSelection(data, singleVersion, {
          onTaskStateChange: opts.onTaskStateChange,
          sourceUserText: sourceText,
        });
      }
    }
    return null;
  }

  function buildAssistantApprovalDetail(info) {
    if (!info || typeof info !== 'object') return '';
    if (info.message) return String(info.message);
    if (info.hint) return String(info.hint);
    if (info.controlText) return '目标控件：' + String(info.controlText);
    return '';
  }

  function buildAssistantConfirmRetryArgs(baseArgs, info) {
    var nextArgs = Object.assign({}, baseArgs || {}, { confirmed: true });
    var patch = info && info.confirmPatch && typeof info.confirmPatch === 'object' ? info.confirmPatch : null;
    if (patch) nextArgs = Object.assign(nextArgs, patch);
    return nextArgs;
  }

  async function runAssistantMcpConfirmLoop(callOnce, args, actionLabel) {
    var currentArgs = args && typeof args === 'object' ? Object.assign({}, args) : {};
    var result = await callOnce(currentArgs);
    var confirmedRetryTried = false;
    var confirmRounds = 0;
    while (result && result.ok !== true && String(result.reason || '') === 'confirm_required') {
      var info = result.data && typeof result.data === 'object' ? result.data : {};
      var approved = await requestAssistantOperationApproval(info.actionLabel || actionLabel || '写操作', {
        detail: buildAssistantApprovalDetail(info),
        reason: '当前操作涉及写入、编辑或删除。',
      });
      if (!approved) {
        return {
          result: { ok: false, reason: '已取消', cancelled: true },
          args: currentArgs,
          confirmedRetryTried: confirmedRetryTried,
          cancelled: true,
        };
      }
      currentArgs = buildAssistantConfirmRetryArgs(currentArgs, info);
      confirmedRetryTried = true;
      confirmRounds += 1;
      if (confirmRounds >= 3) break;
      result = await callOnce(currentArgs);
    }
    return {
      result: result,
      args: currentArgs,
      confirmedRetryTried: confirmedRetryTried,
      cancelled: false,
    };
  }

  async function callAssistantMcpToolWithApproval(tool, args, actionLabel) {
    var apis = getApis();
    if (!apis.assistantMcpApi || typeof apis.assistantMcpApi.callTool !== 'function') {
      return { ok: false, reason: 'MCP 工具暂不可用' };
    }
    async function callOnce(payload) {
      try {
        return await apis.assistantMcpApi.callTool(tool, payload || {});
      } catch (err) {
        return { ok: false, reason: err && err.message ? String(err.message) : 'MCP 调用异常' };
      }
    }
    var flow = await runAssistantMcpConfirmLoop(callOnce, args || {}, actionLabel || tool);
    if (!flow) return { ok: false, reason: 'MCP 调用异常' };
    return flow.result;
  }


  function mergeAssistantReplyTextParts(parts) {
    var list = Array.isArray(parts) ? parts : [];
    var merged = [];
    var i = 0;
    for (i = 0; i < list.length; i += 1) {
      var value = list[i] === undefined || list[i] === null ? '' : String(list[i]).trim();
      if (!value) continue;
      if (merged.indexOf(value) !== -1) continue;
      merged.push(value);
    }
    return merged.join('\n');
  }

  async function runAssistantTaskContinuation(continuation, options) {
    var data = cloneAssistantTaskContinuation(continuation);
    var opts = options && typeof options === 'object' ? options : {};
    var taskState = cloneAssistantTaskState(opts.taskState);
    var onTaskStateChange = typeof opts.onTaskStateChange === 'function' ? opts.onTaskStateChange : null;
    var outputs = [];
    var haltedStatus = '';
    var haltedSummary = '';
    var i = 0;
    function pushTaskUpdate() {
      if (!onTaskStateChange || !taskState) return;
      onTaskStateChange(cloneAssistantTaskState(taskState), '已进入任务状态，正在执行。');
    }
    if (!data || data.type !== 'mcp' || !data.items.length) {
      return {
        status: 'completed',
        summary: '任务已完成。',
        text: '',
        taskState: taskState,
      };
    }
    for (i = 0; i < data.items.length; i += 1) {
      var stepIndex = data.stepIndices[i] !== undefined ? Number(data.stepIndices[i]) : -1;
      if (!Number.isFinite(stepIndex)) stepIndex = -1;
      if (taskState && stepIndex >= 0 && taskState.steps && taskState.steps[stepIndex]) {
        setAssistantTaskStateStepStatus(taskState, stepIndex, 'running', '正在执行：' + taskState.steps[stepIndex].label);
        pushTaskUpdate();
      }
      var result = await executeModelMcpToolCall(data.items[i], data.userText || '', data.responseHint || '');
      if (!result || result.handled !== true) {
        haltedStatus = 'blocked';
        haltedSummary = '当前步骤未产出可用结果。';
        if (taskState && stepIndex >= 0) {
          setAssistantTaskStateStepStatus(taskState, stepIndex, 'blocked', haltedSummary);
          pushTaskUpdate();
        }
        break;
      }
      var textOut = result.text === undefined || result.text === null ? '' : String(result.text).trim();
      var waitingSummary = getPendingAssistantWaitingSummary();
      if (waitingSummary) {
        var continuation = buildAssistantTaskContinuation('mcp', data.items.slice(i + 1), data.stepIndices.slice(i + 1), data.userText || '', data.responseHint || '');
        var pendingStepIndex = stepIndex;
        var currentToolName = normalizeMcpToolName(data.items[i] && (data.items[i].tool || data.items[i].name || ''));
        haltedStatus = 'waiting';
        haltedSummary = waitingSummary;
        if (pendingExecTransferSelection && currentToolName === 'case_library.search_exec_candidates' && continuation && continuation.stepIndices.length) {
          pendingStepIndex = Number(continuation.stepIndices[0]);
          if (!Number.isFinite(pendingStepIndex)) pendingStepIndex = stepIndex;
          if (taskState && stepIndex >= 0) {
            setAssistantTaskStateStepStatus(taskState, stepIndex, 'completed', '已完成当前步骤，等待你确认目标用例。');
          }
          if (taskState && pendingStepIndex >= 0 && taskState.steps && taskState.steps[pendingStepIndex]) {
            setAssistantTaskStateStepStatus(taskState, pendingStepIndex, 'waiting', waitingSummary);
          }
        } else if (taskState && stepIndex >= 0) {
          setAssistantTaskStateStepStatus(taskState, stepIndex, 'waiting', waitingSummary);
        }
        updateActivePendingAssistantState({
          taskState: taskState,
          taskStepIndex: pendingStepIndex,
          continuation: continuation,
          sourceUserText: data.userText || '',
        });
        pushTaskUpdate();
      } else if (textOut.indexOf('MCP 工具执行失败：') === 0) {
        haltedStatus = 'blocked';
        haltedSummary = '当前步骤执行失败。';
        if (taskState && stepIndex >= 0) {
          setAssistantTaskStateStepStatus(taskState, stepIndex, 'blocked', haltedSummary);
          pushTaskUpdate();
        }
      } else if (textOut === '已取消。') {
        haltedStatus = 'cancelled';
        haltedSummary = '当前步骤已取消。';
        if (taskState && stepIndex >= 0) {
          setAssistantTaskStateStepStatus(taskState, stepIndex, 'cancelled', haltedSummary);
          pushTaskUpdate();
        }
      } else if (taskState && stepIndex >= 0) {
        setAssistantTaskStateStepStatus(taskState, stepIndex, 'completed', i < data.items.length - 1 ? '当前步骤已完成，继续执行后续步骤。' : taskState.summary);
        pushTaskUpdate();
      }
      if (textOut && outputs.indexOf(textOut) === -1) outputs.push(textOut);
      if (haltedStatus) break;
    }
    if (!haltedStatus) {
      haltedStatus = 'completed';
      haltedSummary = '任务已完成。';
      if (taskState) {
        setAssistantTaskStateStatus(taskState, 'completed', haltedSummary);
      }
    } else if (taskState) {
      setAssistantTaskStateStatus(taskState, haltedStatus, haltedSummary);
    }
    return {
      status: haltedStatus,
      summary: haltedSummary,
      text: outputs.join('\n').trim(),
      taskState: taskState,
    };
  }

  async function continuePendingExecTransferTask(pending, leadingText, options) {
    var data = pending && typeof pending === 'object' ? pending : null;
    var opts = options && typeof options === 'object' ? options : {};
    var taskState = buildExecTransferPendingTaskState(data, 'completed', data && data.continuation ? '已完成当前选择，继续执行后续步骤。' : '任务已完成。');
    var continuation = data ? cloneAssistantTaskContinuation(data.continuation) : null;
    if (!continuation) {
      return {
        handled: true,
        text: String(leadingText || ''),
        messageOptions: {
          taskState: taskState,
        },
      };
    }
    var continued = await runAssistantTaskContinuation(continuation, {
      taskState: taskState,
      onTaskStateChange: opts.onTaskStateChange,
    });
    return {
      handled: true,
      text: mergeAssistantReplyTextParts([leadingText, continued && continued.text ? continued.text : '']),
      messageOptions: {
        taskState: continued && continued.taskState ? continued.taskState : taskState,
      },
    };
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
        prompt: buildConversationPromptWithPriority(prompt, userText),
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
    if (parseTempExecReuseUpdateCommand(raw)) return false;
    if (!containsAny(raw, ['用例', 'case'])) return false;
    if (isExplicitExecTransferIntent(raw)) return false;
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

  function isCaseLibraryContentQueryIntent(text) {
    var raw = String(text || '').trim();
    var hasLibraryScope = false;
    var hasQuerySignal = false;
    if (!raw) return false;
    if (!containsAny(raw, ['用例', 'case'])) return false;
    if (isExplicitExecTransferIntent(raw)) return false;
    if (isMissingLibraryIntent(raw)) return false;
    hasLibraryScope = containsAny(raw, ['用例库', 'case library', 'case-library', '库里', '库中', '全库', '跨页面', '跨页']);
    if (!hasLibraryScope) return false;
    if (containsAny(raw, ['当前这条', '该用例', '这个用例', '本用例', '当前用例'])
      && !containsAny(raw, ['查询', '搜索', '查找', '筛选', '过滤', '有没有', '是否有', '相关', '匹配', '命中', '关键字', '关键词', '模糊', '库中', '库里', '全库', '跨页面', '跨页'])) {
      return false;
    }
    hasQuerySignal = containsAny(raw, ['查询', '搜索', '查找', '搜', '筛选', '过滤', '匹配', '命中', '有没有', '是否有', '相关', '关键字', '关键词', '模糊', '内容', '包含', '含有', '找出', '找一下', '列出', '展示', '显示', '全部', '所有', '多少', '数量']);
    return hasQuerySignal;
  }

  function shouldSearchCaseLibraryAcrossAllProjects(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    return containsAny(raw, ['所有项目', '全部项目', '跨项目', '全库', '全项目']);
  }

  function isMissingLibraryIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (containsAny(raw, ['漏测推荐', '易漏推荐']) && containsAny(raw, ['触发', '生成', '运行', '执行'])) return false;
    if (containsAny(raw, ['漏测用例库', '易漏用例库', '漏测库', '易漏库'])) return true;
    if (containsAny(raw, ['漏测', '易漏']) && containsAny(raw, ['用例', 'case'])) return true;
    return false;
  }

  function isCrossPageCaseMissingMatchIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (!isMissingLibraryIntent(raw)) return false;
    if (containsAny(raw, ['跨页面', '跨页'])) return true;
    if (containsAny(raw, ['当前页面', '当前页', '本页', '当前执行', '当前用例', '这份用例', '当前的这份', '当前这份'])) return true;
    if (containsAny(raw, ['匹配', '命中', '关联', '相关', '对比', '比对', '比较', '有没有'])) return true;
    return false;
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
    if (isExplicitExecTransferIntent(raw)) return false;
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

  function isSearchListDisplayIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    return containsAny(raw, ['搜索', '查找', '筛选', '过滤', '搜', '找出', '筛出', '挑出', '列出', '列一下', '展示', '显示', '给我看', '看下', '看一下', '看看']);
  }

  function shouldPreferCurrentPageScopeForCaseQuery(text) {
    var raw = String(text || '').trim();
    var filterInfo = null;
    var hasFlexibleFilter = false;
    if (!raw) return false;
    if (!containsAny(raw, ['用例', 'case'])) return false;
    if (isExplicitExecTransferIntent(raw)) return false;
    if (isCurrentPageCaseIntent(raw)) return true;
    if (containsAny(raw, ['当前项目', '项目里', '项目中', '项目下', '全项目', '所有项目'])) return false;
    filterInfo = extractCaseListFilterInfo(raw);
    hasFlexibleFilter = filterInfo && filterInfo.hasFilter === true;
    if (!hasFlexibleFilter && !isSearchListDisplayIntent(raw)) return false;
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

  function hasExecTransferVerb(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    return containsAny(raw, ['转到', '转入', '加入', '添加到', '放到', '放入', '导入到', '移到', '同步到']);
  }

  function isVersionScopedExecTransferIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (!containsAny(raw, ['用例', 'case'])) return false;
    if (!hasExecTransferVerb(raw)) return false;
    if (!containsAny(raw, ['版本', '执行'])) return false;
    if (containsAny(raw, ['执行结果', '执行状态'])) return false;
    if (containsAny(raw, ['这个版本的执行', '该版本的执行', '当前版本的执行', '目标版本的执行'])) return true;
    if (/(?:这个|该|当前|目标|指定|新)\s*版本(?:的)?执行/.test(raw)) return true;
    if (/(?:转到|转入|加入|添加到|放到|放入|导入到|移到|同步到).{0,24}版本(?:的)?执行/.test(raw)) return true;
    if (/版本.{0,8}(?:执行页|执行列表|执行文件|执行版本|的执行)/.test(raw)) return true;
    return false;
  }

  function isExecArchiveIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (!containsAny(raw, ['归档'])) return false;
    if (containsAny(raw, ['查看归档', '打开归档', '归档列表', '归档页面', '用例归档页', '解散归档', '删除归档', '恢复归档'])) return false;
    if (containsAny(raw, ['执行', '用例', '结果'])) return true;
    return /(?:再|然后|之后|最后)?\s*归档/.test(raw);
  }

  function isExplicitExecTransferIntent(text) {
    var raw = String(text || '').trim();
    var hasExecTarget = false;
    var hasTransferVerb = false;
    if (!raw) return false;
    if (!containsAny(raw, ['用例', 'case', '执行'])) return false;
    if (containsAny(raw, ['切换到当前执行文件', '切换执行文件', '下一份执行用例', '下一份执行文件'])) return false;
    if (containsAny(raw, ['查看当前执行', '列出当前执行', '展示当前执行', '当前执行有哪些'])) return false;
    if (containsAny(raw, ['转到当前执行', '转入当前执行', '转到执行', '转执行', '加入当前执行', '加到当前执行', '放到当前执行', '放入当前执行', '导入到当前执行', '移到当前执行', '同步到当前执行'])) return true;
    hasExecTarget = containsAny(raw, ['当前执行', '执行页', '执行列表', '执行文件']) || isVersionScopedExecTransferIntent(raw);
    hasTransferVerb = hasExecTransferVerb(raw);
    if (containsAny(raw, ['切换', '切到', '换到', '跳到']) && !hasTransferVerb) return false;
    return hasExecTarget && hasTransferVerb;
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
        prompt: buildConversationPromptWithPriority(prompt, userText),
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

  function getVisibleReuseDetailsForAssistantCase(item) {
    var row = item && typeof item === 'object' ? item : {};
    return Array.isArray(row.reuseDetails) ? row.reuseDetails.filter(function(detail) {
      return detail && detail.removed !== true;
    }) : [];
  }

  function isAssistantReuseCaseItem(item) {
    var row = item && typeof item === 'object' ? item : {};
    if (row.isReuseCase === true) return true;
    if (Number(row.reuseDetailCount || 0) > 0) return true;
    return getVisibleReuseDetailsForAssistantCase(row).length > 0;
  }

  function normalizeAssistantObservedExecutionStatus(rawValue) {
    var normalized = normalizeCaseActualValueToken(rawValue);
    if (normalized === '变更重跑' || normalized === '有改动') return '未执行';
    if (normalized) return normalized;
    if (rawValue === undefined || rawValue === null) return '';
    var text = String(rawValue).trim();
    if (!text) return '';
    if (text === 'pending') return '未执行';
    return text;
  }

  function resolveAssistantReuseAggregateStatus(details) {
    var visibleDetails = Array.isArray(details) ? details.filter(function(detail) {
      return detail && detail.removed !== true;
    }) : [];
    var passed = 0;
    var failed = 0;
    var blocked = 0;
    var pending = 0;
    var unspecified = 0;
    var i = 0;
    if (!visibleDetails.length) return '未执行';
    for (i = 0; i < visibleDetails.length; i += 1) {
      var detail = visibleDetails[i] && typeof visibleDetails[i] === 'object' ? visibleDetails[i] : {};
      var status = normalizeAssistantObservedExecutionStatus(detail.status);
      if (status === '通过') passed += 1;
      else if (status === '失败') failed += 1;
      else if (status === '阻塞') blocked += 1;
      else if (status === '不适用') unspecified += 1;
      else pending += 1;
    }
    if (failed) return '失败';
    if (blocked) return '阻塞';
    if (pending) return '未执行';
    if (passed) return '通过';
    if (unspecified && !passed) return '不适用';
    return '未执行';
  }

  function resolveCaseExecutionResult(item) {
    var row = item && typeof item === 'object' ? item : {};
    var candidates = [
      row.executionResult,
      row.actual,
      row.status,
      row.result,
    ];
    var i = 0;
    if (isAssistantReuseCaseItem(row)) {
      return resolveAssistantReuseAggregateStatus(getVisibleReuseDetailsForAssistantCase(row));
    }
    for (i = 0; i < candidates.length; i += 1) {
      var value = candidates[i];
      var text = normalizeAssistantObservedExecutionStatus(value);
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
        prompt: buildConversationPromptWithPriority(prompt, raw),
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

  async function buildCaseLibraryQueryArgsFromUserText(baseArgs, userText) {
    var raw = String(userText || '').trim();
    var payload = baseArgs && typeof baseArgs === 'object' ? Object.assign({}, baseArgs) : {};
    var explicitFilter = null;
    var plannedFilter = null;
    var fallbackFilter = null;
    var fullDetail = false;
    var rawLimit = Number(payload.limit);
    if (!payload.query && raw) payload.query = raw;
    if (!payload.projectName && payload.project !== undefined && payload.project !== null) {
      payload.projectName = String(payload.project).trim();
    }
    explicitFilter = normalizeCaseListFilterPlan(payload.filterInfo);
    if ((!explicitFilter || explicitFilter.hasFilter !== true)
      && (payload.includeKeywords !== undefined || payload.keywords !== undefined || payload.keyword !== undefined
        || payload.excludeKeywords !== undefined || payload.exclude !== undefined
        || payload.indexParity !== undefined || payload.sequenceParity !== undefined
        || payload.idParity !== undefined || payload.caseIdParity !== undefined)) {
      explicitFilter = normalizeCaseListFilterPlan({
        includeKeywords: payload.includeKeywords !== undefined ? payload.includeKeywords : (payload.keywords !== undefined ? payload.keywords : payload.keyword),
        excludeKeywords: payload.excludeKeywords !== undefined ? payload.excludeKeywords : payload.exclude,
        indexParity: payload.indexParity !== undefined ? payload.indexParity : payload.sequenceParity,
        idParity: payload.idParity !== undefined ? payload.idParity : payload.caseIdParity,
      });
    }
    if ((!explicitFilter || explicitFilter.hasFilter !== true) && raw && shouldPlanCaseListFilterByModel(raw)) {
      plannedFilter = await planCaseListFilterByModel(raw);
      if (plannedFilter && plannedFilter.filterInfo && plannedFilter.filterInfo.hasFilter === true) {
        explicitFilter = plannedFilter.filterInfo;
      }
    }
    if ((!explicitFilter || explicitFilter.hasFilter !== true) && raw && shouldPlanCaseListFilterByModel(raw)) {
      fallbackFilter = extractCaseListFilterInfo(raw);
      if (fallbackFilter && fallbackFilter.hasFilter === true) {
        explicitFilter = fallbackFilter;
      }
    }
    if (explicitFilter && explicitFilter.hasFilter === true) {
      payload.filterInfo = explicitFilter;
    }
    fullDetail = String(payload.detailLevel || '').trim().toLowerCase() === 'full'
      || isCurrentCaseFullDetailIntent(raw)
      || isExplicitAllCaseDisplayIntent(raw)
      || isCaseDetailClarificationIntent(raw);
    payload.detailLevel = fullDetail ? 'full' : 'summary';
    if (payload.allProjects === undefined) payload.allProjects = shouldSearchCaseLibraryAcrossAllProjects(raw);
    if (payload.preferCurrentProject === undefined) payload.preferCurrentProject = payload.allProjects === true ? false : true;
    if (!Number.isFinite(rawLimit) || rawLimit <= 0) {
      rawLimit = fullDetail || (explicitFilter && explicitFilter.hasFilter === true) ? 120 : 40;
    }
    if (rawLimit > 200) rawLimit = 200;
    payload.limit = rawLimit;
    return payload;
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

  function buildCaseLibraryQueryScopeLabel(result) {
    var data = result && typeof result === 'object' ? result : {};
    var projectName = data.projectName ? String(data.projectName) : '';
    var projectId = data.projectId ? String(data.projectId) : '';
    if (data.scope === 'all-projects') return '跨项目用例库';
    if (projectName && projectId) return '项目“' + projectName + '”（' + projectId + '）用例库';
    if (projectName) return '项目“' + projectName + '”用例库';
    if (projectId) return '项目（' + projectId + '）用例库';
    return '用例库';
  }

  function buildCaseLibraryQueryMatchLine(item, index, fullDetail) {
    var row = item && typeof item === 'object' ? item : {};
    var seq = Number(row.sourceIndex);
    var caseSeq = Number.isFinite(seq) && seq > 0 ? seq : (row.index || (index + 1));
    var projectName = row.projectName ? String(row.projectName) : '';
    var fileName = row.caseFileName ? String(row.caseFileName) : (row.caseFileId ? ('用例#' + String(row.caseFileId)) : '未命名用例');
    var moduleName = row.module ? String(row.module) : '--';
    var title = row.title ? String(row.title) : ('条目#' + caseSeq);
    var priority = row.priority ? String(row.priority) : '--';
    var id = row.id ? String(row.id) : '--';
    var matchedKeywords = Array.isArray(row.matchedKeywords) ? row.matchedKeywords.filter(Boolean) : [];
    var lines = [];
    lines.push((index + 1) + '. [' + (projectName || '当前项目') + ' / ' + fileName + '] [' + moduleName + '] ' + title + ' | 序号: ' + caseSeq + ' | ID: ' + id + ' | 优先级: ' + priority + (matchedKeywords.length ? (' | 命中: ' + matchedKeywords.join(' / ')) : ''));
    if (fullDetail) {
      lines.push('前置条件: ' + (row.precondition ? String(row.precondition) : '—'));
      lines.push('步骤: ' + (row.steps ? String(row.steps) : '—'));
      lines.push('预期结果: ' + (row.expected ? String(row.expected) : '—'));
    }
    return lines.join('\n');
  }

  function formatCaseLibraryQueryResponse(res) {
    var result = res && typeof res === 'object' ? res : {};
    var items = Array.isArray(result.items) ? result.items : [];
    var total = Number(result.total);
    var matchedFileCount = Number(result.matchedFileCount);
    var searchedFileCount = Number(result.searchedFileCount);
    var searchedItemCount = Number(result.searchedItemCount);
    var projectCount = Number(result.projectCount);
    var errorCount = Number(result.errorCount);
    var filterLabel = buildCaseListFilterLabel(result.filterInfo);
    var scopeLabel = buildCaseLibraryQueryScopeLabel(result);
    var lines = [];
    var fullDetail = String(result.detailLevel || '').trim().toLowerCase() === 'full';
    if (!Number.isFinite(total) || total < 0) total = items.length;
    if (!Number.isFinite(matchedFileCount) || matchedFileCount < 0) matchedFileCount = 0;
    if (!Number.isFinite(searchedFileCount) || searchedFileCount < 0) searchedFileCount = 0;
    if (!Number.isFinite(searchedItemCount) || searchedItemCount < 0) searchedItemCount = 0;
    if (!Number.isFinite(projectCount) || projectCount < 0) projectCount = 0;
    if (!Number.isFinite(errorCount) || errorCount < 0) errorCount = 0;
    if (total <= 0) {
      lines.push(scopeLabel + '中未找到匹配用例。');
    } else {
      lines.push(scopeLabel + '共命中 ' + total + ' 条用例，涉及 ' + matchedFileCount + ' 份用例文件。');
    }
    if (result.queryText) {
      lines.push('查询内容：' + String(result.queryText) + (filterLabel ? ('；筛选口径：' + filterLabel) : ''));
    } else if (filterLabel) {
      lines.push('筛选口径：' + filterLabel);
    }
    var scanLine = '已扫描 ' + searchedFileCount + ' 份用例文件 / ' + searchedItemCount + ' 条用例';
    if (result.scope === 'all-projects' && projectCount > 0) scanLine += '，覆盖 ' + projectCount + ' 个项目';
    if (result.multiAgent && result.multiAgent.used === true) {
      scanLine += '；主 agent 已拆成 ' + (Number(result.multiAgent.chunkCount) || 0) + ' 个子任务并发检索';
    }
    lines.push(scanLine + '。');
    if (!items.length) {
      if (errorCount > 0) lines.push('另有 ' + errorCount + ' 份用例文件读取失败，结果可能不完整。');
  __TMP__    }
    lines.push('命中用例：');
    items.forEach(function(item, index) {
      lines.push(buildCaseLibraryQueryMatchLine(item, index, fullDetail));
    });
    if (result.truncated) {
      lines.push('当前仅展示前 ' + items.length + ' 条，另有 ' + Math.max(total - items.length, 0) + ' 条未展开。');
    }
    if (errorCount > 0) {
      lines.push('另有 ' + errorCount + ' 份用例文件读取失败，结果可能不完整。');
    }
    return lines.join('\n');
  }

  function formatCaseLibraryQueryCountResponse(res) {
    var result = res && typeof res === 'object' ? res : {};
    var total = Number(result.total);
    var matchedFileCount = Number(result.matchedFileCount);
    var searchedFileCount = Number(result.searchedFileCount);
    var searchedItemCount = Number(result.searchedItemCount);
    var projectCount = Number(result.projectCount);
    var filterLabel = buildCaseListFilterLabel(result.filterInfo);
    var scopeLabel = buildCaseLibraryQueryScopeLabel(result);
    var lines = [];
    if (!Number.isFinite(total) || total < 0) total = Array.isArray(result.items) ? result.items.length : 0;
    if (!Number.isFinite(matchedFileCount) || matchedFileCount < 0) matchedFileCount = 0;
    if (!Number.isFinite(searchedFileCount) || searchedFileCount < 0) searchedFileCount = 0;
    if (!Number.isFinite(searchedItemCount) || searchedItemCount < 0) searchedItemCount = 0;
    if (!Number.isFinite(projectCount) || projectCount < 0) projectCount = 0;
    lines.push(scopeLabel + '命中 ' + total + ' 条用例，涉及 ' + matchedFileCount + ' 份用例文件。');
    if (result.queryText) {
      lines.push('查询内容：' + String(result.queryText) + (filterLabel ? ('；筛选口径：' + filterLabel) : ''));
    } else if (filterLabel) {
      lines.push('筛选口径：' + filterLabel);
    }
    var scanLine = '已扫描 ' + searchedFileCount + ' 份用例文件 / ' + searchedItemCount + ' 条用例';
    if (result.scope === 'all-projects' && projectCount > 0) scanLine += '，覆盖 ' + projectCount + ' 个项目';
    if (result.multiAgent && result.multiAgent.used === true) {
      scanLine += '；主 agent 已拆成 ' + (Number(result.multiAgent.chunkCount) || 0) + ' 个子任务并发检索';
    }
    lines.push(scanLine + '。');
    return lines.join('\n');
  }

  function formatMissingLibraryListResponse(res) {
    var result = res && typeof res === 'object' ? res : {};
    var totalItems = Number(result.totalItems);
    if (!Number.isFinite(totalItems) || totalItems < 0) totalItems = 0;
    var total = Number(result.total);
    if (!Number.isFinite(total) || total < 0) total = totalItems;
    var totalModules = Number(result.totalModules);
    if (!Number.isFinite(totalModules) || totalModules < 0) totalModules = 0;
    var items = Array.isArray(result.items) ? result.items : [];
    if (result.hasContext === false) {
      return '当前没有可用于查询的漏测用例库上下文，请先打开带项目信息的用例页或项目页。';
    }
    if (result.libraryEmpty === true || totalItems <= 0) {
      return result.projectId ? ('当前项目（' + result.projectId + '）的漏测用例库暂无条目。') : '当前项目的漏测用例库暂无条目。';
    }
    var lines = [];
    if (result.queryText) {
      lines.push('漏测用例库按“' + String(result.queryText) + '”命中 ' + total + ' 条，涉及 ' + totalModules + ' 个模块。');
    } else {
      lines.push((result.projectId ? ('当前项目（' + result.projectId + '）') : '当前项目') + '的漏测用例库共 ' + totalItems + ' 条，涉及 ' + totalModules + ' 个模块。');
    }
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i] && typeof items[i] === 'object' ? items[i] : {};
      var moduleName = item.module ? String(item.module) : '--';
      var title = item.title ? String(item.title) : ('漏测条目#' + (item.id || (i + 1)));
      var typeLabel = item.typeLabel ? String(item.typeLabel) : '未分类';
      var priority = item.priority ? String(item.priority) : '--';
      lines.push((i + 1) + '. [' + moduleName + '] ' + title + ' | 类型: ' + typeLabel + ' | 优先级: ' + priority);
    }
    if (result.truncated) {
      lines.push('未完整展开，当前仅展示前 ' + items.length + ' 条。');
    }
return lines.join('\n');
  }

  function formatCrossPageMissingCaseMatchResponse(res) {
    var result = res && typeof res === 'object' ? res : {};
    var currentCaseTotal = Number(result.currentCaseTotal);
    if (!Number.isFinite(currentCaseTotal) || currentCaseTotal < 0) currentCaseTotal = 0;
    var missingTotal = Number(result.missingLibraryTotal);
    if (!Number.isFinite(missingTotal) || missingTotal < 0) missingTotal = 0;
    var matchTotal = Number(result.matchTotal);
    if (!Number.isFinite(matchTotal) || matchTotal < 0) matchTotal = 0;
    var matchedCaseCount = Number(result.matchedCaseCount);
    if (!Number.isFinite(matchedCaseCount) || matchedCaseCount < 0) matchedCaseCount = 0;
    var matchedMissingItemCount = Number(result.matchedMissingItemCount);
    if (!Number.isFinite(matchedMissingItemCount) || matchedMissingItemCount < 0) matchedMissingItemCount = 0;
    var candidateTotal = Number(result.candidateTotal);
    if (!Number.isFinite(candidateTotal) || candidateTotal < 0) candidateTotal = 0;
    var candidateMatchedCaseCount = Number(result.candidateMatchedCaseCount);
    if (!Number.isFinite(candidateMatchedCaseCount) || candidateMatchedCaseCount < 0) candidateMatchedCaseCount = 0;
    var candidateMatchedMissingItemCount = Number(result.candidateMatchedMissingItemCount);
    if (!Number.isFinite(candidateMatchedMissingItemCount) || candidateMatchedMissingItemCount < 0) candidateMatchedMissingItemCount = 0;
    var matches = Array.isArray(result.matches) ? result.matches : [];
    var candidates = Array.isArray(result.candidates) ? result.candidates : [];
    if (result.hasContext === false && String(result.reason || '') === 'no-current-cases') {
      return '当前页面没有可用于跨页面比对的用例，请先打开执行用例或用例编辑视图。';
    }
    if (result.libraryEmpty === true || missingTotal <= 0) {
      return result.projectId ? ('当前项目（' + result.projectId + '）的漏测用例库为空，暂时无法匹配。') : '当前项目的漏测用例库为空，暂时无法匹配。';
    }
    var caseFileName = result.caseFile && result.caseFile.name ? String(result.caseFile.name) : '';
    if (!matchTotal || !matches.length) {
      if (!candidateTotal || !candidates.length) {
        return '已比对当前页面 ' + currentCaseTotal + ' 条用例与漏测用例库 ' + missingTotal + ' 条条目，暂未找到明确匹配项。';
      }
      var candidateLines = [];
      if (caseFileName) {
        candidateLines.push('当前用例“' + caseFileName + '”暂未命中规则高置信匹配，但召回了 ' + candidateTotal + ' 组建议复核候选。');
      } else {
        candidateLines.push('当前页面用例暂未命中规则高置信匹配，但召回了 ' + candidateTotal + ' 组建议复核候选。');
      }
      candidateLines.push('涉及当前页 ' + candidateMatchedCaseCount + ' 条用例、漏测库 ' + candidateMatchedMissingItemCount + ' 条条目。');
      for (var c = 0; c < candidates.length; c += 1) {
        var candidateRow = candidates[c] && typeof candidates[c] === 'object' ? candidates[c] : {};
        var candidateCase = candidateRow.currentCase && typeof candidateRow.currentCase === 'object' ? candidateRow.currentCase : {};
        var candidateMissing = candidateRow.missingItem && typeof candidateRow.missingItem === 'object' ? candidateRow.missingItem : {};
        var candidateReason = Array.isArray(candidateRow.reasons) && candidateRow.reasons.length ? candidateRow.reasons.join('；') : '内容相关';
        var candidateTitle = candidateCase.title ? String(candidateCase.title) : ('当前用例#' + (candidateCase.index || (c + 1)));
        var missingTitle = candidateMissing.title ? String(candidateMissing.title) : ('漏测条目#' + (candidateMissing.index || (c + 1)));
        var missingModule = candidateMissing.module ? String(candidateMissing.module) : '--';
        var candidateLevel = candidateRow.candidateLevel ? String(candidateRow.candidateLevel) : '建议关注';
        candidateLines.push((c + 1) + '. [' + candidateLevel + '] 当前用例#' + (candidateCase.index || '-') + ' ' + candidateTitle + ' -> 漏测库[' + missingModule + '] ' + missingTitle + '（依据：' + candidateReason + '）');
      }
      if (result.candidateTruncated) {
        candidateLines.push('候选未完整展开，还有 ' + Math.max(candidateTotal - candidates.length, 0) + ' 组可继续复核。');
      }
      return candidateLines.join('\n');
    }
    var lines = [];
    if (caseFileName) {
      lines.push('当前用例“' + caseFileName + '”与漏测用例库共找到 ' + matchTotal + ' 组高置信匹配。');
    } else {
      lines.push('当前页面用例与漏测用例库共找到 ' + matchTotal + ' 组高置信匹配。');
    }
    lines.push('涉及当前页 ' + matchedCaseCount + ' 条用例、漏测库 ' + matchedMissingItemCount + ' 条条目。');
    if (candidateTotal > 0) {
      lines.push('另外还召回了 ' + candidateTotal + ' 组建议复核候选，可继续补看。');
    }
    for (var i = 0; i < matches.length; i += 1) {
      var row = matches[i] && typeof matches[i] === 'object' ? matches[i] : {};
      var currentCase = row.currentCase && typeof row.currentCase === 'object' ? row.currentCase : {};
      var missingItem = row.missingItem && typeof row.missingItem === 'object' ? row.missingItem : {};
      var reasonText = Array.isArray(row.reasons) && row.reasons.length ? row.reasons.join('；') : '内容匹配';
      var currentTitle = currentCase.title ? String(currentCase.title) : ('当前用例#' + (currentCase.index || (i + 1)));
      var missingTitle = missingItem.title ? String(missingItem.title) : ('漏测条目#' + (missingItem.index || (i + 1)));
      var missingModule = missingItem.module ? String(missingItem.module) : '--';
      lines.push((i + 1) + '. 当前用例#' + (currentCase.index || '-') + ' ' + currentTitle + ' -> 漏测库[' + missingModule + '] ' + missingTitle + '（依据：' + reasonText + '）');
    }
    if (result.truncated) {
      lines.push('未完整展开，还有 ' + Math.max(matchTotal - matches.length, 0) + ' 组高置信匹配结果。');
    }
    if (candidateTotal > 0 && result.candidateTruncated) {
      lines.push('建议复核候选未完整展开，还有 ' + Math.max(candidateTotal - candidates.length, 0) + ' 组候选。');
    }
return lines.join('\n');
  }


  function buildTempExecRemoveSelectionCandidateLabel(item) {
    var row = item && typeof item === 'object' ? item : {};
    if (row.label && String(row.label).trim()) return String(row.label).trim();
    var parts = [];
    var name = row.name ? String(row.name) : '';
    var versionName = row.versionName ? String(row.versionName) : '';
    var versionId = row.versionId ? String(row.versionId) : '';
    if (name) parts.push(name);
    if (versionName) parts.push('版本：' + versionName);
    else if (versionId) parts.push('版本ID：' + versionId);
    else if (row.id) parts.push('执行ID：' + String(row.id));
    return parts.join('，');
  }

  function buildTempExecReuseTargetSelectionCandidateLabel(item, selectionType) {
    var type = selectionType === undefined || selectionType === null ? '' : String(selectionType);
    if (type === 'detail_choice') return buildTempExecReuseDetailChoiceCandidateLabel(item);
    return buildTempExecRemoveSelectionCandidateLabel(item);
  }

  function hasTempExecReuseDetailCaseAggregateOption(items) {
    var list = Array.isArray(items) ? items : [];
    return list.some(function(item) {
      var id = item && item.id ? String(item.id) : '';
      return id === 'reuse-detail-case:matched_cases'
        || id === 'reuse-detail-case:selected_cases'
        || id === 'reuse-detail-case:file_all';
    });
  }

  function rememberTempExecRemoveSelection(result, options) {
    var data = result && typeof result === 'object' ? result : {};
    var opts = options && typeof options === 'object' ? options : {};
    var items = Array.isArray(data.items) ? data.items : [];
    var taskStepIndex = Number(opts.taskStepIndex);
    if (!Number.isFinite(taskStepIndex)) taskStepIndex = -1;
    if (!items.length || data.selectionRequired !== true) {
      clearPendingTempExecRemoveSelection();
      return;
    }
    pendingTempExecRemoveSelection = {
      createdAt: Date.now(),
      query: data.query ? String(data.query) : '',
      message: data.message ? String(data.message) : '',
      sourceUserText: opts.sourceUserText !== undefined && opts.sourceUserText !== null ? String(opts.sourceUserText) : '',
      taskState: cloneAssistantTaskState(opts.taskState),
      taskStepIndex: taskStepIndex,
      continuation: cloneAssistantTaskContinuation(opts.continuation),
      items: items.map(function(item, index) {
        var row = item && typeof item === 'object' ? item : {};
        return {
          index: index + 1,
          id: row.id ? String(row.id) : '',
          name: row.name ? String(row.name) : '',
          label: buildTempExecRemoveSelectionCandidateLabel(row),
          versionId: row.versionId ? String(row.versionId) : '',
          versionName: row.versionName ? String(row.versionName) : '',
          projectName: row.projectName ? String(row.projectName) : '',
        };
      }).filter(function(item) { return item.id; }),
    };
    if (!pendingTempExecRemoveSelection.items.length) clearPendingTempExecRemoveSelection();
  }

  function buildTempExecRemoveSelectionText(result) {
    var data = result && typeof result === 'object' ? result : {};
    var items = Array.isArray(data.items) ? data.items : [];
    var message = data.message ? String(data.message).trim() : '';
    var lines = [];
    if (message) return message;
    lines.push('当前执行中命中了多份同名用例，请先确认要移出哪一份：');
    items.forEach(function(item, idx) {
      lines.push((idx + 1) + '. ' + buildTempExecRemoveSelectionCandidateLabel(item));
    });
    lines.push('请回复“选第1个”或“两份都移除”。');
    return lines.join('\n');
  }

  function buildTempExecRemoveSelectionRetryText() {
    return '未识别到具体版本，请回复“选第1个”、“移除版本 v1 那份”，或回复“两份都移除”。';
  }

  function resolvePendingTempExecRemoveCandidate(text) {
    var raw = text === undefined || text === null ? '' : String(text).trim();
    var pending = pendingTempExecRemoveSelection && Array.isArray(pendingTempExecRemoveSelection.items)
      ? pendingTempExecRemoveSelection
      : null;
    var compact = '';
    var index = 0;
    var digitMatch = null;
    var chineseMatch = null;
    var normalized = '';
    var matched = [];
    if (!pending || !pending.items.length || !raw) return { items: null, invalid: false, cancelled: false, all: false };
    if (containsAny(raw, ['取消', '先不', '不用', '算了'])) {
      return { items: null, invalid: false, cancelled: true, all: false };
    }
    compact = raw.replace(/\s+/g, '');
    if (/(?:两份都移除|两个都移除|全部移除|都移除|全部删除|都删除|两份都删掉|两个都删掉|两份都要|两个都要)/.test(compact)
      || /^(?:两份|两个|全部|全都|都)(?:都)?(?:移除|删除|删掉|处理)?$/.test(compact)) {
      return { items: pending.items.slice(), invalid: false, cancelled: false, all: true };
    }
    digitMatch = compact.match(/^(?:选|就|移除|删除|移出|处理)?第?(\d+)(?:个|条|项|份|号)?(?:那份|那个|这份)?$/);
    if (digitMatch) {
      index = toPositiveInt(digitMatch[1], 0);
    } else {
      chineseMatch = compact.match(/^(?:选|就|移除|删除|移出|处理)?第?([一二两三四五六七八九十]+)(?:个|条|项|份|号)?(?:那份|那个|这份)?$/);
      if (chineseMatch) index = parseSimpleChinesePositiveInt(chineseMatch[1]);
    }
    if (index > 0) {
      return {
        items: pending.items[index - 1] ? [pending.items[index - 1]] : null,
        invalid: !(pending.items[index - 1]),
        cancelled: false,
        all: false,
      };
    }
    normalized = normalizeTempExecRemoveSelectionText(raw);
    if (normalized) {
      matched = pending.items.filter(function(item) {
        var row = item && typeof item === 'object' ? item : {};
        var tokens = [
          row.label,
          row.versionName,
          row.versionId,
          row.versionName ? ('版本' + row.versionName) : '',
          row.versionId ? ('版本' + row.versionId) : '',
          row.id ? ('执行' + row.id) : '',
          row.id ? ('id' + row.id) : ''
        ].map(function(token) {
          return normalizeTempExecRemoveSelectionText(token || '');
        }).filter(Boolean);
        for (var i = 0; i < tokens.length; i += 1) {
          if (normalized.indexOf(tokens[i]) !== -1 || tokens[i].indexOf(normalized) !== -1) return true;
        }
        return false;
      });
      if (matched.length === 1) {
        return { items: [matched[0]], invalid: false, cancelled: false, all: false };
      }
      if (matched.length > 1) {
        return { items: null, invalid: true, cancelled: false, all: false };
      }
    }
    return { items: null, invalid: /(?:第.+个|第.+份|\d+)/.test(compact), cancelled: false, all: false };
  }

  function buildTempExecRemovePendingTaskState(pending, status, summary) {
    var data = pending && typeof pending === 'object' ? pending : null;
    var state = cloneAssistantTaskState(data && data.taskState ? data.taskState : null);
    var stepIndex = data ? Number(data.taskStepIndex) : -1;
    if (!Number.isFinite(stepIndex)) stepIndex = -1;
    if (!state) {
      state = {
        title: '当前任务',
        summary: '',
        status: normalizeAssistantTaskStatus(status) || 'running',
        steps: [
          {
            label: '移出执行用例',
            description: '',
            status: normalizeAssistantTaskStatus(status) || 'running',
          }
        ],
      };
      stepIndex = 0;
    }
    if (stepIndex >= 0 && Array.isArray(state.steps) && stepIndex < state.steps.length) {
      setAssistantTaskStateStepStatus(state, stepIndex, status, summary === undefined ? null : summary);
    } else {
      setAssistantTaskStateStatus(state, status, summary === undefined ? null : summary);
    }
    if (summary !== undefined && summary !== null) state.summary = String(summary);
    state.status = normalizeAssistantTaskStatus(status) || deriveAssistantTaskStateStatus(state);
    return state;
  }

  async function continuePendingTempExecRemoveTask(pending, leadingText, options) {
    var data = pending && typeof pending === 'object' ? pending : null;
    var opts = options && typeof options === 'object' ? options : {};
    var taskState = buildTempExecRemovePendingTaskState(data, 'completed', data && data.continuation ? '已完成当前选择，继续执行后续步骤。' : '任务已完成。');
    var continuation = data ? cloneAssistantTaskContinuation(data.continuation) : null;
    if (!continuation) {
      return {
        handled: true,
        text: String(leadingText || ''),
        messageOptions: {
          taskState: taskState,
        },
      };
    }
    var continued = await runAssistantTaskContinuation(continuation, {
      taskState: taskState,
      onTaskStateChange: opts.onTaskStateChange,
    });
    return {
      handled: true,
      text: mergeAssistantReplyTextParts([leadingText, continued && continued.text ? continued.text : '']),
      messageOptions: {
        taskState: continued && continued.taskState ? continued.taskState : taskState,
      },
    };
  }

  function rememberTempExecReuseTargetSelection(result, options) {
    var data = result && typeof result === 'object' ? result : {};
    var opts = options && typeof options === 'object' ? options : {};
    var items = Array.isArray(data.items) ? data.items : [];
    var taskStepIndex = Number(opts.taskStepIndex);
    if (!Number.isFinite(taskStepIndex)) taskStepIndex = -1;
    if (!items.length || data.selectionRequired !== true) {
      clearPendingTempExecReuseTargetSelection();
      return;
    }
    pendingTempExecReuseTargetSelection = {
      createdAt: Date.now(),
      query: data.query ? String(data.query) : '',
      selectionType: data.selectionType ? String(data.selectionType) : '',
      actionLabel: data.actionLabel ? String(data.actionLabel) : '复用子项操作',
      message: data.message ? String(data.message) : '',
      pendingArgs: data.pendingArgs && typeof data.pendingArgs === 'object' ? Object.assign({}, data.pendingArgs) : {},
      sourceUserText: opts.sourceUserText !== undefined && opts.sourceUserText !== null ? String(opts.sourceUserText) : '',
      taskState: cloneAssistantTaskState(opts.taskState),
      taskStepIndex: taskStepIndex,
      continuation: cloneAssistantTaskContinuation(opts.continuation),
      items: items.map(function(item, index) {
        var row = item && typeof item === 'object' ? item : {};
        return {
          index: index + 1,
          id: row.id ? String(row.id) : '',
          name: row.name ? String(row.name) : '',
          label: buildTempExecReuseTargetSelectionCandidateLabel(row, data.selectionType),
          versionId: row.versionId ? String(row.versionId) : '',
          versionName: row.versionName ? String(row.versionName) : '',
          projectName: row.projectName ? String(row.projectName) : '',
          detailId: row.detailId ? String(row.detailId) : '',
          detailIndex: toPositiveInt(row.detailIndex || row.index, 0),
          status: row.status ? String(row.status) : '',
          note: row.note ? String(row.note) : '',
          applyPatch: row.applyPatch && typeof row.applyPatch === 'object' ? Object.assign({}, row.applyPatch) : null,
        };
      }).filter(function(item) { return item.id; }),
    };
    if (!pendingTempExecReuseTargetSelection.items.length) clearPendingTempExecReuseTargetSelection();
  }

  function buildTempExecReuseTargetSelectionText(result) {
    var data = result && typeof result === 'object' ? result : {};
    var items = Array.isArray(data.items) ? data.items : [];
    var message = data.message ? String(data.message).trim() : '';
    var selectionType = data.selectionType ? String(data.selectionType) : '';
    var lines = [];
    if (selectionType === 'delete_scope') {
      lines.push(message || '删除范围还不够明确，请先确认你要删除哪一层范围的全部子项：');
      items.forEach(function(item, idx) {
        lines.push((idx + 1) + '. ' + buildTempExecReuseTargetSelectionCandidateLabel(item, selectionType));
      });
      lines.push('请回复“选第1个”、“整份都删”，或“只删第2条”。');
  __TMP__    }
    if (selectionType === 'rename_scope') {
      lines.push(message || '名称修改范围还不够明确，请先确认你要改整份预设，还是只改某条用例里的子项：');
      items.forEach(function(item, idx) {
        lines.push((idx + 1) + '. ' + buildTempExecReuseTargetSelectionCandidateLabel(item, selectionType));
      });
      lines.push('请回复“全部都改”、“只改单条”，或“只改第2条”。');
  __TMP__    }
    if (selectionType === 'rename_case') {
      lines.push(message || '还需要确认具体要修改哪条用例，请从下面选择：');
      items.forEach(function(item, idx) {
        lines.push((idx + 1) + '. ' + buildTempExecReuseTargetSelectionCandidateLabel(item, selectionType));
      });
      lines.push('请回复“选第1个”或“只改第2条”。');
  __TMP__    }
    if (selectionType === 'preset_scope') {
      lines.push(message || '新增范围还不够明确，请先确认你要更新整份执行用例的预设子项，还是只处理某条用例：');
      items.forEach(function(item, idx) {
        lines.push((idx + 1) + '. ' + buildTempExecReuseTargetSelectionCandidateLabel(item, selectionType));
      });
      lines.push('请回复“整份都加”、“只加某条”，或“只加第2条”。');
  __TMP__    }
    if (selectionType === 'preset_case') {
      lines.push(message || '还需要确认具体要处理哪条用例，请从下面选择：');
      items.forEach(function(item, idx) {
        lines.push((idx + 1) + '. ' + buildTempExecReuseTargetSelectionCandidateLabel(item, selectionType));
      });
      lines.push('请回复“选第1个”或“只加第2条”。');
  __TMP__    }
    if (selectionType === 'detail_case') {
      var canChooseAll = hasTempExecReuseDetailCaseAggregateOption(items);
      lines.push(message || '还需要确认具体要操作哪条用例的子项，请从下面选择：');
      items.forEach(function(item, idx) {
        lines.push((idx + 1) + '. ' + buildTempExecReuseTargetSelectionCandidateLabel(item, selectionType));
      });
      lines.push(canChooseAll
        ? '请回复“选第1个”、“操作第2条”，或直接回复“全部”。'
        : '请回复“选第1个”或“操作第2条”。');
  __TMP__    }
    if (selectionType === 'detail_choice') {
      lines.push(message || '还需要确认具体要操作哪一个复用子项，请从下面选择：');
      items.forEach(function(item, idx) {
        lines.push((idx + 1) + '. ' + buildTempExecReuseTargetSelectionCandidateLabel(item, selectionType));
      });
      lines.push('请回复“选第1个”、“第2个子项”，或直接说更具体的子项名。');
  __TMP__    }
    if (message) return message;
    lines.push('找到多份可能匹配的复用执行用例，请先确认要操作哪一份：');
    items.forEach(function(item, idx) {
      lines.push((idx + 1) + '. ' + buildTempExecReuseTargetSelectionCandidateLabel(item, selectionType));
    });
    lines.push('请回复“选第1个”、“游侠那个”，或直接说具体版本名。');
    return lines.join('\n');
  }

  function buildTempExecReuseTargetSelectionRetryText(extraText, selectionType) {
    var prefix = extraText === undefined || extraText === null ? '' : String(extraText).trim();
    var type = selectionType === undefined || selectionType === null ? '' : String(selectionType);
    var base = '还没确定你要操作哪一份复用执行用例，请回复“选第1个”、“游侠那个”，或直接说具体版本名。';
    if (type === 'delete_scope') {
      base = '还没确定你要删除哪一层范围的全部子项，请回复“选第1个”、“整份都删”，或“只删第2条”。';
    } else if (type === 'rename_scope') {
      base = '还没确定你是要改整份预设，还是只改某条用例的子项名称，请回复“全部都改”、“只改单条”，或“只改第2条”。';
    } else if (type === 'rename_case') {
      base = '还没确定你要修改哪一条用例的子项名称，请回复“选第1个”或“只改第2条”。';
    } else if (type === 'preset_scope') {
      base = '还没确定你是要更新整份预设，还是只处理某条用例，请回复“整份都加”、“只加某条”，或“只加第2条”。';
    } else if (type === 'preset_case') {
      base = '还没确定你要处理哪一条用例，请回复“选第1个”或“只加第2条”。';
    } else if (type === 'detail_case') {
      base = hasTempExecReuseDetailCaseAggregateOption(pendingTempExecReuseTargetSelection && pendingTempExecReuseTargetSelection.items)
        ? '还没确定你要操作哪一条用例的子项，请回复“选第1个”、“操作第2条”，或直接回复“全部”。'
        : '还没确定你要操作哪一条用例的子项，请回复“选第1个”或“操作第2条”。';
    } else if (type === 'detail_choice') {
      base = '还没确定你要操作哪一个复用子项，请回复“选第1个”、“第2个子项”，或直接说更具体的子项名。';
    }
    return prefix ? (prefix + '\n' + base) : base;
  }

  async function resolvePendingTempExecReuseTargetChoice(text, pendingOverride, options) {
    var raw = text === undefined || text === null ? '' : String(text).trim();
    var pending = pendingOverride && typeof pendingOverride === 'object'
      ? pendingOverride
      : (pendingTempExecReuseTargetSelection && typeof pendingTempExecReuseTargetSelection === 'object' ? pendingTempExecReuseTargetSelection : null);
    var opts = options && typeof options === 'object' ? options : {};
    var index = 0;
    var modelResolved = null;
    var modelChecked = false;
    var normalized = '';
    var matched = [];
    var selectionType = pending && pending.selectionType ? String(pending.selectionType) : '';
    if (!pending || !Array.isArray(pending.items) || !pending.items.length || !raw) {
      return { item: null, invalid: false, cancelled: false, response: '' };
    }
    if (containsAny(raw, ['取消', '先不', '不用', '算了'])) {
      return { item: null, invalid: false, cancelled: true, response: '' };
    }
    if (selectionType === 'delete_scope') {
      var directScopeItem = null;
      var rowIndex = extractCaseUpdateTargetIndex(raw);
      if (containsAny(raw, ['整份都删', '整份删除', '删整份', '整个都删', '整个删除', '整份执行用例'])) {
        directScopeItem = pending.items.find(function(item) {
          return item && String(item.id || '') === 'reuse-delete-scope:file-all';
        }) || null;
      }
      if (!directScopeItem && rowIndex > 0) {
        directScopeItem = pending.items.find(function(item) {
          return item && String(item.id || '') === ('reuse-delete-scope:case-' + rowIndex);
        }) || null;
      }
      if (!directScopeItem && containsAny(raw, ['匹配的都删', '匹配项都删', '匹配这些都删', '匹配范围都删'])) {
        directScopeItem = pending.items.find(function(item) {
          return item && String(item.id || '') === 'reuse-delete-scope:matched-all';
        }) || null;
      }
      if (directScopeItem) {
        return {
          item: directScopeItem,
          invalid: false,
          cancelled: false,
          response: '',
        };
      }
    }
    if (selectionType === 'rename_scope') {
      var directRenameScopeItem = null;
      var renameRowIndex = extractCaseUpdateTargetIndex(raw);
      if (containsAny(raw, ['全部都改', '整份都改', '整份修改', '改整份', '预设都改', '预设子项都改'])) {
        directRenameScopeItem = pending.items.find(function(item) {
          return item && String(item.id || '') === 'reuse-rename-scope:preset';
        }) || null;
      }
      if (!directRenameScopeItem && (containsAny(raw, ['只改单条', '只改某条', '只改一条', '改单条']) || renameRowIndex > 0)) {
        directRenameScopeItem = pending.items.find(function(item) {
          return item && String(item.id || '') === 'reuse-rename-scope:single-case';
        }) || null;
        if (directRenameScopeItem && renameRowIndex > 0) {
          directRenameScopeItem = Object.assign({}, directRenameScopeItem, {
            applyPatch: Object.assign({}, directRenameScopeItem.applyPatch || {}, {
              index: renameRowIndex,
              caseIndexes: [renameRowIndex],
            }),
          });
        }
      }
      if (directRenameScopeItem) {
        return {
          item: directRenameScopeItem,
          invalid: false,
          cancelled: false,
          response: '',
        };
      }
    }
    if (selectionType === 'rename_case') {
      var renameCaseIndex = extractCaseUpdateTargetIndex(raw);
      if (renameCaseIndex > 0) {
        var directRenameCaseItem = pending.items.find(function(item) {
          return item && String(item.id || '') === ('reuse-rename-case:' + renameCaseIndex);
        }) || null;
        if (directRenameCaseItem) {
          return {
            item: directRenameCaseItem,
            invalid: false,
            cancelled: false,
            response: '',
          };
        }
      }
    }
    if (selectionType === 'preset_scope') {
      var directPresetScopeItem = null;
      var presetRowIndex = extractCaseUpdateTargetIndex(raw);
      if (containsAny(raw, ['整份都加', '整份添加', '整份增加', '整份都设', '整份设置', '全都加', '全部都加', '全部设置'])) {
        directPresetScopeItem = pending.items.find(function(item) {
          return item && String(item.id || '') === 'reuse-preset-scope:file-all';
        }) || null;
      }
      if (!directPresetScopeItem && (containsAny(raw, ['只加某条', '只加一条', '只处理某条', '只处理一条', '只给某条', '只给一条', '改单条']) || presetRowIndex > 0)) {
        directPresetScopeItem = pending.items.find(function(item) {
          return item && String(item.id || '') === 'reuse-preset-scope:single-case';
        }) || null;
        if (directPresetScopeItem && presetRowIndex > 0) {
          directPresetScopeItem = Object.assign({}, directPresetScopeItem, {
            applyPatch: Object.assign({}, directPresetScopeItem.applyPatch || {}, {
              index: presetRowIndex,
              caseIndexes: [presetRowIndex],
            }),
          });
        }
      }
      if (directPresetScopeItem) {
        return {
          item: directPresetScopeItem,
          invalid: false,
          cancelled: false,
          response: '',
        };
      }
    }
    if (selectionType === 'preset_case') {
      var presetCaseIndex = extractCaseUpdateTargetIndex(raw);
      if (presetCaseIndex > 0) {
        var directPresetCaseItem = pending.items.find(function(item) {
          return item && String(item.id || '') === ('reuse-preset-case:' + presetCaseIndex);
        }) || null;
        if (directPresetCaseItem) {
          return {
            item: directPresetCaseItem,
            invalid: false,
            cancelled: false,
            response: '',
          };
        }
      }
    }
    if (selectionType === 'detail_case') {
      var detailCaseIndex = extractCaseUpdateTargetIndex(raw);
      if (detailCaseIndex > 0) {
        var directDetailCaseItem = pending.items.find(function(item) {
          return item && (String(item.id || '') === ('reuse-detail-case:' + detailCaseIndex)
            || String(item.id || '') === ('reuse-detail-case:' + String(detailCaseIndex)));
        }) || null;
        if (directDetailCaseItem) {
          return {
            item: directDetailCaseItem,
            invalid: false,
            cancelled: false,
            response: '',
          };
        }
      }
      if (hasTempExecReuseDetailCaseAggregateOption(pending.items) && containsAny(raw, ['全部', '全都', '全部处理', '都处理', '全部改', '全都改'])) {
        modelChecked = true;
        modelResolved = await resolveExecTransferChoiceByModel({
          latestUserInput: raw,
          originalUserRequest: opts.sourceUserText || (pending.sourceUserText ? String(pending.sourceUserText) : ''),
          entityLabel: '待操作的用例条目',
          allowCreate: false,
          items: pending.items || [],
          labelBuilder: function(item) {
            return buildTempExecReuseTargetSelectionCandidateLabel(item, selectionType);
          },
        });
        if (modelResolved && modelResolved.mode === 'select' && modelResolved.selectedItem) {
          return { item: modelResolved.selectedItem, invalid: false, cancelled: false, response: modelResolved.response || '' };
        }
      }
    }
    index = resolveAssistantChoiceIndexFromText(raw);
    if (index > 0) {
      return {
        item: pending.items[index - 1] ? pending.items[index - 1] : null,
        invalid: !(pending.items[index - 1]),
        cancelled: false,
        response: '',
      };
    }
    var entityLabel = '复用执行用例';
    if (selectionType === 'delete_scope') entityLabel = '复用子项删除范围';
    else if (selectionType === 'rename_scope') entityLabel = '复用子项名称修改范围';
    else if (selectionType === 'rename_case') entityLabel = '待修改的用例';
    else if (selectionType === 'preset_scope') entityLabel = '复用预设处理范围';
    else if (selectionType === 'preset_case') entityLabel = '待处理的用例';
    else if (selectionType === 'detail_case') entityLabel = '待操作的用例条目';
    else if (selectionType === 'detail_choice') entityLabel = '待操作的复用子项';
    if (!modelChecked) {
      modelResolved = await resolveExecTransferChoiceByModel({
        latestUserInput: raw,
        originalUserRequest: opts.sourceUserText || (pending.sourceUserText ? String(pending.sourceUserText) : ''),
        entityLabel: entityLabel,
        allowCreate: false,
        items: pending.items || [],
        labelBuilder: function(item) {
          return buildTempExecReuseTargetSelectionCandidateLabel(item, selectionType);
        },
      });
    }
    if (modelResolved && modelResolved.mode === 'select' && modelResolved.selectedItem) {
      return { item: modelResolved.selectedItem, invalid: false, cancelled: false, response: modelResolved.response || '' };
    }
    normalized = normalizeTempExecRemoveSelectionText(raw);
    if (normalized) {
      matched = pending.items.filter(function(item) {
        var row = item && typeof item === 'object' ? item : {};
        var tokens = selectionType === 'detail_choice'
          ? [
              row.label,
              row.name,
              row.status,
              row.note,
              row.detailId,
              row.detailIndex ? ('第' + String(row.detailIndex) + '个') : ''
            ]
          : [
              row.label,
              row.name,
              row.versionName,
              row.versionId,
              row.projectName,
              row.versionName ? ('版本' + row.versionName) : '',
              row.versionId ? ('版本' + row.versionId) : ''
            ];
        tokens = tokens.map(function(token) {
          return normalizeTempExecRemoveSelectionText(token || '');
        }).filter(Boolean);
        for (var i = 0; i < tokens.length; i += 1) {
          if (normalized.indexOf(tokens[i]) !== -1 || tokens[i].indexOf(normalized) !== -1) return true;
        }
        return false;
      });
      if (matched.length === 1) {
        return { item: matched[0], invalid: false, cancelled: false, response: modelResolved && modelResolved.response ? String(modelResolved.response) : '' };
      }
    }
    return {
      item: null,
      invalid: true,
      cancelled: false,
      response: modelResolved && modelResolved.response ? String(modelResolved.response) : '',
    };
  }

  function buildTempExecReusePendingTaskState(pending, status, summary) {
    var data = pending && typeof pending === 'object' ? pending : null;
    var state = cloneAssistantTaskState(data && data.taskState ? data.taskState : null);
    var stepIndex = data ? Number(data.taskStepIndex) : -1;
    var stepLabel = data && data.actionLabel ? String(data.actionLabel) : '复用子项操作';
    if (!Number.isFinite(stepIndex)) stepIndex = -1;
    if (!state) {
      state = {
        title: '当前任务',
        summary: '',
        status: normalizeAssistantTaskStatus(status) || 'running',
        steps: [
          {
            label: stepLabel,
            description: '',
            status: normalizeAssistantTaskStatus(status) || 'running',
          }
        ],
      };
      stepIndex = 0;
    }
    if (stepIndex >= 0 && Array.isArray(state.steps) && stepIndex < state.steps.length) {
      setAssistantTaskStateStepStatus(state, stepIndex, status, summary === undefined ? null : summary);
    } else {
      setAssistantTaskStateStatus(state, status, summary === undefined ? null : summary);
    }
    if (summary !== undefined && summary !== null) state.summary = String(summary);
    state.status = normalizeAssistantTaskStatus(status) || deriveAssistantTaskStateStatus(state);
    return state;
  }

  async function continuePendingTempExecReuseTargetTask(pending, leadingText, options) {
    var data = pending && typeof pending === 'object' ? pending : null;
    var opts = options && typeof options === 'object' ? options : {};
    var taskState = buildTempExecReusePendingTaskState(data, 'completed', data && data.continuation ? '已完成当前选择，继续执行后续步骤。' : '任务已完成。');
    var continuation = data ? cloneAssistantTaskContinuation(data.continuation) : null;
    if (!continuation) {
      return {
        handled: true,
        text: String(leadingText || ''),
        messageOptions: {
          taskState: taskState,
        },
      };
    }
    var continued = await runAssistantTaskContinuation(continuation, {
      taskState: taskState,
      onTaskStateChange: opts.onTaskStateChange,
    });
    return {
      handled: true,
      text: mergeAssistantReplyTextParts([leadingText, continued && continued.text ? continued.text : '']),
      messageOptions: {
        taskState: continued && continued.taskState ? continued.taskState : taskState,
      },
    };
  }

  function isTempExecRemoveIntent(text) {
    var raw = String(text || '').trim();
    if (!raw) return false;
    if (containsAny(raw, ['归档', '转到执行', '转执行', '转入执行'])) return false;
    return containsAny(raw, [
      '移出执行',
      '移除执行',
      '移出当前执行',
      '移除当前执行',
      '从当前执行中移除',
      '从执行中移除',
      '从执行里移除',
      '从当前执行中删除',
      '从执行中删除',
      '从执行里删除',
      '删出执行'
    ]);
  }

  function normalizeTempExecRemoveQueryText(value) {
    var text = String(value || '').trim();
    if (!text) return '';
    text = text.replace(/^(?:请|帮我|麻烦|把|将)+/, '').trim();
    text = text.replace(/^(?:当前执行中的|当前执行里(?:的)?|执行中的|执行里(?:的)?|当前这份|当前这个|这份|这个|该)+/, '').trim();
    text = text.replace(/(?:用例文件|执行用例|测试用例|用例|测试|case)+$/i, '').trim();
    text = text.replace(/^[“”"'`]+|[“”"'`]+$/g, '').trim();
    return text;
  }

  function extractTempExecRemoveQueryFromText(text) {
    var raw = String(text || '').trim();
    var patterns = [
      /(?:把|将)?(.+?)(?:移出当前执行|移出执行|移除当前执行|移除执行|从当前执行中移除|从执行中移除|从执行里移除|从当前执行中删除|从执行中删除|从执行里删除|删出执行)/,
      /(?:从当前执行中|从执行中|从执行里)(.+?)(?:移除|删除)/,
    ];
    var match = null;
    var candidate = '';
    if (!raw) return '';
    for (var i = 0; i < patterns.length; i += 1) {
      match = raw.match(patterns[i]);
      if (!match || !match[1]) continue;
      candidate = normalizeTempExecRemoveQueryText(match[1]);
      if (candidate) return candidate;
    }
    if (containsAny(raw, ['当前这份', '当前这个', '这份用例', '这个用例', '该用例'])) return '';
    return '';
  }

  function buildTempExecRemoveArgsFromText(text) {
    var query = extractTempExecRemoveQueryFromText(text);
    return query ? { query: query } : {};
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

  function parseSettingKey(raw) {
    if (containsAny(raw, ['助手模型', '聊天模型'])) return 'assistantModelId';
    if (containsAny(raw, ['助手', 'ai助手'])) return 'assistantEnabled';
    if (containsAny(raw, ['易漏', '漏测推荐'])) return 'missingCaseReminderAiEnabled';
    if (containsAny(raw, ['导航', '收起'])) return 'smartTopNavCollapse';
    if (containsAny(raw, ['主题'])) return 'theme';
    if (containsAny(raw, ['超时'])) return 'timeoutSec';
    return '';
  }

  function rewriteLegacyExecBatchToolIfNeeded(tool, args, userText) {
    var payload = args && typeof args === 'object' ? Object.assign({}, args) : {};
    var value = '';
    var batchArgs = null;
    if (tool === 'case_library.batch_update_exec_results') {
      if (payload.value !== undefined && payload.value !== null && String(payload.value).trim()) value = String(payload.value).trim();
      if (!value && payload.result !== undefined && payload.result !== null && String(payload.result).trim()) value = String(payload.result).trim();
      if (!value && payload.status !== undefined && payload.status !== null && String(payload.status).trim()) value = String(payload.status).trim();
      if (!value && payload.to !== undefined && payload.to !== null && String(payload.to).trim()) value = String(payload.to).trim();
      batchArgs = inferCaseUpdateArgsFromText(Object.assign({
        context: 'tempexec',
        scope: 'all',
        field: 'actual'
      }, value ? { value: value } : {}, payload), userText);
      if (shouldPreferTempExecReuseStatusUpdateForAssistant(batchArgs)) {
        return {
          tool: 'tempexec.reuse_update',
          args: Object.assign({}, batchArgs, {
            mode: 'detail_update',
            field: 'actual',
            applyAll: true,
            scope: 'file_all',
          }),
          rewritten: true,
        };
      }
      return {
        tool: 'case.update',
        args: batchArgs,
        rewritten: true,
      };
    }
    if (tool === 'case_library.batch_archive_exec_cases') {
      return {
        tool: tool,
        args: payload,
        rewritten: false,
      };
    }
    return { tool: tool, args: payload, rewritten: false };
  }

  function isAssistantArchiveControlArgs(args) {
    var payload = args && typeof args === 'object' ? args : {};
    var inspectText = [
      payload.controlId,
      payload.controlText,
      payload.text,
      payload.label,
      payload.name,
      payload.query,
    ].join(' ');
    return containsAny(inspectText, ['归档', 'archive']);
  }

  function buildAssistantFriendlyTaskLabel(tool, args) {
    var payload = args && typeof args === 'object' ? args : {};
    var normalizedField = normalizeCaseUpdateFieldName(payload.field || payload.key || payload.column || payload.name || '');
    var value = payload.value !== undefined && payload.value !== null ? String(payload.value).trim() : '';
    var versionText = payload.execVersionName !== undefined && payload.execVersionName !== null && String(payload.execVersionName).trim()
      ? String(payload.execVersionName).trim()
      : (payload.versionName !== undefined && payload.versionName !== null && String(payload.versionName).trim()
        ? String(payload.versionName).trim()
        : (payload.execVersionId !== undefined && payload.execVersionId !== null && String(payload.execVersionId).trim()
          ? ('版本 ' + String(payload.execVersionId).trim())
          : ''));
    if (tool === 'cases.list_current') {
      if (payload.query !== undefined && payload.query !== null && String(payload.query).trim()) {
        if (String(payload.detailLevel || '').trim().toLowerCase() === 'full') {
          return '读取用例详情：' + trimAssistantTaskLabelText(String(payload.query).trim(), 24);
        }
        return '定位当前用例：' + trimAssistantTaskLabelText(String(payload.query).trim(), 24);
      }
      return payload.countOnly === true || payload.count === true
        ? '统计当前用例数量'
        : '读取当前用例列表';
    }
    if (tool === 'case_library.search_exec_candidates') {
      return payload.query !== undefined && payload.query !== null && String(payload.query).trim()
        ? ('搜索要转执行的用例：' + trimAssistantTaskLabelText(String(payload.query).trim(), 24))
        : '搜索要转执行的用例';
    }
    if (tool === 'case_library.transfer_to_exec') {
      return versionText ? ('把选中的用例转到执行版本：' + trimAssistantTaskLabelText(versionText, 18)) : '把选中的用例转到执行版本';
    }
    if (tool === 'case_library.batch_update_exec_results') {
      return value ? ('把全部执行结果改为' + trimAssistantTaskLabelText(value, 12)) : '批量修改执行结果';
    }
    if (tool === 'case_library.batch_archive_exec_cases') {
      return '归档当前执行用例';
    }
    if (tool === 'case.update') {
      var context = payload.context === undefined || payload.context === null ? '' : String(payload.context).trim().toLowerCase();
      var scope = payload.scope === undefined || payload.scope === null ? '' : String(payload.scope).trim().toLowerCase();
      if (scope === 'all' && normalizedField === 'actual') {
        return value ? ('把全部执行结果改为' + trimAssistantTaskLabelText(value, 12)) : '批量修改执行结果';
      }
      if (scope === 'all' && normalizedField === 'remark') {
        return '批量修改执行备注';
      }
      if (scope === 'all' && normalizedField) return '批量修改用例' + buildCaseUpdateFieldLabel(normalizedField);
      if (context === 'tempexec' && normalizedField === 'actual') {
        return value ? ('修改用例执行结果为' + trimAssistantTaskLabelText(value, 12)) : '修改用例执行结果';
      }
      if (normalizedField) return '修改用例' + buildCaseUpdateFieldLabel(normalizedField);
      return '修改用例';
    }
    if (tool === 'ui.click_control' && isAssistantArchiveControlArgs(payload)) {
      return '归档当前执行用例';
    }
    return '';
  }

  function buildAssistantUnknownToolTaskLabel(tool, args) {
    var rawTool = tool === undefined || tool === null ? '' : String(tool).trim();
    var normalizedTool = normalizeMcpToolName(rawTool);
    var payload = args && typeof args === 'object' ? args : {};
    var query = payload.query !== undefined && payload.query !== null ? String(payload.query).trim() : '';
    var value = payload.value !== undefined && payload.value !== null ? String(payload.value).trim() : '';
    var toolText = normalizedTool || rawTool;
    if (!toolText) return '执行任务';
    if (toolText === 'page.current_info') return '获取当前页面信息';
    if (toolText === 'page.get_data') return '读取页面数据';
    if (toolText === 'nav.switch_tab') return '切换页面';
    if (toolText === 'web.search') return query ? ('联网搜索：' + trimAssistantTaskLabelText(query, 24)) : '联网搜索';
    if (toolText === 'settings.patch') return '修改设置';
    if (toolText === 'settings.describe') return '查看设置说明';
    if (toolText === 'case.delete') return '删除用例';
    if (toolText === 'tempexec.remove_files') return query ? ('移出执行用例：' + trimAssistantTaskLabelText(query, 24)) : '移出执行用例';
    if (toolText === 'tempexec.reuse_update') {
      if (payload.field === 'delete') return '删除全部复用子项';
      if (String(payload.field || '').trim().toLowerCase() === 'actual' && value) return '修改复用子项执行结果为' + trimAssistantTaskLabelText(value, 12);
      return '修改复用子项';
    }
    if (toolText === 'cases.list_current') {
      if (query) return '定位当前用例：' + trimAssistantTaskLabelText(query, 24);
      return '读取当前用例列表';
    }
    if (containsAny(toolText, ['archive'])) return '归档内容';
    if (containsAny(toolText, ['delete', 'remove'])) return '删除内容';
    if (containsAny(toolText, ['update', 'patch', 'edit'])) return value ? ('更新内容为' + trimAssistantTaskLabelText(value, 12)) : '更新内容';
    if (containsAny(toolText, ['list', 'query', 'get', 'read', 'search'])) {
      return query ? ('查询内容：' + trimAssistantTaskLabelText(query, 24)) : '查询内容';
    }
    if (containsAny(toolText, ['create', 'add', 'new'])) return '新建内容';
    return '执行任务';
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
      { name: 'cases.list_current', mode: 'read', description: '读取当前页面或项目用例列表；在 tempexec 可返回当前执行文件、caseFile.hasReuseCases、caseFile.reusePresetNames、行级 isReuseCase、聚合后的 executionResult、reuseDetails 子项明细，用于先判断是否为复用型用例及现状是否已符合要求' },
      { name: 'case_library.query_cases', mode: 'read', description: '跨页面查询用例库内容，并在大数据量时自动拆分子任务并发检索' },
      { name: 'case_library.search_exec_candidates', mode: 'read', description: '按项目/名称搜索可转到当前执行的用例文件候选' },
      { name: 'case_library.transfer_to_exec', mode: 'write', description: '将指定用例文件转到当前执行，并切换到执行页' },
      { name: 'tempexec.remove_files', mode: 'write', description: '按名称或关键词移出当前执行中的用例文件' },
      { name: 'tempexec.reuse_update', mode: 'write', description: '管理当前执行中复用型用例的预设子项，或按子项名 / applyAll 修改子项执行结果 / 备注 / 名称 / 删除子项；复用型用例状态写入优先走这里' },
      { name: 'case_library.batch_update_exec_results', mode: 'write', description: '批量修改当前执行用例的普通执行结果字段；若目标是复用型用例，应优先改子项状态而不是只改顶层结果字段' },
      { name: 'case_library.batch_archive_exec_cases', mode: 'write', description: '归档当前执行中的用例' },
      { name: 'missing_library.list_current', mode: 'read', description: '读取当前项目的漏测/易漏用例库，可跨页面查询' },
      { name: 'cross_page.match_missing_cases', mode: 'read', description: '将当前页面用例与当前项目漏测用例库做跨页面匹配' },
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
      { name: 'case.update', mode: 'write', description: '修改当前可见用例字段（含执行结果/备注/优先级/标题/步骤等）；在 tempexec 支持用 scope=all 批量修改普通用例执行结果或备注，复用型用例执行结果应优先改子项状态' },
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

  function normalizeAssistantCapability(capability, fallbackIndex) {
    var item = capability && typeof capability === 'object' ? capability : {};
    var id = normalizeMcpToolName(item.id || item.name || item.capability || '');
    var index = Number(fallbackIndex);
    if (!Number.isFinite(index) || index < 0) index = 0;
    if (!id) return null;
    return {
      id: id,
      sourceType: item.sourceType !== undefined && item.sourceType !== null ? String(item.sourceType).trim().toLowerCase() : 'mcp',
      backedBy: item.backedBy !== undefined && item.backedBy !== null ? String(item.backedBy).trim() : ('assistantMcpApi.callTool(' + id + ')'),
      mode: item.mode !== undefined && item.mode !== null ? String(item.mode).trim().toLowerCase() : getMcpToolMode(id),
      description: item.description !== undefined && item.description !== null ? String(item.description).trim() : '',
      argsHint: Array.isArray(item.argsHint) ? item.argsHint.map(function(entry) {
        var row = entry && typeof entry === 'object' ? entry : {};
        return {
          name: row.name !== undefined && row.name !== null ? String(row.name).trim() : '',
          description: row.description !== undefined && row.description !== null ? String(row.description).trim() : '',
        };
      }).filter(function(entry) { return !!entry.name; }) : [],
      approvalPolicy: item.approvalPolicy !== undefined && item.approvalPolicy !== null ? String(item.approvalPolicy).trim().toLowerCase() : 'none',
      available: item.available !== false,
      index: index + 1,
    };
  }

  function getAvailableCapabilities() {
    var apis = getApis();
    var list = [];
    var tools = [];
    if (apis.assistantCapabilityApi && typeof apis.assistantCapabilityApi.listCapabilities === 'function') {
      try {
        tools = apis.assistantCapabilityApi.listCapabilities() || [];
      } catch (err) {
        tools = [];
      }
    }
    if (!Array.isArray(tools) || !tools.length) {
      tools = getAvailableMcpTools().map(function(tool) {
        return {
          id: tool && tool.name ? String(tool.name) : '',
          sourceType: tool && tool.name && String(tool.name).indexOf('assistant.') === 0 ? 'render' : 'mcp',
          backedBy: tool && tool.name ? ('assistantMcpApi.callTool(' + String(tool.name) + ')') : '',
          mode: tool && tool.mode ? String(tool.mode) : '',
          description: tool && tool.description ? String(tool.description) : '',
          argsHint: [],
          approvalPolicy: tool && tool.mode === 'write' ? 'tool_managed' : 'none',
          available: true,
        };
      });
    }
    list = tools.map(function(item, index) {
      return normalizeAssistantCapability(item, index);
    }).filter(function(item) { return !!item; });
    list.sort(function(left, right) {
      return Number(left.index || 0) - Number(right.index || 0);
    });
    return list;
  }

  function getAssistantCapabilityById(capabilityId) {
    var id = normalizeMcpToolName(capabilityId);
    var list = getAvailableCapabilities();
    var i = 0;
    if (!id) return null;
    for (i = 0; i < list.length; i += 1) {
      if (normalizeMcpToolName(list[i] && list[i].id) === id) return list[i];
    }
    return null;
  }

  function buildAssistantCapabilityArgsHintText(argsHint) {
    var list = Array.isArray(argsHint) ? argsHint : [];
    if (!list.length) return '无';
    return list.map(function(entry) {
      var row = entry && typeof entry === 'object' ? entry : {};
      var name = row.name ? String(row.name) : '';
      var description = row.description ? String(row.description) : '';
      return name + (description ? ('：' + description) : '');
    }).join('；');
  }

  function buildAssistantCapabilityCatalogLines() {
    return getAvailableCapabilities().map(function(capability) {
      var item = capability && typeof capability === 'object' ? capability : {};
      return '- ' + (item.id || '')
        + ' | source=' + (item.sourceType || 'mcp')
        + ' | mode=' + (item.mode || 'read')
        + ' | approval=' + (item.approvalPolicy || 'none')
        + ' | backedBy=' + (item.backedBy || '')
        + ' | args=' + buildAssistantCapabilityArgsHintText(item.argsHint)
        + (item.description ? (' | 说明=' + item.description) : '');
    });
  }

  function buildAssistantPlatformContextFallbackMarkdown() {
    return [
      '# 测试助手平台固定上下文',
      '',
      '## 平台定位',
      '- 这是一个围绕测试需求、用例生成、用例库、执行、归档和设置管理的测试助手平台。',
      '- AI 助手应基于平台提供的结构化上下文、自身模型判断和 capability 目录完成理解、拆任务、执行和总结。',
      '',
      '## 页面职责',
      '- auto：一键执行主流程，通常用于从导入到生成的串联操作。',
      '- clean：功能流程整理与清洗。',
      '- casesgen：用例生成。',
      '- assign：功能指派。',
      '- models：模型管理。',
      '- tempexec：用例执行，处理当前执行文件、执行结果、复用子项、备注、XMind 等。',
      '- case-library：用例库，处理当前编辑用例、历史详情、跨项目查询。',
      '- case-archive：用例归档。',
      '- exec-overview：执行总览。',
      '- settings：通用设置。',
      '- project-admin / user-admin / ops-log：管理后台页面。',
      '',
      '## 上下文约定',
      '- 每轮都会同时提供固定上下文和动态上下文。',
      '- `platformContextMarkdown`：本固定文档，描述平台定位、页面职责和上下文契约。',
      '- `currentPage`：当前页面标识和当前页面原始结构化数据。',
      '- `runtimeContext`：当前页面摘要、当前页可用重点能力、可见页签等动态环境信息。',
      '- `capabilities`：当前全部可用 capability 目录，AI 只能从这里选能力。',
      '',
      '## 动态字段含义',
      '- `currentPage.tab` / `currentPage.tabLabel`：当前页签标识和展示名称。',
      '- `currentPage.pageData`：当前页面结构化数据快照。',
      '- `currentPage.pageData.currentCaseContext`：当前页核心用例上下文，常见于用例库编辑页和执行页。',
      '- `currentPage.pageData.currentCaseContext.total` / `totalAll`：当前可见条数 / 当前总条数。',
      '- `currentPage.pageData.currentCaseContext.hasReuseCases` / `reusePresetNames`：当前范围是否含复用用例及其预设子项名。',
      '- `runtimeContext.currentPage.knownFacts`：当前页面关键事实的摘要，优先可直接使用。',
      '- `runtimeContext.currentPage.currentPageCapabilities`：当前页面最常用的重点能力摘要。',
      '',
      '## 使用规则',
      '- 对于“当前在哪个页面、当前页面有什么数据、当前页能做什么”这类问题，优先使用已提供的 `currentPage` 和 `runtimeContext`，不要重复向用户确认。',
      '- 只有在相关动态字段缺失、为空、明显过期，或与用户目标冲突时，才进行澄清或补充读取。',
      '- 写操作是否执行，仍以后续 capability 执行结果和运行时确认门禁为准。',
    ].join('\n');
  }

  async function loadAssistantPlatformContextMarkdown() {
    if (assistantPlatformContextMarkdownCache) return assistantPlatformContextMarkdownCache;
    if (assistantPlatformContextMarkdownPromise) return assistantPlatformContextMarkdownPromise;
    assistantPlatformContextMarkdownPromise = fetch(assistantPlatformContextMarkdownUrl, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'default',
    }).then(function(res) {
      if (!res || res.ok !== true) return '';
      return res.text();
    }).catch(function() {
      return '';
    }).then(function(text) {
      assistantPlatformContextMarkdownCache = String(text || '').trim() || buildAssistantPlatformContextFallbackMarkdown();
      assistantPlatformContextMarkdownPromise = null;
      return assistantPlatformContextMarkdownCache;
    }).catch(function() {
      assistantPlatformContextMarkdownCache = buildAssistantPlatformContextFallbackMarkdown();
      assistantPlatformContextMarkdownPromise = null;
      return assistantPlatformContextMarkdownCache;
    });
    return assistantPlatformContextMarkdownPromise;
  }

  function buildAssistantRuntimeContextCapabilityIds(tabId) {
    var normalizedTab = tabId === undefined || tabId === null ? '' : String(tabId).trim().toLowerCase();
    var ids = ['page.current_info', 'page.get_data', 'ui.list_controls'];
    if (normalizedTab === 'settings') ids = ids.concat(['settings.describe', 'settings.patch']);
    if (normalizedTab === 'case-library') ids = ids.concat(['cases.list_current', 'case_library.query_cases', 'missing_library.list_current', 'cross_page.match_missing_cases']);
    if (normalizedTab === 'tempexec') ids = ids.concat(['cases.list_current', 'case.update', 'tempexec.reuse_update', 'tempexec.remove_files', 'tempexec.switch_file', 'tempexec.export_xmind']);
    return ids;
  }

  function buildAssistantRuntimeContextCurrentPageCapabilities(tabId, capabilities) {
    var ids = buildAssistantRuntimeContextCapabilityIds(tabId);
    var list = Array.isArray(capabilities) ? capabilities : [];
    return list.filter(function(item) {
      var id = normalizeMcpToolName(item && item.id ? item.id : '');
      return !!id && ids.indexOf(id) !== -1 && item.available !== false;
    }).map(function(item) {
      var row = item && typeof item === 'object' ? item : {};
      return {
        id: row.id ? String(row.id) : '',
        mode: row.mode ? String(row.mode) : '',
        approvalPolicy: row.approvalPolicy ? String(row.approvalPolicy) : '',
        description: row.description ? String(row.description) : '',
      };
    });
  }

  function buildAssistantRuntimeContextKnownFacts(currentPage) {
    var page = currentPage && typeof currentPage === 'object' ? currentPage : {};
    var pageData = page.pageData && typeof page.pageData === 'object' ? page.pageData : {};
    var caseContext = pageData.currentCaseContext && typeof pageData.currentCaseContext === 'object' ? pageData.currentCaseContext : null;
    var facts = [];
    var total = 0;
    var totalAll = 0;
    if (page.tab) {
      facts.push('当前页签：' + String(page.tab) + (page.tabLabel ? ('（' + String(page.tabLabel) + '）') : ''));
    }
    if (page.pageFileName) {
      facts.push('当前页面文件：' + String(page.pageFileName));
    }
    if (pageData.requirementLabel) {
      facts.push('当前需求：' + String(pageData.requirementLabel));
    }
    if (caseContext && caseContext.fileName) {
      total = Number(caseContext.total);
      totalAll = Number(caseContext.totalAll);
      if (!Number.isFinite(total) || total < 0) total = 0;
      if (!Number.isFinite(totalAll) || totalAll < 0) totalAll = total;
      facts.push('当前用例上下文：' + String(caseContext.fileName) + '（可见 ' + total + ' 条，总计 ' + totalAll + ' 条）');
      if (caseContext.hasReuseCases === true) {
        facts.push('当前用例上下文包含复用用例');
      }
      if (Array.isArray(caseContext.reusePresetNames) && caseContext.reusePresetNames.length) {
        facts.push('当前复用预设子项：' + caseContext.reusePresetNames.join('、'));
      }
    }
    if (pageData.tab === 'tempexec' && pageData.tempExecFileCount !== undefined && pageData.tempExecFileCount !== null) {
      facts.push('当前执行文件数：' + String(pageData.tempExecFileCount));
    }
    if (pageData.caseLibraryHistoryDetail && pageData.caseLibraryHistoryDetail.hasContext === true) {
      facts.push('当前页已提供用例库历史详情上下文');
    }
    if (pageData.missingCaseLibraryView && pageData.missingCaseLibraryView.hasContext === true) {
      facts.push('当前页已提供漏测用例视图上下文');
    }
    if (pageData.tempExecCaseLibraryDiffDetail && pageData.tempExecCaseLibraryDiffDetail.hasContext === true) {
      facts.push('当前页已提供执行与用例库差异上下文');
    }
    return facts;
  }

  function buildAssistantRuntimeContext(currentPage, capabilities) {
    var page = currentPage && typeof currentPage === 'object' ? currentPage : {};
    var apis = getApis();
    var tabs = [];
    if (apis.assistantApi && typeof apis.assistantApi.listTabs === 'function') {
      try {
        tabs = apis.assistantApi.listTabs() || [];
      } catch (err) {
        tabs = [];
      }
    }
    return {
      generatedAt: new Date().toISOString(),
      availableTabs: Array.isArray(tabs) ? tabs.map(function(item) {
        var row = item && typeof item === 'object' ? item : {};
        return {
          tab: row.tab ? String(row.tab) : '',
          label: row.label ? String(row.label) : '',
        };
      }).filter(function(item) { return !!item.tab; }) : [],
      currentPage: {
        tab: page.tab ? String(page.tab) : '',
        tabLabel: page.tabLabel ? String(page.tabLabel) : '',
        pageFileName: page.pageFileName ? String(page.pageFileName) : '',
        knownFacts: buildAssistantRuntimeContextKnownFacts(page),
        currentPageCapabilities: buildAssistantRuntimeContextCurrentPageCapabilities(page.tab || '', capabilities),
      },
    };
  }

  function buildAssistantProtocolBlockedCallLines(calls) {
    var list = Array.isArray(calls) ? calls : [];
    return list.map(function(call, index) {
      var row = call && typeof call === 'object' ? call : {};
      var capability = normalizeMcpToolName(row.capability || row.tool || row.name || '');
      var args = row.args && typeof row.args === 'object' ? row.args : {};
      return '- ' + (capability || ('call-' + (index + 1))) + ' ' + formatJsonCompact(args);
    }).filter(function(line) { return !!line; });
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

  function normalizeCaseDetailLookupText(value) {
    return String(value === undefined || value === null ? '' : value).trim().toLowerCase().replace(/\s+/g, '');
  }

  function toPositiveInt(value, fallback) {
    var n = Number(value);
    var defaultValue = Number(fallback);
    if (!Number.isFinite(n) || n <= 0) {
      if (!Number.isFinite(defaultValue) || defaultValue <= 0) return 0;
      return Math.floor(defaultValue);
    }
    return Math.floor(n);
  }

  function normalizeTempExecRemoveSelectionText(value) {
    return String(value === undefined || value === null ? '' : value)
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[“”"'`]/g, '');
  }

  function formatTempExecRemoveSuccessText(result) {
    var data = result && typeof result === 'object' ? result : {};
    var labels = Array.isArray(data.fileLabels) && data.fileLabels.length ? data.fileLabels : (Array.isArray(data.fileNames) ? data.fileNames : []);
    var count = toPositiveInt(data.count || labels.length, 0);
    var summary = '';
    if (labels.length > 0) {
      summary = labels.slice(0, 3).map(function(item) {
        return item === undefined || item === null ? '' : String(item).trim();
      }).filter(Boolean).join('、');
      if (labels.length > 3) summary += ' 等 ' + labels.length + ' 份';
    }
    if (count > 1) {
      return '已移出执行用例：共 ' + count + ' 份' + (summary ? ('，包括 ' + summary) : '') + '。';
    }
    return '已移出执行用例：' + (summary || '目标用例') + '。';
  }

  function extractCaseDetailIdCandidates(text) {
    var raw = String(text || '');
    var matches = raw.match(/(?:^|D)(d{1,6})(?:D|$)/g) || [];
    return matches.map(function(part) {
      var found = String(part || '').match(/d{1,6}/);
      return found && found[0] ? String(found[0]) : '';
    }).filter(Boolean);
  }

  function matchCaseItemsFromReferenceText(items, text) {
    var list = Array.isArray(items) ? items : [];
    var raw = String(text || '').trim();
    var normalized = normalizeCaseDetailLookupText(raw);
    var ids = extractCaseDetailIdCandidates(raw);
    return list.filter(function(item) {
      var row = item && typeof item === 'object' ? item : {};
      var itemId = row.id === undefined || row.id === null ? '' : String(row.id).trim();
      var title = row.title === undefined || row.title === null ? '' : String(row.title).trim();
      var normalizedTitle = normalizeCaseDetailLookupText(title);
      if (itemId && ids.indexOf(itemId) !== -1) return true;
      if (normalized && normalizedTitle && (normalized.indexOf(normalizedTitle) !== -1 || normalizedTitle.indexOf(normalized) !== -1)) return true;
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
    if (isExplicitExecTransferIntent(raw)) return false;
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
    if (!raw || !items.length) return false;
    if (extractCaseDetailIdCandidates(raw).length) return true;
    if (containsAny(raw, ['该用例', '当前用例', '这个用例', '本用例', '这条', '这一条', '这一个用例'])) return true;
    return matchCaseItemsFromReferenceText(items, raw).length === 1;
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
    var total = Number(data.total);
    var query = String(userText || '').trim();
    if (!Number.isFinite(total) || total <= 1) return '没有定位到需要完整展示的目标用例。';
    return '当前结果里匹配到多条用例，请补充用例 ID 或更完整的标题，我再为你完整展开。' + (query ? ('（当前问题：' + query + '）') : '');
  }

  function assistantReadFirstArgString(args, keys) {
    var payload = args && typeof args === 'object' ? args : {};
    var list = Array.isArray(keys) ? keys : [];
    var i = 0;
    for (i = 0; i < list.length; i += 1) {
      var key = String(list[i] || '').trim();
      if (!key) continue;
      if (payload[key] === undefined || payload[key] === null) continue;
      var text = String(payload[key]).trim();
      if (text) return text;
    }
    return '';
  }

  function normalizeTempExecReuseFieldName(rawField) {
    var text = rawField === undefined || rawField === null ? '' : String(rawField).trim().toLowerCase();
    text = text.replace(/\s+/g, '');
    if (!text) return '';
    if (text === 'actual' || text === 'result' || text === 'status' || text === '执行结果' || text === '状态' || text === '子项执行结果' || text === '子项状态') return 'actual';
    if (text === 'remark' || text === 'remarks' || text === 'note' || text === 'comment' || text === '备注' || text === '子项备注' || text === '说明') return 'remark';
    if (text === 'text' || text === 'name' || text === 'title' || text === '子项' || text === '子项名称' || text === '子项标题' || text === '测试项' || text === '测试项名称') return 'text';
    return '';
  }

  function normalizeTempExecReuseModeHint(rawMode) {
    var text = rawMode === undefined || rawMode === null ? '' : String(rawMode).trim().toLowerCase();
    text = text.replace(/\s+/g, '_').replace(/-/g, '_');
    if (!text) return '';
    if (text === 'preset_set' || text === 'set_presets' || text === 'preset_replace' || text === 'replace_presets' || text === 'set_preset_items') return 'preset_set';
    if (text === 'preset_add' || text === 'add_presets' || text === 'append_presets' || text === 'add_preset_items') return 'preset_add';
    if (text === 'preset_rename' || text === 'rename_preset' || text === 'rename_presets' || text === 'rename_preset_item' || text === 'rename_preset_items' || text === 'update_preset_name' || text === 'modify_preset_name' || text === 'edit_preset_name') return 'preset_rename';
    if (text === 'detail_delete' || text === 'delete_detail' || text === 'detail_remove' || text === 'remove_detail' || text === 'delete_sub_item' || text === 'delete_sub_items' || text === 'remove_sub_item' || text === 'remove_sub_items' || text === 'delete' || text === 'remove' || text === 'delete_all' || text === 'remove_all' || text === 'batch_delete' || text === 'batch_remove' || text === 'delete_reuse_sub_items' || text === 'remove_reuse_sub_items') return 'detail_delete';
    if (text === 'detail_update' || text === 'update_detail' || text === 'detail_set' || text === 'update_sub_item' || text === 'update_sub_items' || text === 'modify_sub_item' || text === 'modify_sub_items' || text === 'edit_sub_item' || text === 'edit_sub_items' || text === 'update' || text === 'modify' || text === 'edit' || text === 'set' || text === 'replace') return 'detail_update';
    return text;
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
    var i = 0;
    var j = 0;
    for (i = 0; i < map.length; i += 1) {
      var item = map[i];
      for (j = 0; j < item.keys.length; j += 1) {
        var key = item.keys[j];
        if (String(text).toLowerCase().indexOf(String(key).toLowerCase()) !== -1) return item.field;
      }
    }
    return '';
  }

  function extractCaseUpdateTargetIndex(raw) {
    var text = String(raw || '');
    var m = text.match(/第\s*(\d+)\s*条/);
    var chineseMatch = null;
    var n = 0;
    if (!m) {
      chineseMatch = text.match(/第\s*([一二两三四五六七八九十]+)\s*条/);
      if (!chineseMatch || !chineseMatch[1]) return 0;
      n = parseSimpleChinesePositiveInt(chineseMatch[1]);
    } else {
      n = Number(m[1]);
    }
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.floor(n);
  }

  function extractCaseUpdateValue(raw, field) {
    var text = String(raw || '').trim();
    var normalizedField = normalizeCaseUpdateFieldName(field);
    var pm = null;
    var am = null;
    var connector = null;
    var appendConnector = null;
    var fieldAliases = [];
    var escapedAliases = [];
    var aliasGroup = '';
    var fieldAnchored = null;
    var compactActual = '';
    var quoted = null;
    var i = 0;
    if (!text || !normalizedField) return '';
    if (normalizedField === 'priority') {
      pm = text.match(/优先级\s*(?:改成|修改为|改为|设为|设成|设置为|更新为|更新成|调成|调为|调整为|调整成|变为|变成|改到|切到|为|是)\s*([Pp]\s*\d{1,2})/i);
      if (!pm) pm = text.match(/\b([Pp]\s*\d{1,2})\b/i);
      if (pm && pm[1]) {
        var pn = String(pm[1]).toUpperCase().replace(/[^P0-9]/g, '');
        if (/^P[0-9]{1,2}$/.test(pn)) return pn;
      }
    }
    if (normalizedField === 'actual') {
      am = text.match(/(?:执行结果|状态)\s*(?:改成|修改为|改为|改回|设为|设成|设置为|更新为|更新成|变回|变为|变成|切到|调成|调为|调回|调整为|调整成|为|是)\s*(未执行|通过|失败|阻塞|不适用|变更重跑|有改动|pending|pass(?:ed)?|fail(?:ed)?|blocked?|na|n\/a|skip(?:ped)?)/i);
      if (!am) am = text.match(/(?:变回|变成|变为|设为|设成|改为|改成|改回|调整为|调整成|更新为|更新成|切到|调回|置为|置成|置)\s*(未执行|通过|失败|阻塞|不适用|变更重跑|有改动|pending|pass(?:ed)?|fail(?:ed)?|blocked?|na|n\/a|skip(?:ped)?)(?:状态|结果)?/i);
      if (!am) am = text.match(/(?:全部|所有|全都|批量|统一)(?:的执行结果|执行结果|结果|状态)?[^\n。；;，,]{0,12}?(?:置为|置成|置|改为|改成|改回|设为|设成|设置为|更新为|更新成|变回|变为|变成|切到|调成|调为|调回|调整为|调整成)\s*(未执行|通过|失败|阻塞|不适用|变更重跑|有改动|pending|pass(?:ed)?|fail(?:ed)?|blocked?|na|n\/a|skip(?:ped)?)/i);
      if (!am) am = text.match(/\b(未执行|通过|失败|阻塞|不适用|变更重跑|有改动|pending|pass(?:ed)?|fail(?:ed)?|blocked?|na|n\/a|skip(?:ped)?)\b/i);
      if (am && am[1]) {
        var actualValue = normalizeCaseActualValueToken(am[1]);
        if (actualValue) return actualValue;
      }
    }
    connector = text.match(/(?:改成|修改为|改为|改回|设为|设成|设置为|更新为|更新成|改到|调成|调为|调回|调整为|调整成|变为|变成|切到|为|是)\s*([^\n。；;，,]+)$/);
    if (connector && connector[1]) {
      var candidate = stripWrappedQuotes(connector[1]);
      if (normalizedField === 'priority') {
        var p = candidate.toUpperCase().replace(/[^P0-9]/g, '');
        if (/^P[0-9]{1,2}$/.test(p)) return p;
      } else if (candidate) {
        return candidate;
      }
    }
    appendConnector = text.match(/(?:拼接上|拼接成|拼接为|拼接|追加上|追加成|追加为|追加|后缀加上|后缀加|后面加上|后面加|前缀加上|前缀加|前面加上|前面加|开头加上|开头加|末尾加上|末尾加|结尾加上|结尾加)\s*([^\n。；;，,]+)$/);
    if (appendConnector && appendConnector[1]) {
      var appendValue = stripWrappedQuotes(appendConnector[1]);
      if (appendValue) return appendValue;
    }
    fieldAliases = getCaseUpdateFieldAliases(normalizedField);
    if (fieldAliases.length) {
      for (i = 0; i < fieldAliases.length; i += 1) {
        escapedAliases.push(escapeRegexToken(fieldAliases[i]));
      }
      aliasGroup = escapedAliases.join('|');
      if (aliasGroup) {
        fieldAnchored = text.match(new RegExp(
          '(?:^|\\s|，|,|。|；|;|并且|而且|然后|再|同时|另外|顺便)(?:把|将)?\\s*(?:' + aliasGroup + ')(?:这一栏|这栏|字段|栏位|列|项|上|里|中)?\\s*(?:[:：]|[，,]|是|为|写成|写为|写|填成|填为|填|加上|加|追加|补充|改成|改为|设为|设成|更新为|更新成)?\\s*([^\\n。；;]+)$',
          'i'
        ));
        if (fieldAnchored && fieldAnchored[1]) {
          var anchoredValue = stripWrappedQuotes(fieldAnchored[1]);
          anchoredValue = anchoredValue.replace(/^(?:是|为|写成|写为|写|填成|填为|填|加上|加|追加|补充|改成|改为|改回|设为|设成|更新为|更新成|调回)\s*/i, '').trim();
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
      compactActual = normalizeCaseActualValueToken(text);
      if (compactActual) return compactActual;
    }
    quoted = text.match(/[“"']([^“”"']+)[”"']/);
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

  function containsCaseUpdateActionVerb(raw) {
    var text = String(raw || '').trim();
    if (!text) return false;
    return containsAny(text, [
      '改成', '修改为', '改为', '改回', '设为', '设成', '设置为', '更新为', '更新成',
      '修改', '编辑', '调成', '调为', '调回', '调整为', '调整成', '变为', '变成', '变回',
      '改到', '切到', '切回', '恢复为', '恢复成', '恢复到',
      '拼接', '追加', '后缀', '前缀', '后面加', '前面加', '开头加', '末尾加', '结尾加',
      '清空', '清除', '删除', '移除', '去掉', '置空'
    ]);
  }

  function isLikelyCaseUpdateIntent(raw) {
    var text = String(raw || '').trim();
    var field = '';
    var hasCaseContextWord = false;
    var hasRecognizableValue = false;
    var index = 0;
    var scope = '';
    var apis = null;
    var tab = '';
    if (!text) return false;
    if (!containsCaseUpdateActionVerb(text)) return false;
    if (containsAny(text, ['怎么改', '如何改', '怎么修改', '如何修改', '修改步骤', '修改方法', '编辑方法', '怎么编辑', '如何编辑'])) return false;
    field = detectCaseUpdateFieldFromText(text);
    hasCaseContextWord = containsAny(text, ['用例', '该用例', '当前用例', '这条', '当前行', '本条']);
    hasRecognizableValue = /\b[Pp]\s*\d{1,2}\b/.test(text)
      || /(未执行|通过|失败|阻塞|不适用|变更重跑|有改动|pending|pass(?:ed)?|fail(?:ed)?|blocked?|na|n\/a|skip(?:ped)?)/i.test(text);
    index = extractCaseUpdateTargetIndex(text);
    scope = detectCaseUpdateScopeFromText(text);
    if (!field && !hasRecognizableValue && index <= 0 && !scope) return false;
    if (hasCaseContextWord) return true;
    apis = getApis();
    if (apis.assistantApi && typeof apis.assistantApi.getPageData === 'function') {
      var pageData = apis.assistantApi.getPageData('');
      tab = pageData && pageData.tab ? String(pageData.tab) : '';
    }
    return tab === 'case-library' || tab === 'tempexec';
  }

  function parseCaseUpdateCommand(raw) {
    var text = String(raw || '').trim();
    var field = '';
    var hasCaseContextWord = false;
    var clearIntent = false;
    var value = '';
    var index = 0;
    var operation = '';
    var scope = '';
    if (!text) return null;
    if (!containsCaseUpdateActionVerb(text)) return null;
    field = detectCaseUpdateFieldFromText(text);
    if (!field) return null;
    hasCaseContextWord = containsAny(text, ['用例', '该用例', '当前用例', '这条', '当前行', '本条']);
    if (!hasCaseContextWord) {
      var apis = getApis();
      var tab = '';
      if (apis.assistantApi && typeof apis.assistantApi.getPageData === 'function') {
        var pageData = apis.assistantApi.getPageData('');
        tab = pageData && pageData.tab ? String(pageData.tab) : '';
      }
      if (tab !== 'case-library' && tab !== 'tempexec') return null;
    }
    clearIntent = detectCaseUpdateClearIntent(text, field) && isCaseUpdateClearableField(field);
    value = extractCaseUpdateValue(text, field);
    if (!value && !clearIntent) return null;
    index = extractCaseUpdateTargetIndex(text);
    operation = detectCaseUpdateOperationFromText(text);
    scope = detectCaseUpdateScopeFromText(text);
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

  function detectImplicitActualBulkUpdate(raw) {
    var text = String(raw || '').trim();
    var actualValue = '';
    if (!text) return null;
    if (!containsAny(text, ['全部', '所有', '全都', '批量', '统一'])) return null;
    if (!containsAny(text, ['置', '改', '设', '更新', '调整', '变', '切'])) return null;
    actualValue = extractCaseUpdateValue(text, 'actual');
    if (!actualValue) return null;
    return {
      field: 'actual',
      value: actualValue,
      scope: 'all',
    };
  }

  function inferCaseUpdateArgsFromText(baseArgs, rawText) {
    var args = baseArgs && typeof baseArgs === 'object' ? Object.assign({}, baseArgs) : {};
    var raw = String(rawText || '');
    var fieldRaw = '';
    var field = '';
    var implicitActual = null;
    var clearIntent = false;
    var valueRaw = args.value;
    var index = 0;
    var indexRaw = args.index;
    var hasIndex = 0;
    var scopeRaw = '';
    var contextRaw = '';
    var operationRaw = '';
    if (args.field !== undefined && args.field !== null) fieldRaw = String(args.field);
    if (!fieldRaw && args.key !== undefined && args.key !== null) fieldRaw = String(args.key);
    if (!fieldRaw && args.column !== undefined && args.column !== null) fieldRaw = String(args.column);
    if (!fieldRaw && args.name !== undefined && args.name !== null) fieldRaw = String(args.name);
    field = normalizeCaseUpdateFieldName(fieldRaw);
    if (!field) field = detectCaseUpdateFieldFromText(raw);
    if (!field) {
      implicitActual = detectImplicitActualBulkUpdate(raw);
      if (implicitActual && implicitActual.field) field = implicitActual.field;
    }
    if (field) args.field = field;
    clearIntent = field && detectCaseUpdateClearIntent(raw, field) && isCaseUpdateClearableField(field);
    if (!clearIntent && field && isCaseUpdateClearableField(field) && (args.clear === true || String(args.mode || '').toLowerCase() === 'clear')) {
      clearIntent = true;
    }
    if ((valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') && args.to !== undefined && args.to !== null) valueRaw = args.to;
    if ((valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') && args.text !== undefined && args.text !== null) valueRaw = args.text;
    if ((valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') && args.content !== undefined && args.content !== null) valueRaw = args.content;
    if ((valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') && args.newValue !== undefined && args.newValue !== null) valueRaw = args.newValue;
    if ((valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') && field) {
      valueRaw = extractCaseUpdateValue(raw, field);
    }
    if ((valueRaw === undefined || valueRaw === null || String(valueRaw).trim() === '') && implicitActual && implicitActual.value) {
      valueRaw = implicitActual.value;
    }
    if (valueRaw !== undefined && valueRaw !== null && String(valueRaw).trim() !== '') {
      args.value = String(valueRaw).trim();
    } else if (clearIntent) {
      args.value = '';
      args.clear = true;
    }
    index = extractCaseUpdateTargetIndex(raw);
    if ((indexRaw === undefined || indexRaw === null) && args.itemIndex !== undefined && args.itemIndex !== null) indexRaw = args.itemIndex;
    if ((indexRaw === undefined || indexRaw === null) && args.seq !== undefined && args.seq !== null) indexRaw = args.seq;
    hasIndex = Number(indexRaw);
    if ((!Number.isFinite(hasIndex) || hasIndex <= 0) && index > 0) {
      args.index = index;
    }
    if (args.scope !== undefined && args.scope !== null) scopeRaw = String(args.scope).trim().toLowerCase();
    if (!scopeRaw && args.target !== undefined && args.target !== null) scopeRaw = String(args.target).trim().toLowerCase();
    if (!scopeRaw && args.range !== undefined && args.range !== null) scopeRaw = String(args.range).trim().toLowerCase();
    if (!scopeRaw && (args.all === true || args.applyAll === true || args.batch === true)) scopeRaw = 'all';
    if (scopeRaw !== 'all' && scopeRaw !== 'single') {
      scopeRaw = detectCaseUpdateScopeFromText(raw) || '';
    }
    if (!scopeRaw && implicitActual && implicitActual.scope) scopeRaw = implicitActual.scope;
    if (Number.isFinite(hasIndex) && hasIndex > 0) scopeRaw = 'single';
    if (scopeRaw === 'all') {
      args.scope = 'all';
      if (Object.prototype.hasOwnProperty.call(args, 'index')) delete args.index;
    } else if (scopeRaw === 'single') {
      args.scope = 'single';
    }
    if (args.context !== undefined && args.context !== null) contextRaw = String(args.context).trim().toLowerCase();
    if (!contextRaw && args.pageContext !== undefined && args.pageContext !== null) contextRaw = String(args.pageContext).trim().toLowerCase();
    if (!contextRaw && args.tab !== undefined && args.tab !== null) {
      var tabContext = String(args.tab).trim().toLowerCase();
      if (tabContext === 'tempexec' || tabContext === 'case-library') contextRaw = tabContext;
    }
    if (!contextRaw) {
      if (scopeRaw === 'all' && (field === 'actual' || field === 'remark')) {
        contextRaw = 'tempexec';
      } else if (field === 'actual' && containsAny(raw, ['执行', '执行页', '执行用例', '执行列表'])) {
        contextRaw = 'tempexec';
      }
    }
    if (contextRaw === 'tempexec' || contextRaw === 'case-library') {
      args.context = contextRaw;
    }
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

  function extractTempExecReuseFileName(raw) {
    var text = String(raw || '').trim();
    var patterns = [];
    var i = 0;
    var matched = null;
    var candidate = '';
    if (!text) return '';
    patterns.push(/执行用例[【“"'`]?([^】”"'`\n]+?)[】”"'`]/);
    patterns.push(/([^\s，。,；;“”"'`]+用例)(?:里|中的|内的|的).*(?:复用子项|子项)/);
    for (i = 0; i < patterns.length; i += 1) {
      matched = text.match(patterns[i]);
      if (!matched || !matched[1]) continue;
      candidate = stripWrappedQuotes(matched[1]);
      if (!candidate) continue;
      if (/^第\s*\d+\s*条(?:用例)?$/i.test(candidate)) continue;
      if (containsAny(candidate, ['当前用例', '全部用例', '所有用例', '当前执行用例'])) continue;
      return candidate;
    }
    return '';
  }

  function extractTempExecReuseDetailName(raw) {
    var text = String(raw || '').trim();
    var patterns = [];
    var i = 0;
    var matched = null;
    var candidate = '';
    if (!text) return '';
    patterns.push(/(?:复用子项|子项)(?:名称|名字|名)?(?:为|是|叫)\s*[“"'`]?([^“”"'`，。,；;\n]+)[”"'`]?/i);
    patterns.push(/名为\s*[“"'`]?([^“”"'`，。,；;\n]+)[”"'`]?(?:的(?:复用子项|子项))/i);
    patterns.push(/[“"']([^“”"']+)[”"']\s*(?:复用子项|子项)/i);
    patterns.push(/(?:复用子项|子项)\s*([^\s，。,；;\n]+?)(?=(?:执行结果|状态)?\s*(?:改成|修改为|改为|改回|设为|设成|设置为|更新为|更新成|变回|变为|变成|切到|调成|调为|调回|调整为|调整成|为|是))/i);
    for (i = 0; i < patterns.length; i += 1) {
      matched = text.match(patterns[i]);
      if (!matched || !matched[1]) continue;
      candidate = stripWrappedQuotes(matched[1]);
      if (!candidate) continue;
      candidate = candidate.replace(/的(?:执行结果|状态|备注|名称|名字|标题).*$/i, '').trim();
      if (!candidate) continue;
      if (containsAny(candidate, ['全部', '所有', '当前'])) continue;
      return candidate;
    }
    return '';
  }

  function extractTempExecReuseDetailIndex(raw) {
    var text = String(raw || '');
    var matched = text.match(/第\s*(\d+)\s*个(?:复用)?子项/);
    var value = 0;
    if (!matched || !matched[1]) return 0;
    value = Number(matched[1]);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.floor(value);
  }

  function parseTempExecReuseUpdateCommand(raw, seedArgs) {
    var text = String(raw || '').trim();
    var source = seedArgs && typeof seedArgs === 'object' ? Object.assign({}, seedArgs) : {};
    var explicitMode = normalizeTempExecReuseModeHint(assistantReadFirstArgString(source, ['mode', 'action', 'type', 'intent', 'task', 'operationType', 'operateType', 'operate', 'op']));
    var explicitField = normalizeTempExecReuseFieldName(source.field || source.key || source.column || source.name || source.detailField || source.subField || '');
    var explicitDetailName = assistantReadFirstArgString(source, ['detailName', 'subItemName', 'childName', 'detailText', 'subItemText', 'childText']);
    var explicitDetailId = assistantReadFirstArgString(source, ['detailId', 'subItemId', 'childId']);
    var explicitFileName = assistantReadFirstArgString(source, ['fileName']);
    var explicitDetailIndex = toPositiveInt(source.detailIndex || source.subItemIndex || source.childIndex || source.detailSeq, 0);
    var reuseMentioned = containsAny(text, ['复用子项', '子项', '复用']);
    var args = {};
    var mode = '';
    var field = '';
    var value = '';
    var genericValue = '';
    var detailName = '';
    var detailIndex = 0;
    var caseIndex = 0;
    var fileName = '';
    if (!explicitMode && !explicitField && !explicitDetailName && !explicitDetailId && !explicitDetailIndex && !explicitFileName && !reuseMentioned) return null;
    args = Object.assign({}, source);
    mode = explicitMode;
    if (!mode) {
      if (containsAny(text, ['删除', '移除', '去掉']) && reuseMentioned) mode = 'detail_delete';
      else if (reuseMentioned) mode = 'detail_update';
    }
    field = explicitField;
    if (!field && reuseMentioned) {
      if (containsAny(text, ['执行结果', '状态'])) field = 'actual';
      else if (containsAny(text, ['改', '设', '置', '更新', '调整', '变', '切', '调'])
        && normalizeCaseActualValueToken(extractCaseUpdateValue(text, 'actual'))) field = 'actual';
      else if (containsAny(text, ['备注', '说明'])) field = 'remark';
      else if (containsAny(text, ['名称', '名字', '标题'])) field = 'text';
    }
    if (mode) args.mode = mode;
    if (field) args.field = field;
    detailName = explicitDetailName || extractTempExecReuseDetailName(text);
    detailIndex = explicitDetailIndex || extractTempExecReuseDetailIndex(text);
    caseIndex = toPositiveInt(args.index || args.itemIndex || args.seq || args.row, 0) || extractCaseUpdateTargetIndex(text);
    fileName = explicitFileName || extractTempExecReuseFileName(text);
    if (detailName && !assistantReadFirstArgString(args, ['detailName', 'subItemName', 'childName', 'detailText', 'subItemText', 'childText'])) {
      args.detailName = detailName;
    }
    if (detailIndex > 0 && !(toPositiveInt(args.detailIndex || args.subItemIndex || args.childIndex || args.detailSeq, 0) > 0)) {
      args.detailIndex = detailIndex;
    }
    if (caseIndex > 0 && !(toPositiveInt(args.index || args.itemIndex || args.seq || args.row, 0) > 0)) {
      args.index = caseIndex;
    }
    if (fileName && !assistantReadFirstArgString(args, ['fileName'])) {
      args.fileName = fileName;
    }
    if (!args.operation) {
      var op = normalizeCaseUpdateOperationFromArgs(args) || detectCaseUpdateOperationFromText(text);
      if (op) args.operation = op;
    }
    if (!args.scope && containsAny(text, ['全部', '所有', '全都', '统一']) && reuseMentioned) {
      args.scope = 'all';
    }
    if ((args.deleteAll !== true && args.removeAll !== true && args.delete !== true && args.remove !== true) && normalizeTempExecReuseModeHint(args.mode) === 'detail_delete') {
      if (!detailName && detailIndex <= 0 && containsAny(text, ['全部子项', '所有子项', '全部复用子项', '所有复用子项'])) {
        args.deleteAll = true;
      }
    }
    value = assistantReadFirstArgString(args, ['value', 'to', 'text', 'content', 'newValue']);
    if (!value && normalizeTempExecReuseFieldName(args.field || '') === 'actual') {
      value = extractCaseUpdateValue(text, 'actual');
    }
    if (!value && normalizeTempExecReuseFieldName(args.field || '') !== 'actual') {
      genericValue = extractCaseUpdateValue(text, 'title');
      if (genericValue) value = genericValue;
    }
    if (value && !assistantReadFirstArgString(args, ['value', 'to', 'text', 'content', 'newValue'])) {
      args.value = value;
    }
    if (!args.sourceUserText && text) args.sourceUserText = text;
    return args;
  }

  function rewriteUiFillAsCaseUpdateIfNeeded(tool, args, userText) {
    var source = null;
    var parsed = null;
    var candidate = {};
    var fieldRaw = '';
    var normalizedField = '';
    var valueRaw = undefined;
    var idxRaw = undefined;
    var idx = 0;
    var op = '';
    var sourceScope = '';
    if (tool !== 'ui.fill_input') return { tool: tool, args: args, rewritten: false };
    source = args && typeof args === 'object' ? Object.assign({}, args) : {};
    parsed = parseCaseUpdateCommand(userText);
    if (parsed && parsed.field) candidate.field = parsed.field;
    if (parsed && parsed.value !== undefined && parsed.value !== null && String(parsed.value).trim() !== '') {
      candidate.value = String(parsed.value).trim();
    }
    if (parsed && parsed.clear === true) candidate.clear = true;
    if (parsed && Number(parsed.index) > 0) candidate.index = Number(parsed.index);
    if (parsed && parsed.operation) candidate.operation = String(parsed.operation);
    if (parsed && parsed.scope) candidate.scope = String(parsed.scope);
    if (!candidate.field && source.field !== undefined && source.field !== null) fieldRaw = String(source.field);
    if (!candidate.field && !fieldRaw && source.key !== undefined && source.key !== null) fieldRaw = String(source.key);
    if (!candidate.field && !fieldRaw && source.column !== undefined && source.column !== null) fieldRaw = String(source.column);
    if (!candidate.field && !fieldRaw && source.name !== undefined && source.name !== null) fieldRaw = String(source.name);
    normalizedField = normalizeCaseUpdateFieldName(fieldRaw);
    if (normalizedField) candidate.field = normalizedField;
    valueRaw = source.value;
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
      idxRaw = source.index;
      if ((idxRaw === undefined || idxRaw === null) && source.itemIndex !== undefined && source.itemIndex !== null) idxRaw = source.itemIndex;
      if ((idxRaw === undefined || idxRaw === null) && source.seq !== undefined && source.seq !== null) idxRaw = source.seq;
      if ((idxRaw === undefined || idxRaw === null) && source.row !== undefined && source.row !== null) idxRaw = source.row;
      if ((idxRaw === undefined || idxRaw === null) && source.sourceIndex !== undefined && source.sourceIndex !== null) idxRaw = source.sourceIndex;
      idx = Number(idxRaw);
      if (Number.isFinite(idx) && idx > 0) candidate.index = Math.floor(idx);
    }
    op = normalizeCaseUpdateOperationFromArgs(source);
    if (!op && parsed && parsed.operation) op = String(parsed.operation);
    if (op) candidate.operation = op;
    if (!candidate.scope) {
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

  function rewriteCaseUpdateAsTempExecReuseUpdateIfNeeded(tool, args, userText) {
    var payload = args && typeof args === 'object' ? Object.assign({}, args) : {};
    var rawText = String(userText || payload.sourceUserText || '').trim();
    var detailName = assistantReadFirstArgString(payload, ['detailName', 'subItemName', 'childName', 'detailText', 'subItemText', 'childText']);
    var detailId = assistantReadFirstArgString(payload, ['detailId', 'subItemId', 'childId']);
    var detailIndex = toPositiveInt(payload.detailIndex || payload.subItemIndex || payload.childIndex || payload.detailSeq, 0);
    var caseField = normalizeCaseUpdateFieldName(payload.field || payload.key || payload.column || payload.name || '');
    var reuseField = normalizeTempExecReuseFieldName(payload.field || payload.key || payload.column || payload.name || '');
    var parsed = null;
    var shouldRewriteOverallStatus = false;
    var explicitCaseIndexes = Array.isArray(payload.caseIndexes) ? payload.caseIndexes : [];
    var resolvedCaseIndex = 0;
    if (tool !== 'case.update') return { tool: tool, args: payload, rewritten: false };
    if (!reuseField) {
      if (caseField === 'actual' || caseField === 'remark') reuseField = caseField;
      else if (caseField === 'title') reuseField = 'text';
    }
    shouldRewriteOverallStatus = reuseField === 'actual' && shouldPreferTempExecReuseStatusUpdateForAssistant(payload);
    if (!detailName && !detailId && !(detailIndex > 0) && !containsAny(rawText, ['复用子项', '子项', '复用']) && !shouldRewriteOverallStatus) {
      return { tool: tool, args: payload, rewritten: false };
    }
    parsed = parseTempExecReuseUpdateCommand(rawText, payload) || payload;
    if (!parsed || typeof parsed !== 'object') parsed = payload;
    if (!parsed.field && reuseField) parsed.field = reuseField;
    if (!parsed.mode) parsed.mode = 'detail_update';
    if (shouldRewriteOverallStatus && normalizeTempExecReuseFieldName(parsed.field || '') === 'actual') {
      resolvedCaseIndex = toPositiveInt(parsed.index || parsed.itemIndex || parsed.seq || parsed.row, 0);
      parsed.applyAll = true;
      if (!parsed.scope || String(parsed.scope).trim().toLowerCase() === 'all') {
        if (explicitCaseIndexes.length > 1) parsed.scope = 'selected_cases';
        else if (resolvedCaseIndex > 0 || explicitCaseIndexes.length === 1) parsed.scope = 'single_case';
        else parsed.scope = 'file_all';
      }
    }
    if (!parsed.field) return { tool: tool, args: payload, rewritten: false };
    return {
      tool: 'tempexec.reuse_update',
      args: parsed,
      rewritten: true,
    };
  }

  function rewriteTempExecReuseUpdateAsCaseUpdateIfNeeded(tool, args, userText) {
    var payload = args && typeof args === 'object' ? Object.assign({}, args) : {};
    var rawText = String(userText || payload.sourceUserText || '').trim();
    var field = normalizeTempExecReuseFieldName(payload.field || payload.key || payload.column || payload.name || '');
    var detailName = assistantReadFirstArgString(payload, ['detailName', 'subItemName', 'childName', 'detailText', 'subItemText', 'childText']);
    var detailId = assistantReadFirstArgString(payload, ['detailId', 'subItemId', 'childId']);
    var detailIndex = toPositiveInt(payload.detailIndex || payload.subItemIndex || payload.childIndex || payload.detailSeq, 0);
    var keepAsReuse = false;
    if (tool !== 'tempexec.reuse_update') return { tool: tool, args: payload, rewritten: false };
    keepAsReuse = field === 'actual' && (payload.applyAll === true || payload.all === true || payload.batch === true || shouldPreferTempExecReuseStatusUpdateForAssistant(payload));
    if (keepAsReuse) {
      return { tool: tool, args: payload, rewritten: false };
    }
    if (detailName || detailId || detailIndex > 0 || containsAny(rawText, ['复用子项', '子项', '复用'])) {
      return { tool: tool, args: payload, rewritten: false };
    }
    if (field !== 'actual' && field !== 'remark') return { tool: tool, args: payload, rewritten: false };
    return {
      tool: 'case.update',
      args: inferCaseUpdateArgsFromText(Object.assign({}, payload, {
        field: field,
      }), rawText),
      rewritten: true,
    };
  }

  function formatTempExecReuseUpdateSuccessText(result) {
    var data = result && typeof result === 'object' ? result : {};
    var mode = normalizeTempExecReuseModeHint(assistantReadFirstArgString(data, ['mode', 'action', 'type']));
    var field = normalizeTempExecReuseFieldName(data.field || data.key || data.column || data.name || '');
    var fileName = assistantReadFirstArgString(data, ['fileName']) || '当前执行用例';
    var detailName = assistantReadFirstArgString(data, ['detailName']) || '';
    var value = assistantReadFirstArgString(data, ['value']) || '';
    var previousValue = assistantReadFirstArgString(data, ['previousValue']) || '';
    var index = toPositiveInt(data.index, 0);
    var detailIndex = toPositiveInt(data.detailIndex, 0);
    var selectedCaseCount = toPositiveInt(data.selectedCaseCount, 0);
    var updatedCount = toPositiveInt(data.updatedCount || data.count, 0);
    var deletedCount = toPositiveInt(data.deletedCount, 0);
    var affectedCaseCount = toPositiveInt(data.affectedCaseCount, 0);
    var all = data.all === true || data.deleteAll === true || String(data.scope || '').toLowerCase() === 'all' || String(data.scope || '').toLowerCase() === 'file_all';
    if (mode === 'preset_set' || mode === 'preset_add') {
      if (selectedCaseCount > 1) {
        return '已更新复用预设子项：执行用例“' + fileName + '”，共 ' + selectedCaseCount + ' 条用例，当前预设 ' + (updatedCount || toPositiveInt(data.count, 0) || 0) + ' 项。';
      }
      return '已更新复用预设子项：执行用例“' + fileName + '”。';
    }
    if (mode === 'preset_rename') {
      if (affectedCaseCount > 0) {
        return '已重命名复用预设子项：执行用例“' + fileName + '”中的“' + (previousValue || detailName || '目标子项') + '”已改为“' + (value || detailName || '新名称') + '”，同步影响 ' + affectedCaseCount + ' 条用例。';
      }
      return '已重命名复用预设子项：执行用例“' + fileName + '”中的“' + (previousValue || detailName || '目标子项') + '”已改为“' + (value || detailName || '新名称') + '”。';
    }
    if (mode === 'detail_delete') {
      if (all || deletedCount > 1 || selectedCaseCount > 1) {
        return '已删除复用子项：执行用例“' + fileName + '”，共 ' + (selectedCaseCount || 1) + ' 条用例，' + (deletedCount || updatedCount || 0) + ' 项，已统一处理。';
      }
      return '已删除复用子项：执行用例“' + fileName + '”第 ' + (index || 1) + ' 条的子项“' + (detailName || ('子项' + String(detailIndex || 1))) + '”。';
    }
    if (field === 'actual') {
      if (all || updatedCount > 1 || selectedCaseCount > 1) {
        return '已将复用子项执行结果改为“' + (value || '目标状态') + '”：执行用例“' + fileName + '”，共 ' + (selectedCaseCount || 1) + ' 条用例，' + (updatedCount || 0) + ' 项，已统一处理。';
      }
      return '已将复用子项执行结果改为“' + (value || '目标状态') + '”：执行用例“' + fileName + '”第 ' + (index || 1) + ' 条的子项“' + (detailName || ('子项' + String(detailIndex || 1))) + '”。';
    }
    if (field === 'remark') {
      if (all || updatedCount > 1 || selectedCaseCount > 1) {
        return '已更新复用子项备注：执行用例“' + fileName + '”，共 ' + (selectedCaseCount || 1) + ' 条用例，' + (updatedCount || 0) + ' 项，已统一处理。';
      }
      return '已更新复用子项备注：执行用例“' + fileName + '”第 ' + (index || 1) + ' 条的子项“' + (detailName || ('子项' + String(detailIndex || 1))) + '”。';
    }
    if (field === 'text') {
      return '已更新复用子项名称：执行用例“' + fileName + '”第 ' + (index || 1) + ' 条的子项已改为“' + (detailName || value || ('子项' + String(detailIndex || 1))) + '”。';
    }
    return '已完成复用子项操作：执行用例“' + fileName + '”。';
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
      '有改动': '有改动'
    };
    if (Object.prototype.hasOwnProperty.call(map, compact)) return map[compact];
    return '';
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
      actual: '执行结果'
    };
    return fieldLabelMap[field] || field || '字段';
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
    if (action === 'case_library.batch_update_exec_results') return '修改用例执行结果（批量）';
    if (action === 'case_library.batch_archive_exec_cases') return '归档当前执行用例';
    if (action === 'tempexec.remove_files') return '移出执行用例';
    if (action === 'ui.click_control') {
      var inspectText = [payload.controlId, payload.controlText, payload.text, payload.label, payload.name, payload.query].join(' ');
      if (containsAny(inspectText, ['归档', 'archive'])) return '归档当前执行用例';
      return '点击控件';
    }
    if (action === 'run_case_generation') return '触发用例生成';
    if (action === 'run_missing_recommendation') return '触发漏测推荐';
    if (action === 'delete_case') {
      var idx = toPositiveInt(payload.index, 1);
      return '删除第 ' + idx + ' 条用例';
    }
    return '执行写操作';
  }

  function normalizePendingInteractionChoices(choices) {
    var list = Array.isArray(choices) ? choices : [];
    return list.map(function(choice, index) {
      var item = choice && typeof choice === 'object' ? choice : {};
      var label = item.label !== undefined && item.label !== null
        ? String(item.label).trim()
        : (item.name !== undefined && item.name !== null ? String(item.name).trim() : '');
      if (!label) label = '选项 ' + (index + 1);
      return {
        id: item.id !== undefined && item.id !== null ? String(item.id) : ('pending-choice-' + (index + 1)),
        label: label,
        description: item.description !== undefined && item.description !== null ? String(item.description).trim() : '',
        replyText: item.replyText !== undefined && item.replyText !== null ? String(item.replyText).trim() : ('选第' + (index + 1) + '个'),
        suggestedCapability: item.suggestedCapability !== undefined && item.suggestedCapability !== null ? normalizeMcpToolName(item.suggestedCapability) : '',
        argsPatch: item.argsPatch && typeof item.argsPatch === 'object' ? JSON.parse(JSON.stringify(item.argsPatch)) : {},
        data: item.data && typeof item.data === 'object' ? JSON.parse(JSON.stringify(item.data)) : {},
      };
    }).filter(function(item) { return !!(item && item.label); });
  }

  function clonePendingInteraction(source) {
    var item = source && typeof source === 'object' ? source : null;
    if (!item) return null;
    return {
      kind: item.kind !== undefined && item.kind !== null ? String(item.kind) : '',
      prompt: item.prompt !== undefined && item.prompt !== null ? String(item.prompt) : '',
      sourceUserText: item.sourceUserText !== undefined && item.sourceUserText !== null ? String(item.sourceUserText) : '',
      sourceCapability: item.sourceCapability !== undefined && item.sourceCapability !== null ? normalizeMcpToolName(item.sourceCapability) : '',
      baseArgs: item.baseArgs && typeof item.baseArgs === 'object' ? JSON.parse(JSON.stringify(item.baseArgs)) : {},
      choices: normalizePendingInteractionChoices(item.choices),
      observation: item.observation && typeof item.observation === 'object' ? JSON.parse(JSON.stringify(item.observation)) : null,
      taskState: cloneAssistantTaskState(item.taskState),
      taskStepId: item.taskStepId !== undefined && item.taskStepId !== null ? String(item.taskStepId) : '',
      selectedChoice: item.selectedChoice && typeof item.selectedChoice === 'object' ? JSON.parse(JSON.stringify(item.selectedChoice)) : null,
    };
  }

  function clearPendingInteraction() {
    pendingInteraction = null;
  }

  function rememberPendingInteraction(interaction) {
    pendingInteraction = clonePendingInteraction(interaction);
    return pendingInteraction;
  }

  function normalizePendingInteractionChoiceText(value) {
    return String(value === undefined || value === null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[“”"'`]/g, '')
      .replace(/[()（）\[\]【】]/g, '');
  }

  function resolvePendingInteractionChoice(pending, text) {
    var data = clonePendingInteraction(pending);
    var raw = String(text === undefined || text === null ? '' : text).trim();
    var compact = normalizePendingInteractionChoiceText(raw);
    var match = null;
    var items = [];
    var i = 0;
    var idx = 0;
    if (!data || !compact) return null;
    items = Array.isArray(data.choices) ? data.choices : [];
    match = compact.match(/(?:选|第)?(\d+)(?:个|项|条)?$/);
    if (match && match[1]) {
      idx = Number(match[1]);
      if (Number.isFinite(idx) && idx > 0 && idx <= items.length) return JSON.parse(JSON.stringify(items[idx - 1]));
    }
    for (i = 0; i < items.length; i += 1) {
      var choice = items[i] && typeof items[i] === 'object' ? items[i] : {};
      var label = normalizePendingInteractionChoiceText(choice.label || '');
      var replyText = normalizePendingInteractionChoiceText(choice.replyText || '');
      if (compact === label || compact === replyText) return JSON.parse(JSON.stringify(choice));
      if (label && (label.indexOf(compact) !== -1 || compact.indexOf(label) !== -1)) return JSON.parse(JSON.stringify(choice));
    }
    return null;
  }

  function buildPendingInteractionChoiceBlock(interaction) {
    var pending = clonePendingInteraction(interaction);
    if (!pending || !pending.choices || !pending.choices.length) return null;
    return {
      type: 'choice_list',
      title: '待你选择',
      prompt: pending.prompt || '请从下列选项中选择。',
      items: pending.choices.map(function(choice) {
        return {
          id: choice.id || '',
          label: choice.label || '',
          description: choice.description || '',
          replyText: choice.replyText || '',
        };
      }),
    };
  }

  function buildAssistantProtocolTaskStepId(value, fallbackIndex) {
    var text = value === undefined || value === null ? '' : String(value).trim();
    if (text) return text;
    return 'step-' + (fallbackIndex + 1);
  }

  function normalizeAssistantProtocolTask(task) {
    var item = task && typeof task === 'object' ? task : null;
    var steps = [];
    if (!item) return null;
    if (Array.isArray(item.steps)) {
      steps = item.steps.map(function(step, index) {
        var row = step && typeof step === 'object' ? step : {};
        var label = row.label !== undefined && row.label !== null ? String(row.label).trim() : '';
        if (!label) return null;
        return {
          id: buildAssistantProtocolTaskStepId(row.id || row.stepId, index),
          label: label,
          description: row.description !== undefined && row.description !== null ? String(row.description).trim() : '',
        };
      }).filter(function(step) { return !!step; });
    }
    return {
      title: item.title !== undefined && item.title !== null ? String(item.title).trim() : '',
      summary: item.summary !== undefined && item.summary !== null ? String(item.summary).trim() : '',
      steps: steps,
    };
  }

  function mapLegacyActionToCapability(actionPayload) {
    var item = actionPayload && typeof actionPayload === 'object' ? actionPayload : {};
    var action = normalizeModelActionName(item.action || item.name || '');
    var capability = '';
    var args = {};
    if (action === 'navigate') {
      capability = 'nav.switch_tab';
      if (item.tab) args.tab = item.tab;
    } else if (action === 'query_case_list') {
      capability = 'cases.list_current';
      if (item.query) args.query = item.query;
    } else if (action === 'query_page_data') {
      capability = 'page.get_data';
      if (item.tab) args.tab = item.tab;
    } else if (action === 'current_page_info') {
      capability = 'page.current_info';
    } else if (action === 'web_search') {
      capability = 'web.search';
      if (item.query) args.query = item.query;
    } else if (action === 'memo_list') {
      capability = 'memo.list';
    } else if (action === 'memo_add') {
      capability = 'memo.add';
      if (item.text) args.text = item.text;
      if (item.tab) args.tab = item.tab;
    } else if (action === 'memo_toggle') {
      capability = 'memo.toggle';
      if (item.index !== undefined && item.index !== null) args.index = item.index;
      if (item.done !== undefined && item.done !== null) args.done = item.done;
    } else if (action === 'memo_remove') {
      capability = 'memo.remove';
      if (item.index !== undefined && item.index !== null) args.index = item.index;
    } else if (action === 'settings_patch') {
      capability = 'settings.patch';
      if (item.patch && typeof item.patch === 'object') args.patch = item.patch;
    } else if (action === 'settings_describe') {
      capability = 'settings.describe';
      if (item.key) args.key = item.key;
    } else if (action === 'update_case') {
      capability = 'case.update';
      args = Object.assign({}, item);
    } else if (action === 'delete_case') {
      capability = 'case.delete';
      if (item.index !== undefined && item.index !== null) args.index = item.index;
    } else if (action === 'run_case_generation') {
      capability = 'casegen.run';
    } else if (action === 'run_missing_recommendation') {
      capability = 'missing_recommend.run';
    }
    if (!capability) return null;
    return {
      stepId: buildAssistantProtocolTaskStepId(item.stepId || item.id || capability, 0),
      capability: capability,
      args: args,
    };
  }

  function normalizeAssistantProtocolCalls(parsed) {
    var payload = parsed && typeof parsed === 'object' ? parsed : {};
    var list = [];
    var rawCalls = [];
    if (Array.isArray(payload.calls)) rawCalls = payload.calls;
    else if (Array.isArray(payload.mcp && payload.mcp.calls ? payload.mcp.calls : null)) rawCalls = payload.mcp.calls;
    else if (payload.mcp && typeof payload.mcp === 'object' && (payload.mcp.tool || payload.mcp.name)) rawCalls = [payload.mcp];
    else if (payload.call && typeof payload.call === 'object') rawCalls = [payload.call];
    rawCalls.forEach(function(call, index) {
      var item = call && typeof call === 'object' ? call : {};
      var capability = normalizeMcpToolName(item.capability || item.tool || item.name || '');
      var args = item.args && typeof item.args === 'object'
        ? JSON.parse(JSON.stringify(item.args))
        : (item.params && typeof item.params === 'object' ? JSON.parse(JSON.stringify(item.params)) : {});
      if (!capability) return;
      list.push({
        stepId: buildAssistantProtocolTaskStepId(item.stepId || item.id || capability, index),
        capability: capability,
        args: args,
      });
    });
    if (!list.length) {
      var legacyActions = extractModelActionList(payload);
      legacyActions.forEach(function(action) {
        var mapped = mapLegacyActionToCapability(action);
        if (mapped) list.push(mapped);
      });
    }
    return list;
  }

  function normalizeAssistantProtocolResponse(text, userText) {
    var raw = text === undefined || text === null ? '' : String(text).trim();
    var parsed = parseJsonObjectFromText(raw);
    var calls = [];
    var task = null;
    if (!raw) {
      return { protocolVersion: 'assistant_v2', message: '', blocks: [], task: null, calls: [] };
    }
    if (!parsed || typeof parsed !== 'object') {
      return { protocolVersion: 'assistant_v2', message: raw, blocks: [], task: null, calls: [] };
    }
    calls = normalizeAssistantProtocolCalls(parsed);
    task = normalizeAssistantProtocolTask(parsed.task || parsed.plan || null);
    if (!task && calls.length) {
      task = {
        title: parsed.title !== undefined && parsed.title !== null ? String(parsed.title).trim() : '当前任务',
        summary: parsed.summary !== undefined && parsed.summary !== null ? String(parsed.summary).trim() : '',
        steps: calls.map(function(call, index) {
          return {
            id: call.stepId || ('step-' + (index + 1)),
            label: buildAssistantTaskStepLabelFromMcpCall({ tool: call.capability, args: call.args }, userText || ''),
            description: '',
          };
        }),
      };
    }
    return {
      protocolVersion: parsed.protocolVersion && String(parsed.protocolVersion).trim() ? String(parsed.protocolVersion).trim() : 'assistant_v2',
      message: parsed.message !== undefined && parsed.message !== null
        ? String(parsed.message).trim()
        : (parsed.response !== undefined && parsed.response !== null ? String(parsed.response).trim() : ''),
      blocks: normalizeAssistantBlocks(parsed.blocks),
      task: task,
      calls: calls,
    };
  }

  function assistantBlockIsClarificationNotice(block) {
    var item = block && typeof block === 'object' ? block : {};
    var type = normalizeAssistantBlockType(item.type || item.blockType || item.kind);
    var title = item.title !== undefined && item.title !== null ? String(item.title).trim() : '';
    var text = item.text !== undefined && item.text !== null ? String(item.text).trim() : '';
    if (type !== 'notice') return false;
    if (title === '需要补充信息' || title === '需要确认信息' || title === '需要确认') return true;
    return containsAny(text, ['请先确认', '请确认', '请补充', '请告诉我', '请说明', '还需要你确认']);
  }

  function assistantMessageLooksLikeClarification(text) {
    var raw = text === undefined || text === null ? '' : String(text).trim();
    if (!raw) return false;
    if (/[？?]$/.test(raw)) return true;
    return containsAny(raw, [
      '请先确认',
      '请确认',
      '请补充',
      '请告诉我',
      '请说明',
      '还需要你确认',
      '你是指',
      '是指',
      '我需要先确认',
      '我还需要确认'
    ]);
  }

  function buildAssistantProtocolClarificationPendingInteraction(protocol, taskRuntime, sourceUserText) {
    var item = protocol && typeof protocol === 'object' ? protocol : null;
    var blocks = [];
    var promptText = '';
    var sourceText = sourceUserText === undefined || sourceUserText === null ? '' : String(sourceUserText).trim();
    if (!item || (Array.isArray(item.calls) && item.calls.length)) return null;
    blocks = normalizeAssistantBlocks(item.blocks);
    promptText = buildAssistantProtocolResultText(item.message, blocks);
    if (!promptText) return null;
    if (!blocks.some(assistantBlockIsClarificationNotice) && !assistantMessageLooksLikeClarification(promptText)) return null;
    return {
      kind: 'model_clarify',
      prompt: promptText,
      sourceUserText: sourceText,
      sourceCapability: 'assistant.runtime.model_clarify',
      baseArgs: {},
      choices: [],
      observation: {
        capability: 'assistant.runtime.model_clarify',
        status: 'waiting',
        message: promptText,
        data: { source: 'model_clarify' },
        choices: [],
      },
      taskState: taskRuntime && taskRuntime.taskState ? taskRuntime.taskState : null,
      taskStepId: '',
      selectedChoice: null,
    };
  }

  function markAssistantTaskRuntimeWaiting(taskRuntime, summary) {
    var runtime = taskRuntime && typeof taskRuntime === 'object' ? taskRuntime : null;
    var text = summary === undefined || summary === null ? '等待你补充信息后继续。' : String(summary);
    var i = 0;
    var fallbackIndex = -1;
    if (!runtime || !runtime.taskState || !Array.isArray(runtime.taskState.steps)) return;
    for (i = 0; i < runtime.taskState.steps.length; i += 1) {
      var step = runtime.taskState.steps[i] && typeof runtime.taskState.steps[i] === 'object' ? runtime.taskState.steps[i] : {};
      if (step.status === 'running') {
        setAssistantTaskStateStepStatus(runtime.taskState, i, 'waiting', text);
        setAssistantTaskStateStatus(runtime.taskState, 'waiting', text);
        return;
      }
      if (fallbackIndex < 0 && step.status !== 'completed' && step.status !== 'cancelled' && step.status !== 'blocked') {
        fallbackIndex = i;
      }
    }
    if (fallbackIndex >= 0) {
      setAssistantTaskStateStepStatus(runtime.taskState, fallbackIndex, 'waiting', text);
    }
    setAssistantTaskStateStatus(runtime.taskState, 'waiting', text);
  }

  function buildAssistantProtocolTaskRuntimeFromTaskState(taskState) {
    var runtime = { taskState: null, stepIndexById: {} };
    var normalized = normalizeAssistantTaskState(taskState);
    var i = 0;
    if (!normalized) return runtime;
    runtime.taskState = normalized;
    for (i = 0; i < runtime.taskState.steps.length; i += 1) {
      runtime.stepIndexById[runtime.taskState.steps[i].id || ('step-' + (i + 1))] = i;
    }
    return runtime;
  }

  function shouldUseAssistantProtocolTaskFallbackLabel(label) {
    var text = label === undefined || label === null ? '' : String(label).trim();
    if (!text) return true;
    if (text === '执行任务' || text === '执行步骤' || text === '处理任务') return true;
    if (/^步骤\s*\d+$/i.test(text) || /^step[-_\s]*\d+$/i.test(text)) return true;
    return false;
  }

  function shouldPreferAssistantProtocolCallSteps(task, calls) {
    var taskObj = task && typeof task === 'object' ? task : null;
    var steps = taskObj && Array.isArray(taskObj.steps) ? taskObj.steps : [];
    var callList = Array.isArray(calls) ? calls : [];
    var genericCount = 0;
    var i = 0;
    if (!steps.length || !callList.length) return false;
    for (i = 0; i < steps.length; i += 1) {
      var step = steps[i] && typeof steps[i] === 'object' ? steps[i] : {};
      var label = sanitizeAssistantTaskStepLabel(step.label !== undefined && step.label !== null ? String(step.label).trim() : '');
      if (shouldUseAssistantProtocolTaskFallbackLabel(label)) genericCount += 1;
    }
    if (!genericCount) return false;
    if (genericCount >= steps.length) return true;
    return false;
  }

  function findAssistantProtocolCallForStep(calls, stepId, index) {
    var list = Array.isArray(calls) ? calls : [];
    var i = 0;
    if (stepId) {
      for (i = 0; i < list.length; i += 1) {
        if (buildAssistantProtocolTaskStepId(list[i] && list[i].stepId, i) === stepId) return list[i];
      }
    }
    if (index >= 0 && index < list.length) return list[index];
    return null;
  }

  function buildAssistantProtocolTaskStepLabel(step, call, index, userText) {
    var row = step && typeof step === 'object' ? step : {};
    var rawLabel = row.label !== undefined && row.label !== null ? String(row.label).trim() : '';
    var label = sanitizeAssistantTaskStepLabel(rawLabel);
    var currentCall = call && typeof call === 'object' ? call : null;
    var fallbackLabel = '';
    if (!shouldUseAssistantProtocolTaskFallbackLabel(label)) return label;
    if (currentCall) {
      fallbackLabel = buildAssistantTaskStepLabelFromMcpCall({
        tool: currentCall.capability || currentCall.tool || currentCall.name || '',
        args: currentCall.args && typeof currentCall.args === 'object' ? currentCall.args : {},
      }, userText || '');
    }
    return fallbackLabel || label || ('步骤 ' + (index + 1));
  }

  function buildAssistantProtocolCallSignature(calls) {
    var list = Array.isArray(calls) ? calls : [];
    return buildPlanSignature('mcp', list.map(function(call) {
      var row = call && typeof call === 'object' ? call : {};
      return {
        tool: row.capability || row.tool || row.name || '',
        args: row.args && typeof row.args === 'object' ? row.args : {},
      };
    }));
  }

  function normalizeAssistantCapabilityArgsForSignature(capabilityId, args) {
    var id = normalizeMcpToolName(capabilityId);
    var payload = args && typeof args === 'object' ? JSON.parse(JSON.stringify(args)) : {};
    function buildStableValue(value) {
      if (value === undefined || value === null) return null;
      if (Array.isArray(value)) {
        return value.map(function(item) {
          return buildStableValue(item);
        }).filter(function(item) {
          return item !== undefined && item !== null && !(typeof item === 'string' && item === '');
        });
      }
      if (typeof value !== 'object') return value;
      var out = {};
      Object.keys(value).sort().forEach(function(key) {
        var item = buildStableValue(value[key]);
        if (item === undefined || item === null) return;
        if (typeof item === 'string' && item === '') return;
        if (Array.isArray(item) && !item.length) return;
        out[key] = item;
      });
      return out;
    }
    if (!payload || typeof payload !== 'object') payload = {};
    delete payload.confirmed;
    delete payload.sourceUserText;
    delete payload.userText;
    if (id === 'tempexec.reuse_update') {
      var canonical = {};
      ['fileId', 'fileName', 'mode', 'field', 'detailId', 'detailName', 'detailIndex', 'value', 'index', 'applyAll', 'scope', 'operation', 'renameScope', 'context', 'deleteAll', 'caseQuery', 'caseName', 'caseTitle', 'rowQuery'].forEach(function(key) {
        if (!Object.prototype.hasOwnProperty.call(payload, key)) return;
        canonical[key] = payload[key];
      });
      if (Array.isArray(payload.caseIndexes)) {
        canonical.caseIndexes = payload.caseIndexes.map(function(item) {
          return Math.floor(Number(item));
        }).filter(function(item) {
          return Number.isFinite(item) && item > 0;
        }).sort(function(a, b) { return a - b; });
      }
      if (Array.isArray(payload.presetItems)) {
        canonical.presetItems = payload.presetItems.map(function(item) {
          return item === undefined || item === null ? '' : String(item).trim();
        }).filter(Boolean);
      }
      return buildStableValue(canonical);
    }
    return buildStableValue(payload);
  }

  function buildAssistantCapabilityExecutionSignature(capabilityId, args) {
    var id = normalizeMcpToolName(capabilityId);
    if (!id) return '';
    return id + '::' + formatJsonCompact(normalizeAssistantCapabilityArgsForSignature(id, args));
  }

  function getAssistantProtocolFinalizeStepId() {
    return '__assistant_final_reply__';
  }

  function isAssistantProtocolFinalizeLikeStep(step) {
    var row = step && typeof step === 'object' ? step : {};
    var stepId = row.id !== undefined && row.id !== null ? String(row.id).trim() : '';
    var label = row.label !== undefined && row.label !== null ? String(row.label).trim() : '';
    var description = row.description !== undefined && row.description !== null ? String(row.description).trim() : '';
    if (stepId === getAssistantProtocolFinalizeStepId()) return true;
    if (label === '整理结果并回复用户' || label === '整理结果' || label === '输出最终答复' || label === '最终回复用户') return true;
    if (description === '基于已执行步骤整理最终答复。') return true;
    return false;
  }

  function findAssistantProtocolFinalizeStep(steps) {
    var list = Array.isArray(steps) ? steps : [];
    var i = 0;
    for (i = 0; i < list.length; i += 1) {
      if (isAssistantProtocolFinalizeLikeStep(list[i])) return list[i];
    }
    return null;
  }

  function shouldAppendAssistantProtocolFinalizeStep(task, calls) {
    var taskObj = task && typeof task === 'object' ? task : null;
    var steps = taskObj && Array.isArray(taskObj.steps) ? taskObj.steps : [];
    var callList = Array.isArray(calls) ? calls : [];
    if (!callList.length) return false;
    return !findAssistantProtocolFinalizeStep(steps);
  }

  function appendAssistantProtocolFinalizeStep(steps, existingFinalizeStep) {
    var list = Array.isArray(steps) ? steps : [];
    var finalizeStepId = getAssistantProtocolFinalizeStepId();
    var preserved = existingFinalizeStep && typeof existingFinalizeStep === 'object' ? existingFinalizeStep : null;
    var exists = list.some(function(step) {
      return isAssistantProtocolFinalizeLikeStep(step) || (step && String(step.id || '') === finalizeStepId);
    });
    if (exists) return list;
    list.push({
      id: finalizeStepId,
      label: preserved && preserved.label ? String(preserved.label) : '整理结果并回复用户',
      description: preserved && preserved.description ? String(preserved.description) : '基于已执行步骤整理最终答复。',
      status: preserved && preserved.status ? String(preserved.status) : 'waiting',
      capabilityId: preserved && preserved.capabilityId ? String(preserved.capabilityId) : '',
      capabilityArgs: preserved && preserved.capabilityArgs && typeof preserved.capabilityArgs === 'object' ? JSON.parse(JSON.stringify(preserved.capabilityArgs)) : {},
    });
    return list;
  }

  function getAssistantProtocolFinalizeStepIndex(taskRuntime) {
    var runtime = taskRuntime && typeof taskRuntime === 'object' ? taskRuntime : null;
    var finalizeStepId = getAssistantProtocolFinalizeStepId();
    if (!runtime || !runtime.stepIndexById || !Object.prototype.hasOwnProperty.call(runtime.stepIndexById, finalizeStepId)) return -1;
    return Number(runtime.stepIndexById[finalizeStepId]);
  }

  function syncAssistantProtocolFinalizeStep(taskRuntime, status, summary) {
    var runtime = taskRuntime && typeof taskRuntime === 'object' ? taskRuntime : null;
    var stepIndex = getAssistantProtocolFinalizeStepIndex(runtime);
    if (!runtime || !runtime.taskState || stepIndex < 0) return;
    setAssistantTaskStateStepStatus(runtime.taskState, stepIndex, status, summary === undefined ? null : summary);
  }

  function primeAssistantProtocolRunningStep(taskRuntime, calls) {
    var runtime = taskRuntime && typeof taskRuntime === 'object' ? taskRuntime : null;
    var list = Array.isArray(calls) ? calls : [];
    var i = 0;
    if (!runtime || !runtime.taskState || !runtime.stepIndexById || !list.length) return -1;
    for (i = 0; i < list.length; i += 1) {
      var stepId = buildAssistantProtocolTaskStepId(list[i] && (list[i].stepId || list[i].id), i);
      if (!Object.prototype.hasOwnProperty.call(runtime.stepIndexById, stepId)) continue;
      var stepIndex = Number(runtime.stepIndexById[stepId]);
      var step = runtime.taskState.steps && runtime.taskState.steps[stepIndex] ? runtime.taskState.steps[stepIndex] : null;
      if (!step || step.status === 'completed' || step.status === 'blocked' || step.status === 'cancelled') continue;
      setAssistantTaskStateStepStatus(runtime.taskState, stepIndex, 'running', '正在执行：' + (step.label || ('步骤 ' + (stepIndex + 1))));
      return stepIndex;
    }
    return -1;
  }

  function areAssistantProtocolCallsReadOnly(calls) {
    var list = Array.isArray(calls) ? calls : [];
    var i = 0;
    if (!list.length) return false;
    for (i = 0; i < list.length; i += 1) {
      var call = list[i] && typeof list[i] === 'object' ? list[i] : {};
      var tool = normalizeMcpToolName(call.capability || call.tool || call.name || '');
      var capability = getAssistantCapabilityById(tool);
      var mode = capability && capability.mode ? String(capability.mode).trim().toLowerCase() : getMcpToolMode(tool);
      if (mode === 'write') return false;
    }
    return true;
  }

  function buildAssistantProtocolTaskRuntime(protocol, userText) {
    var data = protocol && typeof protocol === 'object' ? protocol : {};
    var task = data.task && typeof data.task === 'object' ? data.task : null;
    var calls = Array.isArray(data.calls) ? data.calls : [];
    var steps = [];
    if (task && Array.isArray(task.steps) && task.steps.length && !shouldPreferAssistantProtocolCallSteps(task, calls)) {
      steps = task.steps.map(function(step, index) {
        var row = step && typeof step === 'object' ? step : {};
        var stepId = buildAssistantProtocolTaskStepId(row.id || row.stepId, index);
        var matchedCall = findAssistantProtocolCallForStep(calls, stepId, index);
        return {
          id: stepId,
          label: buildAssistantProtocolTaskStepLabel(row, matchedCall, index, userText || ''),
          description: row.description || '',
          status: 'waiting',
          capabilityId: matchedCall && (matchedCall.capability || matchedCall.tool || matchedCall.name) ? String(matchedCall.capability || matchedCall.tool || matchedCall.name) : '',
          capabilityArgs: matchedCall && matchedCall.args && typeof matchedCall.args === 'object' ? JSON.parse(JSON.stringify(matchedCall.args)) : {},
        };
      });
    } else {
      steps = calls.map(function(call, index) {
        return {
          id: buildAssistantProtocolTaskStepId(call.stepId, index),
          label: buildAssistantTaskStepLabelFromMcpCall({ tool: call.capability, args: call.args }, userText || ''),
          description: '',
          status: 'waiting',
          capabilityId: call.capability || call.tool || call.name || '',
          capabilityArgs: call.args && typeof call.args === 'object' ? JSON.parse(JSON.stringify(call.args)) : {},
        };
      });
    }
    if (shouldAppendAssistantProtocolFinalizeStep(task, calls)) {
      steps = appendAssistantProtocolFinalizeStep(steps);
    }
    return buildAssistantProtocolTaskRuntimeFromTaskState({
      title: task && task.title ? task.title : '当前任务',
      summary: task && task.summary ? task.summary : (steps.length > 1 ? ('已拆分为 ' + steps.length + ' 个步骤，正在执行。') : '正在执行任务。'),
      status: 'running',
      steps: steps,
    });
  }

  function ensureAssistantProtocolTaskRuntime(runtime, protocol, userText) {
    var data = runtime && typeof runtime === 'object' ? runtime : null;
    var parsed = protocol && typeof protocol === 'object' ? protocol : {};
    var calls = Array.isArray(parsed.calls) ? parsed.calls : [];
    var task = parsed.task && typeof parsed.task === 'object' ? parsed.task : null;
    var existingSteps = data && data.taskState && Array.isArray(data.taskState.steps) ? data.taskState.steps : [];
    var existingFinalizeStep = findAssistantProtocolFinalizeStep(existingSteps);
    var existingStepMap = {};
    var i = 0;
    if (!data || !data.taskState) return buildAssistantProtocolTaskRuntime(parsed, userText);
    for (i = 0; i < existingSteps.length; i += 1) {
      var existingRow = existingSteps[i] && typeof existingSteps[i] === 'object' ? existingSteps[i] : null;
      if (!existingRow || !existingRow.id) continue;
      existingStepMap[String(existingRow.id)] = existingRow;
    }
    if (task && task.title) data.taskState.title = task.title;
    if (task && task.summary) data.taskState.summary = task.summary;
    if (task && Array.isArray(task.steps) && task.steps.length && !shouldPreferAssistantProtocolCallSteps(task, calls)) {
      data.taskState.steps = task.steps.map(function(step, index) {
        var row = step && typeof step === 'object' ? step : {};
        var stepId = buildAssistantProtocolTaskStepId(row.id || row.stepId, index);
        var matchedCall = findAssistantProtocolCallForStep(calls, stepId, index);
        var preserved = existingStepMap[stepId] && typeof existingStepMap[stepId] === 'object' ? existingStepMap[stepId] : null;
        return {
          id: stepId,
          label: buildAssistantProtocolTaskStepLabel(row, matchedCall, index, userText || ''),
          description: row.description || (preserved && preserved.description ? preserved.description : ''),
          status: preserved && preserved.status ? String(preserved.status) : 'waiting',
          capabilityId: matchedCall && (matchedCall.capability || matchedCall.tool || matchedCall.name)
            ? String(matchedCall.capability || matchedCall.tool || matchedCall.name)
            : (preserved && preserved.capabilityId ? String(preserved.capabilityId) : ''),
          capabilityArgs: matchedCall && matchedCall.args && typeof matchedCall.args === 'object'
            ? JSON.parse(JSON.stringify(matchedCall.args))
            : (preserved && preserved.capabilityArgs && typeof preserved.capabilityArgs === 'object' ? JSON.parse(JSON.stringify(preserved.capabilityArgs)) : {}),
        };
      });
    } else if (shouldPreferAssistantProtocolCallSteps(task, calls)) {
      data.taskState.steps = calls.map(function(call, index) {
        var stepId = buildAssistantProtocolTaskStepId(call.stepId, index);
        var preserved = existingStepMap[stepId] && typeof existingStepMap[stepId] === 'object' ? existingStepMap[stepId] : null;
        return {
          id: stepId,
          label: buildAssistantTaskStepLabelFromMcpCall({ tool: call.capability, args: call.args }, userText || ''),
          description: preserved && preserved.description ? preserved.description : '',
          status: preserved && preserved.status ? String(preserved.status) : 'waiting',
          capabilityId: call.capability || call.tool || call.name || '',
          capabilityArgs: call.args && typeof call.args === 'object'
            ? JSON.parse(JSON.stringify(call.args))
            : (preserved && preserved.capabilityArgs && typeof preserved.capabilityArgs === 'object' ? JSON.parse(JSON.stringify(preserved.capabilityArgs)) : {}),
        };
      });
    }
    if (!Array.isArray(data.taskState.steps)) data.taskState.steps = [];
    for (i = 0; i < calls.length; i += 1) {
      var stepId = buildAssistantProtocolTaskStepId(calls[i].stepId, i);
      var alreadyExists = data.taskState.steps.some(function(step) {
        return step && String(step.id || '') === stepId;
      });
      if (alreadyExists) continue;
      var insertIndex = data.taskState.steps.length;
      var finalizeIndex = -1;
      var preserved = existingStepMap[stepId] && typeof existingStepMap[stepId] === 'object' ? existingStepMap[stepId] : null;
      data.taskState.steps.some(function(step, stepIndex) {
        if (!isAssistantProtocolFinalizeLikeStep(step)) return false;
        finalizeIndex = stepIndex;
        return true;
      });
      if (finalizeIndex >= 0) insertIndex = finalizeIndex;
      data.taskState.steps.splice(insertIndex, 0, {
        id: stepId,
        label: buildAssistantTaskStepLabelFromMcpCall({ tool: calls[i].capability, args: calls[i].args }, userText || ''),
        description: preserved && preserved.description ? preserved.description : '',
        status: preserved && preserved.status ? String(preserved.status) : 'waiting',
        capabilityId: calls[i].capability || calls[i].tool || calls[i].name || '',
        capabilityArgs: calls[i].args && typeof calls[i].args === 'object'
          ? JSON.parse(JSON.stringify(calls[i].args))
          : (preserved && preserved.capabilityArgs && typeof preserved.capabilityArgs === 'object' ? JSON.parse(JSON.stringify(preserved.capabilityArgs)) : {}),
      });
    }
    var preservedMissingSteps = [];
    existingSteps.forEach(function(step) {
      var row = step && typeof step === 'object' ? step : null;
      var existsNow = false;
      if (!row || !row.id || isAssistantProtocolFinalizeLikeStep(row)) return;
      existsNow = data.taskState.steps.some(function(nextStep) {
        return nextStep && String(nextStep.id || '') === String(row.id || '');
      });
      if (existsNow) return;
      preservedMissingSteps.push({
        id: String(row.id || ''),
        label: row.label ? String(row.label) : '',
        description: row.description ? String(row.description) : '',
        status: row.status ? String(row.status) : 'waiting',
        capabilityId: row.capabilityId ? String(row.capabilityId) : '',
        capabilityArgs: row.capabilityArgs && typeof row.capabilityArgs === 'object' ? JSON.parse(JSON.stringify(row.capabilityArgs)) : {},
      });
    });
    if (preservedMissingSteps.length) {
      var finalizeInsertIndex = -1;
      data.taskState.steps.some(function(step, stepIndex) {
        if (!isAssistantProtocolFinalizeLikeStep(step)) return false;
        finalizeInsertIndex = stepIndex;
        return true;
      });
      if (finalizeInsertIndex >= 0) {
        data.taskState.steps = preservedMissingSteps.concat(data.taskState.steps.slice(0, finalizeInsertIndex), data.taskState.steps.slice(finalizeInsertIndex));
      } else {
        data.taskState.steps = preservedMissingSteps.concat(data.taskState.steps);
      }
    }
    if (shouldAppendAssistantProtocolFinalizeStep(task, calls)) {
      data.taskState.steps = appendAssistantProtocolFinalizeStep(data.taskState.steps || [], existingFinalizeStep);
    }
    data.taskState = normalizeAssistantTaskState(data.taskState);
    data.stepIndexById = {};
    if (data.taskState && Array.isArray(data.taskState.steps)) {
      for (i = 0; i < data.taskState.steps.length; i += 1) {
        data.stepIndexById[data.taskState.steps[i].id || ('step-' + (i + 1))] = i;
      }
    }
    return data;
  }

  function buildAssistantCapabilityObservation(capabilityId, args, result) {
    var id = normalizeMcpToolName(capabilityId);
    var data = result && result.data !== undefined ? result.data : null;
    var compactData = null;
    try {
      compactData = buildMcpReasonPayload(id, args || {}, data && typeof data === 'object' ? data : {});
    } catch (err) {
      compactData = data && typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : data;
    }
    return {
      capability: id,
      status: result && result.status ? String(result.status) : '',
      message: result && result.message ? String(result.message) : '',
      data: compactData,
      choices: result && Array.isArray(result.choices) ? normalizePendingInteractionChoices(result.choices) : [],
    };
  }

  function normalizeAssistantCapabilityCallArgsForExecution(capabilityId, args, userText) {
    var payload = args && typeof args === 'object' ? Object.assign({}, args) : {};
    if (userText && (!payload.sourceUserText || !String(payload.sourceUserText).trim())) {
      payload.sourceUserText = String(userText);
    }
    return payload;
  }

  function normalizeAssistantCapabilityCallForExecution(capabilityId, args, userText) {
    var id = normalizeMcpToolName(capabilityId);
    var payload = normalizeAssistantCapabilityCallArgsForExecution(id, args, userText);
    return {
      capabilityId: id,
      args: payload,
    };
  }

  function isAssistantRuntimeObservationCapability(capabilityId) {
    var id = normalizeMcpToolName(capabilityId);
    return id.indexOf('assistant.runtime.') === 0;
  }

  function findLatestSuccessfulObservationEntryFromList(list, capabilityId) {
    var rows = Array.isArray(list) ? list : [];
    var id = normalizeMcpToolName(capabilityId);
    var i = 0;
    if (!id) return null;
    for (i = rows.length - 1; i >= 0; i -= 1) {
      var row = rows[i] && typeof rows[i] === 'object' ? rows[i] : {};
      if (normalizeMcpToolName(row.capability || '') !== id) continue;
      if (String(row.status || '') !== 'ok') continue;
      return row;
    }
    return null;
  }

  function assistantHasSuccessfulWriteObservation(list) {
    var rows = Array.isArray(list) ? list : [];
    var i = 0;
    for (i = rows.length - 1; i >= 0; i -= 1) {
      var row = rows[i] && typeof rows[i] === 'object' ? rows[i] : {};
      var capabilityId = normalizeMcpToolName(row.capability || '');
      if (!capabilityId || isAssistantRuntimeObservationCapability(capabilityId)) continue;
      if (String(row.status || '') !== 'ok') continue;
      if (getMcpToolMode(capabilityId) === 'write') return true;
    }
    return false;
  }

  function assistantBuildObservedCaseExecutionSummary(caseData, targetValue, caseIndex) {
    var data = caseData && typeof caseData === 'object' ? caseData : {};
    var items = Array.isArray(data.items) ? data.items : [];
    var summary = {
      total: items.length,
      caseIndex: 0,
      found: false,
      satisfiedCount: 0,
      unmetCount: 0,
      allMatched: false,
    };
    var i = 0;
    var normalizedIndex = toPositiveInt(caseIndex, 0);
    if (normalizedIndex > 0) {
      summary.caseIndex = normalizedIndex;
      if (items[normalizedIndex - 1] && typeof items[normalizedIndex - 1] === 'object') {
        summary.found = true;
        summary.allMatched = resolveCaseExecutionResult(items[normalizedIndex - 1]) === targetValue;
        summary.satisfiedCount = summary.allMatched ? 1 : 0;
        summary.unmetCount = summary.allMatched ? 0 : 1;
      } else {
        summary.unmetCount = 1;
      }
      return summary;
    }
    for (i = 0; i < items.length; i += 1) {
      if (resolveCaseExecutionResult(items[i]) === targetValue) summary.satisfiedCount += 1;
    }
    summary.unmetCount = items.length - summary.satisfiedCount;
    summary.allMatched = items.length > 0 && summary.unmetCount === 0;
    return summary;
  }

  function assistantTextIndicatesWriteIntent(text) {
    var raw = text === undefined || text === null ? '' : String(text).trim();
    if (!raw) return false;
    return containsAny(raw, [
      '修改',
      '更新',
      '编辑',
      '删除',
      '移除',
      '新建',
      '创建',
      '新增',
      '写入',
      '设置',
      '设为',
      '改为',
      '改成',
      '改回',
      '调整',
      '切换',
      '归档',
      '补齐',
      '修正',
      '清空'
    ]);
  }

  function assistantTextExplicitlyResolvesWriteWithoutExecution(text) {
    var raw = text === undefined || text === null ? '' : String(text).trim();
    if (!raw) return false;
    if (containsAny(raw, [
      '当前还没有实际执行修改',
      '尚未改为',
      '还未改为',
      '任务尚未完成',
      '未返回必要的写操作',
      '还没有重新读取结果确认',
      '仍有',
      '未继续收敛'
    ])) return false;
    return containsAny(raw, [
      '无需修改',
      '无需更改',
      '不用修改',
      '不需要修改',
      '原本已符合预期',
      '原本已经符合预期',
      '未找到',
      '不存在',
      '无法执行',
      '能力不可用',
      '缺少',
      '用户拒绝',
      '用户取消',
      '未执行对子项',
      '未执行修改',
      '未执行对'
    ]);
  }

  function assistantProtocolCallsIncludeWrite(calls) {
    var list = Array.isArray(calls) ? calls : [];
    var i = 0;
    for (i = 0; i < list.length; i += 1) {
      var row = list[i] && typeof list[i] === 'object' ? list[i] : {};
      var capabilityId = normalizeMcpToolName(row.capability || row.tool || row.name || '');
      if (capabilityId && getMcpToolMode(capabilityId) === 'write') return true;
    }
    return false;
  }

  function assistantTaskStateRequiresWrite(taskState) {
    var state = taskState && typeof taskState === 'object' ? taskState : null;
    var steps = state && Array.isArray(state.steps) ? state.steps : [];
    var i = 0;
    if (!state) return false;
    if (assistantTextIndicatesWriteIntent(state.title || '')) return true;
    if (assistantTextIndicatesWriteIntent(state.summary || '')) return true;
    for (i = 0; i < steps.length; i += 1) {
      var step = steps[i] && typeof steps[i] === 'object' ? steps[i] : {};
      if (step.capabilityId && getMcpToolMode(step.capabilityId) === 'write') return true;
      if (assistantTextIndicatesWriteIntent(step.label || '')) return true;
      if (assistantTextIndicatesWriteIntent(step.description || '')) return true;
    }
    return false;
  }

  function assistantProtocolRequiresWrite(protocol) {
    var data = protocol && typeof protocol === 'object' ? protocol : null;
    var task = data && data.task && typeof data.task === 'object' ? data.task : null;
    var steps = task && Array.isArray(task.steps) ? task.steps : [];
    var i = 0;
    if (!data) return false;
    if (assistantProtocolCallsIncludeWrite(data.calls)) return true;
    if (task) {
      if (assistantTextIndicatesWriteIntent(task.title || '')) return true;
      if (assistantTextIndicatesWriteIntent(task.summary || '')) return true;
      for (i = 0; i < steps.length; i += 1) {
        var step = steps[i] && typeof steps[i] === 'object' ? steps[i] : {};
        if (assistantTextIndicatesWriteIntent(step.label || '')) return true;
        if (assistantTextIndicatesWriteIntent(step.description || '')) return true;
      }
    }
    return assistantTextIndicatesWriteIntent(buildAssistantProtocolResultText(data.message, data.blocks));
  }

  function assistantBuildPendingWriteRequirement(userText, observations, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var requiresWrite = opts.requiresWrite === true;
    var hasSuccessfulWriteCall = opts.hasSuccessfulWriteCall === true;
    var protocol = opts.protocol && typeof opts.protocol === 'object' ? opts.protocol : null;
    var protocolText = protocol ? buildAssistantProtocolResultText(protocol.message, protocol.blocks) : '';
    var fallbackText = opts.fallbackText === undefined || opts.fallbackText === null ? '' : String(opts.fallbackText).trim();
    if (!requiresWrite || hasSuccessfulWriteCall) return null;
    if (assistantTextExplicitlyResolvesWriteWithoutExecution(protocolText)) return null;
    if (assistantTextExplicitlyResolvesWriteWithoutExecution(fallbackText)) return null;
    return {
      instruction: '当前任务属于实际写操作，但现有 observation 里还没有成功的写 capability。若读取后判断原本已符合预期，请直接明确说明“无需修改”；若目标不存在、范围越界或能力缺失，也要明确说明未执行原因；否则必须返回新的写 calls，不能只重复读取或直接结束。',
    };
  }

  async function callAssistantProtocolModel(userText, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var apis = getApis();
    var content = String(userText || '');
    var taskUserText = opts.taskUserText === undefined || opts.taskUserText === null ? '' : String(opts.taskUserText).trim();
    var contentBlocks = normalizeAssistantContentBlocks(opts.contentBlocks);
    var hasImageInput = assistantContentBlocksHaveImage(contentBlocks);
    var capabilities = buildAssistantCapabilityCatalogLines();
    var capabilityList = getAvailableCapabilities();
    var pageData = null;
    var platformContextMarkdown = '';
    var runtimeContext = null;
    var payload = null;
    var prompt = '';
    var res = null;
    var forceNoCalls = opts.forceNoCalls === true;
    var blockedCalls = Array.isArray(opts.blockedCalls) ? opts.blockedCalls : [];
    var pendingWriteRequirement = null;
    var extraInstructions = Array.isArray(opts.extraInstructions) ? opts.extraInstructions.filter(function(item) { return !!String(item || '').trim(); }) : [];
    if (!apis.assistantApi || typeof apis.assistantApi.callModel !== 'function') return null;
    if (apis.assistantApi && typeof apis.assistantApi.getPageData === 'function') {
      try {
        pageData = apis.assistantApi.getPageData('') || {};
      } catch (err0) {
        pageData = {};
      }
    }
    platformContextMarkdown = await loadAssistantPlatformContextMarkdown();
    payload = {
      protocolVersion: 'assistant_v2',
      userText: content,
      latestUserText: content,
      taskUserText: taskUserText || content,
      currentPage: {
        tab: pageData && pageData.tab ? String(pageData.tab) : '',
        tabLabel: getTabLabelById(pageData && pageData.tab ? String(pageData.tab) : '') || '',
        pageFileName: getPageFileName(),
        pageData: pageData && typeof pageData === 'object' ? pageData : {},
      },
      capabilities: capabilityList,
      pendingInteraction: clonePendingInteraction(opts.pendingInteraction),
      selectedChoice: opts.selectedChoice && typeof opts.selectedChoice === 'object' ? JSON.parse(JSON.stringify(opts.selectedChoice)) : null,
      observations: Array.isArray(opts.observations) ? opts.observations : [],
      forceNoCalls: forceNoCalls,
      blockedCalls: blockedCalls.map(function(call) {
        var row = call && typeof call === 'object' ? call : {};
        return {
          capability: normalizeMcpToolName(row.capability || row.tool || row.name || ''),
          args: row.args && typeof row.args === 'object' ? JSON.parse(JSON.stringify(row.args)) : {},
        };
      }),
    };
    runtimeContext = buildAssistantRuntimeContext(payload.currentPage, capabilityList);
    payload.platformContextMarkdown = platformContextMarkdown;
    payload.runtimeContext = runtimeContext;
    pendingWriteRequirement = assistantBuildPendingWriteRequirement(content, payload.observations, {
      taskUserText: taskUserText || content,
    });
    if (pendingWriteRequirement && pendingWriteRequirement.instruction) {
      extraInstructions.push(pendingWriteRequirement.instruction);
      payload.pendingWriteRequirement = {
        targetValue: pendingWriteRequirement.targetValue,
        caseIndex: pendingWriteRequirement.caseIndex,
        unmetCount: pendingWriteRequirement.unmetCount,
      };
    }
    prompt = [
      '你是测试助手平台内置 AI 助手，采用 assistant_v2 协议工作。',
      '原则：由你自己理解用户意图、判断是否直接回答、是否拆任务、选择哪项能力执行。不要依赖平台预设流程。',
      '你只能使用能力清单里出现的 capability；不要编造新的 capability 名称。',
      '若不需要执行能力，直接返回单个 JSON：{"protocolVersion":"assistant_v2","message":"...","blocks":[]}',
      '若需要执行能力，返回单个 JSON：{"protocolVersion":"assistant_v2","message":"...","task":{"title":"...","summary":"...","steps":[{"id":"step-1","label":"中文步骤"}]},"calls":[{"stepId":"step-1","capability":"...","args":{}}]}',
      'blocks 仅支持：notice、choice_list、content_list、code_block。',
      '所有步骤标题必须是中文任务描述，不能直接把 capability 名当作步骤标题。',
      '若返回 task.steps，每个 step.label 都必须是可直接展示给用户的中文任务，如“获取当前页面信息”“读取当前页面用例列表”；不要输出“执行任务”“步骤1”“step-1”这类泛化标题。',
      '如果用户意图、目标对象、目标范围、目标值或前置条件仍不明确，不要猜测，不要自行补默认值；先向用户提出最小必要的澄清问题。',
      '澄清时不要返回 calls，也不要开始执行；直接返回 message，并附带一个 notice block，title 固定为“需要补充信息”，text 写清楚你缺少什么信息、需要用户确认什么。',
      '如果一次澄清后信息仍不够，继续追问，直到可以准确回答或准确执行；禁止在信息不足时自行假设目标对象、范围或参数。',
      '任何新建、编辑、删除类操作都会被运行时拦截并要求用户确认；你不需要伪造“已执行成功”。',
      '平台每轮都会提供两类上下文：`platformContextMarkdown` 是固定平台说明，`runtimeContext` 是当前页面、当前页关键数据、当前页重点能力和可见页签摘要。你必须优先使用这些上下文，不要重复向用户确认其中已经明确给出的事实。',
      '若 `runtimeContext.currentPage.tab` 非空，不要再问“当前在哪个页面”或“是否在执行页”；只有该字段缺失、为空、明显失真，或用户明确要求切换页面时，才可以澄清或调用 page.current_info / nav.switch_tab。',
      '若 `currentPage.pageData.currentCaseContext` 或 `runtimeContext.currentPage.knownFacts` 已提供当前文件名、可见条数、总条数、是否含复用用例等事实，不要再向用户重复确认这些信息；只有字段缺失时，才进一步读取或澄清。',
      '平台已经把 currentPage 提供给你；除非用户明确要求确认当前页，或你确实缺少关键页面事实，否则不要把 page.current_info 当作默认第一步，更不要重复调用它。',
      '当用户要求修改当前执行用例的执行结果、状态、备注等写操作，且 currentPage.tab 已是 tempexec 时，优先直接规划 cases.list_current（如需先判断现状）和 case.update / case_library.batch_update_exec_results；不要只读取页面名称。',
      '当 cases.list_current 返回 caseFile.reuseEnabled、caseFile.hasReuseCases、caseFile.reusePresetCount、caseFile.reusePresetNames、hasReuseCases、items[].isReuseCase、items[].reuseDetailCount、items[].reuseDetails 时，你必须先判断当前目标是否为复用型用例。',
      '复用型用例不要只看原始 actual/status/result 字段；要以 items[].reuseDetails[].status 聚合判断执行结果。items[].executionResult 是平台按子项聚合后的快捷结果，但你在解释原因、判断是否已符合要求、以及选择写能力时，仍应以 reuseDetails 为准。',
      '复用型用例中，每条用例的 reuseDetailCount 和 reuseDetails 长度可能不同；你必须检查目标范围内每一条用例的全部子项，不能只看第一个子项。',
      '如需判断当前复用文件有哪些预设子项，可结合 caseFile.reusePresetNames 与各条用例的 items[].reuseDetails[].text 一起判断。',
      '复用型用例执行结果聚合规则：任一子项为“失败”则整条为失败；否则任一子项为“阻塞”则整条为阻塞；否则任一子项为“未执行”或空则整条为未执行；否则只要有通过则整条为通过；否则若仅剩不适用则整条为不适用。',
      '如果当前执行文件或命中的用例包含复用子项，而用户要修改执行结果，优先使用 tempexec.reuse_update；整份复用文件或全部匹配项改状态时，常用参数是 {"field":"actual","applyAll":true,"value":"目标状态"}。不要只改 case.update / case_library.batch_update_exec_results 的顶层结果字段。',
      '如果用户指定的是某一条复用用例，但没有直接给出序号，可以在 tempexec.reuse_update 里传 caseQuery 或 caseTitle 缩小到该条用例，再配合 detailName / detailIndex 执行，不要强行退回整份文件批量修改。',
      '当 observations 非空时，表示前面步骤刚执行完，请基于观察继续决定下一步或输出最终答复。',
      '如果 observations 里的 read 能力结果已经足够回答用户，就直接输出最终答复，并明确写出关键事实；不要只说“我已了解当前页面情况”这类空话。',
      '如果用户明确指定第 N 条用例或第 N 个目标，而 observations 已显示当前总数小于 N，直接明确说明“当前只有 X 条，未找到第 N 条，因此未执行修改”，不要继续重复读取，也不要伪造已完成。',
      '对于“先检查当前状态再决定是否修改”的请求，你的最终答复必须明确给出三种结果之一：1）原本已符合预期，无需更改；2）已按要求全部更改完成；3）只对不符合要求的部分完成了补齐或修正。不要只写笼统的“已处理”或“执行完成”。',
      '如果 observations 同时包含读取现状和写入结果，要基于读取前后的事实自己判断属于哪一种结果，并在 message 中直接告诉用户。',
      '若写入 observation 里已有 selectedCaseCount、updatedCount、scope、detailName、value 等字段，请用这些事实总结“全部改完”还是“只补齐了部分”。',
      '不要重复返回已经成功执行过的相同 capability 和参数；若 observations 已包含结果，请直接汇总，或只返回尚未执行的新 calls。',
      blockedCalls.length ? '以下 calls 刚刚已经执行过，禁止原样再次返回；你必须改为返回新的 calls，或直接输出最终答复：\n' + buildAssistantProtocolBlockedCallLines(blockedCalls).join('\n') : '',
      '当 pendingInteraction 存在时，说明流程正在等待用户选择或补充信息；优先结合 selectedChoice、pendingInteraction.kind、pendingInteraction.prompt 继续，不要忽略它。',
      '当 pendingInteraction.kind === "model_clarify" 时，优先把最新用户消息理解为对上一轮澄清问题的回答；只有在用户明显开启新话题时，才忽略这轮澄清上下文。',
      '当 pendingInteraction.kind === "model_clarify" 且 pendingInteraction.sourceUserText 存在时，要把它视为当前续跑的原始任务；若最新用户消息只是“当前页面的”“全部的”“第2条”“就改222”这类范围补充，不要把这句短回复改写成新的无关请求。',
      '当 taskUserText 存在时，它表示当前这轮在原始请求基础上结合补充信息后的任务语义；如果 latestUserText 只是短回复、范围限定或确认语，请结合 taskUserText 决定下一步，不要只盯着 latestUserText 单独行动。',
      '若能力缺失或执行受阻，可输出 notice block 解释原因，并改为澄清、备选方案或最终答复。',
      forceNoCalls ? '当前这一轮禁止再返回 calls；你必须直接基于 observations 输出最终答复，明确写出你已得到的事实，并明确归类为：无需更改 / 已全部更改完成 / 已补齐部分缺漏 之一。' : '',
      extraInstructions.length ? ('运行时附加要求：\n' + extraInstructions.map(function(item) { return '- ' + String(item); }).join('\n')) : '',
      platformContextMarkdown ? '固定平台上下文已通过 payload.platformContextMarkdown 提供。' : '',
      runtimeContext && runtimeContext.currentPage && Array.isArray(runtimeContext.currentPage.knownFacts) && runtimeContext.currentPage.knownFacts.length
        ? ('当前页面动态事实摘要：\n' + runtimeContext.currentPage.knownFacts.map(function(item) { return '- ' + String(item); }).join('\n'))
        : '',
      '可用能力目录：',
      capabilities.join('\n'),
      hasImageInput ? '用户附带图片，请先理解图片内容，再决定是否调用能力。' : '',
      '只输出一个 JSON 对象，不要代码块。',
    ].filter(function(line) { return !!line; }).join('\n');
    try {
      res = await apis.assistantApi.callModel(JSON.stringify(payload, null, 2), {
        prompt: buildConversationPromptWithPriority(prompt, content, {
          pendingInteraction: opts.pendingInteraction,
        }),
        temperature: 0.1,
        history: opts.history || buildConversationHistory(conversationHistoryLimit, content),
        contentBlocks: contentBlocks,
      });
    } catch (err) {
      res = null;
    }
    if (!res || res.ok !== true || !res.content) return null;
    return normalizeAssistantProtocolResponse(String(res.content || ''), content);
  }

  function buildAssistantCapabilityApprovalLabel(capabilityId) {
    var capability = getAssistantCapabilityById(capabilityId);
    if (capability && capability.description) return capability.description;
    return capabilityId || '操作';
  }

  async function executeAssistantCapabilityWithRuntimeGate(capabilityId, args) {
    var apis = getApis();
    var id = normalizeMcpToolName(capabilityId);
    var payload = args && typeof args === 'object' ? Object.assign({}, args) : {};
    var result = null;
    var approvedArgs = null;
    if (!apis.assistantCapabilityApi || typeof apis.assistantCapabilityApi.executeCapability !== 'function') {
      return {
        ok: false,
        status: 'missing_capability',
        message: '能力执行器暂不可用：' + id,
        data: null,
        choices: [],
        approvedArgs: null,
      };
    }
    result = await apis.assistantCapabilityApi.executeCapability(id, payload);
    while (result && result.status === 'confirm_required') {
      approvedArgs = result.approvedArgs && typeof result.approvedArgs === 'object' ? Object.assign({}, result.approvedArgs) : Object.assign({}, payload, { confirmed: true });
      var approvalLabel = result.data && result.data.actionLabel ? String(result.data.actionLabel) : buildAssistantCapabilityApprovalLabel(id);
      var allowed = await requestAssistantOperationApproval(approvalLabel, {
        detail: result.message || '',
        reason: '当前操作涉及新建、编辑、删除或其它写入行为。',
      });
      if (!allowed) {
        return {
          ok: false,
          status: 'blocked',
          message: '用户拒绝了本次操作。',
          data: result.data || null,
          choices: [],
          approvedArgs: approvedArgs,
        };
      }
      payload = approvedArgs;
      result = await apis.assistantCapabilityApi.executeCapability(id, payload);
    }
    return result;
  }

  function buildAssistantProtocolResultText(message, blocks) {
    var text = message === undefined || message === null ? '' : String(message).trim();
    var normalizedBlocks = normalizeAssistantBlocks(blocks);
    if (text) return text;
    if (normalizedBlocks.length && normalizedBlocks[0].type === 'notice' && normalizedBlocks[0].text) return String(normalizedBlocks[0].text);
    if (normalizedBlocks.length && normalizedBlocks[0].type === 'choice_list' && normalizedBlocks[0].prompt) return String(normalizedBlocks[0].prompt);
    return '';
  }

  function normalizeMcpToolName(rawName) {
    var raw = rawName === undefined || rawName === null ? '' : String(rawName).trim().toLowerCase();
    if (!raw) return '';
    raw = raw.replace(/\s+/g, '_').replace(/-/g, '_');
    if (raw === 'page.current_info' || raw === 'current_page_info' || raw === 'page.info') return 'page.current_info';
    if (raw === 'page.get_data' || raw === 'query_page_data' || raw === 'page_data') return 'page.get_data';
    if (raw === 'nav.switch_tab' || raw === 'navigate' || raw === 'switch_tab') return 'nav.switch_tab';
    if (raw === 'cases.list_current' || raw === 'query_case_list' || raw === 'case_list' || raw === 'case_library.query_exec_cases' || raw === 'case_library_query_exec_cases' || raw === 'query_exec_cases' || raw === 'list_exec_cases' || raw === 'case_library.list_exec_cases' || raw === 'case_library_list_exec_cases' || raw === 'case_library.search_case_candidates' || raw === 'case_library_search_case_candidates' || raw === 'search_case_candidates' || raw === 'search_case_candidate' || raw === 'case_library.get_case_detail' || raw === 'case_library_get_case_detail' || raw === 'get_case_detail' || raw === 'query_case_detail') return 'cases.list_current';
    if (raw === 'case_library.query_cases' || raw === 'case_library_query_cases' || raw === 'query_case_library_cases' || raw === 'search_case_library_cases' || raw === 'case_library_search_case_content' || raw === 'search_case_content') return 'case_library.query_cases';
    if (raw === 'missing_library.list_current' || raw === 'missing_library_list_current' || raw === 'list_missing_library' || raw === 'missing_case_library_list') return 'missing_library.list_current';
    if (raw === 'cross_page.match_missing_cases' || raw === 'cross_page_match_missing_cases' || raw === 'match_missing_cases' || raw === 'match_case_missing_library') return 'cross_page.match_missing_cases';
    if (raw === 'case_library.search_exec_candidates' || raw === 'case_library_search_exec_candidates' || raw === 'search_case_files_for_exec' || raw === 'search_exec_candidates' || raw === 'case_library.search_exec_cases' || raw === 'case_library_search_exec_cases' || raw === 'search_exec_cases') return 'case_library.search_exec_candidates';
    if (raw === 'case_library.transfer_to_exec' || raw === 'case_library_transfer_to_exec' || raw === 'transfer_to_exec' || raw === 'transfer_case_to_exec' || raw === 'exec_case_file') return 'case_library.transfer_to_exec';
    if (raw === 'tempexec.remove_files' || raw === 'tempexec_remove_files' || raw === 'remove_exec_files' || raw === 'remove_from_exec' || raw === 'remove_current_exec_files' || raw === 'case_library.remove_exec_files' || raw === 'case_library_remove_exec_files' || raw === 'case_library.batch_remove_exec_cases' || raw === 'case_library_batch_remove_exec_cases' || raw === 'batch_remove_exec_cases') return 'tempexec.remove_files';
    if (raw === 'tempexec.reuse_update' || raw === 'tempexec_reuse_update' || raw === 'update_reuse_case' || raw === 'reuse_update' || raw === 'reuse_case_update' || raw === 'tempexec.update_reuse' || raw === 'case_library.batch_operate_reuse_sub_items' || raw === 'case_library_batch_operate_reuse_sub_items' || raw === 'batch_operate_reuse_sub_items' || raw === 'case_library.operate_reuse_sub_items' || raw === 'case_library_operate_reuse_sub_items' || raw === 'operate_reuse_sub_items' || raw === 'batch_operate_reuse_sub_item' || raw === 'operate_reuse_sub_item') return 'tempexec.reuse_update';
    if (raw === 'case_library.batch_update_exec_results' || raw === 'case_library_batch_update_exec_results' || raw === 'batch_update_exec_results' || raw === 'update_exec_results' || raw === 'case_library.batch_set_exec_results' || raw === 'case_library_batch_set_exec_results' || raw === 'batch_set_exec_results' || raw === 'set_exec_results' || raw === 'set_exec_result') return 'case_library.batch_update_exec_results';
    if (raw === 'case_library.batch_archive_exec_cases' || raw === 'case_library_batch_archive_exec_cases' || raw === 'batch_archive_exec_cases' || raw === 'archive_exec_cases' || raw === 'case_library.batch_archive_cases' || raw === 'case_library_batch_archive_cases' || raw === 'batch_archive_cases' || raw === 'archive_cases') return 'case_library.batch_archive_exec_cases';
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
    if (containsAny(tool, ['nav.switch_tab', 'ui.click_control', 'ui.fill_input', 'tempexec.export_xmind', 'tempexec.remove_files', 'tempexec.reuse_update', 'settings.patch', 'case.update', 'case.delete', 'casegen.run', 'missing_recommend.run', 'memo.add', 'memo.toggle', 'memo.remove', 'case_library.batch_update_exec_results', 'case_library.batch_archive_exec_cases'])) {
      return 'write';
    }
    return 'read';
  }

  function hasExecTransferMcpCall(mcpCalls) {
    var calls = Array.isArray(mcpCalls) ? mcpCalls : [];
    for (var i = 0; i < calls.length; i += 1) {
      var call = calls[i] && typeof calls[i] === 'object' ? calls[i] : {};
      var tool = normalizeMcpToolName(call.tool || call.name || '');
      if (tool === 'case_library.search_exec_candidates' || tool === 'case_library.transfer_to_exec') return true;
    }
    return false;
  }


  function getExecTransferCaseFileIdFromArgs(args) {
    var payload = args && typeof args === 'object' ? args : {};
    if (payload.caseFileId !== undefined && payload.caseFileId !== null && String(payload.caseFileId).trim()) {
      return String(payload.caseFileId).trim();
    }
    if (payload.id !== undefined && payload.id !== null && String(payload.id).trim()) {
      return String(payload.id).trim();
    }
    return '';
  }

  function hasIncompleteExecTransferMcpPlan(mcpCalls) {
    var calls = Array.isArray(mcpCalls) ? mcpCalls : [];
    for (var i = 0; i < calls.length; i += 1) {
      var call = calls[i] && typeof calls[i] === 'object' ? calls[i] : {};
      var tool = normalizeMcpToolName(call.tool || call.name || '');
      var args = call.args && typeof call.args === 'object' ? call.args : {};
      if (tool === 'case_library.transfer_to_exec' && !getExecTransferCaseFileIdFromArgs(args)) {
        return true;
      }
    }
    return false;
  }

  function hasCaseUpdateMcpCall(mcpCalls) {
    var calls = Array.isArray(mcpCalls) ? mcpCalls : [];
    for (var i = 0; i < calls.length; i += 1) {
      var call = calls[i] && typeof calls[i] === 'object' ? calls[i] : {};
      var tool = normalizeMcpToolName(call.tool || call.name || '');
      if (tool === 'case.update' || tool === 'tempexec.reuse_update' || tool === 'case_library.batch_update_exec_results') return true;
    }
    return false;
  }

  function hasArchiveMcpCall(mcpCalls) {
    var calls = Array.isArray(mcpCalls) ? mcpCalls : [];
    for (var i = 0; i < calls.length; i += 1) {
      var call = calls[i] && typeof calls[i] === 'object' ? calls[i] : {};
      var tool = normalizeMcpToolName(call.tool || call.name || '');
      var args = call.args && typeof call.args === 'object' ? call.args : {};
      var inspectText = [
        args.controlId,
        args.controlText,
        args.text,
        args.label,
        args.name,
        args.query,
      ].join(' ');
      if (tool === 'case_library.batch_archive_exec_cases') return true;
      if (tool === 'ui.click_control' && containsAny(inspectText, ['归档', 'archive'])) return true;
    }
    return false;
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

  function buildAssistantPlanArgSignature(value) {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (Array.isArray(value)) {
      return '[' + value.map(function(item) { return buildAssistantPlanArgSignature(item); }).join(',') + ']';
    }
    if (typeof value === 'object') {
      var keys = Object.keys(value).sort();
      return '{' + keys.map(function(key) {
        return JSON.stringify(key) + ':' + buildAssistantPlanArgSignature(value[key]);
      }).join(',') + '}';
    }
    return JSON.stringify(value);
  }

  function dedupeAssistantMcpCalls(calls) {
    var list = Array.isArray(calls) ? calls : [];
    var seen = {};
    var out = [];
    list.forEach(function(item) {
      var row = item && typeof item === 'object' ? item : null;
      var key = '';
      if (!row) return;
      key = normalizeMcpToolName(row.tool || row.name || '') + '|' + buildAssistantPlanArgSignature(row.args && typeof row.args === 'object' ? row.args : {});
      if (seen[key]) return;
      seen[key] = true;
      out.push(row);
    });
    return out;
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
    return dedupeAssistantMcpCalls(calls);
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

  function buildCrossPageReasonMatchItem(item, idx) {
    var row = item && typeof item === 'object' ? item : {};
    var currentCase = row.currentCase && typeof row.currentCase === 'object' ? row.currentCase : {};
    var missingItem = row.missingItem && typeof row.missingItem === 'object' ? row.missingItem : {};
    var keywordHits = row.keywordHits && typeof row.keywordHits === 'object' ? row.keywordHits : {};
    return {
      index: row.index === undefined || row.index === null ? (idx + 1) : row.index,
      score: Number(row.score) || 0,
      matchLevel: row.matchLevel ? String(row.matchLevel) : '',
      candidateLevel: row.candidateLevel ? String(row.candidateLevel) : '',
      strictMatched: row.strictMatched === true,
      fieldHitCount: Number(row.fieldHitCount) || 0,
      moduleHitCount: Number(row.moduleHitCount) || 0,
      titleHitCount: Number(row.titleHitCount) || 0,
      preHitCount: Number(row.preHitCount) || 0,
      stepHitCount: Number(row.stepHitCount) || 0,
      expectedHitCount: Number(row.expectedHitCount) || 0,
      reasons: Array.isArray(row.reasons) ? row.reasons.slice(0, 4) : [],
      keywordHits: {
        module: Array.isArray(keywordHits.module) ? keywordHits.module.slice(0, 2) : [],
        title: Array.isArray(keywordHits.title) ? keywordHits.title.slice(0, 4) : [],
        precondition: Array.isArray(keywordHits.precondition) ? keywordHits.precondition.slice(0, 3) : [],
        steps: Array.isArray(keywordHits.steps) ? keywordHits.steps.slice(0, 4) : [],
        expected: Array.isArray(keywordHits.expected) ? keywordHits.expected.slice(0, 4) : [],
      },
      currentCase: {
        index: currentCase.index === undefined || currentCase.index === null ? '' : currentCase.index,
        id: currentCase.id === undefined || currentCase.id === null ? '' : String(currentCase.id),
        module: trimMcpReasonField(currentCase.module, 60),
        title: trimMcpReasonField(currentCase.title, 100),
        priority: currentCase.priority === undefined || currentCase.priority === null ? '' : String(currentCase.priority),
        precondition: trimMcpReasonField(currentCase.precondition, 120),
        steps: trimMcpReasonField(currentCase.steps, 180),
        expected: trimMcpReasonField(currentCase.expected, 180),
      },
      missingItem: {
        index: missingItem.index === undefined || missingItem.index === null ? '' : missingItem.index,
        id: missingItem.id === undefined || missingItem.id === null ? '' : String(missingItem.id),
        module: trimMcpReasonField(missingItem.module, 60),
        typeLabel: trimMcpReasonField(missingItem.typeLabel, 40),
        title: trimMcpReasonField(missingItem.title, 100),
        priority: missingItem.priority === undefined || missingItem.priority === null ? '' : String(missingItem.priority),
        precondition: trimMcpReasonField(missingItem.precondition, 120),
        steps: trimMcpReasonField(missingItem.steps, 180),
        expected: trimMcpReasonField(missingItem.expected, 180),
      },
    };
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
      var isReuseFile = sourceData.caseFile && (sourceData.caseFile.reuseEnabled === true || sourceData.caseFile.hasReuseCases === true);
      var reusePresetNames = sourceData.caseFile && Array.isArray(sourceData.caseFile.reusePresetNames)
        ? sourceData.caseFile.reusePresetNames.map(function(item) {
            return item === undefined || item === null ? '' : String(item).trim();
          }).filter(Boolean)
        : [];
      var reuseCaseCount = 0;
      items.forEach(function(item) {
        var row = item && typeof item === 'object' ? item : {};
        if (row.isReuseCase === true || isReuseFile || Number(row.reuseDetailCount || 0) > 0 || (Array.isArray(row.reuseDetails) && row.reuseDetails.length > 0)) {
          reuseCaseCount += 1;
        }
      });
      var compactItems = items.slice(0, maxItems).map(function(item, idx) {
        var row = item && typeof item === 'object' ? item : {};
        var normalized = {
          index: row.index === undefined || row.index === null ? (idx + 1) : row.index,
          id: row.id === undefined || row.id === null ? '' : String(row.id),
          module: trimMcpReasonField(row.module, 60),
          title: trimMcpReasonField(row.title, 100),
          priority: row.priority === undefined || row.priority === null ? '' : String(row.priority),
          executionResult: trimMcpReasonField(resolveCaseExecutionResult(row), 60),
          isReuseCase: row.isReuseCase === true || isReuseFile || Number(row.reuseDetailCount || 0) > 0 || (Array.isArray(row.reuseDetails) && row.reuseDetails.length > 0),
          reuseDetailCount: Number(row.reuseDetailCount) || (Array.isArray(row.reuseDetails) ? row.reuseDetails.length : 0),
        };
        if (includeFullFields) {
          normalized.precondition = trimMcpReasonField(row.precondition !== undefined && row.precondition !== null ? row.precondition : row.preconditions, 120);
          normalized.steps = trimMcpReasonField(row.steps, 200);
          normalized.expected = trimMcpReasonField(row.expected, 200);
          normalized.remark = trimMcpReasonField(row.remark, 120);
          if (normalized.reuseDetailCount > 0) {
            normalized.reuseDetails = (Array.isArray(row.reuseDetails) ? row.reuseDetails : []).slice(0, 40).map(function(detail, detailIndex) {
              var detailRow = detail && typeof detail === 'object' ? detail : {};
              return {
                index: detailRow.index === undefined || detailRow.index === null ? (detailIndex + 1) : detailRow.index,
                id: detailRow.id === undefined || detailRow.id === null ? '' : String(detailRow.id),
                text: trimMcpReasonField(detailRow.text, 60),
                status: detailRow.status === undefined || detailRow.status === null ? '' : String(detailRow.status),
                note: trimMcpReasonField(detailRow.note, 80),
              };
            });
          }
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
          reuseEnabled: sourceData.caseFile.reuseEnabled === true,
          hasReuseCases: sourceData.caseFile.hasReuseCases === true || isReuseFile,
          reusePresetCount: Number(sourceData.caseFile.reusePresetCount) || reusePresetNames.length,
          reusePresetNames: reusePresetNames.slice(0, 40),
        } : null,
        isReuseFile: isReuseFile,
        hasReuseCases: isReuseFile || reuseCaseCount > 0,
        reuseCaseCount: reuseCaseCount,
        items: compactItems,
      };
    }
    if (name === 'case_library.query_cases') {
      var libraryItems = Array.isArray(sourceData.items) ? sourceData.items : [];
      var detailLevel = payloadArgs.detailLevel === undefined || payloadArgs.detailLevel === null
        ? (sourceData.detailLevel === undefined || sourceData.detailLevel === null ? '' : String(sourceData.detailLevel).trim().toLowerCase())
        : String(payloadArgs.detailLevel).trim().toLowerCase();
      var compactFilterInfo = buildCompactCaseListFilterInfo(sourceData.filterInfo);
      var includeFullFields = detailLevel === 'full' || Boolean(compactFilterInfo);
      var maxItems = includeFullFields ? 160 : 80;
      return {
        tool: name,
        args: payloadArgs,
        scope: sourceData.scope || '',
        projectId: sourceData.projectId || '',
        projectName: sourceData.projectName || '',
        queryText: sourceData.queryText || '',
        total: Number(sourceData.total) || libraryItems.length,
        matchedFileCount: Number(sourceData.matchedFileCount) || 0,
        searchedFileCount: Number(sourceData.searchedFileCount) || 0,
        searchedItemCount: Number(sourceData.searchedItemCount) || 0,
        projectCount: Number(sourceData.projectCount) || 0,
        truncated: sourceData.truncated === true,
        filterSummary: buildCaseListFilterLabel(sourceData.filterInfo),
        filterInfo: compactFilterInfo,
        multiAgent: sourceData.multiAgent && typeof sourceData.multiAgent === 'object' ? {
          used: sourceData.multiAgent.used === true,
          workerCount: Number(sourceData.multiAgent.workerCount) || 0,
          chunkCount: Number(sourceData.multiAgent.chunkCount) || 0,
        } : null,
        items: libraryItems.slice(0, maxItems).map(function(item, idx) {
          var row = item && typeof item === 'object' ? item : {};
          var normalized = {
            index: row.index === undefined || row.index === null ? (idx + 1) : row.index,
            id: row.id === undefined || row.id === null ? '' : String(row.id),
            projectName: trimMcpReasonField(row.projectName, 60),
            caseFileName: trimMcpReasonField(row.caseFileName, 80),
            module: trimMcpReasonField(row.module, 60),
            title: trimMcpReasonField(row.title, 100),
            priority: row.priority === undefined || row.priority === null ? '' : String(row.priority),
            matchedKeywords: Array.isArray(row.matchedKeywords) ? row.matchedKeywords.slice(0, 8) : [],
          };
          if (includeFullFields) {
            normalized.precondition = trimMcpReasonField(row.precondition !== undefined && row.precondition !== null ? row.precondition : row.preconditions, 120);
            normalized.steps = trimMcpReasonField(row.steps, 200);
            normalized.expected = trimMcpReasonField(row.expected, 200);
            normalized.remark = trimMcpReasonField(row.remark, 120);
          }
          return normalized;
        }),
      };
    }
    if (name === 'missing_library.list_current') {
      var missingItems = Array.isArray(sourceData.items) ? sourceData.items : [];
      return {
        tool: name,
        args: payloadArgs,
        scope: sourceData.scope || '',
        projectId: sourceData.projectId || '',
        totalModules: Number(sourceData.totalModules) || 0,
        totalItems: Number(sourceData.totalItems) || missingItems.length,
        total: Number(sourceData.total) || missingItems.length,
        queryText: sourceData.queryText || '',
        truncated: sourceData.truncated === true,
        items: missingItems.slice(0, 120).map(function(item, idx) {
          var row = item && typeof item === 'object' ? item : {};
          return {
            index: row.index === undefined || row.index === null ? (idx + 1) : row.index,
            id: row.id === undefined || row.id === null ? '' : String(row.id),
            module: trimMcpReasonField(row.module, 60),
            typeLabel: trimMcpReasonField(row.typeLabel, 40),
            title: trimMcpReasonField(row.title, 100),
            priority: row.priority === undefined || row.priority === null ? '' : String(row.priority),
            precondition: trimMcpReasonField(row.precondition, 120),
            steps: trimMcpReasonField(row.steps, 160),
            expected: trimMcpReasonField(row.expected, 160),
          };
        }),
      };
    }
    if (name === 'cross_page.match_missing_cases') {
      var matches = Array.isArray(sourceData.matches) ? sourceData.matches : [];
      var candidates = Array.isArray(sourceData.candidates) ? sourceData.candidates : [];
      return {
        tool: name,
        args: payloadArgs,
        projectId: sourceData.projectId || '',
        currentCaseTotal: Number(sourceData.currentCaseTotal) || 0,
        missingLibraryTotal: Number(sourceData.missingLibraryTotal) || 0,
        matchDefinition: 'matchTotal 仅表示规则高置信命中。',
        candidateDefinition: 'candidateTotal 表示宽召回候选，需结合内容做最终判断。',
        matchTotal: Number(sourceData.matchTotal) || matches.length,
        matchedCaseCount: Number(sourceData.matchedCaseCount) || 0,
        matchedMissingItemCount: Number(sourceData.matchedMissingItemCount) || 0,
        candidateTotal: Number(sourceData.candidateTotal) || candidates.length,
        candidateMatchedCaseCount: Number(sourceData.candidateMatchedCaseCount) || 0,
        candidateMatchedMissingItemCount: Number(sourceData.candidateMatchedMissingItemCount) || 0,
        truncated: sourceData.truncated === true,
        candidateTruncated: sourceData.candidateTruncated === true,
        caseFile: sourceData.caseFile && typeof sourceData.caseFile === 'object' ? {
          id: sourceData.caseFile.id || '',
          name: sourceData.caseFile.name || '',
        } : null,
        matches: matches.slice(0, 80).map(function(item, idx) {
          return buildCrossPageReasonMatchItem(item, idx);
        }),
        candidates: candidates.slice(0, 120).map(function(item, idx) {
          return buildCrossPageReasonMatchItem(item, idx);
        }),
      };
    }
    if (name === 'tempexec.reuse_update') {
      return {
        tool: name,
        args: payloadArgs,
        mode: sourceData.mode || '',
        field: sourceData.field || '',
        fileName: sourceData.fileName || '',
        detailName: sourceData.detailName || '',
        detailIndex: sourceData.detailIndex === undefined || sourceData.detailIndex === null ? 0 : Number(sourceData.detailIndex),
        value: sourceData.value || '',
        scope: sourceData.scope || '',
        query: sourceData.query || '',
        all: sourceData.all === true,
        selectedCaseCount: Number(sourceData.selectedCaseCount) || 0,
        updatedCount: Number(sourceData.updatedCount) || 0,
        caseIndexes: Array.isArray(sourceData.caseIndexes) ? sourceData.caseIndexes.slice(0, 80) : [],
        detailNames: Array.isArray(sourceData.detailNames) ? sourceData.detailNames.slice(0, 40) : [],
        caseLabels: Array.isArray(sourceData.caseLabels) ? sourceData.caseLabels.slice(0, 40) : [],
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
      '- 若工具结果是跨页面匹配（如当前用例 vs 漏测用例库），先回答是否命中与命中数量，再展示最关键的匹配依据。',
      '- 对于 cross_page.match_missing_cases：matchTotal 仅表示规则高置信命中，candidateTotal 表示规则宽召回候选；不要把 matchTotal=0 直接回答成“没有相关用例”。',
      '- 当 cross_page.match_missing_cases 提供 candidates 时，你需要结合 currentCase、missingItem、reasons 自主判断哪些候选很可能相关、哪些只是建议补看，并明确区分“规则命中”和“模型建议关注”。',
      '- 只有用户明确要求“列表/明细/逐条”，或你判断表格/列表更清晰时，才输出列表或表格。',
      '- 若输出 JSON，必须只输出一个 JSON 对象，不要代码块。',
      '- 输出中文自然语言，可用 Markdown。',
    ].join('\n');
    var history = buildConversationHistory(8, userText);
    var res = null;
    try {
      res = await apis.assistantApi.callModel(JSON.stringify(payload, null, 2), {
        prompt: buildConversationPromptWithPriority(prompt, userText),
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

  function getAssistantMcpToolDefinition(toolName) {
    var normalized = normalizeMcpToolName(toolName);
    var tools = getAvailableMcpTools();
    var i = 0;
    if (!normalized) return null;
    if (!Array.isArray(tools)) return null;
    for (i = 0; i < tools.length; i += 1) {
      var row = tools[i] && typeof tools[i] === 'object' ? tools[i] : {};
      if (normalizeMcpToolName(row.name || '') === normalized) return row;
    }
    return null;
  }

  function trimAssistantTaskLabelText(text, maxLen) {
    return trimConversationHistoryReferenceText(text, maxLen || 32);
  }

  function buildAssistantTaskStepLabelFromMcpCall(call, userText) {
    var item = call && typeof call === 'object' ? call : {};
    var tool = normalizeMcpToolName(item.tool || item.name || item.capability || '');
    var args = item.args && typeof item.args === 'object' ? Object.assign({}, item.args) : {};
    var def = getAssistantMcpToolDefinition(tool);
    var capability = getAssistantCapabilityById(tool);
    var description = capability && capability.description
      ? String(capability.description)
      : (def && def.description ? String(def.description) : '');
    var friendlyLabel = buildAssistantFriendlyTaskLabel(tool, args);
    var fallbackLabel = !description ? buildAssistantUnknownToolTaskLabel(tool, args) : '';
    var label = friendlyLabel || description || fallbackLabel || '执行任务';
    var detail = '';
    if (!friendlyLabel) {
      if (args.query !== undefined && args.query !== null && String(args.query).trim()) detail = trimAssistantTaskLabelText(args.query, 24);
      else if (args.tab !== undefined && args.tab !== null && String(args.tab).trim()) detail = trimAssistantTaskLabelText(getTabLabelById(String(args.tab)) || String(args.tab), 18);
      else if (args.scaffold !== undefined && args.scaffold !== null && String(args.scaffold).trim()) detail = trimAssistantTaskLabelText(String(args.scaffold), 18);
      else if (args.name !== undefined && args.name !== null && String(args.name).trim()) detail = trimAssistantTaskLabelText(String(args.name), 18);
      else if (args.field !== undefined && args.field !== null && String(args.field).trim()) detail = trimAssistantTaskLabelText(String(args.field), 18);
    }
    if (detail) label += '：' + detail;
    return trimAssistantTaskLabelText(label, 42);
  }

  function buildAssistantTaskStepLabelFromAction(actionPayload) {
    var payload = actionPayload && typeof actionPayload === 'object' ? actionPayload : {};
    var action = normalizeModelActionName(payload.action || payload.name || '');
    var map = {
      navigate: '切换页面',
      query_case_list: '读取当前用例列表',
      query_page_data: '读取页面数据',
      current_page_info: '识别当前页面',
      web_search: '联网搜索',
      memo_list: '读取备忘列表',
      memo_add: '新增备忘',
      memo_toggle: '更新备忘状态',
      memo_remove: '删除备忘',
      settings_patch: '修改设置',
      settings_describe: '查看设置说明',
      update_case: '修改用例',
      delete_case: '删除用例',
      run_case_generation: '触发用例生成',
      run_missing_recommendation: '触发漏测推荐'
    };
    var label = map[action] || action || '执行动作';
    var detail = '';
    if (payload.query !== undefined && payload.query !== null && String(payload.query).trim()) detail = trimAssistantTaskLabelText(String(payload.query), 24);
    else if (payload.tab !== undefined && payload.tab !== null && String(payload.tab).trim()) detail = trimAssistantTaskLabelText(getTabLabelById(String(payload.tab)) || String(payload.tab), 18);
    else if (payload.field !== undefined && payload.field !== null && String(payload.field).trim()) detail = trimAssistantTaskLabelText(String(payload.field), 18);
    if (detail) label += '：' + detail;
    return trimAssistantTaskLabelText(label, 42);
  }

  function buildAssistantTaskPlanKey(type, plan) {
    var item = plan && typeof plan === 'object' ? plan : {};
    var normalizedType = type === 'action' ? 'action' : 'mcp';
    var normalizedName = normalizedType === 'action'
      ? normalizeModelActionName(item.action || item.name || '')
      : normalizeMcpToolName(item.tool || item.name || '');
    if (!normalizedName) return '';
    return normalizedType + ':' + normalizedName;
  }

  function findReusableAssistantTaskPreviewStepIndex(taskState, planKey) {
    var state = taskState && typeof taskState === 'object' ? taskState : null;
    var steps = state && Array.isArray(state.steps) ? state.steps : [];
    var fallbackIndex = -1;
    var i = 0;
    for (i = 0; i < steps.length; i += 1) {
      var step = steps[i] && typeof steps[i] === 'object' ? steps[i] : null;
      if (!step || step.preview !== true) continue;
      if (step.status && step.status !== 'waiting') continue;
      if (planKey && step.planKey && step.planKey === planKey) return i;
      if (fallbackIndex < 0) fallbackIndex = i;
    }
    return fallbackIndex;
  }

  function deriveAssistantTaskStateStatus(taskState) {
    var steps = taskState && Array.isArray(taskState.steps) ? taskState.steps : [];
    if (!steps.length) return normalizeAssistantTaskStatus(taskState && taskState.status) || 'running';
    if (steps.some(function(step) { return step && step.status === 'blocked'; })) return 'blocked';
    if (steps.some(function(step) { return step && step.status === 'running'; })) return 'running';
    if (steps.some(function(step) { return step && step.status === 'waiting'; })) return 'waiting';
    if (steps.some(function(step) { return step && step.status === 'cancelled'; })) return 'cancelled';
    return 'completed';
  }

  function appendAssistantTaskPlans(taskState, type, plans, options) {
    var state = cloneAssistantTaskState(taskState);
    var list = Array.isArray(plans) ? plans : [];
    var opts = options && typeof options === 'object' ? options : {};
    var indices = [];
    if (!state) {
      state = {
        title: '当前任务',
        summary: '',
        status: 'running',
        steps: [],
      };
    }
    list.forEach(function(plan) {
      var label = type === 'action'
        ? buildAssistantTaskStepLabelFromAction(plan)
        : buildAssistantTaskStepLabelFromMcpCall(plan, opts.userText || '');
      var planKey = buildAssistantTaskPlanKey(type, plan);
      var previewIndex = -1;
      if (!label) return;
      previewIndex = findReusableAssistantTaskPreviewStepIndex(state, planKey);
      if (previewIndex >= 0 && state.steps[previewIndex]) {
        state.steps[previewIndex].label = label;
        state.steps[previewIndex].description = '';
        state.steps[previewIndex].status = normalizeAssistantTaskStatus(state.steps[previewIndex].status) || 'waiting';
        state.steps[previewIndex].planKey = planKey || state.steps[previewIndex].planKey || '';
        state.steps[previewIndex].preview = false;
        indices.push(previewIndex);
        return;
      }
      state.steps.push({
        label: label,
        description: '',
        status: 'waiting',
        planKey: planKey,
        preview: false,
      });
      indices.push(state.steps.length - 1);
    });
    if (indices.length) {
      state.status = 'running';
      state.summary = state.steps.length > 1
        ? ('已拆分为 ' + state.steps.length + ' 个步骤，正在执行。')
        : '正在执行任务。';
    }
    return {
      taskState: state,
      indices: indices,
    };
  }

  function buildAssistantTaskPreviewState(type, plans, options) {
    var normalizedType = type === 'action' ? 'action' : 'mcp';
    var list = Array.isArray(plans) ? plans : [];
    var opts = options && typeof options === 'object' ? options : {};
    var title = opts.title !== undefined && opts.title !== null && String(opts.title).trim()
      ? String(opts.title).trim()
      : '当前任务';
    var steps = [];
    var stepIndices = [];
    var i = 0;
    for (i = 0; i < list.length; i += 1) {
      var plan = list[i] && typeof list[i] === 'object' ? list[i] : null;
      var label = '';
      var planKey = '';
      if (!plan) continue;
      label = normalizedType === 'action'
        ? buildAssistantTaskStepLabelFromAction(plan)
        : buildAssistantTaskStepLabelFromMcpCall(plan, opts.userText || '');
      if (!label) continue;
      planKey = buildAssistantTaskPlanKey(normalizedType, plan);
      steps.push({
        label: label,
        description: '',
        status: 'waiting',
        planKey: planKey,
        preview: true,
      });
      stepIndices.push(steps.length - 1);
    }
    if (!steps.length) return null;
    return {
      taskState: {
        title: title,
        summary: opts.summary !== undefined && opts.summary !== null && String(opts.summary).trim()
          ? String(opts.summary).trim()
          : (steps.length > 1 ? ('已拆分为 ' + steps.length + ' 个步骤，正在执行。') : '正在执行任务。'),
        status: 'running',
        steps: steps,
      },
      continuation: buildAssistantTaskContinuation(normalizedType, list.slice(), stepIndices.slice(), opts.userText || '', opts.responseHint || ''),
      indices: stepIndices,
    };
  }

  function buildAssistantTaskPreviewContinuationAfterStep(previewContinuation, type, stepIndex, executedPlan, userText, responseHint) {
    var data = cloneAssistantTaskContinuation(previewContinuation);
    var normalizedType = type === 'action' ? 'action' : 'mcp';
    var matchIndex = -1;
    var i = 0;
    if (!data || data.type !== normalizedType || !data.items.length) return null;
    for (i = 0; i < data.stepIndices.length; i += 1) {
      if (Number(data.stepIndices[i]) === Number(stepIndex)) {
        matchIndex = i;
        break;
      }
    }
    if (matchIndex < 0 && executedPlan && typeof executedPlan === 'object') {
      var planKey = buildAssistantTaskPlanKey(normalizedType, executedPlan);
      for (i = 0; i < data.items.length; i += 1) {
        if (buildAssistantTaskPlanKey(normalizedType, data.items[i]) !== planKey) continue;
        matchIndex = i;
        break;
      }
    }
    if (matchIndex < 0) return null;
    return buildAssistantTaskContinuation(normalizedType, data.items.slice(matchIndex + 1), data.stepIndices.slice(matchIndex + 1), userText || data.userText || '', responseHint || data.responseHint || '');
  }

  function setAssistantTaskStateStepStatus(taskState, stepIndex, status, summary) {
    var state = taskState && typeof taskState === 'object' ? taskState : null;
    var normalized = normalizeAssistantTaskStatus(status) || 'running';
    if (!state || !Array.isArray(state.steps) || stepIndex < 0 || stepIndex >= state.steps.length) return state;
    state.steps[stepIndex].status = normalized;
    if (summary !== undefined && summary !== null) state.summary = String(summary);
    state.status = deriveAssistantTaskStateStatus(state);
    return state;
  }

  function setAssistantTaskStateStatus(taskState, status, summary) {
    var state = taskState && typeof taskState === 'object' ? taskState : null;
    var normalized = normalizeAssistantTaskStatus(status);
    if (!state) return state;
    if (summary !== undefined && summary !== null) state.summary = String(summary);
    state.status = normalized || deriveAssistantTaskStateStatus(state);
    return state;
  }

  function buildExecTransferPendingTaskState(pending, status, summary) {
    var data = pending && typeof pending === 'object' ? pending : null;
    var state = cloneAssistantTaskState(data && data.taskState ? data.taskState : null);
    var stepIndex = data ? Number(data.taskStepIndex) : -1;
    if (!Number.isFinite(stepIndex)) stepIndex = -1;
    if (!state) {
      state = {
        title: '当前任务',
        summary: '',
        status: normalizeAssistantTaskStatus(status) || 'running',
        steps: [
          {
            label: '转到当前执行',
            description: '',
            status: normalizeAssistantTaskStatus(status) || 'running',
          }
        ],
      };
      stepIndex = 0;
    }
    if (stepIndex >= 0 && Array.isArray(state.steps) && stepIndex < state.steps.length) {
      setAssistantTaskStateStepStatus(state, stepIndex, status, summary === undefined ? null : summary);
    } else {
      setAssistantTaskStateStatus(state, status, summary === undefined ? null : summary);
    }
    if (summary !== undefined && summary !== null) state.summary = String(summary);
    state.status = normalizeAssistantTaskStatus(status) || deriveAssistantTaskStateStatus(state);
    return state;
  }

  async function executeModelMcpToolCall(call, userText, defaultResponse) {
    var item = call && typeof call === 'object' ? call : {};
    var tool = normalizeMcpToolName(item.tool || item.name || '');
    if (!tool) return null;
    var args = item.args && typeof item.args === 'object' ? Object.assign({}, item.args) : {};
    var rewrittenLegacy = rewriteLegacyExecBatchToolIfNeeded(tool, args, userText);
    if (rewrittenLegacy && rewrittenLegacy.rewritten === true) {
      tool = rewrittenLegacy.tool;
      args = rewrittenLegacy.args && typeof rewrittenLegacy.args === 'object' ? Object.assign({}, rewrittenLegacy.args) : {};
    }
    var rewritten = rewriteUiFillAsCaseUpdateIfNeeded(tool, args, userText);
    if (rewritten && rewritten.rewritten === true) {
      tool = rewritten.tool;
      args = rewritten.args && typeof rewritten.args === 'object' ? Object.assign({}, rewritten.args) : {};
    }
    var rewrittenReuse = rewriteCaseUpdateAsTempExecReuseUpdateIfNeeded(tool, args, userText);
    if (rewrittenReuse && rewrittenReuse.rewritten === true) {
      tool = rewrittenReuse.tool;
      args = rewrittenReuse.args && typeof rewrittenReuse.args === 'object' ? Object.assign({}, rewrittenReuse.args) : {};
    }
    if (tool === 'case.update') {
      args = inferCaseUpdateArgsFromText(args, userText);
    }
    if (tool === 'tempexec.reuse_update') {
      args = parseTempExecReuseUpdateCommand(userText, args) || args;
      var preparedReuseArgs = await prepareTempExecReuseArgsByModel(userText, args);
      if (preparedReuseArgs && preparedReuseArgs.selectionData) {
        rememberTempExecReuseTargetSelection(preparedReuseArgs.selectionData, {
          sourceUserText: userText,
        });
        return { handled: true, text: buildTempExecReuseTargetSelectionText(preparedReuseArgs.selectionData) };
      }
      if (preparedReuseArgs && preparedReuseArgs.args) args = preparedReuseArgs.args;
    }
    if (tool === 'case_library.query_cases') {
      args = await buildCaseLibraryQueryArgsFromUserText(args, userText);
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
      return { handled: true, text: '当前环境暂不支持 MCP 工具：' + tool };
    }

    async function callMcpOnce(payload) {
      try {
        return await apis.assistantMcpApi.callTool(tool, payload || {});
      } catch (err) {
        return { ok: false, reason: err && err.message ? String(err.message) : 'MCP 调用异常' };
      }
    }

    var callResult = null;
    var confirmedRetryTried = false;
    var confirmFlow = await runAssistantMcpConfirmLoop(
      callMcpOnce,
      args || {},
      getMutationActionLabel(actionName || tool, actionPayload || args)
    );
    callResult = confirmFlow && Object.prototype.hasOwnProperty.call(confirmFlow, 'result') ? confirmFlow.result : null;
    confirmedRetryTried = Boolean(confirmFlow && confirmFlow.confirmedRetryTried === true);
    if (confirmFlow && confirmFlow.args && typeof confirmFlow.args === 'object') {
      args = Object.assign({}, confirmFlow.args);
    }
    if (confirmFlow && confirmFlow.cancelled === true) {
      return { handled: true, text: '已取消。' };
    }
    if (tool === 'case_library.search_exec_candidates') {
      var repairedSearch = await retryExecTransferSearchByModel(callMcpOnce, args, callResult, userText);
      if (repairedSearch) {
        args = repairedSearch.args && typeof repairedSearch.args === 'object' ? Object.assign({}, repairedSearch.args) : args;
        callResult = repairedSearch.result;
      }
    }
    if (tool === 'tempexec.remove_files' && callResult && callResult.ok !== true && String(callResult.reason || '') === 'selection_required') {
      var removeSelectionData = callResult.data && typeof callResult.data === 'object' ? callResult.data : {};
      rememberTempExecRemoveSelection(removeSelectionData, {
        sourceUserText: userText,
      });
      return { handled: true, text: buildTempExecRemoveSelectionText(removeSelectionData) };
    }
    if (tool === 'tempexec.reuse_update' && callResult && callResult.ok !== true && String(callResult.reason || '') === 'selection_required') {
      var reuseSelectionData = callResult.data && typeof callResult.data === 'object' ? callResult.data : {};
      rememberTempExecReuseTargetSelection(reuseSelectionData, {
        sourceUserText: userText,
      });
      return { handled: true, text: buildTempExecReuseTargetSelectionText(reuseSelectionData) };
    }
    if (!callResult || callResult.ok !== true) {
      var failedReason = callResult && callResult.reason ? String(callResult.reason) : '未知错误';
      var toolMode = getMcpToolMode(tool);
      // 写工具或确认后失败时，直接返回失败信息，避免回退链路再次触发确认弹窗。
      if (confirmedRetryTried || toolMode === 'write' || failedReason === 'confirm_required') {
        return { handled: true, text: 'MCP 工具执行失败：' + failedReason };
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
    if (tool === 'case_library.batch_archive_exec_cases') {
      var archiveName = toolData && toolData.fileName ? String(toolData.fileName) : '';
      var archiveReason = toolData && toolData.reason ? String(toolData.reason) : '';
      if (responseHint) return { handled: true, text: responseHint };
      return {
        handled: true,
        text: '已归档当前执行用例' + (archiveName ? ('：' + archiveName) : '') + (archiveReason ? '（已填写归档原因）' : '。'),
      };
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
    if (tool === 'tempexec.reuse_update') {
      if (responseHint) return { handled: true, text: responseHint };
      return { handled: true, text: formatTempExecReuseUpdateSuccessText(toolData || {}) };
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
    if (tool === 'case_library.query_cases') {
      var libraryToolData = toolData && typeof toolData === 'object' ? toolData : {};
      var fallbackLibraryText = (args.countOnly === true || args.count === true)
        ? formatCaseLibraryQueryCountResponse(libraryToolData)
        : formatCaseLibraryQueryResponse(libraryToolData);
      var summarizedLibrary = await summarizeMcpToolResultByModel(userText, tool, args, libraryToolData, fallbackLibraryText);
      if (summarizedLibrary) return { handled: true, text: summarizedLibrary };
      if (responseHint && responseHint !== fallbackLibraryText) {
        return { handled: true, text: responseHint + '\n' + fallbackLibraryText };
      }
      return { handled: true, text: fallbackLibraryText };
    }
    if (tool === 'case_library.search_exec_candidates') {
      var fallbackExecSearchText = buildExecTransferSearchResultText(toolData || {}, responseHint || '');
      clearPendingExecTransferManualState();
      if (toolData && toolData.selectionRequired === true) rememberExecTransferSelection(toolData || {}, {
        sourceUserText: userText,
      });
      else clearPendingExecTransferSelection();
      return { handled: true, text: fallbackExecSearchText };
    }
    if (tool === 'case_library.transfer_to_exec') {
      var transferText = handleExecTransferToolData(toolData || {}, responseHint || '', {
        approved: confirmedRetryTried || Boolean(args && args.confirmed === true),
        sourceUserText: userText,
        requestedVersionName: args && args.execVersionName !== undefined && args.execVersionName !== null ? String(args.execVersionName).trim() : '',
      });
      var autoTransferVersionReply = null;
      if (pendingExecTransferVersionSelection) {
        autoTransferVersionReply = await tryAutoResolvePendingExecTransferVersionFromSource(pendingExecTransferVersionSelection, {
          sourceUserText: userText,
        });
        if (autoTransferVersionReply && autoTransferVersionReply.handled === true) {
          return { handled: true, text: autoTransferVersionReply.text || transferText };
        }
      }
      return { handled: true, text: transferText };
    }
    if (tool === 'tempexec.remove_files') {
      return { handled: true, text: formatTempExecRemoveSuccessText(toolData || {}) };
    }
    if (tool === 'missing_library.list_current') {
      var fallbackMissingLibraryText = formatMissingLibraryListResponse(toolData || {});
      var summarizedMissingLibrary = await summarizeMcpToolResultByModel(userText, tool, args, toolData || {}, fallbackMissingLibraryText);
      if (summarizedMissingLibrary) return { handled: true, text: summarizedMissingLibrary };
      return { handled: true, text: fallbackMissingLibraryText };
    }
    if (tool === 'cross_page.match_missing_cases') {
      var fallbackCrossPageMatchText = formatCrossPageMissingCaseMatchResponse(toolData || {});
      var summarizedCrossPageMatch = await summarizeMcpToolResultByModel(userText, tool, args, toolData || {}, fallbackCrossPageMatchText);
      if (summarizedCrossPageMatch) return { handled: true, text: summarizedCrossPageMatch };
      return { handled: true, text: fallbackCrossPageMatchText };
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
    if (!isSearchListDisplayIntent(raw)) return false;
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


  async function tryHandleAssistantProtocolV2(text, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var attachments = normalizeAssistantMessageAttachments(opts.attachments);
    var contentBlocks = normalizeAssistantContentBlocks(opts.contentBlocks);
    var hasImageInput = assistantContentBlocksHaveImage(contentBlocks) || attachments.length > 0;
    var content = composeAssistantConversationContent(text, attachments);
    var onTaskStateChange = typeof opts.onTaskStateChange === 'function' ? opts.onTaskStateChange : null;
    var pendingSnapshot = clonePendingInteraction(pendingInteraction);
    var taskUserText = buildAssistantContinuationTaskUserText(content, pendingSnapshot);
    var selectedChoice = pendingSnapshot ? resolvePendingInteractionChoice(pendingSnapshot, text) : null;
    var activeSelectedChoice = selectedChoice && typeof selectedChoice === 'object' ? JSON.parse(JSON.stringify(selectedChoice)) : null;
    var observations = [];
    var selectedChoiceTaskStepId = pendingSnapshot && pendingSnapshot.taskStepId ? String(pendingSnapshot.taskStepId) : '';
    var taskRuntime = pendingSnapshot && pendingSnapshot.taskState
      ? buildAssistantProtocolTaskRuntimeFromTaskState(pendingSnapshot.taskState)
      : null;
    var round = 0;
    var maxRounds = 6;
    var executedCalls = 0;
    var maxExecutedCalls = 12;
    var successfulCallSignatures = {};
    var successfulCapabilityExecutionObservations = {};
    var repeatedCallGuardCount = 0;
    var pendingWriteRecoveryCount = 0;
    var hasSuccessfulWriteCall = false;
    var modelDeclaredWriteTask = assistantTaskStateRequiresWrite(taskRuntime && taskRuntime.taskState ? taskRuntime.taskState : null);
    var protocolRetryOverride = null;
    if (!content && !hasImageInput) return null;
    if (pendingSnapshot) {
      pendingSnapshot.selectedChoice = selectedChoice ? JSON.parse(JSON.stringify(selectedChoice)) : null;
      if (pendingSnapshot.observation && typeof pendingSnapshot.observation === 'object') {
        observations.push(JSON.parse(JSON.stringify(pendingSnapshot.observation)));
      }
      if (taskRuntime && taskRuntime.taskState && selectedChoice && pendingSnapshot.taskStepId) {
        var pendingStepIndex = Object.prototype.hasOwnProperty.call(taskRuntime.stepIndexById, pendingSnapshot.taskStepId)
          ? Number(taskRuntime.stepIndexById[pendingSnapshot.taskStepId])
          : -1;
        if (pendingStepIndex >= 0) {
          setAssistantTaskStateStepStatus(taskRuntime.taskState, pendingStepIndex, 'completed', '已确认你的选择，继续执行后续步骤。');
        }
      }
      clearPendingInteraction();
    }

    function pushTaskUpdate(taskText) {
      if (!onTaskStateChange || !taskRuntime || !taskRuntime.taskState) return;
      onTaskStateChange(cloneAssistantTaskState(taskRuntime.taskState), taskText || '已进入任务状态，正在执行。');
    }

    function syncSelectedChoiceTaskStep(summary) {
      if (!activeSelectedChoice || !selectedChoiceTaskStepId || !taskRuntime || !taskRuntime.taskState || !taskRuntime.stepIndexById) return;
      if (!Object.prototype.hasOwnProperty.call(taskRuntime.stepIndexById, selectedChoiceTaskStepId)) return;
      var selectedStepIndex = Number(taskRuntime.stepIndexById[selectedChoiceTaskStepId]);
      if (selectedStepIndex < 0 || selectedStepIndex >= taskRuntime.taskState.steps.length) return;
      if (taskRuntime.taskState.steps[selectedStepIndex].status === 'completed') return;
      setAssistantTaskStateStepStatus(taskRuntime.taskState, selectedStepIndex, 'completed', summary || '已确认你的选择，继续执行后续步骤。');
    }

    function markTaskRuntimeAwaitingModel(summary) {
      var nextSummary = summary === undefined || summary === null ? '本轮步骤已完成，正在整理结果。' : String(summary);
      if (!taskRuntime || !taskRuntime.taskState) return;
      syncAssistantProtocolFinalizeStep(taskRuntime, 'running', nextSummary);
      setAssistantTaskStateStatus(taskRuntime.taskState, 'running', nextSummary);
      pushTaskUpdate(nextSummary);
    }

    function waitForAssistantUiRender() {
      return new Promise(function(resolve) {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(function() {
            setTimeout(resolve, 0);
          });
          return;
        }
        setTimeout(resolve, 0);
      });
    }

    function isSoftBlockedObservation(observation) {
      var row = observation && typeof observation === 'object' ? observation : {};
      var capability = normalizeMcpToolName(row.capability || '');
      return capability.indexOf('assistant.runtime.') === 0;
    }

    function hasHardBlockedObservation(list) {
      var rows = Array.isArray(list) ? list : [];
      var i = 0;
      for (i = 0; i < rows.length; i += 1) {
        var row = rows[i] && typeof rows[i] === 'object' ? rows[i] : {};
        if (String(row.status || '') !== 'blocked') continue;
        if (isSoftBlockedObservation(row)) continue;
        return true;
      }
      return false;
    }

    function buildObservationFallbackText() {
      function findLatestObservationEntry(capabilityId, predicate) {
        var ids = Array.isArray(capabilityId)
          ? capabilityId.map(function(item) { return normalizeMcpToolName(item); }).filter(Boolean)
          : [normalizeMcpToolName(capabilityId)];
        var i = 0;
        for (i = observations.length - 1; i >= 0; i -= 1) {
          var item = observations[i] && typeof observations[i] === 'object' ? observations[i] : {};
          var itemId = normalizeMcpToolName(item.capability || '');
          if (ids.length && ids.indexOf(itemId) === -1) continue;
          if (predicate && predicate(item, i) !== true) continue;
          return {
            index: i,
            item: item,
          };
        }
        return null;
      }

      function findLatestObservation(capabilityId) {
        var entry = findLatestObservationEntry(capabilityId);
        return entry ? entry.item : null;
      }

      function findLatestSuccessfulObservation(capabilityId) {
        return findLatestObservationEntry(capabilityId, function(item) {
          return String(item.status || '') === 'ok';
        });
      }

      function pickLaterObservationEntry(first, second) {
        if (first && second) return first.index >= second.index ? first : second;
        return first || second || null;
      }

      function readObservationArgs(entry) {
        var row = entry && entry.item && typeof entry.item === 'object' ? entry.item : null;
        var data = row && row.data && typeof row.data === 'object' ? row.data : null;
        var args = data && data.args && typeof data.args === 'object' ? data.args : null;
        return args ? Object.assign({}, args) : {};
      }

      function readCaseItemExecutionStatus(item) {
        var row = item && typeof item === 'object' ? item : {};
        var resolved = resolveCaseExecutionResult(row);
        var normalized = normalizeCaseActualValueToken(resolved || row.executionResult || row.actual || row.status || row.result || '');
        if (normalized) return normalized;
        if (resolved !== undefined && resolved !== null && String(resolved).trim()) return String(resolved).trim();
        if (row.executionResult !== undefined && row.executionResult !== null && String(row.executionResult).trim()) return String(row.executionResult).trim();
        if (row.actual !== undefined && row.actual !== null && String(row.actual).trim()) return String(row.actual).trim();
        if (row.status !== undefined && row.status !== null && String(row.status).trim()) return String(row.status).trim();
        if (row.result !== undefined && row.result !== null && String(row.result).trim()) return String(row.result).trim();
        return '未设置';
      }

      function buildCaseExecutionSummary(caseData, targetValue, caseIndex) {
        var data = caseData && typeof caseData === 'object' ? caseData : {};
        var items = Array.isArray(data.items) ? data.items : [];
        var summary = {
          total: items.length,
          fileName: data.caseFile && data.caseFile.name ? String(data.caseFile.name) : '',
          caseIndex: 0,
          found: false,
          label: '',
          status: '',
          satisfiedCount: 0,
          unmetCount: 0,
          allMatched: false,
          unmatchedExamples: [],
        };
        var i = 0;
        var normalizedIndex = Number(caseIndex);
        if (Number.isFinite(normalizedIndex) && normalizedIndex > 0) {
          normalizedIndex = Math.floor(normalizedIndex);
          summary.caseIndex = normalizedIndex;
          if (items[normalizedIndex - 1] && typeof items[normalizedIndex - 1] === 'object') {
            var targetItem = items[normalizedIndex - 1];
            summary.found = true;
            summary.label = targetItem.title ? String(targetItem.title).trim() : ('第 ' + normalizedIndex + ' 条用例');
            summary.status = readCaseItemExecutionStatus(targetItem);
            summary.allMatched = summary.status === targetValue;
            summary.satisfiedCount = summary.allMatched ? 1 : 0;
            summary.unmetCount = summary.allMatched ? 0 : 1;
          } else {
            summary.unmetCount = 1;
          }
          return summary;
        }
        for (i = 0; i < items.length; i += 1) {
          var row = items[i] && typeof items[i] === 'object' ? items[i] : {};
          var status = readCaseItemExecutionStatus(row);
          var label = row.title ? String(row.title).trim() : ('第 ' + String(row.index || (i + 1)) + ' 条');
          if (status === targetValue) {
            summary.satisfiedCount += 1;
          } else if (summary.unmatchedExamples.length < 3) {
            summary.unmatchedExamples.push(label + '（当前：' + status + '）');
          }
        }
        summary.unmetCount = items.length - summary.satisfiedCount;
        summary.allMatched = items.length > 0 && summary.unmetCount === 0;
        return summary;
      }

      function buildCaseExecutionResultText(summary, previousSummary, hasWrite, writeData, hasFreshReadAfterWrite, targetValue) {
        var prefix = summary && summary.fileName ? ('当前执行文件“' + summary.fileName + '”中，') : '';
        var writeCount = Number(writeData && (writeData.count || writeData.updatedCount || writeData.selectedCaseCount)) || 0;
        if (summary && summary.caseIndex > 0) {
          if (!summary.found) {
            if (summary.total > 0) return prefix + '当前共 ' + summary.total + ' 条用例，未找到第 ' + summary.caseIndex + ' 条用例，未执行修改。';
            return prefix + '未找到第 ' + summary.caseIndex + ' 条用例。';
          }
          if (summary.allMatched) {
            if (previousSummary && previousSummary.found && previousSummary.allMatched) {
              return prefix + summary.label + '已为' + targetValue + '，无需修改，原本已符合预期。';
            }
            if (!hasWrite) return prefix + summary.label + '已为' + targetValue + '，无需修改。';
            return prefix + summary.label + '已改为' + targetValue + '。';
          }
          if (hasWrite) {
            if (!hasFreshReadAfterWrite) {
              return prefix + summary.label + '已发起修改'
                + (writeCount > 0 ? ('（本次处理 ' + writeCount + ' 条）') : '')
                + '，但当前还没有重新读取结果确认。';
            }
            return prefix + summary.label + '当前为' + summary.status + '，尚未改为' + targetValue + '。';
          }
          return prefix + summary.label + '当前为' + summary.status + '，还未改为' + targetValue + '。当前还没有实际执行修改。';
        }
        if (!summary || summary.total <= 0) {
          if (hasWrite) {
            return '已执行批量修改'
              + (writeCount > 0 ? ('，本次处理 ' + writeCount + ' 条用例') : '')
              + '，但当前没有读取到可核对的用例。';
          }
          return '';
        }
        if (summary.allMatched) {
          if (previousSummary && previousSummary.total === summary.total && previousSummary.allMatched) {
            return prefix + '当前全部用例已为' + targetValue + '，无需修改，原本已符合预期。';
          }
          if (!hasWrite) return prefix + '当前全部用例已为' + targetValue + '，无需修改。';
          return prefix + '已按要求把全部 ' + summary.total + ' 条用例改为' + targetValue + '。';
        }
        if (hasWrite) {
          if (!hasFreshReadAfterWrite) {
            return prefix + '已执行批量修改'
              + (writeCount > 0 ? ('，本次处理 ' + writeCount + ' 条用例') : '')
              + '，但当前还没有重新读取列表确认。';
          }
          var improvedCount = previousSummary && previousSummary.total === summary.total
            ? (summary.satisfiedCount - previousSummary.satisfiedCount)
            : 0;
          var message = improvedCount > 0
            ? ('已补齐部分缺漏，当前 ' + summary.total + ' 条用例中已有 ' + summary.satisfiedCount + ' 条为' + targetValue + '，仍有 ' + summary.unmetCount + ' 条未达标。')
            : ('已尝试修改，当前 ' + summary.total + ' 条用例中已有 ' + summary.satisfiedCount + ' 条为' + targetValue + '，仍有 ' + summary.unmetCount + ' 条未达标。');
          return prefix + message + (summary.unmatchedExamples.length ? ('例如：' + summary.unmatchedExamples.join('、') + '。') : '');
        }
        return prefix + '当前共 ' + summary.total + ' 条用例，已为' + targetValue + '的有 ' + summary.satisfiedCount + ' 条，仍有 ' + summary.unmetCount + ' 条未达标。'
          + (summary.unmatchedExamples.length ? ('例如：' + summary.unmatchedExamples.join('、') + '。') : '')
          + '当前还没有实际执行修改。';
      }

      function buildObservedPageDataLines(pageData) {
        var data = pageData && typeof pageData === 'object' ? pageData : {};
        var lines = [];
        var currentCaseContext = data.currentCaseContext && typeof data.currentCaseContext === 'object' ? data.currentCaseContext : null;
        if (data.requirementLabel) lines.push('- 当前需求：' + String(data.requirementLabel));
        lines.push('- 已配置模型数：' + (Number(data.modelsCount) || 0));
        lines.push('- 已导入用例数：' + (Number(data.importedCasesCount) || 0));
        lines.push('- 用例生成模块数：' + (Number(data.caseGenModuleCount) || 0));
        lines.push('- 当前执行文件数：' + (Number(data.tempExecFileCount) || 0));
        if (currentCaseContext && currentCaseContext.fileName) {
          lines.push('- 当前用例文件：' + String(currentCaseContext.fileName) + '（可见 ' + (Number(currentCaseContext.total) || 0) + ' 条，总计 ' + (Number(currentCaseContext.totalAll) || Number(currentCaseContext.total) || 0) + ' 条）');
        }
        if (data.caseLibraryHistoryDetail && data.caseLibraryHistoryDetail.hasContext === true) lines.push('- 已读取当前用例库历史详情上下文');
        if (data.missingCaseLibraryView && data.missingCaseLibraryView.hasContext === true) lines.push('- 已读取易漏用例视图上下文');
        if (data.tempExecCaseLibraryDiffDetail && data.tempExecCaseLibraryDiffDetail.hasContext === true) lines.push('- 已读取当前执行与用例库差异上下文');
        return lines;
      }

      function buildPageCapabilitySummaryLines(tab) {
        var capabilityIds = ['page.current_info', 'page.get_data', 'ui.list_controls'];
        var normalizedTab = tab === undefined || tab === null ? '' : String(tab).trim().toLowerCase();
        var seen = {};
        var lines = [];
        var i = 0;
        if (normalizedTab === 'settings') capabilityIds = capabilityIds.concat(['settings.describe', 'settings.patch']);
        if (normalizedTab === 'case-library') capabilityIds = capabilityIds.concat(['cases.list_current', 'case_library.query_cases', 'missing_library.list_current', 'cross_page.match_missing_cases']);
        if (normalizedTab === 'tempexec') capabilityIds = capabilityIds.concat(['cases.list_current', 'case.update', 'tempexec.reuse_update', 'tempexec.remove_files', 'tempexec.switch_file', 'tempexec.export_xmind']);
        for (i = 0; i < capabilityIds.length; i += 1) {
          var capability = getAssistantCapabilityById(capabilityIds[i]);
          var description = capability && capability.description ? String(capability.description).trim() : '';
          var line = '';
          if (!capability || capability.available === false || !description) continue;
          line = '- ' + description;
          if (capability.approvalPolicy === 'user_confirm' || capability.approvalPolicy === 'tool_managed' || capability.mode === 'write') line += '（写操作会先征求你的同意）';
          if (seen[line]) continue;
          seen[line] = true;
          lines.push(line);
        }
        return lines.slice(0, 6);
      }

      function buildObservedCaseListFallback() {
        var latestCaseWriteEntry = findLatestSuccessfulObservation(['case.update', 'case_library.batch_update_exec_results']);
        var latestReuseWriteEntry = findLatestSuccessfulObservation('tempexec.reuse_update');
        var latestAnyWriteEntry = findLatestObservationEntry([], function(item) {
          var capability = normalizeMcpToolName(item && item.capability ? item.capability : '');
          if (!capability || isSoftBlockedObservation(item)) return false;
          if (String(item.status || '') !== 'ok') return false;
          return getMcpToolMode(capability) === 'write';
        });
        var latestRelevantWriteEntry = pickLaterObservationEntry(pickLaterObservationEntry(latestCaseWriteEntry, latestReuseWriteEntry), latestAnyWriteEntry);
        var latestCaseListEntry = findLatestSuccessfulObservation('cases.list_current');
        var currentCaseListEntry = latestCaseListEntry;
        var previousCaseListEntry = null;
        var currentCaseData = null;
        var previousCaseData = null;
        var hasFreshReadAfterWrite = false;
        var latestCaseWriteArgs = readObservationArgs(latestCaseWriteEntry);
        var latestReuseWriteArgs = readObservationArgs(latestReuseWriteEntry);
        var latestAnyWriteArgs = readObservationArgs(latestAnyWriteEntry);
        var taskHintText = '';
        var parsedReuse = latestReuseWriteArgs && Object.keys(latestReuseWriteArgs).length
          ? Object.assign({}, latestReuseWriteArgs)
          : {};
        var inferredCaseUpdate = latestCaseWriteArgs && Object.keys(latestCaseWriteArgs).length
          ? Object.assign({}, latestCaseWriteArgs)
          : {};
        var currentItems = [];
        var previousItems = [];
        var fileName = '';
        var total = 0;
        if (taskRuntime && taskRuntime.taskState) {
          var taskState = taskRuntime.taskState;
          var taskSteps = Array.isArray(taskState.steps) ? taskState.steps : [];
          taskHintText = [
            taskState.title || '',
            taskState.summary || '',
          ].concat(taskSteps.map(function(step) {
            var row = step && typeof step === 'object' ? step : {};
            return [row.label || '', row.description || ''].join(' ').trim();
          })).filter(function(item) {
            return !!String(item || '').trim();
          }).join('\n');
        }
        if (taskHintText) {
          if (!parsedReuse || !Object.keys(parsedReuse).length) {
            parsedReuse = parseTempExecReuseUpdateCommand(taskHintText, parsedReuse) || parsedReuse;
          }
          if (!inferredCaseUpdate || !Object.keys(inferredCaseUpdate).length) {
            inferredCaseUpdate = inferCaseUpdateArgsFromText(Object.assign({}, inferredCaseUpdate), taskHintText);
          }
        }
        if (latestRelevantWriteEntry) {
          currentCaseListEntry = findLatestObservationEntry('cases.list_current', function(item, index) {
            return String(item.status || '') === 'ok' && index > latestRelevantWriteEntry.index;
          }) || latestCaseListEntry;
          previousCaseListEntry = findLatestObservationEntry('cases.list_current', function(item, index) {
            return String(item.status || '') === 'ok' && index < latestRelevantWriteEntry.index;
          });
          hasFreshReadAfterWrite = Boolean(currentCaseListEntry && currentCaseListEntry.index > latestRelevantWriteEntry.index);
        }
        currentCaseData = currentCaseListEntry && currentCaseListEntry.item && currentCaseListEntry.item.data && typeof currentCaseListEntry.item.data === 'object'
          ? currentCaseListEntry.item.data
          : null;
        previousCaseData = previousCaseListEntry && previousCaseListEntry.item && previousCaseListEntry.item.data && typeof previousCaseListEntry.item.data === 'object'
          ? previousCaseListEntry.item.data
          : null;
        if (latestRelevantWriteEntry && !hasFreshReadAfterWrite) {
          var liveCaseData = buildLiveTempExecCaseDataForAssistant();
          var liveFileId = liveCaseData && liveCaseData.caseFile && liveCaseData.caseFile.id ? String(liveCaseData.caseFile.id) : '';
          var currentFileId = currentCaseData && currentCaseData.caseFile && currentCaseData.caseFile.id ? String(currentCaseData.caseFile.id) : '';
          var sameLiveFile = !currentFileId || !liveFileId || currentFileId === liveFileId;
          if (liveCaseData && sameLiveFile) {
            currentCaseData = liveCaseData;
            hasFreshReadAfterWrite = true;
          }
        }
        currentItems = currentCaseData && Array.isArray(currentCaseData.items) ? currentCaseData.items : [];
        previousItems = previousCaseData && Array.isArray(previousCaseData.items) ? previousCaseData.items : [];
        fileName = currentCaseData && currentCaseData.caseFile && currentCaseData.caseFile.name ? String(currentCaseData.caseFile.name) : '';
        total = currentCaseData && Number(currentCaseData.total) > 0 ? Number(currentCaseData.total) : currentItems.length;
        if (!currentCaseData) return { text: '', priority: 'none' };
        if (parsedReuse && parsedReuse.detailName && normalizeTempExecReuseFieldName(parsedReuse.field || '') === 'actual') {
          var detailName = String(parsedReuse.detailName || '').trim();
          var targetValue = normalizeCaseActualValueToken(parsedReuse.value || parsedReuse.to || '');
          var caseIndex = Number(parsedReuse.index);
          var totalAll = currentCaseData && Number(currentCaseData.totalAll) > 0 ? Number(currentCaseData.totalAll) : total;
          if (!Number.isFinite(caseIndex) || caseIndex <= 0) caseIndex = 0;
          else caseIndex = Math.floor(caseIndex);
          var matched = [];
          var unmatched = [];
          var i = 0;
          if (detailName && targetValue) {
            if (caseIndex > 0 && totalAll > 0 && caseIndex > totalAll) {
              var outOfRangePrefix = fileName ? ('当前执行文件“' + fileName + '”中，') : '';
              return {
                text: outOfRangePrefix + '当前共 ' + totalAll + ' 条用例，未找到第 ' + caseIndex + ' 条用例，未执行对子项“' + detailName + '”改为' + targetValue + '的修改。',
                priority: 'specific',
              };
            }
            if (caseIndex > 0 && currentItems[caseIndex - 1] && typeof currentItems[caseIndex - 1] === 'object') {
              var singleItem = currentItems[caseIndex - 1];
              var singleDetails = Array.isArray(singleItem.reuseDetails) ? singleItem.reuseDetails : [];
              var singleTargetDetail = null;
              var singleJ = 0;
              for (singleJ = 0; singleJ < singleDetails.length; singleJ += 1) {
                var singleDetail = singleDetails[singleJ] && typeof singleDetails[singleJ] === 'object' ? singleDetails[singleJ] : {};
                if (String(singleDetail.text || '').trim() === detailName) {
                  singleTargetDetail = singleDetail;
                  break;
                }
              }
              if (singleTargetDetail) {
                var singleStatus = normalizeCaseActualValueToken(singleTargetDetail.status || '') || String(singleTargetDetail.status || '').trim() || '未设置';
                var singlePrefix = fileName ? ('当前执行文件“' + fileName + '”中，') : '';
                if (singleStatus === targetValue) {
                  var previousSingleDetailStatus = '';
                  if (latestReuseWriteEntry && previousItems[caseIndex - 1] && typeof previousItems[caseIndex - 1] === 'object') {
                    var previousSingleDetails = Array.isArray(previousItems[caseIndex - 1].reuseDetails) ? previousItems[caseIndex - 1].reuseDetails : [];
                    for (singleJ = 0; singleJ < previousSingleDetails.length; singleJ += 1) {
                      var previousSingleDetail = previousSingleDetails[singleJ] && typeof previousSingleDetails[singleJ] === 'object' ? previousSingleDetails[singleJ] : {};
                      if (String(previousSingleDetail.text || '').trim() === detailName) {
                        previousSingleDetailStatus = normalizeCaseActualValueToken(previousSingleDetail.status || '') || String(previousSingleDetail.status || '').trim() || '';
                        break;
                      }
                    }
                  }
                  if (latestReuseWriteEntry && previousSingleDetailStatus && previousSingleDetailStatus !== targetValue) {
                    return { text: singlePrefix + '第 ' + caseIndex + ' 条用例的子项“' + detailName + '”已改为' + targetValue + '。', priority: 'specific' };
                  }
                  if (latestReuseWriteEntry && previousSingleDetailStatus === targetValue) {
                    return { text: singlePrefix + '第 ' + caseIndex + ' 条用例的子项“' + detailName + '”已为' + targetValue + '，无需修改，原本已符合预期。', priority: 'specific' };
                  }
                  return { text: singlePrefix + '第 ' + caseIndex + ' 条用例的子项“' + detailName + '”已为' + targetValue + '，无需修改。', priority: 'specific' };
                }
                if (latestReuseWriteEntry) {
                  if (!hasFreshReadAfterWrite) {
                    return { text: singlePrefix + '第 ' + caseIndex + ' 条用例的子项“' + detailName + '”已发起修改，但当前还没有重新读取结果确认。', priority: 'specific' };
                  }
                  return { text: singlePrefix + '第 ' + caseIndex + ' 条用例的子项“' + detailName + '”当前为' + singleStatus + '，尚未改为' + targetValue + '。', priority: 'specific' };
                }
                return { text: singlePrefix + '第 ' + caseIndex + ' 条用例的子项“' + detailName + '”当前为' + singleStatus + '，还未改为' + targetValue + '。当前还没有实际执行修改。', priority: 'specific' };
              }
            }
            for (i = 0; i < currentItems.length; i += 1) {
              var item = currentItems[i] && typeof currentItems[i] === 'object' ? currentItems[i] : {};
              var details = Array.isArray(item.reuseDetails) ? item.reuseDetails : [];
              var targetDetail = null;
              var j = 0;
              for (j = 0; j < details.length; j += 1) {
                var detail = details[j] && typeof details[j] === 'object' ? details[j] : {};
                if (String(detail.text || '').trim() === detailName) {
                  targetDetail = detail;
                  break;
                }
              }
              if (!targetDetail) continue;
              var currentStatus = normalizeCaseActualValueToken(targetDetail.status || '') || String(targetDetail.status || '').trim() || '未设置';
              var caseLabel = item.title ? String(item.title).trim() : ('第 ' + String(item.index || (i + 1)) + ' 条');
              matched.push({ label: caseLabel, status: currentStatus });
              if (currentStatus !== targetValue) unmatched.push(caseLabel + '（当前：' + currentStatus + '）');
            }
            if (matched.length) {
              var prefix = fileName ? ('当前执行文件“' + fileName + '”中，') : '';
              if (!unmatched.length) {
                var previousMatchedCount = 0;
                if (latestReuseWriteEntry && previousItems.length) {
                  for (i = 0; i < previousItems.length; i += 1) {
                    var previousItem = previousItems[i] && typeof previousItems[i] === 'object' ? previousItems[i] : {};
                    var previousDetails = Array.isArray(previousItem.reuseDetails) ? previousItem.reuseDetails : [];
                    var previousTargetDetail = null;
                    var previousJ = 0;
                    for (previousJ = 0; previousJ < previousDetails.length; previousJ += 1) {
                      var previousDetail = previousDetails[previousJ] && typeof previousDetails[previousJ] === 'object' ? previousDetails[previousJ] : {};
                      if (String(previousDetail.text || '').trim() === detailName) {
                        previousTargetDetail = previousDetail;
                        break;
                      }
                    }
                    if (!previousTargetDetail) continue;
                    if ((normalizeCaseActualValueToken(previousTargetDetail.status || '') || String(previousTargetDetail.status || '').trim()) === targetValue) previousMatchedCount += 1;
                  }
                }
                if (latestReuseWriteEntry && previousMatchedCount > 0 && previousMatchedCount < matched.length) {
                  return { text: prefix + '子项“' + detailName + '”已按要求全部改为' + targetValue + '。', priority: 'specific' };
                }
                if (latestReuseWriteEntry && previousMatchedCount === matched.length && matched.length > 0) {
                  return { text: prefix + '子项“' + detailName + '”已全部为' + targetValue + '，无需修改，原本已符合预期。', priority: 'specific' };
                }
                return { text: prefix + '子项“' + detailName + '”已全部为' + targetValue + '，无需修改。', priority: 'specific' };
              }
              if (latestReuseWriteEntry) {
                if (!hasFreshReadAfterWrite) {
                  return { text: prefix + '已执行子项更新，但当前还没有重新读取结果确认。', priority: 'specific' };
                }
                return {
                  text: prefix + '子项“' + detailName + '”共匹配 ' + matched.length + ' 条，已为' + targetValue + '的有 ' + (matched.length - unmatched.length) + ' 条，仍有 ' + unmatched.length + ' 条未达标。'
                    + (unmatched.length ? ('例如：' + unmatched.slice(0, 3).join('、') + '。') : ''),
                  priority: 'specific',
                };
              }
              return {
                text: prefix + '子项“' + detailName + '”共匹配 ' + matched.length + ' 条，已为' + targetValue + '的有 ' + (matched.length - unmatched.length) + ' 条，仍有 ' + unmatched.length + ' 条未达标。'
                  + (unmatched.length ? ('例如：' + unmatched.slice(0, 3).join('、') + '。') : '')
                  + '当前还没有实际执行修改。',
                priority: 'specific',
              };
            }
          }
        }
        if (inferredCaseUpdate && normalizeCaseUpdateFieldName(inferredCaseUpdate.field || '') === 'actual') {
          var targetCaseValue = normalizeCaseActualValueToken(inferredCaseUpdate.value || '');
          var caseIndex2 = Number(inferredCaseUpdate.index);
          var currentSummary = null;
          var previousSummary = null;
          var latestCaseWriteData = latestCaseWriteEntry && latestCaseWriteEntry.item && latestCaseWriteEntry.item.data && typeof latestCaseWriteEntry.item.data === 'object'
            ? latestCaseWriteEntry.item.data
            : null;
          if (!Number.isFinite(caseIndex2) || caseIndex2 <= 0) caseIndex2 = 0;
          else caseIndex2 = Math.floor(caseIndex2);
          if (targetCaseValue) {
            currentSummary = buildCaseExecutionSummary(currentCaseData, targetCaseValue, caseIndex2);
            previousSummary = previousCaseData ? buildCaseExecutionSummary(previousCaseData, targetCaseValue, caseIndex2) : null;
            return {
              text: buildCaseExecutionResultText(currentSummary, previousSummary, Boolean(latestCaseWriteEntry), latestCaseWriteData, hasFreshReadAfterWrite, targetCaseValue),
              priority: 'specific',
            };
          }
        }
        if (fileName) return { text: '已读取当前执行文件“' + fileName + '”的用例，共 ' + total + ' 条。', priority: 'generic' };
        if (total > 0) return { text: '已读取当前用例列表，共 ' + total + ' 条。', priority: 'generic' };
        return { text: '', priority: 'none' };
      }

      var lines = [];
      var observedCaseListFallback = buildObservedCaseListFallback();
      var pageInfoObservation = findLatestObservation('page.current_info');
      var pageDataObservation = findLatestObservation('page.get_data');
      var pageInfoData = pageInfoObservation && pageInfoObservation.data && typeof pageInfoObservation.data === 'object' ? pageInfoObservation.data : {};
      var pageData = pageDataObservation && pageDataObservation.data && typeof pageDataObservation.data === 'object' ? pageDataObservation.data : {};
      var livePageData = {};
      var liveApis = getApis();
      if (liveApis.assistantApi && typeof liveApis.assistantApi.getPageData === 'function') {
        try {
          livePageData = liveApis.assistantApi.getPageData('') || {};
        } catch (err) {
          livePageData = {};
        }
      }
      var pageSnapshot = pageDataObservation ? pageData : pageInfoData;
      if ((!pageSnapshot || !pageSnapshot.tab) && livePageData && typeof livePageData === 'object') {
        pageSnapshot = Object.assign({}, livePageData, pageSnapshot || {});
      }
      var tab = pageSnapshot && pageSnapshot.tab ? String(pageSnapshot.tab).trim() : '';
      var tabLabel = tab ? (getTabLabelById(tab) || tab) : '';
      var asksWhatPage = containsAny(content, ['什么页面', '哪个页面', '当前页面', '中文名', '页面名称']);
      var asksWhatData = containsAny(content, ['什么数据', '有哪些数据', '数据快照', '页面数据', '数据']);
      var asksWhatCanDo = containsAny(content, ['能做什么', '可以做什么', '你能做什么', '能干什么', '可做什么', '做什么', '做些什么'])
        && (containsAny(content, ['页面', '这里', '当前']) || asksWhatPage);
      if (observedCaseListFallback && observedCaseListFallback.priority === 'specific' && observedCaseListFallback.text) {
        return observedCaseListFallback.text;
      }
      if (pageInfoObservation || pageDataObservation) {
        if (tabLabel && tab) lines.push('当前页面是：' + tabLabel + '（' + tab + '）。');
        else if (tabLabel) lines.push('当前页面是：' + tabLabel + '。');
        else if (tab) lines.push('当前页面是：' + tab + '。');
        if (asksWhatData || !asksWhatPage || !asksWhatCanDo) {
          var dataLines = buildObservedPageDataLines(pageSnapshot);
          if (dataLines.length) lines.push('当前已读取到的数据：\n' + dataLines.join('\n'));
        }
        if (asksWhatCanDo) {
          var capabilityLines = buildPageCapabilitySummaryLines(tab);
          if (capabilityLines.length) lines.push('我现在在这个页面可以帮你：\n' + capabilityLines.join('\n'));
        }
        if (lines.length) return lines.join('\n\n');
      }
      if (observedCaseListFallback && observedCaseListFallback.text) lines.push(observedCaseListFallback.text);
      observations.forEach(function(item) {
        var row = item && typeof item === 'object' ? item : {};
        if (isSoftBlockedObservation(row)) return;
        if (!row.message) return;
        lines.push(String(row.message));
      });
      if (!lines.length && observations.length) return '已获取当前结果，但模型还没有给出明确总结。';
      if (!lines.length) return '我暂时没能完成这次任务，请换个说法或稍后重试。';
      return mergeAssistantReplyTextParts(lines) || (observations.length ? '已获取当前结果，但模型还没有给出明确总结。' : '我暂时没能完成这次任务，请换个说法或稍后重试。');
    }

    while (round < maxRounds) {
      var protocol = protocolRetryOverride;
      if (protocolRetryOverride) {
        protocolRetryOverride = null;
      } else {
        protocol = await callAssistantProtocolModel(content, {
          contentBlocks: contentBlocks,
          taskUserText: taskUserText,
          pendingInteraction: pendingSnapshot,
          selectedChoice: selectedChoice,
          observations: observations,
        });
      }
      var protocolText = '';
      var blockedInRound = false;
      var cancelledInRound = false;
      var repeatedSuccessfulWriteCallInRound = false;
      var roundObservations = [];
      var i = 0;
      activeSelectedChoice = selectedChoice && typeof selectedChoice === 'object' ? JSON.parse(JSON.stringify(selectedChoice)) : null;
      pendingSnapshot = null;
      selectedChoice = null;
      if (!protocol) return null;
      protocolText = buildAssistantProtocolResultText(protocol.message, protocol.blocks);
      if (!taskRuntime && (protocol.task || (Array.isArray(protocol.calls) && protocol.calls.length))) {
        taskRuntime = buildAssistantProtocolTaskRuntime(protocol, content);
        syncSelectedChoiceTaskStep();
        if (Array.isArray(protocol.calls) && protocol.calls.length) primeAssistantProtocolRunningStep(taskRuntime, protocol.calls);
        pushTaskUpdate(protocolText || '已进入任务状态，正在执行。');
      } else if (taskRuntime && Array.isArray(protocol.calls) && protocol.calls.length) {
        taskRuntime = ensureAssistantProtocolTaskRuntime(taskRuntime, protocol, content);
        syncSelectedChoiceTaskStep();
        primeAssistantProtocolRunningStep(taskRuntime, protocol.calls);
      }
      if (assistantProtocolRequiresWrite(protocol)) modelDeclaredWriteTask = true;
      if (taskRuntime && taskRuntime.taskState && assistantTaskStateRequiresWrite(taskRuntime.taskState)) modelDeclaredWriteTask = true;
      var callSignature = Array.isArray(protocol.calls) && protocol.calls.length ? buildAssistantProtocolCallSignature(protocol.calls) : '';
      if (callSignature && successfulCallSignatures[callSignature]) {
        var repeatedReadOnlyCalls = areAssistantProtocolCallsReadOnly(protocol.calls);
        var repeatedSuccessfulWriteCalls = !repeatedReadOnlyCalls && hasSuccessfulWriteCall;
        var repeatedFallbackText = buildObservationFallbackText() || '';
        var pendingWriteRequirement = assistantBuildPendingWriteRequirement(content, observations, {
          taskUserText: taskUserText,
          requiresWrite: modelDeclaredWriteTask,
          hasSuccessfulWriteCall: hasSuccessfulWriteCall,
          protocol: protocol,
          fallbackText: repeatedFallbackText,
        });
        var repeatObservation = {
          capability: 'assistant.runtime.repeat_calls',
          status: repeatedSuccessfulWriteCalls ? 'ok' : 'blocked',
          message: repeatedSuccessfulWriteCalls
            ? '模型重复返回了已成功执行过的写操作，平台已跳过重复执行，请直接基于 observations 汇总结果。'
            : '模型重复返回了已经成功执行过的相同 calls，请直接基于 observations 汇总结果，或只返回新的 calls。',
          data: {
            signature: callSignature,
            callCount: Array.isArray(protocol.calls) ? protocol.calls.length : 0,
          },
          choices: [],
        };
        observations.push(repeatObservation);
        markTaskRuntimeAwaitingModel('已完成本轮步骤，正在整理结果。');
        if (repeatedSuccessfulWriteCalls) {
          var repeatedWriteFinalProtocol = await callAssistantProtocolModel(content, {
            contentBlocks: contentBlocks,
            taskUserText: taskUserText,
            pendingInteraction: null,
            selectedChoice: null,
            observations: observations,
            forceNoCalls: true,
          });
          if (repeatedWriteFinalProtocol && (!Array.isArray(repeatedWriteFinalProtocol.calls) || !repeatedWriteFinalProtocol.calls.length)) {
            var repeatedWriteText = buildAssistantProtocolResultText(repeatedWriteFinalProtocol.message, repeatedWriteFinalProtocol.blocks);
            var repeatedWriteSummary = repeatedWriteFinalProtocol.task && repeatedWriteFinalProtocol.task.summary
              ? repeatedWriteFinalProtocol.task.summary
              : (repeatedWriteText || '任务已完成。');
            if (taskRuntime && taskRuntime.taskState) {
              syncAssistantProtocolFinalizeStep(taskRuntime, 'completed', repeatedWriteSummary);
              setAssistantTaskStateStatus(taskRuntime.taskState, 'completed', repeatedWriteSummary);
            }
            return {
              handled: true,
              text: repeatedWriteText || '任务已完成。',
              messageOptions: {
                blocks: normalizeAssistantBlocks(Array.isArray(repeatedWriteFinalProtocol.blocks) ? repeatedWriteFinalProtocol.blocks : []),
                taskState: taskRuntime && taskRuntime.taskState ? taskRuntime.taskState : null,
              },
            };
          }
          var repeatedWriteFallbackText = buildObservationFallbackText() || '写操作已完成。';
          if (taskRuntime && taskRuntime.taskState) {
            syncAssistantProtocolFinalizeStep(taskRuntime, 'completed', repeatedWriteFallbackText);
            setAssistantTaskStateStatus(taskRuntime.taskState, 'completed', repeatedWriteFallbackText);
          }
          return {
            handled: true,
            text: repeatedWriteFallbackText,
            messageOptions: {
              blocks: [],
              taskState: taskRuntime && taskRuntime.taskState ? taskRuntime.taskState : null,
            },
          };
        }
        if (repeatedReadOnlyCalls && repeatedCallGuardCount < 1) {
          var recoveryProtocol = await callAssistantProtocolModel(content, {
            contentBlocks: contentBlocks,
            taskUserText: taskUserText,
            pendingInteraction: null,
            selectedChoice: null,
            observations: observations,
            blockedCalls: protocol.calls,
            extraInstructions: pendingWriteRequirement && pendingWriteRequirement.instruction ? [pendingWriteRequirement.instruction] : [],
          });
          var recoverySignature = recoveryProtocol && Array.isArray(recoveryProtocol.calls) && recoveryProtocol.calls.length
            ? buildAssistantProtocolCallSignature(recoveryProtocol.calls)
            : '';
          if (recoveryProtocol && (!recoverySignature || recoverySignature !== callSignature)) {
            protocolRetryOverride = recoveryProtocol;
            round += 1;
            continue;
          }
        }
        repeatedCallGuardCount += 1;
        if (repeatedReadOnlyCalls && pendingWriteRequirement && pendingWriteRequirement.instruction && pendingWriteRecoveryCount < 1) {
          pendingWriteRecoveryCount += 1;
          var writeRecoveryProtocol = await callAssistantProtocolModel(content, {
            contentBlocks: contentBlocks,
            taskUserText: taskUserText,
            pendingInteraction: null,
            selectedChoice: null,
            observations: observations,
            blockedCalls: protocol.calls,
            extraInstructions: [
              pendingWriteRequirement.instruction,
              '你刚刚重复了读取 calls。现有 observation 说明用户要的修改还没执行；这一轮必须返回新的写 calls，不能只给读操作或直接结束。'
            ],
          });
          var writeRecoverySignature = writeRecoveryProtocol && Array.isArray(writeRecoveryProtocol.calls) && writeRecoveryProtocol.calls.length
            ? buildAssistantProtocolCallSignature(writeRecoveryProtocol.calls)
            : '';
          if (writeRecoveryProtocol && (!writeRecoverySignature || writeRecoverySignature !== callSignature)) {
            protocolRetryOverride = writeRecoveryProtocol;
            round += 1;
            continue;
          }
        }
        if (repeatedReadOnlyCalls) {
          var forcedFinalProtocol = await callAssistantProtocolModel(content, {
            contentBlocks: contentBlocks,
            taskUserText: taskUserText,
            pendingInteraction: null,
            selectedChoice: null,
            observations: observations,
            forceNoCalls: true,
            blockedCalls: protocol.calls,
          });
          if (forcedFinalProtocol && (!Array.isArray(forcedFinalProtocol.calls) || !forcedFinalProtocol.calls.length)) {
            var forcedText = buildAssistantProtocolResultText(forcedFinalProtocol.message, forcedFinalProtocol.blocks);
            var forcedSummary = forcedFinalProtocol.task && forcedFinalProtocol.task.summary
              ? forcedFinalProtocol.task.summary
              : (forcedText || '任务已完成。');
            var forcedFallbackText = forcedText || buildObservationFallbackText() || '任务已完成。';
            var forcedPendingWriteRequirement = assistantBuildPendingWriteRequirement(content, observations, {
              taskUserText: taskUserText,
              requiresWrite: modelDeclaredWriteTask,
              hasSuccessfulWriteCall: hasSuccessfulWriteCall,
              protocol: forcedFinalProtocol,
              fallbackText: forcedFallbackText,
            });
            var forcedBlocked = !!forcedPendingWriteRequirement;
            var forcedFinalText = forcedFallbackText;
            if (forcedBlocked) forcedFinalText = mergeAssistantReplyTextParts([forcedFinalText, '模型未返回必要的写操作，当前任务尚未完成。']);
            if (taskRuntime && taskRuntime.taskState) {
              syncAssistantProtocolFinalizeStep(taskRuntime, forcedBlocked ? 'blocked' : 'completed', forcedBlocked ? forcedFinalText : forcedSummary);
              setAssistantTaskStateStatus(taskRuntime.taskState, forcedBlocked ? 'blocked' : 'completed', forcedBlocked ? forcedFinalText : forcedSummary);
            }
            return {
              handled: true,
              text: forcedFinalText,
              messageOptions: {
                blocks: normalizeAssistantBlocks((forcedFinalProtocol.blocks || []).concat([{
                  type: 'notice',
                  level: forcedBlocked ? 'error' : 'warn',
                  title: forcedBlocked ? '任务未完成' : '已停止重复执行',
                  text: forcedBlocked
                    ? '模型连续仅读取而没有返回必要的写操作，平台已停止重复执行。'
                    : '模型重复返回了相同的已执行 calls，平台已停止重复执行，并基于 observations 整理回复。'
                }])),
                taskState: taskRuntime && taskRuntime.taskState ? taskRuntime.taskState : null,
              },
            };
          }
        }
        if (repeatedCallGuardCount >= 2) {
          var repeatGuardFallbackText = buildObservationFallbackText() || '已根据当前结果结束任务。';
          var repeatGuardBlocked = hasHardBlockedObservation(observations) || !!pendingWriteRequirement;
          if (pendingWriteRequirement) {
            repeatGuardFallbackText = mergeAssistantReplyTextParts([repeatGuardFallbackText, '模型未返回必要的写操作，当前任务尚未完成。']);
          }
          if (taskRuntime && taskRuntime.taskState) {
            syncAssistantProtocolFinalizeStep(taskRuntime, repeatGuardBlocked ? 'blocked' : 'completed', repeatGuardFallbackText);
            setAssistantTaskStateStatus(taskRuntime.taskState, repeatGuardBlocked ? 'blocked' : 'completed', repeatGuardFallbackText);
          }
          return {
            handled: true,
            text: repeatGuardFallbackText,
            messageOptions: {
              blocks: [{
                type: 'notice',
                level: repeatGuardBlocked ? 'error' : 'warn',
                title: repeatGuardBlocked ? '执行已中断' : '已停止重复执行',
                text: repeatGuardBlocked
                  ? (pendingWriteRequirement ? '模型连续仅读取而没有返回必要的写操作，请调整指令或模型后重试。' : '模型连续重复了相同的任务调用，请调整指令后重试。')
                  : '模型连续重复了相同的读取 calls，平台已停止重复执行，并基于现有 observation 返回结果。'
              }],
              taskState: taskRuntime && taskRuntime.taskState ? taskRuntime.taskState : null,
            },
          };
        }
        round += 1;
        continue;
      }
      if (!Array.isArray(protocol.calls) || !protocol.calls.length) {
        var clarificationPending = buildAssistantProtocolClarificationPendingInteraction(protocol, taskRuntime, taskUserText || content);
        if (clarificationPending) {
          rememberPendingInteraction(clarificationPending);
          if (taskRuntime && taskRuntime.taskState) {
            syncSelectedChoiceTaskStep('已收到你的回复，仍需补充信息后继续。');
            markAssistantTaskRuntimeWaiting(taskRuntime, clarificationPending.prompt || '等待你补充信息后继续。');
            pushTaskUpdate(clarificationPending.prompt || '等待你补充信息后继续。');
          }
          return {
            handled: true,
            text: protocolText || clarificationPending.prompt || '请补充信息后继续。',
            messageOptions: {
              blocks: normalizeAssistantBlocks(Array.isArray(protocol.blocks) ? protocol.blocks : []),
              taskState: taskRuntime && taskRuntime.taskState ? taskRuntime.taskState : null,
            },
          };
        }
        var noCallFallbackText = buildObservationFallbackText() || '';
        var noCallPendingWriteRequirement = assistantBuildPendingWriteRequirement(content, observations, {
          taskUserText: taskUserText,
          requiresWrite: modelDeclaredWriteTask,
          hasSuccessfulWriteCall: hasSuccessfulWriteCall,
          protocol: protocol,
          fallbackText: noCallFallbackText,
        });
        if (noCallPendingWriteRequirement && !hasSuccessfulWriteCall && pendingWriteRecoveryCount < 1) {
          pendingWriteRecoveryCount += 1;
          var noCallRecoveryProtocol = await callAssistantProtocolModel(content, {
            contentBlocks: contentBlocks,
            taskUserText: taskUserText,
            pendingInteraction: null,
            selectedChoice: null,
            observations: observations,
            extraInstructions: [
              noCallPendingWriteRequirement.instruction,
              '你刚刚直接结束了任务，但 observation 显示修改尚未执行。请改为返回新的写 calls，或明确说明为什么不能写。'
            ],
          });
          if (noCallRecoveryProtocol && Array.isArray(noCallRecoveryProtocol.calls) && noCallRecoveryProtocol.calls.length) {
            protocolRetryOverride = noCallRecoveryProtocol;
            round += 1;
            continue;
          }
        }
        if (taskRuntime && taskRuntime.taskState) {
          var noCallBlocked = !!noCallPendingWriteRequirement && !hasSuccessfulWriteCall;
          var noCallSummary = protocol.task && protocol.task.summary ? protocol.task.summary : (protocolText || '任务已完成。');
          var noCallText = protocolText || noCallFallbackText || '任务已完成。';
          if (noCallBlocked) noCallText = mergeAssistantReplyTextParts([noCallText, '模型未返回必要的写操作，当前任务尚未完成。']);
          syncSelectedChoiceTaskStep(noCallBlocked ? '已确认你的选择，但当前任务尚未完成。' : '已确认你的选择，任务已完成。');
          syncAssistantProtocolFinalizeStep(taskRuntime, noCallBlocked ? 'blocked' : (taskRuntime.taskState.status === 'blocked' ? 'blocked' : 'completed'), noCallBlocked ? noCallText : noCallSummary);
          setAssistantTaskStateStatus(taskRuntime.taskState, noCallBlocked ? 'blocked' : (taskRuntime.taskState.status === 'blocked' ? 'blocked' : 'completed'), noCallBlocked ? noCallText : noCallSummary);
        }
        return {
          handled: true,
          text: (!!noCallPendingWriteRequirement && !hasSuccessfulWriteCall)
            ? mergeAssistantReplyTextParts([protocolText || '', '模型未返回必要的写操作，当前任务尚未完成。'])
            : (protocolText || noCallFallbackText || (taskRuntime && taskRuntime.taskState ? '任务已完成。' : '')),
          messageOptions: {
            blocks: (!!noCallPendingWriteRequirement && !hasSuccessfulWriteCall)
              ? normalizeAssistantBlocks((protocol.blocks || []).concat([{ type: 'notice', level: 'error', title: '任务未完成', text: '模型在应当执行写操作时直接结束了任务。' }]))
              : protocol.blocks,
            taskState: taskRuntime && taskRuntime.taskState ? taskRuntime.taskState : null,
          },
        };
      }
      for (i = 0; i < protocol.calls.length; i += 1) {
        var call = protocol.calls[i] && typeof protocol.calls[i] === 'object' ? protocol.calls[i] : {};
        var stepId = buildAssistantProtocolTaskStepId(call.stepId || call.id, i);
        var stepIndex = taskRuntime && taskRuntime.stepIndexById && Object.prototype.hasOwnProperty.call(taskRuntime.stepIndexById, stepId)
          ? Number(taskRuntime.stepIndexById[stepId])
          : -1;
        var capabilityId = normalizeMcpToolName(call.capability || call.tool || call.name || '');
        var execResult = null;
        var observation = null;
        var pendingForChoice = null;
        var pendingBlock = null;
        var callArgs = call.args && typeof call.args === 'object' ? call.args : {};
        var normalizedCallArgs = null;
        var executionSignature = '';
        var previousSuccessfulObservation = null;
        if (!capabilityId) continue;
        var normalizedCall = normalizeAssistantCapabilityCallForExecution(capabilityId, callArgs, content);
        capabilityId = normalizedCall.capabilityId;
        normalizedCallArgs = normalizedCall.args;
        executionSignature = buildAssistantCapabilityExecutionSignature(capabilityId, normalizedCallArgs);
        if (executionSignature && successfulCapabilityExecutionObservations[executionSignature]) {
          previousSuccessfulObservation = successfulCapabilityExecutionObservations[executionSignature];
          observation = {
            capability: capabilityId,
            status: 'ok',
            message: previousSuccessfulObservation && previousSuccessfulObservation.message
              ? String(previousSuccessfulObservation.message)
              : '相同操作已执行成功，已跳过重复执行。',
            data: previousSuccessfulObservation && previousSuccessfulObservation.data && typeof previousSuccessfulObservation.data === 'object'
              ? JSON.parse(JSON.stringify(previousSuccessfulObservation.data))
              : (previousSuccessfulObservation ? previousSuccessfulObservation.data : null),
            choices: [],
          };
          roundObservations.push(observation);
          if (getMcpToolMode(capabilityId) === 'write') repeatedSuccessfulWriteCallInRound = true;
          if (taskRuntime && taskRuntime.taskState && stepIndex >= 0) {
            setAssistantTaskStateStepStatus(taskRuntime.taskState, stepIndex, 'completed', '当前步骤已完成，正在整理结果。');
            if (i < protocol.calls.length - 1) {
              pushTaskUpdate('当前步骤已完成，继续整理结果。');
            } else {
              markTaskRuntimeAwaitingModel('本轮步骤已完成，正在整理结果。');
            }
          }
          continue;
        }
        executedCalls += 1;
        if (executedCalls > maxExecutedCalls) {
          if (taskRuntime && taskRuntime.taskState && stepIndex >= 0) {
            setAssistantTaskStateStepStatus(taskRuntime.taskState, stepIndex, 'blocked', '任务调用轮次已达上限。');
            syncAssistantProtocolFinalizeStep(taskRuntime, 'blocked', '任务调用轮次已达上限。');
            pushTaskUpdate('任务调用轮次已达上限。');
          }
          observations.push({ capability: capabilityId, status: 'blocked', message: '任务调用轮次已达上限。', data: null, choices: [] });
          return {
            handled: true,
            text: buildObservationFallbackText(),
            messageOptions: {
              blocks: [{ type: 'notice', level: 'error', title: '执行已中断', text: '任务调用轮次已达上限，请调整指令后重试。' }],
              taskState: taskRuntime && taskRuntime.taskState ? taskRuntime.taskState : null,
            },
          };
        }
        if (taskRuntime && taskRuntime.taskState && stepIndex >= 0) {
          setAssistantTaskStateStepStatus(taskRuntime.taskState, stepIndex, 'running', '正在执行：' + taskRuntime.taskState.steps[stepIndex].label);
          pushTaskUpdate(protocolText || '已进入任务状态，正在执行。');
          await waitForAssistantUiRender();
        }
        execResult = await executeAssistantCapabilityWithRuntimeGate(capabilityId, normalizedCallArgs);
        observation = buildAssistantCapabilityObservation(capabilityId, normalizedCallArgs, execResult || {});
        roundObservations.push(observation);
        if (execResult && execResult.ok === true && executionSignature) {
          successfulCapabilityExecutionObservations[executionSignature] = observation && typeof observation === 'object'
            ? JSON.parse(JSON.stringify(observation))
            : null;
        }
        if (execResult && execResult.status === 'choice_required') {
          pendingForChoice = {
            kind: 'choice_required',
            prompt: execResult.message || '请先选择后继续。',
            sourceUserText: taskUserText || content,
            sourceCapability: capabilityId,
            baseArgs: normalizedCallArgs,
            choices: execResult.choices || [],
            observation: observation,
            taskState: taskRuntime && taskRuntime.taskState ? taskRuntime.taskState : null,
            taskStepId: stepId,
            selectedChoice: null,
          };
          rememberPendingInteraction(pendingForChoice);
          pendingBlock = buildPendingInteractionChoiceBlock(pendingForChoice);
          if (taskRuntime && taskRuntime.taskState && stepIndex >= 0) {
            setAssistantTaskStateStepStatus(taskRuntime.taskState, stepIndex, 'waiting', execResult.message || '等待你选择后继续。');
            pushTaskUpdate(execResult.message || '等待你选择后继续。');
          }
          observations = observations.concat(roundObservations);
          return {
            handled: true,
            text: protocolText || execResult.message || '请先选择后继续。',
            messageOptions: {
              blocks: normalizeAssistantBlocks((protocol.blocks || []).concat(pendingBlock ? [pendingBlock] : [])),
              taskState: taskRuntime && taskRuntime.taskState ? taskRuntime.taskState : null,
            },
          };
        }
        if (!execResult || execResult.ok !== true) {
          blockedInRound = true;
          cancelledInRound = execResult && execResult.message === '用户拒绝了本次操作。';
          if (taskRuntime && taskRuntime.taskState && stepIndex >= 0) {
            setAssistantTaskStateStepStatus(taskRuntime.taskState, stepIndex, cancelledInRound ? 'cancelled' : 'blocked', execResult && execResult.message ? execResult.message : '当前步骤执行失败。');
            pushTaskUpdate(execResult && execResult.message ? execResult.message : '当前步骤执行失败。');
          }
          break;
        }
        if (getMcpToolMode(capabilityId) === 'write') hasSuccessfulWriteCall = true;
        if (taskRuntime && taskRuntime.taskState && stepIndex >= 0) {
          setAssistantTaskStateStepStatus(taskRuntime.taskState, stepIndex, 'completed', i < protocol.calls.length - 1 ? '当前步骤已完成，继续执行后续步骤。' : '本轮步骤已完成，正在整理结果。');
          if (i < protocol.calls.length - 1) {
            pushTaskUpdate(protocolText || '已进入任务状态，正在执行。');
          } else {
            markTaskRuntimeAwaitingModel('本轮步骤已完成，正在整理结果。');
          }
        }
      }
      observations = observations.concat(roundObservations);
      if (!blockedInRound && !cancelledInRound && callSignature) {
        successfulCallSignatures[callSignature] = true;
      }
      if (!blockedInRound && !cancelledInRound && repeatedSuccessfulWriteCallInRound) {
        var repeatedWriteProtocol = await callAssistantProtocolModel(content, {
          contentBlocks: contentBlocks,
          taskUserText: taskUserText,
          pendingInteraction: null,
          selectedChoice: null,
          observations: observations,
          forceNoCalls: true,
        });
        if (repeatedWriteProtocol && (!Array.isArray(repeatedWriteProtocol.calls) || !repeatedWriteProtocol.calls.length)) {
          var repeatedWriteProtocolText = buildAssistantProtocolResultText(repeatedWriteProtocol.message, repeatedWriteProtocol.blocks);
          var repeatedWriteProtocolSummary = repeatedWriteProtocol.task && repeatedWriteProtocol.task.summary
            ? repeatedWriteProtocol.task.summary
            : (repeatedWriteProtocolText || '任务已完成。');
          if (taskRuntime && taskRuntime.taskState) {
            syncAssistantProtocolFinalizeStep(taskRuntime, 'completed', repeatedWriteProtocolSummary);
            setAssistantTaskStateStatus(taskRuntime.taskState, 'completed', repeatedWriteProtocolSummary);
          }
          return {
            handled: true,
            text: repeatedWriteProtocolText || '任务已完成。',
            messageOptions: {
              blocks: normalizeAssistantBlocks(Array.isArray(repeatedWriteProtocol.blocks) ? repeatedWriteProtocol.blocks : []),
              taskState: taskRuntime && taskRuntime.taskState ? taskRuntime.taskState : null,
            },
          };
        }
        var repeatedWriteRoundFallbackText = buildObservationFallbackText() || '写操作已完成。';
        if (taskRuntime && taskRuntime.taskState) {
          syncAssistantProtocolFinalizeStep(taskRuntime, 'completed', repeatedWriteRoundFallbackText);
          setAssistantTaskStateStatus(taskRuntime.taskState, 'completed', repeatedWriteRoundFallbackText);
        }
        return {
          handled: true,
          text: repeatedWriteRoundFallbackText,
          messageOptions: {
            blocks: [],
            taskState: taskRuntime && taskRuntime.taskState ? taskRuntime.taskState : null,
          },
        };
      }
      if (cancelledInRound) {
        if (taskRuntime && taskRuntime.taskState) {
          syncAssistantProtocolFinalizeStep(taskRuntime, 'cancelled', '用户取消了本次任务。');
          setAssistantTaskStateStatus(taskRuntime.taskState, 'cancelled', '用户取消了本次任务。');
        }
        return {
          handled: true,
          text: protocolText || '已取消。',
          messageOptions: {
            blocks: normalizeAssistantBlocks((protocol.blocks || []).concat([{ type: 'notice', level: 'warn', title: '任务已取消', text: '用户拒绝了本次操作。' }])),
            taskState: taskRuntime && taskRuntime.taskState ? taskRuntime.taskState : null,
          },
        };
      }
      if (blockedInRound) {
        var latestBlockedObservation = roundObservations.length ? roundObservations[roundObservations.length - 1] : null;
        var latestBlockedStatus = latestBlockedObservation && latestBlockedObservation.status ? String(latestBlockedObservation.status) : '';
        var latestBlockedMessage = latestBlockedObservation && latestBlockedObservation.message ? String(latestBlockedObservation.message) : '';
        if (latestBlockedStatus === 'blocked') {
          var blockedReplyText = latestBlockedMessage || buildObservationFallbackText() || '当前步骤执行失败。';
          if (taskRuntime && taskRuntime.taskState) {
            syncAssistantProtocolFinalizeStep(taskRuntime, 'blocked', blockedReplyText);
            setAssistantTaskStateStatus(taskRuntime.taskState, 'blocked', blockedReplyText);
          }
          return {
            handled: true,
            text: blockedReplyText,
            messageOptions: {
              blocks: normalizeAssistantBlocks((protocol.blocks || []).concat([{ type: 'notice', level: 'error', title: '执行受阻', text: blockedReplyText }])),
              taskState: taskRuntime && taskRuntime.taskState ? taskRuntime.taskState : null,
            },
          };
        }
        round += 1;
        continue;
      }
      round += 1;
    }
    if (observations.length) {
      var fallbackText = buildObservationFallbackText() || '已获得执行结果，但模型没有返回最终总结。';
      var fallbackStatus = 'completed';
      var fallbackLevel = 'warn';
      var fallbackTitle = '已根据当前结果结束任务';
      var fallbackNoticeText = '模型未继续收敛，平台已基于现有 observation 返回结果。';
      var fallbackPendingWriteRequirement = assistantBuildPendingWriteRequirement(content, observations, {
        taskUserText: taskUserText,
        requiresWrite: modelDeclaredWriteTask,
        hasSuccessfulWriteCall: hasSuccessfulWriteCall,
        fallbackText: fallbackText,
      });
      var fallbackObservationIndex = 0;
      for (fallbackObservationIndex = observations.length - 1; fallbackObservationIndex >= 0; fallbackObservationIndex -= 1) {
        var fallbackObservation = observations[fallbackObservationIndex] && typeof observations[fallbackObservationIndex] === 'object' ? observations[fallbackObservationIndex] : null;
        if (!fallbackObservation) continue;
        if (String(fallbackObservation.status || '') !== 'blocked') continue;
        if (isSoftBlockedObservation(fallbackObservation)) continue;
        fallbackStatus = 'blocked';
        fallbackLevel = 'error';
        fallbackTitle = '执行受阻';
        fallbackNoticeText = '部分步骤执行受阻，平台已基于现有 observation 返回结果。';
        break;
      }
      if (fallbackStatus !== 'blocked' && fallbackPendingWriteRequirement) {
        fallbackStatus = 'blocked';
        fallbackLevel = 'error';
        fallbackTitle = '任务未完成';
        fallbackNoticeText = '模型未返回必要的写操作，平台已基于现有 observation 停止执行。';
        fallbackText = mergeAssistantReplyTextParts([fallbackText, '模型未返回必要的写操作，当前任务尚未完成。']);
      }
      if (taskRuntime && taskRuntime.taskState) {
        syncAssistantProtocolFinalizeStep(taskRuntime, fallbackStatus, fallbackText);
        setAssistantTaskStateStatus(taskRuntime.taskState, fallbackStatus, fallbackText);
      }
      return {
        handled: true,
        text: fallbackText,
        messageOptions: {
          blocks: [{ type: 'notice', level: fallbackLevel, title: fallbackTitle, text: fallbackNoticeText }],
          taskState: taskRuntime && taskRuntime.taskState ? taskRuntime.taskState : null,
        },
      };
    }
    if (taskRuntime && taskRuntime.taskState) {
      syncAssistantProtocolFinalizeStep(taskRuntime, 'blocked', '任务尚未收敛，请稍后重试。');
      setAssistantTaskStateStatus(taskRuntime.taskState, 'blocked', '任务尚未收敛，请稍后重试。');
    }
    return {
      handled: true,
      text: buildObservationFallbackText(),
      messageOptions: {
        blocks: [{ type: 'notice', level: 'error', title: '任务未完成', text: '模型未能在限定轮次内给出最终结果，请调整指令后重试。' }],
        taskState: taskRuntime && taskRuntime.taskState ? taskRuntime.taskState : null,
      },
    };
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

  async function handleUserInput(text, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var attachments = normalizeAssistantMessageAttachments(opts.attachments);
    var contentBlocks = normalizeAssistantContentBlocks(opts.contentBlocks);
    var hasImageInput = assistantContentBlocksHaveImage(contentBlocks) || attachments.length > 0;
    var content = composeAssistantConversationContent(text, attachments);
    if (!content && !hasImageInput) return;
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

    function updateAiTaskState(taskState, taskText) {
      var nextTaskState = normalizeAssistantTaskState(taskState);
      var nextText = taskText === undefined || taskText === null ? '已进入任务状态，正在执行。' : String(taskText);
      if (!nextTaskState) return;
      setStatus('');
      if (pendingReplyId) {
        replaceMessage(pendingReplyId, nextText, {
          role: 'ai',
          title: getRoleTitle('ai'),
          thinking: false,
          transient: false,
          taskState: nextTaskState,
        });
        return;
      }
      addMessage('ai', nextText, { taskState: nextTaskState });
    }

    if (containsAny(content, ['关闭助手', '禁用助手'])) {
      addAiReply('安全策略限制：助手不能通过聊天关闭自己。请到设置页手动关闭。');
      return;
    }

    var protocolV2Reply = await tryHandleAssistantProtocolV2(text, {
      attachments: attachments,
      contentBlocks: contentBlocks,
      onTaskStateChange: updateAiTaskState,
    });
    if (protocolV2Reply && protocolV2Reply.handled && (protocolV2Reply.text || (protocolV2Reply.messageOptions && (protocolV2Reply.messageOptions.blocks || protocolV2Reply.messageOptions.taskState)))) {
      addAiReply(protocolV2Reply.text || '', protocolV2Reply.messageOptions || {});
      return;
    }

    var apis = getApis();
    if (!apis.assistantApi || typeof apis.assistantApi.callModel !== 'function') {
      addAiReply('助手主对话能力暂不可用，请稍后重试。');
      return;
    }
    addAiReply('回复失败：助手未返回可用的 assistant_v2 结果，请稍后重试。', {
      blocks: [{
        type: 'notice',
        level: 'error',
        title: '协议返回异常',
        text: '当前仅保留 assistant_v2 主流程，本轮没有拿到可执行结果。请重试，或换一种更明确的说法。'
      }],
    });
    setStatus('回复失败');
  }

  function dispatchAssistantConversationMessage(text, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var messageText = text === undefined || text === null ? '' : String(text).trim();
    var attachments = normalizeAssistantMessageAttachments(opts.attachments);
    var contentBlocks = normalizeAssistantContentBlocks(opts.contentBlocks);
    if (!messageText && !attachments.length) return false;
    if (!contentBlocks.length) contentBlocks = buildAssistantRequestContentBlocks(messageText, attachments);
    addMessage('user', messageText, { attachments: attachments });
    var thinking = addMessage('ai', '', {
      thinking: true,
      transient: true,
      title: '助手',
    });
    var pendingId = thinking && thinking.id ? String(thinking.id) : '';
    setReplyPending(true);
    handleUserInput(messageText, {
      pendingReplyId: pendingId,
      attachments: attachments,
      contentBlocks: contentBlocks,
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
    return true;
  }

  function submitAssistantQuickReply(text) {
    var replyText = text === undefined || text === null ? '' : String(text).trim();
    if (!replyText) return false;
    if (replyPending) {
      setStatus('助手正在思考中，请稍候。');
      return false;
    }
    if (!isAssistantEnabled()) {
      setStatus('助手未开启，请先到设置页开启。');
      openSettingsForAssistant();
      return false;
    }
    return dispatchAssistantConversationMessage(replyText, {
      attachments: [],
      contentBlocks: buildAssistantRequestContentBlocks(replyText, []),
    });
  }

  function handleSend() {
    if (!inputEl) return;
    if (replyPending) {
      setStatus('助手正在思考中，请稍候。');
      return;
    }
    if (attachmentPendingCount > 0) {
      setStatus('图片仍在处理中，请稍候再发送。');
      return;
    }
    if (!isAssistantEnabled()) {
      setStatus('助手未开启，请先到设置页开启。');
      openSettingsForAssistant();
      return;
    }
    var text = String(inputEl.value || '').trim();
    var attachments = cloneAssistantAttachments(pendingAttachments);
    if (!text && !attachments.length) return;
    if (attachments.length) {
      var apis = getApis();
      var modelInfo = apis.assistantApi && typeof apis.assistantApi.getSelectedModelInfo === 'function'
        ? apis.assistantApi.getSelectedModelInfo()
        : null;
      if (modelInfo && modelInfo.configured && modelInfo.supportsImage !== true) {
        var modelName = modelInfo.modelName ? '“' + modelInfo.modelName + '”' : '当前模型';
        setStatus(modelName + '不支持图片输入，请切换支持视觉/多模态的模型，或先移除图片后再发送。');
        return;
      }
    }
    var contentBlocks = buildAssistantRequestContentBlocks(text, attachments);
    inputEl.value = '';
    clearPendingAttachments();
    dispatchAssistantConversationMessage(text, {
      attachments: attachments,
      contentBlocks: contentBlocks,
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
    if (attachBtn) {
      attachBtn.addEventListener('click', function() {
        if (replyPending || attachmentPendingCount > 0 || !imageInputEl) return;
        imageInputEl.click();
      });
    }
    if (imageInputEl) {
      imageInputEl.addEventListener('change', function() {
        var files = imageInputEl.files ? Array.prototype.slice.call(imageInputEl.files) : [];
        appendPendingAttachments(files, 'picker').finally(function() {
          if (imageInputEl) imageInputEl.value = '';
        });
      });
    }
    if (attachmentListEl) {
      attachmentListEl.addEventListener('click', function(e) {
        var removeNode = e && e.target && e.target.closest ? e.target.closest('.assistant-attachment-remove') : null;
        if (removeNode) {
          e.preventDefault();
          if (removePendingAttachment(removeNode.dataset.attachmentId || '')) {
            setStatus('已移除图片。');
          }
          return;
        }
        var linkNode = e && e.target && e.target.closest ? e.target.closest('.assistant-attachment-link') : null;
        if (!linkNode) return;
        e.preventDefault();
        var attachment = findPendingAttachmentById(linkNode.dataset.attachmentId || '');
        if (!attachment) return;
        openAssistantImagePreview(attachment.dataUrl || attachment.url || '', attachment.name || '图片');
      });
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
        var imageNode = node.closest('.assistant-image-preview-trigger');
        if (imageNode) {
          e.preventDefault();
          openAssistantImagePreview(imageNode.dataset.previewSrc || imageNode.getAttribute('src') || '', imageNode.dataset.previewName || imageNode.getAttribute('alt') || '图片');
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
      inputEl.addEventListener('input', function() {
        refreshSendState();
      });
      inputEl.addEventListener('paste', function(e) {
        var files = collectClipboardImageFiles(e);
        if (!files.length) return;
        e.preventDefault();
        appendPendingAttachments(files, 'paste');
      });
    }
    if (inputBoxEl) {
      inputBoxEl.addEventListener('click', function(e) {
        var target = e && e.target ? e.target : null;
        if (!inputEl || !target || target !== inputBoxEl) return;
        inputEl.focus();
      });
      ['dragenter', 'dragover'].forEach(function(name) {
        inputBoxEl.addEventListener(name, function(e) {
          var files = collectDataTransferImageFiles(e && e.dataTransfer ? e.dataTransfer : null);
          if (!files.length || replyPending || attachmentPendingCount > 0) return;
          e.preventDefault();
          inputBoxEl.classList.add('dragover');
        });
      });
      ['dragleave', 'dragend'].forEach(function(name) {
        inputBoxEl.addEventListener(name, function(e) {
          var related = e && e.relatedTarget ? e.relatedTarget : null;
          if (related && inputBoxEl.contains(related)) return;
          inputBoxEl.classList.remove('dragover');
        });
      });
      inputBoxEl.addEventListener('drop', function(e) {
        var files = collectDataTransferImageFiles(e && e.dataTransfer ? e.dataTransfer : null);
        inputBoxEl.classList.remove('dragover');
        if (!files.length || replyPending || attachmentPendingCount > 0) return;
        e.preventDefault();
        appendPendingAttachments(files, 'drop');
        if (inputEl) inputEl.focus();
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
    composerEl = byId('assistantComposer');
    attachmentsEl = byId('assistantAttachments');
    inputBoxEl = byId('assistantInputBox');
    attachBtn = byId('assistantAttachBtn');
    imageInputEl = byId('assistantImageInput');
    attachmentListEl = byId('assistantAttachmentList');
    inputEl = byId('assistantInput');
    sendBtn = byId('assistantSendBtn');
    casePreview = byId('assistantCasePreview');
    casePreviewCloseBtn = byId('assistantCasePreviewClose');
    casePreviewBody = byId('assistantCasePreviewBody');

    renderPendingAttachments();
    refreshSendState();
    return Boolean(launcher && launcherBtn && panel && messagesEl && inputEl && sendBtn);
  }

  function init() {
    if (initialized) return;
    if (!setupDom()) return;
    initialized = true;
    bindUiEvents();
    bindRuntimeEvents();
    loadHistory();
    renderPendingAttachments();
    refreshSendState();
    refreshState();
    if (window.app) {
      window.app.formatTempExecReuseUpdateSuccessTextForTest = formatTempExecReuseUpdateSuccessText;
    }
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
