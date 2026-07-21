(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.selectExecWorkflow = api;
  }
})(function() {
  function asPromise(value) {
    return Promise.resolve(value);
  }

  function fileName(file) {
    if (file && file.file_name_clean) return String(file.file_name_clean);
    return '用例#' + (file && file.id ? file.id : '');
  }

  function failure(file, reason, error) {
    return {
      file: file || null,
      name: fileName(file),
      reason: reason || 'failed',
      error: error || null,
    };
  }

  function runSingle(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var file = opts.file || null;
    if (!file || !file.id) return Promise.resolve({ ok: false, reason: 'invalid_file' });
    var resolveAssociation = typeof opts.resolveAssociation === 'function'
      ? opts.resolveAssociation
      : function() { return { ok: true, association_enabled: false }; };
    var chooseVersion = typeof opts.chooseVersion === 'function'
      ? opts.chooseVersion
      : function() { return { ok: true, versionId: null }; };
    var loadItems = typeof opts.loadItems === 'function'
      ? opts.loadItems
      : function() { return []; };
    var transfer = typeof opts.transfer === 'function'
      ? opts.transfer
      : function() { return { ok: false }; };
    var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : function() {};
    var associationDecision = null;
    var versionResult = null;

    return asPromise(resolveAssociation(file))
      .then(function(decision) {
        if (!decision || decision.ok !== true) return { cancelled: true, reason: 'association_cancelled' };
        associationDecision = decision;
        return asPromise(chooseVersion(file));
      })
      .then(function(result) {
        if (result && result.cancelled) return result;
        if (!result || result.ok !== true) return { cancelled: true, reason: 'version_cancelled' };
        versionResult = result;
        onProgress({ phase: 'loading-items', file: file, index: 0, total: 1 });
        return asPromise(loadItems(file));
      })
      .then(function(items) {
        if (items && items.cancelled) return items;
        return asPromise(transfer(file, Array.isArray(items) ? items : [], {
          association_enabled: associationDecision.association_enabled === true,
          versionResult: versionResult,
        }));
      })
      .then(function(result) {
        if (result && result.cancelled) return { ok: false, reason: result.reason };
        return {
          ok: Boolean(result && result.ok),
          reason: result && result.ok ? '' : 'transfer_failed',
          result: result || null,
          association_enabled: associationDecision && associationDecision.association_enabled === true,
          versionResult: versionResult,
        };
      })
      .catch(function(error) {
        return { ok: false, reason: 'error', error: error };
      });
  }

  function runBatch(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var files = Array.isArray(opts.files) ? opts.files.filter(function(file) {
      return Boolean(file && file.id);
    }) : [];
    if (!files.length) {
      return Promise.resolve({ ok: false, reason: 'empty', successes: 0, failures: [] });
    }
    var chooseVersion = typeof opts.chooseVersion === 'function'
      ? opts.chooseVersion
      : function() { return { ok: true, versionId: null }; };
    var precheck = typeof opts.precheck === 'function'
      ? opts.precheck
      : function() { return { ok: true, skipConfirm: false }; };
    var resolveAssociation = typeof opts.resolveAssociation === 'function'
      ? opts.resolveAssociation
      : function() { return { ok: true, association_enabled: false }; };
    var loadItems = typeof opts.loadItems === 'function'
      ? opts.loadItems
      : function() { return []; };
    var transfer = typeof opts.transfer === 'function'
      ? opts.transfer
      : function() { return { ok: false }; };
    var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : function() {};
    var versionResult = null;
    var precheckResult = null;
    var successes = 0;
    var failures = [];

    return asPromise(chooseVersion(files))
      .then(function(result) {
        if (!result || result.ok !== true) return { cancelled: true, reason: 'version_cancelled' };
        versionResult = result;
        return asPromise(precheck(files, result));
      })
      .then(function(result) {
        if (result && result.cancelled) return result;
        if (!result || result.ok === false) return { cancelled: true, reason: 'precheck_cancelled' };
        precheckResult = result;
        var chain = Promise.resolve();
        files.forEach(function(file, index) {
          chain = chain.then(function() {
            onProgress({ phase: 'loading-items', file: file, index: index, total: files.length });
            return asPromise(resolveAssociation(file))
              .then(function(decision) {
                if (!decision || decision.ok !== true) {
                  failures.push(failure(file, 'association_cancelled'));
                  return null;
                }
                return asPromise(loadItems(file))
                  .then(function(items) {
                    return asPromise(transfer(file, Array.isArray(items) ? items : [], {
                      association_enabled: decision.association_enabled === true,
                      skipActiveConfirm: precheckResult.skipConfirm === true,
                      versionResult: versionResult,
                    }));
                  })
                  .then(function(transferResult) {
                    if (!transferResult) return;
                    if (transferResult.ok) successes += 1;
                    else failures.push(failure(file, 'transfer_failed'));
                  })
                  .catch(function(error) {
                    failures.push(failure(file, 'error', error));
                  });
              });
          });
        });
        return chain.then(function() { return null; });
      })
      .then(function(cancelled) {
        if (cancelled && cancelled.cancelled) {
          return { ok: false, reason: cancelled.reason, successes: 0, failures: [] };
        }
        return {
          ok: failures.length === 0 && successes > 0,
          reason: failures.length ? 'partial' : '',
          successes: successes,
          failures: failures,
          versionResult: versionResult,
        };
      })
      .catch(function(error) {
        return {
          ok: false,
          reason: 'error',
          error: error,
          successes: successes,
          failures: failures,
        };
      });
  }

  return {
    runSingle: runSingle,
    runBatch: runBatch,
  };
});
