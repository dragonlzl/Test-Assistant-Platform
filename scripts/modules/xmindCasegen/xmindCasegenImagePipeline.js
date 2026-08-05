(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenImagePipeline = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var maxImages = Math.max(1, Number(opts.maxImages) || 20);
    var maxEdge = Math.max(1, Number(opts.maxEdge) || 1600);
    var maxBytes = Math.max(1, Number(opts.maxBytes) || (4 * 1024 * 1024));
    var createFileReader = typeof opts.createFileReader === 'function'
      ? opts.createFileReader
      : function() { return new FileReader(); };
    var createImage = typeof opts.createImage === 'function'
      ? opts.createImage
      : function() { return new Image(); };
    var canCreateCanvas = typeof opts.canCreateCanvas === 'function'
      ? opts.canCreateCanvas
      : function() { return typeof document !== 'undefined' && Boolean(document.createElement); };
    var createCanvas = typeof opts.createCanvas === 'function'
      ? opts.createCanvas
      : function() { return document.createElement('canvas'); };

    function readBlobAsDataUrl(blob) {
      return new Promise(function(resolve, reject) {
        var reader;
        try {
          reader = createFileReader();
        } catch (error) {
          reject(error);
          return;
        }
        reader.onload = function() { resolve(String(reader.result || '')); };
        reader.onerror = function() { reject(reader.error || new Error('读取图片失败')); };
        reader.readAsDataURL(blob);
      });
    }

    function estimateDataUrlBytes(dataUrl) {
      if (!dataUrl) return 0;
      var comma = dataUrl.indexOf(',');
      if (comma === -1) return 0;
      var b64 = dataUrl.slice(comma + 1);
      var padding = 0;
      var matched = b64.match(/=+$/);
      if (matched && matched[0]) padding = matched[0].length;
      return Math.max(0, Math.floor(b64.length * 3 / 4) - padding);
    }

    function loadImageByDataUrl(dataUrl) {
      return new Promise(function(resolve, reject) {
        var image;
        try {
          image = createImage();
        } catch (error) {
          reject(error);
          return;
        }
        image.onload = function() { resolve(image); };
        image.onerror = function() { reject(new Error('图片解码失败')); };
        image.src = dataUrl;
      });
    }

    async function resizeDataUrl(dataUrl, targetMaxEdge, mimeType, quality) {
      if (!dataUrl) return '';
      if (!canCreateCanvas()) return dataUrl;
      var image;
      try {
        image = await loadImageByDataUrl(dataUrl);
      } catch (error) {
        return dataUrl;
      }
      var srcW = image.naturalWidth || image.width || 0;
      var srcH = image.naturalHeight || image.height || 0;
      if (!srcW || !srcH) return dataUrl;
      var edge = Math.max(1, Number(targetMaxEdge) || maxEdge);
      var ratio = Math.min(1, edge / Math.max(srcW, srcH));
      var targetW = Math.max(1, Math.round(srcW * ratio));
      var targetH = Math.max(1, Math.round(srcH * ratio));
      var canvas = createCanvas();
      canvas.width = targetW;
      canvas.height = targetH;
      var ctx2d = canvas.getContext('2d');
      if (!ctx2d) return dataUrl;
      ctx2d.drawImage(image, 0, 0, targetW, targetH);
      try {
        return canvas.toDataURL(mimeType || 'image/jpeg', quality);
      } catch (error) {
        try {
          return canvas.toDataURL('image/jpeg', quality);
        } catch (fallbackError) {
          return dataUrl;
        }
      }
    }

    async function preprocessImageToDataUrl(blobOrDataUrl) {
      if (!blobOrDataUrl) return { ok: false, reason: 'missing_blob' };
      var dataUrl = '';
      if (typeof blobOrDataUrl === 'string' && blobOrDataUrl.indexOf('data:') === 0) {
        dataUrl = blobOrDataUrl;
      } else {
        try {
          dataUrl = await readBlobAsDataUrl(blobOrDataUrl);
        } catch (error) {
          return { ok: false, reason: 'read_failed' };
        }
      }
      var best = await resizeDataUrl(dataUrl, maxEdge, null, 0.92);
      if (!best) best = dataUrl;
      var bytes = estimateDataUrlBytes(best);
      if (bytes > maxBytes) {
        var jpegHigh = await resizeDataUrl(best, maxEdge, 'image/jpeg', 0.85);
        if (jpegHigh) {
          best = jpegHigh;
          bytes = estimateDataUrlBytes(best);
        }
      }
      if (bytes > maxBytes) {
        var jpegLow = await resizeDataUrl(best, maxEdge, 'image/jpeg', 0.72);
        if (jpegLow) {
          best = jpegLow;
          bytes = estimateDataUrlBytes(best);
        }
      }
      if (bytes > maxBytes) return { ok: false, reason: 'too_large' };
      return { ok: true, dataUrl: best };
    }

    async function buildImageContentBlocks(images, fromDataUrl) {
      var result = [];
      var stats = { total: Array.isArray(images) ? images.length : 0, sent: 0, skipped: 0 };
      if (!Array.isArray(images) || !images.length) return { blocks: result, stats: stats };
      for (var i = 0; i < images.length; i += 1) {
        if (i >= maxImages) {
          stats.skipped += images.length - i;
          break;
        }
        var item = images[i];
        var source = fromDataUrl === true
          ? (item && item.dataUrl ? item.dataUrl : '')
          : (item && item.blob ? item.blob : null);
        var pre = await preprocessImageToDataUrl(source);
        if (!pre.ok || !pre.dataUrl) {
          stats.skipped += 1;
          continue;
        }
        result.push({ type: 'image', dataUrl: pre.dataUrl });
        stats.sent += 1;
      }
      return { blocks: result, stats: stats };
    }

    return {
      readBlobAsDataUrl: readBlobAsDataUrl,
      estimateDataUrlBytes: estimateDataUrlBytes,
      loadImageByDataUrl: loadImageByDataUrl,
      resizeDataUrl: resizeDataUrl,
      preprocessImageToDataUrl: preprocessImageToDataUrl,
      buildImageContentBlocks: buildImageContentBlocks,
    };
  }

  return { create: create };
});
