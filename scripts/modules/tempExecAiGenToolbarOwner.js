(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.tempExecAiGenToolbarOwner = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var api = opts.api && typeof opts.api === 'object' ? opts.api : {};
    var store = opts.store;
    var dom = opts.dom && typeof opts.dom === 'object' ? opts.dom : {};
    var getState = typeof opts.getState === 'function' ? opts.getState : function() { return {}; };
    var normalizeText = typeof opts.normalizeText === 'function'
      ? opts.normalizeText
      : function(value) { return value === null || value === undefined ? '' : String(value).trim(); };
    var hasAssignedModel = typeof opts.hasAssignedModel === 'function'
      ? opts.hasAssignedModel
      : function() { return false; };
    if (!store || typeof store.getBadgeRecordWithFallback !== 'function') {
      throw new Error('temp exec AI generation toolbar store is required');
    }

    function getFile(fileId) {
      if (!api || typeof api.getTempExecFile !== 'function') return null;
      var file = api.getTempExecFile(fileId);
      if (file || fileId === null || fileId === undefined || fileId === '') return file;
      if (typeof fileId === 'string') {
        var numericId = Number(fileId);
        if (!isNaN(numericId)) return api.getTempExecFile(numericId);
      } else if (typeof fileId === 'number') {
        return api.getTempExecFile(String(fileId));
      }
      return null;
    }

    function resolveDisabledReason() {
      var currentId = state.tempExecActiveId !== undefined && state.tempExecActiveId !== null
        ? state.tempExecActiveId
        : '';
      if (currentId === '') return 'no-case';
      var file = getFile(currentId);
      if (!file) return 'no-case';
      if (String(file.status || '') === 'archived') return 'archived';
      if (!hasAssignedModel()) return 'no-model';
      return '';
    }

    function syncBadgeForFile(fileId) {
      var ai = getState();
      if (!fileId) return;
      var record = store.getBadgeRecordWithFallback(fileId, false);
      if (!record) return;
      if (record.ai_read_token) ai.readResultToken = record.ai_read_token;
      if (!ai.resultToken && record.result_token) ai.resultToken = record.result_token;
      ai.hasUnreadResult = ai.resultToken ? ai.readResultToken !== ai.resultToken : false;
    }

    function shouldShowAssignEntryBadge() {
      var badgeState = store.ensureBadgeState();
      if (!badgeState || !badgeState.files) return false;
      var focusSet = new Set(state.tempExecFocus || []);
      var activeId = state.tempExecActiveId ? String(state.tempExecActiveId) : '';
      var keys = Object.keys(badgeState.files);
      for (var i = 0; i < keys.length; i += 1) {
        var key = keys[i];
        var record = badgeState.files[key];
        if (!record || !record.result_token) continue;
        var file = getFile(key);
        if (!file || String(file.status || '') === 'archived') continue;
        if (activeId && String(key) === activeId) continue;
        if (focusSet.has(String(key))) continue;
        if (String(record.assign_entry_read_token || '') !== String(record.result_token || '')) return true;
      }
      return false;
    }

    function syncAssignEntryBadge() {
      var button = dom.assignDrawerBtn;
      if (!button || !button.classList) return;
      if (shouldShowAssignEntryBadge()) button.classList.add('case-library-ai-gen-dot');
      else button.classList.remove('case-library-ai-gen-dot');
    }

    function markAssignEntryBadgeRead() {
      store.markAllBadgesRead('assign_entry_read_token');
      syncAssignEntryBadge();
    }

    function markFocusBadgeRead(fileId) {
      store.markBadgeRead(fileId, 'focus_read_token');
    }

    function markAssignItemBadgeRead(fileId) {
      store.markBadgeRead(fileId, 'assign_item_read_token');
    }

    function syncRunButton() {
      var button = dom.runBtn;
      if (!button) return;
      var ai = getState();
      var requirementText = dom.requirementInput ? dom.requirementInput.value : ai.requirementText;
      var hasRequirement = Boolean(normalizeText(requirementText || ''));
      button.disabled = Boolean(ai.loading || !hasRequirement || resolveDisabledReason());
    }

    function syncButton() {
      var button = dom.button;
      if (!button) return;
      var ai = getState();
      var loading = ai.loading === true;
      var reason = resolveDisabledReason();
      var targetId = ai.caseFileId || (state.tempExecActiveId ? state.tempExecActiveId : null);
      var record = targetId ? store.getBadgeRecordWithFallback(targetId, false) : null;
      var showBadge = false;
      if (!loading) {
        if (record && record.result_token) {
          showBadge = String(record.ai_read_token || '') !== String(record.result_token || '');
        } else if (ai.resultToken) {
          showBadge = ai.readResultToken !== ai.resultToken;
        } else {
          showBadge = ai.hasUnreadResult === true;
        }
      }
      ai.hasUnreadResult = showBadge;
      var label = loading ? '正在生成' : 'AI 用例生成';
      if (button.textContent !== label) button.textContent = label;
      button.disabled = false;
      if (button.removeAttribute) button.removeAttribute('disabled');
      if (button.classList) {
        if (reason) button.classList.add('is-disabled');
        else button.classList.remove('is-disabled');
        if (loading) button.classList.add('loading');
        else button.classList.remove('loading');
        if (showBadge && !loading) button.classList.add('has-badge');
        else button.classList.remove('has-badge');
      }
      if (button.setAttribute) button.setAttribute('data-disabled-reason', reason || '');
    }

    function refreshResultSurfaces() {
      if (typeof api.renderTempFocusZone === 'function') api.renderTempFocusZone();
      if (typeof api.renderTempVersionGrid === 'function') api.renderTempVersionGrid();
      if (typeof api.renderTempExecNav === 'function') api.renderTempExecNav();
    }

    function markResultReady(token, fileId) {
      var ai = getState();
      var nextToken = token ? String(token) : '';
      if (!nextToken) return;
      var targetId = fileId || ai.caseFileId || (state.tempExecActiveId ? state.tempExecActiveId : null);
      var record = targetId ? store.updateBadgeRecord(targetId, { result_token: nextToken }) : null;
      var sameFile = targetId && ai.caseFileId && String(targetId) === String(ai.caseFileId);
      if (sameFile) {
        if (record && record.ai_read_token) ai.readResultToken = record.ai_read_token;
        ai.resultToken = nextToken;
        ai.hasUnreadResult = ai.readResultToken !== nextToken;
      }
      syncButton();
      syncAssignEntryBadge();
      refreshResultSurfaces();
    }

    function clearResultBadge() {
      var ai = getState();
      var targetId = ai.caseFileId || (state.tempExecActiveId ? state.tempExecActiveId : null);
      var record = targetId ? store.getBadgeRecordWithFallback(targetId, false) : null;
      var token = ai.resultToken || (record && record.result_token ? record.result_token : '');
      if (token) {
        ai.readResultToken = token;
        ai.resultToken = token;
      }
      if (targetId && token) store.updateBadgeRecord(targetId, { ai_read_token: token });
      ai.hasUnreadResult = false;
      syncButton();
    }

    return {
      resolveDisabledReason: resolveDisabledReason,
      syncBadgeForFile: syncBadgeForFile,
      shouldShowAssignEntryBadge: shouldShowAssignEntryBadge,
      syncAssignEntryBadge: syncAssignEntryBadge,
      markAssignEntryBadgeRead: markAssignEntryBadgeRead,
      markFocusBadgeRead: markFocusBadgeRead,
      markAssignItemBadgeRead: markAssignItemBadgeRead,
      syncRunButton: syncRunButton,
      syncButton: syncButton,
      markResultReady: markResultReady,
      clearResultBadge: clearResultBadge,
    };
  }

  return { create: create };
});
