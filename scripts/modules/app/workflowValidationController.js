(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.workflowValidationController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var dom = opts.dom || {};
    var api = opts.api || {};
    var reviewResultEl = dom.reviewResultEl || null;
    var cleanedTextEl = dom.cleanedTextEl || null;
    var compareResultEl = dom.compareResultEl || null;
    var splitResultEl = dom.splitResultEl || null;
    var casesCompareResultEl = dom.casesCompareResultEl || null;
    var ensureValidationFailedMap = typeof opts.ensureValidationFailedMap === 'function'
      ? opts.ensureValidationFailedMap
      : function() { return {}; };
    var ensureValidationFailedReasonMap = typeof opts.ensureValidationFailedReasonMap === 'function'
      ? opts.ensureValidationFailedReasonMap
      : function() { return {}; };
    var isStepLocked = typeof opts.isStepLocked === 'function' ? opts.isStepLocked : function() { return false; };
    var unwrapRequirementPayload = typeof opts.unwrapRequirementPayload === 'function'
      ? opts.unwrapRequirementPayload
      : function(text) { return { payload: text }; };
    var stripRequirementHeader = typeof opts.stripRequirementHeader === 'function'
      ? opts.stripRequirementHeader
      : function(text) { return text; };
    var shouldExpectCleanJson = typeof opts.shouldExpectCleanJson === 'function'
      ? opts.shouldExpectCleanJson
      : function() { return false; };
    var isCoveragePayload = typeof opts.isCoveragePayload === 'function'
      ? opts.isCoveragePayload
      : function(data) {
        return Boolean(data && typeof data === 'object'
          && Object.prototype.hasOwnProperty.call(data, 'coverage'));
      };
    var clampCoveragePercent = typeof opts.clampCoveragePercent === 'function'
      ? opts.clampCoveragePercent
      : function(value) {
        var num = Number(value);
        return Number.isFinite(num) ? Math.max(0, Math.min(100, Math.round(num))) : null;
      };
    var parseSplitModules = typeof opts.parseSplitModules === 'function'
      ? opts.parseSplitModules
      : function() { return []; };
    var hasCaseSource = typeof opts.hasCaseSource === 'function' ? opts.hasCaseSource : function() { return false; };

    function pickCoveragePayload(data) {
      if (!data || typeof data !== 'object') return null;
      if (isCoveragePayload(data)) return data;
      if (Array.isArray(data)) {
        for (var i = 0; i < data.length; i += 1) {
          var found = pickCoveragePayload(data[i]);
          if (found) return found;
        }
        return null;
      }
      if (data && typeof data === 'object') {
        if (data.data && typeof data.data === 'object') {
          var nested = pickCoveragePayload(data.data);
          if (nested) return nested;
        }
        var keys = Object.keys(data);
        for (var j = 0; j < keys.length; j += 1) {
          var child = data[keys[j]];
          if (child && typeof child === 'object') {
            var inner = pickCoveragePayload(child);
            if (inner) return inner;
          }
        }
      }
      return null;
    }
    
    function parseCoveragePayloadFromText(text, expectedType) {
      var content = text && text.trim ? text.trim() : '';
      if (!content) return null;
      try {
        var unwrap = unwrapRequirementPayload ? unwrapRequirementPayload(content) : { payload: content };
        if (expectedType && unwrap.type && unwrap.type !== expectedType) return null;
        var payload = typeof unwrap.payload === 'string' ? unwrap.payload : unwrap.payload;
        if (!payload) return null;
        var parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
        return pickCoveragePayload(parsed);
      } catch (err) {
        console.warn('覆盖数据解析失败', err);
        return null;
      }
    }
    
    function getValidationFailureReason(step) {
      switch (step) {
        case 'review':
          return '评审结果格式异常';
        case 'clean':
          return '清洗结果格式异常';
        case 'compare':
          return '对比结果格式异常';
        case 'split':
          return '拆分结果格式异常';
        case 'cases-upload':
          return '用例导入格式异常';
        case 'cases':
          return '覆盖对比结果格式异常';
        default:
          return '结果格式异常';
      }
    }
    
    function applyValidationFailure(step, failed) {
      var map = ensureValidationFailedMap();
      var reasonMap = ensureValidationFailedReasonMap();
      var changed = false;
      if (failed) {
        if (!map[step]) {
          map[step] = true;
          changed = true;
        }
        reasonMap[step] = getValidationFailureReason(step);
      } else if (map[step]) {
        delete map[step];
        if (Object.prototype.hasOwnProperty.call(reasonMap, step)) delete reasonMap[step];
        changed = true;
      }
      return changed;
    }
    
    function validateReviewResult() {
      var targetEl = reviewResultEl || (typeof document !== 'undefined' ? document.getElementById('reviewResult') : null);
      if (!targetEl || isStepLocked('review')) return false;
      var text = targetEl.value ? targetEl.value.trim() : '';
      if (!text) return applyValidationFailure('review', false);
      var payloadObj = unwrapRequirementPayload ? unwrapRequirementPayload(text) : { payload: text };
      var basePayload = Object.prototype.hasOwnProperty.call(payloadObj, 'payload') ? payloadObj.payload : text;
      var parsed = null;
      if (Array.isArray(basePayload)) {
        parsed = basePayload;
      } else if (basePayload && typeof basePayload === 'object' && Array.isArray(basePayload.data)) {
        parsed = basePayload.data;
      } else {
        try {
          parsed = typeof basePayload === 'string' ? JSON.parse(basePayload) : basePayload;
        } catch (err) {
          parsed = null;
        }
        if (parsed && parsed.data && Array.isArray(parsed.data)) {
          parsed = parsed.data;
        }
      }
      var valid = Array.isArray(parsed);
      return applyValidationFailure('review', !valid);
    }
    
    function validateCleanResult() {
      var targetEl = cleanedTextEl || (typeof document !== 'undefined' ? document.getElementById('cleanedText') : null);
      if (!targetEl || isStepLocked('clean')) return false;
      var text = targetEl.value ? targetEl.value.trim() : '';
      if (!text) return applyValidationFailure('clean', false);
      var expectJson = typeof shouldExpectCleanJson === 'function' ? shouldExpectCleanJson() : false;
      if (!expectJson) return applyValidationFailure('clean', false);
      var payloadObj = unwrapRequirementPayload ? unwrapRequirementPayload(text) : { payload: text };
      var basePayload = Object.prototype.hasOwnProperty.call(payloadObj, 'payload') ? payloadObj.payload : text;
      var parsed = null;
      if (Array.isArray(basePayload)) {
        parsed = basePayload;
      } else if (basePayload && typeof basePayload === 'object') {
        parsed = basePayload;
      } else {
        var raw = typeof basePayload === 'string' ? basePayload : '';
        if (stripRequirementHeader && raw) raw = stripRequirementHeader(raw);
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch (err) {
          parsed = null;
        }
        if (parsed && parsed.payload && typeof parsed.payload === 'object' && !Array.isArray(parsed.payload)) {
          parsed = parsed.payload;
        }
      }
      var valid = parsed && (Array.isArray(parsed) || typeof parsed === 'object');
      return applyValidationFailure('clean', !valid);
    }
    
    function validateCompareResult() {
      var targetEl = compareResultEl || (typeof document !== 'undefined' ? document.getElementById('compareResult') : null);
      if (!targetEl || isStepLocked('compare')) return false;
      var text = targetEl.value ? targetEl.value.trim() : '';
      if (!text) return applyValidationFailure('compare', false);
      var payload = parseCoveragePayloadFromText(text, 'compare');
      var valid = Boolean(payload) && isCoveragePayload(payload) && clampCoveragePercent(payload.coverage) !== null;
      return applyValidationFailure('compare', !valid);
    }
    
    function validateSplitResult() {
      var targetEl = splitResultEl || (typeof document !== 'undefined' ? document.getElementById('splitResult') : null);
      if (!targetEl || isStepLocked('split')) return false;
      var text = targetEl.value ? targetEl.value.trim() : '';
      if (!text) return applyValidationFailure('split', false);
      var modules = parseSplitModules();
      var valid = Array.isArray(modules) && modules.length > 0;
      return applyValidationFailure('split', !valid);
    }
    
    function validateCasesResult() {
      var targetEl = casesCompareResultEl || (typeof document !== 'undefined' ? document.getElementById('casesCompareResult') : null);
      if (!targetEl || isStepLocked('cases')) return false;
      var text = targetEl.value ? targetEl.value.trim() : '';
      if (!text) return applyValidationFailure('cases', false);
      var payload = parseCoveragePayloadFromText(text, 'cases_compare');
      var valid = Boolean(payload) && isCoveragePayload(payload) && clampCoveragePercent(payload.coverage) !== null;
      return applyValidationFailure('cases', !valid);
    }
    
    function validateCaseSource() {
      if (isStepLocked('cases-upload')) return false;
      var hasSource = false;
      if (typeof api.hasCaseSource === 'function') {
        hasSource = api.hasCaseSource();
      } else if (typeof hasCaseSource === 'function') {
        hasSource = hasCaseSource();
      }
      if (!hasSource) return applyValidationFailure('cases-upload', false);
      var list = typeof api.getCombinedCaseList === 'function' ? api.getCombinedCaseList() : [];
      var valid = Array.isArray(list) && list.length > 0;
      return applyValidationFailure('cases-upload', !valid);
    }
    
    function validateFlowData() {
      var changed = false;
      changed = validateReviewResult() || changed;
      changed = validateCleanResult() || changed;
      changed = validateCompareResult() || changed;
      changed = validateSplitResult() || changed;
      changed = validateCaseSource() || changed;
      changed = validateCasesResult() || changed;
      return changed;
    }

    return {
      pickCoveragePayload: pickCoveragePayload,
      parseCoveragePayloadFromText: parseCoveragePayloadFromText,
      getValidationFailureReason: getValidationFailureReason,
      applyValidationFailure: applyValidationFailure,
      validateReviewResult: validateReviewResult,
      validateCleanResult: validateCleanResult,
      validateCompareResult: validateCompareResult,
      validateSplitResult: validateSplitResult,
      validateCasesResult: validateCasesResult,
      validateCaseSource: validateCaseSource,
      validateFlowData: validateFlowData,
    };
  }

  return {
    create: create,
  };
});

