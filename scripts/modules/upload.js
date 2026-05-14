(function() {
  function init(ctx) {
    if (!ctx) return {};
    var handlers = ctx.handlers || {};
    var dom = ctx.dom || {};

    var handleFile = handlers.handleFile;
    var JSZip = (typeof window !== 'undefined' && window.JSZip) ? window.JSZip : null;
    var parseDocxFromHandler = handlers.parseDocx;
    var parseDocxInternal = createDocxParser(JSZip);
    var setStepInProgress = handlers.setStepInProgress || function() {};
    var clearStepInProgress = handlers.clearStepInProgress || function() {};
    var setRequirementLabel = handlers.setRequirementLabel || function() {};
    var guardRequirementImport = handlers.guardRequirementImport || function() { return Promise.resolve(true); };
    var renderAutoRawInfo = handlers.renderAutoRawInfo || function() {};
    var updateAutoCompareActions = handlers.updateAutoCompareActions || function() {};
    var updateAutoMissingCard = handlers.updateAutoMissingCard || function() {};
    var updateFlowStatus = handlers.updateFlowStatus || function() {};
    var persistWorkflowState = handlers.persistWorkflowState || function() {};
    var setStatus = handlers.setStatus || function() {};
    var renderCleanRawView = handlers.renderCleanRawView || function() {};

    var rawText = dom.rawText;
    var fileName = dom.fileName;
    var parseStatus = dom.parseStatus;
    var state = ctx.state || {};
    var handleCaseFiles = handlers.handleCaseFiles;
    var removeImportedCase = handlers.removeImportedCase;

    var fileInput = dom.fileInput;
    var dropZone = dom.dropZone;
    var autoRawInput = dom.autoRawInput;
    var autoRawDropZone = dom.autoRawDropZone;
    var autoRawListEl = dom.autoRawListEl;
    var autoRawClearBtn = dom.autoRawClearBtn;

    var caseFileInput = dom.caseFileInput;
    var caseDropZone = dom.caseDropZone;
    var caseFileListEl = dom.caseFileListEl;
    var autoCaseInput = dom.autoCaseInput;
    var autoCaseDropZone = dom.autoCaseDropZone;
    var autoCaseFileListEl = dom.autoCaseFileListEl;

    var maxPastedImagesPerAction = 20;

    var clearRawInput = handlers.clearRawInput || function() {
      if (rawText) rawText.value = '';
      if (fileName) fileName.textContent = '未选择文件';
      state.lastRawImportName = '';
      state.requirementLabel = '';
      state.requirementLabelSource = '';
      clearRequirementMediaState();
      setStatus(parseStatus, '', '');
      renderAutoRawInfo();
      renderCleanRawView(state.cleanViewSelection);
      updateFlowStatus();
      persistWorkflowState();
    };

    function ensureRequirementMediaState() {
      if (!state.requirementMedia || typeof state.requirementMedia !== 'object') {
        state.requirementMedia = {
          docxImages: [],
          pastedImages: [],
          lastDocxImageCount: 0,
          updatedAt: Date.now(),
        };
      }
      if (!Array.isArray(state.requirementMedia.docxImages)) state.requirementMedia.docxImages = [];
      if (!Array.isArray(state.requirementMedia.pastedImages)) state.requirementMedia.pastedImages = [];
      if (!Number.isFinite(Number(state.requirementMedia.lastDocxImageCount))) state.requirementMedia.lastDocxImageCount = 0;
      return state.requirementMedia;
    }

    function clearRequirementMediaState() {
      state.requirementMedia = {
        docxImages: [],
        pastedImages: [],
        lastDocxImageCount: 0,
        updatedAt: Date.now(),
      };
    }

    function setDocxRequirementImages(segments) {
      var media = ensureRequirementMediaState();
      var images = [];
      var textOffset = 0;
      if (Array.isArray(segments)) {
        segments.forEach(function(seg) {
          if (seg && seg.kind === 'text') {
            textOffset += String(seg.text || '').length;
            return;
          }
          if (!seg || seg.kind !== 'image') return;
          var blob = seg.blob || seg.file || null;
          if (!blob) return;
          images.push({
            index: Number(seg.index) || (images.length + 1),
            blob: blob,
            rid: seg.rid || '',
            mediaPath: seg.mediaPath || '',
            textOffset: textOffset,
          });
        });
      }
      media.docxImages = images;
      media.lastDocxImageCount = images.length;
      media.pastedImages = [];
      media.updatedAt = Date.now();
    }

    function clearPastedRequirementImages() {
      var media = ensureRequirementMediaState();
      media.pastedImages = [];
      media.updatedAt = Date.now();
    }

    function appendPastedRequirementImages(files) {
      var media = ensureRequirementMediaState();
      var appended = 0;
      for (var i = 0; i < files.length; i += 1) {
        var file = files[i];
        if (!file) continue;
        media.pastedImages.push({
          index: media.pastedImages.length + 1,
          blob: file,
          name: file.name || ('paste-image-' + (media.pastedImages.length + 1)),
          type: file.type || '',
        });
        appended += 1;
      }
      media.updatedAt = Date.now();
      return appended;
    }

    function countRequirementImages() {
      var media = ensureRequirementMediaState();
      return media.docxImages.length + media.pastedImages.length;
    }

    async function handleFileWithParse(file) {
      if (!file || !rawText) return;
      setStepInProgress('import');
      if (fileName) fileName.textContent = file.name || '';
      setStatus(parseStatus, '正在读取文件...', '');
      var ext = (file.name && file.name.split ? (file.name.split('.').pop() || '').toLowerCase() : '');
      try {
        var finalText = '';
        var docxImageCount = 0;
        if (ext === 'docx') {
          var parsedDocx = await parseDocxWithFallback(file);
          var normalizedDocx = normalizeDocxParseResult(parsedDocx);
          finalText = normalizedDocx.text;
          setDocxRequirementImages(normalizedDocx.segments);
          docxImageCount = ensureRequirementMediaState().lastDocxImageCount;
        } else {
          finalText = await file.text();
          clearRequirementMediaState();
        }
        rawText.value = finalText;
        state.lastRawImportName = file.name || '';
        setRequirementLabel(state.lastRawImportName, 'import');
        renderAutoRawInfo();
        renderCleanRawView(state.cleanViewSelection);
        if (docxImageCount > 0) {
          setStatus(parseStatus, '文件读取完成，检测到图片' + docxImageCount + '张；清洗/评审模型支持视觉时会自动携带图片', 'ok');
        } else {
          setStatus(parseStatus, '文件读取完成，可继续清洗', 'ok');
        }
      } catch (err) {
        console.error(err);
        var reason = err && err.message ? err.message : '请确认文件格式或转换为 docx';
        setStatus(parseStatus, '读取失败：' + reason, 'err');
      } finally {
        clearStepInProgress('import');
        renderAutoRawInfo();
        updateAutoCompareActions();
        updateAutoMissingCard();
        updateFlowStatus();
        persistWorkflowState();
      }
    }

    async function parseDocxWithFallback(file) {
      var internalErr = null;
      if (typeof parseDocxInternal === 'function') {
        try {
          return await parseDocxInternal(file);
        } catch (err) {
          internalErr = err;
        }
      }
      if (typeof parseDocxFromHandler === 'function') {
        return parseDocxFromHandler(file);
      }
      if (internalErr) throw internalErr;
      throw new Error('缺少 docx 解析能力');
    }

    function normalizeDocxParseResult(parsed) {
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.segments)) {
        var normalizedSegments = mergeAdjacentTextSegments(parsed.segments);
        return {
          text: parsed.text ? String(parsed.text) : composePlainTextFromSegments(normalizedSegments),
          segments: normalizedSegments,
        };
      }
      if (typeof parsed === 'string') {
        return {
          text: parsed,
          segments: parsed ? [{ kind: 'text', text: parsed }] : [],
        };
      }
      return {
        text: parsed === undefined || parsed === null ? '' : String(parsed),
        segments: [],
      };
    }

    async function maybeHandleFile(file) {
      if (!file) return;
      var ok = true;
      if (typeof guardRequirementImport === 'function') {
        try {
          ok = await guardRequirementImport(file);
        } catch (err) {
          ok = false;
        }
      }
      if (!ok) return;
      if (typeof handleFile === 'function') {
        handleFile(file);
        persistWorkflowState();
        return;
      }
      handleFileWithParse(file);
    }

    function hasNativeLabelTrigger(zone, input) {
      if (!zone || !input || !zone.tagName) return false;
      return zone.tagName.toLowerCase() === 'label' && zone.contains(input);
    }

    if (fileInput) {
      fileInput.addEventListener('change', function(e) {
        var files = e.target && e.target.files;
        var file = files && files[0];
        maybeHandleFile(file);
        fileInput.value = '';
      });
    }
    if (dropZone) {
      dropZone.addEventListener('click', function() {
        if (!fileInput) return;
        if (hasNativeLabelTrigger(dropZone, fileInput)) return;
        fileInput.click();
      });
      dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });
      dropZone.addEventListener('dragleave', function() { dropZone.classList.remove('dragover'); });
      dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        var files = e.dataTransfer ? e.dataTransfer.files : null;
        var file = files && files[0];
        maybeHandleFile(file);
      });
    }

    if (autoRawInput && autoRawDropZone) {
      autoRawInput.addEventListener('change', function(e) {
        var files = e.target && e.target.files;
        var file = files && files[0];
        maybeHandleFile(file);
        autoRawInput.value = '';
      });
      autoRawDropZone.addEventListener('click', function() {
        if (hasNativeLabelTrigger(autoRawDropZone, autoRawInput)) return;
        autoRawInput.click();
      });
      autoRawDropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        autoRawDropZone.classList.add('dragover');
      });
      autoRawDropZone.addEventListener('dragleave', function() { autoRawDropZone.classList.remove('dragover'); });
      autoRawDropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        autoRawDropZone.classList.remove('dragover');
        var files = e.dataTransfer ? e.dataTransfer.files : null;
        var file = files && files[0];
        maybeHandleFile(file);
      });
    }

    if (caseFileInput && typeof handleCaseFiles === 'function') {
      caseFileInput.addEventListener('change', function(e) {
        var files = e.target && e.target.files;
        if (files && files.length) handleCaseFiles(files);
        caseFileInput.value = '';
      });
    }
    if (caseDropZone && typeof handleCaseFiles === 'function') {
      caseDropZone.addEventListener('click', function() {
        if (!caseFileInput) return;
        if (hasNativeLabelTrigger(caseDropZone, caseFileInput)) return;
        caseFileInput.click();
      });
      caseDropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        caseDropZone.classList.add('dragover');
      });
      caseDropZone.addEventListener('dragleave', function() { caseDropZone.classList.remove('dragover'); });
      caseDropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        caseDropZone.classList.remove('dragover');
        var files = e.dataTransfer ? e.dataTransfer.files : null;
        if (files && files.length) handleCaseFiles(files);
      });
    }

    if (autoCaseInput && autoCaseDropZone && typeof handleCaseFiles === 'function') {
      autoCaseInput.addEventListener('change', function(e) {
        var files = e.target && e.target.files;
        if (files && files.length) handleCaseFiles(files);
        autoCaseInput.value = '';
      });
      autoCaseDropZone.addEventListener('click', function() {
        if (hasNativeLabelTrigger(autoCaseDropZone, autoCaseInput)) return;
        autoCaseInput.click();
      });
      autoCaseDropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        autoCaseDropZone.classList.add('dragover');
      });
      autoCaseDropZone.addEventListener('dragleave', function() { autoCaseDropZone.classList.remove('dragover'); });
      autoCaseDropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        autoCaseDropZone.classList.remove('dragover');
        var files = e.dataTransfer ? e.dataTransfer.files : null;
        if (files && files.length) handleCaseFiles(files);
      });
    }

    function bindRemoveCaseEvents(container) {
      if (!container || typeof removeImportedCase !== 'function') return;
      container.addEventListener('click', function(e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-remove-case-file]') : null;
        if (btn) {
          e.preventDefault();
          e.stopPropagation();
          removeImportedCase(btn.dataset.removeCaseFile);
        }
      });
    }

    bindRemoveCaseEvents(caseFileListEl);
    bindRemoveCaseEvents(autoCaseFileListEl);

    if (autoRawListEl && typeof clearRawInput === 'function') {
      autoRawListEl.addEventListener('click', function(e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-auto-raw-remove]') : null;
        if (btn) {
          e.preventDefault();
          clearRawInput();
        }
      });
    }
    if (autoRawClearBtn && typeof clearRawInput === 'function') {
      autoRawClearBtn.addEventListener('click', function(e) {
        e.preventDefault();
        clearRawInput();
      });
    }

    if (rawText) {
      rawText.addEventListener('paste', function(e) {
        var files = collectClipboardImageFiles(e);
        if (!files.length) return;
        e.preventDefault();
        var limited = files.slice(0, maxPastedImagesPerAction);
        if (!rawText.value && !countRequirementImages()) {
          clearPastedRequirementImages();
        }
        var appended = appendPastedRequirementImages(limited);
        var total = countRequirementImages();
        var statusText = '已添加图片' + appended + '张，当前共' + total + '张；清洗/评审模型支持视觉时会自动携带图片';
        var statusType = 'ok';
        if (files.length > limited.length) {
          statusText += '（本次最多处理' + maxPastedImagesPerAction + '张）';
          statusType = 'warn';
        }
        setStatus(parseStatus, statusText, statusType);
        updateAutoCompareActions();
        updateAutoMissingCard();
        updateFlowStatus();
        persistWorkflowState();
      });
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

    function composePlainTextFromSegments(segments) {
      if (!Array.isArray(segments)) return '';
      var text = '';
      segments.forEach(function(seg) {
        if (!seg || seg.kind !== 'text') return;
        text += seg.text || '';
      });
      return text;
    }

    function mergeAdjacentTextSegments(segments) {
      var merged = [];
      if (!Array.isArray(segments)) return merged;
      segments.forEach(function(seg) {
        if (!seg) return;
        if (seg.kind === 'text') {
          var text = seg.text || '';
          if (!text) return;
          var last = merged.length ? merged[merged.length - 1] : null;
          if (last && last.kind === 'text') {
            last.text = (last.text || '') + text;
          } else {
            merged.push({ kind: 'text', text: text });
          }
          return;
        }
        merged.push(seg);
      });
      return merged;
    }

    function createDocxParser(JSZipCtor) {
      if (!JSZipCtor) return null;
      return async function parseDocx(file) {
        if (!file) throw new Error('未选择文件');
        var buffer = await file.arrayBuffer();
        var zip = await JSZipCtor.loadAsync(buffer);
        var docFile = zip.file('word/document.xml') || zip.file('word/document2.xml');
        if (!docFile) throw new Error('docx 内容缺失，未找到 word/document.xml');
        var xml = await docFile.async('string');
        var relsFile = zip.file('word/_rels/document.xml.rels');
        var relsXml = relsFile ? await relsFile.async('string') : '';
        var relMap = parseDocxRelationshipMap(relsXml);
        var segments = extractDocxSegments(xml, relMap);
        if (!segments.length) {
          var fallback = decodeXmlEntities(xml.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
          if (fallback) {
            segments.push({ kind: 'text', text: fallback });
          }
        }
        segments = mergeAdjacentTextSegments(segments);

        var imageCache = {};
        for (var i = 0; i < segments.length; i += 1) {
          var seg = segments[i];
          if (!seg || seg.kind !== 'image') continue;
          var mediaPath = seg.mediaPath || '';
          if (!mediaPath) continue;
          if (!Object.prototype.hasOwnProperty.call(imageCache, mediaPath)) {
            imageCache[mediaPath] = await loadDocxImageBlob(zip, mediaPath);
          }
          seg.blob = imageCache[mediaPath] || null;
        }

        return {
          text: composePlainTextFromSegments(segments),
          segments: segments,
        };
      };
    }

    function parseDocxRelationshipMap(xml) {
      var map = {};
      if (!xml) return map;
      var regex = /<Relationship\b[^>]*>/gi;
      var match;
      while ((match = regex.exec(xml))) {
        var tag = match[0] || '';
        var attrs = parseXmlAttributes(tag);
        var id = attrs.Id || attrs.id || '';
        var target = attrs.Target || attrs.target || '';
        if (!id || !target) continue;
        map[id] = normalizeDocxPath(target);
      }
      return map;
    }

    function parseXmlAttributes(tag) {
      var attrs = {};
      if (!tag) return attrs;
      var regex = /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
      var match;
      while ((match = regex.exec(tag))) {
        var key = match[1] || '';
        var value = match[3] !== undefined ? match[3] : (match[4] !== undefined ? match[4] : '');
        attrs[key] = value;
      }
      return attrs;
    }

    function normalizeDocxPath(path) {
      if (!path) return '';
      var raw = String(path).replace(/\\/g, '/').trim();
      if (!raw) return '';
      if (/^[A-Za-z]+:\/\//.test(raw)) return '';
      if (raw.charAt(0) === '/') raw = raw.slice(1);
      var base = raw.indexOf('word/') === 0 ? raw : ('word/' + raw);
      return normalizePath(base);
    }

    function normalizePath(path) {
      var source = String(path || '');
      var parts = source.split('/');
      var normalized = [];
      for (var i = 0; i < parts.length; i += 1) {
        var part = parts[i];
        if (!part || part === '.') continue;
        if (part === '..') {
          if (normalized.length) normalized.pop();
          continue;
        }
        normalized.push(part);
      }
      return normalized.join('/');
    }

    async function loadDocxImageBlob(zip, mediaPath) {
      if (!zip || !mediaPath) return null;
      var candidates = [mediaPath];
      if (mediaPath.indexOf('word/') === 0) {
        candidates.push(mediaPath.slice(5));
      } else {
        candidates.push('word/' + mediaPath);
      }
      var visited = {};
      for (var i = 0; i < candidates.length; i += 1) {
        var candidate = normalizePath(candidates[i] || '');
        if (!candidate || visited[candidate]) continue;
        visited[candidate] = true;
        var zipFile = zip.file(candidate);
        if (!zipFile) continue;
        try {
          return await zipFile.async('blob');
        } catch (err) {
          // continue fallback candidates
        }
      }
      return null;
    }

    function extractDocxSegments(xml, relMap) {
      if (!xml) return [];
      var segments = [];
      var imageSeed = { count: 0 };
      var paragraphs = xml.match(/<w:p\b[\s\S]*?<\/w:p>/gi) || [];
      if (!paragraphs.length) {
        paragraphs = [xml];
      }
      for (var i = 0; i < paragraphs.length; i += 1) {
        var para = paragraphs[i];
        var paraSegments = extractParagraphSegments(para, relMap, imageSeed);
        if (paraSegments.length) {
          segments = segments.concat(paraSegments);
        }
        if (i < paragraphs.length - 1) {
          segments.push({ kind: 'text', text: '\n\n' });
        }
      }
      return mergeAdjacentTextSegments(segments);
    }

    function extractParagraphSegments(xml, relMap, imageSeed) {
      if (!xml) return [];
      var segments = [];
      var runRegex = /<w:r\b[\s\S]*?<\/w:r>/gi;
      var runMatch;
      var hasRun = false;
      while ((runMatch = runRegex.exec(xml))) {
        hasRun = true;
        var runXml = runMatch[0] || '';
        if (!runXml) continue;
        if (runHasStrikethrough(runXml)) continue;
        var runSegments = extractInlineSegments(runXml, relMap, imageSeed);
        if (runSegments.length) {
          segments = segments.concat(runSegments);
        }
      }
      if (!hasRun) {
        segments = extractInlineSegments(xml, relMap, imageSeed);
      }
      return mergeAdjacentTextSegments(segments);
    }

    function extractInlineSegments(xml, relMap, imageSeed) {
      var segments = [];
      var textBuffer = '';
      var tokenRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:delText\b[^>]*>[\s\S]*?<\/w:delText>|<w:tab\b[^>]*\/>|<w:(?:br|cr)\b[^>]*\/>|<a:blip\b[^>]*>|<v:imagedata\b[^>]*>/gi;
      var match;

      var flushText = function() {
        if (!textBuffer) return;
        segments.push({ kind: 'text', text: textBuffer });
        textBuffer = '';
      };

      while ((match = tokenRegex.exec(xml))) {
        var full = match[0] || '';
        if (match[1] !== undefined) {
          textBuffer += decodeXmlEntities(match[1]);
          continue;
        }
        if (/^<w:delText\b/i.test(full)) {
          continue;
        }
        if (/^<w:tab\b/i.test(full)) {
          textBuffer += '\t';
          continue;
        }
        if (/^<w:(?:br|cr)\b/i.test(full)) {
          textBuffer += '\n';
          continue;
        }
        if (/^<(?:a:blip|v:imagedata)\b/i.test(full)) {
          flushText();
          var attrs = parseXmlAttributes(full);
          var rid = attrs['r:embed'] || attrs.embed || attrs['r:id'] || attrs.id || attrs['o:relid'] || '';
          imageSeed.count += 1;
          segments.push({
            kind: 'image',
            index: imageSeed.count,
            rid: rid,
            mediaPath: rid && relMap ? (relMap[rid] || '') : '',
          });
        }
      }

      flushText();
      return segments;
    }

    function runHasStrikethrough(runXml) {
      if (!runXml) return false;
      var rprMatch = runXml.match(/<w:rPr\b[\s\S]*?<\/w:rPr>/i);
      if (!rprMatch || !rprMatch[0]) return false;
      var rprXml = rprMatch[0];
      var strikeRegex = /<w:(?:strike|dstrike)\b[^>]*>/gi;
      var match;
      while ((match = strikeRegex.exec(rprXml))) {
        var tag = match[0] || '';
        var attrs = parseXmlAttributes(tag);
        var value = attrs['w:val'];
        if (value === undefined || value === null) value = attrs.val;
        if (value === undefined || value === null || String(value).trim() === '') return true;
        if (!isWordFalseValue(value)) return true;
      }
      return false;
    }

    function isWordFalseValue(value) {
      var normalized = String(value || '').trim().toLowerCase();
      return normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no';
    }

    function decodeXmlEntities(text) {
      if (!text) return '';
      return String(text)
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#x0*A;/gi, '\n')
        .replace(/&#10;/g, '\n')
        .replace(/&#13;/g, '\n')
        .replace(/&#9;/g, '\t');
    }

    return {};
  }

  window.app = window.app || {};
  window.app.upload = { init: init };
})();
