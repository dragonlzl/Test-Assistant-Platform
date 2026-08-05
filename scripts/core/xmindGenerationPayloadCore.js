(function() {
  window.app = window.app || {};
  var cloneJson = window.app.jsonCloneCore.cloneJson;

  function normalizeArray(value) {
    return Array.isArray(value) ? cloneJson(value, []) : [];
  }

  function compactVisibleModule(item) {
    var source = item && typeof item === 'object' ? item : {};
    return {
      module: source.module ? String(source.module || '') : '',
      key_scenarios: normalizeArray(source.key_scenarios),
      test_points: normalizeArray(source.test_points),
      coupled_modules: normalizeArray(source.coupled_modules),
      cases: [],
    };
  }

  function buildGenerationContext(input) {
    var source = input && typeof input === 'object' ? input : {};
    var contract = source.contract && typeof source.contract === 'object' ? source.contract : {};
    var visibleModules = Array.isArray(source.visibleModules) ? source.visibleModules : [];
    var aiLayer = Array.isArray(source.aiLayer) ? source.aiLayer : [];
    var targetModule = source.targetModule && typeof source.targetModule === 'object'
      ? source.targetModule
      : null;
    if (String(contract.scope || '') !== 'module') {
      return {
        visibleModules: cloneJson(visibleModules, []),
        aiLayer: cloneJson(aiLayer, []),
        targetModule: cloneJson(targetModule, null),
      };
    }
    return {
      visibleModules: visibleModules.map(compactVisibleModule),
      aiLayer: [],
      targetModule: cloneJson(targetModule, null),
    };
  }

  window.app.xmindGenerationPayloadCore = {
    buildCompactVisibleModules: function buildCompactVisibleModules(visibleModules) {
      return (Array.isArray(visibleModules) ? visibleModules : []).map(compactVisibleModule);
    },
    buildGenerationContext: buildGenerationContext,
  };
})();
