(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.viewRestoreController = api;
  }
})(function() {
  function savedAt(value) {
    var resolved = Number(value || 0);
    return isFinite(resolved) ? resolved : 0;
  }
  function resolveRestorePlan(viewName, timestamps) {
    var view = String(viewName || '');
    if (view === 'history') {
      return [{ view: 'history' }, { view: 'editor', prepare: 'editor' }];
    }
    if (view === 'editor') {
      return [{ view: 'editor', prepare: 'editor' }, { view: 'history' }];
    }
    if (view === 'missing') {
      return [
        { view: 'missing', prepare: 'missing', onFailure: 'hideMissing' },
        { view: 'editor', prepare: 'editor' },
        { view: 'history' },
      ];
    }
    var times = timestamps || {};
    var editorAt = savedAt(times.editor);
    var historyAt = savedAt(times.history);
    var missingAt = savedAt(times.missing);
    if (missingAt > historyAt && missingAt > editorAt) {
      return [
        { view: 'missing', onFailure: 'hideMissing' },
        { view: 'editor', prepare: 'editor' },
        { view: 'history' },
      ];
    }
    if (historyAt > editorAt) {
      var historyPlan = [{ view: 'history' }, { view: 'editor', prepare: 'editor' }];
      if (missingAt) historyPlan.push({ view: 'missing' });
      return historyPlan;
    }
    var editorPlan = [{ view: 'editor', prepare: 'editor' }];
    editorPlan.push(missingAt && missingAt >= historyAt ? { view: 'missing' } : { view: 'history' });
    return editorPlan;
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var noValue = function() { return null; };
    var noRestore = function() { return Promise.resolve(false); };
    var noAction = function() {};
    var isAuthReady = opts.isAuthReady || function() { return false; };
    var getCurrentUserId = opts.getCurrentUserId || noValue;
    var getCurrentLoginSeq = opts.getCurrentLoginSeq || noValue;
    var readLastView = opts.readLastView || noValue;
    var readEditor = opts.readEditor || noValue;
    var readHistory = opts.readHistory || noValue;
    var readMissing = opts.readMissing || noValue;
    var prepareEditor = opts.prepareEditor || noAction;
    var prepareMissing = opts.prepareMissing || noAction;
    var hideMissing = opts.hideMissing || noAction;
    var restorers = {
      editor: opts.restoreEditor || noRestore,
      history: opts.restoreHistory || noRestore,
      missing: opts.restoreMissing || noRestore,
    };

    function matchesIdentity(record) {
      if (!record) return false;
      var userId = getCurrentUserId();
      var loginSeq = getCurrentLoginSeq();
      return Boolean(
        (userId && String(record.user_id || '') === String(userId)) ||
        (loginSeq && String(record.login_seq || '') === String(loginSeq))
      );
    }

    function runPlan(plan, index) {
      if (!plan || index >= plan.length) return Promise.resolve(null);
      var step = plan[index];
      if (step.prepare === 'editor') prepareEditor();
      if (step.prepare === 'missing') prepareMissing();
      return Promise.resolve(restorers[step.view]()).then(function(restored) {
        if (restored) return step.view;
        if (step.onFailure === 'hideMissing') hideMissing();
        return runPlan(plan, index + 1);
      });
    }

    function restoreLastSelection() {
      if (!isAuthReady()) return Promise.resolve(null);
      var lastView = readLastView();
      var explicitView = matchesIdentity(lastView) ? String(lastView.view || '') : '';
      if (explicitView === 'editor' || explicitView === 'history' || explicitView === 'missing') {
        return runPlan(resolveRestorePlan(explicitView), 0);
      }
      var editor = readEditor();
      var history = readHistory();
      var missing = readMissing();
      return runPlan(resolveRestorePlan('', {
        editor: editor && editor.saved_at,
        history: history && history.saved_at,
        missing: missing && missing.saved_at,
      }), 0);
    }
    return { restoreLastSelection: restoreLastSelection };
  }
  return { create: create, resolveRestorePlan: resolveRestorePlan };
});
