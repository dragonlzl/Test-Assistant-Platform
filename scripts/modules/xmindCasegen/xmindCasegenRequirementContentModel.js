(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenRequirementContentModel = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var getState = port('getState', function() { return {}; });
    var getPrepState = port('getPrepState', function() { return {}; });
    var setPrepField = port('setPrepField');
    var cloneJson = port('cloneJson', function(value, fallback) {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (error) {
        return fallback;
      }
    });
    var readBlobAsDataUrl = port('readBlobAsDataUrl', function() { return Promise.resolve(''); });
    var readDocumentRequirementLabelText = port('getDocumentRequirementLabelText', function() { return ''; });
    var readManualRequirementLabelText = port('getManualRequirementLabelText', function() { return ''; });
    var getRawTextElement = port('getRawTextElement', function() { return null; });
    var getWorkspaceShadowDepth = port('getWorkspaceShadowDepth', function() { return 0; });
    var getShadowWorkspaceSharedState = port('getShadowWorkspaceSharedState', function() { return null; });
    var normalizeWorkspaceSharedState = port('normalizeWorkspaceSharedState', function(value) { return value || {}; });
    var getCombinedCaseList = port('getCombinedCaseList', function() { return []; });
    var getDeletedBaselineModuleMap = port('getDeletedBaselineModuleMap', function() { return {}; });
    var getDeletedBaselineCaseMap = port('getDeletedBaselineCaseMap', function() { return {}; });
    var normalizeModuleTitle = port('normalizeModuleTitle', function(value) { return String(value || '').trim(); });
    var normalizeModuleKey = port('normalizeModuleKey', function(value) { return String(value || '').trim(); });
    var buildCaseSignature = port('buildCaseSignature', function(item, moduleTitle) {
      return String(moduleTitle || '') + '::' + String(item && item.title || '');
    });
    var buildBaselineCaseDeleteKey = port('buildBaselineCaseDeleteKey', function(moduleTitle, signature) {
      return String(moduleTitle || '') + '::' + String(signature || '');
    });
    var now = port('now', function() { return Date.now(); });

    function normalizeModelCapabilityList(model) {
      if (!model || typeof model !== 'object') return [];
      var raw = model.capabilities
        || model.modelCapabilities
        || model.tags
        || model.multiModalTags
        || model.multimodalTags;
      var list = [];
      if (Array.isArray(raw)) {
        list = raw.slice();
      } else if (typeof raw === 'string') {
        list = raw.split(/[,|/、\s]+/);
      } else if (raw && typeof raw === 'object') {
        Object.keys(raw).forEach(function(key) {
          if (raw[key]) list.push(key);
        });
      }
      var seen = {};
      return list.map(function(item) { return String(item || '').trim(); }).filter(function(item) {
        var key = item.toLowerCase();
        if (!key || seen[key]) return false;
        seen[key] = true;
        return true;
      });
    }

    function modelSupportsVision(model) {
      var caps = normalizeModelCapabilityList(model);
      for (var i = 0; i < caps.length; i += 1) {
        var token = String(caps[i] || '').trim().toLowerCase();
        if (!token) continue;
        if (
          token === 'vision'
          || token === '视觉'
          || token.indexOf('vision') !== -1
          || token.indexOf('visual') !== -1
          || token.indexOf('multimodal') !== -1
          || token.indexOf('multi-modal') !== -1
          || token.indexOf('multi_modal') !== -1
          || token.indexOf('image') !== -1
          || token.indexOf('图像') !== -1
          || token.indexOf('图片') !== -1
        ) {
          return true;
        }
      }
      return false;
    }

    function collectDocumentRequirementImages() {
      var state = getState();
      var list = [];
      var media = state && state.requirementMedia && typeof state.requirementMedia === 'object'
        ? state.requirementMedia
        : null;
      if (!media) return list;
      function append(item, source) {
        if (!item || typeof item !== 'object') return;
        var blob = item.blob || item.file || null;
        if (!blob) return;
        list.push({
          blob: blob,
          source: source || '',
          index: Number(item.index) || (list.length + 1),
          textOffset: Number.isFinite(Number(item.textOffset)) ? Number(item.textOffset) : null,
          name: item.name || '',
          rid: item.rid || '',
          mediaPath: item.mediaPath || '',
        });
      }
      if (Array.isArray(media.docxImages)) {
        media.docxImages.forEach(function(item) { append(item, 'docx'); });
      }
      if (Array.isArray(media.pastedImages)) {
        media.pastedImages.forEach(function(item) { append(item, 'paste'); });
      }
      return list;
    }

    function getDocumentRequirementImageCount() {
      var state = getState();
      var media = state && state.requirementMedia && typeof state.requirementMedia === 'object'
        ? state.requirementMedia
        : null;
      if (!media) return 0;
      var docxCount = Math.max(
        Number(media.lastDocxImageCount || 0) || 0,
        Array.isArray(media.docxImages) ? media.docxImages.length : 0
      );
      var pastedCount = Array.isArray(media.pastedImages) ? media.pastedImages.length : 0;
      return Math.max(0, docxCount + pastedCount);
    }

    function getManualRequirementBlocks() {
      var blocks = getPrepState().manualRequirementBlocks;
      return Array.isArray(blocks) ? blocks : [];
    }

    function getManualRequirementText() {
      var text = '';
      getManualRequirementBlocks().forEach(function(block) {
        if (!block || block.type !== 'text' || !block.text) return;
        if (text) text += '\n';
        text += String(block.text);
      });
      return String(text || '').trim();
    }

    function getManualRequirementImages() {
      return getManualRequirementBlocks().filter(function(block) {
        return block && block.type === 'image' && String(block.dataUrl || '').indexOf('data:') === 0;
      });
    }

    function getDocumentRequirementText() {
      var shadowBase = getWorkspaceShadowDepth() > 0 && getShadowWorkspaceSharedState()
        ? normalizeWorkspaceSharedState(getShadowWorkspaceSharedState())
        : null;
      if (shadowBase) return String(shadowBase.rawText || '').trim();
      var rawTextEl = getRawTextElement();
      return rawTextEl && rawTextEl.value ? String(rawTextEl.value).trim() : '';
    }

    function getDocumentRequirementImportName() {
      var state = getState();
      return state && state.lastRawImportName ? String(state.lastRawImportName).trim() : '';
    }

    function getSelectedRequirementSource() {
      var prep = getPrepState();
      var mode = prep.requirementMode === 'manual'
        ? 'manual'
        : (prep.requirementMode === 'document' ? 'document' : '');
      var documentLabel = readDocumentRequirementLabelText();
      var manualLabel = readManualRequirementLabelText();
      var manualText = getManualRequirementText();
      var manualImages = getManualRequirementImages();
      if (mode === 'manual') {
        var manualHasBodyContent = Boolean(manualText) || manualImages.length > 0;
        return {
          mode: 'manual',
          label: manualLabel,
          text: manualText,
          supplement: '',
          importName: '',
          images: manualImages,
          imageCount: manualImages.length,
          hasLabel: Boolean(manualLabel),
          hasBodyContent: manualHasBodyContent,
          isReady: Boolean(manualLabel) && manualHasBodyContent,
        };
      }
      if (mode === 'document') {
        var documentText = getDocumentRequirementText();
        var documentImages = collectDocumentRequirementImages();
        return {
          mode: 'document',
          label: documentLabel,
          text: documentText,
          supplement: String(prep.requirementSupplement || '').trim(),
          importName: getDocumentRequirementImportName(),
          images: documentImages,
          imageCount: documentImages.length,
          hasLabel: Boolean(documentLabel),
          hasBodyContent: Boolean(documentText),
          isReady: Boolean(documentText),
        };
      }
      return {
        mode: '',
        label: '',
        text: '',
        supplement: '',
        importName: '',
        images: [],
        imageCount: 0,
        hasLabel: false,
        hasBodyContent: false,
        isReady: false,
      };
    }

    function setManualRequirementText(value) {
      var text = String(value || '');
      var images = getManualRequirementImages().map(function(item) {
        return cloneJson(item, null);
      }).filter(Boolean);
      var next = [];
      if (text.trim()) next.push({ type: 'text', text: text });
      images.forEach(function(item) { next.push(item); });
      return setPrepField('manualRequirementBlocks', next);
    }

    async function appendManualRequirementImages(files) {
      var fileList = Array.isArray(files) ? files : [];
      if (!fileList.length) return false;
      var blocks = getManualRequirementBlocks().slice();
      var added = 0;
      for (var i = 0; i < fileList.length; i += 1) {
        var file = fileList[i];
        if (!file || !(file.type || '').match(/^image\//i)) continue;
        var dataUrl = '';
        try {
          dataUrl = await readBlobAsDataUrl(file);
        } catch (error) {
          continue;
        }
        blocks.push({
          type: 'image',
          name: file.name || ('image-' + now() + '-' + i),
          dataUrl: dataUrl,
        });
        added += 1;
      }
      if (!added) return false;
      setPrepField('manualRequirementBlocks', blocks);
      return true;
    }

    function removeManualRequirementImage(index) {
      var images = 0;
      var next = [];
      getManualRequirementBlocks().forEach(function(block) {
        if (block && block.type === 'image') {
          if (images === index) {
            images += 1;
            return;
          }
          images += 1;
        }
        next.push(block);
      });
      return setPrepField('manualRequirementBlocks', next);
    }

    function hasImportedBaselineCases() {
      var state = getState();
      var rootState = state && state.xmindCaseGen && typeof state.xmindCaseGen === 'object'
        ? state.xmindCaseGen
        : null;
      var prep = rootState && rootState.prep && typeof rootState.prep === 'object'
        ? rootState.prep
        : null;
      if (!prep || prep.caseImportMode !== 'import') return false;
      var list = getCombinedCaseList() || [];
      return Array.isArray(list) && list.length > 0;
    }

    function getVisibleBaselineCaseList() {
      var deletedBaselineModules = getDeletedBaselineModuleMap();
      var deletedBaselineCases = getDeletedBaselineCaseMap();
      var rawBaselineList = hasImportedBaselineCases() ? getCombinedCaseList() : [];
      return rawBaselineList.filter(function(item) {
        if (!item || typeof item !== 'object') return false;
        var moduleTitle = normalizeModuleTitle(item.module || item.module_name || item['模块'] || '未命名模块');
        var moduleKey = normalizeModuleKey(moduleTitle);
        if (!moduleKey || deletedBaselineModules[moduleKey]) return false;
        var caseDeleteKey = buildBaselineCaseDeleteKey(moduleTitle, buildCaseSignature(item, moduleTitle));
        return !(caseDeleteKey && deletedBaselineCases[caseDeleteKey]);
      });
    }

    function hasVisibleImportedBaselineCases() {
      return getVisibleBaselineCaseList().length > 0;
    }

    function hasRequirementReady() {
      return getSelectedRequirementSource().isReady === true;
    }

    function hasCaseStepReady() {
      var prep = getPrepState();
      if (prep.caseImportMode === 'skip') return true;
      if (prep.caseImportMode === 'import') return hasImportedBaselineCases();
      return false;
    }

    function isPrepCompleted() {
      var prep = getPrepState();
      return Boolean(prep.completed) && hasRequirementReady() && hasCaseStepReady();
    }

    return {
      normalizeModelCapabilityList: normalizeModelCapabilityList,
      modelSupportsVision: modelSupportsVision,
      collectDocumentRequirementImages: collectDocumentRequirementImages,
      getDocumentRequirementImageCount: getDocumentRequirementImageCount,
      getManualRequirementBlocks: getManualRequirementBlocks,
      getManualRequirementText: getManualRequirementText,
      getManualRequirementImages: getManualRequirementImages,
      getDocumentRequirementText: getDocumentRequirementText,
      getDocumentRequirementImportName: getDocumentRequirementImportName,
      getSelectedRequirementSource: getSelectedRequirementSource,
      setManualRequirementText: setManualRequirementText,
      appendManualRequirementImages: appendManualRequirementImages,
      removeManualRequirementImage: removeManualRequirementImage,
      hasImportedBaselineCases: hasImportedBaselineCases,
      getVisibleBaselineCaseList: getVisibleBaselineCaseList,
      hasVisibleImportedBaselineCases: hasVisibleImportedBaselineCases,
      hasRequirementReady: hasRequirementReady,
      hasCaseStepReady: hasCaseStepReady,
      isPrepCompleted: isPrepCompleted,
    };
  }

  return { create: create };
});
