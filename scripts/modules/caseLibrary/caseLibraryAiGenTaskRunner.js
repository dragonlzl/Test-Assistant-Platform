(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.aiGenTaskRunner = api;
  }
})(function() {
  if (typeof module !== 'undefined' && module.exports) {
    return require('../casePageAiGenTaskRunner.js');
  }
  if (typeof window !== 'undefined' && window.app && window.app.casePageAiGenTaskRunner) {
    return window.app.casePageAiGenTaskRunner;
  }
  throw new Error('case page AI generation task runner is required');
});
