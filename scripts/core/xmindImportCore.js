(function() {
  function createRuntimeElement(root, tagName, id) {
    var existing = document.getElementById(id);
    if (existing) return existing;
    var element = document.createElement(tagName);
    element.id = id;
    root.appendChild(element);
    return element;
  }

  function ensureDom() {
    if (typeof document === 'undefined' || !document.createElement) return null;
    if (!document.getElementById('xmindCaseGenDrawer')) return null;
    var root = document.getElementById('xmindCaseGenImportRuntime');
    if (!root) {
      root = document.createElement('div');
      root.id = 'xmindCaseGenImportRuntime';
      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
      (document.body || document.documentElement).appendChild(root);
    }

    var fileInput = createRuntimeElement(root, 'input', 'fileInput');
    fileInput.type = 'file';
    fileInput.accept = '.doc,.docx,.txt,.md';
    createRuntimeElement(root, 'span', 'fileName').textContent = '未选择文件';
    createRuntimeElement(root, 'textarea', 'rawText');
    createRuntimeElement(root, 'p', 'parseStatus');

    var caseFileInput = createRuntimeElement(root, 'input', 'caseFileInput');
    caseFileInput.type = 'file';
    caseFileInput.accept = '.xmind,.txt,.md,.json';
    caseFileInput.multiple = true;
    createRuntimeElement(root, 'div', 'caseFileList');
    createRuntimeElement(root, 'textarea', 'caseText');
    createRuntimeElement(root, 'p', 'caseStatus');
    return root;
  }

  function dispatchValueChange(target) {
    if (!target || !target.dispatchEvent) return;
    ['input', 'change'].forEach(function(type) {
      var event = null;
      if (typeof Event === 'function') {
        event = new Event(type, { bubbles: true });
      } else if (document && document.createEvent) {
        event = document.createEvent('Event');
        event.initEvent(type, true, false);
      }
      if (event) target.dispatchEvent(event);
    });
  }

  function createEmptyRequirementMedia() {
    return {
      docxImages: [],
      pastedImages: [],
      lastDocxImageCount: 0,
      updatedAt: Date.now(),
    };
  }

  function composePlainTextFromSegments(segments) {
    var text = '';
    (Array.isArray(segments) ? segments : []).forEach(function(segment) {
      if (segment && segment.kind === 'text') text += segment.text || '';
    });
    return text;
  }

  function mergeAdjacentTextSegments(segments) {
    var merged = [];
    (Array.isArray(segments) ? segments : []).forEach(function(segment) {
      if (!segment) return;
      if (segment.kind !== 'text') {
        merged.push(segment);
        return;
      }
      var text = segment.text || '';
      if (!text) return;
      var previous = merged.length ? merged[merged.length - 1] : null;
      if (previous && previous.kind === 'text') previous.text = (previous.text || '') + text;
      else merged.push({ kind: 'text', text: text });
    });
    return merged;
  }

  function parseXmlAttributes(tag) {
    var attrs = {};
    var regex = /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
    var match;
    while ((match = regex.exec(tag || ''))) {
      attrs[match[1] || ''] = match[3] !== undefined ? match[3] : (match[4] || '');
    }
    return attrs;
  }

  function normalizePath(path) {
    var normalized = [];
    String(path || '').split('/').forEach(function(part) {
      if (!part || part === '.') return;
      if (part === '..') {
        if (normalized.length) normalized.pop();
        return;
      }
      normalized.push(part);
    });
    return normalized.join('/');
  }

  function normalizeDocxPath(path) {
    var raw = String(path || '').replace(/\\/g, '/').trim();
    if (!raw || /^[A-Za-z]+:\/\//.test(raw)) return '';
    if (raw.charAt(0) === '/') raw = raw.slice(1);
    return normalizePath(raw.indexOf('word/') === 0 ? raw : ('word/' + raw));
  }

  function parseDocxRelationshipMap(xml) {
    var map = {};
    var regex = /<Relationship\b[^>]*>/gi;
    var match;
    while ((match = regex.exec(xml || ''))) {
      var attrs = parseXmlAttributes(match[0] || '');
      var id = attrs.Id || attrs.id || '';
      var target = attrs.Target || attrs.target || '';
      if (id && target) map[id] = normalizeDocxPath(target);
    }
    return map;
  }

  function decodeXmlEntities(text) {
    return String(text || '')
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

  function isWordFalseValue(value) {
    var normalized = String(value || '').trim().toLowerCase();
    return normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no';
  }

  function runHasStrikethrough(runXml) {
    var props = String(runXml || '').match(/<w:rPr\b[\s\S]*?<\/w:rPr>/i);
    if (!props || !props[0]) return false;
    var regex = /<w:(?:strike|dstrike)\b[^>]*>/gi;
    var match;
    while ((match = regex.exec(props[0]))) {
      var attrs = parseXmlAttributes(match[0] || '');
      var value = attrs['w:val'];
      if (value === undefined || value === null) value = attrs.val;
      if (value === undefined || value === null || String(value).trim() === '') return true;
      if (!isWordFalseValue(value)) return true;
    }
    return false;
  }

  function extractInlineSegments(xml, relMap, imageSeed) {
    var segments = [];
    var text = '';
    var regex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:delText\b[^>]*>[\s\S]*?<\/w:delText>|<w:tab\b[^>]*\/>|<w:(?:br|cr)\b[^>]*\/>|<a:blip\b[^>]*>|<v:imagedata\b[^>]*>/gi;
    var match;
    function flushText() {
      if (!text) return;
      segments.push({ kind: 'text', text: text });
      text = '';
    }
    while ((match = regex.exec(xml || ''))) {
      var full = match[0] || '';
      if (match[1] !== undefined) {
        text += decodeXmlEntities(match[1]);
      } else if (/^<w:tab\b/i.test(full)) {
        text += '\t';
      } else if (/^<w:(?:br|cr)\b/i.test(full)) {
        text += '\n';
      } else if (/^<(?:a:blip|v:imagedata)\b/i.test(full)) {
        flushText();
        var attrs = parseXmlAttributes(full);
        var rid = attrs['r:embed'] || attrs.embed || attrs['r:id'] || attrs.id || attrs['o:relid'] || '';
        imageSeed.count += 1;
        segments.push({
          kind: 'image',
          index: imageSeed.count,
          rid: rid,
          mediaPath: rid ? (relMap[rid] || '') : '',
        });
      }
    }
    flushText();
    return segments;
  }

  function extractDocxSegments(xml, relMap) {
    var segments = [];
    var imageSeed = { count: 0 };
    var paragraphs = String(xml || '').match(/<w:p\b[\s\S]*?<\/w:p>/gi) || [String(xml || '')];
    paragraphs.forEach(function(paragraph, index) {
      var paragraphSegments = [];
      var regex = /<w:r\b[\s\S]*?<\/w:r>/gi;
      var match;
      var hasRun = false;
      while ((match = regex.exec(paragraph || ''))) {
        hasRun = true;
        if (!runHasStrikethrough(match[0])) {
          paragraphSegments = paragraphSegments.concat(extractInlineSegments(match[0], relMap, imageSeed));
        }
      }
      if (!hasRun) paragraphSegments = extractInlineSegments(paragraph, relMap, imageSeed);
      segments = segments.concat(paragraphSegments);
      if (index < paragraphs.length - 1) segments.push({ kind: 'text', text: '\n\n' });
    });
    return mergeAdjacentTextSegments(segments);
  }

  async function loadDocxImageBlob(zip, mediaPath) {
    var candidates = [mediaPath];
    if (String(mediaPath || '').indexOf('word/') === 0) candidates.push(String(mediaPath).slice(5));
    else candidates.push('word/' + String(mediaPath || ''));
    var visited = {};
    for (var i = 0; i < candidates.length; i += 1) {
      var candidate = normalizePath(candidates[i]);
      if (!candidate || visited[candidate]) continue;
      visited[candidate] = true;
      var entry = zip.file(candidate);
      if (!entry) continue;
      try {
        return await entry.async('blob');
      } catch (err) {
        // Try the next normalized DOCX media path.
      }
    }
    return null;
  }

  async function parseDocx(file, JSZipCtor) {
    if (!JSZipCtor) throw new Error('缺少 DOCX 解析能力');
    var zip = await JSZipCtor.loadAsync(await file.arrayBuffer());
    var documentFile = zip.file('word/document.xml') || zip.file('word/document2.xml');
    if (!documentFile) throw new Error('DOCX 内容缺失，未找到 word/document.xml');
    var xml = await documentFile.async('string');
    var relsFile = zip.file('word/_rels/document.xml.rels');
    var relMap = parseDocxRelationshipMap(relsFile ? await relsFile.async('string') : '');
    var segments = extractDocxSegments(xml, relMap);
    if (!segments.length) {
      var fallback = decodeXmlEntities(xml.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
      if (fallback) segments.push({ kind: 'text', text: fallback });
    }
    for (var i = 0; i < segments.length; i += 1) {
      var segment = segments[i];
      if (!segment || segment.kind !== 'image' || !segment.mediaPath) continue;
      segment.blob = await loadDocxImageBlob(zip, segment.mediaPath);
    }
    return { text: composePlainTextFromSegments(segments), segments: segments };
  }

  function buildRequirementMedia(segments) {
    var media = createEmptyRequirementMedia();
    var textOffset = 0;
    (Array.isArray(segments) ? segments : []).forEach(function(segment) {
      if (segment && segment.kind === 'text') {
        textOffset += String(segment.text || '').length;
        return;
      }
      var blob = segment && (segment.blob || segment.file);
      if (!segment || segment.kind !== 'image' || !blob) return;
      media.docxImages.push({
        index: Number(segment.index) || (media.docxImages.length + 1),
        blob: blob,
        rid: segment.rid || '',
        mediaPath: segment.mediaPath || '',
        textOffset: textOffset,
      });
    });
    media.lastDocxImageCount = media.docxImages.length;
    return media;
  }

  function init(ctx) {
    ctx = ctx || {};
    ensureDom();
    var state = ctx.state || {};
    var dom = ctx.dom || {};
    var handlers = ctx.handlers || {};
    var setStatus = handlers.setStatus || function() {};
    var setRequirementLabel = handlers.setRequirementLabel || function() {};
    var importCaseFiles = handlers.importCaseFiles || function() {};
    var persistWorkflowState = handlers.persistWorkflowState || function() {};
    var fileInput = dom.fileInput || document.getElementById('fileInput');
    var fileName = dom.fileName || document.getElementById('fileName');
    var rawText = dom.rawText || document.getElementById('rawText');
    var parseStatus = document.getElementById('parseStatus');
    var caseFileInput = dom.caseFileInput || document.getElementById('caseFileInput');

    async function importRequirementFile(file) {
      if (!file || !rawText) return false;
      setStatus(parseStatus, '正在读取文件...', '');
      try {
        var name = file.name ? String(file.name) : '';
        var ext = name && name.split ? (name.split('.').pop() || '').toLowerCase() : '';
        var text = '';
        if (ext === 'docx') {
          var parsed = await parseDocx(file, typeof window !== 'undefined' ? window.JSZip : null);
          text = parsed.text || '';
          state.requirementMedia = buildRequirementMedia(parsed.segments);
        } else {
          text = await file.text();
          state.requirementMedia = createEmptyRequirementMedia();
        }
        rawText.value = String(text || '');
        state.lastRawImportName = name;
        if (fileName) fileName.textContent = name || '未选择文件';
        setRequirementLabel(name, 'import');
        var imageCount = state.requirementMedia && Array.isArray(state.requirementMedia.docxImages)
          ? state.requirementMedia.docxImages.length
          : 0;
        setStatus(parseStatus, imageCount ? ('文件读取完成，检测到图片 ' + imageCount + ' 张') : '文件读取完成', 'ok');
        dispatchValueChange(rawText);
        persistWorkflowState();
        return true;
      } catch (err) {
        var reason = err && err.message ? err.message : '请确认文件格式';
        setStatus(parseStatus, '读取失败：' + reason, 'err');
        if (typeof console !== 'undefined' && console.warn) console.warn('XMind 需求文件读取失败', err);
        return false;
      }
    }

    function bindInput(input, marker, onFiles) {
      if (!input || input[marker] === true) return;
      input[marker] = true;
      input.addEventListener('change', function(event) {
        var files = event && event.target && event.target.files ? event.target.files : null;
        Promise.resolve(onFiles(files)).finally(function() {
          input.value = '';
        });
      });
    }

    bindInput(fileInput, '__xmindRequirementImportBound', function(files) {
      return importRequirementFile(files && files[0] ? files[0] : null);
    });
    bindInput(caseFileInput, '__xmindCasesImportBound', function(files) {
      return files && files.length ? importCaseFiles(files) : false;
    });

    return {
      importRequirementFile: importRequirementFile,
      importCaseFiles: importCaseFiles,
    };
  }

  window.app = window.app || {};
  window.app.xmindImportCore = {
    ensureDom: ensureDom,
    init: init,
  };
})();
