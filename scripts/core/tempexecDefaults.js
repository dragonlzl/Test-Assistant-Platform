(function() {
  function ensureSetStore(store, key) {
    if (!store || typeof store !== 'object') return new Set();
    if (!store[key]) store[key] = new Set();
    return store[key];
  }

  function create(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var defaultTempExecPageSize = Number(ctx.defaultTempExecPageSize) || 20;
    var tempExecStatus = ctx.tempExecStatus;
    var setStatus = ctx.setStatus || function() {};
    var normalizeTempExecName = ctx.normalizeTempExecName || function(name) { return (name || '').toString().trim(); };
    var removePendingTempExecByName = ctx.removePendingTempExecByName || function() {};
    var removeTempExecFile = ctx.removeTempExecFile || function() {};
    var renderTempExecView = ctx.renderTempExecView || function() {};
    var generateTempExecId = ctx.generateTempExecId || function() { return ''; };
    var generateTempVersionId = ctx.generateTempVersionId || function() { return ''; };
    var stringifyCaseField = ctx.stringifyCaseField || function(value) {
      if (value === undefined || value === null) return '';
      return value.toString ? value.toString() : String(value);
    };

    function ensureTempExecReplacement(entry, pendingList) {
      var normalized = normalizeTempExecName(entry && entry.name);
      var pending = pendingList || [];
      var duplicates = (state.tempExecFiles || []).filter(function(file) {
        return normalizeTempExecName(file && file.name) === normalized;
      });
      var pendingDuplicates = pending.filter(function(item) {
        return normalizeTempExecName(item && item.name) === normalized;
      });
      if (duplicates.length || pendingDuplicates.length) {
        var confirmMsg = '检测到名称为【' + (entry ? entry.name : '') + '】的用例已存在，替换将清除原有执行结果，是否继续？';
        if (!window.confirm(confirmMsg)) return false;
        duplicates.forEach(function(file) { removeTempExecFile(file && file.id); });
        removePendingTempExecByName(pending, entry && entry.name);
      }
      return true;
    }

    return {
      normalizeReusePresets: function(list) { return Array.isArray(list) ? list : []; },
      ensureTempExecSelection: function(fileId) {
        if (!state.tempExecSelections || typeof state.tempExecSelections !== 'object') state.tempExecSelections = {};
        return ensureSetStore(state.tempExecSelections, fileId);
      },
      ensureTempExecRemarkOpen: function(fileId) {
        if (!state.tempExecRemarkOpen || typeof state.tempExecRemarkOpen !== 'object') state.tempExecRemarkOpen = {};
        return ensureSetStore(state.tempExecRemarkOpen, fileId);
      },
      ensureTempExecReuseOpen: function(fileId) {
        if (!state.tempExecReuseOpen || typeof state.tempExecReuseOpen !== 'object') state.tempExecReuseOpen = {};
        return ensureSetStore(state.tempExecReuseOpen, fileId);
      },
      ensureTempExecDefectOpen: function(fileId) {
        if (!state.tempExecDefectOpen || typeof state.tempExecDefectOpen !== 'object') state.tempExecDefectOpen = {};
        return ensureSetStore(state.tempExecDefectOpen, fileId);
      },
      ensureTempExecReplacement: ensureTempExecReplacement,
      generateTempExecId: generateTempExecId,
      generateTempVersionId: generateTempVersionId,
      renderTempExecView: renderTempExecView,
      renderTempVersionGrid: ctx.renderTempVersionGrid || function() {},
      renderTempExecNav: ctx.renderTempExecNav || function() {},
      getTempExecFile: ctx.getTempExecFile || function() { return null; },
      serializeSingleTempExecFile: ctx.serializeSingleTempExecFile || function(file) { return file || null; },
      getTempExecPageSize: ctx.getTempExecPageSize || function() { return defaultTempExecPageSize; },
      applyTempExecSearch: function(fileId, term, raw) {
        state.tempExecSearch = { fileId: fileId || '', term: (term || '').trim().toLowerCase(), raw: raw || '' };
        renderTempExecView();
      },
      applyTempExecPageSize: ctx.applyTempExecPageSize || function(value) { return { size: value, changed: false }; },
      exportTempExecSnapshot: ctx.exportTempExecSnapshot || function() {
        if (tempExecStatus) setStatus(tempExecStatus, '当前环境暂不支持导出执行页面配置', 'warn');
      },
      importTempExecSnapshot: ctx.importTempExecSnapshot || async function() {
        if (tempExecStatus) setStatus(tempExecStatus, '当前环境暂不支持导入执行页面配置', 'warn');
      },
      setTempExecActive: ctx.setTempExecActive || function() {},
      createTempExecFile: ctx.createTempExecFile || function() { return null; },
      syncTempExecFocus: ctx.syncTempExecFocus || function() {},
      persistTempExecState: ctx.persistTempExecState || function() {},
      removeTempExecFile: ctx.removeTempExecFile || function() {},
      getCaseExecutionDisplay: ctx.getCaseExecutionDisplay || function() { return stringifyCaseField(''); },
    };
  }

  window.app = window.app || {};
  window.app.tempexecDefaults = { create: create };
})();
