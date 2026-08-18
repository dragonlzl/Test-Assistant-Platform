(function() {
  window.app = window.app || {};

  var stateInstance = null;

  function ensureDefaultSettings(options) {
    var defaults = options && options.defaultSettings ? options.defaultSettings : null;
    if (defaults && typeof defaults === 'object') return defaults;
    return {
      timeoutSec: 300,
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
        xmindCaseGenId: '',
        caseFilterId: '',
        missingReminderId: '',
        caseLibraryGenId: '',
        xmindCaseGenPrompt: '',
        caseFilterPrompt: '',
        missingReminderPrompt: '',
        caseLibraryGenPrompt: '',
        xmindCaseGenReasoning: '',
        caseFilterReasoning: '',
        missingReminderReasoning: '',
        caseLibraryGenReasoning: '',
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
        dedupeSimplify: false,
        needFunctionCondition: true,
        needNumericValidation: true,
        needBoundary: false,
        needMobile: false,
        needSpecial: false,
        specialRepeatOperation: false,
        specialMultiTouch: false,
        specialRepeatExecution: false,
        specialWeakNetwork: false,
        specialInterruptResume: false,
      },
      caseGenSuggestions: {},
      caseGenModuleStatus: {},
      caseGenProgress: {},
      caseGenTiming: {},
      caseGenProgressNotice: {},
      caseGenLegacy: {
        requirementLabel: '',
        requirementLabelSource: '',
        lastRawImportName: '',
        rawText: '',
        caseText: '',
        importedCases: [],
        requirementMedia: {
          docxImages: [],
          pastedImages: [],
          lastDocxImageCount: 0,
          updatedAt: 0,
        },
        modules: [],
        source: '',
        results: {},
        selections: {},
        suggestions: {},
        moduleStatus: {},
        progress: {},
        timing: {},
        progressNotice: {},
      },
      caseGenRunning: new Set(),
      xmindCaseGen: {
        activeWorkspaceId: '',
        workspaceOrder: [],
        workspaces: {},
        nextWorkspaceSeq: 1,
        mode: 'modules',
        treeSourceSignature: '',
        hasModuleSkeleton: false,
        hasImportedBaseline: false,
        openButtonDotVisible: false,
        viewState: {
          drawerOpen: false,
          fullscreen: false,
          transform: '',
          scaleVal: 1,
          scrollLeft: 0,
          scrollTop: 0,
          toolbarCollapsed: false,
          collapsedNodeKeys: [],
          treeSourceSignature: '',
          updatedAt: 0,
        },
        history: [],
        operationSnapshots: [],
        lastOperationSnapshotId: '',
        rootSnapshotId: '',
        rootSnapshots: [],
        deleteUndoStack: [],
        deleteRedoStack: [],
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
      activeTab: 'casesgen',
      lastRawImportName: '',
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
