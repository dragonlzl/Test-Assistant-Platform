(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.workflowStepStateController = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state || {};
    var api = opts.api || {};
    var updateFlowStatusWithValidation = typeof opts.updateFlowStatusWithValidation === 'function'
      ? opts.updateFlowStatusWithValidation
      : function() {};

    function ensureInProgressMap() {
      if (!state.inProgressSteps || typeof state.inProgressSteps !== 'object') {
        state.inProgressSteps = {};
      }
      if (state.inProgressStep && !state.inProgressSteps[state.inProgressStep]) {
        state.inProgressSteps[state.inProgressStep] = true;
      }
      return state.inProgressSteps;
    }
    
    function ensureWaitingMap() {
      if (!state.waitingSteps || typeof state.waitingSteps !== 'object') {
        state.waitingSteps = {};
      }
      return state.waitingSteps;
    }
    
    function ensureWaitingReasonMap() {
      if (!state.waitingReasons || typeof state.waitingReasons !== 'object') {
        state.waitingReasons = {};
      }
      return state.waitingReasons;
    }
    
    function ensureFailedMap() {
      if (!state.failedSteps || typeof state.failedSteps !== 'object') {
        state.failedSteps = {};
      }
      return state.failedSteps;
    }
    
    function ensureFailedReasonMap() {
      if (!state.failedReasons || typeof state.failedReasons !== 'object') {
        state.failedReasons = {};
      }
      return state.failedReasons;
    }
    
    function ensureValidationFailedMap() {
      if (!state.validationFailedSteps || typeof state.validationFailedSteps !== 'object') {
        state.validationFailedSteps = {};
      }
      return state.validationFailedSteps;
    }
    
    function ensureValidationFailedReasonMap() {
      if (!state.validationFailedReasons || typeof state.validationFailedReasons !== 'object') {
        state.validationFailedReasons = {};
      }
      return state.validationFailedReasons;
    }
    
    function triggerUpdateFlowStatus() {
      if (api && typeof api.updateFlowStatus === 'function') {
        api.updateFlowStatus();
      } else if (typeof updateFlowStatusWithValidation === 'function') {
        updateFlowStatusWithValidation();
      }
    }
    
    function setStepWaiting(step, reason) {
      var map = ensureWaitingMap();
      var reasonMap = ensureWaitingReasonMap();
      if (step) map[step] = true;
      if (step) {
        if (reason) reasonMap[step] = String(reason);
        else if (Object.prototype.hasOwnProperty.call(reasonMap, step)) delete reasonMap[step];
      }
      triggerUpdateFlowStatus();
    }
    
    function clearStepWaiting(step) {
      var map = ensureWaitingMap();
      if (!step || !map[step]) return;
      delete map[step];
      var reasonMap = ensureWaitingReasonMap();
      if (Object.prototype.hasOwnProperty.call(reasonMap, step)) delete reasonMap[step];
      triggerUpdateFlowStatus();
    }
    
    function clearAllWaitingSteps() {
      var map = ensureWaitingMap();
      var keys = Object.keys(map);
      if (!keys.length) return;
      keys.forEach(function(key) { delete map[key]; });
      var reasonMap = ensureWaitingReasonMap();
      Object.keys(reasonMap).forEach(function(key) { delete reasonMap[key]; });
      triggerUpdateFlowStatus();
    }
    
    function setStepFailed(step, reason) {
      var map = ensureFailedMap();
      var reasonMap = ensureFailedReasonMap();
      if (step) map[step] = true;
      if (step) {
        if (reason) reasonMap[step] = String(reason);
        else if (Object.prototype.hasOwnProperty.call(reasonMap, step)) delete reasonMap[step];
      }
      triggerUpdateFlowStatus();
    }
    
    function clearStepFailed(step) {
      var map = ensureFailedMap();
      var validationMap = ensureValidationFailedMap();
      var reasonMap = ensureFailedReasonMap();
      var validationReasonMap = ensureValidationFailedReasonMap();
      var touched = false;
      if (step && map[step]) {
        delete map[step];
        touched = true;
      }
      if (step && Object.prototype.hasOwnProperty.call(reasonMap, step)) {
        delete reasonMap[step];
        touched = true;
      }
      if (step && validationMap[step]) {
        delete validationMap[step];
        touched = true;
      }
      if (step && Object.prototype.hasOwnProperty.call(validationReasonMap, step)) {
        delete validationReasonMap[step];
        touched = true;
      }
      if (touched) triggerUpdateFlowStatus();
    }
    
    function clearAllFailedSteps() {
      var map = ensureFailedMap();
      var validationMap = ensureValidationFailedMap();
      var keys = Object.keys(map).concat(Object.keys(validationMap));
      if (!keys.length) return;
      Object.keys(map).forEach(function(key) { delete map[key]; });
      Object.keys(validationMap).forEach(function(key) { delete validationMap[key]; });
      var reasonMap = ensureFailedReasonMap();
      var validationReasonMap = ensureValidationFailedReasonMap();
      Object.keys(reasonMap).forEach(function(key) { delete reasonMap[key]; });
      Object.keys(validationReasonMap).forEach(function(key) { delete validationReasonMap[key]; });
      triggerUpdateFlowStatus();
    }
    
    function setStepInProgress(step) {
      var map = ensureInProgressMap();
      clearStepWaiting(step);
      clearStepFailed(step);
      if (step) map[step] = true;
      state.inProgressStep = '';
      triggerUpdateFlowStatus();
    }
    
    function clearStepInProgress(step) {
      var map = ensureInProgressMap();
      if (step && map[step]) delete map[step];
      if (state.inProgressStep === step) {
        state.inProgressStep = '';
      }
      triggerUpdateFlowStatus();
    }
    
    function isStepLocked(step) {
      var waiting = ensureWaitingMap();
      var running = ensureInProgressMap();
      return Boolean(waiting[step] || running[step]);
    }

    return {
      ensureInProgressMap: ensureInProgressMap,
      ensureWaitingMap: ensureWaitingMap,
      ensureWaitingReasonMap: ensureWaitingReasonMap,
      ensureFailedMap: ensureFailedMap,
      ensureFailedReasonMap: ensureFailedReasonMap,
      ensureValidationFailedMap: ensureValidationFailedMap,
      ensureValidationFailedReasonMap: ensureValidationFailedReasonMap,
      triggerUpdateFlowStatus: triggerUpdateFlowStatus,
      setStepWaiting: setStepWaiting,
      clearStepWaiting: clearStepWaiting,
      clearAllWaitingSteps: clearAllWaitingSteps,
      setStepFailed: setStepFailed,
      clearStepFailed: clearStepFailed,
      clearAllFailedSteps: clearAllFailedSteps,
      setStepInProgress: setStepInProgress,
      clearStepInProgress: clearStepInProgress,
      isStepLocked: isStepLocked,
    };
  }

  return {
    create: create,
  };
});
