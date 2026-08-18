(function() {
  window.app = window.app || {};

  function createFallbacks(options) {
    var defaultTempExecPageSize = Number(options && options.defaultTempExecPageSize) || 20;
    var noop = function() {};
    var falseFn = function() { return false; };
    var emptyArr = function() { return []; };
    var emptyStr = function() { return ''; };
    var defaultCasesPayload = function() { return { text: '', isJson: false }; };
    var clampTempExecPageSize = function(value) {
      var num = Math.round(Number(value));
      if (!Number.isFinite(num) || num <= 0) return defaultTempExecPageSize;
      return num;
    };
    return {
      noop: noop,
      falseFn: falseFn,
      emptyArr: emptyArr,
      emptyStr: emptyStr,
      defaultCasesPayload: defaultCasesPayload,
      renderAutoRawInfo: noop,
      renderCaseGenProgressBoard: noop,
      setCaseModuleRunning: noop,
      isCaseModuleRunning: falseFn,
      renderCaseModuleProgress: function() { return ''; },
      updateCaseProgressView: noop,
      clearCaseProgress: noop,
      initCaseProgress: noop,
      setCaseProgressGroupState: noop,
      setCaseProgressStep: noop,
      markAllCaseProgressGroups: noop,
      updateFlowStatus: noop,
      scrollToSection: noop,
      refreshExportCaseGenButton: noop,
      setCaseViewHint: noop,
      renderCaseGeneration: noop,
      renderCaseTable: function() { return ''; },
      renderImportedCaseList: noop,
      addImportedCase: noop,
      removeImportedCase: noop,
      hasImportedCases: falseFn,
      hasCaseSource: falseFn,
      getCombinedCaseList: emptyArr,
      getCombinedCaseText: emptyStr,
      getImportedCaseObjects: emptyArr,
      syncCaseTextWithImports: noop,
      buildCasesComparePayload: defaultCasesPayload,
      resetImportedCaseView: noop,
      refreshImportedCaseView: noop,
      handleCaseFiles: noop,
      toggleImportedCaseView: noop,
      getCleanedTextForModel: emptyStr,
      renderTempExecView: noop,
      applyTempExecPageSize: function(value) { return { size: value, changed: false }; },
      clampTempExecPageSize: clampTempExecPageSize,
      createTempExecFile: function() { return null; },
      syncTempExecFocus: noop,
      persistTempExecState: noop,
      setTempExecActive: noop,
      removeTempExecFile: noop,
      getCaseExecutionDisplay: emptyStr,
    };
  }

  function buildDom(ids, alias) {
    var result = {};
    (ids || []).forEach(function(id) {
      result[id] = document.getElementById(id);
    });
    (alias || []).forEach(function(item) {
      if (item && item.name) {
        result[item.name] = document.getElementById(item.id || item.name);
      }
    });
    return result;
  }

  function initModule(name, args) {
    var mod = window.app && window.app[name];
    return mod && typeof mod.init === 'function' ? mod.init(args || {}) : null;
  }

  function assignIfPresent(target, source, keys) {
    if (!target || !source) return target;
    (keys || []).forEach(function(key) {
      var val = source && source[key];
      if (!val || (val && val.__appProxy && val.__appProxy === key)) return;
      target[key] = val;
    });
    return target;
  }

  window.app.appInitHelpers = {
    createFallbacks: createFallbacks,
    buildDom: buildDom,
    initModule: initModule,
    assignIfPresent: assignIfPresent,
  };
})();
