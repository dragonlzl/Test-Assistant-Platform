(function(factory) {
  var api = factory(typeof window !== 'undefined' ? window : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.appDomContext = api;
  }
})(function(defaultRoot) {
  var ghostFieldIds = [
    'rawText',
    'reviewResult',
    'cleanedText',
    'compareResult',
    'splitResult',
    'casesCompareResult',
    'caseText',
  ];

  function ensureAutoWorkflowGhostFields(document) {
    if (!document || !document.body) return;
    var hasMissing = ghostFieldIds.some(function(id) { return !document.getElementById(id); });
    if (!hasMissing) return;
    var container = document.getElementById('autoWorkflowGhostFields');
    if (!container) {
      container = document.createElement('div');
      container.id = 'autoWorkflowGhostFields';
      container.style.display = 'none';
      document.body.appendChild(container);
    }
    ghostFieldIds.forEach(function(id) {
      if (document.getElementById(id)) return;
      var area = document.createElement('textarea');
      area.id = id;
      area.setAttribute('data-ghost', 'true');
      container.appendChild(area);
    });
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var root = opts.root || defaultRoot || {};
    var document = opts.document || root.document;
    var domConfig = opts.domConfig || {};
    var buildDom = typeof opts.buildDom === 'function'
      ? opts.buildDom
      : function() { return {}; };

    ensureAutoWorkflowGhostFields(document);
    var dom = buildDom(domConfig.ids, domConfig.alias);
    dom.tempFocusZone = dom.tempFocusBlock ? dom.tempFocusBlock.querySelector('[data-temp-focus-zone]') : null;
    dom.tempExecViewFocusBlock = document.getElementById('tempExecViewFocusBlock');
    dom.tempExecViewFocusZone = dom.tempExecViewFocusBlock
      ? dom.tempExecViewFocusBlock.querySelector('[data-temp-focus-zone]')
      : null;
    dom.tempExecOverviewSection = document.querySelector('[data-section-id="tempexec-overview"]');
    dom.tempExecViewSection = document.querySelector('[data-section-id="tempexec-view"]');
    dom.autoClarifySection = document.querySelector('[data-section-id="auto-clarify"]');
    dom.flowNav = document.getElementById('flowNav');
    dom.tempexecFlowNav = document.getElementById('tempexecFlowNav');
    dom.flowNavSteps = document.querySelectorAll('#flowNav .step');
    dom.tabButtons = document.querySelectorAll('[data-tab-btn]');
    dom.tabSections = document.querySelectorAll('[data-tab-section]');
    dom.tabGroups = document.querySelectorAll('.tab-group');
    dom.tabGroupButtons = document.querySelectorAll('.tab-group-btn');
    dom.tabSubmenus = document.querySelectorAll('.tab-submenu');
    dom.jumpLinks = document.querySelectorAll('[data-jump]');
    dom.autoMissingSectionSelector = '[data-section-id="auto-cases-missing"]';

    return {
      dom: dom,
      debugNodes: {
        raw: { textarea: dom.rawText, status: dom.parseStatus, label: '原始需求', tag: 'RAW' },
        cleaned: { textarea: dom.cleanedTextEl, status: dom.cleanStatus, label: '清洗结果', tag: 'CLEANED' },
        split: { textarea: dom.splitResultEl, status: dom.splitStatus, label: '拆分结果', tag: 'SPLIT' },
        cases: { textarea: dom.caseTextEl, status: dom.caseStatus, label: '测试用例', tag: 'CASES' },
      },
    };
  }

  return {
    create: create,
    ensureAutoWorkflowGhostFields: ensureAutoWorkflowGhostFields,
  };
});
