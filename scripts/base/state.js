(function() {
  window.app = window.app || {};

  var stateInstance = null;

  function ensureDefaultSettings(options) {
    var defaults = options && options.defaultSettings ? options.defaultSettings : null;
    if (defaults && typeof defaults === 'object') return defaults;
    return {
      timeoutSec: 300,
      feishuWebhook: '',
      feishuMention: '',
      tempExecColumns: {
        select: true,
        index: true,
        module: true,
        priority: true,
        preconditions: true,
        steps: true,
        expected: true,
        ops: true,
      },
    };
  }

  function ensureDefaultPlacement(options) {
    var placement = options && options.defaultPlacement ? options.defaultPlacement : null;
    if (placement && typeof placement === 'object') return placement;
    return {
      requirementOrder: [],
      fileOrder: {},
      versionOrder: [],
    };
  }

  function createInitialState(options) {
    var defaultSettings = ensureDefaultSettings(options);
    var defaultPlacement = ensureDefaultPlacement(options);
    var defaultTempExecPageSize = options && options.defaultTempExecPageSize ? options.defaultTempExecPageSize : 20;
    var settingsCopy = Object.assign({}, defaultSettings);
    if (defaultSettings && typeof defaultSettings.tempExecColumns === 'object') {
      settingsCopy.tempExecColumns = Object.assign({}, defaultSettings.tempExecColumns);
    }
    return {
      models: [],
      assignments: {
        cleanId: '',
        reviewId: '',
        compareId: '',
        splitId: '',
        casesId: '',
        caseGenId: '',
        caseFilterId: '',
        cleanPrompt: '',
        reviewPrompt: '',
        comparePrompt: '',
        splitPrompt: '',
        casesPrompt: '',
        caseGenPrompt: '',
        caseFilterPrompt: '',
        cleanReasoning: '',
        reviewReasoning: '',
        compareReasoning: '',
        splitReasoning: '',
        casesReasoning: '',
        caseGenReasoning: '',
        caseFilterReasoning: ''
      },
      settings: settingsCopy,
      editingId: null,
      caseGenModules: [],
      caseGenSource: '',
      caseGenResults: {},
      caseSelections: {},
      importedCases: [],
      caseGenSuggestions: {},
      caseGenModuleStatus: {},
      caseGenProgress: {},
      caseGenRunning: new Set(),
      cleanEntries: [],
      cleanViewSelection: -1,
      cleanHighlightAll: false,
      cleanActiveHighlights: {},
      autoCompareMissingList: [],
      autoCompareSelections: new Set(),
      autoCompareSelectionTouched: false,
      autoCompareSuggestion: '',
      reviewRows: [],
      reviewClarifications: new Map(),
      reviewSelections: new Set(),
      reviewExpanded: new Set(),
      missingSelections: new Set(),
      missingRowCache: [],
      missingLastList: [],
      activeTab: 'clean',
      inProgressStep: '',
      autoRunning: false,
      lastRawImportName: '',
      autoRequireClarifications: false,
      autoClarifyResolver: null,
      tempExecFiles: [],
      tempExecActiveId: '',
      tempExecSelections: {},
      tempExecRemarkOpen: {},
      tempExecReuseOpen: {},
      tempExecMindMode: false,
      tempExecPages: {},
      tempExecPageSize: defaultTempExecPageSize,
      tempExecFocus: [],
      tempExecVersions: [],
      tempExecPlacement: Object.assign({}, defaultPlacement),
      tempExecPresetDraft: null,
      tempExecDefectOpen: {},
      tempExecUndoStack: [],
      tempExecSearch: { fileId: '', term: '', raw: '' },
      tempExecReqCollapsed: false,
      tempExecVersionCollapsed: false,
      autoExpandMissing: false,
      requirementLabel: '',
      requirementLabelSource: '',
    };
  }

  function initState(options) {
    if (!stateInstance) {
      stateInstance = createInitialState(options || {});
      window.app.state = stateInstance;
    }
    return stateInstance;
  }

  function getState() {
    return stateInstance || window.app.state || null;
  }

  function replaceState(nextState) {
    stateInstance = nextState || null;
    window.app.state = stateInstance;
    return stateInstance;
  }

  window.app.stateManager = {
    initState: initState,
    createInitialState: createInitialState,
    getState: getState,
    replaceState: replaceState,
  };
})();
