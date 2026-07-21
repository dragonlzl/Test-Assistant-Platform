(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.aiGenStore = api;
  }
})(function() {
  var BADGE_STORAGE_KEY = 'tap-case-library-ai-gen-badges';
  var APPEND_STORAGE_KEY = 'tap-case-library-ai-gen-appended';

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var getCurrentUserId = typeof opts.getCurrentUserId === 'function'
      ? opts.getCurrentUserId
      : function() { return ''; };
    var storage = opts.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    var now = typeof opts.now === 'function' ? opts.now : Date.now;

    function read(storageKey) {
      if (!storage || typeof storage.getItem !== 'function') return null;
      try {
        var raw = storage.getItem(storageKey);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (err) {
        return null;
      }
    }

    function write(storageKey, payload) {
      if (!storage) return;
      try {
        if (!payload) {
          if (typeof storage.removeItem === 'function') storage.removeItem(storageKey);
          return;
        }
        if (typeof storage.setItem === 'function') storage.setItem(storageKey, JSON.stringify(payload));
      } catch (err) {
        // ignore storage failures
      }
    }

    function ensureUserStore(stateKey, storageKey) {
      var userId = getCurrentUserId();
      var store = state[stateKey];
      if (!userId) {
        if (store && store.files && typeof store.files === 'object') return store;
        var anonymousPersisted = read(storageKey);
        if (anonymousPersisted && anonymousPersisted.files && typeof anonymousPersisted.files === 'object') {
          state[stateKey] = anonymousPersisted;
          return anonymousPersisted;
        }
        if (!store || typeof store !== 'object') store = { user_id: '', files: {}, updated_at: now() };
        state[stateKey] = store;
        if (!store.files || typeof store.files !== 'object') store.files = {};
        return store;
      }
      if (!store || String(store.user_id || '') !== String(userId || '')) {
        var persisted = read(storageKey);
        if (persisted && String(persisted.user_id || '') === String(userId || '')) {
          store = persisted;
        } else {
          store = { user_id: userId || '', files: {}, updated_at: now() };
        }
        state[stateKey] = store;
      }
      if (!store.files || typeof store.files !== 'object') store.files = {};
      return store;
    }

    function ensureBadgeState() {
      return ensureUserStore('aiGenBadge', BADGE_STORAGE_KEY);
    }

    function ensureAppendState() {
      return ensureUserStore('aiGenAppend', APPEND_STORAGE_KEY);
    }

    function getAppendRecord(fileId, shouldCreate) {
      if (!fileId) return null;
      var store = ensureAppendState();
      var key = String(fileId || '');
      var record = store.files ? store.files[key] : null;
      if (!record && shouldCreate) {
        record = { token: '', appended: {}, updated_at: now() };
        store.files[key] = record;
        store.updated_at = now();
        write(APPEND_STORAGE_KEY, store);
      }
      if (record && (!record.appended || typeof record.appended !== 'object')) record.appended = {};
      return record;
    }

    function resetAppendRecord(fileId, token) {
      if (!fileId || !token) return null;
      var store = ensureAppendState();
      var key = String(fileId || '');
      var nextToken = String(token || '');
      var record = store.files ? store.files[key] : null;
      if (!record || String(record.token || '') !== nextToken) {
        record = { token: nextToken, appended: {}, updated_at: now() };
        store.files[key] = record;
        store.updated_at = now();
        write(APPEND_STORAGE_KEY, store);
        return record;
      }
      if (!record.appended || typeof record.appended !== 'object') record.appended = {};
      return record;
    }

    function clearAppendRecord(fileId) {
      if (!fileId) return;
      var store = ensureAppendState();
      var key = String(fileId || '');
      if (!store.files || !store.files[key]) return;
      delete store.files[key];
      store.updated_at = now();
      write(APPEND_STORAGE_KEY, store);
    }

    function getAppendMap(fileId, token) {
      if (!fileId || !token) return {};
      var record = getAppendRecord(fileId, false);
      if (!record || String(record.token || '') !== String(token || '')) return {};
      return record.appended && typeof record.appended === 'object' ? record.appended : {};
    }

    function markAppendKeys(fileId, token, keys) {
      if (!fileId || !token) return;
      var store = ensureAppendState();
      var record = resetAppendRecord(fileId, token);
      if (!record) return;
      (Array.isArray(keys) ? keys : []).forEach(function(key) {
        if (key) record.appended[key] = true;
      });
      record.updated_at = now();
      store.updated_at = now();
      write(APPEND_STORAGE_KEY, store);
    }

    function normalizeBadgeRecord(record) {
      var target = record && typeof record === 'object' ? record : {};
      ['result_token', 'ai_read_token', 'nav_read_token', 'edit_read_token'].forEach(function(key) {
        if (typeof target[key] !== 'string') target[key] = target[key] ? String(target[key]) : '';
      });
      return target;
    }

    function getBadgeRecord(fileId, shouldCreate) {
      var store = ensureBadgeState();
      var key = String(fileId || '');
      if (!key) return null;
      var record = store.files && typeof store.files[key] === 'object' ? store.files[key] : null;
      if (!record && !shouldCreate) return null;
      record = normalizeBadgeRecord(record);
      if (shouldCreate) store.files[key] = record;
      return record;
    }

    function getBadgeRecordWithFallback(fileId, shouldCreate) {
      var record = getBadgeRecord(fileId, shouldCreate);
      if (record || shouldCreate) return record;
      var userId = getCurrentUserId();
      var persisted = read(BADGE_STORAGE_KEY);
      if (persisted && (String(persisted.user_id || '') === String(userId || '') || !userId)) {
        state.aiGenBadge = persisted;
        return getBadgeRecord(fileId, shouldCreate);
      }
      return null;
    }

    function updateBadgeRecord(fileId, updates) {
      var store = ensureBadgeState();
      var record = getBadgeRecord(fileId, true);
      if (!record) return null;
      ['result_token', 'ai_read_token', 'nav_read_token', 'edit_read_token'].forEach(function(key) {
        if (updates && Object.prototype.hasOwnProperty.call(updates, key)) {
          record[key] = updates[key] ? String(updates[key]) : '';
        }
      });
      record.updated_at = now();
      store.updated_at = record.updated_at;
      write(BADGE_STORAGE_KEY, store);
      return record;
    }

    function clearBadgeRecord(fileId) {
      if (!fileId) return;
      var store = ensureBadgeState();
      var key = String(fileId || '');
      if (!store.files || !store.files[key]) return;
      delete store.files[key];
      store.updated_at = now();
      write(BADGE_STORAGE_KEY, store);
    }

    function hasNavBadge() {
      var store = ensureBadgeState();
      return Object.keys(store.files || {}).some(function(key) {
        var record = store.files[key];
        return Boolean(record && record.result_token
          && String(record.nav_read_token || '') !== String(record.result_token || ''));
      });
    }

    function markNavBadgesRead() {
      var store = ensureBadgeState();
      var changed = false;
      Object.keys(store.files || {}).forEach(function(key) {
        var record = store.files[key];
        if (!record || !record.result_token) return;
        var token = String(record.result_token || '');
        if (token && String(record.nav_read_token || '') !== token) {
          record.nav_read_token = token;
          record.updated_at = now();
          changed = true;
        }
      });
      if (changed) {
        store.updated_at = now();
        write(BADGE_STORAGE_KEY, store);
      }
      return changed;
    }

    function markEditBadgeRead(fileId) {
      var record = getBadgeRecord(fileId, false);
      var token = record && record.result_token ? String(record.result_token) : '';
      if (token) updateBadgeRecord(fileId, { edit_read_token: token });
    }

    function shouldShowEditBadge(fileId) {
      var record = getBadgeRecord(fileId, false);
      return Boolean(record && record.result_token
        && String(record.edit_read_token || '') !== String(record.result_token || ''));
    }

    return {
      ensureBadgeState: ensureBadgeState,
      ensureAppendState: ensureAppendState,
      getAppendRecord: getAppendRecord,
      resetAppendRecord: resetAppendRecord,
      clearAppendRecord: clearAppendRecord,
      getAppendMap: getAppendMap,
      markAppendKeys: markAppendKeys,
      getBadgeRecord: getBadgeRecord,
      getBadgeRecordWithFallback: getBadgeRecordWithFallback,
      updateBadgeRecord: updateBadgeRecord,
      clearBadgeRecord: clearBadgeRecord,
      hasNavBadge: hasNavBadge,
      markNavBadgesRead: markNavBadgesRead,
      markEditBadgeRead: markEditBadgeRead,
      shouldShowEditBadge: shouldShowEditBadge,
    };
  }

  return {
    BADGE_STORAGE_KEY: BADGE_STORAGE_KEY,
    APPEND_STORAGE_KEY: APPEND_STORAGE_KEY,
    create: create,
  };
});
