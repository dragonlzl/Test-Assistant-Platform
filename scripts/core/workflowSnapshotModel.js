(function(root, factory) {
  var xmindSnapshotCodecFactory = root && root.app ? root.app.workflowXmindSnapshotCodec : null;
  if (typeof module !== 'undefined' && module.exports) {
    xmindSnapshotCodecFactory = xmindSnapshotCodecFactory || require('./workflowXmindSnapshotCodec.js');
  }
  var api = factory(xmindSnapshotCodecFactory);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.workflowSnapshotModel = api;
  }
})(typeof window !== 'undefined' ? window : null, function(workflowXmindSnapshotCodecFactory) {
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
    var autoCompareSuggestionInput = opts.autoCompareSuggestionInput || null;

    function getPersistUserId() {
      if (state.currentUser && (state.currentUser.id || state.currentUser.id === 0)) {
        return String(state.currentUser.id);
      }
      return '';
    }

    function normalizeImportedCases(list) {
      if (!Array.isArray(list)) return [];
      return list.map(function(item, idx) {
        var entry = item && typeof item === 'object' ? item : {};
        return {
          id: entry.id ? String(entry.id) : ('case-' + Date.now().toString(16) + '-' + idx),
          name: entry.name ? String(entry.name) : ('测试用例' + (idx + 1)),
          text: entry.text ? String(entry.text) : '',
          list: Array.isArray(entry.list) ? entry.list : [],
        };
      });
    }

    function serializeCaseSelections(selectionMap) {
      var result = {};
      if (!selectionMap || typeof selectionMap !== 'object') return result;
      Object.keys(selectionMap).forEach(function(key) {
        var selection = selectionMap[key];
        if (!selection || typeof selection.forEach !== 'function') return;
        result[key] = Array.from(selection);
      });
      return result;
    }

    function serializeNumberSet(value) {
      if (!value || typeof value.forEach !== 'function') return [];
      return Array.from(value);
    }

    function serializeReviewClarifications(map) {
      var list = [];
      if (!map || typeof map.forEach !== 'function') return list;
      map.forEach(function(value, key) {
        var index = Number(key);
        if (!Number.isFinite(index)) return;
        list.push({ index: index, text: value ? String(value) : '' });
      });
      return list;
    }

    function createEmptyRequirementMediaSnapshot() {
      return {
        docxImages: [],
        pastedImages: [],
        lastDocxImageCount: 0,
        updatedAt: 0,
      };
    }

    function createEmptyLegacyCaseGenSnapshot() {
      return {
        requirementLabel: '',
        requirementLabelSource: '',
        lastRawImportName: '',
        rawText: '',
        caseText: '',
        importedCases: [],
        requirementMedia: createEmptyRequirementMediaSnapshot(),
        modules: [],
        source: '',
        results: {},
        selections: {},
        suggestions: {},
        moduleStatus: {},
        progress: {},
        timing: {},
        progressNotice: {},
      };
    }

    if (!workflowXmindSnapshotCodecFactory || typeof workflowXmindSnapshotCodecFactory.create !== 'function') {
      throw new Error('workflowXmindSnapshotCodec 未初始化');
    }
    var xmindSnapshotCodec = workflowXmindSnapshotCodecFactory.create({
      cloneJson: cloneJson,
      normalizeImportedCases: normalizeImportedCases,
      createEmptyRequirementMediaSnapshot: createEmptyRequirementMediaSnapshot,
    });

    function buildWorkflowSharedXmindSnapshot() {
      return xmindSnapshotCodec.buildPersistedSharedSnapshot({
        requirementLabel: state.requirementLabel || '',
        requirementLabelSource: state.requirementLabelSource || '',
        lastRawImportName: state.lastRawImportName || '',
        rawText: dom.rawText && dom.rawText.value ? dom.rawText.value : '',
        caseText: dom.caseTextEl && dom.caseTextEl.value ? dom.caseTextEl.value : '',
        importedCases: state.importedCases,
        caseGenModules: state.caseGenModules,
        caseGenSource: state.caseGenSource || '',
        caseGenResults: state.caseGenResults,
        caseSelections: serializeCaseSelections(state.caseSelections),
        caseGenSuggestions: state.caseGenSuggestions,
        caseGenModuleStatus: state.caseGenModuleStatus,
        caseGenProgress: state.caseGenProgress,
        caseGenTiming: state.caseGenTiming,
        caseGenProgressNotice: state.caseGenProgressNotice,
        caseGenSettings: state.caseGenSettings,
        requirementMedia: state.requirementMedia,
      });
    }

    function buildWorkflowSnapshot() {
      var legacy = state.caseGenLegacy && typeof state.caseGenLegacy === 'object'
        ? state.caseGenLegacy
        : createEmptyLegacyCaseGenSnapshot();
      var activeSharedXmindSnapshot = buildWorkflowSharedXmindSnapshot();
      var data = {
        requirementLabel: state.requirementLabel || '',
        requirementLabelSource: state.requirementLabelSource || '',
        lastRawImportName: state.lastRawImportName || '',
        rawText: dom.rawText && dom.rawText.value ? dom.rawText.value : '',
        reviewResult: dom.reviewResultEl && dom.reviewResultEl.value ? dom.reviewResultEl.value : '',
        cleanedText: dom.cleanedTextEl && dom.cleanedTextEl.value ? dom.cleanedTextEl.value : '',
        compareResult: dom.compareResultEl && dom.compareResultEl.value ? dom.compareResultEl.value : '',
        compareCaseAssistantStatus: state.compareCaseAssistantStatus || 'idle',
        splitResult: dom.splitResultEl && dom.splitResultEl.value ? dom.splitResultEl.value : '',
        casesCompareResult: dom.casesCompareResultEl && dom.casesCompareResultEl.value ? dom.casesCompareResultEl.value : '',
        caseText: dom.caseTextEl && dom.caseTextEl.value ? dom.caseTextEl.value : '',
        importedCases: normalizeImportedCases(state.importedCases),
        requirementMedia: cloneJson(state.requirementMedia, createEmptyRequirementMediaSnapshot()),
        reviewClarifications: serializeReviewClarifications(state.reviewClarifications),
        autoCompareSuggestion: state.autoCompareSuggestion || (autoCompareSuggestionInput ? autoCompareSuggestionInput.value : ''),
        autoRequireClarifications: Boolean(state.autoRequireClarifications),
        caseGenSource: state.caseGenSource || '',
        caseGenModules: cloneJson(state.caseGenModules, []),
        caseGenResults: xmindSnapshotCodec.compactCaseGenResultsMap(state.caseGenResults),
        caseGenSettings: cloneJson(state.caseGenSettings, {}),
        caseGenSuggestions: cloneJson(state.caseGenSuggestions, {}),
        caseGenModuleStatus: cloneJson(state.caseGenModuleStatus, {}),
        caseGenProgress: cloneJson(state.caseGenProgress, {}),
        caseGenTiming: cloneJson(state.caseGenTiming, {}),
        caseGenProgressNotice: cloneJson(state.caseGenProgressNotice, {}),
        caseGenLegacy: {
          modules: cloneJson(legacy.modules, []),
          source: String(legacy.source || ''),
          results: xmindSnapshotCodec.compactCaseGenResultsMap(legacy.results),
          selections: cloneJson(legacy.selections, {}),
          suggestions: cloneJson(legacy.suggestions, {}),
          moduleStatus: cloneJson(legacy.moduleStatus, {}),
          progress: cloneJson(legacy.progress, {}),
          timing: cloneJson(legacy.timing, {}),
          progressNotice: cloneJson(legacy.progressNotice, {}),
        },
        xmindCaseGen: xmindSnapshotCodec.buildPersistedSnapshot(state.xmindCaseGen, activeSharedXmindSnapshot),
        caseSelections: serializeCaseSelections(state.caseSelections),
        missingSelections: serializeNumberSet(state.missingSelections),
      };
      return {
        version: 1,
        user_id: getPersistUserId(),
        updated_at: Date.now(),
        data: data,
      };
    }

    function buildWorkflowNavSnapshot(data) {
      if (!data || typeof data !== 'object') return {};
      return {
        rawText: data.rawText || '',
        reviewResult: data.reviewResult || '',
        cleanedText: data.cleanedText || '',
        compareResult: data.compareResult || '',
        splitResult: data.splitResult || '',
        casesCompareResult: data.casesCompareResult || '',
        caseText: data.caseText || '',
        importedCases: Array.isArray(data.importedCases) ? data.importedCases : [],
      };
    }

    function hasRequirementLabel(data) {
      if (!data) return false;
      var label = data.requirementLabel ? String(data.requirementLabel).trim() : '';
      if (!label) return false;
      var source = data.requirementLabelSource ? String(data.requirementLabelSource).trim() : '';
      if (source && source !== 'default') return true;
      return label !== '当前需求';
    }

    function hasXmindCaseGenContent(value) {
      var data = value && typeof value === 'object' ? value : null;
      if (!data) return false;
      var workspaceOrder = Array.isArray(data.workspaceOrder) ? data.workspaceOrder : [];
      var workspaces = data.workspaces && typeof data.workspaces === 'object' ? data.workspaces : {};
      if (workspaceOrder.length > 0 || Object.keys(workspaces).length > 0) return true;
      if (String(data.activeWorkspaceId || '').trim()) return true;
      if (Array.isArray(data.history) && data.history.length > 0) return true;
      if (Array.isArray(data.snapshots) && data.snapshots.length > 0) return true;
      if (Array.isArray(data.rootSnapshots) && data.rootSnapshots.length > 0) return true;
      if (Array.isArray(data.operationSnapshots) && data.operationSnapshots.length > 0) return true;
      if (data.modules && typeof data.modules === 'object' && Object.keys(data.modules).length > 0) return true;
      if (data.root && typeof data.root === 'object') {
        if (data.root.running === true) return true;
        if (String(data.root.taskId || '').trim()) return true;
        if (String(data.root.status || '').trim()) return true;
        if (String(data.root.error || '').trim()) return true;
      }
      if (data.prep && typeof data.prep === 'object') {
        if (data.prep.completed === true) return true;
        if (String(data.prep.requirementMode || '').trim()) return true;
        if (String(data.prep.requirementSupplement || '').trim()) return true;
        if (String(data.prep.caseImportMode || '').trim()) return true;
        if (String(data.prep.manualRequirementLabel || '').trim()) return true;
        if (Array.isArray(data.prep.manualRequirementBlocks) && data.prep.manualRequirementBlocks.length > 0) return true;
      }
      return false;
    }

    function snapshotHasContent(snapshot) {
      var data = snapshot && snapshot.data ? snapshot.data : {};
      function hasText(value) {
        return Boolean(value && String(value).trim());
      }
      if (
        hasText(data.rawText)
        || hasText(data.reviewResult)
        || hasText(data.cleanedText)
        || hasText(data.compareResult)
        || hasText(data.splitResult)
        || hasText(data.casesCompareResult)
        || hasText(data.caseText)
        || hasText(data.autoCompareSuggestion)
      ) return true;
      if (hasRequirementLabel(data) || data.autoRequireClarifications) return true;
      if (Array.isArray(data.importedCases) && data.importedCases.length) return true;
      if (Array.isArray(data.caseGenModules) && data.caseGenModules.length) return true;
      if (data.reviewClarifications && data.reviewClarifications.length) return true;
      if (data.caseGenSettings && typeof data.caseGenSettings === 'object') {
        var defaultCaseGenSettings = {
          customRequirement: '',
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
        };
        var hasCaseGenSettingDiff = Object.keys(defaultCaseGenSettings).some(function(key) {
          var currentValue = data.caseGenSettings[key];
          var defaultValue = defaultCaseGenSettings[key];
          if (typeof defaultValue === 'string') return String(currentValue || '') !== defaultValue;
          return (currentValue === true) !== (defaultValue === true);
        });
        if (hasCaseGenSettingDiff) return true;
      }
      if (data.caseGenSuggestions && typeof data.caseGenSuggestions === 'object') {
        var hasSuggestion = Object.keys(data.caseGenSuggestions).some(function(key) {
          return hasText(data.caseGenSuggestions[key]);
        });
        if (hasSuggestion) return true;
      }
      if (data.caseGenResults && typeof data.caseGenResults === 'object') {
        var hasResult = Object.keys(data.caseGenResults).some(function(key) {
          var value = (data.caseGenResults[key] || '').trim();
          return Boolean(value && !/^\[\s*\]$/.test(value));
        });
        if (hasResult) return true;
      }
      if (data.caseGenLegacy && typeof data.caseGenLegacy === 'object') {
        if (Array.isArray(data.caseGenLegacy.modules) && data.caseGenLegacy.modules.length) return true;
        if (data.caseGenLegacy.results && typeof data.caseGenLegacy.results === 'object') {
          var hasLegacyResult = Object.keys(data.caseGenLegacy.results).some(function(key) {
            var value = (data.caseGenLegacy.results[key] || '').trim();
            return Boolean(value && !/^\[\s*\]$/.test(value));
          });
          if (hasLegacyResult) return true;
        }
      }
      return hasXmindCaseGenContent(data.xmindCaseGen);
    }

    return {
      buildSnapshot: buildWorkflowSnapshot,
      snapshotHasContent: snapshotHasContent,
      buildWorkflowNavSnapshot: buildWorkflowNavSnapshot,
      prepareSnapshotData: xmindSnapshotCodec.prepareSnapshotData,
      normalizeImportedCases: normalizeImportedCases,
      createEmptyRequirementMediaSnapshot: createEmptyRequirementMediaSnapshot,
      createEmptyLegacyCaseGenSnapshot: createEmptyLegacyCaseGenSnapshot,
      createEmptyXmindCaseGenSnapshot: xmindSnapshotCodec.createEmptySnapshot,
      hasXmindCaseGenContent: hasXmindCaseGenContent,
    };
  }

  return { create: create };
});
