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
      caseAssistantProjectRoot: '',
      caseViewFontSize: 13,
      missingCaseReminderPlacement: 'top',
      missingCaseReminderMatchConfig: { type: true, module: true },
      missingCaseReminderAiEnabled: 'off',
      caseLibraryGenCoverageThreshold: 90,
      smartTopNavCollapse: false,
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
      pageGuideSwitches: {
        auto: true,
        clean: true,
        casesgen: true,
        assign: true,
        models: true,
        tempexec: true,
        'case-library': true,
        'case-archive': true,
        'exec-overview': true,
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
    if (defaultSettings && typeof defaultSettings.pageGuideSwitches === 'object') {
      settingsCopy.pageGuideSwitches = Object.assign({}, defaultSettings.pageGuideSwitches);
    }
    if (defaultSettings && typeof defaultSettings.missingCaseReminderMatchConfig === 'object') {
      settingsCopy.missingCaseReminderMatchConfig = Object.assign({}, defaultSettings.missingCaseReminderMatchConfig);
    }
    return {
      authToken: '',
      currentUser: null,
      userProjects: [],
      projectList: [],
      models: [],
      assignments: {
        cleanId: '',
        reviewId: '',
        compareId: '',
        splitId: '',
        casesId: '',
        caseGenId: '',
        xmindCaseGenId: '',
        caseFilterId: '',
        missingReminderId: '',
        caseLibraryGenId: '',
        cleanPrompt: '',
        reviewPrompt: '',
        comparePrompt: '',
        splitPrompt: '',
        casesPrompt: '',
        caseGenPrompt: '',
        xmindCaseGenPrompt: '',
        caseFilterPrompt: '',
        missingReminderPrompt: '',
        caseLibraryGenPrompt: '',
        cleanReasoning: '',
        reviewReasoning: '',
        compareReasoning: '',
        splitReasoning: '',
        casesReasoning: '',
        caseGenReasoning: '',
        xmindCaseGenReasoning: '',
        caseFilterReasoning: '',
        missingReminderReasoning: '',
        caseLibraryGenReasoning: '',
        cleanTemperature: 0.2,
        reviewTemperature: 0.2,
        compareTemperature: 0.2,
        splitTemperature: 0.2,
        casesTemperature: 0.2,
        caseGenTemperature: 0.2,
        xmindCaseGenTemperature: 0.2,
        caseFilterTemperature: 0.2,
        missingReminderTemperature: 0.2,
        caseLibraryGenTemperature: 0.2,
      },
      settings: settingsCopy,
      editingId: null,
      caseGenModules: [],
      caseGenSource: '',
      caseGenResults: {},
      caseSelections: {},
      importedCases: [],
      caseGenSettings: {
        activeTab: 'settings',
        customRequirement: '',
        needBoundary: false,
        needMobile: false,
        needSpecial: false,
        specialRepeatOperation: false,
        specialMultiTouch: false,
        specialRepeatExecution: false,
        specialWeakNetwork: false,
        specialInterruptResume: false,
      },
      compareCaseAssistantStatus: 'idle',
      caseGenSuggestions: {},
      caseGenModuleStatus: {},
      caseGenProgress: {},
      caseGenRunning: new Set(),
      xmindCaseGen: {
        mode: 'modules',
        treeSourceSignature: '',
        hasModuleSkeleton: false,
        hasImportedBaseline: false,
        rootSnapshotId: '',
        rootSnapshots: [],
        root: {
          lastAction: '',
          running: false,
          snapshotId: '',
          status: '',
          error: '',
          updatedAt: 0,
        },
        prep: {
          step: 1,
          requirementMode: '',
          requirementSupplement: '',
          manualRequirementBlocks: [],
          caseImportMode: '',
          completed: false,
        },
        nextSnapshotId: 1,
        snapshots: [],
        modules: {},
      },
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
      activeTab: 'auto',
      inProgressStep: '',
      inProgressSteps: {},
      failedSteps: {},
      waitingSteps: {},
      failedReasons: {},
      waitingReasons: {},
      validationFailedReasons: {},
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
      tempExecImportProjectFilterId: '',
      tempExecFocus: [],
      tempExecVersions: [],
      tempExecPlacement: Object.assign({}, defaultPlacement),
      tempExecPresetDraft: null,
      tempExecDefectOpen: {},
      tempExecUndoStack: [],
      tempExecSearch: { fileId: '', term: '', raw: '' },
      tempExecStatusFilter: { fileId: '', status: '' },
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
