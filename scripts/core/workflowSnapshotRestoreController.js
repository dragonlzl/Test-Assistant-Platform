(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.workflowSnapshotRestoreController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  'use strict';

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state || {};
    var dom = opts.dom || {};
    var cloneJson = typeof opts.cloneJson === 'function'
      ? opts.cloneJson
      : function(value, fallback) {
          try {
            return JSON.parse(JSON.stringify(value));
          } catch (err) {
            return fallback;
          }
        };
    var snapshotModel = opts.snapshotModel || null;
    var autoCompareSuggestionInput = opts.autoCompareSuggestionInput || null;
    if (!snapshotModel || typeof snapshotModel.prepareSnapshotData !== 'function') {
      throw new Error('workflowSnapshotModel 未初始化');
    }
    var normalizeImportedCases = snapshotModel.normalizeImportedCases;
    var createEmptyRequirementMediaSnapshot = snapshotModel.createEmptyRequirementMediaSnapshot;
    var createEmptyLegacyCaseGenSnapshot = snapshotModel.createEmptyLegacyCaseGenSnapshot;
    var createEmptyXmindCaseGenSnapshot = snapshotModel.createEmptyXmindCaseGenSnapshot;
    var hasXmindCaseGenContent = snapshotModel.hasXmindCaseGenContent;
    var buildWorkflowNavSnapshot = snapshotModel.buildWorkflowNavSnapshot;

    function restoreReviewClarifications(list) {
      var map = new Map();
      if (!Array.isArray(list)) return map;
      list.forEach(function(item) {
        if (!item || typeof item !== 'object') return;
        var index = Number(item.index);
        if (!Number.isFinite(index)) return;
        map.set(index, item.text ? String(item.text) : '');
      });
      return map;
    }

    function restoreCaseSelections(data) {
      var result = {};
      if (!data || typeof data !== 'object') return result;
      Object.keys(data).forEach(function(key) {
        var items = Array.isArray(data[key]) ? data[key] : [];
        result[key] = new Set(items.map(function(value) {
          return Number(value);
        }).filter(function(value) {
          return Number.isFinite(value);
        }));
      });
      return result;
    }

    function restoreNumberSet(list) {
      if (!Array.isArray(list)) return new Set();
      return new Set(list.map(function(item) {
        return Number(item);
      }).filter(function(item) {
        return Number.isFinite(item);
      }));
    }

    function normalizeRequirementMedia(value, fallback) {
      var media = value && typeof value === 'object'
        ? cloneJson(value, createEmptyRequirementMediaSnapshot())
        : cloneJson(fallback, createEmptyRequirementMediaSnapshot());
      if (!media || typeof media !== 'object') media = createEmptyRequirementMediaSnapshot();
      if (!Array.isArray(media.docxImages)) media.docxImages = [];
      if (!Array.isArray(media.pastedImages)) media.pastedImages = [];
      if (!Number.isFinite(Number(media.lastDocxImageCount))) media.lastDocxImageCount = 0;
      if (!Number.isFinite(Number(media.updatedAt))) media.updatedAt = 0;
      return media;
    }

    function normalizeLegacyCaseGenState(data) {
      var legacy = state.caseGenLegacy;
      if (!legacy || typeof legacy !== 'object') legacy = createEmptyLegacyCaseGenSnapshot();
      legacy.requirementLabel = String(legacy.requirementLabel || '');
      legacy.requirementLabelSource = String(legacy.requirementLabelSource || '');
      legacy.lastRawImportName = String(legacy.lastRawImportName || '');
      legacy.rawText = String(legacy.rawText || '');
      legacy.caseText = String(legacy.caseText || '');
      if (!legacy.requirementLabel && state.requirementLabel) legacy.requirementLabel = String(state.requirementLabel || '');
      if (!legacy.requirementLabelSource && state.requirementLabelSource) {
        legacy.requirementLabelSource = String(state.requirementLabelSource || '');
      }
      if (!legacy.lastRawImportName && state.lastRawImportName) legacy.lastRawImportName = String(state.lastRawImportName || '');
      if (!legacy.rawText && data.rawText) legacy.rawText = String(data.rawText || '');
      if (!legacy.caseText && data.caseText) legacy.caseText = String(data.caseText || '');
      legacy.importedCases = normalizeImportedCases(legacy.importedCases);
      if (!legacy.importedCases.length && state.importedCases && state.importedCases.length) {
        legacy.importedCases = normalizeImportedCases(state.importedCases);
      }
      legacy.requirementMedia = normalizeRequirementMedia(legacy.requirementMedia, null);
      if (
        state.requirementMedia
        && typeof state.requirementMedia === 'object'
        && !legacy.requirementMedia.docxImages.length
        && !legacy.requirementMedia.pastedImages.length
      ) {
        legacy.requirementMedia = cloneJson(state.requirementMedia, createEmptyRequirementMediaSnapshot());
      }
      if (!Array.isArray(legacy.modules)) legacy.modules = [];
      legacy.source = String(legacy.source || '');
      if (!legacy.results || typeof legacy.results !== 'object') legacy.results = {};
      if (!legacy.selections || typeof legacy.selections !== 'object') legacy.selections = {};
      if (!legacy.suggestions || typeof legacy.suggestions !== 'object') legacy.suggestions = {};
      if (!legacy.moduleStatus || typeof legacy.moduleStatus !== 'object') legacy.moduleStatus = {};
      if (!legacy.progress || typeof legacy.progress !== 'object') legacy.progress = {};
      if (!legacy.timing || typeof legacy.timing !== 'object') legacy.timing = {};
      if (!legacy.progressNotice || typeof legacy.progressNotice !== 'object') legacy.progressNotice = {};
      state.caseGenLegacy = legacy;
    }

    function normalizeXmindCaseGenState() {
      var xmind = state.xmindCaseGen;
      if (!xmind || typeof xmind !== 'object') xmind = createEmptyXmindCaseGenSnapshot();
      if (!Array.isArray(xmind.history)) xmind.history = [];
      if (!Array.isArray(xmind.operationSnapshots)) xmind.operationSnapshots = [];
      if (!Array.isArray(xmind.snapshots)) xmind.snapshots = [];
      if (!Array.isArray(xmind.rootSnapshots)) xmind.rootSnapshots = [];
      if (!Array.isArray(xmind.workspaceOrder)) xmind.workspaceOrder = [];
      if (!xmind.workspaces || typeof xmind.workspaces !== 'object') xmind.workspaces = {};
      xmind.activeWorkspaceId = String(xmind.activeWorkspaceId || '');
      xmind.mirrorWorkspaceId = String(xmind.mirrorWorkspaceId || '');
      if (!Number.isFinite(Number(xmind.nextWorkspaceSeq))) xmind.nextWorkspaceSeq = 1;
      if (!xmind.viewState || typeof xmind.viewState !== 'object') {
        xmind.viewState = createEmptyXmindCaseGenSnapshot().viewState;
      }
      if (!Array.isArray(xmind.viewState.collapsedNodeKeys)) xmind.viewState.collapsedNodeKeys = [];
      if (!Array.isArray(xmind.deletedBaselineModuleKeys)) xmind.deletedBaselineModuleKeys = [];
      if (!Array.isArray(xmind.deletedBaselineCaseKeys)) xmind.deletedBaselineCaseKeys = [];
      if (!Array.isArray(xmind.deleteUndoStack)) xmind.deleteUndoStack = [];
      if (!Array.isArray(xmind.deleteRedoStack)) xmind.deleteRedoStack = [];
      if (!xmind.modules || typeof xmind.modules !== 'object') xmind.modules = {};
      if (!xmind.root || typeof xmind.root !== 'object') xmind.root = createEmptyXmindCaseGenSnapshot().root;
      if (!Number.isFinite(Number(xmind.nextSnapshotId))) xmind.nextSnapshotId = 1;
      xmind.mode = xmind.mode === 'full' ? 'full' : 'modules';
      xmind.treeSourceSignature = String(xmind.treeSourceSignature || '');
      xmind.hasModuleSkeleton = xmind.hasModuleSkeleton === true;
      xmind.hasImportedBaseline = xmind.hasImportedBaseline === true;
      xmind.openButtonDotVisible = xmind.openButtonDotVisible === true;
      xmind.workspaceOrder = xmind.workspaceOrder.map(function(item) {
        return String(item || '').trim();
      }).filter(Boolean);
      xmind.lastOperationSnapshotId = String(xmind.lastOperationSnapshotId || '');
      xmind.rootSnapshotId = String(xmind.rootSnapshotId || '');
      xmind.root.taskId = String(xmind.root.taskId || '');
      xmind.viewState.drawerOpen = xmind.viewState.drawerOpen === true;
      xmind.viewState.fullscreen = xmind.viewState.fullscreen === true;
      xmind.viewState.transform = String(xmind.viewState.transform || '');
      xmind.viewState.scaleVal = Number(xmind.viewState.scaleVal || 1);
      if (!isFinite(xmind.viewState.scaleVal) || xmind.viewState.scaleVal <= 0) xmind.viewState.scaleVal = 1;
      xmind.viewState.scrollLeft = Number(xmind.viewState.scrollLeft || 0);
      if (!isFinite(xmind.viewState.scrollLeft) || xmind.viewState.scrollLeft < 0) xmind.viewState.scrollLeft = 0;
      xmind.viewState.scrollTop = Number(xmind.viewState.scrollTop || 0);
      if (!isFinite(xmind.viewState.scrollTop) || xmind.viewState.scrollTop < 0) xmind.viewState.scrollTop = 0;
      xmind.viewState.collapsedNodeKeys = xmind.viewState.collapsedNodeKeys.map(function(item) {
        return String(item || '').trim();
      }).filter(Boolean);
      xmind.viewState.treeSourceSignature = String(xmind.viewState.treeSourceSignature || '');
      xmind.viewState.updatedAt = Number(xmind.viewState.updatedAt || 0);
      if (!isFinite(xmind.viewState.updatedAt) || xmind.viewState.updatedAt < 0) xmind.viewState.updatedAt = 0;
      xmind.deletedBaselineModuleKeys = xmind.deletedBaselineModuleKeys.map(function(item) {
        return String(item || '').trim().toLowerCase();
      }).filter(Boolean);
      xmind.deletedBaselineCaseKeys = xmind.deletedBaselineCaseKeys.map(function(item) {
        return String(item || '').trim();
      }).filter(Boolean);
      xmind.summaryCollapsed = xmind.summaryCollapsed === true;
      if (!xmind.prep || typeof xmind.prep !== 'object') xmind.prep = createEmptyXmindCaseGenSnapshot().prep;
      xmind.prep.step = Math.max(1, Math.min(3, Number(xmind.prep.step) || 1));
      xmind.prep.requirementMode = xmind.prep.requirementMode === 'manual'
        ? 'manual'
        : (xmind.prep.requirementMode === 'document' ? 'document' : '');
      xmind.prep.requirementSupplement = String(xmind.prep.requirementSupplement || '');
      if (!Array.isArray(xmind.prep.manualRequirementBlocks)) xmind.prep.manualRequirementBlocks = [];
      xmind.prep.caseImportMode = xmind.prep.caseImportMode === 'import'
        ? 'import'
        : (xmind.prep.caseImportMode === 'skip' ? 'skip' : '');
      xmind.prep.completed = xmind.prep.completed === true;
      state.xmindCaseGen = xmind;
    }

    function applySnapshot(snapshot) {
      if (!snapshot || !snapshot.data || typeof snapshot.data !== 'object') return false;
      var data = snapshotModel.prepareSnapshotData(snapshot.data);
      state.workflowNavSnapshot = buildWorkflowNavSnapshot(data);
      state.requirementLabel = data.requirementLabel || '';
      state.requirementLabelSource = data.requirementLabelSource || '';
      state.lastRawImportName = data.lastRawImportName || '';
      if (dom.rawText) dom.rawText.value = data.rawText || '';
      if (dom.fileName) dom.fileName.textContent = data.lastRawImportName ? String(data.lastRawImportName) : '未选择文件';
      if (dom.reviewResultEl) dom.reviewResultEl.value = data.reviewResult || '';
      if (dom.cleanedTextEl) dom.cleanedTextEl.value = data.cleanedText || '';
      if (dom.compareResultEl) dom.compareResultEl.value = data.compareResult || '';
      state.compareCaseAssistantStatus = data.compareCaseAssistantStatus || 'idle';
      if (dom.splitResultEl) dom.splitResultEl.value = data.splitResult || '';
      if (dom.casesCompareResultEl) dom.casesCompareResultEl.value = data.casesCompareResult || '';
      if (dom.caseTextEl) dom.caseTextEl.value = data.caseText || '';
      state.importedCases = normalizeImportedCases(data.importedCases);
      state.requirementMedia = normalizeRequirementMedia(data.requirementMedia, state.requirementMedia);
      state.reviewClarifications = restoreReviewClarifications(data.reviewClarifications);
      state.autoCompareSuggestion = data.autoCompareSuggestion || '';
      state.autoRequireClarifications = Boolean(data.autoRequireClarifications);
      if (autoCompareSuggestionInput) autoCompareSuggestionInput.value = state.autoCompareSuggestion;
      if (dom.autoClarifyToggle) dom.autoClarifyToggle.checked = state.autoRequireClarifications;
      state.caseGenSource = data.caseGenSource || '';
      state.caseGenModules = Array.isArray(data.caseGenModules) ? data.caseGenModules : [];
      state.caseGenResults = data.caseGenResults && typeof data.caseGenResults === 'object' ? data.caseGenResults : {};
      state.caseGenSettings = data.caseGenSettings && typeof data.caseGenSettings === 'object' ? data.caseGenSettings : {};
      state.caseGenSuggestions = data.caseGenSuggestions && typeof data.caseGenSuggestions === 'object' ? data.caseGenSuggestions : {};
      state.caseGenModuleStatus = data.caseGenModuleStatus && typeof data.caseGenModuleStatus === 'object' ? data.caseGenModuleStatus : {};
      state.caseGenProgress = data.caseGenProgress && typeof data.caseGenProgress === 'object' ? data.caseGenProgress : {};
      state.caseGenTiming = data.caseGenTiming && typeof data.caseGenTiming === 'object' ? data.caseGenTiming : {};
      state.caseGenProgressNotice = data.caseGenProgressNotice && typeof data.caseGenProgressNotice === 'object'
        ? data.caseGenProgressNotice
        : {};
      state.caseGenLegacy = data.caseGenLegacy && typeof data.caseGenLegacy === 'object'
        ? data.caseGenLegacy
        : createEmptyLegacyCaseGenSnapshot();
      if ((!data.caseGenLegacy || typeof data.caseGenLegacy !== 'object') && !hasXmindCaseGenContent(data.xmindCaseGen)) {
        state.caseGenLegacy = {
          requirementLabel: state.requirementLabel || '',
          requirementLabelSource: state.requirementLabelSource || '',
          lastRawImportName: state.lastRawImportName || '',
          rawText: data.rawText || '',
          caseText: data.caseText || '',
          importedCases: normalizeImportedCases(data.importedCases),
          requirementMedia: cloneJson(state.requirementMedia, createEmptyRequirementMediaSnapshot()),
          modules: cloneJson(state.caseGenModules, []),
          source: state.caseGenSource || '',
          results: cloneJson(state.caseGenResults, {}),
          selections: cloneJson(data.caseSelections, {}),
          suggestions: cloneJson(state.caseGenSuggestions, {}),
          moduleStatus: cloneJson(state.caseGenModuleStatus, {}),
          progress: cloneJson(state.caseGenProgress, {}),
          timing: cloneJson(state.caseGenTiming, {}),
          progressNotice: cloneJson(state.caseGenProgressNotice, {}),
        };
      }
      state.xmindCaseGen = data.xmindCaseGen && typeof data.xmindCaseGen === 'object'
        ? data.xmindCaseGen
        : createEmptyXmindCaseGenSnapshot();
      if (!state.caseGenProgressNotice.lastStates || typeof state.caseGenProgressNotice.lastStates !== 'object') {
        state.caseGenProgressNotice.lastStates = {};
      }
      state.caseGenProgressNotice.dotVisible = state.caseGenProgressNotice.dotVisible === true;
      normalizeLegacyCaseGenState(data);
      normalizeXmindCaseGenState();
      state.caseSelections = restoreCaseSelections(data.caseSelections);
      state.missingSelections = restoreNumberSet(data.missingSelections);
      state.missingRowCache = [];
      state.missingLastList = [];
      state.caseGenRunning = new Set();
      state.inProgressStep = '';
      state.inProgressSteps = {};
      state.failedSteps = {};
      state.waitingSteps = {};
      state.validationFailedSteps = {};
      state.failedReasons = {};
      state.waitingReasons = {};
      state.validationFailedReasons = {};
      state.autoRunning = false;
      return true;
    }
    return { applySnapshot: applySnapshot };
  }

  return { create: create };
});
