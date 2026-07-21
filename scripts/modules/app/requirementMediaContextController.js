(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.requirementMediaContextController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state || {};
    var dom = opts.dom || {};
    var getAssignedModel = typeof opts.getAssignedModel === 'function' ? opts.getAssignedModel : null;

    function ensureMediaContextHintElement(hintId, anchorEl) {
      if (typeof document === 'undefined' || !anchorEl) return null;
      var el = document.getElementById(hintId);
      if (el) return el;
      el = document.createElement('p');
      el.id = hintId;
      el.className = 'hint media-context-hint';
      if (anchorEl.parentNode) {
        if (anchorEl.nextSibling) {
          anchorEl.parentNode.insertBefore(el, anchorEl.nextSibling);
        } else {
          anchorEl.parentNode.appendChild(el);
        }
      }
      return el;
    }
    
    function setMediaContextHint(el, text, tone) {
      if (!el) return;
      var className = 'hint media-context-hint';
      if (tone === 'warn') className += ' is-warn';
      else if (tone === 'ok') className += ' is-ok';
      el.className = className;
      el.textContent = text || '';
      el.classList.toggle('hidden', !text);
    }
    
    function getRequirementImageStats() {
      var stats = { total: 0, docx: 0, pasted: 0 };
      var media = state && state.requirementMedia && typeof state.requirementMedia === 'object'
        ? state.requirementMedia
        : null;
      if (!media) return stats;
      var docxList = Array.isArray(media.docxImages) ? media.docxImages : [];
      var pastedList = Array.isArray(media.pastedImages) ? media.pastedImages : [];
      stats.docx = docxList.reduce(function(sum, item) {
        return item && (item.blob || item.file) ? (sum + 1) : sum;
      }, 0);
      stats.pasted = pastedList.reduce(function(sum, item) {
        return item && (item.blob || item.file) ? (sum + 1) : sum;
      }, 0);
      stats.total = stats.docx + stats.pasted;
      return stats;
    }
    
    function normalizeModelCapabilityList(model) {
      if (!model || typeof model !== 'object') return [];
      var raw = model.capabilities || model.modelCapabilities || model.tags || model.multiModalTags || model.multimodalTags;
      var values = [];
      if (Array.isArray(raw)) {
        values = raw.slice();
      } else if (typeof raw === 'string') {
        values = raw.split(/[,|/、\s]+/);
      } else if (raw && typeof raw === 'object') {
        Object.keys(raw).forEach(function(key) {
          if (raw[key]) values.push(key);
        });
      }
      var seen = {};
      var normalized = [];
      values.forEach(function(item) {
        var text = String(item || '').trim();
        if (!text) return;
        var key = text.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        normalized.push(text);
      });
      return normalized;
    }
    
    function capabilitySupportsImage(capabilities) {
      if (!Array.isArray(capabilities) || !capabilities.length) return false;
      for (var i = 0; i < capabilities.length; i += 1) {
        var token = String(capabilities[i] || '').trim().toLowerCase();
        if (!token) continue;
        if (
          token === 'vision' || token === '视觉' ||
          token.indexOf('vision') !== -1 ||
          token.indexOf('visual') !== -1 ||
          token.indexOf('multimodal') !== -1 ||
          token.indexOf('multi-modal') !== -1 ||
          token.indexOf('multi_modal') !== -1 ||
          token.indexOf('image') !== -1 ||
          token.indexOf('图像') !== -1 ||
          token.indexOf('图片') !== -1 ||
          token.indexOf('视觉') !== -1
        ) {
          return true;
        }
      }
      return false;
    }
    
    function getModelDisplayName(model, fallback) {
      if (!model || typeof model !== 'object') return fallback || '未配置';
      var name = model.name || model.displayName || model.model || '';
      var text = String(name || '').trim();
      return text || (fallback || '未配置');
    }
    
    function resolveModelImageCapability(type, fallbackName) {
      var result = {
        configured: false,
        supportsImage: false,
        modelName: fallbackName || '未配置',
        capabilityText: '无',
      };
      if (typeof getAssignedModel !== 'function') return result;
      var model = null;
      try {
        model = getAssignedModel(type);
      } catch (err) {
        return result;
      }
      result.configured = true;
      result.modelName = getModelDisplayName(model, fallbackName);
      var capabilities = normalizeModelCapabilityList(model);
      result.supportsImage = capabilitySupportsImage(capabilities);
      result.capabilityText = capabilities.length
        ? capabilities.slice(0, 4).join('、') + (capabilities.length > 4 ? '…' : '')
        : '无';
      return result;
    }
    
    function buildModelCapabilitySummary(info) {
      if (!info || !info.configured) return '未配置';
      if (info.supportsImage) {
        return info.modelName + '（标签：' + info.capabilityText + '，可识别图片）';
      }
      return info.modelName + '（标签：' + info.capabilityText + '，不含视觉/多模态）';
    }
    
    function updateRequirementMediaContextHints() {
      var importHintEl = ensureMediaContextHintElement('mediaContextImportHint', dom.parseStatus);
      var reviewHintEl = ensureMediaContextHintElement('mediaContextReviewHint', dom.reviewStatus);
      var cleanHintEl = ensureMediaContextHintElement('mediaContextCleanHint', dom.cleanStatus);
      var autoImportHintEl = ensureMediaContextHintElement('mediaContextAutoImportHint', dom.autoRawListEl);
      if (!importHintEl && !reviewHintEl && !cleanHintEl && !autoImportHintEl) return;
    
      var stats = getRequirementImageStats();
      var hasImages = stats.total > 0;
      var reviewInfo = resolveModelImageCapability('review', '需求评审模型');
      var cleanInfo = resolveModelImageCapability('clean', '需求清洗模型');
      var imageLabel = hasImages
        ? ('图片上下文：' + stats.total + ' 张（文档 ' + stats.docx + '，粘贴 ' + stats.pasted + '）')
        : '图片上下文：0 张（当前仅文本）';
    
      var importNoImageCapability = hasImages && !reviewInfo.supportsImage && !cleanInfo.supportsImage;
      var importTone = importNoImageCapability ? 'warn' : (hasImages ? 'ok' : '');
      var importText = imageLabel
        + '。评审模型：' + buildModelCapabilitySummary(reviewInfo)
        + '；清洗模型：' + buildModelCapabilitySummary(cleanInfo) + '。';
      if (importNoImageCapability) {
        importText += ' 当前两者未配置或标签未声明视觉/多模态，执行时可能仅基于文本。';
      }
      setMediaContextHint(importHintEl, importText, importTone);
      if (autoImportHintEl) {
        var autoImportText = imageLabel
          + '。一键执行后续步骤模型能力：评审模型：' + buildModelCapabilitySummary(reviewInfo)
          + '；清洗模型：' + buildModelCapabilitySummary(cleanInfo) + '。';
        if (importNoImageCapability) {
          autoImportText += ' 当前两者未配置或标签未声明视觉/多模态，后续步骤可能仅基于文本。';
        } else if (hasImages) {
          autoImportText += ' 若继续执行需求评审/清洗，将按模型能力尝试识别图片内容。';
        } else {
          autoImportText += ' 当前不含图片，后续步骤将仅基于文本。';
        }
        setMediaContextHint(autoImportHintEl, autoImportText, importTone);
      }
    
      var reviewTone = '';
      var reviewText = imageLabel + '。当前评审模型：' + buildModelCapabilitySummary(reviewInfo) + '。';
      if (hasImages) {
        if (!reviewInfo.configured) {
          reviewText += ' 请先在功能指派中配置需求评审模型。';
          reviewTone = 'warn';
        } else if (reviewInfo.supportsImage) {
          reviewText += ' 本次评审将尝试携带并识别图片内容。';
          reviewTone = 'ok';
        } else {
          reviewText += ' 当前模型标签未声明视觉/多模态，本次可能仅使用文本。';
          reviewTone = 'warn';
        }
      } else {
        reviewText += ' 当前不含图片，本次仅基于文本评审。';
      }
      setMediaContextHint(reviewHintEl, reviewText, reviewTone);
    
      var cleanTone = '';
      var cleanText = imageLabel + '。当前清洗模型：' + buildModelCapabilitySummary(cleanInfo) + '。';
      if (hasImages) {
        if (!cleanInfo.configured) {
          cleanText += ' 请先在功能指派中配置需求清洗模型。';
          cleanTone = 'warn';
        } else if (cleanInfo.supportsImage) {
          cleanText += ' 本次清洗将尝试携带并识别图片内容。';
          cleanTone = 'ok';
        } else {
          cleanText += ' 当前模型标签未声明视觉/多模态，本次可能仅使用文本。';
          cleanTone = 'warn';
        }
      } else {
        cleanText += ' 当前不含图片，本次仅基于文本清洗。';
      }
      setMediaContextHint(cleanHintEl, cleanText, cleanTone);
    }

    return {
      update: updateRequirementMediaContextHints,
      getRequirementImageStats: getRequirementImageStats,
      normalizeModelCapabilityList: normalizeModelCapabilityList,
      capabilitySupportsImage: capabilitySupportsImage,
      resolveModelImageCapability: resolveModelImageCapability,
      buildModelCapabilitySummary: buildModelCapabilitySummary,
    };
  }

  return {
    create: create,
  };
});

