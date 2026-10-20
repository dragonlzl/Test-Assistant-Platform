(function() {
  window.app = window.app || {};
  window.app.services = window.app.services || {};

  var databaseName = 'caseToolRequirementMedia';
  var storeName = 'documents';
  var database = null;
  var opening = null;
  var timeoutMs = 5000;
  var pruneGraceMs = 2 * 60 * 1000;

  function cacheError(message, cause) {
    if (cause && cause.code === 'requirement_media_cache_error') return cause;
    var detail = cause && cause.name === 'QuotaExceededError'
      ? '空间不足，请释放浏览器存储空间后重新导入需求'
      : message;
    var error = new Error('本地图片缓存' + detail);
    error.code = 'requirement_media_cache_error';
    return error;
  }

  function normalizeOwner(ownerId) {
    var owner = ownerId === undefined || ownerId === null ? '' : String(ownerId).trim();
    if (!owner) throw cacheError('缺少所属账号，请重新登录后导入需求');
    return owner;
  }

  function createCacheId() {
    var random = '';
    try {
      if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        var values = new Uint32Array(4);
        window.crypto.getRandomValues(values);
        random = Array.prototype.map.call(values, function(value) { return value.toString(36); }).join('-');
      }
    } catch (err) {
      random = '';
    }
    if (!random) random = Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2);
    return Date.now().toString(36) + '-' + random;
  }

  function openDatabase() {
    if (database) return Promise.resolve(database);
    if (opening) return opening;
    var pending = new Promise(function(resolve, reject) {
      var settled = false;
      var request;
      var timer = setTimeout(function() {
        finish(cacheError('打开超时，请关闭其他平台页面后重试'));
      }, timeoutMs);
      function finish(error, opened) {
        if (settled) {
          if (opened) opened.close();
          return;
        }
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(opened);
      }
      try {
        if (!window.indexedDB) throw cacheError('不可用，请允许浏览器本地存储后重新导入需求');
        request = window.indexedDB.open(databaseName, 1);
        request.onupgradeneeded = function() {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName, { keyPath: ['ownerId', 'cacheId'] });
          }
        };
        request.onblocked = function() {
          finish(cacheError('被其他页面阻塞，请关闭其他平台页面后重试'));
        };
        request.onerror = function() {
          finish(cacheError('无法打开，请检查浏览器存储权限后重新导入需求', request.error));
        };
        request.onsuccess = function() {
          var opened = request.result;
          if (settled) {
            opened.close();
            return;
          }
          database = opened;
          opened.onversionchange = function() {
            if (database === opened) database = null;
            opened.close();
          };
          opened.onclose = function() {
            if (database === opened) database = null;
          };
          finish(null, opened);
        };
      } catch (err) {
        finish(cacheError('不可用，请检查浏览器存储权限后重新导入需求', err));
      }
    });
    opening = pending.then(function(opened) {
      opening = null;
      return opened;
    }, function(error) {
      opening = null;
      throw error;
    });
    return opening;
  }

  // 仅在事务完成后返回，避免工作流已保存引用而图片写入尚未提交。
  function transact(mode, action) {
    return openDatabase().then(function(opened) {
      return new Promise(function(resolve, reject) {
        var transaction;
        var result = null;
        var failure = null;
        var settled = false;
        var timer = setTimeout(function() {
          failure = cacheError('操作超时，请重新导入需求后重试');
          try { if (transaction) transaction.abort(); } catch (err) { /* Already finished. */ }
          finish(failure);
        }, timeoutMs);
        function finish(error) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (error) reject(cacheError('读写失败，请重新导入需求后重试', error));
          else resolve(result);
        }
        try {
          transaction = opened.transaction(storeName, mode);
          transaction.oncomplete = function() { finish(null); };
          transaction.onabort = function() { finish(failure || transaction.error || cacheError('写入未完成，请重新导入需求')); };
          transaction.onerror = function() { failure = transaction.error; };
          action(transaction.objectStore(storeName), function(value) { result = value; });
        } catch (err) {
          failure = err;
          try { if (transaction) transaction.abort(); } catch (abortError) { /* Already finished. */ }
          finish(err);
        }
      });
    });
  }

  async function saveDocument(ownerId, images) {
    var owner = normalizeOwner(ownerId);
    if (!Array.isArray(images) || !images.length) throw cacheError('收到无效图片，请重新导入需求');
    for (var i = 0; i < images.length; i += 1) {
      if (!(images[i] instanceof Blob) || images[i].size <= 0) {
        throw cacheError('收到无效图片，请重新导入需求');
      }
    }
    // 使用二进制内容和 MIME 保存，兼容部分 WebKit 无法直接写入 Blob 的环境。
    var storedImages;
    try {
      storedImages = await Promise.all(images.map(async function(blob) {
        return { data: await blob.arrayBuffer(), type: blob.type || '' };
      }));
    } catch (err) {
      throw cacheError('无法读取图片，请重新导入需求', err);
    }
    var cacheId = createCacheId();
    return transact('readwrite', function(store, setResult) {
      store.add({ ownerId: owner, cacheId: cacheId, images: storedImages, createdAt: Date.now() });
      setResult(cacheId);
    });
  }

  async function loadImage(ownerId, cacheId, imageIndex) {
    var owner = normalizeOwner(ownerId);
    var index = Number(imageIndex);
    if (!cacheId || !Number.isInteger(index) || index < 0) return null;
    return transact('readonly', function(store, setResult) {
      var request = store.get([owner, String(cacheId)]);
      request.onsuccess = function() {
        var record = request.result;
        var image = record && Array.isArray(record.images) ? record.images[index] : null;
        setResult(image && image.data instanceof ArrayBuffer && image.data.byteLength > 0
          ? new Blob([image.data], { type: image.type || '' })
          : null);
      };
    });
  }

  async function removeDocument(ownerId, cacheId) {
    var owner = normalizeOwner(ownerId);
    if (!cacheId) return false;
    return transact('readwrite', function(store, setResult) {
      store.delete([owner, String(cacheId)]);
      setResult(true);
    });
  }

  async function pruneDocuments(ownerId, retainedIds) {
    var owner = normalizeOwner(ownerId);
    var retained = new Set(Array.isArray(retainedIds) ? retainedIds.map(String) : []);
    var cutoff = Date.now() - pruneGraceMs;
    return transact('readwrite', function(store, setResult) {
      var removed = 0;
      var request = store.openCursor(window.IDBKeyRange.bound([owner, ''], [owner, '\uffff']));
      request.onsuccess = function() {
        var cursor = request.result;
        if (!cursor) {
          setResult(removed);
          return;
        }
        var record = cursor.value;
        if (record.ownerId === owner && !retained.has(record.cacheId) && Number(record.createdAt) <= cutoff) {
          cursor.delete();
          removed += 1;
        }
        cursor.continue();
      };
    });
  }

  window.app.services.requirementMediaStore = {
    saveDocument: saveDocument,
    loadImage: loadImage,
    removeDocument: removeDocument,
    pruneDocuments: pruneDocuments,
  };
})();
