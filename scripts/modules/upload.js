(function() {
  function init(ctx) {
    if (!ctx) return {};
    var handlers = ctx.handlers || {};
    var dom = ctx.dom || {};

    var handleFile = handlers.handleFile;
    var JSZip = (typeof window !== 'undefined' && window.JSZip) ? window.JSZip : null;
    var parseDocx = handlers.parseDocx || createDocxParser(JSZip);
    var setStepInProgress = handlers.setStepInProgress || function() {};
    var clearStepInProgress = handlers.clearStepInProgress || function() {};
    var setRequirementLabel = handlers.setRequirementLabel || function() {};
    var renderAutoRawInfo = handlers.renderAutoRawInfo || function() {};
    var updateAutoCompareActions = handlers.updateAutoCompareActions || function() {};
    var updateAutoMissingCard = handlers.updateAutoMissingCard || function() {};
    var updateFlowStatus = handlers.updateFlowStatus || function() {};
    var setStatus = handlers.setStatus || function() {};
    var renderCleanRawView = handlers.renderCleanRawView || function() {};
    var rawText = dom.rawText;
    var fileName = dom.fileName;
    var parseStatus = dom.parseStatus;
    var state = ctx.state || {};
    var handleCaseFiles = handlers.handleCaseFiles;
    var clearRawInput = handlers.clearRawInput || function() {
      if (rawText) rawText.value = '';
      if (fileName) fileName.textContent = '未选择文件';
      state.lastRawImportName = '';
      state.requirementLabel = '';
      state.requirementLabelSource = '';
      setStatus(parseStatus, '', '');
      renderAutoRawInfo();
      renderCleanRawView(state.cleanViewSelection);
      updateFlowStatus();
    };
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

    async function handleFileWithParse(file) {
      if (!file || !rawText) return;
      setStepInProgress('import');
      if (fileName) fileName.textContent = file.name || '';
      setStatus(parseStatus, '正在读取文件...', '');
      var ext = (file.name && file.name.split ? (file.name.split('.').pop() || '').toLowerCase() : '');
      try {
        if (ext === 'docx') {
          if (typeof parseDocx !== 'function') {
            throw new Error('缺少 docx 解析能力');
          }
          rawText.value = await parseDocx(file);
        } else {
          rawText.value = await file.text();
        }
        state.lastRawImportName = file.name || '';
        setRequirementLabel(state.lastRawImportName, 'import');
        renderAutoRawInfo();
        setStatus(parseStatus, '文件读取完成，可继续清洗', 'ok');
      } catch (err) {
        console.error(err);
        setStatus(parseStatus, '读取失败，请确认文件格式或转换为 docx', 'err');
      } finally {
        clearStepInProgress('import');
        renderAutoRawInfo();
        updateAutoCompareActions();
        updateAutoMissingCard();
        updateFlowStatus();
      }
    }

    function maybeHandleFile(file) {
      if (!file) return;
      if (typeof handleFile === 'function') {
        handleFile(file);
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

    function createDocxParser(JSZipCtor) {
      if (!JSZipCtor) return null;
      return async function parseDocx(file) {
        if (!file) throw new Error('未选择文件');
        var buffer = await file.arrayBuffer();
        var zip = await JSZipCtor.loadAsync(buffer);
        var docFile = zip.file('word/document.xml') || zip.file('word/document2.xml');
        if (!docFile) throw new Error('docx 内容缺失，未找到 word/document.xml');
        var xml = await docFile.async('string');
        var paragraphs = [];
        xml.replace(/<w:p[\s\S]*?<\/w:p>/g, function(para) {
          var pieces = [];
          para.replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, function(_, text) {
            pieces.push(text);
            return '';
          });
          var merged = pieces.join('');
          var decoded = decodeXmlEntities(merged);
          var normalized = decoded.replace(/\s+/g, ' ').trim();
          if (normalized) paragraphs.push(normalized);
          return '';
        });
        if (!paragraphs.length) {
          var fallback = decodeXmlEntities(xml.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
          if (fallback) paragraphs.push(fallback);
        }
        return paragraphs.join('\n\n');
      };
    }

    function decodeXmlEntities(text) {
      if (!text) return '';
      return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
    }

    return {};
  }

  window.app = window.app || {};
  window.app.upload = { init: init };
})();
