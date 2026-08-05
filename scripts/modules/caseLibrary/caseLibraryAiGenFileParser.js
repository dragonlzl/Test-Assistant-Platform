(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibrary = window.app.caseLibrary || {};
    window.app.caseLibrary.aiGenFileParser = api;
  }
})(function() {
  if (typeof module !== 'undefined' && module.exports) {
    return require('../casePageAiGenFileParser.js');
  }
  if (typeof window !== 'undefined' && window.app && window.app.casePageAiGenFileParser) {
    return window.app.casePageAiGenFileParser;
  }
  throw new Error('case page AI generation file parser is required');
});
